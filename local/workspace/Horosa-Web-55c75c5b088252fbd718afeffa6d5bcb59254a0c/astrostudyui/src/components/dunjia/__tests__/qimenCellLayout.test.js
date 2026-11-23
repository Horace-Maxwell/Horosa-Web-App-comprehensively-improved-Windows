// 奇门盘格附加字落位合同(奇门页大盘与三式合一盘共用 qimenCellLayout,写法 =「上挂下注」):
// 盘面尺寸 × 视觉缩放全扫,字最多的格子(两字天盘干、暗干两干 + 暗支、天寄 + 地寄、天禽、三个推演标记)也必须
//   ① 每项字框落在自己的空位里;② 与四角主字 / 门 / 宫名 / 驿马、与别的附加字都隔着安全距离(不贴、不挤);
//   ③ 字号不低于视觉绝对下限(放不下就退档 / 收起,绝不硬塞);④ 常规尺寸下一项都不收起、字达到视觉目标下限;
//   ⑤ 位置固定:暗干在门正上方、推演在门正下方、天寄在天盘干正上方、地寄在地盘干正下方、天禽在九星正下方(奇门页);
//      三式盘寄干紧跟所寄的干、天禽在九星上方,暗干与推演在格旁空格。
import {
	layoutQimenCell, qimenCellSlots, fitTokens, sanshiCellGeometry, sanshiSideGeometry, dunjiaCellGeometry, dunjiaCenterGeometry,
	dunjiaJianChuRingSlots, dunjiaRingFit, dunjiaCellInsets, qimenCellHasOverlay, SANSHI_SIDE_UNITS, DUNJIA_CELL, DUNJIA_RING,
	MIN_VISUAL_PX, HARD_MIN_VISUAL_PX, LINE_HEIGHT,
} from '../qimenCellLayout';

const clamp = (v, a, b)=>Math.max(a, Math.min(b, v));
const EPS = 0.01;
const hit = (a, b)=>a.w > 0 && a.h > 0 && b.w > 0 && b.h > 0 && a.x < b.x + b.w - EPS && b.x < a.x + a.w - EPS && a.y < b.y + b.h - EPS && b.y < a.y + a.h - EPS;
const grow = (r, d)=>({ x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d });
const inside = (b, s)=>b.x >= s.x - EPS && b.y >= s.y - EPS && b.x + b.w <= s.x + s.w + EPS && b.y + b.h <= s.y + s.h + EPS;
const cx = (r)=>r.x + r.w / 2;

// 与 SanshiUnitedBoard.renderQimenBlock 同一套尺寸推导
function sanshiGeom(boardSize, scale, cell){
	const qScale = clamp(boardSize / 600, 0.62, 1.28);
	const ringCellPx = boardSize * 0.111;
	const F = clamp(Math.round(19 * qScale), 10, 28);
	const doorSize = clamp(Math.round(22 * qScale), 9, Math.round(ringCellPx * 0.34));
	return sanshiCellGeometry({ cellPx: boardSize * 0.11, mainFont: F, doorSize, cell, scale });
}
const sideGeom = (boardSize, scale, cell)=>sanshiSideGeometry({ unitPx: boardSize / 9, scale, cell });

const CROWDED = {
	palaceNum: 9, palaceName: '乾', tianGan: '己丙', god: '玄', diGan: '辛', tianXing: '柱', door: '开',
	anGan: '丁辛', anZhi: '卯', jiTianGan: '辛', jiDiGan: '丙', tianQin: true, tuiYanTags: ['用', '上1', '下2'], isYiMa: true,
};
const TYPICAL = { ...CROWDED, tianGan: '丁', jiDiGan: '', tuiYanTags: ['用', '上1'] };

// 通用检查:字框在空位里、离固定块 ≥ safe、项与项之间 ≥ safe、不低于绝对下限
function check(g, cell, label){
	const r = layoutQimenCell(cell, g);
	const safe = g.safe || 0;
	const fixed = [g.tl, g.tr, g.bl, g.br, g.door].concat(g.avoid || []).filter(Boolean);
	r.items.forEach((it)=>{
		expect([label, it.key, 'inSlot', inside(it.box, it.slot)]).toEqual([label, it.key, 'inSlot', true]);
		expect([label, it.key, 'inCell', inside(it.box, { x: 0, y: 0, w: g.w, h: g.h })]).toEqual([label, it.key, 'inCell', true]);
		expect([label, it.key, it.font * g.scale >= HARD_MIN_VISUAL_PX - 0.26]).toEqual([label, it.key, true]);
		fixed.forEach((f)=>expect([label, it.key, 'safe', hit(grow(it.box, safe - EPS * 2), f)]).toEqual([label, it.key, 'safe', false]));
	});
	r.items.forEach((a, i)=>r.items.slice(i + 1).forEach((b)=>expect([label, a.key, b.key, hit(grow(a.box, safe - EPS * 2), b.box)]).toEqual([label, a.key, b.key, false])));
	return r;
}

