// 8 虚星手绘 SVG 星图字形(B1)——单一真值源,D3 盘面与 React 右栏双端共用。
// 字形只依形状构造绘制(构造描述见 data/uranianTnpReference.js 的 glyphDesc),不署人名出处。
// 美术口径:24×24 viewBox / stroke=currentColor(或显式色) / fill=none /
//   vector-effect='non-scaling-stroke'(线宽恒 1.7px 屏幕像素,与 ywastro 字形笔画重量匹配) /
//   linecap/linejoin=round;随明暗主题自动反色(与 D3 盘面 currentColor 口径一致)。
// ⚠️ D3 的 .text() 无法渲染 React 节点 —— 盘面一律走 appendTnpGlyphD3 以 <path> 直插;
//   外层 g 供环反旋 rotate/挂 title,内层 g 承载 translate+scale,两层正交互不覆盖。
import React from 'react';
import * as AstroConst from '../../constants/AstroConst';

// 每星一条 d 串(多子路径 M 断笔);圆以两段半圆弧表达。
export const TNP_GLYPH_PATHS = {
	// 丘比特:木星记号 + 金星"挂"于其内(右上小圆+下垂十字)。
	[AstroConst.CUPIDO]: 'M3.5 8.5 A5 5 0 0 1 8.5 3.5 M8.5 3.5 V14 M3.5 11 H12 ' +
		'M13.8 7.5 A3.2 3.2 0 1 0 20.2 7.5 A3.2 3.2 0 1 0 13.8 7.5 M17 10.7 V16 M14.6 13.3 H19.4',
	// 哈迪斯:十字 + 左倾下弦月(双弧月牙,月之下角与十字下横相交)。
	[AstroConst.HADES]: 'M10.5 3.5 A7.5 7.5 0 0 0 7 14.8 M10.5 3.5 A11.5 11.5 0 0 1 7 14.8 ' +
		'M15 5.5 V18.5 M9.5 15 H20.5',
	// 宙斯:火箭状(尖头闭合三角 + 双线身 + 外撇双尾 + 中尾)。
	[AstroConst.ZEUS]: 'M12 3 L8.5 9 H15.5 Z M10.5 9 V14.5 M13.5 9 V14.5 ' +
		'M10.5 14.5 L7.5 20 M13.5 14.5 L16.5 20 M12 14.5 V19.5',
	// 克洛诺斯:尖顶/王冠(山形) + 竖干横臂(喻"高处"之十字)。
	[AstroConst.KRONOS]: 'M6 8.5 L12 3.5 L18 8.5 M12 8.5 V20 M7.5 13 H16.5',
	// 阿波罗:木星记号 + 双子座记号(两竖上下弧)。
	[AstroConst.APOLLON]: 'M3 8 A4.5 4.5 0 0 1 7.5 3.5 M7.5 3.5 V13.5 M3 10.5 H10.5 ' +
		'M13.5 5 Q17 6.8 20.5 5 M13.5 19 Q17 17.2 20.5 19 M15.2 5.8 V18.2 M18.8 5.8 V18.2',
	// 阿德墨托斯:金牛亲缘(顶双角+圆) + 底线(铁砧状,喻不动)。
	[AstroConst.ADMETOS]: 'M7 4 A5 5 0 0 0 12 8.5 A5 5 0 0 0 17 4 ' +
		'M7.8 13 A4.2 4.2 0 1 0 16.2 13 A4.2 4.2 0 1 0 7.8 13 M6 20.5 H18',
	// 伏尔甘:锤状(顶横块 + 竖柄)。
	[AstroConst.VULCANUS]: 'M6.5 4.5 H17.5 V9 H6.5 Z M12 9 V20',
	// 波塞冬:两枚相背新月由横杠相连 ")(" —— 与海王星三叉戟记号截然不同,一眼可辨。
	[AstroConst.POSEIDON]: 'M7.5 4.5 A9 9 0 0 1 7.5 19.5 M16.5 4.5 A9 9 0 0 0 16.5 19.5 M4 12 H20',
	// ── 可选点(B7,默认关)——同走 path 直插,与 TNP 一致地随主题反色。 ──
	// 东点:圆(地平)+ 贯穿横线(赤道)——赤道上升之意象。
	[AstroConst.EAST_POINT]: 'M5.5 12 A6.5 6.5 0 1 0 18.5 12 A6.5 6.5 0 1 0 5.5 12 M2.5 12 H21.5',
	// 宿命点:V 形主笔 + 右下小叉(通行 Vx 记号的图形化)。
	[AstroConst.VERTEX]: 'M6 4.5 L11 17 L16 4.5 M14.5 14.5 L20 20 M20 14.5 L14.5 20',
};

const STROKE_W = 1.7;

// D3 直插:在 parent(d3 selection)追加双层 g —— 外层裸 g(供环反旋 rotate(x,y) 与 append('title')),
// 内层 g 做 translate+scale 把 24×24 字形铺到以 (x,y) 为中心、px 见方的区域。
// 未知 id 返回 null(调用方回退 text 缩写)。
export function appendTnpGlyphD3(parent, id, x, y, px, color){
	const d = TNP_GLYPH_PATHS[id];
	if (!d || !parent) return null;
	const outer = parent.append('g');
	const s = px / 24;
	outer.append('g')
		.attr('transform', `translate(${x - px / 2}, ${y - px / 2}) scale(${s})`)
		.append('path')
		.attr('d', d)
		.attr('stroke', color || 'currentColor')
		.attr('fill', 'none')
		.attr('stroke-width', STROKE_W)
		.attr('stroke-linecap', 'round')
		.attr('stroke-linejoin', 'round')
		.attr('vector-effect', 'non-scaling-stroke')
		.style('pointer-events', 'none');
	return outer;
}

// React 端(右栏列表/面板):内联 SVG,默认吃 currentColor 随主题反色。未知 id 返回 null。
export function tnpGlyph(id, size, color){
	const d = TNP_GLYPH_PATHS[id];
	if (!d) return null;
	const px = size || 16;
	return (
		<svg width={px} height={px} viewBox="0 0 24 24" aria-hidden="true"
			style={{ verticalAlign: '-0.18em', display: 'inline-block' }}>
			<path d={d} stroke={color || 'currentColor'} fill="none" strokeWidth={STROKE_W}
				strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
		</svg>
	);
}

export default TNP_GLYPH_PATHS;
