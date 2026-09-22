// Pure celestial-coordinate projection helpers for the planetarium.
//
// IMPORTANT: this module must stay free of any BABYLON / DOM dependency so it
// can be unit-tested in node (jest). PlanetariumBabylon.js imports these and is
// the ONLY place that turns the returned alt/az into 3D vectors.
//
// Design goal (v11): the FRONTEND projection here must reproduce the backend
// Swiss Ephemeris `swisseph.azalt` (EQU2HOR / ECL2HOR, press=1000 mbar /
// temp=20 C) *apparent* alt/az — including atmospheric refraction — so that the
// paused frame (initial backend draw) and every re-projected frame (playback /
// calibration) land on the same place. Two pipelines that disagree were the
// root cause of the "labels offset" + "snap on play" bugs.
//
// Backend reference (Horosa-Web/astropy/websrv/webplanetariumsrv.py):
//   swisseph.azalt(jd, EQU2HOR|ECL2HOR, [lon,lat,height], 1000, 20, [...])
//   -> { azimuth, altitudeTrue, altitudeAppa }

const REFRACTION_PRESSURE_MBAR = 1000; // matches backend azalt press
const REFRACTION_TEMP_C = 20; // matches backend azalt temp

function degToRad(deg) {
	return (Number(deg) || 0) * Math.PI / 180;
}

function radToDeg(rad) {
	return (Number(rad) || 0) * 180 / Math.PI;
}

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

function normalizeDegrees(deg) {
	return ((Number(deg) % 360) + 360) % 360;
}

// Greenwich Mean Sidereal Time (degrees), IAU 1982 polynomial.
function gmstDegrees(jd) {
	const d = Number(jd) - 2451545.0;
	const t = d / 36525;
	return normalizeDegrees(
		280.46061837
		+ 360.98564736629 * d
		+ 0.000387933 * t * t
		- (t * t * t) / 38710000,
	);
}

// Mean obliquity of the ecliptic (degrees), IAU 1980 — date-correct, replacing
// the previous hard-coded J2000 value (23.4392911) so coordinates track epoch.
function meanObliquityDeg(jd) {
	const t = (Number(jd) - 2451545.0) / 36525;
	const seconds = 23 * 3600 + 26 * 60 + 21.448
		- 46.8150 * t
		- 0.00059 * t * t
		+ 0.001813 * t * t * t;
	return seconds / 3600;
}

// Nutation in longitude Δψ (degrees), Meeus low-accuracy. Used only for the
// equation of the equinoxes (apparent sidereal time); ~17" magnitude.
function nutationLongitudeDeg(jd) {
	const t = (Number(jd) - 2451545.0) / 36525;
	const omega = degToRad(125.04452 - 1934.136261 * t);
	const lSun = degToRad(280.4665 + 36000.7698 * t);
	const lMoon = degToRad(218.3165 + 481267.8813 * t);
	const arcsec = -17.20 * Math.sin(omega)
		- 1.32 * Math.sin(2 * lSun)
		- 0.23 * Math.sin(2 * lMoon)
		+ 0.21 * Math.sin(2 * omega);
	return arcsec / 3600;
}

// Apparent sidereal time (degrees) = GMST + equation of the equinoxes.
function apparentSiderealDegrees(jd) {
	const eps = degToRad(meanObliquityDeg(jd));
	const eqEquinoxes = nutationLongitudeDeg(jd) * Math.cos(eps);
	return normalizeDegrees(gmstDegrees(jd) + eqEquinoxes);
}

// Atmospheric refraction (degrees) to add to a TRUE/geometric altitude.
// Saemundsson's formula, scaled to the backend's pressure/temperature so the
// frontend "apparent" altitude matches swisseph.azalt's altitudeAppa.
// Returns ~34' at the horizon, ~0 at the zenith, 0 below ~-1°.
function atmosphericRefractionDeg(trueAltDeg) {
	const alt = Number(trueAltDeg);
	if (!Number.isFinite(alt) || alt < -1) {
		return 0;
	}
	const arg = alt + 10.3 / (alt + 5.11); // degrees
	let rArcmin = 1.02 / Math.tan(degToRad(arg));
	rArcmin *= (REFRACTION_PRESSURE_MBAR / 1010) * (283 / (273 + REFRACTION_TEMP_C));
	return Math.max(0, rArcmin) / 60;
}

