// 民用历日期算术全族行为锁:1582 以前(儒略历)/ 公元前(历史纪年)/ 公元 1–99 年 / 五位年。
// 一切「隔几天 / 往后数 N 天 / 某月几天 / 墙钟步进 / 年龄」都在 civilCalendar 的日序轴上算(不经 JS Date / moment 的外推格里历),
// 1582-10-15 以后与旧写法逐值相同(下面的「现代对拍」用例锁住)。
import DateTime from '../../components/comp/DateTime';
import {
	civilMonthDays, civilDaysInMonth, civilLastDayOfMonth, civilPartsFromWallMs, civilWallMs, civilYmdExists, civilJdnOfYmd, civilYearLength,
} from '../civilCalendar';
import { civilWallMsOfStr, civilDateStrOfMs, civilInstantMsOfStr, civilDayDiffOfStr, formatSignedDate, parseDateParts } from '../dateStrSafe';
import { parseDateTimeMs } from '../dateTimeParse';
import { buildLocalNongliLite } from '../baziLunarLocal';
import * as H from '../../divination/zeri/hourlyScanEngine';
import { isDiurnalLocal } from '../../divination/zeri/liurengLocal';
import { calcTaiyiPanFromKintaiyi } from '../../components/taiyi/core/TaiYiCore';
import { __testing__ as DJ } from '../../components/dunjia/DunJiaCalc';
import { momentOfCivilDateTimeStr, civilDateOfMoment, birthMomentOfChart, civilDateAfterDays } from '../civilMoment';
import { buildPlanetaryAges } from '../planetaryAges';
import { segmentIndex } from '../segmentIndex';
import { mansionOf, MANSION_SPAN } from '../../divination/data/lunarMansions';
import { dashaMoment, flatlibCalendarFields } from '../../components/astro/indiaMain/dasha';
import { parseCsvCharts } from '../interchangeFormats';
import { unifyCnZone } from '../timezone';

const moment = require('moment');
const DAY = 86400000;

describe('civilCalendar 新增单源', ()=>{
	test('某月真实存在的日号:1500-02 有 29 日,1582-10 没有 5–14 日,1900-02 只有 28 日', ()=>{
		expect(civilDaysInMonth(1500, 2)).toBe(29);
		expect(civilDaysInMonth(1300, 2)).toBe(29);
		expect(civilDaysInMonth(-101, 2)).toBe(29);   // 公元前 101 年 = 天文年 −100,儒略闰
		expect(civilDaysInMonth(1900, 2)).toBe(28);
		expect(civilMonthDays(1582, 10)).toEqual([1, 2, 3, 4, ...Array.from({ length: 17 }, (_, i)=>i + 15)]);
		expect(civilDaysInMonth(1582, 10)).toBe(21);
		expect(civilLastDayOfMonth(1582, 10)).toBe(31);
		expect(civilYearLength(1582)).toBe(355);
		expect(civilYearLength(1500)).toBe(366);
		expect(civilMonthDays(-1, 12).length).toBe(31);
		expect(civilMonthDays(0, 1)).toEqual([]);
		expect(civilYmdExists(1582, 10, 10)).toBe(false);
		expect(civilYmdExists(1500, 2, 29)).toBe(true);
		expect(civilYmdExists(1700, 2, 29)).toBe(false);
	});
	test('现代对拍:1583–2400 每月天数与 Date 相同;墙钟毫秒往返与 Date.UTC 逐位相同', ()=>{
		for(let y = 1583; y <= 2400; y += 7){
			for(let m = 1; m <= 12; m++){
				const d = new Date(0); d.setUTCFullYear(y, m, 0);
				expect(civilDaysInMonth(y, m)).toBe(d.getUTCDate());
			}
			const ms = civilWallMs(y, 7, 19, 13, 5, 9);
			expect(ms).toBe(Date.UTC(y, 6, 19, 13, 5, 9));
			expect(civilPartsFromWallMs(ms)).toEqual({ year: y, month: 7, day: 19, hour: 13, minute: 5, second: 9, ms: 0 });
		}
	});
	test('墙钟毫秒反函数:1582-10-04 23:59 往后一分钟是 10-15 00:00;公元前 1 年末往后一天是公元 1 年 1 月 1 日', ()=>{
		const p = civilPartsFromWallMs(civilWallMs(1582, 10, 4, 23, 59, 0) + 60000);
		expect([p.year, p.month, p.day, p.hour, p.minute]).toEqual([1582, 10, 15, 0, 0]);
		const q = civilPartsFromWallMs(civilWallMs(-1, 12, 31, 12, 0, 0) + DAY);
		expect([q.year, q.month, q.day]).toEqual([1, 1, 1]);
		const r = civilPartsFromWallMs(civilWallMs(1500, 2, 28, 12, 0, 0) + DAY);
		expect([r.month, r.day]).toEqual([2, 29]);
	});
});

