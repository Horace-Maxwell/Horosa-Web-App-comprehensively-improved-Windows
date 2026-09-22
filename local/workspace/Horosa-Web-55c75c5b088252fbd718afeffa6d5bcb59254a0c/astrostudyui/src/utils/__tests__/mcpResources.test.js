// MCP 资源面 / 提示面(P5)合同:URI 解析(只认 horosa:// 三类)· 列表来自本机命盘/事盘/资料 · 读取走挂载快照单源 ·
// 未知/空 → null(绝不编造)· 技法提示卡只给「怎么问」不产结论 · 用户模版按 format 取正文 · 两件都不引工具注册表与运行时。
import fs from 'fs';
import path from 'path';
import { RESOURCE_SCHEME, resourceUri, parseResourceUri, listResources, listResourceTemplates, readResource } from '../aiTools/resources';
import { PROMPT_TECHNIQUE_PREFIX, PROMPT_TEMPLATE_PREFIX, listPrompts, getPrompt, labelOfTechnique } from '../aiTools/prompts';
import { AI_ANALYSIS_STORES, putStoreRecord, clearStore } from '../aiAnalysisStore';

jest.mock('../localcharts', ()=>({ ...jest.requireActual('../localcharts'), listLocalCharts: jest.fn(()=>[{ cid: 'local-1', name: '张三', birth: '1990-01-01 08:00', pos: '北京' }]) }));
jest.mock('../localcases', ()=>({ ...jest.requireActual('../localcases'), listLocalCases: jest.fn(()=>[{ cid: 'local-2', event: '问事', caseType: 'liuyao', divTime: '2026-01-01 10:00' }]) }));
jest.mock('../aiAnalysisSources', ()=>({ ...jest.requireActual('../aiAnalysisSources'), findAnalysisSourceById: jest.fn((cid)=>(cid === 'local-1' ? { id: 'local-1', sourceType: 'chart', title: '张三', record: { name: '张三' } } : null)) }));
jest.mock('../aiAnalysisContext', ()=>({ ...jest.requireActual('../aiAnalysisContext'), getAnalysisSourceContext: jest.fn(async (src)=>({ content: `【案例】${src.title} 八字:庚午 丁亥 甲子 戊辰` })) }));

beforeEach(async ()=>{ window.localStorage.clear(); await clearStore(AI_ANALYSIS_STORES.materials); await clearStore(AI_ANALYSIS_STORES.templates); });

it('URI:只认 horosa:// 三类;非法/未知类别 → null;模版表三条', ()=>{
	expect(resourceUri('chart', 'local-1')).toBe('horosa://chart/local-1');
	expect(parseResourceUri('horosa://chart/local-1')).toEqual({ kind: 'chart', id: 'local-1' });
	expect(parseResourceUri('horosa://material/m1')).toEqual({ kind: 'material', id: 'm1' });
	expect(parseResourceUri('horosa://report/r1')).toBe(null);
	expect(parseResourceUri('file:///etc/passwd')).toBe(null);
	expect(parseResourceUri('horosa://chart/')).toBe(null);
	expect(parseResourceUri('')).toBe(null);
	const tpl = listResourceTemplates();
	expect(tpl.map((t)=>t.uriTemplate)).toEqual([`${RESOURCE_SCHEME}chart/{cid}`, `${RESOURCE_SCHEME}case/{cid}`, `${RESOURCE_SCHEME}material/{id}`]);
});

it('🔴 列表=本机命盘/事盘/资料;读取走挂载快照单源;资料带标题;未知或空 → null', async ()=>{
	// [Q-056/M-68] 种子按产品写入形状(extractedText);旧 content 形状仍兼容回落
	await putStoreRecord(AI_ANALYSIS_STORES.materials, { id: 'm1', name: '子平真诠', extractedText: '正文内容' });
	await putStoreRecord(AI_ANALYSIS_STORES.materials, { id: 'm2', name: '空资料', extractedText: '' });
	const list = await listResources({});
	expect(list.map((r)=>r.uri)).toEqual(['horosa://chart/local-1', 'horosa://case/local-2', 'horosa://material/m1', 'horosa://material/m2']);
	expect(list[0].name).toBe('命盘·张三');
	expect(list[1].name).toBe('事盘·问事');
	const chart = await readResource('horosa://chart/local-1');
	expect(chart.mimeType).toBe('text/plain');
	expect(chart.text).toContain('八字:庚午');
	const mat = await readResource('horosa://material/m1');
	expect(mat.text.indexOf('【资料】子平真诠')).toBe(0);
	expect(mat.text).toContain('正文内容');
	expect(await readResource('horosa://material/m2')).toBe(null);   // 正文空 → null,不回空壳
	expect(await readResource('horosa://chart/nope')).toBe(null);
	expect(await readResource('horosa://report/r1')).toBe(null);
});

