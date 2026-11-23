// 自绘弹层的 Esc:层栈 + 捕获阶段 —— 只关最上面那一层,事件不再往下传(包着它的 antd Modal 不跟着关);栈空时不拦。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { useEscapeClose, __escapeLayerCountForTests } from '../useEscapeClose';

function Layer({ onClose, active = true }){
	useEscapeClose(onClose, active);
	return null;
}

const press = (init = {})=>{
	const e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true, ...init });
	document.body.dispatchEvent(e);
	return e;
};

describe('useEscapeClose 层栈', ()=>{
	let host;
	beforeEach(()=>{ host = document.createElement('div'); document.body.appendChild(host); });
	afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); });

	it('两层都开着:Esc 只关后开的那层,且下面的监听(如 antd Modal)收不到', ()=>{
		const lower = jest.fn();
		const upper = jest.fn();
		const modalListener = jest.fn();
		document.addEventListener('keydown', modalListener);
		act(()=>{ ReactDOM.render(<><Layer onClose={lower} /><Layer onClose={upper} /></>, host); });
		expect(__escapeLayerCountForTests()).toBe(2);
		const e = press();
		expect(upper).toHaveBeenCalledTimes(1);
		expect(lower).not.toHaveBeenCalled();
		expect(modalListener).not.toHaveBeenCalled();
		expect(e.defaultPrevented).toBe(true);
		document.removeEventListener('keydown', modalListener);
	});

	it('上层关掉(卸载)后,下一次 Esc 交给下层;全关后栈空,Esc 照常往下传', ()=>{
		const lower = jest.fn();
		const passthrough = jest.fn();
		act(()=>{ ReactDOM.render(<><Layer onClose={lower} /><Layer onClose={()=>{}} active={false} /></>, host); });
		expect(__escapeLayerCountForTests()).toBe(1);
		press();
		expect(lower).toHaveBeenCalledTimes(1);
		act(()=>{ ReactDOM.unmountComponentAtNode(host); });
		expect(__escapeLayerCountForTests()).toBe(0);
		document.addEventListener('keydown', passthrough);
		press();
		expect(passthrough).toHaveBeenCalledTimes(1);
		document.removeEventListener('keydown', passthrough);
	});

	it('输入法组字中的 Esc 不算', ()=>{
		const close = jest.fn();
		act(()=>{ ReactDOM.render(<Layer onClose={close} />, host); });
		press({ isComposing: true });
		expect(close).not.toHaveBeenCalled();
	});
	it('输入法结束组字的那一下 Esc(isComposing 已是 false、keyCode 229)不算关闭', ()=>{
		const onClose = jest.fn();
		act(()=>{ ReactDOM.render(<Layer onClose={onClose} />, host); });
		const e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
		Object.defineProperty(e, 'keyCode', { value: 229 });
		document.body.dispatchEvent(e);
		expect(onClose).not.toHaveBeenCalled();
		press();
		expect(onClose).toHaveBeenCalledTimes(1);
	});
});
