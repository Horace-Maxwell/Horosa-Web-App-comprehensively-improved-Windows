// 外部客户端确认与档案提案合同:外部客户端「界面类也要确认」(外部策略 uiConfirm,缺省关;进阶页开关 data-external-ui-confirm-switch)——
// 开 → 界面类动作(ui 类别)先挂本机审批台 mcp:<client>,允许才执行、不允许 E_USER_SKIPPED 且说清是界面操作;关 → 照旧直接执行;只读工具不受影响。
import { handleAgentToolRequest, __resetMcpBridgeForTests } from '../aiAgent/mcpBridge';
import * as prefs from '../aiAgent/prefs';
import * as approvals from '../aiAgent/approvals';
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import fs from 'fs';
import path from 'path';
import { registerBuiltinTools } from '../aiTools';
import { runTool, __resetToolsForTests } from '../aiTools/registry';
import { registerWorkspaceBridge, __resetWorkspaceBridgeForTests } from '../aiTools/workspaceBridge';
import { __resetLedgerForTests } from '../aiTools/ledger';
import { getLocalChart, upsertLocalChart, listLocalCharts } from '../localcharts';
import { listProposals, getProposal, acceptProposal, rejectProposal, revertProposal, addProposal, PROPOSALS_PENDING_MAX, PROPOSALS_MAX, PROPOSALS_KEY } from '../aiAgent/proposals';
import TaskCenterPanel from '../../components/aianalysis/TaskCenterPanel';

const flush = ()=>new Promise((r)=>setTimeout(r, 0));
const MAN = [{ name: 'navigate_to_technique', level: 'read', category: 'ui' }, { name: 'list_records', level: 'read', category: 'query' }, { name: 'create_chart_record', level: 'additive', category: 'records' }];
const codeOf = (r)=>{ try{ return JSON.parse(r.result.content[0].text).code; }catch(e){ return null; } };

beforeEach(()=>{
	window.localStorage.clear();
	__resetMcpBridgeForTests();
	prefs.setAgentEnabled(true);
});
afterEach(()=>{ prefs.setAgentEnabled(false); });

describe('外部策略「界面类也要确认」', ()=>{
	it('🔴 缺省关:策略带 uiConfirm:false;界面类动作直接执行、不上审批台', async ()=>{
		expect(prefs.getExternalPolicy().uiConfirm).toBe(false);
		expect(prefs.DEFAULT_EXTERNAL_POLICY.uiConfirm).toBe(false);
		const runTool = jest.fn(async ()=>({ ok: true, data: { changed: true } }));
		const r = await handleAgentToolRequest({ id: 1, method: 'tools/call', params: { name: 'navigate_to_technique', arguments: { technique: 'bazi' } }, clientName: 'codex' }, { exportToolManifest: ()=>MAN, runTool });
		expect(r.result.isError).toBe(false);
		expect(runTool).toHaveBeenCalledTimes(1);
		expect(approvals.listPendingApprovals('mcp:codex').length).toBe(0);
	});
	it('🔴 开:界面类动作挂审批台;允许 → 执行;不允许 → E_USER_SKIPPED(界面操作);只读工具不受影响;落键 horosa.ai.agent.external.policy.v1', async ()=>{
		prefs.setExternalPolicy({ uiConfirm: true });
		expect(JSON.parse(window.localStorage.getItem('horosa.ai.agent.external.policy.v1')).uiConfirm).toBe(true);
		const runTool = jest.fn(async ()=>({ ok: true, data: { changed: true } }));
		const p = handleAgentToolRequest({ id: 2, method: 'tools/call', params: { name: 'navigate_to_technique', arguments: { technique: 'bazi' } }, clientName: 'codex' }, { exportToolManifest: ()=>MAN, runTool });
		for(let i = 0; i < 50 && approvals.listPendingApprovals('mcp:codex').length === 0; i++){ await flush(); }   // eslint-disable-line no-await-in-loop
		expect(approvals.listPendingApprovals('mcp:codex').map((x)=>x.callId)).toEqual(['mcp-2']);
		approvals.resolveApproval('mcp-2', true);
		expect((await p).result.isError).toBe(false);
		expect(runTool).toHaveBeenCalledTimes(1);
		const p2 = handleAgentToolRequest({ id: 3, method: 'tools/call', params: { name: 'navigate_to_technique', arguments: { technique: 'ziwei' } }, clientName: 'codex' }, { exportToolManifest: ()=>MAN, runTool });
		for(let i = 0; i < 50 && approvals.listPendingApprovals('mcp:codex').length === 0; i++){ await flush(); }   // eslint-disable-line no-await-in-loop
		approvals.resolveApproval('mcp-3', false);
		const r2 = await p2;
		expect(codeOf(r2)).toBe('E_USER_SKIPPED');
		expect(JSON.parse(r2.result.content[0].text).message).toContain('界面操作');
		expect(runTool).toHaveBeenCalledTimes(1);
		const r3 = await handleAgentToolRequest({ id: 4, method: 'tools/call', params: { name: 'list_records', arguments: {} }, clientName: 'codex' }, { exportToolManifest: ()=>MAN, runTool });
		expect(r3.result.isError).toBe(false);
		expect(runTool).toHaveBeenCalledTimes(2);
	});
	it('坏值归一:非 true 一律当关;清空策略回缺省关', ()=>{
		prefs.setExternalPolicy({ uiConfirm: 'yes' });
		expect(prefs.getExternalPolicy().uiConfirm).toBe(false);
		prefs.setExternalPolicy({ uiConfirm: true });
		prefs.clearExternalPolicy();
		expect(prefs.getExternalPolicy().uiConfirm).toBe(false);
	});
});

