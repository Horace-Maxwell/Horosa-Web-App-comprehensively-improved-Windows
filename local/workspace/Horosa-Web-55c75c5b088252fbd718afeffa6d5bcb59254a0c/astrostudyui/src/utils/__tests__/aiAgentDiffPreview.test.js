// [批二③] 写前 diff 预览合同:diff 纯函数;三件工具 preview 形状;运行时 ask 时把预览交给审批台;组件渲染 data-agent-diff。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { diffLines, diffHunks, diffSummary } from '../aiChat/textDiff';
import AgentDiffPreview from '../../components/aianalysis/AgentDiffPreview';
import { registerBuiltinTools } from '../aiTools';
import { registerTool, getTool, __resetToolsForTests } from '../aiTools/registry';
import { createAgentTurn } from '../aiAgent/runtime';
import { setAgentEnabled, setAgentApprovalMode } from '../aiAgent/prefs';
import { requestApproval, listPendingApprovals, resolveApproval, __resetApprovalsForTests } from '../aiAgent/approvals';

beforeEach(()=>{ window.localStorage.clear(); __resetToolsForTests(); __resetApprovalsForTests(); });

describe('diff 纯函数', ()=>{
	it('LCS 行级 diff:相同行 eq,增删按行;空对空 = 一行 eq', ()=>{
		const rows = diffLines('a\nb\nc', 'a\nc\nd');
		expect(rows.map((r)=>r.t + ':' + r.a)).toEqual(['eq:a', 'del:b', 'eq:c', 'add:d']);
		expect(diffSummary('a\nb\nc', 'a\nc\nd')).toEqual({ add: 1, del: 1, changed: true });
		expect(diffSummary('x', 'x').changed).toBe(false);
	});
	it('diffHunks 只留变化行及其上下文', ()=>{
		const rows = diffHunks('1\n2\n3\n4\n5\n6', '1\n2\n3\n4x\n5\n6', 1);
		expect(rows.map((r)=>r.t + ':' + r.a)).toEqual(['eq:3', 'add:4x', 'del:4', 'eq:5']);   // LCS 回溯先出 add 再出 del(展示序,不是语义)
	});
});

describe('工具预览形状', ()=>{
	it('set_settings.preview:当前值 → 改后值,只含本次要改的键;create_chart_record / create_case_record 归一字段', ()=>{
		registerBuiltinTools();
		const setTool = getTool('set_settings');
		const p = setTool.preview({ facet: 'chart', values: { hsys: 0 } });
		expect(p && p.title).toContain('chart');
		expect(`${p.after}`).toContain('hsys: 0');
		expect(`${p.before}`).toContain('hsys:');
		const c = getTool('create_chart_record').preview({ name: '张三', birth: '1990-01-01 08:00', place: '北京', gender: 'male' });
		expect(c.before).toBe('');
		expect(c.after).toContain('名字: 张三');
		expect(c.after).toContain('出生: 1990-01-01 08:00');
		const k = getTool('create_case_record').preview({ caseType: 'liuyao', question: '问事业' });
		expect(k.after).toContain('所问: 问事业');
		expect(k.after).toContain('现在');
	});
});

describe('运行时 → 审批台', ()=>{
	it('每次确认档下,ask 分支把 preview 交给 requestApproval;工具没有 preview 或预览抛错 → preview 为 null,审批照常', async ()=>{
		setAgentEnabled(true); setAgentApprovalMode('on-request');
		registerTool({ name: 'probe_prev', level: 'additive', category: 'records', undoKind: 'none', description: 'd', inputSchema: { type: 'object', properties: {} }, preview: (args)=>({ title: '探针', before: 'a', after: 'b' }), run: async ()=>({ ok: true, summary: 'ok' }) });
		registerTool({ name: 'probe_noprev', level: 'additive', category: 'records', undoKind: 'none', description: 'd', inputSchema: { type: 'object', properties: {} }, run: async ()=>({ ok: true, summary: 'ok' }) });
		registerTool({ name: 'probe_badprev', level: 'additive', category: 'records', undoKind: 'none', description: 'd', inputSchema: { type: 'object', properties: {} }, preview: ()=>{ throw new Error('boom'); }, run: async ()=>({ ok: true, summary: 'ok' }) });
		const seen = [];
		const agent = createAgentTurn({ profile: { id: 'p1' }, model: 'm', requestApproval: async (call)=>{ seen.push(call); return true; } });
		agent.beginRound();
		agent.onEvent({ type: 'tool_call', json: { id: 'c1', name: 'probe_prev', arguments: '{}' } });
		agent.onEvent({ type: 'tool_call', json: { id: 'c2', name: 'probe_noprev', arguments: '{}' } });
		agent.onEvent({ type: 'tool_call', json: { id: 'c3', name: 'probe_badprev', arguments: '{}' } });
		await agent.settleRound();
		expect(seen.map((c)=>c.name)).toEqual(['probe_prev', 'probe_noprev', 'probe_badprev']);
		expect(seen[0].preview).toEqual({ title: '探针', before: 'a', after: 'b' });
		expect(seen[1].preview).toBe(null);
		expect(seen[2].preview).toBe(null);
	});
	it('审批台保留 preview 并随 listPendingApprovals 交给动作条', async ()=>{
		const p = requestApproval('msg-1', { callId: 'x1', name: 'set_settings', args: {}, preview: { title: 't', before: 'a', after: 'b' } });
		expect(listPendingApprovals('msg-1')[0].preview).toEqual({ title: 't', before: 'a', after: 'b' });
		resolveApproval('x1', false);
		expect(await p).toBe(false);
	});
});

describe('组件', ()=>{
	it('有 before/after 时渲染 data-agent-diff 与增删计数;无预览不渲染', ()=>{
		const host = document.createElement('div'); document.body.appendChild(host);
		act(()=>{ ReactDOM.render(<AgentDiffPreview preview={{ title: '改设置', before: 'hsys: 1\nzodiac: 0', after: 'hsys: 0\nzodiac: 0' }} />, host); });
		const el = host.querySelector('[data-agent-diff]');
		expect(el).toBeTruthy();
		expect(el.getAttribute('data-diff-add')).toBe('1');
		expect(el.getAttribute('data-diff-del')).toBe('1');
		expect(host.textContent).toContain('改设置');
		act(()=>{ ReactDOM.render(<AgentDiffPreview preview={null} />, host); });
		expect(host.querySelector('[data-agent-diff]')).toBe(null);
		act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove();
	});
});
