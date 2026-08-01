import { shuliLabel, palaceYinYang, computeTaiyiShuli, shuliTone } from '../core/taiyiShuli';

describe('太乙 数理十类(§22)', () => {
	test('重阳数 33/39、重阴数 22/26', () => {
		expect(shuliLabel(33)).toEqual(expect.arrayContaining(['重阳数(主火·亢旱)', '长数']));
		expect(shuliLabel(39)).toEqual(expect.arrayContaining(['重阳数(主火·亢旱)']));
		expect(shuliLabel(22)).toEqual(expect.arrayContaining(['重阴数(主水·阴疫)']));
		expect(shuliLabel(26)).toEqual(expect.arrayContaining(['重阴数(主水·阴疫)']));
	});
	test('无门·主大灾 5/15/25/35', () => {
		[5, 15, 25, 35].forEach((n) => expect(shuliLabel(n)).toEqual(expect.arrayContaining(['无门·主大灾'])));
	});
	test('上和 1/4/8、次和 2/3/6/9、下和 12/16/21/27/34/38', () => {
		expect(shuliLabel(4)).toEqual(expect.arrayContaining(['上和数']));
		expect(shuliLabel(3)).toEqual(expect.arrayContaining(['次和数']));
		expect(shuliLabel(16)).toEqual(expect.arrayContaining(['下和数', '长数']));
	});
	test('无天(短)1-9、长数≥11、无人(整十)', () => {
		expect(shuliLabel(7)).toEqual(expect.arrayContaining(['无天(无十)·短']));
		expect(shuliLabel(20)).toEqual(expect.arrayContaining(['长数', '无人(无一)']));
	});
	test('不和:阳宫得奇 / 阴宫得偶', () => {
		expect(shuliLabel(1, '阳')).toEqual(expect.arrayContaining(['不和(阳宫得奇)']));
		expect(shuliLabel(8, '阴')).toEqual(expect.arrayContaining(['不和(阴宫得偶)']));
		// 阳宫得偶不触发不和
		expect(shuliLabel(8, '阳')).not.toEqual(expect.arrayContaining(['不和(阳宫得奇)']));
	});
	test('无标签返回[平];非数返回[—]', () => {
		expect(shuliLabel(11)).toContain('长数');
		expect(shuliLabel(null)).toEqual(['—']);
	});
	test('太乙宫阴阳:艮震巽离阳 / 坤兑乾坎阴', () => {
		['艮', '震', '巽', '离'].forEach((p) => expect(palaceYinYang(p)).toBe('阳'));
		['坤', '兑', '乾', '坎'].forEach((p) => expect(palaceYinYang(p)).toBe('阴'));
		expect(palaceYinYang('艮宫')).toBe('阳'); // 兼容带「宫」
		expect(palaceYinYang('')).toBe('');
	});
	test('computeTaiyiShuli 三算齐出', () => {
		const r = computeTaiyiShuli({ taiyiPalace: '艮', homeCal: 33, awayCal: 5, setCal: 16 });
		expect(r.yinYang).toBe('阳');
		expect(r.home).toEqual(expect.arrayContaining(['重阳数(主火·亢旱)']));
		expect(r.away).toEqual(expect.arrayContaining(['无门·主大灾']));
		expect(r.set).toEqual(expect.arrayContaining(['下和数']));
		expect(computeTaiyiShuli(null)).toBeNull();
	});
	test('shuliTone 着色:灾/重/不和=bad,和=good', () => {
		expect(shuliTone('无门·主大灾')).toBe('bad');
		expect(shuliTone('重阳数(主火·亢旱)')).toBe('bad');
		expect(shuliTone('上和数')).toBe('good');
		expect(shuliTone('长数')).toBe('neutral');
	});
	// —— 数理十类补 3 子类 ——
	test('无地:个位∈{1,2,3,4}(1/13/22/24 中,末位1-4)', () => {
		[1, 2, 3, 4, 13, 14, 22, 24].forEach((n) => expect(shuliLabel(n)).toEqual(expect.arrayContaining(['无地(未及五)'])));
		// 个位≥5 不触发
		expect(shuliLabel(5)).not.toEqual(expect.arrayContaining(['无地(未及五)']));
		expect(shuliLabel(16)).not.toEqual(expect.arrayContaining(['无地(未及五)']));
	});
	test('阴中重阳 n∈{1,7}、阳中重阴 n∈{4,8}', () => {
		expect(shuliLabel(1)).toEqual(expect.arrayContaining(['阴中重阳']));
		expect(shuliLabel(7)).toEqual(expect.arrayContaining(['阴中重阳']));
		expect(shuliLabel(4)).toEqual(expect.arrayContaining(['阳中重阴']));
		expect(shuliLabel(8)).toEqual(expect.arrayContaining(['阳中重阴']));
	});
	test('🔴 共存双标:1/4/8 既属上和数、又属子类(忠于源表并列)', () => {
		expect(shuliLabel(1)).toEqual(expect.arrayContaining(['上和数', '阴中重阳', '无地(未及五)']));
		expect(shuliLabel(4)).toEqual(expect.arrayContaining(['上和数', '阳中重阴', '无地(未及五)']));
		expect(shuliLabel(8)).toEqual(expect.arrayContaining(['上和数', '阳中重阴']));
	});
	test('shuliTone 子类归中性(阴中重阳含「重阳」子串不误判凶)', () => {
		expect(shuliTone('阴中重阳')).toBe('neutral');
		expect(shuliTone('阳中重阴')).toBe('neutral');
		expect(shuliTone('无地(未及五)')).toBe('neutral');
	});
});
