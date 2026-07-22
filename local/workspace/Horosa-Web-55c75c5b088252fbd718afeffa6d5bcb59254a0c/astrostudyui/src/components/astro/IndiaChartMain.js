import { Component, memo } from 'react';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { sideSectionIcon } from '../../constants/sideSectionIcons'; // [观象P1]
import { createPortal } from 'react-dom';
import moment from 'moment';
import IndiaChart, { fieldsToParams, requestIndiaChartData } from './IndiaChart';
import { resolveLagnaRefSignNumber } from './IndiaSouthChart';
import DateTime from '../comp/DateTime';
import QuickDockBar from '../common/QuickDockBar';
import SpaceTimePanel from '../comp/SpaceTimePanel';
import {convertLatToStr, convertLonToStr} from './AstroHelper';
import { resolveGeoZone } from '../../utils/timezone';
import { geoNameRawPatch } from '../../utils/geoName';
import * as AstroConst from '../../constants/AstroConst';
import { XQSegmented as Segmented, XQSelect as Select, XQTabs as Tabs, XQDatePicker as DatePicker, XQInputNumber as InputNumber, XQSideSection  } from '../xq-ui';
import XQIcon from '../xq-icons';

const TabPane = Tabs.TabPane;
const {Option, OptGroup} = Select;
const DASHA_YEAR_DAYS = 365.25;
const NAKSHATRA_SIZE = 360 / 27;
const INDIA_DEGREE_DISPLAY_DEGREE = 'degree';
const INDIA_DEGREE_DISPLAY_FULL = 'full';
const INDIA_DEGREE_DISPLAY_OPTIONS = [
	{ value: INDIA_DEGREE_DISPLAY_DEGREE, label: '只度数' },
	{ value: INDIA_DEGREE_DISPLAY_FULL, label: '度数+分数' },
];
const YOGA_CATEGORY_LABELS = {
	'Pancha Mahapurusha': '五大人瑜伽',
	Lunar: '月亮瑜伽',
	Solar: '太阳瑜伽',
	Raja: '王瑜伽',
	Dhana: '财富瑜伽',
	Viparita: '逆转王瑜伽',
	Parivartana: '交换瑜伽',
	Nabhasa: '形态瑜伽',
	Challenge: '挑战/煞',
	Support: '保护瑜伽',
	Association: '星体关联',
	Spiritual: '出离/灵性',
};
const YOGA_CATEGORY_ORDER = [
	'Pancha Mahapurusha', 'Raja', 'Dhana', 'Lunar', 'Solar', 'Viparita',
	'Parivartana', 'Nabhasa', 'Support', 'Association', 'Spiritual', 'Challenge',
];
const DASHA_SEQUENCE = [
	{ key: 'Ketu', label: '计都', en: 'Ketu', years: 7 },
	{ key: 'Venus', label: '金星', en: 'Venus', years: 20 },
	{ key: 'Sun', label: '太阳', en: 'Sun', years: 6 },
	{ key: 'Moon', label: '月亮', en: 'Moon', years: 10 },
	{ key: 'Mars', label: '火星', en: 'Mars', years: 7 },
	{ key: 'Rahu', label: '罗睺', en: 'Rahu', years: 18 },
	{ key: 'Jupiter', label: '木星', en: 'Jupiter', years: 16 },
	{ key: 'Saturn', label: '土星', en: 'Saturn', years: 19 },
	{ key: 'Mercury', label: '水星', en: 'Mercury', years: 17 },
];
const DASHA_BY_KEY = DASHA_SEQUENCE.reduce((map, item, idx)=>{
	map[item.key] = {
		...item,
		idx,
	};
	return map;
}, {});

const NAKSHATRAS = [
	['Ashwini', 'Ketu'], ['Bharani', 'Venus'], ['Krittika', 'Sun'],
	['Rohini', 'Moon'], ['Mrigashira', 'Mars'], ['Ardra', 'Rahu'],
	['Punarvasu', 'Jupiter'], ['Pushya', 'Saturn'], ['Ashlesha', 'Mercury'],
	['Magha', 'Ketu'], ['Purva Phalguni', 'Venus'], ['Uttara Phalguni', 'Sun'],
	['Hasta', 'Moon'], ['Chitra', 'Mars'], ['Swati', 'Rahu'],
	['Vishakha', 'Jupiter'], ['Anuradha', 'Saturn'], ['Jyeshtha', 'Mercury'],
	['Mula', 'Ketu'], ['Purva Ashadha', 'Venus'], ['Uttara Ashadha', 'Sun'],
	['Shravana', 'Moon'], ['Dhanishta', 'Mars'], ['Shatabhisha', 'Rahu'],
	['Purva Bhadrapada', 'Jupiter'], ['Uttara Bhadrapada', 'Saturn'], ['Revati', 'Mercury'],
];

function normalizeDegree(value){
	let num = Number(value);
	if(!Number.isFinite(num)){
		return null;
	}
	num = num % 360;
	if(num < 0){
		num += 360;
	}
	return num;
}

function getChartObjects(chartObj){
	const chart = chartObj && chartObj.chart ? chartObj.chart : chartObj;
	if(chart && chart.objects && Array.isArray(chart.objects)){
		return chart.objects;
	}
	return [];
}

function getMoonObject(chartObj){
	const objects = getChartObjects(chartObj);
	for(let i=0; i<objects.length; i++){
		if(objects[i] && objects[i].id === AstroConst.MOON){
			return objects[i];
		}
	}
	return null;
}

function momentFromFieldValue(value, fallbackFormat){
	if(!value){
		return null;
	}
	// DateTime(ad/year 分离存储)必须走对象构造:公元前/五位年的字符串 parse 在 moment 的
	// YYYY token 下 Invalid(负号被撕/贪吃 4 位)→静默 null→dasha 年龄标签与缓存键坏(串盘)。
	// moment 对象构造支持任意整数年(BC 用天文年 -abs+1),全域安全。
	if(value.ad !== undefined && value.year !== undefined && value.month !== undefined){
		return moment({
			year: value.ad < 0 ? -Math.abs(value.year) + 1 : Math.abs(value.year),
			month: Math.max(0, (value.month || 1) - 1),
			date: value.date !== undefined ? value.date : 1,
			hour: value.hour || 0,
			minute: value.minute || 0,
			second: value.second || 0,
			millisecond: 0,
		});
	}
	if(value.format){
		const formatted = fallbackFormat ? value.format(fallbackFormat) : value.format('YYYY-MM-DD HH:mm:ss');
		const parsedFormatted = fallbackFormat ? moment(formatted, fallbackFormat) : moment(formatted, 'YYYY-MM-DD HH:mm:ss');
		return parsedFormatted.isValid() ? parsedFormatted : null;
	}
	if(value.year && value.month && value.date && value.hour !== undefined){
		return moment({
			year: value.ad < 0 ? -Math.abs(value.year) + 1 : Math.abs(value.year),
			month: Math.max(0, value.month - 1),
			date: value.date,
			hour: value.hour,
			minute: value.minute || 0,
			second: value.second || 0,
			millisecond: 0,
		});
	}
	const parsed = fallbackFormat ? moment(value, fallbackFormat) : moment(value);
	return parsed.isValid() ? parsed : null;
}

function buildBirthMoment(fields){
	if(!fields || !fields.date || !fields.time || !fields.date.value || !fields.time.value){
		return null;
	}
	const birth = momentFromFieldValue(fields.date.value, 'YYYY-MM-DD');
	const time = momentFromFieldValue(fields.time.value, 'HH:mm:ss');
	if(!birth || !time){
		return null;
	}
	if(birth.hour && time.hour){
		birth.hour(time.hour());
		birth.minute(time.minute());
		birth.second(time.second ? time.second() : 0);
		birth.millisecond(0);
	}
	return birth;
}

function addDashaYears(momentValue, years){
	if(!momentValue || !momentValue.clone){
		return null;
	}
	return momentValue.clone().add(years * DASHA_YEAR_DAYS * 24 * 60 * 60 * 1000, 'milliseconds');
}

function subtractDashaYears(momentValue, years){
	if(!momentValue || !momentValue.clone){
		return null;
	}
	return momentValue.clone().subtract(years * DASHA_YEAR_DAYS * 24 * 60 * 60 * 1000, 'milliseconds');
}

function formatDuration(years){
	const totalMonths = Math.max(0, Math.round(years * 12));
	const y = Math.floor(totalMonths / 12);
	const m = totalMonths % 12;
	if(y && m){
		return `${y}年${m}月`;
	}
	if(y){
		return `${y}年`;
	}
	return `${m}月`;
}

function formatAge(years){
	if(years < 0){
		return `出生前${Math.abs(years).toFixed(1)}年`;
	}
	return `${years.toFixed(1)}岁`;
}

function buildDashaSubPeriods(item){
	if(item && Array.isArray(item.antardashas)){
		return item.antardashas.map((subItem)=>({
			...subItem,
			lord: normalizeDashaLord(subItem.lord),
			start: moment(subItem.start),
			end: moment(subItem.end),
		}));
	}
	if(!item || !item.start || !item.lord){
		return [];
	}
	const subItems = [];
	let start = item.start.clone();
	let lordIndex = Number.isFinite(item.lord.idx)
		? item.lord.idx
		: DASHA_SEQUENCE.findIndex((lord)=>lord.key === item.lord.key);
	if(lordIndex < 0){
		return [];
	}
	for(let i=0; i<DASHA_SEQUENCE.length; i++){
		const currentLordIndex = lordIndex % DASHA_SEQUENCE.length;
		const lord = {
			...DASHA_SEQUENCE[currentLordIndex],
			idx: currentLordIndex,
		};
		const years = item.years * lord.years / 120;
		const end = i === DASHA_SEQUENCE.length - 1 ? item.end.clone() : addDashaYears(start, years);
		if(!end || !end.clone){
			break;
		}
		subItems.push({
			lord,
			years,
			start: start.clone(),
			end: end.clone(),
		});
		start = end;
		lordIndex += 1;
	}
	return subItems;
}

function normalizeDashaLord(lord){
	if(!lord){
		return {
			key: '',
			label: '—',
			en: '',
			years: 0,
		};
	}
	const local = DASHA_BY_KEY[lord.key] || DASHA_SEQUENCE.find((item)=>item.en === lord.key || item.key === lord.key);
	return {
		...(local || {}),
		...lord,
		en: lord.en || lord.key || (local ? local.en : ''),
		label: lord.label || (local ? local.label : lord.key),
	};
}

// WP-D 大运多级钻取(§9.3/§9.5):大运→小运→子运→微运→息运,共 5 级。
// 每级 buildDashaSubPeriods 递归细分(子时长=父时长×子主年/120),钻取式 + 面包屑。
const DASHA_LEVEL_LABELS = [
	{ cn: '大运', en: 'Mahā' },
	{ cn: '小运', en: 'Antar' },
	{ cn: '子运', en: 'Pratyantar' },
	{ cn: '微运', en: 'Sūkṣma' },
	{ cn: '息运', en: 'Prāṇa' },
];
const DASHA_MAX_LEVEL = DASHA_LEVEL_LABELS.length;

// 某运段是否含「今日」(各级金色高亮 + 当前徽标用);start/end 为 moment 或可被 moment 解析。
function dashaContainsNow(item){
	if(!item || !item.start || !item.end){
		return false;
	}
	const s = item.start.valueOf ? item.start.valueOf() : moment(item.start).valueOf();
	const e = item.end.valueOf ? item.end.valueOf() : moment(item.end).valueOf();
	const now = moment().valueOf();
	return now >= s && now < e;
}

const DASHA_SYSTEM_OPTIONS = [
	{ value: 'vimshottari', label: 'Vimshottari' },
	{ value: 'yogini', label: 'Yogini' },
	{ value: 'ashtottari', label: 'Ashtottari' },
	{ value: 'tribhagi', label: 'Tribhāgī（÷3）' },
	{ value: 'shodashottari', label: 'Shodashottari' },
	{ value: 'dvadashottari', label: 'Dvadashottari' },
	{ value: 'panchottari', label: 'Panchottari' },
	{ value: 'shatabdika', label: 'Shatabdika' },
	{ value: 'chaturashitiSama', label: 'Chaturashiti' },
	{ value: 'dwisaptatiSama', label: 'Dwisaptati' },
	{ value: 'shashtihayani', label: 'Shashtihayani' },
	{ value: 'shattrimshaSama', label: 'Shattrimsha' },
	{ value: 'chara', label: 'Chara' },
];
// 8 条件 Nakshatra 大运(QW10/11):仅在其起算条件满足时为「主用」,否则引擎仍给全表供「备览」。
const DASHA_CONDITIONAL_KEYS = ['shodashottari', 'dvadashottari', 'panchottari', 'shatabdika', 'chaturashitiSama', 'dwisaptatiSama', 'shashtihayani', 'shattrimshaSama'];
// Jaimini 星座大运(rasi-based,非 graha):周期=各座到其主星距,与宿系大运渲染口径不同。
const DASHA_JAIMINI_KEYS = ['chara'];
const DASHA_SYSTEM_LABEL = {
	vimshottari: 'Vimshottari 大运（120 年）',
	yogini: 'Yogini 大运（36 年 · 8 女神）',
	ashtottari: 'Ashtottari 大运（108 年 · Ardradi）',
	tribhagi: 'Tribhāgī 三分大运（Vimśottarī÷3 · 3 遍×40=120 年）',
	shodashottari: 'Shodashottari 十六上行（116 年 · 条件）',
	dvadashottari: 'Dvadashottari 十二上行（112 年 · 条件）',
	panchottari: 'Panchottari 五上行（105 年 · 条件）',
	shatabdika: 'Shatabdika 百年（100 年 · 条件）',
	chaturashitiSama: 'Chaturashiti-sama 八四均（84 年 · 条件）',
	dwisaptatiSama: 'Dwisaptati-sama 七二均（72 年 · 条件）',
	shashtihayani: 'Shashtihayani 六十（60 年 · 条件）',
	shattrimshaSama: 'Shattrimsha-sama 三六均（36 年 · 条件）',
	chara: 'Chara 耆那星座大运（Jaimini · 按座推）',
};

// 大运起点(seed):标准取月亮宿;支持改取七政/节点/上升/特殊上升/副星(虚点)任一点的宿起运。
// 与后端 _dasha_seed_lon(seed) 同 key;后端解析该点 D1 黄经→宿→主→余额,全体系(标准+条件)同享。
const DASHA_SEED_DEFAULT = 'moon';
// 导出供 techniqueMountSettings 内联镜像做 === 防漂移断言(AI 挂载大运起点下拉与本盘同源)。
export const DASHA_SEED_OPTIONS = [
	{ label: '七政', options: [
		{ value: 'moon', label: '月亮 Moon · 标准' },
		{ value: 'sun', label: '太阳 Sun' },
		{ value: 'mars', label: '火星 Mars' },
		{ value: 'mercury', label: '水星 Mercury' },
		{ value: 'jupiter', label: '木星 Jupiter' },
		{ value: 'venus', label: '金星 Venus' },
		{ value: 'saturn', label: '土星 Saturn' },
	] },
	{ label: '节点 / 上升', options: [
		{ value: 'rahu', label: '罗睺 Rahu' },
		{ value: 'ketu', label: '计都 Ketu' },
		{ value: 'asc', label: '上升 Lagna' },
	] },
	{ label: '特殊上升', options: [
		{ value: 'bhavaLagna', label: 'Bhava Lagna 命运上升' },
		{ value: 'horaLagna', label: 'Hora Lagna 时上升' },
		{ value: 'ghatikaLagna', label: 'Ghati Lagna 漏刻上升' },
		{ value: 'sreeLagna', label: 'Sree Lagna 吉祥上升' },
	] },
	{ label: '副星 · 虚点', options: [
		{ value: 'gulika', label: 'Gulika 土曜子' },
		{ value: 'maandi', label: 'Maandi 摩底' },
		{ value: 'dhuma', label: 'Dhuma 烟' },
		{ value: 'vyatipata', label: 'Vyatipata' },
		{ value: 'parivesha', label: 'Parivesha 晕' },
		{ value: 'indrachapa', label: 'Indrachapa 虹' },
		{ value: 'upaketu', label: 'Upaketu' },
	] },
];
const DASHA_SEED_LABEL = {};
DASHA_SEED_OPTIONS.forEach((g)=>g.options.forEach((o)=>{ DASHA_SEED_LABEL[o.value] = o.label; }));

// 分盘集(多盘并列网格)可选分盘:D1..D60(与 state.hook 同口径)。label = D{n} · 类象。
const VARGA_GRID_OPTIONS = [
	{ value: 1, name: 'Rashi', label: 'D1 · 命盘' },
	{ value: 2, name: 'Hora', label: 'D2 · 财产' },
	{ value: 3, name: 'Drekkana', label: 'D3 · 兄妹' },
	{ value: 4, name: 'Chaturthamsa', label: 'D4 · 资质' },
	{ value: 5, name: 'Panchamsa', label: 'D5 · 世俗' },
	{ value: 6, name: 'Shashthamsa', label: 'D6 · 疾病' },
	{ value: 7, name: 'Saptamsa', label: 'D7 · 子嗣' },
	{ value: 8, name: 'Ashthamsa', label: 'D8 · 困难' },
	{ value: 9, name: 'Navamsa', label: 'D9 · 合作' },
	{ value: 10, name: 'Dasamsa', label: 'D10 · 事业' },
	{ value: 11, name: 'Rudramsa', label: 'D11 · 增长' },
	{ value: 12, name: 'Dwadasamsa', label: 'D12 · 父辈' },
	{ value: 16, name: 'Shodasamsa', label: 'D16 · 座驾' },
	{ value: 20, name: 'Vimsamsa', label: 'D20 · 灵魂' },
	{ value: 24, name: 'Chaturvimsamsa', label: 'D24 · 教育' },
	{ value: 27, name: 'Nakshatramsa', label: 'D27 · 生命' },
	{ value: 30, name: 'Trimsamsa', label: 'D30 · 厄运' },
	{ value: 40, name: 'Khavedamsa', label: 'D40 · 母系' },
	{ value: 45, name: 'Akshavedamsa', label: 'D45 · 父系' },
	{ value: 60, name: 'Shashtyamsa', label: 'D60 · 业力' },
];
const VARGA_GRID_LABEL = VARGA_GRID_OPTIONS.reduce((acc, o)=>{ acc[o.value] = o.label; return acc; }, {});
const VARGA_GRID_MAX = 4;
// 默认四盘:命盘 D1 / 合作 D9(婚配核心) / 事业 D10 / 父辈 D12——印度盘最常对照组。
const VARGA_GRID_DEFAULT = [1, 9, 10, 12];

// QW10/11 条件 Nakshatra 大运:把 jyotish.extendedDashas.conditional[key] 映射成与 Vimshottari
// 同形的 {nakshatra, firstBalance, items[]} 结构,以复用既有大运渲染器(条目/小运/年龄)。
//   出生余额起算:start = 出生 − firstElapsed;首运按余额年、其后按全周期年依序排布。
//   小运无绝对日期 → 按 antardasha 年比例填入大运 [start,end] 窗口(视觉连续)。
function buildExtendedConditionalDasha(chartObj, fields, key){
	const ed = chartObj && chartObj.jyotish && chartObj.jyotish.extendedDashas;
	const c = ed && ed.conditional && ed.conditional[key];
	if(!c || !Array.isArray(c.mahadashas) || !c.mahadashas.length){
		return null;
	}
	const birth = buildBirthMoment(fields);
	if(!birth || !birth.clone){
		return null;
	}
	const firstElapsed = c.firstElapsedYears || 0;
	let start = subtractDashaYears(birth, firstElapsed);
	if(!start || !start.clone){
		return null;
	}
	const now = Date.now();
	const items = c.mahadashas.map((m, i)=>{
		const periodYears = (i === 0 && m.balance && m.years != null) ? m.years : (m.fullYears != null ? m.fullYears : m.years);
		const end = addDashaYears(start, periodYears) || start.clone();
		let antardashas = null;
		if(Array.isArray(m.antardashas) && m.antardashas.length){
			const tot = m.antardashas.reduce((s, a)=>s + (a.years || 0), 0) || 1;
			let cur = start.clone();
			antardashas = m.antardashas.map((a)=>{
				const dur = periodYears * (a.years || 0) / tot;
				const aEnd = addDashaYears(cur, dur) || cur.clone();
				const row = { lord: a.lord, years: dur, start: cur.clone().toISOString(), end: aEnd.clone().toISOString() };
				cur = aEnd;
				return row;
			});
		}
		const item = {
			lord: normalizeDashaLord(m.lord),
			years: periodYears,
			start: start.clone(),
			end: end.clone ? end.clone() : start.clone(),
			startAge: start.diff(birth, 'days', true) / DASHA_YEAR_DAYS,
			endAge: end.diff ? end.diff(birth, 'days', true) / DASHA_YEAR_DAYS : null,
			isBirthBalance: i === 0 && !!m.balance,
			active: now >= start.valueOf() && now < (end.valueOf ? end.valueOf() : start.valueOf()),
			antardashas,
		};
		start = end.clone ? end.clone() : start;
		return item;
	});
	const vimMoon = chartObj.jyotish.dasha && chartObj.jyotish.dasha.vimshottari && chartObj.jyotish.dasha.vimshottari.moonNakshatra;
	return {
		backend: true,
		extended: true,
		available: !!c.available,
		conditionNote: c.conditionNote || (c.available ? '' : '起算条件未满足 · 仅备览全表'),
		moonLon: null,
		nakshatra: {
			name: vimMoon ? vimMoon.name : (c.label || key),
			index: vimMoon ? vimMoon.index : '',
			lord: normalizeDashaLord(c.firstLord),
		},
		firstBalance: c.firstBalanceYears || 0,
		firstElapsed,
		items,
	};
}

// QW10/11 Chara(Jaimini 星座大运):rasi-based,每运是一个星座(非行星)。把 extendedDashas.chara
// 映射进既有大运渲染器:以「座名」充当 lord.label,出生起依序排日期,小运按 periodYears 比例填窗口。
function buildCharaDasha(chartObj, fields){
	const ed = chartObj && chartObj.jyotish && chartObj.jyotish.extendedDashas;
	const c = ed && ed.chara;
	if(!c || !Array.isArray(c.mahadashas) || !c.mahadashas.length){
		return null;
	}
	const birth = buildBirthMoment(fields);
	if(!birth || !birth.clone){
		return null;
	}
	const now = Date.now();
	let start = birth.clone();
	const items = c.mahadashas.map((m)=>{
		const yrs = m.years || 0;
		const end = addDashaYears(start, yrs) || start.clone();
		let antardashas = null;
		if(Array.isArray(m.antardashas) && m.antardashas.length){
			const tot = m.antardashas.reduce((s, a)=>s + (a.periodYears || 0), 0) || 1;
			let cur = start.clone();
			antardashas = m.antardashas.map((a)=>{
				const dur = yrs * (a.periodYears || 0) / tot;
				const aEnd = addDashaYears(cur, dur) || cur.clone();
				const row = { lord: { label: a.rasiLabel, en: a.rasi, key: a.rasi }, years: dur, start: cur.clone().toISOString(), end: aEnd.clone().toISOString() };
				cur = aEnd;
				return row;
			});
		}
		const item = {
			lord: { label: m.rasiLabel, en: m.rasi, key: m.rasi },
			years: yrs,
			start: start.clone(),
			end: end.clone ? end.clone() : start.clone(),
			startAge: start.diff(birth, 'days', true) / DASHA_YEAR_DAYS,
			endAge: end.diff ? end.diff(birth, 'days', true) / DASHA_YEAR_DAYS : null,
			isBirthBalance: false,
			active: now >= start.valueOf() && now < (end.valueOf ? end.valueOf() : start.valueOf()),
			antardashas,
		};
		start = end.clone ? end.clone() : start;
		return item;
	});
	return {
		backend: true,
		extended: true,
		chara: true,
		available: true,
		moonLon: null,
		nakshatra: {
			name: c.seedLabel || c.seed,
			index: '',
			lord: { label: c.seedLabel || c.seed, en: c.seed, key: c.seed },
		},
		firstBalance: 0,
		firstElapsed: 0,
		items,
	};
}

function buildVimshottariDasha(chartObj, fields, system){
	const sys = system || 'vimshottari';
	if(sys === 'chara'){
		return buildCharaDasha(chartObj, fields);
	}
	if(DASHA_CONDITIONAL_KEYS.indexOf(sys) >= 0){
		return buildExtendedConditionalDasha(chartObj, fields, sys);
	}
	const backend = chartObj && chartObj.jyotish && chartObj.jyotish.dasha && chartObj.jyotish.dasha[sys];
	if(backend && backend.available && Array.isArray(backend.mahadashas)){
		return {
			backend: true,
			moon: null,
			moonLon: backend.moonLongitude,
			nakshatra: {
				...(backend.moonNakshatra || {}),
				lord: normalizeDashaLord(backend.firstLord || (backend.moonNakshatra ? {key: backend.moonNakshatra.lord} : null)),
			},
			firstBalance: backend.firstBalanceYears,
			firstElapsed: backend.firstElapsedYears,
			items: backend.mahadashas.map((item)=>({
				...item,
				lord: normalizeDashaLord(item.lord),
				start: moment(item.start),
				end: moment(item.end),
				active: !!item.active,
				isBirthBalance: !!item.birthBalance,
			})),
		};
	}
	// Yogini/Ashtottari 只走后端(引擎恒算);无后端不回退 Vimshottari 老算法,避免错算。
	if(sys !== 'vimshottari'){
		return null;
	}
	const moon = getMoonObject(chartObj);
	const moonLon = normalizeDegree(moon ? moon.lon : null);
	const birth = buildBirthMoment(fields);
	if(moonLon === null || !birth){
		return null;
	}
	const nakIndex = Math.min(26, Math.floor(moonLon / NAKSHATRA_SIZE));
	const nakStart = nakIndex * NAKSHATRA_SIZE;
	const progress = (moonLon - nakStart) / NAKSHATRA_SIZE;
	const remainingRatio = Math.max(0, Math.min(1, 1 - progress));
	const nak = NAKSHATRAS[nakIndex];
	const firstLord = DASHA_BY_KEY[nak[1]];
	if(!firstLord){
		return null;
	}
	const firstBalance = firstLord.years * remainingRatio;
	const firstElapsed = firstLord.years - firstBalance;
	const items = [];
	if(!birth.clone){
		return null;
	}
	let start = subtractDashaYears(birth, firstElapsed);
	if(!start || !start.clone){
		return null;
	}
	let lordIndex = firstLord.idx;
	for(let i=0; i<10; i++){
		const currentLordIndex = lordIndex % DASHA_SEQUENCE.length;
		const lord = {
			...DASHA_SEQUENCE[currentLordIndex],
			idx: currentLordIndex,
		};
		const years = lord.years;
		const end = addDashaYears(start, years);
		if(!end || !end.clone){
			break;
		}
		items.push({
			lord,
			years,
			start: start.clone(),
			end: end.clone(),
			startAge: start.diff(birth, 'days', true) / DASHA_YEAR_DAYS,
			endAge: end.diff(birth, 'days', true) / DASHA_YEAR_DAYS,
			isBirthBalance: i === 0,
			active: Date.now() >= start.valueOf() && Date.now() < end.valueOf(),
		});
		start = end;
		lordIndex += 1;
	}
	return {
		moon,
		moonLon,
		nakshatra: {
			name: nak[0],
			index: nakIndex + 1,
			progress,
			remainingRatio,
			lord: firstLord,
		},
		firstBalance,
		firstElapsed,
		items,
	};
}

