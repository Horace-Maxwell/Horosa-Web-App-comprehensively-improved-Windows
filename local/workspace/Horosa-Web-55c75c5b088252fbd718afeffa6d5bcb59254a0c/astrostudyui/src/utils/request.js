import {fetch} from 'dva';
import * as forge from 'node-forge';
import { message } from 'antd';
import * as Constants from './constants';
import { getUserIP, isObject, } from './helper';
import { encryptRSA, decryptRSA, } from './rsahelper';
import { getErrMsg } from '../msg/errmsg';
import { markServiceOnline, markServiceOffline, isBackendUnreachableError } from './serviceStatus';
import { renegotiateLocalServerRoot } from './backendIdentity';
import { waitForBackendBoot } from './backendBootGate';
// horosa_prefetch_runtime_whitelist_v1(R4-B1):预取作用域内的 URL 闸(纵深防御)。
// 非预取作用域恒放行 —— 用户真实请求逐字节零行为变化。
import { guardPrefetchUrl } from './stepPrefetch';

var tmDelta = 0;
// eslint-disable-next-line import/no-cycle
import { dedupeEligible, dedupedRequest } from './requestDedupe';

export function setTmDelta(val){
    tmDelta = val;
}

var LocalIp = null;
let dispatch = null;
let lastNeedLoginTs = 0;
let handlingNeedLogin = false;
let lastErrorToast = {
	text: '',
	ts: 0,
};

function getLocalStorageSafe(){
	try{
		if(typeof window !== 'undefined' && window.localStorage){
			return window.localStorage;
		}
		if(typeof localStorage !== 'undefined'){
			return localStorage;
		}
	}catch(e){
		return null;
	}
	return null;
}

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
	const storage = getLocalStorageSafe();
	if(!storage){
		return false;
	}
	try{
		storage.setItem(key, value);
		return true;
	}catch(e){
		return false;
	}
}

function safeRemoveLocalItem(key){
	const storage = getLocalStorageSafe();
	if(!storage){
		return false;
	}
	try{
		storage.removeItem(key);
		return true;
	}catch(e){
		return false;
	}
}

