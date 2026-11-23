// KinAstro 排盘设置跨会话保留、策天显示开关表、一掌经流派预设与页签
// 从 KinAstroMain.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { definePageSettings } from '../../../utils/pageSettingsStore';
import { CHUNZI_RESULT_LIMIT_OPTIONS } from '../kinastroOptions';
import { SCHOOL_LABEL as ZHENGCHUAN_SCHOOL_LABEL } from '../../shusuan/zhengchuanSchools';

// ── 一掌经·流派预设映射（中性键；每套一次 setState 批量套用全部开关）──
// 闰月细则一律 half（十五折半＝改造前口径，零回归）；夜半折半为可手选变体，不入预设。
export const YZJ_PRESET_LABELS = { guben: '古本正统', michuan: '秘传口诀', define: '定义版', chuangong: '串宫压运', tongxing: '通行简法', custom: '自定义' };

export const YZJ_PRESET_ORDER = ['guben', 'michuan', 'define', 'chuangong', 'tongxing'];

// 预设各开关取值（键＝state 后缀去 yizhangjing 前缀的小写首字，见 YZJ_PRESET_STATEMAP）
export const YZJ_PRESETS = {
	guben:     { Shunni: 'menShunNvNi',  MingGong: 'shuZhiMao', DayunLen: '10', StartAge: 'age1', Annual: 'xiaoxian', XiaoStart: 'ri',  XiaoDir: 'always', FlowSet: 'A', LeapRule: 'half', ZaoZi: false, Tongxian: true,  DingYue: 'nongli', StarNaming: 'A', DaoTerm: 'gui',  GradeSet: 'standard', Chongfan: 'alpha' },
	michuan:   { Shunni: 'yangNanYinNv', MingGong: 'shiShang',  DayunLen: '7',  StartAge: 'mi',   Annual: 'xiaoxian', XiaoStart: 'ri',  XiaoDir: 'chart',  FlowSet: 'A', LeapRule: 'half', ZaoZi: false, Tongxian: true,  DingYue: 'nongli', StarNaming: 'A', DaoTerm: 'gui',  GradeSet: 'standard', Chongfan: 'alpha' },
	define:    { Shunni: 'menShunNvNi',  MingGong: 'shuZhiMao', DayunLen: '10', StartAge: 'age1', Annual: 'liunian',  XiaoStart: 'yue', XiaoDir: 'chart',  FlowSet: 'A', LeapRule: 'half', ZaoZi: true,  Tongxian: false, DingYue: 'nongli', StarNaming: 'A', DaoTerm: 'edao', GradeSet: 'standard', Chongfan: 'beta'  },
	chuangong: { Shunni: 'menShunNvNi',  MingGong: 'shuZhiMao', DayunLen: '10', StartAge: 'age1', Annual: 'liunian',  XiaoStart: 'ri',  XiaoDir: 'chart',  FlowSet: 'B', LeapRule: 'half', ZaoZi: false, Tongxian: false, DingYue: 'nongli', StarNaming: 'A', DaoTerm: 'gui',  GradeSet: 'standard', Chongfan: 'alpha' },
	tongxing:  { Shunni: 'menShunNvNi',  MingGong: 'shuZhiMao', DayunLen: '10', StartAge: 'age1', Annual: 'xiaoxian', XiaoStart: 'ri',  XiaoDir: 'chart',  FlowSet: 'A', LeapRule: 'half', ZaoZi: false, Tongxian: false, DingYue: 'nongli', StarNaming: 'A', DaoTerm: 'gui',  GradeSet: 'standard', Chongfan: 'alpha' },
};

