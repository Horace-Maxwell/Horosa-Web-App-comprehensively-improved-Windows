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

import * as AstroConst from '../constants/AstroConst';
import { safeLocalStorageSet } from './safeStorage';
import {
	SUPPORTED_PD_METHODS,
	SUPPORTED_PD_TIME_KEYS,
	PD_METHOD_LABELS,
	PD_TIME_KEY_LABELS,
	DEFAULT_PD_METHOD,
	DEFAULT_PD_TIME_KEY,
} from './primaryDirectionSync';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from './dayBoundary';
import {
	JIEQI_OPTIONS as QIMEN_JIEQI_OPTIONS,
	PAIPAN_OPTIONS as QIMEN_PAIPAN_OPTIONS,
	ZHISHI_OPTIONS as QIMEN_ZHISHI_OPTIONS,
	YUEJIA_QIJU_OPTIONS as QIMEN_YUEJIA_QIJU_OPTIONS,
	QIJU_METHOD_OPTIONS as QIMEN_QIJU_METHOD_OPTIONS,
	SCHOOL_OPTIONS as QIMEN_SCHOOL_OPTIONS,
	KONG_MODE_OPTIONS as QIMEN_KONG_MODE_OPTIONS,
	MA_MODE_OPTIONS as QIMEN_MA_MODE_OPTIONS,
	ZHIRUN_LEAP_OPTIONS as QIMEN_ZHIRUN_LEAP_OPTIONS,
} from '../components/dunjia/DunJiaCalc';
import {
	STYLE_OPTIONS as TAIYI_STYLE_OPTIONS,
	METHOD_OPTIONS as TAIYI_METHOD_OPTIONS,
	TIME_BASIS_OPTIONS as TAIYI_TIME_BASIS_OPTIONS,
	GAME_THEORY_OPTIONS as TAIYI_GAME_THEORY_OPTIONS,
} from '../components/taiyi/TaiYiCalc';
// 推运 builder 的官方选项常量 + 默认 opts（三分主星 / Balbillus / 关键点）——纯 util，无循环，直接复用。
import { TRIPLICITY_DIVISIONS, TRIPLICITY_SYSTEMS, TRIPLICITY_DEFAULT_OPTS } from './triplicityRulers';
import { BALBILLUS_YEAR_TYPES, BALBILLUS_MODES, BALBILLUS_DEFAULT_OPTS } from './balbillus';
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
} from '../components/ziwei/ziweiOptions';
// 注：卜卦/择日/六壬起课的选项常量定义在「大组件」(HoraryMain/ElectionMain/LiuRengMain) 内，它们与 aiAnalysisContext
// 形成循环导入（aiAnalysisContext→techniqueMountSettings→大组件→…→aiAnalysisContext）；当 aiAnalysisContext 为入口时
// init 顺序会让这些常量在 .map 时为 undefined（抛错）。故此处「内联镜像」其值断开循环，并由 techniqueMountSettings.test.js
// 断言「内联值 === 源组件常量」防漂移（见下方 LIUREN_QI_METHODS / HORARY_CATEGORIES / ELECTION_TOPICS）。

export const MOUNT_TECHNIQUE_DEFAULTS_KEY = 'horosa.ai.mount.techniqueDefaults.v1';
export const MOUNT_TECHNIQUE_DEFAULTS_VERSION = 1;

const ON_OFF = [{ value: 0, label: '关' }, { value: 1, label: '开' }];
const TIME_ALG_OPTIONS = [{ value: 0, label: '真太阳时' }, { value: 1, label: '钟表时' }];
const ZODIACAL_OPTIONS = [{ value: 0, label: '回归（热带）' }, { value: 1, label: '恒星' }];
const DAY_BOUNDARY_OPTIONS = [{ value: 0, label: '不换日' }, { value: 1, label: '23点后换日' }];

const HSYS_OPTIONS = (AstroConst.HOUSE_SYSTEM_OPTIONS || []).map((item)=>({ value: item.value, label: item.label }));
const PD_METHOD_OPTIONS = SUPPORTED_PD_METHODS.map((value)=>({ value, label: PD_METHOD_LABELS[value] || value }));
const PD_TIME_KEY_OPTIONS = SUPPORTED_PD_TIME_KEYS.map((value)=>({ value, label: PD_TIME_KEY_LABELS[value] || value }));

// 日界 + 晚子时（八字/紫微/太乙等共用；从 TIME_FIELDS 抽出以便单独复用）。默认 === 各 builder 现状。
const DAY_BOUNDARY_FIELDS = [
	{ name: 'after23NewDay', label: '日界（日柱换日）', type: 'select', options: DAY_BOUNDARY_OPTIONS, default: defaultAfter23NewDay(), group: '时间换算' },
	{ name: 'lateZiHourUseNextDay', label: '晚子时·时柱进次日', type: 'switch', options: ON_OFF, default: defaultLateZiHourUseNextDay(), group: '时间换算' },
];
// 起课时间换算共用组（紫微/数算/神数等 2 档 timeAlg 技法），默认全部 === buildFieldObject 现状。
const TIME_FIELDS = [
	{ name: 'timeAlg', label: '时间算法', type: 'select', options: TIME_ALG_OPTIONS, default: 0, group: '时间换算' },
	...DAY_BOUNDARY_FIELDS,
];
// 八字专属 timeAlg 4 档（源 CnTraditionInput：真太阳时/平太阳时/直接时间/春分定卯时；西占/紫微的 2 档不含「春分定卯时/平太阳时」）。
// 平太阳时(3)=仅经度差、去均时差,与真太阳时(0)算法不同(baziLunarLocal timeAlg=3),挂载须可选。
const BAZI_TIME_ALG_OPTIONS = [
	{ value: 0, label: '真太阳时' },
	{ value: 3, label: '平太阳时' },
	{ value: 1, label: '直接时间' },
	{ value: 2, label: '春分定卯时' },
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
// 镜像 HoraryMain.HORARY_CATEGORIES（14 类，value/label 一致）。
const HORARY_CATEGORIES = [
	{ value: 'general', label: '综合 · 能否成事' },
	{ value: 'wealth', label: '财物 · 借贷（二宫）' },
	{ value: 'family', label: '兄弟 · 亲属（三宫）' },
	{ value: 'property', label: '房产 · 田宅（四宫）' },
	{ value: 'pregnancy', label: '子嗣 · 怀孕（五宫）' },
	{ value: 'health', label: '疾病 · 健康（六宫）' },
	{ value: 'marriage', label: '婚姻 · 感情（七宫）' },
	{ value: 'lawsuit', label: '诉讼 · 合伙 · 战争（七宫）' },
	{ value: 'theft', label: '盗窃 · 失物 · 走失（七宫/转宫）' },
	{ value: 'death', label: '死生 · 遗产（八宫）' },
	{ value: 'travel', label: '旅行 · 远行 · 学问（九宫）' },
	{ value: 'career', label: '职位 · 事业（十宫）' },
	{ value: 'hope', label: '愿望 · 朋友（十一宫）' },
	{ value: 'enemy', label: '私敌 · 囚禁（十二宫）' },
];
// 镜像 ElectionMain.ELECTION_TOPICS（19 类，value/label 一致）。
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
	{ value: 'surgery', label: '手术 / 用药' },
	{ value: 'banquet', label: '宴会 / 就职典礼' },
	{ value: 'travel', label: '出行' },
	{ value: 'blessing', label: '祈福 / 安香 / 法会' },
	{ value: 'general_day', label: '大众吉日' },
];

// 奇门遁甲：镜像 DunJiaCalc/DunJiaMain DEFAULT_OPTIONS 与 aiAnalysisContext DEFAULT_QIMEN_OPTIONS 的关键排盘选项。
// （faRelatedPeople 是「内容/数据」非排盘选项，不入此 schema。）
// 直接复用 DunJiaCalc 的官方选项常量（值/标签 100% 与排盘引擎一致，杜绝手写错值喂坏 calcDunJia）。
const QIMEN_FIELDS = [
	{ name: 'paiPanType', label: '排盘体例', type: 'select', default: 3, group: '排盘', options: QIMEN_PAIPAN_OPTIONS },
	{ name: 'qijuMethod', label: '起局法', type: 'select', default: 'zhirun', group: '排盘', options: QIMEN_QIJU_METHOD_OPTIONS },
	{ name: 'school', label: '盘式', type: 'select', default: '转盘', group: '排盘', options: QIMEN_SCHOOL_OPTIONS },
	{ name: 'shuziReportNumber', label: '报数（阴盘）', type: 'text', default: '', group: '排盘' },
	{ name: 'zhirunLeapDays', label: '置闰天数（传本）', type: 'select', default: 9, group: '排盘', options: QIMEN_ZHIRUN_LEAP_OPTIONS },
	{ name: 'jieQiType', label: '节气取法', type: 'select', default: 1, group: '排盘', options: QIMEN_JIEQI_OPTIONS },
	{ name: 'zhiShiType', label: '值使取法', type: 'select', default: 0, group: '排盘', options: QIMEN_ZHISHI_OPTIONS },
	{ name: 'yueJiaQiJuType', label: '月家起局', type: 'select', default: 0, group: '排盘', options: QIMEN_YUEJIA_QIJU_OPTIONS },
	{ name: 'kongMode', label: '空亡基准', type: 'select', default: 'day', group: '排盘', options: QIMEN_KONG_MODE_OPTIONS },
	{ name: 'yimaMode', label: '驿马基准', type: 'select', default: 'day', group: '排盘', options: QIMEN_MA_MODE_OPTIONS },
	{ name: 'shiftPalace', label: '移宫（拆补转盘）', type: 'switch', options: ON_OFF, default: 0, group: '排盘' },
	// fengJu 引擎默认为布尔 false → 用布尔语义,normalize 到 true/false（与 DEFAULT_OPTIONS 字节一致）。
	{ name: 'fengJu', label: '法奇门叠加层', type: 'switch', options: ON_OFF, default: false, group: '排盘', normalize: (v)=>(v === true || v === 1 || v === '1') },
	...TIME_FIELDS,
];

