// 主限天球 · 后天宫位(house cusp)客户端计算(纯函数,零依赖,jest 可测)。
//
// [E1·显示] 后端 /predict/pd3d 只回 frame(armc/phi/eps)不回宫首,故 12 宫首在前端算。
// 全程球面第一性原理:黄经(β=0)↔赤经/赤纬标准变换 + 各宫制的分宫机制。
// 号序约定:cusp[0]=第 1 宫(命宫)…cusp[9]=第 10 宫(天顶 MC)…cusp[i] 与 cusp[i+6] 恒差 180°。
//
// 正确性锚(pdHouseCusps.test 钉死):① 第1宫≡ASC、第10宫≡MC(与后端 N_Asc_0/N_MC_0 逐点核,
// meridian 除外——其分宫在赤经、命宫非真 ASC);② 对宫恒 +180°;③ 分宫机制逐系统:
//   equal_ecliptic=黄道等分 / porphyry=黄道象限三分 / meridian·equal_hour_circle=赤经等分 /
//   core_alchabitius=ASC 半昼夜弧时间三分(赤经) / regiomontanus·topocentric=位置圈(极高) /
//   placidus=各点自身半弧三分(迭代)。campanus 分宫涉卯酉圈,暂只出四轴(诚实少列)。

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
const norm360 = (x)=>((x % 360) + 360) % 360;

/** 黄经(β=0)→ 赤经(0..360) */
function raOfEclLon(lam, eps){
	const l = lam * D2R; const e = eps * D2R;
	return norm360(Math.atan2(Math.sin(l) * Math.cos(e), Math.cos(l)) * R2D);
}
/** 黄经(β=0)→ 赤纬 */
function declOfEclLon(lam, eps){
	const l = lam * D2R; const e = eps * D2R;
	return Math.asin(Math.sin(l) * Math.sin(e)) * R2D;
}
/** 赤经(黄道上 β=0 点)→ 黄经(0..360);tan λ = tan RA / cos ε */
function eclLonOfRa(ra, eps){
	const r = ra * D2R; const e = eps * D2R;
	return norm360(Math.atan2(Math.sin(r), Math.cos(r) * Math.cos(e)) * R2D);
}
/** 黄经(β=0)→ 赤道系 {ra, decl}(度)——引擎画宫首落点用。 */
export function eclLonToEq(lam, eps){
	return { ra: raOfEclLon(lam, eps), decl: declOfEclLon(lam, eps) };
}

/** MC 黄经:RA=RAMC 的黄道点 */
export function mcLon(ramc, eps){
	return eclLonOfRa(ramc, eps);
}
/** ASC 黄经(东地平升点)标准式 */
export function ascLon(ramc, phi, eps){
	const r = ramc * D2R; const p = phi * D2R; const e = eps * D2R;
	return norm360(Math.atan2(Math.cos(r), -(Math.sin(r) * Math.cos(e) + Math.tan(p) * Math.sin(e))) * R2D);
}
/** 升差 AD(δ,pole)=asin(tan δ · tan pole);|arg|>1 极圈不可解→夹到 ±90 */
function ascDiff(declDeg, poleRad){
	const t = Math.tan(declDeg * D2R) * Math.tan(poleRad);
	return Math.abs(t) <= 1 ? Math.asin(t) * R2D : (t > 0 ? 90 : -90);
}

/** 位置圈型宫首(regiomontanus/topocentric):过赤经 H、极高 ρ 的位置圈∩黄道。
 *  λ = atan2(sin H, cos H·cos ε − tan ρ·sin ε);H=RAMC+90、ρ=φ 时恒得 ASC(锚验)。 */
function circleOfPositionLon(H, poleRad, eps){
	const h = H * D2R; const e = eps * D2R;
	return norm360(Math.atan2(Math.sin(h), Math.cos(h) * Math.cos(e) - Math.tan(poleRad) * Math.sin(e)) * R2D);
}

/** Placidus 单宫首(半弧比例 f∈(0,1):第11宫 f=1/3、第12宫 f=2/3;夜间宫用 nocturnal)。
 *  条件:点自身「距中天赤经」= f · 其半弧(昼 90+AD/夜 90−AD);对 λ 定点迭代(δ 随 λ 变)。 */
