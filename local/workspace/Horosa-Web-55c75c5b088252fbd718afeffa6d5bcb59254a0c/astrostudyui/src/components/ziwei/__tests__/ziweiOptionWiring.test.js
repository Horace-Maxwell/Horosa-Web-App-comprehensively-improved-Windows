// 紫微引擎选项「清单同步哨兵」:新增 ZWEngineOptions 键时,preset 应用链(lsMap/boolMap)与
// ZIWEI_PRESET_OPT_KEYS 极易漏改一处 —— 漏 lsMap=套 preset 不落该键(D15 类死开关),
// 漏 OPT_KEYS=presetMatches 恒真误判。本哨兵把三份清单钉成同一集合,漏任何一处当场红。
// 🔴 有意不进清单的键(改这里前先读理由):
//   - taiSuiRelatives:数组类关系人,preset 不设(恒 [])
//   (xiaoxianMode 已于 [B15] 迁入 ZWEngineOptions 体系,豁免注销,三清单哨兵自动覆盖)
import fs from 'fs';
import path from 'path';
import { ZIWEI_PRESET_OPT_KEYS } from '../ziweiPresets';
import { ZWEngineOptions } from '../ziweiOptions';

const inputSrc = fs.readFileSync(path.join(__dirname, '../ZiWeiInput.js'), 'utf8');

function literalKeys(varName){
	const m = inputSrc.match(new RegExp(`const ${varName} = \\{([^}]*)\\}`));
	if(!m){ return null; }
	return m[1].split(',').map((kv) => kv.split(':')[0].trim()).filter(Boolean);
}

describe('引擎选项三清单同步(lsMap ∪ boolMap ≡ ZIWEI_PRESET_OPT_KEYS)', () => {
	test('🔴 onPresetChange 的 lsMap+boolMap 键集 === OPT_KEYS(新键漏挂任一处即红)', () => {
		const ls = literalKeys('lsMap');
		const bool = literalKeys('boolMap');
		expect(ls).toBeTruthy();
		expect(bool).toBeTruthy();
		expect([...ls, ...bool].sort()).toEqual([...ZIWEI_PRESET_OPT_KEYS].sort());
	});
	test('OPT_KEYS ⊆ ZWEngineOptions 实有键(防 preset 写不存在的键)', () => {
		ZIWEI_PRESET_OPT_KEYS.forEach((k) => {
			expect(Object.prototype.hasOwnProperty.call(ZWEngineOptions, k)).toBe(true);
		});
	});
	test('ZWEngineOptions 键 − OPT_KEYS 差集被显式登记(新键必到此对账)', () => {
		const off = Object.keys(ZWEngineOptions).filter((k) => !ZIWEI_PRESET_OPT_KEYS.includes(k));
		// taiSuiRelatives=数组类关系人(preset 恒不设)。新增「有意不进 preset」的键须在此登记并写明理由。
		expect(off.sort()).toEqual(['taiSuiRelatives']);
	});
});
