// 紫微「流派预设」:一键套用各流派的开关组合(四化 + 全部 ZWEngineOptions 传本开关)。
// 选 preset → 套全组合;手调任一开关 → presetOf 自动判为「自定义」。各流派依公有术数学派惯例编排。
// 注:三合派/飞星派「排盘」同源(差在读法:三合看三方四正照、飞星看四化飞宫→由「盘式」三合盘/四化盘区分),故二者开关组合相同。

// 一个 preset = { sihua(=ZWSchool.school), + ZWEngineOptions 字段(含亮度源 + 6 显示 overlay 开关) }。
// 注:taiSuiRelatives(数组)不入 preset 比较(值型 === 无法比数组);由用户单独维护。
const D = {
	daxianSpan: 10, tianmaBasis: 'month', starSet: 'full', sanPan: 'tian', shangShi: 'fixed',
	leapMonth: 'mid_split', lateZi: 'global', yearBoundary: 'lichun', huoling: 'sanhe', kongNaming: 'modern',
	brightnessSource: 'zi_jian', lifeMasterBy: 'year_branch', liuYueBasis: 'doujun', liunianSihuaGan: 'year_gan', changshengStart: 'shui_tu', changshengDirection: 'yinyang', kuiYue: 'jia_wu_geng', kongwangStyle: 'double', xiaoxianMode: '0',
	flowLuanXi: false, flowHuoLing: false, flowShenshaOnChart: false, childLimit: false, zhongxian: false, huoPan: false, qishuWei: false, borrowPalace: false, taiSuiRuGua: false,
};

export const ZIWEI_SCHOOL_PRESETS = {
	sanhe:     { label: '三合派(通用)', sihua: 'beipai', ...D },
	feixing:   { label: '飞星派', sihua: 'beipai', ...D },                       // 排盘同三合,读法走四化盘
	zhongzhou: { label: '中州派', sihua: 'zhongzhou', ...D, shangShi: 'yinyang', borrowPalace: true },// 中州四化+天伤阴阳互换+借宫安星;亮度=默认表(基表即中州五档口径,血统金标钉死),配任何新源都是死选项
	qintian:   { label: '钦天派', sihua: 'beipai', ...D, daxianSpan: 'ju' },      // 大限=局数年
	quanshu:   { label: '全书派', sihua: 'quanshu', ...D, brightnessSource: 'quanshu' },  // 《全书》四化(庚天同科/壬天府科)+《全书》煞星亮度改订(修「选全书派不切全书亮度」接线洞)
	heluo:     { label: '河洛派', sihua: 'beipai', ...D, starSet: 'north18', qishuWei: true },    // 精简18星+气数位一六共宗
	ziyun:     { label: '紫云派', sihua: 'beipai', ...D, taiSuiRuGua: true },     // 三合 base + 太岁入卦
	shenshi:   { label: '沈氏派', sihua: 'beipai', ...D, zhongxian: true },       // 三合 base + 三限法2.5年
	toupai:    { label: '透派', sihua: 'beipai', ...D, huoPan: true },            // 三合 base + 活盘(命身宫异法待考不做)
	zhanyan:   { label: '占验派', sihua: 'beipai', ...D, huoPan: true, starSet: 'north18' },   // 立极活盘 + 精简用星
};

export const ZIWEI_PRESET_OPTIONS = Object.keys(ZIWEI_SCHOOL_PRESETS)
	.map((k)=>({ value: k, label: ZIWEI_SCHOOL_PRESETS[k].label }))
	.concat([{ value: 'custom', label: '自定义…' }]);

const OPT_KEYS = ['daxianSpan', 'tianmaBasis', 'starSet', 'sanPan', 'shangShi', 'leapMonth', 'lateZi', 'yearBoundary', 'huoling', 'kongNaming',
	'brightnessSource', 'lifeMasterBy', 'liuYueBasis', 'liunianSihuaGan', 'changshengStart', 'changshengDirection', 'kuiYue', 'kongwangStyle', 'xiaoxianMode', 'flowLuanXi', 'flowHuoLing', 'flowShenshaOnChart', 'childLimit', 'zhongxian', 'huoPan', 'qishuWei', 'borrowPalace', 'taiSuiRuGua'];
