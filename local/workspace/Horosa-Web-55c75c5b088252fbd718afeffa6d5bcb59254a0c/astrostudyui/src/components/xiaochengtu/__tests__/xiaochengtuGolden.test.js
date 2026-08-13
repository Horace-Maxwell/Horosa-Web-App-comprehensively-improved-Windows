// 小成图 · 金标(golden)—— 古籍与今传本载例逐字对齐。
// 🔴 失败 = 引擎错,不得改测试将就。
import { qiGuaManual, qiGuaByNumbers, qiGuaByStock, qiGuaByDaYan, qiGuaByYaoQian, guaByTianDiShu, guaByXianTian, hexInfo, linesOfHex } from '../core/xiaochengtuQiGua';
import { buildPan, zhengTui, zhengTuiText, pangTui, tuiDao, shuZhan, siXiang, siXiangOfHex, fuDu, zhangDie, sanFen, liangFen, liangFenZhi, riCandidates, yingQiTui, suggestGong, klineYongGong } from '../core/xiaochengtuPan';
import { DI_PAN, GUA_GONG, PANG_GONG, FUDU, SI_XIANG_BASE, SI_XIANG_MATRIX, SI_XIANG_MATRIX_BY_KOUJING, PI_CI_KOUJING, GUA_ZUO_ZHI, ZHI_YUE, ZHI_YANG, ZHI_YIN, GONG_INFO, SHI_GONG_SUGGEST, BU_JU_SLOTS } from '../core/xiaochengtuConst';

/** 天盘断言小工具:宫→卦 */
function expectTianPan(pan, want) {
	Object.keys(want).forEach((g) => {
		expect(`${g}:${pan.tianPan[g]}`).toBe(`${g}:${want[g]}`);
	});
}

describe('金标① 履之晋佈局(古籍简述章载例)', () => {
	// 天泽履 [1,1,0,1,1,1] 之 火地晋 [0,0,0,1,0,1]:动爻 1、2、5
	const qi = qiGuaManual({ up: '乾', lo: '兑', dongYaos: [1, 2, 5] });
	test('本卦=天泽履,之卦=火地晋', () => {
		expect(qi.ben.name).toBe('天泽履');
		expect(qi.zhi.name).toBe('火地晋');
	});
	test('佈局 = 9乾 1兑 3离 7坤 4巽 2离 8坎 6艮', () => {
		const pan = buildPan(qi);
		expectTianPan(pan, { 9: '乾', 1: '兑', 3: '离', 7: '坤', 4: '巽', 2: '离', 8: '坎', 6: '艮' });
	});
});

describe('金标② 股市例一(开1563.62 收1571.60)', () => {
	const qi = qiGuaByStock({ open: '1563.62', close: '1571.60' });
	const pan = buildPan(qi);

	test('起卦:15%8=7艮 / 8作8=坤 / 14%8=6坎 / 6坎(主=山地剥,变=坎为水)', () => {
		expect(qi.ben.up).toBe('艮');
		expect(qi.ben.lo).toBe('坤');
		expect(qi.zhi.up).toBe('坎');
		expect(qi.zhi.lo).toBe('坎');
		expect(qi.ben.name).toBe('山地剥');
		expect(qi.zhi.name).toBe('坎为水');
	});
	test('佈局 = 9艮 1坤 4坤 2坤 3坎 7坎 8艮 6震', () => {
		expectTianPan(pan, { 9: '艮', 1: '坤', 4: '坤', 2: '坤', 3: '坎', 7: '坎', 8: '艮', 6: '震' });
	});
	test('正推八宫逐字(今传本示例一)', () => {
		// 正推1 艮宫:伏位
		expect(zhengTuiText(zhengTui(pan, 8))).toBe('艮宫艮卦,天地盘相同,伏位不动');
		// 正推2 坎宫:坎宫坤卦而止(继续推导是坤宫坤卦,天地相同,无须推导)
		expect(zhengTuiText(zhengTui(pan, 1))).toBe('坎宫坤卦而止');
		// 正推3 乾宫:乾宫震卦→震宫坎卦→坎宫坤卦而止
		expect(zhengTuiText(zhengTui(pan, 6))).toBe('乾宫震卦→震宫坎卦→坎宫坤卦而止');
		// 正推4 兑宫:兑宫坎卦→坎宫坤卦而止
		expect(zhengTuiText(zhengTui(pan, 7))).toBe('兑宫坎卦→坎宫坤卦而止');
		// 正推5 坤宫:伏位
		expect(zhengTuiText(zhengTui(pan, 2))).toBe('坤宫坤卦,天地盘相同,伏位不动');
		// 正推6 离宫:离宫艮卦而止
		expect(zhengTuiText(zhengTui(pan, 9))).toBe('离宫艮卦而止');
		// 正推7 巽宫:巽宫坤卦而止
		expect(zhengTuiText(zhengTui(pan, 4))).toBe('巽宫坤卦而止');
		// 正推8 震宫:震宫坎卦→坎宫坤卦而止
		expect(zhengTuiText(zhengTui(pan, 3))).toBe('震宫坎卦→坎宫坤卦而止');
	});
	test('旁推:坤宫伏位→乾宫得震;艮宫伏位→兑宫得坎', () => {
		const kun = tuiDao(pan, 2);
		expect(kun.fuWei).toBe(true);
		expect(kun.pang.pangGong).toBe(6);
		expect(kun.pang.gua).toBe('震');
		const gen = tuiDao(pan, 8);
		expect(gen.fuWei).toBe(true);
		expect(gen.pang.pangGong).toBe(7);
		expect(gen.pang.gua).toBe('坎');
	});
	test('用宫:带上下影线之阳线 = 离(明载,不标推断)', () => {
		const k = klineYongGong({ body: '阳', upper: true, lower: true });
		expect(k.gua).toBe('离');
		expect(k.gong).toBe(9);
		expect(k.inferred).toBe(false);
	});
});

