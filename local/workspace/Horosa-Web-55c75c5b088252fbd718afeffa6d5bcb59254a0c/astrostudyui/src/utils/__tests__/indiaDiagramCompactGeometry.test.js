// 北印 / 东印紧凑版式的锚区几何合同(纯几何,不依赖浏览器):
// ① 每格的宫号盒 / 座符盒 / 行星锚区三块整块落在本格多边形内(四角 + 中心;贴边 0.3% 容差);
// ② 三块两两不相交 —— 行星块只在锚区里等比缩(fitIndiaDiagramObjects),故锚区在格内且不碰宫号 / 座符 ⇒ 不会互叠、不会跨对角线;
// ③ 中宫分盘徽标(7.5u)不碰任何一格的三块。
// 盒子大小按紧凑字号估(单位 = 盘边 %;字宽按 0.62em、两行宫号 = 宫号 + 宫头度):改了紧凑字号要同步这里的估值。
// 真绘制另有真内核巡检(layout_clip 的 COLLIDE / STRADDLE,北 / 南 / 东三盘式各扫)。
import fs from 'fs';
import path from 'path';
import { NORTH_COMPACT_LABEL, NORTH_COMPACT_SIGN, NORTH_COMPACT_OBJECTS, NORTH_HOUSE_POLYGONS } from '../../components/astro/IndiaNorthChart';
import { EAST_COMPACT_LABEL, EAST_COMPACT_SIGN, EAST_COMPACT_OBJECTS, EAST_SLOT_POLYGONS } from '../../components/astro/IndiaEastChart';
import { indiaDiagramSizeVars, INDIA_DIAGRAM_COMPACT_BOARD, fitIndiaDiagramObjects } from '../boxSizeVars';

const LABEL_BOX = { w: 5.2, h: 6.6 };   // 「12」3.2u 两字 + 宫头度「0°」2.3u 一行
const SIGN_BOX = { w: 4.4, h: 4.4 };    // 座符 3.6u
const CENTER_D = 7.5;
const TOL = 0.3;

const polyOf = (s)=>s.split(' ').map((p)=>p.split(',').map(Number));
function inPoly(x, y, poly){
	let c = false;
	for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){
		const [xi, yi] = poly[i]; const [xj, yj] = poly[j];
		if(((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi)){ c = !c; }
	}
	return c;
}
function distToPoly(x, y, poly){
	let best = Infinity;
	for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){
		const [x1, y1] = poly[j]; const [x2, y2] = poly[i];
		const dx = x2 - x1; const dy = y2 - y1; const L = dx * dx + dy * dy || 1e-9;
		const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / L));
		best = Math.min(best, Math.hypot(x1 + t * dx - x, y1 + t * dy - y));
	}
	return best;
}
const rectAt = ([cx, cy], w, h)=>({ l: cx - w / 2, r: cx + w / 2, t: cy - h / 2, b: cy + h / 2 });
const rectOfAnchor = ([cx, cy, w, h])=>rectAt([cx, cy], w, h);
const corners = (r)=>[[r.l, r.t], [r.r, r.t], [r.l, r.b], [r.r, r.b], [(r.l + r.r) / 2, (r.t + r.b) / 2]];
const rectInPoly = (r, poly)=>corners(r).every(([x, y])=>inPoly(x, y, poly) || distToPoly(x, y, poly) <= TOL);
const intersects = (a, b)=>Math.min(a.r, b.r) - Math.max(a.l, b.l) > 0 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 0;

function compactViolations(cells){
	const bad = [];
	const center = rectAt([50, 50], CENTER_D, CENTER_D);
	cells.forEach(({ key, poly, label, sign, objects })=>{
		const P = polyOf(poly);
		const L = rectAt(label, LABEL_BOX.w, LABEL_BOX.h);
		const S = rectAt(sign, SIGN_BOX.w, SIGN_BOX.h);
		const O = rectOfAnchor(objects);
		[['宫号', L], ['座符', S], ['行星', O]].forEach(([n, r])=>{
			if(!rectInPoly(r, P)){ bad.push(`${key} ${n}出格`); }
			if(intersects(r, center)){ bad.push(`${key} ${n}碰中宫徽标`); }
		});
		if(intersects(L, S)){ bad.push(`${key} 宫号×座符`); }
		if(intersects(L, O)){ bad.push(`${key} 宫号×行星`); }
		if(intersects(S, O)){ bad.push(`${key} 座符×行星`); }
	});
	return bad;
}

