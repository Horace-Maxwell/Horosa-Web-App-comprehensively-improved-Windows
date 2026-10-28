// AI 无头重算的起课时间算法与页面同口径:奇门 / 六爻事盘按存的时间算法取农历(齿轮 → 记录顶层 → fieldSnapshot → 0);
// 日界 / 晚子时同样补读 fieldSnapshot;奇门直接时间档另取一次真太阳时只作显示。
import * as bridge from '../preciseCalcBridge';
import { regenerateCaseTechniqueSnapshot } from '../aiAnalysisContext';

const NL = { birth: '2026-05-05 11:10:00', time: '庚午', dayGanZi: '甲子', monthGanZi: '癸巳', yearGanZi: '丙午', jieqi: '立夏', yearJieqi: [], ganzhi: {} };
const CASE = { cid: 'local-1-k', event: '问事', divTime: '2026-05-05 11:10:00', zone: '+08:00', lon: '104e04', lat: '30n40', gpsLon: 104.06, gpsLat: 30.67, gender: 1 };

describe('无头重算时间算法', ()=>{
	let calls;
	let spy;
	beforeEach(()=>{
		calls = [];
		spy = jest.spyOn(bridge, 'fetchPreciseNongli').mockImplementation(async (p)=>{ calls.push(p); return { ...NL }; });
	});
	afterEach(()=>{ spy.mockRestore(); });
	test('奇门:记录存直接时间 → 取农历带 timeAlg 1,并另取一次真太阳时显示', async ()=>{
		await regenerateCaseTechniqueSnapshot({ ...CASE, timeAlg: 1 }, 'qimen', { options: {} }).catch(()=>'');
		expect(calls.length).toBeGreaterThanOrEqual(1);
		expect(calls[0].timeAlg).toBe(1);
		expect(calls.some((p)=>p.timeAlg === 0)).toBe(true);
	});
	test('奇门:时间算法只在事盘 payload.fieldSnapshot 里 → 也带上;齿轮显式给的优先', async ()=>{
		await regenerateCaseTechniqueSnapshot({ ...CASE, payload: JSON.stringify({ fieldSnapshot: { timeAlg: 1 } }) }, 'qimen', { options: {} }).catch(()=>'');
		expect(calls[0].timeAlg).toBe(1);
		calls.length = 0;
		await regenerateCaseTechniqueSnapshot({ ...CASE, timeAlg: 1 }, 'qimen', { options: { timeAlg: 0 } }).catch(()=>'');
		expect(calls[0].timeAlg).toBe(0);
	});
	test('六爻时间卦:随事盘时间算法', async ()=>{
		await regenerateCaseTechniqueSnapshot({ ...CASE, timeAlg: 1 }, 'sixyao', {}).catch(()=>'');
		expect(calls[0].timeAlg).toBe(1);
	});
	test('日界 / 晚子时补读 fieldSnapshot(顶层优先)', async ()=>{
		await regenerateCaseTechniqueSnapshot({ ...CASE, payload: JSON.stringify({ fieldSnapshot: { after23NewDay: 0, lateZiHourUseNextDay: 0 } }) }, 'qimen', { options: {} }).catch(()=>'');
		expect(calls[0].after23NewDay).toBe(0);
		expect(calls[0].lateZiHourUseNextDay).toBe(0);
	});
	test('太乙不带时间算法(页面恒按真太阳时取农历)', async ()=>{
		await regenerateCaseTechniqueSnapshot({ ...CASE, timeAlg: 1 }, 'taiyi', { options: {} }).catch(()=>'');
		if(calls.length){ expect(calls[0].timeAlg).toBeUndefined(); }
	});
});
