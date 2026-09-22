// AI 助手·按任务用模型(C4;把生成管线里「按角色选模型」的做法下放到聊天侧):六个槽位 toolRounds/final/judge/review/planner/subagent,
// 每槽存一个 encodeModelSelection(profileId, model) 串,全空=现状(跟随当前模型,请求字节不变)。
// 纪律:resolveRoute 与既有按角色解析模型的口径一致——档案找不到回落当前档案,模型缺回落当前模型;
// 轮规划是纯函数(roundSlot/shouldRequestClose),页面钩子只做粘合;缺省路径零字节变化。
import { safeJsonParseFromStorage, safeJsonStringifyToStorage, safeLocalStorageRemove } from './safeStorage';
import { parseModelSelection, isReasoningModel, getProviderProtocolFamily, isOpenAiFamily, maxTokensKeyForModel, clampTemperatureForFamily, isOpenAIReasoningModel, } from './aiAnalysisProviders';

export const MODEL_ROUTES_KEY = 'horosa.ai.chat.modelRoutes.v1';
export const MODEL_ROUTES_EVENT = 'horosa:ai-model-routes-changed';
export const ROUTE_SLOTS = ['toolRounds', 'final', 'judge', 'review', 'planner', 'subagent'];
export const ROUTE_SLOT_META = {
	toolRounds: { label: '工具调用轮', help: '行动能力开启时,带工具的各轮用它(便宜、快);留空=跟随当前模型' },
	final: { label: '终稿', help: '最后一轮不带工具的回答用它(强模型);与工具轮不同时自动多收口一轮' },
	judge: { label: '判官', help: '目标任务自检 / 多模型对比打分用它(异源判官防自我偏袒)' },
	review: { label: '审阅', help: '「审阅」对拍数据挑错用它(优先另一家)' },
	planner: { label: '规划', help: '多技法分工的拆解计划用它' },
	subagent: { label: '子任务', help: '多技法分工的各子任务用它(只读、≤3 轮)' },
};

export function normalizeModelRoutes(raw){
	const out = {};
	ROUTE_SLOTS.forEach((k)=>{ const v = raw && typeof raw === 'object' ? raw[k] : ''; out[k] = typeof v === 'string' ? v.trim() : ''; });
	return out;
}

export function readModelRoutes(){
	return normalizeModelRoutes(safeJsonParseFromStorage(MODEL_ROUTES_KEY));
}

export function hasAnyRoute(routes){
	const r = normalizeModelRoutes(routes);
	return ROUTE_SLOTS.some((k)=>!!r[k]);
}

