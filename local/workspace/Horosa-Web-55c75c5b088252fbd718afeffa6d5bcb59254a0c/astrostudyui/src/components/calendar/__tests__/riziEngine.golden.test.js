// 日子馆个性化择日 golden：八字抽取 + 合婚 + 冲本命淘汰 + 用神生扶排名。
import { personBazi, hehunPair, buildPersonalizedDates } from '../riziEngine';

// 甲子年(1984,鼠)/庚午(1990,马,冲子)/乙丑(1985,牛,子丑六合)/戊辰(1988,龙,申子辰三合)。
const A = personBazi({ date: '1984-06-01', time: '1984-06-01 10:00:00', gender: 1 });
const B = personBazi({ date: '1990-08-01', time: '1990-08-01 10:00:00', gender: 0 });
const C = personBazi({ date: '1985-06-01', time: '1985-06-01 10:00:00', gender: 0 });
const D = personBazi({ date: '1988-06-01', time: '1988-06-01 10:00:00', gender: 1 });

describe('日子馆 · 八字抽取', () => {
	test('年命生肖 / 用神喜忌就位', () => {
		expect(A.yearZhi).toBe('子');
		expect(A.shengxiao).toBe('鼠');
		expect(B.yearZhi).toBe('午');
		expect(Array.isArray(A.xi)).toBe(true);
		expect(A.nayinYear.length).toBeGreaterThan(0);
	});
});

describe('日子馆 · 合婚 hehunPair', () => {
	test('子午相冲 / 子丑六合 / 子辰三合', () => {
		expect(hehunPair(A, B).chong).toBe(true);
		expect(hehunPair(A, B).jx).toBe('bad');
		expect(hehunPair(A, C).liuhe).toBe(true);
		expect(hehunPair(A, D).sanhe).toBe(true);
		expect(hehunPair(A, D).jx).toBe('good');
	});
});

describe('日子馆 · 个性化择日', () => {
	const res = buildPersonalizedDates({ event: 'marriage', persons: [{ role: 'self', name: '本人', bazi: A }], year: 2026, topN: 20 });

	test('返回吉日且皆宜婚嫁', () => {
		expect(res.list.length).toBeGreaterThan(0);
		res.list.forEach((d)=>{
			const yiReason = d.tongshuReasons.find((x)=> x.text.indexOf('宜') === 0);
			expect(yiReason).toBeTruthy();
		});
	});

	test('冲本命年支（鼠/子）之日被淘汰：结果无一日支为午', () => {
		res.list.forEach((d)=>{ expect(d.ganzhi[1]).not.toBe('午'); });
	});

	test('降序 + 每日含本人评分明细', () => {
		for (let i = 1; i < res.list.length; i++) { expect(res.list[i].score).toBeLessThanOrEqual(res.list[i - 1].score); }
		expect(res.list[0].perPerson[0].role).toBe('self');
	});

	test('多命主取交集：加配偶(冲A本命)后候选变化', () => {
		const two = buildPersonalizedDates({ event: 'marriage', persons: [{ role: 'self', name: 'A', bazi: A }, { role: 'spouse', name: 'B', bazi: B }], year: 2026, topN: 20 });
		// B(午) 本命：冲午之日(子日)亦被淘汰 → 结果无子日、无午日。
		two.list.forEach((d)=>{ expect(d.ganzhi[1]).not.toBe('午'); expect(d.ganzhi[1]).not.toBe('子'); });
	});
});
