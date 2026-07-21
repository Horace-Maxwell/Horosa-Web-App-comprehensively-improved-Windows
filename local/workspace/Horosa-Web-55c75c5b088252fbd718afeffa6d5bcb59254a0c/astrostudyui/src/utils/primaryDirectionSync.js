import { randomStr, } from './helper';

// 主限法核方位法集合：仅收录逐位核验的核方位法（Alchabitius / Meridian /
// Porphyry / Equal 黄道·时圈，In-Zodiaco 下逐位等价、已核验 mean|Δ|=0）。
// 升 SYNC_REV 强制旧持久化 chart 回收重算。
export const PD_SYNC_REV = 'pd_method_sync_v12';
export const DEFAULT_PD_METHOD = 'core_alchabitius';
export const DEFAULT_PD_TIME_KEY = 'Ptolemy';
export const DEFAULT_PD_TYPE = 0;

// 与后端 perpredict._PD_METHOD_REGISTRY 同步的方位法白名单。
export const SUPPORTED_PD_METHODS = [
	'core_alchabitius', 'horosa_legacy',
	'meridian', 'porphyry', 'equal_ecliptic', 'equal_hour_circle',
];

// 与后端时间换算白名单同步(static 表 + 每盘常数 Simmonite/Kepler/Brahe + 动态 TrueSolarArc/SymbolicSolarArc)。
export const SUPPORTED_PD_TIME_KEYS = [
	'Ptolemy', 'Naibod', 'TrueSolarArc', 'SymbolicSolarArc',
	'Cardano', 'Umar', 'Wollner', 'Plantiko', 'Simmonite', 'SynodicYear',
	'Kepler', 'Brahe', 'Kundig', 'SymbolicDegree', 'SymbolicYear', 'SymbolicMoon',
	'SymbolicMonth', 'Quarterly', 'Quinary', 'Duodenary', 'Novenary', 'SelfMeasure',
];

// 方位法 / 时间换算的 label 字典 — 用于 UI 显示 + AI 导出 + 储存。
export const PD_METHOD_LABELS = {
	core_alchabitius: 'Alchabitius',
	meridian: 'Meridian',
	porphyry: 'Porphyry',
	equal_ecliptic: 'Equal（黄道）',
	equal_hour_circle: 'Equal（时圈）',
	horosa_legacy: 'Horosa原方法',
};
export const PD_TIME_KEY_LABELS = {
	Ptolemy: 'Ptolemy',
	Naibod: 'Naibod',
	TrueSolarArc: '真太阳弧',
	SymbolicSolarArc: '太阳弧（黄经）',
	Kundig: 'Kündig',
	Cardano: 'Cardano',
	Umar: 'Umar al-Tabari',
	Wollner: 'Wöllner',
	Plantiko: 'Plantiko',
	Simmonite: 'Simmonite',
	SynodicYear: 'Synodic Year',
	Kepler: 'Kepler',
	Brahe: 'Brahe',
	SymbolicDegree: 'Symbolic Degree',
	SymbolicYear: 'Symbolic Year',
	SymbolicMoon: 'Symbolic Moon',
	SymbolicMonth: 'Symbolic Month',
	Quarterly: 'Quarterly',
	Quinary: 'Quinary',
	Duodenary: 'Duodenary',
	Novenary: 'Novenary',
	SelfMeasure: 'Self-Measure',
};

export function getPdMethodLabel(value){
	if(value && PD_METHOD_LABELS[value]){
		return PD_METHOD_LABELS[value];
	}
	return PD_METHOD_LABELS[DEFAULT_PD_METHOD];
}

export function getPdTimeKeyLabel(value){
	if(value && PD_TIME_KEY_LABELS[value]){
		return PD_TIME_KEY_LABELS[value];
	}
	return PD_TIME_KEY_LABELS[DEFAULT_PD_TIME_KEY];
}
const VALID_DIRECTION_SUB_TABS = new Set([
	'primarydirect',
	'primarydirchart',
	'primarydirsphere',
	'firdaria',
	'profection',
	'solararc',
	'solarreturn',
	'lunarreturn',
	'givenyear',
	'decennials',
	'zodialrelease',
	'planetaryages',
	'vedicprog',
	'jaynesprog',
	'planetaryarc',
	'persiandirected',
	'yearsystem129',
	'balbillus',
	'triplicityrulers',
	'keypoints',
	'lunationphase',
	'extrareturns',
	'ephemeris',
	'progressions',
	'returntimeline',
	'distributions',
	'agepoint',
	'prenatalsyzygy',
]);

export function normalizePrimaryDirectionSubTabKey(key){
	return VALID_DIRECTION_SUB_TABS.has(key)
		? key
		: 'primarydirect';
}

export function mergePrimaryDirectionChartObj(chartObj, options = {}){
	const {
		pdRows,
		showPdBounds,
		pdMethod,
		pdTimeKey,
		pdtype,
		pdDirect,
		pdConverse,
		pdAntiscia,
		pdTerms,
		name,
		pos,
		chartId,
	} = options;
	const nextChartId = chartId === undefined ? randomStr(8) : chartId;
	return {
		...(chartObj || {}),
		params: {
			...((chartObj && chartObj.params) || {}),
			...(name !== undefined ? { name, } : {}),
			...(pos !== undefined ? { pos, } : {}),
			showPdBounds: showPdBounds === 0 ? 0 : 1,
			pdtype: pdtype === 1 ? 1 : DEFAULT_PD_TYPE,
			// 顺逆默认都开(用户偏好):仅显式 0 才关。
			pdDirect: pdDirect === 0 ? 0 : 1,
			pdConverse: pdConverse === 0 ? 0 : 1,
			pdAntiscia: pdAntiscia ? 1 : 0,
			pdTerms: pdTerms ? 1 : 0,
			pdMethod: pdMethod || DEFAULT_PD_METHOD,
			pdTimeKey: pdTimeKey || DEFAULT_PD_TIME_KEY,
			pdSyncRev: PD_SYNC_REV,
		},
		predictives: {
			...((chartObj && chartObj.predictives) || {}),
			primaryDirection: Array.isArray(pdRows) ? pdRows : [],
		},
		...(nextChartId ? { chartId: nextChartId, } : {}),
	};
}
