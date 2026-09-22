// 外部 MCP 工具接入(P6)合同:slug 与 Rust 同向量;只准入只读(或用户逐个列入);删除类名字一律拒;schema 包成顶层封闭;
// 总开关关 → enabled() 为假(不进 manifest、调用即 E_TOOL_DISABLED);结果带「未经核实」信封;注销只动 origin external(内置一个不掉)。
import { EXT_PREFIX, EXT_UNVERIFIED, fnv1aHex6, slugToolName, admitExternalTool, normalizeExternalSchema, registerExternalTools, unregisterExternalTools, unregisterAllExternalTools } from '../../integrations/mcpClient';
import { registerBuiltinTools } from '../aiTools';
import { runTool, exportToolManifest, listTools, __resetToolsForTests } from '../aiTools/registry';
import { setAgentEnabled, setExternalToolsEnabled, isExternalToolsEnabled } from '../aiAgent/prefs';
import * as desktop from '../aiAnalysisDesktop';

const SPEC = { id: 'time', name: '时间服务', enabled: true, readOnlyOnly: true, allowTools: [], timeoutMs: 20000 };
const RO = (name, extra)=>({ name, description: 'd', inputSchema: { type: 'object', properties: { tz: { type: 'string' } } }, annotations: { readOnlyHint: true }, ...extra });

beforeEach(()=>{ window.localStorage.clear(); __resetToolsForTests(); jest.restoreAllMocks(); setAgentEnabled(true); });

it('🔴 slug 与 Rust slug_tool_name 同向量(逐条对拍);FNV 六位十六进制稳定', ()=>{
	expect(slugToolName('time', 'get_current_time')).toBe('ext_time_get_current_time');
	expect(slugToolName('Time Server', 'Get-Current-Time')).toBe('ext_time_server_get_current_time');
	expect(slugToolName('时间', '查询')).toBe('ext_');
	expect(slugToolName('a__b', '__c__')).toBe('ext_a_b_c');
	expect(slugToolName('UPPER', 'MiXeD')).toBe('ext_upper_mixed');
	expect(slugToolName('s', '1tool')).toBe('ext_s_1tool');
	const long = slugToolName('averylongservername', 'andanevenlongertoolnamethatkeepsgoing');
	expect(long.length).toBe(48);
	expect(long.indexOf('ext_averylongservername_andaneven')).toBe(0);
	expect(long).toBe(slugToolName('averylongservername', 'andanevenlongertoolnamethatkeepsgoing'));
	expect(long).not.toBe(slugToolName('averylongservername', 'andanevenlongertoolnamethatkeepsgoinX'));
	expect(fnv1aHex6('ext_abc')).toMatch(/^[0-9a-f]{6}$/);
	expect(fnv1aHex6('ext_abc')).toBe(fnv1aHex6('ext_abc'));
	expect(fnv1aHex6('ext_abc')).not.toBe(fnv1aHex6('ext_abd'));
});

it('🔴 准入:只读放行;无 readOnlyHint 且不在清单 → 拒;删除类名字即便只读也拒;schema 包成顶层封闭', ()=>{
	expect(admitExternalTool(RO('get_current_time'), SPEC)).toEqual(expect.objectContaining({ ok: true, name: 'ext_time_get_current_time', via: 'readOnlyHint' }));
	const write = { name: 'write_file', description: 'd', inputSchema: {} };
	expect(admitExternalTool(write, SPEC).ok).toBe(false);
	// [Q-292/M-106] 只读档:清单也不放行写工具(此前放行且按只读级自动执行);按清单档:清单放行且按写入级注册
	expect(admitExternalTool(write, { ...SPEC, allowTools: ['write_file'] }).ok).toBe(false);
	expect(admitExternalTool(write, { ...SPEC, readOnlyOnly: false, allowTools: ['write_file'] })).toEqual(expect.objectContaining({ ok: true, level: 'additive', via: 'allowlist' }));
	expect(admitExternalTool(RO('get_current_time'), SPEC).level).toBe('read');
	expect(admitExternalTool({ name: 'delete_file', annotations: { readOnlyHint: true } }, SPEC)).toEqual(expect.objectContaining({ ok: false }));
	expect(admitExternalTool({ name: 'reset_all', annotations: { readOnlyHint: true } }, SPEC).ok).toBe(false);
	expect(admitExternalTool({ name: '' }, SPEC).ok).toBe(false);
	expect(admitExternalTool(RO('x'), { ...SPEC, readOnlyOnly: false }).ok).toBe(true);
	expect(admitExternalTool(write, { ...SPEC, readOnlyOnly: false }).ok).toBe(false);   // 放开只读仍要清单
	expect(normalizeExternalSchema({ type: 'object', properties: { a: { type: 'string' } }, required: ['a', 'ghost'], additionalProperties: true }))
		.toEqual({ type: 'object', additionalProperties: false, properties: { a: { type: 'string' } }, required: ['a'] });
	expect(normalizeExternalSchema(null)).toEqual({ type: 'object', additionalProperties: false, properties: {} });
});

