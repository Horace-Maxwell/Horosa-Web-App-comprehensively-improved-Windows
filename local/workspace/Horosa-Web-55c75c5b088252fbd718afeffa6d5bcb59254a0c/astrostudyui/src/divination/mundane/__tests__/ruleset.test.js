// #54-H：世运盘规则集「界/三分/容许度/食时窗」语义接线测试。
// 验证 termsVariant / triplicityVariant / orbScheme / eclipseTiming 四键真正改变计算(不再名义多流派),
// 且默认档(modern)=现状(零回归)。世运盘=PUBLIC,数据中性。
import { MUNDANE_RULESETS, MUNDANE_RULESET_DEFAULT, rulesetConfig } from '../ruleset';
import { describeMundaneVictor, describeEclipseAfflictions } from '../describe';
import { termRulerAt, triplicityRulers, EGYPTIAN_TERMS, PTOLEMAIC_TERMS, TRIPLICITY, PTOLEMAIC_TRIPLICITY } from '../../data/dignities';
import { computeAlmuten } from '../../lifespan/lifespanEngine';

describe('mundane ruleset · 数据底座', () => {
	it('四档规则集齐备 + 默认 modern', () => {
		expect(MUNDANE_RULESETS.map((r) => r.key)).toEqual(['ptolemaic', 'medieval', 'modern', 'barbault']);
		expect(MUNDANE_RULESET_DEFAULT).toBe('modern');
	});

	it('四语义键在各档取值符合预期(零回归基准)', () => {
		const modern = rulesetConfig('modern');
		expect(modern.termsVariant).toBe('egyptian');
		expect(modern.triplicityVariant).toBe('dorothean');
		expect(modern.orbScheme).toBe('by_aspect');
		expect(modern.eclipseTiming).toBe('ptolemy_hours');
		const barbault = rulesetConfig('barbault');
		expect(barbault.eclipseTiming).toBe('none');           // 周期派不采食时长定则
		const ptol = rulesetConfig('ptolemaic');
		expect(ptol.orbScheme).toBe('moiety');                  // 古典 moiety 容许度
		// 未知键 → 归一化为默认 modern(零回归)。
		expect(rulesetConfig('zzz').key).toBe('modern');
		expect(rulesetConfig(undefined).key).toBe('modern');
	});

	it('托勒密界 vs 埃及界:同度异主(aries 12° = mercury→venus)', () => {
		// 埃及界 aries 12-20=mercury;托勒密界 aries 6-14=venus。
		expect(termRulerAt(12)).toBe('mercury');                 // 默认=埃及界(零回归)
		expect(termRulerAt(12, 'egyptian')).toBe('mercury');
		expect(termRulerAt(12, 'ptolemaic')).toBe('venus');      // 切托勒密界换主
		expect(PTOLEMAIC_TERMS.aries.length).toBe(5);
		expect(EGYPTIAN_TERMS.aries.length).toBe(5);
	});

	it('托勒密三分 vs 多罗修斯三分:水象日主异(venus→mars)且无共用主星', () => {
		expect(triplicityRulers('water').day).toBe('venus');     // 默认=多罗修斯(零回归)
		expect(triplicityRulers('water', 'dorothean').day).toBe('venus');
		expect(triplicityRulers('water', 'ptolemaic').day).toBe('mars');  // 托勒密水象昼夜均火星
		expect(triplicityRulers('water', 'ptolemaic').participating).toBe(null);
		expect(TRIPLICITY.water.participating).toBe('moon');     // 多罗修斯有共用主星
		expect(PTOLEMAIC_TRIPLICITY.water.night).toBe('mars');
	});
});

// 让太阳落指定度(界主/三分主取该度)→ computeAlmuten 的界主/三分主累分应随变体改变。
// meta 只给 sect(不给 asc,避免 asc 也落同度重复计分,使 delta = 单点界值/三分值,断言更直观)。
function factsAt(lon, sign){
	return {
		meta: { sect: 'day' },
		houses: {},
		planets: {
			sun: { lon, sign, signlon: lon % 30, house: 1, angularity: 'angular' },
		},
	};
}

