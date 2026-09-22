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
import { DEFAULT_STREAM_STALL_MS, DEFAULT_STREAM_MAX_MS } from '../utils/aiStreamLimits';
import { normalizeUsage } from '../utils/aiChat/status';

function safeParseJson(text, defVal = null){
	try{
		return text ? JSON.parse(text) : defVal;
	}catch(e){
		return defVal;
	}
}

// [Q-411/M-157] 请求超时单源钳位:用户填的 providerOptions.requestTimeoutMs 钳到 [1s, 10min],前端等待
//   与下发给后端的数**同一个**(此前前端 <1000 改用 120000、>600000 封顶,而 Java 原值直用 → 填 500 时 Java 0.5 秒超时、
//   前端等 120 秒;填 900000 时两层各一套)。留空仍各走缺省(前端 120s / ollama 180s;后端非流式 60s、流式不封顶)。
export const REQUEST_TIMEOUT_MIN_MS = 1000;
export const REQUEST_TIMEOUT_MAX_MS = 600000;
export function clampRequestTimeoutMs(raw){
	if(raw === undefined || raw === null || `${raw}`.trim() === ''){ return null; }
	const n = Number(raw);
	if(!Number.isFinite(n) || n <= 0){ return null; }
	return Math.min(Math.max(Math.round(n), REQUEST_TIMEOUT_MIN_MS), REQUEST_TIMEOUT_MAX_MS);
}
// 出站前把 values.providerOptions.requestTimeoutMs 改写成钳位后的数(无值/非法值则剥掉),后端与前端同数。
export function withClampedRequestTimeout(values){
	if(!values || !values.providerOptions || typeof values.providerOptions !== 'object'){ return values; }
	if(!Object.prototype.hasOwnProperty.call(values.providerOptions, 'requestTimeoutMs')){ return values; }
	const raw = values.providerOptions.requestTimeoutMs;
	const clamped = clampRequestTimeoutMs(raw);
	if(clamped === null){
		const { requestTimeoutMs, ...rest } = values.providerOptions;
		return { ...values, providerOptions: rest };
	}
	if(clamped === raw){ return values; }
	return { ...values, providerOptions: { ...values.providerOptions, requestTimeoutMs: clamped } };
}
// 尊重用户在 providerOptions.requestTimeoutMs 配置的超时(钳到 1s~10min),否则回退 120s。
function resolveRequestTimeout(values){
	const clamped = clampRequestTimeoutMs(values && values.providerOptions ? values.providerOptions.requestTimeoutMs : null);
	if(clamped !== null){
		return clamped;
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

async function requestJson(url, rawValues, options = {}){
	const values = withClampedRequestTimeout(rawValues);   // [Q-411/M-157] 后端拿到的超时数与前端等待同源
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

// [Q1] options.signal:非流式短调用(判官/编排规划与综合/联网检索)同样能被用户的「停止」中止——
// requestJson 的 withTimeout(…, options.signal) 才是真正的中止入口,只传 timeoutMs 则前面「传了 signal」也中止不了任何请求
export function requestAIAnalysisChat(values, options){
	const signal = options && options.signal ? options.signal : undefined;
	return requestJson(`${ServerRoot}/aianalysis/chat`, values, {
		timeoutMs: resolveRequestTimeout(values),
		signal,
	});
}

// [P7 出站②] 联网检索:引擎与 Key 逐次带上(后端不落库不写日志);默认关,开关未开时页面根本不调
export function requestWebSearch(values, options){
	const signal = options && options.signal ? options.signal : undefined;
	return requestJson(`${ServerRoot}/aianalysis/websearch`, values, { timeoutMs: 25000, signal });
}

// [批三① 出站③] 网页读取:同联网检索一样只经 Java 端点(前端零直连;守卫/有界/转文本都在后端);30s + signal
export function requestWebFetch(values, options){
	const signal = options && options.signal ? options.signal : undefined;
	return requestJson(`${ServerRoot}/aianalysis/webfetch`, values, { timeoutMs: 30000, signal });
}

export async function requestAIAnalysisChatStream(rawValues, handlers = {}){
	const values = withClampedRequestTimeout(rawValues);   // [Q-411/M-157]
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
	// [#77 根修] 三层超时语义(Windows 仓 issue「GLM/qwen 回答卡在一半提示超时/思考过久提示重试」):
	//   连接+首响应头 = withTimeout(requestTimeoutMs,默认 120s;流体阶段 timer 已清不受管)
	//   空闲看门狗 STALL = 距上个真产出 token(delta/reasoning)的上限——默认 90s→180s(深思模型
	//     经部分中转网关思考期不流式转发,90s 真空即误杀;心跳仍不续命,fail-fast 语义不变)
	//   总时长 MAX = 不可续命绝对上限——默认 300s→1800s(旧值把「健康产出中的长思考+长文」一并
	//     掐死=issue「卡在一半」主因;定位回「防 token 龟速永不收尾」的兜底,STALL 已盖无产出情形)
	// 优先级:handlers 显式(报告管线) > providerOptions.streamStallMs/streamMaxStreamMs(用户
	// 高级参数,毫秒) > 默认。两键仅前端消费,后端剥离绝不下发上游。
	const po = (values && values.providerOptions) || {};
	const pickMs = (explicit, optVal, defVal)=>{
		if(Number(explicit) > 0){ return Number(explicit); }
		const v = Number(optVal);
		if(Number.isFinite(v) && v >= 1000){ return Math.min(v, 7200000); }
		return defVal;
	};
	const STALL_MS = pickMs(handlers.stallMs, po.streamStallMs, DEFAULT_STREAM_STALL_MS);   // [D42] 缺省单源 aiStreamLimits(手册文案同源插值)
	const MAX_STREAM_MS = pickMs(handlers.maxStreamMs, po.streamMaxStreamMs, DEFAULT_STREAM_MAX_MS);
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
		// 工具调用帧(tool_call_start/tool_call)同样是真产出:模型先出长参数再出正文时不得被空闲看门狗误杀。
		if(event && (event.type === 'delta' || event.type === 'reasoning' || event.type === 'tool_call' || event.type === 'tool_call_start' || event.type === 'tool_call_delta')){ armWatchdog(); }
		// [I1] usage 事件的唯一入口:各家缓存计量别名在这里折成 cache_read_input_tokens 一次,
		// 下游(protocol.mergeUsage / 状态栏 deriveUsage / 目标任务 / A/B 分析器)一律吃归一后的值,不各自认别名。
		if(event && event.type === 'usage'){ event.json = normalizeUsage(event.json); }
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
			throw new Error(`AI 响应连续 ${Math.round(STALL_MS / 1000)} 秒无新内容(疑似上游卡住或网关思考期不流式转发),已停止等待。深思模型可在提供商高级参数「流式空闲上限」调大;可点「重新生成」重试。`);
		}
		if(hardTimedOut){
			throw new Error(`AI 单次生成超过总时长上限 ${Math.round(MAX_STREAM_MS / 60000)} 分钟,已停止等待。超长任务可在提供商高级参数「流式总时长上限」调大;可点「重新生成」重试。`);
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
