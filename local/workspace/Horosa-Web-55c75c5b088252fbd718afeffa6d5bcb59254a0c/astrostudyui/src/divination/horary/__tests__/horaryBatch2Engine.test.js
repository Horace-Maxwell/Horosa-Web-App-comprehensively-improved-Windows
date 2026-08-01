// 批2 引擎单测：Almuten(文档算例) / 考量19条+救济+时主双口径 / 空亡四模式 /
// 切断·撤回·汇集容纳·冲相三态(全部门控,默认零回归自证) / 燃烧参数化 / 应期变体 / 转宫 / 危象日。
import { almutenAt, almutenFiguris } from '../../engine/almuten';
import { considerations19, hourAgreementTest, viaCombustaRange } from '../../engine/radicality';
import { moonReport } from '../../engine/moon';
import { analyzePerfection } from '../../engine/perfection';
import { buildFacts } from '../../engine/chartFacts';
import { timingFrom } from '../timing';
import { turnedHouseOf, parentHouses, moonPromotionCheck, CATEGORY_DEF } from '../significators';
import { buildTopicDeepening } from '../topicModule';

describe('WP2.1 Almuten', () => {
	test('文档 03§7 算例:火星摩羯27°昼盘 → 土7/火4/金3/日1,almuten=土星(托勒密界+托勒密三分)', () => {
		const r = almutenAt(270 + 27, { isDiurnal: true, termsVariant: 'ptolemaic', tripSystem: 'ptolemaic' });
		expect(r.scores.saturn).toBe(7);   // 庙5 + 界2(摩羯25–30=♄)
		expect(r.scores.mars).toBe(4);     // 旺
		expect(r.scores.venus).toBe(3);    // 土象昼三分
		expect(r.scores.sun).toBe(1);      // 面(摩羯20–30=☉)
		expect(r.winners).toEqual(['saturn']);
	});
	test('界系联动改变界主:同一点校勘本(变体1) vs 经典传本天秤 11–16/16–24 分歧格', () => {
		const lonLibra13 = 180 + 13;
		const received = almutenAt(lonLibra13, { isDiurnal: true, termsVariant: 'ptolemaic' });
		const critical = almutenAt(lonLibra13, { isDiurnal: true, termsVariant: 'tetrabiblos' });
		// 传本:天秤13°落 ♃11–19 界;校勘本:落 ☿11–16 界 → 界主不同
		expect(received.breakdown.find((b) => b.layer === 'term').planet).toBe('jupiter');
		expect(critical.breakdown.find((b) => b.layer === 'term').planet).toBe('mercury');
	});
	test('夜盘三分主切换 + 权重可配 + 交点不入局', () => {
		const night = almutenAt(270 + 27, { isDiurnal: false, termsVariant: 'ptolemaic' });
		expect(night.scores.moon).toBe(3); // 土象夜三分=月
		const custom = almutenAt(270 + 27, { isDiurnal: true, termsVariant: 'ptolemaic', weights: { domicile: 9 } });
		expect(custom.scores.saturn).toBe(11); // 9 + 2
		const gem3 = almutenAt(60 + 2, { isDiurnal: true, termsVariant: 'ptolemaic' }); // 双子旺主=北交,不计
		expect(gem3.scores.north_node).toBeUndefined();
	});
	test('almutenFiguris:缺朔望按四点计并注明', () => {
		const facts = {
			meta: { isDiurnal: true, ascLon: 100 },
			planets: { sun: { lon: 10 }, moon: { lon: 70 } },
		};
		const r = almutenFiguris(facts, { fortune: { lon: 160 } }, { termsVariant: 'ptolemaic' });
		expect(r.points.length).toBe(4);
		expect(r.caveats.length).toBe(1);
		expect(r.winners.length).toBeGreaterThanOrEqual(1);
	});
});

