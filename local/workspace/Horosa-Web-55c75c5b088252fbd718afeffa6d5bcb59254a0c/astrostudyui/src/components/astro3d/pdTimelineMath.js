// 主限天球 · 时间轴 3.0 纯函数(可缩放轨道/自适应刻度/glyph 简写章/车道装箱)。
//
// [G4] 视频剪辑式时间轴的全部可测逻辑住此(jest 直测,组件只消费):
//  - 缩放:px/年 为唯一标尺;fit=面板宽/年限;clamp 于 [TL_ZOOM_MIN, TL_ZOOM_MAX];
//  - LOD:px/年 ≥ TL_CHIP_MODE_MIN 出 glyph 简写章,更小退化为纯色点(几百行不糊);
//  - glyph 简写:迫星[+相位]→应星,行星/相位走 ywastrochart 字形(AstroMsg,与 2D 盘同源),
//    界/映点/宫缀中文 —— 段结构 [{t, astro}] 供 SVG tspan 分字体渲染;
//  - 车道装箱:按 x 升序区间防撞,放不下落「结束最早」车道(重叠最少)。
import * as AstroText from '../../constants/AstroText';

export const TL_ZOOM_MIN = 2;        // px/年 下限(百年盘 200px 也画得下)
export const TL_ZOOM_MAX = 400;      // px/年 上限(逐月/逐日级细看;用户要求能放更大)
export const TL_CHIP_MODE_MIN = 7;   // ≥ 此值出 glyph 章;更小退化为点(LOD)

/** 缩放钳制(非数回落下限) */
export function clampZoom(v){
	const n = Number(v);
	if(!Number.isFinite(n)){
		return TL_ZOOM_MIN;
	}
	return Math.max(TL_ZOOM_MIN, Math.min(TL_ZOOM_MAX, n));
}

/** 适配档:内容区宽 ÷ 年限(下限 0.8 防 0 宽期间除出 0) */
export function fitPxPerYear(plotW, axisYears){
	const w = Math.max(80, Number(plotW) || 0);
	const y = Math.max(1, Number(axisYears) || 0);
	return Math.max(0.8, w / y);
}

/** 刻度步长:保证相邻刻度间距 ≥ minGapPx(缩放联动;1/2/5/10/20/50/100 阶梯) */
export function niceTickStep(pxPerYear, minGapPx = 44){
	const steps = [1, 2, 5, 10, 20, 50, 100];
	for(let i = 0; i < steps.length; i += 1){
		if(steps[i] * pxPerYear >= minGapPx){
			return steps[i];
		}
	}
	return 100;
}

/** 单点位 id → glyph 段([{t, astro}]):行星/轴点走占星字形,相位缀相位 glyph,界/映/宫缀中文 */
export function glyphSegsOf(pid){
	const text = `${pid || ''}`;
	const parts = text.split('_');
	const seg = (id)=>{
		if(id && `${id}`.indexOf('House') === 0){
			return { t: `${`${id}`.slice(5)}宫`, astro: false };
		}
		const g = AstroText.AstroMsg[id];
		if(g !== undefined && g !== null && `${g}`.length <= 2){
			return { t: `${g}`, astro: true };
		}
		const cn = AstroText.AstroTxtMsg[id] || AstroText.AstroMsgCN[id];
		return { t: cn ? `${cn}` : `${id || ''}`, astro: false };
	};
	if(parts.length < 2){
		return [seg(text)];
	}
	const head = parts[0];
	if(head === 'T'){
		return [seg(parts[1]), { t: '界', astro: false }];
	}
	if(head === 'A'){
		return [seg(parts[1]), { t: '映', astro: false }];
	}
	if(head === 'C'){
		return [seg(parts[1]), { t: '反映', astro: false }];
	}
	if(head === 'D' || head === 'S' || head === 'N'){
		const deg = parts[parts.length - 1];
		const base = parts.slice(1, parts.length - 1).join('_');
		const segs = [seg(base)];
		if(deg && deg !== '0'){
			const g = AstroText.AstroMsg[`Asp${deg}`];
			segs.push(g ? { t: `${g}`, astro: true } : { t: `${deg}°`, astro: false });
		}
		return segs;
	}
	return [seg(text)];
}

/** 表行 → 事件章段(迫星[相位] → 应星) */
export function rowGlyphSegs(row){
	if(!row){
		return [];
	}
	return [...glyphSegsOf(row.prom), { t: '→', astro: false }, ...glyphSegsOf(row.sig)];
}

/** 段列估宽(px):占星字形窄(0.72em),中文/箭头按 1em;padPx=章左右内边距合计 */
export function estSegsWidth(segs, fontPx = 11, padPx = 10){
	let w = 0;
	(segs || []).forEach((s)=>{
		const len = `${s && s.t}`.length;
		w += len * fontPx * (s && s.astro ? 0.72 : 1.0);
	});
	return Math.ceil(w + padPx);
}

/**
 * 车道装箱:events=[{x(中心px), w(宽px), ...}] → 每项补 lane(0..laneCount-1)+overflow。
 * 规则:x 升序扫描,放进「左缘 ≥ 该道当前结束+gap」的第一条道;全占=overflow:true 落结束最早道
 * (消费方把 overflow 事件降级画成小点 —— 局部过密时章不硬叠,LOD 逐事件生效)。
 * overflow 事件不推进车道结束位:密簇里第一章后仍给后续留章位,而不是被点连坐挤没。
 */
export function packLanes(events, laneCount = 3, gapPx = 3){
	const n = Math.max(1, laneCount);
	const ends = new Array(n).fill(-Infinity);
	const out = [];
	[...(events || [])].sort((a, b)=>a.x - b.x).forEach((ev)=>{
		const left = ev.x - ev.w / 2;
		let lane = -1;
		for(let i = 0; i < n; i += 1){
			if(left >= ends[i] + gapPx){
				lane = i;
				break;
			}
		}
		if(lane < 0){
			let best = 0;
			for(let i = 1; i < n; i += 1){
				if(ends[i] < ends[best]){ best = i; }
			}
			out.push({ ...ev, lane: best, overflow: true });
			return;
		}
		ends[lane] = ev.x + ev.w / 2;
		out.push({ ...ev, lane, overflow: false });
	});
	return out;
}

/**
 * LOD 密度判据:px/年 达下限且「泳道平均间距」够放下章的 1/laneCount 宽才开章档
 * (几百行低倍全铺章=实心糊带;点↔章按可读性切换,拉近自然浮现)。
 */
export function chipModeOf(pxPerYear, axisYears, laneEventCount, avgChipW = 46, laneCount = 3){
	if(pxPerYear < TL_CHIP_MODE_MIN){
		return false;
	}
	const n = Math.max(1, Number(laneEventCount) || 0);
	const spacing = (pxPerYear * Math.max(1, axisYears)) / n;
	return spacing >= (avgChipW / Math.max(1, laneCount)) + 2;
}
