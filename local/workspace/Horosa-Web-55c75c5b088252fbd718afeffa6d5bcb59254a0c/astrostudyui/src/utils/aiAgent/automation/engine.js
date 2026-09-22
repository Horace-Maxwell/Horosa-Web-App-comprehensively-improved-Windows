// 自动化规则引擎(P4;默认关):事件 → 匹配规则 → 逐条跑动作。
// 六道防失控:①总开关 horosa.ai.automation.enabled 只认 '1';②深度守卫——payload.origin==='automation' 的事件一律不再触发;
// ③每事件最多触发 MAX_RULES_PER_EVENT 条;④每条规则有冷却(**尝试即计**,与成功与否无关);
// ⑤[A1] 链深度——动作同步发出的事件按链深度 +1 处理,超过 MAX_CHAIN_DEPTH 不再触发(A→B→A 互发到此为止,不看 origin);
// ⑥[A2] 每秒最多处理 MAX_EVENTS_PER_SEC 条事件,其余明确跳过(批量导入/建档的事件风暴不再逐条跑整套规则)。动作抛错 → 通知留痕,绝不反噬调用点。
import { subscribeAutomationEvents, subscribeAutomationVeto } from './events';
import { listRules, markRuleFired, subscribeRulesChanged } from './ruleStore';
import { buildActionRunners, notifyActionFailure } from './actions';
import { isAutomationEnabled } from '../prefs';
import { reportBackgroundFailure } from '../bgSink';

export const MAX_RULES_PER_EVENT = 3;
export const MAX_CHAIN_DEPTH = 2;
export const MAX_EVENTS_PER_SEC = 20;

let unbind = null;
let unbindVeto = null;
let unbindRules = null;
let deps = {};
// [批二④] 规则内存缓存:tool.before 的否决必须同步回答(不能等 IDB),故缓存一份;绑定时 + 规则变更事件时刷新
let rulesCache = null;
export async function refreshRulesCache(){
	try{ rulesCache = await listRules(); }catch(e){ rulesCache = rulesCache || []; reportBackgroundFailure('automation.rules-cache', e); }
	return rulesCache;
}
export function getRulesCacheForTests(){ return rulesCache; }
// 同步否决:自动化开 ∧ 某条启用规则监听 tool.before ∧ 匹配 ∧ 动作含 deny → 否决(不记冷却:否决零成本,不需要防刷屏)
export function vetoDecision(detail){
	if(!isAutomationEnabled()){ return null; }
	const rules = rulesCache || [];
	for(let i = 0; i < rules.length; i++){
		const rule = rules[i];
		if(!rule || rule.event !== 'tool.before' || !matchRule(rule, detail)){ continue; }
		if((rule.actions || []).some((a)=>a && a.type === 'deny')){ return { veto: true, reason: `规则「${rule.name}」拒绝执行`, ruleId: rule.id }; }
	}
	return null;
}
let chainDepth = 0;   // 当前正在同步执行的动作所处链深度(动作同步发出的事件在此深度 +1 上处理)
let eventTimes = [];  // 最近一秒内处理过的事件时刻(QPS 闸)
// [S62] 内存冷却影子:两条事件背靠背到达时,第二条的 listRules 可能在第一条 markRuleFired 落库之前就读完 → 两条都判「不在冷却」。
//       决定触发的那一刻同步记下 ruleId→时刻(在任何 await 之前),同一冷却期内的并发事件据此跳过。
const recentlyFired = new Map();

export function setAutomationDeps(next){
	deps = next && typeof next === 'object' ? next : {};
}

export function matchRule(rule, detail){
	if(!rule || rule.enabled !== true || rule.event !== (detail && detail.event)){ return false; }
	const m = rule.match || {};
	const p = (detail && detail.payload) || {};
	// [Q-294/M-109·AR-06] 「只在 命盘/事盘」只对 record.saved 有意义(其余事件载荷无 kind 或 kind 为任务类别):
	//   已存规则里残留的 kind 在其它事件上忽略,不再让整条规则永不触发(变更说明:此类规则从「永不触发」变为按事件触发)
	if(m.kind && rule.event === 'record.saved' && `${p.kind || ''}` !== `${m.kind}`){ return false; }
	if(m.technique && `${p.technique || ''}` !== `${m.technique}`){ return false; }
	if(m.toolName && `${p.toolName || ''}` !== `${m.toolName}`){ return false; }
	if(m.contains && `${JSON.stringify(p)}`.indexOf(`${m.contains}`) < 0){ return false; }
	return true;
}

export function isCoolingDown(rule, now){
	if(!rule || !rule.lastFiredAt || !rule.cooldownMs){ return false; }
	const last = Date.parse(rule.lastFiredAt);
	if(!last){ return false; }
	return (now || Date.now()) - last < rule.cooldownMs;
}

