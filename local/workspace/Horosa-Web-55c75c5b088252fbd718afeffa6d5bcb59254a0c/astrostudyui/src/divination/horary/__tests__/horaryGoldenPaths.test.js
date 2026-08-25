// [卜卦改进 H10] golden 卦例合成套件——八条完成/阻断/救援路径端到端锁(runHorary 全链):
// 直接入相成/互容成/传递成/汇集成/月亮升格径成/禁阻破/破而得救/势均。
// 每例锁:完成法 method+关键字段+legacy 三值+v2 五档 band(方向断言,不锁具体分数=防过拟合)。
import { runHorary, __resetHoraryMemoForTest } from '../horaryEngine';

function slot(){ return { Applicative: [], Separative: [], Exact: [], None: [], Obvious: [] }; }
// 端到端合成盘:后端 Result 真形状(chart.objects+houseMap+aspects.normalAsp+receptions/mutuals)。
function mkResult(over){
	const objs = [
		{ id: 'Asc', type: 'Angle', lon: 15, sign: 'Aries', signlon: 15 },
		{ id: 'MC', type: 'Angle', lon: 285, sign: 'Capricorn', signlon: 15 },
		{ id: 'Sun', type: 'Planet', lon: 100, sign: 'Cancer', signlon: 10, house: 'House4', lonspeed: 0.98, movedir: 'Direct', selfDignity: [] },
		{ id: 'Moon', type: 'Planet', lon: 200, sign: 'Libra', signlon: 20, house: 'House7', lonspeed: 13.2, movedir: 'Direct', selfDignity: [], isVOC: false },
		{ id: 'Mercury', type: 'Planet', lon: 95, sign: 'Cancer', signlon: 5, house: 'House4', lonspeed: 1.4, movedir: 'Direct', selfDignity: [] },
		{ id: 'Venus', type: 'Planet', lon: 45, sign: 'Taurus', signlon: 15, house: 'House2', lonspeed: 1.1, movedir: 'Direct', selfDignity: ['ruler'] },
		{ id: 'Mars', type: 'Planet', lon: 15, sign: 'Aries', signlon: 15, house: 'House1', lonspeed: 0.6, movedir: 'Direct', selfDignity: ['ruler'] },
		{ id: 'Jupiter', type: 'Planet', lon: 130, sign: 'Leo', signlon: 10, house: 'House5', lonspeed: 0.08, movedir: 'Direct', selfDignity: [] },
		{ id: 'Saturn', type: 'Planet', lon: 250, sign: 'Sagittarius', signlon: 10, house: 'House9', lonspeed: 0.03, movedir: 'Direct', selfDignity: [] },
	];
	const houses = [];
	const SIGNS12 = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
	const RULERS = { Aries: 'Mars', Taurus: 'Venus', Gemini: 'Mercury', Cancer: 'Moon', Leo: 'Sun', Virgo: 'Mercury', Libra: 'Venus', Scorpio: 'Mars', Sagittarius: 'Jupiter', Capricorn: 'Saturn', Aquarius: 'Saturn', Pisces: 'Jupiter' };
	for(let i = 0; i < 12; i++){
		const sg = SIGNS12[i];
		houses.push({ id: 'House' + (i + 1), lon: (15 + i * 30) % 360, sign: sg, signlon: 15, ruler: RULERS[sg], planets: [] });
	}
	const r = {
		chart: { objects: objs, houses, isDiurnal: true },
		aspects: { normalAsp: { Sun: slot(), Moon: slot(), Mercury: slot(), Venus: slot(), Mars: slot(), Jupiter: slot(), Saturn: slot() } },
		receptions: {}, mutuals: {}, surround: null, lots: [],
		params: { birth: '2026-01-01' },
	};
	if(over){ over(r); }
	return r;
}
// marriage 类:querent=1宫主 Mars,quesited=7宫主 Venus。
function judge(r, opts){ __resetHoraryMemoForTest(); return runHorary(r, 'marriage', opts || {}); }

