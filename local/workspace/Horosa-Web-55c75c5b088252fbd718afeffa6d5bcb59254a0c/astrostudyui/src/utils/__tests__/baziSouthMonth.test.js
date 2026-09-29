// [#93] 南半球月令:缺省不对冲(与 Java 路径同口径);「对冲」只对南纬生效 —— 月支取对冲之支、按年干五虎遁重起月干,
// 胎元 / 命宫 / 大运随之由引擎自算;北纬两档恒等。AI 快照在南纬盘标明所用口径。
import { buildLocalBaziResult, isSouthLatitude } from '../baziLunarLocal';
import { buildBaziSnapshotForParams } from '../../components/cntradition/BaZi';

const SYD = { date: '1990-05-18', time: '10:00:00', zone: '+10:00', lon: '151e12', lat: '33s52', gpsLon: 151.2, gpsLat: -33.87 };
const BJ = { date: '1990-05-18', time: '10:00:00', zone: '+08:00', lon: '118e27', lat: '31n38', gpsLon: 118.45, gpsLat: 31.63 };
const run = (p)=>buildLocalBaziResult({ timeAlg: 1, after23NewDay: 1, lateZiHourUseNextDay: 1, gender: 1, ...p }).bazi;

describe('[#93] 南半球月令', ()=>{
	test('南纬:缺省不对冲 → 辛巳月;对冲 → 丁亥月,胎元戊寅、首运戊子', ()=>{
		expect(run(SYD).fourColumns.month.ganzi).toBe('辛巳');
		const c = run({ ...SYD, southMonth: 'chong' });
		expect(c.fourColumns.month.ganzi).toBe('丁亥');
		expect(c.fourColumns.tai.ganzi).toBe('戊寅');
		expect(c.direction[0].mainDirect.ganzi).toBe('戊子');
		expect(c.fourColumns.year.ganzi + c.fourColumns.day.ganzi + c.fourColumns.time.ganzi).toBe('庚午癸未丁巳');
	});

	test('对冲月干按年干五虎遁:子月 → 午、丑月 → 未、寅月 → 申', ()=>{
		expect(run({ ...SYD, date: '1990-12-20', southMonth: 'chong' }).fourColumns.month.ganzi).toBe('壬午');
		expect(run({ ...SYD, date: '1991-01-20', southMonth: 'chong' }).fourColumns.month.ganzi).toBe('癸未');
		expect(run({ ...SYD, date: '1990-02-20', southMonth: 'chong' }).fourColumns.month.ganzi).toBe('甲申');
	});

	test('北纬两档恒等', ()=>{
		expect(JSON.stringify(run({ ...BJ, southMonth: 'chong' }))).toBe(JSON.stringify(run(BJ)));
	});

	test('南纬判定', ()=>{
		expect(isSouthLatitude({ lat: '33s52' })).toBe(true);
		expect(isSouthLatitude({ lat: '31n38' })).toBe(false);
		expect(isSouthLatitude({ lat: '-33.8' })).toBe(true);
		expect(isSouthLatitude({ gpsLat: -33.87 })).toBe(true);
		expect(isSouthLatitude({})).toBe(false);
	});

	test('AI 快照:南纬盘标明月令口径,北纬盘不输出该行', async ()=>{
		const base = { timeAlg: 1, after23NewDay: 1, lateZiHourUseNextDay: 1, gender: 1, phaseType: 0, godKeyPos: '年' };
		const s1 = await buildBaziSnapshotForParams({ ...base, ...SYD, southMonth: 'chong' });
		expect(s1).toMatch(/南半球月令：对冲/);
		const s2 = await buildBaziSnapshotForParams({ ...base, ...SYD });
		expect(s2).toMatch(/南半球月令：不对冲/);
		const s3 = await buildBaziSnapshotForParams({ ...base, ...BJ });
		expect(s3).not.toMatch(/南半球月令/);
	});
});