describe('civilWallMsOfStr:与时区无关,与 civilDateStrOfMs 配对往返原样', ()=>{
	const CASES = ['-0300-03-10', '-300-03-10', '1500-02-29', '1582-10-15', '1582-10-04 23:30', '12000-01-01', '1990-5-1', '1990/05/01',
		'1990-05-01 05:00:00', '-0001-12-31', '0050-03-10 23:59', '+001990-05-01', '2026-10-24T08:00:00'];
	test.each(CASES)('%s', (s)=>{
		const p = parseDateParts(s.replace('T', ' ').replace(/^\+0*/, ''));
		const ms = civilWallMsOfStr(s);
		expect(Number.isFinite(ms)).toBe(true);
		expect(civilDateStrOfMs(ms)).toBe(formatSignedDate(p.year, p.month, p.day));
	});
	test('不存在 / 认不出 → NaN', ()=>{
		['1582-10-10', '1900-02-29', '0000-01-01', 'x', '', null].forEach((s)=>{ expect(civilWallMsOfStr(s)).toBeNaN(); });
	});
	test('跨 1582 的天数差 = 民用历真实天数;公元前 1 年 12-31 → 公元 1 年 1-1 相隔 1 天', ()=>{
		expect((civilWallMsOfStr('1582-10-15') - civilWallMsOfStr('1582-10-04')) / DAY).toBe(1);
		expect(civilDayDiffOfStr('-0001-12-31', '0001-01-01')).toBe(1);
		expect(civilDayDiffOfStr('1500-02-28', '1500-03-01')).toBe(2);
		expect(civilDayDiffOfStr('2026-01-01', '2026-03-01')).toBe(59);
	});
	test('真实时刻:现代与 parseDateTimeMs 逐值相同;1582 以前补上儒略历之差', ()=>{
		['2026-10-24', '1990-05-01 05:00:00', '1990/05/01', '1700-01-01'].forEach((s)=>{ expect(civilInstantMsOfStr(s)).toBe(parseDateTimeMs(s)); });
		expect((civilInstantMsOfStr('1582-10-15') - civilInstantMsOfStr('1582-10-04')) / DAY).toBe(1);
	});
	test('子进程换系统时区(东八区 / 东十四区 / 美东 / UTC)跑同一表:结果逐值相同', ()=>{
		const os = require('os');
		const fs = require('fs');
		const path = require('path');
		const { execFileSync } = require('child_process');
		const esbuild = require('esbuild');
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'civil-tz-'));
		const entry = path.join(dir, 'entry.js');
		const out = path.join(dir, 'out.js');
		const ds = path.join(__dirname, '..', 'dateStrSafe.js').split(path.sep).join('/');
		fs.writeFileSync(entry, `import { civilWallMsOfStr, civilDateStrOfMs } from '${ds}';\n`
			+ `const cases = ${JSON.stringify(CASES)};\n`
			+ 'process.stdout.write(JSON.stringify(cases.map((s)=>[civilWallMsOfStr(s), civilDateStrOfMs(civilWallMsOfStr(s) + 3 * 86400000)])));\n');
		esbuild.buildSync({ entryPoints: [entry], bundle: true, platform: 'node', outfile: out, logLevel: 'silent' });
		const runIn = (tz)=>JSON.parse(execFileSync(process.execPath, [out], { env: { ...process.env, TZ: tz }, encoding: 'utf8' }));
		const base = runIn('UTC');
		['Asia/Shanghai', 'Pacific/Kiritimati', 'America/New_York'].forEach((tz)=>{ expect(runIn(tz)).toEqual(base); });
		expect(base.map((r)=>r[0])).toEqual(CASES.map((s)=>civilWallMsOfStr(s)));
		fs.rmSync(dir, { recursive: true, force: true });
	});
});

