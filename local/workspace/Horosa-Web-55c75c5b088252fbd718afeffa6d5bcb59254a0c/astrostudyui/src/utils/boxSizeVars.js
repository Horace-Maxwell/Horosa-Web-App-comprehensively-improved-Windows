// 「按容器大小换版式 / 取字号」的统一做法:直接量容器(布局域 clientWidth / clientHeight),把结果写成 CSS 变量与开关属性。
//
// 为什么不用容器查询 / cq 单位:系统浏览器内核在文档缩放(壳的 ⌘± 缩放)下 cq 单位按**视觉像素**算(1.8 档 10cqi = 18px),
// 尺寸条件换档后也不按 CSS px 重算(印占 1.5 档 113px 的格不命中 150px 条件),与 CSS 像素口径不一致(真内核实测);
// 这里只读 clientWidth / clientHeight(天生布局域),任何缩放语义下都成立,也不需要知道缩放档。
//
// 用法(类组件):构造里 this.boardSizeRef = boxSizeVarsRef((w, h, el)=>({ vars: { '--x': `${w}px` }, attrs: { 'data-compact': w < 300 } }));
//               render 里 <div ref={this.boardSizeRef}>。直接写 DOM,不触发 React 重渲染;尺寸变化经延帧 ResizeObserver 跟进。
import { createDeferredResizeObserver } from './deferredResizeObserver';
import { registerZoomSyncRemeasure } from './zoomSyncRemeasure';

export function applyBoxSizeVars(el, compute){
	if(!el || typeof compute !== 'function'){
		return;
	}
	const w = el.clientWidth || 0;
	const h = el.clientHeight || 0;
	if(!(w > 0 && h > 0)){
		return;   // 隐藏页签里 0×0:保留上一次读数
	}
	const res = compute(w, h, el) || {};
	const vars = res.vars || {};
	Object.keys(vars).forEach((k)=>{
		const v = vars[k];
		if(el.style.getPropertyValue(k) !== `${v}`){
			el.style.setProperty(k, `${v}`);
		}
	});
	const attrs = res.attrs || {};
	Object.keys(attrs).forEach((k)=>{
		const on = !!attrs[k];
		if(on !== el.hasAttribute(k)){
			if(on){ el.setAttribute(k, ''); }else{ el.removeAttribute(k); }
		}
	});
}

export function boxSizeVarsRef(compute){
	let el = null;
	let ro = null;
	let unreg = null;
	const apply = ()=>applyBoxSizeVars(el, compute);
	return (node)=>{
		if(ro){ ro.disconnect(); ro = null; }
		if(unreg){ unreg(); unreg = null; }
		el = node || null;
		if(el){
			apply();
			ro = createDeferredResizeObserver(apply);
			if(ro){ ro.observe(el); }
			unreg = registerZoomSyncRemeasure(apply);   // 换档当拍同步跟进(延帧观察器兜底其余尺寸变化)
		}
	};
}

// 一个组件里有多块盘(各自 ref)时按 key 各建一只,挂在组件实例上复用(render 里调用,不会每次新建 → 不会反复挂卸观察)。
export function ownedBoxSizeRef(owner, key, compute){
	const slot = `__boxSizeRef_${key}`;
	if(!owner[slot]){
		owner[slot] = boxSizeVarsRef(compute);
	}
	return owner[slot];
}

// 卜 · 其他各盘(太玄 / 神易数 / 荆诀 / 数算各盘 / 五兆 / 小六壬 / 小成图 / 飞宫)的窄盘版式:盘宽 < 480 px 时挂 data-board-narrow
// (文卡退单列、多列卡格降列数、卡格给底线由宿主横滚)。常规宽度不挂,一字不变。
export const NARROW_BOARD_WIDTH = 480;
export function narrowBoardVars(w){
	return { attrs: { 'data-board-narrow': w < NARROW_BOARD_WIDTH } };
}

// 方盘(南印 / 分盘集 / 盘面美术南印):4×4 格,格边长 = 盘短边 / 4。
// 格子小于常规版式能容纳的尺寸(单盘 150、分盘集 80 px)时挂 data-isq-compact,样式改紧凑版式、字号按 --isq-cell 取。
export const INDIA_SQUARE_COMPACT_CELL = 150;
export const INDIA_SQUARE_COMPACT_CELL_MULTI = 80;
export function indiaSquareSizeVars(w, h, el){
	const cell = Math.min(w, h) / 4;
	const multi = !!(el && el.closest && el.closest('.horosa-india-varga-grid-multi'));
	const limit = multi ? INDIA_SQUARE_COMPACT_CELL_MULTI : INDIA_SQUARE_COMPACT_CELL;
	return {
		vars: { '--isq-cell': `${Math.round(cell * 10) / 10}px` },
		// 盘边 ≤ 360(放大档 × 小窗):中宫放不下「分盘徽标 + 名称 + 说明」三件 → 收紧徽标与字号、隐去说明行
		attrs: { 'data-isq-compact': cell < limit, 'data-isq-tiny': w <= 360 },
	};
}

