// [B1] 前后端启动重叠 boot-gate。
//
// 桌面壳温启快路径现在「静态服务器一起来就导航前端」(URL 带 early=1),Java/Python 仍在
// 引导——umi 下载/解析/启动与后端引导并行,首屏提前数秒。代价:umi 启动期的自动请求
// (默认盘/日历等)会打到尚未监听的端口。本门在【发 fetch 之前】按目标根探活:
//   · 有响应(任意状态码,no-cors opaque 也算)= 该根已监听 → 放行并永久记账(零后续开销);
//   · 连接被拒/超时 = 未起 → 50ms 后重试(perfFlag bootGateFastRetry 关=350ms),直到就绪或 90s 兜底放行(交给既有离线横幅/自愈)。
//   · 壳的收尾 ready(同参不重载)会置 window.__horosaBackendConfirmed 并派 horosa:backend-confirmed 事件 → 全根立即放行。
// 非 early 模式(dev/公网构建/旧壳/开关关)earlyMode=false,waitForBackendBoot 同步返回,
// 全链路零行为变化。L1/L2/L3 缓存命中在 requestDedupe 层先于 runner 返回,不经本门——
// 温启时已看过的盘从 IndexedDB 即刻可渲染,无须等后端。
import { bootGateEnabled, bootGateFastRetryEnabled } from './perfFlags';
import { markWebLedger } from './startupLedger';

// [R5 S2] 就绪门事件化:壳收尾 ready 置 __horosaBackendConfirmed 的同时派本事件,等待中的请求立即放行
// (此前只在循环顶部查旗标,后端就绪后首盘平均多等半个重试间隔);探活重试 350→50ms(perfFlag 可回旧)。
export const BACKEND_CONFIRMED_EVENT = 'horosa:backend-confirmed';
const RETRY_MS_DEFAULT = 350;
const RETRY_FAST_MS = 50;
const GIVE_UP_MS_DEFAULT = 90000;
// [R5 S8] 更新后首次启动(壳 URL 带 firstLaunch=1):后端要走一次运行时恢复/预热,门的兜底放行同步拉长,
// 否则 90 s 一到请求直发全数报错(与壳的旧序「splash 全程可见」等价的等待窗)。
// 取值对齐启动脚本的就绪总上限(start_horosa_local.sh READY_TOTAL_CAP_SECS=900:预算 300 s 用完仍有进展会续命到 900 s),
// 不能早于它放行 —— 否则慢机上脚本还在续命、页面已把排队请求打到未起的端口。
const GIVE_UP_MS_POST_UPDATE = 900000;
const PROBE_TIMEOUT_MS = 1500;

let retryMs = null;   // null=按 perfFlag 取 50/350;测试可注入
let giveUpMs = null;  // null=按启动上下文取 90 s / 更新后首启 900 s;测试可注入
let bootContextCache = null;

/**
 * [R5 S8] 壳经 URL 送来的启动上下文(只读一次):early=1 提前导航;firstLaunch=1 更新后首启;boot=壳启动 epoch 毫秒
 * (与启动账本 run 标签同源,让页面里的「已用时」从壳启动起算而不是从页面挂载起算)。非桌面 / 无参一律 false / null。
 */
export function bootContext(){
	if(bootContextCache !== null){
		return bootContextCache;
	}
	let ctx = { early: false, firstLaunch: false, bootStartedAtMs: null };
	try{
		if(typeof window !== 'undefined' && window.location){
			const params = new URLSearchParams(window.location.search || '');
			const boot = Number(params.get('boot'));
			ctx = {
				early: params.get('early') === '1',
				firstLaunch: params.get('firstLaunch') === '1',
				bootStartedAtMs: Number.isFinite(boot) && boot > 0 ? boot : null,
			};
		}
	}catch(e){ /* 保守:当作无上下文 */ }
	bootContextCache = ctx;
	return ctx;
}

function currentGiveUpMs(){
	if(giveUpMs !== null){ return giveUpMs; }
	return bootContext().firstLaunch ? GIVE_UP_MS_POST_UPDATE : GIVE_UP_MS_DEFAULT;
}

function currentRetryMs(){
	if(retryMs !== null){ return retryMs; }
	return bootGateFastRetryEnabled() ? RETRY_FAST_MS : RETRY_MS_DEFAULT;
}

// 睡 ms,或壳确认事件先到即醒(一次性监听;无 window 时退化为纯 sleep)。
function sleepOrConfirmed(ms){
	return new Promise((resolve)=>{
		let done = false;
		let timer = null;
		const finish = ()=>{
			if(done){ return; }
			done = true;
			if(timer !== null){ clearTimeout(timer); }
			try{ window.removeEventListener(BACKEND_CONFIRMED_EVENT, finish); }catch(e){ /* 无 window */ }
			resolve();
		};
		try{ window.addEventListener(BACKEND_CONFIRMED_EVENT, finish); }catch(e){ /* 无 window */ }
		timer = setTimeout(finish, ms);
	});
}
let earlyModeCache = null;
const readyRoots = new Set();
const waiters = new Map();

