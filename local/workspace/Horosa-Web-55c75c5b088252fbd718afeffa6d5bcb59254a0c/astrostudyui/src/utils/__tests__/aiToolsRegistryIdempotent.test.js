// [压测二轮·D3·R6] 每开一个 Turn 就整表覆盖注册一次内置工具:18 条 console.warn 刷屏 + Ajv 校验器缓存被清空(每 Turn 重编译一遍全部 schema)。
// 合同:registerBuiltinTools 幂等 —— 同一份定义再注册一次应短路(零 warn、工具定义同引用、validators 不失效)。
import { createAgentTurn } from '../aiAgent/runtime';
import { registerBuiltinTools } from '../aiTools';
import { getTool, runTool, listTools, __resetToolsForTests } from '../aiTools/registry';
import { setAgentEnabled } from '../aiAgent/prefs';

const AjvMod = require('ajv');
const AjvCls = AjvMod && AjvMod.default ? AjvMod.default : AjvMod;

const DUP_WARN = '覆盖重复注册';
const dupWarns = (spy)=>spy.mock.calls.filter((c)=>`${c[0] || ''}`.indexOf(DUP_WARN) >= 0);

beforeEach(()=>{
	window.localStorage.clear();
	__resetToolsForTests();
	jest.restoreAllMocks();
	setAgentEnabled(true);
});

it('🔴 R6a createAgentTurn ×3:「覆盖重复注册」warn 数应为 0,且工具定义保持同引用', ()=>{
	// 当前代码为何红:runtime.js:83 每次 createAgentTurn 都 `registerBuiltinTools()`;
	// aiTools/index.js:26 无条件 forEach(registerTool),registry.js:42-45 对已有名字先 console.warn 再
	// `tools.set(name, {...def})` + `validators.delete(name)` —— 每个 Turn 刷 18 条 warn 且换掉全部定义对象。
	const warn = jest.spyOn(console, 'warn').mockImplementation(()=>{});
	createAgentTurn({});
	const first = getTool('list_records');
	const count = listTools().length;
	expect(first).toBeTruthy();
	expect(count).toBeGreaterThanOrEqual(13);
	createAgentTurn({});
	createAgentTurn({});
	expect(dupWarns(warn).length).toBe(0);
	expect(listTools().length).toBe(count);   // 判别力:确实每次都跑了注册路径(数量恒定,不是没注册)
	expect(getTool('list_records')).toBe(first);
});

it('🔴 R6b Ajv 校验器缓存不被 Turn 创建清空:第二次同工具调用不再重编译 schema', async ()=>{
	// 当前代码为何红:registry.js:44 `validators.delete(name)` 随每次覆盖注册执行 →
	// 下一次 runTool 走 registry.js:80-82 重新 `getAjv().compile(def.inputSchema)`。
	jest.spyOn(console, 'warn').mockImplementation(()=>{});
	const compile = jest.spyOn(AjvCls.prototype, 'compile');
	createAgentTurn({});
	await runTool('list_records', { kind: 'all' }, { origin: 'in-app' });
	expect(compile.mock.calls.length).toBeGreaterThanOrEqual(1);   // 判别力:首次确实编译了
	compile.mockClear();
	await runTool('list_records', { kind: 'all' }, { origin: 'in-app' });
	expect(compile.mock.calls.length).toBe(0);                     // 同一 Turn 内本来就有缓存
	createAgentTurn({});
	createAgentTurn({});
	await runTool('list_records', { kind: 'all' }, { origin: 'in-app' });
	expect(compile.mock.calls.length).toBe(0);
});

it('R6c 判别力:显式换掉定义(不同对象)时仍旧覆盖并 warn —— 幂等短路只对「同一份定义」生效', ()=>{
	const warn = jest.spyOn(console, 'warn').mockImplementation(()=>{});
	registerBuiltinTools();
	const { registerTool } = require('../aiTools/registry');
	registerTool({ name: 'list_records', level: 'read', undoKind: 'none', description: '换过的定义', inputSchema: { type: 'object', properties: {} }, run: async ()=>({ ok: true }) });
	expect(dupWarns(warn).length).toBe(1);
	expect(getTool('list_records').description).toBe('换过的定义');
});

it('🔴 D18 目录变更订阅:真注册/注销各发一次;同一份定义幂等再注册不发;退订后不再收', ()=>{
	const { registerTool, unregisterTool, subscribeToolCatalog } = require('../aiTools/registry');
	const fn = jest.fn();
	const off = subscribeToolCatalog(fn);
	const def = { name: 'ext_probe_x', level: 'read', description: 'd', inputSchema: { type: 'object' }, run: async ()=>({ ok: true }), origin: 'external' };
	registerTool(def);
	registerTool(def);
	expect(fn).toHaveBeenCalledTimes(1);
	expect(fn.mock.calls[0][0]).toEqual({ op: 'register', name: 'ext_probe_x', origin: 'external' });
	expect(unregisterTool('ext_probe_x')).toBe(true);
	expect(fn).toHaveBeenCalledTimes(2);
	expect(fn.mock.calls[1][0].op).toBe('unregister');
	off();
	registerTool(def);
	expect(fn).toHaveBeenCalledTimes(2);
	unregisterTool('ext_probe_x');
});
