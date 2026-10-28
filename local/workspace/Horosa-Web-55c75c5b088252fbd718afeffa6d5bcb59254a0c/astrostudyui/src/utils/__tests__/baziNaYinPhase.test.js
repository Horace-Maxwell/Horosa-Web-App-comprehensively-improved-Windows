/**
 * 纳音长生 golden（八字各视图显示「纳音·长生」用；非细盘「星运」）：
 * 纳音五行在本柱地支的十二长生，与后端 wuxingphase.json「纳音{五行}_{支}」逐项一致（土从水土同长生）。
 */
import { buildLocalBaziResult } from '../baziLunarLocal';

function cols(date, time){
	return buildLocalBaziResult({
		date, time, zone: '+08:00', lon: 113.0, gpsLon: 113.0, lat: 23.0, gpsLat: 23.0,
		gender: 1, timeAlg: 1,
	}).bazi.fourColumns;
}

describe('八字 纳音长生（旧版柱视图字段 nayingPhase）', () => {
	test('2026-06-22（丙午/甲午/丁卯/己酉）→ 胎/沐浴/沐浴/沐浴', () => {
		const c = cols('2026-06-22', '18:00:00');
		expect(c.year.nayingPhase).toBe('胎');   // 天河水·午
		expect(c.month.nayingPhase).toBe('沐浴'); // 沙中金·午
		expect(c.day.nayingPhase).toBe('沐浴');   // 炉中火·卯
		expect(c.time.nayingPhase).toBe('沐浴');  // 大驿土·酉
	});

	test('纳音长生非空（每柱都有星运）', () => {
		const c = cols('2000-01-01', '12:00:00');
		['year', 'month', 'day', 'time'].forEach((k) => {
			expect(typeof c[k].nayingPhase).toBe('string');
			expect(c[k].nayingPhase.length).toBeGreaterThan(0);
		});
	});
});
