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
import React, { useLayoutEffect, useRef, useState } from 'react';
import { createDeferredResizeObserver } from '../../utils/deferredResizeObserver';
import { HTML_DESIGN_BOX_ATTR } from '../../utils/chartTextFloor';

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

// props:designWidth(必填,布局 px)· designHeight(可选:子块高度要靠父级定高的盘,缩放态按它排)·
//        designGutter(可选,左右留白 px:盘边上有意越出盘框的字(两式方盘四角的图名)缩放态里留出位置,不被栏的裁切边吃掉)· children
export function XQDesignScaleBox({ designWidth, designHeight, designGutter = 0, children }){
	const outerRef = useRef(null);
	const innerRef = useRef(null);
	const [avail, setAvail] = useState(0);
	const [innerH, setInnerH] = useState(0);
	const k = designScaleOf(avail, designWidth);
	const scaled = k < 1;
	const read = ()=>{
		const outer = outerRef.current;
		if(!outer){ return; }
		const w = contentWidthOf(outer.parentElement);
		setAvail((prev)=>(Math.abs(prev - w) >= 0.5 ? w : prev));
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
	const kk = g ? Math.floor((avail / (Number(designWidth) + 2 * g)) * 10000) / 10000 : k;
	const boxH = Math.max(dh, innerH);
	return (
		<div
			ref={outerRef}
			style={{ display: 'block', position: 'relative', flex: '0 0 auto', width: '100%', minWidth: 0, height: boxH ? Math.ceil(boxH * kk) : 0, maxHeight: 'none', overflow: 'visible' }}
			{...{ [HTML_DESIGN_BOX_ATTR]: 'scaled' }}
		>
			<div ref={innerRef} style={{ display: 'block', position: 'absolute', left: 0, top: 0, boxSizing: 'border-box', width: Number(designWidth) + 2 * g, height: dh || undefined, padding: g ? `0 ${g}px` : undefined, transform: `scale(${kk})`, transformOrigin: '0 0' }}>
				{children}
			</div>
		</div>
	);
}

export default XQDesignScaleBox;
