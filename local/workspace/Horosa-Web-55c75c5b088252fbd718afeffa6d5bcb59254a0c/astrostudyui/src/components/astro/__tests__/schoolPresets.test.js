import {
	SCHOOL_PRESETS,
	SCHOOL_PRESET_OPTIONS,
	SCHOOL_PRESET_DEFAULT,
	SCHOOL_PRESET_CUSTOM,
	normalizeSchoolPreset,
	presetOf,
} from '../schoolPresets';
import { TRIPLICITY_SYSTEM_DEFAULT, TRIPLICITY_SYSTEMS } from '../../../utils/triplicityRulers';

// 应用当前默认四维(核实自 models/astro.js fields 默认 + triplicityRulers 默认)。
// 这些常量若变动,本测试会逼迫重新核对 Brennan 锚 → 守零回归。
const DEFAULT_ZODIAC = 'tropical';   // zodiacal 默认 0 → 'tropical'
const DEFAULT_HSYS = 1;              // DefaultHouseSystem = 1 (Alcabitus)
const DEFAULT_TERMS = 0;             // termsVariant 默认 0 (埃及)
const DEFAULT_TRIP = TRIPLICITY_SYSTEM_DEFAULT;  // 'Dorothean'

describe('G20 流派预设 schoolPresets', () => {
	test('六档结构齐(七维 + label)', () => {
		['brennan', 'valens', 'ptolemy', 'dykes', 'houlding', 'zoller'].forEach((k)=>{
			const p = SCHOOL_PRESETS[k];
			expect(p).toBeTruthy();
			expect(typeof p.label).toBe('string');
			expect(typeof p.zodiac).toBe('string');
			expect(typeof p.hsys).toBe('number');
			expect([0, 1, 2]).toContain(p.termsVariant);
			expect(TRIPLICITY_SYSTEMS[p.tripSystem]).toBeTruthy();   // tripSystem 必须是合法三分体系
			// 全维分化三项(P1-D1):缺一即选档后该维不写 → 分化失效
			expect([0, 1]).toContain(p.lotReversal);
			expect(['geo', 'ptolemy5']).toContain(p.sectBuffer);
			expect(['whole', 'degree']).toContain(p.aspectModel);
		});
	});

	test('🔴 零回归锚:Brennan 四维 === 应用当前默认值', () => {
		const b = SCHOOL_PRESETS.brennan;
		expect(b.zodiac).toBe(DEFAULT_ZODIAC);
		expect(b.hsys).toBe(DEFAULT_HSYS);
		expect(b.termsVariant).toBe(DEFAULT_TERMS);
		expect(b.tripSystem).toBe(DEFAULT_TRIP);
		expect(SCHOOL_PRESET_DEFAULT).toBe('brennan');
	});

	test('六档映射:回归黄道全档;界/分宫/三分按表', () => {
		// 全部回归黄道
		['brennan', 'valens', 'ptolemy', 'dykes', 'houlding', 'zoller'].forEach((k)=>{
			expect(SCHOOL_PRESETS[k].zodiac).toBe('tropical');
		});
		// 分宫
		expect(SCHOOL_PRESETS.valens.hsys).toBe(0);    // 整宫
		expect(SCHOOL_PRESETS.ptolemy.hsys).toBe(9);   // 象限 Porphyry
		expect(SCHOOL_PRESETS.dykes.hsys).toBe(0);     // 整宫
		expect(SCHOOL_PRESETS.houlding.hsys).toBe(2);  // Regiomontanus
		expect(SCHOOL_PRESETS.zoller.hsys).toBe(1);    // Alcabitus
		// 界
		expect(SCHOOL_PRESETS.ptolemy.termsVariant).toBe(1);   // 托勒密界
		expect(SCHOOL_PRESETS.houlding.termsVariant).toBe(1);  // 托勒密界
		expect(SCHOOL_PRESETS.valens.termsVariant).toBe(0);    // 埃及界
		// 三分
		expect(SCHOOL_PRESETS.ptolemy.tripSystem).toBe('Ptolemaic');
		expect(SCHOOL_PRESETS.houlding.tripSystem).toBe('Ptolemaic');
		expect(SCHOOL_PRESETS.valens.tripSystem).toBe('Dorothean');
	});

	test('presetOf:默认四维 → brennan(首匹配,非 zoller)', () => {
		expect(presetOf({ zodiac: DEFAULT_ZODIAC, hsys: DEFAULT_HSYS, termsVariant: DEFAULT_TERMS, tripSystem: DEFAULT_TRIP })).toBe('brennan');
	});

	test('presetOf:命中各档(七维;非默认维必须显式给,否则按默认补齐 → custom)', () => {
		// valens 三新维皆为默认 → 四维即可命中
		expect(presetOf({ zodiac: 'tropical', hsys: 0, termsVariant: 0, tripSystem: 'Dorothean' })).toBe('valens');
		// ptolemy 三新维皆非默认 → 必须全给才命中
		expect(presetOf({
			zodiac: 'tropical', hsys: 9, termsVariant: 1, tripSystem: 'Ptolemaic',
			lotReversal: 0, sectBuffer: 'ptolemy5', aspectModel: 'degree',
		})).toBe('ptolemy');
		// houlding 仅 aspectModel 非默认
		expect(presetOf({
			zodiac: 'tropical', hsys: 2, termsVariant: 1, tripSystem: 'Ptolemaic', aspectModel: 'degree',
		})).toBe('houlding');
		// zoller:Alcabitus + 埃及界 + Dorothean + degree 相位
		expect(presetOf({ zodiac: 'tropical', hsys: 1, termsVariant: 0, tripSystem: 'Dorothean', aspectModel: 'degree' })).toBe('zoller');
	});

	test('🔴 全维分化:三新维取值与文档档案表一致', () => {
		// brennan 三新维 === 应用当前默认(零回归锚)
		expect(SCHOOL_PRESETS.brennan.lotReversal).toBe(1);
		expect(SCHOOL_PRESETS.brennan.sectBuffer).toBe('geo');
		expect(SCHOOL_PRESETS.brennan.aspectModel).toBe('whole');
		// ptolemy:不反转 + 上升前 5° 缓冲 + 度数相位
		expect(SCHOOL_PRESETS.ptolemy.lotReversal).toBe(0);
		expect(SCHOOL_PRESETS.ptolemy.sectBuffer).toBe('ptolemy5');
		expect(SCHOOL_PRESETS.ptolemy.aspectModel).toBe('degree');
		// houlding/zoller:度数相位,余项默认
		expect(SCHOOL_PRESETS.houlding.aspectModel).toBe('degree');
		expect(SCHOOL_PRESETS.zoller.aspectModel).toBe('degree');
		expect(SCHOOL_PRESETS.houlding.lotReversal).toBe(1);
		// valens/dykes:全默认三新维
		['valens', 'dykes'].forEach((k)=>{
			expect(SCHOOL_PRESETS[k].lotReversal).toBe(1);
			expect(SCHOOL_PRESETS[k].sectBuffer).toBe('geo');
			expect(SCHOOL_PRESETS[k].aspectModel).toBe('whole');
		});
	});

	test('presetOf:单改任一新维 → custom(不再误判命中原档)', () => {
		const base = { zodiac: DEFAULT_ZODIAC, hsys: DEFAULT_HSYS, termsVariant: DEFAULT_TERMS, tripSystem: DEFAULT_TRIP };
		expect(presetOf({ ...base, lotReversal: 0 })).toBe(SCHOOL_PRESET_CUSTOM);
		expect(presetOf({ ...base, sectBuffer: 'ptolemy5' })).toBe(SCHOOL_PRESET_CUSTOM);
		// aspectModel 改 degree 时 hsys=1/埃及界/Dorothean 恰为 zoller 档 → 命中 zoller(非 custom)
		expect(presetOf({ ...base, aspectModel: 'degree' })).toBe('zoller');
	});

	test('presetOf:任一单项被改 → custom', () => {
		// 改黄道
		expect(presetOf({ zodiac: 'sidereal:lahiri', hsys: DEFAULT_HSYS, termsVariant: DEFAULT_TERMS, tripSystem: DEFAULT_TRIP })).toBe(SCHOOL_PRESET_CUSTOM);
		// 改分宫到一个无档使用的值(Placidus=3)
		expect(presetOf({ zodiac: DEFAULT_ZODIAC, hsys: 3, termsVariant: DEFAULT_TERMS, tripSystem: DEFAULT_TRIP })).toBe(SCHOOL_PRESET_CUSTOM);
		// 改界到莉莉(2,无档用)
		expect(presetOf({ zodiac: DEFAULT_ZODIAC, hsys: DEFAULT_HSYS, termsVariant: 2, tripSystem: DEFAULT_TRIP })).toBe(SCHOOL_PRESET_CUSTOM);
		// 改三分到水象变体(无档用)
		expect(presetOf({ zodiac: DEFAULT_ZODIAC, hsys: DEFAULT_HSYS, termsVariant: DEFAULT_TERMS, tripSystem: 'PtolemaicWaterVariant' })).toBe(SCHOOL_PRESET_CUSTOM);
	});

	test('presetOf:缺省补默认(termsVariant→0, tripSystem→Dorothean) → brennan', () => {
		expect(presetOf({ zodiac: 'tropical', hsys: 1 })).toBe('brennan');
		// 字符串型 hsys 也能匹配
		expect(presetOf({ zodiac: 'tropical', hsys: '1', termsVariant: '0' })).toBe('brennan');
	});

	test('normalizeSchoolPreset:未知 → 默认;custom 透传', () => {
		expect(normalizeSchoolPreset('unknown')).toBe('brennan');
		expect(normalizeSchoolPreset(undefined)).toBe('brennan');
		expect(normalizeSchoolPreset('valens')).toBe('valens');
		expect(normalizeSchoolPreset(SCHOOL_PRESET_CUSTOM)).toBe(SCHOOL_PRESET_CUSTOM);
	});

	test('选项含七项(六档 + 自定),首项 brennan、末项 custom', () => {
		expect(SCHOOL_PRESET_OPTIONS).toHaveLength(7);
		expect(SCHOOL_PRESET_OPTIONS[0].value).toBe('brennan');
		expect(SCHOOL_PRESET_OPTIONS[SCHOOL_PRESET_OPTIONS.length - 1].value).toBe(SCHOOL_PRESET_CUSTOM);
	});
});
