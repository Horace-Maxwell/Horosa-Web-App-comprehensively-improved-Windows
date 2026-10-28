// ResizeObserver 的统一入口:回调挪到下一帧(requestAnimationFrame)执行,同一帧内多次通知合并成一次。
//
// 为什么:RO 回调里**同步**改尺寸(setState 重排、改 style、重画撑开容器)会让被观察元素在同一帧里再变一次,
// 浏览器只好丢弃这批通知并报「ResizeObserver loop completed with undelivered notifications」(遁甲 / 三式 / AI 进阶等页实抓);
// 丢掉的那次通知还可能让版面停在旧尺寸。回调延到下一帧后,改尺寸发生在本帧通知送达之后,不再构成回环。
//
// 用法与原生一致:const ro = createDeferredResizeObserver((entries)=>{ ... }); ro.observe(el); ro.disconnect();
// 回调拿到的 entries = 这一帧内每个目标的最后一条记录(按目标去重,顺序同首次出现)。
// 没有 RO 的环境(jsdom / 旧引擎)返回 null —— 调用方照旧做 typeof ResizeObserver 判空的兜底。

const raf = (fn)=>(typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : setTimeout(fn, 16));
const caf = (h)=>(typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame(h) : clearTimeout(h));

// ── 换档帧同步重量登记表 ──
// 延帧让换档(⌘±)后的第一帧仍按旧尺寸排:紫微 / 策天 / 三式 / 合盘 / 风水 / 3D 等按观察器重排的盘晚 1–2 帧才到终值(肉眼是「跳一下」)。
// 每个延帧观察器在 observe 时自动登记;工作区容器观察器(models/app.js,观察最外层 #mainContent)在**换档帧**里同步完工作区高之后
// 调 runZoomFrameResizeObservers():逐个观察器按目标现量 {target, contentRect} 同步调一次回调 —— 首帧即终值。
// 不构成回环:工作区观察器看的是最外层容器,这里各回调改的都是它的后代(更深层);同步跑过的尺寸在随后到达的原生通知里按值剔掉,不再重复跑。
// 非换档帧照旧延到下一帧(拖窗、内容变高等)。
const zoomFrameRegistry = new Set();

