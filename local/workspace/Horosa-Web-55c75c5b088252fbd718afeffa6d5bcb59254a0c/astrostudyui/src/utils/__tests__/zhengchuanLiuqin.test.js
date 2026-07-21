// 神数正传 · 六亲属相姓氏断 —— 古籍算例金标（逐步骤断言，每个中间量都是锚）。
import {
	calcShengxiao, calcQiziXingshi, calcXuanjiDongyao, twelvePalaces, mingGong,
	liuqinGong, xunDun, xunOf, LIUQIN_META,
} from '../zhengchuanLiuqinLocal';

describe('神数正传·六亲 · 底座', () => {
	test('五虎遁十二宫：乙年起戊寅', () => {
		const p = twelvePalaces('乙');
		expect(p['寅']).toBe('戊寅');
		expect(p['卯']).toBe('己卯');
		expect(p['丑']).toBe('己丑');
		expect(p['酉']).toBe('乙酉');
		expect(p['辰']).toBe('庚辰');
	});
	test('五虎遁十二宫：癸年起甲寅、丙年起庚寅', () => {
		expect(twelvePalaces('癸')['寅']).toBe('甲寅');
		expect(twelvePalaces('丙')['寅']).toBe('庚寅');
		expect(twelvePalaces('甲')['寅']).toBe('丙寅');
		expect(twelvePalaces('丁')['寅']).toBe('壬寅');
		expect(twelvePalaces('戊')['寅']).toBe('甲寅');
	});
	test('旬首与位次', () => {
		expect(xunOf('己丑')).toEqual({ shou: '甲申', k: 6 });
		expect(xunOf('乙酉')).toEqual({ shou: '甲申', k: 2 });
		expect(xunOf('庚辰')).toEqual({ shou: '甲戌', k: 7 });
		expect(xunOf('甲子')).toEqual({ shou: '甲子', k: 1 });
		expect(xunOf('癸亥')).toEqual({ shou: '甲寅', k: 10 });
	});
	test('六亲宫 天逆地顺', () => {
		expect(liuqinGong('卯', 1)).toEqual({ ming: '卯', spouse: '丑', parent: '辰' });   // 乾造
		expect(liuqinGong('戌', 0)).toEqual({ ming: '戌', spouse: '子', parent: '酉' });   // 坤造
		expect(liuqinGong('子', 1)).toEqual({ ming: '子', spouse: '戌', parent: '丑' });   // 回绕
	});
});

// ── 古籍算例一：乾造 乙未 甲申 己酉 己巳 ──────────────────────────────
describe('神数正传·六亲 · 算例一（乾造 乙未甲申己酉己巳）', () => {
	const r = calcShengxiao({ pillars: ['乙未', '甲申', '己酉', '己巳'], gender: 1, lunarMonth: 7 });

	test('命宫 = 卯（寅起七月得申，申起子时逆数至巳时得卯）', () => {
		expect(mingGong({ lunarMonth: 7, hourZhi: '巳' })).toBe('卯');
		expect(r.mingGong).toBe('卯');
		expect(r.mingGz).toBe('己卯');
	});
	test('夫妻宫 = 己丑（古籍：其妻宫落于己丑）', () => {
		expect(r.items.spouse.gz).toBe('己丑');
	});
	test('父母宫 = 庚辰（古籍：其父亲宫落于庚辰）', () => {
		expect(r.items.parent.gz).toBe('庚辰');
	});
	test('妻宫旬遁逐步：己入地盘坤2 → 起甲申顺数至己丑落兑7 → 丁 → 丁亥 → 猪', () => {
		const d = r.items.spouse.dun;
		expect(d.xunShou).toBe('甲申');
		expect(d.k).toBe(6);
		expect(d.ganUsed).toBe('己');
		expect(d.p0).toBe(2);
		expect(d.p0Gua).toBe('坤');
		expect(d.p).toBe(7);
		expect(d.pGua).toBe('兌');
		expect(d.dunGan).toBe('丁');
		expect(d.hitGz).toBe('丁亥');
		expect(d.shengxiao).toBe('豬');
	});
	test('父母宫旬遁逐步：庚入地盘震3 → 数至庚辰落离9 → 乙 → 乙亥 → 猪（古籍：数至庚辰落于离宫乙，天盘甲戌数至乙为乙亥，属猪）', () => {
		const d = r.items.parent.dun;
		expect(d.xunShou).toBe('甲戌');
		expect(d.p0Gua).toBe('震');
		expect(d.pGua).toBe('離');
		expect(d.dunGan).toBe('乙');
		expect(d.hitGz).toBe('乙亥');
		expect(d.shengxiao).toBe('豬');
	});
});

