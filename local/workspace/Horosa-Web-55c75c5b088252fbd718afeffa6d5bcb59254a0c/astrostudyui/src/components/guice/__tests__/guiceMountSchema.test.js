// 皇极轨策 · 挂载 schema 覆盖率 —— 守「面板里调不着」这一类。
//
// 🔴 病例(本轮实抓)：九开关只登记了五个 —— 缺 数系/时方/神煞(恰是刚补活的三个)。
//    schema 会渲染成挂载设置面板里的【真设置项】，漏登 = 用户在挂载设置里
//    根本见不到此项、调不着。而无人机械核过，故一直没发觉。
import { getTechniqueSettingsSchema } from '../../../utils/techniqueMountSettings';
import { GUICE_OPTION_KEYS } from '../guiceSchools';

const schema = getTechniqueSettingsSchema('guice');
const names = (schema.fields || []).map((f) => f.name);

// 🔴 起卦法【有意】不登：其决定卦本身，而卦是冻结值 —— 按挂载重起即伪造一个用户没见过的卦。
const INTENTIONALLY_OUT = ['qiguaFa'];

describe('轨策 · 挂载 schema 覆盖全开关（漏登=面板里调不着）', () => {
	test('schema 在，且为 payload 型 + optionsPath', () => {
		expect(schema).toBeTruthy();
		expect(schema.kind).toBe('payload');
		expect(schema.optionsPath).toBe('options');
	});

	test('🔴 九开关除有意排除者外，一个不落', () => {
		const missing = GUICE_OPTION_KEYS.filter((k) => INTENTIONALLY_OUT.indexOf(k) < 0 && names.indexOf(k) < 0);
		expect(missing).toEqual([]);
	});

	test('🔴 有意排除者须确在开关表内（否则是笔误，不是「有意」）', () => {
		INTENTIONALLY_OUT.forEach((k) => expect(GUICE_OPTION_KEYS).toContain(k));
		INTENTIONALLY_OUT.forEach((k) => expect(names).not.toContain(k));
	});

	test('🔴 schema 不得登记开关表里没有的键（凭空多出即漂）', () => {
		const extra = names.filter((n) => GUICE_OPTION_KEYS.indexOf(n) < 0);
		expect(extra).toEqual([]);
	});

	test('🔴 每项之 default 须与引擎之默认逐字相同（两处各写一份必漂）', () => {
		const { DEFAULT_GUICE_SETTINGS } = require('../guiceSchools');
		const bad = (schema.fields || [])
			.filter((f) => DEFAULT_GUICE_SETTINGS[f.name] !== f.default)
			.map((f) => `${f.name}: schema ${JSON.stringify(f.default)} ≠ 引擎 ${JSON.stringify(DEFAULT_GUICE_SETTINGS[f.name])}`);
		expect(bad).toEqual([]);
	});

	test('🔴 select 型之取值域须与引擎之域相同（少一个=用户选不到，多一个=选了算不出）', () => {
		const { normalizeGuiceSettings, DEFAULT_GUICE_SETTINGS } = require('../guiceSchools');
		const bad = [];
		(schema.fields || []).filter((f) => f.type === 'select').forEach((f) => {
			f.options.forEach((o) => {
				// 域内之值，规整后须原样留住（梅花之联动例外，其为有意）
				const n = normalizeGuiceSettings({ ...DEFAULT_GUICE_SETTINGS, [f.name]: o.value });
				if (n[f.name] !== o.value) bad.push(`${f.name}=${o.value} → 规整成 ${n[f.name]}（引擎不认此值）`);
			});
		});
		expect(bad).toEqual([]);
	});
});