function contentRectOf(el){
	let w = 0;
	let h = 0;
	try{
		w = el.clientWidth || 0;
		h = el.clientHeight || 0;
		const cs = (typeof getComputedStyle === 'function') ? getComputedStyle(el) : null;
		if(cs){
			w -= (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
			h -= (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
		}
	}catch(e){ /* 量不到按 0 */ }
	w = Math.max(0, w);
	h = Math.max(0, h);
	return { x: 0, y: 0, top: 0, left: 0, width: w, height: h, right: w, bottom: h };
}

// opts.changedOnly:只跑「目标现量与上次同步跑时不同」的观察器 —— 换档帧里第一遍回调改了版面(滚动条冒出、盘面加宽)后,
// 再按现量补跑一遍受影响的,直到不再变(调用方循环,见 models/app.js)。
export function runZoomFrameResizeObservers(opts){
	const changedOnly = !!(opts && opts.changedOnly);
	let n = 0;
	Array.from(zoomFrameRegistry).forEach((obs)=>{
		try{ if(obs.__horosaZoomSync(changedOnly)){ n += 1; } }catch(e){ /* 单个回调失败不影响其余 */ }
	});
	return n;
}

export function __zoomFrameRegistrySize(){
	return zoomFrameRegistry.size;
}

export function createDeferredResizeObserver(callback){
	if(typeof ResizeObserver === 'undefined' || typeof callback !== 'function'){
		return null;
	}
	let handle = null;
	let scheduled = false;   // 单独一个布尔:raf 若同步回调(测试桩 / 兜底实现),handle 赋值晚于 flush,不能拿它判「已排队」
	let pending = new Map();
	let alive = true;
	let ro = null;
	let facade = null;
	const targets = new Set();
	let synced = new Map();   // 换档帧里同步跑过的「目标 → 尺寸」:随后到达的原生通知若尺寸相同就剔掉
	const flush = ()=>{
		scheduled = false;
		handle = null;
		if(!alive){ return; }
		const entries = Array.from(pending.values());
		pending = new Map();
		if(entries.length){
			callback(entries, facade);
		}
	};
	ro = new ResizeObserver((entries)=>{
		for(const e of entries){
			const s = synced.get(e.target);
			if(s){
				synced.delete(e.target);
				const cr = e.contentRect || {};
				if(Math.abs((cr.width || 0) - s.width) < 0.5 && Math.abs((cr.height || 0) - s.height) < 0.5){ continue; }
			}
			pending.set(e.target, e);
		}
		if(!pending.size){ return; }
		if(!scheduled){
			scheduled = true;
			const h = raf(flush);
			if(scheduled){ handle = h; }
		}
	});
	// 门面对象:observe / unobserve 直通原生实例;disconnect 同时作废已排队的回调
	facade = {
		observe: (...args)=>{ alive = true; if(args[0]){ targets.add(args[0]); } zoomFrameRegistry.add(facade); return ro.observe(...args); },
		unobserve: (...args)=>{ targets.delete(args[0]); if(!targets.size){ zoomFrameRegistry.delete(facade); } return ro.unobserve(...args); },
		disconnect: ()=>{
			alive = false;
			if(handle !== null){ caf(handle); handle = null; }
			scheduled = false;
			pending = new Map();
			targets.clear();
			synced = new Map();
			zoomFrameRegistry.delete(facade);
			ro.disconnect();
		},
		// 换档帧同步通道(见 runZoomFrameResizeObservers):按目标现量同步调一次回调,并撤掉本帧已排的延帧回调
		__horosaZoomSync: (changedOnly)=>{
			if(!alive || !targets.size){ return false; }
			const list = [];
			let changed = false;
			targets.forEach((t)=>{
				if(t && t.isConnected !== false){
					const cr = contentRectOf(t);
					const prev = synced.get(t);
					if(!prev || Math.abs(prev.width - cr.width) >= 0.5 || Math.abs(prev.height - cr.height) >= 0.5){ changed = true; }
					list.push({ target: t, contentRect: cr });
					synced.set(t, { width: cr.width, height: cr.height });
				}
			});
			if(!list.length || (changedOnly && !changed)){ return false; }
			if(handle !== null){ caf(handle); handle = null; }
			scheduled = false;
			pending = new Map();
			callback(list, facade);
			return true;
		},
	};
	return facade;
}

// 第三方组件(antd 表格)的观察器垫片:表格固定表头 / 横向滚动时,rc-table 在表内放一行「量列宽」的单元格并用 RO 观察,
// 回调在同一帧里改列宽(微任务里 setState)→ 被观察的单元格与表格自身在同帧再变一次 → 回环报错(星运主限表 0.8 档进页实抓:
// 小数像素下列宽量测来回;把表内目标的通知挪到下一帧送达即消失,不改表格外任何观察器的时机)。
// 页签导航同族:rc-tabs 观察导航条 / 页签列表量溢出与墨条,回调里同步 setState 改导航尺寸 —— 导航高停在小数像素上(38 ↔ 37 来回)、
// 或 display:none 保活的页签整块藏起(0×0 连发两次)时同帧再变一次 → 回环报错(页内视图切换带出 / 藏起一组页签、风水纳气 → 理气派切换实抓)。
// 规则:凡某次通知里有目标在延帧范围(.ant-table / .ant-tabs-nav)之内,这次通知整批挪到下一帧送达(同帧多次合并,按目标保留最后一条);其余照原生同步送达。
// 回退阀:localStorage['horosa.compat.tableRoDefer']='0'(诊断用)。重复安装只装一次。
export const THIRD_PARTY_RO_DEFER_SCOPE = '.ant-table, .ant-tabs-nav';
export function installTableResizeObserverDefer(win){
	const w = win || (typeof window !== 'undefined' ? window : null);
	if(!w || typeof w.ResizeObserver !== 'function' || w.ResizeObserver.__horosaTableDefer){
		return false;
	}
	try{ if(w.localStorage && w.localStorage.getItem('horosa.compat.tableRoDefer') === '0'){ return false; } }catch(e){ /* 读不到按开 */ }
	const Native = w.ResizeObserver;
	const inTable = (el)=>!!(el && typeof el.closest === 'function' && el.closest(THIRD_PARTY_RO_DEFER_SCOPE));
	const wraf = (fn)=>(typeof w.requestAnimationFrame === 'function' ? w.requestAnimationFrame(fn) : setTimeout(fn, 16));
	function Wrapped(callback){
		let pending = null;
		let self = null;
		const inner = new Native((entries, obs)=>{
			let hit = false;
			for(let i = 0; i < entries.length; i += 1){ if(inTable(entries[i].target)){ hit = true; break; } }
			if(!hit && !pending){ callback.call(self || obs, entries, self || obs); return; }
			const first = !pending;
			pending = pending || new Map();
			for(const e of entries){ pending.set(e.target, e); }
			if(first){
				wraf(()=>{ const list = Array.from(pending.values()); pending = null; if(list.length){ callback.call(self || obs, list, self || obs); } });
			}
		});
		self = this;
		this.observe = (...a)=>inner.observe(...a);
		this.unobserve = (...a)=>inner.unobserve(...a);
		this.disconnect = ()=>{ pending = null; inner.disconnect(); };
	}
	Wrapped.prototype = Native.prototype;
	Wrapped.__horosaTableDefer = true;
	Wrapped.__native = Native;
	w.ResizeObserver = Wrapped;
	return true;
}

export default createDeferredResizeObserver;
