// 天文馆 · 天球数学:角度换算、钳制、星色温、天球向量、校准混合、大气折射反算、坐标互转、观测者解析、相机朝向、缓动插值。
// 只被 components/planetarium/PlanetariumBabylon.js 与同目录 babylon/ 下的兄弟模块引用。
import { meanObliquityDeg, localSiderealDeg } from '../planetariumProjection';
import { BABYLON } from './constants';

export function degToRad(deg){
	return (Number(deg) || 0) * Math.PI / 180;
}

export function nowMs(){
	if(typeof performance !== 'undefined' && performance && performance.now){
		return performance.now();
	}
	return Date.now();
}

function normalizeAzimuth(azimuth){
	return ((Number(azimuth) || 0) + 180) % 360;
}

export function clamp(value, min, max){
	return Math.max(min, Math.min(max, value));
}

export function starTemperatureColor(star, brightness){
	const kelvin = Number(star && star.colorTemperature);
	if(!Number.isFinite(kelvin) || kelvin <= 0){
		return {
			r: 0.58 + brightness * 0.34,
			g: 0.66 + brightness * 0.22,
			b: 0.86 + brightness * 0.1,
		};
	}
	const t = clamp(kelvin, 2800, 14000);
	const warm = clamp((6500 - t) / 3700, 0, 1);
	const cool = clamp((t - 6500) / 7500, 0, 1);
	return {
		r: clamp(0.82 + warm * 0.18 - cool * 0.08, 0.52, 1),
		g: clamp(0.82 + warm * 0.06 + cool * 0.05, 0.52, 1),
		b: clamp(0.86 - warm * 0.34 + cool * 0.14, 0.48, 1),
	};
}

export function toSkyVector(item, radius){
	const alt = Number(item.altitudeAppa !== undefined && item.altitudeAppa !== null ? item.altitudeAppa : item.altitudeTrue) || 0;
	const az = normalizeAzimuth(item.azimuth);
	const altRad = degToRad(alt);
	const azRad = degToRad(az);
	const r = radius * Math.cos(altRad);
	return new BABYLON.Vector3(
		r * Math.sin(azRad),
		radius * Math.sin(altRad),
		r * Math.cos(azRad),
	);
}

// 写入既有 Vector3(零分配)版本:供每帧 8404 星热路径复用 particle.position,消除海量 GC(播放卡顿根因)。
export function toSkyVectorInto(item, radius, target){
	const alt = Number(item.altitudeAppa !== undefined && item.altitudeAppa !== null ? item.altitudeAppa : item.altitudeTrue) || 0;
	const az = normalizeAzimuth(item.azimuth);
	const altRad = degToRad(alt);
	const azRad = degToRad(az);
	const r = radius * Math.cos(altRad);
	target.set(r * Math.sin(azRad), radius * Math.sin(altRad), r * Math.cos(azRad));
	return target;
}

// 最短弧差(度):a 归一到 (-180, 180],用于校准回包与本地外推值之差(跨 0/360 不出 359° 的假差)。
export function shortestArcDeg(a){
	return ((((Number(a) || 0) + 540) % 360) + 360) % 360 - 180;
}
// 校准衔接淡出:回包落地后 BLEND_MS 内把「本地外推值 − 真值」的残差线性淡到 0 → 视觉无跳变、位置收敛到精确星历。
// 旧写法把「旧基线按旧速度外推到校准时刻」当新基线、真值只在无旧基线时用 → 整段播放成步长=同步间隔的欧拉积分,误差只增不减(T-199)。
const CALIB_BLEND_MS = 700;
export function calibBlendFactor(src, now){
	if(!src || !Number.isFinite(src._blendAt)){ return 0; }
	const k = 1 - (now - src._blendAt) / CALIB_BLEND_MS;
	return k > 0 ? (k < 1 ? k : 1) : 0;
}
// 黄纬只在短窗内线性外推:月亮黄纬 ±5° 按 13.7 天正弦摆动,超 2 天的线性外推比「按住基线」更离谱(月进档实抓 125°)。
export const LAT_EXTRAP_MAX_DAYS = 2;
// 播放校准也按「模拟时间」触发:两次校准间模拟时间 ≥ 0.25 天就再校(墙钟节奏只是上限),
// 高速档(日进 / 月进)下校准点密到 API 延迟允许的极限,线性外推窗随之收窄。
export const CALIB_SIM_GAP_DAYS = 0.25;
export const CALIB_MIN_WALL_MS = 250;

