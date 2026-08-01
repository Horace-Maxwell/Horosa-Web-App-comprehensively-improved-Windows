// R2 择前考量金标:三清单结构/逐条判定/口径随动/第7宫高亮/总结阈值/不计分。
import { buildConsiderations, lillyConsiderations, rameseyMoonImpediments, bonattiHighlights } from '../considerations';
import { runElection } from '../electionEngine';
import { buildFacts } from '../../engine/chartFacts';
import { buildMockResult } from './electionFixture';

function mkFacts(patch){
	const r = buildMockResult();
	if(patch) patch(r);
	return buildFacts(r);
}

describe('三清单结构与 fixture 判定', () => {
	it('十考量 11 行(含并列旗标);fixture:命度15°早晚皆✓,水星燃烧✗命中', () => {
		const l = lillyConsiderations(mkFacts(), null);
		expect(l.length).toBe(11);
		expect(l.find((x) => x.key === 'asc_early').hit).toBe(false);
		expect(l.find((x) => x.key === 'asc_late').hit).toBe(false);
		// 水星 340 距日 354.9 = 14.9° → 日下光(非燃烧) → sig_combust 不命中
		expect(l.find((x) => x.key === 'sig_combust').hit).toBe(false);
		// 上升主火星巨蟹落陷 → 并列旗标命中
		expect(l.find((x) => x.key === 'l1_peregrine').hit).toBe(true);
	});
	it('月之十损 10 行;fixture:仅⑧行迟(13.2 稍高?)/其余按值判', () => {
		const r10 = rameseyMoonImpediments(mkFacts(), null);
		expect(r10.length).toBe(10);
		// 月速 13.2 > 13°10′(13.167) → 不迟
		expect(r10.find((x) => x.key === 'm8_slow').hit).toBe(false);
		expect(r10.find((x) => x.key === 'm2_fall').hit).toBe(false);
		expect(r10.find((x) => x.key === 'm7_applying_mal').hit).toBe(false);   // 月入相土 120°(非合刑冲)
		// 月 97° vs 北交 2° → 距轴 85°/95° >12 → 不近交点
		expect(r10.find((x) => x.key === 'm3_nodes').hit).toBe(false);
	});
	it('要点清单含 45/53/62/月枢/数事择成;53 命中于主星焰下', () => {
		const b = bonattiHighlights(mkFacts(), null);
		expect(b.length).toBe(5);
		expect(b.find((x) => x.key === 'b5_moon_first').severity).toBe('info');
		// 上升主火星距日远 → 53 不命中
		expect(b.find((x) => x.key === 'b53_beams').hit).toBe(false);
	});
});

describe('判定随口径/盘面变化', () => {
	it('月速降至 12.5°/日 → ⑧行迟命中;月移天蝎 → ②居落命中', () => {
		const slow = rameseyMoonImpediments(mkFacts((r) => {
			r.chart.objects.find((o) => o.id === 'Moon').lonspeed = 12.5;
		}), null);
		expect(slow.find((x) => x.key === 'm8_slow').hit).toBe(true);
		const fall = rameseyMoonImpediments(mkFacts((r) => {
			const m = r.chart.objects.find((o) => o.id === 'Moon');
			m.lon = 215; m.sign = 'Scorpio'; m.signlon = 5; m.house = 'House8';
		}), null);
		expect(fall.find((x) => x.key === 'm2_fall').hit).toBe(true);
		expect(fall.find((x) => x.key === 'm5_via').hit).toBe(true);   // 215 在火道 195–225
		expect(fall.find((x) => x.key === 'm9_bad_house').hit).toBe(true);
	});
	it('空亡条随 vocMode 口径:抽走月入相后 kenodromia 命中、classic 不命中', () => {
		const facts = mkFacts((r) => { r.aspects.normalAsp.Moon.Applicative = []; });
		expect(lillyConsiderations(facts, null).find((x) => x.key === 'moon_voc').hit).toBe(false);
		expect(lillyConsiderations(facts, { vocMode: 'kenodromia' }).find((x) => x.key === 'moon_voc').hit).toBe(true);
	});
	it('土星移 7 宫 → 第7宫=占星师高亮聚合', () => {
		const facts = mkFacts((r) => {
			const s = r.chart.objects.find((o) => o.id === 'Saturn');
			s.house = 'House7'; s.lon = 200; s.sign = 'Libra'; s.signlon = 20;
		});
		const c = buildConsiderations(facts, null);
		expect(c.astrologer7th.some((x) => x.key === 'saturn_7th')).toBe(true);
	});
});

describe('引擎集成:不计分 + 总结', () => {
	it('runElection 带 considerations;分数与不带考量的构成一致(不入总分)', () => {
		const j = runElection(buildMockResult(), 'marriage');
		expect(j.considerations).toBeTruthy();
		expect(j.considerations.lilly.length).toBe(11);
		expect(['良好', '需留意', '建议另择']).toContain(j.considerations.verdictCn);
		// 计分构成锚:base 仍由 scoring.WEIGHTS/extraWeights 决定(golden 另锚字节)
		expect(typeof j.base).toBe('number');
	});
	it('总结阈值:0-2 良好 / 3-5 需留意 / ≥6 建议另择', () => {
		const good = buildConsiderations(mkFacts(), null);
		expect(good.hitCount).toBeLessThan(6);
		const bad = buildConsiderations(mkFacts((r) => {
			const m = r.chart.objects.find((o) => o.id === 'Moon');
			m.lon = 218; m.sign = 'Scorpio'; m.signlon = 8; m.house = 'House8'; m.lonspeed = 11; m.isVOC = true;
			const s = r.chart.objects.find((o) => o.id === 'Saturn');
			s.house = 'House7';
			r.aspects.normalAsp.Moon.Applicative = [{ id: 'Mars', asp: 90, orb: 2 }];
		}), null);
		expect(bad.hitCount).toBeGreaterThanOrEqual(6);
		expect(bad.verdictCn).toBe('建议另择');
	});
});
