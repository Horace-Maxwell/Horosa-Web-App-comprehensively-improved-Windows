// [压测二轮·D3] 外部桥限流面:资源/提示分支同样受限流;限流桶按壳注入的会话身份分,不按客户端自报名分,且桶表有界。
// 打桩方式与 mcpBridge.test.js / mcpBridgeStress.test.js 同:handleAgentToolRequest 直接注入 deps(不走 loadTools 惰性 chunk)。
import { handleAgentToolRequest, checkExternalLimits, __resetMcpBridgeForTests } from '../aiAgent/mcpBridge';
import { setAgentEnabled, setExternalPolicy, getExternalPolicy, setToolPolicy } from '../aiAgent/prefs';

const RESOURCE = { uri: 'horosa://chart/local-1', mimeType: 'text/plain', text: '【案例】张三' };
const deps = ()=>({
	exportToolManifest: ()=>[{ name: 'list_records', level: 'read', description: 'd', inputSchema: { type: 'object' } }],
	runTool: async ()=>({ ok: true, data: { rows: [] } }),
	listResources: async ()=>[{ uri: RESOURCE.uri, name: '命盘', mimeType: 'text/plain' }],
	listResourceTemplates: ()=>[],
	readResource: async ()=>RESOURCE,
	listPrompts: async ()=>[{ name: 'p1' }],
	getPrompt: async ()=>({ description: 'd', messages: [{ role: 'user', content: { type: 'text', text: 'x' } }] }),
});
const callText = (rsp)=>JSON.parse(rsp.result.content[0].text);

beforeEach(()=>{
	window.localStorage.clear();
	__resetMcpBridgeForTests();
	setAgentEnabled(true);
});

describe('R3 资源面受限流', ()=>{
	it('🔴 R3 maxCallsPerMinute=2 下第 3 次 resources/read → E_LIMIT / -32004', async ()=>{
		// 当前代码为何红:mcpBridge.js:93-113 的 resources/list、resources/templates/list、resources/read、
		// prompts/list、prompts/get 五个分支在 tools/call(:131 才调 checkExternalLimits)之前就 return 了 ——
		// 外部客户端把 resources/read 当无限带宽的读盘接口打,一条限流也吃不到。
		expect(setExternalPolicy({ maxCallsPerMinute: 2 }).maxCallsPerMinute).toBe(2);
		const d = deps();
		const a = await handleAgentToolRequest({ id: 1, method: 'resources/read', params: { uri: RESOURCE.uri }, clientName: 'codex' }, d);
		const b = await handleAgentToolRequest({ id: 2, method: 'resources/read', params: { uri: RESOURCE.uri }, clientName: 'codex' }, d);
		expect(a.ok).toBe(true);
		expect(b.ok).toBe(true);
		const c = await handleAgentToolRequest({ id: 3, method: 'resources/read', params: { uri: RESOURCE.uri }, clientName: 'codex' }, d);
		expect(c.ok).toBe(false);
		expect(c.error.code).toBe(-32004);
		expect(`${c.error.message}`).toContain('上限');
	});

	it('🔴 R3b resources/list 与 prompts/list 同样计入同一分钟桶', async ()=>{
		// 当前代码为何红:同上 —— 五个只读分支全部绕过 checkExternalLimits(mcpBridge.js:93-113)。
		setExternalPolicy({ maxCallsPerMinute: 2 });
		const d = deps();
		await handleAgentToolRequest({ id: 1, method: 'resources/list', params: {}, clientName: 'codex' }, d);
		await handleAgentToolRequest({ id: 2, method: 'prompts/list', params: {}, clientName: 'codex' }, d);
		const third = await handleAgentToolRequest({ id: 3, method: 'resources/templates/list', params: {}, clientName: 'codex' }, d);
		expect(third.ok).toBe(false);
		expect(third.error.code).toBe(-32004);
	});
});

