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
import { classicalGlobalValue } from './classicalChartGlobals';
import { EGYPT_SCHOOL_AXES, EGYPT_SCHOOL_DEFAULT } from '../divination/data/egyptianSchools';
import { safeLocalStorageSet } from '../utils/safeStorage';
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
// 卜卦判读参数 22 键 / 择日流派口径 13 键(叶子单源;齿轮 hp_/ep_ 扁平键,regenerate 解码)。
import { HORARY_PARAM_SPEC } from '../divination/horary/horarySchools';
import { ELECTION_PARAM_SPEC } from '../divination/election/electionParams';
// 六爻判读设置(叶子数据:流派预设/占测事项/神煞表)。
import { LIUYAO_SCHOOL_OPTIONS } from '../components/gua/liuyaoSchools';
import { YONGSHEN_CATEGORIES } from '../components/gua/liuyaoYongShen';
import { SHENSHA_META, DEFAULT_SHENSHA_SET } from '../components/gua/liuyaoShenSha';
// 通书用事全表 + 六十甲子(叶子数据)。
import { TONGSHU_TERMS, TONGSHU_TERM_CATEGORIES } from '../components/calendar/tongshuData';
import { GANZHI_60 } from '../components/fengshui/fengshuiData';
// 择日手术部位(黄道 12 座 → 身体部位;叶子数据)。
import { SIGNS, SIGN_ORDER } from '../divination/data/signs';
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
	BRIGHTNESS_SOURCE_OPTIONS as ZW_BRIGHTNESS_SOURCE_OPTIONS,
	LIFE_MASTER_BY_OPTIONS as ZW_LIFE_MASTER_BY_OPTIONS,
	LIU_YUE_BASIS_OPTIONS as ZW_LIU_YUE_BASIS_OPTIONS, LIUNIAN_SIHUA_GAN_OPTIONS as ZW_LIUNIAN_SIHUA_GAN_OPTIONS, CHANGSHENG_START_OPTIONS as ZW_CHANGSHENG_START_OPTIONS, CHANGSHENG_DIRECTION_OPTIONS as ZW_CHANGSHENG_DIRECTION_OPTIONS, KONGWANG_STYLE_OPTIONS as ZW_KONGWANG_STYLE_OPTIONS, KUIYUE_OPTIONS as ZW_KUIYUE_OPTIONS,
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
// 镜像 HoraryMain.HORARY_CATEGORIES（16 类，value/label 一致;批2 新增 失物/消息 两类）。
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
	{ value: 'marriage', label: '婚姻 · 感情（七宫）' },
	{ value: 'lawsuit', label: '诉讼 · 合伙 · 战争（七宫）' },
	{ value: 'theft', label: '盗窃 · 走失（七宫/转宫）' },
	{ value: 'death', label: '死生 · 遗产（八宫）' },
	{ value: 'travel', label: '旅行 · 远行 · 学问（九宫）' },
	{ value: 'career', label: '职位 · 事业（十宫）' },
	{ value: 'hope', label: '愿望 · 朋友（十一宫）' },
	{ value: 'enemy', label: '私敌 · 囚禁（十二宫）' },
];
// 镜像 ElectionMain.ELECTION_TOPICS（25 类，value/label 一致）。
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
const QIMEN_FIELDS = [
	{ name: 'paiPanType', label: '排盘体例', type: 'select', default: 3, group: '排盘', options: QIMEN_PAIPAN_OPTIONS },
	{ name: 'qijuMethod', label: '起局法', type: 'select', default: 'zhirun', group: '排盘', options: QIMEN_QIJU_METHOD_OPTIONS },
	{ name: 'school', label: '盘式', type: 'select', default: '转盘', group: '排盘', options: QIMEN_SCHOOL_OPTIONS },
	{ name: 'shuziReportNumber', label: '报数（阴盘）', type: 'text', default: '', group: '排盘' },
	{ name: 'zhirunLeapDays', label: '置闰天数（传本）', type: 'select', default: 9, group: '排盘', options: QIMEN_ZHIRUN_LEAP_OPTIONS },
	// jieQiType 已删:页面无控件(live 硬钉 1)、引擎内唯一消费是标签、标签不进快照 → 三重死项。
	{ name: 'zhiShiType', label: '值使取法', type: 'select', default: 0, group: '排盘', options: QIMEN_ZHISHI_OPTIONS },
	{ name: 'yueJiaQiJuType', label: '月家起局', type: 'select', default: 0, group: '排盘', options: QIMEN_YUEJIA_QIJU_OPTIONS },
	{ name: 'kongMode', label: '空亡基准', type: 'select', default: 'day', group: '排盘', options: QIMEN_KONG_MODE_OPTIONS },
	{ name: 'yimaMode', label: '驿马基准', type: 'select', default: 'day', group: '排盘', options: QIMEN_MA_MODE_OPTIONS },
	// 盘类(命局/事局):快照「盘类：」行 + 法奇门用神取向消费;性别:快照「命式：」行(曾缺 → 起课源输出 undefined)。
	{ name: 'chartCategory', label: '盘类', type: 'select', default: 'shi', group: '排盘', options: QIMEN_CHART_CATEGORY_OPTIONS },
	{ name: 'sex', label: '命式性别', type: 'select', default: 1, group: '排盘', options: QIMEN_SEX_OPTIONS },
	// [H-A] 移星域修正:引擎域 0-7 八档(YIXING_OPTIONS),此前 switch 只暴露 0/1=顺转2~7宫六档在挂载侧丢失。
	{ name: 'shiftPalace', label: '移星（顺转N宫）', type: 'select', default: 0, group: '排盘', options: QIMEN_YIXING_OPTIONS },
	// fengJu 引擎默认为布尔 false → 用布尔语义,normalize 到 true/false（与 DEFAULT_OPTIONS 字节一致）。
	{ name: 'fengJu', label: '法奇门叠加层', type: 'switch', options: ON_OFF, default: false, group: '排盘', normalize: (v)=>(v === true || v === 1 || v === '1') },
	// [H-B] 八神取神/暗干族
	{ name: 'godsPreset', label: '八神取神', type: 'select', default: 'baihu_xuanwu', group: '排盘', options: QIMEN_GODS_PRESET_OPTIONS },
	{ name: 'anGanMode', label: '暗干', type: 'select', default: 'off', group: '排盘', options: QIMEN_ANGAN_MODE_OPTIONS },
	{ name: 'jiGongMode', label: '中宫寄宫', type: 'select', default: 'kun', group: '排盘', options: QIMEN_JIGONG_MODE_OPTIONS },
	{ name: 'feiXingShun', label: '九星飞法(飞盘)', type: 'select', default: 0, group: '排盘', options: [{ value: 0, label: '阳顺阴逆(默认)' }, { value: 1, label: '两遁皆顺飞' }] },
	{ name: 'feiMenShun', label: '九门飞法(飞盘)', type: 'select', default: 0, group: '排盘', options: [{ value: 0, label: '阳顺阴逆(默认)' }, { value: 1, label: '两遁皆顺飞' }] },
	{ name: 'feiShenShun', label: '九神飞法(飞盘)', type: 'select', default: 0, group: '排盘', options: [{ value: 0, label: '阳顺阴逆(默认)' }, { value: 1, label: '两遁皆顺飞' }] },
	{ name: 'feiMenZhongCan', label: '中门飞宫(飞盘)', type: 'select', default: 1, group: '排盘', options: [{ value: 1, label: '参与(默认)' }, { value: 0, label: '不参与(跳中)' }] },
	{ name: 'feiMenZhongShow', label: '中宫门位显示', type: 'select', default: 0, group: '排盘', options: [{ value: 0, label: '留空(默认)' }, { value: 1, label: '标「中」字样' }] },
	{ name: 'mixTian', label: '混合·天盘层', type: 'select', default: '', group: '排盘', options: [{ value: '', label: '默认(转宫)' }, { value: 'zhuan', label: '转宫' }, { value: 'fei', label: '飞宫' }] },
	{ name: 'mixXing', label: '混合·九星层', type: 'select', default: '', group: '排盘', options: [{ value: '', label: '默认(转宫)' }, { value: 'zhuan', label: '转宫' }, { value: 'fei', label: '飞宫' }] },
	{ name: 'mixMen', label: '混合·八门层', type: 'select', default: '', group: '排盘', options: [{ value: '', label: '默认(飞宫)' }, { value: 'zhuan', label: '转宫' }, { value: 'fei', label: '飞宫' }] },
	{ name: 'mixShen', label: '混合·九神层', type: 'select', default: '', group: '排盘', options: [{ value: '', label: '默认(飞宫)' }, { value: 'zhuan', label: '转宫' }, { value: 'fei', label: '飞宫' }] },
	{ name: 'kongMarkBoth', label: '空亡标注', type: 'select', default: 0, group: '排盘', options: [{ value: 0, label: '单一模式(默认)' }, { value: 1, label: '日空时空并标' }] },
	{ name: 'showAllKong', label: '四柱空亡', type: 'select', default: 0, group: '排盘', options: [{ value: 0, label: '不显示(默认)' }, { value: 1, label: '显示年月日时空' }] },
	{ name: 'shiftZhiFuMode', label: '移星值符', type: 'select', default: 'follow', group: '排盘', options: QIMEN_SHIFT_ZHIFU_OPTIONS },
	{ name: 'yearJiaJu', label: '年家定局', type: 'select', default: 'sanyuan', group: '排盘', options: QIMEN_YEARJIA_JU_OPTIONS },
	{ name: 'dayJiaJu', label: '日家定局', type: 'select', default: 'yiyuan', group: '排盘', options: QIMEN_DAYJIA_JU_OPTIONS },
	{ name: 'keJiaFenDun', label: '刻家分遁', type: 'select', default: 'zihou', group: '排盘', options: QIMEN_KEJIA_FENDUN_OPTIONS },
	{ name: 'keZiZhengHuanShi', label: '刻家子正换时', type: 'select', default: 0, group: '排盘', options: [{ value: 0, label: '子时23点起(默认)' }, { value: 1, label: '子正0点换时' }] },
	{ name: 'jinhanMenPai', label: '金函系八门排法', type: 'select', default: 'book', group: '排盘', options: QIMEN_JINHAN_MENPAI_OPTIONS },
	{ name: 'showAnZhi', label: '暗支(随暗干)', type: 'switch', options: ON_OFF, default: 0, group: '排盘' },
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
	// 流派六轴(计神方向/文昌重留/客算间辰/三基起宫/游神方向/始击坐标):regenerateTaiyiSnapshot 组装
	// school_* → applyTaiyiSchool 起盘后几何重算主客算/神煞 —— 后端已通,曾只差齿轮。默认 default=从盘零回归。
	...['jishen', 'wenchang', 'keJianChen', 'sanji', 'youshen', 'shijiCoord'].map((ax)=>({
		name: 'school_' + ax,
		label: '流派·' + ({ jishen: '计神方向', wenchang: '文昌重留', keJianChen: '客算间辰', sanji: '三基起宫', youshen: '游神方向', shijiCoord: '始击坐标' })[ax],
		type: 'select', default: 'default', group: '流派',
		options: (TAIYI_SCHOOL_OPTIONS[ax] || []).map((o)=>({ value: o.value, label: o.label })),
	})),
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

// 五兆:WuZhaoMain.state 默认 mode='ganzhi' number=0 manual=false manualSplits=DEFAULT_SPLITS。
// 随机起兆法(揲筮/自动掷钱)在挂载场景按时间点重算,每次结果不同即不可复现 →
// builder 会回落干支起例;欲用揲筮请开手动复现、欲用掷钱请关自动掷并填定六掷。
const WUZHAO_FIELDS = [
	{ name: 'mode', label: '起例模式', type: 'select', default: 'ganzhi', group: '起例', options: [
		{ value: 'ganzhi', label: '干支起例(默认,纯时间)' },
		{ value: 'day', label: '日干起盘(折竹)' },
		{ value: 'hour', label: '时干起盘(折竹)' },
		{ value: 'minute', label: '分干起盘(折竹)' },
		{ value: 'tang', label: '唐代正法揲筮' },
		{ value: 'dunhuang', label: '敦煌校录揲筮' },
		{ value: 'qian', label: '以钱代筮' },
		{ value: 'zhushu', label: '直输五兆数' },
	]},
	{ name: 'shifaVariant', label: '筮法口径 (敦煌校录揲筮)', type: 'select', default: 'guayi', group: '起例',
		showWhen: (d)=>(d.mode === 'dunhuang'), options: [
			{ value: 'guayi', label: '挂一回加(0策水·5火·10木·15金·20土)' },
			{ value: 'jiaolu', label: '校录原案(0策土·5水·10火·15木·20金)' },
		]},
	{ name: 'qianAuto', label: '每次起盘重掷 (以钱代筮)', type: 'switch', options: ON_OFF, default: 1, group: '起例',
		showWhen: (d)=>(d.mode === 'qian'), normalize: (v)=>(v === true || v === 1 || v === '1') },
	{ name: 'qianThrows', label: '六掷阳面数 (逗号分隔 0-4,如 1,2,3,3,3,4)', type: 'text', default: '', group: '起例',
		showWhen: (d)=>(d.mode === 'qian'),
		normalize: (v)=>{ if(Array.isArray(v)){ return v.length === 6 ? v.map(Number) : undefined; } const a = `${v == null ? '' : v}`.split(/[,，\s]+/).map((x)=>Number(x)).filter((n)=>!Number.isNaN(n)); return a.length === 6 ? a : undefined; } },
	{ name: 'zhaoNums', label: '五兆卜数 (逗号分隔 1-5,一水二火三木四金五土)', type: 'text', default: '', group: '起例',
		showWhen: (d)=>(d.mode === 'zhushu'),
		normalize: (v)=>{ if(Array.isArray(v)){ return v.length === 6 ? v.map(Number) : undefined; } const a = `${v == null ? '' : v}`.split(/[,，\s]+/).map((x)=>Number(x)).filter((n)=>!Number.isNaN(n)); return a.length === 6 ? a : undefined; } },
	{ name: 'xingshenMonth', label: '行神月制', type: 'select', default: 'lunar', group: '断法', options: [
		{ value: 'lunar', label: '农历月(《要诀略》本法)' },
		{ value: 'jieqi', label: '节气月(月建)' },
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
	// [B6·P2] 页面本身锁 0（左栏无此控件，参考典籍亦无「遁甲法/星占法贵人」之目），故 1/2 只在
	// 挂载快照里生效、与页面所见不一致 —— 标签明示，避免用户以为改了它页面会跟着变。
	// 流派差异请改用「贵人昼夜表」（实务派 / 大六壬古法），那一档页面与快照同步。
	{ name: 'guireng', label: '贵神体系', type: 'select', default: 0, group: '取神', options: [
		{ value: 0, label: '六壬法贵人（默认，与页面一致）' },
		{ value: 2, label: '星占法贵人（仅快照，页面不变）' },
		{ value: 1, label: '遁甲法贵人（仅快照，页面不变）' },
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
		{ value: 'yin', label: '阴盘·旺衰（六亲六神打分）' },
	] },
	// [B6·P2] 土之十二长生两派：默认「水土同宫」(申)＝现状；「火土同宫」(寅) 为少数派。
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
	{ name: 'askKey', label: '合占·所问类别', type: 'select', default: '', group: '专题',
		options: [{ value: '', label: '未限定（默认）' }, ...JINKOU_ASK_OPTIONS_M] },
	{ name: 'timeScope', label: '合占·问事时段', type: 'select', default: 'default', group: '专题',
		options: JINKOU_TIME_OPTIONS_M },
	{ name: 'shiJianKind', label: '测年月日', type: 'select', default: '', group: '专题', options: [
		{ value: '', label: '不用（默认）' },
		{ value: 'year', label: '测一年' },
		{ value: 'month', label: '测一月' },
		{ value: 'day', label: '测一日' },
	] },
	// 本命属相 / 行年虚岁不入 schema：二者由「问测人出生时间」单一真值源派生（页面与还原路径同律），
	// 放成可手填就会出现「设置里填兔、出生档是龙」谁说了算的分叉，故只读不设。
	// 注：timeBasis(直接时间/真太阳时)只在后端 fetchJinKouPan 重算四柱时生效；本无头快照走本地 buildJinKouData
	// （从已定四柱的 liureng 起盘，不重算时间），timeBasis 改不动输出 → 按铁律「不放无效选项」不入 schema（降级,见回报）。
];

// 六爻:卦与动爻取自已存起卦结果(payload.gua),恒不重起 —— 以下全为判读口径,经
// payload.liuyaoSettings(optionsPath)→ mergeLiuyaoGearSettings 与存档 gua.liuyaoSettings 合并后
// buildGuaSnapshotText 重算判读层(analyzeLiuyao 前两参恒取冻结卦,数学上不可能改卦象)。
// 默认 = DEFAULT_LIUYAO_SETTINGS 等价值 → prune 全剪 = 现状零回归。
// 不登五键:coinFace(起卦输入)/writeDir(装卦表行序)/biangua(中栏页签)/changshengUse/changshengYinYang(纯中右栏显示,不入快照)。
const LY_BOOL = (v)=>(v === true || v === 1 || v === '1');
const SIXYAO_FIELDS = [
	{ name: 'school', label: '流派(标注;细项请逐项调)', type: 'select', default: 'default', group: '流派与用神',
		options: LIUYAO_SCHOOL_OPTIONS.map((o)=>({ value: o.value, label: o.label })) },
	{ name: 'askType', label: '占测事项(用神取用)', type: 'select', default: 'self', group: '流派与用神',
		options: YONGSHEN_CATEGORIES.map((c)=>({ value: c.key, label: c.label })) },
	{ name: 'yongOverride', label: '用神(手选)', type: 'select', default: '', group: '流派与用神',
		options: [{ value: '', label: '自动(跟占测事项)' }, ...['父母', '兄弟', '子孙', '妻财', '官鬼', '世', '应'].map((k)=>({ value: k, label: k }))] },
	{ name: 'benming', label: '占者本命(年支)', type: 'select', default: '', group: '流派与用神',
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
	{ name: 'jinTuiTu', label: '进退神土路', type: 'select', default: 'chain', group: '取法', options: [
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
	{ name: 'doctrine', label: '断诀命中/占类断语', type: 'switch', options: ON_OFF, default: true, group: '显示项', normalize: LY_BOOL },
	{ name: 'gufa', label: '古法进阶组', type: 'switch', options: ON_OFF, default: false, group: '显示项', normalize: LY_BOOL },
	{ name: 'yueLiushen', label: '月建六神', type: 'switch', options: ON_OFF, default: false, group: '显示项', normalize: LY_BOOL },
	{ name: 'guirenFa', label: '贵人歌诀', type: 'select', default: 'standard', group: '神煞', options: [
		{ value: 'standard', label: '甲戊庚牛羊(庚丑未)' }, { value: 'geng_ma_hu', label: '庚辛逢马虎(庚寅午)' }] },
	{ name: 'shenshaOn', label: '基础神煞', type: 'switch', options: ON_OFF, default: true, group: '神煞', normalize: LY_BOOL },
	{ name: 'shenshaBase', label: '神煞基准', type: 'select', default: 'day', group: '神煞',
		showWhen: (d)=>LY_BOOL(d.shenshaOn === undefined ? true : d.shenshaOn),
		options: [{ value: 'day', label: '日干支（默认）' }, { value: 'year', label: '年干支' }] },
	{ name: 'shenshaSet', label: '基础神煞集', type: 'multiselect', default: DEFAULT_SHENSHA_SET.slice(), group: '神煞',
		showWhen: (d)=>LY_BOOL(d.shenshaOn === undefined ? true : d.shenshaOn),
		options: SHENSHA_META.map((m)=>({ value: m.name, label: m.name })) },
	// 扩展神煞只暴露总开关:set=null 语义为「启用即全选」,逐项清单留页面弹窗(内容型多选不进齿轮)。
	{ name: 'shenshaExOn', label: '扩展神煞(断易天机)', type: 'switch', options: ON_OFF, default: false, group: '神煞', normalize: LY_BOOL },
];

// 卜卦盘 / 择日盘：类别 topicId。regenerate 透传 options.topicId（缺省=现状）。
// 复用各自主页面权威常量（HORARY_CATEGORIES 14 类 / ELECTION_TOPICS 25 类），杜绝手写错值——
// 原 schema 仅列 8/6 类且含不存在的假值（horary 'lost' 实为 'theft'；election 'construction/medical' 实为 'renovation/surgery'）。
// 判读参数(卜卦专属 22 键,HORARY_PARAM_SPEC scope='horary' 单源):齿轮扁平键 hp_<key>,
// 默认 '' = 随流派(prune 剪掉,四层优先级回落流派/全局/内建 = 现状);switch 型以 1/0 显式覆盖。
// regenerateHorarySnapshot 解码 hp_* → horaryJudgeOpts 第二参(与页面「判读参数」面板同层级)。
const HORARY_JUDGE_FIELDS = HORARY_PARAM_SPEC
	.filter((sp)=>sp.scope === 'horary')
	.map((sp)=>({
		name: 'hp_' + sp.key,
		label: `判读·${sp.label}`,
		type: 'select',
		default: '',
		group: `判读参数·${sp.group || '其他'}`,
		options: sp.type === 'switch'
			? [{ value: '', label: '随流派（默认）' }, { value: 1, label: '开' }, { value: 0, label: '关' }]
			: [{ value: '', label: '随流派（默认）' }, ...((sp.options || []).map((o)=>({ value: o.value, label: o.label })))],
	}));
const HORARY_FIELDS = [
	{ name: 'topicId', label: '问卜类别', type: 'select', default: 'general', group: '裁决', options: HORARY_CATEGORIES },
	// 卜卦流派(horarySchools 七档;默认经典主流=页面默认口径)。储存记录另经 payload.extra.horarySchool 自动还原。
	// 批4 扩档:文艺复兴(1647 基线)/序列判读(无-orb)——与 UI 档同键同名,reportSchools.horary 同步七档。
	{ name: 'horarySchool', label: '判读流派', type: 'select', default: 'classical', group: '裁决', options: [
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
	group: `流派口径·${sp.group || '其他'}`,
	options: [{ value: '', label: '随流派（默认）' }, ...((sp.options || []).map((o)=>({ value: o.value, label: o.label })))],
}));
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
	...ELECTION_PARAM_FIELDS,
	// 事类专项(regenerate pick() 顶层优先已接;默认 '' = 不指定 = 现状):
	{ name: 'tradeSide', label: '买卖方向(交易类)', type: 'select', default: '', group: '事类专项', options: [
		{ value: '', label: '不指定（通用判据）' },
		{ value: 'sell', label: '售出——强己方（1宫主）' },
		{ value: 'buy', label: '购入——强货主方（7宫主）' },
	] },
	{ name: 'talismanStar', label: '护符主星(护符类)', type: 'select', default: '', group: '事类专项', options: [
		{ value: '', label: '不指定（默认）' },
		...['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'].map((k)=>({ value: k, label: ({ sun: '太阳', moon: '月亮', mercury: '水星', venus: '金星', mars: '火星', jupiter: '木星', saturn: '土星' })[k] })),
	] },
	{ name: 'surgeryPart', label: '手术部位(手术类)', type: 'select', default: '', group: '事类专项', options: [
		{ value: '', label: '不指定（默认）' },
		...SIGN_ORDER.map((sg)=>({ value: sg, label: `${SIGNS[sg].cn} · ${(SIGNS[sg].body_parts || []).join('/')}` })),
	] },
	{ name: 'surgeryPartOpposite', label: '部位禁忌延及对宫', type: 'switch', options: ON_OFF, default: 0, group: '事类专项',
		normalize: (v)=>(v === true || v === 1 || v === '1'), showWhen: (d)=>!!d.surgeryPart },
	// crisisBase(危象日基准)= 病始日期排盘派生对象(需取盘),属逐案数据非口径 → 不入齿轮,随存档 extra 回放。
];

// 命盘星盘系（占星本命/十三分盘/宿占等跟随 fields）：把更多排盘选项从 record 读出。
// 默认全部 === buildFieldObject 现状（hsys 1=Alcabitius / zodiacal 0 / 各择宫开关 0 / doubingSu28 0 / timeAlg 0）。
// 界系(bounds/terms)：0 埃及(默认,与现状一致)/1 托勒密·校勘本(Tetrabiblos 批判本)/2 托勒密·经典传本(1647 印本)。
// 三套表后端 flatlib 内已有；变体标签 2026-07-23 正名(数字键与表内容零改动,勿动存档契约)。
const BOUNDS_SYSTEM_OPTIONS = [
	{ value: 0, label: '埃及界（默认）' },
	{ value: 1, label: '托勒密界·校勘本（Tetrabiblos）' },
	{ value: 2, label: '托勒密界·经典传本' },
	{ value: 3, label: '迦勒底界（推演慎用）' },
	{ value: 4, label: '自定义界表（星盘设置编辑）' },
];
// 占星(希腊化)G12/G13/G20-P2 挂载可配项选项。
const WEST_NODE_OPTIONS_M = [
	{ value: 'mean', label: '平交点（默认）' },
	{ value: 'true', label: '真交点' },
];
const SECT_BUFFER_OPTIONS_M = [
	{ value: 'geo', label: '几何地平（默认）' },
	{ value: 'ptolemy5', label: 'Ptolemy 5°缓冲' },
	{ value: 'apparent', label: '视地平（含折射）' },   // [R5-P2] WP-2 第三档:spec/抽屉/后端三方早有,齿轮漏档=回显异常且不能逐盘钉
];
const TRIPLICITY_OPTIONS_M = [
	{ value: 'Dorothean', label: '多罗特三主（默认）' },
	{ value: 'Ptolemaic', label: '托勒密二主' },
	{ value: 'PtolemaicWaterVariant', label: '托勒密·水象变体' },
];

const ASTRO_CHART_FIELDS = [
	// [V6-W1] 🔴 default 锚对:此前写 0(整宫制),而全站真实默认=DefaultHouseSystem=1(Alcabitus,
	// models/astro.js:25;存盘 record 恒带 1)——「默认即现状」在此键上被违反,整宫制成为不可表达值
	// (用户实锤)。有盘场景由 prune baseline(盘现状锚)治;此 default 只剩无盘场景(配置包模板)语义,
	// 锚 1=真实默认 → 配置包选整宫制(0≠1)可表达、选 Alcabitus(=1)=不覆盖(应用到盘时随盘现状)。
	{ name: 'hsys', label: '宫制', type: 'select', options: HSYS_OPTIONS, default: 1, group: '排盘' },
	{ name: 'zodiacal', label: '黄道', type: 'select', options: ZODIACAL_OPTIONS, default: 0, group: '排盘' },
	// 恒星黄道时的具体 ayanāṃśa（与命盘页同一套 47 制，复用印占 INDIA_AYANAMSA_OPTIONS——西洋 siderealAyanamsa 键即此）。
	// 默认 ''=随盘/后端默认(Lahiri)；prune-empty → 不覆盖存盘 ayanāṃśa（守「默认即现状」）。仅「黄道=恒星」时后端生效。
	{ name: 'siderealAyanamsa', label: '岁差制（黄道=恒星时生效）', type: 'select', options: [{ value: '', label: '默认（随盘 / Lahiri）' }, ...AstroConst.INDIA_AYANAMSA_OPTIONS, { value: 'user', label: '自定义（历元槽位）' }], default: '', group: '排盘' },   // [R5-P3] user 档:抽屉/左栏/后端三方早有,齿轮漏档
	{ name: 'doubingSu28', label: '斗柄二十八宿', type: 'switch', options: ON_OFF, default: 0, group: '排盘' },
	{ name: 'tradition', label: '传统择宫（界/外观）', type: 'switch', options: ON_OFF, default: 0, group: '择宫' },
	// 界系（bounds）：选哪套界主表（埃及/托勒密/莉莉），影响星体「界」尊贵与界主。默认埃及=现状，prune 丢弃零回归。
	// [WP-1 契约实抓] 补 globalCurrent:此前缺失 → 改过全局界系的用户,A 类 baseline 退化裸 schema
	// 默认(0),挂载与页面(种子=全局值)分叉——与 aiAnalysisContext buildFieldObject 病史同病。
	{ name: 'termsVariant', label: '界系（bounds）', type: 'select', options: BOUNDS_SYSTEM_OPTIONS, default: 0, globalCurrent: ()=>classicalGlobalValue('termsVariant'), group: '择宫' },
	// 占星(希腊化)G12/G13/G15/G20-P2:月交点真平 / 区分缓冲 / 狮子土星优先 / 三分集 / 福点反转。
	// 默认=现状零回归(平/几何/关/Dorothean/反转ON),prune 丢弃默认值 → 不调任何项与现状逐字一致;
	// 调整后经 buildFieldObject→fieldsToParams→/chart 复算,AI 快照尊贵/界主/福点与所选口径一致。
	{ name: 'westNodeType', label: '月交点（真/平）', type: 'select', options: WEST_NODE_OPTIONS_M, default: 'mean', globalCurrent: ()=>classicalGlobalValue('westNodeType'), group: '择宫' },
	{ name: 'sectBuffer', label: '区分判定（昼/夜）', type: 'select', options: SECT_BUFFER_OPTIONS_M, default: 'geo', globalCurrent: ()=>classicalGlobalValue('sectBuffer'), group: '择宫' },
	{ name: 'leoBoundFirst', label: '托勒密界·狮子土星优先', type: 'switch', options: ON_OFF, default: 0, globalCurrent: ()=>classicalGlobalValue('leoBoundFirst'), group: '择宫' },
	{ name: 'triplicity', label: '三分集', type: 'select', options: TRIPLICITY_OPTIONS_M, default: 'Dorothean', globalCurrent: ()=>classicalGlobalValue('triplicity'), group: '择宫' },
	{ name: 'lotReversal', label: '福点按昼夜反转', type: 'switch', options: ON_OFF, default: 1, globalCurrent: ()=>classicalGlobalValue('lotReversal'), group: '择宫' },
	// 点公式文档序反转(0/1):链早已全通(buildFieldObject+fieldParams 条件透传),只差齿轮项。
	// [对标战役 0c] 三开关升正仓(classicalChartGlobals)后补 globalCurrent——改过全局的用户
	// baseline 才不退化成裸 schema 默认(挂载与页面分叉病史,aiAnalysisContext:508 注释)。
	{ name: 'lotsDocReverse', label: '点公式·文档序反转', type: 'switch', options: ON_OFF, default: 0, globalCurrent: ()=>classicalGlobalValue('lotsDocReverse'), group: '择宫' },
	{ name: 'nodeExaltation', label: '交点入旺（北交双子·南交射手）', type: 'switch', options: ON_OFF, default: 0, globalCurrent: ()=>classicalGlobalValue('nodeExaltation'), group: '择宫' },
	// 双子界序(仅托勒密经典传本 termsVariant=2 生效;1647 印本两皆有据):曾是死透传(fieldParams 读、字段不存在)。
	// [WP-1 契约实抓] 补 globalCurrent(同 termsVariant)。
	{ name: 'geminiBoundEmended', label: '双子界序(经典传本)', type: 'select', default: 0, globalCurrent: ()=>classicalGlobalValue('geminiBoundEmended'), group: '择宫',
		showWhen: (d)=>Number(d.termsVariant) === 2,
		options: [
			{ value: 0, label: '忠原书（♄21–25/♂25–30）' },
			{ value: 1, label: '校勘对调（♂21–25/♄25–30）' },
		] },
	// ── 古典口径 10 键(与「设置→星盘设置」同一后端真值仓 classicalChartGlobals;镜像其面板选项):
	// 默认=后端硬编码现状,prune 剪掉零回归;非默认经 classicalBackendOverridesFromFields 单源下发。──
	{ name: 'houseCuspAdvance', label: '落宫·宫头前移', type: 'select', default: 5, globalCurrent: ()=>classicalGlobalValue('houseCuspAdvance'), group: '古典口径', options: [
		{ value: 5, label: '5°（传统·默认）' }, { value: 3, label: '3°' }, { value: 1, label: '1°' }, { value: 0, label: '0°（纯宫界）' },
	] },
	{ name: 'cazimiOrb', label: '日心 cazimi', type: 'select', default: 17 / 60, globalCurrent: ()=>classicalGlobalValue('cazimiOrb'), group: '古典口径', options: [
		{ value: 17 / 60, label: '17′（1647·默认）' }, { value: 16 / 60, label: '16′（中世纪）' }, { value: 1, label: '1°（早期）' },
	] },
	{ name: 'combustOrb', label: '燃烧上界', type: 'select', default: 8.5, globalCurrent: ()=>classicalGlobalValue('combustOrb'), group: '古典口径', options: [
		{ value: 8.5, label: '8°30′（1647·默认）' }, { value: 8, label: '8°（中世纪）' }, { value: 15, label: '15°（希腊化）' },
	] },
	{ name: 'underBeamsOrb', label: '日光束外界', type: 'select', default: 17, globalCurrent: ()=>classicalGlobalValue('underBeamsOrb'), group: '古典口径', options: [
		{ value: 17, label: '17°（1647·默认）' }, { value: 15, label: '15°（较古）' },
	] },
	{ name: 'vocMode', label: '空亡口径（月亮 isVOC）', type: 'select', default: 'classic', globalCurrent: ()=>classicalGlobalValue('vocMode'), group: '古典口径', options: [
		{ value: 'classic', label: '无入相即空（1647·默认）' }, { value: 'by_orb', label: '容许度 12°30′' },
		{ value: 'by_sign_perfect', label: '本座内须完成（现代）' }, { value: 'by_sign_orb', label: '本座内入容许度（16c）' },
		{ value: 'kenodromia', label: '30° 法（希腊化）' }, { value: 'exempt4', label: '无入相＋四座豁免（中世纪）' },
	] },
	{ name: 'vocIncludeOuter', label: '空亡计三王星（仅非 1647 口径）', type: 'switch', options: ON_OFF, default: 0, globalCurrent: ()=>classicalGlobalValue('vocIncludeOuter'), group: '古典口径',
		showWhen: (d)=>d.vocMode !== undefined && d.vocMode !== 'classic' },
	{ name: 'fixedStarOrbMode', label: '恒星轨档', type: 'select', default: 'school', globalCurrent: ()=>classicalGlobalValue('fixedStarOrbMode'), group: '古典口径', options: [
		{ value: 'school', label: '按流派平轨（默认）' }, { value: 'byMagnitude', label: '按星等' },
	] },
	{ name: 'fixedStarOrb', label: '恒星平轨值', type: 'select', default: 1, globalCurrent: ()=>classicalGlobalValue('fixedStarOrb'), group: '古典口径', options: [1, 1.5, 2, 3, 5].map((v)=>({ value: v, label: `${v}°` })) },
	{ name: 'antisciaOrb', label: '映点接触容许度', type: 'select', default: 1, globalCurrent: ()=>classicalGlobalValue('antisciaOrb'), group: '古典口径', options: [0.5, 1, 1.5, 2, 3].map((v)=>({ value: v, label: `${v}°` })) },
	{ name: 'viaCombustaVariant', label: '燃烧之路边界', type: 'select', default: 'standard', globalCurrent: ()=>classicalGlobalValue('viaCombustaVariant'), group: '古典口径', options: [
		{ value: 'standard', label: '天秤15°–天蝎15°（传统·默认）' }, { value: 'narrow', label: '窄口径（天秤28°–天蝎7°）' },
		{ value: 'scorpioFull', label: '天秤后15°＋天蝎全宫' }, { value: 'bothFull', label: '天秤＋天蝎全段' },
	] },
	// ── [WP-2] 天文口径批(默认=后端现状零回归;eclipseTimeMode 走星历页独立构参不进本齿轮) ──
	{ name: 'combustOwnChariotExempt', label: '界内三分内免燃烧（own chariot）', type: 'switch', options: ON_OFF, default: 0, globalCurrent: ()=>classicalGlobalValue('combustOwnChariotExempt'), group: '古典口径' },
	{ name: 'westLilithType', label: '黑月莉莉丝（真/平远地点）', type: 'select', default: 'mean', globalCurrent: ()=>classicalGlobalValue('westLilithType'), group: '古典口径', options: [
		{ value: 'mean', label: '平均远地点（默认）' }, { value: 'true', label: '真实远地点（osculating）' },
	] },
	{ name: 'topocentricMoon', label: '月亮站心视差修正', type: 'switch', options: ON_OFF, default: 0, globalCurrent: ()=>classicalGlobalValue('topocentricMoon'), group: '古典口径' },
	{ name: 'stationMarking', label: '留驻判定（S·D 标）', type: 'select', default: 'off', globalCurrent: ()=>classicalGlobalValue('stationMarking'), group: '古典口径', options: [
		{ value: 'off', label: '关（默认·仅逆行 R）' }, { value: 'exactWindow', label: '距留点 ≤1 日' },
		{ value: 'distance', label: '距留点黄经 ≤2′' }, { value: 'absSpeed', label: '日速 <1′' }, { value: 'relSpeed', label: '日速 <3% 均速' },
	] },
	// ── [WP-3] 希腊点变体批 ──
	{ name: 'hermeticLotsReversal', label: '七星点按昼夜反转', type: 'switch', options: ON_OFF, default: 1, globalCurrent: ()=>classicalGlobalValue('hermeticLotsReversal'), group: '古典口径' },
	{ name: 'erosConstruction', label: '爱欲·必然构成', type: 'select', default: 'paulus', globalCurrent: ()=>classicalGlobalValue('erosConstruction'), group: '古典口径', options: [
		{ value: 'paulus', label: 'Paulus 式（默认）' }, { value: 'valens', label: 'Valens 式（福点·精神系）' },
	] },
	{ name: 'lotFortuneVariant', label: '福点公式变体', type: 'select', default: 'standard', globalCurrent: ()=>classicalGlobalValue('lotFortuneVariant'), group: '古典口径', options: [
		{ value: 'standard', label: '标准昼夜式（默认）' }, { value: 'moonAboveNight', label: '月在地平上恒夜式' },
	] },
	{ name: 'lotFatherCombustAlt', label: '父点土星伏时替代式', type: 'switch', options: ON_OFF, default: 0, globalCurrent: ()=>classicalGlobalValue('lotFatherCombustAlt'), group: '古典口径' },
	{ name: 'lotProjection', label: '点度计数法', type: 'select', default: 'portion', globalCurrent: ()=>classicalGlobalValue('lotProjection'), group: '古典口径', options: [
		{ value: 'portion', label: '度数投射（默认）' }, { value: 'sign', label: '整星座' },
	] },
	// ── [WP-4] 尊贵与判定批(后端三键;纯全局判读键不进齿轮) ──
	{ name: 'dignityDebilities', label: '弱陷计负分', type: 'switch', options: ON_OFF, default: 1, globalCurrent: ()=>classicalGlobalValue('dignityDebilities'), group: '古典口径' },
	{ name: 'almutenTripMode', label: 'Almuten 三分计分', type: 'select', default: 'all', globalCurrent: ()=>classicalGlobalValue('almutenTripMode'), group: '古典口径', options: [
		{ value: 'all', label: '三主全计（默认）' }, { value: 'sectRulerOnly', label: '仅当值主' },
	] },
	{ name: 'planetaryHourMethod', label: '行星时制式', type: 'select', default: 'sunrise', globalCurrent: ()=>classicalGlobalValue('planetaryHourMethod'), group: '古典口径', options: [
		{ value: 'sunrise', label: '日出起算·等长时（现行）' }, { value: 'unequal', label: '昼夜不等时（传统）' }, { value: 'equal24', label: '廿四时等分' },
	] },
	// ── [WP-5a] 容许度体系批 ──
	{ name: 'orbSystem', label: '容许度判据体系', type: 'select', default: 'perObject', globalCurrent: ()=>classicalGlobalValue('orbSystem'), group: '古典口径', options: [
		{ value: 'perObject', label: '星体轨·任一覆盖（现行）' }, { value: 'byAspect', label: '按相位名' },
		{ value: 'wholeSign', label: '整星座位相' }, { value: 'wholeSignMoiety', label: '整星座内·两轨半距和' },
	] },
	{ name: 'luminaryOrbBonus', label: '发光体·四轴轨加成(%)', type: 'select', default: 0, globalCurrent: ()=>classicalGlobalValue('luminaryOrbBonus'), group: '古典口径', options: [
		{ value: 0, label: '0%（默认）' }, { value: 10, label: '10%' }, { value: 20, label: '20%' }, { value: 30, label: '30%' },
	] },
	{ name: 'aspectIncludeCusps', label: '宫头参与相位', type: 'switch', options: ON_OFF, default: 0, globalCurrent: ()=>classicalGlobalValue('aspectIncludeCusps'), group: '古典口径' },
	{ name: 'aspectIncludeLots', label: '希腊点参与相位', type: 'switch', options: ON_OFF, default: 0, globalCurrent: ()=>classicalGlobalValue('aspectIncludeLots'), group: '古典口径' },
	{ name: 'aspectIncludeMidpoints', label: '中点参与相位(日月四轴)', type: 'switch', options: ON_OFF, default: 0, globalCurrent: ()=>classicalGlobalValue('aspectIncludeMidpoints'), group: '古典口径' },
	{ name: 'solarReturnVariant', label: '太阳返照法', type: 'select', default: 'precise', globalCurrent: ()=>classicalGlobalValue('solarReturnVariant'), group: '古典口径', options: [
		{ value: 'precise', label: '精确回归（默认）' }, { value: 'hellenistic', label: '希腊式（月定上升）' },
	] },
	{ name: 'returnLatitudeMode', label: '返照落宫投影', type: 'select', default: 'ecliptic', globalCurrent: ()=>classicalGlobalValue('returnLatitudeMode'), group: '古典口径', options: [
		{ value: 'ecliptic', label: '黄道度（默认）' }, { value: 'withLatitude', label: '计入黄纬' },
	] },
	{ name: 'vulcanCalc', label: '祝融星（推算行星）', type: 'select', default: 'off', globalCurrent: ()=>classicalGlobalValue('vulcanCalc'), group: '古典口径', options: [
		{ value: 'off', label: '关（默认）' }, { value: 'weston', label: '轨道根数法' }, { value: 'baker', label: '水星系推算' },
	] },
	{ name: 'strongRecption', label: '强互容', type: 'switch', options: ON_OFF, default: 0, group: '择宫' },
	{ name: 'simpleAsp', label: '简化相位', type: 'switch', options: ON_OFF, default: 0, group: '择宫' },
	{ name: 'virtualPointReceiveAsp', label: '虚点接纳相位', type: 'switch', options: ON_OFF, default: 0, group: '择宫' },
	{ name: 'southchart', label: '南半球盘（上下翻转）', type: 'switch', options: ON_OFF, default: 0, group: '排盘' },
	// timeAlg 已删:西洋 /chart 请求不含该键(models/astro fieldsToParams 与 AI fieldParams 皆不发,
	// germany 同因剔除时共用表漏删)→ 可选但无效的死设置,按铁律「不放无效选项」移除。
	// 八字/紫微/数算各自的 timeAlg 走 buildChartBaziParams/buildChartZiweiParams 真实消费,不受影响。
	// 容许度整体缩放(orbScale 0.5–2.5×,默认1):merge 进 record.orbScale → buildFieldObject/fieldParams 透传 /chart
	//（对齐 models/astro.js fieldsToParams:249）→ 改相位容许度。数字型 prune 天然可用,默认 1 → undefined 不下发=现状。
	{ name: 'orbScale', label: '容许度整体缩放(×)', type: 'number', default: 1, min: 0.5, max: 2.5, step: 0.1, group: '容许度' },
	// 逐星自定义容许度(orbs 对象):用「沿用本盘存盘 orbs」布尔开关(默认关=现状,后端用默认容许度);
	// 开 → buildFieldObject 读 record.orbs(存盘的逐星表)下发 /chart。布尔型 prune 安全,规避对象恒判非默认坑。
	{ name: 'useStoredOrbs', label: '沿用本盘自定义容许度', type: 'switch', options: ON_OFF, default: 0, group: '容许度' },
	// ── 埃及历七轴(随盘键 egypt_*):快照链 egyptSchoolFromFields 优先消费;
	// 默认档不下发(localcharts 只捕获非默认轴),挂载改此组=只改【埃及历】段口径 ──
	...EGYPT_SCHOOL_AXES.map((ax) => ({
		name: 'egypt_' + ax.key,
		label: '埃及·' + ax.label,
		type: 'select',
		default: EGYPT_SCHOOL_DEFAULT[ax.key],
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
	// G5/G13:年长与年盘口径进挂载齿轮(默认值经 prune 丢弃 = 现状零回归;改则 AI 快照与盘一致)。
	{ name: 'indiaDashaYearLength', label: '大运年长(日/年)', type: 'select', options: AstroConst.INDIA_DASHA_YEAR_OPTIONS, default: AstroConst.INDIA_DASHA_YEAR_DEFAULT, group: '大运' },
	{ name: 'indiaSchool', label: '流派（五支）', type: 'select', options: AstroConst.INDIA_SCHOOL_OPTIONS, default: AstroConst.INDIA_SCHOOL_DEFAULT, group: '排盘' },
	{ name: 'indiaKarakaScheme', label: 'Chara Kāraka 方案', type: 'select', options: AstroConst.INDIA_KARAKA_SCHEME_OPTIONS, default: AstroConst.INDIA_KARAKA_SCHEME_DEFAULT, group: '起盘' },
	{ name: 'indiaYuddhaCriterion', label: '星曜战判据', type: 'select', options: AstroConst.INDIA_YUDDHA_CRITERION_OPTIONS, default: AstroConst.INDIA_YUDDHA_CRITERION_DEFAULT, group: '起盘' },
	// 分盘流派映射(indiaVargaVariant)不入齿轮(无 text 控件类型且 JSON 手输易错):
	// 记录值经 aiAnalysisContext record→fields 显式透传,挂载/快照仍随盘生效。
	{ name: 'indiaAnnualChartType', label: '年盘口径', type: 'select', options: AstroConst.INDIA_ANNUAL_CHART_TYPE_OPTIONS, default: AstroConst.INDIA_ANNUAL_CHART_TYPE_DEFAULT, group: '行运/年度' },
	// 挂载分盘(2026-07-05 审计补):buildIndiaSnapshotForFields 第二参本就吃 chartnum,挂载分支此前
	// 硬编码 D1 → 用户无法把 D9/D10 等分盘快照挂给 AI。默认 1=D1 现状零回归。
	// (页面另有 indiaSchool 软联动/lagnaRef/盘式/度数显示等纯前端渲染项:不达后端参数,不设死开关。)
	// 分盘网格集(逗号分隔 D 序号,最多 4 个;buildFieldObject/fieldsToParams 已透传):留空=默认网格。
	{ name: 'indiaVargaSet', label: '分盘网格集(如 1,9,10,30;留空=默认)', type: 'text', default: '', group: '排盘',
		normalize: (v)=>{ const t = `${v == null ? '' : v}`.trim(); return t ? t.split(/[,，\s]+/).map((x)=>parseInt(x, 10)).filter((n)=>!Number.isNaN(n)).slice(0, 4).join(',') : ''; } },
	// 年盘(Varsha)异地经纬:留空=本命地(现状)。indiaDashaVariants(21 键流派开关对象)不入齿轮
	// (与 indiaVargaVariant 同理由:对象型无控件、JSON 手输易错),记录值经 record→fields 已全链透传随盘生效。
	{ name: 'indiaVarshaLat', label: '年盘·纬度(空=本命)', type: 'text', default: '', group: '行运/年度' },
	{ name: 'indiaVarshaLon', label: '年盘·经度(空=本命)', type: 'text', default: '', group: '行运/年度' },
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
	// 🔴 pdMethod 是解耦前的单维快捷键(= 弧算法 × 盘面宫制 的命名组合);regen 链仍在消费故保留,
	// 但与下面 pdProjection/pdFrame 语义重叠 —— 后端 _pdResolveProjectionFrame 里显式两维优先,
	// 两处同时设置时 pdMethod 被静默忽略。label 点名这层关系,免得用户改了以为没生效。
	{ name: 'pdMethod', label: '方位法（旧单维·与下方两维同设时以两维为准）', type: 'select', options: PD_METHOD_OPTIONS, default: DEFAULT_PD_METHOD, group: '方位法' },
	{ name: 'pdTimeKey', label: '度数换算', type: 'select', options: PD_TIME_KEY_OPTIONS, default: DEFAULT_PD_TIME_KEY, group: '方位法' },
	{ name: 'pdtype', label: '主限法', type: 'select', default: 0, group: '方位法', options: [
		{ value: 0, label: '主限法（默认）' },
		{ value: 1, label: '世界主限 In Mundo' },
	] },
	{ name: 'pdDirect', label: '顺向（zodiacal）', type: 'switch', options: ON_OFF, default: 1, group: '方向' },
	{ name: 'pdConverse', label: '逆向（converse）', type: 'switch', options: ON_OFF, default: 1, group: '方向' },
	{ name: 'pdAntiscia', label: '映点', type: 'switch', options: ON_OFF, default: 0, group: '方向' },
	{ name: 'pdTerms', label: '界（terms）', type: 'switch', options: ON_OFF, default: 0, group: '方向' },
	// 推算年数:默认 100(对齐 AstroPrimaryDirection.normalizePdYears 兜底),范围 1–3000(>360 走多圈复发行)。
	// merge 进 record.pdYears → buildFieldObject/fieldParams 透传 /chart → Java 转发 → Python max_arc,
	// 改它真实改变方向列表覆盖的年限(round-trip 通)。>180 走 forward/complement 互补弧扩展。
	{ name: 'pdYears', label: '推算年数', type: 'number', default: 100, min: 1, max: 3000, group: '范围' },
	// P0 解耦补齐维(默认=引擎缺省,与 primaryDirectionSync SUPPORTED_* 同源;非默认才下发,零回归):
	{ name: 'pdProjection', label: '弧算法（决定弧与应期日期）', type: 'select', default: 'ptolemy', group: '方位法', options: [
		{ value: 'ptolemy', label: 'Ptolemy（半弧）' }, { value: 'placidus', label: 'Placidus（半弧严密）' },
		{ value: 'regiomontanus', label: 'Regiomontanus' }, { value: 'campanus', label: 'Campanus' },
		{ value: 'topocentric', label: 'Topocentric' }, { value: 'zodiacal', label: '纯黄道（斜升差）' },
		{ value: 'ra_direct', label: '赤经直推' },
	] },
	{ name: 'pdFrame', label: '盘面宫制（只改宫头,不改弧）', type: 'select', default: 'alcabitius', group: '方位法', options: [
		{ value: 'alcabitius', label: 'Alcabitius' }, { value: 'placidus', label: 'Placidus' },
		{ value: 'regiomontanus', label: 'Regiomontanus' }, { value: 'campanus', label: 'Campanus' },
		{ value: 'topocentric', label: 'Topocentric' }, { value: 'meridian', label: 'Meridian' },
		{ value: 'porphyry', label: 'Porphyry' }, { value: 'equal', label: 'Equal（等宫）' },
		{ value: 'wholesign', label: 'Whole Sign（整宫）' }, { value: 'morinus', label: 'Morinus' },
		{ value: 'koch', label: 'Koch' },
	] },
	{ name: 'pdFramework', label: '框架', type: 'select', default: 'aspect', group: '方位法', options: [
		{ value: 'aspect', label: '相位主限' }, { value: 'bounds', label: '界行·分配星' }, { value: 'release', label: '释放（hyleg）' },
	] },
	{ name: 'pdParallel', label: '平行（黄道=赤纬/世界=世界平行）', type: 'switch', options: ON_OFF, default: 0, group: '方向' },
	{ name: 'pdRaptParallel', label: '急动平行（仅世界主限）', type: 'switch', options: ON_OFF, default: 0, group: '方向' },
	// 界系标签与 BOUNDS_SYSTEM_OPTIONS 单源:同一后端键两套标签曾致 value=2 语义相反
	// (此处旧标「莉莉界」,实为托勒密经典传本;且迦勒底 3 在主限法面板选不到)。
	{ name: 'termsVariant', label: '界系', type: 'select', default: 0, group: '方向', options: BOUNDS_SYSTEM_OPTIONS },
	// P2 长尾三键(与工具条「度数Key=自定义 / 扩展 Popover」同域;默认空=零回归):
	// 缺登记 = 用户在表格勾了扩展,AI 分析里重算却按默认无扩展,两侧口径不一致。
	{ name: 'pdTimeKeyCustom', label: '自定义钥匙率（度/年，仅 User 档）', type: 'number', default: 0, min: 0, max: 30, group: '范围' },
	{ name: 'pdSignificators', label: '应星扩展', type: 'multiselect', default: [], group: '扩展', options: [
		{ value: 'Desc', label: '下降 DSC' }, { value: 'IC', label: '天底 IC' },
		{ value: 'Syzygy', label: '产前朔望' }, { value: 'Spirit', label: '精神点' },
		{ value: 'Cusps', label: '中间宫始点' }, { value: 'Stars', label: '恒星（王星+比尼）' },
		{ value: 'Lots', label: '阿拉伯点（全目录）' },
	] },
	{ name: 'pdPromissorTypes', label: '迫星扩展', type: 'multiselect', default: [], group: '扩展', options: [
		{ value: 'cusps', label: '宫始点' }, { value: 'stars', label: '恒星' }, { value: 'lots', label: '阿拉伯点' },
	] },
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
	{ name: 'lifeMode', label: '七政命度', type: 'select', default: 'asc', group: '命度', storageKey: 'horosaGuolaoLifeMode', recordKey: 'guolaoLifeMode', options: [
		{ value: 'asc', label: '占星上升（默认）' },
		{ value: 'yumao', label: '日出安命' },
		{ value: 'gumao', label: '遇卯安命(古法)' },
		{ value: 'cotrans', label: '赤黄转换' },
		...GUOLAO_DIZHI.map((z)=>({ value: z, label: `自定命宫·${z}` })),
	] },
	{ name: 'bodyMode', label: '身宫法', type: 'select', default: 'taiyin', group: '命度', storageKey: 'horosaGuolaoBodyMode', recordKey: 'guolaoBodyMode', options: [
		{ value: 'taiyin', label: '太阴落宫(果老,默认)' },
		{ value: 'youjin', label: '逢酉(琴堂)' },
		...GUOLAO_DIZHI.map((z)=>({ value: z, label: `自定身宫·${z}` })),
	] },
	{ name: 'nodeMode', label: '罗计', type: 'select', default: 'northKetuSouthRahu', group: '命度', storageKey: 'horosaGuolaoNodeMode', recordKey: 'guolaoNodeMode', options: [
		{ value: 'northKetuSouthRahu', label: '北计南罗（默认）' },
		{ value: 'northRahuSouthKetu', label: '北罗南计' },
	] },
	{ name: 'su28Mode', label: '宿度制', type: 'select', default: 2, group: '命度', storageKey: 'horosaGuolaoSu28Mode', recordKey: 'doubingSu28', options: [
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
	// 命主取法/行运法/童限基数:🔴 值逐字打印进快照正文且改 [大限] 段结构,但存储在 horosaGuolaoDisplay
	// JSON 罐(per-key storageKey 机制盖不住)→ 走 record 链(C 类分支已 mergeOptionsIntoRecord,
	// buildFieldObject 透传,GuoLaoChartMain 快照拼装侧 fields 优先);'' = 随全局显示偏好(现状零回归)。
	{ name: 'guolaoLifeMasterMode', label: '命主取法', type: 'select', default: '', group: '命度', options: [
		{ value: '', label: '随全局（默认）' }, { value: 'gong', label: '宫主' }, { value: 'du', label: '度主' }, { value: 'dudegrade', label: '贬宫主专度主' },
	] },
	{ name: 'guolaoMinorLimitType', label: '行运法', type: 'select', default: '', group: '命度', options: [
		{ value: '', label: '随全局（默认=古度限度法）' }, { value: 'minor', label: '小限' }, { value: 'month', label: '月限' },
		{ value: 'tong', label: '童限' }, { value: 'dongwei', label: '洞微大限' },
	] },
	{ name: 'guolaoTongxianBase', label: '童限基数(行运=童限时)', type: 'select', default: '', group: '命度',
		showWhen: (d)=>d.guolaoMinorLimitType === 'tong',
		options: [{ value: '', label: '随全局（默认）' }, { value: 'tong10', label: '通行十年' }, { value: 'gu9', label: '古九岁' }, { value: 'xu11', label: '虚十一' }] },
	// engineMode(horosa/kinastro 引擎切换)不入齿轮:挂载复算恒走 horosa 引擎 buildGuolaoSnapshotForFields,
	// 页面切 kinastro 引擎属页面级渲染源切换(挂载侧无 kinastro 七政快照复算路径),登了即死开关。
	{ name: 'trueSolarTime', label: '报时星太阳时', type: 'select', default: 'true', group: '四余/时间', storageKey: 'horosaGuolaoTrueSolarTime', recordKey: 'guolaoTrueSolarTime', options: [
		{ value: 'true', label: '真太阳时（经度+均时差，默认）' },
		{ value: 'mean', label: '平太阳时（仅经度）' },
		{ value: 'off', label: '钟表时' },
	] },
	{ name: 'nodeType', label: '罗计取法', type: 'select', default: 'mean', group: '四余/时间', storageKey: 'horosaGuolaoNodeType', recordKey: 'guolaoNodeType', options: [
		{ value: 'mean', label: '平交点（默认）' },
		{ value: 'true', label: '真交点' },
	] },
	{ name: 'lilithType', label: '月孛取法', type: 'select', default: 'mean', group: '四余/时间', storageKey: 'horosaGuolaoLilithType', recordKey: 'guolaoLilithType', options: [
		{ value: 'mean', label: '平远地点（默认）' },
		{ value: 'true', label: '真远地点' },
	] },
];

// 量化盘（汉堡）：经 buildGermanySnapshotForFields(buildFieldObject(record)) 真实重算——读 宫制/黄道/时间算法
// （fieldsToParams → /chart + /germany/midpoint，改它们改中点盘/90°盘/中点相位）。故暴露这 3 项（record 类，
// regen 分支已存在于 aiAnalysisContext case 'germany'）。TNP/中点/orb 是内部常量、不入快照，仍不暴露。
// 实测 germany fieldsToParams(AstroMidpoint.js:18) 给 /chart 下发 hsys/zodiacal(+tradition 等)、但**不发 timeAlg**
// → timeAlg 对中点盘 inert，故只暴露 hsys/zodiacal（守"不放无效选项"；原审计 D-❌6「读 timeAlg」有误）。
// filter 面=AstroMidpoint.fieldsToParams 真下发键(hsys/zodiacal/siderealAyanamsa/tradition/强互容/简化相位/虚点);
// 旧注「TNP/中点/orb 是内部常量」已过时:builder 亲读 getStoredUranianDisplay() 的
// school/orb/orbPersonal/strictFactors/showDeclination/frames → /germany/midpoint,故一并入齿轮
// (''=随全局显示设置,prune 剪掉零回归;非空经 case 'germany' 组 dispOverride 覆盖)。
// showDavison/showComposite 依赖 synastryPeople(合盘人名→fieldsAry 查档,内容型)不入齿轮,恒随全局。
const GERMANY_FIELDS = [
	...ASTRO_CHART_FIELDS.filter((f)=>['hsys', 'zodiacal', 'siderealAyanamsa', 'tradition', 'strongRecption', 'simpleAsp', 'virtualPointReceiveAsp'].includes(f.name)),
	{ name: 'school', label: '流派', type: 'select', default: '', group: '量化盘', options: [
		{ value: '', label: '随全局（默认）' },
		{ value: 'classic', label: '原始汉堡' }, { value: 'pure', label: '纯净派' },
		{ value: 'uranian', label: '美国对称' }, { value: 'cosmo', label: '宇宙生物学' },
	] },
	{ name: 'orb', label: '中点容许度(°;空=随全局)', type: 'number', default: '', min: 0.1, max: 5, step: 0.1, group: '量化盘' },
	{ name: 'orbPersonal', label: '个人点容许度(°;空=随全局)', type: 'number', default: '', min: 0.1, max: 5, step: 0.1, group: '量化盘' },
	{ name: 'strictFactors', label: '严格汉堡因子集', type: 'select', default: '', group: '量化盘', options: [
		{ value: '', label: '随全局（默认）' }, { value: 1, label: '开(剔黑月/紫气)' }, { value: 0, label: '关' },
	] },
	{ name: 'showDeclination', label: '赤纬接触', type: 'select', default: '', group: '量化盘', options: [
		{ value: '', label: '随全局（默认）' }, { value: 1, label: '开' }, { value: 0, label: '关' },
	] },
	{ name: 'showHouseFrames', label: '宫位框架', type: 'select', default: '', group: '量化盘', options: [
		{ value: '', label: '随全局（默认）' }, { value: 1, label: '开' }, { value: 0, label: '关' },
	] },
	{ name: 'showEastPoint', label: '东点', type: 'select', default: '', group: '量化盘', options: [
		{ value: '', label: '随全局（默认）' }, { value: 1, label: '开' }, { value: 0, label: '关' },
	] },
];


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
	{ name: 'asporb', label: '容许度(°)', type: 'number', default: 1, min: 0, max: 12, group: '弧源', globalCurrent: ()=>{ try{ return require('../components/astro/AstroExtraCommon').transitOrbDefault(); }catch(e){ return 1; } } },   // [R5-P2] 基线随全局 transitOrb
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
	{ name: 'asporb', label: '容许度(°)', type: 'number', default: 1, min: 0, max: 12, group: '目标', globalCurrent: ()=>{ try{ return require('../components/astro/AstroExtraCommon').transitOrbDefault(); }catch(e){ return 1; } } },   // [R5-P2]
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
// 🔴 太乙子组键名必须对齐三式合一页面存档:页面 state.options 用 taiyiStyle/taiyiAccum/taiyiSchema(对象),
// 而 TAIYI_FIELDS 用 style/tn/school_* —— 且 options.school 已被奇门盘式(字符串)占用、sex 与奇门共键(1/0)。
// 曾原名平铺 → 存过的三式合一事盘太乙盘式/公式/流派挂载重算全落默认(regenerateTaiyiSnapshot 双源读已配套)。
const SANSHI_TAIYI_RENAME = { style: 'taiyiStyle', tn: 'taiyiAccum' };
const reTagSanshiTaiyi = (fields)=>fields
	.filter((f)=>!SANSHI_SHARED_TIME_KEYS.includes(f.name))
	// sex 与奇门共键(1/0 数字域,太乙侧 regenerate 归一为男/女);timeBasis 三式页钉 direct(防与独立太乙分叉)。
	.filter((f)=>f.name !== 'sex' && f.name !== 'timeBasis')
	.map((f)=>{
		const name = SANSHI_TAIYI_RENAME[f.name] || (f.name.indexOf('school_') === 0 ? `taiyiSchool_${f.name.slice(7)}` : f.name);
		return { ...f, name, group: `太乙·${f.group || '设置'}` };
	});
const SANSHI_UNITED_FIELDS = [
	...reTagSanshi(LIURENG_FIELDS, '大六壬'),
	...reTagSanshi(QIMEN_FIELDS, '奇门'),
	...reTagSanshiTaiyi(TAIYI_FIELDS),
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
	// kinastro 族齿轮范式:'' 哨兵=按盘面时间/后端自出(prune 剪掉,payload 不带键=现状零回归);
	// 非空值经 case 分支 optionsOverride 透传,与页面 buildPayload 同键直达 ken 后端(cetian 已验范式)。
	// 家庭/亲属/四柱覆写等「内容/数据」项不入齿轮(faRelatedPeople 同理),仍随页面存档。
	xianqin: { kind: 'record', group: '演禽', fields: [
		// 旧 emptyHint「无独立可调排盘设置」不实:页面有 入式历法/农历锚点 四项且 buildPayload 真下发。
		{ name: 'calendarMode', label: '入式历法', type: 'select', default: '', group: '入式', options: [
			{ value: '', label: '随盘自出（默认）' }, { value: 'autoLunar', label: '自动农历' },
			{ value: 'manualLunar', label: '手动农历' }, { value: 'solarNumeric', label: '公历数值入式' },
		] },
		{ name: 'lunarYear', label: '农历年(空=自出)', type: 'number', default: '', group: '入式' },
		{ name: 'lunarMonth', label: '农历月(空=自出)', type: 'number', default: '', min: 1, max: 12, group: '入式' },
		{ name: 'lunarDay', label: '农历日(空=自出)', type: 'number', default: '', min: 1, max: 30, group: '入式' },
	] },
	// qizhengkin:页面设置走 fetchKinastroQizheng 专用请求(qizhengKin* 键)+localStorage,与挂载
	// postKinAstro 路由的消费面未实证同构 → 按铁律「不放无效选项」暂不登,留待后端消费面证实后接线。
	qizhengkin: { kind: 'record', fields: [], emptyHint: '七政四余（七政）按出生时间起盘;行运/择时设置随技法页右栏,挂载暂仅内容勾选。' },
	shaozi: { kind: 'record', group: '邵子神数', fields: [
		{ name: 'ke', label: '考刻(如 初刻;空=自出)', type: 'text', default: '', group: '考刻' },
		{ name: 'useKey', label: '64 钥匙细调', type: 'select', default: '', group: '考刻', options: [
			{ value: '', label: '随盘（默认）' }, { value: 1, label: '开' }, { value: 0, label: '关' },
		] },
	] },
	tieban: { kind: 'record', group: '铁板神数', fields: [
		{ name: 'method', label: '算法', type: 'select', default: '', group: '起数', options: [
			{ value: '', label: '随盘（默认）' }, { value: 'kunji', label: '坤集取数' }, { value: 'suanpan', label: '算盘法' },
		] },
		{ name: 'startAge', label: '起运年龄(空=自出)', type: 'number', default: '', min: 0, max: 20, group: '起数' },
		{ name: 'dayunSteps', label: '大运步数(空=自出)', type: 'number', default: '', min: 1, max: 12, group: '起数' },
		{ name: 'ke', label: '考刻(如 初刻;空=自出)', type: 'text', default: '', group: '起数' },
		{ name: 'useKey', label: '钥匙细调', type: 'select', default: '', group: '起数', options: [
			{ value: '', label: '随盘（默认）' }, { value: 1, label: '开' }, { value: 0, label: '关' },
		] },
		// [框架推演] 段口径(纯前端 buildTiebanFramework;页面存档带此段而无头曾整段缺失):
		{ name: 'tiebanSchool', label: '框架·流派', type: 'select', default: 'south', group: '框架推演', options: [
			{ value: 'south', label: '南派(岭南/江南)' }, { value: 'north', label: '北派(洛阳/中州)' },
		] },
		{ name: 'tiebanKeSystem', label: '框架·刻制', type: 'select', default: 'qing8', group: '框架推演', options: [
			{ value: 'qing8', label: '清制·八刻(96局)' }, { value: 'ming100', label: '明制·百刻' }, { value: 'dou12', label: '十二刻·斗宫(144局)' },
		] },
		{ name: 'tiebanKe', label: '框架·考刻刻位(1-8)', type: 'number', default: 1, min: 1, max: 12, group: '框架推演' },
	] },
	fendjing: { kind: 'record', group: '鬼谷分定经', fields: [
		{ name: 'stemOverride', label: '两头钳手订干', type: 'select', default: '', group: '两头钳', options: [
			{ value: '', label: '随盘（默认）' }, { value: 1, label: '开' }, { value: 0, label: '关' },
		] },
		{ name: 'yearStem', label: '年干(手订时)', type: 'select', default: '', group: '两头钳',
			showWhen: (d)=>d.stemOverride === 1 || d.stemOverride === '1',
			options: [{ value: '', label: '自出' }, ...['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'].map((g)=>({ value: g, label: g }))] },
		{ name: 'hourStem', label: '时干(手订时)', type: 'select', default: '', group: '两头钳',
			showWhen: (d)=>d.stemOverride === 1 || d.stemOverride === '1',
			options: [{ value: '', label: '自出' }, ...['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'].map((g)=>({ value: g, label: g }))] },
	] },
	beiji: { kind: 'record', group: '北极神数', fields: [
		{ name: 'beijiKeMode', label: '刻法', type: 'select', default: '', group: '取数', options: [
			{ value: '', label: '随盘（默认）' }, { value: 'auto', label: '自动' }, { value: 'manual', label: '手动指定刻' },
		] },
		{ name: 'beijiKe', label: '刻(手动时,如 1)', type: 'text', default: '', group: '取数',
			showWhen: (d)=>d.beijiKeMode === 'manual' },
		{ name: 'beijiLookupCode', label: '条文码(空=不查)', type: 'text', default: '', group: '取数' },
		{ name: 'beijiKeyword', label: '关键词(空=不筛)', type: 'text', default: '', group: '取数' },
	] },
	nanji: { kind: 'record', group: '南极神数', fields: [
		{ name: 'nanjiMode', label: '起盘方式', type: 'select', default: '', group: '起盘', options: [
			{ value: '', label: '随盘（默认）' }, { value: 'solar', label: '公历' }, { value: 'lunar', label: '农历' },
		] },
		{ name: 'nanjiAfterLichun', label: '立春界', type: 'select', default: '', group: '起盘', options: [
			{ value: '', label: '随盘（默认）' }, { value: '1', label: '立春后' }, { value: '0', label: '立春前' },
		] },
		{ name: 'nanjiLunarYear', label: '历年(空=自出)', type: 'number', default: '', group: '起盘' },
		{ name: 'nanjiSolarMonth', label: '节月(空=自出)', type: 'number', default: '', min: 1, max: 12, group: '起盘' },
		{ name: 'nanjiDay', label: '日(空=自出)', type: 'number', default: '', min: 1, max: 31, group: '起盘' },
		{ name: 'nanjiHourZhi', label: '时支(空=自出)', type: 'select', default: '', group: '起盘',
			options: [{ value: '', label: '自出' }, ...DIZHI_12.map((z)=>({ value: z, label: z }))] },
		{ name: 'nanjiDayGan', label: '日干(空=自出)', type: 'select', default: '', group: '起盘',
			options: [{ value: '', label: '自出' }, ...['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'].map((g)=>({ value: g, label: g }))] },
		{ name: 'nanjiDayZhi', label: '日支(空=自出)', type: 'select', default: '', group: '起盘',
			options: [{ value: '', label: '自出' }, ...DIZHI_12.map((z)=>({ value: z, label: z }))] },
		{ name: 'nanjiSection', label: '宫部(如 子部;空=自出)', type: 'text', default: '', group: '推演' },
		{ name: 'nanjiJianchu', label: '建除(空=自出)', type: 'select', default: '', group: '推演',
			options: [{ value: '', label: '自出' }, ...['建','除','满','平','定','执','破','危','成','收','开','闭'].map((j)=>({ value: j, label: j }))] },
		{ name: 'nanjiXiu', label: '二十八宿(如 張;空=自出)', type: 'text', default: '', group: '推演' },
		{ name: 'nanjiPasswordCode', label: '密码(四字;空=自出)', type: 'text', default: '', group: '推演' },
		{ name: 'nanjiChart', label: '星图(空=自出)', type: 'number', default: '', min: 1, group: '推演' },
		{ name: 'nanjiPalace', label: '推演宫(空=自出)', type: 'select', default: '', group: '推演',
			options: [{ value: '', label: '自出' }, ...DIZHI_12.map((z)=>({ value: z, label: z }))] },
		{ name: 'nanjiDegree', label: '宿度(空=自出)', type: 'number', default: '', min: 1, group: '推演' },
	] },
	chunzi: { kind: 'record', group: '蠢子数', fields: [
		{ name: 'chunziKeMode', label: '刻法', type: 'select', default: '', group: '取数', options: [
			{ value: '', label: '随盘（默认）' }, { value: 'auto', label: '自动' }, { value: 'manual', label: '手动指定刻' },
		] },
		{ name: 'chunziKe', label: '刻数(手动时,如 3)', type: 'text', default: '', group: '取数',
			showWhen: (d)=>d.chunziKeMode === 'manual' },
		{ name: 'chunziLunarMode', label: '月日匹配', type: 'select', default: '', group: '取数', options: [
			{ value: '', label: '随盘（默认）' }, { value: 'auto', label: '自动农历' }, { value: 'manual', label: '手动农历' },
		] },
		{ name: 'chunziLunarMonth', label: '农历月(空=自出)', type: 'number', default: '', min: 1, max: 12, group: '取数' },
		{ name: 'chunziLunarDay', label: '农历日(空=自出)', type: 'number', default: '', min: 1, max: 30, group: '取数' },
		{ name: 'chunziMansion', label: '宿名(如 室;空=自出)', type: 'text', default: '', group: '取数' },
		{ name: 'chunziHourBranch', label: '时辰(空=自出)', type: 'select', default: '', group: '取数',
			options: [{ value: '', label: '自出' }, ...DIZHI_12.map((z)=>({ value: z, label: z }))] },
		{ name: 'chunziLookupCode', label: '条文代码(空=不查)', type: 'text', default: '', group: '筛选' },
		{ name: 'chunziKeyword', label: '关键词(空=不筛)', type: 'text', default: '', group: '筛选' },
		{ name: 'chunziTags', label: '多标签(逗号分隔;空=不筛)', type: 'text', default: '', group: '筛选' },
		{ name: 'chunziResultLimit', label: '显示数量(空=默认)', type: 'number', default: '', min: 1, max: 200, group: '筛选' },
	] },
	// 策天飞星：算法(书/原)+原法子选项 + 5 显示开关；全默认=现状(prune 为空，零字节差)。show_* 经 payload 下发后端过滤输出段/行。
	// chartRoute: payload kind 但登记在 ANALYSIS_CHART_TECHNIQUES 走 A 路(历史双例);覆盖与现状
	// 都在 record 平铺键(regenerate case 从 record.* 手抄回塞),基线锚用平铺而非 payload 段。
	cetian: { kind: 'payload', optionsPath: '', chartRoute: true, group: '策天飞星', fields: [
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
		// 书法(移语本)口径与流年——与左栏/buildPayload 三方同键(死开关教训:任一缺位=挂载死齿轮)。
		{ name: 'brightnessSchool', label: '庙旺口径', type: 'select', default: 'yiyu', group: '书法口径', when: { method: 'book' }, options: [
			{ value: 'yiyu', label: '移语本·诸星格' },
			{ value: 'quanji', label: '全集本·诗诀' },
		] },
		{ name: 'shenGongMode', label: '身宫取整', type: 'select', default: 'yizheng', group: '书法口径', when: { method: 'book' }, options: [
			{ value: 'yizheng', label: '引证图口径' },
			{ value: 'literal', label: '正文直读' },
		] },
		{ name: 'daxianMode', label: '大限起宫', type: 'select', default: 'yiyu', group: '书法口径', when: { method: 'book' }, options: [
			{ value: 'yiyu', label: '阳年从命·阴年从身' },
			{ value: 'legacy', label: '顺从命·逆从身(旧)' },
		] },
		{ name: 'tianluoMode', label: '天罗地网起法', type: 'select', default: 'benshu', group: '书法口径', when: { method: 'book' }, options: [
			{ value: 'benshu', label: '本书·月日法' },
			{ value: 'zhongtian', label: '中天太极·月时法' },
		] },
		{ name: 'palaceNameMode', label: '宫名体系', type: 'select', default: 'common', group: '书法口径', when: { method: 'book' }, options: [
			{ value: 'common', label: '通行十二宫' },
			{ value: 'monk', label: '僧道起法' },
		] },
		{ name: 'liunianYear', label: '流年年份(留空=当年)', type: 'number', default: '', group: '流年', when: { method: 'book' } },
		{ name: 'liunianQishaMode', label: '流年七煞起法', type: 'select', default: 'shengshi', group: '流年', when: { method: 'book' }, options: [
			{ value: 'shengshi', label: '生时法' },
			{ value: 'suishu', label: '岁数法' },
		] },
		{ name: 'showBrightness', label: '显示亮度', type: 'switch', options: ON_OFF, default: 1, group: '显示选项' },
		{ name: 'showLiunian', label: '显示流年飞星', type: 'switch', options: ON_OFF, default: 1, group: '显示选项', when: { method: 'book' } },
		{ name: 'showShensha', label: '显示神煞', type: 'switch', options: ON_OFF, default: 1, group: '显示选项', when: { method: 'book' } },
		{ name: 'showZaYao', label: '显示杂曜', type: 'switch', options: ON_OFF, default: 1, group: '显示选项', when: { method: 'book' } },
		{ name: 'showDuanjue', label: '显示断诀', type: 'switch', options: ON_OFF, default: 1, group: '显示选项', when: { method: 'book' } },
		{ name: 'showXiu', label: '显示廿八宿三日宫', type: 'switch', options: ON_OFF, default: 1, group: '显示选项', when: { method: 'book' } },
		{ name: 'showBianyao', label: '显示十干变曜', type: 'switch', options: ON_OFF, default: 1, group: '显示选项', when: { method: 'book' } },
		{ name: 'showWuXingJu', label: '显示五行局', type: 'switch', options: ON_OFF, default: 1, group: '显示选项', when: { method: 'kentang' } },
		{ name: 'showSihua', label: '显示四化', type: 'switch', options: ON_OFF, default: 1, group: '显示选项', when: { method: 'kentang' } },
		{ name: 'showFlying', label: '显示飞星格局', type: 'switch', options: ON_OFF, default: 1, group: '显示选项', when: { method: 'kentang' } },
		{ name: 'showSolarTerm', label: '显示节气', type: 'switch', options: ON_OFF, default: 1, group: '显示选项', when: { method: 'kentang' } },
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
		{ name: 'historyYear', label: '所推之年(留空=按盘面年)', type: 'number', default: '', group: '典籍' },
		{ name: 'classicKey', label: '典籍', type: 'select', default: 'huangji_jingshi_shu', group: '典籍',
			options: [
				{ value: 'huangji_jingshi_shu', label: '皇極經世書(邵雍)' },
				{ value: 'xinyi_fawei', label: '心易發微(楊體仁)' },
				{ value: 'guanwu_yanyi', label: '觀物外篇衍義(張行成)' },
			] },
		{ name: 'xinyiMethod', label: '心易起卦', type: 'select', default: 'none', group: '心易發微',
			options: [
				{ value: 'none', label: '不算心易(默认)' },
				{ value: 'datetime', label: '年月日时起卦' },
				{ value: 'number', label: '两数起卦' },
				{ value: 'strokes', label: '字画起卦' },
				{ value: 'object', label: '物象+方位起卦' },
			] },
		{ name: 'upperNum', label: '上卦数', type: 'number', default: 5, min: 1, max: 999, group: '心易發微', showWhen: (d)=>d && d.xinyiMethod === 'number' },
		{ name: 'lowerNum', label: '下卦数', type: 'number', default: 10, min: 1, max: 999, group: '心易發微', showWhen: (d)=>d && d.xinyiMethod === 'number' },
		{ name: 'upperStrokes', label: '上字笔画', type: 'number', default: 5, min: 1, max: 99, group: '心易發微', showWhen: (d)=>d && d.xinyiMethod === 'strokes' },
		{ name: 'lowerStrokes', label: '下字笔画', type: 'number', default: 8, min: 1, max: 99, group: '心易發微', showWhen: (d)=>d && d.xinyiMethod === 'strokes' },
		{ name: 'objectGua', label: '物象卦', type: 'select', default: '離', group: '心易發微', showWhen: (d)=>d && d.xinyiMethod === 'object',
			options: ['乾', '兌', '離', '震', '巽', '坎', '艮', '坤'].map((g)=>({ value: g, label: g })) },
		{ name: 'direction', label: '方位', type: 'select', default: '南', group: '心易發微', showWhen: (d)=>d && d.xinyiMethod === 'object',
			options: ['南', '北', '東', '西', '東南', '東北', '西南', '西北'].map((g)=>({ value: g, label: g })) },
	] },
	// [D2] 合盘:两盘技法无法单命主重算,快照单源=合盘页所存(选项在合盘页改即重存)。
	relative: { kind: 'sectionsOnly', reason: '合盘须两张盘,挂载读合盘页当前所存快照;要改关系类型/两盘请到合盘页操作,改后即自动更新。' },

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
			{ value: 'tongguan', label: '通关派' },
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
		// [A4] 四化流派选 custom 时的随盘自定义表(JSON,形状 {"干":["禄星","权星","科星","忌星"]});
		// 留空=custom 档回落本机编辑器所存表。builder 端 normalizeSihuaCustomTable 校验,坏值不注入。
		{ name: 'sihuaCustomTable', label: '自定义四化表(JSON,配合流派=自定义)', type: 'text', default: '', group: '流派',
			placeholder: '{"甲":["廉贞","破军","武曲","太阳"],...} 留空=用本机表' },
		// 传本/排盘开关(本地引擎):任一非默认 → buildZiweiSnapshotForParams 临时覆盖 ZWEngineOptions 并以本地引擎重排盘+重算格局,
		// 使挂载/导出快照与该盘传本设置一致;全默认(缺省·被 pruneOptionsToNonDefault 剪掉不进 record)=回退全局单例=现状逐字节一致。
		{ name: 'daxianSpan', label: '大限跨度', type: 'select', default: 10, group: '传本', options: ZW_DAXIAN_SPAN_OPTIONS },
		{ name: 'tianmaBasis', label: '天马依据', type: 'select', default: 'month', group: '传本', options: ZW_TIANMA_BASIS_OPTIONS },
		{ name: 'starSet', label: '星集', type: 'select', default: 'full', group: '传本', options: ZW_STAR_SET_OPTIONS },
		{ name: 'sanPan', label: '观察盘(三盘)', type: 'select', default: 'tian', group: '传本', options: ZW_SANPAN_OPTIONS },
		{ name: 'shangShi', label: '天伤天使', type: 'select', default: 'fixed', group: '传本', options: ZW_SHANGSHI_OPTIONS },
		{ name: 'leapMonth', label: '闰月归月', type: 'select', default: 'mid_split', group: '传本', options: ZW_LEAP_MONTH_OPTIONS },
		{ name: 'lateZi', label: '晚子时', type: 'select', default: 'global', group: '传本', options: ZW_LATE_ZI_OPTIONS },
		{ name: 'yearBoundary', label: '定年界线', type: 'select', default: 'lichun', group: '传本', options: ZW_YEAR_BOUNDARY_OPTIONS },
		{ name: 'huoling', label: '火铃', type: 'select', default: 'sanhe', group: '传本', options: ZW_HUOLING_OPTIONS },
		{ name: 'kongNaming', label: '空劫命名', type: 'select', default: 'modern', group: '传本', options: ZW_KONG_NAMING_OPTIONS },
		{ name: 'brightnessSource', label: '星曜亮度', type: 'select', default: 'zi_jian', group: '传本', options: ZW_BRIGHTNESS_SOURCE_OPTIONS },
		// [B14] 亮度=自定义时的随盘亮度表(JSON,形状 {"星":{"支":"档"}};档=庙旺得地利平闲不陷)。
		// 留空=custom 档回落本机编辑器所存表;builder 端 normalizeBrightnessCustomTable 校验,坏值不注入。
		{ name: 'brightnessCustomTable', label: '自定义亮度表(JSON,配合亮度=自定义)', type: 'text', default: '', group: '传本',
			placeholder: '{"紫微":{"子":"平","丑":"庙"},...} 留空=用本机表' },
		{ name: 'lifeMasterBy', label: '命主取法', type: 'select', default: 'year_branch', group: '传本', options: ZW_LIFE_MASTER_BY_OPTIONS },
		{ name: 'changshengStart', label: '长生十二神起法', type: 'select', default: 'shui_tu', group: '传本', options: ZW_CHANGSHENG_START_OPTIONS },
		{ name: 'changshengDirection', label: '长生顺逆', type: 'select', default: 'yinyang', group: '传本', options: ZW_CHANGSHENG_DIRECTION_OPTIONS },
		{ name: 'kongwangStyle', label: '空亡星式', type: 'select', default: 'double', group: '传本', options: ZW_KONGWANG_STYLE_OPTIONS },
		{ name: 'kuiYue', label: '魁钺歌诀', type: 'select', default: 'jia_wu_geng', group: '传本', options: ZW_KUIYUE_OPTIONS },
		{ name: 'liuYueBasis', label: '流月起法', type: 'select', default: 'doujun', group: '传本', options: ZW_LIU_YUE_BASIS_OPTIONS },
		{ name: 'liunianSihuaGan', label: '流年四化取干', type: 'select', default: 'year_gan', group: '传本', options: ZW_LIUNIAN_SIHUA_GAN_OPTIONS },
		// 流派叠层显示(纯后处理,开则挂载/导出快照注入对应 ground-truth 段:童限/三限/气数位/借宫/太岁)。默认全关=现状。
		{ name: 'childLimit', label: '童限', type: 'switch', default: 0, group: '流派叠层', options: ON_OFF },
		{ name: 'zhongxian', label: '沈氏三限', type: 'switch', default: 0, group: '流派叠层', options: ON_OFF },
		{ name: 'huoPan', label: '活盘(太极点)', type: 'switch', default: 0, group: '流派叠层', options: ON_OFF },
		{ name: 'qishuWei', label: '河洛气数位', type: 'switch', default: 0, group: '流派叠层', options: ON_OFF },
		{ name: 'borrowPalace', label: '中州借宫', type: 'switch', default: 0, group: '流派叠层', options: ON_OFF },
		{ name: 'taiSuiRuGua', label: '紫云太岁入卦', type: 'switch', default: 0, group: '流派叠层', options: ON_OFF },
		{ name: 'flowLuanXi', label: '流鸾流喜', type: 'switch', default: 0, group: '流派叠层', options: ON_OFF },
		{ name: 'flowHuoLing', label: '流火流铃', type: 'switch', default: 0, group: '流派叠层', options: ON_OFF },
		{ name: 'flowShenshaOnChart', label: '流年神煞上盘', type: 'switch', default: 0, group: '流派叠层', options: ON_OFF },
		{ name: 'taiSuiRelatives', label: '太岁关系人(支[:角色[:性别]],如 午:母:female 子)', type: 'text', default: '', group: '流派叠层',
			// text→[{branch,role,sex}] 归一(与 live UI 同结构):否则 buildZiweiOverlayLines/taiSuiRuGua 的 Array.isArray 判死、挂载侧太岁入卦段静默丢失。
			// [P2e] 文法扩展 `支[:角色[:性别]]`;裸支向后兼容(role/sex 空)。
			normalize: (v)=>{ if(Array.isArray(v)){ return v; } const bs = `${v == null ? '' : v}`.split(/[,，\s]+/).map((x)=>x.trim()).filter(Boolean); return bs.map((tok)=>{ const seg = tok.split(/[:：]/); return { branch: seg[0], role: seg[1] || '', sex: seg[2] || '' }; }); } },
		// 运限层(多选,批A)：大限已逐宫含于[宫位总览];选所选层即让快照追加[运限]段(逐层钻取四化落宫+流曜)。
		// 流年/流月/流日/流时是盘面交互导航,本由 chart 本地推算(无后端参数)→ 复用 ZWLuckPanel 同口径构造器。
		// 多选语义：大限/流年/流月对所选每项各产一段(流年×流月笛卡尔);流日/流时锚定到所选的第一个上层。
		// 全空(默认)=不追加[运限]段=现状(守「默认即现状」,逐字节一致)。总段数上限~50,超限截断+提示行。
		// 小限顺逆(P1-B):流年段「小限：」行的宫序方向(ZWLuckPanel buildXiaoxianItems 消费;
		// 曾只读全局 localStorage,schema 放出 liunianSel 却调不到顺逆口径 → 半截可控)。
		{ name: 'ziweiXiaoxianYinyang', label: '小限顺逆', type: 'select', default: '0', group: '运限', options: [
			{ value: '0', label: '男顺女逆（默认）' }, { value: '1', label: '阳男阴女顺(中州)' },
		] },
		{ name: 'daxianSel', label: '大限(命盘宫位序0–11,可多选)', type: 'multiselect', default: [], group: '运限', options: ZIWEI_DAXIAN_OPTIONS },
		{ name: 'liunianSel', label: '流年小限(公历年,逗号分隔多年,如 1996,2000;小限随年按虚岁自动并出)', type: 'text', default: '', group: '运限' },
		{ name: 'liuyueSel', label: '流月(农历月1–12,可多选)', type: 'multiselect', default: [], group: '运限', options: LUNAR_MONTH_OPTIONS },
		{ name: 'liuriSel', label: '流日(农历日1–31,可多选,锚定首个上层)', type: 'multiselect', default: [], group: '运限', options: LUNAR_DAY_OPTIONS },
		{ name: 'liushiSel', label: '流时(时辰序0–11子起,可多选,锚定首个上层)', type: 'multiselect', default: [], group: '运限', options: SHICHEN_OPTIONS },
	] },

	// ---- A 类：数算（时间换算 + 流派）----
	// 邵子参评数 method(明法/古法)：buildCanpingSnapshotForRecord/canpingLiunianSeries 透传 opts.method →
	// dayPalace(canpingLocal) 改命宫取法(明法=月支反向 / 古法=日支)，真改快照(round-trip 通)。默认 ming === 现状。
	// 神数正传 zc*：流派/求测时辰/父母年龄/元运/虚岁 → record.zc* → builder opts。
	// 缺省 → builder 回默认（铁板 + 本人时柱作求测时辰）＝现状，字节级一致。
	zhengchuan: { kind: 'record', fields: [
		...TIME_FIELDS,
		{ name: 'zcSchool', label: '流派', type: 'select', default: 'tieban', group: '流派', options: [
			{ value: 'tieban', label: '铁板神数（默认）' },
			{ value: 'shaozi', label: '邵子神数' },
			{ value: 'dading', label: '大定神数' },
			{ value: 'liuqin', label: '六亲属相姓氏断' },
			{ value: 'xinyi', label: '铁算心易（查询）' },
		] },
		{ name: 'zcAskGz', label: '求测时辰（干支）', type: 'text', default: '', group: '铁板' },
		{ name: 'zcFatherAge', label: '父生我时年龄', type: 'number', default: 27, group: '邵子' },
		{ name: 'zcMotherAge', label: '母生我时年龄', type: 'number', default: 26, group: '邵子' },
		{ name: 'zcYuan', label: '元运（先天命卦余五特例）', type: 'select', default: 'zhong', group: '邵子', options: [
			{ value: 'shang', label: '上元' },
			{ value: 'zhong', label: '中元（默认）' },
			{ value: 'xia', label: '下元' },
		] },
		// 大定七位:四柱由生辰定，余三位(大运/小运/岁君)与虚岁皆由【所推之流年】派生 ——
		// 故此处主控亦是流年一项，下四格留作古法特例之手订(留空即自出)。
		{ name: 'zcDadingYear', label: '所推流年（余者自出）', type: 'number', default: 0, group: '大定' },
		{ name: 'zcAge', label: '虚岁（留空自出）', type: 'number', default: 0, group: '大定' },
		{ name: 'zcDayun', label: '大运（干支，留空自出）', type: 'text', default: '', group: '大定' },
		{ name: 'zcXiaoyun', label: '小运（干支，留空自出）', type: 'text', default: '', group: '大定' },
		{ name: 'zcSuijun', label: '岁君（干支，留空自出即当年太岁）', type: 'text', default: '', group: '大定' },
		{ name: 'zcAskHourZhi', label: '演算时辰（支）', type: 'text', default: '', group: '六亲' },
		{ name: 'zcEnv', label: '演算时天象', type: 'text', default: '', group: '六亲' },
		{ name: 'zcItem', label: '查询项目', type: 'select', default: '父母', group: '心易', options: [
			{ value: '父母', label: '父母（默认）' }, { value: '兄弟', label: '兄弟' }, { value: '姻緣', label: '姻缘' },
			{ value: '子孫', label: '子孙' }, { value: '官祿', label: '官禄' }, { value: '疾病', label: '疾病' },
		] },
		{ name: 'zcSound', label: '声音', type: 'text', default: '日', group: '心易' },
		{ name: 'zcKe', label: '刻数', type: 'text', default: '一刻', group: '心易' },
		{ name: 'zcGong', label: '八宫', type: 'text', default: '乾', group: '心易' },
		{ name: 'zcXqZhi', label: '性情项·地支', type: 'text', default: '子', group: '心易' },
		{ name: 'zcXqYushu', label: '性情项·余数', type: 'text', default: '1', group: '心易' },
	] },
	canping: { kind: 'record', fields: [
		...TIME_FIELDS,
		{ name: 'method', label: '取法', type: 'select', default: 'ming', group: '取法', options: [
			{ value: 'ming', label: '明法（月支反向，默认）' },
			{ value: 'gu', label: '古法（八字日支）' },
		] },
		// [Win-D69] 大运排法三档与页面同枚举:此前挂载不暴露 → 页面选档挂载恒默认(不同构死角)。
		// baziStyle=八字真源注入(节气起运,与八字盘同源);默认 mingGongQiyun === 现状(零回归)。
		{ name: 'dayunRule', label: '大运排法', type: 'select', default: 'mingGongQiyun', group: '取法', options: [
			{ value: 'mingGongQiyun', label: '命宫顺行 · 生日推起运（默认）' },
			{ value: 'mingGongOne', label: '命宫顺行 · 恒一岁起' },
			{ value: 'baziStyle', label: '八字大运法（与八字盘同源）' },
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
		{ name: 'liuYueMode', label: '流月起月', type: 'select', default: 'ying', group: '推运分歧', options: [
			{ value: 'ying', label: '应爻校准（古籍实证，默认）' },
			{ value: 'legacy', label: '现行序（旧法）' },
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
		{ name: 'annualMethod', label: '逐年法', type: 'select', default: 'xiaoxian', group: '推运分歧', options: [
			{ value: 'xiaoxian', label: '小限（默认）' },
			{ value: 'liunian', label: '流年十二神' },
		] },
		{ name: 'xiaoxianDir', label: '小限顺逆', type: 'select', default: 'chart', group: '推运分歧', options: [
			{ value: 'chart', label: '随盘向（默认）' },
			{ value: 'always', label: '一律顺行' },
		] },
		{ name: 'leapRule', label: '闰月细则', type: 'select', default: 'half', group: '排盘分歧', options: [
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
		{ name: 'shenshaLayer', label: '神煞合参层', type: 'switch', options: ON_OFF, default: 0, group: '合参层', normalize: (v)=>(v === true || v === 1 || v === '1') },
	] },

	// ---- B 类：事盘 options 驱动 ----
	qimen: { kind: 'payload', optionsPath: 'options', fields: QIMEN_FIELDS },
	taiyi: { kind: 'payload', optionsPath: 'options', fields: TAIYI_FIELDS },
	// 皇极轨策：🔴 kind='payload' —— 起卦所得(卦与动爻)是报数/字占/时辰之冻结值，永不按挂载重算
	// （重算即伪造一个不同之卦）；然其后诸演算(演数/卦变/断法/十应)皆自已冻结之卦派生 → 可随 options 重算。
	guice: { kind: 'payload', optionsPath: 'options', group: '皇极轨策', fields: [
		{ name: 'yanshuFa', label: '演数', type: 'select', default: 'ce', group: '演数', options: [
			{ value: 'ce', label: '策数（默认）' }, { value: 'gui', label: '轨数' },
		] },
		{ name: 'qiguaShu', label: '数字配卦', type: 'select', default: 'xiantian', group: '演数', options: [
			{ value: 'xiantian', label: '五行生成数（默认）' }, { value: 'houtian', label: '后天正数' }, { value: 'jiuchou', label: '九畴数' },
		] },
		{ name: 'jiGongMode', label: '五·十寄宫', type: 'select', default: 'ganrou', group: '演数', options: [
			{ value: 'ganrou', label: '刚柔日动态（默认）' }, { value: 'wuGen', label: '五寄艮·十寄坤' }, { value: 'wuKun', label: '五寄坤·十寄艮' },
		] },
		{ name: 'shiyingSet', label: '十应名目', type: 'select', default: 'xinyifawei', group: '断法', options: [
			{ value: 'xinyifawei', label: '心易发微版（默认）' }, { value: 'meihua', label: '梅花原书版' }, { value: 'rizhen', label: '日辰秘文版' },
		] },
		{ name: 'dadingTable', label: '六十甲子定数', type: 'select', default: 'xinyifawei', group: '断法', options: [
			{ value: 'xinyifawei', label: '心易发微本（默认）' }, { value: 'dading', label: '大定本' },
		] },
		// 🔴 数系/时方/神煞 三项此前【漏登】—— 面板里根本调不着，而它们是九开关中的三个。
		//    (schema 会渲染成挂载设置面板里的真设置项，漏登=用户在挂载设置里见不到此项。)
		//    起卦法不登:其决定卦本身，而卦是【冻结值】—— 按挂载重起即伪造一个用户没见过的卦。
		{ name: 'shuXi', label: '数系', type: 'select', default: 'zhouyi', group: '断法', options: [
			{ value: 'zhouyi', label: '周易数（默认·参时方）' }, { value: 'meihua', label: '梅花（不用时方）' },
		] },
		{ name: 'shiFang', label: '参时方（方应）', type: 'switch', options: ON_OFF, default: false, group: '断法', normalize: (v)=>(v === true || v === 1 || v === '1') },
		{ name: 'shenSha', label: '参时方神煞（古籍未载其表，只出名目）', type: 'switch', options: ON_OFF, default: false, group: '断法', normalize: (v)=>(v === true || v === 1 || v === '1') },
	] },
	// 小六壬:课(三数)=冻结值不登;流派可重排(换环重排三传,三数不变)。
	xiaoliuren: { kind: 'payload', optionsPath: 'options', group: '小六壬', fields: [
		{ name: 'school', label: '流派', type: 'select', default: 'main', group: '起课', options: [
			{ value: 'main', label: '主流六宫（默认）' }, { value: 'dao', label: '道门九宫' },
		] },
		{ name: 'showOneThree', label: '一↔三关系行(文档无定论,仅列关系)', type: 'switch', options: ON_OFF, default: true, group: '判读',
			normalize: (v)=>(v === true || v === 1 || v === '1'), showWhen: (d)=>d.school === 'dao' },
	] },
	// 小成图:卦(起卦所出)=冻结值,起卦法/配数流派皆不登(重配=伪造卦);用宫可重排推演。
	xiaochengtu: { kind: 'payload', optionsPath: 'options', group: '小成图', fields: [
		{ name: 'yongGong', label: '用宫(推演起点)', type: 'select', default: 1, group: '推演', options: [
			{ value: 1, label: '1 坎宫（默认）' }, { value: 2, label: '2 坤宫' }, { value: 3, label: '3 震宫' }, { value: 4, label: '4 巽宫' },
			{ value: 6, label: '6 乾宫' }, { value: 7, label: '7 兑宫' }, { value: 8, label: '8 艮宫' }, { value: 9, label: '9 离宫' },
		] },
		// 闢(离心)一象之辞两传本相反(往/來/闔三象两本一致):正传=古籍原文、异文=另本情伪论所推。
		{ name: 'piKoujing', label: '闢卦细判口径', type: 'select', default: 'zheng', group: '判读', options: [
			{ value: 'zheng', label: '正传:得配害·失配利（默认）' }, { value: 'yiwen', label: '异文:得配利·失配害' },
		] },
	] },
	// 飞宫小奇门:局(起支)=冻结值不登;命宫年龄性别只重排命宫目,不动局。
	feigong: { kind: 'payload', optionsPath: 'options', group: '飞宫小奇门', fields: [
		{ name: 'mingAge', label: '命宫年龄', type: 'number', default: null, group: '命宫' },
		{ name: 'mingGender', label: '命宫性别', type: 'select', default: 'male', group: '命宫', options: [
			{ value: 'male', label: '男（值五看戊）' }, { value: 'female', label: '女（值五看己）' },
		] },
		// 流月/河魁口径:payload.options 已存、builder 已消费(buildFeiGongSnapshotText o.liuYueMonth/o.koujing),曾只差齿轮。
		{ name: 'liuYueMonth', label: '流月(留空=不列)', type: 'select', default: '', group: '推演', options: [
			{ value: '', label: '不列流月（默认）' },
			...numRangeOptions(1, 12, (i)=>`${i}月`),
		] },
		{ name: 'koujing', label: '河魁口径', type: 'select', default: 'zheng', group: '推演', options: [
			{ value: 'zheng', label: '正传·收（默认）' }, { value: 'yi', label: '异文·开' },
		] },
	] },
	liureng: { kind: 'payload', optionsPath: '', fields: LIURENG_FIELDS },
	jinkou: { kind: 'payload', optionsPath: '', fields: JINKOU_FIELDS },
	sanshiunited: { kind: 'payload', optionsPath: 'options', fields: SANSHI_UNITED_FIELDS },
	horary: { kind: 'payload', optionsPath: '', fields: HORARY_FIELDS },
	election: { kind: 'payload', optionsPath: '', fields: ELECTION_FIELDS },

	// ---- C 类：builder 自读 localStorage ----
	guolao: { kind: 'localStorage', fields: GUOLAO_FIELDS },

	// ---- D 类 / 无重算：只暴露内容勾选 ----
	germany: { kind: 'record', fields: GERMANY_FIELDS },
	// 巴比伦占星:record 类可重算(恒星黄道·毕宿锚固定口径,体系定义即坐标,无可调齿轮);
	// 派系(阶梯/锯齿)只影响数理星历页显示,挂载快照恒取默认基线=零回归。
	// 🔴 旧 emptyHint「派系只影响数理星历页显示」与 babylonSchools.appliesTo:['horoscope',…] 直接矛盾:
	// ephemerisSource/solstice/era 均作用于被挂载的个人星盘页。页面派系是 state 不落档 → 齿轮为唯一持久入口。
	babylon: { kind: 'record', fields: [
		{ name: 'babylonScheme', label: '派系', type: 'select', default: 'swissA10', group: '派系', options: [
			{ value: 'swissA10', label: '现代实位·A10' }, { value: 'systemA', label: '阶梯复原(A)' }, { value: 'systemB', label: '锯齿复原(B)' },
		] },
		{ name: 'babylonEphemerisSource', label: '位置源(空=随派系)', type: 'select', default: '', group: '派系', options: [
			{ value: '', label: '随派系（默认）' }, { value: 'swiss', label: '现代实位' },
			{ value: 'systemA', label: '阶梯复原(A)' }, { value: 'systemB', label: '锯齿复原(B)' },
		] },
		{ name: 'babylonSolstice', label: '分至规范(空=随派系)', type: 'select', default: '', group: '派系', options: [
			{ value: '', label: '随派系（默认）' }, { value: 'A10', label: '春分白羊 10°(A)' }, { value: 'B8', label: '春分白羊 8°(B)' },
		] },
		{ name: 'babylonEra', label: '纪元显示', type: 'select', default: 'seleucid', group: '派系', options: [
			{ value: 'seleucid', label: '塞琉古纪元(S.E.)' }, { value: 'arsacid', label: '安息纪元(= S.E.−64)' },
		] },
	] },
	// 老黄历:纯日期确定复算,无齿轮
	huangli: { kind: 'sectionsOnly', reason: '老黄历按起课日期确定复算,无可调参数;内容勾选照常。' },
	// 通书择日:齿轮落 payload.tongshu(regenerate 读 {...defaults, ...p.tongshu} —— 该读点此前无任何写入方)
	tongshu: { kind: 'payload', optionsPath: 'tongshu', group: '通书择日', fields: [
		{ name: 'school', label: '流派', type: 'select', default: 'donggong', options: [
			{ value: 'donggong', label: '董公择日' },
			{ value: 'qimen', label: '奇门叠数（裴晋公·唐）' },
			{ value: 'sanyuanliexiu', label: '三垣列宿加临（古法）' },
			{ value: 'wutu', label: '天元乌兔' },
			{ value: 'sanyuan', label: '三元玄空大卦' },
		] },
		// 用事:全流派快照「用事：」抬头行 + 董公宜忌判读消费(曾缺 → 挂载恒「嫁娶」)。全表按类分组平铺。
		{ name: 'event', label: '用事', type: 'select', default: '嫁娶',
			options: TONGSHU_TERM_CATEGORIES.reduce((acc, cat)=>{
				(TONGSHU_TERMS[cat] || []).forEach((t)=>{ acc.push({ value: t.name, label: `${cat}·${t.name}` }); });
				return acc;
			}, []) },
		{ name: 'liexiuUse', label: '列宿用事类', type: 'select', default: '建宅', options: [
			{ value: '建宅', label: '建宅·营造' },
			{ value: '修造', label: '修造·安门灶' },
			{ value: '安葬', label: '安葬·丧事' },
			{ value: '造命', label: '造命·择时立命' },
		] },
		// 主事仙命年(三元玄空档消费;曾缺 → 玄空派恒按甲子命年判)。when 对象式条件显隐。
		{ name: 'mingYear', label: '主事仙命年(三元玄空)', type: 'select', default: '甲子', when: { school: 'sanyuan' },
			options: GANZHI_60.map((g)=>({ value: g, label: g })) },
		// zuoShan 已删:双重幽灵 —— 无任何流派声明 needs.zuoShan(页面控件永不渲染),快照 builder 全文不消费
		// (三元玄空段末自注「坐向卦须六十四卦天圆图…本法从缺」);齿轮选它 100% 无效果。
	] },
	// 🔴 旧定性「sectionsOnly 不可改卦象」过宽:不可改的只有卦象本身;21 项判读口径经冻结卦重算恒安全。
	sixyao: { kind: 'payload', optionsPath: 'liuyaoSettings', group: '六爻', fields: SIXYAO_FIELDS,
		// 存档现状住 payload.gua.liuyaoSettings(存档层);optionsPath 顶层是覆盖层(merge 写入、
		// mergeLiuyaoGearSettings 与存档合并)。基线锚必须读存档层,否则恒退 schema 默认。
		baselineSource: (payload)=>(payload && payload.gua && typeof payload.gua === 'object'
			&& payload.gua.liuyaoSettings && typeof payload.gua.liuyaoSettings === 'object'
			? payload.gua.liuyaoSettings : null),
		emptyHint: '卦象与动爻取自已存起卦结果、恒不重起;以下皆为判读口径。' },
	tongshefa: { kind: 'sectionsOnly', reason: '统摄法基于已起卦象的确定性结果，仅可调纳入内容、不可重算。' },
	// 真阻断点=regenerateCaseTechniqueSnapshot 无 mundane 支(挂载只能直读 payload.aiSnapshot,无无头复算路径);
	// 「类型多样」是背景不是原因。判读口径(ruleset/orb/入境规则)欲开放须先造 headless builder,成本≫收益,维持只读。
	mundane: { kind: 'sectionsOnly', reason: '世俗盘按存档快照直读(无无头复算路径),仅可调纳入内容;判读口径请在世俗盘页调整后重存。' },
	tianxing: { kind: 'sectionsOnly', reason: '天星择日按存档快照直读(征象搜索结果为一次性产物,不按时间复算);要改条件请在择日页重搜后重存。' },
	qimenzeri: { kind: 'sectionsOnly', reason: '奇门择日按存档快照直读(找局结果为一次性产物,不按时间复算);要改条件/参数请在择日页重找后重存。' },
	// auxchart 页面键在挂载链会被映射成子 tab 技法键(aiExport auxchartMap 同构),此处条目永不命中
	// —— 曾挂着一条孤儿 sectionsOnly(挂载链死/报告链活),删除以免误导。
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
	// 🔴 天文地占旧定性「sectionsOnly」过宽:figure 由 seedMode:'manual'+seed 冻结(存档已带),
	// 判读轴(流派/层级/占星体系/所问宫/转宫)重算恒不换卦;seedMode/seed/question 不登(登=可伪造新卦)。
	// 默认 '' = 随档(prune 剪掉 → builder 落存档值);granular(传本逐项改写 dict)非控件型,随档回放不进齿轮。
	geomancy: { kind: 'payload', optionsPath: 'options', group: '天文地占', fields: [
		{ name: 'tradition', label: '流派', type: 'select', default: '', group: '判读', options: [
			{ value: '', label: '随档（默认）' },
			{ value: 'european_classical', label: '古典定局派' }, { value: 'european_planetary', label: '行星共鸣派' },
			{ value: 'european_modern', label: '现代综合派(判读同古典口径)' }, { value: 'arabic_raml', label: '阿拉伯沙占派' },
			{ value: 'india_ramal', label: '印度骰占派' }, { value: 'sikidy', label: '异或表盘(Sikidy)' },
			{ value: 'hakata', label: '四片盘(Hakata)' },
		] },
		{ name: 'readingScope', label: '判读层级', type: 'select', default: '', group: '判读', options: [
			{ value: '', label: '随档（默认）' },
			{ value: 'L0', label: 'L0 仅判官' }, { value: 'L1', label: 'L1 三图(证·判)' },
			{ value: 'L2', label: 'L2 盾牌全局' }, { value: 'L3', label: 'L3 十二宫' }, { value: 'L4', label: 'L4 占星定局' },
		] },
		{ name: 'zodiacSystem', label: '占星体系', type: 'select', default: '', group: '判读', options: [
			{ value: '', label: '随档（默认）' }, { value: 'classical', label: '古典定局体系' }, { value: 'planetary', label: '行星归属体系' },
			{ value: 'planetary_alt', label: '行星归属·乙(另一传本表)' },
		] },
		// 图形入宫三式:与落星法(granular,非控件型故不登齿轮)是正交两维
		{ name: 'housePlacement', label: '图形入宫', type: 'select', default: '', group: '判读', options: [
			{ value: '', label: '随档（默认顺铺）' }, { value: 'sequential', label: '顺铺' },
			{ value: 'angular', label: '四正入宫(果宫取合成卦)' }, { value: 'golden_dawn', label: '近世学派置换' },
		] },
		{ name: 'quesitedHouse', label: '所问宫(1-12)', type: 'select', default: '', group: '判读',
			options: [{ value: '', label: '随档/问类预设（默认）' }, ...numRangeOptions(1, 12, (i)=>`第 ${i} 宫`)] },
		{ name: 'turnTo', label: '转宫(1-12)', type: 'select', default: '', group: '判读',
			options: [{ value: '', label: '不转宫（默认）' }, ...numRangeOptions(1, 12, (i)=>`转第 ${i} 宫`)] },
	] },
	// 灵棋经:卦(棋数)=冻结值不登(重掷=伪造一个用户没见过的卦);注家显示/课断/断诗/问类
	// 皆判读显示层,''=随档(三态 select,免 switch 默认值静默覆盖档内口径)。
	lingqi: { kind: 'payload', optionsPath: 'options', group: '灵棋经', emptyHint: '棋势取自已存起卦结果、恒不重掷;以下皆为判读显示口径。', fields: [
		{ name: 'zhu_yan', label: '颜幼明注', type: 'select', default: '', group: '注家', options: [
			{ value: '', label: '随档（默认）' }, { value: 1, label: '显示' }, { value: 0, label: '隐藏' },
		] },
		{ name: 'zhu_he', label: '何承天注', type: 'select', default: '', group: '注家', options: [
			{ value: '', label: '随档（默认）' }, { value: 1, label: '显示' }, { value: 0, label: '隐藏' },
		] },
		{ name: 'zhu_chen', label: '陈师凯解', type: 'select', default: '', group: '注家', options: [
			{ value: '', label: '随档（默认）' }, { value: 1, label: '显示' }, { value: 0, label: '隐藏' },
		] },
		{ name: 'zhu_liu', label: '刘基注', type: 'select', default: '', group: '注家', options: [
			{ value: '', label: '随档（默认）' }, { value: 1, label: '显示' }, { value: 0, label: '隐藏' },
		] },
		{ name: 'zhu_ke', label: '课断(此课总断)', type: 'select', default: '', group: '注家', options: [
			{ value: '', label: '随档（默认）' }, { value: 1, label: '显示' }, { value: 0, label: '隐藏' },
		] },
		{ name: 'zhu_shi', label: '断诗(诗曰/又曰)', type: 'select', default: '', group: '注家', options: [
			{ value: '', label: '随档（默认）' }, { value: 1, label: '显示' }, { value: 0, label: '隐藏' },
		] },
		{ name: 'category', label: '问类', type: 'select', default: '', group: '判读', options: [
			{ value: '', label: '随档（默认）' }, { value: 'general', label: '通用' }, { value: 'career', label: '仕途' },
			{ value: 'wealth', label: '求财' }, { value: 'marriage', label: '婚姻' }, { value: 'health', label: '疾病' },
			{ value: 'travel', label: '行人' }, { value: 'lawsuit', label: '官讼' }, { value: 'home', label: '家宅' },
		] },
	] },
	// 🔴 塔罗旧定性同上:牌面只由 deckId/spreadType/seed 决定(存档写死 manual+seed),
	// settings 全落判读层 —— 同一副牌不同判读文本恒安全;deckId/spreadType/seed/question 不登。
	tarot: { kind: 'payload', optionsPath: 'options', group: '塔罗', fields: [
		{ name: 'meaningSystem', label: '牌义体系', type: 'select', default: '', group: '判读', options: [
			{ value: '', label: '随档（默认）' }, { value: 'manual', label: '逐牌义' }, { value: 'waite', label: 'Waite 1911' },
			{ value: 'degrees', label: '数字度(马赛)' },
		] },
		{ name: 'reversalMode', label: '逆位读法', type: 'select', default: '', group: '判读', options: [
			{ value: '', label: '随档（默认）' }, { value: 'stored', label: '预存逆位义' }, { value: 'blocked', label: '受阻/压抑' },
			{ value: 'internal', label: '内化/私密' }, { value: 'opposite', label: '相反/反义' },
			{ value: 'reduced', label: '减弱' }, { value: 'excess', label: '过度/失衡' },
			{ value: 'delayed', label: '延迟/时机' }, { value: 'projection', label: '投射' }, { value: 'misuse', label: '误用/错向' },
			{ value: 'negation', label: '不是/没有' }, { value: 'breakthrough', label: '突破/解脱' }, { value: 're_words', label: '回撤/重审' },
			{ value: 'retreat', label: '回退前课' },
		] },
		{ name: 'variant', label: '对应体系', type: 'select', default: '', group: '判读', options: [
			{ value: '', label: '随档（默认）' }, { value: 'A', label: 'A 金色黎明' }, { value: 'B', label: 'B 托特' }, { value: 'C', label: 'C 大陆' },
		] },
		{ name: 'verdictMode', label: '判定口径', type: 'select', default: '', group: '判读', options: [
			{ value: '', label: '随档（默认）' }, { value: 'majority', label: '多数' }, { value: 'orientation', label: '朝向' },
			{ value: 'single', label: '首牌' }, { value: 'polarity', label: '极性' }, { value: 'numeric', label: '数字阈值' },
			{ value: 'weighted_center', label: '中位加权' }, { value: 'anchor', label: '答案锚位' }, { value: 'single3', label: '单张三态' },
		] },
		{ name: 'dignities', label: '牌间尊卑(dignities)', type: 'select', default: '', group: '判读', options: [
			{ value: '', label: '随档（默认）' }, { value: 1, label: '开' }, { value: 0, label: '关' },
		] },
		{ name: 'suitElementSwap', label: '火风互换(花色元素)', type: 'select', default: '', group: '判读', options: [
			{ value: '', label: '随档（默认）' }, { value: 1, label: '开' }, { value: 0, label: '关' },
		] },
		// TP9 判读齿轮扩容(五书补齐):全部判读显示层——同一副牌不同判读文本;牌面(deckId/spreadType/seed/牌池/朝向生成)恒不入。
		{ name: 'quintMode', label: '精华牌口径', type: 'select', default: '', group: '判读', options: [
			{ value: '', label: '随档（默认）' }, { value: 'standard', label: '通行' }, { value: 'fool22', label: '愚人廿二(数值加法)' },
		] },
		{ name: 'edVersion', label: '尊位版本', type: 'select', default: '', group: '判读', options: [
			{ value: '', label: '随档（默认）' }, { value: 'modern', label: '现行三档' }, { value: 'mathers', label: '原典四档' },
		] },
		{ name: 'ookTable', label: '开钥计数表', type: 'select', default: '', group: '判读', options: [
			{ value: '', label: '随档（默认）' }, { value: 'standard', label: '通行' }, { value: 'sephira', label: '质点' },
		] },
		{ name: 'astroModern', label: '现代行星注', type: 'select', default: '', group: '判读', options: [
			{ value: '', label: '随档（默认）' }, { value: 1, label: '开' }, { value: 0, label: '关' },
		] },
		{ name: 'timingMethod', label: '计时法', type: 'select', default: '', group: '判读', options: [
			{ value: '', label: '随档（默认）' }, { value: 'suit_unit', label: '花色单位' }, { value: 'major_number', label: '大牌数字' },
			{ value: 'major_zodiac', label: '大牌星座' }, { value: 'decan_full', label: '旬星全谱' }, { value: 'ace_hunt', label: '翻至王牌' },
		] },
		{ name: 'timingUnit', label: '计时单位(大牌数字法)', type: 'select', default: '', group: '判读', options: [
			{ value: '', label: '随档（默认）' }, { value: '天', label: '天' }, { value: '周', label: '周' }, { value: '月', label: '月' },
		] },
		{ name: 'courtElementSystem', label: '宫廷元素体系', type: 'select', default: '', group: '判读', options: [
			{ value: '', label: '随档（默认）' }, { value: 'gd', label: '元素中元素' }, { value: 'alt', label: '位阶制' },
		] },
		{ name: 'courtZodiacSystem', label: '宫廷星座体系', type: 'select', default: '', group: '判读', options: [
			{ value: '', label: '随档（默认）' }, { value: 'gd_span', label: '跨段' }, { value: 'simple', label: '单座制' },
		] },
		{ name: 'crossingUpright', label: '交叉牌横置(恒正读)', type: 'select', default: '', group: '判读', options: [
			{ value: '', label: '随档（默认）' }, { value: 1, label: '开' }, { value: 0, label: '关' },
		] },
	] },
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
// [V6-W1] 🔴 比较锚升级「非默认」→「非现状」:第三参 baseline(该盘实际生效值,如 record/
// 存档 payload)存在时,比较锚 = baseline[name](present)?? field.default。
// 由来(用户实锤):astrochart hsys 的 schema default=0(整宫制)而存盘现状恒为 1(Alcabitus)——
// 「选整宫制」≡「选 schema 默认」被三道 prune 连剪,该值**永远不可表达**;凡 schema 默认 ≠
// 盘存值的字段(zodiacal/termsVariant/tradition…)同构发病。锚到盘现状后:与盘不同才算覆盖,
// 调回盘现状=不覆盖(「默认即现状」契约的正确实现——现状是盘的现状,不是 schema 的想象)。
// 无 baseline(配置包等无盘场景)回退 schema default 旧语义。
// [V6 二轮复查] 「现状默认」单源:field.globalCurrent(全局仓种子键——页面种子=全局现值、
// 存盘「值==种子不落键」,record 缺键的真实语义=「随全局」而非内建 schema 默认;15 键族
// westNodeType 系+古典口径 10 键)优先于 field.default。prune 比较锚与抽屉基线显示共用。
function fieldCurrentDefault(field){
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

export function effectiveMountBaseline(key, record){
	const schema = getTechniqueSettingsSchema(key);
	const out = {};
	if(!schema || !Array.isArray(schema.fields)){
		return out;
	}
	let src = record && typeof record === 'object' ? record : {};
	if(schema.kind === 'localStorage'){
		// [V6 复查轮] C 类现状=record 长名(随盘保真) ?? 全局 storageKey 现值 —— 此前读平铺
		// 短名恒退化 schema 默认:抽屉不显示真实现状,「选 schema 默认」在现状非默认时被剪空。
		return localStorageMountBaseline(key, record);
	}
	if(schema.kind === 'payload' && !schema.chartRoute){
		// [V6 复查轮] 🔴 B 类(payload)技法的现状住 record.payload 存档段,不在平铺键——
		// 此前一律读平铺键 ⇒ B 类基线恒退化 schema 默认:抽屉打开显示想象值(A 类实锤的同型
		// 二次误导),且「存档非默认时调回 schema 默认档」在 UI 层即被剪空,永远到不了重算入口
		// 的 payload 现状锚。
		src = payloadBaselineSegment(schema, src) || {};
	}else if(schema.kind === 'payload' && schema.chartRoute){
		// chartRoute 例外(cetian/huangji):payload kind 但走 A 路,覆盖写 record 平铺;
		// [V6 二轮复查] 现状=存档段(事盘 payload,经 baselineSource 映射)打底 + 平铺覆盖——
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
	schema.fields.forEach((field)=>{
		out[field.name] = (src[field.name] !== undefined && src[field.name] !== null)
			? src[field.name]
			: fieldCurrentDefault(field);
	});
	return out;
}

export function pruneOptionsToNonDefault(key, options, baseline){
	const schema = getTechniqueSettingsSchema(key);
	const out = {};
	if(!schema || !Array.isArray(schema.fields) || !options || typeof options !== 'object'){
		return out;
	}
	const base = baseline && typeof baseline === 'object' ? baseline : null;
	schema.fields.forEach((field)=>{
		if(!Object.prototype.hasOwnProperty.call(options, field.name)){
			return;
		}
		let v = options[field.name];
		if(typeof field.normalize === 'function'){
			v = field.normalize(v);
		}
		let def = (base && base[field.name] !== undefined && base[field.name] !== null)
			? base[field.name]
			: fieldCurrentDefault(field);
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

// [V6 二轮复查] 🔴 模板店存/读只做「schema 字段过滤 + 值域归一」,绝不比默认值——
// 「同类默认」的键值语义=保存时的用户显式改动集(外层已按盘现状剪过),其中「恰=schema 默认」
// 是合法内容(对存非默认的盘=真改动;消费端原样透传,由重算入口按各盘现状终判)。此前店内
// 二参 prune(锚裸 schema 默认)把这类值二次剪掉:盘存整宫制拨 Alcabitius 点「设为同类默认」
// → 店里删键、UI 却报「已设为持久」—— 双层锚不同构的模板店翻版。
function sanitizeOptionsToSchema(key, options){
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

export function mergeOptionsIntoRecord(record, key, options){
	const base = record && typeof record === 'object' ? { ...record } : {};
	// [V6-W1] baseline=record 本身:与盘现状不同才写(盘存 hsys=1 时选 0=真差异 → 写入生效)。
	// [V6 二轮复查] C 类内层锚=与外层同源的 localStorageMountBaseline(record 短名缺键会错锚
	// schema 默认,把「=schema 默认但≠现状」的合法覆盖二次剪掉——双层锚不同构又一例)。
	const schema = getTechniqueSettingsSchema(key);
	const baseline = (schema && schema.kind === 'localStorage') ? localStorageMountBaseline(key, base) : base;
	const pruned = pruneOptionsToNonDefault(key, options, baseline);
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
	return base;
}

// B 类同构:baseline=存档 payload 的 optionsPath 现值(存档流派非默认时,调回默认档同样要可表达)。
function payloadOptionsBaseline(schema, payload){
	// [V6 复查轮] 与外层覆盖判定同锚(payloadSegmentOf 认 baselineSource 存档层) —— 此前只按
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
		base[path] = { ...(base[path] && typeof base[path] === 'object' ? base[path] : {}), ...pruned };
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
	// [V6 复查轮] 内层 prune 锚全局现状(与外层同锚):锚裸 schema 默认时,「全局存非默认、
	// 挂载临时拨回默认档」会在这里被剪掉不写 → builder 仍读到全局非默认值,临时覆盖失效。
	const pruned = pruneOptionsToNonDefault(key, options, localStorageMountBaseline(key));
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
