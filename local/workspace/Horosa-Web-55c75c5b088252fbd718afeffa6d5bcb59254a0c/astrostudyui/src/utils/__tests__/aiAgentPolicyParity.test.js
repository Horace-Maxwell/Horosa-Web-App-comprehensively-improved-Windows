// [进阶复查 D13·2026-09-08] 策略双路径同源:对话路径(createAgentTurn)与本机 MCP 桥(handleAgentToolRequest)对「按工具名禁用」同拒同不列;
// 桥审批超时零残留(与目标/定时路径的 approvals 超时同款);目录外名字桥侧拒于 runTool 之前。
import { createAgentTurn } from '../aiAgent/runtime';
import { handleAgentToolRequest, __resetMcpBridgeForTests } from '../aiAgent/mcpBridge';
import { registerBuiltinTools } from '../aiTools';
import { exportToolManifest, runTool, __resetToolsForTests } from '../aiTools/registry';
import { setAgentEnabled, setToolPolicy, setExternalPolicy } from '../aiAgent/prefs';
import * as approvals from '../aiAgent/approvals';

const codeOf = (r)=>JSON.parse(r.result.content[0].text).code;
const flush = ()=>new Promise((r)=>setTimeout(r, 0));
beforeEach(()=>{ window.localStorage.clear(); __resetToolsForTests(); __resetMcpBridgeForTests(); approvals.__resetApprovalsForTests(); registerBuiltinTools(); setAgentEnabled(true); });

it('🔴 deny 双路径:对话目录与 tools/list 都不含;tools/call 回 E_APPROVAL_DENIED 且零执行', async ()=>{
	setToolPolicy({ deny: ['create_chart_record'] });
	const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm' });
	expect(agent.toolDefs().map((t)=>t.name)).not.toContain('create_chart_record');
	expect(agent.toolDefs().map((t)=>t.name)).toContain('list_records');
	const deps = { exportToolManifest, runTool: jest.fn(async ()=>({ ok: true })) };
	const list = await handleAgentToolRequest({ id: 1, method: 'tools/list' }, deps);
	expect(list.result.tools.map((t)=>t.name)).not.toContain('create_chart_record');
	expect(list.result.tools.map((t)=>t.name)).toContain('list_records');
	const call = await handleAgentToolRequest({ id: 2, method: 'tools/call', params: { name: 'create_chart_record', arguments: { name: 'x' } }, clientName: 'c' }, deps);
	expect(codeOf(call)).toBe('E_APPROVAL_DENIED');
	expect(deps.runTool).not.toHaveBeenCalled();
});

it('🔴 目录外名字:桥侧 E_TOOL_NOT_FOUND 于 runTool 之前(真注册表:ext_* / 未启用工具 / 乱名 三形态)', async ()=>{
	const deps = { exportToolManifest, runTool: jest.fn(runTool) };
	for(const name of ['ext_nothing', 'web_search', 'delete_everything']){
		const r = await handleAgentToolRequest({ id: 3, method: 'tools/call', params: { name, arguments: {} }, clientName: 'c' }, deps);
		expect(`${name}:${codeOf(r)}`).toBe(`${name}:E_TOOL_NOT_FOUND`);
	}
	expect(deps.runTool).not.toHaveBeenCalled();
});

it('🔴 桥 on-request 审批超时 → E_TOOL_TIMEOUT 且审批台零残留', async ()=>{
	setExternalPolicy({ approval: 'on-request' });
	const deps = { exportToolManifest, runTool: jest.fn(async ()=>({ ok: true })) };
	const p = handleAgentToolRequest({ id: 4, method: 'tools/call', params: { name: 'create_chart_record', arguments: { name: 'x' }, _meta: { timeoutMs: 4000 } }, clientName: 'codex' }, deps);
	for(let i = 0; i < 50 && approvals.listPendingApprovals('mcp:codex').length === 0; i++){ await flush(); }
	expect(approvals.listPendingApprovals('mcp:codex').length).toBe(1);
	const r = await p;
	expect(codeOf(r)).toBe('E_TOOL_TIMEOUT');
	expect(approvals.listPendingApprovals('mcp:codex').length).toBe(0);
	expect(deps.runTool).not.toHaveBeenCalled();
});
