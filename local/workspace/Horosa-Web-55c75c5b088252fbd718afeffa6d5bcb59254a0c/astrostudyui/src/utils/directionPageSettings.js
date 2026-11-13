// 「星运」各子页的排盘设置 · 跨会话保留(用户实报:排盘设置改了之后每次重开软件都要重设)。
//
// 星运族是十几个各自独立的组件(流年法 / 返照 / 小限 / 太阳弧 / 行星弧 / 波斯向运共用一张表单,三个推运页各有月长算法 …),
// 同一位用户的口径只有一套,所以收成一份:
//   nodeRetrograde        南北交逆移(小限法 / 太阳弧 / 行星弧 —— 真有这个控件的三页 —— 同一个值;流年法 / 两个返照页隐藏该控件、
//                         波斯向运没有该控件,它们恒用出厂值,不读这份保存值:看不见的设置不许暗中改结果)
//   minorVariant          小推运月长算法(推运 / 赤纬推运 / 恒星推运三页同一个值)
//   yearBand              行星年龄的年数档
//   triplicityDivision    三分主星推运的划分法
//   triplicityLifespan    三分主星推运的寿命基准
//   ephemerisTransits     星历页「行运触发本命」
//   *Inverse              流年法 / 月亮返照 / 太阳返照的双盘内外圈(三页出厂值不同,各存各的)
//   persian*              波斯向运的速率 / 方向 / 应期年数
//   decennial*            十年大运的起运主星 / 分配次序 / 日数表 / 年长
//   balbillus* / keypointsMode  Balbillus 的起始星 / 年制 / 距离口径 / 子限铺法;数字相位的起点(身 / 命)
//   ys129*                129 年系统的起始星 / 次序 / 年制 / 子限铺法
//   dist*                 界推运的发放点 / 时间算法 / 年长 / 年限
//   ap*                   年龄推进点的推进方式 / 事件 / 年长 / 年限
//   profGrain / profStart 小限法摘要的粒度(年 / 月 / 日)与起点(上升 / 区分光 / 福点 / 月亮 / 天顶)
//   tl*                   时主轮转的方法、年长与各法选项
//   ner* / bezzaOrb / jayFrom / michon*  推运图族:演进推运的弧常数 / 出生前年数 / 换到赤道 / 容许度;推运图的接触窗;
//                         周日小限的起始年龄;双黄道的容许度 / 水金互换 / 等宫
// 不收:各页的目标日期 / 目标年份 / 地点(输入);「行运星与本命星交角容许度」(初值归「星盘设置」的全局行运容许度管,
// 页内改动只覆盖本会话);三分主星的「三分体系」(初值随本盘排盘口径 / 流派预设)。
//
// 月长算法 / 年数档的候选值在这里写死而不 import 组件常量:那些常量住在重组件文件里,反向 import 会成环。
// 与组件常量的一致性由测试逐个比对(directionPageSettings.test.js)。
import { definePageSettings } from './pageSettingsStore';
import { NEROMAN_DEFAULTS, BEZZA_DEFAULTS, JAY_DEFAULTS, MICHON_DEFAULTS } from './directedFigures';
import { TIMELORD_DEFAULTS, TIMELORD_METHODS, TIMELORD_OPTIONS } from './timeLordTables';
import { TRIPLICITY_DIVISIONS, TRIPLICITY_LIFESPAN_DEFAULT } from './triplicityRulers';
import { PROFECTION_GRAIN_OPTIONS, PROFECTION_START_OPTIONS } from './profectionSummary';
import { BALBILLUS_YEARS, BALBILLUS_YEAR_TYPES, BALBILLUS_MODES, BALBILLUS_SUB_RULES, BALBILLUS_DEFAULT_OPTS } from './balbillus';
import { YS129_START_OPTIONS, YS129_ORDERS, YS129_YEAR_TYPES, YS129_SUB_RULES, YS129_DEFAULT_OPTS } from './yearSystem129';
import { DIST_RELEASERS, DIST_METHODS, DIST_YEARS, DIST_SPANS, DIST_DEFAULTS } from './distributionsOptions';
import { AP_METHODS, AP_EVENTS, AP_YEARS, AP_SPANS, AP_DEFAULTS } from './agePointOptions';
import { RELEASE_MODES, KEYPOINTS_DEFAULT_OPTS } from './keypoints120';
import { DECENNIAL_START_MODE_SECT_LIGHT, DECENNIAL_TRADITIONAL_PLANETS, DECENNIAL_ORDER_ZODIACAL, DECENNIAL_ORDER_CHALDEAN, DECENNIAL_DAY_METHOD_VALENS, DECENNIAL_DAY_METHOD_HEPHAISTIO, DECENNIAL_CALENDAR_TRADITIONAL, DECENNIAL_CALENDAR_ACTUAL } from './decennials';

