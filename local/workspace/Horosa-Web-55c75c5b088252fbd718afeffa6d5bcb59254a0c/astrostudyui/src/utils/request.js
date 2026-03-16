import {fetch} from 'dva';
import * as forge from 'node-forge';
import { message } from 'antd';
import * as Constants from './constants';
import { getUserIP, isObject, } from './helper';
import { encryptRSA, decryptRSA, } from './rsahelper';
import { getErrMsg } from '../msg/errmsg';

var tmDelta = 0;
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

function safeErrorToast(text, cooldownMs){
	const msg = (text || '').trim();
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
            if(hasToken && now - lastNeedLoginTs > 8000){
                lastNeedLoginTs = now;
                safeErrorToast('请重新登录', 8000);
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

function isLocalRuntimeUrl(url){
	if(!url){
		return false;
	}
	const txt = `${url}`.toLowerCase();
	return txt.indexOf('http://127.0.0.1:') === 0 || txt.indexOf('http://localhost:') === 0;
}

const DIRECT_LOCAL_CALC_PREFIXES = [
	'/chart',
	'/chart13',
	'/predict/pd',
	'/predict/pdchart',
	'/predict/profection',
	'/predict/solararc',
	'/predict/solarreturn',
	'/predict/lunarreturn',
	'/predict/givenyear',
	'/predict/zr',
	'/jieqi/year',
	'/india/chart',
	'/location/acg',
	'/germany/midpoint',
];

function shouldUseDirectLocalCalc(url){
	if(!isLocalRuntimeUrl(url) || !Constants.ChartServerRoot || !isLocalRuntimeUrl(Constants.ChartServerRoot)){
		return false;
	}
	try{
		const target = new URL(url);
		const pathname = target.pathname || '/';
		return DIRECT_LOCAL_CALC_PREFIXES.some((prefix)=>{
			if(pathname === prefix){
				return true;
			}
			if(prefix.endsWith('/')){
				return pathname.indexOf(prefix) === 0;
			}
			return pathname === prefix;
		});
	}catch(e){
		return false;
	}
}

function rewriteToDirectLocalCalc(url){
	if(!shouldUseDirectLocalCalc(url)){
		return {
			url,
			direct: false,
		};
	}
	try{
		const target = new URL(url);
		const directRoot = new URL(Constants.ChartServerRoot);
		target.protocol = directRoot.protocol;
		target.hostname = directRoot.hostname;
		target.port = directRoot.port;
		if((target.pathname || '/') === '/chart'){
			target.pathname = '/';
		}
		return {
			url: target.toString(),
			direct: true,
		};
	}catch(e){
		return {
			url,
			direct: false,
		};
	}
}

function isRetryableLocalRequestError(err){
	if(!err){
		return false;
	}
	if(isTimeoutLikeError(err)){
		return true;
	}
	const msg = `${err.message || ''}`.toLowerCase();
	return (
		msg.indexOf('failed to fetch') >= 0 ||
		msg.indexOf('networkerror') >= 0 ||
		msg.indexOf('network request failed') >= 0 ||
		msg.indexOf('load failed') >= 0 ||
		msg.indexOf('fetch failed') >= 0 ||
		msg.indexOf('err_connection_refused') >= 0 ||
		msg.indexOf('connection refused') >= 0
	);
}

async function fetchWithLocalRetry(url, opts, timeoutMs){
	if(!isLocalRuntimeUrl(url)){
		return fetchWithTimeout(url, opts, timeoutMs);
	}
	const maxAttempts = 15;
	const retryDelays = [120, 180, 240, 320, 420, 560, 720, 900, 1100, 1300, 1600, 1900, 2200, 2500];
	let lastErr = null;
	for(let attempt = 0; attempt < maxAttempts; attempt += 1){
		try{
			return await fetchWithTimeout(url, opts, timeoutMs);
		}catch(err){
			lastErr = err;
			if(!isRetryableLocalRequestError(err) || attempt >= maxAttempts - 1){
				throw err;
			}
			const delay = retryDelays[Math.min(attempt, retryDelays.length - 1)];
			await new Promise((resolve)=>setTimeout(resolve, delay));
		}
	}
	throw lastErr || buildTimeoutError();
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
	if(typeof AbortController !== 'undefined'){
		controller = new AbortController();
		reqOpts.signal = controller.signal;
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

/**
 * Requests a URL, returning a promise.
 *
 * @param  {string} url       The URL we want to request
 * @param  {object} [options] The options we want to pass to "fetch"
 * @return {object}           An object containing either "data" or "err"
 */
export default async function request(url, options) {
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
		let timeoutMs = null;
		if(opts && opts.timeoutMs !== undefined){
			timeoutMs = opts.timeoutMs;
			delete opts.timeoutMs;
		}
        normalizeFetchCacheOption(opts);
        const directLocalCalc = rewriteToDirectLocalCalc(url);
        url = directLocalCalc.url;
        let headers = opts.headers;
        if(headers === undefined || headers === null){
            headers = {};
        }
        
        if(opts.method === undefined){
            opts.method = 'POST'
        }
    
        const usrtoken = safeGetLocalItem(Constants.TokenKey, '');
		if(directLocalCalc.direct){
			opts.headers = {
				...headers,
				'Content-Type': 'application/json; charset=UTF-8',
			};
		}else{
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
		}
    
        const st = new Date().getTime();
        const response = await fetchWithLocalRetry(url, opts, timeoutMs);
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
            err[Constants.ResultMessageKey] = '访问' + err.url + '错误。statusCode：' + err.status;
            throw err;
        }

        let ret = null;
        if(isObject(data)){
			if(
				directLocalCalc.direct &&
				data[Constants.ResultKey] === undefined &&
				data[Constants.ResultCodeKey] === undefined
			){
				ret = {
					[Constants.ResultCodeKey]: 0,
					[Constants.ResultKey]: data,
					headers: respheaders,
				};
			}else{
	            ret = {
	                ...data,
	                headers: respheaders,
	            };
			}
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
		if(isTimeoutLikeError(e)){
			if(!silent){
				innerHandleError(buildTimeoutError());
			}
		}else{
			innerHandleError(e);
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
		let timeoutMs = null;
		if(opts && opts.timeoutMs !== undefined){
			timeoutMs = opts.timeoutMs;
			delete opts.timeoutMs;
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
            Token: usrtoken, 
            'Content-Type': 'application/json; charset=UTF-8', 
            LocalIp: LocalIp,
            ClientChannel: Constants.ClientChannel,
            ClientApp: Constants.ClientApp,
            ClientVer: Constants.ClientVer,
        };
        opts.headers.Signature = sign(usrtoken, opts.headers, opts.body);
        opts.body = encrypt(opts.body);
    
        const st = new Date().getTime();
        const response = await fetchWithLocalRetry(url, opts, timeoutMs);
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
            err[Constants.ResultMessageKey] = '访问' + err.url + '错误。statusCode：' + err.status;
            throw err;
        }

    }catch(e){
		if(isTimeoutLikeError(e)){
			if(!silent){
				innerHandleError(buildTimeoutError());
			}
		}else{
			innerHandleError(e);
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
