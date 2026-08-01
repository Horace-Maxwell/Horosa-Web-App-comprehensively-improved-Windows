// 汉堡学派（Uranian）中点盘核心引擎 —— 纯函数、可单测。
// 盘基: 90/45/22.5/11.25 = 谐波 4/8/16/32。投影/中点/同轴读数/中点树。

export const DIAL_BASES = [90, 45, 22.5, 11.25];

const norm360 = (x) => ((x % 360) + 360) % 360;

// 黄经 → 盘面视觉角(0..360)，在一个 base 周期内压缩一圈。
export function projectToDial(lon, base){
	return (norm360(lon) % base) / base * 360;
}

// 近轴中点（与后端 midpoint.py 同口径）。
export function midpoint(a, b){
	let m = norm360((a + b) / 2);
	if (Math.abs(m - norm360(a)) > 90) m = norm360(m + 180);
	return m;
}

// 两点在 base 盘上的最短角距（折算回黄道度）。
export function dialSeparation(lonA, lonB, base){
	const d = Math.abs(norm360(lonA - lonB) % base);
	return Math.min(d, base - d);
}

// 个人点（Basic Six：日月+Asc/MC+南北交+白羊点）——扫描默认只显含个人点的图，减少过载。
const isP = (id, personal) => !personal || personal.has(id);

// 个人点放宽容许度(可选,向后兼容):opts.orbPersonal 给定且 > orb、且某 id 属个人点集时,该图用放宽容许度;
// 否则一律用基础 orb(opts.orbPersonal 缺省 → 与历史逐位等价,既有 14 例不受影响)。
// 注:个人点集取 opts.personal(即便 onlyPersonal=false 也据它判放宽),无 personal 集时不放宽。
function effOrb(orb, opts, ...ids){
	const po = opts && Number(opts.orbPersonal);
	const set = opts && opts.personal;
	if (!set || !Number.isFinite(po) || po <= orb) return orb;
	for (let i = 0; i < ids.length; i++){ if (set.has(ids[i])) return po; }
	return orb;
}

// 指针读数：盘上与 cursor 同轴(orb 内)的 ①星体 ②中点(A/B) —— 即汉堡 planetary picture 读法。
// points: [{ id, lon }]（行星+三王+北交+Asc/MC+8 TNP+白羊点）。opts.personal = Set 时只显含个人点的图。
// opts.orbPersonal(可选):含个人点的图放宽到该容许度(默认=orb,零回归)。
// opts.sum / opts.arc(可选,WP-5):为真时【追加】两类读数项(kind:'sum'=A+B 和点同轴 / kind:'arc'=A∠B 差距同轴)。
//   缺省(不传 sum/arc)=与历史逐位等价,既有 dial 测试不受影响(只追加,绝不改 body/mid 两类既有项)。
export function cursorReadout(points, cursorLon, base, orb, opts){
	const personal = opts && opts.onlyPersonal && opts.personal ? opts.personal : null;
	const wantSum = !!(opts && opts.sum);
	const wantArc = !!(opts && opts.arc);
	const hits = [];
	for (let i = 0; i < points.length; i++){
		const sep = dialSeparation(points[i].lon, cursorLon, base);
		if (sep <= effOrb(orb, opts, points[i].id) && isP(points[i].id, personal)) hits.push({ kind: 'body', id: points[i].id, sep });
	}
	for (let i = 0; i < points.length; i++){
		for (let j = i + 1; j < points.length; j++){
			const sep = dialSeparation(midpoint(points[i].lon, points[j].lon), cursorLon, base);
			if (sep <= effOrb(orb, opts, points[i].id, points[j].id) && (!personal || personal.has(points[i].id) || personal.has(points[j].id))) hits.push({ kind: 'mid', a: points[i].id, b: points[j].id, sep });
		}
	}
	// —— 追加层(仅 opts.sum / opts.arc 显式为真时)：和点(A+B 折算盘位)/差距(A∠B 最短角距)同轴 ——
	if (wantSum){
		for (let i = 0; i < points.length; i++){
			for (let j = i + 1; j < points.length; j++){
				const sep = dialSeparation(sumPoint(points[i].lon, points[j].lon), cursorLon, base);
				if (sep <= effOrb(orb, opts, points[i].id, points[j].id) && (!personal || personal.has(points[i].id) || personal.has(points[j].id))) hits.push({ kind: 'sum', a: points[i].id, b: points[j].id, sep });
			}
		}
	}
	if (wantArc){
		for (let i = 0; i < points.length; i++){
			for (let j = i + 1; j < points.length; j++){
				const sep = dialSeparation(arcOpening(points[i].lon, points[j].lon), cursorLon, base);
				if (sep <= effOrb(orb, opts, points[i].id, points[j].id) && (!personal || personal.has(points[i].id) || personal.has(points[j].id))) hits.push({ kind: 'arc', a: points[i].id, b: points[j].id, sep });
			}
		}
	}
	return hits.sort((x, y) => x.sep - y.sep);
}

