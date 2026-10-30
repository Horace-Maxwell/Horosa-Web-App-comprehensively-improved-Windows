// 时主类星运(129 年系统 / Balbillus)每个选项档的含义 —— 页面、AI 挂载齿轮等各处共用这两个引擎,
// 这里逐档钉死「选了这一档,结果按定义怎么变」。数字全按定义手算(序数度 / 小年 / 年长),不取引擎自身输出当期望。
import { computeYearSystem129, yearSystem129Order, YS129_START_OPTIONS, YS129_SECT_START } from '../yearSystem129';
import { buildBalbillusContext, buildBalbillusRoots, buildBalbillusChildren, balbillusDistance, BALBILLUS_EXALT } from '../balbillus';

// 本命七星黄经(度)。按黄经升序:土 9.48 → 月 73.57 → 火 137.08 → 木 143.94 → 金 207.87 → 日 215.55 → 水 229.41
const LONS = { Sun: 215.5451, Moon: 73.5725, Mercury: 229.4145, Venus: 207.8709, Mars: 137.0786, Jupiter: 143.9438, Saturn: 9.4822 };
const mkChart = (isDiurnal)=>({
	params: { birth: '2000-01-01 12:00:00', zone: '+00:00' },
	chart: { isDiurnal, objects: Object.keys(LONS).map((id)=>({ id, lon: LONS[id] })) },
});
const NIGHT = mkChart(false);
const DAY = mkChart(true);
const MINOR = { Saturn: 30, Jupiter: 12, Mars: 15, Sun: 19, Venus: 8, Mercury: 20, Moon: 25 };
const YEAR_DAYS = { solar: 365.242199, sidereal: 365.256363, hellenistic: 360, abumashar: 365.25833, mashaallah: 365.259028, bija: 366.256399 };
const close = (a, b, tol = 1e-6)=>expect(Math.abs(a - b)).toBeLessThan(tol);

describe('129 年系统 · 选项档', ()=>{
	test('起始星八档:首段主星 = 所选星;区分光体昼生太阳、夜生月亮', ()=>{
		expect(YS129_START_OPTIONS).toEqual(['sect', 'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']);
		YS129_START_OPTIONS.filter((p)=>p !== YS129_SECT_START).forEach((p)=>{
			expect([p, computeYearSystem129(NIGHT, { startPlanet: p }).rows[0].mainDirect]).toEqual([p, p]);
		});
		expect(computeYearSystem129(DAY, { startPlanet: 'sect' }).rows[0].mainDirect).toBe('Sun');
		expect(computeYearSystem129(NIGHT, { startPlanet: 'sect' }).rows[0].mainDirect).toBe('Moon');
	});
	test('次序两档:黄道顺序 = 本命黄经升序转到起始星;迦勒底序 = 土木火日金水月转到起始星', ()=>{
		expect(yearSystem129Order(NIGHT, { order: 'zodiacal', startPlanet: 'Sun' })).toEqual(['Sun', 'Mercury', 'Saturn', 'Moon', 'Mars', 'Jupiter', 'Venus']);
		expect(yearSystem129Order(NIGHT, { order: 'chaldean', startPlanet: 'Sun' })).toEqual(['Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars']);
		expect(computeYearSystem129(NIGHT, { order: 'chaldean', startPlanet: 'Mars' }).rows.slice(0, 7).map((r)=>r.mainDirect))
			.toEqual(['Mars', 'Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter']);
	});
	test('年制六档:主限天数 = 小年 × 年长,起点逐段累加', ()=>{
		Object.keys(YEAR_DAYS).forEach((yt)=>{
			const { rows } = computeYearSystem129(NIGHT, { yearType: yt });
			let t = 0;
			rows.slice(0, 8).forEach((r)=>{
				close(r.durDays, MINOR[r.mainDirect] * YEAR_DAYS[yt], 1e-6);
				close(r.startDays, t, 1e-6);
				close(r.durYears, MINOR[r.mainDirect], 1e-9);
				t += r.durDays;
			});
		});
	});
	test('子限铺法三档:日数法 = 子星小年 × ⌊2.5 × 主星小年⌋ 日不填满;比例法 = 主限 × 子星小年 ⁄ 129 填满;七等分 = 主限 ⁄ 7', ()=>{
		const days = computeYearSystem129(NIGHT, { subRule: 'days' }).rows[0];   // 太阳主限:⌊2.5 × 19⌋ = 47 日
		expect(days.subDirect.map((s)=>[s.subDirect, s.durDays])).toEqual([['Sun', 893], ['Mercury', 940], ['Saturn', 1410], ['Moon', 1175], ['Mars', 705], ['Jupiter', 564], ['Venus', 376]]);
		expect(days.subDirect.reduce((a, s)=>a + s.durDays, 0)).toBe(129 * 47);
		const sat = computeYearSystem129(NIGHT, { subRule: 'days' }).rows[2];   // 土星主限:⌊2.5 × 30⌋ = 75 日
		expect(sat.mainDirect).toBe('Saturn');
		expect(sat.subDirect[0].durDays).toBe(30 * 75);
		const prop = computeYearSystem129(NIGHT, { subRule: 'proportional' }).rows[0];
		prop.subDirect.forEach((s)=>close(s.durDays, prop.durDays * MINOR[s.subDirect] / 129, 1e-6));
		close(prop.subDirect.reduce((a, s)=>a + s.durDays, 0), prop.durDays, 1e-6);
		const eq = computeYearSystem129(NIGHT, { subRule: 'equal' }).rows[0];
		eq.subDirect.forEach((s)=>close(s.durDays, eq.durDays / 7, 1e-6));
		// 子限起点从主限起点连续铺开,次序与主限同一序、从本主限星起
		expect(eq.subDirect.map((s)=>s.subDirect)).toEqual(['Sun', 'Mercury', 'Saturn', 'Moon', 'Mars', 'Jupiter', 'Venus']);
		close(eq.subDirect[3].startDays, eq.durDays * 3 / 7, 1e-6);
	});
});

