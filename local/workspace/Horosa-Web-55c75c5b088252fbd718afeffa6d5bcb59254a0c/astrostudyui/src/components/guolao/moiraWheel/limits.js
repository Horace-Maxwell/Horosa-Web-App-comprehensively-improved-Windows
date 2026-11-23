// 命度、限度与流年年龄换算(出生年界、节气界、限表)
// 从 GuoLaoMoiraWheel.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { normalizeGuolaoLifeMode, getStoredGuolaoLifeMode, GUOLAO_LIFE_MODE_ASC } from '../GuoLaoChartStyle';
import * as AstroConst from '../../../constants/AstroConst';
import { childYearsSpan } from '../guolaoMoiraTables';
import { civilPartsFromJd, julday as gregJulday, civilWallMs } from '../../../utils/civilCalendar';
import { buildLocalJieqiYearSeed } from '../../../utils/localNongliAdapter';   // 立春/冬至年界本地精算
import { findObject } from './stellar';
import { isEclipticDisplayChart, objectRa, norm } from './geometry';
import { LIMIT_SEQ, HOUSE_BRANCH } from './constants';

function lifeModeFromFields(fields){
	if(fields && fields.guolaoLifeMode && fields.guolaoLifeMode.value !== undefined && fields.guolaoLifeMode.value !== null){
		return normalizeGuolaoLifeMode(fields.guolaoLifeMode.value);
	}
	return getStoredGuolaoLifeMode();
}

export function lifeDegree(chart, fields, forceLon){
	const life = findObject(chart, AstroConst.LIFEMASTERDEG74);
	const asc = findObject(chart, AstroConst.ASC);
	const sun = findObject(chart, AstroConst.SUN);
	const lifeMode = lifeModeFromFields(fields);
	// R: 除「占星上升」外(asc 直接用上升点),日出/赤黄/古法遇卯/自定命宫(地支)均以 BaZi 算出的 LifeMasterDeg74 为命度起宫。
	const useLifeMaster = lifeMode !== GUOLAO_LIFE_MODE_ASC;
	// forceLon=true:恒取黄经命度(供 12 宫/地支/小限飞限用,宫位系黄道划分,不随宿度制显示坐标变)。
	const preferLon = forceLon === true ? true : isEclipticDisplayChart(chart);
	const primary = useLifeMaster ? objectRa(life, preferLon) : objectRa(asc, preferLon);
	const secondary = useLifeMaster ? objectRa(asc, preferLon) : objectRa(life, preferLon);
	const val = primary !== null ? primary : (secondary !== null ? secondary : objectRa(sun, preferLon));
	return val === null ? 0 : val;
}
// 黄经命度(命宫/地支/小限飞限专用,永远黄道)。
export function lifeLonDegree(chart, fields){
	return lifeDegree(chart, fields, true);
}

function sectorIndexFromSignIndex(signIndex){
	return ((Number(signIndex || 0) - 1) % 12 + 12) % 12;
}

export function houseIndexForSector(sectorIdx, life){
	const signIndex = Math.floor(norm(life) / 30);
	const lifeSector = sectorIndexFromSignIndex(signIndex);
	return (sectorIdx - lifeSector + 12) % 12;
}

// 童限年数(限度度数推进用·不四舍)= childYearsSpan(guolaoMoiraTables 单一真值源,与飞限/童限四舍边界勿混)。

// 🔴 百六大限锚点(照 Moira getLimitDegree 第 3921 行:degree_offset = floor(life_sign_pos/30)*30 + 30)。
// = 命宫「整宫界」(30° 对齐)的高边界,而非精确命度 —— Moira 的 1 岁起于此宫界,非命度!
// 旧版误锚在精确命度,故整盘偏 (30 − 命度宫内度) 度(用户实测发现)。
export function limitAnchor(life){
	return norm(Math.floor(norm(Number(life || 0)) / 30) * 30 + 30);
}

// 限度逐宫年数:首宫=童限(不四舍,base 由定童限 9/10),其余=limit_seq[1..11](照 Moira addChildYearToBirthDate / limit_seq[i])。
function limitSegments(life, childBase){
	return [childYearsSpan(life, childBase)].concat(LIMIT_SEQ.slice(1));
}

