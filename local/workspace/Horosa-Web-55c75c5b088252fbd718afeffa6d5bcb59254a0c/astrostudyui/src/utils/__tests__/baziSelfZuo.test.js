/**
 * 星运 / 自坐 十二长生 golden（getSelfZuo）。
 * 星运 = 日干在各支长生；自坐 = 本柱干自坐本柱支长生。阳干顺行、阴干逆行。
 */
import { getSelfZuo, hiddenStemsOf, xunKongOf, buildLocalBaziResult, resolveDiShiByPhaseType } from '../baziLunarLocal';

describe('getSelfZuo 十二长生', () => {
	test.each([
		['丁', '午', '临官'], // 日主丁在午（星运·年柱）
		['丁', '卯', '病'],
		['丁', '酉', '长生'],
		['丙', '午', '帝旺'], // 丙午自坐
		['甲', '午', '死'],   // 甲午自坐
		['己', '酉', '长生'], // 己酉自坐
		['甲', '亥', '长生'], // 阳干顺行起点
		['乙', '午', '长生'], // 阴干逆行起点
		['壬', '申', '长生'],
		['癸', '卯', '长生'],
	])('%s 在 %s → %s', (gan, zhi, expected) => {
		expect(getSelfZuo(gan, zhi)).toBe(expected);
	});

	test('缺参数返回空', () => {
		expect(getSelfZuo('', '午')).toBe('');
		expect(getSelfZuo('丁', '')).toBe('');
	});
});

describe('流年/大运列补算 hiddenStemsOf / xunKongOf', () => {
	test('hiddenStemsOf(戌,丁) → 戊伤·辛才·丁比', () => {
		expect(hiddenStemsOf('戌', '丁')).toEqual([
			{ cell: '戊', relative: '伤' },
			{ cell: '辛', relative: '才' },
			{ cell: '丁', relative: '比' },
		]);
	});
	test('hiddenStemsOf(午,丁) → 丁比·己食', () => {
		expect(hiddenStemsOf('午', '丁')).toEqual([
			{ cell: '丁', relative: '比' },
			{ cell: '己', relative: '食' },
		]);
	});
	test('xunKongOf 空亡', () => {
		expect(xunKongOf('庚戌')).toBe('寅卯');
		expect(xunKongOf('丙午')).toBe('寅卯');
		expect(xunKongOf('')).toBe('');
	});
});

describe('星运/自坐 · 集成（2026-06-22 丙午/甲午/丁卯/己酉，日干丁）', () => {
	const four = buildLocalBaziResult({
		date: '2026-06-22', time: '18:00:00', zone: '+08:00',
		lon: 113.0, gpsLon: 113.0, lat: 23.0, gpsLat: 23.0, gender: 1, timeAlg: 1,
	}).bazi.fourColumns;
	const dayGan = four.day.stem.cell;

	test('星运（日干丁 vs 各支）= 临官/临官/病/长生', () => {
		expect(['year', 'month', 'day', 'time'].map((k) => getSelfZuo(dayGan, four[k].branch.cell)))
			.toEqual(['临官', '临官', '病', '长生']);
	});
	test('自坐（各柱干自坐本支）= 帝旺/死/病/长生', () => {
		expect(['year', 'month', 'day', 'time'].map((k) => getSelfZuo(four[k].stem.cell, four[k].branch.cell)))
			.toEqual(['帝旺', '死', '病', '长生']);
	});
});

// [B 三档接活 2026-08-08] phaseType 长生三派统一内核(changShengOf):与 Java 权威 wuxingphase.json
// 逐格全等。曾为半截接线(档0≡档2 死档对、档1 只动戊己)——golden 锚锚住的是错值,按
// 「golden 是法律,错了重生成」纪律更新:byte-perfect 锚转移到档2(=lunar 原值)。
describe('phaseType 长生派别覆盖（resolveDiShiByPhaseType）', () => {
	test('🔴 档2/缺参 恒返回 fallback（byte-perfect 锚在阳顺阴逆档）', () => {
		expect(resolveDiShiByPhaseType('戊', '申', 2, 'KEEP')).toBe('KEEP');
		expect(resolveDiShiByPhaseType('己', '酉', 2, 'KEEP')).toBe('KEEP');
		expect(resolveDiShiByPhaseType('乙', '丑', 2, 'KEEP')).toBe('KEEP');
		expect(resolveDiShiByPhaseType('甲', '亥', undefined, 'KEEP')).toBe('KEEP');
	});
	test('🔴 档0 火土同=全干不分阴阳(阴干随阳干搭档顺行):锚格对 Java huotutong', () => {
		expect(resolveDiShiByPhaseType('戊', '寅', 0, '__')).toBe('长生');   // 阳干与阳顺阴逆同值(幂等覆盖)
		expect(resolveDiShiByPhaseType('己', '酉', 0, '__')).toBe('死');     // 己随戊寅起顺(修前恒 fallback=死档)
		expect(resolveDiShiByPhaseType('己', '巳', 0, '__')).toBe('临官');
		expect(resolveDiShiByPhaseType('乙', '丑', 0, '__')).toBe('冠带');   // 乙随甲亥起顺
	});
	test('phaseType=1 水土同：戊/己 长生在申顺行(整列对 Java suitutong)；非土阴干亦随阳干', () => {
		const expectRow = { 申: '长生', 酉: '沐浴', 戌: '冠带', 亥: '临官', 子: '帝旺', 午: '胎', 寅: '病' };
		['戊', '己'].forEach((gan) => {
			Object.keys(expectRow).forEach((zhi) => {
				expect(resolveDiShiByPhaseType(gan, zhi, 1, '__')).toBe(expectRow[zhi]);
			});
		});
		expect(resolveDiShiByPhaseType('甲', '亥', 1, '__')).toBe('长生');   // 档1 非土干=档0 同式(不分阴阳)
		expect(resolveDiShiByPhaseType('乙', '丑', 1, '__')).toBe('冠带');
	});
	test('🔴 360 格权威对拍:changShengOf 三档全表 ≡ Java wuxingphase.json(单一真值源锁)', () => {
		// eslint-disable-next-line global-require
		const J = require('../../../../astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/helper/wuxingphase.json');
		const { changShengOf } = require('../baziLunarLocal');
		const TBL = { 0: 'huotutong', 1: 'suitutong', 2: 'yingyang' };
		const GANS10 = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
		const ZHIS12 = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
		[0, 1, 2].forEach((pt) => {
			const g = J[TBL[pt]].ganzi;
			GANS10.forEach((gan) => ZHIS12.forEach((zhi) => {
				expect(`${pt}:${gan}_${zhi}:${changShengOf(gan, zhi, pt)}`).toBe(`${pt}:${gan}_${zhi}:${g[`${gan}_${zhi}`]}`);
			}));
		});
	});
});

