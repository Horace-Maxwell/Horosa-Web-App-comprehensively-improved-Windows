import moment from 'moment';
import * as AstroConst from '../constants/AstroConst';
import * as AstroText from '../constants/AstroText';

export const DECENNIAL_START_MODE_SECT_LIGHT = 'sect_light';
export const DECENNIAL_ORDER_ZODIACAL = 'zodiacal';
export const DECENNIAL_ORDER_CHALDEAN = 'chaldean';
export const DECENNIAL_DAY_METHOD_VALENS = 'valens';
export const DECENNIAL_DAY_METHOD_HEPHAISTIO = 'hephaistio';
export const DECENNIAL_CALENDAR_TRADITIONAL = 'calendar_360';
export const DECENNIAL_CALENDAR_ACTUAL = 'calendar_365_25';

export const DECENNIAL_TRADITIONAL_PLANETS = [
	AstroConst.SATURN,
	AstroConst.JUPITER,
	AstroConst.MARS,
	AstroConst.SUN,
	AstroConst.VENUS,
	AstroConst.MERCURY,
	AstroConst.MOON,
];

export const DECENNIAL_PLANET_BASE_MONTHS = {
	[AstroConst.SATURN]: 30,
	[AstroConst.JUPITER]: 12,
	[AstroConst.MARS]: 15,
	[AstroConst.SUN]: 19,
	[AstroConst.VENUS]: 8,
	[AstroConst.MERCURY]: 20,
	[AstroConst.MOON]: 25,
};

// Hephaistio's day allocations are given as fixed tables in the source material.
// These do not always sum back to the parent month-lord period, so we keep them verbatim.
export const DECENNIAL_HEPHAISTIO_DAY_TABLE = {
	[AstroConst.SATURN]: {
		[AstroConst.SATURN]: 210,
		[AstroConst.JUPITER]: 84,
		[AstroConst.MARS]: 105,
		[AstroConst.SUN]: 133,
		[AstroConst.VENUS]: 56,
		[AstroConst.MERCURY]: 150,
		[AstroConst.MOON]: 175,
	},
	[AstroConst.JUPITER]: {
		[AstroConst.JUPITER]: 34,
		[AstroConst.SATURN]: 85,
		[AstroConst.MARS]: 42,
		[AstroConst.SUN]: 54,
		[AstroConst.VENUS]: 22,
		[AstroConst.MERCURY]: 57,
		[AstroConst.MOON]: 71,
	},
	[AstroConst.MARS]: {
		[AstroConst.MARS]: 52,
		[AstroConst.SUN]: 66,
		[AstroConst.VENUS]: 28,
		[AstroConst.MERCURY]: 70,
		[AstroConst.MOON]: 87,
		[AstroConst.SATURN]: 105,
		[AstroConst.JUPITER]: 42,
	},
	[AstroConst.SUN]: {
		[AstroConst.SUN]: 83,
		[AstroConst.MOON]: 118,
		[AstroConst.SATURN]: 130,
		[AstroConst.JUPITER]: 52,
		[AstroConst.MARS]: 64,
		[AstroConst.VENUS]: 35,
		[AstroConst.MERCURY]: 87,
	},
	[AstroConst.VENUS]: {
		[AstroConst.VENUS]: 15,
		[AstroConst.SUN]: 36,
		[AstroConst.MOON]: 47,
		[AstroConst.SATURN]: 57,
		[AstroConst.JUPITER]: 22,
		[AstroConst.MARS]: 28,
		[AstroConst.MERCURY]: 38,
	},
	[AstroConst.MERCURY]: {
		[AstroConst.MERCURY]: 96,
		[AstroConst.SUN]: 90,
		[AstroConst.MOON]: 117,
		[AstroConst.SATURN]: 141,
		[AstroConst.JUPITER]: 56,
		[AstroConst.MARS]: 70,
		[AstroConst.VENUS]: 36,
	},
	[AstroConst.MOON]: {
		[AstroConst.MOON]: 148,
		[AstroConst.SUN]: 115,
		[AstroConst.SATURN]: 177,
		[AstroConst.JUPITER]: 71,
		[AstroConst.MARS]: 87,
		[AstroConst.VENUS]: 47,
		[AstroConst.MERCURY]: 119,
	},
};

