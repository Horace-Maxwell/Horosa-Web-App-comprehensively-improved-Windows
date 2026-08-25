// 回归求根器金标(线性星历 mock):收敛精度/迭代非原地/电盘后回退一周期/月亮链。
// 🔴 moment 对 'days' 小数整数截断——本套件锚死「秒级算术」修复,防回退。
jest.mock('../../mundane/momentPipeline', () => ({
	chartAtMoment: jest.fn(async (momentStr) => {
		const m = require('moment');
		const t = m(momentStr, 'YYYY-MM-DD HH:mm:ss');
		const t0 = m('2026-07-24 10:02:04', 'YYYY-MM-DD HH:mm:ss');
		const dDays = t.diff(t0, 'seconds') / 86400;
		const lonOf = (base, rate) => ((base + rate * dDays) % 360 + 360) % 360;
		const mk = (id, lon, speed) => ({ id, lon, sign: 'Leo', signlon: ((lon % 30) + 30) % 30, house: 'House1', movedir: 'Direct', lonspeed: speed, aboveHorizon: true, isVOC: false, selfDignity: [], dignities: {} });
		return {
			chart: { objects: [mk('Sun', lonOf(120, 0.9856), 0.9856), mk('Moon', lonOf(240, 13.1764), 13.1764), mk('Asc', 0, 0)], houses: [], isDiurnal: true },
			params: { date: momentStr.slice(0, 10) },
			aspects: { normalAsp: {} }, receptions: { normal: [], abnormal: [] }, mutuals: { normal: [], abnormal: [] }, surround: {},
		};
	}),
}));
const moment = require('moment');
const { solveReturnBefore } = require('../returnCharts');
const { chartAtMoment } = require('../../mundane/momentPipeline');

const ELEC = '2026-07-24 10:02:04';
const residOf = (r, base, rate, target) => {
	const dd = moment(r.momentStr, 'YYYY-MM-DD HH:mm:ss').diff(moment(ELEC, 'YYYY-MM-DD HH:mm:ss'), 'seconds') / 86400;
	const lon = ((base + rate * dd) % 360 + 360) % 360;
	const x = Math.abs(lon - target);
	return Math.min(x, 360 - x);
};

it('太阳回归:残差<0.01° 且迭代真移动(非原地踏步)', async () => {
	chartAtMoment.mockClear();
	const r = await solveReturnBefore('sun', 49.5, ELEC, { zone: '+08:00' });
	expect(residOf(r, 120, 0.9856, 49.5)).toBeLessThan(0.01);
	const calls = chartAtMoment.mock.calls.map((c) => c[0]);
	expect(new Set(calls.slice(1)).size).toBe(calls.length - 1);   // 迭代时刻各不相同
	expect(moment(r.momentStr, 'YYYY-MM-DD HH:mm:ss').isBefore(moment(ELEC, 'YYYY-MM-DD HH:mm:ss'))).toBe(true);
});

it('月亮回归:快速率链同样收敛且在电盘之前', async () => {
	const r = await solveReturnBefore('moon', 100, ELEC, { zone: '+08:00' });
	expect(residOf(r, 240, 13.1764, 100)).toBeLessThan(0.01);
	expect(moment(r.momentStr, 'YYYY-MM-DD HH:mm:ss').isBefore(moment(ELEC, 'YYYY-MM-DD HH:mm:ss'))).toBe(true);
});

it('边界:natal 恰在电盘黄经稍前(elapsed≈0.2°)→ 不返回未来时刻', async () => {
	const r = await solveReturnBefore('sun', 119.8, ELEC, { zone: '+08:00' });
	expect(moment(r.momentStr, 'YYYY-MM-DD HH:mm:ss').isAfter(moment(ELEC, 'YYYY-MM-DD HH:mm:ss'))).toBe(false);
	expect(residOf(r, 120, 0.9856, 119.8)).toBeLessThan(0.02);
});