function getJyotish(chartObj){
	return chartObj && chartObj.jyotish ? chartObj.jyotish : null;
}

function hasYogaPayload(chartObj){
	return !!(chartObj && chartObj.jyotish && chartObj.jyotish.yogas !== undefined);
}

function hasJyotishPayload(chartObj){
	return !!(chartObj && chartObj.jyotish);
}

function formatJyotishDate(value){
	if(!value){
		return '—';
	}
	if(value.format){
		return value.format('YYYY-MM-DD');
	}
	const parsed = moment(value);
	return parsed.isValid() ? parsed.format('YYYY-MM-DD') : `${value}`;
}

// 微运/息运 极短(时/分级),仅按日期会出现多段同日 → 精确到 时:分。
function formatJyotishDateTime(value){
	if(!value){
		return '—';
	}
	if(value.format){
		return value.format('YYYY-MM-DD HH:mm');
	}
	const parsed = moment(value);
	return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm') : `${value}`;
}

// 短运段(年→0月无意义)的细粒度时长:天/时/分。
function formatDurationFine(years){
	const totalMs = Math.max(0, Number(years) || 0) * DASHA_YEAR_DAYS * 24 * 60 * 60 * 1000;
	const days = totalMs / 86400000;
	if(days >= 1){
		const d = Math.floor(days);
		const hrs = Math.round((days - d) * 24);
		return hrs ? `${d}天${hrs}时` : `${d}天`;
	}
	const hours = totalMs / 3600000;
	if(hours >= 1){
		const h = Math.floor(hours);
		const m = Math.round((hours - h) * 60);
		return m ? `${h}时${m}分` : `${h}时`;
	}
	const mins = Math.max(1, Math.round(totalMs / 60000));
	return `${mins}分`;
}

// WP-B 用宫号(从 asc)反查其星座 → 再按参照重数(供 Bhava Bala 标题最强/最弱宫)。
function dispHouseByNum(houses, houseNum, dispHouse){
	const b = Array.isArray(houses) ? houses.find((x)=>x.house === houseNum) : null;
	return b ? dispHouse(b.sign, b.house) : houseNum;
}

function formatDegree(value){
	const num = Number(value);
	if(!Number.isFinite(num)){
		return '—';
	}
	const deg = Math.floor(num);
	const min = Math.floor((num - deg) * 60);
	return `${deg}°${`${min}`.padStart(2, '0')}′`;
}

function getJyotishPlanetStates(jyotish){
	return jyotish && jyotish.strengths && Array.isArray(jyotish.strengths.planetaryStates)
		? jyotish.strengths.planetaryStates
		: [];
}

function getJyotishDasha(chartObj){
	return chartObj && chartObj.jyotish && chartObj.jyotish.dasha ? chartObj.jyotish.dasha.vimshottari : null;
}

