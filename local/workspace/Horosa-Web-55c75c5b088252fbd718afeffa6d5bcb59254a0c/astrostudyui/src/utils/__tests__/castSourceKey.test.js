// 起课签名单源:起课参数(fields 包装形)与参照盘(/chart 回包)按同一时刻地点给同一个键;对不上就不认参照盘。
import DateTime from '../../components/comp/DateTime';
import { castSourceKey, castChartFor, castFailureKeeps, natalSourceKey } from '../derivedChartSource';
import { castIsDiurnal } from '../castDiurnal';
import { isDiurnalLocal } from '../../divination/zeri/liurengLocal';

function fieldsAt(text, opts = {}){
	const dt = new DateTime().parse(text, 'YYYY-MM-DD HH:mm:ss');
	dt.setZone(opts.dateZone || '+08:00');   // 不随跑测试那台机器的本机时区
	const f = (v)=>({ value: v });
	return {
		date: f(dt), time: f(dt.clone()), ad: f(dt.ad),
		zone: f(opts.zone !== undefined ? opts.zone : '+08:00'),
		lon: f(opts.lon || '116e24'), lat: f(opts.lat || '39n54'),
		gpsLon: f(opts.gpsLon !== undefined ? opts.gpsLon : 116.4), gpsLat: f(opts.gpsLat !== undefined ? opts.gpsLat : 39.9),
	};
}
// 主盘请求:日期按 'YYYY/MM/DD'、时区取日期自带的(models/astro fieldsToParams);起盘服务回包 params.birth = 年-月-日 时刻(年月日原样)
function mainChartFor(fields, extra = {}){
	const d = fields.date.value;
	const date = d.format('YYYY/MM/DD');
	return { params: { birth: `${date.replace(/\//g, '-')} ${fields.time.value.format('HH:mm:ss')}`, ad: d.ad, zone: d.zone, lon: fields.lon.value, lat: fields.lat.value }, chart: { isDiurnal: true, nongli: { dayGanZi: '甲子' } }, ...extra };
}
// 择日宿主请求:时区取宿主地点(= fields 的时区字段)
function hostChartFor(fields){
	return { params: { birth: `${fields.date.value.format('YYYY-MM-DD')} ${fields.time.value.format('HH:mm:ss')}`, ad: 1, zone: fields.zone.value, lon: fields.lon.value, lat: fields.lat.value }, chart: { isDiurnal: false } };
}