// Ecliptic (lon/lat, degrees) -> equatorial (ra/decl, degrees) using the
// date-correct mean obliquity. `jd` optional: falls back to J2000 obliquity.
function eclipticToEquatorial(lon, lat = 0, jd) {
	if (!Number.isFinite(Number(lon)) || !Number.isFinite(Number(lat))) {
		return null;
	}
	const obliquity = degToRad(Number.isFinite(Number(jd)) ? meanObliquityDeg(jd) : 23.4392911);
	const lonRad = degToRad(lon);
	const latRad = degToRad(lat);
	const sinDec = Math.sin(latRad) * Math.cos(obliquity)
		+ Math.cos(latRad) * Math.sin(obliquity) * Math.sin(lonRad);
	const dec = Math.asin(clamp(sinDec, -1, 1));
	const y = Math.sin(lonRad) * Math.cos(obliquity) - Math.tan(latRad) * Math.sin(obliquity);
	const x = Math.cos(lonRad);
	const ra = Math.atan2(y, x);
	return {
		ra: normalizeDegrees(radToDeg(ra)),
		decl: radToDeg(dec),
	};
}

// Galactic (l,b in degrees) -> equatorial (ra/decl in degrees). Uses the IAU 1958
// J2000 galactic pole (ra=192.85948°, decl=27.12825°) and ascending-node longitude
// (lN=122.93192°). Galactic frame is time-invariant, so no jd dependence.
function galacticToEquatorial(l, b) {
	const ap = degToRad(192.85948), dp = degToRad(27.12825), lN = degToRad(122.93192);
	const lr = degToRad(l), br = degToRad(b);
	const sinDec = Math.sin(dp) * Math.sin(br) + Math.cos(dp) * Math.cos(br) * Math.cos(lN - lr);
	const dec = Math.asin(clamp(sinDec, -1, 1));
	const y = Math.cos(br) * Math.sin(lN - lr);
	const x = Math.cos(dp) * Math.sin(br) - Math.sin(dp) * Math.cos(br) * Math.cos(lN - lr);
	const ra = ap + Math.atan2(y, x);
	return { ra: normalizeDegrees(radToDeg(ra)), decl: radToDeg(dec) };
}

// ── 岁差:J2000 平赤道 → 当日平赤道(Meeus《天文算法》21.3 / 21.4,IAU 1976 系数)。────────────
// 星表(BSC5)、星座连线 / 界、星官、三垣数据全是 J2000 历元;不做岁差就和「当日历元」的日月行星 / 二十八宿距星
// 同屏两套历元(当代差 ~0.35°,公元 1000 年差十几度)。只做平岁差:章动(≤17″)与光行差(≤20″)对天文馆视觉
// 精度可忽略(星点直径量级以下),暂不加,帮助文档如实说明。
function precessionAnglesJ2000ToDate(jd) {
	const T = (Number(jd) - 2451545.0) / 36525;
	const zeta = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T * T * T) / 3600;
	const z = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T * T * T) / 3600;
	const theta = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T * T * T) / 3600;
	return { zeta, z, theta };
}

// 3×3 旋转矩阵(行主序 9 元素):J2000 直角赤道向量 → 当日直角赤道向量。热路径(8404 星逐帧)用它,
// 每帧只算一次三角函数,逐星只做 9 次乘加 + 一次 atan2/asin。
function precessionMatrixJ2000ToDate(jd) {
	const a = precessionAnglesJ2000ToDate(jd);
	const cz = Math.cos(degToRad(a.zeta)), sz = Math.sin(degToRad(a.zeta));
	const cZ = Math.cos(degToRad(a.z)), sZ = Math.sin(degToRad(a.z));
	const ct = Math.cos(degToRad(a.theta)), st = Math.sin(degToRad(a.theta));
	// P = Rz(-z) · Ry(θ) · Rz(-ζ)(Meeus 21.4 的矩阵形式)
	return [
		cz * ct * cZ - sz * sZ, -sz * ct * cZ - cz * sZ, -st * cZ,
		cz * ct * sZ + sz * cZ, -sz * ct * sZ + cz * cZ, -st * sZ,
		cz * st, -sz * st, ct,
	];
}

