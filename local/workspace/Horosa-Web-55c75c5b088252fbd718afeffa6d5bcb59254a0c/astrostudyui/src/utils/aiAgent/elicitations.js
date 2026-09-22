// AI 助手·反问等待台(elicitation):模型缺料时经 ask_user 工具向用户提问,运行时把问题挂在这里,
// 动作条渲染输入框/选项 + 提交/拒绝解决它;外部客户端(MCP)的 ask_user 同样经本台弹到本机界面。
// 纯内存(刷新即清),与账本无关;超时/用户停止/拒绝都以明确结果解开等待,绝不永久挂起。
// 表键 = `${messageKey}::${callId}`(与审批台同纪律:并发轮同 callId 不互相顶掉;被顶掉的条目此前 done 早退于 !pending.has ⇒ 永不落定)
const pending = new Map();   // `${messageKey}::${callId}` → { done, req, messageKey, timer, at }
function keyOf(messageKey, callId){ return `${messageKey === undefined || messageKey === null ? '' : messageKey}::${callId === undefined || callId === null ? '' : callId}`; }
export const AGENT_ELICITATION_EVENT = 'horosa:agent-elicitation-changed';
export const ELICIT_DEFAULT_TIMEOUT_MS = 300000;
export const ELICIT_MAX_TIMEOUT_MS = 900000;
export const ELICIT_INPUT_TYPES = ['text', 'choice', 'confirm'];

function emit(){
	try{
		if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function'){
			window.dispatchEvent(new CustomEvent(AGENT_ELICITATION_EVENT, { detail: { count: pending.size } }));
		}
	}catch(e){ /* noop */ }
}

function normalizeReq(req){
	const r = req && typeof req === 'object' ? req : {};
	const inputType = ELICIT_INPUT_TYPES.indexOf(r.inputType) >= 0 ? r.inputType : 'text';
	const options = Array.isArray(r.options) ? r.options.map((x)=>`${x}`).filter(Boolean).slice(0, 8) : [];
	const timeoutMs = Number(r.timeoutMs) > 0 ? Math.min(ELICIT_MAX_TIMEOUT_MS, Number(r.timeoutMs)) : ELICIT_DEFAULT_TIMEOUT_MS;
	return { callId: `${r.callId || ''}`, name: r.name ? `${r.name}` : 'ask_user', question: `${r.question || ''}`.slice(0, 500), inputType, options, placeholder: `${r.placeholder || ''}`.slice(0, 80), timeoutMs };
}

// 返回 Promise<{ answer, choice? } | { declined:true, aborted? } | { timeout:true }>
export function requestElicitation(messageKey, req){
	const q = normalizeReq(req);
	if(!q.callId){ q.callId = `elicit-${Date.now()}-${Math.floor(Math.random() * 1e6)}`; }
	return new Promise((resolve)=>{
		const key = keyOf(messageKey, q.callId);
		const entry = { req: q, messageKey, at: Date.now(), timer: null, done: null };
		entry.done = (v)=>{
			if(pending.get(key) !== entry){ return; }
			pending.delete(key);
			if(entry.timer){ clearTimeout(entry.timer); entry.timer = null; }
			emit();
			try{ resolve(v); }catch(e){ /* noop */ }
		};
		pending.set(key, entry);
		emit();
		entry.timer = setTimeout(()=>entry.done({ timeout: true }), q.timeoutMs);
		const signal = req && req.signal;
		if(signal && typeof signal.addEventListener === 'function'){
			if(signal.aborted){ entry.done({ declined: true, aborted: true }); return; }
			signal.addEventListener('abort', ()=>entry.done({ declined: true, aborted: true }), { once: true });
		}
	});
}

// 用户作答:payload 为字符串=answer;对象可带 answer/choice。
function findEntries(callId, messageKey){
	if(messageKey !== undefined){ const p = pending.get(keyOf(messageKey, callId)); return p ? [p] : []; }
	return Array.from(pending.values()).filter((p)=>`${p.req.callId}` === `${callId}`);
}
export function resolveElicitation(callId, payload, messageKey){
	const list = findEntries(callId, messageKey);
	if(!list.length){ return false; }
	const v = payload && typeof payload === 'object' ? payload : { answer: `${payload === undefined || payload === null ? '' : payload}` };
	list.forEach((p)=>p.done({ answer: v.answer === undefined ? '' : `${v.answer}`, choice: v.choice === undefined ? undefined : `${v.choice}` }));
	return true;
}

export function declineElicitation(callId, messageKey){
	const list = findEntries(callId, messageKey);
	if(!list.length){ return false; }
	list.forEach((p)=>p.done({ declined: true }));
	return true;
}

// (此前这里有个 cancelPendingElicitations(messageKey) 全仓零调用:会话切换/停止由 abort 信号与 declineElicitation 收口,已删 —— D19 死导出族。)

export function listPendingElicitations(messageKey){
	return Array.from(pending.values()).filter((p)=>!messageKey || p.messageKey === messageKey)
		.map((p)=>({ callId: p.req.callId, messageKey: p.messageKey, name: p.req.name, question: p.req.question, inputType: p.req.inputType, options: p.req.options.slice(), placeholder: p.req.placeholder, at: p.at }));
}

export function subscribeElicitations(fn){
	if(typeof window === 'undefined' || typeof fn !== 'function'){ return ()=>{}; }
	const h = ()=>fn(pending.size);
	window.addEventListener(AGENT_ELICITATION_EVENT, h);
	return ()=>window.removeEventListener(AGENT_ELICITATION_EVENT, h);
}

export function __resetElicitationsForTests(){
	Array.from(pending.values()).forEach((p)=>{ try{ p.done({ declined: true, cancelled: true }); }catch(e){ /* noop */ } });
	pending.clear();
}