describe('金标③ 股市例二(开11370.400)按公式', () => {
	test('主卦上 = 1+1+3+7+0=12,12%8=4 → 震(按公式;今传本例文自算有误,不随之)', () => {
		const qi = qiGuaByStock({ open: '11370.400', close: '11423.500' });
		expect(qi.steps[0].value).toBe('震');
		expect(qi.ben.up).toBe('震');
	});
});

describe('金标④ 数占:家人之损,从震宫起(古籍简述章载例)', () => {
	// 风火家人 [1,0,1,0,1,1] 之 山泽损 [1,1,0,0,0,1]:动爻 2、3、5
	const qi = qiGuaManual({ up: '巽', lo: '离', dongYaos: [2, 3, 5] });
	const pan = buildPan(qi);
	test('本卦=风火家人,之卦=山泽损', () => {
		expect(qi.ben.name).toBe('风火家人');
		expect(qi.zhi.name).toBe('山泽损');
	});
	test('链逐字:震宫艮卦→艮宫坤卦→坤宫坎卦→坎宫离卦→离宫巽卦→巽宫离卦而止', () => {
		expect(zhengTuiText(zhengTui(pan, 3)))
			.toBe('震宫艮卦→艮宫坤卦→坤宫坎卦→坎宫离卦→离宫巽卦→巽宫离卦而止');
	});
	test('宫数序列 [艮8,坤2,坎1,离9,巽4,离9],和 = 33(「六数相加 8+2+1+9+4+9=33支」)', () => {
		const r = shuZhan(pan, 3);
		expect(r.steps.map((s) => `${s.tianGua}${s.shu}`)).toEqual(['艮8', '坤2', '坎1', '离9', '巽4', '离9']);
		expect(r.sum).toBe(33);
	});
});

describe('金标⑤ 乾之兑(古籍简述章载例)', () => {
	// 乾为天 [1,1,1,1,1,1] 之 兑为泽 [1,1,0,1,1,0]:动爻 3、6
	const qi = qiGuaManual({ up: '乾', lo: '乾', dongYaos: [3, 6] });
	const pan = buildPan(qi);
	test('佈局 = 9乾 1乾 3兑 7兑 4乾 2乾 8巽 6离', () => {
		expectTianPan(pan, { 9: '乾', 1: '乾', 3: '兑', 7: '兑', 4: '乾', 2: '乾', 8: '巽', 6: '离' });
	});
	test('艮宫天盘 = 巽(「艮宫巽,巽入也,来人之象」)', () => {
		expect(pan.tianPan[8]).toBe('巽');
	});
	test('巽宫正推首步得乾(「从艮宫巽正推得巽宫乾」)', () => {
		const r = zhengTui(pan, 4);
		expect(r.fuWei).toBe(false);
		expect(r.steps[0].tianGua).toBe('乾');
		// 从艮宫起之链亦印证:艮宫巽卦→巽宫乾卦→……
		const g = zhengTui(pan, 8);
		expect(g.steps[0].tianGua).toBe('巽');
		expect(g.steps[1]).toMatchObject({ gong: 4, tianGua: '乾' });
	});
	test('巽之旁推到震宫得兑(「则用巽之旁推到震宫得兑(雷风相薄)」)', () => {
		const p = pangTui(pan, 4);
		expect(p.pangGong).toBe(3);
		expect(p.gua).toBe('兑');
	});
	test('何时来:乾数六;兑为上主爻卦,三分法为上旬(初六日)', () => {
		expect(GUA_GONG['乾']).toBe(6);
		expect(fuDu('兑')).toEqual({ gua: '兑', zhuYao: '上', fudu: '大' });
	});
});

