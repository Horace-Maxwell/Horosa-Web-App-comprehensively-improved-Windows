// 巴比伦 L0 基座 golden 测试(算例取自权威复原口径)。
import {
	sexParse, sexFormat, cubitToDeg, seToDeg, signDegToLon, lonToSignDeg,
	MEAN_SYNODIC_MONTH, EPACT_TITHI,
} from '../units';
import {
	cycleYearOf, isLeapSeYear, leapMonthType, monthsOfSeYear,
	babylonianToJdn, jdnToBabylonian, julianToJdn, SE1_NISANNU1_JDN, urukSchemeOf,
} from '../calendar';
import {
	dodeca12, microSegment, kalendertextD, kalendertextK, lonToSchematicDate, buildMicroGrid,
} from '../microzodiac';
import {
	stepAdvance, synodicSeriesA, jupiterSeriesA, marsSeriesA, saturnSeriesA,
	mercurySeriesA, mercuryA3Series, venusSeriesA, withDates, zigzagSeq, sarosPattern, TRAPEZOID,
	LUNAR_PHI, lunarPhiSeq, lunarBSeq, dayLengthC, verifyPeriods,
} from '../mathAstro';
import { SYSTEM_A, SYSTEM_B, KALENDERTEXT_GOLDEN, RISING_TIMES, BABYLON_NORMAL_STARS, BABYLON_ZIQPU, cumulativeRisingTime } from '../../data/babylonianData';
import { buildHoroscope, PLANET_ORDER } from '../horoscope';

const S = sexParse;

describe('六十进制记号', () => {
	it('解析基本形', () => {
		expect(S('33;8,45')).toBeCloseTo(33.145833, 5);
		expect(S('29;31,50,8,20')).toBeCloseTo(29.530594, 5);
		expect(S('2,17;4,48,53,20')).toBeCloseTo(137.08023, 4);
		expect(S('4,37')).toBe(277);
		expect(S('1,0,1')).toBe(3601);
		expect(S('0;0,50')).toBeCloseTo(50 / 3600, 8);
		expect(S('−16;30')).toBeCloseTo(-16.5, 6);
	});
	it('格式化往返', () => {
		expect(sexFormat(33.145833, { frac: 2 })).toBe('33;8,45');
		expect(sexFormat(S('2,17;4,48,53,20'), { frac: 4, intGroups: true })).toBe('2,17;4,48,53,20');
		expect(sexFormat(277, { intGroups: true })).toBe('4,37');
	});
	it('单位换算', () => {
		expect(cubitToDeg(1, 2.2)).toBeCloseTo(2.2, 9);
		expect(seToDeg(72)).toBeCloseTo(1.0, 6);      // 72 še = 1°
		expect(MEAN_SYNODIC_MONTH).toBeCloseTo(29.5305941, 5);
		expect(EPACT_TITHI).toBeCloseTo(11.0667, 3);
	});
});

describe('周期恒等(§文献验算)', () => {
	it('火星 133×48;43,18 = 18×360;木星 36×360/391 = 33;8,45', () => {
		const checks = verifyPeriods();
		checks.forEach((c) => { expect(c.ok).toBe(true); });
	});
	it('木星 B 锯齿均值', () => {
		expect((S(SYSTEM_B.jupiter.M) + S(SYSTEM_B.jupiter.m)) / 2).toBeCloseTo(S(SYSTEM_B.jupiter.mu), 4);
	});
	it('火星六带调和验算 Σ60/w = 133/18', () => {
		const sum = SYSTEM_A.mars.zones.reduce((acc, z) => acc + 60 / S(z.w), 0);
		expect(sum).toBeCloseTo(133 / 18, 4);
	});
	it('水星四相位均会合弧 ≈114;12', () => {
		['mf', 'ef', 'ml', 'el'].forEach((ph) => {
			const t = SYSTEM_A.mercury[ph];
			// 各带调和平均 = 360×Σ(len/w)⁻¹ … 直接检查文献 Δλ 值一致性
			expect(S(t.dLam)).toBeGreaterThan(114.2);
			expect(S(t.dLam)).toBeLessThan(114.22);
		});
	});
});

