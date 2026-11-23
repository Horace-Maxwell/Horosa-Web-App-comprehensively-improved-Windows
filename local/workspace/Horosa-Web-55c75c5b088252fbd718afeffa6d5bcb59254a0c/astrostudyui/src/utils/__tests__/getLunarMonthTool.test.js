// get_lunar_month 与农历页同一请求(/calendar/month,该月 1 日 / ad=1 / zone / lon)与同一正文构建;只回该月的日子;后端不通如实报。
jest.mock('../request', ()=>({ __esModule: true, default: jest.fn() }));
import request from '../request';
import { registerBuiltinTools } from '../aiTools';
import { runTool, __resetToolsForTests } from '../aiTools/registry';
import { setAgentEnabled } from '../aiAgent/prefs';
import * as Constants from '../constants';

const ctx = { origin: 'mcp', requestId: 'lm' };
beforeEach(()=>{ window.localStorage.clear(); __resetToolsForTests(); setAgentEnabled(true); registerBuiltinTools(); request.mockReset(); });
afterEach(()=>setAgentEnabled(false));

const day = (birth, extra)=>({ birth, day: '初一', dayInt: 1, month: '十月', ...extra });
test('请求形状与页面同;正文含当月月历表,下月补位不计', async ()=>{
	request.mockResolvedValue({ [Constants.ResultKey]: { days: [day('2026-11-20 00:00:00', { ganzi: '甲子' }), day('2026-11-21 00:00:00', { day: '初二', dayInt: 2 }), day('2026-12-01 00:00:00')], prevDays: [] } });
	const r = await runTool('get_lunar_month', { month: '2026-11' }, ctx);
	expect(r.ok).toBe(true);
	const [url, opt] = request.mock.calls[0];
	expect(url).toMatch(/\/calendar\/month$/);
	expect(JSON.parse(opt.body)).toEqual({ date: '2026-11-01', ad: 1, zone: '+08:00', lon: '120e00' });
	expect(r.data.content).toContain('[当月月历]');
	expect(r.data.content).toContain('查询月份：2026-11');
	expect(r.data.days).toBe(2);
});

test('后端不通 → 可重试错误;月份写法不对 → schema 拒', async ()=>{
	request.mockResolvedValue(undefined);
	const r = await runTool('get_lunar_month', { month: '2026-11' }, ctx);
	expect([r.ok, r.code, r.retryable]).toEqual([false, 'E_CAST_BACKEND_FAILED', true]);
	expect((await runTool('get_lunar_month', { month: '2026/11' }, ctx)).ok).toBe(false);
	// 月份出界(13 月 / 00 月)是参数错,不是「计算服务不在线、可重试」
	request.mockClear();
	for(const m of ['2026-13', '2026-00', '2026-99']){
		const bad = await runTool('get_lunar_month', { month: m }, ctx);
		expect([m, bad.ok, bad.code]).toEqual([m, false, 'E_ARGS_INVALID']);
	}
	expect(request).not.toHaveBeenCalled();
});
