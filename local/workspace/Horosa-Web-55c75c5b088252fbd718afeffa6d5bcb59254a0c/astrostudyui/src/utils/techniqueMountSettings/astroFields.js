// 星类技法的挂载字段组(占星 / 印占 / 主限法 / 七政 / 量化盘 / 推运族 / 宿占等)
// 从 techniqueMountSettings.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import * as AstroConst from '../../constants/AstroConst';
import { SU28_MODE_GROUPS, LIFE_MODE_OPTIONS as GUOLAO_LIFE_MODE_OPTIONS, LIFE_CUSTOM_ZHI_OPTIONS as GUOLAO_LIFE_CUSTOM_ZHI_OPTIONS, SU28_MODE_LABEL, TUIBIAN_METHOD_OPTIONS as GUOLAO_TUIBIAN_METHOD_OPTIONS, GUFA_PRECESS_OPTIONS as GUOLAO_GUFA_PRECESS_OPTIONS, EQ_TROPICAL_ANCHOR_OPTIONS as GUOLAO_EQ_TROPICAL_ANCHOR_OPTIONS, TONGXIAN_BASE_OPTIONS as GUOLAO_TONGXIAN_BASE_OPTIONS, TRUE_SOLAR_TIME_OPTIONS as GUOLAO_TRUE_SOLAR_TIME_OPTIONS } from '../../components/guolao/guolaoData';
import { classicalGlobalValue } from '../classicalChartGlobals';
import { EGYPT_SCHOOL_AXES, EGYPT_SCHOOL_DEFAULT, currentEgyptSchool } from '../../divination/data/egyptianSchools';
import { CHART_DETAIL_DEFAULTS, CHART_DETAIL_OPTIONS, CHART_DETAIL_TABLES } from '../chartDetails';
import { loadTongshuSettings } from '../../components/calendar/tongshuStore';
import { DEFAULT_PD_METHOD, DEFAULT_PD_TIME_KEY, SUPPORTED_PD_PROJECTIONS, PD_PROJECTION_LABELS, SUPPORTED_PD_FRAMES, PD_FRAME_LABELS, PD_SIGNIFICATOR_OPTIONS, PD_PROMISSOR_TYPE_OPTIONS, PD_EXTRA_SETTING_SPECS, pdGeometryApplies } from '../primaryDirectionSync';
import { presetForSchool as uranianPresetForSchool } from '../../components/germany/UranianSchools';   // 量化盘换派套预设(与页面 changeSchool 同表)
// 推运 builder 的官方选项常量 + 默认 opts（三分主星 / Balbillus / 关键点）——纯 util，无循环，直接复用。
import { TRIPLICITY_DEFAULT_OPTS, TRIPLICITY_SYSTEMS, TRIPLICITY_DIVISIONS } from '../triplicityRulers';
import { NEROMAN_DEFAULTS, NEROMAN_EQUATOR_OPTIONS, BEZZA_DEFAULTS, JAY_DEFAULTS, MICHON_DEFAULTS } from '../directedFigures';
import { TIMELORD_DEFAULTS, timeLordFieldShown, TIMELORD_METHODS, TIMELORD_OPTIONS } from '../timeLordTables';
import * as AstroText from '../../constants/AstroText';
import { BALBILLUS_DEFAULT_OPTS, BALBILLUS_YEAR_TYPES, BALBILLUS_MODES, BALBILLUS_SUB_RULES } from '../balbillus';
import { DIST_DEFAULTS, DIST_RELEASERS, DIST_METHODS, DIST_YEARS, DIST_SPANS } from '../distributionsOptions';
import { AP_DEFAULTS, AP_METHODS, AP_EVENTS, AP_YEARS, AP_SPANS } from '../agePointOptions';
import { YS129_DEFAULT_OPTS, YS129_START_OPTIONS, yearSystem129StartLabel, YS129_ORDERS, YS129_YEAR_TYPES, YS129_SUB_RULES } from '../yearSystem129';
import { KEYPOINTS_DEFAULT_OPTS, RELEASE_MODES } from '../keypoints120';
// 批3 推运 builder 导出的官方选项常量（黄道星释 / 十年大运 / 行星弧 / 波斯向运）。
// 这些定义在 components/astro/* 组件文件内，但只导出「纯常量」(不含组件 init 依赖)，且这些文件不 import aiAnalysisContext
// （ZR import AstroChart/ZodiacalRelease，Decennials import AstroChart/decennials，均不回环 aiAnalysisContext），故安全。
import { ZR_BASE_POINTS, ZR_AI_MODES } from '../../components/astro/AstroZR';
import { DECENNIALS_START_MODES, DECENNIALS_ORDER_TYPES, DECENNIALS_DAY_METHODS, DECENNIALS_CALENDAR_TYPES, DECENNIALS_AI_MODES } from '../../components/astro/AstroDecennials';
import { ARC_SOURCES } from '../../components/astro/AstroPlanetaryArc';
import { directionAsporbOptions } from '../../constants/directionAspOrb';
import { RATE_LABEL as PERSIAN_RATE_LABEL, PERSIAN_YEAR_LABEL } from '../../components/astro/AstroPersianDirected';
import { PROFECTION_GRAIN_OPTIONS, PROFECTION_START_OPTIONS } from '../profectionSummary';
import { HSYS_OPTIONS, ZODIACAL_OPTIONS, ON_OFF, recordIsNorthern, storedPageSetting, PD_METHOD_OPTIONS, PD_TIME_KEY_OPTIONS, scanRangeDatetimeFields, scanRangeDateFields } from './fieldAtoms';

// 命盘星盘系（占星本命/十三分盘/宿占等跟随 fields）：把更多排盘选项从 record 读出。
// 默认全部 === buildFieldObject 现状（hsys 1=Alcabitius / zodiacal 0 / 各择宫开关 0 / doubingSu28 0 / timeAlg 0）。
// 界系(bounds/terms)：0 埃及(默认,与现状一致)/1 托勒密·校勘本(Tetrabiblos 批判本)/2 托勒密·经典传本(1647 印本)。
// 三套表后端 flatlib 内已有；变体标签 2026-07-23 正名(数字键与表内容零改动,勿动存档契约)。
const BOUNDS_SYSTEM_OPTIONS = [
	{ value: 0, label: '埃及界（默认）' },
	{ value: 1, label: '托勒密界·校勘本' },
	{ value: 2, label: '托勒密界·经典传本' },
	{ value: 3, label: '迦勒底界' },
	{ value: 4, label: '自定义' },
];

// 占星(希腊化)G12/G13/G20-P2 挂载可配项选项。
const WEST_NODE_OPTIONS_M = [
	{ value: 'mean', label: '平交点（默认）' },
	{ value: 'true', label: '真交点' },
];

const SECT_BUFFER_OPTIONS_M = [
	{ value: 'geo', label: '几何地平（默认）' },
	{ value: 'ptolemy5', label: 'Ptolemy 5°' },
	{ value: 'apparent', label: '视地平（含折射）' },   // WP-2 第三档:spec/抽屉/后端三方早有,齿轮漏档=回显异常且不能逐盘钉
];

const TRIPLICITY_OPTIONS_M = [
	{ value: 'Dorothean', label: '多罗特三主（默认）' },
	{ value: 'Ptolemaic', label: '托勒密二主' },
	{ value: 'PtolemaicWaterVariant', label: '水象变体' },
];

