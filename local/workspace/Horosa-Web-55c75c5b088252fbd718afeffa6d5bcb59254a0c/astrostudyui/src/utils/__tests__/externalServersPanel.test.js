// [进阶审计 C3] 外部 MCP 服务器子面板合同(桌面桥 mock):总开关 → 添加弹窗(HTTP:网址+令牌 / stdio:命令+参数)→ 保存只把令牌交给壳侧、
// 页面正文永不回显 → 连接并检测(只读工具准入、写入拒绝、名字含删除类词的白名单项也拒)→ 工具目录出现 ext_ 前缀只读工具 → 断开注销 → 删除。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import ExternalServersPanel from '../../components/aianalysis/ExternalServersPanel';
import { setAgentEnabled, setExternalToolsEnabled, isExternalToolsEnabled } from '../aiAgent/prefs';
import { listTools } from '../aiTools/registry';
import { unregisterAllExternalTools } from '../../integrations/mcpClient';

const bridge = { clients: [], connectTools: [] };
jest.mock('../aiAnalysisDesktop', ()=>({
	...jest.requireActual('../aiAnalysisDesktop'),
	isDesktopBridgeAvailable: ()=>true,
	// 与真壳同形:mcp_client_list_command 返回**数组**(Rust Vec),经 invokeOptional 包装 —— [D9] 此前 invokeOptional 把数组展开成索引键,面板读 .value 恒 undefined = 清单永远空
	desktopMcpClientList: jest.fn(async ()=>jest.requireActual('../aiAnalysisDesktop').__wrapOptionalForTests(bridge.clients.map((c)=>({ ...c, transport: c.transport && c.transport.headers ? { ...c.transport, headers: { Authorization: '***' } } : c.transport })))),
	// 壳侧收 snake_case 合同(read_only_only / allow_tools / timeout_ms),清单回页面用 camelCase 行(与真壳 mcp_client_list 同形)
	desktopMcpClientUpsert: jest.fn(async (spec)=>{ const i = bridge.clients.findIndex((c)=>c.id === spec.id); const rec = { enabled: spec.enabled !== false, connected: i >= 0 ? !!bridge.clients[i].connected : false, id: spec.id, name: spec.name, timeoutMs: spec.timeout_ms, readOnlyOnly: spec.read_only_only !== false, allowTools: spec.allow_tools || [], transport: spec.transport }; if(i >= 0){ bridge.clients[i] = rec; }else{ bridge.clients.push(rec); } return { available: true }; }),
	desktopMcpClientRemove: jest.fn(async (id)=>{ bridge.clients = bridge.clients.filter((c)=>c.id !== id); return { available: true }; }),
	desktopMcpClientConnect: jest.fn(async (id)=>{ const c = bridge.clients.find((x)=>x.id === id); if(c){ c.connected = true; } return { available: true, value: { tools: bridge.connectTools } }; }),
	desktopMcpClientDisconnect: jest.fn(async (id)=>{ const c = bridge.clients.find((x)=>x.id === id); if(c){ c.connected = false; } return { available: true }; }),
}));
const desktop = require('../aiAnalysisDesktop');

