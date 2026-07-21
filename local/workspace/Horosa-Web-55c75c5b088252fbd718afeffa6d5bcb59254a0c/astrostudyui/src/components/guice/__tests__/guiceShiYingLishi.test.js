// 皇极轨策 · 三要十应 + 元会运世历史层 金标。
// 🔴 失败 = 引擎错，不得改测试将就。
import { shiYing, autoYing, SHIYING_SET_KEYS } from '../core/guiceShiYing';
import { zhiNianGua, zhiNianTable, biGuaOf, biGuaTable, lishi, ZHINIAN_SEQ, SI_ZHENG_GUA } from '../core/guiceLishi';
import { SHIYING_SETS } from '../core/guiceConst';
import { Gua64 } from '../../gua/GuaConst';

describe('轨策·十应 · 三套名目并存（所载不同，故可切）', () => {
	test('三套皆备，各十应', () => {
		expect(SHIYING_SET_KEYS).toEqual(['xinyifawei', 'meihua', 'rizhen']);
		SHIYING_SET_KEYS.forEach((k) => expect(SHIYING_SETS[k].items).toHaveLength(10));
	});
	test('切套 → 名目随之全换（此选项真生效）', () => {
		const a = shiYing({ up: '离', lo: '兑', dongYao: 6, set: 'xinyifawei' });
		const b = shiYing({ up: '离', lo: '兑', dongYao: 6, set: 'meihua' });
		const c = shiYing({ up: '离', lo: '兑', dongYao: 6, set: 'rizhen' });
		expect(a.items.map((x) => x.label)).not.toEqual(b.items.map((x) => x.label));
		expect(b.items.map((x) => x.label)).not.toEqual(c.items.map((x) => x.label));
		expect(a.items[0].label).toBe('正应');
		expect(b.items[0].label).toBe('天时');
		expect(c.items[0].label).toBe('行');
	});
	test('缺省即心易发微版（默认即现状）', () => {
		expect(shiYing({ up: '离', lo: '兑', dongYao: 6 }).set).toBe('xinyifawei');
	});
	test('梅花版载其参看之则（内不吉而外吉可解、内吉而外不吉反破）', () => {
		expect(shiYing({ up: '离', lo: '兑', dongYao: 6, set: 'meihua' }).note).toContain('内不吉而外吉可解');
	});
	test('未知之套 → 回默认，不抛', () => {
		expect(shiYing({ up: '离', lo: '兑', dongYao: 6, set: 'nope' }).label).toBe(SHIYING_SETS.xinyifawei.label);
	});
});

describe('轨策·十应 · 正应/互应/变应由卦自出，余者须录', () => {
	const r = shiYing({ up: '离', lo: '兑', dongYao: 6 });
	test('三应自出，各带其卦与体用之断', () => {
		const autos = r.items.filter((x) => x.auto);
		expect(autos.map((x) => x.label)).toEqual(['正应', '互应', '变应']);
		autos.forEach((x) => { expect(x.gua).toBeTruthy(); expect(x.from).toBe('卦自出'); expect(x.duan).toBeTruthy(); });
	});
	test('🔴 余七应未录者显式标缺 —— 不臆造（此古籍重人之审量，机不能代）', () => {
		const rest = r.items.filter((x) => !x.auto);
		expect(rest).toHaveLength(7);
		rest.forEach((x) => {
			expect(x.missing).toBe(true);
			expect(x.note).toContain('机不能代');
			expect(x.value).toBeUndefined();
		});
		expect(r.recorded).toBe(3);
	});
	test('录之则纳（所录者从其录）', () => {
		const y = shiYing({ up: '离', lo: '兑', dongYao: 6, inputs: { fang: '东南', ri: '甲子', wai: '雀噪' } });
		expect(y.recorded).toBe(6);
		const fang = y.items.find((x) => x.key === 'fang');
		expect(fang).toMatchObject({ value: '东南', from: '所录' });
		expect(fang).not.toHaveProperty('missing');
	});
	test('正应 = 本之用；互应 = 用互；变应 = 变之用（皆以体较之）', () => {
		const a = autoYing('离', '兑', 6);   // 六爻动 → 用在上(离)、体在下(兑)
		expect(a.tiGua).toBe('兑');
		expect(a.zheng.gua).toBe('离');
		expect(a.hu.gua).toBeTruthy();
		expect(a.bian.gua).toBe('震');       // 离上爻变 → 震
	});
	test('坏卦 → 三应缺而不抛', () => {
		const x = shiYing({ up: '甲', lo: '兑', dongYao: 6 });
		expect(x.items.filter((i) => i.auto).every((i) => i.missing)).toBe(true);
	});
});