describe('奇门页大盘:上挂下注 + 安全距离', ()=>{
	const ringK = dunjiaRingFit().k;
	it('整盘缩放 0.45–1.2 × 壳缩放 1 / 1.8 × 外环开关,最挤的格子:字框隔着安全距离、不出格、不低于绝对下限', ()=>{
		for(let k = 0.45; k <= 1.2001; k += 0.05){
			[1, 1.8].forEach((z)=>[1, ringK].forEach((rk)=>{
				[1, 2, 3, 4, 6, 7, 8, 9].forEach((pn)=>{
					const cell = { ...CROWDED, palaceNum: pn, palaceName: '巽离坤震中兑艮坎乾'[pn - 1] };
					check(dunjiaCellGeometry({ cell, roomy: true, scale: k * z * rk }), cell, `奇门 宫${pn} ${k.toFixed(2)}@${z}×${rk.toFixed(3)}`);
				});
			}));
		}
	});
	it('位置固定:暗干在门正上方、推演在门正下方、天寄在天盘干正上方、地寄在地盘干正下方、天禽在九星正下方', ()=>{
		const g = dunjiaCellGeometry({ cell: TYPICAL, roomy: true, scale: 0.846 * ringK });
		const r = check(g, { ...TYPICAL, jiDiGan: '丙' }, '常规');
		const at = (k)=>r.items.find((it)=>it.key === k);
		const safe = DUNJIA_CELL.safe;
		expect(at('anGan').box.y + at('anGan').box.h).toBeLessThanOrEqual(g.door.y - safe + EPS);
		expect(Math.abs(cx(at('anGan').box) - cx(g.door))).toBeLessThan(0.5);
		expect(at('tuiYan').box.y).toBeGreaterThanOrEqual(g.door.y + g.door.h + safe - EPS);
		expect(Math.abs(cx(at('tuiYan').box) - cx(g.door))).toBeLessThan(0.5);
		expect(at('jiTian').box.y + at('jiTian').box.h).toBeLessThanOrEqual(g.tl.y - safe + EPS);
		expect(Math.abs(cx(at('jiTian').box) - cx(g.tl))).toBeLessThan(0.5);
		expect(at('jiDi').box.y).toBeGreaterThanOrEqual(g.bl.y + g.bl.h + safe - EPS);
		expect(Math.abs(cx(at('jiDi').box) - cx(g.bl))).toBeLessThan(0.5);
		expect(at('tianQin').box.y).toBeGreaterThanOrEqual(g.br.y + g.br.h + safe - EPS);
		expect(Math.abs(cx(at('tianQin').box) - cx(g.br))).toBeLessThan(0.5);
		// 写法:寄干带前缀小「寄」、天禽写全称、暗干两干 + 暗支排成两行(「丁辛 / 卯」,不把两干拆开)
		expect(at('jiTian').lines.flat().map((t)=>`${t.pre ? '^' : ''}${t.text}`)).toEqual(['^寄', '辛']);
		expect(at('tianQin').lines.flat().map((t)=>t.text).join('')).toBe('天禽');
		// 暗干两干 + 暗支:留白档门上竖条一行放得下;放不下时只在词与词之间换行(「丁辛 / 卯」,不把两干拆开)
		expect(at('anGan').lines.map((ln)=>ln.map((t)=>t.text).join('')).join('/')).toMatch(/^(丁辛卯|丁辛\/卯)$/);
	});
	it('常规尺寸(boardScale 0.846,外环开着)一项不收起;同一宫附加字用同一首选字号(整盘一致、不忽大忽小)', ()=>{
		const scale = 0.846 * ringK;
		[1, 2, 3, 4, 6, 7, 8, 9].forEach((pn)=>{
			const cell = { ...TYPICAL, palaceNum: pn, palaceName: '巽离坤震中兑艮坎乾'[pn - 1], anGan: '戊', anZhi: '辰', jiDiGan: '丙' };
			const r = check(dunjiaCellGeometry({ cell, roomy: true, scale }), cell, `常规 宫${pn}`);
			expect([pn, r.hidden.map((h)=>h.key)]).toEqual([pn, []]);
			r.items.forEach((it)=>{
				expect([pn, it.key, it.font]).toEqual([pn, it.key, it.kind === 'tag' ? DUNJIA_CELL.tagFont : DUNJIA_CELL.minorFont]);
				expect(it.font * scale).toBeGreaterThanOrEqual(MIN_VISUAL_PX - 0.26);
			});
		});
	});
	it('两字八神把门上的竖条挤没:暗干退到门的右边;再挤就收起进 title,绝不硬塞', ()=>{
		const cell = { ...TYPICAL, god: '白虎' };
		const g = dunjiaCellGeometry({ cell, roomy: true, scale: 0.846 });
		const r = check(g, cell, '两字八神');
		expect(r.items.find((it)=>it.key === 'anGan').box.x).toBeGreaterThanOrEqual(g.door.x + g.door.w + DUNJIA_CELL.safe - EPS);
		const squeezed = { ...g, slots: { ...g.slots, aboveDoor: { ...g.slots.aboveDoor, w: 4 }, rightOfDoor: { ...g.slots.rightOfDoor, h: 4 } } };
		const s = layoutQimenCell(cell, squeezed);
		expect(s.hidden.map((h)=>h.key)).toContain('anGan');
		expect(s.hidden.find((h)=>h.key === 'anGan').title).toBe('暗干 丁辛 · 暗支 卯');
	});
	it('主字内缩两档:没有附注 = 老样子(左右 52 / 上下 40);有附注 = 留白档,四角主字往外让、门上门下各多出空间', ()=>{
		expect(dunjiaCellInsets(false)).toEqual({ x: 52, y: 40 });
		const roomy = dunjiaCellInsets(true);
		expect(roomy.x).toBeLessThan(52);
		expect(roomy.y).toBeLessThan(40);
		expect(qimenCellHasOverlay({ tianGan: '丙' })).toBe(false);
		['anGan', 'jiTianGan', 'jiDiGan'].forEach((k)=>expect(qimenCellHasOverlay({ [k]: '辛' })).toBe(true));
		expect(qimenCellHasOverlay({ tianQin: true })).toBe(true);
		expect(qimenCellHasOverlay({ tuiYanTags: ['用'] })).toBe(true);
		expect(qimenCellHasOverlay({ tuiYanTags: [] })).toBe(false);
		// 留白档下门上那一竖条比常规档宽(暗干三字一行放得下),门与上下两排主字之间的缝更大
		const a = dunjiaCellGeometry({ cell: TYPICAL, scale: 1 });
		const b = dunjiaCellGeometry({ cell: TYPICAL, scale: 1, roomy: true });
		expect(b.slots.aboveDoor.w).toBeGreaterThan(a.slots.aboveDoor.w);
		expect(b.door.y - (b.tl.y + b.tl.h)).toBeGreaterThan(a.door.y - (a.tl.y + a.tl.h));
	});
	it('空位按安全距离从主字 / 门 / 宫名 / 驿马退过:哪一块都不与它们(外扩 safe)相交', ()=>{
		[1, 2, 3, 4, 6, 7, 8, 9].forEach((pn)=>{
			const cell = { ...CROWDED, palaceNum: pn, palaceName: '巽离坤震中兑艮坎乾'[pn - 1] };
			const g = dunjiaCellGeometry({ cell, roomy: true, scale: 1 });
			const slots = qimenCellSlots(g);
			const fixed = [g.tl, g.tr, g.bl, g.br, g.door].concat(g.avoid).map((f)=>grow(f, g.safe - EPS * 2));
			Object.keys(slots).forEach((k)=>fixed.forEach((f)=>expect([pn, k, hit(slots[k], f)]).toEqual([pn, k, false])));
		});
	});
});

