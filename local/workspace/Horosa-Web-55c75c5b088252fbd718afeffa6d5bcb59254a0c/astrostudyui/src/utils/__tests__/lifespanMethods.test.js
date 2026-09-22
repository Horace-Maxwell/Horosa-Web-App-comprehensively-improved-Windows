// 寿命取主法(托勒密/阿尔卡比修斯/多罗修斯)算法分歧验证。
// 目的:证明三法在「应当分歧」的盘上确实给出不同生命主(Hyleg),而在「应当一致」的盘上相同。
// 分歧机理(见 lifespanEngine APHETIC_RULES):
//   - 多罗修斯 useGenderQuadrant:昼太阳须落阳性座,否则 effeminatus 否决 → 改取它点。
//   - 阿尔卡比修斯 houses 含第 8 宫(托/多无);第 7/8/9 宫须星座性别合宗派。
import { runLifespan } from '../../divination/lifespan/lifespanEngine';

// 行星点工厂:lon/座(小写)/座内度/宫;其余状态字段给默认值,避免聚合卡崩。
const P = (lon, sign, signlon, house) => ({
	lon, sign, signlon, house,
	combustion: null, retro: false, hayyiz: null, orientality: null, dignityScore: 0,
});

function mkHouses(){
	const h = {};
	for(let i = 1; i <= 12; i++){ h[i] = { lon: (i - 1) * 30, sign: 'aries', ruler: 'mars', planets: [] }; }
	return h;
}

// 基础昼盘 facts(七政齐备);各用例覆写关键点。
function baseFacts(){
	return {
		meta: { sect: 'day', isDiurnal: true, moonPhase: { phase: 'waxing' }, ascLon: 130, ascSign: 'leo', ascDegree: 10 },
		houses: mkHouses(),
		planets: {
			sun: P(45, 'taurus', 15, 10),
			moon: P(200, 'libra', 20, 3),
			mercury: P(50, 'taurus', 20, 10),
			venus: P(35, 'taurus', 5, 9),
			mars: P(250, 'sagittarius', 10, 5),
			jupiter: P(125, 'leo', 5, 1),
			saturn: P(310, 'aquarius', 10, 7),
			fortune: P(65, 'gemini', 5, 11),
		},
	};
}

function hylegKey(facts, method){
	const r = runLifespan(facts, { method });
	return r && r.hyleg ? r.hyleg.key : null;
}

describe('寿命取主法 算法分歧', () => {
	test('多罗修斯 effeminatus:昼太阳落阴性座(金牛,10宫) → 多罗弃日取上升,托/阿仍取日', () => {
		const f = baseFacts(); // 太阳金牛(阴性)10宫,上升狮子1宫
		const pt = hylegKey(f, 'ptolemy');
		const al = hylegKey(f, 'alcabitius');
		const dor = hylegKey(f, 'dorotheus');
		expect(pt).toBe('sun');        // 托勒密:太阳10宫为释放位
		expect(al).toBe('sun');        // 阿尔卡比修斯:10宫无性别约束,同取日
		expect(dor).toBe('asc');       // 多罗修斯:太阳落阴性座被否决 → 顺取上升
		expect(dor).not.toBe(pt);      // 确有分歧
	});

	test('阿尔卡比修斯第8宫:昼太阳落阳性座(白羊,8宫) → 阿取日,托/多取上升', () => {
		const f = baseFacts();
		f.planets.sun = P(10, 'aries', 10, 8);   // 太阳白羊(阳性)第8宫
		f.planets.mercury = P(12, 'aries', 12, 8);
		const pt = hylegKey(f, 'ptolemy');
		const al = hylegKey(f, 'alcabitius');
		const dor = hylegKey(f, 'dorotheus');
		expect(al).toBe('sun');        // 阿尔卡比修斯:第8宫为释放位 + 白羊阳性合昼日 → 取日
		expect(pt).toBe('asc');        // 托勒密:第8宫非释放位 → 顺取上升
		expect(dor).toBe('asc');       // 多罗修斯:同托勒密第8宫非释放位
		expect(al).not.toBe(pt);       // 确有分歧
	});

	test('三法一致:候选点皆落 1/3/4/10 宫(无8宫、无性别冲突) → Hyleg 相同', () => {
		const f = baseFacts();
		// 太阳落阳性座+角宫,三法皆取之(无分歧条件)
		f.planets.sun = P(125, 'leo', 5, 10);    // 狮子(阳性)10宫
		const pt = hylegKey(f, 'ptolemy');
		const al = hylegKey(f, 'alcabitius');
		const dor = hylegKey(f, 'dorotheus');
		expect(pt).toBe('sun');
		expect(al).toBe('sun');
		expect(dor).toBe('sun');       // 阳性座→多罗不否决;非7/8/9宫→阿无性别约束;皆取日
	});

	// [Q-552/T-514] 多罗修斯「阴阳星座 × 阴阳象限双合」:象限一支此前未实现。阳性象限=升点→天顶(10/11/12 宫)、降点→天底(4/5/6 宫)。
	test('多罗修斯象限双合:昼太阳落阳性座但阴性象限(狮子,7宫) → 多罗否决取上升;托勒密仍取日', () => {
		const f = baseFacts();
		f.planets.sun = P(125, 'leo', 5, 7);     // 狮子(阳性座)但第 7 宫属阴性象限(天顶→降点)
		expect(hylegKey(f, 'ptolemy')).toBe('sun');
		expect(hylegKey(f, 'dorotheus')).toBe('asc');
		const r = runLifespan(f, { method: 'dorotheus' });
		const sunRow = r.candidates.find((c) => c.key === 'sun');
		expect(sunRow.aphetic).toBe(false);
		expect(sunRow.reason).toMatch(/阴性象限/);
		// 阳性座 + 阳性象限(11 宫)→ 双合通过
		f.planets.sun = P(125, 'leo', 5, 11);
		expect(hylegKey(f, 'dorotheus')).toBe('sun');
	});
});