// 策天显示开关:左栏勾选与右栏「设置」页签同一份(名字、出现条件一致;此前右栏另起名字,且提示「书法仅亮度可调」已过时)。
// 后端「节气」行过滤不分算法:书法也列节气,否则原法关掉后切书法无处恢复。
const CETIAN_DISPLAY_TOGGLES = {
	book: [
		['cetianShowBrightness', '庙旺标注', '显示亮度(庙旺乐)'],
		['cetianShowLiunian', '流年飞星', '流年飞星外盘(主序/七煞/十七飞星)'],
		['cetianShowShensha', '神煞四表', '岁前/岁后/年干/月煞'],
		['cetianShowZaYao', '杂曜', '龙池凤阁三台八座天罗地网等廿八曜'],
		['cetianShowDuanjue', '断诀', '古籍条文自动命中'],
		['cetianShowXiu', '廿八宿', '廿八宿分野与三日宫'],
		['cetianShowBianyao', '十干变曜', '本命与流年变曜'],
		['cetianShowSolarTerm', '节气', '节气影响'],
	],
	kentang: [
		['cetianShowBrightness', '庙旺标注', '显示亮度(庙旺乐)'],
		['cetianShowWuXingJu', '五行局', '显示五行局'],
		['cetianShowSihua', '四化', '禄权科忌'],
		['cetianShowFlying', '飞星格局', '飞星与古法格局'],
		['cetianShowSolarTerm', '节气', '节气影响'],
	],
};

export function cetianDisplayToggles(method){ return method === 'kentang' ? CETIAN_DISPLAY_TOGGLES.kentang : CETIAN_DISPLAY_TOGGLES.book; }

// 设置描述 / 审批卡上显示开关的名字 = 左栏勾选项的名字(同一张表)
function cetianToggleLabel(key){
	const all = CETIAN_DISPLAY_TOGGLES.book.concat(CETIAN_DISPLAY_TOGGLES.kentang);
	const hit = all.find(([k])=>k === key);
	return `策天·${hit ? hit[1] : key}`;
}

