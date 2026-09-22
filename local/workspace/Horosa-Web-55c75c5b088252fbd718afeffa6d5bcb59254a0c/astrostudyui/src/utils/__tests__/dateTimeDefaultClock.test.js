// [Q-141 裁决 2026-09-18] `new DateTime()` 缺省钟面 = 真实此刻换算到缺省时区(+08:00),不再把本机墙钟数字硬贴 +08:00。
//   修前:UTC-4 本机在 2026-09-18T03:30Z 得「2026-09-17 23:30 +08:00」(错 12 小时);修后得「2026-09-18 11:30 +08:00」。
//   东八区本机与传入完整 opt 的构造逐字不变;nowInZone 与缺省钟面同口径。
//   (jest 沙箱里 process.env.TZ 改不了 Node 的时区缓存,故期望值按固定瞬时 + 固定时区算术给出,与本机时区无关。)
import moment from 'moment';
import DateTime from '../../components/comp/DateTime';

const INSTANT = '2026-09-18T03:30:00Z';   // = 2026-09-18 11:30 @ +08:00
const fieldsOf = (d)=>[d.ad, d.zone, d.year, d.month, d.date, d.hour, d.minute, d.second];

describe('[Q-141] DateTime 缺省钟面 = 真实此刻 @ +08:00', ()=>{
	beforeEach(()=>{ jest.useFakeTimers('modern'); jest.setSystemTime(new Date(INSTANT)); });
	afterEach(()=>{ jest.useRealTimers(); });

	test('缺省 DateTime = 2026-09-18 11:30:00 +08:00(与本机时区无关;修前 = 本机墙钟数字硬贴 +08:00)', ()=>{
		expect(fieldsOf(new DateTime())).toEqual([1, '+08:00', 2026, 9, 18, 11, 30, 0]);
	});
	test('判别向量:非东八区本机的墙钟小时 ≠ 11(修前口径会把它贴成 +08:00);东八区本机则逐字不变', ()=>{
		const localOff = moment().utcOffset();
		if(localOff === 480){ expect(new DateTime().hour).toBe(moment().hour()); }
		else{ expect(moment().hour()).not.toBe(11); expect(new DateTime().hour).toBe(11); }
	});
	test('与 nowInZone(+08:00) 同口径', ()=>{
		expect(fieldsOf(new DateTime())).toEqual(fieldsOf(DateTime.nowInZone('+08:00')));
	});
	test('传入完整 opt 的构造不走钟面(逐字不变)', ()=>{
		const d = new DateTime({ ad: 1, zone: '-05:00', year: 1990, month: 3, date: 15, hour: 7, minute: 30, second: 0 });
		expect(fieldsOf(d)).toEqual([1, '-05:00', 1990, 3, 15, 7, 30, 0]);
	});
});
