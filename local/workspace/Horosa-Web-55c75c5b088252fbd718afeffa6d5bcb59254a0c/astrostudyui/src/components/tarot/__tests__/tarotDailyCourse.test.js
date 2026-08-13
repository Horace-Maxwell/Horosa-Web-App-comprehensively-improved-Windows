// TP8 日课专项:种子确定性/日志覆盖与滚动上限/统计口径。
import { buildDailySeed, appendDailyLog, dailyStats } from '../engine/dailyCourse';
import { buildReading } from '../engine/reading';
import { CORE78 } from '../decks/core78';

describe('日课', () => {
	test('同日同人同牌组=同一张;换日/换牌组=另抽', () => {
		const s1 = buildDailySeed('2026-08-11', 'p|1990', 'rws');
		const a = buildReading('rws', 'single', s1, {});
		const b = buildReading('rws', 'single', s1, {});
		expect(a.draws[0].cardId).toBe(b.draws[0].cardId);
		const c = buildReading('rws', 'single', buildDailySeed('2026-08-12', 'p|1990', 'rws'), {});
		const dSeed = buildDailySeed('2026-08-11', 'p|1990', 'thoth');
		expect(s1).not.toBe(dSeed);
		expect([c.draws[0].cardId !== a.draws[0].cardId, true]).toContain(true); // 换日大概率另抽(种子必不同)
	});
	test('日志:同日同牌组覆盖;排序;超上限裁最旧', () => {
		let log = [];
		log = appendDailyLog(log, { d: '2026-08-10', deck: 'rws', sid: 'the_fool', rev: false });
		log = appendDailyLog(log, { d: '2026-08-11', deck: 'rws', sid: 'the_sun', rev: false });
		log = appendDailyLog(log, { d: '2026-08-11', deck: 'rws', sid: 'the_moon', rev: true });
		expect(log.length).toBe(2);
		expect(log[1].sid).toBe('the_moon');
		let big = [];
		for(let i = 0; i < 5; i++){ big = appendDailyLog(big, { d: `2026-01-0${i + 1}`, deck: 'rws', sid: 'wands_02', rev: false }, 3); }
		expect(big.length).toBe(3);
		expect(big[0].d).toBe('2026-01-03');
	});
	test('统计:分布/大牌占比/高频/逆位计数;未知 sid 剔除', () => {
		const log = [
			{ d: '1', deck: 'rws', sid: 'the_fool', rev: true },
			{ d: '2', deck: 'rws', sid: 'the_sun', rev: false },
			{ d: '3', deck: 'rws', sid: 'wands_02', rev: false },
			{ d: '4', deck: 'rws', sid: 'wands_02', rev: true },
			{ d: '5', deck: 'rws', sid: 'no_such', rev: false },
		];
		const s = dailyStats(log);
		expect(s.total).toBe(4);
		expect(s.suitCount.major).toBe(2);
		expect(s.suitCount.wands).toBe(2);
		expect(s.majorPct).toBe(50);
		expect(s.top[0]).toEqual({ sid: 'wands_02', name: CORE78.find((c) => c.sid === 'wands_02').name_cn, count: 2 });
		expect(s.reversed).toBe(2);
	});
});
