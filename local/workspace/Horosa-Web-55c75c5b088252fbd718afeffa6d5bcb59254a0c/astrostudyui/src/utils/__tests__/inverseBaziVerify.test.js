// [Q-317/T-304] 八字反查候选回代:按全局日界 / 晚子时用本地引擎校验;夜子时候选不等时改试 00:30 归属;不成立标 ✗。
import React from 'react';
global.React = React;
import InverseBazi from '../../components/commtools/InverseBazi';

const inst = Object.create(InverseBazi.prototype);
inst.state = { gender: 1 };
const geo = { zone: '+08:00', lon: '119e19', lat: '26n04' };

describe('InverseBazi.verifyCandidate', () => {
	test('24 点换日 + 次日干:1990-05-18 23:30 = 癸未日甲子时 → ✓', () => {
		const r = inst.verifyCandidate('1990-05-18 23:30', { year: '庚午', month: '辛巳', day: '癸未', time: '甲子' }, geo, { after23NewDay: 0, lateZiHourUseNextDay: 1 });
		expect(r.ok).toBe(true);
		expect(r.adjusted).toBeFalsy();
	});
	test('23 点换日(全局缺省)+ 次日干:癸未日甲子时不成立(23:30 已进位甲申日)→ ✗;癸未日壬子时 → 同日 00:30 ✓', () => {
		const r = inst.verifyCandidate('1990-05-18 23:30', { year: '庚午', month: '辛巳', day: '癸未', time: '甲子' }, geo, { after23NewDay: 1, lateZiHourUseNextDay: 1 });
		expect(r.ok).toBe(false);
		const r2 = inst.verifyCandidate('1990-05-18 23:30', { year: '庚午', month: '辛巳', day: '癸未', time: '壬子' }, geo, { after23NewDay: 1, lateZiHourUseNextDay: 1 });
		expect(r2.ok).toBe(true);
		expect(r2.adjusted).toBe(true);
		expect(r2.text).toBe('1990-05-18 00:30');
	});
	test('白天候选与日界无关:08:30 → ✓', () => {
		const r = inst.verifyCandidate('1990-05-18 08:30', { year: '庚午', month: '辛巳', day: '癸未', time: '丙辰' }, geo, { after23NewDay: 1, lateZiHourUseNextDay: 1 });
		expect(r.ok).toBe(true);
	});
});
