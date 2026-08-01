import {
	ClientApp,
	ClientChannel,
	ClientVer,
	ServerRoot,
	TokenKey,
} from '../utils/constants';
import { signRequest } from '../utils/request';
import { encryptRSA } from '../utils/rsahelper';
import { NeedEncrypt } from '../utils/constants';
import { aiBodyEncryptEnabled } from '../utils/perfFlags';

function safeParseJson(text, defVal = null){
	try{
		return text ? JSON.parse(text) : defVal;
	}catch(e){
		return defVal;
	}
}

// 尊重用户在 providerOptions.requestTimeoutMs 配置的超时(1s~10min),否则回退 120s。
function resolveRequestTimeout(values){
	const raw = values && values.providerOptions ? Number(values.providerOptions.requestTimeoutMs) : NaN;
	if(Number.isFinite(raw) && raw >= 1000){
		return Math.min(raw, 600000);
	}
	// v1.16-BB6: Ollama 本地首次模型加载慢(20s+),默认 timeout 给 180s 避免假阴性诊断
	const pt = values && values.providerType;
	if(pt === 'ollama') return 180000;
	return 120000;
}

function unwrapServicePayload(payload){
	if(!payload || typeof payload !== 'object'){
		return payload;
	}
	if(payload.Result && typeof payload.Result === 'object' && !Array.isArray(payload.Result) && Object.prototype.hasOwnProperty.call(payload.Result, 'Result')){
		return {
			...payload,
			Result: payload.Result.Result,
		};
	}
	return payload;
}

function createSseParser(onEvent){
	let buffer = '';
	let eventName = 'message';
	let dataLines = [];

	function normalizeLine(rawLine){
		const line = `${rawLine || ''}`;
		if(!line){
			return line;
		}
		const eventIdx = line.indexOf('event:');
		const dataIdx = line.indexOf('data:');
		let idx = -1;
		if(eventIdx >= 0 && dataIdx >= 0){
			idx = Math.min(eventIdx, dataIdx);
		}else if(eventIdx >= 0){
			idx = eventIdx;
		}else if(dataIdx >= 0){
			idx = dataIdx;
		}
		return idx > 0 ? line.slice(idx) : line;
	}

	function flushEvent(){
		if(dataLines.length === 0){
			eventName = 'message';
			return;
		}
		const data = dataLines.join('\n');
		onEvent({
			type: eventName || 'message',
			data,
			json: safeParseJson(data, null),
		});
		eventName = 'message';
		dataLines = [];
	}

	return {
		push(chunk){
			buffer += chunk || '';
			let idx = buffer.indexOf('\n');
			while(idx >= 0){
				const rawLine = buffer.slice(0, idx);
				buffer = buffer.slice(idx + 1);
				const line = normalizeLine(rawLine.replace(/\r$/, ''));
				if(!line){
					flushEvent();
				}else if(line.indexOf('event:') === 0){
					eventName = line.slice(6).trim() || 'message';
				}else if(line.indexOf('data:') === 0){
					dataLines.push(line.slice(5).trim());
				}
				idx = buffer.indexOf('\n');
			}
		},
		end(){
			if(buffer){
				this.push('\n');
			}
			flushEvent();
		},
	};
}

function getTokenSafe(){
	try{
		if(typeof window !== 'undefined' && window.localStorage){
			return window.localStorage.getItem(TokenKey) || '';
		}
	}catch(e){
	}
	return '';
}

// [G2] 请求体 RSA 会话束封套(与排盘 API 同机制):AES 密文 + 会话钥 RSA 块。
// Signature 仍按明文计算(后端解封后核签,校验链不变);SSE/JSON 响应不加密。
// NeedEncrypt=false 或回退阀关 → 明文(后端明文直通宽容,双向兼容)。
function encryptAIAnalysisBody(bodyText){
	if(!NeedEncrypt || !bodyText || !aiBodyEncryptEnabled()){ return bodyText; }
	try{
		return encryptRSA(bodyText);
	}catch(_){
		return bodyText;   // 加密失败宁走明文,不断 AI 功能
	}
}

function buildAIAnalysisHeaders(bodyText = '', extraHeaders = {}){
	return {
		'Content-Type': 'application/json; charset=UTF-8',
		Token: getTokenSafe(),
		ClientChannel,
		ClientApp,
		ClientVer,
		Signature: signRequest(bodyText || ''),
		...extraHeaders,
	};
}

