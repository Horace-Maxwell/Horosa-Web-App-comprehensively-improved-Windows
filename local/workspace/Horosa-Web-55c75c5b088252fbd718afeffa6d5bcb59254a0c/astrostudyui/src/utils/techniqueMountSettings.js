// AI 挂载·每技法「设置」schema。集中定义「技法 → 可调项 → 默认值 → 如何套用重算」。
//
// 设计铁律（守「默认即现状」）：
//  - 每个 field 的 default 必须 === 该技法组件/builder 里的现状默认（DunJiaCalc DEFAULT_OPTIONS /
//    buildFieldObject aiAnalysisContext / TaiYiMain state.options 等）。不调任何项 → 永不进 merge 路径 → 输出逐字不变。
//  - merge* 函数返回副本，绝不改原 record/payload。
//  - applyLocalStorageSettings 仅在用户显式设置时写 key；未设置 → 不碰全局默认。
//
// kind 分类（A/B/C/D 类）：
//  - 'record'        → A 类：把 fields 写进重算用 record.*（buildFieldObject 读 record，强制 regenerate 生效）。
//  - 'payload'       → B 类：把 options 写进重算用 payload（事盘 regenerate 已读 payload.options / payload.<field>）。
//                      optionsPath:'options' = 写 payload.options.<name>；optionsPath:'' = 写 payload.<name>（顶层）。
//  - 'localStorage'  → C 类：把值写进全局 localStorage（builder 自读），如七政四余命度/罗计。
//  - 'sectionsOnly'  → D 类：不可重算（六爻/统摄/世俗盘=确定性已存结果），只暴露「纳入内容」勾选 + 只读说明。
//
// field 形状：{ name, label, type:'select|switch|number|text', options?, default, group?, storageKey?, normalize? }
//  - type:'switch' 的值用 0/1（与 buildFieldObject 既有写法一致）。

import { ZIWEI_RECORD_SETTINGS, recordHasZiweiSettingsGen } from './ziweiRecordSettings';
import * as AstroConst from '../constants/AstroConst';
import * as AstroText from '../constants/AstroText';
import { PROFECTION_GRAIN_OPTIONS, PROFECTION_START_OPTIONS } from './profectionSummary';
import {
	SU28_MODE_GROUPS, SU28_MODE_LABEL,
	LIFE_MODE_OPTIONS as GUOLAO_LIFE_MODE_OPTIONS, LIFE_CUSTOM_ZHI_OPTIONS as GUOLAO_LIFE_CUSTOM_ZHI_OPTIONS,
	TUIBIAN_METHOD_OPTIONS as GUOLAO_TUIBIAN_METHOD_OPTIONS, GUFA_PRECESS_OPTIONS as GUOLAO_GUFA_PRECESS_OPTIONS,
	EQ_TROPICAL_ANCHOR_OPTIONS as GUOLAO_EQ_TROPICAL_ANCHOR_OPTIONS, TONGXIAN_BASE_OPTIONS as GUOLAO_TONGXIAN_BASE_OPTIONS,
	TRUE_SOLAR_TIME_OPTIONS as GUOLAO_TRUE_SOLAR_TIME_OPTIONS,
} from '../components/guolao/guolaoData';
import { classicalGlobalValue } from './classicalChartGlobals';
import { storedBaziOptValue } from './baziStoredOpt';
import { recordHasCaptureMark, recordMissingValue, RECORD_FIELDS_RESTORE_MANIFEST, RECORD_MISSING_IDENTITY_KEYS } from './recordFieldsRestore';
import { GUOLAO_RECORD_FACTORY_DEFAULTS } from '../components/guolao/GuoLaoChartStyle';
import { newChartSeedRecordMissingValue } from './newChartSeeds';
import { ZWEngineOptions } from '../components/ziwei/ziweiOptions';
import { ZWSchool } from '../constants/ZWConst';
import { EGYPT_SCHOOL_AXES, EGYPT_SCHOOL_DEFAULT, currentEgyptSchool } from '../divination/data/egyptianSchools';
import { safeLocalStorageSet } from '../utils/safeStorage';
import {
	SUPPORTED_PD_METHODS,
	SUPPORTED_PD_TIME_KEYS,
	SUPPORTED_PD_PROJECTIONS,
	SUPPORTED_PD_FRAMES,
	PD_METHOD_LABELS,
	PD_TIME_KEY_LABELS,
	PD_PROJECTION_LABELS,
	PD_FRAME_LABELS,
	DEFAULT_PD_METHOD,
	DEFAULT_PD_TIME_KEY,
	PD_EXTRA_SETTING_SPECS,
	PD_SIGNIFICATOR_OPTIONS,
	PD_PROMISSOR_TYPE_OPTIONS,
	pdGeometryApplies,
} from './primaryDirectionSync';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from './dayBoundary';
import {
	SEX_OPTIONS as QIMEN_SEX_OPTIONS,
	CHART_CATEGORY_OPTIONS as QIMEN_CHART_CATEGORY_OPTIONS,
	PAIPAN_OPTIONS as QIMEN_PAIPAN_OPTIONS,
	ZHISHI_OPTIONS as QIMEN_ZHISHI_OPTIONS,
	YUEJIA_QIJU_OPTIONS as QIMEN_YUEJIA_QIJU_OPTIONS,
	QIJU_METHOD_OPTIONS as QIMEN_QIJU_METHOD_OPTIONS,
	SCHOOL_OPTIONS as QIMEN_SCHOOL_OPTIONS,
	KONG_MODE_OPTIONS as QIMEN_KONG_MODE_OPTIONS,
	MA_MODE_OPTIONS as QIMEN_MA_MODE_OPTIONS,
	YIXING_OPTIONS as QIMEN_YIXING_OPTIONS,
	GODS_PRESET_OPTIONS as QIMEN_GODS_PRESET_OPTIONS,
	ANGAN_MODE_OPTIONS as QIMEN_ANGAN_MODE_OPTIONS,
	JIGONG_MODE_OPTIONS as QIMEN_JIGONG_MODE_OPTIONS,
	SHIFT_ZHIFU_OPTIONS as QIMEN_SHIFT_ZHIFU_OPTIONS,
	DAYJIA_JU_OPTIONS as QIMEN_DAYJIA_JU_OPTIONS,
	YEARJIA_JU_OPTIONS as QIMEN_YEARJIA_JU_OPTIONS,
	KEJIA_FENDUN_OPTIONS as QIMEN_KEJIA_FENDUN_OPTIONS,
	JINHAN_MENPAI_OPTIONS as QIMEN_JINHAN_MENPAI_OPTIONS,
	ZHIRUN_LEAP_OPTIONS as QIMEN_ZHIRUN_LEAP_OPTIONS,
	qijuMethodUsesJieqiFa, qijuMethodOptionsFor, qijuMethodSelectValue, migrateLegacyQimenSchool,
	FEI_MEN_ZHONG_CAN_LABELS as QIMEN_FEI_MEN_ZHONG_CAN_LABELS, MIX_LAYER_LABELS as QIMEN_MIX_LAYER_LABELS, mixLayerDefaultLabel as qimenMixLayerDefaultLabel,
} from '../components/dunjia/DunJiaCalc';
import {
	STYLE_OPTIONS as TAIYI_STYLE_OPTIONS,
	METHOD_OPTIONS as TAIYI_METHOD_OPTIONS,
	TIME_BASIS_OPTIONS as TAIYI_TIME_BASIS_OPTIONS,
	GAME_THEORY_OPTIONS as TAIYI_GAME_THEORY_OPTIONS,
} from '../components/taiyi/TaiYiCalc';
// 太乙流派六轴(纯 core 叶子;regenerateTaiyiSnapshot 组装 school_* → applyTaiyiSchool 几何重算)。
import { TAIYI_SCHOOL_OPTIONS } from '../components/taiyi/core/taiyiSchool';
// 六壬占事类型(叶子数据;builder [占断向导] 段消费)。
import { ZHANDUAN_CATEGORIES } from '../components/liureng/LRZhanDuanDoc';
import { WuXing as LR_WUXING } from '../components/liureng/LRConst';
import { GUICE_OPTION_META, GUICE_SCHOOL_OPTIONS, GUICE_PRESETS, applyPreset as applyGuicePreset, setOption as setGuiceOption } from '../components/guice/guiceSchools';
import { YONG_GONG_OPTIONS as XCT_YONG_GONG_OPTIONS, PI_KOUJING_LABEL as XCT_PI_KOUJING_LABEL } from '../components/xiaochengtu/core/xiaochengtuConst';
import { LIU_YUE_MONTH_NAMES as FEIGONG_LIU_YUE_MONTH_NAMES } from '../components/feigong/core/feigongConst';
import { QUESITED_HOUSE_OPTIONS as GEO_QUESITED_HOUSE_OPTIONS, TURN_HOUSE_LABELS as GEO_TURN_HOUSE_LABELS } from '../components/geomancy/geomancyOptions';
import { YESNO_MODE_LABEL as TAROT_YESNO_MODE_LABEL } from '../components/tarot/engine/verdict';
import { correspondenceOverlayOn as tarotCorrespondenceOverlayOn } from '../components/tarot/engine/cardSchema';   // 「显示进阶对应」门控:齿轮与页面 / 占象同一判据
import { resolveSettings as resolveTarotSettings } from '../components/tarot/engine/reading';
import { getDeck as getTarotDeck, DEFAULT_DECK as TAROT_DEFAULT_DECK } from '../components/tarot/engine/deckRegistry';
// 金口诀合占(所问类别/问事时段):JinKouCalc 处在与 aiAnalysisContext 的循环导入链上,
// 以 aiAnalysisContext 为入口时其常量在本模块 init 期为 undefined(文件头同款告诫)→
// 内联镜像其 key/label,techniqueMountSettings.test 断言 === 源常量防漂移(LIUREN_QI_METHODS 范式)。
const JINKOU_ASK_OPTIONS_M = [
	{ value: 'qiucai', label: '财' }, { value: 'guantu', label: '官' }, { value: 'guansi', label: '官司' },
	{ value: 'xueye', label: '功名' }, { value: 'jibing', label: '病' }, { value: 'hunyue', label: '婚' },
	{ value: 'huaiyun', label: '孕' },
];
const JINKOU_TIME_OPTIONS_M = [
	{ value: 'day', label: '日内' }, { value: 'year', label: '一年' }, { value: 'default', label: '常规' },
];
// 卜卦判读参数(HORARY_PARAM_SPEC scope='horary' 单源,随 spec 自动扩,勿写死键数) / 择日流派口径 13 键(叶子单源;齿轮 hp_/ep_ 扁平键,regenerate 解码)。
import { presetForSchool as uranianPresetForSchool } from '../components/germany/UranianSchools';   // 量化盘换派套预设(与页面 changeSchool 同表)
import { LINGQI_ZHU_META, lingqiZhuChipLabel, lingqiZhuChipTitle } from '../components/lingqi/lingqiSnapshot';   // 灵棋注家:齿轮文字与页面芯片同源
import { HORARY_PARAM_SPEC, horaryJudgeOpts, HORARY_QUESTION_SCOPED_KEYS, horaryStoredSchool } from '../divination/horary/horarySchools';
import { judgeLayerOverrides } from './judgeLayerOverrides';
import { ELECTION_PARAM_SPEC } from '../divination/election/electionParams';
// 六爻判读设置(叶子数据:流派预设/占测事项/神煞表)。
import { LIUYAO_SCHOOL_OPTIONS, LIUYAO_PRESETS, applyPreset as applyLiuyaoPreset } from '../components/gua/liuyaoSchools';
import { YONGSHEN_CATEGORIES } from '../components/gua/liuyaoYongShen';
import { SHENSHA_META, DEFAULT_SHENSHA_SET } from '../components/gua/liuyaoShenSha';
// 通书用事全表 + 六十甲子(叶子数据)。
import { TONGSHU_TERMS, TONGSHU_TERM_CATEGORIES } from '../components/calendar/tongshuData';
import { loadTongshuSettings } from '../components/calendar/tongshuStore';
import { GANZHI_60 } from '../components/fengshui/fengshuiData';
// 择日手术部位(黄道 12 座 → 身体部位;叶子数据)。
import { SIGNS, SIGN_ORDER } from '../divination/data/signs';
// 推运 builder 的官方选项常量 + 默认 opts（三分主星 / Balbillus / 关键点）——纯 util，无循环，直接复用。
import { TRIPLICITY_DIVISIONS, TRIPLICITY_SYSTEMS, TRIPLICITY_DEFAULT_OPTS } from './triplicityRulers';
import { BALBILLUS_YEAR_TYPES, BALBILLUS_MODES, BALBILLUS_SUB_RULES, BALBILLUS_DEFAULT_OPTS } from './balbillus';
import { YS129_START_OPTIONS, YS129_ORDERS, YS129_YEAR_TYPES, YS129_SUB_RULES, YS129_DEFAULT_OPTS, yearSystem129StartLabel } from './yearSystem129';
import { DIST_RELEASERS, DIST_METHODS, DIST_YEARS, DIST_SPANS, DIST_DEFAULTS } from './distributionsOptions';
import { AP_METHODS, AP_EVENTS, AP_YEARS, AP_SPANS, AP_DEFAULTS } from './agePointOptions';
import { RELEASE_MODES, KEYPOINTS_DEFAULT_OPTS } from './keypoints120';
// 批3 推运 builder 导出的官方选项常量（黄道星释 / 十年大运 / 行星弧 / 波斯向运）。
// 这些定义在 components/astro/* 组件文件内，但只导出「纯常量」(不含组件 init 依赖)，且这些文件不 import aiAnalysisContext
// （ZR import AstroChart/ZodiacalRelease，Decennials import AstroChart/decennials，均不回环 aiAnalysisContext），故安全。
import { ZR_BASE_POINTS, ZR_AI_MODES } from '../components/astro/AstroZR';
import {
	DECENNIALS_START_MODES, DECENNIALS_ORDER_TYPES, DECENNIALS_DAY_METHODS,
	DECENNIALS_CALENDAR_TYPES, DECENNIALS_AI_MODES,
} from '../components/astro/AstroDecennials';
import { ARC_SOURCES } from '../components/astro/AstroPlanetaryArc';
import { RATE_LABEL as PERSIAN_RATE_LABEL } from '../components/astro/AstroPersianDirected';
// 紫微「传本/排盘」开关选项(纯常量叶子模块,无循环导入风险)。挂载侧据此把传本设置进 record →
// buildChartZiweiParams 透传 → buildZiweiSnapshotForParams 临时覆盖 ZWEngineOptions(用毕还原),与 sihuaSchool 同范式。
import {
	DAXIAN_SPAN_OPTIONS as ZW_DAXIAN_SPAN_OPTIONS, TIANMA_BASIS_OPTIONS as ZW_TIANMA_BASIS_OPTIONS,
	STAR_SET_OPTIONS as ZW_STAR_SET_OPTIONS, SANPAN_OPTIONS as ZW_SANPAN_OPTIONS,
	SHANGSHI_OPTIONS as ZW_SHANGSHI_OPTIONS, LEAP_MONTH_OPTIONS as ZW_LEAP_MONTH_OPTIONS,
	LATE_ZI_OPTIONS as ZW_LATE_ZI_OPTIONS, YEAR_BOUNDARY_OPTIONS as ZW_YEAR_BOUNDARY_OPTIONS,
	HUOLING_OPTIONS as ZW_HUOLING_OPTIONS, KONG_NAMING_OPTIONS as ZW_KONG_NAMING_OPTIONS,
	BRIGHTNESS_SOURCE_OPTIONS as ZW_BRIGHTNESS_SOURCE_OPTIONS,
	LIFE_MASTER_BY_OPTIONS as ZW_LIFE_MASTER_BY_OPTIONS,
	LIU_YUE_BASIS_OPTIONS as ZW_LIU_YUE_BASIS_OPTIONS, LIUNIAN_SIHUA_GAN_OPTIONS as ZW_LIUNIAN_SIHUA_GAN_OPTIONS, CHANGSHENG_START_OPTIONS as ZW_CHANGSHENG_START_OPTIONS, CHANGSHENG_DIRECTION_OPTIONS as ZW_CHANGSHENG_DIRECTION_OPTIONS, KONGWANG_STYLE_OPTIONS as ZW_KONGWANG_STYLE_OPTIONS, KUIYUE_OPTIONS as ZW_KUIYUE_OPTIONS,
} from '../components/ziwei/ziweiOptions';
import { directionAsporbOptions } from '../constants/directionAspOrb';
import { tiebanKeOptions, clampTiebanKe } from './tiebanFrameworkLocal';
import { DIRECTION_PAGE_SETTINGS } from './directionPageSettings';
import { BEIJI_KE_OPTIONS, NANJI_SECTION_OPTIONS, NANJI_JIANCHU_OPTIONS, NANJI_XIU_OPTIONS, NANJI_PASSWORD_OPTIONS, NANJI_CHART_OPTIONS, CHUNZI_KE_OPTIONS, CHUNZI_RESULT_LIMIT_OPTIONS, CHUNZI_MANSION_OPTIONS, SHAOZI_KE_OPTIONS, ZC_SOUNDS, ZC_KE, ZC_GONG, ZC_DAY_ZHI, zcEnvOptionsFor, zcEnvShown } from '../components/kinastro/kinastroOptions';
import { BABYLON_SCHEMES, SCHEME_ORDER as BABYLON_SCHEME_ORDER } from '../divination/babylon/babylonSchools';
// 注：卜卦/择日/六壬起课的选项常量定义在「大组件」(HoraryMain/ElectionMain/LiuRengMain) 内，它们与 aiAnalysisContext
// 形成循环导入（aiAnalysisContext→techniqueMountSettings→大组件→…→aiAnalysisContext）；当 aiAnalysisContext 为入口时
// init 顺序会让这些常量在 .map 时为 undefined（抛错）。故此处「内联镜像」其值断开循环，并由 techniqueMountSettings.test.js
// 断言「内联值 === 源组件常量」防漂移（见下方 LIUREN_QI_METHODS / HORARY_CATEGORIES / ELECTION_TOPICS）。

// 紫微随盘设置的记录键(挂载齿轮字段名与之同名)
const ZIWEI_RECORD_SETTING_KEYS = new Set(ZIWEI_RECORD_SETTINGS.map((it)=>it.key));

export const MOUNT_TECHNIQUE_DEFAULTS_KEY = 'horosa.ai.mount.techniqueDefaults.v1';
export const MOUNT_TECHNIQUE_DEFAULTS_VERSION = 1;

// 记录的出生纬度是不是北纬(南半球读法只在南纬生效):'31n38' 一类度分串认 n / s;数值纬度认正负;认不出 = false(不置灰)
export function recordIsNorthern(record){
	if(!record || typeof record !== 'object'){ return false; }
	const g = Number(record.gpsLat);
	if(record.gpsLat !== undefined && record.gpsLat !== null && record.gpsLat !== '' && Number.isFinite(g)){ return g > 0; }
	const t = `${record.lat || ''}`.trim().toLowerCase();
	if(/^\d+(\.\d+)?n\d*/.test(t)){ return true; }
	if(/^\d+(\.\d+)?s\d*/.test(t)){ return false; }
	const n = Number(t);
	return t !== '' && Number.isFinite(n) ? n > 0 : false;
}
const ON_OFF = [{ value: 0, label: '关' }, { value: 1, label: '开' }];
// 页面档名里没写缺省的,齿轮在缺省档后补「（默认）」(页面自己写了的不重复补)
const markDefaultOption = (options, dft)=>(options || []).map((o)=>(o.value === dft && !/默认/.test(o.label) ? { ...o, label: `${o.label}（默认）` } : { value: o.value, label: o.label }));
const guiceMeta = (key)=>GUICE_OPTION_META.find((m)=>m.key === key) || {};
const guiceMetaLabel = (key)=>guiceMeta(key).label || key;
const guiceMetaOptions = (key, dft)=>markDefaultOption(guiceMeta(key).options, dft);
// 与奇门/太乙/三式页面同文:时间算法 1 档页面叫「直接时间」;日界 0 档不是「不换日」而是 24 点换日。
const TIME_ALG_OPTIONS = [{ value: 0, label: '真太阳时' }, { value: 1, label: '直接时间' }];
const ZODIACAL_OPTIONS = [{ value: 0, label: '回归黄道' }, { value: 1, label: '恒星黄道' }];   // 与星盘页黄道下拉同(恒星档的岁差制另一项选)
const DAY_BOUNDARY_OPTIONS = [{ value: 0, label: '24点算第二天' }, { value: 1, label: '23点算第二天' }];

const HSYS_OPTIONS = AstroConst.HOUSE_SYSTEM_OPTIONS.map((item)=>({ value: item.value, label: item.label }));
const PD_METHOD_OPTIONS = SUPPORTED_PD_METHODS.map((value)=>({ value, label: PD_METHOD_LABELS[value] || value }));
const PD_TIME_KEY_OPTIONS = SUPPORTED_PD_TIME_KEYS.map((value)=>({ value, label: PD_TIME_KEY_LABELS[value] || value }));

// 日界 + 晚子时（八字/紫微/太乙等共用；从 TIME_FIELDS 抽出以便单独复用）。默认 === 各 builder 现状。
// default 是模块载入期求值的一次性快照,builder 却实时读全局——会话内改
// 全局日界后基线冻在旧值,齿轮拨回旧档被 prune 剪空(9 技法共用字段)。globalCurrent 实时求值根治。
const DAY_BOUNDARY_FIELDS = [
	{ name: 'after23NewDay', label: '日界（日柱换日）', type: 'select', options: DAY_BOUNDARY_OPTIONS, default: defaultAfter23NewDay(), globalCurrent: ()=>defaultAfter23NewDay(), group: '时间换算' },
	{ name: 'lateZiHourUseNextDay', label: '晚子时·时柱进次日', type: 'switch', options: ON_OFF, default: defaultLateZiHourUseNextDay(), globalCurrent: ()=>defaultLateZiHourUseNextDay(), group: '时间换算' },
];
// 有本页日界控件的技法,齿轮用页面上的叫法(奇门页 / 三式合一页叫「日界」,太乙页叫「换日」);其余技法沿用共用名
const dayBoundaryLabelled = (label)=>(f)=>(f.name === 'after23NewDay' ? { ...f, label } : f);
// 起课时间换算共用组（紫微/数算/神数等 2 档 timeAlg 技法），默认全部 === buildFieldObject 现状。
const TIME_FIELDS = [
	{ name: 'timeAlg', label: '时间算法', type: 'select', options: TIME_ALG_OPTIONS, default: 0, group: '时间换算' },
	...DAY_BOUNDARY_FIELDS,
];
// 构造器认平太阳时(3)的技法(神数正传 / 参评 / 河洛 / 一掌经):盘的时间算法来自全局「新命盘缺省」,可以是平太阳时 —— 齿轮也要能选回它
const TIME_ALG_WITH_MEAN_OPTIONS = [{ value: 0, label: '真太阳时' }, { value: 3, label: '平太阳时' }, { value: 1, label: '直接时间' }];
const TIME_FIELDS_WITH_MEAN = TIME_FIELDS.map((f)=>(f.name === 'timeAlg' ? { ...f, options: TIME_ALG_WITH_MEAN_OPTIONS, normalize: (v)=>Number(v) } : f));
// 紫微只认真太阳时 / 直接时间(构造器把平太阳时当真太阳时算):存了 3 的盘显示为真太阳时 = 实际所用口径
// 日界 / 晚子时两键只在紫微「晚子时 = 跟随全局」时起作用(具体方案自带这两项,双盘两张各自钉死;ZiweiCalc 同判)
const ZIWEI_TIME_FIELDS = TIME_FIELDS.map((f)=>{
	if(f.name === 'timeAlg'){ return { ...f, normalize: (v)=>(Number(v) === 1 ? 1 : 0) }; }
	return { ...f, showWhen: (d)=>!d || !d.lateZi || d.lateZi === 'global' };
});
// 紫微九个叠层开关:记录里存的是布尔(ziweiRecordSettings 写回),齿轮是 0/1 —— 不归一则抽屉显空、拨关再拨开被记成「已修改」并白算一次
const ZW_SWITCH01 = (v)=>((v === true || v === 1 || v === '1' || v === 'true') ? 1 : 0);
// 八字专属 timeAlg 4 档（源 CnTraditionInput：真太阳时/平太阳时/直接时间/春分定卯时；西占/紫微的 2 档不含「春分定卯时/平太阳时」）。
// 平太阳时(3)=仅经度差、去均时差,与真太阳时(0)算法不同(baziLunarLocal timeAlg=3),挂载须可选。
const BAZI_TIME_ALG_OPTIONS = [
	{ value: 0, label: '真太阳时' },
	{ value: 3, label: '平太阳时' },
	{ value: 1, label: '直接时间' },
	{ value: 2, label: '春分定卯时(暂按直接时间)' },
];
// 十二地支（金口诀地分等；万年不变常量，内联零漂移）。
const DIZHI_12 = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

// 多选运限选项生成器（紫微/八字共用）：数值范围 → [{value,label}]。
const numRangeOptions = (from, to, labelFn)=>{
	const out = [];
	for(let i = from; i <= to; i++){
		out.push({ value: i, label: labelFn ? labelFn(i) : `${i}` });
	}
	return out;
};
// 大限命盘宫位序 0–11；流月农历 1–12；流日农历 1–31（含大月 31）；流时时辰序 0–11（子起）。
const ZIWEI_DAXIAN_OPTIONS = numRangeOptions(0, 11, (i)=>`宫位序 ${i}`);
const LUNAR_MONTH_OPTIONS = numRangeOptions(1, 12, (i)=>`${i}月`);
const LUNAR_DAY_OPTIONS = numRangeOptions(1, 31, (i)=>`${i}日`);
const SHICHEN_LABELS = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const SHICHEN_OPTIONS = numRangeOptions(0, 11, (i)=>`${SHICHEN_LABELS[i]}时(${i})`);

// P4 区间扫描（推运 datetime 型技法共用）：可选 datetimeEnd + scanStep。
//  - 默认全空（datetimeEnd '' / scanStep ''）→ prune 后丢弃 → builder 走单点（=现状，字节级一致）。
//  - 仅当 datetimeEnd 非空且 scanStep 有值时，builder 才循环 from(datetime|此刻)→to 按 step 产多段（段数上限~30）。
// scanStep 默认空串（'' 表示「不扫描」）；选 y/m/d 才启用区间循环。
const SCAN_STEP_OPTIONS = [
	{ value: '', label: '关闭（单点）' },
	{ value: 'y', label: '逐年扫描' },
	{ value: 'm', label: '逐月扫描' },
	{ value: 'd', label: '逐日扫描' },
];
// datetime 型（含时分）区间字段：end 用 datetime picker。
const scanRangeDatetimeFields = (group)=>[
	{ name: 'datetimeEnd', label: '区间终点(留空=单点)', type: 'datetime', default: '', group },
	{ name: 'scanStep', label: '区间步进', type: 'select', options: SCAN_STEP_OPTIONS, default: '', group },
];
// date 型（仅日）区间字段：end 用 date picker（vedic/jaynes 的 targetDate 是纯日期）。
const scanRangeDateFields = (group)=>[
	{ name: 'datetimeEnd', label: '区间终点日期(留空=单点)', type: 'date', default: '', group },
	{ name: 'scanStep', label: '区间步进', type: 'select', options: SCAN_STEP_OPTIONS, default: '', group },
];

// ↓↓↓ 内联镜像「大组件」常量（断循环导入；单测断言 === 源常量防漂移）。
// 镜像 LiuRengMain.QI_METHODS（25 法，key/name 一致）。
const LIUREN_QI_METHODS = [
	{ key: 'zheng', name: '正时正将' },
	{ key: 'bake2', name: '十二客·月建加太岁' },
	{ key: 'bake3', name: '十二客·太岁加月建' },
	{ key: 'bake4', name: '十二客·月建加日干' },
	{ key: 'bake5', name: '十二客·岁干加正时' },
	{ key: 'bake6', name: '十二客·月将加日干' },
	{ key: 'bake7', name: '十二客·月将加太岁' },
	{ key: 'bake8', name: '十二客·太岁加月将' },
	{ key: 'bake9', name: '十二客·月将加本命' },
	{ key: 'bake10', name: '十二客·月将加行年' },
	{ key: 'bake11', name: '十二客·太岁加本命' },
	{ key: 'bake12', name: '十二客·太岁加行年' },
	{ key: 'tsjs', name: '太岁加时' },
	{ key: 'yjjs', name: '月建加时' },
	{ key: 'xnjs', name: '行年加时' },
	{ key: 'bmjs', name: '本命加时' },
	{ key: 'cike1', name: '次客·一筹' },
	{ key: 'cike2', name: '次客·二筹' },
	{ key: 'cike3', name: '次客·三筹' },
	{ key: 'alnr', name: '年日对齐·陈旧事' },
	{ key: 'alns', name: '年时对齐·深远事' },
	{ key: 'alyr', name: '月日对齐·催迫事' },
	{ key: 'alys', name: '月时对齐·灵活事' },
	{ key: 'xuanshi', name: '选时·事发之时' },
	{ key: 'yanshu', name: '演数·随感之数(加时)' },
	{ key: 'baoshu', name: '报数/端法·活时(÷12定支)' },
];
// 镜像 HoraryMain.HORARY_CATEGORIES（20 类，value/label 一致;批2 新增 失物/消息 两类）。
const HORARY_CATEGORIES = [
	{ value: 'general', label: '综合 · 能否成事' },
	{ value: 'wealth', label: '财物 · 借贷（二宫）' },
	{ value: 'lost', label: '失物寻回（二宫动产）' },
	{ value: 'family', label: '兄弟 · 亲属（三宫）' },
	{ value: 'message', label: '消息真假 · 书信（三宫）' },
	{ value: 'property', label: '房产 · 田宅（四宫）' },
	{ value: 'father', label: '父亲 · 尊长（父母宫参数定 4/10）' },
	{ value: 'mother', label: '母亲（父母宫参数定 10/4）' },
	{ value: 'pregnancy', label: '子嗣 · 怀孕（五宫）' },
	{ value: 'health', label: '疾病 · 健康（六宫）' },
	{ value: 'lost_animal', label: '走失活物（六宫/大畜十二宫）' },
	{ value: 'marriage', label: '婚姻 · 感情（七宫）' },
	{ value: 'trade', label: '买卖 · 交易（七宫四角）' },
	{ value: 'lawsuit', label: '诉讼 · 合伙 · 战争（七宫）' },
	{ value: 'theft', label: '盗窃 · 走失（七宫/转宫）' },
	{ value: 'death', label: '死生 · 遗产（八宫）' },
	{ value: 'travel', label: '旅行 · 远行 · 学问（九宫）' },
	{ value: 'career', label: '职位 · 事业（十宫）' },
	{ value: 'hope', label: '愿望 · 朋友（十一宫）' },
	{ value: 'enemy', label: '私敌 · 囚禁（十二宫）' },
];
// 镜像 ElectionMain.ELECTION_TOPICS（26 类，value/label 一致）。
const ELECTION_TOPICS = [
	{ value: 'marriage', label: '结婚 / 订婚' },
	{ value: 'business', label: '创业 / 开业 / 开市' },
	{ value: 'organization', label: '团体组织成立' },
	{ value: 'move_in', label: '入宅 / 迁居' },
	{ value: 'buy_property', label: '购屋 / 租屋' },
	{ value: 'buy_land', label: '购地' },
	{ value: 'renovation', label: '整修 / 动土 / 破土' },
	{ value: 'trade', label: '买卖交易' },
	{ value: 'buy_car', label: '购车 / 交车' },
	{ value: 'contract', label: '签约 / 承诺' },
	{ value: 'registration', label: '登记 / 申请' },
	{ value: 'diet', label: '节食 / 戒习惯' },
	{ value: 'pursue_love', label: '追求爱情 / 求职' },
	{ value: 'team_departure', label: '队伍出发 / 比赛' },
	{ value: 'surgery', label: '手术' },
	{ value: 'medication', label: '用药 / 服药' },   // 引擎早有用药判据(月落主病星座+吉相),此前页面不可达
	{ value: 'banquet', label: '宴会 / 就职典礼' },
	{ value: 'travel', label: '出行' },
	{ value: 'blessing', label: '祈福 / 安香 / 法会' },
	{ value: 'general_day', label: '大众吉日' },
	{ value: 'planting', label: '播种 / 种植 / 农耕' },
	{ value: 'sailing', label: '海行 / 航海' },
	{ value: 'litigation', label: '诉讼 / 战阵 / 竞争' },
	{ value: 'release', label: '释囚 / 解约脱身' },
	{ value: 'haircut', label: '理发 / 剪甲' },
	{ value: 'talisman', label: '制作护符' },
];

