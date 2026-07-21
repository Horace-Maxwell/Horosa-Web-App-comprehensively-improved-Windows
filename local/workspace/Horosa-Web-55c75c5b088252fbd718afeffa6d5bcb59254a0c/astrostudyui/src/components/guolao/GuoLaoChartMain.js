import { Component, memo } from 'react';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { markPanelReady } from '../../utils/perfMark';
import { FreezeSubTab } from '../comp/FreezeInactive';
import { stepPrefetchEnabled } from '../../utils/perfFlags';
import { registerStepPrefetcher } from '../../utils/stepPrefetch';
import { safeLocalStorageSet } from '../../utils/safeStorage';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../utils/dayBoundary';
import { XQModal, XQTabs as Tabs } from '../xq-ui';
import XQIcon from '../xq-icons';
import * as Constants from '../../utils/constants';
import request from '../../utils/request';
import {randomStr,} from '../../utils/helper';
import * as AstroConst from '../../constants/AstroConst';
import DateTime from '../comp/DateTime';
import QuickDockBar from '../common/QuickDockBar';
import GuoLaoInput from './GuoLaoInput';
import { SU28_MODE_LABEL, EXALT_DEGREE as GL_EXALT_DEG, starDignityStatuses as glStarDignity, starMotionState as glStarMotion, starCombust as glStarCombust } from './guolaoData';
import { computeDongwei as glDongwei, computeTongxian as glTongxian } from './guolaoTransit';
import GuoLaoChart from './GuoLaoChart';
import GuoLaoMoiraPanel from './GuoLaoMoiraPanel';
import GuoLaoMoiraWheel, {
	moiraBuildLimitTable as buildLimitTable,
	moiraLifeDegree as lifeDegree,
	moiraGetZiGods,
	moiraCollectGods,
	moiraGodsFromRuleHits,
	moiraLongLifeCharFor,
} from './GuoLaoMoiraWheel';
import GuoLaoMoiraPickWheel from './GuoLaoMoiraPickWheel';
import GuoLaoQizhengWheel from './GuoLaoQizhengWheel';
import { GUOLAO_CHART_STYLE_MOIRA, GUOLAO_CHART_STYLE_PICK, GUOLAO_CHART_STYLE_QIZHENG, GUOLAO_LIFE_MODE_COTRANS, GUOLAO_LIFE_MODE_YUMAO, GUOLAO_NODE_MODE_NORTH_RAHU, getStoredGuolaoChartStyle, getStoredGuolaoLifeMode, getStoredGuolaoNodeMode, getStoredGuolaoSu28Mode, getStoredGuolaoAyanamsa, getStoredGuolaoDisplay, getStoredMoiraTransitGodsVisible, getStoredGuolaoTrueSolarTime, getStoredGuolaoNodeType, getStoredGuolaoLilithType, getStoredGuolaoBodyMode, getStoredGuolaoTuibianMethod, getStoredGuolaoGufaPrecess, getStoredGuolaoEqTropicalAnchor, normalizeGuolaoLifeMode, normalizeGuolaoNodeMode, setStoredGuolaoChartStyle, setStoredGuolaoLifeMode, setStoredGuolaoNodeMode, setStoredGuolaoSu28Mode, setStoredMoiraTransitGodsVisible, setStoredGuolaoDisplay, getStoredGuolaoElection, setStoredGuolaoElection, getStoredGuolaoEleLifeMode, setStoredGuolaoEleLifeMode, } from './GuoLaoChartStyle';
import { fetchKinastroQizheng, fetchMoiraQizhengRules, fetchQizhengElection, } from '../../services/qizheng';
import { getMagneticDeclination } from './electionGeomag';
import { GuoLaoElectionTable, GuoLaoElectionSearch } from './GuoLaoElectionTable';
import { saveModuleAISnapshot, saveModuleAISnapshotLazy, } from '../../utils/moduleAiSnapshot';
import * as AstroText from '../../constants/AstroText';
import * as SZConst from '../suzhan/SZConst';
import * as Su28Helper from '../su28/Su28Helper';

const TabPane = Tabs.TabPane;

const SIMPLE_TOKEN_MAP = {
	A: '日',
	B: '月',
	C: '水',
	D: '金',
	E: '火',
	F: '木',
	G: '土',
	H: '天王',
	I: '海王',
	J: '冥王',
	K: '北交',
	L: '南交',
	p: '福点',
	v: '暗月',
	w: '紫气',
	y: '凯龙',
	z: '月亮朔望点',
	Y: '月亮平均远地点',
	$: '月亮平均近地点',
	a: '白羊',
	b: '金牛',
	c: '双子',
	d: '巨蟹',
	e: '狮子',
	f: '处女',
	g: '天秤',
	h: '天蝎',
	i: '射手',
	j: '摩羯',
	k: '水瓶',
	l: '双鱼',
	0: '上升',
	1: '天顶',
	2: '天底',
	3: '下降',
	4: '谷神星',
	5: '智神星',
	6: '婚神星',
	7: '灶神星',
	8: '人龙星',
};

const MOIRA_QUICK_ACTIONS = [
	{key: 'patterns', label: '格局', icon: 'sideStyle'},
	{key: 'yearStars', label: '化曜', icon: 'quickPrimary'},
	{key: 'weakSolid', label: '虚实', icon: 'sideHouses'},
	{key: 'natalStars', label: '命曜', icon: 'sidePlanets'},
	{key: 'transitStars', label: '流曜', icon: 'quickTransit'},
	{key: 'aspects', label: '相位', icon: 'sideSwitch'},
	{key: 'gods', label: '神煞', icon: 'quickNote'},
];

const GUOLAO_ENGINE_STORAGE_KEY = 'horosa.guolao.engineMode';
const GUOLAO_KIN_OPTIONS_STORAGE_KEY = 'horosa.guolao.kinastroQizheng.options';

function getStoredGuolaoEngineMode(){
	try{
		return localStorage.getItem(GUOLAO_ENGINE_STORAGE_KEY) === 'kinastro' ? 'kinastro' : 'horosa';
	}catch(e){
		return 'horosa';
	}
}

function setStoredGuolaoEngineMode(value){
	const next = value === 'kinastro' ? 'kinastro' : 'horosa';
	try{
		safeLocalStorageSet(GUOLAO_ENGINE_STORAGE_KEY, next);
	}catch(e){}
	return next;
}

function formatNativeDate(date){
	const target = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
	const y = target.getFullYear();
	const m = `${target.getMonth() + 1}`.padStart(2, '0');
	const d = `${target.getDate()}`.padStart(2, '0');
	return `${y}-${m}-${d}`;
}

function formatNativeTime(date){
	const target = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
	const h = `${target.getHours()}`.padStart(2, '0');
	const m = `${target.getMinutes()}`.padStart(2, '0');
	return `${h}:${m}`;
}

function getStoredKinastroQizhengOptions(){
	const now = new Date();
	const defaults = {
		currentYear: new Date().getFullYear(),
		transitMode: 'none',
		transitDate: formatNativeDate(now),
		transitTime: formatNativeTime(now),
		showZhangguo: true,
		showShensha: true,
		showMingGong: true,
		electionalStartDate: '',
		electionalCriteria: 'general',
		electionalDays: 30,
	};
	try{
		const raw = JSON.parse(localStorage.getItem(GUOLAO_KIN_OPTIONS_STORAGE_KEY) || '{}');
		return {
			...defaults,
			...(raw || {}),
			currentYear: Number(raw && raw.currentYear) || defaults.currentYear,
		};
	}catch(e){
		return defaults;
	}
}

function setStoredKinastroQizhengOptions(value){
	const next = {
		...getStoredKinastroQizhengOptions(),
		...(value || {}),
	};
	next.currentYear = Math.max(1, Math.min(9999, Number(next.currentYear) || new Date().getFullYear()));
	next.electionalDays = Math.max(1, Math.min(60, Number(next.electionalDays) || 30));
	try{
		safeLocalStorageSet(GUOLAO_KIN_OPTIONS_STORAGE_KEY, JSON.stringify(next));
	}catch(e){}
	return next;
}

const MOIRA_PLANET_ORDER = [
	{id: AstroConst.SUN, name: '日'},
	{id: AstroConst.MOON, name: '月'},
	{id: AstroConst.VENUS, name: '金'},
	{id: AstroConst.JUPITER, name: '木'},
	{id: AstroConst.MERCURY, name: '水'},
	{id: AstroConst.MARS, name: '火'},
	{id: AstroConst.SATURN, name: '土'},
	{id: AstroConst.SOUTH_NODE, name: '计'},
	{id: AstroConst.NORTH_NODE, name: '罗'},
	{id: AstroConst.PURPLE_CLOUDS, name: '炁'},
	{id: AstroConst.DARKMOON, name: '孛'},
];

const STEM_BRANCHES = ['甲子', '乙丑', '丙寅', '丁卯', '戊辰', '己巳', '庚午', '辛未', '壬申', '癸酉', '甲戌', '乙亥', '丙子', '丁丑', '戊寅', '己卯', '庚辰', '辛巳', '壬午', '癸未', '甲申', '乙酉', '丙戌', '丁亥', '戊子', '己丑', '庚寅', '辛卯', '壬辰', '癸巳', '甲午', '乙未', '丙申', '丁酉', '戊戌', '己亥', '庚子', '辛丑', '壬寅', '癸卯', '甲辰', '乙巳', '丙午', '丁未', '戊申', '己酉', '庚戌', '辛亥', '壬子', '癸丑', '甲寅', '乙卯', '丙辰', '丁巳', '戊午', '己未', '庚申', '辛酉', '壬戌', '癸亥'];
const MOIRA_YEAR_STAR_BY_STEM = {
	甲: '火',
	乙: '孛',
	丙: '木',
	丁: '金',
	戊: '土',
	己: '月',
	庚: '水',
	辛: '炁',
	壬: '计',
	癸: '罗',
};
const MOIRA_YEAR_STAR_SEQ = ['火', '孛', '木', '金', '土', '月', '水', '炁', '计', '罗'];
const MOIRA_YEAR_STAR_MAP = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const MOIRA_TEN_GOD_ORG = ['天禄', '天暗', '天福', '天耗', '天荫', '天贵', '天嗣', '天刑', '天印', '天囚', '天权'];
const MOIRA_TEN_GOD_ALT = ['比肩', '劫财', '食神', '伤官', '偏财', '正财', '七杀', '正官', '偏印', '正印'];
const MOIRA_YEAR_INFO_GROUPS = [
	['天禄', '科名', '天马', '生官'],
	['天暗', '科甲', '地驿'],
	['天福', '文星', '禄元'],
	['天耗', '魁星', '马元', '值难'],
	['天荫', '官星', '天元', '职元'],
	['天贵', '印星', '地元', '局主'],
	['天嗣', '寿元', '人元', '天经'],
	['天刑', '催官', '仁元', '地纬'],
	['天印', '禄神', '血支'],
	['天囚', '喜神', '血忌'],
	['天权', '爵星', '产星', '伤官'],
];
const MOIRA_BIRTH_GOD_ORDER = ['劫杀', '文昌', '禄勋', '大耗', '月杀', '咸池', '唐符', '天厨', '伏尸', '三刑', '勾神', '蓦越', '黄幡', '的杀', '孤辰', '天喜', '注受', '剑锋', '飞廉', '病符', '紫微', '华盖', '天贵', '六害', '孤虚', '游奕', '年符', '死符', '地雌', '卷舌', '绞杀', '天德', '贯索', '亡神', '国印', '岁殿', '卦气', '空亡', '豹尾', '擎天', '天空', '大杀', '天厄', '月廉', '天雄', '天哭', '天狗', '地耗', '月符', '披头', '红鸾', '岁驾', '小耗', '寡宿', '飞刃', '天耗', '斗杓', '驿马', '阳刃', '阑干', '玉贵', '血刃', '浮沉', '解神'];
const MOIRA_TRANSIT_GOD_ORDER = ['岁驾', '天空', '地雌', '贯索', '五鬼', '死符', '大耗', '天厄', '天雄', '大杀', '卷舌', '天德', '天狗', '蓦越', '亡神', '天喜', '披头', '血刃', '解神', '天哭', '地解', '劫杀', '的杀', '红鸾', '驿马', '游奕', '擎天', '黄幡', '豹尾', '天厨', '三刑', '六害', '咸池', '阳刃', '禄勋', '天贵'];
const MOIRA_SPEED_LIMITS = {
	Venus: {slow: 0.71, fast: 1.245},
	Jupiter: {slow: 0.05, fast: 0.23},
	Mercury: {slow: 0.88, fast: 1.50},
	Mars: {slow: 0.4, fast: 0.70},
	Saturn: {slow: 0.02, fast: 0.13},
};
const MOIRA_PLANET_CN_TO_ID = {
	日: AstroConst.SUN,
	月: AstroConst.MOON,
	水: AstroConst.MERCURY,
	金: AstroConst.VENUS,
	火: AstroConst.MARS,
	木: AstroConst.JUPITER,
	土: AstroConst.SATURN,
	罗: AstroConst.NORTH_NODE,
	计: AstroConst.SOUTH_NODE,
	炁: AstroConst.PURPLE_CLOUDS,
	孛: AstroConst.DARKMOON,
};
const MOIRA_RULER_BY_SIGN = {
	Aries: AstroConst.MARS,
	Taurus: AstroConst.VENUS,
	Gemini: AstroConst.MERCURY,
	Cancer: AstroConst.MOON,
	Leo: AstroConst.SUN,
	Virgo: AstroConst.MERCURY,
	Libra: AstroConst.VENUS,
	Scorpio: AstroConst.MARS,
	Sagittarius: AstroConst.JUPITER,
	Capricorn: AstroConst.SATURN,
	Aquarius: AstroConst.SATURN,
	Pisces: AstroConst.JUPITER,
};
const MOIRA_EXILE_BY_SIGN = {
	Aries: AstroConst.VENUS,
	Taurus: AstroConst.MARS,
	Gemini: AstroConst.JUPITER,
	Cancer: AstroConst.SATURN,
	Leo: AstroConst.SATURN,
	Virgo: AstroConst.JUPITER,
	Libra: AstroConst.MARS,
	Scorpio: AstroConst.VENUS,
	Sagittarius: AstroConst.MERCURY,
	Capricorn: AstroConst.MOON,
	Aquarius: AstroConst.SUN,
	Pisces: AstroConst.MERCURY,
};
const MOIRA_OVERCOMING = {
	日: '月',
	月: '日',
	金: '火',
	木: '金',
	水: '土',
	火: '水',
	土: '木',
	炁: '金',
	孛: '土',
	罗: '水',
	计: '木',
};

const GUOLAO_CACHE_MAX = 96;
const GUOLAO_SU28_CACHE_REV = 'guolao_moira_su28_v9_eqtropical7';
const GUOLAO_SU28_MODE_ZHENG_SIDEREAL = 4;
const GUOLAO_SU28_MODE_GUFA_LICHENG = 6;   // WP-D 授时历古法立成(推变黄道·古法不等宫)
const GUOLAO_SU28_MODE_EQUATORIAL_TROPICAL = 7;   // 额外档 赤道回归制·元明(固定古度宿界·春分/牛前冬至锚)
const GUOLAO_SU28_MODE_EQUATORIAL_TROPICAL_LIVE = 8;   // 赤道回归·实时(宿宽=盘历元距星真赤经·同款回归锚)
const guolaoMem = new Map();
const guolaoInflight = new Map();

function splitDegree(degree){
	let d = Number(degree);
	if(Number.isNaN(d)){
		return [0, 0];
	}
	if(d < 0){
		d += 360;
	}
	const deg = Math.floor(d % 30);
	const min = Math.floor(((d % 30) - deg) * 60);
	return [deg, min];
}

function isEncodedToken(text){
	return /^[A-Za-z0-9${}]$/.test((text || '').trim());
}

function msg(id){
	if(id === undefined || id === null){
		return '';
	}
	if(AstroText.AstroTxtMsg[id]){
		return AstroText.AstroTxtMsg[id];
	}
	if(AstroText.AstroMsg[id]){
		const val = AstroText.AstroMsg[id];
		if(!isEncodedToken(val)){
			return `${val}`;
		}
	}
	const one = `${id}`.trim();
	if(one.length === 1 && SIMPLE_TOKEN_MAP[one]){
		return SIMPLE_TOKEN_MAP[one];
	}
	return `${id}`;
}

function safeList(val){
	return Array.isArray(val) ? val : [];
}

function safeMap(val){
	return val && typeof val === 'object' ? val : {};
}

function fmtValue(value){
	if(value === undefined || value === null || value === ''){
		return '—';
	}
	if(Array.isArray(value)){
		const text = value.map((item)=>fmtValue(item)).filter((item)=>item && item !== '—').join('、');
		return text || '—';
	}
	if(typeof value === 'object'){
		const text = Object.keys(value).map((key)=>{
			const val = fmtValue(value[key]);
			return val && val !== '—' ? `${key}：${val}` : '';
		}).filter(Boolean).join('；');
		return text || '—';
	}
	return `${value}`.replace(/None/g, '无');
}

function isQizhengLimitObject(value){
	return (value && typeof value === 'object' && !Array.isArray(value)
		&& (
			value.start_age !== undefined
			|| value.end_age !== undefined
			|| value.start_year !== undefined
			|| value.end_year !== undefined
			|| value.palace_name !== undefined
		))
		|| (typeof value === 'string' && /(?:palace_name|start_age|end_age|start_year|end_year)\s*[:：]/.test(value));
}

function parseQizhengLimitValue(value){
	if(value && typeof value === 'object' && !Array.isArray(value)){
		return safeMap(value);
	}
	if(typeof value !== 'string'){
		return {};
	}
	return value.split(/[;；]/).reduce((map, part)=>{
		const pair = `${part || ''}`.split(/[:：]/);
		if(pair.length < 2){
			return map;
		}
		const key = pair.shift().trim();
		const val = pair.join(':').trim();
		if(key){
			map[key] = val;
		}
		return map;
	}, {});
}

function fmtQizhengLimitObject(value){
	const item = parseQizhengLimitValue(value);
	const ageText = item.start_age !== undefined || item.end_age !== undefined
		? `${fmtValue(item.start_age)}-${fmtValue(item.end_age)}岁`
		: '';
	const yearText = item.start_year !== undefined || item.end_year !== undefined
		? `${fmtValue(item.start_year)}-${fmtValue(item.end_year)}年`
		: '';
	const parts = [
		item.palace_name,
		item.lord,
		item.branch_name || item.branch,
		ageText,
		yearText,
	].map((val)=>fmtValue(val)).filter((val)=>val && val !== '—');
	return parts.join(' | ') || '—';
}

function fmtQizhengKinRowValue(row){
	const value = row ? row.value : null;
	if(isQizhengLimitObject(value)){
		return fmtQizhengLimitObject(value);
	}
	return fmtValue(value);
}

function splitQizhengKinDisplayLines(value){
	const text = fmtValue(value);
	if(!/[;；]/.test(text)){
		return [text];
	}
	const lines = [];
	let current = '';
	text.split(/([;；])/).forEach((part)=>{
		if(!part){
			return;
		}
		current += part;
		if(part === ';' || part === '；'){
			const line = current.trim();
			if(line){
				lines.push(line);
			}
			current = '';
		}
	});
	const last = current.trim();
	if(last){
		lines.push(last);
	}
	return lines.length ? lines : [text];
}

function qizhengKinReadingLevel(row){
	const title = row && row.label ? `${row.label}` : '';
	const value = fmtQizhengKinRowValue(row);
	const text = `${title} ${value}`;
	if(/忌格|忌|凶|破|败|失|刑|害|陷|空亡/.test(text)){
		return 'bad';
	}
	if(/喜格|吉|合格|贵|福|禄|旺|德|拱/.test(text)){
		return 'good';
	}
	return 'neutral';
}

function qizhengKinReadingBadge(level){
	if(level === 'bad'){
		return '忌';
	}
	if(level === 'good'){
		return '吉';
	}
	return '断';
}

function hasUnverifiedMoiraPatternSource(value){
	return value && (
		value.styleSource === 'moira-dsl-not-evaluated'
		|| value.engine === 'moira-rules-on-horosa-ephemeris'
		|| value.version === 'qizheng-moira-rules-v1'
	);
}

function isIncompleteMoiraRules(value){
	if(!value){
		return true;
	}
	if(hasUnverifiedMoiraPatternSource(value)){
		return true;
	}
	const text = `${value.styleWarning || ''} ${value.summary || ''} ${value.message || ''}`;
	return (
		text.indexOf('仍在接入') >= 0
		|| text.indexOf('暂不输出') >= 0
		|| text.indexOf('暂不生成') >= 0
		|| text.indexOf('未返回完整') >= 0
		|| !Array.isArray(value.patterns)
	);
}

function moiraStyleLevelMeta(rules, currentLevel){
	const min = Number(rules && rules.styleLevelMin) || 1;
	const max = Number(rules && rules.styleLevelMax) || 5;
	const def = Number(rules && rules.styleLevel) || 3;
	let level = currentLevel === undefined || currentLevel === null ? def : Number(currentLevel);
	if(!Number.isFinite(level)){
		level = def;
	}
	level = Math.max(min, Math.min(max, Math.round(level)));
	return {
		min,
		max,
		level,
		displayLevel: max - level,
		fillMax: Number(rules && rules.styleFillMax) || 6,
	};
}

function applyMoiraStyleLevel(list, meta){
	const displayLevel = Number(meta && meta.displayLevel) || 0;
	const fillMax = Number(meta && meta.fillMax) || 6;
	const result = [];
	safeList(list).forEach((item)=>{
		const level = Number(item && item.moiraLevel);
		const rank = Number(item && item.moiraRank);
		const moiraLevel = Number.isFinite(level) ? level : 0;
		const moiraRank = Number.isFinite(rank) ? rank : 65536;
		if(moiraLevel < displayLevel){
			return;
		}
		if(moiraLevel === displayLevel && moiraRank < 65536 && result.length >= fillMax){
			return;
		}
		result.push(item);
	});
	return result;
}

function joinNames(list){
	const arr = safeList(list).map(formatGodName).filter(Boolean);
	return arr.length ? arr.join('、') : '无';
}

function joinMoiraYearItems(items){
	return safeList(items).map((item)=>{
		if(item && typeof item === 'object'){
			return [item.name, item.star ? `化${item.star}` : ''].filter(Boolean).join(' ');
		}
		return `${item || ''}`;
	}).filter(Boolean).join('、');
}

function formatGodName(name){
	let val = `${name || ''}`.replace(/\s+/g, '');
	if(!val){
		return '';
	}
	val = val.split(/[\/／]/)[0];
	const aliases = {
		天乙贵人: '天贵',
		玉堂贵人: '玉贵',
	};
	return aliases[val] || val;
}

function normDegree(val){
	let deg = Number(val);
	if(!Number.isFinite(deg)){
		return null;
	}
	deg %= 360;
	if(deg < 0){
		deg += 360;
	}
	return deg;
}

// AI 快照显示口径(黄仪=lon/赤仪=ra):buildGuolaoSnapshotTextV2 开头按 chart.displayCoord 装载,
// 与盘面/右栏同一真值源;渲染单线程,模块级变量安全(同 ACTIVE_SLOTS 模式)。
let SNAPSHOT_PREFER_LON = false;