describe('八字本地历算:真太阳时校正在民用历轴上做', ()=>{
	const geo = { zone: '+08:00', lon: '116e28', lat: '39n54', gpsLon: 116.46, gpsLat: 39.9, ad: 1, gender: 1, after23NewDay: 1, lateZiHourUseNextDay: 1 };
	const pillars = (date, time, alg, extra)=>{
		const r = buildLocalNongliLite({ ...geo, ...(extra || {}), date, time, timeAlg: alg });
		const fc = r.bazi.fourColumns;
		return `${fc.day.ganzi || fc.day.ganZhi}/${fc.time.ganzi || fc.time.ganZhi}`;
	};
	const dayOf = (date, alg)=>pillars(date, '12:00:00', alg).split('/')[0];
	test.each([1500, 1300, 900, 100])('%i 年(儒略闰、格里不闰)2 月 29 日:真太阳时 / 平太阳时 / 直接时间三档日柱一致且连续', (y)=>{
		const ys = String(y).padStart(4, '0');
		[0, 1, 3].forEach((alg)=>{
			const a = dayOf(`${ys}-02-28`, alg); const b = dayOf(`${ys}-02-29`, alg); const c = dayOf(`${ys}-03-01`, alg);
			expect(b).toBe(dayOf(`${ys}-02-29`, 1));
			expect(new Set([a, b, c]).size).toBe(3);
		});
	});
	test('2 月 28 日深夜往东校正跨日落到儒略 2 月 29 日', ()=>{
		const east = { lon: '128e00', gpsLon: 128 };
		expect(pillars('1500-02-28', '23:55:00', 0, { ...east, after23NewDay: 0, lateZiHourUseNextDay: 0 }).split('/')[0])
			.toBe(pillars('1500-02-29', '00:30:00', 1, { ...east, after23NewDay: 0, lateZiHourUseNextDay: 0 }).split('/')[0]);
	});
	test('1582-10-04 深夜往东校正跨到 10-15,不抛错', ()=>{
		const east = { lon: '128e00', gpsLon: 128, after23NewDay: 0, lateZiHourUseNextDay: 0 };
		expect(pillars('1582-10-04', '23:50:00', 0, east).split('/')[0]).toBe(pillars('1582-10-15', '00:20:00', 1, east).split('/')[0]);
	});
	test('现代对拍:真太阳时校正与旧 Date.UTC 写法逐位相同', ()=>{
		const { applyApparentSolarTime } = require('../baziLunarLocal').__testing__;
		const old = (parts, lon, zoneH, alg)=>{
			const wall = new Date(0); wall.setUTCFullYear(parts.year, parts.month - 1, parts.day); wall.setUTCHours(parts.hour, parts.minute, parts.second, 0);
			const { equationOfTime } = require('../baziLunarLocal').__testing__;
			const eot = alg === 0 ? equationOfTime(wall.getTime() - zoneH * 3600000) * 60 : 0;
			const adj = new Date(wall.getTime() + Math.round((lon - zoneH * 15) * 240 + eot) * 1000);
			return { year: adj.getUTCFullYear(), month: adj.getUTCMonth() + 1, day: adj.getUTCDate(), hour: adj.getUTCHours(), minute: adj.getUTCMinutes(), second: adj.getUTCSeconds() };
		};
		[[1990, 5, 1, 23, 59, 10], [2026, 2, 28, 0, 3, 0], [1700, 12, 31, 23, 40, 0], [1583, 1, 1, 0, 0, 0]].forEach(([y, m, d, h, mi, s])=>{
			[0, 3].forEach((alg)=>{
				const parts = { year: y, month: m, day: d, hour: h, minute: mi, second: s };
				expect(applyApparentSolarTime(parts, { timeAlg: alg, lon: 128.5, zone: '+08:00' })).toEqual(old(parts, 128.5, 8, alg));
			});
		});
	});
});

