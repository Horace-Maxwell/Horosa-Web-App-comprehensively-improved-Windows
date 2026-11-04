// 燃烧之路边界变体须贯穿卜卦盘全部判读点:月亮报告的 viaCombusta 布尔、失物「能否找回」一步,
// 与月亮注记同用 viaCombustaRange 四档(曾两处恒按传统 195°–225°,选「天蝎全宫」等档不生效)。
// 边界含起不含止 [lo, hi):与后端排盘、天星择日扫描同口径;判定单一来源 radicality.inViaCombusta。
import fs from 'fs';
import path from 'path';
import { isViaCombusta } from '../../engine/moon';
import { inViaCombusta } from '../../engine/radicality';
import { runTheft } from '../theftModule';

function theftFacts(moonLon){
	return {
		planets: { moon: { lon: moonLon, house: 3, sign: 'scorpio' } },
		meta: { ascSign: 'aries' },
		houses: { 2: { ruler: 'venus' }, 4: { sign: 'cancer', planets: [] }, 7: { ruler: 'venus' } },
		aspects: [],
	};
}

describe('燃烧之路变体随动', () => {
	test('isViaCombusta 按四档边界', () => {
		expect(isViaCombusta(230)).toBe(false);
		expect(isViaCombusta(230, 'standard')).toBe(false);
		expect(isViaCombusta(230, 'scorpioFull')).toBe(true);
		expect(isViaCombusta(185, 'bothFull')).toBe(true);
		expect(isViaCombusta(200, 'narrow')).toBe(false);
		expect(isViaCombusta(210, 'narrow')).toBe(true);
	});
	test('边界含起不含止(与后端排盘、天星择日扫描同口径)', () => {
		expect(isViaCombusta(195)).toBe(true);
		expect(isViaCombusta(225)).toBe(false);
		expect(isViaCombusta(224.999)).toBe(true);
		expect(isViaCombusta(240, 'scorpioFull')).toBe(false);
		expect(isViaCombusta(180, 'bothFull')).toBe(true);
		expect(isViaCombusta(217, 'narrow')).toBe(false);
		expect(isViaCombusta(null)).toBe(false);
	});
	test('卜卦定盘考量 / 择日硬标记 / 择日月亮考量同走 inViaCombusta,不再各写区间比较', () => {
		expect(inViaCombusta(225)).toBe(false);
		expect(inViaCombusta(225, 'scorpioFull')).toBe(true);
		const root = path.resolve(__dirname, '../..');
		['engine/radicality.js', 'engine/moon.js', 'election/considerations.js', 'election/hardFlags.js'].forEach((f) => {
			const src = fs.readFileSync(path.join(root, f), 'utf8');
			expect(src).not.toMatch(/>=\s*vcr?\[0\]/);
			expect(src).not.toMatch(/<=\s*vcr?\[1\]/);
		});
		['engine/radicality.js', 'election/considerations.js', 'election/hardFlags.js'].forEach((f) => {
			expect(fs.readFileSync(path.join(root, f), 'utf8')).toMatch(/inViaCombusta\(moon\.lon/);
		});
	});
	test('失物「能否找回」吃变体', () => {
		const pick = (r) => (r.steps || r).find((s) => /能否找回/.test(s.label));
		const std = pick(runTheft(theftFacts(230), { viaCombustaVariant: 'standard' }));
		const full = pick(runTheft(theftFacts(230), { viaCombustaVariant: 'scorpioFull' }));
		expect(std.text).not.toMatch(/燃烧之路/);
		expect(full.text).toMatch(/燃烧之路/);
		expect(full.polarity).toBe('negative');
	});
});
