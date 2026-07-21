// 主限法 3D 天球纯数学(WS-3)。
// 零 three 依赖铁律:jest 里 three 全族被 threeJestStub 顶替(见 test/threeJestStub.js 头注),
// 凡需要断言的几何/换算一律沉到本模块 —— PDSphereEngine 只消费不定义(sphMath/morphMath 同先例)。
//
// 坐标框架(赤道系):sph(ra, decl, R) 直用 sphMath 公共式 ——
//   x=R·cosδ·cosα, y=R·sinδ(Y=天北极), z=−R·cosδ·sinα;
// 与黄道系同构,只是把 (λ,β) 换成 (α,δ)。
// 数据源:/predict/pd3d 响应(rows/points/circles/frame),形态契约由后端
// tests/test_pd3d_endpoint.py 看守,本模块的 kind 映射表与其语义型枚举互为镜像。
import { sph } from './sphMath';
import { norm360 } from './morphMath';

const DEG = Math.PI / 180;
// 平均回归年毫秒数:时间轴「日期→年龄」换算用(表行应期日期由后端按所选
// pdTimeKey 精确换算而来,前端只需日历差,精度损耗 <0.1 天/百年,对时间轴足够)。
const YEAR_MS = 365.2425 * 86400000;

// —— 向量小工具(零依赖;大圆法向量/正交基派生用) ——
export function vDot(a, b){
	return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function vCross(a, b){
	return {
		x: a.y * b.z - a.z * b.y,
		y: a.z * b.x - a.x * b.z,
		z: a.x * b.y - a.y * b.x,
	};
}

export function vLen(a){
	return Math.sqrt(vDot(a, a));
}

/** 归一化;退化向量(长度≈0,如共线叉积)返 null —— 调用方按「圈不可解」跳过该圈 */
export function vNormalize(a){
	const len = vLen(a);
	if(!(len > 1e-12)){
		return null;
	}
	return { x: a.x / len, y: a.y / len, z: a.z / len };
}

/** (ra°, decl°) → 单位向量(R=1;sph 公共式复用) */
export function unitOf(raDeg, declDeg){
	return sph(raDeg, declDeg, 1);
}

// —— 地平框架三基点(全部由 frame{armc,phi} 派生,armc=houses_ex ascmc[2] 直出) ——
/** 天顶:ra=RAMC(frame.armc), decl=地理纬度 φ(frame.phi) */
export function zenithOf(frame){
	return { ra: norm360(Number(frame && frame.armc) || 0), decl: Number(frame && frame.phi) || 0 };
}

/** 东点:ra=armc+90, decl=0(必落地平圈上 —— horizonSelfCheck 钉死) */
export function eastPointOf(frame){
	return { ra: norm360((Number(frame && frame.armc) || 0) + 90), decl: 0 };
}

/** 地平北点单位向量 = 天顶 × 东点(右手系;φ=0 时退化为天北极,亦为正确北点) */
export function northPointOf(frame){
	const z = zenithOf(frame);
	const e = eastPointOf(frame);
	return vNormalize(vCross(unitOf(z.ra, z.decl), unitOf(e.ra, e.decl)));
}

/**
 * 交付自检:东点(ra=armc+90, decl=0)必在地平圈上。
 * 地平大圈 = 过球心、以天顶方向为法向量的平面截球 → 东点单位向量与天顶单位向量点积必为 0。
 * 引擎在 setData 后 console.assert 本检查(容差 1e-6);jest 以多组 frame 钉死公式。
 * @returns {{ok: boolean, dot: number}} dot = 实际点积偏差
 */
export function horizonSelfCheck(frame, tol = 1e-6){
	const z = zenithOf(frame);
	const e = eastPointOf(frame);
	const d = vDot(unitOf(z.ra, z.decl), unitOf(e.ra, e.decl));
	return { ok: Math.abs(d) <= tol, dot: d };
}

/**
 * 过两点 p1、p2 的大圆参数基:P(t) = u·cos t + w·sin t(t∈[0,2π), 半径外乘)。
 * u 取 p1 方向单位向量 → 圈必过 p1;p2 在圈面上(法向量 n=p1×p2 与两点皆正交)。
 * 两点共线(重合/对跖)时大圆不唯一 → 返 null,调用方跳过。
 */
export function greatCircleThrough(p1, p2){
	const n = vNormalize(vCross(p1, p2));
	if(!n){
		return null;
	}
	const u = vNormalize(p1);
	if(!u){
		return null;
	}
	const w = vNormalize(vCross(n, u));
	if(!w){
		return null;
	}
	return { u, w, n };
}

/** 黄道北极的赤道坐标:ra=270°, decl=90−ε(ecliptic-meridian 圈的极点) */
export function eclipticPoleOf(epsDeg){
	return { ra: 270, decl: 90 - (Number(epsDeg) || 0) };
}

// —— 表行口径(rows 与 /predict/pd 的 pdlist 逐位同源:{i,arc,prom,sig,cat,date}) ——
/** 逆向行判据:顺逆同引擎产出、arc 正负号天然区分(converse=负弧,后端约定) */
export function isConverseRow(row){
	return Number(row && row.arc) < 0;
}

/** 表行应期日期('YYYY/MM/DD…')→ ms;沿用快照链 replace(/\//g,'-') 解析口径;不可解析返 NaN */
export function rowDateMs(dateText){
	const t = `${dateText || ''}`.trim().replace(/\//g, '-');
	return t ? Date.parse(t) : NaN;
}

/**
 * 表行 → 年龄(年)。首选「应期日期 − 出生时刻」真历差:任何 pdTimeKey 下都精确
 * (日期本身即后端按该钥匙换算的结果,零重算);日期不可解析时回退 |arc|
 * (Ptolemy 1°=1 年基准近似,converse 负弧取绝对值 —— 应期同样在出生之后)。
 */
export function rowAgeYears(row, birthMs){
	const arcAbs = Math.abs(Number(row && row.arc)) || 0;
	const t = rowDateMs(row && row.date);
	if(Number.isFinite(t) && Number.isFinite(birthMs)){
		const years = (t - birthMs) / YEAR_MS;
		if(Number.isFinite(years) && years >= 0){
			return years;
		}
	}
	return arcAbs;
}

/** 时间轴拖拽反查:给定年龄返最近表行下标(按 rowAgeYears 距离;空表返 −1) */
export function nearestRowIndexByAge(rows, ageYears, birthMs){
	if(!Array.isArray(rows) || !rows.length || !Number.isFinite(ageYears)){
		return -1;
	}
	let best = -1;
	let bestDist = Infinity;
	for(let i = 0; i < rows.length; i += 1){
		const d = Math.abs(rowAgeYears(rows[i], birthMs) - ageYears);
		if(d < bestDist){
			bestDist = d;
			best = i;
		}
	}
	return best;
}

/**
 * 播放目标角(弧度):skyGroup.rotation.y 从 0 补间至 −arc·π/180。
 * 推导:rotation.y=θ 把赤经 α 的点映到有效赤经 α+θ(sph 右手系),取 θ=−arc 使
 * 全天球有效赤经整体 −arc = 周日运动(primum mobile)西移 arc 度,把迫星送抵应星
 * 位置圈;converse 行自带负弧 → 目标角自然反号(东移),无需分支。
 */
export function playTargetAngleRad(arcDeg){
	const arc = Number(arcDeg);
	if(!Number.isFinite(arc)){
		return 0;
	}
	return -arc * DEG;
}

/** 播放时长:2.5s;长弧(|arc|>60°)4s —— 转过的球面路程长,压角速度保观感 */
export function playDurationMs(arcDeg){
	return Math.abs(Number(arcDeg) || 0) > 60 ? 4000 : 2500;
}

/**
 * 表行有效赤道坐标口径(点位摆动/周日圈/应星圈共用):
 *   cat='Z'(In-Zodiaco)→ raZ/declZ(黄纬取 0 的黄道投影点 —— 弧几何所用赤纬,
 *     后端 _pd3dPointEntry 注明「前端画迫星周日圈用 declZ」);
 *   cat='M'(In-Mundo 世俗)→ ra/decl(真黄纬物理位置);
 *   raZ/declZ 缺失时回退 ra/decl(虚点 lat=0 时两口径本就相等)。
 */
export function effectiveEq(point, cat){
	if(!point){
		return { ra: 0, decl: 0 };
	}
	const mundo = `${cat || ''}` === 'M';
	const raZ = Number(point.raZ);
	const declZ = Number(point.declZ);
	return {
		ra: (!mundo && Number.isFinite(raZ)) ? raZ : (Number(point.ra) || 0),
		decl: (!mundo && Number.isFinite(declZ)) ? declZ : (Number(point.decl) || 0),
	};
}

// —— [WP-2] 相遇连线端点几何:迫星等赤纬圈 ∩ 应星位置圈 真交点 ——
// 大圆参数式 P(t)=u·cosT+w·sinT(u,w 单位正交);等赤纬面 y=sin(δ) →
// u.y·cosT + w.y·sinT = sinδ,即 r·cos(T−φ)=sinδ(r=√(u.y²+w.y²), φ=atan2(w.y,u.y))。
// 返回两交点(单位向量)或 null(无交/圈几乎与赤纬面平行)。命中时刻两交点之一与迫星
// 终点重合、线长趋零 —— 这才是「引导至」的正统几何(旧式 RA 平移仅时圈/子午类恰对)。
export function declCircleGreatIntersect(declDeg, basis){
	if(!basis || !basis.u || !basis.w){ return null; }
	const s = Math.sin(declDeg * Math.PI / 180);
	const a = basis.u.y;
	const b = basis.w.y;
	const r = Math.hypot(a, b);
	if(r < 1e-9){
		// 大圆整体落在赤道面族(y 分量恒 0):仅 δ=0 全圈重合,不给离散交点
		return null;
	}
	const c = s / r;
	if(c > 1 || c < -1){ return null; } // 该赤纬圈与此大圆无交
	const phi = Math.atan2(b, a);
	const dT = Math.acos(c);
	const at = (t)=>({
		x: basis.u.x * Math.cos(t) + basis.w.x * Math.sin(t),
		y: basis.u.y * Math.cos(t) + basis.w.y * Math.sin(t),
		z: basis.u.z * Math.cos(t) + basis.w.z * Math.sin(t),
	});
	return [at(phi + dT), at(phi - dT)];
}

// 采样折线(Placidus/Topocentric)最近等赤纬命中:各段逐点找 |decl−δ| 最小的采样点
// (误差<采样步长,plan 风险表判可接受)。segs=[[{ra,decl}…]…];返回 {ra,decl} 或 null。
export function declCirclePolylineHit(declDeg, segs){
	let best = null;
	(Array.isArray(segs) ? segs : []).forEach((seg)=>{
		(Array.isArray(seg) ? seg : []).forEach((pt)=>{
			if(!pt || !Number.isFinite(Number(pt.decl))){ return; }
			const d = Math.abs(Number(pt.decl) - declDeg);
			if(!best || d < best.d){ best = { d, pt }; }
		});
	});
	return best ? { ra: Number(best.pt.ra), decl: Number(best.pt.decl) } : null;
}

// —— circles kind → 渲染类型总表 ——
// 与后端 getPrimaryDirection3D 的位置圈语义型枚举一一对应(test_pd3d_endpoint.test_circle_semantics
// 与 pdSphere.test 的完整性断言互为镜像:后端新增 kind 而此表未登 = 前端测试红,防哑渲染)。
export const CIRCLE_KIND_RENDER = {
	'horizon-east': 'frame-highlight',    // ASC 应星:东地平 = 地平大圈高亮
	'meridian': 'frame-highlight',        // MC 应星:子午圈高亮
	'prime-vertical': 'frame-highlight',  // Vertex 应星:卯酉圈高亮
	'position-circle': 'great-circle',    // Regio/Campanus:过地平南北点与应星的大圆(前端叉积直画)
	'sampled': 'polyline',                // Placidus/Topocentric/legacy 半弧:采样折线(允许断段,逐段画)
	'ecliptic-meridian': 'thin-arc',      // 黄道系方位:过黄道极与应星的细圆弧
	'hour-circle': 'thin-arc',            // 核族:过天极与应星的时圈细圆弧
};

/** frame-highlight 语义型 → 地平框架三圈的落点(键与 CIRCLE_KIND_RENDER 严格子集对应) */
export const FRAME_HIGHLIGHT_TARGET = {
	'horizon-east': 'horizon',
	'meridian': 'meridian',
	'prime-vertical': 'primeVertical',
};

/** 虚点判据:points[pid].kind ∈ {term, antiscia, aspect} = 派生虚点(小号灰点);其余为本命实点 */
export const VIRTUAL_POINT_KINDS = new Set(['term', 'antiscia', 'aspect']);

// —— [D2] 方向语义(正统主限法:应星固定、迫星相位点奔向应星的「成相位圈」) ——
// 主限法经典表述「促发星被引导至应星(promissor directed to significator)」:应星(significator)
// 是固定的真实征象本体,迫星(promissor)的相位点被周日主动带到应星身上才算成相位。
// 故【全族统一】应星固定、迫星相位点动——moverOfRow 恒返 'prom'。
//
// 「成相位圈」= 迫星相位点要落到的那条天球圈 = 后端 circles[sig](应星自己的圈):
//   行星/北交/福点应星 → hour-circle(过天极与应星的赤经圈/时圈);
//   MC → meridian(子午圈)、Asc → horizon-east(地平·升/斜升)、Vertex → prime-vertical(卯酉圈)。
// 迫星相位点绕天极旋转,落到应星赤经圈上(赤经相等)= 成相位;机器全程赤道(RA/OA),黄道仅取相位点(λ±n°、β=0)。
//
// 旋转号序(引擎弧公式号序按应星类型分族,故迫星旋转的正负随族翻,byte-validated 弧标签不动):
//  ① 行星/北交/福点:arc = RA(sig,真纬) − RA(promZ) → 迫星转 +arc 落到应星赤经圈;
//  ② MC:arc = RA(promZ) − RA(MCZ) / Asc:OA(promZ)−OA(AscZ) / Vertex:OA@余纬 差
//     / M 类(In-Mundo)/ T 类(界)→ 迫星转 −arc 落到应星轴圈/位置圈。
// 权威:PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_MATH_FLOW.md §8/§12 + perpredict Z 核 docstring;
// direct/converse 只是 arc 正负(§12),对参考 540 盘逐位坐实,不可动——此处只改可视化「谁动」。

const AXIS_SIG_RE = /^(MC|Asc|Vertex|House\d+)$/i;

/** [D2] 该行应星是否属「轴/世俗/界」族(旋转 −arc);否则行星/北交/福点族(旋转 +arc)。 */
function isAxisFamilyRow(row){
	const cat = `${(row && row.cat) || ''}`;
	if(cat === 'M' || cat === 'T'){
		return true;
	}
	return AXIS_SIG_RE.test(sigBaseIdOf(row && row.sig));
}

/** 点位 id 的本体名(N_Sun_0→Sun;T_x_y→x;A/C_x→x)——与引擎 basePointIdOf 同规则(纯函数镜像) */
export function sigBaseIdOf(pid){
	const parts = `${pid || ''}`.split('_');
	if(parts.length < 2){
		return `${pid || ''}`.trim();
	}
	if(parts[0] === 'T'){
		return `${parts[1] || ''}`.trim();
	}
	if(parts.length === 2 && (parts[0] === 'A' || parts[0] === 'C')){
		return parts[1];
	}
	return parts.slice(1, parts.length - 1).join('_').trim();
}

/** [D2] 行动方:全族恒 'prom'(迫星相位点动、应星固定)——正统「促发星被引导至应星」。
 *  (D1 曾让行星族「应星动」=两个等价镜像里的另一支,已定案改为全族迫星动。) */
export function moverOfRow(){
	return 'prom';
}

/** [D2] 迫星旋转角(弧度):把迫星相位点绕天极转到应星的成相位圈上。
 *  行星/北交/福点族 = +arc(arc=RA(sig)−RA(prom),迫星 +arc 落到应星赤经圈);
 *  轴类/M/T 族 = −arc(arc=RA(prom)−RA(sig),迫星 −arc 落到应星轴圈/位置圈)。
 *  sph 约定 rotation.y=α ⇔ 组内点世界 RA=ra+α;故 +arc 使迫星 RA→RA+arc=应星 RA(planet 族)。 */
export function promRotationRad(row){
	const arc = Number(row && row.arc);
	if(!Number.isFinite(arc)){
		return 0;
	}
	return (isAxisFamilyRow(row) ? -arc : arc) * DEG;
}

/** 应星坐标口径:恒真黄纬(ra/decl)——内核 RA(sig, true_lat);zero-lat 投影(raZ)仅迫星侧适用。
 *  🔴 旧 bug:前端曾对应星也取 raZ,MC/Asc β=0 掩盖了它,行星应星行锚位/靶线双错源。 */
export function sigEqOf(point){
	if(!point){
		return { ra: 0, decl: 0 };
	}
	return { ra: Number(point.ra) || 0, decl: Number(point.decl) || 0 };
}