describe('起课签名 castSourceKey / castChartFor', ()=>{
	test('起课参数与它自己取来的参照盘给同一个键(主盘请求 / 择日宿主请求两种写法)', ()=>{
		const f = fieldsAt('2026-10-25 09:05:00');
		expect(castSourceKey(f)).toBe('20261025|09:05:00|480|116e24|39n54');
		expect(castSourceKey(mainChartFor(f))).toBe(castSourceKey(f));
		expect(castChartFor(mainChartFor(f), f)).not.toBeNull();
		expect(castChartFor(hostChartFor(f), f)).not.toBeNull();
	});
	test('公元前:日期自带负号与「日期不带负号 + ad=-1」两种参数写法都认', ()=>{
		const f = fieldsAt('-300-03-10 12:00:00');
		expect(f.date.value.ad).toBe(-1);
		expect(castSourceKey(f)).toBe('-03000310|12:00:00|480|116e24|39n54');
		expect(castChartFor(mainChartFor(f), f)).not.toBeNull();
		expect(castSourceKey({ date: '300/03/10', time: '12:00:00', ad: -1, zone: '+08:00', lon: '116e24', lat: '39n54' })).toBe(castSourceKey(f));
		// 同年月日的公元后不是同一刻
		expect(castChartFor(mainChartFor(fieldsAt('0300-03-10 12:00:00')), f)).toBeNull();
	});
	test('时区写法不同(数字小时 / ±HH:MM / ±HHMM)同一偏移给同一个键', ()=>{
		const f = fieldsAt('2026-10-25 09:05:00', { zone: 8 });
		['+08:00', '+0800', '8', 8].forEach((z)=>{
			expect(castChartFor({ params: { birth: '2026-10-25 09:05:00', zone: z, lon: '116e24', lat: '39n54' } }, f)).not.toBeNull();
		});
	});
	test('时区字段与日期自带的时区不一致时两种都认(主盘按日期的发,择日宿主按字段的发)', ()=>{
		const f = fieldsAt('2026-10-25 09:05:00', { zone: '+09:00', dateZone: '+08:00' });
		expect(castChartFor(hostChartFor(f), f)).not.toBeNull();
		expect(castChartFor(mainChartFor(f), f)).not.toBeNull();
		expect(castSourceKey(f)).toBe('20261025|09:05:00|540|116e24|39n54');   // 规范键按时区字段
		expect(castChartFor({ params: { birth: '2026-10-25 09:05:00', zone: '+07:00', lon: '116e24', lat: '39n54' } }, f)).toBeNull();
	});
	test('换了时刻(差一分钟)/ 地点 → 参照盘不认', ()=>{
		const f = fieldsAt('2026-10-25 09:05:00');
		expect(castChartFor(mainChartFor(fieldsAt('2026-10-25 09:04:00')), f)).toBeNull();
		expect(castChartFor(mainChartFor(fieldsAt('2026-10-25 09:05:00', { lon: '121e28' })), f)).toBeNull();
		expect(castChartFor(mainChartFor(fieldsAt('2026-10-26 09:05:00')), f)).toBeNull();
	});
	test('不含设置:同一时刻地点、宫制 / 时间算法 / 日界不同仍是同一课', ()=>{
		const f = fieldsAt('2026-10-25 09:05:00');
		const c = mainChartFor(f);
		c.params = { ...c.params, hsys: 3, zodiacal: 1, after23NewDay: 0, nongliTimeAlg: 1 };
		expect(castChartFor(c, { ...f, timeAlg: { value: 1 }, hsys: { value: 3 } })).toBe(c);
	});
	test('认不出 → 空键,空键与任何键都不相等', ()=>{
		[null, undefined, {}, { params: {} }, { date: { value: null } }, 'x'].forEach((x)=>{ expect(castSourceKey(x)).toBe(''); });
		expect(castChartFor(null, fieldsAt('2026-10-25 09:05:00'))).toBeNull();
		expect(castChartFor({ params: {} }, {})).toBeNull();
		expect(castChartFor(mainChartFor(fieldsAt('2026-10-25 09:05:00')), {})).toBeNull();
	});
	test('与命类来源键分工:命类键按原样拼,卜类键规范化(两者不混用)', ()=>{
		const c = mainChartFor(fieldsAt('2026-10-25 09:05:00'));
		expect(natalSourceKey(c)).toBe('2026-10-25|09:05:00|+08:00|116e24|39n54');
	});
});

describe('取失败留存判据 castFailureKeeps', ()=>{
	test('同一课(签名相同)→ 留存;换课 / 屏上签名未知 → 清掉', ()=>{
		expect(castFailureKeeps('a', 'a')).toBe(true);
		expect(castFailureKeeps('a', 'b')).toBe(false);
		expect(castFailureKeeps('', '')).toBe(false);
		expect(castFailureKeeps('', 'a')).toBe(false);
		expect(castFailureKeeps(undefined, undefined)).toBe(false);
	});
});

describe('起课昼夜 castIsDiurnal', ()=>{
	test('参照盘与起课同一时刻 → 用参照盘的昼夜(与原先逐位相同)', ()=>{
		const f = fieldsAt('2026-10-25 23:30:00');
		expect(castIsDiurnal(mainChartFor(f), f)).toBe(true);   // 夹具里参照盘写的是昼(不按时刻重算)
		expect(castIsDiurnal(hostChartFor(f), f)).toBe(false);
	});
	test('参照盘是别的时刻的 / 没有参照盘 → 按起课时刻地点本地算(与择日扫描同一函数)', ()=>{
		const noon = fieldsAt('2026-10-25 12:00:00');
		const midnight = fieldsAt('2026-10-25 00:30:00');
		const other = mainChartFor(fieldsAt('2026-01-01 12:00:00'));
		expect(castIsDiurnal(other, midnight)).toBe(false);
		expect(castIsDiurnal(null, noon)).toBe(true);
		expect(castIsDiurnal(null, midnight)).toBe(isDiurnalLocal('2026-10-25', '00:30:00', 39.9, 116.4, 8));
		// 数值经纬缺时按经纬串换算
		const noGps = fieldsAt('2026-10-25 17:30:00', { gpsLat: '', gpsLon: '' });
		expect(castIsDiurnal(null, noGps)).toBe(isDiurnalLocal('2026-10-25', '17:30:00', 39.9, 116.4, 8));
	});
	test('认不出时刻 / 时区 → null', ()=>{
		expect(castIsDiurnal(null, null)).toBe(null);
		expect(castIsDiurnal(null, { date: { value: '2026-10-25' }, time: { value: '12:00' } })).toBe(null);
		expect(castIsDiurnal(null, fieldsAt('2026-10-25 12:00:00', { zone: 'abc', dateZone: undefined }))).toBe(null);
	});
});
