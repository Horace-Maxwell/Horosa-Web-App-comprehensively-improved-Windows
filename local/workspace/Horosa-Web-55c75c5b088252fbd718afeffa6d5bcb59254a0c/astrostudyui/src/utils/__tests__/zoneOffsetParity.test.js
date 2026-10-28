// 时区串 → 偏移分钟:单一来源 utils/zoneOffset.zoneOffsetMinutesOf。
// ① 大运段界(dashaZoneMinutes)与民用历出生时刻(civilMoment)都走它,结果与原先各自那份逐值相同;
// ② 节气折算北京时间的 parseZoneHours 口径有意不同(缺省东八区、前缀匹配、数字不取整),规范写法下两者一致;
// ③ 择日逐小时引擎的 zoneOffsetMinutes 委托单一来源,只补「认不出 → 东八区 480」;三式页的时区规范化与精确历法桥共用 zoneText.normalizeZone;
// ④ 全仓不许再新写一份「±HH[:MM]」时区正则:现存的几份口径各异(缺省值 / 单位 / 认 UTC·GMT·东西区),逐个登记、只许减。
import fs from 'fs';
import path from 'path';
import { zoneOffsetMinutesOf } from '../zoneOffset';
import { zoneOffsetMinutesOf as viaCivilMoment } from '../civilMoment';
import { dashaZoneMinutes } from '../../components/astro/indiaMain/dasha';
import { parseZoneHours } from '../beijingTimeShift';
import { zoneOffsetMinutes as zeriZoneMinutes } from '../../divination/zeri/hourlyScanEngine';
import { normalizeZone } from '../zoneText';

// 原先大运段界那份(对拍用)
function oldDashaZoneMinutes(src){
	let z = src;
	if(z && typeof z === 'object'){
		z = z.zone && typeof z.zone === 'object' ? z.zone.value : z.zone;
	}
	if(z === undefined || z === null || z === ''){ return null; }
	if(typeof z === 'number'){ return Number.isFinite(z) ? Math.round(z * 60) : null; }
	const m = /^([+-]?)(\d{1,2})(?::?(\d{2}))?$/.exec(`${z}`.trim());
	if(!m){
		const n = Number(z);
		return Number.isFinite(n) ? Math.round(n * 60) : null;
	}
	return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0));
}

const SAMPLES = ['+08:00', '-05:00', '+05:30', '+0530', '-0330', '+8', '-3', '8', '0', '+00:00', '+09:45', '-12:00', '+14:00',
	' +08:00 ', '5.5', '-4.75', 'abc', 'UTC+8', '+08:00:00', '+8.5', '', null, undefined, 8, 5.5, -3.25, NaN, Infinity,
	{ zone: '+05:30' }, { zone: { value: '-04:00' } }, { zone: { value: '' } }, {}];