export function normalizeDegrees(deg){
	return ((Number(deg) % 360) + 360) % 360;
}

function radToDeg(rad){
	return (Number(rad) || 0) * 180 / Math.PI;
}

// ---- 天区方向反算(点击空白处读坐标 / 角距测量用)。纯天文:真实赤道/黄道,无 zodiacal/宿度/岁差污染。----

// 大气折射逆映射(视高度 → 真高度),Bennett 公式 —— 与 planetariumProjection 的 Saemundsson(真→视)互为伴随。
// 仅地表观测(ground,加折射)时需要;天球外观(orbit)几何原貌不折射。
export function inverseRefractionDeg(apparentAltDeg){
	const h = Number(apparentAltDeg);
	if(!Number.isFinite(h) || h < -1){ return 0; }
	// Bennett: R(arcmin) = 1/tan(h + 7.31/(h+4.4)),按后端气压/温度(1000 mbar / 20℃)缩放,与正向一致。
	let rArcmin = 1 / Math.tan(degToRad(h + 7.31 / (h + 4.4)));
	rArcmin *= (1000 / 1010) * (283 / (273 + 20));
	return Math.max(0, rArcmin) / 60;
}

// toSkyVector 的逆:由场景单位方向向量恢复 {altitudeAppa(视高度), azimuth(展示方位)}。
// 正向:az_scene=(azimuth+180)mod360,x=r·sin(az_scene),z=r·cos(az_scene),y=R·sin(alt)。
export function skyDirectionFromVector(vec){
	if(!vec){ return null; }
	const n = vec.length && vec.length() > 1e-9 ? vec.normalize() : vec;
	const alt = radToDeg(Math.asin(clamp(n.y, -1, 1)));
	const azScene = normalizeDegrees(radToDeg(Math.atan2(n.x, n.z))); // = normalizeAzimuth(azimuth)
	const azimuth = normalizeDegrees(azScene + 180); // 还原展示用方位(与 equatorialToHorizontal 输出同制)
	return { altitudeAppa: alt, azimuth };
}

// 水平(视高度,展示方位)→ 赤道(ra/decl)。equatorialToHorizontal 的逆。
// applyRefraction=true 时先用 Bennett 把视高度还原成真(几何)高度,再反算 —— 与正向折射对称。
// 方位制:正向 azimuth = standardAz + 180(standardAz 自南起、向西增),此处先减回 standardAz。
export function horizontalToEquatorial(altitudeAppa, azimuth, jd, observer, applyRefraction = true){
	if(!Number.isFinite(Number(altitudeAppa)) || !Number.isFinite(Number(azimuth)) || !Number.isFinite(Number(jd))){
		return null;
	}
	const obs = observer || {};
	const lat = degToRad(obs.lat || 0);
	const altTrue = applyRefraction ? (Number(altitudeAppa) - inverseRefractionDeg(altitudeAppa)) : Number(altitudeAppa);
	const alt = degToRad(altTrue);
	const standardAz = degToRad(normalizeDegrees(Number(azimuth) - 180));
	const sinDec = Math.sin(lat) * Math.sin(alt) + Math.cos(lat) * Math.cos(alt) * Math.cos(standardAz);
	const dec = Math.asin(clamp(sinDec, -1, 1));
	const cosDec = Math.cos(dec);
	const sinHa = (Math.abs(cosDec) < 1e-9) ? 0 : (-Math.sin(standardAz) * Math.cos(alt) / cosDec);
	const cosHa = (Math.abs(cosDec) < 1e-9 || Math.abs(Math.cos(lat)) < 1e-9)
		? 1
		: ((Math.sin(alt) - Math.sin(lat) * Math.sin(dec)) / (Math.cos(lat) * cosDec));
	const ha = Math.atan2(clamp(sinHa, -1, 1), clamp(cosHa, -1, 1));
	const lst = localSiderealDeg(jd, Number(obs.lon || 0));
	const ra = normalizeDegrees(lst - radToDeg(ha));
	return { ra, decl: radToDeg(dec) };
}

