// 河洛理数 · 古籍实证例 golden（保真锁）。把可复算的古籍实证例固化成可执行护栏——
// 改动碰了值即红。四组：①流月十二卦序(WP-1 校准验收) ②元堂位置图 ③取数确定项 ④常量反测。
import { liuYue, calculate, yuanTang, yuanTangPure, GAN_NUM, ZHI_PAIR } from '../heluoLocal';

describe('河洛 golden · 流月十二卦序（应爻校准 = 古籍实证）', () => {
	// 本卦 上乾下艮 [1,1,1,0,0,1]、元堂上爻(6)。经逐卦机器核验成立的十二卦序。
	const BENGUA = [1, 1, 1, 0, 0, 1];
	const WANT = ['火天大有', '火風鼎', '艮為山', '風山漸', '山地剝', '坤為地', '火地晉', '火雷噬嗑', '天地否', '天水訟', '澤地萃', '澤山咸'];
	test('mode:ying 十二卦逐字等于古籍序', () => {
		const r = liuYue(BENGUA.slice(), 6, { mode: 'ying' });
		expect(r.map((m) => m.gua)).toEqual(WANT);
	});
	test('默认（不传 opts）== ying', () => {
		expect(liuYue(BENGUA.slice(), 6).map((m) => m.gua)).toEqual(WANT);
	});
	test('mode:legacy 仍产现行序列（旧行为逐字未破，两档确不同）', () => {
		const leg = liuYue(BENGUA.slice(), 6, { mode: 'legacy' }).map((m) => m.gua);
		expect(leg[0]).toBe('山風蠱');          // 现行正月＝蠱（非大有）
		expect(leg).not.toEqual(WANT);           // 两档确不同
	});
	test('返回结构不变（month/label/zhi/gua/lines/pos 六键齐）', () => {
		const one = liuYue(BENGUA.slice(), 6, { mode: 'ying' })[0];
		expect(Object.keys(one).sort()).toEqual(['gua', 'label', 'lines', 'month', 'pos', 'zhi']);
		expect(one.lines).toHaveLength(6);
		expect(one.pos).toBeGreaterThanOrEqual(1);
		expect(one.pos).toBeLessThanOrEqual(6);
	});
});

describe('河洛 golden · 元堂位置图（阳爻数 1–5 × 十二时辰·忠实固化）', () => {
	// 每阳爻数取一代表卦（自下而上排阳）；元堂算法已与古籍 7×12 表核验一致，此表固化之。
	const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
	const REPS = {
		1: [1, 0, 0, 0, 0, 0], 2: [1, 1, 0, 0, 0, 0], 3: [1, 1, 1, 0, 0, 0],
		4: [1, 1, 1, 1, 0, 0], 5: [1, 1, 1, 1, 1, 0],
	};
	// 期望元堂爻位（自下 1–6）
	const TABLE = {
		1: [1, 1, 2, 3, 4, 5, 2, 3, 4, 5, 6, 1],
		2: [1, 2, 1, 2, 3, 4, 3, 4, 5, 6, 1, 2],
		3: [1, 2, 3, 1, 2, 3, 4, 5, 6, 4, 5, 6],
		4: [1, 2, 3, 4, 5, 6, 5, 6, 5, 6, 1, 2],
		5: [1, 2, 3, 4, 5, 6, 6, 6, 1, 2, 3, 4],
	};
	Object.keys(REPS).forEach((k) => {
		test(`阳爻数 ${k}：十二时辰元堂落爻一致`, () => {
			const got = ZHI.map((hz) => yuanTang(REPS[k].slice(), hz, true, null));
			expect(got).toEqual(TABLE[k]);
		});
	});
	// 纯乾坤（阳爻数 0/6）另有男女×节气顺逆：乾女命阳令、坤男命阴令 自上而下(反)，余顺。
	test('纯乾坤（阳爻数 0/6）顺逆：乾女阳令/坤男阴令 反排，余顺', () => {
		const gua = (up, yangLing) => ({ up, low: up, yangLing, pureGanKunVariant: 'current' });
		const F = [1, 2, 3, 1, 2, 3, 4, 5, 6, 4, 5, 6];  // 顺（自下而上）
		const R = [6, 5, 4, 6, 5, 4, 3, 2, 1, 3, 2, 1];  // 反（自上而下）
		expect(ZHI.map((hz) => yuanTangPure(gua('乾', true), hz, true))).toEqual(F);   // 乾·阳令·男 顺
		expect(ZHI.map((hz) => yuanTangPure(gua('乾', true), hz, false))).toEqual(R);  // 乾·阳令·女 反
		expect(ZHI.map((hz) => yuanTangPure(gua('坤', false), hz, true))).toEqual(R);  // 坤·阴令·男 反
		expect(ZHI.map((hz) => yuanTangPure(gua('坤', false), hz, false))).toEqual(F); // 坤·阴令·女 顺
	});
});

describe('河洛 golden · 取数确定项（实证四柱 甲辰 戊辰 丁酉 癸卯）', () => {
	test('天数 30 / 地数 40（成对全取）+ 强弱有余', () => {
		const c = calculate({
			fourPillars: { year: '甲辰', month: '戊辰', day: '丁酉', hour: '癸卯' },
			gender: '女', hourZhi: '卯', birthYear: 1964, monthZhi: '辰',
		});
		expect(c.tian).toBe(30);
		expect(c.di).toBe(40);
		expect(c.tian).toBeGreaterThan(25); // 天数有余
		expect(c.di).toBeGreaterThan(30);   // 地数有余
		// 先天卦不断言：五寄中宫头号实证例寄震与三元表冲突、无可复原通用规则（见 heluoLocal wuJiGong 注）。
	});
});

describe('河洛 golden · 常量反测（钉死易混陷阱）', () => {
	test('天干纳甲数：甲=6 / 己=9（非太玄数 甲己九、非河图合化 甲=1）', () => {
		expect(GAN_NUM['甲']).toBe(6);
		expect(GAN_NUM['己']).toBe(9);
		expect(GAN_NUM['壬']).toBe(6); // 壬同甲=6
		expect(GAN_NUM['戊']).toBe(1);
	});
	test('地支成对数：巳午=[7,2]、辰戌丑未=[5,10]、子亥=[1,6]', () => {
		expect(ZHI_PAIR['巳']).toEqual([7, 2]);
		expect(ZHI_PAIR['午']).toEqual([7, 2]);
		expect(ZHI_PAIR['辰']).toEqual([5, 10]);
		expect(ZHI_PAIR['戌']).toEqual([5, 10]);
		expect(ZHI_PAIR['丑']).toEqual([5, 10]);
		expect(ZHI_PAIR['未']).toEqual([5, 10]);
		expect(ZHI_PAIR['子']).toEqual([1, 6]);
	});
});
