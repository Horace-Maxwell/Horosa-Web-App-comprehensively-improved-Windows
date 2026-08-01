// 风水 · 形势形体图库（寻龙九星形体 / 窝钳乳突穴形 / 水城五星 / 倒杖十二法）。
// 🔴 图库即选择器：点图卡直接回填 xingshi 的对应 sel 字段，取代纯下拉。
// 形体忠实转绘古法形容之文字，不新增古籍外形体；亮/暗双主题(--fs-* 令牌)。
import React from 'react';
import { XINGSHI_SHAPES, XINGSHI_9STAR, XUE_4TYPE, SHUICHENG_5, DAOZHANG_12, XINGSHI_SHAPE_NOTE } from '../fengshuiData';

const JX_STROKE = { good: 'var(--fs-good,#2e9c5a)', bad: 'var(--fs-bad,#c0392b)', neutral: 'var(--fs-muted,#9aa)' };

// 单张形体图（100×60 画布，地平线 y=56）。
function ShapeSvg({ shape, color, ground = true }) {
	if (!shape) { return null; }
	const stroke = color || 'var(--fs-text,#8b93a5)';
	return (
		<svg viewBox="0 0 100 60" width="100%" style={{ display: 'block' }} aria-hidden="true">
			{ground ? <line x1="2" y1="56.6" x2="98" y2="56.6" stroke="var(--fs-grid,rgba(127,140,170,.35))" strokeWidth="0.8" /> : null}
			{shape.mai ? <path d={shape.mai} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /> : null}
			{shape.zhang ? <path d={shape.zhang} fill="none" stroke="var(--fs-bad,#c0392b)" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="4 3" /> : null}
			{shape.d ? (
				<path d={shape.d} fill={shape.stroke ? 'none' : stroke} fillOpacity={shape.stroke ? 0 : 0.18}
					stroke={stroke} strokeWidth={shape.stroke ? 2 : 1.4} strokeLinecap="round" strokeLinejoin="round"
					strokeDasharray={shape.dash || undefined} />
			) : null}
			{shape.feet ? <path d={shape.feet} fill="none" stroke={stroke} strokeWidth="1.1" strokeLinejoin="round" opacity="0.7" /> : null}
			{shape.stem ? <path d={shape.stem} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" /> : null}
			{shape.barb ? <path d={shape.barb} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" /> : null}
			{shape.pt ? (
				<g>
					<circle cx={shape.pt[0]} cy={shape.pt[1]} r="4.6" fill="var(--fs-gold,#c0883a)" opacity="0.2" />
					<circle cx={shape.pt[0]} cy={shape.pt[1]} r="2.2" fill="var(--fs-gold,#c0883a)" />
				</g>
			) : null}
		</svg>
	);
}

function Card({ shape, title, sub, jx, active, onClick, ground }) {
	const color = active ? 'var(--fs-gold,#b8862f)' : (jx ? JX_STROKE[jx] : null);
	return (
		<button type="button" className={`horosa-fs-form-card${active ? ' is-active' : ''}`} onClick={onClick} title={sub || title}>
			<div className="horosa-fs-form-fig"><ShapeSvg shape={shape} color={color} ground={ground} /></div>
			<div className="horosa-fs-form-name">{title}</div>
			{sub ? <div className="horosa-fs-form-sub">{sub}</div> : null}
		</button>
	);
}

// props: sel（xingshi 的 sel 对象）、onPick(field, value)（点选回填）
export default function XingshiFormGallery({ sel = {}, onPick = null }) {
	const pick = (f, v)=>()=>{ if (onPick) { onPick(f, sel[f] === v ? '' : v); } };
	const byKey = (arr, k)=>arr.find((x)=>x.key === k) || null;
	return (
		<div className="horosa-fengshui-form-gallery">
			<div className="horosa-fs-form-group">
				<div className="horosa-fs-form-title">寻龙九星形体<span>点选即回填「主星形体」</span></div>
				<div className="horosa-fs-form-grid">
					{XINGSHI_9STAR.map((s)=>(
						<Card key={s.name} shape={byKey(XINGSHI_SHAPES.long9, s.name)} title={s.name}
							sub={`${s.wuxing}·${s.shape}`} jx={s.jx} active={sel.longStar === s.name} onClick={pick('longStar', s.name)} />
					))}
				</div>
			</div>
			<div className="horosa-fs-form-group">
				<div className="horosa-fs-form-title">窝钳乳突 四穴形<span>点选即回填「穴形」</span></div>
				<div className="horosa-fs-form-grid">
					{XUE_4TYPE.map((x)=>(
						<Card key={x.name} shape={byKey(XINGSHI_SHAPES.xue4, x.name)} title={x.name} sub={x.desc}
							active={sel.xueType === x.name} onClick={pick('xueType', x.name)} ground={false} />
					))}
				</div>
			</div>
			<div className="horosa-fs-form-group">
				<div className="horosa-fs-form-title">水城五星<span>点选即回填「水城」</span></div>
				<div className="horosa-fs-form-grid">
					{SHUICHENG_5.map((w)=>(
						<Card key={w.name} shape={byKey(XINGSHI_SHAPES.shui5, w.name)} title={w.name} sub={w.shape} jx={w.jx}
							active={sel.shuiCheng === w.name} onClick={pick('shuiCheng', w.name)} ground={false} />
					))}
				</div>
			</div>
			<div className="horosa-fs-form-group">
				<div className="horosa-fs-form-title">倒杖十二法<span>点选即回填「倒杖」·虚线为下杖</span></div>
				<div className="horosa-fs-form-grid">
					{DAOZHANG_12.map((z)=>(
						<Card key={z.name} shape={byKey(XINGSHI_SHAPES.daozhang12, z.name)} title={z.name} sub={`${z.use}·${z.pt}`}
							active={sel.daoZhang === z.name} onClick={pick('daoZhang', z.name)} ground={false} />
					))}
				</div>
			</div>
			<div className="horosa-fs-form-note">{XINGSHI_SHAPE_NOTE}</div>
		</div>
	);
}
