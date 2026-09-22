// [批三①] web_fetch 合同:缺省关(不进 manifest、调用即 E_TOOL_DISABLED、零出站);开=只经 services.requestWebFetch(零直连);回体归一;守卫拒绝 → E_WEB_FETCH_BLOCKED、其它 → E_WEB_FETCH_FAILED;
// 非 http(s) 前端先拒;signal 透传;标签/错误码/注册表键在位。
jest.mock('../../services/aianalysis', ()=>({ requestWebFetch: jest.fn() }));
import { requestWebFetch } from '../../services/aianalysis';
import { registerBuiltinTools } from '../aiTools';
import { runTool, exportToolManifest, __resetToolsForTests } from '../aiTools/registry';
import { setAgentEnabled, setAgentApprovalMode, setWebFetchEnabled, isWebFetchEnabled, AGENT_WEB_FETCH_KEY } from '../aiAgent/prefs';
import { runWebFetch, classifyWebFetchError, WEB_FETCH_MAX_CHARS } from '../../integrations/webFetch';
import { TOOL_ERROR_CODES } from '../aiTools/errorCodes';
import { AGENT_TOOL_LABELS } from '../aiTools/labels';
import { STORAGE_KEY_REGISTRY } from '../storageKeyRegistry';

beforeEach(()=>{ window.localStorage.clear(); __resetToolsForTests(); registerBuiltinTools(); setAgentEnabled(true); setAgentApprovalMode('never'); requestWebFetch.mockReset(); });

it('缺省关:键不存在、不进 manifest、调用即 E_TOOL_DISABLED、零出站', async ()=>{
	expect(isWebFetchEnabled()).toBe(false);
	expect(window.localStorage.getItem(AGENT_WEB_FETCH_KEY)).toBe(null);
	expect(exportToolManifest().some((t)=>t.name === 'web_fetch')).toBe(false);
	const r = await runTool('web_fetch', { url: 'https://example.com/' }, { origin: 'in-app' });
	expect(r.ok).toBe(false);
	expect(r.code).toBe('E_TOOL_DISABLED');
	expect(requestWebFetch).not.toHaveBeenCalled();
});

it('开:进目录(read/external/cacheable);回体归一 + 未经核实标记;signal 透传;maxChars 夹在 [200,20000]', async ()=>{
	setWebFetchEnabled(true);
	const def = exportToolManifest().find((t)=>t.name === 'web_fetch');
	expect(def && def.level).toBe('read');
	requestWebFetch.mockResolvedValue({ Result: { url: 'https://example.com/final', title: '假页面标题', contentType: 'text/html', text: '正文一\n第一段', truncated: true, totalChars: 9999, hops: 1, fetchedAt: '2026-09-06T00:00:00Z' } });
	const ac = new AbortController();
	const r = await runTool('web_fetch', { url: 'https://example.com/', maxChars: 500 }, { origin: 'in-app', signal: ac.signal });
	expect(r.ok).toBe(true);
	expect(r.data.title).toBe('假页面标题');
	expect(r.data.text).toBe('正文一\n第一段');
	expect(r.data.truncated).toBe(true);
	expect(r.summary).toContain('已截,全文 9999 字');
	expect(r.assumptions[0]).toContain('未经核实');
	expect(requestWebFetch).toHaveBeenCalledTimes(1);
	expect(requestWebFetch.mock.calls[0][0]).toEqual({ url: 'https://example.com/', maxChars: 500 });
	expect(requestWebFetch.mock.calls[0][1].signal).toBe(ac.signal);
	const big = await runWebFetch({ url: 'https://example.com/x', maxChars: 99999 });
	expect(requestWebFetch.mock.calls[1][0].maxChars).toBe(WEB_FETCH_MAX_CHARS);
	expect(big.ok).toBe(true);
});

it('错误分类:守卫拒绝 → E_WEB_FETCH_BLOCKED;上游失败 → E_WEB_FETCH_FAILED;非 http(s) 前端先拒不出站;空地址 E_ARGS_INVALID', async ()=>{
	setWebFetchEnabled(true);
	requestWebFetch.mockRejectedValueOnce(new Error('网页地址不允许:不允许读取本机或内网地址'));
	const b = await runWebFetch({ url: 'http://192.168.1.1/' });
	expect(b.ok).toBe(false); expect(b.code).toBe('E_WEB_FETCH_BLOCKED');
	requestWebFetch.mockRejectedValueOnce(new Error('网页返回 HTTP 503'));
	const f = await runWebFetch({ url: 'https://example.com/' });
	expect(f.code).toBe('E_WEB_FETCH_FAILED');
	const local = await runWebFetch({ url: 'file:///etc/passwd' });
	expect(local.code).toBe('E_WEB_FETCH_BLOCKED');
	expect(requestWebFetch).toHaveBeenCalledTimes(2);
	expect((await runWebFetch({ url: '' })).code).toBe('E_ARGS_INVALID');
	expect(classifyWebFetchError('blocked by policy')).toBe('E_WEB_FETCH_BLOCKED');
	// 经注册表:schema 拒 ftp(minLength 8 + 前端拒)
	const viaTool = await runTool('web_fetch', { url: 'ftp://x.example/a' }, { origin: 'in-app' });
	expect(viaTool.ok).toBe(false);
	expect(viaTool.code).toBe('E_WEB_FETCH_BLOCKED');
});

it('标签 / 错误码 / 注册表键在位', ()=>{
	expect(AGENT_TOOL_LABELS.web_fetch).toBe('读取网页');
	expect(TOOL_ERROR_CODES.E_WEB_FETCH_BLOCKED.layer).toBe('user');
	expect(TOOL_ERROR_CODES.E_WEB_FETCH_FAILED.layer).toBe('tool');
	expect(TOOL_ERROR_CODES.E_WEB_FETCH_FAILED.retryable).toBe(false);
	expect(STORAGE_KEY_REGISTRY.some((r)=>r.key === AGENT_WEB_FETCH_KEY)).toBe(true);
});
