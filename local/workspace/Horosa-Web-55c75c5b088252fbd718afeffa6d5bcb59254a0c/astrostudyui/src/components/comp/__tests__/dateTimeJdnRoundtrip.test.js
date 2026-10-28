// 公共件 DateTime「儒略日 → 年月日时分秒」往返锁。
//
// 病理:旧实现把日内小数逐级 floor 到秒、再对余数四舍五入且不进位 → 约一半整分时刻 addSecond(0) 后显示成 HH:mm:60;
//       负儒略日(公元前 4713 年以前)取绝对值的小数部分 → 时刻成镜像、日期错一天。
// 判据:承诺域两端、儒略日 0 两侧、1582 切换、公元元年两侧 × 若干时刻,calcJdn → calcDateTime 逐字相等;
//       整日 1440 个整分 addSecond(0) 秒位恒为 0;逐秒推进不出现 60。
import DateTime from '../DateTime';

function mk(y, m, d, hh, mi, ss, zone){
	const a = new DateTime({ ad: y < 0 ? -1 : 1, year: Math.abs(y), month: m, date: d, hour: hh, minute: mi, second: ss || 0, zone: zone || '+08:00' });
	a.calcJdn();
	return a;
}

describe('DateTime 儒略日往返', ()=>{
	const DAYS = [[-12998, 3, 10], [-5000, 6, 1], [-4714, 12, 31], [-4713, 1, 1], [-4713, 1, 2], [-1, 12, 31], [1, 1, 1],
		[1582, 10, 4], [1582, 10, 15], [1900, 2, 28], [2026, 7, 19], [9999, 12, 31], [12000, 1, 1], [16798, 12, 29]];
	const TIMES = [[0, 0, 0], [0, 0, 1], [6, 30, 0], [11, 59, 59], [12, 0, 0], [18, 45, 30], [23, 59, 0], [23, 59, 59]];

	test.each(['+08:00', '+00:00', '-05:30'])('承诺域两端 / 儒略日 0 两侧 / 1582 切换 / 公元元年两侧逐字往返(时区 %s)', (zone)=>{
		const bad = [];
		DAYS.forEach(([y, m, d])=>{
			TIMES.forEach(([hh, mi, ss])=>{
				const a = mk(y, m, d, hh, mi, ss, zone);
				const b = mk(2000, 1, 1, 0, 0, 0, zone);
				b.jdn = a.jdn;
				b.calcDateTime();
				const sa = a.format('YYYY-MM-DD HH:mm:ss');
				const sb = b.format('YYYY-MM-DD HH:mm:ss');
				if(sa !== sb || a.ad !== b.ad){ bad.push(`${sa} → ${sb}`); }
			});
		});
		expect(bad).toEqual([]);
	});

	test('整日 1440 个整分:addSecond(0) 后秒位恒为 0(不出现 :60)', ()=>{
		const bad = [];
		for(let k = 0; k < 1440; k++){
			const a = mk(2026, 7, 19, Math.floor(k / 60), k % 60, 0);
			a.addSecond(0);
			if(a.second !== 0 || a.minute !== k % 60 || a.hour !== Math.floor(k / 60)){ bad.push(`${k} → ${a.format('HH:mm:ss')}`); }
		}
		expect(bad).toEqual([]);
	});

	test('逐秒推进 3600 步:秒位从不为 60,终值准确;跨午夜进位到次日', ()=>{
		const p = mk(2026, 7, 19, 10, 0, 0);
		let sixty = 0;
		for(let i = 0; i < 3600; i++){ p.addSecond(1); if(p.second >= 60){ sixty++; } }
		expect(sixty).toBe(0);
		expect(p.format('YYYY-MM-DD HH:mm:ss')).toBe('2026-07-19 11:00:00');
		const q = mk(2026, 12, 31, 23, 59, 59);
		q.addSecond(1);
		expect(q.format('YYYY-MM-DD HH:mm:ss')).toBe('2027-01-01 00:00:00');
		const r = mk(1582, 10, 4, 23, 59, 59);
		r.addSecond(1);
		expect(r.format('YYYY-MM-DD HH:mm:ss')).toBe('1582-10-15 00:00:00');
		const s = mk(-1, 12, 31, 23, 59, 30);
		s.addSecond(45);
		expect(s.ad).toBe(1);
		expect(s.format('YYYY-MM-DD HH:mm:ss')).toBe('1-01-01 00:00:15');
	});

	test('公元前远古往返不镜像(公元前 5000 年 18:45 不变成次日 05:15)', ()=>{
		const a = mk(-5000, 6, 1, 18, 45, 0);
		a.addSecond(0);
		expect(a.ad).toBe(-1);
		expect(a.format('YYYY-MM-DD HH:mm:ss')).toBe('-5000-06-01 18:45:00');
		const b = mk(-12998, 3, 10, 6, 30, 0);
		b.addSecond(-1);
		expect(b.format('YYYY-MM-DD HH:mm:ss')).toBe('-12998-03-10 06:29:59');
	});

	test('jdn 未同步的对象(缺省构造后改字段 / clone 后改字段)addSecond 以字段为真值', ()=>{
		const a = new DateTime({ ad: 1, year: 2026, month: 7, date: 19, hour: 10, minute: 0, second: 0, zone: '+08:00' });
		// 构造器不算 jdn(恒 0):旧实现在此基础上加秒 → 跳到公元前 4713 年
		a.addSecond(30);
		expect(a.format('YYYY-MM-DD HH:mm:ss')).toBe('2026-07-19 10:00:30');
		const b = a.clone();
		b.hour = 3;
		b.addSecond(0);
		expect(b.format('YYYY-MM-DD HH:mm:ss')).toBe('2026-07-19 03:00:30');
	});

	test('分 / 时 / 日加减走儒略日轴:公元前闰年 2 月、1582 切换、公元元年两侧', ()=>{
		const a = mk(-1, 2, 28, 12, 0, 0);
		a.addDate(1);
		expect(a.format('YYYY-MM-DD')).toBe('-1-02-29');	// 公元前 1 年是儒略闰年
		a.addDate(1);
		expect(a.format('YYYY-MM-DD')).toBe('-1-03-01');
		const b = mk(-2, 2, 28, 12, 0, 0);
		b.addDate(1);
		expect(b.format('YYYY-MM-DD')).toBe('-2-03-01');
		const c = mk(1582, 10, 3, 23, 30, 0);
		c.addMinute(60);
		expect(c.format('YYYY-MM-DD HH:mm:ss')).toBe('1582-10-04 00:30:00');
		c.addHour(24);
		expect(c.format('YYYY-MM-DD HH:mm:ss')).toBe('1582-10-15 00:30:00');
		c.addDate(-1);
		expect(c.format('YYYY-MM-DD HH:mm:ss')).toBe('1582-10-04 00:30:00');
		const d = mk(1, 1, 1, 0, 10, 0);
		d.addMinute(-20);
		expect(d.ad).toBe(-1);
		expect(d.format('YYYY-MM-DD HH:mm:ss')).toBe('-1-12-31 23:50:00');
		const e = mk(2024, 2, 28, 23, 0, 0);
		e.addHour(2);
		expect(e.format('YYYY-MM-DD HH:mm:ss')).toBe('2024-02-29 01:00:00');
	});

	test('公元前闰年 2 月 29 日可设、月长按纯儒略历', ()=>{
		const a = mk(-1, 2, 1, 0, 0, 0);
		expect(()=>a.setDay(29)).not.toThrow();
		expect(a.getMonthDays(-1, 2)).toBe(29);
		expect(a.getMonthDays(-5, 2)).toBe(29);
		expect(a.getMonthDays(-4, 2)).toBe(28);
		expect(a.getMonthDays(-12997, 2)).toBe(29);
		expect(a.getMonthDays(4, 2)).toBe(29);
		expect(a.getMonthDays(1900, 2)).toBe(28);
		expect(a.getMonthDays(1500, 2)).toBe(29);
	});
});