export const ASTRO_CHART_FIELDS = [
	// 🔴 default 锚对:此前写 0(整宫制),而全站真实默认=DefaultHouseSystem=1(Alcabitus,
	// models/astro.js:25;存盘 record 恒带 1)——「默认即现状」在此键上被违反,整宫制成为不可表达值
	// (用户实锤)。有盘场景由 prune baseline(盘现状锚)治;此 default 只剩无盘场景(模板)语义,
	// 锚 1=真实默认 → 模板选整宫制(0≠1)可表达、选 Alcabitus(=1)=不覆盖(应用到盘时随盘现状)。
	{ name: 'hsys', label: '宫制', type: 'select', options: HSYS_OPTIONS, default: 1, group: '排盘' },
	{ name: 'zodiacal', label: '黄道', type: 'select', options: ZODIACAL_OPTIONS, default: 0, group: '排盘' },
	// 恒星黄道时的具体 ayanāṃśa（与命盘页同一套 47 制，复用印占 INDIA_AYANAMSA_OPTIONS——西洋 siderealAyanamsa 键即此）。
	// 默认 ''=随盘/后端默认(Lahiri)；prune-empty → 不覆盖存盘 ayanāṃśa（守「默认即现状」）。仅「黄道=恒星」时后端生效。
	{ name: 'siderealAyanamsa', label: '岁差制（黄道=恒星时生效）', type: 'select', options: [{ value: '', label: '默认（随盘 / Lahiri）' }, ...AstroConst.INDIA_AYANAMSA_OPTIONS, { value: 'user', label: '自定义（历元槽位）' }], default: '', blankFollowsBaseline: true, group: '排盘', showWhen: (d)=>Number(d.zodiacal) === 1 },   /* 只在黄道=恒星时生效(页面同条件出现) */   // user 档:抽屉/左栏/后端三方早有,齿轮漏档
	// 该记录键在后端 perchart.parseSu28Mode 是「宿度制 0..8 档」(七政齿轮 su28Mode 同键同义),此前误作
	// 「斗柄开关」ON/OFF:拨 ON=档 1(斗柄定房法)/OFF=档 0(荀爽距星),用户以为在开关斗柄,实际在换宿度制。改 select、
	// 值域/标签与七政 SU28_MODE_GROUPS 单源;缺省 0=占星页现状(astro 新盘 doubingSu28=0)。
	{ name: 'doubingSu28', label: '宿法', type: 'select', default: 0, group: '排盘',
		options: SU28_MODE_GROUPS.reduce((acc, g)=>acc.concat(g.options.map((o)=>({ value: o.value, label: `${g.header}·${o.label}` }))), []) },
	// 星盘 `tradition` 齿轮撤下:该键实义是「传统模式(不计三王星)」而非「传统择宫(界/外观)」,且后端 perchart 写死
	// False、全仓无人从请求读(Q-145 裁决②:不让后端读取)→ 齿轮拨了请求体有差分但盘面/快照恒不变=死开关(与量化盘同键撤法一致)。
	// 界系（bounds）：选哪套界主表（埃及/托勒密/莉莉），影响星体「界」尊贵与界主。默认埃及=现状，prune 丢弃零回归。
	// 补 globalCurrent:此前缺失 → 改过全局界系的用户,A 类 baseline 退化裸 schema
	// 默认(0),挂载与页面(种子=全局值)分叉——与 aiAnalysisContext buildFieldObject 病史同病。
	{ name: 'termsVariant', label: '界系（界主 · 尊贵 · 互容接纳）', type: 'select', options: BOUNDS_SYSTEM_OPTIONS, default: 0, globalCurrent: ()=>classicalGlobalValue('termsVariant'), group: '择宫' },
	// 占星(希腊化)G12/G13/G15/G20-P2:月交点真平 / 区分缓冲 / 狮子土星优先 / 三分集 / 福点反转。
	// 默认=现状零回归(平/几何/关/Dorothean/反转ON),prune 丢弃默认值 → 不调任何项与现状逐字一致;
	// 调整后经 buildFieldObject→fieldsToParams→/chart 复算,AI 快照尊贵/界主/福点与所选口径一致。
	{ name: 'westNodeType', label: '月交点（真 / 平 · 全盘随动）', type: 'select', options: WEST_NODE_OPTIONS_M, default: 'mean', globalCurrent: ()=>classicalGlobalValue('westNodeType'), group: '择宫' },
	{ name: 'sectBuffer', label: '区分判定（昼 / 夜 · sect）', type: 'select', options: SECT_BUFFER_OPTIONS_M, default: 'geo', globalCurrent: ()=>classicalGlobalValue('sectBuffer'), group: '择宫' },
	{ name: 'sunriseMode', label: '日出 / 日没口径', type: 'select', options: [{ value: 'center', label: '日心 · 不计折射（现行）' }, { value: 'apparent', label: '日面上缘 · 含大气折射（历书）' }], default: 'center', globalCurrent: ()=>classicalGlobalValue('sunriseMode'), group: '择宫' },
	{ name: 'leoBoundFirst', label: '托勒密界 · 狮子土星优先', type: 'switch', options: ON_OFF, default: 0, globalCurrent: ()=>classicalGlobalValue('leoBoundFirst'), group: '择宫', showWhen: (d)=>Number(d.termsVariant) === 1 },   /* 仅校勘本界系生效(与古典口径表 enabledWhen 同) */
	{ name: 'triplicity', label: '三分制（triplicity 主星体系）', type: 'select', options: TRIPLICITY_OPTIONS_M, default: 'Dorothean', globalCurrent: ()=>classicalGlobalValue('triplicity'), group: '择宫' },
	{ name: 'lotReversal', label: '福点按昼夜反转（关则恒昼式）', type: 'switch', options: ON_OFF, default: 1, globalCurrent: ()=>classicalGlobalValue('lotReversal'), group: '择宫' },
	// 点公式文档序反转(0/1):链早已全通(buildFieldObject+fieldParams 条件透传),只差齿轮项。
	// 三开关升正仓(classicalChartGlobals)后补 globalCurrent——改过全局的用户
	// baseline 才不退化成裸 schema 默认(挂载与页面分叉病史,aiAnalysisContext:508 注释)。
	{ name: 'lotsDocReverse', label: '四点文档序公式（婚·子·友·疾）', type: 'switch', options: ON_OFF, default: 0, globalCurrent: ()=>classicalGlobalValue('lotsDocReverse'), group: '择宫' },
	{ name: 'nodeExaltation', label: '交点入旺（北交旺双子 · 南交旺射手）', type: 'switch', options: ON_OFF, default: 0, globalCurrent: ()=>classicalGlobalValue('nodeExaltation'), group: '择宫' },
	// 双子界序(仅托勒密经典传本 termsVariant=2 生效;1647 印本两皆有据):曾是死透传(fieldParams 读、字段不存在)。
	// 补 globalCurrent(同 termsVariant)。
	{ name: 'geminiBoundEmended', label: '双子界序（1647 印本两皆有据）', type: 'select', default: 0, globalCurrent: ()=>classicalGlobalValue('geminiBoundEmended'), group: '择宫',
		showWhen: (d)=>Number(d.termsVariant) === 2,
		options: [
			{ value: 0, label: '忠原书（♄21–25/♂25–30）' },
			{ value: 1, label: '校勘对调（♂21–25/♄25–30）' },
		] },
	// ── 古典口径 10 键(与「设置→星盘设置」同一后端真值仓 classicalChartGlobals;镜像其面板选项):
	// 默认=后端硬编码现状,prune 剪掉零回归;非默认经 classicalBackendOverridesFromFields 单源下发。──
	{ name: 'houseCuspAdvance', label: '行星落宫 · 宫头前移（整宫制豁免）', type: 'select', default: 5, globalCurrent: ()=>classicalGlobalValue('houseCuspAdvance'), group: '古典口径', options: [
		{ value: 5, label: '5°（传统·默认）' }, { value: 3, label: '3°' }, { value: 1, label: '1°' }, { value: 0, label: '0°（纯宫界）' },
	] },
	{ name: 'cazimiOrb', label: '日心 cazimi', type: 'select', default: 17 / 60, globalCurrent: ()=>classicalGlobalValue('cazimiOrb'), group: '古典口径', options: [
		{ value: 17 / 60, label: '17′（1647·默认）' }, { value: 16 / 60, label: '16′（中世纪）' }, { value: 1, label: '1°（早期）' },
	] },
	{ name: 'combustOrb', label: '燃烧上界', type: 'select', default: 8.5, globalCurrent: ()=>classicalGlobalValue('combustOrb'), group: '古典口径', options: [
		{ value: 8.5, label: '8°30′（1647·默认）' }, { value: 8, label: '8°（中世纪）' }, { value: 15, label: '15°（希腊化）' },
	] },
	{ name: 'underBeamsOrb', label: '日光束外界（偕日相束级恒逐星弧）', type: 'select', default: 17, globalCurrent: ()=>classicalGlobalValue('underBeamsOrb'), group: '古典口径', options: [
		{ value: 17, label: '17°（1647·默认）' }, { value: 15, label: '15°（较古）' },
	] },
	{ name: 'vocMode', label: '空亡口径（全盘月亮空亡判定随之改）', type: 'select', default: 'classic', globalCurrent: ()=>classicalGlobalValue('vocMode'), group: '古典口径', options: [
		{ value: 'classic', label: '无入相即空（1647 · 现行）' }, { value: 'by_orb', label: '容许度 12°30′' },   // 档名与星盘页同
		{ value: 'by_sign_perfect', label: '本座内须完成（现代）' }, { value: 'by_sign_orb', label: '本座内入容许度（16c）' },
		{ value: 'kenodromia', label: '30° 法（希腊化）' }, { value: 'exempt4', label: '无入相＋四座豁免（中世纪）' },
	] },
	{ name: 'vocIncludeOuter', label: '空亡计三王星', type: 'switch', options: ON_OFF, default: 0, globalCurrent: ()=>classicalGlobalValue('vocIncludeOuter'), group: '古典口径',
		// 与页面 classicalParamSpec enabledWhen 同判据:1647 口径与「四座豁免」档都按 1647 基判,不计三王星
		showWhen: (d)=>d.vocMode !== undefined && d.vocMode !== 'classic' && d.vocMode !== 'exempt4' },
	{ name: 'fixedStarOrbMode', label: '恒星轨档（汇合恒星 · 恒星触发）', type: 'select', default: 'school', globalCurrent: ()=>classicalGlobalValue('fixedStarOrbMode'), group: '古典口径', options: [
		{ value: 'school', label: '按流派平轨（默认）' }, { value: 'byMagnitude', label: '按星等' },
	] },
	{ name: 'fixedStarOrb', label: '恒星平轨值', type: 'select', default: 1, globalCurrent: ()=>classicalGlobalValue('fixedStarOrb'), group: '古典口径', options: [1, 1.5, 2, 3, 5].map((v)=>({ value: v, label: `${v}°` })) },
	{ name: 'antisciaOrb', label: '映点接触容许度', type: 'select', default: 1, globalCurrent: ()=>classicalGlobalValue('antisciaOrb'), group: '古典口径', options: [0.5, 1, 1.5, 2, 3].map((v)=>({ value: v, label: `${v}°` })) },
	{ name: 'viaCombustaVariant', label: '燃烧之路边界（月亮凶区 · 全站随动）', type: 'select', default: 'standard', globalCurrent: ()=>classicalGlobalValue('viaCombustaVariant'), group: '古典口径', options: [
		{ value: 'standard', label: '天秤15°–天蝎15°（传统·默认）' }, { value: 'narrow', label: '窄口径（天秤28°–天蝎7°）' },
		{ value: 'scorpioFull', label: '天秤后15°＋天蝎全宫' }, { value: 'bothFull', label: '天秤＋天蝎全段' },
	] },
	// ── 天文口径批(默认=后端现状零回归;eclipseTimeMode 走星历页独立构参不进本齿轮) ──
	{ name: 'combustOwnChariotExempt', label: '界内三分内免燃烧（own chariot · Porphyry）', type: 'switch', options: ON_OFF, default: 0, globalCurrent: ()=>classicalGlobalValue('combustOwnChariotExempt'), group: '古典口径' },
	{ name: 'westLilithType', label: '黑月莉莉丝（真 / 平远地点）', type: 'select', default: 'mean', globalCurrent: ()=>classicalGlobalValue('westLilithType'), group: '古典口径', options: [
		{ value: 'mean', label: '平均远地点（默认）' }, { value: 'true', label: '真实远地点' },
	] },
	{ name: 'topocentricMoon', label: '月亮站心视差修正（福点随动）', type: 'switch', options: ON_OFF, default: 0, globalCurrent: ()=>classicalGlobalValue('topocentricMoon'), group: '古典口径' },
	{ name: 'stationMarking', label: '留驻判定（盘面 S·D 标）', type: 'select', default: 'off', globalCurrent: ()=>classicalGlobalValue('stationMarking'), group: '古典口径', options: [
		{ value: 'off', label: '关（仅逆行 R 标）' }, { value: 'exactWindow', label: '距留点 ≤1 日' },
		{ value: 'distance', label: '距留点黄经 ≤2′' }, { value: 'absSpeed', label: '日速 <1′（绝对阈；三王星恒近留）' }, { value: 'relSpeed', label: '日速 <3% 均速（相对阈）' },
	] },
	// ── 希腊点变体批 ──
	{ name: 'hermeticLotsReversal', label: '六星点按昼夜反转（福点另设）', type: 'switch', options: ON_OFF, default: 1, globalCurrent: ()=>classicalGlobalValue('hermeticLotsReversal'), group: '古典口径' },
	{ name: 'erosConstruction', label: '爱欲 · 必然构成', type: 'select', default: 'paulus', globalCurrent: ()=>classicalGlobalValue('erosConstruction'), group: '古典口径', options: [
		{ value: 'paulus', label: 'Paulus 式（金星·水星系）' }, { value: 'valens', label: 'Valens 式（福点·精神系）' },
	] },
	{ name: 'lotFortuneVariant', label: '福点公式变体', type: 'select', default: 'standard', globalCurrent: ()=>classicalGlobalValue('lotFortuneVariant'), group: '古典口径', options: [
		{ value: 'standard', label: '标准昼夜式（默认）' }, { value: 'moonAboveNight', label: '月在地平上恒夜式' },
	] },
	{ name: 'lotFatherCombustAlt', label: '父点土星伏时替代式（Dorotheus 系）', type: 'switch', options: ON_OFF, default: 0, globalCurrent: ()=>classicalGlobalValue('lotFatherCombustAlt'), group: '古典口径' },
	{ name: 'lotProjection', label: '点度计数法', type: 'select', default: 'portion', globalCurrent: ()=>classicalGlobalValue('lotProjection'), group: '古典口径', options: [
		{ value: 'portion', label: '度数投射（默认）' }, { value: 'sign', label: '整星座' },
	] },
	// ── 尊贵与判定批(后端三键;纯全局判读键不进齿轮) ──
	{ name: 'dignityDebilities', label: '弱陷计负分（陷 −5 · 落 −4）', type: 'switch', options: ON_OFF, default: 1, globalCurrent: ()=>classicalGlobalValue('dignityDebilities'), group: '古典口径' },
	{ name: 'almutenTripMode', label: 'Almuten 三分计分', type: 'select', default: 'all', globalCurrent: ()=>classicalGlobalValue('almutenTripMode'), group: '古典口径', options: [
		{ value: 'all', label: '三主全计（默认）' }, { value: 'sectRulerOnly', label: '仅当值主' },
	] },
	{ name: 'planetaryHourMethod', label: '行星时制式', type: 'select', default: 'sunrise', globalCurrent: ()=>classicalGlobalValue('planetaryHourMethod'), group: '古典口径', options: [
		{ value: 'sunrise', label: '日出起算 · 等长时' }, { value: 'unequal', label: '昼夜不等时（传统）' }, { value: 'equal24', label: '廿四时等分' },
	] },
	// ── 容许度体系批 ──
	{ name: 'orbSystem', label: '容许度判据体系', type: 'select', default: 'perObject', globalCurrent: ()=>classicalGlobalValue('orbSystem'), group: '古典口径', options: [
		{ value: 'perObject', label: '星体轨 · 任一覆盖（现行）' }, { value: 'byAspect', label: '按相位名（合冲刑拱 8° · 六合 4°）' },
		{ value: 'wholeSign', label: '整星座位相' }, { value: 'wholeSignMoiety', label: '整星座内 · 两轨半距和' },
	] },
	{ name: 'luminaryOrbBonus', label: '发光体轨加成', type: 'select', default: 0, globalCurrent: ()=>classicalGlobalValue('luminaryOrbBonus'), group: '古典口径', options: [
		{ value: 0, label: '0%（默认）' }, { value: 10, label: '10%' }, { value: 20, label: '20%' }, { value: 30, label: '30%' },
	] },
	{ name: 'aspectIncludeCusps', label: '宫头参与相位（≤3°）', type: 'switch', options: ON_OFF, default: 0, globalCurrent: ()=>classicalGlobalValue('aspectIncludeCusps'), group: '古典口径' },
	{ name: 'aspectIncludeLots', label: '希腊点参与相位（点为受体 · ≤3°）', type: 'switch', options: ON_OFF, default: 0, globalCurrent: ()=>classicalGlobalValue('aspectIncludeLots'), group: '古典口径' },
	{ name: 'aspectIncludeMidpoints', label: '中点参与相位（日月四轴 · 硬相 ≤1.5°）', type: 'switch', options: ON_OFF, default: 0, globalCurrent: ()=>classicalGlobalValue('aspectIncludeMidpoints'), group: '古典口径' },
	{ name: 'solarReturnVariant', label: '太阳返照法', type: 'select', default: 'precise', globalCurrent: ()=>classicalGlobalValue('solarReturnVariant'), group: '古典口径', options: [
		{ value: 'precise', label: '精确回归（现代）' }, { value: 'hellenistic', label: '希腊式（月定上升）' },
	] },
	{ name: 'returnLatitudeMode', label: '返照落宫投影', type: 'select', default: 'ecliptic', globalCurrent: ()=>classicalGlobalValue('returnLatitudeMode'), group: '古典口径', options: [
		{ value: 'ecliptic', label: '黄道度（常规）' }, { value: 'withLatitude', label: '计入黄纬（Umar al-Tabari 法）' },
	] },
	{ name: 'vulcanCalc', label: '祝融星（推算行星）', type: 'select', default: 'off', globalCurrent: ()=>classicalGlobalValue('vulcanCalc'), group: '古典口径', options: [
		{ value: 'off', label: '关（默认）' }, { value: 'weston', label: '轨道根数法' }, { value: 'baker', label: '水星系推算' },
	] },
	// 强互容 / 简化相位 / 虚点接纳相位:页面已撤这三个控件 —— 只在存档里已开着时列出(照样生效、可关),没开过不列
	{ name: 'strongRecption', label: '强互容', type: 'switch', options: ON_OFF, default: 0, group: '择宫', showWhen: (d)=>Number(d.strongRecption) === 1 },
	{ name: 'simpleAsp', label: '简化相位', type: 'switch', options: ON_OFF, default: 0, group: '择宫', showWhen: (d)=>Number(d.simpleAsp) === 1 },
	{ name: 'virtualPointReceiveAsp', label: '虚点接纳相位', type: 'switch', options: ON_OFF, default: 0, group: '择宫', showWhen: (d)=>Number(d.virtualPointReceiveAsp) === 1 },
	// 标签勘误:算法不是「上下翻转」显示,而是全部黄经 +180° 后重算(星座与庙旺随之换),
	// 即量化盘 / 3D 页下拉所称「涵义星座」;且只在南纬出生时生效,北纬拨了无效。与那两处同名同义。
	{ name: 'southchart', label: '南半球星座读法：涵义星座（黄经整体转 180°，仅南纬生效）', type: 'switch', options: ON_OFF, default: 0, group: '排盘',
		// 北纬出生的盘拨了无效:抽屉置灰(标签照样说明「仅南纬生效」);已开着的照样显示
		disabledFor: (ctx)=>recordIsNorthern(ctx && ctx.record) && Number(ctx && ctx.draft && ctx.draft.southchart) !== 1,
		disabledHint: '本盘出生在北纬,此项不生效' },
	// timeAlg 已删:西洋 /chart 请求不含该键(models/astro fieldsToParams 与 AI fieldParams 皆不发,
	// germany 同因剔除时共用表漏删)→ 可选但无效的死设置,按铁律「不放无效选项」移除。
	// 八字/紫微/数算各自的 timeAlg 走 buildChartBaziParams/buildChartZiweiParams 真实消费,不受影响。
	// 容许度整体缩放(orbScale 0.5–2.5×,默认1):merge 进 record.orbScale → buildFieldObject/fieldParams 透传 /chart
	//（对齐 models/astro.js fieldsToParams:249）→ 改相位容许度。数字型 prune 天然可用,默认 1 → undefined 不下发=现状。
	{ name: 'orbScale', label: '整体缩放', type: 'number', default: 1, min: 0.5, max: 2.5, step: 0.1, group: '容许度' },
	// 逐星自定义容许度(orbs 对象):用「沿用本盘存盘 orbs」布尔开关(默认关=现状,后端用默认容许度);
	// 开 → buildFieldObject 读 record.orbs(存盘的逐星表)下发 /chart。布尔型 prune 安全,规避对象恒判非默认坑。
	{ name: 'useStoredOrbs', label: '沿用本盘自定义容许度', type: 'switch', options: ON_OFF, default: 0, group: '容许度' },
	// ── 埃及历七轴(随盘键 egypt_*):快照链 egyptSchoolFromFields 优先消费;
	// 默认档不下发(localcharts 只捕获非默认轴),挂载改此组=只改【埃及历】段口径 ──
	// globalCurrent=currentEgyptSchool 现值:builder(astroAiSnapshot:1717)缺
	// fields 键时回退的正是它——旧档/导入档无 egypt 键+全局改过,拨回默认档曾被剪空(全默认不可表达)。
	...EGYPT_SCHOOL_AXES.map((ax) => ({
		name: 'egypt_' + ax.key,
		label: '埃及·' + ax.label,
		type: 'select',
		default: EGYPT_SCHOOL_DEFAULT[ax.key],
		globalCurrent: () => (currentEgyptSchool() || {})[ax.key],
		group: '埃及历',
		options: ax.options.map((o) => ({ value: o.value, label: o.label })),
	})),
	// 盘面细节五项(细节页同名设置,选项表单源取细节页的 CHART_DETAIL_OPTIONS;缺省跟细节页本机保存值,改了只作用于这次挂载的「盘面细节」段)
	...[['detailFaces', '面的算法', 'faces'], ['detailVariant', '算法', 'variant'], ['detailLunar', '月亮日算法', 'lunar'], ['detailMundo', '世俗位置', 'mundo'], ['detailMidpoint', '中点坐标', 'midpoint']].map(([name, label, group])=>({
		name, label: `盘面细节·${label}`, type: 'select', default: CHART_DETAIL_DEFAULTS[group], group: '盘面细节', pageStoreBound: true,
		globalCurrent: ()=>storedPageSetting('horosa.astro.details.v1', name, CHART_DETAIL_OPTIONS[group].map((item)=>item.value)),
		options: CHART_DETAIL_OPTIONS[group].map((item)=>({ value: item.value, label: item.label })),
	})),
	// 按表取全表:点名的细节表另出与页面同列的全表(缺省空 = 只出摘要,与此前同)
	{ name: 'detailFullTables', label: '盘面细节·另出全表', type: 'multiselect', default: [], group: '盘面细节',
		options: CHART_DETAIL_TABLES.map((item)=>({ value: item.value, label: item.label })) },
];

