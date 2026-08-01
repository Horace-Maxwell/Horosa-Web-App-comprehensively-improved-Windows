// R2 六新分科金标:育性表/各科检查正反/买卖方向/护符主星与日时/危象八点分级+用药放开/部位对宫。
import { runElection } from '../electionEngine';
import { TOPIC_MASTER } from '../../data/topicMaster';
import { SIGN_FERTILITY_4, FERTILE_SET, BARREN_SET } from '../../data/signFertility';
import { buildMockResult } from './electionFixture';

const packItem = (j, code) => j.topicPack.items.find((x) => x.code === code);

describe('育性表与新用事登记', () => {
	it('四档全 12 座覆盖;六新用事在主表且带 notes/宜忌', () => {
		expect(Object.keys(SIGN_FERTILITY_4).length).toBe(12);
		expect(FERTILE_SET).toEqual(['cancer', 'scorpio', 'pisces', 'taurus']);
		expect(BARREN_SET.length).toBe(6);
		['planting', 'sailing', 'litigation', 'release', 'haircut', 'talisman'].forEach((t) => {
			expect(TOPIC_MASTER[t]).toBeTruthy();
			expect(TOPIC_MASTER[t].must_have.length).toBeGreaterThan(0);
			expect(TOPIC_MASTER[t].notes.length).toBeGreaterThan(10);
		});
	});
});

describe('播种/航海/理发判据', () => {
	it('播种:fixture 月巨蟹(最肥沃)增光 → 肥沃座✓、不育座✓避;月移狮子 → 双双翻负', () => {
		const j = runElection(buildMockResult(), 'planting');
		expect(packItem(j, 'moon_in_fertile_sign').pass).toBe(true);
		expect(packItem(j, 'moon_in_barren_sign').pass).toBe(true);
		const r = buildMockResult();
		const m = r.chart.objects.find((o) => o.id === 'Moon');
		m.lon = 130; m.sign = 'Leo'; m.signlon = 10;
		const j2 = runElection(r, 'planting');
		expect(packItem(j2, 'moon_in_fertile_sign').pass).toBe(false);
		expect(packItem(j2, 'moon_in_barren_sign').pass).toBe(false);
	});
	it('航海:月有土相位 → 严格免土火✗;抽走月相位表 → ✓;水象座✓', () => {
		const j = runElection(buildMockResult(), 'sailing');
		expect(packItem(j, 'moon_free_from_malefic_strict').pass).toBe(false);   // 月土 120 在表
		expect(packItem(j, 'moon_in_water_sign').pass).toBe(true);
		const r = buildMockResult();
		r.aspects.normalAsp.Moon = { Applicative: [], Separative: [], Exact: [], None: [], Obvious: [] };
		expect(packItem(runElection(r, 'sailing'), 'moon_free_from_malefic_strict').pass).toBe(true);
	});
	it('理发:月土相位命中「干枯脱发」忌;金月吉相判据在场', () => {
		const j = runElection(buildMockResult(), 'haircut');
		expect(packItem(j, 'moon_hard_from_saturn_or_mars')).toBeTruthy();
		expect(packItem(j, 'venus_moon_good_aspect')).toBeTruthy();
	});
});

describe('诉讼/释囚判据', () => {
	it('诉讼:1宫主火星(陷-4) vs 7宫主金星(陷-5) → 己强于敌✓;月离火(7主非火)不满足离7入1', () => {
		const j = runElection(buildMockResult(), 'litigation');
		expect(packItem(j, 'l1_stronger_than_l7').pass).toBe(true);   // -4 > -5
		expect(packItem(j, 'moon_separating_l7_applying_l1')).toBeTruthy();
	});
	it('释囚:12宫主木星有位有速判弱✗/增速判据/离凶入吉(月离火入土=非吉)✗', () => {
		const j = runElection(buildMockResult(), 'release');
		expect(packItem(j, 'moon_sep_mal_app_ben').pass).toBe(false);   // 离火(凶✓)但入土(非吉)
		expect(packItem(j, 'l12_weak')).toBeTruthy();
		expect(packItem(j, 'moon_increasing_speed').pass).toBe(true);   // 13.2 > 平均
	});
});

