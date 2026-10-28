// 「按工具名禁用」同样管资源面:用户禁了 list_records / cast_technique,命盘 / 事盘资源在 resources/list 不列、resources/read 拒、
// 模版与参数补全不出;禁了 search_materials → 资料资源同理;禁了 list_tasks / get_task → 任务资源同理。没禁的类别照常。
// 资源类别 → 工具名的映射与资源类别表、工具目录对齐(新增资源类别不表态即红)。
import { handleAgentToolRequest, __resetMcpBridgeForTests } from '../aiAgent/mcpBridge';
import { setAgentEnabled, setToolPolicy } from '../aiAgent/prefs';
import { RESOURCE_KIND_TOOLS, resourceKindOf, resourceKindDenied } from '../aiTools/resourceToolGate';
import { RESOURCE_KINDS } from '../aiTools/resources';
import { BUILTIN_TOOL_DEFS } from '../aiTools';

const RES = [
	{ uri: 'horosa://chart/local-1', name: '命盘·张三' },
	{ uri: 'horosa://case/local-2', name: '事盘·问事' },
	{ uri: 'horosa://material/m1', name: '资料·子平真诠' },
	{ uri: 'horosa://task/t1', name: '任务·简报' },
	{ uri: 'horosa://help/bazi', name: '手册·八字' },
];
const TPL = ['chart/{cid}', 'case/{cid}', 'material/{id}', 'task/{id}', 'help/{tab}'].map((t)=>({ uriTemplate: `horosa://${t}`, name: t }));
function deps(){
	return {
		exportToolManifest: ()=>[], runTool: jest.fn(),
		listResourcesPage: jest.fn(async ()=>({ items: RES.slice(), nextCursor: null })),
		listResourceTemplates: jest.fn(()=>TPL.slice()),
		readResource: jest.fn(async (uri)=>({ uri, mimeType: 'text/plain', text: `正文 ${uri}` })),
		completeArgument: jest.fn(async ()=>({ values: ['local-1'], total: 1, hasMore: false })),
		listPrompts: jest.fn(()=>[]), getPrompt: jest.fn(()=>null),
	};
}
let id = 0;
const call = (method, params, d)=>handleAgentToolRequest({ id: ++id, method, params: params || {}, clientName: 'codex' }, d);

beforeEach(()=>{ window.localStorage.clear(); __resetMcpBridgeForTests(); setAgentEnabled(true); });
afterEach(()=>{ setAgentEnabled(false); });

it('映射表:类别与资源类别表一致;列出的工具名都在内置目录里;URI / 模版都解析出类别', ()=>{
	expect(Object.keys(RESOURCE_KIND_TOOLS).sort()).toEqual(RESOURCE_KINDS.slice().sort());
	const names = BUILTIN_TOOL_DEFS.map((d)=>d.name);
	Object.keys(RESOURCE_KIND_TOOLS).forEach((k)=>RESOURCE_KIND_TOOLS[k].forEach((n)=>{ expect(`${k}:${n}:${names.indexOf(n) >= 0}`).toBe(`${k}:${n}:true`); }));
	expect(resourceKindOf('horosa://chart/local-1')).toBe('chart');
	expect(resourceKindOf('horosa://case/{cid}')).toBe('case');
	expect(resourceKindOf('file:///etc/passwd')).toBe(null);
	expect(resourceKindDenied('chart', (n)=>n === 'cast_technique')).toBe(true);
	expect(resourceKindDenied('help', ()=>true)).toBe(false);
});

it('没禁任何工具:资源面照旧全列、可读、可补全(判别向量)', async ()=>{
	const d = deps();
	expect((await call('resources/list', {}, d)).result.resources.map((r)=>r.uri)).toEqual(RES.map((r)=>r.uri));
	expect((await call('resources/templates/list', {}, d)).result.resourceTemplates.length).toBe(5);
	expect((await call('resources/read', { uri: 'horosa://chart/local-1' }, d)).result.contents[0].text).toContain('local-1');
	expect((await call('completion/complete', { ref: { type: 'ref/resource', uri: 'horosa://chart/{cid}' }, argument: { name: 'cid', value: 'l' } }, d)).result.completion.values).toEqual(['local-1']);
});

it('🔴 禁了 list_records:命盘 / 事盘资源不列、读取拒(-32602,不调读取器)、模版与补全不出;其它类别照常', async ()=>{
	setToolPolicy({ deny: ['list_records'] });
	const d = deps();
	const list = (await call('resources/list', {}, d)).result.resources.map((r)=>r.uri);
	expect(list).toEqual(['horosa://material/m1', 'horosa://task/t1', 'horosa://help/bazi']);
	const tpl = (await call('resources/templates/list', {}, d)).result.resourceTemplates.map((t)=>t.uriTemplate);
	expect(tpl).toEqual(['horosa://material/{id}', 'horosa://task/{id}', 'horosa://help/{tab}']);
	for(const uri of ['horosa://chart/local-1', 'horosa://case/local-2']){
		const r = await call('resources/read', { uri }, d);   // eslint-disable-line no-await-in-loop
		expect(r.ok).toBe(false);
		expect(r.error.code).toBe(-32602);
		expect(r.error.message).toContain('disabled');
	}
	expect(d.readResource).not.toHaveBeenCalled();
	const comp = await call('completion/complete', { ref: { type: 'ref/resource', uri: 'horosa://chart/{cid}' }, argument: { name: 'cid', value: '' } }, d);
	expect(comp.result.completion).toEqual({ values: [], total: 0, hasMore: false });
	expect(d.completeArgument).not.toHaveBeenCalled();
	expect((await call('resources/read', { uri: 'horosa://material/m1' }, d)).result.contents[0].text).toContain('m1');
});

it('🔴 禁了 cast_technique 同样挡命盘 / 事盘资源;禁了 search_materials 挡资料;禁了 get_task 挡任务', async ()=>{
	const d = deps();
	setToolPolicy({ deny: ['cast_technique'] });
	expect((await call('resources/read', { uri: 'horosa://case/local-2' }, d)).error.code).toBe(-32602);
	setToolPolicy({ deny: ['search_materials'] });
	expect((await call('resources/list', {}, d)).result.resources.map((r)=>r.uri)).not.toContain('horosa://material/m1');
	expect((await call('resources/read', { uri: 'horosa://material/m1' }, d)).error.code).toBe(-32602);
	expect((await call('resources/read', { uri: 'horosa://chart/local-1' }, d)).ok).toBe(true);
	setToolPolicy({ deny: ['get_task'] });
	expect((await call('resources/list', {}, d)).result.resources.map((r)=>r.uri)).not.toContain('horosa://task/t1');
	expect((await call('resources/read', { uri: 'horosa://task/t1' }, d)).error.code).toBe(-32602);
});
