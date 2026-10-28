// 换档当拍同步重量(单源):壳换档函数在改完文档缩放后同步派发一次 window 'resize'。
// 按盘量尺寸的组件(boxSizeVars 写开关属性 / 变量、按像素绘制的 svg 盘重画)原本只靠延帧观察器跟进 ——
// 换档后第一帧盘面还按旧尺寸排(六爻盘缩成一小块、印占方盘晚一帧挂紧凑版式),肉眼是「跳一下」。
// 这里在那次 resize 事件里同步把登记的量盘函数各跑一次(事件回调里改属性 / 重画不构成观察器回环);
// 量盘函数各自有「值没变不写 / 签名没变不重画」的守卫,不变时零开销。延帧观察器照旧兜底(窗口拖动、内容变高等)。
import { getDeclaredZoom } from './zoomDomain';

const fns = new Set();
let installed = false;

let zoomFrame = false;   // 本帧发生过换档(下一帧末清掉):盘面观察器在这一帧里收到的尺寸通知就地重画,不再等下一帧
let lastZoom = null;     // 上一次 resize 时的声明缩放:只有它真变了才算换档帧

// 置位入口只认**换档**:壳换档函数写完文档缩放后同步派发的那次 resize 里,声明缩放与上一次不同。
// 此前任何 window resize(含壳每次拖窗补发的 resize 桥)都置位 → 拖窗时盘面观察器在通知回调里同步重画
// → 舞台滚动条冒出 / 收回 → 宿主宽在同一帧里来回变 → 「ResizeObserver loop」(六壬 1.8 档拖窗高实抓)。
// 换档帧里文档根挂 horosa-zoom-switching:这几帧不跑 CSS 过渡(版面随档位变,带 grid-template-columns / 宽高过渡的栅格会把新尺寸动画 0.28s,
// 换档后要好几帧才到终值 —— 天文馆实抓)。标志清掉时值已是终值,不会再起过渡。
const SWITCHING_CLASS = 'horosa-zoom-switching';
export function markZoomChangeFrame(){
	if(zoomFrame){ return; }
	zoomFrame = true;
	try{ document.documentElement.classList.add(SWITCHING_CLASS); }catch(e){ /* ignore */ }
	// 清标志要等到下一帧的动画回调:本帧的动画回调先于观察器通知执行,当帧清掉就等于没开
	const later = (fn)=>(typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : setTimeout(fn, 16));
	later(()=>later(()=>{ zoomFrame = false; try{ document.documentElement.classList.remove(SWITCHING_CLASS); }catch(e){ /* ignore */ } }));
}

function onResize(){
	fns.forEach((fn)=>{ try{ fn(); }catch(e){ /* 单个量盘失败不影响其余 */ } });
	let z = 1;
	try{ z = getDeclaredZoom(); }catch(e){ z = 1; }
	if(lastZoom !== null && Math.abs(z - lastZoom) > 0.0005){ markZoomChangeFrame(); }
	lastZoom = z;
}

// 换档这一帧:工作区高等 React 状态在同一帧稍后才落(工作区观察器当帧同步),盘面 svg 的尺寸通知随后到;
// 这一帧内收到的通知就地重画,首帧即按终值排。只用于「重画只改 svg 内容、不改被观察 svg 自身尺寸」的观察器。
export function inZoomChangeFrame(){
	return zoomFrame;
}

// 幂等安装 resize 监听(换档帧判定要在第一次换档之前就挂上:工作区观察器开机即调用,不依赖有没有盘登记量盘函数)
export function installZoomChangeWatch(){
	if(!installed && typeof window !== 'undefined' && typeof window.addEventListener === 'function'){
		window.addEventListener('resize', onResize);
		installed = true;
		try{ lastZoom = getDeclaredZoom(); }catch(e){ lastZoom = 1; }
	}
}

export function registerZoomSyncRemeasure(fn){
	if(typeof fn !== 'function'){
		return ()=>{};
	}
	fns.add(fn);
	installZoomChangeWatch();
	return ()=>{ fns.delete(fn); };
}

export function __zoomSyncRemeasureCount(){
	return fns.size;
}
