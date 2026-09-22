// 布局视口 CSS 变量 —— 全站 vh/vw 的替身。
//
// 🔴 病理(2026-09-17 用户在新机 macOS Tahoe 的 APP 里实报:天文馆底部大白边 / 数据库页右侧空一截、放大后被裁):
//   壳缩放走 documentElement.style.zoom。标准化 zoom 引擎(Tahoe WebKit / Chromium)下,
//   vh / vw 仍按**未缩放的物理视口**解析(100vw = 窗宽 W 的 CSS px),再被 zoom 一起缩放 ⇒
//   画到屏幕上只有 z·W:z<1 右/底留白,z>1 溢出被裁;旧语义引擎(Sequoia 及以前)vh/vw = 布局视口(W/z)反而正确。
//   WebKit 实测(1400×900,z=0.8):fixed 探针 1750 / 100vw 盒 1400 / 渲染 1120(=80%)。
//
// 修法(不认引擎、只认实测,与 zoomDomain.measureLayoutViewport 同一把尺):
//   把「窗口到底给了多少布局像素」量出来,发布成 --horosa-lvw / --horosa-lvh(各为 1% 的 px 值),
//   样式里一律写 calc(N * var(--horosa-lvh, 1vh)) 代替 Nvh。量不到(SSR / body 未就绪)时变量缺席,
//   var() 的回落值 1vh 让样式退回原行为;任何引擎下 1:1 档与 vh 逐位相同(零回归)。
//   壳换档(⌘±)后 __HOROSA_APPLY_SHELL_ZOOM 会派发 resize,这里跟着重量;documentElement 的 style
//   属性变化(zoom 被改)另挂 MutationObserver 兜底。
import { measureLayoutViewport, getDeclaredZoom } from './zoomDomain';

export const LAYOUT_VW_VAR = '--horosa-lvw';
export const LAYOUT_VH_VAR = '--horosa-lvh';

let _installed = false;
let _lastZoom = null;
let _scheduled = false;

function hasDom(){
	return typeof window !== 'undefined' && typeof document !== 'undefined' && !!document.documentElement;
}

// 量一次、写一次。返回本次发布的布局视口({width,height})或 null(量不到:变量撤下,样式回落 vh/vw)。
export function publishLayoutViewportVars(){
	if(!hasDom()){ return null; }
	const root = document.documentElement;
	let vp = null;
	try{ vp = measureLayoutViewport(); }catch(e){ vp = null; }
	try{
		if(vp && vp.width > 0 && vp.height > 0){
			root.style.setProperty(LAYOUT_VW_VAR, (vp.width / 100) + 'px');
			root.style.setProperty(LAYOUT_VH_VAR, (vp.height / 100) + 'px');
		}else{
			root.style.removeProperty(LAYOUT_VW_VAR);
			root.style.removeProperty(LAYOUT_VH_VAR);
		}
	}catch(e){ /* style 不可写(极旧引擎):保持回落 */ }
	try{ _lastZoom = getDeclaredZoom(); }catch(e){ _lastZoom = null; }
	return vp;
}

// 合帧:同一帧多次触发(resize 连发 / 壳换档 + resize)只量一次。
export function scheduleLayoutViewportVars(){
	if(!hasDom() || _scheduled){ return; }
	_scheduled = true;
	const run = () => { _scheduled = false; publishLayoutViewportVars(); };
	try{
		if(typeof window.requestAnimationFrame === 'function'){ window.requestAnimationFrame(run); return; }
	}catch(e){ /* fallthrough */ }
	setTimeout(run, 0);
}

// 幂等安装:首帧 + DOMContentLoaded + load + resize + documentElement style 变更(zoom 被壳改写)。
// 返回卸载函数(测试用);重复调用不重复挂监听。
export function installLayoutViewportVars(){
	if(!hasDom()){ return () => {}; }
	if(_installed){ return () => {}; }
	_installed = true;
	publishLayoutViewportVars();
	const onResize = () => scheduleLayoutViewportVars();
	const onReady = () => scheduleLayoutViewportVars();
	window.addEventListener('resize', onResize);
	window.addEventListener('load', onReady);
	if(document.readyState === 'loading'){ document.addEventListener('DOMContentLoaded', onReady); }
	let mo = null;
	try{
		if(typeof MutationObserver === 'function'){
			mo = new MutationObserver(() => {
				// 我们自己 setProperty 也会触发本回调:只有声明缩放真变了才重量,防自激。
				let z = null;
				try{ z = getDeclaredZoom(); }catch(e){ z = null; }
				if(z !== _lastZoom){ scheduleLayoutViewportVars(); }
			});
			mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
		}
	}catch(e){ mo = null; }
	return () => {
		_installed = false;
		window.removeEventListener('resize', onResize);
		window.removeEventListener('load', onReady);
		document.removeEventListener('DOMContentLoaded', onReady);
		if(mo){ try{ mo.disconnect(); }catch(e){ /* ignore */ } }
	};
}

// 测试用:重置模块态。
export function __resetLayoutViewportVarsForTests(){
	_installed = false;
	_lastZoom = null;
	_scheduled = false;
}
