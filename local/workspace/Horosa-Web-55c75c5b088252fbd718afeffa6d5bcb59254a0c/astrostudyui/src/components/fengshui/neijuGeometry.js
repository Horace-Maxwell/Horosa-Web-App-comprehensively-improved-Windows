// 室内凶局 · 几何自动检测。
//
// 🔴 三层诚实防线（承接图像分析一贯口径）：
//   ① **只对有充分输入的项给判定**：缺相应标记者一律不判，并如实列出「缺什么标记」，
//      绝不用「没检测到」冒充「没有此凶局」。
//   ② **判定是建议，人工勾选优先**：本模块只回 suggested，不改用户已勾之项；
//      两者不一致时同屏并陈，由人裁决。
//   ③ **每条给证据**（坐标、距离、偏角、比值），使人能逐条复核，不做黑箱结论。
//
// 判据一律取保守阈值：宁可漏报（标 needsManual），不可误报。
import { NEIJU_XINGXING_10 } from './fengshuiZhaiduanData';

const HYPOT = (a, b)=>Math.sqrt(a * a + b * b);

// 「正对」：两点连线与水平/垂直轴的偏角 ≤ tolDeg，且距离 ≤ maxDist（相对房屋对角线的比例）。
function facing(a, b, diag, tolDeg = 15, maxRatio = 1) {
	if (!a || !b) { return null; }
	const dx = b.x - a.x; const dy = b.y - a.y;
	const dist = HYPOT(dx, dy);
	if (!dist) { return null; }
	const ang = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);       // 0..180
	// 与 0°/90°/180° 的最小夹角
	const off = Math.min(ang, Math.abs(ang - 90), Math.abs(ang - 180));
	const ok = off <= tolDeg && dist <= diag * maxRatio;
	return { ok, dist: Math.round(dist), offDeg: Math.round(off * 10) / 10,
		axis: Math.abs(dx) >= Math.abs(dy) ? '横向' : '纵向' };
}

const pick = (markers, ids)=>(markers || []).filter((m)=>ids.indexOf(m.type) >= 0);
const first = (markers, ids)=>pick(markers, ids)[0] || null;

// 条目 → 原子项索引（与 fengshuiZhaiduanData 的 atoms 顺序一一对应，序错即判错项）。
const ATOM = (key, label)=>{
	const c = NEIJU_XINGXING_10.find((x)=>x.key === key);
	const i = c ? c.atoms.indexOf(label) : -1;
	return { key, idx: i, label };
};

