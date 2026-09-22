// AI 助手·通知中心(P1):任务完成/失败/需要你 等事件落 IndexedDB agent_notices(封顶 500,旧的先删);
// 桌面横幅只在 localStorage['horosa.notify.desktop']==='1' 且桌面桥可用时经壳命令弹出。
// [压测二轮·N1] 页面侧先自己限流:桌面横幅令牌桶 DESKTOP_BANNER_PER_MINUTE/分钟 + 同文 DESKTOP_BANNER_DEDUPE_MS 去重
//   (壳侧再限流只是第二道;它管不到 IDB 落库量,也管不到用户看到的 100 个横幅动画)。限的是横幅,通知本身照常全部落库。
// [压测二轮·K4] listNotices 走 createdAt 索引游标(倒序取 limit 条),不再整表 getAll + 全量归一 + 全表排序。
import { reportBackgroundFailure } from '../bgSink';
import { AI_ANALYSIS_STORES, putStoreRecord, listStoreRecordsByIndexCursor, deleteStoreRecord } from '../../aiAnalysisStore';
import { isDesktopBridgeAvailable, desktopShowNotification } from '../../aiAnalysisDesktop';
import { safeLocalStorageGet } from '../../safeStorage';

export const NOTICE_EVENT = 'horosa:agent-notices-changed';
export const NOTICE_MAX = 500;
export const NOTICE_LEVELS = ['info', 'success', 'warn', 'error', 'action'];
export const DESKTOP_NOTIFY_KEY = 'horosa.notify.desktop';

export function isDesktopNotifyEnabled(){
	return safeLocalStorageGet(DESKTOP_NOTIFY_KEY) === '1';
}

function emit(){
	try{ if(typeof window !== 'undefined'){ window.dispatchEvent(new CustomEvent(NOTICE_EVENT)); } }catch(e){ /* noop: DOM 事件派发失败不反噬 */ }
}

export function subscribeNotices(fn){
	if(typeof window === 'undefined' || typeof fn !== 'function'){ return ()=>{}; }
	const h = ()=>fn();
	window.addEventListener(NOTICE_EVENT, h);
	return ()=>window.removeEventListener(NOTICE_EVENT, h);
}

let seqCounter = 0;
export function nextNoticeSeq(){ seqCounter = (seqCounter + 1) % 1000; return Date.now() * 1000 + seqCounter; }

export const DESKTOP_BANNER_PER_MINUTE = 6;
export const DESKTOP_BANNER_DEDUPE_MS = 10000;
let bannerTimes = [];              // 最近一分钟内弹过的横幅时刻
const recentBanners = new Map();   // 文案 → 上次弹出毫秒
export function allowDesktopBanner(text, now){
	const t = Number.isFinite(now) ? now : Date.now();
	bannerTimes = bannerTimes.filter((x)=>t - x < 60000);
	recentBanners.forEach((v, k)=>{ if(t - v >= DESKTOP_BANNER_DEDUPE_MS){ recentBanners.delete(k); } });
	const key = `${text || ''}`;
	if(recentBanners.has(key)){ return false; }
	if(bannerTimes.length >= DESKTOP_BANNER_PER_MINUTE){ return false; }
	bannerTimes.push(t);
	recentBanners.set(key, t);
	return true;
}
export function __resetNoticeThrottleForTests(){ bannerTimes = []; recentBanners.clear(); }

export function normalizeNotice(input){
	const n = input && typeof input === 'object' ? input : {};
	return {
		...n,
		seq: Number.isFinite(n.seq) ? n.seq : 0,
		level: NOTICE_LEVELS.indexOf(n.level) >= 0 ? n.level : 'info',
		title: `${n.title || ''}`.slice(0, 120),
		body: `${n.body || ''}`.slice(0, 1000),
		taskId: n.taskId || null,
		link: n.link || null,
		read: n.read === true,
		desktopShown: n.desktopShown === true,
	};
}

// 落库 + (可选)桌面横幅;返回记录。opts.desktop=false 可禁止本条弹横幅(如批量)
export async function pushNotice(input, opts){
	const rec = normalizeNotice({ ...(input || {}), createdAt: new Date().toISOString(), seq: nextNoticeSeq() });
	let shown = false;
	if(!(opts && opts.desktop === false) && isDesktopNotifyEnabled() && isDesktopBridgeAvailable() && allowDesktopBanner(`${rec.title}\n${rec.body}`)){
		try{
			const r = await desktopShowNotification(rec.title || '星阙', rec.body || '');
			shown = !!(r && r.shown);
		}catch(e){ shown = false; reportBackgroundFailure('notice.desktop', e); }
	}
	const saved = await putStoreRecord(AI_ANALYSIS_STORES.agentNotices, { ...rec, desktopShown: shown }, 'notice');
	emit();
	// 封顶:超出的旧记录异步清理(不阻塞调用方)
	Promise.resolve().then(()=>trimNotices()).catch((e)=>reportBackgroundFailure('notice.trim', e));
	return saved;
}

export async function listNotices(opts){
	const o = opts || {};
	const limit = typeof o.limit === 'number' && o.limit > 0 ? o.limit : 0;
	// createdAt 索引倒序游标:取够 limit 条即停;unreadOnly 在游标上过滤(不取多余的)
	const rows = await listStoreRecordsByIndexCursor(AI_ANALYSIS_STORES.agentNotices, 'createdAt', { direction: 'prev', limit, predicate: (n)=>!o.unreadOnly || n.read !== true });
	const all = (rows || []).map(normalizeNotice);
	// 新在前:seq(同毫秒内单调)优先,旧记录无 seq 时退到 createdAt(同一 createdAt 的一页内按 seq 再排)
	all.sort((a, b)=>(b.seq - a.seq) || `${b.createdAt || ''}`.localeCompare(`${a.createdAt || ''}`));
	return limit ? all.slice(0, limit) : all;
}

export async function unreadCount(){
	return (await listNotices({ unreadOnly: true })).length;
}

export async function markRead(idOrAll){
	const all = await listNotices();
	const targets = idOrAll === 'all' ? all.filter((n)=>!n.read) : all.filter((n)=>n.id === idOrAll && !n.read);
	for(let i = 0; i < targets.length; i++){
		// eslint-disable-next-line no-await-in-loop
		await putStoreRecord(AI_ANALYSIS_STORES.agentNotices, { ...targets[i], read: true }, 'notice');
	}
	if(targets.length){ emit(); }
	return targets.length;
}

export async function trimNotices(max){
	const cap = typeof max === 'number' ? max : NOTICE_MAX;
	const all = await listNotices();
	const extra = all.slice(cap);
	for(let i = 0; i < extra.length; i++){
		// eslint-disable-next-line no-await-in-loop
		await deleteStoreRecord(AI_ANALYSIS_STORES.agentNotices, extra[i].id);
	}
	if(extra.length){ emit(); }
	return extra.length;
}
