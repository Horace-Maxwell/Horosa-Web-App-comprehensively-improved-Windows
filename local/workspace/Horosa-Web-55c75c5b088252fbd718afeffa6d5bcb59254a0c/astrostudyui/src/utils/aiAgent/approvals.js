// AI 助手·审批档(on-request)的等待台:运行时把待确认的写入动作挂在这里,动作条渲染「允许/跳过」按钮解决它。
// 纯内存(刷新即清),与账本无关;总开关关或审批档 never 时永不入台。
// 表键 = `${messageKey}::${callId}`:文本协议的 callId 缺省 c1/c2…,目标任务与对话轮并发时同 id 会互相顶掉(先到者永不落定直到 abort);
// 按名落定/按 id 落定都只在本消息键内(D23:此前「本会话不再问」会把后台任务/外部客户端的同名待审一并静默批准)。
const pending = new Map();   // `${messageKey}::${callId}` → { resolve, call, messageKey, timer, preview }
const lastReason = new Map();   // 同键 → 'user' | 'timeout' | 'abort'(落定原因,供桥按原因出码;有界)
const REASON_CAP = 200;
function keyOf(messageKey, callId){ return `${messageKey === undefined || messageKey === null ? '' : messageKey}::${callId === undefined || callId === null ? '' : callId}`; }
function noteReason(key, reason){
	lastReason.set(key, reason);
	if(lastReason.size > REASON_CAP){ lastReason.delete(lastReason.keys().next().value); }
}
function settle(key, allowed, reason){
	const p = pending.get(key);
	if(!p){ return false; }
	pending.delete(key);
	if(p.timer){ clearTimeout(p.timer); }
	noteReason(key, reason || 'user');
	try{ p.resolve(!!allowed); }catch(e){ /* noop */ }
	emit();
	return true;
}
export const AGENT_APPROVAL_EVENT = 'horosa:agent-approval-changed';

function emit(){
	try{
		if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function'){
			window.dispatchEvent(new CustomEvent(AGENT_APPROVAL_EVENT, { detail: { count: pending.size } }));
		}
	}catch(e){ /* noop */ }
}

// options.timeoutMs:[G8] 到点按「未允许」落定并撤台(目标/定时任务的等审批不再永远挂在动作条上);缺省无超时(页面主线由用户/停止收口)
export function requestApproval(messageKey, call, options){
	const o = options || {};
	return new Promise((resolve)=>{
		const key = keyOf(messageKey, call && call.callId);
		const entry = { resolve, call, messageKey, timer: null, preview: call && call.preview && typeof call.preview === 'object' ? call.preview : null };
		pending.set(key, entry);
		emit();
		// 用户点「停止」:运行时的等待已被信号解开,这里同步把待审条目撤台,动作条不再残留「允许/跳过」
		const signal = call && call.signal;
		if(signal && typeof signal.addEventListener === 'function'){
			if(signal.aborted){ settle(key, false, 'abort'); return; }
			signal.addEventListener('abort', ()=>{ settle(key, false, 'abort'); }, { once: true });
		}
		const ms = Number(o.timeoutMs);
		if(Number.isFinite(ms) && ms > 0){ entry.timer = setTimeout(()=>{ settle(key, false, 'timeout'); }, ms); }
	});
}

// [P1·2026-09-08] 同名待审一并落定:「本会话不再问 / 永久放行」点一次,同轮并行排队的同名调用不再各问一次;返回落定条数。
// (此前这里有个 cancelPendingApprovals(messageKey) 全仓零调用:会话切换/停止由 abort 信号撤台,已删。)
// messageKey 给定 ⇒ 只落定该消息键内的同名待审(动作条/任务中心必传);不给 ⇒ 跨键(仅测试/旧调用方)。
export function resolveApprovalsByName(name, allowed, messageKey){
	const n0 = `${name || ''}`;
	let n = 0;
	Array.from(pending.entries()).forEach(([key, p])=>{
		if(!n0 || !p.call || p.call.name !== n0){ return; }
		if(messageKey !== undefined && p.messageKey !== messageKey){ return; }
		settle(key, !!allowed, 'user'); n += 1;
	});
	return n;
}

// messageKey 给定 ⇒ 精确落定;不给 ⇒ 按 callId 落定所有同 id 条目(旧签名兼容:同 id 只可能一条时语义不变)
export function resolveApproval(callId, allowed, messageKey){
	if(messageKey !== undefined){ return settle(keyOf(messageKey, callId), allowed, 'user'); }
	let hit = false;
	Array.from(pending.entries()).forEach(([key, p])=>{
		if(p.call && `${p.call.callId}` === `${callId}`){ hit = settle(key, allowed, 'user') || hit; }
	});
	return hit;
}

// 落定原因(桥据此出码:timeout ⇒ E_TOOL_TIMEOUT / user·abort ⇒ E_USER_SKIPPED),此前桥用「耗时 ≥ 预算」猜,到点前点跳过也可能被判超时
export function approvalReasonOf(messageKey, callId){
	return lastReason.get(keyOf(messageKey, callId)) || null;
}

export function listPendingApprovals(messageKey){
	// [D71] 条目带 level:任务中心「请求执行 / 请求写入」文案此前读 a.level 恒 undefined ⇒ 恒「请求写入」(D27 文案死路径)
	return Array.from(pending.values()).filter((p)=>!messageKey || p.messageKey === messageKey).map((p)=>({ callId: p.call.callId, messageKey: p.messageKey, name: p.call.name, level: p.call.level, args: p.call.args, preview: p.preview || null }));
}

export function subscribeApprovals(fn){
	if(typeof window === 'undefined' || typeof fn !== 'function'){ return ()=>{}; }
	const h = ()=>fn(pending.size);
	window.addEventListener(AGENT_APPROVAL_EVENT, h);
	return ()=>window.removeEventListener(AGENT_APPROVAL_EVENT, h);
}

export function __resetApprovalsForTests(){
	pending.forEach((p)=>{ if(p.timer){ clearTimeout(p.timer); } try{ p.resolve(false); }catch(e){ /* noop */ } });
	pending.clear();
	lastReason.clear();
}
