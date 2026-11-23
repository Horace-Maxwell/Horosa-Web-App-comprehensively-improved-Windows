// 开关关着的内置工具,外部客户端直呼其名回 E_TOOL_DISABLED 并说「开哪个开关、在哪开」(此前回「未知工具」,
//   分不清拼错名字还是没开开关);真没有的名字 / 外部服务器工具仍是 E_TOOL_NOT_FOUND;两种都不进 runTool。
import { handleAgentToolRequest, __resetMcpBridgeForTests } from '../aiAgent/mcpBridge';
import { registerBuiltinTools } from '../aiTools';
import { exportToolManifest, runTool, disabledToolInfo, registerTool, __resetToolsForTests } from '../aiTools/registry';
import { setAgentEnabled, setExternalPolicy } from '../aiAgent/prefs';
import { switchHintText } from '../aiTools/switchHints';

const bodyOf = (r)=>JSON.parse(r.result.content[0].text);
beforeEach(()=>{ window.localStorage.clear(); __resetToolsForTests(); __resetMcpBridgeForTests(); registerBuiltinTools(); setAgentEnabled(true); setExternalPolicy({ approval: 'auto' }); });
afterEach(()=>{ delete globalThis.__HOROSA_HEADLESS_STORE__; setAgentEnabled(false); });

it('桥:关着的内置工具 → E_TOOL_DISABLED + 开关名;乱名 / ext_* 仍 E_TOOL_NOT_FOUND;都不执行', async ()=>{
	registerTool({ name: 'ext_demo_off', level: 'read', origin: 'external', enabled: ()=>false, description: 'd', inputSchema: { type: 'object', additionalProperties: false, properties: {} }, run: async ()=>({ ok: true }) });
	const deps = { exportToolManifest, disabledToolInfo, runTool: jest.fn(runTool) };
	const call = async (name)=>bodyOf(await handleAgentToolRequest({ id: 1, method: 'tools/call', params: { name, arguments: {} }, clientName: 'c' }, deps));
	const ws = await call('web_search');
	expect(ws.code).toBe('E_TOOL_DISABLED');
	expect(ws.message).toContain('「联网检索」面板的总开关');
	const ra = await call('run_analysis');
	expect(ra.code).toBe('E_TOOL_DISABLED');
	expect(ra.message).toContain('无头分析出口');
	for(const n of ['delete_everything', 'ext_nothing', 'ext_demo_off']){ expect(`${n}:${(await call(n)).code}`).toBe(`${n}:E_TOOL_NOT_FOUND`); }
	expect(deps.runTool).not.toHaveBeenCalled();
});

it('无头模式:有终端开关的给命令,没有的如实说只在桌面 App;任开其一用「或」', ()=>{
	globalThis.__HOROSA_HEADLESS_STORE__ = {};
	expect(switchHintText('headless')).toBe('要用须用户本人在终端执行 ./horosa config headless-analysis on');
	expect(switchHintText(['headless', 'privateRead'])).toBe('要用须用户本人在终端执行 ./horosa config headless-analysis on 与 ./horosa config private-read on');
	expect(switchHintText('webSearch')).toContain('无头模式没有这个开关');
	expect(switchHintText('goal')).toBe('要用须用户本人在终端执行 ./horosa config goal-tasks on');
	expect(switchHintText(['webSearch', 'headless'], 'any')).toBe('要用须用户本人在终端执行 ./horosa config headless-analysis on');
	delete globalThis.__HOROSA_HEADLESS_STORE__;
	expect(switchHintText('goal')).toBe('要用须用户在星阙「进阶」里打开 「AI 助手行动能力」面板的「目标任务」');
	expect(switchHintText('nope')).toBe('');
});

it('直调 runTool 同一句;每件声明了开关的内置工具都带 disabledHint(漏写 = 外部客户端又只看到泛泛一句)', async ()=>{
	const r = await runTool('web_fetch', { url: 'https://example.com' }, { origin: 'in-app' });
	expect(r.code).toBe('E_TOOL_DISABLED');
	expect(r.message).toContain('「网页读取」');
	const { listTools } = require('../aiTools/registry');
	const ENV_GATED = ['save_document', 'check_new_version'];   // 环境能力(导出目录 / 壳层),不是用户开关
	const missing = listTools().filter((d)=>d.origin !== 'external' && typeof d.enabled === 'function' && typeof d.disabledHint !== 'function' && ENV_GATED.indexOf(d.name) < 0).map((d)=>d.name);
	expect(missing).toEqual([]);
	expect(()=>registerTool({ name: 'x_hint_only', level: 'read', disabledHint: ()=>'x', description: 'd', inputSchema: { type: 'object' }, run: async ()=>({ ok: true }) })).toThrow(/disabledHint/);
});

it('定时任务:无头常驻服务有调度器 —— 开关开了就列;关着时给终端命令(./horosa config scheduler on)', async ()=>{
	const { setSchedulerEnabled } = require('../aiAgent/prefs');
	setSchedulerEnabled(true);
	const { listTools } = require('../aiTools/registry');
	const st = listTools().find((d)=>d.name === 'schedule_task');
	expect(st.enabled()).toBe(true);
	globalThis.__HOROSA_HEADLESS_STORE__ = {};
	expect(st.enabled()).toBe(true);
	setSchedulerEnabled(false);
	expect(st.enabled()).toBe(false);
	expect(st.disabledHint()).toContain('./horosa config scheduler on');
	const gt = listTools().find((d)=>d.name === 'create_goal_task');
	expect(gt.disabledHint()).toContain('./horosa config goal-tasks on');
});
