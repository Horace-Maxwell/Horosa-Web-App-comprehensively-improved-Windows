// [B1] 前后端启动重叠 boot-gate。
//
// 桌面壳温启快路径现在「静态服务器一起来就导航前端」(URL 带 early=1),Java/Python 仍在
// 引导——umi 下载/解析/启动与后端引导并行,首屏提前数秒。代价:umi 启动期的自动请求
// (默认盘/日历等)会打到尚未监听的端口。本门在【发 fetch 之前】按目标根探活:
//   · 有响应(任意状态码,no-cors opaque 也算)= 该根已监听 → 放行并永久记账(零后续开销);
//   · 连接被拒/超时 = 未起 → 350ms 后重试,直到就绪或 90s 兜底放行(交给既有离线横幅/自愈)。
//   · 壳的收尾 ready(同参不重载)会置 window.__horosaBackendConfirmed → 全根立即放行。
// 非 early 模式(dev/公网构建/旧壳/开关关)earlyMode=false,waitForBackendBoot 同步返回,
// 全链路零行为变化。L1/L2/L3 缓存命中在 requestDedupe 层先于 runner 返回,不经本门——
// 温启时已看过的盘从 IndexedDB 即刻可渲染,无须等后端。
import { bootGateEnabled } from './perfFlags';

const RETRY_MS_DEFAULT = 350;
const GIVE_UP_MS_DEFAULT = 90000;
const PROBE_TIMEOUT_MS = 1500;

let retryMs = RETRY_MS_DEFAULT;
let giveUpMs = GIVE_UP_MS_DEFAULT;
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
			for(;;){
				if(shellConfirmed()){
					break;
				}
				// eslint-disable-next-line no-await-in-loop
				const up = await probeOnce(root);
				if(up){
					break;
				}
				if(Date.now() - t0 > giveUpMs){
					break;   // 兜底放行:后端确实没起时交给既有错误机制(横幅/自愈/重试)
				}
				// eslint-disable-next-line no-await-in-loop
				await sleep(retryMs);
			}
			readyRoots.add(root);
			waiters.delete(root);
		})();
		waiters.set(root, waiter);
	}
	await waiter;
}

/** 测试用:清缓存态并可注入时序参数(生产代码勿调)。 */
export function __resetBackendBootGateForTest(timing){
	earlyModeCache = null;
	readyRoots.clear();
	waiters.clear();
	retryMs = (timing && timing.retryMs) || RETRY_MS_DEFAULT;
	giveUpMs = (timing && timing.giveUpMs) || GIVE_UP_MS_DEFAULT;
}
