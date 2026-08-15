// [S6] 降级横幅行为锁:默认零 DOM;降级事件→显示「暂存内存/重启丢失/请导出」;可关闭。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import LocalStoreHealthBanner from '../../components/common/LocalStoreHealthBanner';

describe('[S6] LocalStoreHealthBanner', ()=>{
	let host;
	beforeEach(()=>{
		window.localStorage.clear();
		host = document.createElement('div');
		document.body.appendChild(host);
	});
	afterEach(()=>{
		ReactDOM.unmountComponentAtNode(host);
		host.remove();
	});

	it('健康态正常:渲染 null(零 DOM,对正常路径零影响)', ()=>{
		act(()=>{
			ReactDOM.render(<LocalStoreHealthBanner />, host);
		});
		expect(host.textContent).toBe('');
	});

	it('🔴 降级事件 → 横幅出现(暂存内存/重启丢失/导出引导);「知道了」可关', ()=>{
		act(()=>{
			ReactDOM.render(<LocalStoreHealthBanner />, host);
		});
		act(()=>{
			window.dispatchEvent(new CustomEvent('horosa.localRecordStore.degraded', {
				detail: { storageKey: 'horosa.localCharts.v1', reason: 'storage-error' },
			}));
		});
		expect(host.textContent).toContain('暂存于内存');
		expect(host.textContent).toContain('重启后将丢失');
		expect(host.textContent).toContain('导出 JSON 备份');
		const btn = host.querySelector('button');
		expect(btn).toBeTruthy();
		act(()=>{
			btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		});
		expect(host.textContent).toBe('');
	});

	it('挂载补查:挂载前储存已根坏(health.mode=memory)→ 无需再等事件即显示', ()=>{
		// 顶层共享的 localcharts 实例降级(getItem 抛非 quota 异常即入 memory 模式)。
		// 🔴 不用 jest.resetModules:重置后再 require 组件会拿到第二个 React 实例,hooks 必炸
		// (双 React 陷阱)。本例排本套件最后,共享实例降级不污染前例。
		const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(()=>{ throw new Error('SecurityError'); });
		// eslint-disable-next-line global-require
		const mod = require('../localcharts');
		mod.listLocalCharts();
		spy.mockRestore();
		act(()=>{
			ReactDOM.render(<LocalStoreHealthBanner />, host);
		});
		expect(host.textContent).toContain('重启后将丢失');
	});
});
