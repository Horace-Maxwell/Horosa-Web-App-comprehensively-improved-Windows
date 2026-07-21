// 域外农历拼装金标:朔表定月日/节表定月柱/纯公式干支(口径=干支连续循环,公元4年甲子)。
import { assembleNongliFromTables, yearGanzhiByAstroYear } from '../divinationTimeDraft';
import { getDayGanZhi } from '../localNongliAdapter';

describe('域外农历拼装(deriveNongliRemote 纯函数层)', () => {
	test('干支连续纪年:经典锚点', () => {
		expect(yearGanzhiByAstroYear(2026)).toBe('丙午');
		expect(yearGanzhiByAstroYear(1984)).toBe('甲子');
		expect(yearGanzhiByAstroYear(4)).toBe('甲子');
		// BC722(鲁隐公元年,天文年 -721)史称己未年
		expect(yearGanzhiByAstroYear(-721)).toBe('己未');
		// 域外远年照算(连续循环)
		expect(yearGanzhiByAstroYear(12000)).toBe(yearGanzhiByAstroYear(12000 - 60));
	});

	test('日干支纯公式与 lunar-js 域内一致锚(2026-07-19=甲午)', () => {
		expect(getDayGanZhi(2026, 7, 19)).toBe('甲午');
	});

	test('朔表+节表拼装:月日定位/闰标/月柱五虎遁/时柱五鼠遁', () => {
		// 构造:天文年 12000,六月初三;朔表两月(五月朔 6104120、六月朔 6104150 之样式用真实日期串)
		const months = [
			{ date: '12000-06-10', name: '五月', year: '庚申', leap: 0, ad: 1 },
			{ date: '12000-07-09', name: '六月', year: '庚申', leap: 0, ad: 1 },
			{ date: '12000-08-08', name: '七月', year: '庚申', leap: 1, ad: 1 },
		];
		// 节表:芒种(午月界)在 6/15 前、小暑在其后;立春远在年初(birthJDN 远大于立春)
		const jieqi = [
			{ jieqi: '立春', jie: true, jdn: 5000000 },
			{ jieqi: '芒种', jie: true, jdn: 6104117.99 },
			{ jieqi: '小暑', jie: true, jdn: 6104147.5 },
		];
		const birthJDN = 6104135.0; // 芒种后小暑前 → 午月
		const out = assembleNongliFromTables({ ay: 12000, month: 6, day: 15, hour: 10 }, months, jieqi, birthJDN);
		expect(out).toBeTruthy();
		expect(out.monthInt).toBe(5);         // 落在五月朔区间
		expect(out.dayInt).toBe(6);           // 6/15 - 6/10 + 1
		expect(out.leap).toBe(false);
		expect(out.yearGZByLunar).toBe('庚申');
		// 八字年柱=立春界(已过立春)=天文年 12000 → 与连续纪年一致
		expect(out.bazi.year.ganzi).toBe(yearGanzhiByAstroYear(12000));
		// 月柱:年干庚 → 五虎遁 戊寅起 → 午月=壬午
		expect(out.bazi.month.ganzi).toBe('壬午');
		// 时柱:10 点=巳时;日干由公式,时干五鼠遁自洽(支必为巳)
		expect(out.bazi.time.ganzi.charAt(1)).toBe('巳');
		// 闰月标:七月 leap=1 时,落入七月区间的日期 leap=true
		const out2 = assembleNongliFromTables({ ay: 12000, month: 8, day: 10, hour: 0 }, months, jieqi, 6104190);
		expect(out2.leap).toBe(true);
	});

	test('朔区间外(表不含目标日)返回 null 不猜', () => {
		const months = [{ date: '12000-06-10', name: '五月', year: '庚申', leap: 0, ad: 1 }];
		expect(assembleNongliFromTables({ ay: 11000, month: 1, day: 1, hour: 0 }, months, [], 0)).toBeNull();
	});

	test('🔴 BC 朔表·无 0 年↔有 0 年双约定同轴(真机:一掌经 BC 生年支/农历日;申应未·日28应16)', () => {
		// 真机根因(2026-07-20 终修):后端 /jieqi 月表用「无 0 年」显示年(BC12026 请求 year=-12026、
		// 月表 date='-12026-07-05'、与 Java ad×year/extreme_pillars 同轴,BC12026=乙未);getOnlyDateNum
		// 与目标 ay 用「有 0 年」天文年(BC12026=-12025)。二者对 BC 差 1 年——桥若把 ay(-12025)当作
		// /jieqi 请求年,后端返晚 1 年(丙申=BC12025)月表 → 一掌经生年支=申(应未)、农历日=28(应16),
		// 且四柱年却仍=乙未(自相矛盾=铁证)。修:/jieqi 传无 0 年 jieqiYear(-12026)+ jdnOfDateStr 负年
		// 1-|y| 归有 0 年,与 tJdn(getOnlyDateNum(ay)) 同轴。数据=真机 BC 12026 实测后端形状(三连朔)。
		const months = [
			{ date: '-12026-07-05', name: '三月', year: '乙未', leap: 0, ad: -1 },
			{ date: '-12026-08-04', name: '四月', year: '乙未', leap: 0, ad: -1 },
			{ date: '-12026-09-02', name: '五月', year: '乙未', leap: 0, ad: -1 },
		];
		const jieqi = [
			{ jieqi: '立春', jie: true, jdn: -2670990 },
			{ jieqi: '清明', jie: true, jdn: -2670890.557 }, // 辰月界(≤生辰 → 月柱庚辰)
			{ jieqi: '立夏', jie: true, jdn: -2670860 },
		];
		// 目标=用户实测 BC12026-07-20(有 0 年 ay=-12025);birthJDN 后端实测 -2670873.33(清明后=辰月)
		const out = assembleNongliFromTables({ ay: -12025, month: 7, day: 20, hour: 12 }, months, jieqi, -2670873.333);
		expect(out).toBeTruthy();
		expect(out.monthInt).toBe(3);
		expect(out.dayInt).toBe(16);              // 07-20 - 三月朔 07-05 + 1(真机紫微=三月十六,非旧焊入的 28)
		expect(out.yearGZByLunar).toBe('乙未');    // 生年支=未羊(非旧焊入的丙申/申),与四柱年一致
		expect(out.bazi.year.ganzi).toBe('乙未');
		expect(out.bazi.year.ganzi).toBe(yearGanzhiByAstroYear(-12025));
		expect(out.bazi.month.ganzi).toBe('庚辰'); // 辰月·乙年五虎遁(与八字盘月柱一致)
		expect(out.bazi.day.ganzi).toBe(getDayGanZhi(-12025, 7, 20)); // 日柱=庚辰(与八字盘一致)
	});
});
