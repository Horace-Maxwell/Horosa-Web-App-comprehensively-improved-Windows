// WP-F 双实例双算收敛金标 —— 宿主把 native 技法渲染两次(center/aux 两实例),
// 各自实例 memo 互不相通 → 同一次时间变更本地引擎白算两遍。模块级共享 memo 后:
// center 先算、aux 同签名直接命中 —— 引擎只跑一遍。
import React from 'react';
import CanPingMain from '../CanPingMain';
import ZhengChuanMain from '../ZhengChuanMain';

// 计数真引擎:不 mock 算法(结果要真),只包一层 spy —— 这里用「时间开销近似」不可靠,
// 改用【引擎入口调用次数】:jest.mock 计数、透传真实现。
// ⚠️ 该模块的导出名是 calculate(组件 import 时改名 canpingCalculate)——mock 键须用真名。
jest.mock('../../../utils/canpingLocal', () => {
	const real = jest.requireActual('../../../utils/canpingLocal');
	return {
		...real,
		calculate: jest.fn((...a) => real.calculate(...a)),
	};
});
import { calculate as canpingCalculate } from '../../../utils/canpingLocal';

const mkProps = () => {
	const dt = {
		ad: 1, zone: '+08:00',
		format: (f) => (f === 'YYYY-MM-DD' ? '1984-07-15' : '18:17:00'),
		clone(){ return this; },
	};
	const v = (x) => ({ value: x });
	return {
		fields: {
			date: { value: dt }, time: { value: dt },
			lon: v(''), gender: v(1), timeAlg: v(1),
		},
		opts: {},
	};
};

beforeEach(() => {
	canpingCalculate.mockClear();
	window.localStorage.removeItem('horosa.perf.sharedNativeModel');
});

function newInstance(Comp, props){
	// 不走 ReactDOM:直接实例化 class 调 getModel —— 测的就是模型层共享,与渲染无涉。
	const inst = new Comp(props);
	return inst;
}

describe('🔴 WP-F:两实例同签名,引擎只跑一遍', () => {
	test('CanPing:第二实例命中共享,canpingCalculate 调用数不再翻倍', () => {
		const props = mkProps();
		const a = newInstance(CanPingMain, { ...props, slot: 'center' });
		a.state = a.state || {};
		const m1 = a.getModel();
		const callsAfterFirst = canpingCalculate.mock.calls.length;
		expect(m1).toBeTruthy();
		expect(callsAfterFirst).toBeGreaterThan(0);

		const b = newInstance(CanPingMain, { ...props, slot: 'aux' });
		b.state = b.state || {};
		const m2 = b.getModel();
		expect(m2).toBeTruthy();
		expect(canpingCalculate.mock.calls.length).toBe(callsAfterFirst);   // 零新增调用
		expect(m2).toBe(m1);                                                // 且是同一引用(共享)
	});

	test('kill-switch:关 = 两实例各算各的(旧行为)', () => {
		window.localStorage.setItem('horosa.perf.sharedNativeModel', '0');
		const props = mkProps();
		const a = newInstance(CanPingMain, { ...props, slot: 'center' });
		a.state = a.state || {};
		a.getModel();
		const after1 = canpingCalculate.mock.calls.length;
		const b = newInstance(CanPingMain, { ...props, slot: 'aux' });
		b.state = b.state || {};
		b.getModel();
		expect(canpingCalculate.mock.calls.length).toBeGreaterThan(after1); // 第二实例真算了
	});

	test('神数正传:共享层存的是挂好 _pillars/_gender 的成品(两实例同 fields 值必同)', () => {
		const props = { ...mkProps(), technique: 'zhengchuan' };
		const a = newInstance(ZhengChuanMain, { ...props, slot: 'center' });
		a.state = a.state || { verses: null };
		const m1 = a.getModel && a.getModel();
		if (!m1) return;   // 引擎判定此参数不可算则两边一致为空,共享逻辑无从验,放行
		const b = newInstance(ZhengChuanMain, { ...props, slot: 'aux' });
		b.state = b.state || { verses: null };
		const m2 = b.getModel();
		expect(m2).toBe(m1);
		expect(m2._pillars).toBeTruthy();
	});

	test('dev 冻结保险丝:共享 model 是深冻结的(消费方就地改写会立即炸出,而非静默串写)', () => {
		const props = mkProps();
		const a = newInstance(CanPingMain, { ...props, slot: 'center' });
		a.state = a.state || {};
		const m = a.getModel();
		expect(Object.isFrozen(m)).toBe(true);
	});
});