describe('金标⑥ 四象阖辟往来(古籍例图四大纲要)', () => {
	test('乾为天 = 往(悔);坤为地 = 來(吝)', () => {
		const qian = siXiang('乾', '乾');
		expect(qian.type).toBe('往');
		expect(qian.dePei).toBe(false);
		expect(qian.ci).toBe('悔');
		expect(qian.baseCi).toBe('悔');
		const kun = siXiang('坤', '坤');
		expect(kun.type).toBe('來');
		expect(kun.ci).toBe('吝');
	});
	test('地天泰 = 闔(吉,向心得配);天地否 = 闢(基调凶,离心;辞随口径)', () => {
		const tai = siXiang('坤', '乾');
		expect(tai.type).toBe('闔');
		expect(tai.yi).toBe('向心');
		expect(tai.dePei).toBe(true);
		expect(tai.ci).toBe('吉');
		expect(tai.baseCi).toBe('吉');
		const pi = siXiang('乾', '坤');
		expect(pi.type).toBe('闢');
		expect(pi.yi).toBe('离心');
		expect(pi.baseCi).toBe('凶');
		// 🔴 正传(默认,乙本原文逐字「辟…阴阳得配为害,阴阳失配为利」):否卦乾阳坤阴得配 → 害
		expect(pi.ci).toBe('害');
		// 异文(甲本情伪论所推:得配为情为利) → 利
		expect(siXiang('乾', '坤', 'yiwen').ci).toBe('利');
	});
	test('矩阵全表:往亨悔 / 來貞吝 / 闔吉凶 / 闢随口径(正传害利·异文利害)', () => {
		expect(SI_XIANG_MATRIX).toEqual({
			往: { 得配: '亨', 失配: '悔' },
			來: { 得配: '貞', 失配: '吝' },
			闔: { 得配: '吉', 失配: '凶' },
			闢: { 得配: '害', 失配: '利' },
		});
		expect(SI_XIANG_MATRIX_BY_KOUJING.zheng).toEqual(SI_XIANG_MATRIX);
		expect(SI_XIANG_MATRIX_BY_KOUJING.yiwen).toEqual({
			往: { 得配: '亨', 失配: '悔' },
			來: { 得配: '貞', 失配: '吝' },
			闔: { 得配: '吉', 失配: '凶' },
			闢: { 得配: '利', 失配: '害' },
		});
		expect(PI_CI_KOUJING).toEqual({ zheng: { 得配: '害', 失配: '利' }, yiwen: { 得配: '利', 失配: '害' } });
		// 图注基调两本一致(例图皆标 辟=凶),不随口径
		expect(SI_XIANG_BASE).toEqual({ 往: '悔', 來: '吝', 闔: '吉', 闢: '凶' });
		// 失配之闔为凶(取纯阴对:上兑降下离升=闔,兑离皆阴,失配为凶)
		const x = siXiang('兑', '离');
		expect(x.type).toBe('闔');
		expect(x.dePei).toBe(false);
		expect(x.ci).toBe('凶');
	});
	test('往/來/闔 三象两口径全同(只闢一象相反)', () => {
		const GUA = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'];
		let piDiff = 0;
		GUA.forEach((u) => GUA.forEach((l) => {
			const a = siXiang(u, l, 'zheng');
			const b = siXiang(u, l, 'yiwen');
			expect(a.type).toBe(b.type);
			if (a.type === '闢') { expect(a.ci).not.toBe(b.ci); piDiff += 1; }
			else { expect(a.ci).toBe(b.ci); }
		}));
		expect(piDiff).toBe(16); // 上升下降之组合数(升4×降4)
	});
	test('非法口径 → 回落正传(不静默产异文)', () => {
		expect(siXiang('乾', '坤', 'nope').ci).toBe('害');
		expect(siXiang('乾', '坤', 'nope').koujing).toBe('zheng');
	});
	test('情伪与升降标注:得配为情、失配为伪;独坎降独离升已烘焙', () => {
		expect(siXiang('乾', '坤').qingWei).toBe('情');
		expect(siXiang('乾', '乾').qingWei).toBe('伪');
		expect(siXiang('坎', '离').sheng).toEqual({ up: '降', lo: '升' });
	});
	test('六爻卦四象:履(上乾升下兑降)= 闢', () => {
		const hex = hexInfo(linesOfHex('乾', '兑'));
		const s = siXiangOfHex(hex);
		expect(s.type).toBe('闢');
		expect(s.dePei).toBe(true); // 乾阳兑阴
		expect(s.ci).toBe('害');                          // 正传
		expect(siXiangOfHex(hex, 'yiwen').ci).toBe('利'); // 异文
	});
});

