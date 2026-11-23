// AI 助手·外部桥压测:300 条乱序请求(含在途队列/中途关开关/巨型输出)→ 每条恰回一次、序保持、截断守上限。
import { bindMcpBridge, handleAgentToolRequest, __resetMcpBridgeForTests, MCP_TEXT_HARD_LIMIT } from '../aiAgent/mcpBridge';
import { AGENT_ENABLED_KEY, setAgentEnabled } from '../aiAgent/prefs';
import * as desktop from '../aiAnalysisDesktop';
const ANY_MAN = [{ name: 'fine', level: 'read' }, { name: 'hang', level: 'read' }, { name: 'x', level: 'read' }];   // 桥不再执行目录外名字


const flush = async (n = 8)=>{ for(let i = 0; i < n; i++){ await new Promise((r)=>setTimeout(r, 0)); } };

beforeEach(()=>{ window.localStorage.clear(); __resetMcpBridgeForTests(); jest.restoreAllMocks(); });

describe('队列压测', ()=>{
	it('🔴 300 条请求每条恰回一次、同名工具保持到达序;关开关期间新请求进队列,再开后补读', async ()=>{
		jest.spyOn(desktop, 'isDesktopBridgeAvailable').mockReturnValue(true);
		const replies = [];
		jest.spyOn(desktop, 'invokeDesktopCommand').mockImplementation(async (cmd, args)=>{ if(cmd === 'agent_tool_result_command'){ replies.push(args); } return {}; });
		window.localStorage.setItem(AGENT_ENABLED_KEY, '1');
		bindMcpBridge();
		const methods = ['tools/list', 'ping', 'tools/call', 'nope'];
		for(let i = 0; i < 200; i++){
			window.__horosaAgentTool({ id: i, method: methods[i % 4], params: { name: i % 2 ? 'list_records' : 'get_settings', arguments: i % 2 ? { kind: 'all' } : { facet: 'app' } } });
		}
		setAgentEnabled(false);
		expect(window.__horosaAgentTool).toBeUndefined();
		(window.__horosaPendingAgentTools = window.__horosaPendingAgentTools || []).push(...Array.from({ length: 100 }, (_, k)=>({ id: 200 + k, method: 'tools/list' })));
		setAgentEnabled(true);
		for(let i = 0; i < 100; i++){ window.__horosaAgentTool({ id: 300 + i, method: 'tools/list' }); }
		for(let i = 0; i < 400; i++){ await flush(3); if(replies.length >= 300){ break; } }
		expect(replies.length).toBe(300);
		const ids = replies.map((r)=>r.id);
		expect(new Set(ids).size).toBe(300);
		// 只读面与只读工具并发(≤3)⇒ 不再全局按投递序;合同是:每条恰回一次、在途队列的 100 条被丢弃(壳已判失败)、
		//   同名工具一个一个来(这里的 tools/call 全是 get_settings ⇒ 回包序 = 投递序)
		expect(ids.filter((id)=>id < 200).sort((a, b)=>a - b)).toEqual(Array.from({ length: 200 }, (_, k)=>k));
		expect(ids.filter((id)=>id >= 300).sort((a, b)=>a - b)).toEqual(Array.from({ length: 100 }, (_, k)=>300 + k));
		expect(ids.some((id)=>id >= 200 && id < 300)).toBe(false);
		const sameName = ids.filter((id)=>id < 200 && id % 4 === 2);
		expect(sameName).toEqual(sameName.slice().sort((a, b)=>a - b));
		replies.forEach((r)=>{ if(r.ok){ expect(r.result).toBeTruthy(); }else{ expect(typeof r.error.code).toBe('number'); } });
		const errs = replies.filter((r)=>!r.ok).map((r)=>r.error.code);
		expect(errs.every((c)=>c === -32601)).toBe(true);
	});
	it('巨型工具输出守硬上限;禁用态 -32001 不执行', async ()=>{
		window.localStorage.setItem(AGENT_ENABLED_KEY, '1');
		const big = await handleAgentToolRequest({ id: 1, method: 'tools/call', params: { name: 'x', arguments: {} } }, { exportToolManifest: ()=>ANY_MAN, runTool: async ()=>({ ok: true, data: { blob: 'x'.repeat(MCP_TEXT_HARD_LIMIT * 2) } }) });
		expect(big.result.content[0].text.length).toBeLessThanOrEqual(MCP_TEXT_HARD_LIMIT + 200);
		expect(big.result.structuredContent).toBeUndefined();
		window.localStorage.setItem(AGENT_ENABLED_KEY, '0');
		const run = jest.fn();
		const off = await handleAgentToolRequest({ id: 2, method: 'tools/call', params: { name: 'x' } }, { exportToolManifest: ()=>ANY_MAN, runTool: run });
		expect(off.error.code).toBe(-32001);
		expect(run).not.toHaveBeenCalled();
	});
});