// 太乙：复用 TaiYiCalc 官方选项常量（盘式 / 古法公式 / 时间基准 / 博弈），默认对齐 TaiYiMain state.options + fetchTaiyiPan 现状。
const TAIYI_FIELDS = [
	{ name: 'style', label: '盘式', type: 'select', default: 3, group: '盘式', options: TAIYI_STYLE_OPTIONS },
	{ name: 'tn', label: '古法公式', type: 'select', default: 0, group: '盘式', options: TAIYI_METHOD_OPTIONS },
	{ name: 'timeBasis', label: '时间基准', type: 'select', default: 'direct', group: '盘式', options: TAIYI_TIME_BASIS_OPTIONS },
	{ name: 'gameTheory', label: '博弈分析', type: 'select', default: 0, group: '盘式', options: TAIYI_GAME_THEORY_OPTIONS },
	// 命法盘性别:仅盘式=太乙命法(style=5)时,fetchTaiyiPan→后端 webtaiyisrv:401/521 消费 sex 改命法盘 → showWhen 条件揭示,默认男 prune 零回归。
	{ name: 'sex', label: '命法盘性别（盘式=太乙命法时）', type: 'select', default: '男', group: '盘式', showWhen: (d)=>Number(d.style) === 5, options: [
		{ value: '男', label: '男' },
		{ value: '女', label: '女' },
	] },
	// 太乙也吃日界/晚子时：fetchTaiyiPan(TaiYiCalc:275/277) 透传到 buildLocalBaziResult 算四柱/时柱。
	// 默认对齐 fetchTaiyiPan 兜底（after23NewDay→0 / lateZi→default）=== 现状（未改时 prune 丢弃→走兜底，输出不变）。
	{ name: 'after23NewDay', label: '日界（日柱换日）', type: 'select', options: DAY_BOUNDARY_OPTIONS, default: 0, group: '时间换算' },
	{ name: 'lateZiHourUseNextDay', label: '晚子时·时柱进次日', type: 'switch', options: ON_OFF, default: defaultLateZiHourUseNextDay(), group: '时间换算' },
];

// 太玄筮法 / 荆诀 起筮种子:留空 / 0 → buildXxxSnapshotForFields 由起课时间 yyyyMMddHHmm 派生(确定性)。
// 用户改正数 → 走该 seed(覆盖派生),适用于「报数起筮」想用具体外部数字时。
const TAIXUAN_FIELDS = [
	{ name: 'seed', label: '起筮种子 (留空=按起课时间派生)', type: 'number', default: 0, group: '起筮', placeholder: '空 → 按时间派生' },
];
const JINGJUE_FIELDS = [
	{ name: 'seed', label: '起筮种子 (留空=按起课时间派生)', type: 'number', default: 0, group: '起筮', placeholder: '空 → 按时间派生' },
];

// 五兆神数:WuZhaoMain.state 默认 mode='ganzhi' number=0 manual=false manualSplits=DEFAULT_SPLITS。
const WUZHAO_FIELDS = [
	{ name: 'mode', label: '起例模式', type: 'select', default: 'ganzhi', group: '起例', options: [
		{ value: 'ganzhi', label: '干支起例(默认,纯时间)' },
		{ value: 'day', label: '按日报数' },
		{ value: 'hour', label: '按时报数' },
		{ value: 'minute', label: '按分报数' },
		{ value: 'tang', label: '按堂报数' },
	]},
	{ name: 'number', label: '报数 (mode=报数类时使用)', type: 'number', default: 0, group: '起例' },
	{ name: 'manual', label: '手动分爻', type: 'switch', options: ON_OFF, default: 0, group: '起例', normalize: (v)=>(v === true || v === 1 || v === '1') },
	// 手动六数:仅 manual=开 时生效。WuZhaoMain:156 builder 读 opts.manualSplits(6 数组)进重算请求,入口:986 已传,
	//   但 schema 此前漏字段 → manual 开关形同虚设(恒走 DEFAULT_SPLITS)。text 逗号输入 normalize 成 6 数组;留空=默认零回归。
	{ name: 'manualSplits', label: '手动六数 (逗号分隔,如 18,8,5,2,1,1;留空=默认)', type: 'text', default: '', group: '起例',
		showWhen: (d)=>(d.manual === 1 || d.manual === true || d.manual === '1'),
		normalize: (v)=>{ if(Array.isArray(v)){ return v.length === 6 ? v.map(Number) : undefined; } const a = `${v == null ? '' : v}`.split(/[,，\s]+/).map((x)=>Number(x)).filter((n)=>!Number.isNaN(n)); return a.length === 6 ? a : undefined; } },
];

// 神易数:ShenYiShuMain.state 默认 hourSource='auto' manualHour=0 seasonSource='auto' manualSeason='夏'。
const SHENYISHU_FIELDS = [
	{ name: 'hourSource', label: '时辰来源', type: 'select', default: 'auto', group: '起盘', options: [
		{ value: 'auto', label: '自动(由起课时间推)' },
		{ value: 'manual', label: '手动指定' },
	]},
	{ name: 'manualHour', label: '手动小时 (0-23,仅 hourSource=manual 生效)', type: 'number', default: 0, group: '起盘' },
	{ name: 'seasonSource', label: '季令来源', type: 'select', default: 'auto', group: '起盘', options: [
		{ value: 'auto', label: '自动(由起课时间推)' },
		{ value: 'manual', label: '手动指定' },
	]},
	{ name: 'manualSeason', label: '手动季令 (仅 seasonSource=manual 生效)', type: 'select', default: '夏', group: '起盘', options: [
		{ value: '春', label: '春' },
		{ value: '夏', label: '夏' },
		{ value: '秋', label: '秋' },
		{ value: '冬', label: '冬' },
	]},
];

