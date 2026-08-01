// 历史会合分期 golden:以 1603–2100 参考纪年表为锚验四态判定与分段。
import { computeConjunctionEras, detectMarsSaturnCancer, CONJUNCTION_LAYERS, PARALLEL_TRIADS } from '../../divination/mundane/conjunctionEras';
import { GREAT_CONJ_TABLE } from '../../divination/mundane/greatConjTable';

describe('历史会合三层说 · 常量表', () => {
	test('三层周期名义 20/240/960,名义与天文并列;平行三元=木土/火土/木火', () => {
		expect(CONJUNCTION_LAYERS.map((l) => l.nominalYears)).toEqual([20, 240, 960]);
		CONJUNCTION_LAYERS.forEach((l) => { expect(l.observedYears).toBeTruthy(); expect(l.meaning).toBeTruthy(); });
		expect(PARALLEL_TRIADS.map((t) => [t.p1, t.p2])).toEqual([
			['jupiter', 'saturn'], ['mars', 'saturn'], ['jupiter', 'mars'],
		]);
	});
});

describe('computeConjunctionEras · 参考纪年表 golden', () => {
	const r = computeConjunctionEras(GREAT_CONJ_TABLE);
	const markOf = (y) => r.marks.find((m) => m.year === y);

	test('2020 → 风:稳定变迁(此后 2040/2060/2080 全风)', () => {
		const m = markOf(2020);
		expect(m).toBeTruthy();
		expect(m.element).toBe('air');
		expect(m.kind).toBe('stable_shift');
	});

	test('1802 → 土:变迁前奏(1821 回火一次后 1842 起稳定进土)', () => {
		const m = markOf(1802);
		expect(m).toBeTruthy();
		expect(m.element).toBe('earth');
		expect(m.kind).toBe('precursor');
	});

	test('1980 → 风:变迁前奏(风的初尝;2000 回土后 2020 起稳定)', () => {
		const m = markOf(1980);
		expect(m).toBeTruthy();
		expect(m.kind).toBe('precursor');
	});

	test('1643 水 / 1821 火:过渡振荡(跳出即回,其后未稳定)', () => {
		expect(markOf(1643).kind).toBe('oscillation');
		expect(markOf(1821).kind).toBe('oscillation');
	});

	test('分段:段界只落稳定变迁;段元素连贯', () => {
		expect(r.segments.length).toBeGreaterThanOrEqual(2);
		const seg2020 = r.segments.find((s) => s.from === 2020);
		expect(seg2020).toBeTruthy();
		expect(seg2020.element).toBe('air');
	});
});

describe('detectMarsSaturnCancer · 土火合巨蟹筛选', () => {
	test('sign 字符串/数字双形态均可筛;非巨蟹剔除', () => {
		const rows = [
			{ year: 2004, sign: 'cancer' }, { year: 2006, sign: 'leo' },
			{ year: 2034, sign: 3 }, { year: 2036, sign: 4 },
		];
		expect(detectMarsSaturnCancer(rows).map((x) => x.year)).toEqual([2004, 2034]);
	});
});