function normalizeChartDateKey(value){
	return `${value || ''}`.replace(/\//g, '-');
}

function buildJyotishParamsKey(params){
	if(!params){
		return '';
	}
	return [
		normalizeChartDateKey(params.date),
		params.time || '',
		params.ad,
		params.zone || '',
		params.lon || '',
		params.lat || '',
		params.gpsLon,
		params.gpsLat,
		params.hsys,
		params.indiaAyanamsa || AstroConst.INDIA_AYANAMSA_DEFAULT,
	].join('|');
}

function cloneIndiaFieldValue(value){
	if(value && value.clone){
		try{
			return value.clone();
		}catch(e){}
	}
	if(value && typeof value === 'object'){
		return {
			...value,
		};
	}
	return value;
}

function cloneIndiaFieldsForJyotish(fields){
	if(!fields){
		return null;
	}
	const cloned = {
		...fields,
	};
	Object.keys(cloned).forEach((key)=>{
		const item = cloned[key];
		if(item && typeof item === 'object' && Object.prototype.hasOwnProperty.call(item, 'value')){
			cloned[key] = {
				...item,
				value: cloneIndiaFieldValue(item.value),
			};
		}
	});
	return cloned;
}

function resolveJyotishChartObj(state, fields){
	const activeKey = buildDashaFieldsKey(fields);
	if(!state || !activeKey){
		return null;
	}
	if(hasJyotishPayload(state.mainChartObj) && state.mainChartKey === activeKey){
		return state.mainChartObj;
	}
	if(hasJyotishPayload(state.dashaChartObj) && state.dashaChartKey === activeKey){
		return state.dashaChartObj;
	}
	// keep-stale(stale-while-revalidate):当前 key 暂无匹配(切换/重取进行中)→ 回退上次成功盘,
	// 面板不空白、不闪满屏加载框;后台算好后 setState 替换为新盘(配「更新中…」角标提示)。
	// 首次加载前 lastChartObj 为 null → 返回 null,仍走 dashaLoading 的「计算中」首屏提示。
	return hasJyotishPayload(state.lastChartObj) ? state.lastChartObj : null;
}

function hasUsableJyotishChart(state, fieldsKey){
	if(!state || !fieldsKey){
		return false;
	}
	if(hasYogaPayload(state.mainChartObj) && state.mainChartKey === fieldsKey){
		return true;
	}
	if(hasYogaPayload(state.dashaChartObj) && state.dashaChartKey === fieldsKey){
		return true;
	}
	return false;
}

function buildDashaFieldsKey(fields){
	if(!fields || !fields.date || !fields.time){
		return '';
	}
	// date 位直接用 DateTime 自身 format(带符号年,BC/五位年保真)——不经 moment,
	// 消灭「不同 BC 生日撞同一 dasha 缓存键」的串盘面。
	const dateText = (fields.date.value && fields.date.value.format)
		? fields.date.value.format('YYYY-MM-DD') : '';
	const timeMoment = momentFromFieldValue(fields.time.value, 'HH:mm:ss');
	return [
		dateText,
		timeMoment ? timeMoment.format('HH:mm:ss') : '',
		fields.ad ? fields.ad.value : '',
		fields.zone ? fields.zone.value : '',
		fields.lon ? fields.lon.value : '',
		fields.lat ? fields.lat.value : '',
		fields.gpsLon ? fields.gpsLon.value : '',
		fields.gpsLat ? fields.gpsLat.value : '',
		fields.indiaHsys ? fields.indiaHsys.value : AstroConst.INDIA_HOUSE_SYSTEM_DEFAULT,
		fields.indiaAyanamsa ? fields.indiaAyanamsa.value : AstroConst.INDIA_AYANAMSA_DEFAULT,
		fields.indiaNodeType ? fields.indiaNodeType.value : AstroConst.INDIA_NODE_TYPE_DEFAULT,
		// 🔴 年度盘年份必须进缓存/取盘键:否则换年与旧盘同键 → resolveJyotishChartObj 取回旧年盘、
		// requestDashaChart 守卫误判已有数据而跳过 fetch（年份输入「先跳别年再算/算错」的根因）。
		(fields.indiaTajakaYear && fields.indiaTajakaYear.value != null && fields.indiaTajakaYear.value !== '') ? fields.indiaTajakaYear.value : '',
		// 🔴 大运起点(seed)同理:换起点后端重算全体系大运,不进键则守卫跳过 fetch / 取回旧起点盘。
		(fields.indiaDashaSeed && fields.indiaDashaSeed.value) ? fields.indiaDashaSeed.value : DASHA_SEED_DEFAULT,
		// 🔴 当前显示盘分盘号:右边栏随显示盘算(分盘集取第一个),不进键则换分盘守卫跳过 fetch / 取回旧盘。
		(fields.indiaActiveFractal && fields.indiaActiveFractal.value) ? fields.indiaActiveFractal.value : 1,
		// 🔴 行运过运日期:换日期后端重算 gochara,不进键则守卫跳过 fetch / 取回旧过运盘。
		(fields.indiaTransitDate && fields.indiaTransitDate.value) ? fields.indiaTransitDate.value : '',
		// 🔴 Sthira 起座(lagna/brahma):换起座后端重算 Sthira 运,不进键则守卫跳过 fetch。
		(fields.indiaSthiraStart && fields.indiaSthiraStart.value) ? fields.indiaSthiraStart.value : 'lagna',
		// 🔴 大运体系:dasha-selected 重构后后端只算选中体系全树,换体系=须重取;不进键则 requestDashaChart
		// 守卫(同 key + loading)早退跳过 fetch → 「选其他大运压根不算」(blank 等待排盘数据 + 大运计算中 卡死)。
		(fields.indiaDashaSystem && fields.indiaDashaSystem.value) ? fields.indiaDashaSystem.value : 'vimshottari',
	].join('|');
}

function canBuildIndiaChartParams(fields){
	const nullableKeys = ['name', 'pos'];
	const requiredKeys = [
		'date', 'time', 'ad', 'zone', 'lat', 'lon', 'gpsLat', 'gpsLon',
		'tradition', 'strongRecption', 'simpleAsp', 'virtualPointReceiveAsp',
		'name', 'pos',
	];
	return requiredKeys.every((key)=>fields && fields[key] && fields[key].value !== undefined
		&& (nullableKeys.indexOf(key) >= 0 || fields[key].value !== null));
}

// ═══════════════════════════════════════════════════════════════════════════════
// horosa_india_settings_memo_v1(PERF-R9 Ship 6):左栏「印占设置」提为 React.memo 子组件。
//
// 病灶:IndiaChartMain 是 3900 行、state 极多的单体,右栏的**纯局部**状态
// (dashaExpandedAntarKey 展开某条小运、indiaAspectSource 点星高亮、dashaDrillPath 钻取、
// jyotishTab 换子页签、tajakaYearInput 敲一个字符)每变一次就整树 render 一遍 ——
// 连同左栏这 10 个 antd Select(岁差分组几十项、宫制分组、分盘 20 项、分盘集多选…)
// 和 SpaceTimePanel 一起白重建。这些控件跟右栏那些 state **一个都不相干**。
//
// 修法:把左栏整块搬进 memo 子组件,props 只收它真正消费的那些值。
//   · 全部 onXxx 都是构造期 bind 的稳定引用(原先唯一的 render 内联箭头已提为
//     changeIndiaCounterClockwiseSelect),
//   · fields / datetm / splitOptions 三个对象引用分别由 withIndiaOptionFields、
//     resolveDateTime、resolveSplitItems 做 memo,不再每帧换新,
//   → 默认浅比较即可命中:右栏局部交互时本块 0 次 render;而任何一项设置值或 fields 变化
//     都会换掉对应 prop → 立即重渲。**不存在「该更新不更新」**:props 列表就是 JSX 里
//     引用到的全集(新增控件时必须同步加 prop,否则会留陈旧显示)。
const IndiaSettingsPanel = memo(function IndiaSettingsPanel(props){
	const {
		fields, datetm, onTimeChange, timeHook, onGeoChange,
		indiaSchool, onSchoolChange,
		indiaAyanamsa, onAyanamsaChange,
		indiaHsys, onHsysChange,
		indiaNodeType, onNodeTypeChange,
		currentTab, onTabChange, splitOptions,
		degreeDisplayMode, onDegreeDisplayModeChange,
		vargaSetOpen, onToggleVargaSet, vargaSetFractals, onVargaSetFractalsChange,
		indiaChartStyle, onChartStyleChange,
		indiaLagnaRef, onLagnaRefChange,
		indiaPlanetDisplayMode, onPlanetDisplayModeChange,
		indiaCounterClockwise, onCounterClockwiseChange,
	} = props;
	return (
		<div className="horosa-astro-context-panel horosa-astro-input-panel horosa-india-input-panel">
			<div className="horosa-india-input-stack">
				<div className="horosa-side-panel-heading">
					<div>
						<div className="horosa-side-panel-title">印占设置</div>
						<div className="horosa-side-panel-subtitle">时间、地点与分盘选项</div>
					</div>
				</div>
				<XQSideSection iconName={sideSectionIcon('time')} title="时间与地点" collapsible={false}>
				<SpaceTimePanel
					fields={fields}
					value={datetm}
					onTimeChange={onTimeChange}
					timeHook={timeHook}
					onGeoChange={onGeoChange}
				/>
				</XQSideSection>
				<XQSideSection iconName={sideSectionIcon('switches')} title="选项" storageKey="india.s1" className="horosa-side-input-section">
						<div className="horosa-india-select-grid">
							<div className="horosa-india-select-field horosa-india-school-field">
								<span>流派</span>
								<Select
									size="small"
									style={{width: '100%'}}
									value={indiaSchool}
									onChange={onSchoolChange}
									dropdownMatchSelectWidth={false}
								>
									{AstroConst.INDIA_SCHOOL_OPTIONS.map((item)=>(
										<Option value={item.value} key={item.value}>{item.label}</Option>
									))}
								</Select>
							</div>
							<div className="horosa-india-select-field">
								<span>岁差制</span>
								<Select
									size="small"
									style={{width: '100%'}}
									value={indiaAyanamsa}
									onChange={onAyanamsaChange}
									dropdownMatchSelectWidth={false}
								>
									{AstroConst.groupOptions(AstroConst.INDIA_AYANAMSA_OPTIONS).map((grp)=>(
										<OptGroup label={grp.group} key={grp.group}>
											{grp.items.map((item)=>(
												<Option value={item.value} key={item.value}>{item.label}</Option>
											))}
										</OptGroup>
									))}
								</Select>
							</div>
							<div className="horosa-india-select-field">
								<span>分宫制</span>
								<Select
									size="small"
									style={{width: '100%'}}
									value={indiaHsys}
									onChange={onHsysChange}
									dropdownMatchSelectWidth={false}
								>
									{AstroConst.groupOptions(AstroConst.INDIA_HOUSE_SYSTEM_OPTIONS).map((grp)=>(
										<OptGroup label={grp.group} key={grp.group}>
											{grp.items.map((item)=>(
												<Option value={item.value} key={item.value}>{item.label}</Option>
											))}
										</OptGroup>
									))}
								</Select>
							</div>
							<div className="horosa-india-select-field">
								<span>交点</span>
								<Select
									size="small"
									style={{width: '100%'}}
									value={indiaNodeType}
									onChange={onNodeTypeChange}
									dropdownMatchSelectWidth={false}
								>
									{AstroConst.INDIA_NODE_TYPE_OPTIONS.map((item)=>(
										<Option value={item.value} key={item.value}>{item.label}</Option>
									))}
								</Select>
							</div>
								<div className="horosa-india-select-field">
									<span>当前分盘</span>
									<Select
									size="small"
									style={{width: '100%'}}
									value={currentTab}
									onChange={onTabChange}
									dropdownMatchSelectWidth={false}
								>
									{splitOptions.map((item)=>(
										<Option value={item.value} key={item.value}>{item.label}</Option>
									))}
									</Select>
								</div>
								<div className="horosa-india-select-field">
									<span>完整度数</span>
									<Select
										size="small"
										style={{width: '100%'}}
										value={degreeDisplayMode}
										onChange={onDegreeDisplayModeChange} dropdownMatchSelectWidth={false}
									>
										{INDIA_DEGREE_DISPLAY_OPTIONS.map((item)=>(
											<Option value={item.value} key={item.value}>{item.label}</Option>
										))}
									</Select>
								</div>
							</div>
					<div className="horosa-india-vargaset-block">
						<div className="horosa-india-vargaset-head">
							<span className="horosa-side-section-title">分盘集</span>
							<button
								type="button"
								className={`horosa-india-vargaset-toggle${vargaSetOpen ? ' is-active' : ''}`}
								onClick={onToggleVargaSet}
							>{vargaSetOpen ? '并列 2×2' : '单盘'}</button>
						</div>
						{vargaSetOpen ? (
							<Select
								mode="multiple"
								size="small"
								style={{width: '100%'}}
								value={vargaSetFractals}
								onChange={onVargaSetFractalsChange}
								maxTagCount="responsive"
								placeholder="选择分盘（最多 4）"
								dropdownMatchSelectWidth={false}
							>
								{VARGA_GRID_OPTIONS.map((item)=>(
									<Option
										value={item.value}
										key={item.value}
										disabled={vargaSetFractals.length >= VARGA_GRID_MAX && vargaSetFractals.indexOf(item.value) < 0}
									>{item.label}</Option>
								))}
							</Select>
						) : null}
					</div>
					<div className="horosa-india-style-block">
						<div className="horosa-side-section-title">盘式</div>
						<Segmented
							value={indiaChartStyle}
							onChange={onChartStyleChange}
							options={AstroConst.INDIA_CHART_STYLE_OPTIONS}
						/>
					</div>
					<div className="horosa-india-style-block">
						<div className="horosa-side-section-title">第1宫参照</div>
						<Select
							size="small"
							style={{ width: '100%' }}
							value={indiaLagnaRef}
							onChange={onLagnaRefChange}
							dropdownMatchSelectWidth={false}
						>
							{AstroConst.INDIA_LAGNA_REF_OPTIONS.map((grp)=>(
								<OptGroup key={grp.label} label={grp.label}>
									{grp.options.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
								</OptGroup>
							))}
						</Select>
					</div>
					<div className="horosa-india-select-grid">
						<div className="horosa-india-select-field">
							<span>星体</span>
							<Select
								size="small"
								style={{ width: '100%' }}
								value={indiaPlanetDisplayMode}
								onChange={onPlanetDisplayModeChange}
								dropdownMatchSelectWidth={false}
							>
								{AstroConst.INDIA_PLANET_DISPLAY_OPTIONS.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
							</Select>
						</div>
						{indiaChartStyle !== AstroConst.INDIA_CHART_STYLE_SOUTH ? (
							<div className="horosa-india-select-field">
								<span>显示方向</span>
								<Select
									size="small"
									style={{ width: '100%' }}
									value={indiaCounterClockwise ? 'ccw' : 'cw'}
									onChange={onCounterClockwiseChange}
									dropdownMatchSelectWidth={false}
								>
									<Option value="ccw">逆时针</Option>
									<Option value="cw">顺时针</Option>
								</Select>
							</div>
						) : null}
					</div>
				</XQSideSection>
			</div>
		</div>
	);
});

class IndiaChartMain extends Component{
	// [R3-A6] 渲染守卫:宿主无关 dispatch 不再全树重渲(nextState 引用变照常放行;
	// 开关 horosa.perf.chartSCU,语义详 chartUpdateGuard.wrapperPropsEqual)。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){
			return true;
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}


	constructor(props) {
		super(props);
		this.state = {
			currentTab: "Natal",
			currentFractal: 1,
			dashaChartObj: null,
			dashaLoading: false,
			// 最近一次成功取数的盘(stale-while-revalidate):切换/重取期间面板回退显示它,
			// 避免清盘空白 + 满屏「载入中/计算中」大框;算好后被新盘替换。首次加载前为 null → 仍走 dashaLoading 提示。
			lastChartObj: null,
			// 后台重取中标志(非阻塞):配合 lastChartObj 在角落显轻量「更新中…」角标,不盖盘不挡操作。
			dashaUpdating: false,
			dashaFieldsKey: '',
			dashaChartKey: '',
			dashaPopoverItem: null,
			dashaPopoverStyle: null,
			// 当前展开的主运 key(inline 手风琴,代替原 popover)。null=全收起。
			dashaExpandedKey: null,
			dashaExpandedAntarKey: null,
			// WP-D 大运钻取路径:存各级选中项的索引([mahaIdx, antarIdx, …],最深 4 → 第5级息运)。
			// 存索引而非对象 → 每次 render 对当前 dasha 重解析,换盘/换体系不会留陈旧对象。
			dashaDrillPath: [],
			mainChartObj: null,
			mainChartKey: '',
			activeJyotishFields: null,
			activeJyotishKey: '',
			jyotishTab: '3',
			dashaSystem: 'vimshottari',
			dashaSeed: DASHA_SEED_DEFAULT,
			indiaSthiraStart: 'lagna',   // Sthira 起座:lagna(默认)/brahma(BPHS §10.5)
			indiaTransitDateValue: null,   // 行运过运日期(null=默认今日);走 indiaTransitDate→transitDate 透传
			prasnaNumber: 1,               // Praśna 卜卦问数 1-249(纯前端查 KP249 静态表,不透传)
			// WP-A 相映:点盘中某星 → 高亮其相映宫;再点取消/点他星切换。null=无。
			indiaAspectSource: null,
			indiaHsysValue: null,
			indiaAyanamsaValue: null,
			indiaNodeTypeValue: null,
			indiaSchool: AstroConst.INDIA_SCHOOL_DEFAULT,
			indiaAspectParadigm: AstroConst.INDIA_SCHOOL_DEFAULTS[AstroConst.INDIA_SCHOOL_DEFAULT].aspectParadigm,
			visibleTabKeys: AstroConst.INDIA_SCHOOL_DEFAULTS[AstroConst.INDIA_SCHOOL_DEFAULT].tabs,
			indiaTajakaYearValue: null,
			tajakaYearInput: '',
			degreeDisplayMode: INDIA_DEGREE_DISPLAY_DEGREE,
			// WP-C 星体显示:文字 / 符号(glyph)。WP-N §1.6 纯显示开关:逆时针(宫格方向)、锁定水瓶(南印固定格)。
			indiaPlanetDisplayMode: AstroConst.INDIA_PLANET_DISPLAY_TEXT,
			indiaCounterClockwise: true,
			indiaLockAquarius: false,
			// WP-B 上升宫位(第1宫)参照:默认上升,可选七政/虚点/宫1-12 为第1宫。纯显示重参照(§1.6/§12.3)。
			indiaLagnaRef: AstroConst.INDIA_LAGNA_REF_DEFAULT,
			// 分盘集:多盘并列 2×2 网格。vargaSetOpen 开关;vargaSetFractals 选定分盘(最多 4)。
			vargaSetOpen: false,
			vargaSetFractals: VARGA_GRID_DEFAULT.slice(),
			hook: {
				Natal:{
					txt:'命盘',
					fractal: 1,
					fun: null
				},
				Hora:{
					txt:'财产',
					fractal: 2,
					fun: null
				},
				Drekkana:{
					txt:'兄妹',
					fractal: 3,
					fun: null
				},
				Chaturthamsa:{
					txt:'资质',
					fractal: 4,
					fun: null
				},
				Panchamsa:{
					txt:'世俗',
					fractal: 5,
					fun: null
				},
				Shashthamsa:{
					txt:'疾病',
					fractal: 6,
					fun: null
				},
				Saptamsa:{
					txt:'子嗣',
					fractal: 7,
					fun: null
				},
				Ashthamsa:{
					txt:'困难',
					fractal: 8,
					fun: null
				},
				Navamsa:{
					txt:'合作',
					fractal: 9,
					fun: null
				},
				Dasamsa:{
					txt:'事业',
					fractal: 10,
					fun: null
				},
				Rudramsa:{
					txt:'增长',
					fractal: 11,
					fun: null
				},
				Dwadasamsa:{
					txt:'父辈',
					fractal: 12,
					fun: null
				},
				Shodasamsa:{
					txt:'座驾',
					fractal: 16,
					fun: null
				},
				Vimsamsa:{
					txt:'灵魂',
					fractal: 20,
					fun: null
				},
				Chaturvimsamsa:{
					txt:'教育',
					fractal: 24,
					fun: null
				},
				Nakshatramsa:{
					txt:'生命',
					fractal: 27,
					fun: null
				},
				Trimsamsa:{
					txt:'厄运',
					fractal: 30,
					fun: null
				},
				Khavedamsa:{
					txt:'母系',
					fractal: 40,
					fun: null
				},
				Akshavedamsa:{
					txt:'父系',
					fractal: 45,
					fun: null
				},
				Shashtyamsa:{
					txt:'业力',
					fractal: 60,
					fun: null
				},
	
			},
		};

		this.changeTab = this.changeTab.bind(this);
		this.onFieldsChange = this.onFieldsChange.bind(this);
		this.changeTime = this.changeTime.bind(this);
			this.changeGeo = this.changeGeo.bind(this);
			this.changeHsys = this.changeHsys.bind(this);
			this.changeIndiaAyanamsa = this.changeIndiaAyanamsa.bind(this);
			this.changeIndiaSchool = this.changeIndiaSchool.bind(this);
			this.changeIndiaNodeType = this.changeIndiaNodeType.bind(this);
		this.changeIndiaTajakaYear = this.changeIndiaTajakaYear.bind(this);
			this.toggleVargaSet = this.toggleVargaSet.bind(this);
			this.changeVargaSetFractals = this.changeVargaSetFractals.bind(this);
			this.changeDegreeDisplayMode = this.changeDegreeDisplayMode.bind(this);
			this.changeIndiaChartStyle = this.changeIndiaChartStyle.bind(this);
		this.requestDashaChart = this.requestDashaChart.bind(this);
		this.showDashaSubPopover = this.showDashaSubPopover.bind(this);
		this.changeDashaSystem = this.changeDashaSystem.bind(this);
		this.changeDashaSeed = this.changeDashaSeed.bind(this);
		this.changeTransitDate = this.changeTransitDate.bind(this);
		this.toggleIndiaAspect = this.toggleIndiaAspect.bind(this);
		this.changeIndiaPlanetDisplayMode = this.changeIndiaPlanetDisplayMode.bind(this);
		this.changeIndiaCounterClockwise = this.changeIndiaCounterClockwise.bind(this);
		this.changeIndiaLockAquarius = this.changeIndiaLockAquarius.bind(this);
		this.changeIndiaLagnaRef = this.changeIndiaLagnaRef.bind(this);
		this.toggleDashaExpanded = this.toggleDashaExpanded.bind(this);
		this.toggleDashaAntarExpanded = this.toggleDashaAntarExpanded.bind(this);
		this.drillDasha = this.drillDasha.bind(this);
		this.dashaBreadcrumbTo = this.dashaBreadcrumbTo.bind(this);
		this.hideDashaSubPopover = this.hideDashaSubPopover.bind(this);
		this.changeJyotishTab = this.changeJyotishTab.bind(this);
		this.handleMainChartLoad = this.handleMainChartLoad.bind(this);
		this.changeIndiaCounterClockwiseSelect = this.changeIndiaCounterClockwiseSelect.bind(this);
			this.lastDashaRequestKey = '';
			this.lastObservedFieldsKey = '';
			this.mainIndiaChartRef = null;
			// horosa_india_fields_memo_v1 / horosa_india_settings_memo_v1 的实例级缓存槽
			// (见 withIndiaOptionFields / resolveDateTime / resolveSplitItems 上的注释)。
			this._optionFieldsMemo = null;
			this._optionFieldsMemoSrc = null;
			this._optionFieldsMemoKey = '';
			this._datetmMemo = null;
			this._datetmMemoKey = null;
			this._splitItemsMemo = null;
			this._splitOptionsMemo = null;

		this.tmHook = {
			getValue: null,
		};

		if(this.props.hook){
			this.props.hook.fun = (fields)=>{
				let hook = this.state.hook;
				if(hook[this.state.currentTab].fun){
					let fld = {
						...fields,
						chartnum: {
							value: this.state.currentFractal
						}
					}
					hook[this.state.currentTab].fun(fld)
				}
				this.requestDashaChart(this.withIndiaOptionFields(fields));
			};
			// PERF-R9 Ship 7:/india/chart 与主 /chart 互不依赖(印占盘只吃 fields + 本页选项)——
			// 在 /chart 返回【之前】并行发出:latency 从「网络 + 技法」变「max(网络, 技法)」。
			// silent(requestIndiaChartData 内置)、丢结果、绝不 setState。
			// 闸:horosa.perf.prewarmRequests(模型层判定,关=此函数不被调用,逐字节旧序)。
			this.props.hook.prewarmRequests = (flds)=>{
				try{
					const params = this.buildIndiaPrefetchParams(flds || this.props.fields);
					if(params){
						requestIndiaChartData(params).catch(()=>{ /* 预热静默 */ });
					}
				}catch(e){ /* 预热失败无害 */ }
			};
			// horosa_prefetch_registry_v1(PERF-R9 Ship 7):/india/chart 是确定性纯计算
			// (同 生辰+分盘/大运体系 恒同盘)→ 登记步进预取。
			// 🔴 登记必须在组件内:分盘号/大运体系/ayanamsa 全在 this.state,模块级构不出同键 body。
			if(stepPrefetchEnabled()){
				registerStepPrefetcher('indiachart', (steppedFields)=>{
					const params = this.buildIndiaPrefetchParams(steppedFields);
					if(!params){
						return [];
					}
					return [{
						name: 'india:chart',
						path: '/india/chart',
						run: ()=> requestIndiaChartData(params),
					}];
				});
			}
		}

	}

	// PERF-R9 Ship 7:预热/预取的构参权威入口 —— 与 requestDashaChart 首点【同一路径】
	// (withIndiaOptionFields → cloneIndiaFieldsForJyotish → fieldsToParams + chartnum)。
	// 差一个字节 indiaChartCache 的键就不同 = 白预取。构不出参时返 null(静默跳过)。
	buildIndiaPrefetchParams(fields){
		try{
			const src = this.withIndiaOptionFields(fields || this.props.fields);
			if(!canBuildIndiaChartParams(src)){
				return null;
			}
			const jyotishFields = cloneIndiaFieldsForJyotish(src);
			const params = fieldsToParams(jyotishFields);
			params.chartnum = (jyotishFields.indiaActiveFractal && jyotishFields.indiaActiveFractal.value) || 1;
			return params;
		}catch(e){
			return null;
		}
	}


	changeTab(key){		
		let hook = this.state.hook;
		this.setState({
			currentTab: key,
			currentFractal: hook[key].fractal
		}, ()=>{
			if(this.state.hook[key] && this.state.hook[key].fun){
				this.state.hook[key].fun();
			}
			if(this.props.dispatch){
				this.props.dispatch({
					type: 'astro/save',
					payload: {
						currentSubTab: key,
					}
				});
			}	
		});
	}

	onFieldsChange(values){
		let flds = this.withIndiaOptionFields(this.props.fields);
		if(this.props.onChange){
			try{
				const changedFields = this.props.onChange(values);
				if(changedFields){
					flds = this.withIndiaOptionFields(changedFields);
				}
			}catch(e){
				if(typeof window !== 'undefined' && window.console){
					window.console.error(e);
				}
			}
		}
		if(!flds){
			return;
		}
		// 🔴 时间分 6 字段(年/月/日/时/分/秒)输入:弹层编辑中(confirmed===false:逐字段改/未点确定)
		// 只更新输入显示(props.onChange 已做)、不重算 → 免一次输入连算 6 次;点「确定」(confirmed:true)
		// 或非时间变更(confirmed===undefined,如选地点/流派/选项/步进器调整)才重算一次。
		if(values && values.confirmed === false){
			return;
		}
		// 🔴 复核修:withIndiaOptionFields 现在**会缓存并复用**返回对象(horosa_india_fields_memo_v1),
		// 原地 `flds.chartnum = {}` 等于往那个被 render/子组件共享的缓存对象里塞键(改前每次都是新对象,
		// 就地写无害)。改成不可变复制:内容逐字等价,且缓存对象保持只读、不被污染。
		flds = {
			...flds,
			chartnum: { value: this.state.currentFractal },
		};
		let hook = this.state.hook[this.state.currentTab];
		if(hook.fun){
			hook.fun(flds);
		}
		this.requestDashaChart(flds);
	}

	changeTime(value){
		let dt = value.time;
		this.onFieldsChange({
			tm: dt.clone(),
			confirmed: !!value.confirmed,
			date: {
				value: dt.clone(),
			},
			time:{
				value: dt.clone(),
			},
			ad:{
				value: dt.ad,
			},
			zone:{
				value: dt.zone,
			}
		});
	}

	changeGeo(rec){
		let dt = this.tmHook.getValue ? this.tmHook.getValue().value : null;
		const patch = {
			lon: convertLonToStr(rec.lng),
			lat: convertLatToStr(rec.lat),
			gpsLon: rec.gpsLng,
			gpsLat: rec.gpsLat,
		};
		if(dt){
			// 选地点 → 时区自动校正(只改时区标签、保留输入的钟面时刻;手动改过时区则沿用 rec.zone)
			const ds = dt.format ? dt.format('YYYY-MM-DD') : null;
			const z = resolveGeoZone(rec, ds);
			const nd = dt.clone();
			if(z && nd.setZone){ nd.setZone(z); }
			patch.tm = nd;
			patch.ad = nd.ad;
			patch.zone = nd.zone;
		}
		Object.assign(patch, geoNameRawPatch(rec));
		this.onFieldsChange(patch);
	}

	changeIndiaSchool(value){
		// 流派预设包·软联动:切派写默认岁差/宫制/相位范式 + 可见 tab 子集,触发后端按新岁差/宫制重算;
		// 用户随后仍可单独改岁差/宫制(软联动)。默认 parashari = 零行为差异。
		const school = AstroConst.normalizeIndiaSchool(value);
		const def = AstroConst.getIndiaSchoolDefaults(school);
		const tabs = def.tabs;
		const curTab = `${this.state.jyotishTab || '1'}`;
		const nextTab = tabs.indexOf(curTab) >= 0 ? curTab : tabs[0];
		// stale-while-revalidate:不清盘(requestDashaChart 设 dashaUpdating + lastChartObj 回退),换派算好平滑换新。
		this.setState({
			indiaSchool: school,
			indiaAspectParadigm: def.aspectParadigm,
			visibleTabKeys: tabs,
			jyotishTab: nextTab,
			indiaAyanamsaValue: def.ayanamsa,
			indiaHsysValue: def.hsys,
		}, ()=>{
			this.requestDashaChart(this.withIndiaOptionFields(this.props.fields, {
				indiaHsys: def.hsys,
				indiaAyanamsa: def.ayanamsa,
			}));
		});
	}

	changeHsys(value){
		const indiaHsys = AstroConst.normalizeIndiaHouseSystem(value);
		const indiaAyanamsa = this.state.indiaAyanamsaValue !== null && this.state.indiaAyanamsaValue !== undefined
			? this.state.indiaAyanamsaValue
			: (this.props.fields && this.props.fields.indiaAyanamsa ? AstroConst.normalizeIndiaAyanamsa(this.props.fields.indiaAyanamsa.value) : AstroConst.INDIA_AYANAMSA_DEFAULT);
		this.setState({
			indiaHsysValue: indiaHsys,
		}, ()=>{
			this.requestDashaChart(this.withIndiaOptionFields(this.props.fields, {
				indiaHsys,
				indiaAyanamsa,
			}));
		});
	}

	changeIndiaAyanamsa(value){
		const indiaAyanamsa = AstroConst.normalizeIndiaAyanamsa(value);
		const indiaHsys = this.state.indiaHsysValue !== null && this.state.indiaHsysValue !== undefined
			? this.state.indiaHsysValue
			: (this.props.fields && this.props.fields.indiaHsys ? AstroConst.normalizeIndiaHouseSystem(this.props.fields.indiaHsys.value) : AstroConst.INDIA_HOUSE_SYSTEM_DEFAULT);
		this.setState({
			indiaAyanamsaValue: indiaAyanamsa,
		}, ()=>{
			this.requestDashaChart(this.withIndiaOptionFields(this.props.fields, {
				indiaHsys,
				indiaAyanamsa,
			}));
		});
	}

	changeIndiaNodeType(value){
		const indiaNodeType = AstroConst.normalizeIndiaNodeType(value && value.target ? value.target.value : value);
		this.setState({
			indiaNodeTypeValue: indiaNodeType,
		}, ()=>{
			this.requestDashaChart(this.withIndiaOptionFields(this.props.fields, {
				indiaNodeType,
			}));
		});
	}

	changeIndiaTajakaYear(value){
		const raw = value && value.target ? value.target.value : value;
		const yr = parseInt(raw, 10);
		const indiaTajakaYear = Number.isNaN(yr) ? null : yr;
		this.setState({
			indiaTajakaYearValue: indiaTajakaYear,
		}, ()=>{
			this.requestDashaChart(this.withIndiaOptionFields(this.props.fields, {
				indiaTajakaYear,
			}));
		});
	}

	applyTajakaYear(){
		// 直接读输入框 DOM 当前值，避免受控 state 异步未刷新(快速输入+点击)读到旧值 → 算错年。
		const el = this._tajakaYearInputEl;
		const raw = (el && el.value !== undefined && el.value !== '') ? el.value : this.state.tajakaYearInput;
		const yr = parseInt(raw, 10);
		if(!Number.isNaN(yr) && yr > 0 && yr < 5000){
			this.changeIndiaTajakaYear(yr);
		}
	}

	// 右边栏技法用的「当前显示盘」分盘号:分盘集开启时取第一个选定分盘,否则取当前分盘(当前tab)。
	// 用户铁令:左边选了分盘集 → 右边栏只算第一个;否则随「当前分盘」走,不再恒 D1。
	effectiveFractal(){
		if(this.state.vargaSetOpen && Array.isArray(this.state.vargaSetFractals) && this.state.vargaSetFractals.length){
			return this.state.vargaSetFractals[0];
		}
		const f = parseInt(this.state.currentFractal, 10);
		return (!Number.isNaN(f) && f > 0) ? f : 1;
	}

	toggleIndiaAspect(planetId){
		// WP-A 相映:点同星取消、点他星切换、空=清。
		this.setState((s)=>({ indiaAspectSource: s.indiaAspectSource === planetId ? null : (planetId || null) }));
	}

	toggleVargaSet(){
		this.setState((s)=>({ vargaSetOpen: !s.vargaSetOpen }), ()=>{
			this.requestDashaChart(this.withIndiaOptionFields(this.props.fields));
		});
	}

	changeVargaSetFractals(values){
		// antd 多选返回数组;裁剪到最多 4 个,保留先选先得顺序;空选回退默认。
		let arr = Array.isArray(values) ? values.map((v)=>parseInt(v, 10)).filter((v)=>!Number.isNaN(v)) : [];
		if(arr.length > VARGA_GRID_MAX){
			arr = arr.slice(0, VARGA_GRID_MAX);
		}
		if(!arr.length){
			arr = VARGA_GRID_DEFAULT.slice();
		}
		this.setState({ vargaSetFractals: arr }, ()=>{
			this.requestDashaChart(this.withIndiaOptionFields(this.props.fields));
		});
	}

	changeDegreeDisplayMode(value){
		const degreeDisplayMode = value === INDIA_DEGREE_DISPLAY_FULL
			? INDIA_DEGREE_DISPLAY_FULL
			: INDIA_DEGREE_DISPLAY_DEGREE;
		this.setState({
			degreeDisplayMode,
		});
	}

	// WP-C 星体显示文字/符号切换:纯显示,零请求(只重渲染三盘的星体标签)。
	// XQSegmented=Radio.Group,onChange 传事件 → 取 e.target.value(与 changeIndiaChartStyle 一致)。
	changeIndiaPlanetDisplayMode(value){
		const next = value && value.target ? value.target.value : value;
		this.setState({ indiaPlanetDisplayMode: AstroConst.normalizeIndiaPlanetDisplay(next) });
	}

	// WP-N §1.6 纯视觉开关:逆时针(宫格排列方向)、锁定水瓶(南印固定格)。不进数学。
	changeIndiaCounterClockwise(checked){
		this.setState({ indiaCounterClockwise: !!checked });
	}

	changeIndiaLockAquarius(checked){
		this.setState({ indiaLockAquarius: !!checked });
	}

	// horosa_india_settings_memo_v1:原「显示方向」Select 的 onChange 是 render 内联箭头
	// (每帧新函数 → 设置面板 memo 恒失配)。提为绑定方法,取值逻辑逐字照搬。
	changeIndiaCounterClockwiseSelect(v){
		this.changeIndiaCounterClockwise((v && v.target ? v.target.value : v) === 'ccw');
	}

	// horosa_india_settings_memo_v1:datetm 原来每帧 new 一个 DateTime,拿它当 prop 的
	// SpaceTimePanel 于是每帧必重渲。按「日期|时刻|时区」三元组做实例级 memo:三者任一变即重建,
	// 全同则复用同一实例(该实例只作为受控显示值下传,不由本组件写)。
	resolveDateTime(fields){
		const key = (fields && fields.date && fields.time)
			? `${fields.date.value.format('YYYY-MM-DD')} ${fields.time.value.format('HH:mm:ss')}|${fields.zone ? fields.zone.value : ''}`
			: '';
		if(this._datetmMemo && this._datetmMemoKey === key){
			return this._datetmMemo;
		}
		let datetm = new DateTime();
		if(key){
			datetm = datetm.parse(`${fields.date.value.format('YYYY-MM-DD')} ${fields.time.value.format('HH:mm:ss')}`, 'YYYY-MM-DD HH:mm:ss');
			if(fields.zone){
				datetm.setZone(fields.zone.value);
			}
		}
		this._datetmMemoKey = key;
		this._datetmMemo = datetm;
		return datetm;
	}

	// horosa_india_settings_memo_v1:分盘清单只由 state.hook 的 key/fractal/txt 派生,
	// 而 hook 的这三项在构造后恒定(只有 fun 会被子盘实例回填,不进本清单)→ 算一次即可。
	// 原来每帧重建两个数组,顺带让「当前分盘」Select 的 options 每帧换引用。
	resolveSplitItems(){
		if(!this._splitItemsMemo){
			const splitItems = [];
			for(let key in this.state.hook){
				const hook = this.state.hook[key];
				if(hook.fractal === 1){
					continue;
				}
				splitItems.push({ key, ...hook });
			}
			this._splitItemsMemo = splitItems;
			this._splitOptionsMemo = [
				{ value: 'Natal', label: '命盘 D1' },
				...splitItems.map((item)=>({
					value: item.key,
					label: `${item.fractal}分盘${item.txt ? ` · ${item.txt}` : ''}`,
				})),
			];
		}
		return this._splitItemsMemo;
	}

	// WP-B 换第1宫参照:纯显示重数房号(三盘 + 星曜面板宫位),零请求、零后端、不动黄经。
	changeIndiaLagnaRef(value){
		const next = value && value.target ? value.target.value : value;
		this.setState({ indiaLagnaRef: AstroConst.normalizeIndiaLagnaRef(next) });
	}

	changeSthiraStart(v){
		if((this.state.indiaSthiraStart || 'lagna') === v){ return; }
		this.setState({ indiaSthiraStart: v });
		this.requestDashaChart(this.withIndiaOptionFields(this.props.fields, { indiaSthiraStart: v }));
	}
	renderSthiraStartToggle(d){
		const cur = this.state.indiaSthiraStart || 'lagna';
		const PN = { Sun: '日', Moon: '月', Mars: '火', Mercury: '水', Jupiter: '木', Venus: '金', Saturn: '土', 'North Node': '罗', 'South Node': '计', Rahu: '罗', Ketu: '计' };
		const SCN = { Aries: '白羊', Taurus: '金牛', Gemini: '双子', Cancer: '巨蟹', Leo: '狮子', Virgo: '处女', Libra: '天秤', Scorpio: '天蝎', Sagittarius: '射手', Capricorn: '摩羯', Aquarius: '水瓶', Pisces: '双鱼' };
		return (
			<span className="horosa-india-sthira-start" style={{ marginLeft: 8, fontSize: '0.78em', fontWeight: 400 }}>
				起座：
				{[['lagna', '命宫'], ['brahma', 'Brahma']].map(([v, lbl])=>(
					<a key={v} onClick={()=>this.changeSthiraStart(v)} style={{ marginLeft: 5, cursor: 'pointer', color: cur === v ? 'var(--horosa-accent-strong)' : 'var(--horosa-text-muted, #8a8a8a)', fontWeight: cur === v ? 600 : 400 }}>{lbl}</a>
				))}
				{d && d.startMode === 'brahma' && d.brahma ? <em style={{ marginLeft: 6, opacity: 0.75 }}>（Brahma {PN[d.brahma.planet] || d.brahma.planet}·{SCN[d.brahma.sign] || d.brahma.sign}）</em> : null}
			</span>
		);
	}
	// horosa_india_fields_memo_v1(PERF-R9 Ship 6):无 override 的调用(render 每帧一次 +
	// 每次 componentDidUpdate 一次)此前**恒新建**一个 fields 对象 → 任何下游 memo/sCU 拿它做
	// 引用比都必然失配,等于白比。这里对「无 override」路径做实例级 memo:
	//   缓存键 = 源 fields 引用 + 本方法读取的全部 state 值(逐项列全 —— 漏一项就会返回陈旧对象,
	//   那是「该更新时不更新」的正确性事故,比慢严重得多;新增读取的 state 必须同步加进 KEY)。
	// 带 override 的调用(切流派/宫制/岁差/交点/年份/起座/过运日 的即时重取)一律绕过缓存:既不读也不写,
	// 语义与改前逐字一致。
	withIndiaOptionFields(fields, optionOverrides = {}){
		if(!fields){
			return fields;
		}
		// 🔴 复核修:memo 只有**一个**槽位,而 buildIndiaPrefetchParams(步进预取/预热)会拿
		// steppedFields(另一个对象)来调本方法 —— 那会把 render 路径的槽位挤掉,下一帧 render 必然
		// 未命中 → 重新造对象 → IndiaSettingsPanel 的 fields prop 每帧换引用,memo 白包。
		// 故槽位只服务「当前 props.fields」这条渲染主路径;预取/其它源一律绕过(返回新对象,内容不变)。
		const memoable = fields === this.props.fields
			&& (!optionOverrides || Object.keys(optionOverrides).length === 0);
		let memoKey = '';
		if(memoable){
			memoKey = [
				this.state.indiaHsysValue,
				this.state.indiaAyanamsaValue,
				this.state.indiaNodeTypeValue,
				this.state.indiaTajakaYearValue,
				this.state.dashaSeed,
				this.state.dashaSystem,
				this.state.indiaSthiraStart,
				this.state.indiaTransitDateValue,
				this.effectiveFractal(),
			].map((v)=>(v === null || v === undefined ? '~' : `${v}`)).join('|');
			if(this._optionFieldsMemo && this._optionFieldsMemoSrc === fields && this._optionFieldsMemoKey === memoKey){
				return this._optionFieldsMemo;
			}
		}
		const indiaHsys = optionOverrides.indiaHsys !== undefined && optionOverrides.indiaHsys !== null
			? AstroConst.normalizeIndiaHouseSystem(optionOverrides.indiaHsys)
			: (this.state.indiaHsysValue !== null && this.state.indiaHsysValue !== undefined
			? this.state.indiaHsysValue
			: (fields.indiaHsys ? AstroConst.normalizeIndiaHouseSystem(fields.indiaHsys.value) : AstroConst.INDIA_HOUSE_SYSTEM_DEFAULT));
		const indiaAyanamsa = optionOverrides.indiaAyanamsa !== undefined && optionOverrides.indiaAyanamsa !== null
			? AstroConst.normalizeIndiaAyanamsa(optionOverrides.indiaAyanamsa)
			: (this.state.indiaAyanamsaValue !== null && this.state.indiaAyanamsaValue !== undefined
			? this.state.indiaAyanamsaValue
			: (fields.indiaAyanamsa ? AstroConst.normalizeIndiaAyanamsa(fields.indiaAyanamsa.value) : AstroConst.INDIA_AYANAMSA_DEFAULT));
		const indiaNodeType = optionOverrides.indiaNodeType !== undefined && optionOverrides.indiaNodeType !== null
			? AstroConst.normalizeIndiaNodeType(optionOverrides.indiaNodeType)
			: (this.state.indiaNodeTypeValue !== null && this.state.indiaNodeTypeValue !== undefined
			? this.state.indiaNodeTypeValue
			: (fields.indiaNodeType ? AstroConst.normalizeIndiaNodeType(fields.indiaNodeType.value) : AstroConst.INDIA_NODE_TYPE_DEFAULT));
		const indiaTajakaYear = optionOverrides.indiaTajakaYear !== undefined
			? optionOverrides.indiaTajakaYear
			: (this.state.indiaTajakaYearValue !== null && this.state.indiaTajakaYearValue !== undefined
			? this.state.indiaTajakaYearValue
			: (fields.indiaTajakaYear ? fields.indiaTajakaYear.value : null));
		const indiaDashaSeed = optionOverrides.indiaDashaSeed !== undefined && optionOverrides.indiaDashaSeed !== null
			? optionOverrides.indiaDashaSeed
			: (this.state.dashaSeed || DASHA_SEED_DEFAULT);
		// perf：大运体系随每次 fetch 携带(同 seed 口径)→ 后端只算选中体系全三级、其余 maha-only，
		// 响应 dasha 895KB→~150KB。永远带当前 state.dashaSystem，故改时间/换选项都不会把选中体系塌成 maha-only。
		const indiaDashaSystem = optionOverrides.indiaDashaSystem !== undefined && optionOverrides.indiaDashaSystem !== null
			? optionOverrides.indiaDashaSystem
			: (this.state.dashaSystem || 'vimshottari');
		const indiaSthiraStart = optionOverrides.indiaSthiraStart !== undefined && optionOverrides.indiaSthiraStart !== null
			? optionOverrides.indiaSthiraStart
			: (this.state.indiaSthiraStart || 'lagna');
		const indiaTransitDate = optionOverrides.indiaTransitDate !== undefined
			? optionOverrides.indiaTransitDate
			: (this.state.indiaTransitDateValue !== null && this.state.indiaTransitDateValue !== undefined
			? this.state.indiaTransitDateValue
			: (fields.indiaTransitDate ? fields.indiaTransitDate.value : null));
		const optionFields = {
			...fields,
			indiaHsys: {
				...(fields.indiaHsys || { name: ['indiaHsys'] }),
				value: indiaHsys,
			},
			indiaAyanamsa: {
				...(fields.indiaAyanamsa || { name: ['indiaAyanamsa'] }),
				value: indiaAyanamsa,
			},
			indiaNodeType: {
				...(fields.indiaNodeType || { name: ['indiaNodeType'] }),
				value: indiaNodeType,
			},
			indiaTajakaYear: {
				...(fields.indiaTajakaYear || { name: ['indiaTajakaYear'] }),
				value: indiaTajakaYear,
			},
			indiaDashaSeed: {
				...(fields.indiaDashaSeed || { name: ['indiaDashaSeed'] }),
				value: indiaDashaSeed,
			},
			indiaDashaSystem: {
				...(fields.indiaDashaSystem || { name: ['indiaDashaSystem'] }),
				value: indiaDashaSystem,
			},
			indiaSthiraStart: {
				...(fields.indiaSthiraStart || { name: ['indiaSthiraStart'] }),
				value: indiaSthiraStart,
			},
			indiaTransitDate: {
				...(fields.indiaTransitDate || { name: ['indiaTransitDate'] }),
				value: indiaTransitDate,
			},
			indiaActiveFractal: {
				...(fields.indiaActiveFractal || { name: ['indiaActiveFractal'] }),
				value: this.effectiveFractal(),
			},
		};
		if(memoable){
			this._optionFieldsMemoSrc = fields;
			this._optionFieldsMemoKey = memoKey;
			this._optionFieldsMemo = optionFields;
		}
		return optionFields;
	}

	changeIndiaChartStyle(value){
		const indiaChartStyle = AstroConst.normalizeIndiaChartStyle(value && value.target ? value.target.value : value);
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'app/save',
				payload: {
					indiaChartStyle,
				},
			});
		}
	}

	async requestDashaChart(fields){
		const sourceFields = fields || this.props.fields;
		if(!canBuildIndiaChartParams(sourceFields)){
			return;
		}
		const jyotishFields = cloneIndiaFieldsForJyotish(sourceFields);
		const dashaFieldsKey = buildDashaFieldsKey(jyotishFields);
		const alreadyHasData = hasUsableJyotishChart(this.state, dashaFieldsKey);
		if(!dashaFieldsKey || (dashaFieldsKey === this.lastDashaRequestKey && (this.state.dashaLoading || alreadyHasData))){
			if(dashaFieldsKey && dashaFieldsKey !== this.state.activeJyotishKey){
				this.setState({
					activeJyotishFields: jyotishFields,
					activeJyotishKey: dashaFieldsKey,
				}, ()=>{
					// horosa_panel_ready_v1:命中「已有可用盘」的短路分支 —— 本次交互不再发请求,
					// 这一次 setState(切换 activeJyotishFields → 中盘 + 右栏 Jyotish 面板同批重画)
					// 就是面板落定的最后一次。不接在这里,缓存命中的那些交互(切分盘/回切旧参数)
					// 会永远量不到 panel-ready(markPanelReady 自身按 generation 去重,多点接入安全)。
					// 🔴 复核修:本分支还有第二条进入路径 —— 同键请求**在途**(dashaLoading)。那时盘面
					// 还是旧的、新数据没到,标 ready 是伪造的早点(且会吃掉 stepT0,让真正落定的那次
					// 变成 no-op → 系统性低估印占耗时)。故只在「确有可用盘」时才标;在途那次不标,
					// 等 1836 的真落定点标,样本不丢。
					if(alreadyHasData){
						markPanelReady('indiachart');
					}
				});
			}
			return;
		}
		this.lastDashaRequestKey = dashaFieldsKey;
		let params = null;
		try{
			params = fieldsToParams(jyotishFields);
			// 右边栏技法按「当前显示盘」算:分盘集取第一个分盘,否则取当前分盘;不再恒 D1。
			params.chartnum = (jyotishFields.indiaActiveFractal && jyotishFields.indiaActiveFractal.value) || 1;
		}catch(e){
			this.lastDashaRequestKey = '';
			return;
		}
		// stale-while-revalidate:不清旧盘(dashaChartObj/mainChartObj 保留)、不设满屏 dashaLoading——
		// 切换/重取期间面板由 resolveJyotishChartObj 回退到 lastChartObj 显上次成功盘 + 角标「更新中…」。
		// 仅首次加载(无 lastChartObj)才 dashaLoading:true,保留首屏「计算中」提示。
		this.setState({
			dashaLoading: this.state.lastChartObj ? false : true,
			dashaUpdating: true,
			dashaFieldsKey,
			mainChartObj: this.state.mainChartKey === dashaFieldsKey ? this.state.mainChartObj : null,
			mainChartKey: this.state.mainChartKey === dashaFieldsKey ? this.state.mainChartKey : '',
			activeJyotishFields: jyotishFields,
			activeJyotishKey: dashaFieldsKey,
		});
		try{
			const dashaChartObj = await requestIndiaChartData(params);
			if(!this._mounted) return;
			if(this.state.dashaFieldsKey === dashaFieldsKey){
				this.setState({
					dashaChartObj,
					dashaChartKey: dashaFieldsKey,
					mainChartObj: dashaChartObj || null,
					mainChartKey: dashaFieldsKey,
					// 成功盘存为 lastChartObj(下次切换的回退源);仅有效盘才更新,空结果不覆盖旧盘。
					lastChartObj: hasJyotishPayload(dashaChartObj) ? dashaChartObj : this.state.lastChartObj,
					dashaLoading: false,
					dashaUpdating: false,
				}, ()=>{
					// horosa_panel_ready_v1:印占面板落定的**唯一**权威点 —— 中盘(mainChartObj)与
					// 右栏全部 Jyotish 技法(大运/五支/星曜/八分/Yoga…)吃的都是这同一个 dashaChartObj,
					// 一次 setState 同批落地。请求发出(1475 的 dashaUpdating:true)不是落定,失败分支
					// (下面 catch)也不是 —— 那次只收 loading 角标、盘面仍是上一次的旧盘,不代表新数据画完。
					markPanelReady('indiachart');
				});
			}
		}catch(e){
			if(!this._mounted) return;
			if(this.state.dashaFieldsKey === dashaFieldsKey){
				// 失败不清旧盘:保留 lastChartObj 兜底,面板仍显上次成功盘;仅收起 updating/loading。
				this.setState({
					dashaLoading: false,
					dashaUpdating: false,
				});
			}
		}
	}

	componentDidMount(){
		this._mounted = true;
		let hook = this.state.hook;
		if(hook[this.state.currentTab].fun){
			hook[this.state.currentTab].fun()
		}
		const fields = this.withIndiaOptionFields(this.props.fields);
		this.lastObservedFieldsKey = buildDashaFieldsKey(fields);
		this.requestDashaChart(fields);
	}

	componentWillUnmount(){
		this._mounted = false;
	}

	componentDidUpdate(prevProps, prevState){
		const fields = this.withIndiaOptionFields(this.props.fields);
		const currentFieldsKey = buildDashaFieldsKey(fields);
		if(currentFieldsKey && currentFieldsKey !== this.lastObservedFieldsKey){
			this.lastObservedFieldsKey = currentFieldsKey;
			this.requestDashaChart(fields);
			return;
		}
		if(currentFieldsKey && currentFieldsKey !== this.lastDashaRequestKey && !hasUsableJyotishChart(this.state, currentFieldsKey) && !this.state.dashaLoading){
			this.requestDashaChart(fields);
		}
	}

	showDashaSubPopover(item, e){
		if(typeof window === 'undefined' || !e || !e.currentTarget || !e.currentTarget.getBoundingClientRect){
			return;
		}
		const rect = e.currentTarget.getBoundingClientRect();
		const margin = 12;
		const panelWidth = Math.min(380, Math.max(300, window.innerWidth - margin * 2));
		let left = rect.left - panelWidth - margin;
		if(left < margin){
			left = rect.right + margin;
		}
		if(left + panelWidth > window.innerWidth - margin){
			left = Math.max(margin, window.innerWidth - panelWidth - margin);
		}
		const top = Math.max(88, Math.min(window.innerHeight - 88, rect.top + rect.height / 2));
		this.setState({
			dashaPopoverItem: item,
			dashaPopoverStyle: {
				left,
				top,
				width: panelWidth,
			},
		});
	}

	hideDashaSubPopover(){
		this.setState({
			dashaPopoverItem: null,
			dashaPopoverStyle: null,
		});
	}

	changeJyotishTab(key){
		this.setState({
			jyotishTab: key,
		});
	}

	handleMainChartLoad(chartObj, params){
		const mainChartKey = buildJyotishParamsKey(params);
		const activeKey = this.state.activeJyotishKey || buildDashaFieldsKey(this.withIndiaOptionFields(this.props.fields));
		if(activeKey && mainChartKey && mainChartKey !== activeKey){
			return;
		}
		this.setState({
			mainChartObj: chartObj || null,
			mainChartKey,
			dashaLoading: mainChartKey && mainChartKey === activeKey && hasYogaPayload(chartObj) ? false : this.state.dashaLoading,
		});
	}

	renderVargaGrid(fields, opts){
		const fractals = (this.state.vargaSetFractals && this.state.vargaSetFractals.length)
			? this.state.vargaSetFractals.slice(0, VARGA_GRID_MAX)
			: VARGA_GRID_DEFAULT.slice();
		const hookList = Object.keys(this.state.hook).map((k)=>this.state.hook[k]);
		const cols = fractals.length <= 1 ? 1 : 2;
		const rows = Math.max(1, Math.ceil(fractals.length / cols));
		// 多列(2+盘)时每格仅约半宽 → 缩小盘内字体并紧凑布局,保证完整不裁切;单盘全宽用原尺寸。
		const gridCls = `horosa-india-varga-grid${cols > 1 ? ' horosa-india-varga-grid-multi' : ''}`;
		return (
			<div
				className={gridCls}
				style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
			>
				{fractals.map((f, idx)=>{
					const hookEntry = hookList.find((h)=>h.fractal === f) || { fractal: f };
					const label = VARGA_GRID_LABEL[f] || `D${f}`;
					const sub = label.indexOf('·') >= 0 ? label.split('·')[1].trim() : (hookEntry.txt || '');
					return (
						<div className="horosa-india-varga-cell" key={`varga_${f}_${idx}`}>
							<div className="horosa-india-varga-cell-title">
								<strong>D{f}</strong>
								<span>{sub}</span>
							</div>
							<div className="horosa-india-varga-cell-chart">
								<IndiaChart
									key={`vgrid_${f}_${opts.indiaChartStyle}_${opts.indiaAyanamsa}_${opts.indiaHsys}_${opts.indiaNodeType}`}
									chartOnly
									aspectSourceId={this.state.indiaAspectSource}
									aspectParadigm={this.state.indiaAspectParadigm}
									onPlanetClick={this.toggleIndiaAspect}
									chartnum={f}
									fields={fields}
									height="100%"
									chartDisplay={this.props.chartDisplay}
									indiaChartStyle={opts.indiaChartStyle}
									indiaAyanamsa={opts.indiaAyanamsa}
									indiaHsys={opts.indiaHsys}
									indiaNodeType={opts.indiaNodeType}
									degreeDisplayMode={opts.degreeDisplayMode}
									planetGlyphMode={opts.indiaPlanetDisplayMode}
									counterClockwise={opts.indiaCounterClockwise}
									lockAquarius={opts.indiaLockAquarius}
									lagnaRef={opts.indiaLagnaRef}
									planetDisplay={this.props.planetDisplay}
									lotsDisplay={this.props.lotsDisplay}
									showPlanetHouseInfo={false}
									showAstroMeaning={false}
									hook={hookEntry}
									dispatch={this.props.dispatch}
								/>
							</div>
						</div>
					);
				})}
			</div>
		);
	}

	renderTajakaPanel(fields){
		const SIGN_CN = { Aries: '白羊', Taurus: '金牛', Gemini: '双子', Cancer: '巨蟹', Leo: '狮子', Virgo: '处女', Libra: '天秤', Scorpio: '天蝎', Sagittarius: '射手', Capricorn: '摩羯', Aquarius: '水瓶', Pisces: '双鱼' };
		const PLANET_CN = { Sun: '太阳', Moon: '月亮', Mars: '火星', Mercury: '水星', Jupiter: '木星', Venus: '金星', Saturn: '土星', Rahu: '罗睺', Ketu: '计都' };
		const sc = (s)=>SIGN_CN[s] || s || '—';
		const pc = (p)=>PLANET_CN[p] || p || '—';
		const jyotish = getJyotish(resolveJyotishChartObj(this.state, fields));
		const tj = jyotish ? jyotish.tajaka : null;
		const curY = (()=>{ try { return new Date().getFullYear(); } catch(e){ return (this.state.indiaTajakaYearValue || 2026); } })();
		// 当前已算年(loading 时退回用户选定年/当年)。输入卡始终渲染——若随 loading 消失,换年时输入框瞬间不在 → 连点/再输丢失。
		const activeYear = tj ? tj.tajakaYear : (this.state.indiaTajakaYearValue || curY);
		const yearInputVal = (this.state.tajakaYearInput === '' || this.state.tajakaYearInput == null) ? String(activeYear) : this.state.tajakaYearInput;
		const yearCard = (
			<div className="horosa-info-card">
				<div className="horosa-info-card-title">年度盘年份（太阳回归 · 输入年份后点「计算」）</div>
				<div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
					<input
						type="number"
						ref={(el)=>{ this._tajakaYearInputEl = el; }}
						value={yearInputVal}
						min={1}
						max={4999}
						placeholder={String(curY)}
						onChange={(e)=>this.setState({ tajakaYearInput: e.target.value })}
						onKeyDown={(e)=>{ if(e.key === 'Enter'){ this.applyTajakaYear(); } }}
						style={{ width: '112px', padding: '5px 10px', background: 'var(--horosa-surface)', border: '1px solid var(--horosa-border)', borderRadius: '8px', color: 'var(--horosa-text)', fontSize: '13px', outline: 'none' }}
					/>
					<button type="button" className="horosa-india-dasha-syssel-tab is-active" onClick={()=>this.applyTajakaYear()}>计算</button>
					<button type="button" className="horosa-india-dasha-syssel-tab" onClick={()=>{ this.setState({ tajakaYearInput: '' }); this.changeIndiaTajakaYear(curY); }}>当年</button>
				</div>
			</div>
		);
		if(!tj || !tj.available){
			return (
				<div className="horosa-india-jyotish-panel">
					{yearCard}
					<div className="horosa-india-dasha-empty">年度盘计算中…</div>
				</div>
			);
		}
		const muntha = tj.muntha || {};
		const yearLord = tj.yearLord || {};
		const sahams = tj.sahams && typeof tj.sahams === 'object' ? Object.keys(tj.sahams).map((k)=>({ key: k, ...tj.sahams[k] })) : [];
		const yg = tj.yogas || {};
		const yogaPos = yg.position || {};
		const yogaPairs = Array.isArray(yg.pairwise) ? yg.pairwise.filter((p)=>p.aspect && (p.withinOrb || p.applying)) : [];
		const yogaHigher = yg.higher || {};                       // P1 高阶:Nakta/Yamaya/Kamboola
		const yogaCatalog = Array.isArray(yg.catalog) ? yg.catalog : [];
		const ITH_TYPE_CN = { poorna: '满趋(Poorna)', vartamana: '当前趋(Vartamana)', bhavishya: '将来趋(Bhavishya)', eesarpha: '背离(Eesarpha)' };
		return (
			<div className="horosa-india-jyotish-panel">
				{yearCard}
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">年度盘 Varshaphal · {tj.tajakaYear}</div>
					<div className="horosa-info-row"><span>年度上升</span><strong>{sc(tj.annualLagnaSign)}</strong></div>
					<div className="horosa-info-row"><span>满岁</span><strong>{tj.ageCompleted}</strong></div>
					<div className="horosa-info-row"><span>昼/夜生</span><strong>{tj.dayBirth ? '昼生' : '夜生'}</strong></div>
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">Muntha</div>
					<div className="horosa-info-row"><span>所在</span><strong>{sc(muntha.sign)}（主 {pc(muntha.lord)}）</strong></div>
					<div className="horosa-info-row"><span>距本命命宫</span><strong>第 {muntha.houseFromNatalLagna || '—'} 宫</strong></div>
					<div className="horosa-info-row"><span>年盘宫位</span><strong>第 {muntha.houseInAnnual || '—'} 宫</strong></div>
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">年主 Year Lord</div>
					<div className="horosa-info-row"><span>年主</span><strong>{pc(yearLord.planet)}</strong></div>
					<div className="horosa-info-row"><span>取用</span><strong>{yearLord.via || '—'}</strong></div>
					<div className="horosa-info-row"><span>Pancha-Vargeeya</span><strong>{yearLord.panchaBala != null ? Number(yearLord.panchaBala).toFixed(2) : '—'}</strong></div>
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">年度合相 Tajaka Yogas</div>
					<div className="horosa-india-data-list">
						<div className="horosa-india-data-row"><strong>Ishkavala</strong><span>财福格</span><em>{yogaPos.ishkavala ? '成立' : '未成立'}</em></div>
						<div className="horosa-india-data-row"><strong>Induvara</strong><span>失意格</span><em>{yogaPos.induvara ? '成立' : '未成立'}</em></div>
						{yogaPairs.map((p, i)=>(
							<div className="horosa-india-data-row" key={`pw${i}`}>
								<strong>{pc(p.a)}–{pc(p.b)}</strong>
								<span>{p.aspect}{p.withinOrb ? ' · 入相位' : ''}</span>
								<em className={p.applying ? 'is-good' : 'is-warn'}>{p.nature || ''}{p.type ? ' · ' + (ITH_TYPE_CN[p.type] || p.type) : (p.applying ? ' · Ithasala' : ' · Eesarpha')}</em>
							</div>
						))}
						{!yogaPairs.length ? (<div className="horosa-india-data-row"><strong>逐对相位</strong><span>本年无入相/出相年度合相</span><em>—</em></div>) : null}
						{(yogaHigher.nakta || []).map((y, i)=>(<div className="horosa-india-data-row" key={`nk${i}`}><strong>Nakta 传光</strong><span>{pc(y.a)}–{pc(y.b)}</span><em className="is-good">经 {pc(y.via)} 速曜居间助成</em></div>))}
						{(yogaHigher.yamaya || []).map((y, i)=>(<div className="horosa-india-data-row" key={`ym${i}`}><strong>Yamaya 集光</strong><span>{pc(y.a)}–{pc(y.b)}</span><em className="is-good">经 {pc(y.via)} 慢曜居间助成</em></div>))}
						{(yogaHigher.kamboola || []).map((y, i)=>(<div className="horosa-india-data-row" key={`kb${i}`}><strong>Kamboola 月助</strong><span>{Array.isArray(y.pair) ? y.pair.map(pc).join('–') : ''}</span><em className="is-good">月与 {pc(y.moonWith)} 成 Ithasala 增力</em></div>))}
					</div>
				</div>
				{yogaCatalog.length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Tajika 16 瑜伽名录（参考 · 判定细则见各格）</div>
						<div className="horosa-india-data-list">
							{yogaCatalog.map((y)=>(
								<div className="horosa-india-data-row" key={`cat${y.key}`}>
									<strong>{y.key}</strong>
									<span>{y.label}</span>
									<em>{y.note}</em>
								</div>
							))}
						</div>
					</div>
				) : null}
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">Sahams 敏感点（36）</div>
					<div className="horosa-india-data-list">
						{sahams.map((s)=>(
							<div className="horosa-india-data-row" key={s.key}>
								<strong>{s.label || s.key}</strong>
								<span>{sc(s.sign)}</span>
								<em>{s.signLon != null ? formatDegree(s.signLon) : ''}</em>
							</div>
						))}
					</div>
				</div>
				{tj && tj.harshaBala && Object.keys(tj.harshaBala).length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Harsha Bala（年盘喜悦力 · 满 20）</div>
						<div className="horosa-india-data-list">
							{Object.keys(tj.harshaBala).map((p)=>(
								<div className="horosa-india-data-row" key={`hb_${p}`}>
									<strong>{pc(p)}</strong>
									<span>{Number(tj.harshaBala[p].total).toFixed(1)} 分</span>
									<em>{(tj.harshaBala[p].sources || []).map((s)=>Number(s).toFixed(0)).join(' / ')}</em>
								</div>
							))}
						</div>
					</div>
				) : null}
				{tj && tj.panchaVargeeyaBala && Object.keys(tj.panchaVargeeyaBala).length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Pancha-Vargeeya Bala（五分量力）</div>
						<div className="horosa-india-data-list">
							{Object.keys(tj.panchaVargeeyaBala).map((p)=>{
								const b = tj.panchaVargeeyaBala[p] || {};
								const n = (x)=>(x != null ? Number(x).toFixed(1) : '—');
								return (
									<div className="horosa-india-data-row" key={`pv_${p}`}>
										<strong>{pc(p)}</strong>
										<span>{b.total != null ? Number(b.total).toFixed(2) : '—'}</span>
										<em>界{n(b.hadda)} 旺{n(b.uchcha)} 宫{n(b.kshetra)} 旬{n(b.drekkana)} 九{n(b.navamsa)}</em>
									</div>
								);
							})}
						</div>
					</div>
				) : null}
				{tj && tj.dasas && tj.dasas.mudda && tj.dasas.mudda.available && Array.isArray(tj.dasas.mudda.sequence) ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Mudda 年内大运（首主 {pc(tj.dasas.mudda.firstLord)}）</div>
						<div className="horosa-india-data-list">
							{tj.dasas.mudda.sequence.map((m, i)=>(
								<div className="horosa-india-data-row" key={`md_${i}`}>
									<strong>{pc(m.key)}</strong>
									<span>{Number(m.days).toFixed(1)} 天</span>
									<em>{m.balance != null ? `余 ${Number(m.balance).toFixed(1)}` : ''}</em>
								</div>
							))}
						</div>
					</div>
				) : null}
				{tj && tj.dasas && tj.dasas.patyayini && Array.isArray(tj.dasas.patyayini.order) ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Patyāyinī 年内大运（共 {tj.dasas.patyayini.totalDays != null ? Number(tj.dasas.patyayini.totalDays).toFixed(0) : '—'} 天）</div>
						<div className="horosa-india-data-list">
							{tj.dasas.patyayini.order.map((m, i)=>(
								<div className="horosa-india-data-row" key={`pt_${i}`}>
									<strong>{m.ref === 'lagna' ? '年命' : pc(m.ref)}</strong>
									<span>{Number(m.days).toFixed(1)} 天</span>
									<em>Paty {m.patyamsa != null ? Number(m.patyamsa).toFixed(1) : '—'}</em>
								</div>
							))}
						</div>
					</div>
				) : null}
			</div>
		);
	}

	renderMaitriPanel(fields){
		const jyotish = getJyotish(resolveJyotishChartObj(this.state, fields));
		const gm = jyotish ? jyotish.grahaMaitri : null;
		if(!gm){ return <div className="horosa-india-dasha-empty">敌友计算中...</div>; }
		if(gm.available === false){ return <div className="horosa-india-dasha-empty">暂无敌友数据</div>; }
		const COMP_CLASS = { '大友': 'is-adhimitra', '友': 'is-mitra', '中立': 'is-sama', '敌': 'is-satru', '大敌': 'is-adhisatru' };
		const labels = gm.planetLabels || [];
		const matrix = gm.matrix || [];
		const rasi = gm.rasiDrishti || [];
		return (
			<div className="horosa-india-jyotish-panel">
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">敌友 复合五分（Pañcadhā Maitrī · 行=本星 / 列=对方 · 非对称）</div>
					<div className="horosa-india-maitri-wrap">
						<table className="horosa-india-maitri-table">
							<thead>
								<tr><th aria-label="本星\\对方"></th>{labels.map((l, i)=>(<th key={i}>{l}</th>))}</tr>
							</thead>
							<tbody>
								{matrix.map((row, ri)=>(
									<tr key={ri}>
										<th>{row.planetLabel}</th>
										{row.cells.map((c, ci)=>(
											c.self
												? <td key={ci} className="horosa-india-maitri-cell is-self">—</td>
												: <td key={ci} className={`horosa-india-maitri-cell ${COMP_CLASS[c.compoundCn] || ''}`} title={`自然 ${c.naturalCn} · 临时 ${c.temporalCn} · 复合 ${c.compoundCn}`}>{c.compoundCn}</td>
										))}
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<div className="horosa-india-maitri-legend">
						{(gm.legend || []).map((lg)=>(<span key={lg.key} className={`horosa-india-maitri-chip ${COMP_CLASS[lg.label] || ''}`}>{lg.label}</span>))}
					</div>
					<div className="horosa-india-maitri-note">悬停格子见 自然·临时·复合 三层；本星看对方 ≠ 对方看本星（古籍第6章 Pañcadhā）。</div>
				</div>
				{rasi.length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Jaimini 座相 Rāśi Dṛṣṭi（座 → 所照见座）</div>
						<div className="horosa-india-data-list">
							{rasi.map((r)=>(
								<div className="horosa-india-data-row" key={r.sign}>
									<strong>{r.signLabel || r.sign}</strong>
									<span>{(r.aspects || []).length} 座</span>
									<em>{(r.aspectLabels || r.aspects || []).join('、') || '—'}</em>
								</div>
							))}
						</div>
					</div>
				) : null}
			</div>
		);
	}

	renderRemediesPanel(fields){
		const jyotish = getJyotish(resolveJyotishChartObj(this.state, fields));
		const rem = jyotish ? jyotish.remedies : null;
		if(!rem || !Array.isArray(rem.table)){
			return <div className="horosa-india-dasha-empty">暂无化解数据</div>;
		}
		const recs = Array.isArray(rem.recommendations) ? rem.recommendations : [];
		return (
			<div className="horosa-india-jyotish-panel">
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">宝石建议（按需增力弱曜）<span className="horosa-india-source-tag">仅信息·非处方</span></div>
					{recs.length ? (
						<div className="horosa-india-data-list">
							{recs.map((r, i)=>(
								<div className="horosa-india-data-row" key={r.planet || i}>
									<strong>{r.planetCn || r.planet}</strong>
									<span>{r.gem}{r.metal ? ` · ${r.metal}` : ''}{r.finger ? ` · ${r.finger}` : ''}</span>
									<em>{r.caution ? '⚠ 功能凶星·慎用' : (r.recommend ? '可增力' : '—')}</em>
								</div>
							))}
						</div>
					) : (<div className="horosa-india-dasha-empty">本盘无明显需增力弱曜（落陷/燃烧）</div>)}
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">九曜化解全表（宝石/金属/指/真言/守护神/善行/谷物）<span className="horosa-india-source-tag">仅信息·非处方</span></div>
					<div className="horosa-india-data-list">
						{rem.table.map((g)=>(
							<div className="horosa-india-data-row horosa-india-remedy-row" key={g.planet}>
								<strong>{g.planetCn || g.planet}</strong>
								<span>{g.gem}（{g.gemEn}）{g.finger ? ` · ${g.finger}` : ''}</span>
								<em>
									{g.metal || ''}{g.day ? ` · ${g.day}` : ''}{g.mantraCount ? ` · 诵${g.mantraCount}` : ''}
									{Array.isArray(g.deity) && g.deity.length ? ` · 守护 ${g.deity.join('/')}` : ''}
									{g.grain ? ` · 谷 ${g.grain}` : ''}
									{g.goodDeed ? ` · 善行：${g.goodDeed}` : ''}
								</em>
							</div>
						))}
					</div>
				</div>
			</div>
		);
	}

	renderGocharaPanel(fields){
		const jyotish = getJyotish(resolveJyotishChartObj(this.state, fields));
		const g = jyotish ? jyotish.gochara : null;
		if(!g || !g.available){
			return <div className="horosa-india-dasha-empty">暂无行运数据</div>;
		}
		const sa = g.saturnAfflictions || {};
		const ss = sa.sadeSati || {};
		const fromMoon = Array.isArray(g.fromMoon) ? g.fromMoon : [];
		const transitMoment = this.state.indiaTransitDateValue
			? moment(this.state.indiaTransitDateValue, 'YYYY/MM/DD')
			: (g.transitDate ? moment(g.transitDate, 'YYYY/MM/DD') : moment());
		return (
			<div className="horosa-india-jyotish-panel">
				<div className="horosa-info-card horosa-india-transit-card">
					<div className="horosa-india-transit-row">
						<span className="horosa-india-transit-label">过运日期</span>
						<DatePicker
							value={transitMoment}
							onChange={(d)=>this.changeTransitDate(d)}
							format="YYYY-MM-DD"
							allowClear={false}
							inputReadOnly
							size="small"
							className="horosa-india-transit-datepicker"
						/>
						{this.state.indiaTransitDateValue
							? <button type="button" className="horosa-india-transit-reset" onClick={()=>this.changeTransitDate(null)}>回今日</button>
							: <em className="horosa-india-transit-hint">默认今日</em>}
					</div>
					<div className="horosa-india-card-note">选日期即按该日重排过运盘（Sade Sati / 逐曜过运随之更新）。</div>
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">Sade Sati / Kantaka / Ashtama</div>
					<div className="horosa-info-row"><span>土星过运</span><strong>{sa.saturnSignLabel || '—'}（从月第 {sa.saturnHouseFromMoon || '—'} 宫）</strong></div>
					<div className="horosa-info-row"><span>Sade Sati</span><strong>{ss.active ? `进行中 · ${ss.phaseLabel || ss.phase || ''}` : '无'}</strong></div>
					<div className="horosa-info-row"><span>Kantaka(Ardhashtama)</span><strong>{(sa.kantaka || {}).active ? '是' : '否'}</strong></div>
					<div className="horosa-info-row"><span>Ashtama Sani</span><strong>{(sa.ashtamaSani || {}).active ? '是' : '否'}</strong></div>
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">逐曜过运（从月）{g.transitDate ? ` · ${g.transitDate}` : ''}</div>
					<div className="horosa-india-data-list">
						{fromMoon.map((it, i)=>(
							<div className="horosa-india-data-row" key={`${it.planet || i}`}>
								<strong>{it.planetLabel || it.label || it.planet}</strong>
								<span>从月第 {it.house} 宫{it.signLabel ? ` · ${it.signLabel}` : ''}</span>
								<em>{(it.good || it.auspicious) ? '吉位' : '凶位'}{it.effective === false ? ' · 被遮 Vedha' : ''}
									{/* WP-E4 行运×八分点(§12.4):过运座 SAV≥30 顺/≤25 受阻,BAV 该曜自身贡献 */}
									{it.av && it.av.savBindu !== undefined ? <span className={`horosa-india-flag-badge ${it.av.sav === 'good' ? 'is-good' : (it.av.sav === 'bad' ? 'is-warn' : '')}`}>SAV {it.av.savBindu}</span> : null}
									{it.av && it.av.bavBindu !== undefined ? <span className="horosa-india-flag-badge">BAV {it.av.bavBindu}</span> : null}
								</em>
							</div>
						))}
					</div>
				</div>
				{Array.isArray(g.fromLagna) && g.fromLagna.length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">逐曜过运（从命）</div>
						<div className="horosa-india-data-list">
							{g.fromLagna.map((it, i)=>(
								<div className="horosa-india-data-row" key={`fl_${it.planet || i}`}>
									<strong>{it.planetLabel || it.label || it.planet}</strong>
									<span>从命第 {it.house} 宫{it.signLabel ? ` · ${it.signLabel}` : ''}</span>
									<em>{(it.good || it.auspicious) ? '吉位' : '凶位'}{it.effective === false ? ' · 被遮 Vedha' : ''}</em>
								</div>
							))}
						</div>
					</div>
				) : null}
			</div>
		);
	}

	renderRasiDashaCards(fields){
		// 座位大运(rasi dasha)归「大运」tab(用户定向):Narayana + Lagna Kendrādi/Sudaśā/Dṛg/Śūla/Niryāṇa Śūla/Kālachakra/Tāra/Sthira/Yogārdha/Maṇḍūka。
		const SIGN_CN = { Aries: '白羊', Taurus: '金牛', Gemini: '双子', Cancer: '巨蟹', Leo: '狮子', Virgo: '处女', Libra: '天秤', Scorpio: '天蝎', Sagittarius: '射手', Capricorn: '摩羯', Aquarius: '水瓶', Pisces: '双鱼' };
		const sc = (s)=>SIGN_CN[s] || s || '—';
		const jyotish = getJyotish(resolveJyotishChartObj(this.state, fields));
		const rd = jyotish ? jyotish.rasiDasha : null;
		const nar = rd && rd.narayana;
		if(!rd && !(nar && nar.mahadashas)){ return null; }
		return (
			<>
				{nar && Array.isArray(nar.mahadashas) && nar.mahadashas.length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Narayana 座位大运（种子 {sc(nar.seed)}{nar.deity ? ` · ${nar.deity}` : ''}）</div>
						<div className="horosa-india-data-list">
							{nar.mahadashas.slice(0, 12).map((m, i)=>(
								<div className="horosa-india-data-row" key={`${m.rasi}_${i}`}>
									<strong>{sc(m.rasi)}</strong>
									<span>{(typeof m.years === 'number' ? m.years.toFixed(0) : m.years)} 年</span>
									<em>{m.deity || ''}</em>
								</div>
							))}
						</div>
					</div>
				) : null}
				{rd ? [
					{ key: 'lagnaKendradi', label: 'Lagna Kendrādi 大运' },
					{ key: 'sudasa', label: 'Sudaśā（Sree Lagna）' },
					{ key: 'drigdasa', label: 'Dṛg 大运' },
					{ key: 'shoola', label: 'Śūla 大运' },
					{ key: 'niryanaShoola', label: 'Niryāṇa Śūla 大运' },
					{ key: 'kalachakra', label: 'Kālachakra 大运' },
					{ key: 'taraLagna', label: 'Tāra Lagna 大运（均匀 9 年/座 · 108）' },
					{ key: 'sthira', label: 'Sthira 固定座运（动7/固8/变9 · 96）' },
					{ key: 'yogardha', label: 'Yogārdha 平均座运（(Sthira+Narayana)/2）' },
					{ key: 'manduka', label: 'Maṇḍūka 蛙跳座运（kendra +3 · 7/8/9 · 96）' },
				].map((def)=>{
					const d = rd[def.key];
					if(!d || d.available === false || !Array.isArray(d.mahadashas) || !d.mahadashas.length){ return null; }
					return (
						<div className="horosa-info-card" key={def.key}>
							<div className="horosa-info-card-title">{def.label}{d.deha ? `（Deha ${sc(d.deha)} · Jiva ${sc(d.jiva)}）` : ''}{def.key === 'sthira' ? this.renderSthiraStartToggle(d) : null}</div>
							<div className="horosa-india-data-list">
								{d.mahadashas.slice(0, 12).map((m, i)=>(
									<div className="horosa-india-data-row" key={`${def.key}_${i}`}>
										<strong>{sc(m.rasi)}</strong>
										<span>{(typeof m.years === 'number' ? m.years.toFixed(1) : m.years)} 年</span>
										<em>{m.deity || m.lord || ''}</em>
									</div>
								))}
							</div>
						</div>
					);
				}) : null}
			</>
		);
	}

	renderJaiminiPanel(fields){
		const SIGN_CN = { Aries: '白羊', Taurus: '金牛', Gemini: '双子', Cancer: '巨蟹', Leo: '狮子', Virgo: '处女', Libra: '天秤', Scorpio: '天蝎', Sagittarius: '射手', Capricorn: '摩羯', Aquarius: '水瓶', Pisces: '双鱼' };
		const sc = (s)=>SIGN_CN[s] || s || '—';
		const jyotish = getJyotish(resolveJyotishChartObj(this.state, fields));
		const ar = jyotish ? jyotish.arudha : null;
		// 座位大运(rasi dasha)已移至「大运」tab(renderRasiDashaCards);映象 tab 只留 Arudha/Argala 等 Jaimini 盘点。
		if(!ar || !ar.available){
			return <div className="horosa-india-dasha-empty">暂无 Jaimini 数据</div>;
		}
		return (
			<div className="horosa-india-jyotish-panel">
				{ar && ar.available ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Arudha 映象（AL / UL）</div>
						<div className="horosa-info-row"><span>Arudha Lagna (AL)</span><strong>{sc(ar.arudhaLagna)}</strong></div>
						<div className="horosa-info-row"><span>Upapada (UL)</span><strong>{sc(ar.upapadaLagna)}</strong></div>
					</div>
				) : null}
				{ar && ar.available && Array.isArray(ar.houseArudhas) ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">12 宫 Arudha Pada</div>
						<div className="horosa-india-data-list">
							{ar.houseArudhas.map((it)=>(
								<div className="horosa-india-data-row" key={it.label}>
									<strong>{it.label}</strong>
									<span>{sc(it.sign)}</span>
									<em>第 {it.signIndex} 宫</em>
								</div>
							))}
						</div>
					</div>
				) : null}
				{ar && ar.available && ar.argala && Object.keys(ar.argala).length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">12 宫 Argala（干涉 / 反制）</div>
						<div className="horosa-india-data-list">
							{Object.keys(ar.argala).sort((a, b)=>(Number(a) - Number(b))).map((h)=>{
								const g = ar.argala[h] || {};
								const netCn = g.netStronger === 'argala' ? '干涉占优' : (g.netStronger === 'virodha' ? '反制占优' : '势均');
								const argSigns = Array.isArray(g.argala) ? g.argala.filter((r)=>r.count > 0).map((r)=>`${sc(r.sign)}${r.papa && r.papa.length ? '凶' : (r.subha && r.subha.length ? '吉' : '')}`).join('·') : '';
								return (
									<div className="horosa-india-data-row" key={`arg_${h}`}>
										<strong>第 {h} 宫</strong>
										<span className={g.netStronger === 'argala' ? 'is-strong' : (g.netStronger === 'virodha' ? 'is-weak' : '')}>{netCn}</span>
										<em>干涉 {g.argalaCount || 0} / 反制 {g.virodhaCount || 0}{argSigns ? ` · ${argSigns}` : ''}</em>
									</div>
								);
							})}
						</div>
					</div>
				) : null}
			</div>
		);
	}

	renderVargaAnalysisCards(fields){
		// 分盘判读卡(归「分盘」tab):D60 六十分盘吉凶 + 分盘变体对照(D2/D3/D24/D30 各流派落座)。
		const jyotish = getJyotish(resolveJyotishChartObj(this.state, fields));
		const shashti = jyotish && jyotish.shashtiamsa && jyotish.shashtiamsa.available ? jyotish.shashtiamsa : null;
		const vargaVar = jyotish && jyotish.vargaVariants && jyotish.vargaVariants.available ? jyotish.vargaVariants : null;
		const nadi = jyotish && jyotish.nadi && jyotish.nadi.available ? jyotish.nadi : null;   // D150 纳地盘(分盘)
		if(!shashti && !vargaVar && !(nadi && nadi.d150 && nadi.d150.length)){ return null; }
		const PCN = { Sun: '太阳', Moon: '月亮', Mars: '火星', Mercury: '水星', Jupiter: '木星', Venus: '金星', Saturn: '土星', Rahu: '罗睺', Ketu: '计都', 'North Node': '罗睺', 'South Node': '计都' };
		return (
			<div className="horosa-india-jyotish-panel horosa-india-varga-analysis">
				{shashti && shashti.planets && shashti.planets.length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">D60 Ṣaṣṭyāṃśa 六十分盘吉凶（各曜本命落第几段 · Krūra 恶段为凶）</div>
						<div className="horosa-info-row"><span>统计</span><strong>吉 {shashti.beneficCount} · 凶 {shashti.maleficCount}</strong></div>
						<div className="horosa-india-data-list">
							{shashti.planets.map((x)=>(
								<div className="horosa-india-data-row" key={x.planet}>
									<strong>{PCN[x.planet] || x.planet}</strong>
									<span>第 {x.segment} / 60 · {x.deity ? `${x.deity} · ` : ''}{x.signLabel}</span>
									<em style={{ color: x.nature === 'malefic' ? 'var(--horosa-jx-xiong)' : 'var(--horosa-jx-ji)' }}>{x.nature === 'malefic' ? '凶' : '吉'}</em>
								</div>
							))}
						</div>
						<div className="horosa-india-card-note">{shashti.note || 'Krūra 恶段→凶，余吉；偶象神名逆序。专名表文档未全列，暂显段号。'}</div>
					</div>
				) : null}
				{vargaVar && vargaVar.charts && vargaVar.charts.length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">分盘变体对照（D2/D3/D24/D30 各流派落座 · 标准 Parāśara 为默认）</div>
						{vargaVar.charts.map((ch)=>(
							<div className="horosa-india-varga-variant-block" key={ch.key} style={{ marginBottom: 10 }}>
								<div className="horosa-india-data-subhead" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
									<strong>{ch.label}</strong>
									<em style={{ opacity: 0.7, fontSize: '0.85em' }}>{ch.variants.map((v)=>v.label).join(' · ')}</em>
								</div>
								<div className="horosa-india-data-list">
									{ch.planets.filter((r)=>r.differs).length ? ch.planets.filter((r)=>r.differs).map((r)=>(
										<div className="horosa-india-data-row" key={r.planet}>
											<strong>{PCN[r.planet] || r.planet}</strong>
											<span>{r.cells.map((c)=>c.signLabel).join(' → ')}</span>
										</div>
									)) : (
										<div className="horosa-india-card-note">本盘各曜在此分盘各流派落座一致（无差异）。</div>
									)}
								</div>
							</div>
						))}
						<div className="horosa-india-card-note">{vargaVar.note || '仅列差异曜；标准 Parāśara 为默认，未列变体为文档未全列者（不臆造）。'}</div>
					</div>
				) : null}
				{nadi && nadi.d150 && nadi.d150.length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Nāḍī · D150 纳地盘（各曜 nāḍiāṃśa · 150/座 · 每格 0°12′）</div>
						<div className="horosa-india-data-list">
							{nadi.d150.map((x)=>(
								<div className="horosa-india-data-row" key={x.planet}>
									<strong>{PCN[x.planet] || x.planet}</strong>
									<span>第 {x.nadiamsa} / 150 · {x.signLabel}</span>
								</div>
							))}
						</div>
						<div className="horosa-india-card-note">{nadi.d150Note || '专名表所给文档未全列，暂显号位。'}</div>
					</div>
				) : null}
			</div>
		);
	}

	renderUpagrahaPanel(fields){
		const SIGN_SHORT = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
		const fmtLon = (lon)=>{
			const v = (((lon || 0) % 360) + 360) % 360;
			return `${SIGN_SHORT[Math.floor(v / 30)]} ${formatDegree(v % 30)}`;
		};
		const jyotish = getJyotish(resolveJyotishChartObj(this.state, fields));
		const up = jyotish ? jyotish.upagraha : null;
		if(!up || !up.available){
			return <div className="horosa-india-dasha-empty">暂无副星数据</div>;
		}
		const sl = up.specialLagnas;
		const supLagnas = jyotish && jyotish.supplementaryLagnas && jyotish.supplementaryLagnas.available ? jyotish.supplementaryLagnas : null;
		const nadi = jyotish && jyotish.nadi && jyotish.nadi.available ? jyotish.nadi : null;   // P2 Nāḍī Bhrigu Bindu
		const outer = jyotish && jyotish.outerPlanets && jyotish.outerPlanets.available ? jyotish.outerPlanets.planets : [];
		return (
			<div className="horosa-india-jyotish-panel">
				{outer.length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">外行星 Ur/Ne/Pl（虚星 · 信息性,不入九曜强弱）</div>
						<div className="horosa-india-data-list">
							{outer.map((o)=>(
								<div className="horosa-india-data-row" key={o.id}>
									<strong>{o.label}</strong>
									<span>{o.signLabel} {formatDegree(o.signlon)}{o.retrograde ? ' R' : ''} · 宫{o.house || '—'}</span>
									<em>{o.nakshatra ? `${o.nakshatra} P${o.pada}` : '—'}</em>
								</div>
							))}
						</div>
					</div>
				) : null}
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">特殊上升 Special Lagnas</div>
					{sl ? (
						<>
						<div className="horosa-india-data-list">
							{['bhavaLagna', 'horaLagna', 'ghatikaLagna', 'sreeLagna'].map((k)=>{
								const item = sl[k];
								return item ? (
									<div className="horosa-india-data-row" key={k}>
										<strong>{item.key}</strong>
										<span>{item.label}</span>
										<em>{fmtLon(item.lon)}</em>
									</div>
								) : null;
							})}
						</div>
						{sl.pranapada ? (
							<div className="horosa-india-data-list" style={{ marginTop: 4 }}>
								<div className="horosa-india-data-subhead"><strong>Praṇapada PP（流派变体）</strong></div>
								<div className="horosa-india-data-row"><strong>PP</strong><span>日出太阳（BPHS）</span><em>{fmtLon(sl.pranapada.variantSunrise)}</em></div>
								{sl.pranapada.variantBirth !== undefined ? (
									<div className="horosa-india-data-row"><strong>PP</strong><span>出生太阳（PyJHora）</span><em>{fmtLon(sl.pranapada.variantBirth)}</em></div>
								) : null}
								<div className="horosa-india-card-note">{sl.pranapada.note}</div>
							</div>
						) : null}
						</>
					) : (
						<div className="horosa-india-dasha-empty">{up.note || '日出不定，特殊上升降级'}</div>
					)}
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">日基副星 Sun-based Upagrahas</div>
					<div className="horosa-india-data-list">
						{(up.sunBased || []).map((item)=>(
							<div className="horosa-india-data-row" key={item.key}>
								<strong>{item.key}</strong>
								<span>{item.note}</span>
								<em>{fmtLon(item.lon)}</em>
							</div>
						))}
					</div>
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">时基副星 Time-based Upagrahas（Gulika/Maandi 等）</div>
					{Array.isArray(up.timeBased) && up.timeBased.length > 0 ? (
						<div className="horosa-india-data-list">
							{up.timeBased.map((item)=>(
								<div className="horosa-india-data-row" key={item.key}>
									<strong>{item.key}</strong>
									<span>{item.note}</span>
									<em>{fmtLon(item.lon)}</em>
								</div>
							))}
						</div>
					) : (
						<div className="horosa-india-dasha-empty">日出不定（极地等），时基副星降级</div>
					)}
				</div>
				{supLagnas ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">补充上升 Supplementary Lagnas（Chandra/Paaka/Karakamsa/Indu/Varṇada）</div>
						<div className="horosa-india-data-list">
							{[supLagnas.chandraLagna, supLagnas.paakaLagna, supLagnas.karakamsa, supLagnas.swamsa, supLagnas.induLagna, supLagnas.varnadaLagna].filter((it)=>it && it.sign).map((it)=>(
								<div className="horosa-india-data-row" key={it.key}>
									<strong>{it.label}</strong>
									<span>{it.signLabel || it.sign}</span>
									<em>{it.key === 'induLagna' && it.sumKala ? `Kala和 ${it.sumKala} · 第${it.stepS}座` : (it.key === 'varnadaLagna' && it.step ? `A${it.countLagna}/B${it.countHora} · N${it.step}${it.altDiffers ? ` · V法:${it.altSignLabel || it.altSign}` : ''}` : it.sign)}</em>
								</div>
							))}
						</div>
						{Array.isArray(supLagnas.grahaLagnas) && supLagnas.grahaLagnas.length ? (
							<div className="horosa-india-data-list">
								{supLagnas.grahaLagnas.map((g)=>(
									<div className="horosa-india-data-row" key={`gl${g.planet}`}>
										<strong>{g.label || g.planet}</strong>
										<span>{g.signLabel || g.sign}</span>
										<em>Graha Lagna</em>
									</div>
								))}
							</div>
						) : null}
					</div>
				) : null}
				{nadi && nadi.bhriguBindu ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Nāḍī · Bhrigu Bindu 福点（Rahu/Moon 短弧中点 · 业力焦点/应期）</div>
						<div className="horosa-info-row"><span>落座</span><strong>{nadi.bhriguBindu.signLabel} {formatDegree(nadi.bhriguBindu.signlon)}</strong></div>
						<div className="horosa-info-row"><span>月宿</span><strong>{nadi.bhriguBindu.nakshatra ? `${nadi.bhriguBindu.nakshatra.name}${nadi.bhriguBindu.nakshatra.pada ? ' P' + nadi.bhriguBindu.nakshatra.pada : ''}` : '—'}</strong></div>
						<div className="horosa-info-row"><span>黄经</span><strong>{formatDegree(nadi.bhriguBindu.lon)}</strong></div>
					</div>
				) : null}
			</div>
		);
	}

	renderJyotishNav(){
		const items = [
			{ key: '2', icon: 'note', title: '五支', sub: '起盘' },
			{ key: '3', icon: 'clock', title: '大运', sub: 'Dasha' },
			{ key: '4', icon: 'sidePlanets', title: '星曜', sub: '状态' },
			{ key: '5', icon: 'target', title: '八分', sub: 'AV' },
			{ key: '6', icon: 'quickTransit', title: 'KP', sub: '择时' },
			{ key: '7', icon: 'target', title: 'Yoga', sub: '组合' },
			{ key: '8', icon: 'sideStyle', title: '副星', sub: 'Upa' },
			{ key: '9', icon: 'quickNote', title: '映象', sub: 'Jaimini' },
			{ key: '10', icon: 'quickTransit', title: '行运', sub: 'Gochara' },
			{ key: '11', icon: 'note', title: '年度', sub: 'Tajaka' },
			{ key: '12', icon: 'sideStyle', title: '化解', sub: 'Remedies' },
			{ key: '13', icon: 'target', title: '敌友', sub: 'Maitri' },
		];
		return (
			<XQSideSection iconName={sideSectionIcon('switches')} title="高级印占" storageKey="india.s0" className="horosa-india-input-section horosa-india-jyotish-nav">
				<div className="horosa-india-jyotish-buttons">
					{items.map((item)=>(
						<button
							type="button"
							key={item.key}
							className={`horosa-india-jyotish-button${this.state.jyotishTab === item.key ? ' is-active' : ''}`}
							onClick={()=>this.changeJyotishTab(item.key)}
						>
							<XQIcon name={item.icon} />
							<span>{item.title}</span>
							<em>{item.sub}</em>
						</button>
					))}
				</div>
			</XQSideSection>
		);
	}

	changeDashaSystem(value){
		const v = value && value.target ? value.target.value : value;
		// 换大运体系 = 后端只算选中体系全三级(其余 maha-only)→ requestDashaChart 重取(dashaSystem 进缓存键)。
		// stale-while-revalidate:不清盘/不进满屏 loading(由 requestDashaChart 设 dashaUpdating + lastChartObj 回退);
		// 仅收起展开 + 清钻取路径,免视觉残留/索引错位。算好后平滑换新盘。
		this.setState({
			dashaSystem: v,
			dashaExpandedKey: null,
			dashaExpandedAntarKey: null,
			dashaDrillPath: [],
		}, ()=>{
			this.requestDashaChart(this.withIndiaOptionFields(this.props.fields, { indiaDashaSystem: v }));
		});
	}

	changeDashaSeed(value){
		// 换起运点 = 后端按该点 D1 黄经重算全体系大运 → requestDashaChart 重取(同 nodeType/ayanamsa 口径)。
		const v = (value && value.target ? value.target.value : value) || DASHA_SEED_DEFAULT;
		// stale-while-revalidate:不清盘/不进满屏 loading(由 requestDashaChart 设 dashaUpdating + lastChartObj 回退);
		// 切换期短暂显上次成功盘 + 「更新中…」角标(用户取舍:宁要旧盘留存不要满屏加载框),算好平滑换新。
		this.setState({
			dashaSeed: v,
			dashaExpandedKey: null,
			dashaExpandedAntarKey: null,
			dashaDrillPath: [],
		}, ()=>{
			this.requestDashaChart(this.withIndiaOptionFields(this.props.fields, { indiaDashaSeed: v }));
		});
	}

	changeTransitDate(value){
		// 换过运日期 = 后端按该日重算 gochara → requestDashaChart 重取(transitDate 进缓存键)。value=moment|null(null=回今日)。
		// stale-while-revalidate:不清盘/不进满屏 loading(由 requestDashaChart 设 dashaUpdating + lastChartObj 回退),算好平滑换新。
		const v = value && value.format ? value.format('YYYY/MM/DD') : null;
		this.setState({
			indiaTransitDateValue: v,
		}, ()=>{
			this.requestDashaChart(this.withIndiaOptionFields(this.props.fields, { indiaTransitDate: v }));
		});
	}

	toggleDashaExpanded(key){
		this.setState((s)=>({
			dashaExpandedKey: s.dashaExpandedKey === key ? null : key,
			dashaExpandedAntarKey: null,
		}));
	}

	toggleDashaAntarExpanded(key){
		this.setState((s)=>({ dashaExpandedAntarKey: s.dashaExpandedAntarKey === key ? null : key }));
	}

	// WP-D 钻入下一级(追加该段索引,最深 4 → 第5级息运)。
	drillDasha(idx){
		this.setState((s)=>{
			const path = Array.isArray(s.dashaDrillPath) ? s.dashaDrillPath : [];
			if(path.length >= DASHA_MAX_LEVEL - 1){
				return null;
			}
			return { dashaDrillPath: path.concat([idx]) };
		});
	}

	// WP-D 面包屑回溯到第 level 级(path 截断到该长度)。
	dashaBreadcrumbTo(level){
		this.setState((s)=>{
			const path = Array.isArray(s.dashaDrillPath) ? s.dashaDrillPath : [];
			return { dashaDrillPath: path.slice(0, level) };
		});
	}

	// WP-D 大运 5 级钻取视图:面包屑 + 当前级列表;点段钻入,各级含今日金色高亮 +「当前」徽标。
	renderDashaDrillView(dasha){
		let path = Array.isArray(this.state.dashaDrillPath) ? this.state.dashaDrillPath.slice() : [];
		let list = Array.isArray(dasha.items) ? dasha.items : [];
		const crumbs = [];
		for(let i = 0; i < path.length; i++){
			const sel = list[path[i]];
			if(!sel){ // 索引对不上当前 dasha(换盘/换体系)→ 截断回退,不崩
				path = path.slice(0, i);
				break;
			}
			crumbs.push(sel);
			list = buildDashaSubPeriods(sel);
		}
		const level = crumbs.length; // 0=大运 … 4=息运
		const levelInfo = DASHA_LEVEL_LABELS[Math.min(level, DASHA_MAX_LEVEL - 1)];
		const canDrill = level < DASHA_MAX_LEVEL - 1;
		// 微运(level 3)+ 息运(level 4)极短 → 日期精确到时:分 + 细粒度时长(天/时/分),不再多段同日。
		const fineTime = level >= 3;
		return (
			<div className="horosa-india-dasha-drill">
				<div className="horosa-india-dasha-crumbs">
					<button
						type="button"
						className={`horosa-india-dasha-crumb${level === 0 ? ' is-current' : ''}`}
						onClick={()=>this.dashaBreadcrumbTo(0)}
					>{DASHA_LEVEL_LABELS[0].cn}</button>
					{crumbs.map((c, k)=>(
						<span className="horosa-india-dasha-crumb-seg" key={`crumb_${k}`}>
							<span className="horosa-india-dasha-crumb-sep" aria-hidden="true">›</span>
							<button
								type="button"
								className={`horosa-india-dasha-crumb${level === k + 1 ? ' is-current' : ''}`}
								onClick={()=>this.dashaBreadcrumbTo(k + 1)}
							>
								<strong>{c.lord.label}</strong>
								<em>{DASHA_LEVEL_LABELS[k + 1] ? DASHA_LEVEL_LABELS[k + 1].cn : ''}</em>
							</button>
						</span>
					))}
				</div>
				<div className="horosa-india-dasha-drill-head">
					<span>{levelInfo.cn} · {levelInfo.en}</span>
					<em>{list.length} 段{canDrill ? ' · 点击钻入下一级' : ' · 已到最细级'}</em>
				</div>
				<div className="horosa-india-dasha-drill-list">
					{list.map((item, idx)=>{
						const cur = !!(item.active || dashaContainsNow(item));
						const hasAge = typeof item.startAge === 'number' && typeof item.endAge === 'number';
						return (
							<button
								type="button"
								key={`${item.lord.key}_${idx}`}
								className={`horosa-india-dasha-drill-row${cur ? ' is-current' : ''}${canDrill ? ' is-drillable' : ''}`}
								onClick={()=>canDrill && this.drillDasha(idx)}
								disabled={!canDrill}
							>
								<span className="horosa-india-dasha-drill-lord">
									<strong>{item.lord.label}</strong>
									<em>{item.lord.en}</em>
									{cur ? <span className="horosa-india-dasha-cur-badge">当前</span> : null}
								</span>
								<span className="horosa-india-dasha-drill-meta">
									<span>{fineTime ? `${formatJyotishDateTime(item.start)} - ${formatJyotishDateTime(item.end)}` : `${formatJyotishDate(item.start)} - ${formatJyotishDate(item.end)}`}</span>
									<em>{fineTime ? formatDurationFine(item.years) : formatDuration(item.years)}{hasAge ? ` · ${formatAge(item.startAge)}-${formatAge(item.endAge)}` : ''}</em>
								</span>
								{canDrill ? <span className="horosa-india-dasha-drill-chev" aria-hidden="true">▸</span> : null}
							</button>
						);
					})}
				</div>
			</div>
		);
	}

	// 实例级 memoize:buildVimshottariDasha(chara/conditional 走 JS 递归)随每次 render(含 hover/popover/钻取等无关
	// state 变更)重跑。签名 = dashaChartObj 引用 + 体系 + 起点;三者不变即复用上轮结果(钻取/今日高亮在缓存的 dasha
	// 上派生,零回归)。seed 实际经后端换盘 → dashaChartObj 引用已变,这里入键属防御性冗余。
	getMemoizedDasha(dashaChartObj, fields, system, seed){
		const cache = this._dashaMemo;
		if(cache && cache.chartObj === dashaChartObj && cache.system === system && cache.seed === seed && cache.fields === fields){
			return cache.dasha;
		}
		const dasha = buildVimshottariDasha(dashaChartObj, fields, system);
		this._dashaMemo = { chartObj: dashaChartObj, system, seed, fields, dasha };
		return dasha;
	}

	renderDashaPanel(fields){
		const system = this.state.dashaSystem || 'vimshottari';
		const dashaChartObj = resolveJyotishChartObj(this.state, fields);
		const seed = this.state.dashaSeed || DASHA_SEED_DEFAULT;
		const dasha = this.getMemoizedDasha(dashaChartObj, fields, system, seed);
		const naisargika = dashaChartObj && dashaChartObj.jyotish && dashaChartObj.jyotish.dasha
			? dashaChartObj.jyotish.dasha.naisargika : null;   // P1 自然大运(年龄段)
		const ayurdaya = dashaChartObj && dashaChartObj.jyotish && dashaChartObj.jyotish.ayurdaya
			&& dashaChartObj.jyotish.ayurdaya.available ? dashaChartObj.jyotish.ayurdaya : null;   // P2 寿命基础
		const mula = dashaChartObj && dashaChartObj.jyotish && dashaChartObj.jyotish.dasha
			&& dashaChartObj.jyotish.dasha.mula && dashaChartObj.jyotish.dasha.mula.available
			? dashaChartObj.jyotish.dasha.mula : null;   // P1 Mūla graha 大运
		const sudarshana = dashaChartObj && dashaChartObj.jyotish && dashaChartObj.jyotish.dasha
			&& dashaChartObj.jyotish.dasha.sudarshanaChakra && dashaChartObj.jyotish.dasha.sudarshanaChakra.available
			? dashaChartObj.jyotish.dasha.sudarshanaChakra : null;   // P1 Sudarśana Chakra(3 轮)
		const sysTitle = DASHA_SYSTEM_LABEL[system] || 'Vimshottari';
		const stdOpts = DASHA_SYSTEM_OPTIONS.filter((o)=>DASHA_CONDITIONAL_KEYS.indexOf(o.value) < 0 && DASHA_JAIMINI_KEYS.indexOf(o.value) < 0);
		const condOpts = DASHA_SYSTEM_OPTIONS.filter((o)=>DASHA_CONDITIONAL_KEYS.indexOf(o.value) >= 0);
		const jaiminiOpts = DASHA_SYSTEM_OPTIONS.filter((o)=>DASHA_JAIMINI_KEYS.indexOf(o.value) >= 0);
		const selector = (
			<div className="horosa-india-dasha-syssel">
				<div className="horosa-india-dasha-syssel-row">
					<label className="horosa-india-dasha-syssel-field">
						<span className="horosa-india-dasha-syssel-label">大运体系</span>
						<Select
							size="small"
							value={system}
							onChange={(v)=>this.changeDashaSystem(v)}
							dropdownMatchSelectWidth={false}
							className="horosa-india-dasha-syssel-select"
						>
							<OptGroup label="标准大运">
								{stdOpts.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
							</OptGroup>
							<OptGroup label="条件 Nakshatra 大运">
								{condOpts.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
							</OptGroup>
							<OptGroup label="Jaimini 星座大运">
								{jaiminiOpts.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
							</OptGroup>
						</Select>
					</label>
					<label className="horosa-india-dasha-syssel-field">
						<span className="horosa-india-dasha-syssel-label">起点</span>
						<Select
							size="small"
							value={seed}
							onChange={(v)=>this.changeDashaSeed(v)}
							dropdownMatchSelectWidth={false}
							className="horosa-india-dasha-syssel-select"
						>
							{DASHA_SEED_OPTIONS.map((grp)=>(
								<OptGroup key={grp.label} label={grp.label}>
									{grp.options.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
								</OptGroup>
							))}
						</Select>
					</label>
				</div>
			</div>
		);
		if(this.state.dashaLoading && !dasha){
			return (
				<div className="horosa-india-dasha-panel">
					{selector}
					<div className="horosa-india-dasha-empty">大运计算中...</div>
				</div>
			);
		}
		if(!dasha){
			return (
				<div className="horosa-india-dasha-panel">
					{selector}
					<div className="horosa-india-dasha-empty">暂无 {sysTitle} 数据</div>
				</div>
			);
		}
		const activeItem = dasha.items.find((item)=>item.active);
		return (
			<div className="horosa-india-dasha-panel">
				{selector}
				<div className="horosa-info-card horosa-india-dasha-overview">
					<div className="horosa-info-card-title">{sysTitle}</div>
					{dasha.chara ? (
						<>
							<div className="horosa-info-row"><span>起始座</span><strong>{dasha.nakshatra.name}</strong></div>
							<div className="horosa-info-row"><span>当前座</span><strong>{activeItem ? `${activeItem.lord.label} · ${activeItem.lord.en}` : '—'}</strong></div>
						</>
					) : (
						<>
							{seed !== 'moon' ? (
								<div className="horosa-info-row"><span>起点</span><strong>{DASHA_SEED_LABEL[seed] || seed}</strong></div>
							) : null}
							<div className="horosa-info-row"><span>{seed === 'moon' ? '月宿' : '起点宿'}</span><strong>{dasha.nakshatra.index}. {dasha.nakshatra.name}</strong></div>
							<div className="horosa-info-row"><span>起运</span><strong>{dasha.nakshatra.lord.label} · {dasha.nakshatra.lord.en}</strong></div>
							<div className="horosa-info-row"><span>出生余额</span><strong>{formatDuration(dasha.firstBalance)}</strong></div>
							<div className="horosa-info-row"><span>当前</span><strong>{activeItem ? `${activeItem.lord.label} · ${activeItem.lord.en}` : '—'}</strong></div>
						</>
					)}
				</div>
				<div className="horosa-india-dasha-list">
					{this.renderDashaDrillView(dasha)}
				</div>
				{naisargika && naisargika.available && Array.isArray(naisargika.periods) ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Naisargika 自然大运（7 曜固定 120 年 · Varahamihira 成熟序/年龄段）</div>
						<table className="horosa-india-maitri-table horosa-india-shad-table">
							<thead><tr><th>曜</th><th>年</th><th>年龄段</th><th>起→止</th></tr></thead>
							<tbody>
								{naisargika.periods.map((p)=>(
									<tr key={`nais${p.planet}`}>
										<th>{p.planetCN}</th>
										<td>{p.years}</td>
										<td>{p.startAge}–{p.endAge}</td>
										<td>{p.start || '—'} → {p.end || '—'}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				) : null}
				{ayurdaya && ayurdaya.pindayu ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Āyurdāya 寿命 · Piṇḍāyu 基础（度式贡献 · 未施 haraṇa 减）</div>
						<div className="horosa-info-row"><span>基础 Piṇḍāyu</span><strong className="horosa-india-emph">{ayurdaya.pindayu.baseYears} 年</strong></div>
						<table className="horosa-india-maitri-table horosa-india-shad-table">
							<thead><tr><th>曜</th><th>满寿</th><th>距落陷°</th><th>贡献年</th></tr></thead>
							<tbody>
								{ayurdaya.pindayu.contributions.map((c)=>(
									<tr key={`pind${c.planet}`}>
										<th>{c.planetCN}</th>
										<td>{c.fullYears}</td>
										<td>{Math.round(c.arcFromDebil)}</td>
										<td>{c.years}</td>
									</tr>
								))}
							</tbody>
						</table>
						{Array.isArray(ayurdaya.nisargayu && ayurdaya.nisargayu.naturalYears) ? (
							<div className="horosa-info-row"><span>Nisargāyu 自然寿</span><strong>{ayurdaya.nisargayu.naturalYears.map((n)=>`${n.planetCN}${n.years}`).join(' ')}（120）</strong></div>
						) : null}
						{ayurdaya.amsayu && Array.isArray(ayurdaya.amsayu.contributions) ? (
							<div className="horosa-info-row"><span>Aṁśāyu（÷200·Bharaṇa）</span><strong>{ayurdaya.amsayu.contributions.map((c)=>`${c.planetCN}${c.years}${c.multiplier > 1 ? '×' + c.multiplier : ''}`).join(' ')} = <span className="horosa-india-emph">{ayurdaya.amsayu.baseYears}</span> 年</strong></div>
						) : null}
						{ayurdaya.amsayu && Array.isArray(ayurdaya.amsayu.bharanaVariants) ? (
							<div className="horosa-info-row"><span>Bharaṇa 分组（流派选项）</span><strong>{ayurdaya.amsayu.bharanaVariants.map((v)=>`${v.label.replace(/（.*）/, '')} ${v.baseYears}`).join(' · ')}</strong></div>
						) : null}
						<div className="horosa-india-card-note">{ayurdaya.methodSelection}</div>
						<div className="horosa-india-card-note">{ayurdaya.haranaNote}</div>
					</div>
				) : null}
				{ayurdaya && ayurdaya.harana && ayurdaya.harana.available && Array.isArray(ayurdaya.harana.profiles) ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Āyurdāya · haraṇa 减算（流派选项 · Piṇḍāyu 施减）</div>
						<div className="horosa-india-data-list">
							{ayurdaya.harana.profiles.map((p)=>(
								<div className="horosa-india-data-row" key={p.key}>
									<strong>{p.label}</strong>
									<span>{p.savanaYears} Savana</span>
									<em className="horosa-india-emph">{p.solarYears} 太阳年</em>
								</div>
							))}
						</div>
						{ayurdaya.haranaNisarga && Array.isArray(ayurdaya.haranaNisarga.profiles) ? (
							<div className="horosa-india-data-list">
								<div className="horosa-india-data-subhead"><strong>Nisargāyu 自然寿（全期 vs 技术派）</strong></div>
								{ayurdaya.haranaNisarga.profiles.map((p)=>(
									<div className="horosa-india-data-row" key={`nis${p.key}`}>
										<strong>{p.label}</strong>
										<span>{p.savanaYears} Savana</span>
										<em className="horosa-india-emph">{p.solarYears} 太阳年</em>
									</div>
								))}
							</div>
						) : null}
						<table className="horosa-india-maitri-table horosa-india-shad-table">
							<thead><tr><th>曜</th><th>基础</th><th>敌/合</th><th>宫</th><th>Chakra</th><th>减后</th></tr></thead>
							<tbody>
								{ayurdaya.harana.planets.map((r)=>(
									<tr key={`har${r.planet}`}>
										<th>{r.planetCN}</th>
										<td>{r.baseYears}</td>
										<td>{`${r.enemySign ? '敌' : ''}${r.combust ? '合' : ''}` || '—'}</td>
										<td>{r.house}</td>
										<td>{r.chakrapata > 0 ? r.chakrapata : '—'}</td>
										<td>{r.reducedYears}</td>
									</tr>
								))}
							</tbody>
						</table>
						{ayurdaya.harana.krurodaya && ayurdaya.harana.krurodaya.applies ? (
							<div className="horosa-info-row"><span>Krurodaya（{ayurdaya.harana.krurodaya.planetCN} 升 Lagna{ayurdaya.harana.krurodaya.mitigated ? '·吉星望减半' : ''}）</span><strong>式A −{ayurdaya.harana.krurodaya.formulaA} / 式B −{ayurdaya.harana.krurodaya.formulaB}</strong></div>
						) : null}
						<div className="horosa-info-row"><span>Lagna_Ayu（座内角分/200）</span><strong>{ayurdaya.harana.lagnaAyu} 年</strong></div>
						<div className="horosa-india-card-note">{ayurdaya.harana.note}</div>
					</div>
				) : null}
				{mula && Array.isArray(mula.mahadashas) ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Mūla 大运（Lagna Kendrādi Graha · 数到本三角座定年 · 二轮补足 120）</div>
						<table className="horosa-india-maitri-table horosa-india-shad-table">
							<thead><tr><th>曜</th><th>宫</th><th>首轮年</th><th>次轮年</th></tr></thead>
							<tbody>
								{mula.mahadashas.filter((m)=>m.round === 1).map((m, i)=>{
									const r2 = mula.mahadashas.filter((x)=>x.round === 2)[i];
									return (
										<tr key={`mula${m.planet}`}>
											<th>{m.planetCN}</th>
											<td>{m.house}</td>
											<td>{m.years}</td>
											<td>{r2 ? r2.years : '—'}</td>
										</tr>
									);
								})}
							</tbody>
						</table>
						<div className="horosa-india-card-note">{mula.note}</div>
					</div>
				) : null}
				{sudarshana && Array.isArray(sudarshana.rows) ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Sudarśana Chakra 大运（每宫 1 太阳年 · 12 年循环 · 三轮并读）</div>
						<table className="horosa-india-maitri-table horosa-india-shad-table">
							<thead><tr><th>年</th><th>日轮 SL·灵</th><th>月轮 CL·心</th><th>升轮 JL·身</th></tr></thead>
							<tbody>
								{sudarshana.rows.map((r)=>(
									<tr key={`sud${r.year}`} className={r.current ? 'is-current-year' : ''}>
										<th className={r.current ? 'is-good' : ''}>{r.year}{r.current ? '◀' : ''}</th>
										<td>{r.slLabel}</td>
										<td>{r.clLabel}</td>
										<td>{r.jlLabel}</td>
									</tr>
								))}
							</tbody>
						</table>
						<div className="horosa-india-card-note">{sudarshana.note}</div>
					</div>
				) : null}
				{this.renderRasiDashaCards(fields)}
			</div>
		);
	}

	// WP-B 全量重参照:返回把「某星座的宫号」按第1宫参照重数的函数(默认上升→后端原房号,零回归)。
	// 三盘 + 星曜面板 + 宫子表 + Bhava Bala 等所有「宫位」显示统一走它,确保中间盘与右栏一致。
	makeIndiaDispHouse(chartObj){
		const lagnaRef = AstroConst.normalizeIndiaLagnaRef(this.state.indiaLagnaRef);
		const refSignNum = resolveLagnaRefSignNumber(chartObj, lagnaRef);
		return (signName, fallbackHouse)=>{
			if(lagnaRef === 'asc'){ return fallbackHouse; }
			const idx = AstroConst.LIST_SIGNS.indexOf(signName);
			if(idx < 0){ return fallbackHouse; }
			return ((idx + 1 - refSignNum + 12) % 12) + 1;
		};
	}

	renderPanchangaPanel(fields){
		const chartObj = resolveJyotishChartObj(this.state, fields);
		const jyotish = getJyotish(chartObj);
		const panchanga = jyotish ? jyotish.panchanga : null;
		const dasha = getJyotishDasha(chartObj);
		const bhavaHousesRaw = jyotish && jyotish.bhavaBala && Array.isArray(jyotish.bhavaBala.houses) ? jyotish.bhavaBala.houses : [];
		// WP-B 第1宫参照:宫子表也按参照重数宫号 + 重排(默认上升 → 原序原号,零回归)。cusp 仍按原宫(座位置固定)。
		const dispHouse = this.makeIndiaDispHouse(chartObj);
		const bhavaHouses = bhavaHousesRaw.slice().sort((a, b)=>dispHouse(a.sign, a.house) - dispHouse(b.sign, b.house));
		const SIGN_K = { Aries:'白羊', Taurus:'金牛', Gemini:'双子', Cancer:'巨蟹', Leo:'狮子', Virgo:'处女', Libra:'天秤', Scorpio:'天蝎', Sagittarius:'射手', Capricorn:'摩羯', Aquarius:'水瓶', Pisces:'双鱼' };
		const P_K = { Sun:'日', Moon:'月', Mars:'火', Mercury:'水', Jupiter:'木', Venus:'金', Saturn:'土', Rahu:'罗', Ketu:'计', 'North Node':'罗', 'South Node':'计' };
		const HOUSE_KARAKA = { 1:'日', 2:'木', 3:'火', 4:'月', 5:'木', 6:'火土', 7:'金', 8:'土', 9:'木日', 10:'水木日土', 11:'木', 12:'土' };
		const houseClass = (h)=>[[1,4,7,10].includes(h)?'角':'', [1,5,9].includes(h)?'三方':'', [6,8,12].includes(h)?'凶':'', [3,6,10,11].includes(h)?'增益':'', [2,7].includes(h)?'杀':''].filter(Boolean).join('·');
		// WP-L 不等宫盘(§12.2):宫 cusp 始点经度(整宫=30°整界;选 Śrīpati/Placidus 即不等 cusp,居星按 cusp 重归宫)。
		const chartHouses = chartObj && chartObj.chart && Array.isArray(chartObj.chart.houses) ? chartObj.chart.houses : [];
		const cuspOf = (houseNum)=>{ const h = chartHouses.find((x)=>x.id === `House${houseNum}`); return h && h.lon !== undefined && h.lon !== null ? Number(h.lon) : null; };
		const fmtCusp = (lon)=>{ if(lon === null){ return '—'; } const norm = ((lon % 360) + 360) % 360; const d = Math.floor(norm % 30); const m = Math.round(((norm % 30) - d) * 60); return `${d}°${`${m}`.padStart(2, '0')}′`; };
		const cuspMode = jyotish && jyotish.bhavaBala && jyotish.bhavaBala.cuspMode ? jyotish.bhavaBala.cuspMode : null;
		// cuspMode 含 'whole'(wholeSign / wholeSignMid)即整宫;Śrīpati/Placidus 等才是真不等宫。
		const cuspModeLabel = cuspMode ? (/whole/i.test(cuspMode) ? '整宫 Whole-Sign' : `不等宫 ${cuspMode}`) : '整宫 Whole-Sign';
		const SIGN_ATTR = [['白羊','火','阳','动','火'],['金牛','金','阴','固','土'],['双子','水','阳','变','风'],['巨蟹','月','阴','动','水'],['狮子','日','阳','固','火'],['处女','水','阴','变','土'],['天秤','金','阳','动','风'],['天蝎','火','阴','固','水'],['射手','木','阳','变','火'],['摩羯','土','阴','动','土'],['水瓶','土','阳','固','风'],['双鱼','木','阴','变','水']];
		return (
			<div className="horosa-india-summary horosa-india-jyotish-panel">
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">基本参数</div>
					<div className="horosa-info-row"><span>时间</span><strong>{fields.date.value.format('YYYY-MM-DD')} {fields.time.value.format('HH:mm:ss')}</strong></div>
					<div className="horosa-info-row"><span>地点</span><strong>{fields.lon.value} {fields.lat.value}</strong></div>
					<div className="horosa-info-row"><span>时区</span><strong>{fields.zone.value}</strong></div>
					<div className="horosa-info-row"><span>星历</span><strong>{jyotish && jyotish.engine ? 'Swiss / flatlib' : '—'}</strong></div>
					<div className="horosa-info-row"><span>黄道</span><strong>Sidereal 恒星黄道</strong></div>
					<div className="horosa-info-row"><span>岁差</span><strong>{(chartObj && chartObj.params && chartObj.params.ayanamsaLabel) || 'Lahiri / Chitrapaksha'}</strong></div>
				</div>
				{bhavaHouses.length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">宫子表（星座/cusp/宫主/居星/Karaka/分类 · {cuspModeLabel}）</div>
						<table className="horosa-india-maitri-table horosa-india-shad-table">
							<thead><tr><th>宫</th><th>星座</th><th>Cusp</th><th>宫主</th><th>居星</th><th>Karaka</th><th>分类</th></tr></thead>
							<tbody>
								{bhavaHouses.map((h)=>{ const dh = dispHouse(h.sign, h.house); return (<tr key={h.house}><th>{dh}</th><td>{SIGN_K[h.sign] || h.sign}</td><td>{fmtCusp(cuspOf(h.house))}</td><td>{P_K[h.lord] || h.lord || "—"}</td><td>{(h.occupants || []).map((o)=>P_K[o] || o).join("") || "—"}</td><td>{HOUSE_KARAKA[dh] || ""}</td><td>{houseClass(dh)}</td></tr>); })}
							</tbody>
						</table>
					</div>
				) : null}
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">星座属性参考（主星/阴阳/三元/元素）</div>
					<table className="horosa-india-maitri-table horosa-india-shad-table">
						<thead><tr><th>座</th><th>主</th><th>阴阳</th><th>三元</th><th>元素</th></tr></thead>
						<tbody>{SIGN_ATTR.map((r)=>(<tr key={r[0]}><th>{r[0]}</th><td>{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td><td>{r[4]}</td></tr>))}</tbody>
					</table>
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">Panchanga 五支</div>
					{panchanga ? (
						<>
							<div className="horosa-info-row"><span>Vara</span><strong>{panchanga.vara.label} · {panchanga.vara.name}{panchanga.vara.lord ? ` · 主${panchanga.vara.lord.label || panchanga.vara.lord.key}` : ''}</strong></div>
							<div className="horosa-info-row"><span>Tithi</span><strong>{panchanga.tithi.index}. {panchanga.tithi.name} · {panchanga.tithi.paksha}</strong></div>
							<div className="horosa-info-row"><span>Nakshatra</span><strong>{panchanga.nakshatra.index}. {panchanga.nakshatra.name} P{panchanga.nakshatra.pada} · 主{panchanga.nakshatra.lord}{panchanga.nakshatra.isAbhijit ? <span className="horosa-india-abhijit-badge">织女 Abhijit</span> : null}</strong></div>
							<div className="horosa-info-row"><span>Yoga</span><strong>{panchanga.yoga.index}. {panchanga.yoga.name}</strong></div>
							<div className="horosa-info-row"><span>Karana</span><strong>{panchanga.karana.name}</strong></div>
							<div className="horosa-info-row"><span>日出</span><strong>{panchanga.sunrise || '—'}</strong></div>
						</>
					) : (
						<div className="horosa-india-dasha-empty">暂无五支数据</div>
					)}
				</div>
				{panchanga && panchanga.nakshatra && panchanga.nakshatra.detail ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">月宿详情 · {panchanga.nakshatra.name} {panchanga.nakshatra.detail.labelCn}</div>
						<div className="horosa-info-row"><span>主星 · 主神</span><strong>{panchanga.nakshatra.detail.lord} · {panchanga.nakshatra.detail.deity}</strong></div>
						<div className="horosa-info-row"><span>象征</span><strong>{panchanga.nakshatra.detail.symbol}</strong></div>
						<div className="horosa-info-row"><span>活动 · 种姓</span><strong>{panchanga.nakshatra.detail.activity} · {panchanga.nakshatra.detail.varna}</strong></div>
						<div className="horosa-info-row"><span>三性 · 动机</span><strong>{panchanga.nakshatra.detail.gunas} · {panchanga.nakshatra.detail.purushartha}</strong></div>
						<div className="horosa-info-row"><span>五行·阴阳·神人鬼</span><strong>{panchanga.nakshatra.detail.element} · {panchanga.nakshatra.detail.gender} · {panchanga.nakshatra.detail.gana}</strong></div>
						<div className="horosa-info-row"><span>方向 · 风向</span><strong>{panchanga.nakshatra.detail.facing} · {panchanga.nakshatra.detail.windDir}</strong></div>
						<div className="horosa-info-row"><span>身体 · yoni</span><strong>{panchanga.nakshatra.detail.bodyPart} · {panchanga.nakshatra.detail.yoniAnimal}</strong></div>
					</div>
				) : null}
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">Dasha 摘要</div>
					{dasha && dasha.available ? (
						<>
							<div className="horosa-info-row"><span>月宿</span><strong>{dasha.moonNakshatra.index}. {dasha.moonNakshatra.name}</strong></div>
							<div className="horosa-info-row"><span>起运</span><strong>{dasha.firstLord.label} · {dasha.firstLord.key}</strong></div>
							<div className="horosa-info-row"><span>出生余额</span><strong>{formatDuration(dasha.firstBalanceYears)}</strong></div>
							<div className="horosa-info-row"><span>当前大运</span><strong>{dasha.current ? `${dasha.current.lord.label} · ${dasha.current.lord.key}` : '—'}</strong></div>
						</>
					) : (
						<div className="horosa-india-dasha-empty">暂无大运摘要</div>
					)}
				</div>
			</div>
		);
	}

	renderPlanetStatePanel(fields){
		const DIGNITY_CN = { deep_exaltation: '深旺', exaltation: '入旺', moolatrikona: '自旺MT', own_sign: '入庙', debilitation: '入弱', neutral: '平' };
		const chartObjForRef = resolveJyotishChartObj(this.state, fields);
		const jyotish = getJyotish(chartObjForRef);
		// WP-B 第1宫参照:非默认时把所有「宫位」按参照星座重数(与中间盘一致);默认上升=后端房号(零回归)。
		const dispHouse = this.makeIndiaDispHouse(chartObjForRef);
		const states = getJyotishPlanetStates(jyotish);
		const shadbala = jyotish && jyotish.shadbala && Array.isArray(jyotish.shadbala.planets) ? jyotish.shadbala.planets : [];
		const karakas = jyotish && jyotish.jaimini ? jyotish.jaimini.charaKarakas || [] : [];
		const drishti = jyotish && Array.isArray(jyotish.grahaDrishti) ? jyotish.grahaDrishti : [];
		const nodeDrishti = jyotish && Array.isArray(jyotish.nodeRasiDrishti) ? jyotish.nodeRasiDrishti : [];
		const strengths = jyotish && jyotish.strengths ? jyotish.strengths : {};
		const sthiraKaraka = Array.isArray(strengths.sthiraKaraka) ? strengths.sthiraKaraka : [];
		// WP-E1 Vimśopaka(§5.7):各 varga 组里居自/友/旺的分盘数 → 吉位名(Daśavarga 例 2Pārijāta…10Śrīdhāma),越多越吉。
		const vargaDignity = Array.isArray(strengths.vargaDignity) ? strengths.vargaDignity : [];
		const PLANET_CN_SHORT = { Sun: '日', Moon: '月', Mars: '火', Mercury: '水', Jupiter: '木', Venus: '金', Saturn: '土', Rahu: '罗', Ketu: '计' };
		const planetCN = (p)=>PLANET_CN_SHORT[p] || p;
		const fnGrahas = jyotish && jyotish.functionalNature && Array.isArray(jyotish.functionalNature.grahas) ? jyotish.functionalNature.grahas : [];
		const fnMap = {};
		fnGrahas.forEach((g)=>{ fnMap[g.planet] = g; });
		const FN_LABEL = { yogakaraka: 'Yogakaraka', benefic: '功能吉', malefic: '功能凶', neutral: '功能中', maraka: 'Maraka' };
		const FN_CLASS = { yogakaraka: 'is-good', benefic: 'is-good', malefic: 'is-warn', neutral: '', maraka: 'is-warn' };
		const bhavaBala = jyotish && jyotish.bhavaBala ? jyotish.bhavaBala : null;
		const grahaYuddha = jyotish && jyotish.grahaYuddha ? jyotish.grahaYuddha : null;
		return (
			<div className="horosa-india-jyotish-panel">
				{states.length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">行星表（经度/顺逆/宫/宿·pada/Karaka）</div>
						<table className="horosa-india-maitri-table horosa-india-shad-table">
							<thead><tr><th>曜</th><th>星座·度</th><th>R</th><th>宫</th><th>宿·pada</th><th>Karaka</th></tr></thead>
							<tbody>
								{states.map((st)=>{ const kk = karakas.find((k)=>k.planet === st.id); return (
									<tr key={`pt${st.id}`}><th>{st.label}</th>
										<td>{st.signLabel} {formatDegree(st.signlon)}</td><td>{st.retrograde ? 'R' : ''}</td><td>{dispHouse(st.sign, st.house) || '—'}</td><td>{st.nakshatra ? `${st.nakshatra.name}·${st.nakshatra.pada}` : '—'}</td><td>{kk ? (kk.karakaLabel || kk.karaka || '') : ''}</td></tr>
								); })}
							</tbody>
						</table>
					</div>
				) : null}
				{vargaDignity.length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">分盘吉位 Vimśopaka（居自/友/旺的分盘数 → 吉位名,越多越吉）</div>
						<div className="horosa-india-data-list">
							{vargaDignity.map((row)=>{
								const a = row.amsa || {};
								const tag = (label, g)=>{ const x = a[g]; if(!x || !x.count){ return null; } return <span className="horosa-india-flag-badge" key={g}>{label} {x.count}{x.amsa ? `·${x.amsa}` : ''}</span>; };
								const none = !['shadvarga','saptavarga','dasavarga','shodasavarga'].some((g)=>a[g] && a[g].count);
								return (
									<div className="horosa-india-data-row" key={`vd${row.id}`}>
										<strong>{row.label}</strong>
										<span>{DIGNITY_CN[row.d1] || row.d1}</span>
										<em>
											{tag('六', 'shadvarga')}
											{tag('七', 'saptavarga')}
											{tag('十', 'dasavarga')}
											{tag('十六', 'shodasavarga')}
											{none ? <span className="horosa-india-vimsopaka-none">无连座吉位</span> : null}
										</em>
									</div>
								);
							})}
						</div>
					</div>
				) : null}
				{(()=>{
					// P0-8 真 Vimśopaka 20 分力(四组分盘按尊位加权,满分 20)。读 shadbalaBphs[planet].vimsopaka。
					const bphsAll = jyotish && jyotish.shadbalaBphs ? jyotish.shadbalaBphs : null;
					if(!bphsAll){ return null; }
					const order = ['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn'];
					const vpRows = order.filter((p)=>bphsAll[p] && bphsAll[p].vimsopaka);
					if(!vpRows.length){ return null; }
					const GROUPS = [['shadvarga','六盘'],['saptavarga','七盘'],['dasavarga','十盘'],['shodasavarga','十六盘']];
					return (
						<div className="horosa-info-card">
							<div className="horosa-info-card-title">Vimśopaka 20 分力（四组分盘加权,满分 20,越高分盘越强）</div>
							<table className="horosa-india-maitri-table horosa-india-shad-table">
								<thead><tr><th>曜</th>{GROUPS.map((g)=>(<th key={g[0]}>{g[1]}</th>))}</tr></thead>
								<tbody>
									{vpRows.map((p)=>{ const vp = bphsAll[p].vimsopaka; return (
										<tr key={`vp${p}`}><th>{planetCN(p)}</th>
											{GROUPS.map((g)=>{ const d = vp[g[0]]; const v = d ? Number(d.total) : 0; return (<td key={g[0]} className={v >= 15 ? 'is-good' : (v < 7 ? 'is-warn' : '')}>{d ? d.total : '—'}</td>); })}
										</tr>
									); })}
								</tbody>
							</table>
						</div>
					);
				})()}
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">Graha 状态</div>
					<div className="horosa-india-data-list">
						{states.map((item)=>(
							<div className="horosa-india-data-row" key={item.id}>
								<strong>{item.label}</strong>
								<span>{item.signLabel} {formatDegree(item.signlon)} · 宫{dispHouse(item.sign, item.house) || '—'}</span>
								<em>
									{DIGNITY_CN[item.dignity] || item.dignity}
									{item.vargottama ? <span className="horosa-india-flag-badge is-good">Vargottama</span> : null}
									{item.retrograde ? <span className="horosa-india-flag-badge">逆 R</span> : null}
									{item.combust ? <span className="horosa-india-flag-badge is-warn">燃 Asta</span> : null}
									{fnMap[item.id] ? <span className={`horosa-india-flag-badge ${FN_CLASS[fnMap[item.id].functionalNature] || ''}`}>{FN_LABEL[fnMap[item.id].functionalNature] || fnMap[item.id].functionalNature}</span> : null}
									{fnMap[item.id] && fnMap[item.id].isMaraka && fnMap[item.id].functionalNature !== 'maraka' ? <span className="horosa-india-flag-badge is-warn">Maraka</span> : null}
									{fnMap[item.id] && fnMap[item.id].isBadhaka ? <span className="horosa-india-flag-badge">Badhaka</span> : null}
									{item.baladi ? ` · ${item.baladi.label}` : ''}
									{item.jagradadi ? ` · 觉${item.jagradadi.label}` : ''}
									{item.deeptadi ? `/情${item.deeptadi.label}` : ''}
									{item.sayanadi ? ` · 态${item.sayanadi.stateLabel}` : ''}
									{Array.isArray(item.lajjitadi) ? item.lajjitadi.map((la)=>(
										<span className={`horosa-india-flag-badge ${la.nature === 'good' ? 'is-good' : 'is-warn'}`} key={`laj${item.id}${la.key}`}>{la.label} {la.en}</span>
									)) : null}
									{' · '}{item.nakshatra ? `${item.nakshatra.name} P${item.nakshatra.pada}` : '—'}
									{item.nakshatra && item.nakshatra.isAbhijit ? <span className="horosa-india-abhijit-badge">织女 Abhijit</span> : null}
								</em>
							</div>
						))}
					</div>
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">Shadbala</div>
					<div className="horosa-india-data-list">
						{shadbala.map((item)=>(
							<div className="horosa-india-data-row" key={item.id}>
								<strong>{item.label}</strong>
								<span>{item.totalRupa} Rupa · {item.totalVirupa} Virupa</span>
								<em>
									Sthana {item.sthana} · Dig {item.dig} · Chesta {item.chesta}
									{item.ishta !== undefined && item.ishta !== null ? <span className="horosa-india-flag-badge is-good">吉果 {Math.round(item.ishta)}</span> : null}
									{item.kashta !== undefined && item.kashta !== null ? <span className="horosa-india-flag-badge is-warn">凶果 {Math.round(item.kashta)}</span> : null}
								</em>
							</div>
						))}
					</div>
				</div>
				{bhavaBala && bhavaBala.available && Array.isArray(bhavaBala.houses) && bhavaBala.houses.length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">宫位力 Bhava Bala（最强 第{dispHouseByNum(bhavaBala.houses, bhavaBala.strongest, dispHouse)}宫 · 最弱 第{dispHouseByNum(bhavaBala.houses, bhavaBala.weakest, dispHouse)}宫）</div>
						<div className="horosa-india-data-list">
							{bhavaBala.houses.slice().sort((a, b)=>dispHouse(a.sign, a.house) - dispHouse(b.sign, b.house)).map((h)=>(
								<div className="horosa-india-data-row" key={h.house}>
									<strong>第{dispHouse(h.sign, h.house)}宫</strong>
									<span>{typeof h.rupas === 'number' ? h.rupas.toFixed(2) : h.rupas} Rupa · 名次 {h.rank}</span>
									<em>主{planetCN(h.lord)}{Array.isArray(h.occupants) && h.occupants.length ? ` · 居 ${h.occupants.map(planetCN).join('')}` : ''}</em>
								</div>
							))}
						</div>
					</div>
				) : null}
				{grahaYuddha && grahaYuddha.available && Array.isArray(grahaYuddha.pairs) && grahaYuddha.pairs.length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">星曜战 Graha Yuddha（行星近战 &lt;1°）</div>
						<div className="horosa-india-data-list">
							{grahaYuddha.pairs.map((pr, i)=>(
								<div className="horosa-india-data-row" key={i}>
									<strong>{pr.winnerLabel} 胜</strong>
									<span>负 {pr.loserLabel}</span>
									<em>相距 {pr.sepDeg}°</em>
								</div>
							))}
						</div>
					</div>
				) : null}
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">Jaimini Chara Karaka</div>
					<div className="horosa-india-data-list">
						{karakas.map((item)=>(
							<div className="horosa-india-data-row" key={item.karaka}>
								<strong>{item.karaka}</strong>
								<span>{item.label}</span>
								<em>{item.signLabel} {formatDegree(item.signlon)}</em>
							</div>
						))}
					</div>
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">Sthira 固定卡拉卡（双候选取强）</div>
					<div className="horosa-india-data-list">
						{sthiraKaraka.map((item)=>(
							<div className="horosa-india-data-row" key={item.key}>
								<strong>{item.label}</strong>
								<span>{item.planet ? planetCN(item.planet) : (item.candidates || []).map(planetCN).join(' / ')}</span>
								<em>{item.planet ? '定' : '双候选'}</em>
							</div>
						))}
					</div>
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">Graha Drishti</div>
					<div className="horosa-india-data-list">
						{drishti.slice(0, 14).map((item, idx)=>(
							<div className="horosa-india-data-row" key={`${item.giver}_${item.aspectHouse}_${idx}`}>
								<strong>{item.giverLabel}</strong>
								<span>{item.aspectHouse}视 · {item.targetSignLabel}</span>
								<em>{item.receives && item.receives.length ? item.receives.join('、') : '无星体承接'}</em>
							</div>
						))}
					</div>
				</div>
				{nodeDrishti.length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">节点主照 Rasi Drishti</div>
						<div className="horosa-india-data-list">
							{nodeDrishti.map((item, idx)=>(
								<div className="horosa-india-data-row" key={`${item.giver}_${item.targetSign}_${idx}`}>
									<strong>{item.giverLabel}</strong>
									<span>主照 · {item.targetSignLabel}</span>
									<em>{item.receives && item.receives.length ? item.receives.join('、') : '无星体承接'}</em>
								</div>
							))}
						</div>
					</div>
				) : null}
			</div>
		);
	}

	renderAshtakavargaPanel(fields){
		const jyotish = getJyotish(resolveJyotishChartObj(this.state, fields));
		const ashtakavarga = jyotish ? jyotish.ashtakavarga : null;
		if(!ashtakavarga || !ashtakavarga.available){
			return <div className="horosa-india-dasha-empty">暂无 Ashtakavarga 数据</div>;
		}
		const rows = ashtakavarga.sarvaBySign || [];
		const SIGN_ORDER = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
		const SIGN_SHORT = ['白', '金', '双', '巨', '狮', '处', '秤', '蝎', '射', '摩', '瓶', '鱼'];
		const BAV_PLANET_SHORT = { Sun: '日', Moon: '月', Mars: '火', Mercury: '水', Jupiter: '木', Venus: '金', Saturn: '土' };
		const bhinnaKeys = Object.keys(ashtakavarga.bhinna || {});
		const sarva = ashtakavarga.sarva || {};
		const sodhana = ashtakavarga.sodhana || null;
		const kakshya = ashtakavarga.kakshya || null;                 // P0-6 分区 prastara{planet:[12×8]}
		const kakshyaLords = ashtakavarga.kakshyaLords || [];          // 8 段主管次序
		const sodhyaPinda = ashtakavarga.sodhyaPinda || null;          // P0-6 削减后凝量
		const KAK_LORD_SHORT = { Saturn: '土', Jupiter: '木', Mars: '火', Sun: '日', Venus: '金', Mercury: '水', Moon: '月', Lagna: '命' };
		const bphs = jyotish ? jyotish.shadbalaBphs : null;
		const BPHS_PLANETS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
		// 行=曜/列=分量:分量名作列头(英文换行+居中),曜标签1字 → 不横滑全显示。
		const STHANA_PARTS = [{k:'uchcha',l:'旺 Uccha'},{k:'saptavargaja',l:'七盘 Sapta'},{k:'ojayugma',l:'奇偶 Oja'},{k:'kendradi',l:'角宫 Kend'},{k:'drekkana',l:'旬 Drek'},{k:'virupa',l:'小计',bold:true}];
		const KALA_PARTS = [{k:'nathonnatha',l:'昼夜 Nat'},{k:'paksha',l:'月相 Pak'},{k:'tribhaga',l:'三分 Tri'},{k:'vmdh',l:'VMDH'},{k:'ayana',l:'至点 Aya'},{k:'yuddha',l:'战 Yud'},{k:'virupa',l:'小计',bold:true}];
		const num = (v)=>Number(v || 0);
		return (
			<div className="horosa-india-jyotish-panel">
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">Sarvashtakavarga（SAV 和=337）</div>
					<div className="horosa-india-av-grid">
						{rows.map((item)=>(
							<div className="horosa-india-av-cell" key={item.sign}>
								<span>{item.label}</span>
								<strong>{item.bindu}</strong>
							</div>
						))}
					</div>
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">Bhinna Ashtakavarga（12宫×7曜全展示）</div>
					<div className="horosa-india-bav-matrix">
						<div className="horosa-india-bav-row horosa-india-bav-head">
							<span className="horosa-india-bav-rowlabel" />
							{SIGN_SHORT.map((s, i)=>(<span className="horosa-india-bav-cell is-head" key={`h${i}`}>{s}</span>))}
						</div>
						{bhinnaKeys.map((planet)=>{
							const row = ashtakavarga.bhinna[planet] || {};
							return (
								<div className="horosa-india-bav-row" key={planet}>
									<span className="horosa-india-bav-rowlabel">{BAV_PLANET_SHORT[planet] || planet}</span>
									{SIGN_ORDER.map((sign, i)=>{
										const v = row[sign] || 0;
										return <span className="horosa-india-bav-cell" style={{ '--bav': v / 8 }} key={`${planet}${i}`}>{v}</span>;
									})}
								</div>
							);
						})}
						<div className="horosa-india-bav-row horosa-india-bav-sav">
							<span className="horosa-india-bav-rowlabel">和</span>
							{SIGN_ORDER.map((sign, i)=>(<span className="horosa-india-bav-cell is-sav" key={`s${i}`}>{sarva[sign] || 0}</span>))}
						</div>
					</div>
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">Sodhana 缩减 BAV（Trikona + Ekadhipatya）</div>
					{sodhana ? (
						<div className="horosa-india-bav-matrix">
							<div className="horosa-india-bav-row horosa-india-bav-head">
								<span className="horosa-india-bav-rowlabel" />
								{SIGN_SHORT.map((s, i)=>(<span className="horosa-india-bav-cell is-head" key={`soh${i}`}>{s}</span>))}
							</div>
							{Object.keys(sodhana).map((planet)=>(
								<div className="horosa-india-bav-row" key={`so${planet}`}>
									<span className="horosa-india-bav-rowlabel">{BAV_PLANET_SHORT[planet] || planet}</span>
									{(sodhana[planet] || []).map((v, i)=>(<span className="horosa-india-bav-cell" style={{ '--bav': num(v) / 8 }} key={`so${planet}${i}`}>{v}</span>))}
								</div>
							))}
						</div>
					) : <div className="horosa-india-dasha-empty">无 Sodhana 数据</div>}
				</div>
				{sodhyaPinda ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Sodhya Pinda 凝量（削减后 BAV × 座/曜乘数 · 定时/寿命用）</div>
						<table className="horosa-india-maitri-table horosa-india-shad-table">
							<thead><tr><th>曜</th><th>Rasi Pinda</th><th>Graha Pinda</th><th>Sodhya 合</th></tr></thead>
							<tbody>
								{BPHS_PLANETS.filter((p)=>sodhyaPinda[p]).map((p)=>{ const d = sodhyaPinda[p]; return (
									<tr key={`sp${p}`}><th>{BAV_PLANET_SHORT[p] || p}</th><td>{d.rasiPinda}</td><td>{d.grahaPinda}</td><td><strong>{d.total}</strong></td></tr>
								); })}
							</tbody>
						</table>
					</div>
				) : null}
				{kakshya && kakshyaLords.length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Kakshya 分区 prastara（每座 8 段主管是否贡献 bindu · 过运落段命中=吉）</div>
						<div className="horosa-india-card-note">段序主管:{kakshyaLords.map((l, i)=>`${i + 1}${KAK_LORD_SHORT[l] || l}`).join(' · ')}</div>
						{BPHS_PLANETS.filter((p)=>Array.isArray(kakshya[p])).map((p)=>(
							<div className="horosa-india-bav-matrix" key={`kak${p}`}>
								<div className="horosa-india-bav-row horosa-india-bav-head">
									<span className="horosa-india-bav-rowlabel">{BAV_PLANET_SHORT[p] || p}</span>
									{SIGN_SHORT.map((s, i)=>(<span className="horosa-india-bav-cell is-head" key={`kh${p}${i}`}>{s}</span>))}
								</div>
								{kakshyaLords.map((lord, li)=>(
									<div className="horosa-india-bav-row" key={`kak${p}${lord}`}>
										<span className="horosa-india-bav-rowlabel">{KAK_LORD_SHORT[lord] || lord}</span>
										{(kakshya[p] || []).map((cells, si)=>{ const on = cells && cells[li]; return (<span className={`horosa-india-bav-cell${on ? ' is-on' : ''}`} style={{ '--bav': on ? 1 : 0 }} key={`kc${p}${si}`}>{on ? '●' : '·'}</span>); })}
									</div>
								))}
							</div>
						))}
					</div>
				) : null}
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">真·BPHS 六力 Shadbala{bphs && bphs.anyPending ? <span className="horosa-india-source-tag">部分子项待权威数表</span> : null}</div>
					{bphs ? (
						<div className="horosa-india-data-list">
							{BPHS_PLANETS.map((p)=>{
								const b = bphs[p];
								if(!b){ return null; }
								return (
									<div className="horosa-india-data-row" key={`bphs${p}`}>
										<strong>{BAV_PLANET_SHORT[p] || p}</strong>
										<span>{num(b.totalVirupa).toFixed(0)} Virupa · {num(b.rupas).toFixed(2)} Rupa</span>
										<em>位{num(b.sthana && b.sthana.virupa).toFixed(0)}·向{num(b.dig).toFixed(0)}·时{num(b.kala && b.kala.virupa).toFixed(0)}·自{num(b.naisargika).toFixed(0)}{b.sufficient === false ? ' · 力弱' : ''}</em>
									</div>
								);
							})}
						</div>
					) : <div className="horosa-india-dasha-empty">无 BPHS 六力数据</div>}
				</div>
				{bphs ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Sthāna 位置力分量（Virupa · 行=曜/列=分量）</div>
						<table className="horosa-india-maitri-table horosa-india-shad-table horosa-india-shad-table-wrap">
							<thead><tr><th>曜</th>{STHANA_PARTS.map((c)=>(<th key={c.k} className={c.bold ? 'is-sum' : ''}>{c.l}</th>))}</tr></thead>
							<tbody>
								{BPHS_PLANETS.map((p)=>(
									<tr key={p}><th>{BAV_PLANET_SHORT[p] || p}</th>{STHANA_PARTS.map((c)=>{ const st = (bphs[p] || {}).sthana || {}; const v = num(st[c.k]).toFixed(1); return <td key={c.k}>{c.bold ? <strong>{v}</strong> : v}</td>; })}</tr>
								))}
							</tbody>
						</table>
					</div>
				) : null}
				{bphs ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Kāla 时间力分量（行=曜/列=分量 · VMDH=年月+日+时）</div>
						<table className="horosa-india-maitri-table horosa-india-shad-table horosa-india-shad-table-wrap">
							<thead><tr><th>曜</th>{KALA_PARTS.map((c)=>(<th key={c.k} className={c.bold ? 'is-sum' : ''}>{c.l}</th>))}</tr></thead>
							<tbody>
								{BPHS_PLANETS.map((p)=>(
									<tr key={p}><th>{BAV_PLANET_SHORT[p] || p}</th>{KALA_PARTS.map((c)=>{ const ka = (bphs[p] || {}).kala || {}; const v = (c.k === 'vmdh' ? (num(ka.abdaMasa) + num(ka.vara) + num(ka.hora)) : num(ka[c.k])).toFixed(1); return <td key={c.k}>{c.bold ? <strong>{v}</strong> : v}</td>; })}</tr>
								))}
							</tbody>
						</table>
					</div>
				) : null}
			</div>
		);
	}

	renderYogaPanel(fields){
		const jyotish = getJyotish(resolveJyotishChartObj(this.state, fields));
		const yogas = jyotish ? jyotish.yogas : null;
		if(!yogas){
			return <div className="horosa-india-dasha-empty">Yoga 计算中...</div>;
		}
		if(yogas.available === false){
			return <div className="horosa-india-dasha-empty">Yoga 暂不可用：{yogas.error || yogas.reason || '后端未返回数据'}</div>;
		}
		const items = Array.isArray(yogas.items) ? yogas.items : [];
		const summary = yogas.summary || {};
		const grouped = items.reduce((map, item)=>{
			const category = item.category || 'Other';
			if(!map[category]){
				map[category] = [];
			}
			map[category].push(item);
			return map;
		}, {});
		const categories = Object.keys(grouped).sort((a, b)=>{
			const ai = YOGA_CATEGORY_ORDER.indexOf(a);
			const bi = YOGA_CATEGORY_ORDER.indexOf(b);
			const av = ai >= 0 ? ai : 99;
			const bv = bi >= 0 ? bi : 99;
			if(av !== bv){
				return av - bv;
			}
			return a.localeCompare(b);
		});
		return (
			<div className="horosa-india-jyotish-panel">
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">Yoga 命盘组合</div>
					<div className="horosa-info-row"><span>规则目录</span><strong>{yogas.engine && yogas.engine.catalogVersion ? yogas.engine.catalogVersion : 'core_yoga_catalog'}</strong></div>
					<div className="horosa-info-row"><span>命中总数</span><strong>{summary.total || items.length}</strong></div>
					<div className="horosa-info-row"><span>强/中/弱</span><strong>{summary.strong || 0} / {summary.medium || 0} / {summary.weak || 0}</strong></div>
					<div className="horosa-info-row"><span>口径</span><strong>D1 Rashi 盘为主，按星座/宫位/照射/交换判定</strong></div>
				</div>
				{categories.length ? categories.map((category)=>(
					<div className="horosa-info-card" key={category}>
						<div className="horosa-info-card-title">{YOGA_CATEGORY_LABELS[category] || category}</div>
						<div className="horosa-india-data-list">
							{grouped[category].map((item)=>(
								<div className="horosa-india-data-row" key={item.id}>
									<strong>{item.zhName || item.name}</strong>
									<span>{item.name} · {item.levelLabel || item.level || '—'} · {item.score || 0}</span>
									<em>{Array.isArray(item.evidence) && item.evidence.length ? item.evidence.slice(0, 2).join('；') : item.result || '—'}</em>
								</div>
							))}
						</div>
					</div>
				)) : (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">命中 Yoga</div>
						<div className="horosa-india-dasha-empty">当前规则目录未命中可显示的 Yoga</div>
					</div>
				)}
				{jyotish.kartari && jyotish.kartari.available && Array.isArray(jyotish.kartari.yogas) && jyotish.kartari.yogas.length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Kartari 夹击格局</div>
						<div className="horosa-india-data-list">
							{jyotish.kartari.yogas.map((y, i)=>(
								<div className="horosa-india-data-row" key={`kt${i}`}>
									<strong>{y.targetLabel}</strong>
									<span><span className={y.type === 'shubha' ? 'horosa-india-flag-badge is-good' : 'horosa-india-flag-badge is-warn'}>{y.typeLabel}</span></span>
									<em>{(y.prevLabels || []).join('')} 夹 {(y.nextLabels || []).join('')}</em>
								</div>
							))}
						</div>
					</div>
				) : null}
				{jyotish.sudarshana && jyotish.sudarshana.available && Array.isArray(jyotish.sudarshana.rows) && jyotish.sudarshana.rows.length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Sudarshana 三盘合参（命 {jyotish.sudarshana.lagnaSign} · 日 {jyotish.sudarshana.sunSign} · 月 {jyotish.sudarshana.moonSign}）</div>
						<div className="horosa-india-data-list">
							<div className="horosa-india-data-row" style={{ opacity: 0.6 }}><strong>星曜</strong><span>命宫起 / 太阳起</span><em>月亮起</em></div>
							{jyotish.sudarshana.rows.map((r)=>(
								<div className="horosa-india-data-row" key={r.planet}>
									<strong>{r.planetLabel}</strong>
									<span>第{r.houseFromLagna}宫 / 第{r.houseFromSun}宫</span>
									<em>第{r.houseFromMoon}宫</em>
								</div>
							))}
						</div>
					</div>
				) : null}
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">规则说明</div>
					<div className="horosa-india-data-list">
						{(yogas.notes || []).map((note, idx)=>(
							<div className="horosa-india-data-row" key={`note_${idx}`}>
								<strong>说明{idx + 1}</strong>
								<span>{note}</span>
								<em>{idx === 0 ? '命盘 Yoga 与 Panchanga Yoga 已分开' : '可继续扩展规则目录'}</em>
							</div>
						))}
					</div>
				</div>
			</div>
		);
	}

	renderKpMuhurtaPanel(fields){
		const jyotish = getJyotish(resolveJyotishChartObj(this.state, fields));
		const kp = jyotish ? jyotish.kp : null;
		const muhurta = jyotish ? jyotish.muhurta : null;
		const sublords = kp && kp.sublords ? kp.sublords : {};
		const kpLevels = kp && kp.kpLevels ? kp.kpLevels : {};
		const cuspalSubLords = kp && Array.isArray(kp.cuspalSubLords) ? kp.cuspalSubLords : [];
		const rulingPlanets = kp && kp.rulingPlanets ? kp.rulingPlanets : null;
		const kpSignificators = kp && kp.significators ? kp.significators : null;
		const KP_LORD_CN = { Sun: '太阳', Moon: '月亮', Mars: '火星', Mercury: '水星', Jupiter: '木星', Venus: '金星', Saturn: '土星', Rahu: '罗睺', Ketu: '计都', 'North Node': '罗睺', 'South Node': '计都' };
		const kpl = (x)=>KP_LORD_CN[x] || x || '—';
		const prasna = jyotish && jyotish.prasna && jyotish.prasna.available ? jyotish.prasna : null;   // Praśna 卜卦 KP249
		const SIGN_CN_KP = { Aries: '白羊', Taurus: '金牛', Gemini: '双子', Cancer: '巨蟹', Leo: '狮子', Virgo: '处女', Libra: '天秤', Scorpio: '天蝎', Sagittarius: '射手', Capricorn: '摩羯', Aquarius: '水瓶', Pisces: '双鱼' };
		return (
			<div className="horosa-india-jyotish-panel">
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">KP Sublord</div>
					<div className="horosa-india-data-list">
						{Object.keys(sublords).map((key)=>(
							<div className="horosa-india-data-row" key={key}>
								<strong>{key}</strong>
								<span>{sublords[key].starLord ? sublords[key].starLord.label : '—'} / {sublords[key].subLord ? sublords[key].subLord.label : '—'}</span>
								<em>{sublords[key].nakshatra ? `${sublords[key].nakshatra.name} P${sublords[key].nakshatra.pada}` : '—'}</em>
							</div>
						))}
					</div>
				</div>
				{Object.keys(kpLevels).length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">KP 六级细分（Nak ⊃ Sub ⊃ Prati ⊃ Sook ⊃ Praana ⊃ Deha）</div>
						<div className="horosa-india-data-list">
							{Object.keys(kpLevels).map((pk)=>{
								const lv = kpLevels[pk] || {};
								return (
									<div className="horosa-india-data-row" key={pk}>
										<strong>{kpl(pk)}</strong>
										<span>{kpl(lv.Nak)} · {kpl(lv.Sub)} · {kpl(lv.Prati)}</span>
										<em>{kpl(lv.Sook)} · {kpl(lv.Praana)} · {kpl(lv.Deha)}</em>
									</div>
								);
							})}
						</div>
					</div>
				) : null}
				{cuspalSubLords.length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">宫头次主星 Cuspal Sub Lords（{kp && kp.cuspMode === 'equal_from_asc' ? '等宫近似' : ((kp && kp.cuspMode) || '—')}）</div>
						<div className="horosa-india-data-list">
							{cuspalSubLords.map((c)=>(
								<div className="horosa-india-data-row" key={c.house}>
									<strong>第{c.house}宫</strong>
									<span>{kpl(c.starLord)} / {kpl(c.subLord)}</span>
									<em>{formatDegree(c.cuspLon)}</em>
								</div>
							))}
						</div>
					</div>
				) : null}
				{rulingPlanets ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">当令星 Ruling Planets</div>
						<div className="horosa-info-row"><span>命主座主 / 月宿主</span><strong>{kpl(rulingPlanets.lagnaSignLord)} / {kpl(rulingPlanets.lagnaNakLord)}</strong></div>
						<div className="horosa-info-row"><span>月座主 / 月宿主</span><strong>{kpl(rulingPlanets.moonSignLord)} / {kpl(rulingPlanets.moonNakLord)}</strong></div>
						<div className="horosa-info-row"><span>星期主</span><strong>{kpl(rulingPlanets.weekdayLord)}</strong></div>
						<div className="horosa-info-row"><span>当令集</span><strong>{(rulingPlanets.set || []).map(kpl).join('、')}</strong></div>
					</div>
				) : null}
				{kpSignificators ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">意义者 Significators（四重 A&gt;B&gt;C&gt;D · 该曜所司之宫）</div>
						<div className="horosa-india-data-list">
							{Object.keys(kpSignificators).map((pk)=>{
								const sg = kpSignificators[pk] || {};
								return (
									<div className="horosa-india-data-row" key={pk}>
										<strong>{kpl(pk)}</strong>
										<span>司宫 {(sg.ranked || []).join(" · ")}</span>
										<em>主A {(sg.A || []).length ? (sg.A || []).join("/") : "—"}</em>
									</div>
								);
							})}
						</div>
					</div>
				) : null}
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">Muhurta</div>
					{muhurta && muhurta.available !== false ? (
						<>
							<div className="horosa-info-row"><span>日出</span><strong>{muhurta.sunrise || '—'}</strong></div>
							<div className="horosa-info-row"><span>日落</span><strong>{muhurta.sunset || '—'}</strong></div>
							<div className="horosa-info-row"><span>Rahu Kalam</span><strong>{muhurta.rahuKalam ? `${muhurta.rahuKalam.start} - ${muhurta.rahuKalam.end}` : '—'}</strong></div>
							<div className="horosa-info-row"><span>Yamaganda</span><strong>{muhurta.yamaganda ? `${muhurta.yamaganda.start} - ${muhurta.yamaganda.end}` : '—'}</strong></div>
							<div className="horosa-info-row"><span>Gulika</span><strong>{muhurta.gulika ? `${muhurta.gulika.start} - ${muhurta.gulika.end}` : '—'}</strong></div>
							{muhurta.birthMuhurta ? (
								<div className="horosa-info-row"><span>出生须臾</span><strong>{muhurta.birthMuhurta.name}（{muhurta.birthMuhurta.nameEn}）· {muhurta.birthMuhurta.nature === 'auspicious' ? '吉' : (muhurta.birthMuhurta.nature === 'inauspicious' ? '凶' : '中')}{muhurta.birthMuhurta.isAbhijit ? ' · Abhijit 吉' : ''}</strong></div>
							) : null}
							{muhurta.panchaka ? (
								<div className="horosa-info-row"><span>Panchaka 五忌</span><strong className={muhurta.panchaka.isPanchaka ? 'is-warn' : 'is-good'}>{muhurta.panchaka.typeLabel}（余{muhurta.panchaka.remainder}）</strong></div>
							) : null}
							{muhurta.abhijit ? (
								<div className="horosa-info-row"><span>Abhijit 须臾</span><strong className={muhurta.abhijit.auspicious ? 'is-good' : 'is-warn'}>第 8 昼须臾 · {muhurta.abhijit.auspicious ? '大吉' : '周三不取'}</strong></div>
							) : null}
						</>
					) : (
						<div className="horosa-india-dasha-empty">暂无择时数据</div>
					)}
				</div>
				{(()=>{
					// P0-7 Hora 行星时表(昼夜各 12 段;日出首段=当日 vara 主,后按 Chaldean 序循环)。
					const ht = muhurta && muhurta.horaTable;
					if(!ht || !Array.isArray(ht.rows) || !ht.rows.length){ return null; }
					const day = ht.rows.filter((r)=>r.period === 'day');
					const night = ht.rows.filter((r)=>r.period === 'night');
					const fmtTime = (s)=>{ if(!s){ return '—'; } const m = String(s).match(/(\d{1,2}:\d{2})/); return m ? m[1] : s; };
					return (
						<div className="horosa-info-card">
							<div className="horosa-info-card-title">Hora 行星时（昼夜各 12 段 · 日出首段=当日 vara 主,Chaldean 序）</div>
							<div className="horosa-india-period-grid">
								{[['昼（日出→日落）', day], ['夜（日落→次日出）', night]].map((pair)=>(
									<table className="horosa-india-maitri-table horosa-india-shad-table" key={pair[0]}>
										<thead><tr><th colSpan={3}>{pair[0]}</th></tr><tr><th>段</th><th>主</th><th>起</th></tr></thead>
										<tbody>
											{pair[1].map((r)=>(<tr key={`h${r.index}`}><td>{r.index}</td><th>{r.lordCN || r.lord}</th><td>{fmtTime(r.start)}</td></tr>))}
										</tbody>
									</table>
								))}
							</div>
						</div>
					);
				})()}
				{(()=>{
					// P1 Choghadia 民用择时(昼夜各 8 段;吉:甘露/吉/利/动,凶:病/时/扰)。
					const cg = muhurta && muhurta.choghadia;
					if(!cg || !Array.isArray(cg.rows) || !cg.rows.length){ return null; }
					const day = cg.rows.filter((r)=>r.period === 'day');
					const night = cg.rows.filter((r)=>r.period === 'night');
					const fmtTime = (s)=>{ if(!s){ return '—'; } const m = String(s).match(/(\d{1,2}:\d{2})/); return m ? m[1] : s; };
					const PCN = { Sun: '日', Moon: '月', Mars: '火', Mercury: '水', Jupiter: '木', Venus: '金', Saturn: '土' };
					return (
						<div className="horosa-info-card">
							<div className="horosa-info-card-title">Choghadia 民用择时（昼夜各 8 段 · 吉:甘露/吉/利/动 · 凶:病/时/扰）</div>
							<div className="horosa-india-period-grid">
								{[['昼（日出→日落）', day], ['夜（日落→次日出）', night]].map((pair)=>(
									<table className="horosa-india-maitri-table horosa-india-shad-table" key={pair[0]}>
										<thead><tr><th colSpan={3}>{pair[0]}</th></tr><tr><th>段</th><th>类</th><th>起</th></tr></thead>
										<tbody>
											{pair[1].map((r)=>(
												<tr key={`cg${r.period}${r.index}`}>
													<td>{r.index}</td>
													<th className={r.nature === 'good' ? 'is-good' : (r.nature === 'bad' ? 'is-warn' : '')}>{r.cn}{r.key ? `·${r.key}` : ''} {PCN[r.planet] || ''}</th>
													<td>{fmtTime(r.start)}</td>
												</tr>
											))}
										</tbody>
									</table>
								))}
							</div>
						</div>
					);
				})()}
				{prasna && Array.isArray(prasna.table) && prasna.table.length ? (()=>{
					const n = Math.min(249, Math.max(1, this.state.prasnaNumber || 1));
					const row = prasna.table.find((r)=>r.index === n) || prasna.table[0];
					const base = row ? Math.floor(row.startLon / 30) * 30 : 0;
					return (
						<div className="horosa-info-card">
							<div className="horosa-info-card-title">Praśna 卜卦（KP 问数 1-249 → 问时上升）</div>
							<div className="horosa-india-transit-row">
								<span className="horosa-india-transit-label">问数</span>
								<InputNumber min={1} max={249} precision={0} value={this.state.prasnaNumber || 1} onChange={(v)=>this.setState({ prasnaNumber: v })} size="small" className="horosa-india-transit-datepicker" />
							</div>
							{row ? (
								<div className="horosa-india-data-list">
									<div className="horosa-india-data-row"><strong>上升落座</strong><span>{SIGN_CN_KP[row.sign] || row.sign}</span><em>{(row.startLon - base).toFixed(1)}°–{(row.endLon - base).toFixed(1)}°</em></div>
									<div className="horosa-india-data-row"><strong>星宿 · 星主</strong><span>{row.nakName}</span><em>{kpl(row.starLord)}</em></div>
									<div className="horosa-india-data-row"><strong>子主链</strong><span>座主 {kpl(row.signLord)} · 星主 {kpl(row.starLord)}</span><em>子主 {kpl(row.subLord)}</em></div>
								</div>
							) : null}
							<div className="horosa-india-card-note">{prasna.note}</div>
						</div>
					);
				})() : null}
			</div>
		);
	}

	// 快捷栏契约:原 9 键全部与页面既有控件重复(分盘 tab=分盘目录、北/南/东印=盘面头部
	// XQSegmented、大运/Yoga=右栏 tab、并列 2×2=盘面头部开关),按「页面已有的不进栏」
	// 公理整条撤除;命例保存页头已有,故只留 AI。
	renderQuickDock(){
		return (
			<QuickDockBar
				page="india"
				className="horosa-india-quick-dock"
				hasResult={!!this.props.value}
				dispatch={this.props.dispatch}
			/>
		);
	}

	renderDashaSubPopover(item, extraClassName = '', style = null){
		const subItems = buildDashaSubPeriods(item);
		return (
			<div className={`horosa-india-dasha-subpanel${extraClassName}`} style={style || undefined}>
				<div className="horosa-india-dasha-subtitle">
					<strong>{item.lord.label}</strong>
					<span>{item.lord.en} Antardasha</span>
				</div>
				<div className="horosa-india-dasha-sublist">
					{subItems.map((subItem, idx)=>(
						<div className="horosa-india-dasha-subitem" key={`${item.lord.key}_${subItem.lord.key}_${idx}`}>
							<div className="horosa-india-dasha-subname">
								<strong>{subItem.lord.label}</strong>
								<span>{subItem.lord.en}</span>
							</div>
							<div className="horosa-india-dasha-submeta">
								<span>{formatJyotishDate(subItem.start)} - {formatJyotishDate(subItem.end)}</span>
								<em>{formatDuration(subItem.years)}</em>
							</div>
							{Array.isArray(subItem.pratyantardashas) && subItem.pratyantardashas.length ? (
								<div className="horosa-india-dasha-pratyantar">
									{subItem.pratyantardashas.map((p, pIdx)=>{
										const pl = normalizeDashaLord(p.lord);
										return (
											<div className="horosa-india-dasha-pratyantar-row" key={`prat_${pIdx}`}>
												<span>{pl.label}</span>
												<em>{formatJyotishDate(moment(p.start))} - {formatJyotishDate(moment(p.end))}</em>
											</div>
										);
									})}
								</div>
							) : null}
						</div>
					))}
				</div>
			</div>
		);
	}

	renderDashaFloatingPopover(){
		if(!this.state.dashaPopoverItem || !this.state.dashaPopoverStyle || typeof document === 'undefined' || !document.body){
			return null;
		}
		return createPortal(
			this.renderDashaSubPopover(this.state.dashaPopoverItem, ' is-floating', this.state.dashaPopoverStyle),
			document.body
		);
	}

	render(){
		let fields = this.withIndiaOptionFields(this.props.fields);
		const indiaHsys = fields.indiaHsys
			? AstroConst.normalizeIndiaHouseSystem(fields.indiaHsys.value)
			: AstroConst.INDIA_HOUSE_SYSTEM_DEFAULT;
		const indiaAyanamsa = fields.indiaAyanamsa
			? AstroConst.normalizeIndiaAyanamsa(fields.indiaAyanamsa.value)
			: AstroConst.INDIA_AYANAMSA_DEFAULT;
		const indiaNodeType = fields.indiaNodeType
			? AstroConst.normalizeIndiaNodeType(fields.indiaNodeType.value)
			: AstroConst.INDIA_NODE_TYPE_DEFAULT;
		let jyotishFields = this.state.activeJyotishFields || fields;
		let chartHeight = '100%';
		// horosa_india_settings_memo_v1:原地 new DateTime() 改走实例 memo(逻辑逐字同源,
		// 见 resolveDateTime),使左栏设置面板的 value prop 引用稳定。
		const datetm = this.resolveDateTime(fields);
			const currentHook = this.state.hook[this.state.currentTab] || this.state.hook.Natal;
			const indiaChartStyle = AstroConst.normalizeIndiaChartStyle(this.props.indiaChartStyle);
			const degreeDisplayMode = this.state.degreeDisplayMode || INDIA_DEGREE_DISPLAY_DEGREE;
			const indiaPlanetDisplayMode = AstroConst.normalizeIndiaPlanetDisplay(this.state.indiaPlanetDisplayMode);
			const indiaCounterClockwise = this.state.indiaCounterClockwise !== false;
			const indiaLockAquarius = !!this.state.indiaLockAquarius;
			const indiaLagnaRef = AstroConst.normalizeIndiaLagnaRef(this.state.indiaLagnaRef);
			// horosa_india_settings_memo_v1:splitItems/splitOptions 原每帧重建两个数组
			// (内容恒定,只是引用每次都变 → 「当前分盘」Select 的 options 白重建、memo 恒失配)。
			// 改走 resolveSplitItems 一次性 memo,内容逐字同源。
			const splitItems = this.resolveSplitItems();
			const splitOptions = this._splitOptionsMemo;

			return (
			<div className="horosa-india-chart-main horosa-astro-redesign horosa-india-redesign">
				<div className="horosa-astro-layout horosa-astro-redesign-layout horosa-india-redesign-layout">
					<div className="horosa-astro-redesign-grid horosa-india-redesign-grid">
						{/* horosa_india_settings_memo_v1:左栏整块搬进 React.memo 子组件(JSX 逐字同源,
						    只把 this.state/this.<handler> 换成同名 prop)。右栏局部 state(展开小运/点星高亮/
						    钻取/换子页签/敲年份)变化时本块 props 全等 → 0 次重渲;设置值或 fields 一变即重渲。 */}
						<IndiaSettingsPanel
							fields={fields}
							datetm={datetm}
							onTimeChange={this.changeTime}
							timeHook={this.tmHook}
							onGeoChange={this.changeGeo}
							indiaSchool={this.state.indiaSchool}
							onSchoolChange={this.changeIndiaSchool}
							indiaAyanamsa={indiaAyanamsa}
							onAyanamsaChange={this.changeIndiaAyanamsa}
							indiaHsys={indiaHsys}
							onHsysChange={this.changeHsys}
							indiaNodeType={indiaNodeType}
							onNodeTypeChange={this.changeIndiaNodeType}
							currentTab={this.state.currentTab}
							onTabChange={this.changeTab}
							splitOptions={splitOptions}
							degreeDisplayMode={degreeDisplayMode}
							onDegreeDisplayModeChange={this.changeDegreeDisplayMode}
							vargaSetOpen={this.state.vargaSetOpen}
							onToggleVargaSet={this.toggleVargaSet}
							vargaSetFractals={this.state.vargaSetFractals}
							onVargaSetFractalsChange={this.changeVargaSetFractals}
							indiaChartStyle={indiaChartStyle}
							onChartStyleChange={this.changeIndiaChartStyle}
							indiaLagnaRef={indiaLagnaRef}
							onLagnaRefChange={this.changeIndiaLagnaRef}
							indiaPlanetDisplayMode={indiaPlanetDisplayMode}
							onPlanetDisplayModeChange={this.changeIndiaPlanetDisplayMode}
							indiaCounterClockwise={indiaCounterClockwise}
							onCounterClockwiseChange={this.changeIndiaCounterClockwiseSelect}
						/>
						<div className={`horosa-chart-stage horosa-chart-stage-redesign horosa-india-chart-panel${this.state.vargaSetOpen ? ' horosa-india-varga-grid-stage' : ''}`} style={{ position: 'relative' }}>
							{/* keep-stale 轻量角标:后台重取中且有旧盘可显时,角落提示「更新中…」(非阻塞、不盖盘、不挡操作);
							    替代原满屏「等待排盘数据/载入中/大运计算中」大框。首次加载(无 lastChartObj)走盘自身占位/dashaLoading。 */}
							{this.state.dashaUpdating && this.state.lastChartObj ? (
								<div style={{ position: 'absolute', top: 10, right: 14, zIndex: 6, fontSize: 11.5, lineHeight: '18px', color: 'var(--horosa-text-muted, rgba(180,184,196,0.92))', background: 'var(--horosa-panel-soft, rgba(20,22,28,0.72))', border: '1px solid var(--horosa-border, rgba(255,255,255,0.12))', padding: '2px 10px', borderRadius: 11, pointerEvents: 'none', WebkitBackdropFilter: 'blur(2px)', backdropFilter: 'blur(2px)' }}>更新中…</div>
							) : null}
							{this.state.vargaSetOpen
								? this.renderVargaGrid(fields, { indiaChartStyle, indiaAyanamsa, indiaHsys, indiaNodeType, degreeDisplayMode, indiaPlanetDisplayMode, indiaCounterClockwise, indiaLockAquarius, indiaLagnaRef })
								: (
								<IndiaChart
									key={`${this.state.currentTab}_${indiaChartStyle}_${indiaAyanamsa}_${indiaHsys}_${indiaNodeType}`}
									chartOnly
									suppressFetch={!this.state.vargaSetOpen}
									chartObj={this.state.mainChartObj || this.state.lastChartObj}
									aspectSourceId={this.state.indiaAspectSource}
									aspectParadigm={this.state.indiaAspectParadigm}
									onPlanetClick={this.toggleIndiaAspect}
									ref={(node)=>{ this.mainIndiaChartRef = node; }}
									chartnum={currentHook.fractal}
							onChange={this.onFieldsChange}
								fields={fields}
								height={chartHeight}
									chartDisplay={this.props.chartDisplay}
										indiaChartStyle={indiaChartStyle}
										indiaAyanamsa={indiaAyanamsa}
										indiaHsys={indiaHsys}
										indiaNodeType={indiaNodeType}
										degreeDisplayMode={degreeDisplayMode}
										planetGlyphMode={indiaPlanetDisplayMode}
										counterClockwise={indiaCounterClockwise}
										lockAquarius={indiaLockAquarius}
										lagnaRef={indiaLagnaRef}
										planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
								hook={currentHook}
								dispatch={this.props.dispatch}
								onChartLoad={this.handleMainChartLoad}
							/>
								)}
						</div>
						<div className="horosa-inspector-panel horosa-astro-content-panel horosa-india-info-panel">
							<Tabs activeKey={this.state.jyotishTab} onChange={this.changeJyotishTab} tabPosition="top" className="horosa-content-tabs horosa-india-tabs">
								{[
									{ key: '1', tab: '分盘', content: ()=>(
										<div className="horosa-india-split-page">
										<div className="horosa-india-split-list">
											<button
												type="button"
												className={`horosa-india-split-button${this.state.currentTab === 'Natal' ? ' is-active' : ''}`}
												onClick={()=>this.changeTab('Natal')}
											>
												<strong>D1</strong>
												<span>命盘</span>
											</button>
											{splitItems.map((item)=>(
												<button
													type="button"
													key={item.key}
													className={`horosa-india-split-button${this.state.currentTab === item.key ? ' is-active' : ''}`}
													onClick={()=>this.changeTab(item.key)}
												>
													<strong>D{item.fractal}</strong>
													<span>{item.txt || `${item.fractal}分盘`}</span>
												</button>
											))}
										</div>
										{this.renderVargaAnalysisCards(jyotishFields)}
									</div>
									) },
									{ key: '2', tab: '五支', content: ()=>this.renderPanchangaPanel(jyotishFields) },
									{ key: '3', tab: '大运', content: ()=>this.renderDashaPanel(jyotishFields) },
									{ key: '4', tab: '星曜', content: ()=>this.renderPlanetStatePanel(jyotishFields) },
									{ key: '5', tab: '八分', content: ()=>this.renderAshtakavargaPanel(jyotishFields) },
									{ key: '6', tab: 'KP/择时', content: ()=>this.renderKpMuhurtaPanel(jyotishFields) },
									{ key: '7', tab: 'Yoga', content: ()=>this.renderYogaPanel(jyotishFields) },
									{ key: '8', tab: '副星', content: ()=>this.renderUpagrahaPanel(jyotishFields) },
									{ key: '9', tab: '映象', content: ()=>this.renderJaiminiPanel(jyotishFields) },
									{ key: '10', tab: '行运', content: ()=>this.renderGocharaPanel(jyotishFields) },
									{ key: '11', tab: '年度', content: ()=>this.renderTajakaPanel(jyotishFields) },
									{ key: '12', tab: '化解', content: ()=>this.renderRemediesPanel(jyotishFields) },
									{ key: '13', tab: '敌友', content: ()=>this.renderMaitriPanel(jyotishFields) },
								].filter((t)=>this.state.visibleTabKeys.indexOf(t.key) >= 0).map((t)=>(
									// 惰性 content:仅当前活动 tab 构建面板(其余 antd 本就不挂载,此处连「建好再丢」也省去)。
									// 各面板是 this.state+图数据的纯派生(无 pane 内部 state),激活时重建结果逐字一致、不丢状态。
									<TabPane tab={t.tab} key={t.key}>{t.key === this.state.jyotishTab ? t.content() : null}</TabPane>
								))}
							</Tabs>
						</div>
					</div>
					{this.renderQuickDock()}
				</div>
			</div>
		);
	}
}

export default IndiaChartMain;