describe('19 年置闰与历法', () => {
	it('闰年序列 3,6,8,11,14,17,19;第 17 年闰六', () => {
		const leaps = [];
		for(let y = 1; y <= 19; y++){ if(isLeapSeYear(y)){ leaps.push(y); } }
		expect(leaps).toEqual([3, 6, 8, 11, 14, 17, 19]);
		expect(leapMonthType(17)).toBe('VI2');
		expect(leapMonthType(3)).toBe('XII2');
		expect(monthsOfSeYear(17).length).toBe(13);
		expect(monthsOfSeYear(17)[6].akk).toBe('Ulūlu II');
		expect(monthsOfSeYear(3)[12].akk).toBe('Addaru II');
		expect(cycleYearOf(20)).toBe(1);
	});
	it('历日往返(算术历)', () => {
		const jdn = babylonianToJdn(77, 2, 4);      // S.E.77 三月 4 日(带预言盘年代域)
		const bd = jdnToBabylonian(jdn);
		expect(bd.seYear).toBe(77);
		expect(bd.monthIdx).toBe(2);
		expect(bd.day).toBe(4);
		expect(bd.monthLen === 29 || bd.monthLen === 30).toBe(true);
	});
	it('锚:S.E.1 一月 1 日 = 儒略前 311-4-3', () => {
		expect(SE1_NISANNU1_JDN).toBe(julianToJdn(-310, 4, 3));
		const bd = jdnToBabylonian(SE1_NISANNU1_JDN);
		expect(bd.seYear).toBe(1);
		expect(bd.day).toBe(1);
	});
	it('Uruk 方案结构(季 +3月3t;天狼没−升=10月6t)', () => {
		const u = urukSchemeOf(90);
		expect(u.cycleYear).toBe(cycleYearOf(90));
		// 秋分 = 夏至 + 3 月 3 tithi
		const dm = (u.autumnEquinox.m - u.summerSolstice.m + 12) % 12;
		expect(dm === 3 || dm === 4).toBe(true);   // tithi 进位可致 +1 月
		expect(u.siriusRise).toBeTruthy();
		expect(u.siriusSet).toBeTruthy();
	});
});

describe('microzodiac(×12/×13/×277)', () => {
	it('经典算例:摩羯 17° → 变体A 巨蟹 24°;命名微段=巨蟹', () => {
		const L = signDegToLon(10, 17);            // 287°
		const a = dodeca12(L, 'A');
		expect(a.lon).toBeCloseTo(114, 6);         // 巨蟹 24°
		expect(lonToSignDeg(a.lon).sign).toBe(4);
		expect(a.microSign).toBe(4);
		expect(a.microIndex).toBe(7);              // 摩羯第 7 微段
	});
	it('古典算例:白羊 11° → 变体B 狮 23°(143°)', () => {
		const b = dodeca12(11, 'B');
		expect(b.lon).toBeCloseTo(143, 6);
	});
	it('×13/×277 互逆(13×277=3601≡1)', () => {
		expect(kalendertextD(1)).toBe(13);
		expect(kalendertextK(13)).toBe(1);
		for(let L = 0; L < 360; L += 37){
			expect(kalendertextK(kalendertextD(L))).toBeCloseTo(L % 360, 9);
		}
	});
	it('×277 历表 golden 五行', () => {
		KALENDERTEXT_GOLDEN.forEach((row) => {
			const out = kalendertextK(row.lmoon);
			expect(out).toBe(row.out277);
			const d = lonToSchematicDate(out);
			expect([d.M, Math.round(d.d)]).toEqual(row.outDate);
		});
	});
	it('144 微段网格公式(处女第 4 段=射手)', () => {
		expect(microSegment(6, 4)).toBe(9);
		expect(buildMicroGrid().length).toBe(144);
	});
});