if(!window.matchMedia){
	window.matchMedia = (q)=>({ matches: false, media: q, onchange: null, addListener: ()=>{}, removeListener: ()=>{}, addEventListener: ()=>{}, removeEventListener: ()=>{}, dispatchEvent: ()=>false });
}
const flush = async ()=>{ for(let i = 0; i < 3; i++){ await act(async ()=>{ await new Promise((r)=>setTimeout(r, 0)); }); } };
const click = async (el)=>{ await act(async ()=>{ el.dispatchEvent(new MouseEvent('click', { bubbles: true })); }); await flush(); };
const norm = (t)=>`${t || ''}`.replace(/\s+/g, '');
const btnByText = (root, text)=>Array.from(root.querySelectorAll('button')).find((b)=>norm(b.textContent) === norm(text)) || null;
function setInput(el, value){
	const inp = el.tagName === 'INPUT' ? el : el.querySelector('input');
	const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
	act(()=>{ setter.call(inp, value); inp.dispatchEvent(new Event('input', { bubbles: true })); });
}
async function pickOption(selectAnchor, label){
	const sel = selectAnchor.closest('.ant-select') || selectAnchor;
	await act(async ()=>{ (sel.querySelector('.ant-select-selector') || sel).dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
	await flush();
	const opt = Array.from(document.querySelectorAll('.ant-select-item-option')).find((o)=>norm(o.textContent) === norm(label));
	expect(opt).toBeTruthy();
	await click(opt);
}
const TOOLS = [
	{ name: 'get_current_time', description: 'time', inputSchema: { type: 'object', properties: { timezone: { type: 'string' } } }, annotations: { readOnlyHint: true } },
	{ name: 'convert_time', description: 'convert', inputSchema: { type: 'object' }, annotations: { readOnlyHint: true } },
	{ name: 'delete_everything', description: 'destructive', inputSchema: { type: 'object' } },
];

describe('外部 MCP 服务器子面板', ()=>{
	let host;
	beforeEach(()=>{ window.localStorage.clear(); bridge.clients = []; bridge.connectTools = TOOLS; unregisterAllExternalTools(); setAgentEnabled(true); host = document.createElement('div'); document.body.appendChild(host); });
	afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); document.body.innerHTML = ''; unregisterAllExternalTools(); window.localStorage.clear(); });

	test('🔴 总开关(确认弹窗)→ HTTP 服务器弹窗 → 保存:令牌只进壳侧 upsert、正文不回显、行出现;连接并检测:两只读准入一写入拒;目录多出 ext_ 只读工具;断开/删除注销', async ()=>{
		await act(async ()=>{ ReactDOM.render(<ExternalServersPanel />, host); await new Promise((r)=>setTimeout(r, 0)); });
		await flush();
		expect(isExternalToolsEnabled()).toBe(false);
		expect(host.querySelector('[data-ext-server-add="1"]')).toBeFalsy();   // 关着:不露添加钮
		await click(host.querySelector('[data-external-tools-switch="1"]'));
		const ok = btnByText(document.body, '我知道了,打开');
		expect(ok).toBeTruthy();
		await click(ok);
		expect(isExternalToolsEnabled()).toBe(true);
		expect(host.querySelector('[data-ext-server-add="1"]')).toBeTruthy();
		await click(host.querySelector('[data-ext-server-add="1"]'));
		const modal = document.querySelector('[data-ext-server-modal="1"]');
		expect(modal).toBeTruthy();
		setInput(modal.querySelector('[data-ext-server-id="1"]'), 'time');
		setInput(modal.querySelector('[data-ext-server-name="1"]'), '时间服务');
		await pickOption(modal.querySelector('[data-ext-server-kind="1"]'), '网址(HTTP)');
		expect(document.querySelector('[data-ext-server-url="1"]')).toBeTruthy();
		expect(document.querySelector('[data-ext-server-command="1"]')).toBeFalsy();
		setInput(document.querySelector('[data-ext-server-url="1"]'), 'https://example.com/mcp');
		setInput(document.querySelector('[data-ext-server-token="1"]'), 'Bearer secret-xyz-token');
		await click(document.querySelector('[data-ext-server-save="1"]'));
		expect(desktop.desktopMcpClientUpsert).toHaveBeenCalledTimes(1);
		const spec = desktop.desktopMcpClientUpsert.mock.calls[0][0];
		expect(spec.id).toBe('time');
		expect(spec.transport.kind).toBe('http');
		expect(spec.transport.url).toBe('https://example.com/mcp');
		expect(JSON.stringify(spec.transport.headers)).toContain('secret-xyz-token');
		expect(document.body.textContent).not.toContain('secret-xyz-token');   // 令牌永不回显
		expect(host.querySelector('[data-ext-server-row="time"]')).toBeTruthy();
		// 连接并检测:准入判决按行渲染;目录里出现 ext_time_* 只读工具,delete_everything 被拒
		await click(host.querySelector('[data-ext-server-connect="time"]'));
		expect(desktop.desktopMcpClientConnect).toHaveBeenCalledWith('time');
		expect(host.querySelectorAll('[data-ext-tool-verdict="ok"]').length).toBe(2);
		expect(host.querySelectorAll('[data-ext-tool-verdict="rejected"]').length).toBe(1);
		const names = listTools().map((t)=>t.name);
		expect(names).toContain('ext_time_get_current_time');
		expect(names).toContain('ext_time_convert_time');
		expect(names.some((n)=>n.indexOf('delete_everything') >= 0)).toBe(false);
		expect(listTools().filter((t)=>t.name.indexOf('ext_time_') === 0).every((t)=>t.level === 'read' && t.category === 'external')).toBe(true);
		// 断开 → 注销;删除 → 壳侧 remove + 行消失
		await click(host.querySelector('[data-ext-server-disconnect="time"]'));
		expect(desktop.desktopMcpClientDisconnect).toHaveBeenCalledWith('time');
		expect(listTools().some((t)=>t.name.indexOf('ext_time_') === 0)).toBe(false);
		await click(host.querySelector('[data-ext-server-delete="time"]'));
		expect(desktop.desktopMcpClientRemove).toHaveBeenCalledWith('time');
		expect(host.querySelector('[data-ext-server-row="time"]')).toBeFalsy();
	});

	test('🔴 stdio 服务器 + 「按清单」+ 允许清单写删除类工具:命令/参数进壳侧;只读的仍准入,清单里的删除类工具被「只增不删」名字闸拒;关总开关收回全部外部工具', async ()=>{
		setExternalToolsEnabled(true);
		await act(async ()=>{ ReactDOM.render(<ExternalServersPanel />, host); await new Promise((r)=>setTimeout(r, 0)); });
		await flush();
		await click(host.querySelector('[data-ext-server-add="1"]'));
		const modal = document.querySelector('[data-ext-server-modal="1"]');
		setInput(modal.querySelector('[data-ext-server-id="1"]'), 'clock');
		setInput(modal.querySelector('[data-ext-server-name="1"]'), '时钟');
		expect(modal.querySelector('[data-ext-server-command="1"]')).toBeTruthy();   // 缺省 stdio
		setInput(modal.querySelector('[data-ext-server-command="1"]'), 'uvx');
		setInput(modal.querySelector('[data-ext-server-args="1"]'), 'mcp-server-time');
		await click(modal.querySelector('[data-ext-server-readonly="1"]'));   // 只读 → 按清单
		setInput(modal.querySelector('[data-ext-server-allowlist="1"]'), 'delete_everything');
		await click(document.querySelector('[data-ext-server-save="1"]'));
		const spec = desktop.desktopMcpClientUpsert.mock.calls.pop()[0];
		expect(spec.transport).toEqual({ kind: 'stdio', command: 'uvx', args: ['mcp-server-time'], env: {} });
		expect(spec.read_only_only).toBe(false);   // 壳侧合同用 snake_case
		expect(spec.allow_tools).toEqual(['delete_everything']);
		expect(spec.timeout_ms).toBe(20000);
		await click(host.querySelector('[data-ext-server-connect="clock"]'));
		expect(host.querySelectorAll('[data-ext-tool-verdict="ok"]').length).toBe(2);
		const rejected = host.querySelectorAll('[data-ext-tool-verdict="rejected"]');
		expect(rejected.length).toBe(1);
		expect(rejected[0].textContent).toContain('删除');
		expect(listTools().some((t)=>t.name === 'ext_clock_get_current_time')).toBe(true);
		// 关总开关 → 一个外部工具都不留
		await click(host.querySelector('[data-external-tools-switch="1"]'));
		expect(isExternalToolsEnabled()).toBe(false);
		expect(listTools().some((t)=>t.name.indexOf('ext_') === 0)).toBe(false);
	});
});

// [D9] invokeOptional 的数组包装合同:数组结果必须落 value(与真壳 mcp_client_list_command 的 Vec 同形);对象结果仍展开;标量落 value
describe('invokeOptional 数组结果', ()=>{
	test('🔴 数组 → {available, value:[…]};对象 → 展开;标量 → value', ()=>{
		const { __wrapOptionalForTests } = jest.requireActual('../aiAnalysisDesktop');
		expect(__wrapOptionalForTests([{ id: 'a' }])).toEqual({ available: true, value: [{ id: 'a' }] });
		expect(__wrapOptionalForTests({ running: true })).toEqual({ available: true, running: true });
		expect(__wrapOptionalForTests(7)).toEqual({ available: true, value: 7 });
	});
});