function withTimeout(promiseFactory, timeoutMs, externalSignal){
	const timeout = Number(timeoutMs) > 0 ? Math.floor(Number(timeoutMs)) : 0;
	if(!timeout && !externalSignal){
		return promiseFactory(null);
	}
	const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
	const cleanup = [];
	if(controller && externalSignal && typeof externalSignal.addEventListener === 'function'){
		if(externalSignal.aborted){
			// 调用方已取消（如用户刚点停止）→ 立刻熄火，别再发请求。addEventListener 对已 abort 的 signal 不会再触发。
			controller.abort();
		}else{
			const abortListener = ()=>controller.abort();
			externalSignal.addEventListener('abort', abortListener, { once: true });
			cleanup.push(()=>externalSignal.removeEventListener('abort', abortListener));
		}
	}
	let timer = null;
	if(controller && timeout){
		timer = setTimeout(()=>{
			controller.abort();
		}, timeout);
	}
	return promiseFactory(controller ? controller.signal : externalSignal).finally(()=>{
		if(timer){
			clearTimeout(timer);
		}
		cleanup.forEach((fn)=>fn());
	});
}

async function requestJson(url, values, options = {}){
	return withTimeout(async (signal)=>{
		const bodyText = JSON.stringify(values || {});
		const response = await fetch(url, {
			method: 'POST',
			cache: 'no-store',
			headers: buildAIAnalysisHeaders(bodyText, options.headers),
			body: encryptAIAnalysisBody(bodyText),
			signal,
		});
		const text = await response.text();
		const payload = safeParseJson(text, null);
		if(!response.ok){
			const errorText = payload && (payload.ResultMessage || payload.Result || payload.message)
				? (payload.ResultMessage || payload.Result || payload.message)
				: `${response.status} ${response.statusText || ''}`.trim();
			throw new Error(errorText || 'request.failed');
		}
		if(payload === null){
			throw new Error('service.response.invalid');
		}
		return unwrapServicePayload(payload);
	}, options.timeoutMs, options.signal);
}

export function fetchProviderModels(values){
	return requestJson(`${ServerRoot}/aianalysis/providers/models`, values, {
		timeoutMs: resolveRequestTimeout(values),
	});
}

export function diagnoseProvider(values){
	return requestJson(`${ServerRoot}/aianalysis/providers/diagnose`, values, {
		timeoutMs: resolveRequestTimeout(values),
	});
}

export function extractMaterialContent(values){
	return requestJson(`${ServerRoot}/aianalysis/materials/extract`, values, {
		timeoutMs: resolveRequestTimeout(values),
	});
}

export function requestEmbeddingVectors(values){
	return requestJson(`${ServerRoot}/aianalysis/embeddings`, values, {
		timeoutMs: resolveRequestTimeout(values),
	});
}

export function requestAIAnalysisChat(values){
	return requestJson(`${ServerRoot}/aianalysis/chat`, values, {
		timeoutMs: resolveRequestTimeout(values),
	});
}

