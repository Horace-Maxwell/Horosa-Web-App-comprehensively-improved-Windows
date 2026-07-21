import {
	isJinShen, isTuiShen, isFuYin, isFanYin, huiTouOf,
	bianGuaOf, bianYaoInfo, analyzeDongBian,
} from '../../gua/liuyaoDongBian';
import { Gua64 } from '../../gua/GuaConst';

function byName(n){ return Gua64.find((g) => g.name === n); }

describe('六爻动变·WP-G 进退神/反伏吟(古籍通例)', () => {
	test('化进神(同五行顺进)', () => {
		expect(isJinShen('寅', '卯')).toBe(true); // 木
		expect(isJinShen('巳', '午')).toBe(true); // 火
		expect(isJinShen('申', '酉')).toBe(true); // 金
		expect(isJinShen('亥', '子')).toBe(true); // 水
		expect(isJinShen('丑', '辰')).toBe(true); // 土循环
		expect(isJinShen('戌', '丑')).toBe(true);
		expect(isJinShen('卯', '寅')).toBe(false);
	});
	test('化退神(逆退)', () => {
		expect(isTuiShen('卯', '寅')).toBe(true);
		expect(isTuiShen('午', '巳')).toBe(true);
		expect(isTuiShen('戌', '未')).toBe(true);
		expect(isTuiShen('丑', '戌')).toBe(true);
		expect(isTuiShen('寅', '卯')).toBe(false);
	});
	test('伏吟(地支同)/反吟(地支冲)', () => {
		expect(isFuYin('子', '子')).toBe(true);
		expect(isFuYin('子', '午')).toBe(false);
		expect(isFanYin('子', '午')).toBe(true);
		expect(isFanYin('寅', '申')).toBe(true);
		expect(isFanYin('子', '子')).toBe(false);
	});
});

describe('六爻动变·WP-G 回头作用(古籍通例)', () => {
	test('回头生/克/冲/合', () => {
		// 子水 化 丑土:土克水=回头克;子丑合=回头合
		const r1 = huiTouOf('子', '水', '丑', '土');
		expect(r1.ke).toBe(true);
		expect(r1.he).toBe(true);
		expect(r1.sheng).toBe(false);
		// 午火 化 子水:子冲午=回头冲;水克火=回头克
		const r2 = huiTouOf('午', '火', '子', '水');
		expect(r2.chong).toBe(true);
		expect(r2.ke).toBe(true);
		// 寅木 化 子水:水生木=回头生
		const r3 = huiTouOf('寅', '木', '子', '水');
		expect(r3.sheng).toBe(true);
	});
});

describe('六爻动变·WP-G 整合(变卦/变爻六亲本宫/化墓)', () => {
	test('乾为天 初爻动 → 之卦天风姤', () => {
		expect(bianGuaOf(byName('乾为天'), [1]).name).toBe('天风姤');
		expect(bianGuaOf(byName('乾为天'), [])).toBeNull();
	});

	test('乾为天 初爻动:子水子孙 化 丑土父母(六亲以乾宫金为我)+回头克合', () => {
		const info = bianYaoInfo(byName('乾为天'), [1], { monthZhi: '午', dayZhi: '辰', kongPair: '戌亥', tuMode: 'water' });
		expect(info.bianGua.name).toBe('天风姤');
		const m = info.moves[0];
		expect(m.ben).toMatchObject({ zhi: '子', wuxing: '水', liuqin: '子孙' });
		expect(m.bian).toMatchObject({ zhi: '丑', wuxing: '土', liuqin: '父母' }); // 乾宫金:土→父母
		expect(m.huiTou.ke).toBe(true);
		expect(m.huiTou.he).toBe(true);
		// 变爻丑土,辰日 → 土墓辰(水土同宫) 化墓
		expect(m.huaMu).toBe(true);
	});

	test('analyzeDongBian:无动爻 → 变卦空、movingCount=0', () => {
		const a = analyzeDongBian(byName('乾为天'), []);
		expect(a.bianGua).toBeNull();
		expect(a.movingCount).toBe(0);
		expect(a.moves).toEqual([]);
	});

	test('多动爻:乾为天 初+三爻动 → 之卦逐变爻齐全', () => {
		const a = analyzeDongBian(byName('乾为天'), [1, 3], { monthZhi: '午', dayZhi: '子', kongPair: '戌亥' });
		expect(a.movingCount).toBe(2);
		expect(a.moves.map((x) => x.pos)).toEqual([1, 3]);
		a.moves.forEach((m) => { expect(m.bian.liuqin).toBeTruthy(); });
	});
});
