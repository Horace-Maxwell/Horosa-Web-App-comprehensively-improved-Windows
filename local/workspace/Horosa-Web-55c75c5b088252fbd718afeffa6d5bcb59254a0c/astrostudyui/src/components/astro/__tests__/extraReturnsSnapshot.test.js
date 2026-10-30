// 多重回归 AI 快照:三个人生周期体(土 / 木 / 月交);未找到的回如实写「范围内未找到」不编日期;
// 月交注明本盘的平 / 真交点(与盘面所画同一个点,后端按本盘设置算)。
jest.mock('../../../utils/request', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../../utils/moduleAiSnapshot', () => ({ __esModule: true, saveModuleAISnapshot: jest.fn() }));

import request from '../../../utils/request';
import { buildExtraReturnsSnapshotText } from '../AstroExtraReturns';

const chart = (extra)=>({ params: { birth: '1990-01-01 07:12:00', zone: '+00:00', lat: '40n43', lon: '74w00', ...(extra || {}) }, chart: {} });

describe('多重回归 AI 快照', ()=>{
	beforeEach(()=>{ request.mockReset(); });

	test('只请求土 / 木 / 月交三体;未找到的回不编日期', async ()=>{
		const bodies = [];
		request.mockImplementation((url, opt)=>{
			const b = JSON.parse(opt.body).body;
			bodies.push(b);
			return Promise.resolve({ Result: { natalLon: 285.6, body: b, returns: [
				{ which: 1, found: true, date: '2019-02-12', time: '10:00:00', passes: [{ pass: 1, date: '2019-02-12', time: '10:00:00', retrograde: false }] },
				{ which: 2, found: false },
			] } });
		});
		const txt = await buildExtraReturnsSnapshotText(chart());
		expect(bodies.sort()).toEqual(['Jupiter', 'Node', 'Saturn']);
		expect(txt).toContain('第2回 范围内未找到');
		expect(txt).not.toContain('undefined');
		expect(txt).toContain('月交返照（平交点）');
	});

	test('本盘设真交点 → 快照标真交点', async ()=>{
		request.mockImplementation(()=>Promise.resolve({ Result: { natalLon: 316.9, returns: [
			{ which: 1, found: true, date: '2008-10-21', time: '11:00:00', passes: [{ pass: 1, date: '2008-10-21', time: '11:00:00' }] },
		] } }));
		const txt = await buildExtraReturnsSnapshotText(chart({ westNodeType: 'true' }));
		expect(txt).toContain('月交返照（真交点）');
	});
});