describe('三式盘:格内寄干天禽 + 格旁空格暗干推演', ()=>{
	it('盘边 300–900 px × 缩放 1 / 1.25 / 1.4 / 1.8:格内与格旁空格的字框都在空位里、隔着安全距离、不低于绝对下限', ()=>{
		for(let size = 300; size <= 900; size += 20){
			[1, 1.25, 1.4, 1.8].forEach((z)=>{
				check(sanshiGeom(size, z, CROWDED), CROWDED, `三式格内 ${size}@${z}`);
				const side = check(sideGeom(size, z, CROWDED), CROWDED, `三式格旁 ${size}@${z}`);
				// 格旁空格只管暗干与推演;格内只管寄干与天禽(两块几何各管各的,不重复画)
				side.items.forEach((it)=>expect(['anGan', 'tuiYan']).toContain(it.key));
			});
		}
		const inCell = layoutQimenCell(CROWDED, sanshiGeom(560, 1, CROWDED));
		expect(inCell.items.concat(inCell.hidden).map((it)=>it.key).sort()).toEqual(['jiDi', 'jiTian', 'tianQin']);
	});
	it('常规尺寸(盘边 560)一项不收起:寄干紧跟所寄的干同行、天禽在九星上方;暗干带前缀「暗」与推演上下各占格旁空格一半', ()=>{
		const g = sanshiGeom(560, 1, TYPICAL);
		const r = check(g, TYPICAL, '三式 560');
		expect(r.hidden).toEqual([]);
		const ji = r.items.find((it)=>it.key === 'jiTian');
		expect(ji.lines.flat().map((t)=>t.text).join('')).toBe('辛');
		expect(ji.box.x).toBeGreaterThanOrEqual(g.tl.x + g.tl.w);
		// 底边贴着天盘干底边(门顶再往上退安全距离,所以最多高出 1px)
		expect(ji.box.y + ji.box.h).toBeLessThanOrEqual(g.tl.y + g.tl.h + EPS);
		expect(ji.box.y + ji.box.h).toBeGreaterThan(g.tl.y + g.tl.h - 1);
		const q = r.items.find((it)=>it.key === 'tianQin');
		expect(q.box.y + q.box.h).toBeLessThanOrEqual(g.br.y);
		const sg = sideGeom(560, 1, TYPICAL);
		const s = check(sg, TYPICAL, '格旁 560');
		expect(s.hidden).toEqual([]);
		const an = s.items.find((it)=>it.key === 'anGan');
		const ty = s.items.find((it)=>it.key === 'tuiYan');
		expect(an.lines.flat().map((t)=>`${t.pre ? '^' : ''}${t.text}`).join('')).toBe('^暗丁辛卯');
		expect(an.box.y + an.box.h).toBeLessThanOrEqual(sg.h / 2);
		expect(ty.box.y).toBeGreaterThanOrEqual(sg.h / 2);
		[an, ty].forEach((it)=>expect(it.font).toBeGreaterThanOrEqual(MIN_VISUAL_PX - 0.26));
	});
	it('天盘干两字(寄宫)把同一行挤没时,天寄退到天盘干与地盘干之间;只有一项时格旁空格整格居中', ()=>{
		const g = sanshiGeom(560, 1, CROWDED);
		const r = check(g, CROWDED, '两字天盘干');
		const ji = r.items.find((it)=>it.key === 'jiTian');
		expect(ji.box.y).toBeGreaterThanOrEqual(g.tl.y + g.tl.h);
		const only = { ...TYPICAL, tuiYanTags: [] };
		const s = layoutQimenCell(only, sideGeom(560, 1, only));
		const an = s.items[0];
		expect(Math.abs(an.box.y + an.box.h / 2 - (560 / 9) / 2)).toBeLessThan(0.5);
	});
	it('格旁空格是奇门环上本来空着的那一格:八宫各一格、互不相同,且不与任何奇门格同格', ()=>{
		const blocks = { 1: [1, 1], 2: [4, 1], 3: [7, 1], 4: [1, 4], 6: [7, 4], 7: [1, 7], 8: [4, 7], 9: [7, 7] };
		const used = new Set(Object.values(blocks).map((p)=>p.join(',')));
		const sides = Object.keys(blocks).map((n)=>SANSHI_SIDE_UNITS[n]);
		sides.forEach((p)=>{
			expect(used.has(p.join(','))).toBe(false);
			expect(p[0] === 1 || p[0] === 7 || p[1] === 1 || p[1] === 7).toBe(true);   // 在奇门环(第 1 / 7 行或列)上
		});
		expect(new Set(sides.map((p)=>p.join(','))).size).toBe(8);
		// 与本宫相邻(紧挨着)
		Object.keys(blocks).forEach((n)=>{
			const [a, b] = blocks[n];
			const [c, d] = SANSHI_SIDE_UNITS[n];
			expect(Math.abs(a - c) + Math.abs(b - d)).toBe(1);
		});
	});
});