describe('R4 桶键与桶表', ()=>{
	it('🔴 R4a 限流不按客户端自报名分桶:三个不同 clientName 打满同一会话的分钟额度', async ()=>{
		// 当前代码为何红:mcpBridge.js:39-44 bucketOf 直接拿 `req.clientName || params.clientName`(mcpBridge.js:119)
		// 当桶键 —— 名字由外部客户端自己声明,换个名字就是一个全新的额度,限流形同虚设。
		// 正解:桶键取壳注入的会话身份(req.sessionId),自报名只作展示标签。
		setExternalPolicy({ maxCallsPerMinute: 2 });
		const d = deps();
		const one = await handleAgentToolRequest({ id: 1, method: 'tools/call', params: { name: 'list_records', arguments: {} }, sessionId: 'sess-A', clientName: 'codex' }, d);
		const two = await handleAgentToolRequest({ id: 2, method: 'tools/call', params: { name: 'list_records', arguments: {} }, sessionId: 'sess-A', clientName: 'claude-code' }, d);
		expect(callText(one).ok).toBe(true);
		expect(callText(two).ok).toBe(true);
		const three = await handleAgentToolRequest({ id: 3, method: 'tools/call', params: { name: 'list_records', arguments: {} }, sessionId: 'sess-A', clientName: '我是第三个名字' }, d);
		expect(callText(three).ok).toBe(false);
		expect(callText(three).code).toBe('E_LIMIT');
	});

	it('🔴 R4b 不同会话各自独立计额(限流是按会话,不是全局一把)', async ()=>{
		// 当前代码为何红:同上 —— 桶键只认自报名,同名不同会话被并到一个桶(此例三条全同名 → 第三条被误限)。
		setExternalPolicy({ maxCallsPerMinute: 1 });
		const d = deps();
		const a = await handleAgentToolRequest({ id: 1, method: 'tools/call', params: { name: 'list_records', arguments: {} }, sessionId: 'sess-1', clientName: 'codex' }, d);
		const b = await handleAgentToolRequest({ id: 2, method: 'tools/call', params: { name: 'list_records', arguments: {} }, sessionId: 'sess-2', clientName: 'codex' }, d);
		const c = await handleAgentToolRequest({ id: 3, method: 'tools/call', params: { name: 'list_records', arguments: {} }, sessionId: 'sess-3', clientName: 'codex' }, d);
		expect(callText(a).ok).toBe(true);
		expect(callText(b).ok).toBe(true);
		expect(callText(c).ok).toBe(true);
	});

	it('🔴 R4c 桶表有界(LRU 64):一万个不同桶键 churn 后表长不无限增长', async ()=>{
		// 当前代码为何红:mcpBridge.js:38 `const clientBuckets = new Map()` 只增不减(pruneBucket 只裁桶内时间戳,
		// 从不删桶本身)—— 外部客户端每次换个身份就多一个常驻条目,一万次 churn = 一万个 Map 条目。
		// 判别向量:LRU 上限 64 时,最早那个键必被挤掉 → 它的已用额度随之清零(再调一次应放行)。
		const policy = { ...getExternalPolicy(), maxCallsPerMinute: 1, maxAdditivePerHour: 100 };
		expect(checkExternalLimits('bucket-0', 'read', policy).ok).toBe(true);
		expect(checkExternalLimits('bucket-0', 'read', policy).ok).toBe(false);   // 额度已用完(判别力:确实在计数)
		for(let i = 1; i <= 10000; i++){
			checkExternalLimits(`bucket-${i}`, 'read', policy);
		}
		expect(checkExternalLimits('bucket-0', 'read', policy).ok).toBe(true);
	});
});

describe('[进阶复查 D13·2026-09-08] 拒绝不计额', ()=>{
	it('🔴 目录外名字与禁用名字被拒后不消耗每分钟桶', async ()=>{
		setExternalPolicy({ maxCallsPerMinute: 1 });
		setToolPolicy({ deny: ['list_records'] });
		const d = { ...deps(), exportToolManifest: ()=>[{ name: 'list_records', level: 'read' }, { name: 'get_current_context', level: 'read' }] };
		expect(callText(await handleAgentToolRequest({ id: 1, method: 'tools/call', params: { name: 'nope', arguments: {} }, clientName: 'z' }, d)).code).toBe('E_TOOL_NOT_FOUND');
		expect(callText(await handleAgentToolRequest({ id: 2, method: 'tools/call', params: { name: 'list_records', arguments: {} }, clientName: 'z' }, d)).code).toBe('E_APPROVAL_DENIED');
		const ok = await handleAgentToolRequest({ id: 3, method: 'tools/call', params: { name: 'get_current_context', arguments: {} }, clientName: 'z' }, d);
		expect(ok.result.isError).toBe(false);
		const lim = await handleAgentToolRequest({ id: 4, method: 'tools/call', params: { name: 'get_current_context', arguments: {} }, clientName: 'z' }, d);
		expect(callText(lim).code).toBe('E_LIMIT');
	});
});