function objectLon(obj){
	const raw = obj && (SNAPSHOT_PREFER_LON && obj.lon !== undefined ? obj.lon : (obj.ra !== undefined ? obj.ra : obj.lon));
	const lon = normDegree(raw);
	if(lon !== null){
		return lon;
	}
	const sign = obj && obj.sign ? AstroConst.LIST_SIGNS.indexOf(obj.sign) : -1;
	const signlon = Number(obj && obj.signlon);
	if(sign >= 0 && Number.isFinite(signlon)){
		return normDegree(sign * 30 + signlon);
	}
	return null;
}

function formatSignDegree(lon){
	const deg = normDegree(lon);
	if(deg === null){
		return '';
	}
	const sign = AstroConst.LIST_SIGNS[Math.floor(deg / 30) % 12];
	const parts = splitDegree(deg);
	return `${msg(sign)} ${parts[0]}度${parts[1]}分`;
}

function compactDegree(lon){
	const deg = normDegree(lon);
	if(deg === null){
		return '';
	}
	const one = Math.floor(deg % 30);
	const min = Math.floor(((deg % 30) - one) * 60);
	return `${`${one}`.padStart(2, '0')}.${`${min}`.padStart(2, '0')}`;
}

function speedText(speed){
	const num = Number(speed);
	if(!Number.isFinite(num)){
		return '';
	}
	return `${num > 0 ? '+' : ''}${num.toFixed(4)}`;
}

function planetStatus(obj){
	const speed = Number(obj && obj.lonspeed);
	if(!Number.isFinite(speed)){
		return '顺';
	}
	if(speed < -0.000001){
		return '逆';
	}
	if(Math.abs(speed) < 0.002){
		return '留';
	}
	const limit = MOIRA_SPEED_LIMITS[obj.id];
	if(limit){
		const abs = Math.abs(speed);
		if(abs < limit.slow){
			return '迟';
		}
		if(abs > limit.fast){
			return '速';
		}
	}
	return '顺';
}

function stemBranchForYear(year){
	const num = Number(year);
	if(!Number.isFinite(num)){
		return '';
	}
	const idx = ((num - 1984) % 60 + 60) % 60;
	return STEM_BRANCHES[idx] || '';
}

function yearFromParams(params){
	const raw = params && params.date ? `${params.date}` : '';
	const match = raw.match(/-?\d{3,4}/);
	return match ? Number(match[0]) : new Date().getFullYear();
}

function getChartRoot(result){
	return result || {};
}

function getChart(result){
	const root = getChartRoot(result);
	return root.chart || {};
}

function getBazi(result){
	const root = getChartRoot(result);
	const chart = getChart(root);
	return (chart.nongli && chart.nongli.bazi) || (root.nongli && root.nongli.bazi) || {};
}

function baziStemBranch(result, key, fallbackYear){
	const bazi = getBazi(result);
	const one = bazi[key] || {};
	if(one.text){
		return one.text;
	}
	if(one.stem && one.branch){
		const stem = one.stem.cell || one.stem.name || one.stem.text || one.stem;
		const branch = one.branch.cell || one.branch.name || one.branch.text || one.branch;
		return `${stem || ''}${branch || ''}`;
	}
	return key === 'year' ? stemBranchForYear(fallbackYear) : '';
}

function baziText(result){
	return ['year', 'month', 'day', 'time'].map((key)=>baziStemBranch(result, key, '')).filter(Boolean).join(' ');
}

function lunarText(result){
	const root = getChartRoot(result);
	const chart = getChart(root);
	const nongli = chart.nongli || root.nongli || {};
	return nongli.text || nongli.nongli || nongli.lunar || nongli.lunarText || '';
}

function getZiGods(result){
	const root = getChartRoot(result);
	const chart = getChart(root);
	const rootGods = root.nongli && root.nongli.bazi && root.nongli.bazi.guolaoGods
		? root.nongli.bazi.guolaoGods.ziGods : null;
	const chartGods = chart.nongli && chart.nongli.bazi && chart.nongli.bazi.guolaoGods
		? chart.nongli.bazi.guolaoGods.ziGods : null;
	return chartGods || rootGods || {};
}

function orderGods(list, order){
	const priority = new Map(order.map((name, idx)=>[name, idx]));
	const seen = new Set();
	return safeList(list).map(formatGodName).filter((item)=>{
		if(!item || seen.has(item)){
			return false;
		}
		seen.add(item);
		return true;
	}).sort((a, b)=>{
		const ia = priority.has(a) ? priority.get(a) : 999;
		const ib = priority.has(b) ? priority.get(b) : 999;
		if(ia !== ib){
			return ia - ib;
		}
		return `${a}`.localeCompare(`${b}`, 'zh-Hans-CN');
	});
}

function findChartObject(chart, id){
	return safeList(chart.objects).find((obj)=>obj && obj.id === id);
}

function buildQuickPlanetRows(result, rulePlanets){
	const chart = getChart(result);
	const ruleMap = new Map(safeList(rulePlanets).map((item)=>[item.id, item]));
	return MOIRA_PLANET_ORDER.map((def)=>{
		const obj = findChartObject(chart, def.id);
		const lon = objectLon(obj);
		if(!obj || lon === null){
			return null;
		}
		const rule = ruleMap.get(def.id) || {};
		return {
			id: def.id,
			name: def.name,
			signName: rule.signName || msg(obj.sign) || msg(signFromLon(lon)),
			degree: rule.degreeText || formatSignDegree(lon),
			compactDegree: compactDegree(lon),
			su28: obj.su28 || rule.su28 || '',
			house: rule.moiraHouse || msg(obj.house) || '',
			dignity: rule.dignity || '',
			status: planetStatus(obj),
			speed: speedText(obj.lonspeed),
		};
	}).filter(Boolean);
}

function buildGodRowsFromChart(result, fields){
	const chart = getChart(result);
	const houses = safeList(chart.houses);
	const ziGods = getZiGods(result);
	const ascSignIndex = computeAscSignIndex(result, chart, fields);
	return houses.map((house, idx)=>{
		const sign = signFromLon(house && house.lon);
		const zi = sign ? SZConst.SignZi[sign] : '';
		const one = zi && ziGods ? safeMap(ziGods[zi]) : {};
		return {
			house: houseFullLabel(house, idx, ascSignIndex),
			zi,
			signName: sign ? msg(sign) : '',
			goodGods: orderGods(one.goodGods, MOIRA_BIRTH_GOD_ORDER),
			neutralGods: orderGods(one.neutralGods, MOIRA_BIRTH_GOD_ORDER),
			badGods: orderGods(one.badGods, MOIRA_BIRTH_GOD_ORDER),
			taisuiGods: orderGods(one.taisuiGods, MOIRA_TRANSIT_GOD_ORDER),
		};
	});
}

function buildHouseRowsFromChart(result, fields){
	const chart = getChart(result);
	const ascSignIndex = computeAscSignIndex(result, chart, fields);
	return safeList(chart.houses).map((house, idx)=>{
		const sign = signFromLon(house && house.lon);
		const signIdx = sign ? AstroConst.LIST_SIGNS.indexOf(sign) : -1;
		const area = signIdx >= 0 && SZConst.SZSigns[signIdx] && SZConst.SZSigns[signIdx].length >= 2
			? `${SZConst.SZSigns[signIdx][0]}${SZConst.SZSigns[signIdx][1]}`
			: '';
		return {
			index: idx,
			name: houseFullLabel(house, idx, ascSignIndex),
			zi: sign ? (SZConst.SignZi[sign] || '') : '',
			area,
			signName: sign ? msg(sign) : '',
			moiraStarHouse: msg(house && house.id ? house.id : null) || '',
		};
	});
}

function signIndexFromLon(lon){
	const sign = signFromLon(lon);
	return sign ? AstroConst.LIST_SIGNS.indexOf(sign) : -1;
}

function objectSignIndex(chart, id){
	const obj = findChartObject(chart, id);
	const lon = objectLon(obj);
	return lon === null ? -1 : signIndexFromLon(lon);
}

function localLifeObject(chart, fields){
	const mode = guolaoLifeModeFromFields(fields);
	const life = findChartObject(chart, AstroConst.LIFEMASTERDEG74);
	const asc = findChartObject(chart, AstroConst.ASC);
	const sun = findChartObject(chart, AstroConst.SUN);
	if(mode === GUOLAO_LIFE_MODE_YUMAO || mode === GUOLAO_LIFE_MODE_COTRANS){
		return life || asc || sun || null;
	}
	return asc || life || sun || null;
}

function localLifeSignIndex(chart, fields){
	const life = localLifeObject(chart, fields);
	const lon = objectLon(life);
	return lon === null ? -1 : signIndexFromLon(lon);
}

function localMoiraHouseSign(lifeSignIndex, houseOffset){
	return lifeSignIndex < 0 ? -1 : (lifeSignIndex + houseOffset + 12) % 12;
}

function localSignZi(signIdx){
	const sign = AstroConst.LIST_SIGNS[(signIdx + 12) % 12];
	return sign ? (SZConst.SignZi[sign] || '') : '';
}

function localPlanetCnById(id){
	const row = MOIRA_PLANET_ORDER.find((item)=>item.id === id);
	return row ? row.name : msg(id);
}

function localSignOfCn(chart, name, lifeSignIndex, selfSignIndex, godSigns){
	const houseMap = {
		命: localMoiraHouseSign(lifeSignIndex, 0),
		命宫: localMoiraHouseSign(lifeSignIndex, 0),
		财: localMoiraHouseSign(lifeSignIndex, 1),
		财帛: localMoiraHouseSign(lifeSignIndex, 1),
		兄弟: localMoiraHouseSign(lifeSignIndex, 2),
		田: localMoiraHouseSign(lifeSignIndex, 3),
		田宅: localMoiraHouseSign(lifeSignIndex, 3),
		嗣: localMoiraHouseSign(lifeSignIndex, 4),
		男女: localMoiraHouseSign(lifeSignIndex, 4),
		奴: localMoiraHouseSign(lifeSignIndex, 5),
		奴仆: localMoiraHouseSign(lifeSignIndex, 5),
		妻: localMoiraHouseSign(lifeSignIndex, 6),
		夫妻: localMoiraHouseSign(lifeSignIndex, 6),
		疾: localMoiraHouseSign(lifeSignIndex, 7),
		疾厄: localMoiraHouseSign(lifeSignIndex, 7),
		迁: localMoiraHouseSign(lifeSignIndex, 8),
		迁移: localMoiraHouseSign(lifeSignIndex, 8),
		官: localMoiraHouseSign(lifeSignIndex, 9),
		官禄: localMoiraHouseSign(lifeSignIndex, 9),
		福: localMoiraHouseSign(lifeSignIndex, 10),
		福德: localMoiraHouseSign(lifeSignIndex, 10),
		相: localMoiraHouseSign(lifeSignIndex, 11),
		相貌: localMoiraHouseSign(lifeSignIndex, 11),
		身: selfSignIndex,
	};
	if(Object.prototype.hasOwnProperty.call(houseMap, name)){
		return houseMap[name];
	}
	if(godSigns && godSigns[name] !== undefined){
		return godSigns[name];
	}
	if(MOIRA_PLANET_CN_TO_ID[name]){
		return objectSignIndex(chart, MOIRA_PLANET_CN_TO_ID[name]);
	}
	const signs = ['戌', '酉', '申', '未', '午', '巳', '辰', '卯', '寅', '丑', '子', '亥'];
	const idx = signs.indexOf(name);
	return idx >= 0 ? idx : -1;
}

function localMoiraGodSigns(godRows){
	const res = {};
	safeList(godRows).forEach((row)=>{
		const signIdx = ['戌', '酉', '申', '未', '午', '巳', '辰', '卯', '寅', '丑', '子', '亥'].indexOf(row.zi);
		if(signIdx < 0){
			return;
		}
		['goodGods', 'neutralGods', 'badGods', 'taisuiGods'].forEach((key)=>{
			safeList(row[key]).forEach((name)=>{
				const val = formatGodName(name);
				if(val && res[val] === undefined){
					res[val] = signIdx;
				}
			});
		});
	});
	return res;
}

function localMoiraSuRuler(su){
	if(!su){
		return '';
	}
	if('星房虚昴'.indexOf(su) >= 0){
		return '日';
	}
	if('张心危毕'.indexOf(su) >= 0){
		return '月';
	}
	if('亢牛娄鬼'.indexOf(su) >= 0){
		return '金';
	}
	if('角斗奎井'.indexOf(su) >= 0){
		return '木';
	}
	if('轸壁参箕'.indexOf(su) >= 0){
		return '水';
	}
	if('尾室觜翼'.indexOf(su) >= 0){
		return '火';
	}
	if('氐女胃柳'.indexOf(su) >= 0){
		return '土';
	}
	return '';
}

