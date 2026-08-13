// 灵棋经数据完备性哨兵:125 卦全覆盖唯一(={0..4}³)/ 1-64 区笛卡尔序全等 / 必备字段非空 /
// 缺注白名单精确锁定(原书实情,多一处少一处都红)/ findLingqiGua 互逆 / T2S 陷阱字铁律。
import { LINGQI_GUA, findLingqiGua, lingqiOrdinalCn } from '../data/lingqiJing';
import { LINGQI_T2S, lingqiToSimp } from '../data/lingqiT2S';
import { LINGQI_RITUAL } from '../data/lingqiRitual';

describe('灵棋经 125 卦数据', () => {
	test('125 卦,(上,中,下) 组合全覆盖唯一 == {0..4}³', () => {
		expect(LINGQI_GUA.length).toBe(125);
		const keys = LINGQI_GUA.map((g) => g.counts.join(','));
		expect(new Set(keys).size).toBe(125);
		for (let u = 0; u <= 4; u++) {
			for (let m = 0; m <= 4; m++) {
				for (let d = 0; d <= 4; d++) {
					expect(keys).toContain(`${u},${m},${d}`);
				}
			}
		}
	});

	test('1-64 区笛卡尔序:id == (u-1)*16+(m-1)*4+d(卦序与棋数互证)', () => {
		LINGQI_GUA.slice(0, 64).forEach((g) => {
			const [u, m, d] = g.counts;
			expect(u).toBeGreaterThanOrEqual(1);
			expect(m).toBeGreaterThanOrEqual(1);
			expect(d).toBeGreaterThanOrEqual(1);
			expect((u - 1) * 16 + (m - 1) * 4 + d).toBe(g.id);
		});
	});

	test('65-124 区每卦至少一层为零;第 125 卦 = 純隂鏝 [0,0,0]', () => {
		LINGQI_GUA.slice(64, 124).forEach((g) => {
			expect(Math.min(...g.counts)).toBe(0);
		});
		const pure = LINGQI_GUA[124];
		expect(pure.id).toBe(125);
		expect(pure.counts).toEqual([0, 0, 0]);
		expect(pure.name).toBe('純隂鏝');
		expect(pure.xiang).toBe('無形');
	});

	test('必备字段全非空:name / xiang / yao(象曰)/ shi(詩曰);正卦皆有属性行', () => {
		LINGQI_GUA.forEach((g) => {
			expect(g.name).toBeTruthy();
			expect(g.xiang).toBeTruthy();
			expect(g.yao.length).toBeGreaterThan(4);
			expect(g.shi.length).toBeGreaterThan(4);
			if (g.id !== 125) { expect(g.attr).toBeTruthy(); }
		});
	});

	test('缺注白名单精确锁定(原书实情;解析漂移即红)', () => {
		const missing = (k) => LINGQI_GUA.filter((g) => !g.zhu[k]).map((g) => g.id);
		expect(missing('yan')).toEqual([40, 120]);      // 違克 / 保身
		expect(missing('he')).toEqual([70]);            // 戒慎
		expect(missing('chen')).toEqual([15, 83]);      // 行令 / 不定
		expect(missing('liu')).toEqual([116]);          // 死象
		const noKe = LINGQI_GUA.filter((g) => !g.ke).map((g) => g.id);
		expect(noKe).toEqual([31, 76, 79, 109, 116, 118]); // 發䝉/必得/戒逢/盗竊/死象/嵗登(总断以「此卦」并入他注)
	});

	test('findLingqiGua 互逆 + 越界防御', () => {
		LINGQI_GUA.forEach((g) => {
			expect(findLingqiGua(g.counts[0], g.counts[1], g.counts[2])).toBe(g);
		});
		expect(findLingqiGua(5, 0, 0)).toBeNull();
		expect(findLingqiGua(-1, 0, 0)).toBeNull();
		expect(findLingqiGua(1.5, 1, 1)).toBeNull();
		expect(findLingqiGua('1', 1, 1)).toBeNull();
	});

	test('卦序中文:第一/第十七/第一百零一/第一百二十四;125=卦外', () => {
		expect(lingqiOrdinalCn(1)).toBe('第一');
		expect(lingqiOrdinalCn(17)).toBe('第十七');
		expect(lingqiOrdinalCn(64)).toBe('第六十四');
		expect(lingqiOrdinalCn(101)).toBe('第一百零一');
		expect(lingqiOrdinalCn(110)).toBe('第一百十');   // 原书序数口径(「第一百十六死象卦」式,百后十不加一)
		expect(lingqiOrdinalCn(124)).toBe('第一百二十四');
		expect(lingqiOrdinalCn(125)).toBe('卦外');
	});

	test('已知卦名/象名抽验(四库本金标)', () => {
		expect(LINGQI_GUA[0].name).toBe('大通');
		expect(LINGQI_GUA[0].xiang).toBe('昇騰');
		expect(LINGQI_GUA[0].attr).toContain('純陽');
		expect(LINGQI_GUA[16].name).toBe('神䕶');      // 17:正文权威(目录作「䕶神」)
		expect(LINGQI_GUA[59].name).toBe('大同');      // 60:四上三中四下通暢之象;象曰「天衢坦坦」,李远序以象辞称之
		expect(LINGQI_GUA[59].note).toContain('前序'); // 原书小注〈此卦有驗在前序〉
		expect(LINGQI_GUA[104].name).toBe('無功');     // 105:正文权威(目录误作「無扐」)
	});
});

