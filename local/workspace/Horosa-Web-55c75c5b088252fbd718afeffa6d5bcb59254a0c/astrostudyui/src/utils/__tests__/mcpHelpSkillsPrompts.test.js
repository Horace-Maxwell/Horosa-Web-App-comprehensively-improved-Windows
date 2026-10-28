// 资源 / 提示 / 补全扩面 + 无头分析三个新参数:
//   技法操作手册 horosa://help/<页签>(帮助弹窗同一份组件抽纯文本:全部页签、两层页签的惰性项都展开)· 后台任务 horosa://task/<id> ·
//   使用指南 guide:horosa · 技能包提示 skill:<id>(内置 + 用户自建)· 补全(任务 id / 手册页签 / 技能包 cid)·
//   run_analysis 的 source(起课时间)/ partnerRecordId / skill + skillArgs 都真进了无头拼装。
import React from 'react';
import { helpTextOf, helpTitleOf, listHelpTabs, helpElementToText, __resetHelpTextCacheForTests } from '../aiTools/helpText';
import { TECHNIQUE_HELP_DOCS } from '../../components/help/techniqueHelpRegistry';
import HelpDocTwoLevel from '../../components/help/HelpDocTwoLevel';
import { readResource, listResourceTemplates, listResourcesPage } from '../aiTools/resources';
import { listPromptsPage, getPrompt, PROMPT_GUIDE_NAME } from '../aiTools/prompts';
import { completeArgument } from '../aiTools/completions';
import { createTask, __resetTaskCacheForTests } from '../aiAgent/tasks/taskStore';
import { clearStore, putStoreRecord, AI_ANALYSIS_STORES } from '../aiAnalysisStore';
import { registerBuiltinTools } from '../aiTools';
import { runTool, __resetToolsForTests } from '../aiTools/registry';
import { setAgentEnabled, setAgentApprovalMode, setHeadlessEnabled } from '../aiAgent/prefs';
import { __resetHeadlessForTests } from '../aiTools/tools/runAnalysis';
import { recordToolCapability } from '../aiAgent/caps';
import { fakeStreamScript } from './helpers/agentFakes';
import { upsertLocalChart } from '../localcharts';

// 帮助文档是 JSX 类组件且不自 import React:生产构建走自动 JSX 运行时,jest 走经典运行时需要作用域里有 React(同 helpDocsGuard)
global.React = React;

beforeEach(async ()=>{
	window.localStorage.clear();
	__resetHelpTextCacheForTests(); __resetTaskCacheForTests(); __resetToolsForTests(); __resetHeadlessForTests();
	await clearStore(AI_ANALYSIS_STORES.agentTasks);
	await clearStore(AI_ANALYSIS_STORES.bundles);
	await clearStore(AI_ANALYSIS_STORES.conversations);
	await clearStore(AI_ANALYSIS_STORES.messages);
});

