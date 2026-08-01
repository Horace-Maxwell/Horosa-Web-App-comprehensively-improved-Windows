// 卜卦判读参数「零死开关」接线锁(2026-07-31 实案制度化)。
// 病灶:面板 spec 声明的判读键在引擎/判读组件里零消费(parentHousesVariant 曾 100% 死)、
// 或选项等价(perfectionStrict 标准/严格曾字节等价、considerationsMode 三档曾同判)。
// 判据:每个 horary 域判读键必须在消费面源码(剥注释后)至少出现一次;
// 三个曾等价档位的真差异分支必须在位。
import fs from 'fs';
import path from 'path';
import { HORARY_PARAM_SPEC } from '../horarySchools';

const UI = path.resolve(__dirname, '..', '..', '..');
const CONSUMER_FILES = [
	'divination/horary/horaryEngine.js',
	'divination/horary/significators.js',
	'divination/horary/timing.js',
	'divination/engine/perfection.js',
	'divination/engine/radicality.js',
	'divination/engine/conditions.js',
	'divination/engine/moon.js',
	'divination/engine/chartFacts.js',
	'components/horary/HoraryJudgment.js',
	'components/horary/HoraryMain.js',
];

const stripComments = (t) => t.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const corpus = stripComments(CONSUMER_FILES.map((f) => fs.readFileSync(path.join(UI, f), 'utf8')).join('\n'));

describe('卜卦判读参数零死开关接线锁', () => {
	const judgeKeys = HORARY_PARAM_SPEC.filter((p) => p.scope === 'horary' && !p.sendToBackend).map((p) => p.key);

	it('spec 判读键 ≥ 20(面板域完整)', () => {
		expect(judgeKeys.length).toBeGreaterThanOrEqual(20);
	});

	judgeKeys.forEach((key) => {
		it(`${key} 在消费面被读取(非死开关)`, () => {
			const re = new RegExp('\\b' + key + '\\b');
			expect(re.test(corpus)).toBe(true);
		});
	});

	it('perfectionStrict 严格档有真差异分支(硬相位接纳仅减损)', () => {
		const t = stripComments(fs.readFileSync(path.join(UI, 'divination/engine/perfection.js'), 'utf8'));
		expect(t.includes("perfectionStrict === 'strict'")).toBe(true);
		expect(t.includes("perfectionStrict === 'lenient'")).toBe(true);
	});

	it('considerationsMode 三档在总判有真差异', () => {
		const t = stripComments(fs.readFileSync(path.join(UI, 'components/horary/HoraryJudgment.js'), 'utf8'));
		expect(t.includes("considerationsMode || 'warn'")).toBe(true);
		expect(t.includes("mode === 'lenient'")).toBe(true);
		expect(t.includes("mode === 'strict'")).toBe(true);
	});

	it('hourAgreementVariant 透传进 buildHourAgreement(征象口径不再半聋)', () => {
		const t = stripComments(fs.readFileSync(path.join(UI, 'divination/horary/horaryEngine.js'), 'utf8'));
		expect(/buildHourAgreement\(facts,\s*\{[^}]*\},\s*opts\)/.test(t)).toBe(true);
		expect(t.includes('hourAgreementVariant')).toBe(true);
	});

	it('父母类别接线(father/mother 入类别表+variant 转宫)', () => {
		const sig = stripComments(fs.readFileSync(path.join(UI, 'divination/horary/significators.js'), 'utf8'));
		expect(sig.includes('parentRole')).toBe(true);
		expect(sig.includes("parentHousesVariant === 'modern'")).toBe(true);
		const main = stripComments(fs.readFileSync(path.join(UI, 'components/horary/HoraryMain.js'), 'utf8'));
		expect(main.includes("value: 'father'")).toBe(true);
		expect(main.includes("value: 'mother'")).toBe(true);
	});

	it('antisciaOrb 收编进判读白名单(全局映点容许度对卜卦生效)', () => {
		const t = stripComments(fs.readFileSync(path.join(UI, 'divination/horary/horarySchools.js'), 'utf8'));
		expect(t.includes("JUDGE_KEYS.push('antisciaOrb')")).toBe(true);
	});

	it('面板回显含全局层(与判读引擎同口径)', () => {
		const t = stripComments(fs.readFileSync(path.join(UI, 'components/horary/HoraryMain.js'), 'utf8'));
		expect(t.includes('...judgeLayerOverrides()')).toBe(true);
	});
});
