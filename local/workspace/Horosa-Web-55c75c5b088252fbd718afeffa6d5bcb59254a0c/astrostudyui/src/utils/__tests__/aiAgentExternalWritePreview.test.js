// 外部客户端的写入:① 「每次确认」档下审批卡带写前预览(与对话路径同一个 buildApprovalPreview);
// ② 建出来的档案记下来源与客户端名(aiOrigin.origin = 'mcp'、aiOrigin.client = 握手自报的客户端名);应用内建档不带 client。
import fs from 'fs';
import path from 'path';
import { registerBuiltinTools } from '../aiTools';
import { runTool, __resetToolsForTests } from '../aiTools/registry';
import * as registry from '../aiTools/registry';
import { registerWorkspaceBridge, __resetWorkspaceBridgeForTests } from '../aiTools/workspaceBridge';
import { __resetLedgerForTests } from '../aiTools/ledger';
import { setAgentEnabled, setExternalPolicy } from '../aiAgent/prefs';
import { listPendingApprovals, resolveApproval, buildApprovalPreview, __resetApprovalsForTests } from '../aiAgent/approvals';
import { handleAgentToolRequest } from '../aiAgent/mcpBridge';
import { getLocalChart } from '../localcharts';

const chartArgs = (name)=>({ name, birth: '1990-01-01 08:00', gender: 'male', place: '北京', selectAsAnalysisSource: false });
const flush = ()=>new Promise((r)=>setTimeout(r, 0));

beforeEach(()=>{
	window.localStorage.clear(); __resetToolsForTests(); __resetLedgerForTests(); __resetWorkspaceBridgeForTests(); __resetApprovalsForTests();
	registerWorkspaceBridge({ dispatch: jest.fn(), changeCond: jest.fn() });
	registerBuiltinTools();
	setAgentEnabled(true);
});

it('🔴 「每次确认」档:外部写入的待审条目带写前预览,允许后才写', async ()=>{
	const made = await runTool('create_chart_record', chartArgs('预览甲'), { origin: 'in-app', dispatch: jest.fn() });
	setExternalPolicy({ approval: 'on-request' });
	const p = handleAgentToolRequest({ id: 7, method: 'tools/call', clientName: 'probe', params: { name: 'append_record_journal', arguments: { recordId: made.data.cid, text: '应验了' } } }, registry);
	let pend = [];
	for(let i = 0; i < 50 && !pend.length; i++){ await flush(); pend = listPendingApprovals('mcp:probe'); }   // eslint-disable-line no-await-in-loop
	expect(pend.length).toBe(1);
	expect(pend[0].preview).toBeTruthy();
	expect(pend[0].preview.title).toContain('预览甲');
	expect(pend[0].preview.after).toContain('应验了');
	resolveApproval(pend[0].callId, true, 'mcp:probe');
	const r = await p;
	expect(r.result.isError).toBe(false);
	expect(getLocalChart(made.data.cid).journal[0].text).toBe('应验了');
});

it('buildApprovalPreview:没有 preview / 抛错 → null;各段截断', async ()=>{
	expect(await buildApprovalPreview(null, {})).toBe(null);
	expect(await buildApprovalPreview({ preview(){ throw new Error('x'); } }, {})).toBe(null);
	const p = await buildApprovalPreview({ preview: ()=>({ title: 't'.repeat(500), before: 'b', after: 'a'.repeat(30000) }) }, {});
	expect(p.title.length).toBe(120); expect(p.after.length).toBe(20000);
});

it('🔴 对话路径与外部桥共用同一个预览函数(运行时不再另抄一份)', ()=>{
	const src = fs.readFileSync(path.join(__dirname, '..', 'aiAgent', 'runtime.js'), 'utf8');
	expect(src).toContain('await buildApprovalPreview(def0, call.args');
	expect(src).not.toMatch(/def0\.preview\(/);
	const bridge = fs.readFileSync(path.join(__dirname, '..', 'aiAgent', 'mcpBridge.js'), 'utf8');
	expect(bridge).toContain('await buildApprovalPreview(previewDef, args');
});

it('🔴 外部客户端建的档案记来源与客户端名;应用内建的不带 client', async ()=>{
	const ext = await runTool('create_chart_record', chartArgs('来源甲'), { origin: 'mcp', clientName: 'probe-client', requestId: 'r1', dispatch: jest.fn() });
	expect(getLocalChart(ext.data.cid).aiOrigin).toMatchObject({ origin: 'mcp', client: 'probe-client', tool: 'create_chart_record' });
	const own = await runTool('create_chart_record', chartArgs('来源乙'), { origin: 'in-app', clientName: 'ignored', dispatch: jest.fn() });
	expect(getLocalChart(own.data.cid).aiOrigin.origin).toBe('in-app');
	expect(getLocalChart(own.data.cid).aiOrigin.client).toBeUndefined();
});
