// HTML 字层的盘(格子 / 绝对定位摆字的方盘、按列排的命盘表)在栏宽放不下时的统一出路:按设计宽排版,再整体等比缩到栏宽。
//
// 病理:这类盘的列宽跟着栏宽走,字号、字形最小宽、格内距却是写死的 px。放大档(布局视口 = 物理 / z)或窄中栏里
// 栏宽掉到设计宽以下时,「列宽 − 固定字宽」先变负 —— 字逐字竖排、互相叠压、越出格框被裁,
// 按容器比例缩字号的盘心反而越放大字越小(放大是为了看清,字却更小)。
// 修法(放得下时一字不变):
//   ① 栏宽 ≥ 设计宽:外框、内框都是 display:contents(不生成盒子)—— 子块直接排在原父级里,与没有这层包裹逐像素相同;
//   ② 栏宽 < 设计宽:子块按设计宽(及可选的设计高)排版,再用 transform 等比缩到栏宽 —— 字、线、留白同比缩小,
//      不会再出现负宽、叠字与越格;外框高 = 子块布局高 × 比例(量的是子块自己,子块高不依赖外框 → 无观察器回环)。
//      外框不裁(overflow 可见):盘边上有意越出盘框的字(两式方盘四角的图名)缩放后照样看得见;缩放前的布局盒不计入滚动区(滚动区按变换后的几何算)。
//      内框绝对定位(脱离文档流):设计宽不进祖先的「内容最小宽」—— 否则按内容定宽的栏(网格 auto 列 / 弹性项)会被设计宽撑开,
//      栏一宽又判成放得下、退回原样排版,来回翻转(真内核实测:一掌经 1.8 档中栏被撑到 423,盘却按 391 排、格内字被裁)。
//   ③ 缩放态外框挂 data-horosa-html-design-box="scaled":盘面最小字下限(utils/chartTextFloor)在放大档按「缩放后的视觉字号」
//      反推这张盘至少要多宽,不够就加宽工作区(外层横向滚动),直到字回到 9 px 或盘回到设计宽为止。
// 栏宽量父级的内容盒宽(两态同一口径:缩放态外框是 width:100% 的块,宽恰为父级内容宽),观察器走延帧单源(换档帧里同步重量,首帧即终值)。
// 缩放用 transform(不改布局域,浮层定位读 rect 照常成立)。
//   ④ fitHeight(按可用高定边长的盘才开:父级的高与盘内容无关,如地占 is-fit-height 舞台):可用高 < 设计高时也进缩放态,
//      比例取「宽比 ∧ 高比」—— 矮窗口里整盘缩进可用高,不再按宽缩完仍比舞台高、要下滑才看全;高说了算时盘在栏里水平居中。
//      只在 1 档与缩小档生效:放大档盘面最小字下限对缩放态的盘按「宽说了算」反推加宽量,按高缩会让加宽无效(那里照旧向下越出、由外层滚动接住);
//      比例有下限(FIT_HEIGHT_MIN_SCALE):窗口矮到字要缩得看不清时不再硬缩,同样交给外层滚动。
import React, { useLayoutEffect, useRef, useState } from 'react';
import { createDeferredResizeObserver } from '../../utils/deferredResizeObserver';
import { HTML_DESIGN_BOX_ATTR } from '../../utils/chartTextFloor';
import { getDeclaredZoom } from '../../utils/zoomDomain';

export { HTML_DESIGN_BOX_ATTR };

// 纯函数:栏宽 available、设计宽 designWidth → 等比缩放比例(放得下 / 量不到 = 1,不缩)
export function designScaleOf(available, designWidth){
	const w = Number(available);
	const d = Number(designWidth);
	if(!(w > 0) || !(d > 0) || w >= d){ return 1; }
	return Math.floor((w / d) * 10000) / 10000;
}

