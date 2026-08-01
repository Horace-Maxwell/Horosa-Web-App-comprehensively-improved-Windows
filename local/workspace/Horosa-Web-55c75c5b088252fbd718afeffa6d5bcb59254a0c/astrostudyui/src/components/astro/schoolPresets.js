// 希腊化占星「流派预设」(P1)。一档 = 一组已有维度的快捷写入：
//   zodiac          黄道下拉复合值 'tropical' | 'sidereal:<ayan>'(见 AstroConst.zodiacSelectValue / parseZodiacSelectValue)
//   hsys            分宫枚举值(见 AstroConst.HOUSE_SYSTEM_OPTIONS：0 整宫 / 1 Alcabitus / 2 Regiomontanus / 9 Porphyry …)
//   termsVariant    界系 0 埃及(默认) / 1 托勒密 / 2 莉莉
//   tripSystem      三分体系 'Dorothean'(默认) / 'Ptolemaic' / 'PtolemaicWaterVariant'(见 triplicityRulers.TRIPLICITY_SYSTEMS)
//   lotReversal     福点昼夜反转 1 反转(默认) / 0 恒昼式
//   sectBuffer      昼夜判定缓冲 'geo' 几何地平(默认) / 'ptolemy5' 上升前 5°
//   aspectModel     相位模型 'whole' 整座相位(默认口径) / 'degree' 度数相位(套古典 moiety 容许度)
// 预设是「快捷」：选档一次性写多个 fields；单项被单独改 → presetOf 反查不再命中任何档 → 显示「自定」。
//
// 🔴 零回归铁律：'brennan' 档的全部维度必须 = 应用当前默认值，使默认/首选 Brennan 与改动前盘字节级一致。
//    当前默认(核实自 models/astro.js + utils/classicalChartGlobals.CLASSICAL_GLOBAL_DEFAULTS)：
//      zodiacal 0 → 'tropical'；hsys DefaultHouseSystem=1(Alcabitus)；termsVariant 0；tripSystem 'Dorothean'；
//      lotReversal 1；sectBuffer 'geo'；相位口径 = 现状(不下发 orbs/simpleAsp) → aspectModel 'whole'。
//    注意 hsys 默认是 1 而非整宫制 0 —— 故 'brennan' 的 hsys 取 1(锚定现状默认)，
//    其余各档按各自分宫法取值。这是零回归优先于「概念整宫」的有意取舍。

export const SCHOOL_PRESET_CUSTOM = 'custom';

// 各档 → 四维取值。键为内部档名(英文，不入界面)；label 为界面显示(现代占星师名，作为页面选项标签)。
export const SCHOOL_PRESETS = {
	brennan: {
		label: 'Brennan',
		zodiac: 'tropical',
		hsys: 1,                       // = DefaultHouseSystem(Alcabitus)，锚定现状默认 → 零回归
		termsVariant: 0,               // 埃及界(默认)
		tripSystem: 'Dorothean',       // 多罗特三主(默认)
		lotReversal: 1,                // 反转(现状默认) → 零回归锚
		sectBuffer: 'geo',             // 几何地平(现状默认)
		aspectModel: 'whole',          // 整座相位(现状口径:不下发 orbs/simpleAsp)
	},
	valens: {
		label: 'Valens',
		zodiac: 'tropical',
		hsys: 0,                       // 整宫制
		termsVariant: 0,               // 埃及界
		tripSystem: 'Dorothean',
		lotReversal: 1,
		sectBuffer: 'geo',
		aspectModel: 'whole',
	},
	ptolemy: {
		label: 'Ptolemy',
		zodiac: 'tropical',
		hsys: 9,                       // 象限制(Porphyry)
		termsVariant: 1,               // 托勒密界
		tripSystem: 'Ptolemaic',       // 托勒密二主
		lotReversal: 0,                // 不反转(与其体系一致)
		sectBuffer: 'ptolemy5',        // 上升前 5° 缓冲
		aspectModel: 'degree',         // 度数相位 + 古典 moiety 容许度
	},
	dykes: {
		label: 'Dykes',
		zodiac: 'tropical',
		hsys: 0,                       // 整宫制
		termsVariant: 0,               // 埃及界
		tripSystem: 'Dorothean',
		lotReversal: 1,
		sectBuffer: 'geo',
		aspectModel: 'whole',
	},
	houlding: {
		label: 'Houlding',
		zodiac: 'tropical',
		hsys: 2,                       // Regiomontanus
		termsVariant: 1,               // 托勒密界
		tripSystem: 'Ptolemaic',
		lotReversal: 1,
		sectBuffer: 'geo',
		aspectModel: 'degree',         // 度数相位 + 古典 moiety 容许度
	},
	zoller: {
		label: 'Zoller',
		zodiac: 'tropical',
		hsys: 1,                       // Alcabitus
		termsVariant: 0,               // 埃及界
		tripSystem: 'Dorothean',
		lotReversal: 1,
		sectBuffer: 'geo',
		aspectModel: 'degree',
	},
};

