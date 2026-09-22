// [I12] AI 助手压测二轮·jest 共用夹具(只被 __tests__ 引用,不进产品包)。
// 三件:
//   ① fakeStreamScript(script) —— 假流式上游。形态与 aiAgentGoalRunner.test.js 的 fakeStream /
//      aiAgentRuntime.test.js 的 mkStream 同构(jest.fn(async (values, handlers)=>{…}),按调用次序取脚本,
//      末条重复用于超出次数的调用),但把「一次调用里发生了什么」拆成可组合的步骤:
//      text / reasoning / usage / toolCall / http429 / http500 / error / stall / hang / abortOn / run。
//   ② quotaStorage(keys) —— 让 Storage.prototype.setItem 对指定键抛 QuotaExceededError(账本/偏好写失败面),
//      返回恢复函数(函数上挂 .hits 记录被拦下的键)。
//   ③ twoTabs() —— 两个「窗口」:同一个 fake-indexeddb 实例上用 jest.isolateModules 各载一份
//      scheduler/taskStore/noticeStore/aiAnalysisStore 模块(模块级 ticking / taskCache 各自一份 = 真双窗口形态),
//      返回 { a, b, restore }。
//
// 纪律:夹具只造「上游/存储/窗口」的外部条件,绝不替产品源码兜底;判据一律写在用例里。
/* eslint-disable no-await-in-loop */

const FIDB = require('fake-indexeddb');

export const delay = (ms)=>new Promise((r)=>setTimeout(r, ms || 0));

// ── ① 假流 ─────────────────────────────────────────────────────────────────────
function stepsOf(entry){
	if(Array.isArray(entry)){ return entry; }
	if(entry && typeof entry === 'object' && Array.isArray(entry.steps)){ return entry.steps; }
	return [entry || {}];
}

function httpError(status, step){
	const spec = step && typeof step === 'object' ? step : {};
	const message = `${spec.message || (status === 429 ? 'HTTP 429 Too Many Requests(上游限流)' : `HTTP ${status} 上游服务错误`)}`;
	const err = new Error(message);
	err.status = status;
	return { message, err, shouldThrow: spec.throw === true };
}

// script:数组,每个元素 = 一次流调用的步骤(数组 / {steps:[…]} / 单个步骤对象);超出长度时重复最后一条。
// 每次调用末尾自动补一个 done 事件(除非该次调用抛错,或步骤里已显式给了 done)。
export function fakeStreamScript(script){
	const list = Array.isArray(script) ? script : [script];
	const requests = [];
	const fn = jest.fn(async (values, handlers)=>{
		const idx = requests.length;
		requests.push(values);
		const steps = stepsOf(list[Math.min(idx, list.length - 1)]);
		const emit = (event)=>{ if(handlers && typeof handlers.onEvent === 'function'){ handlers.onEvent(event); } };
		let sawDone = false;
		for(let i = 0; i < steps.length; i++){
			const s = steps[i] && typeof steps[i] === 'object' ? steps[i] : {};
			if(s.stall !== undefined){ await delay(Number(s.stall) || 0); }
			if(s.hang !== undefined){ await (s.hang === true ? new Promise(()=>{}) : s.hang); }
			if(s.abortOn !== undefined){
				const sig = handlers && handlers.signal;
				await new Promise((resolve)=>{
					if(!sig){ setTimeout(resolve, Number(s.abortOn) || 0); return; }
					if(sig.aborted){ resolve(); return; }
					sig.addEventListener('abort', ()=>resolve(), { once: true });
				});
				const ae = new Error('The operation was aborted.');
				ae.name = 'AbortError';
				throw ae;
			}
			if(typeof s.run === 'function'){ await s.run(values, handlers); }
			if(s.text !== undefined){ emit({ type: 'delta', json: { delta: `${s.text}` } }); }
			if(s.reasoning !== undefined){ emit({ type: 'reasoning', json: { reasoning: `${s.reasoning}` } }); }
			if(s.usage !== undefined){ emit({ type: 'usage', json: s.usage }); }
			if(s.toolCall !== undefined){
				const c = s.toolCall || {};
				const id = c.id || `call_${i + 1}`;
				emit({ type: 'tool_call_start', json: { id, name: c.name, index: i } });
				emit({ type: 'tool_call', json: { id, name: c.name, index: i, arguments: JSON.stringify(c.args || {}) } });
			}
			if(s.http429 !== undefined){
				const e = httpError(429, s.http429);
				if(e.shouldThrow){ throw e.err; }
				emit({ type: 'error', json: { message: e.message } });
			}
			if(s.http500 !== undefined){
				const e = httpError(500, s.http500);
				if(e.shouldThrow){ throw e.err; }
				emit({ type: 'error', json: { message: e.message } });
			}
			if(s.error !== undefined){ emit({ type: 'error', json: { message: `${s.error}` } }); }
			if(s.done !== undefined){ sawDone = true; emit({ type: 'done', json: s.done && typeof s.done === 'object' ? s.done : { finish_reason: 'stop' } }); }
		}
		if(!sawDone){ emit({ type: 'done', json: { finish_reason: 'stop' } }); }
	});
	fn.requests = requests;
	// 最近一次请求体里的 messages(判据「请求体不含 X」用)
	fn.messagesAt = (i)=>{
		const v = requests[i];
		return v && Array.isArray(v.messages) ? v.messages : [];
	};
	fn.allMessageText = ()=>requests.map((v)=>((v && Array.isArray(v.messages) ? v.messages : []).map((m)=>`${(m && m.content) || ''}`).join('\n'))).join('\n');
	return fn;
}

