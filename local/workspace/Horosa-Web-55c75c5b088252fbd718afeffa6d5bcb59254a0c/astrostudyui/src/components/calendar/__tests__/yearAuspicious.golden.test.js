// 年度黄道吉日榜 golden：锚 2026 婚嫁类首吉日 + 排序/红线/事项归属属性。
import { buildYearAuspicious, scoreDayForEvent } from '../yearAuspicious';
import { buildHuangliDay } from '../huangliDay';
import { EVENT_KEY_TO_CATEGORY } from '../tongshuData';

describe('年度吉日榜 · 2026', () => {
	const r = buildYearAuspicious(2026, { events: ['marriage', 'move'], topN: 12 });

	test('婚嫁首吉日锚点 = 2026-05-15 己丑 成日 黄道 分9', () => {
		const top = r.marriage.list[0];
		expect(top.ymd).toBe('2026-05-15');
		expect(top.ganzhi).toBe('己丑');
		expect(top.jianchu).toBe('成');
		expect(top.huangdao).toBe('黄道');
		expect(top.score).toBe(9);
	});

	test('每类按分降序（Top 列表单调不增）', () => {
		['marriage', 'move'].forEach((k)=>{
			const scores = r[k].list.map((x)=> x.score);
			for (let i = 1; i < scores.length; i++) { expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]); }
		});
	});

	test('婚嫁榜每日皆命中婚嫁宜（存在宜 reason）', () => {
		r.marriage.list.forEach((d)=>{
			const yiReason = d.reasons.find((x)=> x.text.indexOf('宜') === 0);
			expect(yiReason).toBeTruthy();
			expect(/嫁娶|纳采|结婚姻|订盟|安床/.test(yiReason.text)).toBe(true);
		});
	});

	test('榜内无破日大凶入选（成/定/开/危/执 或至少非破）', () => {
		r.marriage.list.forEach((d)=>{ expect(d.jianchu).not.toBe('破'); });
	});
});

describe('scoreDayForEvent · 边界', () => {
	test('非该事项宜日 → null（不入榜）', () => {
		// 2026-07-13 戊子日：宜=解除/祭祀/理发/入殓/安葬/破土，无婚嫁宜 → marriage 应 null。
		const day = buildHuangliDay(2026, 7, 13);
		expect(scoreDayForEvent(day, EVENT_KEY_TO_CATEGORY.marriage)).toBeNull();
	});

	test('默认事项集不含丧葬（sensitive）', () => {
		const all = buildYearAuspicious(2026, { topN: 3 });
		expect(all.burial).toBeUndefined();
		expect(all.marriage).toBeTruthy();
	});
});
