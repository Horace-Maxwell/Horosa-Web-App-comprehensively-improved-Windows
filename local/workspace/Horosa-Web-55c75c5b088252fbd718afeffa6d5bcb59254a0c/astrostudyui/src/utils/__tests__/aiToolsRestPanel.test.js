// 本机 REST 接口子开关(外部连接面板)合同:缺省关、随本机服务(服务关 = 开关禁用);首开二次确认后才调壳命令;
// 开着且服务在跑才出两个复制钮,复制时按需取令牌、拼进 curl 正文(面板正文永不显示令牌);关掉不弹确认。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';

const mockStatus = { current: {} };
jest.mock('../aiAnalysisDesktop', ()=>({
	...jest.requireActual('../aiAnalysisDesktop'),
	isDesktopBridgeAvailable: ()=>true,
	desktopMcpServerStatus: jest.fn(async ()=>({ available: true, ...mockStatus.current })),
	desktopMcpServerSetEnabled: jest.fn(async ()=>({ available: true })),
	desktopMcpServerSetRestEnabled: jest.fn(async (on)=>{ mockStatus.current = { ...mockStatus.current, restEnabled: !!on }; return { available: true, ...mockStatus.current }; }),
	desktopMcpServerRevealToken: jest.fn(async ()=>({ available: true, token: 'tok-rest-0001' })),
	desktopNotifyHookStatus: jest.fn(async ()=>({ available: true, enabled: false, valid: false, path: '' })),
}));
jest.mock('../clipboardText', ()=>({ copyTextSmart: jest.fn(async ()=>true) }));

/* eslint-disable import/first */
import ExternalAgentPanel, { restCurlExample, restOpenApiCurl, REST_CONFIRM_COPY } from '../../components/aianalysis/ExternalAgentPanel';
import { desktopMcpServerSetRestEnabled, desktopMcpServerRevealToken } from '../aiAnalysisDesktop';
import { copyTextSmart } from '../clipboardText';
import { setAgentEnabled } from '../aiAgent/prefs';
/* eslint-enable import/first */

if(!window.matchMedia){
	window.matchMedia = (q)=>({ matches: false, media: q, onchange: null, addListener: ()=>{}, removeListener: ()=>{}, addEventListener: ()=>{}, removeEventListener: ()=>{}, dispatchEvent: ()=>false });
}
const flush = async ()=>{ for(let i = 0; i < 3; i += 1){ await act(async ()=>{ await new Promise((r)=>setTimeout(r, 0)); }); } };
const click = (el)=>act(()=>{ el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const RUNNING = { running: true, enabled: true, port: 39991, url: 'http://127.0.0.1:39991/mcp', endpointFile: '/tmp/e.json', restUrl: 'http://127.0.0.1:39991/api/v1' };

describe('REST 接口子开关', ()=>{
	let host;
	beforeEach(()=>{ window.localStorage.clear(); jest.clearAllMocks(); setAgentEnabled(true); host = document.createElement('div'); document.body.appendChild(host); });
	afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); document.body.innerHTML = ''; window.localStorage.clear(); });
	const render = async ()=>{ await act(async ()=>{ ReactDOM.render(<ExternalAgentPanel />, host); await new Promise((r)=>setTimeout(r, 0)); }); await flush(); };
	const restSwitch = ()=>host.querySelector('[data-mcp-rest-switch="1"]');

	test('🔴 本机服务关 → REST 开关在位但禁用,不出复制钮', async ()=>{
		mockStatus.current = { running: false, enabled: false, restEnabled: false };
		await render();
		expect(host.querySelector('[data-mcp-rest="1"]')).toBeTruthy();
		expect(restSwitch().disabled).toBe(true);
		expect(host.querySelectorAll('[data-mcp-rest-copy]').length).toBe(0);
	});

	test('🔴 服务在跑、REST 缺省关 → 点开先弹确认;确认后才调壳命令;开后出两个复制钮', async ()=>{
		mockStatus.current = { ...RUNNING, restEnabled: false };
		await render();
		expect(restSwitch().disabled).toBe(false);
		expect(host.querySelectorAll('[data-mcp-rest-copy]').length).toBe(0);
		click(restSwitch());
		await flush();
		expect(desktopMcpServerSetRestEnabled).not.toHaveBeenCalled();
		expect(document.body.textContent).toContain(REST_CONFIRM_COPY.slice(0, 20));
		const ok = Array.from(document.querySelectorAll('.ant-modal-confirm-btns button')).find((b)=>b.textContent.replace(/\s+/g, '') === '开启');
		click(ok);
		await flush();
		expect(desktopMcpServerSetRestEnabled).toHaveBeenCalledWith(true);
		expect(host.querySelectorAll('[data-mcp-rest-copy]').length).toBe(2);
		expect(host.textContent).toContain('http://127.0.0.1:39991/api/v1');
	});

	test('🔴 复制 curl / 接口文档命令:按需取令牌拼进剪贴板正文,面板正文不显示令牌;关掉不弹确认', async ()=>{
		mockStatus.current = { ...RUNNING, restEnabled: true };
		await render();
		click(host.querySelector('[data-mcp-rest-copy="curl"]'));
		await flush();
		click(host.querySelector('[data-mcp-rest-copy="openapi"]'));
		await flush();
		expect(desktopMcpServerRevealToken).toHaveBeenCalledTimes(2);
		const copied = copyTextSmart.mock.calls.map((c)=>c[0]);
		expect(copied[0]).toBe('curl -s -H "Authorization: Bearer tok-rest-0001" http://127.0.0.1:39991/api/v1/context');
		expect(copied[1]).toBe('curl -s -H "Authorization: Bearer tok-rest-0001" http://127.0.0.1:39991/api/v1/openapi.json');
		expect(host.textContent).not.toContain('tok-rest-0001');
		click(restSwitch());
		await flush();
		expect(document.querySelectorAll('.ant-modal-confirm-btns').length).toBe(0);
		expect(desktopMcpServerSetRestEnabled).toHaveBeenCalledWith(false);
		expect(host.querySelectorAll('[data-mcp-rest-copy]').length).toBe(0);
	});

	test('curl 片段只用状态里的 restUrl 与按需令牌', ()=>{
		expect(restCurlExample({ token: 'T', restUrl: 'http://127.0.0.1:1/api/v1' })).toBe('curl -s -H "Authorization: Bearer T" http://127.0.0.1:1/api/v1/context');
		expect(restOpenApiCurl({ token: 'T', restUrl: 'http://127.0.0.1:1/api/v1' })).toContain('/api/v1/openapi.json');
	});
});
