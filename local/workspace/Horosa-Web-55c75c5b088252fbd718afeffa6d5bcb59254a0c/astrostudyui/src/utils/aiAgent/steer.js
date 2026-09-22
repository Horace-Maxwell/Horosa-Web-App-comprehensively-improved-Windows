// AI 助手·插话队列(借鉴 Claude Code 流式期间继续打字 = 下一轮生效):按「正在生成的助手消息 id」排队,
// 运行时每轮开始 takeSteer 一次(取即清);未被消费的插话随 Turn 结束一起丢(不进历史、不进账本)。零 import,纯内存。
export const STEER_PREFIX = '[用户插话]';
export const STEER_MAX_PER_TURN = 3;
export const STEER_TEXT_MAX = 500;
export const STEER_EVENT = 'horosa:agent-steer-changed';
const queues = new Map();   // assistantId → [text]

function emit(){
	try{ if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function'){ window.dispatchEvent(new CustomEvent(STEER_EVENT)); } }catch(e){ /* noop */ }
}

export function pushSteer(key, text){
	const k = `${key || ''}`; const t = `${text || ''}`.trim().slice(0, STEER_TEXT_MAX);
	if(!k || !t){ return false; }
	const q = queues.get(k) || [];
	if(q.length >= STEER_MAX_PER_TURN){ return false; }
	q.push(t); queues.set(k, q); emit();
	return true;
}
export function peekSteer(key){ return (queues.get(`${key || ''}`) || []).slice(); }
// 取即清:同一轮不重复消费
export function takeSteer(key){
	const k = `${key || ''}`; const q = queues.get(k) || [];
	if(!q.length){ return ''; }
	queues.delete(k); emit();
	return q.join(';');
}
// (此前这里有 clearSteer(key) 全仓零调用:插话队列取即清,已删 —— D19 死导出族。)
export function steerLine(text){ return `${STEER_PREFIX} ${`${text || ''}`.trim()}`; }
export function subscribeSteer(fn){
	if(typeof window === 'undefined' || typeof fn !== 'function'){ return ()=>{}; }
	const h = ()=>fn();
	window.addEventListener(STEER_EVENT, h);
	return ()=>window.removeEventListener(STEER_EVENT, h);
}
export function __resetSteerForTests(){ queues.clear(); }
