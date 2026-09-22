import { Component, Fragment, memo } from 'react';
import {
	parseSnapshotSections,
	SANSHI_TAIYI_SECTION_TITLES,
	SANSHI_QIMEN_EXTRA_SECTIONS,
	SANSHI_LIURENG_DUANGUA_SECTIONS,
} from './sanshiSnapshotSections';
import { registerStepPrefetcher, unregisterStepPrefetcher } from '../../utils/stepPrefetch';
import { FreezeSubTab } from '../comp/FreezeInactive';
import { markPanelReady } from '../../utils/perfMark';
import { getLayoutViewportHeight } from '../../utils/shellZoom';
import { Divider, Tag, message } from 'antd';
import { XQButton as Button, XQCard as Card, XQSelect as Select, XQTabs as Tabs, XQSideSection } from '../xq-ui';
import XQIcon from '../xq-icons';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { splitDegree, convertLatToStr, convertLonToStr } from '../astro/AstroHelper';
import { resolveGeoZone } from '../../utils/timezone';
import { geoNameFieldPatch } from '../../utils/geoName';
import { saveModuleAISnapshot, loadModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import * as LRConst from '../liureng/LRConst';
import ChuangChart from '../liureng/ChuangChart';
import { sanChuanRelationSnapshotLines } from '../liureng/LRSanChuanRelationMini';   // [Q-450/T-413] 三传递生递克/徽记单源(三式同步)
import {
	PAIPAN_OPTIONS,
	ZHISHI_OPTIONS,
	YUEJIA_QIJU_OPTIONS,
	QIJU_METHOD_OPTIONS,
	qijuMethodOptionsFor,
	qijuMethodSelectValue,   // [Q-161/T-79] 起局下拉单一真值源(与独立奇门页同源)
	KONG_MODE_OPTIONS,
	MA_MODE_OPTIONS,
	YIXING_OPTIONS,
	SCHOOL_OPTIONS,
	ZHIRUN_LEAP_OPTIONS,
	calcDunJia,
	fetchQimenPan,
	normalizeKinqimenData,
	getXunHead,
	GUXU,
	isQimenLocalRoute,
	needJieqiYearSeed,
	jieqiSeedYears,
	jieqiSeedSignature,
	buildDunJiaSnapshotText,
	CHART_CATEGORY_OPTIONS,
	GODS_PRESET_OPTIONS,
	ANGAN_MODE_OPTIONS,
	JIGONG_MODE_OPTIONS,
	SHIFT_ZHIFU_OPTIONS,
	DAYJIA_JU_OPTIONS,
	KEJIA_FENDUN_OPTIONS,
	JINHAN_MENPAI_OPTIONS,
	YEARJIA_JU_OPTIONS,
} from '../dunjia/DunJiaCalc';
import GeoCoordModal from '../amap/GeoCoordModal';
import SanShiZiWeiSihua, { buildSanShiZiweiSihuaSnapshotLines } from './SanShiZiWeiSihua';
import PlusMinusTime from '../astro/PlusMinusTime';
import DateTime from '../comp/DateTime';
import QuickDockBar from '../common/QuickDockBar';
import SpaceTimePanel from '../comp/SpaceTimePanel';
import { getStore } from '../../utils/storageutil';
import { caseApplySeqSuffix, caseFieldSnapshot, caseGenderValue } from '../../utils/kentangCaseSave';
import { getHousesOption } from '../comp/CompHelper';
import {
	getNongliLocalCache,
	setNongliLocalCache,
} from '../../utils/localCalcCache';
import {
	fetchPreciseNongli,
	fetchPreciseJieqiSeed,
} from '../../utils/preciseCalcBridge';
import {
	TAIYI_STYLE_OPTIONS,
	TAIYI_ACCUM_OPTIONS,
	buildTaiyiSnapshotLines,
} from './core/TaiYiCore';
import { fetchTaiyiPan, buildTaiyiSnapshotText, TIME_BASIS_OPTIONS as TAIYI_TIME_BASIS_OPTIONS } from '../taiyi/TaiYiCalc';   // [Q-107 A] 时间基准选项与独立太乙页同源
import { computeTaiyiShuli, shuliTone } from '../taiyi/core/taiyiShuli';
import { computeGeju } from '../taiyi/core/taiyiGeju';
import { computeVictory, computeFenye, computeShenSuan, computeTaisuiAlias, activeDoorJixiong, computeEhui, computeLimitYun, computeSanyuan, computeShiJing, computeWuziyuan } from '../taiyi/core/taiyiDuanfa';
import { computeTaiyiNayin } from '../taiyi/core/taiyiNayin';
import { applyTaiyiSchool, DEFAULT_TAIYI_SCHOOL, TAIYI_SCHOOL_OPTIONS, normalizeTaiyiSchool } from '../taiyi/core/taiyiSchool';
import { definePageSettings } from '../../utils/pageSettingsStore';
import { appendPlanetHouseInfo, } from '../../utils/planetHouseInfo';
import { buildMeaningTipByCategory, } from '../astro/AstroMeaningData';
import { isMeaningEnabled, wrapWithMeaning, } from '../astro/AstroMeaningPopover';
import { buildLiuRengHouseTipObj, buildLiuRengShenTipObj, } from '../liureng/LRShenJiangDoc';
// [Q-385/T-366] 年神排序 / 土旺衰两档此前在合一页只经 pickSanshiLiurengCastOpts 进 AI 快照,
// 页面无任何落点(帮助却称「与独立页同名同义」「改年神在右栏的排列起点」)。补右栏落点,与独立页同源同函数。
import { computeYearShenSha } from '../liureng/LRShenShaDoc';
import { liurengWangXiang, judgeKongWang } from '../liureng/LRZhangSheng';
import SanshiUnitedBoard from './SanshiUnitedBoard';
// horosa_sanshi_render_slice_v1(S4 残差):共享盘无自带 memo,壳层 props 全引用稳定 ⇒ 浅比隔离盘面重绘。
const MemoSanshiUnitedBoard = memo(SanshiUnitedBoard);
import { matchBiFa, BIFA_LIST } from '../liureng/LRBiFaDoc';
import { buildQimenXiangTipObj, } from '../dunjia/QimenXiangDoc';
import {
	buildLiuRengReferenceBundle,
	buildReferenceDocumentText,
	buildOverviewReferenceText,
	buildLiuRengSnapshotText,
	getYueJiangByMethod,
	XIAO_JU_REFERENCE_TAB_KEYS,
	buildQiZhengItems,
	QIZHENG_PLANET_COLOR,
	QIZHENG_WUXING_COLOR,
} from '../lrzhan/LiuRengMain';
import {
	BAGONG_PALACE_ORDER,
	BAGONG_PALACE_NAME,
	buildQimenBaGongPanelData,
	XUN_SHOU_TO_LIUYI,
} from '../dunjia/DunJiaBaGongRules';
// 遁甲「用神 / 化解」子tab静态显示所需的派生函数与速查数据(对齐独立遁甲页同源)。
import {
	computeYongShen,
	computeGuGua,
	buildJieHua,
	computeDangers,
	computeProtect,
} from '../dunjia/DunJiaFaCalc';
import {
	SAN_FA_TEXT,
	BU_ZHEN_TIPS,
	DANGER_BRIEF,
	GAN_XIANG,
	ZHI_ZODIAC,
	LUOSHU_NUM,
} from '../dunjia/DunJiaFaDoc';
import {
	QIMEN_YONGSHEN_BASIC,
	QIMEN_YONGSHEN_LOOKUP,
	QIMEN_YONGSHEN_SHENGKE,
} from '../dunjia/DunJiaMain';
import styles from './SanShiUnitedMain.less';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../utils/dayBoundary';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { getEffectiveScale, visualFloorPx } from '../../utils/zoomDomain';

const { Option, OptGroup } = Select;
const TabPane = Tabs.TabPane;
const BRANCH_ORDER = '子丑寅卯辰巳午未申酉戌亥'.split('');
const STEM_ORDER = '甲乙丙丁戊己庚辛壬癸'.split('');
const BRANCH_ZODIAC_MAP = {
	子: '水瓶座',
	丑: '摩羯座',
	寅: '射手座',
	卯: '天蝎座',
	辰: '天秤座',
	巳: '处女座',
	午: '狮子座',
	未: '巨蟹座',
	申: '双子座',
	酉: '金牛座',
	戌: '白羊座',
	亥: '双鱼座',
};
const BRANCH_SIGN_ID_MAP = {
	子: AstroConst.AQUARIUS,
	丑: AstroConst.CAPRICORN,
	寅: AstroConst.SAGITTARIUS,
	卯: AstroConst.SCORPIO,
	辰: AstroConst.LIBRA,
	巳: AstroConst.VIRGO,
	午: AstroConst.LEO,
	未: AstroConst.CANCER,
	申: AstroConst.GEMINI,
	酉: AstroConst.TAURUS,
	戌: AstroConst.ARIES,
	亥: AstroConst.PISCES,
};
function normalizeKenQimenOptions(options){
	const next = {
		...(options || {}),
	};
	// 旧数据迁移(对齐独立 DunJiaMain):阴盘曾为「盘式」(school='阴盘'),现为「起局法」(qijuMethod='shuzi',报数定局)。
	if(next.school === '阴盘'){
		next.school = '转盘';
		next.qijuMethod = 'shuzi';
	}
	return next;
}
const SANSHI_PALACE_EXPORT_ORDER = [
	{ title: '正北坎宫', palaceNum: 8, branches: ['子'] },
	{ title: '东北艮宫', palaceNum: 7, branches: ['丑', '寅'] },
	{ title: '正东震宫', palaceNum: 4, branches: ['卯'] },
	{ title: '东南巽宫', palaceNum: 1, branches: ['辰', '巳'] },
	{ title: '正南离宫', palaceNum: 2, branches: ['午'] },
	{ title: '西南坤宫', palaceNum: 3, branches: ['未', '申'] },
	{ title: '正西兑宫', palaceNum: 6, branches: ['酉'] },
	{ title: '西北乾宫', palaceNum: 9, branches: ['戌', '亥'] },
];
const PALACE_GRID = {
	1: { row: 2, col: 2 },
	2: { row: 2, col: 3 },
	3: { row: 2, col: 4 },
	4: { row: 3, col: 2 },
	5: { row: 3, col: 3 },
	6: { row: 3, col: 4 },
	7: { row: 4, col: 2 },
	8: { row: 4, col: 3 },
	9: { row: 4, col: 4 },
};

export const QIMEN_OPTIONS = {
	sex: 1,
	dateType: 0,
	leapMonthType: 0,
	xuShiSuiType: 0,
	jieQiType: 1,
	paiPanType: 3,
	zhiShiType: 0,
	yueJiaQiJuType: 0,
	yearGanZhiType: 2,
	monthGanZhiType: 1,
	dayGanZhiType: 0,
	qijuMethod: 'zhirun',
	kongMode: 'day',
	yimaMode: 'day',
	shiftPalace: 0,
	fengJu: false,
	school: '转盘',
	shuziReportNumber: '',
	zhirunLeapDays: 9,
	chartCategory: 'shi',   // [H-A] 盘类(事局/命局):此前三式完全缺失,挂载齿轮却经 reTagSanshi 暴露=调了不消费
	faRelatedPeople: '',    // [H-A] 相关人员(法奇门必护天干消费):此前三式缺失
	godsPreset: 'baihu_xuanwu',   // [H-B] 八神预设
	anGanMode: 'off',             // [H-B] 暗干五法
	showAnZhi: false,
	jiGongMode: 'kun',
	feiXingShun: false,
	feiMenShun: false,
	feiShenShun: false,
	feiMenZhongCan: true,
	feiMenZhongShow: false,
	mixTian: '',
	mixXing: '',
	mixMen: '',
	mixShen: '',
	kongMarkBoth: false,
	showAllKong: false,
	shiftZhiFuMode: 'follow',
	dayJiaJu: 'yiyuan',
	keJiaFenDun: 'zihou',
	keZiZhengHuanShi: false,
	jinhanMenPai: 'book',
	yearJiaJu: 'sanyuan',
};

export const OUTER_RING_LAYOUT = [
	{ branch: '巳', side: 'top', x0: 11.1, x1: 33.33, y0: 0, y1: 11.1 },
	{ branch: '午', side: 'top', x0: 33.33, x1: 66.67, y0: 0, y1: 11.1 },
	{ branch: '未', side: 'top', x0: 66.67, x1: 88.9, y0: 0, y1: 11.1 },
	{ branch: '申', side: 'right', x0: 88.9, x1: 100, y0: 11.1, y1: 33.33 },
	{ branch: '酉', side: 'right', x0: 88.9, x1: 100, y0: 33.33, y1: 66.67 },
	{ branch: '戌', side: 'right', x0: 88.9, x1: 100, y0: 66.67, y1: 88.9 },
	{ branch: '亥', side: 'bottom', x0: 66.67, x1: 88.9, y0: 88.9, y1: 100 },
	{ branch: '子', side: 'bottom', x0: 33.33, x1: 66.67, y0: 88.9, y1: 100 },
	{ branch: '丑', side: 'bottom', x0: 11.1, x1: 33.33, y0: 88.9, y1: 100 },
	{ branch: '寅', side: 'left', x0: 0, x1: 11.1, y0: 66.67, y1: 88.9 },
	{ branch: '卯', side: 'left', x0: 0, x1: 11.1, y0: 33.33, y1: 66.67 },
	{ branch: '辰', side: 'left', x0: 0, x1: 11.1, y0: 11.1, y1: 33.33 },
];

// 虚实红绿点逐宫定位:贴各地支宫格「朝盘心」一侧——上边内侧=下、下边内侧=上、左边内侧=右、右边内侧=左;
// 每边的中宫(午/子/卯/酉)居中,两侧夹角宫朝该边中心收拢(与用户口径一致)。值为单元格内 CSS 绝对定位。
export const WEAK_SOLID_POS = {
	// 上边(内侧=下):巳→右下、午→居中、未→左下
	'巳': { bottom: 2, right: 3 },
	'午': { bottom: 2, left: '50%', transform: 'translateX(-50%)' },
	'未': { bottom: 2, left: 3 },
	// 右边(内侧=左):申→左下、酉→居中、戌→左上
	'申': { left: 2, bottom: 3 },
	'酉': { left: 2, top: '50%', transform: 'translateY(-50%)' },
	'戌': { left: 2, top: 3 },
	// 下边(内侧=上):亥→左上、子→居中、丑→右上
	'亥': { top: 2, left: 3 },
	'子': { top: 2, left: '50%', transform: 'translateX(-50%)' },
	'丑': { top: 2, right: 3 },
	// 左边(内侧=右):辰→右下、卯→居中、寅→右上
	'寅': { right: 2, top: 3 },
	'卯': { right: 2, top: '50%', transform: 'translateY(-50%)' },
	'辰': { right: 2, bottom: 3 },
};

export const LIURENG_RING_LAYOUT = {
	// 四正位：放在六壬环四边中央（合并后的主宫位）
	午: { left: '50%', top: '27.8%', kind: 'cardinal' },
	酉: { left: '72.2%', top: '50%', kind: 'cardinal' },
	子: { left: '50%', top: '72.2%', kind: 'cardinal' },
	卯: { left: '27.8%', top: '50%', kind: 'cardinal' },

	// 四角八三角：落点使用各三角形重心，确保文字在三角区域内
	巳: { left: '29.6%', top: '25.9%', kind: 'corner' }, // 西北角-上三角
	辰: { left: '25.9%', top: '29.6%', kind: 'corner' }, // 西北角-下三角

	未: { left: '70.4%', top: '25.9%', kind: 'corner' }, // 东北角-上三角
	申: { left: '74.1%', top: '29.6%', kind: 'corner' }, // 东北角-下三角

	戌: { left: '74.1%', top: '70.4%', kind: 'corner' }, // 东南角-上三角
	亥: { left: '70.4%', top: '74.1%', kind: 'corner' }, // 东南角-下三角

	丑: { left: '29.6%', top: '74.1%', kind: 'corner' }, // 西南角-下三角
	寅: { left: '25.9%', top: '70.4%', kind: 'corner' }, // 西南角-上三角
};

// needJieqiYearSeed 已收编到 DunJiaCalc(独立页/三式/择日单源;[Q-155] 此前三式只认「时家+置闰」→ 日家/金函/飞混茅山无闰/刻家不取种子局错)。

export const QIMEN_RING_POSITIONS = {
	1: { left: '16.7%', top: '16.7%' },
	2: { left: '50%', top: '16.7%' },
	3: { left: '83.3%', top: '16.7%' },
	4: { left: '16.7%', top: '50%' },
	6: { left: '83.3%', top: '50%' },
	7: { left: '16.7%', top: '83.3%' },
	8: { left: '50%', top: '83.3%' },
	9: { left: '83.3%', top: '83.3%' },
};
export const QIMEN_CORNER_PALACES = new Set([1, 3, 7, 9]);

const MAIN_STAR_IDS = new Set([
	AstroConst.SUN,
	AstroConst.MOON,
	AstroConst.MERCURY,
	AstroConst.VENUS,
	AstroConst.MARS,
	AstroConst.JUPITER,
	AstroConst.SATURN,
	AstroConst.URANUS,
	AstroConst.NEPTUNE,
	AstroConst.PLUTO,
	AstroConst.ASC,
	AstroConst.MC,
]);

const GAME_TYPE_OPTIONS = [
	{ value: 'ming', label: '命局' },
	{ value: 'shi', label: '事局' },
];

const TIME_ALG_OPTIONS = [
	{ value: 0, label: '真太阳时' },
	{ value: 1, label: '直接时间' },
];

const SEX_OPTIONS = [
	{ value: 1, label: '男' },
	{ value: 0, label: '女' },
];

const GUIRENG_OPTIONS = [
	{ value: 0, label: '六壬法贵人' },
	{ value: 1, label: '遁甲法贵人' },
	{ value: 2, label: '星占法贵人' },
	{ value: 3, label: '甲戊兼牛羊' },
	{ value: 4, label: '干合阳阴贵' },
];

// 大六壬流派(对齐独立 lrzhan/LiuRengMain 的「断卦设置」;默认值=现行行为,零回归)。
// 换将三派/分昼夜三派/涉害取舍·起讫·始入(默认法)/年神排序/昼夜阳阴归属/土旺衰。
const LR_YUEJIANG_OPTIONS = [
	{ value: 'zhongqi', label: '中气过宫（默认）' },
	{ value: 'jieqi', label: '节气换将' },
	{ value: 'richan', label: '太阳过宫·日躔（含岁差）' },
];
const LR_FENZHOUYE_OPTIONS = [
	{ value: 'chenhun', label: '晨昏分昼夜（默认）' },
	{ value: 'maoyou', label: '卯酉分昼夜' },
	{ value: 'yinshen', label: '寅申分昼夜' },
];
const LR_SEHAI_METHOD_OPTIONS = [
	{ value: 'app', label: '仅下贼上(默认)' },
	{ value: 'standard', label: '标准深浅两向' },
	{ value: 'mengzhongji', label: '直取孟仲季' },
];
const LR_SEHAI_BOUNDARY_OPTIONS = [
	{ value: 'app', label: '计起点不计本家(默认)' },
	{ value: 'both', label: '两端皆计' },
	{ value: 'neither', label: '皆不计' },
];
const LR_SHIRUKE_OPTIONS = [
	{ value: 0, label: '并入重审(默认)' },
	{ value: 1, label: '单列·九法变十法' },
];
const LR_YEAR_SHENSHA_OPTIONS = [
	{ value: 'sanyuan', label: '四利三元序(默认)' },
	{ value: 'suigui', label: '太岁排轮(太阴异)' },
];
const LR_YINYANG_SYSTEM_OPTIONS = [
	{ value: 'danmu', label: '旦暮系(默认)' },
	{ value: 'yinyang', label: '星历阳阴系' },
];
const LR_TUWANG_OPTIONS = [
	{ value: 'siji', label: '四季月土旺(默认)' },
	{ value: 'huotu', label: '火土同宫(土随火)' },
];

// 奇门封局(对齐独立 dunjia/DunJiaMain;默认未封局=零回归)。
const QIMEN_FENGJU_OPTIONS = [
	{ value: 0, label: '未封局' },
	{ value: 1, label: '已封局' },
];

// 排盘设置跨会话保留(用户实报:排盘设置改了之后每次重开软件都要重设)。三式合一与独立六壬 / 奇门 / 太乙同改(三式同步铁律):
// 奇门层、太乙层、六壬层的口径 / 流派 / 显示偏好全收。不进的:模式与盘类(这盘是命局还是事局,逐盘)、性别(随命主)、
// 报数 / 法奇门相关人(每课输入)、移星 / 封局(逐盘操作)、23 点换日 / 晚子时(归全局设置管)、黄道 / 分宫制(跨页共享的星盘字段)。
// 「时间算法」没保存过时照旧跟随共享字段现值(loadSaved 只给确实保存过的键)。
// 只在用户亲手改控件时落盘:事盘回灌 / 宿主下发 / 全局广播都不落盘。
// 🔴 只有**独立三式页**读写这份保存值;三式择日里内嵌的那份既不读也不写(见 usesSavedSettings):择日工作台只下发它自己定义过的键、
// 其余按扫描引擎缺省判,内嵌盘若继承了独立页保存的盘式 / 排盘 / 太乙盘式 / 涉害口径,点选命中行看到的盘就不是扫描判定的那一盘。
const optVals = (list)=>list.map((o)=>o.value);
export const SANSHI_PAGE_SETTINGS = definePageSettings('horosa.sanshi.settings.v1', {
	timeAlg: { def: 0, oneOf: optVals(TIME_ALG_OPTIONS) },
	guireng: { def: 2, oneOf: optVals(GUIRENG_OPTIONS) },
	// 奇门层
	paiPanType: { def: 3, oneOf: optVals(PAIPAN_OPTIONS) },
	zhiShiType: { def: 0, oneOf: optVals(ZHISHI_OPTIONS) },
	yueJiaQiJuType: { def: 0, oneOf: optVals(YUEJIA_QIJU_OPTIONS) },
	qijuMethod: { def: 'zhirun', oneOf: optVals(QIJU_METHOD_OPTIONS) },   // 候选随排盘体例增减(时家 / 刻家 5 档,其余 2 档),全集固定
	school: { def: '转盘', oneOf: optVals(SCHOOL_OPTIONS) },
	kongMode: { def: 'day', oneOf: optVals(KONG_MODE_OPTIONS) },
	yimaMode: { def: 'day', oneOf: optVals(MA_MODE_OPTIONS) },
	zhirunLeapDays: { def: 9, oneOf: optVals(ZHIRUN_LEAP_OPTIONS) },
	godsPreset: { def: 'baihu_xuanwu', oneOf: optVals(GODS_PRESET_OPTIONS) },
	jiGongMode: { def: 'kun', oneOf: optVals(JIGONG_MODE_OPTIONS) },
	anGanMode: { def: 'off', oneOf: optVals(ANGAN_MODE_OPTIONS) },
	shiftZhiFuMode: { def: 'follow', oneOf: optVals(SHIFT_ZHIFU_OPTIONS) },
	yearJiaJu: { def: 'sanyuan', oneOf: optVals(YEARJIA_JU_OPTIONS) },
	dayJiaJu: { def: 'yiyuan', oneOf: optVals(DAYJIA_JU_OPTIONS) },
	keJiaFenDun: { def: 'zihou', oneOf: optVals(KEJIA_FENDUN_OPTIONS) },
	jinhanMenPai: { def: 'book', oneOf: optVals(JINHAN_MENPAI_OPTIONS) },
	mixTian: { def: '', oneOf: ['', 'zhuan', 'fei'] },
	mixXing: { def: '', oneOf: ['', 'zhuan', 'fei'] },
	mixMen: { def: '', oneOf: ['', 'zhuan', 'fei'] },
	mixShen: { def: '', oneOf: ['', 'zhuan', 'fei'] },
	feiXingShun: { def: false },
	feiMenShun: { def: false },
	feiShenShun: { def: false },
	feiMenZhongCan: { def: true },
	feiMenZhongShow: { def: false },
	kongMarkBoth: { def: false },
	showAllKong: { def: false },
	keZiZhengHuanShi: { def: false },
	showAnZhi: { def: false },
	// 太乙层
	taiyiStyle: { def: 3, oneOf: optVals(TAIYI_STYLE_OPTIONS) },
	taiyiAccum: { def: 0, oneOf: optVals(TAIYI_ACCUM_OPTIONS) },
	taiyiTimeBasis: { def: 'direct', oneOf: optVals(TAIYI_TIME_BASIS_OPTIONS) },
	gameTheory: { def: 0, oneOf: [0, 1] },
	taiyiSchool: { type: 'map', keys: Object.keys(DEFAULT_TAIYI_SCHOOL).reduce((acc, k)=>{
		acc[k] = { def: DEFAULT_TAIYI_SCHOOL[k], oneOf: (TAIYI_SCHOOL_OPTIONS[k] || []).map((o)=>o.value) };
		return acc;
	}, {}) },
	// 六壬层
	yueJiangMethod: { def: 'zhongqi', oneOf: optVals(LR_YUEJIANG_OPTIONS) },
	fenZhouYe: { def: 'chenhun', oneOf: optVals(LR_FENZHOUYE_OPTIONS) },
	seHaiMethod: { def: 'app', oneOf: optVals(LR_SEHAI_METHOD_OPTIONS) },
	seHaiBoundary: { def: 'app', oneOf: optVals(LR_SEHAI_BOUNDARY_OPTIONS) },
	shiRuKe: { def: false },
	yearShenShaSort: { def: 'sanyuan', oneOf: optVals(LR_YEAR_SHENSHA_OPTIONS) },
	yinyangSystem: { def: 'danmu', oneOf: optVals(LR_YINYANG_SYSTEM_OPTIONS) },
	tuWangShuai: { def: 'siji', oneOf: optVals(LR_TUWANG_OPTIONS) },
	// 外圈两项不在 options 里,是组件自己的 state(控件直接绑 this.state.X)
	outerCoord: { def: 'ecliptic', oneOf: ['ecliptic', 'equatorial'] },
	showWeakSolid: { def: true },
});

// 🔴 改值即强制重算的「计算型」option key 全集(三式合一各子盘的盘面计算输入)。
// 这些 key 都已被 recalcSignature(performRecalcByNongli)消费(经 getQimenOptions / getKintaiyiPan / 六壬 castOverride),
// 但 refreshAll 的轻量 lastKey 不含它们 → 必须在 onOptionChange 显式 refreshAll(force) 才会真重算重画。
// after23NewDay/lateZiHourUseNextDay 已在上方单独处理(还要 prefetch),故不入本集;mode(命局/事局)只管保存去向(命盘/事盘),不改盘,亦不入。[Q-164/T-90·SS-22⑥]
const SANSHI_RECALC_OPTION_KEYS = new Set([
	// 奇门(经 getQimenOptions + fetchQimenPan/calcDunJia)
	'paiPanType', 'zhiShiType', 'yueJiaQiJuType', 'qijuMethod', 'kongMode', 'yimaMode', 'shiftPalace',
	'school', 'shuziReportNumber', 'fengJu', 'zhirunLeapDays', 'chartCategory', 'faRelatedPeople',
	'godsPreset', 'anGanMode', 'showAnZhi', 'jiGongMode',
	'feiXingShun', 'feiMenShun', 'feiShenShun', 'feiMenZhongCan', 'feiMenZhongShow',
	'mixTian', 'mixXing', 'mixMen', 'mixShen',
	'kongMarkBoth', 'showAllKong', 'shiftZhiFuMode',
	'dayJiaJu', 'keJiaFenDun', 'keZiZhengHuanShi',
	'jinhanMenPai',
	'yearJiaJu',
	// 太乙(经 getKintaiyiPan + applyTaiyiSchool)
	'taiyiStyle', 'taiyiAccum', 'taiyiSchool', 'gameTheory', 'taiyiTimeBasis',   // [Q-107 A] 太乙时间基准(与独立太乙页同源选项)
	// 大六壬(经 guirengType + buildSanshiLiuRengCastOverride)
	'guireng', 'yueJiangMethod', 'fenZhouYe', 'seHaiMethod', 'seHaiBoundary', 'shiRuKe',
	'yearShenShaSort', 'yinyangSystem', 'tuWangShuai',
]);

// 用户语义(拍板,字面直觉版): after23NewDay=1「23点算第二天」=日柱进位次日(壬寅)；=0「24点算第二天」=日柱守今(辛丑)。
const DAY_SWITCH_OPTIONS = [
	{ value: 1, label: '23点算第二天' },
	{ value: 0, label: '24点算第二天' },
];


const SANSHI_BOARD_MIN = 380;
const SANSHI_BOARD_MAX = 820;
const SANSHI_FAST_BUDGET_MS = 2200;
const SANSHI_RECALC_DEFER_MS = 28;
const SANSHI_SNAPSHOT_DEFER_MS = 120;
const AI_EXPORT_PLANET_INFO = {
	showHouse: 1,
	showRuler: 1,
};

export function clamp(val, min, max){
	return Math.max(min, Math.min(max, val));
}

function getViewportHeight(){
	// 🔴 innerHeight/documentElement.clientHeight 恒报物理域;壳缩放≠1 时当布局高用会
	// 把整页配矮(底部死带)。走 getLayoutViewportHeight —— 它**直接量** fixed 铺满元素,
	// 不做任何缩放换算,故与引擎的 zoom 语义无关(2026-08-27 根修,见 zoomDomain)。
	if(typeof window !== 'undefined' && Number.isFinite(window.innerHeight) && window.innerHeight > 0){
		return getLayoutViewportHeight();
	}
	if(typeof document !== 'undefined' && document.documentElement){
		return document.documentElement.clientHeight || 900;
	}
	return 900;
}

export function safe(v, d = ''){
	return v === undefined || v === null ? d : v;
}

function normalizeTimeAlg(value){
	return value === 1 ? 1 : 0;
}

function getTimeAlgLabel(value){
	return normalizeTimeAlg(value) === 1 ? '直接时间' : '真太阳时';
}

function parseZoneOffsetHour(zone){
	const text = `${safe(zone, '')}`.trim();
	if(!text){
		return null;
	}
	const mStd = text.match(/^([+-])(\d{1,2})(?::?(\d{2}))?$/);
	if(mStd){
		const sign = mStd[1] === '-' ? -1 : 1;
		const hh = parseInt(mStd[2], 10);
		const mm = parseInt(mStd[3] || '0', 10);
		if(!Number.isNaN(hh) && !Number.isNaN(mm)){
			return sign * (hh + mm / 60);
		}
	}
	const mUtc = text.match(/^(?:UTC|GMT)\s*([+-])(\d{1,2})(?::?(\d{2}))?$/i);
	if(mUtc){
		const sign = mUtc[1] === '-' ? -1 : 1;
		const hh = parseInt(mUtc[2], 10);
		const mm = parseInt(mUtc[3] || '0', 10);
		if(!Number.isNaN(hh) && !Number.isNaN(mm)){
			return sign * (hh + mm / 60);
		}
	}
	const mCn = text.match(/^([东西])\s*(\d{1,2})(?:[:：]?(\d{1,2}))?\s*区?$/);
	if(mCn){
		const sign = mCn[1] === '西' ? -1 : 1;
		const hh = parseInt(mCn[2], 10);
		const mm = parseInt(mCn[3] || '0', 10);
		if(!Number.isNaN(hh) && !Number.isNaN(mm)){
			return sign * (hh + mm / 60);
		}
	}
	const numeric = Number(text);
	if(Number.isFinite(numeric)){
		return numeric;
	}
	return null;
}

function formatZoneOffset(zoneHour){
	if(zoneHour === undefined || zoneHour === null || Number.isNaN(zoneHour)){
		return '+08:00';
	}
	const sign = zoneHour < 0 ? '-' : '+';
	const abs = Math.abs(zoneHour);
	let hh = Math.floor(abs);
	let mm = Math.round((abs - hh) * 60);
	if(mm >= 60){
		hh += 1;
		mm -= 60;
	}
	return `${sign}${`${hh}`.padStart(2, '0')}:${`${mm}`.padStart(2, '0')}`;
}

function normalizeZoneOffset(zone, fallback = '+08:00'){
	const parsed = parseZoneOffsetHour(zone);
	if(parsed === null || Number.isNaN(parsed)){
		const fbParsed = parseZoneOffsetHour(fallback);
		return formatZoneOffset(fbParsed === null || Number.isNaN(fbParsed) ? 8 : fbParsed);
	}
	return formatZoneOffset(parsed);
}

function normalizeAdValue(ad, fallback = 1){
	const text = `${safe(ad, '')}`.trim().toUpperCase();
	if(text === 'BC' || text === 'BCE'){
		return -1;
	}
	if(text === 'AD' || text === 'CE'){
		return 1;
	}
	const n = parseInt(text, 10);
	if(!Number.isNaN(n) && n !== 0){
		return n > 0 ? 1 : -1;
	}
	return fallback === -1 ? -1 : 1;
}

function resolveCalcGeo(fields, options){
	const lon = safe(fields && fields.lon && fields.lon.value, '');
	const lat = safe(fields && fields.lat && fields.lat.value, '');
	const gpsLon = safe(fields && fields.gpsLon && fields.gpsLon.value, '');
	const gpsLat = safe(fields && fields.gpsLat && fields.gpsLat.value, '');
	// timeAlg 仅用于“计算基准”切换，不应改写显示真太阳时所依赖的地理位置。
	return { lon, lat, gpsLon, gpsLat };
}

function buildDisplaySolarParams(params){
	if(!params){
		return null;
	}
	return {
		...params,
		timeAlg: 0,
	};
}

function timeoutResolve(ms, value = null){
	return new Promise((resolve)=>{
		setTimeout(()=>resolve(value), ms);
	});
}

const TIANJIANG_SHORT_MAP = {
	贵人: '贵',
	螣蛇: '蛇',
	腾蛇: '蛇',
	朱雀: '朱',
	六合: '合',
	勾陈: '勾',
	青龙: '龙',
	天空: '空',
	白虎: '虎',
	太常: '常',
	玄武: '玄',
	太阴: '阴',
	天后: '后',
};

export function shortTianJiang(name){
	const text = `${safe(name, '')}`.trim();
	if(!text){
		return '—';
	}
	if(TIANJIANG_SHORT_MAP[text]){
		return TIANJIANG_SHORT_MAP[text];
	}
	if(text.length === 1){
		return text;
	}
	if(text.startsWith('天') || text.startsWith('太')){
		return text.substring(text.length - 1);
	}
	return text.substring(0, 1);
}

export function splitGanZhi(gz){
	const text = `${safe(gz, '')}`.trim();
	if(!text){
		return { gan: '', zhi: '—' };
	}
	const chars = text.split('');
	const first = chars[0] || '';
	const last = chars[chars.length - 1] || '';
	const hasGan = LRConst.GanList.indexOf(first) >= 0;
	return {
		gan: hasGan ? first : '',
		zhi: last || '—',
	};
}

export function getGanzhiParts(gz){
	return {
		gan: (gz || '').substring(0, 1) || ' ',
		zhi: (gz || '').substring(1, 2) || ' ',
	};
}

function parseSolarDateTime(rawText){
	const text = `${safe(rawText, '')}`.trim();
	if(!text){
		return null;
	}
	const normalized = text.replace('T', ' ').replace('Z', '').trim();
	const m = normalized.match(/([-+]?\d{1,6})[/-](\d{1,2})[/-](\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
	if(!m){
		return {
			date: text,
			hm: '',
			hms: '',
			raw: text,
			isSolar: true,
		};
	}
	const yyyy = m[1];
	const mm = `${m[2]}`.padStart(2, '0');
	const dd = `${m[3]}`.padStart(2, '0');
	const hh = `${m[4]}`.padStart(2, '0');
	const ss = `${m[6] || '00'}`.padStart(2, '0');
	return {
		date: `${yyyy}-${mm}-${dd}`,
		hm: `${hh}:${m[5]}`,
		hms: `${hh}:${m[5]}:${ss}`,
		raw: text,
		isSolar: true,
	};
}

export function fmtDirect(fields){
	if(!fields || !fields.date || !fields.time){
		return { date: '', hm: '', hms: '' };
	}
	return {
		date: fields.date.value.format('YYYY-MM-DD'),
		hm: fields.time.value.format('HH:mm'),
		hms: fields.time.value.format('HH:mm:ss'),
	};
}

export function fmtSolar(fields, pan, nongli, displaySolarTime){
	const solarParsed = parseSolarDateTime(
		safe(displaySolarTime, '') || safe(pan && pan.realSunTime, '') || safe(nongli && nongli.birth, '')
	);
	if(solarParsed){
		return solarParsed;
	}
	const direct = fmtDirect(fields);
	return {
		date: direct.date,
		hm: direct.hm,
		hms: direct.hms,
		raw: '',
		isSolar: false,
	};
}

export function fmtLunar(nongli){
	if(!nongli){
		return '';
	}
	return `农历${safe(nongli.month)}${safe(nongli.day)}`;
}

function msg(key){
	return AstroText.AstroMsgCN[key] || key || '';
}

function shortMainStarLabel(name){
	const text = `${safe(name, '')}`.trim();
	if(!text){
		return '';
	}
	if(text === '太阳'){
		return '日';
	}
	if(text === '上升'){
		return '升';
	}
	if(text === '天顶' || text === '中天'){
		return '顶';
	}
	return text.substring(0, 1);
}

function getFieldKey(fields){
	if(!fields || !fields.date || !fields.time){
		return '';
	}
	return [
		fields.date.value.format('YYYY-MM-DD'),
		fields.time.value.format('HH:mm:ss'),
		safe(fields.zone && fields.zone.value),
		safe(fields.lon && fields.lon.value),
		safe(fields.lat && fields.lat.value),
		safe(fields.ad && fields.ad.value),
	].join('|');
}

function getFieldSyncKey(fields){
	if(!fields){
		return '';
	}
	return [
		getFieldKey(fields),
		safe(fields.cid && fields.cid.value),
		safe(fields.name && fields.name.value),
		safe(fields.gender && fields.gender.value),
		safe(fields.zodiacal && fields.zodiacal.value),
		safe(fields.hsys && fields.hsys.value),
		safe(fields.timeAlg && fields.timeAlg.value),
	].join('|');
}

function getNongliKey(nongli){
	if(!nongli){
		return '';
	}
	return [
		safe(nongli.yearGanZi),
		safe(nongli.monthGanZi),
		safe(nongli.dayGanZi),
		safe(nongli.time),
		safe(nongli.jieqi),
		safe(nongli.runyear),
	].join('|');
}

function getQimenOptionsKey(options){
	if(!options){
		return '';
	}
	return [
		safe(options.sex),
		safe(options.dateType),
		safe(options.leapMonthType),
		safe(options.xuShiSuiType),
		safe(options.jieQiType),
		safe(options.paiPanType),
		safe(options.zhiShiType),
		safe(options.yueJiaQiJuType),
		safe(options.yearGanZhiType),
		safe(options.monthGanZhiType),
		safe(options.dayGanZhiType),
		safe(options.after23NewDay),
		safe(options.lateZiHourUseNextDay),
		safe(options.qijuMethod),
		safe(options.kongMode),
		safe(options.yimaMode),
		safe(options.shiftPalace),
		options.fengJu ? 1 : 0,
		safe(options.school),
		safe(options.shuziReportNumber),
		safe(options.zhirunLeapDays),
		// [H-H] 🔴 同独立页:缓存键维度完备,新引擎键全入(漏=三式改档死开关)。哨兵测试守。
		safe(options.godsPreset),
		safe(options.jiGongMode),
		safe(options.anGanMode),
		options.showAnZhi ? 1 : 0,
		options.fullNameTips ? 1 : 0,
		options.feiXingShun ? 1 : 0,
		options.feiMenShun ? 1 : 0,
		options.feiShenShun ? 1 : 0,
		options.feiMenZhongCan === false ? 0 : 1,
		options.feiMenZhongShow ? 1 : 0,
		safe(options.mixTian),
		safe(options.mixXing),
		safe(options.mixMen),
		safe(options.mixShen),
		options.kongMarkBoth ? 1 : 0,
		options.showAllKong ? 1 : 0,
		safe(options.shiftZhiFuMode),
		safe(options.dayJiaJu),
		safe(options.keJiaFenDun),
		options.keZiZhengHuanShi ? 1 : 0,
		safe(options.jinhanMenPai),
		safe(options.yearJiaJu),
	].join('|');
}

export function extractIsDiurnalFromChartWrap(chartWrap){
	if(!chartWrap){
		return null;
	}
	const chart = chartWrap.chart ? chartWrap.chart : chartWrap;
	if(chart && chart.isDiurnal !== undefined && chart.isDiurnal !== null){
		return !!chart.isDiurnal;
	}
	return null;
}

export function getChartYue(chartObj){
	if(!chartObj || !chartObj.objects){
		return '';
	}
	for(let i=0; i<chartObj.objects.length; i++){
		const obj = chartObj.objects[i];
		if(obj.id === AstroConst.SUN){
			return LRConst.getSignZi(obj.sign);
		}
	}
	return '';
}

export function getOuterChartKey(chartWrap){
	if(!chartWrap){
		return '';
	}
	const chart = chartWrap.chart ? chartWrap.chart : chartWrap;
	if(!chart){
		return '';
	}
	// 🔴 **绝不纳入 chartId**:它是 model 里 `Result.chartId = randomStr(8)` 每次取盘现生成的随机值,
	// 拿它当「盘内容是否变化」的判据两头不讨好——同一时刻重复回流也判「变了」(每次都全量重算,
	// 含 /qimen/pan 与 /taiyi/pan,性能白掉),而真正该判变的维度反而没被表征。
	// 内容判据用下面几项就够且稳:ASC/SUN 的 sign|signlon|lon(逐分钟即变,四分钟步进必变)
	// + 日干支 + 时辰 + 天体数。配合 componentDidUpdate 里去掉 awaitingChartSync 闸门,才形成
	// 「chartObj 一变就校正、没实质变就 no-op」的闭环(horosa_sanshi_outer_follow_time_v1)。
	const objs = chart.objects || [];
	let ascKey = '';
	let sunKey = '';
	for(let i=0; i<objs.length; i++){
		const obj = objs[i];
		if(!obj){
			continue;
		}
		if(!ascKey && obj.id === AstroConst.ASC){
			ascKey = `${safe(obj.sign)}|${safe(obj.signlon)}|${safe(obj.lon)}`;
		}
		if(!sunKey && obj.id === AstroConst.SUN){
			sunKey = `${safe(obj.sign)}|${safe(obj.signlon)}|${safe(obj.lon)}`;
		}
		if(ascKey && sunKey){
			break;
		}
	}
	return [
		ascKey,
		sunKey,
		safe(chart.nongli && chart.nongli.dayGanZi),
		safe(chart.nongli && chart.nongli.time),
		`${objs.length}`,
	].join('|');
}

function computeSanshiFenZhouYe(fenZhouYe, chartObj){
	if(fenZhouYe !== 'maoyou' && fenZhouYe !== 'yinshen'){
		return undefined;
	}
	if(!chartObj || !chartObj.nongli || !chartObj.nongli.time){
		return undefined;
	}
	const timezi = chartObj.nongli.time.substr(1);
	const dayBranches = fenZhouYe === 'maoyou'
		? ['卯', '辰', '巳', '午', '未', '申']
		: ['寅', '卯', '辰', '巳', '午', '未'];
	return dayBranches.indexOf(timezi) >= 0;
}

// 汇总 大六壬流派(换将/分昼夜/涉害取舍/昼夜阳阴归属)→ castOverride;全默认返回 null(零回归)。
// 与独立 lrzhan/buildLiuRengCastOverride 同款语义(三式合一只支持「正时正将」起课法,不含 25 起课变体)。
// [挂载自检 三式 P0] 三式合一 → 六壬断卦层的 castOpts 形态(与 buildLiuRengSnapshotText 第 8 参同键;三式锁正时正将)。
export function pickSanshiLiurengCastOpts(opts, nongli){
	const o = opts && typeof opts === 'object' ? opts : {};
	const solarYear = Number(o.solarYear) || (nongli && Number(nongli.solarYear)) || undefined;
	return {
		castMethod: 'zheng',
		yueJiangMethod: o.yueJiangMethod,
		fenZhouYe: o.fenZhouYe,
		seHaiMethod: o.seHaiMethod,
		seHaiBoundary: o.seHaiBoundary,
		shiRuKe: o.shiRuKe,
		yinyangSystem: o.yinyangSystem,
		yearShenShaSort: o.yearShenShaSort,
		tuWangShuai: o.tuWangShuai,
		zhanCategory: o.zhanCategory,
		...(solarYear ? { solarYear } : {}),
	};
}

export function buildSanshiLiuRengCastOverride(chartObj, opts){
	opts = opts || {};
	if(!chartObj || !chartObj.nongli){
		return null;
	}
	const yueJiangMethod = opts.yueJiangMethod || 'zhongqi';
	const fenZhouYe = opts.fenZhouYe || 'chenhun';
	const isDiurnal = computeSanshiFenZhouYe(fenZhouYe, chartObj);
	const seHaiOpts = {
		method: opts.seHaiMethod || 'app',
		boundary: opts.seHaiBoundary || 'app',
		shiRuKe: !!opts.shiRuKe,
	};
	const seHaiDefault = seHaiOpts.method === 'app' && seHaiOpts.boundary === 'app' && !seHaiOpts.shiRuKe;
	const yinyangSystem = opts.yinyangSystem === 'yinyang' ? 'yinyang' : 'danmu';
	const yearShenShaSort = opts.yearShenShaSort || 'sanyuan'; // 年神排序(默认四利三元序);三式合一原 override 漏传→六壬子盘 AI 快照年神恒默认
	const tuWangShuai = opts.tuWangShuai || 'siji'; // 三传旺衰(默认四季月土旺)
	const allDefault = yueJiangMethod !== 'jieqi' && yueJiangMethod !== 'richan'
		&& isDiurnal === undefined && seHaiDefault && yinyangSystem === 'danmu'
		&& yearShenShaSort === 'sanyuan' && tuWangShuai === 'siji';
	if(allDefault){
		return null;
	}
	const solarYear = Number(opts.solarYear) || (chartObj.nongli && Number(chartObj.nongli.solarYear)) || undefined;
	const yueEff = getYueJiangByMethod(chartObj, yueJiangMethod, solarYear);
	return { yue: yueEff, isDiurnal, seHaiOpts, yinyangSystem, yearShenShaSort, tuWangShuai };
}

export function buildLiuRengLayout(chartObj, guirengType, castOverride){
	if(!chartObj || !chartObj.nongli || !chartObj.nongli.time){
		return null;
	}
	const yue = (castOverride && castOverride.yue) || getChartYue(chartObj);
	if(!yue){
		return null;
	}
	const downZi = LRConst.ZiList.slice(0);
	const upZi = LRConst.ZiList.slice(0);
	const yueIndexs = [];
	const timezi = chartObj.nongli.time.substr(1);
	const yueIdx = LRConst.ZiList.indexOf(yue);
	const tmIdx = LRConst.ZiList.indexOf(timezi);
	if(yueIdx < 0 || tmIdx < 0){
		return null;
	}
	const delta = yueIdx - tmIdx;
	for(let i=0; i<12; i++){
		const idx = (i + delta + 12) % 12;
		yueIndexs[i] = idx;
		upZi[i] = LRConst.ZiList[idx];
	}

	const houseTianJiang = LRConst.TianJiang.slice(0);
	const guizi = LRConst.getGuiZi(
		chartObj,
		guirengType === undefined ? 2 : guirengType,
		castOverride ? castOverride.isDiurnal : undefined,
		castOverride ? castOverride.yinyangSystem : undefined
	);
	let houseidx = 0;
	for(let i=0; i<12; i++){
		const zi = LRConst.ZiList[yueIndexs[i]];
		if(zi === guizi){
			houseidx = i;
			break;
		}
	}
	const housezi = LRConst.ZiList[houseidx];
	if(LRConst.SummerZiList.indexOf(housezi) >= 0){
		for(let i=0; i<12; i++){
			const idx = (houseidx - i + 12) % 12;
			houseTianJiang[i] = LRConst.TianJiang[idx];
		}
	}else{
		for(let i=0; i<12; i++){
			const idx = (i - houseidx + 12) % 12;
			houseTianJiang[i] = LRConst.TianJiang[idx];
		}
	}
	return { yue, timezi, guizi, downZi, upZi, houseTianJiang };
}

export function buildLrNongli(nongli, dunjia){
	const dayGanZi = dunjia && dunjia.ganzhi ? (dunjia.ganzhi.day || '') : '';
	const timeGanZi = dunjia && dunjia.ganzhi ? (dunjia.ganzhi.time || '') : '';
	return {
		...(nongli || {}),
		dayGanZi: dayGanZi || (nongli && nongli.dayGanZi ? nongli.dayGanZi : ''),
		time: timeGanZi || (nongli && nongli.time ? nongli.time : ''),
	};
}

export function buildKeData(layout, chartObj){
	const result = { raw: [], lines: [] };
	if(!layout || !chartObj || !chartObj.nongli || !chartObj.nongli.dayGanZi){
		return result;
	}
	const dayGanZi = chartObj.nongli.dayGanZi;
	const daygan = dayGanZi.substr(0, 1);
	const dayzi = dayGanZi.substr(1, 1);

	const idx1 = layout.downZi.indexOf(LRConst.GanJiZi[daygan]);
	if(idx1 < 0){
		return result;
	}
	const ke1zi = layout.upZi[idx1];
	const ke1 = [layout.houseTianJiang[idx1], ke1zi, daygan];

	const idx2 = layout.downZi.indexOf(ke1zi);
	const ke2zi = idx2 >= 0 ? layout.upZi[idx2] : '';
	const ke2 = [idx2 >= 0 ? layout.houseTianJiang[idx2] : '', ke2zi, ke1zi];

	const idx3 = layout.downZi.indexOf(dayzi);
	const ke3zi = idx3 >= 0 ? layout.upZi[idx3] : '';
	const ke3 = [idx3 >= 0 ? layout.houseTianJiang[idx3] : '', ke3zi, dayzi];

	const idx4 = layout.downZi.indexOf(ke3zi);
	const ke4zi = idx4 >= 0 ? layout.upZi[idx4] : '';
	const ke4 = [idx4 >= 0 ? layout.houseTianJiang[idx4] : '', ke4zi, ke3zi];

	result.raw = [ke1, ke2, ke3, ke4];
	// [Q-153] 标签与 raw 同序(ke1=一课 日干上神 … ke4=四课);此前 四→一 反标(无消费方,顺手对齐防再被引用)。
	result.lines = [
		`一课 ${ke1[2]}${ke1[1]}${ke1[0]}`,
		`二课 ${ke2[2]}${ke2[1]}${ke2[0]}`,
		`三课 ${ke3[2]}${ke3[1]}${ke3[0]}`,
		`四课 ${ke4[2]}${ke4[1]}${ke4[0]}`,
	];
	return result;
}

export function buildSanChuan(layout, keRaw, chartObj, castOverride){
	if(!layout || !keRaw || keRaw.length !== 4 || !chartObj || !chartObj.nongli){
		return null;
	}
	try{
		const helper = new ChuangChart({
			owner: null,
			chartObj: chartObj,
			nongli: chartObj.nongli,
			ke: keRaw,
			// 涉害取舍流派(默认 null=仅下贼上,已固定,零回归);非默认时携 seHaiOpts 影响涉害课取用。
			seHaiOpts: castOverride ? castOverride.seHaiOpts : null,
			liuRengChart: {
				upZi: layout.upZi,
				downZi: layout.downZi,
				houseTianJiang: layout.houseTianJiang,
			},
			x: 0,
			y: 0,
			width: 0,
			height: 0,
		});
		helper.genCuangs();
		return helper.cuangs || null;
	}catch(e){
		return null;
	}
}

function normalizeLon(v){
	let lon = parseFloat(v);
	if(Number.isNaN(lon)){
		return null;
	}
	lon = ((lon % 360) + 360) % 360;
	return lon;
}

function lonToBranch(lon){
	const nlon = normalizeLon(lon);
	if(nlon === null){
		return '';
	}
	// 星座-地支固定映射：
	// 水瓶-子、摩羯-丑、射手-寅、天蝎-卯、天秤-辰、处女-巳、
	// 狮子-午、巨蟹-未、双子-申、金牛-酉、白羊-戌、双鱼-亥
	const signIdx = Math.floor(nlon / 30) % 12; // 白羊=0 ... 双鱼=11
	const branchIdx = (10 - signIdx + 12) % 12;
	return BRANCH_ORDER[branchIdx];
}

// 赤经(RA)→地支:与 lonToBranch 同口径(RA 0°=白羊点,对齐黄经 0°),供「外圈赤道分宫」复用 obj.ra。
function raToBranch(ra){
	const nra = normalizeLon(ra);
	if(nra === null){
		return '';
	}
	const signIdx = Math.floor(nra / 30) % 12;
	const branchIdx = (10 - signIdx + 12) % 12;
	return BRANCH_ORDER[branchIdx];
}

function signToBranch(sign){
	if(!sign){
		return '';
	}
	try{
		return LRConst.getSignZi(sign) || '';
	}catch(e){
		return '';
	}
}

function resolveObjBranch(obj, coord){
	if(!obj){
		return '';
	}
	// 赤道模式:按赤经(obj.ra)分入地支;缺赤经则回退黄道避免空。默认(ecliptic/未传)逐字现状。
	if(coord === 'equatorial'){
		const ra = obj.ra;
		if(ra !== undefined && ra !== null && !Number.isNaN(parseFloat(ra))){
			return raToBranch(ra);
		}
	}
	const bySign = signToBranch(obj.sign);
	if(bySign){
		return bySign;
	}
	return lonToBranch(obj.lon);
}

function parseHouseNum(houseId){
	if(!houseId){
		return '';
	}
	const m = `${houseId}`.match(/\d+/);
	return m ? m[0] : '';
}

// 单柱「虚支」:与后端七政四余 Moira(MoiraPropRuleEngine.computeWeakHouse)逐字一致——
// 旬空二支按 60 甲子位次奇偶仅取其一(偶位取前支/奇位取后支),非整对旬空。
// i = 干序 g + 10*旬序;index = 10 - 2*旬序,i 奇(即 g 奇)则 +1,取 BRANCH_ORDER[index]。
function computeMoiraWeakZhi(ganzhi){
	if(!ganzhi || ganzhi.length < 2){ return ''; }
	const g = STEM_ORDER.indexOf(ganzhi.charAt(0));
	const z = BRANCH_ORDER.indexOf(ganzhi.charAt(1));
	if(g < 0 || z < 0){ return ''; }
	const xun = ((((g - z) % 12) + 12) % 12) / 2; // 旬序 0..5(= 60甲子位次 i 的 i/10)
	let index = 10 - 2 * xun;
	if(g % 2 === 1){ index++; } // i 奇 ⇔ g 奇(i = g + 10*旬序)
	return BRANCH_ORDER[(((index % 12) + 12) % 12)] || '';
}

// 三式外圈「虚实」红绿点 八字源,与七政四余 Moira 红绿点逐宫一致:
//  实宫=年月日时【四柱地支】各自定实;虚宫=四柱各自 computeMoiraWeakZhi(每柱仅一支)推虚。
// pan.ganzhi = 起课四柱(年/月/日/时干支)。返回 { 地支: {solid,weak,solidPillars,weakPillars} }。
export function buildSanshiWeakSolid(pan){
	const map = {};
	BRANCH_ORDER.forEach((b)=>{ map[b] = { solid: false, weak: false, solidPillars: [], weakPillars: [] }; });
	const gz = (pan && pan.ganzhi) || {};
	const pillars = [
		{ label: '年', gz: gz.year || '' },
		{ label: '月', gz: gz.month || '' },
		{ label: '日', gz: gz.day || '' },
		{ label: '时', gz: gz.time || '' },
	];
	// 实宫:四柱地支各自定实。
	pillars.forEach((p)=>{
		const zhi = (p.gz || '').charAt(1);
		if(zhi && map[zhi]){
			map[zhi].solid = true;
			if(map[zhi].solidPillars.indexOf(p.label) < 0){
				map[zhi].solidPillars.push(p.label);
			}
		}
	});
	// 虚宫:四柱各自取 Moira 虚支(每柱一支)推虚。
	pillars.forEach((p)=>{
		const wz = computeMoiraWeakZhi(p.gz);
		if(wz && map[wz]){
			map[wz].weak = true;
			if(map[wz].weakPillars.indexOf(p.label) < 0){
				map[wz].weakPillars.push(p.label);
			}
		}
	});
	return map;
}

// 三式「旬」统一口径(时家奇门;概览/盘底/快照单一来源,杜绝与后端 xunShou/fuTou(=六仪)及繁简键漂移):
//  旬首=时柱所在旬之甲(该时辰旬首,如癸巳→甲申);旬仪=旬首所遁六仪(甲申→庚,显示甲申庚);
//  本旬=日柱所在旬之甲(本日之旬);旬空=日柱旬空(日空);时空=时柱旬空。
// 旬首(甲X)展开为「甲X丁Y癸Z」:旬首(第一日甲)+旬丁(第四日丁=丁马)+旬尾(第十日癸);
// 丁在旬首后第 3 位、癸在第 9 位(地支同步推移)。例:甲子→甲子丁卯癸酉;甲辰→甲辰丁未癸丑。
function expandXunPillars(head){
	if(!head || head.length < 2){ return head || ''; }
	const z = BRANCH_ORDER.indexOf(head.charAt(1));
	if(z < 0){ return head; }
	const ding = `丁${BRANCH_ORDER[(z + 3) % 12]}`; // 第四日(丁) + 地支
	const gui = `癸${BRANCH_ORDER[(z + 9) % 12]}`; // 第十日(癸) + 地支
	return `${head}${ding}${gui}`;
}

export function computeSanshiXun(pan){
	const gz = (pan && pan.ganzhi) || {};
	const dayHead = gz.day ? getXunHead(gz.day) : '';
	const timeHead = gz.time ? getXunHead(gz.time) : '';
	const xunShou = timeHead || safe(pan && pan.xunShou, '—');
	const xunYi = timeHead ? `${timeHead}${XUN_SHOU_TO_LIUYI[timeHead] || ''}` : safe(pan && pan.fuTou, '—');
	// 本旬=日柱所在旬,展开旬首/旬丁/旬尾(甲X丁Y癸Z),与参考样张一致。
	const benXun = dayHead ? expandXunPillars(dayHead) : safe(pan && pan.xunShou, '—');
	const riKong = (dayHead && GUXU[dayHead]) || safe(pan && pan.xunkong && pan.xunkong.日空, '—');
	const shiKong = (timeHead && GUXU[timeHead]) || safe(pan && pan.xunkong && (pan.xunkong.时空 || pan.xunkong.時空), '—');
	return { xunShou, xunYi, benXun, riKong, shiKong };
}

export function buildOuterData(chartObj, coord){
	const housesByBranch = {};
	const starsByBranch = {};
	const starsByBranchFull = {};
	const starsByBranchMeta = {};
	BRANCH_ORDER.forEach((b)=>{
		housesByBranch[b] = [];
		starsByBranch[b] = [];
		starsByBranchFull[b] = [];
		starsByBranchMeta[b] = [];
	});
	if(!chartObj){
		return { housesByBranch, starsByBranch, starsByBranchFull, starsByBranchMeta };
	}
	const objs = chartObj.objects || [];
	let ascBranch = '';
	for(let i=0; i<objs.length; i++){
		const obj = objs[i];
		if(obj && obj.id === AstroConst.ASC){
			ascBranch = resolveObjBranch(obj, coord);
			break;
		}
	}
	const ascIdx = BRANCH_ORDER.indexOf(ascBranch);
	if(ascIdx >= 0){
		// 人事宫位：从上升1宫开始，逆时针排布
		for(let houseNo = 1; houseNo <= 12; houseNo++){
			const idx = (ascIdx - (houseNo - 1) + 12) % 12;
			housesByBranch[BRANCH_ORDER[idx]].push(`${houseNo}`);
		}
	}else{
		// 兜底：若ASC缺失则回退到按宫头经度映射
		const houses = chartObj.houses || [];
		houses.forEach((h)=>{
			const b = (coord === 'equatorial' && h && h.ra !== undefined && h.ra !== null && !Number.isNaN(parseFloat(h.ra)))
				? raToBranch(h.ra)
				: (signToBranch(h.sign) || lonToBranch(h.lon));
			if(!b){
				return;
			}
			const txt = parseHouseNum(h.id);
			if(txt && housesByBranch[b].indexOf(txt) < 0){
				housesByBranch[b].push(txt);
			}
		});
	}

	const starsByBranchRaw = {};
	BRANCH_ORDER.forEach((b)=>{ starsByBranchRaw[b] = []; });
	objs.forEach((obj)=>{
		if(!MAIN_STAR_IDS.has(obj.id)){
			return;
		}
		const b = resolveObjBranch(obj, coord);
		if(!b){
			return;
		}
		// 度数随坐标口径切换:赤道按赤经(ra)宫内度;黄道按 signlon(黄经宫内度)。
		// 否则切赤道仅地支重映射、度数/悬浮纹丝不动。
		const useEqua = coord === 'equatorial' && obj.ra !== undefined && obj.ra !== null && !Number.isNaN(parseFloat(obj.ra));
		const inSegDeg = useEqua ? (normalizeLon(obj.ra) % 30) : (obj.signlon || 0);
		const deg = splitDegree(inSegDeg);
		const retro = obj.lonspeed < 0 ? 'R' : '';
		const shortTxt = `${shortMainStarLabel(msg(obj.id))}${safe(deg[0], 0)}${retro}`;
		const starName = safe(appendPlanetHouseInfo(msg(obj.id), obj, AI_EXPORT_PLANET_INFO), '未知星曜');
		const minTxt = `${safe(deg[1], 0)}`.padStart(2, '0');
		const fullTxt = `${starName}${safe(deg[0], 0)}°${minTxt}${retro}${useEqua ? '（赤经）' : ''}`;
		starsByBranchRaw[b].push({
			shortTxt,
			fullTxt,
			deg: Number(inSegDeg) || 0,
			objId: obj.id,
		});
	});
	BRANCH_ORDER.forEach((b)=>{
		const sorted = starsByBranchRaw[b].sort((a, c)=>a.deg - c.deg);
		starsByBranch[b] = sorted.map((item)=>item.shortTxt);
		starsByBranchFull[b] = sorted.map((item)=>item.fullTxt);
		starsByBranchMeta[b] = sorted.map((item)=>({
			shortTxt: item.shortTxt,
			fullTxt: item.fullTxt,
			objId: item.objId,
		}));
	});
	return { housesByBranch, starsByBranch, starsByBranchFull, starsByBranchMeta };
}

export function buildShenShaMap(dunjia){
	const map = {};
	if(!dunjia || !dunjia.shenSha || !dunjia.shenSha.allItems){
		return map;
	}
	dunjia.shenSha.allItems.forEach((item)=>{
		map[item.name] = item.value;
	});
	// 兼容不同命名写法，避免取值缺失。
	if(!map.幕贵 && map.墓贵){
		map.幕贵 = map.墓贵;
	}
	if(!map.墓贵 && map.幕贵){
		map.墓贵 = map.幕贵;
	}
	return map;
}

function appendSection(lines, title, bodyLines){
	lines.push(`【${title}】`);
	(bodyLines || []).forEach((line)=>{
		lines.push(`${line}`);
	});
	lines.push('');
}

function buildLiuRengBranchMap(lrLayout){
	const map = {};
	if(!lrLayout || !Array.isArray(lrLayout.downZi)){
		return map;
	}
	lrLayout.downZi.forEach((branch, idx)=>{
		map[branch] = {
			up: safe(lrLayout.upZi && lrLayout.upZi[idx], '—'),
			god: safe(lrLayout.houseTianJiang && lrLayout.houseTianJiang[idx], '—'),
		};
	});
	return map;
}

// 单一真值源:把独立技法 builder 产出的整篇快照(段头形如 [X])解析成「段名 → 正文行数组」的 Map,
// 供三式合一按需挑段并以 appendSection(【X】)重发。这样段内容 100% 来自独立 builder(零平行实现),
// 三式合一只做「选段 + 改前缀」。段头识别与 parseSectionTitleLine 同口径:整行 [X] 才算段头。
// 把独立 builder 整篇里的指定段,以「前缀 + 段名」重发到三式合一快照(单一真值源:正文照搬)。
// 仅在该段存在且有正文时输出(条件段天然豁免;空段不污染导出与导出设置勾选面)。
function appendPickedSections(lines, sectionMap, titles, prefix){
	(titles || []).forEach((title)=>{
		const body = sectionMap[title];
		if(!body || !body.length){
			return;
		}
		appendSection(lines, `${prefix || ''}${title}`, body);
	});
}



export function buildSanShiUnitedSnapshotText(data){
	const {
		fields,
		options,
		nongli,
		displaySolarTime,
		liureng,
		dunjia,
		taiyi,
		keData,
		sanChuan,
		lrLayout,
		liurengRefBundle,
		outerData,
		// 六壬断卦层(复用独立 buildLiuRengSnapshotText)所需的原始入参;缺任一则跳过断卦层(零回归)。
		guirengType,
		liurengChartForLr,
		lrCastOverride,
		lrCastOpts,
		liurengRunYear,
		// [YA v42] 紫微四化 tab 上报的 {chart,daxianIdx,liunianIdx};缺省(旧调用/tab 未开)不产段。
		ziweiSihua,
	} = data || {};
	if(!dunjia || !keData || !sanChuan || !lrLayout){
		return '';
	}
	const lines = [];
	const timeAlg = normalizeTimeAlg(options && options.timeAlg);
	const timeAlgLabel = getTimeAlgLabel(timeAlg);
	const direct = fmtDirect(fields);
	const solar = fmtSolar(fields, dunjia, nongli, displaySolarTime);
	const directText = `${safe(direct.date, '—')} ${safe(direct.hm, '—')}`.trim();
	const solarText = `${safe(solar.date, '—')} ${safe(solar.hm, '—')}`.trim();
	const lunarText = safe(dunjia.lunarText, fmtLunar(nongli) || '—');
	const pillars = dunjia.ganzhi || {};
	const yuejiang = safe((liureng && liureng.yue) || (lrLayout && lrLayout.yue), '—');
	const nianming = safe(
		liureng && liureng.nianMing,
		(pillars.year && pillars.year.length > 1) ? pillars.year.substring(1, 2) : '—'
	);
	const daySwitchLabel = options && options.after23NewDay === 1 ? '23点算第二天' : '24点算第二天';
	appendSection(lines, '起盘信息', [
		`农历：${lunarText || '—'}`,
		`直接时间：${directText || '—'}`,
		`真太阳时：${solarText || '—'}`,
		`四柱：${safe(pillars.year, '—')}年/${safe(pillars.month, '—')}月/${safe(pillars.day, '—')}日/${safe(pillars.time, '—')}时`,
		`时间算法：${timeAlgLabel}`,
		`换日：${daySwitchLabel}`,
		`月将：${yuejiang}`,
		`年命：${nianming}`,
	]);
	// 旬:与盘面 renderBottom / 概览同源(computeSanshiXun):旬首=时柱旬首 / 旬仪=时柱旬首+六仪 /
	// 本旬=日柱旬首 / 旬空=日空 / 时空=时柱旬空,避免旧 xunShou/fuTou(=六仪)/繁简键失配错值。
	const _xun = computeSanshiXun(dunjia);
	appendSection(lines, '概览', [
		`局数：${safe(dunjia.juText, '—')}`,
		`旬首：${_xun.xunShou}`,
		`旬仪：${_xun.xunYi}`,
		`值符：${safe(dunjia.zhiFu, '—')}`,
		`值使：${safe(dunjia.zhiShi, '—')}`,
		`本旬：${_xun.benXun}`,
		`旬空：${_xun.riKong}`,
		`时空：${_xun.shiKong}`,
		// [Q-319/T-316] yiMa.text 本身已带「日马:」/「时马:」前缀(驿马取法可选日马/时马),此处再加一层
		// → 快照与导出出现「日马:日马:申(坤二宫)」,选时马时更成「日马:时马:…」自相矛盾。直接用其自带前缀。
		`${dunjia.yiMa && dunjia.yiMa.text ? dunjia.yiMa.text : '日马：无'}`,
		`阴阳遁：${safe(dunjia.yinYangDun, '—')}`,
		`月将：${yuejiang}`,
		// [Q-160/T-78] 封局 / 四柱空亡随开关入快照(缺省关=不产行,字节不变)
		...(dunjia.fengJu ? ['奇门封局：已封局'] : []),
		...(dunjia.allKong ? [`四柱空亡：年空${safe(dunjia.allKong.年空, '—')}、月空${safe(dunjia.allKong.月空, '—')}、日空${safe(dunjia.allKong.日空, '—')}、时空${safe(dunjia.allKong.时空, '—')}`] : []),
	]);
	if(taiyi){
		appendSection(lines, '太乙', buildTaiyiSnapshotLines(taiyi));
		// 太乙动态派生段(主客定算/八门与宿曜/断法/七大兵法/博弈/命法/命宫行限):复用独立 buildTaiyiSnapshotText,
		// 切其按 pan.sections 产出的段(单一真值源,同 formatSnapshotValue 口径),以「太乙」前缀重发(三式合一缺这些 → 导出/挂载贫)。
		const taiyiSectionTitles = Array.isArray(taiyi.sections)
			? SANSHI_TAIYI_SECTION_TITLES.filter((title)=>taiyi.sections.some((section)=>section && section.title === title))
			: [];
		if(taiyiSectionTitles.length){
			const taiyiSectionMap = parseSnapshotSections(buildTaiyiSnapshotText(taiyi));
			appendPickedSections(lines, taiyiSectionMap, taiyiSectionTitles, '太乙');
		}
		appendSection(lines, '太乙十六宫', (taiyi.palace16 || []).map((item)=>{
			const txt = item.items && item.items.length ? item.items.join('、') : '—';
			return `${item.palace}：${txt}`;
		}));
	}
	const keRaw = keData && Array.isArray(keData.raw) ? keData.raw : [];
	const formatKe = (idx)=>{ 
		const item = keRaw[idx] || [];
		return `${safe(item[2], '—')}${safe(item[1], '—')}${safe(item[0], '—')}`;
	};
	const formatChuan = (idx)=>{
		const gz = safe(sanChuan && sanChuan.cuang && sanChuan.cuang[idx], '—');
		const god = safe(sanChuan && sanChuan.tianJiang && sanChuan.tianJiang[idx], '');
		return god ? `${gz}（${god}）` : gz;
	};
	// [Q-153/T-70] raw[0]=一课(日干上神)…raw[3]=四课,与盘面 SanshiUnitedBoard、独立六壬页、帮助文同序(此前 3→0 颠倒)。
	// [Q-450/T-413] 三传递生递克 + 逐传空/禄/马徽记(与独立六壬页、右栏小图同一纯函数;三式同步铁律)。
	const _ssCtx = (liurengRefBundle && liurengRefBundle.context) || null;
	const _ssRelLines = (_ssCtx && Array.isArray(_ssCtx.sanChuanBranches) && _ssCtx.sanChuanBranches.length >= 3)
		? sanChuanRelationSnapshotLines({
			branches: _ssCtx.sanChuanBranches,
			gans: _ssCtx.sanChuanGans || [],
			dayGan: _ssCtx.dayGan || '',
			dayZhi: _ssCtx.dayZhi || '',
			xunKong: _ssCtx.xunKongBranches || [],
		})
		: [];
	appendSection(lines, '大六壬', [
		`一课：${formatKe(0)}`,
		`二课：${formatKe(1)}`,
		`三课：${formatKe(2)}`,
		`四课：${formatKe(3)}`,
		'',
		`初传：${formatChuan(0)}`,
		`中传：${formatChuan(1)}`,
		`末传：${formatChuan(2)}`,
		..._ssRelLines,
	]);
	const refBundle = liurengRefBundle || {};
	const xiaojuAllItems = Array.isArray(refBundle.xiaoju) ? refBundle.xiaoju : [];
	const xiaojuMainItems = xiaojuAllItems.filter((item)=>!XIAO_JU_REFERENCE_TAB_KEYS.has(item.key));
	const xiaojuReferenceItems = xiaojuAllItems.filter((item)=>XIAO_JU_REFERENCE_TAB_KEYS.has(item.key));
	const appendRefSection = (title, items, type)=>{
		if(!items || !items.length){
			appendSection(lines, title, ['无']);
			return;
		}
		const body = [];
		items.forEach((item, idx)=>{
			body.push(`${idx + 1}. ${safe(item.name, '未命名')}`);
			const docText = type === 'overview'
				? buildOverviewReferenceText(item)
				: buildReferenceDocumentText(item, type);
			if(docText){
				docText.split('\n').forEach((line)=>body.push(line));
			}
			if(item.evidence && item.evidence.length){
				body.push(`依据：${item.evidence.join('；')}`);
			}
			body.push('');
		});
		if(body.length && body[body.length - 1] === ''){
			body.pop();
		}
		appendSection(lines, title, body);
	};
	appendRefSection('六壬大格', refBundle.dage || [], 'dage');
	appendRefSection('六壬小局', xiaojuMainItems, 'xiaoju');
	appendRefSection('六壬参考', xiaojuReferenceItems, 'xiaoju');
	appendRefSection('六壬概览', refBundle.overview || [], 'overview');
	// 六壬断卦层(十二盘式/常用神煞/年月神煞/课体结构/三传旺衰/空亡真假/旬空落点/陷空/遁干特殊/年命上神/毕法/占断向导):
	// 复用独立 buildLiuRengSnapshotText(单一真值源),用三式合一同源入参重跑后切断卦段——独立页有、三式合一此前缺。
	// 入参齐备才跑(零回归);params=null 跳过起盘信息行,zhangshengElem='' 不影响断卦层(其只依赖 refs.context)。
	if(liureng && liurengChartForLr){
		let liurengFull = '';
		try{
			liurengFull = buildLiuRengSnapshotText(
				null,
				liureng,
				liurengRunYear || null,
				liurengChartForLr,
				guirengType,
				'',
				options && options.sex,
				{ ...(lrCastOpts || {}), castOverride: lrCastOverride || undefined }
			);
		}catch(e){
			liurengFull = '';
		}
		if(liurengFull){
			const liurengSectionMap = parseSnapshotSections(liurengFull);
			// [Q-451/T-414] 段单补「七政」:独立六壬快照有 [七政] 段、三式合一也有「七政」页签,此前挑段单漏它 → 该段被丢
			appendPickedSections(lines, liurengSectionMap, SANSHI_LIURENG_DUANGUA_SECTIONS, '');
		}
	}
	const qimenMap = {};
	if(Array.isArray(dunjia.cells)){
		dunjia.cells.forEach((cell)=>{
			qimenMap[cell.palaceNum] = cell;
		});
	}
	const lrBranchMap = buildLiuRengBranchMap(lrLayout);
	// [Q-451/T-414] 与盘面同源:外圈虚实点按 buildSanshiWeakSolid(四柱地支定实 / 四柱旬空推虚)
	const weakSolidMap = (()=>{ try{ return buildSanshiWeakSolid(dunjia); }catch(e){ return null; } })();
	const starsByBranch = outerData && outerData.starsByBranchFull ? outerData.starsByBranchFull
		: (outerData && outerData.starsByBranch ? outerData.starsByBranch : {});
	SANSHI_PALACE_EXPORT_ORDER.forEach((palace)=>{
		const qimenCell = qimenMap[palace.palaceNum] || {};
		const body = [
			`遁甲：天盘干：${safe(qimenCell.tianGan, '—')}；八神：${safe(qimenCell.god, '—')}；九星：${safe(qimenCell.tianXing, '—')}；地盘干：${safe(qimenCell.diGan, '—')}`,
			'',
		];
		palace.branches.forEach((branch, idx)=>{
			const lr = lrBranchMap[branch] || {};
			const stars = Array.isArray(starsByBranch[branch]) ? starsByBranch[branch] : [];
			body.push(`「${branch}-${safe(BRANCH_ZODIAC_MAP[branch], '未知星座')}」`);
			// [Q-451/T-414] 盘面外圈画了「人事宫位号」与「虚实红绿点」(四柱地支定实 / 旬空推虚),快照此前两样都没有 →
			//   AI 看不到盘上最显眼的两层标注。此处逐支补齐(无数据不产行,缺省字节零变化)。
			const houseNos = outerData && outerData.housesByBranch && Array.isArray(outerData.housesByBranch[branch]) ? outerData.housesByBranch[branch] : [];
			if(houseNos.length){ body.push(`人事宫位：第 ${houseNos.join('、')} 宫`); }
			const ws = weakSolidMap ? weakSolidMap[branch] : null;
			if(ws && (ws.solid || ws.weak)){
				const parts = [];
				if(ws.solid){ parts.push(`实（${(ws.solidPillars || []).join('') || '四柱'}柱地支）`); }
				if(ws.weak){ parts.push(`虚（${(ws.weakPillars || []).join('') || '旬空'}旬空）`); }
				body.push(`虚实：${parts.join('；')}`);
			}
			body.push(`六壬：天盘：${safe(lr.up, '—')}；神将：${safe(lr.god, '—')}`);
			body.push(`星盘：${stars.length ? stars.join('；') : '无'}`);
			if(idx < palace.branches.length - 1){
				body.push('');
			}
		});
		appendSection(lines, palace.title, body);
	});
	const shenshaItems = dunjia.shenSha && Array.isArray(dunjia.shenSha.allItems) ? dunjia.shenSha.allItems : [];
	appendSection(lines, '神煞', shenshaItems.length
		? shenshaItems.map((item)=>`${item.name}：${item.value}`)
		: ['暂无神煞']);
	const bagongLines = [];
	BAGONG_PALACE_ORDER.forEach((palaceNum)=>{
		const item = buildQimenBaGongPanelData(dunjia, palaceNum);
		const palaceName = item.palaceName || BAGONG_PALACE_NAME[palaceNum] || '';
		bagongLines.push(`${palaceName}宫：`);
		if(item.jiPatternDetails && item.jiPatternDetails.length){
			bagongLines.push('奇门吉格：');
			item.jiPatternDetails.forEach((txt)=>bagongLines.push(`- ${txt}`));
		}else{
			bagongLines.push('奇门吉格：无');
		}
		if(item.xiongPatternDetails && item.xiongPatternDetails.length){
			bagongLines.push('奇门凶格：');
			item.xiongPatternDetails.forEach((txt)=>bagongLines.push(`- ${txt}`));
		}else{
			bagongLines.push('奇门凶格：无');
		}
		bagongLines.push(`十干克应（天${item.tianGan || '—'}加地${item.diGan || '—'}）：${item.tenGanText}`);
		bagongLines.push(`八门克应（人${item.renDoor || '—'}加地${item.baseDoor || '—'}）：${item.doorBaseText}`);
		bagongLines.push(`奇仪主应（人${item.renDoor || '—'}加天${item.tianGan || '—'}）：${item.doorTianText}`);
		bagongLines.push(`八神加八门（${item.godFull || '—'}加${item.renDoor || '—'}门）：${item.godDoorText}`);
		bagongLines.push(`奇门演卦（门方）：${item.menFangYiGuaText || '无'}`);
		bagongLines.push('');
	});
	if(bagongLines.length && bagongLines[bagongLines.length - 1] === ''){
		bagongLines.pop();
	}
	appendSection(lines, '八宫详解', bagongLines);
	// 奇门派生/法奇门段(九宫方盘/旺相休囚死·月令能量/六害总览/化解方案/八门化气大阵/用神分论/财富七要/事业七要/
	// 恋爱姻缘/孤辰寡宿):复用独立 buildDunJiaSnapshotText(单一真值源),切其对应段以「奇门」前缀重发
	// (避免与六壬「概览」等碰撞)——独立遁甲页有、三式合一此前缺这 ~9 段。
	const qimenSectionMap = parseSnapshotSections(buildDunJiaSnapshotText(dunjia));
	appendPickedSections(lines, qimenSectionMap, SANSHI_QIMEN_EXTRA_SECTIONS, '奇门');
	// [YA v42] A 类硬缺:紫微四化叠加 tab(SanShiZiWeiSihua 独立计算)显示了却不入快照。
	// 复用该组件导出的同源纯函数取数(单一真值源,与 tab 同一套 getLayerSihua/ZWLuckPanel 计算);
	// 无盘/无四化不产段(零回归——旧调用不带 ziweiSihua 时输出与此前逐字节一致)。
	if(ziweiSihua && ziweiSihua.chart){
		const ziweiSihuaLines = buildSanShiZiweiSihuaSnapshotLines(ziweiSihua.chart, ziweiSihua.daxianIdx, ziweiSihua.liunianIdx);
		if(ziweiSihuaLines.length){
			appendSection(lines, '紫微四化', ziweiSihuaLines);
		}
	}
	return lines.join('\n').trim();
}

export function getOuterLabelLayout(branch, houseFont){
	// 外圈标签逐宫定位：四正宫按矩形角，八斜宫贴到对应三角区角落。
	const px = 1;
	const py = 1;
	const rowGap = Math.max(10, Math.round(houseFont * 0.92));
	const colGap = Math.max(11, Math.round(houseFont * 0.98));
	// 角宫位移：控制在 2~3 格之间，避免过度偏移。
	const shiftStep = Math.max(6, Math.round(houseFont * 0.34));
	const shiftRows = Math.round(shiftStep * 2.4);
	const shiftCols = Math.round(shiftStep * 2.4);
	// [角宫地支对角对称](horosa_sanshi_corner_label_mirror_v1)**只移地支、宫位数字原地不动**
	// (用户两点定版:「辰申往下、寅戌往上,做成隔壁字沿对角线镜像翻转的位置」+「宫位数字的
	// 位置别变,否则仍会挤在一起」)。辰/申/戌/寅 四个纵向角标原各比其横向邻居(巳/未/亥/丑)
	// 多减一格 oneGridShift ⇒ 过分贴角、与邻居不成镜像;现只把 **branch** 那一格去掉,
	// house 保留 —— 数字位置逐像素不变,地支沿边下移/上移,两者间距因此拉开(不再挤)。
	const oneGridShift = shiftStep;
	// 原注(保留以明来历)：辰/申/戌/寅 四个**纵向**角标
	// 原各比其横向邻居(巳/未/亥/丑)多减一格 oneGridShift ⇒ 四者过分贴角、与邻居不成镜像
	// (用户实圈:「辰申往下、寅戌往上,做成隔壁字沿对角线镜像翻转的位置」)。去掉那一格后,
	// 纵向标签距角的距离与横向邻居一致 —— 主对角线两侧自然对称。house 与 branch 同去,
	// 两者相对间距(rowGap)逐字不变,只是整体沿边平移。
	const oneAndHalfGridShift = shiftStep * 1.5;
	const twoGridShift = shiftStep * 2;
	const fourGridShift = shiftStep * 4;
	const cornerOffset = '-16%';
	const wideNumGap = colGap + Math.max(8, Math.round(houseFont * 0.5));
	const topLeft = { left: px, top: py };
	const topRight = { right: px, top: py };
	const bottomLeft = { left: px, bottom: py };
	const bottomRight = { right: px, bottom: py };

	switch(branch){
	case '卯': // 左矩形：地支左下，数字左上
		return { house: topLeft, branch: bottomLeft };
	case '酉': // 右矩形：地支右下，数字右上
		return { house: topRight, branch: bottomRight };
	case '子': // 下矩形：地支右下，数字左下
		return { house: bottomLeft, branch: bottomRight };
	case '午': // 上矩形：地支右上，数字左上
		return { house: topLeft, branch: topRight };
	case '巳': // 上偏左梯形：落入左上角三角，数字左上，地支在其右
		return {
			house: { left: `calc(${cornerOffset} + ${shiftCols}px - ${fourGridShift}px - ${oneAndHalfGridShift}px)`, top: py },
			branch: { left: `calc(${cornerOffset} + ${colGap + shiftCols}px - ${fourGridShift}px)`, top: py },
		};
	case '辰': // 左偏上梯形：落入左上角三角，数字左上，地支在其下
		return {
			house: { left: px, top: `calc(${cornerOffset} + ${shiftRows}px - ${fourGridShift}px - ${oneGridShift}px)` },
			branch: { left: px, top: `calc(${cornerOffset} + ${rowGap + shiftRows}px - ${fourGridShift}px)` },
		};
	case '未': // 上偏右梯形：落入右上角三角，数字右上，地支在其左
		return {
			house: { right: `calc(${cornerOffset} + ${shiftCols}px - ${fourGridShift}px - ${oneAndHalfGridShift}px)`, top: py },
			branch: { right: `calc(${cornerOffset} + ${wideNumGap + shiftCols}px - ${fourGridShift}px - ${oneAndHalfGridShift}px)`, top: py },
		};
	case '申': // 右偏上梯形：落入右上角三角，数字右上，地支在其下
		return {
			house: { right: px, top: `calc(${cornerOffset} + ${shiftRows}px - ${fourGridShift}px - ${oneGridShift}px)` },
			branch: { right: px, top: `calc(${cornerOffset} + ${rowGap + shiftRows}px - ${fourGridShift}px)` },
		};
	case '戌': // 右偏下梯形：落入右下角三角，数字右下，地支在其上
		return {
			house: { right: px, bottom: `calc(${cornerOffset} + ${shiftRows}px - ${fourGridShift}px - ${oneGridShift}px)` },
			branch: { right: px, bottom: `calc(${cornerOffset} + ${rowGap + shiftRows}px - ${fourGridShift}px)` },
		};
	case '亥': // 下偏右梯形：落入右下角三角，数字右下，地支在其左
		return {
			house: { right: `calc(${cornerOffset} + ${shiftCols}px - ${fourGridShift}px - ${oneAndHalfGridShift}px)`, bottom: py },
			branch: { right: `calc(${cornerOffset} + ${wideNumGap + shiftCols}px - ${fourGridShift}px - ${oneAndHalfGridShift}px)`, bottom: py },
		};
	case '丑': // 下偏左梯形：落入左下角三角，数字左下，地支在其右
		return {
			house: { left: `calc(${cornerOffset} + ${shiftCols}px - ${fourGridShift}px - ${oneAndHalfGridShift}px)`, bottom: py },
			branch: { left: `calc(${cornerOffset} + ${colGap + shiftCols}px - ${fourGridShift}px)`, bottom: py },
		};
	case '寅': // 左偏下梯形：落入左下角三角，数字左下，地支在其上
		return {
			house: { left: px, bottom: `calc(${cornerOffset} + ${shiftRows}px - ${fourGridShift}px - ${oneGridShift}px)` },
			branch: { left: px, bottom: `calc(${cornerOffset} + ${rowGap + shiftRows}px - ${fourGridShift}px)` },
		};
	default:
		return { house: topLeft, branch: topRight };
	}
}

export function getOuterStarsLayout(branch, starFont){
	const sidePad = 2;
	const rightPad = sidePad + 2;
	const topPad = Math.max(8, Math.round(starFont * 1.35));
	const bottomPad = Math.max(8, Math.round(starFont * 1.35));
	const onePerRowBranches = new Set(['寅', '卯', '辰', '申', '酉', '戌']);
	const perRow = onePerRowBranches.has(branch) ? 1 : 3;
	let style = {};
	let rowJustify = 'center';

	switch(branch){
	case '卯':
		style = { left: sidePad, top: '50%', transform: 'translateY(-50%)', textAlign: 'left' };
		rowJustify = 'flex-start';
		break;
	case '酉':
		style = { right: sidePad, top: '50%', transform: 'translateY(-50%)', textAlign: 'right' };
		rowJustify = 'flex-end';
		break;
	case '午':
		style = { left: '50%', top: topPad, transform: 'translateX(-50%)', textAlign: 'center' };
		rowJustify = 'center';
		break;
	case '子':
		style = { left: '50%', bottom: bottomPad, transform: 'translateX(-50%)', textAlign: 'center' };
		rowJustify = 'center';
		break;
	case '巳':
	case '丑':
		style = { right: rightPad, top: '50%', transform: 'translateY(-50%)', textAlign: 'right' };
		rowJustify = 'flex-end';
		break;
	case '亥':
	case '未':
		style = { left: sidePad, top: '50%', transform: 'translateY(-50%)', textAlign: 'left' };
		rowJustify = 'flex-start';
		break;
	case '辰':
		style = { left: sidePad, top: topPad, textAlign: 'left' };
		rowJustify = 'flex-start';
		break;
	case '申':
		style = { right: sidePad, top: topPad, textAlign: 'right' };
		rowJustify = 'flex-end';
		break;
	case '寅':
		style = { left: sidePad, bottom: bottomPad, textAlign: 'left' };
		rowJustify = 'flex-start';
		break;
	case '戌':
		style = { right: sidePad, bottom: bottomPad, textAlign: 'right' };
		rowJustify = 'flex-end';
		break;
	default:
		style = { left: '50%', top: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' };
		rowJustify = 'center';
		break;
	}

	return {
		perRow,
		rowJustify,
		style,
	};
}

export function padOuterStarsRow(row, perRow, rowJustify){
	const padded = row.slice();
	while(padded.length < perRow){
		if(rowJustify === 'flex-end'){
			padded.unshift('');
			continue;
		}
		if(rowJustify === 'center' && perRow === 3 && padded.length === 1){
			padded.unshift('');
			padded.push('');
			continue;
		}
		padded.push('');
	}
	return padded;
}

export function buildPillarFromPan(pan, key){
	if(!pan || !pan.ganzhi){
		return '';
	}
	return pan.ganzhi[key] || '';
}

export function toQimenMeaningTip(tipObj){
	if(!tipObj){
		return null;
	}
	const blocks = Array.isArray(tipObj.blocks) ? tipObj.blocks : [];
	const tips = [];
	blocks.forEach((block)=>{
		if(!block){
			return;
		}
		if(block.type === 'blank'){
			tips.push('');
			return;
		}
		if(block.type === 'divider'){
			tips.push('==');
			return;
		}
		if(block.type === 'subTitle'){
			tips.push(`### ${safe(block.text, '')}`);
			return;
		}
		const raw = safe(block.text, '');
		const plain = raw.replace(/<[^>]+>/g, '');
		tips.push(plain);
	});
	return {
		title: safe(tipObj.title, ''),
		tips,
	};
}

function normalizeMeaningTip(tip){
	if(!tip){
		return null;
	}
	if(typeof tip === 'string'){
		return {
			title: '',
			tips: [`${tip}`],
		};
	}
	if(Array.isArray(tip)){
		return {
			title: '',
			tips: tip.map((item)=>safe(item, '')),
		};
	}
	if(typeof tip === 'object'){
		return {
			title: safe(tip.title, ''),
			tips: Array.isArray(tip.tips)
				? tip.tips.map((item)=>safe(item, ''))
				: (tip.tips ? [safe(tip.tips, '')] : []),
		};
	}
	return null;
}

function mergeMeaningTips(title, parts){
	const tips = [];
	(parts || []).forEach((part, idx)=>{
		const one = normalizeMeaningTip(part);
		if(!one){
			return;
		}
		if(one.title){
			tips.push(`### ${one.title}`);
		}
		(one.tips || []).forEach((line)=>{
			tips.push(safe(line, ''));
		});
		if(idx < (parts.length - 1)){
			tips.push('==');
		}
	});
	while(tips.length && (tips[tips.length - 1] === '==' || tips[tips.length - 1] === '')){
		tips.pop();
	}
	return {
		title: safe(title, ''),
		tips,
	};
}

export function buildOuterHouseMeaningTip(houses){
	const entries = (houses || []).map((txt)=>{
		const num = parseInt(`${txt}`, 10);
		if(Number.isNaN(num) || num < 1 || num > 12){
			return null;
		}
		const houseId = AstroConst[`HOUSE${num}`];
		const tip = houseId ? buildMeaningTipByCategory('house', houseId) : null;
		if(!tip){
			return null;
		}
		return {
			num,
			tip,
		};
	}).filter(Boolean);
	if(!entries.length){
		return null;
	}
	return mergeMeaningTips(
		entries.length === 1 ? `${entries[0].num}宫` : entries.map((one)=>`${one.num}宫`).join('/'),
		entries.map((one)=>({
			// 宫名保留在 tooltip 顶部 title，正文不重复显示同名标题。
			title: '',
			tips: normalizeMeaningTip(one.tip) ? normalizeMeaningTip(one.tip).tips : [],
		}))
	);
}

export function buildOuterBranchMeaningTip(branch){
	const signName = safe(BRANCH_ZODIAC_MAP[branch], '未知星座');
	const signId = BRANCH_SIGN_ID_MAP[branch];
	const signMeaning = signId ? buildMeaningTipByCategory('sign', signId) : null;
	if(!signMeaning){
		return null;
	}
	const normalized = normalizeMeaningTip(signMeaning);
	if(!normalized){
		return null;
	}
	return {
		title: `「${branch}-${signName}」`,
		tips: normalized.title
			? [normalized.title, ...(normalized.tips || [])]
			: (normalized.tips || []),
	};
}

export function buildOuterStarMeaningTip(star){
	const base = safe(star && star.fullTxt, safe(star && star.shortTxt, ''));
	const ptip = star && star.objId ? buildMeaningTipByCategory('planet', star.objId) : null;
	if(!ptip){
		return base || '';
	}
	return mergeMeaningTips(base, [ptip]);
}

// ===== horosa_sanshi_render_slice_v1:渲染切片子组件三件套(S1 左栏设置 / S2 右栏隐藏表单头 / S4 盘面层)=====
// 范式与宿主 sCU([A7·性能])同款:wrapperPropsEqual 机械浅比全部自有 props —— 任一数据 prop 引用变
// 即重渲、函数型 props 视为恒等(重渲时自然带下最新闭包),免手抄 keys 的漏渲风险;
// kill-switch = horosa.perf.chartSCU(关闭时 wrapperPropsEqual 恒 false = 恒重渲,逐字回旧行为)。
// 🔴 红线:三个子组件的子树都始终完整挂载(零虚拟化/零延迟卸载 —— AI 导出与 Ctrl+F 依赖全量 DOM),
//    只跳「输入引用未变」的冗余重渲;state 切片由宿主按引用下传,setState 恒换新引用故必不漏渲。

// horosa_sanshi_render_slice_v1(S1):左栏「三式设置」(SpaceTimePanel + 四节 31 个 antd Select)。
// 宿主与之无关的 setState(盘面数据落地/右栏页签/容器量高)原先都让整栏 Select 白跑一遍。
class SanShiInputPanel extends Component{
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){ return true; }
		return !wrapperPropsEqual(this.props, nextProps);
	}

	render(){
		const fields = this.props.fields || {};
		const opt = this.props.options || {};
		let datetm = new DateTime();
		if(fields.date && fields.time){
			const str = `${fields.date.value.format('YYYY-MM-DD')} ${fields.time.value.format('HH:mm:ss')}`;
			datetm = datetm.parse(str, 'YYYY-MM-DD HH:mm:ss');
			if(fields.zone){
				datetm.setZone(fields.zone.value);
			}
		}
		return (
			<div className="horosa-sanshi-input-stack">
				<div className="horosa-side-panel-heading">
					<div>
						<div className="horosa-side-panel-title">三式设置</div>
						<div className="horosa-side-panel-subtitle">时间、地点与起盘选项</div>
					</div>
				</div>
				{/* [择日宿主] 左栏插槽(主三式页不传=零渲染) */}
				{typeof this.props.renderLeftExtra === 'function' ? this.props.renderLeftExtra() : null}
				<SpaceTimePanel
					fields={fields}
					value={datetm}
					onTimeChange={this.props.onTimeChanged}
					timeHook={this.props.timeHook}
					onGeoChange={this.props.onGeoChange}
				/>
				{/* 观象左栏 P2:四 field-title 节各自收编 XQSideSection(原语义图标保留),每节一卡与 P1 母版同构。 */}
				<XQSideSection iconName="sliders" title="选项" storageKey="sanshi.options" className="horosa-sanshi-input-section">
					<div className="horosa-sanshi-select-grid">
						<label className="horosa-sanshi-select-field">
							<span>模式</span>
							<Select size="small" value={opt.mode} onChange={(v)=>this.props.onOptionChange('mode', v)}>
								{GAME_TYPE_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-sanshi-select-field">
							<span>时间算法</span>
							<Select size="small" value={normalizeTimeAlg(opt.timeAlg)} onChange={this.props.onTimeAlgChange}>
								{TIME_ALG_OPTIONS.map((item)=><Option key={`time_alg_${item.value}`} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-sanshi-select-field">
							<span>性别</span>
							<Select size="small" value={opt.sex} onChange={this.props.onGenderChange}>
								{SEX_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-sanshi-select-field">
							<span>贵人</span>
							<Select size="small" value={opt.guireng} onChange={(v)=>this.props.onOptionChange('guireng', v)}>
								{GUIRENG_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-sanshi-select-field">
							<span>排盘</span>
							<Select size="small" value={opt.paiPanType} onChange={(v)=>this.props.onOptionChange('paiPanType', v)}>
								{PAIPAN_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-sanshi-select-field">
							<span>日界</span>
							<Select size="small" value={opt.after23NewDay} onChange={(v)=>this.props.onOptionChange('after23NewDay', v)}>
								{DAY_SWITCH_OPTIONS.map((item)=><Option key={`day_switch_${item.value}`} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-sanshi-select-field">
							<span>值使</span>
							<Select disabled={['飞盘', '混合'].indexOf(opt.school || '转盘') >= 0} size="small" value={opt.zhiShiType} onChange={(v)=>this.props.onOptionChange('zhiShiType', v)}>
								{ZHISHI_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-sanshi-select-field">
							<span>黄道</span>
							<Select size="small" value={AstroConst.zodiacSelectValue(opt.zodiacal, opt.siderealAyanamsa)} onChange={(v)=>this.props.onAstroZodiacalChange(v)} dropdownMatchSelectWidth={false}>
								{AstroConst.groupOptions(AstroConst.buildZodiacOptions()).map((grp)=>(
									<OptGroup label={grp.group} key={grp.group}>
										{grp.items.map((item)=>(<Option value={item.value} key={item.value}>{item.label}</Option>))}
									</OptGroup>
								))}
							</Select>
						</label>
						{/* [Q-162/T-80] 宫制:原只活在右栏 display:none 块里(不可达),而它进 fields.hsys、
						    进重算指纹、也进存档 —— 只是用户无从修改。移到黄道旁可见,缺省(0)不变。 */}
						<label className="horosa-sanshi-select-field">
							<span>宫制</span>
							<Select size="small" value={opt.hsys} onChange={(v)=>this.props.onAstroFieldOptionChange('hsys', v)} dropdownMatchSelectWidth={false}>
								{getHousesOption()}
							</Select>
						</label>
						<label className="horosa-sanshi-select-field">
							<span>外圈</span>
							<Select size="small" value={this.props.outerCoord} onChange={(v)=>this.props.onOuterCoordChange(v)}>
								<Option value="ecliptic">黄道</Option>
								<Option value="equatorial">赤道</Option>
							</Select>
						</label>
						<label className="horosa-sanshi-select-field">
							<span>虚实</span>
							<Select size="small" value={this.props.showWeakSolid ? 1 : 0} onChange={(v)=>this.props.onShowWeakSolidChange(v === 1)}>
								<Option value={1}>显示</Option>
								<Option value={0}>隐藏</Option>
							</Select>
						</label>
					</div>

				</XQSideSection>

				{/* 奇门遁甲流派/起局补充(对齐独立·默认零回归):盘式 + 阴盘报数 + 封局 + 置闰天数 */}
				<XQSideSection iconName="qimen" title="奇门流派" storageKey="sanshi.qimen" className="horosa-sanshi-input-section">
					<div className="horosa-sanshi-select-grid">
						<label className="horosa-sanshi-select-field">
							<span>盘式</span>
							<Select size="small" value={opt.school || '转盘'} onChange={(v)=>this.props.onOptionChange('school', v)}>
								{SCHOOL_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						{/* [Q-161/T-79] 起局与独立奇门页同源(qijuMethodOptionsFor/SelectValue):
						    此前这里恒列 5 档且非时家整个禁用 → 年/月/日/刻家选不到「阴盘」(独立页可选),
						    且在时家选了阴盘再切年家会锁死在阴盘、报数定局继续生效却退不出去。 */}
						<label className="horosa-sanshi-select-field">
							<span>起局</span>
							<Select size="small" value={qijuMethodSelectValue(opt.paiPanType, opt.qijuMethod)} onChange={(v)=>this.props.onOptionChange('qijuMethod', v)}>
								{qijuMethodOptionsFor(opt.paiPanType).map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						{opt.qijuMethod === 'shuzi' ? (
							<label className="horosa-sanshi-select-field" style={{ gridColumn: '1 / -1' }}>
								<span>报数</span>
								<input
									type="text"
									inputMode="numeric"
									value={opt.shuziReportNumber || ''}
									onChange={(e)=>this.props.onOptionChange('shuziReportNumber', e.target.value)}
									placeholder="阴盘起局:输入报数(各位求和÷9定局,余0作9)"
									style={{ width: '100%', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--horosa-border, rgba(255,255,255,0.18))', background: 'transparent', color: 'var(--horosa-text, inherit)' }}
								/>
							</label>
						) : null}
						<label className="horosa-sanshi-select-field">
							<span>空亡</span>
							<Select size="small" value={opt.kongMode} onChange={(v)=>this.props.onOptionChange('kongMode', v)}>
								{KONG_MODE_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-sanshi-select-field">
							<span>驿马</span>
							<Select size="small" value={opt.yimaMode} onChange={(v)=>this.props.onOptionChange('yimaMode', v)}>
								{MA_MODE_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-sanshi-select-field">
							<span>移星</span>
							<Select size="small" value={opt.shiftPalace} onChange={(v)=>this.props.onOptionChange('shiftPalace', v)}>
								{YIXING_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-sanshi-select-field">
							<span>封局</span>
							<Select size="small" value={opt.fengJu ? 1 : 0} onChange={(v)=>this.props.onOptionChange('fengJu', v === 1)}>
								{QIMEN_FENGJU_OPTIONS.map((item)=><Option key={`fengju_${item.value}`} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						{opt.qijuMethod === 'zhirun' ? (
							<label className="horosa-sanshi-select-field">
								<span>置闰天数</span>
								<Select size="small" value={opt.zhirunLeapDays || 9} onChange={(v)=>this.props.onOptionChange('zhirunLeapDays', v)} dropdownMatchSelectWidth={false}>
									{ZHIRUN_LEAP_OPTIONS.map((item)=><Option key={`zhirun_${item.value}`} value={item.value}>{item.label}</Option>)}
								</Select>
							</label>
						) : null}
						{/* horosa_sanshi_render_slice_v1 · 归位(2026-08-13,issue #65/#68):以下 24 个控件
						    (年家/日家/刻家定局、八神取神、中宫寄宫、暗干暗支、飞法三层、中门飞宫、盘类…)
						    是 v3.8.0 上游「奇门 +42 档」新增项。S1 切片已把左栏整栏收编进本组件,而那轮同步
						    把这批新 JSX 落进了主类 render() —— 那里 `opt` 不在作用域 ⇒ 打开三式必抛
						    ReferenceError、这 24 档从未可用。现搬回本宿主(顺序照上游 renderInputPanel:
						    紧随「置闰天数」),处理器按本组件约定改 this.props.onOptionChange。
						    常设拦截 = check-no-undef.cjs(作用域分析门,gotcha #98)。 */}
						{opt.paiPanType === 0 ? (
							<label className="horosa-sanshi-select-field">
								<span>年家定局</span>
								<Select size="small" value={opt.yearJiaJu || 'sanyuan'} onChange={(v)=>this.props.onOptionChange('yearJiaJu', v)} dropdownMatchSelectWidth={false}>
									{YEARJIA_JU_OPTIONS.map((item)=><Option key={`yjj_${item.value}`} value={item.value}>{item.label}</Option>)}
								</Select>
							</label>
						) : null}
						{opt.paiPanType === 2 ? (
							<label className="horosa-sanshi-select-field">
								<span>日家定局</span>
								<Select size="small" value={opt.dayJiaJu || 'yiyuan'} onChange={(v)=>this.props.onOptionChange('dayJiaJu', v)} dropdownMatchSelectWidth={false}>
									{DAYJIA_JU_OPTIONS.map((item)=><Option key={`djj_${item.value}`} value={item.value}>{item.label}</Option>)}
								</Select>
							</label>
						) : null}
						{opt.paiPanType === 4 ? (
							<>
								<label className="horosa-sanshi-select-field">
									<span>刻家分遁</span>
									<Select size="small" value={opt.keJiaFenDun || 'zihou'} onChange={(v)=>this.props.onOptionChange('keJiaFenDun', v)} dropdownMatchSelectWidth={false}>
										{KEJIA_FENDUN_OPTIONS.map((item)=><Option key={`kjfd_${item.value}`} value={item.value}>{item.label}</Option>)}
									</Select>
								</label>
								<label className="horosa-sanshi-select-field">
									<span>子正换时</span>
									<Select size="small" value={opt.keZiZhengHuanShi ? 1 : 0} onChange={(v)=>this.props.onOptionChange('keZiZhengHuanShi', v === 1)}>
										<Option value={0}>子时23点起(默认)</Option>
										<Option value={1}>子正0点换时</Option>
									</Select>
								</label>
							</>
						) : null}
						{opt.paiPanType === 6 ? (
							<label className="horosa-sanshi-select-field">
								<span>八门排法</span>
								<Select size="small" value={opt.jinhanMenPai || 'book'} onChange={(v)=>this.props.onOptionChange('jinhanMenPai', v)} dropdownMatchSelectWidth={false}>
									{JINHAN_MENPAI_OPTIONS.map((item)=><Option key={`jhmp_${item.value}`} value={item.value}>{item.label}</Option>)}
								</Select>
							</label>
						) : null}
						{/* [H-A] 三式缺口补齐:月家起局(此前只活在死面板)/盘类/相关人员——与独立页同语义 */}
						{opt.paiPanType === 1 ? (
							<label className="horosa-sanshi-select-field">
								<span>月家起局</span>
								<Select size="small" value={opt.yueJiaQiJuType} onChange={(v)=>this.props.onOptionChange('yueJiaQiJuType', v)} dropdownMatchSelectWidth={false}>
									{YUEJIA_QIJU_OPTIONS.map((item)=><Option key={`yjqj_${item.value}`} value={item.value}>{item.label}</Option>)}
								</Select>
							</label>
						) : null}
						<label className="horosa-sanshi-select-field">
							<span>八神取神</span>
							<Select size="small" value={opt.godsPreset || 'baihu_xuanwu'} onChange={(v)=>this.props.onOptionChange('godsPreset', v)} dropdownMatchSelectWidth={false}>
								{GODS_PRESET_OPTIONS.map((item)=><Option key={`gp_${item.value}`} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-sanshi-select-field">
							<span>中宫寄宫</span>
							<Select size="small" value={opt.jiGongMode || 'kun'} onChange={(v)=>this.props.onOptionChange('jiGongMode', v)} dropdownMatchSelectWidth={false}>
								{JIGONG_MODE_OPTIONS.map((item)=><Option key={`jg_${item.value}`} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-sanshi-select-field">
							<span>暗干</span>
							<Select size="small" value={opt.anGanMode || 'off'} onChange={(v)=>this.props.onOptionChange('anGanMode', v)} dropdownMatchSelectWidth={false}>
								{ANGAN_MODE_OPTIONS.map((item)=><Option key={`ag_${item.value}`} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-sanshi-select-field">
							<span>暗支</span>
							<Select size="small" value={opt.showAnZhi ? 1 : 0} onChange={(v)=>this.props.onOptionChange('showAnZhi', v === 1)}>
								<Option value={0}>不显示</Option>
								<Option value={1}>显示</Option>
							</Select>
						</label>
						<label className="horosa-sanshi-select-field">
							<span>空亡标注</span>
							<Select size="small" value={opt.kongMarkBoth ? 1 : 0} onChange={(v)=>this.props.onOptionChange('kongMarkBoth', v === 1)}>
								<Option value={0}>单一模式(默认)</Option>
								<Option value={1}>日空时空并标</Option>
							</Select>
						</label>
						<label className="horosa-sanshi-select-field">
							<span>四柱空亡</span>
							<Select size="small" value={opt.showAllKong ? 1 : 0} onChange={(v)=>this.props.onOptionChange('showAllKong', v === 1)}>
								<Option value={0}>不显示(默认)</Option>
								<Option value={1}>显示年月日时空</Option>
							</Select>
						</label>
						{/* [Q-164/T-92·SS-24] 照独立页门控:移星=原宫时两档恒同,只在移星开启时显示 */}
						{opt.shiftPalace ? (
						<label className="horosa-sanshi-select-field">
							<span>移星值符</span>
							<Select size="small" value={opt.shiftZhiFuMode || 'follow'} onChange={(v)=>this.props.onOptionChange('shiftZhiFuMode', v)} dropdownMatchSelectWidth={false}>
								{SHIFT_ZHIFU_OPTIONS.map((item)=><Option key={`sz_${item.value}`} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						) : null}
						{/* [H-D] 飞盘细项(仅飞盘/混合盘式生效)——与独立页同语义 */}
						{(opt.school === '飞盘' || opt.school === '混合') ? (
							<>
							<label className="horosa-sanshi-select-field">
								<span>九星飞法</span>
								<Select size="small" value={opt.feiXingShun ? 1 : 0} onChange={(v)=>this.props.onOptionChange('feiXingShun', v === 1)}>
									<Option value={0}>阳顺阴逆(默认)</Option>
									<Option value={1}>两遁皆顺飞</Option>
								</Select>
							</label>
							<label className="horosa-sanshi-select-field">
								<span>九门飞法</span>
								<Select size="small" value={opt.feiMenShun ? 1 : 0} onChange={(v)=>this.props.onOptionChange('feiMenShun', v === 1)}>
									<Option value={0}>阳顺阴逆(默认)</Option>
									<Option value={1}>两遁皆顺飞</Option>
								</Select>
							</label>
							<label className="horosa-sanshi-select-field">
								<span>九神飞法</span>
								<Select size="small" value={opt.feiShenShun ? 1 : 0} onChange={(v)=>this.props.onOptionChange('feiShenShun', v === 1)}>
									<Option value={0}>阳顺阴逆(默认)</Option>
									<Option value={1}>两遁皆顺飞</Option>
								</Select>
							</label>
							<label className="horosa-sanshi-select-field">
								<span>中门飞宫</span>
								<Select size="small" value={opt.feiMenZhongCan === false ? 1 : 0} onChange={(v)=>this.props.onOptionChange('feiMenZhongCan', v === 0)}>
									<Option value={0}>参与(默认)</Option>
									<Option value={1}>不参与(跳中)</Option>
								</Select>
							</label>
							{/* [Q-164/T-92·SS-24] 中门参与飞宫时此项无效 → 照独立页只在「不参与」时显示 */}
							{opt.feiMenZhongCan === false ? (
							<label className="horosa-sanshi-select-field">
								<span>中宫门位显示</span>
								<Select size="small" value={opt.feiMenZhongShow ? 1 : 0} onChange={(v)=>this.props.onOptionChange('feiMenZhongShow', v === 1)}>
									<Option value={0}>留空(默认)</Option>
									<Option value={1}>标「中」字样</Option>
								</Select>
							</label>
							) : null}
							</>
						) : null}
						{opt.school === '混合' ? (
							<>
								<label className="horosa-sanshi-select-field">
									<span>天盘层</span>
									<Select size="small" value={opt.mixTian || ''} onChange={(v)=>this.props.onOptionChange('mixTian', v)} dropdownMatchSelectWidth={false}>
										<Option value="">默认（转宫）</Option>
										<Option value="zhuan">转宫（排宫）</Option>
										<Option value="fei">飞宫（飞泊）</Option>
									</Select>
								</label>
								<label className="horosa-sanshi-select-field">
									<span>九星层</span>
									<Select size="small" value={opt.mixXing || ''} onChange={(v)=>this.props.onOptionChange('mixXing', v)} dropdownMatchSelectWidth={false}>
										<Option value="">默认（转宫）</Option>
										<Option value="zhuan">转宫（排宫）</Option>
										<Option value="fei">飞宫（飞泊）</Option>
									</Select>
								</label>
								<label className="horosa-sanshi-select-field">
									<span>八门层</span>
									<Select size="small" value={opt.mixMen || ''} onChange={(v)=>this.props.onOptionChange('mixMen', v)} dropdownMatchSelectWidth={false}>
										<Option value="">默认（飞宫）</Option>
										<Option value="zhuan">转宫（排宫）</Option>
										<Option value="fei">飞宫（飞泊）</Option>
									</Select>
								</label>
								<label className="horosa-sanshi-select-field">
									<span>九神层</span>
									<Select size="small" value={opt.mixShen || ''} onChange={(v)=>this.props.onOptionChange('mixShen', v)} dropdownMatchSelectWidth={false}>
										<Option value="">默认（飞宫）</Option>
										<Option value="zhuan">转宫（排宫）</Option>
										<Option value="fei">飞宫（飞泊）</Option>
									</Select>
								</label>
							</>
						) : null}
						<label className="horosa-sanshi-select-field">
							<span>盘类</span>
							<Select size="small" value={opt.chartCategory || 'shi'} onChange={(v)=>this.props.onOptionChange('chartCategory', v)}>
								{CHART_CATEGORY_OPTIONS.map((item)=><Option key={`cc_${item.value}`} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-sanshi-select-field" style={{ gridColumn: '1 / -1' }}>
							<span>相关人员</span>
							<input
								type="text"
								value={opt.faRelatedPeople || ''}
								onChange={(e)=>this.props.onOptionChange('faRelatedPeople', e.target.value)}
								placeholder="生年天干(如 甲,丙):必护天干用"
								style={{ width: '100%', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--horosa-border, rgba(255,255,255,0.18))', background: 'transparent', color: 'var(--horosa-text, inherit)' }}
							/>
						</label>
					</div>

				</XQSideSection>

				{/* 太乙流派(对齐独立·默认全 default=从盘字节不变):博弈 + 计神/文昌/客算间辰/三基/游神五开关 */}
				<XQSideSection iconName="taiyi" title="太乙流派" storageKey="sanshi.taiyi" className="horosa-sanshi-input-section">
					<div className="horosa-sanshi-select-grid">
						{/* [Q-162/T-80] 盘式 / 古法公式:原只活在右栏 display:none 块里(不可达),现移到此处可见。
						    与独立太乙页同一常量源(TAIYI_STYLE_OPTIONS / TAIYI_ACCUM_OPTIONS),缺省 3 / 0 不变。
						    命法(style=5)不列:合一盘式不承载命法盘,独立页另有。 */}
						<label className="horosa-sanshi-select-field">
							<span>盘式</span>
							<Select size="small" dropdownMatchSelectWidth={false} value={opt.taiyiStyle} onChange={(v)=>this.props.onOptionChange('taiyiStyle', v)}>
								{TAIYI_STYLE_OPTIONS.map((item)=><Option key={`ty_style_${item.value}`} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-sanshi-select-field">
							<span>古法公式</span>
							<Select size="small" dropdownMatchSelectWidth={false} value={opt.taiyiAccum} onChange={(v)=>this.props.onOptionChange('taiyiAccum', v)}>
								{TAIYI_ACCUM_OPTIONS.map((item)=><Option key={`ty_acc_${item.value}`} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-sanshi-select-field">{/* [Q-107 A 裁决 2026-09-18] 与独立太乙页同源的「时间基准」控件 */}
							<span>时间基准</span>
							<Select size="small" dropdownMatchSelectWidth={false} value={opt.taiyiTimeBasis || 'direct'} onChange={(v)=>this.props.onOptionChange('taiyiTimeBasis', v)}>
								{TAIYI_TIME_BASIS_OPTIONS.map((item)=><Option key={`ty_tb_${item.value}`} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-sanshi-select-field">
							<span>博弈</span>
							<Select size="small" value={opt.gameTheory === 1 ? 1 : 0} onChange={(v)=>this.props.onOptionChange('gameTheory', v)}>
								<Option value={0}>关闭</Option>
								<Option value={1}>开启</Option>
							</Select>
						</label>
						{[['jishen', '计神方向'], ['wenchang', '文昌重留'], ['keJianChen', '客算间辰'], ['sanji', '三基起宫'], ['youshen', '游神方向']].map(([k, label])=>(
							<label className="horosa-sanshi-select-field" key={`ty-school-${k}`}>
								<span>{label}</span>
								<Select size="small" dropdownMatchSelectWidth={false} value={(opt.taiyiSchool || {})[k] || 'default'} onChange={(v)=>this.props.onOptionChange('taiyiSchool', { ...normalizeTaiyiSchool(opt.taiyiSchool), [k]: v }, { subKey: k })}>
									{TAIYI_SCHOOL_OPTIONS[k].map((it)=><Option key={it.value} value={it.value}>{it.label}</Option>)}
								</Select>
							</label>
						))}
					</div>

				</XQSideSection>

				{/* 大六壬流派(对齐独立·默认零回归):换将/分昼夜/涉害取舍·起讫·始入/年神排序/昼夜阳阴/土旺衰 */}
				<XQSideSection iconName="liureng" title="六壬流派" storageKey="sanshi.liureng" className="horosa-sanshi-input-section">
					<div className="horosa-sanshi-select-grid">
						<label className="horosa-sanshi-select-field">
							<span>换将</span>
							<Select size="small" dropdownMatchSelectWidth={false} value={opt.yueJiangMethod || 'zhongqi'} onChange={(v)=>this.props.onOptionChange('yueJiangMethod', v)}>
								{LR_YUEJIANG_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-sanshi-select-field">
							<span>分昼夜</span>
							<Select size="small" dropdownMatchSelectWidth={false} value={opt.fenZhouYe || 'chenhun'} onChange={(v)=>this.props.onOptionChange('fenZhouYe', v)}>
								{LR_FENZHOUYE_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-sanshi-select-field">
							<span>涉害取舍</span>
							<Select size="small" dropdownMatchSelectWidth={false} value={opt.seHaiMethod || 'app'} onChange={(v)=>this.props.onOptionChange('seHaiMethod', v)}>
								{LR_SEHAI_METHOD_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-sanshi-select-field">
							<span>涉害起讫</span>
							<Select size="small" dropdownMatchSelectWidth={false} value={opt.seHaiBoundary || 'app'} onChange={(v)=>this.props.onOptionChange('seHaiBoundary', v)}>
								{LR_SEHAI_BOUNDARY_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-sanshi-select-field">
							<span>始入课</span>
							<Select size="small" dropdownMatchSelectWidth={false} value={opt.shiRuKe ? 1 : 0} onChange={(v)=>this.props.onOptionChange('shiRuKe', v === 1)}>
								{LR_SHIRUKE_OPTIONS.map((item)=><Option key={`shiruke_${item.value}`} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-sanshi-select-field">
							<span>年神排序</span>
							<Select size="small" dropdownMatchSelectWidth={false} value={opt.yearShenShaSort || 'sanyuan'} onChange={(v)=>this.props.onOptionChange('yearShenShaSort', v)}>
								{LR_YEAR_SHENSHA_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-sanshi-select-field" title={Number(opt.guireng) !== 0 ? '星历阳阴系只在贵人体系=六壬法贵人时生效;当前贵人体系下两档恒同' : undefined}>
							<span>昼夜阳阴{Number(opt.guireng) !== 0 ? '（仅六壬法贵人生效）' : ''}</span>
							{/* [Q-164/T-87·SS-19] 与独立六壬页同律置灰 */}
							<Select size="small" dropdownMatchSelectWidth={false} disabled={Number(opt.guireng) !== 0} value={opt.yinyangSystem || 'danmu'} onChange={(v)=>this.props.onOptionChange('yinyangSystem', v)}>
								{LR_YINYANG_SYSTEM_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-sanshi-select-field">
							<span>土旺衰</span>
							<Select size="small" dropdownMatchSelectWidth={false} value={opt.tuWangShuai || 'siji'} onChange={(v)=>this.props.onOptionChange('tuWangShuai', v)}>
								{LR_TUWANG_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
					</div>
				</XQSideSection>

				<div className="horosa-sanshi-action-row">
					<Button type="primary" onClick={this.props.clickPlot} loading={this.props.loading} disabled={this.props.loading}>起盘</Button>
					<Button onClick={this.props.clickSave}>保存</Button>
				</div>
			</div>
		);
	}
}

// [S4 已收敛 v3.10.0] SanShiBoardLayer 退役:盘面单源迁至共享 SanshiUnitedBoard(上游),
// 渲染隔离由下方 MemoSanshiUnitedBoard(React.memo,浅比)承接 —— 语义与原 wrapperPropsEqual 等价。
class SanShiUnitedMain extends Component{
	constructor(props){
		super(props);
		// 上次亲手设的排盘口径 —— 只有独立三式页读;三式择日里内嵌的那份恒从出厂值 / 共享字段现值起(理由见 SANSHI_PAGE_SETTINGS 注)。
		const savedOnly = this.usesSavedSettings() ? SANSHI_PAGE_SETTINGS.loadSaved() : {};
		// 外圈两项是组件自己的 state,不在 options 里:从 options 的播种里摘出来(否则 options 里多出两个没人读的陈旧副本,还会跟着事盘存下去)
		const { outerCoord: savedOuterCoord, showWeakSolid: savedShowWeakSolid, ...savedOptionKeys } = savedOnly;
		const defaultTimeAlg = normalizeTimeAlg(
			props
			&& props.fields
			&& props.fields.timeAlg
			&& props.fields.timeAlg.value
		);
		this.state = {
			loading: false,
			nongli: null,
			displaySolarTime: '',
			liureng: null,
			dunjia: null,
			taiyi: null,
			lrLayout: null,
			keData: null,
			sanChuan: null,
			localFields: null,
			plottedFields: null,
			hasPlotted: false,
			rightPanelTab: 'overview',
			outerCoord: savedOuterCoord !== undefined ? savedOuterCoord : 'ecliptic', // 外圈分宫:ecliptic(黄道,出厂值) | equatorial(赤道/赤经);上次亲手设的值
			showWeakSolid: savedShowWeakSolid !== undefined ? savedShowWeakSolid : true, // 外圈是否叠七政四余式「虚实」红绿点(出厂显示);上次亲手设的值
			liurengRefTab: 'dage',
			bagongSubTab: 'bagong', // 遁甲右栏内层子tab:八宫 / 用神 / 化解
			taiyiSubTab: 'overview', // 太乙右栏内层子tab:概览 / 十六宫 / 八门 / 断法
			bagongPalace: BAGONG_PALACE_ORDER[0],
			liurengRefBundle: null,
			liurengSnapshotInput: null, // 六壬断卦层快照入参(随 recalc 落 state,供存档/还原路径的 payload 复用)
			options: {
				mode: 'shi',   // [Q-164/SS-20 裁决 2026-09-18] 模式缺省改事局:与「盘类」缺省事局一致(此前页面「命局」与 AI 所见「事局」并存,缺省点保存不存三式事盘)
				timeAlg: defaultTimeAlg,
				sex: 1,
				guireng: 2,
				zodiacal: 0,
				siderealAyanamsa: '',
				hsys: 0,
				after23NewDay: defaultAfter23NewDay(),
				lateZiHourUseNextDay: defaultLateZiHourUseNextDay(),
				paiPanType: 3,
				zhiShiType: 0,
				yueJiaQiJuType: 0,
				qijuMethod: 'zhirun',
				kongMode: 'day',
				yimaMode: 'day',
				shiftPalace: 0,
				// 奇门流派/起局补充(默认=现行行为,零回归):盘式转盘 / 报数空 / 未封局 / 置闰满9天(≥9)即闰。
				school: '转盘',
				shuziReportNumber: '',
				fengJu: false,
				zhirunLeapDays: 9,
				taiyiStyle: 3,
				taiyiAccum: 0,
				taiyiTimeBasis: 'direct',   // [Q-107 A 裁决 2026-09-18] 缺省 direct=此前钉死值,字节零变;可选真太阳时(与独立太乙页同源)
				// 太乙博弈 + 流派(默认=关闭/全默认,字节不变零回归)。
				gameTheory: 0,
				taiyiSchool: { ...DEFAULT_TAIYI_SCHOOL },
				// 大六壬流派(默认=现行固定月将/晨昏分昼夜/仅下贼上,零回归)。
				yueJiangMethod: 'zhongqi',
				fenZhouYe: 'chenhun',
				seHaiMethod: 'app',
				seHaiBoundary: 'app',
				shiRuKe: false,
				yearShenShaSort: 'sanyuan',
				yinyangSystem: 'danmu',
				tuWangShuai: 'siji',
				// 上次亲手设的排盘口径(只并入确实保存过的键;没保存过的照旧走上面的缺省 / 共享字段现值)
				...savedOptionKeys,   // 仅独立三式页有值(择日内嵌实例为空;工作台下发走 applyOptions → setState,不落盘)
			},
			leftBoardWidth: 0,
			leftBoardHeight: 0,
			viewportHeight: getViewportHeight(),
			rightPanelHeight: 0,
		};
		this.unmounted = false;
		this.lastKey = '';
		this.lastRestoredCaseId = null;
		this.jieqiSeedPromises = {};
		this.jieqiYearSeeds = {};
		this.timeHook = {};
		this.lastRecalcSignature = '';
		this.lastRecalcError = null;
		this.refreshSeq = 0;
		this.pendingRefresh = null;
		this.panCache = new Map();
		this.lrBundleCache = {};
		this.outerDataCache = { chartKey: '', data: null };
		this.resizeObserver = null;
		this.prefetchSeedTimer = null;
		this.awaitingChartSync = false;
		this.pendingTimeFields = null;
		this.awaitingSyncTimer = null;
		this.pendingRecalcTimer = null;
		this.pendingRecalcPayload = null;
		this.pendingRecalcResolvers = [];
		this.pendingSnapshotTimer = null;
		this.lastExternalFieldsKey = '';
		this.taiyiCache = new Map();

		this.refreshAll = this.refreshAll.bind(this);
		this.genParams = this.genParams.bind(this);
		this.ensureJieqiSeed = this.ensureJieqiSeed.bind(this);
		this.prefetchJieqiSeedForFields = this.prefetchJieqiSeedForFields.bind(this);
		this.prefetchNongliForFields = this.prefetchNongliForFields.bind(this);
		this.resolveDisplaySolarTime = this.resolveDisplaySolarTime.bind(this);
		this.genJieqiParams = this.genJieqiParams.bind(this);
		this.getQimenOptions = this.getQimenOptions.bind(this);
		this.recalcByNongli = this.recalcByNongli.bind(this);
		this.performRecalcByNongli = this.performRecalcByNongli.bind(this);
		this.resolvePendingRecalc = this.resolvePendingRecalc.bind(this);
		this.cancelPendingRecalc = this.cancelPendingRecalc.bind(this);
		this.scheduleSnapshotSave = this.scheduleSnapshotSave.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
		// [YA v42] 紫微四化 tab 上报的盘+大运/流年选中态(实例字段,非 state:避免重渲循环);
		// tab 未打开过(antd 懒渲染)保持 null → 快照不产 [紫微四化] 段。
		this.ziweiSihuaSnapshotInput = null;
		this.handleZiweiSihuaSnapshotState = this.handleZiweiSihuaSnapshotState.bind(this);
		this.handleExternalFieldsSync = this.handleExternalFieldsSync.bind(this);
		this.syncFields = this.syncFields.bind(this);
		this.onFieldsChange = this.onFieldsChange.bind(this);
		this.onTimeChanged = this.onTimeChanged.bind(this);
		this.onTimeAlgChange = this.onTimeAlgChange.bind(this);
		this.onGenderChange = this.onGenderChange.bind(this);
		this.onOptionChange = this.onOptionChange.bind(this);
		this.onAstroFieldOptionChange = this.onAstroFieldOptionChange.bind(this);
		this.getTimeFieldsFromSelector = this.getTimeFieldsFromSelector.bind(this);
		this.clickPlot = this.clickPlot.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
		this.clickSave = this.clickSave.bind(this);
		this.renderQuickDock = this.renderQuickDock.bind(this);
		this.parseCasePayload = this.parseCasePayload.bind(this);
		this.restoreOptionsFromCurrentCase = this.restoreOptionsFromCurrentCase.bind(this);
		this.captureLeftBoardHost = this.captureLeftBoardHost.bind(this);
		this.captureRightPanel = this.captureRightPanel.bind(this);
		this.onOuterCoordChange = this.onOuterCoordChange.bind(this);
		this.handleWindowResize = this.handleWindowResize.bind(this);

		if(this.props.hook){
			this.props.hook.fun = (fields, chartObj)=>{
				if(this.unmounted){
					return;
				}
				this.restoreOptionsFromCurrentCase();
				this.handleExternalFieldsSync(fields, chartObj);
			};
			// PERF-R9 Ship 7:三式合参同为【两段式】—— stage-1(/nongli/time)先回来才能推三盘。
			// 与主 /chart 无关,在 /chart 返回之前并行发出即把 stage-1 摘出关键路径。
			// 闸:horosa.perf.prewarmRequests(关=此函数不被调用,逐字节旧序)。
			this.props.hook.prewarmRequests = (flds)=>{
				if(this.unmounted){
					return;
				}
				try{
					this.prefetchNongliForFields(flds || this.props.fields);
				}catch(e){ /* 预热失败无害 */ }
			};
			// [三式步进预取](horosa_sanshi_step_prefetch_v1)stage-1 三段链,与主链同参同键:
			// nongli' → kinqimen 后端盘'(仅时家转盘等后端模式;本地 calcDunJia 家族无 HTTP 免热)
			//         + 太乙盘'。两 HTTP 经 kentangCache 收口=预取即入缓存,真步进网络归零;
			// 六壬纯本地零网络无需预热。登记进共享调度器(白名单闸/latest-wins/预算),
			// armStepPrefetch 全局武装链(选步长/settle/切页签)登记后自动生效。
			// [Windows-only 增量] 第二条任务 sanshi:jieqiseed 保留(我方 R9 Ship7 首创):
			// 链式任务把 this.jieqiYearSeeds 现值传给 fetchQimenPan,但**不会去补缺失的年种子**;
			// 跨年步进时缺种子那一步仍要现付 /jieqi/year。两者互补,不重复(端点不同、键不同)。
			this._sanshiStepPrefetcher = (steppedFields)=>{
				if(this.unmounted || !steppedFields){
					return [];
				}
				let params = null;
				try{ params = this.genParams(steppedFields); }catch(e){ params = null; }
				if(!params){
					return [];
				}
				const tasks = [{
					name: 'sanshi:stage1',
					path: '/nongli/time',
					run: async ()=>{
						let nongli = getNongliLocalCache(params);
						if(!nongli){
							nongli = await fetchPreciseNongli(params).then((r)=>{
								if(r){ setNongliLocalCache(params, r); }
								return r;
							}).catch(()=>null);
						}
						if(!nongli || this.unmounted){
							return null;
						}
						const jobs = [];
						try{
							const qimenOptions = this.getQimenOptions();
							const o = qimenOptions || {};
							const kinq = !isQimenLocalRoute(o);   // [Q-154] 路由单源:本地路由无 HTTP 免热
							if(kinq){
								const year = steppedFields.date && steppedFields.date.value
									? parseInt(steppedFields.date.value.format('YYYY'), 10) : null;
								const displaySolarTime = await this.resolveDisplaySolarTime(params, nongli);
								// isDiurnal 取现值 chartWrap(±数步内昼夜大概率不变=同键;跨昼夜界偶发白预取无害)。
								const isDiurnal = extractIsDiurnalFromChartWrap(this.props.chartObj || this.props.chart || null);
								jobs.push(fetchQimenPan(steppedFields, nongli, qimenOptions, {
									year,
									jieqiYearSeeds: this.jieqiYearSeeds,
									isDiurnal,
									displaySolarTime,
								}).catch(()=>null));
							}
						}catch(e){ /* 奇门预热构参失败静默 */ }
						try{
							jobs.push(this.getKintaiyiPan(steppedFields, nongli, {
								...(this.state.options || {}),
							}).catch(()=>null));
						}catch(e){ /* 太乙预热失败静默 */ }
						if(jobs.length){
							await Promise.all(jobs);
						}
						return true;
					},
				}];
				try{
					const qimenOptions = this.getQimenOptions();
					if(needJieqiYearSeed(qimenOptions) && steppedFields.date && steppedFields.date.value){
						const year = parseInt(steppedFields.date.value.format('YYYY'), 10);
						const seedParams = (year && !Number.isNaN(year)) ? this.genJieqiParams(steppedFields, year) : null;
						if(seedParams){
							tasks.push({
								name: 'sanshi:jieqiseed',
								path: '/jieqi/year',
								run: ()=> fetchPreciseJieqiSeed(seedParams),
							});
						}
					}
				}catch(e){ /* 种子构参失败静默跳过 */ }
				return tasks;
			};
			registerStepPrefetcher('sanshiunited', this._sanshiStepPrefetcher);
		}
	}

	// 快捷栏契约:「此刻起盘」:局时=当下并立即重排。借道 clickPlot 全管道(同步/预取/兜底定时器),
	// 起盘瞬间临时屏蔽左栏时间草稿(timeHook)——点「此刻」语义就是 NOW,不该被旧草稿覆盖。
	clickPlotNow(){
		if(this.state.loading){
			return;
		}
		const base = this.state.localFields || this.props.fields;
		if(!base){
			return;
		}
		const now = new DateTime();
		this.pendingTimeFields = {
			...base,
			date: { value: now.clone() },
			time: { value: now.clone() },
			ad: { value: now.ad },
		};
		const hookGet = this.timeHook && this.timeHook.getValue;
		if(hookGet){
			this.timeHook.getValue = ()=>null;
		}
		try{
			this.clickPlot();
		}finally{
			if(hookGet){
				this.timeHook.getValue = hookGet;
			}
		}
	}

	// 快捷栏契约:右栏 tab 镜像(概览/太乙/六壬/遁甲)撤除,只留本页没有的动词。
	renderQuickDock(){
		return (
			<QuickDockBar
				page="sanshi"
				className="horosa-sanshi-quick-dock"
				hasResult={!!(this.state.hasPlotted && this.state.dunjia)}
				primary={{ key: 'plot', label: '起盘', disabled: this.state.loading, onClick: this.clickPlot }}
				extras={[
					{ key: 'nowPlot', label: '此刻起盘', icon: 'quickTransit', needsResult: false, disabled: this.state.loading, onClick: ()=>this.clickPlotNow() },
				]}
				save={this.clickSave}
				dispatch={this.props.dispatch}
			/>
		);
	}

	async resolveDisplaySolarTime(params, primaryNongli){
		if(!params){
			return safe(primaryNongli && primaryNongli.birth, '');
		}
		const current = safe(primaryNongli && primaryNongli.birth, '');
		if(normalizeTimeAlg(params.timeAlg) === 0){
			return current;
		}
		const solarParams = buildDisplaySolarParams(params);
		const cachedSolar = getNongliLocalCache(solarParams);
		if(cachedSolar && cachedSolar.birth){
			return safe(cachedSolar.birth, current);
		}
		try{
			const solarNongli = await fetchPreciseNongli(solarParams);
			if(solarNongli){
				setNongliLocalCache(solarParams, solarNongli);
			}
			return safe(solarNongli && solarNongli.birth, current);
		}catch(e){
			return current;
		}
	}

	getCachedDunJia(fields, nongli, qimenOptions, year, isDiurnal, displaySolarTime){
		const key = [
			getFieldKey(fields),
			getNongliKey(nongli),
			getQimenOptionsKey(qimenOptions),
			`${year || ''}`,
			`${safe(isDiurnal, '')}`,
			`${safe(displaySolarTime, '')}`,
			// [Q-155] 种子签名(同独立页 getCachedPan):种子异步到达后键变 → 不命中缺种子时算出的退化盘。
			jieqiSeedSignature(this.jieqiYearSeeds),
		].join('|');
		if(this.panCache.has(key)){
			return this.panCache.get(key);
		}
		// ctx 与独立页 DunJiaMain.getContext 同构(含 displaySolarTime),否则本地年/月/日家盘与独立页分叉。
		const pan = calcDunJia(fields, nongli, qimenOptions, {
			year,
			jieqiYearSeeds: this.jieqiYearSeeds,
			isDiurnal,
			displaySolarTime,
		});
		this.panCache.set(key, pan);
		if(this.panCache.size > 48){
			const firstKey = this.panCache.keys().next().value;
			if(firstKey){
				this.panCache.delete(firstKey);
			}
		}
		return pan;
	}

	async getKinqimenDunJia(fields, nongli, qimenOptions, year, isDiurnal, displaySolarTime){
		const fallbackPan = this.getCachedDunJia(fields, nongli, qimenOptions, year, isDiurnal, displaySolarTime);
		// 🔴 路由与独立页 DunJiaMain.getResolvedPan 完全一致(否则结果分叉=用户报的「三式合一遁甲≠独立遁甲」):
		//   本地 calcDunJia ← 年/月/日/刻/金函家(各家局法) 或 飞盘/混合/报数(后端不支持) 或 七组本地口径任一非缺省([Q-154]);
		//   后端 fetchQimenPan ← 时家/综合·转盘·全缺省口径(保「时家=转盘」原有行为零回归)。
		// 本地 calcDunJia 返回的 pan 不带 source 字段(source:'kinqimen' 仅后端合并路径有),故本地分支不校验 source。
		const o = qimenOptions || {};
		// [Q-154] 路由单源 isQimenLocalRoute(DunJiaCalc,与独立页/择日弹窗同判据):本地家/飞盘/混合/报数/七组本地口径任一非缺省 → 本地。
		const localOnly = isQimenLocalRoute(o);
		if(localOnly){
			if(!fallbackPan){
				throw new Error('sanshi.qimen.kinqimen_unavailable');
			}
			return this.applySanshiFaRelated(fallbackPan, o);
		}
		const backendPan = await fetchQimenPan(fields, nongli, qimenOptions, {
			year,
			jieqiYearSeeds: this.jieqiYearSeeds,
			isDiurnal,
			displaySolarTime,
		});
		const pan = normalizeKinqimenData(backendPan, fallbackPan, qimenOptions, nongli);
		if(!pan || pan.source !== 'kinqimen'){
			throw new Error('sanshi.qimen.kinqimen_unavailable');
		}
		return this.applySanshiFaRelated(pan, o);
	}

	// [H-A] 三式相关人员挂 pan(与独立页 applyFaRelatedToPan 同单源语义:法奇门 DunJiaFaCalc 读 pan.faRelatedPeople 数组)。
	// 三式侧输入为文本(逗号/空格分隔生年天干),此处解析为十干数组;空=空数组(显式)防兜底读独立页全局残留。
	applySanshiFaRelated(pan, opt){
		if(!pan){ return pan; }
		const raw = `${(opt && opt.faRelatedPeople) || ''}`;
		const gans = raw.split(/[\s,，、]+/).map((x)=>x.trim()).filter((x)=>'甲乙丙丁戊己庚辛壬癸'.indexOf(x) >= 0);
		pan.faRelatedPeople = gans;
		return pan;
	}

	async getKintaiyiPan(fields, nongli, options){
		const pan = await fetchTaiyiPan(fields, nongli, {
			style: options && options.taiyiStyle !== undefined ? options.taiyiStyle : 3,
			tn: options && options.taiyiAccum !== undefined ? options.taiyiAccum : 0,
			sex: options && options.sex === 0 ? '女' : '男',
			// [Q-107 A 裁决 2026-09-18] 太乙时间基准:此前钉死 direct(独立太乙页却有下拉)→ 三式太乙区补同源控件 taiyiTimeBasis(缺省 direct 零回归);
			// 仍不随盘 timeAlg 串改(盘真太阳时只作用于奇门),用户显式选「真太阳时」才换基准。
			timeBasis: options && options.taiyiTimeBasis === 'trueSolar' ? 'trueSolar' : 'direct',
			after23NewDay: options && options.after23NewDay !== undefined ? options.after23NewDay : defaultAfter23NewDay(),
			lateZiHourUseNextDay: options && options.lateZiHourUseNextDay !== undefined ? options.lateZiHourUseNextDay : defaultLateZiHourUseNextDay(),
			// 博弈分析(去硬编码:对齐独立 TaiYiMain;默认 0=关闭,与原行为一致)。
			gameTheory: options && options.gameTheory === 1 ? 1 : 0,
		});
		if(!pan || pan.source !== 'kintaiyi'){
			throw new Error('sanshi.taiyi.kintaiyi_unavailable');
		}
		// 太乙流派覆盖层(对齐独立 TaiYiMain.recalc):以 base pan 为底按所选流派开关覆盖受影响神煞 + 几何重算主客算;
		// 默认全 default → applyTaiyiSchool 为空操作,字节不变(零回归)。
		const ov = applyTaiyiSchool(pan, options && options.taiyiSchool);
		return ov.pan || pan;
	}

	// [A7·性能] 重 wrapper sCU(照 BaZi/ZiWeiMain 既有范式):全 props 机械浅比(函数型视为恒等,
	// 开关 horosa.perf.chartSCU 关=恒重渲旧行为),state 引用变照常重渲(setState 恒换引用)。
	// 收益:激活态下宿主无关 dispatch 不再整树白跑本重组件。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){ return true; }
		return !wrapperPropsEqual(this.props, nextProps);
	}

	componentDidMount(){
		this.unmounted = false;
		this.restoreOptionsFromCurrentCase(true);
		this._after23BoundaryUserOverrode = false; // 用户拍板:左栏改过 after23NewDay 后,全局事件不再覆盖
		this._lateZiHourUserOverrode = false; // v2.2.1: 同款时柱开关局部覆盖语义
		window.addEventListener('resize', this.handleWindowResize);
		window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		this._dayBoundaryListener = (ev) => {
			if(this._after23BoundaryUserOverrode) return;
			const v = ev && ev.detail ? ev.detail.after23NewDay : null;
			if((v === 0 || v === 1) && typeof this.onOptionChange === 'function'){
				this.onOptionChange('after23NewDay', v, { fromGlobal: true });
			}
		};
		window.addEventListener('horosa:day-boundary-changed', this._dayBoundaryListener);
		this._lateZiHourListener = (ev) => {
			if(this._lateZiHourUserOverrode) return;
			const v = ev && ev.detail ? ev.detail.lateZiHourUseNextDay : null;
			if((v === 0 || v === 1) && typeof this.onOptionChange === 'function'){
				this.onOptionChange('lateZiHourUseNextDay', v, { fromGlobal: true });
			}
		};
		window.addEventListener('horosa:late-zi-hour-mode-changed', this._lateZiHourListener);
		this.handleWindowResize();
		const activeFields = this.state.localFields || this.props.fields;
		this.prefetchJieqiSeedForFields(activeFields);
		this.prefetchNongliForFields(activeFields);
	}

	componentDidUpdate(prevProps){
		this.restoreOptionsFromCurrentCase();
		const chartChanged = (prevProps.chartObj !== this.props.chartObj) || (prevProps.chart !== this.props.chart);
		// 🔴 [外圈随时间校正](horosa_sanshi_outer_follow_time_v1)此处**不得**再加 awaitingChartSync 前置条件。
		// 病史(用户实测三次仍报「改时间盘不动」):awaitingChartSync 只在 clickPlot 的 needChartSync
		// 分支置起,而实时传导路径下它恒为 false —— onTimeChanged 先 syncFields 把新时间写进
		// state.fields,待 clickPlot 在 setState 回调里跑时 props.fields 已是新值,maybePatchDateTime
		// 比出「相等」⇒ patchFields 空 ⇒ needChartSync=false ⇒ 闸门没置起 ⇒ /chart 回流时这条
		// 校正路径整个被跳过。表现:中栏表头(走三式自己的 /nongli/time)跟着变、奇门与太乙盘也重取,
		// 唯独**外圈星度(顶/升/金/日/月,唯一数据源是 props.chartObj)冻在起盘那一刻**;同一时辰内
		// 奇门局与太乙局本就不变,于是整盘看上去「完全没动」。四分钟一档最明显(MC 每 4 分钟约走 1°)。
		// 安全性:refreshAll → performRecalcByNongli 内有 recalcSignature 去重,chartObj 实质没变
		// (同一时刻重复回流)即瞬时 no-op —— 前提是 outerChartKey 不含随机 chartId(见 getOuterChartKey)。
		if(this.state.hasPlotted && chartChanged){
			if(this.awaitingSyncTimer){
				clearTimeout(this.awaitingSyncTimer);
				this.awaitingSyncTimer = null;
			}
			const fields = this.state.localFields || this.props.fields;
			this.awaitingChartSync = false;
			this.refreshAll(fields, true);
		}
	}

	componentWillUnmount(){
		this.unmounted = true;
		if(this._sanshiStepPrefetcher){
			try{ unregisterStepPrefetcher('sanshiunited', this._sanshiStepPrefetcher); }catch(e){ /* ignore */ }
			this._sanshiStepPrefetcher = null;
		}
		window.removeEventListener('resize', this.handleWindowResize);
		window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		if(this._dayBoundaryListener){
			window.removeEventListener('horosa:day-boundary-changed', this._dayBoundaryListener);
		}
		if(this._lateZiHourListener){
			window.removeEventListener('horosa:late-zi-hour-mode-changed', this._lateZiHourListener);
		}
		if(this.prefetchSeedTimer){
			clearTimeout(this.prefetchSeedTimer);
			this.prefetchSeedTimer = null;
		}
		if(this.awaitingSyncTimer){
			clearTimeout(this.awaitingSyncTimer);
			this.awaitingSyncTimer = null;
		}
		this.cancelPendingRecalc(false);
		if(this.pendingSnapshotIdle && typeof cancelIdleCallback === 'function'){
			try{ cancelIdleCallback(this.pendingSnapshotIdle); }catch(e){ /* ignore */ }
			this.pendingSnapshotIdle = null;
		}
		if(this.pendingSnapshotTimer){
			clearTimeout(this.pendingSnapshotTimer);
			this.pendingSnapshotTimer = null;
		}
		if(this.resizeObserver){
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}
	}

	captureLeftBoardHost(node){
		if(this.resizeObserver){
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}
		this.leftBoardHost = node || null;
		if(this.leftBoardHost && typeof ResizeObserver !== 'undefined'){
			this.resizeObserver = new ResizeObserver(()=>{
				this.handleWindowResize();
			});
			this.resizeObserver.observe(this.leftBoardHost);
		}
		this.handleWindowResize();
	}

	captureRightPanel(node){
		this.rightPanelHost = node || null;
		this.handleWindowResize();
	}

	handleWindowResize(){
		const viewportHeight = getViewportHeight();
		const leftBoardWidth = this.leftBoardHost ? this.leftBoardHost.clientWidth : 0;
		const leftBoardHeight = this.leftBoardHost ? this.leftBoardHost.clientHeight : 0;
		// rect.top 属视觉域,与布局域 viewportHeight 相减前先除回布局域(标准化 zoom 引擎下 rect 已×z)。
		const rightTop = this.rightPanelHost ? this.rightPanelHost.getBoundingClientRect().top / (getEffectiveScale() || 1) : 0;
		const fallbackPanelHeight = Math.max(visualFloorPx(420), viewportHeight - 120);
		const rightPanelHeight = rightTop > 0
			? Math.max(220, viewportHeight - rightTop - 8)
			: fallbackPanelHeight;
		const changed = Math.abs((this.state.leftBoardWidth || 0) - leftBoardWidth) >= 2
			|| Math.abs((this.state.leftBoardHeight || 0) - leftBoardHeight) >= 2
			|| Math.abs((this.state.viewportHeight || 0) - viewportHeight) >= 2
			|| Math.abs((this.state.rightPanelHeight || 0) - rightPanelHeight) >= 2;
		if(changed){
			this.setState({
				leftBoardWidth,
				leftBoardHeight,
				viewportHeight,
				rightPanelHeight,
			});
		}
	}

	getActiveFields(){
		return this.state.localFields || this.props.fields || {};
	}

	getChartNongliFallback(){
		const chartWrap = this.props.chartObj || this.props.chart || null;
		const chart = chartWrap && chartWrap.chart ? chartWrap.chart : chartWrap;
		if(!chart || !chart.nongli){
			return null;
		}
		return {
			...chart.nongli,
		};
	}

	parseCasePayload(raw){
		if(!raw){
			return null;
		}
		if(typeof raw === 'string'){
			try{
				return JSON.parse(raw);
			}catch(e){
				return null;
			}
		}
		if(typeof raw === 'object'){
			return raw;
		}
		return null;
	}

	restoreOptionsFromCurrentCase(force){
		const store = getStore();
		const userState = store && store.user ? store.user : null;
		const currentCase = userState && userState.currentCase ? userState.currentCase : null;
		if(!currentCase || !currentCase.cid || !currentCase.cid.value){
			return;
		}
		const cid = `${currentCase.cid.value}`;
		const updateTime = currentCase.updateTime && currentCase.updateTime.value ? `${currentCase.updateTime.value}` : '';
		// 载入代次后缀走共用件(kentangCaseSave.caseApplySeqSuffix):不带它则同一条记录第二次载入
		// 会被下面那道去重守卫拦掉,屏幕上仍是用户后来新起的卦。禁另抄一份。
		const caseVersion = `${cid}|${updateTime}${caseApplySeqSuffix(userState)}`;
		if(!force && caseVersion === this.lastRestoredCaseId){
			return;
		}
		const sourceModule = currentCase.sourceModule ? currentCase.sourceModule.value : null;
		const caseType = currentCase.caseType ? currentCase.caseType.value : null;
		// 🔴 按本实例 scope 判(曾硬编码 'sanshiunited':择日宿主实例也吃主三式事盘——
		// 初始盘被劫持,审查实抓;DunJiaMain scope 判同律)
		const scope = this.props.techniqueScope || 'sanshiunited';
		if(sourceModule !== scope && caseType !== scope){
			return;
		}
		const payload = this.parseCasePayload(currentCase.payload ? currentCase.payload.value : null);
		if(!payload){
			return;
		}
			// 事盘里没有的口径键回**出厂值**,而不是留着本机保存的偏好:本页口径现在跨会话保留,按出厂口径存下的旧案不带后来才有的键,
			// 不回出厂就会被按你现在的偏好重排(盘变了,与存档里的快照也对不上)。时间算法的出厂值 = 跨页共享字段的现值(与构造函数同一来源)。
			const { outerCoord: _oc, showWeakSolid: _sw, ...factoryOptionKeys } = SANSHI_PAGE_SETTINGS.defaults();
			factoryOptionKeys.timeAlg = normalizeTimeAlg(this.props.fields && this.props.fields.timeAlg ? this.props.fields.timeAlg.value : 0);
			const options = {
				...(this.state.options || {}),
				...factoryOptionKeys,
			};
			if(payload.options && typeof payload.options === 'object'){
				if(payload.options.mode === 'ming' || payload.options.mode === 'shi'){
					options.mode = payload.options.mode;
				}
				if(payload.options.timeAlg === 0 || payload.options.timeAlg === 1){
					options.timeAlg = payload.options.timeAlg;
				}
				if(payload.options.sex === 0 || payload.options.sex === 1){
					options.sex = payload.options.sex;
				}
				if(payload.options.guireng >= 0 && payload.options.guireng <= 4){
					options.guireng = payload.options.guireng;
				}
				if(payload.options.zodiacal === 0 || payload.options.zodiacal === 1){
					options.zodiacal = payload.options.zodiacal;
				}
				if(typeof payload.options.siderealAyanamsa === 'string'){
					options.siderealAyanamsa = payload.options.siderealAyanamsa;
				}
				if(payload.options.hsys !== undefined && payload.options.hsys !== null){
					options.hsys = payload.options.hsys;
				}
				if(payload.options.after23NewDay === 0 || payload.options.after23NewDay === 1){
					options.after23NewDay = payload.options.after23NewDay;
				}
				if(payload.options.paiPanType !== undefined){
					options.paiPanType = payload.options.paiPanType;
				}
				if(payload.options.zhiShiType !== undefined){
					options.zhiShiType = payload.options.zhiShiType;
				}
				if(payload.options.yueJiaQiJuType !== undefined){
					options.yueJiaQiJuType = payload.options.yueJiaQiJuType;
				}
				if(payload.options.qijuMethod){
					options.qijuMethod = payload.options.qijuMethod;
				}
				if(payload.options.kongMode){
					options.kongMode = payload.options.kongMode;
				}
				if(payload.options.yimaMode){
					options.yimaMode = payload.options.yimaMode;
				}
				if(payload.options.shiftPalace !== undefined){
					options.shiftPalace = payload.options.shiftPalace;
				}
				if(payload.options.taiyiStyle !== undefined){
					options.taiyiStyle = payload.options.taiyiStyle;
				}
				if(payload.options.taiyiAccum !== undefined){
					options.taiyiAccum = payload.options.taiyiAccum;
				}
				if(payload.options.taiyiTimeBasis === 'direct' || payload.options.taiyiTimeBasis === 'trueSolar'){   // [Q-107 A] 存案还原太乙时间基准
					options.taiyiTimeBasis = payload.options.taiyiTimeBasis;
				}
				// 奇门流派/起局补充
				if(payload.options.school){
					options.school = payload.options.school;
				}
				if(payload.options.shuziReportNumber !== undefined){
					options.shuziReportNumber = payload.options.shuziReportNumber;
				}
				if(payload.options.fengJu !== undefined){
					options.fengJu = !!payload.options.fengJu;
				}
				if(payload.options.zhirunLeapDays !== undefined){
					options.zhirunLeapDays = payload.options.zhirunLeapDays;
				}
				// 太乙博弈 + 流派
				if(payload.options.gameTheory === 0 || payload.options.gameTheory === 1){
					options.gameTheory = payload.options.gameTheory;
				}
				if(payload.options.taiyiSchool && typeof payload.options.taiyiSchool === 'object'){
					options.taiyiSchool = normalizeTaiyiSchool(payload.options.taiyiSchool);
				}
				// 大六壬流派
				if(payload.options.yueJiangMethod){
					options.yueJiangMethod = payload.options.yueJiangMethod;
				}
				if(payload.options.fenZhouYe){
					options.fenZhouYe = payload.options.fenZhouYe;
				}
				if(payload.options.seHaiMethod){
					options.seHaiMethod = payload.options.seHaiMethod;
				}
				if(payload.options.seHaiBoundary){
					options.seHaiBoundary = payload.options.seHaiBoundary;
				}
				if(payload.options.shiRuKe !== undefined){
					options.shiRuKe = !!payload.options.shiRuKe;
				}
				if(payload.options.yearShenShaSort){
					options.yearShenShaSort = payload.options.yearShenShaSort;
				}
				if(payload.options.yinyangSystem){
					options.yinyangSystem = payload.options.yinyangSystem;
				}
				// [QA1] 🔴 奇门键集驱动灌注(根治手写白名单漏新键=存档载入丢设置):
				// QIMEN_OPTIONS 默认表的每个键都从存档取——独立页 restore 以 Object.keys(DEFAULT_OPTIONS)
				// 驱动的同构范式,新增奇门键零维护自动跟随;已手写键幂等覆盖同值无害。
				Object.keys(QIMEN_OPTIONS).forEach((qk)=>{
					if(payload.options[qk] !== undefined){
						options[qk] = payload.options[qk];
					}
				});
				if(payload.options.tuWangShuai){
					options.tuWangShuai = payload.options.tuWangShuai;
				}
			}
		const normalizedOptions = normalizeKenQimenOptions(options);
		this.lastRestoredCaseId = caseVersion;
		const patchFields = {};
		if(options.zodiacal !== undefined){
			patchFields.zodiacal = { value: options.zodiacal };
		}
		if(options.siderealAyanamsa !== undefined){
			patchFields.siderealAyanamsa = { value: options.siderealAyanamsa };
		}
		if(options.hsys !== undefined){
			patchFields.hsys = { value: options.hsys };
		}
		if(options.sex !== undefined){
			patchFields.gender = { value: options.sex };
		}
		if(options.timeAlg !== undefined){
			patchFields.timeAlg = { value: normalizeTimeAlg(options.timeAlg) };
		}
		const nextLocalFields = {
			...this.getActiveFields(),
			...patchFields,
		};
		if(Object.keys(patchFields).length){
			this.onFieldsChange(patchFields, true);
		}
		this.setState({
			options: normalizedOptions,
			hasPlotted: true,
			localFields: nextLocalFields,
			plottedFields: nextLocalFields,
		}, ()=>{
			if(this.state.nongli){
				this.recalcByNongli(nextLocalFields, this.state.nongli, normalizedOptions);
			}else{
				this.refreshAll(nextLocalFields, true);
			}
		});
	}

	handleExternalFieldsSync(fields, chartObj){
		const nextFields = fields || this.props.fields;
		if(!nextFields){
			return;
		}
		const chartKey = getOuterChartKey(chartObj || this.props.chartObj || this.props.chart || null);
		const syncKey = `${getFieldSyncKey(nextFields)}|${chartKey}`;
		if(syncKey && syncKey === this.lastExternalFieldsKey && !this.awaitingChartSync){
			return;
		}
		this.lastExternalFieldsKey = syncKey;
		if(this.awaitingSyncTimer){
			clearTimeout(this.awaitingSyncTimer);
			this.awaitingSyncTimer = null;
		}
		this.awaitingChartSync = false;
		this.pendingTimeFields = null;
		const currentOptions = this.state.options || {};
		const nextOptions = {
			...currentOptions,
		};
		const fieldGender = nextFields.gender ? nextFields.gender.value : null;
		if(fieldGender === 0 || fieldGender === 1){
			nextOptions.sex = fieldGender;
		}
		const shouldReplot = !!this.state.hasPlotted;
		const patch = {
			localFields: nextFields,
			options: nextOptions,
		};
		if(shouldReplot){
			patch.plottedFields = nextFields;
			patch.loading = true;
		}
		this.setState(patch, ()=>{
			this.prefetchNongliForFields(nextFields);
			this.prefetchJieqiSeedForFields(nextFields, nextOptions);
			if(!shouldReplot){
				return;
			}
			setTimeout(()=>{
				if(this.unmounted){
					return;
				}
				this.refreshAll(nextFields, true);
			}, 0);
		});
	}

	syncFields(field){
		if(!this.props.dispatch){
			return;
		}
		const flds = {
			...(this.props.fields || {}),
			...(field || {}),
		};
		this.props.dispatch({
			type: 'astro/save',
			payload: {
				fields: flds,
			},
		});
	}

	onFieldsChange(field, requestMode){
		if(this.props.dispatch){
			const requestOptions = (typeof requestMode === 'object' && requestMode)
				? requestMode
				: {
					silentRequest: !!requestMode,
					nohook: !!requestMode,
				};
			const silentRequest = !!requestOptions.silentRequest;
			const nohook = !!requestOptions.nohook;
			const flds = {
				...(this.props.fields || {}),
				...field,
			};
			const payload = silentRequest ? {
				...flds,
				__requestOptions: {
					silent: true,
				},
				nohook,
			} : flds;
			this.props.dispatch({
				type: 'astro/fetchByFields',
				payload,
			});
		}
	}

	onTimeChanged(value){
		const dt = value.time;
		const confirmed = !!value.confirmed;
		const base = this.props.fields || {};
		const zoneValue = normalizeZoneOffset(dt.zone, safe(base.zone && base.zone.value, '+08:00'));
		const localFields = {
			...base,
			date: { value: dt.clone() },
			time: { value: dt.clone() },
			ad: { value: dt.ad },
			zone: { value: zoneValue },
		};
		this.pendingTimeFields = localFields;
		// [时间即时传导](horosa_live_time_propagation_v1)用户定版语义:
		//   · **尚未起盘**:改时间只更新草稿,中栏保持「点击起盘」态 —— 首盘必须显式点「确定」/「起盘」;
		//   · **已经起盘**:改时间即刻按新时间重算中栏与右栏(方便连续进退),无需再点确定。
		// 旧行为只认 confirmed(点「确定」/内联步进才带 true;Popover 里改年月日时分秒带 false)
		// ⇒ 用户实告「时间改了盘不动,只有直接时间那栏变」。confirmed 与否不再决定「算不算」,
		// 只决定「是不是一次显式提交」——已起盘态下两者走同一条重算链,语义因此统一。
		const liveReplot = !confirmed && !!this.state.hasPlotted;
		if(confirmed || liveReplot){
			this.setState({ localFields }, ()=>{
				// 与“起盘”按钮保持一致：点击“确定”后直接按最新时间起盘。
				this.clickPlot();
			});
			const syncedFields = {
				date: { value: dt.clone() },
				time: { value: dt.clone() },
				ad: { value: dt.ad },
				zone: { value: zoneValue },
			};
			this.syncFields(syncedFields);
			this.onFieldsChange({
				...syncedFields,
				// [R3-A2] 步进方向提示只进 fetchByFields 链(syncFields 的 astro/save 不携带)
				...(value.step ? { __stepHint: value.step } : {}),
			}, {
				silentRequest: true,
				nohook: true,
			});
			this.prefetchNongliForFields(localFields);
			this.prefetchJieqiSeedForFields(localFields);
		}
	}

	onTimeAlgChange(val){
		const nextVal = normalizeTimeAlg(val);
		this.onOptionChange('timeAlg', nextVal);
		this.jieqiYearSeeds = {};
		this.jieqiSeedPromises = {};
		this.panCache.clear();
		this.taiyiCache.clear();
		this.lastRecalcSignature = '';
		this.lastKey = '';
		this.onFieldsChange({
			timeAlg: { value: nextVal },
		}, true);
		const localFields = {
			...this.getActiveFields(),
			timeAlg: { value: nextVal },
		};
		this.setState({ localFields }, ()=>{
			this.prefetchNongliForFields(localFields);
			this.prefetchJieqiSeedForFields(localFields);
		});
	}

	onGenderChange(val){
		this.onOptionChange('sex', val);
		this.onFieldsChange({
			gender: { value: val },
		}, true);
	}

		onOptionChange(key, value, opts){
			// 年/月/日家(paiPanType 0/1/2)走本地 calcDunJia 各家局法(与独立遁甲同源),不依赖后端 → 全部放行,与独立页排盘选项一致。
			// 用户拍板: 左栏改过 after23NewDay 后,全局事件不再覆盖。
			if(key === 'after23NewDay' && !(opts && opts.fromGlobal)){
				this._after23BoundaryUserOverrode = true;
			}
			// v2.2.1: 时柱开关同款局部覆盖
			if(key === 'lateZiHourUseNextDay' && !(opts && opts.fromGlobal)){
				this._lateZiHourUserOverrode = true;
			}
			// 用户亲手改的口径 → 落盘(全局广播带 fromGlobal,不落;非设置键会被 store 忽略)。
			// 太乙流派是一张表:只落这次亲手改的那个子键(opts.subKey),以库里那份为底 —— 当前 state 里的表可能刚被事盘回灌过。
			if(!(opts && opts.fromGlobal) && this.usesSavedSettings()){
				if(key === 'taiyiSchool' && opts && opts.subKey){
					SANSHI_PAGE_SETTINGS.saveMapEntry('taiyiSchool', opts.subKey, (value || {})[opts.subKey]);
				}else{
					SANSHI_PAGE_SETTINGS.save({ [key]: value });
				}
			}
			const options = normalizeKenQimenOptions({
				...(this.state.options || {}),
				[key]: value,
			});
		this.setState({ options }, ()=>{
			if(key === 'after23NewDay' || key === 'lateZiHourUseNextDay' || key === 'paiPanType' || key === 'qijuMethod'){
				const flds = this.getActiveFields();
				this.prefetchNongliForFields(flds);
				this.prefetchJieqiSeedForFields(flds, options);
				// after23NewDay / lateZi 切换必须真正重算(prefetch 只填 cache,不重画盘)
				if((key === 'after23NewDay' || key === 'lateZiHourUseNextDay') && this.state.hasPlotted){
					this.refreshAll(flds, true);
				}
			}
			// 🔴 选项改了不重算根治:以下计算型控件都已进 recalcSignature(getQimenOptions/getKintaiyiPan/六壬 layout 消费),
			// 但 refreshAll 的 lastKey 只含 field/sex/after23/timeAlg → 不强制重算则改值后盘面纹丝不动(用户核心诉求)。
			// 凡能改变任一子盘(奇门/太乙/六壬)计算结果的 key,改值即 refreshAll(force) 真重算重画;默认值时盘与改前一致(零回归)。
			if(this.state.hasPlotted && SANSHI_RECALC_OPTION_KEYS.has(key)){
				this.refreshAll(this.getActiveFields(), true);
			}
		});
	}

	onAstroFieldOptionChange(key, value){
		this.onOptionChange(key, value);
		this.onFieldsChange({
			[key]: { value },
		}, true);
		const localFields = {
			...this.getActiveFields(),
			[key]: { value },
		};
		this.setState({ localFields });
	}

	// 黄道复合值(回归 / 恒星:ayanāṃśa)→ 同步 zodiacal + siderealAyanamsa,单次请求(避免连续 onOptionChange 因 setState 异步互相覆盖)。
	onAstroZodiacalChange(val){
		const parsed = AstroConst.parseZodiacSelectValue(val);
		const options = normalizeKenQimenOptions({
			...(this.state.options || {}),
			zodiacal: parsed.zodiacal,
			siderealAyanamsa: parsed.siderealAyanamsa,
		});
		const patch = {
			zodiacal: { value: parsed.zodiacal },
			siderealAyanamsa: { value: parsed.siderealAyanamsa },
		};
		const localFields = {
			...this.getActiveFields(),
			...patch,
		};
		this.setState({ options, localFields });
		this.onFieldsChange(patch, true);
	}

	getTimeFieldsFromSelector(baseFields){
		if(!this.timeHook || typeof this.timeHook.getValue !== 'function'){
			return null;
		}
		const draft = this.timeHook.getValue();
		if(!draft || !draft.value || !(draft.value instanceof DateTime)){
			return null;
		}
		const dt = draft.value;
		const fallbackZone = safe(baseFields && baseFields.zone && baseFields.zone.value, '+08:00');
		return {
			...(baseFields || this.state.localFields || this.props.fields || {}),
			date: { value: dt.clone() },
			time: { value: dt.clone() },
			ad: { value: dt.ad },
			zone: { value: normalizeZoneOffset(dt.zone, fallbackZone) },
		};
	}

	clickPlot(){
		if(this.state.loading){
			// [连续进退不丢击](horosa_sanshi_no_drop_step_v1)重算期间的起盘请求不再静默丢弃——
			// 旧行为=丢击:时间控件已步进、盘不跟算,直到用户再补一击(「连续进退卡很久」的真身)。
			// 记队列标记+最后一击时刻,本轮重算落地后经 trailing 静默期补发
			// (latest-wins:pendingTimeFields 持续更新,补发恒最新;连点期间不起中间轮)。
			this.queuedPlotWhileLoading = true;
			this.lastQueuedPlotAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
			return;
		}
		if(this.awaitingSyncTimer){
			clearTimeout(this.awaitingSyncTimer);
			this.awaitingSyncTimer = null;
		}
		// [Q-387/T-369 ①] 草稿优先:onTimeChanged 每次改时间都把最新时刻写进 pendingTimeFields,而
		//   timeHook.getValue() 读的是注册 hook 的那个控件实例(左栏内联 / 隐藏实例)的 value —— 未起盘时
		//   在弹层里改完直接点「起盘」,它还是旧时刻,此前它排在前面就把草稿盖掉 = 按旧时刻起盘,
		//   与「首盘必须显式点确定 / 起盘」的意图相反。selector 只在没有草稿时兜底。
		const baseFields = this.pendingTimeFields || this.state.localFields || this.props.fields;
		const timeFields = this.pendingTimeFields || this.getTimeFieldsFromSelector(baseFields);
		const nextFields = timeFields || this.state.localFields || this.props.fields;
		if(!nextFields){
			return;
		}
		const curFields = this.props.fields || {};
		const patchFields = {};
		const patchRaw = (key)=>{
			if(nextFields[key] && nextFields[key].value !== undefined){
				patchFields[key] = { value: nextFields[key].value };
			}
		};
		const patchDateTime = (key)=>{
			if(nextFields[key] && nextFields[key].value instanceof DateTime){
				patchFields[key] = { value: nextFields[key].value.clone() };
			}
		};
		const maybePatchRaw = (key)=>{
			const nextVal = safe(nextFields[key] && nextFields[key].value);
			const curVal = safe(curFields[key] && curFields[key].value);
			if(nextVal !== curVal){
				patchRaw(key);
			}
		};
		const maybePatchDateTime = (key, format)=>{
			const nextVal = nextFields[key] && nextFields[key].value instanceof DateTime ? nextFields[key].value.format(format) : '';
			const curVal = curFields[key] && curFields[key].value instanceof DateTime ? curFields[key].value.format(format) : '';
			if(nextVal !== curVal){
				patchDateTime(key);
			}
		};
		maybePatchDateTime('date', 'YYYY-MM-DD HH:mm:ss');
		maybePatchDateTime('time', 'YYYY-MM-DD HH:mm:ss');
		maybePatchRaw('ad');
		maybePatchRaw('zone');
		maybePatchRaw('lon');
		maybePatchRaw('lat');
		maybePatchRaw('gpsLon');
		maybePatchRaw('gpsLat');
		maybePatchRaw('zodiacal');
		maybePatchRaw('hsys');
		maybePatchRaw('gender');
		maybePatchRaw('timeAlg');
		const needChartSync = Object.keys(patchFields).length > 0;
		this.prefetchNongliForFields(nextFields);
		this.prefetchJieqiSeedForFields(nextFields);
		this.awaitingChartSync = false;
		if(needChartSync){
			this.syncFields(patchFields);
			this.onFieldsChange(patchFields, {
				silentRequest: true,
				nohook: true,
			});
			this.awaitingChartSync = true;
			if(this.awaitingSyncTimer){
				clearTimeout(this.awaitingSyncTimer);
				this.awaitingSyncTimer = null;
			}
			// [不等 /chart 回流](horosa_sanshi_no_wait_chart_v1)旧行为=等 chartObj 回流触发
			// didUpdate 快路径、1200ms timer 兜底——实测回流常缺席,每步硬吃满 1.2s(连续进退
			// 「卡很久」的最大单项)。chartObj 只供 isDiurnal(昼夜贵人)与外圈联动,不值硬等:
			// 立即用现值起算;回流后 didUpdate 仍会 refreshAll(force)——recalcSignature 含
			// isDiurnal/outerChartKey,没变=签名去重瞬时 no-op,真变(跨昼夜界/外圈)=自动校正重算。
			this.refreshAll(nextFields, true);
		}
		this.setState({
			hasPlotted: true,
			localFields: nextFields,
			plottedFields: nextFields,
			loading: needChartSync ? true : this.state.loading,
		}, ()=>{
			this.pendingTimeFields = null;
			if(needChartSync){
				return;
			}
			this.refreshAll(nextFields, true);
		});
	}

	changeGeo(rec){
		const base = this.state.localFields || this.props.fields || {};
		const dDt = base.date && base.date.value;
		const tDt = base.time && base.time.value;
		const ds = (dDt && dDt.format) ? dDt.format('YYYY-MM-DD') : null;
		// 选地点 → 时区自动校正 + 重锚 date/time 到新时区(保留钟面时刻、瞬时随之偏移);手动改过时区则沿用 rec.zone。
		const z = resolveGeoZone(rec, ds);
		const geoPatch = {
			lon: { value: convertLonToStr(rec.lng) },
			lat: { value: convertLatToStr(rec.lat) },
			gpsLon: { value: rec.gpsLng },
			gpsLat: { value: rec.gpsLat },
		};
		if(z){
			geoPatch.zone = { value: z };
			if(dDt && dDt.clone){ const nd = dDt.clone(); nd.setZone(z); geoPatch.date = { value: nd }; geoPatch.ad = { value: nd.ad }; }
			if(tDt && tDt.clone){ const nt = tDt.clone(); nt.setZone(z); geoPatch.time = { value: nt }; }
		}
		// 🔑 刷新左栏显示(localFields)+ 实时重算(silent fetchByFields):改地点/时区即重排三式
		Object.assign(geoPatch, geoNameFieldPatch(rec));
		this.setState({ localFields: { ...base, ...geoPatch } });
		this.onFieldsChange(geoPatch, true);
	}

	clickSave(){
		if(!this.state.hasPlotted || !this.state.dunjia){
			message.warning('请先起盘后再保存');
			return;
		}
		const flds = this.state.plottedFields || this.state.localFields || this.props.fields;
		if(!flds){
			return;
		}
		if((this.state.options || {}).mode === 'ming'){
			if(this.props.dispatch){
				this.props.dispatch({
					type: 'astro/openDrawer',
					payload: {
						key: 'chartadd',
					},
				});
			}
			return;
		}
		const divTime = `${flds.date.value.format('YYYY-MM-DD')} ${flds.time.value.format('HH:mm:ss')}`;
		// 存档即写格式化快照(与导出/挂载同源 buildSanShiUnitedSnapshotText)。否则挂载该 case 走
		// buildSanshiUnifiedFallbackSnapshot 兜底,产出[奇门遁甲]等不在 sanshiunited preset 的段名,
		// 自定义过导出段的用户会被静默删。对齐 sixyao/mundane「存档带 snapshot」范式(extractCaseSnapshotText 直读 payload.snapshot)。
		const chartWrap = this.props.chartObj || this.props.chart || null;
		const astroChart = chartWrap && chartWrap.chart ? chartWrap.chart : null;
		const outerData = this.currentOuterData(astroChart);
		const lrSnapInput = this.state.liurengSnapshotInput || {};
		const snapshotText = buildSanShiUnitedSnapshotText({
			fields: flds,
			options: this.state.options || {},
			nongli: this.state.nongli,
			displaySolarTime: this.state.displaySolarTime,
			liureng: this.state.liureng,
			dunjia: this.state.dunjia,
			taiyi: this.state.taiyi,
			keData: this.state.keData,
			sanChuan: this.state.sanChuan,
			lrLayout: this.state.lrLayout,
			liurengRefBundle: this.state.liurengRefBundle,
			outerData,
			guirengType: lrSnapInput.guirengType,
			liurengChartForLr: lrSnapInput.chartForLr,
			lrCastOverride: lrSnapInput.lrCastOverride,
			lrCastOpts: lrSnapInput.lrCastOpts,
			liurengRunYear: lrSnapInput.runYearRef,
			ziweiSihua: this.ziweiSihuaSnapshotInput || null,
		});
			// [挂载自检 F-36] 择日宿主内按宿主键(sanshizeri)存档;快照取宿主槽(含择时段),缺则用本页快照。
			const ssScope = this.props.techniqueScope || 'sanshiunited';
			const ssScopeSnap = ssScope !== 'sanshiunited' ? loadModuleAISnapshot(ssScope) : null;
			const payload = {
				module: ssScope,
				snapshot: (ssScopeSnap && ssScopeSnap.content) ? ssScopeSnap.content : (snapshotText || ''),
				options: {
					...(this.state.options || {}),
				},
			result: {
				nongli: this.state.nongli,
				liureng: this.state.liureng,
				dunjia: this.state.dunjia,
				taiyi: this.state.taiyi,
				keData: this.state.keData,
				sanChuan: this.state.sanChuan,
			},
		};
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'astro/openDrawer',
				payload: {
					key: 'caseadd',
					record: {
						event: `${ssScope === 'sanshizeri' ? '三式择日' : '三式合一占断'} ${divTime}`,
						caseType: ssScope,
						divTime: divTime,
						zone: flds.zone.value,
						lat: flds.lat.value,
						lon: flds.lon.value,
						gpsLat: flds.gpsLat.value,
						gpsLon: flds.gpsLon.value,
						pos: flds.pos ? flds.pos.value : '',
						gender: caseGenderValue(flds),
						// 🔴 口径快照必带:载档时 applyCase 从 payload.fieldSnapshot 回灌日界点/晚子时/
						// 卦日界/时间算法;不带则沿用全局当前值 → 载回来的盘可能与存档不同。
						payload: { ...payload, fieldSnapshot: caseFieldSnapshot(flds) },
						sourceModule: ssScope,
					},
				},
			});
		}
	}

	genParams(fields, overrideOptions){
		const flds = fields || this.state.localFields || this.props.fields;
		if(!flds){
			return null;
		}
		const opt = {
			...(this.state.options || {}),
			...(overrideOptions || {}),
		};
		const calcGeo = resolveCalcGeo(flds, opt);
		const zoneValue = normalizeZoneOffset(safe(flds.zone && flds.zone.value, ''), '+08:00');
		const adRaw = (flds.ad && flds.ad.value !== undefined && flds.ad.value !== null)
			? flds.ad.value
			: 1;
		const adValue = normalizeAdValue(adRaw, 1);
		return {
			date: flds.date.value.format('YYYY-MM-DD'),
			time: flds.time.value.format('HH:mm:ss'),
			zone: zoneValue,
			lon: calcGeo.lon,
			lat: calcGeo.lat,
			gpsLat: calcGeo.gpsLat,
			gpsLon: calcGeo.gpsLon,
			ad: adValue,
			gender: opt.sex,
			timeAlg: normalizeTimeAlg(opt.timeAlg),
			after23NewDay: opt.after23NewDay === 1 ? 1 : 0,
			// v2.2.1: 透传时柱开关给后端 /nongli/time。
			lateZiHourUseNextDay: opt.lateZiHourUseNextDay === 0 ? 0 : 1,
		};
	}

	genJieqiParams(fields, year, overrideOptions){
		const flds = fields || this.state.localFields || this.props.fields;
		if(!flds){
			return null;
		}
		const opt = {
			...(this.state.options || {}),
			...(overrideOptions || {}),
		};
		const calcGeo = resolveCalcGeo(flds, opt);
		const zoneValue = normalizeZoneOffset(safe(flds.zone && flds.zone.value, ''), '+08:00');
		const adRaw = (flds.ad && flds.ad.value !== undefined && flds.ad.value !== null)
			? flds.ad.value
			: 1;
		return {
			year: `${year}`,
			ad: normalizeAdValue(adRaw, 1),
			zone: zoneValue,
			lon: calcGeo.lon,
			lat: calcGeo.lat,
			gpsLat: calcGeo.gpsLat,
			gpsLon: calcGeo.gpsLon,
			timeAlg: normalizeTimeAlg(opt.timeAlg),
			hsys: 0,
			zodiacal: 0,
			siderealAyanamsa: '',
			doubingSu28: false,
		};
	}

	getQimenOptions(overrideOptions){
		const opt = {
			...(this.state.options || {}),
			...(overrideOptions || {}),
		};
		return {
			...QIMEN_OPTIONS,
			sex: opt.sex,
			timeAlg: normalizeTimeAlg(opt.timeAlg),
			paiPanType: opt.paiPanType,
			zhiShiType: opt.zhiShiType,
			yueJiaQiJuType: opt.yueJiaQiJuType,
			qijuMethod: opt.qijuMethod,
			kongMode: opt.kongMode,
			yimaMode: opt.yimaMode,
			shiftPalace: opt.shiftPalace,
			// 奇门流派/起局补充(对齐独立 DunJiaMain):盘式(转盘/飞盘/混合) + 阴盘报数定局 + 封局 + 置闰天数。
			school: opt.school !== undefined ? opt.school : '转盘',
			shuziReportNumber: opt.shuziReportNumber !== undefined ? opt.shuziReportNumber : '',
			fengJu: !!opt.fengJu,
			zhirunLeapDays: opt.zhirunLeapDays !== undefined ? opt.zhirunLeapDays : 9,
			// [H-A] 三式缺口补齐:盘类+相关人员透传(与独立页同语义;默认=事局/空=零回归)
			chartCategory: opt.chartCategory !== undefined ? opt.chartCategory : 'shi',
			faRelatedPeople: opt.faRelatedPeople !== undefined ? opt.faRelatedPeople : '',
			godsPreset: opt.godsPreset !== undefined ? opt.godsPreset : 'baihu_xuanwu',
			anGanMode: opt.anGanMode !== undefined ? opt.anGanMode : 'off',
			showAnZhi: !!opt.showAnZhi,
			jiGongMode: opt.jiGongMode || 'kun',
			feiXingShun: !!opt.feiXingShun,
			feiMenShun: !!opt.feiMenShun,
			feiShenShun: !!opt.feiShenShun,
			feiMenZhongCan: opt.feiMenZhongCan !== false,
			feiMenZhongShow: !!opt.feiMenZhongShow,
			mixTian: opt.mixTian || '',
			mixXing: opt.mixXing || '',
			mixMen: opt.mixMen || '',
			mixShen: opt.mixShen || '',
			kongMarkBoth: !!opt.kongMarkBoth,
			showAllKong: !!opt.showAllKong,
			shiftZhiFuMode: opt.shiftZhiFuMode === 'recalc' ? 'recalc' : 'follow',
			dayJiaJu: opt.dayJiaJu || 'yiyuan',
			keJiaFenDun: opt.keJiaFenDun || 'zihou',
			keZiZhengHuanShi: !!opt.keZiZhengHuanShi,
			jinhanMenPai: opt.jinhanMenPai === 'shun' ? 'shun' : 'book',
			yearJiaJu: opt.yearJiaJu === 'yinian' ? 'yinian' : 'sanyuan',
			// 三式合一统一按“交接时刻”计算，避免日级近似切换。
			jieQiType: 1,
			yearGanZhiType: 2,
			monthGanZhiType: 1,
			dayGanZhiType: 1,
			after23NewDay: opt.after23NewDay === 1 ? 1 : 0,
			// v2.2.1: 透传时柱开关给奇门后端引擎。
			lateZiHourUseNextDay: opt.lateZiHourUseNextDay === 0 ? 0 : 1,
		};
	}

	resolvePendingRecalc(result){
		if(!this.pendingRecalcResolvers || this.pendingRecalcResolvers.length === 0){
			return;
		}
		const resolvers = this.pendingRecalcResolvers.slice();
		this.pendingRecalcResolvers = [];
		resolvers.forEach((fn)=>{
			try{
				fn(result);
			}catch(e){
				return;
			}
		});
		// [连续进退不丢击] 重算落地 → 期间被队列化的起盘请求经 trailing 静默期补发:
		// 距最后一击 <180ms 说明用户还在连点,推迟再查——连点期间不起中间轮
		// (旧「resolve 即补」= 每 ~600ms 一轮全算,6 连击串行 3-4 轮;现=停手后一轮定稿)。
		// loading 已随 commitPatch 同帧清掉;若又有新一轮在途则本次跳过,由那一轮 resolve 接力。
		if(this.queuedPlotWhileLoading){
			const tryFlush = ()=>{
				if(this.unmounted || !this.queuedPlotWhileLoading){
					return;
				}
				if(this.state.loading){
					return;
				}
				const nowTs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
				if(this.lastQueuedPlotAt && nowTs - this.lastQueuedPlotAt < 180){
					setTimeout(tryFlush, 120);
					return;
				}
				this.queuedPlotWhileLoading = false;
				this.clickPlot();
			};
			setTimeout(tryFlush, 0);
		}
	}

	cancelPendingRecalc(result = false){
		if(this.pendingRecalcTimer){
			clearTimeout(this.pendingRecalcTimer);
			this.pendingRecalcTimer = null;
		}
		this.pendingRecalcPayload = null;
		this.resolvePendingRecalc(result);
	}

	scheduleSnapshotSave(snapshotPayload, snapshotMeta){
		// [issue#74 同类] 留底最近一次 payload/meta:紫微四化 tab 的盘经异步归来时(上报点
		// handleZiweiSihuaSnapshotState)据此换键补拍——重算路径按值捕获,四化后到不补则挂载恒缺段。
		this._lastSnapshotPayload = snapshotPayload;
		this._lastSnapshotMeta = snapshotMeta;
		if(this.pendingSnapshotTimer){
			clearTimeout(this.pendingSnapshotTimer);
			this.pendingSnapshotTimer = null;
		}
		if(this.pendingSnapshotIdle && typeof cancelIdleCallback === 'function'){
			try{ cancelIdleCallback(this.pendingSnapshotIdle); }catch(e){ /* ignore */ }
			this.pendingSnapshotIdle = null;
		}
		// [连击不被快照顶住](horosa_sanshi_snapshot_idle_v1)buildSanShiUnitedSnapshotText 是
		// 三盘全家文本化的同步大构建(实测 ~950ms 长任务)。原 setTimeout(120) 让它恰好插进
		// 「上一步落地 → 下一步 recalc 28ms timer」之间,把下一步顶住近一秒——连续进退
		// 「每步都慢」的隐藏大头。改 requestIdleCallback:主线程空闲才构建,连击期间被上面的
		// cancel 逐次作废(latest-wins,只有停手后最后一份真跑);timeout 兜底保「AI 挂载最新」。
		const buildAndSave = ()=>{
			this.pendingSnapshotIdle = null;
			this.pendingSnapshotTimer = null;
			if(this.unmounted){
				return;
			}
			let snapshotText = buildSanShiUnitedSnapshotText(snapshotPayload);
			if(!snapshotText){
				return;
			}
			// [Z6] 择日宿主 scope 化:独立快照槽+composeAiSnapshot 拼接择时三段(主页零影响)
			if(typeof this.props.composeAiSnapshot === 'function'){
				try{ snapshotText = `${this.props.composeAiSnapshot(snapshotText) || snapshotText}`; }catch(e){ /* 拼接失败用基底 */ }
			}
			saveModuleAISnapshot(this.props.techniqueScope || 'sanshiunited', snapshotText, snapshotMeta);
		};
		if(typeof requestIdleCallback === 'function'){
			this.pendingSnapshotIdle = requestIdleCallback(buildAndSave, { timeout: 4000 });
		}else{
			this.pendingSnapshotTimer = setTimeout(buildAndSave, SANSHI_SNAPSHOT_DEFER_MS);
		}
	}

	// [Q-385/T-366] 六壬层「年神排序 / 土旺衰」的页面落点(与独立六壬页同源函数:computeYearShenSha /
	// liurengWangXiang / judgeKongWang)。此前两档只进 AI 快照断卦层,页面拨了 DOM 一个字节都不变。
	renderLiuRengShenShaWangShuai(refContext){
		const ctx = refContext || {};
		if(!ctx.dayGan){ return null; }
		const opt = this.state.options || {};
		const sort = opt.yearShenShaSort || 'sanyuan';
		const tuWs = opt.tuWangShuai || 'siji';
		const wxOf = (z)=>(LRConst.GanZiWuXing[`${z || ''}`.trim().substring(0, 1)] || '');
		const yearList = ctx.yearBranch ? computeYearShenSha(ctx.yearBranch, sort, ctx.courseBranches || []) : [];
		const wsList = (ctx.sanChuanBranches || []).map((z, i)=>{
			const wx = wxOf(z);
			return { pos: ['初传', '中传', '末传'][i] || '', zhi: z, wx, ws: liurengWangXiang(wx, ctx.monthBranch, tuWs) };
		}).filter((x)=>x.ws);
		const kongList = (ctx.xunKongBranches || []).map((z)=>{
			const wx = wxOf(z);
			const j = judgeKongWang(wx, ctx.monthBranch, tuWs);
			return j ? { zhi: z, wx, kind: j.kind, ws: j.ws, basis: j.basis, inSanChuan: (ctx.sanChuanBranches || []).indexOf(z) >= 0 } : null;
		}).filter(Boolean);
		if(!yearList.length && !wsList.length && !kongList.length){ return null; }
		const WS_COLOR = { 旺: '#3fa45b', 相: '#5fae6f', 休: 'var(--horosa-muted,#9a8f7d)', 囚: '#d08a3a', 死: '#e2574c' };
		const cellBase = { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '5px 2px', borderRadius: 8, background: 'var(--horosa-panel-soft, rgba(255,255,255,0.03))', border: '1px solid var(--horosa-border, rgba(255,255,255,0.08))' };
		return (
			<>
				{yearList.length ? (
					<Card size='small' style={{ marginBottom: 8 }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
							<span style={{ fontWeight: 600 }}>年神</span>
							<Tag color='gold'>{sort === 'suigui' ? '太岁排轮' : '四利三元序'}</Tag>
						</div>
						<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 6 }}>
							{yearList.map((sInfo)=>(
								<div key={sInfo.name} title={`${sInfo.brief || ''}（起例所临：${sInfo.branch}）`}
									style={{ ...cellBase, background: sInfo.inCourse ? 'rgba(212,160,23,0.12)' : cellBase.background, border: sInfo.inCourse ? '1px solid var(--horosa-accent, #d4a017)' : cellBase.border }}>
									<span style={{ fontSize: 12, color: sInfo.color, fontWeight: 600 }}>{sInfo.name}</span>
									<span style={{ fontSize: 16, fontWeight: 700, color: 'var(--horosa-text, #d8d2c7)' }}>{sInfo.branch}</span>
								</div>
							))}
						</div>
						<div style={{ color: 'var(--horosa-muted, #8c8c8c)', fontSize: 12, marginTop: 6 }}>排列起点按左栏「年神排序」;入课传者高亮。</div>
					</Card>
				) : null}
				{wsList.length ? (
					<Card size='small' style={{ marginBottom: 8 }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
							<span style={{ fontWeight: 600 }}>三传旺衰</span>
							<Tag color='gold'>以月令</Tag>
						</div>
						<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
							{wsList.map((w)=>(
								<div key={w.pos} style={cellBase}>
									<span style={{ fontSize: 11, color: 'var(--horosa-muted, #8c8c8c)' }}>{w.pos}·{w.zhi}{w.wx}</span>
									<span style={{ fontSize: 16, fontWeight: 700, color: WS_COLOR[w.ws] || 'var(--horosa-text,#d8d2c7)' }}>{w.ws}</span>
								</div>
							))}
						</div>
						<div style={{ color: 'var(--horosa-muted, #8c8c8c)', fontSize: 12, marginTop: 6 }}>旺相=得令、休囚死=失令;土旺衰按左栏「土旺衰」。</div>
					</Card>
				) : null}
				{kongList.length ? (
					<Card size='small' style={{ marginBottom: 8 }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
							<span style={{ fontWeight: 600 }}>空亡真假</span>
							<Tag color='gold'>旬空{kongList.map((k)=>k.zhi).join('')}</Tag>
						</div>
						{kongList.map((k)=>(
							<div key={k.zhi} style={{ lineHeight: '20px' }}>
								<span style={{ color: k.kind === '真空' ? '#e2574c' : '#3fa45b', fontWeight: 600 }}>{k.zhi}{k.wx}·{k.kind}</span>
								<span style={{ color: 'var(--horosa-muted, #8c8c8c)' }}>（{k.ws}{k.inSanChuan ? '·入传' : ''}）</span>
								<span style={{ color: 'var(--horosa-text-soft, #595959)' }}>　{k.basis}</span>
							</div>
						))}
					</Card>
				) : null}
			</>
		);
	}

	// [Q-161/T-81] 外圈坐标缓存必须按「当前所选坐标」校验:此前三条快照路径只看 `outerDataCache.data`
	// 在不在,而重建只发生在 performRecalcByNongli 内、且重算签名不含 outerCoord(点「起盘」也被去重拦下)
	// → 切到赤道后,存档与导出刷新拿的还是黄道那份,「星盘:」行不带「(赤经)」且地支与中栏不符。
	currentOuterData(astroChart){
		const coord = this.state.outerCoord || 'ecliptic';
		if(this.outerDataCache && this.outerDataCache.data && this.outerDataCache.coord === coord){
			return this.outerDataCache.data;
		}
		return buildOuterData(astroChart, coord);
	}

	// 只有独立三式页读写保存值;三式择日里内嵌的那份(techniqueScope='sanshizeri')不读不写(理由见 SANSHI_PAGE_SETTINGS 注)。
	usesSavedSettings(){
		return (this.props.techniqueScope || 'sanshiunited') === 'sanshiunited';
	}

	// [Q-161/T-81] 外圈切换:中栏本就按新坐标重绘,这里另把快照补拍一次(重算是纯本地 buildOuterData,
	// 不发请求),否则实时挂载快照要等到下一次时间/盘变化才跟上。
	onOuterCoordChange(coord){
		if(this.usesSavedSettings()){ SANSHI_PAGE_SETTINGS.save({ outerCoord: coord }); }
		this.setState({ outerCoord: coord }, ()=>{
			if(!this._lastSnapshotPayload){ return; }
			const chartWrap = this.props.chartObj || this.props.chart || null;
			const astroChart = chartWrap && chartWrap.chart ? chartWrap.chart : null;
			const outerData = this.currentOuterData(astroChart);
			this.outerDataCache = { ...(this.outerDataCache || {}), coord: this.state.outerCoord || 'ecliptic', data: outerData };
			this.scheduleSnapshotSave({ ...this._lastSnapshotPayload, outerData }, this._lastSnapshotMeta);
		});
	}

	// [YA v42] 紫微四化 tab(SanShiZiWeiSihua)上报其盘与大运/流年选中态——落实例字段,
	// 供快照三条路径(重算 scheduleSnapshotSave/存档 clickSave/导出刷新 handleSnapshotRefreshRequest)payload 带上。
	handleZiweiSihuaSnapshotState(payload){
		this.ziweiSihuaSnapshotInput = payload || null;
		// [issue#74 同类] 四化上报实变即补拍(子组件已同值去重,此处必为实变):重算路径的
		// snapshotPayload 按值捕获,四化盘异步归来若只落实例字段不重存,挂载快照恒缺
		// [紫微四化] 段——而导出刷新路径实时读实例字段反而有,两路径不同构。
		if(payload && this._lastSnapshotPayload){
			this.scheduleSnapshotSave({ ...this._lastSnapshotPayload, ziweiSihua: payload }, this._lastSnapshotMeta);
		}
	}

	handleSnapshotRefreshRequest(evt){
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		if(moduleName !== (this.props.techniqueScope || 'sanshiunited')){
			return;
		}
		// 导出刷新必须与左侧当前“已起盘”展示保持一致，优先使用 plottedFields。
		const fields = this.state.hasPlotted
			? (this.state.plottedFields || this.state.localFields || this.props.fields)
			: this.getActiveFields();
		const chartWrap = this.props.chartObj || this.props.chart || null;
		const astroChart = chartWrap && chartWrap.chart ? chartWrap.chart : null;
		const outerData = this.currentOuterData(astroChart);
		const lrSnapInput = this.state.liurengSnapshotInput || {};
		const snapshotPayload = {
			fields,
			options: this.state.options || {},
			nongli: this.state.nongli,
			displaySolarTime: this.state.displaySolarTime,
			liureng: this.state.liureng,
			dunjia: this.state.dunjia,
			taiyi: this.state.taiyi,
			keData: this.state.keData,
			sanChuan: this.state.sanChuan,
			lrLayout: this.state.lrLayout,
			liurengRefBundle: this.state.liurengRefBundle,
			outerData,
			guirengType: lrSnapInput.guirengType,
			liurengChartForLr: lrSnapInput.chartForLr,
			lrCastOverride: lrSnapInput.lrCastOverride,
			lrCastOpts: lrSnapInput.lrCastOpts,
			liurengRunYear: lrSnapInput.runYearRef,
			ziweiSihua: this.ziweiSihuaSnapshotInput || null,
		};
		let snapshotText = buildSanShiUnitedSnapshotText(snapshotPayload);
		if(!snapshotText){
			return;
		}
		const snapshotMeta = {
			date: fields && fields.date ? fields.date.value.format('YYYY-MM-DD') : '',
			time: fields && fields.time ? fields.time.value.format('HH:mm:ss') : '',
			zone: fields && fields.zone ? fields.zone.value : '',
			lon: fields && fields.lon ? fields.lon.value : '',
			lat: fields && fields.lat ? fields.lat.value : '',
		};
		if(typeof this.props.composeAiSnapshot === 'function'){
			try{ snapshotText = `${this.props.composeAiSnapshot(snapshotText) || snapshotText}`; }catch(e){ /* 拼接失败用基底 */ }
		}
		saveModuleAISnapshot(this.props.techniqueScope || 'sanshiunited', snapshotText, snapshotMeta);
		if(evt && evt.detail && typeof evt.detail === 'object'){
			evt.detail.snapshotText = snapshotText;
		}
	}

	recalcByNongli(fields, nongli, overrideOptions, displaySolarTime, commitPatch){
		const flds = fields || this.state.localFields || this.props.fields;
		if(!flds || !nongli){
			return Promise.resolve(false);
		}
		// [R4-B7/C16 靶①] commitPatch:调用方要与盘结果【同帧】提交的 state 补丁(loading:false/
		// displaySolarTime)。防抖窗内 payload 被覆盖时合并保留旧补丁(refined/seed 补算不带补丁,
		// 不得把主链的 loading:false 冲掉)。(v3.7.1 收敛注:取代我方 S5 提交期内折形态 —— 同一
		// 消闪帧目标,上游穿线形对防抖窗覆盖更精确,#49 换形。)
		this.pendingRecalcPayload = {
			fields: flds,
			nongli,
			overrideOptions,
			displaySolarTime,
			commitPatch: {
				...(this.pendingRecalcPayload && this.pendingRecalcPayload.commitPatch),
				...commitPatch,
			},
		};
		if(this.pendingRecalcTimer){
			clearTimeout(this.pendingRecalcTimer);
			this.pendingRecalcTimer = null;
		}
		return new Promise((resolve)=>{
			this.pendingRecalcResolvers.push(resolve);
			this.pendingRecalcTimer = setTimeout(()=>{
				this.pendingRecalcTimer = null;
				if(this.unmounted){
					this.cancelPendingRecalc(false);
					return;
				}
				const payload = this.pendingRecalcPayload;
				this.pendingRecalcPayload = null;
					if(!payload){
						this.resolvePendingRecalc(false);
						return;
					}
					try{
						this.lastRecalcError = null;
						Promise.resolve(this.performRecalcByNongli(
							payload.fields,
							payload.nongli,
							payload.overrideOptions,
							payload.displaySolarTime,
							payload.commitPatch
						)).then((changed)=>{
							this.resolvePendingRecalc(changed);
						}).catch((e)=>{
							this.lastRecalcError = e;
							if(!this.unmounted){
								this.setState({ loading: false });
								console.error('[SanShiUnited] performRecalcByNongli failed', e);
							}
							this.resolvePendingRecalc(false);
						});
					}catch(e){
						this.lastRecalcError = e;
						if(!this.unmounted){
							this.setState({ loading: false });
							console.error('[SanShiUnited] performRecalcByNongli failed', e);
						}
						this.resolvePendingRecalc(false);
					}
				}, SANSHI_RECALC_DEFER_MS);
			});
		}

	async performRecalcByNongli(fields, nongli, overrideOptions, displaySolarTime, commitPatch){
		const flds = fields || this.state.localFields || this.props.fields;
		if(!flds || !nongli){
			return false;
		}
		const stateOptions = this.state.options || {};
		// 合并 state + override 为单一真值源(签名/缓存键/各子盘计算同源,避免漂移)。
		const mergedOptions = {
			...stateOptions,
			...(overrideOptions || {}),
		};
		const guirengType = mergedOptions.guireng;
		const qimenOptions = this.getQimenOptions(overrideOptions);
		const chartWrap = this.props.chartObj || this.props.chart || null;
		const outerChartKey = getOuterChartKey(chartWrap);
		// 大六壬流派覆盖(换将/分昼夜/涉害/昼夜阳阴);默认全 default → null(零回归,与原本固定月将一致)。
		const lrCastOverride = chartWrap && chartWrap.chart ? buildSanshiLiuRengCastOverride({
			...chartWrap.chart,
			nongli: nongli,
		}, mergedOptions) : null;
		const lrCastKey = lrCastOverride ? [
			safe(lrCastOverride.yue),
			`${safe(lrCastOverride.isDiurnal, '')}`,
			safe(lrCastOverride.yinyangSystem),
			lrCastOverride.seHaiOpts ? `${safe(lrCastOverride.seHaiOpts.method)}-${safe(lrCastOverride.seHaiOpts.boundary)}-${lrCastOverride.seHaiOpts.shiRuKe ? 1 : 0}` : '',
		].join('~') : '';
		const recalcSignature = [
			getFieldKey(flds),
			getNongliKey(nongli),
			getQimenOptionsKey(qimenOptions),
			`${guirengType}`,
			`${safe(mergedOptions.taiyiStyle)}`,
			`${safe(mergedOptions.taiyiAccum)}`,
			`${safe(mergedOptions.gameTheory)}`,
			mergedOptions.taiyiSchool ? JSON.stringify(normalizeTaiyiSchool(mergedOptions.taiyiSchool)) : '',
			lrCastKey,
			`${safe(mergedOptions.yearShenShaSort)}`,
			`${safe(mergedOptions.tuWangShuai)}`,
			`${safe(mergedOptions.after23NewDay)}`,
			`${safe(mergedOptions.lateZiHourUseNextDay)}`,
			`${safe(normalizeTimeAlg(mergedOptions.timeAlg))}`,
			safe(flds && flds.zodiacal && flds.zodiacal.value),
			safe(flds && flds.hsys && flds.hsys.value),
			`${safe(extractIsDiurnalFromChartWrap(this.props.chartObj || this.props.chart || null), '')}`,
			outerChartKey,
			`${this.state.outerCoord || 'ecliptic'}`,   // [Q-161/T-81] 外圈坐标进签名:否则切了坐标再起盘被去重拦下
			jieqiSeedSignature(this.jieqiYearSeeds),   // [Q-155] 种子到达后签名变 → 去重不吞掉带种子的重算
		].join('|');
		if(this.state.dunjia && recalcSignature === this.lastRecalcSignature){
			return false;
		}
		const year = parseInt(flds.date.value.format('YYYY'), 10);
		const isDiurnal = extractIsDiurnalFromChartWrap(chartWrap);
		// 奇门(getKinqimenDunJia)与太乙(getKintaiyiPan)两后端取盘相互独立(太乙仅吃 flds/nongli/mergedOptions,
		// 不依赖奇门结果),原为串行 await(网络往返叠加)。改并行:先各自起 promise,再 Promise.all 等齐;
		// 太乙命中本地缓存则不发请求(promise=已解析的缓存值),仅缓存未命中才真并发。结果/快照 byte-perfect 不变。
		const taiyiCacheKey = [
			getFieldKey(flds),
			getNongliKey(nongli),
			`${safe(mergedOptions.taiyiStyle)}`,
			`${safe(mergedOptions.taiyiAccum)}`,
			`${safe(mergedOptions.sex)}`,
			`${safe(mergedOptions.gameTheory)}`,
			mergedOptions.taiyiSchool ? JSON.stringify(normalizeTaiyiSchool(mergedOptions.taiyiSchool)) : '',
		].join('|');
		const taiyiCached = this.taiyiCache.get(taiyiCacheKey);
		const dunjiaPromise = this.getKinqimenDunJia(
			flds,
			nongli,
			qimenOptions,
			year,
			isDiurnal,
			displaySolarTime || this.state.displaySolarTime
		);
		const taiyiPromise = taiyiCached
			? Promise.resolve(taiyiCached)
			: this.getKintaiyiPan(flds, nongli, mergedOptions);
		const [dunjia, taiyiResolved] = await Promise.all([dunjiaPromise, taiyiPromise]);
		// 太乙缓存未命中 → 落缓存(LRU 上限 48);命中则 taiyiResolved===缓存值,无需重写。
		const taiyi = taiyiResolved;
		if(!taiyiCached){
			this.taiyiCache.set(taiyiCacheKey, taiyi);
			if(this.taiyiCache.size > 48){
				const firstKey = this.taiyiCache.keys().next().value;
				if(firstKey){
					this.taiyiCache.delete(firstKey);
				}
			}
		}
		const astroChart = chartWrap && chartWrap.chart ? chartWrap.chart : null;
		const lrNongli = buildLrNongli(nongli, dunjia);
		const nianMing = safe(lrNongli && lrNongli.runyear, '')
			|| ((dunjia && dunjia.ganzhi && dunjia.ganzhi.year) ? dunjia.ganzhi.year.substring(1, 2) : '');
		const chartForLr = astroChart ? {
			...astroChart,
			nongli: lrNongli,
		} : null;
		const lrCacheKey = [
			getChartYue(astroChart),
			safe(lrNongli.dayGanZi),
			safe(lrNongli.time),
			`${guirengType}`,
			// [Q-152/T-69] 昼夜:缺省「晨昏分昼夜」时覆盖为 null、lrCastKey 不含昼夜,而贵人取昼/夜贵读 chartObj.isDiurnal →
			// 同一时辰内跨日出/日没命中旧缓存,十二天将整环沿用旧昼夜(重算签名含昼夜会重算,六壬层却命中旧包)。
			`${safe(chartForLr && chartForLr.isDiurnal, '')}`,
			lrCastKey,
		].join('|');
		let lrBundle = this.lrBundleCache[lrCacheKey];
		if(!lrBundle){
			const lrLayout = buildLiuRengLayout(chartForLr, guirengType, lrCastOverride);
			const keData = buildKeData(lrLayout, chartForLr);
			const sanChuan = buildSanChuan(lrLayout, keData.raw, chartForLr, lrCastOverride);
			lrBundle = {
				lrLayout,
				keData,
				sanChuan,
				yue: lrLayout ? lrLayout.yue : '',
				timezi: lrLayout ? lrLayout.timezi : '',
				guizi: lrLayout ? lrLayout.guizi : '',
			};
			this.lrBundleCache[lrCacheKey] = lrBundle;
			const cacheKeys = Object.keys(this.lrBundleCache);
			if(cacheKeys.length > 36){
				delete this.lrBundleCache[cacheKeys[0]];
			}
		}
		const liureng = {
			nongli: lrNongli,
			nianMing: nianMing,
			yue: lrBundle.yue,
			timezi: lrBundle.timezi,
			guizi: lrBundle.guizi,
			fourColumns: {
				year: dunjia && dunjia.ganzhi ? (dunjia.ganzhi.year || '') : '',
				month: dunjia && dunjia.ganzhi ? (dunjia.ganzhi.month || '') : '',
				day: dunjia && dunjia.ganzhi ? (dunjia.ganzhi.day || '') : '',
				time: dunjia && dunjia.ganzhi ? (dunjia.ganzhi.time || '') : '',
			},
		};
		let liurengRefBundle = null;
		const runYearRef = lrNongli && lrNongli.runyear ? { year: lrNongli.runyear } : null;
		try{
			liurengRefBundle = buildLiuRengReferenceBundle(liureng, chartForLr, guirengType, runYearRef, lrCastOverride);
		}catch(e){
			liurengRefBundle = null;
		}
		// 六壬断卦层快照入参(供 buildSanShiUnitedSnapshotText 复用独立 buildLiuRengSnapshotText);
		// 随快照各路径(recalc/存档/还原)同源传递,故落 state 让 state 派生的两处 payload 也带得上。
		const liurengSnapshotInput = {
			guirengType,
			chartForLr,
			lrCastOverride,
			// [挂载自检 三式 P0] 断卦层要的是 castOpts 形态(yueJiangMethod/fenZhouYe/涉害/年神/土旺/占类…),override 对象另带;
			// 此前把 lrCastOverride 当第 8 参 castOpts 传 → 键名全不匹配 → 12 个断卦段按默认盘重算。
			lrCastOpts: pickSanshiLiurengCastOpts(mergedOptions, lrNongli),
			runYearRef,
		};
		// 太乙 taiyi 已在 dunjia 前并行取得并落缓存(见上方 Promise.all)。
		let outerData = this.outerDataCache.data;
		const outerCoordKey = this.state.outerCoord || 'ecliptic';
		if(this.outerDataCache.chartKey !== outerChartKey || this.outerDataCache.coord !== outerCoordKey){
			outerData = buildOuterData(astroChart, this.state.outerCoord);
			this.outerDataCache = {
				chartKey: outerChartKey,
				coord: outerCoordKey,
				data: outerData,
			};
			// [Z6] 择日宿主代点首盘(加性:未起盘态 sync 只存草稿=用户定版语义,宿主 pick 语义
			// 是「点击即起盘看盘」——经此显式起;主页 hook 不调 plot=零影响)。
			// [挂载自检 F-37] 择日宿主 pick 前回写工作台扫描口径(六壬贵人/月将/阴阳系、奇门盘式/起局/流派/值使/空亡/驿马、太乙积年)
			// 到本页 options,让 pick 后显示盘/母快照与命中判定同口径(此前宿主 fields 只带时地,显示盘按左栏旧档自排)。
			this.props.hook.applyOptions = (partial)=>new Promise((resolve)=>{
				if(this.unmounted || !partial || typeof partial !== 'object' || !Object.keys(partial).length){ resolve(); return; }
				this.setState({ options: { ...(this.state.options || {}), ...partial } }, resolve);
			});
			this.props.hook.plot = ()=>{
				if(this.unmounted){
					return;
				}
				this.clickPlot();
			};
			// [Q-271/ZC-14] 择日宿主扫描前取本页奇门家全量引擎 options(暗干/暗支/八神/寄宫/移星等左栏档),
			// 与奇门择日「取遁甲页全部 options」同律;工作台 13 键覆盖其上。
			this.props.hook.getQimenOptions = ()=>(this.unmounted ? null : this.getQimenOptions());
		}
			const snapshotPayload = {
				fields: flds,
				options: mergedOptions,
				nongli,
				displaySolarTime: this.state.displaySolarTime,
				liureng,
				dunjia,
				taiyi,
				liurengRefBundle,
			keData: lrBundle.keData,
			sanChuan: lrBundle.sanChuan,
			lrLayout: lrBundle.lrLayout,
			outerData,
			guirengType: liurengSnapshotInput.guirengType,
			liurengChartForLr: liurengSnapshotInput.chartForLr,
			lrCastOverride: liurengSnapshotInput.lrCastOverride,
			lrCastOpts: liurengSnapshotInput.lrCastOpts,
			liurengRunYear: liurengSnapshotInput.runYearRef,
			ziweiSihua: this.ziweiSihuaSnapshotInput || null,
		};
		const snapshotMeta = {
			date: flds && flds.date ? flds.date.value.format('YYYY-MM-DD') : '',
			time: flds && flds.time ? flds.time.value.format('HH:mm:ss') : '',
			zone: flds && flds.zone ? flds.zone.value : '',
			lon: flds && flds.lon ? flds.lon.value : '',
			lat: flds && flds.lat ? flds.lat.value : '',
		};
		this.lastRecalcSignature = recalcSignature;
		// [R4-B7/C16 靶①] 双提交合一:盘结果与调用方补丁(loading:false/displaySolarTime)同一次
		// setState 落地 —— 旧形态先渲「新盘 + loading 还挂着」一帧再渲去转圈一帧,肉眼即闪帧。
		// (horosa_sanshi_render_slice_v1 S5 收敛注:同目标,提交期内折形态换上游 commitPatch
		//  穿线形 #49;refreshAll 尾部兜底现按 !changed 门控,常态零第二次提交。)
		this.setState({
			nongli,
			liureng,
			dunjia,
			taiyi,
			liurengRefBundle,
			liurengSnapshotInput,
			lrLayout: lrBundle.lrLayout,
			keData: lrBundle.keData,
			sanChuan: lrBundle.sanChuan,
			...(commitPatch || null),
		}, ()=>{
			// horosa_panel_ready_v1:三式合一的中栏(六壬/遁甲/太乙三盘)与右栏 5 页签全部派生自本次
			// setState 的这一组字段,故这里 = 「中栏+右栏画完」。本行已在 recalcByNongli 的
			// SANSHI_RECALC_DEFER_MS 去抖与 refreshSeq 竞态守卫【之后】(陈旧轮次在上游即已 return),
			// 故不会给作废的那一轮记点;markPanelReady 自身另有 generation 去重兜底。
			markPanelReady('sanshiunited');
			this.scheduleSnapshotSave(snapshotPayload, snapshotMeta);
		});
		return true;
	}

	async ensureJieqiSeed(fields, year){
		if(!year || Number.isNaN(year)){
			return null;
		}
		if(this.jieqiYearSeeds[year]){
			return this.jieqiYearSeeds[year];
		}
		if(this.jieqiSeedPromises[year]){
			return this.jieqiSeedPromises[year];
		}
		const params = this.genJieqiParams(fields, year);
		if(!params){
			return null;
		}
		this.jieqiSeedPromises[year] = Promise.resolve().then(async()=>{
			const seed = await fetchPreciseJieqiSeed(params);
			if(seed){
				this.jieqiYearSeeds[year] = seed;
			}
			return seed;
		}).finally(()=>{
			delete this.jieqiSeedPromises[year];
		});
		// 预加载失败静默：旁路 catch 防 unhandledrejection，不改变调用方拿到的 promise 语义
		this.jieqiSeedPromises[year].catch(()=>{});
		return this.jieqiSeedPromises[year];
	}

	prefetchJieqiSeedForFields(fields, overrideOptions){
		const flds = fields || this.state.localFields || this.props.fields;
		if(!flds || !flds.date || !flds.date.value){
			return;
		}
		const qimenOptions = this.getQimenOptions(overrideOptions);
		if(!needJieqiYearSeed(qimenOptions)){
			return;
		}
		const year = parseInt(flds.date.value.format('YYYY'), 10);
		if(!year || Number.isNaN(year)){
			return;
		}
		// [Q-155] 种子年份集单源 jieqiSeedYears(日家/金函 y-1,y,y+1;其余 y-1,y)。
		Promise.all(jieqiSeedYears(qimenOptions, year).map((yy)=>this.ensureJieqiSeed(flds, yy))).catch(()=>null);
	}

	prefetchNongliForFields(fields){
		const flds = fields || this.state.localFields || this.props.fields;
		if(!flds){
			return;
		}
		const params = this.genParams(flds);
		if(!params){
			return;
		}
		fetchPreciseNongli(params).then((result)=>{
			if(result){
				setNongliLocalCache(params, result);
			}
		}).catch(()=>null);
	}

	async refreshAll(fields, force){
		if(!fields){
			return;
		}
		const stateOptions = this.state.options || {};
		const key = `${getFieldKey(fields)}|${safe(stateOptions.sex)}|${safe(stateOptions.after23NewDay)}|${normalizeTimeAlg(stateOptions.timeAlg)}`;
		if(this.pendingRefresh && this.pendingRefresh.key === key){
			return this.pendingRefresh.promise;
		}
		if(!force && key === this.lastKey){
			return;
		}
		this.lastKey = key;
		const params = this.genParams(fields);
		if(!params){
			return;
		}
		const seq = ++this.refreshSeq;
		const refreshPromise = (async ()=>{
			const qimenOptions = this.getQimenOptions();
			const shouldWaitSeed = needJieqiYearSeed(qimenOptions);
			try{
				const year = parseInt(fields.date.value.format('YYYY'), 10);
				const waitSeed = !!(year && shouldWaitSeed);
				// [Q-155] 种子年份集单源 jieqiSeedYears(日家/金函含 y+1);缺任一年即 missingSeed → 种子到齐后 recalcByNongli 重算。
				const seedYears = waitSeed ? jieqiSeedYears(qimenOptions, year) : [];
				const seedPromise = waitSeed ? Promise.all(seedYears.map((yy)=>this.ensureJieqiSeed(fields, yy))) : null;
				const missingSeed = waitSeed && seedYears.some((yy)=>!this.jieqiYearSeeds[yy]);
				const precisePromise = fetchPreciseNongli(params);
				const cachedNongli = getNongliLocalCache(params);
				let nongli = cachedNongli;
				let usedFallback = false;
				if(!nongli){
					if((missingSeed || force) && !this.state.loading){
						this.setState({ loading: true });
					}
					const budgetResult = await Promise.race([
						precisePromise.then((result)=>({
							result,
						})),
						timeoutResolve(SANSHI_FAST_BUDGET_MS, {
							result: null,
						}),
					]);
					let preciseHit = !!(budgetResult && budgetResult.result);
					nongli = preciseHit ? budgetResult.result : null;
					if(!nongli){
						nongli = await precisePromise;
						preciseHit = !!nongli;
					}
					if(!nongli){
						usedFallback = true;
						nongli = this.getChartNongliFallback();
					}
					if(!nongli && this.state.nongli){
						usedFallback = true;
						nongli = {
							...this.state.nongli,
						};
					}
					if(!nongli){
						throw new Error('precise.nongli.unavailable');
					}
					if(preciseHit){
						setNongliLocalCache(params, nongli);
					}
				}
					const displaySolarTime = await this.resolveDisplaySolarTime(params, nongli);
						if(this.unmounted || seq !== this.refreshSeq){
							return;
						}
						// [R4-B7/C16 靶①] 补丁预算好随盘结果同帧提交(recalcByNongli 第五参);
						// 仅当 recalc 未落 setState(签名去重/守卫 early-return,changed=false)时才在
						// 这里兜底单独提交 —— 否则「新盘+转圈」中间帧重现。
						const commitPatch = {};
						if(this.state.loading){
							commitPatch.loading = false;
						}
						if(displaySolarTime !== this.state.displaySolarTime){
							commitPatch.displaySolarTime = displaySolarTime;
						}
						const changed = await this.recalcByNongli(fields, nongli, null, displaySolarTime, commitPatch);
						if(!changed && !this.state.dunjia && this.lastRecalcError){
							throw this.lastRecalcError;
						}
						if(!this.unmounted && seq === this.refreshSeq && !changed){
							const patch = {};
							if(this.state.loading){
								patch.loading = false;
							}
							if(displaySolarTime !== this.state.displaySolarTime){
								patch.displaySolarTime = displaySolarTime;
							}
							if(Object.keys(patch).length > 0){
								this.setState(patch);
							}
					}
					const baseNongliKey = getNongliKey(nongli);
					precisePromise.then((refinedNongli)=>{
						if(!refinedNongli || this.unmounted || seq !== this.refreshSeq){
							return;
						}
							setNongliLocalCache(params, refinedNongli);
							this.resolveDisplaySolarTime(params, refinedNongli).then((nextDisplaySolarTime)=>{
								if(this.unmounted || seq !== this.refreshSeq){
									return;
								}
								if(nextDisplaySolarTime !== this.state.displaySolarTime){
									this.setState({ displaySolarTime: nextDisplaySolarTime });
								}
							}).catch(()=>null);
							// horosa_sanshi_render_slice_v1(S6):精算农历同键短路。fallback 路径原本因
							// usedFallback 无条件补跑一轮 recalcByNongli,但六键(年/月/日干支/时辰/节气/闰年)
							// 逐字相同的精算结果在 performRecalcByNongli 里也只会撞 recalcSignature 早退 ——
							// 白付一次去抖定时器 + 全套签名计算。仅当上一轮已产出健康盘面(dunjia 在位且无
							// recalcError)才跳过;键不同、或上一轮失败(保留这次兜底重试机会)照旧全算,
							// 非 fallback 路径的既有短路语义逐字不变。
							if(getNongliKey(refinedNongli) === baseNongliKey){
								if(!usedFallback){
									return;
								}
								if(this.state.dunjia && !this.lastRecalcError){
									return;
								}
							}
						this.recalcByNongli(fields, refinedNongli);
					}).catch(()=>null);
					if(waitSeed && missingSeed && seedPromise){
						seedPromise.then(()=>{
						if(this.unmounted || seq !== this.refreshSeq){
							return;
						}
							const latestNongli = this.state.nongli || nongli;
							if(!latestNongli){
								return;
							}
							this.recalcByNongli(fields, latestNongli);
						}).catch(()=>null);
						}
				}catch(e){
					if(!this.unmounted && seq === this.refreshSeq){
						this.setState({ loading: false });
						const errText = `${safe(e && e.message, '')}`.toLowerCase();
						if(errText.indexOf('precise.nongli.unavailable') >= 0){
							message.error('三式合一计算失败：精确历法服务不可用');
						}else{
							const detail = safe(e && e.message, '').trim();
							message.error(detail ? `三式合一计算异常：${detail}` : '三式合一计算异常，请重试');
						}
						if(e){
							console.error('[SanShiUnited] refreshAll failed', e);
						}
					}
				}finally{
				if(this.pendingRefresh && this.pendingRefresh.seq === seq){
					this.pendingRefresh = null;
				}
			}
		})();
		this.pendingRefresh = {
			key,
			seq,
			promise: refreshPromise,
		};
		return refreshPromise;
	}

	calcBoardSize(height){
		const viewH = this.state.viewportHeight || 900;
		const baseH = typeof height === 'number' ? height : viewH - 20;
		const hostH = this.state.leftBoardHeight > 0 ? this.state.leftBoardHeight : baseH;
		// 三式方盘必须完整留在中间栏内：顶部历法栏、底部旬空栏和间距先扣掉，再按宽度二次约束。
		// [极档巡检 2026-09-18] 方盘 380px 底线按视觉口径(÷z):壳放大档中栏只有 1728/z 宽,CSS px 底线会把方盘撑出栏外。
		const boardMin = visualFloorPx(SANSHI_BOARD_MIN);
		const hCap = Math.max(boardMin, Math.min(viewH - 340, baseH - 318, hostH - 318));
		const wCap = this.state.leftBoardWidth > 0 ? (this.state.leftBoardWidth - 8) : SANSHI_BOARD_MAX;
		let target = hCap;
		if(Number.isFinite(wCap) && wCap > 0){
			target = Math.min(target, wCap);
		}
		return clamp(Math.round(target), boardMin, SANSHI_BOARD_MAX);
	}

	renderLeftBoard(height){
		if(!this.state.hasPlotted){
			return <Card bordered={false}>点击左侧“起盘”后显示三式合一盘</Card>;
		}
		if(!this.state.dunjia){
			return <Card bordered={false}>暂无三式合一数据</Card>;
		}
		const boardSize = this.calcBoardSize(height);
		// 盘面绘制单源迁至 SanshiUnitedBoard(择日概览共享);此壳只装配实例态,JSX 与迁出前逐节点等价。
		const boardFields = this.state.hasPlotted
			? (this.state.plottedFields || this.state.localFields || this.props.fields)
			: this.getActiveFields();
		return (
			<MemoSanshiUnitedBoard
				boardSize={boardSize}
				chartWrap={this.props.chartObj || this.props.chart || null}
				dunjia={this.state.dunjia}
				lrLayout={this.state.lrLayout}
				keData={this.state.keData}
				sanChuan={this.state.sanChuan}
				nongli={this.state.nongli}
				liureng={this.state.liureng}
				fields={boardFields}
				displaySolarTime={this.state.displaySolarTime}
				outerCoord={this.state.outerCoord}
				showWeakSolid={this.state.showWeakSolid}
				showAstroMeaning={this.props.showAstroMeaning}
			/>
		);
	}

	renderInputPanel(){
		// horosa_sanshi_render_slice_v1(S1):左栏「三式设置」整栏收编进 SanShiInputPanel(31 个 antd
		// Select)。state 切片按引用下传:options/localFields 每次变更均换新引用 ⇒ 相关重渲一次不少;
		// 处理器全部函数型 ⇒ wrapperPropsEqual 视为恒等,子组件重渲时自然拿到最新闭包。
		return (
			<SanShiInputPanel
				fields={this.getActiveFields()}
				options={this.state.options}
				outerCoord={this.state.outerCoord}
				showWeakSolid={this.state.showWeakSolid}
				loading={this.state.loading}
				hasPlotted={this.state.hasPlotted}
				onTimeChanged={this.onTimeChanged}
				timeHook={this.timeHook}
				onGeoChange={this.changeGeo}
				onOptionChange={this.onOptionChange}
				onTimeAlgChange={this.onTimeAlgChange}
				onGenderChange={this.onGenderChange}
				onAstroZodiacalChange={(v)=>this.onAstroZodiacalChange(v)}
				onAstroFieldOptionChange={this.onAstroFieldOptionChange}
				onOuterCoordChange={this.onOuterCoordChange}
				onShowWeakSolidChange={(flag)=>{ if(this.usesSavedSettings()){ SANSHI_PAGE_SETTINGS.save({ showWeakSolid: flag }); } this.setState({ showWeakSolid: flag }); }}
				clickPlot={this.clickPlot}
				clickSave={this.clickSave}
			/>
		);
	}

		// 遁甲「用神」子tab(静态显示,跳过求测事项/报数/悬浮等交互):用神定位 + 解孤辰寡宿 + 用神取用速查表。
		// 与独立遁甲页同源(computeYongShen / computeGuGua),仅去掉交互层。
		renderSanshiYongShenStatic(pan){
			const soft = 'var(--horosa-text-soft, #595959)';
			const muted = 'var(--horosa-muted, #8c8c8c)';
			const hazardTag = (it)=>{
				if(!it || !it.palaceNum){ return <Tag color='default' style={{ marginRight: 0 }}>未现</Tag>; }
				return it.hazards && it.hazards.length ? <Tag color='red' style={{ marginRight: 0 }}>{it.hazards.join('/')}</Tag> : <Tag color='green' style={{ marginRight: 0 }}>平稳</Tag>;
			};
			const locLine = (label, it, extra)=>(
				<div key={`ssu_ys_loc_${label}`} style={{ lineHeight: '24px' }}>
					<span style={{ fontWeight: 600 }}>{label}</span>
					{it && it.symbol ? <span style={{ color: soft }}>（{it.symbol}）</span> : null}
					<span style={{ color: soft }}>：{it && it.palaceNum ? `${it.palaceName}${LUOSHU_NUM[it.palaceName]}宫·${it.direction}` : '局中未现'}</span>
					{' '}{hazardTag(it)}
					{extra ? <span style={{ color: muted }}> {extra}</span> : null}
				</div>
			);
			if(!pan){
				return <Card size='small'><div style={{ color: muted }}>请先起盘后查看用神分论。</div></Card>;
			}
			const ys = computeYongShen(pan, { faceToFace: true });
			const guGua = computeGuGua(pan);
			if(!ys){
				return <Card size='small'><div style={{ color: muted }}>当前盘暂无用神数据。</div></Card>;
			}
			const yongShenCard = (
				<Card size='small' style={{ marginBottom: 8, borderRadius: 8 }}>
					<div style={{ fontWeight: 600, marginBottom: 6 }}>用神定位</div>
					<div style={{ color: soft, lineHeight: '22px', marginBottom: 6 }}>{ys.yongShenText}</div>
					{locLine('日干·内心/实质', ys.dayGan)}
					{locLine('时干·外在/表象', ys.timeGan)}
					{ys.ganHe ? locLine('干合·配偶/理想型', ys.ganHe) : null}
					{locLine('值符·话语权', ys.zhiFu)}
					{locLine('值使·用武之地', ys.zhiShi)}
					<div style={{ color: muted, marginTop: 4 }}>六亲：{ys.liuQin.map((r)=>`${r.rel.split('·')[1]}(${r.symbol}${r.palaceNum ? r.palaceName + LUOSHU_NUM[r.palaceName] + '宫' : '未现'})`).join('　')}</div>
				</Card>
			);
			const guGuaCard = guGua.length ? (
				<Card size='small' style={{ marginBottom: 8, borderRadius: 8 }}>
					<div style={{ fontWeight: 600, marginBottom: 6 }}>解孤辰寡宿</div>
					<div style={{ color: soft, lineHeight: '24px' }}>
						{guGua.map((g, i)=>(<div key={`ssu_gg_${i}`}>{g.name}（{g.zhi}）：{g.jie}</div>))}
					</div>
				</Card>
			) : null;
			const yongShenRefCard = (
				<Card size='small' style={{ borderRadius: 8 }}>
					<div style={{ fontWeight: 600, color: soft, marginBottom: 4 }}>基本用神</div>
					{QIMEN_YONGSHEN_BASIC.map((r, i)=>(
						<div key={`ssu_ysb_${i}`} style={{ lineHeight: '22px' }}><span style={{ fontWeight: 600 }}>{r[0]}</span><span style={{ color: muted }}>：{r[1]}</span></div>
					))}
					<div style={{ fontWeight: 600, color: soft, margin: '8px 0 4px' }}>分类取用</div>
					<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, lineHeight: '18px' }}>
						<thead><tr style={{ color: muted }}><th style={{ textAlign: 'left', padding: '2px 4px' }}>所测</th><th style={{ textAlign: 'left', padding: '2px 4px' }}>主用神</th><th style={{ textAlign: 'left', padding: '2px 4px' }}>辅看</th></tr></thead>
						<tbody>
							{QIMEN_YONGSHEN_LOOKUP.map((r, i)=>(
								<tr key={`ssu_ysl_${i}`} style={{ borderTop: '1px solid var(--horosa-border, #f0f0f0)' }}>
									<td style={{ padding: '2px 4px', fontWeight: 600, whiteSpace: 'nowrap' }}>{r[0]}</td>
									<td style={{ padding: '2px 4px' }}>{r[1]}</td>
									<td style={{ padding: '2px 4px', color: muted }}>{r[2]}</td>
								</tr>
							))}
						</tbody>
					</table>
					<div style={{ fontWeight: 600, color: soft, margin: '8px 0 4px' }}>取用生克(断成败)</div>
					{QIMEN_YONGSHEN_SHENGKE.map((r, i)=>(
						<div key={`ssu_yss_${i}`} style={{ lineHeight: '22px' }}><span style={{ fontWeight: 600 }}>{r[0]}</span><span style={{ color: muted }}>：{r[1]}</span></div>
					))}
					<div style={{ color: muted, fontSize: 12, marginTop: 6 }}>断成败核心:看用神之间(日干vs时干、日干vs用事门)生克——生我合我者成、克我冲我者败,再叠旺衰格局。</div>
				</Card>
			);
			return <div>{yongShenCard}{guGuaCard}{yongShenRefCard}</div>;
		}

		// 遁甲「化解」子tab(静态显示,跳过求测事项/悬浮等交互):六害总览 + 逐宫化解 + 解局三法 + 八门化气大阵 + 干支形象 + 换局移星。
		// 与独立遁甲页同源(computeDangers / buildJieHua / computeProtect)。
		renderSanshiJieHuaStatic(pan){
			if(!pan){
				return <Card size='small'><div style={{ color: 'var(--horosa-muted, #8c8c8c)' }}>请先起盘后查看化解。</div></Card>;
			}
			const DANGER_DOT = { 击刑: '#cf1322', 入墓: '#8b5e3c', 庚: '#d4380d', 白虎: '#a8071a', 门迫: '#fa8c16', 空亡: '#2f54eb' };
			const soft = 'var(--horosa-text-soft, #595959)';
			const muted = 'var(--horosa-muted, #8c8c8c)';
			const border = 'var(--horosa-border, #f0f0f0)';
			const dangers = computeDangers(pan);
			const jieHua = buildJieHua(pan);
			const protect = computeProtect(pan, { topic: 'shexin' });
			const badge = (ch, color, size)=>(
				<span style={{ flex: '0 0 auto', width: size || 22, height: size || 22, borderRadius: '50%', background: `${color}1a`, color, fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{ch}</span>
			);
			return (
				<div>
					<Card size='small' style={{ marginBottom: 10, borderRadius: 8 }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
							<span style={{ fontWeight: 600 }}>六害总览</span>
							<Tag color={dangers.length ? 'volcano' : 'green'} style={{ marginRight: 0 }}>{dangers.length ? `${dangers.length} 处` : '无六害'}</Tag>
						</div>
						<div style={{ color: muted, fontSize: 12, marginBottom: 8 }}>危害递减：刑＞墓＞庚＞虎＞迫＞空；天干＞一切，先解击刑天干。</div>
						{dangers.length ? dangers.map((d, i)=>(
							<div key={`ssu_hz_${i}`} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '6px 0', borderTop: i ? `1px solid ${border}` : 'none' }}>
								{badge(d.oneChar, DANGER_DOT[d.type])}
								<div style={{ flex: 1, minWidth: 0 }}>
									<div style={{ lineHeight: '20px' }}><span style={{ color: DANGER_DOT[d.type], fontWeight: 600 }}>{d.type}</span><span style={{ color: soft }}> · {d.palaceName}{LUOSHU_NUM[d.palaceName]}宫 · {d.direction} · {d.symbol}</span></div>
									<div style={{ color: muted, fontSize: 12, lineHeight: '18px' }}>{DANGER_BRIEF[d.type] || d.note}</div>
								</div>
							</div>
						)) : <div style={{ color: soft }}>本局四纲八宫未现六害，吉。</div>}
					</Card>
					{jieHua.map((c, i)=>{
						const worst = (c.dangers[0] && c.dangers[0].type) || '';
						const col = DANGER_DOT[worst] || '#d9d9d9';
						return (
							<Card size='small' style={{ marginBottom: 8, borderRadius: 8, borderLeft: `3px solid ${col}` }} key={`ssu_jh_${i}`}>
								<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
									<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, flexWrap: 'wrap' }}>
										{c.dangers.map((d, k)=>(<span key={`ssu_db_${k}`} style={{ display: 'inline-flex' }}>{badge(d.oneChar, DANGER_DOT[d.type])}</span>))}
										<span style={{ fontWeight: 600, color: col }}>{c.palaceName}{LUOSHU_NUM[c.palaceName]}宫<span style={{ color: muted, fontWeight: 400, fontSize: 12 }}> · {c.direction} · {c.deg}</span></span>
									</span>
									<Tag style={{ marginRight: 0, flex: '0 0 auto' }}>天盘干「{c.tianGan}」</Tag>
								</div>
								<div style={{ color: soft, lineHeight: '22px' }}>
									{c.mie.length ? (
										<div style={{ marginBottom: 4 }}><span style={{ color: muted }}>① 灭象（先移走）</span>
											{c.mie.map((m, k)=>(<div key={`ssu_mie_${k}`} style={{ paddingLeft: 20 }}>· {m}</div>))}
										</div>
									) : null}
									{c.placements.length ? (
										<div style={{ marginBottom: 4 }}><span style={{ color: muted }}>② 布阵（再放上）</span>
											{c.placements.map((p, k)=>(<div key={`ssu_pl_${k}`} style={{ paddingLeft: 20 }}><span style={{ color: '#2e7d32', fontWeight: 600 }}>{p.where}</span>　{p.text}</div>))}
										</div>
									) : null}
									<div style={{ display: 'flex', alignItems: 'flex-start' }}><span style={{ color: muted, flex: '0 0 auto' }}>③ 时机　</span><span>本宫 {c.benZhi}日 / {c.ben}<br />对宫 {c.duiZhi}日 / {c.dui}</span></div>
									{c.notes.map((n, k)=>(<div key={`ssu_nt_${k}`} style={{ color: muted, fontSize: 12, marginTop: 2 }}>※ {n}</div>))}
								</div>
							</Card>
						);
					})}
					<Card size='small' style={{ marginBottom: 8, borderRadius: 8 }}>
						<div style={{ fontWeight: 600, marginBottom: 6 }}>解局三法（逆天程度递增）</div>
						<div style={{ color: soft, lineHeight: '22px' }}>
							{SAN_FA_TEXT.map((f, i)=>(<div key={`ssu_sf_${i}`}><span style={{ fontWeight: 600 }}>{f.name}</span><span style={{ color: muted }}>（{f.scope}）</span>　{f.desc}</div>))}
						</div>
					</Card>
					<Card size='small' style={{ marginBottom: 8, borderRadius: 8 }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
							<span style={{ fontWeight: 600 }}>八门化气大阵 · 必护天干</span>
							<Tag color='geekblue' style={{ marginRight: 0 }}>{protect.filter((r)=>r.palaceNum && !r.ok).length} 处需护</Tag>
						</div>
						<div style={{ color: muted, fontSize: 12, marginBottom: 6 }}>先离刑墓庚（主），再离虎迫空（次）；天干往高处放、地支往低处放。下列天干勿落六害宫、勿受克。</div>
						{protect.map((r, i)=>(
							<div key={`ssu_pr_${i}`} style={{ lineHeight: '22px', padding: '3px 0', borderTop: i ? `1px solid ${border}` : 'none' }}>
								<span style={{ fontWeight: 600 }}>{r.label}{r.gan ? `「${r.gan}」` : ''}</span>
								<span style={{ color: soft }}>：{r.palaceNum ? `${r.palaceName}${LUOSHU_NUM[r.palaceName]}宫·${r.direction}` : '局中未现'}</span>
								{r.hazards.length ? <Tag color='red' style={{ marginLeft: 6 }}>{r.hazards.join('/')}</Tag> : (r.palaceNum ? <Tag color='green' style={{ marginLeft: 6 }}>平稳</Tag> : null)}
								<div style={{ color: muted, fontSize: 12, paddingLeft: 2 }}>{r.advice}</div>
							</div>
						))}
						<div style={{ color: muted, fontSize: 12, marginTop: 8, paddingTop: 6, borderTop: `1px solid ${border}` }}>
							<div style={{ marginBottom: 2 }}>※「生年干」指<strong>局中所有相关人</strong>（本人 / 家人 / 牵涉者）的出生年天干，都不能落刑墓——此处仅按本盘年干示例，其余请按各人属相或八字年干自行加护。</div>
							{BU_ZHEN_TIPS.map((t, i)=>(<div key={`ssu_bz_${i}`}>· {t}</div>))}
						</div>
					</Card>
					<Card size='small' style={{ marginBottom: 8, borderRadius: 8 }}>
						<div style={{ fontWeight: 600, marginBottom: 6 }}>干支形象表（造象参考）</div>
						<div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 12, rowGap: 2, color: soft, lineHeight: '22px', fontSize: 13 }}>
							{Object.keys(GAN_XIANG).map((g)=>(<span key={`ssu_gx_${g}`}><span style={{ fontWeight: 600 }}>{g}</span>　{GAN_XIANG[g].color}·{GAN_XIANG[g].material}（{GAN_XIANG[g].branch}{ZHI_ZODIAC[GAN_XIANG[g].branch]}）</span>))}
						</div>
					</Card>
					<Card size='small' style={{ borderRadius: 8 }}>
						<div style={{ fontWeight: 600, marginBottom: 6 }}>换局 / 移星</div>
						<div style={{ color: soft, lineHeight: '22px' }}>局太差、改不动时可整盘换局＝顺转宫位（移即催）。转两三个重点宫为宜，勿全转。</div>
					</Card>
				</div>
			);
		}

		renderRight(){
			const fields = this.getActiveFields();
			const pan = this.state.dunjia;
			const opt = this.state.options || {};
		const ovXun = computeSanshiXun(pan);
		const rightPanelTab = this.state.rightPanelTab === 'status' ? 'overview' : this.state.rightPanelTab;
		const refBundle = this.state.liurengRefBundle || {};
		const refContext = refBundle.context || {};
		const xiaojuAllItems = Array.isArray(refBundle.xiaoju) ? refBundle.xiaoju : [];
		const xiaojuMainItems = xiaojuAllItems.filter((item)=>!XIAO_JU_REFERENCE_TAB_KEYS.has(item.key));
		const xiaojuReferenceItems = xiaojuAllItems.filter((item)=>XIAO_JU_REFERENCE_TAB_KEYS.has(item.key));
		const overviewItems = Array.isArray(refBundle.overview) ? refBundle.overview : [];
		const refSummary = [
			refContext.courseName ? `课式：${refContext.courseName}` : '',
			refContext.sanChuanText ? `三传：${refContext.sanChuanText}` : '',
			refContext.dayGanZi ? `日干支：${refContext.dayGanZi}` : '',
		].filter(Boolean).join('；');
		const bagongPalace = BAGONG_PALACE_NAME[this.state.bagongPalace] ? this.state.bagongPalace : BAGONG_PALACE_ORDER[0];
		const bagongData = buildQimenBaGongPanelData(pan, bagongPalace);
		const panelHeight = this.state.rightPanelHeight || Math.max(visualFloorPx(420), (this.state.viewportHeight || 900) - 120);
		const topHeight = 0;
		const tabBodyHeight = Math.max(0, panelHeight - topHeight - 74);
		const nestedTabBodyHeight = Math.max(140, tabBodyHeight - 110);
		return (
			<div ref={this.captureRightPanel} className="horosa-sanshi-right-shell" style={{ display: 'flex', flexDirection: 'column', height: panelHeight, overflow: 'hidden' }}>
				{/* [Q-162/T-80] 原此处有一整块 display:none 的旧右栏控件(模式/时间算法/性别/贵人/排盘/日界/值使/月家/
				    移星/起局/空亡/驿马/太乙盘式/积年法/黄道/宫制 + 经纬度/起盘/保存)。它对用户完全不可达,却
				    ① 让「太乙盘式 / 积年法 / 宫制」只活在不可见处(左栏没有对应控件=这三档实际改不了);
				    ② 与左栏共用 this.timeHook,隐藏实例把左栏实例的注册顶掉,起盘读到的是隐藏控件的旧时刻;
				    ③ 污染死开关审计指纹(取 innerHTML,隐藏子树照样计入)→ 快轮「有反应」全是这块的假活。
				    整块已删;三档改由左栏可见控件承接(太乙流派节的「盘式 / 古法公式」、选项节的「宫制」)。 */}

				<Tabs
					activeKey={rightPanelTab}
					onChange={(key)=>this.setState({ rightPanelTab: key })}
					destroyInactiveTabPane
					animated={false}
					className="horosa-sanshi-right-tabs"
					style={{ marginTop: 8, flex: 1, minHeight: 0, overflow: 'hidden' }}
				>
					{/* horosa_freeze_subtabs_v1:外层 5 页签。注意本组的 Tabs 已带 destroyInactiveTabPane —— 那
					    只让 antd 不【挂载】非激活面板,但 children 是父 render 里的内联 JSX,**求值照跑**:
					    「太乙」页那段 computeTaiyiShuli/computeGeju/computeVictory/computeFenye/computeShenSuan
					    的 IIFE、「六壬」页 6 个内层面板、「遁甲」页 8 宫 buildQimenBaGongPanelData,以前每次父
					    重渲(切时间/改选项/换任一页签)全部白跑一遍。函数式 FreezeSubTab 把求值推到「本面板
					    真被渲染」那一刻:非激活 → 函数不调用 = 真零成本;激活 → 拿本轮最新 children 立刻渲,
					    内容与旧行为逐字一致(冻结≠卸载,与 destroyInactiveTabPane 的既有卸载语义互不干涉)。 */}
					<TabPane tab="概览" key="overview">
						<FreezeSubTab active={rightPanelTab === 'overview'}>{()=>(
						<Card bordered={false} bodyStyle={{ padding: '10px 12px' }}>
							<div style={{ lineHeight: '26px' }}>
								<div>局数：{pan ? pan.juText : '—'}</div>
								<div>旬首：{pan ? ovXun.xunShou : '—'}</div>
								<div>旬仪：{pan ? ovXun.xunYi : '—'}</div>
								<div>值符：{pan ? pan.zhiFu : '—'}</div>
								<div>值使：{pan ? pan.zhiShi : '—'}</div>
								<div>本旬：{pan ? ovXun.benXun : '—'}</div>
								<div>旬空：{pan ? ovXun.riKong : '—'}</div>
								<div>时空：{pan ? ovXun.shiKong : '—'}</div>
								<div>{pan && pan.yiMa ? pan.yiMa.text : '日马：无'}</div>
								<div>阴阳遁：{pan ? pan.yinYangDun : '—'}</div>
								<div>时间算法：{getTimeAlgLabel(opt.timeAlg)}</div>
								<div>换日：{opt.after23NewDay === 1 ? '23点算第二天' : '24点算第二天'}</div>
								<div>月将：{this.state.lrLayout ? this.state.lrLayout.yue : '—'}</div>
							</div>
							{pan && pan.shenSha && pan.shenSha.allItems && pan.shenSha.allItems.length ? (
								<>
									<Divider style={{ margin: '10px 0 8px' }} />
									<div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--horosa-text, #262626)' }}>神煞</div>
									<div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', columnGap: 10, rowGap: 6, lineHeight: '22px' }}>
										{pan.shenSha.allItems.map((item)=>(<div key={`ss_item_${item.name}`} style={{ fontSize: 12 }}><span style={{ color: 'var(--horosa-text, #262626)' }}>{item.name}</span><span style={{ color: 'var(--horosa-muted, #8c8c8c)', marginLeft: 2 }}>{item.value}</span></div>))}
									</div>
								</>
							) : null}
						</Card>
						)}</FreezeSubTab>
					</TabPane>
					<TabPane tab="太乙" key="taiyi">
						<FreezeSubTab active={rightPanelTab === 'taiyi'}>{()=>(
						<Card bordered={false} bodyStyle={{ padding: '10px 12px' }}>
							<div style={{ lineHeight: '24px' }}>
								{this.state.taiyi ? (()=>{
									// 太乙数理/格局/胜负/分野/诸神之算 纯派生(据 kintaiyi pan,零碰后端 golden;与独立 TaiYiMain 同款 compute*)。
									const tpan = this.state.taiyi;
									const shuli = computeTaiyiShuli(tpan);
									const geju = computeGeju(tpan);
									const victory = computeVictory(tpan, geju);
									const fenye = computeFenye(tpan);
									const shenSuan = computeShenSuan(tpan);
									const taisuiAlias = computeTaisuiAlias(tpan);
									const doorJx = activeDoorJixiong(tpan);
									const ehui = computeEhui(tpan);
									const limitYun = computeLimitYun(tpan);
									const sanyuan = computeSanyuan(tpan);
									const nayin = computeTaiyiNayin(tpan);
									const shijing = computeShiJing(tpan);
									const wuziyuan = computeWuziyuan(tpan);
									const calTags = (tags)=>(tags || []).map((t, i)=>{
										const tone = shuliTone(t);
										const color = tone === 'bad' ? 'var(--horosa-danger, #c0563a)' : tone === 'good' ? 'var(--horosa-accent, #d7ad69)' : 'var(--horosa-muted, #8c8c8c)';
										return <span key={i} style={{ display: 'inline-block', fontSize: 11, lineHeight: 1.5, padding: '0 5px', marginLeft: 4, borderRadius: 7, border: `1px solid ${color}`, color }}>{t}</span>;
									});
									return (
									<Tabs
										activeKey={this.state.taiyiSubTab}
										onChange={(key)=>this.setState({ taiyiSubTab: key })}
										destroyInactiveTabPane
										animated={false}
										className="horosa-sanshi-liureng-tabs"
									>
										<TabPane tab="概览" key="overview">
											<div style={{ lineHeight: '24px', paddingRight: 4 }}>
												<div>盘式：{tpan.options ? tpan.options.styleLabel : '—'}</div>
												<div>积年法：{tpan.options ? tpan.options.accumLabel : '—'}</div>
												<div>流派：{tpan._schoolNote ? (<span style={{ color: 'var(--horosa-astro-blue, #7fa8d8)' }} title="左栏「太乙流派」非默认;被覆盖神煞与主客算据古法重算">{tpan._schoolNote}</span>) : '默认(从盘)'}</div>
												<div>博弈：{tpan.options ? tpan.options.gameTheoryLabel : '—'}</div>
												<div>局式：{tpan.kook ? tpan.kook.text : '—'}</div>
												<div>积数：{tpan.accNum}{sanyuan ? `（${sanyuan}）` : ''}{wuziyuan ? ` · ${wuziyuan}` : ''}</div>
												<div>太乙：{tpan.taiyiPalace}宫（数{tpan.taiyiNum}）</div>
												<div>文昌：{tpan.skyeyes} 始击：{tpan.sf}{nayin ? ` · 纳音${nayin.ganzhi}·${nayin.nayin}` : ''}</div>
												<div>太岁：{tpan.taishui}{taisuiAlias ? `（${taisuiAlias}）` : ''} 合神：{tpan.hegod} 计神：{tpan.jigod}</div>
												<div>定目：{tpan.se || '—'}</div>
												{shijing ? (<div>十精：{shijing.map((it, i)=>(<span key={i} style={{ marginRight: 6 }}>{it.name}·{it.at}</span>))}</div>) : null}
												<div>主算：{tpan.homeCal}{calTags(shuli && shuli.home)} 客算：{tpan.awayCal}{calTags(shuli && shuli.away)} 定算：{tpan.setCal}{calTags(shuli && shuli.set)}</div>
												<Divider style={{ margin: '8px 0' }} />
												<div>君基：{this.state.taiyi.kingbase} 臣基：{this.state.taiyi.officerbase} 民基：{this.state.taiyi.pplbase}</div>
												<div>四神：{this.state.taiyi.fgd} 天乙：{this.state.taiyi.skyyi} 地乙：{this.state.taiyi.earthyi}</div>
												<div>直符：{this.state.taiyi.zhifu} 飞符：{this.state.taiyi.flyfu}</div>
												<div>五福：{this.state.taiyi.wufuPalace} 帝符：{this.state.taiyi.kingfu} 太尊：{this.state.taiyi.taijun}</div>
												<div>飞鸟：{this.state.taiyi.flybird} 三风：{this.state.taiyi.threewindPalace} 五风：{this.state.taiyi.fivewindPalace} 八风：{this.state.taiyi.eightwindPalace}</div>
												<div>大游：{this.state.taiyi.bigyoPalace} 小游：{this.state.taiyi.smyoPalace}</div>
											</div>
										</TabPane>
										<TabPane tab="十六宫" key="palace16">
											<div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 8, rowGap: 4, paddingRight: 4 }}>
												{this.state.taiyi.palace16 && this.state.taiyi.palace16.map((item)=>(
													<div key={`ty_p16_${item.palace}`}>
														<span style={{ color: 'var(--horosa-text, #262626)' }}>{item.palace}-</span>
														<span style={{ color: 'var(--horosa-muted, #8c8c8c)' }}>{item.items && item.items.length ? item.items.join('、') : '—'}</span>
													</div>
												))}
											</div>
										</TabPane>
										<TabPane tab="八门" key="bamen">
											<div style={{ lineHeight: '24px', paddingRight: 4 }}>
												<div>值使门：{doorJx ? `${doorJx.door}门·${doorJx.jixiong}` : '—'}</div>
												<div>厄会：{ehui.length ? (<span style={{ color: 'var(--horosa-danger, #c0563a)' }}>{ehui.join('、')}</span>) : '无'}</div>
											</div>
										</TabPane>
										<TabPane tab="断法" key="duanfa">
											<div style={{ lineHeight: '24px', paddingRight: 4 }}>
												<div>胜负：{victory ? (<span style={{ fontWeight: 640, color: victory.side === '主胜' ? 'var(--horosa-accent, #d7ad69)' : victory.side === '客胜' ? 'var(--horosa-danger, #c0563a)' : 'var(--horosa-muted, #8c8c8c)' }} title={(victory.reasons || []).join('\n')}>{victory.side}</span>) : '—'}</div>
												<div>格局：{geju.length ? geju.map((g, i)=>(<span key={i} title={g.text} style={{ display: 'inline-block', marginRight: 5, marginBottom: 2, padding: '0 6px', borderRadius: 7, fontSize: 11, lineHeight: 1.6, border: '1px solid var(--horosa-danger, #c0563a)', color: 'var(--horosa-danger, #c0563a)' }}>{g.name}</span>)) : '无显著掩迫囚格对'}</div>
												<div>数理：主算{calTags(shuli && shuli.home)} 客算{calTags(shuli && shuli.away)} 定算{calTags(shuli && shuli.set)}</div>
												<div>分野：{fenye && fenye.taiyi ? `太乙临${fenye.taiyi.gong}${fenye.taiyi.gua}·${fenye.taiyi.zhou}(${fenye.taiyi.men}·${fenye.taiyi.qi})·${fenye.taiyi.omen}${fenye.shiji ? `；始击临${fenye.shiji.gong}${fenye.shiji.gua}·${fenye.shiji.zhou}` : ''}` : '—'}</div>
												<div>诸神之算：{shenSuan ? Object.keys(shenSuan).map((k, i)=>(shenSuan[k] ? (<span key={i} title={(shenSuan[k].tags || []).join('、')} style={{ marginRight: 8 }}>{k}<strong style={{ color: 'var(--horosa-accent, #d7ad69)' }}>{shenSuan[k].value}</strong></span>) : null)) : '—'}</div>
												<div>限运：{limitYun ? `大限太乙临${limitYun.daxian.at}(${limitYun.daxian.span})·小限文昌临${limitYun.xiaoxian.at}(${limitYun.xiaoxian.span})` : '—'}</div>
											</div>
										</TabPane>
									</Tabs>
									);
								})() : (
									<div>暂无太乙数据</div>
								)}
							</div>
						</Card>
						)}</FreezeSubTab>
					</TabPane>
					<TabPane tab="六壬" key="liureng">
						<FreezeSubTab active={rightPanelTab === 'liureng'}>{()=>(
						<Card bordered={false} bodyStyle={{ padding: '10px 12px' }}>
							<Tabs
								activeKey={this.state.liurengRefTab}
								onChange={(key)=>this.setState({ liurengRefTab: key })}
								destroyInactiveTabPane
								animated={false}
								className="horosa-sanshi-liureng-tabs"
							>
								<TabPane tab="大格" key="dage">
									<div style={{ paddingRight: 4 }}>
										{refSummary ? (
											<Card size='small' style={{ marginBottom: 8 }}>
												<div style={{ color: 'var(--horosa-text-soft, #595959)' }}>{refSummary}</div>
											</Card>
										) : null}
										{refBundle.dage && refBundle.dage.length ? refBundle.dage.map((item)=>(
											<Card key={`ssu_lr_dage_${item.key}`} size='small' style={{ marginBottom: 8 }}>
												<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
													<span style={{ fontWeight: 600 }}>{item.name}</span>
													<Tag color='blue'>{item.categoryName || '大格'}</Tag>
												</div>
												<div style={{ color: 'var(--horosa-text-soft, #595959)', lineHeight: '22px', whiteSpace: 'pre-wrap' }}>
													{buildReferenceDocumentText(item, 'dage')}
												</div>
												{item.evidence && item.evidence.length ? (
													<div style={{ color: 'var(--horosa-muted, #8c8c8c)', fontSize: 12, marginTop: 6 }}>依据：{item.evidence.join('；')}</div>
												) : null}
											</Card>
										)) : (
											<Card size='small'><div style={{ color: 'var(--horosa-muted, #8c8c8c)' }}>当前盘未命中已收录的大格条件。</div></Card>
										)}
									</div>
								</TabPane>
								<TabPane tab="小局" key="xiaoju">
									<div style={{ paddingRight: 4 }}>
										{xiaojuMainItems.length ? xiaojuMainItems.map((item)=>(
											<Card key={`ssu_lr_xiaoju_${item.key}`} size='small' style={{ marginBottom: 8 }}>
												<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
													<span style={{ fontWeight: 600 }}>{item.name}</span>
													<Tag color='purple'>{item.categoryName || '小局'}</Tag>
												</div>
												<div style={{ color: 'var(--horosa-text-soft, #595959)', lineHeight: '22px', whiteSpace: 'pre-wrap' }}>
													{buildReferenceDocumentText(item, 'xiaoju')}
												</div>
												{item.evidence && item.evidence.length ? (
													<div style={{ color: 'var(--horosa-muted, #8c8c8c)', fontSize: 12, marginTop: 6 }}>依据：{item.evidence.join('；')}</div>
												) : null}
											</Card>
										)) : (
											<Card size='small'><div style={{ color: 'var(--horosa-muted, #8c8c8c)' }}>当前盘暂未命中已收录的小局条件。</div></Card>
										)}
									</div>
								</TabPane>
								<TabPane tab="毕法" key="bifa">
									<div style={{ paddingRight: 4 }}>
										<div style={{ fontWeight: 600, margin: '2px 0 6px' }}>已命中</div>
										{(()=>{ const hits = matchBiFa(refContext); return hits.length ? hits.map((item)=>(
											<Card key={`ssu_bf_hit_${item.no}`} size='small' style={{ marginBottom: 8 }}>
												<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
													<span style={{ fontWeight: 600 }}>{`${item.no}. ${item.name}`}</span>
													<Tag color='volcano'>毕法</Tag>
												</div>
												<div style={{ color: 'var(--horosa-text-soft, #595959)', lineHeight: '22px' }}>{item.explain}</div>
												{item.evidence && item.evidence.length ? (<div style={{ color: 'var(--horosa-muted, #8c8c8c)', fontSize: 12, marginTop: 4 }}>依据：{item.evidence.join('；')}</div>) : null}
											</Card>
										)) : (<Card size='small'><div style={{ color: 'var(--horosa-muted, #8c8c8c)' }}>本盘暂未机械命中可判定之毕法（仅高置信条目自动命中）。</div></Card>); })()}
										<div style={{ fontWeight: 600, margin: '12px 0 6px' }}>{`全部毕法（${BIFA_LIST.length} 条）`}</div>
										{BIFA_LIST.map((item)=>(
											<div key={`ssu_bf_${item.no}`} style={{ padding: '6px 0', borderBottom: '1px solid var(--horosa-border, rgba(255,255,255,0.06))' }}>
												<div style={{ fontWeight: 600 }}>{`${item.no}. ${item.name}`}</div>
												<div style={{ color: 'var(--horosa-text-soft, #595959)', lineHeight: '20px', fontSize: 13 }}>{item.explain}</div>
											</div>
										))}
									</div>
								</TabPane>
								<TabPane tab="参考" key="reference">
									<div style={{ paddingRight: 4 }}>
										{xiaojuReferenceItems.length ? xiaojuReferenceItems.map((item)=>(
											<Card key={`ssu_lr_ref_${item.key}`} size='small' style={{ marginBottom: 8 }}>
												<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
													<span style={{ fontWeight: 600 }}>{item.name}</span>
													<Tag color='gold'>参考</Tag>
												</div>
												<div style={{ color: 'var(--horosa-text-soft, #595959)', lineHeight: '22px', whiteSpace: 'pre-wrap' }}>
													{buildReferenceDocumentText(item, 'xiaoju')}
												</div>
												{item.evidence && item.evidence.length ? (
													<div style={{ color: 'var(--horosa-muted, #8c8c8c)', fontSize: 12, marginTop: 6 }}>依据：{item.evidence.join('；')}</div>
												) : null}
											</Card>
										)) : (
											<Card size='small'><div style={{ color: 'var(--horosa-muted, #8c8c8c)' }}>当前盘暂无可展示的参考条目。</div></Card>
										)}
									</div>
								</TabPane>
								<TabPane tab="概览" key="overview">
									<div style={{ paddingRight: 4 }}>
										{this.renderLiuRengShenShaWangShuai(refContext)}
										{overviewItems.length ? overviewItems.map((item, idx)=>(
											<Card key={`ssu_lr_overview_${item.key}_${idx}`} size='small' style={{ marginBottom: 8 }}>
												<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
													<span style={{ fontWeight: 600 }}>{item.name}</span>
													<Tag color={item.group === 'laiyi' ? 'cyan' : 'magenta'}>
														{item.group === 'laiyi' ? '天将发用来意诀' : '天将杂主吉凶'}
													</Tag>
												</div>
												<div style={{ color: 'var(--horosa-text-soft, #595959)', lineHeight: '22px', whiteSpace: 'pre-wrap' }}>
													{buildOverviewReferenceText(item)}
												</div>
												{item.evidence && item.evidence.length ? (
													<div style={{ color: 'var(--horosa-muted, #8c8c8c)', fontSize: 12, marginTop: 6 }}>依据：{item.evidence.join('；')}</div>
												) : null}
											</Card>
										)) : (
											<Card size='small'><div style={{ color: 'var(--horosa-muted, #8c8c8c)' }}>当前盘未命中“天将发用来意诀/天将杂主吉凶”条目。</div></Card>
										)}
									</div>
								</TabPane>
								<TabPane tab="七政" key="qizheng">
									<div style={{ paddingRight: 4 }}>
										{(()=>{ const cw = this.props.chartObj || this.props.chart; const ac = cw && cw.chart ? cw.chart : cw; const qz = buildQiZhengItems(ac); return qz && qz.length ? (
											<Card size='small'>
												<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 8 }}>
													{qz.map((item)=>{
														const wxColor = QIZHENG_WUXING_COLOR[item.wx] || 'var(--horosa-text, #d8d2c7)';
														const pColor = QIZHENG_PLANET_COLOR[item.name] || 'var(--horosa-text, #d8d2c7)';
														return (
															<div key={`ssu_qz_${item.key}`} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, padding: '9px 4px 7px', borderRadius: 10, background: item.isYue ? 'linear-gradient(180deg, rgba(212,160,23,0.18), rgba(212,160,23,0.04))' : 'var(--horosa-panel-soft, rgba(255,255,255,0.035))', border: item.isYue ? '1px solid var(--horosa-accent, #d4a017)' : '1px solid var(--horosa-border, rgba(255,255,255,0.08))' }}>
																{item.isYue ? (<span style={{ position: 'absolute', top: -7, right: -5, fontSize: 10, lineHeight: '15px', padding: '0 5px', borderRadius: 7, background: 'var(--horosa-accent, #d4a017)', color: '#1a1206', fontWeight: 700, whiteSpace: 'nowrap' }}>月将</span>) : null}
																<span style={{ fontSize: 12, fontWeight: 700, color: pColor, letterSpacing: 1 }}>{item.name}{item.retro ? <span style={{ color: '#e2574c', marginInlineStart: 2, fontWeight: 800 }}>℞</span> : null}</span>
																<span style={{ fontSize: 21, fontWeight: 800, color: wxColor, lineHeight: '26px' }}>{item.branch || '—'}</span>
																<span style={{ fontSize: 11, color: 'var(--horosa-muted, #8c8c8c)' }}>{item.wx || ''}{item.deg != null ? ` ${item.deg.toFixed(0)}°` : ''}</span>
															</div>
														);
													})}
												</div>
												<div style={{ color: 'var(--horosa-muted, #8c8c8c)', fontSize: 12, marginTop: 10, lineHeight: '18px' }}>七政所临之宫，色按五行。<span style={{ color: '#e2574c', fontWeight: 700 }}>℞</span> 为逆行；<span style={{ color: 'var(--horosa-accent, #d4a017)', fontWeight: 700 }}>月将</span>即太阳过宫之神。</div>
											</Card>
										) : (<Card size='small'><div style={{ color: 'var(--horosa-muted, #8c8c8c)' }}>当前盘暂无七政数据（需含日月五星之星历）。</div></Card>); })()}
									</div>
								</TabPane>
							</Tabs>
						</Card>
						)}</FreezeSubTab>
					</TabPane>
					<TabPane tab="遁甲" key="bagong">
						<FreezeSubTab active={rightPanelTab === 'bagong'}>{()=>(
						<Card bordered={false} bodyStyle={{ padding: '10px 12px' }}>
							<Tabs
								activeKey={this.state.bagongSubTab}
								onChange={(key)=>this.setState({ bagongSubTab: key })}
								destroyInactiveTabPane
								animated={false}
								className="horosa-sanshi-liureng-tabs"
							>
								<TabPane tab="八宫" key="bagong">
							<div style={{ paddingRight: 4 }}>
								<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
									{BAGONG_PALACE_ORDER.map((num)=>(
										<Button
											key={`ssu_bagong_btn_${num}`}
											size="small"
											shape="round"
											type={bagongPalace === num ? 'primary' : 'default'}
											style={bagongPalace === num ? { minWidth: 42 } : { minWidth: 42, background: 'var(--horosa-panel-soft, #fafafa)' }}
											onClick={()=>this.setState({ bagongPalace: num })}
										>
											{BAGONG_PALACE_NAME[num]}
										</Button>
									))}
								</div>
								{pan ? (
									<>
										<Card size='small' style={{ marginBottom: 8 }}>
											<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
												<span style={{ fontWeight: 600 }}>奇门吉格</span>
												<Tag color='green'>{bagongData.jiPatterns.length}项</Tag>
											</div>
											<div style={{ color: 'var(--horosa-text-soft, #595959)', lineHeight: '22px', whiteSpace: 'pre-wrap' }}>
												{bagongData.jiPatternDetails && bagongData.jiPatternDetails.length
													? bagongData.jiPatternDetails.map((text)=>`• ${text}`).join('\n')
													: '未命中'}
											</div>
										</Card>
										<Card size='small' style={{ marginBottom: 8 }}>
											<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
												<span style={{ fontWeight: 600 }}>奇门凶格</span>
												<Tag color='volcano'>{bagongData.xiongPatterns.length}项</Tag>
											</div>
											<div style={{ color: 'var(--horosa-text-soft, #595959)', lineHeight: '22px', whiteSpace: 'pre-wrap' }}>
												{bagongData.xiongPatternDetails && bagongData.xiongPatternDetails.length
													? bagongData.xiongPatternDetails.map((text)=>`• ${text}`).join('\n')
													: '未命中'}
											</div>
										</Card>
										<Card size='small' style={{ marginBottom: 8 }}>
											<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
												<span style={{ fontWeight: 600 }}>十干克应</span>
												<Tag color='blue'>天{bagongData.tianGan || '—'} / 地{bagongData.diGan || '—'}</Tag>
											</div>
											<div style={{ color: 'var(--horosa-text-soft, #595959)', lineHeight: '22px', whiteSpace: 'pre-wrap' }}>
												天{bagongData.tianGan || '—'}加地{bagongData.diGan || '—'}：{bagongData.tenGanText}
											</div>
										</Card>
										<Card size='small' style={{ marginBottom: 8 }}>
											<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
												<span style={{ fontWeight: 600 }}>八门克应和奇仪主应</span>
												<Tag color='purple'>人{bagongData.renDoor || '—'}</Tag>
											</div>
											<div style={{ color: 'var(--horosa-text-soft, #595959)', lineHeight: '22px', whiteSpace: 'pre-wrap' }}>
												<div>人{bagongData.renDoor || '—'}加地{bagongData.baseDoor || '—'}：{bagongData.doorBaseText}</div>
												<div style={{ marginTop: 4 }}>人{bagongData.renDoor || '—'}加天{bagongData.tianGan || '—'}：{bagongData.doorTianText}</div>
											</div>
										</Card>
										<Card size='small' style={{ marginBottom: 8 }}>
											<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
												<span style={{ fontWeight: 600 }}>八神加八门</span>
												<Tag color='geekblue'>{bagongData.godFull || '—'}</Tag>
											</div>
											<div style={{ color: 'var(--horosa-text-soft, #595959)', lineHeight: '22px', whiteSpace: 'pre-wrap' }}>
												{bagongData.godFull || '—'}加{bagongData.renDoor || '—'}门：{bagongData.godDoorText}
											</div>
										</Card>
										<Card size='small'>
											<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
												<span style={{ fontWeight: 600 }}>奇门演卦</span>
												<Tag color='cyan'>{bagongData.menFangYiGua || '无'}</Tag>
											</div>
											<div style={{ color: 'var(--horosa-text-soft, #595959)', lineHeight: '22px', whiteSpace: 'pre-wrap' }}>
												{bagongData.menFangYiGuaText || '无'}
											</div>
										</Card>
									</>
								) : (
									<Card size='small'><div style={{ color: 'var(--horosa-muted, #8c8c8c)' }}>请先起盘后查看八宫信息。</div></Card>
								)}
							</div>
								</TabPane>
								<TabPane tab="用神" key="yongshen">
									<div style={{ paddingRight: 4 }}>
										{this.renderSanshiYongShenStatic(pan)}
									</div>
								</TabPane>
								<TabPane tab="化解" key="jiehua">
									<div style={{ paddingRight: 4 }}>
										{this.renderSanshiJieHuaStatic(pan)}
									</div>
								</TabPane>
							</Tabs>
						</Card>
						)}</FreezeSubTab>
					</TabPane>
					<TabPane tab="紫微四化" key="ziweisihua">
						{/* [YA v42] onSnapshotState:上报盘+大运/流年选中态 → 快照产 [紫微四化] 段 */}
						{/* eager:本面板 componentDidMount 会发紫微盘请求并经 onSnapshotState 回报快照段,
						    绝不由本 wrapper 再加一层「延迟首渲」(挂载时机仍完全由外层 destroyInactiveTabPane
						    决定,与改动前一字不差);只取「冻结非激活期重渲」这一项收益。 */}
						<FreezeSubTab active={rightPanelTab === 'ziweisihua'} eager>
							<SanShiZiWeiSihua fields={this.getActiveFields()} onSnapshotState={this.handleZiweiSihuaSnapshotState} />
						</FreezeSubTab>
					</TabPane>
				</Tabs>
			</div>
		);
	}

	render(){
		const height = this.state.leftBoardHeight > 0
			? this.state.leftBoardHeight
			: Math.max(760, (this.state.viewportHeight || 900) - 108);
		return (
			<div className={`${styles.root} horosa-sanshi-page horosa-astro-redesign horosa-sanshi-redesign`} style={{ height: '100%', minHeight: 0 }}>
				<div className="horosa-astro-layout horosa-astro-redesign-layout horosa-sanshi-redesign-layout">
					{/* [连续调整不打断] 原 <Spin spinning={loading}> 满屏压暗遮罩已撤(用户实告「加载把整屏挡住」):
					    重算期旧盘 keep-stale 保留可见,仅中栏右上角一枚非阻塞小转圈(复用全站 workspace-updating
					    观感,sanshi-updating 变体只改定位为中栏内 absolute)。 */}
					<div className="horosa-astro-redesign-grid horosa-sanshi-redesign-grid">
						<div className="horosa-astro-context-panel horosa-astro-input-panel horosa-sanshi-input-panel">
							{this.renderInputPanel()}
						</div>
						<div className="horosa-chart-stage horosa-chart-stage-redesign horosa-sanshi-chart-panel xq-chart-renderer xq-chart-renderer-sanshi">
							{this.state.loading ? (
								<div className="horosa-workspace-updating horosa-sanshi-updating">重算中…</div>
							) : null}
							<div ref={this.captureLeftBoardHost} className="horosa-sanshi-board-host">
								{this.renderLeftBoard(height)}
							</div>
						</div>
						<div className="horosa-inspector-panel horosa-astro-content-panel horosa-sanshi-info-panel">
							{this.renderRight()}
						</div>
					</div>
					{this.renderQuickDock()}
				</div>
			</div>
		);
	}
}

export default SanShiUnitedMain;
