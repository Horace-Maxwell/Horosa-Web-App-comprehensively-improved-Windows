// 太阳返照 / 月亮返照 / 流年三页(及 AI 无头同口径)的「目标时刻」初值:今年 + 出生月日 + 出生时分秒。
//
// 单一来源:三页 genNatalParams 与无头推运快照共用。出生串按民用历日期串解析(parseDateParts:公元前前导负号、
// 1–5 位年都对),不按「前 4 位是年」切片 —— 旧写法 `今年 + birth.substr(4)` 对 '-0003-03-10' 拼出「20263 年」、
// 对 '12000-01-01' 拼出「20260 年」,开页即按无意义的年份求返照。
import DateTime from '../components/comp/DateTime';
import { parseDateParts, addCivilYears, displayYearDiff } from './dateStrSafe';

/**
 * birth:'YYYY-MM-DD HH:mm[:ss]'(日期段可为 '/' 分隔、可带前导负号、1–5 位年)。
 * 返回 DateTime(缺省时区,与 new DateTime() 同):年 = 今年,月日时分秒 = 出生;birth 不可解析时返回此刻。
 * 时区由调用方随后 setZone(只换时区、不动钟面,与三页原口径一致)。
 * 2 月 29 日出生、今年没有 2 月 29 日:按 addCivilYears 同一规则落 3 月 1 日(不造出不存在的日期)。
 * nowDt:测试注入「此刻」(缺省 new DateTime())。
 */
export function returnPickerSeed(birth, nowDt){
	const now = nowDt || new DateTime();
	const text = `${birth || ''}`.trim();
	const parts = text.split(/\s+/);
	const d = parseDateParts(parts[0]);
	if(!d){
		return now;
	}
	// 今年的同月同日:经 addCivilYears(民用历闰法单源)往后数到今年,目标年没有 2 月 29 日时落 3 月 1 日
	const target = parseDateParts(addCivilYears(parts[0], displayYearDiff(d.year, now.year))) || d;
	const tm = `${parts[1] || '12:00:00'}`.split(':');
	const num = (v)=>{ const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0; };
	const out = new DateTime({
		ad: 1,
		year: now.year,
		month: target.month,
		date: target.day,
		hour: num(tm[0]),
		minute: num(tm[1]),
		second: num(tm[2]),
		zone: now.zone,
	});
	out.calcJdn();
	return out;
}
