// 印占页口径护栏:六力单一来源 / 大运深层起点取精确时刻 / 东印盘白羊居上中 / 过运日恒进请求 /
// 1582 前日期按儒略历标注。源码护栏 + 行为断言双判。
import fs from 'fs';
import path from 'path';
import moment from 'moment';
import { fieldsToParams, buildJyotishSnapshotLines } from '../../components/astro/IndiaChart';
import { eastSlotOfSign, EAST_SLOT_POLYGONS } from '../../components/astro/IndiaEastChart';
import { buildDashaSubPeriods, dashaMoment, buildBirthMoment, dashaContainsNow, dashaZoneMinutes, dashaIsoOf, buildVimshottariDasha } from '../../components/astro/indiaMain/dasha';
import { formatJyotishDate, formatJyotishDateTime } from '../../components/astro/indiaMain/jyotishData';

const SRC = path.join(__dirname, '..', '..');

function walk(dir, out = []){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((ent)=>{
		const p = path.join(dir, ent.name);
		if(ent.isDirectory()){
			if(ent.name === '__tests__' || ent.name === 'fixtures' || ent.name === 'node_modules'){ return; }
			walk(p, out);
		}else if(/\.(js|jsx|ts|tsx)$/.test(ent.name)){
			out.push(p);
		}
	});
	return out;
}

