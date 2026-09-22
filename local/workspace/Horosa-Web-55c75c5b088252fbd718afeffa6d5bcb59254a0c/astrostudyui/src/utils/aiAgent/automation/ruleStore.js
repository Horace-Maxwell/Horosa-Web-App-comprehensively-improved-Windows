// 自动化规则存储(P4):规则住 IDB automation_rules(v11 已建);缺省零规则 = 引擎永不动作。
// 规则形状 { id, name, event, enabled(缺省 false), match:{ kind?, technique?, toolName?, contains? }, actions:[{type,...}], cooldownMs, lastFiredAt }
import { AI_ANALYSIS_STORES, listStoreRecords, putStoreRecord, deleteStoreRecord } from '../../aiAnalysisStore';
import { AUTOMATION_EVENTS } from './events';
import { actionEventHardBlocked } from './actions';

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

export async function listRules(){
	const all = await listStoreRecords(AI_ANALYSIS_STORES.automationRules);
	return (all || []).map(normalizeRule).filter((r)=>r.event);
}

export async function saveRule(rule){
	const norm = normalizeRule(rule);
	if(!norm.event){ throw new Error('规则必须选一个事件'); }
	// [Q-294/M-109·AR-21] 不可达的 事件 × 动作 组合保存即拒(此前存得进去、永不执行、无提示)
	const bad = (Array.isArray(norm.actions) ? norm.actions : []).map((a)=>(a && a.type ? { type: a.type, why: actionEventHardBlocked(a.type, norm.event) } : null)).find((x)=>x && x.why);
	if(bad){ throw new Error(`动作「${bad.type}」在事件「${norm.event}」上永远不会执行:${bad.why},请换一个动作或事件`); }
	const existing = await listRules();
	if(!existing.some((r)=>r.id === norm.id) && existing.length >= RULES_MAX){ throw new Error(`规则数已达上限 ${RULES_MAX}`); }
	const saved = await putStoreRecord(AI_ANALYSIS_STORES.automationRules, norm, 'rule');
	emitRulesChanged();
	return saved;
}

export async function removeRule(id){
	const r = await deleteStoreRecord(AI_ANALYSIS_STORES.automationRules, id);
	emitRulesChanged();
	return r;
}

export async function markRuleFired(id, at){
	const all = await listRules();
	const one = all.find((r)=>r.id === id);
	if(!one){ return null; }
	return putStoreRecord(AI_ANALYSIS_STORES.automationRules, { ...one, lastFiredAt: at || new Date().toISOString() }, 'rule');
}
