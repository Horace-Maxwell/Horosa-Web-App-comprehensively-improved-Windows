// [Q-257/T-220] 「存为命盘」非默认捕获基准:古典口径键按 CLASSICAL_PARAM_SPEC.default,不经全局仓播种值——
// 全局仓与盘同为非默认(如 sectBuffer=ptolemy5)时仍须落库,否则改全局 / 换机后该盘漂移。
import { captureNonDefaultTechniqueFields } from '../recordFieldsRestore';
import { setClassicalChartGlobal, __resetClassicalGlobalsCacheForTest } from '../classicalChartGlobals';
import '../../models/astro';   // 注册 newEmptyFields 基准工厂(与真机同链)

describe('非默认捕获基准 = spec 默认', ()=>{
	beforeEach(()=>{ window.localStorage.clear(); __resetClassicalGlobalsCacheForTest(); });

	test('全局仓拨到非默认后,同值盘仍被捕获为非默认', ()=>{
		const fields = { sectBuffer: { name: ['sectBuffer'], value: 'ptolemy5' }, triplicity: { name: ['triplicity'], value: 'Ptolemaic' } };
		const before = captureNonDefaultTechniqueFields(fields);
		expect(before.sectBuffer).toBe('ptolemy5');
		expect(before.triplicity).toBe('Ptolemaic');
		setClassicalChartGlobal('sectBuffer', 'ptolemy5');
		setClassicalChartGlobal('triplicity', 'Ptolemaic');
		__resetClassicalGlobalsCacheForTest();
		const after = captureNonDefaultTechniqueFields(fields);
		expect(after.sectBuffer).toBe('ptolemy5');
		expect(after.triplicity).toBe('Ptolemaic');
	});

	test('schema 默认值零落键(缺省用户字节不变)', ()=>{
		const fields = { sectBuffer: { name: ['sectBuffer'], value: 'geo' }, triplicity: { name: ['triplicity'], value: 'Dorothean' }, lotReversal: { name: ['lotReversal'], value: 1 } };
		const out = captureNonDefaultTechniqueFields(fields);
		expect(out).not.toHaveProperty('sectBuffer');
		expect(out).not.toHaveProperty('triplicity');
		expect(out).not.toHaveProperty('lotReversal');
	});
});