describe('Balbillus · 选项档', ()=>{
	// N′ × (360 − d) ⁄ 360,d = 序数度(⌊黄经⌋ + 1)离擢升度的整度角距(最近角距)
	const N1 = { Sun: 18, Moon: 24, Saturn: 30, Jupiter: 12, Mars: 14, Venus: 8, Mercury: 20 };
	const D_NEAREST = { Sun: 163, Mercury: 65, Saturn: 169, Moon: 41, Mars: 160, Jupiter: 39, Venus: 149 };
	const D_FORWARD = { Sun: 197, Mercury: 65, Saturn: 169, Moon: 41, Mars: 200, Jupiter: 39, Venus: 211 };
	const roots = (opts)=>{ const ctx = buildBalbillusContext(NIGHT, { maxAge: 200, ...opts }); return { ctx, roots: buildBalbillusRoots(ctx) }; };
	test('距离口径两档:最近角距取两向较近一边;顺黄道距 = 自擢升度顺黄道量到本命星序数度', ()=>{
		Object.keys(LONS).forEach((p)=>{
			expect([p, balbillusDistance(LONS[p], BALBILLUS_EXALT[p], 'nearest')]).toEqual([p, D_NEAREST[p]]);
			expect([p, balbillusDistance(LONS[p], BALBILLUS_EXALT[p], 'forward')]).toEqual([p, D_FORWARD[p]]);
		});
		const fwd = roots({ mode: 'forward' }).roots;
		fwd.slice(0, 7).forEach((r)=>close(r.durYears, N1[r.planet] * (360 - D_FORWARD[r.planet]) / 360, 1e-9));
	});
	test('起始星七档:首段主星 = 所选星,其后按本命黄经序', ()=>{
		['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'].forEach((p)=>{
			expect([p, roots({ startPlanet: p }).roots[0].planet]).toEqual([p, p]);
		});
		expect(roots({ startPlanet: 'Moon' }).roots.slice(0, 7).map((r)=>r.planet)).toEqual(['Moon', 'Mars', 'Jupiter', 'Venus', 'Sun', 'Mercury', 'Saturn']);
	});
	test('年制六档:主限天数 = N′ ×(360 − d)⁄ 360 × 年长', ()=>{
		Object.keys(YEAR_DAYS).forEach((yt)=>{
			roots({ yearType: yt }).roots.slice(0, 7).forEach((r)=>{
				close(r.durDays, N1[r.planet] * (360 - D_NEAREST[r.planet]) / 360 * YEAR_DAYS[yt], 1e-6);
			});
		});
	});
	test('子限铺法三档:一轮 = 各星上一层 ÷ 12 不填满;循环 = 一轮接一轮截到父期末;填满 = 一轮末段拉长到父期末', ()=>{
		const once = roots({ subRule: 'once' });
		const sun = once.roots[0];
		const kids = buildBalbillusChildren(once.ctx, sun);
		expect(kids.map((k)=>k.planet)).toEqual(['Sun', 'Mercury', 'Saturn', 'Moon', 'Mars', 'Jupiter', 'Venus']);
		kids.forEach((k)=>close(k.durDays, N1[k.planet] * (360 - D_NEAREST[k.planet]) / 360 * YEAR_DAYS.solar / 12, 1e-6));
		const sumOnce = kids.reduce((a, k)=>a + k.durDays, 0);
		expect(sumOnce).toBeLessThan(sun.durDays);
		const cyc = roots({ subRule: 'cycle' });
		const kc = buildBalbillusChildren(cyc.ctx, cyc.roots[0]);
		expect(kc.length).toBeGreaterThan(7);
		expect(kc.slice(7, 14).map((k)=>k.planet)).toEqual(kids.map((k)=>k.planet).slice(0, kc.slice(7, 14).length));
		close(kc[kc.length - 1].startDays + kc[kc.length - 1].durDays, cyc.roots[0].durDays, 1e-6);
		const fill = roots({ subRule: 'fill' });
		const kf = buildBalbillusChildren(fill.ctx, fill.roots[0]);
		expect(kf).toHaveLength(7);
		kf.slice(0, 6).forEach((k, i)=>close(k.durDays, kids[i].durDays, 1e-6));
		close(kf[6].startDays + kf[6].durDays, fill.roots[0].durDays, 1e-6);
	});
});
