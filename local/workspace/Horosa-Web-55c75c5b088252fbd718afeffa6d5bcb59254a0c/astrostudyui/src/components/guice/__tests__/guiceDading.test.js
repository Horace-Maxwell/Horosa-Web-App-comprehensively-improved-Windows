// 皇极轨策 · 大定起数金标。
// 🔴 失败 = 引擎错，不得改测试将就。
import { calcDading, guaCeShu, jiaziDingShu, yinYangJiaCe, keSuiShu } from '../core/guiceDading';
import { DADING_GUA_CE } from '../core/guiceConst';
import { LIUSHIJIAZI_DINGSHU } from '../core/guiceJiaziShu';

// 古籍唯一完整之占例：丙申年 丙申月 癸亥日 己未时，本卦地天泰
const P = ['丙申', '丙申', '癸亥', '己未'];

describe('轨策·大定 · 交接锚点：294 + 729 + 720 − 3 = 1740 → 艮巽离巽', () => {
	const r = calcDading({ pillars: P, up: '坤', lo: '乾' });   // 地天泰 = 上坤下乾

	test('① 卦策数 = 294（坤168 + 乾126；单卦之策由 120+先天数×6 派生）', () => {
		expect(r.guaCe.value).toBe(294);
		expect([r.guaCe.upCe, r.guaCe.loCe]).toEqual([168, 126]);
	});
	test('② 六十甲子天地立成定数 = 729（丙申131×2 + 癸亥296 + 己未171）', () => {
		expect(r.dingShu.value).toBe(729);
		expect(r.dingShu.items.map((x) => x.num)).toEqual([131, 131, 296, 171]);
	});
	test('③ 四柱阴阳加策 = +720（申申少阳、亥未老阴 → 老2 少2 相等 → 从阳）', () => {
		expect(r.yinYang.value).toBe(720);
		expect([r.yinYang.lao, r.yinYang.shao, r.yinYang.sheng]).toEqual([2, 2, '相等']);
		expect(r.yinYang.note).toContain('从阳');
	});
	test('④ 克岁数 = −3（年干丙 → 丙丁除坎三）', () => {
		expect(r.keSui.value).toBe(3);
		expect(r.keSui.gua).toEqual(['坎']);
	});
	test('⑤ 合 = 1740', () => {
		expect(r.value).toBe(1740);
	});
	test('⑥ 九畴配卦 = 艮巽离巽（千1艮／百7借巽／十4离／零空借百7→巽）', () => {
		expect(r.siwei.map((x) => x.gua)).toEqual(['艮', '巽', '离', '巽']);
		expect(r.siwei[1].guaBorrow).toBe('7借巽');      // 九畴借宫（七借巽）
		expect(r.siwei[3].empty).toBe(true);
		expect(r.siwei[3].borrowed).toBe('无零借百');     // 隔位相借（与九畴借宫分键，不相盖）
		expect(r.siwei[3].guaBorrow).toBe('7借巽');      // 借来之 7 仍走九畴借宫
	});
	test('起数之链六步皆可见（不跳步）', () => {
		expect(r.steps).toHaveLength(6);
		expect(r.steps.map((s) => s.label)).toEqual(['卦策数', '六十甲子天地立成定数', '四柱阴阳加策', '却将克岁数除之', '合', '九畴配卦']);
	});
});

describe('轨策·大定 · 卦策数由规则派生（非硬编印本之数）', () => {
	test('八卦之策皆合 120 + 先天数×6', () => {
		expect(DADING_GUA_CE).toEqual({ 乾: 126, 兑: 132, 离: 138, 震: 144, 巽: 150, 坎: 156, 艮: 162, 坤: 168 });
	});
	test('🔴 坎之策 = 156（印本作 150 —— 其书自述规则为 120+先天数×6，余七卦皆合而独坎不合 → 以规则为准）', () => {
		expect(DADING_GUA_CE['坎']).toBe(156);
		expect(DADING_GUA_CE['坎']).not.toBe(150);
	});
	test('六十四卦之卦策数皆为偶数且落 246..336', () => {
		const vs = [];
		Object.keys(DADING_GUA_CE).forEach((u) => Object.keys(DADING_GUA_CE).forEach((l) => vs.push(guaCeShu(u, l).value)));
		expect(vs).toHaveLength(64);
		expect(vs.every((v) => v % 2 === 0 && v >= 246 && v <= 336)).toBe(true);
	});
});

