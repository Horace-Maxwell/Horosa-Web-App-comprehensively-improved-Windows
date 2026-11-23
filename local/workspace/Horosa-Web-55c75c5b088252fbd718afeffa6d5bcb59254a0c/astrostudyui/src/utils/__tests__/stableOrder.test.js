// 并列稳定(utils/stableOrder.js)与用到它的量化盘各表:数学上相等的两个量在不同机器上末位各差各的,
// 排序的先后、恰在边界上的归属不该由末位决定。这里用「给输入加一点末位噪声」模拟换一台机器:结果必须不变。
import { tieSort, sameValue, floorStable, snapInteger, lteStable, ltStable, TIE_EPS } from '../stableOrder';
import { fmtHour } from '../directedFigures';
import { midpoint, planetaryPictures, spiegelContacts, midpointList, sumList, differenceList, planetHouse, cursorReadout, midpointTree, solarArcDirections } from '../uranianDial';

const NOISE = [0, 3e-14, -3e-14, 7e-13, -7e-13, 2e-11, -2e-11];

describe('并列稳定排序 tieSort', ()=>{
	it('🔴 并列的保持原来的先后,不看末位', ()=>{
		NOISE.forEach((d1)=>NOISE.forEach((d2)=>{
			const rows = [['a', 2], ['b', 1.5 + d1], ['c', 1.5 + d2], ['d', 0.25]];
			expect(tieSort(rows, (r)=>r[1]).map((r)=>r[0])).toEqual(['d', 'b', 'c', 'a']);
		}));
	});
	it('真有先后的按数值;降序;不动原数组', ()=>{
		const rows = [['a', 1.5 + 2e-9], ['b', 1.5], ['c', 1.5 - 2e-9]];
		expect(tieSort(rows, (r)=>r[1]).map((r)=>r[0])).toEqual(['c', 'b', 'a']);
		expect(tieSort(rows, { of: (r)=>r[1], desc: true }).map((r)=>r[0])).toEqual(['a', 'b', 'c']);
		expect(rows.map((r)=>r[0])).toEqual(['a', 'b', 'c']);
		expect(tieSort([['a', 5], ['b', 9 - 1e-13], ['c', 9], ['d', 9 + 1e-13]], { of: (r)=>r[1], desc: true }).map((r)=>r[0])).toEqual(['b', 'c', 'd', 'a']);
	});
	it('并列再按下一个键;键用完按原先后;字符串键按字典序;无效值排最后', ()=>{
		const rows = [{ v: 1, n: 'z' }, { v: 1 + 1e-13, n: 'a', i: 1 }, { v: 1 - 1e-13, n: 'a', i: 2 }, { v: 0.5, n: 'q' }];
		expect(tieSort(rows, (r)=>r.v, (r)=>r.n).map((r)=>`${r.n}${r.i || ''}`)).toEqual(['q', 'a1', 'a2', 'z']);
		expect(tieSort([{ v: NaN, n: 'x' }, { v: 2, n: 'y' }, { v: 1, n: 'w' }], (r)=>r.v).map((r)=>r.n)).toEqual(['w', 'y', 'x']);
		expect(tieSort([], (r)=>r)).toEqual([]);
		expect(tieSort(null, (r)=>r)).toEqual([]);
		expect(tieSort([3, 1, 2], (r)=>r)).toEqual([1, 2, 3]);
	});
	it('一串挨着的近值是同一组(首尾差超过容差也算)', ()=>{
		expect(tieSort([['c', 1 + 1.6e-9], ['b', 1 + 0.8e-9], ['a', 1]], (r)=>r[1]).map((r)=>r[0])).toEqual(['c', 'b', 'a']);
	});
	it('边界与阈值的写法', ()=>{
		expect(TIE_EPS).toBe(1e-9);
		expect(sameValue(1, 1 + 5e-10)).toBe(true); expect(sameValue(1, 1 + 5e-9)).toBe(false); expect(sameValue('a', 'a')).toBe(true); expect(sameValue(NaN, NaN)).toBe(true);
		expect(floorStable(29.999999999999996)).toBe(30); expect(floorStable(29.9999)).toBe(29); expect(floorStable(-1e-12)).toBe(0); expect(floorStable(-0.5)).toBe(-1);
		expect(snapInteger(179.99999999999997)).toBe(180); expect(snapInteger(180.0000001)).toBe(180.0000001);
		expect(lteStable(1 + 1e-12, 1)).toBe(true); expect(lteStable(1 + 1e-8, 1)).toBe(false); expect(ltStable(1 - 1e-12, 1)).toBe(false); expect(ltStable(0.5, 1)).toBe(true);
	});
});

// 一张带南北交点的小盘:南交 = 北交 + 180°(加噪声);另有刻意凑出的并列和差式
const pointsWith = (d)=>[
	{ id: 'Sun', lon: 100.25 }, { id: 'Moon', lon: 201.5 }, { id: 'Mars', lon: 33.75 }, { id: 'Jupiter', lon: 250.125 },
	{ id: 'North Node', lon: 44.787654321 + d }, { id: 'South Node', lon: 224.787654321 - d },
	{ id: 'Asc', lon: 310.5 }, { id: 'MC', lon: 215.25 }, { id: 'Kronos', lon: 70.0 }, { id: 'Hades', lon: 115.5 },
];
const sig = (rows, f)=>rows.map(f).join(' ; ');

