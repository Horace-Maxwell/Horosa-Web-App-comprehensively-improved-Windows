// 自动化规则存储(P4):规则住 IDB automation_rules(v11 已建);缺省零规则 = 引擎永不动作。
// 规则形状 { id, name, event, enabled(缺省 false), match:{ kind?, technique?, toolName?, contains? }, actions:[{type,...}], cooldownMs, lastFiredAt }
import { AI_ANALYSIS_STORES, listStoreRecords, getStoreRecord, putStoreRecord, deleteStoreRecord } from '../../aiAnalysisStore';
import { AUTOMATION_EVENTS } from './events';
import { actionEventHardBlocked, AUTOMATION_ACTION_TYPES } from './actions';

export const RULE_COOLDOWN_DEFAULT_MS = 60000;
export const RULES_MAX = 30;
export const RULES_CHANGED_EVENT = 'horosa:automation-rules-changed';
function emitRulesChanged(){
	try{ if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function'){ window.dispatchEvent(new CustomEvent(RULES_CHANGED_EVENT)); } }catch(e){ /* noop: DOM 事件派发失败不反噬 */ }
}
export function subscribeRulesChanged(fn){
	if(typeof window === 'undefined' || typeof fn !== 'function'){ return ()=>{}; }
	const h = ()=>fn();
	window.addEventListener(RULES_CHANGED_EVENT, h);
	return ()=>window.removeEventListener(RULES_CHANGED_EVENT, h);
}

export function normalizeRule(raw){
	const r = raw && typeof raw === 'object' ? raw : {};
	const event = AUTOMATION_EVENTS.indexOf(`${r.event || ''}`) >= 0 ? `${r.event}` : '';
	const actions = (Array.isArray(r.actions) ? r.actions : []).filter((a)=>a && typeof a === 'object' && `${a.type || ''}`.trim()).slice(0, 3);
	return {
		id: `${r.id || ''}` || `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		name: `${r.name || ''}`.slice(0, 60) || '未命名规则',
		event,
		enabled: r.enabled === true,
		match: r.match && typeof r.match === 'object' ? r.match : {},
		actions,
		// 🔴 显式 0 = 用户要「不冷却」,不能被 `|| 默认值` 吃掉(Number(0) 是 falsy);只有缺省/非数才回落默认
		cooldownMs: Math.max(0, Math.min(24 * 3600000, Number.isFinite(Number(r.cooldownMs)) ? Number(r.cooldownMs) : RULE_COOLDOWN_DEFAULT_MS)),
		lastFiredAt: `${r.lastFiredAt || ''}`,
	};
}

// 「此版本不会触发」单一判据(面板标签与排序、上限提示、任何列规则的工具同读这一处;引擎口径见 engine.js):
//   事件此版本没有 / 事件为空;没有动作;「工具执行前」上没有「拒绝执行」(同步否决通道只认它);
//   其余事件上没有一个此版本认识、且不是「拒绝执行」的动作(异步引擎跳过拒绝执行、未知动作只发失败通知)。
//   只看结构,不看启停与载荷:停用的规则是用户自己停的,不算;缺记录 id 一类「载荷带了就能跑」的组合也不算。
//   reason 只写中文说明,不含原始事件 / 动作名(那些放悬停提示)。
export function ruleWontFire(rule){
	const r = rule && typeof rule === 'object' ? rule : {};
	if(!r.event){
		return r.orphanEvent && r.orphanEvent !== '(空)'
			? { code: 'event-unknown', reason: '触发事件此版本没有(旧版留下的规则)' }
			: { code: 'event-empty', reason: '没有触发事件(记录不完整)' };
	}
	const actions = Array.isArray(r.actions) ? r.actions.filter((a)=>a && typeof a === 'object' && `${a.type || ''}`) : [];
	if(!actions.length){ return { code: 'no-actions', reason: '没有任何动作' }; }
	if(r.event === 'tool.before'){
		return actions.some((a)=>a.type === 'deny') ? null : { code: 'actions-mismatch', reason: '「AI 要执行某工具之前」只能配「拒绝执行」,这条没有' };
	}
	if(actions.some((a)=>a.type !== 'deny' && AUTOMATION_ACTION_TYPES.indexOf(`${a.type}`) >= 0)){ return null; }
	const allUnknown = actions.every((a)=>AUTOMATION_ACTION_TYPES.indexOf(`${a.type}`) < 0);
	if(allUnknown){ return { code: 'actions-unknown', reason: '动作此版本没有(旧版留下的规则)' }; }
	return { code: 'actions-mismatch', reason: '「拒绝执行」只对「AI 要执行某工具之前」生效,这条没有别的可执行动作' };
}

// 列表序:会触发的在前(保持库里原顺序),此版本不会触发的排到最后(稳定分区;引擎与否决通道都不会命中它们,顺序不影响触发)
export function orderRulesForDisplay(rules){
	const list = Array.isArray(rules) ? rules : [];
	return list.filter((r)=>!(r && r.wontFire)).concat(list.filter((r)=>r && r.wontFire));
}

export async function listRules(){
	const all = await listStoreRecords(AI_ANALYSIS_STORES.automationRules);
	// 事件已不认识的旧规则(此版本没有这个事件)与事件为空 / 缺失的坏记录:照列出来、标 orphanEvent(为空写「(空)」),
	// 面板显示「此版本不会触发」并只能删(此前直接滤掉 = 看不见也删不掉、永远占着库);event 为空,引擎按事件逐字比,永不命中。
	// 凡此版本不会触发的规则(ruleWontFire)都带 wontFire:{code, reason} 并排到最后;它们照旧计入 RULES_MAX(存储上限)
	return orderRulesForDisplay((all || []).filter((raw)=>raw && typeof raw === 'object').map((raw)=>{
		const r = normalizeRule(raw);
		if(!r.event){ r.orphanEvent = raw.event ? `${raw.event}` : '(空)'; }
		const wf = ruleWontFire(r);
		if(wf){ r.wontFire = wf; }
		return r;
	}));
}

export async function saveRule(rule){
	const norm = normalizeRule(rule);
	if(!norm.event){ throw new Error('规则必须选一个事件'); }
	// 不可达的 事件 × 动作 组合保存即拒(此前存得进去、永不执行、无提示)
	const bad = (Array.isArray(norm.actions) ? norm.actions : []).map((a)=>(a && a.type ? { type: a.type, why: actionEventHardBlocked(a.type, norm.event) } : null)).find((x)=>x && x.why);
	if(bad){ throw new Error(`动作「${bad.type}」在事件「${norm.event}」上永远不会执行:${bad.why},请换一个动作或事件`); }
	const existing = await listRules();
	if(!existing.some((r)=>r.id === norm.id) && existing.length >= RULES_MAX){
		// 上限是存储上限,此版本不会触发的规则照算;点名它们,用户知道删哪几条能腾位置
		const idle = existing.filter((r)=>r && r.wontFire).length;
		throw new Error(`规则数已达上限 ${RULES_MAX}${idle ? `(其中 ${idle} 条此版本不会触发,排在列表最后,可删掉腾出位置)` : ''}`);
	}
	const saved = await putStoreRecord(AI_ANALYSIS_STORES.automationRules, norm, 'rule');
	emitRulesChanged();
	return saved;
}

export async function removeRule(id){
	const r = await deleteStoreRecord(AI_ANALYSIS_STORES.automationRules, id);
	emitRulesChanged();
	return r;
}

// 只在库里的原始记录上并 lastFiredAt:按归一化后的对象写回,事件已不认识的规则会被写成空事件、原事件丢失
export async function markRuleFired(id, at){
	const raw = await getStoreRecord(AI_ANALYSIS_STORES.automationRules, id);
	if(!raw || typeof raw !== 'object'){ return null; }
	return putStoreRecord(AI_ANALYSIS_STORES.automationRules, { ...raw, lastFiredAt: at || new Date().toISOString() }, 'rule');
}