function localMoiraIsWinter(params){
	const raw = `${params && params.date ? params.date : ''}`.replace(/\//g, '-');
	const month = Number((raw.split('-')[1] || '').replace(/^0+/, ''));
	return month === 11 || month === 12 || month === 1;
}

function localMoiraIsDay(params){
	const hour = Number(`${params && params.time ? params.time : '12:00:00'}`.split(':')[0]);
	return Number.isFinite(hour) ? hour >= 6 && hour < 18 : true;
}

function localMoiraNearSignBoundary(lon){
	if(lon === null){
		return false;
	}
	const val = ((lon % 30) + 30) % 30;
	return val <= 1 || val >= 29;
}

function localMoiraNearSuBoundary(chart, lon){
	if(lon === null){
		return false;
	}
	return safeList(chart && chart.fixedStarSu28).some((item)=>{
		const ra = normDegree(item && item.ra);
		if(ra === null){
			return false;
		}
		const diff = Math.abs(normDegree(lon) - ra);
		return Math.min(diff, 360 - diff) <= 1;
	});
}

function localMoiraLostRulership(chart, subject, lifeSignIndex, selfSignIndex, godSigns){
	const signIdx = localSignOfCn(chart, subject, lifeSignIndex, selfSignIndex, godSigns);
	if(signIdx < 0){
		return false;
	}
	const sign = AstroConst.LIST_SIGNS[signIdx];
	const rulerId = MOIRA_RULER_BY_SIGN[sign];
	const rulerCn = localPlanetCnById(rulerId);
	const rulerSign = objectSignIndex(chart, rulerId);
	if(rulerSign < 0){
		return false;
	}
	const rulerOfRulerSign = localPlanetCnById(MOIRA_RULER_BY_SIGN[AstroConst.LIST_SIGNS[rulerSign]]);
	return rulerOfRulerSign === MOIRA_OVERCOMING[rulerCn];
}

function addLocalMoiraPattern(list, name, level, score, detail, dsl){
	list.push({
		name,
		level,
		score,
		source: 'moira_s.prop-local',
		dsl,
		detail,
	});
}

function buildLocalMoiraPatterns(chartObj, fields, params, godRows){
	const chart = getChart(chartObj);
	const lifeObj = localLifeObject(chart, fields);
	const lifeLon = objectLon(lifeObj);
	const lifeSignIndex = localLifeSignIndex(chart, fields);
	const selfSignIndex = objectSignIndex(chart, AstroConst.MOON);
	const godSigns = localMoiraGodSigns(godRows);
	const signOf = (name)=>localSignOfCn(chart, name, lifeSignIndex, selfSignIndex, godSigns);
	const same = (a, b)=>a >= 0 && b >= 0 && a === b;
	const rel = (base, offset)=>(base + offset + 12) % 12;
	const sun = signOf('日');
	const moon = signOf('月');
	const venus = signOf('金');
	const mercury = signOf('水');
	const darkMoon = signOf('孛');
	const northNode = signOf('罗');
	const guan = signOf('官');
	const fu = signOf('福');
	const patterns = [];
	const isDay = localMoiraIsDay(params);
	const lifeZi = lifeSignIndex >= 0 ? localSignZi(lifeSignIndex) : '';

	if(lifeSignIndex >= 0 && lifeZi && ('戌亥'.indexOf(lifeZi) >= 0)){
		const diseaseRulerCn = localPlanetCnById(MOIRA_RULER_BY_SIGN[AstroConst.LIST_SIGNS[signOf('疾')]]);
		if(same(signOf(diseaseRulerCn), lifeSignIndex)){
			addLocalMoiraPattern(patterns, '八杀朝天', 'good', '3.2.0', '政余喜格：疾厄宫主入命，且命临戌亥。', '@{@{疾厄}[1]}=@命');
		}
	}
	const moonSign = moon;
	if(moonSign >= 0){
		const sameMoonSignCount = MOIRA_PLANET_ORDER
			.map((item)=>objectSignIndex(chart, item.id))
			.filter((idx)=>idx === moonSign).length;
		if(!isDay && sameMoonSignCount === 1){
			addLocalMoiraPattern(patterns, '孤月独明', 'good', '2.3.0', '政余喜格：夜生月曜独居一方。', '?{孤月} & ?夜');
		}
	}
	if(same(sun, rel(guan, 4)) && same(moon, rel(guan, -4)) || same(sun, rel(guan, -4)) && same(moon, rel(guan, 4))){
		addLocalMoiraPattern(patterns, '日月拱官', 'good', '2.3.0', '政余喜格：日月分拱官禄。', '@日=@官禄+4 & @月=@官禄-4');
	}
	if(same(venus, mercury) && !localMoiraIsWinter(params)){
		addLocalMoiraPattern(patterns, '金水相涵', 'good', '2.3.0', '政余喜格：金水同宫，且不以冬令破格。', '?{金水会} & !?冬');
	}
	const noble = signOf(isDay ? '天贵' : '玉贵');
	if(same(sun, rel(noble, 4)) && same(moon, rel(noble, -4)) || same(sun, rel(noble, -4)) && same(moon, rel(noble, 4))){
		addLocalMoiraPattern(patterns, '日月拱贵人', 'good', '2.2.0', `政余喜格：${isDay ? '昼取天贵' : '夜取玉贵'}，日月分拱。`, '?昼/夜 & 日月拱贵人');
	}
	if(same(lifeSignIndex, signOf('岁驾'))){
		addLocalMoiraPattern(patterns, '命登岁驾', 'good', '2.0.3', '政余喜格：命度临岁驾。', '@命=@{岁驾}');
	}
	if(sun >= 0 && moon >= 0){
		const sunZi = localSignZi(sun);
		const moonZi = localSignZi(moon);
		if(('申酉戌亥子丑'.indexOf(sunZi) >= 0) && ('寅卯辰巳午未'.indexOf(moonZi) >= 0)){
			addLocalMoiraPattern(patterns, '日月失所', 'bad', '2.3.0', '政余忌格：日居西北、月居东南。', '(?{日西}|?{日北}) & (?{月东}|?{月南})');
		}
	}
	if(localMoiraLostRulership(chart, '官', lifeSignIndex, selfSignIndex, godSigns) && localMoiraLostRulership(chart, '福', lifeSignIndex, selfSignIndex, godSigns)){
		addLocalMoiraPattern(patterns, '官福失垣', 'bad', '2.2.0', '政余忌格：官禄、福德主失垣。', '?{官失垣} & ?{福失垣}');
	}
	if(same(darkMoon, sun)){
		addLocalMoiraPattern(patterns, '孛犯太阳', 'bad', '2.2.0', '政余忌格：孛与太阳同宫。', '?{日孛遇}');
	}
	if(same(northNode, sun)){
		addLocalMoiraPattern(patterns, '罗犯太阳', 'bad', '2.2.0', '政余忌格：罗与太阳同宫。', '?{日罗遇}');
	}
	if(same(northNode, darkMoon)){
		addLocalMoiraPattern(patterns, '孛罗交战', 'bad', '2.2.0', '政余忌格：罗孛同宫。', '?{罗孛遇}');
	}
	if(localMoiraNearSignBoundary(lifeLon) || localMoiraNearSuBoundary(chart, lifeLon)){
		addLocalMoiraPattern(patterns, '命坐两歧', 'bad', '2.0.4', '政余忌格：命度近宫界或宿界。', '?{命宫歧} | ?{命宿歧}');
	}
	return patterns.sort((a, b)=>{
		const la = a.level === 'good' ? 0 : (a.level === 'bad' ? 1 : 2);
		const lb = b.level === 'good' ? 0 : (b.level === 'bad' ? 1 : 2);
		return la - lb;
	});
}

function buildLocalMoiraRules(params, chartObj, fields, reason){
	const godHits = buildGodRowsFromChart(chartObj, fields);
	const patterns = buildLocalMoiraPatterns(chartObj, fields, params, godHits);
	return {
		engine: 'horosa-local-moira-panel-fallback',
		engineLabel: 'Moira政余格局（本地规则）',
		summary: `本地已接入 Moira 政余格局规则：命中喜格 ${patterns.filter((item)=>item.level === 'good').length} 条、忌格 ${patterns.filter((item)=>item.level === 'bad').length} 条。`,
		styleSource: 'moira-dsl-local-evaluated',
		styleWarning: '',
		params: {
			...(params || {}),
		},
		anchors: {},
		houses: buildHouseRowsFromChart(chartObj, fields),
		planets: [],
		patterns,
		godHits,
		fallbackReason: reason ? `${reason}` : '',
	};
}

function normalizeGodRows(rows, order){
	return safeList(rows).filter(Boolean).map((row)=>({
		...row,
		goodGods: orderGods(row.goodGods, order),
		neutralGods: orderGods(row.neutralGods, order),
		badGods: orderGods(row.badGods, order),
		taisuiGods: orderGods(row.taisuiGods, MOIRA_TRANSIT_GOD_ORDER),
	}));
}

// 🆕 中文相位名(含度数)用于 AI 挂载快照 + AI 导出 + AI 报告 — 避免输出占星字体字形码(R/W/P/M 等)给 LLM 看成乱码。
// UI 内部渲染走 AstroMsg 字形码 + 占星字体不受影响(各自管线分离)。
const GUOLAO_ASPECT_LABEL_CN = {
	Asp0: '合 (0°)',
	Asp30: '半六合 (30°)',
	Asp45: '半方 (45°)',
	Asp60: '六合 (60°)',
	Asp90: '方 (90°)',
	Asp120: '三合 (120°)',
	Asp135: '补半方 (135°)',
	Asp150: '梅花 (150°)',
	Asp180: '冲 (180°)',
};
function aspectName(deg){
	if(GUOLAO_ASPECT_LABEL_CN[`Asp${deg}`]){ return GUOLAO_ASPECT_LABEL_CN[`Asp${deg}`]; }
	if(AstroText.AstroTxtMsg && AstroText.AstroTxtMsg[`Asp${deg}`]){ return AstroText.AstroTxtMsg[`Asp${deg}`]; }
	return Number.isFinite(Number(deg)) ? `${deg}°` : '';
}

function buildAspectRows(aspects){
	const normal = aspects && aspects.normalAsp ? aspects.normalAsp : aspects;
	const rows = [];
	if(!normal || typeof normal !== 'object'){
		return rows;
	}
	Object.keys(normal).forEach((key)=>{
		const bucket = normal[key] || {};
		[
			['Applicative', '入相'],
			['Exact', '精确'],
			['Separative', '离相'],
			['None', '容许'],
		].forEach(([field, state])=>{
			safeList(bucket[field]).forEach((asp, idx)=>{
				if(!asp || !asp.id){
					return;
				}
				rows.push({
					key: `${key}-${asp.id}-${field}-${idx}`,
					from: msg(key),
					to: msg(asp.id),
					aspect: aspectName(asp.asp),
					state,
					orb: Number.isFinite(Number(asp.orb)) ? `${Math.round(Number(asp.orb) * 1000) / 1000}` : '',
				});
			});
		});
	});
	return rows;
}

function clonePlain(obj){
	if(obj === undefined || obj === null){
		return obj;
	}
	try{
		return JSON.parse(JSON.stringify(obj));
	}catch(e){
		return obj;
	}
}

function swapGuolaoNodeId(id){
	if(id === AstroConst.NORTH_NODE){
		return AstroConst.SOUTH_NODE;
	}
	if(id === AstroConst.SOUTH_NODE){
		return AstroConst.NORTH_NODE;
	}
	return id;
}

function swapGuolaoNodeIdsDeep(value, seen){
	if(value === undefined || value === null){
		return value;
	}
	if(typeof value === 'string'){
		return swapGuolaoNodeId(value);
	}
	if(typeof value !== 'object'){
		return value;
	}
	const visited = seen || new Set();
	if(visited.has(value)){
		return value;
	}
	visited.add(value);
	if(Array.isArray(value)){
		for(let i = 0; i < value.length; i++){
			value[i] = swapGuolaoNodeIdsDeep(value[i], visited);
		}
		return value;
	}
	const keys = Object.keys(value);
	const entries = keys.map((key)=>[swapGuolaoNodeId(key), swapGuolaoNodeIdsDeep(value[key], visited)]);
	keys.forEach((key)=>delete value[key]);
	entries.forEach(([key, val])=>{
		value[key] = val;
	});
	return value;
}

function guolaoNodeModeFromFields(fields){
	if(fields && fields.guolaoNodeMode && fields.guolaoNodeMode.value !== undefined && fields.guolaoNodeMode.value !== null){
		return normalizeGuolaoNodeMode(fields.guolaoNodeMode.value);
	}
	return getStoredGuolaoNodeMode();
}

function guolaoNodeModeName(mode){
	const normalized = normalizeGuolaoNodeMode(mode);
	return normalized === GUOLAO_NODE_MODE_NORTH_RAHU ? '北罗南计' : '北计南罗';
}

function applyGuolaoNodeMode(chartObj, fields){
	const next = clonePlain(chartObj);
	if(!next){
		return next;
	}
	if(guolaoNodeModeFromFields(fields) === GUOLAO_NODE_MODE_NORTH_RAHU){
		swapGuolaoNodeIdsDeep(next);
	}
	return next;
}

const GUOLAO_RISE_SET_KEYS = {
	sunrise: true,
	sunRise: true,
	sunriseTime: true,
	sunRiseTime: true,
	sun_rise: true,
	guolaoSunRiseTime: true,
	sunset: true,
	sunSet: true,
	sunsetTime: true,
	sunSetTime: true,
	sun_set: true,
	moonrise: true,
	moonRise: true,
	moonriseTime: true,
	moonRiseTime: true,
	moon_rise: true,
	moonset: true,
	moonSet: true,
	moonsetTime: true,
	moonSetTime: true,
	moon_set: true,
};

function hasGuolaoRiseSetFields(value, seen){
	if(value === undefined || value === null){
		return false;
	}
	if(typeof value !== 'object'){
		return false;
	}
	const visited = seen || new Set();
	if(visited.has(value)){
		return false;
	}
	visited.add(value);
	const keys = Object.keys(value);
	for(let i = 0; i < keys.length; i++){
		const key = keys[i];
		const item = value[key];
		if(GUOLAO_RISE_SET_KEYS[key] && item !== undefined && item !== null && `${item}`.trim()){
			return true;
		}
		if(item && typeof item === 'object' && hasGuolaoRiseSetFields(item, visited)){
			return true;
		}
	}
	return false;
}

function pushCache(map, key, val, max = GUOLAO_CACHE_MAX){
	if(!map || !key || val === undefined || val === null){
		return;
	}
	if(map.has(key)){
		map.delete(key);
	}
	map.set(key, val);
	if(map.size > max){
		const first = map.keys().next().value;
		if(first){
			map.delete(first);
		}
	}
}

function normalizeDateText(val){
	const raw = `${val || ''}`.trim();
	if(!raw){
		return '';
	}
	const one = raw.indexOf(' ') >= 0 ? raw.split(' ')[0] : raw;
	return one.replace(/-/g, '/');
}

function normalizeTimeText(val){
	const raw = `${val || ''}`.trim();
	if(!raw){
		return '';
	}
	const one = raw.indexOf(' ') >= 0 ? raw.split(' ')[1] : raw;
	if(/^\d{2}:\d{2}$/.test(one)){
		return `${one}:00`;
	}
	return one;
}

function normalizeNumText(val, defVal = 0){
	const num = Number(val);
	if(!Number.isFinite(num)){
		return `${defVal}`;
	}
	return `${num}`;
}

function normalizeGpsText(val){
	const num = Number(val);
	if(!Number.isFinite(num)){
		return '';
	}
	return `${Math.round(num * 1000000) / 1000000}`;
}

function normalizeChartParams(input){
	const src = input || {};
	const birth = `${src.birth || ''}`.trim();
	const birthParts = birth ? birth.split(' ') : [];
	const birthDate = birthParts[0] || '';
	const birthTime = birthParts[1] || '';
	return {
		date: normalizeDateText(src.date || birthDate),
		time: normalizeTimeText(src.time || birthTime || '00:00:00'),
		ad: normalizeNumText(src.ad, 1),
		zone: `${src.zone || ''}`,
		lon: `${src.lon || ''}`,
		lat: `${src.lat || ''}`,
		gpsLon: normalizeGpsText(src.gpsLon),
		gpsLat: normalizeGpsText(src.gpsLat),
		hsys: normalizeNumText(src.hsys, 0),
		zodiacal: normalizeNumText(src.zodiacal, 0),
		tradition: normalizeNumText(src.tradition, 0),
		doubingSu28: normalizeNumText(src.doubingSu28, 0),
		guolaoZhengSidereal: normalizeNumText(src.guolaoZhengSidereal, 0),
		siderealAyanamsa: src.siderealAyanamsa ? `${src.siderealAyanamsa}` : '',   // G2 恒星制岁差进缓存键(否则切 ayan 命中旧盘)
		guolaoTrueSolarTime: (src.trueSolarTime === 'mean' || src.trueSolarTime === 'off') ? src.trueSolarTime : 'true',  // G6 报时星太阳时进缓存键
		guolaoNodeType: src.guolaoNodeType === 'true' ? 'true' : 'mean',      // G10 罗计交点 真/平
		guolaoLilithType: src.guolaoLilithType === 'true' ? 'true' : 'mean',  // G11 月孛远地点 真/平
		guolaoZiqiMode: 'real',  // G12 紫炁仅今法真算;'tablet'(28年立成)假档已隐藏,旧快照残留一律归一回 real
		guolaoTuibianMethod: (src.guolaoTuibianMethod === 'jintui' || src.guolaoTuibianMethod === 'huiyuan') ? src.guolaoTuibianMethod : 'jiyuan',  // WP-D 授时历古法推变法进缓存键
		guolaoGufaPrecess: (src.guolaoGufaPrecess === 1 || src.guolaoGufaPrecess === '1') ? 1 : 0,  // WP-D 古宿岁差进缓存键(否则切则命中旧盘)
		guolaoEqTropicalAnchor: src.guolaoEqTropicalAnchor === 'chunfen' ? 'chunfen' : 'dongzhi',  // 赤道回归锚点进缓存键
		guolaoBodyMode: `${src.guolaoBodyMode || 'taiyin'}`,  // G20/R3 身宫法(taiyin/youjin/地支自定);进缓存键→切则重取 moira
		guolaoLifeMode: normalizeGuolaoLifeMode(src.guolaoLifeMode),
		strongRecption: normalizeNumText(src.strongRecption, 0),
		simpleAsp: normalizeNumText(src.simpleAsp, 0),
		virtualPointReceiveAsp: normalizeNumText(src.virtualPointReceiveAsp, 0),
		predictive: normalizeNumText(src.predictive, 0),
		// v2.2.1: 两个全局开关必须进 cache key,否则切日界/晚子时后 key 不变 → 命中旧盘,刷新才生效。
		after23NewDay: normalizeNumText(src.after23NewDay, defaultAfter23NewDay()),
		lateZiHourUseNextDay: normalizeNumText(src.lateZiHourUseNextDay, defaultLateZiHourUseNextDay()),
		_su28Rev: src._su28Rev || GUOLAO_SU28_CACHE_REV,
	};
}

function buildGuolaoKey(input){
	try{
		return JSON.stringify(normalizeChartParams(input));
	}catch(e){
		return '';
	}
}

function isChartObjMatchParams(chartObj, params){
	if(!chartObj || !chartObj.params || !params){
		return false;
	}
	const chartKey = buildGuolaoKey(chartObj.params);
	const paramKey = buildGuolaoKey(params);
	return !!chartKey && chartKey === paramKey;
}

async function fetchGuolaoChartCached(params, options){
	const opt = options || {};
	const key = buildGuolaoKey(params);
	const disableCache = opt.cache === false;
	if(!disableCache && key && guolaoMem.has(key)){
		const cached = guolaoMem.get(key);
		if(hasGuolaoRiseSetFields(cached)){
			return clonePlain(cached);
		}
		guolaoMem.delete(key);
	}
	if(!disableCache && key && guolaoInflight.has(key)){
		const inflight = await guolaoInflight.get(key);
		return clonePlain(inflight);
	}
	const req = request(`${Constants.ServerRoot}/chart`, {
		body: JSON.stringify(params),
		silent: opt.silent !== false,
	}).then((data)=>{
		const result = data && data[Constants.ResultKey] ? data[Constants.ResultKey] : null;
		if(!disableCache && key && result){
			pushCache(guolaoMem, key, clonePlain(result));
		}
		return result;
	}).finally(()=>{
		if(!disableCache && key){
			guolaoInflight.delete(key);
		}
	});
	if(!disableCache && key){
		guolaoInflight.set(key, req);
	}
	const result = await req;
	return clonePlain(result);
}

// PERF-R8 P2(数据层空闲预热):按当前命盘 fields 预热七政「本命盘」进 guolaoMem —— 与用户
// 首点走完全相同的 fieldsToParams + fetchGuolaoChartCached 入口(key 同、body 同、结果逐字节同,
// 只是提前付)。仅暖本命:流年/Moira 规则依赖「此刻」的流年时间(makeDefaultMoiraTransitTime)
// =取现时端点,按预热白名单纪律禁入。存储样式为七政 kinastro 引擎时跳过(不同引擎路径,
// 预热本命盘对其无效)。失败静默;绝不 dispatch 任何全局 state。
export async function warmGuolaoNatal(fields){
	try{
		if(!fields || !fields.date || !fields.date.value || !fields.date.value.format){ return null; }
		if(!(fields.lon && fields.lon.value) || !(fields.lat && fields.lat.value)){ return null; }
		if(getStoredGuolaoChartStyle() === GUOLAO_CHART_STYLE_QIZHENG){ return null; }
		const params = fieldsToParams(fields);
		return await fetchGuolaoChartCached(params, { silent: true });
	}catch(e){
		return null; // 预热失败静默:首点回到冷即付的现状
	}
}

// ⚠️ 死代码(零调用,同类自检 v42 定性):主链=buildGuolaoSnapshotTextV2;本函数段头(宫位与星体/宫位二十八宿)
// 未登 preset 属死码段——若复活必须先登记 preset+migration(全树段头哨兵会咬)。
function buildGuolaoSnapshotText(params, result){
	const lines = [];
	const chart = result && result.chart ? result.chart : {};
	const houses = chart.houses || [];
	const objects = chart.objects || [];
	const signsRA = result && result.signsRA ? result.signsRA : [];
	const ziGods = result && result.nongli && result.nongli.bazi && result.nongli.bazi.guolaoGods
		? result.nongli.bazi.guolaoGods.ziGods : null;

	lines.push('[起盘信息]');
	lines.push(`日期：${params.date} ${params.time}`);
	lines.push(`时区：${params.zone}`);
	lines.push(`经纬度：${params.lon} ${params.lat}`);

	lines.push('');
	lines.push('[宫位与星体]');
	houses.forEach((house, idx)=>{
		lines.push(`宫位：${msg(house.id) || `第${idx + 1}宫`}`);
		const inHouse = objects.filter((obj)=>obj.house === house.id);
		if(inHouse.length === 0){
			lines.push('星体：无');
			lines.push('');
			return;
		}
		inHouse.forEach((obj)=>{
			const sd = splitDegree(obj.signlon);
			const su28 = obj.su28 ? `，宿:${obj.su28}` : '';
			lines.push(`星体：${msg(obj.id)} ${sd[0]}˚${msg(obj.sign)}${sd[1]}分${su28}`);
		});
		lines.push('');
	});

	if(signsRA.length){
		lines.push('');
		lines.push('[宫位二十八宿]');
		signsRA.forEach((sig)=>{
			lines.push(`${msg(sig.id)}：赤经${Math.round(sig.ra * 1000) / 1000}`);
		});
	}

	if(ziGods){
		lines.push('');
		lines.push('[神煞]');
		Object.keys(ziGods).forEach((zi)=>{
			const one = ziGods[zi] || {};
			const all = orderGods(one.allGods || [], MOIRA_BIRTH_GOD_ORDER);
			const tai = orderGods(one.taisuiGods || [], MOIRA_TRANSIT_GOD_ORDER);
			lines.push(`${zi}：神煞=${all.join('、') || '无'}；太岁神=${tai.join('、') || '无'}`);
		});
	}
	return lines.join('\n');
}

function buildGuolaoSuSection(result, planetDisplay){
	const chart = result && result.chart ? result.chart : {};
	const suHouses = chart && chart.fixedStarSu28 ? chart.fixedStarSu28 : [];
	const objects = chart && chart.objects ? chart.objects : [];
	const lines = [];
	let visibleSet = null;
	if(planetDisplay && planetDisplay.length){
		visibleSet = new Set(planetDisplay);
	}

	suHouses.forEach((su)=>{
		lines.push(`${su.name}`);
		let inSu = objects.filter((obj)=>{
			if(obj.su28 !== su.name){
				return false;
			}
			if(visibleSet){
				return visibleSet.has(obj.id);
			}
			return AstroConst.isTraditionPlanet(obj.id);
		});
		inSu = inSu.sort((a, b)=>{
			if(a.ra > 300 && b.ra < 30){
				return -1;
			}
			return a.ra - b.ra;
		});
		if(inSu.length === 0){
			lines.push('星体：无');
			lines.push('');
			return;
		}
		inSu.forEach((obj)=>{
			let radeg = Number(objectLon(obj)) - Number(su.ra);
			if(Number.isNaN(radeg)){
				radeg = Number(obj.signlon);
			}
			if(radeg < 0){
				radeg += 360;
			}
			const sd = splitDegree(radeg);
			lines.push(`星体：${msg(obj.id)} ${sd[0]}˚${obj.su28}${sd[1]}分`);
		});
		lines.push('');
	});

	return lines.join('\n').trim();
}

function signFromLon(lon){
	if(lon === undefined || lon === null || Number.isNaN(Number(lon))){
		return null;
	}
	let val = Number(lon) % 360;
	if(val < 0){
		val += 360;
	}
	const idx = Math.floor(val / 30) % 12;
	return AstroConst.LIST_SIGNS[idx];
}

function guolaoLifeModeFromFields(fields){
	if(fields && fields.guolaoLifeMode && fields.guolaoLifeMode.value !== undefined && fields.guolaoLifeMode.value !== null){
		return normalizeGuolaoLifeMode(fields.guolaoLifeMode.value);
	}
	return getStoredGuolaoLifeMode();
}

// 七政宿度制(su28Mode 0-4)：优先 fields.doubingSu28（页面选/存盘值，数据丢失修复后保真），
// 缺省回退 getStoredGuolaoSu28Mode（AI 挂载抽屉「宿度制」/全局默认 2）。与 命度/罗计 同口径。
function guolaoSu28ModeFromFields(fields){
	if(fields && fields.doubingSu28 && fields.doubingSu28.value !== undefined && fields.doubingSu28.value !== null){
		const v = Number(fields.doubingSu28.value);
		if([0, 1, 2, 3, 4, 5, 6, 7].indexOf(v) >= 0){
			return v;
		}
	}
	return getStoredGuolaoSu28Mode();
}

function guolaoLifeModeName(mode){
	const normalized = normalizeGuolaoLifeMode(mode);
	if(normalized === GUOLAO_LIFE_MODE_YUMAO){
		return '日出安命';
	}
	if(normalized === GUOLAO_LIFE_MODE_COTRANS){
		return '赤黄转换';
	}
	if(normalized === 'gumao'){
		return '遇卯安命(古法)';
	}
	if('子丑寅卯辰巳午未申酉戌亥'.indexOf(normalized) >= 0){
		return `自定命宫·${normalized}`;
	}
	return '占星上升';
}

function resolveHouseStartMode(fields){
	if(fields && fields.houseStartMode && fields.houseStartMode.value !== undefined && fields.houseStartMode.value !== null){
		return parseInt(fields.houseStartMode.value, 10) === SZConst.SZHouseStart_ASC
			? SZConst.SZHouseStart_ASC : SZConst.SZHouseStart_Bazi;
	}
	return SZConst.SZHouseStart_Bazi;
}

function computeAscSignIndex(result, chart, fields){
	const objects = chart && chart.objects ? chart.objects : [];
	const asc = objects.find((obj)=>obj.id === AstroConst.ASC);
	const sun = objects.find((obj)=>obj.id === AstroConst.SUN);
	if(!asc){
		return -1;
	}
	const ascIdx = Math.floor(Number(objectLon(asc)) / 30);
	const mode = resolveHouseStartMode(fields);
	if(mode === SZConst.SZHouseStart_ASC){
		return ascIdx;
	}
	const bazi = (chart && chart.nongli && chart.nongli.bazi)
		|| (result && result.nongli && result.nongli.bazi);
	if(!bazi || !sun){
		return ascIdx;
	}
	const timezi = bazi.time && bazi.time.branch ? bazi.time.branch.cell : null;
	const timesig = timezi ? SZConst.ZiSign[timezi] : null;
	const tmsigidx = timesig ? AstroConst.LIST_SIGNS.indexOf(timesig) : -1;
	if(tmsigidx < 0){
		return ascIdx;
	}
	const sunidx = Math.floor(Number(objectLon(sun)) / 30);
	return (sunidx - tmsigidx - 5 + 24) % 12;
}

function houseFullLabel(house, idx, ascSignIndex){
	let houseName = msg(house && house.id ? house.id : null) || `第${idx + 1}宫`;
	const sign = signFromLon(house ? house.lon : null);
	if(!sign){
		return houseName;
	}
	const signIdx = AstroConst.LIST_SIGNS.indexOf(sign);
	if(signIdx >= 0 && ascSignIndex >= 0){
		const hnum = (signIdx - ascSignIndex + 12) % 12 + 1;
		houseName = `第${hnum}宫`;
	}
	const zi = SZConst.SignZi[sign] || '';
	const area = (SZConst.SZSigns[signIdx] && SZConst.SZSigns[signIdx].length >= 2)
		? `${SZConst.SZSigns[signIdx][0]}${SZConst.SZSigns[signIdx][1]}`
		: '';
	const signName = AstroText.AstroMsgCN[sign] || msg(sign);
	return `${zi}—${area}—${signName}座—${houseName}`;
}

// GFM 表化(段内排版,值零变化):行=宫×宿(空宫一行 无/无),宫内星列表一 cell 内联「；」相接,
// 星字串(曜 d˚宿m分)与旧「星曜：」行逐字同。(宫位,宿,星)元组集合证明见 guolaoSnapshotTables.test.js。
export function buildHouseSuAndGodsSection(result, planetDisplay, fields){
	const chart = result && result.chart ? result.chart : {};
	const houses = chart && chart.houses ? chart.houses : [];
	const objects = chart && chart.objects ? chart.objects : [];
	const ascSignIndex = computeAscSignIndex(result, chart, fields);
	let visibleSet = null;
	if(planetDisplay && planetDisplay.length){
		visibleSet = new Set(planetDisplay);
	}
	const lines = [];

	houses.forEach((house, idx)=>{
		const label = houseFullLabel(house, idx, ascSignIndex);
		let inHouse = objects.filter((obj)=>{
			if(obj.house !== house.id){
				return false;
			}
			if(visibleSet){
				return visibleSet.has(obj.id);
			}
			return AstroConst.isTraditionPlanet(obj.id);
		});
		inHouse = inHouse.sort((a, b)=>{
			if(a.ra > 300 && b.ra < 30){
				return -1;
			}
			return a.ra - b.ra;
		});

		if(inHouse.length === 0){
			lines.push(`| ${label} | 无 | 无 |`);
			return;
		}
		const suMap = new Map();
		inHouse.forEach((obj)=>{
			const su = obj.su28 || '未知宿';
			if(!suMap.has(su)){
				suMap.set(su, []);
			}
			suMap.get(su).push(obj);
		});

		const suKeys = Array.from(suMap.keys()).sort((a, b)=>{
			const ia = Su28Helper.Su28.indexOf(a);
			const ib = Su28Helper.Su28.indexOf(b);
			if(ia < 0 && ib < 0){
				return `${a}`.localeCompare(`${b}`);
			}
			if(ia < 0){
				return 1;
			}
			if(ib < 0){
				return -1;
			}
			return ia - ib;
		});

		suKeys.forEach((su)=>{
			const list = suMap.get(su) || [];
			const stars = list.map((obj)=>{
				let radeg = Number(objectLon(obj));
				if(!Number.isNaN(radeg)){
					const suRef = (chart.fixedStarSu28 || []).find((it)=>it.name === su);
					if(suRef && suRef.ra !== undefined && suRef.ra !== null){
						radeg = Number(objectLon(obj)) - Number(suRef.ra);
						if(radeg < 0){
							radeg += 360;
						}
					}else{
						radeg = Number(obj.signlon);
					}
				}else{
					radeg = Number(obj.signlon);
				}
				const sd = splitDegree(radeg);
				return `${msg(obj.id)} ${sd[0]}˚${su}${sd[1]}分`;
			});
			lines.push(`| ${label} | ${su} | ${stars.join('；') || '无'} |`);
		});
	});
	if(!lines.length){
		return '';
	}
	return ['| 宫位 | 二十八宿 | 星曜 |', '| --- | --- | --- |'].concat(lines).join('\n').trim();
}

function buildHouseGodsSection(result, fields){
	const chart = result && result.chart ? result.chart : {};
	const houses = chart && chart.houses ? chart.houses : [];
	const ascSignIndex = computeAscSignIndex(result, chart, fields);
	const rootZiGods = result && result.nongli && result.nongli.bazi && result.nongli.bazi.guolaoGods
		? result.nongli.bazi.guolaoGods.ziGods : null;
	const chartZiGods = chart && chart.nongli && chart.nongli.bazi && chart.nongli.bazi.guolaoGods
		? chart.nongli.bazi.guolaoGods.ziGods : null;
	const ziGods = chartZiGods || rootZiGods || null;
	const lines = [];

	houses.forEach((house, idx)=>{
		lines.push(`宫位：${houseFullLabel(house, idx, ascSignIndex)}`);
		const sign = signFromLon(house.lon);
		const zi = sign ? SZConst.SignZi[sign] : null;
		const gz = ziGods && zi ? ziGods[zi] : null;
		const allGods = orderGods(gz ? []
			.concat(gz.goodGods || [])
			.concat(gz.neutralGods || [])
			.concat(gz.badGods || []) : [], MOIRA_BIRTH_GOD_ORDER);
		const taiGods = orderGods(gz ? (gz.taisuiGods || []) : [], MOIRA_TRANSIT_GOD_ORDER);
		lines.push(`神煞：${allGods.join('、') || '无'}`);
		lines.push(`太岁神：${taiGods.join('、') || '无'}`);
		lines.push('');
	});

	return lines.join('\n').trim();
}

// 供 AI 分析无头复算：按出生字段取七政四余盘并生成快照（命度/罗计沿用已保存设置，显示全部传统星曜）。
export async function buildGuolaoSnapshotForFields(fields){
	if(!fields){
		return '';
	}
	const params = fieldsToParams(fields);
	const data = await request(`${Constants.ServerRoot}/chart`, {
		body: JSON.stringify({ ...params, cid: null }),
		silent: true,
	});
	const result = data && data[Constants.ResultKey] ? data[Constants.ResultKey] : null;
	if(!result){
		return '';
	}
	return buildGuolaoSnapshotTextV2(params, result, null, fields);
}

// AI 快照·神煞段与盘面同源(rules 引擎 godHits+十二长生;rules 未到回退历法 ziGods)——
// 「显示什么就导出什么」:盘面/右栏已切 rules 源,快照必须同步,防 AI 拿到另一套神煞。
function buildRulesGodsSection(moiraRules){
	const hits = moiraRules && moiraRules.godHits;
	if(!hits || !hits.length){
		return '';
	}
	const ZHI12 = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
	const out = [];
	ZHI12.forEach((zi)=>{
		const gods = moiraGodsFromRuleHits(moiraRules, zi, 'birth') || [];
		const ll = moiraLongLifeCharFor(moiraRules, zi, 'birth');
		const all = (ll ? [ll] : []).concat(gods);
		if(all.length){
			out.push(`${zi}：${all.join('、')}`);
		}
	});
	return out.join('\n');
}

// AI 快照·星曜庙旺与星点动态段（与右栏「星点动态」表同源函数 glStarDignity/glStarMotion，单一真值）：
// 每点 曜｜地支｜所属(殿垣庙旺乐喜怒)｜速度态(顺逆留伏迟速)。天海冥无庙旺、升顶无庙旺无自行 → '-'。
// GFM 表化(段内排版,值零变化):所属/速度态字串(glStarDignity·连、glStarMotion)与旧「所属:X 速度:Y」逐字同,
// 仅去内联「所属:」「速度:」标签移入表头。31 golden(guolaoDignityMotion.test.js)锚的是底层算法值、不受排版影响;
// (曜,地支,所属,速度态) 元组集合证明见 guolaoSnapshotTables.test.js。
export function buildStarDignityMotionSection(result, fields){
	const chart = result && result.chart ? result.chart : {};
	const objects = Array.isArray(chart.objects) ? chart.objects : [];
	if(!objects.length){ return ''; }
	const ecl = chart.displayCoord === 'ecliptic';
	const ZLIST = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
	const ziOf = (lon)=>{ const n = ((lon % 360) + 360) % 360; const s = Math.floor(n / 30) % 12; return ZLIST[(10 - s + 12) % 12] || ''; };
	const lonOf = (obj)=>{ const raw = obj && (ecl && obj.lon !== undefined ? obj.lon : (obj.ra !== undefined ? obj.ra : obj.lon)); return Number(raw); };
	const sun = objects.find((o)=>o && o.id === AstroConst.SUN);
	const sunLon = sun ? lonOf(sun) : NaN;
	const STAR_POINTS = [
		['日', AstroConst.SUN], ['月', AstroConst.MOON], ['金', AstroConst.VENUS], ['木', AstroConst.JUPITER],
		['水', AstroConst.MERCURY], ['火', AstroConst.MARS], ['土', AstroConst.SATURN],
		['计', AstroConst.SOUTH_NODE], ['罗', AstroConst.NORTH_NODE], ['炁', AstroConst.PURPLE_CLOUDS], ['孛', AstroConst.DARKMOON],
		['天', AstroConst.URANUS], ['海', AstroConst.NEPTUNE], ['冥', AstroConst.PLUTO],
	];
	const ANGLE_POINTS = [['升', AstroConst.ASC], ['顶', AstroConst.MC]];
	const rows = [];
	STAR_POINTS.forEach(([name, id])=>{
		const obj = objects.find((o)=>o && o.id === id);
		if(!obj){ return; }
		const lon = lonOf(obj);
		if(!Number.isFinite(lon)){ return; }
		const zhi = ziOf(lon);
		const ex = GL_EXALT_DEG[name];
		const atPeak = !!(ex && Math.floor((((lon % 360) + 360) % 360) / 30) % 12 === ex.signIndex && Math.abs((((lon % 360) + 360) % 360) % 30 - ex.deg) <= 1);
		const combust = glStarCombust(name, lon, sunLon);   // Moira 合日 3°(单一真值,与右栏星点动态同源)
		const belong = glStarDignity(name, zhi, atPeak).join('·') || '-';
		const motion = glStarMotion(name, Number(obj.lonspeed), combust) || '-';
		rows.push(`| ${name} | ${zhi} | ${belong} | ${motion} |`);
	});
	ANGLE_POINTS.forEach(([name, id])=>{
		const obj = objects.find((o)=>o && o.id === id);
		if(!obj){ return; }
		const lon = lonOf(obj);
		if(!Number.isFinite(lon)){ return; }
		rows.push(`| ${name} | ${ziOf(lon)} | - | - |`);
	});
	if(!rows.length){
		return '';
	}
	return ['| 曜 | 地支 | 所属 | 速度态 |', '| --- | --- | --- | --- |'].concat(rows).join('\n');
}

// AI 快照·流年流曜段（右栏「流曜」快捷面板已显示但此前未导出）：与 renderQuickTransitStars 同一取数——
// 流年干支=rules.yearStars.transit.yearPole（缺则按 UI 同式 stemBranchForYear(流年时间之年) 兜底）；
// 流年化曜=rules.yearStars.transit.planetRows（曜/化曜/同归项）；流曜落宫=rules.transitYearStars（宫名/化曜/曜名/宫性）。
// 流年时间口径=UI 默认（paramsWithMoiraTransit 缺省走 makeDefaultMoiraTransitTime，即「当前流年」）。
// 无规则层或无流年数据（未起盘/headless 复算）→ 返回 ''（不产段）；异常降级 ''，不影响既有段。
// [虚实] 段(v44 硬缺修):虚实 tab 整层此前显示了完全导不出——虚宫(四柱旬空推)/实宫(四柱地支定)
// 是果老明确断项。值与 renderQuickWeakSolid 主路同源(moiraRules.weakSolid.houses);无数据不产段。
export function buildGuolaoWeakSolidSection(moiraRules){
	try{
		const rows = safeList(safeMap(safeMap(moiraRules).weakSolid).houses);
		if(!rows.length){
			return '';
		}
		const out = [];
		out.push('| 宫位 | 虚实 | 虚柱 | 实柱 |');
		out.push('| --- | --- | --- | --- |');
		rows.forEach((house)=>{
			out.push(`| ${house.house || '—'} | ${house.label || '—'} | ${joinNames(house.weakPillars) || '—'} | ${joinNames(house.solidPillars) || '—'} |`);
		});
		out.push('口径：虚宫按四柱旬空推虚；实宫按年、月、日、时四柱地支定实。');
		return out.join('\n');
	}catch(e){
		return '';
	}
}

// [本命化曜] 段(v44 半缺修):化曜 tab 此前只导流年侧——本命化曜为核心,十神序/天禄至天权为参考表。
// 值与 renderQuickYearStars 的本命侧同源(moiraRules.yearStars.birth);无数据不产段。
export function buildGuolaoBirthStarsSection(moiraRules){
	try{
		const birthYearStars = safeMap(safeMap(safeMap(moiraRules).yearStars).birth);
		const planetRows = safeList(birthYearStars.planetRows);
		if(!planetRows.length){
			return '';
		}
		const out = [];
		if(birthYearStars.yearPole){
			out.push(`本命年柱：${birthYearStars.yearPole}`);
		}
		out.push('◆ 本命化曜');
		planetRows.forEach((row)=>{
			const items = safeList(row.items).length ? joinNames(row.items) : '';
			out.push(`${row.star}：化${row.changeTo || '-'}${items && items !== '无' ? `（同归：${items}）` : ''}`);
		});
		out.push('◆ 十神序（参考）');
		out.push(`原十神序：${MOIRA_TEN_GOD_ORG.join('、')}`);
		out.push(`替代十神序：${MOIRA_TEN_GOD_ALT.join('、')}`);
		out.push('◆ 天禄至天权（年曜主项）');
		MOIRA_YEAR_INFO_GROUPS.forEach((items)=>{
			out.push(`${items[0]}：${items.slice(1).join('、') || '主项'}`);
		});
		return out.join('\n');
	}catch(e){
		return '';
	}
}

function buildGuolaoTransitStarsSection(fields, moiraRules){
	try{
		if(!moiraRules){
			return '';
		}
		const currentYearStars = safeMap(safeMap(moiraRules.yearStars).transit);
		const planetRows = safeList(currentYearStars.planetRows);
		const signRows = safeList(moiraRules.transitYearStars);
		if(!planetRows.length && !signRows.length){
			return '';
		}
		const out = [];
		const yearGz = currentYearStars.yearPole
			|| stemBranchForYear(yearFromParams(paramsWithMoiraTransit(fields, null)));
		if(yearGz){
			out.push(`流年干支：${yearGz}`);
		}
		if(planetRows.length){
			out.push('◆ 流年化曜');
			planetRows.forEach((row)=>{
				const items = safeList(row.items).length ? joinNames(row.items) : '';
				out.push(`${row.star}：化${row.changeTo || '-'}${items && items !== '无' ? `（同归：${items}）` : ''}`);
			});
		}
		if(signRows.length){
			out.push('◆ 流曜落宫');
			signRows.forEach((row)=>{
				const pos = [row.quality, row.zi, row.signName].filter(Boolean).join(' · ');
				out.push(`${row.name}：${row.star || '-'}（${row.shortName || '-'}${pos ? `；${pos}` : ''}）`);
			});
		}
		return out.join('\n');
	}catch(e){
		return '';
	}
}

function buildGuolaoSnapshotTextV2(params, result, planetDisplay, fields, moiraRules){
	const _snapChart = result && result.chart ? result.chart : result;
	SNAPSHOT_PREFER_LON = !!(_snapChart && _snapChart.displayCoord === 'ecliptic');
	const lines = [];
	const chart = result && result.chart ? result.chart : {};
	const rootZiGods = result && result.nongli && result.nongli.bazi && result.nongli.bazi.guolaoGods
		? result.nongli.bazi.guolaoGods.ziGods : null;
	const chartZiGods = chart && chart.nongli && chart.nongli.bazi && chart.nongli.bazi.guolaoGods
		? chart.nongli.bazi.guolaoGods.ziGods : null;
	const ziGods = chartZiGods || rootZiGods || null;

	lines.push('[起盘信息]');
	lines.push(`日期：${params.date} ${params.time}`);
	lines.push(`时区：${params.zone}`);
	lines.push(`经纬度：${params.lon} ${params.lat}`);
	lines.push(`七政命度：${guolaoLifeModeName(guolaoLifeModeFromFields(fields))}`);
	lines.push(`罗计：${guolaoNodeModeName(guolaoNodeModeFromFields(fields))}`);
	// G6/G10/G11 起盘设置注入快照(AI 报告据此解读报时星/四余取法)。
	const _gTs = guolaoFieldValue(fields, 'guolaoTrueSolarTime', getStoredGuolaoTrueSolarTime);
	const _gNt = guolaoFieldValue(fields, 'guolaoNodeType', getStoredGuolaoNodeType);
	const _gLt = guolaoFieldValue(fields, 'guolaoLilithType', getStoredGuolaoLilithType);
	lines.push(`报时星太阳时：${_gTs === 'off' ? '钟表时' : (_gTs === 'mean' ? '平太阳时(仅经度)' : '真太阳时(经度+均时差)')}`);
	lines.push(`罗计取法：${_gNt === 'true' ? '真交点' : '平交点'}；月孛取法：${_gLt === 'true' ? '真远地点' : '平远地点'}`);
	// G20/G22/G31/G3 身宫法/命主取法/行运法/宿度制 注入快照。身宫法读 fields(类A);命主取法/行运法读全局显示偏好(类B)。
	const _gBody = guolaoFieldValue(fields, 'guolaoBodyMode', getStoredGuolaoBodyMode);
	const _gDisp = getStoredGuolaoDisplay() || {};
	const _su28Name = SU28_MODE_LABEL[guolaoSu28ModeFromFields(fields)] || '回归今宿';   // 单源 SU28_MODE_LABEL(WP-A,消第三套漂移)
	const _lmName = { gong: '宫主', du: '度主', dudegrade: '贬宫主专度主' }[_gDisp.lifeMasterMode || 'gong'] || '宫主';
	const _mlName = { '': '古度限度法', dongwei: '洞微大限', minor: '小限', month: '月限', tong: '童限' }[_gDisp.minorLimitType || ''] || '古度限度法';
	const _gBodyName = _gBody === 'youjin' ? '逢酉(琴堂)' : ('子丑寅卯辰巳午未申酉戌亥'.indexOf(_gBody) >= 0 ? `自定身宫·${_gBody}` : '太阴落宫(果老)');
	lines.push(`宿度制：${_su28Name}；身宫法：${_gBodyName}`);
	lines.push(`命主取法：${_lmName}；行运法：${_mlName}`);
	lines.push('');

	lines.push('[七政四余宫位与二十八宿星曜]');
	lines.push(buildHouseSuAndGodsSection(result, planetDisplay, fields) || '无');
	lines.push('');
	lines.push('[星曜庙旺与星点动态（殿垣庙旺乐喜怒 · 顺逆留伏迟速）]');
	lines.push(buildStarDignityMotionSection(result, fields) || '无');
	lines.push('');
	lines.push('[神煞]');
	lines.push(buildRulesGodsSection(moiraRules) || buildHouseGodsSection(result, fields) || '无');
	lines.push('');
	lines.push('[大限]');
	lines.push(buildGuolaoLimitSection(chart, fields, params, _gDisp.minorLimitType || '', _gDisp.tongxianBase || 'tong10') || '无');
	lines.push('');
	// 虚实段（v44 硬缺补挂，纯增）：有 weakSolid 规则数据才产段，缺数据时既有输出逐字不变。
	const weakSolidSection = buildGuolaoWeakSolidSection(moiraRules);
	if(weakSolidSection){
		lines.push('[虚实]');
		lines.push(weakSolidSection);
		lines.push('');
	}
	// 本命化曜段（v44 半缺补挂，纯增）：此前只导流年侧。
	const birthStarsSection = buildGuolaoBirthStarsSection(moiraRules);
	if(birthStarsSection){
		lines.push('[本命化曜]');
		lines.push(birthStarsSection);
		lines.push('');
	}
	// 流年流曜段（A 类硬缺补挂，纯增）：有流年规则数据才产段，缺数据时既有输出逐字不变。
	const transitStarsSection = buildGuolaoTransitStarsSection(fields, moiraRules);
	if(transitStarsSection){
		lines.push('[流年流曜]');
		lines.push(transitStarsSection);
		lines.push('');
	}
	lines.push('[政余格局]');
	lines.push(buildGuolaoPatternSection(result, fields, params) || '无');
	lines.push('');
	lines.push('[相位]');
	lines.push(buildGuolaoAspectSection(result) || '无');
	return lines.join('\n').trim();
}

// AI 快照·政余格局段（右栏「格局」面板已显示但此前未导出）：复用盘面同源 buildLocalMoiraPatterns
// （styleSource=moira-dsl-local-evaluated，本地已评估、非屏蔽态），喜/忌/察看分组与右栏一致；异常降级「无」，不影响既有段。
function buildGuolaoPatternSection(result, fields, params){
	try{
		const godRows = buildGodRowsFromChart(result, fields);
		const patterns = buildLocalMoiraPatterns(result, fields, params, godRows) || [];
		if(!patterns.length){
			return '无';
		}
		const fmt = (list)=>list.map((it)=>`${it.name}（${it.detail || it.dsl || ''}）`).join('；');
		const good = patterns.filter((it)=>it.level === 'good');
		const bad = patterns.filter((it)=>it.level === 'bad');
		const other = patterns.filter((it)=>it.level !== 'good' && it.level !== 'bad');
		const out = [];
		out.push(`喜格：${good.length ? fmt(good) : '（无）'}`);
		out.push(`忌格：${bad.length ? fmt(bad) : '（无）'}`);
		if(other.length){
			out.push(`察看：${fmt(other)}`);
		}
		return out.join('\n');
	}catch(e){
		return '无';
	}
}

// AI 快照·相位段（右栏「相位」面板已显示但此前未导出）：复用 buildAspectRows，与盘面相位表同源；异常降级「无」。
export function buildGuolaoAspectSection(result){
	try{
		const chart = getChart(result);
		const aspects = (chart && chart.aspects) || (result && result.aspects) || null;
		const rows = buildAspectRows(aspects);
		if(!rows || !rows.length){
			return '无';
		}
		// GFM 表化(段内排版,值零变化):五元组(主体/相位/对象/状态/误差)与旧行一一对应,
		// 无误差值 cell='—'(旧行该情形整个省略「，误差X」)。元组集合证明见 guolaoSnapshotTables.test.js。
		const out = [];
		out.push('| 主体 | 相位 | 对象 | 状态 | 误差 |');
		out.push('| --- | --- | --- | --- | --- |');
		rows.forEach((row)=>{
			out.push(`| ${row.from} | ${row.aspect} | ${row.to} | ${row.state} | ${row.orb || '—'} |`);
		});
		return out.join('\n');
	}catch(e){
		return '无';
	}
}

// AI 快照·大限段：复用 Moira 命盘轮的命度→十二宫大限算法（moiraBuildLimitTable/lifeDegree），
// 保证导出/挂载与盘面「命身与限度·大限」列表完全同口径。出生年取自 params.date（YYYY/MM/DD）。
export function buildGuolaoLimitSection(chart, fields, params, minorLimitType, tongxianBase){
	try{
		const lifeDeg = lifeDegree(chart, fields);
		const birthYear = Number(String(params.date || '').split('/')[0]) || 0;
		const rows = buildLimitTable(lifeDeg, birthYear);
		const out = [];
		if(rows && rows.length){
			// GFM 表化(段内排版,值零变化):cell 沿用旧行字面片段(第N限/a-b岁/a-b年/约N年),
			// fact-multiset 证明见 guolaoSnapshotTables.test.js。
			out.push('古度限度法（命度十二宫大限）：');
			out.push('| 限 | 宫 | 起讫岁 | 起讫年 | 年数 |');
			out.push('| --- | --- | --- | --- | --- |');
			rows.forEach((row)=>{
				out.push(`| 第${row.index}限 | ${row.palace || '—'} | ${row.fromAge}-${row.toAge}岁 | ${row.fromYear}-${row.toYear}年 | 约${row.years}年 |`);
			});
		}
		// WP-E：所选行运法(类B minorLimitType)结构同入快照——洞微大限含飞星吊度,童限顺排,小限/月限注明法。
		const mlt = String(minorLimitType || '');
		if(mlt === 'dongwei'){
			const sun = findChartObject(chart, AstroConst.SUN);
			if(sun && Number.isFinite(Number(sun.lon))){
				const dw = glDongwei(((Number(sun.lon) % 30) + 30) % 30);
				out.push('');
				out.push(`洞微大限（命宫顺行·飞星吊度·起限${dw.startAge}岁）：`);
				out.push('| 限 | 宫 | 起讫岁 | 年数 | 吊度 |');
				out.push('| --- | --- | --- | --- | --- |');
				dw.rows.forEach((r)=>{
					out.push(`| 第${r.index}限 | ${r.palace || '—'} | ${r.fromAge}-${r.toAge}岁 | ${r.years}年 | 入${r.entryDeg}°·每年吊度${r.perYearDeg}° |`);
				});
			}
		}else if(mlt === 'tong'){
			const sun = findChartObject(chart, AstroConst.SUN);
			if(sun && Number.isFinite(Number(sun.lon))){
				const tx = glTongxian(Number(sun.lon), tongxianBase || 'tong10');
				out.push('');
				out.push(`童限：命财疾妻福顺排（${tx.palaces.join('→')}），出童限约${tx.exitAge}岁。`);
			}
		}else if(mlt === 'minor'){
			out.push('');
			out.push('小限：生年支加命宫逆数（age1=命宫宫支，逐年逆行一宫，12年一轮）。');
		}else if(mlt === 'month'){
			out.push('');
			out.push('月限：由当年小限宫起生月、按月逆寻（节气月口径）。');
		}
		return out.join('\n');
	}catch(e){
		return '';
	}
}

function fieldsToParams(fields){
	const su28Mode = guolaoSu28ModeFromFields(fields);
	const params = {
		date: fields.date.value.format('YYYY/MM/DD'),
		time: fields.time.value.format('HH:mm:ss'),
		ad: (fields.ad && fields.ad.value !== undefined) ? fields.ad.value : (fields.date.value.ad || 1),
		zone: fields.zone.value,
		lat: fields.lat.value,
		lon: fields.lon.value,
		gpsLat: fields.gpsLat.value,
		gpsLon: fields.gpsLon.value,
		hsys: 0,
		zodiacal: su28Mode === GUOLAO_SU28_MODE_ZHENG_SIDEREAL ? 1 : 0,
		tradition: fields.tradition.value,
		doubingSu28: su28Mode,
		guolaoZhengSidereal: su28Mode === GUOLAO_SU28_MODE_ZHENG_SIDEREAL ? 1 : 0,
		guolaoLifeMode: guolaoLifeModeFromFields(fields),
		strongRecption: fields.strongRecption.value,
		simpleAsp: fields.simpleAsp.value,
		virtualPointReceiveAsp: fields.virtualPointReceiveAsp.value,
		predictive: 0,
		name: fields.name.value,
		pos: fields.pos.value,
		after23NewDay: (fields.after23NewDay && fields.after23NewDay.value !== undefined) ? fields.after23NewDay.value : defaultAfter23NewDay(),
		lateZiHourUseNextDay: (fields.lateZiHourUseNextDay && fields.lateZiHourUseNextDay.value !== undefined) ? fields.lateZiHourUseNextDay.value : defaultLateZiHourUseNextDay(),
		_su28Rev: GUOLAO_SU28_CACHE_REV,
	};

	// G2 恒星制岁差:仅恒星宿度制 + 用户选了 ayanāṃśa 才透传(复用既有 siderealAyanamsa 键;ChartController 已转发、perchart 已用;缺=郑氏默认零回归)。
	const guolaoAyan = guolaoAyanamsaFromFields(fields);
	if(su28Mode === GUOLAO_SU28_MODE_ZHENG_SIDEREAL && guolaoAyan){
		params.siderealAyanamsa = guolaoAyan;
	}

	// G6 报时星太阳时:仅非默认(真)才透传,默认 true → perchart 缺键即 true → 零回归。
	const trueSolar = guolaoFieldValue(fields, 'guolaoTrueSolarTime', getStoredGuolaoTrueSolarTime);
	if(trueSolar === 'mean' || trueSolar === 'off'){
		params.trueSolarTime = trueSolar;
	}
	// G10-13 四余取法:仅非默认才透传(罗计/月孛默认平 mean),默认=零回归。
	// 紫炁取法只有「今法真算」一档生效('tablet' 假档已隐藏),故永不透传 guolaoZiqiMode → 后端始终走真算。
	if(guolaoFieldValue(fields, 'guolaoNodeType', getStoredGuolaoNodeType) === 'true'){
		params.guolaoNodeType = 'true';
	}
	if(guolaoFieldValue(fields, 'guolaoLilithType', getStoredGuolaoLilithType) === 'true'){
		params.guolaoLilithType = 'true';
	}
	// WP-D 授时历古法(用制 6):推变黄道术法(纪元闭式默认/进退/会圆)+ 古宿随岁差。仅 mode6 且非默认才透传 → 缺=纪元·不随岁差零回归。
	if(su28Mode === GUOLAO_SU28_MODE_GUFA_LICHENG){
		const _tuibian = guolaoFieldValue(fields, 'guolaoTuibianMethod', getStoredGuolaoTuibianMethod);
		if(_tuibian === 'jintui' || _tuibian === 'huiyuan'){ params.guolaoTuibianMethod = _tuibian; }
		if(guolaoFieldValue(fields, 'guolaoGufaPrecess', getStoredGuolaoGufaPrecess)){ params.guolaoGufaPrecess = 1; }
	}
	// 赤道回归制锚点(mode7 元明 / mode8 实时 同款):仅两制且非默认(牛前冬至)才透传 → 缺=牛前冬至零回归。
	if(su28Mode === GUOLAO_SU28_MODE_EQUATORIAL_TROPICAL || su28Mode === GUOLAO_SU28_MODE_EQUATORIAL_TROPICAL_LIVE){
		const _anchor = guolaoFieldValue(fields, 'guolaoEqTropicalAnchor', getStoredGuolaoEqTropicalAnchor);
		if(_anchor === 'chunfen'){ params.guolaoEqTropicalAnchor = 'chunfen'; }
	}
	// G20/R3 身宫法:琴堂(youjin)或自定身宫(地支子~亥)透传(进 moira params);默认果老(taiyin)不发=零回归。
	const bodyMode = guolaoFieldValue(fields, 'guolaoBodyMode', getStoredGuolaoBodyMode);
	if(bodyMode && bodyMode !== 'taiyin'){
		params.guolaoBodyMode = bodyMode;
	}
	// R2 自定命宫:命度法值=地支(子~亥)即自定命宫,已随 guolaoLifeMode 透传(BaZi 按地支当 custom 算),无需额外键。

	return params;
}

function guolaoFieldValue(fields, key, fallbackGetter){
	if(fields && fields[key] && fields[key].value !== undefined && fields[key].value !== null && `${fields[key].value}` !== ''){
		return `${fields[key].value}`;
	}
	return fallbackGetter ? fallbackGetter() : '';
}

function guolaoAyanamsaFromFields(fields){
	if(fields && fields.guolaoAyanamsa && fields.guolaoAyanamsa.value !== undefined && fields.guolaoAyanamsa.value !== null && `${fields.guolaoAyanamsa.value}` !== ''){
		return `${fields.guolaoAyanamsa.value}`;
	}
	return getStoredGuolaoAyanamsa();
}

function makeDefaultMoiraTransitTime(fields){
	const tm = new DateTime();
	if(fields && fields.zone && fields.zone.value){
		tm.setZone(fields.zone.value);
	}
	return tm;
}

function paramsWithMoiraTransit(fields, transitTime){
	const params = fieldsToParams(fields);
	const tm = transitTime || makeDefaultMoiraTransitTime(fields);
	if(tm){
		params.date = tm.format('YYYY/MM/DD');
		params.time = tm.format('HH:mm:ss');
		params.ad = tm.ad;
		params.zone = tm.zone || params.zone;
		params.predictive = 1;
	}
	return params;
}

// ── horosa_guolao_scu_slice_v1(PERF-R9 Ship 6)────────────────────────────────
// 原 sCU 是「nextState !== this.state → true」的恒真型:任何一次 setState(哪怕写的是
// render() 压根不读的字段)都要把 4000 行的整棵树 + SVG 大盘重渲一遍。
// 白名单只收**经全文核对 render()/render 子例程从不读取**的字段;拿不准的一律不收(判「变了」)。
//   · tips           —— 仅 onTipClick 写入(2213/2932 两处出现,零读取点);点星提示不该重画整盘。
//   · electionLoading —— 仅做在途标记,渲染层无任何消费点。
const GUOLAO_SCU_IGNORED_STATE = {
	tips: true,
	electionLoading: true,
};

function guolaoStateChangeMatters(prev, next){
	if(prev === next){
		return false;
	}
	if(!prev || !next){
		return true; // 拿不准 → 判「变了」(正确性优先)
	}
	const keys = Object.keys(next);
	if(keys.length !== Object.keys(prev).length){
		return true; // 键集变化 → 判「变了」
	}
	for(let i = 0; i < keys.length; i += 1){
		const k = keys[i];
		if(Object.is(prev[k], next[k])){
			continue;
		}
		if(!GUOLAO_SCU_IGNORED_STATE[k]){
			return true;
		}
	}
	return false;
}

function GuoLaoChartSkeleton(){
	return (
		<div className="horosa-guolao-chart-skeleton" aria-busy="true">
			<div className="horosa-guolao-chart-skeleton-ring" />
			<div className="horosa-guolao-chart-skeleton-ring is-mid" />
			<div className="horosa-guolao-chart-skeleton-ring is-core" />
			<div className="horosa-guolao-chart-skeleton-hint">排盘中…</div>
		</div>
	);
}

// ── horosa_guolao_stage_memo_v1(PERF-R9 Ship 6)───────────────────────────────
// 中栏盘面(三种轮盘 + 骨架)独立成 React.memo 边界:GuoLaoMoiraWheel/PickWheel/GuoLaoChart
// 三者**都没有 sCU**,此前 Main 每重渲一次就把整张 SVG 大盘从头算一遍(几何+神煞环+相位线)。
// 边界内用到的每一个值都由 props 显式传入(无闭包读 this.state/this.props),故默认浅比较
// 完备:任一可见输入变化必重渲,零陈旧。transitParams/declination 在 Main 侧做了按输入记忆化
// (否则每次 render 现造新对象 → 浅比较必失效)。
const GuoLaoChartStage = memo(function GuoLaoChartStage(props){
	const {
		variant, rootValue, value, transitValue, transitParams, transitLoading, moiraRules,
		display, showMoiraTransitGods, election, electionData, declination, declinationOutOfRange,
		height, fields, chartDisplay, planetDisplay, onTipClick, onAgeClick,
	} = props;
	if(variant === 'skeleton'){
		return <GuoLaoChartSkeleton />;
	}
	if(variant === 'pick'){
		return (
			<GuoLaoMoiraPickWheel
				rootValue={rootValue}
				value={value}
				transitValue={transitValue}
				transitParams={transitParams}
				transitLoading={transitLoading}
				moiraRules={moiraRules}
				aspectSet={display.aspects}
				aspectOrbs={display.aspectOrbs}
				hiddenPlanets={display.hiddenPlanets}
				hiddenGodsBirth={display.hiddenGodsBirth}
				hiddenGodsTransit={display.hiddenGodsTransit}
				showDignity={display.dignity}
				showMountains={display.mountains}
				showBirthGods={display.birthGods}
				showAgeRing={display.ageRing}
				limitChildBase={display.limitChildBase}
				onAgeClick={onAgeClick}
				limitYearBoundary={display.limitYearBoundary}
				election={election}
				electionData={electionData}
				declination={declination}
				declinationOutOfRange={declinationOutOfRange}
				height={height}
				fields={fields}
				chartDisplay={chartDisplay}
				planetDisplay={planetDisplay}
				onTipClick={onTipClick}
			/>
		);
	}
	if(variant === 'moira'){
		return (
			<GuoLaoMoiraWheel
				rootValue={rootValue}
				value={value}
				election={election}
				electionData={electionData}
				transitValue={transitValue}
				transitParams={transitParams}
				transitLoading={transitLoading}
				showAspectsMode={display.showAspects === true}
				showMoiraTransitGods={showMoiraTransitGods}
				moiraRules={moiraRules}
				aspectSet={display.aspects}
				aspectOrbs={display.aspectOrbs}
				hiddenPlanets={display.hiddenPlanets}
				hiddenGodsBirth={display.hiddenGodsBirth}
				hiddenGodsTransit={display.hiddenGodsTransit}
				showDignity={display.dignity}
				showMountains={display.mountains}
				showBirthGods={display.birthGods}
				showAgeRing={display.ageRing}
				limitChildBase={display.limitChildBase}
				onAgeClick={onAgeClick}
				limitYearBoundary={display.limitYearBoundary}
				height={height}
				fields={fields}
				chartDisplay={chartDisplay}
				planetDisplay={planetDisplay}
				onTipClick={onTipClick}
			/>
		);
	}
	return (
		<GuoLaoChart
			value={value}
			height={height}
			fields={fields}
			chartDisplay={chartDisplay}
			planetDisplay={planetDisplay}
			onTipClick={onTipClick}
		/>
	);
});


class GuoLaoChartMain extends Component{
	constructor(props) {
		super(props);
		const storedChartStyle = getStoredGuolaoChartStyle();
		const storedEngineMode = storedChartStyle === GUOLAO_CHART_STYLE_QIZHENG ? 'kinastro' : getStoredGuolaoEngineMode();
		this.state = {
			chartObj: null,
			moiraTransitTime: makeDefaultMoiraTransitTime(props.fields),
			moiraTransitChartObj: null,
			moiraTransitLoading: false,
			tips: null,
			moiraRules: null,
			moiraPanelChartObj: null,
			moiraPanelTransitChartObj: null,
			moiraPanelTransitParams: null,
			moiraLoading: false,
			bundleLoading: false,
			guolaoDisplay: getStoredGuolaoDisplay(),
			chartStyle: storedEngineMode === 'kinastro' ? GUOLAO_CHART_STYLE_QIZHENG : storedChartStyle,
			// 天星择日双轮(pick 盘式):类B 选项 blob + 类A 立命时刻 + 端点数据
			electionOptions: getStoredGuolaoElection(),
			eleLifeMode: getStoredGuolaoEleLifeMode(),
			electionData: null,
			electionLoading: false,
			electionDeclOutOfRange: false,
			showMoiraTransitGods: getStoredMoiraTransitGodsVisible(),
			moiraQuickDialog: null,
			moiraStyleLevel: 3,
			engineMode: storedEngineMode,
			kinastroOptions: getStoredKinastroQizhengOptions(),
			qizhengKinPan: null,
			qizhengKinLoading: false,
			qizhengKinError: '',
			qizhengKinActiveTab: 'overview',
		};

		this.unmounted = false;
		this.bundleSeq = 0;
		this.chartReqSeq = 0;
		this.moiraReqSeq = 0;
		this.prefetchTimer = null;
		this.moiraTransitReqSeq = 0;
		this.qizhengKinReqSeq = 0;
		this.electionReqSeq = 0;
		this.guolaoDefaultsEnsured = false;

		this.onFieldsChange = this.onFieldsChange.bind(this);
		this.requestChart = this.requestChart.bind(this);
		this.requestChartObj = this.requestChartObj.bind(this);
		this.requestGuolaoBundle = this.requestGuolaoBundle.bind(this);
		this.onGuolaoDisplayChange = this.onGuolaoDisplayChange.bind(this);
		this.onLimitAgeClick = this.onLimitAgeClick.bind(this);
		this.requestMoiraTransitChart = this.requestMoiraTransitChart.bind(this);
		this.genParams = this.genParams.bind(this);
		this.onTipClick = this.onTipClick.bind(this);
		this.saveGuolaoAISnapshot = this.saveGuolaoAISnapshot.bind(this);
		this.applyChartObj = this.applyChartObj.bind(this);
		this.prefetchChart = this.prefetchChart.bind(this);
		this.requestMoiraRules = this.requestMoiraRules.bind(this);
		this.commitMoiraPanel = this.commitMoiraPanel.bind(this);
		this.ensureGuolaoDefaults = this.ensureGuolaoDefaults.bind(this);
		this.onChartStyleChange = this.onChartStyleChange.bind(this);
		this.onMoiraTransitTimeChange = this.onMoiraTransitTimeChange.bind(this);
		this.onMoiraTransitGodsVisibleChange = this.onMoiraTransitGodsVisibleChange.bind(this);
		this.openMoiraQuickDialog = this.openMoiraQuickDialog.bind(this);
		this.closeMoiraQuickDialog = this.closeMoiraQuickDialog.bind(this);
		this.onMoiraStyleLevelChange = this.onMoiraStyleLevelChange.bind(this);
		this.onEngineModeChange = this.onEngineModeChange.bind(this);
		this.onKinastroOptionChange = this.onKinastroOptionChange.bind(this);
		this.requestKinastroQizheng = this.requestKinastroQizheng.bind(this);
		this.onQizhengKinTabChange = this.onQizhengKinTabChange.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);

		if(this.props.hook){
			this.props.hook.fun = (fields, chartObj)=>{
				if(this.unmounted){
					return;
				}
				this.requestChartObj(fields, chartObj);
			};
			// 时间变化即预热流年盘(与主 /chart 并行;正式流程到流年段时在途/缓存秒中)。
			// 主 /chart 由模型层照发不重复;失败静默,正式请求自兜底。latency: 主盘+流年串行 → max(主盘,流年)。
			this.props.hook.prewarmRequests = (flds)=>{
				if(this.unmounted || this.state.engineMode === 'kinastro'){ return; }
				if(this.state.chartStyle === GUOLAO_CHART_STYLE_QIZHENG){ return; }
				try{
					const tp = paramsWithMoiraTransit(flds || this.props.fields, this.state.moiraTransitTime);
					if(tp){ fetchGuolaoChartCached(tp, { silent: true }).catch(()=>{ /* 预热静默 */ }); }
				}catch(e){ /* 预热失败无害 */ }
			};
			// horosa_prefetch_registry_v1(PERF-R9 Ship 7):七政【本命盘】步进预取。
			// 只暖本命 —— Moira 流年的默认过运时刻是「现在」(makeDefaultMoiraTransitTime),
			// 预取它等于把「此刻」钉死成缓存值 = 功能性降级,按纪律禁入(白名单亦以 moira 禁词兜底)。
			// 闭包吃组件态(engineMode/chartStyle 决定本命盘是否走这条路径);闸 horosa.perf.stepPrefetch。
			if(stepPrefetchEnabled()){
				registerStepPrefetcher('guolao', (steppedFields)=>{
					if(this.unmounted || this.state.engineMode === 'kinastro'){
						return [];
					}
					if(this.state.chartStyle === GUOLAO_CHART_STYLE_QIZHENG){
						return [];
					}
					return [{
						name: 'guolao:natal',
						path: '/chart',
						run: ()=> warmGuolaoNatal(steppedFields),
					}];
				});
			}
		}
	}

	onChartStyleChange(val){
		const chartStyle = setStoredGuolaoChartStyle(val);
		const engineMode = setStoredGuolaoEngineMode(chartStyle === GUOLAO_CHART_STYLE_QIZHENG ? 'kinastro' : 'horosa');
		const prevEngine = this.state.engineMode;
		this.setState({
			chartStyle,
			engineMode,
			qizhengKinError: '',
		}, ()=>{
			if(engineMode === 'kinastro'){
				this.requestKinastroQizheng();
				return;
			}
			// Moira圆盘 ↔ 天星择日:同一套排盘参数、同一张盘,只是中盘换渲染组件、右栏数据不变。
			// 若引擎未从 kinastro 切回、且已有匹配当前参数的盘数据 → 直接复用,绝不重跑 requestGuolaoBundle 的
			// 多阶段取数(本命→流年→规则),否则每次切样式都把「本命/流年/规则」重算一遍 → 中/右盘多次跳算闪烁。
			// 天星择日双轮所需 electionData 由 componentDidUpdate 的 requestElectionData 单独按需补取(单次 setState)。
			const params = this.genParams();
			const canReuse = prevEngine !== 'kinastro' && this.state.chartObj && params && isChartObjMatchParams(this.state.chartObj, params);
			if(!canReuse){
				this.requestGuolaoBundle(this.state.chartObj || this.props.value);
			}
		});
	}

	onMoiraTransitTimeChange(value){
		const time = value && value.time ? value.time : (value && value.value ? value.value : null);
		if(!time){
			return;
		}
		this.setState({
			moiraTransitTime: time.clone ? time.clone() : time,
		}, ()=>{
			if(!value || value.confirmed !== false){
				this.requestGuolaoBundle(this.state.chartObj || this.props.value);
			}
		});
	}

	// 点击百六大限某岁数格 → 流年跳到该岁对应公历年的 **7月1日 12:00**(用户钦定的取中方式);
	// 复用 onMoiraTransitTimeChange:左栏「Moira流年 时间」随之更新 + 重算流年盘(与手改时间同管道)。
	onLimitAgeClick(year){
		const y = Number(year);
		if(!Number.isFinite(y)){ return; }
		const cur = this.state.moiraTransitTime;
		const next = cur && cur.clone ? cur.clone() : null;
		if(!next || !next.parse){ return; }
		next.parse(`${y}/07/01 12:00:00`, 'YYYY-MM-DD HH:mm:ss');
		this.onMoiraTransitTimeChange({ value: next });
	}

	onMoiraTransitGodsVisibleChange(visible){
		this.setState({
			showMoiraTransitGods: setStoredMoiraTransitGodsVisible(visible),
		});
	}

	onGuolaoDisplayChange(patch){
		const next = setStoredGuolaoDisplay({...this.state.guolaoDisplay, ...(patch || {})});
		this.setState({ guolaoDisplay: next });
	}

	openMoiraQuickDialog(key){
		this.setState({
			moiraQuickDialog: key,
		});
	}

	closeMoiraQuickDialog(){
		this.setState({
			moiraQuickDialog: null,
		});
	}

	onMoiraStyleLevelChange(event){
		const level = Number(event && event.currentTarget ? event.currentTarget.value : null);
		if(!Number.isFinite(level)){
			return;
		}
		this.setState({
			moiraStyleLevel: level,
		});
	}

	onEngineModeChange(value){
		const engineMode = setStoredGuolaoEngineMode(value);
		const storedChartStyle = getStoredGuolaoChartStyle();
		const chartStyle = engineMode === 'kinastro'
			? setStoredGuolaoChartStyle(GUOLAO_CHART_STYLE_QIZHENG)
			: (storedChartStyle === GUOLAO_CHART_STYLE_QIZHENG ? setStoredGuolaoChartStyle(GUOLAO_CHART_STYLE_MOIRA) : storedChartStyle);
		this.setState({
			engineMode,
			chartStyle,
			qizhengKinError: '',
		}, ()=>{
			if(engineMode === 'kinastro'){
				this.requestKinastroQizheng();
			}else if(this.props.fields){
				this.requestChartObj();
			}
		});
	}

	onKinastroOptionChange(key, value){
		const next = setStoredKinastroQizhengOptions({
			...this.state.kinastroOptions,
			[key]: value,
		});
		this.setState({
			kinastroOptions: next,
		}, ()=>{
			if(this.state.engineMode === 'kinastro'){
				this.requestKinastroQizheng();
			}
		});
	}

	onQizhengKinTabChange(key){
		this.setState({
			qizhengKinActiveTab: key,
		});
	}

	async requestKinastroQizheng(){
		if(!this.props.fields || this.unmounted){
			return null;
		}
		const params = this.genParams();
		if(!params){
			return null;
		}
		const options = this.state.kinastroOptions || {};
		const seq = ++this.qizhengKinReqSeq;
		this.setState({
			qizhengKinLoading: true,
			qizhengKinError: '',
		});
		try{
		const pan = await fetchKinastroQizheng({
				...params,
				qizhengKinCurrentYear: options.currentYear,
				qizhengKinTransitMode: options.transitMode || 'none',
				qizhengKinTransitDate: options.transitDate || '',
				qizhengKinTransitTime: options.transitTime || '',
				qizhengKinElectionalStartDate: options.electionalStartDate || '',
				qizhengKinElectionalCriteria: options.electionalCriteria || 'general',
				qizhengKinElectionalDays: options.electionalDays || 30,
			});
			if(this.unmounted || seq !== this.qizhengKinReqSeq){
				return pan;
			}
			this.setState({
				qizhengKinPan: pan,
				qizhengKinLoading: false,
				qizhengKinError: '',
			}, ()=>{
				// horosa_panel_ready_v1:坚七政(kinastro 引擎)分支的唯一落定点 —— 中栏七政轮
				// 与右栏信息 Tabs 同吃 qizhengKinPan,这一次 setState 之后两栏全部画完。
				markPanelReady('guolao');
			});
			if(pan && pan.snapshot){
				saveModuleAISnapshot('guolao-qizhengkin', pan.snapshot, {
					date: params.date,
					time: params.time,
					zone: params.zone,
					lon: params.lon,
					lat: params.lat,
				});
			}
			return pan;
		}catch(e){
			if(!this.unmounted && seq === this.qizhengKinReqSeq){
				this.setState({
					qizhengKinLoading: false,
					qizhengKinError: e && e.message ? e.message : '七政四余服务暂不可用',
				}, ()=>{
					// horosa_panel_ready_v1:坚七政失败终态(错误卡上屏即本次交互结束)。
					markPanelReady('guolao');
				});
			}
			return null;
		}
	}

	ensureGuolaoDefaults(){
		if(this.guolaoDefaultsEnsured){
			return false;
		}
		if(!this.props.fields || !this.props.dispatch){
			return false;
		}
		this.guolaoDefaultsEnsured = true;
		const su28Mode = getStoredGuolaoSu28Mode();
		const lifeMode = getStoredGuolaoLifeMode();
		const nodeMode = getStoredGuolaoNodeMode();
		const currentSu28 = this.props.fields.doubingSu28 ? Number(this.props.fields.doubingSu28.value) : null;
		const currentLifeMode = guolaoLifeModeFromFields(this.props.fields);
		const currentNodeMode = guolaoNodeModeFromFields(this.props.fields);
		if(currentSu28 === su28Mode && currentLifeMode === lifeMode && currentNodeMode === nodeMode){
			return false;
		}
		const patch = {};
		if(currentSu28 !== su28Mode){
			patch.doubingSu28 = {
				value: su28Mode,
			};
		}
		if(currentLifeMode !== lifeMode){
			patch.guolaoLifeMode = {
				value: lifeMode,
			};
		}
		if(currentNodeMode !== nodeMode){
			patch.guolaoNodeMode = {
				value: nodeMode,
			};
		}
		this.onFieldsChange(patch);
		return true;
	}

	applyChartObj(params, chartObj){
		if(!params || !chartObj || this.unmounted){
			return;
		}
		const key = buildGuolaoKey(params);
		if(key){
			pushCache(guolaoMem, key, clonePlain(chartObj));
		}
		const displayChartObj = applyGuolaoNodeMode(chartObj, this.props.fields);
		// 合批渲染(用户钦定「算好一起出」):主盘暂存,与流年盘+rules 在 commitMoiraPanel 一次放行,
		// 消除 框→主盘→神煞 三段跳。rules 链任何失败路径都有 local-fallback 兜底 commit,不会卡 loading。
		this._pendingMoiraChartObj = displayChartObj;
		this.setState({
			moiraLoading: true,
		});
		this.saveGuolaoAISnapshot(params, displayChartObj);
		this.requestMoiraTransitChart(params, displayChartObj);
	}

	commitMoiraPanel(rules, params, chartObj, transitParams, transitChartObj){
		const nextTransitParams = transitParams || paramsWithMoiraTransit(this.props.fields, this.state.moiraTransitTime);
		const pendingChartObj = this._pendingMoiraChartObj;
		this._pendingMoiraChartObj = null;
		this.setState({
			...(pendingChartObj ? { chartObj: pendingChartObj } : {}),
			// 流年盘与主盘/rules 同批放行(彻底合批:盘面一次成型,不显示半成品)。
			...(transitChartObj ? { moiraTransitChartObj: transitChartObj } : {}),
			moiraRules: rules,
			moiraPanelChartObj: clonePlain(chartObj),
			moiraPanelTransitChartObj: clonePlain(transitChartObj || this.state.moiraTransitChartObj),
			moiraPanelTransitParams: clonePlain(nextTransitParams),
			moiraLoading: false,
		}, ()=>{
			// horosa_panel_ready_v1:旧多段路径的**唯一**终点(applyChartObj→requestMoiraTransitChart
			// →requestMoiraRules 全部汇入此处),中栏盘面 + 右栏 rules 在这一次 setState 里一起落定。
			markPanelReady('guolao');
		});
	}

	async requestMoiraRules(params, chartObj, transitParams, transitChartObj){
		if(!params || !chartObj || this.unmounted){
			return;
		}
		const seq = ++this.moiraReqSeq;
		this.setState({
			moiraLoading: true,
		});
		let rsp = null;
		let fallbackReason = 'empty-response';
		try{
			rsp = await fetchMoiraQizhengRules({
				params: params,
				chartObj: chartObj,
				transitParams: transitParams || paramsWithMoiraTransit(this.props.fields, this.state.moiraTransitTime),
				transitChartObj: transitChartObj || this.state.moiraTransitChartObj || null,
			}, {
				silent: true,
				timeoutMs: 12000,
			});
		}catch(e){
			fallbackReason = e && e.message ? e.message : 'request-error';
		}
		if(this.unmounted || seq !== this.moiraReqSeq){
			return;
		}
		const remoteRules = rsp && rsp[Constants.ResultKey] ? rsp[Constants.ResultKey] : null;
		const rules = isIncompleteMoiraRules(remoteRules)
			? buildLocalMoiraRules(params, chartObj, this.props.fields, fallbackReason)
			: remoteRules;
		this.commitMoiraPanel(rules, params, chartObj, transitParams, transitChartObj);
	}

	async prefetchChart(params){
		if(!params){
			return null;
		}
		return fetchGuolaoChartCached(params, {
			silent: true,
		});
	}

	async requestMoiraTransitChart(baseParams, baseChartObj){
		if(!this.props.fields || this.unmounted){
			return null;
		}
		const params = paramsWithMoiraTransit(this.props.fields, this.state.moiraTransitTime);
		if(baseParams){
			params.lon = baseParams.lon;
			params.lat = baseParams.lat;
			params.gpsLon = baseParams.gpsLon;
			params.gpsLat = baseParams.gpsLat;
			params.doubingSu28 = baseParams.doubingSu28;
			params.guolaoZhengSidereal = baseParams.guolaoZhengSidereal;
			params.zodiacal = baseParams.zodiacal;
			params.guolaoLifeMode = baseParams.guolaoLifeMode;
			params.tradition = baseParams.tradition;
			params.strongRecption = baseParams.strongRecption;
			params.simpleAsp = baseParams.simpleAsp;
			params.virtualPointReceiveAsp = baseParams.virtualPointReceiveAsp;
			params._su28Rev = baseParams._su28Rev || GUOLAO_SU28_CACHE_REV;
		}
		const seq = ++this.moiraTransitReqSeq;
		this.setState({
			moiraTransitLoading: true,
			moiraLoading: true,
		});
		try{
			const result = await fetchGuolaoChartCached(params, {
				silent: true,
			});
			if(this.unmounted || seq !== this.moiraTransitReqSeq){
				return result;
			}
			const displayResult = applyGuolaoNodeMode(result, this.props.fields);
			const rootParams = baseParams || this.genParams();
			const rootChartObj = baseChartObj || this.state.chartObj || applyGuolaoNodeMode(this.props.value, this.props.fields);
			if(!rootParams || !rootChartObj){
				this.setState({
					...(this._pendingMoiraChartObj ? { chartObj: this._pendingMoiraChartObj } : {}),
					moiraTransitChartObj: displayResult,
					moiraTransitLoading: false,
					moiraLoading: false,
				}, ()=>{
					// horosa_panel_ready_v1:无根盘/根参数的降级终点(不再走 commitMoiraPanel)。
					markPanelReady('guolao');
				});
				this._pendingMoiraChartObj = null;
				return result;
			}
			// 彻底合批(用户钦定「不显示半成品」):流年盘结果不在此放行,与主盘/rules 一并
			// 在 commitMoiraPanel 单次 setState(消除「主盘→流年环→神煞」三段跳的第二跳)。
			this.setState({
				moiraTransitLoading: false,
			});
			this.requestMoiraRules(rootParams, rootChartObj, params, displayResult);
			return result;
		}catch(e){
			if(!this.unmounted && seq === this.moiraTransitReqSeq){
				const rootParams = baseParams || this.genParams();
				const rootChartObj = baseChartObj || this.state.chartObj || applyGuolaoNodeMode(this.props.value, this.props.fields);
				this.setState({
					moiraTransitLoading: false,
				});
				if(rootParams && rootChartObj){
					this.requestMoiraRules(rootParams, rootChartObj, params, null);
				}else {
					this.setState({
						...(this._pendingMoiraChartObj ? { chartObj: this._pendingMoiraChartObj } : {}),
						moiraLoading: false,
					}, ()=>{
						// horosa_panel_ready_v1:流年盘失败且无根盘的终点。
						markPanelReady('guolao');
					});
					this._pendingMoiraChartObj = null;
				}
			}
			return null;
		}
	}

	async requestChart(params, options){
		if(!params){
			return null;
		}
		const opt = options || {};
		const applyResult = opt.applyResult !== false;
		if(!applyResult){
			return this.prefetchChart(params);
		}
		const seq = ++this.chartReqSeq;
		const result = await fetchGuolaoChartCached(params, {
			silent: opt.silent !== false,
		});
		if(!result || this.unmounted || seq !== this.chartReqSeq){
			return result;
		}
		this.applyChartObj(params, result);
		return result;
	}

	saveGuolaoAISnapshot(params, result){
		const p = params || this.genParams();
		const r = result || this.state.chartObj;
		if(!p || !r){
			return;
		}
		const planetDisplay = this.props.planetDisplay;
		const fields = this.props.fields;
		saveModuleAISnapshotLazy('guolao', ()=>buildGuolaoSnapshotTextV2(p, r, planetDisplay, fields, this.state ? this.state.moiraRules : null), {
			date: p.date,
			time: p.time,
			zone: p.zone,
			lon: p.lon,
			lat: p.lat,
		});
	}

	// AI 导出/挂载实时取数:导出侧派发 refresh 事件,这里用当前盘即时构建快照并回填,
	// 保证「显示什么就导出什么」——不依赖懒存缓存是否已物化(rehydrate/未重排时缓存可能为空,
	// 此前缺此监听 → 显示有盘却报「当前页面没有可导出文本」,Win 用户实测)。
	// 本组件含两个 key:guolao(果老星宗,实时构建)与 guolao-qizhengkin(七政果老,取后端预置快照)。
	handleSnapshotRefreshRequest(evt){
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		let text = '';
		try{
			if(moduleName === 'guolao'){
				const p = this.genParams();
				const r = this.state ? this.state.chartObj : null;
				if(p && r){
					text = `${buildGuolaoSnapshotTextV2(p, r, this.props.planetDisplay, this.props.fields, this.state ? this.state.moiraRules : null) || ''}`.trim();
				}
			}else if(moduleName === 'guolao-qizhengkin'){
				const pan = this.state ? this.state.qizhengKinPan : null;
				text = `${(pan && pan.snapshot) || ''}`.trim();
			}else{
				return;
			}
		}catch(e){
			text = '';
		}
		if(text){
			saveModuleAISnapshot(moduleName, text);
			if(evt && evt.detail && typeof evt.detail === 'object'){
				evt.detail.snapshotText = text;
			}
		}
	}

	requestChartObj(fields, chartObj){
		// v-guolao-moira: 收口到单闸门，禁止分步 setState（见 requestGuolaoBundle）。
		this.requestGuolaoBundle(chartObj || this.props.value);
	}

	// 一次性渲染闸门：本命盘 + 流年盘并行取齐 + Moira 规则一次性提交，期间只显示骨架/遮罩，
	// 绝不画半成品。取代旧的 requestChartObj→applyChartObj→requestMoiraTransitChart→requestMoiraRules→commitMoiraPanel 多段提交。
	async requestGuolaoBundle(srcChart){
		if(this.unmounted || this.state.engineMode === 'kinastro'){
			return;
		}
		const params = this.genParams();
		if(!params){
			return;
		}
		const style = this.state.chartStyle;
		// 流年盘:Moira/天星择日 在转盘上画;Horosa原盘 不画转盘但右栏「流年星曜/流年七政动态/流年落入」仍需流年盘数据,
		// 故所有样式都取流年盘(否则 classic 下右栏流年段空白显示「无数据」)。坚七政自有流年路径,不在此分支。
		const needTransit = (style !== GUOLAO_CHART_STYLE_QIZHENG);
		const seq = ++this.bundleSeq;
		this.setState({ bundleLoading: true });
		const transitParams = paramsWithMoiraTransit(this.props.fields, this.state.moiraTransitTime);
		const reuse = srcChart && isChartObjMatchParams(srcChart, params) && hasGuolaoRiseSetFields(srcChart);
		// 阶段一(冷加载性能):只取本命盘并立即上屏——命盘轮完整、绝不画半成品。
		// 此前 Promise.all([本命,流年]) 把两冷盘塞同一阻塞段(后端冷算串行≈2×单盘=撞 <1s 红线);拆两段后首屏只等本命盘。
		// 流年环/流曜/格局走既有 transitLoading/moiraLoading 过渡态稍后毫秒级补入,默认显示口径不变,缓存键(byte-perfect)不动。
		let natalRaw = null;
		try{
			natalRaw = reuse ? srcChart : await fetchGuolaoChartCached(params, {silent: true});
		}catch(e){
			natalRaw = reuse ? srcChart : (this.state.chartObj || null);
		}
		if(seq !== this.bundleSeq || this.unmounted){
			return;
		}
		const chartObj = natalRaw ? applyGuolaoNodeMode(natalRaw, this.props.fields) : (this.state.chartObj || null);
		this.setState({
			chartObj,
			moiraPanelChartObj: chartObj,
			bundleLoading: false,
			// 流年/规则后台计算中:流曜区/右栏显示过渡态,不画半成品。
			moiraLoading: !!chartObj,
			moiraTransitLoading: needTransit,
		});
		if(chartObj){
			this.saveGuolaoAISnapshot(params, chartObj);
		}
		if(!chartObj){
			// horosa_panel_ready_v1:取盘失败的终态也要收口,否则本次交互的计时会悬着、
			// 被下一次交互错配(观测口径要求每次交互恰好一条 panel-ready)。
			this.setState({ moiraLoading: false, moiraTransitLoading: false }, ()=>{
				markPanelReady('guolao');
			});
			return;
		}

		// 阶段二(后台非阻塞):流年盘(needTransit 时)+ Moira 规则,取齐后合并。
		let transitRaw = null;
		if(needTransit){
			try{
				transitRaw = await fetchGuolaoChartCached(transitParams, {silent: true});
			}catch(e){
				transitRaw = null;
			}
			if(seq !== this.bundleSeq || this.unmounted){
				return;
			}
		}
		const transitObj = transitRaw ? applyGuolaoNodeMode(transitRaw, this.props.fields) : null;
		this.setState({
			moiraTransitChartObj: transitObj,
			moiraTransitLoading: false,
		});
		let rsp = null;
		let fallbackReason = 'empty-response';
		try{
			rsp = await fetchMoiraQizhengRules({
				params,
				chartObj,
				transitParams,
				transitChartObj: transitObj,
			}, {
				silent: true,
				timeoutMs: 12000,
			});
		}catch(e){
			fallbackReason = e && e.message ? e.message : 'request-error';
		}
		if(seq !== this.bundleSeq || this.unmounted){
			return;
		}
		const remoteRules = rsp && rsp[Constants.ResultKey] ? rsp[Constants.ResultKey] : null;
		const rules = isIncompleteMoiraRules(remoteRules)
			? buildLocalMoiraRules(params, chartObj, this.props.fields, fallbackReason)
			: remoteRules;
		this.setState({
			moiraRules: rules,
			moiraPanelChartObj: chartObj,
			moiraPanelTransitChartObj: transitObj,
			moiraPanelTransitParams: transitParams,
			moiraLoading: false,
			moiraTransitLoading: false,
		}, ()=>{
			// horosa_panel_ready_v1:主路径(单闸门 requestGuolaoBundle)终点 —— 中栏命盘轮 + 流年环
			// + 右栏 Moira 面板(rules/流曜/格局)全部落定的那一次 setState。
			markPanelReady('guolao');
		});
	}

	genParams(){
		let fields = this.props.fields;
		let params = fieldsToParams(fields);
		return params;
	}

	onFieldsChange(field){
		if(this.props.dispatch && this.props.fields){
			const patch = {
				...(field || {}),
			};
			const hasConfirmedFlag = Object.prototype.hasOwnProperty.call(patch, '__confirmed');
			const confirmed = hasConfirmedFlag ? !!patch.__confirmed : true;
			if(hasConfirmedFlag){
				delete patch.__confirmed;
			}
			if(patch.doubingSu28 && Object.prototype.hasOwnProperty.call(patch.doubingSu28, 'value')){
				patch.doubingSu28 = {
					...patch.doubingSu28,
					value: setStoredGuolaoSu28Mode(patch.doubingSu28.value),
				};
			}
			if(patch.guolaoLifeMode && Object.prototype.hasOwnProperty.call(patch.guolaoLifeMode, 'value')){
				patch.guolaoLifeMode = {
					...patch.guolaoLifeMode,
					value: setStoredGuolaoLifeMode(patch.guolaoLifeMode.value),
				};
			}
			if(patch.guolaoNodeMode && Object.prototype.hasOwnProperty.call(patch.guolaoNodeMode, 'value')){
				patch.guolaoNodeMode = {
					...patch.guolaoNodeMode,
					value: setStoredGuolaoNodeMode(patch.guolaoNodeMode.value),
				};
			}
			let flds = {
				fields: {
					...this.props.fields,
					...patch,
					nohook: false,
				}
			};
			if(!confirmed){
				this.props.dispatch({
					type: 'astro/fetchByFields',
					payload: {
						...flds.fields,
						nohook: true,
						__requestOptions: {
							silent: true,
						},
					},
				});
				if(this.prefetchTimer){
					clearTimeout(this.prefetchTimer);
				}
				this.prefetchTimer = setTimeout(()=>{
					this.prefetchTimer = null;
					if(this.unmounted){
						return;
					}
					this.prefetchChart(fieldsToParams(flds.fields)).catch(()=>{
						return null;
					});
				}, 220);
				return;
			}
			if(this.prefetchTimer){
				clearTimeout(this.prefetchTimer);
				this.prefetchTimer = null;
			}
			this.props.dispatch({
				type: 'astro/fetchByFields',
				payload: {
					...flds.fields,
					__requestOptions: {
						silent: true,
					},
				},
			});
		}
	}

	onTipClick(tipobj){
		this.setState({
			tips: tipobj,
		});
	}


	// WP-H-2 极速化:重 wrapper sCU —— 全 props 机械浅比(函数型跳过,详 wrapperPropsEqual);
	// state 变化改为**按字段**判定(horosa_guolao_scu_slice_v1):只有当变的字段全部落在
	// 「render() 从不读」白名单里时才跳过,其余一律照旧重渲。
	// 收益:宿主因无关状态重渲时,本重组件整树不再白跑。关 chartSCU 开关 = 恒重渲旧行为。
	shouldComponentUpdate(nextProps, nextState){
		if(guolaoStateChangeMatters(this.state, nextState)){
			return true;
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}

	componentDidMount(){
		this.unmounted = false;
		// v2.2.1: 监听全局日界 / 晚子时·时柱起干切换 → 重新 fetch 七政四余/Moira 盘。
		// 关键:用 setTimeout 0 延迟到下一 macrotask,让 dva 的 syncFromGlobalLateZiHour subscription
		// 先把 fields.lateZiHourUseNextDay.value 更新到 store + React 把新 props 透给本组件,再 fetch。
		// 否则 this.props.fields 在 listener 同步触发时仍是旧 snapshot,fetch 用的还是旧值,Moira 必须刷新页面才生效。
		if(typeof window !== 'undefined'){
			const refetch = () => {
				if(this.unmounted) return;
				setTimeout(() => {
					if(this.unmounted) return;
					if(this.state.engineMode === 'kinastro'){
						this.requestKinastroQizheng();
					} else if(this.props.fields){
						this.requestChartObj();
					}
				}, 0);
			};
			this._dayBoundaryListener = refetch;
			this._lateZiHourListener = refetch;
			window.addEventListener('horosa:day-boundary-changed', this._dayBoundaryListener);
			window.addEventListener('horosa:late-zi-hour-mode-changed', this._lateZiHourListener);
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
		if(this.state.engineMode === 'kinastro'){
			this.requestKinastroQizheng();
			return;
		}
		if(this.ensureGuolaoDefaults()){
			return;
		}
		if(this.props.fields){
			this.requestChartObj();
		}
	}

	componentDidUpdate(prevProps, prevState){
		if(this.state.engineMode === 'kinastro'){
			if(prevProps.fields !== this.props.fields || (prevState && prevState.engineMode !== this.state.engineMode)){
				this.requestKinastroQizheng();
			}
			return;
		}
		if(prevProps.fields !== this.props.fields && this.ensureGuolaoDefaults()){
			return;
		}
		if(prevProps.planetDisplay !== this.props.planetDisplay){
			this.saveGuolaoAISnapshot(null, this.state.chartObj);
		}
		if(prevProps.value !== this.props.value && this.props.value){
			this.requestGuolaoBundle(this.props.value);
		}
		// 天星择日:pick 盘式且(切入盘式/择时变化/立命时刻变化/流年盘刷新)→ 重取双轮数据;
		// MOIRA 圆盘同触发(西占宫位格吃 staticHousesBySystem,本盘时刻变化时 staticDate 须跟上)。
		if(this.state.chartStyle === GUOLAO_CHART_STYLE_PICK || this.state.chartStyle === GUOLAO_CHART_STYLE_MOIRA){
			const styleSwitched = prevState && prevState.chartStyle !== this.state.chartStyle;
			const timeChanged = prevState && prevState.moiraTransitTime !== this.state.moiraTransitTime;
			const lifeChanged = prevState && prevState.eleLifeMode !== this.state.eleLifeMode;
			const transitArrived = prevState && prevState.moiraTransitChartObj !== this.state.moiraTransitChartObj;
			const valueChanged = prevProps.value !== this.props.value && !!this.props.value;
			if(styleSwitched || timeChanged || lifeChanged || valueChanged || (transitArrived && !this.state.electionData)){
				this.requestElectionData();
			}
		}
	}

	componentWillUnmount(){
		this.unmounted = true;
		this.moiraReqSeq++;
		this.moiraTransitReqSeq++;
		this.qizhengKinReqSeq++;
		if(typeof window !== 'undefined'){
			if(this._dayBoundaryListener){
				window.removeEventListener('horosa:day-boundary-changed', this._dayBoundaryListener);
			}
			if(this._lateZiHourListener){
				window.removeEventListener('horosa:late-zi-hour-mode-changed', this._lateZiHourListener);
			}
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
		if(this.prefetchTimer){
			clearTimeout(this.prefetchTimer);
			this.prefetchTimer = null;
		}
	}

	renderMoiraSection(title, children, extraClass = ''){
		return (
			<div className={`horosa-guolao-quick-section ${extraClass}`.trim()}>
				<div className="horosa-guolao-quick-section-title">{title}</div>
				{children}
			</div>
		);
	}

	renderMoiraEmpty(text){
		return (
			<div className="horosa-guolao-quick-empty">{text}</div>
		);
	}

	renderQuickMeta(items){
		return (
			<div className="horosa-guolao-quick-meta-grid">
				{items.filter((item)=>item && item.value !== undefined && item.value !== null && item.value !== '').map((item)=>(
					<div className="horosa-guolao-quick-meta" key={item.label}>
						<span>{item.label}</span>
						<strong>{item.value}</strong>
					</div>
				))}
			</div>
		);
	}

	renderQuickPlanetRows(rows){
		if(!rows.length){
			return this.renderMoiraEmpty('当前星历响应里没有可输出的星曜数据。');
		}
		return (
			<div className="horosa-guolao-quick-table horosa-guolao-quick-planet-table">
				<div className="horosa-guolao-quick-table-row horosa-guolao-quick-table-head">
					<span>星曜</span><span>宫位</span><span>黄道</span><span>宿度</span><span>势态</span><span>速度</span>
				</div>
				{rows.map((row)=>(
					<div className="horosa-guolao-quick-table-row" key={row.id}>
						<strong>{row.name}</strong>
						<span>{row.house || '-'}</span>
						<span>{row.degree || row.signName || '-'}</span>
						<span>{row.su28 ? `${row.su28} ${row.compactDegree}` : row.compactDegree}</span>
						<span>{[row.dignity, row.status].filter(Boolean).join(' / ') || '-'}</span>
						<span>{row.speed || '-'}</span>
					</div>
				))}
			</div>
		);
	}

	renderQuickYearPlanetRows(rows){
		const list = safeList(rows);
		if(!list.length){
			return this.renderMoiraEmpty('当前 Moira 规则层未返回化曜数据。');
		}
		return (
			<div className="horosa-guolao-quick-table horosa-guolao-quick-planet-table">
				<div className="horosa-guolao-quick-table-row horosa-guolao-quick-table-head">
					<span>曜</span><span>化曜</span><span>同归项</span><span></span><span></span><span></span>
				</div>
				{list.map((row)=>(
					<div className="horosa-guolao-quick-table-row" key={row.star}>
						<strong>{row.star}</strong>
						<span>{row.changeTo || '-'}</span>
						<span>{joinNames(row.items)}</span>
						<span></span><span></span><span></span>
					</div>
				))}
			</div>
		);
	}

	renderQuickYearGroups(groups){
		const list = safeList(groups);
		if(!list.length){
			return this.renderMoiraEmpty('当前 Moira 规则层未返回天禄至天权数据。');
		}
		return (
			<div className="horosa-guolao-quick-card-grid horosa-guolao-quick-year-grid">
				{list.map((group, idx)=>(
					<div className="horosa-guolao-quick-card" key={`${group.main || 'group'}-${idx}`}>
						<div className="horosa-guolao-quick-card-title">{group.main || '-'}</div>
						<div className="horosa-guolao-quick-card-text">{joinMoiraYearItems(group.items)}</div>
					</div>
				))}
			</div>
		);
	}

	renderQuickYearSignRows(rows){
		const list = safeList(rows);
		if(!list.length){
			return this.renderMoiraEmpty('当前 Moira 规则层未返回命曜数据。');
		}
		return (
			<div className="horosa-guolao-quick-table horosa-guolao-quick-weak-table">
				<div className="horosa-guolao-quick-table-row horosa-guolao-quick-table-head">
					<span>宫名</span><span>化曜</span><span>曜名</span><span>宫性</span>
				</div>
				{list.map((row)=>(
					<div className="horosa-guolao-quick-table-row" key={`${row.mode || 'year'}-${row.name}`}>
						<strong>{row.name}</strong>
						<span>{row.star || '-'}</span>
						<span>{row.shortName || '-'}</span>
						<span>{[row.quality, row.zi, row.signName].filter(Boolean).join(' · ')}</span>
					</div>
				))}
			</div>
		);
	}

		renderQuickPatterns(){
			const rules = this.state.moiraRules || {};
			const unverifiedSource = hasUnverifiedMoiraPatternSource(rules);
			const meta = moiraStyleLevelMeta(rules, this.state.moiraStyleLevel);
			const allPatterns = unverifiedSource ? [] : safeList(rules.patterns);
			const byLevel = applyMoiraStyleLevel(allPatterns, meta);
			const patterns = byLevel;
			const warning = rules.styleWarning || (unverifiedSource ? '当前接口返回的是旧版 Horosa 近似格局，不是 Moira 本体的政余喜格/忌格；已在前端屏蔽，避免误读。' : '');
			const good = patterns.filter((item)=>item.level === 'good');
			const bad = patterns.filter((item)=>item.level === 'bad');
			const other = patterns.filter((item)=>item.level !== 'good' && item.level !== 'bad');
			const renderPatternGroup = (type, label, list, emptyText)=>(
				<div className={`horosa-guolao-quick-pattern-group horosa-guolao-quick-pattern-group-${type}`}>
					<div className="horosa-guolao-quick-pattern-group-head">
						<span>{type === 'good' ? '喜' : '忌'}</span>
						<strong>{label}</strong>
						<em>{list.length} 条</em>
					</div>
					<div className="horosa-guolao-quick-pattern-chip-list">
						{list.length ? list.map((item, idx)=>(
							<span key={`${type}-${item.name}-${idx}`} title={item.detail || item.dsl || item.name}>{item.name}</span>
						)) : <i>{emptyText}</i>}
					</div>
				</div>
			);
			return (
				<div className="horosa-guolao-quick-dialog">
					{warning ? this.renderMoiraSection('格局数据源', (
						<div className="horosa-guolao-quick-warning">{warning}</div>
					)) : null}
					{this.renderMoiraSection('显示程度', (
						<div className="horosa-guolao-quick-meta horosa-guolao-quick-style-level">
							<label>
								<span>最低</span>
								<input
									type="range"
									min={meta.min}
									max={meta.max}
									step="1"
									value={meta.level}
									onInput={this.onMoiraStyleLevelChange}
									onChange={this.onMoiraStyleLevelChange}
									onClick={this.onMoiraStyleLevelChange}
									onMouseUp={this.onMoiraStyleLevelChange}
									onKeyUp={this.onMoiraStyleLevelChange}
								/>
								<span>最高</span>
							</label>
							<div className="horosa-guolao-quick-card-text">
								当前 {meta.level} 档，Moira 阈值 level ≥ {meta.displayLevel}；显示 {patterns.length}/{allPatterns.length} 条命中格局。
							</div>
						</div>
					))}
					<div className="horosa-guolao-quick-pattern-output">
						{renderPatternGroup('good', '政余喜格', good, warning ? 'Moira 真实喜格 DSL 尚未接入，暂不输出正式喜格。' : '当前盘未命中 Moira 喜格。')}
						{renderPatternGroup('bad', '政余忌格', bad, warning ? 'Moira 真实忌格 DSL 尚未接入，暂不输出正式忌格。' : '当前盘未命中 Moira 忌格。')}
					</div>
				{other.length ? this.renderMoiraSection('察看项', (
					<div className="horosa-guolao-quick-card-grid">
						{other.map((item, idx)=>(
							<div className={`horosa-guolao-quick-card horosa-guolao-quick-pattern-${item.level || 'neutral'}`} key={`${item.name}-${idx}`}>
								<div className="horosa-guolao-quick-card-title">{item.name}</div>
								<div className="horosa-guolao-quick-card-text">{item.detail || 'Moira 规则命中，但后端未返回细节。'}</div>
							</div>
						))}
					</div>
				)) : null}
			</div>
		);
	}

	renderQuickYearStars(){
		const birthParams = this.genParams();
		const transitParams = paramsWithMoiraTransit(this.props.fields, this.state.moiraTransitTime);
		const birthYear = yearFromParams(birthParams);
		const transitYear = yearFromParams(transitParams);
		const birthGz = baziStemBranch(this.state.chartObj, 'year', birthYear);
		const transitGz = stemBranchForYear(transitYear);
		const rules = this.state.moiraRules || {};
		const nativeYearStars = safeMap(rules.yearStars);
		const birthYearStars = safeMap(nativeYearStars.birth);
		const transitYearStars = safeMap(nativeYearStars.transit);
		if(safeList(transitYearStars.groups).length || safeList(birthYearStars.groups).length){
			return (
				<div className="horosa-guolao-quick-dialog">
					{this.renderMoiraSection('年曜化星', this.renderQuickMeta([
						{label: '本命年柱', value: birthYearStars.yearPole || birthGz},
						{label: '流年年柱', value: transitYearStars.yearPole || transitGz},
						{label: '流年时间', value: `${transitParams.date} ${transitParams.time}`},
						{label: '本命首曜', value: birthYearStars.yearStar},
						{label: '流年首曜', value: transitYearStars.yearStar},
						{label: '规则源', value: rules.styleSource || 'moira_s.prop'},
					]))}
					{this.renderMoiraSection('流年化曜', this.renderQuickYearPlanetRows(transitYearStars.planetRows))}
					{this.renderMoiraSection('本命化曜', this.renderQuickYearPlanetRows(birthYearStars.planetRows))}
					{this.renderMoiraSection('流年天禄至天权', this.renderQuickYearGroups(transitYearStars.groups))}
				</div>
			);
		}
		const stem = transitGz.slice(0, 1);
		const currentStar = MOIRA_YEAR_STAR_BY_STEM[stem] || '';
		return (
			<div className="horosa-guolao-quick-dialog">
				{this.renderMoiraSection('年曜化星', this.renderQuickMeta([
					{label: '本命年柱', value: birthGz},
					{label: '流年年柱', value: transitGz},
					{label: '流年时间', value: `${transitParams.date} ${transitParams.time}`},
					{label: 'Moira化曜', value: currentStar ? `${stem}年化${currentStar}` : '未取得流年干'},
					{label: '年曜序', value: MOIRA_YEAR_STAR_SEQ.join('、')},
					{label: '年干序', value: MOIRA_YEAR_STAR_MAP.join('、')},
				]))}
				{this.renderMoiraSection('天禄至天权', (
					<div className="horosa-guolao-quick-card-grid horosa-guolao-quick-year-grid">
						{MOIRA_YEAR_INFO_GROUPS.map((items, idx)=>(
							<div className="horosa-guolao-quick-card" key={items[0]}>
								<div className="horosa-guolao-quick-card-title">{items[0]}</div>
								<div className="horosa-guolao-quick-card-text">{items.slice(1).join('、') || '主项'}</div>
								{idx === 0 && currentStar ? <em>本流年化星：{currentStar}</em> : null}
							</div>
						))}
					</div>
				))}
				{this.renderMoiraSection('十神序', this.renderQuickMeta([
					{label: '原十神序', value: MOIRA_TEN_GOD_ORG.join('、')},
					{label: '替代十神序', value: MOIRA_TEN_GOD_ALT.join('、')},
				]))}
			</div>
		);
	}

	renderQuickWeakSolid(){
		const rules = this.state.moiraRules || {};
		const nativeWeakSolid = safeMap(rules.weakSolid);
		const nativeHouseRows = safeList(nativeWeakSolid.houses);
		if(nativeHouseRows.length){
			return (
				<div className="horosa-guolao-quick-dialog">
					{this.renderMoiraSection('虚实宫位', (
						<div className="horosa-guolao-quick-table horosa-guolao-quick-weak-table">
							<div className="horosa-guolao-quick-table-row horosa-guolao-quick-table-head">
								<span>宫位</span><span>虚实</span><span>虚柱</span><span>实柱</span>
							</div>
							{nativeHouseRows.map((house, idx)=>(
								<div className="horosa-guolao-quick-table-row" key={`${house.house}-${idx}`}>
									<strong>{house.house}</strong>
									<span className={house.solid ? 'horosa-guolao-quick-solid' : (house.weak ? 'horosa-guolao-quick-weak' : '')}>{house.label || '-'}</span>
									<span>{joinNames(house.weakPillars)}</span>
									<span>{joinNames(house.solidPillars)}</span>
								</div>
							))}
						</div>
					))}
					{this.renderMoiraSection('Moira口径', this.renderQuickMeta([
						{label: '虚宫', value: '按四柱旬空推虚：Moira computeWeakHouse。'},
						{label: '实宫', value: '按年、月、日、时四柱地支定实。'},
					]))}
				</div>
			);
		}
		const houses = safeList(rules.houses);
		const rows = buildQuickPlanetRows(this.state.chartObj, rules.planets);
		const byHouse = new Map();
		rows.forEach((row)=>{
			const key = row.house || '未定';
			if(!byHouse.has(key)){
				byHouse.set(key, []);
			}
			byHouse.get(key).push(row.name);
		});
		const houseRows = houses.length ? houses : Array.from(byHouse.keys()).map((name)=>({name}));
		return (
			<div className="horosa-guolao-quick-dialog">
				{this.renderMoiraSection('虚实宫位', (
					<div className="horosa-guolao-quick-table horosa-guolao-quick-weak-table">
						<div className="horosa-guolao-quick-table-row horosa-guolao-quick-table-head">
							<span>宫位</span><span>虚实</span><span>星曜</span><span>位置</span>
						</div>
						{houseRows.map((house, idx)=>{
							const stars = byHouse.get(house.name) || [];
							return (
								<div className="horosa-guolao-quick-table-row" key={`${house.name}-${idx}`}>
									<strong>{house.name}</strong>
									<span className={stars.length ? 'horosa-guolao-quick-solid' : 'horosa-guolao-quick-weak'}>{stars.length ? '实' : '虚'}</span>
									<span>{stars.length ? stars.join('、') : '无星曜驻守'}</span>
									<span>{[house.zi, house.area, house.signName].filter(Boolean).join(' · ') || '-'}</span>
								</div>
							);
						})}
						{houseRows.length === 0 ? this.renderMoiraEmpty('当前 Moira 规则层未返回宫位虚实数据。') : null}
					</div>
				))}
				{this.renderMoiraSection('Moira口径', this.renderQuickMeta([
					{label: '虚宫', value: '无七政四余驻守的宫位，按 Moira 虚宫线口径展示。'},
					{label: '实宫', value: '有七政四余驻守的宫位，按 Moira 实宫线口径展示。'},
				]))}
			</div>
		);
	}

	renderQuickNatalStars(){
		const rules = this.state.moiraRules || {};
		const nativeRows = safeList(rules.natalYearStars);
		if(nativeRows.length){
			const anchors = safeMap(rules.anchors);
			return (
				<div className="horosa-guolao-quick-dialog">
					{this.renderMoiraSection('命曜', this.renderQuickYearSignRows(nativeRows))}
					{this.renderMoiraSection('命身锚点', this.renderQuickMeta([
						{label: '命度', value: anchors.life ? [anchors.life.signName, anchors.life.degreeText, anchors.life.zi, anchors.life.moiraHouse, anchors.lifeModeName || rules.lifeModeName].filter(Boolean).join(' · ') : ''},
						{label: '身度', value: anchors.self ? [anchors.self.signName, anchors.self.degreeText, anchors.self.zi, anchors.self.moiraHouse].filter(Boolean).join(' · ') : ''},
						{label: '四柱', value: baziText(this.state.chartObj)},
						{label: '规则源', value: rules.styleSource || 'moira_s.prop'},
					]))}
				</div>
			);
		}
		const rows = buildQuickPlanetRows(this.state.chartObj, rules.planets);
		const anchors = safeMap(rules.anchors);
		return (
			<div className="horosa-guolao-quick-dialog">
				{this.renderMoiraSection('命盘星曜', this.renderQuickPlanetRows(rows))}
				{this.renderMoiraSection('命身锚点', this.renderQuickMeta([
					{label: '命度', value: anchors.life ? [anchors.life.signName, anchors.life.degreeText, anchors.life.zi, anchors.life.moiraHouse, anchors.lifeModeName || rules.lifeModeName].filter(Boolean).join(' · ') : ''},
					{label: '身度', value: anchors.self ? [anchors.self.signName, anchors.self.degreeText, anchors.self.zi, anchors.self.moiraHouse].filter(Boolean).join(' · ') : ''},
					{label: '四柱', value: baziText(this.state.chartObj)},
					{label: '农历', value: lunarText(this.state.chartObj)},
				]))}
			</div>
		);
	}

	renderQuickTransitStars(){
		const rows = buildQuickPlanetRows(this.state.moiraTransitChartObj, []);
		const transitParams = paramsWithMoiraTransit(this.props.fields, this.state.moiraTransitTime);
		const transitYear = yearFromParams(transitParams);
		const rules = this.state.moiraRules || {};
		const nativeRows = safeList(rules.transitYearStars);
		const currentYearStars = safeMap(safeMap(rules.yearStars).transit);
		if(nativeRows.length || safeList(currentYearStars.planetRows).length){
			return (
				<div className="horosa-guolao-quick-dialog">
					{this.renderMoiraSection('流曜', this.state.moiraTransitLoading
						? this.renderMoiraEmpty('流年盘正在计算。')
						: this.renderQuickYearSignRows(nativeRows))}
					{this.renderMoiraSection('流年化曜', this.renderQuickYearPlanetRows(currentYearStars.planetRows))}
					{this.renderMoiraSection('流年参数', this.renderQuickMeta([
						{label: '流年时间', value: `${transitParams.date} ${transitParams.time}`},
						{label: '流年干支', value: currentYearStars.yearPole || stemBranchForYear(transitYear)},
						{label: '规则源', value: rules.styleSource || 'moira_s.prop'},
					]))}
				</div>
			);
		}
		return (
			<div className="horosa-guolao-quick-dialog">
				{this.renderMoiraSection('流曜星体', this.state.moiraTransitLoading
					? this.renderMoiraEmpty('流年盘正在计算。')
					: this.renderQuickPlanetRows(rows))}
				{this.renderMoiraSection('流年参数', this.renderQuickMeta([
					{label: '流年时间', value: `${transitParams.date} ${transitParams.time}`},
					{label: '流年干支', value: stemBranchForYear(transitYear)},
					{label: '流年化曜', value: `${stemBranchForYear(transitYear).slice(0, 1)} → ${MOIRA_YEAR_STAR_BY_STEM[stemBranchForYear(transitYear).slice(0, 1)] || '-'}`},
				]))}
			</div>
		);
	}

	renderQuickAspects(){
		const rows = buildAspectRows(this.state.chartObj && this.state.chartObj.aspects);
		return (
			<div className="horosa-guolao-quick-dialog">
				{this.renderMoiraSection('相位列表', rows.length ? (
					<div className="horosa-guolao-quick-table horosa-guolao-quick-aspect-table">
						<div className="horosa-guolao-quick-table-row horosa-guolao-quick-table-head">
							<span>主星</span><span>相位</span><span>客星</span><span>状态</span><span>误差</span>
						</div>
						{rows.map((row)=>(
							<div className="horosa-guolao-quick-table-row" key={row.key}>
								<strong>{row.from}</strong>
								<span>{row.aspect}</span>
								<span>{row.to}</span>
								<span>{row.state}</span>
								<span>{row.orb || '-'}</span>
							</div>
						))}
					</div>
				) : this.renderMoiraEmpty('当前七政盘没有返回可列出的相位数据。'))}
			</div>
		);
	}

	renderQuickGodRows(rows){
		if(!rows.length){
			return this.renderMoiraEmpty('当前盘没有返回可列出的神煞数据。');
		}
		return (
			<div className="horosa-guolao-quick-god-grid">
				{rows.map((row, idx)=>(
					<div className="horosa-guolao-quick-god-card" key={`${row.house}-${row.zi}-${idx}`}>
							<div className="horosa-guolao-quick-card-title">{row.house || row.zi || `宫位${idx + 1}`}</div>
							<div className="horosa-guolao-quick-card-subtitle">{[row.zi, row.signName].filter(Boolean).join(' · ')}</div>
							{safeList(row.gods).length ? <div><span>曜</span>{joinNames(row.gods)}</div> : (
								<>
									<div><span>吉</span>{joinNames(row.goodGods)}</div>
									<div><span>平</span>{joinNames(row.neutralGods)}</div>
									<div><span>忌</span>{joinNames(row.badGods)}</div>
									<div><span>岁</span>{joinNames(row.taisuiGods)}</div>
								</>
							)}
						</div>
					))}
			</div>
		);
	}

	renderQuickGods(){
		const rules = this.state.moiraRules || {};
		const birthRows = normalizeGodRows(safeList(rules.godHits).length ? rules.godHits : buildGodRowsFromChart(this.state.chartObj, this.props.fields), MOIRA_BIRTH_GOD_ORDER);
		const transitRows = normalizeGodRows(safeList(rules.transitGodHits).length ? rules.transitGodHits : buildGodRowsFromChart(this.state.moiraTransitChartObj, this.props.fields), MOIRA_TRANSIT_GOD_ORDER);
		return (
			<div className="horosa-guolao-quick-dialog">
				{this.renderMoiraSection('本命神煞', this.renderQuickGodRows(birthRows))}
				{this.renderMoiraSection('流年神煞', this.state.moiraTransitLoading ? this.renderMoiraEmpty('流年神煞正在计算。') : this.renderQuickGodRows(transitRows))}
				{this.renderMoiraSection('Moira显示序', this.renderQuickMeta([
					{label: '本命显示序', value: MOIRA_BIRTH_GOD_ORDER.join('、')},
					{label: '流年显示序', value: MOIRA_TRANSIT_GOD_ORDER.join('、')},
				]))}
			</div>
		);
	}

	renderMoiraQuickContent(key){
		if(this.state.moiraLoading && key !== 'transitStars'){
			return this.renderMoiraEmpty('Moira 规则层正在推演，稍后会自动填入。');
		}
		if(key === 'patterns'){
			return this.renderQuickPatterns();
		}
		if(key === 'yearStars'){
			return this.renderQuickYearStars();
		}
		if(key === 'weakSolid'){
			return this.renderQuickWeakSolid();
		}
		if(key === 'natalStars'){
			return this.renderQuickNatalStars();
		}
		if(key === 'transitStars'){
			return this.renderQuickTransitStars();
		}
		if(key === 'aspects'){
			return this.renderQuickAspects();
		}
		if(key === 'gods'){
			return this.renderQuickGods();
		}
		return this.renderMoiraEmpty('请选择一个快捷功能。');
	}

	// ── 天星择日双轮(pick 盘式)数据链 ──
	// 类A:择时时刻(moiraTransitTime)/立命时刻 → 重取端点;类B:electionOptions → 纯重绘。
	requestElectionData(){
		const fields = this.props.fields;
		// pick=择日双轮全量;MOIRA 圆盘也取(仅用 staticHousesBySystem 画西占不等宫宫位格:
		// 上升=1宫头、逆时针、格宽=真实宫宽,与择日盘同款做法)。
		const styleOk = this.state.chartStyle === GUOLAO_CHART_STYLE_PICK || this.state.chartStyle === GUOLAO_CHART_STYLE_MOIRA;
		if(!fields || !styleOk){
			return;
		}
		const tp = paramsWithMoiraTransit(fields, this.state.moiraTransitTime) || {};
		if(!tp.date || tp.gpsLat === undefined || tp.gpsLon === undefined){
			return;
		}
		const seq = ++this.electionReqSeq;
		this.setState({ electionLoading: true });
		// 紫炁黄经透传自流年 chartObj(与全站四余口径同源,防双引擎漂移)
		const transitChart = this.state.moiraTransitChartObj && this.state.moiraTransitChartObj.chart;
		const extraBodies = [];
		if(transitChart && Array.isArray(transitChart.objects)){
			const ziqi = transitChart.objects.find((o)=>o && o.id === AstroConst.PURPLE_CLOUDS);
			if(ziqi && Number.isFinite(Number(ziqi.lon))){
				extraBodies.push({ id: 'PurpleClouds', label: '炁', lon: Number(ziqi.lon), lat: 0, speed: 0 });
			}
			// 天海冥透传择日动盘外圈(与炁同机制:后端按 lon/lat 算地平方位)。用其真黄纬/日行度以准方位与逆行徽标。
			[[AstroConst.URANUS, '天'], [AstroConst.NEPTUNE, '海'], [AstroConst.PLUTO, '冥']].forEach(([oid, lab])=>{
				const o = transitChart.objects.find((x)=>x && x.id === oid);
				if(o && Number.isFinite(Number(o.lon))){
					extraBodies.push({
						id: oid,
						label: lab,
						lon: Number(o.lon),
						lat: Number.isFinite(Number(o.lat)) ? Number(o.lat) : 0,
						speed: Number.isFinite(Number(o.lonspeed)) ? Number(o.lonspeed) : 0,
					});
				}
			});
		}
		const staticParams = this.genParams() || {};
		const values = {
			date: tp.date,
			time: tp.time || '12:00:00',
			// 静盘时刻(左栏顶部时间):内盘西占宫位/1宫头须与静盘上升同时刻同源
			staticDate: staticParams.date,
			staticTime: staticParams.time,
			zone: tp.zone || '8:00',
			gpsLat: tp.gpsLat,
			gpsLon: tp.gpsLon,
			eleLifeMode: this.state.eleLifeMode,
			nodeType: getStoredGuolaoNodeType(),
			lilithType: getStoredGuolaoLilithType(),
			ayanamsaDeg: 0,
			extraBodies,
		};
		fetchQizhengElection(values).then((res)=>{
			if(this.unmounted || seq !== this.electionReqSeq){
				return;
			}
			this.setState({ electionData: res, electionLoading: false });
		}).catch(()=>{
			if(this.unmounted || seq !== this.electionReqSeq){
				return;
			}
			// 端点不可达:保留旧数据(有则续显),仅结束 loading;离线兜底由轮盘层的本地方位计算承担
			this.setState({ electionLoading: false });
		});
	}

	// horosa_guolao_render_memo_v1(PERF-R9 Ship 6):render() 内每次都现造的派生值做**按输入记忆化**。
	// 三处调用点(择日表/择日轮/左栏)每渲一帧就跑三遍 paramsWithMoiraTransit + WMM 磁偏模型;
	// 且每次返回新对象 → 下游 memo/浅比较必然失效。键=(fields, moiraTransitTime) 引用,
	// 与既有 componentDidUpdate 的判变口径(prevState.moiraTransitTime !== this.state.moiraTransitTime)
	// 完全一致:任一变化即重算,不存在陈旧。
	memoTransitParams(){
		const fields = this.props.fields;
		const tm = this.state.moiraTransitTime;
		if(this._tpValue && this._tpFields === fields && this._tpTime === tm){
			return this._tpValue;
		}
		this._tpFields = fields;
		this._tpTime = tm;
		this._tpValue = paramsWithMoiraTransit(fields, tm);
		return this._tpValue;
	}

	// 磁偏解析:自行修正=WMM(按择时年月);手动=输入值恒优先。超模型年限打标供角注警示。
	// horosa_guolao_render_memo_v1:同帧多次调用只算一次(键=electionOptions/fields/moiraTransitTime 引用)。
	resolveElectionDeclination(){
		if(this._declValue !== undefined
			&& this._declEle === this.state.electionOptions
			&& this._declFields === this.props.fields
			&& this._declTime === this.state.moiraTransitTime){
			return this._declValue;
		}
		this._declEle = this.state.electionOptions;
		this._declFields = this.props.fields;
		this._declTime = this.state.moiraTransitTime;
		this._declValue = this.computeElectionDeclination();
		return this._declValue;
	}

	computeElectionDeclination(){
		const ele = this.state.electionOptions || {};
		if(ele.adjNorth === false){
			if(this.state.electionDeclOutOfRange){
				// 手动模式不涉模型,清残留标记(下轮 setState 合并,不在 render 中反复触发)
			}
			return Number(ele.magShiftManual) || 0;
		}
		const tp = paramsWithMoiraTransit(this.props.fields, this.state.moiraTransitTime) || {};
		if(tp.gpsLat === undefined || tp.gpsLon === undefined || !tp.date){
			return 0;
		}
		const parts = `${tp.date}`.replace(/-/g, '/').split('/');
		const year = Number(parts[0]) + (Math.max(1, Number(parts[1]) || 1) - 1) / 12;
		const res = getMagneticDeclination(year, Number(tp.gpsLon), Number(tp.gpsLat));
		if(res.outOfRange !== this.state.electionDeclOutOfRange && !this._declFlagScheduled){
			this._declFlagScheduled = true;
			window.setTimeout(()=>{
				this._declFlagScheduled = false;
				if(!this.unmounted){
					this.setState({ electionDeclOutOfRange: res.outOfRange });
				}
			}, 0);
		}
		return res.declination;
	}

	onGuolaoElectionChange(patch){
		const safe = setStoredGuolaoElection({ ...(this.state.electionOptions || {}), ...(patch || {}) });
		this.setState({ electionOptions: safe });
	}

	// 搜索结果一键设为择日时刻(驱动双轮与流年盘同步重取)
	onPickElectionMoment(row){
		if(!row || !row.date){
			return;
		}
		const cur = this.state.moiraTransitTime;
		const next = cur && cur.clone ? cur.clone() : null;
		if(!next || !next.parse){
			return;
		}
		next.parse(`${`${row.date}`.replace(/-/g, '/')} ${row.time || '12:00:00'}`, 'YYYY-MM-DD HH:mm:ss');
		this.onMoiraTransitTimeChange({ value: next });
	}

	onEleLifeModeChange(val){
		const mode = setStoredGuolaoEleLifeMode(val);
		this.setState({ eleLifeMode: mode });
	}

	// 化曜/虚实/命曜/流曜/相位 五类信息面板原本没有——注入为右栏常驻 tab(信息不得仅在
	// 快捷弹层可见);格局/神煞面板已有同源信息,不重复注入(格局弹窗仍留盘面徽标入口)。
	// horosa_freeze_subtabs_v1:children 一律传【thunk `()=>节点`】(GuoLaoMoiraPanel 的 extraTabs
	// 契约两种形态都吃,那边统一归一后交 FreezeSubTab)。原先是即时构造的节点 —— 择日表/择日搜索/
	// 相位三块的元素树(含 resolveElectionDeclination()、memoTransitParams()、renderQuickAspects()
	// 三次真计算)在每次本组件重渲时都跑一遍,而右栏同时只显 1 个 tab。
	buildMoiraExtraTabs(){
		const wrap = (node)=>(<div className="horosa-guolao-moira">{node}</div>);
		const electionTabs = this.state.chartStyle === GUOLAO_CHART_STYLE_PICK ? [
			{ key: 'election', label: '择日', children: ()=>wrap(
				<GuoLaoElectionTable
					electionData={this.state.electionData}
					transitChartObj={this.state.moiraTransitChartObj}
					moiraRules={this.state.moiraRules}
					election={this.state.electionOptions}
					declination={this.resolveElectionDeclination()}
				/>
			) },
			{ key: 'electionSearch', label: '搜索', children: ()=>wrap(
				<GuoLaoElectionSearch
					fields={this.props.fields}
					transitParams={this.memoTransitParams()}
					onPickMoment={(row)=>this.onPickElectionMoment(row)}
				/>
			) },
		] : [];
		// 化曜/虚实/命曜/流曜 四 tab 已裁撤:化曜=概览生年化曜+星曜表已有;虚实=概览「虚实四柱」
		// 卡;命曜/流曜=星曜 tab 本命/流年两节已有——信息不重复设 tab(用户钦定)。
		return [
			...electionTabs,
			{ key: 'aspects', label: '相位', children: ()=>wrap(this.renderQuickAspects()) },
		];
	}

	renderMoiraQuickModal(){
		const key = this.state.moiraQuickDialog;
		const meta = MOIRA_QUICK_ACTIONS.find((item)=>item.key === key);
		return (
			<XQModal
				className="horosa-guolao-quick-modal"
				visible={!!key}
				title={meta ? `Moira ${meta.label}` : 'Moira'}
				width={980}
				footer={null}
				destroyOnClose
				onCancel={this.closeMoiraQuickDialog}
			>
				{this.renderMoiraQuickContent(key)}
			</XQModal>
		);
	}

	renderQizhengKinRows(rows){
		const list = safeList(rows);
		if(!list.length){
			return <div className="horosa-qizheng-kin-empty">暂无内容</div>;
		}
		return (
			<div className="horosa-qizheng-kin-row-list">
				{list.map((item, idx)=>{
					const value = fmtQizhengKinRowValue(item);
					const lines = splitQizhengKinDisplayLines(value);
					return (
						<div className="horosa-qizheng-kin-row" key={`${item.label || 'row'}-${idx}`}>
							<span>{item.label}</span>
							<strong className={lines.length > 1 ? 'is-multiline' : ''}>
								{lines.map((line, lineIdx)=>(
									<span className="horosa-qizheng-kin-row-line" key={`${item.label || 'row'}-${idx}-${lineIdx}`}>{line}</span>
								))}
							</strong>
						</div>
					);
				})}
			</div>
		);
	}

	renderQizhengKinSection(section){
		return (
			<div className="horosa-qizheng-kin-info-card" key={section.title}>
				<h4>{section.title}</h4>
				{this.renderQizhengKinRows(section.rows)}
			</div>
		);
	}

	renderQizhengKinReadingCards(section){
		const rows = safeList(section && section.rows);
		return (
			<div className="horosa-qizheng-kin-info-card horosa-qizheng-kin-reading-card">
				<h4>{section && section.title ? section.title : '张果断语'}</h4>
				{rows.length ? (
					<div className="horosa-qizheng-kin-reading-list">
						{rows.map((item, idx)=>{
							const level = qizhengKinReadingLevel(item);
							const value = fmtQizhengKinRowValue(item);
							const lines = splitQizhengKinDisplayLines(value);
							return (
								<div className={`horosa-qizheng-kin-reading-item horosa-qizheng-kin-reading-${level}`} key={`${item.label || 'reading'}-${idx}`}>
									<div className="horosa-qizheng-kin-reading-head">
										<span>{qizhengKinReadingBadge(level)}</span>
										<strong>{item.label || '断语'}</strong>
									</div>
									<div className="horosa-qizheng-kin-reading-detail">
										{lines.map((line, lineIdx)=>(
											<p key={`${item.label || 'reading'}-${idx}-${lineIdx}`}>{line}</p>
										))}
									</div>
								</div>
							);
						})}
					</div>
				) : <div className="horosa-qizheng-kin-empty">暂无断语</div>}
			</div>
		);
	}

	renderQizhengKinMingGongBlock(mingGong){
		const data = safeMap(mingGong);
		return (
			<div className="horosa-qizheng-kin-info-stack">
				<div className="horosa-qizheng-kin-info-card">
					<h4>命宫</h4>
					{this.renderQizhengKinRows([
						{label: '地支', value: data.branch},
						{label: '宫位', value: data.house},
						{label: '入命星', value: data.planets},
					])}
				</div>
				{safeList(data.items).map((item)=>(
					<div className="horosa-qizheng-kin-info-card horosa-qizheng-kin-prose" key={item.title}>
						<h4>{item.title}</h4>
						<p>{item.text}</p>
					</div>
				))}
			</div>
		);
	}

	renderQizhengKinBoard(){
		const pan = this.state.qizhengKinPan;
		if(this.state.qizhengKinLoading && !pan){
			return <div className="horosa-qizheng-kin-status">七政四余排盘中...</div>;
		}
		if(this.state.qizhengKinError && !pan){
			return <div className="horosa-qizheng-kin-status horosa-qizheng-kin-error">{this.state.qizhengKinError}</div>;
		}
		if(!pan){
			return <div className="horosa-qizheng-kin-status">请点击起盘，或调整左侧选项。</div>;
		}
		return <GuoLaoQizhengWheel pan={pan} />;
	}

	renderQizhengKinInfoPanel(){
		const pan = this.state.qizhengKinPan;
		const qz = pan && pan.qizheng ? pan.qizheng : {};
		const sections = safeList(pan && pan.sections);
		const sectionByTitle = new Map(sections.map((item)=>[item.title, item]));
		const options = this.state.kinastroOptions || {};
		const zhangguo = safeMap(qz.zhangguo);
		const mingGong = safeMap(qz.mingGong);
		// horosa_freeze_subtabs_v1 接线:content 一律改为**惰性 thunk**(原先在数组构造时就把
		// 全部 9 个面板的元素树造出来 —— 用户只看得见 1 个)。thunk 由 FreezeSubTab 在
		// 「本面板激活过」时才求值:未激活过=零成本;已激活过的面板切走后保留 DOM/组件实例,
		// 切回时拿本轮最新 thunk 立即重渲(不重挂载、不重取数、不闪烁、不丢滚动位置)。
		const overviewContent = ()=>{
			const list = [
				sectionByTitle.get('起盘'),
				sectionByTitle.get('四柱'),
			].filter(Boolean).map((item)=>this.renderQizhengKinSection(item));
			if(options.showMingGong !== false){
				list.push(this.renderQizhengKinMingGongBlock(mingGong));
			}
			return list;
		};
		const tabs = [
			{key: 'overview', label: '概览', content: overviewContent},
			{key: 'planets', label: '星曜', content: ()=>this.renderQizhengKinSection(sectionByTitle.get('星曜') || {title: '星曜', rows: []})},
			{key: 'houses', label: '宫位', content: ()=>this.renderQizhengKinSection(sectionByTitle.get('十二宫') || {title: '十二宫', rows: []})},
			options.showShensha === false ? null : {key: 'shensha', label: '神煞', content: ()=>this.renderQizhengKinSection(sectionByTitle.get('神煞') || {title: '神煞', rows: []})},
			{key: 'dasha', label: '年限', content: ()=>this.renderQizhengKinSection(sectionByTitle.get('年限') || {title: '年限', rows: []})},
			options.showZhangguo === false ? null : {key: 'readings', label: '断语', content: ()=>(
				<div className="horosa-qizheng-kin-info-stack">
					{this.renderQizhengKinReadingCards(sectionByTitle.get('张果断语') || {title: '张果断语', rows: []})}
					<div className="horosa-qizheng-kin-info-card">
						<h4>格局目录</h4>
						<div className="horosa-qizheng-kin-chip-cloud">
							{Object.keys(safeMap(zhangguo.patternsByCategory)).map((key)=>(
								<span key={key}>{key} {safeList(zhangguo.patternsByCategory[key]).length}</span>
							))}
						</div>
					</div>
				</div>
			)},
			qz.transit ? {key: 'transit', label: '流时', content: ()=>this.renderQizhengKinSection(sectionByTitle.get('流时') || {title: '流时', rows: []})} : null,
			qz.electional ? {key: 'electional', label: '择日', content: ()=>this.renderQizhengKinSection(sectionByTitle.get('择日') || {title: '择日', rows: []})} : null,
			qz.mansions ? {key: 'mansion', label: '宿度', content: ()=>(
				<div className="horosa-qizheng-kin-info-stack">
					{sections.filter((item)=>/宿度$/.test(item.title)).map((item)=>this.renderQizhengKinSection(item))}
				</div>
			)} : null,
		].filter(Boolean);
		const active = tabs.some((item)=>item.key === this.state.qizhengKinActiveTab)
			? this.state.qizhengKinActiveTab
			: (tabs[0] ? tabs[0].key : 'overview');
		return (
			<Tabs
				activeKey={active}
				onChange={this.onQizhengKinTabChange}
				tabPosition="top"
				className="horosa-content-tabs horosa-guolao-tabs horosa-qizheng-kin-tabs"
			>
				{tabs.map((item)=>(
					<TabPane tab={item.label} key={item.key}>
						<FreezeSubTab active={active === item.key}>
							{()=>(
								<div className="horosa-qizheng-kin-info-stack">
									{item.content()}
								</div>
							)}
						</FreezeSubTab>
					</TabPane>
				))}
			</Tabs>
		);
	}

	// 快捷栏契约:kinastro 引擎模式下原 9 键=右栏 Tabs 静态镜像,撤;精确引擎模式原 7 张
	// 速查弹层信息已全部常驻右栏(化曜/虚实/命曜/流曜/相位=注入 extraTabs;格局/神煞=面板
	// 原生 tab,格局另留盘面徽标弹窗入口)——信息不得仅在快捷栏可见。命例保存页头已有,不放。
	renderQuickDock(useKinastroQizheng){
		if(useKinastroQizheng){
			return (
				<QuickDockBar
					page="guolao"
					className="horosa-guolao-quick-dock horosa-qizheng-kin-quick-dock"
					hasResult={!!this.state.qizhengKinPan}
					dispatch={this.props.dispatch}
				/>
			);
		}
		return (
			<QuickDockBar
				page="guolao"
				className="horosa-guolao-quick-dock"
				hasResult={!!this.state.chartObj}
				dispatch={this.props.dispatch}
			/>
		);
	}

	// 骨架已提为模块级 GuoLaoChartSkeleton(memo 边界内共用);此方法保留为同名转发,
	// 结构逐字节不变。
	renderGuolaoChartSkeleton(){
		return <GuoLaoChartSkeleton />;
	}

	// 神煞筛选清单=数据驱动:从当前盘 godHits/transitGodHits 现场收集全字集(后端 rule 引擎
	// 实际会画的字远多于固定序表——固定序只作排序前缀,新字追加,保证「选择全面+全联动」)。
	// horosa_guolao_render_memo_v1:神煞全字集收集(遍历 godHits/transitGodHits ~107 字 + 排序)
	// 原先**每帧**跑一次并返回新对象(左栏 GuoLaoInput 的 godNamePools prop 因此帧帧变新)。
	// 键=(moiraRules, chartObj, moiraTransitChartObj) 引用 —— 三者正是收集函数读取的全部输入,
	// 任一变化即重算,勾选↔盘面联动口径不变。
	collectGodNamePools(){
		const rules = this.state.moiraRules;
		const co = this.state.chartObj;
		const tco = this.state.moiraTransitChartObj;
		if(this._godPools && this._godPoolsRules === rules && this._godPoolsChart === co && this._godPoolsTransit === tco){
			return this._godPools;
		}
		this._godPoolsRules = rules;
		this._godPoolsChart = co;
		this._godPoolsTransit = tco;
		this._godPools = this.computeGodNamePools();
		return this._godPools;
	}

	computeGodNamePools(){
		// 与盘面绝对同源:盘面神煞环已切到 rules 引擎(godHits/transitGodHits,Moira prop 规则本尊),
		// 清单从同一 hits 收集(全集 ~107 字,勾选与盘一一联动);rules 未到回退历法 ziGods。
		const rules = this.state.moiraRules || {};
		const pickHits = (hits)=>{
			const out = [];
			const seen = new Set();
			(hits || []).forEach((h)=>{
				[].concat((h && h.gods) || [], (h && h.goodGods) || [], (h && h.neutralGods) || [], (h && h.badGods) || [], (h && h.taisuiGods) || []).forEach((g)=>{
					const name = `${g || ''}`.trim();
					if(name && !seen.has(name)){ seen.add(name); out.push(name); }
				});
			});
			return out;
		};
		const pick = (co)=>{
			const zg = moiraGetZiGods(co, co) || {};
			const out = [];
			const seen = new Set();
			Object.keys(zg).forEach((zi)=>{
				moiraCollectGods(zg, zi).forEach((g)=>{
					if(g && !seen.has(g)){ seen.add(g); out.push(g); }
				});
			});
			return out;
		};
		const orderBy = (names, order)=>{
			const inOrder = order.filter((g)=>names.indexOf(g) >= 0);
			const extras = names.filter((g)=>order.indexOf(g) < 0);
			return inOrder.concat(extras);
		};
		const birthHits = pickHits(rules.godHits);
		const transitHits = pickHits(rules.transitGodHits);
		return {
			birth: orderBy(birthHits.length ? birthHits : pick(this.state.chartObj), MOIRA_BIRTH_GOD_ORDER),
			transit: orderBy(transitHits.length ? transitHits : pick(this.state.moiraTransitChartObj || this.state.chartObj), MOIRA_TRANSIT_GOD_ORDER),
		};
	}

	render(){
		let height = this.props.height ? this.props.height : 760;
		if(height === '100%'){
			height = 'calc(100% - 70px)'
		}else{
			height = height - 20
		}

		let chartObj = this.state.chartObj;
		let chart = chartObj ? chartObj.chart : {};
		chart.aspects = chartObj ? chartObj.aspects : {};
		chart.lots = chartObj ? chartObj.lots : [];
		const useMoiraWheel = this.state.chartStyle === GUOLAO_CHART_STYLE_MOIRA;
		const usePickWheel = this.state.chartStyle === GUOLAO_CHART_STYLE_PICK;
		const useMoiraLikeWheel = useMoiraWheel || usePickWheel;
		const moiraPanelChartObj = this.state.moiraPanelChartObj || chartObj;
		const moiraPanelTransitChartObj = this.state.moiraPanelTransitChartObj || this.state.moiraTransitChartObj;
		const moiraPanelTransitParams = this.state.moiraPanelTransitParams || this.memoTransitParams();
		const useKinastroQizheng = this.state.engineMode === 'kinastro';
		const stageTransitParams = this.memoTransitParams();
		const stageDeclination = this.resolveElectionDeclination();

		return (
			<div className={`horosa-guolao-page horosa-astro-redesign horosa-guolao-redesign${useKinastroQizheng ? ' horosa-qizheng-kin-page' : ''}`}>
				<div className="horosa-astro-layout horosa-astro-redesign-layout horosa-guolao-redesign-layout">
					<div className="horosa-astro-redesign-grid horosa-guolao-redesign-grid">
						<div className="horosa-astro-context-panel horosa-astro-input-panel horosa-guolao-input-panel">
							<GuoLaoInput
								fields={this.props.fields}
								onFieldsChange={this.onFieldsChange}
								engineMode={this.state.engineMode}
								onEngineModeChange={this.onEngineModeChange}
								kinastroOptions={this.state.kinastroOptions}
								onKinastroOptionChange={this.onKinastroOptionChange}
								chartStyle={this.state.chartStyle}
								onChartStyleChange={this.onChartStyleChange}
								moiraTransitTime={this.state.moiraTransitTime}
								onMoiraTransitTimeChange={this.onMoiraTransitTimeChange}
								showMoiraTransitGods={this.state.showMoiraTransitGods}
								onMoiraTransitGodsVisibleChange={this.onMoiraTransitGodsVisibleChange}
								guolaoDisplay={this.state.guolaoDisplay}
								onGuolaoDisplayChange={this.onGuolaoDisplayChange}
								godNamePools={this.collectGodNamePools()}
								electionOptions={this.state.electionOptions}
								onGuolaoElectionChange={(patch)=>this.onGuolaoElectionChange(patch)}
								eleLifeMode={this.state.eleLifeMode}
								onEleLifeModeChange={(val)=>this.onEleLifeModeChange(val)}
								electionDeclination={this.resolveElectionDeclination()}
								electionDeclOutOfRange={this.state.electionDeclOutOfRange}
								onOpenPatternDialog={()=>this.openMoiraQuickDialog('patterns')}
							/>
						</div>
						<div className={`horosa-chart-stage horosa-chart-stage-redesign horosa-guolao-chart-panel xq-chart-renderer xq-chart-renderer-guolao${useMoiraLikeWheel ? ' horosa-guolao-chart-panel-moira' : ''}`}>
							{useKinastroQizheng ? this.renderQizhengKinBoard() : (
								<GuoLaoChartStage
									variant={(this.state.bundleLoading && !chartObj) ? 'skeleton' : usePickWheel ? 'pick' : useMoiraWheel ? 'moira' : 'classic'}
									rootValue={chartObj}
									value={chart}
									transitValue={this.state.moiraTransitChartObj}
									transitParams={stageTransitParams}
									transitLoading={this.state.moiraTransitLoading}
									moiraRules={this.state.moiraRules}
									display={this.state.guolaoDisplay}
									showMoiraTransitGods={this.state.showMoiraTransitGods}
									election={this.state.electionOptions}
									electionData={this.state.electionData}
									declination={stageDeclination}
									declinationOutOfRange={this.state.electionDeclOutOfRange}
									height={height}
									fields={this.props.fields}
									chartDisplay={this.props.chartDisplay}
									planetDisplay={this.props.planetDisplay}
									onTipClick={this.onTipClick}
									onAgeClick={this.onLimitAgeClick}
								/>
							)}
						</div>
						<div className="horosa-inspector-panel horosa-astro-content-panel horosa-guolao-info-panel">
							{useKinastroQizheng ? this.renderQizhengKinInfoPanel() : (
									<GuoLaoMoiraPanel
										value={this.state.moiraRules}
										loading={this.state.bundleLoading || this.state.moiraLoading}
										rootValue={moiraPanelChartObj}
										transitValue={moiraPanelTransitChartObj}
										transitParams={moiraPanelTransitParams}
										fields={this.props.fields}
										display={this.state.guolaoDisplay}
										chartMode={usePickWheel ? 'pick' : 'moira'}
										extraTabs={this.buildMoiraExtraTabs()}
									/>
							)}
						</div>
					</div>
					{this.renderQuickDock(useKinastroQizheng)}
				</div>
				{useKinastroQizheng ? null : this.renderMoiraQuickModal()}
			</div>
		);
	}
}

export default GuoLaoChartMain;