describe('金标⑦ K线定用宫(八分支+十字星)', () => {
	test('八分支逐一(明载四支不标推断,推补四支标 inferred)', () => {
		expect(klineYongGong({ body: '阳' })).toMatchObject({ gua: '乾', inferred: false, gong: 6 });
		expect(klineYongGong({ body: '阳', upper: true, lower: true })).toMatchObject({ gua: '离', inferred: false, gong: 9 });
		expect(klineYongGong({ body: '阳', upper: true })).toMatchObject({ gua: '兑', inferred: true, gong: 7 });
		expect(klineYongGong({ body: '阳', lower: true })).toMatchObject({ gua: '巽', inferred: true, gong: 4 });
		expect(klineYongGong({ body: '阴' })).toMatchObject({ gua: '坤', inferred: false, gong: 2 });
		expect(klineYongGong({ body: '阴', upper: true, lower: true })).toMatchObject({ gua: '坎', inferred: false, gong: 1 });
		expect(klineYongGong({ body: '阴', upper: true })).toMatchObject({ gua: '艮', inferred: true, gong: 8 });
		expect(klineYongGong({ body: '阴', lower: true })).toMatchObject({ gua: '震', inferred: true, gong: 3 });
	});
	test('十字星(阴阳莫辨)→ null,须手动定用宫', () => {
		expect(klineYongGong({ body: '阳', doji: true })).toBeNull();
	});
});

describe('金标⑧ 履之晋正推八宫(今传本示例二)', () => {
	const qi = qiGuaManual({ up: '乾', lo: '兑', dongYaos: [1, 2, 5] });
	const pan = buildPan(qi);
	test('正推1-7 逐字', () => {
		expect(zhengTuiText(zhengTui(pan, 8)))
			.toBe('艮宫坎卦→坎宫兑卦→兑宫坤卦→坤宫离卦→离宫乾卦→乾宫艮卦而止');
		expect(zhengTuiText(zhengTui(pan, 1)))
			.toBe('坎宫兑卦→兑宫坤卦→坤宫离卦→离宫乾卦→乾宫艮卦→艮宫坎卦而止');
		expect(zhengTuiText(zhengTui(pan, 6)))
			.toBe('乾宫艮卦→艮宫坎卦→坎宫兑卦→兑宫坤卦→坤宫离卦→离宫乾卦而止');
		expect(zhengTuiText(zhengTui(pan, 7)))
			.toBe('兑宫坤卦→坤宫离卦→离宫乾卦→乾宫艮卦→艮宫坎卦→坎宫兑卦而止');
		expect(zhengTuiText(zhengTui(pan, 2)))
			.toBe('坤宫离卦→离宫乾卦→乾宫艮卦→艮宫坎卦→坎宫兑卦→兑宫坤卦而止');
		expect(zhengTuiText(zhengTui(pan, 9)))
			.toBe('离宫乾卦→乾宫艮卦→艮宫坎卦→坎宫兑卦→兑宫坤卦→坤宫离卦而止');
		const xun = tuiDao(pan, 4);
		expect(xun.fuWei).toBe(true);           // 巽宫巽卦,伏位
		expect(xun.pang.gua).toBe('离');        // 「震与巽互为旁宫」,震宫天盘为离
	});
	test('正推8 震宫:按止推定则得七步(今传本该条载六步无由而止,疑脱一步;从定则)', () => {
		expect(zhengTuiText(zhengTui(pan, 3)))
			.toBe('震宫离卦→离宫乾卦→乾宫艮卦→艮宫坎卦→坎宫兑卦→兑宫坤卦→坤宫离卦而止');
	});
});

describe('配数边界与无动爻口径', () => {
	test('天地数:mod 10 余 0 作 10 → 坤;13 → 艮', () => {
		expect(guaByTianDiShu(10)).toEqual({ num: 10, gua: '坤' });
		expect(guaByTianDiShu(13)).toEqual({ num: 3, gua: '艮' });
	});
	test('先天卦数:mod 8 余 0 作 8 → 坤(股市例一开盘小数位 6+2=8 即此例)', () => {
		expect(guaByXianTian(8)).toEqual({ num: 8, gua: '坤' });
		expect(guaByXianTian(16)).toEqual({ num: 8, gua: '坤' });
		expect(guaByXianTian(15)).toEqual({ num: 7, gua: '艮' });
	});
	test('number 模式流派:tiandi 默认 / xiantian 可选', () => {
		expect(qiGuaByNumbers({ upNum: 3, loNum: 8 }).ben.up).toBe('艮');   // 天地数 3=艮
		expect(qiGuaByNumbers({ upNum: 3, loNum: 8, qiguaShu: 'xiantian' }).ben.up).toBe('离'); // 先天 3=离
	});
	test('无动爻 → 之卦=本卦(「仍按其卦作之卦排出即可」)', () => {
		const qi = qiGuaManual({ up: '乾', lo: '兑', dongYaos: [] });
		expect(qi.zhi.name).toBe(qi.ben.name);
		const pan = buildPan(qi);
		expect(pan.tianPan[3]).toBe(pan.tianPan[9]);
		expect(pan.tianPan[7]).toBe(pan.tianPan[1]);
	});
	test('涨跌两分法:升卦涨(乾艮震离)/降卦跌(坎巽坤兑)', () => {
		expect(['乾', '艮', '震', '离'].map(zhangDie)).toEqual(['涨', '涨', '涨', '涨']);
		expect(['坎', '巽', '坤', '兑'].map(zhangDie)).toEqual(['跌', '跌', '跌', '跌']);
	});
	test('幅度三分:上主爻大(艮兑乾)/中主爻中(坎离)/下主爻小(震巽坤)', () => {
		expect(FUDU).toEqual({ 艮: '大', 兑: '大', 乾: '大', 坎: '中', 离: '中', 震: '小', 巽: '小', 坤: '小' });
	});
	test('旁宫对:震巽/艮兑/离坎/乾坤两两互旁', () => {
		expect(PANG_GONG).toEqual({ 3: 4, 4: 3, 8: 7, 7: 8, 9: 1, 1: 9, 6: 2, 2: 6 });
		Object.keys(PANG_GONG).forEach((g) => {
			expect(PANG_GONG[PANG_GONG[g]]).toBe(Number(g));
		});
	});
	test('地盘九宫与卦数互逆', () => {
		Object.keys(DI_PAN).forEach((g) => {
			expect(GUA_GONG[DI_PAN[g]]).toBe(Number(g));
		});
	});
});

