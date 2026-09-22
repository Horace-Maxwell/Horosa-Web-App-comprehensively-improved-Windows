// G34 流派预设派生守卫:左栏「流派预设」下拉的显示值 = matchSchoolPreset(当前fields, 当前display) 纯派生。
// 病根回归:该下拉曾 value="custom" 写死 → 选任何流派后仍显「自定」(用户报「选后不显所选流派」)。
// 改为纯派生后:命中某预设的完整键值 → 显该派;微调任一相关开关 → 诚实回落「自定」。
import { matchSchoolPreset, GUOLAO_SCHOOL_PRESETS } from '../GuoLaoChartStyle';

describe('matchSchoolPreset 流派预设纯派生', ()=>{
	// 每个预设「自身完整配置」应派生回自己的键(选后即显所选流派)
	Object.keys(GUOLAO_SCHOOL_PRESETS).forEach((key)=>{
		it(`预设 ${key} 的完整配置 → 派生回 '${key}'`, ()=>{
			const p = GUOLAO_SCHOOL_PRESETS[key];
			expect(matchSchoolPreset({ ...p.fields }, { ...p.display })).toBe(key);
		});
	});

	it('默认配置(占星上升 asc + 今宿 su28=2 + 宫主 + 古度)→ 自定,不误命中任何预设', ()=>{
		expect(matchSchoolPreset(
			{ guolaoLifeMode: 'asc', guolaoBodyMode: 'taiyin', guolaoTrueSolarTime: 'mean', guolaoNodeType: 'mean', doubingSu28: 2 },
			{ lifeMasterMode: 'gong', minorLimitType: '' },
		)).toBe('custom');
	});

	it('琴堂配置改动命主取法(宫主→度主)→ 回自定', ()=>{
		expect(matchSchoolPreset(
			{ ...GUOLAO_SCHOOL_PRESETS.qintang.fields },
			{ ...GUOLAO_SCHOOL_PRESETS.qintang.display, lifeMasterMode: 'du' },
		)).toBe('custom');
	});

	it('琴堂配置改动身宫法(逢酉→太阴)→ 回自定', ()=>{
		expect(matchSchoolPreset(
			{ ...GUOLAO_SCHOOL_PRESETS.qintang.fields, guolaoBodyMode: 'taiyin' },
			{ ...GUOLAO_SCHOOL_PRESETS.qintang.display },
		)).toBe('custom');
	});

	it('预设对「未声明键」不敏感:琴堂未定义 guolaoNodeType,任意值仍命中 qintang(motionState 已整键删除,传了也不参与)', ()=>{
		expect(matchSchoolPreset(
			{ ...GUOLAO_SCHOOL_PRESETS.qintang.fields, guolaoNodeType: 'true' },
			{ ...GUOLAO_SCHOOL_PRESETS.qintang.display, motionState: true },
		)).toBe('qintang');
	});

	it('doubingSu28 数字/字符串等价("5" 命中 huujiao 的 5)', ()=>{
		expect(matchSchoolPreset(
			{ ...GUOLAO_SCHOOL_PRESETS.huujiao.fields, doubingSu28: '5' },
			{ ...GUOLAO_SCHOOL_PRESETS.huujiao.display },
		)).toBe('huujiao');
	});

	it('guolaoLifeMode 经 normalize(未知值回落 asc)后再匹配', ()=>{
		// 未知 lifeMode → normalize 回 asc;配 su28≠5 → 不命中 huujiao → 自定
		expect(matchSchoolPreset(
			{ guolaoLifeMode: '__unknown__', guolaoBodyMode: 'taiyin', guolaoTrueSolarTime: 'true', guolaoNodeType: 'true', doubingSu28: 2 },
			{ lifeMasterMode: 'gong', minorLimitType: '' },
		)).toBe('custom');
	});
});