const TOTAL_BASE_MONTHS = 129;
const TOTAL_L1_DAYS = TOTAL_BASE_MONTHS * 30;
const FIVE_MINUTES = 5;
const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_MONTH = 30 * MINUTES_PER_DAY;
const MINUTES_PER_YEAR = 12 * MINUTES_PER_MONTH;
const ACTUAL_YEAR_SCALE_NUMERATOR = 1461;
const ACTUAL_YEAR_SCALE_DENOMINATOR = 1440;

function normalizeDateInput(dateText){
	return `${dateText || ''}`.trim().replace(/\//g, '-');
}

function normalizeTimeInput(timeText){
	const text = `${timeText || ''}`.trim();
	if(!text){
		return '00:00:00';
	}
	if(text.length === 5){
		return `${text}:00`;
	}
	return text;
}

function parseBirthMoment(chartObj){
	const params = chartObj && chartObj.params ? chartObj.params : {};
	let dateText = '';
	let timeText = '';
	if(params.birth){
		const parts = `${params.birth}`.trim().split(/\s+/);
		dateText = parts[0] || '';
		timeText = parts[1] || '';
	}else{
		dateText = params.date || '';
		timeText = params.time || '';
	}
	const zone = `${params.zone || '+08:00'}`.trim();
	const raw = `${normalizeDateInput(dateText)} ${normalizeTimeInput(timeText)} ${zone}`;
	const parsed = moment.parseZone(raw, [
		'YYYY-MM-DD HH:mm:ss Z',
		'YYYY-M-D HH:mm:ss Z',
		'YYYY-MM-DD HH:mm Z',
		'YYYY-M-D HH:mm Z',
	], true);
	if(parsed.isValid()){
		return parsed;
	}
	return moment.parseZone(raw);
}

function getChartObject(chartObj, objId){
	const chart = chartObj && chartObj.chart ? chartObj.chart : {};
	const objects = Array.isArray(chart.objects) ? chart.objects : [];
	for(let i=0; i<objects.length; i++){
		if(objects[i] && objects[i].id === objId){
			return objects[i];
		}
	}
	return null;
}

function safeLon(val){
	const num = Number(val);
	if(Number.isNaN(num)){
		return null;
	}
	let normalized = num % 360;
	if(normalized < 0){
		normalized += 360;
	}
	return normalized;
}

function rotateList(list, startValue){
	const ary = Array.isArray(list) ? list.slice() : [];
	if(!startValue || ary.length === 0){
		return ary;
	}
	const idx = ary.indexOf(startValue);
	if(idx <= 0){
		return ary;
	}
	return ary.slice(idx).concat(ary.slice(0, idx));
}

function buildZodiacalOrder(chartObj){
	const ranked = DECENNIAL_TRADITIONAL_PLANETS.map((planet, idx)=>{
		const obj = getChartObject(chartObj, planet);
		return {
			planet,
			idx,
			lon: obj ? safeLon(obj.lon) : null,
		};
	}).filter((item)=>item.lon !== null);
	if(ranked.length !== DECENNIAL_TRADITIONAL_PLANETS.length){
		return DECENNIAL_TRADITIONAL_PLANETS.slice();
	}
	ranked.sort((a, b)=>{
		if(a.lon !== b.lon){
			return a.lon - b.lon;
		}
		return a.idx - b.idx;
	});
	return ranked.map((item)=>item.planet);
}

export function resolveDecennialStartPlanet(chartObj, startMode){
	if(startMode && startMode !== DECENNIAL_START_MODE_SECT_LIGHT){
		return startMode;
	}
	const isDiurnal = !!(chartObj && chartObj.chart && chartObj.chart.isDiurnal);
	return isDiurnal ? AstroConst.SUN : AstroConst.MOON;
}

export function getDecennialOrder(chartObj, startPlanet, orderType){
	const baseOrder = orderType === DECENNIAL_ORDER_CHALDEAN
		? DECENNIAL_TRADITIONAL_PLANETS.slice()
		: buildZodiacalOrder(chartObj);
	return rotateList(baseOrder, startPlanet);
}

function getRoundedDistribution(totalValue, order, roundUnit, preserveLast = true){
	const segments = [];
	let consumed = 0;
	for(let i=0; i<order.length; i++){
		const planet = order[i];
		const exact = totalValue * DECENNIAL_PLANET_BASE_MONTHS[planet] / TOTAL_BASE_MONTHS;
		let value = exact;
		if(i === order.length - 1 && preserveLast){
			value = totalValue - consumed;
		}else if(roundUnit > 0){
			value = Math.round(exact / roundUnit) * roundUnit;
		}
		if(value < 0){
			value = 0;
		}
		consumed += value;
		segments.push({
			planet,
			value,
		});
	}
	return segments;
}

function minutesFromLevelThree(totalDays, dayMethod, monthLord, order){
	if(dayMethod === DECENNIAL_DAY_METHOD_HEPHAISTIO){
		const table = DECENNIAL_HEPHAISTIO_DAY_TABLE[monthLord];
		if(table){
			return order.map((planet)=>({
				planet,
				value: (table[planet] || 0) * 24 * 60,
			}));
		}
		return getRoundedDistribution(totalDays, order, 1).map((item)=>({
			planet: item.planet,
			value: item.value * 24 * 60,
		}));
	}
	const totalMinutes = totalDays * 24 * 60;
	return getRoundedDistribution(totalMinutes, order, FIVE_MINUTES);
}

function minutesFromLevelFour(totalMinutes, order){
	return getRoundedDistribution(totalMinutes, order, 1);
}

function scaleNominalMinutes(totalMinutes, calendarType){
	const normalized = Math.max(0, Math.round(Number(totalMinutes) || 0));
	if(calendarType !== DECENNIAL_CALENDAR_ACTUAL){
		return normalized;
	}
	return Math.round(normalized * ACTUAL_YEAR_SCALE_NUMERATOR / ACTUAL_YEAR_SCALE_DENOMINATOR);
}

function scaleNominalSegments(segments, calendarType, roundUnit = 1){
	const list = Array.isArray(segments) ? segments : [];
	if(calendarType !== DECENNIAL_CALENDAR_ACTUAL){
		return list.map((item)=>({
			planet: item.planet,
			value: Math.max(0, Math.round(Number(item.value) || 0)),
		}));
	}
	const unit = roundUnit > 0 ? roundUnit : 1;
	const totalNominal = list.reduce((sum, item)=>sum + Math.max(0, Number(item.value) || 0), 0);
	const totalScaled = Math.round(scaleNominalMinutes(totalNominal, calendarType) / unit) * unit;
	const scaled = [];
	let consumed = 0;
	let cumulativeExact = 0;
	for(let i=0; i<list.length; i++){
		const item = list[i];
		const nominalValue = Math.max(0, Number(item.value) || 0);
		let value = 0;
		cumulativeExact += nominalValue * ACTUAL_YEAR_SCALE_NUMERATOR / ACTUAL_YEAR_SCALE_DENOMINATOR;
		if(i === list.length - 1){
			value = totalScaled - consumed;
		}else{
			value = Math.round(cumulativeExact / unit) * unit - consumed;
		}
		if(value < 0){
			value = 0;
		}
		consumed += value;
		scaled.push({
			planet: item.planet,
			value,
		});
	}
	return scaled;
}

function formatRange(startMoment, endMoment, withTime){
	const fmt = withTime ? 'YYYY-MM-DD HH:mm' : 'YYYY-MM-DD';
	return `${startMoment.format(fmt)} - ${endMoment.format(fmt)}`;
}

function formatNominalOffset(totalMinutes, level){
	let minutes = Math.max(0, Math.round(Number(totalMinutes) || 0));
	const years = Math.floor(minutes / MINUTES_PER_YEAR);
	minutes -= years * MINUTES_PER_YEAR;
	const months = Math.floor(minutes / MINUTES_PER_MONTH);
	minutes -= months * MINUTES_PER_MONTH;
	const days = Math.floor(minutes / MINUTES_PER_DAY);
	minutes -= days * MINUTES_PER_DAY;
	const hours = Math.floor(minutes / 60);
	minutes -= hours * 60;

	if(level >= 4){
		const dayParts = [];
		if(years > 0){
			dayParts.push(`${years}年`);
		}
		if(months > 0){
			dayParts.push(`${months}个月`);
		}
		if(days > 0){
			dayParts.push(`${days}天`);
		}
		const prefix = dayParts.length > 0 ? dayParts.join('') : '0天';
		return `${prefix} ${`${hours}`.padStart(2, '0')}:${`${minutes}`.padStart(2, '0')}`;
	}

	if(level === 3){
		const parts = [];
		if(years > 0){
			parts.push(`${years}年`);
		}
		if(months > 0){
			parts.push(`${months}个月`);
		}
		if(days > 0 || parts.length === 0){
			parts.push(`${days}天`);
		}
		return parts.join('');
	}

	const parts = [];
	if(years > 0){
		parts.push(`${years}年`);
	}
	if(months > 0 || parts.length === 0){
		parts.push(`${months}个月`);
	}
	return parts.join('');
}

function formatNominalRange(startOffsetMinutes, endOffsetMinutes, level){
	return `${formatNominalOffset(startOffsetMinutes, level)} - ${formatNominalOffset(endOffsetMinutes, level)}`;
}

function buildNode(level, key, planet, startMoment, endMoment, nowMoment, sublevel, startOffsetMinutes, endOffsetMinutes){
	const withTime = level >= 4;
	const active = !!nowMoment
		&& nowMoment.valueOf() >= startMoment.valueOf()
		&& nowMoment.valueOf() < endMoment.valueOf();
	return {
		key,
		level,
		planet,
		date: formatRange(startMoment, endMoment, withTime),
		nominal: formatNominalRange(startOffsetMinutes, endOffsetMinutes, level),
		startText: startMoment.format(withTime ? 'YYYY-MM-DD HH:mm' : 'YYYY-MM-DD'),
		endText: endMoment.format(withTime ? 'YYYY-MM-DD HH:mm' : 'YYYY-MM-DD'),
		active,
		startOffsetMinutes,
		endOffsetMinutes,
		sublevel: Array.isArray(sublevel) ? sublevel : [],
	};
}

function buildLevelFour(levelThreeNode, baseOrder, nowMoment, calendarType){
	const order = rotateList(baseOrder, levelThreeNode.planet);
	const nominalSegments = minutesFromLevelFour(levelThreeNode.nominalMinutes, order);
	const actualSegments = scaleNominalSegments(nominalSegments, calendarType, 1);
	const list = [];
	let cursor = levelThreeNode.startMoment.clone();
	let cursorOffset = levelThreeNode.startOffsetMinutes;
	for(let i=0; i<nominalSegments.length; i++){
		const nominalItem = nominalSegments[i];
		const actualItem = actualSegments[i];
		const next = cursor.clone().add(actualItem.value, 'minutes');
		const nextOffset = cursorOffset + nominalItem.value;
		list.push(buildNode(
			4,
			`${levelThreeNode.key}_l4_${i}`,
			actualItem.planet,
			cursor,
			next,
			nowMoment,
			[],
			cursorOffset,
			nextOffset
		));
		cursor = next;
		cursorOffset = nextOffset;
	}
	return list;
}

function buildLevelThree(levelTwoNode, baseOrder, dayMethod, nowMoment, calendarType){
	const order = rotateList(baseOrder, levelTwoNode.planet);
	const nominalSegments = minutesFromLevelThree(levelTwoNode.nominalDays, dayMethod, levelTwoNode.planet, order);
	const actualSegments = scaleNominalSegments(nominalSegments, calendarType, 1);
	const list = [];
	let cursor = levelTwoNode.startMoment.clone();
	let cursorOffset = levelTwoNode.startOffsetMinutes;
	for(let i=0; i<nominalSegments.length; i++){
		const nominalItem = nominalSegments[i];
		const actualItem = actualSegments[i];
		const next = cursor.clone().add(actualItem.value, 'minutes');
		const meta = {
			key: `${levelTwoNode.key}_l3_${i}`,
			planet: actualItem.planet,
			startMoment: cursor,
			endMoment: next,
			nominalMinutes: nominalItem.value,
			startOffsetMinutes: cursorOffset,
			endOffsetMinutes: cursorOffset + nominalItem.value,
		};
		const sublevel = buildLevelFour(meta, baseOrder, nowMoment, calendarType);
		list.push(buildNode(
			3,
			meta.key,
			meta.planet,
			meta.startMoment,
			meta.endMoment,
			nowMoment,
			sublevel,
			meta.startOffsetMinutes,
			meta.endOffsetMinutes
		));
		cursor = next;
		cursorOffset = meta.endOffsetMinutes;
	}
	return list;
}

function buildLevelTwo(levelOneNode, baseOrder, dayMethod, nowMoment, calendarType){
	const order = rotateList(baseOrder, levelOneNode.planet);
	const nominalSegments = order.map((planet)=>({
		planet,
		value: DECENNIAL_PLANET_BASE_MONTHS[planet] * MINUTES_PER_MONTH,
	}));
	const actualSegments = scaleNominalSegments(nominalSegments, calendarType, 1);
	const list = [];
	let cursor = levelOneNode.startMoment.clone();
	let cursorOffset = levelOneNode.startOffsetMinutes;
	for(let i=0; i<order.length; i++){
		const planet = nominalSegments[i].planet;
		const nominalMinutes = nominalSegments[i].value;
		const actualMinutes = actualSegments[i].value;
		const next = cursor.clone().add(actualMinutes, 'minutes');
		const meta = {
			key: `${levelOneNode.key}_l2_${i}`,
			planet,
			nominalDays: nominalMinutes / MINUTES_PER_DAY,
			startMoment: cursor,
			endMoment: next,
			startOffsetMinutes: cursorOffset,
			endOffsetMinutes: cursorOffset + nominalMinutes,
		};
		const sublevel = buildLevelThree(meta, baseOrder, dayMethod, nowMoment, calendarType);
		list.push(buildNode(
			2,
			meta.key,
			meta.planet,
			meta.startMoment,
			meta.endMoment,
			nowMoment,
			sublevel,
			meta.startOffsetMinutes,
			meta.endOffsetMinutes
		));
		cursor = next;
		cursorOffset = meta.endOffsetMinutes;
	}
	return list;
}

function resolveL1Count(birthMoment, nowMoment, calendarType){
	if(!birthMoment || !birthMoment.isValid()){
		return 7;
	}
	const ageMinutes = Math.max(0, nowMoment.diff(birthMoment, 'minutes', true));
	const l1Minutes = scaleNominalMinutes(TOTAL_L1_DAYS * MINUTES_PER_DAY, calendarType);
	return Math.max(7, Math.ceil(ageMinutes / l1Minutes) + 2);
}

export function buildDecennialTimeline(chartObj, settings = {}){
	const calendarType = settings.calendarType || DECENNIAL_CALENDAR_TRADITIONAL;
	const birthMoment = parseBirthMoment(chartObj);
	if(!birthMoment.isValid()){
		return {
			list: [],
			baseOrder: [],
			resolvedStartPlanet: resolveDecennialStartPlanet(chartObj, settings.startMode),
			orderType: settings.orderType || DECENNIAL_ORDER_ZODIACAL,
			dayMethod: settings.dayMethod || DECENNIAL_DAY_METHOD_VALENS,
			calendarType,
			birthMoment,
		};
	}
	const nowMoment = moment().utcOffset(birthMoment.utcOffset());
	const resolvedStartPlanet = resolveDecennialStartPlanet(chartObj, settings.startMode);
	const orderType = settings.orderType || DECENNIAL_ORDER_ZODIACAL;
	const dayMethod = settings.dayMethod || DECENNIAL_DAY_METHOD_VALENS;
	const baseOrder = getDecennialOrder(chartObj, resolvedStartPlanet, orderType);
	const count = resolveL1Count(birthMoment, nowMoment, calendarType);
	const list = [];
	const l1NominalMinutes = TOTAL_L1_DAYS * MINUTES_PER_DAY;
	const l1ActualMinutes = scaleNominalMinutes(l1NominalMinutes, calendarType);
	let cursor = birthMoment.clone();

	for(let i=0; i<count; i++){
		const planet = baseOrder[i % baseOrder.length];
		const startMoment = cursor.clone();
		const endMoment = startMoment.clone().add(l1ActualMinutes, 'minutes');
		const startOffsetMinutes = l1NominalMinutes * i;
		const endOffsetMinutes = startOffsetMinutes + l1NominalMinutes;
		const meta = {
			key: `l1_${i}`,
			planet,
			startMoment,
			endMoment,
			startOffsetMinutes,
			endOffsetMinutes,
		};
		const sublevel = buildLevelTwo(meta, baseOrder, dayMethod, nowMoment, calendarType);
		list.push(buildNode(
			1,
			meta.key,
			meta.planet,
			meta.startMoment,
			meta.endMoment,
			nowMoment,
			sublevel,
			meta.startOffsetMinutes,
			meta.endOffsetMinutes
		));
		cursor = endMoment;
	}

	return {
		list,
		baseOrder,
		resolvedStartPlanet,
		orderType,
		dayMethod,
		calendarType,
		birthMoment,
	};
}

export function getDecennialPlanetShortName(planet){
	return AstroText.AstroTxtMsg[planet] || planet;
}

export function getDecennialPlanetLongName(planet){
	return AstroText.AstroMsgCN && AstroText.AstroMsgCN[planet]
		? AstroText.AstroMsgCN[planet]
		: (AstroText.AstroTxtMsg[planet] || planet);
}

export function getDecennialStartLabel(chartObj, startMode){
	if(startMode === DECENNIAL_START_MODE_SECT_LIGHT || !startMode){
		const resolved = resolveDecennialStartPlanet(chartObj, startMode);
		return `得时光体（${getDecennialPlanetShortName(resolved)}）`;
	}
	return getDecennialPlanetLongName(startMode);
}

export function getDecennialOrderLabel(orderType){
	if(orderType === DECENNIAL_ORDER_CHALDEAN){
		return '迦勒底星序';
	}
	return '实际黄道次序';
}

export function getDecennialDayMethodLabel(dayMethod){
	if(dayMethod === DECENNIAL_DAY_METHOD_HEPHAISTIO){
		return 'Hephaistio（原表日数）';
	}
	return 'Valens（精确）';
}

export function getDecennialCalendarLabel(calendarType){
	if(calendarType === DECENNIAL_CALENDAR_ACTUAL){
		return '365.25天/年（按回归年换算）';
	}
	return '360天/年（按30天/月换算）';
}

export function getDecennialDisplayText(item, calendarType){
	if(!item){
		return '';
	}
	if(calendarType === DECENNIAL_CALENDAR_TRADITIONAL){
		return item.date && item.nominal ? `${item.date}（名义：${item.nominal}）` : (item.date || '');
	}
	return item.date || '';
}

export function getDecennialNominalHint(item, calendarType){
	if(!item || calendarType !== DECENNIAL_CALENDAR_TRADITIONAL){
		return '';
	}
	return item.nominal || '';
}
