// 「盘按窗口底封顶」的单源:方盘 / 宿盘这类按「窗口底 − 盘自己的上沿」限高的盘,一律经这里取余高。
//
// 病理:工作区布局下限(宽 960 / 高 488)与盘面最小字下限会让整页比窗口高、外层纵向可滚(放大档矮窗);
// 此时仍按窗口底封顶,就把盘钉在首屏可见高度上 —— 盘比所在栏矮、下面留一截死带,字也跟着缩到 9 px 以下;
// 又因为盘居中、越缩上沿越低,越量越小。
// 口径(与宿盘同一修法):
//   ① 整页可滚(工作区内层的底在窗口底以下;扣掉盘面最小字下限自己加的高度后再判 —— 否则加高一加、封顶一撤、
//      盘一下子变大、加高又撤回,来回抖)→ 不封顶,返回 0,盘由所在栏的宽高定;
//   ② 否则余高 = (窗口底 + 下限加高量 − 盘上沿) ÷ 缩放比例 − gap(布局域);下限加高时窗口底同量下移,盘随加高 1:1 长大,加高量才收敛;
//      opts.footer:页脚在盘下沿与窗口底之间时以页脚上沿为底。
//   常规窗口(整页不滚、没有加高)与此前逐值相同。
import { getEffectiveScale } from './zoomDomain';
import { getChartFloorExtra } from './chartTextFloor';

// 整页是否可滚(扣掉盘面最小字下限自己加的高度后,工作区内层底仍在窗口底之下)
export function pageScrollsBeyondViewport(){
	if(typeof window === 'undefined' || typeof document === 'undefined'){ return false; }
	const viewportH = window.innerHeight || document.documentElement.clientHeight || 0;
	if(!(viewportH > 0)){ return false; }
	const zScale = getEffectiveScale() || 1;
	const floorExtraH = (getChartFloorExtra().height || 0) * zScale;
	const wsInner = document.querySelector('[data-horosa-workspace-inner]');
	return !!(wsInner && wsInner.getBoundingClientRect().bottom - floorExtraH > viewportH + 1);
}

// 元素 el 上沿到窗口底的布局域余高(px);整页可滚 / 量不到 → 0(= 不按窗口底封顶,调用方不把它当候选)
export function viewportRemainHeight(el, gap = 0, opts = {}){
	if(typeof window === 'undefined' || typeof document === 'undefined' || !el || typeof el.getBoundingClientRect !== 'function'){ return 0; }
	const viewportH = window.innerHeight || document.documentElement.clientHeight || 0;
	if(!(viewportH > 0)){ return 0; }
	if(pageScrollsBeyondViewport()){ return 0; }
	const zScale = getEffectiveScale() || 1;
	const floorExtraH = (getChartFloorExtra().height || 0) * zScale;
	const rect = el.getBoundingClientRect();
	let bottomLimit = viewportH + floorExtraH;
	if(opts && opts.footer){
		const footer = document.getElementById('globalFooter');
		if(footer){
			const fr = footer.getBoundingClientRect();
			if(fr.top > rect.top && fr.top < bottomLimit){ bottomLimit = fr.top; }
		}
	}
	// rect.top 与 innerHeight 同属视觉 / 物理域,差值合法;写进布局域尺寸前除回布局域,gap 是布局语义常量放在除后减
	const v = (bottomLimit - rect.top) / zScale - (Number(gap) || 0);
	return v > 0 ? v : 0;
}