// 中点树：给定点 P 列其完成的所有半和 A/B。行星图(A+B=C+D)由多个半和同轴自然涌现。
// opts.orbPersonal(可选):围绕个人点 P 的半和放宽到该容许度(默认=orb,零回归)。
export function midpointTree(points, base, orb, opts){
	const personal = opts && opts.onlyPersonal && opts.personal ? opts.personal : null;
	const tree = {};
	for (let k = 0; k < points.length; k++){
		const p = points[k];
		if (personal && !personal.has(p.id)) continue; // 只围绕个人点展开
		const pOrb = effOrb(orb, opts, p.id); // P 在个人点集时放宽(opts.orbPersonal 缺省=orb)
		const rows = [];
		for (let i = 0; i < points.length; i++){
			for (let j = i + 1; j < points.length; j++){
				if (points[i].id === p.id || points[j].id === p.id) continue;
				const sep = dialSeparation(midpoint(points[i].lon, points[j].lon), p.lon, base);
				if (sep <= pOrb) rows.push({ a: points[i].id, b: points[j].id, sep });
			}
		}
		if (rows.length) tree[p.id] = rows.sort((x, y) => x.sep - y.sep);
	}
	return tree;
}

// 防重叠字形避让(与全站星盘 desposeStars 同思路：挤在一起就把字形沿环顶开 + 连线指回真位)。
// items: [{ displayAngle, ... }]；返回按角排序 + 每项附 glyphAngle(避让后画字形)，displayAngle 仍是真位(画小点)。
export function spreadDialAngles(items, minGap){
	const norm = (x) => ((x % 360) + 360) % 360;
	const sorted = items.map((it) => ({ ...it, displayAngle: norm(it.displayAngle) })).sort((a, b) => a.displayAngle - b.displayAngle);
	let last = -Infinity;
	for (let i = 0; i < sorted.length; i++){
		let g = sorted[i].displayAngle;
		if (g - last < minGap) g = last + minGap;
		sorted[i].glyphAngle = g;
		last = g;
	}
	return sorted;
}

// ── 六宫框 定局法(House Frameworks)前端降级合成 ─────────────────────
// 后端缺 houseFrames 字段时(老服务/离线),用 /chart 的 angles/objects 黄经在前端等宫合成。
// 只【新增】函数、不改任何既有签名(既有 dial 测试是法律)。子午局赤道分宫前端不合成(需 houses_ex),
// 仅在后端缺字段时上升/太阳/月亮/交点/地球五个等宫框可降级;子午局降级时回退「上升局」近似(UI 提示)。

// 等宫框:给定 1 宫头黄经 anchorLon,返回 12 个宫头(每宫整 30°,跨 0° 归一)。
export function equalHouseFramework(anchorLon){
	const f = norm360(anchorLon);
	const cusps = [];
	for (let i = 0; i < 12; i++) cusps.push(norm360(f + 30 * i));
	return cusps;
}

// 点 lon 落第几宫(1..12)。按弧长口径,跨 0° 安全;不等距 cusps(若由后端给)同样适用。
// 与后端 houseframes._house_of 同口径。
export function planetHouse(lon, cusps){
	const L = norm360(lon);
	for (let i = 0; i < 12; i++){
		const a = cusps[i], b = cusps[(i + 1) % 12];
		if (norm360(L - a) < norm360(b - a)) return i + 1;
	}
	return 12;
}

