// [Windows-only] horosa_slice_prop_cover_v1(v3.13.1,gotcha #115):果老 memoTransitParams 的记忆键必须含「有效日出口径」。
// 上游 v3.13.1 起 paramsWithMoiraTransit → guolaoSunriseMode:fields 里没有 sunriseMode 时回落全局古典设置。
// 我方 PERF-R9 的记忆化只按 (fields, moiraTransitTime) 引用记 —— 全局口径改了而 fields 引用不变(嵌入宿主不回写)时,
// 择日表 / 择日轮 / 左栏会一直拿旧口径的 transitParams。本用例按真实读路径驱动:同一 fields、同一时刻,只改全局口径。
jest.mock('../main/params', () => {
	const actual = jest.requireActual('../main/params');
	let n = 0;
	return {
		...actual,
		// 每次真算都返回新对象并带上当时的有效口径 —— 记忆命中 = 同一引用
		paramsWithMoiraTransit: (fields) => ({ sunriseMode: actual.guolaoSunriseMode(fields), computed: ++n }),
	};
});

import GuoLaoChartMain from '../GuoLaoChartMain';
import { setClassicalChartGlobal, __resetClassicalGlobalsCacheForTest, CLASSICAL_GLOBALS_STORAGE_KEY } from '../../../utils/classicalChartGlobals';

function host(fields, tm){
	return { props: { fields }, state: { moiraTransitTime: tm } };
}

describe('果老 memoTransitParams × 日出口径(全局回落)', () => {
	beforeEach(() => {
		window.localStorage.removeItem(CLASSICAL_GLOBALS_STORAGE_KEY);
		__resetClassicalGlobalsCacheForTest();
	});

	test('同 fields 同时刻:命中记忆(同一引用),不重算', () => {
		const h = host({}, null);
		const a = GuoLaoChartMain.prototype.memoTransitParams.call(h);
		const b = GuoLaoChartMain.prototype.memoTransitParams.call(h);
		expect(b).toBe(a);
	});

	test('只改全局日出口径(fields 引用不变):必须重算并带上新口径', () => {
		const h = host({}, null);
		const before = GuoLaoChartMain.prototype.memoTransitParams.call(h);
		expect(before.sunriseMode).toBe('center');
		setClassicalChartGlobal('sunriseMode', 'apparent');
		const after = GuoLaoChartMain.prototype.memoTransitParams.call(h);
		expect(after).not.toBe(before);
		expect(after.sunriseMode).toBe('apparent');
	});

	test('fields 自带口径时以 fields 为准,全局改动不影响(记忆照常命中)', () => {
		const h = host({ sunriseMode: { value: 'center' } }, null);
		const a = GuoLaoChartMain.prototype.memoTransitParams.call(h);
		setClassicalChartGlobal('sunriseMode', 'apparent');
		const b = GuoLaoChartMain.prototype.memoTransitParams.call(h);
		expect(b).toBe(a);
		expect(b.sunriseMode).toBe('center');
	});
});
