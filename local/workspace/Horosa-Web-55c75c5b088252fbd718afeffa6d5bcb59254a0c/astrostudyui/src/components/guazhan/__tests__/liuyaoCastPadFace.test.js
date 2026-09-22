// [Q-299/T-288 ⑦] 逐掷录入初始行按 coinFace 口径取背面数:字为阳(alt)镜像后初始六行仍为默认爻态(少阳/少阴),不反显。
import React from 'react';
// jest 走经典 JSX 运行时:组件按应用的自动运行时写法不引 React,渲染测试里给一个全局 React 即可(生产构建=自动运行时,零影响)。
global.React = React;
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import LiuYaoCastPad, { coinTossToYao } from '../LiuYaoCastPad';

function mount(props){
	const host = document.createElement('div'); document.body.appendChild(host);
	let inst = null;
	act(() => { ReactDOM.render(<LiuYaoCastPad ref={(r) => { inst = r; }} {...props} />, host); });
	return { inst, host, rerender: (p) => act(() => { ReactDOM.render(<LiuYaoCastPad ref={(r) => { inst = r; }} {...p} />, host); }), get: () => inst };
}

describe('LiuYaoCastPad coinFace 初始极性', () => {
	afterEach(() => { document.body.innerHTML = ''; });
	test('standard:少阳=1背;alt(字为阳):少阳=2背 —— 两口径下初始六行都解成少阳', () => {
		const s1 = mount({}).inst.state;
		const s2 = mount({ coinFace: 'alt' }).inst.state;
		expect(s1.tosses).toEqual([1, 1, 1, 1, 1, 1]);
		expect(s2.tosses).toEqual([2, 2, 2, 2, 2, 2]);
		s1.tosses.forEach((b) => expect(coinTossToYao(b, 'standard')).toEqual({ value: 1, change: false }));
		s2.tosses.forEach((b) => expect(coinTossToYao(b, 'alt')).toEqual({ value: 1, change: false }));
	});
	test('默认爻态=少阴:两口径下初始六行都解成少阴', () => {
		const a = mount({ defaultYaoState: 'shaoyin' }).inst.state;
		const b = mount({ defaultYaoState: 'shaoyin', coinFace: 'alt' }).inst.state;
		a.tosses.forEach((x) => expect(coinTossToYao(x, 'standard').value).toBe(0));
		b.tosses.forEach((x) => expect(coinTossToYao(x, 'alt').value).toBe(0));
	});
	test('运行中切换口径:背面数镜像(3−b),各行阴阳不变', () => {
		const m = mount({});
		act(() => { m.get().setState({ tosses: [0, 1, 2, 3, 1, 2] }); });
		const before = m.get().state.tosses.map((x) => coinTossToYao(x, 'standard'));
		m.rerender({ coinFace: 'alt' });
		expect(m.get().state.tosses).toEqual([3, 2, 1, 0, 2, 1]);
		expect(m.get().state.tosses.map((x) => coinTossToYao(x, 'alt'))).toEqual(before);
	});
});
