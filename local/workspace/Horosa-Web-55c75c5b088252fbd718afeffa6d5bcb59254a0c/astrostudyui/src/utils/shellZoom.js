// 壳级缩放单源 util——桌面壳把用户缩放经 URL query(shellZoom)确定性送达页面
// (随导航天然到达正确 document/origin;localStorage 仅作页面自刷新兜底,origin 内有效)。
// 浏览器/dev 无 query 无键 → 恒 1,零影响。

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

// 当前壳缩放:query 优先(壳导航实时值,顺带落键),键兜底,缺省 1。
export function getShellZoom(){
	const q = readQueryZoom();
	if(q !== null){
		safeLocalStorageSet(KEY, String(q));
		return q;
	}
	const s = readStoredZoom();
	return s !== null ? s : 1;
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
