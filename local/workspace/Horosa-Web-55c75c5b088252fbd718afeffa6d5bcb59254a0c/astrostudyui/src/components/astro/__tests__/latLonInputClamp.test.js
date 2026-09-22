// [Q-426/T-392] 经纬度输入:清空度数框保留原度数(不写回固定 26°/119°);度数到上限(90°/180°)时分钳为 00,不可组出越界坐标。
import React from 'react';
// jest 走经典 JSX 运行时:组件按应用的自动运行时写法不引 React,渲染测试里给一个全局 React 即可(生产构建=自动运行时,零影响)。
global.React = React;
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import LatInput from '../LatInput';
import LonInput from '../LonInput';

function mount(Comp, props){
	const host = document.createElement('div'); document.body.appendChild(host);
	let inst = null;
	act(() => { ReactDOM.render(<Comp ref={(r) => { inst = r; }} {...props} />, host); });
	return inst;
}

describe('LatInput / LonInput 边界', () => {
	afterEach(() => { document.body.innerHTML = ''; });
	test('清空度数框 → 保留原度数;越上限钳住;上限时分归 00', () => {
		const got = [];
		const lat = mount(LatInput, { value: '39n54', onChange: (v) => got.push(v) });
		lat.onDegreeChange(null); lat.onDegreeChange(''); lat.onDegreeChange(NaN);
		expect(got).toEqual(['39n54', '39n54', '39n54']);
		lat.onDegreeChange(90);
		expect(got[got.length - 1]).toBe('90n00');
		lat.onDegreeChange(120);
		expect(got[got.length - 1]).toBe('90n00');
		lat.onDegreeChange(45);
		expect(got[got.length - 1]).toBe('45n54');
		const got2 = [];
		const lat90 = mount(LatInput, { value: '90n00', onChange: (v) => got2.push(v) });
		lat90.onDegreeMinChange('59');
		expect(got2).toEqual(['90n00']);
		const lat45 = mount(LatInput, { value: '45n00', onChange: (v) => got2.push(v) });
		lat45.onDegreeMinChange('59');
		expect(got2[got2.length - 1]).toBe('45n59');
	});
	test('LonInput 同律(180°)', () => {
		const got = [];
		const lon = mount(LonInput, { value: '116e28', onChange: (v) => got.push(v) });
		lon.onDegreeChange(undefined);
		expect(got[0]).toBe('116e28');
		lon.onDegreeChange(180);
		expect(got[got.length - 1]).toBe('180e00');
		const got2 = [];
		const lon180 = mount(LonInput, { value: '180e00', onChange: (v) => got2.push(v) });
		lon180.onDegreeMinChange('30');
		expect(got2).toEqual(['180e00']);
	});
});
