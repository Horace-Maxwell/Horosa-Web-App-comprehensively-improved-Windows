// [D74] 页面「外部客户端策略·每分钟调用上限」镜像到壳令牌桶:此前壳写死 60/分钟(突发 10),页面可设 1..600 但 >60 全部无效(壳先拒 -32004)。
//   绑桥时同步一次;策略每次改动同步一次;同值不重发;非桌面 / 总开关关 ⇒ 零 invoke;钳位 1..600;壳调用失败 ⇒ 下次改动再试。
//   桩打在 window.__TAURI_INTERNALS__.invoke(桥内部经 aiAnalysisDesktop 的本模块 invoke,不经导出的 invokeDesktopCommand)。
import { bindMcpBridge, __resetMcpBridgeForTests, __lastSyncedCallsPerMinuteForTests } from '../aiAgent/mcpBridge';
import { setAgentEnabled, setExternalPolicy } from '../aiAgent/prefs';
import { desktopMcpServerSetLimits } from '../aiAnalysisDesktop';

const flush = async ()=>{ for(let i = 0; i < 4; i++){ await new Promise((r)=>setTimeout(r, 0)); } };
function installShell(impl){
	const invoke = jest.fn(impl || (async ()=>({})));
	window.__TAURI_INTERNALS__ = { invoke, metadata: { currentWindow: { label: 'main' } } };
	return invoke;
}
const limitCalls = (spy)=>spy.mock.calls.filter((c)=>c[0] === 'mcp_server_set_limits_command').map((c)=>c[1]);

beforeEach(()=>{ window.localStorage.clear(); __resetMcpBridgeForTests(); delete window.__TAURI_INTERNALS__; delete window.__TAURI__; });
afterEach(()=>{ __resetMcpBridgeForTests(); delete window.__TAURI_INTERNALS__; });

it('🔴 绑桥时同步一次(缺省 60);策略改动再同步;同值不重发;无关策略键改动不重发', async ()=>{
	const invoke = installShell();
	setAgentEnabled(true);
	bindMcpBridge();
	await flush();
	expect(limitCalls(invoke)).toEqual([{ callsPerMinute: 60 }]);
	setExternalPolicy({ maxCallsPerMinute: 120 });
	await flush();
	expect(limitCalls(invoke)).toEqual([{ callsPerMinute: 60 }, { callsPerMinute: 120 }]);
	setExternalPolicy({ maxAdditivePerHour: 5 });   // 无关键:不重发
	setExternalPolicy({ maxCallsPerMinute: 120 });  // 同值:不重发
	await flush();
	expect(limitCalls(invoke).length).toBe(2);
	expect(__lastSyncedCallsPerMinuteForTests()).toBe(120);
});

it('🔴 非桌面壳 / 总开关关:零 invoke;桌面包装钳位 1..600', async ()=>{
	setAgentEnabled(true);
	bindMcpBridge();
	setExternalPolicy({ maxCallsPerMinute: 300 });
	await flush();
	expect(__lastSyncedCallsPerMinuteForTests()).toBe(null);   // 无壳:从未同步
	__resetMcpBridgeForTests();
	const invoke = installShell();
	setAgentEnabled(false);
	bindMcpBridge();
	setExternalPolicy({ maxCallsPerMinute: 300 });
	await flush();
	expect(limitCalls(invoke)).toEqual([]);
	// 包装钳位(壳同样钳 1..600)
	await desktopMcpServerSetLimits(99999);
	await desktopMcpServerSetLimits(0);
	await desktopMcpServerSetLimits('abc');
	expect(limitCalls(invoke)).toEqual([{ callsPerMinute: 600 }, { callsPerMinute: 1 }, { callsPerMinute: 60 }]);
});

it('壳 invoke 失败 ⇒ 记忆清空,下次策略改动再试', async ()=>{
	const invoke = installShell(async (cmd)=>{ if(cmd === 'mcp_server_set_limits_command'){ throw new Error('shell down'); } return {}; });
	setAgentEnabled(true);
	bindMcpBridge();
	await flush();
	expect(limitCalls(invoke)).toEqual([{ callsPerMinute: 60 }]);
	expect(__lastSyncedCallsPerMinuteForTests()).toBe(null);
	setExternalPolicy({ maxCallsPerMinute: 60 });   // 同值,但上次失败 ⇒ 允许重发
	await flush();
	expect(limitCalls(invoke).length).toBe(2);
});
