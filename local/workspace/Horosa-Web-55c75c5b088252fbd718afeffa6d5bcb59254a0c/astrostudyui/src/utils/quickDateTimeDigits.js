// 快捷数字时间录入·解析单源(纯函数,不碰 React/DOM)。
// 规则(用户定版 2026-09-07):连续数字按「年 4 位 + 月日时分秒各 2 位」共 14 位切分;
//   不足位自动补 0(月、日补出的 00 按 01 处理——与 DateTime.parse 裸年份补 01/01 的既有约定一致);
//   多出的位直接丢弃;非数字(分隔符/空格/全角数字)先剥/折半角再切,粘贴 2006-10-04 09:58:01 也能用。
//   越界(年 0000、月 13+、日超当月天数、时 24+、分秒 60+)一律拒绝并给出人话错误,调用方保留旧值。
//   纪元强制公元(数字表达不了公元前),时区沿用基值。
import DateTime from '../components/comp/DateTime';

export const QUICK_DIGITS_LEN = 14;
export const QUICK_DIGITS_ERROR_PREFIX = '快捷时间无效：';

const FULLWIDTH_ZERO = 0xFF10;
const FULLWIDTH_NINE = 0xFF19;

function foldFullWidthDigits(text){
	let out = '';
	for(let i = 0; i < text.length; i++){
		const code = text.charCodeAt(i);
		if(code >= FULLWIDTH_ZERO && code <= FULLWIDTH_NINE){
			out += String.fromCharCode(code - FULLWIDTH_ZERO + 48);
		}else{
			out += text[i];
		}
	}
	return out;
}

// 任意输入 → { digits(≤14 位纯数字), truncated(是否丢弃了多余位) }
export function normalizeQuickDigits(raw){
	const text = foldFullWidthDigits(`${raw === undefined || raw === null ? '' : raw}`);
	const all = text.replace(/\D+/g, '');
	return {
		digits: all.slice(0, QUICK_DIGITS_LEN),
		truncated: all.length > QUICK_DIGITS_LEN,
	};
}

function pad2(n){
	return n < 10 ? `0${n}` : `${n}`;
}

// 解析(不构造 DateTime):回 { ok, digits, padded, truncated, parts, error, errorCode }
//   errorCode ∈ 'empty' | 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second'
export function parseQuickDateTimeDigits(raw){
	const { digits, truncated } = normalizeQuickDigits(raw);
	if(!digits){
		return { ok: false, digits, padded: '', truncated, parts: null, error: '', errorCode: 'empty' };
	}
	const padded = digits.padEnd(QUICK_DIGITS_LEN, '0');
	const year = parseInt(padded.slice(0, 4), 10);
	let month = parseInt(padded.slice(4, 6), 10);
	let day = parseInt(padded.slice(6, 8), 10);
	const hour = parseInt(padded.slice(8, 10), 10);
	const minute = parseInt(padded.slice(10, 12), 10);
	const second = parseInt(padded.slice(12, 14), 10);
	if(month === 0){ month = 1; }
	if(day === 0){ day = 1; }
	const parts = { year, month, day, hour, minute, second };
	const fail = (errorCode, error)=>({ ok: false, digits, padded, truncated, parts, error: `${QUICK_DIGITS_ERROR_PREFIX}${error}`, errorCode });
	if(year < 1){ return fail('year', '年份不能为 0000'); }
	if(month > 12){ return fail('month', `月份须在 01–12（输入 ${pad2(month)}）`); }
	const monthDays = new DateTime().getMonthDays(year, month);
	if(day > monthDays){ return fail('day', `${year} 年 ${month} 月只有 ${monthDays} 天（输入 ${pad2(day)}）`); }
	if(hour > 23){ return fail('hour', `小时须在 00–23（输入 ${pad2(hour)}）`); }
	if(minute > 59){ return fail('minute', `分钟须在 00–59（输入 ${pad2(minute)}）`); }
	if(second > 59){ return fail('second', `秒须在 00–59（输入 ${pad2(second)}）`); }
	return { ok: true, digits, padded, truncated, parts, error: '', errorCode: null };
}

// 解析并落到 DateTime:基值(可空)只贡献时区;结果永远是新实例、公元、jdn 已重算。
export function applyQuickDigits(baseDateTime, raw, opts){
	const parsed = parseQuickDateTimeDigits(raw);
	const zone = (opts && opts.zone) || (baseDateTime && baseDateTime.zone) || undefined;
	if(!parsed.ok){
		return { ...parsed, dt: null, zone: zone || null };
	}
	let dt;
	try{
		dt = baseDateTime && typeof baseDateTime.clone === 'function' ? baseDateTime.clone() : new DateTime(zone ? { zone } : undefined);
		if(zone){ dt.zone = zone; }
		dt.ad = 1;
		const p = parsed.parts;
		dt.setDateTime(p.year, p.month, p.day, p.hour, p.minute, p.second);
	}catch(e){
		return { ...parsed, ok: false, dt: null, zone: zone || null, error: `${QUICK_DIGITS_ERROR_PREFIX}无法构造时间（${(e && e.message) || e}）`, errorCode: 'invalid' };
	}
	return { ...parsed, dt, zone: dt.zone };
}

