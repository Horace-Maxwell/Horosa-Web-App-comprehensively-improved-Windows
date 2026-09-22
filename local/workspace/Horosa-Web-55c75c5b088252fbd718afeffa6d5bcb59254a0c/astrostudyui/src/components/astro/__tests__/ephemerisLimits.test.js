// [Q-186/T-108 ①] 星历三道后端上限(区间 732 天 / 逐日 370 天 / 行运触发 600 条)由 params.limits 明示,页面与快照共用同一句。
import { ephemerisLimitsText } from '../AstroEphemeris';

global.React = require('react');

describe('ephemerisLimitsText', () => {
	it('无 limits / 无截断 → 空串;三类截断各出一句并合并', () => {
		expect(ephemerisLimitsText(null)).toBe('');
		expect(ephemerisLimitsText({ limits: { rangeTruncated: false, dailyTruncated: false, transitTruncated: false } })).toBe('');
		const t = ephemerisLimitsText({
			startDate: { date: '2026-01-01' }, endDate: { date: '2028-01-02' },
			limits: { rangeDays: 732, rangeTruncated: true, requestedEndDate: { date: '2028-06-01' }, dailyDays: 370, dailyTruncated: true, transitLimit: 600, transitTotal: 2523, transitTruncated: true },
		});
		expect(t).toContain('区间超过 732 天上限，有效区间 2026-01-01 至 2028-01-02（请求至 2028-06-01）');
		expect(t).toContain('每日位置只列前 370 天');
		expect(t).toContain('行运触发共 2523 条，按时间先后只列前 600 条');
		expect(t).toMatch(/缩小日期范围可查看全部/);
		expect(ephemerisLimitsText({ limits: { transitTruncated: true, transitTotal: 700, transitLimit: 600 } })).toBe('行运触发共 700 条，按时间先后只列前 600 条（缩小日期范围可查看全部）');
	});
});
