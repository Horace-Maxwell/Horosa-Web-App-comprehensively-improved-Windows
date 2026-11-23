// 奇门盘格子里的附加字(暗干 / 寄干 / 天禽 / 推演标记)与十二建星 —— 奇门页大盘与三式合一盘只调这里的展示件(三式合一同步)。
// 落位与字号全在 qimenCellLayout(纯函数):这里只把算好的字框画出来;写法、色令牌、换行规则只在这两处定义。
import React from 'react';
import { layoutQimenCell, tuiYanLegend, dunjiaJianChuRingSlots, dunjiaRingFit, DUNJIA_RING } from './qimenCellLayout';

const r2 = (v)=>Math.round(v * 100) / 100;

function renderLine(it, ln, i){
	return (
		<div key={`l${i}`} className="horosa-qimen-ov-line">
			{it.kind === 'tag'
				? ln.map((t)=><span key={t.text} className="horosa-qimen-ov-tag">{t.text}</span>)
				: ln.map((t, j)=>(t.pre
					? <span key={`p${j}`} className="horosa-qimen-ov-pre">{t.text}</span>
					: <React.Fragment key={`t${j}`}>{t.text}</React.Fragment>))}
		</div>
	);
}

// geometry = qimenCellLayout 的 *Geometry 之一(格内 / 格旁空格);只画这块几何 plan 里归它管的项
export function QimenCellOverlay({ cell, geometry }){
	if(!cell || !geometry){ return null; }
	const { items } = layoutQimenCell(cell, geometry);
	if(!items.length){ return null; }
	return items.map((it)=>(
		<div
			key={it.key}
			className={`horosa-qimen-ov is-${it.kind}`}
			data-qimen-ov={it.key}
			title={it.title}
			style={{
				left: r2(it.box.x),
				top: r2(it.box.y),
				width: r2(it.box.w),
				height: r2(it.box.h),
				fontSize: it.font,
			}}
		>
			{it.lines.map((ln, i)=>renderLine(it, ln, i))}
		</div>
	));
}

// 盘下图例(推演显示开着才有):上N / 下N / 用 / 转X / 先天 各是什么意思
export function QimenTuiYanLegend({ view, className = '' }){
	const text = tuiYanLegend(view);
	if(!text){ return null; }
	return <div className={`horosa-qimen-legend ${className}`.trim()}>{text}</div>;
}

// 奇门页大盘的十二建星外环(ring = utils/jianChu.jianChuRing):画在外环设计空间里(边长 = 九宫 + 2 × margin),
// 由盘把整块等比缩回原边长。日值那一支金底并标「日」。
export function QimenJianChuRing({ ring }){
	if(!ring){ return null; }
	const { outer } = dunjiaRingFit();
	return (
		<>
			<div className="horosa-qimen-ring" style={{ width: outer, height: outer }} />
			{dunjiaJianChuRingSlots().map((s)=>{
				const j = ring.byZhi[s.zhi];
				if(!j){ return null; }
				const mark = j.isDay ? <i>日</i> : null;
				return (
					<div
						key={s.zhi}
						className={`horosa-qimen-ring-slot${s.vertical ? ' is-v' : ''}${j.isDay ? ' is-day' : ''}`}
						data-jianchu={s.zhi}
						title={j.title}
						style={{ left: s.x, top: s.y, fontSize: DUNJIA_RING.font }}
					>
						{s.vertical ? null : mark}
						<span className="horosa-qimen-ring-zhi">{s.zhi}</span>
						<span className="horosa-qimen-ring-jx">{j.name}</span>
						{s.vertical ? mark : null}
					</div>
				);
			})}
		</>
	);
}

// 三式盘外圈地支旁的建星(地支本来就排成外环,建星直接挂在地支旁)
export function QimenJianChuMark({ item, fontSize }){
	if(!item){ return null; }
	return (
		<span className={`horosa-qimen-jx${item.isDay ? ' is-day' : ''}`} data-jianchu-mark={item.name} title={item.title} style={{ fontSize }}>
			{item.name}
		</span>
	);
}