// 奇门遁甲：镜像 DunJiaCalc/DunJiaMain DEFAULT_OPTIONS 与 aiAnalysisContext DEFAULT_QIMEN_OPTIONS 的关键排盘选项。
// （faRelatedPeople 是「内容/数据」非排盘选项，不入此 schema。）
// 直接复用 DunJiaCalc 的官方选项常量（值/标签 100% 与排盘引擎一致，杜绝手写错值喂坏 calcDunJia）。
// 奇门/三式页面 DEFAULT_OPTIONS 与存档是布尔,挂载 schema 是 0/1 下拉:B 类基线直接取存档 → 下拉 value=false 无匹配档(显示空档),
// 选「…(默认)」(0)时剪枝比较 '0'!=='false' 判为覆盖(误计「已自定义」且强制重算)。八键统一归一 0/1('0'/'1'/布尔/数字)。
const BOOL01 = (v)=>((v === true || v === 1 || v === '1' || v === 'true') ? 1 : 0);
// 显示条件与奇门页 / 三式合一页同一判据(页面上不出现 / 置灰的项,齿轮里也不出现;隐藏项不计覆盖也不下发)
const qmPaiPan = (d)=>Number(d.paiPanType === undefined || d.paiPanType === null || d.paiPanType === '' ? 3 : d.paiPanType);
const qmFeiOrMix = (d)=>d.school === '飞盘' || d.school === '混合';
const QIMEN_FIELDS = [
	{ name: 'paiPanType', label: '排盘', type: 'select', default: 3, group: '排盘', options: QIMEN_PAIPAN_OPTIONS },
	// 档位随排盘体例(与奇门页 / 三式合一页同一判据 qijuMethodOptionsFor):非时家刻家只有「本家默认 / 阴盘」,节气四法回显为本家默认
	{ name: 'qijuMethod', label: '起局', type: 'select', default: 'zhirun', group: '排盘', options: QIMEN_QIJU_METHOD_OPTIONS,
		optionsFor: (d)=>qijuMethodOptionsFor(qmPaiPan(d)), displayValue: (v, d)=>qijuMethodSelectValue(qmPaiPan(d), v) },
	{ name: 'school', label: '盘式', type: 'select', default: '转盘', group: '排盘', options: QIMEN_SCHOOL_OPTIONS },
	{ name: 'shuziReportNumber', label: '报数', type: 'text', default: '', group: '排盘', showWhen: (d)=>d.qijuMethod === 'shuzi' },
	{ name: 'zhirunLeapDays', label: '置闰天数', type: 'select', default: 9, group: '排盘', options: QIMEN_ZHIRUN_LEAP_OPTIONS,
		showWhen: (d)=>d.qijuMethod === 'zhirun' && qijuMethodUsesJieqiFa(qmPaiPan(d)) },
	// jieQiType 已删:页面无控件(live 硬钉 1)、引擎内唯一消费是标签、标签不进快照 → 三重死项。
	{ name: 'zhiShiType', label: '值使', type: 'select', default: 0, group: '排盘', options: QIMEN_ZHISHI_OPTIONS, showWhen: (d)=>!qmFeiOrMix(d) },
	{ name: 'yueJiaQiJuType', label: '月家起局', type: 'select', default: 0, group: '排盘', options: QIMEN_YUEJIA_QIJU_OPTIONS, showWhen: (d)=>qmPaiPan(d) === 1 },
	{ name: 'kongMode', label: '空亡', type: 'select', default: 'day', group: '排盘', options: QIMEN_KONG_MODE_OPTIONS },
	{ name: 'yimaMode', label: '驿马', type: 'select', default: 'day', group: '排盘', options: QIMEN_MA_MODE_OPTIONS },
	// 盘类(命局/事局):快照「盘类：」行 + 法奇门用神取向消费;性别:快照「命式：」行(曾缺 → 起课源输出 undefined)。
	{ name: 'chartCategory', label: '盘类', type: 'select', default: 'shi', group: '排盘', options: QIMEN_CHART_CATEGORY_OPTIONS },
	{ name: 'sex', label: '性别', type: 'select', default: 1, group: '排盘', options: QIMEN_SEX_OPTIONS },
	// 移星域修正:引擎域 0-7 八档(YIXING_OPTIONS),此前 switch 只暴露 0/1=顺转2~7宫六档在挂载侧丢失。
	{ name: 'shiftPalace', label: '移星', type: 'select', default: 0, group: '排盘', options: QIMEN_YIXING_OPTIONS },
	// fengJu 引擎默认为布尔 false → 用布尔语义,normalize 到 true/false（与 DEFAULT_OPTIONS 字节一致）。
	// 标签与页面同(「封局」未封局 / 已封局);此前写成「法奇门叠加层」,那是另一项功能,关它像是关掉法奇门分析
	{ name: 'fengJu', label: '封局', type: 'select', options: [{ value: false, label: '未封局' }, { value: true, label: '已封局' }], default: false, group: '排盘', normalize: (v)=>(v === true || v === 1 || v === '1') },
	// 八神取神/暗干族
	{ name: 'godsPreset', label: '八神取神', type: 'select', default: 'baihu_xuanwu', group: '排盘', options: QIMEN_GODS_PRESET_OPTIONS },
	{ name: 'anGanMode', label: '暗干', type: 'select', default: 'off', group: '排盘', options: QIMEN_ANGAN_MODE_OPTIONS },
	{ name: 'jiGongMode', label: '中宫寄宫', type: 'select', default: 'kun', group: '排盘', options: QIMEN_JIGONG_MODE_OPTIONS },
	{ name: 'feiXingShun', label: '九星飞法', type: 'select', default: 0, group: '排盘', options: [{ value: 0, label: '阳顺阴逆(默认)' }, { value: 1, label: '两遁皆顺飞' }], normalize: BOOL01, showWhen: qmFeiOrMix },
	{ name: 'feiMenShun', label: '九门飞法', type: 'select', default: 0, group: '排盘', options: [{ value: 0, label: '阳顺阴逆(默认)' }, { value: 1, label: '两遁皆顺飞' }], normalize: BOOL01, showWhen: qmFeiOrMix },
	{ name: 'feiShenShun', label: '九神飞法', type: 'select', default: 0, group: '排盘', options: [{ value: 0, label: '阳顺阴逆(默认)' }, { value: 1, label: '两遁皆顺飞' }], normalize: BOOL01, showWhen: qmFeiOrMix },
	{ name: 'feiMenZhongCan', label: '中门飞宫', type: 'select', default: 1, group: '排盘', options: [{ value: 1, label: QIMEN_FEI_MEN_ZHONG_CAN_LABELS.on }, { value: 0, label: QIMEN_FEI_MEN_ZHONG_CAN_LABELS.off }], normalize: BOOL01, showWhen: qmFeiOrMix },
	{ name: 'feiMenZhongShow', label: '中宫门位显示', type: 'select', default: 0, group: '排盘', options: [{ value: 0, label: '留空(默认)' }, { value: 1, label: '标「中」字样' }], normalize: BOOL01, showWhen: (d)=>qmFeiOrMix(d) && BOOL01(d.feiMenZhongCan) === 0 },
	{ name: 'mixTian', label: '天盘层', type: 'select', default: '', group: '排盘', options: [{ value: '', label: qimenMixLayerDefaultLabel('zhuan') }, { value: 'zhuan', label: QIMEN_MIX_LAYER_LABELS.zhuan }, { value: 'fei', label: QIMEN_MIX_LAYER_LABELS.fei }], showWhen: (d)=>d.school === '混合' },
	{ name: 'mixXing', label: '九星层', type: 'select', default: '', group: '排盘', options: [{ value: '', label: qimenMixLayerDefaultLabel('zhuan') }, { value: 'zhuan', label: QIMEN_MIX_LAYER_LABELS.zhuan }, { value: 'fei', label: QIMEN_MIX_LAYER_LABELS.fei }], showWhen: (d)=>d.school === '混合' },
	{ name: 'mixMen', label: '八门层', type: 'select', default: '', group: '排盘', options: [{ value: '', label: qimenMixLayerDefaultLabel('fei') }, { value: 'zhuan', label: QIMEN_MIX_LAYER_LABELS.zhuan }, { value: 'fei', label: QIMEN_MIX_LAYER_LABELS.fei }], showWhen: (d)=>d.school === '混合' },
	{ name: 'mixShen', label: '九神层', type: 'select', default: '', group: '排盘', options: [{ value: '', label: qimenMixLayerDefaultLabel('fei') }, { value: 'zhuan', label: QIMEN_MIX_LAYER_LABELS.zhuan }, { value: 'fei', label: QIMEN_MIX_LAYER_LABELS.fei }], showWhen: (d)=>d.school === '混合' },
	{ name: 'kongMarkBoth', label: '空亡标注', type: 'select', default: 0, group: '排盘', options: [{ value: 0, label: '单一模式(默认)' }, { value: 1, label: '日空时空并标' }], normalize: BOOL01 },
	{ name: 'showAllKong', label: '四柱空亡', type: 'select', default: 0, group: '排盘', options: [{ value: 0, label: '不显示(默认)' }, { value: 1, label: '显示年月日时空' }], normalize: BOOL01 },
	{ name: 'shiftZhiFuMode', label: '移星值符', type: 'select', default: 'follow', group: '排盘', options: QIMEN_SHIFT_ZHIFU_OPTIONS, showWhen: (d)=>Number(d.shiftPalace) > 0 },
	{ name: 'yearJiaJu', label: '年家定局', type: 'select', default: 'sanyuan', group: '排盘', options: QIMEN_YEARJIA_JU_OPTIONS, showWhen: (d)=>qmPaiPan(d) === 0 },
	{ name: 'dayJiaJu', label: '日家定局', type: 'select', default: 'yiyuan', group: '排盘', options: QIMEN_DAYJIA_JU_OPTIONS, showWhen: (d)=>qmPaiPan(d) === 2 },
	{ name: 'keJiaFenDun', label: '刻家分遁', type: 'select', default: 'zihou', group: '排盘', options: QIMEN_KEJIA_FENDUN_OPTIONS, showWhen: (d)=>qmPaiPan(d) === 4 },
	{ name: 'keZiZhengHuanShi', label: '子正换时', type: 'select', default: 0, group: '排盘', options: [{ value: 0, label: '子时23点起(默认)' }, { value: 1, label: '子正0点换时' }], normalize: BOOL01, showWhen: (d)=>qmPaiPan(d) === 4 },
	{ name: 'jinhanMenPai', label: '八门排法', type: 'select', default: 'book', group: '排盘', options: QIMEN_JINHAN_MENPAI_OPTIONS, showWhen: (d)=>qmPaiPan(d) === 6 },
	// 与上面 fengJu 同款布尔 normalize:两页(奇门/三式合一)的 DEFAULT_OPTIONS 里 showAnZhi 都是布尔,
	// 而 switch 的 onChange 恒产 1/0 → 剪枝拿 '0' 与 'false' 比,拨开再拨回会被计为「已自定义 1 项」并触发
	// 一次无谓的强制重算(产物不变)。default 同步改 false 与存档字节一致;三式合一子组由本条 reTag 派生,自动同步。
	{ name: 'showAnZhi', label: '暗支(随暗干)', type: 'switch', options: ON_OFF, default: false, group: '排盘', normalize: (v)=>(v === true || v === 1 || v === '1') },
	...TIME_FIELDS.map(dayBoundaryLabelled('日界')),
];

// 太乙：复用 TaiYiCalc 官方选项常量（盘式 / 古法公式 / 时间基准 / 博弈），默认对齐 TaiYiMain state.options + fetchTaiyiPan 现状。
// 盘式 = 太乙命法时页面隐藏古法公式 / 博弈 / 流派设置整段(命法盘不消费它们),齿轮同
const taiyiNotLife = (d)=>Number(d && d.style) !== 5;
const TAIYI_FIELDS = [
	{ name: 'style', label: '盘式', type: 'select', default: 3, group: '盘式', options: TAIYI_STYLE_OPTIONS },
	{ name: 'tn', label: '古法公式', type: 'select', default: 0, group: '盘式', options: TAIYI_METHOD_OPTIONS, showWhen: taiyiNotLife },
	{ name: 'timeBasis', label: '时间基准', type: 'select', default: 'direct', group: '盘式', options: TAIYI_TIME_BASIS_OPTIONS },
	{ name: 'gameTheory', label: '博弈', type: 'select', default: 0, group: '盘式', options: TAIYI_GAME_THEORY_OPTIONS, showWhen: taiyiNotLife },
	// 命法盘性别:仅盘式=太乙命法(style=5)时,fetchTaiyiPan→后端 webtaiyisrv:401/521 消费 sex 改命法盘 → showWhen 条件揭示,默认男 prune 零回归。
	{ name: 'sex', label: '命法性别', type: 'select', default: '男', group: '盘式', showWhen: (d)=>Number(d.style) === 5, options: [
		{ value: '男', label: '男' },
		{ value: '女', label: '女' },
	] },
	// 流派六轴(计神方向/文昌重留/客算间辰/三基起宫/游神方向/始击坐标):regenerateTaiyiSnapshot 组装
	// school_* → applyTaiyiSchool 起盘后几何重算主客算/神煞 —— 后端已通,曾只差齿轮。默认 default=从盘零回归。
	...['jishen', 'wenchang', 'keJianChen', 'sanji', 'youshen', 'shijiCoord'].map((ax)=>({
		name: 'school_' + ax,
		label: '流派·' + ({ jishen: '计神方向', wenchang: '文昌重留', keJianChen: '客算间辰', sanji: '三基起宫', youshen: '游神方向', shijiCoord: '始击坐标' })[ax],
		type: 'select', default: 'default', group: '流派', showWhen: taiyiNotLife,
		options: (TAIYI_SCHOOL_OPTIONS[ax] || []).map((o)=>({ value: o.value, label: o.label })),
	})),
	// 太乙也吃日界/晚子时：fetchTaiyiPan(TaiYiCalc) 透传到 buildLocalBaziResult 算四柱/时柱。
	// 曾 default:0 且无 globalCurrent(对齐旧 fetchTaiyiPan 兜底 0),与页面缺省 defaultAfter23NewDay()(出厂 23 点换日)
	//   不一:起课时间源挂载太乙时 23:00-23:59 盘与页面不一,且同一快照内 nongli 请求按「齿轮→记录→全局」取日界、taiyi/pan 却按 0。
	//   改与奇门/三式同用 DAY_BOUNDARY_FIELDS(default=globalCurrent=实时全局),fetchTaiyiPan 兜底同步改 defaultAfter23NewDay()。
	...DAY_BOUNDARY_FIELDS.map(dayBoundaryLabelled('换日')),
];

// 太玄筮法 / 荆诀 起筮种子:留空 = 随存档种子(没存则由起课时间 yyyyMMddHHmm 派生,确定性);填数 → 走该 seed(覆盖派生)。
// 0 是页面允许、后端接受的合法种子:缺省改用空串哨兵,此前缺省 0 被剪掉,显式选种子 0 表达不了(清空也落回 0)。
// blankFollowsBaseline:清空输入框 = 随存档(不算覆盖、不下发),此前清空被当成显式空值 → 重算按时间另起一卦。
const TAIXUAN_FIELDS = [
	{ name: 'seed', label: '起筮种子 (留空=随存档 / 按起课时间派生)', type: 'number', default: '', min: 0, group: '起筮', placeholder: '空 → 随存档 / 按时间派生', blankFollowsBaseline: true },
];
const JINGJUE_FIELDS = [
	{ name: 'seed', label: '起筮种子 (留空=随存档 / 按起课时间派生)', type: 'number', default: '', min: 0, group: '起筮', placeholder: '空 → 随存档 / 按时间派生', blankFollowsBaseline: true },
];

// 五兆:WuZhaoMain.state 默认 mode='ganzhi' number=0 manual=false manualSplits=DEFAULT_SPLITS。
// 随机起兆法(揲筮/自动掷钱)在挂载场景按时间点重算,每次结果不同即不可复现 →
// builder 会回落干支起例;欲用揲筮请开手动复现、欲用掷钱请关自动掷并填定六掷。
const WUZHAO_FIELDS = [
	// 标签明示复现条件(随机起兆在挂载「按时间点重算」下不可复现;条件不满足且存档无兆数时 builder 回落干支起例并在快照写明)。
	// 字段名 / 档名与五兆页同(「起盘方式」「揲筮模式」);括注是挂载才有的复现条件
	{ name: 'mode', label: '起盘方式', type: 'select', default: 'ganzhi', group: '起例', options: [
		{ value: 'ganzhi', label: '干支起盘(默认,纯时间)' },
		{ value: 'day', label: '日干起盘(折竹;需揲筮模式=手动复现,否则按干支起盘)' },
		{ value: 'hour', label: '时干起盘(折竹;需揲筮模式=手动复现,否则按干支起盘)' },
		{ value: 'minute', label: '分干起盘(折竹;需揲筮模式=手动复现,否则按干支起盘)' },
		{ value: 'tang', label: '唐代正法揲筮(需揲筮模式=手动复现,否则按干支起盘)' },
		{ value: 'dunhuang', label: '敦煌校录揲筮(仅存档带兆数时可复现,否则按干支起盘)' },
		{ value: 'qian', label: '以钱代筮(需关「每次起盘重掷」并填六掷,否则按干支起盘)' },
		{ value: 'zhushu', label: '直输五兆数' },
	]},
	{ name: 'shifaVariant', label: '筮法口径 (敦煌校录揲筮)', type: 'select', default: 'guayi', group: '起例',
		showWhen: (d)=>(d.mode === 'dunhuang'), options: [
			{ value: 'guayi', label: '挂一回加（0策水·5火·10木·15金·20土）' },
			{ value: 'jiaolu', label: '校录原案（0策土·5水·10火·15木·20金）' },
		]},
	{ name: 'qianAuto', label: '每次起盘重掷 (以钱代筮)', type: 'switch', options: ON_OFF, default: 1, group: '起例',
		showWhen: (d)=>(d.mode === 'qian'), normalize: (v)=>(v === true || v === 1 || v === '1') },
	{ name: 'qianThrows', label: '六掷阳面数 (逗号分隔 0-4,如 1,2,3,3,3,4;关「每次起盘重掷」后生效)', type: 'text', default: '', group: '起例',
		showWhen: (d)=>(d.mode === 'qian' && !(d.qianAuto === true || `${d.qianAuto}` === '1' || d.qianAuto === undefined)),   /* 以钱代筮且关自动掷才读 */
		normalize: (v)=>{ if(Array.isArray(v)){ return v.length === 6 ? v.map(Number) : undefined; } const a = `${v == null ? '' : v}`.split(/[,，\s]+/).map((x)=>Number(x)).filter((n)=>!Number.isNaN(n)); return a.length === 6 ? a : undefined; } },
	{ name: 'zhaoNums', label: '五兆卜数 (逗号分隔 1-5,一水二火三木四金五土)', type: 'text', default: '', group: '起例',
		showWhen: (d)=>(d.mode === 'zhushu'),
		normalize: (v)=>{ if(Array.isArray(v)){ return v.length === 6 ? v.map(Number) : undefined; } const a = `${v == null ? '' : v}`.split(/[,，\s]+/).map((x)=>Number(x)).filter((n)=>!Number.isNaN(n)); return a.length === 6 ? a : undefined; } },
	{ name: 'xingshenMonth', label: '行神月制', type: 'select', default: 'lunar', group: '断法', options: [
		{ value: 'lunar', label: '农历月（《要诀略》本法）' },
		{ value: 'jieqi', label: '节气月（月建）' },
	]},
	{ name: 'mingZhi', label: '年命支 (行年/年立/官禄位用,留空则该类留白)', type: 'select', default: '', group: '断法', options: [
		{ value: '', label: '未指定' },
		{ value: '子', label: '子' }, { value: '丑', label: '丑' }, { value: '寅', label: '寅' },
		{ value: '卯', label: '卯' }, { value: '辰', label: '辰' }, { value: '巳', label: '巳' },
		{ value: '午', label: '午' }, { value: '未', label: '未' }, { value: '申', label: '申' },
		{ value: '酉', label: '酉' }, { value: '戌', label: '戌' }, { value: '亥', label: '亥' },
	]},
	{ name: 'gender', label: '性别 (行年/年立用)', type: 'select', default: '', group: '断法', options: [
		{ value: '', label: '未指定' },
		{ value: 'male', label: '男' },
		{ value: 'female', label: '女' },
	]},
	// 报数只在干支起例参算(页面其余起法置灰),值域 0–9 与页面同
	{ name: 'number', label: '报数 (干支起盘读取;0=不用)', type: 'number', default: 0, min: 0, max: 9, group: '起例', showWhen: (d)=>(d.mode || 'ganzhi') === 'ganzhi' },   // 无「报数类」模式
	// 页面是「揲筮模式」下拉(自动随机 / 手动复现),存档是布尔:归一成 0/1 才对得上档(builder 读 !!o.manual)
	{ name: 'manual', label: '揲筮模式', type: 'select', options: [{ value: 0, label: '自动随机' }, { value: 1, label: '手动复现' }], default: 0, group: '起例', showWhen: (d)=>['day', 'hour', 'minute', 'tang'].indexOf(d.mode) >= 0, normalize: (v)=>((v === true || v === 1 || v === '1') ? 1 : 0) },
	// 手动六数:仅 manual=开 时生效。WuZhaoMain:156 builder 读 opts.manualSplits(6 数组)进重算请求,入口:986 已传,
	//   但 schema 此前漏字段 → manual 开关形同虚设(恒走 DEFAULT_SPLITS)。text 逗号输入 normalize 成 6 数组;留空=默认零回归。
	{ name: 'manualSplits', label: '手动六数 (逗号分隔,如 18,8,5,2,1,1;留空=随存档)', type: 'text', default: '', group: '起例',
		// 页面同判据:日 / 时 / 分干起盘、唐法揲筮且开手动分爻才读手动六数
		showWhen: (d)=>['day', 'hour', 'minute', 'tang'].indexOf(d.mode) >= 0 && (d.manual === 1 || d.manual === true || d.manual === '1'),
		normalize: (v)=>{ if(Array.isArray(v)){ return v.length === 6 ? v.map(Number) : undefined; } const a = `${v == null ? '' : v}`.split(/[,，\s]+/).map((x)=>Number(x)).filter((n)=>!Number.isNaN(n)); return a.length === 6 ? a : undefined; } },
];

// 神易数:ShenYiShuMain.state 默认 hourSource='auto' manualHour=0 seasonSource='auto' manualSeason='夏'。
const SHENYISHU_FIELDS = [
	{ name: 'hourSource', label: '入式小时', type: 'select', default: 'auto', group: '起盘', options: [
		{ value: 'auto', label: '自动取时间小时' },
		{ value: 'manual', label: '手动指定小时' },
	]},
	{ name: 'manualHour', label: '手动小时 (0-23)', type: 'number', default: 0, min: 0, max: 23, group: '起盘', showWhen: (d)=>d.hourSource === 'manual' },   // 只在时辰来源 = 手动时生效(页面同)
	{ name: 'seasonSource', label: '五行季令', type: 'select', default: 'auto', group: '起盘', options: [
		{ value: 'auto', label: '自动按公历月份取季令（三月一季）' },
		{ value: 'manual', label: '手动指定季令' },
	]},
	{ name: 'manualSeason', label: '手动季令', type: 'select', default: '夏', group: '起盘', showWhen: (d)=>d.seasonSource === 'manual', options: [
		{ value: '春', label: '春' },
		{ value: '夏', label: '夏' },
		{ value: '秋', label: '秋' },
		{ value: '冬', label: '冬' },
	]},
];

// 六壬起课法：buildLiuRengSnapshotText 第 8 参 castOpts 直接读这些键 + guireng/wuxing 走顶层。
const LIURENG_FIELDS = [
	// 起课法：复用 LiuRengMain 导出的 QI_METHODS（25 法，值/名与排盘引擎同源，杜绝手写错值）。
	// 起课时间算法(缺省真太阳时 = 后端历来写死的口径,剪枝后字节零回归);
	// 与页面新控件同键同域,选「直接时间」即与三式合一六壬层(时柱取自吃 timeAlg 的奇门)同口径。
	// 三式合一子组里它属 SANSHI_SHARED_TIME_KEYS,由奇门那份统一呈现,故此处不会出现重复齿轮。
	{ name: 'timeAlg', label: '起课时间算法', type: 'select', default: 0, group: '起课', options: [
		{ value: 0, label: '真太阳时（默认）' }, { value: 1, label: '直接时间' },
	] },
	{ name: 'castMethod', label: '起课法', type: 'select', default: 'zheng', group: '起课',
		options: LIUREN_QI_METHODS.map((m)=>({ value: m.key, label: m.name })) },
	// 选时支：仅 castMethod='xuanshi' 时有效（条件揭示，避免"对不上"）。默认 ''=用占时支（LiuRengMain:3944 兜底=现状）。
	{ name: 'xuanShiZhi', label: '选时·事发支', type: 'select', default: '', group: '起课',
		showWhen: (d)=>d && d.castMethod === 'xuanshi',
		options: [{ value: '', label: '默认（用占时支）' }, ...DIZHI_12.map((zi)=>({ value: zi, label: `${zi}时` }))] },
	// 演数/报数：castMethod='yanshu'(加时) 或 'baoshu'(÷12定支) 时有效。默认 ''=引擎兜底（现状）。
	{ name: 'yanShuNum', label: '演数/报数', type: 'text', default: '', group: '起课',
		showWhen: (d)=>d && (d.castMethod === 'yanshu' || d.castMethod === 'baoshu') },
	{ name: 'yueJiangMethod', label: '换将', type: 'select', default: 'zhongqi', group: '起课', options: [
		{ value: 'zhongqi', label: '中气过宫（默认）' },
		{ value: 'jieqi', label: '节气换将' },
		{ value: 'richan', label: '太阳过宫·日躔（含岁差）' },
	] },
	{ name: 'fenZhouYe', label: '分昼夜', type: 'select', default: 'chenhun', group: '起课', options: [
		{ value: 'chenhun', label: '晨昏分昼夜（默认）' },
		{ value: 'maoyou', label: '卯酉分昼夜' },
		{ value: 'yinshen', label: '寅申分昼夜' },
	] },
	// 涉害取舍流派(默认 app=仅下贼上,已固定)。snapshot 仅非默认时记。
	{ name: 'seHaiMethod', label: '涉害取舍', type: 'select', default: 'app', group: '起课', options: [
		{ value: 'app', label: '仅下贼上(默认)' },
		{ value: 'standard', label: '标准深浅两向' },
		{ value: 'mengzhongji', label: '直取孟仲季' },
	] },
	{ name: 'seHaiBoundary', label: '涉害起讫', type: 'select', default: 'app', group: '起课', options: [
		{ value: 'app', label: '计起点不计本家(默认)' },
		{ value: 'both', label: '两端皆计' },
		{ value: 'neither', label: '皆不计' },
	] },
	{ name: 'shiRuKe', label: '始入课', type: 'select', default: false, group: '起课', options: [
		{ value: false, label: '并入重审(默认)' },
		{ value: true, label: '单列·九法变十法' },
	] },
	{ name: 'yearShenShaSort', label: '年神排序', type: 'select', default: 'sanyuan', group: '取神', options: [
		{ value: 'sanyuan', label: '四利三元序(默认)' },
		{ value: 'suigui', label: '太岁排轮(太阴异)' },
	] },
	// 只在「六壬法贵人」(guireng=0)下起作用(页面同条件置灰;三式合一同)
	{ name: 'yinyangSystem', label: '昼夜阳阴归属', type: 'select', default: 'danmu', group: '取神', showWhen: (d)=>Number(d.guireng) === 0, options: [
		{ value: 'danmu', label: '旦暮系(默认)' },
		{ value: 'yinyang', label: '星历阳阴系' },
	] },
	{ name: 'tuWangShuai', label: '土旺衰', type: 'select', default: 'siji', group: '取神', options: [
		{ value: 'siji', label: '四季月土旺(默认)' },
		{ value: 'huotu', label: '火土同宫(土随火)' },
	] },
	// 占事类型:builder 据它产 [占断向导] 整段(主用神/落点/宜忌/三传提示)。默认 general=现状。
	{ name: 'zhanCategory', label: '占事类型', type: 'select', default: 'general', group: '取神',
		options: ZHANDUAN_CATEGORIES.map((c)=>({ value: c.key, label: c.name })) },
	{ name: 'guireng', label: '贵人体系', type: 'select', default: 2, group: '取神', options: [
		{ value: 2, label: '星占法贵人（默认）' },
		{ value: 0, label: '六壬法贵人' },
		{ value: 1, label: '遁甲法贵人' },
		{ value: 3, label: '甲戊兼牛羊' },
		{ value: 4, label: '干合阳阴贵' },
	] },
	// 页面缺省随日干五行(起课回包按日干切,用户手选后才钉住):缺省 'auto' 剪掉不下发 → 重算按本课日干现算,与页面同源
	// (此前无头兜底写死「土」,日干非土时「起课时间」挂载与页面两张十二长生表;金口诀早已同样改过)。
	// 存档事盘恒带页面当时已解析的五行,基线即存档值。档名取六壬页原文(LRConst.WuXing 同序)。
	{ name: 'wuxing', label: '十二长生', type: 'select', default: 'auto', group: '取神', options: [
		{ value: 'auto', label: '自动（随日干五行）' },
		...LR_WUXING.map((w)=>({ value: w.elem, label: `十二长生：${w.elem}--${w.ganzi}` })),
	] },
];

// 金口诀：regenerateJinkouSnapshot / generateCaseTechniqueSnapshot 读 payload.{diFen,guireng,wuxing}（顶层）。
const JINKOU_FIELDS = [
	// 地分：取课基准。默认 sentinel 'auto'（按占时支）——而非具体地支。
	// 坑修：若默认写「子」，用户显式选「子」会因 '子'==='子' 被 prune 丢弃 → regen 落 resolveJinKouDiFen 首分支的占时支，
	// 齿轮显「子」实际却用时支、且永远钉不成「子」。改 sentinel 后：
	//   - 默认 'auto' → prune 丢弃 → payload.diFen 缺省 → regen 的 resolveJinKouDiFen 首分支 currentZi='' → 回退占时支(=现状)。
	//   - 选具体地支(≠'auto') → prune 保留 → payload.diFen 落 currentZi → 真钉该地分。
	// regen 无需改（resolveJinKouDiFen 首分支「currentZi || timeBranch」：有则用、缺则时支；normalizeZiFromText('auto')='' 不会误判）。
	{ name: 'diFen', label: '地分', type: 'select', default: 'auto', group: '课式',
		options: [{ value: 'auto', label: '自动（按占时支）' }, ...DIZHI_12.map((zi)=>({ value: zi, label: zi }))] },   // 档名与金口诀页同
	// 贵神体系：默认 0（六壬法贵人）=== JinKouMain state.guireng:0（修原 schema 误标默认 2 → prune 误判持久化的 bug）。
	// 页面本身锁 0（左栏无此控件，参考典籍亦无「遁甲法/星占法贵人」之目），故 1/2 只在
	// 挂载快照里生效、与页面所见不一致 —— 标签明示，避免用户以为改了它页面会跟着变。
	// 流派差异请改用「贵人昼夜表」（实务派 / 大六壬古法），那一档页面与快照同步。
	{ name: 'guireng', label: '贵神体系', type: 'select', default: 0, group: '取神', options: [
		{ value: 0, label: '六壬法贵人（默认，与页面一致）' },
		{ value: 2, label: '星占法贵人（仅快照，页面不变）' },
		{ value: 1, label: '遁甲法贵人（仅快照，页面不变）' },
	], optionShown: (o)=>`${o.value}` === '0' },   // 页面锁六壬法:另两档只在存档已是它们时列出
	// 页面真实缺省是「随日干五行」(state.wuxingAuto=true),此处此前写死「土（默认）」
	// → 日干非土时,「起课时间」挂载出来的十二长生段与页面两张表。改 'auto' 为缺省(prune 丢弃 →
	// regen 按课的日干现算,与页面同源);存档事盘恒带页面当时已解析的 wuxing,走不到此档。
	{ name: 'wuxing', label: '十二长生五行', type: 'select', default: 'auto', group: '取神', options: [
		{ value: 'auto', label: '自动（随日干五行）' },
		...LR_WUXING.map((w)=>({ value: w.elem, label: `${w.elem}·${w.ganzi}` })),   // 档名与金口诀页同
	] },
	// 月将 / 占时：regen 透传给 buildJinKouData（已加 opt.yueJiang/opt.zhanShi 覆盖逻辑）→ 改将神/贵神落位，真改快照。
	// 默认 'auto'（按节气取月将 / 按时支取占时）=== JinKouMain state，缺省经 prune 丢弃 → 字节级一致。
	{ name: 'yueJiang', label: '月将', type: 'select', default: 'auto', group: '课式', options: [
		{ value: 'auto', label: '自动（默认）' },
		...DIZHI_12.map((zi)=>({ value: zi, label: zi })),
	] },
	{ name: 'zhanShi', label: '占时', type: 'select', default: 'auto', group: '课式', options: [
		{ value: 'auto', label: '自动（默认）' },
		...DIZHI_12.map((zi)=>({ value: zi, label: zi })),
	] },
	// 流派 / 盘法（J2）：regenerateJinkouSnapshot 已透传 payload.{schoolYueJiang,schoolGuiTable,schoolGuiPan,panShi}
	// 给 buildJinKouData（缺省 undefined → 内部默认派 = 现状,零回归）。默认值 === JinKouMain state，缺省经 prune 丢弃 → 字节级一致。
	{ name: 'schoolYueJiang', label: '月将换将', type: 'select', default: 'zhongqi', group: '流派', options: [
		{ value: 'zhongqi', label: '中气换将（默认）' },
		{ value: 'jiaojie', label: '交节即换' },
	] },
	{ name: 'schoolGuiTable', label: '贵人昼夜表', type: 'select', default: 'shiwu', group: '流派', options: [
		{ value: 'shiwu', label: '实务派（默认）' },
		{ value: 'liuren', label: '六壬古法' },
	] },
	{ name: 'schoolGuiPan', label: '起贵神盘', type: 'select', default: 'di', group: '流派', options: [
		{ value: 'di', label: '地盘法（默认）' },
		{ value: 'tian', label: '天盘法' },
	] },
	{ name: 'panShi', label: '盘式', type: 'select', default: 'yang', group: '流派', options: [
		{ value: 'yang', label: '传统阳盘（默认）' },
		{ value: 'yin', label: '阴盘·旺衰' },
	] },
	// 土之十二长生两派：默认「水土同宫」(申)＝现状；「火土同宫」(寅) 为少数派。
	// 只改十二长生表与阴盘长生打分，起盘四位不动；缺省经 prune 丢弃 → 字节级零回归。
	{ name: 'soilChangSheng', label: '土长生', type: 'select', default: 'shen', group: '流派', options: [
		{ value: 'shen', label: '水土同宫·申（默认）' },
		{ value: 'yin', label: '火土同宫·寅' },
	] },
	// 专题起式（B3/B4）：regenerateJinkouSnapshot 透传 payload.{topicKey,shiJianKind}
	// 给 buildJinKouData → 快照追加 [专题起式] 段。缺省 ''＝不选＝整段不产，经 prune 丢弃 → 字节级零回归。
	{ name: 'topicKey', label: '专题', type: 'select', default: '', group: '专题', options: [
		{ value: '', label: '不用（默认）' },
		{ value: 'yunyu', label: '测孕育' },
		{ value: 'xuntiangang', label: '寻天罡·失物' },
		{ value: 'jiazhai', label: '测家宅' },
		{ value: 'guijian', label: '测贵贱' },
		{ value: 'banzhi', label: '测瘢痣' },
		{ value: 'dajing', label: '测打井' },
		{ value: 'fujiashi', label: '复加时·十二方位' },
	] },
	// 合占扣题(所问类别/问事时段):[合占扣题与内外] 段消费;默认 未限定/常规 = 现状零回归。
	{ name: 'askKey', label: '所问类别', type: 'select', default: '', group: '专题',
		options: [{ value: '', label: '未限定（默认）' }, ...JINKOU_ASK_OPTIONS_M] },
	{ name: 'timeScope', label: '问事时段', type: 'select', default: 'default', group: '专题',
		options: JINKOU_TIME_OPTIONS_M },
	{ name: 'shiJianKind', label: '测年月日', type: 'select', default: '', group: '专题', options: [
		{ value: '', label: '不用（默认）' },
		{ value: 'year', label: '测一年' },
		{ value: 'month', label: '测一月' },
		{ value: 'day', label: '测一日' },
	] },
	// 本命属相 / 行年虚岁不入 schema：二者由「问测人出生时间」单一真值源派生（页面与还原路径同律），
	// 放成可手填就会出现「设置里填兔、出生档是龙」谁说了算的分叉，故只读不设。
	// 时间基准:重算按它取四柱 / 占时的时间算法(regenerateJinkouSnapshot → /liureng/gods 带 timeAlg),与页面同一口径;
	// 缺省直接时间 = 页面缺省。两档与金口诀页同(直接时间 / 真太阳时,与太乙页同一份档名)。
	{ name: 'timeBasis', label: '时间基准', type: 'select', default: 'direct', group: '课式', options: TAIYI_TIME_BASIS_OPTIONS },
];

