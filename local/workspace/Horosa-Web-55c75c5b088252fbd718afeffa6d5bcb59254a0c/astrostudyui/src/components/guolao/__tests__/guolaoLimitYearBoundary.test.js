// [Q-188/T-125] 七政大限年界:立春 / 冬至两档此前要 chart.nongli.jieqi 的 lichun/dongzhi 字段(后端恒 null)→ 静默回退元旦(死档)。
// 现由本地节气表精算年界时刻,并给出岁次年号偏移;大限表 birthFrac 与岁数带同口径。缺省元旦档逐字零回归。
import { moiraBirthYearFraction, moiraBirthYearBasis, moiraBuildLimitTable } from '../GuoLaoMoiraWheel';

const chartOf = (date, time, zone = '+08:00') => ({ params: { date, time, zone } });

describe('年界基准:元旦 / 立春 / 冬至', ()=>{
	test('元旦档零回归:frac 同旧、yearShift 恒 0', ()=>{
		const c = chartOf('2006/10/04', '09:58');
		const b = moiraBirthYearBasis(c, undefined, 'gregorian');
		expect(b.yearShift).toBe(0);
		expect(b.frac).toBeCloseTo(moiraBirthYearFraction(c, undefined, 'gregorian'), 12);
		expect(b.frac).toBeGreaterThan(0.75);
		expect(b.frac).toBeLessThan(0.76);
	});

	test('立春界:立春(2006-02-04 07:27 CST)后生人 → 年界=当年立春,frac 自立春起算,yearShift 0', ()=>{
		const b = moiraBirthYearBasis(chartOf('2006/10/04', '09:58'), undefined, 'lichun');
		expect(b.yearShift).toBe(0);
		// 2006-02-04 07:27 → 2006-10-04 09:58 ≈ 242.1 日 / 365.25 ≈ 0.663
		expect(b.frac).toBeGreaterThan(0.655);
		expect(b.frac).toBeLessThan(0.67);
	});

	test('立春界:立春前生人 → 年界=上一年立春,岁次退一年(yearShift −1),frac 接近 1', ()=>{
		const b = moiraBirthYearBasis(chartOf('2006/01/20', '12:00'), undefined, 'lichun');
		expect(b.yearShift).toBe(-1);
		expect(b.frac).toBeGreaterThan(0.95);
		expect(b.frac).toBeLessThan(1);
	});

	test('冬至界(天正建子):冬至前生人年界=上一年冬至,yearShift 0;冬至后生人年界=本年冬至,yearShift +1', ()=>{
		const before = moiraBirthYearBasis(chartOf('2006/01/20', '12:00'), undefined, 'dongzhi');
		expect(before.yearShift).toBe(0);
		expect(before.frac).toBeGreaterThan(0.07);   // 2005-12-22 → 01-20 ≈ 29 日
		expect(before.frac).toBeLessThan(0.09);
		const after = moiraBirthYearBasis(chartOf('2006/12/25', '12:00'), undefined, 'dongzhi');
		expect(after.yearShift).toBe(1);
		expect(after.frac).toBeGreaterThan(0);
		expect(after.frac).toBeLessThan(0.02);
	});

	test('盘时区换算:同一 UTC 时刻在 +00:00 表达,年界随之换到该时区墙钟(frac 不变)', ()=>{
		const cst = moiraBirthYearBasis(chartOf('2006/02/04', '08:00', '+08:00'), undefined, 'lichun');   // 立春 07:27 CST 后 33 分
		const utc = moiraBirthYearBasis(chartOf('2006/02/04', '00:00', '+00:00'), undefined, 'lichun');   // 同一瞬间
		expect(cst.yearShift).toBe(0);
		expect(utc.yearShift).toBe(0);
		expect(Math.abs(cst.frac - utc.frac)).toBeLessThan(1e-6);
		expect(cst.frac).toBeGreaterThan(0);
		expect(cst.frac).toBeLessThan(0.001);
	});

	test('chart.nongli 显式给出节气时刻时优先(旧约定保留)', ()=>{
		const c = { params: { date: '2006/10/04', time: '09:58', zone: '+08:00' }, nongli: { jieqi: { lichun: '2006/02/04 07:27' } } };
		const b = moiraBirthYearBasis(c, undefined, 'lichun');
		expect(b.frac).toBeGreaterThan(0.655);
		expect(b.frac).toBeLessThan(0.67);
	});
});

describe('大限表 birthFrac 同口径', ()=>{
	test('缺省(无 birthFrac)逐字同旧', ()=>{
		const a = moiraBuildLimitTable(242.46, 2006, 9);
		const b = moiraBuildLimitTable(242.46, 2006, 9, 0);
		expect(b).toEqual(a);
		expect(a[0].fromAge).toBe(1);
		expect(a[0].fromYear).toBe(2006);
	});

	test('birthFrac 推后各宫界岁数(照 Moira val=age−1−birthFrac),年号跟随', ()=>{
		const rows0 = moiraBuildLimitTable(242.46, 2006, 9, 0);
		const rows1 = moiraBuildLimitTable(242.46, 2006, 9, 0.758);
		// 首宫年数 = 9 + 2.46/3 ≈ 9.82;无 frac 第二限自 11 岁起(round(10.82)),有 frac 自 12 岁起(round(11.58))
		expect(rows0[1].fromAge).toBe(11);
		expect(rows1[1].fromAge).toBe(12);
		expect(rows1[1].fromYear).toBe(2006 + 12 - 1);
		expect(rows1.length).toBe(12);
	});
});
