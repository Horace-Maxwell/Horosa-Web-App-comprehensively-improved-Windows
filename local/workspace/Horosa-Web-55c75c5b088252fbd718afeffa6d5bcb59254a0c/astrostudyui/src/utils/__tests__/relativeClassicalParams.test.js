// [Q-254/T-234/T-235] 合盘请求古典段单源:自定义恒星黄道随行历元两参;签名随任一古典口径变化。
jest.mock('../customCalibreStores', () => {
	const real = jest.requireActual('../customCalibreStores');
	return { ...real, userAyanParamsFrom: (getVal) => {
		const t0 = Number(getVal('userAyanT0')); const deg = Number(getVal('userAyanDeg'));
		return (Number.isFinite(t0) && t0 > 0 && Number.isFinite(deg)) ? { userAyanT0: t0, userAyanDeg: deg } : { userAyanT0: 2451545, userAyanDeg: 24 };
	} };
});
import { relativeClassicalParamsFromFields, relativeClassicalSignature } from '../../components/astro/AstroRelative';

const F = (o) => Object.keys(o).reduce((m, k) => { m[k] = { value: o[k], name: [k] }; return m; }, {});

describe('relativeClassicalParamsFromFields', () => {
	test('默认口径不下发任何古典键(请求体零回归)', () => {
		expect(relativeClassicalParamsFromFields(F({ zodiacal: 0, hsys: 0, siderealAyanamsa: '' }))).toEqual({});
		expect(relativeClassicalParamsFromFields(null)).toEqual({});
	});
	test('[T-234] siderealAyanamsa=user → 随行 userAyanT0/Deg(fields 有值优先,缺读当前槽)', () => {
		expect(relativeClassicalParamsFromFields(F({ siderealAyanamsa: 'user', userAyanT0: 2440000, userAyanDeg: 23.5 })))
			.toEqual({ userAyanT0: 2440000, userAyanDeg: 23.5 });
		expect(relativeClassicalParamsFromFields(F({ siderealAyanamsa: 'user' })))
			.toEqual({ userAyanT0: 2451545, userAyanDeg: 24 });
		// 非 user 档绝不带历元
		expect(relativeClassicalParamsFromFields(F({ siderealAyanamsa: 'lahiri', userAyanT0: 2440000, userAyanDeg: 23.5 }))).toEqual({});
	});
	test('非默认古典键条件透传(与主盘同款)', () => {
		const p = relativeClassicalParamsFromFields(F({ termsVariant: 1, triplicity: 'Ptolemaic', lotReversal: 0, sectBuffer: 'ptolemy5', leoBoundFirst: 1 }));
		expect(p).toMatchObject({ termsVariant: 1, triplicity: 'Ptolemaic', lotReversal: 0, sectBuffer: 'ptolemy5', leoBoundFirst: 1 });
		expect(relativeClassicalParamsFromFields(F({ triplicity: 'Dorothean' }))).toEqual({});
	});
	test('[T-235] 签名:古典口径任一项变 → 签名变;无关键变 → 不变', () => {
		const a = F({ zodiacal: 0, hsys: 0 });
		expect(relativeClassicalSignature(a)).toBe(relativeClassicalSignature(F({ zodiacal: 1, hsys: 3, name: 'x' })));
		expect(relativeClassicalSignature(F({ termsVariant: 1 }))).not.toBe(relativeClassicalSignature(a));
		expect(relativeClassicalSignature(F({ cazimiOrb: 1 }))).not.toBe(relativeClassicalSignature(a));
		expect(relativeClassicalSignature(F({ siderealAyanamsa: 'user' }))).not.toBe(relativeClassicalSignature(a));
	});
});