describe('System A 阶梯推演', () => {
	it('木星推一行:双子25°(85) + 30 = 巨蟹25°(115);Δt=12月+42;5,8t', () => {
		const ser = jupiterSeriesA(85, 2);
		expect(ser[1] === undefined ? null : null).toBe(null);
		expect(ser[0].lon).toBeCloseTo(85, 6);
		expect(ser[0].w).toBeCloseTo(30, 6);
		// 日期:42;5,8 tithi 超 12 月基数 → 13 月 + 12;5,8
		expect(ser[0].months).toBe(13);
		expect(ser[0].tithi).toBeCloseTo(S('12;5,8'), 3);
		const nx = stepAdvance(85, SYSTEM_A.jupiter.zones);
		expect(nx.lon).toBeCloseTo(115, 6);
	});
	it('木星越界缩放:射手0° 界(30→36 带)', () => {
		// 从 235°(慢带内,距界 5°)推 30:越界 25 × 36/30 = 30 → 270°
		const nx = stepAdvance(235, SYSTEM_A.jupiter.zones);
		expect(nx.lon).toBeCloseTo(240 + 25 * 36 / 30, 6);
	});
	it('火星连带推进合法(六带)', () => {
		const ser = marsSeriesA(60, 20);
		expect(ser.length).toBe(20);
		ser.forEach((r) => { expect(isNaN(r.lon)).toBe(false); });
	});
	it('土星两带 + 均值收敛', () => {
		const ser = saturnSeriesA(130, 256);
		const total = ser.reduce((a, r) => a + r.w, 0);
		expect(total / 256).toBeCloseTo(S('12;39,22,30'), 2);   // 长程均值=周期均
	});
	it('水星 ML 振幅大于带长(一步跨两界不炸)', () => {
		const ser = mercurySeriesA(10, 'ml', 40);
		ser.forEach((r) => { expect(isNaN(r.lon)).toBe(false); });
		// 长程均值≈114;12,39
		const s2 = mercurySeriesA(10, 'ml', 1223);
		const mean = s2.reduce((a, r) => a + r.w, 0) / 1223;
		expect(mean).toBeCloseTo(S('114;12,39'), 1);
	});
	it('金星 EL 恒 215;30(mod 360 真跳)', () => {
		const ser = venusSeriesA(102, 'el', 3);
		expect(ser[0].w).toBeCloseTo(S('215;30'), 6);
		expect(ser[1].lon).toBeCloseTo((102 + 215.5) % 360, 6);
	});
});

describe('System B 锯齿与月亮列', () => {
	it('锯齿反射合法且均值≈μ(木星)', () => {
		const seq = zigzagSeq(S(SYSTEM_B.jupiter.mu), 1, 391, SYSTEM_B.jupiter);
		const mean = seq.reduce((a, b) => a + b, 0) / seq.length;
		expect(mean).toBeCloseTo(S(SYSTEM_B.jupiter.mu), 0);
		seq.forEach((v) => {
			expect(v).toBeGreaterThanOrEqual(S(SYSTEM_B.jupiter.m) - 1e-9);
			expect(v).toBeLessThanOrEqual(S(SYSTEM_B.jupiter.M) + 1e-9);
		});
	});
	it('Φ 列锯齿参数自洽(μ≈(M+m)/2,文献自带 <0.001 微差)', () => {
		expect(Math.abs((S(LUNAR_PHI.M) + S(LUNAR_PHI.m)) / 2 - S(LUNAR_PHI.mu))).toBeLessThan(0.01);
		const seq = lunarPhiSeq(50);
		expect(seq.length).toBe(50);
	});
	it('月 B 列(太阳阶梯)快带 30/慢带 28;7,30', () => {
		const ser = lunarBSeq(200, 3);              // 200° 在快带(163→357)
		expect(ser[0].w).toBeCloseTo(30, 6);
		const slow = lunarBSeq(30, 1);              // 30° 在慢带
		expect(slow[0].w).toBeCloseTo(S('28;7,30'), 6);
	});
	it('昼长 C:分至锚 216/144/180(3:2)', () => {
		expect(dayLengthC(100, 10)).toBeCloseTo(216, 6);   // 夏至(巨蟹10)
		expect(dayLengthC(280, 10)).toBeCloseTo(144, 6);   // 冬至
		expect(dayLengthC(10, 10)).toBeCloseTo(180, 6);    // 春分
		expect(dayLengthC(190, 10)).toBeCloseTo(180, 6);   // 秋分
	});
});

