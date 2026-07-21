// [G4] 主限天球时间轴 3.0 纯函数:缩放/刻度/glyph 简写章/车道装箱(组件只消费,逻辑全在此测)。
import {
	TL_ZOOM_MIN, TL_ZOOM_MAX, clampZoom, fitPxPerYear, niceTickStep,
	glyphSegsOf, rowGlyphSegs, estSegsWidth, packLanes,
} from '../pdTimelineMath';
import * as AstroText from '../../../constants/AstroText';

describe('[G4] 缩放/刻度', ()=>{
	test('clampZoom:钳制于上下限,坏值回落下限', ()=>{
		expect(clampZoom(0)).toBe(TL_ZOOM_MIN);
		expect(clampZoom(999)).toBe(TL_ZOOM_MAX);
		expect(clampZoom('x')).toBe(TL_ZOOM_MIN);
		expect(clampZoom(12)).toBe(12);
	});
	test('fitPxPerYear = 内容宽/年限(0 宽期间下限守卫,永不除出 0)', ()=>{
		expect(fitPxPerYear(1000, 100)).toBe(10);
		expect(fitPxPerYear(0, 100)).toBeGreaterThan(0);
	});
	test('niceTickStep:保证相邻刻度 ≥44px;缩放越大步长单调不增', ()=>{
		expect(niceTickStep(50)).toBe(1);
		expect(niceTickStep(10)).toBe(5);
		expect(niceTickStep(4.4)).toBe(10);
		expect(niceTickStep(1)).toBe(50);
		let prev = Infinity;
		[1, 2, 4, 8, 16, 32, 64].forEach((ppy)=>{
			const s = niceTickStep(ppy);
			expect(s).toBeLessThanOrEqual(prev);
			prev = s;
		});
	});
});

describe('[G4] glyph 简写段(ywastrochart 与 2D 盘同源)', ()=>{
	test('行星本体 N_Mars_0 → 单段火星字形(astro)', ()=>{
		const segs = glyphSegsOf('N_Mars_0');
		expect(segs).toHaveLength(1);
		expect(segs[0]).toEqual({ t: AstroText.AstroMsg.Mars, astro: true });
	});
	test('相位点 N_Mars_120 → 火星字形 + Asp120 相位字形', ()=>{
		const segs = glyphSegsOf('N_Mars_120');
		expect(segs).toHaveLength(2);
		expect(segs[0].t).toBe(AstroText.AstroMsg.Mars);
		expect(segs[1]).toEqual({ t: AstroText.AstroMsg.Asp120, astro: true });
	});
	test('宫位 House10 → 「10宫」中文段(无字形不硬凑)', ()=>{
		expect(glyphSegsOf('House10')).toEqual([{ t: '10宫', astro: false }]);
	});
	test('界/映点/反映点缀中文', ()=>{
		expect(glyphSegsOf('T_Venus_Aries')[1]).toEqual({ t: '界', astro: false });
		expect(glyphSegsOf('A_Sun')[1]).toEqual({ t: '映', astro: false });
		expect(glyphSegsOf('C_Sun')[1]).toEqual({ t: '反映', astro: false });
	});
	test('行章 = 迫星段 + → + 应星段', ()=>{
		const segs = rowGlyphSegs({ prom: 'N_Mars_120', sig: 'N_Sun_0' });
		expect(segs.map((s)=>s.t).join('')).toBe(`${AstroText.AstroMsg.Mars}${AstroText.AstroMsg.Asp120}→${AstroText.AstroMsg.Sun}`);
	});
	test('估宽:占星字形窄于中文;空段仍 ≥ 内边距', ()=>{
		const a = estSegsWidth([{ t: 'E', astro: true }]);
		const b = estSegsWidth([{ t: '火', astro: false }]);
		expect(a).toBeLessThan(b);
		expect(estSegsWidth([])).toBeGreaterThanOrEqual(10);
	});
});

describe('[G4] 车道装箱(区间防撞)', ()=>{
	test('不撞进同道/撞则下移;每道内区间零重叠', ()=>{
		const evs = [{ x: 10, w: 16 }, { x: 40, w: 16 }, { x: 12, w: 16 }, { x: 14, w: 16 }].map((e, i)=>({ ...e, id: i }));
		const placed = packLanes(evs, 3, 2);
		expect(placed).toHaveLength(4);
		const byLane = {};
		placed.forEach((p)=>{ (byLane[p.lane] = byLane[p.lane] || []).push(p); });
		Object.keys(byLane).forEach((L)=>{
			const arr = byLane[L].sort((a, b)=>a.x - b.x);
			for(let i = 1; i < arr.length; i += 1){
				expect(arr[i].x - arr[i].w / 2).toBeGreaterThanOrEqual(arr[i - 1].x + arr[i - 1].w / 2 + 2 - 1e-9);
			}
		});
	});
	test('全占溢出:落「结束最早」道,一个事件都不丢', ()=>{
		const evs = [];
		for(let i = 0; i < 8; i += 1){ evs.push({ x: 20 + i * 0.5, w: 30, id: i }); }
		const placed = packLanes(evs, 3, 2);
		expect(placed).toHaveLength(8);
		placed.forEach((p)=>{
			expect(p.lane).toBeGreaterThanOrEqual(0);
			expect(p.lane).toBeLessThan(3);
		});
	});
});
