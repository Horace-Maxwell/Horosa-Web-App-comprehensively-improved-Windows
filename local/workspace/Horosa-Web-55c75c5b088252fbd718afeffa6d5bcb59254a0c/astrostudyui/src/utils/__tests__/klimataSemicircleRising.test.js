// 七气候带「半圆上升时度」= 巨蟹至射手六座上升时度之和(Valens《选集》卷一·7 的定义)= 15 × 最长昼。
// 曾把 Valens 自家七带的级数 210 → 234(每带 +4,从最长昼 14h 起)直接套在本表 13–16h 七带上,与最长昼列对不上。
import { buildBands, semicircleRising } from '../astroClassicalDerived';

describe('七气候带半圆上升时度', ()=>{
	test('逐带 = 15 × 最长昼(195 → 240,每带 +7.5)', ()=>{
		const bands = buildBands();
		expect(bands.map((b)=>b.valens)).toEqual(bands.map((b)=>15 * b.longestDay));
		expect(bands.map((b)=>b.valens)).toEqual([195, 202.5, 210, 217.5, 225, 232.5, 240]);
	});
	test('Valens 原书的第一带(最长昼 14h)合计 210 —— 本表第 3 带(亚历山大,14h)与之相合', ()=>{
		expect(semicircleRising(14)).toBe(210);
		expect(buildBands()[2].valens).toBe(210);
	});
});