describe('金标⑨ 大衍蓍草起卦(十八变·可复现)', () => {
	test('同 seed 必复现(纯派生,零随机源)', () => {
		const a = qiGuaByDaYan({ seed: 20250718 });
		const b = qiGuaByDaYan({ seed: 20250718 });
		expect(a.counts).toEqual(b.counts);
		expect(a.ben.name).toBe(b.ben.name);
		expect(a.zhi.name).toBe(b.zhi.name);
		expect(a.dongYaos).toEqual(b.dongYaos);
	});
	test('每爻数必落 6/7/8/9;动爻=老阴6/老阳9', () => {
		const r = qiGuaByDaYan({ seed: 7 });
		expect(r.counts).toHaveLength(6);
		r.counts.forEach((c) => expect([6, 7, 8, 9]).toContain(c));
		// 动爻位恰为 counts 中 6 或 9 之位(自下而上 1..6)
		const wantDong = r.counts.map((c, i) => ((c === 6 || c === 9) ? i + 1 : 0)).filter(Boolean);
		expect(r.dongYaos).toEqual(wantDong);
	});
	test('手录六爻:全少阳=乾为天(无动,之卦=本卦)', () => {
		const r = qiGuaByDaYan({ manualCounts: [7, 7, 7, 7, 7, 7] });
		expect(r.ben.name).toBe('乾为天');
		expect(r.dongYaos).toEqual([]);
		expect(r.zhi.name).toBe('乾为天');
	});
	test('手录六爻:全老阳=乾为天 之 坤为地(六爻皆动)', () => {
		const r = qiGuaByDaYan({ manualCounts: [9, 9, 9, 9, 9, 9] });
		expect(r.ben.name).toBe('乾为天');
		expect(r.dongYaos).toEqual([1, 2, 3, 4, 5, 6]);
		expect(r.zhi.name).toBe('坤为地');
	});
	test('手录六爻:全老阴=坤为地 之 乾为天', () => {
		const r = qiGuaByDaYan({ manualCounts: [6, 6, 6, 6, 6, 6] });
		expect(r.ben.name).toBe('坤为地');
		expect(r.dongYaos).toEqual([1, 2, 3, 4, 5, 6]);
		expect(r.zhi.name).toBe('乾为天');
	});
	test('本卦阴阳:9/7=阳、6/8=阴;动爻取 9/6 之位', () => {
		const r = qiGuaByDaYan({ manualCounts: [9, 7, 8, 6, 7, 8] });
		// 自下而上 [阳,阳,阴,阴,阳,阴]
		expect(r.ben.lines).toEqual([1, 1, 0, 0, 1, 0]);
		expect(r.dongYaos).toEqual([1, 4]); // 位1=老阳9、位4=老阴6
	});
	test('非法手录(长度/取值)→ 落 seed 派生兜底(仍成卦)', () => {
		const bad = qiGuaByDaYan({ manualCounts: [1, 2, 3], seed: 3 });
		expect(bad.counts).toHaveLength(6);
		bad.counts.forEach((c) => expect([6, 7, 8, 9]).toContain(c));
		expect(bad.ben.name).toBeTruthy();
	});
});

