// Saros 食族 golden:周期常量 + 交点性质判定 + 文档缺口 TODO 自证。
import { SAROS_CONST, SAROS_LIFECYCLE, sarosNodeType, describeSarosFamily, SAROS_TABLE_TODO } from '../../divination/mundane/saros';

describe('Saros 周期常量(古籍数据)', () => {
	test('Saros=223 朔望月=6585.32 日;Metonic 19y=235;Inex 358≈10571.95 日', () => {
		expect(SAROS_CONST.sarosSynodicMonths).toBe(223);
		expect(SAROS_CONST.sarosDays).toBeCloseTo(6585.32, 2);
		expect(SAROS_CONST.metonicYears).toBe(19);
		expect(SAROS_CONST.metonicSynodicMonths).toBe(235);
		expect(SAROS_CONST.inexSynodicMonths).toBe(358);
		expect(SAROS_CONST.inexDays).toBeCloseTo(10571.95, 2);
	});
	test('族生命周期:71–73 员/早中晚三段', () => {
		expect(SAROS_LIFECYCLE.membersRange).toEqual([71, 73]);
		expect(SAROS_LIFECYCLE.phases).toHaveLength(3);
	});
});

describe('sarosNodeType · 交点性质(北/南按交点非地理)', () => {
	const facts = (moonLon, nnLon) => ({ planets: { moon: { lon: moonLon }, north_node: { lon: nnLon } } });
	test('月近北交 → North;月近南交 → South;等距边界 90° 归 North', () => {
		expect(sarosNodeType(facts(10, 15)).type).toBe('north');
		expect(sarosNodeType(facts(200, 15)).type).toBe('south');
		expect(sarosNodeType(facts(105, 15)).type).toBe('north');   // 90° 整含
		expect(sarosNodeType(facts(106, 15)).type).toBe('south');
	});
	test('仅有南交时反推北交;缺月/缺交点 → null', () => {
		const f = { planets: { moon: { lon: 10 }, south_node: { lon: 195 } } };   // 北交=15
		expect(sarosNodeType(f).type).toBe('north');
		expect(sarosNodeType({ planets: { moon: { lon: 10 } } })).toBeNull();
	});
});

describe('describeSarosFamily · 文档缺口自证', () => {
	test('输出含 TODO 注(族表需权威底本,不臆造)与判读四步', () => {
		const r = describeSarosFamily({ planets: { moon: { lon: 10 }, north_node: { lon: 15 } } });
		expect(r.tableTodo).toBe(SAROS_TABLE_TODO);
		expect(r.tableTodo).toMatch(/权威族表/);
		expect(r.steps).toHaveLength(4);
		expect(r.orb).toBeCloseTo(2.5, 5);
	});
});
