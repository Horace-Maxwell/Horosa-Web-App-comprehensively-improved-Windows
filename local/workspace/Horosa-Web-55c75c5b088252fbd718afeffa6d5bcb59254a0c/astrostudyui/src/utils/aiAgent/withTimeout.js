// AI 助手·工具执行超时原语(零数据层 import;运行时与外部桥共用)。
// 超时只让等待方继续,不取消底层 promise;调用方可给 options.onTimeout(到点先回调再拒绝),用它 abort 传给工具的信号,
// 否则工具本体若无内超时仍会在后台跑完(外部桥超时后写入照常落地 = 客户端重试即重复建档)。
export function withTimeout(promise, ms, options){
	const code = options && options.code ? options.code : 'E_TOOL_TIMEOUT';
	const message = options && options.message ? options.message : '工具执行超时';
	const onTimeout = options && typeof options.onTimeout === 'function' ? options.onTimeout : null;
	let t = null;
	// 先拒绝再回调:race 的拒绝反应先入队,调用方拿到的是 E_TOOL_TIMEOUT(而不是被 abort 后工具自己回的 E_ABORTED),随后信号才 abort
	const timeout = new Promise((_, reject)=>{ t = setTimeout(()=>{ reject(Object.assign(new Error(message), { code })); if(onTimeout){ try{ onTimeout(); }catch(e){ /* noop: 取消回调抛错不影响超时落定 */ } } }, ms); });
	return Promise.race([promise, timeout]).finally(()=>{ if(t){ clearTimeout(t); } });
}

// 外部桥超时预算:取客户端 _meta.timeoutMs(钳 1s..30 分钟),再减 3s 让页面先于壳侧超时回话,缺省 120s。
// 硬顶 = 目录里声明得最长的同步工具(30 分钟);桌面壳 MAX_TOOL_TIMEOUT、无头协议层 timeoutOf 同一个数。
export const BRIDGE_TIMEOUT_DEFAULT_MS = 120000;
export const BRIDGE_TIMEOUT_MAX_MS = 1800000;
export function bridgeTimeoutMs(meta, fallbackMs){
	const base = fallbackMs || BRIDGE_TIMEOUT_DEFAULT_MS;
	const raw = meta && Number.isFinite(Number(meta.timeoutMs)) && Number(meta.timeoutMs) > 0 ? Number(meta.timeoutMs) : base;
	const clamped = Math.min(Math.max(raw, 1000), BRIDGE_TIMEOUT_MAX_MS);
	return Math.max(1000, clamped - 3000);
}
// 客户端没给预算时的缺省:工具自己声明得比 120 s 长就按它(钳到硬顶;与桌面壳投来的同值,页面照旧减 3 s 收口),否则 120 s。
//   此前一律 120 s:声明 3–30 分钟的同步长工具在客户端不带 _meta.timeoutMs 时 117 s 就被中止,
//   而多数 MCP 客户端没有地方填这个值。
export function bridgeFallbackMs(declaredMs){
	const d = Number(declaredMs);
	return Number.isFinite(d) && d > BRIDGE_TIMEOUT_DEFAULT_MS ? Math.min(d, BRIDGE_TIMEOUT_MAX_MS) : BRIDGE_TIMEOUT_DEFAULT_MS;
}
