// 印占页 · 大运推算:年长、星宿与大运序、出生时刻、年数加减、子运、条件 / Chara / AKKG / Vimshottari 大运。
// 只被 components/astro/IndiaChartMain.js 与同目录 indiaMain/ 下的兄弟模块引用。
import moment from 'moment';
import * as AstroConst from '../../../constants/AstroConst';
import { DASHA_CONDITIONAL_KEYS } from './optionState';
import { civilJdnOfYmd, civilYmdOfJdn, gregJdnOfYmd, gregYmdOfJdn } from '../../../utils/civilCalendar';
import { parseDateTimeParts, parseLocalDateTimeMs } from '../../../utils/dateTimeParse';
import { segmentIndex } from '../../../utils/segmentIndex';
import { momentOfCivilDateTimeStr } from '../../../utils/civilMoment';
import { zoneOffsetMinutesOf } from '../../../utils/zoneOffset';

export const DASHA_YEAR_DAYS = 365.25;
// G5:后端实际所用年长(从 chartObj.jyotish.dasha.vimshottari.yearLengthDays 读回同步)。
// 🔴 单一真值源:5 级钻取的客户端自算段若与后端年长不一致,深层起讫会错位。
let _activeDashaYearDays = DASHA_YEAR_DAYS;
export function currentDashaYearDays(){ return _activeDashaYearDays; }
export function syncDashaYearDays(chartObj){
	const d = chartObj && chartObj.jyotish && chartObj.jyotish.dasha;
	const v = d && d.vimshottari && Number(d.vimshottari.yearLengthDays);
	_activeDashaYearDays = (Number.isFinite(v) && v > 0) ? v : DASHA_YEAR_DAYS;
}
const NAKSHATRA_SIZE = 360 / 27;
export const INDIA_DEGREE_DISPLAY_DEGREE = 'degree';
export const INDIA_DEGREE_DISPLAY_FULL = 'full';
export const INDIA_DEGREE_DISPLAY_OPTIONS = [
	{ value: INDIA_DEGREE_DISPLAY_DEGREE, label: '只度数' },
	{ value: INDIA_DEGREE_DISPLAY_FULL, label: '度数+分数' },
];
export const YOGA_CATEGORY_LABELS = {
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
export const YOGA_CATEGORY_ORDER = [
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

// ── 历法域(与后端 / 起盘同口径):1582-10-15 以前按儒略历标注,之后格里历 ──
// 前端 moment 恒表示「真时刻」(proleptic 格里历);显示时 flatlibCalendarFields 换回儒略标签。
// 后端只带日期标签(无 ISO)的段,用 dashaMoment 把儒略标签换成同一天的真时刻,避免双重换算。
// 历法换算只有一份:utils/civilCalendar(与计算服务逐位同口径;公元前按历史纪年、儒略历)。
// 民用日期(显示年)→ 同一天的外推格里历年月日(天文年),给 moment 构造用。
function gregFieldsOfCivil(year, month, day){
	const jdn = civilJdnOfYmd(year, month, day);
	if(!Number.isFinite(jdn)){
		// 年为 0 / 不是数(时刻字段里无意义的日期部分):原样交给 moment,只取钟面
		return { year: Math.abs(Number(year)) || 0, month: Number(month) || 1, day: Number(day) || 1 };
	}
	const g = gregYmdOfJdn(jdn);
	return { year: g.astroYear, month: g.month, day: g.day };
}

// 真时刻 moment → 显示用年月日(1582-10-15 以前为儒略历标签;年份为历史纪年,公元前 300 年 = -300)。
export function flatlibCalendarFields(mom){
	const p = civilYmdOfJdn(gregJdnOfYmd(mom.year(), mom.month() + 1, mom.date()));
	return { year: p.year, month: p.month, day: p.day };
}

// ── 大运段界的时区 ──
// 段界墙钟恒为出生地当地时刻;后端 ISO 带出生时区偏移(如 +05:30)。按偏移解析 = 绝对时刻正确、
// 显示字面(年月日时分)仍是出生地墙钟 —— 浏览器所在时区与出生地不同,「当前」段不再偏几个小时。
const ISO_ZONE_RE = /(?:Z|[+-]\d{2}:?\d{2})$/;
// 出生时区(分钟):接 fields(fields.zone.value)/ 时区串 '+05:30' / 小时数;缺 → null(沿用浏览器当地,旧行为)。
export function dashaZoneMinutes(src){
	let z = src;
	if(z && typeof z === 'object'){
		z = z.zone && typeof z.zone === 'object' ? z.zone.value : z.zone;
	}
	return zoneOffsetMinutesOf(z);   // 时区串解析单一来源
}
// 墙钟字段 → moment:给了出生时区就落在该时区(UTC 构造再换偏移,不受浏览器夏令时空档影响)。
function wallMoment(fieldsObj, zoneMin){
	if(Number.isFinite(zoneMin)){
		return moment.utc(fieldsObj).utcOffset(zoneMin, true);
	}
	return moment(fieldsObj);
}
// 时刻 → 带偏移 ISO(出生时区墙钟 + 偏移):前端自建子段与后端 ISO 同形,再经 dashaMoment 读回不漂。
export function dashaIsoOf(mom){
	return mom && mom.format ? mom.format('YYYY-MM-DDTHH:mm:ss.SSSZ') : null;
}

// 后端段 → 真时刻 moment:优先精确 ISO(proleptic 格里;带偏移者按偏移解析);
// 只有日期标签时按起盘历法解释(1582 前为儒略),给了出生时区(分钟)就落在该时区。
export function dashaMoment(iso, label, zoneMin){
	if(iso){
		// 精确 ISO 是计算服务给的真实时刻:带偏移按偏移解析;不带偏移按本地钟面经单源解析(不交给引擎)
		const mi = ISO_ZONE_RE.test(`${iso}`) ? moment.parseZone(iso) : moment(parseLocalDateTimeMs(`${iso}`));
		if(mi.isValid()){ return mi; }
	}
	if(!label){ return null; }
	// 标签经日期串单源拆(年带符号、1–6 位:公元前 '-0300-03-10'、五位年都认),按民用历换成同一天的真时刻
	const mt = parseDateTimeParts(`${label}`.trim());
	if(mt && mt.year !== 0){
		const g = gregFieldsOfCivil(mt.year, mt.month, mt.day);
		return wallMoment({ year: g.year, month: g.month - 1, date: g.day, hour: mt.hour, minute: mt.minute, second: mt.second, millisecond: 0 }, zoneMin);
	}
	// 单源认不出的标签不再交给引擎猜(各引擎对非 ISO 写法口径不一)
	return null;
}

export function momentFromFieldValue(value, fallbackFormat){
	if(!value){
		return null;
	}
	// DateTime(ad/year 分离存储)必须走对象构造:公元前/五位年的字符串 parse 在 moment 的
	// YYYY token 下 Invalid(负号被撕/贪吃 4 位)→静默 null→dasha 年龄标签与缓存键坏(串盘)。
	// moment 对象构造支持任意整数年(BC 用天文年 -abs+1),全域安全。
	// 民用日期(1582 以前儒略历)先换成同一天的外推格里历再交给 moment:moment 表示真时刻,显示经 flatlibCalendarFields 换回。
	if(value.ad !== undefined && value.year !== undefined && value.month !== undefined){
		const g = gregFieldsOfCivil(value.ad < 0 ? -Math.abs(value.year) : Math.abs(value.year), value.month || 1, value.date !== undefined ? value.date : 1);
		return moment({
			year: g.year,
			month: g.month - 1,
			date: g.day,
			hour: value.hour || 0,
			minute: value.minute || 0,
			second: value.second || 0,
			millisecond: 0,
		});
	}
	if(moment.isMoment(value)){
		return value.isValid() ? value.clone() : null;
	}
	// 其余带 format 的值按民用历日期时刻串读(不用 moment(串, 'YYYY-…'):公元前 / 两位年 / 五位年会被误读)
	const withYear = !fallbackFormat || /Y/.test(fallbackFormat);
	if(value.format){
		const formatted = fallbackFormat ? value.format(fallbackFormat) : value.format('YYYY-MM-DD HH:mm:ss');
		const parsedFormatted = withYear ? momentOfCivilDateTimeStr(`${formatted}`) : moment(formatted, fallbackFormat);
		return parsedFormatted.isValid() ? parsedFormatted : null;
	}
	if(value.year && value.month && value.date && value.hour !== undefined){
		const g = gregFieldsOfCivil(value.ad < 0 ? -Math.abs(value.year) : Math.abs(value.year), value.month, value.date);
		return moment({
			year: g.year,
			month: g.month - 1,
			date: g.day,
			hour: value.hour,
			minute: value.minute || 0,
			second: value.second || 0,
			millisecond: 0,
		});
	}
	const parsed = typeof value === 'string' && withYear ? momentOfCivilDateTimeStr(value)
		: (fallbackFormat ? moment(value, fallbackFormat) : moment(value));
	return parsed.isValid() ? parsed : null;
}

export function buildBirthMoment(fields){
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
	// 出生时刻落在出生时区(墙钟字段不变):其后加减出的段界与 Date.now() 比较才是同一绝对时刻。
	const zoneMin = dashaZoneMinutes(fields);
	if(Number.isFinite(zoneMin) && birth.year){
		return wallMoment({ year: birth.year(), month: birth.month(), date: birth.date(),
			hour: birth.hour(), minute: birth.minute(), second: birth.second(), millisecond: 0 }, zoneMin);
	}
	return birth;
}

export function addDashaYears(momentValue, years){
	if(!momentValue || !momentValue.clone){
		return null;
	}
	return momentValue.clone().add(years * currentDashaYearDays() * 24 * 60 * 60 * 1000, 'milliseconds');
}

function subtractDashaYears(momentValue, years){
	if(!momentValue || !momentValue.clone){
		return null;
	}
	return momentValue.clone().subtract(years * currentDashaYearDays() * 24 * 60 * 60 * 1000, 'milliseconds');
}

export function formatDuration(years){
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

export function formatAge(years){
	if(years < 0){
		return `出生前${Math.abs(years).toFixed(1)}年`;
	}
	return `${years.toFixed(1)}岁`;
}

export function deriveDashaSequence(list){
	// 从大运段序列推导「主星环(首次出现序)+ 周期总长」——4/5 级深钻按体系自身环递归
	// (lord.years 为满年;首段余额年不污染环)。环<2 或总长≤0 → null(不出段,宁缺勿错)。
	const seen = {};
	const seq = [];
	(list || []).forEach((it)=>{
		const lord = it && it.lord;
		const k = lord && lord.key;
		if(!k || seen[k]){ return; }
		seen[k] = true;
		const years = (lord.years !== undefined && lord.years !== null) ? +lord.years : +it.years;
		seq.push({ key: k, label: lord.label, en: lord.en, years: Number.isFinite(years) ? years : 0 });
	});
	const total = seq.reduce((sum, l)=>sum + (l.years || 0), 0);
	return (seq.length >= 2 && total > 0) ? { sequence: seq, totalYears: total } : null;
}

export function buildDashaSubPeriods(item, system = 'vimshottari', seqCtx = null){
	// 后端已给的下一级(大运→antardashas、小运→pratyantardashas)直接用,起讫取精确 ISO;
	// 再往下(微运 / 息运)才在前端按比例细分 —— 起点是精确时刻,不再从「日期 0 点」推。
	const backendSubs = item && (Array.isArray(item.antardashas) ? item.antardashas
		: (Array.isArray(item.pratyantardashas) ? item.pratyantardashas : null));
	if(backendSubs){
		return backendSubs.map((subItem)=>({
			...subItem,
			lord: normalizeDashaLord(subItem.lord),
			start: dashaMoment(subItem.startIso, subItem.start),
			end: dashaMoment(subItem.endIso, subItem.end),
		}));
	}
	if(!item || !item.start || !item.lord){
		return [];
	}
	// 非 Vimshottari:按「体系自身环序+周期总长」通用递归(环由该体系大运段推导);
	// 推导不出(环残缺)→ 不出段,绝不借 Vimshottari 九主序÷120 造假段。
	if(system !== 'vimshottari'){
		if(!seqCtx || !Array.isArray(seqCtx.sequence) || !seqCtx.totalYears){
			return [];
		}
		const SEQ = seqCtx.sequence;
		const TOTAL = seqCtx.totalYears;
		const out = [];
		let cur = item.start.clone();
		let li = SEQ.findIndex((lord)=>lord.key === item.lord.key);
		if(li < 0){ return []; }
		for(let i = 0; i < SEQ.length; i++){
			const idx = (li + i) % SEQ.length;
			const lord = { ...SEQ[idx], idx };
			const years = item.years * (lord.years || 0) / TOTAL;
			const end = i === SEQ.length - 1 ? item.end.clone() : addDashaYears(cur, years);
			if(!end || !end.clone){ break; }
			out.push({ lord, years, start: cur.clone(), end: end.clone() });
			cur = end;
		}
		return out;
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

export function normalizeDashaLord(lord){
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
export const DASHA_LEVEL_LABELS = [
	{ cn: '大运', en: 'Mahā' },
	{ cn: '小运', en: 'Antar' },
	{ cn: '子运', en: 'Pratyantar' },
	{ cn: '微运', en: 'Sūkṣma' },
	{ cn: '息运', en: 'Prāṇa' },
];
export const DASHA_MAX_LEVEL = DASHA_LEVEL_LABELS.length;

// 某运段是否含「今日」(各级金色高亮 + 当前徽标用);start/end 为 moment 或可被 moment 解析。
export function dashaContainsNow(item){
	if(!item || !item.start || !item.end){
		return false;
	}
	const sm = item.start.valueOf ? item.start : dashaMoment(item.startIso, item.start);
	const em = item.end.valueOf ? item.end : dashaMoment(item.endIso, item.end);
	if(!sm || !em){ return false; }
	const s = sm.valueOf();
	const e = em.valueOf();
	const now = moment().valueOf();
	return now >= s && now < e;
}

// QW10/11 条件 Nakshatra 大运:把 jyotish.extendedDashas.conditional[key] 映射成与 Vimshottari
// 同形的 {nakshatra, firstBalance, items[]} 结构,以复用既有大运渲染器(条目/小运/年龄)。
//   出生余额起算:start = 出生 − firstElapsed(= 首运周期起点 cycle_start),故每段(含首段)
//   一律取满期年 fullYears;首段用 isBirthBalance 标记「出生前已历」部分。
//   🔴 曾错配:起点用 cycle_start、首段却取余额年 balance → 整条时间轴前移 firstElapsed 年
//   (对照标准:引擎 Vimshottari 首段即满年 + 负 startAge)。
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
		const periodYears = m.fullYears != null ? m.fullYears : m.years;
		const end = addDashaYears(start, periodYears) || start.clone();
		let antardashas = null;
		if(Array.isArray(m.antardashas) && m.antardashas.length){
			const tot = m.antardashas.reduce((s, a)=>s + (a.years || 0), 0) || 1;
			let cur = start.clone();
			antardashas = m.antardashas.map((a)=>{
				const dur = periodYears * (a.years || 0) / tot;
				const aEnd = addDashaYears(cur, dur) || cur.clone();
				// 带偏移 ISO(出生时区墙钟):曾用 toISOString(UTC 'Z' 串)再被当墙钟日期解析 → 段界按浏览器时区偏移
				const row = { lord: a.lord, years: dur, start: dashaIsoOf(cur), end: dashaIsoOf(aEnd), startIso: dashaIsoOf(cur), endIso: dashaIsoOf(aEnd) };
				cur = aEnd;
				return row;
			});
		}
		const item = {
			lord: normalizeDashaLord(m.lord),
			years: periodYears,
			start: start.clone(),
			end: end.clone ? end.clone() : start.clone(),
			startAge: start.diff(birth, 'days', true) / currentDashaYearDays(),
			endAge: end.diff ? end.diff(birth, 'days', true) / currentDashaYearDays() : null,
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

// Chara 中运各段年数:「座运中运分割」开关(比例 = 按各座自身期长占比 / 等分 = 主期均分)在前端切分,
// 页面大运树与 AI 快照共用这一份,两处不会各算各的。
export function charaAntarYears(maha, fields){
	const list = maha && Array.isArray(maha.antardashas) ? maha.antardashas : [];
	if(!list.length){ return []; }
	const yrs = (maha && maha.years) || 0;
	const splitMode = (AstroConst.normalizeIndiaDashaVariants(
		fields && fields.indiaDashaVariants ? fields.indiaDashaVariants.value : null
	).rasiAntarSplit) || 'proportional';
	const tot = list.reduce((s, a)=>s + ((a && a.periodYears) || 0), 0) || 1;
	return list.map((a)=>(splitMode === 'equal' ? yrs / list.length : yrs * ((a && a.periodYears) || 0) / tot));
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
			// 座运中运分割开关:比例(默认,按各座自身期长占比)/12 等分。
			const durs = charaAntarYears(m, fields);
			let cur = start.clone();
			antardashas = m.antardashas.map((a, ai)=>{
				const dur = durs[ai];
				const aEnd = addDashaYears(cur, dur) || cur.clone();
				const row = { lord: { label: a.rasiLabel, en: a.rasi, key: a.rasi }, years: dur, start: dashaIsoOf(cur), end: dashaIsoOf(aEnd), startIso: dashaIsoOf(cur), endIso: dashaIsoOf(aEnd) };
				cur = aEnd;
				return row;
			});
		}
		const item = {
			lord: { label: m.rasiLabel, en: m.rasi, key: m.rasi },
			years: yrs,
			start: start.clone(),
			end: end.clone ? end.clone() : start.clone(),
			startAge: start.diff(birth, 'days', true) / currentDashaYearDays(),
			endAge: end.diff ? end.diff(birth, 'days', true) / currentDashaYearDays() : null,
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

function buildAkkgDasha(chartObj, fields){
	// AKKG(引擎 dasha.akkg):mahadashas 平铺(cycle 1/2 + start/end 日期已算)→ 组树形items。
	const a = chartObj && chartObj.jyotish && chartObj.jyotish.dasha && chartObj.jyotish.dasha.akkg;
	if(!a || !a.available || !Array.isArray(a.mahadashas) || !a.mahadashas.length){
		return null;
	}
	const now = Date.now();
	const zoneMin = dashaZoneMinutes(fields);
	const items = a.mahadashas.map((m)=>{
		const start = m.start ? dashaMoment(m.startIso, m.start, zoneMin) : null;
		const end = m.end ? dashaMoment(m.endIso, m.end, zoneMin) : null;
		return {
			lord: normalizeDashaLord({ key: m.planet, en: m.planet, label: m.planetCN || m.planet, years: m.years }),
			years: m.years,
			cycle: m.cycle,
			start,
			end,
			startAge: m.startAge,
			endAge: m.endAge,
			isBirthBalance: false,
			active: !!(start && end && now >= start.valueOf() && now < end.valueOf()),
			antardashas: null,
		};
	});
	return {
		backend: true,
		extended: true,
		available: true,
		moonLon: null,
		nakshatra: {
			name: a.seedSign,
			index: '',
			lord: { label: `AK ${a.atmakaraka || ''}`, en: a.atmakaraka, key: a.atmakaraka },
		},
		firstBalance: 0,
		firstElapsed: 0,
		items,
	};
}

export function buildVimshottariDasha(chartObj, fields, system){
	const sys = system || 'vimshottari';
	if(sys === 'chara'){
		return buildCharaDasha(chartObj, fields);
	}
	if(sys === 'akkg'){
		return buildAkkgDasha(chartObj, fields);
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
				start: dashaMoment(item.startIso, item.start),
				end: dashaMoment(item.endIso, item.end),
				// 「当前」按本地此刻判(后端 active 是出图那一刻的快照,缓存期内会过期)。
				active: dashaContainsNow({ start: dashaMoment(item.startIso, item.start), end: dashaMoment(item.endIso, item.end) }),
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
	const nakIndex = segmentIndex(moonLon, NAKSHATRA_SIZE, 27);   // 段界单源(恰在宿界上归后一宿)
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
			startAge: start.diff(birth, 'days', true) / currentDashaYearDays(),
			endAge: end.diff(birth, 'days', true) / currentDashaYearDays(),
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