describe('奇门页十二建星外环', ()=>{
	it('十二支按方位一圈:午上中、子下中、卯左中、酉右中;左右两边竖排;都落在外环带里、不压九宫', ()=>{
		const slots = dunjiaJianChuRingSlots();
		const { inner, outer } = dunjiaRingFit();
		const M = DUNJIA_RING.margin;
		expect(slots.map((s)=>s.zhi).sort().join('')).toBe('丑亥午卯子寅巳戌未申辰酉'.split('').sort().join(''));
		const at = Object.fromEntries(slots.map((s)=>[s.zhi, s]));
		expect([at.午.x, at.午.y]).toEqual([outer / 2, M / 2]);
		expect([at.子.x, at.子.y]).toEqual([outer / 2, outer - M / 2]);
		expect([at.卯.x, at.卯.y]).toEqual([M / 2, outer / 2]);
		expect([at.酉.x, at.酉.y]).toEqual([outer - M / 2, outer / 2]);
		// 巽(左上)外是辰巳、坤(右上)外是未申、艮(左下)外是丑寅、乾(右下)外是戌亥
		expect(at.巳.x).toBeLessThan(at.午.x);
		expect(at.辰.y).toBeLessThan(at.卯.y);
		expect(at.亥.x).toBeGreaterThan(at.子.x);
		expect(at.寅.y).toBeGreaterThan(at.卯.y);
		slots.forEach((s)=>{
			expect([s.zhi, s.vertical]).toEqual([s.zhi, '寅卯辰申酉戌'.includes(s.zhi)]);
			// 字中心在外环带中线上:离九宫至少半个外环带
			const inGrid = s.x > M && s.x < M + inner && s.y > M && s.y < M + inner;
			expect([s.zhi, inGrid]).toEqual([s.zhi, false]);
		});
	});
	it('外环开着时整块等比缩回原边长(盘头、图例与整盘高度都不变)', ()=>{
		const { inner, outer, k } = dunjiaRingFit();
		expect(inner).toBe(662);
		expect(outer * k).toBeCloseTo(inner, 6);
	});
});

