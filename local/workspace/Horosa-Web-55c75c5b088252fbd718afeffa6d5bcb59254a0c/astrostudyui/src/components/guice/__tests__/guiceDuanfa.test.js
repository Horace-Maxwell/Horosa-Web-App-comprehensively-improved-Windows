// 皇极轨策 · 断法金标。
// 🔴 失败 = 引擎错，不得改测试将就。
import {
	duanfa, tiYongShengKe, guaQi, qingZhongCiXu, zhuKeSuan, siweiShengKe, shuQuanKongQue,
} from '../core/guiceDuanfa';
import { yanShu } from '../core/guiceEngine';

describe('轨策·断法 · 体用生克（五等）', () => {
	test.each([
		['坎', '兑', '用生体', '助力'],      // 兑金生坎水
		['坎', '离', '体克用', '阻力，费力可成'],   // 坎水克离火
		['坎', '坎', '比和', '吉'],
		['震', '离', '体生用', '耗损无成'],   // 震木生离火
		['离', '坎', '用克体', '破败大凶'],   // 坎水克离火 → 用克体
	])('体%s 用%s → %s（%s）', (ti, yong, key, duan) => {
		const r = tiYongShengKe(ti, yong);
		expect(r.key).toBe(key);
		expect(r.duan).toBe(duan);
	});
	test('八卦两两皆有其断（64 组无遗）', () => {
		const G = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'];
		const bad = [];
		G.forEach((t) => G.forEach((y) => { if (!tiYongShengKe(t, y)) bad.push(`${t}/${y}`); }));
		expect(bad).toEqual([]);
	});
	test('坏卦 → null，不抛', () => {
		expect(tiYongShengKe('甲', '坤')).toBeNull();
	});
});

describe('轨策·断法 · 卦气旺衰', () => {
	test('震巽木旺于春；离火旺于夏；乾兑金旺于秋；坎水旺于冬；坤艮旺于四季月', () => {
		expect(guaQi('震', '寅').qi).toBe('旺');
		expect(guaQi('离', '午').qi).toBe('旺');
		expect(guaQi('兑', '酉').qi).toBe('旺');
		expect(guaQi('坎', '子').qi).toBe('旺');
		['辰', '戌', '丑', '未'].forEach((z) => expect(guaQi('坤', z).qi).toBe('旺'));
	});
	test('春坤艮衰；夏乾兑衰；秋震巽衰；冬离衰；四季月坎衰', () => {
		expect(guaQi('坤', '寅').qi).toBe('衰');
		expect(guaQi('乾', '午').qi).toBe('衰');
		expect(guaQi('震', '酉').qi).toBe('衰');
		expect(guaQi('离', '子').qi).toBe('衰');
		expect(guaQi('坎', '辰').qi).toBe('衰');
	});
	test('非旺非衰者为平', () => {
		expect(guaQi('坎', '寅').qi).toBe('平');
	});
	test('十二支皆有其节；坏卦/无月 → null', () => {
		['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'].forEach((z) => expect(guaQi('乾', z)).toBeTruthy());
		expect(guaQi('甲', '子')).toBeNull();
		expect(guaQi('乾', '')).toBeNull();
	});
});

describe('轨策·断法 · 体用四诀之轻重次序（用最紧 > 互次之 > 变又次之）', () => {
	const r = qingZhongCiXu('离', '兑', 6);   // 火泽睽 六爻动 → 用在上(离)、体在下(兑)
	test('三者之轻重：用3 > 互2 > 变1', () => {
		expect(r.rows.map((x) => x.zhong)).toEqual([3, 2, 1]);
		expect(r.rows.map((x) => x.ying)).toEqual(['即应', '中间之应', '终应']);
	});
	test('体卦取自体用之判（六爻动 → 体为下卦兑）', () => {
		expect(r.tiGua).toBe('兑');
	});
	test('变卦克体则未后不吉；变生体或比和则临终吉利', () => {
		expect(['变卦克体 —— 未后不吉', '变生体或比和 —— 临终吉利', '变卦无克无生 —— 终无大碍'])
			.toContain(r.zhongYing);
	});
	test('六十四卦 × 六爻全扫：轻重三行皆出，零漏', () => {
		const G = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'];
		const bad = [];
		G.forEach((u) => G.forEach((l) => { for (let f = 1; f <= 6; f += 1) {
			const x = qingZhongCiXu(u, l, f);
			if (!x || x.rows.length !== 3 || x.rows.some((y) => !y.gua || !y.key)) bad.push(`${u}${l}${f}`);
		} }));
		expect(bad).toEqual([]);
	});
});