const northCells = Object.keys(NORTH_HOUSE_POLYGONS).map((h)=>({
	key: `北印宫${h}`, poly: NORTH_HOUSE_POLYGONS[h], label: NORTH_COMPACT_LABEL[h], sign: NORTH_COMPACT_SIGN[h], objects: NORTH_COMPACT_OBJECTS[h],
}));
const eastCells = Object.keys(EAST_SLOT_POLYGONS).map((s)=>({
	key: `东印格${s}`, poly: EAST_SLOT_POLYGONS[s], label: EAST_COMPACT_LABEL[s], sign: EAST_COMPACT_SIGN[s], objects: EAST_COMPACT_OBJECTS[s],
}));

describe('北印 / 东印紧凑版式锚区几何', ()=>{
	it('十二格 × 两盘式:三块各在本格内、两两不相交、不碰中宫', ()=>{
		expect(northCells).toHaveLength(12);
		expect(eastCells).toHaveLength(12);
		expect(compactViolations(northCells)).toEqual([]);
		expect(compactViolations(eastCells)).toEqual([]);
	});
	it('判据会咬:锚区挪过对角线 / 座符压行星即红', ()=>{
		const moved = eastCells.map((c)=>(c.key === '东印格11' ? { ...c, objects: [22.5, 11.5, 14, 14] } : c));   // 常规版式的锚区:跨对角线
		expect(compactViolations(moved).join()).toMatch(/东印格11 行星出格/);
		const sat = northCells.map((c)=>(c.key === '北印宫1' ? { ...c, sign: [50, 30] } : c));
		expect(compactViolations(sat).join()).toMatch(/北印宫1 座符×行星/);
	});
	it('紧凑开关按盘边量:单盘常规尺寸不挂;放大档 / 小窗挂', ()=>{
		expect(INDIA_DIAGRAM_COMPACT_BOARD).toBe(600);
		expect(indiaDiagramSizeVars(893, 811).attrs['data-idg-compact']).toBe(false);
		expect(indiaDiagramSizeVars(350, 350)).toEqual({ vars: { '--idg-u': '3.5px' }, attrs: { 'data-idg-compact': true } });
	});
	it('非紧凑态清掉行星块内联量(回到常规版式)', ()=>{
		const board = document.createElement('div');
		board.innerHTML = '<div class="horosa-india-diagram-object-anchor"><div class="horosa-india-diagram-objects" style="--idg-fit:0.5;grid-template-columns:repeat(2, max-content)"><span>Su</span></div></div>';
		fitIndiaDiagramObjects(board);
		const box = board.querySelector('.horosa-india-diagram-objects');
		expect(box.style.getPropertyValue('--idg-fit')).toBe('');
		expect(box.style.getPropertyValue('grid-template-columns')).toBe('');
	});
	it('盘组件:严格盘面标记 + 每格多边形 + 量盘 ref + 数据变了重装', ()=>{
		const SRC = path.resolve(__dirname, '../../components/astro');
		['IndiaNorthChart.js', 'IndiaEastChart.js'].forEach((f)=>{
			const s = fs.readFileSync(path.join(SRC, f), 'utf8');
			expect(s).toMatch(/data-clip-strict-text="" ref=\{this\._idgRef \|\| \(this\._idgRef = indiaDiagramBoardRef\(\)\)\}/);
			expect(s).toMatch(/data-cell-poly=\{mirrorPolygonIf\(/);
			expect(s).toMatch(/componentDidUpdate\(\)\{[\s\S]{0,120}this\._idgRef\.refit\(\)/);
			expect(s).toMatch(/'--idg-cw'/);
		});
		// 南印方盘(格子即格界,无斜线)同样进严格盘面判据(三盘式都受 COLLIDE 看护)
		expect(fs.readFileSync(path.join(SRC, 'IndiaSouthChart.js'), 'utf8')).toMatch(/boxSizeVarsRef\(indiaSquareSizeVars\)\)\} data-clip-strict-text="">/);
	});
});
