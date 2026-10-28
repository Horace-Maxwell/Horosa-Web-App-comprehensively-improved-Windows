// 日期计算月历:快速改日期时只认最后一次发出的那个月(先发的晚回不覆盖);卸载后回来的不写 state。
jest.mock('../../../utils/request', ()=>jest.fn());
import request from '../../../utils/request';
import * as Constants from '../../../utils/constants';
import DateCalc from '../DateCalc';

global.React = require('react');

function deferred(){
	let resolve;
	const p = new Promise((r)=>{ resolve = r; });
	return { p, resolve };
}
function host(){
	const h = Object.create(DateCalc.prototype);
	h.state = {};
	h.genParams = ()=>({ date: '2026-10-19', zone: '+08:00', lon: '116e23' });
	h.setState = jest.fn(function(p){ this.state = { ...this.state, ...p }; });
	return h;
}

describe('日期计算月历请求代次', ()=>{
	it('先发的晚回不覆盖后发的', async ()=>{
		const first = deferred();
		const second = deferred();
		request.mockReturnValueOnce(first.p).mockReturnValueOnce(second.p);
		const h = host();
		const a = h.requestNongli();
		const b = h.requestNongli();
		second.resolve({ [Constants.ResultKey]: { days: ['新'], prevDays: [] } });
		await b;
		first.resolve({ [Constants.ResultKey]: { days: ['旧'], prevDays: [] } });
		await a;
		expect(h.setState).toHaveBeenCalledTimes(1);
		expect(h.state.days).toEqual(['新']);
	});
	it('卸载后回来的不写 state', async ()=>{
		const d = deferred();
		request.mockReturnValueOnce(d.p);
		const h = host();
		const a = h.requestNongli();
		h.componentWillUnmount();
		d.resolve({ [Constants.ResultKey]: { days: ['x'], prevDays: [] } });
		await a;
		expect(h.setState).not.toHaveBeenCalled();
	});
});
