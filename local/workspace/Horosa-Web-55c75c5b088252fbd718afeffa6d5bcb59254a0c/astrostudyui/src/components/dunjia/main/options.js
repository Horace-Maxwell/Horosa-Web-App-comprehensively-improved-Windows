// 奇门页起局选项缺省、排盘设置跨会话保留、盘面尺寸常量、旧存档选项迁移与用神查表
// 从 DunJiaMain.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../../utils/dayBoundary';
import { definePageSettings } from '../../../utils/pageSettingsStore';
import { PAIPAN_OPTIONS, ZHISHI_OPTIONS, YUEJIA_QIJU_OPTIONS, QIJU_METHOD_OPTIONS, SCHOOL_OPTIONS, KONG_MODE_OPTIONS, MA_MODE_OPTIONS, TIME_ALG_OPTIONS, ZHIRUN_LEAP_OPTIONS, GODS_PRESET_OPTIONS, JIGONG_MODE_OPTIONS, ANGAN_MODE_OPTIONS, TUIYAN_VIEW_OPTIONS, TUIYAN_GONG_OPTIONS, SHIFT_ZHIFU_OPTIONS, YEARJIA_JU_OPTIONS, DAYJIA_JU_OPTIONS, KEJIA_FENDUN_OPTIONS, JINHAN_MENPAI_OPTIONS, migrateLegacyQimenSchool } from '../DunJiaCalc';

export const FENGJU_OPTIONS = [
	{ value: 0, label: '未封局' },
	{ value: 1, label: '已封局' },
];
export const DEFAULT_OPTIONS = {
	sex: 1,
	dateType: 0,
	leapMonthType: 0,
	xuShiSuiType: 0,
	jieQiType: 1,
	paiPanType: 3,
	zhiShiType: 0,
	yueJiaQiJuType: 0,
	shuziReportNumber: '',
	yearGanZhiType: 2,
	monthGanZhiType: 1,
	dayGanZhiType: 0,
	qijuMethod: 'zhirun',
	school: '转盘',
	kongMode: 'day',
	yimaMode: 'day',
	timeAlg: 0,
	shiftPalace: 0,
	after23NewDay: defaultAfter23NewDay(),
	lateZiHourUseNextDay: defaultLateZiHourUseNextDay(),
	fengJu: false,
	zhirunLeapDays: 9,
	godsPreset: 'baihu_xuanwu',   // 转盘八神名预设(默认=历史恒虎玄,零回归)
	jiGongMode: 'kun',            // 中宫寄宫(默认恒坤二,零回归)
	feiXingShun: false,           // 飞盘九星阴阳遁皆顺飞(默认关=阳顺阴逆)
	feiMenShun: false,            // 飞盘九门皆顺飞
	feiShenShun: false,           // 飞盘九神皆顺飞
	feiMenZhongCan: true,         // 中门参与飞宫(默认开=九门含中5;关=八门跳中传派)
	feiMenZhongShow: false,       // 中门不参与时中宫标「中」(纯显示)
	mixTian: '',                  // 混合盘天盘层(''=默认转 /'zhuan'/'fei')
	mixXing: '',                  // 混合盘九星层(''=默认转)
	mixMen: '',                   // 混合盘八门层(''=默认飞)
	mixShen: '',                  // 混合盘九神层(''=默认飞)
	kongMarkBoth: false,          // 日空时空并标(默认关=单模式)
	showAllKong: false,           // 四柱空亡全览(默认关)
	shiftZhiFuMode: 'follow',     // 移星后值符值使标记(follow=随盘平移,默认)
	yearJiaJu: 'sanyuan',         // 年家定局粒度(默认六十年一局)
	dayJiaJu: 'yiyuan',           // 日家定局粒度(默认六十日一局)
	keJiaFenDun: 'zihou',         // 刻家分遁(默认子后阳午后阴)
	keZiZhengHuanShi: false,      // 刻家子正换时(默认关=23点起子时)
	jinhanMenPai: 'book',         // 金函系日家八门排法(默认书表直录)
	anGanMode: 'off',             // 暗干五法(默认关)
	showAnZhi: false,             // 暗支随暗干显示
	showJiGan: false,             // 寄干显示(中五干寄宫;默认关)
	showTianQin: false,           // 天禽显示(随寄宫之星落宫;默认关)
	tuiYanView: 'off',            // 推演显示:翻宫 / 转宫(纯显示,不改排盘结果;默认常规)
	tuiYanGong: 'shigan',         // 推演用神宫(默认时干落宫)
	showJianChu: false,           // 十二建星外环(盘外一圈十二支 + 建星;盘下按钮 / 左栏同一键;默认关)
	fullNameTips: false,          // 提示词条标题带类别全名(星/门/神)
};

// 出厂起盘选项(全键;日界两键取全局现值)。奇门择日载入方案时以它打底:方案里没写的键回出厂值,不取会话现值。
export function dunjiaFactoryOptions(){
	return { ...DEFAULT_OPTIONS, after23NewDay: defaultAfter23NewDay(), lateZiHourUseNextDay: defaultLateZiHourUseNextDay() };
}

