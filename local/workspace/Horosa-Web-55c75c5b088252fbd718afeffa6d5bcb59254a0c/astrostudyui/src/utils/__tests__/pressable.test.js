// pressable:非按钮元素的键盘入口 —— 回车 / 空格触发、只认自身按键、鼠标点完不留焦点、无处理函数不加任何属性。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { pressable } from '../pressable';

let root = null;
beforeEach(()=>{ root = document.createElement('div'); document.body.appendChild(root); });
afterEach(()=>{ ReactDOM.unmountComponentAtNode(root); root.remove(); });

function mount(el){ act(()=>{ ReactDOM.render(el, root); }); return root.firstChild; }
const key = (el, k)=>act(()=>{ el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); });

it('给出按钮语义与 Tab 停靠;元素自己写了 role / tabIndex 时可让开', ()=>{
	const fn = jest.fn();
	expect(pressable(fn)).toMatchObject({ role: 'button', tabIndex: 0 });
	expect(pressable(fn, { role: false }).role).toBeUndefined();
	expect(pressable(fn, { tabIndex: false }).tabIndex).toBeUndefined();
	expect(pressable(fn, { disabled: true })).toMatchObject({ tabIndex: -1, 'aria-disabled': true });
});

it('🔴 没有处理函数什么都不加(条件挂载时块不可聚焦)', ()=>{
	expect(pressable(undefined)).toEqual({});
	expect(pressable(null)).toEqual({});
});

it('🔴 回车 / 空格触发;别的键不触发;空格阻止默认(不翻页)', ()=>{
	const fn = jest.fn();
	const el = mount(<div {...pressable(fn)}>块</div>);
	key(el, 'Enter'); key(el, ' '); key(el, 'a'); key(el, 'Tab');
	expect(fn).toHaveBeenCalledTimes(2);
	const ev = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
	act(()=>{ el.dispatchEvent(ev); });
	expect(ev.defaultPrevented).toBe(true);
});

it('🔴 里面的输入框打字不算按下这个块', ()=>{
	const fn = jest.fn();
	const el = mount(<div {...pressable(fn)}><input data-x="1" /></div>);
	key(el.querySelector('input'), 'Enter');
	key(el.querySelector('input'), ' ');
	expect(fn).not.toHaveBeenCalled();
});

it('🔴 鼠标点完不留焦点(点完按空格不会再触发它);键盘触发保留焦点', ()=>{
	const fn = jest.fn();
	const el = mount(<div {...pressable(fn)}>块</div>);
	el.focus();
	expect(document.activeElement).toBe(el);
	act(()=>{ el.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })); });
	expect(fn).toHaveBeenCalledTimes(1);
	expect(document.activeElement).not.toBe(el);
	el.focus();
	act(()=>{ el.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 })); });   // 键盘 / 程序触发的 click
	expect(document.activeElement).toBe(el);
});

it('禁用时点与按键都不触发', ()=>{
	const fn = jest.fn();
	const el = mount(<div {...pressable(fn, { disabled: true })}>块</div>);
	act(()=>{ el.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })); });
	key(el, 'Enter');
	expect(fn).not.toHaveBeenCalled();
});