describe('轨策·大定 · 六十甲子定数两本（并存不自裁）', () => {
	test('两本各 60 目', () => {
		expect(Object.keys(LIUSHIJIAZI_DINGSHU.xinyifawei.table)).toHaveLength(60);
		expect(Object.keys(LIUSHIJIAZI_DINGSHU.dading.table)).toHaveLength(60);
	});
	test('🔴 据算例定本：心易发微本得 729（合书中演算）；别本得 679（对不上）', () => {
		expect(jiaziDingShu(P, 'xinyifawei').value).toBe(729);
		expect(jiaziDingShu(P, 'dading').value).toBe(679);
	});
	test('缺省即心易发微本（默认即现状）', () => {
		expect(jiaziDingShu(P).value).toBe(jiaziDingShu(P, 'xinyifawei').value);
	});
	test('切本 → 所得之数随之改（此选项真生效）', () => {
		const a = calcDading({ pillars: P, up: '坤', lo: '乾', dadingTable: 'xinyifawei' });
		const b = calcDading({ pillars: P, up: '坤', lo: '乾', dadingTable: 'dading' });
		expect(a.value).not.toBe(b.value);
		expect(b.value).toBe(294 + 679 + 720 - 3);
	});
	test('别本之特征：甲与壬同值、乙与癸同值（原表如是，非录入之误）', () => {
		const t = LIUSHIJIAZI_DINGSHU.dading.table;
		['子', '寅', '辰', '午', '申', '戌'].forEach((z) => expect(t[`甲${z}`]).toBe(t[`壬${z}`]));
		['丑', '卯', '巳', '未', '酉', '亥'].forEach((z) => expect(t[`乙${z}`]).toBe(t[`癸${z}`]));
	});
});

describe('轨策·大定 · 阴阳策之三臂', () => {
	test('老胜 → +720', () => {
		expect(yinYangJiaCe(['甲子', '甲寅', '乙未', '乙酉']).value).toBe(720);   // 子寅老阳、未酉老阴 → 老4
	});
	test('少胜 → +360', () => {
		const r = yinYangJiaCe(['甲午', '甲申', '乙丑', '乙卯']);   // 午申少阳、丑卯少阴 → 少4
		expect([r.sheng, r.value]).toEqual(['少胜', 360]);
	});
	test('相等 → 从阳 +720（非取中，亦非取少）', () => {
		const r = yinYangJiaCe(['甲子', '甲寅', '甲午', '甲申']);   // 老2 少2
		expect([r.sheng, r.value]).toEqual(['相等', 720]);
	});
	test('十二支皆有其属（老阳子寅辰／老阴未酉亥／少阳午申戌／少阴丑卯巳）', () => {
		const all = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
		all.forEach((z) => expect(yinYangJiaCe([`甲${z}`, `甲${z}`, `甲${z}`, `甲${z}`])).toBeTruthy());
	});
});

describe('轨策·大定 · 克岁数（取年干）', () => {
	test.each([['甲', 11], ['乙', 11], ['丙', 3], ['丁', 3], ['戊', 11], ['己', 11], ['庚', 4], ['辛', 4], ['壬', 9], ['癸', 9]])(
		'年干 %s → 除 %s', (g, n) => { expect(keSuiShu(g).value).toBe(n); });
	test('取年干而非日干（克「岁」之数）—— 本例年干丙除3，若误取日干癸则除9', () => {
		expect(calcDading({ pillars: P, up: '坤', lo: '乾' }).keSui.value).toBe(3);
		expect(keSuiShu('癸').value).toBe(9);
	});
});

describe('轨策·大定 · 边界与坏值', () => {
	test('柱不全/坏干支/坏卦 → null，不抛', () => {
		expect(calcDading({ pillars: [], up: '坤', lo: '乾' })).toBeNull();
		expect(calcDading({ pillars: ['XX', 'XX', 'XX', 'XX'], up: '坤', lo: '乾' })).toBeNull();
		expect(calcDading({ pillars: P, up: '甲', lo: '乾' })).toBeNull();
		expect(guaCeShu('甲', '乾')).toBeNull();
		expect(jiaziDingShu(['甲子'])).toBeNull();
		expect(keSuiShu('X')).toBeNull();
	});
	test('六十甲子全域 × 地天泰：皆出数且九畴配卦满四位', () => {
		const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
		const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
		const GZ60 = Array.from({ length: 60 }, (_, n) => GAN[n % 10] + ZHI[n % 12]);
		const bad = [];
		GZ60.forEach((gz) => {
			const r = calcDading({ pillars: [gz, gz, gz, gz], up: '坤', lo: '乾' });
			if (!r) return bad.push(`${gz}: 无果`);
			if (r.siwei.length !== 4 || r.siwei.some((x) => !x.gua)) bad.push(`${gz}: 配卦缺位 ${r.siwei.map((x) => x.gua)}`);
			if (!Number.isInteger(r.value)) bad.push(`${gz}: 非整数 ${r.value}`);
		});
		expect(bad).toEqual([]);
	});
});