describe('时区串解析单一来源', ()=>{
	test('大运段界:与原先那份逐值相同', ()=>{
		SAMPLES.forEach((z)=>{ expect([z, dashaZoneMinutes(z)]).toEqual([z, oldDashaZoneMinutes(z)]); });
	});
	test('civilMoment 转出的就是同一个函数', ()=>{
		expect(viaCivilMoment).toBe(zoneOffsetMinutesOf);
	});
	test('规范写法下节气折算口径与单一来源一致(只在缺省 / 非规范写法上有意不同)', ()=>{
		['+08:00', '-05:00', '+05:30', '+0530', '-0330', '+8', '-3', '8', '+00:00', '+09:45', '-12:00', '+14:00'].forEach((z)=>{
			expect([z, Math.round(parseZoneHours(z) * 60)]).toEqual([z, zoneOffsetMinutesOf(z)]);
		});
		expect(parseZoneHours('')).toBe(8);
		expect(zoneOffsetMinutesOf('')).toBe(null);
	});

	test('不许新写一份「±HH[:MM]」时区正则(现存的逐个登记,只许减)', ()=>{
		const SRC = path.join(__dirname, '..', '..');
		// 文件 → 允许的份数;口径与单一来源不同的原因写在后面
		const ALLOW = {
			'utils/zoneOffset.js': 1,	// 单一来源
			'utils/beijingTimeShift.js': 1,	// 节气折算:缺省东八区、前缀匹配
			'utils/interchangeFormats.js': 1,	// 导入格式:另认 GMT / UTC 前缀并规范成 ±HH:MM 串
			'utils/zoneText.js': 2,	// 时区串规范化(精算桥与三式同用):另认 UTC/GMT 与东 / 西区写法,认不出按缺省时区
			'utils/timezone.js': 1,	// 读 Intl 的「GMT+8」显示名
			'components/guolao/GuoLaoMoiraWheel.js': 1,	// 盘时区小时:缺省 NaN 交给候选链
		};
		const RE = /\(\\d\{1,2\}\)\(\?::\?\(\\d\{2\}\)\)\?/g;
		const over = [];
		const walk = (d)=>fs.readdirSync(d, { withFileTypes: true }).forEach((e)=>{
			const f = path.join(d, e.name);
			if(e.isDirectory()){ if(!/^(__tests__|node_modules|\.umi)$/.test(e.name)){ walk(f); } return; }
			if(!/\.jsx?$/.test(e.name)){ return; }
			const rel = path.relative(SRC, f).split(path.sep).join('/');
			const n = (fs.readFileSync(f, 'utf8').match(RE) || []).length;
			if(n > (ALLOW[rel] || 0)){ over.push(`${rel} ${n} > ${ALLOW[rel] || 0}`); }
		});
		walk(SRC);
		expect(over).toEqual([]);
		expect((fs.readFileSync(path.join(SRC, 'components/astro/indiaMain/dasha.js'), 'utf8').match(RE) || []).length).toBe(0);
		expect((fs.readFileSync(path.join(SRC, 'utils/civilMoment.js'), 'utf8').match(RE) || []).length).toBe(0);
		expect((fs.readFileSync(path.join(SRC, 'divination/zeri/hourlyScanEngine.js'), 'utf8').match(RE) || []).length).toBe(0);
		expect((fs.readFileSync(path.join(SRC, 'components/sanshi/SanShiUnitedMain.js'), 'utf8').match(RE) || []).length).toBe(0);
	});

	test('择日逐小时引擎:与原先那份逐值相同;只有「±HH[:MM] 之外的数字小时串」改按小时数读(原先一律东八区)', ()=>{
		const oldZeri = (zone)=>{
			if(typeof zone === 'number' && Number.isFinite(zone)){ return Math.round(zone * 60); }
			const text = `${zone === undefined || zone === null ? '' : zone}`.trim();
			if(!text){ return 480; }
			const m = /^([+-]?)(\d{1,2})(?::?(\d{2}))?$/.exec(text);
			if(!m){ return 480; }
			return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0));
		};
		const SAME = [...SAMPLES.filter((z)=>z === null || z === undefined || typeof z !== 'object'), '  ', '\t+09:00\n', 'GMT+8', '东8区', 'UTC',
			'-', '+', '08.00', true, false, [8], { zone: 8 }, 0, -0, 14, -12, 5.75, '-99', 99, -15];
		// 原先这些一律当东八区;现在与单一来源一样按小时数读(规范写法与数字不受影响)
		const CHANGED = { '5.5': 330, '-4.75': -285, '+8.5': 510, '1e1': 600, '12345': 740700 };
		SAME.filter((z)=>!(typeof z === 'string' && Object.prototype.hasOwnProperty.call(CHANGED, z.trim()))).forEach((z)=>{
			expect([z, zeriZoneMinutes(z)]).toEqual([z, oldZeri(z)]);
		});
		Object.keys(CHANGED).forEach((z)=>{
			expect([z, oldZeri(z), zeriZoneMinutes(z)]).toEqual([z, 480, CHANGED[z]]);
			expect(zeriZoneMinutes(z)).toBe(zoneOffsetMinutesOf(z));
		});
		// 规范写法与数字逐值与单一来源一致
		['+08:00', '-05:00', '+05:30', '+0530', '-0330', '+8', '-3', '8', 8, 5.5, -3.25].forEach((z)=>{
			expect([z, zeriZoneMinutes(z)]).toEqual([z, zoneOffsetMinutesOf(z)]);
		});
	});

	test('三式页时区规范化 = 精确历法桥 normalizeZone(原先那份逐字副本,对拍全部写法逐值相同)', ()=>{
		const oldSanshi = (zone, fallback = '+08:00')=>{
			const parse = (z)=>{
				const text = `${z === undefined || z === null ? '' : z}`.trim();
				if(!text){ return null; }
				let m = text.match(/^([+-])(\d{1,2})(?::?(\d{2}))?$/) || text.match(/^(?:UTC|GMT)\s*([+-])(\d{1,2})(?::?(\d{2}))?$/i);
				if(m){ return (m[1] === '-' ? -1 : 1) * (parseInt(m[2], 10) + parseInt(m[3] || '0', 10) / 60); }
				m = text.match(/^([东西])\s*(\d{1,2})(?:[:：]?(\d{1,2}))?\s*区?$/);
				if(m){ return (m[1] === '西' ? -1 : 1) * (parseInt(m[2], 10) + parseInt(m[3] || '0', 10) / 60); }
				const n = Number(text);
				return Number.isFinite(n) ? n : null;
			};
			const fmt = (h)=>{
				if(h === undefined || h === null || Number.isNaN(h)){ return '+08:00'; }
				const abs = Math.abs(h); let hh = Math.floor(abs); let mm = Math.round((abs - hh) * 60);
				if(mm >= 60){ hh += 1; mm -= 60; }
				return `${h < 0 ? '-' : '+'}${`${hh}`.padStart(2, '0')}:${`${mm}`.padStart(2, '0')}`;
			};
			const p = parse(zone);
			if(p === null || Number.isNaN(p)){ const fb = parse(fallback); return fmt(fb === null || Number.isNaN(fb) ? 8 : fb); }
			return fmt(p);
		};
		const ALL = [...SAMPLES.filter((z)=>z === null || z === undefined || typeof z !== 'object'), 'UTC+8', 'GMT-03:30', 'utc +5', '东8区', '西5', '东 5:30 区', '东8：30区', '+14:00', '-12', '0', '8.75', 'abc', '  '];
		[undefined, '+09:00', '', 'abc', 'UTC-2'].forEach((fb)=>{
			ALL.forEach((z)=>{ expect([z, fb, normalizeZone(z, fb)]).toEqual([z, fb, oldSanshi(z, fb)]); });
		});
	});
});

