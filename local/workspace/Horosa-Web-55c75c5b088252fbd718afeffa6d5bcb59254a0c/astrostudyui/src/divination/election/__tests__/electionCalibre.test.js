// R2 流派真差异化断言：切流派/改口径 → 界主·三分·容许度·空亡·moduleSet·sectWeight 真实生效。
// （WP-A 四断言 + 宿锚/权重两补充；默认档零回归由 electionGolden/westernSchools 锚,此处不重复。）
import { runElection } from '../electionEngine';
import { scoreReport } from '../scoring';
import { WEST_SCHOOLS } from '../westernSchools';
import { resolveElectionParams, electionCalibreDefaults } from '../electionParams';
import { filterAspects } from '../orbPolicy';
import { triplicityRulers } from '../../data/dignities';
import { mansionOf } from '../../data/lunarMansions';
import { buildFacts } from '../../engine/chartFacts';
import { buildMockResult } from './electionFixture';

const sectionOf = (j, key) => j.sections.find((s) => s.key === key);

describe('① 界系随口径变（判读层）', () => {
	it('termsVariant 覆盖 0→2:almuten 界主计分变(月在巨蟹7°:埃及界金星/托勒密经典界木星);希腊化档显式绑埃及界', () => {
		const a = runElection(buildMockResult(), 'marriage');
		const b = runElection(buildMockResult(), 'marriage', null, null, { electionParams: { termsVariant: 2 } });
		expect(JSON.stringify(sectionOf(b, 'almuten'))).not.toBe(JSON.stringify(sectionOf(a, 'almuten')));
		// 希腊化档 calibre 绑埃及界 → almuten 与默认档(同为埃及界)同构
		const hel = runElection(buildMockResult(), 'marriage', null, null, { westSchool: 'hellenistic' });
		expect(hel.calibre.eff.termsVariant).toBe(0);
		expect(WEST_SCHOOLS.hellenistic.calibre.termsVariant).toBe(0);
	});
});

describe('② 三分制:文艺复兴档水三分昼夜皆火星', () => {
	it('renaissance calibre 绑 ptolemaic;triplicityRulers(water,ptolemaic) 昼夜=火星、无共主', () => {
		expect(WEST_SCHOOLS.renaissance.calibre.tripSystem).toBe('ptolemaic');
		const t = triplicityRulers('water', 'ptolemaic');
		expect(t.day).toBe('mars');
		expect(t.night).toBe('mars');
		expect(t.participating).toBeNull();
		// 引擎面:renaissance almuten 与默认档不同(三分/水象计分变)
		const a = runElection(buildMockResult(), 'marriage');
		const r = runElection(buildMockResult(), 'marriage', null, null, { westSchool: 'renaissance' });
		expect(JSON.stringify(sectionOf(r, 'almuten'))).not.toBe(JSON.stringify(sectionOf(a, 'almuten')));
	});
});

describe('③ 容许度三档:sign ⊆ moiety ⊆ modern', () => {
	it('构造跨档相位:月-金 60°(非整宫congruent,orb5) modern/moiety 留、sign 剔', () => {
		const r = buildMockResult();
		r.aspects.normalAsp.Moon.Applicative.push({ id: 'Venus', asp: 60, orb: 5.0 });
		const facts = buildFacts(r);
		const all = (profile) => filterAspects(
			[{ other: 'saturn', angle: 120, orb: 1.5 }, { other: 'venus', angle: 60, orb: 5.0 }],
			'moon', facts, profile);
		const modern = all('modern');
		const moiety = all('moiety');
		const sign = all('sign');
		expect(modern.length).toBe(2);
		expect(moiety.length).toBe(2);       // pairOrb(moon,venus)=9.5 ≥5 → 留
		expect(sign.length).toBe(1);         // 月巨蟹×金白羊整宫为 90 ≠ 60 → 剔
		// 子集律
		expect(moiety.every((x) => modern.some((y) => y.other === x.other && y.angle === x.angle))).toBe(true);
		expect(sign.every((x) => moiety.some((y) => y.other === x.other && y.angle === x.angle))).toBe(true);
		// 引擎面:sign 档下月-金相位不再进入自算模块
		const jHel = runElection(r, 'marriage', null, null, { westSchool: 'hellenistic' });
		expect(jHel.calibre.eff.orbProfile).toBe('sign');
	});
});