describe('金标⑩ 通用应期:三分法(旬)/ 两分法(半月)', () => {
	test('三分法:上主爻卦(艮兑乾)→上旬 / 中主爻卦(坎离)→中旬 / 下主爻卦(震巽坤)→下旬', () => {
		expect(['艮', '兑', '乾'].map((g) => sanFen(g).xun)).toEqual(['上', '上', '上']);
		expect(['坎', '离'].map((g) => sanFen(g).xun)).toEqual(['中', '中']);
		expect(['震', '巽', '坤'].map((g) => sanFen(g).xun)).toEqual(['下', '下', '下']);
	});
	test('旁推得兑 → 上旬(spec 例)', () => {
		expect(sanFen('兑')).toEqual({ gua: '兑', xun: '上' });
	});
	test('两分法:升卦(乾艮震离)=阳=前半 / 降卦(坎巽坤兑)=阴=后半', () => {
		['乾', '艮', '震', '离'].forEach((g) => {
			expect(liangFen(g)).toEqual({ gua: g, ban: '前半', yy: '阳' });
		});
		['坎', '巽', '坤', '兑'].forEach((g) => {
			expect(liangFen(g)).toEqual({ gua: g, ban: '后半', yy: '阴' });
		});
	});
	test('非卦名 → null(与股市 fuDu/zhangDie 分治,互不影响)', () => {
		expect(sanFen('X')).toBeNull();
		expect(liangFen('X')).toBeNull();
		// 股市两法仍在,零回归
		expect(fuDu('兑')).toEqual({ gua: '兑', zhuYao: '上', fudu: '大' });
		expect(zhangDie('兑')).toBe('跌');
	});
});

describe('金标⑪ 睽之归妹佈局(甲本载例之卦;按四正四隅规则派生)', () => {
	// 睽 = 上离下兑 [1,1,0,1,0,1];归妹 = 上震下兑 [1,1,0,1,0,0];异在上爻 → 动爻 6
	const qi = qiGuaManual({ up: '离', lo: '兑', dongYaos: [6] });
	test('本卦=火泽睽,之卦=雷泽归妹', () => {
		expect(qi.ben.name).toBe('火泽睽');
		expect(qi.zhi.name).toBe('雷泽归妹');
	});
	test('佈局 = 9离 1兑 3震 7兑 4坎 2离 8坎 6离', () => {
		expectTianPan(buildPan(qi), { 9: '离', 1: '兑', 3: '震', 7: '兑', 4: '坎', 2: '离', 8: '坎', 6: '离' });
	});
});

describe('金标⑫ 应期推演链(乙本例二「乾之兑」问来人,逐跳对读原文)', () => {
	// 乾为天 之 兑为泽:动爻 3、6;问来人 → 用宫艮八(「问来人看艮宫」)
	const qi = qiGuaManual({ up: '乾', lo: '乾', dongYaos: [3, 6] });
	const pan = buildPan(qi);
	const r = yingQiTui(pan, 8);

	test('①起宫:用宫艮八非伏位,天盘得巽(「艮宫巽,巽入也,来人之象」)', () => {
		expect(r.fuWei).toBe(false);
		expect(r.startGong).toBe(8);
		expect(r.startGua).toBe('巽');
	});
	test('②正推得日卦:「从艮宫巽正推得巽宫乾,乾数六」', () => {
		expect(r.riGua).toBe('乾');
		expect(r.riShu).toBe(6);
	});
	test('③日候选:「每月有初六十六二十六」逐字', () => {
		expect(r.riCandidates).toEqual(['初六', '十六', '二十六']);
	});
	test('④三分定旬:「用巽之旁推到震宫得兑…三分法则兑为上旬初六日」', () => {
		expect(r.xunGua).toBe('兑');
		expect(r.xun).toBe('上');
		expect(r.ri).toBe('初六');
	});
	test('⑤旁推得月卦:「乾六旁推坤宫又得乾」;⑥「乾坐戌亥二月建」(明载,非推补)', () => {
		expect(r.yueGua).toBe('乾');
		expect(r.zuoZhi).toEqual(['戌', '亥']);
		expect(r.zuoZhiInferred).toBe(false);
	});
	test('⑦两分定支:「又用乾正推视乾宫为离,离属阴支,两分法得亥」', () => {
		expect(r.dingZhiGua).toBe('离');
		expect(r.dingZhiYY).toBe('阴');
		expect(r.zhi).toBe('亥');
	});
	test('⑧定月定日 = 农历十月初六(「是为十月初六日到也」,亦即所载应验之日)', () => {
		expect(r.yue).toBe('十月');
		expect(r.summary).toBe('农历十月初六');
	});
	test('逐跳依据可展示(八步齐备,每步有 label/text)', () => {
		expect(r.steps.map((s) => s.label)).toEqual(['起宫', '正推得日卦', '日候选', '三分定旬', '旁推得月卦', '两分定支', '定月']);
		r.steps.forEach((s) => expect(typeof s.text === 'string' && s.text.length > 0).toBe(true));
	});
	test('伏位用宫依旁推自旁宫起(本盘兑七宫天地同卦 → 自艮八宫起)', () => {
		expect(pan.tianPan[7]).toBe(DI_PAN[7]); // 兑宫兑卦=伏位
		const f = yingQiTui(pan, 7);
		expect(f.fuWei).toBe(true);
		expect(f.startGong).toBe(8);       // 「艮与兑互为旁宫」
		expect(f.startGua).toBe('巽');
		expect(f.summary).toBe('农历十月初六'); // 起宫同得巽,故与艮宫起同应期
	});
});