// ── 映点 Spiegelpunkte(汉堡/古典通用)─────────────────────────────
// antiscion(回照)= 跨「日至轴」0°巨蟹/0°摩羯 镜像;contraAntiscion(对映)= 跨「分至轴」0°白羊/0°天秤 镜像。
// 校验:15°白羊(15)→ 回照 165(15°处女)、对映 345(15°双鱼)。公式与 Swiss Ephemeris/古典占星口径一致。
export function antiscion(lon){ return norm360(180 - lon); }
export function contraAntiscion(lon){ return norm360(360 - lon); }

// ── 行星图 Planetenbilder:敏感点和差式 A + B − C = D ───────────────
// 以「锚点」(个人点/TNP)为 A|B,遍历 C、D;D 落在 (A+B−C) 的 orb 内即一张行星图。
// points:[{id,lon}]。opts.personal / opts.uranian = Set(剪枝 + 排序:含个人点 > 含 TNP > 其他)。
// opts.limit 默认 40(防 O(n⁴) 组合过载,只截最相关者)。去重键 sorted(A,B)|C|D(A,B 对称)。
export function planetaryPictures(points, base, orb, opts){
	const personal = (opts && opts.personal) ? opts.personal : null;
	const uranian = (opts && opts.uranian) ? opts.uranian : null;
	const limit = (opts && opts.limit) ? opts.limit : 40;
	const anchorAll = !personal && !uranian;
	const isAnchor = (id) => anchorAll || (personal && personal.has(id)) || (uranian && uranian.has(id));
	const out = []; const seen = new Set(); const n = points.length;
	for (let i = 0; i < n; i++){
		for (let j = 0; j < n; j++){
			if (i === j) continue;
			const A = points[i], B = points[j];
			if (!isAnchor(A.id) && !isAnchor(B.id)) continue; // 至少一锚点
			for (let k = 0; k < n; k++){
				if (k === i || k === j) continue;
				const C = points[k];
				const lon = norm360(A.lon + B.lon - C.lon);
				for (let m = 0; m < n; m++){
					if (m === i || m === j || m === k) continue;
					const D = points[m];
					const sep = dialSeparation(lon, D.lon, base);
					// 含个人点的图放宽到 orbPersonal(opts.orbPersonal 缺省=orb,零回归)。
					if (sep > effOrb(orb, opts, A.id, B.id, C.id, D.id)) continue;
					const key = [A.id, B.id].sort().join('|') + '|' + C.id + '|' + D.id;
					if (seen.has(key)) continue;
					seen.add(key);
					const ids = [A.id, B.id, C.id, D.id];
					const hasPersonal = personal ? ids.some((id) => personal.has(id)) : false;
					const hasTnp = uranian ? ids.some((id) => uranian.has(id)) : false;
					out.push({ a: A.id, b: B.id, c: C.id, d: D.id, lon, sep, hasPersonal, hasTnp });
				}
			}
		}
	}
	const rank = (p) => (p.hasPersonal ? 0 : (p.hasTnp ? 1 : 2));
	return out.sort((x, y) => rank(x) - rank(y) || x.sep - y.sep).slice(0, limit);
}

// ── 中点扁平表:所有无序对的近中点,按 含个人点 > 含 TNP > 其他 再按盘位排序 ──
// 供「中点列表」面板与 AI 导出(树视图之外的可检索清单)。每对只算一个近中点(与 midpoint() 同口径)。
// opts.includeSum(可选,WP-5):为真时每对额外带 sumLon(A+B 和点黄经)+ sumDial(其盘位),不改既有字段(零回归)。
export function midpointList(points, base, opts){
	const personal = (opts && opts.personal) ? opts.personal : null;
	const uranian = (opts && opts.uranian) ? opts.uranian : null;
	const includeSum = !!(opts && opts.includeSum);
	const out = [];
	for (let i = 0; i < points.length; i++){
		for (let j = i + 1; j < points.length; j++){
			const A = points[i], B = points[j];
			const lon = midpoint(A.lon, B.lon);
			const hasPersonal = personal ? (personal.has(A.id) || personal.has(B.id)) : false;
			const hasTnp = uranian ? (uranian.has(A.id) || uranian.has(B.id)) : false;
			const row = { a: A.id, b: B.id, lon, dial: projectToDial(lon, base), hasPersonal, hasTnp };
			if (includeSum){ const s = sumPoint(A.lon, B.lon); row.sumLon = s; row.sumDial = projectToDial(s, base); }
			out.push(row);
		}
	}
	const rank = (p) => (p.hasPersonal ? 0 : (p.hasTnp ? 1 : 2));
	return out.sort((x, y) => rank(x) - rank(y) || x.lon - y.lon);
}

