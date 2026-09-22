import { buildTriplicityPeriods, buildTriplicityRulersSnapshotText } from '../triplicityRulers';
import * as AstroConst from '../../constants/AstroConst';

function signLon(s){ return AstroConst.LIST_SIGNS.indexOf(s) * 30 + 5; }

function chart({ diurnal, sunSign, moonSign }){
	return {
		chart: {
			isDiurnal: diurnal,
			objects: [
				{ id: 'Sun', sign: sunSign, lon: signLon(sunSign), signlon: 5, house: 'House10', movedir: 'Direct' },
				{ id: 'Moon', sign: moonSign, lon: signLon(moonSign), signlon: 5, house: 'House4', movedir: 'Direct' },
			],
		},
		params: { birth: '1990-01-01 12:00:00' },
	};
}

describe('triplicityRulers', ()=>{
	it('昼盘取区间光体太阳所在座的第一三分主星(白羊→日)', ()=>{
		const r = buildTriplicityPeriods(chart({ diurnal: true, sunSign: 'Aries', moonSign: 'Cancer' }), { division: 'thirds' });
		expect(r.sectLight).toBe(AstroConst.SUN);
		expect(r.periods[0].ruler).toBe(AstroConst.SUN); // Trip[Aries][0]
		expect(r.periods[2].ruler).toBe(AstroConst.SATURN); // 协作 Trip[2]
	});

	it('夜盘看月亮所在座并昼夜换序(白羊夜→主三分主星=木)', ()=>{
		const r = buildTriplicityPeriods(chart({ diurnal: false, sunSign: 'Leo', moonSign: 'Aries' }), { division: 'thirds' });
		expect(r.sectLight).toBe(AstroConst.MOON);
		expect(r.periods[0].ruler).toBe(AstroConst.JUPITER); // Trip[Aries][1]
	});

	it('三分边界 0–25 / 25–50 / 50–75', ()=>{
		const r = buildTriplicityPeriods(chart({ diurnal: true, sunSign: 'Aries', moonSign: 'Cancer' }), { division: 'thirds', lifespan: 75 });
		expect(r.periods[0].fromAge).toBe(0);
		expect(Math.round(r.periods[1].fromAge)).toBe(25);
		expect(Math.round(r.periods[2].fromAge)).toBe(50);
	});

	it('快照含 [三分主星推运] 段头;空盘返回空串', ()=>{
		const txt = buildTriplicityRulersSnapshotText(chart({ diurnal: true, sunSign: 'Aries', moonSign: 'Cancer' }));
		expect(txt).toContain('[三分主星推运]');
		expect(buildTriplicityRulersSnapshotText(null)).toBe('');
	});

	it('零回归:不传 system 与显式 Dorothean 结果完全一致(各盘)', ()=>{
		const cases = [
			{ diurnal: true, sunSign: 'Aries', moonSign: 'Cancer' },
			{ diurnal: false, sunSign: 'Leo', moonSign: 'Gemini' },
			{ diurnal: true, sunSign: 'Capricorn', moonSign: 'Scorpio' },
		];
		cases.forEach((c)=>{
			const a = buildTriplicityPeriods(chart(c), { division: 'thirds' });
			const b = buildTriplicityPeriods(chart(c), { division: 'thirds', system: 'Dorothean' });
			expect(a.periods.map((p)=>p.ruler)).toEqual(b.periods.map((p)=>p.ruler));
			expect(a.periods.length).toBe(3);
		});
	});

	it('[Q-187/T-111] 不传 system 时随本盘 params.triplicity(挂载 record.system 缺席=页面初值同序);非法值仍回多罗特', ()=>{
		const c = chart({ diurnal: true, sunSign: 'Aries', moonSign: 'Cancer' });
		c.params.triplicity = 'Ptolemaic';
		const auto = buildTriplicityPeriods(c, { division: 'thirds' });
		const explicit = buildTriplicityPeriods(c, { division: 'thirds', system: 'Ptolemaic' });
		expect(auto.system).toBe('Ptolemaic');
		expect(auto.periods.map((p)=>p.ruler)).toEqual(explicit.periods.map((p)=>p.ruler));
		const dor = buildTriplicityPeriods(c, { division: 'thirds', system: 'Dorothean' });
		expect(auto.periods.map((p)=>p.ruler)).not.toEqual(dor.periods.map((p)=>p.ruler));   // 白羊昼:托勒密两段 vs 多罗特三段
		c.params.triplicity = 'Bogus';
		expect(buildTriplicityPeriods(c, { division: 'thirds' }).system).toBe('Dorothean');
	});

	it('托勒密二主:火/土/风象取昼夜两主、无协作主星(白羊昼→日,夜→木两段)', ()=>{
		const r = buildTriplicityPeriods(chart({ diurnal: true, sunSign: 'Aries', moonSign: 'Cancer' }), { system: 'Ptolemaic' });
		expect(r.system).toBe('Ptolemaic');
		expect(r.periods.length).toBe(2);
		expect(r.periods[0].ruler).toBe(AstroConst.SUN);  // 火象昼主
		expect(r.periods[1].ruler).toBe(AstroConst.JUPITER); // 火象夜主
	});

	it('托勒密水象(标准):昼夜同主火星,退化为单段贯穿', ()=>{
		const r = buildTriplicityPeriods(chart({ diurnal: true, sunSign: 'Cancer', moonSign: 'Aries' }), { system: 'Ptolemaic' });
		expect(r.periods.length).toBe(1);
		expect(r.periods[0].ruler).toBe(AstroConst.MARS);
	});

	it('托勒密水象变体·昼盘:水象取昼序两主[火,金]', ()=>{
		const w = buildTriplicityPeriods(chart({ diurnal: true, sunSign: 'Cancer', moonSign: 'Aries' }), { system: 'PtolemaicWaterVariant' });
		expect(w.periods.length).toBe(2);
		expect(w.periods[0].ruler).toBe(AstroConst.MARS);  // 昼主火
		expect(w.periods[1].ruler).toBe(AstroConst.VENUS); // 昼次金
		// 非水象座(火象白羊)变体仍等同托勒密二主。
		const f = buildTriplicityPeriods(chart({ diurnal: true, sunSign: 'Aries', moonSign: 'Cancer' }), { system: 'PtolemaicWaterVariant' });
		expect(f.periods.map((p)=>p.ruler)).toEqual([AstroConst.SUN, AstroConst.JUPITER]);
	});

	it('托勒密水象变体·夜盘:水象按夜序取另一套两主[火,月](区分昼夜)', ()=>{
		// 夜盘区间光体=月，落水象天蝎 → 夜序 [火, 月]。
		const w = buildTriplicityPeriods(chart({ diurnal: false, sunSign: 'Aries', moonSign: 'Scorpio' }), { system: 'PtolemaicWaterVariant' });
		expect(w.periods.length).toBe(2);
		expect(w.periods[0].ruler).toBe(AstroConst.MARS); // 夜主火
		expect(w.periods[1].ruler).toBe(AstroConst.MOON); // 夜次月(≠昼盘的金)
	});

	it('非法 system 回退多罗特(零回归保护)', ()=>{
		const a = buildTriplicityPeriods(chart({ diurnal: true, sunSign: 'Aries', moonSign: 'Cancer' }), { system: 'NoSuch' });
		const b = buildTriplicityPeriods(chart({ diurnal: true, sunSign: 'Aries', moonSign: 'Cancer' }), {});
		expect(a.periods.map((p)=>p.ruler)).toEqual(b.periods.map((p)=>p.ruler));
		expect(a.periods.length).toBe(3);
	});
});