describe('金标⑬ 摇钱三变起卦(通行摇钱古法;载例皆自摇钱而得)', () => {
	test('同 seed 必复现(纯派生,零随机源)', () => {
		const a = qiGuaByYaoQian({ seed: 19971018 });
		const b = qiGuaByYaoQian({ seed: 19971018 });
		expect(a.counts).toEqual(b.counts);
		expect(a.ben.name).toBe(b.ben.name);
		expect(a.dongYaos).toEqual(b.dongYaos);
		expect(a.mode).toBe('yaoqian');
	});
	test('每爻数必落 6/7/8/9;动爻=老阴6/老阳9', () => {
		const r = qiGuaByYaoQian({ seed: 11 });
		expect(r.counts).toHaveLength(6);
		r.counts.forEach((c) => expect([6, 7, 8, 9]).toContain(c));
		expect(r.dongYaos).toEqual(r.counts.map((c, i) => ((c === 6 || c === 9) ? i + 1 : 0)).filter(Boolean));
	});
	test('步文逐爻记背字数(背数+6=爻数)', () => {
		const r = qiGuaByYaoQian({ manualCounts: [9, 6, 7, 8, 7, 8] });
		expect(r.steps[0].detail).toBe('三变得 3背0字 → 9(老阳 ○)');
		expect(r.steps[1].detail).toBe('三变得 0背3字 → 6(老阴 ×)');
		expect(r.steps[3].detail).toBe('三变得 2背1字 → 8(少阴)');
	});
	test('手录六爻:全老阳=乾为天 之 坤为地;非法手录回落种子', () => {
		const r = qiGuaByYaoQian({ manualCounts: [9, 9, 9, 9, 9, 9] });
		expect(r.ben.name).toBe('乾为天');
		expect(r.zhi.name).toBe('坤为地');
		expect(r.dongYaos).toEqual([1, 2, 3, 4, 5, 6]);
		const bad = qiGuaByYaoQian({ manualCounts: [5, 5], seed: 3 });
		expect(bad.counts).toHaveLength(6);
		bad.counts.forEach((c) => expect([6, 7, 8, 9]).toContain(c));
	});
	test('分布近摇钱之数(少阳少阳多于老阴老阳;1:3:3:1 之势)', () => {
		const all = [];
		for (let s = 1; s <= 400; s += 1) { all.push(...qiGuaByYaoQian({ seed: s * 7919 }).counts); }
		const n = (v) => all.filter((c) => c === v).length;
		expect(n(7) + n(8)).toBeGreaterThan(n(6) + n(9)); // 少阴少阳(6/8)多于老阴老阳(2/8)
		[6, 7, 8, 9].forEach((v) => expect(n(v)).toBeGreaterThan(0));
	});
});