describe('④ moduleSet:白名单外核心模块不计入总分', () => {
	it('hellenistic 排除 aspect_patterns:其分数变动不影响总分;modern_main 会影响', () => {
		const mk = (apScore) => ([
			{ key: 'moon', score: 60 }, { key: 'asc_ruler', score: 60 }, { key: 'ascendant', score: 60 },
			{ key: 'topic_significators', score: 60 }, { key: 'angles', score: 60 }, { key: 'topic_house', score: 60 },
			{ key: 'sun', score: 60 }, { key: 'aspect_patterns', score: apScore },
			{ key: 'reception_fixedstar_midpoint', score: 60 }, { key: 'fixed_stars', score: 60 },
		]);
		const helLo = scoreReport(mk(0), [], WEST_SCHOOLS.hellenistic);
		const helHi = scoreReport(mk(100), [], WEST_SCHOOLS.hellenistic);
		expect(helLo.base).toBe(helHi.base);
		const mmLo = scoreReport(mk(0), [], WEST_SCHOOLS.modern_main);
		const mmHi = scoreReport(mk(100), [], WEST_SCHOOLS.modern_main);
		expect(mmLo.base).not.toBe(mmHi.base);
	});
});

describe('⑤ 空亡口径随流派解算', () => {
	it('月无任何入相时:kenodromia 判空出红线,默认 classic(后端 isVOC=false)不出', () => {
		const mk = () => {
			const r = buildMockResult();
			r.aspects.normalAsp.Moon.Applicative = [];   // 抽走月入相 → 30°法必空
			return r;
		};
		const a = runElection(mk(), 'marriage');
		const b = runElection(mk(), 'marriage', null, null, { electionParams: { vocMode: 'kenodromia' } });
		expect(a.hard_flags.some((f) => f.id === 'moon_void_of_course')).toBe(false);
		expect(b.hard_flags.some((f) => f.id === 'moon_void_of_course')).toBe(true);
		// 希腊化档(vocMode=kenodromia 学理绑定)同样出
		const hel = runElection(mk(), 'marriage', null, null, { westSchool: 'hellenistic' });
		expect(hel.hard_flags.some((f) => f.id === 'moon_void_of_course')).toBe(true);
	});
});

describe('⑥ sectWeight 真消费 + ⑦ 宿锚变体', () => {
	it('sectWeight 变 → 总分构成变(sect 模块在场时)', () => {
		const sections = [{ key: 'moon', score: 80 }, { key: 'sect', score: 20 }];
		const w1 = scoreReport(sections, [], { sectWeight: 0.05, extraWeights: {} });
		const w2 = scoreReport(sections, [], { sectWeight: 0.50, extraWeights: {} });
		expect(w1.base).toBeGreaterThan(w2.base);   // sect 低分权重越大,均分越低
	});
	it('mansionOf sheratan 锚:同黄经落宿整体偏移且随岁差', () => {
		expect(mansionOf(0).n).toBe(1);
		expect(mansionOf(0, 'sheratan', 2000).n).not.toBe(1);
		// 岁差推进 2000→4000 年,锚点东移 ~28°,边界继续漂移
		const m2000 = mansionOf(40, 'sheratan', 2000).n;
		const m4000 = mansionOf(40, 'sheratan', 4000).n;
		expect(m2000).not.toBe(m4000);
	});
	it('四层优先级:页面覆盖 > 流派绑定 > 全局 > 默认', () => {
		const d = electionCalibreDefaults();
		expect(d.vocMode).toBe('classic');
		const g = resolveElectionParams('modern_main', { vocMode: 'by_orb' }, null);
		expect(g.vocMode).toBe('by_orb');                       // 全局压默认
		const s = resolveElectionParams('hellenistic', { vocMode: 'by_orb' }, null);
		expect(s.vocMode).toBe('kenodromia');                   // 流派绑定压全局
		const o = resolveElectionParams('hellenistic', { vocMode: 'by_orb' }, { vocMode: 'exempt4' });
		expect(o.vocMode).toBe('exempt4');                      // 页面覆盖压流派
		const skip = resolveElectionParams('hellenistic', null, { vocMode: '' });
		expect(skip.vocMode).toBe('kenodromia');                // ''=随流派
	});
});
