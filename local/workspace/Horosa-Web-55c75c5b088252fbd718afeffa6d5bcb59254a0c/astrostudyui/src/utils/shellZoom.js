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

// 布局视口高:innerHeight 恒报物理 CSS px(不随 html zoom),布局域真值须除以壳缩放。
// 1:1 时除 1=恒等。
export function getLayoutViewportHeight(){
	const z = getShellZoom();
	return Math.round(window.innerHeight / (z || 1));
}

export function getLayoutViewportWidth(){
	const z = getShellZoom();
	return Math.round(window.innerWidth / (z || 1));
}

export const SHELL_ZOOM_STORAGE_KEY = KEY;
