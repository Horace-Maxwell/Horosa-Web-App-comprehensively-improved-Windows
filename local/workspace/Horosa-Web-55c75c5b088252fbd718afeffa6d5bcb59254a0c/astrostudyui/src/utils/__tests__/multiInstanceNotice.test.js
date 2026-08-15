// [R3] 多实例提示行为锁:端口判定纯函数 + 组件显隐/可关。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import MultiInstanceNotice, { isSecondaryInstancePort } from '../../components/common/MultiInstanceNotice';

describe('[R3] MultiInstanceNotice', ()=>{
	let host;
	beforeEach(()=>{
		host = document.createElement('div');
		document.body.appendChild(host);
	});
	afterEach(()=>{
		ReactDOM.unmountComponentAtNode(host);
		host.remove();
	});

	it('端口判定:仅阶梯非首选位(38992..38999)为真;首选口/随机兜底口/无端口为假', ()=>{
		expect(isSecondaryInstancePort('38991')).toBe(false);   // 首选=主实例
		expect(isSecondaryInstancePort('38992')).toBe(true);    // 第二实例
		expect(isSecondaryInstancePort(38999)).toBe(true);      // 阶梯末位
		expect(isSecondaryInstancePort('39000')).toBe(false);   // 阶梯外(随机兜底口不判,避免误报)
		expect(isSecondaryInstancePort('')).toBe(false);
		expect(isSecondaryInstancePort(undefined)).toBe(false);
	});

	it('主实例端口:零 DOM;第二实例端口:提示出现且「知道了」可关', ()=>{
		act(()=>{
			ReactDOM.render(<MultiInstanceNotice port='38991' />, host);
		});
		expect(host.textContent).toBe('');
		act(()=>{
			ReactDOM.render(<MultiInstanceNotice port='38993' />, host);
		});
		expect(host.textContent).toContain('独立实例');
		expect(host.textContent).toContain('互不可见');
		const btn = host.querySelector('button');
		act(()=>{
			btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		});
		expect(host.textContent).toBe('');
	});
});
