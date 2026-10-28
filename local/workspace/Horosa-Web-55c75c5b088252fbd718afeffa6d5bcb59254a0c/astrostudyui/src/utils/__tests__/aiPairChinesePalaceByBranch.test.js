// 紫微合盘按宫位地支找宫(宫干支第二字),不按宫位数组下标:下标随盘而变、不等于固定地支位。
// 本文件不静态引入合盘模块 —— 替身要在模块首次载入前装上。
const zwOf = (date, time, gender)=>({ birth: { date, time, zone: '+08:00', lon: '121e28', lat: '31n14', gpsLon: 121.47, gpsLat: 31.23, ad: 1, gender }, opts: { timeAlg: 0, after23NewDay: 1, lateZiHourUseNextDay: 1 } });
const build = (rotateBy)=>{
	let text = '';
	let calls = 0;
	jest.resetModules();
	jest.isolateModules(()=>{
		jest.doMock('../../components/ziwei/ZiweiCalc', ()=>{
			const actual = jest.requireActual('../../components/ziwei/ZiweiCalc');
			const rot = (c, k)=>{
				const n = c.houses.length;
				const back = (i)=>((i - k) % n + n) % n;
				return { ...c, houses: c.houses.map((_, i)=>c.houses[(i + k) % n]), lifeHouseIndex: back(c.lifeHouseIndex), bodyHouseIndex: back(c.bodyHouseIndex) };
			};
			return { ...actual, calcZiwei: (...args)=>{ calls++; return rot(actual.calcZiwei(...args), rotateBy); } };
		});
		const zw = require('../../constants/ZWConst');
		zw.ZWSchool.school = 'beipai'; zw.refreshActiveSiHua();
		text = require('../pairChineseData').buildZiweiPairText(zwOf('1990-05-18', '10:00:00', 1), zwOf('1992-03-07', '08:30:00', 0));
	});
	return { text, calls };
};
test('宫位数组整体转个位置(命宫 / 身宫下标随之),四化入宫与命身互落逐字不变', ()=>{
	const plain = build(0);
	expect(plain.calls).toBe(2);
	expect(plain.text).toContain('对方命宫在亥 → 本人兄弟宫;对方身宫在未 → 本人疾厄宫');
	[1, 5, 7].forEach((k)=>{
		const r = build(k);
		expect(r.calls).toBe(2);
		expect(r.text).toBe(plain.text);
	});
});
