// 档案修改提案 × 私人内容:外部客户端(origin=mcp)且「私人内容可读」关着(缺省)时,提议改备注的回包 diff 与通知正文
// 只给「已修改 / 字数」,不回显备注原文(无论旧的还是新的);「与现值相同 → 无需修改」这条判定也不再对外暴露(否则可借它探出原文)。
// 开着私人内容可读、或页面内的助手:照旧给原文 diff。提案本身(任务中心给用户看的)始终存全文,采纳照常落库。
jest.mock('../aiAgent/tasks/noticeStore', ()=>{
	const actual = jest.requireActual('../aiAgent/tasks/noticeStore');
	return { __esModule: true, ...actual, pushNotice: jest.fn(async (n)=>n) };
});
import { registerBuiltinTools } from '../aiTools';
import { runTool, __resetToolsForTests } from '../aiTools/registry';
import { registerWorkspaceBridge, __resetWorkspaceBridgeForTests } from '../aiTools/workspaceBridge';
import { __resetLedgerForTests } from '../aiTools/ledger';
import { setAgentEnabled, setAgentApprovalMode, setPrivateReadEnabled, isPrivateReadEnabled } from '../aiAgent/prefs';
import { getProposal, acceptProposal } from '../aiAgent/proposals';
import { getLocalChart } from '../localcharts';
import { pushNotice } from '../aiAgent/tasks/noticeStore';

const SECRET = '私密:去年确诊某病,勿外传';
const NEW_MEMO = '新的备注:换工作意向';
const mcp = ()=>({ origin: 'mcp', requestId: 'priv:0:c1', clientName: 'codex', dispatch: jest.fn() });
const inApp = ()=>({ origin: 'in-app', requestId: 'priv:0:c2', dispatch: jest.fn() });
async function mkChart(name, memo){
	const r = await runTool('create_chart_record', { name, birth: '1990-01-01 08:00', gender: 'male', place: '北京', memo, selectAsAnalysisSource: false }, inApp());
	expect(r.ok).toBe(true);
	return r.data.cid;
}
const lastNoticeBody = ()=>{ const c = pushNotice.mock.calls; return c.length ? `${c[c.length - 1][0].title}\n${c[c.length - 1][0].body}` : ''; };

beforeEach(()=>{
	window.localStorage.clear(); __resetToolsForTests(); __resetLedgerForTests(); __resetWorkspaceBridgeForTests();
	registerWorkspaceBridge({ dispatch: jest.fn(), changeCond: jest.fn() });
	registerBuiltinTools();
	setAgentEnabled(true); setAgentApprovalMode('never');
	pushNotice.mockClear();
});
afterEach(()=>{ setPrivateReadEnabled(false); setAgentEnabled(false); });

it('🔴 外部客户端 + 私人内容不可读(缺省):备注 diff 只回「已修改 / 字数」,回包与通知里都没有新旧原文;提案本身存全文、采纳照常落库', async ()=>{
	expect(isPrivateReadEnabled()).toBe(false);
	const cid = await mkChart('隐私甲', SECRET);
	const r = await runTool('propose_record_edit', { recordId: cid, changes: { memo: NEW_MEMO, title: '隐私甲改' } }, mcp());
	expect(r.ok).toBe(true);
	const memoDiff = r.data.diff.find((d)=>d.field === 'memo');
	expect(memoDiff.redacted).toBe(true);
	expect(memoDiff.after).toBe(`已修改(${NEW_MEMO.length} 字)`);
	expect(memoDiff.before).toContain(`${SECRET.length} 字`);
	const out = JSON.stringify(r);
	expect(out).not.toContain(SECRET);
	expect(out).not.toContain('确诊');
	expect(out).not.toContain(NEW_MEMO);
	// 非私人字段照常给原值 → 新值
	expect(r.data.diff.find((d)=>d.field === 'name')).toEqual(expect.objectContaining({ before: '隐私甲', after: '隐私甲改' }));
	expect(pushNotice).toHaveBeenCalledTimes(1);
	const body = lastNoticeBody();
	expect(body).not.toContain(SECRET); expect(body).not.toContain(NEW_MEMO);
	expect(body).toContain('备注 已修改');
	// 任务中心里的提案仍是全文(给用户本人看),采纳落库
	expect(getProposal(r.data.proposalId).changes.memo).toBe(NEW_MEMO);
	expect(getProposal(r.data.proposalId).before.memo).toBe(SECRET);
	expect(acceptProposal(r.data.proposalId).ok).toBe(true);
	expect(getLocalChart(cid).memo).toBe(NEW_MEMO);
});

it('🔴 私人内容不可读时,与现值相同的备注照样挂提案(不回「无需修改」—— 否则外部可逐个猜原文)', async ()=>{
	const cid = await mkChart('隐私乙', SECRET);
	const probe = await runTool('propose_record_edit', { recordId: cid, changes: { memo: SECRET } }, mcp());
	expect(probe.ok).toBe(true);
	expect(probe.data.status).toBe('pending');
	expect(probe.data.fields).toEqual(['memo']);
	expect(JSON.stringify(probe)).not.toContain(SECRET);
	const wrong = await runTool('propose_record_edit', { recordId: cid, changes: { memo: '瞎猜的' } }, mcp());
	expect(wrong.data.status).toBe(probe.data.status);   // 猜中与猜错对外同形
});

it('私人内容可读开着 / 页面内的助手:diff 照旧给原文;相同内容照旧回「无需修改」', async ()=>{
	const cid = await mkChart('隐私丙', SECRET);
	const local = await runTool('propose_record_edit', { recordId: cid, changes: { memo: NEW_MEMO } }, inApp());
	expect(local.data.diff[0]).toEqual(expect.objectContaining({ field: 'memo', before: SECRET, after: NEW_MEMO }));
	expect(local.data.diff[0].redacted).toBeUndefined();
	setPrivateReadEnabled(true);
	const cid2 = await mkChart('隐私丁', SECRET);
	const open = await runTool('propose_record_edit', { recordId: cid2, changes: { memo: NEW_MEMO } }, mcp());
	expect(open.data.diff[0]).toEqual(expect.objectContaining({ before: SECRET, after: NEW_MEMO }));
	expect(lastNoticeBody()).toContain(NEW_MEMO);
	const same = await runTool('propose_record_edit', { recordId: cid2, changes: { memo: SECRET } }, mcp());
	expect(same.data.status).toBe('unchanged');
});
