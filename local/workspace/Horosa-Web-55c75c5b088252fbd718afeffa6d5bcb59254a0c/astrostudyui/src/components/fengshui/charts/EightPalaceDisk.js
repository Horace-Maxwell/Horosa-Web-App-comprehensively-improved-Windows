// 风水 · 八方盘 SVG（3×3 后天布局,八外宫+中宫摘要）。金锁(砂水得位)/乾坤国宝(水位)/八宅(游星)共用。
// 成熟设计:圆角瓦片 + 吉凶柔色底 + 中宫暖金摘要 + 角标卦位。亮/暗双主题(--fs-*/--horosa-* 令牌)。
import React, { useEffect, useRef, useState } from 'react';

const GONG_CELL = { 4: [0, 0], 9: [0, 1], 2: [0, 2], 3: [1, 0], 5: [1, 1], 7: [1, 2], 8: [2, 0], 1: [2, 1], 6: [2, 2] };
const JX_COLOR = { good: 'var(--fs-good,#2e9c5a)', bad: 'var(--fs-bad,#c0392b)', neutral: 'var(--fs-muted,#9aa)' };

// SVG <text> 既不换行也不截断:文本一长就直接画出格子、横压到隔壁宫
// (用户实报改造化煞页「文字超出框架」——该派每宫要塞两条煞名如「日·三煞／理·斗牛煞」)。
// SVG 无 text-overflow,故按字宽估算收敛。用估算而非实测:本组件在 render 期就要定字号,
// 那时还没有布局;且估算对中西文混排足够准(中日韩全角≈1em,其余≈0.55em)。
function estTextWidth(text, fontSize){
	let w = 0;
	for(const ch of `${text}`){
		const code = ch.codePointAt(0);
		w += code > 0x2e80 ? fontSize : fontSize * 0.55;
	}
	return w;
}

// 返回 [显示文本, 实际字号]:先按比例缩字号(下限 minRatio),仍超宽再尾部截断加省略号。
function fitText(text, fontSize, maxWidth, minRatio){
	const s = `${text || ''}`;
	if(!s || !(maxWidth > 0)){ return [s, fontSize]; }
	const w = estTextWidth(s, fontSize);
	if(w <= maxWidth){ return [s, fontSize]; }
	const shrunk = Math.max(fontSize * (minRatio || 0.72), fontSize * (maxWidth / w));
	if(estTextWidth(s, shrunk) <= maxWidth){ return [s, shrunk]; }
	let cut = s;
	while(cut.length > 1 && estTextWidth(`${cut}…`, shrunk) > maxWidth){ cut = cut.slice(0, -1); }
	return [`${cut}…`, shrunk];
}