// 印度占星：岁差制(indiaAyanamsa 47 制) + 分宫制(indiaHsys) + 交点(nodeType 平/真)。已接入挂载设置：
// buildFieldObject 读 record.indiaAyanamsa/indiaHsys/indiaNodeType → IndiaChart.fieldsToParams 重算。
// nodeType 影响罗睺/计都真实位置(平/真交点),故纳入挂载;timeAlg/doubingSu28/盘式(纯显示) 对印度盘数据 inert 故不列。
// Sthira 起座(座运 Sthira 固定大运起点):lagna 命宫(默认,BPHS 通行)/brahma(BPHS §10.5)。
// IndiaChart.fieldsToParams 读 fields.indiaSthiraStart→仅非默认 'lagna' 才下发 → 默认 prune 后丢弃,后端缺键即 lagna,
// 与现状字节一致;选 brahma 经 buildFieldObject→snapshot fieldsToParams 重算 Sthira 座运,AI 与盘面同口径。标签对齐 IndiaChartMain.renderSthiraStartToggle。
const INDIA_STHIRA_START_OPTIONS_M = [
	{ value: 'lagna', label: '命宫（默认）' },
	{ value: 'brahma', label: 'Brahma' },
];

// 大运起点 seed:内联镜像 IndiaChartMain.DASHA_SEED_OPTIONS(展平 21 值,断循环导入;techniqueMountSettings.test 断言 === 源防漂移)。
// IndiaChart.fieldsToParams 仅 seed!=='moon' 才下发 → 默认 moon prune 后丢弃零回归;选他星则 AI 大运快照与盘一致。
const INDIA_DASHA_SEED_OPTIONS_M = [
	{ value: 'moon', label: '月亮 Moon · 标准' }, { value: 'sun', label: '太阳 Sun' }, { value: 'mars', label: '火星 Mars' },
	{ value: 'mercury', label: '水星 Mercury' }, { value: 'jupiter', label: '木星 Jupiter' }, { value: 'venus', label: '金星 Venus' },
	{ value: 'saturn', label: '土星 Saturn' }, { value: 'rahu', label: '罗睺 Rahu' }, { value: 'ketu', label: '计都 Ketu' },
	{ value: 'asc', label: '上升 Lagna' }, { value: 'bhavaLagna', label: 'Bhava Lagna 命运上升' }, { value: 'horaLagna', label: 'Hora Lagna 时上升' },
	{ value: 'ghatikaLagna', label: 'Ghati Lagna 漏刻上升' }, { value: 'sreeLagna', label: 'Sree Lagna 吉祥上升' }, { value: 'gulika', label: 'Gulika 土曜子' },
	{ value: 'maandi', label: 'Maandi 摩底' }, { value: 'dhuma', label: 'Dhuma 烟' }, { value: 'vyatipata', label: 'Vyatipata' },
	{ value: 'parivesha', label: 'Parivesha 晕' }, { value: 'indrachapa', label: 'Indrachapa 虹' }, { value: 'upaketu', label: 'Upaketu' },
];

// 通书页保存的设置(合法流派才认,否则整份回缺省 —— 与页面载入同一函数)
export function tongshuPageSetting(name){
	try{ const v = loadTongshuSettings()[name]; return v === undefined || v === null || v === '' ? undefined : v; }catch(e){ return undefined; }
}

// 印占换流派:与页面 IndiaChartMain.changeSchool 同表 —— 宫制 / 岁差套该派预设,带主大运体系的派切主大运
export function indiaSchoolPresetDraft(school){
	const def = AstroConst.getIndiaSchoolDefaults(school) || {};
	const out = {};
	if(def.hsys !== undefined){ out.indiaHsys = def.hsys; }
	if(def.ayanamsa !== undefined){ out.indiaAyanamsa = def.ayanamsa; }
	if(def.dashaFocus && (AstroConst.INDIA_DASHA_SYSTEM_OPTIONS || []).some((o)=>o.value === def.dashaFocus)){ out.indiaDashaSystem = def.dashaFocus; }
	return out;
}