// ── 合成 facts（考量/月亮/完成法用）──
function factsBase(){
	return {
		meta: { isDiurnal: true, ascSign: 'aries', ascDegree: 15, ascLon: 15, hourRuler: 'mars', moonPhase: { phase: 'waxing' } },
		planets: {
			sun: { key: 'sun', lon: 100, sign: 'cancer', signlon: 10, house: 4, speed: 0.98 },
			moon: { key: 'moon', lon: 200, sign: 'libra', signlon: 20, house: 7, speed: 13.2, isVOC: false, combustion: null, dignityScore: 0 },
			mars: { key: 'mars', lon: 15, sign: 'aries', signlon: 15, house: 1, speed: 0.6, retro: false, dignityScore: 5, combustion: null },
			venus: { key: 'venus', lon: 45, sign: 'taurus', signlon: 15, house: 2, speed: 1.1, retro: false, dignityScore: 5, combustion: null },
			saturn: { key: 'saturn', lon: 250, sign: 'sagittarius', signlon: 10, house: 9, speed: 0.03, retro: false, dignityScore: 0, combustion: null },
			jupiter: { key: 'jupiter', lon: 130, sign: 'leo', signlon: 10, house: 5, speed: 0.08, retro: false, dignityScore: 0, combustion: null },
			mercury: { key: 'mercury', lon: 95, sign: 'cancer', signlon: 5, house: 4, speed: 1.4, retro: false, dignityScore: 0, combustion: 'under_beams' },
		},
		houses: { 7: { ruler: 'venus' } },
		lons: {},
		result: { params: { birth: '2026-01-01' }, aspects: { normalAsp: {} }, receptions: {}, mutuals: {}, surround: null },
	};
}

describe('WP2.2 考量19条 + 时主双口径', () => {
	test('19 条齐全、蚀点降级 unavailable、技术误差恒 info', () => {
		const r = considerations19(factsBase(), {});
		expect(r.items.length).toBe(19);
		expect(r.items.find((i) => i.key === 'eclipse_degree').severity).toBe('unavailable');
		expect(r.items.find((i) => i.key === 'technical_error').hit).toBe(false);
	});
	test('月空救济:四座豁免/强象征星;燃烧之路三变体边界', () => {
		const f = factsBase();
		f.planets.moon.isVOC = true;
		f.planets.moon.sign = 'taurus';
		const r = considerations19(f, { moonVoc: true });
		const voc = r.items.find((i) => i.key === 'moon_voc');
		expect(voc.hit).toBe(true);
		expect(voc.mitigated).toBe(true);
		expect(viaCombustaRange()).toEqual([195, 225]);
		expect(viaCombustaRange('scorpioFull')).toEqual([195, 240]);
		expect(viaCombustaRange('bothFull')).toEqual([180, 240]);
	});
	test('燃烧之路命中与 Spica 救济(2026 实位≈天秤24°)', () => {
		const f = factsBase();
		f.planets.moon.lon = 204.4; // 2026 年 Spica ≈ 204.28°
		const r = considerations19(f, {});
		const vc = r.items.find((i) => i.key === 'via_combusta');
		expect(vc.hit).toBe(true);
		expect(vc.mitigated).toBe(true);
	});
	test('时主-命主一致:同星/Lilly三方/Bonatti落座元素/同性质 四判据与变体分流', () => {
		const f = factsBase(); // 上升白羊,命主火星,时主火星 → 同星
		let r = hourAgreementTest(f, {});
		expect(r.agree).toBe(true);
		expect(r.hits.some((h) => h.key === 'same_planet')).toBe(true);
		// 时主=太阳:白羊火象 Lilly 三方主(日/木) → lilly 口径命中;Bonatti 口径看落座元素
		f.meta.hourRuler = 'sun';
		r = hourAgreementTest(f, { hourAgreementVariant: 'lilly' });
		expect(r.hits.some((h) => h.key === 'triplicity_lilly')).toBe(true);
		// 同性质:时主=太阳(热干) vs 命主火星(热干)
		expect(r.hits.some((h) => h.key === 'same_nature')).toBe(true);
		// Bonatti 版:日落巨蟹(水) vs 火星落白羊(火) → 落座元素不同
		r = hourAgreementTest(f, { hourAgreementVariant: 'bonatti' });
		expect(r.hits.some((h) => h.key === 'triplicity_bonatti')).toBe(false);
	});
	test('自评类:诚意确认与否;上升过早救济', () => {
		const f = factsBase();
		f.meta.ascDegree = 1.5;
		let r = considerations19(f, {});
		expect(r.items.find((i) => i.key === 'asc_early').hit).toBe(true);
		r = considerations19(f, { confirmYouthMatch: true });
		expect(r.items.find((i) => i.key === 'asc_early').mitigated).toBe(true);
		r = considerations19(f, { sincerityConfirmed: false });
		expect(r.items.find((i) => i.key === 'insincere').hit).toBe(true);
	});
});