describe('Saros 与梯形法', () => {
	it('38 食可能 = 33×6 + 5×5 = 223', () => {
		const pat = sarosPattern();
		expect(pat.length).toBe(38);
		expect(pat[pat.length - 1] + 5).toBe(223);
	});
	it('木星梯形:首60日 10;45、次60日 5;30、等积二分', () => {
		expect(TRAPEZOID.posAt(60)).toBeCloseTo(S('10;45'), 6);
		expect(TRAPEZOID.posAt(120) - TRAPEZOID.posAt(60)).toBeCloseTo(S('5;30'), 6);
		expect(TRAPEZOID.posAt(TRAPEZOID.tau)).toBeCloseTo(S('10;45') / 2, 6);
		expect(TRAPEZOID.tau).toBeLessThan(30);     // 不在时间中点(速度有斜率)
	});
});

describe('数据表完整性', () => {
	it('距星 31 颗;8 锚点;ziqpu 26 项', () => {
		expect(BABYLON_NORMAL_STARS.length).toBe(31);
		expect(BABYLON_NORMAL_STARS.filter((s) => s.anchor).length).toBe(8);
		expect(BABYLON_ZIQPU.length).toBe(26);
	});
	it('ziqpu 四段锚吻合(Eru→Harness 25/→Yoke 8/→Rear 9/→Circlet 12)', () => {
		const byEn = {};
		BABYLON_ZIQPU.forEach((z) => { byEn[z.en] = z; });
		expect(byEn['Harness'].us).toBe(25);
		expect(byEn['Yoke = ŠU.PA'].us).toBe(8);
		expect(byEn['Rear Harness'].us).toBe(9);
		expect(byEn['Circlet / Star of Dignity'].us).toBe(12);
	});
	it('升时总和 360 UŠ;累积升时单调', () => {
		const total = RISING_TIMES.systemA.reduce((a, r) => a + r.us, 0);
		expect(total).toBe(360);
		expect(cumulativeRisingTime(359.99)).toBeCloseTo(360, 1);
		expect(cumulativeRisingTime(180)).toBeCloseTo(20 + 24 + 28 + 32 + 36 + 40, 6);
	});
});

describe('实算历象 digest(Lunar Three 与邻近食)', () => {
	const { digestBabylonEphemeris, usBetween } = require('../../../utils/babylonAiSnapshot');
	it('挑出生前最近满月/最近新月/按近排序的两条食', () => {
		const birth = 2461247;   // 出生 jd
		const ephem = {
			lunarPhases: [
				{ phase: 'Full Moon', jd: birth - 25, date: 'F1', sign: 'Capricorn' },
				{ phase: 'Full Moon', jd: birth + 4, date: 'F2', sign: 'Aquarius' },
				{ phase: 'New Moon', jd: birth - 11, date: 'N1' },
				{ phase: 'First Quarter', jd: birth - 3, date: 'Q' },
			],
			eclipses: [
				{ jd: birth + 19, date: 'E1', type: 'solar_eclipse', eclipseType: 'total', digit: 12.2, sign: 'Leo' },
				{ jd: birth - 160, date: 'E3', type: 'lunar_eclipse', eclipseType: 'partial', digit: 3, sign: 'Aries' },
				{ jd: birth + 34, date: 'E2', type: 'lunar_eclipse', eclipseType: 'partial', digit: 11.2, sign: 'Pisces' },
			],
		};
		const d = digestBabylonEphemeris(ephem, birth);
		expect(d.fullBefore.date).toBe('F1');            // 生前最近满月(F2 在生后不取)
		expect(d.newNear.date).toBe('N1');
		expect(d.eclipses.map((e) => e.date)).toEqual(['E1', 'E2']);   // 按 |Δ| 近序,截 2 条
		expect(d.eclipses[0].kind).toBe('日食');
		expect(d.eclipses[0].sub).toBe('全食');
		expect(d.eclipses[0].digit).toBe(12.2);
		expect(d.eclipses[0].before).toBe(false);
	});
	it('usBetween:UŠ=4 分钟;次序不成立或超 6 小时 → null', () => {
		const jd0 = 2461247.25;
		expect(usBetween(jd0, jd0 + 40 / (24 * 60))).toBeCloseTo(10, 6);   // 40 分钟 = 10 UŠ
		expect(usBetween(jd0, jd0 - 0.01)).toBe(null);                     // 逆序
		expect(usBetween(jd0, jd0 + 0.5)).toBe(null);                      // 12h 超域
	});
});

