// 合盘请求古典段单源:自定义恒星黄道随行历元两参;签名随任一古典口径变化。
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
	test('siderealAyanamsa=user → 随行 userAyanT0/Deg(fields 有值优先,缺读当前槽)', () => {
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
	test('签名:古典口径任一项变 → 签名变;无关键变 → 不变', () => {
		const a = F({ zodiacal: 0, hsys: 0 });
		expect(relativeClassicalSignature(a)).toBe(relativeClassicalSignature(F({ zodiacal: 1, hsys: 3, name: 'x' })));
		expect(relativeClassicalSignature(F({ termsVariant: 1 }))).not.toBe(relativeClassicalSignature(a));
		expect(relativeClassicalSignature(F({ cazimiOrb: 1 }))).not.toBe(relativeClassicalSignature(a));
		expect(relativeClassicalSignature(F({ siderealAyanamsa: 'user' }))).not.toBe(relativeClassicalSignature(a));
	});
});

// 合盘左栏流派预设:同一套 changeSchoolPreset 产出的整组口径,经合盘 onChange 必须六项都进合盘请求、立即重排,
// 且合盘左栏下拉反查回原档(此前只认黄道 / 宫制 / 岁差 → 界系等只进全局,下拉随即显示「自定」)。
describe('合盘左栏流派预设(AstroChartMain.changeSchoolPreset → AstroRelative.handleRelativeOnChange)', () => {
	const AstroRelative = require('../../components/astro/AstroRelative').default;
	const AstroChartMain = require('../../components/astro/AstroChartMain').default;
	const { SCHOOL_PRESETS } = require('../../components/astro/schoolPresets');
	const { __resetOptionDispatchScheduler } = require('../optionDispatchScheduler');
	const base = () => F({ zodiacal: 0, hsys: 1, siderealAyanamsa: '', date: '1990-01-01', time: '10:00:00', lat: '39n54', lon: '116e23' });
	beforeEach(() => { __resetOptionDispatchScheduler(); });

	function runPreset(presetKey, fields){
		const actions = [];
		const rel = { props: { fields, dispatch: (a) => actions.push(a) } };
		const main = {
			props: { fields, dispatch: () => {}, onChange: (v) => AstroRelative.prototype.handleRelativeOnChange.call(rel, v) },
			tmHook: {}, noteSeeds: () => {},
			currentSchoolPreset: () => 'brennan',
		};
		AstroChartMain.prototype.changeSchoolPreset.call(main, presetKey);
		const saved = actions.filter((a) => a.type === 'astro/saveUserFields').map((a) => a.payload.fields);
		return { actions, saved: saved[saved.length - 1] };
	}
	const reverse = (fields, tripSystem) => AstroChartMain.prototype.currentSchoolPreset.call({ props: { fields, tripSystem } });

	Object.keys(SCHOOL_PRESETS).filter((k) => k !== 'brennan').forEach((k) => {
		test(`${k}:六项写进合盘 fields、请求体随之变、重排签名变、下拉反查回 ${k}`, () => {
			const before = base();
			const { saved, actions } = runPreset(k, before);
			const p = SCHOOL_PRESETS[k];
			expect(saved.hsys.value).toBe(p.hsys);
			expect(Number(saved.termsVariant.value)).toBe(Number(p.termsVariant));
			expect(saved.triplicity.value).toBe(p.tripSystem);
			expect(Number(saved.lotReversal.value)).toBe(Number(p.lotReversal));
			expect(saved.sectBuffer.value).toBe(p.sectBuffer);
			const params = relativeClassicalParamsFromFields(saved);
			if(Number(p.termsVariant)){ expect(params.termsVariant).toBe(p.termsVariant); }
			if(p.tripSystem !== 'Dorothean'){ expect(params.triplicity).toBe(p.tripSystem); }
			if(Number(p.lotReversal) === 0){ expect(params.lotReversal).toBe(0); }
			if(p.sectBuffer !== 'geo'){ expect(params.sectBuffer).toBe(p.sectBuffer); }
			expect(reverse(saved, p.tripSystem)).toBe(k);
			// 本命盘同批重取(经选项调度器),payload 带齐预设的每一项
			const fetch = actions.find((a) => a.type === 'astro/fetchByFields');
			expect(fetch).toBeTruthy();
			expect(fetch.payload.termsVariant.value).toBe(p.termsVariant);
			expect(fetch.payload.triplicity.value).toBe(p.tripSystem);
		});
	});
	test('古典口径与默认不同的档 → 合盘重排签名变(componentDidUpdate 据此 doChart)', () => {
		const before = base();
		const { saved } = runPreset('ptolemy', before);
		expect(relativeClassicalSignature(saved)).not.toBe(relativeClassicalSignature(before));
	});
	test('切回默认档:相位口径据实清空、点公式回 0,反查回 brennan', () => {
		const { saved: pt } = runPreset('ptolemy', base());
		const { saved } = runPreset('brennan', pt);
		expect(saved.orbs.value).toBeUndefined();
		expect(Number(saved.lotsDocReverse.value)).toBe(0);
		expect(reverse(saved, 'Dorothean')).toBe('brennan');
	});
});