// ── 档案提案(提议修改 / 提议归档 / 查提案;采纳 / 拒绝 / 撤销采纳只在任务中心)

const tctx = ()=>({ origin: 'mcp', requestId: 'turnX:0:c1', clientName: 'codex', dispatch: jest.fn() });
async function mkChart(name){
	const r = await runTool('create_chart_record', { name, birth: '1990-01-01 08:00', gender: 'male', place: '北京', selectAsAnalysisSource: false }, { ...tctx(), origin: 'in-app' });
	expect(r.ok).toBe(true);
	return r.data.cid;
}

describe('档案提案', ()=>{
	beforeEach(()=>{
		__resetToolsForTests(); __resetLedgerForTests(); __resetWorkspaceBridgeForTests();
		registerWorkspaceBridge({ dispatch: jest.fn(), changeCond: jest.fn() });
		registerBuiltinTools();
		prefs.setAgentApprovalMode('never');
	});

	it('🔴 提议修改:规整成档案字段(姓名 / 出生时间 / 地点 → 经纬与地名)、只留有变化的字段、档案在采纳前纹丝不动;一样的内容不产生提案', async ()=>{
		const cid = await mkChart('提案甲');
		const before = JSON.stringify(getLocalChart(cid));
		const r = await runTool('propose_record_edit', { recordId: cid, changes: { title: '提案甲改', time: '1990-01-01 09:30', place: '上海', gender: 'male' }, reason: '用户说出生时间记错了' }, tctx());
		expect(r.ok).toBe(true);
		expect(r.data.status).toBe('pending');
		expect(r.data.fields).toEqual(expect.arrayContaining(['name', 'birth', 'pos', 'gpsLat', 'gpsLon']));
		expect(r.data.fields).not.toContain('gender');   // 性别没变 → 不进提案
		expect(JSON.stringify(getLocalChart(cid))).toBe(before);
		const p = getProposal(r.data.proposalId);
		expect(p.changes.name).toBe('提案甲改'); expect(p.changes.birth.indexOf('1990-01-01 09:30')).toBe(0); expect(p.changes.pos).toContain('上海');
		expect(p.before.name).toBe('提案甲'); expect(p.client).toBe('codex');
		const none = await runTool('propose_record_edit', { recordId: cid, changes: { title: '提案甲' } }, tctx());
		expect(none.data.status).toBe('unchanged'); expect(none.data.proposalId).toBe(null);
		const ls = await runTool('list_proposals', { status: 'pending' }, tctx());
		expect(ls.data.items.map((x)=>x.proposalId)).toEqual([r.data.proposalId]);
		expect(ls.data.pending).toBe(1);
		expect((await runTool('propose_record_edit', { recordId: 'local-none', changes: { title: 'x' } }, tctx())).code).toBe('E_RECORD_NOT_FOUND');
	});

	it('🔴 采纳 → 落库(留历史)→ 撤销采纳回原值;采纳后用户又改过 → 拒撤;拒绝不动档案;已处理的再处理 → E_PROPOSAL_NOT_PENDING', async ()=>{
		const cid = await mkChart('提案乙');
		const r = await runTool('propose_record_edit', { recordId: cid, changes: { title: '提案乙改', memo: '记一笔' } }, tctx());
		expect(acceptProposal(r.data.proposalId).ok).toBe(true);
		expect(getLocalChart(cid).name).toBe('提案乙改'); expect(getLocalChart(cid).memo).toBe('记一笔');
		expect(getProposal(r.data.proposalId).status).toBe('accepted');
		expect(acceptProposal(r.data.proposalId).code).toBe('E_PROPOSAL_NOT_PENDING');
		expect(revertProposal(r.data.proposalId).ok).toBe(true);
		expect(getLocalChart(cid).name).toBe('提案乙');
		expect(getProposal(r.data.proposalId).status).toBe('reverted');
		const r2 = await runTool('propose_record_edit', { recordId: cid, changes: { title: '提案乙二' } }, tctx());
		acceptProposal(r2.data.proposalId);
		upsertLocalChart({ cid, name: '用户自己改的' });
		const u = revertProposal(r2.data.proposalId);
		expect(u.ok).toBe(false); expect(u.code).toBe('E_UNDO_RECORD_CHANGED');
		expect(getLocalChart(cid).name).toBe('用户自己改的');
		const r3 = await runTool('propose_record_edit', { recordId: cid, changes: { title: '不该落库' } }, tctx());
		expect(rejectProposal(r3.data.proposalId).ok).toBe(true);
		expect(getLocalChart(cid).name).toBe('用户自己改的');
		expect(getProposal(r3.data.proposalId).status).toBe('rejected');
	});

	it('🔴 冲突:提案后档案被改过 → 采纳判冲突、不落库、标出冲突字段', async ()=>{
		const cid = await mkChart('提案丙');
		const r = await runTool('propose_record_edit', { recordId: cid, changes: { title: '提案丙改' } }, tctx());
		upsertLocalChart({ cid, name: '中途被改' });
		const a = acceptProposal(r.data.proposalId);
		expect(a.ok).toBe(false); expect(a.code).toBe('E_PROPOSAL_CONFLICT'); expect(a.fields).toEqual(['name']);
		expect(getLocalChart(cid).name).toBe('中途被改');
		const p = getProposal(r.data.proposalId);
		expect(p.status).toBe('conflict'); expect(p.conflictFields).toEqual(['name']);
	});

	it('🔴 提议归档:采纳后默认列表收起(不是删除),撤销采纳回到列表;已归档的再提议 → 不产生提案', async ()=>{
		const cid = await mkChart('提案丁');
		const r = await runTool('propose_record_archive', { recordId: cid, reason: '用户说这张不常用' }, tctx());
		expect(r.data.status).toBe('pending');
		expect(getLocalChart(cid).archived).toBeFalsy();
		expect(acceptProposal(r.data.proposalId).ok).toBe(true);
		expect(getLocalChart(cid).archived).toBe(true);
		expect(listLocalCharts({}).some((x)=>x.cid === cid)).toBe(false);
		expect(listLocalCharts({ includeArchived: true }).some((x)=>x.cid === cid)).toBe(true);
		const again = await runTool('propose_record_archive', { recordId: cid }, tctx());
		expect(again.data.status).toBe('unchanged');
		expect(revertProposal(r.data.proposalId).ok).toBe(true);
		expect(getLocalChart(cid).archived).toBeFalsy();
	});

	it('🔴 上限:待决满 50 → E_PROPOSAL_LIMIT;总数封顶只挤掉最旧的已决、待决永不挤掉;只认白名单字段', ()=>{
		for(let i = 0; i < PROPOSALS_PENDING_MAX; i++){ expect(addProposal({ kind: 'record-edit', store: 'chart', recordId: `local-p${i}`, changes: { name: `n${i}` }, before: { name: 'o' } }).ok).toBe(true); }
		expect(addProposal({ kind: 'record-edit', store: 'chart', recordId: 'local-px', changes: { name: 'x' }, before: {} }).code).toBe('E_PROPOSAL_LIMIT');
		const all = JSON.parse(window.localStorage.getItem(PROPOSALS_KEY));
		const decided = Array.from({ length: PROPOSALS_MAX }, (_, i)=>({ id: `prop-old-${i}`, kind: 'record-edit', store: 'chart', recordId: `local-o${i}`, changes: { name: 'a' }, before: { name: 'b' }, status: 'rejected', createdAt: `2026-01-01T00:00:${String(i % 60).padStart(2, '0')}.000Z`, decidedAt: `2026-01-02T00:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}.000Z` }));
		window.localStorage.setItem(PROPOSALS_KEY, JSON.stringify(all.concat(decided)));
		rejectProposal(all[0].id);
		const kept = listProposals();
		expect(kept.length).toBe(PROPOSALS_MAX);
		expect(kept.filter((p)=>p.status === 'pending').length).toBe(PROPOSALS_PENDING_MAX - 1);
		expect(addProposal({ kind: 'record-edit', store: 'chart', recordId: 'local-w', changes: { cid: 'evil', deletedAt: 'x' }, before: {} }).code).toBe('E_ARGS_INVALID');
	});

	it('🔴 静态守卫:工具目录零 import 采纳 / 拒绝 / 撤销采纳(落库只由用户在任务中心触发)', ()=>{
		const dir = path.resolve(__dirname, '..', 'aiTools');
		const walk = (d)=>fs.readdirSync(d).reduce((acc, n)=>{ const f = path.join(d, n); return fs.statSync(f).isDirectory() ? acc.concat(walk(f)) : (n.endsWith('.js') ? acc.concat([f]) : acc); }, []);
		const bad = walk(dir).filter((f)=>/\b(acceptProposal|rejectProposal|revertProposal)\b/.test(fs.readFileSync(f, 'utf8')));
		expect(bad.map((f)=>path.relative(dir, f))).toEqual([]);
	});

	it('任务中心:待办里出提案卡片(原值 → 新值),点采纳即落库,下方「最近处理」出撤销采纳', async ()=>{
		const cid = await mkChart('提案戊');
		await runTool('propose_record_edit', { recordId: cid, changes: { title: '提案戊改' }, reason: '改名' }, tctx());
		const host = document.createElement('div'); document.body.appendChild(host);
		try{
			await act(async ()=>{ ReactDOM.render(<TaskCenterPanel open onClose={()=>{}} />, host); await flush(); });
			const card = document.querySelector('[data-todo="proposal"]');
			expect(card.textContent).toContain('提案戊'); expect(card.textContent).toContain('提案戊改'); expect(card.textContent).toContain('改名');
			await act(async ()=>{ document.querySelector('[data-proposal-accept="1"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); await flush(); });
			expect(getLocalChart(cid).name).toBe('提案戊改');
			expect(document.querySelector('[data-proposal-row="accepted"]')).not.toBe(null);
			expect(document.querySelector('[data-proposal-revert="1"]')).not.toBe(null);
		}finally{
			act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove();
		}
	});
});
