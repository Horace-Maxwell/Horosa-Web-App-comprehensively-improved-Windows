// 批1 数据层单测：平均日行度 / 偶然尊贵满分表 / 点集核心15 / 恒星星等轨 / 自然象征星。
// 文档锚：平均日行度 04§6.1；满分表 03§10；点集 04§7.2-7.3；恒星 04§9；自然象征 05§4.3。
import { MEAN_DAILY_MOTION, motionRateOf } from '../planets';
import { scoreAccidental, ACCIDENTAL_HOUSE_SCORES, isPartile } from '../accidentalDignity';
import { LOTS, LOTS_SETS, computeLotsSet, computeLot } from '../lots';
import { FIXED_STARS, starOrbFor, starLonAt } from '../fixedStars';
import { NATURAL_SIGNIFICATORS, fatherSignificator } from '../naturalSignificators';

describe('WP1.1 平均日行度表与迅疾/迟缓', () => {
	test('七行星均值=文档 04§6.1(日水金同值)', () => {
		expect(MEAN_DAILY_MOTION).toEqual({
			moon: 13.1767, mercury: 0.98556, venus: 0.98556, sun: 0.98556,
			mars: 0.52417, jupiter: 0.08306, saturn: 0.03361,
		});
	});
	test('swift/slow 边界:严格大于为疾、严格小于为缓、恰等为 null', () => {
		expect(motionRateOf('moon', 13.5)).toBe('swift');
		expect(motionRateOf('moon', 12.0)).toBe('slow');
		expect(motionRateOf('moon', 13.1767)).toBe(null);
		expect(motionRateOf('saturn', -0.05)).toBe('swift'); // 逆行以 |速度| 比较(逆行另列 −5)
		expect(motionRateOf('saturn', 0.01)).toBe('slow');
		expect(motionRateOf('north_node', 0.05)).toBe(null); // 无均值表项
		expect(motionRateOf('moon', null)).toBe(null);
	});
	test('水金均值可经 meanTable 覆盖(地心争议档)', () => {
		expect(motionRateOf('mercury', 1.2)).toBe('swift');
		expect(motionRateOf('mercury', 1.2, { meanTable: { mercury: 1.4 } })).toBe('slow');
	});
});

// ── 合成 facts 工具（最小充分结构）──
function makeFacts(planetPatch, extra){
	const base = {
		meta: { isDiurnal: true, moonPhase: { phase: 'waxing' } },
		planets: {
			sun: { key: 'sun', lon: 100, signlon: 10, house: 9, retro: false, speed: 0.98556 },
			moon: { key: 'moon', lon: 200, signlon: 20, house: 11, retro: false, speed: 13.5, combustion: null, orientality: 'occidental' },
			venus: { key: 'venus', lon: 15.4, signlon: 15.4, house: 10, retro: false, speed: 1.1, combustion: null, orientality: 'occidental' },
			saturn: { key: 'saturn', lon: 250, signlon: 10, house: 12, retro: true, speed: -0.02, combustion: 'combust', orientality: 'occidental' },
			jupiter: { key: 'jupiter', lon: 15.8, signlon: 15.8, house: 1, retro: false, speed: 0.09, combustion: null, orientality: 'oriental' },
			mars: { key: 'mars', lon: 40, signlon: 10, house: 6, retro: false, speed: 0.6, combustion: null, orientality: 'oriental' },
			mercury: { key: 'mercury', lon: 98, signlon: 8, house: 9, retro: false, speed: 1.6, combustion: 'under_beams', orientality: 'oriental' },
		},
		houses: {},
		lons: {},
		result: { params: { birth: '2000-06-01' }, aspects: { normalAsp: {} }, surround: null },
	};
	if(planetPatch){ Object.keys(planetPatch).forEach((k) => { base.planets[k] = { ...base.planets[k], ...planetPatch[k] }; }); }
	if(extra){ Object.assign(base.result, extra); }
	return base;
}

