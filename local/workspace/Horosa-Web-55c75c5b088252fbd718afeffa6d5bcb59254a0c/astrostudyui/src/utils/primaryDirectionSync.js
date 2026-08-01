import { randomStr, } from './helper';

// v10 — P1 主限法全面建成（新增 Regiomontanus / Campanus / Topocentric 方位法,
// 走自研 pd_engine 通用引擎；placidus 升级为精确半弧）。升 SYNC_REV 强制旧持久化 chart 回收重算。
// v13 — P0 解耦补齐:投影(pdProjection)×定局(pdFrame)正交两维 + 平行/框架/自定义钥匙/
// S·P 清单/界系变体。升 SYNC_REV 强制旧持久化 chart 回收重算。
export const PD_SYNC_REV = 'pd_method_sync_v15';
export const DEFAULT_PD_METHOD = 'core_alchabitius';
export const DEFAULT_PD_PROJECTION = 'ptolemy';       // = core_alchabitius 的投影分量(锁死组合)
export const DEFAULT_PD_FRAME = 'alcabitius';         // = core_alchabitius 的定局分量(锁死组合)
export const DEFAULT_PD_FRAMEWORK = 'aspect';
export const DEFAULT_PD_TIME_KEY = 'Ptolemy';
export const DEFAULT_PD_TYPE = 0;

// 与后端 perpredict._PD_PROJECTION_REGISTRY / _PD_FRAME_HSYS / pdFramework 白名单同步。
export const SUPPORTED_PD_PROJECTIONS = [
	'ptolemy', 'placidus', 'regiomontanus', 'campanus', 'topocentric',
	'zodiacal', 'ra_direct', 'in_zodiaco_lon', 'in_zodiaco_abs', 'horosa_legacy',
	'placidus_under_pole',
];
export const SUPPORTED_PD_FRAMES = [
	'alcabitius', 'placidus', 'regiomontanus', 'campanus', 'topocentric',
	'meridian', 'porphyry', 'equal', 'wholesign', 'morinus', 'koch', 'equal_hour_circle',
];
export const SUPPORTED_PD_FRAMEWORKS = ['aspect', 'bounds', 'release'];
export const PD_PROJECTION_LABELS = {
	ptolemy: 'Ptolemy（半弧）', placidus: 'Placidus（半弧严密）', regiomontanus: 'Regiomontanus',
	campanus: 'Campanus', topocentric: 'Topocentric', zodiacal: '纯黄道（斜升差）',
	ra_direct: '赤经直推', in_zodiaco_lon: 'Along Ecliptic', in_zodiaco_abs: 'Edmund Jones',
	horosa_legacy: 'Horosa原方法',
	placidus_under_pole: 'Placidus under-pole（旧法近似）',
};
// S/P 清单扩展选项(与 perchart 白名单同源;追加语义,默认全不选=现状字节)
export const PD_SIGNIFICATOR_OPTIONS = [
	{ value: 'Desc', label: '下降 DSC' },
	{ value: 'IC', label: '天底 IC' },
	{ value: 'Syzygy', label: '产前朔望' },
	{ value: 'Spirit', label: '精神点' },
	{ value: 'Cusps', label: '中间宫始点' },
	{ value: 'Stars', label: '恒星（王星+比尼）' },
	{ value: 'Lots', label: '阿拉伯点（全目录）' },
];
export const PD_PROMISSOR_TYPE_OPTIONS = [
	{ value: 'cusps', label: '宫始点' },
	{ value: 'stars', label: '恒星' },
	{ value: 'lots', label: '阿拉伯点' },
];
export const PD_FRAME_LABELS = {
	alcabitius: 'Alcabitius', placidus: 'Placidus', regiomontanus: 'Regiomontanus',
	campanus: 'Campanus', topocentric: 'Topocentric', meridian: 'Meridian',
	porphyry: 'Porphyry', equal: 'Equal（等宫）', wholesign: 'Whole Sign（整宫）',
	morinus: 'Morinus', koch: 'Koch', equal_hour_circle: 'Equal（时圈）',
};
export const PD_FRAMEWORK_LABELS = { aspect: '相位主限', bounds: '界行·分配星', release: '释放（hyleg）' };

// 与后端 perpredict._PD_METHOD_REGISTRY 同步的方位法白名单。
export const SUPPORTED_PD_METHODS = [
	'core_alchabitius', 'horosa_legacy', 'placidus',
	'regiomontanus', 'campanus', 'topocentric',
	'meridian', 'porphyry', 'equal_ecliptic', 'equal_hour_circle',
	'morinus', 'in_zodiaco_lon', 'in_zodiaco_abs',
];

