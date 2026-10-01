// 八字本地引擎:年柱 / 月柱 / 交节距离(起运、节后天数)按出生的绝对时刻取,日柱 / 时柱仍按当地钟表。
// lunar-javascript 的节气表按北京时间排;此前非东八区直接喂当地钟表 → 交节在当地钟表上偏「8 − 时区」小时。
// 1990 年芒种 = 06-05 22:46:30 UTC(北京 06-06 06:46:30;巴黎 06-05 23:46:30;纽约 06-05 17:46:30;东京 06-06 07:46:30)。
import { buildLocalBaziResult, buildLocalNongliLite } from '../baziLunarLocal';

const run = (zone, lon, lat, date, time, extra = {})=>buildLocalBaziResult({
	date, time, zone, lon, lat, timeAlg: 1, after23NewDay: 1, lateZiHourUseNextDay: 1, gender: 1, ...extra,
}).bazi;
const pillars = (b)=>b.fourColumns.year.ganzi + b.fourColumns.month.ganzi + b.fourColumns.day.ganzi + b.fourColumns.time.ganzi;

describe('非东八区按绝对时刻换月', ()=>{
	test('巴黎 / 纽约芒种后 2 时 14 分出生 → 壬午月(日柱 / 时柱仍按当地钟表)', ()=>{
		const paris = run('+01:00', '2e21', '48n51', '1990-06-06', '02:00:00');
		expect(pillars(paris)).toBe('庚午壬午壬寅辛丑');
		expect(paris.nongli.jiedelta).toBe('芒种后第2天');
		const ny = run('-05:00', '74w00', '40n43', '1990-06-05', '20:00:00');
		expect(pillars(ny)).toBe('庚午壬午辛丑戊戌');
		expect(ny.nongli.jiedelta).toBe('芒种后第1天');
	});

	test('东京芒种前 46 分出生 → 仍是辛巳月', ()=>{
		expect(pillars(run('+09:00', '139e41', '35n41', '1990-06-06', '07:00:00'))).toBe('庚午辛巳壬寅甲辰');
	});

	test('起运按绝对时刻的交节距离:纽约芒种后出生男命(阳年顺排)距小暑约 31 天 → 十年余起运、首运癸未', ()=>{
		const ny = run('-05:00', '74w00', '40n43', '1990-06-05', '20:00:00');
		expect(ny.directInfo).toMatch(/^出生后10年5个月/);
		expect(ny.direction[0].mainDirect.ganzi).toBe('癸未');
	});

	test('东八区不变(对照)', ()=>{
		const bj = run('+08:00', '118e27', '31n38', '1990-06-06', '07:00:00');
		expect(pillars(bj)).toBe('庚午壬午壬寅甲辰');
		expect(bj.directInfo).toMatch(/^出生后10年5个月20天/);
	});

	test('立春同理:纽约 2024-02-04 05:00(北京 18:00,立春 16:27 之后)→ 甲辰年丙寅月', ()=>{
		const b = run('-05:00', '74w00', '40n43', '2024-02-04', '05:00:00');
		expect(b.fourColumns.year.ganzi + b.fourColumns.month.ganzi).toBe('甲辰丙寅');
	});

	test('奇门扫描用轻量版同口径', ()=>{
		const lite = buildLocalNongliLite({ date: '1990-06-06', time: '02:00:00', zone: '+01:00', lon: '2e21', lat: '48n51', timeAlg: 1, after23NewDay: 1, lateZiHourUseNextDay: 1, gender: 1 });
		expect(lite.bazi.fourColumns.month.ganzi).toBe('壬午');
		expect(lite.bazi.nongli.jiedelta).toBe('芒种后第2天');
	});
});