describe('WP1.2 偶然尊贵满分表(±38)', () => {
	test('宫位定分表=文档 03§10', () => {
		expect(ACCIDENTAL_HOUSE_SCORES).toEqual({ 1: 5, 10: 5, 7: 4, 4: 4, 11: 4, 2: 3, 5: 3, 9: 2, 3: 1, 12: -5, 8: -2, 6: -2 });
	});
	test('木星(1宫顺行东出迅疾脱日):+5宫 +4顺 +2疾 +2东出 +5脱日 = +18', () => {
		const facts = makeFacts();
		const r = scoreAccidental('jupiter', facts, {});
		const byKey = {}; r.items.forEach((it) => { byKey[it.key] = it.score; });
		expect(byKey.house).toBe(5);
		expect(byKey.direct).toBe(4);
		expect(byKey.swift).toBe(2);
		expect(byKey.orientality).toBe(2);
		expect(byKey.free_of_sun).toBe(5);
		expect(r.total).toBe(18);
	});
	test('土星(12宫逆行迟缓西入燃烧):−5宫 −5逆 −2缓 −2西入 −5燃 = −19', () => {
		const r = scoreAccidental('saturn', makeFacts(), {});
		expect(r.total).toBe(-19);
	});
	test('☿♀组西入得分、月以渐盈计;日不判太阳三态', () => {
		const facts = makeFacts();
		const v = scoreAccidental('venus', facts, {});
		expect(v.items.find((x) => x.key === 'orientality').score).toBe(2); // 金星西入 +2
		const m = scoreAccidental('moon', facts, {});
		expect(m.items.find((x) => x.key === 'moon_phase').score).toBe(2);  // 渐盈 +2
		const s = scoreAccidental('sun', facts, {});
		expect(s.items.find((x) => x.key === 'free_of_sun')).toBeUndefined();
	});
	test('partile 合吉星 +5(1647 同整数度口径)与 le1/le3 口径分流', () => {
		const facts = makeFacts(null, { aspects: { normalAsp: { Venus: { Exact: [{ id: 'Jupiter', asp: 0, orb: 0.4 }], Applicative: [], Separative: [] } } } });
		const r = scoreAccidental('venus', facts, { partileDef: 'same_degree' });
		expect(r.items.find((x) => x.key === 'partile_conj_benefic').score).toBe(5);
		// signlon 整数度不同(15 vs 16)→ same_degree 不算 partile
		const facts2 = makeFacts({ jupiter: { signlon: 16.2 } }, { aspects: { normalAsp: { Venus: { Exact: [{ id: 'Jupiter', asp: 0, orb: 0.9 }], Applicative: [], Separative: [] } } } });
		expect(scoreAccidental('venus', facts2, { partileDef: 'same_degree' }).items.find((x) => x.key === 'partile_conj_benefic')).toBeUndefined();
		expect(scoreAccidental('venus', facts2, { partileDef: 'le1' }).items.find((x) => x.key === 'partile_conj_benefic').score).toBe(5);
	});
	test('王者/凶恒星合相:Regulus+6 / Algol−4(按年岁差)', () => {
		const reg = FIXED_STARS.find((s) => s.name_en === 'Regulus');
		const lonNow = starLonAt(reg.lon_1995, 2000);
		const facts = makeFacts({ venus: { lon: lonNow, combustion: null } });
		const r = scoreAccidental('venus', facts, {});
		expect(r.items.find((x) => x.key === 'conj_regulus').score).toBe(6);
		const algol = FIXED_STARS.find((s) => s.name_en === 'Algol');
		const facts2 = makeFacts({ venus: { lon: starLonAt(algol.lon_1995, 2000) } });
		expect(scoreAccidental('venus', facts2, {}).items.find((x) => x.key === 'conj_algol').score).toBe(-4);
	});
	test('围攻 besieged −4(读 surround.attacks)', () => {
		const facts = makeFacts({ venus: { chartId: 'Venus' } }, { surround: { attacks: ['Venus'] } });
		expect(scoreAccidental('venus', facts, {}).items.find((x) => x.key === 'besieged').score).toBe(-4);
	});
	test('isPartile 三口径独立可判', () => {
		const facts = makeFacts();
		expect(isPartile(facts, 'venus', 'jupiter', { orb: 0.4 }, 'same_degree')).toBe(true);
		expect(isPartile(facts, 'venus', 'jupiter', { orb: 2.5 }, 'le3')).toBe(true);
		expect(isPartile(facts, 'venus', 'jupiter', { orb: 2.5 }, 'le1')).toBe(false);
	});
});