export const INDIA_CHART_FIELDS = [
	{ name: 'indiaAyanamsa', label: '岁差制', type: 'select', options: AstroConst.INDIA_AYANAMSA_OPTIONS, default: AstroConst.INDIA_AYANAMSA_DEFAULT, group: '排盘' },
	{ name: 'indiaHsys', label: '分宫制', type: 'select', options: AstroConst.INDIA_HOUSE_SYSTEM_OPTIONS, default: AstroConst.INDIA_HOUSE_SYSTEM_DEFAULT, group: '排盘' },
	{ name: 'indiaNodeType', label: '交点', type: 'select', options: AstroConst.INDIA_NODE_TYPE_OPTIONS, default: AstroConst.INDIA_NODE_TYPE_DEFAULT, group: '排盘' },
	{ name: 'indiaDashaSystem', label: '大运体系', type: 'select', options: AstroConst.INDIA_DASHA_SYSTEM_OPTIONS, default: AstroConst.INDIA_DASHA_SYSTEM_DEFAULT, group: '大运' },
	{ name: 'indiaSthiraStart', label: '起座', type: 'select', options: INDIA_STHIRA_START_OPTIONS_M, default: 'lagna', group: '大运' },
	// 大运起点 / 过运日期 / 年度盘年份:buildFieldObject 已读 record.india{DashaSeed,TransitDate,TajakaYear}、IndiaChart.fieldsToParams 已透传,
	// 仅 mount schema 此前没暴露 → 用户调不到。默认 moon/空/空 经 prune 丢弃(后端回退 moon/今日/当前年)= 现状零回归;调整则 AI 大运/行运/年度盘快照与盘一致。
	{ name: 'indiaDashaSeed', label: '起点', type: 'select', options: INDIA_DASHA_SEED_OPTIONS_M, default: 'moon', group: '大运' },
	{ name: 'indiaTransitDate', label: '过运日期（空=今日）', type: 'date', default: '', group: '行运/年度' },
	{ name: 'indiaTajakaYear', label: '年度盘年份（太阳回归；空=当前年）', type: 'number', default: '', group: '行运/年度' },
	// G5/G13:年长与年盘口径进挂载齿轮(默认值经 prune 丢弃 = 现状零回归;改则 AI 快照与盘一致)。
	{ name: 'indiaDashaYearLength', label: '年长', type: 'select', options: AstroConst.INDIA_DASHA_YEAR_OPTIONS, default: AstroConst.INDIA_DASHA_YEAR_DEFAULT, group: '大运' },
	{ name: 'indiaSchool', label: '流派', type: 'select', options: AstroConst.INDIA_SCHOOL_OPTIONS, default: AstroConst.INDIA_SCHOOL_DEFAULT, group: '排盘' },
	{ name: 'indiaKarakaScheme', label: 'Chara Kāraka', type: 'select', options: AstroConst.INDIA_KARAKA_SCHEME_OPTIONS, default: AstroConst.INDIA_KARAKA_SCHEME_DEFAULT, group: '起盘' },
	{ name: 'indiaYuddhaCriterion', label: '星曜战判据', type: 'select', options: AstroConst.INDIA_YUDDHA_CRITERION_OPTIONS, default: AstroConst.INDIA_YUDDHA_CRITERION_DEFAULT, group: '起盘' },
	// 分盘流派映射(indiaVargaVariant)不入齿轮(无 text 控件类型且 JSON 手输易错):
	// 记录值经 aiAnalysisContext record→fields 显式透传,挂载/快照仍随盘生效。
	{ name: 'indiaAnnualChartType', label: '年盘口径', type: 'select', options: AstroConst.INDIA_ANNUAL_CHART_TYPE_OPTIONS, default: AstroConst.INDIA_ANNUAL_CHART_TYPE_DEFAULT, group: '行运/年度' },
	// 挂载分盘(2026-07-05 审计补):buildIndiaSnapshotForFields 第二参本就吃 chartnum,挂载分支此前
	// 硬编码 D1 → 用户无法把 D9/D10 等分盘快照挂给 AI。默认 1=D1 现状零回归。
	// (页面另有 indiaSchool 软联动/lagnaRef/盘式/度数显示等纯前端渲染项:不达后端参数,不设死开关。)
	// 「分盘网格集」齿轮已撤:它只让后端多算 jyotishByVarga(前端零读者、响应多约 2.1 MB),对快照零效果;页面网格自有状态。
	// 年盘(Varsha)异地经纬:留空=本命地(现状)。indiaDashaVariants(21 键流派开关对象)不入齿轮
	// (与 indiaVargaVariant 同理由:对象型无控件、JSON 手输易错),记录值经 record→fields 已全链透传随盘生效。
	// 两者齐备才下发(IndiaChart.js 109-114),标签明示
	{ name: 'indiaVarshaLat', label: '年盘·纬度(空=本命;须与经度同填才生效)', type: 'text', default: '', group: '行运/年度' },
	{ name: 'indiaVarshaLon', label: '年盘·经度(空=本命;须与纬度同填才生效)', type: 'text', default: '', group: '行运/年度' },
	{ name: 'indiaChartnum', label: '挂载分盘（Varga）', type: 'select', default: 1, group: '排盘',
		options: AstroConst.INDIA_MOUNT_VARGA_OPTIONS.map((o)=>(o.value === 1 ? { value: 1, label: 'D1 命盘（默认）' } : o)) },
	// [Windows #80] 附加分盘:主盘之外再挂几张(如婚姻 D9 + 子女 D7),各出一份「宫头 + 星曜落宫」简表。
	// 整张分盘快照约 2.6 万字,附加张按简表出免得把挂载预算吃穿;缺省不选 = 不发请求、不加段 = 零回归。
	{ name: 'indiaExtraVargas', label: `附加分盘（简表，最多 ${AstroConst.INDIA_MOUNT_EXTRA_VARGA_MAX} 张）`,
		type: 'multiselect', default: [], group: '排盘', placeholder: '不选=只挂主盘',
		options: AstroConst.INDIA_MOUNT_VARGA_OPTIONS.filter((o)=>o.value !== 1),
		normalize: (v)=>AstroConst.normalizeIndiaExtraVargas(v) },	// 三旗盘/问事 Praśna:页面(IndiaChartMain)能起、无头 fieldsToParams 也读 indiaTripataki/indiaPrashna*,
	// 此前 buildFieldObject 不产这些键 → preset「Tripataki 宿距三旗」「问事 Praśna」对挂载恒死。缺省全关/空 = 现状零回归;
	// 值域与页面 castPrashna 同源(number 1..249、schools 缺省 ['kp']、cuspMode 缺省 asc_driven_placidus)。
	{ name: 'indiaTripataki', label: '三旗盘 Tri-patākī', type: 'switch', options: ON_OFF, default: 0, group: '三旗/问事',
		normalize: (v)=>((v === true || v === 1 || v === '1') ? 1 : 0) },
	{ name: 'indiaPrashnaTime', label: '问事起卦时刻（空=不起卦）', type: 'datetime', default: '', group: '三旗/问事', placeholder: 'YYYY/MM/DD HH:mm:ss' },
	{ name: 'indiaPrashnaNumber', label: '问数(1–249)', type: 'number', default: 1, min: 1, max: 249, group: '三旗/问事', showWhen: (d)=>!!d.indiaPrashnaTime },
	{ name: 'indiaPrashnaMatter', label: '事项', type: 'select', default: AstroConst.INDIA_PRASHNA_MATTER_DEFAULT, group: '三旗/问事',
		options: AstroConst.INDIA_PRASHNA_MATTER_OPTIONS, showWhen: (d)=>!!d.indiaPrashnaTime },
	{ name: 'indiaPrashnaSchools', label: '问事流派', type: 'multiselect', default: ['kp'], group: '三旗/问事',
		options: AstroConst.INDIA_PRASHNA_SCHOOL_OPTIONS, showWhen: (d)=>!!d.indiaPrashnaTime,
		// 清空 = KP(与页面同:全取消时自动补回 KP;后端空集也按 KP 起)
		normalize: (v)=>{ const arr = Array.isArray(v) ? v.slice() : (`${v == null ? '' : v}`.split(',').map((x)=>x.trim()).filter(Boolean)); return arr.length ? arr : ['kp']; } },
	{ name: 'indiaPrashnaCuspMode', label: '宫始定法', type: 'select', default: AstroConst.INDIA_PRASHNA_CUSP_MODE_DEFAULT, group: '三旗/问事',
		options: AstroConst.INDIA_PRASHNA_CUSP_MODE_OPTIONS, showWhen: (d)=>!!d.indiaPrashnaTime },
	{ name: 'indiaPrashnaPrimaryHouse', label: '主判宫头（1–12；空=按事项）', type: 'number', default: '', min: 1, max: 12, group: '三旗/问事', showWhen: (d)=>!!d.indiaPrashnaTime },
	// 穿界表三项(缺省跟印占行运页保存值;没开过印占页时无头复算按这里取)
	{ name: 'indiaTransitPlanet', label: '穿界表·星', type: 'select', default: 'all', group: '穿界表', pageStoreBound: true, globalCurrent: ()=>storedPageSetting('horosa.india.tables.settings.v1', 'transitPlanet', ['all', 'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']), options: [
		{ value: 'all', label: '七星' }, { value: 'Sun', label: '太阳' }, { value: 'Moon', label: '月亮' }, { value: 'Mercury', label: '水星' },
		{ value: 'Venus', label: '金星' }, { value: 'Mars', label: '火星' }, { value: 'Jupiter', label: '木星' }, { value: 'Saturn', label: '土星' },
	] },
	{ name: 'indiaTransitKind', label: '穿界表·事件', type: 'select', default: 'sign', group: '穿界表', pageStoreBound: true, globalCurrent: ()=>storedPageSetting('horosa.india.tables.settings.v1', 'transitKind', ['sign', 'nakshatra', 'pada', 'kakshya']), options: [
		{ value: 'sign', label: '入星座' }, { value: 'nakshatra', label: '入星宿' }, { value: 'pada', label: '入足' }, { value: 'kakshya', label: '入 Kakshya' },
	] },
	{ name: 'indiaTransitDays', label: '穿界表·范围', type: 'select', default: 90, group: '穿界表', pageStoreBound: true, globalCurrent: ()=>storedPageSetting('horosa.india.tables.settings.v1', 'transitDays', [30, 90, 180, 366]), options: [
		{ value: 30, label: '30 天' }, { value: 90, label: '90 天' }, { value: 180, label: '180 天' }, { value: 366, label: '一年' },
	] },
];

// 主限法·表格（primarydirect）：列未来 pdYears 年全部 direction 行。方位法 + 时间换算 + 顺逆 + 映点/界 + pdYears
// （全部 === buildFieldObject 现状；无 datetime——表格是「年限范围」不是「单一时刻」）。
// 主限法相位可选档(页面 ChartFormData「主限法需要的相位」同九档;recordFields 按同一组过滤)
export const PD_ASPECT_CHOICES = [0, 30, 45, 60, 90, 120, 135, 150, 180];

export const PRIMARY_DIRECT_TABLE_FIELDS = [
	// 🔴 pdMethod 是解耦前的单维快捷键(= 弧算法 × 盘面宫制 的命名组合);regen 链仍在消费故保留,
	// 但与下面 pdProjection/pdFrame 语义重叠 —— 后端 _pdResolveProjectionFrame 里显式两维优先,
	// 两处同时设置时 pdMethod 被静默忽略。label 点名这层关系,免得用户改了以为没生效。
	// 表格页已由下方两维(弧算法 × 盘面宫制)代替这个旧单维:只在存档里已是非缺省值时列出(照样生效)
	{ name: 'pdMethod', label: '方位法（旧单维·与下方两维同设时以两维为准）', type: 'select', options: PD_METHOD_OPTIONS, default: DEFAULT_PD_METHOD, group: '方位法',
		showWhen: (d)=>d.pdMethod !== undefined && d.pdMethod !== null && d.pdMethod !== '' && `${d.pdMethod}` !== `${DEFAULT_PD_METHOD}` },
	{ name: 'pdTimeKey', label: '度数Key', type: 'select', options: PD_TIME_KEY_OPTIONS, default: DEFAULT_PD_TIME_KEY, group: '方位法' },
	{ name: 'pdtype', label: '方向', type: 'select', default: 0, group: '方位法', options: [   // 标签与主限法页工具条同
		{ value: 0, label: 'In Zodiaco（默认）' },
		{ value: 1, label: 'In Mundo' },
		{ value: 4, label: 'Field Plane' },
	] },
	// 页面工具条的「顺 / 逆」:写 Direct / Converse,不写 zodiacal(那是主限法 In Zodiaco 的另一个概念)
	{ name: 'pdDirect', label: '顺向（Direct）', type: 'switch', options: ON_OFF, default: 1, group: '方向' },
	{ name: 'pdConverse', label: '逆向（Converse）', type: 'switch', options: ON_OFF, default: 1, group: '方向' },
	{ name: 'pdAntiscia', label: '映点', type: 'switch', options: ON_OFF, default: 0, group: '方向' },
	{ name: 'pdTerms', label: '界', type: 'switch', options: ON_OFF, default: 0, group: '方向' },
	// 推算年数:默认 100(对齐 AstroPrimaryDirection.normalizePdYears 兜底),范围 1–3000(>360 走多圈复发行)。
	// merge 进 record.pdYears → buildFieldObject/fieldParams 透传 /chart → Java 转发 → Python max_arc,
	// 改它真实改变方向列表覆盖的年限(round-trip 通)。>180 走 forward/complement 互补弧扩展。
	{ name: 'pdYears', label: '年数', type: 'number', default: 100, min: 1, max: 3000, group: '范围' },
	// P0 解耦补齐维(默认=引擎缺省,与 primaryDirectionSync SUPPORTED_* 同源;非默认才下发,零回归):
	// 弧算法与盘面宫制的档位改由 primaryDirectionSync 的白名单 + 标签表机械派生:
	// 手抄清单此前少了 Along Ecliptic / Edmund Jones / Horosa原方法 / Placidus under-pole(弧算法 7→11)
	// 与 Equal(时圈)(宫制 11→12) —— 页面能选、挂载表达不了。派生后两端恒等,后续加档自动跟随。
	{ name: 'pdProjection', label: '弧算法（决定弧与应期日期）', type: 'select', default: 'ptolemy', group: '方位法',
		options: SUPPORTED_PD_PROJECTIONS.map((v)=>({ value: v, label: PD_PROJECTION_LABELS[v] || v })) },
	{ name: 'pdFrame', label: '盘面宫制（只改宫头,不改弧）', type: 'select', default: 'alcabitius', group: '方位法',
		options: SUPPORTED_PD_FRAMES.map((v)=>({ value: v, label: PD_FRAME_LABELS[v] || v })) },
	// 页面已撤「界行 · 分配星 / 释放」两档:只在存档已是它们时列出(当前值所在档恒保留)
	{ name: 'pdFramework', label: '框架', type: 'select', default: 'aspect', group: '方位法', options: [
		{ value: 'aspect', label: '相位主限' }, { value: 'bounds', label: '界行·分配星' }, { value: 'release', label: '释放（hyleg）' },
	], optionShown: (o)=>o.value === 'aspect' },
	{ name: 'pdParallel', label: '平行（黄道=赤纬/世界=世界平行）', type: 'switch', options: ON_OFF, default: 0, group: '方向' },
	{ name: 'pdRaptParallel', label: '急动', type: 'switch', options: ON_OFF, default: 0, group: '方向', showWhen: (d)=>Number(d.pdtype) === 1 },
	// 界系标签与 BOUNDS_SYSTEM_OPTIONS 单源:同一后端键两套标签曾致 value=2 语义相反
	// (此处旧标「莉莉界」,实为托勒密经典传本;且迦勒底 3 在主限法面板选不到)。
	// 缺键的旧盘按全局界系算(构造器 recordClassicalFallback),基线同锚 —— 否则抽屉显示「埃及界」实算托勒密,选埃及界还被剪掉
	{ name: 'termsVariant', label: '界系', type: 'select', default: 0, globalCurrent: ()=>classicalGlobalValue('termsVariant'), group: '方向', options: BOUNDS_SYSTEM_OPTIONS },
	// P2 长尾三键(与工具条「度数Key=自定义 / 扩展 Popover」同域;默认空=零回归):
	// 缺登记 = 用户在表格勾了扩展,AI 分析里重算却按默认无扩展,两侧口径不一致。
	{ name: 'pdTimeKeyCustom', label: '自定义钥匙率（度/年，仅 User 档）', type: 'number', default: 0, min: 0, max: 30, group: '范围', showWhen: (d)=>d.pdTimeKey === 'User' },
	// 选项与页面扩展面板同一份(primaryDirectionSync)
	{ name: 'pdSignificators', label: '应星扩展', type: 'multiselect', default: [], group: '扩展', options: PD_SIGNIFICATOR_OPTIONS },
	{ name: 'pdPromissorTypes', label: '迫星扩展', type: 'multiselect', default: [], group: '扩展', options: PD_PROMISSOR_TYPE_OPTIONS },
	// 主限法需要的相位(页面起盘表单同九档);缺省 = 托勒密五相(DEFAULT_PD_ASPECTS),与此前恒发的值逐字节相同
	{ name: 'pdaspects', label: '主限法需要的相位', type: 'multiselect', default: [0, 60, 90, 120, 180], group: '扩展',
		options: PD_ASPECT_CHOICES.map((v)=>({ value: v, label: `${v}°` })) },
	// 设置项登记表(相位侧 / 传统逆向 / 取点四项):与页面扩展面板同源生成,缺省不下发 = 零回归
	// 几何口径(inProjection)只在当前方向 / 弧算法 / 宫制 / 平行组合真有差别时列出(页面上它并在弧算法下拉里)
	...PD_EXTRA_SETTING_SPECS.map((spec)=>(spec.type === 'switch'
		? { name: spec.key, label: spec.label, type: 'switch', options: ON_OFF, default: spec.default, group: spec.group }
		: { name: spec.key, label: spec.label, type: 'select', default: spec.default, group: spec.group, options: spec.options,
			...(spec.inProjection ? { showWhen: (d)=>pdGeometryApplies(d || {}) } : {}) })),
];

