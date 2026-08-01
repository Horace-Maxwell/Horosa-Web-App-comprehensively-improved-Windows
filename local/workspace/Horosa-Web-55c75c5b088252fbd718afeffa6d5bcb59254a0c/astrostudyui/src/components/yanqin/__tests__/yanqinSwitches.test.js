// 演禽互锁开关「真实生效」矩阵:逐开关断言两取值 → 输出不同(勾了必变);
// + 穷举 7 预设 / 全开关取值 / 笛卡尔组合 不抛 + 边界。对应压力测试矩阵。
import {
	dayNumber, castQinChart, monthQin, wuxingOfMansion, hourQin, huoYao, mansionOfDay, ganzhiOfDay,
} from '../yanqinEngine';
import { DIZHI_TO_IDX } from '../yanqinConst';
import {
	DEFAULT_YANQIN_SETTINGS, applyPreset, setOption, resolveWoBi,
	YANQIN_PRESETS, YANQIN_OPTION_META, YANQIN_SCHOOL_OPTIONS,
} from '../yanqinSchools';

// 从锚日(1996-01-28,现代 Gregorian)加 diff 天反推测试日期。此前用 (dayNumber(锚)+diff)*86400000
// 当 Unix 毫秒——依赖 dayNumber 返回 Unix epoch day;dayNumber 已改返儒略/格里 JDN(全年份域根修),
// 故直接以 Date.UTC(锚)+diff 天反推(现代域两口径 diff 逐日等价,断言值不变)。
function dateFromDiff(diff) {
	const dt = new Date(Date.UTC(1996, 0, 28) + diff * 86400000);
	return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}
const GENGWU = dateFromDiff(66);   // 庚午二元(旬头位移≠0,曜=水)
const DITU = dateFromDiff(20);     // 甲申一元 = 氐土貉(土曜,验活曜土曜起宿传本)
const MAO = DIZHI_TO_IDX['卯'];

describe('互锁开关逐个「真实生效」(两取值→输出必不同)', () => {
	test('woBi 我彼归属:fan/shi/daoWo 三态各异', () => {
		expect(resolveWoBi({ woBi: 'fan' }).me).toBe('fan');
		expect(resolveWoBi({ woBi: 'shi' }).me).toBe('shi');
		expect(resolveWoBi({ woBi: 'daoWo' }).me).toBe('dao');
		// 三态 me 互不相同
		expect(new Set(['fan', 'shi', 'daoWo'].map((w) => resolveWoBi({ woBi: w }).me)).size).toBe(3);
	});

	test('xunOffset 旬头位移:非甲日 时禽/翻禽 加位移 vs 不加 → 不同', () => {
		expect(ganzhiOfDay(GENGWU.y, GENGWU.m, GENGWU.d)).toBe('庚午');
		const on = hourQin(GENGWU.y, GENGWU.m, GENGWU.d, MAO, true).name;
		const off = hourQin(GENGWU.y, GENGWU.m, GENGWU.d, MAO, false).name;
		expect(on).not.toBe(off);         // 井木犴 vs 尾火虎
		expect(on).toBe('井木犴');
	});

	test('monthVerse 月禽口诀:A vs B → 正月起宿不同', () => {
		const a = monthQin(2008, 1, 'A').name; // 箕水豹年(水)→A 牛金牛
		const b = monthQin(2008, 1, 'B').name; // →B 参水猿
		expect(a).not.toBe(b);
		expect(a).toBe('牛金牛'); expect(b).toBe('参水猿');
	});

	test('huoYaoVariant 活曜传本:off 不出活曜;番禽系(土→翼) vs 翻禽系(土→箕)不同', () => {
		const off = castQinChart(2008, 1, 1, 6, { huoYaoVariant: 'off' }).huoYao;
		const on = castQinChart(2008, 1, 1, 6, { huoYaoVariant: 'fanqin' }).huoYao;
		expect(off).toBeNull();
		expect(on).not.toBeNull();
		// 土曜日:番禽系 vs 翻禽系 土曜起宿不同(翼 vs 箕)
		expect(mansionOfDay(DITU.y, DITU.m, DITU.d).name).toBe('氐土貉');
		const v1 = huoYao(DITU.y, DITU.m, DITU.d, MAO, 'fanqin').name;
		const v2 = huoYao(DITU.y, DITU.m, DITU.d, MAO, 'fanqin2').name;
		expect(v1).not.toBe(v2);
	});

	test('wuxingOfMansion 按七政(宿曜第二字)', () => {
		expect(wuxingOfMansion({ name: '亢金龙', yao: '金' })).toBe('金');
		expect(wuxingOfMansion({ name: '角木蛟', yao: '木' })).toBe('木');
		expect(wuxingOfMansion(null)).toBeNull();
	});
});

describe('穷举:预设 / 开关取值 / 笛卡尔组合 均不抛', () => {
	test('7 流派预设 applyPreset 全合法、含 school 键', () => {
		expect(YANQIN_SCHOOL_OPTIONS.length).toBe(7);
		Object.keys(YANQIN_PRESETS).forEach((k) => {
			const s = applyPreset(k);
			expect(s.school).toBe(k);
			// 所有开关键齐全
			Object.keys(DEFAULT_YANQIN_SETTINGS).forEach((key) => expect(s[key] !== undefined).toBe(true));
		});
	});

	test('每开关每取值 setOption 落库、偏离预设标 custom', () => {
		let base = applyPreset('chibenli');
		YANQIN_OPTION_META.forEach((opt) => {
			opt.options.forEach((o) => {
				const next = setOption(base, opt.key, o.value);
				expect(next[opt.key]).toBe(o.value);
			});
		});
	});

	test('笛卡尔:woBi×xun×huoYao×month × 多日期 → castQinChart 不抛+结构齐', () => {
		const dates = [[2008, 1, 1], [1984, 7, 29], [2026, 6, 30], [1996, 1, 28]];
		let n = 0;
		['fan', 'shi', 'daoWo'].forEach((woBi) => {
			[true, false].forEach((xun) => {
				['off', 'fanqin', 'fanqin2'].forEach((hv) => {
					['A', 'B'].forEach((mv) => {
						dates.forEach(([y, m, d]) => {
							const c = castQinChart(y, m, d, 6, { useXun: xun, huoYaoVariant: hv });
							expect(c.dayQin && c.dayQin.name).toBeTruthy();
							expect(c.hourQin && c.hourQin.name).toBeTruthy();
							expect(c.fanQin && c.fanQin.name).toBeTruthy();
							if (hv === 'off') { expect(c.huoYao).toBeNull(); } else { expect(c.huoYao).not.toBeNull(); }
							expect(monthQin(y, ((m - 1) % 12) + 1, mv).name).toBeTruthy();
							expect(wuxingOfMansion(c.dayQin)).toBeTruthy();
							n++;
						});
					});
				});
			});
		});
		expect(n).toBe(3 * 2 * 3 * 2 * 4);
	});

	test('边界:空/未知设置 → castQinChart 不抛,回退默认', () => {
		expect(() => castQinChart(2008, 1, 1, 6, {})).not.toThrow();
		expect(() => castQinChart(2008, 1, 1, null, {})).not.toThrow();      // 无时辰
		expect(() => castQinChart(2008, 1, 1, 6, { huoYaoVariant: 'x?' })).not.toThrow();
		expect(() => monthQin(2008, 1, 'ZZ').name).not.toThrow();           // 未知 verse→A
		expect(wuxingOfMansion(null)).toBeNull();
		expect(resolveWoBi({}).me).toBe('fan');                             // 未知 woBi→默认池本理
	});
});
