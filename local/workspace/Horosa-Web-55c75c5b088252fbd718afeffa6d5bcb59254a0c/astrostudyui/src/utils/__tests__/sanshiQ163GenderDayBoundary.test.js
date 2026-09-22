// [Q-163/T-82…T-85] 三式四条确证子项(SS-14/15/16/17)金标:
//   ① 六壬事盘 gender 单源=卜卦人性别(与盘面/行年/快照同源;未填才回落起课区全局值)
//   ② 奇门标签型 sex 初值/外部 fields.gender 变化随全局(0/1;未知不动)
//   ③ 太乙「时间基准」真太阳时档在历法未回时如实标注(计算路径不变)
//   ④ 太乙挂载日界两键 default=globalCurrent=实时全局(与奇门/三式同口径);fetchTaiyiPan 兜底同源
import fs from 'fs';
import path from 'path';
import { liurengCaseGender } from '../../components/lrzhan/LiuRengMain';
import { syncedSexFromFields } from '../../components/dunjia/DunJiaMain';
import { normalizeBackendPan } from '../../components/taiyi/TaiYiCalc';
import { TECHNIQUE_SETTINGS_SCHEMA } from '../techniqueMountSettings';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../dayBoundary';

const TAIYI_CALC_SRC = fs.readFileSync(path.resolve(__dirname, '../../components/taiyi/TaiYiCalc.js'), 'utf8');
const CTX_SRC = fs.readFileSync(path.resolve(__dirname, '../aiAnalysisContext.js'), 'utf8');

describe('[Q-163] 三式性别/日界/时间基准 确证子项', ()=>{
	test('① 六壬 record.gender 取卜卦人性别;卜卦人未知(-1)时才回落起课区全局值', ()=>{
		const flds = { gender: { value: 1 } };
		expect(liurengCaseGender({ gender: { value: 0 } }, flds)).toBe(0);
		expect(liurengCaseGender({ gender: { value: '0' } }, flds)).toBe(0);
		expect(liurengCaseGender({ gender: { value: 1 } }, { gender: { value: 0 } })).toBe(1);
		expect(liurengCaseGender({ gender: { value: -1 } }, flds)).toBe(1);
		expect(liurengCaseGender(null, { gender: { value: 0 } })).toBe(0);
	});

	test('② 奇门 sex 随全局 fields.gender:0/1(含字符串)同步,未知/-1/缺失不动(null)', ()=>{
		expect(syncedSexFromFields({ gender: { value: 0 } })).toBe(0);
		expect(syncedSexFromFields({ gender: { value: '1' } })).toBe(1);
		expect(syncedSexFromFields({ gender: { value: -1 } })).toBeNull();
		expect(syncedSexFromFields({})).toBeNull();
		expect(syncedSexFromFields(null)).toBeNull();
	});

	test('③ 太乙时间基准标签:真太阳时且历法未回 → 如实标注按直接时间;有 nongli.birth → 「真太阳时」;直接时间档不变', ()=>{
		const pan = { style: 3, palace16: [] };
		const a = normalizeBackendPan(pan, { timeBasis: 'trueSolar' }, null, null);
		expect(a.options.timeBasisLabel).toBe('真太阳时（历法服务未回，本次按直接时间立局）');
		const b = normalizeBackendPan(pan, { timeBasis: 'trueSolar' }, { birth: '2026-01-01 12:00:00' }, null);
		expect(b.options.timeBasisLabel).toBe('真太阳时');
		const c = normalizeBackendPan(pan, { timeBasis: 'direct' }, null, null);
		expect(c.options.timeBasisLabel).toBe('直接时间');
		// 计算路径不变:trueSolar 缺 nongli 仍回落直接时间(源码哨兵)
		expect(TAIYI_CALC_SRC).toContain("return parseDateTimeText(nongli && nongli.birth) || direct;");
	});

	test('④ 太乙挂载日界两键 default=globalCurrent=实时全局;fetchTaiyiPan 与 regenerateTaiyiSnapshot 兜底同源', ()=>{
		const fields = TECHNIQUE_SETTINGS_SCHEMA.taiyi.fields;
		const a23 = fields.find((f)=>f.name === 'after23NewDay');
		const lz = fields.find((f)=>f.name === 'lateZiHourUseNextDay');
		expect(a23 && typeof a23.globalCurrent).toBe('function');
		expect(a23.globalCurrent()).toBe(defaultAfter23NewDay());
		expect(a23.default).toBe(defaultAfter23NewDay());
		expect(lz && typeof lz.globalCurrent).toBe('function');
		expect(lz.globalCurrent()).toBe(defaultLateZiHourUseNextDay());
		expect(TAIYI_CALC_SRC).toContain("after23NewDay: opt.after23NewDay !== undefined ? opt.after23NewDay : defaultAfter23NewDay(),");
		expect(TAIYI_CALC_SRC).not.toMatch(/after23NewDay: opt\.after23NewDay !== undefined \? opt\.after23NewDay : 0,/);
		// regenerateTaiyiSnapshot:DEFAULT_TAIYI_OPTIONS 不再写死 0/1,合并时现取全局
		const m = CTX_SRC.match(/async function regenerateTaiyiSnapshot[\s\S]*?const po = /);
		expect(m ? m[0] : 'regenerateTaiyiSnapshot 未定位').toContain('after23NewDay: defaultAfter23NewDay(),');
		expect(m[0]).toContain('lateZiHourUseNextDay: defaultLateZiHourUseNextDay(),');
		const d = CTX_SRC.match(/const DEFAULT_TAIYI_OPTIONS = \{[\s\S]*?\n\};/);
		expect(d[0]).not.toMatch(/after23NewDay: 0,/);
	});
});
