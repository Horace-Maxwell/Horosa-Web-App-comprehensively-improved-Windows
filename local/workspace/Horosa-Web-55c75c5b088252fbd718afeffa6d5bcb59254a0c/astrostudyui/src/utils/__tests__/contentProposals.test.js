// 内容类提案模版 / 技能包 / 个人口径 AI 只能提议;采纳才写入、可撤销采纳;个人口径提议后被改过 = 冲突。
import { registerBuiltinTools } from '../aiTools';
import { runTool, __resetToolsForTests } from '../aiTools/registry';
import { registerWorkspaceBridge, __resetWorkspaceBridgeForTests } from '../aiTools/workspaceBridge';
import { __resetLedgerForTests } from '../aiTools/ledger';
import { setAgentEnabled } from '../aiAgent/prefs';
import { acceptProposal, revertProposal, getProposal } from '../aiAgent/proposals';
import { AI_ANALYSIS_STORES, getStoreRecord, listStoreRecords } from '../aiAnalysisStore';
import { readPersona, writePersona } from '../aiChat/persona';

const ctx = ()=>({ origin: 'mcp', requestId: 'cp', dispatch: jest.fn(), clientName: 'codex' });
beforeEach(()=>{
	window.localStorage.clear(); __resetToolsForTests(); __resetLedgerForTests(); __resetWorkspaceBridgeForTests();
	registerWorkspaceBridge({ dispatch: jest.fn(), changeCond: jest.fn() });
	setAgentEnabled(true);
	registerBuiltinTools();
});

test('模版:提议不写库;采纳建模版连首版;撤销采纳删掉', async ()=>{
	const r = await runTool('propose_template', { name: '流年简报', instructionText: '按十二宫逐宫写' }, ctx());
	expect(r.data.status).toBe('pending');
	const before = (await listStoreRecords(AI_ANALYSIS_STORES.templates)).length;
	const a = await acceptProposal(r.data.proposalId);
	expect(a.ok).toBe(true);
	const p = getProposal(r.data.proposalId);
	const t = await getStoreRecord(AI_ANALYSIS_STORES.templates, p.createdId);
	expect([t.name, t.instructionText, t.createdBy, !!t.activeVersionId]).toEqual(['流年简报', '按十二宫逐宫写', 'ai-proposal', true]);
	expect((await listStoreRecords(AI_ANALYSIS_STORES.templates)).length).toBe(before + 1);
	expect((await revertProposal(r.data.proposalId)).ok).toBe(true);
	expect(await getStoreRecord(AI_ANALYSIS_STORES.templates, p.createdId)).toBeFalsy();
});
test('技能包:触发词与内置命令冲突 / 与已有技能重复 → 拒;采纳建组合记录带 skill', async ()=>{
	const r = await runTool('propose_skill_pack', { name: '事业', triggers: ['事业观察'], promptTemplate: '看 {{source}} 的事业' }, ctx());
	expect(r.data.status).toBe('pending');
	const a = await acceptProposal(r.data.proposalId);
	expect(a.ok).toBe(true);
	const b = await getStoreRecord(AI_ANALYSIS_STORES.bundles, getProposal(r.data.proposalId).createdId);
	expect(b.skill.triggers).toEqual(['事业观察']);
	const dup = await runTool('propose_skill_pack', { name: '又一个', triggers: ['事业观察'], promptTemplate: 'x' }, ctx());
	expect([dup.ok, /已被技能/.test(dup.message)]).toEqual([false, true]);
});
test('个人口径:采纳整段替换;提议后被改过 = 冲突不落库;撤销采纳换回原文;同文 = 无变化', async ()=>{
	writePersona({ text: '原口径' });
	expect((await runTool('propose_persona_text', { text: '原口径' }, ctx())).data.changed).toBe(false);
	const r = await runTool('propose_persona_text', { text: '新口径' }, ctx());
	expect(readPersona().text).toBe('原口径');
	expect((await acceptProposal(r.data.proposalId)).ok).toBe(true);
	expect(readPersona().text).toBe('新口径');
	expect((await revertProposal(r.data.proposalId)).ok).toBe(true);
	expect(readPersona().text).toBe('原口径');
	const r2 = await runTool('propose_persona_text', { text: '另一版' }, ctx());
	writePersona({ text: '用户自己改了' });
	const c = await acceptProposal(r2.data.proposalId);
	expect([c.ok, c.code]).toEqual([false, 'E_PROPOSAL_CONFLICT']);
	expect(readPersona().text).toBe('用户自己改了');
});
