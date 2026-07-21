// 小成图 · 金标(golden)—— 古籍与今传本载例逐字对齐。
// 🔴 失败 = 引擎错,不得改测试将就。
import { qiGuaManual, qiGuaByNumbers, qiGuaByStock, qiGuaByDaYan, guaByTianDiShu, guaByXianTian, hexInfo, linesOfHex } from '../core/xiaochengtuQiGua';
import { buildPan, zhengTui, zhengTuiText, pangTui, tuiDao, shuZhan, siXiang, siXiangOfHex, fuDu, zhangDie, sanFen, liangFen, klineYongGong } from '../core/xiaochengtuPan';
import { DI_PAN, GUA_GONG, PANG_GONG, FUDU, SI_XIANG_BASE, SI_XIANG_MATRIX } from '../core/xiaochengtuConst';

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
	test('地天泰 = 闔(吉,向心得配);天地否 = 闢(基调凶,离心)', () => {
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
		expect(pi.ci).toBe('利'); // 细判:阴阳得配为利
	});
	test('矩阵全表:往亨悔 / 來貞吝 / 闔吉凶 / 闢利害', () => {
		expect(SI_XIANG_MATRIX).toEqual({
			往: { 得配: '亨', 失配: '悔' },
			來: { 得配: '貞', 失配: '吝' },
			闔: { 得配: '吉', 失配: '凶' },
			闢: { 得配: '利', 失配: '害' },
		});
		expect(SI_XIANG_BASE).toEqual({ 往: '悔', 來: '吝', 闔: '吉', 闢: '凶' });
		// 失配之闔为凶(如水火既济?否——取坎离:上坎降下离升=闔,坎阳离阴得配…改取纯阴对:上兑降下离升=闔,兑离皆阴,失配为凶)
		const x = siXiang('兑', '离');
		expect(x.type).toBe('闔');
		expect(x.dePei).toBe(false);
		expect(x.ci).toBe('凶');
	});
	test('六爻卦四象:履(上乾升下兑降)= 闢', () => {
		const hex = hexInfo(linesOfHex('乾', '兑'));
		const s = siXiangOfHex(hex);
		expect(s.type).toBe('闢');
		expect(s.dePei).toBe(true); // 乾阳兑阴
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