// 主限法·盘（primarydirchart）：选一准确「时刻」→ 换算成主限年龄弧 → 出真盘快照。
// 盘面宫制 + 度数换算 + 时间(datetime,default '') + 向运方向；无 pdYears（盘是「单一时刻」不是「年限范围」）。
// 外圈 = 全天按主限弧在赤经上整体推进,与弧算法无关(弧算法只决定主限法表)→ 这里不设弧算法;宫头由盘面宫制定,
// 与主限法表同键 pdFrame(record 型:齿轮直接读写命盘记录的字段)。
// datetime default 恒 ''（空→builder 取此刻；不破 prune-empty 铁律）。
export const PRIMARY_DIRECT_CHART_FIELDS = [
	{ name: 'datetime', label: '时间选择(空=此刻)', type: 'datetime', default: '', group: '时间' },
	{ name: 'pdFrame', label: '盘面宫制（外圈宫头）', type: 'select', default: 'alcabitius', group: '方位法',
		options: SUPPORTED_PD_FRAMES.map((v)=>({ value: v, label: PD_FRAME_LABELS[v] || v })) },   // 与主限盘页同名
	{ name: 'pdTimeKey', label: '度数换算', type: 'select', options: PD_TIME_KEY_OPTIONS, default: DEFAULT_PD_TIME_KEY, group: '方位法' },
	// User 档自定义钥匙率(与主限法表格齿轮同键;缺省 0=不带,后端回落 1.0)
	{ name: 'pdTimeKeyCustom', label: '自定义钥匙率（度/年，仅 User 档）', type: 'number', default: 0, min: 0, max: 30, group: '方位法', showWhen: (d)=>d.pdTimeKey === 'User' },
	{ name: 'direction', label: '向运方向', type: 'select', default: 'direct', group: '方向', options: [
		{ value: 'direct', label: '顺向 Direct（随时间正推）' },
		{ value: 'converse', label: '逆向 Converse（反推）' },
	] },
];

// 七政四余（Moira）：命度模式 / 罗计模式 走全局 localStorage（buildGuolaoSnapshotForFields 经
// guolaoLifeModeFromFields/guolaoNodeModeFromFields 读 fields，缺省回退 getStoredGuolaoLifeMode/NodeMode）。
// C 类语义（2026-06 修正）：挂载覆盖只「临时」写这些全局 key 供 builder 重算自读，调用方
// （aiAnalysisContext）必须先 snapshotLocalStorageSettings 再在 finally restoreLocalStorageSettings——
// 否则一次挂载覆盖会永久改写用户的全局显示设置。想真正改默认走「设为同类默认」（saveMountTechniqueDefaults）。
const GUOLAO_DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

export const QUERENT_FIELDS = [
	// 问测人出生(没有存档行年时用):行年 / 本命支 / 属相 / 虚岁由它推出,起课法「本命加时 / 行年加时 / 九至十二客」等才有输入
	{ name: 'querentBirth', label: '问测人出生日期(空=不用)', type: 'date', default: '', group: '问测人' },
	{ name: 'querentGender', label: '问测人性别', type: 'select', default: 'male', group: '问测人', options: [{ value: 'male', label: '男' }, { value: 'female', label: '女' }], showWhen: (d)=>!!d.querentBirth },
];

export const GUOLAO_FIELDS = [
	{ name: 'lifeMode', label: '命度', type: 'select', default: 'asc', group: '命度', storageKey: 'horosaGuolaoLifeMode', recordKey: 'guolaoLifeMode', options: [
		...GUOLAO_LIFE_MODE_OPTIONS, ...GUOLAO_LIFE_CUSTOM_ZHI_OPTIONS,
	] },
	// techniqueFacetValues:技法本地设置面只收这两档 —— 自定身宫(某个地支)是给某一位命主手工指定的,页面首开不播(computeGuolaoSeedPatch),
	// 写进本机仓页面上不生效;挂载面照列全部档位
	{ name: 'bodyMode', label: '身宫法', type: 'select', default: 'taiyin', group: '命度', storageKey: 'horosaGuolaoBodyMode', recordKey: 'guolaoBodyMode',
		techniqueFacetValues: ['taiyin', 'youjin'], techniqueFacetValuesHint: '自定身宫(某个地支)只随盘、此处不收:请用户在七政页左栏选', options: [
		{ value: 'taiyin', label: '太阴落宫(果老,默认)' },
		{ value: 'youjin', label: '逢酉(琴堂)' },
		...GUOLAO_DIZHI.map((z)=>({ value: z, label: `自定身宫·${z}` })),
	] },
	{ name: 'nodeMode', label: '罗计', type: 'select', default: 'northKetuSouthRahu', group: '命度', storageKey: 'horosaGuolaoNodeMode', recordKey: 'guolaoNodeMode', options: [
		{ value: 'northKetuSouthRahu', label: '北计南罗(默认)' },
		{ value: 'northRahuSouthKetu', label: '北罗南计' },
	] },
	// recordMissingIsDefault:记录在、缺这一键 = 内建默认(荀爽 0),不回落本机七政仓 —— 与页面载入(种子键复位到内建默认)同一口径
	// storageIsSeedMirror:本机仓只是新盘种子的镜像(页面与 AI 挂载都不读它),技法本地设置面写它不生效 —— 助手改设置标只读
	{ name: 'su28Mode', label: '宿度制', type: 'select', default: 0, group: '命度', storageKey: 'horosaGuolaoSu28Mode', storageIsSeedMirror: true, recordKey: 'doubingSu28', recordMissingIsDefault: true, options: [
		// 档名与七政页同一份(SU28_MODE_GROUPS);页面靠分组标题区分黄仪 / 赤仪,齿轮保持旧顺序
		...[0, 2, 3, 4, 6, 1, 5, 7, 8].map((v)=>({ value: v, label: SU28_MODE_LABEL[v] })),   // 档名照七政页那份常量:页面没写「默认」标记,齿轮也不加
	] },
	// 宿度制条件子选项(WP-D/赤道回归):仅特定宿度制下后端生效,showWhen 条件揭示(对齐 GuoLaoInput doubingSu28===4/6/7/8)。
	// GuoLaoChartMain.fieldsToParams:1888/1908-1915 读 fields.guolao{Ayanamsa,TuibianMethod,GufaPrecess,EqTropicalAnchor}(C 类 storageKey 回退 getStored)→ /chart 重排盘。默认即现状零回归。
	// localScopeHint:起盘时盘上没选岁差(空档)就回落本机仓(guolaoAyanamsaFromFields),不经首开补空 —— 已载入的盘同样跟着变
	{ name: 'guolaoAyanamsa', label: '恒星岁差（宿度制=恒星制）', type: 'select', default: '', group: '命度', recordKey: 'guolaoAyanamsa', storageKey: 'horosaGuolaoAyanamsa',
		localScopeHint: '宿度制为恒星制、盘上没选恒星岁差的盘(含已载入的命盘,与 AI 分析按记录复算)下次起盘即按此值;盘上选过岁差的不变(改当前盘请用户在七政页左栏选;AI 分析口径用 facet=mount)',
		localScopeHintForUser: '宿度制为恒星制、盘上没选恒星岁差的盘(包括已载入的命盘和 AI 分析按记录重算的盘),下次起盘就按这个值;盘上选过岁差的不变',
		showWhen: (d)=>Number(d.su28Mode) === 4,
		options: [{ value: '', label: '郑式(默认)' }, ...AstroConst.INDIA_AYANAMSA_OPTIONS] },
	{ name: 'guolaoTuibianMethod', label: '推变法（宿度制=授时历古法）', type: 'select', default: 'jiyuan', group: '命度', recordKey: 'guolaoTuibianMethod', storageKey: 'horosaGuolaoTuibianMethod',
		showWhen: (d)=>Number(d.su28Mode) === 6,
		options: GUOLAO_TUIBIAN_METHOD_OPTIONS },
	{ name: 'guolaoGufaPrecess', label: '古宿岁差（宿度制=授时历古法）', type: 'select', default: 0, group: '命度', recordKey: 'guolaoGufaPrecess', storageKey: 'horosaGuolaoGufaPrecess',
		showWhen: (d)=>Number(d.su28Mode) === 6,
		options: GUOLAO_GUFA_PRECESS_OPTIONS },
	{ name: 'guolaoEqTropicalAnchor', label: '回归锚点（宿度制=赤道回归）', type: 'select', default: 'dongzhi', group: '命度', recordKey: 'guolaoEqTropicalAnchor', storageKey: 'horosaGuolaoEqTropicalAnchor',
		showWhen: (d)=>Number(d.su28Mode) === 7 || Number(d.su28Mode) === 8,
		options: GUOLAO_EQ_TROPICAL_ANCHOR_OPTIONS },
	// 命主取法/行运法/童限基数:🔴 值逐字打印进快照正文且改 [大限] 段结构,但存储在 horosaGuolaoDisplay
	// JSON 罐(per-key storageKey 机制盖不住)→ 走 record 链(C 类分支已 mergeOptionsIntoRecord,
	// buildFieldObject 透传,GuoLaoChartMain 快照拼装侧 fields 优先);'' = 随全局显示偏好(现状零回归)。
	{ name: 'guolaoLifeMasterMode', label: '命主取法', type: 'select', default: '', group: '命度', recordKey: 'guolaoLifeMasterMode', options: [
		{ value: '', label: '随全局（默认）' }, { value: 'gong', label: '宫主' }, { value: 'du', label: '度主' }, { value: 'dudegrade', label: '贬宫主专度主' },
	] },
	// 空档 = 随七政页的行运法(页面空档本身就是古度限度法,但页面改成别的法后,空档跟着变):要钉死古度限度法用 'gudu'(快照构造器解码回空串)
	{ name: 'guolaoMinorLimitType', label: '行运法', type: 'select', default: '', group: '命度', recordKey: 'guolaoMinorLimitType', options: [
		{ value: '', label: '随全局（默认）' }, { value: 'gudu', label: '古度限度法' }, { value: 'minor', label: '小限' }, { value: 'month', label: '月限' },
		{ value: 'tong', label: '童限' }, { value: 'dongwei', label: '洞微大限' },
	] },
	{ name: 'guolaoTongxianBase', label: '童限基数(行运=童限时)', type: 'select', default: '', group: '命度', recordKey: 'guolaoTongxianBase',
		showWhen: (d)=>d.guolaoMinorLimitType === 'tong',
		options: [{ value: '', label: '随全局（默认）' }, ...GUOLAO_TONGXIAN_BASE_OPTIONS.map((o)=>({ value: o.value, label: o.label.replace(/\(默认\)$/, '') }))] },
	// 定童限(9 九年起 / 10 十年起)直接改 [大限] 段每限的起讫岁,快照逐字打印,
	// 但此前只能从全局 horosaGuolaoDisplay 罐取 → 齿轮盖不住:同一条记录换台机器/换全局设置,挂载正文就变。
	{ name: 'guolaoLimitChildBase', label: '定童限(大限首限起算)', type: 'select', default: '', group: '命度', recordKey: 'guolaoLimitChildBase',
		options: [{ value: '', label: '随全局（默认）' }, { value: 9, label: '九年起' }, { value: 10, label: '十年起' }] },
	// 流年时刻(七政页左栏「Moira流年」):流年环 / 流年流曜 / 行运随它算。页面上是随手选的输入、不落盘;挂载与外部智能体在这里指定,
	// 留空 = 此刻。没有存储键(不是本机偏好),只随这一次挂载 / 调用走 record 链
	{ name: 'guolaoTransitDate', label: '流年日期(空=今日)', type: 'date', default: '', group: '流年', recordKey: 'guolaoTransitDate' },
	{ name: 'guolaoTransitTime', label: '流年时刻(空=12:00)', type: 'time', default: '', group: '流年', recordKey: 'guolaoTransitTime', showWhen: (d)=>!!d.guolaoTransitDate },
	// 大限年界(公历元旦 / 立春 / 冬至)改 [大限] 段每限的起讫年,快照逐字打印;与定童限同住七政显示偏好罐(per-key 机制盖不住)→ 走记录链。
	// 档名照七政页左栏;空 = 随七政页的设置(无头重算以七政显示偏好为底)
	{ name: 'guolaoLimitYearBoundary', label: '大限年界', type: 'select', default: '', group: '命度', recordKey: 'guolaoLimitYearBoundary',
		options: [{ value: '', label: '随全局（默认）' }, { value: 'gregorian', label: '公历元旦(Moira默认)' }, { value: 'lichun', label: '立春起' }, { value: 'dongzhi', label: '冬至起' }] },
	// engineMode(horosa/kinastro 引擎切换)不入齿轮:挂载复算恒走 horosa 引擎 buildGuolaoSnapshotForFields,
	// 页面切 kinastro 引擎属页面级渲染源切换(挂载侧无 kinastro 七政快照复算路径),登了即死开关。
	{ name: 'trueSolarTime', label: '报时星', type: 'select', default: 'true', group: '四余/时间', storageKey: 'horosaGuolaoTrueSolarTime', recordKey: 'guolaoTrueSolarTime', options: [
		...GUOLAO_TRUE_SOLAR_TIME_OPTIONS,   // 档名照七政页那份常量(页面没写「默认」标记,齿轮也不加)
	] },
	// 罗计 / 月孛取法:主盘、流年盘与「天星择日」样式的择时盘同读盘上的值(盘上缺这一项才回落本机值),作用范围同缺省句
	{ name: 'nodeType', label: '罗计取法', type: 'select', default: 'mean', group: '四余/时间', storageKey: 'horosaGuolaoNodeType', recordKey: 'guolaoNodeType',
		options: [
		{ value: 'mean', label: '平交点(默认)' },
		{ value: 'true', label: '真交点' },
	] },
	{ name: 'lilithType', label: '月孛取法', type: 'select', default: 'mean', group: '四余/时间', storageKey: 'horosaGuolaoLilithType', recordKey: 'guolaoLilithType',
		options: [
		{ value: 'mean', label: '平远地点(默认)' },
		{ value: 'true', label: '真远地点' },
	] },
];

