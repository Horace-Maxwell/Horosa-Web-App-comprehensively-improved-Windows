// 飞宫小奇门 · 金标(golden)—— 古籍十二局图与载例逐项对齐。
// 🔴 失败 = 引擎错,不得改测试将就。
import {
	ZHI, ZHI_GONG, GONG_ZHI, YUAN_SHEN, TIAN_XING, BA_MEN,
	ZHONG_GONG_PAIRS, WUXING_SHENG, WUXING_KE, LIU_HE, LIU_CHONG,
	MEN_DUAN, SHEN_DUAN, XING_DUAN, TUI_DUAN, TIAN_XING_ALIAS,
} from '../core/feigongConst';
import {
	resolveQiZhi, yuanShenMap, jianXingZhi, tianXingMap, tianGanMap,
	xiuMenGong, baMenMap, buildJu, mingGong,
} from '../core/feigongJu';
import {
	wuXingOf, shengKeRel, xingShenSunYi, wangXiang, liuHeOf, liuChongOf,
	menDuan, shenDuan, xingDuan, zhuKe, gongDuan,
} from '../core/feigongDuan';

describe('金标① 十二局全量(古籍十二局图逐图所注)', () => {
	// 局支: [建星支, 甲干宫, 中宫双干, 休门宫]
	const GOLDEN = {
		子: ['申', 1, '戊癸', 2],
		丑: ['戌', 8, '丙辛', 9],
		寅: ['子', 8, '丙辛', 9],
		卯: ['寅', 3, '丙辛', 4],
		辰: ['辰', 4, '乙庚', 6],
		巳: ['午', 4, '乙庚', 6],
		午: ['申', 9, '乙庚', 1],
		未: ['戌', 2, '丁壬', 3],
		申: ['子', 2, '丁壬', 3],
		酉: ['寅', 7, '丁壬', 8],
		戌: ['辰', 6, '戊癸', 7],
		亥: ['午', 6, '戊癸', 7],
	};
	test('建星支 / 甲干宫 / 中宫双干 / 休门宫 12/12 吻合', () => {
		const bad = [];
		ZHI.forEach((z) => {
			const [jz, jiaGong, zhong, xiu] = GOLDEN[z];
			const ju = buildJu({ zhi: z });
			if (ju.jianZhi !== jz) bad.push(`${z}局 建星支: ${ju.jianZhi} ≠ ${jz}`);
			if (ju.tianGan.ganGong['甲'] !== jiaGong) bad.push(`${z}局 甲干宫: ${ju.tianGan.ganGong['甲']} ≠ ${jiaGong}`);
			if (ju.tianGan.zhongGong.join('') !== zhong) bad.push(`${z}局 中宫: ${ju.tianGan.zhongGong.join('')} ≠ ${zhong}`);
			if (ju.baMen.xiuMenGong !== xiu) bad.push(`${z}局 休门宫: ${ju.baMen.xiuMenGong} ≠ ${xiu}`);
		});
		expect(bad).toEqual([]);
	});
	test('中宫恒为五合双干(戊癸/乙庚/丙辛/丁壬),唯甲己不入中', () => {
		const legal = ZHONG_GONG_PAIRS.map((p) => p.join(''));
		ZHI.forEach((z) => {
			const tg = tianGanMap(z);
			expect(legal).toContain(tg.zhongGong.join(''));
			expect(tg.ganGong['甲']).not.toBe('中');
			expect(tg.ganGong['己']).not.toBe('中');
			// 每宫一干,中宫二干
			expect(tg.zhongGong).toHaveLength(2);
			[1, 2, 3, 4, 6, 7, 8, 9].forEach((g) => expect(tg.gongGan[g]).toHaveLength(1));
		});
	});
	test('建星公式 = (2×支序+7) mod 12,冲支同建(子午同申等)', () => {
		expect(jianXingZhi('子')).toBe('申');
		expect(jianXingZhi('午')).toBe('申');
		ZHI.forEach((z) => {
			const chong = LIU_CHONG[z];
			expect(jianXingZhi(z)).toBe(jianXingZhi(chong));
		});
	});
});

describe('金标② 八门落宫(书载布门例+局图)', () => {
	test('子时局杜门在坎一宫;寅时局景门在坎一宫', () => {
		expect(baMenMap('子').menGong['杜']).toBe(1);
		expect(baMenMap('寅').menGong['景']).toBe(1);
	});
	test('书载布门全例:青龙在二宫(未申),休三生四伤九杜二景七死六惊一开八', () => {
		const m = baMenMap('未'); // 未→青龙二宫
		expect(m.xiuMenGong).toBe(3);
		expect(m.menGong).toEqual({ 休: 3, 生: 4, 伤: 9, 杜: 2, 景: 7, 死: 6, 惊: 1, 开: 8 });
	});
	test('青龙在四宫,跳过中宫,从六宫起休门(辰巳局)', () => {
		expect(xiuMenGong('辰')).toBe(6);
		expect(xiuMenGong('巳')).toBe(6);
	});
});

