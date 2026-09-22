// AI 对话·上下文策略与真消息窗口:
// - 策略键 horosa.ai.chat.contextPolicy.v1(settings 类,随备份);缺省 historyMode='window'(2026-09-07 起,
//   真模型 A/B PASS 后翻缺省:cost_proxy −56%、缓存命中 0.57→0.83、回指 3/3、前缀零漂移;证据锁 baselines/ab_context_policy.json)。
//   historyMode='legacy' = 旧版:历史全量随消息数组发送,system 内「最近对话」层照旧拼入(即历史双发)。
// - historyMode='window':system 不再拼「最近对话」层(治双发),改在消息数组上按模型窗口做 token 预算
//   滚动窗口——末条 user 无条件保留、保底/上限条数、停止后对齐到 user 开头(不切断问答对)、
//   带 trace 的 assistant 按回放档(原样/折叠)计入估算、旧图按保留数剥离。
// - trace 回放分级(traceTurnsFull/traceTurnsFolded/foldedResultMaxChars/dedupSameCall)由智能体运行时读取本策略消费。
// 纯函数、不启动 React;AIAnalysisMain.streamReply 是唯一消费口(四个发送口皆经之)。
import { safeLocalStorageGet, safeLocalStorageSet, safeLocalStorageRemove } from './safeStorage';
import { estimateTextTokens } from './aiAnalysisContext';
import { contextWindowForModel } from './aiAnalysisProviders';

export const CHAT_CONTEXT_POLICY_KEY = 'horosa.ai.chat.contextPolicy.v1';
export const CHAT_CONTEXT_POLICY_EVENT = 'horosa:chat-context-policy-changed';

export const DEFAULT_CONTEXT_POLICY = Object.freeze({
	historyMode: 'window',
	historyTokenBudget: null,
	// [#80] 挂载字数预算:null = 按当前模型上下文窗口实算(contextCharBudgetForModel);
	//   填数 = 固定该值(只夹下限 2000,不受 capChars 封顶——用户自己填的就是他要的)。
	mountCharBudget: null,
	historyMinKeep: 4,
	historyMaxKeep: 40,
	historyImageKeep: Infinity,
	traceTurnsFull: 2,
	traceTurnsFolded: 0,
	foldedResultMaxChars: Object.freeze({ read: 1200, additive: 600 }),
	dedupSameCall: false,
});

// 每张图按平价计入窗口预算(各家「一张图≈数百至千余 token」的同量级折中;只用于窗口判断,不进计费)。
export const HISTORY_IMAGE_TOKENS = 800;
// 未知模型(目录表无窗口且无 num_ctx)的历史 token 预算;已知窗口按 10% 取,夹在 [4000,16000]。
export const HISTORY_BUDGET_UNKNOWN = 6000;
export const HISTORY_BUDGET_MIN = 4000;
export const HISTORY_BUDGET_MAX = 16000;
const HISTORY_BUDGET_RATIO = 0.10;

function clampInt(v, min, max, fallback){
	const n = typeof v === 'number' ? v : Number(v);
	if(v === null || v === undefined || v === '' || typeof v === 'boolean' || !Number.isFinite(n)){ return fallback; }
	return Math.min(max, Math.max(min, Math.round(n)));
}

// 图片保留数:null/undefined/Infinity/'Infinity'/空串 = 不限;非法值也回不限(缺省即现状)。
// [Q-290/M-105·PP-21①] 归一与面板同值域(历史 token 预算 500–200000;保留图片数 0–50;此前归一 400000 / 无上限,999 原样保存)
export const HISTORY_TOKEN_BUDGET_MAX = 200000;
export const HISTORY_IMAGE_KEEP_MAX = 50;
function clampImageKeep(v){
	if(v === null || v === undefined || v === '' || v === Infinity || v === 'Infinity'){ return Infinity; }
	const n = Number(v);
	if(typeof v === 'boolean' || !Number.isFinite(n) || n < 0){ return Infinity; }
	return Math.min(HISTORY_IMAGE_KEEP_MAX, Math.round(n));
}