// props: palaces[{gong, gua, dir, primary, secondary, jx}]、centerLabel、size。
// size 现在是**下限兼回落值**:组件自量父容器,按 min(可用宽, 可用高) 铺满
// —— 原先写死 620 且 maxWidth 卡在 620,中栏实测有 926×687 可用,右侧与下方白白空着
// (用户实报「最好把中间盘全部放大,有很多空余位置可以利用」)。
export default function EightPalaceDisk({ palaces = [], centerLabel = '', size = 324 }) {
	const boxRef = useRef(null);
	const [avail, setAvail] = useState(0);
	// 🔴 不能量「自己的高度」来定盘的边长:盘高就是靠这个量出来的,量它=循环依赖(高度会被自己钉死)。
	// 两个不依赖内容高的量:①容器**宽度**(width:100% 由父给,与盘无关);
	// ②盘顶到视口底的剩余高(getBoundingClientRect().top 同样与盘高无关)。取两者较小 = 既吃满横向
	// 空白、又不至于长过一屏。
	useEffect(()=>{
		const el = boxRef.current;
		if(!el){ return undefined; }
		const measure = ()=>{
			const w = el.clientWidth || 0;
			const top = el.getBoundingClientRect().top;
			const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
			const byViewport = vh ? Math.max(0, vh - top - 28) : 0;   // 28:底部呼吸位
			const next = Math.round(Math.min(w || size, byViewport || (w || size)));
			setAvail((prev)=>(Math.abs(prev - next) > 2 ? next : prev));
		};
		measure();
		let ro = null;
		if(typeof ResizeObserver !== 'undefined'){ ro = new ResizeObserver(measure); ro.observe(el); }
		if(typeof window !== 'undefined'){ window.addEventListener('resize', measure); }
		return ()=>{
			if(ro){ ro.disconnect(); }
			if(typeof window !== 'undefined'){ window.removeEventListener('resize', measure); }
		};
	}, [size]);
	// 量不到(首帧/SSR)一律回落 size —— 绝不因量不到而画成 0。
	const rendered = Math.max(size, avail || size);

	const cell = size / 3;   // 几何仍按 viewBox 内部坐标算,放大交给 viewBox 缩放
	const gap = 5;
	const byGong = {};
	palaces.forEach((p)=>{ byGong[p.gong] = p; });
	const cells = [];
	for (let g = 1; g <= 9; g++) {
		const [r, c] = GONG_CELL[g];
		const x = c * cell; const y = r * cell;
		const inner = cell - gap * 2 - 6;   // 瓦片内可写宽度(去掉间隙与左右各 3 的呼吸位)
		if (g === 5) {
			const [ctext, cfs] = fitText(centerLabel, cell * 0.155, inner, 0.6);
			cells.push(
				<g key={g} transform={`translate(${x},${y})`}>
					<rect x={gap / 2} y={gap / 2} width={cell - gap} height={cell - gap} rx={9}
						fill="var(--fs-cell-hot, rgba(216,173,99,.14))" stroke="var(--fs-gold, #c0883a)" strokeWidth={1.3} />
					<text x={cell * 0.5} y={cell * 0.53} fontSize={cfs} textAnchor="middle" fontWeight={700} fill="var(--fs-gold, #c0883a)">{ctext}</text>
				</g>);
			continue;
		}
		const p = byGong[g] || { gong: g };
		const hot = p.jx === 'good' || p.jx === 'bad';
		const fill = p.jx === 'good' ? 'var(--fs-good-soft, rgba(46,156,90,.13))' : (p.jx === 'bad' ? 'var(--fs-bad-soft, rgba(192,57,43,.12))' : 'var(--fs-tile, rgba(127,140,170,.10))');
		const stroke = hot ? JX_COLOR[p.jx] : 'var(--fs-grid, rgba(127,140,170,.3))';
		const corner = `${p.gua || ''}${p.dir ? ` ${p.dir.replace(/[（(].*/, '')}` : ''}`;
		const [ctext2, cfs2] = fitText(corner, 10.5, inner, 0.7);
		const [ptext, pfs] = fitText(p.primary || '', cell * 0.21, inner, 0.6);
		// secondary 支持数组:并列多项(如同一宫的两条煞)各占一行,好过挤成一行再被截掉尾字
		// —— 实测「理·阴神满地／理·先后天火煞」单行放不下,截断后「火煞」二字丢失。
		// 仍传字符串的调用点(金锁/乾坤/八宅/辅星)按单行走,行为不变。
		const secLines = (Array.isArray(p.secondary) ? p.secondary : (p.secondary ? [p.secondary] : []))
			.filter(Boolean).slice(0, 2);
		const secFs = cell * (secLines.length > 1 ? 0.112 : 0.125);
		const secY = secLines.length > 1 ? [cell * 0.735, cell * 0.865] : [cell * 0.79];
		cells.push(
			<g key={g} transform={`translate(${x},${y})`}>
				<rect x={gap / 2} y={gap / 2} width={cell - gap} height={cell - gap} rx={9}
					fill={fill} stroke={stroke} strokeWidth={hot ? 1.2 : 1} strokeOpacity={hot ? 0.55 : 1} />
				<text x={gap / 2 + 7} y={gap / 2 + 14} fontSize={cfs2} fontWeight={600} fill="var(--fs-muted, #9aa)">{ctext2}</text>
				<text x={cell * 0.5} y={cell * 0.55} fontSize={pfs} textAnchor="middle" fontWeight={800}
					fill={JX_COLOR[p.jx] || 'var(--fs-text,#999)'}>{ptext}</text>
				{secLines.map((ln, li)=>{
					const [lt, lfs] = fitText(ln, secFs, inner, 0.62);
					return (<text key={`s${li}`} x={cell * 0.5} y={secY[li]} fontSize={lfs} textAnchor="middle"
						fill="var(--fs-muted, #9aa)">{lt}</text>);
				})}
			</g>);
	}
	// 外层 div 负责量测(它按 CSS 撑满可用区),svg 按量到的边长居中铺开。
	return (
		<div ref={boxRef} className="horosa-fs-disk-box">
			<svg viewBox={`0 0 ${size} ${size}`} width={rendered} height={rendered}
				style={{ maxWidth: '100%', maxHeight: '100%', display: 'block', margin: '0 auto' }}
				preserveAspectRatio="xMidYMid meet" className="horosa-fs-disk">
				{cells}
			</svg>
		</div>
	);
}