function placidusCuspLon(ramc, phi, eps, f, nocturnal){
	const phiR = phi * D2R;
	// 初值:赤经等分(meridian)作种子
	let ra = norm360(ramc + (nocturnal ? 180 : 0) + (nocturnal ? -1 : 1) * f * 90 * (nocturnal ? -1 : 1));
	// 稳健起见用简单种子:中天 + f·90(昼)或中天+180−f·90(夜)
	ra = nocturnal ? norm360(ramc + 180 - f * 90) : norm360(ramc + f * 90);
	for(let it = 0; it < 40; it += 1){
		const lam = eclLonOfRa(ra, eps);
		const decl = declOfEclLon(lam, eps);
		const ad = ascDiff(decl, phiR);
		const dsa = 90 + ad;   // 半昼弧
		const nsa = 90 - ad;   // 半夜弧
		// 目标赤经:中天 + f·(半弧);夜间从下中天(RAMC+180)反向
		const target = nocturnal ? norm360(ramc + 180 - f * nsa) : norm360(ramc + f * dsa);
		if(Math.abs(norm360(target - ra + 180) - 180) < 1e-9){ ra = target; break; }
		ra = target;
	}
	return eclLonOfRa(ra, eps);
}

/**
 * 12 宫首黄经(度)。返回 {cusps:[12], full:bool}；full=false 表示该宫制暂只出四轴(其余为 null)。
 * @param system pdMethod 值(见本文件下方各分宫制分支的字符串常量)
 */
