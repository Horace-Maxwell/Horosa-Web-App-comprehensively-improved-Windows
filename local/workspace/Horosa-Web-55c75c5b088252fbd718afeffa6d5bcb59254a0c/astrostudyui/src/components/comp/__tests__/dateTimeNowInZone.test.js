// [Q-244/TL-11] 「此刻」按盘时区取当前钟面:同一绝对时刻在 +08:00 / -05:00 / +00:00 三个时区的钟面各不相同;非法时区回退系统偏移。
import DateTime from '../DateTime';

describe('DateTime.nowInZone', () => {
	const realNow = Date.now;
	afterEach(() => { Date.now = realNow; });

	test('固定绝对时刻 2026-09-17T12:00:00Z:三个时区的钟面正确', () => {
		Date.now = () => Date.UTC(2026, 8, 17, 12, 0, 0);
		const east8 = DateTime.nowInZone('+08:00');
		const west5 = DateTime.nowInZone('-05:00');
		const utc = DateTime.nowInZone('+00:00');
		expect(east8.format('YYYY-MM-DD HH:mm')).toBe('2026-09-17 20:00');
		expect(west5.format('YYYY-MM-DD HH:mm')).toBe('2026-09-17 07:00');
		expect(utc.format('YYYY-MM-DD HH:mm')).toBe('2026-09-17 12:00');
		expect(east8.zone).toBe('+08:00');
		expect(west5.zone).toBe('-05:00');
	});

	test('跨日:+08:00 已到次日、-05:00 仍在当日', () => {
		Date.now = () => Date.UTC(2026, 8, 17, 18, 30, 0);
		expect(DateTime.nowInZone('+08:00').format('YYYY-MM-DD HH:mm')).toBe('2026-09-18 02:30');
		expect(DateTime.nowInZone('-05:00').format('YYYY-MM-DD HH:mm')).toBe('2026-09-17 13:30');
	});

	test('非法时区 → 不抛,回退系统偏移的钟面', () => {
		Date.now = () => Date.UTC(2026, 8, 17, 12, 0, 0);
		const d = DateTime.nowInZone('bogus');
		expect(d && typeof d.format === 'function').toBe(true);
		expect(/^[+-]\d{2}:\d{2}$/.test(d.zone)).toBe(true);
	});
});