// ── 映点接触 Spiegelpunkt:B 落在 A 的回照(180−lonA)折叠盘位 orb 内即一对接触 ──
// 注:90°/45°/22.5° 盘上「回照」与「对映」相差 180°≡0(折叠重合),故盘上为单一「映点」概念,
//   不再区分 anti/contra(那只在 360° 全圈才有别)。供「映点」面板与盘上标记。
// opts.extendedAxes(可选,B8):为真时【追加】15° 固定星座镜轴接触(镜像=(2·axisLon−lon) mod 360,
//   axisLon=45/135/225/315;独立镜像仅 90−lon 与 270−lon 两式,折叠盘上互差 180 重合取一式)。
//   追加行带 axis:'fixed15' 标记;既有基本轴行字段不变。缺省 false = 逐位零回归。
//   ⚠️ 数学事实:mod 90 折叠下 90−lon 与基本轴 180−lon 相差 90 亦重合 —— 扩展轴仅 360° 模数盘有别,
//   折叠盘上追加行与基本行同 sep(UI 须据此仅在 base=360 时提示差异)。
export function spiegelContacts(points, base, orb, opts){
	const personal = (opts && opts.personal) ? opts.personal : null;
	const uranian = (opts && opts.uranian) ? opts.uranian : null;
	const extended = !!(opts && opts.extendedAxes);
	const out = [];
	for (let i = 0; i < points.length; i++){
		for (let j = i + 1; j < points.length; j++){
			const A = points[i], B = points[j];
			const hasPersonal = personal ? (personal.has(A.id) || personal.has(B.id)) : false;
			const hasTnp = uranian ? (uranian.has(A.id) || uranian.has(B.id)) : false;
			const lim = effOrb(orb, opts, A.id, B.id);
			const sep = dialSeparation(antiscion(A.lon), B.lon, base);
			// 含个人点的接触放宽到 orbPersonal(opts.orbPersonal 缺省=orb,零回归)。
			if (sep <= lim) out.push({ a: A.id, b: B.id, sep, hasPersonal, hasTnp });
			if (extended){
				const sepExt = dialSeparation(norm360(90 - A.lon), B.lon, base);
				if (sepExt <= lim) out.push({ a: A.id, b: B.id, sep: sepExt, hasPersonal, hasTnp, axis: 'fixed15' });
			}
		}
	}
	const rank = (p) => (p.hasPersonal ? 0 : (p.hasTnp ? 1 : 2));
	return out.sort((x, y) => rank(x) - rank(y) || x.sep - y.sep);
}

// ── 和点 Summe / 差距 Distanz(汉堡补充读数,WP-5)─────────────────────
// 和点 sumPoint(A+B):汉堡「Summe」=两黄经之【和】(非中点),折回 0..360;盘上与某点/中点同轴即一组和点结构。
// 差距 arcOpening(A∠B):两点的最短角距(0..180),即「Distanz」;盘上落某点轴即该差距与某黄经折叠对位。
export function sumPoint(a, b){ return ((a + b) % 360 + 360) % 360; }
export function arcOpening(a, b){ const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); }

// 和点扁平表:所有无序对的 A+B 和点(折叠盘位),供「和点列表」检索 + AI 导出。
// 排序同中点列表(含个人点 > 含 TNP > 其他,再按盘位)。
export function sumList(points, base, opts){
	const personal = (opts && opts.personal) ? opts.personal : null;
	const uranian = (opts && opts.uranian) ? opts.uranian : null;
	const out = [];
	for (let i = 0; i < points.length; i++){
		for (let j = i + 1; j < points.length; j++){
			const A = points[i], B = points[j];
			const lon = sumPoint(A.lon, B.lon);
			const hasPersonal = personal ? (personal.has(A.id) || personal.has(B.id)) : false;
			const hasTnp = uranian ? (uranian.has(A.id) || uranian.has(B.id)) : false;
			out.push({ a: A.id, b: B.id, lon, dial: projectToDial(lon, base), hasPersonal, hasTnp });
		}
	}
	const rank = (p) => (p.hasPersonal ? 0 : (p.hasTnp ? 1 : 2));
	return out.sort((x, y) => rank(x) - rank(y) || x.lon - y.lon);
}

