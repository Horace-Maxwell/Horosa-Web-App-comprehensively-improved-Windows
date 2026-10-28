// 工具输出结构合同(MCP outputSchema):声明了 outputSchema 的工具,MCP 导出面原样带出、运行时 toolDefs 不带;
// 每件都真跑成功路径(含「已存在不重复建」这类分支),返回的 data 必须逐条通过自己声明的结构 —— 外部客户端按规范会校验
// structuredContent,结构写错 = 外部调用全部报错。
jest.mock('../request', ()=>({ __esModule: true, default: jest.fn(async ()=>{ throw new Error('offline'); }) }));
jest.mock('../../services/astro', ()=>({ fetchChart: jest.fn(async ()=>{ throw new Error('offline'); }) }));
jest.mock('../aiAnalysisStore', ()=>({
	AI_ANALYSIS_STORES: { contextCache: 'contextCache', materials: 'materials', templates: 'templates' },
	getStoreRecord: jest.fn(async ()=>null),
	putStoreRecord: jest.fn(async (storeName, record)=>record),
	listStoreRecords: jest.fn(async ()=>[]),
	schedulePruneContextCache: jest.fn(),
}));
import Ajv from 'ajv';
import { registerBuiltinTools } from '../aiTools';
import { runTool, listTools, exportToolManifest, __resetToolsForTests } from '../aiTools/registry';
import { registerWorkspaceBridge, __resetWorkspaceBridgeForTests } from '../aiTools/workspaceBridge';
import { __resetLedgerForTests } from '../aiTools/ledger';

const ajv = new Ajv({ allErrors: true, strict: false });
const SHAPED = ['list_records', 'resolve_place', 'create_chart_record', 'create_case_record', 'cast_technique', 'list_actions', 'star_record', 'pin_record', 'add_record_tag',
	// 新增读面全部带输出结构(私人内容三件受子开关管:注册表里恒在,MCP 目录里只在开时出现)
	'list_tasks', 'get_task', 'cast_relative', 'list_election_conditions', 'search_election', 'explain_election', 'search_xuanshi', 'get_xuanshi_item', 'read_current_page', 'list_conversations', 'get_conversation', 'get_record_detail',
	'append_record_journal', 'link_records', 'set_chat_mount', 'list_divination_casts', 'cast_divination_case',
	'propose_record_edit', 'propose_record_archive', 'list_proposals', 'list_zeri_conditions', 'search_zeri', 'explain_zeri',
	// 名人库
	'search_celebrities', 'list_celebrity_categories', 'get_celebrity', 'create_celebrity_chart'];
const ctx = ()=>({ origin: 'mcp', requestId: 'r1', dispatch: jest.fn(), ui: { selectSource: jest.fn(), refreshSources: jest.fn() } });

function check(name, r){
	const def = listTools().find((d)=>d.name === name);
	expect(r.ok).toBe(true);
	const validate = ajv.compile(def.outputSchema);
	const ok = validate(r.data);
	if(!ok){ throw new Error(`${name} 的 data 不合自己声明的 outputSchema:${JSON.stringify(validate.errors)}`); }
}

beforeEach(()=>{
	window.localStorage.clear();
	__resetToolsForTests(); __resetLedgerForTests(); __resetWorkspaceBridgeForTests();
	registerWorkspaceBridge({ dispatch: jest.fn(), changeCond: jest.fn() });
	registerBuiltinTools();
});

test('声明集恰是这几件;结构可编译、顶层 type:object;MCP 面带、运行时 toolDefs 形状不带', ()=>{
	const declared = listTools().filter((d)=>d.outputSchema).map((d)=>d.name).sort();
	expect(declared).toEqual(SHAPED.slice().sort());
	declared.forEach((n)=>{
		const def = listTools().find((d)=>d.name === n);
		expect(def.outputSchema.type).toBe('object');
		expect(()=>ajv.compile(def.outputSchema)).not.toThrow();
	});
	const man = exportToolManifest({ includeExternal: false, origin: 'mcp' });
	SHAPED.forEach((n)=>{ const t = man.find((x)=>x.name === n); if(t){ expect(t.outputSchema && t.outputSchema.type).toBe('object'); } });
	expect(man.filter((t)=>t.outputSchema).length).toBeGreaterThanOrEqual(8);
	expect(man.find((t)=>t.name === 'get_current_context').outputSchema).toBeUndefined();
});

test('🔴 真跑:建档(新建 / 已存在)· 列档(全量 / brief)· 星标 · 置顶 · 加标签 · 账本 · 地名 · 建事盘 · 起盘 —— data 全部合结构', async ()=>{
	const created = await runTool('create_chart_record', { name: '张三', birth: '1990-01-01 08:00', gender: 'male', place: '北京' }, ctx());
	check('create_chart_record', created);
	const dup = await runTool('create_chart_record', { name: '张三', birth: '1990-01-01 08:00', place: '北京' }, ctx());
	check('create_chart_record', dup);
	expect(dup.data.duplicate).toBe(true);
	const cid = created.data.cid;
	check('list_records', await runTool('list_records', {}, ctx()));
	check('list_records', await runTool('list_records', { fields: 'brief', limit: 1 }, ctx()));
	check('list_records', await runTool('list_records', { query: '不存在的人' }, ctx()));
	check('star_record', await runTool('star_record', { recordId: cid }, ctx()));
	check('star_record', await runTool('star_record', { recordId: cid }, ctx()));   // 已有星标(changed:false)
	check('pin_record', await runTool('pin_record', { recordId: cid }, ctx()));
	check('add_record_tag', await runTool('add_record_tag', { recordId: cid, tag: '客户' }, ctx()));
	check('list_actions', await runTool('list_actions', {}, ctx()));
	check('resolve_place', await runTool('resolve_place', { query: '北京' }, ctx()));
	const kase = await runTool('create_case_record', { caseType: 'horary', divTime: '2026-05-01 10:00', place: '北京', event: '问事' }, ctx());
	check('create_case_record', kase);
	check('create_case_record', await runTool('create_case_record', { caseType: 'horary', divTime: '2026-05-01 10:00', place: '北京', event: '问事' }, ctx()));
	const cast = await runTool('cast_technique', { technique: 'bazi', source: { kind: 'natal', birth: '1990-01-01 08:00', place: '北京', gender: 'male' }, maxChars: 800 }, ctx());
	check('cast_technique', cast);
	expect(typeof cast.data.content).toBe('string');
});

test('判别力:结构写错一个字段类型 ⇒ 同一份 data 校验不过', async ()=>{
	const r = await runTool('list_records', {}, ctx());
	const def = listTools().find((d)=>d.name === 'list_records');
	const broken = JSON.parse(JSON.stringify(def.outputSchema));
	broken.properties.total = { type: 'string' };
	expect(ajv.compile(broken)(r.data)).toBe(false);
});
