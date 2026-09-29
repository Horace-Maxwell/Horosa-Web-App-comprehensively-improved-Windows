// [R5 P0-1] 前端启动账本:把「umi 主包开始执行 / 首帧已提交 / 主导航可点 / 首张盘已提交 / 就绪门放行」
// 五段写进壳侧四层启动账本(horosa-startup-ledger.jsonl,layer=web)。此前账本止于 rust.emit_ready,
// 前端段全无 → 「用户何时能点、何时看到盘」无据,启动优化只能盯后端。
// 语义:纯观测,零行为影响 ——
//   · 浏览器 preview / 公网构建(无桥)同步 no-op;老壳没有 web_ledger_mark_command 时 invoke 抛错静默;
//   · 每段只记一次(重复调用 no-op);
//   · 时刻取 performance.now()(不靠 rAF:离屏隐藏窗 rAF 停摆会丢样本)+ Date.now()(壳按 run 标签里的
//     epoch 把它折算到与 rust.* 同一 t_ms 尺度,ladder report 档直接汇总);
//   · 总关 = 壳 HOROSA_STARTUP_LEDGER=0(账本未初始化时壳侧直接丢弃)。
import { isDesktopBridgeAvailable, invokeDesktopCommand } from './aiAnalysisDesktop';

const SEG_RE = /^web\.[a-z0-9_]{1,40}$/;
const marked = new Set();

export const WEB_LEDGER_SEGS = Object.freeze({
	umiExec: 'web.umi_exec',
	firstRender: 'web.first_render',
	navInteractive: 'web.nav_interactive',
	firstChartPaint: 'web.first_chart_paint',
	bootGateOpen: 'web.boot_gate_open',
	staticCache: 'web.static_cache',   // [R5 N2] 首屏静态资源缓存命中观测(extra: hit/total/cachedBytes/totalBytes)
});

function nowSinceNav(){
	try{
		if(typeof performance !== 'undefined' && typeof performance.now === 'function'){
			return Math.round(performance.now());
		}
	}catch(e){ /* 无 performance */ }
	return null;
}

/**
 * 记一段前端启动时刻。
 * @param {string} seg 段名,必须形如 web.xxx(小写字母/数字/下划线,≤40)
 * @param {object} [extra] 附加字段(只放不含个人数据的小对象)
 * @returns {boolean} 本次是否真的上报(首次且有桥)
 */
export function markWebLedger(seg, extra){
	const name = `${seg || ''}`;
	if(!SEG_RE.test(name)){ return false; }
	if(marked.has(name)){ return false; }
	marked.add(name);
	const sinceNavMs = nowSinceNav();
	const atEpochMs = Date.now();
	if(!isDesktopBridgeAvailable()){ return false; }
	const payload = { ...(extra && typeof extra === 'object' ? extra : {}) };
	if(sinceNavMs !== null){ payload.sinceNavMs = sinceNavMs; }
	try{
		const p = invokeDesktopCommand('web_ledger_mark_command', { seg: name, atEpochMs, extra: payload });
		if(p && typeof p.catch === 'function'){ p.catch(()=>{ /* 老壳无此命令 */ }); }
	}catch(e){ /* 老壳无此命令 */ }
	return true;
}

/** 测试用:清「已记段」集合(生产代码勿调)。 */
/**
 * [R5 N2] 静态缓存命中观测:首屏可交互后统计同源静态资源(js/css/字体/图)里「零传输字节、有解码字节」的条数
 * (= 内存 / 磁盘缓存命中;桌面壳静态服务的 immutable + ETag 策略是否真的生效,装机账本一读便知)。
 * 只在桌面桥在场时写账本;没有 Resource Timing 或无桥 → 静默。返回 {hit,total,cachedBytes,totalBytes} 或 null(供测试)。
 */
export function markStaticCacheStats(){
	try{
		if(typeof performance === 'undefined' || typeof performance.getEntriesByType !== 'function'){ return null; }
		const origin = (typeof location !== 'undefined' && location.origin) ? location.origin : '';
		const entries = performance.getEntriesByType('resource') || [];
		let hit = 0, total = 0, cachedBytes = 0, totalBytes = 0;
		entries.forEach((e)=>{
			const name = String(e.name || '');
			if(origin && name.indexOf(origin) !== 0){ return; }
			if(!/\.(js|css|woff2?|ttf|otf|png|jpe?g|gif|svg|webp|json|wasm)(\?|$)/i.test(name)){ return; }
			const decoded = Number(e.decodedBodySize) || 0;
			const transfer = Number(e.transferSize) || 0;
			total += 1;
			totalBytes += decoded;
			if(transfer === 0 && decoded > 0){ hit += 1; cachedBytes += decoded; }
		});
		const extra = { hit, total, cachedBytes, totalBytes };
		markWebLedger(WEB_LEDGER_SEGS.staticCache, extra);
		return extra;
	}catch(e){ return null; }
}

export function __resetWebLedgerForTest(){
	marked.clear();
}