// 排盘设置跨会话保留(用户实报:排盘设置改了之后每次重开软件都要重设;奇门与六壬 / 太乙同病)。
// 只收口径 / 流派 / 显示偏好。不进的:性别(随命主)、报数(每课输入)、移星(逐盘操作)、封局(逐盘状态)、
// 23 点换日 / 晚子时(归全局设置管,全局现值为准)。
// 独立奇门页与奇门择日内嵌实例共用同一份:奇门择日的工作台参数首开即取自内嵌盘(seedFromBoard),扫描与点选后的显示盘同口径;
// (六壬 / 太乙 / 三式择日不同 —— 它们的扫描引擎有钉死口径,内嵌盘不读不写保存值,见各页注。)
// 只在用户亲手改控件时落盘:事盘回灌 / 宿主下发 / 全局广播都不落盘。
const vals = (list)=>list.map((o)=>o.value);
export const DUNJIA_PAGE_SETTINGS = definePageSettings('horosa.dunjia.settings.v1', {
	paiPanType: { def: DEFAULT_OPTIONS.paiPanType, oneOf: vals(PAIPAN_OPTIONS) },
	zhiShiType: { def: DEFAULT_OPTIONS.zhiShiType, oneOf: vals(ZHISHI_OPTIONS) },
	yueJiaQiJuType: { def: DEFAULT_OPTIONS.yueJiaQiJuType, oneOf: vals(YUEJIA_QIJU_OPTIONS) },
	// 候选随排盘体例增减(时家 / 刻家 5 档,其余 2 档),全集固定。阴盘(报数定局)离不开每一课的报数,不进候选:
	// 选了照常用,只是不记(库里留上一次的节气起局法)—— 否则重开后标签写阴盘、报数是空的,实际按拆补起局
	qijuMethod: { def: DEFAULT_OPTIONS.qijuMethod, oneOf: QIJU_METHOD_OPTIONS.map((o)=>o.value).filter((v)=>v !== 'shuzi') },
	school: { def: DEFAULT_OPTIONS.school, oneOf: vals(SCHOOL_OPTIONS) },
	kongMode: { def: DEFAULT_OPTIONS.kongMode, oneOf: vals(KONG_MODE_OPTIONS) },
	yimaMode: { def: DEFAULT_OPTIONS.yimaMode, oneOf: vals(MA_MODE_OPTIONS) },
	timeAlg: { def: DEFAULT_OPTIONS.timeAlg, oneOf: vals(TIME_ALG_OPTIONS) },
	zhirunLeapDays: { def: DEFAULT_OPTIONS.zhirunLeapDays, oneOf: vals(ZHIRUN_LEAP_OPTIONS) },
	godsPreset: { def: DEFAULT_OPTIONS.godsPreset, oneOf: vals(GODS_PRESET_OPTIONS) },
	jiGongMode: { def: DEFAULT_OPTIONS.jiGongMode, oneOf: vals(JIGONG_MODE_OPTIONS) },
	anGanMode: { def: DEFAULT_OPTIONS.anGanMode, oneOf: vals(ANGAN_MODE_OPTIONS) },
	shiftZhiFuMode: { def: DEFAULT_OPTIONS.shiftZhiFuMode, oneOf: vals(SHIFT_ZHIFU_OPTIONS) },
	yearJiaJu: { def: DEFAULT_OPTIONS.yearJiaJu, oneOf: vals(YEARJIA_JU_OPTIONS) },
	dayJiaJu: { def: DEFAULT_OPTIONS.dayJiaJu, oneOf: vals(DAYJIA_JU_OPTIONS) },
	keJiaFenDun: { def: DEFAULT_OPTIONS.keJiaFenDun, oneOf: vals(KEJIA_FENDUN_OPTIONS) },
	jinhanMenPai: { def: DEFAULT_OPTIONS.jinhanMenPai, oneOf: vals(JINHAN_MENPAI_OPTIONS) },
	mixTian: { def: '', oneOf: ['', 'zhuan', 'fei'] },
	mixXing: { def: '', oneOf: ['', 'zhuan', 'fei'] },
	mixMen: { def: '', oneOf: ['', 'zhuan', 'fei'] },
	mixShen: { def: '', oneOf: ['', 'zhuan', 'fei'] },
	feiXingShun: { def: DEFAULT_OPTIONS.feiXingShun },
	feiMenShun: { def: DEFAULT_OPTIONS.feiMenShun },
	feiShenShun: { def: DEFAULT_OPTIONS.feiShenShun },
	feiMenZhongCan: { def: DEFAULT_OPTIONS.feiMenZhongCan },
	feiMenZhongShow: { def: DEFAULT_OPTIONS.feiMenZhongShow },
	kongMarkBoth: { def: DEFAULT_OPTIONS.kongMarkBoth },
	showAllKong: { def: DEFAULT_OPTIONS.showAllKong },
	keZiZhengHuanShi: { def: DEFAULT_OPTIONS.keZiZhengHuanShi },
	showAnZhi: { def: DEFAULT_OPTIONS.showAnZhi },
	showJiGan: { def: DEFAULT_OPTIONS.showJiGan },
	showTianQin: { def: DEFAULT_OPTIONS.showTianQin },
	tuiYanView: { def: DEFAULT_OPTIONS.tuiYanView, oneOf: vals(TUIYAN_VIEW_OPTIONS) },
	tuiYanGong: { def: DEFAULT_OPTIONS.tuiYanGong, oneOf: vals(TUIYAN_GONG_OPTIONS) },
	showJianChu: { def: DEFAULT_OPTIONS.showJianChu },
	fullNameTips: { label: '词条标题全名', def: DEFAULT_OPTIONS.fullNameTips },
});

