import {fetch} from 'dva';
import * as forge from 'node-forge';
import { message } from 'antd';
import * as Constants from './constants';
import { isObject, } from './helper';
import { encryptRSA, decryptRSA, responseCryptoCapability, decryptGcmResponse, RESPONSE_CRYPTO_HEADER } from './rsahelper';
import { getErrMsg } from '../msg/errmsg';
import { markServiceOnline, markServiceOffline, isBackendUnreachableError } from './serviceStatus';
import { renegotiateLocalServerRoot } from './backendIdentity';
import { waitForBackendBoot } from './backendBootGate';
// 失败分类 + 统一留痕:silent 与否都进环形缓冲(供诊断文本 / 壳侧账本消费),静默失败另打一行 warn。
import { classifyRequestFailure, isEngineLinkFailure, ENGINE_LINK_ERROR_KEY } from './requestFailure';
import { recordRequestFailure, stripUrlQuery } from './requestTelemetry';
import { getLocalStorageSafe, safeStorageSetOn } from './safeStorage';
// horosa_prefetch_runtime_whitelist_v1(R4-B1):预取作用域内的 URL 闸(纵深防御)。
// 非预取作用域恒放行 —— 用户真实请求逐字节零行为变化。
import { guardPrefetchUrl, isInPrefetchScope } from './stepPrefetch';
import { tagRequestPriority } from './requestPriority';   // 后台预取请求带优先级头

var tmDelta = 0;
// eslint-disable-next-line import/no-cycle
import { dedupeEligible, dedupedRequest } from './requestDedupe';

export function setTmDelta(val){
    tmDelta = val;
}

let dispatch = null;
let lastNeedLoginTs = 0;
let handlingNeedLogin = false;
let lastErrorToast = {
	text: '',
	ts: 0,
};

function safeGetLocalItem(key, defVal = null){
	const storage = getLocalStorageSafe();
	if(!storage){
		return defVal;
	}
	try{
		const val = storage.getItem(key);
		return val === undefined || val === null ? defVal : val;
	}catch(e){
		return defVal;
	}
}

function safeSetLocalItem(key, value){
	// 经存储单源:配额满先清可再生缓存再重试
	const storage = getLocalStorageSafe();
	if(!storage){
		return false;
	}
	return safeStorageSetOn(storage, key, value);
}