describe('WP2.3 空亡四模式', () => {
	function factsMoon(apps){
		const f = factsBase();
		f.planets.moon.isVOC = true;
		f.planets.moon.signlon = 27;
		f.result.aspects.normalAsp = { Moon: { Applicative: apps || [], Exact: [], Separative: [] } };
		return f;
	}
	test('by_orb:距下一主相位 ≤12.5° 即不空(跨座亦计)', () => {
		expect(moonReport(factsMoon([{ id: 'Saturn', asp: 120, orb: 11 }]), { vocMode: 'by_orb' }).voc).toBe(false);
		expect(moonReport(factsMoon([]), { vocMode: 'by_orb' }).voc).toBe(true);
	});
	test('by_sign_perfect:精确点须落本座(剩余弧不足则空)', () => {
		// 月在 27°,剩 3°;下一相位差 5° → 本座内无法完成 → 空
		expect(moonReport(factsMoon([{ id: 'Saturn', asp: 60, orb: 5 }]), { vocMode: 'by_sign_perfect' }).voc).toBe(true);
		expect(moonReport(factsMoon([{ id: 'Saturn', asp: 60, orb: 2 }]), { vocMode: 'by_sign_perfect' }).voc).toBe(false);
	});
	test('by_sign_orb:入容许度即不空;backend 别名=classic;外行星开关', () => {
		expect(moonReport(factsMoon([{ id: 'Saturn', asp: 90, orb: 8 }]), { vocMode: 'by_sign_orb' }).voc).toBe(false);
		expect(moonReport(factsMoon([]), { vocMode: 'backend' }).voc).toBe(true); // 后端 isVOC=true 原样
		const fOuter = factsMoon([{ id: 'Pluto', asp: 120, orb: 3 }]);
		expect(moonReport(fOuter, { vocMode: 'by_orb' }).voc).toBe(true);                          // 默认不计外行星
		expect(moonReport(fOuter, { vocMode: 'by_orb', vocIncludeOuter: true }).voc).toBe(false);  // 开关后计入
	});
});

// ── 完成法门控（合成两征象星入相位盘）──
function perfFacts(over){
	const f = factsBase();
	// venus(问者) 入相位 saturn(事项) 三合,差 5°
	f.result.aspects.normalAsp = {
		Venus: { Applicative: [{ id: 'Saturn', asp: 120, orb: 5 }], Exact: [], Separative: [] },
		...(over && over.normalAsp) || {},
	};
	if(over && over.planets){ Object.keys(over.planets).forEach((k) => { f.planets[k] = { ...f.planets[k], ...over.planets[k] }; }); }
	return f;
}

