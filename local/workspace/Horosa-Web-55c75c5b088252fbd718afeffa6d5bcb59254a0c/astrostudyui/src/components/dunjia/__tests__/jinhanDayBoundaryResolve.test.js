// 奇门「日家·古籍金函系」早返路径的日界两键与主路径同经单源归一:缺键 = 全局现值、'0' / '1' 字符串与数字同义。
// (此前早返不归一,四柱里晚子时进位又按真值判:缺键按「不进位」、'0' 当成开)
import { calcDunJia } from '../DunJiaCalc';
import { buildLocalBaziResult } from '../../../utils/baziLunarLocal';

const gz = (p)=>(p && (p.ganzhi || p.ganZhi)) || '';
function nongliOf(date, time, after23){
	const local = buildLocalBaziResult({ date, time, zone: '+08:00', lon: '120e00', lat: '30n00', gpsLon: 120, gpsLat: 30, ad: 1, gender: 1, timeAlg: 1, after23NewDay: after23 });
	const four = local.bazi.fourColumns;
	return { ...local.bazi.nongli, bazi: local.bazi, yearGanZi: gz(four.year), monthGanZi: gz(four.month), dayGanZi: gz(four.day), time: gz(four.time), timeGanZi: gz(four.time) };
}
const fieldsOf = (d, t)=>({ date: { value: { format: ()=>d } }, time: { value: { format: ()=>t } }, zone: { value: '+08:00' } });
const sig = (p)=>JSON.stringify({ g: p && p.ganzhi, cells: p && p.cells });

describe('金函日家 × 日界归一', ()=>{
	const D = '2025-07-15';
	const T = '23:30:00';
	const nl = nongliOf(D, T, 1);
	const run = (opts)=>calcDunJia(fieldsOf(D, T), nl, { paiPanType: 6, ...opts }, {});
	test('缺键 = 全局现值(出厂:23 点换日、晚子时次日干)', ()=>{
		expect(sig(run({}))).toBe(sig(run({ after23NewDay: 1, lateZiHourUseNextDay: 1 })));
	});
	test("'0' / '1' 字符串与数字同义('0' 不当真)", ()=>{
		expect(sig(run({ after23NewDay: '0', lateZiHourUseNextDay: '0' }))).toBe(sig(run({ after23NewDay: 0, lateZiHourUseNextDay: 0 })));
		expect(sig(run({ after23NewDay: '1', lateZiHourUseNextDay: '1' }))).toBe(sig(run({ after23NewDay: 1, lateZiHourUseNextDay: 1 })));
	});
	test('判别力:两档确实出不同的盘(本时刻晚子时落在判据上)', ()=>{
		const combos = [[0, 0], [0, 1], [1, 0], [1, 1]].map(([a, l])=>sig(run({ after23NewDay: a, lateZiHourUseNextDay: l })));
		expect(new Set(combos).size).toBeGreaterThan(1);
		expect(combos[2]).not.toBe(combos[0]);   // 晚子时当日干:日界进位与否出不同的时柱
	});
});
