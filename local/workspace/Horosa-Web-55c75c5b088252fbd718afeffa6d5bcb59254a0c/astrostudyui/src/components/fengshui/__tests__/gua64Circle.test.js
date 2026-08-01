// 六十四卦圆图（伏羲先天方圆图之圆图）：结构、度数落卦落爻、与 dagua 的接线。
// 结构判据（可推不臆造）：八卦宫按先天方位各辖 45°＝三山；宫界与二十四山界严丝合缝；
// 起点 337.5°（坤宫首卦天地否）＝古法「自坤(北偏)起顺布乾兑离震巽坎艮坤之重卦」。
import { GUA64_CIRCLE, GUA64_CIRCLE_META, XIANTIAN_DEG, XIANTIAN_ORDER8, GUA64_TABLE, SHAN_CENTER_DEG, YAO_NAMES } from '../fengshuiData';
import { gua64AtDeg, shanAtDeg } from '../liqiCore';
import { dagua } from '../dagua';

const norm = (d)=>((d % 360) + 360) % 360;

describe('圆图结构', ()=>{
	it('64 卦不重不漏，卦名与重卦表一致', ()=>{
		expect(GUA64_CIRCLE.length).toBe(64);
		expect(new Set(GUA64_CIRCLE.map((g)=>g.name)).size).toBe(64);
		GUA64_CIRCLE.forEach((g)=>{ expect(g.name).toBe(GUA64_TABLE[g.lower][g.upper]); });
	});

	it('首尾相衔无缝，每卦恰 5.625°', ()=>{
		expect(GUA64_CIRCLE_META.degPerGua).toBeCloseTo(360 / 64, 10);
		expect(GUA64_CIRCLE_META.degPerYao).toBeCloseTo(360 / 384, 10);
		expect(GUA64_CIRCLE[0].name).toBe('天地否');
		expect(GUA64_CIRCLE[0].deg0).toBeCloseTo(GUA64_CIRCLE_META.startDeg, 9);
		for (let i = 0; i < 64; i++) {
			const cur = GUA64_CIRCLE[i]; const nxt = GUA64_CIRCLE[(i + 1) % 64];
			expect(norm(cur.deg1 - cur.deg0)).toBeCloseTo(5.625, 9);
			expect(norm(nxt.deg0 - cur.deg1)).toBeCloseTo(0, 9);
		}
	});

	it('乾南坤北离东坎西；八宫各辖三山，宫界＝二十四山界', ()=>{
		expect(XIANTIAN_DEG['乾']).toBe(180);
		expect(XIANTIAN_DEG['坤']).toBe(0);
		expect(XIANTIAN_DEG['离']).toBe(90);
		expect(XIANTIAN_DEG['坎']).toBe(270);
		XIANTIAN_ORDER8.forEach((g)=>{
			const cells = GUA64_CIRCLE.filter((c)=>c.sector === g);
			expect(cells.length).toBe(8);
			const c0 = norm(XIANTIAN_DEG[g] - 22.5); const c1 = norm(XIANTIAN_DEG[g] + 22.5);
			// 宫内八卦度数恰覆盖 [c0, c0+45)
			cells.forEach((c)=>{ expect(norm(c.deg0 - c0)).toBeLessThan(45); });
			// 宫界落在山界上（山界＝山中心 ±7.5）
			[c0, c1].forEach((b)=>{
				const hit = Object.keys(SHAN_CENTER_DEG).some((s)=>Math.abs(norm(b - SHAN_CENTER_DEG[s] - 7.5)) < 1e-6);
				expect(hit).toBe(true);
			});
		});
		// 坤宫恰辖壬子癸三山
		const kun = GUA64_CIRCLE.filter((c)=>c.sector === '坤');
		expect(new Set(kun.map((c)=>shanAtDeg(c.center)))).toEqual(new Set(['壬', '子', '癸']));
	});
});

describe('度数落卦落爻', ()=>{
	it('边界：0° / 5.625° / 337.5° / 359.9° 各落其卦', ()=>{
		expect(gua64AtDeg(337.5).gua).toBe('天地否');
		expect(gua64AtDeg(337.5).guaIndex).toBe(0);
		expect(gua64AtDeg(0).gua).toBe('风地观');
		expect(gua64AtDeg(5.625).gua).toBe('水地比');
		expect(gua64AtDeg(359.9).gua).toBe('雷地豫');
		expect(gua64AtDeg(360).gua).toBe(gua64AtDeg(0).gua);
		expect(gua64AtDeg(-0.1).gua).toBe(gua64AtDeg(359.9).gua);
	});

	it('全周 0.05° 步扫描：恰 64 卦，每卦恰 6 爻，爻名封闭', ()=>{
		const seen = {};
		for (let d = 0; d < 360; d += 0.05) {
			const r = gua64AtDeg(d);
			expect(YAO_NAMES).toContain(r.yao);
			expect(r.yaoIndex).toBeGreaterThanOrEqual(0);
			expect(r.yaoIndex).toBeLessThanOrEqual(5);
			expect(r.degInGua).toBeGreaterThanOrEqual(0);
			expect(r.degInGua).toBeLessThan(5.626);
			seen[r.gua] = seen[r.gua] || new Set();
			seen[r.gua].add(r.yaoIndex);
		}
		expect(Object.keys(seen).length).toBe(64);
		Object.keys(seen).forEach((k)=>{ expect(seen[k].size).toBe(6); });
	});

	it('落卦回读一致：每卦中心度回落本卦；shan 与 shanAtDeg 同源', ()=>{
		GUA64_CIRCLE.forEach((g)=>{
			const r = gua64AtDeg(g.center);
			expect(r.gua).toBe(g.name);
			expect(r.guaIndex).toBe(g.index);
			expect(r.lower).toBe(g.lower);
			expect(r.upper).toBe(g.upper);
			expect(r.shan).toBe(shanAtDeg(g.center));
		});
	});
});

describe('dagua 接线', ()=>{
	it('🔴 不给 deg 时与旧版逐字节一致（手选上下卦零回归）', ()=>{
		const manual = dagua({ xiangLower: '乾', xiangUpper: '乾', yun: 9 });
		expect(JSON.stringify(dagua({ xiangLower: '乾', xiangUpper: '乾', yun: 9, deg: '' }))).toBe(JSON.stringify(manual));
		expect(JSON.stringify(dagua({ xiangLower: '乾', xiangUpper: '乾', yun: 9, deg: null }))).toBe(JSON.stringify(manual));
		expect(JSON.stringify(dagua({ xiangLower: '乾', xiangUpper: '乾', yun: 9, deg: 'abc' }))).toBe(JSON.stringify(manual));
		expect(manual.deg).toBeNull();
		expect(manual.degInfo).toBeNull();
	});

	it('给 deg 则由圆图回填上下卦，与手选同卦时结果等价', ()=>{
		const byDeg = dagua({ yun: 9, deg: 199.7 });
		expect(byDeg.xiang.name).toBe('乾为天');
		expect(byDeg.degInfo.yao).toBeTruthy();
		const manual = dagua({ xiangLower: '乾', xiangUpper: '乾', yun: 9 });
		expect(byDeg.xiang.yun).toBe(manual.xiang.yun);
		expect(byDeg.zuo.name).toBe(manual.zuo.name);
		// 全 64 卦逐个用其中心度反查，回填必等于该卦
		GUA64_CIRCLE.forEach((g)=>{
			const r = dagua({ yun: 9, deg: g.center });
			expect(r.xiang.name).toBe(g.name);
			expect(r.xiang.lower).toBe(g.lower);
			expect(r.xiang.upper).toBe(g.upper);
		});
	});
});