// 浅合并 + 值域钳制:任何非法/越界值回落缺省或钳到边界;maxKeep 不小于 minKeep。幂等(再归一同值)。
export function normalizeContextPolicy(input){
	const src = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
	const merged = { ...DEFAULT_CONTEXT_POLICY, ...src };
	const fr = src.foldedResultMaxChars && typeof src.foldedResultMaxChars === 'object' ? src.foldedResultMaxChars : {};
	const minKeep = clampInt(merged.historyMinKeep, 0, 200, DEFAULT_CONTEXT_POLICY.historyMinKeep);
	const maxKeep = Math.max(minKeep, clampInt(merged.historyMaxKeep, 1, 400, DEFAULT_CONTEXT_POLICY.historyMaxKeep));
	const budget = clampInt(merged.historyTokenBudget, 500, HISTORY_TOKEN_BUDGET_MAX, null);
	const mountBudget = clampInt(merged.mountCharBudget, 2000, 400000, null);
	return {
		historyMode: merged.historyMode === 'legacy' ? 'legacy' : 'window',
		historyTokenBudget: budget !== null && budget > 0 ? budget : null,
		mountCharBudget: mountBudget !== null && mountBudget > 0 ? mountBudget : null,
		historyMinKeep: minKeep,
		historyMaxKeep: maxKeep,
		historyImageKeep: clampImageKeep(merged.historyImageKeep),
		traceTurnsFull: clampInt(merged.traceTurnsFull, 0, 50, DEFAULT_CONTEXT_POLICY.traceTurnsFull),
		traceTurnsFolded: clampInt(merged.traceTurnsFolded, 0, 100, DEFAULT_CONTEXT_POLICY.traceTurnsFolded),
		foldedResultMaxChars: {
			read: clampInt(fr.read, 100, 8000, DEFAULT_CONTEXT_POLICY.foldedResultMaxChars.read),
			additive: clampInt(fr.additive, 100, 8000, DEFAULT_CONTEXT_POLICY.foldedResultMaxChars.additive),
		},
		dedupSameCall: merged.dedupSameCall === true,
	};
}

// 读策略:缺键/坏 JSON/非对象一律回缺省(= 现状),永不抛。
export function readContextPolicy(){
	const raw = safeLocalStorageGet(CHAT_CONTEXT_POLICY_KEY);
	if(!raw){ return normalizeContextPolicy(null); }
	let parsed = null;
	try{ parsed = JSON.parse(raw); }catch(e){ parsed = null; }
	return normalizeContextPolicy(parsed);
}

// 三档预设(设置面一键切换):window=缺省(治历史双发的真消息窗口);legacy=旧版不裁档;economy=窗口+更早 Turn 折叠回放+同参去重。
// 预设只是「写进策略键的一组值」,不是第二套判定——写入后 readContextPolicy 读到的就是它。
export const CONTEXT_POLICY_PRESETS = Object.freeze({
	legacy: Object.freeze({ ...DEFAULT_CONTEXT_POLICY, historyMode: 'legacy' }),
	window: Object.freeze({ ...DEFAULT_CONTEXT_POLICY, historyMode: 'window' }),
	// [D39·2026-09-08] 经济档此前 = 窗口 + traceTurnsFull 2 + 折叠 4 ⇒ 比窗口档(2 整 + 0 折叠)**多**保留四轮折叠结果,真模型 A/B
	// 两次实测 cost_proxy 高于窗口档 26%、缓存命中更低,与文案「更省」相反。改为 1 整轮 + 2 折叠轮(折叠上限 800/400 字)+ 去重:
	// 保留内容严格 ≤ 窗口档;A/B 判据加「economy ≤ window×1.05」臂间比较(ab_context_policy.py)。
	economy: Object.freeze({ ...DEFAULT_CONTEXT_POLICY, historyMode: 'window', traceTurnsFull: 1, traceTurnsFolded: 2, foldedResultMaxChars: Object.freeze({ read: 800, additive: 400 }), dedupSameCall: true }),
});

// 当前策略落在哪一档:逐键与预设比对(Infinity/对象值经 JSON 比较);都不等=custom。
export function contextPolicyPresetName(policy){
	const p = normalizeContextPolicy(policy);
	const same = (a, b)=>JSON.stringify(normalizeContextPolicy(a)) === JSON.stringify(b);
	const names = Object.keys(CONTEXT_POLICY_PRESETS);
	for(let i = 0; i < names.length; i++){
		if(same(CONTEXT_POLICY_PRESETS[names[i]], p)){ return names[i]; }
	}
	return 'custom';
}

function emitContextPolicy(policy){
	try{
		if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function'){
			window.dispatchEvent(new CustomEvent(CHAT_CONTEXT_POLICY_EVENT, { detail: { policy } }));
		}
	}catch(e){ /* noop */ }
}