describe('灵棋经 T2S 繁简映射', () => {
	test('🔴 陷阱字铁律:「乾」恒不转(全书皆乾卦之乾);「炁」保留', () => {
		expect(LINGQI_T2S['乾']).toBeUndefined();
		expect(LINGQI_T2S['炁']).toBeUndefined();
		expect(lingqiToSimp('乾天西北')).toBe('乾天西北');
	});

	test('刻本异体归一:隂→阴 㓙→凶 䕶→护 嵗→岁 鬬→斗 騐→验', () => {
		expect(lingqiToSimp('隂陽')).toBe('阴阳');
		expect(lingqiToSimp('㓙')).toBe('凶');
		expect(lingqiToSimp('神䕶')).toBe('神护');
		expect(lingqiToSimp('嵗登')).toBe('岁登');
		expect(lingqiToSimp('戰鬬')).toBe('战斗');
		expect(lingqiToSimp('無騐')).toBe('无验');
	});

	test('全数据转简后不残留高频刻本异体(隂/㓙/嵗/逺/髙/觧/徳/懽/黙/乗…)', () => {
		const bad = /[隂㓙嵗逺髙觧騐䕶䝉㑹徳逹懽懐宻隠蠺戸鳯黙乗縁艶増黒恱賔]/;
		LINGQI_GUA.forEach((g) => {
			const all = [g.name, g.xiang, g.attr, g.note, g.yao, g.ke, g.shi, g.shiEx,
				g.zhu.yan, g.zhu.he, g.zhu.chen, g.zhu.liu].join('');
			expect(bad.test(lingqiToSimp(all))).toBe(false);
		});
	});

	test('空值与非串安全', () => {
		expect(lingqiToSimp('')).toBe('');
		expect(lingqiToSimp(null)).toBe('');
		expect(lingqiToSimp(undefined)).toBe('');
	});
});

describe('灵棋经仪轨文本', () => {
	test('三节俱全:造靈棋法 / 占儀五目 / 祭儀(含祭祝文)', () => {
		expect(LINGQI_RITUAL.making.text).toContain('十二枚');
		expect(LINGQI_RITUAL.making.text).toContain('六戊日不宜占卜');
		expect(LINGQI_RITUAL.rite.items.map((i) => i.label)).toEqual(['啟告', '祝文', '咒', '擲法', '送神辭']);
		expect(LINGQI_RITUAL.rite.items[3].text).toContain('不可再擲');
		expect(LINGQI_RITUAL.sacrifice.text).toContain('正月初七');
		expect(LINGQI_RITUAL.sacrifice.zhu).toContain('尚饗');
	});
});
