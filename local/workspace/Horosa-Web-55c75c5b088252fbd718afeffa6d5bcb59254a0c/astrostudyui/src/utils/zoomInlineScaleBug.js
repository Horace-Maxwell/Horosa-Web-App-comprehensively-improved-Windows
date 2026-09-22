/**
 * 「内联盒按 内容宽×缩放 计算」引擎缺陷的实测探针(2026-09-17,macOS 26 WebKit,z≠1 时复现;Chromium / 旧 WebKit 不复现):
 *  ① 空 textarea 的占位符内盒按 内容宽×z 布局 → 244px 的框 scrollWidth 报 418 且真能横滚;
 *  ② text-overflow:ellipsis 的省略判定拿「文字宽×z」比「盒宽」→ 68px 盒里 "2026" 被画成 "20…",而 DOM 量得 scrollWidth==clientWidth。
 * ② 在 DOM 上量不出来,① 量得出来:两者同族,用 ① 当信号。命中则在 <html> 上挂 class,CSS 侧把 text-overflow 退回 clip(省略判定不再参与,文字按真实宽度画)。
 * z=1、或引擎正确:探针无信号 → 不挂 class → 零改动。声明缩放变化时重测(壳换档 / global.js 镜像都会改 documentElement.style.zoom)。
 * 不认引擎不认版本,只认实测(与 zoomDomain / layoutViewportVars 同一纪律)。
 */
import { getDeclaredZoom } from './zoomDomain';

export const ZOOM_TEXT_BUG_CLASS = 'horosa-zoom-textbug';
const PROBE_WIDTH = 244;
const PROBE_MARGIN = 8;

let _lastKey = null;
let _installed = false;

export function probeZoomInlineScaleBug(){
	if(typeof document === 'undefined' || !document.body){ return false; }
	let ta = null;
	try{
		ta = document.createElement('textarea');
		ta.setAttribute('aria-hidden', 'true');
		ta.tabIndex = -1;
		ta.placeholder = '占位探针';
		ta.style.cssText = 'position:fixed;left:-9999px;top:0;width:' + PROBE_WIDTH + 'px;height:40px;padding:4px 11px;box-sizing:border-box;'
			+ 'white-space:pre-wrap;overflow:auto;resize:none;opacity:0;pointer-events:none;';
		document.body.appendChild(ta);
		const hit = ta.scrollWidth > ta.clientWidth + PROBE_MARGIN;
		return hit;
	}catch(e){
		return false;
	}finally{
		if(ta && ta.parentNode){ try{ ta.parentNode.removeChild(ta); }catch(e){ /* ignore */ } }
	}
}

export function syncZoomTextBugClass(probe){
	if(typeof document === 'undefined' || !document.documentElement){ return false; }
	const z = getDeclaredZoom();
	const key = String(z);
	if(key === _lastKey){ return document.documentElement.classList.contains(ZOOM_TEXT_BUG_CLASS); }
	_lastKey = key;
	const fn = typeof probe === 'function' ? probe : probeZoomInlineScaleBug;
	const hit = (z !== 1) && !!fn();
	try{ document.documentElement.classList.toggle(ZOOM_TEXT_BUG_CLASS, hit); }catch(e){ /* ignore */ }
	return hit;
}

export function installZoomTextBugProbe(){
	if(_installed || typeof window === 'undefined' || typeof document === 'undefined'){ return; }
	_installed = true;
	const run = ()=>{ try{ syncZoomTextBugClass(); }catch(e){ /* ignore */ } };
	if(document.body){ run(); } else { document.addEventListener('DOMContentLoaded', run, { once: true }); }
	window.addEventListener('load', run);
	window.addEventListener('resize', run);
	try{
		const mo = new MutationObserver(run);
		mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
	}catch(e){ /* ignore */ }
}

export function __resetZoomTextBugForTests(){
	_lastKey = null; _installed = false;
	try{ document.documentElement.classList.remove(ZOOM_TEXT_BUG_CLASS); }catch(e){ /* ignore */ }
}