// 写策略(唯一写入方;设置面/A-B 驱动器/预设按钮都经此):读→浅合并→归一→整对象落盘→广播。
// 返回落盘后的归一策略;写失败(配额)不抛,读侧仍回旧值/缺省。
export function writeContextPolicy(partial){
	const merged = { ...readContextPolicy(), ...(partial && typeof partial === 'object' && !Array.isArray(partial) ? partial : {}) };
	const next = normalizeContextPolicy(merged);
	// Infinity 不能进 JSON:图片保留数不限时省略该键(读侧缺键=不限,语义等价)
	const persist = { ...next };
	if(persist.historyImageKeep === Infinity){ delete persist.historyImageKeep; }
	safeLocalStorageSet(CHAT_CONTEXT_POLICY_KEY, JSON.stringify(persist));
	emitContextPolicy(next);
	return next;
}

// 清策略=回缺省(删键而非写缺省对象:缺键才是「从未自定义」的现状态)。
// [进阶审计 D8] 设置面「恢复现状」的判据:键存在才有东西可恢复(与预设名无关 —— 缺省翻成 window 后,
//   按 preset==='legacy' 禁用是反的:不裁档反而点不了、缺省档点了也没变化)。
export function hasStoredContextPolicy(){
	return safeLocalStorageGet(CHAT_CONTEXT_POLICY_KEY) != null;
}

export function clearContextPolicy(){
	safeLocalStorageRemove(CHAT_CONTEXT_POLICY_KEY);
	const next = normalizeContextPolicy(null);
	emitContextPolicy(next);
	return next;
}

export function subscribeContextPolicy(fn){
	if(typeof window === 'undefined' || typeof fn !== 'function'){ return ()=>{}; }
	const h = (e)=>fn(e && e.detail && e.detail.policy ? e.detail.policy : readContextPolicy());
	window.addEventListener(CHAT_CONTEXT_POLICY_EVENT, h);
	// [进阶审计 D6·2026-09-07] 跨窗口:另一个窗口写了本键(或整个 storage 被清),本窗口的订阅者也要重读 —— storage 事件只在别的窗口触发,本窗口写入仍走上面的 CustomEvent
	const sh = (e)=>{ const k = e && e.key != null ? `${e.key}` : ''; if(!k || k === CHAT_CONTEXT_POLICY_KEY){ fn(readContextPolicy()); } };
	window.addEventListener('storage', sh);
	return ()=>{ window.removeEventListener(CHAT_CONTEXT_POLICY_EVENT, h); window.removeEventListener('storage', sh); };
}

// 历史 token 预算:numCtx(Ollama 真窗口)优先于目录表;未知 → 6000;已知 → clamp(窗口×10%, 4000, 16000)。
export function historyTokenBudgetForModel(model, opts){
	const numCtx = Number(opts && opts.numCtx);
	const win = numCtx > 0 ? numCtx : contextWindowForModel(model);
	if(!win){ return HISTORY_BUDGET_UNKNOWN; }
	return Math.max(HISTORY_BUDGET_MIN, Math.min(HISTORY_BUDGET_MAX, Math.round(win * HISTORY_BUDGET_RATIO)));
}

function hasTrace(m){
	return !!(m && m.role === 'assistant' && m.agentTrace && Array.isArray(m.agentTrace.rounds) && m.agentTrace.rounds.length);
}

// 带 trace 的 assistant 回放估算(rankFromEnd=该气泡在窗口内由新到旧的序号):
// 前 traceTurnsFull 个按调用参数+结果原文计;接着 traceTurnsFolded 个结果按折叠上限计;更早 0(只留正文)。
// 非末轮的轮正文也会回放(末轮正文=气泡 content 已按消息计),一并计入。
function traceReplayEstimate(trace, rankFromEnd, policy){
	const full = rankFromEnd < policy.traceTurnsFull;
	const folded = !full && rankFromEnd < policy.traceTurnsFull + policy.traceTurnsFolded;
	if(!full && !folded){ return { chars: 0, tokens: 0 }; }
	const rounds = trace.rounds;
	let chars = 0;
	let tokens = 0;
	const add = (s)=>{ const t = `${s || ''}`; chars += t.length; tokens += estimateTextTokens(t); };
	rounds.forEach((round, i)=>{
		if(i < rounds.length - 1){ add(round.text); }
		(round.toolCalls || []).forEach((c)=>{
			add(c && c.name);
			add(JSON.stringify(c && c.args !== undefined ? c.args : {}));
		});
		(round.results || []).forEach((r)=>{
			const content = `${(r && r.content) || ''}`;
			if(!folded){ add(content); return; }
			const lim = policy.foldedResultMaxChars[r && r.level] || policy.foldedResultMaxChars.read;
			add(content.length > lim ? content.slice(0, lim) : content);
		});
	});
	return { chars, tokens };
}