// 差距扁平表:所有无序对的最短角距(0..180),按角距升序(同距再按含个人点优先)。
export function differenceList(points, base, opts){
	const personal = (opts && opts.personal) ? opts.personal : null;
	const uranian = (opts && opts.uranian) ? opts.uranian : null;
	const out = [];
	for (let i = 0; i < points.length; i++){
		for (let j = i + 1; j < points.length; j++){
			const A = points[i], B = points[j];
			const arc = arcOpening(A.lon, B.lon);
			const hasPersonal = personal ? (personal.has(A.id) || personal.has(B.id)) : false;
			const hasTnp = uranian ? (uranian.has(A.id) || uranian.has(B.id)) : false;
			out.push({ a: A.id, b: B.id, arc, dial: projectToDial(arc, base), hasPersonal, hasTnp });
		}
	}
	const rank = (p) => (p.hasPersonal ? 0 : (p.hasTnp ? 1 : 2));
	return out.sort((x, y) => x.arc - y.arc || rank(x) - rank(y));
}

// ── 太阳弧到期 差值表(Solar Arc directions,WP-3)─────────────────────
// 太阳弧换算率(度/年):naibod=太阳平均周日运动(回归年/360°),oneDeg=1°/年的常用近似,
// cardan=0°59′12″/年(≈0.9866667,另一传世软件速率键;三选一,差值表/太阳弧环/校时同源消费)。
export const SA_RATE = { naibod: 0.9856473, oneDeg: 1.0, cardan: 0.9866667 };

// 给定参与点 points:[{id,lon}],对每一对计算其差距 arc=arcOpening(0..180),再按八度分解成
//   全(m=1)/半(m=0.5)/倍(m=2)三档:接触角 a90=((arc*m)%90+90)%90(0..90),取 {a90, 90−a90} 两个
//   折叠接触(覆盖 0/45/90/135/180 度的硬接触);每个接触的【到期年龄】age = 接触角/rate
//   (a90 项 = 该对在 90° 盘的主接触;90−a90 项 = 同盘对侧折叠接触)。
// 另对每个单因子(行星本身)给出 aries 档:a = lon%90(0..90),同样取 {a, 90−a} 两侧 —— 即该点定向到
//   白羊点/世界轴(0°)所需弧。base 仅作(未来)盘位标注,判定本身按八度代数。
// opts.saKey:'naibod'(默认)/'oneDeg';opts.targetAge + opts.win(默认1):|age−targetAge|<=win 标 due;
// opts.maxAge:截断(只留 age<=maxAge);结果按 age 升序。
// 返回 [{a,b,arc,age,type:'full'|'half'|'double'|'aries',due,fold?}]
//   (成对 b=对方 id、arc=该对原始差距 0..180;aries 档 b=null、arc=该点黄经折叠 0..90;fold='90-a' 标对侧折叠项)。
export function solarArcDirections(points, base, opts){
	const o = opts || {};
	// 三选一查表(naibod/oneDeg/cardan);未知键回退 naibod —— 对既有两键输入逐位等价。
	const rate = SA_RATE[o.saKey] || SA_RATE.naibod;
	const hasTarget = Number.isFinite(Number(o.targetAge));
	const target = Number(o.targetAge);
	const win = Number.isFinite(Number(o.win)) ? Number(o.win) : 1;
	const maxAge = Number.isFinite(Number(o.maxAge)) ? Number(o.maxAge) : null;
	const out = [];
	// 推一个接触:contactDeg(0..90,需推进的太阳弧度数)→ age,过 maxAge 截断;fold 标对侧折叠项。
	const push = (a, b, arc, contactDeg, type, fold) => {
		const age = contactDeg / rate;
		if (maxAge != null && age > maxAge) return;
		const row = { a, b, arc, age, type, due: hasTarget ? Math.abs(age - target) <= win : false };
		if (fold) row.fold = fold;
		out.push(row);
	};
	const emitPair = (aId, bId, arc, type, m) => {
		const a90 = (((arc * m) % 90) + 90) % 90;   // 主接触角 0..90
		push(aId, bId, arc, a90, type);             // {a90}
		const back = (90 - a90) % 90;               // 对侧折叠 {90−a90}
		if (back > 1e-9) push(aId, bId, arc, back, type, '90-a');
	};
	const OCTAVES = [['full', 1], ['half', 0.5], ['double', 2]];
	for (let i = 0; i < points.length; i++){
		for (let j = i + 1; j < points.length; j++){
			const A = points[i], B = points[j];
			const arc = arcOpening(A.lon, B.lon);
			OCTAVES.forEach(([type, m]) => emitPair(A.id, B.id, arc, type, m));
		}
	}
	// 单因子 aries 档:a=lon%90(0..90),{a,90−a} 两侧。
	for (let i = 0; i < points.length; i++){
		const P = points[i];
		const a = ((P.lon % 90) + 90) % 90;
		push(P.id, null, a, a, 'aries');
		const back = (90 - a) % 90;
		if (back > 1e-9) push(P.id, null, a, back, 'aries', '90-a');
	}
	return out.sort((x, y) => x.age - y.age);
}

