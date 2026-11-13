// 穿界表:切页签回来照原样恢复,重算时不显示失败。
import React from 'react';
import IndiaTransitEvents from '../IndiaTransitEvents';
import request from '../../../../utils/request';

jest.mock('../../../../utils/request', ()=>({ __esModule: true, default: jest.fn() }));

global.React = React;

const PROPS = { params: { date: '2024/04/05' }, start: '2024/04/05' };
const RESULT = { rows: [{ jd: 1, date: '2024-04-05', time: '10:00:00', planet: 'Sun', kind: 'sign', number: 1, relation: 'friend' }], total: 1, truncated: false };

function page(props){
	const inst = new IndiaTransitEvents(props);
	inst.setState = (patch)=>{ inst.state = { ...inst.state, ...patch }; };
	inst.forceUpdate = ()=>{};
	return inst;
}

function emptyText(inst){
	const tree = inst.render();
	const found = [];
	const walk = (node)=>{
		if(!node || typeof node !== 'object'){ return; }
		if(Array.isArray(node)){ node.forEach(walk); return; }
		if(node.props){
			if(node.props.className === 'horosa-india-dasha-empty'){ found.push(node.props.children); }
			walk(node.props.children);
		}
	};
	walk(tree);
	return found[0];
}

describe('穿界表', ()=>{
	beforeEach(()=>{ request.mockReset(); });

	test('回到页签:选择和结果还在,不重发请求', async ()=>{
		const memo = {};
		const first = page({ ...PROPS, memo });
		first._mounted = true;
		first.remember({ transitKind: 'pada' });
		first.setState({ transitKind: 'pada' });
		request.mockResolvedValueOnce({ Result: RESULT });
		await first.load();
		expect(request).toHaveBeenCalledTimes(1);

		const back = page({ ...PROPS, memo });
		expect(back.state.transitKind).toBe('pada');
		expect(back.state.result).toEqual(RESULT);
		back.componentDidMount();
		expect(request).toHaveBeenCalledTimes(1);
		back.componentWillUnmount();
	});

	test('换了过运日期,回来要重算', async ()=>{
		const memo = {};
		const first = page({ ...PROPS, memo });
		first._mounted = true;
		request.mockResolvedValue({ Result: RESULT });
		await first.load();
		const back = page({ ...PROPS, start: '2024/05/01', memo });
		back.componentDidMount();
		await Promise.resolve();
		expect(request).toHaveBeenCalledTimes(2);
		back.componentWillUnmount();
	});

	test('失败提示只在没有在算时显示', ()=>{
		const inst = page({ ...PROPS });
		inst.state = { ...inst.state, failed: true, loading: true };
		expect(emptyText(inst)).toBe('计算中...');
		inst.state = { ...inst.state, loading: false };
		expect(emptyText(inst)).toBe('计算失败,稍后会自动重试');
	});
});
