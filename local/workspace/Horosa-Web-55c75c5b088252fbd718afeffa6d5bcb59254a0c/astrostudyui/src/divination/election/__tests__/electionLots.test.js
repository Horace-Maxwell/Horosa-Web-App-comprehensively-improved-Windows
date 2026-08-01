// R2 阿拉伯点全谱金标:昼夜互镜/根基短弧/荣誉不对称/宫头系点/婚姻四路/构造与反转口径/父受焰替式/派生宫。
import { runElection } from '../electionEngine';
import { computeElectionLots, lotDerivedHouses, resolveTopicLots } from '../lotsEngine';
import { computeHonores, computeBasis } from '../../data/lots';
import { buildFacts } from '../../engine/chartFacts';
import { buildMockResult } from './electionFixture';
import { TOPIC_MASTER } from '../../data/topicMaster';

const near = (a, b, eps) => Math.abs(((a - b) % 360 + 540) % 360 - 180) <= (eps || 1e-6);

function mkFacts(patch){
	const r = buildMockResult();
	if(patch) patch(r);
	return buildFacts(r);
}

describe('福/精神互镜与特殊构造', () => {
	it('恒等式:ASC−福 = 精神−ASC(fixture: asc15 福117.1 → 精神272.9)', () => {
		const facts = mkFacts();
		const lots = computeElectionLots(facts, null);
		const f = lots.byId.fortune; const s = lots.byId.spirit;
		expect(near(f.lon, 117.1)).toBe(true);
		expect(near(s.lon, 272.9)).toBe(true);
		const asc = 15;
		expect(near(((asc - f.lon) % 360 + 360) % 360, ((s.lon - asc) % 360 + 360) % 360)).toBe(true);
	});
	it('荣誉点:昼投白羊19°−日;夜投金牛3°−月(不对称反转)', () => {
		expect(near(computeHonores(15, 354.9, 97, true), ((15 + 19 - 354.9) % 360 + 360) % 360)).toBe(true);
		expect(near(computeHonores(15, 354.9, 97, false), ((15 + 33 - 97) % 360 + 360) % 360)).toBe(true);
	});
	it('根基点:取福-精神较短弧加于上升;两向输入同解', () => {
		// fixture:|117.1−272.9|=155.8(短弧) → basis = 15+155.8 = 170.8
		expect(near(computeBasis(15, 117.1, 272.9), 170.8, 1e-9)).toBe(true);
		expect(near(computeBasis(15, 272.9, 117.1), 170.8, 1e-9)).toBe(true);
		// 跨 0° 短弧:福350 精神10 → 短弧20 → basis=35
		expect(near(computeBasis(15, 350, 10), 35, 1e-9)).toBe(true);
	});
});

describe('宫头系点与专用式', () => {
	it('财货点=ASC+2宫头−2宫主;水路旅行点=ASC+巨蟹15°−土(昼夜同)', () => {
		const facts = mkFacts();
		const lots = computeElectionLots(facts, null);
		// 2宫头 45(金牛)主金星25 → 昼盘 asc15+45−25=35
		expect(near(lots.byId.substance.lon, 35)).toBe(true);
		// waterTravel = 15+105−335.5 = −215.5 → 144.5
		expect(near(lots.byId.waterTravel.lon, 144.5)).toBe(true);
		// 旅行点 = 15 + 9宫头255(射手,主木65) − 65 = 205
		expect(near(lots.byId.travelLot.lon, 205)).toBe(true);
	});
	it('父点受焰替式:土距日 <17°(under_beams) → 改 ASC+木−火 昼夜不反', () => {
		const normal = computeElectionLots(mkFacts(), null);
		expect(normal.byId.father).toBeTruthy();
		expect(normal.byId.fatherFire).toBeFalsy();
		const burned = computeElectionLots(mkFacts((r) => {
			const sat = r.chart.objects.find((o) => o.id === 'Saturn');
			sat.lon = 350; sat.sign = 'Pisces'; sat.signlon = 20;   // 距日354.9 仅4.9° → combust
		}), null);
		expect(burned.byId.fatherFire).toBeTruthy();
		expect(burned.byId.father).toBeFalsy();
		// 替式 = asc15 + 木65 − 火100 = −20 → 340,昼夜同
		expect(near(burned.byId.fatherFire.lon, 340)).toBe(true);
	});
});