// 后端异常原文(Java 堆栈/连接异常/类名)绝不直接弹给用户:既看不懂,又暴露内部端口与技术栈。
// 判为技术异常 → 换成可行动的中文提示;业务型中文 message 原样透出(不改既有行为)。
const TECH_EXCEPTION_RE = /(^|\s)(org\.|java\.|javax\.|com\.sun\.)|Exception[:\s]|Throwable|StackTrace|\bat\s+[\w$.]+\(|Connect(ion)? (to|refused|timed out)|SocketTimeout|ECONNREFUSED/i;

const PROXY_HANDSHAKE_RE = /SOCKS|Unable to tunnel|\bproxy (server|returns|authentication|refused|error)|\bconnect(ion)? to (the )?proxy|Proxy-Authenticat/i;

export function humanizeBackendError(text){
	const raw = `${text || ''}`.trim();
	if(!raw || !TECH_EXCEPTION_RE.test(raw)){
		return raw;
	}
	// 代理握手类(SOCKS 回包不对 / 代理拒绝)→ 指向系统代理;连接类 → 明确指向本地服务;其余技术异常 → 通用可行动提示。
	// 都不回显原始堆栈。代理判据只认握手字样:类名里带 Proxy 的(动态代理 $Proxy、…ProxyService)不算,否则把用户引到错误方向
	if(PROXY_HANDSHAKE_RE.test(raw)){
		return '连接被系统代理拦截，请检查系统代理或加速器设置后重试。';
	}
	if(/Connect(ion)? (to|refused|timed out)|SocketTimeout|ECONNREFUSED|HttpHostConnect/i.test(raw)){
		return '本地计算服务未响应，请稍候重试；若持续如此，请重启应用让服务重新就绪。';
	}
	return '后端处理出错，请稍候重试；若持续如此，请重启应用。';
}

function safeErrorToast(text, cooldownMs){
	const msg = humanizeBackendError(text);
	if(!msg){
		return;
	}
	const now = Date.now();
	if(lastErrorToast.text === msg && now - lastErrorToast.ts < (cooldownMs || 1200)){
		return;
	}
	lastErrorToast = {
		text: msg,
		ts: now,
	};
	message.error(msg);
}

// 后端连不上本地排盘引擎:所有排盘都会空白,哪怕本次请求是 silent(不弹错的后台 / 面板请求)也要让用户看得见。
// 同一句话按长冷却去重,一波并发失败只弹一次。
const ENGINE_LINK_TOAST_COOLDOWN_MS = 15000;
export function surfaceEngineLinkFailure(){
	safeErrorToast(getErrMsg(ENGINE_LINK_ERROR_KEY), ENGINE_LINK_TOAST_COOLDOWN_MS);
}

function normalizeFetchCacheOption(opts){
	if(!opts || opts.cache === undefined || opts.cache === null){
		return;
	}
	if(typeof opts.cache === 'boolean'){
		opts.cache = opts.cache ? 'default' : 'no-store';
	}
}

function isNeedLoginLikeValue(val){
	if(val === undefined || val === null){
		return false;
	}
	const txt = `${val}`.toLowerCase();
	return txt.indexOf('need.login') >= 0 ||
		txt.indexOf('need login') >= 0 ||
		txt.indexOf('must.login') >= 0 ||  // 🆕 后端 /bazi/pattern/update 等接口返回 "must.login" raw code,加入识别 → 不再 toast 显示英文 raw 字符串。
		txt.indexOf('must login') >= 0 ||
		txt.indexOf('请重新登录') >= 0;
}

export function logout(){
	if(handlingNeedLogin){
		return;
	}
	handlingNeedLogin = true;
    if(dispatch){
        dispatch({
            type: 'app/logout',
            payload: {
				skipRemote: true,
			},
        });
    }
	setTimeout(()=>{
		handlingNeedLogin = false;
	}, 200);
}

export function innerHandleError(err) {
    try{
        if(err.preventDefault){
            err.preventDefault();
        }
        const needLoginByHeader = !!(err && err.headers && err.headers[Constants.NeedLoginKey]);
        const rawMsg = err ? err[Constants.ResultMessageKey] : null;
        const rawCode = err ? err[Constants.ResultCodeKey] : null;
        const needLoginByBody = isNeedLoginLikeValue(rawMsg) || isNeedLoginLikeValue(rawCode);
        if(needLoginByHeader || needLoginByBody){
            const hasToken = !!safeGetLocalItem(Constants.TokenKey, '');
            const now = new Date().getTime();
            // 🆕 未登录用户也给中文提示(原代码只对 hasToken=true 显示),否则点了「提交」毫无反馈,以为按钮坏了。
            if(now - lastNeedLoginTs > 8000){
                lastNeedLoginTs = now;
                safeErrorToast(hasToken ? '请重新登录' : '此操作需要登录后才能使用', 8000);
            }
            logout();
            return;
        }

        let errmsg = err[Constants.ResultMessageKey];
        let code = err[Constants.ResultCodeKey];
        if(errmsg && code === 999){
            code = errmsg;
        }
        if(code){
            errmsg = getErrMsg(code);
            if(errmsg === code){
                errmsg = null;
                console.log(code);
            }
        }else{
            console.log(err);
        }
        if(errmsg){
            safeErrorToast(errmsg);
        }else{
            errmsg = err[Constants.ResultMessageKey];
            errmsg = getErrMsg(errmsg);
            if(errmsg){
                safeErrorToast(errmsg);
            }else{
                console.log(err);
            }
        }
    }catch(e){
        console.log(e);
    }
}

export function setLoading(loading, text){
    if(dispatch){
        dispatch({
            type: 'save',
            payload: {
                loading: loading,
                loadingText: text,
            }
        });    
    }
}

export function setLoadingText(text){
    if(dispatch){
        dispatch({
            type: 'save',
            payload: {
                loadingText: text,
            }
        });    
    }
}

export function setDispatch(fun){
    dispatch = fun;
}


function sign(token, headers, body){
    let hd = '';
    if(headers){
        hd = `${headers.ClientChannel}${headers.ClientApp}${headers.ClientVer}`;
    }
    const txt = body ? body : '';
    const tk = token ? token : '';
    const data = `${tk}${Constants.SignatureKey}${hd}${txt}`;
    const md = forge.md.sha256.create();
    md.update(data, "utf8");
    const res = md.digest().toHex();
    return res;
}

export function signRequest(body){
    const usrtoken = safeGetLocalItem(Constants.TokenKey, '');
    const headers = {
        ClientChannel: Constants.ClientChannel,
        ClientApp: Constants.ClientApp,
        ClientVer: Constants.ClientVer,
    };
    return sign(usrtoken, headers, body);
}

// 后端写 Result 头一律经 URLEncoder(空格成 +,保留字符成 %XX;Java 侧 ResultHeader 单源):这里按同一口径还原。
// decodeURI 不还原 + 与 %3A 这类保留字符,原文里有裸 % 时还会抛 URIError(之后带 status 的错误对象就丢了)—— 解不开就原样回。
export function decodeResultHeader(raw){
    if(raw === null || raw === undefined){
        return raw;
    }
    const text = `${raw}`;
    try{
        return decodeURIComponent(text.replace(/\+/g, ' '));
    }catch(e){
        return text;
    }
}

export function getResponseHeaders(response){
    const respheaders = {};
    let headerErrCode = 0;
    let headerErrMsg = null;
    if (response.headers.get(Constants.ResultCodeKey)) {
        headerErrCode = parseInt(response.headers.get(Constants.ResultCodeKey), 10);
    }
    if (response.headers.get(Constants.ResultMessageKey)) {
        headerErrMsg = decodeResultHeader(response.headers.get(Constants.ResultMessageKey));
    }
    respheaders[Constants.ResultCodeKey] = headerErrCode;
    respheaders[Constants.ResultMessageKey] = headerErrMsg;

    if (response.headers.get('ImgTokenListName')) {
        respheaders['ImgTokenListName'] = response.headers.get('ImgTokenListName');
    }
    if (response.headers.get('SmsTokenListName')) {
        respheaders['SmsTokenListName'] = response.headers.get('SmsTokenListName');
    }
    const needlogin = response.headers.get(Constants.NeedLoginKey);
    if (needlogin) {
        respheaders[Constants.NeedLoginKey] = needlogin;
    }

    if (response.status < 200 || response.status >= 300) {
        if(headerErrMsg === null){
            headerErrMsg = response.statusText;
            respheaders[Constants.ResultMessageKey] = headerErrMsg;
        }
        let err = new Error(headerErrMsg);
        err[Constants.ResultCodeKey] = headerErrCode;
        err[Constants.ResultMessageKey] = headerErrMsg;
        err.headers = respheaders;
        err.status = response.status;
        throw err;    
    }

    return respheaders;
}

export function buildSignedFetchOptions(options) {
    let opts = {
        ...(options || {}),
    };
    if(opts.silent !== undefined){
        delete opts.silent;
    }
    if(opts.disableLoading !== undefined){
        delete opts.disableLoading;
    }
    if(opts.timeoutMs !== undefined){
        delete opts.timeoutMs;
    }
    if(opts.retry !== undefined){
        delete opts.retry;
    }
    normalizeFetchCacheOption(opts);
    let headers = opts.headers;
    if(headers === undefined || headers === null){
        headers = {};
    }
    if(opts.method === undefined){
        opts.method = 'POST'
    }

    const usrtoken = safeGetLocalItem(Constants.TokenKey, '');
    opts.headers = {
        ...headers,
        Token: usrtoken ? usrtoken : '',
        'Content-Type': 'application/json; charset=UTF-8',
        ClientChannel: Constants.ClientChannel,
        ClientApp: Constants.ClientApp,
        ClientVer: Constants.ClientVer,
    };
    opts.headers.Signature = sign(usrtoken, opts.headers, opts.body);
    // 声明响应加密能力(会话钥 GCM):不参与签名(签名只含 Channel/App/Ver + 正文),服务端不认识就照旧
    if(Constants.NeedEncrypt && typeof responseCryptoCapability === 'function'){
        let cap = null;
        try{ cap = responseCryptoCapability(); }catch(e){ cap = null; }
        if(cap){
            opts.headers[RESPONSE_CRYPTO_HEADER || 'X-Horosa-Crypto'] = cap;
        }
    }
    opts.body = encrypt(opts.body);
    return opts;
}

function encrypt(str){
    if(!Constants.NeedEncrypt || str === undefined || str === null || str === ''){
        return str;
    }
    let dt = new Date();
    let tmS = dt.getTime();
    let tm = tmS - tmDelta;
    return encryptRSA(str, tm);
}

// 响应解密单一出口:Encrypted: 2 = 会话钥 AES-GCM(WebCrypto 异步)/ 1 = 旧 RSA 信封 / 其它 = 明文
export async function decryptResponse(str, response){
    if(str === undefined || str === null || str === ''){
        return str;
    }
    let encrypted = response.headers.get('Encrypted');
    if(encrypted && encrypted === '2'){
        return decryptGcmResponse(str);
    }
    if(encrypted && encrypted === '1'){
        return decryptRSA(str);
    }
    return str;
}

function normalizeTimeoutMs(val){
	if(val === undefined || val === null || val === ''){
		return null;
	}
	const n = Number(val);
	if(!Number.isFinite(n) || n <= 0){
		return null;
	}
	return Math.max(500, Math.floor(n));
}

function isTimeoutLikeError(err){
	if(!err){
		return false;
	}
	if(err.name === 'TimeoutError'){
		return true;
	}
	const msg = `${err.message || ''}`.toLowerCase();
	if(msg.indexOf('request.timeout') >= 0){
		return true;
	}
	if(err.name === 'AbortError'){
		return true;
	}
	return false;
}

function buildTimeoutError(){
	const err = new Error('request.timeout');
	err[Constants.ResultCodeKey] = 999;
	err[Constants.ResultMessageKey] = 'request.timeout';
	err.headers = {};
	return err;
}

function fetchWithTimeout(url, opts, timeoutMs){
	const timeout = normalizeTimeoutMs(timeoutMs);
	if(!timeout){
		return fetch(url, opts);
	}
	const reqOpts = {
		...opts,
	};
	let controller = null;
	const externalSignal = reqOpts.signal;
	let onExternalAbort = null;
	if(typeof AbortController !== 'undefined'){
		controller = new AbortController();
		reqOpts.signal = controller.signal;
		if(externalSignal && externalSignal.aborted){
			// 调用前就已取消:abort 事件不会再来,直接把内部信号置为已取消(fetch 立即以 AbortError 拒绝,不发请求)
			controller.abort();
		}else if(externalSignal && typeof externalSignal.addEventListener === 'function'){
			onExternalAbort = ()=>{
				controller.abort();
			};
			externalSignal.addEventListener('abort', onExternalAbort, { once: true });
		}
	}
	// 请求结束就解绑外部信号上的监听:长寿 signal(整页共用的控制器)上不再挂着已结束请求的闭包
	const detachExternal = ()=>{
		if(onExternalAbort && externalSignal && typeof externalSignal.removeEventListener === 'function'){
			try{ externalSignal.removeEventListener('abort', onExternalAbort); }catch(e){ /* noop */ }
		}
		onExternalAbort = null;
	};
	return new Promise((resolve, reject)=>{
		let settled = false;
		let timer = null;
		const done = (handler, payload)=>{
			if(settled){
				return;
			}
			settled = true;
			if(timer){
				clearTimeout(timer);
			}
			detachExternal();
			handler(payload);
		};
		timer = setTimeout(()=>{
			if(controller){
				controller.abort();
			}
			const timeoutErr = new Error('request.timeout');
			timeoutErr.name = 'TimeoutError';
			done(reject, timeoutErr);
		}, timeout);
		fetch(url, reqOpts)
			.then((resp)=>done(resolve, resp))
			.catch((err)=>done(reject, err));
	});
}

// 修法5/6:request() 专用的 fetch 封装。
// · 拿到任何响应即 markServiceOnline()(清除重连横幅);
// · 仅当 opts.retry 提供时,对「后端不可达」(连接被拒/断网,见 isBackendUnreachableError)做有界退避重试
//   —— 仅用于幂等排盘(mundane 主调用 / 各引擎 request 兜底);默认 retries=0,对其余请求零行为变化;
// · 重试耗尽仍不可达 → markServiceOffline()(显示重连横幅)后抛出,交既有 catch/innerHandleError。
// 注:连接被拒表示请求未达后端,短退避(300/600ms)内复用同一已加密 body 仍在后端解密时限内,安全;
//     超时不在重试之列(可能已到达、避免对非幂等场景双发——本封装本就只在 opts.retry 时重试)。
async function fetchWithRetryConnRefused(url, opts, timeoutMs, retryCfg){
	const retries = retryCfg && retryCfg.retries != null ? retryCfg.retries : 0;
	const backoff = (retryCfg && retryCfg.backoff) || [300, 600];
	let lastErr = null;
	for(let attempt = 0; attempt <= retries; attempt += 1){
		try{
			const resp = await fetchWithTimeout(url, opts, timeoutMs);
			markServiceOnline();
			return resp;
		}catch(err){
			lastErr = err;
			if(isBackendUnreachableError(err) && attempt < retries){
				// eslint-disable-next-line no-await-in-loop
				await new Promise((r)=>setTimeout(r, backoff[Math.min(attempt, backoff.length - 1)]));
				continue;
			}
			if(isBackendUnreachableError(err)){
				markServiceOffline();
			}
			throw err;
		}
	}
	throw lastErr;
}

// 服务地址自愈 + 安全重放(2026-07-04 事故复盘)。触发条件:后端不可达 / 超时 / 「毒 200」
// (HTTP 200 但响应非本协议,典型=端口被其它进程占用)。再协商(身份握手)后【根确实换了】
// 才重放——根换了意味着原请求从未到达真后端,重放对真后端零副作用(含 login 等非幂等请求);
// 根没换(比如后端只是慢/真业务错)绝不重放,行为与旧版逐字节一致。__horosaHealed 防递归。
export async function healAndRetryOnce(url, options, err, replay){
	try{
		if(options && options.__horosaHealed){
			return null;
		}
		const suspect = !!(err && err.horosaIdentitySuspect)
			|| isBackendUnreachableError(err)
			|| isTimeoutLikeError(err);
		if(!suspect){
			return null;
		}
		const outcome = await renegotiateLocalServerRoot(
			err && err.horosaIdentitySuspect ? 'poisoned-response' : 'request-failure'
		);
		if(!outcome || !outcome.changed || !outcome.from || !outcome.to){
			return null;
		}
		const urlTxt = `${url}`;
		const fromRoot = `${outcome.from}`.replace(/\/$/, '');
		if(urlTxt.indexOf(fromRoot) !== 0){
			return null;
		}
		const retryUrl = `${outcome.to}`.replace(/\/$/, '') + urlTxt.slice(fromRoot.length);
		const value = await replay(retryUrl, { ...(options || {}), __horosaHealed: true });
		return { value };
	}catch(e2){
		return null;
	}
}

/**
 * Requests a URL, returning a promise.
 *
 * @param  {string} url       The URL we want to request
 * @param  {object} [options] The options we want to pass to "fetch"
 * @return {object}           An object containing either "data" or "err"
 */
export default async function request(url, options) {
    // horosa_prefetch_runtime_whitelist_v1:仅当【步进预取任务正在同步起调】时才判定;
    // 白名单外的端点直接拒发(返回 undefined —— 与本函数既有「网络失败吞错 resolve undefined」
    // 同一语义,调用方既有空载荷守卫原样接住)。预取关闸/非预取路径:此判定恒 true,零影响。
    if (!guardPrefetchUrl(url)) {
        return undefined;
    }
    // 后台预取(步进预取作用域 / 空闲预热作用域 / 显式 priority)必须在【任何 await 之前】按同步作用域判定并打头:
    // 去重层的 runner 要等 L3 读(await)之后才调 requestCore,放在那里判定会读到已退出的作用域 ——
    // 可去重端点(/chart 等,恰是预取的主战场)就永远不带头。去重键只含 url + body、不含请求头,
    // 前台同参请求照旧复用在途的预取往返。
    options = tagRequestPriority(options, isInPrefetchScope());
    // 计算类幂等端点:同参进行中共享一次往返 + 30s 会话缓存(白名单内;返回深拷贝;
    // perfFlag horosa.perf.requestDedupe 可关)。白名单外 100% 走原路径零差异。
    // 去重层把同参请求并成一程:网络请求用这一程的共享取消信号(全部参与方都取消才取消),不用发起方自己的 signal。
    if (dedupeEligible(url, options)) {
        return dedupedRequest(url, options, (sharedSignal) => requestCore(url, sharedSignal ? { ...options, signal: sharedSignal } : options));
    }
    return requestCore(url, options);
}

async function requestCore(url, options) {
    // 优先级头已在 request() 入口按同步作用域打好(见上),此处不再判定。
    // 桌面壳提前导航(URL 带 early=1)时,后端可能尚未监听:发 fetch 前按目标根探活排队。
    // 非 early 模式同步 no-op;L1/L2/L3 缓存命中在 dedupedRequest 层先返回,不经此门。
    await waitForBackendBoot(url);
    const silent = !!(options && (options.silent || options.disableLoading));
    if(dispatch && !silent){
        dispatch({
            type: 'save',
            payload: {
                loading: true,
            }
        });    
    }
    try{
        let opts = {
            ...options,
        };
        // silent / disableLoading 由 buildSignedFetchOptions 统一剥离;__horosaHealed 只在这里剥。
        if(opts.__horosaHealed !== undefined){
            delete opts.__horosaHealed;
        }
		let timeoutMs = null;
		if(opts.timeoutMs !== undefined){
			timeoutMs = opts.timeoutMs;
			delete opts.timeoutMs;
		}
		let retryCfg = null;
		if(opts.retry !== undefined){
			retryCfg = opts.retry;
			delete opts.retry;
		}
        opts = buildSignedFetchOptions(opts);
    
        const st = new Date().getTime();
        const response = await fetchWithRetryConnRefused(url, opts, timeoutMs, retryCfg);
        const endt = new Date().getTime();
        const delta = endt - st;
        if(delta > 1000){
            console.log(`response time in ${delta} ms for ${url}`);
        }
    
        let respheaders = null;
        try{
            respheaders = getResponseHeaders(response);
        }catch(e){
            respheaders = e.headers;
        }
    
        let data = {};
        try{
            let rsptxt = await response.text();
            rsptxt = await decryptResponse(rsptxt, response);
            let simpledt = response.headers.get('SimpleData');
            if(simpledt && simpledt === '1'){
                data = rsptxt;
            }else{
                data = JSON.parse(rsptxt);
            }
        }catch(e){
            let err = {
                headers: response.headers,
                status: response.status,
                url: response.url,
            }
            // 分类修正(2026-07-04 事故复盘):HTTP 200 但响应解不出本协议 ≠「服务不可达」——
            // 典型根因是端口被其它进程占用/服务地址陈旧。标记 horosaIdentitySuspect,
            // 由外层触发身份握手再协商;绝不再把 statusCode:200 报成「未就绪」。
            if(e && e.code === 'crypto.v2'){
                // 会话钥加密的响应解不开:rsahelper 已把本页降回旧信封(此后请求不再声明能力)。这不是端口 / 地址问题,
                // 不触发再协商;服务端已处理过这次请求,不自动重放(写类端点重放会重复提交),提示重试即可。
                err[Constants.ResultMessageKey] = '本地服务响应解密失败,已自动切换兼容模式,请重试。';
            }else if(response.status === 200){
                err[Constants.ResultMessageKey] = '本地服务响应异常(' + err.url + ' 返回了非本应用协议的内容,疑似端口被其它程序占用),已自动重新定位服务,请重试。';
                err.horosaIdentitySuspect = true;
            }else{
                err[Constants.ResultMessageKey] = '访问' + err.url + '错误。statusCode：' + err.status;
            }
            throw err;
        }

        let ret = null;
        if(isObject(data)){
            ret = {
                ...data,
                headers: respheaders,
            };
        }else{
            ret = data;
        }
    
        if(data[Constants.ResultKey]){
            if(ret[Constants.ResultCodeKey] && ret[Constants.ResultCodeKey] !== 0){
                const headerErrMsg = ret[Constants.ResultKey];
                let err = new Error(headerErrMsg);
                err[Constants.ResultCodeKey] = ret[Constants.ResultCodeKey];
                err[Constants.ResultMessageKey] = headerErrMsg;
                err.headers = respheaders;
                throw err;
            }
            return ret;
        }else{
            return data;
        }    
    }catch(e){
		// abort 短路(必须在 healAndRetryOnce 之前):主链新请求已 abort 旧请求——
		// 旧信道的失败既不触发身份再协商/地址自愈,也不 surface(离线横幅/错误弹窗),
		// 原样上抛由调用方按 AbortError 静默忽略。
		if(options && options.signal && options.signal.aborted){
			throw e;
		}
		// 服务地址自愈:根换成已验证的新地址后安全重放一次(详见 healAndRetryOnce 注释)。
		const healed = await healAndRetryOnce(url, options, e, requestCore);
		if(healed){
			return healed.value;
		}
		// 失败分类 + 统一留痕(silent 与否都记;不进 UI)。
		const failure = classifyRequestFailure(e);
		const failName = (e && e.name) || '';
		const failMessage = (e && (e.message || e[Constants.ResultMessageKey])) || '';
		recordRequestFailure({ url, kind: failure.kind, silent, name: failName, message: failMessage, status: failure.status, code: failure.code });
		if(isTimeoutLikeError(e)){
			if(!silent){
				innerHandleError(buildTimeoutError());
			}
		}else{
			// 修(HIGH-3):silent:true 时不可 surface 错误(原代码非超时分支无条件调 innerHandleError →
			// silent 守不住)。AI 挂载/导出的 silent 抓取曾让 miss.date 等后端校验错弹到顶栏红 badge。
			// 唯一例外:后端连不上本地排盘引擎(系统性故障,不提示 = 界面空白却不报错)。
			if(!silent){
				innerHandleError(e);
			}else if(isEngineLinkFailure(e)){
				surfaceEngineLinkFailure();
			}
		}
		// 静默失败另打一行 warn(不进 UI):吞错 resolve undefined 是本函数既有语义,但零日志
		// 让「起盘静默变缺失」类故障只能盲猜(AI 助手 cast_technique 压测实抓)。
		if(silent){
			console.warn('[request] silent failure', stripUrlQuery(url), failure.kind, failName, failMessage);
		}
    }finally{
        if(dispatch && !silent){
            dispatch({
                type: 'save',
                payload: {
                    loading: false,
                }
            });
            safeSetLocalItem('forceChange', '1');
        }
    }

}

export async function requestRaw(url, options) {
    const silent = !!(options && (options.silent || options.disableLoading));
    if(dispatch && !silent){
        dispatch({
            type: 'save',
            payload: {
                loading: true,
            }
        });    
    }
    try{
        let opts = {
            ...options,
        };
        // silent / disableLoading 由 buildSignedFetchOptions 统一剥离;__horosaHealed 只在这里剥。
        if(opts.__horosaHealed !== undefined){
            delete opts.__horosaHealed;
        }
		let timeoutMs = null;
		if(opts.timeoutMs !== undefined){
			timeoutMs = opts.timeoutMs;
			delete opts.timeoutMs;
		}
		let retryCfg = null;
		if(opts.retry !== undefined){
			retryCfg = opts.retry;
			delete opts.retry;
		}
        opts = buildSignedFetchOptions(opts);
    
        const st = new Date().getTime();
        const response = await fetchWithRetryConnRefused(url, opts, timeoutMs, retryCfg);
        const endt = new Date().getTime();
        const delta = endt - st;
        if(delta > 1000){
            console.log(`response time in ${delta} ms for ${url}`);
        }
    
        let respheaders = null;
        try{
            respheaders = getResponseHeaders(response);
        }catch(e){
            respheaders = e.headers;
        }
    
        let data = {};
        try{
            data = await response.blob();
            return data;
        }catch(e){
            let err = {
                headers: response.headers,
                status: response.status,
                url: response.url,
            }
            // 同 request:200 但取不出 body ≠ 不可达;标记交外层再协商,不误报「未就绪」。
            if(response.status === 200){
                err[Constants.ResultMessageKey] = '本地服务响应异常(' + err.url + ' 返回了非本应用协议的内容,疑似端口被其它程序占用),已自动重新定位服务,请重试。';
                err.horosaIdentitySuspect = true;
            }else{
                err[Constants.ResultMessageKey] = '访问' + err.url + '错误。statusCode：' + err.status;
            }
            throw err;
        }

    }catch(e){
		// abort 短路(与 requestCore 同构,在自愈之前)。
		if(options && options.signal && options.signal.aborted){
			throw e;
		}
		// 服务地址自愈:与 request 同构(根换了才安全重放一次)。
		const healed = await healAndRetryOnce(url, options, e, requestRaw);
		if(healed){
			return healed.value;
		}
		// 失败分类 + 统一留痕(与 request 同构)。
		const failure = classifyRequestFailure(e);
		const failName = (e && e.name) || '';
		const failMessage = (e && (e.message || e[Constants.ResultMessageKey])) || '';
		recordRequestFailure({ url, kind: failure.kind, silent, name: failName, message: failMessage, status: failure.status, code: failure.code });
		if(isTimeoutLikeError(e)){
			if(!silent){
				innerHandleError(buildTimeoutError());
			}
		}else{
			// 修(HIGH-3):silent:true 时不可 surface 错误(原代码非超时分支无条件调 innerHandleError →
			// silent 守不住)。AI 挂载/导出的 silent 抓取曾让 miss.date 等后端校验错弹到顶栏红 badge。
			// 唯一例外:后端连不上本地排盘引擎(系统性故障,不提示 = 界面空白却不报错)。
			if(!silent){
				innerHandleError(e);
			}else if(isEngineLinkFailure(e)){
				surfaceEngineLinkFailure();
			}
		}
		if(silent){
			console.warn('[request] silent failure', stripUrlQuery(url), failure.kind, failName, failMessage);
		}
    }finally{
        if(dispatch && !silent){
            dispatch({
                type: 'save',
                payload: {
                    loading: false,
                }
            });
            safeSetLocalItem('forceChange', '1');
        }
    }

}

export async function requestStream(url, options) {
    const silent = !!(options && (options.silent || options.disableLoading));
    const suppressAbortError = !!(options && options.suppressAbortError);
    if(dispatch && !silent){
        dispatch({
            type: 'save',
            payload: {
                loading: true,
            }
        });
    }
    try{
        let opts = {
            ...(options || {}),
        };
        let timeoutMs = null;
        if(opts.timeoutMs !== undefined){
            timeoutMs = opts.timeoutMs;
            delete opts.timeoutMs;
        }
        opts = buildSignedFetchOptions(opts);
        const response = await fetchWithTimeout(url, opts, timeoutMs);
        getResponseHeaders(response);
        return response;
    }catch(e){
        if(suppressAbortError && e && e.name === 'AbortError'){
            throw e;
        }
        // 流式请求失败同样留痕(kind 前缀 stream:);抛给调用方的语义不变。
        const failure = classifyRequestFailure(e);
        const failName = (e && e.name) || '';
        const failMessage = (e && (e.message || e[Constants.ResultMessageKey])) || '';
        recordRequestFailure({ url, kind: `stream:${failure.kind}`, silent, name: failName, message: failMessage, status: failure.status, code: failure.code });
        if(silent){
            console.warn('[request] silent failure', stripUrlQuery(url), `stream:${failure.kind}`, failName, failMessage);
        }
        // silent:true 一律不 surface(与 request / requestRaw 同口径;此前非超时分支无条件弹错)
        if(!silent){
            innerHandleError(isTimeoutLikeError(e) ? buildTimeoutError() : e);
        }
        throw e;
    }finally{
        if(dispatch && !silent){
            dispatch({
                type: 'save',
                payload: {
                    loading: false,
                }
            });
            safeSetLocalItem('forceChange', '1');
        }
    }
}