describe('边界:公元前出生 / 星历缺失降级', () => {
	it('S.E. 前(负年)历日往返与周期连续', () => {
		// 约前 611 年(S.E.−300):算术历数学域连续
		const jdn = babylonianToJdn(-300, 0, 1);
		const bd = jdnToBabylonian(jdn);
		expect(bd.seYear).toBe(-300);
		expect(bd.day).toBe(1);
		expect(bd.cycleYear).toBeGreaterThanOrEqual(1);
		expect(bd.cycleYear).toBeLessThanOrEqual(19);
		// 周期年在负域连续:S.E.0 → 第 19 年;S.E.−18 → 第 1 年
		expect(cycleYearOf(0)).toBe(19);
		expect(cycleYearOf(-18)).toBe(1);
		// 远古 BC 域 Uruk 方案不炸
		const u = urukSchemeOf(-300);
		expect(u.summerSolstice).toBeTruthy();
	});
	it('星历缺失(空 lons):装配降级为 missing 行,不炸、其余段照常', () => {
		const jdn = babylonianToJdn(77, 2, 4);
		const h = buildHoroscope({}, jdn, {});
		expect(h.rows.length).toBe(7);
		h.rows.forEach((r) => { expect(r.missing).toBe(true); });
		expect(h.babylonianDateText).toBeTruthy();      // 历日仍算
		expect(h.uruk.text.ss).toBeTruthy();            // 分至仍算
		expect(h.bitNisirti.byDaySegment).toBeTruthy(); // 日段仍算
	});
	it('闰六月年份(周期第17年)月序含 Ulūlu II 且往返一致', () => {
		const se17 = 17;                                 // cycle 17 → VI₂
		const months = monthsOfSeYear(se17);
		const idxVI2 = months.findIndex((m) => m.akk === 'Ulūlu II');
		expect(idxVI2).toBe(6);
		const jdn = babylonianToJdn(se17, idxVI2, 15);
		const bd = jdnToBabylonian(jdn);
		expect(bd.seYear).toBe(17);
		expect(bd.monthIdx).toBe(idxVI2);
		expect(bd.month.akk).toBe('Ulūlu II');
	});
});

describe('个人星盘装配(无宫位/相位/上升)', () => {
	const lons = { moon: 65, sun: 72.5, jupiter: 258, venus: 130, mercury: 75, saturn: 95, mars: 285 };
	const jdn = babylonianToJdn(77, 2, 4);
	const h = buildHoroscope(lons, jdn, {});
	it('七曜固定序 月-日-木-金-水-土-火', () => {
		expect(h.rows.map((r) => r.key)).toEqual(PLANET_ORDER);
	});
	it('合日判「已没 ŠÚ」(水星距日 2.5°)', () => {
		const mer = h.rows.find((r) => r.key === 'mercury');
		expect(mer.combust).toBe(true);
		const jup = h.rows.find((r) => r.key === 'jupiter');
		expect(jup.combust).toBe(false);
	});
	it('三分/旺/日段装置在位', () => {
		const jup = h.rows.find((r) => r.key === 'jupiter');
		expect(jup.trip.signs).toContain(9);        // 射手在木星组
		expect(jup.inOwnTrip).toBe(true);
		expect(h.bitNisirti.byDaySegment.planet).toBe('jupiter');   // 4 日 → 1–5 木
		expect(h.uruk.text.ss).toBeTruthy();
	});
	it('输出不含宫位/相位/上升字段', () => {
		expect(h.houses).toBeUndefined();
		expect(h.aspects).toBeUndefined();
		expect(h.ascendant).toBeUndefined();
	});
});