export const DIRECTION_PAGE_SETTINGS = definePageSettings('horosa.direction.settings.v1', {
	nodeRetrograde: { def: false },
	minorVariant: { def: 'synodic', oneOf: ['synodic', 'sidereal', 'engine'] },
	yearBand: { label: '行星年龄·行星年四档', def: 'least', oneOf: ['least', 'mean', 'greater', 'greatest'] },
	triplicityDivision: { label: '三分主星·划分法', def: 'thirds', oneOf: Object.keys(TRIPLICITY_DIVISIONS) },
	triplicityLifespan: { label: '三分主星·寿命基准（岁）', def: TRIPLICITY_LIFESPAN_DEFAULT, type: 'number', min: 30, max: 120 },   // 控件不限整数(75.5 在本次运行里照常生效),这里也不限 —— 否则带小数的值悄悄存不进去
	ephemerisTransits: { label: '星历·行运触发本命', def: true },
	givenYearInverse: { label: '流年法·双盘内外圈(开 = 天象盘在内盘;关 = 原命盘在内盘)', def: false },
	lunarReturnInverse: { label: '月亮返照·双盘内外圈(开 = 返照盘在内盘;关 = 原命盘在内盘)', def: true },
	solarReturnInverse: { label: '太阳返照·双盘内外圈(开 = 返照盘在内盘;关 = 原命盘在内盘)', def: true },
	persianRateKey: { label: '波斯向运·向运速率', def: 'persian', oneOf: ['persian', 'prophected', 'naibod', 'periodic'] },
	persianYear: { label: '波斯向运·年长', def: 'solar', oneOf: ['solar', 'sidereal', 'hellenistic', 'bija', 'bijaClassic'] },
	persianDirection: { label: '波斯向运·向运方向', def: 'direct', oneOf: ['direct', 'converse'] },
	persianMaxYears: { label: '波斯向运·应期年数', def: 90, oneOf: [50, 90, 120, 150, 200] },
	profGrain: { def: 'y', oneOf: PROFECTION_GRAIN_OPTIONS.map((o)=>o.value) },
	profStart: { def: 'asc', oneOf: PROFECTION_START_OPTIONS.map((o)=>o.value) },
	balbillusStartPlanet: { label: 'Balbillus·起始星', def: BALBILLUS_DEFAULT_OPTS.startPlanet, oneOf: Object.keys(BALBILLUS_YEARS) },
	balbillusYearType: { label: 'Balbillus·年制', def: BALBILLUS_DEFAULT_OPTS.yearType, oneOf: Object.keys(BALBILLUS_YEAR_TYPES) },
	balbillusMode: { label: 'Balbillus·距离口径', def: BALBILLUS_DEFAULT_OPTS.mode, oneOf: Object.keys(BALBILLUS_MODES) },
	balbillusSubRule: { label: 'Balbillus·子限铺法', def: BALBILLUS_DEFAULT_OPTS.subRule, oneOf: Object.keys(BALBILLUS_SUB_RULES) },
	ys129StartPlanet: { label: '129 年系统·起始星', def: YS129_DEFAULT_OPTS.startPlanet, oneOf: YS129_START_OPTIONS },
	ys129Order: { label: '129 年系统·次序', def: YS129_DEFAULT_OPTS.order, oneOf: Object.keys(YS129_ORDERS) },
	ys129YearType: { label: '129 年系统·年制', def: YS129_DEFAULT_OPTS.yearType, oneOf: Object.keys(YS129_YEAR_TYPES) },
	ys129SubRule: { label: '129 年系统·子限铺法', def: YS129_DEFAULT_OPTS.subRule, oneOf: Object.keys(YS129_SUB_RULES) },
	distReleaser: { label: '界推运·发放点', def: DIST_DEFAULTS.distReleaser, oneOf: DIST_RELEASERS.map((o)=>o.value) },
	distMethod: { label: '界推运·时间算法', def: DIST_DEFAULTS.distMethod, oneOf: DIST_METHODS.map((o)=>o.value) },
	distYear: { label: '界推运·年长', def: DIST_DEFAULTS.distYear, oneOf: DIST_YEARS.map((o)=>o.value) },
	distYears: { label: '界推运·年限（年）', def: DIST_DEFAULTS.distYears, oneOf: DIST_SPANS },
	apMethod: { label: '年龄推进点·推进方式', def: AP_DEFAULTS.apMethod, oneOf: AP_METHODS.map((o)=>o.value) },
	apEvents: { label: '年龄推进点·事件', def: AP_DEFAULTS.apEvents, oneOf: AP_EVENTS.map((o)=>o.value) },
	apYear: { label: '年龄推进点·年长', def: AP_DEFAULTS.apYear, oneOf: AP_YEARS.map((o)=>o.value) },
	apMaxAge: { label: '年龄推进点·年限（岁）', def: AP_DEFAULTS.apMaxAge, oneOf: AP_SPANS },
	keypointsMode: { label: '数字相位·释放点', def: KEYPOINTS_DEFAULT_OPTS.mode, oneOf: Object.keys(RELEASE_MODES) },
	decennialStartMode: { label: '十年大运·起运主星', def: DECENNIAL_START_MODE_SECT_LIGHT, oneOf: [DECENNIAL_START_MODE_SECT_LIGHT].concat(DECENNIAL_TRADITIONAL_PLANETS) },
	decennialOrderType: { label: '十年大运·分配次序', def: DECENNIAL_ORDER_ZODIACAL, oneOf: [DECENNIAL_ORDER_ZODIACAL, DECENNIAL_ORDER_CHALDEAN] },
	decennialDayMethod: { label: '十年大运·日限体系', def: DECENNIAL_DAY_METHOD_VALENS, oneOf: [DECENNIAL_DAY_METHOD_VALENS, DECENNIAL_DAY_METHOD_HEPHAISTIO] },
	decennialCalendarType: { label: '十年大运·时间口径', def: DECENNIAL_CALENDAR_TRADITIONAL, oneOf: [DECENNIAL_CALENDAR_TRADITIONAL, DECENNIAL_CALENDAR_ACTUAL] },
	nerK: { label: '演进推运·弧常数', def: NEROMAN_DEFAULTS.k, type: 'number', min: 1, max: 5000 },
	nerT0: { label: '演进推运·出生前年数', def: NEROMAN_DEFAULTS.t0, type: 'number', min: 0.01, max: 10 },
	nerKeepDec: { label: '演进推运·换到赤道(开 = 保留本命赤纬;关 = 按黄经度数)', def: NEROMAN_DEFAULTS.keepDec },
	nerOrb: { label: '演进推运·相位容许度（度）', def: NEROMAN_DEFAULTS.orb, oneOf: [0.5, 1, 2, 3] },
	bezzaOrb: { label: '推运图·接触窗（当前弧 ± 度）', def: BEZZA_DEFAULTS.orb, oneOf: [0.5, 1, 2, 3, 5] },
	jayFrom: { label: '周日小限·起始年龄(−1 = 当前所在的十二年一轮)', def: JAY_DEFAULTS.from, oneOf: [-1, 0, 12, 24, 36, 48, 60, 72, 84, 96, 108, 120] },
	michonOrb: { label: '双黄道·容许度（度）', def: MICHON_DEFAULTS.orb, oneOf: [0.5, 1, 1.5, 2] },
	michonSwap: { label: '双黄道·水金互换守护', def: MICHON_DEFAULTS.swap },
	michonEqual: { label: '双黄道·等宫(上升居第一宫正中)', def: MICHON_DEFAULTS.equal },
	michonAll: { label: '双黄道·互动表显示全部 66 组', def: false },   // 只改右栏互动表显示哪些行,不进请求
	tlMethod: { label: '时主轮转·方法', def: TIMELORD_DEFAULTS.method, oneOf: TIMELORD_METHODS.map((m)=>m.value) },
	tlYearType: { label: '时主轮转·年长', def: TIMELORD_DEFAULTS.yearType, oneOf: TIMELORD_OPTIONS.yearType.map((m)=>m.value) },
	tlMovingYear: { label: '时主轮转·匀速点年长', def: TIMELORD_DEFAULTS.movingYear, oneOf: TIMELORD_OPTIONS.yearType.map((m)=>m.value) },
	tlTurnStart: { label: '时主轮转·轮主起始星', def: TIMELORD_DEFAULTS.turnStart, oneOf: TIMELORD_OPTIONS.turnStart.map((m)=>m.value) },
	tlTurnOrder: { label: '时主轮转·轮主次序', def: TIMELORD_DEFAULTS.turnOrder, oneOf: TIMELORD_OPTIONS.turnOrder.map((m)=>m.value) },
	tlOrbMode: { label: '时主轮转·轨主走法', def: TIMELORD_DEFAULTS.orbMode, oneOf: TIMELORD_OPTIONS.orbMode.map((m)=>m.value) },
	tlAnnualDays: { label: '时主轮转·年度分配天数表', def: TIMELORD_DEFAULTS.annualDays, oneOf: TIMELORD_OPTIONS.annualDays.map((m)=>m.value) },
	tlAnnualOrder: { label: '时主轮转·年度分配次序', def: TIMELORD_DEFAULTS.annualOrder, oneOf: TIMELORD_OPTIONS.annualOrder.map((m)=>m.value) },
	tlReleaser: { label: '时主轮转·月相四分释放星', def: TIMELORD_DEFAULTS.releaser, oneOf: TIMELORD_OPTIONS.releaser.map((m)=>m.value) },
	tlVariant: { label: '时主轮转·算法(改进 / 经典)', def: TIMELORD_DEFAULTS.variant, oneOf: TIMELORD_OPTIONS.variant.map((m)=>m.value) },
	tlNineTime: { label: '时主轮转·九分主时间', def: TIMELORD_DEFAULTS.nineTime, oneOf: TIMELORD_OPTIONS.nineTime.map((m)=>m.value) },
	tlNineReverse: { label: '时主轮转·九分主子主反转', def: TIMELORD_DEFAULTS.nineReverse },
	tlRateKind: { label: '时主轮转·匀速点速率', def: TIMELORD_DEFAULTS.rateKind, oneOf: TIMELORD_OPTIONS.rateKind.map((m)=>m.value) },
	tlMovingStart: { label: '时主轮转·匀速点起点', def: TIMELORD_DEFAULTS.movingStart, oneOf: TIMELORD_OPTIONS.movingStart.map((m)=>m.value) },
	tlDevBasis: { label: '时主轮转·发展年龄分段', def: TIMELORD_DEFAULTS.devBasis, oneOf: TIMELORD_OPTIONS.devBasis.map((m)=>m.value) },
	tlDiurnalMode: { label: '时主轮转·周日象限速率', def: TIMELORD_DEFAULTS.diurnalMode, oneOf: TIMELORD_OPTIONS.diurnalMode.map((m)=>m.value) },
});
