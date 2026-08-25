// [卜卦改进 H2] 完成法与应期 correctness 批——行为级专项锁。
// 覆盖:①45° 半刑前置滤 ②接纳分层化解硬相位(receptionForHardAspects 三档)
// ③互容独立成事(receptionPerfection 门控) ④传递/汇集应期腿(timingLeg)
// ⑤传光候选集(perfectionCandidates:三王/七政;交点福点恒不入) ⑥落位法删 pB.house===qh 误判支
// ⑦破后救援(rescue 记录+rescueAfterDestruction 改判) ⑧九格表补全+hopeless 文案分叉+副应期+留驻
// ⑨moonPerfection 纯增字段。全部用后端真形状合成盘(normalAsp PascalCase/receptions supplierRulerShip)。
import { analyzePerfection } from '../../engine/perfection';
import { timingFrom } from '../timing';
import { runHorary } from '../horaryEngine';
import { buildMockResult } from '../../election/__tests__/electionFixture';

// 空相位槽
function slot(){ return { Applicative: [], Separative: [], Exact: [], None: [], Obvious: [] }; }
// 合成 facts:两征象星+可注入的第三星/相位/接纳/互容
function mkFacts(over){
	const f = {
		meta: { isDiurnal: true, ascLon: 15, hourRuler: 'mars' },
		planets: {
			mars: { key: 'mars', lon: 15, sign: 'aries', signlon: 15, house: 1, speed: 0.6, retro: false, combustion: null, dignityScore: 5 },
			venus: { key: 'venus', lon: 105, sign: 'cancer', signlon: 15, house: 4, speed: 1.1, retro: false, combustion: null, dignityScore: 0 },
			moon: { key: 'moon', lon: 200, sign: 'libra', signlon: 20, house: 7, speed: 13.2, retro: false, combustion: null, dignityScore: 0 },
			saturn: { key: 'saturn', lon: 250, sign: 'sagittarius', signlon: 10, house: 9, speed: 0.03, retro: false, combustion: null, dignityScore: 0 },
			jupiter: { key: 'jupiter', lon: 130, sign: 'leo', signlon: 10, house: 5, speed: 0.08, retro: false, combustion: null, dignityScore: 0 },
			mercury: { key: 'mercury', lon: 95, sign: 'cancer', signlon: 5, house: 4, speed: 1.4, retro: false, combustion: null, dignityScore: 0 },
			sun: { key: 'sun', lon: 100, sign: 'cancer', signlon: 10, house: 4, speed: 0.98, retro: false, combustion: null, dignityScore: 0 },
			pluto: { key: 'pluto', lon: 285, sign: 'capricorn', signlon: 15, house: 10, speed: 0.01, retro: false, combustion: null, dignityScore: 0 },
		},
		houses: { 1: { ruler: 'mars' }, 7: { ruler: 'venus' } },
		lons: {},
		result: { aspects: { normalAsp: { Mars: slot(), Venus: slot(), Moon: slot(), Saturn: slot(), Jupiter: slot(), Mercury: slot(), Sun: slot(), Pluto: slot() } }, receptions: {}, mutuals: {}, surround: null, chart: {} },
	};
	if(over){ over(f); }
	return f;
}

describe('H2① 非托勒密角前置滤', () => {
	it('45° 半刑入相不再构成完成法(旧码曾判「直接完成(hard)」)', () => {
		const f = mkFacts((x) => { x.result.aspects.normalAsp.Mars.Applicative.push({ id: 'Venus', asp: 45, orb: 1.2 }); });
		const r = analyzePerfection(f, 'mars', 'venus', {});
		expect(r.method).not.toBe('application');
		expect(r.aspect).toBe(null);   // 非托勒密角整体不入 result.aspect
	});
	it('90° 托勒密角照常入判', () => {
		const f = mkFacts((x) => {
			x.result.aspects.normalAsp.Mars.Applicative.push({ id: 'Venus', asp: 120, orb: 1.2 });
		});
		const r = analyzePerfection(f, 'mars', 'venus', {});
		expect(r.perfects).toBe(true);
		expect(r.method).toBe('application');
		expect(r.ease).toBe('easy');
	});
});