describe('金标③ 乙酉日戌时佈局全图(古籍载例)', () => {
	const ju = buildJu({ zhi: '戌', dayGan: '乙', dayZhi: '酉' });
	test('日支酉值勾陈原神与执星', () => {
		expect(ju.yuanShen['酉']).toBe('勾陈');
		expect(ju.tianXing['酉']).toBe('执');
		expect(ju.dayZhiShen).toBe('勾陈');
		expect(ju.dayZhiXing).toBe('执');
	});
	test('日干乙在兑七宫,逢休门', () => {
		expect(ju.dayGanGong).toBe(7);
		expect(ju.baMen.gongMen[7]).toBe('休');
	});
	test('中宫戊癸;青龙居乾六宫;建星起辰', () => {
		expect(ju.tianGan.zhongGong).toEqual(['戊', '癸']);
		expect(ju.longGong).toBe(6);
		expect(ju.jianZhi).toBe('辰');
	});
});

describe('金标④ 原神顺佈(起戌)', () => {
	test('青龙起戌,顺行十二支,酉值勾陈(第十二位)', () => {
		const m = yuanShenMap('戌');
		expect(m['戌']).toBe('青龙');
		expect(m['亥']).toBe('明堂');
		expect(m['酉']).toBe('勾陈');
		expect(Object.keys(m)).toHaveLength(12);
		expect(new Set(Object.values(m)).size).toBe(12);
	});
});

describe('金标⑤ 定命宫法(古籍载例+按语外推)', () => {
	test('二十三岁,减一得二十二,去十位用个位 → 二宫', () => {
		const r = mingGong({ age: 23, gender: 'male' });
		expect(r.gong).toBe(2);
		expect(r.flags).toEqual([]);
	});
	test('三十五岁 → 值五宫,触发看戊(男)/己(女)所飞宫(卯局:戊七宫/己八宫)', () => {
		const ju = buildJu({ zhi: '卯' });
		const male = mingGong({ age: 35, gender: 'male', ju });
		expect(male.zhiWu).toBe(true);
		expect(male.via).toEqual(['戊']);
		expect(male.gong).toBe(7);
		const female = mingGong({ age: 35, gender: 'female', ju });
		expect(female.via).toEqual(['己']);
		expect(female.gong).toBe(8);
	});
	test('值五宫而戊入中(子局)→ 看同五行之己(推断五:壬则看癸,癸则看壬)', () => {
		const ju = buildJu({ zhi: '子' });
		const r = mingGong({ age: 35, gender: 'male', ju });
		expect(r.via).toEqual(['戊', '己']);
		expect(r.gong).toBe(ju.tianGan.ganGong['己']);
		expect(r.gong).toBe(6);
	});
	test('三十岁 → 个位为零,原典未载 → null 须手动', () => {
		expect(mingGong({ age: 30 }).gong).toBeNull();
	});
	test('七十五岁 → 外推加四得七十九 → 九宫,标「按规律推断,原典未载」', () => {
		const r = mingGong({ age: 75 });
		expect(r.gong).toBe(9);
		expect(r.flags.join('')).toMatch(/按规律推断,原典未载/);
	});
	test('几岁档(1-9)减三,标「原典存疑」;数不及位 → null', () => {
		const r = mingGong({ age: 7 });
		expect(r.gong).toBe(4);
		expect(r.flags.join('')).toMatch(/原典存疑/);
		expect(mingGong({ age: 2 }).gong).toBeNull();
	});
});

describe('金标⑥ 求财局(戊寅年甲寅月壬辰日丁未时,古籍实例解析)', () => {
	const ju = buildJu({ zhi: '未', dayGan: '壬', dayZhi: '辰' });
	test('未上起青龙(二宫);戌上起建星;甲干二坤位;中宫丁壬;休门震三居', () => {
		expect(ju.longGong).toBe(2);
		expect(ju.jianZhi).toBe('戌');
		expect(ju.tianGan.ganGong['甲']).toBe(2);
		expect(ju.tianGan.zhongGong).toEqual(['丁', '壬']);
		expect(ju.baMen.xiuMenGong).toBe(3);
	});
	test('日干壬入中宫,与丁同宫(「丁壬相冲千里之外,故有动象」);日支辰持玄武临破星', () => {
		expect(ju.dayGanGong).toBe('中');
		expect(ju.yuanShen['辰']).toBe('玄武');
		expect(ju.tianXing['辰']).toBe('破');
		expect(ju.dayZhiGong).toBe(4);
	});
	test('主客:日干之宫为主,日支之宫为客(推断一)', () => {
		const zk = zhuKe(ju);
		expect(zk.zhuGong).toBe('中');
		expect(zk.keGong).toBe(4);
		expect(zk.text).toBe(TUI_DUAN[0]);
	});
	test('宫面聚合:巽四宫辖辰巳,门星神俱全', () => {
		const g = gongDuan(ju, 4);
		expect(g.gua).toBe('巽');
		expect(g.zhis.map((z) => z.zhi)).toEqual(['辰', '巳']);
		expect(g.zhis[0].shen).toBe('玄武');
		expect(g.zhis[0].xing).toBe('破');
		expect(g.men).toBe(ju.baMen.gongMen[4]);
	});
});