// phaseType 引擎级：缺参/档2 == lunar 现状(byte-perfect)；档0 对阴干日主真变；档1 对土日元真变。
describe('phaseType 引擎级（buildLocalBaziResult）', () => {
	// 2000-01-01 = 戊午日（阳土日元）；2024-01-02 = 乙丑日（阴木日元,档0↔档2 差异样本）。
	const base = { date: '2000-01-01', time: '12:00:00', zone: '+08:00', lon: 113.0, gpsLon: 113.0, lat: 23.0, gpsLat: 23.0, gender: 1, timeAlg: 1 };
	const baseYin = { ...base, date: '2024-01-02' };
	const dishis = (params) => {
		const c = buildLocalBaziResult(params).bazi.fourColumns;
		return ['year', 'month', 'day', 'time'].map((k) => c[k].ganziPhase);
	};
	test('🔴 缺参恒=档2(lunar 原值 byte-perfect):9 个不传参技法调用方零波及;显式档才生效', () => {
		expect(dishis({ ...base, phaseType: 2 })).toEqual(dishis({ ...base }));
		expect(dishis({ ...baseYin, phaseType: 2 })).toEqual(dishis({ ...baseYin }));
		// 阴干日主固定锚(独立誊录,防实现自证):乙丑日 lunar 口径 乙逆行长生午 → 卯临官/子病/丑衰/午长生
		expect(dishis({ ...baseYin })).toEqual(['临官', '病', '衰', '长生']);
	});
	test('🔴 阳干日主:档0==档2(幂等);阴干日主(乙丑日):档0≠档2(修前死档对,负锚)+固定锚', () => {
		expect(dishis({ ...base, phaseType: 0 })).toEqual(dishis({ ...base, phaseType: 2 }));
		expect(dishis({ ...baseYin, phaseType: 0 })).not.toEqual(dishis({ ...baseYin, phaseType: 2 }));
		// 档0 乙随甲(亥起顺):卯帝旺/子沐浴/丑冠带/午死(独立推导,对 Java huotutong)
		expect(dishis({ ...baseYin, phaseType: 0 })).toEqual(['帝旺', '沐浴', '冠带', '死']);
	});
	test('日元为土（戊/己）时 phaseType=1（水土同）改四柱 diShi', () => {
		const c = buildLocalBaziResult({ ...base }).bazi.fourColumns;
		expect(['戊', '己']).toContain(c.day.stem.cell);
		expect(dishis({ ...base, phaseType: 1 })).not.toEqual(dishis({ ...base, phaseType: 0 }));
	});
});

// 死选项接线·godKeyPos 引擎级：默认 '年'；'年日' 为旧全集（神煞含日基更多）。
describe('godKeyPos 引擎级（buildLocalBaziResult，神煞主位）', () => {
	const base = { date: '2026-06-22', time: '18:00:00', zone: '+08:00', lon: 113.0, gpsLon: 113.0, lat: 23.0, gpsLat: 23.0, gender: 1, timeAlg: 1 };
	const allShenSha = (params) => {
		const c = buildLocalBaziResult(params).bazi.fourColumns;
		return ['year', 'month', 'day', 'time'].reduce((s, k) => s.concat(c[k].shenSha || []), []);
	};
	test('默认（无 godKeyPos）== godKeyPos="年"', () => {
		expect(allShenSha({ ...base })).toEqual(allShenSha({ ...base, godKeyPos: '年' }));
	});
	test('godKeyPos="年日" 神煞数 ≥ 默认"年"（含日主位基组更多或相等）', () => {
		const nian = allShenSha({ ...base, godKeyPos: '年' }).length;
		const nianri = allShenSha({ ...base, godKeyPos: '年日' }).length;
		expect(nianri).toBeGreaterThanOrEqual(nian);
	});
});