// 判官(非流式短调用)脚本:verdict 可以是对象或字符串原文
export function fakeJudgeScript(verdicts){
	const list = Array.isArray(verdicts) ? verdicts : [verdicts];
	let i = 0;
	return jest.fn(async ()=>{
		const v = list[Math.min(i, list.length - 1)];
		i += 1;
		return { Result: { content: typeof v === 'string' ? v : JSON.stringify(v) } };
	});
}

// ── ② 配额:指定键的 setItem 抛 QuotaExceededError ──────────────────────────────
// keysToFail:字符串 / 正则 / 它们的数组;省略 = 所有键都抛。返回恢复函数(带 .hits)。
export function quotaStorage(keysToFail){
	const raw = keysToFail === undefined || keysToFail === null ? null : (Array.isArray(keysToFail) ? keysToFail : [keysToFail]);
	const proto = (typeof window !== 'undefined' && window.Storage && window.Storage.prototype)
		|| Object.getPrototypeOf(window.localStorage);
	const original = proto.setItem;
	const hits = [];
	const match = (k)=>{
		if(!raw){ return true; }
		return raw.some((p)=>(p instanceof RegExp ? p.test(`${k}`) : `${k}` === `${p}`));
	};
	proto.setItem = function patchedSetItem(k, v){
		if(match(k)){
			hits.push(`${k}`);
			const e = new Error(`QuotaExceededError: 写入 ${k} 超出配额(夹具)`);
			e.name = 'QuotaExceededError';
			e.code = 22;
			throw e;
		}
		return original.call(this, k, v);
	};
	const restore = ()=>{ proto.setItem = original; };
	restore.hits = hits;
	return restore;
}

// ── ③ 双窗口 ───────────────────────────────────────────────────────────────────
// 同一份库(共享的 aiAnalysisStore + fake-indexeddb)+ 两份独立「页面层」模块实例
// (scheduler 的模块级 ticking / taskStore 的 taskCache 各一份 = 真双窗口形态)。
//
// 🔴 仪器坑(本轮实抓):本仓 umi-test 捆绑的 jest 里 isolateModules 有一条——
//    jest-runtime.requireModule:`if (this._moduleRegistry.get(modulePath) || !this._isolatedModuleRegistry)`
//    → **模块只要已经在主注册表里,isolateModules 就原样返回主注册表那一份**。
//    于是「两个窗口」会是同一个模块实例(第二跳直接 busy:true),缺陷被夹具自己盖掉、用例假绿。
//    所以这里先 jest.resetModules() 清空主注册表,再把数据层 aiAnalysisStore 放回主注册表
//    (两窗口的 taskStore 都 import 它 → 共享同一份库),最后隔离两份页面层。
//    副作用:调用方文件顶层 import 到的那批实例仍是「重置前的世界」,与两窗口互不相通——
//    因此用了 twoTabs() 的用例不要再混用顶层 import 的同名模块去读写这两个窗口的数据。
// 用完必须 restore():还原 window.indexedDB,否则污染同文件后续用例。
export function twoTabs(){
	const savedIdb = window.indexedDB;
	const savedRange = window.IDBKeyRange;
	window.indexedDB = new FIDB.IDBFactory();
	window.IDBKeyRange = FIDB.IDBKeyRange;
	jest.resetModules();
	require('../../aiAnalysisStore');   // 主注册表:两窗口共享同一份数据层
	const load = ()=>{
		let m = null;
		jest.isolateModules(()=>{
			m = {
				store: require('../../aiAnalysisStore'),
				taskStore: require('../../aiAgent/tasks/taskStore'),
				scheduler: require('../../aiAgent/tasks/scheduler'),
				noticeStore: require('../../aiAgent/tasks/noticeStore'),
			};
		});
		return m;
	};
	const a = load();
	const b = load();
	// 夹具自证:两窗口必须是不同实例、且共享同一数据层;不成立就直接报错,别让用例假绿。
	if(a.scheduler === b.scheduler || a.taskStore === b.taskStore){
		window.indexedDB = savedIdb; window.IDBKeyRange = savedRange;
		throw new Error('[agentFakes.twoTabs] 两个窗口拿到了同一个模块实例(isolateModules 没隔离成功)');
	}
	if(a.store !== b.store){
		window.indexedDB = savedIdb; window.IDBKeyRange = savedRange;
		throw new Error('[agentFakes.twoTabs] 两个窗口的 aiAnalysisStore 不是同一份,数据不共享');
	}
	const restore = ()=>{
		[a, b].forEach((tab)=>{
			try{ tab.scheduler.__resetSchedulerForTests(); }catch(e){ /* noop */ }
			try{ tab.taskStore.__resetTaskCacheForTests(); }catch(e){ /* noop */ }
		});
		window.indexedDB = savedIdb;
		window.IDBKeyRange = savedRange;
	};
	return { a, b, restore };
}
