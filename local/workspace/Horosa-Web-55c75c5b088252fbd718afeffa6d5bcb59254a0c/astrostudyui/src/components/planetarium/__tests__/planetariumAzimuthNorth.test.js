// 天文馆方位显示自正北顺时针与地平圈刻度(0=北 90=东 180=南 270=西)、「细节」页行星细节表同口径。
// 计算层 azimuth 自正南起不动,只在显示时换算。
let azimuthNorthOf; let formatAzimuth; let detailRowsForItem;
beforeAll(()=>{
	jest.resetModules();
	window.BABYLON = new Proxy({}, { get(target, key){ if(!(key in target)){ target[key] = function Stub(){}; } return target[key]; } });
	({ azimuthNorthOf, formatAzimuth, detailRowsForItem } = require('../babylon/itemText'));
});

describe('天文馆方位北起', ()=>{
	test('南起 → 北起:0→180、180→0、303.09→123.09;空值原样', ()=>{
		expect(azimuthNorthOf(0)).toBe(180);
		expect(azimuthNorthOf(180)).toBe(0);
		expect(azimuthNorthOf(303.09)).toBeCloseTo(123.09, 6);
		expect(azimuthNorthOf(-10)).toBe(170);
		expect(azimuthNorthOf(null)).toBe(null);
		expect(formatAzimuth(undefined)).toBe('--');
	});
	test('详情行里的方位按北起显示', ()=>{
		const rows = detailRowsForItem({ id: 'Moon', name: 'Moon', layer: 'body', azimuth: 303.09, altitudeAppa: 56.65, ra: 139.69, decl: 17.78 }, null);
		const text = rows.map((r)=>r.join(' ')).join('\n');
		expect(text).toContain('方位 123.09°');
		expect(text).not.toContain('方位 303.09°');
	});
});