// 主入口。
//   rect: { w, h }（房屋框尺寸，任意单位）
//   outline: [{x,y}…]（房屋轮廓多边形，可选；给了才判缺角）
//   markers: [{ type, x, y, gong? }…]
//   gongAt: (x, y) => 宫号|null，由画布提供（唯一真值源 = getSectorForPoint，含盘面旋转）
//   zuoGong: 坐山宫号；centerGong 恒为 5
export function neijuDetect({ rect = null, outline = null, markers = [], gongAt = null, zuoGong = 0 } = {}) {
	const ms = Array.isArray(markers) ? markers.filter((m)=>m && typeof m.x === 'number' && typeof m.y === 'number') : [];
	const hasRect = rect && rect.w > 0 && rect.h > 0;
	const diag = hasRect ? HYPOT(rect.w, rect.h) : 0;
	const hits = [];        // 检出的凶局
	const skipped = [];     // 因输入不足未判者

	const need = (name, what)=>skipped.push({ name, missing: what });
	const add = (atom, evidence, conf)=>{
		if (atom.idx < 0) { return; }
		hits.push({ ...atom, evidence, confidence: conf });
	};

	// ── ① 宅形狭长横阔（九宫划分悬殊）──
	if (hasRect) {
		const ratio = Math.max(rect.w, rect.h) / Math.min(rect.w, rect.h);
		// 保守阈值：长宽比 ≥ 2.5 才判「狭长/横阔」（2:1 尚属常见户型，不报）。
		if (ratio >= 2.5) {
			const vertical = rect.h > rect.w;
			add(ATOM('xiachang', vertical ? '前后狭长（如竖尺）' : '左右横阔（如一字）'),
				`房屋框 ${Math.round(rect.w)}×${Math.round(rect.h)}，长宽比 ${ratio.toFixed(2)} ≥ 2.5`, 'high');
		}
	} else { need('宅形狭长横阔', '房屋框尺寸'); }

	// ── ② 宅形缺角（按八宫）──
	// 🔴 方位绝不在此自行推定：画布的八宫是「北在上、再减去用户所转之角」，
	//    且盘可任意旋转（getDiskRotation）。此处若自铺九宫格，等于把方位算第二遍——
	//    与画布不一致时必出「看着像对」的错宫。故一律由调用方传 gongAt(x,y)，
	//    使 getSectorForPoint 始终是唯一真值源；不传则此条不判。
	if (outline && outline.length >= 4 && hasRect && typeof gongAt === 'function') {
		// 以外接矩形九宫格逐宫取样：宫中心点若落在轮廓外，判该宫缺角。
		const xs = outline.map((p)=>p.x); const ys = outline.map((p)=>p.y);
		const x0 = Math.min(...xs); const x1 = Math.max(...xs);
		const y0 = Math.min(...ys); const y1 = Math.max(...ys);
		const inPoly = (px, py)=>{
			let inside = false;
			for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
				const xi = outline[i].x; const yi = outline[i].y;
				const xj = outline[j].x; const yj = outline[j].y;
				const hit = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / ((yj - yi) || 1e-9) + xi);
				if (hit) { inside = !inside; }
			}
			return inside;
		};
		const GONG_GUA_CN = { 1: '坎', 2: '坤', 3: '震', 4: '巽', 6: '乾', 7: '兑', 8: '艮', 9: '离' };
		// 外接矩形上均匀取样，逐点问 gongAt 归哪一宫，再看该点是否在轮廓内。
		// 某宫取样点若「多数在外」方判缺角（单点在外可能只是墙线小凹，不足以言缺）。
		const N = 12;                       // 12×12 网格，每宫约 16 点
		const tally = {};                   // 宫 → { all, out }
		for (let i = 0; i < N; i++) {
			for (let j = 0; j < N; j++) {
				const px = x0 + (x1 - x0) * (i + 0.5) / N;
				const py = y0 + (y1 - y0) * (j + 0.5) / N;
				const g = gongAt(px, py);
				if (!g || g === 5) { continue; }
				const t = tally[g] || (tally[g] = { all: 0, out: 0, px, py });
				t.all += 1;
				if (!inPoly(px, py)) { t.out += 1; }
			}
		}
		Object.keys(tally).forEach((k)=>{
			const g = Number(k); const t = tally[k];
			if (!GONG_GUA_CN[g] || !t.all) { return; }
			const ratio = t.out / t.all;
			if (ratio >= 0.5) {
				add(ATOM('quejiao', `${GONG_GUA_CN[g]}宫缺角`),
					`该宫 ${t.all} 个取样点中 ${t.out} 点落在房屋轮廓之外（${Math.round(ratio * 100)}%）`, ratio >= 0.8 ? 'high' : 'medium');
			}
		});
	} else if (!(outline && outline.length >= 4)) {
		need('宅形缺角', '房屋轮廓多边形（只有矩形框无法判缺角）');
	} else if (typeof gongAt !== 'function') {
		need('宅形缺角', '八宫定位（须由画布传入 gongAt，方位不在本模块自行推定）');
	} else { need('宅形缺角', '房屋框尺寸'); }

	// ── ③ 卫生间在中宫或坐山方 ──
	const wc = first(ms, ['bathroom', 'toilet']);
	if (wc && wc.gong) {
		if (wc.gong === 5) { add(ATOM('weizhongzuo', '卫生间在中宫'), `卫生间标记落中宫`, 'high'); }
		if (zuoGong && wc.gong === zuoGong) { add(ATOM('weizhongzuo', '卫生间在坐山方'), `卫生间标记落坐山宫（${zuoGong}）`, 'high'); }
	} else if (!wc) { need('卫生间在中宫或坐山方', '卫生间／马桶标记'); }
	else { need('卫生间在中宫或坐山方', '标记所落之宫（需先定八宫线）'); }

	// ── ④ 开门见灶 / 见厕（见镜无标记，不判）──
	const door = first(ms, ['entryDoor']);
	if (door && hasRect) {
		const stove = first(ms, ['stove']);
		if (stove) {
			const f = facing(door, stove, diag, 15, 0.9);
			if (f && f.ok) { add(ATOM('kaimenjian', '开门见灶'), `门与灶${f.axis}相对，偏角 ${f.offDeg}°、距 ${f.dist}`, 'medium'); }
		} else { need('开门见灶', '灶台标记'); }
		const t = first(ms, ['toilet', 'bathroom']);
		if (t) {
			const f = facing(door, t, diag, 15, 0.9);
			if (f && f.ok) { add(ATOM('kaimenjian', '开门见厕'), `门与厕${f.axis}相对，偏角 ${f.offDeg}°、距 ${f.dist}`, 'medium'); }
		} else { need('开门见厕', '马桶／卫生间标记'); }
		need('开门见镜', '镜子标记（标记体系暂无此类）');
	} else { need('开门见灶／见厕／见镜', door ? '房屋框尺寸' : '入户门标记'); }

	// ── ⑤ 穿堂（大门直通到底）──
	if (door && hasRect) {
		const opens = pick(ms, ['window', 'balcony']);
		const through = opens.map((o)=>({ o, f: facing(door, o, diag, 12, 1.05) }))
			.filter((x)=>x.f && x.f.ok && x.f.dist >= diag * 0.6);   // 需贯穿大半个屋，才算「直通到底」
		if (through.length) {
			const b = through[0];
			add(ATOM('chuantang', '大门直通到底（穿堂）'),
				`门与${b.o.type === 'balcony' ? '阳台' : '窗'}${b.f.axis}贯通，偏角 ${b.f.offDeg}°、距 ${b.f.dist}（≥ 对角线 60%）`, 'medium');
		}
		if (!opens.length) { need('穿堂', '窗户／阳台标记'); }
	}
	need('客厅过于狭窄', '客厅范围（标记体系只有点标记，无房间范围）');

	// ── ⑥ 窗户过多过大 / 过少过小（只按计数给保守提示）──
	const wins = pick(ms, ['window']);
	if (hasRect && wins.length) {
		if (wins.length >= 8) { add(ATOM('chuanghu', '窗户过多过大'), `已标窗户 ${wins.length} 处`, 'low'); }
		if (wins.length <= 1) { add(ATOM('chuanghu', '窗户过少过小'), `仅标窗户 ${wins.length} 处`, 'low'); }
	} else { need('窗户失度', '窗户标记'); }
	need('窗形三角', '窗户形状（标记为点，无形状信息）');

	// ── ⑦ 炉灶失位（可判：正对大门／水槽；其余缺标记）──
	const stove2 = first(ms, ['stove']);
	if (stove2 && hasRect) {
		if (door) {
			const f = facing(stove2, door, diag, 15, 0.9);
			if (f && f.ok) { add(ATOM('luzao', '灶正对大门'), `灶与门${f.axis}相对，偏角 ${f.offDeg}°、距 ${f.dist}`, 'medium'); }
		}
		const sink = first(ms, ['sink']);
		if (sink) {
			const f = facing(stove2, sink, diag, 15, 0.35);           // 水槽在同一厨房内，取近距
			if (f && f.ok) { add(ATOM('luzao', '灶正对水槽'), `灶与水槽${f.axis}相对，偏角 ${f.offDeg}°、距 ${f.dist}`, 'medium'); }
		} else { need('灶正对水槽', '水槽标记'); }
		['灶正对卧室门', '灶正对厨房门', '灶正对厕所门', '灶正对过道尽头', '灶正对冰箱']
			.forEach((a)=>need(a, '相应标记（标记体系暂无内门／过道／冰箱）'));
		need('厨房地面高于客厅或房间', '地面标高（平面图无高程信息）');
	} else { need('炉灶失位', '灶台标记'); }

	// ── ⑧ 横梁压顶（无梁标记，整条不判）──
	['梁压门', '梁压床', '梁压书桌', '梁压餐桌'].forEach((a)=>need(a, '横梁标记（标记体系暂无此类）'));

	// ── ⑨ 床位不利（可判：床头正对浴厕；其余缺标记）──
	const bed = first(ms, ['bed']);
	if (bed && hasRect) {
		const t2 = first(ms, ['toilet', 'bathroom']);
		if (t2) {
			const f = facing(bed, t2, diag, 15, 0.6);
			if (f && f.ok) { add(ATOM('chuangwei', '床头正对浴厕'), `床与浴厕${f.axis}相对，偏角 ${f.offDeg}°、距 ${f.dist}`, 'medium'); }
		} else { need('床头正对浴厕', '马桶／卫生间标记'); }
		const w2 = pick(ms, ['window']);
		if (w2.length) {
			const near = w2.map((w)=>({ w, d: HYPOT(w.x - bed.x, w.y - bed.y) })).sort((a, b)=>a.d - b.d)[0];
			if (near.d <= diag * 0.1) {
				add(ATOM('chuangwei', '床头开大窗'), `床与最近窗户距 ${Math.round(near.d)}（≤ 对角线 10%）——须人工确认是否在床头侧`, 'low');
			}
		}
		['床有柱角冲射', '床侧安大镜'].forEach((a)=>need(a, '柱角／镜子标记（标记体系暂无此类）'));
	} else { need('床位不利', '床标记'); }

	// ── ⑩ 奇形怪状（需房间多边形，整条不判）──
	['有斜切三角形房间', '有梯形房间', '不规则房间作卧室或厨房']
		.forEach((a)=>need(a, '各房间多边形（当前只有整宅轮廓）'));

	// 去重（同一原子项可能被多路命中）
	const seen = new Set();
	const uniq = hits.filter((h)=>{ const k = `${h.key}#${h.idx}`; if (seen.has(k)) { return false; } seen.add(k); return true; });
	// 按条 key 聚合成 { 条key: [原子索引] }，可直接喂给 zhaiduan 的 neiXiong 入参
	const suggested = {};
	uniq.forEach((h)=>{ (suggested[h.key] = suggested[h.key] || []).push(h.idx); });
	Object.keys(suggested).forEach((k)=>{ suggested[k] = suggested[k].sort((a, b)=>a - b); });

	return {
		available: true, hasRect, hasOutline: !!(outline && outline.length >= 4),
		markerCount: ms.length,
		hits: uniq, suggested, skipped,
		verdict: uniq.length
			? { text: `几何自动检测出 ${uniq.length} 项可疑；另有 ${skipped.length} 项因输入不足未判`, jx: 'bad' }
			: { text: `几何自动检测未见可疑项；另有 ${skipped.length} 项因输入不足未判——「未检出」不等于「无此凶局」`, jx: 'neutral' },
		note: '🔴 本检测只作**建议**，不覆盖人工勾选；缺相应标记者一律不判并列于「未判之项」。'
			+ '「未检出」不等于「无此凶局」——凡列在未判之项者，仍须人工核。',
	};
}

export default neijuDetect;
