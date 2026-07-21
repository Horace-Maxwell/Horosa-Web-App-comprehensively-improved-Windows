// 神数正传 · 邵子神数 golden：以古籍算例为金标，逐步锚定。失败＝引擎错，不得改测试将就。
// 古籍算例（可自洽复现者）：男·阴男·农历1953年五月十三日巳时·癸巳戊午乙巳辛巳·父27·母26
import {
	calcShaozi, xianTianMingGua, tianMingShu, diMingShu, renMingShu,
	houTianMingGua, dressGua, najiaOf, tianRemainder, diRemainder, taiXuanPath,
} from '../zhengchuanShaoziLocal';
import TABLES from '../data/zhengchuanShaoziTables.json';
import VERSES from '../data/zhengchuanShaoziVerses.json';

const CASE = {
	pillars: ['癸巳', '戊午', '乙巳', '辛巳'],
	gender: '男', fatherAge: 27, motherAge: 26,
	lunarMonth: 5, lunarDay: 13, isLeapMonth: false,
};

describe('邵子神数 · 数表内部不变式', () => {
	test('64卦数表 64 条、96气数表 96 条、条文库 6144 条(1111~12888)', () => {
		expect(Object.keys(TABLES.gua64Num).length).toBe(64);
		expect(Object.keys(TABLES.qi96Num).length).toBe(96);
		const ns = Object.keys(VERSES).map(Number).sort((a, b) => a - b);
		expect(ns.length).toBe(6144);
		expect(ns[0]).toBe(1111);
		expect(ns[ns.length - 1]).toBe(12888);
	});

	// 96 气数被三张表精确瓜分：单数月30(1-6组×010~050) ⊎ 双数月30(7-12组×010~050) ⊎ 流年岁数36(全组×060/070/080)
	test('96气数三表精确瓜分：30 ⊎ 30 ⊎ 36 = 96，两两不交', () => {
		const odd = new Set(Object.values(TABLES.birthDaySound.odd));
		const even = new Set(Object.values(TABLES.birthDaySound.even));
		expect(odd.size).toBe(30);
		expect(even.size).toBe(30);
		const inter = [...odd].filter((x) => even.has(x));
		expect(inter).toEqual([]);
		// 单数月落 1-6 组、双数月落 7-12 组；末两位皆 10~50
		[...odd].forEach((s) => {
			const v = TABLES.qi96Num[s];
			expect(Math.floor(v / 1000)).toBeLessThanOrEqual(6);
			expect([10, 20, 30, 40, 50]).toContain(v % 1000);
		});
		[...even].forEach((s) => {
			const v = TABLES.qi96Num[s];
			expect(Math.floor(v / 1000)).toBeGreaterThanOrEqual(7);
			expect([10, 20, 30, 40, 50]).toContain(v % 1000);
		});
	});

	test('太玄玉景混天图 81 首 × 9 爻，取值皆为归藏卦数 1~9', () => {
		const t = TABLES.taixuanYuJing;
		expect(Object.keys(t).length).toBe(81);
		Object.keys(t).forEach((k) => {
			expect(t[k].yao.length).toBe(9);
			t[k].yao.forEach((v) => expect(v).toBeGreaterThanOrEqual(1) && expect(v).toBeLessThanOrEqual(9));
		});
	});

	// 古籍算例点名的 4 个真值格（余数→太玄首、商÷9→爻位、符号→归藏卦数）
	test.each([
		[79, 9, 2, '難'], [3, 1, 1, '賢'], [68, 7, 1, '瞢'], [66, 7, 1, '去'],
	])('太玄玉景 第%i首 爻%i → 归藏数 %i（%s）', (idx, yao, want, name) => {
		expect(TABLES.taixuanYuJing[String(idx)].name).toBe(name);
		expect(TABLES.taixuanYuJing[String(idx)].yao[yao - 1]).toBe(want);
	});

	test('连山九槽：后天命卦除九取余需 9 槽，八卦必有一卦重出', () => {
		const ls = TABLES.lianshanGua;
		expect(Object.keys(ls).length).toBe(9);
		expect(new Set(Object.values(ls)).size).toBe(8);   // 九槽八卦 → 恰一卦重出
	});
});

describe('邵子神数 · 余数法', () => {
	test('天数：<25 取个位（10→1、20→2）；=25 取5；>25 减25 再取', () => {
		expect(tianRemainder(29)).toBe(4);    // 古籍算例：29−25=4
		expect(tianRemainder(25)).toBe(5);
		expect(tianRemainder(10)).toBe(1);
		expect(tianRemainder(20)).toBe(2);
		expect(tianRemainder(34)).toBe(9);    // 通例：34−25=9
	});

	test('地数：<30 取个位（10→1、20→2）；=30 取3；>30 减30 再取', () => {
		expect(diRemainder(16)).toBe(6);      // 古籍算例
		expect(diRemainder(30)).toBe(3);
		expect(diRemainder(34)).toBe(4);      // 通例：34−30=4
		expect(diRemainder(10)).toBe(1);
	});
});

