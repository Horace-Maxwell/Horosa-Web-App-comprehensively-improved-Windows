// 六爻「定年界线=正月初一」联机路径:后端 /nongli/time 不产 yearGZByLunar 时,桥按本地历法补键(与离线回落同源);
// 后端已带该键则一字不动;补键只加不改其余字段。
import request from '../request';
import { fetchPreciseNongli } from '../preciseCalcBridge';
import { buildLocalBaziResult } from '../baziLunarLocal';

jest.mock('../request', ()=>jest.fn());

const params = { date: '2026-01-25', time: '10:00', zone: '+08:00', lon: '116e24', lat: '39n54', ad: 1, gender: 1 };

describe('联机 nongli 补 yearGZByLunar', ()=>{
	beforeEach(()=>{ request.mockReset(); window.localStorage.clear(); });

	test('后端缺键 → 按本地历法补上(2026-01-25 尚未过正月初一 → 乙巳年);其余字段不动', async()=>{
		request.mockResolvedValue({ Result: { year: '丙午', yearGanZi: '丙午', monthInt: 12, dayInt: 7, dayGanZi: '甲子' } });
		const r = await fetchPreciseNongli({ ...params, date: '2026-01-25' });
		const local = buildLocalBaziResult({ ...params, date: '2026-01-25' });
		expect(local.bazi.nongli.yearGZByLunar).toBe('乙巳');
		expect(r.yearGZByLunar).toBe('乙巳');
		expect(r.yearGanZi).toBe('丙午');
		expect(r.dayGanZi).toBe('甲子');
	});

	test('后端已带键 → 原样保留', async()=>{
		request.mockResolvedValue({ Result: { year: '丙午', yearGZByLunar: '测试值', monthInt: 12, dayInt: 7 } });
		const r = await fetchPreciseNongli({ ...params, date: '2026-01-26' });
		expect(r.yearGZByLunar).toBe('测试值');
	});
});