export function houseCusps(system, ramc, phi, eps){
	const asc = ascLon(ramc, phi, eps);
	const mc = mcLon(ramc, eps);
	const ic = norm360(mc + 180);
	const dsc = norm360(asc + 180);
	const opp = (arr)=>{ // 对宫互补(双向):任一空宫首由其 +180° 对宫填(恒 180° 不变量)
		for(let i = 0; i < 12; i += 1){
			const j = (i + 6) % 12;
			if(arr[i] == null && arr[j] != null){ arr[i] = norm360(arr[j] + 180); }
		}
		return arr;
	};

	if(system === 'equal_ecliptic'){
		const c = []; for(let i = 0; i < 12; i += 1){ c.push(norm360(asc + i * 30)); }
		return { cusps: c, full: true };
	}
	if(system === 'wholesign'){
		// 整宫制:第 1 宫首 = ASC 所在星座 0°,逐宫整 30°(定义无歧义)。
		const c = []; const base = Math.floor(norm360(asc) / 30) * 30;
		for(let i = 0; i < 12; i += 1){ c.push(norm360(base + i * 30)); }
		return { cusps: c, full: true };
	}
	if(system === 'porphyry'){
		const q1 = norm360(asc - mc);   // 10→1 象限(黄道)
		const q2 = norm360(ic - asc);   // 1→4 象限
		const c = new Array(12).fill(null);
		c[0] = asc; c[9] = mc; c[3] = ic; c[6] = dsc;
		c[10] = norm360(mc + q1 / 3); c[11] = norm360(mc + 2 * q1 / 3);
		c[1] = norm360(asc + q2 / 3); c[2] = norm360(asc + 2 * q2 / 3);
		return { cusps: opp(c), full: true };
	}
	if(system === 'meridian' || system === 'equal_hour_circle'){
		// 赤经等分:第10宫 RA=RAMC,逐宫 +30°;命宫(RA=RAMC+90)非真 ASC(赤道升点)。
		const c = []; for(let i = 0; i < 12; i += 1){
			const off = ((i - 9) * 30);   // i=9(第10宫)→0
			c.push(eclLonOfRa(norm360(ramc + off), eps));
		}
		return { cusps: c, full: true };
	}
	if(system === 'core_alchabitius'){
		// ASC 半昼/夜弧时间三分(赤经):RA_k = RAMC + 分段;λ=该赤经的黄道点。
		const declAsc = declOfEclLon(asc, eps);
		const ad = ascDiff(declAsc, phi * D2R);
		const dsa = 90 + ad; const nsa = 90 - ad;
		const c = new Array(12).fill(null);
		c[9] = mc; c[3] = ic; c[0] = asc; c[6] = dsc;
		c[10] = eclLonOfRa(norm360(ramc + dsa / 3), eps);
		c[11] = eclLonOfRa(norm360(ramc + 2 * dsa / 3), eps);
		c[1] = eclLonOfRa(norm360(ramc + dsa + nsa / 3), eps);
		c[2] = eclLonOfRa(norm360(ramc + dsa + 2 * nsa / 3), eps);
		return { cusps: opp(c), full: true };
	}
	if(system === 'regiomontanus'){
		// 位置圈,极高=φ;赤经等分 H=RAMC+30k;H=RAMC+90 恒得 ASC。
		const p = phi * D2R;
		const c = new Array(12).fill(null);
		c[9] = mc; c[3] = ic;
		c[10] = circleOfPositionLon(ramc + 30, p, eps);
		c[11] = circleOfPositionLon(ramc + 60, p, eps);
		c[0] = circleOfPositionLon(ramc + 90, p, eps);   // ≡ ASC
		c[1] = circleOfPositionLon(ramc + 120, p, eps);
		c[2] = circleOfPositionLon(ramc + 150, p, eps);
		return { cusps: opp(c), full: true };
	}
	if(system === 'topocentric'){
		// Polich-Page:极高 ρ_n=atan(n·tanφ/3),H=RAMC+30n;n=3(cusp1)→ρ=φ 得 ASC。
		const tphi = Math.tan(phi * D2R);
		const rho = (n)=>Math.atan((n * tphi) / 3);
		const c = new Array(12).fill(null);
		c[9] = mc; c[3] = ic;
		c[10] = circleOfPositionLon(ramc + 30, rho(1), eps);
		c[11] = circleOfPositionLon(ramc + 60, rho(2), eps);
		c[0] = circleOfPositionLon(ramc + 90, rho(3), eps);   // ≡ ASC
		c[1] = circleOfPositionLon(ramc + 120, rho(2), eps);
		c[2] = circleOfPositionLon(ramc + 150, rho(1), eps);
		return { cusps: opp(c), full: true };
	}
	if(system === 'placidus'){
		const c = new Array(12).fill(null);
		c[9] = mc; c[3] = ic; c[0] = asc; c[6] = dsc;
		c[10] = placidusCuspLon(ramc, phi, eps, 1 / 3, false);
		c[11] = placidusCuspLon(ramc, phi, eps, 2 / 3, false);
		c[1] = placidusCuspLon(ramc, phi, eps, 2 / 3, true);
		c[2] = placidusCuspLon(ramc, phi, eps, 1 / 3, true);
		return { cusps: opp(c), full: true };
	}
	// campanus/morinus/koch 及未知:分宫机制(卯酉圈等分/黄道系赤经等分/出生地平弧)
	// 无仓内权威闭式,只出四轴(诚实少列,不臆造中间宫首)。
	const c = new Array(12).fill(null);
	c[0] = asc; c[9] = mc; c[3] = ic; c[6] = dsc;
	return { cusps: c, full: false };
}

/** 定局分宫键(pdFrame,与后端 _PD_FRAME_HSYS 同域)→ 本模块宫制名。
 *  未映射者原样透传 → houseCusps 落到「四轴」分支(诚实少列)。 */
const PD_FRAME_TO_CUSP_SYSTEM = {
	alcabitius: 'core_alchabitius',
	equal: 'equal_ecliptic',
	wholesign: 'wholesign',
	placidus: 'placidus',
	regiomontanus: 'regiomontanus',
	topocentric: 'topocentric',
	meridian: 'meridian',
	equal_hour_circle: 'equal_hour_circle',
	porphyry: 'porphyry',
};

export function cuspSystemOfFrame(frame){
	const f = `${frame || ''}`;
	return PD_FRAME_TO_CUSP_SYSTEM[f] || (f || 'core_alchabitius');
}
