// 齿轮里空档标「随档 / 随存档 / 随盘」= 留空跟着存档 / 这张盘走,不是覆盖成空串。
// 此前地占四项、灵棋问类、星盘 / 宿占 / 量化盘恒星岁差、神数诸法的「随盘」档没标 blankFollowsBaseline:
// 选了它 = 把存档值覆盖成 '',重算按出厂缺省出(存档是阿拉伯沙占派 → 重算成古典定局派;存的是 Raman → 重算成后端缺省)。
import { TECHNIQUE_SETTINGS_SCHEMA, pruneOptionsToNonDefault, effectiveMountBaseline, mergeOptionsIntoPayload } from '../techniqueMountSettings';

const FOLLOW_LABEL = /随档|随存档|随盘/;

describe('「随档 / 随盘」空档 = 跟存档走', ()=>{
	test('全表守卫:凡空档标「随档 / 随存档 / 随盘」的下拉都标了 blankFollowsBaseline', ()=>{
		const missing = []; let n = 0;
		Object.keys(TECHNIQUE_SETTINGS_SCHEMA).forEach((k)=>{
			const s = TECHNIQUE_SETTINGS_SCHEMA[k];
			(s && Array.isArray(s.fields) ? s.fields : []).forEach((f)=>{
				const blank = (f.options || []).find((o)=>o.value === '');
				if(blank && FOLLOW_LABEL.test(`${blank.label}`)){ n += 1; if(!f.blankFollowsBaseline){ missing.push(`${k}.${f.name}「${blank.label}」`); } }
			});
		});
		expect(n).toBeGreaterThan(30);
		expect(missing).toEqual([]);
	});
	test('地占:存档是阿拉伯沙占派 / L2 / 行星归属 / 第 7 宫,全选「随档」→ 不算覆盖,合并后存档值不变', ()=>{
		const stored = { tradition: 'arabic_raml', readingScope: 'L2', zodiacSystem: 'planetary', quesitedHouse: 7, seedMode: 'manual', seed: 'abc' };
		const payload = { options: stored };
		const rec = { cid: 'geo1', payload: JSON.stringify(payload) };
		const b = effectiveMountBaseline('geomancy', rec);
		expect(b.tradition).toBe('arabic_raml');
		const draft = { ...b, tradition: '', readingScope: '', zodiacSystem: '', quesitedHouse: '' };
		expect(pruneOptionsToNonDefault('geomancy', draft, b)).toEqual({});
		const merged = mergeOptionsIntoPayload(payload, 'geomancy', { tradition: '', readingScope: '' });
		expect(merged.options).toMatchObject({ tradition: 'arabic_raml', readingScope: 'L2' });
		// 显式选别的派仍是覆盖
		expect(pruneOptionsToNonDefault('geomancy', { ...b, tradition: 'greek' }, b)).toEqual({ tradition: 'greek' });
	});
	test('灵棋:存档问类「仕途」,选「随档」→ 不算覆盖;选「通用」→ 覆盖', ()=>{
		const payload = { options: { category: 'career' } };
		const b = effectiveMountBaseline('lingqi', { cid: 'lq1', payload: JSON.stringify(payload) });
		expect(b.category).toBe('career');
		expect(pruneOptionsToNonDefault('lingqi', { category: '' }, b)).toEqual({});
		expect(mergeOptionsIntoPayload(payload, 'lingqi', { category: '' }).options.category).toBe('career');
		expect(pruneOptionsToNonDefault('lingqi', { category: 'general' }, b)).toEqual({ category: 'general' });
	});
	test('星盘恒星岁差:盘存 Raman,选「默认（随盘 / Lahiri）」→ 不算覆盖(仍按 Raman);显式选 Lahiri → 覆盖', ()=>{
		const rec = { cid: 'c1', zodiacal: 1, siderealAyanamsa: 'raman' };
		const b = effectiveMountBaseline('astrochart', rec);
		expect(b.siderealAyanamsa).toBe('raman');
		expect(pruneOptionsToNonDefault('astrochart', { zodiacal: 1, siderealAyanamsa: '' }, b)).toEqual({});
		expect(pruneOptionsToNonDefault('astrochart', { zodiacal: 1, siderealAyanamsa: 'lahiri' }, b)).toEqual({ siderealAyanamsa: 'lahiri' });
	});
});
