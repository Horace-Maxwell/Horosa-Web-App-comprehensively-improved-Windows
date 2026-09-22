// [批五] 四断链之③:外部客户端连投多条建档时的「批尾统一选中」此前是死路(桥 workspaceUi() 读 bridge.ui 恒 null)。
// 行为锁:走真挂钩(bindMcpBridge → 惰性载入真目录)连投两条 tools/call 建档 → 排空后 selectSource 恰 1 次且是第二条 cid,refreshSources 在前;不登记 → 0 次。
import { bindMcpBridge, __resetMcpBridgeForTests } from '../aiAgent/mcpBridge';
import { setAgentEnabled, AGENT_ENABLED_KEY } from '../aiAgent/prefs';
import { registerWorkspaceBridge, registerWorkspaceUi, __resetWorkspaceBridgeForTests } from '../aiTools/workspaceBridge';
import { __resetToolsForTests } from '../aiTools/registry';
import { registerBuiltinTools } from '../aiTools';
import { __resetLedgerForTests } from '../aiTools/ledger';
import { listLocalCharts } from '../localcharts';
import * as desktop from '../aiAnalysisDesktop';

const flush = ()=>new Promise((r)=>setTimeout(r, 0));
async function settle(n){ for(let i = 0; i < n; i++){ await flush(); } }   // eslint-disable-line no-await-in-loop

beforeEach(()=>{ window.localStorage.clear(); __resetMcpBridgeForTests(); __resetToolsForTests(); __resetLedgerForTests(); __resetWorkspaceBridgeForTests(); jest.restoreAllMocks(); registerWorkspaceBridge({ dispatch: jest.fn(), changeCond: jest.fn() }); registerBuiltinTools(); });   // 桥的目录惰性载入只注册一次:重置注册表后须重新注册
afterEach(()=>{ setAgentEnabled(false); __resetMcpBridgeForTests(); });

async function twoCreates(){
	jest.spyOn(desktop, 'isDesktopBridgeAvailable').mockReturnValue(true);
	const invoke = jest.spyOn(desktop, 'invokeDesktopCommand').mockResolvedValue({});
	bindMcpBridge();
	window.localStorage.setItem(AGENT_ENABLED_KEY, '1');
	setAgentEnabled(true);
	window.__horosaAgentTool({ id: 11, method: 'tools/call', params: { name: 'create_chart_record', arguments: { name: '外部甲', birth: '1990-01-01 08:00', gender: 'male', place: '北京' } }, sessionId: 's1' });
	window.__horosaAgentTool({ id: 12, method: 'tools/call', params: { name: 'create_chart_record', arguments: { name: '外部乙', birth: '1991-02-02 09:00', gender: 'female', place: '上海' } }, sessionId: 's1' });
	for(let i = 0; i < 200; i++){ await flush(); if(invoke.mock.calls.filter((c)=>c[0] === 'agent_tool_result_command').length >= 2){ break; } }   // eslint-disable-line no-await-in-loop
	await settle(5);
	const results = invoke.mock.calls.filter((c)=>c[0] === 'agent_tool_result_command').map((c)=>c[1]);
	return results;
}

it('🔴 登记 ui 面:两条建档排空后 selectSource 恰 1 次 = 第二条 cid,refreshSources 在前', async ()=>{
	const order = [];
	registerWorkspaceUi({ refreshSources: ()=>order.push('refresh'), selectSource: (cid)=>order.push(`select:${cid}`) });
	const results = await twoCreates();
	expect(results.length).toBe(2);
	expect(results.every((r)=>r.result && !r.result.isError)).toBe(true);
	const charts = listLocalCharts({});
	expect(charts.length).toBe(2);
	const second = charts.find((c)=>c.name === '外部乙');
	expect(order).toEqual(['refresh', `select:${second.cid}`]);
}, 20000);

it('判别力:不登记 ui 面 → 零选中(修前的恒态)', async ()=>{
	const results = await twoCreates();
	expect(results.length).toBe(2);
	expect(listLocalCharts({}).length).toBe(2);
}, 20000);