it('🔴 注册:总开关关 → 不进 manifest、调用即 E_TOOL_DISABLED;开 → 可调且结果带未经核实信封;外部服务器报错 → E_EXTERNAL_FAILED;桥缺席 → E_EXTERNAL_UNAVAILABLE', async ()=>{
	registerBuiltinTools();
	const before = exportToolManifest().length;
	const res = registerExternalTools(SPEC, [RO('get_current_time'), { name: 'write_file', inputSchema: {} }]);
	expect(res.registered).toEqual(['ext_time_get_current_time']);
	expect(res.rejected.length).toBe(1);
	expect(isExternalToolsEnabled()).toBe(false);
	expect(exportToolManifest().some((t)=>t.name === 'ext_time_get_current_time')).toBe(false);
	expect(exportToolManifest().length).toBe(before);   // 关着=目录零变化
	const denied = await runTool('ext_time_get_current_time', {}, { origin: 'in-app' });
	expect(denied.code).toBe('E_TOOL_DISABLED');
	setExternalToolsEnabled(true);
	expect(exportToolManifest().some((t)=>t.name === 'ext_time_get_current_time')).toBe(true);
	const call = jest.spyOn(desktop, 'desktopMcpClientCall').mockResolvedValue({ available: true, value: { content: [{ type: 'text', text: '12:00' }], isError: false } });
	const ok = await runTool('ext_time_get_current_time', { tz: 'Asia/Tokyo' }, { origin: 'in-app' });
	expect(ok.ok).toBe(true);
	expect(ok.data.content).toBe('12:00');
	expect(ok.assumptions).toContain(EXT_UNVERIFIED);
	expect(call.mock.calls[0].slice(0, 2)).toEqual(['time', 'get_current_time']);
	call.mockResolvedValue({ available: true, value: { content: [{ type: 'text', text: 'boom' }], isError: true } });
	expect((await runTool('ext_time_get_current_time', {}, { origin: 'in-app' })).code).toBe('E_EXTERNAL_FAILED');
	call.mockResolvedValue({ available: false, reason: 'no-desktop' });
	expect((await runTool('ext_time_get_current_time', {}, { origin: 'in-app' })).code).toBe('E_EXTERNAL_UNAVAILABLE');
});

it('🔴 注销只动 origin external:收回本服务器工具 / 全收回,内置目录一个都不掉', ()=>{
	registerBuiltinTools();
	const builtin = listTools().filter((t)=>t.origin !== 'external').length;
	registerExternalTools(SPEC, [RO('get_current_time')]);
	registerExternalTools({ ...SPEC, id: 'weather', name: '天气' }, [RO('forecast')]);
	expect(listTools().filter((t)=>t.origin === 'external').map((t)=>t.name).sort()).toEqual(['ext_time_get_current_time', 'ext_weather_forecast']);
	expect(unregisterExternalTools({ id: 'time', name: '时间服务' })).toBe(1);
	expect(listTools().filter((t)=>t.origin === 'external').map((t)=>t.name)).toEqual(['ext_weather_forecast']);
	expect(unregisterAllExternalTools()).toBe(1);
	expect(listTools().filter((t)=>t.origin === 'external').length).toBe(0);
	expect(listTools().filter((t)=>t.origin !== 'external').length).toBe(builtin);
	expect(EXT_PREFIX).toBe('ext_');
});
