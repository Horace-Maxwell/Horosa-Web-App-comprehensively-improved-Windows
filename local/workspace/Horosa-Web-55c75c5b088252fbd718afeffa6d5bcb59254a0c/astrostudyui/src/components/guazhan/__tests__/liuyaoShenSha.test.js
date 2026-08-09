import {
	computeShenSha, shenShaOnZhi, annotateShenSha,
	SHENSHA_META, DEFAULT_SHENSHA_SET,
} from '../../gua/liuyaoShenSha';

describe('六爻神煞·WP-F(表H)', () => {
	test('默认精简 9 种(不含文昌)', () => {
		expect(DEFAULT_SHENSHA_SET).toHaveLength(9);
		expect(DEFAULT_SHENSHA_SET).not.toContain('文昌');
		expect(SHENSHA_META.length).toBe(10); // 9 + 文昌
	});

	test('日干起:甲日 贵人丑未/禄寅/羊刃卯', () => {
		const m = computeShenSha({ dayGan: '甲', dayZhi: '子' }, {});
		expect(m['天乙贵人']).toEqual(['丑', '未']);
		expect(m['禄神']).toEqual(['寅']);
		expect(m['羊刃']).toEqual(['卯']);
	});

	test('日干起:丙日 贵人亥酉/禄巳/羊刃午', () => {
		const m = computeShenSha({ dayGan: '丙', dayZhi: '午' }, {});
		expect(m['天乙贵人']).toEqual(['亥', '酉']);
		expect(m['禄神']).toEqual(['巳']);
		expect(m['羊刃']).toEqual(['午']);
	});

	test('三合局起:子日(申子辰) 驿马寅/桃花酉/将星子/华盖辰/劫煞巳/亡神亥', () => {
		const m = computeShenSha({ dayGan: '甲', dayZhi: '子' }, {});
		expect(m['驿马']).toEqual(['寅']);
		expect(m['桃花']).toEqual(['酉']);
		expect(m['将星']).toEqual(['子']);
		expect(m['华盖']).toEqual(['辰']);
		expect(m['劫煞']).toEqual(['巳']);
		expect(m['亡神']).toEqual(['亥']);
	});

	test('三合局起:午日(寅午戌) 驿马申/将星午', () => {
		const m = computeShenSha({ dayGan: '丙', dayZhi: '午' }, {});
		expect(m['驿马']).toEqual(['申']);
		expect(m['将星']).toEqual(['午']);
	});

	test('文昌备选(opt-in):甲日文昌巳', () => {
		const m = computeShenSha({ dayGan: '甲', dayZhi: '子' }, { set: [...DEFAULT_SHENSHA_SET, '文昌'] });
		expect(m['文昌']).toEqual(['巳']);
		const m2 = computeShenSha({ dayGan: '甲', dayZhi: '子' }, {});
		expect(m2['文昌']).toBeUndefined(); // 默认不取
	});

	test('年起切换:用年干支(丙午)而非日干支', () => {
		const m = computeShenSha({ dayGan: '甲', dayZhi: '子', yearGan: '丙', yearZhi: '午' }, { base: 'year' });
		expect(m['天乙贵人']).toEqual(['亥', '酉']); // 丙
		expect(m['将星']).toEqual(['午']);          // 寅午戌
	});

	test('逐爻标注:寅爻带禄神+驿马(甲子日)、子爻带将星', () => {
		const m = computeShenSha({ dayGan: '甲', dayZhi: '子' }, {});
		expect(shenShaOnZhi('寅', m).sort()).toEqual(['禄神', '驿马']);
		expect(shenShaOnZhi('子', m)).toEqual(['将星']);
		expect(shenShaOnZhi('辰', m)).toEqual(['华盖']);
	});

	test('annotateShenSha:逐爻输出', () => {
		const yaos = [{ pos: 1, zhi: '子' }, { pos: 2, zhi: '寅' }];
		const r = annotateShenSha(yaos, { dayGan: '甲', dayZhi: '子' }, {});
		expect(r.perYao[0]).toMatchObject({ pos: 1, zhi: '子', shensha: ['将星'] });
		expect(r.perYao[1].shensha.sort()).toEqual(['禄神', '驿马']);
	});

	test('勾选子集:只启用 驿马+桃花', () => {
		const m = computeShenSha({ dayGan: '甲', dayZhi: '子' }, { set: ['驿马', '桃花'] });
		expect(Object.keys(m).sort()).toEqual(['桃花', '驿马']);
	});
});

// ══ [G1] 贵人歌诀两档(delta 变体,基表零动) ═══
describe('[G1] guirenOf 贵人歌诀档', ()=>{
	const { guirenOf, computeShenSha } = require('../../gua/liuyaoShenSha');
	test('🔴 两档落支:庚 丑未↔寅午;辛两档同=寅午;其余八干恒同;未知档回落基表', ()=>{
		expect(guirenOf('庚', 'standard')).toBe('丑未');
		expect(guirenOf('庚', 'geng_ma_hu')).toBe('寅午');
		expect(guirenOf('辛', 'standard')).toBe('寅午');
		expect(guirenOf('辛', 'geng_ma_hu')).toBe('寅午');
		['甲', '乙', '丙', '丁', '戊', '己', '壬', '癸'].forEach((g)=>{
			expect(`${g}:${guirenOf(g, 'geng_ma_hu')}`).toBe(`${g}:${guirenOf(g, 'standard')}`);
		});
		expect(guirenOf('庚', 'nope_variant')).toBe('丑未');   // 回落
		expect(guirenOf('庚')).toBe('丑未');                    // 缺省=默认
		expect(guirenOf('', 'geng_ma_hu')).toBe('');
	});
	test('computeShenSha 经 opts.guirenFa 透传;庚日盘贵人落支随档', ()=>{
		const ctx = { dayGan: '庚', dayZhi: '午', yearGan: '甲', yearZhi: '子' };
		const std = computeShenSha(ctx, { set: ['天乙贵人'] });
		const alt = computeShenSha(ctx, { set: ['天乙贵人'], guirenFa: 'geng_ma_hu' });
		expect(std['天乙贵人']).toEqual(['丑', '未']);
		expect(alt['天乙贵人']).toEqual(['寅', '午']);
	});
	test('🔴 facade 两调用点已透传 s.guirenFa;settings 默认档+optionsKey 登记(源码守卫)', ()=>{
		const fs = require('fs'); const path = require('path');
		const facade = fs.readFileSync(path.resolve(__dirname, '..', '..', 'gua', 'liuyaoFacade.js'), 'utf8');
		expect((facade.match(/guirenFa: s\.guirenFa/g) || []).length).toBe(2);
		const { DEFAULT_LIUYAO_SETTINGS, getLiuyaoOptionsKey } = require('../../gua/liuyaoSchools');
		expect(DEFAULT_LIUYAO_SETTINGS.guirenFa).toBe('standard');
		const a = getLiuyaoOptionsKey({ ...DEFAULT_LIUYAO_SETTINGS });
		const b = getLiuyaoOptionsKey({ ...DEFAULT_LIUYAO_SETTINGS, guirenFa: 'geng_ma_hu' });
		expect(a === b).toBe(false);   // 切档必触发重算+快照
	});
});
