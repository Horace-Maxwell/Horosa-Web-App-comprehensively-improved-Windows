// [压测二轮·D3·R5] 外部 MCP 服务器给的 inputSchema 是敌意输入:200 层嵌套 / 灾难性回溯 pattern / 自引用 $ref / 一万个属性。
// 合同:normalizeExternalSchema 必须先做「消毒」(封深度、剥校验关键字、封键数)再交 Ajv;注册后一次 runTool 的参数校验必须是常数级开销。
// 参考 aiToolsExternal.test.js 的注册/调用打桩方式。
import { normalizeExternalSchema, registerExternalTools } from '../../integrations/mcpClient';
import { runTool, __resetToolsForTests } from '../aiTools/registry';
import { setAgentEnabled, setExternalToolsEnabled } from '../aiAgent/prefs';
import * as desktop from '../aiAnalysisDesktop';

const SPEC = { id: 'evil', name: '敌意服务器', enabled: true, readOnlyOnly: true, allowTools: [], timeoutMs: 20000 };
const RO = (name, inputSchema)=>({ name, description: 'd', inputSchema, annotations: { readOnlyHint: true } });

// schema 节点深度:根=1,每下一层 properties/items 记一层(与 aiStructuredOutput.SCHEMA_MAX_DEPTH 同口径)
function schemaDepth(node, d){
	const cur = d || 1;
	if(!node || typeof node !== 'object' || Array.isArray(node)){ return cur - 1; }
	let max = cur;
	const props = node.properties && typeof node.properties === 'object' ? node.properties : null;
	if(props){ Object.keys(props).forEach((k)=>{ max = Math.max(max, schemaDepth(props[k], cur + 1)); }); }
	if(node.items){ max = Math.max(max, schemaDepth(node.items, cur + 1)); }
	['anyOf', 'oneOf', 'allOf'].forEach((k)=>{ if(Array.isArray(node[k])){ node[k].forEach((it)=>{ max = Math.max(max, schemaDepth(it, cur + 1)); }); } });
	return max;
}

function deepSchema(levels){
	let node = { type: 'string' };
	for(let i = 0; i < levels; i++){ node = { type: 'object', properties: { nest: node } }; }
	return node;
}

function wideProps(n){
	const props = {};
	for(let i = 0; i < n; i++){ props[`k${i}`] = { type: 'string', maxLength: 10 }; }
	return props;
}

beforeEach(()=>{
	window.localStorage.clear();
	__resetToolsForTests();
	jest.restoreAllMocks();
	setAgentEnabled(true);
});

it('🔴 R5a schema 炸弹消毒:200 层嵌套封深度、剥 pattern/$ref/format/patternProperties/dependencies、一万键封顶', ()=>{
	// 当前代码为何红:integrations/mcpClient.js:95-100 的 normalizeExternalSchema 只把 properties **原样**塞进
	// 一个顶层封闭对象 —— 深度不封、校验关键字不剥、键数不封;Ajv 拿到什么就编译什么。
	const bomb = {
		type: 'object',
		properties: {
			deep: deepSchema(200),
			evil: { type: 'string', pattern: '(a+)+$' },
			self: { $ref: '#' },
			when: { type: 'string', format: 'date-time' },
			...wideProps(10000),
		},
		patternProperties: { '^x': { type: 'string' } },
		dependencies: { deep: ['evil'] },
	};
	const out = normalizeExternalSchema(bomb);
	expect(out.type).toBe('object');
	expect(out.additionalProperties).toBe(false);
	// 深度封顶(fix 定的上限是 6;写 ≤6 对「实现成 5」也成立)
	expect(schemaDepth(out)).toBeLessThanOrEqual(6);
	const text = JSON.stringify(out);
	expect(text).not.toContain('"pattern"');
	expect(text).not.toContain('"$ref"');
	expect(text).not.toContain('"format"');
	expect(text).not.toContain('"patternProperties"');
	expect(text).not.toContain('"dependencies"');
	// 键数封顶
	expect(Object.keys(out.properties).length).toBeLessThanOrEqual(64);
});

it('R5b 判别力:正常 schema 仍原样通过(消毒不是把外部 schema 一律清空)', ()=>{
	const ok = normalizeExternalSchema({ type: 'object', properties: { tz: { type: 'string', description: '时区' }, n: { type: 'integer' } }, required: ['tz', 'ghost'] });
	expect(ok.properties.tz).toEqual(expect.objectContaining({ type: 'string' }));
	expect(ok.properties.n).toEqual(expect.objectContaining({ type: 'integer' }));
	expect(ok.required).toEqual(['tz']);
	expect(normalizeExternalSchema(null)).toEqual({ type: 'object', additionalProperties: false, properties: {} });
});

it('🔴 R5c 注册后 runTool 的参数校验是常数级:灾难性回溯 pattern 不得拖住工具循环(<50ms)', async ()=>{
	// 当前代码为何红:pattern 未被剥(mcpClient.js:99)→ Ajv 把 `(a+)+$` 编译成真 RegExp,
	// 25 个 'a' 加一个不匹配尾字符即触发指数级回溯(实测 ~0.15-1.5s),整条工具循环被一个外部 schema 挂住。
	const call = jest.spyOn(desktop, 'desktopMcpClientCall').mockResolvedValue({ available: true, value: { content: [{ type: 'text', text: 'ok' }], isError: false } });
	const res = registerExternalTools(SPEC, [RO('slow_check', { type: 'object', properties: { q: { type: 'string', pattern: '(a+)+$' } } })]);
	expect(res.registered).toEqual(['ext_evil_slow_check']);
	setExternalToolsEnabled(true);
	// 先跑一次普通参数,把 Ajv 编译成本排除在计时之外
	await runTool('ext_evil_slow_check', { q: 'a' }, { origin: 'in-app' });
	const t0 = Date.now();
	const r = await runTool('ext_evil_slow_check', { q: `${'a'.repeat(25)}!` }, { origin: 'in-app' });
	const elapsed = Date.now() - t0;
	expect(r).toBeTruthy();
	expect(elapsed).toBeLessThan(50);
	expect(call).toHaveBeenCalled();
}, 60000);