// 六爻:卦与动爻取自已存起卦结果(payload.gua),恒不重起 —— 以下全为判读口径,经
// payload.liuyaoSettings(optionsPath)→ mergeLiuyaoGearSettings 与存档 gua.liuyaoSettings 合并后
// buildGuaSnapshotText 重算判读层(analyzeLiuyao 前两参恒取冻结卦,数学上不可能改卦象)。
// 默认 = DEFAULT_LIUYAO_SETTINGS 等价值 → prune 全剪 = 现状零回归。
// 不登五键:coinFace(起卦输入)/writeDir(装卦表行序)/biangua(中栏页签)/changshengUse/changshengYinYang(纯中右栏显示,不入快照)。
const LY_BOOL = (v)=>(v === true || v === 1 || v === '1');
const SIXYAO_FIELDS = [
	// 与页面同:「自定义」与不单列的流派(旧事盘的「卜筮正宗」,与通用逐项相同)只在现值是它时补一项显示名,下拉不露内部键名
	{ name: 'school', label: '流派预设(切换即套该派细项)', type: 'select', default: 'default', group: '流派与用神',
		options: [
			...LIUYAO_SCHOOL_OPTIONS.map((o)=>({ value: o.value, label: o.label })),
			{ value: 'custom', label: '自定义' },
			...Object.keys(LIUYAO_PRESETS).filter((k)=>LIUYAO_PRESETS[k].hidden).map((k)=>({ value: k, label: LIUYAO_PRESETS[k].label })),
		],
		optionShown: (o)=>o.value !== 'custom' && !(LIUYAO_PRESETS[o.value] && LIUYAO_PRESETS[o.value].hidden) },
	{ name: 'askType', label: '占测事项(用神取用)', type: 'select', default: 'self', group: '流派与用神',
		options: YONGSHEN_CATEGORIES.map((c)=>({ value: c.key, label: c.label })) },
	{ name: 'yongOverride', label: '用神(手选)', type: 'select', default: '', group: '流派与用神',
		options: [{ value: '', label: '自动(跟占测事项)' }, ...['父母', '兄弟', '子孙', '妻财', '官鬼', '世', '应'].map((k)=>({ value: k, label: k }))] },
	{ name: 'benming', label: '本命(年支)', type: 'select', default: '', group: '流派与用神',
		options: [{ value: '', label: '不用（默认）' }, ...DIZHI_12.map((z)=>({ value: z, label: z }))] },
	{ name: 'tuChangsheng', label: '土长生', type: 'select', default: 'water', group: '取法', options: [
		{ value: 'water', label: '水土同宫（默认）' }, { value: 'fire', label: '火土同宫' }, { value: 'off', label: '不标长生' },
	] },
	{ name: 'bianyaoScope', label: '变爻范围', type: 'select', default: 'traditional', group: '取法', options: [
		{ value: 'traditional', label: '传统(回头本位)（默认）' }, { value: 'blind', label: '盲派(作用他爻)' },
	] },
	{ name: 'fushen', label: '飞伏', type: 'select', default: 'missing', group: '取法', options: [
		{ value: 'missing', label: '仅缺用神取（默认）' }, { value: 'all', label: '逐爻全标' },
	] },
	{ name: 'yuepoMode', label: '月破', type: 'select', default: 'inMonth', group: '取法', options: [
		{ value: 'inMonth', label: '当月有效（默认）' }, { value: 'always', label: '不论出月' },
	] },
	{ name: 'shishen', label: '世身', type: 'select', default: 'off', group: '取法', options: [
		{ value: 'off', label: '不用（默认）' }, { value: 'standard', label: '子午持世身居初' }, { value: 'lichunfeng', label: '亥子持世身居初' },
	] },
	// 页面上这项是「考据声明项」并已置灰(纳甲动变结构中不存在戌↔丑的本变对,两口径在一切实卦
	// 中输出恒同,金标 liuyaoOptionMatrixAudit 锁此事实)。齿轮面无置灰位,故把同一声明写进标签,避免「可拨无说明」。
	{ name: 'jinTuiTu', label: '进退神土路（考据声明项：纳甲无戌↔丑本变对，两档输出恒同）', type: 'select', default: 'chain', group: '取法', options: [
		{ value: 'chain', label: '丑辰未戌连环（默认）' }, { value: 'break', label: '戌丑断开' },
	] },
	{ name: 'tianshiSchool', label: '天时占法', type: 'select', default: 'fumu', group: '取法', options: [
		{ value: 'fumu', label: '通行(父母雨子孙晴)（默认）' }, { value: 'ancient', label: '古法多套(五家分列)' },
	] },
	{ name: 'yearBoundary', label: '定年界线(年支神煞源)', type: 'select', default: 'lichun', group: '取法', options: [
		{ value: 'lichun', label: '立春换岁（默认）' }, { value: 'lunar', label: '正月初一' },
	] },
	{ name: 'guashen', label: '卦身', type: 'switch', options: ON_OFF, default: true, group: '显示项', normalize: LY_BOOL },
	{ name: 'sixGods', label: '六神', type: 'switch', options: ON_OFF, default: true, group: '显示项', normalize: LY_BOOL },
	{ name: 'yuqi', label: '余气', type: 'switch', options: ON_OFF, default: false, group: '显示项', normalize: LY_BOOL },
	{ name: 'yingqi', label: '应期', type: 'switch', options: ON_OFF, default: true, group: '显示项', normalize: LY_BOOL },
	// 原标签「断诀命中/占类断语」大于实现:此闸只控 analyzeLiuyao 的 duanJue(通例命中),
	// 而 [占类断语] 段的断语摘要/历史占例/天时分列随卦恒出、三层环境与世应属核心内容也不受它控。
	// 按「标签只许等于实现」缩回实况(输出零变化)。
	{ name: 'doctrine', label: '断诀命中(通例;占类断语恒随卦出)', type: 'switch', options: ON_OFF, default: true, group: '显示项', normalize: LY_BOOL },
	{ name: 'gufa', label: '古法进阶', type: 'switch', options: ON_OFF, default: false, group: '显示项', normalize: LY_BOOL },
	{ name: 'yueLiushen', label: '月建六神', type: 'switch', options: ON_OFF, default: false, group: '显示项', normalize: LY_BOOL },
	{ name: 'guirenFa', label: '贵人歌诀', type: 'select', default: 'standard', group: '神煞', options: [
		{ value: 'standard', label: '甲戊庚牛羊(庚丑未)' }, { value: 'geng_ma_hu', label: '庚辛逢马虎(庚寅午)' }] },
	{ name: 'shenshaOn', label: '基础神煞', type: 'switch', options: ON_OFF, default: true, group: '神煞', normalize: LY_BOOL },
	{ name: 'shenshaBase', label: '神煞起例', type: 'select', default: 'day', group: '神煞',
		showWhen: (d)=>LY_BOOL(d.shenshaOn === undefined ? true : d.shenshaOn),
		options: [{ value: 'day', label: '以日干支起（默认）' }, { value: 'year', label: '以年干支起' }] },
	{ name: 'shenshaSet', label: '基础神煞集', type: 'multiselect', default: DEFAULT_SHENSHA_SET.slice(), group: '神煞',
		showWhen: (d)=>LY_BOOL(d.shenshaOn === undefined ? true : d.shenshaOn),
		options: SHENSHA_META.map((m)=>({ value: m.name, label: m.name })) },
	// 扩展神煞只暴露总开关:set=null 语义为「启用即全选」,逐项清单留页面弹窗(内容型多选不进齿轮)。
	{ name: 'shenshaExOn', label: '扩展神煞(断易天机)', type: 'switch', options: ON_OFF, default: false, group: '神煞', normalize: LY_BOOL },
];

// 卜卦盘 / 择日盘：类别 topicId。regenerate 透传 options.topicId（缺省=现状）。
// 复用各自主页面权威常量（HORARY_CATEGORIES 20 类 / ELECTION_TOPICS 26 类），杜绝手写错值——
// 原 schema 仅列 8/6 类且含不存在的假值（horary 'lost' 实为 'theft'；election 'construction/medical' 实为 'renovation/surgery'）。
// 判读参数(卜卦专属,HORARY_PARAM_SPEC scope='horary' 单源自动扩):齿轮扁平键 hp_<key>,
// 默认 '' = 随流派(prune 剪掉,四层优先级回落流派/全局/内建 = 现状);switch 型以 1/0 显式覆盖。
// regenerateHorarySnapshot 解码 hp_* → horaryJudgeOpts 第二参(与页面「判读参数」面板同层级)。
// 判读参数自带的「空串」档(问者性别「不指定」、同主一星「不特别处置」)与齿轮的「随流派」哨兵撞值:齿轮里改用这个值表达它,
// 解码时映射回空串;存档里显式存的空串展平成它(flattenHoraryStored)。开关型存档是布尔,齿轮归一成 1/0
export const HORARY_JUDGE_EMPTY = '__none';
const HORARY_SWITCH_NORMALIZE = (v)=>(v === '' || v === undefined || v === null ? '' : ((v === true || v === 1 || v === '1' || v === 'true') ? 1 : 0));
// 齿轮判读键(hp_<键>)是不是「这一问」的键(换派保留;单源 HORARY_QUESTION_SCOPED_KEYS)
function horaryJudgeFieldQuestionScoped(f){ return !!f && HORARY_QUESTION_SCOPED_KEYS.indexOf(`${f.name}`.replace(/^hp_/, '')) >= 0; }
const HORARY_JUDGE_FIELDS = HORARY_PARAM_SPEC
	.filter((sp)=>sp.scope === 'horary')
	.map((sp)=>({
		name: 'hp_' + sp.key,
		label: `判读·${sp.label}`,
		type: 'select',
		default: '',
		// 空档 =「随流派」:只记亲手改动键的宿主选回它时删键,不存空串 —— 存下的空串在重算里是「去掉案例存档这一项」
		blankMeansFollowSchool: true,
		// 只记亲手键的宿主里同时选了流派:与案例流派不同的案例换派后存档逐项覆盖整组作废(horaryGearSchoolChanged),随所选流派
		unsetBlankLabel: (d)=>((d && Array.isArray(d.__unsetKeys) && d.__unsetKeys.indexOf('horarySchool') < 0 && d.horarySchool)
			? '不设（案例流派与所选相同 = 随案例存档；不同 = 随所选流派）' : null),
		group: `判读参数·${sp.group || '其他'}`,
		...(sp.type === 'switch' ? { normalize: HORARY_SWITCH_NORMALIZE } : {}),
		// 「撤回含换座变体」是「撤回作独立破坏」的子开关(页面同:母开关实际为关时置灰)—— 母开关实际值 = 齿轮显式值,否则随流派 / 全局
		...(sp.key === 'refranationIncludeSignChange' ? { showWhen: (d)=>{
			const own = HORARY_SWITCH_NORMALIZE(d && d.hp_refranationAsDestruction);
			if(own !== ''){ return own === 1; }
			try{ return !!horaryJudgeOpts(d && d.horarySchool, null, judgeLayerOverrides()).refranationAsDestruction; }catch(_e){ return true; }
		} } : {}),
		options: sp.type === 'switch'
			? [{ value: '', label: '随流派（默认）' }, { value: 1, label: '开' }, { value: 0, label: '关' }]
			: [{ value: '', label: '随流派（默认）' }, ...((sp.options || []).map((o)=>({ value: o.value === '' ? HORARY_JUDGE_EMPTY : o.value, label: o.label })))],
	}));
// 卜卦存档没写流派 = 页面默认档(经典主流);判断「换没换派」两边都按它补齐,否则存档缺流派时选经典主流也被当成换派
const horarySchoolOrDefault = (v)=>(v === undefined || v === null || v === '' ? 'classical' : `${v}`);
const HORARY_FIELDS = [
	{ name: 'topicId', label: '问题类别', type: 'select', default: 'general', group: '裁决', options: HORARY_CATEGORIES },
	// 卜卦流派(horarySchools 七档;默认经典主流=页面默认口径)。储存记录另经 payload.extra.horarySchool 自动还原。
	// 扩档:文艺复兴(1647 基线)/序列判读(无-orb)——与 UI 档同键同名。
	{ name: 'horarySchool', label: '流派', type: 'select', default: 'classical', group: '裁决', blankFollowsBaseline: true, options: [   // 空串 / null = 没设(随存档)
		{ value: 'classical', label: '经典主流' },
		{ value: 'renaissance', label: '文艺复兴' },
		{ value: 'strict', label: '当代严谨' },
		{ value: 'sequence', label: '序列判读' },
		{ value: 'hellenistic', label: '希腊化' },
		{ value: 'medieval', label: '中世纪' },
		{ value: 'modern', label: '现代心理' },
	] },
	...HORARY_JUDGE_FIELDS,
	// questionText/castingCamp/定盘自评 = 逐案内容非排盘口径(faRelatedPeople 同理),不入齿轮;
	// regenerate 已随存档 extra 回放([定盘考量] 段与 radicality 保真)。
];
// 择日流派口径 13 键(ELECTION_PARAM_SPEC 单源):齿轮扁平键 ep_<key>,'' = 随流派(现状)。
const ELECTION_PARAM_FIELDS = ELECTION_PARAM_SPEC.map((sp)=>({
	name: 'ep_' + sp.key,
	label: `口径·${sp.label}`,
	type: 'select',
	default: '',
	blankMeansFollowSchool: true,   // 同卜卦 hp_*:只记亲手键的宿主选回空档时删键
	group: `流派口径·${sp.group || '其他'}`,
	options: [{ value: '', label: '随流派（默认）' }, ...((sp.options || []).map((o)=>({ value: o.value, label: o.label })))],
}));
// 卜卦/择日盘存档层 → schema 字段名展平(供 baselineSource;齿轮 merge 仍写 payload 顶层扁平键,重算读顶层优先于 extra)。
// 六爻存档层 gua.liuyaoSettings(神煞为嵌套 shensha:{on,base,set} / shenshaEx:{on,set})→ 展平成 schema 四扁平键
// (mergeLiuyaoGearSettings 的反向;此前基线直接返回嵌套对象 → 四键恒缺 → 存「新派/盲派」神煞预设的事盘在挂载里开/关神煞被剪)。
export function flattenLiuyaoStored(payload){
	const ls = payload && payload.gua && typeof payload.gua === 'object' && payload.gua.liuyaoSettings && typeof payload.gua.liuyaoSettings === 'object'
		? payload.gua.liuyaoSettings : null;
	if(!ls){ return null; }
	const out = { ...ls };
	const ss = ls.shensha && typeof ls.shensha === 'object' ? ls.shensha : null;
	if(ss){
		if(ss.on !== undefined){ out.shenshaOn = !!ss.on; }
		if(ss.base !== undefined && ss.base !== null){ out.shenshaBase = ss.base; }
		if(Array.isArray(ss.set)){ out.shenshaSet = ss.set.slice(); }
	}
	const ex = ls.shenshaEx && typeof ls.shenshaEx === 'object' ? ls.shenshaEx : null;
	if(ex && ex.on !== undefined){ out.shenshaExOn = !!ex.on; }
	return out;
}
// payload.options 打底 + 顶层扁平键覆盖(kentang 报数法四技法通用)。
// 太乙流派六轴:存档是对象(独立太乙 options.school / 三式合一 options.taiyiSchool),齿轮是平铺键(school_* / taiyiSchool_*);
// 基线把对象摊平成齿轮键 —— 此前按平铺键取 → 存了非默认流派的事盘抽屉显示「默认」,拨回默认被剪掉(重算仍按存档流派)。
export function flattenTaiyiSchoolStored(payload, objKey, prefix){
	const p = payload && typeof payload === 'object' ? payload : {};
	const oo = p.options && typeof p.options === 'object' ? p.options : {};
	const out = { ...oo };
	const sch = oo[objKey];
	if(sch && typeof sch === 'object'){
		Object.keys(sch).forEach((k)=>{ if(out[prefix + k] === undefined){ out[prefix + k] = sch[k]; } });
	}
	return out;
}

export function flattenOptionsStored(payload){
	const p = payload && typeof payload === 'object' ? payload : {};
	const oo = p.options && typeof p.options === 'object' ? p.options : {};
	const out = { ...oo };
	Object.keys(p).forEach((k)=>{ if(k !== 'options' && k !== 'snapshot' && k !== 'module' && k !== 'pan' && k !== 'fieldSnapshot' && p[k] !== undefined && p[k] !== null && typeof p[k] !== 'object'){ out[k] = p[k]; } });
	return out;
}

// 塔罗:存档的判读设置住 payload.options.settings(开关存 true / false),齿轮的扁平键覆盖在 payload.options 顶层。
// 基线 = 覆盖层 > 存档 settings(开关 → 1 / 0;不在齿轮档里的值按「随档」)> 随档 —— 抽屉显示存档实际所用,
// 显示条件(尊位版本随元素尊位、计时单位随计时法)也看得见存档值(此前只看齿轮键,随档时永远不出)。
export function flattenTarotStored(payload){
	const o = payload && payload.options && typeof payload.options === 'object' ? payload.options : null;
	if(!o){ return null; }
	const st = o.settings && typeof o.settings === 'object' ? o.settings : {};
	const out = { ...o };
	const schema = TECHNIQUE_SETTINGS_SCHEMA.tarot;
	(schema && schema.fields || []).forEach((f)=>{
		if(out[f.name] !== undefined && out[f.name] !== null && out[f.name] !== ''){ return; }
		let v = st[f.name];
		if(typeof v === 'boolean'){ v = v ? 1 : 0; }
		if(v === undefined || v === null || v === ''){ return; }
		if((f.options || []).some((x)=>`${x.value}` === `${v}`)){ out[f.name] = v; }
	});
	return { ...out, ...tarotCorrespondenceContext(o) };
}

// 塔罗「显示进阶对应」进齿轮:字母 / 路径变体、现代行星注、宫廷两体系四项在页面上只在进阶对应开着时出现
// (变体与现代行星注另要牌组有变体能力),关着时占象按缺省口径算(cardSchema.correspondenceView)。
// 齿轮没有这个开关,开不开由存档决定:牌组 = 存档 deckId(缺 = 缺省牌组),开关 = 存档 settings.showCorrespondences,
// 缺键按 resolveSettings 随牌组缺省 —— 与重算(buildReading)、页面同一条;判据调 correspondenceOverlayOn,不另写。
// 结果作只读上下文键(以 __ 开头,见 mountContextOf)随基线带给显隐判据。
function tarotCorrespondenceContext(options){
	const o = options && typeof options === 'object' ? options : {};
	const st = o.settings && typeof o.settings === 'object' ? o.settings : {};
	const deck = getTarotDeck(o.deckId || TAROT_DEFAULT_DECK);
	const caps = (deck && deck.caps) || {};
	const on = !!deck && tarotCorrespondenceOverlayOn(caps, resolveTarotSettings(deck, st).showCorrespondences);
	return { __tarotCorrespondenceOn: on ? 1 : 0, __tarotCorrespondenceVariant: on && caps.variant ? 1 : 0 };
}
// 只读上下文键的说明(AI 工具报「此刻不显示,由谁决定」时用;键名本身不给人看)
const MOUNT_CONTEXT_LABELS = {
	__tarotCorrespondenceOn: '本盘存档的「显示进阶对应」关着',
	__tarotCorrespondenceVariant: '本盘存档的「显示进阶对应」关着或牌组没有变体',
};
export function mountContextLabel(key){
	return MOUNT_CONTEXT_LABELS[key] || '';
}
// 显隐:取不到存档(同类默认 / 模板编辑这类不对应某张盘的宿主)时照出;取到时按存档的门控
const tarotCorrespondenceShown = (ctxKey)=>(d)=>{
	const v = d ? d[ctxKey] : undefined;
	return v === undefined || v === null || `${v}` === '1';
};

export function flattenHoraryStored(payload){
	const p = payload && typeof payload === 'object' ? payload : {};
	const ex = p.extra && typeof p.extra === 'object' ? p.extra : {};
	const out = {};
	const topic = p.topicId || p.questionCategory || ex.topicId || ex.questionCategory;
	if(topic){ out.topicId = topic; }
	// 存档流派(没存流派按存档宫制反推,与页面同一判据):抽屉显示的是这张盘实际按的流派,选它不算换派
	if(ex.horarySchool || (p.settings && typeof p.settings === 'object' && p.settings.hsys !== undefined && p.settings.hsys !== null && p.settings.hsys !== '')){ out.horarySchool = horaryStoredSchool(p); }
	const ov = ex.horaryOverrides && typeof ex.horaryOverrides === 'object' ? ex.horaryOverrides : {};
	// 显式存的空串档(「不指定」「不特别处置」)= 齿轮的 HORARY_JUDGE_EMPTY,不是「随流派」
	Object.keys(ov).forEach((k)=>{ if(ov[k] !== undefined && ov[k] !== null){ out['hp_' + k] = ov[k] === '' ? HORARY_JUDGE_EMPTY : ov[k]; } });
	// 齿轮曾写过的顶层扁平键(hp_*/horarySchool)也是「现状」的一部分(覆盖层压存档层)。
	Object.keys(p).forEach((k)=>{ if(k === 'horarySchool' || k.indexOf('hp_') === 0){ if(p[k] !== undefined && p[k] !== null){ out[k] = p[k]; } } });
	return out;
}
export function flattenElectionStored(payload){
	const p = payload && typeof payload === 'object' ? payload : {};
	const ex = p.extra && typeof p.extra === 'object' ? p.extra : {};
	const out = {};
	const topic = p.topicId || ex.topicId;
	if(topic){ out.topicId = topic; }
	['westSchool', 'tradeSide', 'talismanStar', 'surgeryPart'].forEach((k)=>{ if(ex[k] !== undefined && ex[k] !== null && ex[k] !== ''){ out[k] = ex[k]; } });
	if(ex.surgeryPartOpposite !== undefined && ex.surgeryPartOpposite !== null){ out.surgeryPartOpposite = (ex.surgeryPartOpposite === true || ex.surgeryPartOpposite === 1 || ex.surgeryPartOpposite === '1') ? 1 : 0; }
	const ep = ex.electionParams && typeof ex.electionParams === 'object' ? ex.electionParams : {};
	Object.keys(ep).forEach((k)=>{ if(ep[k] !== undefined && ep[k] !== null && ep[k] !== ''){ out['ep_' + k] = ep[k]; } });
	Object.keys(p).forEach((k)=>{ if(['westSchool', 'tradeSide', 'talismanStar', 'surgeryPart', 'surgeryPartOpposite'].indexOf(k) >= 0 || k.indexOf('ep_') === 0){ if(p[k] !== undefined && p[k] !== null){ out[k] = p[k]; } } });
	return out;
}

const ELECTION_FIELDS = [
	{ name: 'topicId', label: '用事类型', type: 'select', default: 'marriage', group: '择日', options: ELECTION_TOPICS },
	// 西方子流派(westernSchools 五档;默认现代主流=零回归)。储存记录另经 payload.extra.westSchool 自动还原。
	{ name: 'westSchool', label: '西方流派', type: 'select', default: 'modern_main', group: '择日', options: [
		{ value: 'modern_main', label: '现代主流' },
		{ value: 'hellenistic', label: '希腊化' },
		{ value: 'persian', label: '波斯-阿拉伯' },
		{ value: 'renaissance', label: '文艺复兴' },
		{ value: 'modern_revival', label: '古典复兴' },
	] },
	...ELECTION_PARAM_FIELDS,
	// 事类专项(regenerate pick() 顶层优先已接;默认 '' = 不指定 = 现状):
	// 事类专项随用事类型出现(与择日页同:交易 / 护符 / 手术各自的专项控件只在该类下显示)
	{ name: 'tradeSide', label: '买卖方向（1宫=行事者）', type: 'select', default: '', group: '事类专项', showWhen: (d)=>d.topicId === 'trade', options: [
		{ value: '', label: '不指定（通用判据）' },
		{ value: 'sell', label: '售出——强己方（1宫主），令买家来你' },
		{ value: 'buy', label: '购入——强货主方（7宫主），所购有实' },
	] },
	{ name: 'talismanStar', label: '护符主星（护符类）', type: 'select', default: '', group: '事类专项', showWhen: (d)=>d.topicId === 'talisman', options: [
		{ value: '', label: '不指定（默认）' },
		...['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'].map((k)=>({ value: k, label: ({ sun: '太阳', moon: '月亮', mercury: '水星', venus: '金星', mars: '火星', jupiter: '木星', saturn: '土星' })[k] })),
	] },
	{ name: 'surgeryPart', label: '手术部位（星座主管）', type: 'select', default: '', group: '事类专项', showWhen: (d)=>d.topicId === 'surgery', options: [
		{ value: '', label: '不指定（默认）' },
		...SIGN_ORDER.map((sg)=>({ value: sg, label: `${SIGNS[sg].cn} · ${(SIGNS[sg].body_parts || []).join('/')}` })),
	] },
	{ name: 'surgeryPartOpposite', label: '部位禁忌延及对宫（诸家多延及，默认不延）', type: 'switch', options: ON_OFF, default: 0, group: '事类专项',
		normalize: (v)=>(v === true || v === 1 || v === '1'), showWhen: (d)=>d.topicId === 'surgery' && !!d.surgeryPart },
	// crisisBase(危象日基准)= 病始日期排盘派生对象(需取盘),属逐案数据非口径 → 不入齿轮,随存档 extra 回放。
];

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

