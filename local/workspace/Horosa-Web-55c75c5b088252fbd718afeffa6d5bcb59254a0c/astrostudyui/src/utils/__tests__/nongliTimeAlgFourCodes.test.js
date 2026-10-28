// 取农历的时间算法按四档的实际换算口径归一(0 真太阳时 / 1 直接时间 / 3 平太阳时;2 春分定卯时 = 直接时间),
// 与后端 TimeZiAlg.calcBasis 同;此前按 0/1 二值归一,2 / 3 都成了真太阳时。六爻盘头的称呼随之。
import { normalizeNongliTimeAlg } from '../preciseCalcBridge';
import { gzTimeLabel } from '../../components/guazhan/GZChart';

test('四档归一', ()=>{
	expect([0, 1, 2, 3].map(normalizeNongliTimeAlg)).toEqual([0, 1, 1, 3]);
	expect(['1', '2', '3', '', undefined, null, 'x', true].map(normalizeNongliTimeAlg)).toEqual([1, 1, 3, 0, 0, 0, 0, 1]);
});

test('🔴 请求体带归一后的口径(平太阳时不再被折成真太阳时)', async ()=>{
	jest.resetModules();
	const req = require('../request');
	const bodies = [];
	const spy = jest.spyOn(req, 'default').mockImplementation(async (url, opts)=>{ bodies.push(JSON.parse(opts.body)); return { Result: { birth: 'x', year: '甲子', monthInt: 1, dayInt: 1, time: '甲子' } }; });
	try{
		const { fetchPreciseNongli } = require('../preciseCalcBridge');
		await fetchPreciseNongli({ date: '1990-05-18', time: '10:00:00', zone: '+08:00', lon: '118e27', lat: '31n38', timeAlg: 3 });
		await fetchPreciseNongli({ date: '1990-05-18', time: '10:00:00', zone: '+08:00', lon: '118e27', lat: '31n38', timeAlg: 2 });
		expect(bodies.map((b)=>b.timeAlg)).toEqual([3, 1]);
	}finally{ spy.mockRestore(); }
});

test('六爻盘头称呼随时间算法', ()=>{
	expect([0, 1, 2, 3].map((v)=>gzTimeLabel({ timeAlg: { value: v } }))).toEqual(['真太阳时', '直接时间', '直接时间', '平太阳时']);
	expect(gzTimeLabel(null)).toBe('真太阳时');
});
