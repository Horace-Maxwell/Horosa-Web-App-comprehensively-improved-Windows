/**
 * 行星弧「换盘不重取」回归金标(27 技法日期/地点链穷举审计唯一真伤):
 * AstroPlanetaryArc 曾既无 componentDidUpdate、容器也不传 hook——换本命盘后
 * state.params 停留构造时的旧盘,外圈行星弧盘与内圈本命(props.value 实时)不一致。
 * 修=照 AstroPersianDirected 同款:value 引用变 → 重算本命参数(保留用户已设的
 * 向运时刻/弧源/容许度)并重取。本测试锁「换盘必重取且参数跟新」语义。
 */
import { Component } from 'react';
import AstroPlanetaryArc from '../../components/astro/AstroPlanetaryArc';

jest.mock('../../utils/request', () => ({
	__esModule: true,
	default: jest.fn(() => Promise.resolve(null)),
}));

function chartObjOf(birth, lat, lon){
	return { params: { birth, zone: '+08:00', lat, lon, hsys: 0, zodiacal: 0 }, chart: { objects: [], houses: [] } };
}

describe('AstroPlanetaryArc 换盘重取', () => {
	test('value 引用变化 → 重算本命参数并 requestData;时刻/弧源等用户设置保留', () => {
		const oldChart = chartObjOf('1996-07-12 12:45:26', '26n04', '119e19');
		const newChart = chartObjOf('1988-03-05 08:30:00', '39n54', '116e23');
		expect(AstroPlanetaryArc.prototype instanceof Component).toBe(true);
		const inst = new AstroPlanetaryArc({ value: oldChart });
		expect(inst.state.params.date).toBe('1996-07-12');
		// 模拟用户已改的设置(必须在换盘后保留)
		inst.state.params.asporb = 2;
		const calls = [];
		inst.requestData = () => { calls.push(1); };
		let nextState = null;
		inst.setState = (updater, cb) => {
			nextState = typeof updater === 'function' ? updater(inst.state) : updater;
			inst.state = { ...inst.state, ...nextState };
			if(cb){ cb(); }
		};
		// 换盘:props.value 引用变化 → componentDidUpdate 必须重算参数+重取
		inst.props = { value: newChart };
		inst.componentDidUpdate({ value: oldChart });
		expect(calls.length).toBe(1);
		expect(inst.state.params.date).toBe('1988-03-05');
		expect(inst.state.params.time).toBe('08:30:00');
		expect(inst.state.params.lat).toBe('39n54');
		expect(inst.state.params.lon).toBe('116e23');
		expect(inst.state.params.asporb).toBe(2);
		// 同引用更新(无关重渲染)不得重取
		inst.componentDidUpdate({ value: newChart });
		expect(calls.length).toBe(1);
	});
});