// ── 合盘接触法 Synastrie(汉堡多人叠盘,WP-9)──────────────────────────
// 把 B 盘的每个因子投到 A 盘:落在 A 的【单点】(身体)或 A 的【中点轴】(A1/A2 的半和)orb 内即一对接触。
// 最具决定性 = B 因子落 A 的 ☉/☽ 中点(汉堡「以对方点击中己方日月轴」)——但本函数对【所有】A 中点一视同仁,
//   是否日月轴的判定留给 UI(凭 a1/a2 标记),内核只产出几何命中。复用 midpoint/dialSeparation,与单盘读数同口径。
// 参数:pointsA / pointsB = [{id,lon}];base=盘基;orb=容许度。
// 返回 [{a1,a2,b,sep}] —— a2 可空(=B 落 A 单点 a1);a2 非空时 a1/a2 为该 A 中点轴的两端(无序,a1<=a2 字典序)。
//   按 sep 升序;单点接触(a2=null)与中点接触混排,纯按角距近者优先。
export function crossContacts(pointsA, pointsB, base, orb){
	const A = Array.isArray(pointsA) ? pointsA : [];
	const B = Array.isArray(pointsB) ? pointsB : [];
	const out = [];
	for (let k = 0; k < B.length; k++){
		const b = B[k];
		if (!Number.isFinite(Number(b.lon))) continue;
		// ① B 落 A 单点(身体接触)。
		for (let i = 0; i < A.length; i++){
			const sep = dialSeparation(A[i].lon, b.lon, base);
			if (sep <= orb) out.push({ a1: A[i].id, a2: null, b: b.id, sep });
		}
		// ② B 落 A 中点轴(半和接触)——A 任两点的近中点。
		for (let i = 0; i < A.length; i++){
			for (let j = i + 1; j < A.length; j++){
				const sep = dialSeparation(midpoint(A[i].lon, A[j].lon), b.lon, base);
				if (sep <= orb){
					// a1/a2 取字典序稳定输出(无序对)。
					const x = A[i].id, y = A[j].id;
					const a1 = `${x}` <= `${y}` ? x : y;
					const a2 = `${x}` <= `${y}` ? y : x;
					out.push({ a1, a2, b: b.id, sep });
				}
			}
		}
	}
	return out.sort((x, y) => x.sep - y.sep);
}

