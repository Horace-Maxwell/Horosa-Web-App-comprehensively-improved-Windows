import {
	parseYaoName, pureGuaOf, palaceTypeOf, guaShenOf, fushenForGua,
	wangShuaiByMonth, dayRelationOf, isYuePo, isXunKong, changshengOf, isRuMu, voidKindOf, guaChongHe, guaSanHeHui, analyzeGua,
} from '../../gua/LiuYaoEngine';
import { Gua64, getGua64, getXunEmpty } from '../../gua/GuaConst';
import { littleEndian } from '../../../utils/helper';

function byName(n){ return Gua64.find((g) => g.name === n); }

describe('六爻引擎·WP-B 装卦结构', () => {
	test('parseYaoName 拆纳甲', () => {
		expect(parseYaoName('子水子孙')).toEqual({ zhi: '子', wuxing: '水', liuqin: '子孙', shiYing: '' });
		expect(parseYaoName('辰土父母应')).toEqual({ zhi: '辰', wuxing: '土', liuqin: '父母', shiYing: '应' });
	});

	test('本宫首卦 = 八纯卦(value=house.value×2)', () => {
		expect(pureGuaOf(byName('天风姤')).name).toBe('乾为天');
		expect(pureGuaOf(byName('火水未济')).name).toBe('离为火');
		expect(pureGuaOf(byName('泽雷随')).name).toBe('震为雷');
	});

	test('卦序类型/世应:本宫/一世/归魂/游魂', () => {
		expect(palaceTypeOf(byName('乾为天'))).toMatchObject({ type: '本宫', shi: 6, ying: 3 });
		expect(palaceTypeOf(byName('天风姤'))).toMatchObject({ type: '一世', shi: 1, ying: 4 });
		expect(palaceTypeOf(byName('火天大有'))).toMatchObject({ type: '归魂', shi: 3, ying: 6 });
		expect(palaceTypeOf(byName('火地晋'))).toMatchObject({ type: '游魂', shi: 4, ying: 1 });
	});

	test('全 64 卦:palaceTypeOf 世位与 yaoname 内「世」标记完全一致(自洽护栏)', () => {
		let checked = 0;
		Gua64.forEach((g) => {
			const pt = palaceTypeOf(g);
			expect(pt).not.toBeNull();
			const shiIdx = g.yaoname.findIndex((n) => n.indexOf('世') >= 0);
			const yingIdx = g.yaoname.findIndex((n) => n.indexOf('应') >= 0);
			expect(pt.shi).toBe(shiIdx + 1);
			expect(pt.ying).toBe(yingIdx + 1);
			checked++;
		});
		expect(checked).toBe(64);
	});

	test('卦身:火水未济 → 申(不上卦);乾为天 → 巳(不上卦)', () => {
		const wj = guaShenOf(byName('火水未济'));
		expect(wj.body).toBe('申');
		expect(wj.onChart).toBe(false); // 古籍:卦身申不上卦
		const qian = guaShenOf(byName('乾为天'));
		expect(qian.body).toBe('巳');
		expect(qian.onChart).toBe(false);
	});

	test('飞伏:火水未济 缺官鬼 → 第3爻伏亥水官鬼(古籍)', () => {
		const fu = fushenForGua(byName('火水未济'));
		const pos3 = fu[2];
		expect(pos3.liuqin).toBe('官鬼');
		expect(pos3.zhi).toBe('亥');
		expect(pos3.show).toBe(true); // 本卦无官鬼 → 伏神当现
		// 本卦已有的六亲(如兄弟)对应位伏神不现
		const hasShown = fu.filter((f) => f.show).map((f) => f.liuqin);
		expect(hasShown).toContain('官鬼');
	});
});

describe('六爻引擎·WP-C 旺衰 + 日辰', () => {
	test('旺相休囚死(寅月木令)', () => {
		expect(wangShuaiByMonth('木', '寅')).toBe('旺'); // 当令
		expect(wangShuaiByMonth('火', '寅')).toBe('相'); // 令生
		expect(wangShuaiByMonth('水', '寅')).toBe('休'); // 生令
		expect(wangShuaiByMonth('金', '寅')).toBe('囚'); // 克令
		expect(wangShuaiByMonth('土', '寅')).toBe('死'); // 令克
	});
	test('日辰生克冲合刑害破', () => {
		expect(dayRelationOf('子', '午').chong).toBe(true);   // 午日冲子
		expect(dayRelationOf('子', '丑').he).toBe(true);      // 子丑合
		expect(dayRelationOf('木任', '寅')).toBeNull();        // 非法支
		expect(dayRelationOf('卯', '子').sheng).toBe(true);   // 子(水)生卯(木)
		expect(dayRelationOf('土', '土')).toBeNull();          // '土' 非地支
		expect(dayRelationOf('卯', '子').xing).toBe(true);    // 子卯相刑
		expect(dayRelationOf('辰', '辰').xing).toBe(true);    // 辰自刑
		expect(dayRelationOf('未', '子').hai).toBe(true);     // 子未相害
		expect(dayRelationOf('酉', '子').po).toBe(true);      // 子酉相破
	});
});

