// 主限法设置「置灰」规则 × 引擎全量矩阵 双向锁。
// 夹具 fixtures/pdSettingInertMatrix.json 由引擎逐行比对生成(两盘 × 三种方向 × 全部弧算法 × 每个设置值;
// 生成脚本思路见夹具 note):inert = 该设置所有取值在两盘上都不改变任何一行(弧 / 迫星 / 应星 / 日期)。
// 锁的两件事:① 引擎里不起作用的组合,界面规则必须给出原因(不许留无说明的死开关);
//            ② 引擎里起作用的组合,界面规则必须放行(不许把活开关误置灰)。
import { pdSettingInertReason, pdExtensionOptionInertReason } from '../primaryDirectionSync';

const M = require('./fixtures/pdSettingInertMatrix.json');
const E = require('./fixtures/pdExtensionInertMatrix.json');

describe('pdSettingInertReason ⇔ 引擎全量矩阵', ()=>{
	it('夹具覆盖三种方向 × 全部弧算法', ()=>{
		const types = new Set(M.entries.map((e)=>e[0]));
		const projs = new Set(M.entries.map((e)=>e[1]));
		expect([...types].sort()).toEqual([0, 1, 4]);
		expect(projs.size).toBeGreaterThanOrEqual(14);
	});

	it.each(M.entries)('方向 %s · %s · %s → 引擎不起作用 = %s', (pdtype, projection, key, inert)=>{
		const timeKey = key === 'pdSolarArcRegressive' ? 'TrueSolarArc' : 'Ptolemy';
		const reason = pdSettingInertReason(key, { pdtype, projection, geometry: 'improved', timeKey, values: {} });
		expect(!!reason).toBe(inert);
	});

	it('取值相关的条件:改离缺省后才起作用的项按当前取值判定', ()=>{
		const ctx = { pdtype: 0, projection: 'placidus', timeKey: 'Ptolemy' };
		expect(pdSettingInertReason('pdIgnorePromLat', { ...ctx, values: {} })).not.toBe('');
		expect(pdSettingInertReason('pdIgnorePromLat', { ...ctx, values: { pdPromAspectLat: 2 } })).toBe('');
		expect(pdSettingInertReason('pdSolarArcRegressive', { ...ctx, values: {} })).not.toBe('');
		expect(pdSettingInertReason('pdSolarArcRegressive', { ...ctx, timeKey: 'TrueSolarArcMean', values: {} })).toBe('');
		expect(pdSettingInertReason('pdIgnorePromLat', { pdtype: 4, projection: 'placidus', geometry: 'classic', values: {} })).not.toBe('');
		expect(pdSettingInertReason('pdIgnorePromLat', { pdtype: 4, projection: 'placidus', geometry: 'improved', values: {} })).toBe('');
	});

	it.each(E.entries)('方向 %s · %s · %s=%s → 引擎不起作用 = %s', (pdtype, projection, group, value, inert)=>{
		expect(!!pdExtensionOptionInertReason(group, value, { pdtype, projection })).toBe(inert);
	});
});
