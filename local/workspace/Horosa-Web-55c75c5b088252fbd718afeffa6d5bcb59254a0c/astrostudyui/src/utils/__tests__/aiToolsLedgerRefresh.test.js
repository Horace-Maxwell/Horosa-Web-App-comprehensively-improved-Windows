// [批五] 四断链之④:撤销建档后「刷新 AI 分析页源列表」此前不可达(读 bridge.ui 恒空;另有一条 b.refreshSources 死分支)。
// 行为锁:登记 refreshSources 后撤销 → dispatch(fetchCharts) 与 refreshSources 各恰一次;不登记仍撤销成功不抛。
import { registerBuiltinTools } from '../aiTools';
import { runTool, __resetToolsForTests } from '../aiTools/registry';
import { registerWorkspaceBridge, registerWorkspaceUi, __resetWorkspaceBridgeForTests } from '../aiTools/workspaceBridge';
import { undoAction, __resetLedgerForTests } from '../aiTools/ledger';
import { listLocalCharts } from '../localcharts';

let dispatch;
beforeEach(()=>{ window.localStorage.clear(); __resetToolsForTests(); __resetLedgerForTests(); __resetWorkspaceBridgeForTests(); dispatch = jest.fn(); registerWorkspaceBridge({ dispatch, changeCond: jest.fn() }); registerBuiltinTools(); });

it('🔴 撤销建档 → 档案列表刷新 + 源列表刷新各一次', async ()=>{
	const refreshSources = jest.fn();
	registerWorkspaceUi({ refreshSources });
	const r = await runTool('create_chart_record', { name: '刷源甲', birth: '1990-01-01 08:00', gender: 'male', place: '北京' }, { origin: 'in-app', requestId: 't1:0:c1', dispatch });
	expect(r.ok).toBe(true);
	expect(listLocalCharts({}).length).toBe(1);
	dispatch.mockClear();
	const u = undoAction(r.undo.actionId);
	expect(u.ok).toBe(true);
	expect(listLocalCharts({}).length).toBe(0);
	expect(dispatch.mock.calls.filter((c)=>c[0] && c[0].type === 'user/fetchCharts').length).toBe(1);
	expect(refreshSources).toHaveBeenCalledTimes(1);
});
it('不登记 ui 面:撤销照样成功、不抛', async ()=>{
	const r = await runTool('create_chart_record', { name: '刷源乙', birth: '1990-01-01 08:00', gender: 'male', place: '北京' }, { origin: 'in-app', requestId: 't1:0:c1', dispatch });
	expect(undoAction(r.undo.actionId).ok).toBe(true);
	expect(listLocalCharts({}).length).toBe(0);
});