function sumTokens(list){
	return (list || []).reduce((acc, m)=>acc + (m && m.role !== 'system' ? estimateTextTokens(`${m.content || ''}`) : 0), 0);
}

// 真消息窗口:legacy → 原数组同引用(现状);window → 保留 index0 的 system(不计预算),从最新往旧累计
// estimateTextTokens(content) + 每图 HISTORY_IMAGE_TOKENS + trace 回放估算;末条 user 无条件保留;
// kept ≥ minKeep 才允许因预算停止;≤ maxKeep;停止后向后对齐到 user 开头(不切断问答对)。
// 返回 { messages, meta:{ mode, keptMsgs, droppedMsgs, keptTokens, replayChars, budget, stoppedBy } }。
// opts.replayTrace(可选,默认 true=旧行为):是否把带 agentTrace 回答的工具轮回放量计入 token。
// [Q-287/PP-12] 行动能力总开关关时运行时是 NULL_AGENT、messagesForRound 只发正文 → 调用方传 false,不再按不会发送的回放量裁历史。
export function windowChatMessages(messages, opts){
	const o = opts || {};
	const replayTrace = o.replayTrace !== undefined ? !!o.replayTrace : true;
	const policy = normalizeContextPolicy(o.policy || readContextPolicy());
	const list = Array.isArray(messages) ? messages : [];
	if(policy.historyMode !== 'window'){
		return {
			messages,
			meta: { mode: 'legacy', keptMsgs: list.length, droppedMsgs: 0, keptTokens: sumTokens(list), replayChars: 0, budget: null, stoppedBy: null },
		};
	}
	const hasSystem = list.length > 0 && list[0] && list[0].role === 'system';
	const system = hasSystem ? list[0] : null;
	const body = hasSystem ? list.slice(1) : list.slice();
	const budget = policy.historyTokenBudget || historyTokenBudgetForModel(o.model, { numCtx: o.numCtx });
	const minKeep = policy.historyMinKeep;
	const maxKeep = policy.historyMaxKeep;
	const picked = [];   // 由新到旧:{ m, tokens, replay }
	let keptTokens = 0;
	let tracedSeen = 0;
	let imagesSeen = 0;
	let stoppedBy = null;
	for(let i = body.length - 1; i >= 0; i--){
		let m = body[i];
		if(!m){ continue; }
		const isLastUser = i === body.length - 1 && m.role === 'user';
		if(Array.isArray(m.images) && m.images.length && imagesSeen >= policy.historyImageKeep){
			// 超出图片保留数的旧图剥离(正文保留;只在 window 模式生效)
			const copy = { ...m };
			delete copy.images;
			m = copy;
		}
		const imgs = Array.isArray(m.images) ? m.images.length : 0;
		let tokens = estimateTextTokens(`${m.content || ''}`) + imgs * HISTORY_IMAGE_TOKENS;
		let replay = 0;
		if(replayTrace && hasTrace(m)){
			const est = traceReplayEstimate(m.agentTrace, tracedSeen, policy);
			tokens += est.tokens;
			replay = est.chars;
		}
		if(!isLastUser){
			if(picked.length >= maxKeep){ stoppedBy = 'maxKeep'; break; }
			if(picked.length >= minKeep && keptTokens + tokens > budget){ stoppedBy = 'budget'; break; }
		}
		picked.push({ m, tokens, replay });
		keptTokens += tokens;
		if(hasTrace(m)){ tracedSeen += 1; }
		if(imgs){ imagesSeen += 1; }
	}
	let kept = picked.slice().reverse();
	if(body.length - kept.length > 0){
		// 停止后对齐到 user 开头:首条若不是 user(问答对被切断),连同其后到首个 user 之前的一并丢
		const firstUser = kept.findIndex((x)=>x.m && x.m.role === 'user');
		if(firstUser > 0){
			kept.slice(0, firstUser).forEach((x)=>{ keptTokens -= x.tokens; });
			kept = kept.slice(firstUser);
		}
	}
	const keptMsgs = kept.map((x)=>x.m);
	const replayChars = kept.reduce((acc, x)=>acc + x.replay, 0);
	return {
		messages: system ? [system].concat(keptMsgs) : keptMsgs,
		meta: {
			mode: 'window',
			keptMsgs: keptMsgs.length,
			droppedMsgs: body.length - keptMsgs.length,
			keptTokens,
			replayChars,
			budget,
			stoppedBy,
		},
	};
}