// 量化盘（汉堡）：经 buildGermanySnapshotForFields(buildFieldObject(record)) 真实重算——读 宫制/黄道/时间算法
// （fieldsToParams → /chart + /germany/midpoint，改它们改中点盘/90°盘/中点相位）。故暴露这 3 项（record 类，
// regen 分支已存在于 aiAnalysisContext case 'germany'）。TNP/中点/orb 是内部常量、不入快照，仍不暴露。
// 实测 germany fieldsToParams(AstroMidpoint.js:18) 给 /chart 下发 hsys/zodiacal(+tradition 等)、但**不发 timeAlg**
// → timeAlg 对中点盘 inert，故只暴露 hsys/zodiacal（守"不放无效选项"；原审计 D-❌6「读 timeAlg」有误）。
// filter 面的判据勘误:「fieldsToParams 真下发」不等于「快照里有载体」——
// 量化盘快照只截 [宫位宫头][行星] 两段 + 中点后端段(AstroMidpoint 的 pickAstroSections),
// 接纳段与相位段根本不在快照里 → tradition / 强互容 strongRecption / 简化相位 simpleAsp 三键
// 拨到任何值,挂载正文逐字节不变(齿轮差分网 12 次实测),挂上去就是三个空齿轮。故按「有载体才暴露」撤下。
// filter 面=真下发键 ∩ 快照有载体(hsys/zodiacal/siderealAyanamsa/虚点);
// 旧注「TNP/中点/orb 是内部常量」已过时:builder 亲读 getStoredUranianDisplay() 的
// school/orb/orbPersonal/strictFactors/showDeclination/frames/mpCoord → /germany/midpoint,故一并入齿轮
// (''=随全局显示设置,prune 剪掉零回归;非空经 case 'germany' 组 dispOverride 覆盖)。
// showDavison/showComposite 依赖 synastryPeople(合盘人名→fieldsAry 查档,内容型)不入齿轮,恒随全局。
// 量化盘流派预设 → 齿轮四键(值域与页面 changeSchool 同:容许度数值、六宫框 / 严格因子集 0/1)
export const GERMANY_SCHOOL_PRESET_KEYS = ['orb', 'orbPersonal', 'showHouseFrames', 'strictFactors'];

export function germanySchoolPresetDraft(school){
	const p = uranianPresetForSchool(school);
	return { orb: p.orbMidpoint, orbPersonal: p.orbPersonal, showHouseFrames: p.showHouseFrames ? 1 : 0, strictFactors: p.strictFactors ? 1 : 0 };
}

// 差值表开着(齿轮选「出」或全局显示仓开着)才显示目标年龄 / 太阳弧换算;盘基另在行运时刻给了时显示
const uranianDiffListOn = (d)=>!!d && (d.showDiffList === 1 || d.showDiffList === '1' || d.showDiffList === true);

export const GERMANY_FIELDS = [
	// 量化盘页叫「分宫制」(星盘页叫「宫制」),标签随各自的页
	...ASTRO_CHART_FIELDS.filter((f)=>['hsys', 'zodiacal', 'siderealAyanamsa', 'virtualPointReceiveAsp'].includes(f.name)).map((f)=>(f.name === 'hsys' ? { ...f, label: '分宫制' } : f)),
	{ name: 'school', label: '流派', type: 'select', default: '', group: '量化盘', options: [
		{ value: '', label: '随全局（默认）' },
		{ value: 'classic', label: '原始汉堡' }, { value: 'pure', label: '纯净派' },
		{ value: 'uranian', label: '美国对称' }, { value: 'cosmo', label: '宇宙生物学' },
	] },
	// 值域与量化盘页滑杆同(中点 0.5–3、个人点 0.5–6,步进 0.5)
	// 四项随流派预设(页面换派即套该派的值;齿轮换派同,见 germany schema onDraftChange):空 = 随流派 / 全局
	{ name: 'orb', label: '容许度(°;空=随流派 / 全局)', type: 'number', default: '', min: 0.5, max: 3, step: 0.5, group: '量化盘' },
	{ name: 'orbPersonal', label: '个人点容许度(°;空=随流派 / 全局)', type: 'number', default: '', min: 0.5, max: 6, step: 0.5, group: '量化盘' },
	{ name: 'strictFactors', label: '严格因子集', type: 'select', default: '', group: '量化盘', options: [
		{ value: '', label: '随流派 / 全局（默认）' }, { value: 1, label: '开(剔黑月/紫气)' }, { value: 0, label: '关' },
	] },
	{ name: 'showDeclination', label: '赤纬接触', type: 'select', default: '', group: '量化盘', options: [
		{ value: '', label: '随全局（默认）' }, { value: 1, label: '开' }, { value: 0, label: '关' },
	] },
	{ name: 'showHouseFrames', label: '六宫框', type: 'select', default: '', group: '量化盘', options: [
		{ value: '', label: '随流派 / 全局（默认）' }, { value: 1, label: '开' }, { value: 0, label: '关' },
	] },
	{ name: 'showEastPoint', label: '东点（六宫框关时才独立生效；开六宫框恒含东点）', type: 'select', default: '', group: '量化盘', options: [   /* AstroMidpoint frames = showHouseFrames!==false || showEastPoint */
		{ value: '', label: '随全局（默认）' }, { value: 1, label: '开' }, { value: 0, label: '关' },
	] },
	// 中点坐标(同行星中点页下拉):赤经 / 赤纬才让后端另算坐标中点,快照多出「中点坐标」段;黄经 = 不下发 = 现状
	{ name: 'mpCoord', label: '中点坐标', type: 'select', default: '', group: '量化盘', options: [
		{ value: '', label: '随全局（默认）' }, { value: 'lon', label: '黄经' }, { value: 'ra', label: '赤经' }, { value: 'decl', label: '赤纬' },
	] },
	// 不放容许度两项(整体缩放 / 沿用本盘容许度):量化盘的挂载正文只取各点黄经(中点 / 盘式 / 行星图 / 映点 / 宫位框
	// 都用量化盘自己的容许度),/germany/midpoint 回包与正文都不随星盘容许度变(倍率 2.5、逐星 30° 时回包逐字相同)
	// —— 放上来就是两个拨了没反应的开关。techniqueMountSettings.test.js 锁住「不得出现」。
	// 时间层:页面 90° 盘的行运环 / 差值表 / 太阳弧速率 / 盘基,此前只在显示偏好里、AI 改不到。空 = 随全局显示口径(逐字节同旧)
	{ name: 'transitAt', label: '行运时刻(空=不出行运接触段)', type: 'datetime', default: '', blankFollowsBaseline: true, group: '时间层' },
	{ name: 'showDiffList', label: '差值表(太阳弧到期)', type: 'select', default: '', group: '时间层', options: [
		{ value: '', label: '随全局(默认)' }, { value: 1, label: '出' }, { value: 0, label: '不出' },
	] },
	{ name: 'diffTargetAge', label: '差值表目标年龄(岁;空=随全局)', type: 'number', default: '', min: 0, max: 120, step: 1, group: '时间层', showWhen: uranianDiffListOn },
	{ name: 'saKey', label: '太阳弧换算', type: 'select', default: '', group: '时间层', showWhen: uranianDiffListOn, options: [
		{ value: '', label: '随全局(默认均日弧)' }, { value: 'naibod', label: '均日弧(0°59′08″/年)' }, { value: 'oneDeg', label: '1°/年' }, { value: 'cardan', label: '59′12″/年' },
	] },
	// 图形星历:给了区间才出 [图形星历] 段(页面「图形星历」页签同一取数;行运折叠线与本命参考线的交点日)
	{ name: 'ephemStart', label: '图形星历起(空=不出图形星历段)', type: 'date', default: '', blankFollowsBaseline: true, group: '时间层' },
	{ name: 'ephemEnd', label: '图形星历止(与起点相隔 ≤366 天)', type: 'date', default: '', blankFollowsBaseline: true, group: '时间层', showWhen: (d)=>!!(d && `${d.ephemStart || ''}`.trim()) },
	{ name: 'dialBase', label: '盘基', type: 'select', default: '', group: '时间层', showWhen: (d)=>uranianDiffListOn(d) || !!(d && `${d.transitAt || ''}`.trim()) || !!(d && `${d.ephemStart || ''}`.trim()), options: [
		{ value: '', label: '随全局(默认 90°)' }, { value: 90, label: '90°' }, { value: 45, label: '45°' }, { value: 22.5, label: '22.5°' }, { value: 11.25, label: '11.25°' },
	] },
];


// 推运·三分主星：区间光体三分主星分掌人生阶段。builder buildTriplicityRulersSnapshotText(chartObj,opts) 已收 opts。
export const TRIPLICITY_FIELDS = [
	// 页面初值=本盘 fields.triplicity(chartObj.params.triplicity)→ 流派预设镜像 → Dorothean;挂载此前缺省恒
	// Dorothean 且无 globalCurrent → 预设 Ptolemy 的用户同盘页面与挂载口径不同。锚同一序:record.triplicity(baselineRecordKey,
	// 只读别名不写回)→ 全局古典仓 triplicity → 内建默认;builder 侧 resolveOpts 同序回落 chartObj.params.triplicity。
	{ name: 'system', label: '三分体系', type: 'select', default: TRIPLICITY_DEFAULT_OPTS.system, group: '划分',
		baselineRecordKey: 'triplicity',
		globalCurrent: ()=>{ const v = classicalGlobalValue('triplicity'); return TRIPLICITY_SYSTEMS[v] ? v : undefined; },
		options: Object.keys(TRIPLICITY_SYSTEMS).map((k)=>({ value: k, label: TRIPLICITY_SYSTEMS[k] })) },
	{ name: 'division', label: '划分法', type: 'select', default: TRIPLICITY_DEFAULT_OPTS.division, group: '划分',
		options: Object.keys(TRIPLICITY_DIVISIONS).map((k)=>({ value: k, label: TRIPLICITY_DIVISIONS[k] })) },
	{ name: 'lifespan', label: '寿命基准（岁）', type: 'number', default: TRIPLICITY_DEFAULT_OPTS.lifespan, min: 30, max: 120, group: '划分' },
];

// 推运图族(utils/directedFigures + components/astro/AstroDirectedFigures):字段名 = 星运页保存键(directionPageSettings),
// 平铺进记录不撞名;重算缺键时回落星运页保存值(见 DIRECTION_PAGE_BOUND_FIELDS)。双黄道与目标时刻无关,不收目标日期。
const DF_BOOL = (v)=>(v === true || v === 1 || v === '1' || v === 'true');

const DIRECTED_TARGET_FIELDS = [
	{ name: 'targetDate', label: '目标日期(空=今日)', type: 'date', default: '', group: '目标' },
	{ name: 'targetTime', label: '时间(空=12:00:00)', type: 'time', default: '', group: '目标' },
];