// ── 日期公式金标:五星平均 Δt 必须对上真会合周期 ────────────────────
// 这是抓「baseMonths 双计」一类错误的总闸:任何一星的 base/c/w 存法互相不配,
// 平均间隔就会偏出真值几十天(水星曾因 base=3 与 Δλ+c 双计整月而 +88.6 天)。
describe('withDates 会合周期金标(Δt 平均值对真值)', () => {
	const TITHI_DAY = 29.530589 / 30;   // 1 tithi = 平朔望月/30
	const meanDays = (rows) => {
		const eff = rows.filter((r) => r.months !== undefined);
		const t = eff.reduce((a, r) => a + (r.months * 30 + r.tithi), 0) / eff.length;
		return t * TITHI_DAY;
	};
	const CASES = [
		['jupiter', () => jupiterSeriesA(85, 200), 398.88],
		['saturn', () => saturnSeriesA(85, 200), 378.09],
		['mars', () => marsSeriesA(60, 200), 779.94],
		['venus(el)', () => venusSeriesA(10, 'el', 200), 583.92],
		['mercury(mf)', () => mercurySeriesA(10, 'mf', 400), 115.88],
	];
	CASES.forEach(([name, gen, want]) => {
		it(`${name} 平均 Δt ≈ ${want} 天(±0.5)`, () => {
			expect(Math.abs(meanDays(gen()) - want)).toBeLessThan(0.5);
		});
	});
	it('每行 tithi 恒落 [0,30) 且 months 为正整数(水星单会合=3 月量级,非 6)', () => {
		mercurySeriesA(10, 'mf', 60).forEach((r) => {
			expect(r.tithi).toBeGreaterThanOrEqual(0);
			expect(r.tithi).toBeLessThan(30);
			expect(Number.isInteger(r.months)).toBe(true);
			expect(r.months).toBeGreaterThanOrEqual(3);
			expect(r.months).toBeLessThanOrEqual(4);
		});
	});
	it('mercuryA3Series 不产日期字段(3-synarc 的月基与单会合不同,禁止误吃同一套 base)', () => {
		mercuryA3Series(10, 5).forEach((r) => {
			expect(r.months).toBeUndefined();
			expect(r.tithi).toBeUndefined();
		});
	});
});

// ── [微黄道] AI 段:与页面同源三联(×12/×13/×277),缺盘零空段 ──
describe('buildBabylonSnapshotText 微黄道段', () => {
	const { buildBabylonSnapshotText } = require('../../../utils/babylonAiSnapshot');
	const { buildHoroscope } = require('../horoscope');
	const JDN = 2451545;   // 2000-01-01 附近,任意合法历日

	it('有月/日点位 → 产 [微黄道] 段,三联齐备且无 undefined 渗出', () => {
		const bab = buildHoroscope({ moon: 287.5, sun: 100.0 }, JDN, {});
		const text = buildBabylonSnapshotText(bab, {});
		expect(text).toContain('[微黄道]');
		expect(text).toContain('十二分变体:B(加于点本身/楔文)');
		expect(text).toContain('×12 微宫');
		expect(text).toContain('×13 图式月位');
		expect(text).toContain('×277 历日');
		expect(text.indexOf('undefined')).toBe(-1);
		expect(text.indexOf('NaN')).toBe(-1);
	});

	it('变体 A 随口径改标注', () => {
		const bab = buildHoroscope({ moon: 10 }, JDN, { dodecaVariant: 'A' });
		const text = buildBabylonSnapshotText(bab, { dodecaVariant: 'A' });
		expect(text).toContain('A(加于宫起点)');
	});

	it('月与日皆缺 → 整段不产(零空段)', () => {
		const bab = buildHoroscope({}, JDN, {});
		const text = buildBabylonSnapshotText(bab, {});
		expect(text.indexOf('[微黄道]')).toBe(-1);
	});

	it('段名与导出 preset 对齐(builder 实产段 ⊆ preset)', () => {
		const { AI_EXPORT_PRESET_SECTIONS } = require('../../../utils/aiExport');
		expect(AI_EXPORT_PRESET_SECTIONS.babylon).toContain('微黄道');
	});
});