export const ZIWEI_PRESET_OPT_KEYS = OPT_KEYS;

// 当前(四化 school + ZWEngineOptions)是否完全匹配某 preset。
export function presetMatches(preset, school, opts){
	const p = ZIWEI_SCHOOL_PRESETS[preset];
	if(!p){ return false; }
	if(p.sihua !== school){ return false; }
	return OPT_KEYS.every((k)=>p[k] === opts[k]);
}

// 给定当前 school+opts + 用户上次所选 preset(消歧三合/飞星等同源组),返回应显示的 preset key(不匹配→'custom')。
export function presetOf(school, opts, lastPicked){
	if(lastPicked && lastPicked !== 'custom' && presetMatches(lastPicked, school, opts)){ return lastPicked; }
	const hit = Object.keys(ZIWEI_SCHOOL_PRESETS).find((k)=>presetMatches(k, school, opts));
	return hit || 'custom';
}

// [D4] 盘面显示预设(完整/标准/精简):纯显示 LS 开关族的三档组合。
// 有意不入本表的键(改前先读理由):ziweiSixEvilBlack(用色风格,非疏密取舍)、命宫/日干四化徽
// (ziweiShowMingSihua/ziweiShowDaySihua,专业研判增量,预设不代拨)、范式B引擎键(flowShenshaOnChart
// 等走 ZWEngineOptions/挂载语义,与纯显示 LS 族不同生命周期)。
export const ZW_DISPLAY_PRESET_KEYS = [
	'ziweiShowOthers', 'ziweiShowSmall', 'ziweiShowStarLight', 'ziweiShowLaiyin', 'ziweiShowBodyPalace',
	'ziweiShowShaHuagai', 'ziweiShowShaSande', 'ziweiShowShaTaizuo',
	'ziweiShowYearAges', 'ziweiShowXiaoxianAges', 'ziweiShowXiaoxianLayer', 'ziweiZihuaAlways', 'ziweiShowSfszLine',
];
export const ZW_DISPLAY_PRESETS = {
	full: { label: '完整', flags: { ziweiShowOthers: 1, ziweiShowSmall: 1, ziweiShowStarLight: 1, ziweiShowLaiyin: 1, ziweiShowBodyPalace: 1, ziweiShowShaHuagai: 1, ziweiShowShaSande: 1, ziweiShowShaTaizuo: 1, ziweiShowYearAges: 1, ziweiShowXiaoxianAges: 1, ziweiShowXiaoxianLayer: 1, ziweiZihuaAlways: 1, ziweiShowSfszLine: 1 } },
	standard: { label: '标准', flags: { ziweiShowOthers: 1, ziweiShowSmall: 0, ziweiShowStarLight: 1, ziweiShowLaiyin: 1, ziweiShowBodyPalace: 1, ziweiShowShaHuagai: 1, ziweiShowShaSande: 1, ziweiShowShaTaizuo: 1, ziweiShowYearAges: 0, ziweiShowXiaoxianAges: 0, ziweiShowXiaoxianLayer: 0, ziweiZihuaAlways: 0, ziweiShowSfszLine: 1 } },
	minimal: { label: '精简', flags: { ziweiShowOthers: 0, ziweiShowSmall: 0, ziweiShowStarLight: 0, ziweiShowLaiyin: 0, ziweiShowBodyPalace: 0, ziweiShowShaHuagai: 0, ziweiShowShaSande: 0, ziweiShowShaTaizuo: 0, ziweiShowYearAges: 0, ziweiShowXiaoxianAges: 0, ziweiShowXiaoxianLayer: 0, ziweiZihuaAlways: 0, ziweiShowSfszLine: 0 } },
};
// 当前 LS 态命中哪个显示预设(全键相等才命中;否则 null=自定义)。readFlag=测试可注入的读取器。
export function displayPresetOf(readFlag){
	const names = Object.keys(ZW_DISPLAY_PRESETS);
	for(const n of names){
		const flags = ZW_DISPLAY_PRESETS[n].flags;
		if(ZW_DISPLAY_PRESET_KEYS.every((k)=>!!readFlag(k) === !!flags[k])){ return n; }
	}
	return null;
}