describe('H10 golden 八路径(端到端;legacy 三值+v2 band 方向双锁)', () => {
	it('① 直接入相成(三合 120°)', () => {
		const r = mkResult((x) => { x.aspects.normalAsp.Mars.Applicative.push({ id: 'Venus', asp: 120, orb: 2.0 }); });
		const j = judge(r);
		expect(j.perfection.method).toBe('application');
		expect(j.perfection.perfects).toBe(true);
		expect(j.verdict.leaning).toBe('yes');
		const v2 = judge(mkResult((x) => { x.aspects.normalAsp.Mars.Applicative.push({ id: 'Venus', asp: 120, orb: 2.0 }); }), { verdictProfile: 'v2' });
		expect(['strong_yes', 'lean_yes']).toContain(v2.verdict.band);
		expect(j.timing).toBeTruthy();
	});
	it('② 互容成(庙旺互容,receptionPerfection 档)', () => {
		const mk = () => mkResult((x) => { x.mutuals = { normal: [{ planetA: { id: 'Mars', rulerShip: ['ruler'] }, planetB: { id: 'Venus', rulerShip: ['exalt'] } }] }; });
		const j = judge(mk(), { receptionPerfection: true });
		expect(j.perfection.method).toBe('reception');
		expect(j.perfection.perfects).toBe(true);
		expect(j.verdict.leaning).toBe('yes');
		const v2 = judge(mk(), { receptionPerfection: true, verdictProfile: 'v2' });
		expect(['strong_yes', 'lean_yes']).toContain(v2.verdict.band);
	});
	it('③ 传递成(月亮离火入金)+应期=传递腿', () => {
		const mk = () => mkResult((x) => {
			x.aspects.normalAsp.Moon.Separative.push({ id: 'Mars', asp: 0, orb: 3.0 });
			x.aspects.normalAsp.Moon.Applicative.push({ id: 'Venus', asp: 120, orb: 1.5 });
		});
		const j = judge(mk());
		expect(j.perfection.method).toBe('translation');
		expect(j.perfection.translator).toBe('moon');
		expect(j.timing && j.timing.quantity).toBe(1.5);
		expect(j.verdict.leaning).toBe('yes');
	});
	it('④ 汇集成(两主同入相土星)+应期=较慢腿', () => {
		const mk = () => mkResult((x) => {
			x.aspects.normalAsp.Mars.Applicative.push({ id: 'Saturn', asp: 120, orb: 2.5 });
			x.aspects.normalAsp.Venus.Applicative.push({ id: 'Saturn', asp: 60, orb: 4.0 });
		});
		const j = judge(mk());
		expect(j.perfection.method).toBe('collection');
		expect(j.perfection.collector).toBe('saturn');
		expect(j.timing && j.timing.quantity).toBe(4.0);
		expect(j.verdict.leaning).toBe('yes');
	});
	it('⑤ 月亮升格径成(moonPromotion apply:主径无完成+命主无力+月径成)', () => {
		const mk = () => mkResult((x) => {
			const mars = x.chart.objects.find((o) => o.id === 'Mars');
			Object.assign(mars, { selfDignity: ['exile'], lon: 100, sign: 'Cancer', signlon: 10, house: 'House4' });
			x.aspects.normalAsp.Moon.Applicative.push({ id: 'Venus', asp: 120, orb: 2.0 });
		});
		const j = judge(mk(), { moonPromotion: 'apply' });
		expect(j.perfection.viaMoonPromotion).toBe(true);
		expect(j.perfection.perfects).toBe(true);
		expect(j.timing).toBeTruthy();
		// 缺省 note 档:主径不成(对照)
		const jn = judge(mk(), {});
		expect(jn.perfection.viaMoonPromotion).toBeUndefined();
		expect(jn.perfection.perfects).toBe(false);
	});
	it('⑥ 禁阻破(水星抢先入相金星)', () => {
		const mk = () => mkResult((x) => {
			x.aspects.normalAsp.Mars.Applicative.push({ id: 'Venus', asp: 120, orb: 3.0 });
			x.aspects.normalAsp.Mercury.Applicative.push({ id: 'Venus', asp: 60, orb: 0.5 });
		});
		const j = judge(mk());
		expect(j.perfection.destroyed).toBe(true);
		expect(j.perfection.destruction).toBe('prohibition');
		expect(j.verdict.leaning).toBe('no');
		const v2 = judge(mk(), { verdictProfile: 'v2' });
		expect(['lean_no', 'strong_no']).toContain(v2.verdict.band);
	});
	it('⑦ 破而得救(禁阻+月亮传递,rescueAfterDestruction)', () => {
		const mk = () => mkResult((x) => {
			x.aspects.normalAsp.Mars.Applicative.push({ id: 'Venus', asp: 120, orb: 3.0 });
			x.aspects.normalAsp.Mercury.Applicative.push({ id: 'Venus', asp: 60, orb: 0.5 });
			x.aspects.normalAsp.Moon.Separative.push({ id: 'Mars', asp: 0, orb: 2.0 });
			x.aspects.normalAsp.Moon.Applicative.push({ id: 'Venus', asp: 60, orb: 1.8 });
		});
		const j = judge(mk(), { rescueAfterDestruction: true });
		expect(j.perfection.perfects).toBe(true);
		expect(j.perfection.overrodeDestruction).toBe('prohibition');
		expect(j.verdict.leaning).toBe('yes');
		// 缺省档:破坏保持+rescue 记录(对照)
		const jd = judge(mk(), {});
		expect(jd.perfection.destroyed).toBe(true);
		expect(jd.perfection.rescue && jd.perfection.rescue.method).toBe('translation');
	});
	it('⑧ 势均(无完成无破坏+两主中性)→ legacy even/v2 未定带', () => {
		// 基础盘两主庙+角宫偏正(首版就地取材被 legacy 判 yes)——真势均须剥尊贵/出角宫。
		const neutral = () => mkResult((x) => {
			const mars = x.chart.objects.find((o) => o.id === 'Mars');
			const venus = x.chart.objects.find((o) => o.id === 'Venus');
			Object.assign(mars, { selfDignity: [], house: 'House2' });
			Object.assign(venus, { selfDignity: [], house: 'House2' });
		});
		const j = judge(neutral(), { antiscia: false });
		expect(j.perfection.perfects).toBe(false);
		expect(j.perfection.destroyed).toBe(false);
		expect(j.verdict.leaning).toBe('even');
		const v2 = judge(neutral(), { antiscia: false, verdictProfile: 'v2' });
		expect(['uncertain', 'lean_yes', 'lean_no']).toContain(v2.verdict.band);
	});
});
