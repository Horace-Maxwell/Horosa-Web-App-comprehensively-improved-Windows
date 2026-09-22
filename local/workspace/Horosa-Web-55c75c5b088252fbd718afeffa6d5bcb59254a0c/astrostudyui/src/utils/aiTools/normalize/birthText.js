// AI 助手·出生/起课时间多形态归一 → 'YYYY-MM-DD HH:mm:ss'(与 aiAnalysisContext.parseBirthString 正则同构)。
// 支持:ISO/斜杠/点分日期、「1990年1月1日早上8点半」中文时刻(日段词+中文数字+半/刻/分)、十二时辰、
// 公元前(前100年/BC/-0100)、农历(农历/阴历 + 正/冬/腊/闰X月 + 初一…卅,经 lunar-javascript 换算)。
import { Lunar } from 'lunar-javascript';
import { isLunarJsYearReliable } from '../../lunarDomainGuard';

export const BIRTH_OUTPUT_PATTERN = /^(-?\d+)-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/;

const CN_DIGIT = { '零': 0, '〇': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
function cnNumber(text){
	const s = `${text || ''}`.trim();
	if(!s){ return null; }
	if(/^\d+$/.test(s)){ return parseInt(s, 10); }
	let total = 0;
	let cur = 0;
	let sawTen = false;
	for(const ch of s){
		if(ch === '十'){
			total += (cur === 0 ? 1 : cur) * 10; cur = 0; sawTen = true;
		}else if(ch === '廿'){
			total += 20; cur = 0; sawTen = true;
		}else if(ch === '卅'){
			total += 30; cur = 0; sawTen = true;
		}else if(CN_DIGIT[ch] !== undefined){
			cur = cur * 10 + CN_DIGIT[ch];
		}else{
			return null;
		}
	}
	return total + cur + (sawTen ? 0 : 0);
}
function cnDigitsToNumber(text){
	// 逐字数字串(如「一九九〇」)
	let out = '';
	for(const ch of `${text}`){
		if(/\d/.test(ch)){ out += ch; }
		else if(CN_DIGIT[ch] !== undefined){ out += CN_DIGIT[ch]; }
		else{ return null; }
	}
	return out ? parseInt(out, 10) : null;
}

const SHICHEN = { '子': 0, '丑': 2, '寅': 4, '卯': 6, '辰': 8, '巳': 10, '午': 12, '未': 14, '申': 16, '酉': 18, '戌': 20, '亥': 22 };
const PERIOD_WORDS = ['凌晨', '清晨', '早晨', '早上', '上午', '中午', '正午', '午后', '下午', '傍晚', '黄昏', '晚上', '晚间', '夜晚', '夜里', '深夜', '半夜', '午夜'];

function pad2(n){ return (n < 10 ? '0' : '') + n; }
function padYear(y){
	if(y < 0){ return '-' + `${Math.abs(y)}`.padStart(4, '0'); }
	return `${y}`.padStart(4, '0');
}

function applyPeriod(hour, period, assumptions){
	if(hour === null || hour === undefined){ return hour; }
	let h = hour;
	switch(period){
		case '下午': case '午后': case '傍晚': case '黄昏': case '晚上': case '晚间': case '夜晚':
			if(h < 12){ h += 12; }
			else if(h === 12 && (period === '晚上' || period === '晚间' || period === '夜晚')){ h = 0; assumptions.push('「晚上12点」按当日 00:00 计'); }
			break;
		case '中午': case '正午':
			if(h < 6){ h += 12; }
			break;
		case '夜里': case '深夜': case '半夜': case '午夜':
			if(h === 12){ h = 0; assumptions.push(`「${period}12点」按当日 00:00 计`); }
			else if(h >= 6 && h < 12){ h += 12; }
			break;
		case '凌晨':
			// 口语「凌晨12点」= 当日 00:00(与「中午12点」相对)
			if(h === 12){ h = 0; assumptions.push('「凌晨12点」按当日 00:00 计'); }
			break;
		default:
			// 清晨/早晨/早上/上午:原样(12 保持 12)
			break;
	}
	return h;
}

// 十二时辰:不吃「上午/下午/中午」里的「午」,也不吃「时候/时间/时期」里的「时」(无 lookbehind:老 WebKit 不支持)
function findShichen(s){
	const re = /([子丑寅卯辰巳午未申酉戌亥])时/g;
	let m;
	while((m = re.exec(s)) !== null){
		const prev = m.index > 0 ? s.charAt(m.index - 1) : '';
		const next = s.charAt(m.index + m[0].length);
		// 注意 ''.indexOf('') === 0:空字符必须先排除,否则串首/串尾的时辰全被误跳
		if(prev !== '' && '上下中'.indexOf(prev) >= 0 && m[1] === '午'){ continue; }
		if(next !== '' && '候间間期刻'.indexOf(next) >= 0){ continue; }
		return m;
	}
	return null;
}

// 显式 AM/PM(英文口语/ISO 变体):pm 且 h<12 → +12;am 且 h===12 → 0
function applyAmPm(h, s, assumptions){
	// 「8:30pm」数字后紧跟 pm 没有 \b 词边界:前缀允许数字/空白/串首
	const ampm = s.match(/(?:^|[\d\s])(am|pm)\b|(?:^|[\d\s])([ap])\.m\./i);
	if(!ampm){ return { h, hit: false }; }
	const isPm = /^p/i.test(ampm[1] || ampm[2]);
	if(isPm && h < 12){ h += 12; }
	if(!isPm && h === 12){ h = 0; assumptions.push('「12 AM」按当日 00:00 计'); }
	return { h, hit: true };
}

// 从文本里抽时间部分 → {hour, minute, second, found, assumptions}
function parseTimePart(text, assumptions){
	const s = text;
	// 1) HH:mm[:ss]
	let m = s.match(/(\d{1,2})[:：](\d{1,2})(?:[:：](\d{1,2}))?/);
	let period = PERIOD_WORDS.find((w)=>s.indexOf(w) >= 0) || null;
	if(m){
		let h = parseInt(m[1], 10);
		const minute = parseInt(m[2], 10);
		const second = m[3] ? parseInt(m[3], 10) : 0;
		// 分/秒越界 = 时间写错,诚实报「无法解析」而不是当成「没给时辰」
		if(minute > 59 || second > 59 || h > 24){ return { found: false, invalid: true }; }
		const ap = applyAmPm(h, s, assumptions);
		h = ap.hit ? ap.h : applyPeriod(h, period, assumptions);
		if(h === 24){ h = 0; }
		return { hour: h, minute, second, found: true };
	}
	// 2) 中文时刻:N点/N时 [半|一刻|三刻|N分](先于时辰:「下午三点」不能被「午时」抢走)
	const t = s.match(/([\d零〇一二两三四五六七八九十]{1,3})\s*[点時时]\s*(半|一刻|三刻|[\d零〇一二两三四五六七八九十]{1,3}\s*分?)?/);
	if(t){
		let h = cnNumber(t[1]);
		if(h === null || h > 24){ return { found: false }; }
		let minute = 0;
		if(t[2]){
			const q = t[2].replace(/\s*分$/, '').trim();
			if(q === '半'){ minute = 30; }
			else if(q === '一刻'){ minute = 15; }
			else if(q === '三刻'){ minute = 45; }
			else{ const mm = cnNumber(q); minute = mm === null ? 0 : mm; }
		}
		h = applyPeriod(h, period, assumptions);
		if(h === 24){ h = 0; }
		if(minute > 59){ return { found: false, invalid: true }; }
		return { hour: h, minute, second: 0, found: true };
	}
	// 3) 十二时辰(子时…亥时)
	const sc = findShichen(s);
	if(sc){
		const base = SHICHEN[sc[1]];
		if(sc[1] === '子'){ assumptions.push('「子时」按早子时 00:00 计(如为晚子时 23:00 请明确)'); }
		else{ assumptions.push(`「${sc[1]}时」按时辰起点 ${pad2(base)}:00 计`); }
		return { hour: base, minute: 0, second: 0, found: true };
	}
	return { found: false };
}

// 日期合法性:公历(公元后)按格里历,公元前按儒略闰法(BC Y 闰 ⇔ Y%4===1);农历交给 lunar 库
function dayValid(year, month, day, eraNegative){
	if(!(month >= 1 && month <= 12) || !(day >= 1 && day <= 31)){ return false; }
	const leap = eraNegative ? (year % 4 === 1) : ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0);
	const dim = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
	return day <= dim;
}

