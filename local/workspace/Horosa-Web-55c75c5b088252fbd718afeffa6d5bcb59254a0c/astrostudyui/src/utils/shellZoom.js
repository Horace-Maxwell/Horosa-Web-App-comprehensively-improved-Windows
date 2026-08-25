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
//
// 🔴 [Tahoe 根治] 除数从**声明值**(getShellZoom:query/localStorage)改为**实测值**
// (zoomDomain.getEffectiveScale:探针实测引擎到底缩放了没有)。两者在正常路径相等,
// 行为一字不变;而在「壳声明了缩放但引擎未生效」的环境(旧 WKWebView 疑似如此)下,
// 按声明值除会制造反向错位——那是一个可能一直存在的隐患,改实测后自动消失。
// getShellZoom() 语义与签名保持不变(它表达"用户选的档位",别处在用)。
// 惰性 require 破循环:zoomDomain 反过来要用本模块的 getShellZoom 作声明值回落。
function effectiveScale(){
	try{
		// eslint-disable-next-line global-require
		const { getEffectiveScale } = require('./zoomDomain');
		const s = getEffectiveScale();
		return (s && s > 0) ? s : 1;
	}catch(e){
		const z = getShellZoom();
		return z || 1;
	}
}

export function getLayoutViewportHeight(){
	return Math.round(window.innerHeight / effectiveScale());
}

export function getLayoutViewportWidth(){
	return Math.round(window.innerWidth / effectiveScale());
}

export const SHELL_ZOOM_STORAGE_KEY = KEY;