describe('金标⑭ 阴阳两分定支 / 卦坐支表', () => {
	test('阴阳两分依说卦:乾坎艮震=阳,巽离坤兑=阴', () => {
		['乾', '坎', '艮', '震'].forEach((g) => expect(liangFenZhi(g).yy).toBe('阳'));
		['巽', '离', '坤', '兑'].forEach((g) => expect(liangFenZhi(g).yy).toBe('阴'));
		expect(liangFenZhi('X')).toBeNull();
	});
	test('🔴 与升降两分分治:坎离二卦两法结论正相反(载例「离属阴支」之据)', () => {
		expect(liangFenZhi('离').yy).toBe('阴');   // 阴阳法:离阴
		expect(liangFen('离').yy).toBe('阳');      // 升降法:离升为阳(前半月)
		expect(liangFenZhi('坎').yy).toBe('阳');   // 阴阳法:坎阳
		expect(liangFen('坎').yy).toBe('阴');      // 升降法:坎降为阴(后半月)
		// 其余六卦两法同向,只坎离颠倒
		['乾', '艮', '震'].forEach((g) => expect(liangFenZhi(g).yy).toBe(liangFen(g).yy));
		['巽', '坤', '兑'].forEach((g) => expect(liangFenZhi(g).yy).toBe(liangFen(g).yy));
	});
	test('卦坐支:十二支全覆盖无重;唯乾明载(「乾坐戌亥二月建」)其余标推补', () => {
		const all = Object.keys(GUA_ZUO_ZHI).reduce((acc, g) => acc.concat(GUA_ZUO_ZHI[g].zhis), []);
		expect(all).toHaveLength(12);
		expect(new Set(all).size).toBe(12);
		Object.keys(ZHI_YUE).forEach((z) => expect(all).toContain(z));
		expect(GUA_ZUO_ZHI['乾']).toEqual({ zhis: ['戌', '亥'], inferred: false });
		expect(Object.keys(GUA_ZUO_ZHI).filter((g) => !GUA_ZUO_ZHI[g].inferred)).toEqual(['乾']);
	});
	test('🔴 四双支卦恰各一阳一阴(故两分法必能定其一);四单支卦直取', () => {
		const dual = Object.keys(GUA_ZUO_ZHI).filter((g) => GUA_ZUO_ZHI[g].zhis.length === 2);
		expect(dual.sort()).toEqual(['乾', '坤', '巽', '艮'].sort());
		dual.forEach((g) => {
			const [a, b] = GUA_ZUO_ZHI[g].zhis;
			expect(ZHI_YANG.includes(a) !== ZHI_YANG.includes(b)).toBe(true);
		});
		expect(ZHI_YANG).toHaveLength(6);
		expect(ZHI_YIN).toHaveLength(6);
		expect(ZHI_YANG.filter((z) => ZHI_YIN.includes(z))).toEqual([]);
	});
	test('与各宫所主月份原文互证(八宫无一相违)', () => {
		Object.keys(GUA_ZUO_ZHI).forEach((gua) => {
			const yueStr = GONG_INFO[GUA_GONG[gua]].yue;
			const nums = GUA_ZUO_ZHI[gua].zhis.map((z) => ZHI_YUE[z].replace('月', ''));
			expect(`${gua}:${nums.some((n) => yueStr.indexOf(n) >= 0)}`).toBe(`${gua}:true`);
		});
		// 书载两月之宫,坐支两月全见:艮「十二月正月」/ 巽「三四月」
		expect(['十二', '正'].every((n) => GONG_INFO[8].yue.indexOf(n) >= 0)).toBe(true);
		expect(['三', '四'].every((n) => GONG_INFO[4].yue.indexOf(n) >= 0)).toBe(true);
	});
	test('日候选:数六=初六/十六/二十六(原文逐字);数一=初一/十一/二十一', () => {
		expect(riCandidates(6).list).toEqual(['初六', '十六', '二十六']);
		expect(riCandidates(1).list).toEqual(['初一', '十一', '二十一']);
		expect(riCandidates(9).byXun).toEqual({ 上: '初九', 中: '十九', 下: '二十九' });
		expect(riCandidates(0)).toBeNull();
		expect(riCandidates(10)).toBeNull();
	});
});

describe('金标⑮ 问事荐宫(载例明载两条 + 各宫所主)', () => {
	test('「问出行看震宫,问来人看艮宫」逐字对应', () => {
		expect(suggestGong('问出行').gong).toBe(3);
		expect(suggestGong('问来人何时到').gong).toBe(8);
	});
	test('余宫按所主取词', () => {
		expect(suggestGong('求财').gong).toBe(4);
		expect(suggestGong('考学能否中').gong).toBe(2);
		expect(suggestGong('失物可寻否').gong).toBe(1);
		expect(suggestGong('功名').gong).toBe(6);
		expect(suggestGong('文书何时到').gong).toBe(9);
		expect(suggestGong('口舌之争').gong).toBe(7);
	});
	test('无命中/空 → null(不强制,用宫仍由用户择)', () => {
		expect(suggestGong('')).toBeNull();
		expect(suggestGong('天气如何')).toBeNull();
		expect(suggestGong(null)).toBeNull();
	});
	test('荐宫表八宫齐备且宫号合法', () => {
		expect(SHI_GONG_SUGGEST).toHaveLength(8);
		expect(SHI_GONG_SUGGEST.map((x) => x.gong).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 6, 7, 8, 9]);
		SHI_GONG_SUGGEST.forEach((x) => {
			expect(DI_PAN[x.gong]).toBeTruthy();
			expect(x.words.length).toBeGreaterThan(0);
		});
	});
});

describe('金标⑯ 佈局单一真值源(BU_JU_SLOTS)', () => {
	test('buildPan 逐宫等于 BU_JU_SLOTS 声明(常量与实现零副本)', () => {
		const qi = qiGuaManual({ up: '乾', lo: '兑', dongYaos: [1, 2, 5] });
		const pan = buildPan(qi);
		const src = { benUp: qi.ben.up, benLo: qi.ben.lo, benShangHu: qi.ben.shangHu, benXiaHu: qi.ben.xiaHu,
			zhiUp: qi.zhi.up, zhiLo: qi.zhi.lo, zhiShangHu: qi.zhi.shangHu, zhiXiaHu: qi.zhi.xiaHu };
		Object.keys(BU_JU_SLOTS).forEach((g) => {
			expect(`${g}:${pan.tianPan[g]}`).toBe(`${g}:${src[BU_JU_SLOTS[g]]}`);
		});
		expect(Object.keys(pan.tianPan).sort()).toEqual(['1', '2', '3', '4', '6', '7', '8', '9']);
	});
});
