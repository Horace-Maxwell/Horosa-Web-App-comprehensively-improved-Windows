// 懒边界的静默形态(浮在页面角落的小部件:任务中心铃铛等):加载中不占位、加载失败不在版面里出错误卡(只记控制台);
// 常规形态照旧有加载态。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { makeLazyBoundary } from '../lazyBoundary';

let host = null;
beforeEach(()=>{ host = document.createElement('div'); document.body.appendChild(host); });
afterEach(()=>{ ReactDOM.unmountComponentAtNode(host); host.remove(); });

const flush = ()=>act(async ()=>{ await new Promise((r)=>setTimeout(r, 0)); });

it('静默形态:加载中什么都不渲染,加载完出组件', async ()=>{
	let resolve;
	const W = makeLazyBoundary(()=>new Promise((r)=>{ resolve = r; }), { silent: true });
	act(()=>{ ReactDOM.render(<W />, host); });
	await flush();   // 自愈工厂在微任务里才调真工厂
	expect(host.innerHTML).toBe('');
	await act(async ()=>{ resolve({ default: ()=><span data-x="bell">🔔</span> }); });
	await flush();
	expect(host.querySelector('[data-x="bell"]')).toBeTruthy();
});

it('🔴 静默形态:加载失败不出错误卡、不抛到外层(只记控制台)', async ()=>{
	const warn = jest.spyOn(console, 'warn').mockImplementation(()=>{});
	const err = jest.spyOn(console, 'error').mockImplementation(()=>{});
	const W = makeLazyBoundary(()=>Promise.reject(new Error('chunk 404')), { silent: true, label: '任务中心' });
	act(()=>{ ReactDOM.render(<div data-x="shell"><W /></div>, host); });
	await flush();
	await flush();
	expect(host.querySelector('[data-x="shell"]')).toBeTruthy();
	expect(host.querySelector('[data-x="shell"]').innerHTML).toBe('');
	expect(warn.mock.calls.some((c)=>String(c[0]).includes('任务中心'))).toBe(true);
	warn.mockRestore(); err.mockRestore();
});

it('常规形态照旧有加载态', ()=>{
	const W = makeLazyBoundary(()=>new Promise(()=>{}), { plainFallback: true, tip: '载入中' });
	act(()=>{ ReactDOM.render(<W />, host); });
	expect(host.textContent).toContain('载入中');
});
