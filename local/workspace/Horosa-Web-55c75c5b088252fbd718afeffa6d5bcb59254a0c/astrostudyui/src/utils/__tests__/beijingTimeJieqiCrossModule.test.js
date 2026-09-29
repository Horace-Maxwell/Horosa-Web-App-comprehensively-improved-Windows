import { Solar } from 'lunar-javascript';
import { bjShiftMinutes, shiftSolarMinutes, parseZoneHours } from '../beijingTimeShift';
import { buildLocalJieqiYearSeed } from '../localNongliAdapter';
import { heluoSolarTermOfDate } from '../heluoLocal';
import { heluoSolarTermForDate } from '../aiAnalysisContext';
import { __testing__ as dunjiaTesting } from '../../components/dunjia/DunJiaCalc';

// lunar-javascript 的节气表按北京时间编;凡拿当地钟表 / 日期比节气的地方都要先折算(与八字主盘同口径)。
// 2024 寒露 = 北京时间 10-08 02:59:57 = 纽约(-05:00)10-07 13:59:57 —— 跨日,用它看各处是否按当地钟表比。

describe('beijingTimeShift', ()=>{
	it('东八区 / 缺时区平移为 0,其余按 8 − 时区', ()=>{
		expect(bjShiftMinutes('+08:00')).toBe(0);
		expect(bjShiftMinutes(null)).toBe(0);
		expect(bjShiftMinutes('')).toBe(0);
		expect(bjShiftMinutes('-05:00')).toBe(13 * 60);
		expect(bjShiftMinutes('+05:30')).toBe(150);
		expect(parseZoneHours('+0530')).toBe(5.5);
		expect(shiftSolarMinutes(Solar.fromYmdHms(2024, 10, 8, 2, 59, 57), -13 * 60).toYmdHms()).toBe('2024-10-07 13:59:57');
	});
});

describe('本地节气种子按当地钟表(奇门 / 节气页本地回退 / 奇门择日 / AI 挂载共用)', ()=>{
	it('东八区逐字节不变,纽约折成当地钟表且交节日干支按当地日期', ()=>{
		const bj = buildLocalJieqiYearSeed(2024, '+08:00');
		expect(bj['寒露'].time).toBe('2024-10-08 02:59:57');
		expect(buildLocalJieqiYearSeed(2024, null)).toEqual(bj);
		const ny = buildLocalJieqiYearSeed(2024, '-05:00');
		expect(ny['寒露'].time).toBe('2024-10-07 13:59:57');
		expect(ny['寒露'].dateKey).toBe('20241007');
		expect(ny['寒露'].dayGanzhi).toBe(Solar.fromYmd(2024, 10, 7).getLunar().getDayInGanZhi());
		expect(bj['寒露'].dayGanzhi).toBe(Solar.fromYmd(2024, 10, 8).getLunar().getDayInGanZhi());
	});

	it('奇门当前节气(含三式本地路由、择日扫描):按当地钟表比交节', ()=>{
		const at = (h, zone)=>dunjiaTesting.resolveCurrentJieqi({}, { year: 2024, month: 10, day: 7, hour: h, minute: 0 }, {}, zone);
		// 纽约 10-07 13:59:57 交寒露(此前种子是北京时间 10-08 02:59:57,纽约当天 14 点仍判秋分)
		expect(at(12, '-05:00')).toBe('秋分');
		expect(at(14, '-05:00')).toBe('寒露');
		// 东八区:10-07 全天仍是秋分(寒露在 10-08 凌晨)
		expect(at(14, '+08:00')).toBe('秋分');
		expect(dunjiaTesting.resolveCurrentJieqi({}, { year: 2024, month: 10, day: 8, hour: 3, minute: 0 }, {}, '+08:00')).toBe('寒露');
	});
});

describe('河洛出生节气(页面与 AI 挂载同一份)', ()=>{
	it('整日口径:交节当天即算已交;海外按节气的当地日期(东八区不变)', ()=>{
		// 东八区:寒露 10-08 02:59 → 10-08 起算寒露、10-07 仍是秋分
		expect(heluoSolarTermOfDate('2024-10-08', '+08:00').term).toBe('寒露');
		expect(heluoSolarTermOfDate('2024-10-07', '+08:00').term).toBe('秋分');
		expect(heluoSolarTermOfDate('2024-10-07', null).term).toBe('秋分');
		// 纽约:寒露在当地 10-07 13:59 → 10-07 即算寒露(此前把当地日期当北京日期查,判秋分)、10-06 仍是秋分
		expect(heluoSolarTermOfDate('2024-10-07', '-05:00').term).toBe('寒露');
		expect(heluoSolarTermOfDate('2024-10-06', '-05:00').term).toBe('秋分');
		expect(heluoSolarTermOfDate('2024-10-07', '-05:00').hou).toBe(1);
		// AI 挂载与页面同一份
		expect(heluoSolarTermForDate('2024-10-07', 'tuWangKunGen', '-05:00')).toEqual(heluoSolarTermOfDate('2024-10-07', '-05:00', 'tuWangKunGen'));
		expect(heluoSolarTermForDate('2024-10-08', 'tuWangKunGen')).toEqual(heluoSolarTermOfDate('2024-10-08', undefined, 'tuWangKunGen'));
		expect(heluoSolarTermForDate('', 'tuWangKunGen')).toBeNull();
	});
});