it('🔴 提示卡:每个技法一张,只给「怎么问」(指向 cast_technique)不产结论;带 cid/question 时进正文;用户模版按 format 取正文;未知 → null', async ()=>{
	await putStoreRecord(AI_ANALYSIS_STORES.templates, { id: 't1', name: '事业模版', format: 'text', instructionText: '分四段:格局/大运/流年/建议' });
	const prompts = await listPrompts({});
	const bazi = prompts.find((p)=>p.name === `${PROMPT_TECHNIQUE_PREFIX}bazi`);
	expect(bazi).toBeTruthy();
	expect(bazi.description).toContain(labelOfTechnique('bazi'));
	expect(bazi.arguments.map((a)=>a.name)).toEqual(['cid', 'question']);
	expect(prompts.some((p)=>p.name === `${PROMPT_TEMPLATE_PREFIX}t1`)).toBe(true);
	const got = await getPrompt(`${PROMPT_TECHNIQUE_PREFIX}bazi`, { cid: 'local-1', question: '今年事业' });
	expect(got.messages[0].role).toBe('user');
	const text = got.messages[0].content.text;
	// [Q-334] 示例参数必须与 cast_technique 的 inputSchema 同形(source:{kind,cid});旧文案教的 sourceCid
	// 在 additionalProperties:false 下必被守卫拒掉 —— 此处曾把同一个错抄进判据
	expect(text).toContain('cast_technique({ technique: "bazi", source: { kind: "record", cid: "local-1" } })');
	expect(text).not.toContain('sourceCid');
	const noCid = (await getPrompt(`${PROMPT_TECHNIQUE_PREFIX}bazi`, {})).messages[0].content.text;
	expect(noCid).toContain('source: { kind: "record", cid: "<命盘或事盘 cid>" }');
	expect(text).toContain('horosa://chart/<cid>');
	expect(text).toContain('【本次问题】今年事业');
	expect(text).not.toMatch(/命宫在|日主为|你的运势/);   // 提示卡不产结论
	const tpl = await getPrompt(`${PROMPT_TEMPLATE_PREFIX}t1`, { question: 'Q' });
	expect(tpl.messages[0].content.text).toContain('分四段:格局/大运/流年/建议');
	expect(tpl.messages[0].content.text).toContain('【本次问题】Q');
	// [Q-333] JSON 模版此前只发 Schema、说明整段丢失 → 与对话页同式「说明 + JSON Schema:」
	await putStoreRecord(AI_ANALYSIS_STORES.templates, { id: 't2', name: '结构模版', format: 'json', instructionText: '只输出结构,不要散文', jsonSchema: '{\n  "type": "object"\n}' });
	const tplJson = (await getPrompt(`${PROMPT_TEMPLATE_PREFIX}t2`, {})).messages[0].content.text;
	expect(tplJson).toContain('只输出结构,不要散文');
	expect(tplJson).toContain('JSON Schema：');
	expect(tplJson).toContain('"type": "object"');
	expect(await getPrompt(`${PROMPT_TECHNIQUE_PREFIX}nope`, {})).toBe(null);
	expect(await getPrompt(`${PROMPT_TEMPLATE_PREFIX}nope`, {})).toBe(null);
	expect(await getPrompt('whatever', {})).toBe(null);
});

it('资源面/提示面零工具注册表与运行时 import(只出内容,永不执行动作)', ()=>{
	const dir = path.resolve(__dirname, '..', 'aiTools');
	['resources.js', 'prompts.js'].forEach((f)=>{
		const src = fs.readFileSync(path.join(dir, f), 'utf8');
		expect(/from '\.\/registry'|from '\.\.\/aiAgent\/|registerTool\(|runTool\(/.test(src)).toBe(false);
	});
});