describe('骨架完备性与工具函数', () => {
	test('地支配宫:四正一支,四隅两支;宫支互逆', () => {
		expect(ZHI_GONG).toEqual({ 子: 1, 丑: 8, 寅: 8, 卯: 3, 辰: 4, 巳: 4, 午: 9, 未: 2, 申: 2, 酉: 7, 戌: 6, 亥: 6 });
		Object.keys(GONG_ZHI).forEach((g) => {
			GONG_ZHI[g].forEach((z) => expect(ZHI_GONG[z]).toBe(Number(g)));
		});
	});
	test('十二原神/十二天星/八门次序', () => {
		expect(YUAN_SHEN).toEqual(['青龙', '明堂', '天刑', '朱雀', '金匮', '天德', '白虎', '玉堂', '天牢', '玄武', '司命', '勾陈']);
		expect(TIAN_XING).toEqual(['建', '除', '满', '平', '定', '执', '破', '危', '成', '收', '开', '闭']);
		expect(BA_MEN).toEqual(['休', '生', '伤', '杜', '景', '死', '惊', '开']);
		expect(TIAN_XING_ALIAS['危']).toBe('天罡(男星)');
		// 河魁口径默认「正传」(专表):收=河魁女星、开=贵人(异文见 xingDuan koujing 测)。
		expect(TIAN_XING_ALIAS['收']).toBe('河魁(女星)');
		expect(TIAN_XING_ALIAS['开']).toBe('贵人');
	});
	test('论断文全:八门 8 / 原神 12 / 天星 12 / 推断 12', () => {
		expect(Object.keys(MEN_DUAN)).toHaveLength(8);
		expect(Object.keys(SHEN_DUAN)).toHaveLength(12);
		expect(Object.keys(XING_DUAN)).toHaveLength(12);
		expect(TUI_DUAN).toHaveLength(12);
		expect(menDuan('休').ge).toMatch(/^公求相讲遇休门/);
		expect(shenDuan('玄武').text).toBe('内小人盗贼暗害。忌词讼博戏。');
		expect(xingDuan('危').text).toBe('名天罡,主男星。');
		// 河魁口径:默认正传(收=河魁/开=贵人),异文(yi)两说互换。
		expect(xingDuan('收').alias).toBe('河魁(女星)');
		expect(xingDuan('开').alias).toBe('贵人');
		expect(xingDuan('收').text).toBe('名河魁,主女星。有人助。');
		expect(xingDuan('收', 'yi').alias).toBe('贵人');
		expect(xingDuan('开', 'yi').alias).toBe('河魁(女星)');
		expect(xingDuan('开', 'yi').text).toBe('名河魁,主女星。宜叙婚姻,行宴乐。');
	});
	test('起局支四模式:hour/manualZhi/manualNum/yearZhi', () => {
		expect(resolveQiZhi({ mode: 'hour', hourZhi: '戌' })).toBe('戌');
		expect(resolveQiZhi({ mode: 'manualZhi', zhi: '未' })).toBe('未');
		expect(resolveQiZhi({ mode: 'manualNum', num: 1 })).toBe('子');
		expect(resolveQiZhi({ mode: 'manualNum', num: 14 })).toBe('丑');
		expect(resolveQiZhi({ mode: 'yearZhi', yearZhi: '卯' })).toBe('卯');
	});
	test('五行生克与旺相休囚', () => {
		expect(WUXING_SHENG['水']).toBe('木');
		expect(WUXING_KE['金']).toBe('木');
		expect(wuXingOf('壬')).toBe('水');
		expect(wuXingOf('辰')).toBe('土');
		expect(wuXingOf('兑')).toBe('金');
		expect(wuXingOf('休')).toBe('水');
		expect(shengKeRel('金', '水')).toBe('生我');
		expect(shengKeRel('金', '木')).toBe('克我');
		expect(shengKeRel('木', '火')).toBe('生我');   // 主体木生「我」火
		expect(shengKeRel('火', '木')).toBe('我生');   // 「我」木生主体火
		expect(shengKeRel('木', '木')).toBe('比和');
		expect(xingShenSunYi('吉', '生我')).toBe('大吉');
		expect(xingShenSunYi('吉', '克我')).toBe('小吉');
		expect(xingShenSunYi('凶', '生我')).toBe('小凶');
		expect(xingShenSunYi('凶', '克我')).toBe('大凶');
		expect(wangXiang('木', '春')).toBe('旺');
		expect(wangXiang('水', '春')).toBe('休');
		expect(wangXiang('土', '四季末')).toBe('旺');
	});
	test('六合六冲', () => {
		expect(liuHeOf('子')).toBe('丑');
		expect(liuChongOf('子')).toBe('午');
		Object.keys(LIU_HE).forEach((z) => expect(LIU_HE[LIU_HE[z]]).toBe(z));
		Object.keys(LIU_CHONG).forEach((z) => expect(LIU_CHONG[LIU_CHONG[z]]).toBe(z));
	});
});