describe('外部桥挂死工具(压测实抓 R1:桥串行队列无超时)', ()=>{
	it('🔴 永不 settle 的工具在 _meta.timeoutMs 内被超时收口(E_TOOL_TIMEOUT),后续调用照常应答', async ()=>{
		window.localStorage.setItem(AGENT_ENABLED_KEY, '1');
		const deps = { exportToolManifest: ()=>ANY_MAN, runTool: jest.fn((name)=>name === 'hang' ? new Promise(()=>{}) : Promise.resolve({ ok: true, data: { fine: true } })) };
		const t0 = Date.now();
		const hung = await handleAgentToolRequest({ id: 1, method: 'tools/call', params: { name: 'hang', arguments: {}, _meta: { timeoutMs: 1000 } } }, deps);
		expect(Date.now() - t0).toBeLessThan(4000);
		expect(hung.ok).toBe(true);
		expect(hung.result.isError).toBe(true);
		expect(hung.result.content[0].text).toContain('E_TOOL_TIMEOUT');
		const next = await handleAgentToolRequest({ id: 2, method: 'tools/call', params: { name: 'fine', arguments: {} } }, deps);
		expect(next.ok).toBe(true);
		expect(next.result.isError).toBe(false);
		expect(next.result.structuredContent).toEqual({ fine: true });
	});
	it('缺省预算 120s、钳位 1s..30 分钟、页面先于壳 3s 回话', ()=>{
		const { bridgeTimeoutMs } = require('../aiAgent/withTimeout');
		expect(bridgeTimeoutMs(undefined)).toBe(117000);
		expect(bridgeTimeoutMs({ timeoutMs: 5000 })).toBe(2000);
		expect(bridgeTimeoutMs({ timeoutMs: 100 })).toBe(1000);
		expect(bridgeTimeoutMs({ timeoutMs: 9e9 })).toBe(1797000);
		expect(bridgeTimeoutMs({ timeoutMs: 'abc' })).toBe(117000);
		expect(bridgeTimeoutMs({ timeoutMs: 0 })).toBe(117000);
	});
	it('🔴 客户端没给预算:按工具声明的 timeoutMs 等(声明得不比缺省长 / 没声明 = 120s);给了就按客户端的', ()=>{
		const { bridgeTimeoutMs, bridgeFallbackMs } = require('../aiAgent/withTimeout');
		// 与桌面壳投来的同值(壳按声明值等,页面减 3 s 先回话)
		expect(bridgeTimeoutMs(undefined, bridgeFallbackMs(1800000))).toBe(1797000);
		expect(bridgeTimeoutMs({}, bridgeFallbackMs(600000))).toBe(597000);
		expect(bridgeTimeoutMs({}, bridgeFallbackMs(30000))).toBe(117000);
		expect(bridgeTimeoutMs({}, bridgeFallbackMs(undefined))).toBe(117000);
		expect(bridgeTimeoutMs({}, bridgeFallbackMs(9e9))).toBe(1797000);
		expect(bridgeTimeoutMs({ timeoutMs: 10000 }, bridgeFallbackMs(1800000))).toBe(7000);
		// 桥真的这么接(读源:缺省来自这件工具的声明)
		const src = require('fs').readFileSync(require('path').join(__dirname, '../aiAgent/mcpBridge.js'), 'utf8');
		expect(src).toMatch(/bridgeTimeoutMs\(params\._meta, bridgeFallbackMs\(/);
	});
	it('🔴 声明得比缺省长的工具:目录条目带 io.horosa/timeoutMs(桌面壳据此等);其余不带', ()=>{
		const { buildToolManifest } = require('../aiTools/catalog');
		const schema = { type: 'object', properties: {} };
		const man = buildToolManifest([
			{ name: 'long_one', description: 'x', inputSchema: schema, level: 'read', timeoutMs: 600000 },
			{ name: 'short_one', description: 'x', inputSchema: schema, level: 'read', timeoutMs: 60000 },
			{ name: 'plain', description: 'x', inputSchema: schema, level: 'read' },
			{ name: 'asks', description: 'x', inputSchema: schema, level: 'read', category: 'interactive', timeoutMs: 300000 },
		]);
		expect(man[0]._meta).toEqual({ 'io.horosa/timeoutMs': 600000 });
		expect(man[1]._meta).toBeUndefined();
		expect(man[2]._meta).toBeUndefined();
		expect(man[3]._meta).toEqual({ 'anthropic/requiresUserInteraction': true, 'io.horosa/timeoutMs': 300000 });
		// 键名与壳同一个
		// horosa_win_shell_const_v1(Windows 侧移植适配):Windows 壳是 Electron,同名常量住在 desktop_installer_bundle/electron/mcp-core.js
		// (纯 JS,直接 require 取值)。Tauri 源在就照原样读;不在就与 Electron 壳对拍同一个键名、同一个硬顶,判据零放宽。
		const tauriShell = require('path').join(__dirname, '../../../../../Horosa_Desktop_Installer/src-tauri/src/mcp_server.rs');
		if(require('fs').existsSync(tauriShell)){
			const shell = require('fs').readFileSync(tauriShell, 'utf8');
			expect(shell).toMatch(/TOOL_TIMEOUT_META_KEY: &str = "io\.horosa\/timeoutMs"/);
			expect(shell).toMatch(/MAX_TOOL_TIMEOUT: Duration = Duration::from_secs\(1800\)/);
		}else{
			const core = require(require('path').join(__dirname, '../../../../../../../desktop_installer_bundle/electron/mcp-core.js'));
			expect(core.TOOL_TIMEOUT_META_KEY).toBe('io.horosa/timeoutMs');
			expect(core.MAX_TOOL_TIMEOUT_MS).toBe(1800 * 1000);
			// 壳按目录条目里的声明等:比缺省长的认(长的 600 s、要人确认的 300 s),没声明 / 不比缺省长的不认
			expect(['long_one', 'short_one', 'plain', 'asks'].map((n)=>core.declaredTimeoutIn(man, n))).toEqual([600000, null, null, 300000]);
		}
	});
});
