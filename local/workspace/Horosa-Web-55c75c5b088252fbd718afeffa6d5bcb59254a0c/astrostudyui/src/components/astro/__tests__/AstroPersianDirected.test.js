import {
	buildPersianDirectedSnapshotText,
	buildPersianHits,
	directedAgeYears,
	selectNearbyPersianHits,
	PERIODIC_YEARS,
	PERSIAN_YEAR_LABEL,
} from '../AstroPersianDirected';

// 极简本命盘：3 星 + 2 宫头，供前端应期算术（黄经象征向运 1°/年）。
function fakeChart(){
	return {
		params: { birth: '1990-01-01 12:00:00' },
		chart: {
			objects: [
				{ id: 'Sun', lon: 0 },
				{ id: 'Moon', lon: 90 },
				{ id: 'Mars', lon: 200 },
			],
			houses: [
				{ lon: 10 }, { lon: 40 },
			],
		},
	};
}

describe('directedAgeYears（推运时间 → 当前向运年龄）', ()=>{
	test('整年差：出生→20 年后 ≈ 20 岁', ()=>{
		const age = directedAgeYears('1990-01-01 00:00:00', '2010-01-01 00:00:00');
		expect(age).not.toBeNull();
		expect(Math.round(age)).toBe(20);
	});
	test('缺生时 / 坏值 → null（守「无生时不强标年龄」）', ()=>{
		expect(directedAgeYears('', '2010-01-01')).toBeNull();
		expect(directedAgeYears('1990-01-01', '')).toBeNull();
		expect(directedAgeYears('not-a-date', 'also-bad')).toBeNull();
	});
});

describe('selectNearbyPersianHits（邻近应期：随推运时间重算）', ()=>{
	const hits = [
		{ age: 5, promittor: 'Sun', aspect: 0, significator: 'Moon' },
		{ age: 19.2, promittor: 'Sun', aspect: 60, significator: 'Mars' },
		{ age: 20.4, promittor: 'Moon', aspect: 90, significator: 'Sun' },
		{ age: 21.1, promittor: 'Mars', aspect: 120, significator: 'Sun' },
		{ age: 60, promittor: 'Sun', aspect: 180, significator: 'Mars' },
	];
	test('取距 currentAge 最近 N → 再按 age 时间线重排 + 带 fromNow', ()=>{
		const near = selectNearbyPersianHits(hits, 20, 3);
		expect(near.map((h)=>h.age)).toEqual([19.2, 20.4, 21.1]); // 最近 3 条(0.8/0.4/1.1)按 age 序
		expect(near[0].fromNow).toBeCloseTo(-0.8, 5);
		expect(near[1].fromNow).toBeCloseTo(0.4, 5);
		expect(near[2].fromNow).toBeCloseTo(1.1, 5);
	});
	test('currentAge 变化 → 焦点随之移动（时间联动本质）', ()=>{
		const near = selectNearbyPersianHits(hits, 5.2, 2);
		expect(near.map((h)=>h.age)).toEqual([5, 19.2]); // 距 5.2 最近的是 5 与 19.2
	});
	test('currentAge null / 非数 / 空 hits → []', ()=>{
		expect(selectNearbyPersianHits(hits, null)).toEqual([]);
		expect(selectNearbyPersianHits(hits, undefined)).toEqual([]);
		expect(selectNearbyPersianHits([], 20)).toEqual([]);
	});
});

describe('buildPersianDirectedSnapshotText（maxYears 真生效 + 默认即现状）', ()=>{
	const rowCount = (t)=> t.split('\n').filter((l)=> l.startsWith('| ') && !l.includes('---') && !l.includes('年龄')).length;
	test('maxYears 越大 → 应期行越多（≥），且都非空', ()=>{
		const chart = fakeChart();
		const t50 = buildPersianDirectedSnapshotText(chart, { maxYears: 50 });
		const t200 = buildPersianDirectedSnapshotText(chart, { maxYears: 200 });
		expect(rowCount(t50)).toBeGreaterThan(0);
		expect(rowCount(t200)).toBeGreaterThanOrEqual(rowCount(t50));
	});
	test('缺省 === maxYears:90（向后兼容：默认逐字不变）', ()=>{
		const chart = fakeChart();
		expect(buildPersianDirectedSnapshotText(chart, {})).toBe(buildPersianDirectedSnapshotText(chart, { maxYears: 90 }));
	});
});