function shellConfirmed(){
	try{
		return typeof window !== 'undefined' && !!window.__horosaBackendConfirmed;
	}catch(e){
		return false;
	}
}

export function isEarlyBootMode(){
	if(earlyModeCache !== null){
		return earlyModeCache;
	}
	try{
		if(typeof window === 'undefined' || !window.location){
			earlyModeCache = false;
			return false;
		}
		const params = new URLSearchParams(window.location.search || '');
		earlyModeCache = params.get('early') === '1' && bootGateEnabled();
	}catch(e){
		earlyModeCache = false;
	}
	return earlyModeCache;
}

function sleep(ms){
	return new Promise((resolve)=>setTimeout(resolve, ms));
}

// 探活一次:no-cors GET 根路径。resolve(true)=对端有响应(在听);resolve(false)=拒连/超时。
// no-cors 的意义:探活只关心「端口是否有人应答」,不关心 CORS 头——普通 fetch 在 CORS 失败与
// 拒连时抛同形 TypeError 无法区分,opaque 模式则「有应答必 fulfilled」。
function probeOnce(root){
	return new Promise((resolve)=>{
		let settled = false;
		const done = (ok)=>{ if(!settled){ settled = true; resolve(ok); } };
		try{
			const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
			const timer = setTimeout(()=>{
				done(false);
				try{ if(ctrl){ ctrl.abort(); } }catch(e2){ /* 已判定 */ }
			}, PROBE_TIMEOUT_MS);
			fetch(`${root}/`, {
				method: 'GET',
				mode: 'no-cors',
				cache: 'no-store',
				...(ctrl ? { signal: ctrl.signal } : {}),
			}).then(()=>{
				clearTimeout(timer);
				done(true);
			}, ()=>{
				clearTimeout(timer);
				done(false);
			});
		}catch(e){
			done(false);
		}
	});
}

/**
 * 在真实网络请求前调用:early 模式下等待目标根就绪;其余场景同步 no-op。
 * @param {string} url 即将请求的绝对 URL(相对/坏 URL 不设门)
 */
export async function waitForBackendBoot(url){
	if(!isEarlyBootMode()){
		return;
	}
	let root = null;
	try{
		root = new URL(`${url}`, (typeof window !== 'undefined' && window.location) ? window.location.href : undefined).origin;
	}catch(e){
		return;
	}
	// 同源(静态服务器自身)与非 http 根不设门
	if(!root || root === 'null' || !/^https?:/.test(root)){
		return;
	}
	try{
		if(typeof window !== 'undefined' && window.location && root === window.location.origin){
			return;
		}
	}catch(e){ /* 照常设门 */ }
	if(readyRoots.has(root)){
		return;
	}
	if(shellConfirmed()){
		readyRoots.add(root);
		return;
	}
	let waiter = waiters.get(root);
	if(!waiter){
		waiter = (async ()=>{
			const t0 = Date.now();
			let via = 'probe';
			for(;;){
				if(shellConfirmed()){
					via = 'confirmed';
					break;
				}
				// eslint-disable-next-line no-await-in-loop
				const up = await probeOnce(root);
				if(up){
					break;
				}
				if(Date.now() - t0 > currentGiveUpMs()){
					via = 'giveup';
					break;   // 兜底放行:后端确实没起时交给既有错误机制(横幅/自愈/重试)
				}
				// eslint-disable-next-line no-await-in-loop
				await sleepOrConfirmed(currentRetryMs());
			}
			readyRoots.add(root);
			waiters.delete(root);
			// [R5 P0-1] 首个根放行即「就绪门放行」段(startupLedger 自去重,只记第一次)
			markWebLedger('web.boot_gate_open', { via, waitedMs: Date.now() - t0 });
		})();
		waiters.set(root, waiter);
	}
	await waiter;
}

/** 测试用:当前生效的探活重试间隔(生产代码勿调)。 */
export function __bootGateRetryMsForTest(){
	return currentRetryMs();
}

/** 测试用:清缓存态并可注入时序参数(生产代码勿调)。 */
export function __resetBackendBootGateForTest(timing){
	earlyModeCache = null;
	bootContextCache = null;
	readyRoots.clear();
	waiters.clear();
	retryMs = (timing && timing.retryMs) || null;
	giveUpMs = (timing && timing.giveUpMs) || null;
}
/** 测试用:当前生效的兜底放行上限(生产代码勿调)。 */
export function __bootGateGiveUpMsForTest(){
	return currentGiveUpMs();
}