export const NEROMAN_FIELDS = [
	...DIRECTED_TARGET_FIELDS,
	{ name: 'nerK', label: '弧常数', type: 'number', default: NEROMAN_DEFAULTS.k, min: 1, max: 5000, step: 1, group: '演进' },
	{ name: 'nerT0', label: '出生前年数', type: 'number', default: NEROMAN_DEFAULTS.t0, min: 0.01, max: 10, step: 0.05, group: '演进' },
	{ name: 'nerKeepDec', label: '换到赤道', type: 'select', default: NEROMAN_DEFAULTS.keepDec, group: '演进', normalize: DF_BOOL,
		options: NEROMAN_EQUATOR_OPTIONS.map((o)=>({ value: o.value, label: o.label })) },
	{ name: 'nerOrb', label: '相位容许度', type: 'select', default: NEROMAN_DEFAULTS.orb, group: '演进',
		options: [0.5, 1, 2, 3].map((v)=>({ value: v, label: `${v}°` })) },
];

export const BEZZA_FIELDS = [
	...DIRECTED_TARGET_FIELDS,
	{ name: 'bezzaOrb', label: '接触窗(当前弧 ±)', type: 'select', default: BEZZA_DEFAULTS.orb, group: '推运图',
		options: [0.5, 1, 2, 3, 5].map((v)=>({ value: v, label: `${v}°` })) },
];

export const JAY_FIELDS = [
	...DIRECTED_TARGET_FIELDS,
	{ name: 'jayFrom', label: '起始年龄', type: 'select', default: JAY_DEFAULTS.from, group: '周日小限',
		options: [{ value: -1, label: '当前所在的一轮' }].concat(Array.from({ length: 11 }, (_x, i)=>({ value: i * 12, label: `${i * 12} 岁起` }))) },
];

export const MICHON_FIELDS = [
	{ name: 'michonOrb', label: '容许度', type: 'select', default: MICHON_DEFAULTS.orb, group: '双黄道',
		options: [0.5, 1, 1.5, 2].map((v)=>({ value: v, label: `${v}°` })) },
	{ name: 'michonSwap', label: '守护', type: 'select', default: MICHON_DEFAULTS.swap, group: '双黄道', normalize: DF_BOOL,
		options: [{ value: false, label: '现代守护' }, { value: true, label: '水金互换' }] },
	{ name: 'michonEqual', label: '宫位', type: 'select', default: MICHON_DEFAULTS.equal, group: '双黄道', normalize: DF_BOOL,
		options: [{ value: false, label: '本盘宫制' }, { value: true, label: '等宫(上升居第一宫正中)' }] },
];

// 时主轮转:方法与各法选项,字段名 = 星运页保存键。留「随页面」时用页面保存值。
const TL_FIELD = (name, label, key, list)=>({ name, label, type: 'select', default: TIMELORD_DEFAULTS[key], group: '时主轮转',
	showWhen: (d)=>!d || !d.tlMethod || timeLordFieldShown(key, { method: d.tlMethod, devBasis: d.tlDevBasis }), options: list.map((o)=>({ value: o.value, label: o.label })) });

export const TIMELORD_FIELDS = [
	...DIRECTED_TARGET_FIELDS,
	TL_FIELD('tlMethod', '方法', 'method', TIMELORD_METHODS),
	TL_FIELD('tlYearType', '年长', 'yearType', TIMELORD_OPTIONS.yearType),
	TL_FIELD('tlMovingYear', '匀速点年长', 'movingYear', TIMELORD_OPTIONS.yearType),
	TL_FIELD('tlTurnStart', '轮主起始星', 'turnStart', TIMELORD_OPTIONS.turnStart),
	TL_FIELD('tlTurnOrder', '轮主次序', 'turnOrder', TIMELORD_OPTIONS.turnOrder),
	TL_FIELD('tlOrbMode', '轨主走法', 'orbMode', TIMELORD_OPTIONS.orbMode),
	TL_FIELD('tlAnnualDays', '年度分配天数表', 'annualDays', TIMELORD_OPTIONS.annualDays),
	TL_FIELD('tlAnnualOrder', '年度分配次序', 'annualOrder', TIMELORD_OPTIONS.annualOrder),
	TL_FIELD('tlReleaser', '月相四分释放星', 'releaser', TIMELORD_OPTIONS.releaser),
	TL_FIELD('tlVariant', '算法', 'variant', TIMELORD_OPTIONS.variant),
	TL_FIELD('tlNineTime', '九分主时间', 'nineTime', TIMELORD_OPTIONS.nineTime),
	{ ...TL_FIELD('tlNineReverse', '九分主子主', 'nineReverse', TIMELORD_OPTIONS.nineReverse), normalize: DF_BOOL },
	TL_FIELD('tlRateKind', '匀速点速率', 'rateKind', TIMELORD_OPTIONS.rateKind),
	TL_FIELD('tlMovingStart', '匀速点起点', 'movingStart', TIMELORD_OPTIONS.movingStart),
	TL_FIELD('tlDevBasis', '发展年龄分段', 'devBasis', TIMELORD_OPTIONS.devBasis),
	TL_FIELD('tlDiurnalMode', '周日象限速率', 'diurnalMode', TIMELORD_OPTIONS.diurnalMode),
];

// 推运·Balbillus：起始星 / 年制 / 距离口径。builder buildBalbillusSnapshotText(chartObj,opts) 已收 opts。
// 显示名与页面同(AstroText 中文名:日 / 月 / 水…)
const SEVEN_PLANETS_OPTS = [AstroConst.SUN, AstroConst.MOON, AstroConst.MERCURY, AstroConst.VENUS, AstroConst.MARS, AstroConst.JUPITER, AstroConst.SATURN]
	.map((p)=>({ value: p, label: AstroText.AstroTxtMsg[p] || p }));

export const BALBILLUS_FIELDS = [
	{ name: 'startPlanet', label: '起始星', type: 'select', default: BALBILLUS_DEFAULT_OPTS.startPlanet, group: '起运', options: SEVEN_PLANETS_OPTS },
	{ name: 'yearType', label: '年制', type: 'select', default: BALBILLUS_DEFAULT_OPTS.yearType, group: '起运',
		options: Object.keys(BALBILLUS_YEAR_TYPES).map((k)=>({ value: k, label: BALBILLUS_YEAR_TYPES[k].label })) },
	{ name: 'mode', label: '距离口径', type: 'select', default: BALBILLUS_DEFAULT_OPTS.mode, group: '起运',
		options: Object.keys(BALBILLUS_MODES).map((k)=>({ value: k, label: BALBILLUS_MODES[k] })) },
	{ name: 'subRule', label: '子限铺法', type: 'select', default: BALBILLUS_DEFAULT_OPTS.subRule, group: '起运',
		options: Object.keys(BALBILLUS_SUB_RULES).map((k)=>({ value: k, label: BALBILLUS_SUB_RULES[k] })) },
];

// 推运·界推运:发放点 / 时间算法 / 年长 / 年限(与页面同四项、同一请求键,builder 收 opts)。
export const DISTRIBUTIONS_FIELDS = [
	{ name: 'distReleaser', label: '发放点', type: 'select', default: DIST_DEFAULTS.distReleaser, group: '分配',
		options: DIST_RELEASERS.map((o)=>({ value: o.value, label: o.label })) },
	{ name: 'distMethod', label: '时间算法', type: 'select', default: DIST_DEFAULTS.distMethod, group: '分配',
		options: DIST_METHODS.map((o)=>({ value: o.value, label: o.label })) },
	{ name: 'distYear', label: '年长', type: 'select', default: DIST_DEFAULTS.distYear, group: '分配',
		options: DIST_YEARS.map((o)=>({ value: o.value, label: o.label })) },
	{ name: 'distYears', label: '年限', type: 'select', default: DIST_DEFAULTS.distYears, group: '分配',
		options: DIST_SPANS.map((n)=>({ value: n, label: `${n} 年` })) },
];

// 推运·年龄推进点:推进方式 / 事件 / 年长 / 年限(与页面同四项、同一请求键,builder 收 opts)。
export const AGEPOINT_FIELDS = [
	{ name: 'apMethod', label: '推进方式', type: 'select', default: AP_DEFAULTS.apMethod, group: '推进',
		options: AP_METHODS.map((o)=>({ value: o.value, label: o.label })) },
	{ name: 'apEvents', label: '事件', type: 'select', default: AP_DEFAULTS.apEvents, group: '推进',
		options: AP_EVENTS.map((o)=>({ value: o.value, label: o.label })) },
	{ name: 'apYear', label: '年长', type: 'select', default: AP_DEFAULTS.apYear, group: '推进',
		options: AP_YEARS.map((o)=>({ value: o.value, label: o.label })) },
	{ name: 'apMaxAge', label: '年限', type: 'select', default: AP_DEFAULTS.apMaxAge, group: '推进',
		options: AP_SPANS.map((n)=>({ value: n, label: `${n} 岁` })) },
];

// 推运·129 年系统:起始星 / 次序 / 年制 / 子限铺法(与页面同四项、同一引擎 utils/yearSystem129)。
// 键名带 ys129 前缀(= 页面保存键):起始星 / 年制 / 子限铺法与 Balbillus 同义不同值域,平铺进记录不许撞名。
export const YEARSYSTEM129_FIELDS = [
	{ name: 'ys129StartPlanet', label: '起始星', type: 'select', default: YS129_DEFAULT_OPTS.startPlanet, group: '起运',
		options: YS129_START_OPTIONS.map((p)=>({ value: p, label: yearSystem129StartLabel(p) })) },
	{ name: 'ys129Order', label: '次序', type: 'select', default: YS129_DEFAULT_OPTS.order, group: '起运',
		options: Object.keys(YS129_ORDERS).map((k)=>({ value: k, label: YS129_ORDERS[k] })) },
	{ name: 'ys129YearType', label: '年制', type: 'select', default: YS129_DEFAULT_OPTS.yearType, group: '起运',
		options: Object.keys(YS129_YEAR_TYPES).map((k)=>({ value: k, label: YS129_YEAR_TYPES[k].label })) },
	{ name: 'ys129SubRule', label: '子限铺法', type: 'select', default: YS129_DEFAULT_OPTS.subRule, group: '起运',
		options: Object.keys(YS129_SUB_RULES).map((k)=>({ value: k, label: YS129_SUB_RULES[k] })) },
];

// 推运·关键点（120 年）：释放点 命/身。builder buildKeypointsSnapshotText(chartObj,opts) 已收 opts。
export const KEYPOINTS_FIELDS = [
	{ name: 'mode', label: '释放点', type: 'select', default: KEYPOINTS_DEFAULT_OPTS.mode, group: '释放',
		options: Object.keys(RELEASE_MODES).map((k)=>({ value: k, label: RELEASE_MODES[k] })) },
];

// 推运·黄道星释（zodiacal releasing）：推运基点(11) + 输出层级(L1全/L2/L3/L4) + 逐层钻取 idx。
// builder buildZodialReleaseSnapshotText(chartObj,opts) 加 opts 透传 basePoint→startSign + aiMode/idx 进 buildZRAISnapshot。
// 默认 福点 + L1 全列 + idx0 === 无头 builder 现状（缺省经 prune 丢弃 → 字节级一致）。
// 神数正传各流派专属项只在该流派下出现(与页面按流派分组显示同)
export const zcSchoolIs = (school)=>(d)=>((d && d.zcSchool) || 'tieban') === school;

// 逐层钻取序号随输出层级出现(层级 = 所有 L1 时三个序号都不起作用;L2 在 L1 下 → 要 L1 序号;L3 在 L2 下 → L1/L2;L4 → 三个都要)
const AI_LEVEL_DEPTH = { l1_all: 0, l2_in_l1: 1, l3_in_l2: 2, l4_in_l3: 3 };

const aiLevelDepth = (d)=>AI_LEVEL_DEPTH[d && d.aiMode] || 0;

const AI_LEVEL_IDX_FIELDS = (l1Label)=>[
	{ name: 'aiL1Idx', label: l1Label, type: 'number', default: 0, min: 0, group: '输出', showWhen: (d)=>aiLevelDepth(d) >= 1 },
	{ name: 'aiL2Idx', label: '二级时段序号(第一段填 0)', type: 'number', default: 0, min: 0, group: '输出', showWhen: (d)=>aiLevelDepth(d) >= 2 },
	{ name: 'aiL3Idx', label: '三级时段序号(第一段填 0)', type: 'number', default: 0, min: 0, group: '输出', showWhen: (d)=>aiLevelDepth(d) >= 3 },
];

export const ZODIAL_RELEASE_FIELDS = [
	{ name: 'basePoint', label: '推运基点', type: 'select', default: ZR_BASE_POINTS[0], group: '基点',
		options: ZR_BASE_POINTS.map((p)=>({ value: p, label: AstroText.AstroTxtMsg[p] || p })) },   // 显示名与页面同(中文名,不露英文键)
	{ name: 'aiMode', label: '输出范围', type: 'select', default: (ZR_AI_MODES[0] || {}).value, group: '输出', options: ZR_AI_MODES },
	...AI_LEVEL_IDX_FIELDS('一级时段序号(第一段填 0;输出到二~四级时用来定位)'),
];