describe('邵子神数 · 五基础数据（古籍算例逐步）', () => {
	test('先天命卦：天数29→余4→巽；地数16→余6→乾；阴男 天下地上 → 天风姤', () => {
		const r = xianTianMingGua({ pillars: CASE.pillars, gender: CASE.gender });
		expect(r.tian).toBe(29);
		expect(r.di).toBe(16);
		expect(r.tianRem).toBe(4);
		expect(r.diRem).toBe(6);
		expect(r.tianGua).toBe('巽');
		expect(r.diGua).toBe('乾');
		expect(r.groupA).toBe(false);          // 癸＝阴年 × 男 → 阴男
		expect(r.up).toBe('乾');               // 阴男：地数卦作上
		expect(r.lo).toBe('巽');               // 阴男：天数卦作下
		expect(r.gua.name).toContain('姤');
	});

	test('天命数：父27 → 商2余3 → 3×1000+2×10+502 = 3522', () => {
		const r = tianMingShu(27);
		expect([r.q, r.r, r.num, r.special]).toEqual([2, 3, 3522, false]);
	});

	test('地命数：母26 → 商2余2 → 2×1000+(2+4)×10+502 = 2562', () => {
		const r = diMingShu(26);
		expect([r.q, r.r, r.num, r.special]).toEqual([2, 2, 2562, false]);
	});

	// 整除特例经条文库独立印证：天命数 商2→12512「父年方交二十四」、商3→12522「严父年交三十六」
	test('整除特例：天命数 (商−1)×10+12502、地命数 (商+3)×10+12502，且条文语义自证', () => {
		expect(tianMingShu(24)).toMatchObject({ q: 2, r: 0, num: 12512, special: true });
		expect(tianMingShu(36)).toMatchObject({ q: 3, num: 12522, special: true });
		expect(VERSES['12512']).toContain('父年方交二十四');
		expect(VERSES['12522']).toMatch(/嚴父年交三[十直]六/);   // 所收传本此条「十」印作「直」
		expect(diMingShu(24)).toMatchObject({ q: 2, r: 0, num: 12552, special: true });
		expect(VERSES['12552']).toContain('慈母');
		expect(diMingShu(36)).toMatchObject({ q: 3, num: 12562, special: true });
		expect(VERSES['12562']).toContain('慈母年方三十六');
	});

	test('人命数：五月→恒→卦数504；十三日单数月→见→气数3030；合 3534', () => {
		const r = renMingShu({ lunarMonth: 5, lunarDay: 13, isLeapMonth: false });
		expect(r.gua).toBe('恒');
		expect(r.guaNum).toBe(504);
		expect(r.parity).toBe('odd');
		expect(r.sound).toBe('見');
		expect(r.qiNum).toBe(3030);
		expect(r.num).toBe(3534);
	});

	test('人命数通例：六月十四日 → 恒504 + 照9040 = 9544（双数月）', () => {
		const r = renMingShu({ lunarMonth: 6, lunarDay: 14, isLeapMonth: false });
		expect(r.parity).toBe('even');
		expect(r.sound).toBe('照');
		expect(r.num).toBe(9544);
	});

	test('后天命卦：3522四位和12+天数29=41÷9余5→震(下)；2562四位和15+地数16=31÷9余4→离(上) → 火雷噬嗑；人命数3534四位和15÷6余3 → 三爻动 → 变离为火', () => {
		const ht = houTianMingGua({ tianMing: 3522, diMing: 2562, renMing: 3534, tian: 29, di: 16, groupA: false });
		expect(ht.tianCalc).toMatchObject({ digits: 12, sum: 41, rem: 5, gua: '震' });
		expect(ht.diCalc).toMatchObject({ digits: 15, sum: 31, rem: 4, gua: '離' });
		expect(ht.lo).toBe('震');              // 阴男：天命数所配连山卦作下
		expect(ht.up).toBe('離');
		expect(ht.gua.name).toContain('噬嗑');
		expect(ht.dongCalc).toMatchObject({ digits: 15, rem: 3 });
		expect(ht.dongYao).toBe(3);
		expect(ht.bianGua.name).toMatch(/[離离]為?为?火/);   // 仓内 64 卦名为简体
	});
});

describe('邵子神数 · 装卦（复用仓内六爻引擎 + 本模块纳甲）', () => {
	test('火雷噬嗑纳甲：下震 庚子庚寅庚辰 / 上离 己酉己未己巳', () => {
		const ht = houTianMingGua({ tianMing: 3522, diMing: 2562, renMing: 3534, tian: 29, di: 16, groupA: false });
		expect(najiaOf(ht.lines)).toEqual(['庚子', '庚寅', '庚辰', '己酉', '己未', '己巳']);
	});

	test('噬嗑＝巽宫五世：世在五爻己未；爻1庚子父母、爻5己未妻财、爻4己酉官鬼（与古籍算例逐项吻合）', () => {
		const ht = houTianMingGua({ tianMing: 3522, diMing: 2562, renMing: 3534, tian: 29, di: 16, groupA: false });
		const d = dressGua(ht.lines, ht.dongYao);
		expect(d.palace).toBe('巽');
		const by = {};
		d.yaos.forEach((y) => { by[y.pos] = y; });
		expect(by[5].shiYing).toBe('世');
		expect(by[5].gz).toBe('己未');
		expect(by[1].gz).toBe('庚子');
		expect(by[1].liuqin).toBe('父母');
		expect(by[5].liuqin).toMatch(/妻財|妻财/);
		expect(by[4].gz).toBe('己酉');
		expect(by[4].liuqin).toBe('官鬼');
	});
});