// 赤道(ra/decl)→ 黄道(lon/lat)。eclipticToEquatorial 的逆,用按日期的平黄赤交角。
export function equatorialToEcliptic(ra, decl, jd){
	if(!Number.isFinite(Number(ra)) || !Number.isFinite(Number(decl))){ return null; }
	const eps = degToRad(Number.isFinite(Number(jd)) ? meanObliquityDeg(jd) : 23.4392911);
	const raR = degToRad(ra);
	const decR = degToRad(decl);
	const sinLat = Math.sin(decR) * Math.cos(eps) - Math.cos(decR) * Math.sin(eps) * Math.sin(raR);
	const lat = Math.asin(clamp(sinLat, -1, 1));
	const y = Math.sin(raR) * Math.cos(eps) + Math.tan(decR) * Math.sin(eps);
	const x = Math.cos(raR);
	const lon = Math.atan2(y, x);
	return { lon: normalizeDegrees(radToDeg(lon)), lat: radToDeg(lat) };
}

// 球面角距(度):两单位方向向量夹角 = acos(点积)。用于角距测量(大圆距离)。
export function angularSeparationDeg(a, b){
	if(!a || !b){ return null; }
	const na = a.normalize ? a.normalize() : a;
	const nb = b.normalize ? b.normalize() : b;
	const dot = clamp(na.x * nb.x + na.y * nb.y + na.z * nb.z, -1, 1);
	return radToDeg(Math.acos(dot));
}

function parseGeoDegree(value){
	if(value === undefined || value === null || value === ''){
		return null;
	}
	if(typeof value === 'number' && Number.isFinite(value)){
		return value;
	}
	const text = `${value}`.trim().toLowerCase();
	const direct = Number(text);
	if(Number.isFinite(direct)){
		return direct;
	}
	const sign = /[ws]/.test(text) ? -1 : 1;
	const parts = text.replace(/[nsew]/g, ' ').trim().split(/[^0-9.]+/).filter(Boolean).map(Number);
	if(!parts.length || !Number.isFinite(parts[0])){
		return null;
	}
	return sign * (Math.abs(parts[0]) + (Number(parts[1]) || 0) / 60 + (Number(parts[2]) || 0) / 3600);
}

export function observerFromFields(fields, data){
	const observer = data && data.observer ? data.observer : {};
	const firstGeo = (...values)=>{
		for(let i = 0; i < values.length; i += 1){
			const parsed = parseGeoDegree(values[i]);
			if(parsed !== null && parsed !== undefined && Number.isFinite(parsed)){
				return parsed;
			}
		}
		return 0;
	};
	const lat = firstGeo(
		fields && fields.gpsLat ? fields.gpsLat.value : null,
		observer.gpsLat,
		fields && fields.lat ? fields.lat.value : null,
		observer.lat,
	);
	const lon = firstGeo(
		fields && fields.gpsLon ? fields.gpsLon.value : null,
		observer.gpsLon,
		fields && fields.lon ? fields.lon.value : null,
		observer.lon,
	);
	return { lat, lon };
}

export function observerFromData(observer){
	const src = observer || {};
	const firstGeo = (...values)=>{
		for(let i = 0; i < values.length; i += 1){
			const parsed = parseGeoDegree(values[i]);
			if(parsed !== null && parsed !== undefined && Number.isFinite(parsed)){
				return parsed;
			}
		}
		return 0;
	};
	return {
		lat: firstGeo(src.gpsLat, src.lat),
		lon: firstGeo(src.gpsLon, src.lon),
		jd: src.jd,
	};
}

// gmstDegrees / equatorialToHorizontal / eclipticToEquatorial / projectedEquatorialItem
// now live in ./planetariumProjection (BABYLON-free, unit-tested, swisseph-aligned
// apparent alt/az incl. atmospheric refraction). Imported at the top of this file.

export function cameraRotationForDirection(direction){
	const dir = direction.clone().normalize();
	return {
		x: -Math.asin(clamp(dir.y, -1, 1)),
		y: Math.atan2(dir.x, dir.z),
	};
}

export function easeInOutCubic(t){
	const v = clamp(t, 0, 1);
	return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2;
}

export function lerpNumber(a, b, t){
	return a + (b - a) * t;
}