describe('轨策·历史 · 值年卦（六十四卦圆图去四正 = 六十卦 = 一花甲）', () => {
	test('🔴 不变式：六十卦、无重、不含乾坤坎离四正', () => {
		expect(ZHINIAN_SEQ).toHaveLength(60);
		expect(new Set(ZHINIAN_SEQ).size).toBe(60);
		SI_ZHENG_GUA.forEach((g) => expect(ZHINIAN_SEQ).not.toContain(g));
	});
	test('🔴 不变式：与仓内六十四卦表去四正者，集合恰等（无重无漏）', () => {
		const g64 = Gua64.map((g) => g.name);
		const rest = g64.filter((n) => ['乾为天', '坤为地', '坎为水', '离为火'].indexOf(n) < 0);
		expect(rest).toHaveLength(60);
		const mapped = ZHINIAN_SEQ.map((s) => rest.find((n) => n.endsWith(s)) || rest.find((n) => n.startsWith(`${s}为`)));
		expect(mapped.filter(Boolean)).toHaveLength(60);
		expect(new Set(mapped).size).toBe(60);
		expect(mapped.slice().sort()).toEqual(rest.slice().sort());
	});
	test('古籍所载之年卦逐个写死（1984 鼎 … 2043 大过）', () => {
		expect(zhiNianGua(1984).gua).toBe('鼎');
		expect(zhiNianGua(1985).gua).toBe('恒');
		expect(zhiNianGua(1988).gua).toBe('蛊');
		expect(zhiNianGua(2000).gua).toBe('小过');
		expect(zhiNianGua(2003).gua).toBe('艮');
		expect(zhiNianGua(2026).gua).toBe('同人');
		expect(zhiNianGua(2043).gua).toBe('大过');
	});
	test('周而复始：2044 复起于鼎；1983 为前一花甲之大过', () => {
		expect(zhiNianGua(2044).gua).toBe('鼎');
		expect(zhiNianGua(1983).gua).toBe('大过');
		expect(zhiNianGua(1924).gua).toBe('鼎');
	});
	test('世卦鼎主 1984–2043；其外之年不落此世', () => {
		expect(zhiNianGua(2000).shiGua).toMatchObject({ ceng: '世卦', gua: '鼎' });
		expect(zhiNianGua(2050).shiGua).toBeNull();
	});
	test('一花甲之表六十行，年卦与年一一相配', () => {
		const t = zhiNianTable(2000);
		expect(t).toHaveLength(60);
		expect(t[0]).toEqual({ year: 1984, gua: '鼎' });
		expect(t[59]).toEqual({ year: 2043, gua: '大过' });
	});
	test('坏年 → null，不抛', () => {
		[null, undefined, 'x', NaN].forEach((y) => expect(zhiNianGua(y)).toBeNull());
	});
});

describe('轨策·历史 · 十二辟卦（消息卦）', () => {
	test('十二支各配其卦，自一阳生至六阴', () => {
		expect(biGuaTable()).toHaveLength(12);
		expect(biGuaOf('子')).toMatchObject({ gua: '复', xiao: '一阳生' });
		expect(biGuaOf('巳')).toMatchObject({ gua: '乾', xiao: '六阳' });
		expect(biGuaOf('午')).toMatchObject({ gua: '姤', xiao: '一阴生' });
		expect(biGuaOf('亥')).toMatchObject({ gua: '坤', xiao: '六阴' });
	});
	test('阴阳各半：六阳息、六阴消', () => {
		const t = biGuaTable();
		expect(t.filter((x) => x.xiao.indexOf('阳') >= 0)).toHaveLength(6);
		expect(t.filter((x) => x.xiao.indexOf('阴') >= 0)).toHaveLength(6);
	});
	test('坏支 → null', () => { expect(biGuaOf('X')).toBeNull(); });
});

describe('轨策·历史 · 全出', () => {
	test('值年卦 + 辟卦 + 运世层级 + 元会运世之数', () => {
		const r = lishi({ year: 2026, monthZhi: '午' });
		expect(r.zhiNian.gua).toBe('同人');
		expect(r.biGua.gua).toBe('姤');
		expect(r.cengji.map((c) => c.ceng)).toEqual(['会', '正运', '运卦', '世卦', '旬卦']);
		expect(r.yhys).toEqual({ hui: 12, yun: 360, shi: 4320, nian: 129600 });
	});
	test('缺年/缺月 → 该项为 null 而不抛', () => {
		expect(lishi({}).zhiNian).toBeNull();
		expect(lishi({}).biGua).toBeNull();
		expect(lishi({}).cengji).toBeTruthy();
	});
});