describe('婚姻四路与构造/反转口径', () => {
	it('金土式男=ASC+金−土;女=镜像;金日/火月式昼夜不反', () => {
		const facts = mkFacts();
		const vM = computeElectionLots(facts, { marriageTradition: 'valens', querentGender: 'male' });
		const vF = computeElectionLots(facts, { marriageTradition: 'valens', querentGender: 'female' });
		const pM = computeElectionLots(facts, { marriageTradition: 'paulus', querentGender: 'male' });
		const pF = computeElectionLots(facts, { marriageTradition: 'paulus', querentGender: 'female' });
		// 昼盘:男 15+25−335.5=64.5;女 15+335.5−25=325.5
		expect(near(vM.byId.marriageMen.lon, 64.5)).toBe(true);
		expect(near(vF.byId.marriageWomen.lon, 325.5)).toBe(true);
		// Paulus:男 15+25−354.9=45.1;女 15+100−97=18
		expect(near(pM.byId.marriagePaulusMen.lon, 45.1)).toBe(true);
		expect(near(pF.byId.marriagePaulusWomen.lon, 18)).toBe(true);
	});
	it('爱欲构造:paulus=金/精神式;valens=福-精神对式;schmidt 反转口径改夜盘行星型点取昼式', () => {
		const facts = mkFacts();
		const paulus = computeElectionLots(facts, { erosConstruction: 'paulus' });
		const valens = computeElectionLots(facts, { erosConstruction: 'valens' });
		expect(paulus.byId.erosAlt).toBeTruthy();
		expect(valens.byId.erosValens).toBeTruthy();
		// 昼盘 valens 爱欲 = asc + 福 − 精神 = 15+117.1−272.9 = −140.8 → 219.2
		expect(near(valens.byId.erosValens.lon, 219.2)).toBe(true);
		// 夜盘化 fixture:isDiurnal=false → classic 反转 vs schmidt 恒昼式
		const nightFacts = mkFacts((r) => { r.chart.isDiurnal = false; });
		const classic = computeElectionLots(nightFacts, { erosConstruction: 'valens', lotsReversal: 'classic' });
		const schmidt = computeElectionLots(nightFacts, { erosConstruction: 'valens', lotsReversal: 'schmidt' });
		expect(near(classic.byId.erosValens.lon, ((15 + 272.9 - 117.1) % 360 + 360) % 360)).toBe(true);
		expect(near(schmidt.byId.erosValens.lon, 219.2)).toBe(true);
		expect(classic.byId.erosValens.lon).not.toBe(schmidt.byId.erosValens.lon);
	});
});

describe('派生宫与用事关联+引擎面', () => {
	it('lotDerivedHouses:自福点(巨蟹)起,月/火(巨蟹)=1、日(双鱼)=9', () => {
		const facts = mkFacts();
		const lots = computeElectionLots(facts, null);
		const d = lotDerivedHouses(facts, lots.byId.fortune.lon);
		expect(d.moon).toBe(1);
		expect(d.mars).toBe(1);
		expect(d.sun).toBe(9);
	});
	it('resolveTopicLots:marriageAuto/erosAuto 按口径落点', () => {
		expect(resolveTopicLots(TOPIC_MASTER.marriage, { marriageTradition: 'valens', querentGender: 'male' })).toEqual(['marriageMen']);
		expect(resolveTopicLots(TOPIC_MASTER.marriage, { marriageTradition: 'paulus', querentGender: 'female' })).toEqual(['marriagePaulusWomen']);
		expect(resolveTopicLots(TOPIC_MASTER.pursue_love, { erosConstruction: 'valens' })).toEqual(['erosValens']);
	});
	it('runElection:sections 含 lots 模块;facts.lots/topicLotIds 就位;默认档零回归由 golden 锚', () => {
		const j = runElection(buildMockResult(), 'marriage');
		expect(j.sections.some((s) => s.key === 'lots')).toBe(true);
		expect(j.facts.lots.hermetic.length).toBe(7);
		expect(j.facts.topicLotIds).toEqual(['marriageMen']);
		// lots 不在 modern_main 权重表 → 分数构成不受影响(基线保护由 golden/stress 另锚)
	});
});