function emit(routes){
	try{ if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function'){ window.dispatchEvent(new CustomEvent(MODEL_ROUTES_EVENT, { detail: routes })); } }catch(e){ /* noop */ }
}

// 写:合并 patch;全空即删键(与「从未设置」同形,缺省判据不靠空对象)
export function writeModelRoutes(patch){
	const next = normalizeModelRoutes({ ...readModelRoutes(), ...(patch || {}) });
	if(!hasAnyRoute(next)){ safeLocalStorageRemove(MODEL_ROUTES_KEY); emit(next); return next; }
	const compact = {};
	ROUTE_SLOTS.forEach((k)=>{ if(next[k]){ compact[k] = next[k]; } });
	try{ safeJsonStringifyToStorage(MODEL_ROUTES_KEY, compact); }catch(e){ /* 配额等:保持内存值 */ }
	emit(next);
	return next;
}

export function clearModelRoutes(){
	safeLocalStorageRemove(MODEL_ROUTES_KEY);
	const empty = normalizeModelRoutes(null);
	emit(empty);
	return empty;
}

export function subscribeModelRoutes(fn){
	if(typeof window === 'undefined' || typeof fn !== 'function'){ return ()=>{}; }
	const h = (e)=>fn(normalizeModelRoutes(e && e.detail ? e.detail : readModelRoutes()));
	window.addEventListener(MODEL_ROUTES_EVENT, h);
	// [进阶审计 D6·2026-09-07] 跨窗口:另一个窗口写了本键(或整个 storage 被清),本窗口的订阅者也要重读 —— storage 事件只在别的窗口触发,本窗口写入仍走上面的 CustomEvent
	const sh = (e)=>{ const k = e && e.key != null ? `${e.key}` : ''; if(!k || k === MODEL_ROUTES_KEY){ fn(normalizeModelRoutes(readModelRoutes())); } };
	window.addEventListener('storage', sh);
	return ()=>{ window.removeEventListener(MODEL_ROUTES_EVENT, h); window.removeEventListener('storage', sh); };
}

// 槽位解析(与既有按角色解析模型的口径一致):空槽/解析失败 → 回落 {profile, model, routed:false}
export function resolveRoute(slot, { routes, providerProfiles, profile, model }){
	const r = normalizeModelRoutes(routes);
	const enc = r[slot] || '';
	const fallback = { profile, model, routed: false, slot };
	if(!enc){ return fallback; }
	const parsed = parseModelSelection(enc) || {};
	const p = (providerProfiles || []).find((x)=>x && x.id === parsed.profileId) || profile;
	const m = parsed.model || model;
	if(!p || !m){ return fallback; }
	const same = !!(profile && p.id === profile.id && m === model);
	return { profile: p, model: m, routed: !same, slot };
}

// 一轮属于哪个槽:行动能力开着且未收口=工具调用轮;否则(总开关关 / 收口轮)=终稿
export function roundSlot({ agentEnabled, closing }){
	return agentEnabled && !closing ? 'toolRounds' : 'final';
}

export function sameTarget(a, b){
	return !!(a && b && a.profile && b.profile && a.profile.id === b.profile.id && a.model === b.model);
}

// 本轮结束(未收口、无工具调用)后是否要再收口一轮:仅当终稿槽解析到的目标 ≠ 本轮工具槽目标
export function shouldRequestClose({ routes, agentEnabled, closing, hadToolCalls, providerProfiles, profile, model }){
	if(!agentEnabled || closing || hadToolCalls){ return false; }
	const tool = resolveRoute('toolRounds', { routes, providerProfiles, profile, model });
	const fin = resolveRoute('final', { routes, providerProfiles, profile, model });
	if(!fin.routed && !tool.routed){ return false; }
	return !sameTarget(tool, fin);
}

// 路由到别的目标时重建 providerOptions:以目标档案自己的 providerOptions 为底,只带过与家族无关的通用键;同目标=原对象(零变化)
// [批二⑩] 按槽的思考档:键 horosa.ai.chat.routeOptions.v1 = { [slot]: { thinking } };缺省不存在/全空 = 现状(全局思考档)。
// 槽档优先于全局档;同目标(未改模型)也生效:先剥掉全局档写进去的思考键,再按槽档施加;'off' = 该槽明确不思考。
export const ROUTE_OPTIONS_KEY = 'horosa.ai.chat.routeOptions.v1';
export const ROUTE_OPTIONS_EVENT = 'horosa:ai-route-options-changed';
export const ROUTE_THINKING_RE = /^(off|low|medium|high|xhigh|max|custom:\d{4,5})$/;
// [批三②] 槽参数四键:thinking(思考档)/ reasoningEffort(low|medium|high,只对 OpenAI 系推理模型下发)/ temperature(0..2,推理模型不发)/ maxTokens(1..200000 → max_tokens)
export const ROUTE_EFFORTS = ['low', 'medium', 'high'];
export const ROUTE_TEMPERATURE_MAX = 2;
export const ROUTE_MAX_TOKENS_MAX = 200000;
export const ROUTE_SLOT_OPTION_KEYS = ['thinking', 'reasoningEffort', 'temperature', 'maxTokens'];
function normalizeSlotOptions(v){
	if(!v || typeof v !== 'object'){ return null; }
	const out = {};
	const t = typeof v.thinking === 'string' ? v.thinking.trim() : '';
	if(t && ROUTE_THINKING_RE.test(t)){ out.thinking = t; }
	const e = typeof v.reasoningEffort === 'string' ? v.reasoningEffort.trim() : '';
	if(e && ROUTE_EFFORTS.indexOf(e) >= 0){ out.reasoningEffort = e; }
	const temp = Number(v.temperature);
	if(v.temperature !== '' && v.temperature !== null && v.temperature !== undefined && Number.isFinite(temp) && temp >= 0 && temp <= ROUTE_TEMPERATURE_MAX){ out.temperature = Math.round(temp * 100) / 100; }
	const mt = Number(v.maxTokens);
	if(v.maxTokens !== '' && v.maxTokens !== null && v.maxTokens !== undefined && Number.isFinite(mt) && mt >= 1 && mt <= ROUTE_MAX_TOKENS_MAX){ out.maxTokens = Math.round(mt); }
	return Object.keys(out).length ? out : null;
}
export function normalizeRouteOptions(raw){
	const out = {};
	if(!raw || typeof raw !== 'object'){ return out; }
	ROUTE_SLOTS.forEach((k)=>{ const so = normalizeSlotOptions(raw[k]); if(so){ out[k] = so; } });
	return out;
}
export function slotOptions(ro, slot){ return ro && ro[slot] && typeof ro[slot] === 'object' ? ro[slot] : {}; }
export function readRouteOptions(){ return normalizeRouteOptions(safeJsonParseFromStorage(ROUTE_OPTIONS_KEY)); }
export function hasAnyRouteOption(ro){ return !!ro && Object.keys(ro).length > 0; }
export function slotThinking(ro, slot){ return ro && ro[slot] && ro[slot].thinking ? ro[slot].thinking : ''; }
function emitRouteOptions(ro){
	try{ if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function'){ window.dispatchEvent(new CustomEvent(ROUTE_OPTIONS_EVENT, { detail: ro })); } }catch(e){ /* noop */ }
}
// 写:patch = { [slot]: { thinking?, reasoningEffort?, temperature?, maxTokens? } };给出的键与现值合并,值为 ''/null/undefined = 清该键;整槽空=删槽;全空=删键(与从未设置同形)
export function writeRouteOptions(patch){
	const cur = readRouteOptions();
	const merged = { ...cur };
	Object.keys(patch || {}).forEach((k)=>{
		if(ROUTE_SLOTS.indexOf(k) < 0){ return; }
		const p = patch[k] && typeof patch[k] === 'object' ? patch[k] : {};
		const next = { ...(merged[k] || {}) };
		ROUTE_SLOT_OPTION_KEYS.forEach((key)=>{ if(Object.prototype.hasOwnProperty.call(p, key)){ if(p[key] === '' || p[key] === null || p[key] === undefined){ delete next[key]; }else{ next[key] = p[key]; } } });
		const so = normalizeSlotOptions(next);
		if(so){ merged[k] = so; }else{ delete merged[k]; }
	});
	const next = normalizeRouteOptions(merged);
	if(!hasAnyRouteOption(next)){ safeLocalStorageRemove(ROUTE_OPTIONS_KEY); }
	else{ try{ safeJsonStringifyToStorage(ROUTE_OPTIONS_KEY, next); }catch(e){ /* 配额 */ } }
	emitRouteOptions(next);
	return next;
}
export function clearRouteOptions(){ safeLocalStorageRemove(ROUTE_OPTIONS_KEY); emitRouteOptions({}); return {}; }
export function subscribeRouteOptions(fn){
	if(typeof window === 'undefined' || typeof fn !== 'function'){ return ()=>{}; }
	const h = (e)=>fn(normalizeRouteOptions(e && e.detail ? e.detail : readRouteOptions()));
	window.addEventListener(ROUTE_OPTIONS_EVENT, h);
	// [进阶审计 D6·2026-09-07] 跨窗口:另一个窗口写了本键(或整个 storage 被清),本窗口的订阅者也要重读 —— storage 事件只在别的窗口触发,本窗口写入仍走上面的 CustomEvent
	const sh = (e)=>{ const k = e && e.key != null ? `${e.key}` : ''; if(!k || k === ROUTE_OPTIONS_KEY){ fn(normalizeRouteOptions(readRouteOptions())); } };
	window.addEventListener('storage', sh);
	return ()=>{ window.removeEventListener(ROUTE_OPTIONS_EVENT, h); window.removeEventListener('storage', sh); };
}
// 剥掉三家的思考键(applyThinkingLevel 会写的那几把),不动其它 providerOptions
export const THINKING_OPTION_KEYS = ['thinking', 'reasoning_effort', 'output_config', 'thinking_budget_cap'];   // [Q-024] Anthropic 自适应形态两键同剥
export function stripThinkingOptions(opts){
	const o = { ...(opts || {}) };
	THINKING_OPTION_KEYS.forEach((k)=>{ delete o[k]; });
	if(o.generationConfig && typeof o.generationConfig === 'object' && o.generationConfig.thinkingConfig){
		const gc = { ...o.generationConfig }; delete gc.thinkingConfig;
		if(Object.keys(gc).length){ o.generationConfig = gc; }else{ delete o.generationConfig; }
	}
	return o;
}

export const ROUTE_CARRY_KEYS = ['temperature', 'top_p', 'stop', 'frequency_penalty', 'presence_penalty', 'response_format', 'requestTimeoutMs'];
// [批三②] 槽参数施加:temperature(推理模型不发)/ 输出上限 / reasoning_effort(只对 OpenAI 系推理模型;其它家族无此键,发了会 400)
// [进阶审计 D7] 输出上限必须写**家族 × 代际**正确的键(单源 maxTokensKeyForModel):OpenAI o/gpt-5+ 系是 max_completion_tokens、
//   Gemini 是 maxOutputTokens、Ollama 是 num_predict。此前一律写 max_tokens:聊天路径早已按推理模型兜底注入 max_completion_tokens(=10096),
//   槽写的 max_tokens 被后端丢弃 → 路由表「输出上限」对 o 系/gemini/ollama 是死格(端到端用例 S105 实抓:敲 999,请求体仍 10096)。
//   写槽值时把其它输出键一并清掉,免得两把键同发让上游/后端二选一。
const OUTPUT_CAP_KEYS = ['max_tokens', 'max_completion_tokens', 'maxOutputTokens', 'num_predict'];
export function applySlotParams(opts, so, providerType, model){
	const o = { ...(opts || {}) };
	const s = so || {};
	// [Q-323] 槽温度按家族夹逼:路由槽存的是 0..2(与 OpenAI 同域),原样发给 Anthropic 的 >1 档必 400
	if(s.temperature !== undefined && !isReasoningModel(model)){ o.temperature = clampTemperatureForFamily(s.temperature, getProviderProtocolFamily(providerType)); }
	if(s.maxTokens !== undefined){
		OUTPUT_CAP_KEYS.forEach((k)=>{ delete o[k]; });
		o[maxTokensKeyForModel(getProviderProtocolFamily(providerType), model)] = s.maxTokens;
	}
	// [Q-399 裁决 2026-09-18] 推理档判据与对话页思考档同源:只对 OpenAI o / gpt-5+ 代际写 reasoning_effort(isOpenAIReasoningModel);
	// 此前用 isReasoningModel(含 deepseek-reasoner / *-r1 / *thinking*)比标签「OpenAI 推理档」宽。DeepSeek 实测(2026-09-18)对该键 200 容忍,但按裁决收窄。
	if(s.reasoningEffort !== undefined && isOpenAIReasoningModel(model) && isOpenAiFamily(getProviderProtocolFamily(providerType))){ o.reasoning_effort = s.reasoningEffort; }
	return o;
}
function hasSlotParams(so){ return !!so && (so.temperature !== undefined || so.maxTokens !== undefined || so.reasoningEffort !== undefined); }
export function providerOptionsForRoute(route, base, { profile, model, thinkingLevel, applyThinkingLevel, routeOptions }){
	const so = route ? slotOptions(routeOptions, route.slot) : {};
	const slotT = so.thinking || '';
	const params = hasSlotParams(so);
	const level = slotT || thinkingLevel || 'off';
	if(!route || !route.routed || !route.profile){
		// 同目标:无槽档无槽参 = 原对象(现状);有槽档 = 剥旧思考键再按槽档施加(即使全局档相同也重算,语义单一);槽参最后落
		if((!slotT && !params) || !profile){ return base; }
		let o = slotT ? stripThinkingOptions(base) : { ...(base || {}) };
		if(slotT && typeof applyThinkingLevel === 'function'){ o = applyThinkingLevel(o, slotT, profile.providerType, model); }
		return params ? applySlotParams(o, so, profile.providerType, model) : o;
	}
	const same = profile && route.profile.id === profile.id && route.model === model;
	if(same){
		if(!slotT && !params){ return base; }
		let o = slotT ? stripThinkingOptions(base) : { ...(base || {}) };
		if(slotT && typeof applyThinkingLevel === 'function'){ o = applyThinkingLevel(o, slotT, route.profile.providerType, route.model); }
		return params ? applySlotParams(o, so, route.profile.providerType, route.model) : o;
	}
	let opts = { ...(route.profile.providerOptions || {}) };
	if(slotT){ opts = stripThinkingOptions(opts); }
	if(typeof applyThinkingLevel === 'function'){ opts = applyThinkingLevel(opts, level, route.profile.providerType, route.model); }
	ROUTE_CARRY_KEYS.forEach((k)=>{ if(base && base[k] !== undefined){ opts[k] = base[k]; } });
	return params ? applySlotParams(opts, so, route.profile.providerType, route.model) : opts;
}

// [进阶审计 D1] 短调用消费方(判官/审阅/规划/子任务/合并稿/综合/目标自检)的**单源**:此前六处各自写
// `applyThinkingLevel({...profile.providerOptions}, 'off')`,从不读 routeOptions → 表格里这四行的 思考档/推理档/温度/输出上限
// 写了键、从不生效(FL-20260907-2)。底 = 目标档案自身 providerOptions 经 baseThinking(缺省 'off' = 今日字节);
// 再按该槽的 routeOptions 施加(routed:false 语义:槽空 = 底对象原样返回 → 缺省路径逐字节零变化)。
export function providerOptionsForSlot(slot, profile, model, { applyThinkingLevel, routeOptions, baseThinking = 'off' } = {}){
	const seed = { ...((profile && profile.providerOptions) || {}) };
	const base = (typeof applyThinkingLevel === 'function' && profile) ? applyThinkingLevel(seed, baseThinking, profile.providerType, model) : seed;
	if(!profile || !model){ return base; }
	const ro = routeOptions || readRouteOptions();
	return providerOptionsForRoute({ profile, model, routed: false, slot }, base, { profile, model, thinkingLevel: baseThinking, applyThinkingLevel, routeOptions: ro });
}

// ── [批三②] 具名方案:键 horosa.ai.chat.routeProfiles.v1 = { profiles: { [name]: { routes, routeOptions } }, active: '' }
//    active 空 = 现状(两把活键就是真值);「另存为」把当前两把活键抄进方案;「切换」把方案抄回活键并记 active;删方案不动活键。
export const ROUTE_PROFILES_KEY = 'horosa.ai.chat.routeProfiles.v1';
export const ROUTE_PROFILES_EVENT = 'horosa:ai-route-profiles-changed';
export const ROUTE_PROFILE_NAME_MAX = 32;
export const ROUTE_PROFILES_MAX = 12;
export function normalizeRouteProfiles(raw){
	const r = raw && typeof raw === 'object' ? raw : {};
	const profiles = {};
	const src = r.profiles && typeof r.profiles === 'object' && !Array.isArray(r.profiles) ? r.profiles : {};
	Object.keys(src).slice(0, ROUTE_PROFILES_MAX).forEach((name)=>{
		const n = `${name}`.trim().slice(0, ROUTE_PROFILE_NAME_MAX);
		if(!n || n === '__proto__' || n === 'constructor' || n === 'prototype' || !Object.prototype.hasOwnProperty.call(src, name)){ return; }
		const v = src[name] && typeof src[name] === 'object' ? src[name] : {};
		profiles[n] = { routes: normalizeModelRoutes(v.routes), routeOptions: normalizeRouteOptions(v.routeOptions) };
	});
	const active = typeof r.active === 'string' && profiles[r.active] ? r.active : '';
	return { profiles, active };
}
export function readRouteProfiles(){ return normalizeRouteProfiles(safeJsonParseFromStorage(ROUTE_PROFILES_KEY)); }
function emitRouteProfiles(v){
	try{ if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function'){ window.dispatchEvent(new CustomEvent(ROUTE_PROFILES_EVENT, { detail: v })); } }catch(e){ /* noop */ }
}
function writeRouteProfiles(next){
	const v = normalizeRouteProfiles(next);
	if(!Object.keys(v.profiles).length && !v.active){ safeLocalStorageRemove(ROUTE_PROFILES_KEY); }
	else{ try{ safeJsonStringifyToStorage(ROUTE_PROFILES_KEY, v); }catch(e){ /* 配额 */ } }
	emitRouteProfiles(v);
	return v;
}
export function listRouteProfiles(){ const v = readRouteProfiles(); return Object.keys(v.profiles); }
export function activeRouteProfile(){ return readRouteProfiles().active; }
// 另存为:抄当前活键;同名覆盖;超过上限拒(回 null)
export function saveRouteProfile(name){
	const n = `${name || ''}`.trim().slice(0, ROUTE_PROFILE_NAME_MAX);
	if(!n){ return null; }
	const v = readRouteProfiles();
	if(!v.profiles[n] && Object.keys(v.profiles).length >= ROUTE_PROFILES_MAX){ return null; }
	v.profiles[n] = { routes: readModelRoutes(), routeOptions: readRouteOptions() };
	v.active = n;
	return writeRouteProfiles(v);
}
// 切换:把方案抄回两把活键(空方案=清键)并记 active;不存在回 false
export function applyRouteProfile(name){
	const v = readRouteProfiles();
	const p = v.profiles[`${name || ''}`.trim()];
	if(!p){ return false; }
	const routesPatch = {}; ROUTE_SLOTS.forEach((k)=>{ routesPatch[k] = p.routes[k] || ''; });
	writeModelRoutes(routesPatch);
	clearRouteOptions();
	if(Object.keys(p.routeOptions).length){ writeRouteOptions(p.routeOptions); }
	v.active = `${name}`.trim();
	writeRouteProfiles(v);
	return true;
}
export function removeRouteProfile(name){
	const v = readRouteProfiles();
	const n = `${name || ''}`.trim();
	if(!v.profiles[n]){ return false; }
	delete v.profiles[n];
	if(v.active === n){ v.active = ''; }
	writeRouteProfiles(v);
	return true;
}
export function clearActiveRouteProfile(){ const v = readRouteProfiles(); v.active = ''; return writeRouteProfiles(v); }
// 当前活键是否已偏离 active 方案(面板标「已改动」用)
export function isRouteProfileDirty(name){
	const v = readRouteProfiles(); const p = v.profiles[`${name || ''}`.trim()];
	if(!p){ return false; }
	return JSON.stringify({ r: normalizeModelRoutes(readModelRoutes()), o: readRouteOptions() }) !== JSON.stringify({ r: p.routes, o: p.routeOptions });
}
export function subscribeRouteProfiles(fn){
	if(typeof window === 'undefined' || typeof fn !== 'function'){ return ()=>{}; }
	const h = (e)=>fn(normalizeRouteProfiles(e && e.detail ? e.detail : readRouteProfiles()));
	window.addEventListener(ROUTE_PROFILES_EVENT, h);
	// [进阶审计 D6·2026-09-07] 跨窗口:另一个窗口写了本键(或整个 storage 被清),本窗口的订阅者也要重读 —— storage 事件只在别的窗口触发,本窗口写入仍走上面的 CustomEvent
	const sh = (e)=>{ const k = e && e.key != null ? `${e.key}` : ''; if(!k || k === ROUTE_PROFILES_KEY){ fn(readRouteProfiles()); } };
	window.addEventListener('storage', sh);
	return ()=>{ window.removeEventListener(ROUTE_PROFILES_EVENT, h); window.removeEventListener('storage', sh); };
}
