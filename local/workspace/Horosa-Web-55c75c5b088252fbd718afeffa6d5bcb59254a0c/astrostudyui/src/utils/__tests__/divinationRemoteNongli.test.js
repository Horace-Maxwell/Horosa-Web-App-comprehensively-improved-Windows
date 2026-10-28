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

describe('域外农历:时间算法与晚子时(与本地引擎同口径)', () => {
	const { shiftClockForTimeAlg, dateOfJdn } = require('../divinationTimeDraft');
	const { getOnlyDateNum } = require('../localNongliAdapter');
	test('儒略 / 格里日序互逆(含公元前与 1582 切换两侧)', () => {
		[[-7040, 7, 19], [-4, 2, 29], [-50000, 1, 1], [1582, 10, 4], [1582, 10, 15], [2026, 2, 28], [12000, 12, 31]].forEach(([y, m, d]) => {
			expect(dateOfJdn(getOnlyDateNum(y, m, d))).toEqual({ year: y, month: m, day: d });
		});
		expect(getOnlyDateNum(1582, 10, 15) - getOnlyDateNum(1582, 10, 4)).toBe(1);
	});
	test('🔴 直接时间 / 没给不换;平太阳时只换经度时差;真太阳时再加均时差;跨日进位', () => {
		const t = { ay: 12000, month: 6, day: 15, hour: 23, minute: 50, second: 0 };
		expect(shiftClockForTimeAlg(t, { timeAlg: 1, lon: '121e28', zone: '+08:00' })).toEqual(t);
		expect(shiftClockForTimeAlg(t, { lon: '121e28', zone: '+08:00' })).toEqual(t);
		// 121°28′ 东经,东八区:经度时差 = (121.4667-120)×4 分 ≈ +5 分 52 秒 → 23:55:52
		const mean = shiftClockForTimeAlg(t, { timeAlg: 3, lon: '121e28', zone: '+08:00' });
		expect(mean).toEqual({ ay: 12000, month: 6, day: 15, hour: 23, minute: 55, second: 52 });
		// 真太阳时 = 平太阳时再加均时差(与本地引擎同一公式;11 月初均时差约 +16 分)
		const { equationOfTimeAtJd } = require('../baziLunarLocal');
		const nov = { ay: 2026, month: 11, day: 3, hour: 10, minute: 0, second: 0 };
		const s3 = shiftClockForTimeAlg(nov, { timeAlg: 3, lon: '121e28', zone: '+08:00' });
		const s0 = shiftClockForTimeAlg(nov, { timeAlg: 0, lon: '121e28', zone: '+08:00' });
		const secs = (x) => x.hour * 3600 + x.minute * 60 + x.second;
		const jd = getOnlyDateNum(2026, 11, 3) - 0.5 + (10 - 8) / 24;
		expect(Math.abs(secs(s0) - secs(s3) - equationOfTimeAtJd(jd) * 60)).toBeLessThanOrEqual(1);
		expect(secs(s0) - secs(s3)).toBeGreaterThan(15 * 60);
		// 乌鲁木齐 87°36′ 东经,东八区,凌晨 00:30:平太阳时 ≈ 前一日 22:20(换日)
		const back = shiftClockForTimeAlg({ ay: -2000, month: 3, day: 1, hour: 0, minute: 30, second: 0 }, { timeAlg: 3, lon: '87e36', zone: '+08:00' });
		expect([back.month, back.day, back.hour]).toEqual([2, 29, 22]);   // 天文年 -2000 能被 4 整除 = 儒略闰年,前一日是 2 月 29 日
	});
	test('晚子时:默认日柱不进位、时干用次日日干;23 点算第二天 → 日柱进位;晚子时用今日干 → 时干用今日', () => {
		const months = [{ date: '12000-06-10', name: '五月', year: '庚申', leap: 0, ad: 1 }, { date: '12000-07-09', name: '六月', year: '庚申', leap: 0, ad: 1 }];
		const jieqi = [{ jieqi: '立春', jie: true, jdn: 5000000 }, { jieqi: '芒种', jie: true, jdn: 6104117.99 }];
		const base = { ay: 12000, month: 6, day: 15, hour: 23 };
		const today = getDayGanZhi(12000, 6, 15);
		const next = getDayGanZhi(12000, 6, 16);
		const hourFrom = (gan) => { const G = '甲乙丙丁戊己庚辛壬癸'; return `${G[((G.indexOf(gan) % 5) * 2) % 10]}子`; };
		const d0 = assembleNongliFromTables(base, months, jieqi, 6104135);
		expect(d0.bazi.day.ganzi).toBe(today);
		expect(d0.bazi.time.ganzi).toBe(hourFrom(next.charAt(0)));
		const d1 = assembleNongliFromTables({ ...base, after23NewDay: 1 }, months, jieqi, 6104135);
		expect(d1.bazi.day.ganzi).toBe(next);
		const d2 = assembleNongliFromTables({ ...base, lateZiHourUseNextDay: 0 }, months, jieqi, 6104135);
		expect(d2.bazi.time.ganzi).toBe(hourFrom(today.charAt(0)));
	});
});