describe('mundane victor · termsVariant/triplicityVariant 接线', () => {
	const score = (v, p) => { const r = v.scores.find((s) => s.planet === p); return r ? r.score : 0; };

	it('默认 victor 基分 = 不传变体(零回归);终分 = 基分 + 偶然层(G6 分层可稽)', () => {
		const facts = factsAt(12, 'aries');
		const def = describeMundaneVictor(facts);                // 默认 modern
		const none = computeAlmuten(facts);                      // 引擎默认(无变体)
		expect(def).toBeTruthy();
		// modern=egyptian/dorothean → 与引擎默认表同口径:基分逐星一致(computeAlmuten 零污染锚);
		// [G6] 终分 = 基分 + 偶然增减(当令/焦伤/逆行/被围攻),明细逐项可稽。
		['mercury', 'venus', 'mars', 'sun', 'jupiter', 'saturn', 'moon'].forEach((p) => {
			const row = def.scores.find((s) => s.planet === p);
			const base = row ? row.base : 0;
			const acc = row ? row.accidental : 0;
			expect(base).toBe(none.totals[p] || 0);
			expect(score(def, p)).toBe(base + acc);
		});
		// 本 stub 昼盘(默认 sect=day?) → 太阳若得时应有 +3 当令明细;无状态星零明细。
		const sunRow = def.scores.find((s) => s.planet === 'sun');
		if(sunRow && sunRow.accidental !== 0){
			expect(sunRow.accidentalItems.length).toBeGreaterThan(0);
		}
	});

	it('[G6] 偶然层:焦伤/逆行显著降格,可令胜者易主', () => {
		const facts = factsAt(12, 'aries');
		// mercury 为白羊 12° 埃及界主(基分领先);给它焦伤+逆行 → −10,胜者应易主。
		facts.planets.mercury = { lon: 8, sign: 'aries', signlon: 8, house: 1, combustion: 'combust', retro: true };
		const v = describeMundaneVictor(facts);
		const merc = v.scores.find((s) => s.planet === 'mercury');
		expect(merc.accidental).toBeLessThanOrEqual(-10);
		expect(merc.accidentalItems.map((i) => i.cn)).toEqual(expect.arrayContaining(['焦伤', '逆行']));
	});

	it('切档真换 victor 输入:中世纪档(托勒密界)vs 现代档(埃及界) → 界主 mercury↔venus 累分此消彼长', () => {
		// 验证规则集层真生效:medieval.termsVariant='ptolemaic'、modern='egyptian'(默认)。
		expect(rulesetConfig('medieval').termsVariant).toBe('ptolemaic');
		expect(rulesetConfig('modern').termsVariant).toBe('egyptian');
		const facts = factsAt(12, 'aries');                      // 太阳落白羊 12°
		const modern = describeMundaneVictor(facts, 'modern');   // 埃及界:界主=mercury(+2)
		const med = describeMundaneVictor(facts, 'medieval');    // 托勒密界:界主=venus(+2)
		// 切中世纪档:水星少得界分 2、金星多得界分 2(其余星不变 → 守恒)。
		expect(score(modern, 'mercury') - score(med, 'mercury')).toBe(2);
		expect(score(med, 'venus') - score(modern, 'venus')).toBe(2);
		expect(score(modern, 'mars')).toBe(score(med, 'mars'));   // 无关星零变
	});

	it('triplicityVariant 换表生效:托勒密三分水象日主 venus→mars(直接传变体,守恒)', () => {
		// 三分变体函数级验证(规则集四档目前皆 dorothean → 此处直传 ptolemaic 证换表打通,供日后档位选用)。
		const facts = factsAt(95, 'cancer');                     // 太阳落巨蟹(水象)5°;界主两表同为 mars(排除界干扰)
		const dor = computeAlmuten(facts, { triplicityVariant: 'dorothean' });   // 水象日主=venus(+3)
		const pto = computeAlmuten(facts, { triplicityVariant: 'ptolemaic' });   // 水象日主=mars(+3)
		expect((dor.totals.venus || 0) - (pto.totals.venus || 0)).toBe(3);
		expect((pto.totals.mars || 0) - (dor.totals.mars || 0)).toBe(3);
	});
});

describe('mundane eclipse · orbScheme/eclipseTiming 接线', () => {
	// 食点(太阳)与某行星成相位,距相位角 2.5°:by_aspect(≤3)命中、moiety(≤2)不命中。
	function eclipseFacts(){
		return {
			meta: { sect: 'day' },
			houses: {},
			planets: {
				sun: { lon: 0, sign: 'aries', signlon: 0, house: 1, angularity: 'angular' },
				mars: { lon: 2.5, sign: 'aries', signlon: 2.5, house: 1 },   // 合相 orb 2.5°
				saturn: { lon: 91.5, sign: 'cancer', signlon: 1.5, house: 4 }, // 刑相 orb 1.5°
			},
		};
	}

	it('默认(by_aspect ≤3°)命中合相 2.5°(零回归)', () => {
		const facts = eclipseFacts();
		const aff = describeEclipseAfflictions(facts, 'solar');   // 不传 → by_aspect
		expect(aff.maxOrb).toBe(3);
		expect(aff.afflictors.some((a) => a.planet === 'mars')).toBe(true);
	});

	it('moiety(≤2°)收紧:剔除 2.5° 的合相、保留 1.5° 的刑相', () => {
		const facts = eclipseFacts();
		const aff = describeEclipseAfflictions(facts, 'solar', 'moiety');
		expect(aff.maxOrb).toBe(2);
		expect(aff.afflictors.some((a) => a.planet === 'mars')).toBe(false);   // 2.5° 被剔除
		expect(aff.afflictors.some((a) => a.planet === 'saturn')).toBe(true);  // 1.5° 保留
	});

	it('by_aspect 命中数 ≥ moiety 命中数(收紧只减不增)', () => {
		const facts = eclipseFacts();
		const wide = describeEclipseAfflictions(facts, 'solar', 'by_aspect');
		const tight = describeEclipseAfflictions(facts, 'solar', 'moiety');
		expect(wide.afflictors.length).toBeGreaterThanOrEqual(tight.afflictors.length);
	});

	it('eclipseTiming:周期派=none、其余=ptolemy_hours(UI 据此示/隐食时长定则)', () => {
		expect(rulesetConfig('barbault').eclipseTiming).toBe('none');
		expect(rulesetConfig('ptolemaic').eclipseTiming).toBe('ptolemy_hours');
		expect(rulesetConfig('modern').eclipseTiming).toBe('ptolemy_hours');
	});
});