// 菱形 / 三角格盘(北印 / 东印):盘边 < INDIA_DIAGRAM_COMPACT_BOARD 时挂 data-idg-compact,写 --idg-u(= 盘边 1%)。
// 紧凑版式下:宫号 / 座符 / 行星块各归本格内互不相交的锚区(锚区坐标由盘组件以 --idg-c* 变量给出),字号按 --idg-u 取,
// 行星块按锚区实测等比缩到放得下(fitIndiaDiagramObjects)—— 不再让行星字越过对角线、宫号压行星、座符压中宫标题。
// 常规尺寸不挂,一字不变。
export const INDIA_DIAGRAM_COMPACT_BOARD = 600;
export function indiaDiagramSizeVars(w, h){
	const side = Math.min(w, h);
	return {
		vars: { '--idg-u': `${Math.round(side) / 100}px` },
		attrs: { 'data-idg-compact': side < INDIA_DIAGRAM_COMPACT_BOARD },
	};
}

// 行星块装进锚区:按子项布局域偏移(不受缩放 / 变换影响)量内容外接框,缩放比 = min(1, 锚宽 / 内容宽, 锚高 / 内容高);
// 三曜及以上再试两列,取缩得少的一种。非紧凑态清掉一切内联量(回到常规版式)。
export function fitIndiaDiagramObjects(board){
	if(!board || !board.querySelectorAll){
		return;
	}
	const compact = board.hasAttribute('data-idg-compact');
	board.querySelectorAll('.horosa-india-diagram-object-anchor').forEach((anchor)=>{
		const box = anchor.querySelector('.horosa-india-diagram-objects');
		if(!box){ return; }
		box.style.removeProperty('--idg-fit');
		box.style.removeProperty('grid-template-columns');
		if(!compact){ return; }
		const aw = anchor.clientWidth;
		const ah = anchor.clientHeight;
		const kids = Array.from(box.children);
		if(!(aw > 0 && ah > 0) || !kids.length){ return; }
		const scaleFor = ()=>{
			let l = Infinity; let t = Infinity; let r = -Infinity; let b = -Infinity;
			kids.forEach((k)=>{
				const x = k.offsetLeft; const y = k.offsetTop;
				l = Math.min(l, x); t = Math.min(t, y); r = Math.max(r, x + k.offsetWidth); b = Math.max(b, y + k.offsetHeight);
			});
			const cw = r - l; const ch = b - t;
			return (cw > 0 && ch > 0) ? Math.min(1, aw / cw, ah / ch) : 1;
		};
		let best = scaleFor();
		let cols = '';
		if(kids.length >= 3 && best < 1){
			box.style.setProperty('grid-template-columns', 'repeat(2, max-content)');
			const two = scaleFor();
			if(two > best + 0.02){ best = two; cols = 'repeat(2, max-content)'; }
			if(!cols){ box.style.removeProperty('grid-template-columns'); }
		}
		if(best < 1){ box.style.setProperty('--idg-fit', `${Math.floor(best * 1000) / 1000}`); }
	});
}

// 盘组件用:ref 回调 + .refit()(数据变了而盘尺寸没变时由 componentDidUpdate 调)。字体晚到(星座符号字体)也重装一次。
export function indiaDiagramBoardRef(){
	let el = null;
	let ro = null;
	const run = ()=>{
		if(!el){ return; }
		applyBoxSizeVars(el, indiaDiagramSizeVars);
		fitIndiaDiagramObjects(el);
	};
	const ref = (node)=>{
		if(ro){ ro.disconnect(); ro = null; }
		el = node || null;
		if(el){
			run();
			ro = createDeferredResizeObserver(run);
			if(ro){ ro.observe(el); }
			if(typeof document !== 'undefined' && document.fonts && document.fonts.ready && document.fonts.ready.then){
				document.fonts.ready.then(run, ()=>{});
			}
		}
	};
	ref.refit = run;
	return ref;
}
