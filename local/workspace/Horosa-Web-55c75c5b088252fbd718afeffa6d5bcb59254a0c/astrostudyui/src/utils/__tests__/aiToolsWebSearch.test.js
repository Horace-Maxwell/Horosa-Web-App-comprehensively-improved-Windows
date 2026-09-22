// 联网检索工具(P7)合同:默认关不进目录、调用即 E_TOOL_DISABLED;开但无档案 → E_WEB_SEARCH_NOT_CONFIGURED;
// 有档案 → 走 Java 端点、结果带来源 URL 与「未经核实」;上游失败 → E_WEB_SEARCH_FAILED 且消息不含 Key;工具是 read 级、可缓存、零撤销。
import def from '../aiTools/tools/webSearch';
import { registerBuiltinTools } from '../aiTools';
import { runTool, exportToolManifest, __resetToolsForTests } from '../aiTools/registry';
import { setAgentEnabled, setWebSearchEnabled } from '../aiAgent/prefs';
import { AI_ANALYSIS_STORES, clearStore } from '../aiAnalysisStore';
import { saveSearchProfile, WEB_SEARCH_UNVERIFIED, engineMeta, WEB_SEARCH_ENGINES } from '../../integrations/webSearch';
import * as services from '../../services/aianalysis';

beforeEach(async ()=>{
	window.localStorage.clear(); __resetToolsForTests(); jest.restoreAllMocks(); setAgentEnabled(true);
	await clearStore(AI_ANALYSIS_STORES.integrationProfiles);
});

it('目录形状:read / external / 可缓存 / 零撤销;query 必填且顶层封闭', ()=>{
	expect(def.name).toBe('web_search');
	expect(def.level).toBe('read');
	expect(def.category).toBe('external');
	expect(def.undoKind).toBe('none');
	expect(def.cacheable).toBe(true);
	expect(typeof def.enabled).toBe('function');
	expect(def.inputSchema.required).toEqual(['query']);
	expect(def.inputSchema.additionalProperties).toBe(false);
	expect(def.inputSchema.properties.maxResults.maximum).toBe(10);
	expect(WEB_SEARCH_ENGINES.map((e)=>e.value)).toEqual(['tavily', 'brave', 'exa', 'searxng', 'custom']);
	expect(engineMeta('searxng').needsKey).toBe(false);
	expect(engineMeta('nope')).toBe(null);
});

it('🔴 默认关:不进 manifest;调用即 E_TOOL_DISABLED 且零请求', async ()=>{
	const spy = jest.spyOn(services, 'requestWebSearch');
	registerBuiltinTools();
	expect(exportToolManifest().some((t)=>t.name === 'web_search')).toBe(false);
	const r = await runTool('web_search', { query: 'x' }, { origin: 'in-app' });
	expect(r.code).toBe('E_TOOL_DISABLED');
	expect(spy).not.toHaveBeenCalled();
});

it('🔴 开但没配置 → E_WEB_SEARCH_NOT_CONFIGURED 零请求;缺 Key 的档案同样拒', async ()=>{
	setWebSearchEnabled(true);
	registerBuiltinTools();
	expect(exportToolManifest().some((t)=>t.name === 'web_search')).toBe(true);
	const spy = jest.spyOn(services, 'requestWebSearch');
	expect((await runTool('web_search', { query: 'x' }, { origin: 'in-app' })).code).toBe('E_WEB_SEARCH_NOT_CONFIGURED');
	await saveSearchProfile({ engine: 'tavily', apiKey: '', enabled: true });
	expect((await runTool('web_search', { query: 'x' }, { origin: 'in-app' })).code).toBe('E_WEB_SEARCH_NOT_CONFIGURED');
	expect(spy).not.toHaveBeenCalled();
});

it('🔴 配好后:请求带引擎与 Key、结果含来源 URL 与「未经核实」;上游抛错 → E_WEB_SEARCH_FAILED 且消息不含 Key', async ()=>{
	setWebSearchEnabled(true);
	registerBuiltinTools();
	await saveSearchProfile({ engine: 'tavily', apiKey: 'tvly-SECRET-0001', enabled: true });
	const spy = jest.spyOn(services, 'requestWebSearch').mockResolvedValue({ Result: { engine: 'tavily', query: '紫微', results: [{ title: 'T', url: 'https://a.test/1', snippet: 's', publishedAt: '' }], fetchedAt: '2026-01-01T00:00:00.000Z' } });
	const ok = await runTool('web_search', { query: '紫微', maxResults: 3 }, { origin: 'in-app' });
	expect(ok.ok).toBe(true);
	expect(ok.data.results[0].url).toBe('https://a.test/1');
	expect(ok.assumptions).toContain(WEB_SEARCH_UNVERIFIED);
	expect(ok.summary).toContain('紫微');
	const sent = spy.mock.calls[0][0];
	expect(sent.engine).toBe('tavily');
	expect(sent.apiKey).toBe('tvly-SECRET-0001');
	expect(sent.maxResults).toBe(3);
	spy.mockRejectedValue(new Error('检索服务返回 HTTP 401'));
	const bad = await runTool('web_search', { query: '紫微' }, { origin: 'in-app' });
	expect(bad.ok).toBe(false);
	expect(bad.code).toBe('E_WEB_SEARCH_FAILED');
	expect(`${bad.message}`).not.toContain('tvly-SECRET-0001');
});
