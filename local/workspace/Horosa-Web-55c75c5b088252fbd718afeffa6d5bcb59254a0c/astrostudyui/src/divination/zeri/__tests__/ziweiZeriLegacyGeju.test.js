// 「巨机卯酉」拆成「巨机居酉」+「巨机破荡(女命)」(另立卯宫富贵格「巨机同临」)后,存过旧名的择日方案不得静默落空。
import { expandLegacyGeju, ZIWEI_CONDITION_TYPES } from '../ziweiZeriConditionTypes';
import GE_PATTERNS from '../../../components/ziwei/data/tables/ziweige.json';

describe('紫微择日 格局旧名兼容', ()=>{
	test('旧名展开为拆分后的两格,其余原样去重', ()=>{
		expect(expandLegacyGeju(['巨机卯酉', '紫府同宫', '巨机居酉'])).toEqual(['巨机居酉', '巨机破荡(女命)', '紫府同宫']);
	});
	test('展开目标都是现表格局', ()=>{
		expandLegacyGeju(['巨机卯酉']).forEach((n)=>expect(GE_PATTERNS[n]).toBeTruthy());
		expect(GE_PATTERNS['巨机卯酉']).toBeUndefined();
	});
	test('旧方案命中巨机居酉时判过', ()=>{
		const t = ZIWEI_CONDITION_TYPES.geju_hit;
		const ctx = { geju: ()=>[{ name: '巨机居酉', broken: true }] };
		expect(t.evaluate({}, { mode: 'with', broken: 'any', values: ['巨机卯酉'] }, ctx).pass).toBe(true);
		expect(t.evaluate({}, { mode: 'without', values: ['巨机卯酉'] }, ctx).pass).toBe(false);
	});
	test('标签格数跟表走', ()=>{
		expect(ZIWEI_CONDITION_TYPES.geju_hit.label).toBe(`格局命中(${Object.keys(GE_PATTERNS).length} 格)`);
	});
});
