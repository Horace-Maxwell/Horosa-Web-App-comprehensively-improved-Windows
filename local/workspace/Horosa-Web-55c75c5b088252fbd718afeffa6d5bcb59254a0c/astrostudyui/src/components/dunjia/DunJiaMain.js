import { Component } from 'react';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { stepPrefetchEnabled, kentangCacheEnabled } from '../../utils/perfFlags';
import { registerStepPrefetcher } from '../../utils/stepPrefetch';
import { armStepPrefetch } from '../../utils/stepPrefetchArm';
import { markPanelReady } from '../../utils/perfMark';
import { FreezeSubTab } from '../comp/FreezeInactive';
import { safeLocalStorageSet } from '../../utils/safeStorage';
import { Spin, Tag, message, Popover, Modal } from 'antd';
import { XQButton as Button, XQCard as Card, XQSelect as Select, XQTabs as Tabs, XQSideSection } from '../xq-ui';
import XQIcon from '../xq-icons';
import { saveModuleAISnapshot, loadModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { geoNameFieldPatch } from '../../utils/geoName';
import {
	getNongliLocalCache,
	setNongliLocalCache,
} from '../../utils/localCalcCache';
import {
} from '../../utils/localNongliAdapter';
import {
	fetchPreciseNongli,
	fetchPreciseJieqiSeed,
} from '../../utils/preciseCalcBridge';
import sealedImage from '../../assets/sealed.png';
import GeoCoordModal from '../amap/GeoCoordModal';
import PlusMinusTime from '../astro/PlusMinusTime';
import DateTime from '../comp/DateTime';
import QuickDockBar from '../common/QuickDockBar';
import SpaceTimePanel from '../comp/SpaceTimePanel';
import { sideSectionIcon } from '../../constants/sideSectionIcons'; // [观象P1]
import { convertLatToStr, convertLonToStr } from '../astro/AstroHelper';
import { resolveGeoZone } from '../../utils/timezone';
import { getStore } from '../../utils/storageutil';
import { listLocalCharts } from '../../utils/localcharts';
import {
	SEX_OPTIONS,
	PAIPAN_OPTIONS,
	YUEJIA_QIJU_OPTIONS,
	ZHISHI_OPTIONS,
	QIJU_METHOD_OPTIONS,
	ZHIRUN_LEAP_OPTIONS,
	SCHOOL_OPTIONS,
	KONG_MODE_OPTIONS,
	MA_MODE_OPTIONS,
	TIME_ALG_OPTIONS,
	YIXING_OPTIONS,
	DAY_SWITCH_OPTIONS,
	CHART_CATEGORY_OPTIONS,
	birthToYearGan,
	calcDunJia,
	fetchQimenPan,
	isKinqimenMode,
	normalizeKinqimenData,
	buildDunJiaSnapshotText,
	buildQimenWangShuai,
	computeShuziYongShenGong,
} from './DunJiaCalc';
import {
	BAGONG_PALACE_ORDER,
	BAGONG_PALACE_NAME,
	buildQimenBaGongPanelData,
	buildQimenFuShiYiGua,
	buildQimenOverviewSummary,
} from './DunJiaBaGongRules';
import {
	buildQimenXiangTipObj,
	formatQimenDocLineToHtml,
} from './QimenXiangDoc';
import {
	computeDangers,
	buildJieHua,
	computeProtect,
	computeYongShen,
	computeWealth,
	computeCareer,
	computeRomance,
	computeGuGua,
} from './DunJiaFaCalc';
import {
	SAN_FA_TEXT,
	BU_ZHEN_TIPS,
	DANGER_BRIEF,
	GAN_XIANG,
	ZHI_ZODIAC,
	SHENSHA_DOC,
	LUOSHU_NUM,
} from './DunJiaFaDoc';
import { BaZiColor, ZhiColor } from '../../msg/bazimsg';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../utils/dayBoundary';
import DunJiaBoard from './DunJiaBoard';

const { Option } = Select;
const TabPane = Tabs.TabPane;
const FENGJU_OPTIONS = [
	{ value: 0, label: '未封局' },
	{ value: 1, label: '已封局' },
];
const DEFAULT_OPTIONS = {
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
};

// 起局下拉(非时家):年/月/日家有各自「本家默认」定局(三元/年符头/节气三元),节气四法(置闰/拆补/茅山/无闰)仅时家相关。
// 故非时家只给两项「本家默认 / 阴盘(报数)」——阴盘报数与排盘正交、可叠加任意家;避免「选了阴盘后节气四法被禁→无法切回本家默认」的死锁。
const QIJU_METHOD_NONSHI_OPTIONS = [
	{ value: 'zhirun', label: '本家默认' },   // 非时家忽略具体节气法→等同本家原生定局(zhirun 仅占位)
	{ value: 'shuzi', label: '阴盘' },
];

const DUNJIA_BOARD_BASE_WIDTH = 662;
const DUNJIA_BOARD_BASE_HEIGHT = 870;
const DUNJIA_SCALE_MIN = 0.58;
const DUNJIA_SCALE_MAX = 1.18;
const QIMEN_PATTERN_INTERPRETATION_STORAGE_KEY = 'qimenShowPatternInterpretation';
let lastDunJiaLiveState = null;
function normalizeKenQimenOptions(options){
	const next = {
		...DEFAULT_OPTIONS,
		...(options || {}),
	};
	// 旧数据迁移:阴盘曾为「盘式」(school='阴盘'),现为「起局法」(qijuMethod='shuzi',报数定局)。
	// 旧存命盘/事盘载入时:盘式回落转盘、起局切阴盘(保留 shuziReportNumber),否则盘式下拉显非法值、且报数定局失效。
	if(next.school === '阴盘'){
		next.school = '转盘';
		next.qijuMethod = 'shuzi';
	}
	return next;
}
const DUNJIA_LEGEND_ITEMS = [
	{ key: 'jixing', label: '击刑', color: '#cf1322', bg: 'rgba(207, 19, 34, 0.10)' },
	{ key: 'rumu', label: '入墓', color: '#8b5e3c', bg: 'rgba(139, 94, 60, 0.12)' },
	{ key: 'both', label: '击刑+入墓', color: '#722ed1', bg: 'rgba(114, 46, 209, 0.10)' },
	{ key: 'menpo', label: '门迫', color: '#fa8c16', bg: 'rgba(250, 140, 22, 0.12)' },
	{ key: 'kongwang', label: '空亡', color: '#2f54eb', bg: 'rgba(47, 84, 235, 0.10)' },
	{ key: 'yima', label: '🐎 驿马', color: 'var(--horosa-text, #262626)', bg: 'rgba(140, 140, 140, 0.10)' },
];

// 用神取用速查(§16):一事一测,先定用神,再看其落宫旺衰/格局/生克。静态参考字典。
const QIMEN_YONGSHEN_BASIC = [
	['日干', '求测人自己(主方/我方)'],
	['时干', '所测之事 / 对方 / 客方'],
	['值符(星)', '领导、贵人、大环境、核心势力'],
	['值使(门)', '事情发展通道、办事"门路"'],
	['年命', '求测者本人(年支/年干所落宫=年命宫)'],
	['旬空·马星', '事之虚实、动静缓急'],
];
const QIMEN_YONGSHEN_LOOKUP = [
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
const QIMEN_YONGSHEN_SHENGKE = [
	['比和', '用神与所临星门宫同五行——平稳、顺'],
	['生入(生我)', '他来生用神——得助、有利、被帮'],
	['生出(我生)', '用神生他——耗泄、付出、被求'],
	['克入(克我)', '他来克用神——受制、阻碍、被压'],
	['克出(我克)', '用神克他——我主动、得财/得制(克者为财)'],
];


function clamp(val, min, max){
	return Math.max(min, Math.min(max, val));
}

function getViewportHeight(){
	if(typeof window !== 'undefined' && Number.isFinite(window.innerHeight) && window.innerHeight > 0){
		return window.innerHeight;
	}
	if(typeof document !== 'undefined' && document.documentElement){
		return document.documentElement.clientHeight || 900;
	}
	return 900;
}

function safe(v, d = ''){
	return v === undefined || v === null ? d : v;
}

const GAN_COLOR_MAP = {
	甲: BaZiColor.PositiveWood,
	乙: BaZiColor.NegativeWood,
	丙: BaZiColor.PositiveFire,
	丁: BaZiColor.NegativeFire,
	戊: BaZiColor.PositiveEarth,
	己: BaZiColor.NegativeEarth,
	庚: BaZiColor.PositiveMetal,
	辛: BaZiColor.NegativeMetal,
	壬: BaZiColor.PositiveWater,
	癸: BaZiColor.NegativeWater,
};

function getBaZiStemColor(stem){
	return GAN_COLOR_MAP[safe(stem, '')] || 'var(--horosa-text, #333333)';
}

function getBaZiBranchColor(branch){
	return ZhiColor[safe(branch, '')] || 'var(--horosa-text, #333333)';
}

function normalizeTimeAlg(value){
	return value === 1 ? 1 : 0;
}

function getTimeAlgLabel(value){
	return normalizeTimeAlg(value) === 1 ? '直接时间' : '真太阳时';
}

function parseZoneOffsetHour(zone){
	if(zone === undefined || zone === null || zone === ''){
		return null;
	}
	const raw = `${zone}`.trim();
	if(!raw){
		return null;
	}
	const numeric = Number(raw);
	if(Number.isFinite(numeric)){
		return numeric;
	}
	const m = raw.match(/^([+-])(\d{1,2})(?::?(\d{2}))?$/);
	if(!m){
		return null;
	}
	const sign = m[1] === '-' ? -1 : 1;
	const hh = parseInt(m[2], 10);
	const mm = parseInt(m[3] || '0', 10);
	if(Number.isNaN(hh) || Number.isNaN(mm)){
		return null;
	}
	return sign * (hh + mm / 60);
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

function loadPatternInterpretationPreference(){
	try{
		if(typeof window === 'undefined' || !window.localStorage){
			return true;
		}
		const val = window.localStorage.getItem(QIMEN_PATTERN_INTERPRETATION_STORAGE_KEY);
		if(val === null || val === undefined || val === ''){
			return true;
		}
		return val !== '0' && val !== 'false';
	}catch(e){
		return true;
	}
}

function savePatternInterpretationPreference(value){
	try{
		if(typeof window !== 'undefined' && window.localStorage){
			safeLocalStorageSet(QIMEN_PATTERN_INTERPRETATION_STORAGE_KEY, value ? '1' : '0');
		}
	}catch(e){
	}
}

// 法奇门「用神」Tab 的显示层偏好（求测事项 + 当面/网测），存 localStorage、不进 fields、不重排盘。
const QIMEN_FA_ASK_TOPIC_KEY = 'qimenFaAskTopic';
const FA_ASK_TOPICS = [
	{ key: 'shexin', label: '识破人心' },
	{ key: 'wealth', label: '财富' },
	{ key: 'career', label: '事业' },
	{ key: 'romance', label: '婚恋' },
];
function loadFaAskTopic(){
	try{
		if(typeof window !== 'undefined' && window.localStorage){
			const v = window.localStorage.getItem(QIMEN_FA_ASK_TOPIC_KEY);
			if(v && FA_ASK_TOPICS.some((t)=>t.key === v)){
				return v;
			}
		}
	}catch(e){
	}
	return 'shexin';
}
function saveFaAskTopic(value){
	try{
		if(typeof window !== 'undefined' && window.localStorage){
			safeLocalStorageSet(QIMEN_FA_ASK_TOPIC_KEY, value);
		}
	}catch(e){
	}
}

function saveQimenLiveSnapshot(pan){
	if(!pan || typeof window === 'undefined'){
		return '';
	}
	let snapshotText = '';
	try{
		snapshotText = buildDunJiaSnapshotText(pan);
	}catch(e){
		snapshotText = '';
	}
	if(snapshotText){
		window.__horosa_qimen_snapshot_text = snapshotText;
		window.__horosa_qimen_snapshot_at = Date.now();
	}
	return snapshotText;
}

function parseDisplayDateHm(rawText){
	const text = `${safe(rawText, '')}`.trim();
	if(!text){
		return null;
	}
	const normalized = text.replace('T', ' ').replace('Z', ' ').trim();
	const dateMatch = normalized.match(/([-+]?\d{1,6})[/-](\d{1,2})[/-](\d{1,2})/);
	const timeMatch = normalized.match(/(\d{1,2}):(\d{2})/);
	if(!dateMatch && !timeMatch){
		return null;
	}
	const yyyy = dateMatch ? `${dateMatch[1]}` : '';
	const mm = dateMatch ? `${dateMatch[2]}`.padStart(2, '0') : '';
	const dd = dateMatch ? `${dateMatch[3]}`.padStart(2, '0') : '';
	const hh = timeMatch ? `${timeMatch[1]}`.padStart(2, '0') : '';
	return {
		date: yyyy ? `${yyyy}年${mm}月${dd}日` : '',
		hm: timeMatch ? `${hh}:${timeMatch[2]}` : '',
	};
}

function getBoardTimeInfo(pan){
	const solar = parseDisplayDateHm(pan && pan.realSunTime);
	const direct = parseDisplayDateHm(`${safe(pan && pan.dateStr, '')} ${safe(pan && pan.timeStr, '')}`);
	const clockDate = safe(direct && direct.date, '');
	const clockHm = safe(direct && direct.hm, '') || (safe(pan && pan.timeStr, '').length >= 5 ? safe(pan && pan.timeStr, '').substr(0, 5) : '--:--');
	if(solar && (solar.date || solar.hm)){
		return {
			dateText: solar.date || clockDate || '日期--',
			clockHm,
			solarHm: solar.hm || '--:--',
		};
	}
	if(clockDate || clockHm){
		return {
			dateText: clockDate || '日期--',
			clockHm,
			solarHm: clockHm,
		};
	}
	return {
		dateText: '时间--',
		clockHm: '--:--',
		solarHm: '--:--',
	};
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
		safe(fields.gender && fields.gender.value),
	].join('|');
}

function getAfter23NewDayValue(options){
	return options && options.after23NewDay === 1 ? 1 : 0;
}

function getTimeAlgValue(options){
	return normalizeTimeAlg(options && options.timeAlg);
}

function getNongliRequestKey(fields, options){
	return `${getFieldKey(fields)}|after23NewDay=${getAfter23NewDayValue(options)}|timeAlg=${getTimeAlgValue(options)}`;
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
		safe(options.qijuMethod),
		safe(options.school),
		safe(options.shuziReportNumber),
		safe(options.kongMode),
		safe(options.yimaMode),
		safe(options.shiftPalace),
		getAfter23NewDayValue(options),
		safe(options.lateZiHourUseNextDay),
		getTimeAlgValue(options),
		options.fengJu ? 1 : 0,
		safe(options.zhirunLeapDays),
	].join('|');
}

function needJieqiYearSeed(options){
	const opt = options || {};
	// 置闰/无闰=超神接气;茅山=按交节时刻足60时辰(须任意节气的精确交节时刻种子)。三者都要节气种子。
	const usesShenJie = opt.qijuMethod === 'zhirun' || opt.qijuMethod === 'wurun' || opt.qijuMethod === 'maoshan';
	// 日家(本地全盘):局=节气三元六十日一局,须节气种子(冬/夏至日期+日柱)定「至甲子」60日块;
	// 缺种子会退 findYuan 漏置闰→局错(如1964-11-10日家应阴三却给阴六)。任何盘式/起局下日家都要种子。
	if(opt.paiPanType === 2){
		return true;
	}
	// 飞盘/混合走本地短路计算(非后端),置闰/无闰/茅山需 jieqi 种子(超神/交节时刻);否则退曆法节气漏超神/茅山退拆补。
	// 转盘等后端模式由后端处理节气,本地种子无关。
	if(opt.school === '飞盘' || opt.school === '混合'){
		return usesShenJie;
	}
	if(isKinqimenMode(opt.paiPanType)){
		return false;
	}
	return opt.paiPanType === 3 && usesShenJie;
}

function sameRelatedPeople(a, b){
	const aa = Array.isArray(a) ? a : [];
	const bb = Array.isArray(b) ? b : [];
	if(aa.length !== bb.length){
		return false;
	}
	for(let i = 0; i < aa.length; i++){
		const x = aa[i] || {};
		const y = bb[i] || {};
		if(`${x.cid}` !== `${y.cid}` || `${x.yearGan}` !== `${y.yearGan}`){
			return false;
		}
	}
	return true;
}

function rememberDunJiaLiveState(payload){
	if(!payload || !payload.pan){
		return;
	}
	lastDunJiaLiveState = {
		fieldKey: payload.fieldKey || '',
		lastNongliKey: payload.lastNongliKey || '',
		lastPanSignature: payload.lastPanSignature || '',
		nongli: payload.nongli || null,
		displaySolarTime: payload.displaySolarTime || '',
		pan: payload.pan,
		options: payload.options ? { ...payload.options } : null,
		faRelatedPeople: Array.isArray(payload.faRelatedPeople) ? payload.faRelatedPeople : [],
	};
}

function getRestorableDunJiaLiveState(fields){
	if(!lastDunJiaLiveState || !lastDunJiaLiveState.pan){
		return null;
	}
	const fieldKey = getFieldKey(fields);
	if(lastDunJiaLiveState.fieldKey && fieldKey && lastDunJiaLiveState.fieldKey !== fieldKey){
		return null;
	}
	return lastDunJiaLiveState;
}

function extractIsDiurnalFromChartProp(val){
	if(!val){
		return null;
	}
	const chart = val.chart ? val.chart : val;
	if(chart && chart.isDiurnal !== undefined && chart.isDiurnal !== null){
		return !!chart.isDiurnal;
	}
	return null;
}

// —— PERF-R9 Ship 7:遁甲 stage-1 构参的模块级纯函数(组件方法 genParams/genJieqiParams 纯委托
//    于此)。抽出来的唯一目的:预热/预取要在【组件之外】构出与首点逐字节同键的 body ——
//    差一个字节缓存就不是同一条,预热白打。语义与抽出前逐字节一致。
function buildDunJiaNongliParamsPure(flds, options){
	if(!flds){
		return null;
	}
	const opts = options || DEFAULT_OPTIONS;
	const genderValue = (flds.gender && flds.gender.value !== undefined && flds.gender.value !== null)
		? flds.gender.value
		: opts.sex;
	const zoneValue = flds.zone && flds.zone.value !== undefined && flds.zone.value !== null
		? flds.zone.value
		: 8;
	const adValue = flds.ad && flds.ad.value !== undefined && flds.ad.value !== null
		? flds.ad.value
		: 1;
	const calcGeo = resolveCalcGeo(flds, opts);
	return {
		date: flds.date.value.format('YYYY-MM-DD'),
		time: flds.time.value.format('HH:mm:ss'),
		zone: zoneValue,
		lon: calcGeo.lon,
		lat: calcGeo.lat,
		gpsLat: calcGeo.gpsLat,
		gpsLon: calcGeo.gpsLon,
		ad: adValue,
		gender: genderValue,
		timeAlg: normalizeTimeAlg(opts.timeAlg),
		after23NewDay: getAfter23NewDayValue(opts),
		// v2.2.1: 透传时柱开关给后端 /nongli/time;后端 NongliController 已读入并传给 OnlyFourColumns。
		lateZiHourUseNextDay: opts && opts.lateZiHourUseNextDay !== undefined ? opts.lateZiHourUseNextDay : 1,
	};
}

function buildDunJiaJieqiParamsPure(flds, year, options){
	if(!flds){
		return null;
	}
	const opts = options || DEFAULT_OPTIONS;
	const calcGeo = resolveCalcGeo(flds, opts);
	return {
		year: `${year}`,
		ad: flds.ad ? flds.ad.value : 1,
		zone: flds.zone.value,
		lon: calcGeo.lon,
		lat: calcGeo.lat,
		gpsLat: calcGeo.gpsLat,
		gpsLon: calcGeo.gpsLon,
		timeAlg: normalizeTimeAlg(opts.timeAlg),
		hsys: 0,
		zodiacal: 0,
		doubingSu28: false,
	};
}

// PERF-R9 Ship 7(数据层空闲预热的权威入口):遁甲 stage-1 = /nongli/time(真太阳时+四柱)
// + /jieqi/year(节气种子,仅该流派需要时)。两者是【确定性历法计算】,同参恒同果、无随机、
// 不依赖「现在」。options 取 normalizeKenQimenOptions() —— 与组件构造时的 initialOptions
// 同一口径(未从既有盘恢复时),故 key/body 与用户首点逐字节一致。
// 🔴 绝不预热 /qimen/pan 本身:它吃 stage-1 结果 + 组件态(流派/排盘法),提前构不出同键。
// silent(两个 fetch 内置)、丢结果、绝不 dispatch/setState;失败静默。
export async function warmDunJiaStage1(fields){
	try{
		if(!fields || !fields.date || !fields.date.value || !fields.date.value.format){
			return null;
		}
		const options = normalizeKenQimenOptions();
		const params = buildDunJiaNongliParamsPure(fields, options);
		if(!params){
			return null;
		}
		const jobs = [Promise.resolve(fetchPreciseNongli(params)).catch(()=>null)];
		const fixedOptions = {
			...options,
			jieQiType: 1,
			yearGanZhiType: 2,
			monthGanZhiType: 1,
			dayGanZhiType: 1,
		};
		if(needJieqiYearSeed(fixedOptions)){
			const year = parseInt(fields.date.value.format('YYYY'), 10);
			if(year && !Number.isNaN(year)){
				const seedParams = buildDunJiaJieqiParamsPure(fields, year, options);
				if(seedParams){
					jobs.push(Promise.resolve(fetchPreciseJieqiSeed(seedParams)).catch(()=>null));
				}
			}
		}
		await Promise.all(jobs);
		return true;
	}catch(e){
		return null;   // 预热失败静默:首点回到冷即付的现状
	}
}

class DunJiaMain extends Component {
	constructor(props){
		super(props);
		const restoredLiveState = getRestorableDunJiaLiveState(props.fields);
		const initialOptions = restoredLiveState && restoredLiveState.options
			? normalizeKenQimenOptions(restoredLiveState.options)
			: normalizeKenQimenOptions();

		this.state = {
			loading: false,
			nongli: restoredLiveState ? restoredLiveState.nongli : null,
			displaySolarTime: restoredLiveState ? restoredLiveState.displaySolarTime : '',
			pan: restoredLiveState ? restoredLiveState.pan : null,
			localFields: null,
			hasPlotted: !!(restoredLiveState && restoredLiveState.pan),
			rightPanelTab: 'overview',
			bagongPalace: BAGONG_PALACE_ORDER[0],
			showPatternInterpretation: loadPatternInterpretationPreference(),
			leftBoardWidth: 0,
			leftBoardHeight: 0,
			viewportHeight: getViewportHeight(),
			options: initialOptions,
			faRelatedPeople: restoredLiveState && Array.isArray(restoredLiveState.faRelatedPeople) ? restoredLiveState.faRelatedPeople : [],
			chartCategory: (restoredLiveState && restoredLiveState.pan && restoredLiveState.pan.options && restoredLiveState.pan.options.chartCategory) || 'shi',
			shuziInput: '',
		};

		this.unmounted = false;
		this.jieqiSeedPromises = {};
		this.jieqiYearSeeds = {};
		this.lastRestoredCaseId = null;
		this.lastRestoredChartId = null;
		this._yearGanCache = {};
		this.timeHook = {};
		this.lastNongliKey = restoredLiveState ? restoredLiveState.lastNongliKey : '';
		this.lastPanSignature = restoredLiveState ? restoredLiveState.lastPanSignature : '';
		this.pendingNongli = null;
		this.requestSeq = 0;
		this.panCache = new Map();
		this.resizeObserver = null;
		this.prefetchSeedTimer = null;
		this.onOptionChange = this.onOptionChange.bind(this);
		this.onFieldsChange = this.onFieldsChange.bind(this);
		this.onTimeChanged = this.onTimeChanged.bind(this);
		this.onGenderChange = this.onGenderChange.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
		this.genJieqiParams = this.genJieqiParams.bind(this);
		this.ensureJieqiSeed = this.ensureJieqiSeed.bind(this);
		this.prefetchJieqiSeedForFields = this.prefetchJieqiSeedForFields.bind(this);
		this.prefetchNongliForFields = this.prefetchNongliForFields.bind(this);
		this.resolveDisplaySolarTime = this.resolveDisplaySolarTime.bind(this);
		this.getContext = this.getContext.bind(this);
		this.requestNongli = this.requestNongli.bind(this);
		this.genParams = this.genParams.bind(this);
		this.recalc = this.recalc.bind(this);
		this.clickSaveCase = this.clickSaveCase.bind(this);
		this.clickPlot = this.clickPlot.bind(this);
		this.getTimeFieldsFromSelector = this.getTimeFieldsFromSelector.bind(this);
		this.restoreOptionsFromCurrentCase = this.restoreOptionsFromCurrentCase.bind(this);
		this.restoreFromCurrentChart = this.restoreFromCurrentChart.bind(this);
		this.parseCasePayload = this.parseCasePayload.bind(this);
		this.applyFaRelatedToPan = this.applyFaRelatedToPan.bind(this);
		this.getRelatedPeopleOptions = this.getRelatedPeopleOptions.bind(this);
		this.onRelatedPeopleChange = this.onRelatedPeopleChange.bind(this);
		this.onChartCategoryChange = this.onChartCategoryChange.bind(this);
		this.captureLeftBoardHost = this.captureLeftBoardHost.bind(this);
		this.handleWindowResize = this.handleWindowResize.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);

		if(this.props.hook){
			this.props.hook.fun = (fields)=>{
				if(this.unmounted){
					return;
				}
				this.restoreOptionsFromCurrentCase();
				this.restoreFromCurrentChart();
				if(fields){
					this.setState({
						localFields: fields,
					});
					this.prefetchJieqiSeedForFields(fields);
					this.prefetchNongliForFields(fields);
				}
			};
			// PERF-R9 Ship 7:遁甲是【两段式】—— stage-1(/nongli/time 真太阳时+干支、
			// /jieqi/year 节气种子)必须先回来,盘才能排。这两个端点与主 /chart 完全无关,
			// 在 /chart 返回之前并行发出即可把 stage-1 从关键路径上摘掉。
			// 闸:horosa.perf.prewarmRequests(关=此函数不被调用,逐字节旧序)。
			this.props.hook.prewarmRequests = (flds)=>{
				if(this.unmounted){
					return;
				}
				try{
					this.prefetchJieqiSeedForFields(flds || this.props.fields);
					this.prefetchNongliForFields(flds || this.props.fields);
				}catch(e){ /* 预热失败无害 */ }
			};
			// horosa_prefetch_registry_v1(PERF-R9 Ship 7):只预取 stage-1(确定性历法计算)。
			// 🔴 绝不预取 /qimen/pan 本身:它必须吃 stage-1 的结果,串行且随组件态(流派/排盘法)
			//    变化 —— 强行预取要么构不出同键、要么把中间态钉进缓存。stage-1 暖了,
			//    用户点下一步时 pan 的输入即时可得,这已是这条链上能提前付的全部。
			if(stepPrefetchEnabled()){
				registerStepPrefetcher('dunjia', (steppedFields)=>{
					if(this.unmounted || !steppedFields){
						return [];
					}
					const tasks = [];
					let params = null;
					try{
						params = this.genParams(steppedFields);
					}catch(e){
						params = null;
					}
					if(params){
						tasks.push({
							name: 'dunjia:nongli',
							path: '/nongli/time',
							run: ()=> fetchPreciseNongli(params),
						});
					}
					// 节气种子:与 requestNongli 同一 fixedOptions 口径(四个 GanZhiType 钉死),
					// 否则 key 不同 = 白预取。仅在该流派真需要种子时才发。
					try{
						const fixedOptions = {
							...this.state.options,
							jieQiType: 1,
							yearGanZhiType: 2,
							monthGanZhiType: 1,
							dayGanZhiType: 1,
						};
						if(needJieqiYearSeed(fixedOptions) && steppedFields.date && steppedFields.date.value){
							const year = parseInt(steppedFields.date.value.format('YYYY'), 10);
							const seedParams = (year && !Number.isNaN(year)) ? this.genJieqiParams(steppedFields, year) : null;
							if(seedParams){
								tasks.push({
									name: 'dunjia:jieqiseed',
									path: '/jieqi/year',
									run: ()=> fetchPreciseJieqiSeed(seedParams),
								});
							}
						}
					}catch(e){ /* 种子构参失败静默跳过 */ }
					return tasks;
				});
			}
		}
	}

	getCachedPan(fields, nongli, options, displaySolarTime){
		const ctx = this.getContext(fields, displaySolarTime);
		const key = [
			getFieldKey(fields),
			getNongliKey(nongli),
			getQimenOptionsKey(options),
			safe(ctx && ctx.isDiurnal, ''),
			safe(ctx && ctx.displaySolarTime, ''),
			// 种子签名:日家(节气三元60日块)/飞盘超神等依赖节气种子;种子异步到达后 key 变→不命中旧(退化)缓存,强制带种子重算。
			'seed:' + Object.keys((ctx && ctx.jieqiYearSeeds) || {}).filter((y)=>(ctx.jieqiYearSeeds[y])).sort().join(','),
		].join('|');
		if(this.panCache.has(key)){
			return this.panCache.get(key);
		}
		const pan = calcDunJia(fields, nongli, options, ctx);
		this.panCache.set(key, pan);
		if(this.panCache.size > 64){
			const firstKey = this.panCache.keys().next().value;
			if(firstKey){
				this.panCache.delete(firstKey);
			}
		}
		return pan;
	}

	async getResolvedPan(fields, nongli, options, displaySolarTime){
		const ctx = this.getContext(fields, displaySolarTime);
		const fallbackPan = this.getCachedPan(fields, nongli, options, displaySolarTime);
		// 飞盘(飞宫九神)/混合(飞转结合)/数字起局(报数定局)均走本地 calcDunJia——后端不支持(飞盘/混合 须重启:8899 才认 school;
		// 数字报数定局后端无此入参,走后端会被节气定局覆盖)。转盘等仍走后端(时/刻/综合)。
		if(!fallbackPan || !isKinqimenMode(options && options.paiPanType) || (options && (options.school === '飞盘' || options.school === '混合' || options.qijuMethod === 'shuzi'))){
			return fallbackPan;
		}
		const backendPan = await fetchQimenPan(fields, nongli, options, ctx);
		return normalizeKinqimenData(backendPan, fallbackPan, options, nongli);
	}


	// WP-H-2 极速化:重 wrapper sCU —— 全 props 机械浅比(函数型跳过,详 wrapperPropsEqual);
	// state 任一引用变照常重渲(setState 恒换引用,此比既完整又廉价)。
	// 收益:宿主因无关状态重渲时,本重组件整树不再白跑。关 chartSCU 开关 = 恒重渲旧行为。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){
			return true;
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}

	componentDidMount(){
		this.unmounted = false;
		this._after23BoundaryUserOverrode = false; // 用户改过左栏下拉后,全局事件不再覆盖(用户拍板:左栏最高权限)
		this._lateZiHourUserOverrode = false; // v2.2.1: 同上 — 时柱开关也尊重左栏覆盖
		if(typeof window !== 'undefined'){
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
		}
		this.restoreOptionsFromCurrentCase(true);
		this.restoreFromCurrentChart(true);
		window.addEventListener('resize', this.handleWindowResize);
		this.handleWindowResize();
		this.prefetchJieqiSeedForFields(this.state.localFields || this.props.fields);
		this.prefetchNongliForFields(this.state.localFields || this.props.fields);
		// [R3-A7] 挂载即预取当前草稿时刻 pan:本会话首次「起局」也 ≈ 瞬间(链同 A4,失败静默)
		this.prefetchQimenPanForFields(this.state.localFields || this.props.fields, null);
	}

	componentDidUpdate(){
		this.restoreOptionsFromCurrentCase();
		this.restoreFromCurrentChart();
	}

	componentWillUnmount(){
		this.unmounted = true;
		if(typeof window !== 'undefined'){
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
			if(this._dayBoundaryListener){
				window.removeEventListener('horosa:day-boundary-changed', this._dayBoundaryListener);
			}
			if(this._lateZiHourListener){
				window.removeEventListener('horosa:late-zi-hour-mode-changed', this._lateZiHourListener);
			}
		}
		window.removeEventListener('resize', this.handleWindowResize);
		if(this.prefetchSeedTimer){
			clearTimeout(this.prefetchSeedTimer);
			this.prefetchSeedTimer = null;
		}
		if(this.resizeObserver){
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}
	}

	handleSnapshotRefreshRequest(evt){
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		if(moduleName !== 'qimen'){
			return;
		}
		if(this.state.pan){
			this.applyFaRelatedToPan(this.state.pan);
			const snapshotText = saveQimenLiveSnapshot(this.state.pan);
			if(snapshotText){
				saveModuleAISnapshot('qimen', snapshotText);
				if(evt && evt.detail && typeof evt.detail === 'object'){
					evt.detail.snapshotText = snapshotText;
				}
			}
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

	handleWindowResize(){
		const viewportHeight = getViewportHeight();
		const leftBoardWidth = this.leftBoardHost ? this.leftBoardHost.clientWidth : 0;
		const leftBoardHeight = this.leftBoardHost ? this.leftBoardHost.clientHeight : 0;
		const changed = Math.abs((this.state.leftBoardWidth || 0) - leftBoardWidth) >= 2
			|| Math.abs((this.state.leftBoardHeight || 0) - leftBoardHeight) >= 2
			|| Math.abs((this.state.viewportHeight || 0) - viewportHeight) >= 2;
		if(changed){
			this.setState({
				leftBoardWidth,
				leftBoardHeight,
				viewportHeight,
			});
		}
	}

	calcBoardScale(){
		const viewH = this.state.viewportHeight || 900;
		const availW = this.state.leftBoardWidth > 0 ? (this.state.leftBoardWidth - 22) : DUNJIA_BOARD_BASE_WIDTH;
		const availH = this.state.leftBoardHeight > 0 ? (this.state.leftBoardHeight - 12) : (viewH - 96);
		const widthScale = availW / DUNJIA_BOARD_BASE_WIDTH;
		const heightScale = availH / DUNJIA_BOARD_BASE_HEIGHT;
		// 遁甲盘直接铺在中心栏里，缩放以实际容器高宽为准，不再预留旧卡片外框空间。
		let rawScale = Math.min(widthScale, heightScale);
		if(!Number.isFinite(rawScale) || rawScale <= 0){
			return 1;
		}
		return clamp(rawScale, DUNJIA_SCALE_MIN, DUNJIA_SCALE_MAX);
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
		const caseVersion = `${cid}|${updateTime}`;
		if(!force && this.lastRestoredCaseId === caseVersion){
			return;
		}
		const sourceModule = currentCase.sourceModule ? currentCase.sourceModule.value : null;
		const caseType = currentCase.caseType ? currentCase.caseType.value : null;
		if(sourceModule !== 'qimen' && caseType !== 'qimen'){
			return;
		}
		const payload = this.parseCasePayload(currentCase.payload ? currentCase.payload.value : null);
		if(!payload){
			return;
		}
		const nextOptions = {
			...this.state.options,
		};
		let changed = false;
		const savedOptions = payload.options && typeof payload.options === 'object' ? payload.options : null;
		if(savedOptions){
			Object.keys(DEFAULT_OPTIONS).forEach((key)=>{
				if(savedOptions[key] !== undefined){
					nextOptions[key] = savedOptions[key];
					changed = true;
				}
			});
		}
		const pan = payload.pan && typeof payload.pan === 'object' ? payload.pan : null;
		if(pan){
			if(pan.shiftPalace !== undefined){
				nextOptions.shiftPalace = pan.shiftPalace;
				changed = true;
			}
			if(pan.fengJu !== undefined){
				nextOptions.fengJu = !!pan.fengJu;
				changed = true;
			}
		}
		const nextFaRelated = Array.isArray(payload.faRelatedPeople) ? payload.faRelatedPeople : [];
		if(!sameRelatedPeople(nextFaRelated, this.state.faRelatedPeople)){
			changed = true;
		}
		this.lastRestoredCaseId = caseVersion;
		if(!changed){
			return;
		}
		this.setState({
			options: nextOptions,
			faRelatedPeople: nextFaRelated,
			chartCategory: 'shi',
		}, ()=>{
			const calcFields = this.state.localFields || this.props.fields;
			const calcFieldKey = getFieldKey(calcFields);
			const nongliKey = getNongliRequestKey(calcFields, nextOptions);
			const canRecalc = this.state.nongli
				&& calcFieldKey
				&& nongliKey
				&& nongliKey === this.lastNongliKey;
			if(this.state.hasPlotted){
				if(canRecalc){
					this.recalc(this.state.localFields || this.props.fields, this.state.nongli, nextOptions, this.state.displaySolarTime);
				}else{
					this.requestNongli(calcFields, true);
				}
			}
		});
	}

	// —— 命盘(localCharts)往返：奇门设置存于 currentChart.payload.qimen，重开时还原；命盘本体是普通人命盘，跨技法自由使用。——
	restoreFromCurrentChart(force){
		const store = getStore();
		const userState = store && store.user ? store.user : null;
		const currentChart = userState && userState.currentChart ? userState.currentChart : null;
		if(!currentChart || !currentChart.cid || !currentChart.cid.value){
			return;
		}
		const cid = `${currentChart.cid.value}`;
		const updateTime = currentChart.updateTime && currentChart.updateTime.value ? `${currentChart.updateTime.value}` : '';
		const chartVersion = `${cid}|${updateTime}`;
		if(!force && this.lastRestoredChartId === chartVersion){
			return;
		}
		const payload = this.parseCasePayload(currentChart.payload ? currentChart.payload.value : null);
		const qimen = payload && payload.qimen && typeof payload.qimen === 'object' ? payload.qimen : null;
		// 标记已处理此命盘版本（无论是否带奇门设置，避免反复触发）。
		this.lastRestoredChartId = chartVersion;
		if(!qimen){
			return;
		}
		const nextOptions = { ...this.state.options };
		let changed = false;
		const savedOptions = qimen.options && typeof qimen.options === 'object' ? qimen.options : null;
		if(savedOptions){
			Object.keys(DEFAULT_OPTIONS).forEach((key)=>{
				if(savedOptions[key] !== undefined){
					nextOptions[key] = savedOptions[key];
					changed = true;
				}
			});
		}
		const nextFaRelated = Array.isArray(qimen.faRelatedPeople) ? qimen.faRelatedPeople : [];
		if(!sameRelatedPeople(nextFaRelated, this.state.faRelatedPeople)){
			changed = true;
		}
		if(!changed){
			return;
		}
		this.setState({
			options: nextOptions,
			faRelatedPeople: nextFaRelated,
			chartCategory: 'ming',
		}, ()=>{
			const calcFields = this.state.localFields || this.props.fields;
			const calcFieldKey = getFieldKey(calcFields);
			const nongliKey = getNongliRequestKey(calcFields, nextOptions);
			const canRecalc = this.state.nongli
				&& calcFieldKey
				&& nongliKey
				&& nongliKey === this.lastNongliKey;
			if(this.state.hasPlotted){
				if(canRecalc){
					this.recalc(this.state.localFields || this.props.fields, this.state.nongli, nextOptions, this.state.displaySolarTime);
				}else{
					this.requestNongli(calcFields, true);
				}
			}
		});
	}

	// 把当前选中的「相关人员」捕获快照写到 pan 上（单源：快照/导出/挂载/储存全读 pan.faRelatedPeople）。
	applyFaRelatedToPan(pan){
		const arr = Array.isArray(this.state.faRelatedPeople) ? this.state.faRelatedPeople : [];
		if(pan){
			pan.faRelatedPeople = arr;
		}
		// 同步全局当前选择，供 AI 挂载里「重算 pan（未 stamp）」的路径兜底，确保四同步无遗漏。
		if(typeof window !== 'undefined'){
			window.__horosa_qimen_related_people = arr;
		}
		return pan;
	}

	// 命盘库全部人 → 多选项（label 带生年干）；生年干按 cid+birth 缓存，避免下拉重复计算。并入当前已选(防源命盘被删后标签丢失)。
	getRelatedPeopleOptions(){
		let list = [];
		try{
			list = listLocalCharts() || [];
		}catch(e){
			list = [];
		}
		this._yearGanCache = this._yearGanCache || {};
		const opts = [];
		const seen = {};
		list.forEach((c)=>{
			if(!c || !c.cid){
				return;
			}
			const key = `${c.cid}|${c.birth}`;
			let yg = this._yearGanCache[key];
			if(yg === undefined){
				yg = birthToYearGan(c.birth) || '';
				this._yearGanCache[key] = yg;
			}
			const name = c.name ? `${c.name}` : '未命名';
			opts.push({ value: `${c.cid}`, name, yearGan: yg, label: `${name}·${yg || '?'}年` });
			seen[`${c.cid}`] = true;
		});
		(this.state.faRelatedPeople || []).forEach((p)=>{
			if(p && p.cid && !seen[`${p.cid}`]){
				const name = p.name ? `${p.name}` : '未命名';
				opts.push({ value: `${p.cid}`, name, yearGan: p.yearGan || '', label: `${name}·${p.yearGan || '?'}年` });
				seen[`${p.cid}`] = true;
			}
		});
		return opts;
	}

	onRelatedPeopleChange(cids){
		const opts = this.getRelatedPeopleOptions();
		const byCid = {};
		opts.forEach((o)=>{ byCid[o.value] = o; });
		const people = (cids || []).map((cid)=>{
			const o = byCid[`${cid}`];
			return o ? { cid: o.value, name: o.name, yearGan: o.yearGan } : { cid: `${cid}`, name: '', yearGan: '' };
		});
		this.setState({ faRelatedPeople: people }, ()=>{
			const pan = this.state.pan;
			// 总是同步全局当前选择(即使尚未起盘),供 AI 挂载兜底。
			this.applyFaRelatedToPan(pan);
			if(pan){
				const snapshotText = saveQimenLiveSnapshot(pan);
				if(snapshotText){
					saveModuleAISnapshot('qimen', snapshotText);
				}
				this.forceUpdate();
			}
		});
	}

	onChartCategoryChange(value){
		const cat = value === 'ming' ? 'ming' : 'shi';
		this.setState({ chartCategory: cat }, ()=>{
			// 切换命/事局后重戳 pan 并刷新 AI 快照，使「用神/化解/全局速览」的命事语义与挂载/导出即时同步。
			const pan = this.state.pan;
			if(pan){
				if(pan.options){ pan.options.chartCategory = cat; }
				const snapshotText = saveQimenLiveSnapshot(pan);
				if(snapshotText){
					saveModuleAISnapshot('qimen', snapshotText);
				}
			}
		});
	}

	onFieldsChange(field, syncOnly){
		if(this.props.dispatch){
			const flds = {
				...(this.props.fields || {}),
				...field,
			};
			if(syncOnly){
				this.props.dispatch({
					type: 'astro/save',
					payload: {
						fields: flds,
					},
				});
				return;
			}
			this.props.dispatch({
				type: 'astro/fetchByFields',
				payload: flds,
			});
		}
	}

	onTimeChanged(value){
		const dt = value.time;
		const base = this.props.fields || {};
		const localFields = {
			...base,
			date: { value: dt.clone() },
			time: { value: dt.clone() },
			ad: { value: dt.ad },
			zone: { value: dt.zone },
		};
		this.setState({ localFields });
		if(this.prefetchSeedTimer){
			clearTimeout(this.prefetchSeedTimer);
		}
		const stepHint = value && value.step ? value.step : null;
		this.prefetchSeedTimer = setTimeout(()=>{
			this.prefetchSeedTimer = null;
			if(this.unmounted){
				return;
			}
			this.prefetchJieqiSeedForFields(localFields);
			this.prefetchNongliForFields(localFields);
			// [R3-A4] 草稿时间一变即预取该时刻 pan(kinqimen 后端模式):用户点「起局」时
			// nongli+pan 双双已热 ≈ 瞬间。步进时再顺向多备一步(连点第二下也不冷)。
			this.prefetchQimenPanForFields(localFields, stepHint);
			// horosa_step_prefetch_arm_v1(b′,与上游 [R3-A4] 互补):遁甲未确认步进只落
			// localFields、不经 fetchByFields ⇒ settle 武装在此自己做 —— ±depth 双向
			// stage-1 种子经登记的预取器构造(上游预取当前时刻+顺向一步;本武装铺双向窗)。
			// skipChart:/chart 不在本页步进路径上。
			try{ armStepPrefetch('local-settle', { fieldsOverride: localFields, skipChart: true }); }catch(e){ /* 武装失败静默 */ }
		}, 120);
	}

	// [R3-A4] pan 预取:与真实链同源复刻(genParams→fetchPreciseNongli→
	// resolveDisplaySolarTime→getContext→fetchQimenPan),body 构造同一函数 → 键逐字节等;
	// 结果只落 kentangCache,返回值丢弃。仅 kinqimen 后端模式(本地 calcDunJia 即时无需预取);
	// 飞盘/混合/报数走本地,同 getResolvedPan 判据。失败静默。
	prefetchQimenPanForFields(localFields, stepHint){
		try{
			if(!stepPrefetchEnabled() || !kentangCacheEnabled()){
				return;
			}
			const options = this.state.options || {};
			if(!isKinqimenMode(options.paiPanType)){
				return;
			}
			if(options.school === '飞盘' || options.school === '混合' || options.qijuMethod === 'shuzi'){
				return;
			}
			const targets = [localFields];
			if(stepHint && stepHint.dir && localFields && localFields.date && localFields.date.value
				&& typeof localFields.date.value.clone === 'function'){
				// 顺向 +1 步:与 DateTimeSelector 步距语义一致(m 档=±4 分)
				const dt2 = localFields.date.value.clone();
				const unit = stepHint.unit || 'm';
				if(unit === 'y'){ dt2.addYear(stepHint.dir); }
				else if(unit === 'M'){ dt2.addMonth(stepHint.dir); }
				else if(unit === 'd'){ dt2.addDate(stepHint.dir); }
				else if(unit === 'h'){ dt2.addHour(stepHint.dir); }
				else { dt2.addMinute(4 * stepHint.dir); }
				targets.push({
					...localFields,
					date: { value: dt2.clone() },
					time: { value: dt2.clone() },
				});
			}
			targets.forEach((flds)=>{
				let params = null;
				try{ params = this.genParams(flds); }catch(e){ return; }
				if(!params){ return; }
				fetchPreciseNongli(params).then(async (nongli)=>{
					if(!nongli || this.unmounted){ return; }
					setNongliLocalCache(params, nongli);
					const displaySolarTime = await this.resolveDisplaySolarTime(params, nongli);
					if(this.unmounted){ return; }
					const ctx = this.getContext(flds, displaySolarTime);
					await fetchQimenPan(flds, nongli, options, ctx);
				}).catch(()=>null);
			});
		}catch(e){ /* 预取失败无害 */ }
	}

	onGenderChange(val){
		this.onOptionChange('sex', val);
		this.onFieldsChange({
			gender: { value: val },
		}, true);
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
		return {
			...(baseFields || this.state.localFields || this.props.fields || {}),
			date: { value: dt.clone() },
			time: { value: dt.clone() },
			ad: { value: dt.ad },
			zone: { value: dt.zone },
		};
	}

	clickPlot(){
		if(this.state.loading){
			return;
		}
		const timeFields = this.getTimeFieldsFromSelector(this.state.localFields || this.props.fields);
		const nextFields = timeFields || this.state.localFields || this.props.fields;
		if(!nextFields){
			return;
		}
		const nextKey = getFieldKey(nextFields);
		const curKey = getFieldKey(this.props.fields);
		if(nextKey && nextKey !== curKey){
			this.onFieldsChange({
				date: { value: nextFields.date.value.clone() },
				time: { value: nextFields.time.value.clone() },
				ad: { value: nextFields.ad.value },
				zone: { value: nextFields.zone.value },
			}, true);
		}
		this.setState({
			hasPlotted: true,
			localFields: nextFields,
		}, ()=>{
			const shouldForce = !this.state.nongli
				|| getNongliRequestKey(nextFields, this.state.options) !== this.lastNongliKey;
			this.requestNongli(nextFields, shouldForce);
		});
	}

	// 快捷栏契约:「此刻起局」:课时=当下并立即重排,绕过左栏时间草稿(用户点「此刻」即要 NOW)。
	// 只补 date/time/ad——zone/经纬是用户所在地设置不动;左栏跟显靠 onFieldsChange 受控回流。
	clickPlotNow(){
		if(this.state.loading){
			return;
		}
		const base = this.state.localFields || this.props.fields;
		if(!base){
			return;
		}
		const now = new DateTime();
		const patch = {
			date: { value: now.clone() },
			time: { value: now.clone() },
			ad: { value: now.ad },
		};
		this.onFieldsChange(patch, true);
		const nextFields = { ...base, ...patch };
		this.setState({
			hasPlotted: true,
			localFields: nextFields,
		}, ()=>{
			this.requestNongli(nextFields, true);
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
		// 🔑 刷新左栏 + 让时间选择器(datetm 由 localFields 派生 + setZone)同步到新经度/时区,再走 clickPlot 重排。
		// 注意:此处【不】调 onFieldsChange(save)——save 会触发 hook 预取竞态、以旧盘(旧经纬/时区)以更高 seq 覆盖重算,
		// 导致真太阳时/四柱/局停在旧值;clickPlot 内部会在 key 变化时自行 save(顺序正确,无竞态)。
		Object.assign(geoPatch, geoNameFieldPatch(rec));
		const nextFields = { ...base, ...geoPatch };
		this.setState({ localFields: nextFields, hasPlotted: true }, ()=>{
			if(this._geoRecalcTimer){ clearTimeout(this._geoRecalcTimer); }
			// 直接用捕获的重锚 NY fields 强制重排(绕过时间选择器同步竞态);延后让 setState 提交后再跑。
			this._geoRecalcTimer = setTimeout(()=>{
				this._geoRecalcTimer = null;
				if(this.unmounted){ return; }
				this.requestNongli(nextFields, true);
				// 重排发起后再异步存盘(redux props.fields 同步供储存/AI),此时不再与重排抢 seq。
				this.onFieldsChange(geoPatch, true);
			}, 320);
		});
	}

	genParams(fields){
		// PERF-R9 Ship 7:构造原样抽为模块级纯函数(预热复用同一路径 ⇒ key/body 逐字节一致);
		// 本方法保持既有签名与兜底语义(localFields/props 兜底),纯委托零行为变化。
		return buildDunJiaNongliParamsPure(
			fields || this.state.localFields || this.props.fields,
			this.state.options || DEFAULT_OPTIONS
		);
	}

	async recalc(fields, nongli, options, displaySolarTime){
		const flds = fields || this.state.localFields || this.props.fields;
		if(!flds || !nongli){
			return;
		}
		const displaySolar = safe(displaySolarTime, this.state.displaySolarTime);
		const fixedOptions = {
			...(options || this.state.options),
			jieQiType: 1,
			yearGanZhiType: 2,
			monthGanZhiType: 1,
			dayGanZhiType: 1,
		};
			const panSignature = [
				getFieldKey(flds),
				getNongliKey(nongli || this.state.nongli),
				getQimenOptionsKey(fixedOptions),
				safe(this.getContext(flds, displaySolar).isDiurnal, ''),
				displaySolar,
			].join('|');
		if(this.state.pan && panSignature === this.lastPanSignature){
			return;
		}
		const remoteMode = isKinqimenMode(fixedOptions.paiPanType);
		if(remoteMode && !this.state.loading){
			this.setState({ loading: true });
		}
		try{
			const pan = await this.getResolvedPan(flds, nongli || this.state.nongli, fixedOptions, displaySolar);
			this.applyFaRelatedToPan(pan);
			// 单一真值：把当前「盘类（命/事）」戳进 pan.options，供 AI 快照(无 ctx 路径)与用神/化解命事局语义同源。
			if(pan && pan.options){ pan.options.chartCategory = this.state.chartCategory; }
			this.lastPanSignature = panSignature;
			this.setState({ pan, displaySolarTime: displaySolar, loading: false }, ()=>{
				// horosa_panel_ready_v1:奇门中栏九宫盘 + 右栏五页签全部派生自这一个 pan,
				// 故本次 setState 落定 = 中栏+右栏画完(pan 为 null 时也算「本次交互到此为止」,
				// 不记会让该次交互永远配不上对)。已在 panSignature 去重与 loading 置位之后。
				markPanelReady('dunjia');
				if(pan){
					rememberDunJiaLiveState({
						fieldKey: getFieldKey(flds),
						lastNongliKey: this.lastNongliKey,
						lastPanSignature: this.lastPanSignature,
						nongli: nongli || this.state.nongli,
						displaySolarTime: displaySolar,
						pan,
						options: fixedOptions,
						faRelatedPeople: this.state.faRelatedPeople,
					});
					const snapshotText = saveQimenLiveSnapshot(pan);
					if(snapshotText){
						saveModuleAISnapshot('qimen', snapshotText);
					}
				}
			});
		}catch(e){
			if(!this.unmounted){
				this.setState({ loading: false });
				message.error('遁甲计算失败：本地奇门服务不可用');
			}
		}
	}

	genJieqiParams(fields, year){
		// PERF-R9 Ship 7:同上,抽为模块级纯函数,方法纯委托(兜底语义不变)。
		return buildDunJiaJieqiParamsPure(
			fields || this.state.localFields || this.props.fields,
			year,
			this.state.options || DEFAULT_OPTIONS
		);
	}

	async resolveDisplaySolarTime(params, primaryResult){
		if(!params){
			return safe(primaryResult && primaryResult.birth, '');
		}
		const current = safe(primaryResult && primaryResult.birth, '');
		if(normalizeTimeAlg(params.timeAlg) === 0){
			return current;
		}
		const solarParams = buildDisplaySolarParams(params);
		const cachedSolar = getNongliLocalCache(solarParams);
		if(cachedSolar && cachedSolar.birth){
			return safe(cachedSolar.birth, current);
		}
		try{
			const solarResult = await fetchPreciseNongli(solarParams);
			if(solarResult){
				setNongliLocalCache(solarParams, solarResult);
			}
			return safe(solarResult && solarResult.birth, current);
		}catch(e){
			// 显示用真太阳时请求失败时，回退主请求时间，不中断排盘。
			return current;
		}
	}

	getContext(fields, displaySolarTime){
		const flds = fields || this.state.localFields || this.props.fields;
		let year = null;
		if(flds && flds.date && flds.date.value){
			year = parseInt(flds.date.value.format('YYYY'), 10);
		}
		return {
			year,
			jieqiYearSeeds: this.jieqiYearSeeds,
			isDiurnal: extractIsDiurnalFromChartProp(this.props.value),
			displaySolarTime: safe(displaySolarTime, this.state.displaySolarTime),
		};
	}

	async ensureJieqiSeed(fields, year){
		if(!year || Number.isNaN(year)){
			return null;
		}
		// 缓存命中须含日家所需「冬至/夏至」(旧版种子只取大雪/芒种);缺则放行重取(避免返回不全的旧种子致日家退化)。
		if(this.jieqiYearSeeds[year] && this.jieqiYearSeeds[year].冬至 && this.jieqiYearSeeds[year].夏至){
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
			let seed = await fetchPreciseJieqiSeed(params);
			if(seed){
				this.jieqiYearSeeds[year] = seed;
				// 新 jieqi 种子到达:飞盘/混合短路的本地置闰·无闰超神·茅山交节 + 日家(节气三元60日块)依赖此种子;panCache key 不含种子→
				// 可能缓存了漏超神/漏块/茅山退拆补的盘,故失效缓存并重算其视图(转盘走后端不受影响)。
				if(!this.unmounted && this.state.hasPlotted && (['飞盘', '混合'].indexOf((this.state.options || {}).school) >= 0 || (this.state.options || {}).paiPanType === 2)){
					if(this.panCache){ this.panCache.clear(); }
					this.lastPanSignature = '';
					const flds = this.state.localFields || this.props.fields;
					if(flds && this.state.nongli){
						this.recalc(flds, this.state.nongli, this.state.options, this.state.displaySolarTime);
					}
				}
			}
			return seed;
		}).finally(()=>{
			delete this.jieqiSeedPromises[year];
		});
		return this.jieqiSeedPromises[year];
	}

	prefetchJieqiSeedForFields(fields){
		const flds = fields || this.state.localFields || this.props.fields;
		if(!flds || !flds.date || !flds.date.value){
			return;
		}
		const fixedOptions = {
			...this.state.options,
			jieQiType: 1,
			yearGanZhiType: 2,
			monthGanZhiType: 1,
			dayGanZhiType: 1,
		};
		if(!needJieqiYearSeed(fixedOptions)){
			return;
		}
		const year = parseInt(flds.date.value.format('YYYY'), 10);
		if(!year || Number.isNaN(year)){
			return;
		}
		const seedTasks = [
			this.ensureJieqiSeed(flds, year - 1),
			this.ensureJieqiSeed(flds, year),
		];
		// 日家(节气三元60日块)晚12月冬至界需次年冬至定半年/至甲子。
		if(fixedOptions && fixedOptions.paiPanType === 2){ seedTasks.push(this.ensureJieqiSeed(flds, year + 1)); }
		Promise.all(seedTasks).catch(()=>null);
	}

	prefetchNongliForFields(fields){
		const flds = fields || this.state.localFields || this.props.fields;
		if(!flds){
			return;
		}
		let params = null;
		try{
			params = this.genParams(flds);
		}catch(e){
			return;
		}
		if(!params){
			return;
		}
		fetchPreciseNongli(params).then((result)=>{
			if(result){
				setNongliLocalCache(params, result);
			}
		}).catch(()=>null);
	}

	async requestNongli(fields, force){
		const fldsToUse = fields || this.state.localFields || this.props.fields;
		let params = null;
		try{
			params = this.genParams(fldsToUse);
		}catch(e){
			message.error('遁甲起盘参数无效，请确认时间与经纬度后重试');
			return;
		}
		if(!params){
			return;
		}
		const requestKey = getNongliRequestKey(fldsToUse, this.state.options);
		if(!force && this.state.nongli && requestKey && requestKey === this.lastNongliKey){
			this.recalc(fldsToUse, this.state.nongli, this.state.options, this.state.displaySolarTime);
			return;
		}
		if(this.pendingNongli && this.pendingNongli.key === requestKey){
			return this.pendingNongli.promise;
		}
		const seq = ++this.requestSeq;
		if(force && !this.state.loading){
			this.setState({ loading: true });
		}

		const reqPromise = (async ()=>{
			const fixedOptions = {
				...this.state.options,
				jieQiType: 1,
				yearGanZhiType: 2,
				monthGanZhiType: 1,
				dayGanZhiType: 1,
			};
			const shouldWaitSeed = needJieqiYearSeed(fixedOptions);
			const flds = fldsToUse;
			let year = null;
			if(flds && flds.date && flds.date.value){
				year = parseInt(flds.date.value.format('YYYY'), 10);
			}
			const waitSeed = !!(year && shouldWaitSeed);
			// 日家(节气三元60日块)晚12月过冬至需次年冬至定半年/至甲子 → 加载 year+1。
			const seedYears = (fixedOptions && fixedOptions.paiPanType === 2) ? [year - 1, year, year + 1] : [year - 1, year];
			const seedPromise = waitSeed ? Promise.all(seedYears.map((yy)=>this.ensureJieqiSeed(flds, yy))) : null;
			const missingSeed = waitSeed && (!this.jieqiYearSeeds[year - 1] || !this.jieqiYearSeeds[year]);
			if(missingSeed && !this.state.loading){
				this.setState({ loading: true });
			}
				try{
					const result = await fetchPreciseNongli(params);
					if(!result){
						throw new Error('precise.nongli.unavailable');
					}
					setNongliLocalCache(params, result);
					const displaySolarTime = await this.resolveDisplaySolarTime(params, result);
					if(this.unmounted || seq !== this.requestSeq){
						return;
					}
				if(waitSeed){
					const seeds = await seedPromise;
					if(!seeds[0] || !seeds[1]){
						throw new Error('precise.jieqi.unavailable');
					}
				}
				if(this.unmounted || seq !== this.requestSeq){
					return;
				}
					const panSignature = [
						getFieldKey(flds),
						getNongliKey(result),
						getQimenOptionsKey(fixedOptions),
						safe(this.getContext(flds, displaySolarTime).isDiurnal, ''),
						displaySolarTime,
					].join('|');
					const pan = await this.getResolvedPan(flds, result, fixedOptions, displaySolarTime);
					this.applyFaRelatedToPan(pan);
					this.lastNongliKey = requestKey;
					this.lastPanSignature = panSignature;
						this.setState({
							nongli: result,
							displaySolarTime,
							pan,
							hasPlotted: true,
							loading: false,
						}, ()=>{
						if(pan){
							rememberDunJiaLiveState({
								fieldKey: getFieldKey(flds),
								lastNongliKey: this.lastNongliKey,
								lastPanSignature: this.lastPanSignature,
								nongli: result,
								displaySolarTime,
								pan,
								options: fixedOptions,
								faRelatedPeople: this.state.faRelatedPeople,
							});
							const snapshotText = saveQimenLiveSnapshot(pan);
							if(snapshotText){
								saveModuleAISnapshot('qimen', snapshotText);
							}
						}
					});
			}catch(e){
				if(!this.unmounted && seq === this.requestSeq){
					this.setState({ loading: false });
					message.error('遁甲计算失败：精确历法服务不可用');
				}
			}finally{
				if(this.pendingNongli && this.pendingNongli.key === requestKey && seq === this.requestSeq){
					this.pendingNongli = null;
				}
			}
		})();
		this.pendingNongli = {
			key: requestKey,
			promise: reqPromise,
		};
		return reqPromise;
	}

	onOptionChange(key, value, opts){
		// 用户拍板: 左栏改过 after23NewDay 后,全局事件不再覆盖(最高权限)。fromGlobal 时不打用户改过的标记。
		if(key === 'after23NewDay' && !(opts && opts.fromGlobal)){
			this._after23BoundaryUserOverrode = true;
		}
		// v2.2.1: 时柱开关同款局部覆盖语义
		if(key === 'lateZiHourUseNextDay' && !(opts && opts.fromGlobal)){
			this._lateZiHourUserOverrode = true;
		}
		const nextVal = key === 'timeAlg' ? normalizeTimeAlg(value) : value;
		const options = normalizeKenQimenOptions({
			...this.state.options,
			[key]: nextVal,
		});
		const nextState = { options };
		// 切 排盘体例/盘式/起局 → 八宫子选复位到默认宫(右栏各 tab 数据本就随 resolved pan 重算,此处只复位子选避免停留旧宫)。
		if(['paiPanType', 'school', 'qijuMethod'].indexOf(key) >= 0){
			nextState.bagongPalace = BAGONG_PALACE_ORDER[0];
		}
		if(key === 'timeAlg'){
			nextState.localFields = {
				...(this.state.localFields || this.props.fields || {}),
				timeAlg: { value: nextVal },
			};
		}
		this.setState(nextState, ()=>{
			if(key === 'timeAlg'){
				this.jieqiSeedPromises = {};
				this.jieqiYearSeeds = {};
				this.panCache.clear();
				this.lastPanSignature = '';
				this.lastNongliKey = '';
				this.onFieldsChange({
					timeAlg: { value: nextVal },
				}, true);
			}
			const calcFields = this.state.localFields || this.props.fields;
			const calcFieldKey = getFieldKey(calcFields);
			this.prefetchJieqiSeedForFields(calcFields);
			const canRecalc = this.state.nongli
				&& calcFieldKey
				&& getNongliRequestKey(calcFields, options) === this.lastNongliKey;
			if(key === 'after23NewDay' || key === 'timeAlg'){
				this.prefetchNongliForFields(calcFields);
				if(this.state.hasPlotted){
					this.requestNongli(calcFields, true);
				}
				return;
			}
			if(this.state.hasPlotted && canRecalc){
				this.recalc(this.state.localFields || this.props.fields, this.state.nongli, options, this.state.displaySolarTime);
			}
		});
	}

	clickSaveCase(){
		const pan = this.state.pan;
		if(!pan){
			message.warning('请先起盘后再保存');
			return;
		}
		const flds = this.state.localFields || this.props.fields;
		if(!flds){
			return;
		}
		this.applyFaRelatedToPan(pan);
		const faRelated = Array.isArray(this.state.faRelatedPeople) ? this.state.faRelatedPeople : [];
		const fixedOptions = {
			...this.state.options,
			fengJu: !!this.state.options.fengJu,
		};
		// 命盘：复用命盘库(localCharts)，奇门设置存 payload.qimen；命盘本体跨技法自由使用。
		if(this.state.chartCategory === 'ming'){
			this.saveAsMingChart(flds, fixedOptions, faRelated);
			return;
		}
		// 事盘：案例库(localCases)。payload 增 faRelatedPeople 以便重开还原。
		const divTime = `${flds.date.value.format('YYYY-MM-DD')} ${flds.time.value.format('HH:mm:ss')}`;
		const snapshot = loadModuleAISnapshot('qimen');
		const payload = {
			module: 'qimen',
			snapshot: snapshot,
			pan: pan,
			options: fixedOptions,
			faRelatedPeople: faRelated,
		};
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'astro/openDrawer',
				payload: {
					key: 'caseadd',
					record: {
						event: `奇门占断 ${divTime}`,
						caseType: 'qimen',
						divTime: divTime,
						zone: flds.zone.value,
						lat: flds.lat.value,
						lon: flds.lon.value,
						gpsLat: flds.gpsLat.value,
						gpsLon: flds.gpsLon.value,
						pos: flds.pos ? flds.pos.value : '',
						payload: payload,
						sourceModule: 'qimen',
					},
				},
			});
		}
	}

	// 保存为「命盘」：始终弹出「新增星盘」抽屉(复用命盘管理新增流程)，用户填姓名后入命盘库 localCharts。
	// birth/经纬度/性别已预填完整、奇门设置塞进 payload.qimen；命盘是普通人盘、日后可被占星/八字等任意技法自由使用。
	saveAsMingChart(flds, fixedOptions, faRelated){
		const qimenSettings = {
			options: fixedOptions,
			faRelatedPeople: faRelated,
			version: 1,
		};
		if(this.props.dispatch){
			const birthStr = `${flds.date.value.format('YYYY-MM-DD')} ${flds.time.value.format('HH:mm:ss')}`;
			// 注入完整人盘信息(起局时间作生时 + 经纬度/地名/性别)，使新建命盘在「命盘管理」里信息完整。
			this.props.dispatch({
				type: 'astro/openDrawer',
				payload: {
					key: 'chartadd',
					record: {
						birth: birthStr,
						zone: flds.zone ? flds.zone.value : undefined,
						lat: flds.lat ? flds.lat.value : undefined,
						lon: flds.lon ? flds.lon.value : undefined,
						gpsLat: flds.gpsLat ? flds.gpsLat.value : undefined,
						gpsLon: flds.gpsLon ? flds.gpsLon.value : undefined,
						pos: flds.pos ? flds.pos.value : undefined,
						gender: this.state.options ? this.state.options.sex : undefined,
						payload: { qimen: qimenSettings },
					},
				},
			});
		}
	}

	renderQimenDocPopover(tipObj){
		if(!tipObj){
			return null;
		}
		const blocks = Array.isArray(tipObj.blocks) ? tipObj.blocks : [];
		return (
			<div style={{ maxWidth: 560, maxHeight: 460, overflowY: 'auto', paddingRight: 4 }}>
				<div style={{ fontSize: 17, lineHeight: '24px', fontWeight: 700, color: 'var(--horosa-text, #1f1f1f)' }}>
					{tipObj.title}
				</div>
				<div style={{ borderTop: '1px solid var(--horosa-border, #d9d9d9)', margin: '6px 0 8px' }} />
				{blocks.map((block, idx)=>{
					if(!block){
						return null;
					}
					if(block.type === 'blank'){
						return <div key={`qimen_doc_blank_${idx}`} style={{ height: 6 }} />;
					}
					if(block.type === 'divider'){
						return <div key={`qimen_doc_divider_${idx}`} style={{ borderTop: '1px solid var(--horosa-border, #e8e8e8)', margin: '6px 0' }} />;
					}
					if(block.type === 'subTitle'){
						return (
							<div key={`qimen_doc_subtitle_${idx}`} style={{ margin: '4px 0 6px' }}>
								<div style={{ fontSize: 14, lineHeight: '20px', fontWeight: 700, color: 'var(--horosa-text, #262626)' }}>{block.text}</div>
								<div style={{ borderTop: '1px solid var(--horosa-border, #efefef)', marginTop: 4 }} />
							</div>
						);
					}
					const html = formatQimenDocLineToHtml(block.text || '');
					return (
						<div
							key={`qimen_doc_text_${idx}`}
							style={{ fontSize: 13, lineHeight: '21px', color: 'var(--horosa-text, #262626)', whiteSpace: 'pre-wrap' }}
							dangerouslySetInnerHTML={{ __html: html }}
						/>
					);
				})}
			</div>
		);
	}

	renderQimenHoverNode(type, text, style, key){
		const raw = `${text || ''}`.trim();
		const tipObj = buildQimenXiangTipObj(type, raw);
		const node = (
			<div key={key} style={{ ...style, cursor: tipObj ? 'help' : 'default' }}>
				{text || ' '}
			</div>
		);
		if(!tipObj){
			return node;
		}
		return (
			<Popover
				key={`${key}_popover`}
				trigger="hover"
				placement="bottomLeft"
				content={this.renderQimenDocPopover(tipObj)}
				overlayStyle={{ maxWidth: 600 }}
			>
				{node}
			</Popover>
		);
	}

	// ⑥ 行内悬浮:把与盘面同款的奇门象意 hover 套到 header 行内元素(年月日时天干 / 值符=九星 / 值使=八门),不破坏行内排版。
	renderQimenHoverInline(type, text, child, key){
		const tipObj = buildQimenXiangTipObj(type, `${text || ''}`.trim());
		if(!tipObj){
			return child;
		}
		return (
			<Popover
				key={key}
				trigger="hover"
				placement="bottom"
				content={this.renderQimenDocPopover(tipObj)}
				overlayStyle={{ maxWidth: 600 }}
			>
				<span style={{ cursor: 'help' }}>{child}</span>
			</Popover>
		);
	}

	renderCell(cell){
		const titleColor = cell.hasKongWang
			? '#2f54eb'
			: (cell.isCenter ? 'var(--horosa-muted, #c7c7c7)' : 'var(--horosa-text-soft, #5f5f5f)');
		let tianGanColor = 'var(--horosa-text, #262626)';
		if(cell.hasJiXing && cell.hasRuMu){
			tianGanColor = '#722ed1';
		}else if(cell.hasJiXing){
			tianGanColor = '#cf1322';
		}else if(cell.hasRuMu){
			tianGanColor = '#8b5e3c';
		}
		// 八神不跟随值符或天盘干状态染色，保持独立显示。
		const godColor = 'var(--horosa-text, #262626)';
		const line2Color = cell.hasMenPo ? '#fa8c16' : 'var(--horosa-text, #262626)';
		// 飞盘九门含中门(数据层 FEI_GATE_HOME[5]='中' 已随飞填宫),直接取门;无门留空格。
		const doorDisp = cell.door || ' ';
		const line3Color = 'var(--horosa-text, #262626)';
		const diGanColor = 'var(--horosa-text, #262626)';
		const centerMinorColor = 'var(--horosa-muted, #8c8c8c)';
		const unifiedFont = 34;
		const insetX = 52;
		const insetY = 40;
		const isGenPalace = cell.palaceNum === 7 || cell.palaceName === '艮';
		const yiMaStyle = isGenPalace
			? { position: 'absolute', left: 10, bottom: 8, fontSize: 20, lineHeight: '20px', color: 'var(--horosa-text, #111)' }
			: { position: 'absolute', top: 8, right: 10, fontSize: 20, lineHeight: '20px', color: 'var(--horosa-text, #111)' };

		const palacePosMap = {
			1: { right: 12, bottom: 8 }, // 巽：靠中宫（右下）
			2: { left: '50%', bottom: 8, transform: 'translateX(-50%)' }, // 离：靠中宫（下中）
			3: { left: 12, bottom: 8 }, // 坤：靠中宫（左下）
			4: { right: 12, top: '50%', transform: 'translateY(-50%)' }, // 震：靠中宫（右中）
			6: { left: 12, top: '50%', transform: 'translateY(-50%)' }, // 兑：靠中宫（左中）
			7: { right: 12, top: 8 }, // 艮：靠中宫（右上）
			8: { left: '50%', top: 8, transform: 'translateX(-50%)' }, // 坎：靠中宫（上中）
			9: { left: 12, top: 8 }, // 乾：靠中宫（左上）
		};
		const palaceStyle = palacePosMap[cell.palaceNum] || null;
		const wuHeMap = {
			甲: '己',
			乙: '庚',
			丙: '辛',
			丁: '壬',
			戊: '癸',
			己: '甲',
			庚: '乙',
			辛: '丙',
			壬: '丁',
			癸: '戊',
		};
		const centerGan = cell.tianGan || cell.diGan || '';
		const centerHeGan = centerGan ? (wuHeMap[centerGan] || '') : '';
		const centerItems = [];
		if(centerGan){
			centerItems.push({ text: centerGan, color: centerMinorColor });
		}
		if(centerHeGan){
			centerItems.push({ text: `五合${centerHeGan}`, color: centerMinorColor });
		}

		// 转盘中宫无神(仅天盘干+五合);飞盘九星九神含中宫(天禽/九地飞入)→ 走常规格(无门)显示。
		if(cell.isCenter && !cell.isFeipan){
			return (
				<div
					key={`cell_${cell.palaceNum}`}
					style={{
						background: 'var(--horosa-panel-soft, #f6f6f6)',
						borderRadius: 14,
						border: '1px solid var(--horosa-border, #ececec)',
						height: 214,
						padding: 0,
						position: 'relative',
					}}
				>
					<div
						style={{
							position: 'absolute',
							left: '50%',
							top: '50%',
							transform: 'translate(-50%, -50%)',
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							justifyContent: 'center',
							gap: 4,
						}}
					>
						{centerItems.map((item, idx)=>(
							<div
								key={`center_item_${idx}`}
								style={{
									fontSize: 32,
									lineHeight: '32px',
									fontWeight: 700,
									color: item.color,
								}}
							>
								{item.text}
							</div>
						))}
					</div>
				</div>
			);
		}

		return (
			<div
				key={`cell_${cell.palaceNum}`}
				style={{
					background: 'var(--horosa-panel-soft, #f6f6f6)',
					borderRadius: 14,
					border: '1px solid var(--horosa-border, #ececec)',
					height: 214,
					padding: 0,
					position: 'relative',
				}}
			>
					{cell.isYiMa && (
						<div style={yiMaStyle}>🐎</div>
					)}

				{this.renderQimenHoverNode(
					'stem',
					cell.tianGan || ' ',
					{
						position: 'absolute',
						left: insetX,
						top: insetY,
						fontSize: unifiedFont,
						lineHeight: `${unifiedFont}px`,
						color: tianGanColor,
						fontWeight: 700,
					},
					`qimen_tiangan_${cell.palaceNum}`
				)}
				{this.renderQimenHoverNode(
					'stem',
					cell.diGan || ' ',
					{
						position: 'absolute',
						left: insetX,
						bottom: insetY,
						fontSize: unifiedFont,
						lineHeight: `${unifiedFont}px`,
						color: diGanColor,
						fontWeight: 700,
					},
					`qimen_digan_${cell.palaceNum}`
				)}
				{this.renderQimenHoverNode(
					'god',
					cell.god || ' ',
					{
						position: 'absolute',
						right: insetX,
						top: insetY,
						fontSize: unifiedFont,
						lineHeight: `${unifiedFont}px`,
						color: godColor,
						fontWeight: 700,
					},
					`qimen_god_${cell.palaceNum}`
				)}
				{this.renderQimenHoverNode(
					'star',
					cell.tianXing || ' ',
					{
						position: 'absolute',
						right: insetX,
						bottom: insetY,
						fontSize: unifiedFont,
						lineHeight: `${unifiedFont}px`,
						color: line3Color,
						fontWeight: 700,
					},
					`qimen_star_${cell.palaceNum}`
				)}
				{this.renderQimenHoverNode(
					'door',
					doorDisp,
					{
						position: 'absolute',
						left: '50%',
						top: '50%',
						transform: 'translate(-50%, -50%)',
						fontSize: unifiedFont,
						lineHeight: `${unifiedFont}px`,
						color: line2Color,
						fontWeight: 700,
					},
					`qimen_door_${cell.palaceNum}`
				)}

				{!!palaceStyle && (
					<div
						style={{
							position: 'absolute',
							color: titleColor,
							fontSize: 15,
							lineHeight: '15px',
							fontWeight: 700,
							...palaceStyle,
						}}
					>
						{this.renderQimenHoverInline('palace', cell.palaceName, <span>{cell.palaceName}</span>, `pn_${cell.palaceNum}`)}
					</div>
				)}
			</div>
		);
	}

	renderBoard(){
		const pan = this.state.pan;
		if(!this.state.hasPlotted){
			return <Card bordered={false}>点击左侧“起盘”后显示遁甲盘</Card>;
		}
		if(!pan){
			return <Card bordered={false}>暂无遁甲盘数据</Card>;
		}
		// 盘面九宫×~45 Popover + 表头悬浮抽进 <DunJiaBoard>(sCU 按 pan/boardScale 守门),父无关 setState 不再重建整盘。
		// 渲染内容与原内联实现逐字一致(byte-perfect),仅多一层纯透传组件;kill-switch=chartSCU 关。
		return <DunJiaBoard pan={pan} boardScale={this.calcBoardScale()} />;
	}

	renderInputPanel(){
		const opt = this.state.options;
		const showPatternInterpretation = this.state.showPatternInterpretation !== false;
		const fields = this.state.localFields || this.props.fields || {};
		let datetm = new DateTime();
		if(fields.date && fields.time){
			const str = `${fields.date.value.format('YYYY-MM-DD')} ${fields.time.value.format('HH:mm:ss')}`;
			datetm = datetm.parse(str, 'YYYY-MM-DD HH:mm:ss');
			if(fields.zone){
				datetm.setZone(fields.zone.value);
			}
		}
		return (
			<div className="horosa-dunjia-input-stack">
				<div className="horosa-side-panel-heading">
					<div>
						<div className="horosa-side-panel-title">遁甲设置</div>
						<div className="horosa-side-panel-subtitle">时间、地点与起盘选项</div>
					</div>
				</div>
				{/* [观象P1] 遁甲左栏两段式:时间地点(不折叠)/起盘选项(折叠记忆);内容结构零变 */}
				<XQSideSection iconName={sideSectionIcon('time')} title="时间与地点" collapsible={false}>
				<SpaceTimePanel
					fields={fields}
					value={datetm}
					onTimeChange={this.onTimeChanged}
					timeHook={this.timeHook}
					onGeoChange={this.changeGeo}
				/>
				</XQSideSection>
				<XQSideSection iconName={sideSectionIcon('switches')} title="起盘选项" storageKey="dunjia.options" className="horosa-side-input-section">
				<div className="horosa-side-fields-inner">
					<div className="horosa-dunjia-select-grid">
						<label className="horosa-dunjia-select-field">
							<span>排盘</span>
							<Select size="small" value={opt.paiPanType} onChange={(v)=>this.onOptionChange('paiPanType', v)}>
								{PAIPAN_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-dunjia-select-field">
							<span>起局</span>
							<Select
								size="small"
								value={opt.paiPanType === 3 ? opt.qijuMethod : (opt.qijuMethod === 'shuzi' ? 'shuzi' : 'zhirun')}
								onChange={(v)=>this.onOptionChange('qijuMethod', v)}
							>
								{(opt.paiPanType === 3 ? QIJU_METHOD_OPTIONS : QIJU_METHOD_NONSHI_OPTIONS).map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-dunjia-select-field">
							<span>盘式</span>
							<Select size="small" value={opt.school || '转盘'} onChange={(v)=>this.onOptionChange('school', v)}>
								{SCHOOL_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						{opt.qijuMethod === 'shuzi' ? (
							<label className="horosa-dunjia-select-field is-wide">
								<span>报数</span>
								<input
									value={opt.shuziReportNumber || ''}
									onChange={(e)=>this.onOptionChange('shuziReportNumber', e.target.value)}
									placeholder="阴盘起局:输入报数(各位求和÷9定局,余0作9)"
									inputMode="numeric"
									style={{ flex: 1, minWidth: 120, padding: '2px 8px', borderRadius: 6, border: '1px solid var(--horosa-border, #d9d9d9)', background: 'var(--horosa-surface-solid, #fff)', color: 'var(--horosa-text, #262626)' }}
								/>
							</label>
						) : null}
						<label className="horosa-dunjia-select-field">
							<span>盘类</span>
							<Select size="small" value={this.state.chartCategory} onChange={this.onChartCategoryChange}>
								{CHART_CATEGORY_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-dunjia-select-field">
							<span>月家</span>
							<Select size="small" value={opt.yueJiaQiJuType} disabled={opt.paiPanType !== 1} onChange={(v)=>this.onOptionChange('yueJiaQiJuType', v)}>
								{YUEJIA_QIJU_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-dunjia-select-field">
							<span>值使</span>
							<Select size="small" value={opt.zhiShiType} onChange={(v)=>this.onOptionChange('zhiShiType', v)}>
								{ZHISHI_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-dunjia-select-field">
							<span>空亡</span>
							<Select size="small" value={opt.kongMode} onChange={(v)=>this.onOptionChange('kongMode', v)}>
								{KONG_MODE_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-dunjia-select-field">
							<span>驿马</span>
							<Select size="small" value={opt.yimaMode} onChange={(v)=>this.onOptionChange('yimaMode', v)}>
								{MA_MODE_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-dunjia-select-field">
							<span>性别</span>
							<Select size="small" value={opt.sex} onChange={this.onGenderChange}>
								{SEX_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-dunjia-select-field">
							<span>移星</span>
							<Select size="small" value={opt.shiftPalace} onChange={(v)=>this.onOptionChange('shiftPalace', v)}>
								{YIXING_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-dunjia-select-field">
							<span>日界</span>
							<Select size="small" value={opt.after23NewDay} onChange={(v)=>this.onOptionChange('after23NewDay', v)}>
								{DAY_SWITCH_OPTIONS.map((item)=><Option key={`day_switch_${item.value}`} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-dunjia-select-field">
							<span>时间算法</span>
							<Select size="small" value={normalizeTimeAlg(opt.timeAlg)} onChange={(v)=>this.onOptionChange('timeAlg', v)}>
								{TIME_ALG_OPTIONS.map((item)=><Option key={`time_alg_${item.value}`} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-dunjia-select-field">
							<span>封局</span>
							<Select size="small" value={opt.fengJu ? 1 : 0} onChange={(v)=>this.onOptionChange('fengJu', v === 1)}>
								{FENGJU_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<div className="horosa-dunjia-toggle-field">
							<span>格局释义</span>
							<Button
								type={showPatternInterpretation ? 'primary' : 'default'}
								onClick={()=>{
									const next = !showPatternInterpretation;
									this.setState({ showPatternInterpretation: next });
									savePatternInterpretationPreference(next);
								}}
							>
								{showPatternInterpretation ? '显示' : '隐藏'}
							</Button>
						</div>
						<div className="horosa-dunjia-toggle-field">
							<span>设置</span>
							<Button onClick={()=>this.setState({ showSettings: true })}>传本设置</Button>
						</div>
						<Modal
							title="奇门·传本设置(手动自定义)"
							open={!!this.state.showSettings}
							onOk={()=>this.setState({ showSettings: false })}
							onCancel={()=>this.setState({ showSettings: false })}
							okText="完成"
							cancelText="关闭"
							width={380}
						>
							<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
								<label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
									<span style={{ fontSize: 12, color: 'var(--horosa-muted, #8c8c8c)' }}>置闰天数(超神接气置闰法·传本差异)</span>
									<Select size="small" value={opt.zhirunLeapDays || 9} onChange={(v)=>this.onOptionChange('zhirunLeapDays', v)}>
										{ZHIRUN_LEAP_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
									</Select>
								</label>
								<div style={{ fontSize: 11, color: 'var(--horosa-muted, #8c8c8c)', lineHeight: 1.6 }}>仅影响「置闰」起局法;默认「大于9天」为本仓口径。改后中间盘与右栏信息即时按所选重算。</div>
							</div>
						</Modal>
						<label className="horosa-dunjia-select-field is-wide">
							<span>相关人员</span>
							<Select
								size="small"
								mode="multiple"
								allowClear
								value={(this.state.faRelatedPeople || []).map((p)=>p.cid)}
								placeholder="从命盘库选择（可多人，护其生年干）"
								optionFilterProp="label"
								onChange={this.onRelatedPeopleChange}
							>
								{this.getRelatedPeopleOptions().map((item)=><Option key={item.value} value={item.value} label={item.label}>{item.label}</Option>)}
							</Select>
						</label>
					</div>
					<div className="horosa-dunjia-action-row">
						<Button type="primary" onClick={this.clickPlot} loading={this.state.loading} disabled={this.state.loading}>起盘</Button>
						<Button onClick={this.clickSaveCase}>保存</Button>
					</div>
				</div>
				</XQSideSection>
			</div>
		);
	}

	renderJieHuaPanel(pan){
		if(!pan){
			return <Card size='small'><div style={{ color: 'var(--horosa-muted, #8c8c8c)' }}>请先起盘后查看化解。</div></Card>;
		}
		const DANGER_DOT = { 击刑: '#cf1322', 入墓: '#8b5e3c', 庚: '#d4380d', 白虎: '#a8071a', 门迫: '#fa8c16', 空亡: '#2f54eb' };
		const soft = 'var(--horosa-text-soft, #595959)';
		const muted = 'var(--horosa-muted, #8c8c8c)';
		const border = 'var(--horosa-border, #f0f0f0)';
		const dangers = computeDangers(pan);
		const jieHua = buildJieHua(pan);
		const protect = computeProtect(pan, { topic: this.state.faAskTopic || 'shexin', chartCategory: this.state.chartCategory });
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
						<div key={`hz_${i}`} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '6px 0', borderTop: i ? `1px solid ${border}` : 'none' }}>
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
						<Card size='small' style={{ marginBottom: 8, borderRadius: 8, borderLeft: `3px solid ${col}` }} key={`jh_${i}`}>
							<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
								<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, flexWrap: 'wrap' }}>
									{c.dangers.map((d, k)=>(<span key={`db_${k}`} style={{ display: 'inline-flex' }}>{badge(d.oneChar, DANGER_DOT[d.type])}</span>))}
									<span style={{ fontWeight: 600, color: col }}>{c.palaceName}{LUOSHU_NUM[c.palaceName]}宫<span style={{ color: muted, fontWeight: 400, fontSize: 12 }}> · {c.direction} · {c.deg}</span></span>
								</span>
								<Tag style={{ marginRight: 0, flex: '0 0 auto' }}>天盘干「{c.tianGan}」</Tag>
							</div>
							<div style={{ color: soft, lineHeight: '22px' }}>
								{c.mie.length ? (
									<div style={{ marginBottom: 4 }}><span style={{ color: muted }}>① 灭象（先移走）</span>
										{c.mie.map((m, k)=>(<div key={`mie_${k}`} style={{ paddingLeft: 20 }}>· {m}</div>))}
									</div>
								) : null}
								{c.placements.length ? (
									<div style={{ marginBottom: 4 }}><span style={{ color: muted }}>② 布阵（再放上）</span>
										{c.placements.map((p, k)=>(<div key={`pl_${k}`} style={{ paddingLeft: 20 }}><span style={{ color: '#2e7d32', fontWeight: 600 }}>{p.where}</span>　{p.text}</div>))}
									</div>
								) : null}
								<div style={{ display: 'flex', alignItems: 'flex-start' }}><span style={{ color: muted, flex: '0 0 auto' }}>③ 时机　</span><span>本宫 {c.benZhi}日 / {c.ben}<br />对宫 {c.duiZhi}日 / {c.dui}</span></div>
								{c.notes.map((n, k)=>(<div key={`nt_${k}`} style={{ color: muted, fontSize: 12, marginTop: 2 }}>※ {n}</div>))}
							</div>
						</Card>
					);
				})}
				<Card size='small' style={{ marginBottom: 8, borderRadius: 8 }}>
					<div style={{ fontWeight: 600, marginBottom: 6 }}>解局三法（逆天程度递增）</div>
					<div style={{ color: soft, lineHeight: '22px' }}>
						{SAN_FA_TEXT.map((f, i)=>(<div key={`sf_${i}`}><span style={{ fontWeight: 600 }}>{f.name}</span><span style={{ color: muted }}>（{f.scope}）</span>　{f.desc}</div>))}
					</div>
				</Card>
				<Card size='small' style={{ marginBottom: 8, borderRadius: 8 }}>
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
						<span style={{ fontWeight: 600 }}>八门化气大阵 · 必护天干</span>
						<Tag color='geekblue' style={{ marginRight: 0 }}>{protect.filter((r)=>r.palaceNum && !r.ok).length} 处需护</Tag>
					</div>
					<div style={{ color: muted, fontSize: 12, marginBottom: 6 }}>先离刑墓庚（主），再离虎迫空（次）；天干往高处放、地支往低处放。下列天干勿落六害宫、勿受克。</div>
					{protect.map((r, i)=>(
						<div key={`pr_${i}`} style={{ lineHeight: '22px', padding: '3px 0', borderTop: i ? `1px solid ${border}` : 'none' }}>
							<span style={{ fontWeight: 600 }}>{r.label}{r.gan ? `「${r.gan}」` : ''}</span>
							<span style={{ color: soft }}>：{r.palaceNum ? `${r.palaceName}${LUOSHU_NUM[r.palaceName]}宫·${r.direction}` : '局中未现'}</span>
							{r.hazards.length ? <Tag color='red' style={{ marginLeft: 6 }}>{r.hazards.join('/')}</Tag> : (r.palaceNum ? <Tag color='green' style={{ marginLeft: 6 }}>平稳</Tag> : null)}
							<div style={{ color: muted, fontSize: 12, paddingLeft: 2 }}>{r.advice}</div>
						</div>
					))}
					<div style={{ color: muted, fontSize: 12, marginTop: 8, paddingTop: 6, borderTop: `1px solid ${border}` }}>
						<div style={{ marginBottom: 2 }}>※「生年干」指<strong>局中所有相关人</strong>（本人 / 家人 / 牵涉者）的出生年天干，都不能落刑墓——此处仅按本盘年干示例，其余请按各人属相或八字年干自行加护。</div>
						{BU_ZHEN_TIPS.map((t, i)=>(<div key={`bz_${i}`}>· {t}</div>))}
					</div>
				</Card>
				<Card size='small' style={{ marginBottom: 8, borderRadius: 8 }}>
					<div style={{ fontWeight: 600, marginBottom: 6 }}>干支形象表（造象参考）</div>
					<div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 12, rowGap: 2, color: soft, lineHeight: '22px', fontSize: 13 }}>
						{Object.keys(GAN_XIANG).map((g)=>(<span key={`gx_${g}`}><span style={{ fontWeight: 600 }}>{g}</span>　{GAN_XIANG[g].color}·{GAN_XIANG[g].material}（{GAN_XIANG[g].branch}{ZHI_ZODIAC[GAN_XIANG[g].branch]}）</span>))}
					</div>
				</Card>
				<Card size='small' style={{ borderRadius: 8 }}>
					<div style={{ fontWeight: 600, marginBottom: 6 }}>换局 / 移星</div>
					<div style={{ color: soft, lineHeight: '22px' }}>局太差、改不动时可整盘换局＝左栏「移星」顺转宫位（移即催）。转两三个重点宫为宜，勿全转。</div>
				</Card>
			</div>
		);
	}

	renderYongShenPanel(pan){
		const soft = 'var(--horosa-text-soft, #595959)';
		const muted = 'var(--horosa-muted, #8c8c8c)';
		const topic = this.state.faAskTopic || loadFaAskTopic();
		const setTopic = (k)=>{ this.setState({ faAskTopic: k }); saveFaAskTopic(k); };
		const hazardTag = (it)=>{
			if(!it || !it.palaceNum){ return <Tag color='default' style={{ marginRight: 0 }}>未现</Tag>; }
			return it.hazards && it.hazards.length ? <Tag color='red' style={{ marginRight: 0 }}>{it.hazards.join('/')}</Tag> : <Tag color='green' style={{ marginRight: 0 }}>平稳</Tag>;
		};
		const locLine = (label, it, extra)=>(
			<div key={`loc_${label}`} style={{ lineHeight: '24px' }}>
				<span style={{ fontWeight: 600 }}>{label}</span>
				{it && it.symbol ? <span style={{ color: soft }}>（{it.symbol}）</span> : null}
				<span style={{ color: soft }}>：{it && it.palaceNum ? `${it.palaceName}${LUOSHU_NUM[it.palaceName]}宫·${it.direction}` : '局中未现'}</span>
				{' '}{hazardTag(it)}
				{extra ? <span style={{ color: muted }}> {extra}</span> : null}
			</div>
		);
		const topicBtns = (
			<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
				{FA_ASK_TOPICS.map((t)=>(
					<Button key={`ft_${t.key}`} size='small' shape='round' type={topic === t.key ? 'primary' : 'default'} onClick={()=>setTopic(t.key)}>{t.label}</Button>
				))}
			</div>
		);
		const shuzi = computeShuziYongShenGong(this.state.shuziInput);
		const shuziCard = (
			<Card size='small' style={{ marginBottom: 8, borderRadius: 8 }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
					<span style={{ fontWeight: 600 }}>数字报数</span>
					<input
						value={this.state.shuziInput}
						onChange={(e)=>this.setState({ shuziInput: e.target.value })}
						placeholder="报数(可多位/手机号)"
						inputMode="numeric"
						style={{ flex: 1, minWidth: 120, padding: '2px 8px', borderRadius: 6, border: '1px solid var(--horosa-border, #d9d9d9)', background: 'var(--horosa-surface-solid, #fff)', color: 'var(--horosa-text, #262626)' }}
					/>
				</div>
				{shuzi ? (
					<div style={{ marginTop: 6, color: soft, lineHeight: '22px' }}>
						数字和 {shuzi.sum} ÷9 余 → 用神宫 <span style={{ fontWeight: 700, color: 'var(--horosa-text, #262626)' }}>{shuzi.gong}宫</span>
						{this.renderQimenHoverInline('palace', shuzi.gua, <span style={{ fontWeight: 600, margin: '0 4px' }}>{shuzi.gua}</span>, 'shuzi_gua')}
						<span style={{ color: muted }}>{shuzi.direction}</span>
						<div style={{ color: muted, fontSize: 12, marginTop: 2 }}>除9取余(余0作9)定用神宫,再看该宫卦象/方位/类象断事。各家规则有别(通则),精确依所宗课本。</div>
					</div>
				) : (
					<div style={{ marginTop: 6, color: muted, fontSize: 12 }}>输入所报之数 → 除9取余(余0作9)定用神宫。各家规则有别,此为通则。</div>
				)}
			</Card>
		);
		if(!pan){
			return <div>{topicBtns}{shuziCard}<Card size='small'><div style={{ color: muted }}>请先起盘后查看用神分论。</div></Card></div>;
		}
		const ys = computeYongShen(pan, { faceToFace: true, chartCategory: this.state.chartCategory });
		const guGua = computeGuGua(pan);
		const cellOf = (p)=>(pan.cells || []).find((c)=>c.palaceNum === p) || {};
		const yongShenCard = (
			<Card size='small' style={{ marginBottom: 8, borderRadius: 8 }}>
				<div style={{ fontWeight: 600, marginBottom: 6 }}>用神定位</div>
				<div style={{ color: soft, lineHeight: '22px', marginBottom: 6 }}>{ys.yongShenText}</div>
				{locLine(`日干·${ys.dayRole}`, ys.dayGan)}
				{locLine(`时干·${ys.timeRole}`, ys.timeGan)}
				{ys.ganHe ? locLine('干合·配偶/理想型', ys.ganHe) : null}
				{locLine('值符·话语权', ys.zhiFu)}
				{locLine('值使·用武之地', ys.zhiShi)}
				<div style={{ color: muted, marginTop: 4 }}>六亲：{ys.liuQin.map((r)=>`${r.rel.split('·')[1]}(${r.symbol}${r.palaceNum ? r.palaceName + LUOSHU_NUM[r.palaceName] + '宫' : '未现'})`).join('　')}</div>
			</Card>
		);
		let topicCard = null;
		if(topic === 'shexin'){
			const renderCellSymbols = (p)=>{
				const c = cellOf(p);
				if(!c.palaceNum){ return <span style={{ color: muted }}>未现</span>; }
				return (
					<span>
						{this.renderQimenHoverInline('stem', c.tianGan, <span style={{ color: 'var(--horosa-text, #262626)', fontWeight: 600 }}>{c.tianGan}</span>, `sx_t_${p}`)}{' '}
						{this.renderQimenHoverInline('god', c.god, <span>{c.god}</span>, `sx_g_${p}`)}{' '}
						{this.renderQimenHoverInline('door', c.door, <span>{c.door}门</span>, `sx_d_${p}`)}{' '}
						{this.renderQimenHoverInline('star', c.tianXing, <span>{c.tianXing}</span>, `sx_s_${p}`)}{' '}
						{this.renderQimenHoverInline('stem', c.diGan, <span style={{ color: muted }}>{c.diGan}(地)</span>, `sx_dg_${p}`)}
					</span>
				);
			};
			topicCard = (
				<Card size='small' style={{ borderRadius: 8 }}>
					<div style={{ fontWeight: 600, marginBottom: 6 }}>识破人心（日干{ys.dayRole} / 时干{ys.timeRole}）</div>
					<div style={{ color: soft, lineHeight: '24px' }}>
						<div>{ys.dayRole}·日干宫（{ys.dayGan.palaceName}{ys.dayGan.palaceNum}）：{renderCellSymbols(ys.dayGan.palaceNum)}</div>
						<div style={{ marginTop: 4 }}>{ys.timeRole}·时干宫（{ys.timeGan.palaceName}{ys.timeGan.palaceNum}）：{renderCellSymbols(ys.timeGan.palaceNum)}</div>
						<div style={{ color: muted, marginTop: 6 }}>悬浮各符号看取象，叠加成性格画像。</div>
					</div>
				</Card>
			);
		}else if(topic === 'wealth'){
			const w = computeWealth(pan);
			topicCard = (
				<Card size='small' style={{ borderRadius: 8 }}>
					<div style={{ fontWeight: 600, marginBottom: 6 }}>财富七要</div>
					<div style={{ color: soft }}>
						{w.items.map((it)=>locLine(it.name, it, it.note))}
						<div style={{ lineHeight: '24px' }}><span style={{ fontWeight: 600 }}>月令</span>：{w.month.zhi}（{w.month.wuxing}）{w.month.relation ? <Tag color='gold' style={{ marginLeft: 4 }}>{w.month.relation}</Tag> : null}</div>
						<div style={{ lineHeight: '24px' }}><span style={{ fontWeight: 600 }}>干财</span>：{w.ganCai.length ? w.ganCai.map((c)=>`${c.src}${c.symbol}(${c.palaceNum ? c.palaceName + LUOSHU_NUM[c.palaceName] + '宫' : '未现'}${c.hazards && c.hazards.length ? '·' + c.hazards.join('/') : ''})`).join('　') : '—'}</div>
						<div style={{ color: muted, marginTop: 4, fontSize: 12 }}>{w.industryHint}</div>
					</div>
				</Card>
			);
		}else if(topic === 'career'){
			const c = computeCareer(pan);
			topicCard = (
				<Card size='small' style={{ borderRadius: 8 }}>
					<div style={{ fontWeight: 600, marginBottom: 6 }}>事业七要</div>
					<div style={{ color: soft }}>
						{c.items.map((it)=>locLine(it.name, it, it.note))}
						{c.fuShi.map((r)=>locLine(r.rel, r))}
						<div style={{ color: muted, marginTop: 4 }}>诸干：{c.zhuGan.map((r)=>`${r.rel.split('·')[1]}(${r.symbol}${r.palaceNum ? r.palaceName + LUOSHU_NUM[r.palaceName] + '宫' : '未现'})`).join('　')}</div>
						<div style={{ color: muted, marginTop: 4, fontSize: 12 }}>{c.industryHint}</div>
					</div>
				</Card>
			);
		}else if(topic === 'romance'){
			const r = computeRomance(pan);
			topicCard = (
				<Card size='small' style={{ borderRadius: 8 }}>
					<div style={{ fontWeight: 600, marginBottom: 6 }}>恋爱姻缘</div>
					<div style={{ color: soft }}>
						{r.zhengYuan.map((z)=>locLine(z.name, z))}
						<div style={{ lineHeight: '24px' }}><span style={{ fontWeight: 600 }}>三奇·桃花</span>：{r.taoHua.sanQi.map((s)=>`${s.gan}(${s.palaceNum ? s.palaceName + LUOSHU_NUM[s.palaceName] + '宫' : '未现'})`).join('　')}</div>
						<div style={{ lineHeight: '24px' }}><span style={{ fontWeight: 600 }}>沐浴位</span>：{r.taoHua.muYu.zhi}（{r.taoHua.muYu.palaceNum ? r.taoHua.muYu.palaceName + LUOSHU_NUM[r.taoHua.muYu.palaceName] + '宫·' + r.taoHua.muYu.direction : '—'}）</div>
						<div style={{ marginTop: 6, color: muted, fontSize: 12 }}>{r.zhanTaoHua}</div>
						<div style={{ marginTop: 6 }}><span style={{ fontWeight: 600 }}>情感不顺</span>：{r.trouble.length ? r.trouble.map((t, i)=>(<div key={`tr_${i}`} style={{ color: muted }}>· {t}</div>)) : <span style={{ color: muted }}>无明显凶象</span>}</div>
					</div>
				</Card>
			);
		}
		const guGuaCard = guGua.length ? (
			<Card size='small' style={{ marginTop: 8, borderRadius: 8 }}>
				<div style={{ fontWeight: 600, marginBottom: 6 }}>解孤辰寡宿</div>
				<div style={{ color: soft, lineHeight: '24px' }}>
					{guGua.map((g, i)=>(<div key={`gg_${i}`}>{g.name}（{g.zhi}）：{g.jie}</div>))}
				</div>
			</Card>
		) : null;
		const yongShenRefCard = (
			<Card size='small' style={{ marginTop: 8, borderRadius: 8 }}>
				<details>
					<summary style={{ cursor: 'pointer', fontWeight: 600, listStyle: 'revert' }}>用神取用速查<span style={{ color: muted, fontWeight: 400, marginLeft: 6, fontSize: 12 }}>一事一测·先定用神(参考字典)</span></summary>
					<div style={{ marginTop: 8 }}>
						<div style={{ fontWeight: 600, color: soft, marginBottom: 4 }}>基本用神</div>
						{QIMEN_YONGSHEN_BASIC.map((r, i)=>(
							<div key={`ysb_${i}`} style={{ lineHeight: '22px' }}><span style={{ fontWeight: 600 }}>{r[0]}</span><span style={{ color: muted }}>：{r[1]}</span></div>
						))}
						<div style={{ fontWeight: 600, color: soft, margin: '8px 0 4px' }}>分类取用</div>
						<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, lineHeight: '18px' }}>
							<thead><tr style={{ color: muted }}><th style={{ textAlign: 'left', padding: '2px 4px' }}>所测</th><th style={{ textAlign: 'left', padding: '2px 4px' }}>主用神</th><th style={{ textAlign: 'left', padding: '2px 4px' }}>辅看</th></tr></thead>
							<tbody>
								{QIMEN_YONGSHEN_LOOKUP.map((r, i)=>(
									<tr key={`ysl_${i}`} style={{ borderTop: '1px solid var(--horosa-border, #f0f0f0)' }}>
										<td style={{ padding: '2px 4px', fontWeight: 600, whiteSpace: 'nowrap' }}>{r[0]}</td>
										<td style={{ padding: '2px 4px' }}>{r[1]}</td>
										<td style={{ padding: '2px 4px', color: muted }}>{r[2]}</td>
									</tr>
								))}
							</tbody>
						</table>
						<div style={{ fontWeight: 600, color: soft, margin: '8px 0 4px' }}>取用生克(断成败)</div>
						{QIMEN_YONGSHEN_SHENGKE.map((r, i)=>(
							<div key={`yss_${i}`} style={{ lineHeight: '22px' }}><span style={{ fontWeight: 600 }}>{r[0]}</span><span style={{ color: muted }}>：{r[1]}</span></div>
						))}
						<div style={{ color: muted, fontSize: 12, marginTop: 6 }}>断成败核心:看用神之间(日干vs时干、日干vs用事门)生克——生我合我者成、克我冲我者败,再叠旺衰格局。</div>
					</div>
				</details>
			</Card>
		);
		return <div>{topicBtns}{shuziCard}{yongShenCard}{topicCard}{guGuaCard}{yongShenRefCard}</div>;
	}

	renderRight(){
		const pan = this.state.pan;
		const opt = this.state.options;
		const validPanelTabs = ['overview', 'shensha', 'bagong', 'jiehua', 'yongshen'];
		const panelTab = validPanelTabs.indexOf(this.state.rightPanelTab) >= 0 ? this.state.rightPanelTab : 'overview';
		const bagongPalace = BAGONG_PALACE_NAME[this.state.bagongPalace] ? this.state.bagongPalace : BAGONG_PALACE_ORDER[0];
		const bagongData = buildQimenBaGongPanelData(pan, bagongPalace);
		const fushiYiGua = buildQimenFuShiYiGua(pan);
		const timeInfo = getBoardTimeInfo(pan);
		const showPatternInterpretation = this.state.showPatternInterpretation !== false;
		const fields = this.state.localFields || this.props.fields || {};
		let datetm = new DateTime();
		if(fields.date && fields.time){
			const str = `${fields.date.value.format('YYYY-MM-DD')} ${fields.time.value.format('HH:mm:ss')}`;
			datetm = datetm.parse(str, 'YYYY-MM-DD HH:mm:ss');
			if(fields.zone){
				datetm.setZone(fields.zone.value);
			}
		}
		return (
			<div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
				<div style={{ display: 'none', paddingBottom: 6, borderBottom: '1px solid var(--horosa-border, #f0f0f0)' }}>
					<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
						<div>
							<PlusMinusTime value={datetm} onChange={this.onTimeChanged} hook={this.timeHook} confirmOnAdjust />
						</div>

						<div style={{ display: 'flex', gap: 4 }}>
							<div style={{ flex: 1 }}>
								<Select size="small" value={opt.kongMode} onChange={(v)=>this.onOptionChange('kongMode', v)} style={{ width: '100%' }}>
									{KONG_MODE_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
								</Select>
							</div>
							<div style={{ flex: 1 }}>
								<Select size="small" value={opt.yimaMode} onChange={(v)=>this.onOptionChange('yimaMode', v)} style={{ width: '100%' }}>
									{MA_MODE_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
								</Select>
							</div>
							<div style={{ flex: 1 }}>
								<Select size="small" value={opt.qijuMethod} disabled={[3, 4, 5].indexOf(opt.paiPanType) < 0} onChange={(v)=>this.onOptionChange('qijuMethod', v)} style={{ width: '100%' }}>
									{QIJU_METHOD_OPTIONS.map((item)=><Option key={item.value} value={item.value} disabled={(item.value === 'maoshan' || item.value === 'wurun') && [4, 5].indexOf(opt.paiPanType) >= 0}>{item.label}</Option>)}
								</Select>
							</div>
							<div style={{ flex: 1 }}>
								<Select size="small" value={opt.sex} onChange={this.onGenderChange} style={{ width: '100%' }}>
									{SEX_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
								</Select>
							</div>
							<div style={{ flex: 1 }}>
								<Select size="small" value={opt.shiftPalace} onChange={(v)=>this.onOptionChange('shiftPalace', v)} style={{ width: '100%' }}>
									{YIXING_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
								</Select>
							</div>
						</div>

						<div style={{ display: 'flex', gap: 4 }}>
							<div style={{ flex: 1 }}>
								<Select size="small" value={opt.paiPanType} onChange={(v)=>this.onOptionChange('paiPanType', v)} style={{ width: '100%' }}>
									{PAIPAN_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
								</Select>
							</div>
							<div style={{ flex: 1.45 }}>
								<Select size="small" value={opt.yueJiaQiJuType} disabled={opt.paiPanType !== 1} onChange={(v)=>this.onOptionChange('yueJiaQiJuType', v)} style={{ width: '100%' }}>
									{YUEJIA_QIJU_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
								</Select>
							</div>
						</div>

						<div style={{ display: 'flex', gap: 4 }}>
							<div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
								<Select size="small" value={opt.after23NewDay} onChange={(v)=>this.onOptionChange('after23NewDay', v)} style={{ width: '100%' }}>
									{DAY_SWITCH_OPTIONS.map((item)=><Option key={`day_switch_${item.value}`} value={item.value}>{item.label}</Option>)}
								</Select>
								<div style={{ display: 'flex', gap: 4 }}>
									<Button
										size="small"
										type={showPatternInterpretation ? 'primary' : 'default'}
										style={{ flex: 1 }}
										onClick={()=>{
											const next = !showPatternInterpretation;
											this.setState({ showPatternInterpretation: next });
											savePatternInterpretationPreference(next);
										}}
									>
										释义：{showPatternInterpretation ? '是' : '否'}
									</Button>
									<div style={{ flex: 1 }}>
										<Select size="small" value={normalizeTimeAlg(opt.timeAlg)} onChange={(v)=>this.onOptionChange('timeAlg', v)} style={{ width: '100%' }}>
											{TIME_ALG_OPTIONS.map((item)=><Option key={`time_alg_${item.value}`} value={item.value}>{item.label}</Option>)}
										</Select>
									</div>
									<div style={{ flex: 1 }}>
										<GeoCoordModal onOk={this.changeGeo} lat={fields.gpsLat && fields.gpsLat.value} lng={fields.gpsLon && fields.gpsLon.value}>
											<Button size="small" style={{ width: '100%' }}>经纬度选择</Button>
										</GeoCoordModal>
									</div>
								</div>
							</div>
							<div style={{ flex: 1 }}>
								<Select size="small" value={opt.fengJu ? 1 : 0} onChange={(v)=>this.onOptionChange('fengJu', v === 1)} style={{ width: '100%' }}>
									{FENGJU_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
								</Select>
							</div>
							<div style={{ flex: 1 }}>
								<Button
									size="small"
									type="primary"
									style={{ width: '100%' }}
									onClick={this.clickPlot}
									loading={this.state.loading}
									disabled={this.state.loading}
								>
									起盘
								</Button>
							</div>
							<div style={{ flex: 1 }}>
								<Button size="small" style={{ width: '100%' }} onClick={this.clickSaveCase}>保存</Button>
							</div>
						</div>
						<div style={{ textAlign: 'right' }}>
							<span>{fields.lon ? fields.lon.value : ''} {fields.lat ? fields.lat.value : ''}</span>
						</div>
					</div>
				</div>

				<Tabs
					className="horosa-dunjia-tabs"
					activeKey={panelTab}
					onChange={(key)=>this.setState({ rightPanelTab: key })}
					style={{ marginTop: 8 }}
				>
					{/* horosa_freeze_subtabs_v1:右栏 5 面板 keep-alive。原先每次父重渲(切时间/改选项/
					    点宫位/开关设置)都把「概览」的 buildQimenOverviewSummary、「神煞」的 Popover 阵、
					    「八宫」的 buildQimenBaGongPanelData、化解/用神 全部重跑一遍(用户只看得见其中一个)。
					    函数式 FreezeSubTab:非激活既不求值也不 reconcile;切回时拿本轮最新 children
					    立刻渲一帧 —— 不卸载、不重取、不闪烁、组件内部 state(滚动/展开)原样保留。 */}
					<TabPane tab="概览" key="overview">
						<FreezeSubTab active={panelTab === 'overview'}>{()=>(
						<>
						{(()=>{
							// 全局速览：一眼看出 值符值使落宫 / 贵格(三奇得使·九遁) / 六害源头 / 吉凶格品级。
							const sum = pan ? buildQimenOverviewSummary(pan) : null;
							if(!sum){ return null; }
							const HARM_TONE = { 击刑: '#b71c1c', 入墓: '#8b5e3c', 庚虎: '#c0392b', 门迫: '#d46b08', 空亡: '#2f54eb' };
							const chip = (text, color, k)=>(
								<span key={k || text} style={{ display: 'inline-block', padding: '0 8px', margin: '2px 5px 2px 0', borderRadius: 11, fontSize: 12, lineHeight: '20px', background: `${color}18`, color, border: `1px solid ${color}55` }}>{text}</span>
							);
							const harmRows = [
								{ key: '击刑', items: sum.sixHarm.jiXing },
								{ key: '入墓', items: sum.sixHarm.ruMu },
								{ key: '庚虎', items: sum.sixHarm.gengHu.map((g)=>`${g.label}·${g.palaceName}${g.dir}`) },
								{ key: '门迫', items: sum.sixHarm.menPo },
								{ key: '空亡', items: sum.sixHarm.kongWang },
							].filter((r)=>r.items && r.items.length);
							const goodCount = sum.ji.length + sum.dun.length + (sum.sanQiDeshi ? 1 : 0);
							return (
								<Card bordered={false} bodyStyle={{ padding: '10px 12px' }} style={{ marginBottom: 8 }}>
									<div style={{ fontWeight: 600, marginBottom: 6 }}>全局速览<span style={{ color: 'var(--horosa-muted, #8c8c8c)', fontWeight: 400, marginLeft: 6 }}>{pan.juText}</span></div>
									<div style={{ lineHeight: '24px' }}>
										<div><span style={{ color: 'var(--horosa-muted, #8c8c8c)' }}>值符</span> {sum.zhiFu.star}·{sum.zhiFu.palaceName}{sum.zhiFu.dir}　<span style={{ color: 'var(--horosa-muted, #8c8c8c)' }}>值使</span> {sum.zhiShi.door}·{sum.zhiShi.palaceName}{sum.zhiShi.dir}</div>
										{(sum.dun.length || sum.sanQiDeshi) ? (
											<div style={{ marginTop: 3 }}>
												<span style={{ color: 'var(--horosa-muted, #8c8c8c)' }}>贵格</span>{' '}
												{sum.sanQiDeshi ? chip(`三奇得使·${sum.sanQiDeshi.palaceName}${sum.sanQiDeshi.dir}`, '#2e7d32', 'sqds') : null}
												{sum.dun.map((d)=>chip(`${d.name}·${d.palaceName}${d.dir}`, '#2e7d32', `dun_${d.name}_${d.palace}`))}
											</div>
										) : null}
										{harmRows.length ? (
											<div style={{ marginTop: 3 }}>
												<span style={{ color: 'var(--horosa-muted, #8c8c8c)' }}>六害</span>{' '}
												{harmRows.map((r)=>chip(`${r.key} ${r.items.join('、')}`, HARM_TONE[r.key], `harm_${r.key}`))}
											</div>
										) : <div style={{ marginTop: 3, color: '#2e7d32' }}>六害：无（全局清和）</div>}
										<div style={{ marginTop: 3 }}>
											<span style={{ color: 'var(--horosa-muted, #8c8c8c)' }}>格局</span> 吉 {goodCount} · 凶 {sum.xiong.length}
											{sum.ji.slice(0, 5).map((g)=>chip(`${g.name}·${g.palaceName}`, '#558b2f', `ji_${g.name}_${g.palace}`))}
											{sum.xiong.slice(0, 5).map((g)=>chip(`${g.name}·${g.palaceName}`, '#b26a00', `xi_${g.name}_${g.palace}`))}
										</div>
									</div>
								</Card>
							);
						})()}
						<Card bordered={false} bodyStyle={{ padding: '10px 12px' }}>
							<div style={{ lineHeight: '26px' }}>
								<div>命式：{pan ? pan.options.sexLabel : '—'}</div>
								<div>起盘方式：{pan ? (pan.qimenModeLabel || pan.options.paiPanLabel || '—') : '—'}</div>
								<div>盘式：{pan ? (pan.options.schoolLabel || '—') : '—'}</div>
								<div>定局法：{pan ? (pan.options.dingFaLabel || pan.options.qijuMethodLabel || '—') : '—'}</div>
								{pan && pan.shuziInfo ? <div>报数：{pan.shuziInfo.digits}（和 {pan.shuziInfo.sum} → 用神宫 {pan.shuziInfo.gong}·{pan.shuziInfo.gua}{pan.shuziInfo.direction}）</div> : null}
								<div>符头：{pan ? pan.fuTou : '—'}</div>
								<div>节气：{pan ? pan.jieqiText : '—'}</div>
								<div>局数：{pan ? pan.juText : '—'}</div>
								<div>旬首：{pan ? pan.xunShou : '—'}</div>
								<div>{pan ? pan.options.kongModeLabel : '空亡'}：{pan ? pan.kongWang : '—'}</div>
								<div>值符：{pan ? pan.zhiFu : '—'}</div>
								<div>值使：{pan ? pan.zhiShi : '—'}</div>
								<div>奇门演卦：{pan ? (fushiYiGua.text || '无') : '—'}</div>
								<div>移星：{pan ? (pan.options.shiftLabel || '原宫') : '原宫'}</div>
								<div>换日：{pan ? (pan.options.daySwitchLabel || '23点算第二天') : (opt.after23NewDay === 1 ? '23点算第二天' : '24点算第二天')}</div>
								<div>时间算法：{pan ? (pan.options.timeAlgLabel || getTimeAlgLabel(opt.timeAlg)) : getTimeAlgLabel(opt.timeAlg)}</div>
								<div>奇门封局：{pan ? (pan.options.fengJuLabel || '未封局') : (opt.fengJu ? '已封局' : '未封局')}</div>
								<div>六仪击刑：{pan && pan.liuYiJiXing.length ? pan.liuYiJiXing.join('；') : '无'}</div>
								<div>奇仪入墓：{pan && pan.qiYiRuMu.length ? pan.qiYiRuMu.join('；') : '无'}</div>
								<div>门迫：{pan && pan.menPo && pan.menPo.list.length ? pan.menPo.list.join('；') : '无'}</div>
								<div>空亡宫：{pan && pan.kongWangDesc && pan.kongWangDesc.length ? pan.kongWangDesc.join('；') : '无'}</div>
								<div>{pan && pan.yiMa ? pan.yiMa.text : '日马：无'}</div>
								<div>农历：{pan ? pan.lunarText : '—'}</div>
								<div>直接时间：{timeInfo.clockHm}</div>
								<div>真太阳时：{timeInfo.solarHm}</div>
								<div>干支：{pan ? `年${pan.ganzhi.year} 月${pan.ganzhi.month} 日${pan.ganzhi.day} 时${pan.ganzhi.time}` : '—'}</div>
								<div>节气段：{pan ? (pan.jiedelta || '—') : '—'}</div>
							</div>
						</Card>
						{(()=>{
							const ws = pan ? buildQimenWangShuai(pan) : null;
							if(!ws || !ws.monthElem){ return null; }
							const tone = { 旺: '#2e7d32', 相: '#558b2f', 休: 'var(--horosa-text-soft, #8c8c8c)', 囚: '#b26a00', 死: '#b71c1c' };
							return (
								<Card bordered={false} bodyStyle={{ padding: '10px 12px' }} style={{ marginTop: 8 }}>
									<div style={{ fontWeight: 600, marginBottom: 6 }}>旺相休囚死<span style={{ color: 'var(--horosa-muted, #8c8c8c)', fontWeight: 400, marginLeft: 6 }}>月令 {ws.monthBranch}（{ws.monthElem}令）· 当令旺·我生相·生我休·克我囚·我克死</span></div>
									<div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 14, rowGap: 4, lineHeight: '22px' }}>
										{ws.palaces.map((p)=>(
											<div key={`ws_${p.palaceNum}`}>
												<span style={{ color: 'var(--horosa-muted, #8c8c8c)' }}>{p.palaceName}{p.palaceNum}：</span>
												<span>星{p.star}</span>
												<span style={{ color: tone[p.starWangShuai] || 'inherit', fontWeight: 600 }}>{p.starWangShuai || '—'}</span>
												<span style={{ color: 'var(--horosa-muted, #8c8c8c)', margin: '0 2px' }}>·</span>
												<span>门{p.door}</span>
												<span style={{ color: tone[p.doorWangShuai] || 'inherit', fontWeight: 600 }}>{p.doorWangShuai || '—'}</span>
											</div>
										))}
									</div>
								</Card>
							);
						})()}
						</>
						)}</FreezeSubTab>
					</TabPane>
					<TabPane tab="神煞" key="shensha">
						<FreezeSubTab active={panelTab === 'shensha'}>{()=>(
						<Card bordered={false} bodyStyle={{ padding: '10px 12px' }}>
							<div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', columnGap: 14, rowGap: 6, lineHeight: '24px' }}>
								{pan && pan.shenSha && pan.shenSha.allItems && pan.shenSha.allItems.length
									? pan.shenSha.allItems.map((item)=>{
										const doc = SHENSHA_DOC[item.name];
										const luckColor = doc && doc.luck === '吉' ? '#2e7d32' : (doc && doc.luck === '凶' ? '#b71c1c' : 'var(--horosa-text, #262626)');
										const node = (<div key={`ss_item_${item.name}`}><span style={{ color: luckColor, cursor: doc ? 'help' : 'default' }}>{item.name}-</span><span style={{ color: 'var(--horosa-muted, #8c8c8c)' }}>{item.value}</span></div>);
										if(!doc){ return node; }
										return (
											<Popover key={`ss_pop_${item.name}`} trigger="hover" placement="bottomLeft" content={<div style={{ maxWidth: 240 }}><div style={{ fontWeight: 600 }}>{item.name}（{doc.luck}）</div><div style={{ color: 'var(--horosa-text-soft, #595959)' }}>{doc.brief}</div></div>}>
												{node}
											</Popover>
										);
									})
									: <div>暂无神煞</div>}
							</div>
						</Card>
						)}</FreezeSubTab>
					</TabPane>
					<TabPane tab="八宫" key="bagong">
						<FreezeSubTab active={panelTab === 'bagong'}>{()=>(
						<Card bordered={false} bodyStyle={{ padding: '10px 12px' }}>
							<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
								{BAGONG_PALACE_ORDER.map((num)=>(
									<Button
										key={`bagong_btn_${num}`}
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
								<div>
									<Card size='small' style={{ marginBottom: 8 }}>
										<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
											<span style={{ fontWeight: 600 }}>奇门吉格</span>
											<Tag color='green'>{bagongData.jiPatterns.length}项</Tag>
										</div>
										<div style={{ color: 'var(--horosa-text-soft, #595959)', lineHeight: '22px', whiteSpace: 'pre-wrap' }}>
											{showPatternInterpretation
												? (bagongData.jiPatternDetails && bagongData.jiPatternDetails.length
													? bagongData.jiPatternDetails.map((text)=>`• ${text}`).join('\n')
													: '未命中')
												: (bagongData.jiPatterns.length ? bagongData.jiPatterns.join('、') : '未命中')}
										</div>
									</Card>
									<Card size='small' style={{ marginBottom: 8 }}>
										<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
											<span style={{ fontWeight: 600 }}>奇门凶格</span>
											<Tag color='volcano'>{bagongData.xiongPatterns.length}项</Tag>
										</div>
										<div style={{ color: 'var(--horosa-text-soft, #595959)', lineHeight: '22px', whiteSpace: 'pre-wrap' }}>
											{showPatternInterpretation
												? (bagongData.xiongPatternDetails && bagongData.xiongPatternDetails.length
													? bagongData.xiongPatternDetails.map((text)=>`• ${text}`).join('\n')
													: '未命中')
												: (bagongData.xiongPatterns.length ? bagongData.xiongPatterns.join('、') : '未命中')}
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
									<Card size='small'>
										<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
											<span style={{ fontWeight: 600 }}>八神加八门</span>
											<Tag color='geekblue'>{bagongData.godFull || '—'}</Tag>
										</div>
										<div style={{ color: 'var(--horosa-text-soft, #595959)', lineHeight: '22px', whiteSpace: 'pre-wrap' }}>
											{bagongData.godFull || '—'}加{bagongData.renDoor || '—'}门：{bagongData.godDoorText}
										</div>
									</Card>
									<Card size='small' style={{ marginTop: 8 }}>
										<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
											<span style={{ fontWeight: 600 }}>奇门演卦</span>
											<Tag color='cyan'>{bagongData.menFangYiGua || '无'}</Tag>
										</div>
										<div style={{ color: 'var(--horosa-text-soft, #595959)', lineHeight: '22px', whiteSpace: 'pre-wrap' }}>
											{bagongData.menFangYiGuaText || '无'}
										</div>
									</Card>
								</div>
							) : (
								<Card size='small'>
									<div style={{ color: 'var(--horosa-muted, #8c8c8c)' }}>请先起盘后查看八宫信息。</div>
								</Card>
							)}
						</Card>
						)}</FreezeSubTab>
					</TabPane>
					<TabPane tab="化解" key="jiehua">
						<FreezeSubTab active={panelTab === 'jiehua'}>{()=>(
						<Card bordered={false} bodyStyle={{ padding: '10px 12px' }}>
							{this.renderJieHuaPanel(pan)}
						</Card>
						)}</FreezeSubTab>
					</TabPane>
					<TabPane tab="用神" key="yongshen">
						<FreezeSubTab active={panelTab === 'yongshen'}>{()=>(
						<Card bordered={false} bodyStyle={{ padding: '10px 12px' }}>
							{this.renderYongShenPanel(pan)}
						</Card>
						)}</FreezeSubTab>
					</TabPane>
				</Tabs>
			</div>
		);
	}

	// 快捷栏契约:右栏 tab 镜像(概览/神煞/八宫)与释义开关(左栏已有)撤除,只留页面没有的动词。
	renderQuickDock(){
		return (
			<QuickDockBar
				page="dunjia"
				className="horosa-dunjia-quick-dock"
				hasResult={!!this.state.pan}
				primary={{ key: 'plot', label: '起局', disabled: this.state.loading, onClick: this.clickPlot }}
				extras={[
					{ key: 'nowPlot', label: '此刻起局', icon: 'quickTransit', needsResult: false, disabled: this.state.loading, onClick: ()=>this.clickPlotNow() },
				]}
				save={this.clickSaveCase}
				dispatch={this.props.dispatch}
			/>
		);
	}

	render(){
		let height = this.props.height ? this.props.height : 760;
		if(height === '100%'){
			height = '100%';
		}else{
			height = Number(height);
			height = Number.isFinite(height) && height > 0 ? height : 760;
		}
		const pageHeight = this.props.height ? '100%' : height;
		return (
			<div className="horosa-dunjia-page horosa-astro-redesign horosa-dunjia-redesign" style={{ height: pageHeight, minHeight: 0, overflow: 'hidden' }}>
				<div className="horosa-astro-layout horosa-astro-redesign-layout horosa-dunjia-redesign-layout">
					<Spin spinning={this.state.loading}>
						<div className="horosa-astro-redesign-grid horosa-dunjia-redesign-grid">
							<div className="horosa-astro-context-panel horosa-astro-input-panel horosa-dunjia-input-panel">
								{this.renderInputPanel()}
							</div>
							<div className="horosa-chart-stage horosa-chart-stage-redesign horosa-dunjia-chart-panel xq-chart-renderer xq-chart-renderer-qimen">
								<div ref={this.captureLeftBoardHost} className="horosa-dunjia-board-host">
									{this.renderBoard()}
								</div>
							</div>
							<div className="horosa-inspector-panel horosa-astro-content-panel horosa-dunjia-info-panel">
								<div className="horosa-side-panel-heading horosa-dunjia-info-heading">
									<div>
										<div className="horosa-side-panel-title">遁甲信息</div>
										<div className="horosa-side-panel-subtitle">概览、神煞与八宫详解</div>
									</div>
								</div>
								{this.renderRight()}
							</div>
						</div>
					</Spin>
					{this.renderQuickDock()}
				</div>
			</div>
		);
	}
}

// 用神取用速查的静态数据(基本用神 / 分类取用 / 取用生克),供「三式合一」遁甲页用神子tab复用同款表。
export {
	QIMEN_YONGSHEN_BASIC,
	QIMEN_YONGSHEN_LOOKUP,
	QIMEN_YONGSHEN_SHENGKE,
};

export default DunJiaMain;
