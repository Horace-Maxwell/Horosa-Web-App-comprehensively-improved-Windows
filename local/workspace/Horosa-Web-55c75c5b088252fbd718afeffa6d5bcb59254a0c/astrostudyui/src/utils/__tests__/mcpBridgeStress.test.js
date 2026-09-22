// AI 助手·外部桥压测:300 条乱序请求(含在途队列/中途关开关/巨型输出)→ 每条恰回一次、序保持、截断守上限。
import { bindMcpBridge, handleAgentToolRequest, __resetMcpBridgeForTests, MCP_TEXT_HARD_LIMIT } from '../aiAgent/mcpBridge';
import { AGENT_ENABLED_KEY, setAgentEnabled } from '../aiAgent/prefs';
import * as desktop from '../aiAnalysisDesktop';
const ANY_MAN = [{ name: 'fine', level: 'read' }, { name: 'hang', level: 'read' }, { name: 'x', level: 'read' }];   // [D13] 桥不再执行目录外名字


const flush = async (n = 8)=>{ for(let i = 0; i < n; i++){ await new Promise((r)=>setTimeout(r, 0)); } };

beforeEach(()=>{ window.localStorage.clear(); __resetMcpBridgeForTests(); jest.restoreAllMocks(); });

describe('队列压测', ()=>{
	it('🔴 300 条请求每条恰回一次且按投递序;关开关期间新请求进队列,再开后补读', async ()=>{
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
		// 关开关前投递的 200 条严格按序;在途队列的 100 条被丢弃(壳已判失败);再开后的 100 条按序
		expect(ids.slice(0, 200)).toEqual(Array.from({ length: 200 }, (_, k)=>k));
		expect(ids.slice(200)).toEqual(Array.from({ length: 100 }, (_, k)=>300 + k));
		expect(ids.some((id)=>id >= 200 && id < 300)).toBe(false);
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
	it('缺省预算 120s、钳位 1s..600s、页面先于壳 3s 回话', ()=>{
		const { bridgeTimeoutMs } = require('../aiAgent/withTimeout');
		expect(bridgeTimeoutMs(undefined)).toBe(117000);
		expect(bridgeTimeoutMs({ timeoutMs: 5000 })).toBe(2000);
		expect(bridgeTimeoutMs({ timeoutMs: 100 })).toBe(1000);
		expect(bridgeTimeoutMs({ timeoutMs: 9e9 })).toBe(597000);
		expect(bridgeTimeoutMs({ timeoutMs: 'abc' })).toBe(117000);
	});
});