// 🔴 出生日在其「年界」内已历的年分数 birthFrac(照 Moira getLimitDegree 第 3901 行 val=age-1-birthFrac)。
// Moira 年界硬编码=公历元旦(calendar/work_cal 均 GregorianCalendar,非节气);frac=(出生Ms − 当年1/1Ms)/一年。
// mode:'gregorian'(公历元旦,Moira 默认)/'lichun'(立春)/'dongzhi'(冬至);后二者用 chart.nongli 节气日,缺则回退元旦。
export function birthYearFraction(chart, fields, mode){
	return birthYearBasis(chart, fields, mode).frac;
}

// 年界基准全量:{ frac 出生在年界内已历年分数, yearShift 岁次年号相对公历出生年的偏移 }。
// 立春界:立春前生人岁次属上一年(yearShift=-1);冬至界(天正建子):冬至后生人岁次属下一年(+1);公历元旦恒 0。
// 此前立春/冬至两档要 chart.nongli.jieqi 的 lichun/dongzhi 字段,后端恒 null → 静默回退元旦(死档);
// 现由本地节气表(lunar-javascript,AD1–9999)精算年界时刻,缺表仍回退元旦。
export function birthYearBasis(chart, fields, mode){
	let Y; let Mo; let D; let h = 0; let mi = 0; let s = 0;
	const pd = chart && chart.params && chart.params.date;
	const pt = chart && chart.params && chart.params.time;
	if(pd){ const m = `${pd}`.match(/(-?\d+)\D+(\d+)\D+(\d+)/); if(m){ Y = +m[1]; Mo = +m[2]; D = +m[3]; } }
	if(pt){ const m = `${pt}`.match(/(\d+):(\d+)(?::(\d+))?/); if(m){ h = +m[1]; mi = +m[2]; s = +(m[3] || 0); } }
	if(!Number.isFinite(Y) && fields && fields.date && fields.date.value && typeof fields.date.value.year === 'function'){
		// moment 的年月日是外推格里历 + 天文年:落到儒略日上再按民用历拆(1582 以后恒等)
		const dv = fields.date.value;
		const tv = fields.time && fields.time.value;
		const th = tv && typeof tv.hour === 'function' ? [tv.hour(), tv.minute(), tv.second()] : [0, 0, 0];
		const p = civilPartsFromJd(gregJulday(dv.year(), dv.month() + 1, dv.date(), th[0] + th[1] / 60 + th[2] / 3600, true));
		Y = p.year; Mo = p.month; D = p.day; h = p.hour; mi = p.minute; s = p.second;
	}
	// 🔴 第三来源(最可靠·后端排盘产出):chart.date = {jd, date:{jdn}, time:{value}, utcoffset:{value}}。
	// wheel 收到的 chart 常无 params(root.params 缺→graft 落空)、fields.date.value 也非 moment,
	// 前两路都取不到出生日 → birthFrac 静默算成 0 → 百六大限整体差 1 岁(寅卯宫界/环最大岁数)。
	// jd 为 UT 儒略日,+utcoffset 得当地民用时刻,按民用历(1582-10-15 以前儒略历、历史纪年)拆成年月日时分秒,
	// 与第一来源的日期串同一口径(照 Moira work_cal:Java GregorianCalendar 在 1582 以前本就按儒略历)。
	// 第四来源:盘里缺 jd(无头重算拿到的盘不带出生时刻)时,按出生字段(日期 / 时间 / 时区 / 公元前后)补算 ——
	// 与起盘请求同取 date.value / time.value / zone / ad(fieldsToParams 同源),儒略日走 DateTime.calcJdn
	// (1582-10-15 起格里历、此前儒略历,与后端民用历法口径同),再按下面同一条 jd → 民用历字段的换法,
	// 所以带 jd 与缺 jd 的同一张盘结果逐字相同(此前缺 jd → 岁份恒 0,三种年界算成一样)。
	let jdSrc = null;
	if(!Number.isFinite(Y) && chart && chart.date && Number.isFinite(Number(chart.date.jd))){
		jdSrc = {
			jd: Number(chart.date.jd),
			off: chart.date.utcoffset && Number.isFinite(Number(chart.date.utcoffset.value)) ? Number(chart.date.utcoffset.value) : 0,
		};
	}
	if(!Number.isFinite(Y) && !jdSrc){ jdSrc = birthJdFromFields(fields); }
	if(!Number.isFinite(Y) && jdSrc){
		const jd = jdSrc.jd;
		const off = jdSrc.off;
		const localJd = jd + off / 24;
		if(Number.isFinite(localJd)){
			const p = civilPartsFromJd(localJd);
			Y = p.year; Mo = p.month; D = p.day; h = p.hour; mi = p.minute; s = p.second;
		}
	}
	if(!Number.isFinite(Y) || !Number.isFinite(Mo) || !Number.isFinite(D)){ return { frac: 0, yearShift: 0 }; }
	const MS_YEAR = 365.25 * 24 * 60 * 60 * 1000;
	// 出生与年界都落在同一条民用历墙钟轴上(civilWallMs:1582 以后 = Date.UTC,此前儒略历,年份按历史纪年)。
	const birthMs = civilWallMs(Y, Mo, D, h, mi, s);
	// 年界起点(默认民用历元旦;立春/冬至由 solarTermBoundaryMs 提供,缺则元旦)。
	let boundaryMs = civilWallMs(Y, 1, 1, 0, 0, 0);
	let yearShift = 0;
	if(mode === 'lichun' || mode === 'dongzhi'){
		const b = solarTermBoundaryMs(chart, Y, birthMs, mode, chartZoneHours(chart, fields));
		if(Number.isFinite(b.ms)){ boundaryMs = b.ms; yearShift = b.yearShift; }
	}
	let frac = (birthMs - boundaryMs) / MS_YEAR;
	if(!Number.isFinite(frac)){ return { frac: 0, yearShift: 0 }; }
	// 归一到 [0,1)(立春/冬至基准时出生可能落在年界前)。
	frac = ((frac % 1) + 1) % 1;
	return { frac, yearShift };
}