describe('六爻引擎·WP-D 月破/旬空/长生入墓', () => {
	test('月破:午月冲子', () => {
		expect(isYuePo('子', '午')).toBe(true);
		expect(isYuePo('丑', '午')).toBe(false);
	});
	test('旬空:甲子旬空戌亥', () => {
		const kong = getXunEmpty('甲', '子'); // '戌亥'
		expect(isXunKong('戌', kong)).toBe(true);
		expect(isXunKong('亥', kong)).toBe(true);
		expect(isXunKong('子', kong)).toBe(false);
	});
	test('十二长生(土两说):金长生巳、金墓丑;土水土同宫墓辰、火土同宫墓戌', () => {
		expect(changshengOf('金', '巳', 'water')).toBe('长生');
		expect(changshengOf('金', '丑', 'water')).toBe('墓');
		expect(isRuMu('金', '丑', 'water')).toBe(true);
		expect(isRuMu('土', '辰', 'water')).toBe(true); // 水土同宫:土墓辰
		expect(isRuMu('土', '戌', 'fire')).toBe(true);  // 火土同宫:土墓戌
		expect(changshengOf('金', '巳', 'off')).toBe('');
	});

	test('真空/假空(古籍通例):无气不动不生不临=真空;旺/动/逢生/临日月=假空', () => {
		const ctx = { dayZhi: '子', monthZhi: '午' };
		// 真空:旬空+囚+不动+不被日生+不临日月
		expect(voidKindOf({ xunKong: true, wangShuai: '囚', moving: false, yuePo: false, dayRel: { sheng: false, same: false }, zhi: '戌' }, ctx)).toBe('真空');
		// 假空:旺相=有气
		expect(voidKindOf({ xunKong: true, wangShuai: '旺', moving: false, yuePo: false, dayRel: {}, zhi: '戌' }, ctx)).toBe('假空');
		// 假空:发动
		expect(voidKindOf({ xunKong: true, wangShuai: '囚', moving: true, yuePo: false, dayRel: {}, zhi: '戌' }, ctx)).toBe('假空');
		// 假空:逢日生
		expect(voidKindOf({ xunKong: true, wangShuai: '囚', moving: false, yuePo: false, dayRel: { sheng: true }, zhi: '戌' }, ctx)).toBe('假空');
		// 假空:临日(填实)
		expect(voidKindOf({ xunKong: true, wangShuai: '囚', moving: false, yuePo: false, dayRel: {}, zhi: '子' }, ctx)).toBe('假空');
		// 非旬空 → 空串
		expect(voidKindOf({ xunKong: false, wangShuai: '囚', zhi: '戌' }, ctx)).toBe('');
	});

	test('六冲卦/六合卦(古籍通例):八纯=六冲、地天泰=六合、火水未济=皆非', () => {
		expect(guaChongHe(byName('乾为天'))).toBe('六冲卦');
		expect(guaChongHe(byName('坎为水'))).toBe('六冲卦');
		expect(guaChongHe(byName('天雷无妄'))).toBe('六冲卦'); // 非八纯但六冲
		expect(guaChongHe(byName('雷天大壮'))).toBe('六冲卦');
		expect(guaChongHe(byName('地天泰'))).toBe('六合卦');
		expect(guaChongHe(byName('雷地豫'))).toBe('六合卦');
		expect(guaChongHe(byName('火水未济'))).toBe('');
	});

	test('三合局/三会方(古籍通例):坎为水含申子辰水局+寅午戌火局,初爻寅动→寅午戌成局', () => {
		const all = guaSanHeHui(byName('坎为水'), new Set([1])); // 初爻=寅 动
		const zhis = all.map((x) => x.zhis);
		expect(zhis).toContain('申子辰');
		expect(zhis).toContain('寅午戌');
		const huo = all.find((x) => x.zhis === '寅午戌');
		expect(huo.wuxing).toBe('火');
		expect(huo.hasMoving).toBe(true);   // 寅(初)动 → 成局
		const shui = all.find((x) => x.zhis === '申子辰');
		expect(shui.hasMoving).toBe(false); // 申子辰无动爻
		// 乾为天无动 → 任何局 hasMoving 皆 false
		expect(guaSanHeHui(byName('乾为天'), new Set()).every((x) => !x.hasMoving)).toBe(true);
	});

	test('analyzeGua 注入 moving + voidKind', () => {
		const res = analyzeGua(byName('乾为天'), { monthZhi: '午', dayZhi: '子', kongPair: '戌亥', movingPositions: [1] });
		expect(res.yaos[0].moving).toBe(true);
		expect(res.yaos[1].moving).toBe(false);
		// 戌土父母(第6爻)旬空(甲子旬空戌亥),其 voidKind 应被赋值(真空/假空之一)
		const xu = res.yaos.find((y) => y.zhi === '戌');
		expect(['真空', '假空']).toContain(xu.voidKind);
	});
});

describe('六爻引擎·analyzeGua 汇总(单一真值源)', () => {
	test('火水未济 在 午月子日 完整结构', () => {
		const g = byName('火水未济');
		const kong = getXunEmpty('甲', '子');
		const res = analyzeGua(g, { dayGan: '甲', dayZhi: '子', monthZhi: '午', kongPair: kong, tuMode: 'water' });
		expect(res.palaceType.type).toBe('三世');
		expect(res.guaShen.body).toBe('申');
		expect(res.yaos).toHaveLength(6);
		// 第3爻(午火兄弟世)伏官鬼
		expect(res.yaos[2].shiYing).toBe('世');
		expect(res.yaos[2].fushen).toMatchObject({ liuqin: '官鬼', zhi: '亥' });
		// 每爻都有旺衰
		res.yaos.forEach((y) => { expect(y.wangShuai).toBeTruthy(); });
	});
});