describe('H2② 接纳分层化解硬相位(receptionForHardAspects)', () => {
	// 90° 入相+弱接纳(仅界):default any=化解;strong 档=破坏;庙级接纳时 strong 档也化解
	function hardWith(recShips){
		return mkFacts((x) => {
			x.result.aspects.normalAsp.Mars.Applicative.push({ id: 'Venus', asp: 90, orb: 2.0 });
			if(recShips){
				x.result.receptions = { normal: [{ beneficiary: 'Mars', beneficiaryDignity: [], supplier: 'Venus', supplierRulerShip: recShips }] };
			}
		});
	}
	it("default('any'):弱接纳(界)即化解=现状零回归", () => {
		const r = analyzePerfection(hardWith(['term']), 'mars', 'venus', {});
		expect(r.perfects).toBe(true);
		expect(r.destroyed).toBe(false);
	});
	it("'strong' 档:弱接纳不足级 → 破坏 no_reception_hard", () => {
		const r = analyzePerfection(hardWith(['term']), 'mars', 'venus', { receptionForHardAspects: 'strong' });
		expect(r.destroyed).toBe(true);
		expect(r.destruction).toBe('no_reception_hard');
	});
	it("'strong' 档:庙级接纳(receives 真键名 supplierRulerShip=['ruler'])化解 —— 键名对拍锁", () => {
		const r = analyzePerfection(hardWith(['ruler']), 'mars', 'venus', { receptionForHardAspects: 'strong' });
		expect(r.perfects).toBe(true);
		expect(r.destroyed).toBe(false);
	});
	it("'strong_or_double_minor' 档:单向双次尊贵(界+三分)亦化解", () => {
		const r = analyzePerfection(hardWith(['term', 'trip']), 'mars', 'venus', { receptionForHardAspects: 'strong_or_double_minor' });
		expect(r.perfects).toBe(true);
	});
});

describe('H2③ 互容独立成事(receptionPerfection)', () => {
	function mutualStrong(){
		return mkFacts((x) => {
			x.result.mutuals = { normal: [{ planetA: { id: 'Mars', rulerShip: ['ruler'] }, planetB: { id: 'Venus', rulerShip: ['exalt'] } }] };
		});
	}
	it('default:无相位+庙旺互容 → 不成(现状零回归)', () => {
		const r = analyzePerfection(mutualStrong(), 'mars', 'venus', {});
		expect(r.perfects).toBe(false);
	});
	it('receptionPerfection:true → method=reception 成事', () => {
		const r = analyzePerfection(mutualStrong(), 'mars', 'venus', { receptionPerfection: true });
		expect(r.perfects).toBe(true);
		expect(r.method).toBe('reception');
	});
	it('weak 级互容(双面)开档也不成事(仅证词)', () => {
		const f = mkFacts((x) => {
			x.result.mutuals = { normal: [{ planetA: { id: 'Mars', rulerShip: ['face'] }, planetB: { id: 'Venus', rulerShip: ['face'] } }] };
		});
		const r = analyzePerfection(f, 'mars', 'venus', { receptionPerfection: true });
		expect(r.perfects).toBe(false);
	});
});

describe('H2④ 传递/汇集应期腿(timingLeg)', () => {
	it('传递:timingLeg=信使→目标腿(orb/角/mover/target 全录)', () => {
		const f = mkFacts((x) => {
			x.result.aspects.normalAsp.Moon.Separative.push({ id: 'Mars', asp: 0, orb: 3.0 });
			x.result.aspects.normalAsp.Moon.Applicative.push({ id: 'Venus', asp: 120, orb: 1.5 });
		});
		const r = analyzePerfection(f, 'mars', 'venus', {});
		expect(r.method).toBe('translation');
		expect(r.timingLeg).toEqual({ orb: 1.5, angle: 120, mover: 'moon', target: 'venus' });
	});
	it('汇集:timingLeg=双腿较大 orb(后成相腿)', () => {
		const f = mkFacts((x) => {
			x.result.aspects.normalAsp.Mars.Applicative.push({ id: 'Saturn', asp: 120, orb: 2.5 });
			x.result.aspects.normalAsp.Venus.Applicative.push({ id: 'Saturn', asp: 60, orb: 4.0 });
		});
		const r = analyzePerfection(f, 'mars', 'venus', {});
		expect(r.method).toBe('collection');
		expect(r.collector).toBe('saturn');
		expect(r.timingLeg.orb).toBe(4.0);
		expect(r.timingLeg.mover).toBe('venus');
		expect(r.timingLeg.target).toBe('saturn');
	});
});

