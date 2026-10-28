// MCP 参数补全(completion/complete)与列表分页(resources/list · prompts/list 游标):
// 补全候选必须是能原样填回去的真值(cid / 资料 id),按名称前缀 > 名称包含 > id 包含排序、≤100;
// 分页游标对壳与客户端不透明,坏游标回 -32602;所有条目都能翻到(此前资源硬截 200、提示硬截 100)。
jest.mock('../aiAnalysisStore', ()=>({
	AI_ANALYSIS_STORES: { materials: 'materials', templates: 'templates' },
	listStoreRecords: jest.fn(async (store)=>(store === 'materials' ? [{ id: 'm-1', name: '滴天髓', extractedText: '天道' }, { id: 'm-2', name: '穷通宝鉴', extractedText: '调候' }] : [])),
	getStoreRecord: jest.fn(async ()=>null),
}));
import { completeArgument, rankCandidates, COMPLETION_MAX } from '../aiTools/completions';
import { listResourcesPage, decodeListCursor, encodeListCursor, RESOURCE_PAGE_SIZE } from '../aiTools/resources';
import { listPromptsPage, PROMPT_PAGE_SIZE } from '../aiTools/prompts';
import { listHelpTabs } from '../aiTools/helpText';
import { handleAgentToolRequest, __resetMcpBridgeForTests } from '../aiAgent/mcpBridge';
import { setAgentEnabled } from '../aiAgent/prefs';
import { upsertLocalChart } from '../localcharts';
import { upsertLocalCase } from '../localcases';

function seedCharts(n){
	for(let i = 0; i < n; i++){ upsertLocalChart({ name: i === 0 ? '张三' : (i === 1 ? '李张' : `命主${i}`), birth: '1990-01-01 08:00:00', zone: '+08:00', lat: '39n54', lon: '116e24', gender: 1 }); }
}

beforeEach(()=>{ window.localStorage.clear(); __resetMcpBridgeForTests(); setAgentEnabled(true); });

describe('参数补全', ()=>{
	it('🔴 命盘模版补 cid:名称前缀先于名称包含;候选是真 cid;空输入按原序全给', async ()=>{
		seedCharts(3);
		const r = await completeArgument({ type: 'ref/resource', uri: 'horosa://chart/{cid}' }, { name: 'cid', value: '张' });
		expect(r.values.length).toBe(2);
		expect(r.values.every((v)=>/^local-/.test(v))).toBe(true);
		expect(r.total).toBe(2);
		expect(r.hasMore).toBe(false);
		const all = await completeArgument({ type: 'ref/resource', uri: 'horosa://chart/{cid}' }, { name: 'cid', value: '' });
		expect(all.values.length).toBe(3);
		// 前缀命中(张三)排在包含命中(李张)前
		const names = r.values.map((cid)=>JSON.parse(window.localStorage.getItem('horosa.localCharts.v1')).find((x)=>x.cid === cid).name);
		expect(names).toEqual(['张三', '李张']);
	});
	it('事盘 / 资料模版、提示卡 cid、自由文本参数、认不出的引用', async ()=>{
		upsertLocalCase({ event: '问出行', caseType: 'horary', divTime: '2026-05-01 10:00:00', zone: '+08:00', lat: '39n54', lon: '116e24' });
		const c = await completeArgument({ type: 'ref/resource', uri: 'horosa://case/{cid}' }, { name: 'cid', value: '出行' });
		expect(c.values.length).toBe(1);
		const m = await completeArgument({ type: 'ref/resource', uri: 'horosa://material/{id}' }, { name: 'id', value: '穷' });
		expect(m.values).toEqual(['m-2']);
		seedCharts(1);
		const p = await completeArgument({ type: 'ref/prompt', name: 'technique:bazi' }, { name: 'cid', value: '张' });
		expect(p.values.length).toBe(1);
		const q = await completeArgument({ type: 'ref/prompt', name: 'technique:bazi' }, { name: 'question', value: '财' });
		expect(q).toEqual({ values: [], total: 0, hasMore: false });
		expect(await completeArgument({ type: 'ref/prompt', name: 'nope' }, { name: 'x', value: '' })).toBeNull();
		expect(await completeArgument({ type: 'ref/resource', uri: 'file:///x' }, { name: 'x', value: '' })).toBeNull();
	});
	it('上限 100,hasMore 如实', ()=>{
		const rows = Array.from({ length: 150 }, (_, i)=>({ id: `id-${i}`, label: `名${i}` }));
		const r = rankCandidates(rows, '名');
		expect(r.values.length).toBe(COMPLETION_MAX);
		expect(r.total).toBe(150);
		expect(r.hasMore).toBe(true);
	});
	it('🔴 经桥:completion/complete 回 {completion};缺 ref / argument.name ⇒ -32602;认不出的引用 ⇒ -32602', async ()=>{
		seedCharts(2);
		const deps = { exportToolManifest: ()=>[], runTool: jest.fn(), completeArgument };
		const ok = await handleAgentToolRequest({ id: 1, method: 'completion/complete', params: { ref: { type: 'ref/resource', uri: 'horosa://chart/{cid}' }, argument: { name: 'cid', value: '' } } }, deps);
		expect(ok.ok).toBe(true);
		expect(ok.result.completion.values.length).toBe(2);
		const bad = await handleAgentToolRequest({ id: 2, method: 'completion/complete', params: { argument: { name: 'cid', value: '' } } }, deps);
		expect(bad.error.code).toBe(-32602);
		const unknown = await handleAgentToolRequest({ id: 3, method: 'completion/complete', params: { ref: { type: 'ref/prompt', name: 'nope' }, argument: { name: 'x', value: '' } } }, deps);
		expect(unknown.error.code).toBe(-32602);
	});
});

