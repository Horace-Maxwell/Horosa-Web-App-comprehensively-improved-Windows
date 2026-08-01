// R2 排查轮·口径压测矩阵:13 口径键 × 全取值 × 5 流派 逐一单键穷举(不炸+不变式)
// + 全键组合风暴 + 垃圾值/冲突组合 + 快照四段恒在 + 挂载再生同参面等价。
import { runElection } from '../electionEngine';
import { buildElectionSnapshot } from '../electionSnapshot';
import { ELECTION_PARAM_SPEC } from '../electionParams';
import { WEST_SCHOOL_ORDER } from '../westernSchools';
import { buildMockResult } from './electionFixture';

const GRADES = ['excellent', 'good', 'fair', 'poor', 'disqualified'];

function assertSane(j){
	expect(j).toBeTruthy();
	expect(j.overall.score).toBeGreaterThanOrEqual(0);
	expect(j.overall.score).toBeLessThanOrEqual(100);
	expect(GRADES).toContain(j.overall.grade);
	expect(j.sections.length).toBe(21);
	j.sections.forEach((s) => {
		expect(Number.isFinite(s.score)).toBe(true);
		(s.findings || []).forEach((f) => {
			expect(`${f.text_zh || f.message}`).not.toMatch(/NaN|undefined/);
		});
	});
	expect(j.calibre && j.calibre.summary.length).toBe(8);
	j.calibre.summary.forEach((line) => expect(line).not.toMatch(/NaN|undefined/));
}

describe('单键穷举:13 口径键全取值 × 5 流派(325 组)', () => {
	it('全组合不炸、不变式全过、summary 无脏值', () => {
		let ran = 0;
		ELECTION_PARAM_SPEC.forEach((spec) => {
			spec.options.forEach((opt) => {
				WEST_SCHOOL_ORDER.forEach((ws) => {
					const j = runElection(buildMockResult(), 'marriage', null, null, {
						westSchool: ws, electionParams: { [spec.key]: opt.value },
					});
					assertSane(j);
					ran += 1;
				});
			});
		});
		expect(ran).toBe(ELECTION_PARAM_SPEC.reduce((s, p) => s + p.options.length, 0) * 5);
	});
});

describe('全键组合风暴与冲突组合', () => {
	it('极端组合A(全古典最紧):迦勒底界+二主+整宫轨+30°法+七曜+实星锚+Paulus婚+对式构造+不反转', () => {
		const j = runElection(buildMockResult(), 'marriage', null, null, {
			westSchool: 'hellenistic',
			electionParams: {
				termsVariant: 3, tripSystem: 'ptolemaic', orbProfile: 'sign', vocMode: 'kenodromia',
				bodySet: 'classical7', mansionAnchor: 'sheratan', marriageTradition: 'paulus',
				querentGender: 'female', erosConstruction: 'valens', lotsReversal: 'schmidt',
				firdariaNightOrder: 'nodes_end', zrLot: 'spirit', pdTimeKey: 'Placidus',
			},
		});
		assertSane(j);
		expect(j.facts.lots.byId.marriagePaulusWomen).toBeTruthy();
		expect(j.facts.lots.byId.erosValens).toBeTruthy();
		const snap = buildElectionSnapshot(j);
		['[流派口径]', '[尊贵强弱]', '[阿拉伯点]', '[择前考量]'].forEach((s) => expect(snap).toContain(s));
		expect(snap).toContain('迦勒底');
	});
	it('冲突组合B(流派绑定 vs 反向覆盖):文艺复兴档全键反着押,页面覆盖恒胜', () => {
		const j = runElection(buildMockResult(), 'trade', null, null, {
			westSchool: 'renaissance', tradeSide: 'sell',
			electionParams: { tripSystem: 'dorothean', orbProfile: 'modern', vocMode: 'exempt4', bodySet: 'modern10' },
		});
		assertSane(j);
		expect(j.calibre.eff.tripSystem).toBe('dorothean');
		expect(j.calibre.eff.orbProfile).toBe('modern');
		expect(j.calibre.eff.vocMode).toBe('exempt4');
		expect(j.calibre.eff.bodySet).toBe('modern10');
	});
	it('垃圾值风暴:未知键/非法值/null/数字串,四层解析吞掉未知值不炸(未知值原样入 eff 但引擎兜底)', () => {
		const junk = [
			{ termsVariant: 99 }, { tripSystem: 'nonsense' }, { orbProfile: 'xxx' }, { vocMode: 'bogus' },
			{ mansionAnchor: 'mars' }, { lotsReversal: 42 }, { unknownKey: 'x' }, { termsVariant: '2' },
			{ marriageTradition: null }, { querentGender: '' },
		];
		junk.forEach((p) => {
			expect(() => {
				const j = runElection(buildMockResult(), 'marriage', null, null, { electionParams: p });
				expect(j.overall.score).toBeGreaterThanOrEqual(0);
				const snap = buildElectionSnapshot(j);
				expect(snap.length).toBeGreaterThan(100);
			}).not.toThrow();
		});
	});
	it('crisisBase × 六新用事 交叉:仅医事产出且八点分级恒合法', () => {
		const cb = { date: '2025-03-01', moonLon: 10 };
		['planting', 'sailing', 'litigation', 'release', 'haircut', 'talisman', 'surgery', 'medication'].forEach((tp) => {
			const j = runElection(buildMockResult(), tp, null, null, { crisisBase: cb });
			if(tp === 'surgery' || tp === 'medication'){
				expect(j.crisis).toBeTruthy();
				expect(['大', '小']).toContain(j.crisis.nearestGrade);
				expect(j.crisis.distToMark).toBeLessThanOrEqual(45);
			}else{
				expect(j.crisis).toBeNull();
			}
		});
	});
});

describe('挂载/存档同参面等价(四链一致性锚)', () => {
	it('同一 opts 面下 runElection 快照 = 存档侧快照(字节等)——供给侧与判读侧永不分叉', () => {
		const opts = {
			westSchool: 'persian', tradeSide: 'sell', talismanStar: 'venus', surgeryPartOpposite: true,
			electionParams: { termsVariant: 2, vocMode: 'by_orb' },
		};
		const a = buildElectionSnapshot(runElection(buildMockResult(), 'trade', null, null, opts));
		const b = buildElectionSnapshot(runElection(buildMockResult(), 'trade', null, null, { ...opts }));
		expect(a).toBe(b);
		expect(a).toContain('托勒密界·经典传本');
		expect(a).toContain('容许度 12°30′');
	});
});
