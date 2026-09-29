// [#84] 双触发收敛 · 全站通用件(WP-G「同签名第二路跳过」的通用化)。
//
// 病根:不少技法页同时挂了两条刷新路 —— 模型 doHook 的挂钩回调(hook.fun,下一帧跑)与组件自身的
// componentDidUpdate(props.fields / props.value 换新)。同一次取盘两路各进一次重算:同参请求 / 计算做两遍,
// 第二遍把第一遍的中间结果作废重来,加载态被拖长(2026-09-25 真浏览器调试日志点实测:七政 / 太乙 / 巴比伦 /
// 十年运 / 量化盘三页 / 皇极 / 灵棋 / 神易数 / 太玄 / 五兆 / 数算 各 2–3 遍)。
//
// 规则(调用方在【真正开工前】认领):
//   · 签名 = 本次真要发出 / 真要计算的输入(调用方用请求体、读到的 state 项、源对象身份构造);
//   · 与同一 owner、同一 slot「最近一次已认领、且未失败」的签名相同,且距那次认领不到 WINDOW_MS → 跳过;
//   · 比「最近一次已认领」而非「最近一次完成」:A→B→A 快速来回时第三下与在途的 B 不同 → 照常发;
//   · 失败由调用方 settleTrigger(…, false) 报回 → 清签名,同参可立即重试;
//   · 时间窗兜底:同参的「有意重发」(手动重算等)隔窗照常执行,本件只收敛同一拍里的重复触发;
//   · 开关 horosa.perf.singleTrigger = '0' → 恒放行(逐拍回旧双跑)。
import { flagEnabled } from './perfFlags';

export const SINGLE_TRIGGER_WINDOW_MS = 2000;

const registry = new WeakMap();   // owner(组件实例)→ { [slot]: { sig, token, at, failed } }
let tokenSeq = 0;

export function singleTriggerEnabled(){
	return flagEnabled('horosa.perf.singleTrigger');
}

function nowMs(){
	try{
		if(typeof performance !== 'undefined' && typeof performance.now === 'function'){ return performance.now(); }
	}catch(e){ /* ignore */ }
	return Date.now();
}

/** 对象身份编号(同一对象恒同号,不持有对象)—— 签名里用来表达「是不是同一个 fields / 同一张盘」。 */
const identities = new WeakMap();
let identitySeq = 0;
export function identityOf(obj){
	if(!obj || (typeof obj !== 'object' && typeof obj !== 'function')){ return String(obj); }
	let id = identities.get(obj);
	if(!id){ identitySeq += 1; id = `#${identitySeq}`; identities.set(obj, id); }
	return id;
}

/**
 * 认领一次触发。返回 >0 的令牌 = 应当执行;返回 0 = 与最近一次同签名的认领重复,调用方直接返回。
 * sig 为空(null / undefined / '')时恒放行且不登记。
 */
export function claimTrigger(owner, slot, sig){
	tokenSeq += 1;
	const token = tokenSeq;
	if(!owner || !slot || sig === null || sig === undefined || sig === ''){ return token; }
	let slots = registry.get(owner);
	if(!slots){ slots = {}; registry.set(owner, slots); }
	const prev = slots[slot];
	const t = nowMs();
	if(singleTriggerEnabled() && prev && prev.sig === sig && !prev.failed && (t - prev.at) < SINGLE_TRIGGER_WINDOW_MS){
		return 0;
	}
	slots[slot] = { sig, token, at: t, failed: false };
	return token;
}

/** 报告一次认领的结果;只有「最近一次认领」本人报失败才清签名(被新认领顶替的旧调用报什么都不影响)。 */
export function settleTrigger(owner, slot, token, ok){
	if(!owner || !slot || !token){ return; }
	const slots = registry.get(owner);
	const cur = slots && slots[slot];
	if(cur && cur.token === token && !ok){ cur.failed = true; }
}

/** 测试用:清某 owner 的登记。 */
export function __resetSingleTrigger(owner){
	if(owner){ registry.delete(owner); }
}
