// 紫微「流派预设」:一键套用各流派的开关组合(四化 + 全部 ZWEngineOptions 传本开关)。
// 选 preset → 套全组合;手调任一开关 → presetOf 自动判为「自定义」。各流派依公有术数学派惯例编排。
// 注:三合派/飞星派「排盘」同源(差在读法:三合看三方四正照、飞星看四化飞宫→由「盘式」三合盘/四化盘区分),故二者开关组合相同。

// 一个 preset = { sihua(=ZWSchool.school), + ZWEngineOptions 字段(含亮度源 + 6 显示 overlay 开关) }。
// 注:taiSuiRelatives(数组)不入 preset 比较(值型 === 无法比数组);由用户单独维护。
const D = {
	daxianSpan: 10, tianmaBasis: 'month', starSet: 'full', sanPan: 'tian', shangShi: 'fixed',
	leapMonth: 'mid_split', lateZi: 'zi_chu', yearBoundary: 'lichun', huoling: 'sanhe', kongNaming: 'modern',
	brightnessSource: 'zi_jian',
	childLimit: false, zhongxian: false, huoPan: false, qishuWei: false, borrowPalace: false, taiSuiRuGua: false,
};

export const ZIWEI_SCHOOL_PRESETS = {
	sanhe:     { label: '三合派(通用)', sihua: 'beipai', ...D },
	feixing:   { label: '飞星派', sihua: 'beipai', ...D },                       // 排盘同三合,读法走四化盘
	zhongzhou: { label: '中州派', sihua: 'zhongzhou', ...D, shangShi: 'yinyang', borrowPalace: true },// 王亭之:中州四化+天伤阴阳互换+借宫安星
	qintian:   { label: '钦天派', sihua: 'beipai', ...D, daxianSpan: 'ju' },      // 大限=局数年
	quanshu:   { label: '全书派', sihua: 'quanshu', ...D },                       // 《全书》四化(庚天同科/壬天府科)
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
	'brightnessSource', 'childLimit', 'zhongxian', 'huoPan', 'qishuWei', 'borrowPalace', 'taiSuiRuGua'];
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