describe('量化盘各表:加末位噪声后逐字不变', ()=>{
	const personal = new Set(['Sun', 'Moon', 'Asc', 'MC', 'North Node', 'South Node']);
	const uranian = new Set(['Kronos', 'Hades']);
	const opts = { personal, uranian };
	const all = (pts)=>({
		pics: sig(planetaryPictures(pts, 90, 1, { ...opts, limit: 400 }), (p)=>`${p.a}+${p.b}-${p.c}=${p.d}:${p.sep.toFixed(4)}`),
		spiegel: sig(spiegelContacts(pts, 90, 1, opts), (p)=>`${p.a}~${p.b}:${p.sep.toFixed(4)}`),
		mids: sig(midpointList(pts, 90, opts), (p)=>`${p.a}/${p.b}:${p.lon.toFixed(4)}`),
		sums: sig(sumList(pts, 90, opts), (p)=>`${p.a}/${p.b}:${p.lon.toFixed(4)}`),
		diffs: sig(differenceList(pts, 90, opts), (p)=>`${p.a}/${p.b}:${p.arc.toFixed(4)}`),
		cursor: sig(cursorReadout(pts, 44.787654321, 90, 1, opts), (h)=>`${h.kind}:${h.id || `${h.a}/${h.b}`}:${h.sep.toFixed(4)}`),
		tree: sig(Object.entries(midpointTree(pts, 90, 1, opts)), ([k, rows])=>`${k}=>${rows.map((r)=>`${r.a}/${r.b}`).join(',')}`),
		arcs: sig(solarArcDirections(pts, 90, { maxAge: 90 }), (r)=>`${r.a}/${r.b || ''}:${r.type}${r.fold || ''}:${r.age.toFixed(4)}`),
	});
	const base = all(pointsWith(0));
	it('基准盘里确有并列(南北交点成对的和差式 / 中点)—— 否则下面的断言是空的', ()=>{
		expect(base.pics.length).toBeGreaterThan(200);
		expect(base.pics).toMatch(/North Node\+[^;]*; [^;]*South Node\+|South Node\+[^;]*; [^;]*North Node\+/);
		expect(base.mids).toMatch(/North Node\/South Node:/);
	});
	NOISE.slice(1).forEach((d)=>{
		it(`🔴 噪声 ${d}:行星图 / 映点 / 中点 / 和点 / 差距 / 指针读数 / 中点树 / 太阳弧表逐字相同`, ()=>{
			expect(all(pointsWith(d))).toEqual(base);
		});
	});
	it('🔴 正对两点的中点取黄经小的那个(两种次序同一个结果)', ()=>{
		NOISE.forEach((d)=>{
			[14.78, 104.78, 200, 359.5].forEach((node)=>{
				const south = ((node + 180) % 360) + d;
				const want = Math.min((node + 90) % 360, (node + 270) % 360);
				expect(Math.abs(midpoint(node, south) - want)).toBeLessThan(1e-9);
				expect(Math.abs(midpoint(south, node) - want)).toBeLessThan(1e-9);
			});
		});
		expect(midpoint(10, 50)).toBe(30); expect(midpoint(350, 30)).toBe(10); expect(midpoint(10, 200)).toBe(285);   // 寻常的一对照旧
	});
	it('🔴 恰在宫头上的点算进这一宫(与后端同口径)', ()=>{
		const cusps = Array.from({ length: 12 }, (_, i)=>(100 + 30 * i) % 360);
		NOISE.forEach((d)=>{
			expect(planetHouse(100 + d, cusps)).toBe(1);
			expect(planetHouse(((100 + 270) % 360) + d, cusps)).toBe(10);
			expect(planetHouse(70 + d, cusps)).toBe(12);
		});
		expect(planetHouse(99.9, cusps)).toBe(12); expect(planetHouse(100.1, cusps)).toBe(1); expect(planetHouse(129.999, cusps)).toBe(1);
	});
});

describe('世俗时位的写法:24 时与 0 时是同一个位置', ()=>{
	it('🔴 四舍五入后到 24 的写成 0(天顶的时位数学上正是 0;浮点上是 23.999999… 时不显示成 24.000)', ()=>{
		expect(fmtHour(23.999999999999996, 3)).toBe('0.000');
		expect(fmtHour(23.9996, 3)).toBe('0.000');
		expect(fmtHour(23.9994, 3)).toBe('23.999');
		expect(fmtHour(0, 3)).toBe('0.000'); expect(fmtHour(8.6e-7, 3)).toBe('0.000');
		expect(fmtHour(23.996, 2)).toBe('0.00'); expect(fmtHour(23.994, 2)).toBe('23.99');
		expect(fmtHour(6.25, 3)).toBe('6.250'); expect(fmtHour(undefined, 3)).toBe('-');
	});
});