describe('H2⑤ 传光候选集(perfectionCandidates)', () => {
	function plutoTranslates(){
		return mkFacts((x) => {
			x.result.aspects.normalAsp.Pluto.Separative.push({ id: 'Mars', asp: 60, orb: 2.0 });
			x.result.aspects.normalAsp.Pluto.Applicative.push({ id: 'Venus', asp: 120, orb: 1.0 });
		});
	}
	it("default('withOuter'):冥王星可传光=现状零回归", () => {
		const r = analyzePerfection(plutoTranslates(), 'mars', 'venus', {});
		expect(r.method).toBe('translation');
		expect(r.translator).toBe('pluto');
	});
	it("'classical7':三王星不入候选 → 不作传递", () => {
		const r = analyzePerfection(plutoTranslates(), 'mars', 'venus', { perfectionCandidates: 'classical7' });
		expect(r.method).not.toBe('translation');
	});
	it('交点/福点即使出现在相位表也恒不作候选(两档皆然)', () => {
		const f = mkFacts((x) => {
			x.result.aspects.normalAsp.North_Node = slot();
			x.result.aspects.normalAsp.North_Node.Separative.push({ id: 'Mars', asp: 0, orb: 2.0 });
			x.result.aspects.normalAsp.North_Node.Applicative.push({ id: 'Venus', asp: 60, orb: 1.0 });
			x.planets.north_node = { key: 'north_node', lon: 50, sign: 'taurus', signlon: 20, house: 2, speed: -0.05 };
		});
		const r = analyzePerfection(f, 'mars', 'venus', {});
		expect(r.method).not.toBe('translation');
	});
});

describe('H2⑥ 落位法删误判支', () => {
	it('事项主居自己本宫(pB.house===qh)不再判 position 完成', () => {
		const f = mkFacts((x) => { x.planets.venus.house = 7; });
		const r = analyzePerfection(f, 'mars', 'venus', { quesitedHouse: 7, antiscia: false });
		expect(r.perfects).toBe(false);
	});
	it('问方星入事项宫(pA.house===qh)仍判 position', () => {
		const f = mkFacts((x) => { x.planets.mars.house = 7; });
		const r = analyzePerfection(f, 'mars', 'venus', { quesitedHouse: 7, antiscia: false });
		expect(r.perfects).toBe(true);
		expect(r.method).toBe('position');
	});
	it('事项主入命宫(pB.house===1)仍判 position', () => {
		const f = mkFacts((x) => { x.planets.venus.house = 1; });
		const r = analyzePerfection(f, 'mars', 'venus', { quesitedHouse: 7, antiscia: false });
		expect(r.perfects).toBe(true);
		expect(r.method).toBe('position');
	});
});

describe('H2⑦ 破后救援(rescue)', () => {
	// 火金 120° 入相(orb 3.0)但水星抢先入相金星(orb 0.5)=prohibition;同时月亮传光(离火入金)
	function destroyedWithRescue(){
		return mkFacts((x) => {
			x.result.aspects.normalAsp.Mars.Applicative.push({ id: 'Venus', asp: 120, orb: 3.0 });
			x.result.aspects.normalAsp.Mercury.Applicative.push({ id: 'Venus', asp: 60, orb: 0.5 });
			x.result.aspects.normalAsp.Moon.Separative.push({ id: 'Mars', asp: 0, orb: 2.0 });
			x.result.aspects.normalAsp.Moon.Applicative.push({ id: 'Venus', asp: 60, orb: 1.8 });
		});
	}
	it('default:破坏保持+rescue 仅记录不改判(现状零回归)', () => {
		const r = analyzePerfection(destroyedWithRescue(), 'mars', 'venus', {});
		expect(r.destroyed).toBe(true);
		expect(r.destruction).toBe('prohibition');
		expect(r.perfects).toBe(false);
		expect(r.rescue && r.rescue.method).toBe('translation');
		expect(r.rescue.by).toBe('moon');
	});
	it('rescueAfterDestruction:true → 改判可成+overrodeDestruction 记原破坏+timingLeg 提升', () => {
		const r = analyzePerfection(destroyedWithRescue(), 'mars', 'venus', { rescueAfterDestruction: true });
		expect(r.perfects).toBe(true);
		expect(r.destroyed).toBe(false);
		expect(r.method).toBe('translation');
		expect(r.translator).toBe('moon');
		expect(r.overrodeDestruction).toBe('prohibition');
		expect(r.timingLeg && r.timingLeg.orb).toBe(1.8);
	});
	it('无任何中介时:rescue 不出现,破坏照旧', () => {
		const f = mkFacts((x) => {
			x.result.aspects.normalAsp.Mars.Applicative.push({ id: 'Venus', asp: 120, orb: 3.0 });
			x.result.aspects.normalAsp.Mercury.Applicative.push({ id: 'Venus', asp: 60, orb: 0.5 });
		});
		const r = analyzePerfection(f, 'mars', 'venus', { rescueAfterDestruction: true });
		expect(r.destroyed).toBe(true);
		expect(r.rescue).toBeUndefined();
	});
});

