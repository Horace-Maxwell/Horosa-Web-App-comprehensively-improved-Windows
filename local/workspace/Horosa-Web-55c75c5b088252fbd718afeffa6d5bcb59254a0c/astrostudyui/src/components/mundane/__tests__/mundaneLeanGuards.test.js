// 世俗盘:当年取值不再包走不到的 try;「buildFacts 遇坏盘按无事实处理」收口成一个 safeFacts,行为逐字不变。
import fs from 'fs';
import path from 'path';
import { buildMundaneCardSections } from '../MundaneMain';
import { buildMockResult } from '../../../divination/election/__tests__/electionFixture';
import { buildFacts } from '../../../divination/engine/chartFacts';

const SRC = fs.readFileSync(path.resolve(__dirname, '..', 'MundaneMain.js'), 'utf8');
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('世俗盘 当年 / 盘面事实', () => {
	const chart = buildMockResult();
	test('入宫盘缺入宫年 → 年盘概要按本机当年', () => {
		const secs = buildMundaneCardSections(chart, { mundaneType: 'ingress', ingressMoment: '2026-03-20 17:46', ingressTerm: '春分' }, {}, buildFacts(chart));
		const sec = secs.find((s) => s.startsWith('[年盘概要]'));
		expect(sec.split('\n')[1].startsWith(`${new Date().getFullYear()} 年 · `)).toBe(true);
	});
	test('不传 facts 时自己算,结果与传入 buildFacts(chart) 逐字相同', () => {
		const ex = { mundaneType: 'ingress', ingressMoment: '2026-03-20 17:46', ingressYear: 2026, ingressTerm: '春分' };
		expect(buildMundaneCardSections(chart, ex, {}, undefined)).toEqual(buildMundaneCardSections(chart, ex, {}, buildFacts(chart)));
	});
	test('buildFacts 抛错的坏盘:按无事实处理,不抛', () => {
		const bad = { chart: { objects: 5 } };
		let threw = false;
		try{ buildFacts(bad); }catch(e){ threw = true; }
		expect(threw).toBe(true);
		expect(() => buildMundaneCardSections(bad, { mundaneType: 'ingress', ingressYear: 2026 }, {}, undefined)).not.toThrow();
	});
	test('源码:currentYear 不包 try;各卡 / 段统一走 safeFacts,不再逐处手写 try', () => {
		expect(CODE).toMatch(/function currentYear\(\)\{\n\treturn new Date\(\)\.getFullYear\(\);\n\}/);
		expect(CODE.split('function safeFacts(chart)').length - 1).toBe(1);
		expect(CODE).not.toMatch(/try\s*\{\s*facts = (chart \? )?buildFacts\(chart\)/);
		expect(CODE).not.toContain('(() => { try{ return buildFacts(chart); }catch(e){ return null; } })()');
		expect((CODE.match(/\bsafeFacts\(chart\)/g) || []).length).toBeGreaterThanOrEqual(14);
	});
});