// 字号被夹在下限上时,向下取整 0.1 px 后会比下限小一点点,若据此判成放不下,附注整项消失,
// 而且消不消失只取决于「下限 ÷ 缩放比」落不落在 0.1 的格点上(某些窗口尺寸全没,换一档缩放却正常)。
// 所以合同除了「放下去的项摆得对不对」,还要查「该出的有没有出」。
describe('该出的必须出:不因缩放比例落不落在格点上而时有时无', ()=>{
	const ONE = { palaceNum: 9, palaceName: '乾', tianGan: '丁', god: '玄', diGan: '辛', tianXing: '柱', door: '开', anGan: '戊', anZhi: '辰', jiTianGan: '辛', jiDiGan: '丙', tianQin: true, tuiYanTags: ['上1'] };
	const ALL = ['anGan', 'jiDi', 'jiTian', 'tianQin', 'tuiYan'];
	it('fitTokens 判定 = 「下限字号(进到 0.1 格点)真放得下」;放得下时字号 ≥ 下限、≤ max(首选, 下限) 且确实在空位里', ()=>{
		let seed = 20261121;
		const rnd = ()=>{ seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
		const EMS = [0.8, 1, 1.62, 2.02, 1.4, 2];
		for(let i = 0; i < 4000; i++){
			const n = 1 + Math.floor(rnd() * 4);
			const tokens = Array.from({ length: n }, ()=>({ text: 'x', em: EMS[Math.floor(rnd() * EMS.length)] }));
			const slot = { x: 0, y: 0, w: 4 + rnd() * 80, h: 4 + rnd() * 80 };
			const minFont = 6 + rnd() * 14;
			const maxFont = 6 + rnd() * 14;
			const sep = rnd() < 0.5 ? 0 : 0.3;
			const floor = Math.ceil(minFont * 10 - 1e-6) / 10;
			const widestOf = (rows)=>{
				const per = Math.ceil(n / rows);
				let w = 0;
				for(let k = 0; k < n; k += per){ const ln = tokens.slice(k, k + per); w = Math.max(w, ln.reduce((a, t)=>a + t.em, 0) + sep * (ln.length - 1)); }
				return [w, Math.ceil(n / per)];
			};
			let fits = false;
			for(let rows = 1; rows <= n; rows++){
				const [w, lines] = widestOf(rows);
				if(floor * w <= slot.w + 1e-9 && floor * lines * LINE_HEIGHT <= slot.h + 1e-9){ fits = true; }
			}
			const r = fitTokens(tokens, slot, { maxFont, minFont, sep });
			expect([i, !!r]).toEqual([i, fits]);
			if(r){
				expect(r.font).toBeGreaterThanOrEqual(minFont - 1e-9);
				expect(r.font).toBeLessThanOrEqual(Math.max(maxFont, floor) + 1e-9);
				const w = Math.max(...r.lines.map((ln)=>ln.reduce((a, t)=>a + t.em, 0) + sep * (ln.length - 1))) * r.font;
				expect(w).toBeLessThanOrEqual(slot.w + 1e-6);
				expect(r.lines.length * r.font * LINE_HEIGHT).toBeLessThanOrEqual(slot.h + 1e-6);
			}
		}
	});
	it('奇门页大盘:视觉缩放 0.50–1.20 逐千分之一扫,五项一项都不收起、都不低于 8px;≥ 0.57 时全部 ≥ 9.5px', ()=>{
		const bad = [];
		for(let i = 500; i <= 1200; i++){
			const sc = i / 1000;
			const r = layoutQimenCell(ONE, dunjiaCellGeometry({ cell: ONE, roomy: true, scale: sc }));
			if(r.hidden.length){ bad.push([sc, '收起', r.hidden.map((h)=>h.key).join()]); continue; }
			r.items.forEach((it)=>{
				const v = it.font * sc;
				if(v < HARD_MIN_VISUAL_PX - 1e-6 || (sc >= 0.57 && v < MIN_VISUAL_PX - 1e-6)){ bad.push([sc, it.key, v.toFixed(2)]); }
			});
			expect([sc, r.items.map((it)=>it.key).sort()]).toEqual([sc, ALL]);
		}
		expect(bad).toEqual([]);
	});
	it('三式盘:盘边 425 / 480 / 560 / 640 / 720 / 900 × 壳缩放 0.70–1.80 逐百分之一扫,格内与格旁空格一项都不收起、都不低于 8px', ()=>{
		const bad = [];
		[425, 480, 560, 640, 720, 900].forEach((size)=>{
			for(let i = 70; i <= 180; i++){
				const z = i / 100;
				const a = layoutQimenCell(ONE, sanshiGeom(size, z, ONE));
				const b = layoutQimenCell(ONE, sideGeom(size, z, ONE));
				const hid = a.hidden.concat(b.hidden).map((h)=>h.key);
				if(hid.length){ bad.push([size, z, '收起', hid.join()]); }
				a.items.concat(b.items).forEach((it)=>{ if(it.font * z < HARD_MIN_VISUAL_PX - 1e-6){ bad.push([size, z, it.key, (it.font * z).toFixed(2)]); } });
				expect([size, z, a.items.concat(b.items).map((it)=>it.key).sort()]).toEqual([size, z, hid.length ? expect.anything() : ALL]);
			}
		});
		expect(bad).toEqual([]);
	});
	it('推演标记先保整条链:目标字号放不下整条时退到绝对下限仍写全,不提前只留第一个(三式默认窗口盘边 425 的两签宫)', ()=>{
		const two = { ...ONE, tuiYanTags: ['上3', '下1'] };
		const r = layoutQimenCell(two, sideGeom(425, 1, two));
		const ty = r.items.find((it)=>it.key === 'tuiYan');
		expect(ty.lines.flat().map((t)=>t.text)).toEqual(['上3', '下1']);
		expect(ty.short).toBe(false);
		expect(ty.font).toBeGreaterThanOrEqual(HARD_MIN_VISUAL_PX);
		expect(ty.font).toBeLessThan(MIN_VISUAL_PX);   // 确是退到绝对下限档才放下的(否则这条用例没在测次序)
		// 整条链在绝对下限也放不下时才只留第一个
		const many = { ...ONE, tuiYanTags: ['用', '上1', '下2', '转离'] };
		const m = layoutQimenCell(many, sideGeom(360, 1, many)).items.find((it)=>it.key === 'tuiYan');
		expect(m.short).toBe(true);
		expect(m.lines.flat().map((t)=>t.text)).toEqual(['用']);
	});
	it('盘小时字号按下限放大(首选 14 → 9.5 ÷ 缩放比),不是缩在首选字号上掉到 8px 档', ()=>{
		const sc = 0.62;
		const r = layoutQimenCell(ONE, dunjiaCellGeometry({ cell: ONE, roomy: true, scale: sc }));
		r.items.forEach((it)=>{
			expect([it.key, it.font > DUNJIA_CELL.minorFont]).toEqual([it.key, true]);
			expect(it.font * sc).toBeGreaterThanOrEqual(MIN_VISUAL_PX - 1e-6);
			expect(it.font * sc).toBeLessThan(MIN_VISUAL_PX + 0.1);
		});
	});
});

// 转盘中宫格只有天盘干与「五合X」两行大字;暗干排入中五宫的起法(时干加值使·飞布 / 满盘旋转飞)此前盘上不显示(快照里有)
describe('奇门页转盘中宫:暗干挂在两行大字下方', ()=>{
	const CENTER = { palaceNum: 5, palaceName: '中', tianGan: '辛', isCenter: true, anGan: '癸', anZhi: '酉' };
	const TEXTS = ['辛', '五合丙'];
	it('落在两行大字正下方、居中、隔着安全距离、不出格;写法 = 小「暗」+ 暗干暗支', ()=>{
		const g = dunjiaCenterGeometry({ texts: TEXTS, scale: 0.846 });
		expect([g.stack.y, g.stack.h, g.stack.w]).toEqual([(214 - 68) / 2, 68, 96]);   // 两行 32 + 行距 4 居中;最宽一行三字
		const r = layoutQimenCell(CENTER, g);
		expect(r.hidden).toEqual([]);
		expect(r.items.map((it)=>it.key)).toEqual(['anGan']);
		const an = r.items[0];
		expect(an.lines.flat().map((t)=>`${t.pre ? '^' : ''}${t.text}`).join('')).toBe('^暗癸酉');
		expect(an.box.y).toBeGreaterThanOrEqual(g.stack.y + g.stack.h + DUNJIA_CELL.safe - EPS);
		expect(Math.abs(cx(an.box) - 107)).toBeLessThan(0.5);
		expect(inside(an.box, { x: DUNJIA_CELL.edge, y: DUNJIA_CELL.edge, w: 214 - 2 * DUNJIA_CELL.edge, h: 214 - 2 * DUNJIA_CELL.edge })).toBe(true);
		expect(an.font).toBe(DUNJIA_CELL.minorFont);   // 与其余八宫的暗干同一首选字号
	});
	it('视觉缩放 0.45–1.20 逐千分之一扫:中宫暗干不收起、不低于 9.5px(下方空间富余);只有一行大字时同样成立', ()=>{
		const bad = [];
		[TEXTS, ['辛']].forEach((texts)=>{
			for(let i = 450; i <= 1200; i++){
				const sc = i / 1000;
				const g = dunjiaCenterGeometry({ texts, scale: sc });
				const r = layoutQimenCell(CENTER, g);
				const an = r.items.find((it)=>it.key === 'anGan');
				if(!an || an.font * sc < MIN_VISUAL_PX - 1e-6 || an.box.y < g.stack.y + g.stack.h + DUNJIA_CELL.safe - EPS || !inside(an.box, { x: 0, y: 0, w: 214, h: 214 })){ bad.push([texts.length, sc, an ? an.font : 'hidden']); }
			}
		});
		expect(bad).toEqual([]);
	});
	it('中宫这块几何只管暗干与推演标记(寄干 / 天禽不落中宫);没有暗干就什么都不画', ()=>{
		const g = dunjiaCenterGeometry({ texts: TEXTS, scale: 1 });
		expect(Object.keys(g.plan).sort()).toEqual(['anGan', 'tuiYan']);
		expect(layoutQimenCell({ palaceNum: 5, tianGan: '辛', isCenter: true }, g).items).toEqual([]);
		const both = layoutQimenCell({ ...CENTER, tuiYanTags: ['用'] }, g);
		expect(both.hidden).toEqual([]);
		const [a, b] = ['anGan', 'tuiYan'].map((k)=>both.items.find((it)=>it.key === k).box);
		expect(hit(grow(a, DUNJIA_CELL.safe - EPS * 2), b)).toBe(false);
	});
});