// 出生字段 → { jd 世界时儒略日, off 时区小时 };字段不是 DateTime(或缺)时返回 null。
function birthJdFromFields(fields){
	const dv = fields && fields.date && fields.date.value;
	if(!dv || typeof dv.calcJdn !== 'function' || typeof dv.clone !== 'function'){ return null; }
	const t = dv.clone();
	const tv = fields.time && fields.time.value;
	if(tv && Number.isFinite(Number(tv.hour))){
		t.hour = Number(tv.hour); t.minute = Number(tv.minute) || 0; t.second = Number(tv.second) || 0;
	}
	if(fields.zone && typeof fields.zone.value === 'string' && fields.zone.value){ t.zone = fields.zone.value; }
	if(fields.ad && (fields.ad.value === 1 || fields.ad.value === -1)){ t.ad = fields.ad.value; }
	if(![t.year, t.month, t.date].every((v)=>Number.isFinite(Number(v)))){ return null; }
	const jd = t.calcJdn();
	const off = t.getZoneJdn() * 24;
	return Number.isFinite(jd) && Number.isFinite(off) ? { jd, off } : null;
}

// 盘时区(小时):params.zone '+08:00' → fields.zone/date.zone → chart.date.utcoffset;缺则 +8(本地节气表基准,零换算)。
function chartZoneHours(chart, fields){
	const parseZone = (z)=>{
		if(z == null || z === ''){ return NaN; }
		if(typeof z === 'number'){ return z; }
		const m = `${z}`.match(/^([+-])?(\d{1,2})(?::?(\d{2}))?$/);
		if(!m){ return NaN; }
		const v = Number(m[2]) + (m[3] ? Number(m[3]) / 60 : 0);
		return m[1] === '-' ? -v : v;
	};
	const cands = [
		chart && chart.params && chart.params.zone,
		fields && fields.zone && fields.zone.value,
		fields && fields.date && fields.date.value && fields.date.value.zone,
		chart && chart.date && chart.date.utcoffset && chart.date.utcoffset.value,
	];
	for(let i = 0; i < cands.length; i++){
		const v = parseZone(cands[i]);
		if(Number.isFinite(v)){ return v; }
	}
	return 8;
}

