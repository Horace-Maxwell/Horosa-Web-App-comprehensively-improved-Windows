// 卜卦/择日/世俗三盘(DivinationChartShell)「选步长即预取」哨兵。
// 背景(实测坑):三盘 fields 自持(与全局 store 无关),旧接线 PlusMinusTime 恒 stepSelectPrefetch=true
// → 选步长 fire 的是全局 handler(store fields+fieldsToParams) → 预取键≠本盘真点键(buildChartParams)
// → 全局预取空烧、本盘第一下步进必冷(用户复现:「切步长后第一次步进仍卡」)。
// 修法:DateTimeSelector stepSelectPrefetch 支持函数形态(宿主本地预取器),shell 用自己的
// buildChartParams+fetchChart 构 ±1/±2 任务 —— 本组锁死【键逐字节等】与【接线真生效】。
jest.mock('d3', () => ({}));
jest.mock('../../astro/AstroChart', () => () => null);
jest.mock('../../amap/GeoCoordModal', () => () => null);

const captured = { tasks: [], budgets: [], fetches: [] };
jest.mock('../../../utils/stepPrefetch', () => ({
	__esModule: true,
	submitStepPrefetch: jest.fn((tasks, opts) => {
		captured.tasks.push(tasks);
		captured.budgets.push(opts && opts.budget);
	}),
	fireStepSelectPrefetch: jest.fn(),
}));
jest.mock('../../../services/astro', () => ({
	__esModule: true,
	fetchChart: jest.fn((params, opts) => {
		captured.fetches.push({ params, opts });
		return Promise.resolve({ Result: null });
	}),
}));

import DivinationChartShell from '../DivinationChartShell';
import { buildChartParams } from '../../../divination/engine/chartRequest';
import { fetchChart } from '../../../services/astro';
import DateTime from '../../comp/DateTime';

function makeShell(){
	const inst = new DivinationChartShell({ fields: {}, defaults: { tradition: 1, zodiacal: 0, hsys: 2 } });
	// 不挂载:setState 换成直改(handleStepSelect/_buildStepTasks 只读 state,不触渲染)
	inst.setState = (patch, cb) => {
		const next = typeof patch === 'function' ? patch(inst.state) : patch;
		inst.state = { ...inst.state, ...next };
		if(cb){ cb(); }
	};
	return inst;
}

beforeEach(() => {
	captured.tasks.length = 0;
	captured.budgets.length = 0;
	captured.fetches.length = 0;
	try{ window.localStorage.removeItem('horosa.perf.stepSelectPrefetch'); }catch(e){ /* noop */ }
});

describe('DivinationChartShell · 选步长本地预取(键逐字节等)', () => {
	test('handleStepSelect(d):产 ±1/±2 四任务、预算 4、任务名双向成对', () => {
		const inst = makeShell();
		inst.handleStepSelect('d');
		expect(captured.tasks.length).toBe(1);
		expect(captured.budgets[0]).toBe(4);
		const names = captured.tasks[0].map((t) => t.name).sort();
		expect(names).toEqual(['divchart+1d', 'divchart+2d', 'divchart-1d', 'divchart-2d'].sort());
	});

	test('🔴 键等性金标:任务 run 发出的 params === buildChartParams(同 fields·步进后时间)(同一构参路径,逐字节同键)', async () => {
		const inst = makeShell();
		inst.handleStepSelect('d');
		const plus1 = captured.tasks[0].find((t) => t.name === 'divchart+1d');
		await plus1.run();
		expect(captured.fetches.length).toBe(1);
		// 手工用【同一构参函数】构造 +1 天的期望参数 —— 若任务内换了构参路径/字段,此断言必红
		const dt0 = inst.state.fields.date.value;
		const nd = dt0.clone(); nd.addDate(1);
		const expectFields = { ...inst.state.fields, date: { value: nd, name: ['date'] }, time: { value: nd.clone(), name: ['time'] } };
		expect(JSON.stringify(captured.fetches[0].params)).toBe(JSON.stringify(buildChartParams(expectFields)));
		// 预取纪律:silent + 零重试 + cache 承接
		expect(captured.fetches[0].opts).toMatchObject({ cache: true, silent: true, retry: { retries: 0 } });
	});

	test('m 档=4分钟×n(与 DateTimeSelector 分钟档一致,预取键才与真点等)', async () => {
		const inst = makeShell();
		inst.handleStepSelect('m');
		const plus2 = captured.tasks[0].find((t) => t.name === 'divchart+2m');
		await plus2.run();
		const dt0 = inst.state.fields.date.value;
		const nd = dt0.clone(); nd.addMinute(8);   // 2 步×4 分钟
		const expectFields = { ...inst.state.fields, date: { value: nd, name: ['date'] }, time: { value: nd.clone(), name: ['time'] } };
		expect(JSON.stringify(captured.fetches[0].params)).toBe(JSON.stringify(buildChartParams(expectFields)));
	});

	test('同 unit 5s 去重:连点同档只排一轮;换档立即再排', () => {
		const inst = makeShell();
		inst.handleStepSelect('h');
		inst.handleStepSelect('h');
		expect(captured.tasks.length).toBe(1);
		inst.handleStepSelect('y');
		expect(captured.tasks.length).toBe(2);
	});

	test('开关关(horosa.perf.stepSelectPrefetch=0):零行为', () => {
		try{ window.localStorage.setItem('horosa.perf.stepSelectPrefetch', '0'); }catch(e){ /* noop */ }
		const inst = makeShell();
		inst.handleStepSelect('d');
		expect(captured.tasks.length).toBe(0);
	});

	test('settle 后 ±1 预热(_warmAdjacent):未选过档用默认 m、选过用所选档;预算 2', () => {
		const inst = makeShell();
		inst._warmAdjacent();
		expect(captured.tasks.length).toBe(1);
		expect(captured.budgets[0]).toBe(2);
		expect(captured.tasks[0].map((t) => t.name).sort()).toEqual(['divchart+1m', 'divchart-1m'].sort());
		inst.handleStepSelect('y');   // 记档
		inst._warmAdjacent();
		expect(captured.tasks[2].map((t) => t.name).sort()).toEqual(['divchart+1y', 'divchart-1y'].sort());
	});
});

describe('DateTimeSelector · stepSelectPrefetch 函数形态(宿主本地优先)', () => {
	test('函数形态:选步长调宿主函数、绝不 fire 全局 handler;truthy 仍走全局(零回归)', () => {
		jest.isolateModules(() => {
			const DateTimeSelector = require('../../comp/DateTimeSelector').default;
			const sp = require('../../../utils/stepPrefetch');
			const local = jest.fn();
			const inst = new DateTimeSelector({ stepSelectPrefetch: local });
			inst.setState = () => {};   // 不挂载
			inst.changeTimeType('d');
			expect(local).toHaveBeenCalledWith('d');
			expect(sp.fireStepSelectPrefetch).not.toHaveBeenCalled();
			const inst2 = new DateTimeSelector({ stepSelectPrefetch: true });
			inst2.setState = () => {};
			inst2.changeTimeType('h');
			expect(sp.fireStepSelectPrefetch).toHaveBeenCalledWith('h');
		});
	});
});