// 一次事件的处理:回 { fired:[ruleId], skipped:[{ruleId,reason}] }(测试直接断言)
export async function handleAutomationEvent(detail, opts){
	const out = { fired: [], skipped: [] };
	if(!isAutomationEnabled()){ return { ...out, off: true }; }
	const origin = `${(detail && detail.payload && detail.payload.origin) || ''}`;
	if(origin === 'automation'){ return { ...out, depthGuard: true }; }
	// [A1] 链深度:本事件若是某条自动化动作同步发出的,depth = 该动作所处深度 + 1;超过上限即掐断(与 origin 无关)
	const depth = chainDepth;
	if(depth > MAX_CHAIN_DEPTH){ return { ...out, chainGuard: true, depth }; }
	// [A2] 每秒事件闸:同步判定(在任何 await 之前),风暴里多出来的事件零成本跳过
	const now = (opts && opts.now) || Date.now();
	eventTimes = eventTimes.filter((t)=>now - t < 1000);
	if(eventTimes.length >= MAX_EVENTS_PER_SEC){ return { ...out, rateLimited: true }; }
	eventTimes.push(now);
	let rules = [];
	try{ rules = await listRules(); }catch(e){ return { ...out, error: 'rules-unavailable' }; }
	const runners = buildActionRunners((opts && opts.deps) || deps);
	const matched = rules.filter((r)=>matchRule(r, detail));
	for(let i = 0; i < matched.length; i += 1){
		const rule = matched[i];
		if(out.fired.length >= MAX_RULES_PER_EVENT){ out.skipped.push({ ruleId: rule.id, reason: 'max-per-event' }); continue; }
		const memAt = recentlyFired.get(rule.id);
		if(isCoolingDown(rule, now) || (rule.cooldownMs && memAt !== undefined && now - memAt < rule.cooldownMs && now >= memAt)){ out.skipped.push({ ruleId: rule.id, reason: 'cooldown' }); continue; }
		// [A3] 尝试即计冷却:动作恒失败的规则不再每来一条事件就重试一次 + 刷一条通知(内存影子先于落库同步写下)
		recentlyFired.set(rule.id, now);
		// eslint-disable-next-line no-await-in-loop
		try{ await markRuleFired(rule.id, new Date(now).toISOString()); }catch(e){ reportBackgroundFailure('automation.mark-fired', e); }   // 记录失败不影响本次,但留痕
		let anyRan = false;
		for(let k = 0; k < rule.actions.length; k += 1){
			const action = rule.actions[k];
			// deny 只在 tool.before 的同步通道生效(vetoDecision);异步这一路对它静默跳过,不算失败不发通知
			if(action && action.type === 'deny'){ continue; }
			const run = runners[action.type];
			if(typeof run !== 'function'){ await notifyActionFailure(rule, action, '未知动作类型'); continue; }
			try{
				// 动作的同步前半段在 depth+1 上执行(它同步发出的事件带上链深度);首个 await 之后立刻恢复,不把深度泄漏给无关事件
				const prevDepth = chainDepth;
				chainDepth = depth + 1;
				let p;
				try{ p = Promise.resolve(run(action, detail)); }finally{ chainDepth = prevDepth; }
				// eslint-disable-next-line no-await-in-loop
				const r = await p;
				if(r && r.ok){ anyRan = true; }
				else{ await notifyActionFailure(rule, action, (r && r.reason) || '动作未执行'); }
			}catch(e){
				// eslint-disable-next-line no-await-in-loop
				await notifyActionFailure(rule, action, (e && e.message) || `${e}`);
			}
		}
		if(anyRan){ out.fired.push(rule.id); }
		else{ out.skipped.push({ ruleId: rule.id, reason: 'all-actions-failed' }); }
	}
	return out;
}

export function bindAutomationEngine(next){
	if(next){ setAutomationDeps(next); }
	if(unbind){ return unbind; }
	unbind = subscribeAutomationEvents((detail)=>{ handleAutomationEvent(detail).catch((e)=>reportBackgroundFailure('automation.event', e)); });
	unbindVeto = subscribeAutomationVeto(vetoDecision);
	unbindRules = subscribeRulesChanged(()=>{ refreshRulesCache().catch((e)=>reportBackgroundFailure('automation.rules', e)); });
	refreshRulesCache().catch((e)=>reportBackgroundFailure('automation.rules', e));
	return unbind;
}

export function __resetAutomationEngineForTests(){
	if(unbind){ try{ unbind(); }catch(e){ /* noop: 测试重置,拆订阅失败无害 */ } }
	if(unbindVeto){ try{ unbindVeto(); }catch(e){ /* noop: 测试重置,拆订阅失败无害 */ } }
	if(unbindRules){ try{ unbindRules(); }catch(e){ /* noop: 测试重置,拆订阅失败无害 */ } }
	unbind = null; unbindVeto = null; unbindRules = null; deps = {}; chainDepth = 0; eventTimes = []; recentlyFired.clear(); rulesCache = null;
}