// 把 J2000 (ra, decl) 按矩阵转到当日历元,结果写进 out({ra, decl}),不分配新对象(热路径零 GC)。
function applyPrecessionMatrixInto(m, ra, decl, out) {
	const raR = degToRad(ra);
	const decR = degToRad(decl);
	const cd = Math.cos(decR);
	const x = cd * Math.cos(raR);
	const y = cd * Math.sin(raR);
	const zz = Math.sin(decR);
	const x2 = m[0] * x + m[1] * y + m[2] * zz;
	const y2 = m[3] * x + m[4] * y + m[5] * zz;
	const z2 = m[6] * x + m[7] * y + m[8] * zz;
	out.ra = normalizeDegrees(radToDeg(Math.atan2(y2, x2)));
	out.decl = radToDeg(Math.asin(clamp(z2, -1, 1)));
	return out;
}

// 便捷版:J2000 (ra, decl) → 当日历元 {ra, decl}(度)。
function precessJ2000ToDate(ra, decl, jd) {
	if (!Number.isFinite(Number(ra)) || !Number.isFinite(Number(decl)) || !Number.isFinite(Number(jd))) {
		return null;
	}
	return applyPrecessionMatrixInto(precessionMatrixJ2000ToDate(jd), Number(ra), Number(decl), { ra: 0, decl: 0 });
}

// 数据项是否为 J2000 历元坐标:星表星(kind=catalogStar)、连线 / 星官 / 三垣等静态数据(epoch='J2000')。
// 投影时先岁差到当日;投影产物记 raJ2000/declJ2000 作基底、epoch 改 'date',再投影时从基底重算 → 幂等不叠加。
function isJ2000Item(item) {
	return !!item && (item.epoch === 'J2000' || item.kind === 'catalogStar' || Number.isFinite(Number(item.raJ2000)));
}

// Equatorial (ra/decl) -> horizontal (alt/az) for the observer at `jd`.
// `altitudeAppa` is the apparent (refracted) altitude — what toSkyVector uses —
// matching swisseph; `altitudeTrue` is the geometric altitude. Azimuth keeps the
// existing convention (south-referenced; PlanetariumBabylon adds +180 in
// normalizeAzimuth/toSkyVector — do NOT change here).
function equatorialToHorizontal(ra, decl, jd, observer, applyRefraction = true) {
	if (!Number.isFinite(Number(ra)) || !Number.isFinite(Number(decl)) || !Number.isFinite(Number(jd))) {
		return null;
	}
	const obs = observer || {};
	const lat = degToRad(obs.lat || 0);
	const dec = degToRad(decl);
	const lst = normalizeDegrees(apparentSiderealDegrees(jd) + Number(obs.lon || 0));
	const ha = degToRad(normalizeDegrees(lst - Number(ra)));
	const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(ha);
	const alt = Math.asin(clamp(sinAlt, -1, 1));
	const az = Math.atan2(
		-Math.sin(ha),
		Math.tan(dec) * Math.cos(lat) - Math.sin(lat) * Math.cos(ha),
	);
	const standardAz = normalizeDegrees(radToDeg(az));
	const trueAltDeg = radToDeg(alt);
	// 天球外观(orbit)展示几何原貌 → 不加大气折射;只有地表观测(ground)才折射(贴地平线处最大,正是用户看到的「线/星过地平线偏转」)。
	const apparentAltDeg = applyRefraction ? (trueAltDeg + atmosphericRefractionDeg(trueAltDeg)) : trueAltDeg;
	return {
		altitudeTrue: trueAltDeg,
		altitudeAppa: apparentAltDeg,
		azimuth: normalizeDegrees(standardAz + 180),
	};
}

