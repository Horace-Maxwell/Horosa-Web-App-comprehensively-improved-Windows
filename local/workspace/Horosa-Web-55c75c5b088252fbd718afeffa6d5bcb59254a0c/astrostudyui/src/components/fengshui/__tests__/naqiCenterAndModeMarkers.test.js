// [Q-221/T-181·FT-13/FT-14] 纳气:①与盘心重合的标记判「中宫/不计」(不进合冲/评分);②快照与 vm 统计只看纳气标记(八卦标记不混入);
// ③吸附不吸到中心交点。轻量桩:Object.create(原型),无需 canvas。
import FengShuiEngine from '../fengshuiEngine';

function mk(extra) {
	const eng = Object.create(FengShuiEngine.prototype);
	eng.periodMode = 'current';
	eng.techMode = 'naqi';
	eng.diskCenterMode = 'house';
	eng.rect = { active: true, x: 0, y: 0, w: 600, h: 600, rotation: 0 };
	eng.getRectCenter = () => ({ x: 300, y: 300 });
	eng.getDiskRotation = () => 0;
	eng.getCombinedScale = () => 1;
	eng.unitAzimuth = 0; eng.doorImageAngle = 0; eng.selectedMarkerId = null;
	eng.snapEnabled = true;
	eng.markers = [];
	Object.assign(eng, extra || {});
	return eng;
}

describe('纳气 · 盘心重合标记与双法标记隔离', () => {
	test('[FT-14] 与盘心重合(≤2px)的标记:sector=null、center=true、ok=true;偏出容差即正常落宫', () => {
		const eng = mk();
		const atCenter = { id: 'd1', type: 'entryDoor', label: '入户门', category: 'wind', x: 300, y: 300 };
		const nearCenter = { id: 'd2', type: 'bed', label: '床', category: 'wind', x: 301.5, y: 300 };
		const away = { id: 'd3', type: 'bed', label: '床2', category: 'wind', x: 300, y: 100 };
		expect(eng.evaluateMarker(atCenter)).toMatchObject({ sector: null, center: true, ok: true, actual: null });
		expect(eng.evaluateMarker(nearCenter).center).toBe(true);
		const ev = eng.evaluateMarker(away);
		expect(ev.center).toBeUndefined();
		expect(ev.sector).toBeTruthy();
	});
	test('[FT-14] 盘心=入户门时入户门自身不进合冲/破局/评分(此前按 atan2(0,0) 钉在某扇区)', () => {
		const door = { id: 'door', type: 'entryDoor', label: '入户门', category: 'wind', x: 300, y: 500 };
		const bed = { id: 'bed', type: 'bed', label: '床', category: 'wind', x: 300, y: 100 };
		const house = mk({ markers: [door, bed] });
		const byDoor = mk({ markers: [door, bed], diskCenterMode: 'door' });
		const a1 = house.buildNaqiAnalysis();
		const a2 = byDoor.buildNaqiAnalysis();
		const doorRow = a2.markers.find((m) => m.id === 'door');
		expect(doorRow.center).toBe(true);
		expect(doorRow.sector).toBeNull();
		expect(doorRow.harm).toBeNull();
		expect(doorRow.ok).toBe(true);
		// 盘心换到入户门后,门自身既不算「气位正确」也不算破局:windOk 只可能来自床
		expect(a1.markers.find((m) => m.id === 'door').sector).toBeTruthy();
	});
	test('[FT-13] 快照 [标记判定]/[冲突清单] 与 vm 统计只看纳气标记,八卦标记(父/母)不混入', () => {
		const bed = { id: 'bed', type: 'bed', label: '床', category: 'wind', x: 300, y: 100, mode: 'naqi' };
		const father = { id: 'f', kind: 'member', label: '父', x: 300, y: 500, mode: 'bagua' };
		const mother = { id: 'm', kind: 'member', label: '母', x: 100, y: 300, mode: 'bagua' };
		const eng = mk({ markers: [bed, father, mother] });
		eng.buildNaqiAnalysis = () => ({ markers: [], houseHarms: [], dragonTiger: null, dragonTigerHint: '', probe: null, score: 100, grade: '吉', remedies: [] });
		const t = eng.buildNaqiSnapshotText();
		expect(t).not.toContain('| 父 |');
		expect(t).not.toContain('| 母 |');
		expect(t).toContain('| 床 |');
		expect(t).not.toMatch(/父：|母：/);
		expect(eng.naqiMarkers().map((m) => m.id)).toEqual(['bed']);
	});
	test('[FT-14] 吸附:两轴都落在中线容差内时只吸一轴,不落到盘心', () => {
		const eng = mk();
		const p = eng.snapPointToRect({ x: 303, y: 301 });   // 两轴都在容差内
		expect(!(p.x === 300 && p.y === 300)).toBe(true);
		expect(p.y).toBe(300);   // 偏差小的一轴吸到中线,偏差大的一轴保留
		expect(p.x).toBe(303);
		const q = eng.snapPointToRect({ x: 303, y: 250 });   // 只有 x 在容差内 → 照常吸到中线
		expect(q.x).toBe(300);
	});
});