// 六壬起课法：buildLiuRengSnapshotText 第 8 参 castOpts 直接读这些键 + guireng/wuxing 走顶层。
const LIURENG_FIELDS = [
	// 起课法：复用 LiuRengMain 导出的 QI_METHODS（25 法，值/名与排盘引擎同源，杜绝手写错值）。
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
	{ name: 'yinyangSystem', label: '昼夜阳阴归属', type: 'select', default: 'danmu', group: '取神', options: [
		{ value: 'danmu', label: '旦暮系(默认)' },
		{ value: 'yinyang', label: '星历阳阴系' },
	] },
	{ name: 'tuWangShuai', label: '土旺衰', type: 'select', default: 'siji', group: '取神', options: [
		{ value: 'siji', label: '四季月土旺(默认)' },
		{ value: 'huotu', label: '火土同宫(土随火)' },
	] },
	{ name: 'guireng', label: '贵人体系', type: 'select', default: 2, group: '取神', options: [
		{ value: 2, label: '星占法贵人（默认）' },
		{ value: 0, label: '六壬法贵人' },
		{ value: 1, label: '遁甲法贵人' },
		{ value: 3, label: '甲戊兼牛羊' },
		{ value: 4, label: '干合阳阴贵' },
	] },
	{ name: 'wuxing', label: '十二长生五行', type: 'select', default: '土', group: '取神', options: [
		{ value: '土', label: '土（默认）' },
		{ value: '金', label: '金' },
		{ value: '木', label: '木' },
		{ value: '水', label: '水' },
		{ value: '火', label: '火' },
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
		options: [{ value: 'auto', label: '自动（按占时支）' }, ...DIZHI_12.map((zi)=>({ value: zi, label: `地分：${zi}` }))] },
	// 贵神体系：默认 0（六壬法贵人）=== JinKouMain state.guireng:0（修原 schema 误标默认 2 → prune 误判持久化的 bug）。
	{ name: 'guireng', label: '贵神体系', type: 'select', default: 0, group: '取神', options: [
		{ value: 0, label: '六壬法贵人（默认）' },
		{ value: 2, label: '星占法贵人' },
		{ value: 1, label: '遁甲法贵人' },
	] },
	{ name: 'wuxing', label: '十二长生五行', type: 'select', default: '土', group: '取神', options: [
		{ value: '土', label: '土（默认）' },
		{ value: '金', label: '金' },
		{ value: '木', label: '木' },
		{ value: '水', label: '水' },
		{ value: '火', label: '火' },
	] },
	// 月将 / 占时：regen 透传给 buildJinKouData（已加 opt.yueJiang/opt.zhanShi 覆盖逻辑）→ 改将神/贵神落位，真改快照。
	// 默认 'auto'（按节气取月将 / 按时支取占时）=== JinKouMain state，缺省经 prune 丢弃 → 字节级一致。
	{ name: 'yueJiang', label: '月将', type: 'select', default: 'auto', group: '课式', options: [
		{ value: 'auto', label: '自动取月将（默认）' },
		...DIZHI_12.map((zi)=>({ value: zi, label: `月将：${zi}` })),
	] },
	{ name: 'zhanShi', label: '占时', type: 'select', default: 'auto', group: '课式', options: [
		{ value: 'auto', label: '自动取时支（默认）' },
		...DIZHI_12.map((zi)=>({ value: zi, label: `占时：${zi}` })),
	] },
	// 流派 / 盘法（J2）：regenerateJinkouSnapshot 已透传 payload.{schoolYueJiang,schoolGuiTable,schoolGuiPan,panShi}
	// 给 buildJinKouData（缺省 undefined → 内部默认派 = 现状,零回归）。默认值 === JinKouMain state，缺省经 prune 丢弃 → 字节级一致。
	{ name: 'schoolYueJiang', label: '月将换将', type: 'select', default: 'zhongqi', group: '流派', options: [
		{ value: 'zhongqi', label: '中气换将（默认）' },
		{ value: 'jiaojie', label: '交节即换' },
	] },
	{ name: 'schoolGuiTable', label: '贵人昼夜表', type: 'select', default: 'shiwu', group: '流派', options: [
		{ value: 'shiwu', label: '实务派（默认）' },
		{ value: 'liuren', label: '大六壬古法' },
	] },
	{ name: 'schoolGuiPan', label: '起贵神盘', type: 'select', default: 'di', group: '流派', options: [
		{ value: 'di', label: '地盘法（默认）' },
		{ value: 'tian', label: '天盘法' },
	] },
	{ name: 'panShi', label: '盘式', type: 'select', default: 'yang', group: '流派', options: [
		{ value: 'yang', label: '传统阳盘（默认）' },
	] },
	// 注：timeBasis(直接时间/真太阳时)只在后端 fetchJinKouPan 重算四柱时生效；本无头快照走本地 buildJinKouData
	// （从已定四柱的 liureng 起盘，不重算时间），timeBasis 改不动输出 → 按铁律「不放无效选项」不入 schema（降级,见回报）。
];

// 卜卦盘 / 择日盘：类别 topicId。regenerate 透传 options.topicId（缺省=现状）。
// 复用各自主页面权威常量（HORARY_CATEGORIES 14 类 / ELECTION_TOPICS 19 类），杜绝手写错值——
// 原 schema 仅列 8/6 类且含不存在的假值（horary 'lost' 实为 'theft'；election 'construction/medical' 实为 'renovation/surgery'）。
const HORARY_FIELDS = [
	{ name: 'topicId', label: '问卜类别', type: 'select', default: 'general', group: '裁决', options: HORARY_CATEGORIES },
	// 卜卦流派(horarySchools 五档;默认经典主流=页面默认口径)。储存记录另经 payload.extra.horarySchool 自动还原。
	{ name: 'horarySchool', label: '判读流派', type: 'select', default: 'classical', group: '裁决', options: [
		{ value: 'classical', label: '经典主流' },
		{ value: 'strict', label: '当代严谨' },
		{ value: 'hellenistic', label: '希腊化' },
		{ value: 'medieval', label: '中世纪' },
		{ value: 'modern', label: '现代心理' },
	] },
];
const ELECTION_FIELDS = [
	{ name: 'topicId', label: '用事类别', type: 'select', default: 'marriage', group: '择日', options: ELECTION_TOPICS },
	// 西方子流派(westernSchools 五档;默认现代主流=零回归)。储存记录另经 payload.extra.westSchool 自动还原。
	{ name: 'westSchool', label: '西方流派', type: 'select', default: 'modern_main', group: '择日', options: [
		{ value: 'modern_main', label: '现代主流' },
		{ value: 'hellenistic', label: '希腊化' },
		{ value: 'persian', label: '波斯-阿拉伯' },
		{ value: 'renaissance', label: '文艺复兴' },
		{ value: 'modern_revival', label: '古典复兴' },
	] },
];

// 命盘星盘系（占星本命/十三分盘/宿占等跟随 fields）：把更多排盘选项从 record 读出。
// 默认全部 === buildFieldObject 现状（hsys 0 / zodiacal 0 / 各择宫开关 0 / doubingSu28 0 / timeAlg 0）。
// 界系(bounds/terms)：0 埃及(默认,与现状一致)/1 托勒密 Tetrabiblos/2 莉莉。三套表后端 flatlib 内已有。
const BOUNDS_SYSTEM_OPTIONS = [
	{ value: 0, label: '埃及界（默认）' },
	{ value: 1, label: '托勒密界（Tetrabiblos）' },
	{ value: 2, label: '莉莉界' },
	{ value: 3, label: '迦勒底界（推演慎用）' },
];
// 占星(希腊化)G12/G13/G20-P2 挂载可配项选项。
const WEST_NODE_OPTIONS_M = [
	{ value: 'mean', label: '平交点（默认）' },
	{ value: 'true', label: '真交点' },
];
const SECT_BUFFER_OPTIONS_M = [
	{ value: 'geo', label: '几何地平（默认）' },
	{ value: 'ptolemy5', label: 'Ptolemy 5°缓冲' },
];
const TRIPLICITY_OPTIONS_M = [
	{ value: 'Dorothean', label: '多罗特三主（默认）' },
	{ value: 'Ptolemaic', label: '托勒密二主' },
	{ value: 'PtolemaicWaterVariant', label: '托勒密·水象变体' },
];

const ASTRO_CHART_FIELDS = [
	{ name: 'hsys', label: '宫制', type: 'select', options: HSYS_OPTIONS, default: 0, group: '排盘' },
	{ name: 'zodiacal', label: '黄道', type: 'select', options: ZODIACAL_OPTIONS, default: 0, group: '排盘' },
	// 恒星黄道时的具体 ayanāṃśa（与命盘页同一套 47 制，复用印占 INDIA_AYANAMSA_OPTIONS——西洋 siderealAyanamsa 键即此）。
	// 默认 ''=随盘/后端默认(Lahiri)；prune-empty → 不覆盖存盘 ayanāṃśa（守「默认即现状」）。仅「黄道=恒星」时后端生效。
	{ name: 'siderealAyanamsa', label: '岁差制（黄道=恒星时生效）', type: 'select', options: [{ value: '', label: '默认（随盘 / Lahiri）' }, ...AstroConst.INDIA_AYANAMSA_OPTIONS], default: '', group: '排盘' },
	{ name: 'doubingSu28', label: '斗柄二十八宿', type: 'switch', options: ON_OFF, default: 0, group: '排盘' },
	{ name: 'tradition', label: '传统择宫（界/外观）', type: 'switch', options: ON_OFF, default: 0, group: '择宫' },
	// 界系（bounds）：选哪套界主表（埃及/托勒密/莉莉），影响星体「界」尊贵与界主。默认埃及=现状，prune 丢弃零回归。
	{ name: 'termsVariant', label: '界系（bounds）', type: 'select', options: BOUNDS_SYSTEM_OPTIONS, default: 0, group: '择宫' },
	// 占星(希腊化)G12/G13/G15/G20-P2:月交点真平 / 区分缓冲 / 狮子土星优先 / 三分集 / 福点反转。
	// 默认=现状零回归(平/几何/关/Dorothean/反转ON),prune 丢弃默认值 → 不调任何项与现状逐字一致;
	// 调整后经 buildFieldObject→fieldsToParams→/chart 复算,AI 快照尊贵/界主/福点与所选口径一致。
	{ name: 'westNodeType', label: '月交点（真/平）', type: 'select', options: WEST_NODE_OPTIONS_M, default: 'mean', group: '择宫' },
	{ name: 'sectBuffer', label: '区分判定（昼/夜）', type: 'select', options: SECT_BUFFER_OPTIONS_M, default: 'geo', group: '择宫' },
	{ name: 'leoBoundFirst', label: '托勒密界·狮子土星优先', type: 'switch', options: ON_OFF, default: 0, group: '择宫' },
	{ name: 'triplicity', label: '三分集', type: 'select', options: TRIPLICITY_OPTIONS_M, default: 'Dorothean', group: '择宫' },
	{ name: 'lotReversal', label: '福点按昼夜反转', type: 'switch', options: ON_OFF, default: 1, group: '择宫' },
	{ name: 'strongRecption', label: '强互容', type: 'switch', options: ON_OFF, default: 0, group: '择宫' },
	{ name: 'simpleAsp', label: '简化相位', type: 'switch', options: ON_OFF, default: 0, group: '择宫' },
	{ name: 'virtualPointReceiveAsp', label: '虚点接纳相位', type: 'switch', options: ON_OFF, default: 0, group: '择宫' },
	{ name: 'southchart', label: '南半球盘（上下翻转）', type: 'switch', options: ON_OFF, default: 0, group: '排盘' },
	{ name: 'timeAlg', label: '时间算法', type: 'select', options: TIME_ALG_OPTIONS, default: 0, group: '时间换算' },
	// 容许度整体缩放(orbScale 0.5–2.5×,默认1):merge 进 record.orbScale → buildFieldObject/fieldParams 透传 /chart
	//（对齐 models/astro.js fieldsToParams:249）→ 改相位容许度。数字型 prune 天然可用,默认 1 → undefined 不下发=现状。
	{ name: 'orbScale', label: '容许度整体缩放(×)', type: 'number', default: 1, min: 0.5, max: 2.5, step: 0.1, group: '容许度' },
	// 逐星自定义容许度(orbs 对象):用「沿用本盘存盘 orbs」布尔开关(默认关=现状,后端用默认容许度);
	// 开 → buildFieldObject 读 record.orbs(存盘的逐星表)下发 /chart。布尔型 prune 安全,规避对象恒判非默认坑。
	{ name: 'useStoredOrbs', label: '沿用本盘自定义容许度', type: 'switch', options: ON_OFF, default: 0, group: '容许度' },
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
const INDIA_CHART_FIELDS = [
	{ name: 'indiaAyanamsa', label: '岁差制', type: 'select', options: AstroConst.INDIA_AYANAMSA_OPTIONS, default: AstroConst.INDIA_AYANAMSA_DEFAULT, group: '排盘' },
	{ name: 'indiaHsys', label: '分宫制', type: 'select', options: AstroConst.INDIA_HOUSE_SYSTEM_OPTIONS, default: AstroConst.INDIA_HOUSE_SYSTEM_DEFAULT, group: '排盘' },
	{ name: 'indiaNodeType', label: '交点', type: 'select', options: AstroConst.INDIA_NODE_TYPE_OPTIONS, default: AstroConst.INDIA_NODE_TYPE_DEFAULT, group: '排盘' },
	{ name: 'indiaDashaSystem', label: '大运体系', type: 'select', options: AstroConst.INDIA_DASHA_SYSTEM_OPTIONS, default: AstroConst.INDIA_DASHA_SYSTEM_DEFAULT, group: '大运' },
	{ name: 'indiaSthiraStart', label: 'Sthira 座运起座', type: 'select', options: INDIA_STHIRA_START_OPTIONS_M, default: 'lagna', group: '大运' },
	// 大运起点 / 过运日期 / 年度盘年份:buildFieldObject 已读 record.india{DashaSeed,TransitDate,TajakaYear}、IndiaChart.fieldsToParams 已透传,
	// 仅 mount schema 此前没暴露 → 用户调不到。默认 moon/空/空 经 prune 丢弃(后端回退 moon/今日/当前年)= 现状零回归;调整则 AI 大运/行运/年度盘快照与盘一致。
	{ name: 'indiaDashaSeed', label: '大运起点（Daśā seed）', type: 'select', options: INDIA_DASHA_SEED_OPTIONS_M, default: 'moon', group: '大运' },
	{ name: 'indiaTransitDate', label: '过运日期（空=今日）', type: 'date', default: '', group: '行运/年度' },
	{ name: 'indiaTajakaYear', label: '年度盘年份（空=当前年）', type: 'number', default: '', group: '行运/年度' },
	// 挂载分盘(2026-07-05 审计补):buildIndiaSnapshotForFields 第二参本就吃 chartnum,挂载分支此前
	// 硬编码 D1 → 用户无法把 D9/D10 等分盘快照挂给 AI。默认 1=D1 现状零回归。
	// (页面另有 indiaSchool 软联动/lagnaRef/盘式/度数显示等纯前端渲染项:不达后端参数,不设死开关。)
	{ name: 'indiaChartnum', label: '挂载分盘（Varga）', type: 'select', default: 1, group: '排盘', options: [
		{ value: 1, label: 'D1 命盘（默认）' }, { value: 2, label: 'D2 财富' }, { value: 3, label: 'D3 兄弟' },
		{ value: 4, label: 'D4 家宅' }, { value: 7, label: 'D7 子女' }, { value: 9, label: 'D9 婚姻' },
		{ value: 10, label: 'D10 事业' }, { value: 12, label: 'D12 父母' }, { value: 16, label: 'D16 车乘' },
		{ value: 20, label: 'D20 修行' }, { value: 24, label: 'D24 学业' }, { value: 27, label: 'D27 体力' },
		{ value: 30, label: 'D30 灾厄' }, { value: 40, label: 'D40 母系' }, { value: 45, label: 'D45 父系' },
		{ value: 60, label: 'D60 总业' },
	] },
];

// 主限法·表格（primarydirect）：列未来 pdYears 年全部 direction 行。方位法 + 时间换算 + 顺逆 + 映点/界 + pdYears
// （全部 === buildFieldObject 现状；无 datetime——表格是「年限范围」不是「单一时刻」）。
const PRIMARY_DIRECT_TABLE_FIELDS = [
	{ name: 'pdMethod', label: '方位法', type: 'select', options: PD_METHOD_OPTIONS, default: DEFAULT_PD_METHOD, group: '方位法' },
	{ name: 'pdTimeKey', label: '度数换算', type: 'select', options: PD_TIME_KEY_OPTIONS, default: DEFAULT_PD_TIME_KEY, group: '方位法' },
	{ name: 'pdtype', label: '主限法', type: 'select', default: 0, group: '方位法', options: [
		{ value: 0, label: '主限法（默认）' },
		{ value: 1, label: '界限法' },
	] },
	{ name: 'pdDirect', label: '顺向（zodiacal）', type: 'switch', options: ON_OFF, default: 1, group: '方向' },
	{ name: 'pdConverse', label: '逆向（converse）', type: 'switch', options: ON_OFF, default: 1, group: '方向' },
	{ name: 'pdAntiscia', label: '映点', type: 'switch', options: ON_OFF, default: 0, group: '方向' },
	{ name: 'pdTerms', label: '界（terms）', type: 'switch', options: ON_OFF, default: 0, group: '方向' },
	// 推算年数:默认 100(对齐 AstroPrimaryDirection.normalizePdYears 兜底),范围 1–3000(>360 走多圈复发行)。
	// merge 进 record.pdYears → buildFieldObject/fieldParams 透传 /chart → Java 转发 → Python max_arc,
	// 改它真实改变方向列表覆盖的年限(round-trip 通)。>180 走 forward/complement 互补弧扩展。
	{ name: 'pdYears', label: '推算年数', type: 'number', default: 100, min: 1, max: 3000, group: '范围' },
];
// 主限法·盘（primarydirchart）：选一准确「时刻」→ 换算成主限年龄弧 → 出真盘快照。
// 方位法 + 度数换算 + 时间(datetime,default '') + 向运方向；无 pdYears（盘是「单一时刻」不是「年限范围」）。
// datetime default 恒 ''（空→builder 取此刻；不破 prune-empty 铁律）。
const PRIMARY_DIRECT_CHART_FIELDS = [
	{ name: 'datetime', label: '时间选择(空=此刻)', type: 'datetime', default: '', group: '时间' },
	{ name: 'pdMethod', label: '方位法', type: 'select', options: PD_METHOD_OPTIONS, default: DEFAULT_PD_METHOD, group: '方位法' },
	{ name: 'pdTimeKey', label: '度数换算', type: 'select', options: PD_TIME_KEY_OPTIONS, default: DEFAULT_PD_TIME_KEY, group: '方位法' },
	{ name: 'direction', label: '向运方向', type: 'select', default: 'direct', group: '方向', options: [
		{ value: 'direct', label: '顺向 Direct（默认）' },
		{ value: 'converse', label: '逆向 Converse' },
	] },
];

// 七政四余（Moira）：命度模式 / 罗计模式 走全局 localStorage（buildGuolaoSnapshotForFields 经
// guolaoLifeModeFromFields/guolaoNodeModeFromFields 读 fields，缺省回退 getStoredGuolaoLifeMode/NodeMode）。
// C 类语义（2026-06 修正）：挂载覆盖只「临时」写这些全局 key 供 builder 重算自读，调用方
// （aiAnalysisContext）必须先 snapshotLocalStorageSettings 再在 finally restoreLocalStorageSettings——
// 否则一次挂载覆盖会永久改写用户的全局显示设置。想真正改默认走「设为同类默认」（saveMountTechniqueDefaults）。
const GUOLAO_DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const GUOLAO_FIELDS = [
	{ name: 'lifeMode', label: '七政命度', type: 'select', default: 'asc', group: '命度', storageKey: 'horosaGuolaoLifeMode', options: [
		{ value: 'asc', label: '占星上升（默认）' },
		{ value: 'yumao', label: '日出安命' },
		{ value: 'gumao', label: '遇卯安命(古法)' },
		{ value: 'cotrans', label: '赤黄转换' },
		...GUOLAO_DIZHI.map((z)=>({ value: z, label: `自定命宫·${z}` })),
	] },
	{ name: 'bodyMode', label: '身宫法', type: 'select', default: 'taiyin', group: '命度', storageKey: 'horosaGuolaoBodyMode', options: [
		{ value: 'taiyin', label: '太阴落宫(果老,默认)' },
		{ value: 'youjin', label: '逢酉(琴堂)' },
		...GUOLAO_DIZHI.map((z)=>({ value: z, label: `自定身宫·${z}` })),
	] },
	{ name: 'nodeMode', label: '罗计', type: 'select', default: 'northKetuSouthRahu', group: '命度', storageKey: 'horosaGuolaoNodeMode', options: [
		{ value: 'northKetuSouthRahu', label: '北计南罗（默认）' },
		{ value: 'northRahuSouthKetu', label: '北罗南计' },
	] },
	{ name: 'su28Mode', label: '宿度制', type: 'select', default: 2, group: '命度', storageKey: 'horosaGuolaoSu28Mode', options: [
		{ value: 2, label: '回归今宿（默认）' },
		{ value: 3, label: '回归古制开禧' },
		{ value: 4, label: '恒星制（黄道）' },
		{ value: 6, label: '授时历古法' },
		{ value: 0, label: '荀爽距星(19年测)' },
		{ value: 1, label: '斗柄定房法' },
		{ value: 5, label: '恒星制·现代天赤' },
		{ value: 7, label: '赤道回归(元明)' },
		{ value: 8, label: '赤道回归(实时)' },
	] },
	// 宿度制条件子选项(WP-D/赤道回归):仅特定宿度制下后端生效,showWhen 条件揭示(对齐 GuoLaoInput doubingSu28===4/6/7/8)。
	// GuoLaoChartMain.fieldsToParams:1888/1908-1915 读 fields.guolao{Ayanamsa,TuibianMethod,GufaPrecess,EqTropicalAnchor}(C 类 storageKey 回退 getStored)→ /chart 重排盘。默认即现状零回归。
	{ name: 'guolaoAyanamsa', label: '恒星岁差（宿度制=恒星制黄道）', type: 'select', default: '', group: '命度', storageKey: 'horosaGuolaoAyanamsa',
		showWhen: (d)=>Number(d.su28Mode) === 4,
		options: [{ value: '', label: '郑式（默认）' }, ...AstroConst.INDIA_AYANAMSA_OPTIONS] },
	{ name: 'guolaoTuibianMethod', label: '推变法（宿度制=授时历古法）', type: 'select', default: 'jiyuan', group: '命度', storageKey: 'horosaGuolaoTuibianMethod',
		showWhen: (d)=>Number(d.su28Mode) === 6,
		options: [{ value: 'jiyuan', label: '纪元闭式（默认）' }, { value: 'jintui', label: '进退法（大衍）' }, { value: 'huiyuan', label: '会圆术（授时）' }] },
	{ name: 'guolaoGufaPrecess', label: '古宿岁差（宿度制=授时历古法）', type: 'select', default: 0, group: '命度', storageKey: 'horosaGuolaoGufaPrecess',
		showWhen: (d)=>Number(d.su28Mode) === 6,
		options: [{ value: 0, label: '钉死元时（默认）' }, { value: 1, label: '随岁差东移' }] },
	{ name: 'guolaoEqTropicalAnchor', label: '回归锚点（宿度制=赤道回归）', type: 'select', default: 'dongzhi', group: '命度', storageKey: 'horosaGuolaoEqTropicalAnchor',
		showWhen: (d)=>Number(d.su28Mode) === 7 || Number(d.su28Mode) === 8,
		options: [{ value: 'dongzhi', label: '牛前·冬至270°（默认）' }, { value: 'chunfen', label: '春分·壁2.3°' }] },
	{ name: 'trueSolarTime', label: '报时星太阳时', type: 'select', default: 'true', group: '四余/时间', storageKey: 'horosaGuolaoTrueSolarTime', options: [
		{ value: 'true', label: '真太阳时（经度+均时差，默认）' },
		{ value: 'mean', label: '平太阳时（仅经度）' },
		{ value: 'off', label: '钟表时' },
	] },
	{ name: 'nodeType', label: '罗计取法', type: 'select', default: 'mean', group: '四余/时间', storageKey: 'horosaGuolaoNodeType', options: [
		{ value: 'mean', label: '平交点（默认）' },
		{ value: 'true', label: '真交点' },
	] },
	{ name: 'lilithType', label: '月孛取法', type: 'select', default: 'mean', group: '四余/时间', storageKey: 'horosaGuolaoLilithType', options: [
		{ value: 'mean', label: '平远地点（默认）' },
		{ value: 'true', label: '真远地点' },
	] },
];

// 量化盘（汉堡）：经 buildGermanySnapshotForFields(buildFieldObject(record)) 真实重算——读 宫制/黄道/时间算法
// （fieldsToParams → /chart + /germany/midpoint，改它们改中点盘/90°盘/中点相位）。故暴露这 3 项（record 类，
// regen 分支已存在于 aiAnalysisContext case 'germany'）。TNP/中点/orb 是内部常量、不入快照，仍不暴露。
// 实测 germany fieldsToParams(AstroMidpoint.js:18) 给 /chart 下发 hsys/zodiacal(+tradition 等)、但**不发 timeAlg**
// → timeAlg 对中点盘 inert，故只暴露 hsys/zodiacal（守"不放无效选项"；原审计 D-❌6「读 timeAlg」有误）。
const GERMANY_FIELDS = ASTRO_CHART_FIELDS.filter((f)=>['hsys', 'zodiacal'].includes(f.name));


// 推运·三分主星：区间光体三分主星分掌人生阶段。builder buildTriplicityRulersSnapshotText(chartObj,opts) 已收 opts。
const TRIPLICITY_FIELDS = [
	{ name: 'system', label: '三分体系', type: 'select', default: TRIPLICITY_DEFAULT_OPTS.system, group: '划分',
		options: Object.keys(TRIPLICITY_SYSTEMS).map((k)=>({ value: k, label: TRIPLICITY_SYSTEMS[k] })) },
	{ name: 'division', label: '划分法', type: 'select', default: TRIPLICITY_DEFAULT_OPTS.division, group: '划分',
		options: Object.keys(TRIPLICITY_DIVISIONS).map((k)=>({ value: k, label: TRIPLICITY_DIVISIONS[k] })) },
	{ name: 'lifespan', label: '寿命基准（年龄上限）', type: 'number', default: TRIPLICITY_DEFAULT_OPTS.lifespan, min: 30, max: 120, group: '划分' },
];

// 推运·Balbillus：起始星 / 年制 / 距离口径。builder buildBalbillusSnapshotText(chartObj,opts) 已收 opts。
const SEVEN_PLANETS_OPTS = [
	{ value: AstroConst.SUN, label: '太阳' },
	{ value: AstroConst.MOON, label: '太阴' },
	{ value: AstroConst.MERCURY, label: '水星' },
	{ value: AstroConst.VENUS, label: '金星' },
	{ value: AstroConst.MARS, label: '火星' },
	{ value: AstroConst.JUPITER, label: '木星' },
	{ value: AstroConst.SATURN, label: '土星' },
];
const BALBILLUS_FIELDS = [
	{ name: 'startPlanet', label: '起始星', type: 'select', default: BALBILLUS_DEFAULT_OPTS.startPlanet, group: '起运', options: SEVEN_PLANETS_OPTS },
	{ name: 'yearType', label: '年制', type: 'select', default: BALBILLUS_DEFAULT_OPTS.yearType, group: '起运',
		options: Object.keys(BALBILLUS_YEAR_TYPES).map((k)=>({ value: k, label: BALBILLUS_YEAR_TYPES[k].label })) },
	{ name: 'mode', label: '距离口径', type: 'select', default: BALBILLUS_DEFAULT_OPTS.mode, group: '起运',
		options: Object.keys(BALBILLUS_MODES).map((k)=>({ value: k, label: BALBILLUS_MODES[k] })) },
];

// 推运·关键点（120 年）：释放点 命/身。builder buildKeypointsSnapshotText(chartObj,opts) 已收 opts。
const KEYPOINTS_FIELDS = [
	{ name: 'mode', label: '释放点', type: 'select', default: KEYPOINTS_DEFAULT_OPTS.mode, group: '释放',
		options: Object.keys(RELEASE_MODES).map((k)=>({ value: k, label: RELEASE_MODES[k] })) },
];

// 推运·黄道星释（zodiacal releasing）：推运基点(11) + 输出层级(L1全/L2/L3/L4) + 逐层钻取 idx。
// builder buildZodialReleaseSnapshotText(chartObj,opts) 加 opts 透传 basePoint→startSign + aiMode/idx 进 buildZRAISnapshot。
// 默认 福点 + L1 全列 + idx0 === 无头 builder 现状（缺省经 prune 丢弃 → 字节级一致）。
const ZODIAL_RELEASE_FIELDS = [
	{ name: 'basePoint', label: '推运基点', type: 'select', default: ZR_BASE_POINTS[0], group: '基点',
		options: ZR_BASE_POINTS.map((p)=>({ value: p, label: p })) },
	{ name: 'aiMode', label: '输出层级', type: 'select', default: (ZR_AI_MODES[0] || {}).value, group: '输出', options: ZR_AI_MODES },
	{ name: 'aiL1Idx', label: 'L1 序号(0 起,层级=L2/L3/L4 时定位)', type: 'number', default: 0, min: 0, group: '输出' },
	{ name: 'aiL2Idx', label: 'L2 序号(0 起)', type: 'number', default: 0, min: 0, group: '输出' },
	{ name: 'aiL3Idx', label: 'L3 序号(0 起)', type: 'number', default: 0, min: 0, group: '输出' },
];

// 推运·十年大运（decennials）：起运主星 + 分配次序 + 日限体系 + 时间口径 + 输出层级 + 逐层钻取。
// builder buildDecennialsSnapshotText(chartObj,opts) 加 opts 透传 settings + aiState。默认全部 === 无头 builder 现状。
const DECENNIALS_FIELDS = [
	{ name: 'startMode', label: '起运主星', type: 'select', default: (DECENNIALS_START_MODES[0] || {}).value, group: '起运', options: DECENNIALS_START_MODES },
	{ name: 'orderType', label: '分配次序', type: 'select', default: (DECENNIALS_ORDER_TYPES[0] || {}).value, group: '起运', options: DECENNIALS_ORDER_TYPES },
	{ name: 'dayMethod', label: '日限体系', type: 'select', default: (DECENNIALS_DAY_METHODS[0] || {}).value, group: '起运', options: DECENNIALS_DAY_METHODS },
	{ name: 'calendarType', label: '时间口径', type: 'select', default: (DECENNIALS_CALENDAR_TYPES[0] || {}).value, group: '起运', options: DECENNIALS_CALENDAR_TYPES },
	{ name: 'aiMode', label: '输出层级', type: 'select', default: (DECENNIALS_AI_MODES[0] || {}).value, group: '输出', options: DECENNIALS_AI_MODES },
	{ name: 'aiL1Idx', label: 'L1 序号(0 起)', type: 'number', default: 0, min: 0, group: '输出' },
	{ name: 'aiL2Idx', label: 'L2 序号(0 起)', type: 'number', default: 0, min: 0, group: '输出' },
	{ name: 'aiL3Idx', label: 'L3 序号(0 起)', type: 'number', default: 0, min: 0, group: '输出' },
];

// 推运·行星弧（planetary arc）：弧源(7 星) + 目标时刻 + 容许度。
// builder buildPlanetaryArcSnapshotText(chartObj,opts) 加 opts。默认 月亮/空(→today)/1 === 无头现状。
const PLANETARY_ARC_FIELDS = [
	{ name: 'arcSource', label: '弧源天体', type: 'select', default: ARC_SOURCES[0], group: '弧源',
		options: ARC_SOURCES.map((p)=>({ value: p, label: p })) },
	// P4：目标时刻改 datetime picker（空显示「此刻/今日」但 default 恒 ''，不破 prune）。
	{ name: 'targetDatetime', label: '目标时刻(空=今日)', type: 'datetime', default: '', group: '弧源' },
	{ name: 'asporb', label: '容许度(°)', type: 'number', default: 1, min: 0, max: 12, group: '弧源' },
	// P4 区间扫描：end 非空且 step 有值时，builder 循环多段（每段一个目标时刻）。
	...scanRangeDatetimeFields('区间扫描'),
];

// 推运·波斯向运（persian directed）：速率(波斯/Prophected/Naibod) + 方向(顺/逆) + 应期年数(50/90/120/150/200)。
// builder buildPersianDirectedSnapshotText(chartObj,opts) 加 opts。默认 persian/direct/90 === 无头现状。
const PERSIAN_DIRECTED_FIELDS = [
	{ name: 'rateKey', label: '速率', type: 'select', default: 'persian', group: '向运',
		options: Object.keys(PERSIAN_RATE_LABEL).map((k)=>({ value: k, label: PERSIAN_RATE_LABEL[k] })) },
	{ name: 'direction', label: '方向', type: 'select', default: 'direct', group: '向运', options: [
		{ value: 'direct', label: '顺向（+°/年）' },
		{ value: 'converse', label: '逆向（−°/年）' },
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
	{ name: 'targetTime', label: '目标时刻(空=12:00:00)', type: 'time', default: '', group: '目标' },
	// 小推运月长(vedicprog/jaynesprog 共用):AstroVedic/JaynesProgressions:32 读 opts.minorVariant 进重算请求,改推运盘月长换算口径(引擎原值/朔望月/恒星月)。
	//   默认 engine(=组件 state 初值)prune 后丢弃零回归;regen makeOpts 同补 minorVariant 透传。内联镜像 AstroProgChart.MINOR_VARIANT_OPTIONS(test 断言防漂移)。
	{ name: 'minorVariant', label: '小推运月长', type: 'select', default: 'engine', group: '目标', options: [
		{ value: 'engine', label: '引擎原值（现状）' },
		{ value: 'synodic', label: '朔望月每年（标准）' },
		{ value: 'sidereal', label: '恒星月每年' },
	] },
	// P4 区间扫描：以 targetDate 为起点、datetimeEnd 为终点，按 step 循环多段（每段一个目标日期，时刻沿用 targetTime）。
	...scanRangeDateFields('区间扫描'),
];

// 目标时刻型 5 法（小限/太阳弧/太阳返照/月亮返照/流年）：共用 buildPredictivePeriodSnapshot(chartObj,key,opts)。
// 默认 datetime 空(→此刻) / tmType 'y' / asporb 1 / nodeRetrograde 0 === builder 现状。returns 另加 异地 dirLat/dirLon。
const PREDICTIVE_PERIOD_BASE_FIELDS = [
	// P4：目标时刻改 datetime picker（空显示「此刻」但 default 恒 ''，不破 prune）。
	{ name: 'datetime', label: '目标时刻(空=此刻)', type: 'datetime', default: '', group: '目标' },
	{ name: 'tmType', label: '步进', type: 'select', default: 'y', group: '目标', options: [
		{ value: 'y', label: '逐年' },
		{ value: 'm', label: '逐月' },
		{ value: 'd', label: '逐日' },
	] },
	{ name: 'asporb', label: '容许度(°)', type: 'number', default: 1, min: 0, max: 12, group: '目标' },
	{ name: 'nodeRetrograde', label: '南北交逆移', type: 'switch', options: ON_OFF, default: 0, group: '目标' },
	// P4 区间扫描：datetime 为起点、datetimeEnd 为终点，按 scanStep 循环多段（每段一个推运时点）。
	// 注：scanStep（区间步进）与上方 tmType（推运内部步进）是两个独立概念，互不冲突。
	...scanRangeDatetimeFields('区间扫描'),
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
const SANSHI_UNITED_FIELDS = [
	...reTagSanshi(LIURENG_FIELDS, '大六壬'),
	...reTagSanshi(QIMEN_FIELDS, '奇门'),
	...reTagSanshi(TAIYI_FIELDS, '太乙'),
	{ name: 'timeAlg', label: '时间算法（奇门）', type: 'select', options: TIME_ALG_OPTIONS, default: 0, group: '时间换算' },
	...DAY_BOUNDARY_FIELDS,
];

export const TECHNIQUE_SETTINGS_SCHEMA = {
	// ---- A 类：命盘星盘系（fields 驱动）----
	astrochart: { kind: 'record', fields: ASTRO_CHART_FIELDS },
	astrochart_like: { kind: 'record', fields: ASTRO_CHART_FIELDS },
	indiachart: { kind: 'record', fields: INDIA_CHART_FIELDS, emptyHint: '印度盘按出生信息起盘，可调岁差制/分宫制。' },
	// 宿占=占星起盘 + 宿盘专属「人事十二宫起宫」(ASC起盘/八字公式起盘,SZConst.SZHouseStart_*);
	// 独立拼 fields(不污染 astrochart 共用的 ASTRO_CHART_FIELDS)。默认 0=八字公式起盘=现状。
	suzhan: { kind: 'record', fields: [...ASTRO_CHART_FIELDS, {
		name: 'houseStartMode', label: '人事十二宫起盘', type: 'select', default: 0, group: '排盘',
		options: [{ value: 0, label: '八字公式起盘（默认）' }, { value: 1, label: 'ASC起盘' }],
	}] },
	// 演禽/策天：经 ken 后端按出生时间起盘（纯命盘类、无事盘）。
	// 注：禽星盘只取生辰原始时刻，ken 引擎不消费 日界/晚子时/真太阳时换算（parseFieldsDateTime 只读 date/time/zone/lat/lon）→
	// 此前挂 TIME_FIELDS 是「可选但无效」的死设置，移除以免误导（报告配置/AI 挂载两处都不再显示无效项）。
	xianqin: { kind: 'record', fields: [], emptyHint: '演禽按出生时间起盘，无独立可调排盘设置。' },
	// kinastro 系七技法(2026-07-05 审计补):此前可导出不可挂载;按出生时间经 ken 后端起盘,
	// 页面无独立可调排盘设置 → 与演禽同范式(record + emptyHint),仅内容勾选。
	qizhengkin: { kind: 'record', fields: [], emptyHint: '七政四余（七政）按出生时间起盘，无独立可调排盘设置。' },
	shaozi: { kind: 'record', fields: [], emptyHint: '邵子神数按出生时间起数，无独立可调排盘设置。' },
	tieban: { kind: 'record', fields: [], emptyHint: '铁板神数按出生时间考刻起数，无独立可调排盘设置。' },
	fendjing: { kind: 'record', fields: [], emptyHint: '鬼谷分定经按出生时间起盘，无独立可调排盘设置。' },
	beiji: { kind: 'record', fields: [], emptyHint: '北极神数按出生时间起数，无独立可调排盘设置。' },
	nanji: { kind: 'record', fields: [], emptyHint: '南极神数按出生时间起数，无独立可调排盘设置。' },
	chunzi: { kind: 'record', fields: [], emptyHint: '蠢子数按出生时间起数，无独立可调排盘设置。' },
	// 策天飞星：算法(书/原)+原法子选项 + 5 显示开关；全默认=现状(prune 为空，零字节差)。show_* 经 payload 下发后端过滤输出段/行。
	cetian: { kind: 'payload', optionsPath: '', group: '策天飞星', fields: [
		{ name: 'method', label: '排盘算法', type: 'select', default: 'book', group: '排盘方法', options: [
			{ value: 'book', label: '书法·策天本法' },
			{ value: 'kentang', label: '原法·标准紫微嫁接' },
		] },
		{ name: 'lunarMode', label: '农历算法', type: 'select', default: 'sxtwl', group: '排盘方法', when: { method: 'kentang' }, options: [
			{ value: 'sxtwl', label: 'sxtwl（修正）' },
			{ value: 'classic', label: '原闰月法' },
		] },
		{ name: 'starOrder', label: '十二正曜布法', type: 'select', default: 'reverse', group: '排盘方法', when: { method: 'kentang' }, options: [
			{ value: 'reverse', label: '逆布（书）' },
			{ value: 'forward', label: '顺布（原）' },
		] },
		{ name: 'showBrightness', label: '显示亮度', type: 'switch', options: ON_OFF, default: 1, group: '显示选项' },
		{ name: 'showWuXingJu', label: '显示五行局', type: 'switch', options: ON_OFF, default: 1, group: '显示选项', when: { method: 'kentang' } },
		{ name: 'showSihua', label: '显示四化', type: 'switch', options: ON_OFF, default: 1, group: '显示选项', when: { method: 'kentang' } },
		{ name: 'showFlying', label: '显示飞星格局', type: 'switch', options: ON_OFF, default: 1, group: '显示选项', when: { method: 'kentang' } },
		{ name: 'showSolarTerm', label: '显示节气', type: 'switch', options: ON_OFF, default: 1, group: '显示选项', when: { method: 'kentang' } },
	] },
	// 皇极经世：双栖——命盘侧按出生重算(buildHuangJiSnapshotForFields)，又可存事盘(报数/起例确定性结果)。
	// 与五兆/太玄/荆诀/神易数 同列 sectionsOnly：事盘按 payload.snapshot 出正文不重算，且去掉事盘上误显的
	// TIME_FIELDS 覆盖(对已定型存案无意义、覆盖重算会落空)；命盘侧重算不受 schema.kind 影响(buildTechniqueContext chart 分支仍重算)。
	huangji: { kind: 'sectionsOnly', reason: '皇极经世按时间确定起盘(命盘侧按出生重算、事盘读已存结果)，仅可勾选纳入内容、不按挂载覆盖重算。' },

	// ---- A 类：星运（主限法 + 三分主星 / Balbillus / 关键点 可调；其余推运参数固定=现状则空 schema）----
	// 拆分（P5）：表格用年限范围(pdYears,无 datetime)，盘用单一时刻(datetime,无 pdYears)。
	primarydirect: { kind: 'record', fields: PRIMARY_DIRECT_TABLE_FIELDS },
	primarydirchart: { kind: 'record', fields: PRIMARY_DIRECT_CHART_FIELDS },
	// 这三者的 standalone builder 已收 (chartObj,opts)；regen 据 record.* 组 opts 传入（见 aiAnalysisContext）。
	triplicityrulers: { kind: 'record', fields: TRIPLICITY_FIELDS },
	balbillus: { kind: 'record', fields: BALBILLUS_FIELDS },
	keypoints: { kind: 'record', fields: KEYPOINTS_FIELDS },
	// 批3：以下推运 builder 加了 opts 形参 + regen 据 record.* 传入（见 aiAnalysisContext regenerateChartTechniqueSnapshot）。
	zodialrelease: { kind: 'record', fields: ZODIAL_RELEASE_FIELDS },
	decennials: { kind: 'record', fields: DECENNIALS_FIELDS },
	planetaryarc: { kind: 'record', fields: PLANETARY_ARC_FIELDS },
	persiandirected: { kind: 'record', fields: PERSIAN_DIRECTED_FIELDS },
	vedicprog: { kind: 'record', fields: PROG_TARGET_FIELDS },
	jaynesprog: { kind: 'record', fields: PROG_TARGET_FIELDS },
	// 目标时刻型 5 法：共用 buildPredictivePeriodSnapshot(chartObj,key,opts)。profection/solararc 只 4 基项；
	// 3 返照(solarreturn/lunarreturn/givenyear)另加 异地 dirLat/dirLon。
	profection: { kind: 'record', fields: PREDICTIVE_PERIOD_BASE_FIELDS },
	solararc: { kind: 'record', fields: PREDICTIVE_PERIOD_BASE_FIELDS },
	solarreturn: { kind: 'record', fields: [...PREDICTIVE_PERIOD_BASE_FIELDS, ...PREDICTIVE_RETURN_DIR_FIELDS] },
	lunarreturn: { kind: 'record', fields: [...PREDICTIVE_PERIOD_BASE_FIELDS, ...PREDICTIVE_RETURN_DIR_FIELDS] },
	givenyear: { kind: 'record', fields: [...PREDICTIVE_PERIOD_BASE_FIELDS, ...PREDICTIVE_RETURN_DIR_FIELDS] },

	// ---- A 类：八字 / 紫微（时间类）----
	bazi: { kind: 'record', fields: [
		// 八字 timeAlg=3 档（真太阳时/直接时间/春分定卯时，源 CnTraditionInput），不复用 2 档 TIME_FIELDS；日界/晚子时共用。
		{ name: 'timeAlg', label: '时间算法', type: 'select', options: BAZI_TIME_ALG_OPTIONS, default: 0, group: '时间换算' },
		...DAY_BOUNDARY_FIELDS,
		// 计算选项（CnTraditionInput phaseType）：长生 火土同/水土同/阳顺阴逆——原 schema 误标「标准/变体」且漏值 2（选不到）。
		{ name: 'phaseType', label: '计算选项（长生）', type: 'select', default: 0, group: '取用', options: [
			{ value: 0, label: '长生火土同（默认）' },
			{ value: 1, label: '长生水土同' },
			{ value: 2, label: '长生阳顺阴逆' },
		] },
		// 神煞主位（CnTraditionInput godKeyPos）：年/日/年日——原 schema 漏「年日」。
		{ name: 'godKeyPos', label: '神煞主位', type: 'select', default: '年', group: '取用', options: [
			{ value: '年', label: '按年柱查神煞（默认）' },
			{ value: '日', label: '按日柱查神煞' },
			{ value: '年日', label: '年柱日柱都查' },
		] },
		// 盘法 4 项（CnTraditionInput 命宫起法/月律分野/起运精度/藏干版本）：BaZi.js:722/767-771 据 baziOpt 触发重算并转发后端,
		//   改命宫/月令分野/起运岁/藏干打分 → 真改 ground-truth。live 盘走 BaZi.js 自身 params;但 AI 挂载侧走 buildChartBaziParams,
		//   此前漏转发 → 挂载/导出快照这 4 项恒默认。补 4 字段 + buildChartBaziParams 同补转发(读 record,与 school 同范式)。默认即现状零回归。
		{ name: 'minggongMethod', label: '命宫起法', type: 'select', default: 'tongxing', group: '盘法', options: [
			{ value: 'tongxing', label: '通行版（默认）' },
			{ value: 'shufa', label: '子平数法' },
		] },
		{ name: 'fenyeVersion', label: '月律分野', type: 'select', default: 'common', group: '盘法', options: [
			{ value: 'common', label: '通行版（默认）' },
			{ value: 'fajue', label: '法诀版' },
		] },
		{ name: 'dayunPrecision', label: '起运精度', type: 'select', default: 'precise', group: '盘法', options: [
			{ value: 'precise', label: '精确(年月日时,默认)' },
			{ value: 'integer', label: '整数(取整岁)' },
		] },
		{ name: 'cangVersion', label: '藏干版本', type: 'select', default: 'common', group: '盘法', options: [
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
		{ name: 'school', label: '断命流派', type: 'select', default: 'zonghe', group: '流派', options: [
			{ value: 'zonghe', label: '传统综合（默认）' },
			{ value: 'fuyi', label: '扶抑派' },
			{ value: 'geju', label: '格局派' },
			{ value: 'tiaohou', label: '调候派' },
			{ value: 'bingyao', label: '病药派' },
			{ value: 'mangpai', label: '盲派' },
			{ value: 'nayin', label: '纳音古法' },
		] },
		// 多运限(批A)：流年(逗号年份串) / 流月(节气月序1–12) / 流日(锚定首流年首流月,公历日1–31) / 流时(时辰序0–11)。
		// 全空(默认)=不追加多运限段=现状(守「默认即现状」)。流月读现成 subDirect[].flowMonths；流日/流时调 buildFlowDays/Hours。
		{ name: 'liunianSel', label: '流年(公历年,逗号分隔,如 2024,2025)', type: 'text', default: '', group: '运限' },
		{ name: 'liuyueSel', label: '流月(节气月序1–12,可多选)', type: 'multiselect', default: [], group: '运限', options: LUNAR_MONTH_OPTIONS },
		{ name: 'liuriSel', label: '流日(公历日1–31,可多选,锚定首流年首流月)', type: 'multiselect', default: [], group: '运限', options: LUNAR_DAY_OPTIONS },
		{ name: 'liushiSel', label: '流时(时辰序0–11子起,可多选,锚定首流日)', type: 'multiselect', default: [], group: '运限', options: SHICHEN_OPTIONS },
	] },
	ziwei: { kind: 'record', fields: [
		...TIME_FIELDS,
		// 四化流派:进快照(切流派改星曜四化标注 + 后端格局判定)。merge 进 record.sihuaSchool →
		// buildChartZiweiParams 挂上 params.sihuaSchool → buildZiweiSnapshotForParams 临时切单例复算(用毕还原)。
		{ name: 'sihuaSchool', label: '四化流派', type: 'select', default: 'beipai', group: '流派', options: [
			{ value: 'beipai', label: '通用·飞星（默认）' },
			{ value: 'zhongzhou', label: '中州派' },
			{ value: 'quanshu', label: '全书系' },
			{ value: 'beixiang', label: '北派(天相忌)' },
			{ value: 'custom', label: '自定义' },
		] },
		// 传本/排盘开关(本地引擎):任一非默认 → buildZiweiSnapshotForParams 临时覆盖 ZWEngineOptions 并以本地引擎重排盘+重算格局,
		// 使挂载/导出快照与该盘传本设置一致;全默认(缺省·被 pruneOptionsToNonDefault 剪掉不进 record)=回退全局单例=现状逐字节一致。
		{ name: 'daxianSpan', label: '大限跨度', type: 'select', default: 10, group: '传本', options: ZW_DAXIAN_SPAN_OPTIONS },
		{ name: 'tianmaBasis', label: '天马依据', type: 'select', default: 'month', group: '传本', options: ZW_TIANMA_BASIS_OPTIONS },
		{ name: 'starSet', label: '星集', type: 'select', default: 'full', group: '传本', options: ZW_STAR_SET_OPTIONS },
		{ name: 'sanPan', label: '观察盘(三盘)', type: 'select', default: 'tian', group: '传本', options: ZW_SANPAN_OPTIONS },
		{ name: 'shangShi', label: '天伤天使', type: 'select', default: 'fixed', group: '传本', options: ZW_SHANGSHI_OPTIONS },
		{ name: 'leapMonth', label: '闰月归月', type: 'select', default: 'mid_split', group: '传本', options: ZW_LEAP_MONTH_OPTIONS },
		{ name: 'lateZi', label: '晚子时', type: 'select', default: 'zi_chu', group: '传本', options: ZW_LATE_ZI_OPTIONS },
		{ name: 'yearBoundary', label: '定年界线', type: 'select', default: 'lichun', group: '传本', options: ZW_YEAR_BOUNDARY_OPTIONS },
		{ name: 'huoling', label: '火铃', type: 'select', default: 'sanhe', group: '传本', options: ZW_HUOLING_OPTIONS },
		{ name: 'kongNaming', label: '空劫命名', type: 'select', default: 'modern', group: '传本', options: ZW_KONG_NAMING_OPTIONS },
		// 运限层(多选,批A)：大限已逐宫含于[宫位总览];选所选层即让快照追加[运限]段(逐层钻取四化落宫+流曜)。
		// 流年/流月/流日/流时是盘面交互导航,本由 chart 本地推算(无后端参数)→ 复用 ZWLuckPanel 同口径构造器。
		// 多选语义：大限/流年/流月对所选每项各产一段(流年×流月笛卡尔);流日/流时锚定到所选的第一个上层。
		// 全空(默认)=不追加[运限]段=现状(守「默认即现状」,逐字节一致)。总段数上限~50,超限截断+提示行。
		{ name: 'daxianSel', label: '大限(命盘宫位序0–11,可多选)', type: 'multiselect', default: [], group: '运限', options: ZIWEI_DAXIAN_OPTIONS },
		{ name: 'liunianSel', label: '流年小限(公历年,逗号分隔多年,如 1996,2000;小限随年按虚岁自动并出)', type: 'text', default: '', group: '运限' },
		{ name: 'liuyueSel', label: '流月(农历月1–12,可多选)', type: 'multiselect', default: [], group: '运限', options: LUNAR_MONTH_OPTIONS },
		{ name: 'liuriSel', label: '流日(农历日1–31,可多选,锚定首个上层)', type: 'multiselect', default: [], group: '运限', options: LUNAR_DAY_OPTIONS },
		{ name: 'liushiSel', label: '流时(时辰序0–11子起,可多选,锚定首个上层)', type: 'multiselect', default: [], group: '运限', options: SHICHEN_OPTIONS },
	] },

	// ---- A 类：数算（时间换算 + 流派）----
	// 邵子参评数 method(明法/古法)：buildCanpingSnapshotForRecord/canpingLiunianSeries 透传 opts.method →
	// dayPalace(canpingLocal) 改命宫取法(明法=月支反向 / 古法=日支)，真改快照(round-trip 通)。默认 ming === 现状。
	canping: { kind: 'record', fields: [
		...TIME_FIELDS,
		{ name: 'method', label: '取法', type: 'select', default: 'ming', group: '取法', options: [
			{ value: 'ming', label: '明法（月支反向，默认）' },
			{ value: 'gu', label: '古法（八字日支）' },
		] },
	] },
	// 河洛 quHuaGong(取化工法)：buildHeluoSnapshotForRecord 仅在「显式覆盖」时据真实节气算化工并传 judge(改[命运篇]化工行)；
	// 缺省/默认 → 走 st=null 月支近似(=现状,字节级一致)。仅四立前18日(土用)窗口内、且选 siFangBoOnly 时与默认不同。
	heluo: { kind: 'record', fields: [
		...TIME_FIELDS,
		{ name: 'quHuaGong', label: '取化工法', type: 'select', default: 'tuWangKunGen', group: '取化工', options: [
			{ value: 'tuWangKunGen', label: '土王寄坤艮（月支近似，默认=现状）' },
			{ value: 'siFangBoOnly', label: '直取四方伯（真实节气，仅四方伯卦）' },
		] },
		{ name: 'ziShuMode', label: '取数法', type: 'select', default: 'pair', group: '起卦分歧', options: [
			{ value: 'pair', label: '成对全取（古本，默认）' },
			{ value: 'single', label: '每支阴阳取一（实验）' },
		] },
		{ name: 'jiGongMode', label: '五寄中宫', type: 'select', default: 'manualSanYuan', group: '起卦分歧', options: [
			{ value: 'manualSanYuan', label: '三元表（默认）' },
			{ value: 'legacy', label: '旧法（上下元性别）' },
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
		{ name: 'huangdiOffset', label: '纪年基准（黄帝纪元差）', type: 'number', default: 2697, group: '断验' },
	] },
	yizhangjing: { kind: 'record', fields: [
		...TIME_FIELDS,
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
		{ name: 'xiaoxianStart', label: '小限起宫', type: 'select', default: 'ri', group: '推运分歧', options: [
			{ value: 'ri', label: '日柱宫（默认）' },
			{ value: 'yue', label: '月柱宫' },
		] },
		{ name: 'flowShenSet', label: '流年十二神', type: 'select', default: 'A', group: '推运分歧', options: [
			{ value: 'A', label: '甲组·太阳系（默认）' },
			{ value: 'B', label: '乙组·六合系' },
			{ value: 'C', label: '丙组·岁破系' },
		] },
		{ name: 'chongfanKou', label: '重犯口诀', type: 'select', default: 'alpha', group: '断语分歧', options: [
			{ value: 'alpha', label: '常见组（默认）' },
			{ value: 'beta', label: '异传组' },
		] },
		{ name: 'shenshaLayer', label: '神煞合参层', type: 'switch', options: ON_OFF, default: 0, group: '合参层', normalize: (v)=>(v === true || v === 1 || v === '1') },
	] },

	// ---- B 类：事盘 options 驱动 ----
	qimen: { kind: 'payload', optionsPath: 'options', fields: QIMEN_FIELDS },
	taiyi: { kind: 'payload', optionsPath: 'options', fields: TAIYI_FIELDS },
	liureng: { kind: 'payload', optionsPath: '', fields: LIURENG_FIELDS },
	jinkou: { kind: 'payload', optionsPath: '', fields: JINKOU_FIELDS },
	sanshiunited: { kind: 'payload', optionsPath: 'options', fields: SANSHI_UNITED_FIELDS },
	horary: { kind: 'payload', optionsPath: '', fields: HORARY_FIELDS },
	election: { kind: 'payload', optionsPath: '', fields: ELECTION_FIELDS },

	// ---- C 类：builder 自读 localStorage ----
	guolao: { kind: 'localStorage', fields: GUOLAO_FIELDS },

	// ---- D 类 / 无重算：只暴露内容勾选 ----
	germany: { kind: 'record', fields: GERMANY_FIELDS },
	sixyao: { kind: 'sectionsOnly', reason: '六爻为摇钱/报数起卦的确定性结果，仅可调纳入内容、不可改卦象。' },
	tongshefa: { kind: 'sectionsOnly', reason: '统摄法基于已起卦象的确定性结果，仅可调纳入内容、不可重算。' },
	mundane: { kind: 'sectionsOnly', reason: '世俗盘类型多样、按事件时刻确定，仅可调纳入内容、不按时间重算。' },
	auxchart: { kind: 'sectionsOnly', reason: '辅盘(十三/十二分、重置、调波、龙盘等)由本命盘衍生，报告复用本命快照按辅盘视角解读，仅可勾选纳入内容、不另起盘重算。' },
	// 报数/揲蓍 等确定性起卦术（均已在 CASE_TYPE_OPTIONS 可存为事盘 + saveModuleAISnapshot 存模块快照）：
	// 此前可存事盘却挂不上，补登记 sectionsOnly（挂载走缓存、不重算），与 sixyao/tongshefa/mundane 同范式。
	// 注：otherbu(骰子,随机)/fengshui(风水)/jieqi(节气盘) 暂不在 CASE_TYPE_OPTIONS（无事盘存储），不在此补挂载——见 windows/AGENTS 交接。
	// 起课时间挂载补全后,4 个数算技法 builder 收 opts → 可按用户挂载设置真重算:
	// taixuan/jingjue: seed 覆盖时间派生; wuzhao: mode/number/manual; shenyishu: hourSource/manualHour/seasonSource/manualSeason。
	// 默认值与各 Main.js state.* 同 → 不改时与现状字节级一致(守「默认即现状」)。
	wuzhao: { kind: 'payload', optionsPath: '', fields: WUZHAO_FIELDS },
	taixuan: { kind: 'payload', optionsPath: '', fields: TAIXUAN_FIELDS },
	jingjue: { kind: 'payload', optionsPath: '', fields: JINGJUE_FIELDS },
	shenyishu: { kind: 'payload', optionsPath: '', fields: SHENYISHU_FIELDS },
	// 天文地占:所问之事 + 起卦种子确定起盘,事盘按 payload.snapshot 出正文不重算;仅勾选纳入内容,不按挂载覆盖。
	geomancy: { kind: 'sectionsOnly', reason: '天文地占按所问之事 + 起卦种子确定起盘(事盘读已存结果)，仅可勾选纳入内容、不按挂载覆盖重算。' },
	tarot: { kind: 'sectionsOnly', reason: '塔罗按所问之事 + 洗牌种子确定抽牌(事盘读已存牌阵)，仅可勾选纳入内容、不按挂载覆盖重算。' },
};

// 星运系里「参数固定 = 现状」的纯推运技法：无可调重算项，但仍登记（显式 emptySchema）让自检无遗漏、UI 显示「仅内容勾选」。
// 批3 已为 zodialrelease/decennials/planetaryarc/persiandirected/vedicprog/jaynesprog/profection/solararc/
//   solarreturn/lunarreturn/givenyear 配了真 fields（上方显式登记），故从空集移除。
const PROGRESSION_EMPTY_KEYS = [
	'firdaria', 'distributions', 'agepoint', 'planetaryages',
	'lunationphase', 'extrareturns', 'yearsystem129',
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

// 数组型 field 的归一化：排序后 join（顺序无关），空数组 → ''（与默认空数组等价，剪掉）。
function normalizeArrayForCompare(v){
	if(!Array.isArray(v)){
		return v;
	}
	return [...v].map((x)=>`${x}`).sort().join(',');
}

// 把一份「可能含默认值」的 options 收敛为「只保留与默认不同的项」（默认即现状：空对象 = 不覆盖）。
export function pruneOptionsToNonDefault(key, options){
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
		if(typeof field.normalize === 'function'){
			v = field.normalize(v);
		}
		let def = field.default;
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
			const pruned = pruneOptionsToNonDefault(k, techniques[k]);
			if(pruned && Object.keys(pruned).length){
				cleaned[k] = pruned;
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

// 保存某技法的「同类默认」。传空对象/全默认 → 删除该键（回归现状）。
export function saveMountTechniqueDefaults(key, options){
	const all = loadMountTechniqueDefaults();
	const k = `${key || ''}`;
	const pruned = pruneOptionsToNonDefault(k, options || {});
	if(pruned && Object.keys(pruned).length){
		all.techniques[k] = pruned;
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

export function mergeOptionsIntoRecord(record, key, options){
	const base = record && typeof record === 'object' ? { ...record } : {};
	const pruned = pruneOptionsToNonDefault(key, options);
	Object.keys(pruned).forEach((name)=>{
		base[name] = pruned[name];
	});
	return base;
}

export function mergeOptionsIntoPayload(payload, key, options){
	const schema = getTechniqueSettingsSchema(key);
	const base = payload && typeof payload === 'object' ? { ...payload } : {};
	const pruned = pruneOptionsToNonDefault(key, options);
	if(!schema || schema.kind !== 'payload' || !Object.keys(pruned).length){
		return base;
	}
	const path = schema.optionsPath;
	if(path === 'options'){
		base.options = { ...(base.options && typeof base.options === 'object' ? base.options : {}), ...pruned };
	}else{
		// 顶层铺平（liureng/jinkou/horary/election）。
		Object.keys(pruned).forEach((name)=>{
			base[name] = pruned[name];
		});
	}
	return base;
}

// C 类：把用户选项写进全局 localStorage（builder 自读）。仅写有 storageKey 的 field 且与默认不同的项。
export function applyLocalStorageSettings(key, options){
	const schema = getTechniqueSettingsSchema(key);
	if(!schema || schema.kind !== 'localStorage' || typeof window === 'undefined' || !window.localStorage){
		return;
	}
	const pruned = pruneOptionsToNonDefault(key, options);
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