// Project a catalog/overlay item to horizontal coords at `jd`. Prefers an
// explicit ra/decl; otherwise derives them from ecliptic lon/lat (date obliquity).
function projectedEquatorialItem(item, jd, observer, applyRefraction = true) {
	let ra = item && item.ra;
	let decl = item && item.decl;
	let j2000 = null;
	if (isJ2000Item(item) && Number.isFinite(Number(jd))) {
		// J2000 数据:以 raJ2000/declJ2000(首次投影时即原 ra/decl)为基底做岁差 → 当日历元;重复投影不叠加。
		const baseRa = Number.isFinite(Number(item.raJ2000)) ? Number(item.raJ2000) : Number(ra);
		const baseDecl = Number.isFinite(Number(item.declJ2000)) ? Number(item.declJ2000) : Number(decl);
		const p = precessJ2000ToDate(baseRa, baseDecl, jd);
		if (p) {
			j2000 = { raJ2000: baseRa, declJ2000: baseDecl };
			ra = p.ra;
			decl = p.decl;
		}
	}
	if ((!Number.isFinite(Number(ra)) || !Number.isFinite(Number(decl))) && item && item.lon !== undefined) {
		const eq = eclipticToEquatorial(item.lon, item.lat || 0, jd);
		if (eq) {
			ra = eq.ra;
			decl = eq.decl;
		}
	}
	const pos = equatorialToHorizontal(ra, decl, jd, observer, applyRefraction);
	if (!pos) {
		return item;
	}
	return {
		...item,
		...(j2000 ? { ...j2000, epoch: 'date' } : {}),
		ra,
		decl,
		...pos,
		visible: pos.altitudeAppa > 0,
		horizonState: pos.altitudeAppa > 0 ? '可见' : '地平线下',
	};
}

// Local apparent sidereal time (degrees) at observer longitude.
function localSiderealDeg(jd, lon) {
	return normalizeDegrees(apparentSiderealDegrees(jd) + Number(lon || 0));
}

// Hour angle (degrees) of an object: HA = LST - RA, normalized to [0,360).
function hourAngleDeg(jd, lon, ra) {
	return normalizeDegrees(localSiderealDeg(jd, lon) - Number(ra));
}

// Rise / transit / set as Julian Days for a fixed-equatorial object (Meeus-style,
// single iteration; visual-grade). h0 = standard horizon altitude (-0.5667° incl.
// refraction). Returns {transitJd, riseJd, setJd} or {transitJd, circumpolar} /
// {transitJd, neverRises} at high latitudes. 360.98564736629 = sidereal deg/day.
function riseTransitSet(ra, decl, jd, observer, h0 = -0.5667) {
	const lat = degToRad((observer && observer.lat) || 0);
	const dec = degToRad(Number(decl));
	const lst = localSiderealDeg(jd, (observer && observer.lon) || 0);
	const ha = normalizeDegrees(lst - Number(ra));
	const haS = (ha > 180 ? ha - 360 : ha);
	const transitJd = jd + (-haS / 360.98564736629);
	const cosH = (Math.sin(degToRad(h0)) - Math.sin(lat) * Math.sin(dec)) / (Math.cos(lat) * Math.cos(dec));
	if (cosH < -1) { return { transitJd, circumpolar: true }; }
	if (cosH > 1) { return { transitJd, neverRises: true }; }
	const H = radToDeg(Math.acos(clamp(cosH, -1, 1)));
	const dt = H / 360.98564736629;
	return { transitJd, riseJd: transitJd - dt, setJd: transitJd + dt };
}

// Apparent ecliptic longitude of the Sun (degrees), Meeus low-accuracy (~0.01°).
// Used for the analemma / 日行迹. Visual-grade.
function sunEclipticLongitude(jd) {
	const T = (Number(jd) - 2451545.0) / 36525;
	const L0 = normalizeDegrees(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
	const M = degToRad(normalizeDegrees(357.52911 + 35999.05029 * T - 0.0001537 * T * T));
	const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M)
		+ (0.019993 - 0.000101 * T) * Math.sin(2 * M)
		+ 0.000289 * Math.sin(3 * M);
	return normalizeDegrees(L0 + C);
}

export {
	degToRad,
	radToDeg,
	clamp,
	normalizeDegrees,
	gmstDegrees,
	meanObliquityDeg,
	nutationLongitudeDeg,
	apparentSiderealDegrees,
	atmosphericRefractionDeg,
	eclipticToEquatorial,
	galacticToEquatorial,
	precessionAnglesJ2000ToDate,
	precessionMatrixJ2000ToDate,
	applyPrecessionMatrixInto,
	precessJ2000ToDate,
	isJ2000Item,
	equatorialToHorizontal,
	projectedEquatorialItem,
	localSiderealDeg,
	hourAngleDeg,
	riseTransitSet,
	sunEclipticLongitude,
};