describe('H2⑧ 应期九格表+文案分叉+副应期+留驻', () => {
	function tfacts(angularity, sign, extra){
		return {
			planets: { mars: { key: 'mars', sign, angularity, speed: 0.6, signlon: 15, ...(extra || {}) } },
		};
	}
	it('九格表单调递进:角×动=天/续×动=周/果×动=月(旧表五格塌「几乎无望」)', () => {
		expect(timingFrom(tfacts('angular', 'aries'), 'mars', 3.2, {}).unit).toBe('天');
		expect(timingFrom(tfacts('succedent', 'aries'), 'mars', 3.2, {}).unit).toBe('周');
		expect(timingFrom(tfacts('cadent', 'aries'), 'mars', 3.2, {}).unit).toBe('月');
	});
	it('果×固=年+hopeless 标记+文案分叉(杜绝「约 3.2 几乎无望」拼串)', () => {
		const t = timingFrom(tfacts('cadent', 'taurus'), 'mars', 3.2, {});
		expect(t.unit).toBe('年');
		expect(t.hopeless).toBe(true);
		expect(t.text).toContain('迁延难期');
		expect(t.text).not.toContain('几乎无望');
	});
	it('全表任何格的 text 不再出现「几乎无望」单位拼串', () => {
		['angular', 'succedent', 'cadent'].forEach((ang) => {
			['aries', 'taurus', 'gemini'].forEach((sg) => {
				const t = timingFrom(tfacts(ang, sg), 'mars', 2.0, {});
				expect(t.text).not.toMatch(/约 [\d.]+ 几乎无望/);
			});
		});
	});
	it('副应期:换座 signChange(剩余弧/按速折算天数)纯增', () => {
		const t = timingFrom(tfacts('angular', 'aries'), 'mars', 2.0, {});
		expect(t.signChange).toEqual({ deg: 15, days: 25 });   // (30−15)/0.6
	});
	it('留驻修正:timingStationAware 门控(default 无 stationNote;开档+stationState=S 出注记)', () => {
		expect(timingFrom(tfacts('angular', 'aries', { stationState: 'S' }), 'mars', 2.0, {}).stationNote).toBeUndefined();
		const on = timingFrom(tfacts('angular', 'aries', { stationState: 'S' }), 'mars', 2.0, { timingStationAware: true });
		expect(on.stationNote).toContain('停滞');
	});
});

describe('H2⑨ 编排层纯增+应期接线', () => {
	it('runHorary 输出含 moonPerfection(命主事主皆非月时非 null)', () => {
		const j = runHorary(buildMockResult(), 'general', {});
		expect(j).toBeTruthy();
		expect(j.moonPerfection === null || typeof j.moonPerfection === 'object').toBe(true);
		if(j.significators.querentKey !== 'moon' && j.significators.quesitedKey !== 'moon'){
			expect(j.moonPerfection).toBeTruthy();
			expect(typeof j.moonPerfection.perfects).toBe('boolean');
		}
	});
	it('传递完成时 timing 按传递腿折算(mock 盘:月亮传火→土,腿 orb=1.5)', () => {
		const j = runHorary(buildMockResult(), 'general', {});
		expect(j.perfection.method).toBe('translation');
		expect(j.timing).toBeTruthy();
		expect(j.timing.quantity).toBe(1.5);
		expect(j.timing.leg && j.timing.leg.method).toBe('translation');
		expect(j.timing.text).toContain('传递腿');
	});
});