describe('WP1.3 阿拉伯点核心15', () => {
	const LONS = { asc: 100, sun: 10, moon: 70, mercury: 30, venus: 50, mars: 90, jupiter: 140, saturn: 200, eighth: 310, fortune: 160, spirit: 40 };
	test('LOTS_SETS: minimal=现行为双点;core15 含 16 键且全部有定义', () => {
		expect(LOTS_SETS.minimal).toEqual(['fortune', 'spirit']);
		expect(LOTS_SETS.core15.length).toBe(16);
		LOTS_SETS.core15.forEach((k) => expect(LOTS[k]).toBeTruthy());
	});
	test('爱欲点(主流式)=Asc+Spirit−Fortune;夜盘反转', () => {
		const day = computeLotsSet(LONS, true, ['eros'])[0];
		expect(day.lon).toBe(((100 + 40 - 160) % 360 + 360) % 360);
		const night = computeLotsSet(LONS, false, ['eros'])[0];
		expect(night.lon).toBe(((100 + 160 - 40) % 360 + 360) % 360);
	});
	test('父亲点夜盘反转、兄弟点昼夜同式、死亡点以八宫头为基', () => {
		expect(computeLotsSet(LONS, false, ['father'])[0].lon).toBe(((100 + 200 - 10) % 360 + 360) % 360);
		expect(computeLotsSet(LONS, true, ['brethren'])[0].lon).toBe(computeLotsSet(LONS, false, ['brethren'])[0].lon);
		expect(computeLotsSet(LONS, true, ['death'])[0].lon).toBe(((310 + 200 - 70) % 360 + 360) % 360);
	});
	test('婚姻点男女成对镜像;子女点(通行式)=Asc+♄−♃ 昼夜同式', () => {
		const men = computeLotsSet(LONS, true, ['marriageMen'])[0].lon;
		const women = computeLotsSet(LONS, true, ['marriageWomen'])[0].lon;
		expect(men).toBe(((100 + 50 - 200) % 360 + 360) % 360);
		expect(women).toBe(((100 + 200 - 50) % 360 + 360) % 360);
		expect(computeLotsSet(LONS, false, ['childrenDor'])[0].lon).toBe(((100 + 200 - 140) % 360 + 360) % 360);
	});
	test('既有五点定义零变(fortune/spirit/marriage/children/death 键与公式原样)', () => {
		expect(LOTS.fortune.day).toEqual(['asc', 'moon', 'sun']);
		expect(LOTS.spirit.night).toEqual(['asc', 'moon', 'sun']);
		expect(LOTS.marriage.day).toEqual(['asc', 'venus', 'saturn']);
		expect(LOTS.children.day).toEqual(['asc', 'jupiter', 'saturn']);
		expect(LOTS.death.day).toEqual(['eighth', 'saturn', 'moon']);
		expect(computeLot(LOTS.fortune.day, LONS)).toBe(160);
	});
});

describe('WP1.4 恒星补齐与按星等轨', () => {
	test('文档 04§9.1 六颗补星在位且带星等', () => {
		['Praesepe', 'Alphard', 'Zosma', 'Aculeus', 'Acumen', 'Facies'].forEach((en) => {
			const st = FIXED_STARS.find((s) => s.name_en === en);
			expect(st).toBeTruthy();
			expect(typeof st.magnitude).toBe('number');
		});
	});
	test('四王者之星标识齐(毕宿五/轩辕十四/心宿二/北落师门)', () => {
		expect(FIXED_STARS.filter((s) => s.isRoyal).map((s) => s.name_en).sort())
			.toEqual(['Aldebaran', 'Antares', 'Fomalhaut', 'Regulus']);
	});
	test('school 平轨=既有行为(缺省1°/显式取值);byMagnitude 按 Robson 分档、王者封顶 5°', () => {
		const spica = FIXED_STARS.find((s) => s.name_en === 'Spica');       // 1.0 等
		const scheat = FIXED_STARS.find((s) => s.name_en === 'Scheat');     // 2.4 等
		const zosma = FIXED_STARS.find((s) => s.name_en === 'Zosma');       // 2.6 等
		const aculeus = FIXED_STARS.find((s) => s.name_en === 'Aculeus');   // 4.2 等
		const regulus = FIXED_STARS.find((s) => s.name_en === 'Regulus');   // 王者 1.4 等
		expect(starOrbFor(spica, {})).toBe(1);
		expect(starOrbFor(spica, { fixedStarOrb: 2 })).toBe(2);
		expect(starOrbFor(spica, { fixedStarOrbMode: 'byMagnitude' })).toBe(7.5);
		expect(starOrbFor(scheat, { fixedStarOrbMode: 'byMagnitude' })).toBe(5.5);
		expect(starOrbFor(zosma, { fixedStarOrbMode: 'byMagnitude' })).toBeCloseTo(3 + 40 / 60, 5);
		expect(starOrbFor(aculeus, { fixedStarOrbMode: 'byMagnitude' })).toBe(1.5);
		expect(starOrbFor(regulus, { fixedStarOrbMode: 'byMagnitude' })).toBe(5);
	});
});

describe('WP1.6 自然象征星表', () => {
	test('七曜齐全且父亲按 sect 分流', () => {
		expect(Object.keys(NATURAL_SIGNIFICATORS).sort())
			.toEqual(['jupiter', 'mars', 'mercury', 'moon', 'saturn', 'sun', 'venus']);
		expect(NATURAL_SIGNIFICATORS.jupiter.persons).toContain('律师与法官');
		expect(fatherSignificator(true)).toBe('sun');
		expect(fatherSignificator(false)).toBe('saturn');
	});
});