// 本地节气表取某公历年的立春/冬至时刻(表值为 +08:00 墙钟)→ 换到盘时区墙钟毫秒(与 birthMs 同域,UTC 读取)。
function localTermWallMs(year, term, zoneHours){
	// 本地表按「农历年」建表:键「冬至」= 该年之前一个冬至(Y−1 年 12 月),故取公历 Y 年 12 月冬至须查 Y+1 年表(实证 2005–2007 三年)。
	const seedYear = term === '冬至' ? year + 1 : year;
	let seed = null;
	try{ seed = buildLocalJieqiYearSeed(seedYear, null); }catch(e){ seed = null; }
	const t = seed && seed[term] && seed[term].time ? `${seed[term].time}` : '';
	const m = t.match(/(-?\d+)-(\d+)-(\d+)\D+(\d+):(\d+)(?::(\d+))?/);
	if(!m){ return NaN; }
	// 节气表的时刻串是民用历标签(1582 以前儒略历),按民用历墙钟轴读(与 birthMs 同轴)
	const cstMs = civilWallMs(+m[1], +m[2], +m[3], +m[4], +m[5], +(m[6] || 0));
	return cstMs + (zoneHours - 8) * 3600000;
}

// 立春/冬至 年界(增强项):chart.nongli 若给出 lichun/dongzhi 时刻优先;否则本地节气表精算;皆缺返回 NaN 让调用方回退公历元旦。
// 返回 { ms 年界墙钟毫秒, yearShift 岁次年号偏移 }:立春界取「≤出生」的最近一次立春(立春前生人=上一年立春,yearShift −1);
// 冬至界取「≤出生」的最近一次冬至(冬至后生人年界=本年冬至,天正岁次属下一年 +1;冬至前生人=上一年冬至,岁次=本年 0)。
function solarTermBoundaryMs(chart, year, birthMs, mode, zoneHours){
	const key = mode === 'dongzhi' ? 'dongzhi' : 'lichun';
	const term = mode === 'dongzhi' ? '冬至' : '立春';
	const jq = chart && chart.nongli && (chart.nongli.jieqi || chart.nongli.solarTerms);
	const parse = (v)=>{
		if(v == null){ return NaN; }
		if(typeof v === 'number'){ return v; }
		const m = `${v}`.match(/(-?\d+)\D+(\d+)\D+(\d+)(?:\D+(\d+)\D+(\d+))?/);
		return m ? civilWallMs(+m[1], +m[2], +m[3], +(m[4] || 0), +(m[5] || 0), 0) : NaN;
	};
	const zh = Number.isFinite(zoneHours) ? zoneHours : 8;
	// 本年该节气时刻:chart 显式字段优先,否则本地节气表。
	let cur = (jq && typeof jq === 'object') ? parse(jq[key]) : NaN;
	if(!Number.isFinite(cur)){ cur = localTermWallMs(year, term, zh); }
	if(!Number.isFinite(cur)){ return { ms: NaN, yearShift: 0 }; }
	if(cur <= birthMs){
		// 出生在本年节气之后:年界=本年节气。冬至界天正岁次属下一年。
		return { ms: cur, yearShift: mode === 'dongzhi' ? 1 : 0 };
	}
	// 出生在本年节气之前:年界=上一年节气(本地表精算;缺表回退 −365.25 日近似)。
	let prev = localTermWallMs(year - 1, term, zh);
	if(!Number.isFinite(prev)){ prev = cur - 365.25 * 24 * 60 * 60 * 1000; }
	return { ms: prev, yearShift: mode === 'lichun' ? -1 : 0 };
}