describe('六力单一来源', ()=>{
	it('页面 / 快照 / 导出层不读粗估层 jyotish.shadbala(只认六源式 shadbalaBphs)', ()=>{
		const hits = [];
		walk(SRC).forEach((f)=>{
			const src = fs.readFileSync(f, 'utf8');
			src.split('\n').forEach((ln, i)=>{
				const code = ln.replace(/\/\/.*$/, '');
				if(/\.shadbala(?![A-Za-z0-9_])/.test(code) || /\[['"]shadbala['"]\]/.test(code)){
					hits.push(`${path.relative(SRC, f)}:${i + 1}`);
				}
			});
		});
		expect(hits).toEqual([]);
	});
});

describe('大运深层起点取精确时刻', ()=>{
	const maha = {
		lord: { key: 'Mercury', label: '水星', years: 17 },
		start: moment('1990-05-02T03:11:00'),
		end: moment('2007-05-02T21:11:00'),
		years: 17,
		antardashas: [
			{ lord: { key: 'Venus', label: '金星', years: 20 }, start: '1997-01-04', end: '1999-11-04',
				startIso: '1997-01-04T07:57:12.400000', endIso: '1999-11-04T19:57:12.400000', years: 2.8333,
				pratyantardashas: [
					{ lord: { key: 'Venus', label: '金星', years: 20 }, start: '1997-01-04', end: '1997-06-16',
						startIso: '1997-01-04T07:57:12.400000', endIso: '1997-06-16T05:57:12.400000', years: 0.4722 },
				] },
		],
	};

	it('小运 / 子运起讫取后端 ISO(不按日期 0 点)', ()=>{
		const antars = buildDashaSubPeriods(maha);
		expect(antars[0].start.format('YYYY-MM-DD HH:mm:ss')).toBe('1997-01-04 07:57:12');
		const prats = buildDashaSubPeriods(antars[0]);
		expect(prats[0].start.format('YYYY-MM-DD HH:mm')).toBe('1997-01-04 07:57');
		// 再往下(微运)由前端细分:首段起点 = 子运精确起点
		const sooks = buildDashaSubPeriods(prats[0]);
		expect(sooks[0].start.format('YYYY-MM-DD HH:mm')).toBe('1997-01-04 07:57');
	});

	it('源码:后端段不得从日期串直接构造 moment', ()=>{
		const files = ['components/astro/indiaMain/dasha.js', 'components/astro/IndiaChartMain.js'];
		files.forEach((rel)=>{
			const src = fs.readFileSync(path.join(SRC, rel), 'utf8');
			expect(src).not.toMatch(/moment\((subItem|item|p|m)\.(start|end)\)/);
		});
	});
});

describe('东印盘方位', ()=>{
	const TOP_MID = '33.333,0 66.667,0 66.667,33.333 33.333,33.333';
	const LEFT_MID = '0,33.333 33.333,33.333 33.333,66.667 0,66.667';
	const BOTTOM_MID = '33.333,66.667 66.667,66.667 66.667,100 33.333,100';
	const RIGHT_MID = '66.667,33.333 100,33.333 100,66.667 66.667,66.667';
	it('白羊上中、巨蟹左中、天秤下中、摩羯右中(逆时针)', ()=>{
		expect(EAST_SLOT_POLYGONS[eastSlotOfSign(1)]).toBe(TOP_MID);
		expect(EAST_SLOT_POLYGONS[eastSlotOfSign(4)]).toBe(LEFT_MID);
		expect(EAST_SLOT_POLYGONS[eastSlotOfSign(7)]).toBe(BOTTOM_MID);
		expect(EAST_SLOT_POLYGONS[eastSlotOfSign(10)]).toBe(RIGHT_MID);
		// 金牛 / 双鱼 紧邻白羊(上左角上三角 / 上右角上三角)
		expect(EAST_SLOT_POLYGONS[eastSlotOfSign(2)]).toBe('0,0 33.333,0 33.333,33.333');
		expect(EAST_SLOT_POLYGONS[eastSlotOfSign(12)]).toBe('66.667,0 100,0 66.667,33.333');
	});
});

describe('过运日恒进请求', ()=>{
	const baseFields = {
		date: { value: moment('1990-05-15') }, time: { value: moment('1990-05-15 08:30:00') },
		ad: { value: 1 }, zone: { value: '+08:00' }, lat: { value: 31.2 }, lon: { value: 121.5 },
		gpsLat: { value: 31.2 }, gpsLon: { value: 121.5 }, tradition: { value: 0 },
	};
	it('未选过运日 → 本盘时区的今天(真实此刻按盘时区换算;盘时区 = 本机时区时即本机今天)', ()=>{
		const p = fieldsToParams(baseFields);
		expect(p.transitDate).toBe(moment().utcOffset('+08:00').format('YYYY/MM/DD'));
		const off = moment().utcOffset(); const a = Math.abs(off);
		const sys = `${off < 0 ? '-' : '+'}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
		expect(fieldsToParams({ ...baseFields, zone: { value: sys } }).transitDate).toBe(moment().format('YYYY/MM/DD'));
	});
	it('选了 → 原样', ()=>{
		expect(fieldsToParams({ ...baseFields, indiaTransitDate: { value: '2030/06/01' } }).transitDate).toBe('2030/06/01');
	});
});

describe('1582 前日期按儒略历标注', ()=>{
	it('真时刻 → 儒略标签;标签串原样回出(不双重换算);1582 后不变', ()=>{
		expect(formatJyotishDate(dashaMoment('1500-03-20T12:00:00'))).toBe('1500-03-10');
		expect(formatJyotishDate('1500-03-10')).toBe('1500-03-10');
		expect(formatJyotishDate(dashaMoment(null, '1500-03-10'))).toBe('1500-03-10');
		expect(formatJyotishDateTime(dashaMoment('1500-03-20T07:05:00'))).toBe('1500-03-10 07:05');
		expect(formatJyotishDate(dashaMoment('1997-01-04T07:57:12'))).toBe('1997-01-04');
		expect(formatJyotishDate(moment('2024-02-29'))).toBe('2024-02-29');
		// 改革当日:格里 1582-10-15 = 儒略 1582-10-05 之次日
		expect(formatJyotishDate(dashaMoment('1582-10-14T12:00:00'))).toBe('1582-10-04');
		expect(formatJyotishDate(dashaMoment('1582-10-15T12:00:00'))).toBe('1582-10-15');
	});
});

// 段界墙钟 = 出生地当地;后端 ISO 带出生时区偏移。浏览器时区 ≠ 出生地时区时「当前」段不得偏几个小时。
// (jest 改不了进程时区 → 一律断言「绝对时刻」与「显示字面」,二者在任何时区下都必须同时成立。)
describe('大运段界按出生时区判「当前」', ()=>{
	it('带偏移 ISO:绝对时刻按偏移、显示字面仍是出生地墙钟', ()=>{
		const m = dashaMoment('2026-10-24T10:00:00+05:30');
		expect(m.valueOf()).toBe(Date.UTC(2026, 9, 24, 4, 30, 0));
		expect(formatJyotishDateTime(m)).toBe('2026-10-24 10:00');
		expect(formatJyotishDate(dashaMoment('1500-03-20T12:00:00+01:00'))).toBe('1500-03-10');
		expect(formatJyotishDateTime(dashaMoment('1997-01-04T07:57:58.123456+05:30'))).toBe('1997-01-04 07:57');
	});
	it('只有日期标签 + 出生时区:落在出生时区的 0 点', ()=>{
		expect(dashaMoment(null, '2026-10-24', 330).valueOf()).toBe(Date.UTC(2026, 9, 23, 18, 30, 0));
		expect(formatJyotishDate(dashaMoment(null, '2026-10-24', 330))).toBe('2026-10-24');
	});
	it('出生时刻落在出生时区(前端自建段的起点)', ()=>{
		const fields = { date: { value: moment('1985-03-12', 'YYYY-MM-DD') }, time: { value: moment('14:30:00', 'HH:mm:ss') },
			zone: { value: '+05:30' } };
		const b = buildBirthMoment(fields);
		expect(b.valueOf()).toBe(Date.UTC(1985, 2, 12, 9, 0, 0));
		expect(b.format('YYYY-MM-DD HH:mm')).toBe('1985-03-12 14:30');
		expect(dashaZoneMinutes(fields)).toBe(330);
		expect(dashaZoneMinutes('-05:00')).toBe(-300);
		expect(dashaZoneMinutes(8)).toBe(480);
		expect(dashaZoneMinutes({})).toBe(null);
	});
	it('「当前」按绝对时刻:出生地墙钟两侧各 1 小时的段含此刻', ()=>{
		const now = moment.utc();
		const iso = (ms)=>moment.utc(ms).utcOffset(330).format('YYYY-MM-DDTHH:mm:ssZ');
		const seg = { start: dashaMoment(iso(now.valueOf() - 3600e3)), end: dashaMoment(iso(now.valueOf() + 3600e3)) };
		expect(dashaContainsNow(seg)).toBe(true);
		const past = { start: dashaMoment(iso(now.valueOf() - 7200e3)), end: dashaMoment(iso(now.valueOf() - 3600e3)) };
		expect(dashaContainsNow(past)).toBe(false);
	});
	it('前端自建子段写带偏移 ISO,读回不漂(曾写 UTC 串再当墙钟读)', ()=>{
		const b = moment.utc({ year: 2000, month: 0, date: 1, hour: 3 }).utcOffset(330, true);
		const s = dashaIsoOf(b);
		expect(s).toBe('2000-01-01T03:00:00.000+05:30');
		expect(dashaMoment(s, s).valueOf()).toBe(b.valueOf());
		const subs = buildDashaSubPeriods({ antardashas: [{ lord: { key: 'Sun' }, start: s, end: s, startIso: s, endIso: s }] });
		expect(subs[0].start.valueOf()).toBe(b.valueOf());
	});
	it('条件宿系大运(前端按出生时刻排)的小运起点 ≡ 大运起点,在任何浏览器时区下都不漂', ()=>{
		const fields = { date: { value: moment('1985-03-12', 'YYYY-MM-DD') }, time: { value: moment('23:30:00', 'HH:mm:ss') },
			zone: { value: '+05:30' } };
		const chartObj = { jyotish: { extendedDashas: { conditional: { shodashottari: { available: true, firstElapsedYears: 0,
			firstLord: { key: 'Sun' },
			mahadashas: [{ lord: { key: 'Sun' }, fullYears: 11, antardashas: [{ lord: { key: 'Sun' }, years: 2 }, { lord: { key: 'Mars' }, years: 3 }] }] } } } } };
		const d = buildVimshottariDasha(chartObj, fields, 'shodashottari');
		const m0 = d.items[0];
		expect(m0.start.valueOf()).toBe(Date.UTC(1985, 2, 12, 18, 0, 0));
		const subs = buildDashaSubPeriods(m0);
		expect(subs[0].start.valueOf()).toBe(m0.start.valueOf());
		expect(formatJyotishDateTime(subs[0].start)).toBe('1985-03-12 23:30');
	});
});

describe('敌友快照与页面同口径', ()=>{
	it('引擎标 basis=d1 → 快照首行写明临时友敌按 D1,矩阵逐格照引擎', ()=>{
		const gm = { available: true, basis: 'd1', planets: ['Sun', 'Moon'], planetLabels: ['太阳', '月亮'], matrix: [
			{ planet: 'Sun', planetLabel: '太阳', cells: [{ self: true }, { planet: 'Moon', planetLabel: '月亮', compoundCn: '大友' }] },
			{ planet: 'Moon', planetLabel: '月亮', cells: [{ planet: 'Sun', planetLabel: '太阳', compoundCn: '友' }, { self: true }] },
		] };
		const out = buildJyotishSnapshotLines({ jyotish: { grahaMaitri: gm } })['敌友（复合五分）'];
		expect(out[0]).toBe('临时友敌按出生 D1 宫位算(切分盘不变)');
		expect(out).toContain('| 太阳 | — | 大友 |');
		expect(out).toContain('| 月亮 | 友 | — |');
	});
});