describe('WP2.4 相位技法门控(默认零回归自证)', () => {
	test('默认:水星抢先入相 venus(mover) 不触发切断(门未开) → 照常完成', () => {
		const f = perfFacts({ normalAsp: { Mercury: { Applicative: [{ id: 'Venus', asp: 60, orb: 2 }], Exact: [], Separative: [] } } });
		const r = analyzePerfection(f, 'venus', 'saturn', {});
		expect(r.perfects).toBe(true);
		expect(r.destroyed).toBe(false);
	});
	test('开 detectAbscission:同盘判为光线切断(destruction=abscission)', () => {
		const f = perfFacts({ normalAsp: { Mercury: { Applicative: [{ id: 'Venus', asp: 60, orb: 2 }], Exact: [], Separative: [] } } });
		const r = analyzePerfection(f, 'venus', 'saturn', { detectAbscission: true });
		expect(r.destroyed).toBe(true);
		expect(r.destruction).toBe('abscission');
		expect(r.interferer).toBe('mercury');
	});
	test('撤回:默认仅风险注记;开 refranationAsDestruction 后 mover 逆行=独立破坏态', () => {
		const f = perfFacts({ planets: { venus: { retro: true } } });
		const def = analyzePerfection(f, 'venus', 'saturn', {});
		expect(def.perfects).toBe(true);
		expect(def.refranationRisk).toBe(true);
		const strict = analyzePerfection(f, 'venus', 'saturn', { refranationAsDestruction: true });
		expect(strict.destroyed).toBe(true);
		expect(strict.destruction).toBe('refranation');
	});
	test('撤回换座变体:精确前先出本座(剩余 2° < 所差 5°)', () => {
		const f = perfFacts({ planets: { venus: { signlon: 28 } } });
		const r = analyzePerfection(f, 'venus', 'saturn', { refranationAsDestruction: true, refranationIncludeSignChange: true });
		expect(r.destruction).toBe('refranation');
	});
	test('冲相三态:默认无接纳对分=破坏;yes_but 档=可成但得而复失', () => {
		const f = perfFacts({ normalAsp: { Venus: { Applicative: [{ id: 'Saturn', asp: 180, orb: 4 }], Exact: [], Separative: [] } } });
		const def = analyzePerfection(f, 'venus', 'saturn', {});
		expect(def.destroyed).toBe(true);
		expect(def.destruction).toBe('no_reception_hard');
		const yb = analyzePerfection(f, 'venus', 'saturn', { oppositionVerdict: 'yes_but' });
		expect(yb.perfects).toBe(true);
		expect(yb.regret).toBe(true);
	});
	test('汇集严格容纳:开 collectionRequireReception 且无容纳 → 不作汇集', () => {
		const f = factsBase();
		f.result.aspects.normalAsp = {
			Venus: { Applicative: [{ id: 'Saturn', asp: 60, orb: 6 }], Exact: [], Separative: [] },
			Mars: { Applicative: [{ id: 'Saturn', asp: 90, orb: 7 }], Exact: [], Separative: [] },
		};
		const loose = analyzePerfection(f, 'venus', 'mars', {});
		expect(loose.method).toBe('collection');
		expect(loose.collector).toBe('saturn');
		const strict = analyzePerfection(f, 'venus', 'mars', { collectionRequireReception: true });
		expect(strict.method).not.toBe('collection');
	});
	test('燃烧豁免:所问=与太阳合相时不作破坏(门控)', () => {
		const f = factsBase();
		f.planets.venus.combustion = 'combust';
		f.result.aspects.normalAsp = { Venus: { Applicative: [{ id: 'Sun', asp: 0, orb: 3 }], Exact: [], Separative: [] } };
		const def = analyzePerfection(f, 'venus', 'sun', {});
		expect(def.detail.join('')).toContain('燃烧');
		const ex = analyzePerfection(f, 'venus', 'sun', { combustExemptConjAnswer: true });
		expect(ex.perfects).toBe(true);
		expect(ex.detail.join('')).toContain('豁免');
	});
});

describe('WP2.5 燃烧参数化(buildFacts opts)', () => {
	function mkResult(planetLon, sunLon){
		return {
			chart: { isDiurnal: true, objects: [
				{ id: 'Sun', lon: sunLon, sign: 'Cancer', signlon: sunLon % 30, house: 'House4', lonspeed: 1 },
				{ id: 'Venus', lon: planetLon, sign: 'Cancer', signlon: planetLon % 30, house: 'House4', lonspeed: 1.2 },
			], houses: [] },
		};
	}
	test('默认阈值 17′/8.5°/17° 与自定义(16′/8°/15°)分流', () => {
		const r1 = buildFacts(mkResult(100 + 8.2, 100));
		expect(r1.planets.venus.combustion).toBe('combust');
		const r2 = buildFacts(mkResult(100 + 8.2, 100), { combustOrb: 8 });
		expect(r2.planets.venus.combustion).toBe('under_beams');
		const r3 = buildFacts(mkResult(100 + 16, 100), { underBeamsOrb: 15 });
		expect(r3.planets.venus.combustion).toBe(null);
		const r4 = buildFacts(mkResult(100 + 0.27, 100), { cazimiOrb: 16 / 60 });
		expect(r4.planets.venus.combustion).toBe('combust'); // 0.27°>16′ → 焦伤(默认17′档则为cazimi)
		expect(buildFacts(mkResult(100 + 0.27, 100)).planets.venus.combustion).toBe('cazimi');
	});
});