// 自锚点起累计的度偏移 s(照 Moira getLimitDegree:val = age − 1 − birthFrac,逐宫消耗 segment 年数,宫内 30° 线性)。
// birthFrac 缺省 0 → 与旧版零回归;childBase 缺省 9(定童限 九年起)。
export function limitAgeOffset(life, age, birthFrac, childBase){
	const segments = limitSegments(life, childBase);
	let rest = Number(age || 1) - 1 - (Number(birthFrac) || 0);
	let offset = 0;
	for(let i = 0; i < segments.length; i++){
		const span = Math.max(0.1, segments[i]);
		if(rest < span){  // 照 Moira nowYearPosition 严格 <(ChartData.java:3906);= 时归下一宫界,元旦 00:00 出生盘不错位
			return offset + 30 * rest / span;
		}
		offset += 30;
		rest -= span;
	}
	return offset;  // 累计满 360(超百六大限总年数)
}

// 逆:度偏移 → 虚岁(含 birthFrac 回加,与 limitAgeOffset 对称,供宫界年份标签)。
function limitAgeAtOffset(life, offset, birthFrac, childBase){
	const segments = limitSegments(life, childBase);
	let rest = Math.max(0, Number(offset || 0));
	let years = 0;
	for(let i = 0; i < segments.length; i++){
		const span = Math.max(0.1, segments[i]);
		if(rest <= 30){
			years += rest / 30 * span;
			break;
		}
		years += span;
		rest -= 30;
	}
	return 1 + years + (Number(birthFrac) || 0);
}

// 限度黄经(度)= 锚点 − 累计偏移(Moira 反向排限:度数随岁增而减,pos = normalize(degree_offset − s))。
export function limitDegreeForAge(life, age, birthFrac, childBase){
	return norm(limitAnchor(life) - limitAgeOffset(life, age, birthFrac, childBase));
}

// 度 → 自锚点的偏移(供年份标签逆算,与 limitDegreeForAge 同锚,保证宫界年份与刻度一致)。
export function limitOffsetFromLife(life, degree){
	return norm(limitAnchor(life) - Number(degree || 0));
}

export function limitYearForDegree(birthYear, life, degree, birthFrac, childBase){
	return birthYear + Math.floor(limitAgeAtOffset(life, limitOffsetFromLife(life, degree), birthFrac, childBase) - 1);
}

// 大限表（古度限度法，与年龄环同一套 limitSegments → 二者必然一致）：
// 自命宫起逐宫一段，每段年数取 limitSegments(life)，首段=命度入宫度推算。
// birthFrac(年界内已历年分数,照 Moira val=age−1−birthFrac)可选:与岁数带同口径;缺省 0 = 旧表逐字不变。
// birthYear 由调用方按年界基准传入岁次年号(公历年 + yearShift)。
export function buildGuolaoLimitTable(life, birthYear, childBase, birthFrac){
	const segs = limitSegments(life, childBase);
	const rows = [];
	let age = 1 + (Number.isFinite(Number(birthFrac)) ? Number(birthFrac) : 0);
	for(let k = 0; k < 12; k++){
		const span = Math.max(0.5, segs[k] || 0);
		const fromAge = Math.round(age);
		const toAge = Math.round(age + span) - 1;
		rows.push({
			index: k + 1,
			palace: HOUSE_BRANCH[k],
			years: Math.round(span * 10) / 10,
			fromAge,
			toAge,
			fromYear: birthYear + fromAge - 1,
			toYear: birthYear + toAge - 1,
		});
		age += span;
	}
	return rows;
}

export function currentLimitIndex(rows, age){
	if(!Array.isArray(rows) || !Number.isFinite(age)){
		return -1;
	}
	for(let i = 0; i < rows.length; i++){
		if(age >= rows[i].fromAge && age <= rows[i].toAge){
			return i;
		}
	}
	return -1;
}

export function birthYearFrom(root, chart, fields){
	const fromParam = root && root.params && root.params.date;
	const fromField = fields && fields.date && fields.date.value && fields.date.value.format
		? fields.date.value.format('YYYY') : '';
	const raw = fromParam || fromField || '';
	const match = `${raw}`.match(/-?\d{3,4}/);
	if(match){
		return parseInt(match[0], 10);
	}
	const bazi = (root && root.nongli && root.nongli.bazi) || (chart && chart.nongli && chart.nongli.bazi);
	if(bazi && bazi.year && bazi.year.year){
		return Number(bazi.year.year);
	}
	return new Date().getFullYear();
}
