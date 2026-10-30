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
// 不收:各页的目标日期 / 目标年份 / 地点(输入);「行运星与本命星交角容许度」(初值归「星盘设置」的全局行运容许度管,
// 页内改动只覆盖本会话);三分主星的「三分体系」(初值随本盘排盘口径 / 流派预设)。
//
// 月长算法 / 年数档的候选值在这里写死而不 import 组件常量:那些常量住在重组件文件里,反向 import 会成环。
// 与组件常量的一致性由测试逐个比对(directionPageSettings.test.js)。
import { definePageSettings } from './pageSettingsStore';
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
	persianRateKey: { label: '波斯向运·向运速率', def: 'persian', oneOf: ['persian', 'prophected', 'naibod'] },
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
});