// 后端异常原文(Java 堆栈/连接异常/类名)绝不直接弹给用户:既看不懂,又暴露内部端口与技术栈。
// 判为技术异常 → 换成可行动的中文提示;业务型中文 message 原样透出(不改既有行为)。
const TECH_EXCEPTION_RE = /(^|\s)(org\.|java\.|javax\.|com\.sun\.)|Exception[:\s]|Throwable|StackTrace|\bat\s+[\w$.]+\(|Connect(ion)? (to|refused|timed out)|SocketTimeout|ECONNREFUSED/i;

function humanizeBackendError(text){
	const raw = `${text || ''}`.trim();
	if(!raw || !TECH_EXCEPTION_RE.test(raw)){
		return raw;
	}
	// 连接类 → 明确指向本地服务;其余技术异常 → 通用可行动提示。两者都不回显原始堆栈。
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

export function getResponseHeaders(response){
    const respheaders = {};
    let headerErrCode = 0;
    let headerErrMsg = null;
    if (response.headers.get(Constants.ResultCodeKey)) {
        headerErrCode = parseInt(response.headers.get(Constants.ResultCodeKey), 10);
    }
    if (response.headers.get(Constants.ResultMessageKey)) {
        headerErrMsg = decodeURI(response.headers.get(Constants.ResultMessageKey));
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
        throw err;    
    }

    return respheaders;
}

export function buildSignedFetchOptions(options) {
    if(LocalIp === null){
        getUserIP((ip)=>{
            LocalIp = ip;
        });
    }

    let opts = {
        ...(options || {}),
    };
    if(opts && opts.silent !== undefined){
        delete opts.silent;
    }
    if(opts && opts.disableLoading !== undefined){
        delete opts.disableLoading;
    }
    if(opts && opts.timeoutMs !== undefined){
        delete opts.timeoutMs;
    }
    if(opts && opts.retry !== undefined){
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
        LocalIp: LocalIp,
        ClientChannel: Constants.ClientChannel,
        ClientApp: Constants.ClientApp,
        ClientVer: Constants.ClientVer,
    };
    opts.headers.Signature = sign(usrtoken, opts.headers, opts.body);
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

function encryptNoTimestamp(str){
    if(!Constants.NeedEncrypt || str === undefined || str === null || str === ''){
        return str;
    }
    let dt = new Date();
    let tmS = dt.getTime();
    let tm = tmS - tmDelta + 3600000*24;
    return encryptRSA(str, tm);
}

function decrpyt(str, response){
    if(str === undefined || str === null || str === ''){
        return str;
    }
    let encrypted = response.headers.get('Encrypted');
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
	if(typeof AbortController !== 'undefined'){
		controller = new AbortController();
		reqOpts.signal = controller.signal;
		if(externalSignal && typeof externalSignal.addEventListener === 'function'){
			externalSignal.addEventListener('abort', ()=>{
				controller.abort();
			}, { once: true });
		}
	}
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
    // 计算类幂等端点:同参进行中共享一次往返 + 30s 会话缓存(白名单内;返回深拷贝;
    // perfFlag horosa.perf.requestDedupe 可关)。白名单外 100% 走原路径零差异。
    if (dedupeEligible(url, options)) {
        return dedupedRequest(url, options, () => requestCore(url, options));
    }
    return requestCore(url, options);
}

async function requestCore(url, options) {
    // [B1] 桌面壳提前导航(URL 带 early=1)时,后端可能尚未监听:发 fetch 前按目标根探活排队。
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
        if(LocalIp === null){
            getUserIP((ip)=>{
                LocalIp = ip;
            });
        }
    
        let opts = {
            ...options,
        };
        if(opts && opts.silent !== undefined){
            delete opts.silent;
        }
        if(opts && opts.disableLoading !== undefined){
            delete opts.disableLoading;
        }
        if(opts && opts.__horosaHealed !== undefined){
            delete opts.__horosaHealed;
        }
		let timeoutMs = null;
		if(opts && opts.timeoutMs !== undefined){
			timeoutMs = opts.timeoutMs;
			delete opts.timeoutMs;
		}
		let retryCfg = null;
		if(opts && opts.retry !== undefined){
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
            rsptxt = decrpyt(rsptxt, response);
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
            if(response.status === 200){
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
		// [R4-B5b] abort 短路(必须在 healAndRetryOnce 之前):主链新请求已 abort 旧请求——
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
		if(isTimeoutLikeError(e)){
			if(!silent){
				innerHandleError(buildTimeoutError());
			}
		}else{
			// 修(HIGH-3):silent:true 时不可 surface 错误(原代码非超时分支无条件调 innerHandleError →
			// silent 守不住)。AI 挂载/导出的 silent 抓取曾让 miss.date 等后端校验错弹到顶栏红 badge。
			if(!silent){
				innerHandleError(e);
			}
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
        if(LocalIp === null){
            getUserIP((ip)=>{
                LocalIp = ip;
            });
        }
    
        let opts = {
            ...options,
        };
        if(opts && opts.silent !== undefined){
            delete opts.silent;
        }
        if(opts && opts.disableLoading !== undefined){
            delete opts.disableLoading;
        }
        if(opts && opts.__horosaHealed !== undefined){
            delete opts.__horosaHealed;
        }
		let timeoutMs = null;
		if(opts && opts.timeoutMs !== undefined){
			timeoutMs = opts.timeoutMs;
			delete opts.timeoutMs;
		}
		let retryCfg = null;
		if(opts && opts.retry !== undefined){
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
		// [R4-B5b] abort 短路(与 requestCore 同构,在自愈之前)。
		if(options && options.signal && options.signal.aborted){
			throw e;
		}
		// 服务地址自愈:与 request 同构(根换了才安全重放一次)。
		const healed = await healAndRetryOnce(url, options, e, requestRaw);
		if(healed){
			return healed.value;
		}
		if(isTimeoutLikeError(e)){
			if(!silent){
				innerHandleError(buildTimeoutError());
			}
		}else{
			// 修(HIGH-3):silent:true 时不可 surface 错误(原代码非超时分支无条件调 innerHandleError →
			// silent 守不住)。AI 挂载/导出的 silent 抓取曾让 miss.date 等后端校验错弹到顶栏红 badge。
			if(!silent){
				innerHandleError(e);
			}
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
        if(opts && opts.timeoutMs !== undefined){
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
        if(isTimeoutLikeError(e)){
            if(!silent){
                innerHandleError(buildTimeoutError());
            }
        }else{
            innerHandleError(e);
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

export async function uploadFile(obj, onUploadComplete){
    if(obj.file === undefined || obj.file === null){
        return;
    }

    const formData = new FormData();
    formData.append(obj.filename, obj.file);

    const response = await fetch(obj.action, {
        method: 'POST',
        headers: obj.headers,
        body: formData,
    });

    const respheaders = getResponseHeaders(response);
    let rsptxt = await response.text();
    rsptxt = decrpyt(rsptxt, response);
    let data = null;
    let ret = null;
    let simpledt = response.headers.get('SimpleData');
    if(simpledt && simpledt === '1'){
        ret = rsptxt;
    }else{
        data = JSON.parse(rsptxt);
        ret = {
            ...data,
            headers: respheaders,
        };
    }

    if(onUploadComplete){
        onUploadComplete(ret);
    }

}

export function downloadUrl(url, options, ignoreTM){
    try{
        if(LocalIp === null){
            getUserIP((ip)=>{
                LocalIp = ip;
            });
        }
    
        let opts = {
            ...options,
        };
 
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
            Token: usrtoken, 
            'Content-Type': 'application/json; charset=UTF-8', 
            LocalIp: LocalIp,
            ClientChannel: Constants.ClientChannel,
            ClientApp: Constants.ClientApp,
            ClientVer: Constants.ClientVer,
        };
        opts.headers.Signature = sign(usrtoken, opts.headers, opts.body);
        if(ignoreTM){
            opts.body = encryptNoTimestamp(opts.body);
        }else{
            opts.body = encrypt(opts.body);
        }
    
        let hd = JSON.stringify(opts.headers);
        if(ignoreTM){
            hd = encryptNoTimestamp(hd);
        }else{
            hd = encrypt(hd);
        }
        hd = encodeURIComponent(hd);
        let body = encodeURIComponent(opts.body);
        let resurl = `${url}?__clientapp__=${Constants.ClientApp}&__header__=${hd}&__body__=${body}`;
        return resurl;
    
    }catch(e){
        innerHandleError(e);
    }finally{
    }

}

export function encodeUrl(url, params, notimestamp){
    try{
        if(LocalIp === null){
            getUserIP((ip)=>{
                LocalIp = ip;
            });
        }
    
        const usrtoken = safeGetLocalItem(Constants.TokenKey, '');
        let opts = {
            headers: {
                Token: usrtoken, 
                'Content-Type': 'application/json; charset=UTF-8', 
                LocalIp: LocalIp,
                ClientChannel: Constants.ClientChannel,
                ClientApp: Constants.ClientApp,
                ClientVer: Constants.ClientVer,    
            },
            body: JSON.stringify(params),
        };
     
        opts.headers.Signature = sign(usrtoken, opts.headers, opts.body);
    
        let txt = JSON.stringify(opts);
        let coded = null;
        if(notimestamp){
            coded = encryptNoTimestamp(txt);
        }else{
            coded = encrypt(txt);
        }
        coded = encodeURIComponent(coded);
        let resurl = `${url}?_code_=${coded}`;
        return resurl;
    
    }catch(e){
        throw e;
    }finally{
    }

}