describe('WP2.6 应期变体与修正链', () => {
	test('默认输出与旧口径字节一致;applied/byHouse/修正链/第二法各自生效', () => {
		const f = factsBase();
		const def = timingFrom(f, 'venus', 6);
		expect(def.text).toContain('约 6 ');
		expect(def.modifiers).toBeUndefined();
		const applied = timingFrom(f, 'venus', 6, { timingVariant: 'applied', appliedKey: 'saturn' });
		expect(applied.baseKey).toBe('saturn');
		const byHouse = timingFrom(f, 'mars', 6, { timingVariant: 'byHouse', otherKey: 'venus' });
		expect(byHouse.unit).toBeTruthy();
		const mods = timingFrom(f, 'venus', 6, { timingModifiers: true, otherKey: 'saturn' });
		expect(Array.isArray(mods.modifiers)).toBe(true);
		expect(mods.adjustedQuantity).toBeDefined();
		const second = timingFrom(f, 'venus', 6, { timingSecondLaw: true, otherKey: 'saturn' });
		expect(second.secondLaw.days).toBeCloseTo(6 / Math.abs(1.1 - 0.03), 1);
	});
});

describe('WP2.8 转宫/父母宫/月亮升格', () => {
	test('转宫公式验证例:兄弟的钱=4宫、配偶的钱=8宫、朋友的事业=8宫、孙子女=9宫', () => {
		expect(turnedHouseOf(3, 2)).toBe(4);
		expect(turnedHouseOf(7, 2)).toBe(8);
		expect(turnedHouseOf(11, 10)).toBe(8);
		expect(turnedHouseOf(5, 5)).toBe(9);
		expect(turnedHouseOf(0, 2)).toBe(null);
	});
	test('父母宫两口径;月亮升格四条件', () => {
		expect(parentHouses()).toEqual({ father: 4, mother: 10 });
		expect(parentHouses('modern')).toEqual({ father: 10, mother: 4 });
		const f = factsBase();
		f.meta.ascSign = 'cancer';
		const r = moonPromotionCheck(f, 'moon', 'saturn', true);
		expect(r.promote).toBe(true);
		expect(r.reasons[0]).toContain('巨蟹');
		const f2 = factsBase();
		expect(moonPromotionCheck(f2, 'mars', 'venus', true).promote).toBe(false);
		expect(moonPromotionCheck(f2, 'mars', 'mars', true).reasons).toContain('同主一星');
	});
});

describe('WP2.7 专题 B1–B12 + 失物 + 危象日', () => {
	test('新类别注册(message/lost)且既有类别未动', () => {
		expect(CATEGORY_DEF.message.quesitedHouse).toBe(3);
		expect(CATEGORY_DEF.lost.quesitedHouse).toBe(2);
		expect(CATEGORY_DEF.marriage.quesitedHouse).toBe(7);
	});
	test('decumbiture 危象日按月速折算:90°≈6.8天(月速13.2)', () => {
		const f = factsBase();
		f.houses = { 1: { ruler: 'mars' }, 4: { ruler: 'moon' }, 6: { ruler: 'jupiter' }, 7: { ruler: 'venus' }, 10: { ruler: 'saturn' } };
		const topic = buildTopicDeepening(f, 'health');
		expect(topic.title).toContain('危象日');
		const c90 = topic.criticalDays.find((c) => c.arc === 90);
		expect(c90.days).toBeCloseTo(90 / 13.2, 1);
		expect(c90.kind).toContain('危象');
	});
	test('B2/B3/B8/B9/B10/B11/B12/失物 专题卡齐备', () => {
		const f = factsBase();
		f.houses = { 1: { ruler: 'mars' }, 2: { ruler: 'venus' }, 3: { ruler: 'mercury' }, 7: { ruler: 'venus' }, 8: { ruler: 'mars' }, 9: { ruler: 'jupiter' }, 10: { ruler: 'saturn' }, 11: { ruler: 'saturn' }, 12: { ruler: 'jupiter' } };
		['wealth', 'message', 'death', 'travel', 'career', 'hope', 'enemy', 'lost'].forEach((cat) => {
			const t = buildTopicDeepening(f, cat);
			expect(t && t.title).toBeTruthy();
			expect(t.lines.length).toBeGreaterThanOrEqual(2);
		});
	});
});