// DateTime → 14 位数字串(仅公元且年份 ≤ 9999;其余回 null,调用方据此判断「上方时间是否等于已录入的数字」)
export function formatQuickDigits(dt){
	if(!dt || dt.ad !== 1 || !(dt.year >= 1 && dt.year <= 9999)){
		return null;
	}
	const y = `${dt.year}`.padStart(4, '0');
	return `${y}${pad2(dt.month)}${pad2(dt.date)}${pad2(dt.hour)}${pad2(dt.minute)}${pad2(dt.second)}`;
}

// ===== 日期/时间选择框(antd DatePicker/RangePicker/TimePicker)「数字快输」:按 format 切 =====
// 只认 YYYY / MM / DD / HH / mm / ss 六种记号,按其在 format 中出现的顺序依次吃 4/2/2/2/2/2 位;
// 缺位补 0(月、日补出的 00 → 01;无日期记号的 format 只算时分秒),多余位丢弃;
// 选择框的值是 moment(proleptic 格里高利历),所以月天数按格里高利闰规则,与 DateTime 的儒略切换无关。
const FORMAT_TOKEN_RE = /YYYY|MM|DD|HH|mm|ss/g;

export function pickerFormatTokens(format){
	const s = Array.isArray(format) ? format[0] : format;
	if(typeof s !== 'string'){ return []; }
	const out = [];
	s.replace(FORMAT_TOKEN_RE, (m)=>{ out.push(m); return m; });
	return out;
}

export function pickerDigitsLength(format){
	return pickerFormatTokens(format).reduce((n, t)=>n + t.length, 0);
}

function gregorianMonthDays(year, month){
	const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
	return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

// 回 { ok, digits, padded, truncated, parts:{year|null,month|null,day|null,hour,minute,second}, tokens, error, errorCode }
//   errorCode ∈ 'format'(format 无可识别记号)| 'empty' | 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second'
export function parseQuickDigitsForFormat(raw, format){
	const tokens = pickerFormatTokens(format);
	const total = tokens.reduce((n, t)=>n + t.length, 0);
	const text = foldFullWidthDigits(`${raw === undefined || raw === null ? '' : raw}`);
	const all = text.replace(/\D+/g, '');
	const digits = all.slice(0, total);
	const truncated = all.length > total;
	if(!tokens.length){
		return { ok: false, digits, padded: '', truncated, parts: null, tokens, error: '', errorCode: 'format' };
	}
	if(!digits){
		return { ok: false, digits, padded: '', truncated, parts: null, tokens, error: '', errorCode: 'empty' };
	}
	const padded = digits.padEnd(total, '0');
	const parts = { year: null, month: null, day: null, hour: 0, minute: 0, second: 0 };
	let pos = 0;
	tokens.forEach((t)=>{
		const v = parseInt(padded.slice(pos, pos + t.length), 10);
		pos += t.length;
		if(t === 'YYYY'){ parts.year = v; }
		else if(t === 'MM'){ parts.month = v; }
		else if(t === 'DD'){ parts.day = v; }
		else if(t === 'HH'){ parts.hour = v; }
		else if(t === 'mm'){ parts.minute = v; }
		else { parts.second = v; }
	});
	const hasDate = parts.year !== null;
	if(hasDate){
		if(parts.month === null || parts.month === 0){ parts.month = 1; }
		if(parts.day === null || parts.day === 0){ parts.day = 1; }
	}
	const fail = (errorCode, error)=>({ ok: false, digits, padded, truncated, parts, tokens, error: `${QUICK_DIGITS_ERROR_PREFIX}${error}`, errorCode });
	if(hasDate){
		if(parts.year < 1){ return fail('year', '年份不能为 0000'); }
		if(parts.month > 12){ return fail('month', `月份须在 01–12（输入 ${pad2(parts.month)}）`); }
		const monthDays = gregorianMonthDays(parts.year, parts.month);
		if(parts.day > monthDays){ return fail('day', `${parts.year} 年 ${parts.month} 月只有 ${monthDays} 天（输入 ${pad2(parts.day)}）`); }
	}
	if(parts.hour > 23){ return fail('hour', `小时须在 00–23（输入 ${pad2(parts.hour)}）`); }
	if(parts.minute > 59){ return fail('minute', `分钟须在 00–59（输入 ${pad2(parts.minute)}）`); }
	if(parts.second > 59){ return fail('second', `秒须在 00–59（输入 ${pad2(parts.second)}）`); }
	return { ok: true, digits, padded, truncated, parts, tokens, error: '', errorCode: null };
}
