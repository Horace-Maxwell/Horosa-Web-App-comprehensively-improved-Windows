// [卜卦改进 H4b] 后端金矿门控消费——backendConditionNotes 开关(default false=现状零回归;
// renaissance/medieval 学理绑定 true)。真形 fixture 上验判别力:
// ①默认关:单星证词与旧行为字节同构(无 station/degree_quality/benign 键)
// ②开:留驻/度性/特殊度注记+围荣围耀正面证词入 findings
// ③临留驻('S')入相方 → refranationRisk 精化(门控)
// ④流派绑定:renaissance/medieval 档 judge 值=true,classical=false(spec default)
import { buildFacts } from '../../engine/chartFacts';
import { planetCondition } from '../../engine/conditions';
import { analyzePerfection } from '../../engine/perfection';
import { HORARY_SCHOOLS, HORARY_PARAM_BY_KEY } from '../horarySchools';

const realResult = require('../../engine/__tests__/fixtures/realChartResult.json');
function freshReal(){ return JSON.parse(JSON.stringify(realResult)); }

describe('H4b backendConditionNotes 门控', () => {
	it('默认关:findings 无 H4b 新键(零回归自证)', () => {
		const f = buildFacts(freshReal(), {});
		Object.keys(f.planets).forEach((k) => {
			const c = planetCondition(k, f, {});
			const keys = c.findings.map((x) => x.key);
			['station', 'degree_quality', 'special_degree', 'benign_vj', 'benign_sm'].forEach((nk) => {
				expect(keys).not.toContain(nk);
			});
		});
	});

	it('开:真形 fixture 上至少一星出度性/留驻/围荣类注记(判别力自证)', () => {
		const f = buildFacts(freshReal(), {});
		const hitKeys = new Set();
		Object.keys(f.planets).forEach((k) => {
			const c = planetCondition(k, f, { backendConditionNotes: true });
			c.findings.forEach((x) => hitKeys.add(x.key));
		});
		const newKinds = ['station', 'degree_quality', 'special_degree', 'benign_vj', 'benign_sm'];
		expect(newKinds.some((nk) => hitKeys.has(nk))).toBe(true);
	});

	it('临留驻入相方 → refranationRisk(门控;关=无)', () => {
		function mk(station){
			const slot = () => ({ Applicative: [], Separative: [], Exact: [], None: [], Obvious: [] });
			const f = {
				planets: {
					mars: { key: 'mars', chartId: 'Mars', lon: 15, sign: 'aries', signlon: 15, house: 1, speed: 0.6, retro: false, combustion: null, stationState: station },
					venus: { key: 'venus', chartId: 'Venus', lon: 135, sign: 'leo', signlon: 15, house: 5, speed: 1.1, retro: false, combustion: null },
				},
				houses: {}, lons: {},
				result: { aspects: { normalAsp: { Mars: slot(), Venus: slot() } }, receptions: {}, mutuals: {}, surround: null, chart: {} },
			};
			f.result.aspects.normalAsp.Mars.Applicative.push({ id: 'Venus', asp: 120, orb: 2.0 });
			return f;
		}
		const off = analyzePerfection(mk('S'), 'mars', 'venus', {});
		expect(off.refranationRisk).toBeUndefined();
		const on = analyzePerfection(mk('S'), 'mars', 'venus', { backendConditionNotes: true });
		expect(on.refranationRisk).toBe(true);
		expect(on.perfects).toBe(true);   // 风险注记不改完成判定
		const onD = analyzePerfection(mk('D'), 'mars', 'venus', { backendConditionNotes: true });
		expect(onD.refranationRisk).toBeUndefined();   // 回顺('D')非风险
	});

	it('流派绑定:renaissance/medieval=true;classical=spec default(false)', () => {
		expect(HORARY_PARAM_BY_KEY.backendConditionNotes.default).toBe(false);
		expect(HORARY_SCHOOLS.renaissance.judge.backendConditionNotes).toBe(true);
		expect(HORARY_SCHOOLS.medieval.judge.backendConditionNotes).toBe(true);
		expect(HORARY_SCHOOLS.classical.judge.backendConditionNotes).toBe(false);
	});
});
