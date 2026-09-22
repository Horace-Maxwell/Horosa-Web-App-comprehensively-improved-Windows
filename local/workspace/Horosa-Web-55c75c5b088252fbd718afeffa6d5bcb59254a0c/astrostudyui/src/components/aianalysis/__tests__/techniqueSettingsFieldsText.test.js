// [Q-020/M-26] 挂载抽屉 text 字段:normalize 产出的对象数组(紫微太岁关系人)按 branch:role:sex 反序列化显示,不再 [object Object]。
import { textFieldDisplayValue } from '../TechniqueSettingsFields';
import { pruneOptionsToNonDefault } from '../../../utils/techniqueMountSettings';

global.React = require('react');

describe('textFieldDisplayValue', () => {
	it('对象数组 → 「支:角色:性别」空格分隔;字符串原样;空 → 空串', () => {
		expect(textFieldDisplayValue([{ branch: '午', role: '母', sex: 'female' }, { branch: '子', role: '', sex: '' }])).toBe('午:母:female 子');
		expect(textFieldDisplayValue('午:母:female 子')).toBe('午:母:female 子');
		expect(textFieldDisplayValue(undefined)).toBe('');
		expect(textFieldDisplayValue(null)).toBe('');
		expect(textFieldDisplayValue(3)).toBe('3');
	});
	it('往返:剪枝存的归一对象数组 → 显示文本 → 再 normalize 得同一组关系人(不再切碎)', () => {
		const pruned = pruneOptionsToNonDefault('ziwei', { taiSuiRelatives: '午:母:female 子' }, { taiSuiRelatives: '', taiSuiRuGua: 1 });   // 入卦开=字段可见
		expect(Array.isArray(pruned.taiSuiRelatives)).toBe(true);
		const shown = textFieldDisplayValue(pruned.taiSuiRelatives);
		expect(shown).toBe('午:母:female 子');
		expect(shown).not.toContain('[object');
		const again = pruneOptionsToNonDefault('ziwei', { taiSuiRelatives: shown }, { taiSuiRelatives: '', taiSuiRuGua: 1 });
		expect(again.taiSuiRelatives).toEqual(pruned.taiSuiRelatives);
	});
});