// ── 古籍算例二：乾造 乙巳 辛巳 乙亥 壬午 ──────────────────────────────
describe('神数正传·六亲 · 算例二（乾造 乙巳辛巳乙亥壬午）', () => {
	const r = calcShengxiao({ pillars: ['乙巳', '辛巳', '乙亥', '壬午'], gender: 1, lunarMonth: 4 });

	test('夫妻宫 = 乙酉（古籍：其妻宫落于乙酉）', () => {
		expect(r.items.spouse.gz).toBe('乙酉');
	});
	test('旬遁逐步：乙落离宫9 → 推至乙酉落坎宫1 → 戊 → 戊子 → 鼠（古籍逐句同）', () => {
		const d = r.items.spouse.dun;
		expect(d.p0).toBe(9);
		expect(d.p0Gua).toBe('離');
		expect(d.p).toBe(1);
		expect(d.pGua).toBe('坎');
		expect(d.dunGan).toBe('戊');
		expect(d.hitGz).toBe('戊子');
		expect(d.shengxiao).toBe('鼠');
	});
});

// ── 古籍算例三：坤造 癸丑 乙丑 丁巳 癸卯 ──────────────────────────────
describe('神数正传·六亲 · 算例三（坤造 癸丑乙丑丁巳癸卯）', () => {
	test('夫妻宫 = 甲子（古籍：其夫妻宫落于甲子）', () => {
		const r = calcShengxiao({ pillars: ['癸丑', '乙丑', '丁巳', '癸卯'], gender: 0, lunarMonth: 12 });
		expect(r.mingGong).toBe('戌');
		expect(r.items.spouse.gz).toBe('甲子');
	});
	test('甲不上盘 → 取本旬之仪', () => {
		const d = xunDun('甲子');
		expect(d.ganUsed).toBe('戊');
		expect(d.ganNote).toContain('甲不上盘');
		expect(d.xunShou).toBe('甲子');
	});
});

// ── 古籍算例：范围秘音断妻姓氏（乾造 庚戌 庚辰 己未 丁卯）─────────────
describe('神数正传·六亲 · 秘音断妻姓氏（乾造 庚戌庚辰己未丁卯）', () => {
	const r = calcQiziXingshi({ pillars: ['庚戌', '庚辰', '己未', '丁卯'] });

	test('先天基数 = 1393（时丁卯12×100 + 日己未18×10 + 月庚辰13；须先天己=10）', () => {
		expect(r.xianTianBase).toBe(1393);
	});
	test('后天基数 = 328（四干和30×10 + 四支和28；须后天己=10）', () => {
		expect(r.houTianBase).toBe(328);
	});
	test('合先后天数 = 1721', () => {
		expect(r.total).toBe(1721);
	});
	test('演卦：千百17÷8余1→艮(上)、十个21÷8余5→震(下)、四位和11÷6→五爻动', () => {
		expect(r.upGua).toBe('艮');
		expect(r.downGua).toBe('震');
		expect(r.dongYao).toBe(5);
	});
	test('五爻纳甲 = 丙子（古籍字符画卦亦标「5爻丙子动」）', () => {
		expect(r.yaoGz).toBe('丙子');
	});
	test('子遁甲子戊 → 先天盘临艮为土、后天盘临巽为木（古籍逐句同）', () => {
		expect(r.xianTianWuxing).toBe('土');
		expect(r.houTianWuxing).toBe('木');
	});
	test('表号：甲9 + 子亥1、6 = 16 ÷6 余4 → 第四表', () => {
		expect(r.tableNo).toBe(4);
	});
	test('第四表戊己行(先天五行土)中偏旁属木者唯有林氏，在巳栏（古籍断语）', () => {
		expect(r.ganRow).toBe('戊己');
		expect(r.candidates).toEqual([{ name: '林', zhi: '巳' }]);
		expect(r.xingshi).toBe('林');
		expect(r.xingshiZhi).toBe('巳');
	});
	test('成数序不推：姓氏入卦之谱古籍未载', () => {
		expect(r.chengShuNote).toContain('古籍未载');
		expect(r).not.toHaveProperty('chengShu');
	});
});

