// 月相推运按星历精算:各相起始岁数 = 推运日月差(出生后第 N 天真实的月日黄经差)恰到 45° 边界的时刻。
// 期望值由 Swiss Ephemeris 独立求得(同一出生时刻逐日月日黄经差、二分求边界),本引擎用另一套星历(astronomy-engine)+ 本命差起点,
// 两者应在 0.002 年(约 0.7 天)内一致;平均速率旧算法在同一张盘上最多差 1.3 年。
import { buildLunationPhases, phaseAtAge, progressedElongAtAge, birthJdUtOfChart } from '../lunationPhase';

const SUN = 56.885877;   // 1990-05-18 10:00 +08:00(UT 02:00)Swiss Ephemeris 回归黄经
const MOON = 330.057698;
const chartObj = {
	params: { birth: '1990-05-18 10:00:00', zone: '+08:00' },
	chart: { objects: [{ id: 'Sun', lon: SUN }, { id: 'Moon', lon: MOON }] },
};
const SWISS = [3.22741, 6.40773, 9.64278, 13.25742, 17.26097, 21.37578, 25.3817, 29.11646, 32.49922, 35.70456, 39.06759, 42.8385, 46.92078, 50.97466, 54.80805, 58.37762, 61.72677, 65.03767, 68.57748, 72.50097, 76.60255, 80.51349, 84.13697, 87.57942];

describe('月相推运 · 星历精算', ()=>{
	test('出生时刻 → 世界时儒略日(民用历 + 时区)', ()=>{
		expect(birthJdUtOfChart(chartObj)).toBeCloseTo(2448029.583333, 5);
		expect(birthJdUtOfChart({ params: { birth: '2000-01-01 12:00:00', zone: '+00:00' } })).toBeCloseTo(2451545.0, 6);
	});
	test('各相起始岁数与 Swiss Ephemeris 独立解一致(≤ 0.002 年)', ()=>{
		const r = buildLunationPhases(chartObj, { maxAge: 90 });
		expect(r.exact).toBe(true);
		const ages = r.timeline.filter((t)=>!t.isStart).map((t)=>t.age);
		expect(ages).toHaveLength(SWISS.length);
		ages.forEach((a, i)=>expect([i, Math.abs(a - SWISS[i]) < 0.002]).toEqual([i, true]));
		// 相序:本命在下弦(273°)→ 首个边界 315° 残月,再到 0° 朔
		expect(r.timeline[1].phase.key).toBe('balsamic');
		expect(r.timeline[2].phase.key).toBe('new');
	});
	test('推运日月差连续单调,边界处恰为 45° 的整数倍;平均速率与精算明显不同', ()=>{
		const r = buildLunationPhases(chartObj, { maxAge: 90 });
		r.timeline.slice(1).forEach((t)=>{
			const e = progressedElongAtAge(chartObj, t.age);
			expect(Math.abs(((e % 45) + 45) % 45 < 22.5 ? ((e % 45) + 45) % 45 : ((e % 45) + 45) % 45 - 45)).toBeLessThan(1e-6);
		});
		let prev = -Infinity;
		for(let a = 0; a <= 90; a += 0.37){ const e = progressedElongAtAge(chartObj, a); expect(e).toBeGreaterThan(prev); prev = e; }
		const linear = (315 - (MOON - SUN + 360) % 360) / (360 / 29.530588853);
		expect(Math.abs(r.timeline[1].age - linear)).toBeGreaterThan(0.05);
		expect(phaseAtAge(chartObj, 3.0).key).toBe('last');
		expect(phaseAtAge(chartObj, 3.3).key).toBe('balsamic');
	});
	test('出生时刻读不出时退回平均速率并如实标注', ()=>{
		const r = buildLunationPhases({ params: {}, chart: chartObj.chart }, { maxAge: 30 });
		expect(r.exact).toBe(false);
		expect(r.timeline.length).toBeGreaterThan(1);
	});
});