const LUNAR_MONTH_NAMES = { '正': 1, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10, '十一': 11, '冬': 11, '十二': 12, '腊': 12, '臘': 12 };
function lunarDay(text){
	const s = text.replace(/^初/, '');
	if(/^初/.test(text)){ return cnNumber(s); }
	if(/^廿/.test(text)){ return 20 + (cnNumber(text.slice(1)) || 0); }
	if(text === '卅'){ return 30; }
	if(/^卅/.test(text)){ return 30 + (cnNumber(text.slice(1)) || 0); }
	return cnNumber(text);
}

// 主入口
export function parseBirthInput(rawText, { calendar = 'solar', timeUnknown = false } = {}){
	const assumptions = [];
	const text = `${rawText || ''}`.trim().replace(/\s+/g, ' ');
	if(!text){ return { ok: false, code: 'E_BIRTH_UNPARSEABLE', assumptions }; }
	const isLunar = calendar === 'lunar' || /农历|農曆|阴历|陰曆|旧历|舊曆|夏历/.test(text);

	let year = null;
	let month = null;
	let day = null;
	let eraNegative = false;
	let leap = false;
	let body = text.replace(/农历|農曆|阴历|陰曆|旧历|舊曆|夏历|公历|公曆|阳历|陽曆/g, '');

	// 纪元:前N年 / 公元前N年 / BC N / -NNNN-
	let era = body.match(/(?:公元前|前)\s*(\d{1,5})\s*年/) || body.match(/\bBC\s*(\d{1,5})/i);
	if(era){ eraNegative = true; year = parseInt(era[1], 10); body = body.replace(era[0], ' 年 '); }

	// 显式时区后缀(ISO 变体 …T08:30:00+08:00 / Z):不丢弃,作 zoneHint 交给调用方(用户明说的 zone 仍优先)
	let zoneHint;
	const tz = body.match(/\d{1,2}:\d{2}(?::\d{2})?\s*(Z|[+-]\d{2}:?\d{2})\s*$/i);
	if(tz){
		zoneHint = /^z$/i.test(tz[1]) ? '+00:00' : tz[1].replace(/^([+-]\d{2})(\d{2})$/, '$1:$2');
		body = body.slice(0, body.length - tz[1].length).trim();
		body = body.replace(/T(?=\d{1,2}:)/, ' ');
	}
	// D/M/YYYY 与 M/D/YYYY:首段>12 判日,次段>12 判月,两者皆 ≤12 且不等 = 歧义 → 不猜,让模型换 YYYY-MM-DD
	const dmy = body.match(/(?:^|[^\d-])(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?!\d)/);
	if(dmy && year === null){
		const a = parseInt(dmy[1], 10), b = parseInt(dmy[2], 10);
		if(a > 12 && b <= 12){ day = a; month = b; }
		else if(b > 12 && a <= 12){ month = a; day = b; }
		else if(a === b){ month = a; day = b; }
		else { return { ok: false, code: 'E_BIRTH_UNPARSEABLE', assumptions: assumptions.concat(['日期形如 DD/MM/YYYY 与 MM/DD/YYYY 歧义,请改用 YYYY-MM-DD']) }; }
		year = parseInt(dmy[3], 10);
		body = body.replace(dmy[0], ' ');
	}
	// ISO / 斜杠 / 点分:YYYY-MM-DD 或 -YYYY-MM-DD(年至少 3 位:「90年」不猜世纪;日后面不能紧跟 点/时/冒号/数字——
	// 「1990年5月 8点」的 8 是钟点不是日)
	let iso = year === null ? body.match(/(-?\d{3,5})[-/.年]\s*(\d{1,2})[-/.月]\s*(\d{1,2})(?![\d])(?!\s*[点時时:：])\s*[日号]?/) : null;
	if(iso){
		year = parseInt(iso[1], 10); if(year < 0){ eraNegative = true; year = Math.abs(year); }
		month = parseInt(iso[2], 10); day = parseInt(iso[3], 10);
		body = body.replace(iso[0], ' ');
	}else if(year === null || month === null){
		// 中文年月日:一九九〇年正月初一 / 1990年闰四月初五
		const cy = body.match(/([\d零〇一二三四五六七八九]{3,5})\s*年/);
		if(cy && year === null){ year = cnDigitsToNumber(cy[1]); body = body.replace(cy[0], ' '); }
		const cm = body.match(/(闰|閏)?\s*(\d{1,2}|正|十一|十二|冬|腊|臘|[一二三四五六七八九十]{1,2})\s*月/);
		if(cm){ leap = !!cm[1]; month = LUNAR_MONTH_NAMES[cm[2]] !== undefined ? LUNAR_MONTH_NAMES[cm[2]] : cnNumber(cm[2]); body = body.replace(cm[0], ' '); }
		const cd = body.match(/(初[一二三四五六七八九十]|廿[一二三四五六七八九]?|卅[一]?|[一二三四五六七八九十]{1,3}|\d{1,2})(?![\d])(?!\s*[点時时:：])\s*[日号]?/);
		if(cd && month !== null){
			day = isLunar ? lunarDay(cd[1]) : (cnNumber(cd[1]) === null ? cnDigitsToNumber(cd[1]) : cnNumber(cd[1]));
			body = body.replace(cd[0], ' ');
		}
	}
	if(year === null || month === null || day === null){
		return { ok: false, code: 'E_BIRTH_UNPARSEABLE', assumptions };
	}
	if(!(month >= 1 && month <= 12) || !(day >= 1 && day <= 31)){
		return { ok: false, code: 'E_BIRTH_UNPARSEABLE', assumptions };
	}

	// 时间
	const tp = parseTimePart(body, assumptions);
	let hour = 0, minute = 0, second = 0;
	if(tp.invalid){ return { ok: false, code: 'E_BIRTH_UNPARSEABLE', assumptions }; }
	if(tp.found){
		hour = tp.hour; minute = tp.minute; second = tp.second || 0;
		if(!(hour >= 0 && hour <= 23) || !(minute >= 0 && minute <= 59)){ return { ok: false, code: 'E_BIRTH_UNPARSEABLE', assumptions }; }
	}else if(timeUnknown){
		hour = 12; minute = 0; second = 0;
		assumptions.push('出生时辰未知,按正午 12:00 建档');
	}else{
		return { ok: false, code: 'E_BIRTH_TIME_MISSING', assumptions };
	}

	let outY = eraNegative ? -year : year;
	let outM = month, outD = day;
	let echo = '';
	if(isLunar){
		if(eraNegative || !isLunarJsYearReliable(year)){
			return { ok: false, code: 'E_LUNAR_UNSUPPORTED_RANGE', assumptions };
		}
		try{
			const lunar = Lunar.fromYmdHms(year, leap ? -month : month, day, hour, minute, second);
			const solar = lunar.getSolar();
			outY = solar.getYear(); outM = solar.getMonth(); outD = solar.getDay();
			echo = `农历${lunar.getYearInGanZhi()}年${leap ? '闰' : ''}${lunar.getMonthInChinese()}月${lunar.getDayInChinese()} ${pad2(hour)}:${pad2(minute)} → 公历 ${padYear(outY)}-${pad2(outM)}-${pad2(outD)} ${pad2(hour)}:${pad2(minute)}`;
			assumptions.push(`农历已换算为公历 ${padYear(outY)}-${pad2(outM)}-${pad2(outD)},请向用户复述确认`);
		}catch(e){
			return { ok: false, code: 'E_BIRTH_UNPARSEABLE', assumptions };
		}
	}else{
		if(!dayValid(year, month, day, eraNegative)){ return { ok: false, code: 'E_BIRTH_UNPARSEABLE', assumptions }; }
		echo = `${eraNegative ? '公元前' : ''}${padYear(outY)}-${pad2(outM)}-${pad2(outD)} ${pad2(hour)}:${pad2(minute)}(公历)`;
	}
	const birth = `${padYear(outY)}-${pad2(outM)}-${pad2(outD)} ${pad2(hour)}:${pad2(minute)}:${pad2(second)}`;
	if(!BIRTH_OUTPUT_PATTERN.test(birth)){
		return { ok: false, code: 'E_BIRTH_UNPARSEABLE', assumptions };
	}
	return { ok: true, birth, ad: outY < 0 ? -1 : 1, calendar: isLunar ? 'lunar' : 'solar', timeGiven: tp.found, assumptions, echo, zoneHint };
}