// 排盘设置跨会话保留(用户实报:排盘设置改了之后每次重开软件都要重设)。本组件一身多技法(策天 / 演禽 / 一掌经 /
// 数算诸法),各技法的键自带前缀,收在同一份里互不相扰。只收口径 / 流派 / 算法 / 显示偏好;
// 不收:性别、刻数、四柱覆写与手填干支、手动农历、六亲年份、查询码与关键词、推演宫 / 星图 / 宿度这类逐盘输入与查询位置;
// 也不收「手动覆写 / 手动指定」这类输入模式开关 —— 模式与它的手填值是一体的,只留模式不留值,重开后会拿缺省值悄悄起一张错盘。
// 只在用户亲手改控件(setUserOpt)与亲手套预设(applyYzjPreset)时落盘;fields → state 的性别 / 农历锚点重同步不经这里。
export const KINASTRO_PAGE_SETTINGS = definePageSettings('horosa.kinastro.settings.v1', {
	cetianMethod: { label: '策天·算法', def: 'book', oneOf: ['book', 'kentang'] },
	cetianLunarMode: { label: '策天·农历', def: 'sxtwl', oneOf: ['sxtwl', 'classic'] },
	cetianStarOrder: { label: '策天·正曜', def: 'reverse', oneOf: ['reverse', 'forward'] },
	cetianShowWuXingJu: { label: cetianToggleLabel('cetianShowWuXingJu'), def: 1, oneOf: [0, 1] },
	cetianShowSihua: { label: cetianToggleLabel('cetianShowSihua'), def: 1, oneOf: [0, 1] },
	cetianShowFlying: { label: cetianToggleLabel('cetianShowFlying'), def: 1, oneOf: [0, 1] },
	cetianShowBrightness: { label: cetianToggleLabel('cetianShowBrightness'), def: 1, oneOf: [0, 1] },
	cetianShowSolarTerm: { label: cetianToggleLabel('cetianShowSolarTerm'), def: 1, oneOf: [0, 1] },
	cetianBrightnessSchool: { label: '策天·庙旺', def: 'yiyu', oneOf: ['yiyu', 'quanji'] },
	cetianShenGongMode: { label: '策天·身宫', def: 'yizheng', oneOf: ['yizheng', 'literal'] },
	cetianDaxianMode: { label: '策天·大限', def: 'yiyu', oneOf: ['yiyu', 'legacy'] },
	cetianTianluoMode: { label: '策天·罗网', def: 'benshu', oneOf: ['benshu', 'zhongtian'] },
	cetianPalaceNameMode: { label: '策天·宫名', def: 'common', oneOf: ['common', 'monk'] },
	cetianLiunianQishaMode: { label: '策天·七煞', def: 'shengshi', oneOf: ['shengshi', 'suishu'] },
	cetianShowLiunian: { label: cetianToggleLabel('cetianShowLiunian'), def: 1, oneOf: [0, 1] },
	cetianShowShensha: { label: cetianToggleLabel('cetianShowShensha'), def: 1, oneOf: [0, 1] },
	cetianShowZaYao: { label: cetianToggleLabel('cetianShowZaYao'), def: 1, oneOf: [0, 1] },
	cetianShowDuanjue: { label: cetianToggleLabel('cetianShowDuanjue'), def: 1, oneOf: [0, 1] },
	cetianShowXiu: { label: cetianToggleLabel('cetianShowXiu'), def: 1, oneOf: [0, 1] },
	cetianShowBianyao: { label: cetianToggleLabel('cetianShowBianyao'), def: 1, oneOf: [0, 1] },
	useKey: { def: '1', oneOf: ['1', '0'] },
	tiebanMethod: { label: '铁板·算法', def: 'kunji', oneOf: ['kunji', 'suanpan'] },
	tiebanSchool: { def: 'south', oneOf: ['south', 'north'] },
	tiebanKeSystem: { def: 'qing8', oneOf: ['qing8', 'ming100', 'dou12'] },
	tiebanDayunSteps: { label: '铁板·大运步数', def: 8, type: 'number', int: true, min: 1, max: 12 },
	chunziResultLimit: { def: '20', oneOf: CHUNZI_RESULT_LIMIT_OPTIONS.map((o)=>o.value) },
	canpingMethod: { label: '参评·取法', def: 'ming', oneOf: ['ming', 'gu'] },
	canpingDayun: { label: '参评·大运排法', def: 'mingGongQiyun', oneOf: ['mingGongQiyun', 'mingGongOne', 'baziStyle'] },
	heluoQuHuaGong: { label: '河洛·取化工法', def: 'tuWangKunGen', oneOf: ['tuWangKunGen', 'siFangBoOnly'] },
	heluoZiShu: { label: '河洛·取数法', def: 'pair', oneOf: ['pair', 'single'] },
	heluoJiGong: { label: '河洛·五寄中宫', def: 'manualSanYuan', oneOf: ['manualSanYuan', 'legacy'] },
	heluoZhiZun: { label: '河洛·三至尊卦', def: true },
	heluoPureGanKun: { label: '河洛·纯乾坤落爻', def: 'current', oneOf: ['current', 'alt'] },
	heluoLiunianStep2: { label: '河洛·流年次步', def: 'ying', oneOf: ['ying', 'sequential'] },
	heluoLiuYueMode: { label: '河洛·流月起月', def: 'ying', oneOf: ['ying', 'legacy'] },
	heluoHuangdiOffset: { label: '河洛·纪年基准（黄帝纪元差）', def: '2697', type: 'string', maxLen: 6 },
	heluoShowLiuRi: { label: '河洛·流月列流日', def: true },
	zhengchuanSchool: { label: '正传·流派', def: 'tieban', oneOf: Object.keys(ZHENGCHUAN_SCHOOL_LABEL) },
	yizhangjingPreset: { label: '一掌经·流派预设', def: 'michuan', oneOf: Object.keys(YZJ_PRESETS) },
	yizhangjingShunni: { label: '一掌经·顺逆规则', def: 'yangNanYinNv', oneOf: ['yangNanYinNv', 'menShunNvNi'] },
	yizhangjingMingGong: { label: '一掌经·命宫定法', def: 'shiShang', oneOf: ['shiShang', 'shuZhiMao'] },
	yizhangjingDayunLen: { label: '一掌经·大限运长', def: '7', oneOf: ['7', '10'] },
	yizhangjingStartAge: { label: '一掌经·大限起运', def: 'mi', oneOf: ['mi', 'age1'] },
	yizhangjingXiaoStart: { label: '一掌经·小限起宫', def: 'ri', oneOf: ['ri', 'yue'] },
	yizhangjingXiaoDir: { label: '一掌经·小限顺逆', def: 'chart', oneOf: ['chart', 'always'] },
	yizhangjingAnnual: { label: '一掌经·逐年法', def: 'xiaoxian', oneOf: ['xiaoxian', 'liunian'] },
	yizhangjingFlowSet: { label: '一掌经·流年十二神', def: 'A', oneOf: ['A', 'B', 'C'] },
	yizhangjingTongxian: { label: '一掌经·童限', def: true },
	yizhangjingChongfan: { label: '一掌经·重犯口诀', def: 'alpha', oneOf: ['alpha', 'beta'] },
	yizhangjingDingYue: { label: '一掌经·定月法', def: 'nongli', oneOf: ['nongli', 'jieqi'] },
	yizhangjingLeapRule: { label: '一掌经·闰月细则', def: 'half', oneOf: ['half', 'midnight'] },
	yizhangjingZaoZi: { label: '一掌经·早子调宫', def: false },
	yizhangjingStarNaming: { label: '一掌经·星名系统', def: 'A', oneOf: ['A', 'B', 'C'] },
	yizhangjingDaoTerm: { label: '一掌经·六道术语', def: 'gui', oneOf: ['gui', 'edao'] },
	yizhangjingGradeSet: { label: '一掌经·品级分类', def: 'standard', oneOf: ['standard', 'variant'] },
	yizhangjingShensha: { label: '一掌经·神煞合参', def: false },
});