describe('轨策·断法 · 主算客算（多算胜、少算负）', () => {
	const r = zhuKeSuan('离', '兑', 6);
	test('主算 = 体卦数之和（本之体·体互·变之体）；客算 = 用卦数之和', () => {
		expect(r.zhu.map((x) => x.label)).toEqual(['本之体', '体互', '变之体']);
		expect(r.ke.map((x) => x.label)).toEqual(['本之用', '用互', '变之用']);
		expect(r.zhuSuan).toBe(r.zhu.reduce((s, x) => s + x.num, 0));
		expect(r.keSuan).toBe(r.ke.reduce((s, x) => s + x.num, 0));
	});
	test('宏观用先天数（乾1 兑2 离3 震4 巽5 坎6 艮7 坤8）', () => {
		expect(r.zhu[0]).toMatchObject({ gua: '兑', num: 2 });
	});
	test('胜负之判', () => {
		expect(['主算胜', '客算胜', '主客相当']).toContain(r.sheng);
		expect(r.ze).toBe('多算胜、少算负');
	});
	test('六十四卦 × 六爻全扫：主客六项皆出数', () => {
		const G = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'];
		const bad = [];
		G.forEach((u) => G.forEach((l) => { for (let f = 1; f <= 6; f += 1) {
			const x = zhuKeSuan(u, l, f);
			if (!x || [...x.zhu, ...x.ke].some((y) => !y.num)) bad.push(`${u}${l}${f}`);
		} }));
		expect(bad).toEqual([]);
	});
});

describe('轨策·断法 · 四位五行生克与数全空缺', () => {
	const y = yanShu('坤', '坤', 1);   // 11825 → 千1 百8 十2 零5
	test('四位两两相较，六组皆出', () => {
		const rows = siweiShengKe(y.siwei);
		expect(rows).toHaveLength(6);
		rows.forEach((x) => expect(['比和', '无涉']).toContain(x.rel.replace(/[千百十零]生[千百十零]|[千百十零]克[千百十零]/, '比和')));
	});
	test('数全空缺：无空则「数全」', () => {
		const k = shuQuanKongQue(y.siwei);
		expect(k.count).toBe(0);
		expect(k.quan).toContain('数全');
	});
	test('有空者：出其位、其借、其象', () => {
		const z = yanShu('乾', '乾', 5);   // 11239 → 无空；取一必有空者
		const withEmpty = [['坤', '坤', 6], ['巽', '兑', 2]].map(([u, l, f]) => yanShu(u, l, f))
			.find((x) => x.siwei.some((s) => s.empty));
		if (withEmpty) {
			const k = shuQuanKongQue(withEmpty.siwei);
			expect(k.count).toBeGreaterThan(0);
			k.items.forEach((i) => { expect(i.wei).toBeTruthy(); expect(i.xiang).toBeTruthy(); });
		}
		expect(z).toBeTruthy();
	});
});

describe('轨策·断法 · 全断', () => {
	test('一盘之断：体用／轻重／卦气／主客／四位／空缺 皆出', () => {
		const y = yanShu('离', '兑', 6);
		const d = duanfa({ up: '离', lo: '兑', dongYao: 6, monthZhi: '午', siwei: y.siwei });
		expect(d.tiYong).toBeTruthy();
		expect(d.qingZhong.rows).toHaveLength(3);
		expect(d.guaQi.ti).toBeTruthy();
		expect(d.zhuKe).toBeTruthy();
		expect(d.siweiShengKe).toHaveLength(6);
		expect(d.kongQue).toBeTruthy();
	});
	test('真生真克之例列以备参（须分真火/形色，不作自动判）', () => {
		const d = duanfa({ up: '离', lo: '兑', dongYao: 6, monthZhi: '午' });
		expect(d.zhenShengZhenKe.length).toBeGreaterThan(0);
		expect(d.zhenZe).toContain('不能克则不顺而已');
	});
	test('动静之则：体互为静、用变为动；起卦须一动一静', () => {
		const d = duanfa({ up: '离', lo: '兑', dongYao: 6, monthZhi: '午' });
		expect(d.dongJing.jing).toContain('体卦');
		expect(d.dongJing.dong).toContain('用卦');
		expect(d.dongJing.chengGua).toContain('一动一静');
		expect(d.dongJing.yingQi).toEqual({ 坐: '应迟', 行: '应速', 立: '半迟半速' });
	});
	test('坏卦 → null，不抛', () => {
		expect(duanfa({ up: '甲', lo: '兑', dongYao: 6 })).toBeNull();
	});
});
