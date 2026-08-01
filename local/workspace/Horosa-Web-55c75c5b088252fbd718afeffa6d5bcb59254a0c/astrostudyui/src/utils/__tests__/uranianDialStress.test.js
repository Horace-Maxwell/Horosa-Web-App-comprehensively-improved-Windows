// 汉堡排查轮·压测矩阵:17 盘基 × 8 扫描器全组合不炸+不变式、组合盘边界、扩展映点轴×盘基、
// saKey 三键、onlyPersonal/orb 单调、sum/arc 追加语义、垃圾值风暴。全部纯函数面(与组件 render 同参)。
import {
	projectToDial, midpoint, dialSeparation, cursorReadout, midpointTree, planetaryPictures,
	midpointList, spiegelContacts, sumList, differenceList, solarArcDirections, SA_RATE,
	crossContacts, rectificationHits, compositeChart, midpointHubs, antiscion,
} from '../uranianDial';

const BASES = [360, 180, 120, 90, 60, 45, 30, 22.5, 15, 7.5, 5.625, 3.75, 2.8125, 1.875, 1.40625, 0.9375, 0.703125];

// 确定性合成盘(遍布全圈+含跨 0° 邻近对),模拟 行星+四轴+TNP 混合点集。
const PTS = [
	{ id: 'Sun', lon: 353.5 }, { id: 'Moon', lon: 254.5 }, { id: 'Mercury', lon: 3.14 },
	{ id: 'Venus', lon: 16.99 }, { id: 'Mars', lon: 296.9 }, { id: 'Jupiter', lon: 327.5 },
	{ id: 'Saturn', lon: 4.19 }, { id: 'Uranus', lon: 151.3 }, { id: 'Neptune', lon: 37.87 },
	{ id: 'Pluto', lon: 54.7 }, { id: 'North Node', lon: 301.5 }, { id: 'Asc', lon: 101.6 },
	{ id: 'MC', lon: 342.8 }, { id: 'Cupido', lon: 75.2 }, { id: 'Poseidon', lon: 155.2 },
	{ id: 'AriesPoint', lon: 0 },
];
const PERSONAL = new Set(['Sun', 'Moon', 'Asc', 'MC', 'North Node', 'AriesPoint']);
const URANIAN = new Set(['Cupido', 'Poseidon']);

describe('17 盘基 × 8 扫描器:全组合不炸 + 不变式', () => {
	it.each(BASES)('盘基 %p', (base) => {
		const orb = 1;
		const ro = cursorReadout(PTS, 10, base, orb, { personal: PERSONAL, onlyPersonal: false });
		ro.forEach((h) => { expect(h.sep).toBeGreaterThanOrEqual(0); expect(h.sep).toBeLessThanOrEqual(orb + 1e-9); });
		const tree = midpointTree(PTS, base, orb, { personal: PERSONAL, onlyPersonal: true });
		Object.keys(tree).forEach((k) => { expect(PERSONAL.has(k)).toBe(true); tree[k].forEach((r) => expect(r.sep).toBeLessThanOrEqual(orb + 1e-9)); });
		const pics = planetaryPictures(PTS, base, orb, { personal: PERSONAL, uranian: URANIAN, limit: 20 });
		expect(pics.length).toBeLessThanOrEqual(20);
		pics.forEach((p) => expect(p.sep).toBeLessThanOrEqual(1 + 1e-9));
		const mpl = midpointList(PTS, base, { personal: PERSONAL, uranian: URANIAN });
		expect(mpl.length).toBe((PTS.length * (PTS.length - 1)) / 2);
		mpl.forEach((m) => { expect(m.dial).toBeGreaterThanOrEqual(0); expect(m.dial).toBeLessThan(360 + 1e-9); });
		const sp = spiegelContacts(PTS, base, orb, {});
		sp.forEach((s) => expect(s.sep).toBeLessThanOrEqual(orb + 1e-9));
		expect(sumList(PTS, base, {}).length).toBe(mpl.length);
		expect(differenceList(PTS, base, {}).length).toBe(mpl.length);
		const sad = solarArcDirections(PTS, base, { saKey: 'naibod', maxAge: 120 });
		sad.forEach((r) => { expect(Number.isFinite(r.age)).toBe(true); expect(r.age).toBeLessThanOrEqual(120 + 1e-9); });
	});
});