describe('邵子神数 · 断本命四项（古籍算例）', () => {
	const R = calcShaozi(CASE);

	test('全链贯通且无 note', () => {
		expect(R.notes).toEqual([]);
		expect(R.renMing.num).toBe(3534);
		expect(R.houTian.gua.name).toContain('噬嗑');
	});

	// 古籍算例此项自身有错：它记 7363（错用了「牙」的气数7060）。
	// 数表实为 声音卦位表[余数11][三爻]=宫 → 气数4020；离 → 卦数303 → 303+4020=4323。
	// 依「以数表为准、算例为误」处置。
	test('性情：世爻未土本数5 + 3534 = 3539 ÷12 余11 → 三爻→宫(4020) + 离(303) = 4323', () => {
		const x = R.benming.性情;
		expect(x.ben).toBe(5);
		expect(x.sum).toBe(3539);
		expect(x.rem).toBe(11);
		expect(x.yaoName).toBe('三爻');
		expect(x.sound).toBe('宮');
		expect(x.qiNum).toBe(4020);
		expect(x.gua).toBe('離');
		expect(x.guaNum).toBe(303);
		expect(x.num).toBe(4323);
	});

	test('祖业：父母庚子水 生数7 + 3534 = 3541 ÷12 余1', () => {
		const z = R.benming.祖业;
		expect(z.fuYao.gz).toBe('庚子');
		expect(z.sheng).toBe(7);
		expect(z.sum).toBe(3541);
		expect(z.rem).toBe(1);
		expect(z.num).toBeGreaterThan(0);
	});

	test('财运：妻财己未 太玄 9+8=17 + 3534 = 3551 ÷81 → 商43 余68 → 太玄首「瞢」爻7 → 归藏坤1 → 泰(108)', () => {
		const c = R.benming.财运;
		expect(c.caiYao.gz).toBe('己未');
		expect(c.peishu).toBe(17);
		expect(c.sum).toBe(3551);
		expect(c.quotient).toBe(43);
		expect(c.rem).toBe(68);
		expect(c.shou.name).toBe('瞢');
		expect(c.yaoIdx).toBe(7);
		expect(c.guizang).toBe(1);
		expect(c.gua).toBe('泰');
		expect(c.guaNum).toBe(108);
	});

	test('职业：官鬼己酉 太玄 9+6=15 + 3534 = 3549 ÷81 → 商43 余66 → 太玄首「去」爻7 → 归藏坤1 → 明夷(308)', () => {
		const j = R.benming.职业;
		expect(j.guanYao.gz).toBe('己酉');
		expect(j.peishu).toBe(15);
		expect(j.sum).toBe(3549);
		expect(j.quotient).toBe(43);
		expect(j.rem).toBe(66);
		expect(j.shou.name).toBe('去');
		expect(j.yaoIdx).toBe(7);
		expect(j.guizang).toBe(1);
		expect(j.gua).toBe('明夷');
		expect(j.guaNum).toBe(308);
	});

	test('太玄玉景通例：妻财丁卯 太玄6+6=12 + 9544 = 9556 ÷81 → 余79 →「難」，商117÷9 余0 → 取第9爻 → 归藏巽2', () => {
		const p = taiXuanPath('丁卯', 9544);
		expect(p.peishu).toBe(12);
		expect(p.sum).toBe(9556);
		expect(p.rem).toBe(79);
		expect(p.shou.name).toBe('難');
		expect(p.quotient).toBe(117);
		expect(p.yaoIdx).toBe(9);          // 商÷9 整除 → 取第9爻
		expect(p.guizang).toBe(2);         // 巽2
	});

	test('条文号皆可解出正文', () => {
		['性情', '祖业', '财运', '职业'].forEach((k) => {
			const n = R.benming[k] && R.benming[k].num;
			if (n) expect(VERSES[String(n)]).toBeTruthy();
		});
	});
});

describe('邵子神数 · 边界与降级', () => {
	test('闰月走闰月卦位，与非闰月不同', () => {
		const a = renMingShu({ lunarMonth: 1, lunarDay: 1, isLeapMonth: false });
		const b = renMingShu({ lunarMonth: 1, lunarDay: 1, isLeapMonth: true });
		expect(a.gua).not.toBe(b.gua);
	});

	test('父母年龄整除 12 时走特例公式（非常规式）', () => {
		expect(tianMingShu(24).special).toBe(true);
		expect(tianMingShu(27).special).toBe(false);
	});

	test('生辰查表未命中时显式记 note，不臆造', () => {
		const r = calcShaozi({ ...CASE, lunarDay: 99 });
		expect(r.notes.length).toBeGreaterThan(0);
		expect(r.benming).toBeUndefined();
	});
});
