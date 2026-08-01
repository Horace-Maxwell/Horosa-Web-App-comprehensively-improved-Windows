// 主限法流派预设守卫(P1-1):复刻 schoolPresets.test.js 的零回归断言模式。
// 🔴 默认档 'horosa' 各维必须 = 应用当前默认(pdMethod='core_alchabitius' 的解耦等价对
// ptolemy×alcabitius + pdtype 0 + 顺逆双开 + Ptolemy 钥匙 + aspect 框架 + 平行关),
// 保证选默认档 = 改动前主限表字节级一致。
import {
	PD_SCHOOL_PRESETS, PD_SCHOOL_PRESET_OPTIONS, PD_SCHOOL_PRESET_DEFAULT,
	PD_SCHOOL_PRESET_CUSTOM, normalizePdSchoolPreset, pdPresetOf,
} from '../pdSchoolPresets';
import { DEFAULT_PD_METHOD, DEFAULT_PD_TIME_KEY } from '../../../utils/primaryDirectionSync';

describe('主限法流派预设 · 零回归锚', ()=>{
	it('默认档 horosa 各维 = 应用当前默认', ()=>{
		const p = PD_SCHOOL_PRESETS[PD_SCHOOL_PRESET_DEFAULT];
		expect(PD_SCHOOL_PRESET_DEFAULT).toBe('horosa');
		// core_alchabitius 的解耦等价对(perpredict._PD_METHOD_TO_PAIR 单一真值:ptolemy×alcabitius)
		expect(DEFAULT_PD_METHOD).toBe('core_alchabitius');
		expect(p.pdProjection).toBe('ptolemy');
		expect(p.pdFrame).toBe('alcabitius');
		expect(p.pdtype).toBe(0);
		expect(p.pdDirect).toBe(1);
		expect(p.pdConverse).toBe(1);          // 现状默认顺逆双开(perchart.pdConverse=True)
		expect(p.pdTimeKey).toBe(DEFAULT_PD_TIME_KEY);
		expect(p.pdFramework).toBe('aspect');
		expect(p.pdParallel).toBe(0);
	});

	it('未接新维的老调用方(全缺省)命中 horosa,不误判自定', ()=>{
		expect(pdPresetOf({})).toBe('horosa');
	});
});

describe('主限法流派预设 · presetOf 反查', ()=>{
	it('每档喂自身维度 → 命中该档(往返)', ()=>{
		Object.keys(PD_SCHOOL_PRESETS).forEach((k)=>{
			expect(pdPresetOf(PD_SCHOOL_PRESETS[k])).toBe(k);
		});
	});

	it('单项被改 → 反查落空 → custom(派生态)', ()=>{
		const base = { ...PD_SCHOOL_PRESETS.horosa };
		expect(pdPresetOf({ ...base, pdTimeKey: 'Naibod' })).toBe(PD_SCHOOL_PRESET_CUSTOM);
		expect(pdPresetOf({ ...base, pdFrame: 'koch' })).toBe(PD_SCHOOL_PRESET_CUSTOM);
		expect(pdPresetOf({ ...base, pdtype: 1 })).toBe(PD_SCHOOL_PRESET_CUSTOM);
	});

	it('六档维度组合互不相同(无档间撞车)', ()=>{
		const sig = (p)=>[p.pdProjection, p.pdFrame, p.pdtype, p.pdDirect, p.pdConverse, p.pdTimeKey, p.pdFramework, p.pdParallel].join('|');
		const sigs = Object.values(PD_SCHOOL_PRESETS).map(sig);
		expect(new Set(sigs).size).toBe(sigs.length);
	});
});

describe('主限法流派预设 · 选项与规范化', ()=>{
	it('OPTIONS = 六档 + 自定,自定收尾', ()=>{
		expect(PD_SCHOOL_PRESET_OPTIONS.length).toBe(Object.keys(PD_SCHOOL_PRESETS).length + 1);
		expect(PD_SCHOOL_PRESET_OPTIONS[PD_SCHOOL_PRESET_OPTIONS.length - 1].value).toBe(PD_SCHOOL_PRESET_CUSTOM);
	});

	it('normalize:未知回默认,custom 保持', ()=>{
		expect(normalizePdSchoolPreset('nonsense')).toBe(PD_SCHOOL_PRESET_DEFAULT);
		expect(normalizePdSchoolPreset(PD_SCHOOL_PRESET_CUSTOM)).toBe(PD_SCHOOL_PRESET_CUSTOM);
		expect(normalizePdSchoolPreset('lilly_morin')).toBe('lilly_morin');
	});

	it('档表投影/定局值 ⊆ 引擎白名单域(与 perchart 读入白名单同源)', ()=>{
		const PROJ = ['ptolemy', 'placidus', 'regiomontanus', 'campanus', 'topocentric',
			'zodiacal', 'ra_direct', 'in_zodiaco_lon', 'in_zodiaco_abs', 'horosa_legacy'];
		const FRAME = ['alcabitius', 'placidus', 'regiomontanus', 'campanus', 'topocentric',
			'meridian', 'porphyry', 'equal', 'wholesign', 'morinus', 'koch', 'equal_hour_circle'];
		Object.values(PD_SCHOOL_PRESETS).forEach((p)=>{
			expect(PROJ).toContain(p.pdProjection);
			expect(FRAME).toContain(p.pdFrame);
			expect(['aspect', 'bounds', 'release']).toContain(p.pdFramework);
		});
	});
});