describe('择日墙钟步进:民用历轴', ()=>{
	const walk = (a, b)=>{ const out = []; let t = H.wallToMs(a, '12:00', 480); const e = H.wallToMs(b, '12:00', 480); while(t <= e){ out.push(H.wallDateStr(H.msToWall(t, 480))); t += DAY; } return out; };
	test('1500-02 逐日含 02-29;跨 1582-10 不出现 10-05 … 10-14', ()=>{
		expect(walk('1500-02-27', '1500-03-02')).toEqual(['1500-02-27', '1500-02-28', '1500-02-29', '1500-03-01', '1500-03-02']);
		const gap = walk('1582-10-03', '1582-10-16');
		expect(gap).toEqual(['1582-10-03', '1582-10-04', '1582-10-15', '1582-10-16']);
		expect(H.msToWallText(H.wallYmdToMs(50, 3, 1, 12, 30, 0))).toBe('0050-03-01 12:30');
	});
	test('现代对拍:与 Date.UTC 逐位相同', ()=>{
		for(let y = 1583; y < 2500; y += 13){
			expect(H.wallYmdToMs(y, 3, 31, 23, 59, 0)).toBe(Date.UTC(y, 2, 31, 23, 59, 0));
			const w = H.msToWall(Date.UTC(y, 1, 28, 20, 0) + 6 * 3600000, 0);
			const d = new Date(Date.UTC(y, 1, 28, 20, 0) + 6 * 3600000);
			expect([w.y, w.mo, w.dd, w.hh, w.mm]).toEqual([d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes()]);
		}
	});
	test('六壬昼夜:1582 以前按真实季节取日序(儒略 1500-06-11 ≈ 格里 06-21 夏至前后,北京子夜为夜、正午为昼)', ()=>{
		expect(isDiurnalLocal('1500-06-11', '12:00:00', 39.9, 116.46, 8)).toBe(true);
		expect(isDiurnalLocal('1500-06-11', '00:30:00', 39.9, 116.46, 8)).toBe(false);
		// 春分附近日出每天提前 1–2 分钟:儒略 1500-03-11 是真实的春分前后(≈ 格里 03-21),早晨 05:30–07:30 的昼分钟数
		// 应与 2026-03-21 相差不过几分钟(按儒略标签当格里年内日序算会晚十天、差出一刻钟以上)
		const dayMinutes = (date)=>{ let n = 0; for(let m = 330; m < 450; m++){ const t = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:00`; if(isDiurnalLocal(date, t, 39.9, 116.46, 8)){ n += 1; } } return n; };
		expect(Math.abs(dayMinutes('1500-03-11') - dayMinutes('2026-03-21'))).toBeLessThanOrEqual(4);
		expect(isDiurnalLocal('-0300-06-21', '12:00:00', 34, 108, 8)).toBe(true);
	});
});

describe('太乙本地引擎:公元前 / 公元 1–99 年 / 1582 换历', ()=>{
	const fields = (ad, y, m, d, h = 12, mi = 0)=>{ const dt = new DateTime({ ad, year: y, month: m, date: d, hour: h, minute: mi, second: 0, zone: '+08:00' }); return { date: { value: dt }, time: { value: dt } }; };
	const acc = (f, style)=>{ const p = calcTaiyiPanFromKintaiyi(f, {}, { style, tn: 0 }); return p && p.accNum; };
	test('年计积数:公元前 300 年 = 10153917 − 300 + 1,与公元 1 年相差 300', ()=>{
		expect(acc(fields(-1, 300, 3, 10), 0)).toBe(10153917 - 300 + 1);
		expect(acc(fields(1, 1, 3, 10), 0) - acc(fields(-1, 300, 3, 10), 0)).toBe(300);
		expect(acc(fields(-1, 1, 3, 10), 0)).toBe(10153917);
	});
	test('日计积数:公元 50 年与 1950 年相差真实天数;1582-10-04 → 10-15 相邻;1200-06-01 → 06-02 差 1', ()=>{
		expect(acc(fields(1, 1950, 3, 10), 2) - acc(fields(1, 50, 3, 10), 2)).toBe(civilJdnOfYmd(1950, 3, 10) - civilJdnOfYmd(50, 3, 10));
		expect(acc(fields(1, 1582, 10, 15), 2) - acc(fields(1, 1582, 10, 4), 2)).toBe(1);
		expect(acc(fields(1, 1200, 6, 2), 2) - acc(fields(1, 1200, 6, 1), 2)).toBe(1);
		expect(acc(fields(1, 1, 1, 1), 2) - acc(fields(-1, 1, 12, 31), 2)).toBe(1);
	});
	test('现代对拍:1990 年五种计法与旧 Date.UTC 积日一致(日计 = 708011105 + 距 1900-06-19 天数)', ()=>{
		const f = fields(1, 1990, 5, 1, 10, 30);
		expect(acc(f, 2)).toBe(708011105 + Math.floor((Date.UTC(1990, 4, 1, 10, 30) - Date.UTC(1900, 5, 19)) / DAY));
		const d3 = Math.floor((Date.UTC(1990, 4, 1, 10, 30) - Date.UTC(1900, 11, 21)) / DAY);
		expect(acc(f, 3)).toBe(((708011105 + d3 - 1) * 12) + Math.floor((10 + 1) / 2) + 1);
		expect(acc(f, 4)).toBe(((708011105 + d3 - 1) * 23) + (10 * 10500) + (30 + 1));
	});
});

describe('奇门「此刻的节气」与种子同轴', ()=>{
	test('公元 50 年 3 月 10 日:当前节气按当年种子取(不再恒取次年末的节气)', ()=>{
		const jq50 = DJ.resolveCurrentJieqi({}, { year: 50, month: 3, day: 10, hour: 12, minute: 0 }, {}, '+08:00');
		expect(jq50).toBe('惊蛰');
		const jq1950 = DJ.resolveCurrentJieqi({}, { year: 1950, month: 3, day: 10, hour: 12, minute: 0 }, {}, '+08:00');
		expect(jq1950).toBe('惊蛰');
	});
});

describe('moment 读命盘日期走民用历单源', ()=>{
	test('公元前 / 公元 50 年 / 五位年不误读;1582 以后与 moment(串, 格式) 逐值相同', ()=>{
		expect(civilDateOfMoment(momentOfCivilDateTimeStr('-300-03-10 12:00:00'))).toBe('-0300-03-10');
		expect(civilDateOfMoment(momentOfCivilDateTimeStr('50-03-10 12:00:00'))).toBe('0050-03-10');
		expect(civilDateOfMoment(momentOfCivilDateTimeStr('12000-01-01'))).toBe('12000-01-01');
		expect(civilDateOfMoment(momentOfCivilDateTimeStr('1500-02-29 08:00'))).toBe('1500-02-29');
		['1990-03-10 12:00:00', '2026-10-24 23:59', '1700-01-01'].forEach((s)=>{
			expect(momentOfCivilDateTimeStr(s).valueOf()).toBe(moment(s, ['YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD HH:mm', 'YYYY-MM-DD']).valueOf());
		});
	});
	test('行星年龄:公元 50 年出生的当前年龄约 1976 岁(不再是负数)', ()=>{
		const r = buildPlanetaryAges({ params: { birth: '50-03-10 12:00:00' }, chart: { objects: [] } }, '2026-10-24');
		const cur = r.curAge;
		expect(cur).toBeGreaterThan(1975);
		expect(cur).toBeLessThan(1978);
		const b = birthMomentOfChart({ params: { birth: '1500-02-29 06:00:00' } });
		expect(civilDateAfterDays(b, 1)).toBe('1500-03-01');
		expect(civilDateAfterDays(birthMomentOfChart({ params: { birth: '1582-10-04' } }), 1)).toBe('1582-10-15');
	});
});

describe('段界裸除', ()=>{
	test('27 / 28 等分:k × 宽度构造的段界点归后一段;非段界点与裸除相同', ()=>{
		for(let k = 0; k < 27; k++){ expect(segmentIndex(k * (360 / 27), 360 / 27, 27)).toBe(k); }
		for(let k = 0; k < 28; k++){ expect(segmentIndex(k * MANSION_SPAN, MANSION_SPAN, 28)).toBe(k); }
		[0.1, 13.3, 93.3, 200.01, 359.999].forEach((x)=>{ expect(segmentIndex(x, 360 / 27, 27)).toBe(Math.floor(x / (360 / 27))); });
		expect(segmentIndex(360, 360 / 27, 27)).toBe(26);
		for(let k = 0; k < 28; k++){ expect(mansionOf(k * MANSION_SPAN)).toBe(mansionOf(k * MANSION_SPAN + 1e-6)); }
	});
});

describe('印占大运日期标签', ()=>{
	test('公元前 / 五位年标签认得;1582 以前按儒略历标签读回原样', ()=>{
		const bc = dashaMoment(null, '-0300-03-10');
		expect(bc && bc.isValid()).toBe(true);
		const f = flatlibCalendarFields(bc);
		expect([f.year, f.month, f.day]).toEqual([-300, 3, 10]);
		const j = flatlibCalendarFields(dashaMoment(null, '1500-02-29'));
		expect([j.year, j.month, j.day]).toEqual([1500, 2, 29]);
		expect(dashaMoment(null, '12000-01-01').isValid()).toBe(true);
		const m = flatlibCalendarFields(dashaMoment(null, '1990-05-01 10:00'));
		expect([m.year, m.month, m.day]).toEqual([1990, 5, 1]);
	});
});

describe('导出 → 导入往返与时区判定', ()=>{
	test('CSV:公元前 / 公元 50 年 / 五位年生辰原样导回', ()=>{
		const text = '姓名,性别,生辰\n甲,男,-300-03-10 12:00:00\n乙,女,50-03-10 08:05\n丙,,12000-01-01 06:30:15\n丁,男,1990-05-01 10:00';
		const r = parseCsvCharts(text);
		expect(r.errors).toEqual([]);
		expect(r.records.map((x)=>x.birth)).toEqual(['-300-03-10 12:00:00', '50-03-10 08:05:00', '12000-01-01 06:30:15', '1990-05-01 10:00:00']);
	});
	test('中国统一北京时间:1949-10-01 以前(含公元前 / 公元 1–999 年)保留当地时区', ()=>{
		expect(unifyCnZone('Asia/Urumqi', '-0300-03-10').advisory).toBe(null);
		expect(unifyCnZone('Asia/Urumqi', '0500-03-10').advisory).toBe(null);
		expect(unifyCnZone('Asia/Urumqi', '1940-03-10').advisory).toBe(null);
		expect(unifyCnZone('Asia/Urumqi', '1990-03-10').advisory).toBe('cn-unified');
	});
});

describe('黄历日择日扫描:逐日步进走民用历', ()=>{
	const { scanHuangli } = require('../../divination/zeri/huangliZeriScanEngine');
	const ANY = { type: 'all', conditions: [] };
	test('1500-02 扫描含 02-29;跨 1582-10 的样本数 = 真实天数;日序号现代与 Date.UTC ÷ 一日相同', async ()=>{
		const a = await scanHuangli({ cfg: { startDate: '1500-02-27', endDate: '1500-03-02' }, tree: ANY });
		expect(a.stats.samples).toBe(5);
		const b = await scanHuangli({ cfg: { startDate: '1582-10-01', endDate: '1582-10-20' }, tree: ANY });
		expect(b.stats.samples).toBe(10);
		const c = await scanHuangli({ cfg: { startDate: '2026-01-01', endDate: '2026-01-03' }, tree: ANY });
		expect(c.stats.samples).toBe(3);
		c.intervals.forEach((r)=>{ expect(r.startOrd).toBe(Date.UTC(...r.start.split('-').map(Number).map((v, i)=>(i === 1 ? v - 1 : v))) / DAY); });
	});
});

describe('日期往后挪 / 标签 moment / 星期:不经本地 Date 拆标签', ()=>{
	const { civilShiftDateTimeStr, civilDateTimeStrOfWallMs } = require('../dateStrSafe');
	const { labelMomentOfCivilDateStr, addLabelMonths } = require('../civilMoment');
	const { varaLordOf, garbhaDeliveryDate, vimshottariFromMoon } = require('../../divination/mundane/vedicMundane');
	test('civilShiftDateTimeStr:跨儒略闰日 / 改历 / 公元元年;现代与旧本地写法(无夏令时区)逐字相同', ()=>{
		expect(civilShiftDateTimeStr('1500-02-28 18:00:00', 12 * 3600000)).toBe('1500-02-29 06:00:00');
		expect(civilShiftDateTimeStr('1582-10-04 23:00', 2 * 3600000)).toBe('1582-10-15 01:00:00');
		expect(civilShiftDateTimeStr('-0001-12-31 12:00:00', DAY)).toBe('0001-01-01 12:00:00');
		expect(civilShiftDateTimeStr('坏串', DAY)).toBe('');
		expect(civilShiftDateTimeStr('2026-10-24 08:30:15', -3 * DAY)).toBe('2026-10-21 08:30:15');
		expect(civilDateTimeStrOfWallMs(Date.UTC(2026, 9, 24, 1, 2, 3))).toBe('2026-10-24 01:02:03');
	});
	test('云之孕产期 / 世运大运年份 / 星期主:1582 以前与公元前按民用历', ()=>{
		expect(garbhaDeliveryDate('1500-01-01')).toBe('1500-07-14');   // 儒略 1500 年是闰年(有 2 月 29 日):195 天后比平年早一天
		expect(garbhaDeliveryDate('2026-01-01')).toBe('2026-07-15');
		// 1582-10-04(周四)与 10-15(周五)相邻
		expect(varaLordOf('1582-10-15 12:00:00')).not.toBe(varaLordOf('1582-10-04 12:00:00'));
		expect(varaLordOf('2026-10-24 12:00:00')).toBe(varaLordOf('2026-10-17 12:00:00'));
		const seq = vimshottariFromMoon(0, '-0300-03-10 12:00:00', 365.2425);
		expect(seq.periods[0].fromYear).toBe(-300);
		expect(vimshottariFromMoon(0, '1990-03-10 12:00:00', 365.2425).periods[0].fromYear).toBe(1990);
	});
	test('标签 moment:年月日原样、按月步进跨公元元年不出现 0 年;现代与 moment(串) 同标签', ()=>{
		expect(labelMomentOfCivilDateStr('1500/02/28').format('YYYY/MM/DD')).toBe('1500/02/28');
		expect(labelMomentOfCivilDateStr('-0300/03/10').year()).toBe(-300);
		// moment 按外推格里历校验:儒略独有的 1500-02-29 装不进标签 moment,如实给 invalid(调用方据此跳过,不静默挪日)
		expect(labelMomentOfCivilDateStr('1500/02/29').isValid()).toBe(false);
		expect(labelMomentOfCivilDateStr('2026-10-24').format('YYYY/MM/DD')).toBe(moment('2026-10-24').format('YYYY/MM/DD'));
		const bc = labelMomentOfCivilDateStr('-0001-12-15');
		const n = addLabelMonths(bc, 1);
		expect([n.year(), n.month() + 1, n.date()]).toEqual([1, 1, 15]);
		const j = addLabelMonths(labelMomentOfCivilDateStr('2026-01-31'), 1);
		expect(j.format('YYYY/MM/DD')).toBe(moment('2026-01-31').add(1, 'month').format('YYYY/MM/DD'));
		expect(labelMomentOfCivilDateStr('坏').isValid()).toBe(false);
		expect(dashaMoment(null, 'Mar 3 1990')).toBe(null);
	});
});

describe('julianDayIndex 与 civilCalendar 同一条日序轴', ()=>{
	const { julianDayIndex } = require('../julianDayIndex');
	test('公元前 13000 年 ~ 公元 16800 年逐年(含 2 月 29 日 / 1582 换历两侧 / 公元元年两侧)整数日序完全相同', ()=>{
		const bad = [];
		for(let y = -13000; y <= 16800; y += (y > -50 && y < 50) || (y > 1570 && y < 1600) ? 1 : 37){
			if(y === 0){ continue; }
			[[1, 1], [2, 28], [2, 29], [3, 1], [10, 4], [10, 15], [12, 31]].forEach(([m, d])=>{
				if(julianDayIndex(y, m, d) !== civilJdnOfYmd(y, m, d)){ bad.push(`${y}-${m}-${d}`); }
			});
		}
		expect(bad).toEqual([]);
	});
});

describe('择日入口:不存在的日期报错,不静默挪日', ()=>{
	const { runSegmentedRemoteScan } = require('../../divination/zeri/scanOrchestrator');
	const { scanHuangli } = require('../../divination/zeri/huangliZeriScanEngine');
	const { searchZeriTool } = require('../aiTools/tools/searchZeri');
	const MISSING = ['1582-10-10', '1582-10-05 00:00', '2026-02-30', '0000-06-01', '1900-02-29'];
	test('墙钟轴:不存在的日期 → NaN(此前缺口日 +10 天、2-30 → 3-02、0 年 → 公元前 1 年);存在的日期原样', ()=>{
		MISSING.forEach((t)=>{ expect(H.wallTextToMs(t)).toBeNaN(); });
		expect(H.wallTextToMs('1500-02-29 12:00')).toBe(H.wallYmdToMs(1500, 2, 29, 12, 0, 0));
		expect(H.wallTextToMs('1582-10-15')).toBe(H.wallTextToMs('1582-10-04') + 86400e3);
		expect(H.nonexistentWallDateMessage('2026-01-01', '1582-10-10')).toMatch(/改历缺口/);
		expect(H.nonexistentWallDateMessage('2026/02/30')).toMatch(/当月没有这一天/);
		expect(H.nonexistentWallDateMessage('0000-06-01')).toMatch(/公元 0 年/);
		expect(H.nonexistentWallDateMessage('1500-02-29', '2026-10-25 12:00')).toBe('');
	});
	test('逐时引擎 / 黄历日引擎 / 远端分段 / AI 工具:起止日不存在一律报错,不出结果', async ()=>{
		const eng = H.makeHourlyScanEngine({ computePanAt: ()=>({}), plateKeyOf: ()=>'k', evaluateTree: ()=>({ pass: true }) });
		await expect(eng.scan({ cfg: { startDate: '1582-10-10', endDate: '1582-10-16' }, geoParams: { zone: '+08:00' }, tree: {} }))
			.rejects.toMatchObject({ code: 'invalid_date' });
		await expect(scanHuangli({ cfg: { startDate: '2026-02-30', endDate: '2026-03-05' }, tree: {} })).rejects.toMatchObject({ code: 'invalid_date' });
		let fetched = 0;
		await expect(runSegmentedRemoteScan({ payload: { startDate: '1582-10-10', endDate: '1582-11-01' }, fetchFn: ()=>{ fetched += 1; return { intervals: [] }; } }))
			.rejects.toThrow(/改历缺口/);
		expect(fetched).toBe(0);
		const out = await searchZeriTool.run({ school: 'huangli', start: '1582-10-10', end: '1582-10-20', conditions: { type: 'all', conditions: [] } }, {});
		expect(out).toMatchObject({ ok: false, code: 'E_ARGS_INVALID' });
		expect(out.message).toMatch(/日期不存在/);
	});
});

describe('奇门「此刻 vs 节气种子」同在民用历墙钟轴', ()=>{
	test('儒略闰日 0900-02-29 12:00 不会把 03-01 05:00 才交的惊蛰当成已交;03-01 06:00 才算', ()=>{
		const seeds = { 900: { '雨水': { time: '0900-02-14 03:00:00' }, '惊蛰': { time: '0900-03-01 05:00:00' } } };
		expect(DJ.latestSeedTermAt({ year: 900, month: 2, day: 29, hour: 12, minute: 0 }, seeds).term).toBe('雨水');
		expect(DJ.latestSeedTermAt({ year: 900, month: 3, day: 1, hour: 6, minute: 0 }, seeds).term).toBe('惊蛰');
		// 现代对拍:同一种子表,先后与旧本地钟面解析一致
		const modern = { 2026: { '雨水': { time: '2026-02-18 23:52:00' }, '惊蛰': { time: '2026-03-05 21:59:00' } } };
		expect(DJ.latestSeedTermAt({ year: 2026, month: 3, day: 5, hour: 21, minute: 58 }, modern).term).toBe('雨水');
		expect(DJ.latestSeedTermAt({ year: 2026, month: 3, day: 5, hour: 21, minute: 59 }, modern).term).toBe('惊蛰');
	});
	test('源码锚:奇门种子 / 此刻比先后不经本机钟面 / 外推格里历解析', ()=>{
		const src = require('fs').readFileSync(require('path').join(__dirname, '../../components/dunjia/DunJiaCalc.js'), 'utf8');
		expect(src).not.toMatch(/parseLocalDateTimeMs|parseDateTimeMs/);
		expect(src).toMatch(/civilWallMsOfStr/);
	});
});

describe('十年大运出生时刻:民用历单源 + 出生时区', ()=>{
	const { zonedBirthMomentOfChart, zonedMomentOfCivilDateTimeStr, zoneOffsetMinutesOf, civilJdnOfMoment } = require('../civilMoment');
	const { buildDecennialTimeline } = require('../decennials');
	const chartOf = (params)=>({ params, chart: { isDiurnal: true, objects: [] } });
	// 旧写法(对拍用):moment 的严格格式解析,带出生时区
	const oldParse = (params)=>{
		let ds = ''; let ts = '';
		if(params.birth){ const sp = `${params.birth}`.trim().split(/\s+/); ds = sp[0] || ''; ts = sp[1] || ''; } else { ds = params.date || ''; ts = params.time || ''; }
		ts = `${ts || ''}`.trim() || '00:00:00';
		if(ts.length === 5){ ts = `${ts}:00`; }
		const raw = `${`${ds}`.trim().replace(/\//g, '-')} ${ts} ${`${params.zone || '+08:00'}`.trim()}`;
		return moment.parseZone(raw, ['YYYY-MM-DD HH:mm:ss Z', 'YYYY-M-D HH:mm:ss Z', 'YYYY-MM-DD HH:mm Z', 'YYYY-M-D HH:mm Z'], true);
	};

	test('公元前带负号、公元前 1 年、儒略闰日:与 birthMomentOfChart 同一天,期界标签写民用历', ()=>{
		[['-0300-03-10 12:00:00', -299], ['-300-03-10 12:00:00', -299], ['-0001-06-01 12:00:00', 0], ['1500-02-29 12:00:00', 1500]].forEach(([birth, astroYearOfJdnDay])=>{
			const z = zonedBirthMomentOfChart(chartOf({ birth, zone: '+08:00' }));
			const ref = birthMomentOfChart(chartOf({ birth }));
			expect([birth, z.isValid()]).toEqual([birth, true]);
			expect([birth, civilJdnOfMoment(z)]).toEqual([birth, civilJdnOfMoment(ref)]);
			expect([birth, z.year()]).toEqual([birth, astroYearOfJdnDay]);   // 天文年:不再丢负号(300)、不再被猜成 2001 年
			const tl = buildDecennialTimeline(chartOf({ birth, zone: '+08:00' }));
			expect([birth, tl.list[0].startText]).toEqual([birth, civilDateOfMoment(z)]);
		});
		expect(buildDecennialTimeline(chartOf({ birth: '1500-02-29 12:00:00', zone: '+08:00' })).list[0].startText).toBe('1500-02-29');
		expect(civilDateOfMoment(zonedBirthMomentOfChart(chartOf({ birth: '-0300-03-10 12:00:00' })))).toBe(civilDateOfMoment(momentOfCivilDateTimeStr('-0300-03-10 12:00:00')));
	});

	test('不存在的日子 / 认不出 → invalid(时间线为空,不静默挪日)', ()=>{
		expect(zonedMomentOfCivilDateTimeStr('1990-02-30 12:00:00', '+08:00').isValid()).toBe(false);
		expect(zonedMomentOfCivilDateTimeStr('1582-10-10 12:00:00', '+08:00').isValid()).toBe(false);
		expect(zonedMomentOfCivilDateTimeStr('0000-01-01 00:00:00', '+08:00').isValid()).toBe(false);
		expect(buildDecennialTimeline(chartOf({ birth: '1990-02-30 12:00:00' })).list).toEqual([]);
		expect(zoneOffsetMinutesOf('+05:30')).toBe(330);
		expect(zoneOffsetMinutesOf('-0330')).toBe(-210);
		expect(zoneOffsetMinutesOf(8)).toBe(480);
		expect(zoneOffsetMinutesOf('abc')).toBe(null);
	});

	test('现代对拍:1583–2399 随机 3000 例(birth / date+time、斜杠、短时刻、各时区、缺时区)与旧解析逐值相同', ()=>{
		let seed = 20261025;
		const rnd = ()=>{ seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
		const pad = (n)=>`${n}`.padStart(2, '0');
		const ZONES = ['+08:00', '-05:00', '+05:30', '+00:00', '-03:30', '+09:45', '', undefined];
		const bad = [];
		for(let i = 0; i < 3000; i++){
			const y = 1583 + Math.floor(rnd() * 817);
			const mo = 1 + Math.floor(rnd() * 12);
			const d = 1 + Math.floor(rnd() * civilDaysInMonth(y, mo));
			const ts = rnd() < 0.3 ? `${pad(Math.floor(rnd() * 24))}:${pad(Math.floor(rnd() * 60))}` : `${pad(Math.floor(rnd() * 24))}:${pad(Math.floor(rnd() * 60))}:${pad(Math.floor(rnd() * 60))}`;
			const sep = rnd() < 0.2 ? '/' : '-';
			const ds = `${y}${sep}${pad(mo)}${sep}${pad(d)}`;
			const zone = ZONES[Math.floor(rnd() * ZONES.length)];
			const params = rnd() < 0.7 ? { birth: `${ds} ${ts}`, zone } : { date: ds, time: ts, zone };
			const a = zonedBirthMomentOfChart(chartOf(params));
			const b = oldParse(params);
			const sig = (m)=>(m.isValid() ? `${m.valueOf()}|${m.utcOffset()}|${m.format('YYYY-MM-DD HH:mm:ss Z')}|${civilDateOfMoment(m)}` : 'invalid');
			if(sig(a) !== `${b.isValid() ? `${b.valueOf()}|${b.utcOffset()}|${b.format('YYYY-MM-DD HH:mm:ss Z')}|${b.format('YYYY-MM-DD')}` : 'invalid'}`){ bad.push(JSON.stringify(params)); }
		}
		expect(bad).toEqual([]);
	});
});
