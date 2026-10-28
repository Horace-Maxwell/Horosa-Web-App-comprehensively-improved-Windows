// 终端命令垫片(外部连接面板「终端命令 horosa」)合同:三钮恒在位;未装 → 安装先弹确认(写明路径)、确认后才调壳;
// 装好且指向本程序 → 安装禁用、可移除;指向旧位置 → 钮名「更新」;同名文件被别的程序占用 → 安装 / 移除都禁用;
// 复制示例:装好用 horosa,没装给二进制全路径(加引号)。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';

const mockShim = { current: {} };
jest.mock('../aiAnalysisDesktop', ()=>({
	...jest.requireActual('../aiAnalysisDesktop'),
	isDesktopBridgeAvailable: ()=>true,
	desktopMcpServerStatus: jest.fn(async ()=>({ available: true, running: false, enabled: false })),
	desktopNotifyHookStatus: jest.fn(async ()=>({ available: true, enabled: false, valid: false, path: '' })),
	desktopCliShimStatus: jest.fn(async ()=>({ available: true, path: '/Users/x/.local/bin/horosa', binaryPath: '/Applications/星 阙.app/Contents/MacOS/horosa', ...mockShim.current })),
	desktopCliShimInstall: jest.fn(async ()=>{ mockShim.current = { ...mockShim.current, installed: true, current: true }; return { available: true }; }),
	desktopCliShimRemove: jest.fn(async ()=>{ mockShim.current = { ...mockShim.current, installed: false, current: false }; return { available: true }; }),
}));
jest.mock('../clipboardText', ()=>({ copyTextSmart: jest.fn(async ()=>true) }));

/* eslint-disable import/first */
import ExternalAgentPanel, { cliExampleCommand, cliShimConfirmCopy } from '../../components/aianalysis/ExternalAgentPanel';
import { desktopCliShimInstall, desktopCliShimRemove } from '../aiAnalysisDesktop';
import { copyTextSmart } from '../clipboardText';
import { setAgentEnabled } from '../aiAgent/prefs';
/* eslint-enable import/first */

if(!window.matchMedia){
	window.matchMedia = (q)=>({ matches: false, media: q, onchange: null, addListener: ()=>{}, removeListener: ()=>{}, addEventListener: ()=>{}, removeEventListener: ()=>{}, dispatchEvent: ()=>false });
}
const flush = async ()=>{ for(let i = 0; i < 3; i += 1){ await act(async ()=>{ await new Promise((r)=>setTimeout(r, 0)); }); } };
const click = (el)=>act(()=>{ el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

describe('终端命令垫片', ()=>{
	let host;
	beforeEach(()=>{ window.localStorage.clear(); jest.clearAllMocks(); setAgentEnabled(true); host = document.createElement('div'); document.body.appendChild(host); });
	afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); document.body.innerHTML = ''; window.localStorage.clear(); });
	const render = async ()=>{ await act(async ()=>{ ReactDOM.render(<ExternalAgentPanel />, host); await new Promise((r)=>setTimeout(r, 0)); }); await flush(); };
	const btn = (k)=>host.querySelector(`[data-cli-shim="${k}"]`);

	test('🔴 未装:三钮在位;安装先弹确认(写明路径),确认后才调壳;装好后安装禁用、可移除', async ()=>{
		mockShim.current = { installed: false, current: false, foreign: false };
		await render();
		expect(host.querySelectorAll('[data-cli-shim]').length).toBe(3);
		expect(btn('install').disabled).toBe(false);
		expect(btn('remove').disabled).toBe(true);
		click(btn('install'));
		await flush();
		expect(desktopCliShimInstall).not.toHaveBeenCalled();
		expect(document.body.textContent).toContain('/Users/x/.local/bin/horosa');
		const ok = Array.from(document.querySelectorAll('.ant-modal-confirm-btns button')).find((b)=>b.textContent.replace(/\s+/g, '') === '安装');
		click(ok);
		await flush();
		expect(desktopCliShimInstall).toHaveBeenCalledTimes(1);
		expect(btn('install').disabled).toBe(true);
		expect(btn('remove').disabled).toBe(false);
		expect(host.textContent).toContain('已安装');
		click(btn('remove'));
		await flush();
		expect(desktopCliShimRemove).toHaveBeenCalledTimes(1);
		expect(btn('remove').disabled).toBe(true);
	});

	test('🔴 指向旧位置 → 钮名「更新」;同名文件被占用 → 安装 / 移除都禁用', async ()=>{
		mockShim.current = { installed: true, current: false, foreign: false };
		await render();
		expect(btn('install').textContent.replace(/\s+/g, '')).toBe('更新');
		expect(btn('install').disabled).toBe(false);
		act(()=>{ ReactDOM.unmountComponentAtNode(host); });
		mockShim.current = { installed: false, current: false, foreign: true };
		await render();
		expect(btn('install').disabled).toBe(true);
		expect(btn('remove').disabled).toBe(true);
		expect(host.textContent).toContain('不会覆盖');
	});

	test('复制示例:装好用 horosa;没装给二进制全路径(加引号)', async ()=>{
		mockShim.current = { installed: false, current: false, foreign: false };
		await render();
		click(btn('copy'));
		await flush();
		expect(copyTextSmart).toHaveBeenCalledWith('"/Applications/星 阙.app/Contents/MacOS/horosa" --horosa-cli status');
		expect(cliExampleCommand({ installed: true, current: true })).toBe('horosa status');
		expect(cliExampleCommand({})).toBe('');
		expect(cliShimConfirmCopy({ path: '/p/horosa' })).toContain('/p/horosa');
	});
});
