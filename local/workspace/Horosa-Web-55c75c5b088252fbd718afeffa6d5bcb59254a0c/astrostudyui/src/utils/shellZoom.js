// 壳级缩放的**启动传输层**——桌面壳把用户缩放经 URL query(shellZoom)确定性送达页面
// (随导航天然到达正确 document/origin;localStorage 键由壳每次换档写入,页面自刷新时兜底)。
// 浏览器/dev 无 query 无键 → 恒 1,零影响。
//
// 🔴 这里读到的只是「页面启动那一刻该用哪个档」,**不是运行期真值**。⌘± 运行时换档走壳的
// __HOROSA_APPLY_SHELL_ZOOM(只改 documentElement.style.zoom + 写键,**不改 URL**),所以 query 在页面
// 生命周期内恒为启动旧值。运行期「现在是几档」的唯一真值 = 文档根上真实挂着的 inline zoom
// (zoomDomain.getDeclaredZoom)。把本文件的读数当运行期真值用 = 用户调回 100% 后全站浮层按旧档补偿
// (错位 (1/z0−1)·(D+999))、布局视口缓存命中旧档、盘面按虚大视口定尺寸被底栏裁。

import { safeLocalStorageSet } from './safeStorage';

const KEY = 'horosa.shell.zoom';

function readQueryZoom(){
	try{
		const m = /[?&]shellZoom=([0-9.]+)/.exec(window.location.search || '');
		if(m){
			const v = Number(m[1]);
			if(v && v > 0 && v < 10){ return v; }
		}
	}catch(e){ /* ignore */ }
	return null;
}

function readStoredZoom(){
	try{
		const v = Number(window.localStorage.getItem(KEY));
		if(v && v > 0 && v < 10){ return v; }
	}catch(e){ /* ignore */ }
	return null;
}

// 这次导航是不是页面自刷新(location.reload / 错误边界重载 / 恢复备份后重载)。
function isReloadNavigation(){
	try{
		const nav = performance.getEntriesByType('navigation')[0];
		if(nav && typeof nav.type === 'string'){ return nav.type === 'reload'; }
	}catch(e){ /* ignore */ }
	try{ return !!(performance.navigation && performance.navigation.type === 1); }catch(e){ return false; }
}

// 纯函数:启动档位决策(真值表可单测)。
//   壳导航(navigate) → query 为准:壳带来的就是它此刻的档;
//   页面自刷新(reload)→ 键为准:URL 还是启动那一刻的旧 query,而壳每次换档都写键(键 = 最新);
//   键缺席/非法时 reload 也退回 query;两源皆无 → 1。
export function resolveBootstrapZoom(src){
	const o = src || {};
	const ok = (v)=> (typeof v === 'number' && v > 0 && v < 10 && isFinite(v));
	const q = ok(o.query) ? o.query : null;
	const st = ok(o.stored) ? o.stored : null;
	if(o.reload && st !== null){ return { zoom: st, from: 'stored' }; }
	if(q !== null){ return { zoom: q, from: 'query' }; }
	if(st !== null){ return { zoom: st, from: 'stored' }; }
	return { zoom: 1, from: 'none' };
}

// 页面启动档位(global.js 在包顶第一时间把它镜像到 documentElement.style.zoom)。来源为 query 时顺带落键,
// 使下一次自刷新有键可读;来源为键时不回写(避免拿旧 query 冲掉壳刚写的最新键)。
export function readBootstrapShellZoom(){
	const r = resolveBootstrapZoom({ query: readQueryZoom(), stored: readStoredZoom(), reload: isReloadNavigation() });
	if(r.from === 'query'){ safeLocalStorageSet(KEY, String(r.zoom)); }
	return r.zoom;
}

// 旧名保留(语义 = 启动档位,**不是**运行期真值;运行期请用 zoomDomain.getDeclaredZoom)。
export function getShellZoom(){
	return readBootstrapShellZoom();
}

// 布局视口尺寸:窗口到底给了多少**布局**像素。
//
// 🔴 2026-08-27 根修。此前的写法是 `innerHeight / 实测缩放`,而那个"实测缩放"量的是
// **rect 缩放**——旧 MacBook(Safari 26.2)上 rect 根本不反映 zoom,探针恒测得 1,
// 于是等于没除,整页被配矮 ⇒ 奇门 / 三式合一两页与主工作区同款底部死带。
//
// 正解不是换个更准的缩放值,而是**根本不去问缩放**:一个 position:fixed;inset:0 的
// 元素,其 offsetWidth/offsetHeight 就是布局视口尺寸,在任何 zoom 语义下都直接成立。
// 实测(物理 720):z=0.7/0.8/0.9/1.2/1.8 → 1029/900/800/600/400,恰为 720/z。
// 详见 zoomDomain.measureLayoutViewport 的注释与 layoutDomainGuard 三引擎真值表。
function layoutViewport(){
	try{
		// eslint-disable-next-line global-require
		const { measureLayoutViewport } = require('./zoomDomain');
		return measureLayoutViewport();
	}catch(e){ return null; }
}

export function getLayoutViewportHeight(){
	const vp = layoutViewport();
	if(vp && vp.height > 0){ return vp.height; }
	// 量不到(未布局/SSR)时退物理读数:缩放≠1 时偏小,但偏小只是版面略紧,好过拿错值。
	try{ return Math.round(window.innerHeight) || 0; }catch(e){ return 0; }
}

export function getLayoutViewportWidth(){
	const vp = layoutViewport();
	if(vp && vp.width > 0){ return vp.width; }
	try{ return Math.round(window.innerWidth) || 0; }catch(e){ return 0; }
}

export const SHELL_ZOOM_STORAGE_KEY = KEY;