describe('列表分页', ()=>{
	it('游标编解码:不透明串往返;坏游标抛 E_BAD_CURSOR', ()=>{
		expect(decodeListCursor(encodeListCursor(250))).toBe(250);
		expect(decodeListCursor(undefined)).toBe(0);
		['x', 'o-1', 'o', 'oZZ', 5].forEach((bad)=>{ expect(()=>decodeListCursor(bad)).toThrow(expect.objectContaining({ code: 'E_BAD_CURSOR' })); });
	});
	it('🔴 资源 250 条(命盘)+ 2 份资料:按页翻完恰好一条不漏、一条不重', async ()=>{
		seedCharts(250);
		const seen = [];
		let cursor;
		let pages = 0;
		do{
			const page = await listResourcesPage({ cursor });   // eslint-disable-line no-await-in-loop
			expect(page.items.length).toBeLessThanOrEqual(RESOURCE_PAGE_SIZE);
			page.items.forEach((x)=>seen.push(x.uri));
			cursor = page.nextCursor;
			pages += 1;
		}while(cursor && pages < 10);
		// 列表尾部还有技法操作手册(每个登记了手册的页签一条)
		const total = 252 + listHelpTabs().length;
		expect(listHelpTabs().length).toBeGreaterThan(0);
		expect(pages).toBe(Math.ceil(total / RESOURCE_PAGE_SIZE));
		expect(seen.length).toBe(total);
		expect(new Set(seen).size).toBe(total);
	});
	it('🔴 经桥:resources/list 带回 nextCursor、最后一页不带;坏游标 -32602;prompts/list 同口径', async ()=>{
		seedCharts(120);
		const deps = { exportToolManifest: ()=>[], runTool: jest.fn(), listResourcesPage, listPromptsPage };
		const p1 = await handleAgentToolRequest({ id: 10, method: 'resources/list', params: {} }, deps);
		expect(p1.result.resources.length).toBe(RESOURCE_PAGE_SIZE);
		expect(typeof p1.result.nextCursor).toBe('string');
		const p2 = await handleAgentToolRequest({ id: 11, method: 'resources/list', params: { cursor: p1.result.nextCursor } }, deps);
		expect(p2.result.nextCursor).toBeUndefined();
		expect(p1.result.resources.length + p2.result.resources.length).toBe(122 + listHelpTabs().length);
		const bad = await handleAgentToolRequest({ id: 12, method: 'resources/list', params: { cursor: 'garbage' } }, deps);
		expect(bad.error.code).toBe(-32602);
		const pr = await handleAgentToolRequest({ id: 13, method: 'prompts/list', params: {} }, deps);
		expect(pr.result.prompts.length).toBeLessThanOrEqual(PROMPT_PAGE_SIZE);
		expect(pr.result.prompts.length).toBeGreaterThan(0);
	});
});
