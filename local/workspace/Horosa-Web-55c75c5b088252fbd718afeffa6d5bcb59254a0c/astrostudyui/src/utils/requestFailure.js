// 请求失败分类器:把 request / requestRaw / requestStream / chartFetch 各路 catch 里形状各异的
// 错误对象(Error / DOMException / 手工拼的 {headers,status,url} 对象)归一成
//   { kind, retryable, offline, status?, code? }
// 供失败留痕计数、诊断文本与调用方按类处置消费。纯函数、零副作用、绝不抛错。
// 判定次序即优先级:主动中断 → 超时 → 毒响应 → 带响应头(后端可达)按 HTTP 状态分层 → 网络层不可达 → 其它。
import * as Constants from './constants';

// kind 固定枚举(新增须同步测试向量):
//   aborted     调用方主动中断(AbortError)
//   timeout     请求超时(TimeoutError / 文案含 request.timeout;后端可能已收到,不可盲目重放)
//   poisoned    HTTP 200 但响应非本应用协议(典型=端口被其它进程占用;由 horosaIdentitySuspect 标记)
//   http5xx     后端可达但服务端错误(可重试)
//   http4xx     后端可达但请求被拒(不可重试)
//   business    后端可达、HTTP 正常但业务码非 0(need.login / miss.date …)
//   unreachable 网络层不可达(连接被拒 / 断网 / DNS:fetch 抛 TypeError 或 NetworkError)→ offline
//   dom         其它 DOMException(安全策略 / 无效状态等)
//   unknown     无法归类
export const REQUEST_FAILURE_KINDS = [
	'aborted', 'timeout', 'poisoned', 'http5xx', 'http4xx', 'business', 'unreachable', 'dom', 'unknown',
];

function messageOf(err){
	if(!err){
		return '';
	}
	const m = err.message || err[Constants.ResultMessageKey];
	return `${m || ''}`;
}

function statusOf(err){
	if(!err || err.status === undefined || err.status === null || err.status === ''){
		return undefined;
	}
	const n = Number(err.status);
	return Number.isFinite(n) ? n : undefined;
}

function meaningfulCode(val){
	return !(val === undefined || val === null || val === '' || val === 0 || val === '0');
}

function codeOf(err){
	if(!err){
		return undefined;
	}
	const direct = err[Constants.ResultCodeKey];
	if(meaningfulCode(direct)){
		return direct;
	}
	const hd = err.headers;
	if(hd && typeof hd === 'object' && meaningfulCode(hd[Constants.ResultCodeKey])){
		return hd[Constants.ResultCodeKey];
	}
	return undefined;
}

function build(kind, flags, status, code){
	const out = {
		kind,
		retryable: !!(flags && flags.retryable),
		offline: !!(flags && flags.offline),
	};
	if(status !== undefined){
		out.status = status;
	}
	if(code !== undefined){
		out.code = code;
	}
	return out;
}

const UNREACHABLE = { retryable: true, offline: true };

export function classifyRequestFailure(err){
	try{
		if(!err){
			return build('unknown');
		}
		const name = `${err.name || ''}`;
		const status = statusOf(err);
		const code = codeOf(err);
		if(name === 'AbortError'){
			return build('aborted', null, status, code);
		}
		if(name === 'TimeoutError' || messageOf(err).toLowerCase().indexOf('request.timeout') >= 0){
			return build('timeout', null, status, code);
		}
		if(err.horosaIdentitySuspect){
			return build('poisoned', null, status, code);
		}
		if(err.headers){
			if(status !== undefined && status >= 500){
				return build('http5xx', { retryable: true }, status, code);
			}
			if(status !== undefined && status >= 400){
				return build('http4xx', null, status, code);
			}
			return build('business', null, status, code);
		}
		if(err instanceof TypeError){
			return build('unreachable', UNREACHABLE, status, code);
		}
		if(typeof DOMException !== 'undefined' && err instanceof DOMException){
			if(name === 'NetworkError'){
				return build('unreachable', UNREACHABLE, status, code);
			}
			return build('dom', null, status, code);
		}
		return build('unknown', null, status, code);
	}catch(e){
		return build('unknown');
	}
}