describe('周期律(每星一周期)', ()=>{
	const chartOf = (extra = [])=>({
		params: { birth: '1990-01-01 12:00:00' },
		chart: { objects: [{ id: 'Moon', lon: 0 }, { id: 'Saturn', lon: 0 }, { id: 'Pluto', lon: 0 }, { id: 'Venus', lon: 90 }, ...extra], houses: [] },
	});
	it('各星按自身周期走:月 4 年一圈、土 30 年、冥 248 年', ()=>{
		expect(PERIODIC_YEARS).toEqual({ Moon: 4, Mercury: 10, Venus: 8, Sun: 19, Mars: 15, Jupiter: 12, Saturn: 30, Uranus: 84, Neptune: 165, Pluto: 248 });
		const hits = buildPersianHits(chartOf(), 'periodic', 300, 'direct');
		const ageOf = (p)=>hits.filter((h)=>h.promittor === p && h.significator === 'Venus' && h.aspect === 0)[0].age;
		expect(ageOf('Moon')).toBeCloseTo(1, 2);       // 90° / (90°/年)
		expect(ageOf('Saturn')).toBeCloseTo(7.5, 2);   // 90° / (12°/年)
		expect(ageOf('Pluto')).toBeCloseTo(62, 2);     // 90° / (1.4516°/年)
	});
	it('十星都当向运星,统一速率档仍只有七曜', ()=>{
		const periodic = buildPersianHits(chartOf(), 'periodic', 300, 'direct');
		const uniform = buildPersianHits(chartOf(), 'persian', 300, 'direct');
		expect(periodic.some((h)=>h.promittor === 'Pluto')).toBe(true);
		expect(uniform.some((h)=>h.promittor === 'Pluto')).toBe(false);
	});
	it('逆向把弧取负', ()=>{
		const hits = buildPersianHits(chartOf(), 'periodic', 30, 'converse');
		const first = hits.filter((h)=>h.promittor === 'Saturn' && h.significator === 'Venus' && h.aspect === 0)[0];
		expect(first.age).toBeCloseTo(22.5, 2);        // 逆着走 270° 才到 90°
	});
	it('年长改应期日期,不改年龄;缺省与不传逐字相同', ()=>{
		const solar = buildPersianHits(chartOf(), 'periodic', 30, 'direct', 'solar');
		const none = buildPersianHits(chartOf(), 'periodic', 30, 'direct');
		const h360 = buildPersianHits(chartOf(), 'periodic', 30, 'direct', 'hellenistic');
		expect(none).toEqual(solar);
		expect(h360[0].age).toBe(solar[0].age);
		expect(h360.find((h)=>h.age > 5).date).not.toBe(solar.find((h)=>h.age > 5).date);
		expect(Object.keys(PERSIAN_YEAR_LABEL)).toEqual(['solar', 'sidereal', 'hellenistic', 'bija', 'bijaClassic']);
		expect(directedAgeYears('1990-01-01 00:00:00', '1991-01-01 00:00:00', 365)).toBeCloseTo(1, 6);
	});
	it('快照写明周期律与非缺省年长;缺省快照不多字', ()=>{
		const t = buildPersianDirectedSnapshotText(chartOf(), { rateKey: 'periodic', persianYear: 'hellenistic', maxYears: 50 });
		expect(t).toContain('周期律');
		expect(t).toContain('年长');
		expect(buildPersianDirectedSnapshotText(chartOf(), {})).not.toContain('年长');
	});
});