export async function requestAIAnalysisChatStream(values, handlers = {}){
	const response = await withTimeout(async (signal)=>{
		const bodyText = JSON.stringify(values || {});
		const rsp = await fetch(`${ServerRoot}/aianalysis/chat/stream`, {
			method: 'POST',
			cache: 'no-store',
			headers: buildAIAnalysisHeaders(bodyText),
			body: encryptAIAnalysisBody(bodyText),
			signal,
		});
		if(!rsp.ok){
			const text = await rsp.text();
			const payload = safeParseJson(text, null);
			const errorText = payload && (payload.ResultMessage || payload.Result || payload.message)
				? (payload.ResultMessage || payload.Result || payload.message)
				: `${rsp.status} ${rsp.statusText || ''}`.trim();
			throw new Error(errorText || 'chat.stream.failed');
		}
		return rsp;
	}, handlers.timeoutMs || resolveRequestTimeout(values), handlers.signal);
	const reader = response.body && response.body.getReader ? response.body.getReader() : null;
	if(!reader){
		throw new Error('chat.stream.not.supported');
	}
	const decoder = new TextDecoder('utf-8');
	// 🔴 停止生成必须在「流式读取阶段」也立即生效(用户报"停止按钮不好使")。
	// 根因:withTimeout 在 fetch resolve(拿到响应头)后即移除了对 externalSignal 的监听,而流式读取发生在其后,
	// 且本读循环原先完全不检查 signal → 点「停止」时当前节仍把整段流吐完才停。
	// 修:直接监听 handlers.signal,abort 时 reader.cancel() 立刻中断 body 流;循环内双重检查 aborted。
	const sig = handlers.signal;
	let aborted = false;
	const abortStream = ()=>{ aborted = true; try{ reader.cancel(); }catch(_){} };
	if(sig){
		if(sig.aborted){ abortStream(); }
		else if(typeof sig.addEventListener === 'function'){ sig.addEventListener('abort', abortStream, { once: true }); }
	}
	const detachAbort = ()=>{ if(sig && typeof sig.removeEventListener === 'function'){ try{ sig.removeEventListener('abort', abortStream); }catch(_){} } };
	// 流「空闲看门狗」+「硬上限」(治用户报「换语言/有时卡很久不生成」):
	//   ⚠️ 此前看门狗在「每个 reader.read() 字节」都重置 → 后端 15s 心跳/keep-alive(无 token)会无限续命,
	//      推理模型「只思考不出 token」时该节永远转圈、且 concurrency=1 下卡死整份报告。
	//   修①:看门狗只在「真有内容 token(delta 事件)」时重置 —— 心跳不再续命,故「只心跳不出 token」超过 STALL_MS 即 fail-fast。
	//   修②:另设不可重置的 MAX_STREAM_MS 绝对上限,兜「token 龟速但永不收尾」。两者皆 → 抛错 → 上层标 failed → 队列推进,绝不永久挂起。
	const STALL_MS = Number(handlers.stallMs) > 0 ? Number(handlers.stallMs) : 90000;
	const MAX_STREAM_MS = Number(handlers.maxStreamMs) > 0 ? Number(handlers.maxStreamMs) : 300000;
	let stalled = false;
	let hardTimedOut = false;
	let watchdog = null;
	const armWatchdog = ()=>{
		if(watchdog){ clearTimeout(watchdog); }
		watchdog = setTimeout(()=>{ stalled = true; try{ reader.cancel(); }catch(_){} }, STALL_MS);
	};
	const clearWatchdog = ()=>{ if(watchdog){ clearTimeout(watchdog); watchdog = null; } };
	const hardTimer = setTimeout(()=>{ hardTimedOut = true; try{ reader.cancel(); }catch(_){} }, MAX_STREAM_MS);
	const clearHard = ()=>{ try{ clearTimeout(hardTimer); }catch(_){} };
	const parser = createSseParser((event)=>{
		// 内容 token(delta)与思维链 token(reasoning)都算「真有产出」→ 续命空闲看门狗(心跳/usage 不算)。
		// ⚠️ reasoning 必须续命:推理模型(o系/R1/deepseek-r1)可先纯思考 >90s 再出正文,
		//    若只认 delta,长思考期看门狗会在 STALL_MS 误杀流(报「长时间无新内容」),正是思考档要支持的场景。
		if(event && (event.type === 'delta' || event.type === 'reasoning')){ armWatchdog(); }
		if(handlers.onEvent){
			handlers.onEvent(event);
		}
	});
	try{
		armWatchdog();
		while(true){
			if(aborted || (sig && sig.aborted)){ break; }
			const chunk = await reader.read();
			if(chunk.done){
				break;
			}
			if(aborted || (sig && sig.aborted)){ break; }
			parser.push(decoder.decode(chunk.value, { stream: true })); // 不再每字节续命;改由上面 delta 事件续命
		}
		clearWatchdog();
		clearHard();
		detachAbort();
		if(aborted || (sig && sig.aborted)){
			// 用户主动停止 → 不当作正常完成,抛 AbortError 让上层按「已取消」处理(不重试、不标成功)。
			const err = new Error('已停止生成'); err.name = 'AbortError'; throw err;
		}
		if(stalled){
			throw new Error('AI 响应长时间无新内容(疑似上游卡住或只发心跳),已停止等待。可点「重新生成」重试。');
		}
		if(hardTimedOut){
			throw new Error('AI 单次生成超时(可能上游卡住),已停止等待。可点「重新生成」重试。');
		}
		parser.end();
		if(handlers.onDone){
			handlers.onDone();
		}
	}catch(e){
		// 🔴 hardTimer 必须在异常路径也清:曾只在成功路径 clearHard(),失败/用户点停止
		// 各泄漏一个最长 5 分钟的定时器(闭包持 reader);报告逐节失败会线性堆积。
		clearWatchdog();
		clearHard();
		detachAbort();
		try{ parser.end(); }catch(_){ /* flush buffered SSE (e.g. a final error event) before propagating */ }
		if(handlers.onError){
			handlers.onError(e);
		}
		throw e;
	}
}

// [B-A7] 测试钩:SSE 解析器纯函数(不触网)。
export const __testing__ = { createSseParser };