// 默认档(零回归锚)。
export const SCHOOL_PRESET_DEFAULT = 'brennan';

// 下拉/分段选项：六档 + 自定。自定不可主动选(它是单项覆盖后的派生态)，但需出现在列表里以便受控显示。
export const SCHOOL_PRESET_OPTIONS = [
	...Object.keys(SCHOOL_PRESETS).map((k)=>({ value: k, label: SCHOOL_PRESETS[k].label })),
	{ value: SCHOOL_PRESET_CUSTOM, label: '自定' },
];

// 规范化档名：未知 → 默认 brennan。
export function normalizeSchoolPreset(preset){
	if(preset === SCHOOL_PRESET_CUSTOM){ return SCHOOL_PRESET_CUSTOM; }
	return SCHOOL_PRESETS[preset] ? preset : SCHOOL_PRESET_DEFAULT;
}

// 由当前七维实值反查命中的档名；无任何档完全匹配 → 'custom'。
//   zodiac    传黄道下拉复合值('tropical' | 'sidereal:<ayan>')
//   hsys      传分宫枚举值(数字)
//   termsVariant / tripSystem / lotReversal / sectBuffer / aspectModel 同上。
//   缺省时按各自默认补齐(termsVariant→0, tripSystem→'Dorothean', lotReversal→1, sectBuffer→'geo', aspectModel→'whole')
//   ⇒ 老调用方(只传四维)仍命中原档，不会被误判「自定」。
export function presetOf({ zodiac, hsys, termsVariant, tripSystem, lotReversal, sectBuffer, aspectModel }){
	const z = zodiac == null ? 'tropical' : `${zodiac}`;
	const h = Number(hsys);
	const t = (termsVariant === 1 || termsVariant === 2 || termsVariant === '1' || termsVariant === '2') ? Number(termsVariant) : 0;
	const tr = tripSystem || 'Dorothean';
	const lr = (lotReversal === 0 || lotReversal === '0') ? 0 : 1;
	const sb = sectBuffer || 'geo';
	const am = aspectModel || 'whole';
	const hit = Object.keys(SCHOOL_PRESETS).find((k)=>{
		const p = SCHOOL_PRESETS[k];
		return `${p.zodiac}` === z && Number(p.hsys) === h && Number(p.termsVariant) === t && p.tripSystem === tr
			&& Number(p.lotReversal) === lr && p.sectBuffer === sb && p.aspectModel === am;
	});
	return hit || SCHOOL_PRESET_CUSTOM;
}

// 档 → 相位口径落地参数(不新造后端键):degree ⇒ 套古典 moiety 容许度差异项;whole ⇒ 不下发(现状)。
// 供 changeSchoolPreset 写 fields 用;moiety 数值单一真值源在 AstroOrbSetting.MOIETY_ORBS。
export function aspectModelOrbs(preset, moietyOverrides){
	const p = SCHOOL_PRESETS[preset];
	if(!p || p.aspectModel !== 'degree'){ return undefined; }
	const o = moietyOverrides || {};
	return Object.keys(o).length ? o : undefined;
}

export default { SCHOOL_PRESETS, SCHOOL_PRESET_OPTIONS, SCHOOL_PRESET_DEFAULT, SCHOOL_PRESET_CUSTOM, normalizeSchoolPreset, presetOf };