// 预设字段 → state 键（前缀 yizhangjing）
export const YZJ_PRESET_STATEMAP = ['Shunni', 'MingGong', 'DayunLen', 'StartAge', 'Annual', 'XiaoStart', 'XiaoDir', 'FlowSet', 'LeapRule', 'ZaoZi', 'Tongxian', 'DingYue', 'StarNaming', 'DaoTerm', 'GradeSet', 'Chongfan'];

// 一掌经右栏页签(与 YiZhangJingMain 右栏的页签同序同名;神煞页只在开了神煞合参时出现)
export const YZJ_AUX_TABS = [
	{ key: 'overview', label: '概览' },
	{ key: 'geju', label: '格局' },
	{ key: 'renshi', label: '十二宫' },
	{ key: 'dayun', label: '运限' },
	{ key: 'shensha', label: '神煞' },
	{ key: 'duanfa', label: '断法' },
	{ key: 'lore', label: '诗文' },
	{ key: 'sizhu', label: '四柱文献' },
];

// 预设字段 → buildYizhangjingOpts 输出键（供哨兵/测试核对预设→引擎口径一致）
export const YZJ_STATE_TO_OPT = {
	Shunni: 'shunniRule', MingGong: 'mingGongMethod', DayunLen: 'dayunLength', StartAge: 'dayunStartAge',
	Annual: 'annualMethod', XiaoStart: 'xiaoxianStart', XiaoDir: 'xiaoxianDir', FlowSet: 'flowShenSet',
	LeapRule: 'leapRule', ZaoZi: 'zaoZiAdjust', DingYue: 'dingYue', StarNaming: 'starNaming',
	DaoTerm: 'daoTerm', GradeSet: 'gradeSet', Chongfan: 'chongfanKou',
};