export const DUNJIA_BOARD_BASE_WIDTH = 662;
export const DUNJIA_BOARD_BASE_HEIGHT = 870;
export const DUNJIA_SCALE_MIN = 0.58;
export const DUNJIA_SCALE_MAX = 1.18;
export const QIMEN_PATTERN_INTERPRETATION_STORAGE_KEY = 'qimenShowPatternInterpretation';

export function normalizeKenQimenOptions(options){
	const next = {
		...DEFAULT_OPTIONS,
		// 日界两键**现取**全局:DEFAULT_OPTIONS 是模块顶层常量(奇门是预载分包 → 值停在
		//   模块载入那一刻),会话内先改全局「23 点换日 / 晚子时」再首开奇门,曾仍按旧值排日柱与时柱。
		//   太乙 / 三式在构造函数里现读,本来就没这问题。传入 options 里显式带了这两键(存档 / 用户改过)时
		//   仍以传入值为准 —— 展开序保证。
		after23NewDay: defaultAfter23NewDay(),
		lateZiHourUseNextDay: defaultLateZiHourUseNextDay(),
		...(options || {}),
	};
	// 旧数据迁移:阴盘曾为「盘式」(school='阴盘'),现为「起局法」(qijuMethod='shuzi',报数定局)。
	// 旧存命盘/事盘载入时:盘式回落转盘、起局切阴盘(保留 shuziReportNumber),否则盘式下拉显非法值、且报数定局失效。单源 migrateLegacyQimenSchool
	return migrateLegacyQimenSchool(next);
}

// 用神取用速查(§16):一事一测,先定用神,再看其落宫旺衰/格局/生克。静态参考字典。
export const QIMEN_YONGSHEN_BASIC = [
	['日干', '求测人自己(主方/我方)'],
	['时干', '所测之事 / 对方 / 客方'],
	['值符(星)', '领导、贵人、大环境、核心势力'],
	['值使(门)', '事情发展通道、办事"门路"'],
	['年命', '求测者本人(年支/年干所落宫=年命宫)'],
	['旬空·马星', '事之虚实、动静缓急'],
];
export const QIMEN_YONGSHEN_LOOKUP = [
	['求财·生意', '生门、日干、财(我克者/戊)', '天任、值符、生门落宫旺衰'],
	['事业·求官·求职', '开门、值符', '日干生旺、官星、太岁'],
	['婚姻(男测)', '日干(己)、庚/对方干、六合', '太阴、咸池、乙(女方)'],
	['婚姻(女测)', '日干、乙/对方干、六合', '太阴、庚(男方)'],
	['官司诉讼', '开门(官府)、庚(对方/法)、值符', '伤门、惊门、白虎、日干vs时干'],
	['疾病', '天芮(病)、死门、年命宫', '天心(医)、休门(药)、日干旺衰'],
	['出行·外出', '马星、开门、日干', '所往方位之宫、杜门(阻)'],
	['考试·文书·信息', '景门、天辅、丁奇', '值符、日干、文书宫旺衰'],
	['寻人·走失', '玄武(逃向)、日干、马星', '杜门(藏)、所落宫方位'],
	['失物·盗窃', '玄武、天蓬(盗)、生门(财物)', '物类象干、地盘方位'],
	['合作·谈判·交易', '六合、日干vs时干、生门', '值符、太阴'],
	['怀孕·生育', '九地、天芮(胎)、生门', '乙、年命、子孙'],
	['房产·置业', '生门、坤2/艮8宫、戊(不动产)', '天任、值符'],
];
export const QIMEN_YONGSHEN_SHENGKE = [
	['比和', '用神与所临星门宫同五行——平稳、顺'],
	['生入(生我)', '他来生用神——得助、有利、被帮'],
	['生出(我生)', '用神生他——耗泄、付出、被求'],
	['克入(克我)', '他来克用神——受制、阻碍、被压'],
	['克出(我克)', '用神克他——我主动、得财/得制(克者为财)'],
];