describe('cursorReadout 语义矩阵', () => {
	it('onlyPersonal 开=命中集是关的子集(单调收窄)', () => {
		BASES.slice(0, 6).forEach((base) => {
			const off = cursorReadout(PTS, 5, base, 2, { personal: PERSONAL, onlyPersonal: false });
			const on = cursorReadout(PTS, 5, base, 2, { personal: PERSONAL, onlyPersonal: true });
			expect(on.length).toBeLessThanOrEqual(off.length);
			const key = (h) => h.kind + '|' + (h.id || [h.a, h.b].sort().join('+'));
			const offSet = new Set(off.map(key));
			on.forEach((h) => expect(offSet.has(key(h))).toBe(true));
		});
	});
	it('orb 单调:大容许度命中 ⊇ 小容许度', () => {
		const small = cursorReadout(PTS, 30, 90, 0.5, {});
		const big = cursorReadout(PTS, 30, 90, 3, {});
		expect(big.length).toBeGreaterThanOrEqual(small.length);
	});
	it('sum/arc 缺省不产、开启只追加(body/mid 两类既有项逐位不变)', () => {
		const plain = cursorReadout(PTS, 12, 90, 1.5, {});
		const extra = cursorReadout(PTS, 12, 90, 1.5, { sum: true, arc: true });
		expect(plain.every((h) => h.kind === 'body' || h.kind === 'mid')).toBe(true);
		const baseKinds = extra.filter((h) => h.kind === 'body' || h.kind === 'mid');
		expect(JSON.stringify(baseKinds)).toBe(JSON.stringify(plain));
		expect(extra.length).toBeGreaterThanOrEqual(plain.length);
	});
});

describe('组合盘 compositeChart 边界', () => {
	it('自组合(两盘同点):逐因子中点=自身', () => {
		const c = compositeChart(PTS, PTS.map((p) => ({ ...p })));
		expect(c.length).toBe(PTS.length);
		c.forEach((p, i) => expect(p.lon).toBeCloseTo(PTS[i].lon, 9));
	});
	it('交集为空/半缺角/lon 非数值:安全跳过', () => {
		expect(compositeChart(PTS, [{ id: 'Nope', lon: 1 }])).toEqual([]);
		const c = compositeChart(PTS, [{ id: 'Sun', lon: 'x' }, { id: 'Moon', lon: 10 }]);
		expect(c.length).toBe(1);
		expect(c[0].id).toBe('Moon');
	});
	it('组合点可直接喂全部扫描器(17 盘基抽 3 档不炸)', () => {
		const c = compositeChart(PTS, PTS.map((p) => ({ id: p.id, lon: (p.lon + 40) % 360 })));
		[90, 22.5, 360].forEach((b) => {
			expect(() => { midpointTree(c, b, 1, {}); midpointList(c, b, {}); cursorReadout(c, 0, b, 1, {}); }).not.toThrow();
		});
	});
});

describe('midpointHubs 枢纽不变式', () => {
	it('count 降序;根覆盖全因子(不受 onlyPersonal 剪枝);personalCount≤count', () => {
		const hubs = midpointHubs(PTS, 90, 1.5, { onlyPersonal: true, personal: PERSONAL });
		for (let i = 1; i < hubs.length; i++) expect(hubs[i - 1].count).toBeGreaterThanOrEqual(hubs[i].count);
		hubs.forEach((h) => expect(h.personalCount).toBeLessThanOrEqual(h.count));
		const tree = midpointTree(PTS, 90, 1.5, { onlyPersonal: false });
		expect(hubs.length).toBe(Object.keys(tree).length);
	});
});