// 与后端时间换算白名单同步(static 表 + 每盘常数 Simmonite/Kepler/Brahe + 动态 TrueSolarArc/SymbolicSolarArc)。
export const SUPPORTED_PD_TIME_KEYS = [
	'Ptolemy', 'Naibod', 'TrueSolarArc', 'SymbolicSolarArc',
	'Cardano', 'Umar', 'Wollner', 'Plantiko', 'Simmonite', 'SynodicYear',
	'Kepler', 'Brahe', 'Kundig', 'SymbolicDegree', 'SymbolicYear', 'SymbolicMoon',
	'SymbolicMonth', 'Quarterly', 'Quinary', 'Duodenary', 'Novenary', 'SelfMeasure',
	'NaibodRA', 'AscendantArc', 'VanDam', 'User',
];

// 方位法 / 时间换算的 label 字典 — 用于 UI 显示 + AI 导出 + 储存。
export const PD_METHOD_LABELS = {
	core_alchabitius: 'Alchabitius',
	placidus: 'Placidus（半弧）',
	regiomontanus: 'Regiomontanus',
	campanus: 'Campanus',
	topocentric: 'Topocentric',
	meridian: 'Meridian',
	porphyry: 'Porphyry',
	equal_ecliptic: 'Equal（黄道）',
	equal_hour_circle: 'Equal（时圈）',
	morinus: 'Morinus',
	in_zodiaco_lon: 'Along Ecliptic',
	in_zodiaco_abs: 'Edmund Jones',
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
	NaibodRA: 'Naibod-in-RA',
	AscendantArc: 'Ascendant-arc（界行）',
	VanDam: 'Van Dam（真弧）',
	User: '自定义（每年度数）',
};

// 旧单维 pdMethod ↔ 解耦两维(投影,分宫)双向映射。
// 🔴 与后端 perpredict._PD_METHOD_TO_PAIR 逐项同步(单一真值源;改一处必改两处)。
// frame 为 null 者(in_zodiaco_lon/in_zodiaco_abs/horosa_legacy)= 分宫回落本命盘宫制。
export const PD_METHOD_TO_PAIR = {
	core_alchabitius: ['ptolemy', 'alcabitius'],
	placidus: ['placidus', 'placidus'],
	regiomontanus: ['regiomontanus', 'regiomontanus'],
	campanus: ['campanus', 'campanus'],
	topocentric: ['topocentric', 'topocentric'],
	meridian: ['ptolemy', 'meridian'],
	porphyry: ['ptolemy', 'porphyry'],
	equal_ecliptic: ['ptolemy', 'equal'],
	equal_hour_circle: ['ptolemy', 'equal_hour_circle'],
	morinus: ['ptolemy', 'morinus'],
	in_zodiaco_lon: ['in_zodiaco_lon', null],
	in_zodiaco_abs: ['in_zodiaco_abs', null],
	horosa_legacy: ['horosa_legacy', null],
};

/** pdMethod → [投影, 分宫];未知回落默认对。 */
export function pdPairOfMethod(method){
	return PD_METHOD_TO_PAIR[method] || [DEFAULT_PD_PROJECTION, DEFAULT_PD_FRAME];
}

/** (投影, 分宫) → pdMethod 反查;无单维等价(正交自由组合)返回 null。 */
export function pdMethodOfPair(projection, frame){
	const p = projection || DEFAULT_PD_PROJECTION;
	const f = frame || DEFAULT_PD_FRAME;
	const hit = Object.keys(PD_METHOD_TO_PAIR).find((k)=>{
		const pair = PD_METHOD_TO_PAIR[k];
		return pair[0] === p && (pair[1] === f || (pair[1] === null && f === DEFAULT_PD_FRAME));
	});
	return hit || null;
}

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
	// WS-3 主限天球(3D):三件套登记之一 —— 本表 + models/astro shouldIncludePrimaryDirection
	// + jest 枚举断言,缺一即「tab 键被吞回 primarydirect / 载入不带 PD 数据」的隐性坏。
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
		pdProjection,
		pdFrame,
		pdFramework,
		pdParallel,
		pdRaptParallel,
		pdTimeKeyCustom,
		pdSignificators,
		pdPromissorTypes,
		termsVariant,
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
			pdProjection: pdProjection || DEFAULT_PD_PROJECTION,
			pdFrame: pdFrame || DEFAULT_PD_FRAME,
			pdFramework: pdFramework || DEFAULT_PD_FRAMEWORK,
			pdParallel: pdParallel ? 1 : 0,
			pdRaptParallel: pdRaptParallel ? 1 : 0,
			termsVariant: (termsVariant === 1 || termsVariant === 2) ? termsVariant : 0,
			...(pdTimeKeyCustom !== undefined ? { pdTimeKeyCustom, } : {}),
			// 🔴 空数组=显式全清:必须落库覆盖旧值(`&&length` 会让清空后旧勾选残留、
			// 天球扩展 Popover 勾选回弹/清空失灵);仅 undefined(调用方未传)才保旧。
			...(Array.isArray(pdSignificators) ? { pdSignificators, } : {}),
			...(Array.isArray(pdPromissorTypes) ? { pdPromissorTypes, } : {}),
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
