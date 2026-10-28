// 奇门 / 三式的「时间算法」只作用于本页(与六壬 / 八字覆盖层同):改它不写共用字段 fields.timeAlg ——
// 此前写进共用字段,紫微 / 七政本次会话跟着变,重开又回到新盘缺省。本页自己的计算照常按所选档。
require('../../../models/astro');
const { fieldsSchemaBaseline } = require('../../../utils/recordFieldsRestore');

function stubbed(Cls, props){
	const inst = new Cls(props);
	inst.setState = (patch, cb)=>{ inst.state = { ...inst.state, ...(typeof patch === 'function' ? patch(inst.state) : patch) }; if(cb){ cb(); } };
	['requestNongli', 'prefetchNongliForFields', 'prefetchJieqiSeedForFields', 'recalc'].forEach((m)=>{ inst[m] = jest.fn(); });
	return inst;
}

test('🔴 奇门:改时间算法不写共用字段,本页 options 与本页字段照常换档', ()=>{
	window.localStorage.clear();
	const DunJiaMain = require('../DunJiaMain').default;
	const fields = fieldsSchemaBaseline();
	const writes = [];
	const inst = stubbed(DunJiaMain, { fields, dispatch: jest.fn() });
	inst.onFieldsChange = (patch)=>{ writes.push(patch); };
	inst.onOptionChange('timeAlg', 1);
	expect(writes.some((w)=>w && w.timeAlg !== undefined)).toBe(false);
	expect(inst.state.options.timeAlg).toBe(1);
	expect(inst.state.localFields.timeAlg.value).toBe(1);
});

test('🔴 三式:改时间算法不写共用字段,本页 options 照常换档', ()=>{
	window.localStorage.clear();
	const SanShiUnitedMain = require('../../sanshi/SanShiUnitedMain').default;
	const fields = fieldsSchemaBaseline();
	const writes = [];
	const inst = stubbed(SanShiUnitedMain, { fields, dispatch: jest.fn(), hook: {} });
	inst.onFieldsChange = (patch)=>{ writes.push(patch); };
	inst.onOptionChange = jest.fn();
	inst.onTimeAlgChange(1);
	expect(writes.some((w)=>w && w.timeAlg !== undefined)).toBe(false);
	expect(inst.onOptionChange).toHaveBeenCalledWith('timeAlg', 1);
	expect(inst.state.localFields.timeAlg.value).toBe(1);
});

describe('三式合一同口径:时间算法只作用于本页', ()=>{
	test('🔴 改时间算法后点「起盘」:共用 fields 不收 timeAlg(此前起盘时比对出差异就写进共用字段)', ()=>{
		require('../../../models/astro');
		const { fieldsSchemaBaseline } = require('../../../utils/recordFieldsRestore');
		const SanShiUnitedMain = require('../../sanshi/SanShiUnitedMain').default;
		window.localStorage.clear();
		const fields = fieldsSchemaBaseline();
		const dispatch = jest.fn();
		const inst = new SanShiUnitedMain({ fields, dispatch, hook: {} });
		inst.setState = (patch, cb)=>{ inst.state = { ...inst.state, ...(typeof patch === 'function' ? patch(inst.state) : patch) }; if(cb){ cb(); } };
		['requestNongli', 'prefetchNongliForFields', 'prefetchJieqiSeedForFields', 'recalc', 'refreshAll'].forEach((m)=>{ inst[m] = jest.fn(); });
		inst.state.loading = false;
		const before = fields.timeAlg ? fields.timeAlg.value : undefined;
		inst.onTimeAlgChange(before === 1 ? 0 : 1);
		inst.timeHook = { getValue: ()=>null };
		inst.clickPlot();
		const writes = dispatch.mock.calls.map((c)=>c[0]).filter((a)=>a.type === 'astro/save' || a.type === 'astro/fetchByFields');
		writes.forEach((a)=>{ const f = a.payload.fields || a.payload; expect(f.timeAlg === undefined || `${f.timeAlg.value}` === `${before}`).toBe(true); });
		const src = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'sanshi', 'SanShiUnitedMain.js'), 'utf8');
		expect(src).toContain('delete sharedPatch.timeAlg;');
	});
});
