// [Q-296/T-280/T-281] 卜卦 · 流派三分制随档下发 + Dorotheus 共主计分 + 燃烧豁免真执行。
import { runHorary } from '../horaryEngine';
import { horaryBackendFields, horaryTriplicityOf, HORARY_SCHOOL_ORDER, HORARY_SCHOOLS } from '../horarySchools';
import { almutenAt } from '../../engine/almuten';
import { completionThirds } from '../../engine/perfection';
import { buildMockResult } from '../../election/__tests__/electionFixture';

global.React = require('react');

describe('T-280 ② 三分集随流派下发 /chart', () => {
	it('horaryTriplicityOf 映射 + 七档 backend 字段皆带 triplicity 且与 tripSystem 一致', () => {
		expect(horaryTriplicityOf('dorothean')).toBe('Dorothean');
		expect(horaryTriplicityOf('ptolemaic')).toBe('Ptolemaic');
		expect(horaryTriplicityOf(undefined)).toBe('Ptolemaic');
		HORARY_SCHOOL_ORDER.forEach((id) => {
			const bf = horaryBackendFields(id);
			expect(bf.triplicity).toBe(HORARY_SCHOOLS[id].backend.tripSystem === 'dorothean' ? 'Dorothean' : 'Ptolemaic');
			expect(bf.tripSystem).toBeUndefined();
		});
	});
	it('overrides.tripSystem 覆盖映射(挂载齿轮 / 存档 overrides 同源)', () => {
		expect(horaryBackendFields('classical', { tripSystem: 'dorothean' }).triplicity).toBe('Dorothean');
		expect(horaryBackendFields('hellenistic', { tripSystem: 'ptolemaic' }).triplicity).toBe('Ptolemaic');
	});
});

describe('T-280 ① Dorotheus 三主档 almuten 计共主', () => {
	it('runHorary dorothean 档:宫头 almuten 明细含 triplicity_part;ptolemaic 档无', () => {
		// 水象巨蟹 7°(mock 4 宫头附近取月亮所在):Dorotheus 水象 昼金/夜火/共主月
		const dor = almutenAt(97, { isDiurnal: true, tripSystem: 'dorothean', tripIncludeParticipating: true });
		expect(dor.breakdown.some((b) => b.layer === 'triplicity_part' && b.planet === 'moon')).toBe(true);
		const jd = runHorary(buildMockResult(), 'general', { tripSystem: 'dorothean' });
		const jp = runHorary(buildMockResult(), 'general', { tripSystem: 'ptolemaic' });
		const hasPart = (am) => !!(am && am.breakdown && am.breakdown.some((b) => b.layer === 'triplicity_part'));
		expect(hasPart(jd.almuten.asc)).toBe(true);     // 白羊上升:多罗修斯火象共主土星
		expect(hasPart(jp.almuten.asc)).toBe(false);
	});
});

describe('T-281 燃烧豁免真执行(开/关裁决证词可分辨)', () => {
	// 子嗣问(5 宫狮子=太阳为事项主);问者火星燃烧且入相位合日 → 「合日即所求」。
	function withMarsCombustToSun(){
		const r = buildMockResult();
		const mars = r.chart.objects.find((o) => o.id === 'Mars');
		mars.lon = 350.0; mars.sign = 'Pisces'; mars.signlon = 20.0; mars.house = 'House12'; mars.selfDignity = []; mars.aboveHorizon = true;
		r.houseMap.House4.planets = ['Moon', 'Pars Fortuna'];
		r.houseMap.House12.planets = ['Sun', 'Mercury', 'Saturn', 'Neptune', 'North Node', 'Mars'];
		r.aspects.normalAsp.Mars = { Applicative: [{ id: 'Sun', asp: 0, orb: 4.9 }], Separative: [], Exact: [], None: [], Obvious: [] };
		return r;
	}
	it('关:火星燃烧证词为负、完成度三分判不安全;开:证词转中性、三分免燃、negScore 变小', () => {
		const off = runHorary(withMarsCombustToSun(), 'pregnancy', { combustExemptConjAnswer: false });
		expect(off.significators.querentKey).toBe('mars');
		expect(off.significators.quesitedKey).toBe('sun');
		expect(off.perfection.perfects).toBe(true);
		expect(off.perfection.method).toBe('application');
		expect(off.perfection.combustExempt).toBeUndefined();
		const offCombust = off.conditions.mars.findings.find((f) => f.key === 'combust');
		expect(offCombust && offCombust.polarity).toBe('negative');
		expect(off.thirds.unsafe).toContain('mars');

		const on = runHorary(withMarsCombustToSun(), 'pregnancy', { combustExemptConjAnswer: true });
		expect(on.perfection.combustExempt).toEqual(['mars']);
		const onCombust = on.conditions.mars.findings.find((f) => f.key === 'combust');
		expect(onCombust && onCombust.polarity).toBe('neutral');
		expect(onCombust.text_zh).toContain('豁免');
		expect(on.thirds.safe).toContain('mars');
		expect(on.conditions.mars.score).toBe(off.conditions.mars.score + 3);
		expect(on.verdict.negScore).toBeLessThan(off.verdict.negScore);
	});
	it('completionThirds exemptCombust 只免指定键;缺省路径不变', () => {
		const facts = { planets: { mars: { retro: false, combustion: 'combust', dignityScore: 0 }, moon: { retro: false, combustion: null, dignityScore: 0 } } };
		expect(completionThirds(facts, ['mars', 'moon']).unsafe).toEqual(['mars']);
		expect(completionThirds(facts, ['mars', 'moon'], { exemptCombust: ['mars'] }).unsafe).toEqual([]);
		expect(completionThirds(facts, ['mars', 'moon'], { exemptCombust: ['moon'] }).unsafe).toEqual(['mars']);
	});
});
