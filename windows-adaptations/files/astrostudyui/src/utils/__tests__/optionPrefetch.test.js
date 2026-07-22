// horosa_option_prefetch_v1 金标(PERF-R10 Ship5-P2 核心):
//   ① Hamming-1:每个变体与当前 fields 恰差一个轴,且值来自该轴声明域;
//   ② 预算 ≤4;走 scheduleDataWarmGroup(空闲通道,不进步进泵);
//   ③ NO_ARM 技法 / 关闸 / builder 未注册 → 零任务;
//   ④ 任务形状 = {name, task}(idleWarmQueue 消费 task 属性 —— 写错属性名=静默零执行)。
jest.mock('../idleWarmQueue', () => ({
	scheduleDataWarmGroup: jest.fn(),
}));

import { scheduleDataWarmGroup } from '../idleWarmQueue';
import {
	speculateChartOptions, registerOptionChartTaskBuilder, __resetOptionPrefetchForTest,
	BINARY_CHART_AXES,
} from '../optionPrefetch';

const mkFields = () => ({
	date: { value: { clone(){ return this; }, format(){ return 'x'; } } },
	zodiacal: { value: 0 }, southchart: { value: 0 }, tradition: { value: 1 }, simpleAsp: { value: 0 },
	hsys: { value: 1 },
});
const ST = (tab) => ({ currentTab: tab || 'astrochart', chartObj: { chartId: 'cid12345' } });

beforeEach(() => {
	__resetOptionPrefetchForTest();
	scheduleDataWarmGroup.mockClear();
	window.localStorage.removeItem('horosa.perf.optionPrefetch');
});

test('Hamming-1:恰翻一轴、值取轴域另一端;预算 4;任务形状 {name, task}', () => {
	const seen = [];
	registerOptionChartTaskBuilder((variant) => {
		seen.push(variant);
		return { name: 'chart', path: '/chart', run: () => Promise.resolve() };
	});
	const n = speculateChartOptions(mkFields(), ST());
	expect(n).toBe(4);
	expect(seen.length).toBe(4);
	const base = mkFields();
	seen.forEach((variant, i) => {
		const axis = BINARY_CHART_AXES[i];
		Object.keys(base).forEach((k) => {
			if (k === axis.key) {
				expect(variant[k].value).not.toBe(base[k].value);
				expect(axis.values).toContain(variant[k].value);
			} else if (k !== 'date') {
				expect(variant[k].value).toBe(base[k].value);
			}
		});
	});
	expect(scheduleDataWarmGroup).toHaveBeenCalledTimes(1);
	const [gen, tasks] = scheduleDataWarmGroup.mock.calls[0];
	expect(gen).toBe('opt:astrochart:cid12345');
	expect(tasks).toHaveLength(4);
	tasks.forEach((t) => {
		expect(typeof t.task).toBe('function');   // idleWarmQueue 只认 task 属性
		expect(t.name).toMatch(/^opt:/);
	});
});

test('NO_ARM 技法(随机/取现时/流式/浏览型)零任务', () => {
	registerOptionChartTaskBuilder(() => ({ run: () => Promise.resolve() }));
	['guazhan', 'planetarium', 'aianalysis', 'xuanshi'].forEach((tab) => {
		expect(speculateChartOptions(mkFields(), ST(tab))).toBe(0);
	});
	expect(scheduleDataWarmGroup).not.toHaveBeenCalled();
});

test('关闸 / builder 未注册 → 零任务', () => {
	expect(speculateChartOptions(mkFields(), ST())).toBe(0);   // 未注册
	registerOptionChartTaskBuilder(() => ({ run: () => Promise.resolve() }));
	window.localStorage.setItem('horosa.perf.optionPrefetch', '0');
	expect(speculateChartOptions(mkFields(), ST())).toBe(0);   // 关闸
	expect(scheduleDataWarmGroup).not.toHaveBeenCalled();
});
