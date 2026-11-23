// 盘面文字排布(竖排 / 环排 / 径向列)与度数、宿度、速度文字
// 从 GuoLaoMoiraWheel.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import React from 'react';   // 下面的 JSX 按旧式编译成 React.createElement(测试环境不自动补)
import { perCharTextProps } from '../../../utils/scriptMode';
import { point, tangentRotate, norm } from './geometry';
import { BLACK, GREEN, HALF_STELLAR } from './constants';

// 多字沿圆弧分开排布(各字正立,择日盘 arcUprightText 同款):字距按半径换算弧角,
// 下半圆字序翻转保证恒从左到右顺读——每字落在扇形中线附近,不越扇界。
export function arcUprightTextMoira(text, radius, centerTheta, opt = {}){
	const word = String(text || '');
	const chars = Array.from(word);
	const n = chars.length;
	if(!n){ return null; }
	const size = opt.size || 20;
	const stepDeg = (size * (opt.spacing || 1.12)) / Math.max(1, radius) * 180 / Math.PI;
	const dir = Math.sin(centerTheta * Math.PI / 180) > 0 ? -1 : 1;
	return chars.map((ch, k)=>{
		const t = centerTheta + dir * (k - (n - 1) / 2) * stepDeg;
		const pt = point(radius, t);
		return (
			<text key={`amt-${k}`} {...perCharTextProps(word, k, ch)} x={pt.x} y={pt.y} fill={opt.color || BLACK} fontSize={size} fontWeight={opt.weight || 600} textAnchor="middle" dominantBaseline="central">{ch}</text>
		);
	});
}

function cleanText(text){
	return `${text || ''}`.replace(/\s+/g, '');
}

export function formatGodName(name){
	let val = cleanText(name);
	if(!val){
		return '';
	}
	val = val.split(/[\/／]/)[0];
	const aliases = {
		天乙贵人: '天贵',
		玉堂贵人: '玉贵',
	};
	return aliases[val] || val;
}

function splitColumns(text, maxPerCol){
	const raw = cleanText(text);
	if(!raw){
		return [];
	}
	if(raw.indexOf('|') >= 0){
		return raw.split('|').filter(Boolean);
	}
	const cols = [];
	for(let i = 0; i < raw.length; i += maxPerCol){
		cols.push(raw.slice(i, i + maxPerCol));
	}
	return cols;
}

export function verticalText(text, x, y, opt = {}){
	const size = opt.size || 22;
	const gap = opt.gap || size * 1.02;
	const maxPerCol = opt.maxPerCol || 5;
	const cols = splitColumns(text, maxPerCol);
	const colGap = opt.colGap || size * 0.92;
	const fill = opt.color || BLACK;
	const weight = opt.weight || 400;
	const opacity = opt.opacity === undefined ? 1 : opt.opacity;
	const nodes = [];
	cols.forEach((col, colIdx)=>{
		const chars = Array.from(col);
		const startY = y - (chars.length - 1) * gap / 2;
		const colX = x + (cols.length - 1) * colGap / 2 - colIdx * colGap;
		chars.forEach((ch, i)=>{
			const textProps = {
				x: colX,
				y: startY + i * gap,
				fontSize: size,
				fontWeight: weight,
				textAnchor: 'middle',
				dominantBaseline: 'central',
				opacity,
			};
			nodes.push(
				<text
					key={`${text}-${colIdx}-${i}-${x}-${y}`}
					{...textProps}
					fill={fill}
				>
					{ch}
				</text>
			);
		});
	});
	return nodes;
}

export function horizontalRingText(text, radius, theta, opt = {}){
	const p = point(radius, theta);
	const rotate = tangentRotate(theta);
	return (
		<text
			x={p.x}
			y={p.y}
			fill={opt.color || BLACK}
			fontSize={opt.size || 22}
			fontWeight={opt.weight || 400}
			fontFamily={opt.family || undefined}
			textAnchor="middle"
			dominantBaseline="central"
			transform={opt.upright ? undefined : `rotate(${rotate} ${p.x} ${p.y})`}
		>
			{text}
		</text>
	);
}

export function pairedRadialText(text, theta, inner, outer, opt = {}){
	const word = cleanText(text);
	const chars = Array.from(word);
	if(!chars.length){
		return null;
	}
	const band = Math.max(1, outer - inner);
	const branch = chars.slice(1).join('');
	const items = [
		{key: 'outer', value: chars[0], idx: 0, radius: inner + band * 0.68},
		{key: 'inner', value: branch || chars[1] || '', idx: 1, radius: inner + band * 0.34},
	].filter((item)=>item.value);
	return (
		<g className="moira-paired-radial-text">
			{items.map((item)=>{
				const p = point(item.radius, theta);
				return (
					<text
						key={`${text}-${item.key}-${theta}`}
						{...perCharTextProps(word, item.idx, item.value)}
						x={p.x}
						y={p.y}
						fill={item.key === 'outer' ? (opt.primaryColor || opt.color || BLACK) : (opt.secondaryColor || opt.color || BLACK)}
						fontSize={opt.size || 22}
						fontWeight={opt.weight || 600}
						textAnchor="middle"
						dominantBaseline="central"
					>
						{item.value}
					</text>
				);
			})}
		</g>
	);
}