const ASTRO_CHART_FIELDS = [
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
// 轨策齿轮字段名(联动钩子用;取 schema 本身,免得两处手抄)
function GUICE_FIELDS_NAMES(){
	const sc = TECHNIQUE_SETTINGS_SCHEMA.guice;
	return sc && Array.isArray(sc.fields) ? sc.fields.map((f)=>f.name) : [];
}
// 通书页保存的设置(合法流派才认,否则整份回缺省 —— 与页面载入同一函数)
function tongshuPageSetting(name){
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
const INDIA_CHART_FIELDS = [
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
];

// 主限法·表格（primarydirect）：列未来 pdYears 年全部 direction 行。方位法 + 时间换算 + 顺逆 + 映点/界 + pdYears
// （全部 === buildFieldObject 现状；无 datetime——表格是「年限范围」不是「单一时刻」）。
const PRIMARY_DIRECT_TABLE_FIELDS = [
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
const PRIMARY_DIRECT_CHART_FIELDS = [
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
const GUOLAO_FIELDS = [
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
const GERMANY_SCHOOL_PRESET_KEYS = ['orb', 'orbPersonal', 'showHouseFrames', 'strictFactors'];
export function germanySchoolPresetDraft(school){
	const p = uranianPresetForSchool(school);
	return { orb: p.orbMidpoint, orbPersonal: p.orbPersonal, showHouseFrames: p.showHouseFrames ? 1 : 0, strictFactors: p.strictFactors ? 1 : 0 };
}
const GERMANY_FIELDS = [
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
];


// 推运·三分主星：区间光体三分主星分掌人生阶段。builder buildTriplicityRulersSnapshotText(chartObj,opts) 已收 opts。
const TRIPLICITY_FIELDS = [
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

// 推运·Balbillus：起始星 / 年制 / 距离口径。builder buildBalbillusSnapshotText(chartObj,opts) 已收 opts。
// 显示名与页面同(AstroText 中文名:日 / 月 / 水…)
const SEVEN_PLANETS_OPTS = [AstroConst.SUN, AstroConst.MOON, AstroConst.MERCURY, AstroConst.VENUS, AstroConst.MARS, AstroConst.JUPITER, AstroConst.SATURN]
	.map((p)=>({ value: p, label: AstroText.AstroTxtMsg[p] || p }));
const BALBILLUS_FIELDS = [
	{ name: 'startPlanet', label: '起始星', type: 'select', default: BALBILLUS_DEFAULT_OPTS.startPlanet, group: '起运', options: SEVEN_PLANETS_OPTS },
	{ name: 'yearType', label: '年制', type: 'select', default: BALBILLUS_DEFAULT_OPTS.yearType, group: '起运',
		options: Object.keys(BALBILLUS_YEAR_TYPES).map((k)=>({ value: k, label: BALBILLUS_YEAR_TYPES[k].label })) },
	{ name: 'mode', label: '距离口径', type: 'select', default: BALBILLUS_DEFAULT_OPTS.mode, group: '起运',
		options: Object.keys(BALBILLUS_MODES).map((k)=>({ value: k, label: BALBILLUS_MODES[k] })) },
	{ name: 'subRule', label: '子限铺法', type: 'select', default: BALBILLUS_DEFAULT_OPTS.subRule, group: '起运',
		options: Object.keys(BALBILLUS_SUB_RULES).map((k)=>({ value: k, label: BALBILLUS_SUB_RULES[k] })) },
];

// 推运·界推运:发放点 / 时间算法 / 年长 / 年限(与页面同四项、同一请求键,builder 收 opts)。
const DISTRIBUTIONS_FIELDS = [
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
const AGEPOINT_FIELDS = [
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
const YEARSYSTEM129_FIELDS = [
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
const KEYPOINTS_FIELDS = [
	{ name: 'mode', label: '释放点', type: 'select', default: KEYPOINTS_DEFAULT_OPTS.mode, group: '释放',
		options: Object.keys(RELEASE_MODES).map((k)=>({ value: k, label: RELEASE_MODES[k] })) },
];

// 推运·黄道星释（zodiacal releasing）：推运基点(11) + 输出层级(L1全/L2/L3/L4) + 逐层钻取 idx。
// builder buildZodialReleaseSnapshotText(chartObj,opts) 加 opts 透传 basePoint→startSign + aiMode/idx 进 buildZRAISnapshot。
// 默认 福点 + L1 全列 + idx0 === 无头 builder 现状（缺省经 prune 丢弃 → 字节级一致）。
// 神数正传各流派专属项只在该流派下出现(与页面按流派分组显示同)
const zcSchoolIs = (school)=>(d)=>((d && d.zcSchool) || 'tieban') === school;
// 逐层钻取序号随输出层级出现(层级 = 所有 L1 时三个序号都不起作用;L2 在 L1 下 → 要 L1 序号;L3 在 L2 下 → L1/L2;L4 → 三个都要)
const AI_LEVEL_DEPTH = { l1_all: 0, l2_in_l1: 1, l3_in_l2: 2, l4_in_l3: 3 };
const aiLevelDepth = (d)=>AI_LEVEL_DEPTH[d && d.aiMode] || 0;
const AI_LEVEL_IDX_FIELDS = (l1Label)=>[
	{ name: 'aiL1Idx', label: l1Label, type: 'number', default: 0, min: 0, group: '输出', showWhen: (d)=>aiLevelDepth(d) >= 1 },
	{ name: 'aiL2Idx', label: '二级时段序号(第一段填 0)', type: 'number', default: 0, min: 0, group: '输出', showWhen: (d)=>aiLevelDepth(d) >= 2 },
	{ name: 'aiL3Idx', label: '三级时段序号(第一段填 0)', type: 'number', default: 0, min: 0, group: '输出', showWhen: (d)=>aiLevelDepth(d) >= 3 },
];
const ZODIAL_RELEASE_FIELDS = [
	{ name: 'basePoint', label: '推运基点', type: 'select', default: ZR_BASE_POINTS[0], group: '基点',
		options: ZR_BASE_POINTS.map((p)=>({ value: p, label: AstroText.AstroTxtMsg[p] || p })) },   // 显示名与页面同(中文名,不露英文键)
	{ name: 'aiMode', label: '输出范围', type: 'select', default: (ZR_AI_MODES[0] || {}).value, group: '输出', options: ZR_AI_MODES },
	...AI_LEVEL_IDX_FIELDS('一级时段序号(第一段填 0;输出到二~四级时用来定位)'),
];

// 推运·十年大运（decennials）：起运主星 + 分配次序 + 日限体系 + 时间口径 + 输出层级 + 逐层钻取。
// builder buildDecennialsSnapshotText(chartObj,opts) 加 opts 透传 settings + aiState。默认全部 === 无头 builder 现状。
const DECENNIALS_FIELDS = [
	{ name: 'startMode', label: '起运主星', type: 'select', default: (DECENNIALS_START_MODES[0] || {}).value, group: '起运', options: DECENNIALS_START_MODES },
	{ name: 'orderType', label: '分配次序', type: 'select', default: (DECENNIALS_ORDER_TYPES[0] || {}).value, group: '起运', options: DECENNIALS_ORDER_TYPES },
	{ name: 'dayMethod', label: '日限体系', type: 'select', default: (DECENNIALS_DAY_METHODS[0] || {}).value, group: '起运', options: DECENNIALS_DAY_METHODS },
	{ name: 'calendarType', label: '时间口径', type: 'select', default: (DECENNIALS_CALENDAR_TYPES[0] || {}).value, group: '起运', options: DECENNIALS_CALENDAR_TYPES },
	{ name: 'aiMode', label: '输出范围', type: 'select', default: (DECENNIALS_AI_MODES[0] || {}).value, group: '输出', options: DECENNIALS_AI_MODES },
	...AI_LEVEL_IDX_FIELDS('一级时段序号(第一段填 0)'),
];

// 推运·行星弧（planetary arc）：弧源(7 星) + 目标时刻 + 容许度。
// builder buildPlanetaryArcSnapshotText(chartObj,opts) 加 opts。默认 月亮/空(→today)/1 === 无头现状。
const PLANETARY_ARC_FIELDS = [
	{ name: 'arcSource', label: '弧源天体（月亮弧 / 行星弧）', type: 'select', default: ARC_SOURCES[0], group: '弧源',
		options: ARC_SOURCES.map((p)=>({ value: p, label: AstroText.AstroTxtMsg[p] || p })) },
	// P4：目标时刻改 datetime picker（空显示「此刻/今日」但 default 恒 ''，不破 prune）。
	{ name: 'targetDatetime', label: '目标时刻(空=今日)', type: 'datetime', default: '', group: '弧源' },
	// 档位与页面同一份(弧类:不列「双星容许度相加除以2」,与 1° 同结果)
	{ name: 'asporb', label: '行运星与本命星交角容许度', type: 'select', default: 1, normalize: (v)=>Number(v), options: directionAsporbOptions(true), group: '弧源', globalCurrent: ()=>{ try{ return require('../components/astro/AstroExtraCommon').transitOrbDefault(); }catch(e){ return 1; } } },   // 基线随全局 transitOrb
	// 南北交逆移:页面有、Python 也读,此前挂载表达不了(缺省关=无头现状零回归)。
	{ name: 'nodeRetrograde', label: '南北交逆移', type: 'switch', options: ON_OFF, default: 0, group: '弧源' },
	// P4 区间扫描：end 非空且 step 有值时，builder 循环多段（每段一个目标时刻）。
	...scanRangeDatetimeFields('区间扫描'),
];

// 推运·波斯向运（persian directed）：速率(波斯/Prophected/Naibod) + 方向(顺/逆) + 应期年数(50/90/120/150/200)。
// builder buildPersianDirectedSnapshotText(chartObj,opts) 加 opts。默认 persian/direct/90 === 无头现状。
const PERSIAN_DIRECTED_FIELDS = [
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
];

// 推运·恒星推运（vedic）/ 赤纬推运（jayne）：目标日期 + 时刻。
// builder buildVedicProgSnapshotText / buildJaynesProgSnapshotText 加 opts。默认 空(→today)/空(→12:00) === 无头现状。
const PROG_TARGET_FIELDS = [
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
const PREDICTIVE_PERIOD_BASE_FIELDS = [
	// P4：目标时刻改 datetime picker（空显示「此刻」但 default 恒 ''，不破 prune）。
	{ name: 'datetime', label: '目标时刻(空=此刻)', type: 'datetime', default: '', group: '目标' },
	// 「步进 tmType」已撤:页面/无头请求体恒送 'y',Java 不转发、Python 零消费,是全链死开关(不放无效选项)。
	// 档位与页面同一份;太阳弧走弧类口径(不列「双星容许度相加除以2」),见 solararc 条目
	{ name: 'asporb', label: '行运星与本命星交角容许度', type: 'select', default: 1, normalize: (v)=>Number(v), options: directionAsporbOptions(false), group: '目标', globalCurrent: ()=>{ try{ return require('../components/astro/AstroExtraCommon').transitOrbDefault(); }catch(e){ return 1; } } },
	{ name: 'nodeRetrograde', label: '南北交逆移', type: 'switch', options: ON_OFF, default: 0, group: '目标' },
	// P4 区间扫描：datetime 为起点、datetimeEnd 为终点，按 scanStep 循环多段（每段一个推运时点）。
	// 注：scanStep（区间步进）与上方 tmType（推运内部步进）是两个独立概念，互不冲突。
	...scanRangeDatetimeFields('区间扫描'),
];
// 小限页 G9 年/月/日小限 + 多起点(纯前端派生)进齿轮:选项与页面控件同源
// (utils/profectionSummary),缺省 年/上升 = 页面缺省 = 快照现状字节不变外加一段 [小限摘要]。
const PROFECTION_SUMMARY_FIELDS = [
	{ name: 'profGrain', label: '小限粒度', type: 'select', options: PROFECTION_GRAIN_OPTIONS, default: 'y', group: '小限摘要' },
	{ name: 'profStart', label: '小限起点', type: 'select', options: PROFECTION_START_OPTIONS, default: 'asc', group: '小限摘要' },
];
// returns 型(返照)异地经纬：默认空 → 回退本命经纬(=现状,与各 Return 组件 dirLat=natal 一致)。
const PREDICTIVE_RETURN_DIR_FIELDS = [
	{ name: 'dirLat', label: '返照地·纬度(空=本命)', type: 'text', default: '', group: '异地' },
	{ name: 'dirLon', label: '返照地·经度(空=本命)', type: 'text', default: '', group: '异地' },
	// dirZone(返照地时区):buildPredictivePeriodSnapshot:1575 已消费(o.dirZone||np.zone)、regen:1833 已透传 record.dirZone,
	// 仅此前漏建 schema 字段 → record.dirZone 恒 undefined 回退本命时区。补齐后异地返照三盘(solarreturn/lunarreturn/givenyear)时区可调。
	{ name: 'dirZone', label: '返照地·时区(空=本命)', type: 'text', default: '', group: '异地' },
];

// 三式合一：合并 六壬/奇门/太乙 三子组可调项。各子组 regen 均读 payload.options 的对应键（键名互不冲突）；
// regenerateSanshiUnifiedSnapshot 额外把 payload.options 作为 liureng 的 options 传入（补六壬子组缺口）。
// 共享时间键（timeAlg 仅奇门用；日界/晚子时奇门+太乙共用，同生辰本应一致）去重为一份置「时间换算」组。
const SANSHI_SHARED_TIME_KEYS = ['timeAlg', 'after23NewDay', 'lateZiHourUseNextDay'];
const reTagSanshi = (fields, prefix)=>fields
	.filter((f)=>!SANSHI_SHARED_TIME_KEYS.includes(f.name))
	.map((f)=>({ ...f, group: `${prefix}·${f.group || '设置'}` }));
// 三式合一的六壬层锁「正时正将」(页面不出起课法 / 选时 / 演数,pickSanshiLiurengCastOpts 同锁):齿轮不列这三项,重算也按正时正将
// 三式合一页没有这几项控件(起课恒正时正将;占事类型 / 十二长生页面不设):齿轮不列,重算按页面固定口径
const SANSHI_LIURENG_LOCKED_KEYS = ['castMethod', 'xuanShiZhi', 'yanShuNum', 'zhanCategory', 'wuxing'];
// 🔴 太乙子组键名必须对齐三式合一页面存档:页面 state.options 用 taiyiStyle/taiyiAccum/taiyiSchema(对象),
// 而 TAIYI_FIELDS 用 style/tn/school_* —— 且 options.school 已被奇门盘式(字符串)占用、sex 与奇门共键(1/0)。
// 曾原名平铺 → 存过的三式合一事盘太乙盘式/公式/流派挂载重算全落默认(regenerateTaiyiSnapshot 双源读已配套)。
const SANSHI_TAIYI_RENAME = { style: 'taiyiStyle', tn: 'taiyiAccum', timeBasis: 'taiyiTimeBasis' };   // 三式太乙区已有同源控件,齿轮同名
const reTagSanshiTaiyi = (fields)=>fields
	.filter((f)=>!SANSHI_SHARED_TIME_KEYS.includes(f.name))
	// sex 与奇门共键(1/0 数字域,太乙侧 regenerate 归一为男/女)。timeBasis 不再过滤:三式太乙区已补同源控件(键 taiyiTimeBasis,缺省 direct)。
	.filter((f)=>f.name !== 'sex')
	.map((f)=>{
		const name = SANSHI_TAIYI_RENAME[f.name] || (f.name.indexOf('school_') === 0 ? `taiyiSchool_${f.name.slice(7)}` : f.name);
		// 合一盘式不承载太乙命法盘(页面不列命法,独立太乙页另有):不列命法档(已选者仍显示)
		const extra = f.name === 'style' ? { optionShown: (o)=>Number(o.value) !== 5 } : {};
		// 显示条件里的盘式键在合一页叫 taiyiStyle:映射回去再判
		if(typeof f.showWhen === 'function'){ const sw = f.showWhen; extra.showWhen = (d)=>sw({ ...(d || {}), style: d && d.taiyiStyle !== undefined ? d.taiyiStyle : (d && d.style) }); }
		return { ...f, ...extra, name, group: `太乙·${f.group || '设置'}` };
	});
// 宿占不消费的西占古典判读键(读路径核对:SuZhanMain.js buildHouseSuLines/computeAscSignIndex 只读宫位/赤经/宿名/时支)。
// 宿占的岁差:宿法 = 郑氏恒星制(档 4)时,后端把空档解作郑氏历元(perchart isZhengSidereal:显式档优先,空 = 郑氏),
// 任何显式档都不是郑氏 —— 这时空档是唯一能表达郑氏的值,不能当「随盘」剪掉(剪掉 = 回不到郑氏);标签也随之写明
const SUZHAN_ZHENG_SU28_MODE = 4;
const suzhanZhengSu28 = (d)=>Number(d && d.doubingSu28) === SUZHAN_ZHENG_SU28_MODE;
const SUZHAN_SIDEREAL_AYANAMSA_FIELD = (f)=>({
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
const SUZHAN_DEAD_CLASSICAL_KEYS = ['termsVariant', 'sectBuffer', 'leoBoundFirst', 'triplicity', 'lotReversal', 'lotsDocReverse', 'nodeExaltation',
	'geminiBoundEmended', 'cazimiOrb', 'combustOrb', 'underBeamsOrb', 'vocMode', 'vocIncludeOuter', 'fixedStarOrbMode', 'fixedStarOrb', 'antisciaOrb',
	'viaCombustaVariant', 'combustOwnChariotExempt', 'stationMarking', 'hermeticLotsReversal', 'erosConstruction', 'lotFortuneVariant', 'lotFatherCombustAlt',
	'lotProjection', 'dignityDebilities', 'almutenTripMode', 'planetaryHourMethod', 'orbSystem', 'luminaryOrbBonus', 'aspectIncludeCusps', 'aspectIncludeLots',
	'aspectIncludeMidpoints', 'solarReturnVariant', 'returnLatitudeMode', 'vulcanCalc', 'strongRecption', 'simpleAsp', 'virtualPointReceiveAsp', 'orbScale', 'useStoredOrbs'];

const SANSHI_UNITED_FIELDS = [
	...reTagSanshi(LIURENG_FIELDS.filter((f)=>SANSHI_LIURENG_LOCKED_KEYS.indexOf(f.name) < 0), '大六壬'),
	...reTagSanshi(QIMEN_FIELDS, '奇门'),
	...reTagSanshiTaiyi(TAIYI_FIELDS),
	{ name: 'timeAlg', label: '时间算法', type: 'select', options: TIME_ALG_OPTIONS, default: 0, group: '时间换算' },
	...DAY_BOUNDARY_FIELDS.map(dayBoundaryLabelled('日界')),
];

export const TECHNIQUE_SETTINGS_SCHEMA = {
	// ---- A 类：命盘星盘系（fields 驱动）----
	// 星盘挂载快照不含中式二十八宿内容(月宿=印度 nakshatra、月站=阿拉伯月站),doubingSu28 对星盘正文零消费 → 撤此齿轮
	// (宿占/七政条目照旧,与页面九档同源)。
	astrochart: { kind: 'record', fields: ASTRO_CHART_FIELDS.filter((f)=>f.name !== 'doubingSu28') },
	// 聚合键改为只读:内容=辅盘页派生盘模块快照(只认本命主);57 个占星齿轮对它拨的是本命请求(病形④⑤),撤下。
	astrochart_like: { kind: 'sectionsOnly', reason: '十三分盘/十二分盘/调波盘/龙盘/重置盘取自辅盘页最近一次出盘(出盘即存快照,只认本命主);要改盘参数请到辅盘页操作,改后即自动更新。' },
	// 派生盘五键各自独立(读本键模块快照;内容勾选走各键 preset;要改盘参数到辅盘页重出)。
	hellenastro: { kind: 'sectionsOnly', reason: '十三分盘取自辅盘页最近一次出盘(出盘即存快照,只认本命主);要改盘参数请到辅盘页重出,改后即自动更新。' },
	dwadasamsa: { kind: 'sectionsOnly', reason: '十二分盘取自辅盘页最近一次出盘(出盘即存快照,只认本命主);要改盘参数请到辅盘页重出,改后即自动更新。' },
	harmonic: { kind: 'sectionsOnly', reason: '调波盘取自辅盘页最近一次出盘(出盘即存快照,只认本命主);要改谐波次数请到辅盘页重出,改后即自动更新。' },
	draconic: { kind: 'sectionsOnly', reason: '龙盘取自辅盘页最近一次出盘(出盘即存快照,只认本命主);要改交点基准请到辅盘页重出,改后即自动更新。' },
	relocation: { kind: 'sectionsOnly', reason: '重置盘取自辅盘页最近一次出盘(出盘即存快照,只认本命主);要改重置地点请到辅盘页重出,改后即自动更新。' },
	indiachart: { kind: 'record', fields: INDIA_CHART_FIELDS, emptyHint: '印度盘按出生信息起盘，可调岁差制/分宫制。',
		// 抽屉里换流派:像页面换派那样把宫制 / 岁差(及主大运)写成该派预设(之后仍可逐项再改)
		onDraftChange: (draft, name, value)=>(name === 'indiaSchool' && value ? { ...draft, ...indiaSchoolPresetDraft(value) } : draft),
		// 覆盖只带了流派(旧存的挂载配置 / 助手只改流派)、与盘上流派不同:没带的宫制 / 岁差 / 主大运取该派预设 ——
		// 记录缺这几个键时构造器取的是页面载入值(出厂值),不再另按流派补,换派的预设由这里给(与抽屉、页面同一张表)
		expandMergeOptions: (options, record)=>{
			const sc = options && options.indiaSchool;
			if(!sc){ return options; }
			const cur = record && record.indiaSchool ? record.indiaSchool : AstroConst.INDIA_SCHOOL_DEFAULT;
			if(AstroConst.normalizeIndiaSchool(sc) === AstroConst.normalizeIndiaSchool(cur)){ return options; }
			const preset = indiaSchoolPresetDraft(sc);
			const out = { ...options };
			Object.keys(preset).forEach((k)=>{ if(out[k] === undefined || out[k] === null || out[k] === ''){ out[k] = preset[k]; } });
			return out;
		} },
	// 宿占=占星起盘 + 宿盘专属「人事十二宫起宫」(ASC起盘/八字公式起盘,SZConst.SZHouseStart_*);
	// 独立拼 fields(不污染 astrochart 共用的 ASTRO_CHART_FIELDS)。默认 0=八字公式起盘=现状。
	// houseStartMode 缺键时构造器取 newChartSeedRecordMissingValue(并入时冻结的旧版偏好,
	// aiAnalysisContext buildFieldObject)——globalCurrent 同源,旧档缺键+当时偏好为 ASC 时拨回
	// 默认档不再被剪空;埃及历七轴对宿占是死齿轮(buildSuzhanSnapshotText 不产【埃及历】段),
	// 从共享 ASTRO_CHART_FIELDS 过滤掉,免误导。
	// 宿占快照只读宫位 id/黄经、传统星体所在宫/赤经/黄经度/宿名、宿距星赤经、生时时支(SuZhanMain.buildSuzhanSnapshotText):
	// 尊贵/界主/福点/相位/空亡/燃烧/返照/推算行星/容许度等 40 个西占古典判读键对宿占正文零消费(与 egypt_* 同理)→ 一并过滤。
	// 宿占事盘的宿法 / 起宫只存在 payload.options(记录顶层没有):基线从那里读,否则抽屉显示荀爽、选回荀爽被剪成死开关;命盘顶层带这两键,不受影响
	// recordPayloadKeys:平铺键缺席时取存档 payload.options(宿占存案另存黄道 / 宫制 / 岁差,与 SuZhanMain SUZHAN_CASE_CHART_KEYS 同)
	suzhan: { kind: 'record', recordPayloadKeys: ['houseStartMode', 'doubingSu28', 'zodiacal', 'hsys', 'siderealAyanamsa'], fields: [...ASTRO_CHART_FIELDS.filter((f)=>!`${f.name}`.startsWith('egypt_') && SUZHAN_DEAD_CLASSICAL_KEYS.indexOf(f.name) < 0).map((f)=>(f.name === 'siderealAyanamsa' ? SUZHAN_SIDEREAL_AYANAMSA_FIELD(f) : f)), {
		name: 'houseStartMode', label: '人事十二宫', type: 'select', default: 0,
		globalCurrent: ()=>newChartSeedRecordMissingValue('houseStartMode'),   // 与页面载入缺键同口径(并入时冻结的旧版偏好)
		group: '排盘',
		options: [{ value: 0, label: '八字公式起盘（默认）' }, { value: 1, label: 'ASC起盘' }],
	}] },
	// 演禽/策天：经 ken 后端按出生时间起盘（纯命盘类、无事盘）。
	// 注：禽星盘只取生辰原始时刻，ken 引擎不消费 日界/晚子时/真太阳时换算（parseFieldsDateTime 只读 date/time/zone/lat/lon）→
	// 此前挂 TIME_FIELDS 是「可选但无效」的死设置，移除以免误导（各挂载设置界面都不再显示无效项）。
	// kinastro 族齿轮范式:'' 哨兵=按盘面时间/后端自出(prune 剪掉,payload 不带键=现状零回归);
	// 非空值经 case 分支 optionsOverride 透传,与页面 buildPayload 同键直达 ken 后端(cetian 已验范式)。
	// 家庭/亲属/四柱覆写等「内容/数据」项不入齿轮(faRelatedPeople 同理),仍随页面存档。
	xianqin: { kind: 'record', group: '演禽', fields: [
		// 旧 emptyHint「无独立可调排盘设置」不实:页面有 入式历法/农历锚点 四项且 buildPayload 真下发。
		{ name: 'calendarMode', label: '入式历法', type: 'select', default: '', blankFollowsBaseline: true, group: '入式', options: [
			{ value: '', label: '随盘自出（默认）' }, { value: 'autoLunar', label: '自动换算农历' },
			// 值须与页面 KinAstroMain / 后端 CALENDAR_MODES 同键('solarAsLunar');此前写 'solarNumeric' 后端不认 → 静默回落自动农历。
			{ value: 'manualLunar', label: '手动农历' }, { value: 'solarAsLunar', label: '公历数值入式' },
		] },
		// 三键只在手动农历入式下被后端读取(webxianqinsrv 293-296)
		{ name: 'lunarYear', label: '农历年(空=自出)', type: 'number', default: '', group: '入式', showWhen: (d)=>d.calendarMode === 'manualLunar' },
		{ name: 'lunarMonth', label: '农历月(空=自出)', type: 'number', default: '', min: 1, max: 12, group: '入式', showWhen: (d)=>d.calendarMode === 'manualLunar' },
		{ name: 'lunarDay', label: '农历日(空=自出)', type: 'number', default: '', min: 1, max: 30, group: '入式', showWhen: (d)=>d.calendarMode === 'manualLunar' },
	] },
	// qizhengkin:页面设置走 fetchKinastroQizheng 专用请求(qizhengKin* 键)+localStorage,与挂载
	// postKinAstro 路由的消费面未实证同构 → 按铁律「不放无效选项」暂不登,留待后端消费面证实后接线。
	// 后端 webqizhengkinsrv.pan() 读 qizhengKin* 七键且与无头 postKinAstro 同端点(此前「消费面未实证」的空集理由已被推翻);
	// 值域与页面 GuoLaoInput 七政设置同源(currentYear/transitMode/electionalCriteria…);缺省=页面缺省(当前年/none/general/30 天)。
	qizhengkin: { kind: 'record', group: '七政(kentang)', fields: [
		{ name: 'qizhengKinCurrentYear', label: '推运年份(空=当前年)', type: 'number', default: '', min: 1, max: 9999, group: '行运' },
		{ name: 'qizhengKinTransitMode', label: '流时', type: 'select', default: 'none', group: '行运', options: [
			{ value: 'none', label: '关闭(默认)' }, { value: 'same', label: '同刻' }, { value: 'now', label: '此刻' }, { value: 'custom', label: '自定' },
		] },
		{ name: 'qizhengKinTransitDate', label: '流时日期(自定时)', type: 'date', default: '', group: '行运', showWhen: (d)=>d && d.qizhengKinTransitMode === 'custom' },
		{ name: 'qizhengKinTransitTime', label: '流时时间(自定时)', type: 'time', default: '', group: '行运', showWhen: (d)=>d && d.qizhengKinTransitMode === 'custom' },
		{ name: 'qizhengKinElectionalStartDate', label: '择日起日(空=出生日)', type: 'date', default: '', group: '择时' },
		{ name: 'qizhengKinElectionalCriteria', label: '择日用途', type: 'select', default: 'general', group: '择时', options: [
			{ value: 'general', label: '通用(默认)' }, { value: 'marriage', label: '嫁娶' }, { value: 'travel', label: '出行' }, { value: 'business', label: '开市' }, { value: 'moving', label: '搬迁' },
		] },
		{ name: 'qizhengKinElectionalDays', label: '择日天数', type: 'number', default: 30, min: 1, max: 60, group: '择时' },
	] },
	shaozi: { kind: 'record', group: '邵子神数', fields: [
		// 档位与页面同一份;留空 = 后端缺省初刻(不是由盘推出)
		{ name: 'ke', label: '刻数', type: 'select', default: '', group: '考刻', options: [{ value: '', label: '缺省（初刻）' }, ...SHAOZI_KE_OPTIONS] },
		{ name: 'useKey', label: '64钥匙细调', type: 'select', default: '', blankFollowsBaseline: true, group: '考刻', options: [
			{ value: '', label: '随盘（默认）' }, { value: 1, label: '启用' }, { value: 0, label: '关闭' },
		] },
	] },
	tieban: { kind: 'record', group: '铁板神数', fields: [
		{ name: 'method', label: '算法', type: 'select', default: '', blankFollowsBaseline: true, group: '起数', options: [
			{ value: '', label: '随盘（默认）' }, { value: 'kunji', label: '扣入法' }, { value: 'suanpan', label: '算盘打数' },
		] },
		{ name: 'startAge', label: '起运年龄(空=自出)', type: 'number', default: '', min: 0, max: 120, group: '起数' },   // 与页面/后端 0–120 同域(此前 20)
		{ name: 'dayunSteps', label: '大运步数(空=自出)', type: 'number', default: '', min: 1, max: 12, group: '起数' },
		// 考刻 ke / 钥匙细调 useKey 撤:从邵子神数照抄,铁板后端 pan 只读 gender/method/startAge/dayunSteps,页面也只在邵子页渲染 → 死齿轮。
		// [框架推演] 段口径(纯前端 buildTiebanFramework;页面存档带此段而无头曾整段缺失):
		{ name: 'tiebanSchool', label: '流派（口径说明）', type: 'select', default: 'south', group: '框架推演', options: [
			{ value: 'south', label: '南派(岭南)' }, { value: 'north', label: '北派(中州)' },
		] },
		{ name: 'tiebanKeSystem', label: '刻制', type: 'select', default: 'qing8', group: '框架推演', options: [
			{ value: 'qing8', label: '清八刻' }, { value: 'ming100', label: '明百刻' }, { value: 'dou12', label: '十二刻斗宫' },
		] },
		// 刻位档随刻制(与页面 / 引擎同一份 tiebanKeOptions:十二刻·斗宫 1–12,其余 1–8)
		{ name: 'tiebanKe', label: '考刻刻位', type: 'select', default: 1, group: '框架推演', normalize: (v)=>Number(v),
			options: tiebanKeOptions('dou12'), optionsFor: (d)=>tiebanKeOptions(d && d.tiebanKeSystem),
			displayValue: (v, d)=>clampTiebanKe(v, d && d.tiebanKeSystem) },   // 超出所选刻制上限的刻位回显初刻(引擎同样按初刻算)
	] },
	fendjing: { kind: 'record', group: '鬼谷分定经', fields: [
		{ name: 'stemOverride', label: '两头钳', type: 'select', default: '', blankFollowsBaseline: true, group: '两头钳', options: [
			{ value: '', label: '随盘（默认）' }, { value: 0, label: '自动换算' }, { value: 1, label: '手动指定' },
		] },
		{ name: 'yearStem', label: '年干(手订时)', type: 'select', default: '', group: '两头钳',
			showWhen: (d)=>d.stemOverride === 1 || d.stemOverride === '1',
			options: [{ value: '', label: '自出' }, ...['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'].map((g)=>({ value: g, label: g }))] },
		{ name: 'hourStem', label: '时干(手订时)', type: 'select', default: '', group: '两头钳',
			showWhen: (d)=>d.stemOverride === 1 || d.stemOverride === '1',
			options: [{ value: '', label: '自出' }, ...['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'].map((g)=>({ value: g, label: g }))] },
	] },
	beiji: { kind: 'record', group: '北极神数', fields: [
		{ name: 'beijiKeMode', label: '刻法', type: 'select', default: '', blankFollowsBaseline: true, group: '取数', options: [
			{ value: '', label: '随盘（默认）' }, { value: 'auto', label: '自动换算' }, { value: 'manual', label: '手动指定' },
		] },
		{ name: 'beijiKe', label: '刻（手动时）', type: 'select', default: '', group: '取数',
			showWhen: (d)=>d.beijiKeMode === 'manual', options: [{ value: '', label: '自出（按时刻推刻）' }, ...BEIJI_KE_OPTIONS] },
		{ name: 'beijiLookupCode', label: '条文码(空=不查;取数字前 4 位,不足 4 位不查)', type: 'text', default: '', group: '取数' },   // webbeijisrv 173-192
		{ name: 'beijiKeyword', label: '关键词(空=不筛;少于 2 字不检索)', type: 'text', default: '', group: '取数' },
	] },
	nanji: { kind: 'record', group: '南极神数', fields: [
		// 值域与页面 / 后端同名:''=随盘 / solar=公历精算 / manual=手动古法(后端只认 manual;
		// 旧 'lunar' 档静默=公历 → 归一为 '')。手动六键仅 manual 显示(showWhen),空值=按本命自出(后端)。
		{ name: 'nanjiMode', label: '起盘方式', type: 'select', default: '', blankFollowsBaseline: true, group: '起盘', options: [
			{ value: '', label: '随盘（默认）' }, { value: 'solar', label: '公历精算' }, { value: 'manual', label: '手动古法' },
		], normalize: (v)=>((v === 'lunar') ? '' : v) },
		{ name: 'nanjiAfterLichun', label: '立春', type: 'select', default: '', blankFollowsBaseline: true, group: '起盘', options: [
			{ value: '', label: '随盘（默认）' }, { value: '1', label: '立春后' }, { value: '0', label: '立春前' },
		], showWhen: (d)=>d.nanjiMode === 'manual' },
		{ name: 'nanjiLunarYear', label: '历年(空=自出)', type: 'number', default: '', group: '起盘', showWhen: (d)=>d.nanjiMode === 'manual' },
		{ name: 'nanjiSolarMonth', label: '节月(节气月序,寅=1;空=自出)', type: 'number', default: '', min: 1, max: 12, group: '起盘', showWhen: (d)=>d.nanjiMode === 'manual' },
		{ name: 'nanjiHourZhi', label: '时支(空=自出)', type: 'select', default: '', group: '起盘', showWhen: (d)=>d.nanjiMode === 'manual',
			options: [{ value: '', label: '自出' }, ...DIZHI_12.map((z)=>({ value: z, label: z }))] },
		{ name: 'nanjiDayGan', label: '日干(空=自出)', type: 'select', default: '', group: '起盘', showWhen: (d)=>d.nanjiMode === 'manual',
			options: [{ value: '', label: '自出(按出生时刻)' }, ...['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'].map((g)=>({ value: g, label: g }))] },
		{ name: 'nanjiDayZhi', label: '日支(空=自出)', type: 'select', default: '', group: '起盘', showWhen: (d)=>d.nanjiMode === 'manual',
			options: [{ value: '', label: '自出(本命日支)' }, ...DIZHI_12.map((z)=>({ value: z, label: z }))] },   // 与日干阴阳不合时不取(后端在四柱段注明)
		// 推演诸项档位与页面同一份(值同页面,建除 / 宿名 / 密码为库内繁体键);留空时宫部 / 推演宫由盘推出,
		// 建除 / 宿 / 密码 / 星图 / 宿度是后端固定缺省(建 / 角 / 海异山同 / 第1图 / 1 度),不是由盘推出
		{ name: 'nanjiSection', label: '宫部', type: 'select', default: '', group: '推演', options: [{ value: '', label: '按本命（自出）' }, ...NANJI_SECTION_OPTIONS] },
		{ name: 'nanjiJianchu', label: '建除', type: 'select', default: '', group: '推演', options: [{ value: '', label: '缺省（建）' }, ...NANJI_JIANCHU_OPTIONS] },
		{ name: 'nanjiXiu', label: '二十八宿', type: 'select', default: '', group: '推演', options: [{ value: '', label: '缺省（角）' }, ...NANJI_XIU_OPTIONS] },
		{ name: 'nanjiPasswordCode', label: '密码', type: 'select', default: '', group: '推演', options: [{ value: '', label: '缺省（海异山同）' }, ...NANJI_PASSWORD_OPTIONS] },
		{ name: 'nanjiChart', label: '星图', type: 'select', default: '', group: '推演', normalize: (v)=>(v === '' || v === undefined || v === null ? '' : Number(v)), options: [{ value: '', label: '缺省（第1图）' }, ...NANJI_CHART_OPTIONS] },
		{ name: 'nanjiPalace', label: '推演宫', type: 'select', default: '', group: '推演',
			options: [{ value: '', label: '自出（宫部首支）' }, ...DIZHI_12.map((z)=>({ value: z, label: z }))] },
		{ name: 'nanjiDegree', label: '宿度(空=1 度)', type: 'number', default: '', min: 0, max: 30, step: 0.5, group: '推演' },   // 与页面同值域(0 可达)
	] },
	chunzi: { kind: 'record', group: '蠢子数', fields: [
		// 刻法/刻数只改起盘段「刻法/刻」两行(条文库无时辰×刻同诗,候选条文不随刻变)——标签明示「仅标注」
		{ name: 'chunziKeMode', label: '刻法（仅标注）', type: 'select', default: '', blankFollowsBaseline: true, group: '取数', options: [
			{ value: '', label: '随盘（默认）' }, { value: 'auto', label: '自动换算' }, { value: 'manual', label: '手动指定' }, { value: 'none', label: '不取刻数' },   // 补页面有的档
		] },
		{ name: 'chunziKe', label: '刻数（仅标注）', type: 'select', default: '', group: '取数',
			showWhen: (d)=>d.chunziKeMode === 'manual', options: [{ value: '', label: '自出（按时辰内位置推刻）' }, ...CHUNZI_KE_OPTIONS] },   // 手动刻法下留空,后端按时辰内已过分钟自推刻数(十刻,每 12 分一刻)
		{ name: 'chunziLunarMode', label: '月日匹配', type: 'select', default: '', blankFollowsBaseline: true, group: '取数', options: [
			{ value: '', label: '随盘（默认）' }, { value: 'auto', label: '随当前日期' }, { value: 'manual', label: '手动月日' }, { value: 'none', label: '关闭' },
		] },
		// 手动农历才读(webchunzisrv 279-293;auto 档后端真换算农历)
		{ name: 'chunziLunarMonth', label: '农历月(空=自出)', type: 'number', default: '', min: 1, max: 12, group: '取数', showWhen: (d)=>d.chunziLunarMode === 'manual' },
		{ name: 'chunziLunarDay', label: '农历日(空=自出)', type: 'number', default: '', min: 1, max: 30, group: '取数', showWhen: (d)=>d.chunziLunarMode === 'manual' },
		{ name: 'chunziMansion', label: '宿名', type: 'select', default: '', group: '取数', options: [{ value: '', label: '缺省（室）' }, ...CHUNZI_MANSION_OPTIONS] },   // 后端已归一简体;留空 = 后端固定缺省「室」
		{ name: 'chunziHourBranch', label: '时辰', type: 'select', default: '', group: '取数',
			options: [{ value: '', label: '按本命时支' }, ...DIZHI_12.map((z)=>({ value: z, label: z }))] },
		{ name: 'chunziLookupCode', label: '条文代码(空=不查)', type: 'text', default: '', group: '筛选' },
		{ name: 'chunziKeyword', label: '关键词(空=不筛)', type: 'text', default: '', group: '筛选' },
		{ name: 'chunziTags', label: '多标签(逗号分隔;空=不筛)', type: 'text', default: '', group: '筛选' },
		// 档值是字符串(与页面同);旧记录 / 旧模板存的是数字 → 归一成字符串才对得上档
		{ name: 'chunziResultLimit', label: '显示数量', type: 'select', default: '', group: '筛选', options: [{ value: '', label: '默认（20条）' }, ...CHUNZI_RESULT_LIMIT_OPTIONS],
			normalize: (v)=>(v === undefined || v === null ? v : `${v}`) },   // 档位与页面同
	] },
	// 策天飞星：算法(书/原)+原法子选项 + 5 显示开关；全默认=现状(prune 为空，零字节差)。show_* 经 payload 下发后端过滤输出段/行。
	// chartRoute: payload kind 但登记在 ANALYSIS_CHART_TECHNIQUES 走 A 路(历史双例);覆盖与现状
	// 都在 record 平铺键(regenerate case 从 record.* 手抄回塞),基线锚用平铺而非 payload 段。
	// baselineSource 显式为空:策天只读记录平铺键,不把记录里别的模块注入的整份 payload 当存档段(同名键会让抽屉显示外来值)
	cetian: { kind: 'payload', optionsPath: '', chartRoute: true, baselineSource: ()=>null, group: '策天飞星', fields: [
		{ name: 'method', label: '算法', type: 'select', default: 'book', group: '排盘方法', options: [
			{ value: 'book', label: '书法·策天本法' },
			{ value: 'kentang', label: '原法·标准紫微' },
		] },
		// 标签与策天页同(「农历」「正曜」,半角括号)
		{ name: 'lunarMode', label: '农历', type: 'select', default: 'sxtwl', group: '排盘方法', when: { method: 'kentang' }, options: [
			{ value: 'sxtwl', label: '天文历算(修正)' },
			{ value: 'classic', label: '原(闰月旧法)' },
		] },
		{ name: 'starOrder', label: '正曜', type: 'select', default: 'reverse', group: '排盘方法', when: { method: 'kentang' }, options: [
			{ value: 'reverse', label: '逆布(书)' },
			{ value: 'forward', label: '顺布(原)' },
		] },
		// 书法(移语本)口径与流年——与左栏/buildPayload 三方同键(死开关教训:任一缺位=挂载死齿轮)。
		{ name: 'brightnessSchool', label: '庙旺', type: 'select', default: 'yiyu', group: '书法口径', when: { method: 'book' }, options: [
			{ value: 'yiyu', label: '移语本·诸星格' },
			{ value: 'quanji', label: '全集本·诗诀' },
		] },
		{ name: 'shenGongMode', label: '身宫', type: 'select', default: 'yizheng', group: '书法口径', when: { method: 'book' }, options: [
			{ value: 'yizheng', label: '引证图口径' },
			{ value: 'literal', label: '正文直读' },
		] },
		{ name: 'daxianMode', label: '大限', type: 'select', default: 'yiyu', group: '书法口径', when: { method: 'book' }, options: [
			{ value: 'yiyu', label: '阳年从命·阴年从身' },
			{ value: 'legacy', label: '顺从命·逆从身(旧)' },
		] },
		{ name: 'tianluoMode', label: '罗网', type: 'select', default: 'benshu', group: '书法口径', when: { method: 'book' }, options: [
			{ value: 'benshu', label: '本书·月日法' },
			{ value: 'zhongtian', label: '中天太极·月时法' },
		] },
		{ name: 'palaceNameMode', label: '宫名', type: 'select', default: 'common', group: '书法口径', when: { method: 'book' }, options: [
			{ value: 'common', label: '通行十二宫' },
			{ value: 'monk', label: '僧道起法' },
		] },
		// 值域与页面流年下拉同(今年前后 120 年)
		{ name: 'liunianYear', label: '流年(留空=当年)', type: 'number', default: '', min: new Date().getFullYear() - 120, max: new Date().getFullYear() + 120, group: '流年', when: { method: 'book' } },
		{ name: 'liunianQishaMode', label: '七煞', type: 'select', default: 'shengshi', group: '流年', when: { method: 'book' }, options: [
			{ value: 'shengshi', label: '生时法' },
			{ value: 'suishu', label: '岁数法' },
		] },
		{ name: 'showBrightness', label: '庙旺标注', type: 'switch', options: ON_OFF, default: 1, group: '显示选项' },
		{ name: 'showLiunian', label: '流年飞星', type: 'switch', options: ON_OFF, default: 1, group: '显示选项', when: { method: 'book' } },
		{ name: 'showShensha', label: '神煞四表', type: 'switch', options: ON_OFF, default: 1, group: '显示选项', when: { method: 'book' } },
		{ name: 'showZaYao', label: '杂曜', type: 'switch', options: ON_OFF, default: 1, group: '显示选项', when: { method: 'book' } },
		{ name: 'showDuanjue', label: '断诀', type: 'switch', options: ON_OFF, default: 1, group: '显示选项', when: { method: 'book' } },
		{ name: 'showXiu', label: '廿八宿', type: 'switch', options: ON_OFF, default: 1, group: '显示选项', when: { method: 'book' } },
		{ name: 'showBianyao', label: '十干变曜', type: 'switch', options: ON_OFF, default: 1, group: '显示选项', when: { method: 'book' } },
		{ name: 'showWuXingJu', label: '五行局', type: 'switch', options: ON_OFF, default: 1, group: '显示选项', when: { method: 'kentang' } },
		{ name: 'showSihua', label: '四化', type: 'switch', options: ON_OFF, default: 1, group: '显示选项', when: { method: 'kentang' } },
		{ name: 'showFlying', label: '飞星格局', type: 'switch', options: ON_OFF, default: 1, group: '显示选项', when: { method: 'kentang' } },
		{ name: 'showSolarTerm', label: '节气', type: 'switch', options: ON_OFF, default: 1, group: '显示选项' },   // 两算法都过滤该行,撤 when
	] },
	// 皇极经世：双栖——命盘侧按出生重算(buildHuangJiSnapshotForFields)，又可存事盘。
	// kind='payload'(optionsPath'' 顶层铺平;旧注误称「同列 sectionsOnly」——与实现不符,已勘正):
	// 齿轮顶层键优先、存档 payload.options.{historyYear,classicKey,classicSectionIndex,xinyiOptions} 打底(regenerate 双源读)。
	huangji: { kind: 'payload', optionsPath: '', chartRoute: true,
		// 事盘存档层映射(payload.options + 嵌套 xinyiOptions,键名不同构):chartRoute 合成基线
		// =存档打底+record 平铺覆盖 —— 只锚平铺时事盘抽屉恒显 schema 想象值(A 类实锤同型)。
		baselineSource: (p)=>{
			const ho = p && p.options && typeof p.options === 'object' ? p.options : null;
			if(!ho){ return null; }
			const hx = ho.xinyiOptions && typeof ho.xinyiOptions === 'object' ? ho.xinyiOptions : {};
			const out = { classicKey: ho.classicKey, historyYear: ho.historyYear, classicSectionIndex: ho.classicSectionIndex,
				xinyiMethod: hx.method, upperNum: hx.upperNum, lowerNum: hx.lowerNum,
				upperStrokes: hx.upperStrokes, lowerStrokes: hx.lowerStrokes, objectGua: hx.objectGua, direction: hx.direction };
			Object.keys(out).forEach((k)=>{ if(out[k] === undefined || out[k] === null){ delete out[k]; } });
			return Object.keys(out).length ? out : null;
		},
		fields: [
		// 所推之年:元会运世值卦按年而定(留空=按起课/出生年,即无头现状)。
		{ name: 'historyYear', label: '历史年(留空=按盘面年)', type: 'number', default: '', group: '典籍' },
		{ name: 'classicKey', label: '经典', type: 'select', default: 'huangji_jingshi_shu', group: '典籍',
			options: [
				// 档名与皇极页同(页面下拉显示后端经典表的书名)
				{ value: 'huangji_jingshi_shu', label: '皇極經世書' },
				{ value: 'xinyi_fawei', label: '皇極經世心易發微' },
				{ value: 'guanwu_yanyi', label: '皇極經世觀物外篇衍義' },
			] },
		// 挂载缺省改为起心易(与页面缺省 datetime 同,此前挂载「不算心易」与页面快照两处不同形);标签统一用页面文案
		{ name: 'xinyiMethod', label: '起卦法', type: 'select', default: 'datetime', group: '心易發微',
			optionShown: (o)=>o.value !== 'none',   // 页面没有「不算心易」:只在存档已是它时列出
			options: [
				{ value: 'none', label: '不算心易' },
				{ value: 'datetime', label: '年月日時起卦(默认)' },
				{ value: 'number', label: '先天数起卦' },
				// 值须与页面 HuangJiMain 选项/后端 webwangjisrv._xinyi_result 同键('character'/'direction');
				// 此前写 'strokes'/'object' → 后端不识一律回落「两数起卦」,笔画/物象四齿轮恒死(页面本身用对键)。
				{ value: 'character', label: '字数起卦' },
				{ value: 'direction', label: '后天方位起卦' },
			] },
		{ name: 'upperNum', label: '上卦数', type: 'number', default: 5, min: 1, max: 999, group: '心易發微', showWhen: (d)=>d && d.xinyiMethod === 'number' },
		{ name: 'lowerNum', label: '下卦数', type: 'number', default: 10, min: 1, max: 999, group: '心易發微', showWhen: (d)=>d && d.xinyiMethod === 'number' },
		{ name: 'upperStrokes', label: '上/左笔画', type: 'number', default: 5, min: 1, max: 99, group: '心易發微', showWhen: (d)=>d && d.xinyiMethod === 'character' },
		{ name: 'lowerStrokes', label: '下/右笔画', type: 'number', default: 8, min: 1, max: 99, group: '心易發微', showWhen: (d)=>d && d.xinyiMethod === 'character' },
		{ name: 'objectGua', label: '物象', type: 'select', default: '離', group: '心易發微', showWhen: (d)=>d && d.xinyiMethod === 'direction',
			options: ['乾', '兌', '離', '震', '巽', '坎', '艮', '坤'].map((g)=>({ value: g, label: g })) },
		{ name: 'direction', label: '方位', type: 'select', default: '南', group: '心易發微', showWhen: (d)=>d && d.xinyiMethod === 'direction',
			options: ['南', '北', '東', '西', '東南', '東北', '西南', '西北', '中'].map((g)=>({ value: g, label: g })) },   // 与页面同含「中」
	] },
	// 合盘:两盘技法无法单命主重算,快照单源=合盘页所存(选项在合盘页改即重存)。
	relative: { kind: 'sectionsOnly', reason: '合盘须两张盘,挂载读合盘页当前所存快照;要改关系类型/两盘请到合盘页操作,改后即自动更新。' },

	// ---- A 类：星运（主限法 + 三分主星 / Balbillus / 关键点 可调；其余推运参数固定=现状则空 schema）----
	// 拆分（P5）：表格用年限范围(pdYears,无 datetime)，盘用单一时刻(datetime,无 pdYears)。
	primarydirect: { kind: 'record', fields: PRIMARY_DIRECT_TABLE_FIELDS },
	primarydirchart: { kind: 'record', fields: PRIMARY_DIRECT_CHART_FIELDS },
	// 这三者的 standalone builder 已收 (chartObj,opts)；regen 据 record.* 组 opts 传入（见 aiAnalysisContext）。
	triplicityrulers: { kind: 'record', fields: TRIPLICITY_FIELDS },
	balbillus: { kind: 'record', fields: BALBILLUS_FIELDS },
	yearsystem129: { kind: 'record', fields: YEARSYSTEM129_FIELDS },
	distributions: { kind: 'record', fields: DISTRIBUTIONS_FIELDS },
	agepoint: { kind: 'record', fields: AGEPOINT_FIELDS },
	keypoints: { kind: 'record', fields: KEYPOINTS_FIELDS },
	// 批3：以下推运 builder 加了 opts 形参 + regen 据 record.* 传入（见 aiAnalysisContext regenerateChartTechniqueSnapshot）。
	zodialrelease: { kind: 'record', fields: ZODIAL_RELEASE_FIELDS },
	decennials: { kind: 'record', fields: DECENNIALS_FIELDS },
	planetaryarc: { kind: 'record', fields: PLANETARY_ARC_FIELDS },
	persiandirected: { kind: 'record', fields: PERSIAN_DIRECTED_FIELDS },
	// [Windows #80] 回归黄道二次推运:与恒星支同一后端同一 builder,齿轮同形。
	prog: { kind: 'record', fields: PROG_TARGET_FIELDS },
	vedicprog: { kind: 'record', fields: PROG_TARGET_FIELDS },
	jaynesprog: { kind: 'record', fields: PROG_TARGET_FIELDS },
	// 目标时刻型 5 法：共用 buildPredictivePeriodSnapshot(chartObj,key,opts)。profection/solararc 只 4 基项；
	// 3 返照(solarreturn/lunarreturn/givenyear)另加 异地 dirLat/dirLon。
	profection: { kind: 'record', fields: [...PREDICTIVE_PERIOD_BASE_FIELDS, ...PROFECTION_SUMMARY_FIELDS] },   // +小限粒度/起点
	solararc: { kind: 'record', fields: PREDICTIVE_PERIOD_BASE_FIELDS.map((f)=>(f.name === 'asporb' ? { ...f, options: directionAsporbOptions(true) } : f)) },   // 弧类:不列「双星容许度相加除以2」
	// 返照三法:页面已隐藏「南北交逆移」(对返照法不适用),Python 三端点不读,快照却照打「月交点逆行：是」→ schema 去掉该字段(与页面同形)。
	solarreturn: { kind: 'record', fields: [...PREDICTIVE_PERIOD_BASE_FIELDS.filter((f)=>f.name !== 'nodeRetrograde'), ...PREDICTIVE_RETURN_DIR_FIELDS] },
	lunarreturn: { kind: 'record', fields: [...PREDICTIVE_PERIOD_BASE_FIELDS.filter((f)=>f.name !== 'nodeRetrograde'), ...PREDICTIVE_RETURN_DIR_FIELDS] },
	givenyear: { kind: 'record', fields: [...PREDICTIVE_PERIOD_BASE_FIELDS.filter((f)=>f.name !== 'nodeRetrograde'), ...PREDICTIVE_RETURN_DIR_FIELDS] },

	// ---- A 类：八字 / 紫微（时间类）----
	bazi: { kind: 'record', fields: [
		// 八字 timeAlg=3 档（真太阳时/直接时间/春分定卯时，源 CnTraditionInput），不复用 2 档 TIME_FIELDS；日界/晚子时共用。
		// 「春分定卯时」页面置灰(未实现,同直接时间):不列(已选者仍显示)
		{ name: 'timeAlg', label: '时间算法', type: 'select', options: BAZI_TIME_ALG_OPTIONS, default: 0, group: '时间换算', optionShown: (o)=>o.value !== 2 },
		...DAY_BOUNDARY_FIELDS,
		// 计算选项（CnTraditionInput phaseType）：长生 火土同/水土同/阳顺阴逆——原 schema 误标「标准/变体」且漏值 2（选不到）。
		{ name: 'phaseType', label: '长生', type: 'select', default: 0, group: '取用', options: [
			{ value: 0, label: '长生火土同（阴阳同序，默认）' },
			{ value: 1, label: '长生水土同（阴阳同序）' },
			{ value: 2, label: '长生阳顺阴逆' },
		] },
		// 神煞主位（CnTraditionInput godKeyPos）：年/日/年日——原 schema 漏「年日」。
		{ name: 'godKeyPos', label: '神煞查法', type: 'select', default: '年', group: '取用', options: [
			{ value: '年', label: '按年柱查（默认）' },
			{ value: '日', label: '按日柱查' },
			{ value: '年日', label: '年柱日柱都查' },
		] },
		// 盘法 4 项（CnTraditionInput 命宫起法/月律分野/起运精度/藏干版本）：BaZi.js:722/767-771 据 baziOpt 触发重算并转发后端,
		//   改命宫/月令分野/起运岁/藏干打分 → 真改 ground-truth。live 盘走 BaZi.js 自身 params;但 AI 挂载侧走 buildChartBaziParams,
		//   此前漏转发 → 挂载/导出快照这 4 项恒默认。补 4 字段 + buildChartBaziParams 同补转发(读 record,与 school 同范式)。默认即现状零回归。
		{ name: 'minggongMethod', label: '命宫起法', type: 'select', default: 'tongxing', globalCurrent: ()=>storedBaziOptValue('minggongMethod'), group: '盘法', options: [
			{ value: 'tongxing', label: '通行版（默认）' },
			{ value: 'shufa', label: '子平数法' },
		] },
		{ name: 'fenyeVersion', label: '月律分野', type: 'select', default: 'common', globalCurrent: ()=>storedBaziOptValue('fenyeVersion'), group: '盘法', options: [
			{ value: 'common', label: '通行版（默认）' },
			{ value: 'fajue', label: '法诀版' },
		] },
		// 南半球月令(只对南纬生效):不对冲 = 月柱同北半球(八字页缺省);对冲 = 月支取对冲之支、按年干重起月干。
		{ name: 'southMonth', label: '南半球月令', type: 'select', default: 'none', globalCurrent: ()=>storedBaziOptValue('southMonth'), group: '盘法', options: [
			{ value: 'none', label: '不对冲（默认）' },
			{ value: 'chong', label: '对冲' },
		] },
		{ name: 'dayunPrecision', label: '起运精度', type: 'select', default: 'precise', globalCurrent: ()=>storedBaziOptValue('dayunPrecision'), group: '盘法', options: [
			{ value: 'precise', label: '精确(年月日时,默认)' },
			{ value: 'integer', label: '整数(取整岁)' },
		] },
		{ name: 'cangVersion', label: '藏干版本', type: 'select', default: 'common', globalCurrent: ()=>storedBaziOptValue('cangVersion'), group: '盘法', options: [
			{ value: 'common', label: '通行版（默认）' },
			{ value: 'fenye', label: '分野加权' },
		] },
		// 节气微调（adjustJieqi）：本地引擎尚未实现该算法 → 暂从挂载设置面隐藏，避免选了不生效误导。
		// 字段仍由 model/buildFieldObject 保留默认 0（不破坏存档/快照结构）。Java 后端算法（BaZi.java
		// adjustJieqiInfo）供日后本地实现参考：仅当出生纬度 23.5°<|lat|<66.5° 时调整，把每个节气的儒略日
		// JDN 平移 delta 天后据以定月柱——北纬 delta=(lat−35)×2、南纬 delta=(lat+35)×2（35°为基准纬度）。
		// { name: 'adjustJieqi', label: '节气微调', type: 'switch', options: ON_OFF, default: 0, group: '取用' },
		// 断命流派(CnTraditionInput school):进快照(切「当前主用流派」标注)。merge 进 record.school →
		// buildChartBaziParams 挂上 params.school → buildBaziSnapshotText 据此标注;缺省 zonghe=现状。各派对照数据恒全算,此项只切主标注。
		{ name: 'school', label: '主用流派', type: 'select', default: 'zonghe', globalCurrent: ()=>storedBaziOptValue('school'), group: '流派', options: [
			{ value: 'zonghe', label: '传统综合（默认）' },
			{ value: 'fuyi', label: '扶抑派' },
			{ value: 'geju', label: '格局派' },
			{ value: 'tiaohou', label: '调候派' },
			{ value: 'bingyao', label: '病药派' },
			{ value: 'tongguan', label: '通关派' },
			{ value: 'mangpai', label: '盲派' },
			{ value: 'nayin', label: '纳音古法' },
		] },
		// 年龄口径 / 生肖归属:只改快照文字(大运岁数按虚岁 / 周岁;生肖按立春 / 正月初一岁首),与页面左栏同两档;
		// 缺省 = 八字页保存的档(页面出快照读的就是它)。进快照的项齿轮都得有,否则 AI 侧不可调也看不见
		{ name: 'ageStyle', label: '年龄', type: 'select', default: 'nominal', globalCurrent: ()=>storedBaziOptValue('ageStyle'), group: '盘法', options: [
			{ value: 'nominal', label: '虚岁' },
			{ value: 'real', label: '周岁' },
		] },
		{ name: 'zodiacBoundary', label: '生肖归属', type: 'select', default: 'lichun', globalCurrent: ()=>storedBaziOptValue('zodiacBoundary'), group: '盘法', options: [
			{ value: 'lichun', label: '立春' },
			{ value: 'lunar', label: '正月初一' },
		] },
		// 多运限(批A)：流年(逗号年份串) / 流月(节气月序1–12) / 流日(锚定首流年首流月,公历日1–31) / 流时(时辰序0–11)。
		// 全空(默认)=不追加多运限段=现状(守「默认即现状」)。流月读现成 subDirect[].flowMonths；流日/流时调 buildFlowDays/Hours。
		{ name: 'liunianSel', label: '流年(公历年,逗号分隔,如 2024,2025)', type: 'text', default: '', group: '运限' },
		{ name: 'liuyueSel', label: '流月(节气月序1–12,可多选)', type: 'multiselect', default: [], group: '运限', options: LUNAR_MONTH_OPTIONS },
		{ name: 'liuriSel', label: '流日(公历日1–31,可多选,锚定首流年首流月)', type: 'multiselect', default: [], group: '运限', options: LUNAR_DAY_OPTIONS },
		{ name: 'liushiSel', label: '流时(时辰序0–11子起,可多选,锚定首流日)', type: 'multiselect', default: [], group: '运限', options: SHICHEN_OPTIONS },
	] },
	ziwei: { kind: 'record', fields: [
		...ZIWEI_TIME_FIELDS,
		// 四化流派:进快照(切流派改星曜四化标注 + 后端格局判定)。merge 进 record.sihuaSchool →
		// buildChartZiweiParams 挂上 params.sihuaSchool → buildZiweiSnapshotForParams 临时切单例复算(用毕还原)。
		{ name: 'sihuaSchool', label: '四化流派', type: 'select', default: 'beipai', globalCurrent: ()=>ziweiGlobalValue('sihuaSchool'), group: '流派', options: [
			{ value: 'beipai', label: '通用·飞星(默认)' },
			{ value: 'zhongzhou', label: '中州派' },
			{ value: 'quanshu', label: '全书系' },
			{ value: 'beixiang', label: '北派(天相忌)' },
			{ value: 'custom', label: '自定义' },
		] },
		// 四化流派选 custom 时的随盘自定义表(JSON,形状 {"干":["禄星","权星","科星","忌星"]});
		// 留空=custom 档回落本机编辑器所存表。builder 端 normalizeSihuaCustomTable 校验,坏值不注入。
		{ name: 'sihuaCustomTable', label: '自定义四化表(JSON,配合流派=自定义)', type: 'text', default: '', group: '流派', showWhen: (d)=>d.sihuaSchool === 'custom',
			placeholder: '{"甲":["廉贞","破军","武曲","太阳"],...} 留空=用本机表' },
		// [Windows #80] 运限组提前:此前排在 40 项的最末组(时间换算→流派→传本 19 项→流派叠层 10 项→运限),
		//   460px 抽屉里要一路滚到底才看得见,用户报障「似乎没找着流年的勾选项」。仅调声明顺序,渲染按声明序分组。
		// 多选语义：大限/流年/流月对所选每项各产一段(流年×流月笛卡尔);流日/流时锚定到所选的第一个上层。
		// 全空(默认)=不追加[运限]段=现状(守「默认即现状」,逐字节一致)。总段数上限~50,超限截断+提示行。
		// 小限顺逆(P1-B):流年段「小限：」行的宫序方向(ZWLuckPanel buildXiaoxianItems 消费;
		// 曾只读全局 localStorage,schema 放出 liunianSel 却调不到顺逆口径 → 半截可控)。
		// 只影响流年段「小限」行:需填流年才生效
		{ name: 'ziweiXiaoxianYinyang', label: '小限顺逆(随流年段出)', type: 'select', default: '0', globalCurrent: ()=>ziweiGlobalValue('xiaoxianMode'), group: '运限', showWhen: (d)=>!!`${d.liunianSel || ''}`.trim(), options: [
			{ value: '0', label: '男顺女逆（默认）' }, { value: '1', label: '阳男阴女顺（中州）' },
		] },
		{ name: 'daxianSel', label: '大限(命盘宫位序0–11,可多选)', type: 'multiselect', default: [], group: '运限', options: ZIWEI_DAXIAN_OPTIONS },
		// [Windows #80] 标签此前叫「流年小限」——用户找「流年」找不着(报障原话「紫微挂载设置里似乎没找着流年的勾选项」)。
		//   这里留空≠不给流年:[运限概览] 段无条件给全大限×流年的年份干支映射;填年份才另出该年的完整流曜与四化落宫。
		{ name: 'liunianSel', label: '流年(公历年,逗号分隔,如 1996,2000;小限随年并出;留空=只看运限概览)', type: 'text', default: '', group: '运限' },
		{ name: 'liuyueSel', label: '流月(农历月1–12,可多选)', type: 'multiselect', default: [], group: '运限', options: LUNAR_MONTH_OPTIONS },
		{ name: 'liuriSel', label: '流日(农历日1–31,可多选,锚定首个上层)', type: 'multiselect', default: [], group: '运限', options: LUNAR_DAY_OPTIONS },
		{ name: 'liushiSel', label: '流时(时辰序0–11子起,可多选,锚定首个上层)', type: 'multiselect', default: [], group: '运限', options: SHICHEN_OPTIONS },

		// 传本/排盘开关(本地引擎):任一非默认 → buildZiweiSnapshotForParams 临时覆盖 ZWEngineOptions 并以本地引擎重排盘+重算格局,
		// 使挂载/导出快照与该盘传本设置一致;全默认(缺省·被 pruneOptionsToNonDefault 剪掉不进 record)=回退全局单例=现状逐字节一致。
		{ name: 'daxianSpan', label: '大限跨度', type: 'select', default: 10, globalCurrent: ()=>ziweiGlobalValue('daxianSpan'), group: '传本', options: ZW_DAXIAN_SPAN_OPTIONS },
		{ name: 'tianmaBasis', label: '天马依据', type: 'select', default: 'month', globalCurrent: ()=>ziweiGlobalValue('tianmaBasis'), group: '传本', options: ZW_TIANMA_BASIS_OPTIONS },
		{ name: 'starSet', label: '星集', type: 'select', default: 'full', globalCurrent: ()=>ziweiGlobalValue('starSet'), group: '传本', options: ZW_STAR_SET_OPTIONS },
		{ name: 'sanPan', label: '观察盘', type: 'select', default: 'tian', globalCurrent: ()=>ziweiGlobalValue('sanPan'), group: '传本', options: ZW_SANPAN_OPTIONS },
		{ name: 'shangShi', label: '天伤天使', type: 'select', default: 'fixed', globalCurrent: ()=>ziweiGlobalValue('shangShi'), group: '传本', options: ZW_SHANGSHI_OPTIONS },
		{ name: 'leapMonth', label: '闰月归月', type: 'select', default: 'mid_split', globalCurrent: ()=>ziweiGlobalValue('leapMonth'), group: '传本', options: ZW_LEAP_MONTH_OPTIONS },
		{ name: 'lateZi', label: '晚子时', type: 'select', default: 'global', globalCurrent: ()=>ziweiGlobalValue('lateZi'), group: '传本', options: ZW_LATE_ZI_OPTIONS },
		{ name: 'yearBoundary', label: '定年界线', type: 'select', default: 'lunar_1_1', globalCurrent: ()=>ziweiGlobalValue('yearBoundary'), group: '传本', options: ZW_YEAR_BOUNDARY_OPTIONS },
		{ name: 'huoling', label: '火铃起宫', type: 'select', default: 'sanhe', globalCurrent: ()=>ziweiGlobalValue('huoling'), group: '传本', options: ZW_HUOLING_OPTIONS },
		{ name: 'kongNaming', label: '空劫命名', type: 'select', default: 'modern', globalCurrent: ()=>ziweiGlobalValue('kongNaming'), group: '传本', options: ZW_KONG_NAMING_OPTIONS },
		{ name: 'brightnessSource', label: '星曜亮度', type: 'select', default: 'zi_jian', globalCurrent: ()=>ziweiGlobalValue('brightnessSource'), group: '传本', options: ZW_BRIGHTNESS_SOURCE_OPTIONS },
		// 亮度=自定义时的随盘亮度表(JSON,形状 {"星":{"支":"档"}};档=庙旺得地利平闲不陷)。
		// 留空=custom 档回落本机编辑器所存表;builder 端 normalizeBrightnessCustomTable 校验,坏值不注入。
		{ name: 'brightnessCustomTable', label: '自定义亮度表(JSON,配合亮度=自定义)', type: 'text', default: '', group: '传本', showWhen: (d)=>d.brightnessSource === 'custom',
			placeholder: '{"紫微":{"子":"平","丑":"庙"},...} 留空=用本机表' },
		{ name: 'lifeMasterBy', label: '命主取法', type: 'select', default: 'year_branch', globalCurrent: ()=>ziweiGlobalValue('lifeMasterBy'), group: '传本', options: ZW_LIFE_MASTER_BY_OPTIONS },
		{ name: 'changshengStart', label: '长生十二神', type: 'select', default: 'shui_tu', globalCurrent: ()=>ziweiGlobalValue('changshengStart'), group: '传本', options: ZW_CHANGSHENG_START_OPTIONS },
		{ name: 'changshengDirection', label: '长生顺逆', type: 'select', default: 'yinyang', globalCurrent: ()=>ziweiGlobalValue('changshengDirection'), group: '传本', options: ZW_CHANGSHENG_DIRECTION_OPTIONS },
		{ name: 'kongwangStyle', label: '空亡星式', type: 'select', default: 'double', globalCurrent: ()=>ziweiGlobalValue('kongwangStyle'), group: '传本', options: ZW_KONGWANG_STYLE_OPTIONS },
		{ name: 'kuiYue', label: '魁钺歌诀', type: 'select', default: 'jia_wu_geng', globalCurrent: ()=>ziweiGlobalValue('kuiYue'), group: '传本', options: ZW_KUIYUE_OPTIONS },
		{ name: 'liuYueBasis', label: '流月起法', type: 'select', default: 'doujun', globalCurrent: ()=>ziweiGlobalValue('liuYueBasis'), group: '传本', options: ZW_LIU_YUE_BASIS_OPTIONS },
		{ name: 'liunianSihuaGan', label: '流年四化', type: 'select', default: 'year_gan', globalCurrent: ()=>ziweiGlobalValue('liunianSihuaGan'), group: '传本', options: ZW_LIUNIAN_SIHUA_GAN_OPTIONS },
		// 流派叠层显示(纯后处理,开则挂载/导出快照注入对应 ground-truth 段:童限/三限/气数位/借宫/太岁)。默认全关=现状。
		{ name: 'childLimit', label: '童限(上大限前逐岁本命宫)', type: 'switch', default: 0, globalCurrent: ()=>ziweiGlobalValue('childLimit'), group: '流派叠层', options: ON_OFF, normalize: ZW_SWITCH01 },
		{ name: 'zhongxian', label: '沈氏三限(大限细分2.5年中限)', type: 'switch', default: 0, globalCurrent: ()=>ziweiGlobalValue('zhongxian'), group: '流派叠层', options: ON_OFF, normalize: ZW_SWITCH01 },
		{ name: 'huoPan', label: '活盘(点宫为太极点重排宫名)', type: 'switch', default: 0, globalCurrent: ()=>ziweiGlobalValue('huoPan'), group: '流派叠层', options: ON_OFF, normalize: ZW_SWITCH01 },
		{ name: 'qishuWei', label: '河洛气数位(官禄宫干四化回照)', type: 'switch', default: 0, globalCurrent: ()=>ziweiGlobalValue('qishuWei'), group: '流派叠层', options: ON_OFF, normalize: ZW_SWITCH01 },
		{ name: 'borrowPalace', label: '中州借宫(空宫借对宫正曜)', type: 'switch', default: 0, globalCurrent: ()=>ziweiGlobalValue('borrowPalace'), group: '流派叠层', options: ON_OFF, normalize: ZW_SWITCH01 },
		{ name: 'taiSuiRuGua', label: '紫云太岁入卦(关系人生肖落宫)', type: 'switch', default: 0, globalCurrent: ()=>ziweiGlobalValue('taiSuiRuGua'), group: '流派叠层', options: ON_OFF, normalize: ZW_SWITCH01 },
		{ name: 'flowLuanXi', label: '流鸾流喜(运限流曜)', type: 'switch', default: 0, globalCurrent: ()=>ziweiGlobalValue('flowLuanXi'), group: '流派叠层', options: ON_OFF, normalize: ZW_SWITCH01 },
		{ name: 'flowHuoLing', label: '流火流铃(运限流曜)', type: 'switch', default: 0, globalCurrent: ()=>ziweiGlobalValue('flowHuoLing'), group: '流派叠层', options: ON_OFF, normalize: ZW_SWITCH01 },
		{ name: 'flowShenshaOnChart', label: '流年神煞上盘(将前/岁前随流年)', type: 'switch', default: 0, globalCurrent: ()=>ziweiGlobalValue('flowShenshaOnChart'), group: '流派叠层', options: ON_OFF, normalize: ZW_SWITCH01 },
		{ name: 'taiSuiRelatives', label: '太岁关系人(支[:角色[:性别]],如 午:母:female 子)', type: 'text', default: '', globalCurrent: ()=>ziweiGlobalValue('taiSuiRelatives'), group: '流派叠层', showWhen: (d)=>(`${d.taiSuiRuGua}` === '1' || d.taiSuiRuGua === true),   /* 需开紫云太岁入卦 */
			// text→[{branch,role,sex}] 归一(与 live UI 同结构):否则 buildZiweiOverlayLines/taiSuiRuGua 的 Array.isArray 判死、挂载侧太岁入卦段静默丢失。
			// 文法扩展 `支[:角色[:性别]]`;裸支向后兼容(role/sex 空)。
			normalize: (v)=>{ if(Array.isArray(v)){ return v; } const bs = `${v == null ? '' : v}`.split(/[,，\s]+/).map((x)=>x.trim()).filter(Boolean); return bs.map((tok)=>{ const seg = tok.split(/[:：]/); return { branch: seg[0], role: seg[1] || '', sex: seg[2] || '' }; }); } },
		// 运限层(多选,批A)：大限已逐宫含于[宫位总览];选所选层即让快照追加[运限]段(逐层钻取四化落宫+流曜)。
		// 流年/流月/流日/流时是盘面交互导航,本由 chart 本地推算(无后端参数)→ 复用 ZWLuckPanel 同口径构造器。
	] },

	// ---- A 类：数算（时间换算 + 流派）----
	// 邵子参评数 method(明法/古法)：buildCanpingSnapshotForRecord/canpingLiunianSeries 透传 opts.method →
	// dayPalace(canpingLocal) 改命宫取法(明法=月支反向 / 古法=日支)，真改快照(round-trip 通)。默认 ming === 现状。
	// 神数正传 zc*：流派/求测时辰/父母年龄/元运/虚岁 → record.zc* → builder opts。
	// 缺省 → builder 回默认（铁板 + 本人时柱作求测时辰）＝现状，字节级一致。
	zhengchuan: { kind: 'record', fields: [
		...TIME_FIELDS_WITH_MEAN,
		{ name: 'zcSchool', label: '流派', type: 'select', default: 'tieban', group: '流派', options: [
			{ value: 'tieban', label: '铁板神数（默认）' },
			{ value: 'shaozi', label: '邵子神数' },
			{ value: 'dading', label: '大定神数' },
			{ value: 'liuqin', label: '六亲属相姓氏断' },
			{ value: 'xinyi', label: '铁算心易（查询）' },
		] },
		{ name: 'zcAskGz', label: '求测时辰（干支，留空取本人时柱）', type: 'text', default: '', group: '铁板', showWhen: zcSchoolIs('tieban') },
		{ name: 'zcFatherAge', label: '父生我时年龄', type: 'number', default: 27, min: 12, max: 99, group: '邵子', showWhen: zcSchoolIs('shaozi') },   // 值域与页面同
		{ name: 'zcMotherAge', label: '母生我时年龄', type: 'number', default: 26, min: 12, max: 99, group: '邵子', showWhen: zcSchoolIs('shaozi') },
		{ name: 'zcYuan', label: '元运（先天命卦余五特例）', type: 'select', default: 'zhong', group: '邵子', showWhen: zcSchoolIs('shaozi'), options: [
			{ value: 'shang', label: '上元' },
			{ value: 'zhong', label: '中元（默认）' },
			{ value: 'xia', label: '下元' },
		] },
		// 大定七位:四柱由生辰定，余三位(大运/小运/岁君)与虚岁皆由【所推之流年】派生 ——
		// 故此处主控亦是流年一项，下四格留作古法特例之手订(留空即自出)。
		{ name: 'zcDadingYear', label: '所推流年（余者自出）', type: 'number', default: 0, group: '大定', showWhen: zcSchoolIs('dading') },
		{ name: 'zcAge', label: '虚岁（留空自出）', type: 'number', default: 0, group: '大定', showWhen: zcSchoolIs('dading') },
		{ name: 'zcDayun', label: '大运（干支，留空自出）', type: 'text', default: '', group: '大定', showWhen: zcSchoolIs('dading') },
		{ name: 'zcXiaoyun', label: '小运（干支，留空自出）', type: 'text', default: '', group: '大定', showWhen: zcSchoolIs('dading') },
		{ name: 'zcSuijun', label: '岁君（干支，留空自出即当年太岁）', type: 'text', default: '', group: '大定', showWhen: zcSchoolIs('dading') },
		// 下拉档与神数页同:演算时辰 12 支(白天 / 昼夜两组四象),天象档随所选时辰(卯—申为天四象,其余为地四象;空 = 取本人时支、按时辰取首项)
		{ name: 'zcAskHourZhi', label: '演算时辰（留空取本人时支）', type: 'select', default: '', group: '六亲', showWhen: zcSchoolIs('liuqin'),
			options: [{ value: '', label: '（取本人时支）' }, ...DIZHI_12.map((z)=>({ value: z, label: `${z}时${ZC_DAY_ZHI.indexOf(z) >= 0 ? '（白天·天四象）' : '（昼夜·地四象）'}` }))] },
		{ name: 'zcEnv', label: '演算时天象', type: 'select', default: '', group: '六亲', showWhen: zcSchoolIs('liuqin'),
			options: [{ value: '', label: '（按时辰取首项）' }, ...zcEnvOptionsFor('')],
			// 档位随演算时辰(与神数页同一份 zcEnvOptionsFor);不属所选时辰那一套的天象回显「按时辰取首项」(引擎按首项算)。
			// 演算时辰留空 = 本人时支:抽屉按本盘四柱注入只读的 __zcOwnHourZhi(mountDraftContextFor);取不到时两组都列
			optionsFor: (d)=>[{ value: '', label: '（按时辰取首项）' }, ...zcEnvOptionsFor(d && (d.zcAskHourZhi || d.__zcOwnHourZhi))],
			displayValue: (v, d)=>zcEnvShown(d && (d.zcAskHourZhi || d.__zcOwnHourZhi), v) },
		{ name: 'zcItem', label: '查询项目', type: 'select', default: '父母', group: '心易', showWhen: zcSchoolIs('xinyi'), options: [
			{ value: '父母', label: '父母（默认）' }, { value: '兄弟', label: '兄弟' }, { value: '姻緣', label: '姻緣' },
			{ value: '子孫', label: '子孫' }, { value: '官祿', label: '官祿' }, { value: '疾病', label: '疾病' },
		] },
		// 心易五项与页面同为下拉(档位逐字取页面:声音 16 档 / 刻数 8 档 / 八宫 / 地支 / 余数 1–12);此前是文本框,可填后端不认的值
		{ name: 'zcSound', label: '声音', type: 'select', default: '日', group: '心易', showWhen: zcSchoolIs('xinyi'), options: ZC_SOUNDS.map((x)=>({ value: x, label: x })) },
		{ name: 'zcKe', label: '刻数', type: 'select', default: '一刻', group: '心易', showWhen: zcSchoolIs('xinyi'), options: ZC_KE.map((x)=>({ value: x, label: x })) },
		{ name: 'zcGong', label: '八宫', type: 'select', default: '乾', group: '心易', showWhen: zcSchoolIs('xinyi'), options: ZC_GONG.map((x)=>({ value: x, label: x })) },
		{ name: 'zcXqZhi', label: '性情项 · 地支', type: 'select', default: '子', group: '心易', showWhen: zcSchoolIs('xinyi'), options: DIZHI_12.map((x)=>({ value: x, label: x })) },
		{ name: 'zcXqYushu', label: '性情项 · 余数', type: 'select', default: '1', group: '心易', showWhen: zcSchoolIs('xinyi'), normalize: (v)=>(v === undefined || v === null ? v : `${v}`),
			options: Array.from({ length: 12 }, (_, i)=>({ value: `${i + 1}`, label: `${i + 1}` })) },
	] },
	canping: { kind: 'record', fields: [
		// 参评数以年柱纳音+月支+时支起,日柱/时干不入算(引擎 calculate 只回显 fourPillars)——
		// 日界/晚子时两档在本技法页面与无头皆无任何产物差异(差分闸 43/40 次候选×盘变体×日期扫描零差分),按「不放无效选项」撤下;时间算法保留。
		...TIME_FIELDS_WITH_MEAN.filter((f)=>f.name === 'timeAlg'),
		{ name: 'method', label: '取法', type: 'select', default: 'ming', group: '取法', options: [
			{ value: 'ming', label: '明法（月支反向，默认）' },
			{ value: 'gu', label: '古法（八字日支）' },
		] },
		// 大运排法三档与页面同枚举:此前挂载不暴露 → 页面选档挂载恒默认(不同构死角)。
		// baziStyle=八字真源注入(节气起运,与八字盘同源);默认 mingGongQiyun === 现状(零回归)。
		{ name: 'dayunRule', label: '大运排法', type: 'select', default: 'mingGongQiyun', group: '取法', options: [
			{ value: 'mingGongQiyun', label: '命宫顺行 · 生日推起运（默认）' },
			{ value: 'mingGongOne', label: '命宫顺行 · 恒一岁起' },
			{ value: 'baziStyle', label: '八字大运法（与八字盘同源）' },
		] },
	] },
	// 河洛 quHuaGong(取化工法)：无头 builder 恒按真实节气算化工(与河洛页同源);两档只差「四立前 18 日土用期是否补坤艮/反乾兑」。
	// 旧标签「月支近似」「真实节气」是 F-18 前的区分项,已不实 → 按真实差别改写。
	heluo: { kind: 'record', fields: [
		...TIME_FIELDS_WITH_MEAN,
		{ name: 'quHuaGong', label: '取化工法（皆按真实节气）', type: 'select', default: 'tuWangKunGen', group: '取化工', options: [
			{ value: 'tuWangKunGen', label: '土王寄坤艮（土用期补坤艮／反乾兑，默认）' },
			{ value: 'siFangBoOnly', label: '直取四方伯（土用期不补，仅四方伯卦）' },
		] },
		{ name: 'ziShuMode', label: '取数法', type: 'select', default: 'pair', group: '起卦分歧', options: [
			{ value: 'pair', label: '成对全取（古本，默认）' },
			{ value: 'single', label: '每支取一' },
		] },
		{ name: 'jiGongMode', label: '五寄中宫', type: 'select', default: 'manualSanYuan', group: '起卦分歧', options: [
			{ value: 'manualSanYuan', label: '三元表（默认）' },
			{ value: 'legacy', label: '旧法·性别' },
		] },
		{ name: 'pureGanKunVariant', label: '纯乾坤落爻', type: 'select', default: 'current', group: '起卦分歧', options: [
			{ value: 'current', label: '通行（节气半年，默认）' },
			{ value: 'alt', label: '抄本异（反向·待核）' },
		] },
		{ name: 'zhiZunEnabled', label: '三至尊卦', type: 'switch', options: ON_OFF, default: 1, group: '起卦分歧', normalize: (v)=>(v === true || v === 1 || v === '1') },
		{ name: 'liunianStep2', label: '流年次步', type: 'select', default: 'ying', group: '推运分歧', options: [
			{ value: 'ying', label: '应爻法（默认）' },
			{ value: 'sequential', label: '顺行（初→上）' },
		] },
		// 「流月起月 liuYueMode」齿轮撤下:快照只到流年卦、不含流月段,拨两档正文逐字相同(页面钻取表照常读该键);
		// 若日后把流月表纳入快照(需拍板:正文显著加长)再恢复此齿轮。
		{ name: 'huangdiOffset', label: '纪年基准（黄帝纪元差，默认 2697）', type: 'number', default: 2697, min: 0, max: 16799, group: '断验' },   // 值域与页面同(0 可达)
	] },
	yizhangjing: { kind: 'record', fields: [
		// 一掌经只用时支不用时干:「晚子时·时柱进次日」在本技法无产物差异(差分闸 40 次零差分),撤下;日界(日柱→神煞合参层)与时间算法保留。
		// 日界只进「神煞合参层」(一掌经本体只用时支):合参层关时隐藏、不计数不下发
		...TIME_FIELDS_WITH_MEAN.filter((f)=>f.name !== 'lateZiHourUseNextDay').map((f)=>(f.name === 'after23NewDay'
			? { ...f, label: '日界（日柱换日;仅神煞合参层）', showWhen: (d)=>(d.shenshaLayer === true || `${d.shenshaLayer}` === '1') }
			: f)),
		{ name: 'shunniRule', label: '顺逆规则', type: 'select', default: 'yangNanYinNv', group: '排盘分歧', options: [
			{ value: 'yangNanYinNv', label: '阳男阴女（默认）' },
			{ value: 'menShunNvNi', label: '男顺女逆' },
		] },
		{ name: 'mingGongMethod', label: '命宫定法', type: 'select', default: 'shiShang', group: '排盘分歧', options: [
			{ value: 'shiShang', label: '时上起命（默认）' },
			{ value: 'shuZhiMao', label: '数至卯' },
		] },
		{ name: 'dingYue', label: '定月法', type: 'select', default: 'nongli', group: '排盘分歧', options: [
			{ value: 'nongli', label: '农历月（默认）' },
			{ value: 'jieqi', label: '节气月' },
		] },
		{ name: 'dayunLength', label: '大限运长', type: 'select', default: 7, group: '推运分歧', options: [
			{ value: 7, label: '一宫7年（默认）' },
			{ value: 10, label: '一宫10年' },
		] },
		{ name: 'dayunStartAge', label: '大限起运', type: 'select', default: 'mi', group: '推运分歧', options: [
			{ value: 'mi', label: '秘传起运（默认）' },
			{ value: 'age1', label: '1岁连续' },
		] },
		// 随「逐年法」互斥显隐(与页面同):小限两键只在小限法、流年十二神只在流年法
		{ name: 'xiaoxianStart', label: '小限起宫', type: 'select', default: 'ri', group: '推运分歧', showWhen: (d)=>d.annualMethod !== 'liunian', options: [
			{ value: 'ri', label: '日柱宫（默认）' },
			{ value: 'yue', label: '月柱宫' },
		] },
		{ name: 'flowShenSet', label: '流年十二神', type: 'select', default: 'A', group: '推运分歧', showWhen: (d)=>d.annualMethod !== 'xiaoxian', options: [
			{ value: 'A', label: '甲组·太阳系（默认）' },
			{ value: 'B', label: '乙组·六合系' },
			{ value: 'C', label: '丙组·岁破系' },
		] },
		{ name: 'annualMethod', label: '逐年法', type: 'select', default: 'xiaoxian', group: '推运分歧', options: [
			{ value: 'xiaoxian', label: '小限（默认）' },
			{ value: 'liunian', label: '流年十二神' },
		] },
		{ name: 'xiaoxianDir', label: '小限顺逆', type: 'select', default: 'chart', group: '推运分歧', showWhen: (d)=>d.annualMethod !== 'liunian', options: [
			{ value: 'chart', label: '随盘向（默认）' },
			{ value: 'always', label: '一律顺行' },
		] },
		// 定月 = 节气月时没有闰月可言,页面置灰,齿轮不列
		{ name: 'leapRule', label: '闰月细则', type: 'select', default: 'half', group: '排盘分歧', showWhen: (d)=>d.dingYue !== 'jieqi', options: [
			{ value: 'half', label: '十五折半（默认）' },
			{ value: 'midnight', label: '夜半折半' },
		] },
		{ name: 'zaoZiAdjust', label: '早子调宫', type: 'switch', options: ON_OFF, default: 0, group: '排盘分歧', normalize: (v)=>(v === true || v === 1 || v === '1') },
		{ name: 'starNaming', label: '星名系统', type: 'select', default: 'A', group: '命宫与盘', options: [
			{ value: 'A', label: 'A·主流（默认）' },
			{ value: 'B', label: 'B·异名' },
			{ value: 'C', label: 'C·改名' },
		] },
		{ name: 'daoTerm', label: '六道术语', type: 'select', default: 'gui', group: '命宫与盘', options: [
			{ value: 'gui', label: '鬼道·修罗道（默认）' },
			{ value: 'edao', label: '饿鬼道·阿修罗道' },
		] },
		{ name: 'gradeSet', label: '品级分类', type: 'select', default: 'standard', group: '命宫与盘', options: [
			{ value: 'standard', label: '主流（默认）' },
			{ value: 'variant', label: '变体·天驿归凶' },
		] },
		{ name: 'chongfanKou', label: '重犯口诀', type: 'select', default: 'alpha', group: '断语分歧', options: [
			{ value: 'alpha', label: '常见组（默认）' },
			{ value: 'beta', label: '异传组' },
		] },
		{ name: 'tongxianShow', label: '童限', type: 'switch', options: ON_OFF, default: 1, group: '推运分歧', normalize: (v)=>(v === true || v === 1 || v === '1') },
		{ name: 'shenshaLayer', label: '神煞合参', type: 'switch', options: ON_OFF, default: 0, group: '合参层', normalize: (v)=>(v === true || v === 1 || v === '1') },
	] },

	// ---- B 类：事盘 options 驱动 ----
	// 基线按存档 options,旧存「阴盘」盘式先迁移(与页面载档 / 无头重算同一 migrateLegacyQimenSchool)
	// 事盘设置在 payload.options;命盘结构在 payload.qimen.options(与重算 regenerateQimenSnapshot 同一读法)
	qimen: { kind: 'payload', optionsPath: 'options', fields: QIMEN_FIELDS, baselineSource: (payload)=>{
		const chartShape = !!(payload && payload.qimen && typeof payload.qimen === 'object');
		const qs = chartShape ? payload.qimen : payload;
		const o = qs && qs.options && typeof qs.options === 'object' ? qs.options : null;
		if(!o){ return null; }
		// 存成命盘的盘类恒为命局(页面载入即命局;早先存的没记这一项)
		return migrateLegacyQimenSchool(chartShape && (o.chartCategory === undefined || o.chartCategory === null || o.chartCategory === '') ? { ...o, chartCategory: 'ming' } : o);
	} },
	taiyi: { kind: 'payload', optionsPath: 'options', fields: TAIYI_FIELDS, baselineSource: (payload)=>flattenTaiyiSchoolStored(payload, 'school', 'school_') },
	// 皇极轨策：🔴 kind='payload' —— 起卦所得(卦与动爻)是报数/字占/时辰之冻结值，永不按挂载重算
	// （重算即伪造一个不同之卦）；然其后诸演算(演数/卦变/断法/十应)皆自已冻结之卦派生 → 可随 options 重算。
	// 覆盖逐项按页面 setOption 落:改了单项、偏离存档所选预设 → 流派标「自定义」(页面同);
	// 否则存档「大定」预设被齿轮改掉数字配卦后,引擎仍按流派=大定出定数,与页面做不出的组合同盘
	guice: { kind: 'payload', optionsPath: 'options', group: '皇极轨策',
		// 流派先落(像页面「流派预设」那样套该派开关组,起卦法留着),其余逐项改(偏离预设 → 标自定义);「自定义」只是状态,不套预设
		applyOverrides: (stored, pruned)=>{
			let acc = { ...(stored || {}) };
			if(pruned.school !== undefined && GUICE_PRESETS[pruned.school]){ acc = applyGuicePreset(pruned.school, acc); }
			else if(pruned.school === 'custom'){ acc = { ...acc, school: 'custom' }; }
			return Object.keys(pruned).filter((k)=>k !== 'school').reduce((a, k)=>setGuiceOption(a, k, pruned[k]), acc);
		},
		// 齿轮换了流派:剪枝基准里受预设联动的项取该派的值(与重算「先套派、后调项」同序),否则「新派 + 某项恰等于存档值」被剪掉
		adjustPruneBaseline: (base, options)=>{
			if(!base || !options || !GUICE_PRESETS[options.school] || options.school === base.school){ return base; }
			const preset = applyGuicePreset(options.school, base);
			const out = { ...base };
			GUICE_FIELDS_NAMES().forEach((k)=>{ if(k !== 'school' && preset[k] !== undefined){ out[k] = preset[k]; } });
			return out;
		},
		// 整张草稿的抽屉里:换流派 = 套该派开关组(页面同);改单项 = 像页面那样逐项改,偏离所选预设时流派显示「自定义」
		onDraftChange: (draft, name, value)=>{
			if(name === 'school'){
				if(!GUICE_PRESETS[value]){ return draft; }
				const preset = applyGuicePreset(value, draft);
				const out = { ...draft };
				GUICE_FIELDS_NAMES().forEach((k)=>{ if(preset[k] !== undefined){ out[k] = preset[k]; } });
				return out;
			}
			if(GUICE_FIELDS_NAMES().indexOf(name) < 0){ return draft; }
			const next = setGuiceOption(draft, name, value);
			const out = { ...draft };
			GUICE_FIELDS_NAMES().forEach((k)=>{ if(next[k] !== undefined){ out[k] = next[k]; } });
			return out;
		},
		fields: [
		// 流派预设(与轨策页左栏同一张表;「自定义」是状态显示 —— 只在现值是它时列出)
		{ name: 'school', label: '流派预设', type: 'select', default: 'default', group: '流派',
			options: [...markDefaultOption(GUICE_SCHOOL_OPTIONS, 'default'), { value: 'custom', label: '自定义' }],
			optionShown: (o)=>o.value !== 'custom' },
		// 字段名与档名取轨策页同一份表(GUICE_OPTION_META);页面档名没写缺省的,齿轮在缺省档后补「（默认）」
		{ name: 'yanshuFa', label: guiceMetaLabel('yanshuFa'), type: 'select', default: 'ce', group: '演数', options: guiceMetaOptions('yanshuFa', 'ce') },
		{ name: 'qiguaShu', label: guiceMetaLabel('qiguaShu'), type: 'select', default: 'xiantian', group: '演数', options: guiceMetaOptions('qiguaShu', 'xiantian') },
		{ name: 'jiGongMode', label: guiceMetaLabel('jiGongMode'), type: 'select', default: 'ganrou', group: '演数', showWhen: (d)=>d.qiguaShu === 'houtian', options: guiceMetaOptions('jiGongMode', 'ganrou') },   /* 只在数字配卦 = 后天正数时起作用 */
		{ name: 'shiyingSet', label: guiceMetaLabel('shiyingSet'), type: 'select', default: 'xinyifawei', group: '断法', options: guiceMetaOptions('shiyingSet', 'xinyifawei') },
		// 显示条件与页面 schoolNeeds 同:六十甲子定数唯九畴数之系用之(「大定」预设即九畴;改掉数字配卦则流派随之标自定义,
		// 见上 applyOverrides);时方、神煞梅花不用;神煞附于时方(时方关则无效)
		{ name: 'dadingTable', label: guiceMetaLabel('dadingTable'), type: 'select', default: 'xinyifawei', group: '断法', showWhen: (d)=>d.qiguaShu === 'jiuchou', options: guiceMetaOptions('dadingTable', 'xinyifawei') },
		// 🔴 数系/时方/神煞 三项此前【漏登】—— 面板里根本调不着，而它们是九开关中的三个。
		//    (schema 会渲染成挂载设置里的真设置项，漏登=用户在挂载设置里见不到此项。)
		//    起卦法不登:其决定卦本身，而卦是【冻结值】—— 按挂载重起即伪造一个用户没见过的卦。
		{ name: 'shuXi', label: guiceMetaLabel('shuXi'), type: 'select', default: 'zhouyi', group: '断法', options: guiceMetaOptions('shuXi', 'zhouyi') },
		{ name: 'shiFang', label: guiceMetaLabel('shiFang'), type: 'switch', options: ON_OFF, default: false, group: '断法', normalize: (v)=>(v === true || v === 1 || v === '1'), showWhen: (d)=>d.shuXi !== 'meihua' },
		{ name: 'shenSha', label: guiceMetaLabel('shenSha'), type: 'switch', options: ON_OFF, default: false, group: '断法', normalize: (v)=>(v === true || v === 1 || v === '1'), showWhen: (d)=>d.shuXi !== 'meihua' && (d.shiFang === true || d.shiFang === 1 || d.shiFang === '1') },
	] },
	// 小六壬:课(三数)=冻结值不登;流派可重排(换环重排三传,三数不变)。
	xiaoliuren: { kind: 'payload', optionsPath: 'options', group: '小六壬', fields: [
		{ name: 'school', label: '流派', type: 'select', default: 'main', group: '起课', options: [
			{ value: 'main', label: '主流六宫（默认）' }, { value: 'dao', label: '道门九宫' },
		] },
		{ name: 'showOneThree', label: '一↔三(跨传关系行;古籍无定论,只列关系)', type: 'switch', options: ON_OFF, default: true, group: '判读',
			normalize: (v)=>(v === true || v === 1 || v === '1'), showWhen: (d)=>d.school === 'dao' },
	] },
	// 小成图:卦(起卦所出)=冻结值,起卦法/配数流派皆不登(重配=伪造卦);用宫可重排推演。
	xiaochengtu: { kind: 'payload', optionsPath: 'options', group: '小成图', fields: [
		{ name: 'yongGong', label: '用宫(推演起点)', type: 'select', default: 1, group: '推演', options: markDefaultOption(XCT_YONG_GONG_OPTIONS, 1) },   // 档名与小成图页同一份
		// 闢(离心)一象之辞两传本相反(往/來/闔三象两本一致):正传=古籍原文、异文=另本情伪论所推。
		{ name: 'piKoujing', label: '闢卦细判', type: 'select', default: 'zheng', group: '判读',
			options: markDefaultOption([{ value: 'zheng', label: XCT_PI_KOUJING_LABEL.zheng }, { value: 'yiwen', label: XCT_PI_KOUJING_LABEL.yiwen }], 'zheng') },
	] },
	// 飞宫小奇门:局(起支)=冻结值不登;命宫年龄性别只重排命宫目,不动局。
	feigong: { kind: 'payload', optionsPath: 'options', group: '飞宫小奇门', fields: [
		{ name: 'mingAge', label: '命宫年龄', type: 'number', default: null, group: '命宫' },
		{ name: 'mingGender', label: '命宫性别', type: 'select', default: 'male', group: '命宫', options: [
			{ value: 'male', label: '男（值五看戊）' }, { value: 'female', label: '女（值五看己）' },
		] },
		// 流月/河魁口径:payload.options 已存、builder 已消费(buildFeiGongSnapshotText o.liuYueMonth/o.koujing),曾只差齿轮。
		// 原写「留空=不列流月」,但 builder 是 `o.liuYueMonth || 1`(与右栏同源:未选即按正月),
		// 留空与选「1月」逐字同产 —— 「不列」这一档在本技法根本不可表达。按实况改文案(输出零变化)。
		{ name: 'liuYueMonth', label: '流月(留空=按正月)', type: 'select', default: '', group: '推演', options: [
			{ value: '', label: '正月（默认·与右栏同源,未选即按正月）' },
			...FEIGONG_LIU_YUE_MONTH_NAMES.map((m, i)=>({ value: i + 1, label: `${m}月` })),   // 档名与右栏流月下拉同
		] },
		{ name: 'koujing', label: '河魁口径', type: 'select', default: 'zheng', group: '推演', options: [
			{ value: 'zheng', label: '正传·收（默认）' }, { value: 'yi', label: '异文·开' },
		] },
	] },
	liureng: { kind: 'payload', optionsPath: '', fields: LIURENG_FIELDS },
	// 基线:存档顶层;「是否手选」随档(diFenAuto / wuxingAuto 为真 = 页面是自动档)→ 显示为「自动」,不露当时解析出的具体值
	jinkou: { kind: 'payload', optionsPath: '', fields: JINKOU_FIELDS, baselineSource: (payload)=>{
		const p = payload && typeof payload === 'object' ? payload : null;
		if(!p){ return null; }
		const out = { ...p };
		if(p.diFenAuto === true){ out.diFen = 'auto'; }
		if(p.wuxingAuto === true){ out.wuxing = 'auto'; }
		return out;
	} },
	sanshiunited: { kind: 'payload', optionsPath: 'options', fields: SANSHI_UNITED_FIELDS, baselineSource: (payload)=>migrateLegacyQimenSchool(flattenTaiyiSchoolStored(payload, 'taiyiSchool', 'taiyiSchool_')) },
	// 卜卦/择日盘的存档现状住 payload.extra.*(流派/判读口径/事类专项)与顶层 questionCategory;
	// 此前 optionsPath '' 只看顶层 → 基线恒退 schema 默认:抽屉显「综合·经典主流」撒谎,存了非默认类别/流派的案例
	// 「拨回默认」被剪空(值不可表达)。baselineSource 把存档层展平成 schema 字段名(hp_*/ep_* 前缀同齿轮键)。
	horary: { kind: 'payload', optionsPath: '', fields: HORARY_FIELDS, baselineSource: (payload)=>flattenHoraryStored(payload),
		// 换流派像页面一样清空逐项判读覆盖(HoraryMain 换派连同 horaryOverrides:{} 一起落):重算那边存档覆盖起点取空,
		// 这里剪枝基准的 hp_* 跟着取「随流派」—— 否则「新派 + 某项恰等于存档值」被剪掉,重算却已清掉存档那一项
		adjustPruneBaseline: (base, options)=>{
			// 流派是空串 / null(导入的数据、手改的 JSON 才带得进来)= 没设,不算换派(与重算侧 horaryGearSchoolChanged 同口径)
			if(!base || !options || options.horarySchool === undefined || options.horarySchool === null || options.horarySchool === ''
				|| horarySchoolOrDefault(options.horarySchool) === horarySchoolOrDefault(base.horarySchool)){ return base; }
			const out = { ...base };
			HORARY_JUDGE_FIELDS.forEach((f)=>{ if(!horaryJudgeFieldQuestionScoped(f)){ out[f.name] = ''; } });   // 问谁的事 / 问者性别属这一问,不随流派清
			return out;
		},
		// 整张草稿的抽屉里换流派:逐项判读参数回「随流派」(页面同),否则草稿里还是存档的旧值、与上面的基准一比全成了覆盖
		onDraftChange: (draft, name, value)=>{
			if(name !== 'horarySchool' || value === undefined || value === null || value === ''){ return draft; }
			const out = { ...draft };
			HORARY_JUDGE_FIELDS.forEach((f)=>{ if(!horaryJudgeFieldQuestionScoped(f)){ out[f.name] = ''; } });
			return out;
		},
	},
	election: { kind: 'payload', optionsPath: '', fields: ELECTION_FIELDS, baselineSource: (payload)=>flattenElectionStored(payload) },

	// ---- C 类：builder 自读 localStorage ----
	// localScopeHint:助手改技法本地设置时的作用范围 —— 七政页每个实例只在头一次打开时补一次空(ensureGuolaoDefaults;主 Tab 切走不卸载),
	// 打开时是「坚七政」样式则不补,切到别的样式后左栏字段头一次有变化(换盘、改时间地点或改左栏任一项)时补到那时的盘上
	guolao: { kind: 'localStorage', fields: GUOLAO_FIELDS,
		localScopeHint: '只在本次运行头一次打开七政页时补一次(打开时星盘样式若是「坚七政」,改为切到别的样式后、左栏头一次有变化时补到那时的盘上 —— 换盘、改时间地点或改左栏任一项都算):那张盘未载入记录、该项仍为出厂值才补上;此后新开的盘、当前已载入的盘都不变,重开软件后再补(改当前盘请用户在七政页左栏选;AI 分析口径用 facet=mount)',
		// 审批卡与写入回包给用户看的同义句(不写参数名、不用「请用户…」)
		localScopeHintForUser: '生效时机:本次打开软件后第一次进入七政页时,对还没载入记录、这一项仍是默认值的盘补上(进页时星盘样式若是「坚七政」,则在切到别的样式后、左栏第一次有变化时补上 —— 换盘、改时间地点或改左栏任一项都算);之后新开的盘和已载入的盘不受影响,下次重开软件再进七政页时再补。要改当前这张盘,请在七政页左栏选;只想改 AI 分析用的设置,请到 AI 分析的「挂载设置」' },

	// ---- D 类 / 无重算：只暴露内容勾选 ----
	// 换流派像页面 UranianDialMain.changeSchool 一样套该派预设(中点 / 个人点容许度、六宫框、严格因子集);选回「随全局」四项回随全局。
	// 只在换派时生效,不换派零回归(与六爻 / 卜卦齿轮同一模式)
	germany: { kind: 'record', fields: GERMANY_FIELDS,
		onDraftChange: (draft, name, value)=>{
			if(name !== 'school'){ return draft; }
			const out = { ...draft };
			if(value === '' || value === undefined || value === null){
				GERMANY_SCHOOL_PRESET_KEYS.forEach((k)=>{ out[k] = ''; });
				return out;
			}
			return { ...out, ...germanySchoolPresetDraft(value) };
		},
	},
	// 巴比伦占星:record 类可重算(恒星黄道·毕宿锚固定口径,体系定义即坐标,无可调齿轮);
	// 派系(阶梯/锯齿)只影响数理星历页显示,挂载快照恒取默认基线=零回归。
	// 🔴 旧 emptyHint「派系只影响数理星历页显示」与 babylonSchools.appliesTo:['horoscope',…] 直接矛盾:
	// ephemerisSource/solstice/era 均作用于被挂载的个人星盘页。页面派系是 state 不落档 → 齿轮为唯一持久入口。
	babylon: { kind: 'record', fields: [
		// 档名与巴比伦页派系同一份(BABYLON_SCHEMES.cn);此前另写一套简名,还和「位置源」的选项名相近
		{ name: 'babylonScheme', label: '派系', type: 'select', default: 'swissA10', group: '派系',
			options: BABYLON_SCHEME_ORDER.map((k)=>({ value: k, label: BABYLON_SCHEMES[k].cn })) },
		// 「位置源」只被页面历象表格消费(BabylonEphemeris 按源自算);无头快照的历象摘要恒取后端
		// 实位星历,该齿轮在挂载链无任何消费点 → 留着=「标注撒谎」候选,按「不放无效选项」撤下(页面开关不受影响)。
		// 「分至规范」齿轮已撤:快照只作表头声明、无任何量消费它(与已撤「位置源」F-55 同形);页面派系 state 仍可选。
		{ name: 'babylonEra', label: '纪元显示', type: 'select', default: 'seleucid', group: '派系', options: [
			{ value: 'seleucid', label: '塞琉古纪元(S.E.)' }, { value: 'arsacid', label: '安息纪元(= S.E.−64)' },
		] },
	] },
	// 老黄历:纯日期确定复算,无齿轮
	huangli: { kind: 'sectionsOnly', reason: '老黄历按起课日期确定复算,无可调参数;内容勾选照常。' },
	// 黄历择日:日课判定同 huangli 零参数;择吉三段随宿主快照槽实时产出,内容勾选照常。
	huanglizeri: { kind: 'sectionsOnly', reason: '黄历择日日课零可调参数;择吉配置/条件/命中随快照实时产出。' },
	// 八字择日:盘面口径随宿主工作台(与主八字页同枚举),快照槽实时产出;挂载复算不适用。
	bazizeri: { kind: 'sectionsOnly', reason: '八字择日盘面口径由择日工作台冻结,快照(八字全文+择时三段)实时产出;内容勾选照常。' },
	taiyizeri: { kind: 'sectionsOnly', reason: '太乙择日盘面口径由择日工作台冻结,快照(太乙全文+择时三段)实时产出;内容勾选照常。' },
	ziweizeri: { kind: 'sectionsOnly', reason: '紫微择日盘面口径由择日工作台冻结,快照(紫微全文+择时三段)实时产出;内容勾选照常。' },
	liurengzeri: { kind: 'sectionsOnly', reason: '六壬择日盘面口径由择日工作台冻结,快照(六壬全文+择时三段)实时产出;内容勾选照常。' },
	sanshizeri: { kind: 'sectionsOnly', reason: '三式择日盘面口径由择日工作台冻结,快照(三式合一全文+择时三段)实时产出;内容勾选照常。' },
	qizhengzeri: { kind: 'sectionsOnly', reason: '七政择日盘面口径由择日工作台冻结,快照(七政全文+择时三段)实时产出;内容勾选照常。' },
	indiazeri: { kind: 'sectionsOnly', reason: '印度择日挂载=择时三段自足(印度页星盘系无独立快照槽;印度盘全文用主印度页挂载)。' },
	// 通书择日:齿轮落 payload.tongshu(regenerate 读 {...defaults, ...p.tongshu} —— 该读点此前无任何写入方)
	// 缺省 = 通书页保存的设置(页面起断读的就是它;重算的底同源,见 regenCase 'tongshu')—— 此前缺省恒董公 / 嫁娶,页面改过流派的用户 AI 按另一派断
	tongshu: { kind: 'payload', optionsPath: 'tongshu', group: '通书择日', fields: [
		{ name: 'school', label: '流派', type: 'select', default: 'donggong', globalCurrent: ()=>tongshuPageSetting('school'), options: [
			{ value: 'donggong', label: '董公择日' },
			{ value: 'qimen', label: '奇门叠数（裴晋公·唐）' },
			{ value: 'sanyuanliexiu', label: '三垣列宿加临（古法）' },
			{ value: 'wutu', label: '天元乌兔' },
			{ value: 'sanyuan', label: '三元玄空大卦' },
		] },
		// 用事:全流派快照「用事：」抬头行 + 董公宜忌判读消费(曾缺 → 挂载恒「嫁娶」)。全表按类分组平铺。
		// 页面只在董公流派下出用事选择(schoolNeeds),齿轮同
		{ name: 'event', label: '用事', type: 'select', default: '嫁娶', globalCurrent: ()=>tongshuPageSetting('event'), showWhen: (d)=>(d.school || 'donggong') === 'donggong',
			// 同名用事在多类里重复出现(如「启钻」营建 / 丧葬各一条)时并成一档、标签列全类 —— 此前两档同值,选第二个显示成第一个
			options: TONGSHU_TERM_CATEGORIES.reduce((acc, cat)=>{
				(TONGSHU_TERMS[cat] || []).forEach((t)=>{
					const hit = acc.find((o)=>o.value === t.name);
					if(hit){ hit.label = `${hit.label.split('·').slice(0, -1).join('·')}/${cat}·${t.name}`; return; }
					acc.push({ value: t.name, label: `${cat}·${t.name}` });
				});
				return acc;
			}, []) },
		{ name: 'liexiuUse', label: '列宿用事类(三垣列宿加临)', type: 'select', default: '建宅', globalCurrent: ()=>tongshuPageSetting('liexiuUse'), showWhen: (d)=>d.school === 'sanyuanliexiu', options: [
			{ value: '建宅', label: '建宅·营造' },
			{ value: '修造', label: '修造·安门灶' },
			{ value: '安葬', label: '安葬·丧事' },
			{ value: '造命', label: '造命·择时立命' },
		] },
		// 主事仙命年(三元玄空档消费;曾缺 → 玄空派恒按甲子命年判)。when 对象式条件显隐。
		{ name: 'mingYear', label: '主事仙命年(三元玄空)', type: 'select', default: '甲子', globalCurrent: ()=>tongshuPageSetting('mingYear'), when: { school: 'sanyuan' },
			options: GANZHI_60.map((g)=>({ value: g, label: g })) },
		// zuoShan 已删:双重幽灵 —— 无任何流派声明 needs.zuoShan(页面控件永不渲染),快照 builder 全文不消费
		// (三元玄空段末自注「坐向卦须六十四卦天圆图…本法从缺」);齿轮选它 100% 无效果。
	] },
	// 🔴 旧定性「sectionsOnly 不可改卦象」过宽:不可改的只有卦象本身;21 项判读口径经冻结卦重算恒安全。
	sixyao: { kind: 'payload', optionsPath: 'liuyaoSettings', group: '六爻', fields: SIXYAO_FIELDS,
		// 存档现状住 payload.gua.liuyaoSettings(存档层);optionsPath 顶层是覆盖层(merge 写入、
		// mergeLiuyaoGearSettings 与存档合并)。基线锚必须读存档层,否则恒退 schema 默认。
		baselineSource: (payload)=>flattenLiuyaoStored(payload),
		// 齿轮换了流派:受流派联动的键按目标预设的值作剪枝基准(与重算「先套派、后调项」同序)——
		// 否则「新派 + 某项等于存档值」被剪掉,重算按预设值出(页面上做得出这个组合,显示为自定义)
		adjustPruneBaseline: (base, options)=>{
			if(!base || !options || options.school === undefined || options.school === base.school || !LIUYAO_PRESETS[options.school]){ return base; }
			const preset = applyLiuyaoPreset(options.school, base);
			['askType', 'yongOverride', 'benming'].forEach((k)=>{ if(base[k] !== undefined){ preset[k] = base[k]; } });
			return { ...base, ...flattenLiuyaoStored({ gua: { liuyaoSettings: preset } }), school: base.school };
		},
		// 整张草稿的抽屉里换流派:像页面「切换流派」那样把目标预设的细项写回草稿(占测事项 / 用神 / 本命留草稿值),
		// 否则草稿里还是存档的旧细项,与上面按预设作的剪枝基准一比,全成了「显式改回存档值」→ 结果成了自定义
		onDraftChange: (draft, name, value)=>{
			if(name !== 'school' || !LIUYAO_PRESETS[value]){ return draft; }
			const preset = applyLiuyaoPreset(value, draft);
			['askType', 'yongOverride', 'benming'].forEach((k)=>{ if(draft[k] !== undefined){ preset[k] = draft[k]; } });
			const flat = flattenLiuyaoStored({ gua: { liuyaoSettings: preset } }) || {};
			const out = { ...draft };
			SIXYAO_FIELDS.forEach((f)=>{ if(flat[f.name] !== undefined){ out[f.name] = flat[f.name]; } });
			out.school = value;
			return out;
		},
		emptyHint: '卦象与动爻取自已存起卦结果、恒不重起;以下皆为判读口径。' },
	tongshefa: { kind: 'sectionsOnly', reason: '统摄法基于已起卦象的确定性结果，仅可调纳入内容、不可重算。' },
	// 真阻断点=regenerateCaseTechniqueSnapshot 无 mundane 支(挂载只能直读 payload.aiSnapshot,无无头复算路径);
	// 「类型多样」是背景不是原因。判读口径(ruleset/orb/入境规则)欲开放须先造 headless builder,成本≫收益,维持只读。
	mundane: { kind: 'sectionsOnly', reason: '世俗盘按存档快照直读(无无头复算路径),仅可调纳入内容;判读口径请在世俗盘页调整后重存。' },
	tianxing: { kind: 'sectionsOnly', reason: '天星择日按存档快照直读(征象搜索结果为一次性产物,不按时间复算);要改条件请在择日页重搜后重存。' },
	qimenzeri: { kind: 'sectionsOnly', reason: '奇门择日按存档快照直读(找局结果为一次性产物,不按时间复算);要改条件/参数请在择日页重找后重存。' },
	// auxchart 页面键在挂载链会被映射成子 tab 技法键(aiExport auxchartMap 同构),此处条目永不命中
	// —— 曾挂着一条孤儿 sectionsOnly(挂载链未接),删除以免误导。
	// 报数/揲蓍 等确定性起卦术（均已在 CASE_TYPE_OPTIONS 可存为事盘 + saveModuleAISnapshot 存模块快照）：
	// 此前可存事盘却挂不上，补登记 sectionsOnly（挂载走缓存、不重算），与 sixyao/tongshefa/mundane 同范式。
	// 注：otherbu(骰子,随机)/fengshui(风水)/jieqi(节气盘) 暂不在 CASE_TYPE_OPTIONS（无事盘存储），不在此补挂载——见 windows/AGENTS 交接。
	// 起课时间挂载补全后,4 个数算技法 builder 收 opts → 可按用户挂载设置真重算:
	// taixuan/jingjue: seed 覆盖时间派生; wuzhao: mode/number/manual; shenyishu: hourSource/manualHour/seasonSource/manualSeason。
	// 默认值与各 Main.js state.* 同 → 不改时与现状字节级一致(守「默认即现状」)。
	// 四技法页面存档落 payload.options.*,齿轮 merge 写顶层(重算 `p[key] ?? options[key]` 顶层优先);
	// 此前基线只看顶层 → 抽屉恒显 schema 默认、「拨回默认」被剪。基线=存档 options 打底 + 顶层覆盖。
	wuzhao: { kind: 'payload', optionsPath: '', fields: WUZHAO_FIELDS, baselineSource: (payload)=>flattenOptionsStored(payload) },
	taixuan: { kind: 'payload', optionsPath: '', fields: TAIXUAN_FIELDS, baselineSource: (payload)=>flattenOptionsStored(payload) },
	jingjue: { kind: 'payload', optionsPath: '', fields: JINGJUE_FIELDS, baselineSource: (payload)=>flattenOptionsStored(payload) },
	shenyishu: { kind: 'payload', optionsPath: '', fields: SHENYISHU_FIELDS, baselineSource: (payload)=>flattenOptionsStored(payload) },
	// 🔴 天文地占旧定性「sectionsOnly」过宽:figure 由 seedMode:'manual'+seed 冻结(存档已带),
	// 判读轴(流派/层级/占星体系/所问宫/转宫)重算恒不换卦;seedMode/seed/question 不登(登=可伪造新卦)。
	// 默认 '' = 随档(prune 剪掉 → builder 落存档值);granular(传本逐项改写 dict)非控件型,随档回放不进齿轮。
	geomancy: { kind: 'payload', optionsPath: 'options', group: '天文地占',
		// 换流派预设像页面一样清空传本逐项改写(GeomancyMain.changeGeomancyOpt:换 tradition 连同 granular:{} 一起落);
		// 不换派时存档的逐项改写照旧随档回放。存档缺流派 = 页面默认古典定局派
		applyOverrides: (stored, pruned)=>{
			const st = stored && typeof stored === 'object' ? stored : {};
			const changed = pruned && pruned.tradition !== undefined && `${pruned.tradition}` !== `${st.tradition || 'european_classical'}`;
			const out = { ...st, ...(pruned || {}) };
			if(changed){ out.granular = {}; }
			return out;
		},
		fields: [
		{ name: 'tradition', label: '流派预设', type: 'select', default: '', blankFollowsBaseline: true, group: '判读', options: [
			{ value: '', label: '随档（默认）' },
			{ value: 'european_classical', label: '古典定局派' }, { value: 'european_planetary', label: '行星共鸣派' },
			{ value: 'european_modern', label: '现代综合派(判读同古典口径)' }, { value: 'arabic_raml', label: '阿拉伯沙占派' },
			{ value: 'india_ramal', label: '印度骰占派' }, { value: 'sikidy', label: '异或表盘(Sikidy)' },
			{ value: 'hakata', label: '四片盘(Hakata)' },
			// 起盘后页面按后端回传的全部 9 派可选(这两派显示名与 GeomancyMain TRADITION_EXTRA_LABELS 同)
			{ value: 'greek', label: '希腊拜占庭派' }, { value: 'ifa', label: '西非同族对照' },
		] },
		{ name: 'readingScope', label: '读取范围', type: 'select', default: '', blankFollowsBaseline: true, group: '判读', options: [
			{ value: '', label: '随档（默认）' },
			{ value: 'L0', label: 'L0 仅判官' }, { value: 'L1', label: 'L1 三图(证·判)' },
			{ value: 'L2', label: 'L2 盾牌全局' }, { value: 'L3', label: 'L3 十二宫' }, { value: 'L4', label: 'L4 占星定局' },
		] },
		{ name: 'zodiacSystem', label: '黄道体系', type: 'select', default: '', blankFollowsBaseline: true, group: '判读', options: [
			{ value: '', label: '随档（默认）' }, { value: 'classical', label: '古典定局体系' }, { value: 'planetary', label: '行星归属体系' },
			{ value: 'planetary_alt', label: '行星归属·乙(另一传本表)' },
		] },
		// 图形入宫三式:与落星法(granular,非控件型故不登齿轮)是正交两维
		{ name: 'housePlacement', label: '图形入宫', type: 'select', default: '', blankFollowsBaseline: true, group: '判读', options: [
			{ value: '', label: '随档（默认顺铺）' }, { value: 'sequential', label: '顺铺(一至十二卦入一至十二宫)' },
			{ value: 'angular', label: '四正入宫(果宫取合成卦)' }, { value: 'golden_dawn', label: '近世学派置换' },
		] },
		// 所问宫 / 转宫档名与地占页同一份(geomancyOptions.js)
		{ name: 'quesitedHouse', label: '所问宫', type: 'select', default: '', blankFollowsBaseline: true, group: '判读',
			options: [{ value: '', label: '随档/问类预设（默认）' }, ...GEO_QUESITED_HOUSE_OPTIONS.map((o)=>({ value: o.v, label: `第 ${o.v} 宫 · ${o.label}` }))] },
		{ name: 'turnTo', label: '转宫(以某宫为新命宫)', type: 'select', default: '', group: '判读',
			options: [{ value: '', label: '不转(本命起,默认)' }, ...GEO_TURN_HOUSE_LABELS.map((lb, i)=>({ value: i + 1, label: `第 ${i + 1} 宫 · ${lb}` }))] },
	] },
	// 灵棋经:卦(棋数)=冻结值不登(重掷=伪造一个用户没见过的卦);注家显示/课断/断诗/问类
	// 皆判读显示层,''=随档(三态 select,免 switch 默认值静默覆盖档内口径)。
	lingqi: { kind: 'payload', optionsPath: 'options', group: '灵棋经', emptyHint: '棋势取自已存起卦结果、恒不重掷;以下皆为判读显示口径。', fields: [
		// 注家四项:齿轮文字与页面左栏芯片同一份(简称 + 悬停全名;lingqiZhuChipLabel / lingqiZhuChipTitle 单源)
		...LINGQI_ZHU_META.map((zm)=>({ name: `zhu_${zm.key}`, label: lingqiZhuChipLabel(zm), title: lingqiZhuChipTitle(zm), type: 'select', default: '', blankFollowsBaseline: true, group: '注家', options: [
			{ value: '', label: '随档（默认）' }, { value: 1, label: '显示' }, { value: 0, label: '隐藏' },
		] })),
		{ name: 'zhu_ke', label: '课断', title: '此课总断', type: 'select', default: '', blankFollowsBaseline: true, group: '注家', options: [
			{ value: '', label: '随档（默认）' }, { value: 1, label: '显示' }, { value: 0, label: '隐藏' },
		] },
		{ name: 'zhu_shi', label: '断诗', title: '诗曰 / 又曰', type: 'select', default: '', blankFollowsBaseline: true, group: '注家', options: [
			{ value: '', label: '随档（默认）' }, { value: 1, label: '显示' }, { value: 0, label: '隐藏' },
		] },
		{ name: 'category', label: '问类', type: 'select', default: '', blankFollowsBaseline: true, group: '判读', options: [
			{ value: '', label: '随档（默认）' }, { value: 'general', label: '通用' }, { value: 'career', label: '仕途' },
			{ value: 'wealth', label: '求财' }, { value: 'marriage', label: '婚姻' }, { value: 'health', label: '疾病' },
			{ value: 'travel', label: '行人' }, { value: 'lawsuit', label: '官讼' }, { value: 'home', label: '家宅' },
		] },
	] },
	// 🔴 塔罗旧定性同上:牌面只由 deckId/spreadType/seed 决定(存档写死 manual+seed),
	// settings 全落判读层 —— 同一副牌不同判读文本恒安全;deckId/spreadType/seed/question 不登。
	tarot: { kind: 'payload', optionsPath: 'options', group: '塔罗', baselineSource: (payload)=>flattenTarotStored(payload), fields: [
		{ name: 'meaningSystem', label: '牌义体系', type: 'select', default: '', blankFollowsBaseline: true, group: '判读', options: [
			{ value: '', label: '随档（默认）' }, { value: 'manual', label: '逐牌义' }, { value: 'waite', label: 'Waite 1911' },
			{ value: 'degrees', label: '数字度(马赛)' },
		] },
		{ name: 'reversalMode', label: '逆位读法', type: 'select', default: '', blankFollowsBaseline: true, group: '判读', options: [
			{ value: '', label: '随档（默认）' }, { value: 'stored', label: '预存逆位义' }, { value: 'blocked', label: '受阻/压抑' },
			{ value: 'internal', label: '内化/私密' }, { value: 'opposite', label: '相反/反义' },
			{ value: 'reduced', label: '减弱' }, { value: 'excess', label: '过度/失衡' },
			{ value: 'delayed', label: '延迟/时机' }, { value: 'projection', label: '投射' }, { value: 'misuse', label: '误用/错向' },
			{ value: 'negation', label: '不是/没有' }, { value: 'breakthrough', label: '突破/解脱' }, { value: 're_words', label: '回撤/重审' },
			{ value: 'retreat', label: '回退前课' },
		] },
		// 变体 / 现代行星注 / 宫廷两体系:存档关着进阶对应时不出、不计、不下发(关着不生效,见 tarotCorrespondenceContext)
		{ name: 'variant', label: '字母/路径变体', type: 'select', default: '', blankFollowsBaseline: true, group: '判读', showWhen: tarotCorrespondenceShown('__tarotCorrespondenceVariant'), options: [
			{ value: '', label: '随档（默认）' }, { value: 'A', label: 'A 金色黎明' }, { value: 'B', label: 'B 托特' }, { value: 'C', label: 'C 大陆' },
		] },
		// 档名与顺序取塔罗页(通行五法 + 进阶三法,YESNO_MODE_LABEL)
		{ name: 'verdictMode', label: 'Yes/No 定局法', type: 'select', default: '', blankFollowsBaseline: true, group: '判读', options: [
			{ value: '', label: '随档（默认）' },
			...['majority', 'orientation', 'single', 'numeric', 'polarity', 'weighted_center', 'anchor', 'single3'].map((m)=>({ value: m, label: TAROT_YESNO_MODE_LABEL[m] })),
		] },
		{ name: 'dignities', label: '元素尊位', type: 'select', default: '', blankFollowsBaseline: true, group: '判读', options: [
			{ value: '', label: '随档（默认）' }, { value: 1, label: '开' }, { value: 0, label: '关' },
		] },
		{ name: 'suitElementSwap', label: '火/风互换(少数派)', type: 'select', default: '', blankFollowsBaseline: true, group: '判读', options: [
			{ value: '', label: '随档（默认）' }, { value: 1, label: '开' }, { value: 0, label: '关' },
		] },
		// TP9 判读齿轮扩容(五书补齐):全部判读显示层——同一副牌不同判读文本;牌面(deckId/spreadType/seed/牌池/朝向生成)恒不入。
		{ name: 'quintMode', label: '精华牌口径', type: 'select', default: '', blankFollowsBaseline: true, group: '判读', options: [
			{ value: '', label: '随档（默认）' }, { value: 'standard', label: '通行' }, { value: 'fool22', label: '愚人廿二(数值加法)' },
		] },
		// 元素尊位实际为开才出尊位版本:基线 flattenTarotStored 把存档 settings.dignities 摊成 1 / 0;选「随档」(空)时可能是开,照出
		{ name: 'edVersion', label: '尊位版本(元素尊位开时)', type: 'select', default: '', blankFollowsBaseline: true, group: '判读', showWhen: (d)=>`${d.dignities}` === '1' || d.dignities === '' || d.dignities === undefined || d.dignities === null, options: [
			{ value: '', label: '随档（默认）' }, { value: 'modern', label: '现行三档' }, { value: 'mathers', label: '原典四档' },
		] },
		{ name: 'ookTable', label: '开钥计数表', type: 'select', default: '', blankFollowsBaseline: true, group: '判读', options: [
			{ value: '', label: '随档（默认）' }, { value: 'standard', label: '通行' }, { value: 'sephira', label: '质点' },
		] },
		{ name: 'astroModern', label: '三元素大牌附现代行星注', type: 'select', default: '', blankFollowsBaseline: true, group: '判读', showWhen: tarotCorrespondenceShown('__tarotCorrespondenceVariant'), options: [
			{ value: '', label: '随档（默认）' }, { value: 1, label: '开' }, { value: 0, label: '关' },
		] },
		{ name: 'timingMethod', label: '计时法', type: 'select', default: '', blankFollowsBaseline: true, group: '判读', options: [
			{ value: '', label: '随档（默认）' }, { value: 'suit_unit', label: '花色单位' }, { value: 'major_number', label: '大牌数字' },
			{ value: 'major_zodiac', label: '大牌星座' }, { value: 'decan_full', label: '旬星全谱' }, { value: 'ace_hunt', label: '翻至王牌' },
		] },
		{ name: 'timingUnit', label: '计时单位(大牌数字法)', type: 'select', default: '', blankFollowsBaseline: true, group: '判读', showWhen: (d)=>d.timingMethod === 'major_number' || d.timingMethod === '' || d.timingMethod === undefined || d.timingMethod === null, options: [   // 只在大牌数字法下有用(选「随档」时可能是,照出)
			{ value: '', label: '随档（默认）' }, { value: '天', label: '天' }, { value: '周', label: '周' }, { value: '月', label: '月' },
		] },
		{ name: 'courtElementSystem', label: '宫廷元素体系', type: 'select', default: '', blankFollowsBaseline: true, group: '判读', showWhen: tarotCorrespondenceShown('__tarotCorrespondenceOn'), options: [
			{ value: '', label: '随档（默认）' }, { value: 'gd', label: '元素中元素' }, { value: 'alt', label: '位阶制' },
		] },
		{ name: 'courtZodiacSystem', label: '宫廷星座体系', type: 'select', default: '', blankFollowsBaseline: true, group: '判读', showWhen: tarotCorrespondenceShown('__tarotCorrespondenceOn'), options: [
			{ value: '', label: '随档（默认）' }, { value: 'gd_span', label: '跨段' }, { value: 'simple', label: '单座制' },
		] },
		{ name: 'crossingUpright', label: '交叉牌横置(恒正读)', type: 'select', default: '', blankFollowsBaseline: true, group: '判读', options: [
			{ value: '', label: '随档（默认）' }, { value: 1, label: '开' }, { value: 0, label: '关' },
		] },
	] },
};

// 星运系里「参数固定 = 现状」的纯推运技法：无可调重算项，但仍登记（显式 emptySchema）让自检无遗漏、UI 显示「仅内容勾选」。
// 批3 已为 zodialrelease/decennials/planetaryarc/persiandirected/vedicprog/jaynesprog/profection/solararc/
//   solarreturn/lunarreturn/givenyear 配了真 fields（上方显式登记），故从空集移除。
const PROGRESSION_EMPTY_KEYS = [
	'firdaria', 'planetaryages',
	'lunationphase', 'extrareturns',
	'ephemeris', 'returntimeline', 'prenatalsyzygy',   // 三页区间/年数为页面查询参数,非挂载齿轮
];
PROGRESSION_EMPTY_KEYS.forEach((key)=>{
	if(!TECHNIQUE_SETTINGS_SCHEMA[key]){
		TECHNIQUE_SETTINGS_SCHEMA[key] = {
			kind: 'record',
			fields: [],
			emptyHint: '该推运按本命盘的默认参数生成，挂载仅支持内容勾选。',
		};
	}
});

// 星运族的口径只有一套(星运页保存值,utils/directionPageSettings):这些齿轮字段的「现状默认」= 星运页保存的值
// (没保存过 = 出厂默认),AI 重算缺键时回落同一份(fillPageBoundDefaults)。此前齿轮基线与重算都只认出厂默认:
// 页面上把界推运发放点改成天顶,AI 分析 / 报告里仍按上升算,而且是否读到页面口径还取决于有没有打开过那一页。
// 键:技法 → { 齿轮字段: 星运页字段 };开关字段(交点逆移)页面存布尔、齿轮用 0/1。
export const DIRECTION_PAGE_BOUND_FIELDS = {
	persiandirected: { rateKey: 'persianRateKey', direction: 'persianDirection', maxYears: 'persianMaxYears' },
	decennials: { startMode: 'decennialStartMode', orderType: 'decennialOrderType', dayMethod: 'decennialDayMethod', calendarType: 'decennialCalendarType' },
	triplicityrulers: { division: 'triplicityDivision', lifespan: 'triplicityLifespan' },
	keypoints: { mode: 'keypointsMode' },
	prog: { minorVariant: 'minorVariant' },
	vedicprog: { minorVariant: 'minorVariant' },
	jaynesprog: { minorVariant: 'minorVariant' },
	profection: { nodeRetrograde: 'nodeRetrograde', profGrain: 'profGrain', profStart: 'profStart' },
	solararc: { nodeRetrograde: 'nodeRetrograde' },
	planetaryarc: { nodeRetrograde: 'nodeRetrograde' },
	balbillus: { startPlanet: 'balbillusStartPlanet', yearType: 'balbillusYearType', mode: 'balbillusMode', subRule: 'balbillusSubRule' },
	yearsystem129: { ys129StartPlanet: 'ys129StartPlanet', ys129Order: 'ys129Order', ys129YearType: 'ys129YearType', ys129SubRule: 'ys129SubRule' },
	distributions: { distReleaser: 'distReleaser', distMethod: 'distMethod', distYear: 'distYear', distYears: 'distYears' },
	agepoint: { apMethod: 'apMethod', apEvents: 'apEvents', apYear: 'apYear', apMaxAge: 'apMaxAge' },
};

function directionPageValue(field, pageKey){
	const v = DIRECTION_PAGE_SETTINGS.load()[pageKey];
	if(v === undefined || v === null){
		return undefined;
	}
	return field.type === 'switch' ? (v ? 1 : 0) : v;
}

Object.keys(DIRECTION_PAGE_BOUND_FIELDS).forEach((key)=>{
	const schema = TECHNIQUE_SETTINGS_SCHEMA[key];
	if(!schema || !Array.isArray(schema.fields)){
		return;
	}
	const map = DIRECTION_PAGE_BOUND_FIELDS[key];
	// 字段对象可能被几门技法共用:复制一份再挂 globalCurrent,不改动共用的那份
	schema.fields = schema.fields.map((field)=>{
		const pageKey = map[field.name];
		if(!pageKey){
			return field;
		}
		const bound = { ...field, pageBoundKey: pageKey };
		bound.globalCurrent = ()=>directionPageValue(bound, pageKey);
		return bound;
	});
});

// AI 重算入口:记录里缺的星运页口径字段按星运页保存值补上(齿轮覆盖 / 记录已有的值不动)。
export function fillPageBoundDefaults(key, record){
	const map = DIRECTION_PAGE_BOUND_FIELDS[`${key || ''}`];
	const schema = TECHNIQUE_SETTINGS_SCHEMA[`${key || ''}`];
	if(!map || !schema || !record || typeof record !== 'object'){
		return record;
	}
	let out = record;
	schema.fields.forEach((field)=>{
		if(!field.pageBoundKey || (record[field.name] !== undefined && record[field.name] !== null && record[field.name] !== '')){
			return;
		}
		const v = fieldCurrentDefault(field);
		if(v !== undefined && v !== null){
			if(out === record){ out = { ...record }; }
			out[field.name] = v;
		}
	});
	return out;
}

// ---- 取 schema / 默认值 ----

export function getTechniqueSettingsSchema(key){
	const k = `${key || ''}`;
	return TECHNIQUE_SETTINGS_SCHEMA[k] || null;
}

export function isSectionsOnlyTechnique(key){
	const schema = getTechniqueSettingsSchema(key);
	return !!(schema && schema.kind === 'sectionsOnly');
}

// schema 是否提供「可重算的可调项」（有 fields 且非 sectionsOnly）。
export function hasMountSettingsFields(key){
	const schema = getTechniqueSettingsSchema(key);
	return !!(schema && schema.kind !== 'sectionsOnly' && Array.isArray(schema.fields) && schema.fields.length > 0);
}

export function getTechniqueSettingsDefaults(key){
	const schema = getTechniqueSettingsSchema(key);
	const out = {};
	if(!schema || !Array.isArray(schema.fields)){
		return out;
	}
	schema.fields.forEach((field)=>{
		// 数组型默认（multiselect 等）返回新副本，防共享引用被 UI 草稿就地改动污染 schema。
		out[field.name] = Array.isArray(field.default) ? [...field.default] : field.default;
	});
	return out;
}

// 「现状」草稿锚 = schema 默认 + globalCurrent 现值(与两参 pruneOptionsToNonDefault 的比较锚 fieldCurrentDefault 同源)。
// 设置草稿此前用 getTechniqueSettingsDefaults(裸 schema 默认)铺底、再用两参 prune(锚=全局现值)剪枝
// → 用户在全局改过的键(如界系=托勒密)在草稿里显示 schema 默认,一改别的项就以「≠全局现值」被存成覆盖(136 个 globalCurrent 字段同病)。
export function getTechniqueSettingsCurrentDefaults(key){
	const schema = getTechniqueSettingsSchema(key);
	const out = {};
	if(!schema || !Array.isArray(schema.fields)){
		return out;
	}
	schema.fields.forEach((field)=>{
		const v = fieldCurrentDefault(field);
		out[field.name] = Array.isArray(v) ? [...v] : v;
	});
	return out;
}

// 数组型 field 的归一化：排序后 join（顺序无关），空数组 → ''（与默认空数组等价，剪掉）。
function normalizeArrayForCompare(v){
	if(!Array.isArray(v)){
		return v;
	}
	// 对象元素必须 JSON 化:`${x}`='[object Object]' 对 taiSuiRelatives 这类对象数组零判别
	// (不同关系人列表被误判相同而剪空,审查实抓 Issue#76 输入地支不生效的一半病因)。
	return [...v].map((x)=>(x && typeof x === 'object' ? JSON.stringify(x) : `${x}`)).sort().join(',');
}

// 把一份「可能含默认值」的 options 收敛为「只保留与默认不同的项」（默认即现状：空对象 = 不覆盖）。
// 🔴 比较锚升级「非默认」→「非现状」:第三参 baseline(该盘实际生效值,如 record/
// 存档 payload)存在时,比较锚 = baseline[name](present)?? field.default。
// 由来(用户实锤):astrochart hsys 的 schema default=0(整宫制)而存盘现状恒为 1(Alcabitus)——
// 「选整宫制」≡「选 schema 默认」被三道 prune 连剪,该值**永远不可表达**;凡 schema 默认 ≠
// 盘存值的字段(zodiacal/termsVariant/tradition…)同构发病。锚到盘现状后:与盘不同才算覆盖,
// 调回盘现状=不覆盖(「默认即现状」契约的正确实现——现状是盘的现状,不是 schema 的想象)。
// 无 baseline(模板等无盘场景)回退 schema default 旧语义。
// 「现状默认」单源:field.globalCurrent(全局仓种子键——页面种子=全局现值、
// 存盘「值==种子不落键」,record 缺键的真实语义=「随全局」而非内建 schema 默认;15 键族
// westNodeType 系+古典口径 10 键)优先于 field.default。prune 比较锚与抽屉基线显示共用。
// 紫微 A 类基线锚=全局单例现值(ZWEngineOptions/ZWSchool),非裸 schema 默认。
// builder 缺省回退的正是这两个单例——基线读同一变量 = 与回退口径 by construction 恒等:
// 左栏(全局)开了太岁入卦时,挂载拨「关」若锚 schema 默认(0)会被 prune 剪空 → 走 live
// 快照(读全局=开)→ 开关不生效(Win Issue#76 用户实锤;WP-1 termsVariant 同型病)。
// switch 型单例存 boolean、schema 用 0/1 —— 归一到 0/1(prune 是字符串化比较,'true'≠'1'会假 override)。
function ziweiGlobalValue(key){
	const v = key === 'sihuaSchool' ? ZWSchool.school : ZWEngineOptions[key];
	if(v === undefined || v === null){ return undefined; }
	if(typeof v === 'boolean'){ return v ? 1 : 0; }
	// 对象数组(taiSuiRelatives)必须转文本形:text 字段的抽屉输入框 `${value}` 渲染,
	// 数组直出=显示 [object Object] 且用户一编辑就切出垃圾关系人(复审 F2 实抓)。
	if(Array.isArray(v)){
		return v.map((r)=>(r && typeof r === 'object' ? [r.branch, r.role, r.sex].filter(Boolean).join(':') : `${r}`)).join(' ');
	}
	return v;
}

// 单字段「现值缺省」(globalCurrent 现值优先,回落 schema 默认):抽屉渲染 / 工具描述 / 剪枝共用
export function fieldCurrentDefault(field){
	if(field && typeof field.globalCurrent === 'function'){
		try{
			const v = field.globalCurrent();
			if(v !== undefined && v !== null){
				return v;
			}
		}catch(_e){ /* 回落静态默认 */ }
	}
	return field ? field.default : undefined;
}

// B 类基线段解析(effectiveMountBaseline / payloadMountBaseline / mergeOptionsIntoPayload 内层
// prune 三处共用同一双眼睛):schema.baselineSource(payload) 优先(存档层与 optionsPath 不同层的
// 技法,如六爻存档在 payload.gua.liuyaoSettings 而 optionsPath 顶层是覆盖层);否则按 optionsPath。
// 🔴 三处必须同锚 —— 复查轮内容级差分闸实锤:外层判覆盖(存档层锚)放行、merge 内层(顶层锚)
// 二次剪掉「=schema 默认但≠存档」的拨值 ⇒ 覆盖蒸发,重算出的仍是存档档。
export function payloadSegmentOf(schema, payload){
	if(!schema || !payload || typeof payload !== 'object'){
		return null;
	}
	if(typeof schema.baselineSource === 'function'){
		try{
			const seg = schema.baselineSource(payload);
			return seg && typeof seg === 'object' ? seg : null;
		}catch(_e){
			return null;
		}
	}
	const path = schema.optionsPath;
	if(path === '' || path === undefined || path === null){
		return payload;
	}
	const seg = payload[path];
	return seg && typeof seg === 'object' ? seg : null;
}

export function payloadBaselineSegment(schema, record){
	try{
		const raw = record && typeof record === 'object' ? record.payload : null;
		if(!raw){
			return null;
		}
		const payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
		return payloadSegmentOf(schema, payload);
	}catch(_e){
		return null;
	}
}

// C 类基线:builder 真实消费序 = record 平铺长名(field.recordKey,随盘保真键) 优先、
// 全局 localStorage 兜底、schema 默认收尾 —— 此前只认全局,record 带 guolaoLifeMode 的盘
// 抽屉显示全局值而内容按 record 值(误导),「拨回=全局值」被剪空(覆盖失效)。
// 数字型 default 的字段把串值转回数字(storage 恒存串,不转则 select 显示与 prune 比对全乱套)。
export function localStorageMountBaseline(key, record){
	const schema = getTechniqueSettingsSchema(key);
	const out = {};
	if(!schema || schema.kind !== 'localStorage' || !Array.isArray(schema.fields)){
		return out;
	}
	const rec = record && typeof record === 'object' ? record : null;
	schema.fields.forEach((field)=>{
		if(rec && field.recordKey && rec[field.recordKey] !== undefined && rec[field.recordKey] !== null && rec[field.recordKey] !== ''){
			const rv = rec[field.recordKey];
			out[field.name] = (typeof field.default === 'number') ? Number(rv) : rv;
			return;
		}
		if(rec && field.recordMissingIsDefault){
			out[field.name] = field.default;
			return;
		}
		// 带随盘代次标记的记录缺七政起盘键 = 存盘时是出厂值(页面载入后即此值;AI 构造器同口径)。岁差出厂为空 → 照旧取本机仓
		if(rec && field.recordKey && recordHasCaptureMark(rec) && Object.prototype.hasOwnProperty.call(GUOLAO_RECORD_FACTORY_DEFAULTS, field.recordKey)
			&& GUOLAO_RECORD_FACTORY_DEFAULTS[field.recordKey] !== ''){
			const fv = GUOLAO_RECORD_FACTORY_DEFAULTS[field.recordKey];
			out[field.name] = (typeof field.default === 'number') ? Number(fv) : fv;
			return;
		}
		let v = null;
		if(field.storageKey && typeof window !== 'undefined' && window.localStorage){
			try{ v = window.localStorage.getItem(field.storageKey); }catch(_e){ v = null; }
		}
		if(v === null || v === undefined || v === ''){
			out[field.name] = field.default;
			return;
		}
		out[field.name] = (typeof field.default === 'number') ? Number(v) : v;
	});
	return out;
}

// 平铺键撞名(同一个记录平铺键被几个技法的齿轮按各自的值域用:school 量化盘 / 八字等,method 铁板 / 策天 / 参评,mode,direction):
// 齿轮覆盖并进记录是逐技法的副本、存盘链不写这些键 —— 应用内触发不了(合同测试有探针);但导入的旧数据 / 手改的记录可能带着
// 别的技法的值。每个技法只认自己值域里的值:「只在别的技法值域里、不在本技法值域里」的值 = 外来值,当没设。
// 撞名表按齿轮定义自动求(记录类 + 走命盘管道的 payload 类,按 recordKey || name 归组、有两个技法的值域互不包含即算),新撞名自动纳入。
let sharedFlatKeyDomains = null;
function flatKeyDomains(){
	if(sharedFlatKeyDomains){ return sharedFlatKeyDomains; }
	const by = {};
	Object.keys(TECHNIQUE_SETTINGS_SCHEMA).forEach((tk)=>{
		const sc = TECHNIQUE_SETTINGS_SCHEMA[tk];
		if(!sc || !Array.isArray(sc.fields) || !(sc.kind === 'record' || (sc.kind === 'payload' && sc.chartRoute))){ return; }
		sc.fields.forEach((f)=>{
			if(!Array.isArray(f.options) || !f.options.length){ return; }
			const t = f.recordKey || f.name;
			(by[t] = by[t] || {})[tk] = new Set(f.options.map((o)=>`${o && o.value}`));
		});
	});
	const out = {};
	Object.keys(by).forEach((t)=>{
		const techs = Object.keys(by[t]);
		if(techs.length < 2){ return; }
		// 同义共用的键(时间算法 / 交角容许度:各技法值域互为子集)不算撞名;有一对互不包含 = 各按各的含义用同一个键
		const sub = (a, b2)=>[...a].every((v)=>b2.has(v));
		const clash = techs.some((a, i)=>techs.slice(i + 1).some((b2)=>!sub(by[t][a], by[t][b2]) && !sub(by[t][b2], by[t][a])));
		if(clash){ out[t] = by[t]; }
	});
	sharedFlatKeyDomains = out;
	return out;
}
export function sharedFlatRecordKeys(){
	return Object.keys(flatKeyDomains()).sort();
}
// value 是不是别的技法写进来的(不在 techKey 的值域、在另一个撞名技法的值域)
export function isForeignFlatValue(techKey, recordKey, value){
	const dom = flatKeyDomains()[recordKey];
	if(!dom || value === undefined || value === null || value === ''){ return false; }
	const own = dom[`${techKey || ""}`];
	const v = `${value}`;
	if(!own || own.has(v)){ return false; }
	return Object.keys(dom).some((tk)=>dom[tk].has(v));
}
// 重算入口用:去掉记录里属于别的技法的撞名平铺值(只改副本)
export function scrubForeignFlatValues(techKey, record){
	if(!record || typeof record !== 'object'){ return record; }
	let out = record;
	Object.keys(flatKeyDomains()).forEach((t)=>{
		if(isForeignFlatValue(techKey, t, record[t])){
			if(out === record){ out = { ...record }; }
			delete out[t];
		}
	});
	return out;
}

const RECORD_MISSING_MANIFEST_KEYS = new Set(RECORD_FIELDS_RESTORE_MANIFEST.map((m)=>m.key).filter((k)=>RECORD_MISSING_IDENTITY_KEYS.indexOf(k) < 0));

export function effectiveMountBaseline(key, record){
	const schema = getTechniqueSettingsSchema(key);
	const out = {};
	if(!schema || !Array.isArray(schema.fields)){
		return out;
	}
	let src = record && typeof record === 'object' ? record : {};
	if(schema.kind === 'localStorage'){
		// C 类现状=record 长名(随盘保真) ?? 全局 storageKey 现值 —— 此前读平铺
		// 短名恒退化 schema 默认:抽屉不显示真实现状,「选 schema 默认」在现状非默认时被剪空。
		return localStorageMountBaseline(key, record);
	}
	if(schema.kind === 'payload' && !schema.chartRoute){
		// 🔴 B 类(payload)技法的现状住 record.payload 存档段,不在平铺键——
		// 此前一律读平铺键 ⇒ B 类基线恒退化 schema 默认:抽屉打开显示想象值(A 类实锤的同型
		// 二次误导),且「存档非默认时调回 schema 默认档」在 UI 层即被剪空,永远到不了重算入口
		// 的 payload 现状锚。
		src = payloadBaselineSegment(schema, src) || {};
	}else if(schema.kind === 'payload' && schema.chartRoute){
		// chartRoute 例外(cetian/huangji):payload kind 但走 A 路,覆盖写 record 平铺;
		// 现状=存档段(事盘 payload,经 baselineSource 映射)打底 + 平铺覆盖——
		// 只锚平铺时,huangji 事盘(存档在 payload.options)基线恒退 schema 默认。命盘无 payload
		// 段自然回落纯平铺(cetian 不受影响)。
		const seg = payloadBaselineSegment(schema, src);
		if(seg){
			const flat = {};
			schema.fields.forEach((f)=>{
				if(src[f.name] !== undefined && src[f.name] !== null){ flat[f.name] = src[f.name]; }
			});
			src = { ...seg, ...flat };
		}
	}
	// record 类事盘:平铺键缺席时构造器改读存档 payload.options 的同名键(宿占 suzhanFieldsForRecord),基线同口径
	src = fillRecordPayloadKeys(schema, src);
	// 紫微:带紫微代次标记的盘,缺的随盘设置 = 存盘时是出厂默认 → 基线取字段默认(不取当前全局现值),
	// 与 AI 挂载构造器、载入该盘后的盘面同一口径。
	const ziweiMarked = key === 'ziwei' && recordHasZiweiSettingsGen(record);
	schema.fields.forEach((field)=>{
		if(src[field.name] !== undefined && src[field.name] !== null && !isForeignFlatValue(key, field.recordKey || field.name, src[field.name])){
			out[field.name] = src[field.name];
		}else if(ziweiMarked && ZIWEI_RECORD_SETTING_KEYS.has(field.name)){
			out[field.name] = field.default;
		}else if(schema.kind === 'record' && !field.baselineRecordKey && RECORD_MISSING_MANIFEST_KEYS.has(field.name)){
			// 随盘清单键缺席:与页面载入、AI 构造器同一个缺键单源(recordMissingValue)——带标记 = 存盘时为默认(古典口径取
			// spec 默认、种子键取「记录缺键时的取值」、其余取 schema 初值);旧盘非种子键随全局(既有口径)。
			// 撤出档 / 空值(null)= 消费方缺省 → 显示字段现值缺省
			const m = recordMissingValue(record, field.name);
			out[field.name] = m.kind === 'value' && m.value !== null && m.value !== undefined ? m.value
				: (m.kind === 'drop' && m.value !== null && m.value !== undefined ? m.value : baselineAliasOrDefault(field, src));
		}else{
			out[field.name] = baselineAliasOrDefault(field, src);
		}
	});
	// 存档段带出的只读上下文键(塔罗进阶对应门控):随基线给显隐判据,不是字段、不计覆盖
	return schema.kind === 'payload' ? { ...out, ...mountContextOf(src) } : out;
}

// 只读上下文键:以 __ 开头、不是 schema 字段 —— 显隐判据要看、但齿轮改不了的本盘事实(存档段经 baselineSource 带出,
// 或抽屉按本盘算出的 mountDraftContextFor)。剪枝、抽屉显隐、AI 工具的显隐判定都从基线取同一份,只读、不计覆盖、不下发
export function mountContextOf(src){
	const out = {};
	if(src && typeof src === 'object'){
		Object.keys(src).forEach((k)=>{ if(k.indexOf('__') === 0 && src[k] !== undefined && src[k] !== null){ out[k] = src[k]; } });
	}
	return out;
}

// 只读基线别名:齿轮短名缺席时先看 record 上的同义长名(field.baselineRecordKey;如三分主星 system ← 盘存
// triplicity),再回 globalCurrent/默认。与 recordKey 不同:不改覆盖写回目标(写回仍落短名,不动排盘参数)。
// 外层(effectiveMountBaseline)与内层(pruneOptionsToNonDefault 直接拿 record 当基线)同用 → 双层锚同构。
function baselineAliasOrDefault(field, src){
	if(field && field.baselineRecordKey && src && src[field.baselineRecordKey] !== undefined && src[field.baselineRecordKey] !== null
		&& (!Array.isArray(field.options) || field.options.some((o)=>o && `${o.value}` === `${src[field.baselineRecordKey]}`))){
		return src[field.baselineRecordKey];
	}
	return fieldCurrentDefault(field);
}

// 字段可见性单源(挂载抽屉 TechniqueSettingsFields 与剪枝共用):showWhen(函数)/when(对象式 {key:value},草稿缺省回退字段默认)。
// 下拉此刻列哪些档:字段带 optionShown(opt, draft) 时,返回 false 的档不列(与页面同一判据:页面藏起 / 不开放 / 随另一项变的档),
// 但 keepValue(现值)所在的档照列 —— 已选者仍显示,与页面「已选者仍显示」同口径。抽屉渲染与 AI 设置面描述 / 校验共用
// 档位随另一项变的字段可给 optionsFor(draft)(返回此刻那一套档,标签也随之,如奇门起局法随排盘体例);现值不在那套里时
// 从全量 options 补回它所在的档。displayValue(值, draft) 给下拉回显值(如非时家把节气四法显示为「本家默认」)
// 嵌进「随…（档名）」时去掉档名末尾的「（默认）」标记(三层括号难读,里层的「默认」也易误读)
const bareLabel = (label)=>`${label}`.replace(/[（(]默认[）)]$/, '');

// 只记亲手键的宿主(显示草稿带 __unsetKeys;两层宿主另带 __inherited)里,空档一档只能表达一个意思:
// 选它要么删键(不设 / 继承下面那层),要么存空串(宿占郑氏宿法下 = 郑氏历元;两层宿主里 = 随流派 / 随盘、不继承下层)。
// 空档此刻表达不了的那个意思另列一档哨兵,recordHandEditedOption 认到它:UNSET = 删键,BLANK = 存空串。两种宿主同一实现;
// 哨兵值永不落盘(写入前换掉),整张草稿的抽屉(不带 __unsetKeys)不列。
export const MOUNT_OPTION_UNSET = '__horosa_mount_unset__';
export const MOUNT_OPTION_BLANK = '__horosa_mount_blank__';
function blankOptionLabelIn(field, draft){
	const o = mountFieldOptions(field, { ...draft, __noSentinel: true }, '').find((x)=>x.value === '');
	return o ? o.label : '';
}
function handKeySentinelOptions(field, d, all){
	if(!field || d.__noSentinel || !Array.isArray(d.__unsetKeys) || !all.some((o)=>o.value === '')){ return []; }
	if(!field.blankMeansFollowSchool && !field.blankFollowsBaseline){ return []; }
	const unsetHere = d.__unsetKeys.indexOf(field.name) >= 0;
	const inhCtx = d.__inherited && typeof d.__inherited === 'object' ? d.__inherited : null;
	const inh = inhCtx && inhCtx.values && typeof inhCtx.values === 'object' ? inhCtx.values : null;
	const inhVal = inh && Object.prototype.hasOwnProperty.call(inh, field.name) ? inh[field.name] : undefined;
	const inhSet = inhVal !== undefined && inhVal !== null && `${inhVal}` !== '';
	const from = (inhCtx && inhCtx.from) || '下层设置';
	const inhLabel = ()=>{
		let v = inhVal;
		if(typeof field.normalize === 'function'){ try{ v = field.normalize(inhVal); }catch(_e){ v = inhVal; } }
		const hit = all.find((o)=>`${o.value}` === `${v}`);
		return `随${from}（${bareLabel(hit ? hit.label : `${v}`)}）`;
	};
	const blankDeletes = !!(field.blankMeansFollowSchool || fieldBlankFollowsBaseline(field, d));
	if(blankDeletes){
		if(!inhSet){ return []; }
		// 下面那层存了具体值:空档 = 删本层(继承它);本层存了空串 → 另列「随下层」删键,否则另列「不继承下层」存空串
		if(`${d[field.name]}` === '' && !unsetHere){ return [{ value: MOUNT_OPTION_UNSET, label: inhLabel() }]; }
		return [{ value: MOUNT_OPTION_BLANK, label: `${field.blankMeansFollowSchool ? '随流派' : '随盘'}（不继承${from}）` }];
	}
	// 空档 = 存空串(宿占郑氏宿法下 = 郑氏历元):没存时另列「存空串」那一档;存了(空串或别的档)另列「不设」删键
	if(unsetHere){
		const label = blankOptionLabelIn(field, { ...d, [field.name]: '', __unsetKeys: d.__unsetKeys.filter((k)=>k !== field.name), __inherited: undefined });
		return label ? [{ value: MOUNT_OPTION_BLANK, label }] : [];
	}
	if(inhSet){ return [{ value: MOUNT_OPTION_UNSET, label: inhLabel() }]; }
	const label = blankOptionLabelIn(field, { ...d, __unsetKeys: [...d.__unsetKeys, field.name], __inherited: undefined });
	return label ? [{ value: MOUNT_OPTION_UNSET, label }] : [];
}

export function mountFieldOptions(field, draft, keepValue){
	const all = Array.isArray(field && field.options) ? field.options : [];
	if(!field){ return all; }
	const d = draft && typeof draft === 'object' ? draft : {};
	const keep = keepValue !== undefined ? keepValue : (d[field.name] !== undefined ? d[field.name] : field.default);
	let keepNorm = keep;
	if(typeof field.normalize === 'function' && keep !== undefined && keep !== null){
		try{ keepNorm = field.normalize(keep); }catch(_e){ keepNorm = keep; }
	}
	if(typeof field.displayValue === 'function'){
		try{ keepNorm = field.displayValue(keepNorm, d); }catch(_e){ /* 回显值取不到:按原值 */ }
	}
	const same = (o)=>`${o.value}` === `${keepNorm}`;
	let out = all;
	// 「随流派」空档在只记亲手键的宿主里(显示草稿带 __unsetKeys)= 不设:选它恒删键,生成时保留案例存档里的逐项覆盖(案例没设才按流派)。
	// 只有导入 / 手写的数据里确实存了空串,当前态才是真按流派;字段可给 unsetBlankLabel(草稿) 换更细的说法(卜卦选了流派时)
	const handKeyHost = Array.isArray(d.__unsetKeys);
	const unsetHere = handKeyHost && d.__unsetKeys.indexOf(field.name) >= 0;
	const followSchoolUnset = field.blankMeansFollowSchool && handKeyHost && !(!unsetHere && d[field.name] === '');
	if(typeof field.optionShown === 'function' || typeof field.optionsFor === 'function'){
		let base = all;
		if(typeof field.optionsFor === 'function'){
			try{ const o = field.optionsFor(d); base = Array.isArray(o) ? o : all; }catch(_e){ base = all; }
		}
		out = base.filter((o)=>{
			if(same(o)){ return true; }
			if(typeof field.optionShown !== 'function'){ return true; }
			try{ return field.optionShown(o, d) !== false; }catch(_e){ return true; }
		});
		if(keepNorm !== undefined && keepNorm !== null && !out.some(same)){
			const hit = all.find(same);
			if(hit){ out.push(hit); }
		}
	}
	// 现值不在任何一档(旧版存的值、档位后来改过,如旧的自由填数):照列一档「值（旧档）」——下拉不露裸值,也看得出它已不在档位里
	if(all.length && ['string', 'number'].indexOf(typeof keepNorm) >= 0 && `${keepNorm}` !== '' && !out.some(same) && !all.some(same)){
		out = [...out, { value: keepNorm, label: `${keepNorm}（旧档）` }];
	}
	if(followSchoolUnset){
		let label = '不设（随案例存档；案例没设 = 随流派）';
		if(typeof field.unsetBlankLabel === 'function'){ try{ label = field.unsetBlankLabel(d) || label; }catch(_e){ /* 取不到:用通用说法 */ } }
		out = out.map((o)=>(o.value === '' ? { ...o, label } : o));
	}
	// 两层宿主(显示草稿带 __inherited = { from: 下面那层的名称, values: 它存的值 },只读上下文):本层选空档会删键的字段,
	// 删完生成时取下面那层的值 —— 下面那层存了具体值、本层没存空串时,空档写明随哪一层与档名;下面那层存的是空串、本层存了具体值时,
	// 写明随哪一层与空串的含义(本层存了空串 = 当前态确实是空档的本义,照旧)
	const inhCtx = handKeyHost && d.__inherited && typeof d.__inherited === 'object' ? d.__inherited : null;
	const inh = inhCtx && inhCtx.values && typeof inhCtx.values === 'object' ? inhCtx.values : null;
	const inhVal = inh && Object.prototype.hasOwnProperty.call(inh, field.name) ? inh[field.name] : undefined;
	const blankDeletes = !!(field.blankMeansFollowSchool || (field.blankFollowsBaseline && fieldBlankFollowsBaseline(field, d)));
	if(blankDeletes && inhVal !== undefined && inhVal !== null && `${inhVal}` !== '' && `${d[field.name]}` !== ''){
		let inhNorm = inhVal;
		if(typeof field.normalize === 'function'){ try{ inhNorm = field.normalize(inhVal); }catch(_e){ inhNorm = inhVal; } }
		const hit = all.find((o)=>`${o.value}` === `${inhNorm}`);
		const label = `随${inhCtx.from || '下层设置'}（${bareLabel(hit ? hit.label : `${inhNorm}`)}）`;
		out = out.map((o)=>(o.value === '' ? { ...o, label } : o));
	}else if(blankDeletes && inhVal === '' && `${d[field.name]}` !== ''){
		// 下面那层存的就是空串(导入 / 手写的数据),本层存了具体值:选空档删本层 → 生成时取下面那层的空串 ——
		// 空档写「随下层(空串在这一层的含义)」,含义按「本层存了空串」那一态的单层标签
		const asStoredBlank = { ...d, [field.name]: '', __unsetKeys: d.__unsetKeys.filter((k)=>k !== field.name), __inherited: undefined };
		const blankOpt = mountFieldOptions(field, asStoredBlank, '').find((o)=>o.value === '');
		if(blankOpt){
			const label = `随${inhCtx.from || '下层设置'}（${bareLabel(blankOpt.label)}）`;
			out = out.map((o)=>(o.value === '' ? { ...o, label } : o));
		}
	}
	const sentinels = handKeySentinelOptions(field, d, all);
	if(sentinels.length){
		const at = out.findIndex((o)=>o.value === '');
		out = at >= 0 ? [...out.slice(0, at + 1), ...sentinels, ...out.slice(at + 1)] : [...out, ...sentinels];
	}
	return out;
}

// blankFollowsBaseline 可以是布尔,也可以是 (草稿)=>布尔(随另一项变:宿占郑氏恒星制下岁差空档 = 郑氏,不是随盘)
export function fieldBlankFollowsBaseline(field, draft){
	if(!field || !field.blankFollowsBaseline){ return false; }
	if(typeof field.blankFollowsBaseline === 'function'){
		try{ return !!field.blankFollowsBaseline(draft && typeof draft === 'object' ? draft : {}); }catch(_e){ return true; }
	}
	return true;
}

// baseline(可选):留空 = 随存档的父档(blankFollowsBaseline)此刻是空,子项按存档里父档的实值判显隐 —— 空档的实际效果就是存档值,
// 父档存的是手动档时,生效着的手动子项不能藏起来(藏了看不见、改了也被剪)。不传 = 只看草稿(只记亲手键的宿主不知道是哪张盘)
export function isMountFieldVisible(field, draft, schema, baseline){
	if(!field){ return false; }
	let d = draft && typeof draft === 'object' ? draft : {};
	if(baseline && typeof baseline === 'object' && schema && Array.isArray(schema.fields)){
		let filled = null;
		const ctx = mountContextOf(baseline);   // 基线带的只读上下文键:草稿自带的优先
		Object.keys(ctx).forEach((k)=>{
			if(d[k] === undefined || d[k] === null){
				if(!filled){ filled = { ...d }; }
				filled[k] = ctx[k];
			}
		});
		const raw = d;
		schema.fields.forEach((f)=>{
			if(!fieldBlankFollowsBaseline(f, raw)){ return; }
			const v = d[f.name];
			const b = baseline[f.name];
			if((v === '' || v === undefined || v === null) && b !== '' && b !== undefined && b !== null){
				if(!filled){ filled = { ...d }; }
				filled[f.name] = b;
			}
		});
		if(filled){ d = filled; }
	}
	if(typeof field.showWhen === 'function'){
		try{ if(!field.showWhen(d)){ return false; } }catch(_e){ return false; }
	}
	if(field.when && typeof field.when === 'object'){
		const fields = schema && Array.isArray(schema.fields) ? schema.fields : [];
		const draftOrDefault = (name)=>{
			if(d[name] !== undefined && d[name] !== null && d[name] !== ''){ return d[name]; }
			return (fields.find((f)=>f.name === name) || {}).default;
		};
		if(!Object.keys(field.when).every((k)=>`${draftOrDefault(k)}` === `${field.when[k]}`)){ return false; }
	}
	return true;
}

// 整张草稿的宿主(AI 挂载抽屉)改一项时经此:schema.onDraftChange 可按联动规则改写其余字段(六爻换派套预设)。
// 只记亲手改动键的宿主不要用它(联动写回的键会被当成亲手改)。
export function applyTechniqueDraftChange(key, draft, name, value){
	const next = { ...(draft && typeof draft === 'object' ? draft : {}), [name]: value };
	const schema = getTechniqueSettingsSchema(key);
	if(schema && typeof schema.onDraftChange === 'function'){
		try{
			const r = schema.onDraftChange(next, name, value);
			if(r && typeof r === 'object'){ return r; }
		}catch(_e){ /* 联动失败:只改这一项 */ }
	}
	return next;
}

// 整张草稿的初值 = 底稿(缺省 + 盘现状)叠覆盖(会话覆盖 / 同类默认 / 换案例沿用的覆盖)。覆盖里带了联动键(六爻流派 / 卜卦流派)
// 且与底稿不同时,先按联动规则在底稿上改这一项(与在抽屉里亲手改同一条路),再叠覆盖 —— 直接摊在存档旧细项上,
// 草稿就是「新派 + 旧派细项」,与剪枝基准(已换成新派)一比全成了覆盖,再点应用结果就变了(应用不幂等)。
// 同值不联动(免得把存档细项误当覆盖改掉);没有联动钩子的技法 = 原样叠加
export function composeTechniqueDraft(key, baseDraft, overrides){
	const base = baseDraft && typeof baseDraft === 'object' ? { ...baseDraft } : {};
	const ov = overrides && typeof overrides === 'object' ? overrides : {};
	const schema = getTechniqueSettingsSchema(key);
	let draft = base;
	if(schema && typeof schema.onDraftChange === 'function' && Array.isArray(schema.fields)){
		schema.fields.forEach((f)=>{
			const v = ov[f.name];
			if(v === undefined || Array.isArray(v) || `${v}` === `${base[f.name]}`){ return; }
			draft = applyTechniqueDraftChange(key, draft, f.name, v);
		});
	}
	return { ...draft, ...ov };
}

// 只记亲手改动键的宿主改一项:只滤字段 + 归一,不比默认值;
// 「随流派」空档(blankMeansFollowSchool)选回时删掉这个键 = 回到「不设」(与没动过同显同值,也同义)
// 「随档 / 随盘」空档(blankFollowsBaseline)选回时同样删键:它本就不算覆盖;函数形的(宿占岁差随宿法变)按这里显示的那份合成草稿判 ——
// 显示「随盘」就删(否则存下的空串到了宿法为郑氏恒星制的盘上被当成郑氏覆盖,与显示不符),显示「郑氏历元」照存空串
// lower(可选):生成时叠在 prev 下面的那一层(两层宿主)。空档随另一项变的字段按两层合成判
// (宿法存在下面那层时,本层选空档 = 郑氏历元得存空串,删键就继承了下面那层的岁差);写入仍只写 prev 这一层
export function recordHandEditedOption(key, prev, name, value, lower){
	const schema = getTechniqueSettingsSchema(key);
	const field = schema && Array.isArray(schema.fields) ? schema.fields.find((f)=>f.name === name) : null;
	// 哨兵档(见 MOUNT_OPTION_UNSET):不设 = 删键;存空串 = 原样存空串(不按空档规则删)
	if(value === MOUNT_OPTION_UNSET || value === MOUNT_OPTION_BLANK){
		const out = { ...(prev && typeof prev === 'object' ? prev : {}) };
		if(value === MOUNT_OPTION_UNSET){ delete out[name]; }else{ out[name] = ''; }
		return sanitizeOptionsToSchema(key, out);
	}
	const next = { ...(prev && typeof prev === 'object' ? prev : {}), [name]: value };
	const blank = value === '' || value === undefined || value === null;
	if(field && blank){
		const judge = { ...(lower && typeof lower === 'object' ? lower : {}), ...next };
		if(field.blankMeansFollowSchool){
			delete next[name];
		}else if(field.blankFollowsBaseline && fieldBlankFollowsBaseline(field, composeTechniqueDraft(key, getTechniqueSettingsCurrentDefaults(key), judge))){
			delete next[name];
		}
	}
	return sanitizeOptionsToSchema(key, next);
}

// 剪枝与抽屉显隐共用的基准:原基线经 schema.adjustPruneBaseline(换派时联动键取目标预设)调整后的那份。
// 抽屉渲染字段显隐(isMountFieldVisible 第四参)必须用它,与剪枝同口径(否则同时带联动钩子与随档父档的技法,显示与计数分叉)
export function adjustedMountBaseline(key, options, baseline){
	const schema = getTechniqueSettingsSchema(key);
	let base = baseline && typeof baseline === 'object' ? baseline : null;
	if(schema && Array.isArray(schema.fields) && typeof schema.adjustPruneBaseline === 'function'){
		// 存档段缺席(旧事盘没存判读设置 / 无 payload 的源):先按字段缺省补成对象再调钩子 ——
		// 外层抽屉的基线本就是补齐缺省的对象,两层必须同锚,否则外层计覆盖、合并时内层又剪掉
		if(!base){
			base = {};
			schema.fields.forEach((f)=>{ base[f.name] = fieldCurrentDefault(f); });
		}
		try{ base = schema.adjustPruneBaseline(base, options && typeof options === 'object' ? options : {}) || base; }catch(_e){ /* 取不到:按原基线 */ }
	}
	return base;
}

export function pruneOptionsToNonDefault(key, options, baseline){
	const schema = getTechniqueSettingsSchema(key);
	const out = {};
	if(!schema || !Array.isArray(schema.fields) || !options || typeof options !== 'object'){
		return out;
	}
	const base = adjustedMountBaseline(key, options, baseline);
	// 可见性上下文=有效草稿(options 覆盖 > 基线/盘现状 > globalCurrent/默认):merge 入口只带覆盖键
	// (父开关等于全局现值时已被剪掉),只看 options 会把「全局已开太岁入卦、仅覆盖关系人」误判为隐藏而剪空。
	// 留空 = 随存档的父档取空时按基线实值判子项显隐(与抽屉 isMountFieldVisible 传基线同口径)
	const visCtx = { ...mountContextOf(base) };   // 基线带的只读上下文键(塔罗进阶对应门控)与抽屉同一份
	schema.fields.forEach((f)=>{
		const own = Object.prototype.hasOwnProperty.call(options, f.name) ? options[f.name] : undefined;
		const blankToBase = fieldBlankFollowsBaseline(f, { ...(base || {}), ...options }) && (own === '' || own === null) && base && base[f.name] !== undefined && base[f.name] !== null && base[f.name] !== '';
		if(own !== undefined && !blankToBase){ visCtx[f.name] = own; return; }
		if(base && base[f.name] !== undefined && base[f.name] !== null){ visCtx[f.name] = base[f.name]; return; }
		visCtx[f.name] = fieldCurrentDefault(f);
	});
	schema.fields.forEach((field)=>{
		if(!Object.prototype.hasOwnProperty.call(options, field.name)){
			return;
		}
		// 当前不可见的条件字段不计入覆盖也不下发(此前抽屉只在渲染层过滤:策天先拨原法改「农历算法」再拨回书法,
		// 隐藏的 lunarMode 仍计「已自定义」并随请求下发)。
		if(!isMountFieldVisible(field, visCtx, schema)){
			return;
		}
		let v = options[field.name];
		if(typeof field.normalize === 'function'){
			v = field.normalize(v);
		}
		// 留空 = 随存档的字段:空值不是覆盖;文本框归一后为空(没填 / 填得不成形)同样不是覆盖(重算回落存档)
		if(fieldBlankFollowsBaseline(field, visCtx) && (v === '' || v === undefined || v === null)){
			return;
		}
		if(typeof field.normalize === 'function' && v === undefined){
			return;
		}
		let def = (base && base[field.name] !== undefined && base[field.name] !== null)
			? base[field.name]
			: baselineAliasOrDefault(field, base);
		if(typeof field.normalize === 'function'){
			def = field.normalize(def);
		}
		// 数组型（multiselect）：先排序再比较，杜绝顺序漂移误判；空数组 === 默认空数组 → 剪掉。
		// 透传时给原数组的浅拷贝，避免外部继续改动影响已剪结果。
		if(Array.isArray(v) || Array.isArray(def)){
			if(normalizeArrayForCompare(v) !== normalizeArrayForCompare(def)){
				out[field.name] = Array.isArray(v) ? [...v] : v;
			}
			return;
		}
		if(`${v}` !== `${def}`){
			out[field.name] = v;
		}
	});
	return out;
}

// ---- localStorage 持久化（per-技法默认；独立版本号，与 aiExport 设置互不迁移）----

// 🔴 模板店存/读只做「schema 字段过滤 + 值域归一」,绝不比默认值——
// 「同类默认」的键值语义=保存时的用户显式改动集(外层已按盘现状剪过),其中「恰=schema 默认」
// 是合法内容(对存非默认的盘=真改动;消费端原样透传,由重算入口按各盘现状终判)。此前店内
// 二参 prune(锚裸 schema 默认)把这类值二次剪掉:盘存整宫制拨 Alcabitius 点「设为同类默认」
// → 店里删键、UI 却报「已设为持久」—— 双层锚不同构的模板店翻版。
export function sanitizeOptionsToSchema(key, options){
	const schema = getTechniqueSettingsSchema(key);
	const out = {};
	if(!schema || !Array.isArray(schema.fields) || !options || typeof options !== 'object'){
		return out;
	}
	schema.fields.forEach((field)=>{
		if(!Object.prototype.hasOwnProperty.call(options, field.name)){
			return;
		}
		let v = options[field.name];
		if(v === MOUNT_OPTION_UNSET || v === MOUNT_OPTION_BLANK){
			return;   // 哨兵档只在只记亲手键的宿主里列、写入前换掉;漏到这里的一律不落盘
		}
		if(typeof field.normalize === 'function'){
			v = field.normalize(v);
		}
		if(v === undefined){
			return;
		}
		out[field.name] = Array.isArray(v) ? [...v] : v;
	});
	return out;
}

function emptyMountDefaults(){
	return { version: MOUNT_TECHNIQUE_DEFAULTS_VERSION, techniques: {} };
}

export function loadMountTechniqueDefaults(){
	try{
		if(typeof window === 'undefined' || !window.localStorage){
			return emptyMountDefaults();
		}
		const raw = window.localStorage.getItem(MOUNT_TECHNIQUE_DEFAULTS_KEY);
		if(!raw){
			return emptyMountDefaults();
		}
		const parsed = JSON.parse(raw);
		const techniques = parsed && parsed.techniques && typeof parsed.techniques === 'object' ? parsed.techniques : {};
		const cleaned = {};
		Object.keys(techniques).forEach((k)=>{
			// 读侧同款只滤字段不比值(比值会把「显式存的 schema 默认值」在载入时又吃掉)。
			const sane = sanitizeOptionsToSchema(k, techniques[k]);
			if(sane && Object.keys(sane).length){
				cleaned[k] = sane;
			}
		});
		return { version: MOUNT_TECHNIQUE_DEFAULTS_VERSION, techniques: cleaned };
	}catch(e){
		return emptyMountDefaults();
	}
}

export function getMountTechniqueDefault(key){
	const all = loadMountTechniqueDefaults();
	const v = all.techniques[`${key || ''}`];
	return v && typeof v === 'object' ? v : {};
}

// 保存某技法的「同类默认」。传空对象 → 删除该键（回归现状）。调用方负责按盘现状剪 no-op;
// 本函数只滤 schema 字段+归一,不比默认值(见 sanitizeOptionsToSchema 注)。
export function saveMountTechniqueDefaults(key, options){
	const all = loadMountTechniqueDefaults();
	const k = `${key || ''}`;
	const sane = sanitizeOptionsToSchema(k, options || {});
	if(sane && Object.keys(sane).length){
		all.techniques[k] = sane;
	}else{
		delete all.techniques[k];
	}
	try{
		if(typeof window !== 'undefined' && window.localStorage){
			safeLocalStorageSet(MOUNT_TECHNIQUE_DEFAULTS_KEY, JSON.stringify(all));
		}
	}catch(e){ /* 存储失败静默 */ }
	return all;
}

// ---- merge 进重算用的 record / payload（返回副本，不改原对象）----

// record 类事盘(schema.recordPayloadKeys):平铺键缺席时取存档 payload.options 的同名键。
// 基线与合并后的记录共用这一份:基线说「这张盘现在是 X」而剪掉等于 X 的覆盖,重算起盘也必须按 X 起
// (起盘按平铺键读,缺键 = 0;快照文字缺键读 payload),否则剪掉的值在起盘那一侧并不是现状。
function fillRecordPayloadKeys(schema, src){
	if(!schema || schema.kind !== 'record' || !Array.isArray(schema.recordPayloadKeys) || !src || !src.payload){ return src; }
	let po = null;
	try{
		const pl = typeof src.payload === 'string' ? JSON.parse(src.payload) : src.payload;
		po = pl && pl.options && typeof pl.options === 'object' ? pl.options : null;
	}catch(_e){ po = null; }
	if(!po){ return src; }
	const merged = { ...src };
	schema.recordPayloadKeys.forEach((k)=>{
		const missing = merged[k] === undefined || merged[k] === null || merged[k] === '';
		if(missing && po[k] !== undefined && po[k] !== null && po[k] !== ''){ merged[k] = po[k]; }
	});
	return merged;
}

export function mergeOptionsIntoRecord(record, key, options){
	const base = record && typeof record === 'object' ? { ...record } : {};
	// baseline=record 本身:与盘现状不同才写(盘存 hsys=1 时选 0=真差异 → 写入生效)。
	// C 类内层锚=与外层同源的 localStorageMountBaseline(record 短名缺键会错锚
	// schema 默认,把「=schema 默认但≠现状」的合法覆盖二次剪掉——双层锚不同构又一例)。
	const schema = getTechniqueSettingsSchema(key);
	// 内层剪枝锚 = 外层判「已改」的同一个基线函数(effectiveMountBaseline):两层锚不同构时,外层判已改的覆盖
	// 会被内层剪掉(紫微带代次标记的盘:外层缺键取出厂默认,内层曾按全局现值剪 → 选「恰等于全局现值」的值不生效)。
	const baseline = effectiveMountBaseline(key, base);
	let opts = options;
	if(schema && typeof schema.expandMergeOptions === 'function' && options && typeof options === 'object'){
		try{ opts = schema.expandMergeOptions(options, base) || options; }catch(_e){ opts = options; }
	}
	const pruned = pruneOptionsToNonDefault(key, opts, baseline);
	const fieldByName = {};
	if(schema && Array.isArray(schema.fields)){
		schema.fields.forEach((f)=>{ fieldByName[f.name] = f; });
	}
	Object.keys(pruned).forEach((name)=>{
		// C 类覆盖写 record 长名(builder 消费序 record 优先——写短名恒被既有长名遮蔽=死开关)。
		const f = fieldByName[name];
		const target = f && f.recordKey ? f.recordKey : name;
		base[target] = pruned[name];
	});
	// 剪枝锚含存档 payload 的键(宿占宿法):剪掉的覆盖 = 盘现状,补进平铺让重算起盘按同一个现状起
	return fillRecordPayloadKeys(schema, base);
}

// B 类同构:baseline=存档 payload 的 optionsPath 现值(存档流派非默认时,调回默认档同样要可表达)。
function payloadOptionsBaseline(schema, payload){
	// 与外层覆盖判定同锚(payloadSegmentOf 认 baselineSource 存档层) —— 此前只按
	// optionsPath 取顶层覆盖层,六爻类「存档层≠optionsPath 层」技法在此二次剪掉合法覆盖。
	return payloadSegmentOf(schema, payload);
}

export function mergeOptionsIntoPayload(payload, key, options){
	const schema = getTechniqueSettingsSchema(key);
	const base = payload && typeof payload === 'object' ? { ...payload } : {};
	const pruned = pruneOptionsToNonDefault(key, options, payloadOptionsBaseline(schema, base));
	if(!schema || schema.kind !== 'payload' || !Object.keys(pruned).length){
		return base;
	}
	const path = schema.optionsPath;
	if(path){
		// 嵌套命名空间(如 'options' 六壬子组 / 'tongshu' 通书):写 payload.<path>.<name>,
		// 与各自 regenerate 读点({...defaults, ...p[path]})同构。
		// schema.applyOverrides(存档段, 覆盖):覆盖要像页面上逐项改那样落(如轨策改单项后流派偏离预设 → 标自定义)
		const stored = base[path] && typeof base[path] === 'object' ? base[path] : {};
		base[path] = typeof schema.applyOverrides === 'function' ? schema.applyOverrides(stored, pruned) : { ...stored, ...pruned };
	}else{
		// 顶层铺平（liureng/jinkou/horary/election）。
		Object.keys(pruned).forEach((name)=>{
			base[name] = pruned[name];
		});
	}
	return base;
}

// C 类：把用户选项写进全局 localStorage（builder 自读）。仅写有 storageKey 的 field 且与默认不同的项。
// C 类覆盖 → {storageKey: 值串}(与 applyLocalStorageSettings 同一 prune 锚),交给 GuoLaoChartStyle 的进程内覆盖作用域,
//   不再落 localStorage。applyLocalStorageSettings 保留给「真要持久化」的调用方(当前无),AI 挂载重算不再用它。
export function localStorageOverrideMap(key, options, record){
	const schema = getTechniqueSettingsSchema(key);
	if(!schema || schema.kind !== 'localStorage'){
		return {};
	}
	// 与外层 / 记录合并同锚(record 长名 ?? 全局现值)
	const pruned = pruneOptionsToNonDefault(key, options, localStorageMountBaseline(key, record));
	const out = {};
	schema.fields.forEach((field)=>{
		if(!field.storageKey){
			return;
		}
		if(Object.prototype.hasOwnProperty.call(pruned, field.name)){
			out[field.storageKey] = `${pruned[field.name]}`;
		}
	});
	return out;
}

// baseline:剪枝锚的现状(不给 = 本机仓现值);助手改技法本地设置时传入与 describe 同一份现状(宿度制取新盘缺省)
export function applyLocalStorageSettings(key, options, baseline){
	const schema = getTechniqueSettingsSchema(key);
	if(!schema || schema.kind !== 'localStorage' || typeof window === 'undefined' || !window.localStorage){
		return;
	}
	// 内层 prune 锚全局现状(与外层同锚):锚裸 schema 默认时,「全局存非默认、
	// 挂载临时拨回默认档」会在这里被剪掉不写 → builder 仍读到全局非默认值,临时覆盖失效。
	const pruned = pruneOptionsToNonDefault(key, options, baseline && typeof baseline === 'object' ? baseline : localStorageMountBaseline(key));
	schema.fields.forEach((field)=>{
		if(!field.storageKey){
			return;
		}
		if(Object.prototype.hasOwnProperty.call(pruned, field.name)){
			try{ safeLocalStorageSet(field.storageKey, `${pruned[field.name]}`); }catch(e){ /* ignore */ }
		}
	});
}

// C 类配套：施加覆盖前快照全局 key 现值（含「不存在」= null），用毕由调用方还原。
// 没有这一对，一次 AI 挂载覆盖就会永久改写用户的全局显示设置（builder 自读的正是这些 key），
// 且 applyLocalStorageSettings 只写不删、改回默认也清不掉残值。
export function snapshotLocalStorageSettings(key){
	const schema = getTechniqueSettingsSchema(key);
	if(!schema || schema.kind !== 'localStorage' || typeof window === 'undefined' || !window.localStorage){
		return null;
	}
	const snap = {};
	schema.fields.forEach((field)=>{
		if(!field.storageKey){
			return;
		}
		try{ snap[field.storageKey] = window.localStorage.getItem(field.storageKey); }catch(e){ snap[field.storageKey] = null; }
	});
	return snap;
}

export function restoreLocalStorageSettings(snapshot){
	if(!snapshot || typeof window === 'undefined' || !window.localStorage){
		return;
	}
	Object.keys(snapshot).forEach((storageKey)=>{
		try{
			const prev = snapshot[storageKey];
			if(prev === null || prev === undefined){
				window.localStorage.removeItem(storageKey);
			}else{
				safeLocalStorageSet(storageKey, prev);
			}
		}catch(e){ /* ignore */ }
	});
}

// 审计矩阵（供五同步自检 + UI）：技法 → kind / 字段数 / 是否可重算。
export function getMountableTechniqueAuditEntry(key){
	const schema = getTechniqueSettingsSchema(key);
	if(!schema){
		return { key, kind: 'none', fieldCount: 0, supportsMountSettings: false };
	}
	const fieldCount = Array.isArray(schema.fields) ? schema.fields.length : 0;
	return {
		key,
		kind: schema.kind,
		fieldCount,
		supportsMountSettings: schema.kind !== 'sectionsOnly' && fieldCount > 0,
	};
}

// 「生效挂载设置」单一解析:会话覆盖(锚盘现状再剪) ?? 同类默认(跨盘模板原样透传,由重算入口按各盘现状终判) ?? 无。
// 对话页(effectiveTechniqueOptions)与无头入口(目标任务 / 定时任务 / 自动简报 / run_analysis / 编排子任务)共用 ——
// 此前无头拼装不带任何覆盖,同一张盘同一技法后台看到的快照与对话页挂载卡口径不同。只收非空(有非默认项)的技法。
export function resolveEffectiveTechniqueOptions(techniqueKeys, opts){
	const o = opts && typeof opts === 'object' ? opts : {};
	const record = o.record || null;
	const overrides = o.sessionOverrides && typeof o.sessionOverrides === 'object' ? o.sessionOverrides : {};
	const out = {};
	(Array.isArray(techniqueKeys) ? techniqueKeys : []).forEach((key)=>{
		if(!key){ return; }
		const session = overrides[key];
		const eff = (session && typeof session === 'object')
			? pruneOptionsToNonDefault(key, session, effectiveMountBaseline(key, record))
			: getMountTechniqueDefault(key);
		if(eff && Object.keys(eff).length){
			out[key] = eff;
		}
	});
	return out;
}