describe('护符与买卖方向', () => {
	it('护符:未选主星 → 主星类检查 skip;选金星(时主=金) → 行星时匹配✓、庙旺角宫按实判', () => {
		const j0 = runElection(buildMockResult(), 'talisman');
		expect(packItem(j0, 'talisman_ruler_dignified_angular')).toBeUndefined();   // skip 不出条目
		const j = runElection(buildMockResult(), 'talisman', null, null, { talismanStar: 'venus' });
		expect(packItem(j, 'planetary_day_hour_match').pass).toBe(true);   // fixture 时主=金星
		expect(packItem(j, 'talisman_ruler_dignified_angular').pass).toBe(false);   // 金陷白羊
		expect(packItem(j, 'talisman_ruler_afflicted').pass).toBe(true);   // 不逆不燃不在座末
	});
	it('买卖方向:不选=skip;售(1主-4 ≥ 7主-5)✓;购(7主≥1主)✗', () => {
		const j0 = runElection(buildMockResult(), 'trade');
		expect(packItem(j0, 'trade_side_strength')).toBeUndefined();
		const js = runElection(buildMockResult(), 'trade', null, null, { tradeSide: 'sell' });
		expect(packItem(js, 'trade_side_strength').pass).toBe(true);
		const jb = runElection(buildMockResult(), 'trade', null, null, { tradeSide: 'buy' });
		expect(packItem(jb, 'trade_side_strength').pass).toBe(false);
	});
});

describe('危象八点与部位对宫', () => {
	it('八点全谱+大小分级;用药放开;135° 落小危象', () => {
		const cb = { date: '2025-03-01', moonLon: 322 };   // 月97 − 322 = 135°
		const j = runElection(buildMockResult(), 'medication', null, null, { crisisBase: cb });
		expect(j.crisis).toBeTruthy();
		expect(j.crisis.elapsedDeg).toBe(135);
		expect(j.crisis.nearestMark).toBe(135);
		expect(j.crisis.nearestGrade).toBe('小');
		const j2 = runElection(buildMockResult(), 'surgery', null, null, { crisisBase: { date: '2025-03-01', moonLon: 7 } });
		expect(j2.crisis.nearestMark).toBe(90);
		expect(j2.crisis.nearestGrade).toBe('大');
		// 非医事仍不产出
		expect(runElection(buildMockResult(), 'marriage', null, null, { crisisBase: cb }).crisis).toBeNull();
	});
	it('360° 环向边界:月刚过本位 2°→距月归本位 2°(非 358°);354°→距 6°', () => {
		const j = runElection(buildMockResult(), 'surgery', null, null, { crisisBase: { date: '2025-03-01', moonLon: 95 } });   // 月97−95=2°
		expect(j.crisis.nearestMark).toBe(360);
		expect(j.crisis.distToMark).toBe(2);
		const j2 = runElection(buildMockResult(), 'surgery', null, null, { crisisBase: { date: '2025-03-01', moonLon: 103 } }); // 97−103=−6→354°
		expect(j2.crisis.nearestMark).toBe(360);
		expect(j2.crisis.distToMark).toBe(6);
	});
	it('部位对宫开关:月巨蟹,部位=摩羯 → 默认不延✓通过;开延及对宫 → ✗命中', () => {
		const off = runElection(buildMockResult(), 'surgery', null, null, { surgeryPart: 'capricorn' });
		expect(packItem(off, 'moon_in_surgery_part_sign').pass).toBe(true);
		const on = runElection(buildMockResult(), 'surgery', null, null, { surgeryPart: 'capricorn', surgeryPartOpposite: true });
		expect(packItem(on, 'moon_in_surgery_part_sign').pass).toBe(false);
	});
});
