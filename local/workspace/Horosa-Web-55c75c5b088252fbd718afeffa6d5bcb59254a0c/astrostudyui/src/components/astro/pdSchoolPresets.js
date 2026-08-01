// 主限法「流派预设」(P1-1)。严格复刻 schoolPresets.js 模式:preset 映射 + 零回归默认锚 +
// presetOf() 反查 + custom 派生态。一档 = 一组主限维度的快捷写入:
//   pdProjection  投影法(决定弧):ptolemy / placidus / regiomontanus / campanus / topocentric / zodiacal / ra_direct…
//   pdFrame       定局分宫(决定盘面宫始点):alcabitius / wholesign / placidus / regiomontanus / topocentric / equal…
//   pdtype        0 黄道主限(in zodiaco)/1 世界主限(in mundo)
//   pdDirect / pdConverse   顺推 / 逆推(古典)开关
//   pdTimeKey     时间钥匙(Ptolemy/Naibod/…)
//   pdFramework   框架:aspect 相位主限 / bounds 界行-分配星 / release 释放(hyleg)
//   pdParallel    平行被限星(黄道=赤纬平行映点法;世界主限下=世界平行)
// 预设是「快捷」:选档一次性写多维;单项被单独改 → presetOf 反查不再命中 → 显示「自定」。
//
// 🔴 零回归铁律:'horosa' 档的全部维度必须 = 应用当前默认值(pdMethod='core_alchabitius' 的
//    解耦等价对 ptolemy×alcabitius、pdtype 0、顺逆双开、Ptolemy 钥匙、aspect 框架、平行关),
//    使默认档与改动前主限表字节级一致。pdSchoolPresets.test.js 以 primaryDirectionSync 默认值
//    逐维断言锚定。

export const PD_SCHOOL_PRESET_CUSTOM = 'custom';

export const PD_SCHOOL_PRESETS = {
	horosa: {
		label: '星阙(默认)',
		pdProjection: 'ptolemy',       // = core_alchabitius 的投影分量(锁死组合)
		pdFrame: 'alcabitius',         // = core_alchabitius 的定局分量(锁死组合)
		pdtype: 0,
		pdDirect: 1,
		pdConverse: 1,                 // 现状默认顺逆双开
		pdTimeKey: 'Ptolemy',
		pdFramework: 'aspect',
		pdParallel: 0,
	},
	hellenistic: {
		label: '希腊化',
		pdProjection: 'ptolemy',       // 半弧母法
		pdFrame: 'wholesign',
		pdtype: 0,
		pdDirect: 1,
		pdConverse: 0,                 // 顺推为主
		pdTimeKey: 'Ptolemy',          // 1:1(按 OA/RA)
		pdFramework: 'aspect',         // 框架下拉已从工具条移除:preset 恒相位主限(界行能力保留于引擎/挂载设置)
		pdParallel: 0,
	},
	lilly_morin: {
		label: '中世纪',
		pdProjection: 'regiomontanus', // 位置圈(Lilly / Morin 主用)
		pdFrame: 'regiomontanus',
		pdtype: 0,
		pdDirect: 1,
		pdConverse: 1,                 // 顺+逆(古典)
		pdTimeKey: 'Naibod',
		pdFramework: 'aspect',
		pdParallel: 0,
	},
	placidian: {
		label: '半弧现代',
		pdProjection: 'placidus',      // 半弧严密(英系现代)
		pdFrame: 'placidus',
		pdtype: 0,
		pdDirect: 1,
		pdConverse: 1,
		pdTimeKey: 'Naibod',
		pdFramework: 'aspect',
		pdParallel: 1,                 // 相位主限 + 平行
	},
	topocentric: {
		label: '地形派',
		pdProjection: 'topocentric',   // Marr 式
		pdFrame: 'topocentric',
		pdtype: 0,
		pdDirect: 1,
		pdConverse: 1,
		pdTimeKey: 'Naibod',
		pdFramework: 'aspect',
		pdParallel: 1,
	},
	zodiacal: {
		label: '纯黄道古法',
		pdProjection: 'zodiacal',      // 斜升差直推(15 世纪前主用)
		pdFrame: 'equal',
		pdtype: 0,
		pdDirect: 1,
		pdConverse: 0,
		pdTimeKey: 'Ptolemy',
		pdFramework: 'aspect',
		pdParallel: 0,
	},
};

// 默认档(零回归锚)。
export const PD_SCHOOL_PRESET_DEFAULT = 'horosa';

// 下拉/分段选项:六档 + 自定(派生态,不可主动选但需受控显示)。
export const PD_SCHOOL_PRESET_OPTIONS = [
	...Object.keys(PD_SCHOOL_PRESETS).map((k)=>({ value: k, label: PD_SCHOOL_PRESETS[k].label })),
	{ value: PD_SCHOOL_PRESET_CUSTOM, label: '自定' },
];

// 规范化档名:未知 → 默认 horosa。
export function normalizePdSchoolPreset(preset){
	if(preset === PD_SCHOOL_PRESET_CUSTOM){ return PD_SCHOOL_PRESET_CUSTOM; }
	return PD_SCHOOL_PRESETS[preset] ? preset : PD_SCHOOL_PRESET_DEFAULT;
}

const _b01 = (v, dflt)=>{
	if(v === undefined || v === null || v === ''){ return dflt; }
	return (v === true || v === 1 || v === '1' || v === 'true') ? 1 : 0;
};

// 由当前八维实值反查命中的档名;无任何档完全匹配 → 'custom'。
// 缺省按应用默认补齐(projection ptolemy/frame alcabitius/pdtype 0/顺 1 逆 1/Ptolemy/aspect/平行 0)
// ⇒ 老调用方(未接新维)仍命中 horosa,不会被误判「自定」。
export function pdPresetOf({ pdProjection, pdFrame, pdtype, pdDirect, pdConverse, pdTimeKey, pdFramework, pdParallel }){
	const proj = pdProjection || 'ptolemy';
	const frame = pdFrame || 'alcabitius';
	const t = Number(pdtype) === 1 ? 1 : 0;
	const dir = _b01(pdDirect, 1);
	const conv = _b01(pdConverse, 1);
	const key = pdTimeKey || 'Ptolemy';
	const fw = pdFramework || 'aspect';
	const par = _b01(pdParallel, 0);
	const hit = Object.keys(PD_SCHOOL_PRESETS).find((k)=>{
		const p = PD_SCHOOL_PRESETS[k];
		return p.pdProjection === proj && p.pdFrame === frame && Number(p.pdtype) === t
			&& Number(p.pdDirect) === dir && Number(p.pdConverse) === conv
			&& p.pdTimeKey === key && p.pdFramework === fw && Number(p.pdParallel) === par;
	});
	return hit || PD_SCHOOL_PRESET_CUSTOM;
}

export default {
	PD_SCHOOL_PRESETS, PD_SCHOOL_PRESET_OPTIONS, PD_SCHOOL_PRESET_DEFAULT, PD_SCHOOL_PRESET_CUSTOM,
	normalizePdSchoolPreset, pdPresetOf,
};
