// AI 助手·后台链失败留痕(零数据层 import):目标任务自启 / 调度器心跳 / 自动化事件 这些 fire-and-forget 链的 catch
// 不再是 `()=>{}`——环形缓冲 BG_SINK_MAX 条 + 同 tag 节流 warn(排障面板消费);绝不抛、绝不反噬调用点。
export const BG_SINK_MAX = 50;
export const BG_SINK_WARN_THROTTLE_MS = 10000;
const ring = [];
const lastWarnAt = new Map();

export function reportBackgroundFailure(tag, err){
	const at = Date.now();
	const key = `${tag || 'bg'}`;
	const message = err && err.message ? `${err.message}` : `${err}`;
	const entry = { tag: key, message: message.slice(0, 300), code: err && err.code ? `${err.code}` : '', at };
	ring.push(entry);
	if(ring.length > BG_SINK_MAX){ ring.splice(0, ring.length - BG_SINK_MAX); }
	const last = lastWarnAt.get(key) || 0;
	if(at - last >= BG_SINK_WARN_THROTTLE_MS){
		lastWarnAt.set(key, at);
		try{ if(typeof console !== 'undefined' && console.warn){ console.warn(`[horosa-ai:bg] ${key}: ${entry.message}`); } }catch(e){ /* noop */ }
	}
	return entry;
}

// 新在前
export function listBackgroundFailures(){ return ring.slice().reverse(); }

export function __resetBgSinkForTests(){ ring.length = 0; lastWarnAt.clear(); }