export function radialStackText(text, theta, inner, outer, opt = {}){
	const word = cleanText(text);
	const chars = Array.from(word);
	if(!chars.length){
		return [];
	}
	const size = opt.size || 24;
	const step = opt.step || size * 1.04;
	const usableOuter = outer - size * 0.5;
	const usableInner = inner + size * 0.5;
	const stackHeight = (chars.length - 1) * step;
	const start = Math.min(usableOuter, (usableInner + usableOuter + stackHeight) / 2);
	const fill = opt.color || GREEN;
	const weight = opt.weight || 600;
	const opacity = opt.opacity === undefined ? 1 : opt.opacity;
	return chars.map((ch, idx)=>{
		const p = point(start - idx * step, theta);
		return (
			<text
				key={`${text}-${theta}-${idx}`}
				{...perCharTextProps(word, idx, ch)}
				x={p.x}
				y={p.y}
				fill={fill}
				fontSize={size}
				fontWeight={weight}
				textAnchor="middle"
				dominantBaseline="central"
				opacity={opacity}
			>
				{ch}
			</text>
		);
	});
}

export function radialColumns(items, centerTheta, inner, outer, opt = {}){
	const list = (items || []).filter(Boolean);
	if(!list.length){
		return [];
	}
	const arc = opt.arc || 24;
	const maxStep = opt.maxStep || 5.2;
	const minStep = opt.minStep || 2.8;
	const rawStep = list.length <= 1 ? 0 : arc / (list.length - 1);
	const step = list.length <= 1 ? 0 : (
		opt.fitArc ? Math.min(maxStep, rawStep) : Math.max(minStep, Math.min(maxStep, rawStep))
	);
	const start = centerTheta + step * (list.length - 1) / 2;
	const nodes = [];
	list.forEach((item, idx)=>{
		const theta = start - idx * step;
		nodes.push(...radialStackText(item, theta, inner, outer, opt));
	});
	return nodes;
}

export function godTextSize(count){
	if(count > 22){
		return 11;
	}
	if(count > 18){
		return 13;
	}
	if(count > 14){
		return 15;
	}
	if(count > 10){
		return 17;
	}
	if(count > 6){
		return 19;
	}
	return 21;
}

export function godColumnStep(count){
	if(count > 22){
		return {minStep: 0.9, maxStep: 1.25, arc: 27};
	}
	if(count > 18){
		return {minStep: 1.1, maxStep: 1.55, arc: 27};
	}
	if(count > 14){
		return {minStep: 1.35, maxStep: 1.9, arc: 27};
	}
	if(count > 10){
		return {minStep: 1.8, maxStep: 2.7, arc: 27};
	}
	return {minStep: 2.7, maxStep: 5.1, arc: 25};
}

export function signIndexFromDegree(degree){
	return Math.floor(norm(degree) / 30) % 12;
}

export function dmsText(value){
	let val = Number(value);
	if(!Number.isFinite(val)){
		return '';
	}
	val = ((val % 30) + 30) % 30;
	let deg = Math.floor(val);
	const minFloat = (val - deg) * 60;
	let min = Math.floor(minFloat);
	let sec = Math.round((minFloat - min) * 60);
	if(sec >= 60){
		sec = 0;
		min += 1;
	}
	if(min >= 60){
		min = 0;
		deg += 1;
	}
	return `${String(deg).padStart(2, '0')}°${String(min).padStart(2, '0')}′${String(sec).padStart(2, '0')}″`;
}

// 宿内度专用度分秒(不做 %30 折叠——宿距可超 30°,如井宿 33°)。
function suDmsText(value){
	let val = Number(value);
	if(!Number.isFinite(val)){
		return '';
	}
	val = ((val % 360) + 360) % 360;
	let deg = Math.floor(val);
	const minFloat = (val - deg) * 60;
	let min = Math.floor(minFloat);
	let sec = Math.round((minFloat - min) * 60);
	if(sec >= 60){ sec = 0; min += 1; }
	if(min >= 60){ min = 0; deg += 1; }
	return `${String(deg).padStart(2, '0')}°${String(min).padStart(2, '0')}′${String(sec).padStart(2, '0')}″`;
}

// 宿内度:显示度 − 所落宿的界起点(宿界表与显示度同口径,displayCoord 保证同体系)。
// 无宿界表回退 null(调用方退回旧行为)。
// 显示度落在哪一宿(与 suOffsetText 同一张宿界表、同一个度):赤仪「上升取法 · 经典」把上升换成东点黄经后,
// 宿名也要按换过的度取,不能用后端按真赤经算的 su28,否则宿名与宿内度不同源
export function suNameOf(degree, stars){
	if(!stars || !stars.length){ return null; }
	const d = norm(degree);
	let best = null;
	let maxStar = null;
	stars.forEach((s)=>{
		const r = Number(s.ra);
		if(!Number.isFinite(r)){ return; }
		if(r <= d && (best === null || r > Number(best.ra))){ best = s; }
		if(maxStar === null || r > Number(maxStar.ra)){ maxStar = s; }
	});
	const hit = best || maxStar;
	return hit ? (hit.name || HALF_STELLAR[stars.indexOf(hit)] || null) : null;
}

export function suOffsetText(degree, stars){
	if(!stars || !stars.length){
		return null;
	}
	const d = norm(degree);
	let bound = null;
	for(let i = 0; i < stars.length; i++){
		const r = Number(stars[i].ra);
		if(!Number.isFinite(r)){ continue; }
		if(r <= d && (bound === null || r > bound)){ bound = r; }
	}
	if(bound === null){
		let maxR = null;
		stars.forEach((s)=>{ const r = Number(s.ra); if(Number.isFinite(r) && (maxR === null || r > maxR)){ maxR = r; } });
		if(maxR === null){ return null; }
		bound = maxR - 360;
	}
	return suDmsText(d - bound);
}