// 推运·十年大运（decennials）：起运主星 + 分配次序 + 日限体系 + 时间口径 + 输出层级 + 逐层钻取。
// builder buildDecennialsSnapshotText(chartObj,opts) 加 opts 透传 settings + aiState。默认全部 === 无头 builder 现状。
export const DECENNIALS_FIELDS = [
	{ name: 'startMode', label: '起运主星', type: 'select', default: (DECENNIALS_START_MODES[0] || {}).value, group: '起运', options: DECENNIALS_START_MODES },
	{ name: 'orderType', label: '分配次序', type: 'select', default: (DECENNIALS_ORDER_TYPES[0] || {}).value, group: '起运', options: DECENNIALS_ORDER_TYPES },
	{ name: 'dayMethod', label: '日限体系', type: 'select', default: (DECENNIALS_DAY_METHODS[0] || {}).value, group: '起运', options: DECENNIALS_DAY_METHODS },
	{ name: 'calendarType', label: '时间口径', type: 'select', default: (DECENNIALS_CALENDAR_TYPES[0] || {}).value, group: '起运', options: DECENNIALS_CALENDAR_TYPES },
	{ name: 'aiMode', label: '输出范围', type: 'select', default: (DECENNIALS_AI_MODES[0] || {}).value, group: '输出', options: DECENNIALS_AI_MODES },
	...AI_LEVEL_IDX_FIELDS('一级时段序号(第一段填 0)'),
];

// 推运·行星弧（planetary arc）：弧源(7 星) + 目标时刻 + 容许度。
// builder buildPlanetaryArcSnapshotText(chartObj,opts) 加 opts。默认 月亮/空(→today)/1 === 无头现状。
export const PLANETARY_ARC_FIELDS = [
	{ name: 'arcSource', label: '弧源天体（月亮弧 / 行星弧）', type: 'select', default: ARC_SOURCES[0], group: '弧源',
		options: ARC_SOURCES.map((p)=>({ value: p, label: AstroText.AstroTxtMsg[p] || p })) },
	// P4：目标时刻改 datetime picker（空显示「此刻/今日」但 default 恒 ''，不破 prune）。
	{ name: 'targetDatetime', label: '目标时刻(空=今日)', type: 'datetime', default: '', group: '弧源' },
	// 档位与页面同一份(弧类:不列「双星容许度相加除以2」,与 1° 同结果)
	{ name: 'asporb', label: '行运星与本命星交角容许度', type: 'select', default: 1, normalize: (v)=>Number(v), options: directionAsporbOptions(true), group: '弧源', globalCurrent: ()=>{ try{ return require('../../components/astro/AstroExtraCommon').transitOrbDefault(); }catch(e){ return 1; } } },   // 基线随全局 transitOrb
	// 南北交逆移:页面有、Python 也读,此前挂载表达不了(缺省关=无头现状零回归)。
	{ name: 'nodeRetrograde', label: '南北交逆移', type: 'switch', options: ON_OFF, default: 0, group: '弧源' },
	// P4 区间扫描：end 非空且 step 有值时，builder 循环多段（每段一个目标时刻）。
	...scanRangeDatetimeFields('区间扫描'),
];

// 推运·波斯向运（persian directed）：速率(波斯/Prophected/Naibod/周期律) + 方向(顺/逆) + 应期年数(50/90/120/150/200) + 年长。
// builder buildPersianDirectedSnapshotText(chartObj,opts) 加 opts。默认 persian/direct/90 === 无头现状。
export const PERSIAN_DIRECTED_FIELDS = [
	{ name: 'rateKey', label: '向运速率', type: 'select', default: 'persian', group: '向运',
		options: Object.keys(PERSIAN_RATE_LABEL).map((k)=>({ value: k, label: PERSIAN_RATE_LABEL[k] })) },
	{ name: 'direction', label: '向运方向', type: 'select', default: 'direct', group: '向运', options: [
		// 与波斯向运页同名(两处都写明盘面转向 + 黄经增减)
		{ value: 'direct', label: 'Direct（逆时针，黄经 +°/年）' },
		{ value: 'converse', label: 'Converse（顺时针，黄经 −°/年）' },
	] },
	// 应期年数：与组件右栏一致的 5 档；默认 90 → prune 丢弃 → builder/aiAnalysisContext 缺省 90 = 现状不变。
	// 数字型 select，prune 走字符串化比较（`90`===`90`）天然可用。
	{ name: 'maxYears', label: '应期年数', type: 'select', default: 90, group: '向运',
		options: [50, 90, 120, 150, 200].map((y)=>({ value: y, label: `${y} 年` })) },
	{ name: 'persianYear', label: '年长', type: 'select', default: 'solar', group: '向运',
		options: Object.keys(PERSIAN_YEAR_LABEL).map((k)=>({ value: k, label: PERSIAN_YEAR_LABEL[k] })) },
];

// 推运·恒星推运（vedic）/ 赤纬推运（jayne）：目标日期 + 时刻。
// builder buildVedicProgSnapshotText / buildJaynesProgSnapshotText 加 opts。默认 空(→today)/空(→12:00) === 无头现状。
export const PROG_TARGET_FIELDS = [
	// P4：目标日期/时刻改 date/time picker（空显示「今日/此刻」但 default 恒 ''，不破 prune）。
	{ name: 'targetDate', label: '目标日期(空=今日)', type: 'date', default: '', group: '目标' },
	{ name: 'targetTime', label: '时间(空=12:00:00)', type: 'time', default: '', group: '目标' },
	// 小推运月长(vedicprog/jaynesprog 共用):AstroVedic/JaynesProgressions:32 读 opts.minorVariant 进重算请求,改推运盘月长换算口径(引擎原值/朔望月/恒星月)。
	//   缺省 synodic(=组件 state 初值,起;engine=引擎历史值仅可选)prune 后丢弃;regen makeOpts 同补 minorVariant 透传。内联镜像 AstroProgChart.MINOR_VARIANT_OPTIONS(test 断言防漂移)。
	{ name: 'minorVariant', label: '月长算法', type: 'select', default: 'synodic', group: '目标', options: [
		{ value: 'synodic', label: '朔望月每年（标准·默认）' },
		{ value: 'sidereal', label: '恒星月每年' },
		{ value: 'engine', label: '引擎历史值（≈无推进）' },
	] },
	// P4 区间扫描：以 targetDate 为起点、datetimeEnd 为终点，按 step 循环多段（每段一个目标日期，时刻沿用 targetTime）。
	...scanRangeDateFields('区间扫描'),
];

// 目标时刻型 5 法（小限/太阳弧/太阳返照/月亮返照/流年）：共用 buildPredictivePeriodSnapshot(chartObj,key,opts)。
// 默认 datetime 空(→此刻) / tmType 'y' / asporb 1 / nodeRetrograde 0 === builder 现状。returns 另加 异地 dirLat/dirLon。
export const PREDICTIVE_PERIOD_BASE_FIELDS = [
	// P4：目标时刻改 datetime picker（空显示「此刻」但 default 恒 ''，不破 prune）。
	{ name: 'datetime', label: '目标时刻(空=此刻)', type: 'datetime', default: '', group: '目标' },
	// 「步进 tmType」已撤:页面/无头请求体恒送 'y',Java 不转发、Python 零消费,是全链死开关(不放无效选项)。
	// 档位与页面同一份;太阳弧走弧类口径(不列「双星容许度相加除以2」),见 solararc 条目
	{ name: 'asporb', label: '行运星与本命星交角容许度', type: 'select', default: 1, normalize: (v)=>Number(v), options: directionAsporbOptions(false), group: '目标', globalCurrent: ()=>{ try{ return require('../../components/astro/AstroExtraCommon').transitOrbDefault(); }catch(e){ return 1; } } },
	{ name: 'nodeRetrograde', label: '南北交逆移', type: 'switch', options: ON_OFF, default: 0, group: '目标' },
	// P4 区间扫描：datetime 为起点、datetimeEnd 为终点，按 scanStep 循环多段（每段一个推运时点）。
	// 注：scanStep（区间步进）与上方 tmType（推运内部步进）是两个独立概念，互不冲突。
	...scanRangeDatetimeFields('区间扫描'),
];

// 小限页 G9 年/月/日小限 + 多起点(纯前端派生)进齿轮:选项与页面控件同源
// (utils/profectionSummary),缺省 年/上升 = 页面缺省 = 快照现状字节不变外加一段 [小限摘要]。
export const PROFECTION_SUMMARY_FIELDS = [
	{ name: 'profGrain', label: '小限粒度', type: 'select', options: PROFECTION_GRAIN_OPTIONS, default: 'y', group: '小限摘要' },
	{ name: 'profStart', label: '小限起点', type: 'select', options: PROFECTION_START_OPTIONS, default: 'asc', group: '小限摘要' },
];

// returns 型(返照)异地经纬：默认空 → 回退本命经纬(=现状,与各 Return 组件 dirLat=natal 一致)。
export const PREDICTIVE_RETURN_DIR_FIELDS = [
	{ name: 'dirLat', label: '返照地·纬度(空=本命)', type: 'text', default: '', group: '异地' },
	{ name: 'dirLon', label: '返照地·经度(空=本命)', type: 'text', default: '', group: '异地' },
	// dirZone(返照地时区):buildPredictivePeriodSnapshot:1575 已消费(o.dirZone||np.zone)、regen:1833 已透传 record.dirZone,
	// 仅此前漏建 schema 字段 → record.dirZone 恒 undefined 回退本命时区。补齐后异地返照三盘(solarreturn/lunarreturn/givenyear)时区可调。
	{ name: 'dirZone', label: '返照地·时区(空=本命)', type: 'text', default: '', group: '异地' },
];

// 宿占不消费的西占古典判读键(读路径核对:SuZhanMain.js buildHouseSuLines/computeAscSignIndex 只读宫位/赤经/宿名/时支)。
// 宿占的岁差:宿法 = 郑氏恒星制(档 4)时,后端把空档解作郑氏历元(perchart isZhengSidereal:显式档优先,空 = 郑氏),
// 任何显式档都不是郑氏 —— 这时空档是唯一能表达郑氏的值,不能当「随盘」剪掉(剪掉 = 回不到郑氏);标签也随之写明
const SUZHAN_ZHENG_SU28_MODE = 4;

const suzhanZhengSu28 = (d)=>Number(d && d.doubingSu28) === SUZHAN_ZHENG_SU28_MODE;

export const SUZHAN_SIDEREAL_AYANAMSA_FIELD = (f)=>({
	...f,
	blankFollowsBaseline: (d)=>!suzhanZhengSu28(d),
	blankHint: '留空随宿法变:宿法为「黄仪（黄道）·恒星制」的盘上 = 郑氏历元(按郑氏口径),其余随盘',
	// 空档标签与生成时的实际取值一致。只记亲手键的宿主(显示草稿带 __unsetKeys,只读上下文)分得清「没存」与「存了空串」:
	//   没存 = 生成时不覆盖、按盘 —— 宿法郑氏时盘上没设岁差 = 郑氏历元;宿法也没存时随各盘宿法;
	//   存了空串 = 覆盖 —— 宿法郑氏 = 郑氏历元;宿法没存时盘上宿法为郑氏恒星制 = 郑氏历元、其余随盘(非郑氏剪掉)
	optionsFor: (d)=>{
		const unsetKeys = d && Array.isArray(d.__unsetKeys) ? d.__unsetKeys : null;
		const unset = (k)=>!!(unsetKeys && unsetKeys.indexOf(k) >= 0);
		const relabel = (label)=>f.options.map((o)=>(o.value === '' ? { value: '', label } : o));
		if(suzhanZhengSu28(d)){ return relabel(unset(f.name) ? '随盘（盘上没设岁差 = 郑氏历元）' : '郑氏历元（恒星制宿法默认）'); }
		if(unsetKeys && unset('doubingSu28')){
			// 宿法没存时选空档 = 删键(随盘):只有确实存了空串才是覆盖(按各盘宿法变)
			const storedBlank = !unset(f.name) && d[f.name] === '';
			return relabel(storedBlank ? '按宿法定(宿法为「黄仪(黄道)·恒星制」的盘 = 郑氏历元,其余随盘)' : '随盘（盘上没设岁差：宿法为「黄仪（黄道）·恒星制」= 郑氏历元，其余 = Lahiri）');
		}
		return f.options;
	},
});

export const SUZHAN_DEAD_CLASSICAL_KEYS = ['termsVariant', 'sectBuffer', 'leoBoundFirst', 'triplicity', 'lotReversal', 'lotsDocReverse', 'nodeExaltation',
	'geminiBoundEmended', 'cazimiOrb', 'combustOrb', 'underBeamsOrb', 'vocMode', 'vocIncludeOuter', 'fixedStarOrbMode', 'fixedStarOrb', 'antisciaOrb',
	'viaCombustaVariant', 'combustOwnChariotExempt', 'stationMarking', 'hermeticLotsReversal', 'erosConstruction', 'lotFortuneVariant', 'lotFatherCombustAlt',
	'lotProjection', 'dignityDebilities', 'almutenTripMode', 'planetaryHourMethod', 'sunriseMode', 'orbSystem', 'luminaryOrbBonus', 'aspectIncludeCusps', 'aspectIncludeLots',
	'aspectIncludeMidpoints', 'solarReturnVariant', 'returnLatitudeMode', 'vulcanCalc', 'strongRecption', 'simpleAsp', 'virtualPointReceiveAsp', 'orbScale', 'useStoredOrbs'];