// 父级内容盒宽(布局 px):clientWidth − 左右内距
export function contentWidthOf(el){
	if(!el){ return 0; }
	let w = el.clientWidth || 0;
	try{
		const cs = getComputedStyle(el);
		w -= (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
	}catch(e){ /* 量不到按 clientWidth */ }
	return Math.max(0, w);
}

// 父级内容盒高(布局 px):clientHeight − 上下内距
export function contentHeightOf(el){
	if(!el){ return 0; }
	let h = el.clientHeight || 0;
	try{
		const cs = getComputedStyle(el);
		h -= (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
	}catch(e){ /* 量不到按 clientHeight */ }
	return Math.max(0, h);
}

// 按高缩的比例下限:再矮就不硬缩(字会小到看不清),交给外层滚动
export const FIT_HEIGHT_MIN_SCALE = 0.7;

// 纯函数:可用高 available、设计高 designHeight → 按高的等比比例(放得下 / 量不到 = 1;放不下 = 高比,不低于下限)
export function designHeightScaleOf(available, designHeight){
	const h = Number(available);
	const d = Number(designHeight);
	if(!(h > 0) || !(d > 0) || h >= d){ return 1; }
	return Math.max(FIT_HEIGHT_MIN_SCALE, Math.floor((h / d) * 10000) / 10000);
}

// props:designWidth(必填,布局 px)· designHeight(可选:子块高度要靠父级定高的盘,缩放态按它排)·
//        designGutter(可选,左右留白 px:盘边上有意越出盘框的字(两式方盘四角的图名)缩放态里留出位置,不被栏的裁切边吃掉)·
//        fitHeight(可选:可用高不足设计高时也按高等比缩,见文件头 ④;要求父级的高与盘内容无关)· children
export function XQDesignScaleBox({ designWidth, designHeight, designGutter = 0, fitHeight = false, children }){
	const outerRef = useRef(null);
	const innerRef = useRef(null);
	const [avail, setAvail] = useState(0);
	const [innerH, setInnerH] = useState(0);
	const [availH, setAvailH] = useState(0);
	const k = designScaleOf(avail, designWidth);
	const kh = fitHeight ? designHeightScaleOf(availH, designHeight) : 1;
	const scaled = k < 1 || kh < 1;
	const read = ()=>{
		const outer = outerRef.current;
		if(!outer){ return; }
		const w = contentWidthOf(outer.parentElement);
		setAvail((prev)=>(Math.abs(prev - w) >= 0.5 ? w : prev));
		if(fitHeight){
			// 放大档不按高缩(记 0 = 量不到 → 比例 1)
			const hh = getDeclaredZoom() <= 1.001 ? contentHeightOf(outer.parentElement) : 0;
			setAvailH((prev)=>(Math.abs(prev - hh) >= 0.5 ? hh : prev));
		}
		const inner = innerRef.current;
		// 子块布局高取「自身高 ∪ 越出自身的内容高」:外框按它 × 比例定高(子块自己越出的那截也要占位)
		const h = inner ? Math.max(inner.offsetHeight || 0, inner.scrollHeight || 0) : 0;
		setInnerH((prev)=>(Math.abs(prev - h) >= 1 ? h : prev));
	};
	useLayoutEffect(()=>{
		const outer = outerRef.current;
		if(!outer || !outer.parentElement){ return undefined; }
		read();
		const ro = createDeferredResizeObserver(read);
		if(ro){
			ro.observe(outer.parentElement);
			if(innerRef.current){ ro.observe(innerRef.current); }
		}
		return ()=>{ if(ro){ ro.disconnect(); } };
	}, []);
	// 两态切换的当拍补量子块高(放得下 → 缩放:内框刚生成盒子,高要现量,不等下一拍观察器)
	useLayoutEffect(()=>{ read(); }, [scaled]);
	if(!scaled){
		return (
			<div ref={outerRef} style={{ display: 'contents' }} {...{ [HTML_DESIGN_BOX_ATTR]: 'fit' }}>
				<div ref={innerRef} style={{ display: 'contents' }}>{children}</div>
			</div>
		);
	}
	const dh = Number(designHeight) > 0 ? Number(designHeight) : 0;
	const g = Number(designGutter) > 0 ? Number(designGutter) : 0;
	// 缩放态按「设计宽 + 两侧留白」整体缩到栏宽(放得下 / 放不下的分界仍按设计宽)
	const total = Number(designWidth) + 2 * g;
	const kw = g ? Math.min(1, Math.floor((avail / total) * 10000) / 10000) : k;
	const kk = Math.min(kw, kh);
	const boxH = Math.max(dh, innerH);
	// 高说了算时盘比栏窄:水平居中(宽说了算时恰好铺满,偏移为 0)
	const left = Math.max(0, Math.floor((avail - total * kk) / 2));
	return (
		<div
			ref={outerRef}
			style={{ display: 'block', position: 'relative', flex: '0 0 auto', width: '100%', minWidth: 0, height: boxH ? Math.ceil(boxH * kk) : 0, maxHeight: 'none', overflow: 'visible' }}
			{...{ [HTML_DESIGN_BOX_ATTR]: 'scaled' }}
		>
			<div ref={innerRef} style={{ display: 'block', position: 'absolute', left, top: 0, boxSizing: 'border-box', width: total, height: dh || undefined, padding: g ? `0 ${g}px` : undefined, transform: `scale(${kk})`, transformOrigin: '0 0' }}>
				{children}
			</div>
		</div>
	);
}

export default XQDesignScaleBox;
