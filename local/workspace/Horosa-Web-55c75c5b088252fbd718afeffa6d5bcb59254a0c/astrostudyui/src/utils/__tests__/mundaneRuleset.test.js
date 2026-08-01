// 世运盘 WP-0 多流派规则集 ruleset.js golden:4 派 + 默认 modern 零回归 + config 字段齐全。
import { MUNDANE_RULESETS, MUNDANE_RULESET_DEFAULT, rulesetConfig } from '../../divination/mundane/ruleset';

describe('世运盘 多流派规则集 ruleset.js', () => {
	test('4 规则集顺序 + 默认 modern', () => {
		expect(MUNDANE_RULESETS.map((r) => r.key)).toEqual(['ptolemaic', 'medieval', 'modern', 'barbault']);
		expect(MUNDANE_RULESET_DEFAULT).toBe('modern');
		MUNDANE_RULESETS.forEach((r) => { expect(typeof r.label).toBe('string'); expect(typeof r.note).toBe('string'); });
	});

	test('rulesetConfig 归一化:未知/缺省/空 → modern(零回归)', () => {
		expect(rulesetConfig().key).toBe('modern');
		expect(rulesetConfig('nonsense').key).toBe('modern');
		expect(rulesetConfig(null).key).toBe('modern');
		expect(rulesetConfig('').key).toBe('modern');
	});

	test('modern = 现状(外行星 / 按相位 orb / 全年入境 / Barbault 可显)', () => {
		const m = rulesetConfig('modern');
		expect(m.showOuterPlanets).toBe(true);
		expect(m.orbScheme).toBe('by_aspect');
		expect(m.ingressRule).toBe('aries_annual');
		expect(m.showBarbault).toBe(true);
		expect(m.bodies).toBe('modern');
	});

	test('ptolemaic/medieval = 古典(无外行星 / moiety / 季度递归 / 无 Barbault)', () => {
		['ptolemaic', 'medieval'].forEach((k) => {
			const c = rulesetConfig(k);
			expect(c.showOuterPlanets).toBe(false);
			expect(c.orbScheme).toBe('moiety');
			expect(c.ingressRule).toBe('quarterly');
			expect(c.showBarbault).toBe(false);
			expect(c.showOuterCycles).toBe(false);
		});
	});

	test('barbault = 5 慢星为主 + 指数 + 无食应期', () => {
		const b = rulesetConfig('barbault');
		expect(b.bodies).toBe('barbault');
		expect(b.showBarbault).toBe(true);
		expect(b.eclipseTiming).toBe('none');
	});

	test('每派 config 字段齐全(供下游 surfacing/联动)', () => {
		const need = ['bodies', 'ingressRule', 'eclipseTiming', 'orbScheme', 'termsVariant', 'triplicityVariant',
			'chorographyDataset', 'showOuterPlanets', 'showOuterCycles', 'showBarbault', 'key', 'label', 'note'];
		MUNDANE_RULESETS.forEach((r) => {
			const c = rulesetConfig(r.key);
			need.forEach((k) => expect(c[k]).toBeDefined());
			expect(c.key).toBe(r.key);
		});
	});
});

describe('[G1] hiddenBodiesFor 渲染白名单单源(中盘隐 glyph)', () => {
	const { hiddenBodiesFor, RULESET_BODY_LABEL } = require('../../divination/mundane/ruleset');
	test('古典/中世纪 → 隐 ♅♆♇;modern/barbault/缺省 → null(默认档渲染零过滤=零回归锚)', () => {
		expect(hiddenBodiesFor('ptolemaic')).toEqual(['Uranus', 'Neptune', 'Pluto']);
		expect(hiddenBodiesFor('medieval')).toEqual(['Uranus', 'Neptune', 'Pluto']);
		expect(hiddenBodiesFor('modern')).toBeNull();
		expect(hiddenBodiesFor('barbault')).toBeNull();
		expect(hiddenBodiesFor(undefined)).toBeNull();       // 缺省=modern
		expect(hiddenBodiesFor('nonsense')).toBeNull();      // 未知回落 modern
	});
	test('流派卡徽章标签表覆盖全部 bodies 键', () => {
		['classical', 'medieval', 'modern', 'barbault'].forEach((b) => {
			expect(RULESET_BODY_LABEL[b]).toBeTruthy();
		});
	});
});