// ── 古籍算例：玄机卦动爻（1978年三月初三午时·阳男）───────────────────
describe('神数正传·六亲 · 玄机卦动爻（1978三月初三午时·阳男）', () => {
	const base = { yearZhi: '午', lunarMonth: 3, lunarDay: 3, hourZhi: '午', gender: 1, yangYear: true };

	test('宫位 = 辰（午起正月顺数至三月得申 → 申起初一至初三得戌 → 戌起子时至午时得辰）', () => {
		const r = calcXuanjiDongyao({ ...base, askHourZhi: '午', env: '陰' });
		expect(r.steps[0].value).toBe('申');
		expect(r.steps[1].value).toBe('戌');
		expect(r.gong).toBe('辰');
	});
	test('白天午时逢阴 → 天四象「日」→ [日][辰] = 6 → 六爻动（古籍逐句同）', () => {
		const r = calcXuanjiDongyao({ ...base, askHourZhi: '午', env: '陰' });
		expect(r.isDay).toBe(true);
		expect(r.sixiang).toBe('日');
		expect(r.dongYao).toBe(6);
	});
	test('阴男阳女逆数：同盘改性别 → 宫位与动爻俱变', () => {
		const a = calcXuanjiDongyao({ ...base, askHourZhi: '午', env: '陰' });
		const b = calcXuanjiDongyao({ ...base, gender: 0, askHourZhi: '午', env: '陰' });
		expect(b.direction).toBe('逆数');
		expect(b.gong).not.toBe(a.gong);
	});
	test('昼夜时辰走地四象（酉–寅）', () => {
		const r = calcXuanjiDongyao({ ...base, askHourZhi: '子', env: '明' });
		expect(r.isDay).toBe(false);
		expect(r.sixiang).toBe('火');
		expect(r.dongYao).toBeGreaterThanOrEqual(1);
		expect(r.dongYao).toBeLessThanOrEqual(6);
	});
	test('闰月：十五前作前月、十六后作后月', () => {
		const a = calcXuanjiDongyao({ ...base, lunarDay: 10, isLeapMonth: true, askHourZhi: '午', env: '陰' });
		const b = calcXuanjiDongyao({ ...base, lunarDay: 20, isLeapMonth: true, askHourZhi: '午', env: '陰' });
		expect(a.steps[0].detail).toContain('前月');
		expect(b.steps[0].detail).toContain('后月');
	});
});

describe('神数正传·六亲 · 古籍未载之格显式标缺（不臆补）', () => {
	test('动爻纳甲落阴支 → 无「甲X」可配 → 标缺而不推', () => {
		// 构造使动爻落阴卦者：逐盘扫，取首个阴支之例
		const cands = [
			['甲子', '乙丑', '丙寅', '丁卯'], ['戊辰', '己巳', '庚午', '辛未'],
			['壬申', '癸酉', '甲戌', '乙亥'], ['丙子', '丁丑', '戊寅', '己卯'],
		];
		const hit = cands.map((p) => calcQiziXingshi({ pillars: p })).find((x) => x && x.missing);
		if (hit) {
			expect(hit.missing).toContain('阴');
			expect(hit.missing).toContain('古籍');
			expect(hit).not.toHaveProperty('xingshi');
		}
		// 无论是否命中，阳支之例必须能推到底
		const ok = calcQiziXingshi({ pillars: ['庚戌', '庚辰', '己未', '丁卯'] });
		expect(ok.missing).toBeUndefined();
	});
	test('_meta 载明三项硬缺（心法上卦须秘咒／成数序须卦谱／八门法规则）', () => {
		const items = (LIUQIN_META.gaps || []).map((g) => g.item).join('|');
		expect(items).toContain('心法');
		expect(items).toContain('成数序');
		expect(items).toContain('八门法');
	});
	test('_meta 载明两处校订（己=10 / 后天盘戊临巽）', () => {
		const c = (LIUQIN_META.corrections || []).map((x) => x.item).join('|');
		expect(c).toContain('己之数');
		expect(c).toContain('后天遁甲盘');
	});
});