describe('技法操作手册 → 纯文本', ()=>{
	it('🔴 每个登记的手册都抽得出非空正文,首行是标题;页签标题成节,不止当前页签', ()=>{
		const tabs = listHelpTabs();
		expect(tabs.sort()).toEqual(Object.keys(TECHNIQUE_HELP_DOCS).sort());
		tabs.forEach((tab)=>{
			const t = helpTextOf(tab);
			expect(t.length).toBeGreaterThan(200);
			expect(helpTitleOf(tab)).toBe(t.split('\n')[0]);
		});
		const bazi = helpTextOf('bazi');
		expect(bazi.split('\n')[0]).toContain('八字');
		expect((bazi.match(/\n## /g) || []).length).toBeGreaterThan(3);   // 多个页签全部展开
		expect(bazi).not.toMatch(/<[a-z]+[ >]/);   // 不残留标签
	});
	it('🔴 两层页签的惰性项全部展开(界面只渲染当前项,这里要全文);判别力:一个只在非首项里的字串也在', ()=>{
		const El = React.createElement(HelpDocTwoLevel, { groups: [
			{ key: 'g1', label: '甲组', items: [{ key: 'a', label: '甲一', render: ()=>React.createElement('div', null, '首项正文') }, { key: 'b', label: '甲二', render: ()=>React.createElement('div', null, '藏在第二项里') }] },
			{ key: 'g2', label: '乙组', hint: '乙组提示', items: [{ key: 'c', label: '乙一', content: React.createElement('p', null, '乙组正文') }] },
		] });
		const t = helpElementToText(El);
		['甲组', '甲一', '甲二', '首项正文', '藏在第二项里', '乙组', '乙组提示', '乙组正文'].forEach((w)=>expect(t).toContain(w));
	});
	it('资源:模版含 help / task;读 horosa://help/bazi = 手册全文;未知页签 null;列表里有手册', async ()=>{
		const tpl = listResourceTemplates().map((x)=>x.uriTemplate);
		expect(tpl).toEqual(expect.arrayContaining(['horosa://help/{tab}', 'horosa://task/{id}']));
		const r = await readResource('horosa://help/bazi');
		expect(r.text).toBe(helpTextOf('bazi'));
		expect(await readResource('horosa://help/nope')).toBeNull();
		let cursor; const uris = [];
		do{ const page = await listResourcesPage({ cursor }); page.items.forEach((x)=>uris.push(x.uri)); cursor = page.nextCursor; }while(cursor);   // eslint-disable-line no-await-in-loop
		expect(uris).toContain('horosa://help/bazi');
	});
});

describe('后台任务资源 + 补全', ()=>{
	it('🔴 horosa://task/<id> 出状态 / 日志 / 结果;补全任务 id 与手册页签;不存在 null', async ()=>{
		const t = await createTask({ kind: 'goal', title: '看流年', status: 'done', log: [{ at: 't1', text: '开始' }], result: { content: '结论正文' } });
		const r = await readResource(`horosa://task/${t.id}`);
		expect(r.text).toContain('看流年');
		expect(r.text).toContain('开始');
		expect(r.text).toContain('结论正文');
		expect(await readResource('horosa://task/nope')).toBeNull();
		const c = await completeArgument({ type: 'ref/resource', uri: 'horosa://task/{id}' }, { name: 'id', value: '流年' });
		expect(c.values).toEqual([t.id]);
		const h = await completeArgument({ type: 'ref/resource', uri: 'horosa://help/{tab}' }, { name: 'tab', value: '八字' });
		expect(h.values).toContain('bazi');
	});
});

describe('提示:使用指南 + 技能包', ()=>{
	it('🔴 guide:horosa 排第一、讲清该调的工具;内置技能包与用户技能包都作 skill:<id> 出现,参数含 cid 与技能自己的参数', async ()=>{
		await putStoreRecord(AI_ANALYSIS_STORES.bundles, { id: 'b-my', name: '我的周报', skill: { version: 1, triggers: ['周报'], requires: 'chart', techniqueKeys: ['bazi'], argsSpec: [{ name: 'week', label: '周次', default: '本周' }], promptTemplate: '请给{{source}}写{{week}}的周报', outputFormat: '三条要点', schoolNote: '按子平' } }, 'bundle');
		const page = await listPromptsPage({});
		const names = page.items.map((p)=>p.name);
		expect(names[0]).toBe(PROMPT_GUIDE_NAME);
		expect(names).toEqual(expect.arrayContaining(['skill:builtin:liunian', 'skill:builtin:hepan', 'skill:builtin:brief', 'skill:b-my']));
		const liunian = page.items.find((p)=>p.name === 'skill:builtin:liunian');
		expect(liunian.arguments.map((a)=>a.name)).toEqual(['cid', 'year']);
		expect(page.items.find((p)=>p.name === 'skill:builtin:hepan').arguments.map((a)=>a.name)).toContain('otherCid');
		const guide = await getPrompt(PROMPT_GUIDE_NAME, {});
		['cast_technique', 'cast_relative', 'search_election', 'read_current_page', 'horosa://help/'].forEach((w)=>expect(guide.messages[0].content.text).toContain(w));
	});
	it('🔴 技能包提示渲染:年份规整、命盘名填进模板、指明先取哪些技法、口径与输出格式;用户技能包缺省参数兜底;未知 null', async ()=>{
		const A = upsertLocalChart({ name: '张三', birth: '1990-05-18 10:00:00', zone: '+08:00', lat: '39n54', lon: '116e24', gender: 1 });
		const ln = await getPrompt('skill:builtin:liunian', { cid: A.cid, year: '2027年' });
		const text = ln.messages[0].content.text;
		expect(text).toContain('张三');
		expect(text).toContain('2027 年');
		expect(text).toContain('cast_technique');
		expect(text).toContain('八字');
		await putStoreRecord(AI_ANALYSIS_STORES.bundles, { id: 'b-my', name: '我的周报', skill: { version: 1, triggers: ['周报'], requires: 'chart', techniqueKeys: ['bazi'], argsSpec: [{ name: 'week', label: '周次', default: '本周' }], promptTemplate: '请给{{source}}写{{week}}的周报', outputFormat: '三条要点', schoolNote: '按子平' } }, 'bundle');
		const my = (await getPrompt('skill:b-my', { cid: A.cid })).messages[0].content.text;
		expect(my).toContain('请给张三写本周的周报');
		expect(my).toContain('按子平');
		expect(my).toContain('三条要点');
		expect(await getPrompt('skill:nope', {})).toBeNull();
		const comp = await completeArgument({ type: 'ref/prompt', name: 'skill:builtin:liunian' }, { name: 'cid', value: '张' });
		expect(comp.values).toEqual([A.cid]);
	});
});

describe('run_analysis 三个新参数', ()=>{
	const profile = { id: 'p1', name: 'P', providerType: 'openai', protocolFamily: 'openai', baseUrl: 'http://x', apiKey: 'k', providerOptions: {} };
	function seam(captured){
		return { resolved: { profile, model: 'm' }, requestAIAnalysisChatStream: fakeStreamScript([[{ text: '好' }], [{ text: '好' }], [{ text: '好' }], [{ text: '好' }]]), buildHeadlessSystemPrompt: async (o)=>{ captured.push(o); return { systemPrompt: 'SYS', meta: {} }; } };
	}
	beforeEach(()=>{ registerBuiltinTools(); setAgentEnabled(true); setAgentApprovalMode('never'); recordToolCapability('p1', 'm', true); setHeadlessEnabled(true); });
	it('🔴 partnerRecordId → 对方进拼装;skill → 技法 / 口径进系统指令、问题按模板生成;source=timepoint 起课时间', async ()=>{
		const A = upsertLocalChart({ name: '张三', birth: '1990-05-18 10:00:00', zone: '+08:00', lat: '39n54', lon: '116e24', gender: 1 });
		const B = upsertLocalChart({ name: '李四', birth: '1992-03-07 08:30:00', zone: '+08:00', lat: '39n54', lon: '116e24', gender: 0 });
		const captured = [];
		const r1 = await runTool('run_analysis', { recordId: A.cid, partnerRecordId: B.cid, skill: 'builtin:hepan' }, { origin: 'mcp', headlessDeps: seam(captured) });
		expect(r1.ok).toBe(true);
		expect(captured[0].partnerSource && captured[0].partnerSource.id).toBe(B.cid);
		const r2 = await runTool('run_analysis', { recordId: A.cid, skill: 'builtin:liunian', skillArgs: { year: '2027' } }, { origin: 'mcp', headlessDeps: seam(captured) });
		expect(r2.ok).toBe(true);
		expect(captured[1].techniqueKeys).toEqual(['bazi', 'ziwei']);
		expect(captured[1].systemPrompt).toContain('输出格式');
		const r3 = await runTool('run_analysis', { question: '今天出行如何', source: { kind: 'timepoint', divTime: '2026-10-10 09:00', place: '北京' }, techniques: ['liureng'] }, { origin: 'mcp', headlessDeps: seam(captured) });
		expect(r3.ok).toBe(true);
		expect(captured[2].source.sourceType).toBe('timepoint');
		// 判别:合盘对方不是命盘 / 与本人同一张 ⇒ 拒;question 与 skill 都没有 ⇒ 拒;技能包不存在 ⇒ 拒
		expect((await runTool('run_analysis', { recordId: A.cid, partnerRecordId: A.cid, question: 'q' }, { origin: 'mcp', headlessDeps: seam(captured) })).code).toBe('E_TECHNIQUE_NOT_ALLOWED');
		expect((await runTool('run_analysis', { recordId: A.cid }, { origin: 'mcp', headlessDeps: seam(captured) })).code).toBe('E_ARGS_INVALID');
		expect((await runTool('run_analysis', { recordId: A.cid, skill: 'nope' }, { origin: 'mcp', headlessDeps: seam(captured) })).code).toBe('E_ARGS_INVALID');
	});
});