// ── 校时命中 Rektifikation(只读预览,WP-10)─────────────────────────
// 事件年龄 → 太阳弧(years*rate,rate 默认 SA_RATE.oneDeg=1°/年,可传 naibod) → 把推进的角轴(MC/Asc)
//   定向到该弧 → 与本命因子取 dialSeparation,落 orb 内即一次命中。这正是「轴推进到本命点」的校时硬证。
// 参数:
//   events  = [{label?, years}]  每个待校事件(years=发生时的周岁/弧年);非有限 years 跳过。
//   angles  = {mc?, asc?}        本命 MC/Asc 黄经(缺则该轴不参与);两轴各自定向后比对。
//   natalPts= [{id,lon}]         本命因子集(命中目标)。
//   base    = 盘基;orb = 容许度;rate = 度/年(默认 1.0=oneDeg,传 SA_RATE.naibod 用 Naibod)。
// 返回 [{event, arc, hits:[{factor, angle, sep}]}] —— event=原 label(无则索引串);arc=该事件推进弧(度);
//   hits 按 sep 升序(factor=命中的本命因子 id,angle='MC'|'Asc'=用哪条推进轴命中)。events 顺序保持输入序。
export function rectificationHits(events, angles, natalPts, base, orb, rate){
	const evs = Array.isArray(events) ? events : [];
	const ang = angles || {};
	const pts = Array.isArray(natalPts) ? natalPts : [];
	const r = Number.isFinite(Number(rate)) && Number(rate) > 0 ? Number(rate) : SA_RATE.oneDeg;
	const norm = (x) => ((x % 360) + 360) % 360;
	const axes = [];
	if (Number.isFinite(Number(ang.mc))) axes.push(['MC', Number(ang.mc)]);
	if (Number.isFinite(Number(ang.asc))) axes.push(['Asc', Number(ang.asc)]);
	const out = [];
	for (let e = 0; e < evs.length; e++){
		const ev = evs[e] || {};
		const years = Number(ev.years);
		const label = (ev.label != null && `${ev.label}`.trim() !== '') ? `${ev.label}` : `${e}`;
		if (!Number.isFinite(years)){ out.push({ event: label, arc: NaN, hits: [] }); continue; }
		const arc = years * r;
		const hits = [];
		for (let ax = 0; ax < axes.length; ax++){
			const angName = axes[ax][0];
			const angLon = axes[ax][1];
			const directed = norm(angLon + arc); // 角轴推进 arc 度
			for (let i = 0; i < pts.length; i++){
				const sep = dialSeparation(directed, pts[i].lon, base);
				if (sep <= orb) hits.push({ factor: pts[i].id, angle: angName, sep });
			}
		}
		hits.sort((x, y) => x.sep - y.sep);
		out.push({ event: label, arc, hits });
	}
	return out;
}

// ── 组合中点盘 Composite(A4)────────────────────────────────────────
// 两盘逐同名因子取【近中点】(与全模块 midpoint() 同口径)构成"关系本身"之盘。
// 仅取两盘共有 id;任一侧缺该因子(如缺 Asc/MC)则跳过;返回 [{id,lon}] 可直接喂
// cursorReadout/midpointTree/planetaryPictures/midpointList 等全套既有扫描器。
// 注:此为逐因子中点盘,与「时空中点真实起盘」(戴维森盘,走后端)本质不同。
export function compositeChart(ptsA, ptsB){
	const bMap = {};
	(Array.isArray(ptsB) ? ptsB : []).forEach((p) => { if (p && p.id != null) bMap[p.id] = p; });
	const out = [];
	(Array.isArray(ptsA) ? ptsA : []).forEach((p) => {
		if (!p || p.id == null) return;
		const q = bMap[p.id];
		if (!q) return;
		const la = Number(p.lon), lb = Number(q.lon);
		if (!Number.isFinite(la) || !Number.isFinite(lb)) return;
		out.push({ id: p.id, lon: midpoint(la, lb) });
	});
	return out;
}

// ── 中点枢纽统计 focal point(B5-algo)──────────────────────────────
// 对每个因子统计其占据的中点数("分支越多越重要"):count=中点树该根的枝数;
// personalCount=其中含个人点(opts.personal)的枝数。按 count 降序(同数再按 personalCount)。
// 统计面恒为全因子(内部强制 onlyPersonal:false 展开全部根);orbPersonal 放宽语义随 opts 保留。
export function midpointHubs(points, base, orb, opts){
	const tree = midpointTree(points, base, orb, { ...(opts || {}), onlyPersonal: false });
	const personal = (opts && opts.personal) ? opts.personal : null;
	const out = Object.keys(tree).map((id) => ({
		id,
		count: tree[id].length,
		personalCount: personal ? tree[id].filter((r) => personal.has(r.a) || personal.has(r.b)).length : 0,
	}));
	return out.sort((x, y) => y.count - x.count || y.personalCount - x.personalCount || (x.id < y.id ? -1 : 1));
}
