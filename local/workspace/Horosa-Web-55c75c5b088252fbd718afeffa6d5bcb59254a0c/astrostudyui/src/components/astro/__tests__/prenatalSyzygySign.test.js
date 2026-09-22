// [Q-185/T-107] 产前朔望摘要卡:日月各按自身黄经取座(望且月在地平上的盘,月亮不是取度体时此前座为「-」、太阳恒取取度体所在座)。
import { signItemOfLon } from '../AstroPrenatalSyzygy';
import { fmtDegree } from '../AstroExtraCommon';

global.React = require('react');

describe('signItemOfLon', () => {
	it('黄经 → 星座 + 座内度;跨 360 归一;非法返 null → fmtDegree 出 -', () => {
		expect(signItemOfLon(0)).toEqual({ sign: 'Aries', signlon: 0 });
		expect(signItemOfLon(196.7).sign).toBe('Libra');
		expect(signItemOfLon(196.7).signlon).toBeCloseTo(16.7, 6);
		expect(signItemOfLon(359.99).sign).toBe('Pisces');
		expect(signItemOfLon(372).sign).toBe('Aries');
		expect(signItemOfLon(-10).sign).toBe('Pisces');
		expect(signItemOfLon(undefined)).toBeNull();
		expect(fmtDegree(signItemOfLon('x'))).toBe('-');
		// 望盘:日 16.7° 天秤 / 月 16.7° 白羊 —— 两行各自取座,不再共用取度体的座
		expect(fmtDegree(signItemOfLon(196.7))).toMatch(/^天秤/);
		expect(fmtDegree(signItemOfLon(16.7))).toMatch(/^牡羊/);
	});
});