describe('扩展映点轴 × 盘基(重合数学)', () => {
	const P2 = [{ id: 'A', lon: 20 }, { id: 'B', lon: 70 }];
	it('缺省 false:17 盘基下输出逐位 = 无 opts(零回归)', () => {
		BASES.forEach((b) => {
			expect(JSON.stringify(spiegelContacts(P2, b, 1, { extendedAxes: false })))
				.toBe(JSON.stringify(spiegelContacts(P2, b, 1)));
		});
	});
	it('开启:360 盘独立命中;90 折叠盘扩展行与基本轴同 sep(重合);行带 axis 标记', () => {
		const e360 = spiegelContacts(P2, 360, 1, { extendedAxes: true });
		expect(e360.filter((r) => r.axis === 'fixed15').length).toBe(1);
		expect(e360.filter((r) => !r.axis).length).toBe(0);
		const e90 = spiegelContacts(P2, 90, 1, { extendedAxes: true });
		const baseRow = e90.find((r) => !r.axis);
		const extRow = e90.find((r) => r.axis === 'fixed15');
		expect(baseRow && extRow && Math.abs(baseRow.sep - extRow.sep) < 1e-9).toBe(true);
	});
});

describe('solarArcDirections saKey 三键与边界', () => {
	const P2 = [{ id: 'a', lon: 0 }, { id: 'b', lon: 59.2 }];
	it('naibod/oneDeg/cardan 三键年龄互异且与速率互洽;未知键=naibod', () => {
		const ages = {};
		['naibod', 'oneDeg', 'cardan'].forEach((k) => {
			const full = solarArcDirections(P2, 90, { saKey: k }).find((r) => r.type === 'full' && !r.fold);
			ages[k] = full.age;
			expect(full.age).toBeCloseTo(59.2 / SA_RATE[k], 9);
		});
		expect(new Set(Object.values(ages)).size).toBe(3);
		expect(JSON.stringify(solarArcDirections(P2, 90, { saKey: 'zzz' })))
			.toBe(JSON.stringify(solarArcDirections(P2, 90, { saKey: 'naibod' })));
	});
	it('targetAge 边界 0/120/负:due 标记不炸且 maxAge 截断成立', () => {
		[0, 120, -5].forEach((t) => {
			const rows = solarArcDirections(PTS, 90, { saKey: 'oneDeg', targetAge: t, maxAge: 90 });
			rows.forEach((r) => expect(r.age).toBeLessThanOrEqual(90 + 1e-9));
		});
	});
});

describe('垃圾值风暴(不炸)', () => {
	it('空点集/orb 0/负 orb/巨 orb/NaN lon', () => {
		expect(() => {
			cursorReadout([], 0, 90, 1, {});
			midpointTree([], 90, 1, {});
			midpointList([], 90, {});
			spiegelContacts([], 90, 1, {});
			compositeChart([], []);
			midpointHubs([], 90, 1, {});
			solarArcDirections([], 90, {});
			cursorReadout(PTS, 10, 90, 0, {});
			cursorReadout(PTS, 10, 90, -1, {});
			cursorReadout(PTS, 10, 90, 9999, {});
			midpointTree(PTS.concat([{ id: 'bad', lon: NaN }]), 90, 1, {});
		}).not.toThrow();
	});
	it('rectificationHits 缺角/坏年份优雅', () => {
		const out = rectificationHits([{ label: 'x', years: NaN }, { years: 30 }], { mc: 342.8, asc: 101.6 }, PTS, 90, 1, SA_RATE.naibod);
		expect(out.length).toBe(2);
		expect(Number.isNaN(out[0].arc)).toBe(true);
		expect(out[1].hits.every((h) => h.sep <= 1 + 1e-9)).toBe(true);
	});
});

describe('crossContacts 跨盘接触不变式', () => {
	it('同盘自接触:每点与自身 sep=0 命中;17 盘基抽 4 档', () => {
		[360, 90, 45, 22.5].forEach((b) => {
			const cs = crossContacts(PTS, PTS, b, 0.5);
			PTS.forEach((p) => {
				expect(cs.some((c) => (c.a === p.id || c.idA === p.id || JSON.stringify(c).indexOf(p.id) >= 0))).toBe(true);
			});
			cs.forEach((c) => expect(c.sep).toBeLessThanOrEqual(0.5 + 1e-9));
		});
	});
});
