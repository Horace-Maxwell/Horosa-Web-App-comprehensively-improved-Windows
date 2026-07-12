import { Component, createRef, memo } from 'react';
import DateTime from '../comp/DateTime';
import DateTimeSelector from '../comp/DateTimeSelector';
import { planetariumRenderGatingEnabled, planetariumOnDemandRenderEnabled, planetariumMetricsThrottleEnabled, planetariumTimeEditDebounceEnabled } from '../../utils/perfFlags';

// perf:planetariumRenderGating —— 天文馆渲染时机门控参数(只动时机不动内容):
//   IDLE_FRAME_MS:静止时降帧间隔(~10fps);静止画面在任何帧率下视觉一致,留出 CPU 给主线程消除卡顿。
//   SETTLE_MS:一次交互后维持满帧的时窗(拖动顺滑 + 覆盖惯性/收尾),之后回落到降帧。
const PLANETARIUM_IDLE_FRAME_MS = 100;
const PLANETARIUM_SETTLE_MS = 600;

// 时间编辑器隔离壳:天文馆每秒上百次 metrics/FPS 重渲,会带着 DateTimeSelector 一起重渲;
// 而 DateTimeSelector 内部 Option 用 randomStr 每渲生成新 key → Select 下拉项被不断 remount → 下拉无法停留。
// memo + 自定义比较:只在 time(钟面值)真正变化时才重渲,彻底隔离高频重渲 → 下拉可正常展开停留。
const PlanetariumTimeEditor = memo(function PlanetariumTimeEditor({ time, onChange }){
	return (
		<DateTimeSelector showTime={true} showAdjust={true} value={time} onChange={onChange} />
	);
}, (prev, next)=>{
	// onChange 引用稳定(构造器 bind);只比 time 的钟面值(同值即跳过重渲)。
	const a = prev.time, b = next.time;
	if(a === b){ return true; }
	if(!a || !b){ return a === b; }
	return a.ad === b.ad && a.year === b.year && a.month === b.month && a.date === b.date
		&& a.hour === b.hour && a.minute === b.minute && a.second === b.second && a.zone === b.zone;
});
import { fetchPlanetariumState } from '../../services/planetarium';
import GeoCoordModal from '../amap/GeoCoordModal';
import { convertLatToStr, convertLonToStr } from '../astro/AstroHelper';
import { dstAwareZoneAt } from '../../utils/timezone';
import XQIcon from '../xq-icons';
import { eclipticToEquatorial, equatorialToHorizontal, galacticToEquatorial, projectedEquatorialItem, meanObliquityDeg, localSiderealDeg, hourAngleDeg, riseTransitSet, sunEclipticLongitude } from './planetariumProjection';
import { nearestPointToRay, buildStarIndex, findStarByName, starDisplayLabel } from './planetariumStarSearch';
import { STAR_PROPER_NAMES } from './planetariumStarNames';
import SANYUAN_WALLS from '../../data/sanyuanWalls.json';
import CONSTELLATION_LINES from '../../data/constellationLines.json';
import CONSTELLATION_BOUNDS from '../../data/constellationBounds.json';
import CHINESE_ASTERISMS from '../../data/chineseAsterisms.json';

const BABYLON = typeof window !== 'undefined' ? window.BABYLON : null;

const SKY_RADIUS = 2600;
const BODY_RADIUS = 820;
const STAR_RADIUS = 780;
const LINE_RADIUS = 760;
const OBSERVER_EYE_HEIGHT = 5;
const GROUND_MIN_FOV = 0.18;
const GROUND_MAX_FOV = 1.62;
const ORBIT_MIN_RADIUS = 80;
const ORBIT_MAX_RADIUS = 2400;
const PLANETARIUM_PERF_KEY = '__horosaPlanetariumPerf';
const HORIZON_PANORAMA_URL = 'planetarium/horizon-panorama.png?v=20260522-landscape-5'; // 原照片全景地面(默认样式);程序化美化地面为可选第二样式
// 星等过滤滑块边界:6.5 = BSC5(Yale 亮星表)肉眼可见上限 → 默认即此值,等价「全部显示」,零回归。
const STAR_MAG_LIMIT_MIN = 1.0;
const STAR_MAG_LIMIT_MAX = 6.5;
let planetariumStateCache = null;

const BODY_LABELS = {
	Sun: '太阳',
	Moon: '月亮',
	Earth: '地球',
	Mercury: '水星',
	Venus: '金星',
	Mars: '火星',
	Jupiter: '木星',
	Saturn: '土星',
	Uranus: '天王星',
	Neptune: '海王星',
	Pluto: '冥王星',
	'North Node': '北交点',
	'South Node': '南交点',
};

const BODY_ENGLISH_LABELS = {
	Sun: 'Sun',
	Moon: 'Moon',
	Earth: 'Earth',
	Mercury: 'Mercury',
	Venus: 'Venus',
	Mars: 'Mars',
	Jupiter: 'Jupiter',
	Saturn: 'Saturn',
	Uranus: 'Uranus',
	Neptune: 'Neptune',
	Pluto: 'Pluto',
	'North Node': 'North Node',
	'South Node': 'South Node',
};

const BODY_COLORS = {
	Sun: new BABYLON.Color3(1.0, 0.76, 0.25),
	Moon: new BABYLON.Color3(0.82, 0.9, 1.0),
	Earth: new BABYLON.Color3(0.24, 0.55, 0.95),
	Mercury: new BABYLON.Color3(0.72, 0.72, 0.68),
	Venus: new BABYLON.Color3(0.98, 0.72, 0.48),
	Mars: new BABYLON.Color3(1.0, 0.34, 0.22),
	Jupiter: new BABYLON.Color3(0.95, 0.72, 0.48),
	Saturn: new BABYLON.Color3(0.92, 0.82, 0.56),
	Uranus: new BABYLON.Color3(0.44, 0.9, 0.96),
	Neptune: new BABYLON.Color3(0.38, 0.52, 1.0),
	Pluto: new BABYLON.Color3(0.78, 0.66, 0.58),
	'North Node': new BABYLON.Color3(0.75, 0.88, 1.0),
	'South Node': new BABYLON.Color3(0.7, 0.58, 0.96),
};

const TEXTURED_BODY_IDS = new Set([
	'Sun', 'Moon', 'Earth', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
]);

const ALWAYS_LABELED_BODY_IDS = new Set([
	'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
]);

const BODY_VISUALS = {
	Sun: { emissive: 1.35, haloScale: 2.85, haloAlpha: 0.2 },
	Moon: { emissive: 0.92, haloScale: 1.75, haloAlpha: 0.1 },
	Mercury: { emissive: 0.58, haloScale: 1.55, haloAlpha: 0.07 },
	Venus: { emissive: 0.9, haloScale: 1.85, haloAlpha: 0.13 },
	Mars: { emissive: 0.72, haloScale: 1.7, haloAlpha: 0.1 },
	Jupiter: { emissive: 0.78, haloScale: 1.75, haloAlpha: 0.11 },
	Saturn: { emissive: 0.72, haloScale: 1.72, haloAlpha: 0.1 },
	Uranus: { emissive: 0.7, haloScale: 1.64, haloAlpha: 0.09 },
	Neptune: { emissive: 0.72, haloScale: 1.64, haloAlpha: 0.09 },
	Pluto: { emissive: 0.56, haloScale: 1.5, haloAlpha: 0.06 },
};

const DEFAULT_LAYERS = {
	stars: false, // 默认关闭恒星层(用户偏好:开盘默认不显裸眼恒星,界面更简洁;可在左栏「天体与星官」一键开启)
	bodies: true,
	atmosphere: true, // 大气层(默认开):关→天空纯黑(白天也黑)、关大气折射、无地平辉光,变纯黑底真空星空
	ground: true, // 地面(默认开):地表观测下关→看到地平线以下整个天球(不被地面遮挡)
	horizon: true,
	equator: true,
	ecliptic: true,
	zodiacSectors: true,
	houses: true,
	su28: true,
	su28Sectors: true,
	beidou: true,
	qizheng: true,
	// 「对标专业星图」增强层(默认关,经折叠面板/一键预设开启;celestialPoles 例外见下)。
	starNames: false,
	threeEnclosures: false,
	galacticEquator: false,
	constellationLines: false,
	constellationBounds: false,
	horizontalGrid: false,
	equatorialGrid: false,
	eclipticGrid: false,
	su28Grid: false,
	coordLabels: false,
	raHourScale: false,
	eclipticDegreeScale: false,
	azimuthScale: false,
	altitudeScale: false,
	celestialPoles: true, // 保「北天极一直可见」旧行为
	eclipticPoles: false,
	galacticPoles: false,
	precessionCircle: false,
	analemma: false,
	milkyWay: false,
	xingguan: false, // 完整星官(312)连线+名,默认关 → 零回归
	planetTrails: false, // 行星视运动轨迹,默认关 → 默认不带 includeTrails、零额外请求
};

// 侧栏折叠分组(阶段 C):新旧图层统一收进 5 个可折叠分组。
const LAYER_GROUPS = [
	{ id: 'scene', title: '场景 · 地面', chips: [['atmosphere', '大气层'], ['ground', '地面']] },
	{ id: 'objects', title: '天体与星官', chips: [['stars', '恒星'], ['bodies', '星体'], ['starNames', '星名'], ['su28', '二十八宿'], ['su28Sectors', '宿区间'], ['threeEnclosures', '三垣'], ['beidou', '北斗'], ['xingguan', '星官']] },
	{ id: 'circles', title: '参考圈', chips: [['horizon', '地平/子午'], ['equator', '天赤道'], ['ecliptic', '黄道'], ['zodiacSectors', '星座区间'], ['houses', '宫位'], ['galacticEquator', '银道'], ['constellationLines', '星座连线'], ['constellationBounds', '星座边界']] },
	{ id: 'grids', title: '坐标网格', legend: { horizontalGrid: 'grid-h', equatorialGrid: 'grid-eq', eclipticGrid: 'grid-ec', su28Grid: 'grid-su28' }, chips: [['horizontalGrid', '地平网格'], ['equatorialGrid', '赤道网格'], ['eclipticGrid', '黄道网格'], ['su28Grid', '宿度网格']] },
	{ id: 'scales', title: '刻度与标注', chips: [['coordLabels', '坐标数字'], ['raHourScale', '赤经时标'], ['eclipticDegreeScale', '黄道度标'], ['azimuthScale', '方位刻度'], ['altitudeScale', '高度刻度']] },
	{ id: 'poles', title: '极点与高阶', chips: [['celestialPoles', '天极'], ['eclipticPoles', '黄极'], ['galacticPoles', '银极'], ['milkyWay', '银河'], ['precessionCircle', '岁差圈'], ['analemma', '日行迹'], ['planetTrails', '行星轨迹']] }, // 银河(milkyWay)程序化银道带,默认关;行星轨迹(planetTrails)开启才带 includeTrails 重取
];
// 「对标专业星图」一键预设:常用专业坐标层一次铺开。
const PROFESSIONAL_LAYERS = { equatorialGrid: true, eclipticGrid: true, coordLabels: true, raHourScale: true, eclipticDegreeScale: true, celestialPoles: true, eclipticPoles: true, galacticEquator: true, starNames: true };

const SU28_PALACE_COLORS = [
	new BABYLON.Color3(0.34, 0.78, 0.92),
	new BABYLON.Color3(0.44, 0.82, 0.58),
	new BABYLON.Color3(0.94, 0.74, 0.38),
	new BABYLON.Color3(0.78, 0.58, 0.96),
];

// 二十八宿传统序(角起:东方七宿→北方→西方→南方,每 7 宿一象)。四象配色/象首强调须按此序,
// 而非按赤经升序(否则 idx=0=赤经最小的奎宿区,四象色与象首整体偏移一象)。宿名不识别则退回 idx(零回归)。
const SU28_SEQUENCE = ['角', '亢', '氐', '房', '心', '尾', '箕', '斗', '牛', '女', '虚', '危', '室', '壁', '奎', '娄', '胃', '昴', '毕', '觜', '参', '井', '鬼', '柳', '星', '张', '翼', '轸'];
function su28SequenceIndex(item){
	const raw = String((item && (item.name || item.displayName || item.id)) || '').trim();
	if(!raw){ return -1; }
	let i = SU28_SEQUENCE.indexOf(raw);
	if(i < 0){ i = SU28_SEQUENCE.indexOf(raw.replace(/宿$/, '')); }
	if(i < 0){ i = SU28_SEQUENCE.indexOf(raw[0]); }
	return i;
}

// 星官(312)配色:按四象/三垣分色 —— 纯传统象征色,与坐标制无关(纯天文铁律:坐标全用数据集真实 ra/decl)。
// 四象:东方青龙=青、北方玄武=玄(紫黑)、西方白虎=白银、南方朱雀=赤;三垣三色(紫微/太微/天市);近南极一色。
// 取色优先用 group(可区分三垣三墙),回退 symbol(四象/近南极)。
const ASTERISM_GROUP_COLORS = {
	紫微垣: new BABYLON.Color3(0.86, 0.62, 0.98),
	太微垣: new BABYLON.Color3(0.7, 0.7, 0.98),
	天市垣: new BABYLON.Color3(0.62, 0.86, 0.96),
};
const ASTERISM_SYMBOL_COLORS = {
	青龙: new BABYLON.Color3(0.34, 0.82, 0.86),
	玄武: new BABYLON.Color3(0.56, 0.5, 0.86),
	白虎: new BABYLON.Color3(0.86, 0.88, 0.92),
	朱雀: new BABYLON.Color3(0.96, 0.46, 0.42),
	三垣: new BABYLON.Color3(0.82, 0.7, 0.96),
	近南极: new BABYLON.Color3(0.62, 0.78, 0.7),
};
const ASTERISM_DEFAULT_COLOR = new BABYLON.Color3(0.72, 0.78, 0.86);
function asterismColor(item){
	if(item && item.group && ASTERISM_GROUP_COLORS[item.group]){ return ASTERISM_GROUP_COLORS[item.group]; }
	if(item && item.symbol && ASTERISM_SYMBOL_COLORS[item.symbol]){ return ASTERISM_SYMBOL_COLORS[item.symbol]; }
	return ASTERISM_DEFAULT_COLOR;
}

function degToRad(deg){
	return (Number(deg) || 0) * Math.PI / 180;
}

function nowMs(){
	if(typeof performance !== 'undefined' && performance && performance.now){
		return performance.now();
	}
	return Date.now();
}

function normalizeAzimuth(azimuth){
	return ((Number(azimuth) || 0) + 180) % 360;
}

function clamp(value, min, max){
	return Math.max(min, Math.min(max, value));
}

function starTemperatureColor(star, brightness){
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

function toSkyVector(item, radius){
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
function toSkyVectorInto(item, radius, target){
	const alt = Number(item.altitudeAppa !== undefined && item.altitudeAppa !== null ? item.altitudeAppa : item.altitudeTrue) || 0;
	const az = normalizeAzimuth(item.azimuth);
	const altRad = degToRad(alt);
	const azRad = degToRad(az);
	const r = radius * Math.cos(altRad);
	target.set(r * Math.sin(azRad), radius * Math.sin(altRad), r * Math.cos(azRad));
	return target;
}

function normalizeDegrees(deg){
	return ((Number(deg) % 360) + 360) % 360;
}

function radToDeg(rad){
	return (Number(rad) || 0) * 180 / Math.PI;
}

// ---- 天区方向反算(点击空白处读坐标 / 角距测量用)。纯天文:真实赤道/黄道,无 zodiacal/宿度/岁差污染。----

// 大气折射逆映射(视高度 → 真高度),Bennett 公式 —— 与 planetariumProjection 的 Saemundsson(真→视)互为伴随。
// 仅地表观测(ground,加折射)时需要;天球外观(orbit)几何原貌不折射。
function inverseRefractionDeg(apparentAltDeg){
	const h = Number(apparentAltDeg);
	if(!Number.isFinite(h) || h < -1){ return 0; }
	// Bennett: R(arcmin) = 1/tan(h + 7.31/(h+4.4)),按后端气压/温度(1000 mbar / 20℃)缩放,与正向一致。
	let rArcmin = 1 / Math.tan(degToRad(h + 7.31 / (h + 4.4)));
	rArcmin *= (1000 / 1010) * (283 / (273 + 20));
	return Math.max(0, rArcmin) / 60;
}

// toSkyVector 的逆:由场景单位方向向量恢复 {altitudeAppa(视高度), azimuth(展示方位)}。
// 正向:az_scene=(azimuth+180)mod360,x=r·sin(az_scene),z=r·cos(az_scene),y=R·sin(alt)。
function skyDirectionFromVector(vec){
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
function horizontalToEquatorial(altitudeAppa, azimuth, jd, observer, applyRefraction = true){
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
function equatorialToEcliptic(ra, decl, jd){
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
function angularSeparationDeg(a, b){
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

function observerFromFields(fields, data){
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

function observerFromData(observer){
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

function cameraRotationForDirection(direction){
	const dir = direction.clone().normalize();
	return {
		x: -Math.asin(clamp(dir.y, -1, 1)),
		y: Math.atan2(dir.x, dir.z),
	};
}

function easeInOutCubic(t){
	const v = clamp(t, 0, 1);
	return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2;
}

function lerpNumber(a, b, t){
	return a + (b - a) * t;
}

function formatDeg(val){
	if(val === undefined || val === null || Number.isNaN(Number(val))){
		return '--';
	}
	return `${Math.round(Number(val) * 1000) / 1000}°`;
}

function formatNumber(val, digits = 3, suffix = ''){
	if(val === undefined || val === null || val === '' || Number.isNaN(Number(val))){
		return '--';
	}
	const factor = Math.pow(10, digits);
	return `${Math.round(Number(val) * factor) / factor}${suffix}`;
}

function formatMag(val){
	if(val === undefined || val === null || val === '' || Number.isNaN(Number(val))){
		return '--';
	}
	return `${Math.round(Number(val) * 100) / 100}`;
}

function formatRa(val){
	if(val === undefined || val === null || Number.isNaN(Number(val))){
		return '--';
	}
	const total = Math.round(((((Number(val) / 15) % 24) + 24) % 24) * 3600) % (24 * 3600);
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	return `${h}h ${`${m}`.padStart(2, '0')}m ${`${s}`.padStart(2, '0')}s`;
}

function formatHourAngle(deg){
	if(deg === undefined || deg === null || Number.isNaN(Number(deg))){
		return '--';
	}
	let d = ((Number(deg) % 360) + 360) % 360;
	if(d > 180){ d -= 360; } // [-180,180] → 东(+)/西(−)
	const hours = d / 15;
	const sign = hours < 0 ? '-' : '+';
	const abs = Math.abs(hours);
	const h = Math.floor(abs);
	const m = Math.round((abs - h) * 60);
	const mm = m === 60 ? 0 : m;
	const hh = m === 60 ? h + 1 : h;
	return `${sign}${hh}h${`${mm}`.padStart(2, '0')}m`;
}

// 取亮星公认专名(中文优先),仅用于 starNames 标注。键由 STAR_PROPER_NAMES(HR 号)查得,
// 无专名返回 null → 只标famous 亮星,天然克制密度。坐标仍来自既有星表,不臆造。
function starProperName(star){
	if(!star){ return null; }
	const id = star.id;
	let hr = star.hr;
	// id 形如 "bsc5-2491" → 取结尾的 HR 号(2491),不要前缀里的 "5"。
	if((hr === undefined || hr === null) && typeof id === 'string'){ const m = id.match(/(\d+)\s*$/); if(m){ hr = m[1]; } }
	const e = (id && STAR_PROPER_NAMES[id])
		|| ((hr !== undefined && hr !== null) && STAR_PROPER_NAMES[`HR${hr}`])
		|| ((hr !== undefined && hr !== null) && STAR_PROPER_NAMES[`${hr}`]);
	return e ? (e.zh || e.proper) : null;
}

function valuePresent(value){
	return !(value === undefined || value === null || value === '' || value === '--');
}

function joinParts(parts, sep = ' · '){
	return (parts || []).filter(valuePresent).join(sep);
}

function angularDistance(start, end){
	return normalizeDegrees(Number(end) - Number(start));
}

function circularMidpoint(start, end){
	return normalizeDegrees(Number(start) + angularDistance(start, end) / 2);
}

function su28DisplayName(item){
	const name = item && (item.name || item.id);
	if(!name){
		return '宿';
	}
	return `${name}`.indexOf('宿') >= 0 ? `${name}` : `${name}宿`;
}

function houseDisplayName(item, idx){
	const raw = item && (item.id || item.name || item.label);
	const match = raw !== undefined && raw !== null ? `${raw}`.match(/\d+/) : null;
	const num = match ? Number(match[0]) : idx + 1;
	return `${Number.isFinite(num) && num > 0 ? num : idx + 1}宫`;
}

function preferredVisiblePoint(points){
	const visible = (points || []).filter((point)=>Number(point && point.altitudeAppa) > 0);
	const pool = visible.length ? visible : (points || []);
	if(!pool.length){
		return null;
	}
	return pool[Math.floor(pool.length / 2)];
}

function allAboveHorizon(items){
	return (items || []).every((item)=>Number(item && item.altitudeAppa) > 0);
}

function shouldShowModeBoundItem(item, viewMode, showBelowHorizon){
	if(!item || !item.visibilityMode){
		return true;
	}
	if(showBelowHorizon){
		return true; // 关「地面」:看地平线以下整个天球 —— 宿区间/区间等 mode-bound 元素不再按地平裁
	}
	if(item.visibilityMode === 'allAbove'){
		return viewMode === 'orbit' || allAboveHorizon(item.lastProjectedSources || item.visibilitySources);
	}
	if(item.visibilityMode === 'sourceAbove'){
		const source = item.lastProjectedSource || item.lastProjected || item.source;
		return viewMode === 'orbit' || Number(source && source.altitudeAppa) > 0;
	}
	return true;
}

function bodyName(item){
	if(!item){
		return '天体';
	}
	return BODY_LABELS[item.id] || item.displayName || item.name || item.properName || item.bayer || item.id || '天体';
}

function bodyEnglishName(item){
	if(!item){
		return '--';
	}
	if(BODY_ENGLISH_LABELS[item.id]){
		return BODY_ENGLISH_LABELS[item.id];
	}
	return joinParts([item.name && item.name !== item.displayName ? item.name : null, item.id], ' / ') || '--';
}

function objectType(item){
	if(!item){
		return '--';
	}
	if(item.kind === 'catalogStar'){
		return '裸眼恒星';
	}
	if(item.layer === 'su28'){
		return '二十八宿星点';
	}
	if(item.layer === 'beidou'){
		return '北斗星点';
	}
	if(item.layer === 'body'){
		if(item.id === 'Earth'){
			return '地球/观测点';
		}
		if(item.id === 'Sun'){
			return '太阳';
		}
		if(item.id === 'Moon'){
			return '月亮';
		}
		if(['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'].indexOf(item.id) >= 0){
			return '七政行星';
		}
		if(['Uranus', 'Neptune', 'Pluto'].indexOf(item.id) >= 0){
			return '现代外行星';
		}
		if(item.id === 'North Node' || item.id === 'South Node'){
			return '月交点';
		}
		return item.type || '天体';
	}
	return item.type || item.kind || item.layer || '--';
}

function layerLabel(item){
	const layer = item && item.layer;
	return {
		body: '太阳系天体',
		stars: '裸眼恒星',
		su28: '二十八宿',
		beidou: '北斗',
	}[layer] || layer || '--';
}

function catalogIdText(item){
	if(!item){
		return '--';
	}
	const parts = [];
	if(item.id){ parts.push(item.id); }
	if(item.bayer){ parts.push(`拜耳 ${item.bayer}`); }
	if(item.flamsteed){ parts.push(`弗兰斯蒂德 ${item.flamsteed}`); }
	if(item.constellation){ parts.push(`星座 ${item.constellation}`); }
	return parts.join(' / ') || '--';
}

// 🆕 镜像后端 webplanetariumsrv.py 的 ZODIAC_LABELS/ZODIAC_IDS。外推后用 lon 重新算 zodiac sign + degree → mutate src 字段 → 右栏拿到外推值。
const ZODIAC_LABELS_CN = ['白羊','金牛','双子','巨蟹','狮子','处女','天秤','天蝎','射手','摩羯','水瓶','双鱼'];
const ZODIAC_LABELS_EN = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];

function zodiacInfoForLon(lon){
	const norm = ((Number(lon) % 360) + 360) % 360;
	const idx = Math.floor(norm / 30) % 12;
	return {
		zodiacSign: ZODIAC_LABELS_CN[idx],
		zodiacSignId: ZODIAC_LABELS_EN[idx],
		zodiacDegree: norm - idx * 30,
		sign: ZODIAC_LABELS_EN[idx],
		signlon: norm - idx * 30,
	};
}

// 🆕 用 cusps 数组(state.data.overlays.houses,12 项含 lon 字段)按 lon 重新算 house 编号(1..12 数字)。
// houses[i] 是第 i+1 宫起点 cusp:第 1 宫 = [houses[0].lon, houses[1].lon),...,第 12 宫 = [houses[11].lon, houses[0].lon+360)(跨 360 处理)。
function houseForLon(lon, houses){
	if(!houses || houses.length < 12) return null;
	const norm = ((Number(lon) % 360) + 360) % 360;
	for(let i = 0; i < 12; i++){
		const start = ((Number(houses[i].lon) % 360) + 360) % 360;
		const end = ((Number(houses[(i+1) % 12].lon) % 360) + 360) % 360;
		if(start <= end){
			if(norm >= start && norm < end) return i + 1;
		}else{
			if(norm >= start || norm < end) return i + 1;
		}
	}
	return null;
}

function zodiacPositionText(item){
	if(!item){
		return '--';
	}
	if(valuePresent(item.zodiacSign) || valuePresent(item.zodiacDegree)){
		return `${item.zodiacSign || ''} ${formatDeg(item.zodiacDegree)}`.trim();
	}
	if(valuePresent(item.sign) || valuePresent(item.signlon)){
		return `${item.sign || ''} ${formatDeg(item.signlon)}`.trim();
	}
	return '--';
}

function skyPositionText(item){
	return joinParts([
		`高度 ${formatDeg(item && item.altitudeAppa)}`,
		`方位 ${formatDeg(item && item.azimuth)}`,
	]);
}

function equatorialText(item){
	return joinParts([
		`赤经 ${formatRa(item && item.ra)}`,
		`赤纬 ${formatDeg(item && item.decl)}`,
	]);
}

function eclipticText(item){
	return joinParts([
		`黄经 ${formatDeg(item && item.lon)}`,
		`黄纬 ${formatDeg(item && item.lat)}`,
	]);
}

function spectralText(item){
	return joinParts([
		item && item.spectralClass ? `光谱 ${item.spectralClass}` : null,
		item && valuePresent(item.colorTemperature) ? `色温 ${Math.round(Number(item.colorTemperature))}K` : null,
		item && valuePresent(item.colorIndex) ? `B-V ${formatNumber(item.colorIndex, 2)}` : null,
	]);
}

function moonPhaseText(phase){
	if(!phase){
		return '--';
	}
	return joinParts([
		phase.phaseName || phase.name,
		valuePresent(phase.illumination) ? `照明 ${Math.round(Number(phase.illumination) * 100)}%` : null,
		valuePresent(phase.ageDays) ? `月龄 ${formatNumber(phase.ageDays, 1)}天` : null,
		valuePresent(phase.phaseAngle) ? `相位角 ${formatDeg(phase.phaseAngle)}` : null,
	]);
}

function objectDescription(item){
	if(!item){
		return '';
	}
	if(item.kind === 'catalogStar'){
		return '裸眼恒星星表中的恒星，位置按当前时间与观测地投影到地平坐标。';
	}
	if(item.layer === 'su28'){
		return '二十八宿图层星点，随当前时间与观测地投影到真实可见天空。';
	}
	if(item.layer === 'beidou'){
		return '北斗图层星点，连线与星点共同随天球旋转更新。';
	}
	if(item.layer === 'body'){
		if(item.id === 'Sun' || item.id === 'Moon' || ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'].indexOf(item.id) >= 0){
			return `${bodyName(item)}的位置来自瑞士星历，并结合当前经纬度换算为地平坐标。`;
		}
		if(item.id === 'North Node' || item.id === 'South Node'){
			return `${bodyName(item)}为月球轨道与黄道的交点，按当前星盘时间显示其黄道位置。`;
		}
	}
	return '';
}

function detailRowsForItem(item, moonPhase){
	if(!item){
		return [];
	}
	const isBody = item.layer === 'body';
	const isStar = item.kind === 'catalogStar' || item.layer === 'stars';
	const isTraditional = item.layer === 'su28' || item.layer === 'beidou';
	// 🆕 item.house 后端给 "House5" 字符串(flatlib 风格),外推后我们设纯数字 5 — 兼容两者,提取纯数字显示「第5宫」。
	const houseRaw = item.house;
	const houseNum = (typeof houseRaw === 'number') ? houseRaw
		: (typeof houseRaw === 'string' ? (houseRaw.match(/\d+/) || [null])[0] : null);
	const chartPosition = joinParts([
		zodiacPositionText(item),
		valuePresent(houseNum) ? `第${houseNum}宫` : null,
		valuePresent(item.su28) ? `${item.su28}` : null,
	]);
	const rows = [
		['具体名称', bodyName(item)],
		['类型', objectType(item)],
		['图层', layerLabel(item)],
		['编号/别名', isStar ? catalogIdText(item) : bodyEnglishName(item)],
		['可见性', visibilityText(item)],
		['地平坐标', skyPositionText(item)],
		['赤道坐标', equatorialText(item)],
		['黄道坐标', eclipticText(item)],
		['星盘位置', chartPosition],
		['星等', formatMag(item.mag)],
		['光谱/色温', spectralText(item)],
		['黄经速度', valuePresent(item.lonspeed) ? `${formatNumber(item.lonspeed, 4)}°/日` : '--'],
	];
	if(item.id === 'Moon'){
		rows.push(['月相', moonPhaseText(moonPhase)]);
	}
	if(isTraditional && valuePresent(item.su28)){
		rows.push(['所属宿', item.su28]);
	}
	if(isBody && valuePresent(item.sign)){
		rows.push(['占星星座', joinParts([item.sign, valuePresent(item.signlon) ? formatDeg(item.signlon) : null], ' ')]);
	}
	rows.push(['说明', objectDescription(item)]);
	return rows.filter((row)=>{
		const value = row[1];
		return valuePresent(value) && value !== '高度 -- · 方位 --' && value !== '赤经 -- · 赤纬 --' && value !== '黄经 -- · 黄纬 --';
	});
}

function visibilityText(item){
	if(!item){
		return '--';
	}
	const state = item.horizonState || (Number(item.altitudeAppa || 0) > 0 ? '可见' : '不可见');
	return item.visible === false ? `${state} · 条件不佳` : state;
}

function moonPhaseGlyph(phase){
	if(!phase){
		return '○';
	}
	const angle = Number(phase.phaseAngle || 0);
	if(angle < 22.5 || angle >= 337.5){ return '●'; }
	if(angle < 67.5){ return '☽'; }
	if(angle < 112.5){ return '◐'; }
	if(angle < 157.5){ return '◑'; }
	if(angle < 202.5){ return '○'; }
	if(angle < 247.5){ return '◐'; }
	if(angle < 292.5){ return '◑'; }
	return '☾';
}

function noise2(x, y, seed){
	const v = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
	return v - Math.floor(v);
}

function drawEllipse(ctx, x, y, rx, ry, color, alpha = 1){
	ctx.save();
	ctx.globalAlpha = alpha;
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}

function colorArrayCss(color, alpha = 1){
	const c = color || [0, 0, 0];
	return `rgba(${Math.round(clamp(c[0], 0, 1) * 255)}, ${Math.round(clamp(c[1], 0, 1) * 255)}, ${Math.round(clamp(c[2], 0, 1) * 255)}, ${alpha})`;
}

function mixColorArray(a, b, t){
	const ratio = clamp(t, 0, 1);
	return [
		(a[0] || 0) * (1 - ratio) + (b[0] || 0) * ratio,
		(a[1] || 0) * (1 - ratio) + (b[1] || 0) * ratio,
		(a[2] || 0) * (1 - ratio) + (b[2] || 0) * ratio,
	];
}

function paintSkySurface(ctx, width, height, palette){
	const p = palette || {};
	const zenith = p.zenith || [0.004, 0.007, 0.022];
	const mid = p.sky || [0.018, 0.04, 0.11];
	const horizon = p.horizon || p.clear || [0.04, 0.08, 0.18];
	ctx.clearRect(0, 0, width, height);

	const grad = ctx.createLinearGradient(0, 0, 0, height);
	grad.addColorStop(0, colorArrayCss(zenith, 1));
	grad.addColorStop(0.44, colorArrayCss(mid, 1));
	grad.addColorStop(0.72, colorArrayCss(horizon, 1));
	grad.addColorStop(1, colorArrayCss(mixColorArray(zenith, horizon, 0.34), 1));
	ctx.fillStyle = grad;
	ctx.fillRect(0, 0, width, height);

	const horizonGlow = ctx.createRadialGradient(width * 0.5, height * 0.7, width * 0.06, width * 0.5, height * 0.7, width * 0.72);
	horizonGlow.addColorStop(0, colorArrayCss(p.glow || horizon, p.skyGlowAlpha || 0.18));
	horizonGlow.addColorStop(0.55, colorArrayCss(p.glow || horizon, (p.skyGlowAlpha || 0.18) * 0.38));
	horizonGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
	ctx.fillStyle = horizonGlow;
	ctx.fillRect(0, 0, width, height);

	for(let i = 0; i < 1800; i += 1){
		const x = noise2(i, 11, 71) * width;
		const y = noise2(i, 13, 72) * height;
		const alpha = (noise2(i, 17, 73) - 0.5) * 0.025;
		if(Math.abs(alpha) < 0.003){
			continue;
		}
		ctx.fillStyle = alpha > 0 ? `rgba(255, 255, 255, ${alpha})` : `rgba(0, 0, 0, ${-alpha})`;
		ctx.fillRect(x, y, 1, 1);
	}

	const vignette = ctx.createRadialGradient(width * 0.5, height * 0.52, width * 0.18, width * 0.5, height * 0.52, width * 0.78);
	vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
	vignette.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
	ctx.fillStyle = vignette;
	ctx.fillRect(0, 0, width, height);
}

function paintHorizonMistSurface(ctx, width, height, palette){
	const p = palette || {};
	const glow = p.glow || p.horizon || [0.2, 0.28, 0.5];
	const clear = p.clear || [0.006, 0.01, 0.02];
	ctx.clearRect(0, 0, width, height);

	const vertical = ctx.createLinearGradient(0, 0, 0, height);
	vertical.addColorStop(0, 'rgba(0, 0, 0, 0)');
	vertical.addColorStop(0.34, colorArrayCss(glow, (p.mistAlpha || 0.16) * 0.16));
	vertical.addColorStop(0.52, colorArrayCss(glow, p.mistAlpha || 0.16));
	vertical.addColorStop(0.72, colorArrayCss(mixColorArray(glow, clear, 0.55), (p.mistAlpha || 0.16) * 0.34));
	vertical.addColorStop(1, 'rgba(0, 0, 0, 0)');
	ctx.fillStyle = vertical;
	ctx.fillRect(0, 0, width, height);

	const centerGlow = ctx.createRadialGradient(width * 0.5, height * 0.56, width * 0.08, width * 0.5, height * 0.56, width * 0.58);
	centerGlow.addColorStop(0, colorArrayCss(glow, (p.mistAlpha || 0.16) * 0.55));
	centerGlow.addColorStop(0.55, colorArrayCss(glow, (p.mistAlpha || 0.16) * 0.2));
	centerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
	ctx.fillStyle = centerGlow;
	ctx.fillRect(0, 0, width, height);
}

function planetTextureSize(id){
	return id === 'Moon' ? { width: 512, height: 512 } : { width: 512, height: 256 };
}

function paintPlanetSurface(ctx, id, width, height){
	ctx.clearRect(0, 0, width, height);
	const grad = ctx.createLinearGradient(0, 0, 0, height);
	const base = {
		Sun: ['#ffdf73', '#ff9127', '#b94a16'],
		Mercury: ['#bfc0b9', '#777873', '#494b49'],
		Venus: ['#ffe1aa', '#d9965d', '#8b5c37'],
		Earth: ['#1e61a6', '#133d73', '#071d3d'],
		Moon: ['#d6d9d5', '#888e8e', '#3e4448'],
		Mars: ['#df7444', '#9b3b28', '#4d221c'],
		Jupiter: ['#f4d2a5', '#c48759', '#7f5135'],
		Saturn: ['#f2dda4', '#c8a86a', '#806946'],
		Uranus: ['#b5fbff', '#55c5d1', '#226f83'],
		Neptune: ['#6ca6ff', '#2556bd', '#102868'],
		Pluto: ['#d7c2a8', '#8d755f', '#4a403a'],
	}[id] || ['#e5e9ff', '#8b93b0', '#30364c'];
	grad.addColorStop(0, base[0]);
	grad.addColorStop(0.52, base[1]);
	grad.addColorStop(1, base[2]);
	ctx.fillStyle = grad;
	ctx.fillRect(0, 0, width, height);

	if(id === 'Sun'){
		for(let i = 0; i < 28; i += 1){
			const y = (i / 28) * height;
			ctx.strokeStyle = i % 2 ? 'rgba(255,244,148,0.34)' : 'rgba(207,67,18,0.22)';
			ctx.lineWidth = 3 + noise2(i, 2, 5) * 8;
			ctx.beginPath();
			for(let x = 0; x <= width; x += 18){
				const wave = Math.sin(x * 0.018 + i * 0.8) * (4 + noise2(i, x, 2) * 6);
				if(x === 0){ ctx.moveTo(x, y + wave); }else{ ctx.lineTo(x, y + wave); }
			}
			ctx.stroke();
		}
		for(let i = 0; i < 42; i += 1){
			drawEllipse(ctx, noise2(i, 1, 7) * width, noise2(i, 2, 8) * height, 8 + noise2(i, 3, 9) * 28, 3 + noise2(i, 4, 10) * 11, '#fff1a6', 0.18);
		}
		return;
	}

	if(id === 'Earth'){
		const land = '#4e9a5f';
		const desert = '#c49d6a';
		[
			[0.18, 0.38, 0.12, 0.2, land],
			[0.34, 0.62, 0.18, 0.14, desert],
			[0.58, 0.42, 0.22, 0.18, land],
			[0.78, 0.66, 0.17, 0.12, desert],
			[0.88, 0.34, 0.16, 0.18, land],
		].forEach((item)=>{
			drawEllipse(ctx, item[0] * width, item[1] * height, item[2] * width, item[3] * height, item[4], 0.82);
		});
		for(let i = 0; i < 18; i += 1){
			ctx.strokeStyle = 'rgba(245,250,255,0.45)';
			ctx.lineWidth = 4 + noise2(i, 1, 4) * 7;
			ctx.beginPath();
			const y = noise2(i, 2, 5) * height;
			for(let x = 0; x <= width; x += 30){
				const wave = Math.sin(x * 0.022 + i) * 12;
				if(x === 0){ ctx.moveTo(x, y + wave); }else{ ctx.lineTo(x, y + wave); }
			}
			ctx.stroke();
		}
		return;
	}

	if(id === 'Jupiter' || id === 'Saturn'){
		const stripeColors = id === 'Jupiter'
			? ['rgba(92,47,29,0.32)', 'rgba(255,239,202,0.38)', 'rgba(177,89,44,0.36)']
			: ['rgba(132,99,54,0.24)', 'rgba(255,241,190,0.3)', 'rgba(88,68,50,0.18)'];
		for(let i = 0; i < 15; i += 1){
			const y = (i / 15) * height;
			ctx.fillStyle = stripeColors[i % stripeColors.length];
			ctx.fillRect(0, y, width, 8 + noise2(i, 0, 7) * 15);
		}
		if(id === 'Jupiter'){
			drawEllipse(ctx, width * 0.68, height * 0.58, width * 0.07, height * 0.095, '#b75a38', 0.82);
			drawEllipse(ctx, width * 0.68, height * 0.58, width * 0.043, height * 0.058, '#edb17b', 0.58);
		}
		return;
	}

	if(id === 'Uranus' || id === 'Neptune' || id === 'Venus'){
		for(let i = 0; i < 18; i += 1){
			ctx.strokeStyle = id === 'Venus' ? 'rgba(255,244,216,0.2)' : 'rgba(232,255,255,0.18)';
			ctx.lineWidth = 2 + noise2(i, 1, 12) * 5;
			ctx.beginPath();
			const y = (i / 18) * height;
			for(let x = 0; x <= width; x += 28){
				const wave = Math.sin(x * 0.014 + i * 0.9) * 8;
				if(x === 0){ ctx.moveTo(x, y + wave); }else{ ctx.lineTo(x, y + wave); }
			}
			ctx.stroke();
		}
		return;
	}

	for(let i = 0; i < 80; i += 1){
		const x = noise2(i, 3, 1) * width;
		const y = noise2(i, 5, 2) * height;
		const r = 1.5 + noise2(i, 9, 3) * (id === 'Moon' || id === 'Mercury' ? 12 : 7);
		const color = id === 'Mars' ? '#5b241d' : 'rgba(34,38,42,0.28)';
		drawEllipse(ctx, x, y, r, r * (0.55 + noise2(i, 8, 4) * 0.55), color, 0.32);
	}
}

function paintMoonPhase(ctx, phase, size){
	const radius = size * 0.45;
	const cx = size / 2;
	const cy = size / 2;
	const angle = degToRad(Number(phase && phase.phaseAngle) || 0);
	const cosA = Math.cos(angle);
	const image = ctx.createImageData(size, size);
	for(let y = 0; y < size; y += 1){
		for(let x = 0; x < size; x += 1){
			const nx = (x - cx) / radius;
			const ny = (y - cy) / radius;
			const idx = (y * size + x) * 4;
			const d = nx * nx + ny * ny;
			if(d > 1){
				image.data[idx + 3] = 0;
				continue;
			}
			const limb = Math.sqrt(Math.max(0, 1 - ny * ny));
			const lit = angle <= Math.PI ? nx > cosA * limb : nx < -cosA * limb;
			const shade = clamp(1 - d * 0.22 + noise2(x, y, 13) * 0.05, 0, 1);
			const v = lit ? Math.round(170 + shade * 76) : Math.round(20 + shade * 26);
			image.data[idx] = v;
			image.data[idx + 1] = v + (lit ? 2 : 0);
			image.data[idx + 2] = v + (lit ? 8 : 4);
			image.data[idx + 3] = 255;
		}
	}
	ctx.putImageData(image, 0, 0);
	ctx.save();
	ctx.beginPath();
	ctx.arc(cx, cy, radius, 0, Math.PI * 2);
	ctx.clip();
	for(let i = 0; i < 42; i += 1){
		const x = cx + (noise2(i, 1, 21) * 2 - 1) * radius * 0.86;
		const y = cy + (noise2(i, 2, 22) * 2 - 1) * radius * 0.86;
		const dx = (x - cx) / radius;
		const dy = (y - cy) / radius;
		if(dx * dx + dy * dy > 0.92){ continue; }
		const r = 3 + noise2(i, 3, 23) * 16;
		ctx.strokeStyle = 'rgba(18,24,32,0.22)';
		ctx.lineWidth = 1 + noise2(i, 4, 24) * 2;
		ctx.beginPath();
		ctx.ellipse(x, y, r, r * (0.74 + noise2(i, 5, 25) * 0.38), 0, 0, Math.PI * 2);
		ctx.stroke();
	}
	ctx.restore();
}

function paintGroundSurface(ctx, width, height){
	ctx.clearRect(0, 0, width, height);
	const base = ctx.createLinearGradient(0, 0, width, height);
	base.addColorStop(0, '#12221d');
	base.addColorStop(0.42, '#09120f');
	base.addColorStop(1, '#172018');
	ctx.fillStyle = base;
	ctx.fillRect(0, 0, width, height);

	for(let y = 0; y < height; y += 2){
		const shade = 10 + Math.round((y / height) * 18);
		ctx.fillStyle = `rgba(${shade}, ${shade + 5}, ${shade + 9}, 0.06)`;
		ctx.fillRect(0, y, width, 1);
	}

	for(let i = 0; i < 900; i += 1){
		const x = noise2(i, 2, 31) * width;
		const y = noise2(i, 4, 32) * height;
		const r = 0.5 + noise2(i, 6, 33) * 2.6;
		const warm = noise2(i, 7, 34) > 0.64;
		ctx.fillStyle = warm ? 'rgba(108, 101, 57, 0.16)' : 'rgba(67, 118, 84, 0.15)';
		ctx.beginPath();
		ctx.ellipse(x, y, r * 2.8, r, noise2(i, 8, 35) * Math.PI, 0, Math.PI * 2);
		ctx.fill();
	}

	for(let i = 0; i < 420; i += 1){
		const x = noise2(i, 13, 39) * width;
		const y = noise2(i, 14, 40) * height;
		const h = 10 + noise2(i, 15, 41) * 32;
		const lean = (noise2(i, 16, 42) - 0.5) * 8;
		ctx.strokeStyle = i % 3 ? 'rgba(92, 132, 86, 0.16)' : 'rgba(130, 127, 72, 0.12)';
		ctx.lineWidth = 1 + noise2(i, 17, 43) * 1.6;
		ctx.beginPath();
		ctx.moveTo(x, y);
		ctx.lineTo(x + lean, y - h);
		ctx.stroke();
	}

	for(let i = 0; i < 34; i += 1){
		const y = noise2(i, 11, 36) * height;
		ctx.strokeStyle = i % 2 ? 'rgba(100, 129, 134, 0.05)' : 'rgba(58, 78, 72, 0.07)';
		ctx.lineWidth = 1 + noise2(i, 12, 37) * 3;
		ctx.beginPath();
		for(let x = 0; x <= width; x += 28){
			const wave = Math.sin(x * 0.01 + i * 0.82) * (4 + noise2(i, x, 38) * 8);
			if(x === 0){ ctx.moveTo(x, y + wave); }else{ ctx.lineTo(x, y + wave); }
		}
		ctx.stroke();
	}

	const centerGlow = ctx.createRadialGradient(width * 0.5, height * 0.46, width * 0.08, width * 0.5, height * 0.46, width * 0.64);
	centerGlow.addColorStop(0, 'rgba(88, 126, 91, 0.22)');
	centerGlow.addColorStop(0.48, 'rgba(34, 57, 39, 0.12)');
	centerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
	ctx.fillStyle = centerGlow;
	ctx.fillRect(0, 0, width, height);

	const vignette = ctx.createRadialGradient(width * 0.5, height * 0.5, width * 0.18, width * 0.5, height * 0.5, width * 0.78);
	vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
	vignette.addColorStop(1, 'rgba(0, 0, 0, 0.36)');
	ctx.fillStyle = vignette;
	ctx.fillRect(0, 0, width, height);
}

// 程序化「地表裙边」纹理(替代旧照片全景,天象馆质感)。
// UV 纵向:v=0 对应地平上方(topAlt),v=1 对应脚下(bottomAlt);horizonV 为地平线所在 v。
// 地平线以上透明(露出天空),地平线处一道极细柔光,以下为干净的灰阶渐变地面(向下渐深)+ 极淡程序化微肌理(无照片感)。
// RGB 走中性灰阶(实际色调由材质 diffuse/emissive 跟随昼夜 palette 相乘),alpha 决定地平上下的显隐。
function paintHorizonGroundSurface(ctx, width, height, horizonV){
	ctx.clearRect(0, 0, width, height);
	const hv = clamp(Number(horizonV) || 0.37, 0.02, 0.98);
	const yH = height * hv;
	// 连绵山脊路径:整数频率正弦叠加 → 横向 360° 无缝平铺;baseY 为该层基准高度。
	const ridgePath = (baseY, amp, freqs)=>{
		ctx.beginPath();
		ctx.moveTo(0, height);
		for(let x = 0; x <= width; x += 3){
			const t = x / width;
			let y = baseY;
			for(let k = 0; k < freqs.length; k += 1){
				y -= Math.sin(t * Math.PI * 2 * freqs[k][0] + freqs[k][1]) * amp * freqs[k][2];
			}
			ctx.lineTo(x, y);
		}
		ctx.lineTo(width, height);
		ctx.closePath();
	};
	// ① 远山轮廓 = 天与地的柔和起伏分界;裁到此形状内填纵向渐变(地平雾亮 → 脚下渐深)。
	ctx.save();
	ridgePath(yH + height * 0.018, height * 0.030, [[3, 0.4, 1], [7, 2.1, 0.4], [13, 4.3, 0.16], [23, 1.1, 0.07]]);
	ctx.clip();
	const ground = ctx.createLinearGradient(0, yH - height * 0.05, 0, height);
	ground.addColorStop(0, 'rgba(150, 150, 150, 1)');
	ground.addColorStop(0.22, 'rgba(112, 112, 112, 1)');
	ground.addColorStop(0.6, 'rgba(72, 72, 72, 1)');
	ground.addColorStop(1, 'rgba(42, 42, 42, 1)');
	ctx.fillStyle = ground;
	ctx.fillRect(0, 0, width, height);
	ctx.restore();
	// ② 中景 / 近景山影(实色渐深,层叠出空气透视纵深)。
	ridgePath(yH + height * 0.085, height * 0.050, [[2, 3.1, 1], [5, 1.2, 0.5], [11, 5.5, 0.22]]);
	ctx.fillStyle = 'rgba(70, 70, 70, 1)';
	ctx.fill();
	ridgePath(yH + height * 0.170, height * 0.064, [[2, 1.7, 1], [4, 4.8, 0.45], [9, 0.9, 0.22]]);
	ctx.fillStyle = 'rgba(47, 47, 47, 1)';
	ctx.fill();
	// ③ 近景地表微草(细密短线,疏密随机,偏下半)。
	for(let i = 0; i < 1600; i += 1){
		const x = noise2(i, 2, 71) * width;
		const fy = 0.42 + noise2(i, 4, 72) * 0.58;
		const y = yH + fy * (height - yH);
		const len = 2 + noise2(i, 6, 73) * 8;
		const lean = (noise2(i, 8, 74) - 0.5) * 3.2;
		const g = 54 + Math.round(noise2(i, 9, 75) * 44);
		ctx.strokeStyle = `rgba(${g}, ${g}, ${g}, 0.15)`;
		ctx.lineWidth = 0.85;
		ctx.beginPath();
		ctx.moveTo(x, y);
		ctx.lineTo(x + lean, y - len);
		ctx.stroke();
	}
	// ④ 地平雾光(山影根部一道极淡亮带,大气辉光,仅地平以下)。
	const haze = ctx.createLinearGradient(0, yH, 0, yH + height * 0.07);
	haze.addColorStop(0, 'rgba(200, 200, 200, 0.26)');
	haze.addColorStop(1, 'rgba(200, 200, 200, 0)');
	ctx.fillStyle = haze;
	ctx.fillRect(0, yH, width, height * 0.07);
	// ⑤ 底部暗角收边,增强纵深。
	const vign = ctx.createLinearGradient(0, height * 0.58, 0, height);
	vign.addColorStop(0, 'rgba(0, 0, 0, 0)');
	vign.addColorStop(1, 'rgba(0, 0, 0, 0.34)');
	ctx.fillStyle = vign;
	ctx.fillRect(0, height * 0.58, width, height * 0.42);
}

function buildObservationTime(fields){
	const dt = fields && fields.time && fields.time.value && fields.time.value.clone
		? fields.time.value.clone()
		: new DateTime();
	if(fields && fields.date && fields.date.value){
		const d = fields.date.value;
		dt.year = d.year;
		dt.month = d.month;
		dt.date = d.date;
		dt.ad = d.ad;
	}
	if(fields && fields.zone){
		dt.zone = fields.zone.value;
	}
	dt.calcJdn();
	return dt;
}

// extras(可选)= 升落/轨迹门控等附加字段。🔴零回归铁律:extras 默认 {} → 不传 include* 时请求体与原状字节级一致
// (后端 _truthy_flag 默认不开 → res 字节不变)。仅当 React 侧开「行星轨迹/升落时刻」层才注入对应 include* 标志。
// 按显示星等上限映射「应取星数」(BSC5 已按星等升序,starLimit=后端取最亮前 N)。默认 mag≤4(约520星)→取~800留余量,
// 使后端返回的星表 payload ~10x 变小 → 序列化 / RSA 加密 / 传输 / JSON.parse 全程提速 → 首次显星不再卡 4s
// (后端 _build_catalog_stars 仍全算后切片,故省的是大包的传输与加解密,这正是 4s 主因);
// 完整 8404 由 _starsWantFull 触发的后台补全请求拉齐(供按名搜索 + 拖星等滑块看暗星全程)。
function starLimitForMag(magLimit){
	const m = Number(magLimit);
	if(!Number.isFinite(m) || m >= STAR_MAG_LIMIT_MAX){ return 9000; }
	if(m <= 4){ return 800; }
	if(m <= 4.5){ return 1300; }
	if(m <= 5){ return 2200; }
	if(m <= 5.5){ return 3800; }
	if(m <= 6){ return 6000; }
	return 9000;
}

function buildRequestParams(fields, time, extras){
	return {
		date: time.format('YYYY/MM/DD'),
		time: time.format('HH:mm:ss'),
		ad: time.ad,
		zone: time.zone,
		lat: fields.lat.value,
		lon: fields.lon.value,
		gpsLat: fields.gpsLat.value,
		gpsLon: fields.gpsLon.value,
		name: fields.name ? fields.name.value : null,
		pos: fields.pos ? fields.pos.value : null,
		hsys: fields.hsys ? fields.hsys.value : 1,
		// 天文馆=纯天文,与星盘/七政四余绝对独立:黄道模式/岁差/宿度制 一律强制纯天文值,不继承图表设置
		// (否则选恒星黄道或七政宿度制时,二十八宿会落到黄道线上)。仅借 hsys(宫位)+ 观测地/时间。
		zodiacal: 0, siderealAyanamsa: '',
		doubingSu28: 0,
		southchart: 0,
		starLimit: 9000,
		...(extras || {}),
	};
}

function buildInitialSceneParams(fields, time, extras){
	return {
		...buildRequestParams(fields, time, extras),
		starLimit: 0,
		includeOverlays: false,
		includeTraditions: false,
	};
}

function buildPlaybackSyncParams(fields, time, extras){
	return {
		...buildRequestParams(fields, time, extras),
		starLimit: 0,
		includeOverlays: false,
		includeTraditions: false,
	};
}

function buildSceneSyncParams(fields, time, extras){
	return {
		...buildRequestParams(fields, time, extras),
		starLimit: 0,
		includeOverlays: true,
		includeTraditions: true,
	};
}

function clonePlanetariumState(data){
	if(!data){
		return null;
	}
	try{
		return JSON.parse(JSON.stringify(data));
	}catch(err){
		return data;
	}
}

function cachePlanetariumState(data){
	if(!data || data.err){
		return;
	}
	const rendered = data.meta && Number(data.meta.renderedCatalogCount || 0);
	if(rendered <= 0){
		return;
	}
	planetariumStateCache = clonePlanetariumState(data);
}

function getCachedPlanetariumState(){
	return clonePlanetariumState(planetariumStateCache);
}

class PlanetariumRenderer {
	constructor(canvas, onPick, onMetrics, onInteraction){
		this.canvas = canvas;
		this.onPick = onPick;
		this.onMetrics = onMetrics;
		this.onInteraction = onInteraction;
		// perf:planetariumRenderGating —— 渲染循环时机门控状态(内容/语义一字不动)。
		this._loopRunning = false;
		this._onDemand = planetariumOnDemandRenderEnabled();
		this._metricsThrottle = planetariumMetricsThrottleEnabled();
		this._playing = false;
		this._renderRequested = false;
		this._settleUntil = 0;
		this._lastIdleRender = 0;
		this._lastMetricEmit = 0;
		this._boundRenderTick = null;
		this.engine = new BABYLON.Engine(canvas, true, {
			preserveDrawingBuffer: false,
			stencil: false,
			antialias: true,
			powerPreference: 'high-performance',
			adaptToDeviceRatio: true,
		});
		this.scene = new BABYLON.Scene(this.engine);
		this.scene.clearColor = new BABYLON.Color4(0.008, 0.012, 0.026, 1);
		this.scene.ambientColor = new BABYLON.Color3(0.12, 0.16, 0.3);
		this.groups = [];
		this.pickMeshes = [];
		this.bodyMeshes = {};
		this.projectableMeshes = [];
		this.projectableLines = [];
		this.followMeshes = [];
		this.starPcs = null;
		this.starMesh = null;
		this.starCount = 0;
		this.starCatalog = [];
		this.starBuildPending = false;
		this.lastData = null;
		this.disposed = false;
		this.viewMode = 'ground';
		this.layers = {...DEFAULT_LAYERS};
		// 星等过滤上限(默认 = 全 BSC5 上限,等价不过滤 → 零回归)。mag > magLimit 的恒星粒子 alpha=0 隐藏。
		this.magLimit = STAR_MAG_LIMIT_MAX;
		// 角距测量(默认关 → 零回归):开关 + 已记起点(单位方向向量)+ 连线/标记 mesh。
		this.measureMode = false;
		this.measureFirst = null;
		this.measureMeshes = [];
		this.onMeasure = null;
		this.onSkyReadout = null;
		this.initScene();
	}

	initScene(){
		const CameraCtor = BABYLON.UniversalCamera || BABYLON.FreeCamera;
		this.groundCamera = new CameraCtor(
			'planetarium-ground-camera',
			new BABYLON.Vector3(0, OBSERVER_EYE_HEIGHT, 0),
			this.scene,
		);
		this.groundCamera.minZ = 0.5;
		this.groundCamera.maxZ = SKY_RADIUS * 3;
		this.groundCamera.fov = 1.08;
		this.groundCamera.inertia = 0.45;
		this.groundCamera.angularSensibility = 1600;
		this.groundCamera.speed = 0;
		this.groundCamera.setTarget(new BABYLON.Vector3(0, 110, 760));
		if(this.groundCamera.inputs && this.groundCamera.inputs.removeByType){
			this.groundCamera.inputs.removeByType('FreeCameraKeyboardMoveInput');
			this.groundCamera.inputs.removeByType('FreeCameraGamepadInput');
			this.groundCamera.inputs.removeByType('FreeCameraMouseInput');
			this.groundCamera.inputs.removeByType('FreeCameraTouchInput');
		}

		this.transitionCamera = new CameraCtor(
			'planetarium-transition-camera',
			new BABYLON.Vector3(0, OBSERVER_EYE_HEIGHT, 0),
			this.scene,
		);
		this.transitionCamera.minZ = 0.5;
		this.transitionCamera.maxZ = SKY_RADIUS * 4;
		this.transitionCamera.fov = this.groundCamera.fov;
		this.transitionCamera.speed = 0;
		if(this.transitionCamera.inputs && this.transitionCamera.inputs.removeByType){
			this.transitionCamera.inputs.removeByType('FreeCameraKeyboardMoveInput');
			this.transitionCamera.inputs.removeByType('FreeCameraGamepadInput');
			this.transitionCamera.inputs.removeByType('FreeCameraMouseInput');
			this.transitionCamera.inputs.removeByType('FreeCameraTouchInput');
		}

		this.orbitCamera = new BABYLON.ArcRotateCamera(
			'planetarium-orbit-camera',
			Math.PI * 1.25,
			Math.PI * 0.42,
			1120,
			BABYLON.Vector3.Zero(),
			this.scene,
		);
		this.orbitCamera.lowerRadiusLimit = ORBIT_MIN_RADIUS;
		this.orbitCamera.upperRadiusLimit = ORBIT_MAX_RADIUS;
		this.orbitCamera.wheelPrecision = 32;
		this.orbitCamera.panningSensibility = 0;
		if(this.orbitCamera.inputs && this.orbitCamera.inputs.clear){
			this.orbitCamera.inputs.clear();
		}

		this.wheelHandler = (evt)=>{
			if(!this.camera){
				return;
			}
			evt.preventDefault();
			this.markCameraSettle();
			if(this.viewMode === 'orbit'){
				this.camera.radius = clamp(this.camera.radius + (evt.deltaY > 0 ? 64 : -64), ORBIT_MIN_RADIUS, ORBIT_MAX_RADIUS);
				return;
			}
			this.camera.fov = clamp(this.camera.fov + (evt.deltaY > 0 ? 0.075 : -0.075), GROUND_MIN_FOV, GROUND_MAX_FOV);
		};
		this.canvas.addEventListener('wheel', this.wheelHandler, { passive: false });
		this.pointerDrag = null;
		this.pointerDownHandler = (evt)=>{
			if(!this.camera || this.viewTransition || evt.button !== 0){
				return;
			}
			if(this.onInteraction){
				this.onInteraction();
			}
			this.markCameraSettle();
			this.pointerDrag = {
				id: evt.pointerId,
				x: evt.clientX,
				y: evt.clientY,
			};
			// 🆕 按下即解除「锁定跟随」(双保险):此前只在 pointermove 里解除——WKWebView/WebView2 的
			// pointer 事件模型差异(pointerId 生命周期/合成事件)可能让 move 链失效,锁定就永远退不出
			// (用户实测:App 定位星体后鼠标拖动无效、无法取消居中;Chrome preview 正常)。
			// 按下(准备拖动)本身就是明确的「用户要接管视角」意图,Stellarium 同款语义。
			if(this._followMesh || this._followStar){
				this._followMesh = null;
				this._followStar = null;
				if(this.camera){ this.camera.lockedTarget = null; }
			}
			// setPointerCapture 必须防御:对无效 pointerId 抛 NotFoundError(合成事件/部分 WebView 实测会炸),
			// 裸抛会中断 handler;capture 失败只影响「指针移出 canvas 仍拖动」的体验,绝不该炸主链。
			if(this.canvas.setPointerCapture){
				try{ this.canvas.setPointerCapture(evt.pointerId); }catch(e){ /* capture 失败可拖动降级 */ }
			}
		};
		this.pointerMoveHandler = (evt)=>{
			if(!this.pointerDrag || this.pointerDrag.id !== evt.pointerId || !this.camera || this.viewTransition){
				return;
			}
			const dx = evt.clientX - this.pointerDrag.x;
			const dy = evt.clientY - this.pointerDrag.y;
			this.pointerDrag.x = evt.clientX;
			this.pointerDrag.y = evt.clientY;
			// 🆕 用户主动拖动相机(任意方向) → 取消「锁定跟随」(Stellarium 风格:点选锁定/拖动解除)
			if((dx !== 0 || dy !== 0) && (this._followMesh || this._followStar)){
				this._followMesh = null;
				this._followStar = null;
				if(this.camera){ this.camera.lockedTarget = null; }
			}
			evt.preventDefault();
			this.markCameraSettle();
			if(this.viewMode === 'orbit'){
				if(this.onInteraction){
					this.onInteraction();
				}
				this.orbitCamera.alpha -= dx * 0.006;
				this.orbitCamera.beta = clamp(this.orbitCamera.beta - dy * 0.0045, 0.04, Math.PI - 0.04);
				return;
			}
			if(this.onInteraction){
				this.onInteraction();
			}
			this.groundCamera.rotation.y += dx * 0.0042;
			this.groundCamera.rotation.x = clamp(this.groundCamera.rotation.x + dy * 0.0036, -Math.PI * 0.49, Math.PI * 0.49);
		};
		this.pointerUpHandler = (evt)=>{
			if(this.pointerDrag && this.pointerDrag.id === evt.pointerId){
				this.pointerDrag = null;
				if(this.canvas.releasePointerCapture){
					try{
						this.canvas.releasePointerCapture(evt.pointerId);
					}catch(err){
						// Pointer capture may already be released by the browser.
					}
				}
			}
		};
		this.canvas.addEventListener('pointerdown', this.pointerDownHandler);
		this.canvas.addEventListener('pointermove', this.pointerMoveHandler, { passive: false });
		this.canvas.addEventListener('pointerup', this.pointerUpHandler);
		this.canvas.addEventListener('pointercancel', this.pointerUpHandler);

		const light = new BABYLON.HemisphericLight('planetarium-light', new BABYLON.Vector3(0, 1, 0), this.scene);
		light.intensity = 0.38;

		const sky = BABYLON.MeshBuilder.CreateSphere('sky-shell', { diameter: SKY_RADIUS * 2, segments: 96, sideOrientation: BABYLON.Mesh.BACKSIDE }, this.scene);
		sky.isPickable = false;
		sky.alwaysSelectAsActiveMesh = true;
		sky.infiniteDistance = true;
		const skyTexture = new BABYLON.DynamicTexture('planetarium-sky-gradient-texture', { width: 1024, height: 512 }, this.scene, true);
		skyTexture.hasAlpha = false;
		this.skyTexture = skyTexture;
		paintSkySurface(skyTexture.getContext(), 1024, 512, {
			zenith: [0.004, 0.007, 0.022],
			sky: [0.018, 0.04, 0.11],
			horizon: [0.04, 0.08, 0.18],
			glow: [0.04, 0.11, 0.22],
			skyGlowAlpha: 0.08,
		});
		skyTexture.update(false);
		const skyMat = new BABYLON.StandardMaterial('sky-material', this.scene);
		skyMat.disableLighting = true;
		skyMat.disableDepthWrite = true;
		skyMat.backFaceCulling = false;
		skyMat.diffuseTexture = skyTexture;
		skyMat.emissiveTexture = skyTexture;
		skyMat.diffuseColor = BABYLON.Color3.White();
		skyMat.emissiveColor = BABYLON.Color3.White();
		skyMat.alpha = 1;
		sky.material = skyMat;
		this.skyMat = skyMat;

		const horizonGlow = BABYLON.MeshBuilder.CreateTorus('horizon-glow', { diameter: LINE_RADIUS * 2, thickness: 10, tessellation: 192 }, this.scene);
		horizonGlow.rotation.x = Math.PI / 2;
		horizonGlow.isPickable = false;
		horizonGlow.material = this.material('horizon-glow-material', new BABYLON.Color3(0.08, 0.22, 0.38), 0.18);
		this.horizonGlow = horizonGlow;

		const groundOccluder = BABYLON.MeshBuilder.CreateGround('ground-horizon-occluder', {
			width: SKY_RADIUS * 4.8,
			height: SKY_RADIUS * 4.8,
			subdivisions: 1,
		}, this.scene);
		groundOccluder.position.y = -0.8;
		groundOccluder.isPickable = false;
		groundOccluder.alwaysSelectAsActiveMesh = true;
		const groundMat = this.createGroundMaterial();
		groundOccluder.material = groundMat;
		this.groundMat = groundMat;
		this.groundOccluder = groundOccluder;
		this.horizonPanorama = this.createHorizonPanorama();
		this.groundDisk = this.createGroundDisk();
		this.horizonMist = this.createHorizonMist();
		this.landscapeMeshes = [];

		this.setViewMode('ground', false);

		this.glow = null;
		this.sky = sky;

		// 🆕 隐藏 follower mesh:让暗星(SolidParticle 粒子,非独立 mesh,无法挂 camera.lockedTarget)也能持续跟随。
		// 选中暗星时:_followStar = starHit; updateProjectedTime 每帧重投影 starHit 到当前 jd → mutate followerMesh.position;
		// camera.lockedTarget = followerMesh → Babylon 自动让相机跟着 followerMesh 移动 = 相机持续跟随选中暗星。
		this._followerMesh = new BABYLON.Mesh('planetarium-star-follower', this.scene);
		this._followerMesh.isVisible = false;
		this._followerMesh.isPickable = false;
		this._followStar = null; // 选中暗星时记录 { ra, decl, ... };mesh-based body 选中时清为 null(直接挂 mesh 自己即可)

		this.scene.onPointerObservable.add((pointerInfo)=>{
			const ptype = pointerInfo.type;
			const pickInfo = pointerInfo.pickInfo;
			const hit = pickInfo && pickInfo.pickedMesh;
			const hitBody = hit && hit.metadata && hit.metadata.body ? hit.metadata.body : null;
			// 角距测量模式:所有点选(命中天体 / 空白天区)都进测量逻辑,接管详情/兜底,POINTERTAP 单次处理。
			if(this.measureMode){
				if(ptype === BABYLON.PointerEventTypes.POINTERTAP){
					this.handleMeasureTap(hit, hitBody);
				}
				return;
			}
			if(ptype === BABYLON.PointerEventTypes.POINTERPICK){
				if(hitBody && this.onPick){
					this.onPick(hitBody);
				}
				return;
			}
			if(ptype === BABYLON.PointerEventTypes.POINTERTAP){
				if(hitBody){
					return; // 已由 POINTERPICK 处理(行星/亮星等)
				}
				// 暗星兜底:点空处先选距射线最近的目录星;若无星命中 → 读出该方向天区坐标(任务 3)。
				const star = this.pickNearestStar();
				if(!star){
					this.emitSkyReadout();
				}
			}
		});

		// perf:planetariumRenderGating —— 循环体抽成具名 _renderTick(可停/起 + 静止降帧 + metrics 节流),内容不变。
		this._startRenderLoop();
		this.resizeHandler = ()=>{
			if(this.engine){
				// Keep the backing store at full device resolution; re-apply on resize so
				// moving the window between Retina / non-Retina monitors stays crisp.
				const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
				this.engine.setHardwareScalingLevel(1 / Math.max(1, dpr));
				this.engine.resize();
			}
		};
		window.addEventListener('resize', this.resizeHandler);
	}

	setLayers(layers){
		this.layers = {...this.layers, ...(layers || {})};
		this.applyLayerVisibility();
	}

	// 大气折射是否生效:仅地表观测(ground)且大气层(atmosphere)开启时加折射(地平附近抬升)。
	// 关大气层 → 真空几何,星体按真高度;天球外观(orbit)本就几何原貌,不折射。默认 atmosphere=true → 字节级零回归。
	refractionActive(){
		return this.viewMode === 'ground' && !!(this.layers && this.layers.atmosphere);
	}

	// 关「地面」(地表观测下)→ 显示地平线以下整个天球:宿区间等 mode-bound 元素不再按地平裁剪。
	showBelowHorizon(){
		return this.viewMode === 'ground' && !(this.layers && this.layers.ground);
	}

	// 星等是否在当前上限内可见。默认上限(STAR_MAG_LIMIT_MAX)= 不设限 → 任何星都过(字节级零回归,
	// 即使后端偶发送来 mag>6.5 的星也照旧显示);非默认上限才按 mag<=limit 过滤。
	magVisible(mag){
		if(this.magLimit >= STAR_MAG_LIMIT_MAX){ return true; }
		return Number(mag) <= this.magLimit;
	}

	// 星等过滤:仅改恒星粒子 alpha + 亮星球可见性,不重拉数据、不动坐标(纯天文,位置由真实赤道投影决定)。
	// 默认上限 STAR_MAG_LIMIT_MAX(6.5)时无星被隐藏 → 与现状字节一致(零回归)。
	setMagLimit(magLimit){
		const next = Number(magLimit);
		this.magLimit = Number.isFinite(next) ? clamp(next, STAR_MAG_LIMIT_MIN, STAR_MAG_LIMIT_MAX) : STAR_MAG_LIMIT_MAX;
		// 升高到已建上限之上 → 重建补齐更暗的星(构建期只建了 ≤ 旧上限);降低/同级 → 走下方 alpha 隐藏即可(不重建,瞬时)。
		if(this.starFullCatalog && this.magLimit > (this.starBuiltMagLimit || 0) + 1e-6 && !this.starBuildPending){
			this.updateStars(this.starFullCatalog);
			return;
		}
		if(this.starPcs && this.starPcs.particles && this.starCatalog && this.starCatalog.length === this.starPcs.particles.length){
			this.starCatalog.forEach((star, idx)=>{
				const particle = this.starPcs.particles[idx];
				if(!particle){ return; }
				const mag = Number(star.mag || 5);
				const b = Math.max(0.18, Math.min(1.0, 1.18 - mag / 6.5));
				const c = starTemperatureColor(star, b);
				const alpha = this.magVisible(mag) ? 1 : 0; // 可见=不透明(亮度在 RGB 已编码);超星等=alpha 0 隐藏(配合 mesh.hasVertexAlpha 才真生效)
				particle.color = new BABYLON.Color4(c.r, c.g, c.b, alpha);
			});
			if(this.starPcs.setParticles){ this.starPcs.setParticles(); }
		}
		// 亮星球(mag≤1.5 的发光小球)同步按上限显隐。
		if(this.starCatalog && this.starCatalog.length){
			this.updateBrightStars(this.starCatalog);
		}
	}

	setGroundElementsEnabled(enabled){
		// 地面元素最终显隐 = 处于地表观测(enabled) 且 「地面」开关开。关地面 → 看到地平线以下整个天球。
		// 地面盘(groundDisk)是程序化干净地面(替代旧照片全景);horizonMist 为地平柔光带。
		const groundOn = enabled && !!(this.layers && this.layers.ground);
		if(this.groundOccluder){
			this.groundOccluder.setEnabled(false);
		}
		if(this.groundDisk){
			this.groundDisk.setEnabled(groundOn && !!(this.layers && this.layers.groundProcedural)); // 脚下圆盘仅程序化样式用;照片样式无需
		}
		if(this.horizonPanorama){
			this.horizonPanorama.setEnabled(groundOn);
		}
		if(this.horizonMist){
			this.horizonMist.setEnabled(groundOn);
		}
		(this.landscapeMeshes || []).forEach((mesh)=>mesh.setEnabled(groundOn));
	}

	// 「地面」开关切换后:按当前模式重算地面显隐(viewMode 不变,只是 layers.ground 变了)。
	refreshGroundLayer(){
		this.setGroundElementsEnabled(this.viewMode === 'ground');
		this.applyModeBoundVisibility(); // 关地面立即让地平线以下的宿区间等显示(不等下一次重投影)
	}

	// 「大气层」开关切换后:用最近一帧 sky 数据重画天空(黑/恢复昼夜),不重取后端。
	refreshSky(){
		this.updateSky(this.lastData || {});
	}

	updateGroundScenePosition(){
		if(this.viewMode !== 'ground' || !this.camera){
			return;
		}
		const position = this.cameraPosition(this.camera);
		[this.horizonPanorama, this.horizonMist].forEach((mesh)=>{
			if(mesh){
				mesh.position.x = position.x;
				mesh.position.z = position.z;
			}
		});
	}

	cameraPosition(camera){
		if(!camera){
			return BABYLON.Vector3.Zero();
		}
		if(camera.globalPosition){
			return camera.globalPosition.clone();
		}
		return camera.position ? camera.position.clone() : BABYLON.Vector3.Zero();
	}

	cameraTarget(camera, fallbackDistance = LINE_RADIUS){
		if(!camera){
			return new BABYLON.Vector3(0, 80, LINE_RADIUS);
		}
		if(camera.target){
			return camera.target.clone();
		}
		const position = this.cameraPosition(camera);
		if(camera.getForwardRay){
			const ray = camera.getForwardRay(fallbackDistance);
			return position.add(ray.direction.scale(fallbackDistance));
		}
		return position.add(new BABYLON.Vector3(0, 0, fallbackDistance));
	}

	setFreeCameraView(camera, position, target, fov){
		camera.position.copyFrom(position);
		camera.setTarget(target);
		camera.fov = fov;
	}

	prepareOrbitDestination(){
		this.orbitCamera.target = BABYLON.Vector3.Zero();
		this.orbitCamera.radius = Math.max(1120, this.orbitCamera.radius || 1120);
		this.orbitCamera.beta = clamp(this.orbitCamera.beta || Math.PI * 0.42, 0.18, Math.PI * 0.82);
		return {
			position: this.cameraPosition(this.orbitCamera),
			target: this.orbitCamera.target.clone(),
			fov: this.orbitCamera.fov || 0.8,
		};
	}

	completeViewMode(nextMode, nextCamera){
		if(this.camera && this.camera.detachControl){
			this.camera.detachControl(this.canvas);
		}
		// 🆕 旧 camera 上的 lockedTarget 清掉(避免 stale 引用);若仍有 _followMesh,下面在新 camera 上重设
		if(this.camera){ this.camera.lockedTarget = null; }
		this.viewTransition = null;
		this.viewMode = nextMode;
		this.camera = nextCamera;
		if(this._followMesh && this.camera){
			this.camera.lockedTarget = this._followMesh;
		}
		this.scene.activeCamera = nextCamera;
		if(nextMode === 'ground'){
			this.groundCamera.position = new BABYLON.Vector3(0, OBSERVER_EYE_HEIGHT, 0);
			this.groundCamera.setTarget(new BABYLON.Vector3(0, 110, 760));
			this.groundCamera.fov = 1.08;
		}
		this.setGroundElementsEnabled(nextMode === 'ground');
		this.updateSky(this.lastData || {}); // orbit→暗背景 / ground→恢复昼夜天空
		nextCamera.attachControl(this.canvas, true);
		this.applyLabelVisibility();
		this.applyModeBoundVisibility();
	}

	animateViewTransition(nextMode, nextCamera){
		if(!this.transitionCamera || !this.scene){
			this.completeViewMode(nextMode, nextCamera);
			return;
		}
		if(this.viewTransition && this.viewTransition.cancel){
			this.viewTransition.cancel();
		}
		const startCamera = this.camera || this.scene.activeCamera || nextCamera;
		const oldMode = this.viewMode;
		if(startCamera && startCamera.detachControl){
			startCamera.detachControl(this.canvas);
		}
		const startPosition = this.cameraPosition(startCamera);
		const startTarget = this.cameraTarget(startCamera);
		const startFov = startCamera && startCamera.fov ? startCamera.fov : 0.92;
		const destination = nextMode === 'ground'
			? {
				position: new BABYLON.Vector3(0, OBSERVER_EYE_HEIGHT, 0),
				target: new BABYLON.Vector3(0, 110, 760),
				fov: 1.08,
			}
			: this.prepareOrbitDestination();
		const transition = {
			cancelled: false,
			cancel(){
				this.cancelled = true;
			},
		};
		this.viewTransition = transition;
		this.viewMode = nextMode;
		this.camera = this.transitionCamera;
		this.scene.activeCamera = this.transitionCamera;
		this.updateSky(this.lastData || {}); // 切 orbit 立即暗化背景
		this.setGroundElementsEnabled(nextMode === 'ground' || oldMode === 'ground');
		this.setFreeCameraView(this.transitionCamera, startPosition, startTarget, startFov);
		const duration = 1450;
		const started = nowMs();
		const tick = ()=>{
			if(transition.cancelled || this.disposed || !this.scene){
				return;
			}
			const t = easeInOutCubic((nowMs() - started) / duration);
			const position = BABYLON.Vector3.Lerp(startPosition, destination.position, t);
			const target = BABYLON.Vector3.Lerp(startTarget, destination.target, t);
			const fov = lerpNumber(startFov, destination.fov, t);
			this.setFreeCameraView(this.transitionCamera, position, target, fov);
			if(nextMode === 'orbit' && t > 0.72){
				this.setGroundElementsEnabled(false);
			}
			if(t < 1){
				requestAnimationFrame(tick);
				return;
			}
			this.completeViewMode(nextMode, nextCamera);
		};
		requestAnimationFrame(tick);
	}

	setViewMode(mode, animate = true){
		const nextMode = mode === 'orbit' ? 'orbit' : 'ground';
		const nextCamera = nextMode === 'orbit' ? this.orbitCamera : this.groundCamera;
		if(!nextCamera){
			return;
		}
		if(this.camera && this.viewMode === nextMode && this.camera !== this.transitionCamera){
			this.setGroundElementsEnabled(nextMode === 'ground');
			if(this.scene && this.scene.activeCamera !== this.camera){
				this.scene.activeCamera = this.camera;
			}
			if(this.camera.attachControl){
				this.camera.attachControl(this.canvas, true);
			}
			return;
		}
		if(animate && this.camera && this.scene && this.scene.activeCamera){
			this.animateViewTransition(nextMode, nextCamera);
			return;
		}
		if(this.camera && this.camera.detachControl){
			this.camera.detachControl(this.canvas);
		}
		this.viewMode = nextMode;
		this.camera = nextCamera;
		this.scene.activeCamera = nextCamera;
		nextCamera.attachControl(this.canvas, true);
		if(nextMode === 'ground'){
			this.groundCamera.position = new BABYLON.Vector3(0, OBSERVER_EYE_HEIGHT, 0);
			this.groundCamera.setTarget(new BABYLON.Vector3(0, 110, 760));
			this.groundCamera.fov = 1.08;
		}
		this.setGroundElementsEnabled(nextMode === 'ground');
		this.applyLabelVisibility();
		this.applyModeBoundVisibility();
	}

	clearData(){
		this.pickMeshes = [];
		this.bodyMeshes = {};
		this.projectableMeshes = [];
		this.projectableLines = [];
		this.followMeshes = [];
		this.groups.forEach((group)=>{
			group.dispose(false, true);
		});
		this.groups = [];
		this.starPcs = null;
		this.starMesh = null;
		this.starCount = 0;
		this.starCatalog = [];
	}

	makeGroup(name){
		const group = new BABYLON.TransformNode(name, this.scene);
		this.groups.push(group);
		return group;
	}

	material(name, color, alpha = 1){
		const mat = new BABYLON.StandardMaterial(name, this.scene);
		mat.disableLighting = true;
		mat.emissiveColor = color;
		mat.diffuseColor = color;
		mat.alpha = alpha;
		return mat;
	}

	createGroundMaterial(){
		const mat = new BABYLON.StandardMaterial('ground-horizon-occluder-material', this.scene);
		mat.disableLighting = true;
		mat.diffuseColor = new BABYLON.Color3(0.015, 0.014, 0.014);
		mat.emissiveColor = new BABYLON.Color3(0.015, 0.014, 0.014);
		mat.specularColor = BABYLON.Color3.Black();
		mat.backFaceCulling = false;
		mat.alpha = 0;
		return mat;
	}

	createHorizonPanorama(){
		const radius = LINE_RADIUS - 18;
		const azSegments = 256;
		const altSegments = 56;
		const topAlt = 42;
		const bottomAlt = -72;
		const positions = [];
		const indices = [];
		const uvs = [];
		for(let y = 0; y <= altSegments; y += 1){
			const v = y / altSegments;
			const altitudeAppa = topAlt + (bottomAlt - topAlt) * v;
			for(let x = 0; x <= azSegments; x += 1){
				const u = x / azSegments;
				const position = toSkyVector({ azimuth: u * 360, altitudeAppa }, radius);
				positions.push(position.x, position.y, position.z);
				uvs.push(1 - u, v);
			}
		}
		for(let y = 0; y < altSegments; y += 1){
			for(let x = 0; x < azSegments; x += 1){
				const a = y * (azSegments + 1) + x;
				const b = a + 1;
				const c = a + azSegments + 1;
				const d = c + 1;
				indices.push(a, c, b, b, c, d);
			}
		}
		const mesh = new BABYLON.Mesh('horizon-panorama-layer', this.scene);
		const vertexData = new BABYLON.VertexData();
		vertexData.positions = positions;
		vertexData.indices = indices;
		vertexData.uvs = uvs;
		const normals = [];
		BABYLON.VertexData.ComputeNormals(positions, indices, normals);
		vertexData.normals = normals;
		vertexData.applyToMesh(mesh, true);
		mesh.isPickable = false;
		mesh.alwaysSelectAsActiveMesh = true;
		mesh.renderingGroupId = 1;

		// 程序化地表裙边纹理(替代旧照片全景):干净渐变地面 + 柔和地平线,天象馆质感、无照片。
		// 地平线所在 UV(v):由 topAlt/bottomAlt 推得,= topAlt/(topAlt-bottomAlt)。
		this._horizonTopAlt = topAlt;
		this._horizonBottomAlt = bottomAlt;
		const mat = new BABYLON.StandardMaterial('horizon-panorama-material', this.scene);
		mat.disableLighting = true;
		mat.useAlphaFromDiffuseTexture = true;
		mat.diffuseColor = new BABYLON.Color3(0.52, 0.52, 0.5);
		mat.emissiveColor = new BABYLON.Color3(0.52, 0.52, 0.5);
		mat.specularColor = BABYLON.Color3.Black();
		mat.backFaceCulling = false;
		mat.disableDepthWrite = true;
		mat.disableDepthTest = true;
		mat.alphaMode = BABYLON.Engine.ALPHA_COMBINE;
		mesh.material = mat;
		this.applyHorizonTexture(mat); // 按 groundProcedural 设纹理(默认=原照片全景)
		return mesh;
	}

	// 设地平裙边纹理:原照片全景地面(纹理灰阶由材质 diffuse/emissive 跟随昼夜 palette 染色)。
	applyHorizonTexture(mat){
		mat = mat || (this.horizonPanorama && this.horizonPanorama.material);
		if(!mat){ return; }
		if(mat.diffuseTexture){ mat.diffuseTexture.dispose(); }
		const tex = new BABYLON.Texture(HORIZON_PANORAMA_URL, this.scene, true, false, BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
		tex.hasAlpha = true; tex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE; tex.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
		mat.diffuseTexture = tex; mat.emissiveTexture = tex; mat.opacityTexture = tex;
	}

	// 脚下程序化地面圆盘:补裙边(到 -72°)正下方的小孔洞,使俯视也是连续干净地面(天象馆质感,非照片)。
	// 与裙边底边(alt=-72°)同高、半径略大于其水平半径,朝上铺设;纹理用 paintGroundSurface 干净渐变。
	createGroundDisk(){
		const skirtRadius = LINE_RADIUS - 18;
		const bottomAlt = -72;
		const yBottom = skirtRadius * Math.sin(degToRad(bottomAlt));
		const rBottom = skirtRadius * Math.cos(degToRad(bottomAlt));
		const disk = BABYLON.MeshBuilder.CreateDisc('ground-disk', { radius: rBottom * 1.08, tessellation: 96 }, this.scene);
		disk.rotation.x = Math.PI / 2; // 立面 → 水平,朝上
		disk.position.y = yBottom + 1; // 紧贴裙边底边内缘,略抬避免 z-fighting
		disk.isPickable = false;
		disk.alwaysSelectAsActiveMesh = true;
		disk.renderingGroupId = 1;
		const texture = new BABYLON.DynamicTexture('ground-disk-texture', { width: 512, height: 512 }, this.scene, true);
		texture.hasAlpha = false;
		paintGroundSurface(texture.getContext(), 512, 512);
		texture.update(false);
		const mat = new BABYLON.StandardMaterial('ground-disk-material', this.scene);
		mat.disableLighting = true;
		mat.diffuseTexture = texture;
		mat.emissiveTexture = texture;
		mat.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.48);
		mat.emissiveColor = new BABYLON.Color3(0.5, 0.5, 0.48);
		mat.specularColor = BABYLON.Color3.Black();
		mat.backFaceCulling = false;
		disk.material = mat;
		return disk;
	}

	createHorizonMist(){
		const mesh = BABYLON.MeshBuilder.CreateCylinder('horizon-mist-layer', {
			diameter: LINE_RADIUS * 2.62,
			height: 260,
			tessellation: 192,
			subdivisions: 1,
			cap: BABYLON.Mesh.NO_CAP,
			sideOrientation: BABYLON.Mesh.BACKSIDE,
		}, this.scene);
		mesh.position.y = 18;
		mesh.isPickable = false;
		mesh.alwaysSelectAsActiveMesh = true;
		mesh.renderingGroupId = 1;

		const texture = new BABYLON.DynamicTexture('horizon-mist-texture', { width: 1024, height: 256 }, this.scene, true);
		texture.hasAlpha = true;
		this.horizonMistTexture = texture;
		paintHorizonMistSurface(texture.getContext(), 1024, 256, {
			glow: [0.28, 0.38, 0.65],
			clear: [0.008, 0.012, 0.028],
			mistAlpha: 0.14,
		});
		texture.update(false);

		const mat = new BABYLON.StandardMaterial('horizon-mist-material', this.scene);
		mat.disableLighting = true;
		mat.diffuseTexture = texture;
		mat.emissiveTexture = texture;
		mat.opacityTexture = texture;
		mat.useAlphaFromDiffuseTexture = true;
		mat.diffuseColor = BABYLON.Color3.White();
		mat.emissiveColor = BABYLON.Color3.White();
		mat.specularColor = BABYLON.Color3.Black();
		mat.backFaceCulling = false;
		mat.disableDepthWrite = true;
		mat.disableDepthTest = true;
		mat.alpha = 0.82;
		mesh.material = mat;
		return mesh;
	}

	createTerrainBand(name, radius, bottomAlt, topBaseAlt, amplitude, color){
		const segments = 192;
		const positions = [];
		const indices = [];
		for(let i = 0; i <= segments; i += 1){
			const azimuth = (i / segments) * 360;
			const wave = Math.sin(degToRad(azimuth * 1.15)) * amplitude * 0.42
				+ Math.sin(degToRad(azimuth * 2.4 + 38)) * amplitude * 0.24
				+ Math.sin(degToRad(azimuth * 4.2 + 114)) * amplitude * 0.08;
			const softness = (noise2(Math.floor(i / 4), 21, radius) - 0.5) * amplitude * 0.18;
			const topAlt = clamp(topBaseAlt + wave + softness, topBaseAlt - amplitude * 0.45, topBaseAlt + amplitude * 0.58);
			const top = toSkyVector({ azimuth, altitudeAppa: topAlt }, radius);
			const bottom = toSkyVector({ azimuth, altitudeAppa: bottomAlt }, radius);
			positions.push(top.x, top.y, top.z, bottom.x, bottom.y, bottom.z);
			if(i < segments){
				const a = i * 2;
				indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
			}
		}
		const mesh = new BABYLON.Mesh(name, this.scene);
		const vertexData = new BABYLON.VertexData();
		vertexData.positions = positions;
		vertexData.indices = indices;
		const normals = [];
		BABYLON.VertexData.ComputeNormals(positions, indices, normals);
		vertexData.normals = normals;
		vertexData.applyToMesh(mesh, true);
		mesh.isPickable = false;
		mesh.alwaysSelectAsActiveMesh = true;
		mesh.renderingGroupId = 0;
		const mat = new BABYLON.StandardMaterial(`${name}-material`, this.scene);
		mat.disableLighting = true;
		mat.diffuseColor = color;
		mat.emissiveColor = color;
		mat.specularColor = BABYLON.Color3.Black();
		mat.backFaceCulling = false;
		mesh.material = mat;
		return mesh;
	}

	createHorizonLandscape(){
		const ridge = this.createTerrainBand('distant-ridge-silhouette', LINE_RADIUS - 36, -14, 0.15, 1.25, new BABYLON.Color3(0.025, 0.052, 0.046));
		const nearRidge = this.createTerrainBand('near-field-silhouette', LINE_RADIUS - 62, -16, -0.8, 0.68, new BABYLON.Color3(0.018, 0.038, 0.03));
		return [ridge, nearRidge];
	}

	createSurfaceTexture(id, phase){
		const size = planetTextureSize(id);
		const texture = new BABYLON.DynamicTexture(`surface-${id}-${Math.random()}`, size, this.scene, true);
		texture.hasAlpha = id === 'Moon';
		const ctx = texture.getContext();
		if(id === 'Moon'){
			paintMoonPhase(ctx, phase || this.currentMoonPhase, size.width);
		}else{
			paintPlanetSurface(ctx, id, size.width, size.height);
		}
		texture.update(true);
		return texture;
	}

	createBodyMaterial(body){
		const id = body.id;
		const color = BODY_COLORS[id] || new BABYLON.Color3(0.9, 0.9, 1);
		if(!TEXTURED_BODY_IDS.has(id)){
			return this.material(`body-mat-${id}`, color, 1);
		}
		const visual = BODY_VISUALS[id] || { emissive: 0.42 };
		const mat = new BABYLON.StandardMaterial(`body-surface-mat-${id}-${Math.random()}`, this.scene);
		const texture = this.createSurfaceTexture(id, id === 'Moon' ? this.currentMoonPhase : null);
		mat.diffuseTexture = texture;
		mat.emissiveTexture = texture;
		mat.diffuseColor = color.scale(id === 'Sun' ? 1.18 : 1.08);
		mat.specularColor = id === 'Sun'
			? new BABYLON.Color3(1, 0.62, 0.24)
			: color.scale(0.22);
		mat.emissiveColor = id === 'Sun'
			? new BABYLON.Color3(1, 0.56, 0.16)
			: color.scale(visual.emissive);
		mat.disableLighting = true;
		mat.useAlphaFromDiffuseTexture = id === 'Moon';
		return mat;
	}

	createBodyHalo(mesh, body, group){
		const id = body.id;
		const visual = BODY_VISUALS[id];
		if(!visual){
			return;
		}
		const color = BODY_COLORS[id] || new BABYLON.Color3(1, 1, 1);
		const scale = visual.haloScale || 1.55;
		const halo = BABYLON.MeshBuilder.CreateSphere(`body-halo-${id}`, { diameter: mesh.getBoundingInfo().boundingSphere.radius * 2 * scale, segments: 24 }, this.scene);
		halo.position.copyFrom(mesh.position);
		halo.material = this.material(`body-halo-mat-${id}`, color, visual.haloAlpha || 0.08);
		halo.material.alphaMode = BABYLON.Engine.ALPHA_ADD;
		halo.renderingGroupId = 1;
		halo.parent = group;
		halo.isPickable = false;
		this.registerFollowerMesh(halo, id, ()=>BABYLON.Vector3.Zero());
	}

	createSaturnRing(mesh, group){
		const ring = BABYLON.MeshBuilder.CreateTorus('saturn-ring', { diameter: 28, thickness: 2.2, tessellation: 96 }, this.scene);
		ring.position.copyFrom(mesh.position);
		ring.rotation.x = Math.PI * 0.58;
		ring.rotation.z = Math.PI * 0.12;
		ring.scaling.y = 0.38;
		ring.material = this.material('saturn-ring-mat', new BABYLON.Color3(0.95, 0.82, 0.55), 0.72);
		ring.parent = group;
		ring.isPickable = false;
		this.registerFollowerMesh(ring, 'Saturn', ()=>BABYLON.Vector3.Zero());
	}

	createMoonPhaseDisc(body, mesh, group){
		const texture = this.createSurfaceTexture('Moon', this.currentMoonPhase);
		const mat = new BABYLON.StandardMaterial(`moon-phase-disc-mat-${Math.random()}`, this.scene);
		mat.diffuseTexture = texture;
		mat.emissiveTexture = texture;
		mat.opacityTexture = texture;
		mat.disableLighting = true;
		mat.useAlphaFromDiffuseTexture = true;
		const disc = BABYLON.MeshBuilder.CreatePlane('moon-phase-disc', { width: 22, height: 22 }, this.scene);
		disc.position = mesh.position.add(mesh.position.clone().normalize().scale(2.5));
		disc.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
		disc.material = mat;
		disc.parent = group;
		disc.metadata = { body: { ...body, displayName: bodyName(body), layer: 'body' } };
		this.pickMeshes.push(disc);
		this.registerFollowerMesh(disc, 'Moon', (target)=>target.position.clone().normalize().scale(2.5));
	}

	createEarthAnchor(group){
		const body = {
			id: 'Earth',
			name: 'Earth',
			displayName: '地球',
			layer: 'body',
			type: '地球/观测点',
			altitudeAppa: -90,
			azimuth: 0,
			visible: false,
			horizonState: '脚下地球',
		};
		const mesh = BABYLON.MeshBuilder.CreateSphere('body-Earth', { diameter: 34, segments: 32 }, this.scene);
		mesh.position = new BABYLON.Vector3(0, -BODY_RADIUS + 74, 0);
		mesh.material = this.createBodyMaterial(body);
		mesh.parent = group;
		mesh.metadata = { body };
		this.pickMeshes.push(mesh);
		this.bodyMeshes.Earth = mesh;
		this.bodyMeshes['地球'] = mesh;
		const label = this.createTextPlane('地球', 40, '#d8ecff', 'rgba(0,0,0,0)');
		label.position = mesh.position.add(new BABYLON.Vector3(0, 26, 0));
		label.parent = group;
		label.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
		label.metadata = { labelKind: 'body' };
	}

	updateData(data, layers){
		this.layers = {...DEFAULT_LAYERS, ...(layers || {})};
		if(!data){
			return;
		}
		this.lastData = data;
		this.currentMoonPhase = data.sky && data.sky.moonPhase ? data.sky.moonPhase : null;
		const started = nowMs();
		const hasStarCatalog = !!(data.stars && data.stars.catalog && data.stars.catalog.length);
		this.updateSky(data);
		this.clearDynamicData(!hasStarCatalog && !!this.starPcs);
		this.createCardinals();
		this.updateStars(data.stars && data.stars.catalog ? data.stars.catalog : []);
		this.createOverlayLines(data.overlays || {}, data.observer || {});
		const observerArg = data.observer || {};
		this.createPoles(observerArg);
		// 🚀 默认关的贵图层(银道/河 · 三套坐标网格+名牌 · 四主圈刻度 · 二十八宿网格 · 星座线/界 · 三垣 · 岁差 · 日行迹)统一懒构建:
		// 开场默认全关 → 一个都不建(renderMs 大降、非降级零回归);某层在 saved 态或 toggle 开启时,_buildOffLayers 只建该层。
		this._buildOffLayers(true);
		this.createBodies(data.bodies || []);
		this.createSu28Sectors(data.traditions && data.traditions.su28 ? data.traditions.su28 : [], data.observer || {});
		this.createTraditionalLayer('su28', data.traditions && data.traditions.su28 ? data.traditions.su28 : [], new BABYLON.Color3(0.9, 0.68, 0.36), 4.8);
		this.createTraditionalLayer('beidou', data.traditions && data.traditions.beidou ? data.traditions.beidou : [], new BABYLON.Color3(0.52, 0.82, 1), 6.2);
		// 完整星官(312)+ 行星轨迹(后端 data.trails,仅开层重取后有):坐标全走真实赤道(纯天文铁律),默认层关 → 零回归。
		// 🚀 星官默认关 → 懒构建:仅该层已开时才建(开场省 1153 隐藏网格 + 312 名牌纹理 ≈ 半数场景网格,显著降卡顿;非降级零回归)。
		if(this.layers && this.layers.xingguan){ this.ensureChineseAsterismsBuilt(); }
		this.createPlanetTrails(data);
		this.applyLayerVisibility();
		return Math.round(nowMs() - started);
	}

	// 🚀 默认关贵图层懒构建:每层独立 _off[k] 守卫,只建「已开且本轮未建」者。
	// 开场全关 → 零建(renderMs 大降);saved 态 / toggle 开 → 只建该层(参数与原 updateData 急建块逐字一致,非降级零回归)。
	// 调用:updateData(skipApply=true,末尾统一 applyLayerVisibility)/ componentDidUpdate 图层变(skipApply=false,建完即显隐)。
	_buildOffLayers(skipApply){
		if(!this.lastData){ return false; }
		if(!this._off){ this._off = {}; }
		const data = this.lastData;
		const observerArg = data.observer || {};
		const L = this.layers || {};
		let built = false;
		const need = (k)=>{ if(L[k] && !this._off[k]){ this._off[k] = true; built = true; return true; } return false; };
		if(need('galacticEquator')){ this.createGalacticEquator(observerArg); }
		if(need('milkyWay')){ this.createMilkyWay(observerArg); }
		if(need('horizontalGrid')){
			const g = this.createCoordinateGrid({
				groupName: 'grid-horizontal-layer', layerKey: 'horizontalGrid', observer: observerArg,
				color: new BABYLON.Color3(0.30, 0.78, 0.62), alpha: 0.34, radius: 752, projectable: false,
				meridianStep: 30, parallelStep: 15, vRange: [-90, 90], skipPrincipal: 0,
				polarFade: true, emphasizeColure: true,
				toAltAz: (az, alt)=>({ altitudeAppa: alt, azimuth: az }),
			});
			this.createGridLabels({ group: g, gridKey: 'horizontalGrid', kind: 'horizontal', observer: observerArg, color: '#c8ffe8', radius: 752 });
		}
		if(need('equatorialGrid')){
			const g = this.createCoordinateGrid({
				groupName: 'grid-equatorial-layer', layerKey: 'equatorialGrid', observer: observerArg,
				color: new BABYLON.Color3(0.42, 0.54, 0.92), alpha: 0.32, radius: 754, projectable: true,
				meridianStep: 15, parallelStep: 15, vRange: [-90, 90], skipPrincipal: 0,
				polarFade: true, emphasizeColure: true,
				toAltAz: (ra, dec, jd, obs, refr)=>({ ...equatorialToHorizontal(ra, dec, jd, obs, refr), ra, decl: dec }),
			});
			this.createGridLabels({ group: g, gridKey: 'equatorialGrid', kind: 'equatorial', observer: observerArg, color: '#aac0ff', tickColor: new BABYLON.Color3(0.42, 0.54, 0.92), radius: 754 });
		}
		if(need('eclipticGrid')){
			const g = this.createCoordinateGrid({
				groupName: 'grid-ecliptic-layer', layerKey: 'eclipticGrid', observer: observerArg,
				color: new BABYLON.Color3(1.0, 0.7, 0.22), alpha: 0.32, radius: 770, projectable: true,
				meridianStep: 30, parallelStep: 15, vRange: [-90, 90], skipPrincipal: 0,
				polarFade: true, emphasizeColure: true,
				toAltAz: (lon, lat, jd, obs, refr)=>{ const e = eclipticToEquatorial(lon, lat, jd); return { ...equatorialToHorizontal(e.ra, e.decl, jd, obs, refr), ra: e.ra, decl: e.decl }; },
			});
			this.createGridLabels({ group: g, gridKey: 'eclipticGrid', kind: 'ecliptic', observer: observerArg, color: '#ffe6a8', tickColor: new BABYLON.Color3(1.0, 0.7, 0.22), radius: 770 });
		}
		if(need('su28Grid')){ this.createSu28Grid(data.traditions && data.traditions.su28 ? data.traditions.su28 : [], observerArg); }
		if(need('raHourScale')){
			this.createCircleScale({
				groupName: 'scale-equator-layer', observer: observerArg, projectable: true,
				baseRadius: 756, minorStep: 15, step: 30,
				tickColor: new BABYLON.Color3(0.42, 0.54, 0.92), labelColor: '#aac0ff', labelFor: (a)=>`${Math.round(a / 15)}h`,
				toAnchor: (a, jd, obs, refr)=>projectedEquatorialItem({ ra: a, decl: 0 }, jd, obs, refr),
			});
		}
		if(need('eclipticDegreeScale')){
			this.createCircleScale({
				groupName: 'scale-ecliptic-layer', observer: observerArg, projectable: true,
				baseRadius: 774, minorStep: 10, step: 30,
				tickColor: new BABYLON.Color3(1.0, 0.7, 0.22), labelColor: '#ffe6a8', labelFor: (a)=>`${Math.round(a)}°`,
				toAnchor: (a, jd, obs, refr)=>{ const e = eclipticToEquatorial(a, 0, jd); return e ? projectedEquatorialItem({ ra: e.ra, decl: e.decl }, jd, obs, refr) : null; },
			});
		}
		if(need('azimuthScale')){
			this.createCircleScale({
				groupName: 'scale-horizon-layer', observer: observerArg, projectable: false,
				baseRadius: 760, minorStep: 15, step: 30,
				tickColor: new BABYLON.Color3(0.48, 0.82, 0.96), labelColor: '#c8ffe8', labelFor: (a)=>`${Math.round(a)}°`,
				toAnchor: (a)=>({ altitudeAppa: 0, azimuth: a }),
			});
		}
		if(need('altitudeScale')){
			this.createCircleScale({
				groupName: 'scale-meridian-layer', observer: observerArg, projectable: false,
				baseRadius: 758, range: [0, 90], minorStep: 10, step: 30,
				tickColor: new BABYLON.Color3(0.48, 0.68, 0.88), labelColor: '#c0d2f0', labelFor: (a)=>`${Math.round(a)}°`,
				toAnchor: (a)=>({ altitudeAppa: a, azimuth: 180 }),
			});
		}
		if(need('threeEnclosures')){ this.createEnclosures(observerArg); }
		if(need('constellationLines')){ this.createConstellationLines(observerArg); }
		if(need('constellationBounds')){ this.createConstellationBounds(observerArg); }
		if(need('starNames')){ this.createStarNames(data.stars && data.stars.catalog ? data.stars.catalog : [], observerArg); }
		if(need('precessionCircle')){ this.createPrecessionCircle(observerArg); }
		if(need('analemma')){ this.createAnalemma(observerArg); }
		if(built && !skipApply){ this.applyLayerVisibility(); }
		return built;
	}

	applyPlaybackCalibration(data, time, fields, skipReproject, displayTime){
		if(!data){
			return 0;
		}
		const started = nowMs();
		this.lastData = {
			...(this.lastData || {}),
			...data,
			stars: this.lastData && this.lastData.stars ? this.lastData.stars : data.stars,
			overlays: this.lastData && this.lastData.overlays ? this.lastData.overlays : data.overlays,
			traditions: this.lastData && this.lastData.traditions ? this.lastData.traditions : data.traditions,
		};
		this.currentMoonPhase = data.sky && data.sky.moonPhase ? data.sky.moonPhase : this.currentMoonPhase;
		this.updateSky(data);
		const bodiesById = {};
		(data.bodies || []).forEach((body)=>{
			if(body && body.id){
				bodiesById[body.id] = body;
			}
		});
		// 🆕 校准时位置无缝衔接(Stellarium 风格):
		// ① 不直接写 mesh.position(原代码 toSkyVector(body) 用 syncJd 位置覆盖 → 从 frame_jd 跳回 syncJd「弹跳」)
		// ② item.source = body **引用赋值**(关键!) → src 与 state.data.bodies[i] 共享同一对象 →
		//    帧循环 mutate src.lon/lat/ra/decl 直接被右栏 renderSelected 看到 → 右栏每 120ms 重渲拿到最新外推值
		// ③ 计算新 _baseLon/_baseLat = 「旧外推到本次 calibJd 时刻位置」+ 新 lonspeed/latspeed 从那时起继续外推
		//    → 视觉上从这一帧的「旧外推位置」直接延续,位置连续、速率精确
		const newCalibJd = (time && (time.jdn || (time.calcJdn && time.calcJdn()))) || null;
		const oldCalibJd = this._calibJd;
		this.projectableMeshes.forEach((item)=>{
			const body = item.source && item.source.id ? bodiesById[item.source.id] : null;
			if(body){
				const oldSrc = item.source;
				// 旧基线存在且本次校准有 jd → 算旧外推到 newCalibJd 时刻的 lon/lat(=当前 mesh 在帧循环里下一刻应在的位置)
				let newBaseLon = null;
				let newBaseLat = null;
				const calibDtJd = (Number.isFinite(oldCalibJd) && Number.isFinite(newCalibJd)) ? (newCalibJd - oldCalibJd) : null;
				if(calibDtJd !== null && Number.isFinite(oldSrc._baseLon) && Number.isFinite(oldSrc.lonspeed)){
					newBaseLon = normalizeDegrees(oldSrc._baseLon + oldSrc.lonspeed * calibDtJd);
				}
				if(calibDtJd !== null && Number.isFinite(oldSrc._baseLat) && Number.isFinite(oldSrc.latspeed)){
					newBaseLat = oldSrc._baseLat + oldSrc.latspeed * calibDtJd;
				}
				// 引用赋值:item.source = body → src 与 state.data.bodies[i] 共享同一对象。
				// 后续帧 mutate body.lon/lat/ra/decl → state.data.bodies 同步更新 → 右栏 renderSelected 实时拿到外推值(不再 2.5s 一跳)。
				item.source = body;
				body._baseLon = (newBaseLon !== null) ? newBaseLon : body.lon;
				body._baseLat = (newBaseLat !== null) ? newBaseLat : (Number.isFinite(body.lat) ? body.lat : 0);
				// ⚠ skipReproject=false(单步)时立即设 mesh 位置;播放中(skipReproject=true)留给下一帧 RAF
				// updateProjectedTime 用 frame_jd 平滑外推,避免从 frame_jd 跳回 syncJd 位置
				if(!skipReproject){
					item.mesh.position = toSkyVector(body, item.radius);
				}
				if(item.mesh.metadata && item.mesh.metadata.body){
					item.mesh.metadata.body = { ...item.mesh.metadata.body, ...body, displayName: bodyName(body), layer: 'body' };
				}
			}
		});
		this.updateFollowers();
		// ⚠ 关键顺序:先把 _calibJd 更新到 newCalibJd,再调 updateProjectedTime。
		// 否则 updateProjectedTime 用旧 _calibJd 算 dtJd,但 _baseLon 已是基于 newCalibJd 的新基线 → 双重偏移,
		// extrap = newBaseLon + lonspeed × (displayJd - oldCalibJd) = oldBase + lonspeed × (newCalibJd - oldCalibJd + displayJd - oldCalibJd) 大幅偏移。
		this._calibJd = newCalibJd || this._calibJd || null;
		// 播放中帧循环每帧已重投影(8404 星 + setParticles GPU 上传)→ 跳过此处冗余,避免同帧二次上传致每 2.5s 卡顿;单步无帧循环 → 需重投影。
		// 🆕 重投影时用 displayTime(当前显示时刻 = React state.time,暂停时=pauseTime=A)而非 syncTime(=sync request 时 frame_jd,
		// 比当前显示时刻早 sync API delay ~150-400ms × prevSpeed = 几秒模拟时间)。否则暂停后在途 sync 回来会把整个 scene 跳回 B 位置(几秒前)
		// → 用户视觉感受「暂停瞬间整个 scene 回退到几秒前的状态」(A→B 跳变)。displayTime 兜底 time → 旧调用方零回归。
		if(!skipReproject){ this.updateProjectedTime(displayTime || time, fields); }
		// 日行迹随显示时刻/地点重算(否则停在构建时=本命时刻):该层开 + 时刻变 >30min 时按当前时刻重建。
		if(this.layers && this.layers.analemma){
			const ajd = (time && (time.jdn || (time.calcJdn && time.calcJdn()))) || 0;
			if(Math.abs(ajd - (this._analemmaJd || -1e9)) > (1 / 48)){
				this._analemmaJd = ajd;
				this.rebuildAnalemma(ajd, observerFromFields(fields, this.lastData));
			}
		}
		return Math.round(nowMs() - started);
	}

	updateProjectedTime(time, fields, applyRefractionOverride){
		if(!time || !this.lastData){
			return 0;
		}
		const started = nowMs();
		const jd = time.jdn || time.calcJdn();
		const observer = observerFromFields(fields, this.lastData);
		this.setReadoutContext(jd, observer); // 让「点击空白处读坐标」用当前时刻/观测点
		// ① 天文馆:仅地表观测(ground)加大气折射;天球外观(orbit)展示几何原貌。切模式时 React 侧传 override 立即生效(不等相机动画)。
		const applyRefraction = (typeof applyRefractionOverride === 'boolean') ? applyRefractionOverride : this.refractionActive();
		if(this.starPcs && this.starPcs.particles && this.starCatalog && this.starCatalog.length === this.starPcs.particles.length){
			this.starCatalog.forEach((star, idx)=>{
				const particle = this.starPcs.particles[idx];
				if(!particle){
					return;
				}
				// 🚀 热路径零分配:直接 equatorialToHorizontal(略过 projectedEquatorialItem 的 {...star} 整对象 spread)+ toSkyVectorInto 写入既有 particle.position
				// (略过 new Vector3)。两处每帧各省 8404 次堆分配 → 消除周期性 major GC(连续播放卡顿根因)。星表恒带 ra/decl,位置字节级一致。
				const pos = equatorialToHorizontal(star.ra, star.decl, jd, observer, applyRefraction);
				if(pos){ toSkyVectorInto(pos, STAR_RADIUS, particle.position); }
			});
			this.starPcs.setParticles();
		}
		let sunAltAppa = null; // 太阳前端投影视高度(度):驱动天空昼夜即时同步,免随后端数据滞后
		// 🆕 行星本地外推时刻:懒初始化为当前帧 jd → 首帧 Δjd=0 不外推(=body.lon 校准时刻位置);
		// 之后每帧 Δjd = jd - calibJd,把月亮/行星等带 lonspeed 的 body 黄经线性外推,
		// 避免帧循环里行星位置停在 2.5s 前的校准值、每次校准跳一下(3600x 下月亮跳幅 1.35°)。
		// 校准回来时 applyPlaybackCalibration 会重设 _calibJd → 外推归零并与精确数据无缝衔接。
		if(this._calibJd === undefined || this._calibJd === null){ this._calibJd = jd; }
		const dtJd = jd - this._calibJd; // 单位:日(JD 计)
		this.projectableMeshes.forEach((item)=>{
			const isSun = item && item.source && item.source.id === 'Sun';
			// 性能守卫:隐藏层(网格/极点等)只付 isEnabled 检查,跳过重投影。但太阳须始终投影(驱动天空昼夜),不受「星体」开关影响。
			if(!isSun && item && item.mesh && !this.layerAllowsMesh(item.mesh)){
				if(item.mesh.isEnabled()){ item.mesh.setEnabled(false); }
				return;
			}
			// 🆕 行星外推:有 lonspeed + dtJd ≠ 0 → 按线性外推 lon,转 ra/decl 后投影。
			// 走自己的小路径避免 projectedEquatorialItem 内部 {...item} 整对象 spread 跑两遍。
			//
			// ⚠ 累积 bug 防护:用 src._baseLon/_baseLat 作为外推**基线**(校准时刻精确 lon/lat),
			// 外推只读基线、不污染基线。若每帧 mutate src.lon = extrapLon 让下一帧再加 dtJd × lonspeed,
			// 因 dtJd 从 calibJd 起算累计增长(不归零),会让 src.lon 越走越快 → 月亮可达真实速度 200×。
			// 校准回来时 applyPlaybackCalibration 把 item.source 指向新 body 对象(清白,无 _baseLon)
			// → 下一帧首循环 lazy 设 _baseLon = 新 body.lon (校准时刻精确值) → 外推归零、无缝对齐。
			let projected = null;
			const src = item.source;
			// ⚠ 不能用 `dtJd !== 0` 跳过外推:calibration 刚到时 _calibJd ≈ frame_jd → dtJd ≈ 0,
			// 若跳过 → src.lon/lat 保留 body 原始 sync 时刻精确值(≈100ms calibration API delay 之前的位置),
			// 用户点暂停瞬间看到的就是 raw sync 值而非 seamless 衔接值 → 3600x 下月亮 lon 倒退 ~0.05°(A→B→A 弹跳源)。
			// 修法:dtJd=0 时 extrap = _baseLon(applyPlaybackCalibration 已设为 seamless 衔接值)→ src.lon 仍是无缝位置。
			if(src && Number.isFinite(src.lonspeed) && Number.isFinite(src.lon)){
				if(!Number.isFinite(src._baseLon)){
					// 新 body 对象首次进入循环:固定基线为校准时刻的精确 lon/lat。
					src._baseLon = src.lon;
					src._baseLat = Number.isFinite(src.lat) ? src.lat : 0;
				}
				const extrapLon = normalizeDegrees(src._baseLon + src.lonspeed * dtJd);
				// 🆕 lat 也外推:有 latspeed 才推(行星 lat 速度可忽略时后端可能不给),无 latspeed 时用基线。
				// 月亮 latspeed ±5°/day,3600x 下 7s 模拟时间内 lat 变化 0.5°(=月亮直径),不外推就会每 calib 跳一下。
				const extrapLat = Number.isFinite(src.latspeed) ? (src._baseLat + src.latspeed * dtJd) : src._baseLat;
				const eq = eclipticToEquatorial(extrapLon, extrapLat, jd);
				if(eq){
					const pos = equatorialToHorizontal(eq.ra, eq.decl, jd, observer, applyRefraction);
					if(pos){
						projected = {
							...src,
							lon: extrapLon,
							lat: extrapLat,
							ra: eq.ra,
							decl: eq.decl,
							altitudeAppa: pos.altitudeAppa,
							altitudeTrue: pos.altitudeTrue,
							azimuth: pos.azimuth,
							visible: pos.altitudeAppa > 0,
							horizonState: pos.altitudeAppa > 0 ? '可见' : '地平线下',
						};
						// 把外推后的展示字段(非基线)同步到 src,让右栏每 120ms setState 重渲拿到最新值。
						// 基线字段 _baseLon/_baseLat/lonspeed/latspeed 不动 → 不污染、不累积。
						src.lon = extrapLon;
						src.lat = extrapLat;
						src.ra = eq.ra;
						src.decl = eq.decl;
						src.altitudeAppa = pos.altitudeAppa;
						src.altitudeTrue = pos.altitudeTrue;
						src.azimuth = pos.azimuth;
						src.visible = projected.visible;
						src.horizonState = projected.horizonState;
						// 🆕 zodiac sign/degree 与 house 也按外推后 lon 重新算,免右栏「星盘位置」停在 calibration 旧值
						// (3600x 下月亮 7s 内可跨 0.04°,虽然小但累计跨座/跨宫时显示明显错位)。
						const zi = zodiacInfoForLon(extrapLon);
						src.zodiacSign = zi.zodiacSign;
						src.zodiacSignId = zi.zodiacSignId;
						src.zodiacDegree = zi.zodiacDegree;
						src.sign = zi.sign;
						src.signlon = zi.signlon;
						if(this.lastData && this.lastData.overlays && this.lastData.overlays.houses){
							const h = houseForLon(extrapLon, this.lastData.overlays.houses);
							if(h !== null){ src.house = h; }
						}
					}
				}
			}
			if(!projected){
				projected = projectedEquatorialItem(src, jd, observer, applyRefraction);
			}
			if(!projected || !item.mesh){
				return;
			}
			if(isSun){ sunAltAppa = projected.altitudeAppa; }
			item.lastProjectedSource = projected;
			item.mesh.position = toSkyVector(projected, item.radius);
			if(item.visibilityMode === 'allAbove' && item.visibilitySources && item.visibilitySources.length){
				const projectedVisibility = item.visibilitySources.map((source)=>projectedEquatorialItem(source, jd, observer, applyRefraction));
				item.lastProjectedSources = projectedVisibility;
				item.mesh.setEnabled(this.layerAllowsMesh(item.mesh) && shouldShowModeBoundItem(item, this.viewMode, this.showBelowHorizon()));
			}else if(item.visibilityMode === 'sourceAbove'){
				item.mesh.setEnabled(this.layerAllowsMesh(item.mesh) && shouldShowModeBoundItem(item, this.viewMode, this.showBelowHorizon()));
			}
			if(item.mesh.metadata && item.mesh.metadata.body){
				item.mesh.metadata.body = {
					...item.mesh.metadata.body,
					altitudeAppa: projected.altitudeAppa,
					azimuth: projected.azimuth,
					visible: projected.visible,
					horizonState: projected.horizonState,
				};
			}
		});
		// 播放/拖时间:天空昼夜随太阳「当前前端视高度」即时切(否则只随后端数据更新→延后/严重对不上)。仅模式变化时重绘天空,省开销。
		if(sunAltAppa != null && this.viewMode !== 'orbit'){
			const skyMode = this.skyModeFromSunAlt(sunAltAppa);
			if(skyMode && skyMode !== this._lastSyncedSkyMode){
				if(!this.lastData){ this.lastData = {}; }
				if(!this.lastData.sky){ this.lastData.sky = {}; }
				this.lastData.sky.mode = skyMode;
				this.updateSky(this.lastData);
			}
		}
		this.projectableLines.forEach((item)=>{
			if(!item || !item.mesh || !item.sources || !item.sources.length){
				return;
			}
			// 性能守卫:隐藏层(网格/刻度/银道/极点十字等)跳过重投影+重建线。
			if(!this.layerAllowsMesh(item.mesh)){
				if(item.mesh.isEnabled()){ item.mesh.setEnabled(false); }
				return;
			}
			let vectors = null;
			if(item.innerRadius !== undefined && item.sources.length === 1){
				const projected = projectedEquatorialItem(item.sources[0], jd, observer, applyRefraction);
				vectors = [
					toSkyVector(projected, item.radius),
					toSkyVector(projected, item.innerRadius),
				];
			}else{
				const projectedSources = item.sources.map((source)=>projectedEquatorialItem(source, jd, observer, applyRefraction));
				if(item.visibilityMode === 'allAbove'){
					item.lastProjectedSources = projectedSources;
					item.mesh.setEnabled(this.layerAllowsMesh(item.mesh) && shouldShowModeBoundItem(item, this.viewMode, this.showBelowHorizon()));
				}
				vectors = projectedSources.map((projected)=>toSkyVector(projected, item.radius));
			}
			BABYLON.MeshBuilder.CreateLines(item.mesh.name, {
				points: vectors,
				instance: item.mesh,
			});
		});
		this.updateFollowers();
		// 🆕 暗星跟随:选中暗星时 _followStar 含 ra/decl,每帧重投影到当前 jd → mutate _followerMesh.position
		// camera.lockedTarget 已挂 _followerMesh,自动跟着移动 = 相机持续居中暗星(随地球自转、岁差、播放时间移动均自动覆盖)。
		if(this._followStar && this._followerMesh){
			const fpos = equatorialToHorizontal(this._followStar.ra, this._followStar.decl, jd, observer, applyRefraction);
			if(fpos){ toSkyVectorInto(fpos, STAR_RADIUS, this._followerMesh.position); }
		}
		return Math.round(nowMs() - started);
	}

	clearDynamicData(preserveStars = false){
		// 🚀 懒构建守卫复位:本方法会 dispose 掉(除恒星外)所有动态组,故清空 _off / _asterismsBuilt,
		// 让 _buildOffLayers / ensureChineseAsterismsBuilt 在下次 updateData 按当前开关重建已开层(并修「全量刷新后开着的层消失」潜伏 bug)。
		this._off = {};
		this._asterismsBuilt = false;
		if(preserveStars){
			const isBrightStarMesh = (mesh)=>mesh && mesh.name && mesh.name.indexOf('bright-star-') === 0;
			const retainedBodyMeshes = {};
			Object.keys(this.bodyMeshes || {}).forEach((key)=>{
				const mesh = this.bodyMeshes[key];
				if(isBrightStarMesh(mesh)){
					retainedBodyMeshes[key] = mesh;
				}
			});
			this.pickMeshes = (this.pickMeshes || []).filter(isBrightStarMesh);
			this.bodyMeshes = retainedBodyMeshes;
			this.projectableMeshes = (this.projectableMeshes || []).filter((item)=>isBrightStarMesh(item && item.mesh));
			this.projectableLines = [];
			this.followMeshes = [];
			const keep = [];
			this.groups.forEach((group)=>{
				if(group.name.indexOf('stars-layer') === 0 || group.name.indexOf('bright-stars-layer') === 0){
					keep.push(group);
				}else{
					group.dispose(false, true);
				}
			});
			this.groups = keep;
			return;
		}
		this.pickMeshes = [];
		this.bodyMeshes = {};
		this.projectableMeshes = [];
		this.projectableLines = [];
		this.followMeshes = [];
		const keep = [];
		this.groups.forEach((group)=>{
			if(group.name.indexOf('stars-layer') === 0){
				keep.push(group);
			}else{
				group.dispose(false, true);
			}
		});
		this.groups = keep;
	}

	registerProjectableMesh(mesh, source, radius, options = null){
		if(!mesh || !source){
			return;
		}
		this.projectableMeshes.push({ mesh, source, radius, ...(options || {}) });
	}

	registerProjectableLine(mesh, sources, radius, innerRadius, options = null){
		if(!mesh || !sources || !sources.length){
			return;
		}
		this.projectableLines.push({ mesh, sources, radius, innerRadius, ...(options || {}) });
	}

	registerFollowerMesh(mesh, targetId, offsetFactory){
		if(!mesh || !targetId){
			return;
		}
		this.followMeshes.push({ mesh, targetId, offsetFactory });
	}

	updateFollowers(){
		this.followMeshes.forEach((item)=>{
			const target = this.bodyMeshes[item.targetId];
			if(!target || !target.position || !item.mesh){
				return;
			}
			const offset = typeof item.offsetFactory === 'function' ? item.offsetFactory(target) : BABYLON.Vector3.Zero();
			item.mesh.position = target.position.add(offset || BABYLON.Vector3.Zero());
		});
	}

	updateSkyTexture(p){
		if(!this.skyTexture){
			return;
		}
		paintSkySurface(this.skyTexture.getContext(), 1024, 512, p);
		this.skyTexture.update(false);
	}

	// 太阳(视)高度 → 天空昼夜模式:标准晨昏阈值 0/-6/-12/-18°(与后端 sky.mode 同口径)
	skyModeFromSunAlt(alt){
		if(alt == null){ return null; }
		if(alt > 0){ return 'day'; }
		if(alt > -6){ return 'civilTwilight'; }
		if(alt > -12){ return 'nauticalTwilight'; }
		if(alt > -18){ return 'astronomicalTwilight'; }
		return 'night';
	}

	updateSky(data){
		const sky = data && data.sky ? data.sky : {};
		// 天球外观(orbit):强制暗色空背景,避免白天天空把网格/刻度/读数冲淡、看不清也不准。
		const mode = this.viewMode === 'orbit' ? 'night' : (sky.mode || 'night');
		this._lastSyncedSkyMode = mode; // 记录当前生效模式,供 updateProjectedTime 太阳高度同步去重(免重复重绘)
		// 🚀 天空外观去重:同(mode + 大气 + 视角)→ 天空/雾纹理不变,跳过昂贵重绘(updateSkyTexture + 1024×256 mist paint + GPU upload)。
		// 修「连续播放时 applyPlaybackCalibration 每 ~2.5s 无条件 updateSky → 重绘纹理致 3D 卡一下」;昼夜过渡 / 大气 / 视角切换仍重绘,零视觉回归。
		const _skySig = mode + '|' + ((this.layers && this.layers.atmosphere) ? '1' : '0') + '|' + this.viewMode;
		if(this._skyPaintSig === _skySig){ return; }
		this._skyPaintSig = _skySig;
		const palettes = {
			day: { clear: [0.26, 0.43, 0.68], zenith: [0.11, 0.27, 0.56], sky: [0.22, 0.42, 0.74], horizon: [0.4, 0.57, 0.78], glow: [0.56, 0.72, 0.9], glowAlpha: 0.28, skyGlowAlpha: 0.26, mistAlpha: 0.18, ground: [0.64, 0.61, 0.54], panorama: [0.7, 0.69, 0.65], land: [0.13, 0.115, 0.095] },
			civilTwilight: { clear: [0.11, 0.16, 0.32], zenith: [0.025, 0.04, 0.12], sky: [0.12, 0.15, 0.36], horizon: [0.34, 0.22, 0.2], glow: [0.86, 0.46, 0.22], glowAlpha: 0.24, skyGlowAlpha: 0.24, mistAlpha: 0.2, ground: [0.42, 0.37, 0.31], panorama: [0.58, 0.52, 0.46], land: [0.08, 0.068, 0.054] },
			nauticalTwilight: { clear: [0.035, 0.055, 0.13], zenith: [0.01, 0.018, 0.055], sky: [0.035, 0.055, 0.16], horizon: [0.08, 0.1, 0.22], glow: [0.35, 0.43, 0.72], glowAlpha: 0.18, skyGlowAlpha: 0.18, mistAlpha: 0.16, ground: [0.28, 0.27, 0.23], panorama: [0.42, 0.42, 0.39], land: [0.052, 0.05, 0.042] },
			astronomicalTwilight: { clear: [0.012, 0.02, 0.055], zenith: [0.004, 0.008, 0.028], sky: [0.01, 0.018, 0.052], horizon: [0.028, 0.04, 0.09], glow: [0.14, 0.24, 0.48], glowAlpha: 0.13, skyGlowAlpha: 0.13, mistAlpha: 0.11, ground: [0.2, 0.19, 0.16], panorama: [0.32, 0.32, 0.3], land: [0.036, 0.034, 0.03] },
			night: { clear: [0.004, 0.006, 0.014], zenith: [0.001, 0.003, 0.012], sky: [0.004, 0.007, 0.022], horizon: [0.012, 0.02, 0.045], glow: [0.04, 0.11, 0.22], glowAlpha: 0.08, skyGlowAlpha: 0.08, mistAlpha: 0.07, ground: [0.15, 0.145, 0.125], panorama: [0.24, 0.24, 0.23], land: [0.026, 0.024, 0.022] },
		};
		const base = palettes[mode] || palettes.night;
		// 大气层关:天空塌成纯真空黑(白天也黑)—— clear/天顶/天空/地平/辉光全归 0、无地平大气辉光与雾。
		// 仅覆盖天空相关字段;地面(ground/panorama/land)保留本 mode 取色,其显隐由「地面」开关独立控制。零回归:atmosphere 默认开 → 用 base 原值。
		const atmosphereOn = !!(this.layers && this.layers.atmosphere);
		const p = atmosphereOn ? base : {
			...base,
			clear: [0, 0, 0], zenith: [0, 0, 0], sky: [0, 0, 0], horizon: [0, 0, 0],
			glow: [0, 0, 0], glowAlpha: 0, skyGlowAlpha: 0, mistAlpha: 0,
		};
		this.scene.clearColor = new BABYLON.Color4(p.clear[0], p.clear[1], p.clear[2], 1);
		if(this.skyMat){
			this.skyMat.emissiveColor = BABYLON.Color3.White();
		}
		this.updateSkyTexture(p);
		if(this.horizonGlow && this.horizonGlow.material){
			this.horizonGlow.material.emissiveColor = new BABYLON.Color3(p.glow[0], p.glow[1], p.glow[2]);
			this.horizonGlow.material.alpha = p.glowAlpha;
		}
		if(this.groundMat){
			this.groundMat.diffuseColor = new BABYLON.Color3(p.ground[0], p.ground[1], p.ground[2]);
			this.groundMat.emissiveColor = new BABYLON.Color3(p.ground[0], p.ground[1], p.ground[2]);
		}
		if(this.groundDisk && this.groundDisk.material){
			// 脚下圆盘跟随昼夜地面色(与裙边/地形协调)。
			this.groundDisk.material.diffuseColor = new BABYLON.Color3(p.ground[0], p.ground[1], p.ground[2]);
			this.groundDisk.material.emissiveColor = new BABYLON.Color3(p.ground[0], p.ground[1], p.ground[2]);
		}
		if(this.horizonPanorama && this.horizonPanorama.material){
			this.horizonPanorama.material.diffuseColor = new BABYLON.Color3(p.panorama[0], p.panorama[1], p.panorama[2]);
			this.horizonPanorama.material.emissiveColor = new BABYLON.Color3(p.panorama[0], p.panorama[1], p.panorama[2]);
		}
		if(this.horizonMistTexture){
			paintHorizonMistSurface(this.horizonMistTexture.getContext(), 1024, 256, p);
			this.horizonMistTexture.update(false);
		}
		if(this.horizonMist && this.horizonMist.material){
			// 地平大气辉光雾:属大气现象,关大气层即全透明(无辉光)。
			this.horizonMist.material.alpha = atmosphereOn ? (mode === 'day' ? 0.62 : 0.86) : 0;
		}
		(this.landscapeMeshes || []).forEach((mesh, idx)=>{
			const mat = mesh && mesh.material;
			if(mat){
				const scale = idx === 0 ? 1 : (idx === 1 ? 0.72 : 0.86);
				mat.diffuseColor = new BABYLON.Color3(p.land[0] * scale, p.land[1] * scale, p.land[2] * scale);
				mat.emissiveColor = new BABYLON.Color3(p.land[0] * scale, p.land[1] * scale, p.land[2] * scale);
			}
		});
	}

	createCardinals(){
		const group = this.makeGroup('cardinals');
		[
			{ label: '南', azimuth: 0 },
			{ label: '西', azimuth: 90 },
			{ label: '北', azimuth: 180 },
			{ label: '东', azimuth: 270 },
		].forEach((item)=>{
			const plane = this.createTextPlane(item.label, 84, '#d7e9ff', 'rgba(8,16,34,0.1)');
			plane.position = toSkyVector({...item, altitudeAppa: 2}, LINE_RADIUS);
			plane.parent = group;
			plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
			plane.metadata = { labelKind: 'cardinal' };
		});
	}

	createTextPlane(text, size, color, bg){
		const fontPx = size || 48;
		// Super-sample the label texture for devicePixelRatio so text stays crisp on
		// Retina. The old fixed 256x128 canvas was drawn at CSS px then upscaled in 3D,
		// which is what made the labels look fuzzy. The plane size below is unchanged,
		// so the on-screen size of every label is identical to before — only sharper.
		const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
		const factor = clamp(Math.ceil(dpr * 2), 2, 4);
		const baseW = 256;
		const baseH = 128;
		const texW = baseW * factor;
		const texH = baseH * factor;
		const texture = new BABYLON.DynamicTexture(`label-${text}-${Math.random()}`, { width: texW, height: texH }, this.scene, true);
		texture.hasAlpha = true;
		const ctx = texture.getContext();
		ctx.clearRect(0, 0, texW, texH);
		// 仅当显式给出不透明底板时才填(默认不填,避免难看黑框)。
		if(bg && bg !== 'rgba(0,0,0,0)' && bg !== 'transparent'){
			ctx.fillStyle = bg;
			ctx.fillRect(0, 0, texW, texH);
		}
		// 文字用深色描边(halo)代替底板:任意背景都清晰、无方框(成熟星图做法)。
		const fpx = Math.round(fontPx * factor);
		ctx.font = `600 ${fpx}px sans-serif`;
		ctx.textAlign = 'left';
		ctx.textBaseline = 'alphabetic';
		const tw = ctx.measureText(text).width;
		const tx = Math.max(0, (texW - tw) / 2);
		const ty = Math.round(78 * factor);
		ctx.lineJoin = 'round';
		ctx.miterLimit = 2;
		ctx.lineWidth = clamp(Math.round(fpx * 0.13), 3, 9);
		ctx.strokeStyle = 'rgba(3,6,14,0.92)';
		ctx.strokeText(text, tx, ty);
		ctx.fillStyle = color || '#fff';
		ctx.fillText(text, tx, ty);
		texture.update(true);
		texture.updateSamplingMode(BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
		texture.anisotropicFilteringLevel = 8;
		const mat = new BABYLON.StandardMaterial(`label-mat-${text}-${Math.random()}`, this.scene);
		mat.diffuseTexture = texture;
		mat.emissiveTexture = texture;
		mat.opacityTexture = texture;
		mat.disableLighting = true;
		mat.useAlphaFromDiffuseTexture = true;
		mat.disableDepthWrite = true;
		mat.disableDepthTest = true;
		const scale = Math.max(0.9, fontPx / 48);
		const plane = BABYLON.MeshBuilder.CreatePlane(`label-${text}`, { width: 58 * scale, height: 29 * scale }, this.scene);
		plane.material = mat;
		plane.isPickable = false;
		plane.renderingGroupId = 2;
		return plane;
	}

	updateStars(stars){
		if(!stars || !stars.length){
			return;
		}
		this.starFullCatalog = stars; // 全表(供搜索 + 升高星等上限时重建补齐)
		// 按名搜索索引(name/bayer/flamsteed/HR/constellation + 专名表)走全表,纯增量、不改渲染。
		this.starIndex = buildStarIndex(stars);
		// 🚀 构建期星等过滤:只建 mag ≤ 当前上限 的星(默认上限低 → 建星/纹理大减 → 开场更快;非降级,升高上限会重建补齐)。
		stars = this.magLimit >= STAR_MAG_LIMIT_MAX ? stars : stars.filter((s)=>Number(s.mag || 5) <= this.magLimit + 1e-6);
		this.starCatalog = stars;
		this.starBuiltMagLimit = this.magLimit;
		if(this.starPcs && this.starPcs.particles && this.starPcs.particles.length === stars.length && this.starPcs.setParticles){
			stars.forEach((star, idx)=>{
				const particle = this.starPcs.particles[idx];
				if(!particle){
					return;
				}
				const mag = Number(star.mag || 5);
				particle.position = toSkyVector(star, STAR_RADIUS);
				const b = Math.max(0.18, Math.min(1.0, 1.18 - mag / 6.5));
				const c = starTemperatureColor(star, b);
				// 星等过滤:超过上限 → alpha=0 隐藏(默认上限 6.5 = 不设限,无星被隐藏,零回归)。
				const alpha = this.magVisible(mag) ? 1 : 0; // 可见=不透明(亮度在 RGB 已编码);超星等=alpha 0 隐藏(配合 mesh.hasVertexAlpha 才真生效)
				particle.color = new BABYLON.Color4(c.r, c.g, c.b, alpha);
			});
			this.starPcs.setParticles();
			this.updateBrightStars(stars);
			return;
		}
		if(this.starBuildPending){
			return;
		}
		const oldGroup = this.groups.find((group)=>group.name.indexOf('stars-layer') === 0);
		if(oldGroup){
			oldGroup.dispose(false, true);
			this.groups = this.groups.filter((group)=>group !== oldGroup);
		}
		const group = this.makeGroup('stars-layer');
		const pcs = new BABYLON.PointsCloudSystem('star-point-cloud', 1.22, this.scene);
		this.starBuildPending = true;
		pcs.addPoints(stars.length, (particle, idx)=>{
			const star = stars[idx];
			const mag = Number(star.mag || 5);
			particle.position = toSkyVector(star, STAR_RADIUS);
			const b = Math.max(0.18, Math.min(1.0, 1.18 - mag / 6.5));
			const c = starTemperatureColor(star, b);
			// 星等过滤(默认上限 6.5 = 不设限 → 全亮,零回归)。
			const alpha = this.magVisible(mag) ? 1 : 0; // 可见=不透明(亮度在 RGB 已编码);超星等=alpha 0 隐藏(配合 mesh.hasVertexAlpha 才真生效)
			particle.color = new BABYLON.Color4(c.r, c.g, c.b, alpha);
		});
		pcs.buildMeshAsync().then((mesh)=>{
			if(this.disposed || !this.scene){
				return;
			}
			mesh.parent = group;
			mesh.isPickable = false;
			mesh.hasVertexAlpha = true; // 🔴 启用顶点 alpha:否则 per-particle alpha=0(星等过滤)被 Babylon 忽略 → 星等上限滑块全程无效
			this.starPcs = pcs;
			this.starMesh = mesh;
			this.starCount = stars.length;
			this.starBuildPending = false;
			this.applyLayerVisibility();
			this.updateBrightStars(stars);
		}).catch(()=>{
			this.starBuildPending = false;
		});
	}

	updateBrightStars(stars){
		const oldGroup = this.groups.find((group)=>group.name.indexOf('bright-stars-layer') === 0);
		if(oldGroup){
			oldGroup.dispose(false, true);
			this.groups = this.groups.filter((group)=>group !== oldGroup);
		}
		const group = this.makeGroup('bright-stars-layer');
		(stars || []).filter((star)=>Number(star.mag) <= 1.5 && this.magVisible(Number(star.mag))).slice(0, 80).forEach((star)=>{
			const b = Math.max(0.35, Math.min(1.0, 1.18 - Number(star.mag || 0) / 6.5));
			const c = starTemperatureColor(star, b);
			const mesh = BABYLON.MeshBuilder.CreateSphere(`bright-star-${star.id}`, { diameter: 2.4 + b * 4.4, segments: 8 }, this.scene);
			mesh.position = toSkyVector(star, STAR_RADIUS + 2);
			mesh.material = this.material(`bright-star-mat-${star.id}`, new BABYLON.Color3(c.r, c.g, c.b), 0.88);
			mesh.parent = group;
			mesh.metadata = { body: { ...star, displayName: star.name || star.id, layer: 'stars' } };
			this.pickMeshes.push(mesh);
			this.registerProjectableMesh(mesh, star, STAR_RADIUS + 2);
			if(star.name){ this.bodyMeshes[star.name] = mesh; }
			if(star.id){ this.bodyMeshes[star.id] = mesh; }
			if(Number(star.mag) <= 1.1){
				const halo = BABYLON.MeshBuilder.CreateSphere(`bright-star-halo-${star.id}`, { diameter: 8 + b * 12, segments: 12 }, this.scene);
				halo.position.copyFrom(mesh.position);
				halo.material = this.material(`bright-star-halo-mat-${star.id}`, new BABYLON.Color3(c.r, c.g, c.b), 0.1 + b * 0.08);
				halo.material.alphaMode = BABYLON.Engine.ALPHA_ADD;
				halo.parent = group;
				halo.isPickable = false;
				halo.renderingGroupId = 1;
				this.registerFollowerMesh(halo, star.id, ()=>BABYLON.Vector3.Zero());
			}
		});
		// 🔴 幽灵星修复:亮星组在 updateStars 慢路径(buildMeshAsync.then 于 applyLayerVisibility 之后)与
		//   快路径(setParticles 后、updateData 末尾 applyLayerVisibility 已跑完)皆建于门控之后 → 建完不再显隐,
		//   恒星层默认关时亮星仍可见(且位置停在旧投影=错位),首次交互才隐藏。此处建完即按当前开关门控,
		//   与 stars-layer 点云同受 layers.stars 控,根治「默认关却显示错位亮星 / 点任意键才消失」。
		group.setEnabled(!!(this.layers && this.layers.stars));
	}

	createLine(name, points, color, alpha, parent, radius, projectable = false){
		if(!points || points.length < 2){
			return null;
		}
		const vectors = points.map((p)=>toSkyVector(p, radius || LINE_RADIUS));
		const line = BABYLON.MeshBuilder.CreateLines(name, { points: vectors, updatable: true }, this.scene);
		line.color = color;
		line.alpha = alpha === undefined ? 1 : alpha;
		line.parent = parent;
		line.isPickable = false;
		if(projectable){
			this.registerProjectableLine(line, points, radius || LINE_RADIUS);
		}
		return line;
	}

	createShortRadialLine(name, item, color, alpha, parent, outerRadius, innerRadius, projectable = false){
		if(!item){
			return null;
		}
		const p1 = toSkyVector(item, outerRadius);
		const p2 = toSkyVector(item, innerRadius);
		const line = BABYLON.MeshBuilder.CreateLines(name, { points: [p1, p2], updatable: true }, this.scene);
		line.color = color;
		line.alpha = alpha;
		line.parent = parent;
		line.isPickable = false;
		if(projectable){
			this.registerProjectableLine(line, [item], outerRadius, innerRadius);
		}
		return line;
	}

	// 通用坐标网格工厂(地平/赤道/黄道共用)。cfg.toAltAz(u,v,jd,obs,refr) 必须返回带
	// ra/decl 的点(地平网格 projectable:false 除外),否则时间推进时网格会冻结(§3.4)。
	createCoordinateGrid(cfg){
		const group = this.makeGroup(cfg.groupName);
		const obs = observerFromData(cfg.observer);
		const jd = (obs && obs.jd) || 2451545;
		const refr = this.refractionActive();
		const density = cfg.density || 96;
		const baseAlpha = cfg.alpha;
		// P3①「极点淡出」:高纬纬圈(|v|≥50)在天极附近挤成结 → 仅按纬度递减其 alpha(只变淡、不改几何/密度),
		// 赤道(v=0)与中低纬一字不动 → 默认观感不变、极区更干净。opt-in,三网格默认开。
		const polarFade = (v)=>{
			if(!cfg.polarFade){ return 1; }
			const a = Math.abs(v);
			if(a <= 50){ return 1; }
			return Math.max(0.34, 1 - ((a - 50) / 50) * 0.6);
		};
		// 经圈(固定经度 u,沿纬度 v 扫):
		for(let u = 0; u < 360; u += cfg.meridianStep){
			const pts = [];
			const vs = (cfg.vRange[1] - cfg.vRange[0]) / density;
			for(let v = cfg.vRange[0]; v <= cfg.vRange[1] + 1e-9; v += vs){
				pts.push(cfg.toAltAz(u, v, jd, obs, refr));
			}
			const principal = (u % 90 === 0);
			// P3②「子午/分至圈强调」:过原点的经圈(本初子午 / 二分二至圈)略加亮(×1.15,封顶 1),命名 -colure 便于区分。
			const isColure = !!cfg.emphasizeColure && (u % 180 === 0);
			let mAlpha = principal ? baseAlpha : baseAlpha * 0.6;
			if(isColure){ mAlpha = Math.min(1, mAlpha * 1.15); }
			const line = this.createLine(`${cfg.groupName}-mer-${u}${isColure ? '-colure' : ''}`, pts, cfg.color, mAlpha, group, cfg.radius, cfg.projectable);
			// P2:非主经圈(不含 0/90/180/270 与分至圈)在缩小视场时可淡出;主圈/分至圈恒定。
			if(line){ line.metadata = { gridKey: cfg.layerKey, baseAlpha: mAlpha, lodFine: (!principal && !isColure) }; }
		}
		// 纬圈(固定纬度 v,沿经度扫;跳 ±90 退化点 + skipPrincipal 去与主圈重合的纬圈):
		for(let v = cfg.vRange[0] + cfg.parallelStep; v < cfg.vRange[1]; v += cfg.parallelStep){
			if(cfg.skipPrincipal !== undefined && Math.abs(v - cfg.skipPrincipal) < 1e-6){ continue; }
			const pts = [];
			const us = 360 / density;
			for(let u = 0; u <= 360 + 1e-9; u += us){
				pts.push(cfg.toAltAz(u % 360, v, jd, obs, refr));
			}
			const pAlpha = (v === 0 ? baseAlpha : baseAlpha * 0.55) * polarFade(v);
			const line = this.createLine(`${cfg.groupName}-par-${Math.round(v)}`, pts, cfg.color, pAlpha, group, cfg.radius, cfg.projectable);
			// P2 密度自适应:把最密的「细纬圈」(非赤道、非 ±30/±60 主纬)标记为可 LOD,记录基准 alpha。
			// 缩小视场(放大)= 维持原样;扩大视场(缩小)才把细纬圈淡出,避免过密。默认 FOV 不触碰(零回归)。
			if(line){
				const isFineParallel = (v !== 0) && (Math.abs(v % 30) > 1e-6);
				line.metadata = { gridKey: cfg.layerKey, baseAlpha: pAlpha, lodFine: isFineParallel };
			}
		}
		return group;
	}

	// 四主圈刻度工厂(赤道时标/黄道度标/方位刻度/子午高度刻度)。cfg.toAnchor(a,jd,obs,refr)
	// 返回带 ra/decl 的锚点(projectable 时);非 projectable 锚点只需 altitudeAppa/azimuth。
	// 主圈刻度(成熟星图样式):与该环同色的小格刻度(minor 短 / major 长)紧贴环线 +
	// 主刻度处读数。cfg.minorStep=小格间隔、cfg.step=主刻度/读数间隔、cfg.tickColor=环色。
	// 与黄道/赤道分别同色 + 紧贴 → 一眼区分,且明显有别于 30° 宫位扇区线。projectable 环随天转。
	createCircleScale(cfg){
		const group = this.makeGroup(cfg.groupName);
		const obs = observerFromData(cfg.observer);
		const jd = (obs && obs.jd) || 2451545;
		const refr = this.refractionActive();
		const r0 = cfg.baseRadius;
		const minorStep = cfg.minorStep || cfg.step;
		const lo = cfg.range ? cfg.range[0] : 0;
		const hi = cfg.range ? cfg.range[1] : 360 - minorStep;
		const minorLen = 5;
		const majorLen = 12;
		const tickColor = cfg.tickColor || new BABYLON.Color3(0.6, 0.7, 0.95);
		// 小格刻度:从环线(r0)向外伸出,major 更长更亮;紧贴环线(内端 r0-1 略压线)。
		for(let a = lo; a <= hi + 1e-9; a += minorStep){
			const isMajor = Math.abs(((a % cfg.step) + cfg.step) % cfg.step) < 1e-6;
			const anchor = cfg.toAnchor(a, jd, obs, refr);
			if(!anchor){ continue; }
			this.createShortRadialLine(`${cfg.groupName}-tick-${Math.round(a * 10)}`, anchor, tickColor, isMajor ? 0.95 : 0.55, group, r0 + (isMajor ? majorLen : minorLen), r0 - 1, cfg.projectable);
		}
		// 读数:贴在小格之外,字号大 + 淡底板提升清晰度。
		const labelR = r0 + majorLen + 9;
		for(let a = lo; a <= hi + 1e-9; a += cfg.step){
			const text = cfg.labelFor ? cfg.labelFor(a) : null;
			if(!text){ continue; }
			const anchor = cfg.toAnchor(a, jd, obs, refr);
			if(!anchor){ continue; }
			const proj = cfg.projectable ? projectedEquatorialItem(anchor, jd, obs, refr) : anchor;
			const plane = this.createTextPlane(text, cfg.fontPx || 32, cfg.labelColor || '#cdd9f2', 'rgba(0,0,0,0)');
			plane.position = toSkyVector(proj, labelR);
			plane.parent = group;
			plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
			plane.metadata = { labelKind: 'scaleNum' };
			if(cfg.projectable && Number.isFinite(Number(proj.ra))){ this.registerProjectableMesh(plane, { ra: proj.ra, decl: proj.decl }, labelR); }
		}
		return group;
	}

	// 坐标数字标尺:与赤道/黄道主圈刻度同一标准(小格每 10°、主刻度+读数、与网格同色、字号清晰)。
	// · 赤道/黄道:本初经圈(ra/lon=0)上的赤纬/黄纬刻度(projectable 随天转)。
	// · 地平(P1):沿地平圈每 30° 标方位度数(0=N/90=E/180=S/270=W),固定不随天转;
	//   与既有 N/E/S/W 大字方位字互补(标度数,不重复字母)。三者同受 coordLabels 双 gate。
	createGridLabels(cfg){
		const obs = observerFromData(cfg.observer);
		const jd = (obs && obs.jd) || 2451545;
		const refr = this.refractionActive();
		const radius = cfg.radius;
		const isEq = cfg.kind === 'equatorial';
		const isEc = cfg.kind === 'ecliptic';
		const gateH = !!this.layers[cfg.gridKey] && !!this.layers.coordLabels;
		if(cfg.kind === 'horizontal'){
			// 地平网格度数标注(对标专业星图):每 30° 一枚方位度数,贴地平圈外缘、略抬出地平线防被地遮。
			const tickColorH = cfg.tickColor || new BABYLON.Color3(0.42, 0.78, 0.62);
			for(let az = 0; az < 360; az += 30){
				const anchorAlt = 2; // 略抬出地平线,贴地平圈
				const tk = this.createShortRadialLine(`${cfg.gridKey}-aztick-${az}`, { altitudeAppa: anchorAlt, azimuth: az }, tickColorH, (az % 90 === 0) ? 0.9 : 0.5, cfg.group, radius + ((az % 90 === 0) ? 12 : 6), radius - 1, false);
				if(tk){ tk.metadata = { labelKind: 'gridCoord', gridKey: cfg.gridKey }; tk.setEnabled(gateH); }
				const plane = this.createTextPlane(`${az}°`, 30, cfg.color, 'rgba(0,0,0,0)');
				plane.position = toSkyVector({ altitudeAppa: anchorAlt, azimuth: az }, radius + 22);
				plane.parent = cfg.group;
				plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
				plane.metadata = { labelKind: 'gridCoord', gridKey: cfg.gridKey };
				plane.setEnabled(gateH);
			}
			return;
		}
		if(!isEq && !isEc){ return; }
		const tickColor = cfg.tickColor || new BABYLON.Color3(0.6, 0.7, 0.95);
		const degTxt = (d)=> (d > 0 ? `+${d}` : `${d}`) + '°';
		const toEq = (lat)=>{ if(isEq){ return { ra: 0, decl: lat }; } const e = eclipticToEquatorial(0, lat, jd); return e ? { ra: e.ra, decl: e.decl } : null; };
		const majors = { '30': 1, '60': 1, '-30': 1, '-60': 1 };
		const gate = !!this.layers[cfg.gridKey] && !!this.layers.coordLabels;
		for(let lat = -80; lat <= 80 + 1e-9; lat += 10){
			if(Math.abs(lat) < 1e-6){ continue; } // 赤道/黄道本身(纬度 0)由主圈刻度负责
			const src = toEq(lat);
			if(!src){ continue; }
			const isMajor = !!majors[`${lat}`];
			const proj = projectedEquatorialItem(src, jd, obs, refr);
			const tk = this.createShortRadialLine(`${cfg.gridKey}-lattick-${lat}`, proj, tickColor, isMajor ? 0.9 : 0.5, cfg.group, radius + (isMajor ? 12 : 6), radius - 1, true);
			if(tk){ tk.metadata = { labelKind: 'gridCoord', gridKey: cfg.gridKey }; tk.setEnabled(gate); }
			if(isMajor){
				const plane = this.createTextPlane(degTxt(lat), 32, cfg.color, 'rgba(0,0,0,0)');
				plane.position = toSkyVector(proj, radius + 21);
				plane.parent = cfg.group;
				plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
				plane.metadata = { labelKind: 'gridCoord', gridKey: cfg.gridKey };
				plane.setEnabled(gate);
				this.registerProjectableMesh(plane, src, radius + 21);
			}
		}
	}

	createOverlayLines(overlays, observer){
		const normalizedObserver = observerFromData(observer);
		const group = this.makeGroup('overlay-layer');
		this.createLine('horizon', overlays.horizon && overlays.horizon.points, new BABYLON.Color3(0.48, 0.82, 0.96), 0.5, group, LINE_RADIUS);
		this.createLine('meridian', overlays.meridian && overlays.meridian.points, new BABYLON.Color3(0.48, 0.68, 0.88), 0.18, group, LINE_RADIUS - 2);
		this.createLine('equator', overlays.equator && overlays.equator.points, new BABYLON.Color3(0.42, 0.54, 0.92), 0.2, group, LINE_RADIUS - 4, true);
		this.createLine('ecliptic', overlays.ecliptic && overlays.ecliptic.points, new BABYLON.Color3(1.0, 0.7, 0.22), 0.82, group, LINE_RADIUS + 14, true);
		(overlays.houses || []).forEach((item)=>{
			this.createShortRadialLine(`house-${item.id}`, item, new BABYLON.Color3(0.48, 0.82, 0.68), 0.22, group, LINE_RADIUS + 20, LINE_RADIUS - 46, true);
		});
		this.createHouseLabels(overlays.houses || [], normalizedObserver, group);
		this.createZodiacSectors(overlays.zodiac || [], normalizedObserver);
	}

	createHouseLabels(houses, observer, parent){
		const list = (houses || []).filter((item)=>item && Number.isFinite(Number(item.lon)));
		if(list.length < 2){
			return;
		}
		const radius = LINE_RADIUS - 12;
		const jd = observer && observer.jd ? observer.jd : 2451545;
		list.forEach((item, idx)=>{
			const next = list[(idx + 1) % list.length];
			if(!next || !Number.isFinite(Number(next.lon))){
				return;
			}
			const label = houseDisplayName(item, idx);
			const labelLon = circularMidpoint(item.lon, next.lon);
			const eq = eclipticToEquatorial(labelLon, 0, jd) || { ra: labelLon, decl: 0 };
			const source = {
				id: `house-label-${idx + 1}`,
				name: label,
				lon: labelLon,
				lat: 0,
				ra: eq.ra,
				decl: eq.decl,
			};
			const projected = projectedEquatorialItem(source, jd, observer || { lat: 0, lon: 0 });
			const text = this.createTextPlane(label, 48, '#d7ffe4', 'rgba(0,0,0,0)');
			text.name = `house-label-${idx + 1}`;
			text.position = toSkyVector(projected, radius);
			text.parent = parent;
			text.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
			text.metadata = { labelKind: 'houseSector' };
			text.setEnabled(this.viewMode === 'orbit' || Number(projected && projected.altitudeAppa) > 0);
			this.registerProjectableMesh(text, source, radius, {
				visibilityMode: 'sourceAbove',
				lastProjectedSource: projected,
			});
		});
	}

	createZodiacSectors(zodiacItems, observer){
		if(!zodiacItems || !zodiacItems.length){
			return;
		}
		const group = this.makeGroup('zodiac-sector-layer');
		const labelRadius = LINE_RADIUS + 30;
		zodiacItems.forEach((item, idx)=>{
			const points = item && item.points ? item.points : [];
			if(points.length < 2){
				return;
			}
			const label = item.label || `星座${idx + 1}`;
			const anchor = preferredVisiblePoint(points) || points[Math.floor(points.length / 2)];
			const anchorLon = Number(anchor && anchor.lon);
			const labelLon = Number.isFinite(anchorLon)
				? anchorLon
				: (Number.isFinite(Number(item.startLon)) && Number.isFinite(Number(item.endLon))
					? circularMidpoint(item.startLon, item.endLon)
					: 0);
			const labelLat = 2.2;
			const jd = observer && observer.jd ? observer.jd : 2451545;
			const eq = eclipticToEquatorial(labelLon, labelLat, jd) || { ra: labelLon, decl: 0 };
			const labelSource = {
				lon: labelLon,
				lat: labelLat,
				ra: eq.ra,
				decl: eq.decl,
				name: `${label}座`,
			};
			const text = this.createTextPlane(`${label}座`, 52, '#ffe9a8', 'rgba(0,0,0,0)');
			text.position = toSkyVector(projectedEquatorialItem(labelSource, jd, observer || { lat: 0, lon: 0 }), labelRadius);
			text.parent = group;
			text.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
			text.metadata = { labelKind: 'zodiacSector' };
			this.registerProjectableMesh(text, labelSource, labelRadius);
		});
	}

	// 泛化的天极标记(天/黄/银极共用),由 createNorthCelestialPole 演化而来:逐字保留
	// marker/halo/十字/标签,仅参数化 id/name/坐标/颜色。十字仅在 |decl|≈90 时画(天极)。
	createPole(cfg){
		const obs = observerFromData(cfg.observer);
		const jd = (obs && obs.jd) || 2451545;
		const group = cfg.group;
		const radius = cfg.radius || (LINE_RADIUS + 86);
		let ra = cfg.ra;
		let decl = cfg.decl;
		if((ra === undefined || decl === undefined) && cfg.lon !== undefined){
			const eq = eclipticToEquatorial(cfg.lon, cfg.lat || 0, jd);
			if(eq){ ra = eq.ra; decl = eq.decl; }
		}
		const source = { id: cfg.id, name: cfg.name, ra, decl };
		const projected = projectedEquatorialItem(source, jd, obs);
		const position = toSkyVector(projected, radius);
		const color = cfg.color || new BABYLON.Color3(0.7, 0.92, 1);
		const haloColor = cfg.haloColor || color;
		const labelColor = cfg.labelColor || '#dff7ff';

		const marker = BABYLON.MeshBuilder.CreateSphere(`${cfg.id}-marker`, { diameter: 18, segments: 24 }, this.scene);
		marker.position.copyFrom(position);
		marker.material = this.material(`${cfg.id}-marker-mat`, color, 0.96);
		marker.parent = group;
		marker.isPickable = false;
		marker.renderingGroupId = 2;
		marker.metadata = { poleId: cfg.id };
		this.registerProjectableMesh(marker, source, radius);

		const halo = BABYLON.MeshBuilder.CreateSphere(`${cfg.id}-halo`, { diameter: 46, segments: 24 }, this.scene);
		halo.position.copyFrom(position);
		halo.material = this.material(`${cfg.id}-halo-mat`, haloColor, 0.22);
		halo.material.alphaMode = BABYLON.Engine.ALPHA_ADD;
		halo.parent = group;
		halo.isPickable = false;
		halo.renderingGroupId = 1;
		halo.metadata = { poleId: cfg.id };
		this.registerFollowerMesh(halo, `${cfg.id}-marker`, ()=>BABYLON.Vector3.Zero());
		this.bodyMeshes[`${cfg.id}-marker`] = marker;

		const drawCross = (cfg.drawCross !== undefined) ? cfg.drawCross : (Math.abs(decl) >= 89.5);
		if(drawCross){
			const crossColor = cfg.crossColor || new BABYLON.Color3(0.8, 0.96, 1);
			const crossDecl = decl - Math.sign(decl) * 1.6; // NCP 90→88.4;SCP −90→−88.4
			const mk = (ang)=>projectedEquatorialItem({ ra: ang, decl: crossDecl }, jd, obs);
			const horizontal = this.createLine(`${cfg.id}-cross-horizontal`, [mk(350), mk(10)], crossColor, 0.72, group, radius + 2, true);
			if(horizontal){ horizontal.renderingGroupId = 2; horizontal.metadata = { poleId: cfg.id }; }
			const vertical = this.createLine(`${cfg.id}-cross-vertical`, [mk(90), mk(270)], crossColor, 0.72, group, radius + 2, true);
			if(vertical){ vertical.renderingGroupId = 2; vertical.metadata = { poleId: cfg.id }; }
		}

		const label = this.createTextPlane(cfg.name, 40, labelColor, 'rgba(0,0,0,0)');
		label.position = position.add(new BABYLON.Vector3(0, 34, 0));
		label.parent = group;
		label.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
		label.metadata = { labelKind: 'pole', poleId: cfg.id };
		this.registerFollowerMesh(label, `${cfg.id}-marker`, ()=>new BABYLON.Vector3(0, 34, 0));
		return marker;
	}

	createPoles(observer){
		const obs = observerFromData(observer);
		const jd = (obs && obs.jd) || 2451545;
		const g = this.makeGroup('pole-layer');
		const blue = new BABYLON.Color3(0.7, 0.92, 1);
		const gold = new BABYLON.Color3(0.95, 0.78, 0.4);
		const magenta = new BABYLON.Color3(0.78, 0.55, 0.95);
		this.createPole({ id: 'north-celestial-pole', name: '北天极', ra: 0, decl: 90, color: blue, group: g, observer });
		this.createPole({ id: 'south-celestial-pole', name: '南天极', ra: 0, decl: -90, color: blue, group: g, observer });
		const nep = eclipticToEquatorial(0, 90, jd);
		const sep = eclipticToEquatorial(0, -90, jd);
		if(nep){ this.createPole({ id: 'north-ecliptic-pole', name: '北黄极', ra: nep.ra, decl: nep.decl, color: gold, labelColor: '#ffe6a8', group: g, observer }); }
		if(sep){ this.createPole({ id: 'south-ecliptic-pole', name: '南黄极', ra: sep.ra, decl: sep.decl, color: gold, labelColor: '#ffe6a8', group: g, observer }); }
		this.createPole({ id: 'north-galactic-pole', name: '北银极', ra: 192.85948, decl: 27.12825, color: magenta, labelColor: '#f0d4ff', group: g, observer });
		this.createPole({ id: 'south-galactic-pole', name: '南银极', ra: 12.85948, decl: -27.12825, color: magenta, labelColor: '#f0d4ff', group: g, observer });
		return g;
	}

	createGalacticEquator(observer){
		const obs = observerFromData(observer);
		const jd = (obs && obs.jd) || 2451545;
		const group = this.makeGroup('galactic-layer');
		const pts = [];
		for(let l = 0; l <= 360 + 1e-9; l += 3){
			const e = galacticToEquatorial(l % 360, 0);
			pts.push(projectedEquatorialItem({ ra: e.ra, decl: e.decl }, jd, obs));
		}
		this.createLine('galactic-equator', pts, new BABYLON.Color3(0.7, 0.78, 0.95), 0.45, group, LINE_RADIUS + 8, true);
		return group;
	}

	// 银河带(程序化,无需贴图):沿银道大圆两侧 ±~8° 叠多条等银纬平行淡线成「带」,
	// alpha 由带心(b=0)向边缘渐隐 → 柔和发光带。坐标全走 galacticToEquatorial→projectedEquatorialItem→toSkyVector
	// 与银道线同一真实赤道管线(纯天文:无 zodiacal/宿度/岁差污染),随时间/观测点重投影。默认关,零回归。
	createMilkyWay(observer){
		const obs = observerFromData(observer);
		const jd = (obs && obs.jd) || 2451545;
		const refr = this.refractionActive();
		const group = this.makeGroup('milkyway-layer');
		const HALF_WIDTH_DEG = 8; // 带半宽(银纬),拢成 ~16° 宽的银河带
		const STEPS = 11; // 每侧 + 带心的等银纬线条数(奇数:含 b=0)
		const baseColor = new BABYLON.Color3(0.62, 0.7, 0.92);
		for(let s = 0; s < STEPS; s += 1){
			const frac = STEPS > 1 ? (s / (STEPS - 1)) : 0.5; // 0..1
			const b = (frac * 2 - 1) * HALF_WIDTH_DEG; // -HALF..+HALF 银纬
			// 越靠带心越亮、越靠边缘越淡(余弦渐隐 → 柔和无硬边)。带心 alpha 也压低保「柔和」。
			const edge = Math.abs(b) / HALF_WIDTH_DEG; // 0(心)..1(缘)
			const alpha = 0.16 * Math.pow(Math.cos(edge * Math.PI / 2), 1.4);
			if(alpha < 0.01){ continue; }
			const pts = [];
			for(let l = 0; l <= 360 + 1e-9; l += 3){
				const e = galacticToEquatorial(l % 360, b);
				pts.push(projectedEquatorialItem({ ra: e.ra, decl: e.decl }, jd, obs, refr));
			}
			this.createLine(`milkyway-band-${s}`, pts, baseColor, alpha, group, LINE_RADIUS + 6, true);
		}
		return group;
	}

	// 三垣垣墙(D2)。数据来自 src/data/sanyuanWalls.json(待权威底本);空坐标 = 图层留壳、不画。
	createEnclosures(observer){
		const group = this.makeGroup('sanyuan-layer');
		const obs = observerFromData(observer);
		const jd = (obs && obs.jd) || 2451545;
		const refr = this.refractionActive();
		((SANYUAN_WALLS && SANYUAN_WALLS.walls) || []).forEach((wall)=>{
			const stars = (wall.stars || []).filter((s)=>Number.isFinite(Number(s.ra)) && Number.isFinite(Number(s.decl)));
			if(stars.length < 2){ return; }
			const pts = stars.map((s)=>projectedEquatorialItem({ ra: s.ra, decl: s.decl }, jd, obs, refr));
			const line = this.createLine(`sanyuan-${wall.key}`, pts, new BABYLON.Color3(0.78, 0.6, 0.95), 0.6, group, LINE_RADIUS + 38, true);
			if(line){ line.metadata = { enclosure: wall.key }; }
			const label = this.createTextPlane(wall.name, 30, '#e6d4ff', 'rgba(0,0,0,0)');
			label.position = toSkyVector(pts[0], LINE_RADIUS + 44);
			label.parent = group;
			label.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
			label.metadata = { labelKind: 'enclosure' };
			this.registerProjectableMesh(label, { ra: stars[0].ra, decl: stars[0].decl }, LINE_RADIUS + 44);
		});
		return group;
	}

	// 完整星官(312,旗舰)。数据 src/data/chineseAsterisms.json:每条星官 stars[{ra,decl,mag}] + lines[[i,j]],
	// ra/decl = J2000 真赤道十进制度。🔴纯天文铁律:坐标全走真实 ra/decl → projectedEquatorialItem → toSkyVector
	// (projectable 随天转),无 zodiacal/宿度制/岁差污染。按 group/symbol 四象三垣配色;每星官在其最亮星(mag 最小)
	// 处贴名 billboard。line.metadata.layerKey='xingguan' 供 layerAllowsMesh 在重投影时门控(隐藏即跳过重建)。
	// 星官(312)懒构建:默认关不建(省开场近半网格);开层时建一次(_asterismsBuilt 守,非降级、默认零回归)。
	ensureChineseAsterismsBuilt(){
		if(this._asterismsBuilt){ return; }
		this._asterismsBuilt = true;
		this.createChineseAsterisms((this.lastData && this.lastData.observer) || {});
		this.applyLayerVisibility();
	}

	createChineseAsterisms(observer){
		const group = this.makeGroup('asterism-xingguan-layer');
		const obs = observerFromData(observer);
		const jd = (obs && obs.jd) || 2451545;
		const refr = this.refractionActive();
		const radius = LINE_RADIUS + 26; // 略内于三垣墙(+38),与西方星座连线(+18)分层
		const labelRadius = radius + 8;
		const asterisms = (CHINESE_ASTERISMS && CHINESE_ASTERISMS.asterisms) || [];
		asterisms.forEach((item, ai)=>{
			const stars = (item.stars || []).filter((s)=>Number.isFinite(Number(s.ra)) && Number.isFinite(Number(s.decl)));
			if(!stars.length){ return; }
			const color = asterismColor(item);
			// 连线:逐 [i,j] 连成员星(用原始 stars 索引,过滤前的下标)。
			(item.lines || []).forEach((seg, si)=>{
				if(!Array.isArray(seg) || seg.length < 2){ return; }
				const a = (item.stars || [])[seg[0]];
				const b = (item.stars || [])[seg[1]];
				if(!a || !b || !Number.isFinite(Number(a.ra)) || !Number.isFinite(Number(a.decl)) || !Number.isFinite(Number(b.ra)) || !Number.isFinite(Number(b.decl))){ return; }
				const pts = [
					projectedEquatorialItem({ ra: a.ra, decl: a.decl }, jd, obs, refr),
					projectedEquatorialItem({ ra: b.ra, decl: b.decl }, jd, obs, refr),
				];
				const line = this.createLine(`asterism-xingguan-${ai}-${si}`, pts, color, 0.62, group, radius, true);
				if(line){ line.metadata = { layerKey: 'xingguan' }; }
			});
			// 名:贴在最亮星(mag 最小)处;无 mag 取首星。
			let anchor = stars[0];
			let minMag = Number(stars[0].mag);
			stars.forEach((s)=>{ const m = Number(s.mag); if(Number.isFinite(m) && (!Number.isFinite(minMag) || m < minMag)){ minMag = m; anchor = s; } });
			const name = item.name || item.pinyin || '';
			if(name){
				const labelSrc = { ra: anchor.ra, decl: anchor.decl };
				const plane = this.createTextPlane(name, 24, '#dbe6f5', 'rgba(0,0,0,0)');
				plane.position = toSkyVector(projectedEquatorialItem(labelSrc, jd, obs, refr), labelRadius);
				plane.parent = group;
				plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
				plane.metadata = { labelKind: 'xingguan', layerKey: 'xingguan' };
				this.registerProjectableMesh(plane, labelSrc, labelRadius);
			}
		});
		return group;
	}

	// 行星视运动轨迹(planetTrails)。数据来自后端 data.trails([{id,name,points:[{offsetDays,ra,decl,...}]}],
	// 当日历元真赤道,与 bodies 同口径)。每星一条 polyline,按该 body 颜色;projectable 随天转。轨迹必过当前星位
	// (offset0 在点列)。line.metadata.layerKey='planetTrails' 供 layerAllowsMesh 门控。仅在 data.trails 存在时绘制
	// (= 仅开启该层并带 includeTrails 重取后);默认无 trails → 留壳零开销。
	createPlanetTrails(data){
		const group = this.makeGroup('asterism-trails-layer');
		const obs = observerFromData(data && data.observer);
		const jd = (obs && obs.jd) || 2451545;
		const refr = this.refractionActive();
		const trails = (data && Array.isArray(data.trails)) ? data.trails : [];
		trails.forEach((trail, ti)=>{
			const pointsRaw = (trail && Array.isArray(trail.points)) ? trail.points : [];
			const pts = pointsRaw
				.filter((p)=>p && Number.isFinite(Number(p.ra)) && Number.isFinite(Number(p.decl)))
				.map((p)=>projectedEquatorialItem({ ra: p.ra, decl: p.decl }, jd, obs, refr));
			if(pts.length < 2){ return; }
			const color = BODY_COLORS[trail.id] || new BABYLON.Color3(0.7, 0.78, 0.92);
			const line = this.createLine(`asterism-trail-${trail.id || ti}`, pts, color, 0.62, group, LINE_RADIUS + 6, true);
			if(line){ line.metadata = { layerKey: 'planetTrails', body: { displayName: trail.name || trail.id } }; }
		});
		return group;
	}

	// 西方 88 星座连线(E2)。数据来自 src/data/constellationLines.json(待权威开放数据集);空 = 留壳。
	createConstellationLines(observer){
		const group = this.makeGroup('constellation-line-layer');
		const obs = observerFromData(observer);
		const jd = (obs && obs.jd) || 2451545;
		const refr = this.refractionActive();
		((CONSTELLATION_LINES && CONSTELLATION_LINES.constellations) || []).forEach((c)=>{
			(c.lines || []).forEach((seg, idx)=>{
				const stars = (seg || []).filter((s)=>Number.isFinite(Number(s.ra)) && Number.isFinite(Number(s.decl)));
				if(stars.length < 2){ return; }
				const pts = stars.map((s)=>projectedEquatorialItem({ ra: s.ra, decl: s.decl }, jd, obs, refr));
				this.createLine(`constellation-${c.abbr || 'x'}-${idx}`, pts, new BABYLON.Color3(0.5, 0.62, 0.85), 0.35, group, LINE_RADIUS + 18, true);
			});
		});
		return group;
	}

	// IAU 星座边界(E2,可选)。数据来自 src/data/constellationBounds.json;空 = 留壳。
	createConstellationBounds(observer){
		const group = this.makeGroup('constellation-bound-layer');
		const obs = observerFromData(observer);
		const jd = (obs && obs.jd) || 2451545;
		const refr = this.refractionActive();
		((CONSTELLATION_BOUNDS && CONSTELLATION_BOUNDS.constellations) || []).forEach((c)=>{
			(c.lines || []).forEach((seg, idx)=>{
				const stars = (seg || []).filter((s)=>Number.isFinite(Number(s.ra)) && Number.isFinite(Number(s.decl)));
				if(stars.length < 2){ return; }
				const pts = stars.map((s)=>projectedEquatorialItem({ ra: s.ra, decl: s.decl }, jd, obs, refr));
				this.createLine(`constellation-bound-${c.abbr || 'x'}-${idx}`, pts, new BABYLON.Color3(0.45, 0.5, 0.6), 0.22, group, LINE_RADIUS + 16, true);
			});
		});
		return group;
	}

	// 亮星专名(E3)。坐标取自既有星表,名取自 STAR_PROPER_NAMES;仅标有专名的亮星(克制密度)。
	createStarNames(stars, observer){
		const group = this.makeGroup('starname-layer');
		const obs = observerFromData(observer);
		const jd = (obs && obs.jd) || 2451545;
		const refr = this.refractionActive();
		(stars || []).forEach((star)=>{
			if(!star || !Number.isFinite(Number(star.ra)) || !Number.isFinite(Number(star.decl))){ return; }
			if(Number(star.mag) > 2.6){ return; }
			const name = starProperName(star);
			if(!name){ return; }
			const proj = projectedEquatorialItem({ ra: star.ra, decl: star.decl }, jd, obs, refr);
			const plane = this.createTextPlane(name, 26, '#cfe0ff', 'rgba(0,0,0,0)');
			plane.position = toSkyVector(proj, STAR_RADIUS + 8);
			plane.parent = group;
			plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
			plane.metadata = { labelKind: 'starName' };
			this.registerProjectableMesh(plane, { ra: star.ra, decl: star.decl }, STAR_RADIUS + 8);
		});
		return group;
	}

	// 岁差圈(F1):北天极绕北黄极 26000 年画的圈 = 黄纬 (90−ε) 的纬圈;并标当前北天极在圈上的点。
	createPrecessionCircle(observer){
		const group = this.makeGroup('precession-layer');
		const obs = observerFromData(observer);
		const jd = (obs && obs.jd) || 2451545;
		const refr = this.refractionActive();
		const beta = 90 - meanObliquityDeg(jd);
		const pts = [];
		for(let l = 0; l <= 360 + 1e-9; l += 4){
			const e = eclipticToEquatorial(l % 360, beta, jd);
			if(e){ pts.push(projectedEquatorialItem({ ra: e.ra, decl: e.decl }, jd, obs, refr)); }
		}
		this.createLine('precession-circle', pts, new BABYLON.Color3(0.66, 0.6, 0.86), 0.5, group, LINE_RADIUS + 12, true);
		const ncp = projectedEquatorialItem({ ra: 0, decl: 90 }, jd, obs, refr);
		const marker = BABYLON.MeshBuilder.CreateSphere('precession-ncp-mark', { diameter: 10, segments: 16 }, this.scene);
		marker.position = toSkyVector(ncp, LINE_RADIUS + 12);
		marker.material = this.material('precession-ncp-mark-mat', new BABYLON.Color3(0.82, 0.76, 0.96), 0.9);
		marker.parent = group;
		marker.isPickable = false;
		marker.renderingGroupId = 2;
		this.registerProjectableMesh(marker, { ra: 0, decl: 90 }, LINE_RADIUS + 12);
		return group;
	}

	// 日行迹(F2,近似):全年逐 ~15 天、固定当前时刻取太阳地平位置 → 观测者天空的八字形(observer-fixed)。
	createAnalemma(observer, jdOverride){
		const group = this.makeGroup('analemma-layer');
		const obs = observerFromData(observer);
		// jd0 优先用显式传入的当前显示时刻(播放/步进重建);否则取观测点时刻(初次构建时=显示时刻)。
		const jd0 = (typeof jdOverride === 'number' && Number.isFinite(jdOverride)) ? jdOverride : ((obs && obs.jd) || 2451545);
		const refr = this.refractionActive();
		const pts = [];
		for(let k = 0; k < 24; k += 1){
			const jdk = jd0 + Math.round(k * 365.2422 / 24); // 整天偏移 → 保持同一时刻(八字形成立)
			const lon = sunEclipticLongitude(jdk);
			const e = eclipticToEquatorial(lon, 0, jdk);
			if(!e){ continue; }
			const pos = equatorialToHorizontal(e.ra, e.decl, jdk, obs, refr);
			if(pos){ pts.push({ altitudeAppa: pos.altitudeAppa, azimuth: pos.azimuth }); }
		}
		if(pts.length > 1){ pts.push(pts[0]); } // 闭合八字
		this.createLine('analemma', pts, new BABYLON.Color3(1.0, 0.82, 0.4), 0.7, group, LINE_RADIUS + 4, false);
		return group;
	}

	// 日行迹按最新时刻/地点重算:弃旧 analemma 组 + 用当前 jd/观测点重建(否则停在构建时=本命时刻)。
	rebuildAnalemma(jd, observer){
		if(!this.groups){ return; }
		this.groups = this.groups.filter((g)=>{
			if(g.name && g.name.indexOf('analemma-layer') === 0){ g.dispose(false, true); return false; }
			return true;
		});
		this.createAnalemma(observer || ((this.lastData && this.lastData.observer) || {}), jd);
		this.applyLayerVisibility();
	}

	createSu28Sectors(items, observer){
		const normalizedObserver = observerFromData(observer);
		// The 28 宿 are EQUATORIAL (赤道宿度): the mansions are placed by their distance-stars'
		// right ascension, NOT the ecliptic. Order/split by ra. Sectors come from the 28
		// distance-STARS only — the su28 list also carries planet markers via fillPlanetSu28,
		// which must not split the intervals (now that A2 re-projects them they'd be visible).
		const sectorStars = (items || [])
			.filter((item)=>item && item.type === 'Fixed Star' && Number.isFinite(Number(item.ra)))
			.slice()
			.sort((a, b)=>Number(a.ra) - Number(b.ra));
		if(sectorStars.length < 2){
			return;
		}
		const group = this.makeGroup('su28-sector-layer');
		const sectorRadius = BODY_RADIUS - 22;
		const labelRadius = BODY_RADIUS - 2;
		sectorStars.forEach((item, idx)=>{
			const next = sectorStars[(idx + 1) % sectorStars.length];
			const startRa = normalizeDegrees(item.ra);
			const endRa = normalizeDegrees(next.ra);
			const midRa = circularMidpoint(startRa, endRa);
			const midDecl = clamp((Number(item.decl) + Number(next.decl)) / 2, -72, 78);
			const sectorLabel = su28DisplayName(item);
			const color = SU28_PALACE_COLORS[Math.floor(idx / 7) % SU28_PALACE_COLORS.length];
			const segmentVisible = this.showBelowHorizon() || allAboveHorizon([item, next]);
			const segment = this.createLine(
				`su28-sector-${item.id || item.name || idx}`,
				[item, next],
				color,
				0.7,
				group,
				sectorRadius,
				true,
			);
			if(segment){
				segment.metadata = { layerKind: 'su28Sector', label: `${sectorLabel}区间` };
				segment.setEnabled(segmentVisible);
				const registered = this.projectableLines.find((lineItem)=>lineItem.mesh === segment);
				if(registered){
					registered.visibilityMode = 'allAbove';
					registered.lastProjectedSources = [item, next];
				}
			}
			const labelSource = {
				ra: midRa,
				decl: midDecl,
				name: `${sectorLabel}区间`,
				altitudeAppa: 0,
				azimuth: 0,
			};
			const label = this.createTextPlane(`${sectorLabel}区间`, 26, '#dceeff', 'rgba(0,0,0,0)');
			label.position = toSkyVector(projectedEquatorialItem(labelSource, normalizedObserver && normalizedObserver.jd ? normalizedObserver.jd : 2451545, normalizedObserver), labelRadius);
			label.parent = group;
			label.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
			label.metadata = { labelKind: 'su28Sector' };
			label.setEnabled(segmentVisible);
			this.registerProjectableMesh(label, labelSource, labelRadius, {
				visibilityMode: 'allAbove',
				visibilitySources: [item, next],
				lastProjectedSources: [item, next],
			});
		});
	}

	// 二十八宿赤道网格(纯天文·赤道制):28 距星的「真实赤经」即宿界 —— 每条经圈是过天极的赤道大圆,
	// 绝不走宿度制/黄道投影(纯天文铁律)。取数同 createSu28Sectors(只用 28 距星,planet markers 不分界),
	// 画法同 createCoordinateGrid 的经圈(decl 扫,equatorialToHorizontal 投影,projectable 随天转)。
	// 四象配色(每 7 宿一象);宿界经圈略强调,象内可选 10° 赤纬纬线;沿赤道标宿名。metadata.gridKey='su28Grid'。
	createSu28Grid(items, observer){
		const sectorStars = (items || [])
			.filter((item)=>item && item.type === 'Fixed Star' && Number.isFinite(Number(item.ra)))
			.slice()
			.sort((a, b)=>Number(a.ra) - Number(b.ra));
		if(sectorStars.length < 2){
			return null;
		}
		const group = this.makeGroup('grid-su28-layer');
		const obs = observerFromData(observer);
		const jd = (obs && obs.jd) || 2451545;
		const refr = this.refractionActive();
		const radius = 756; // 贴赤道刻度盘外缘(赤道网格 754 / 赤道刻度 756),与赤道网格区分
		const density = 96;
		// 过极大圆 decl 采样到 ±90(含极点):与赤道网格 vRange[-90,90] 同口径 —— equatorialToHorizontal 在极点返
		// 有限值(方位任意但 toSkyVector 落到天极轴点),故 28 条线在天极干净收敛、无断口/无留洞(±89.5 会在极点留洞=线断)。
		const declLo = -90;
		const declHi = 90;
		const dvs = (declHi - declLo) / density;
		// ① 经圈:每距星赤经一条过极大圆。宿界(第一条/每象首宿)略强调。
		sectorStars.forEach((item, idx)=>{
			const ra = normalizeDegrees(item.ra);
			// 四象配色/象首按传统宿序(角起),而非赤经升序 idx(否则整体偏移一象);宿名不识别则退回 idx。
			const seq = su28SequenceIndex(item);
			const ord = seq >= 0 ? seq : idx;
			const color = SU28_PALACE_COLORS[Math.floor(ord / 7) % SU28_PALACE_COLORS.length];
			const isPalaceHead = (ord % 7 === 0); // 每象首宿(角/斗/奎/井)经圈略强调
			const pts = [];
			for(let d = declLo; d <= declHi + 1e-9; d += dvs){
				pts.push({ ...equatorialToHorizontal(ra, d, jd, obs, refr), ra, decl: d });
			}
			const line = this.createLine(`grid-su28-mer-${item.id || item.name || idx}`, pts, color, isPalaceHead ? 0.42 : 0.3, group, radius, true);
			if(line){ line.metadata = { gridKey: 'su28Grid' }; }
		});
		// ② 仅赤道腰线(decl=0):二十八宿以赤道为腰,去掉同心纬圈(用户:同心圆使盘面模糊),只留赤道一条。
		const equatorColor = new BABYLON.Color3(0.86, 0.74, 0.46);
		const us = 360 / density;
		{
			const pts = [];
			for(let u = 0; u <= 360 + 1e-9; u += us){
				const ra = u % 360;
				pts.push({ ...equatorialToHorizontal(ra, 0, jd, obs, refr), ra, decl: 0 });
			}
			const line = this.createLine('grid-su28-par-0', pts, equatorColor, 0.3, group, radius, true);
			if(line){ line.metadata = { gridKey: 'su28Grid' }; }
		}
		// ③ 沿赤道(decl=0)标宿名:每宿区间中点处一枚 billboard,字号适中、防极点拥挤(都在赤道附近)。
		const labelRadius = radius + 6;
		const gate = !!this.layers.su28Grid;
		sectorStars.forEach((item, idx)=>{
			const next = sectorStars[(idx + 1) % sectorStars.length];
			const startRa = normalizeDegrees(item.ra);
			const endRa = normalizeDegrees(next.ra);
			const midRa = circularMidpoint(startRa, endRa);
			const color = SU28_PALACE_COLORS[Math.floor(idx / 7) % SU28_PALACE_COLORS.length];
			const labelColor = `#${color.toHexString().slice(1)}`;
			const sectorLabel = su28DisplayName(item);
			const labelSource = { ra: midRa, decl: 0, name: sectorLabel, altitudeAppa: 0, azimuth: 0 };
			const plane = this.createTextPlane(sectorLabel, 24, labelColor, 'rgba(0,0,0,0)');
			plane.position = toSkyVector(projectedEquatorialItem(labelSource, jd, obs, refr), labelRadius);
			plane.parent = group;
			plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
			plane.metadata = { gridKey: 'su28Grid', labelKind: 'su28GridName' };
			plane.setEnabled(gate);
			this.registerProjectableMesh(plane, labelSource, labelRadius);
		});
		return group;
	}

	createBodies(bodies){
		const group = this.makeGroup('body-layer');
		bodies.forEach((body)=>{
			const diameter = {
				Sun: 28,
				Moon: 20,
				Mercury: 13,
				Venus: 16,
				Mars: 15,
				Jupiter: 19,
				Saturn: 18,
				Uranus: 15,
				Neptune: 15,
				Pluto: 12,
			}[body.id] || 12;
			const mesh = BABYLON.MeshBuilder.CreateSphere(`body-${body.id}`, { diameter, segments: TEXTURED_BODY_IDS.has(body.id) ? 32 : 18 }, this.scene);
			mesh.position = toSkyVector(body, BODY_RADIUS);
			mesh.material = this.createBodyMaterial(body);
			mesh.parent = group;
			mesh.metadata = { body: { ...body, displayName: bodyName(body), layer: 'body' } };
			this.pickMeshes.push(mesh);
			this.bodyMeshes[body.id] = mesh;
			this.bodyMeshes[bodyName(body)] = mesh;
			this.registerProjectableMesh(mesh, body, BODY_RADIUS);
			this.createBodyHalo(mesh, body, group);
			if(body.id === 'Moon'){
				this.createMoonPhaseDisc(body, mesh, group);
			}
			if(body.id === 'Saturn'){
				this.createSaturnRing(mesh, group);
			}

			if(ALWAYS_LABELED_BODY_IDS.has(body.id)){
				const labelSize = body.id === 'Sun' || body.id === 'Moon' ? 58 : 50;
				const labelOffset = body.id === 'Sun' ? 38 : (body.id === 'Moon' ? 34 : 29);
				const labelColor = body.id === 'Sun' ? '#ffe5a8' : (body.id === 'Moon' ? '#e9f4ff' : '#f4f7ff');
				const label = this.createTextPlane(bodyName(body), labelSize, labelColor, 'rgba(0,0,0,0)');
				label.position = mesh.position.add(new BABYLON.Vector3(0, labelOffset, 0));
				label.parent = group;
				label.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
				label.metadata = { labelKind: 'body' };
				this.registerFollowerMesh(label, body.id, ()=>new BABYLON.Vector3(0, labelOffset, 0));
			}
		});
	}

	applyLabelVisibility(){
		if(!this.camera || !this.scene){
			return;
		}
		const showBody = this.viewMode === 'ground' ? true : this.camera.radius < 1040;
		this.scene.meshes.forEach((mesh)=>{
			const kind = mesh.metadata && mesh.metadata.labelKind;
			if(kind === 'body'){
				mesh.setEnabled(showBody);
			}
		});
	}

	// P2 网格密度自适应(保守档·像素感知近似):按视场自适应调网格密度,但绝不重建几何 —
	// 只把最密的「细线」(非主经圈 / 细纬圈)按视场连续淡出。锚点:默认 FOV(地表 1.08)= 系数 1.0,
	// 与现状字节级一致;放大(FOV↓)同样保持 1.0;只有缩小(FOV↑ / orbit 拉远)时细线渐隐,避免过密。
	// 三网格全关(默认)→ 直接返回,零额外逐帧开销、零回归。系数变化 <0.02 不写,避免逐帧抖动。
	applyGridLod(){
		if(!this.camera || !this.scene){ return; }
		if(!this.layers || (!this.layers.horizontalGrid && !this.layers.equatorialGrid && !this.layers.eclipticGrid)){
			// 网格未开:若上次有淡出残留则一次性复位,然后停手。
			if(this._gridLodFactor !== undefined && this._gridLodFactor !== 1){ this._resetGridLod(); }
			return;
		}
		let factor = 1;
		if(this.viewMode === 'orbit'){
			// orbit:相机半径越大(越远)细线越淡。基准 1120,封顶在 ORBIT_MAX_RADIUS 附近。
			const r = this.camera.radius || 1120;
			factor = clamp(1 - (r - 1120) / 1600, 0.3, 1);
		}else{
			// ground:FOV 越大(越广角)细线越淡;默认 1.08 及以下 = 1.0。
			const fov = this.camera.fov || 1.08;
			factor = fov <= 1.08 ? 1 : clamp(1 - (fov - 1.08) / (GROUND_MAX_FOV - 1.08) * 0.7, 0.3, 1);
		}
		if(this._gridLodFactor !== undefined && Math.abs(this._gridLodFactor - factor) < 0.02){ return; }
		this._gridLodFactor = factor;
		this.scene.meshes.forEach((mesh)=>{
			const md = mesh.metadata;
			if(md && md.gridKey && md.lodFine && Number.isFinite(md.baseAlpha)){
				mesh.alpha = md.baseAlpha * factor;
			}
		});
	}

	_resetGridLod(){
		this._gridLodFactor = 1;
		this.scene.meshes.forEach((mesh)=>{
			const md = mesh.metadata;
			if(md && md.gridKey && md.lodFine && Number.isFinite(md.baseAlpha)){
				mesh.alpha = md.baseAlpha;
			}
		});
	}

	applyModeBoundVisibility(){
		(this.projectableLines || []).forEach((item)=>{
			if(item && item.mesh && item.visibilityMode){
				item.mesh.setEnabled(this.layerAllowsMesh(item.mesh) && shouldShowModeBoundItem(item, this.viewMode, this.showBelowHorizon()));
			}
		});
		(this.projectableMeshes || []).forEach((item)=>{
			if(item && item.mesh && item.visibilityMode){
				item.mesh.setEnabled(this.layerAllowsMesh(item.mesh) && shouldShowModeBoundItem(item, this.viewMode, this.showBelowHorizon()));
			}
		});
	}

	createTraditionalLayer(kind, items, color, diameter){
		const group = this.makeGroup(`${kind}-layer`);
		items.forEach((item)=>{
			const mesh = BABYLON.MeshBuilder.CreateSphere(`${kind}-${item.id || item.name}`, { diameter: diameter || 5, segments: 8 }, this.scene);
			mesh.position = toSkyVector(item, BODY_RADIUS - 28);
			mesh.material = this.material(`${kind}-mat-${item.id || item.name}`, color, 0.9);
			mesh.parent = group;
			mesh.metadata = { body: { ...item, displayName: item.name || item.id, layer: kind } };
			this.pickMeshes.push(mesh);
			this.registerProjectableMesh(mesh, item, BODY_RADIUS - 28);
			if(item.id){ this.bodyMeshes[item.id] = mesh; }
			if(item.name){ this.bodyMeshes[item.name] = mesh; }
		});
		if(kind === 'beidou' && items.length > 1){
			this.createLine('beidou-line', items, color, 0.72, group, BODY_RADIUS - 28, true);
		}
	}

	pickNearestStar(){
		if(!this.camera || !this.scene || !this.starCatalog || !this.starCatalog.length || !this.onPick){
			return null;
		}
		if(this.layers && this.layers.stars === false){
			return null; // 恒星层关闭时不拾取
		}
		let ray = null;
		try{
			ray = this.scene.createPickingRay(this.scene.pointerX, this.scene.pointerY, BABYLON.Matrix.Identity(), this.camera);
		}catch(e){
			ray = null;
		}
		if(!ray){
			return null;
		}
		const particles = this.starPcs && this.starPcs.particles ? this.starPcs.particles : null;
		const wm = this.starMesh ? this.starMesh.getWorldMatrix() : null;
		const pts = [];
		for(let i = 0; i < this.starCatalog.length; i += 1){
			const star = this.starCatalog[i];
			let p;
			if(particles && particles[i] && particles[i].position){
				p = wm ? BABYLON.Vector3.TransformCoordinates(particles[i].position, wm) : particles[i].position;
			}else{
				p = toSkyVector(star, STAR_RADIUS);
			}
			pts.push({ x: p.x, y: p.y, z: p.z, star });
		}
		const hit = nearestPointToRay(ray.origin, ray.direction, pts, 1.8);
		if(hit && hit.star){
			const enriched = { ...hit.star, kind: 'catalogStar', layer: 'stars' };
			const label = starDisplayLabel(hit.star);
			if(label){ enriched.displayName = label; } // 显示专名/中文名(织女一 Vega…),无则回退星表名
			this.onPick(enriched);
			return enriched;
		}
		return null;
	}

	// 角距测量开关(默认关 → 零回归)。关闭时清起点 + 清连线弧、并清空读数。
	setMeasureMode(on){
		this.measureMode = !!on;
		if(!this.measureMode){
			this.measureFirst = null;
			this.clearMeasureMeshes();
			if(this.onMeasure){ this.onMeasure(null); }
		}
	}

	clearMeasureMeshes(){
		(this.measureMeshes || []).forEach((m)=>{ try{ m.dispose(); }catch(e){} });
		this.measureMeshes = [];
	}

	// 取一次点选的「方向 + 标签」:命中天体用其位置向量+名;空白天区用拾取射线方向+坐标标签。
	measurePointFromTap(hitMesh, hitBody){
		if(hitBody && hitMesh && hitMesh.position){
			const v = hitMesh.position.clone();
			return { vector: v.normalize(), label: bodyName(hitBody) };
		}
		const readout = this.skyReadoutFromPointer();
		if(!readout){ return null; }
		const v = new BABYLON.Vector3(readout.vector.x, readout.vector.y, readout.vector.z);
		const label = `赤经 ${formatRa(readout.ra)} 赤纬 ${formatDeg(readout.decl)}`;
		return { vector: v, label, readout };
	}

	handleMeasureTap(hitMesh, hitBody){
		const point = this.measurePointFromTap(hitMesh, hitBody);
		if(!point || !point.vector){ return; }
		// 第三次点选(已有完整一对)→ 先重置再记新起点。
		if(this.measureFirst && this.measureFirst.done){
			this.measureFirst = null;
			this.clearMeasureMeshes();
			if(this.onMeasure){ this.onMeasure(null); }
		}
		if(!this.measureFirst){
			this.measureFirst = { vector: point.vector, label: point.label, done: false };
			this.clearMeasureMeshes();
			this.drawMeasureMarker(point.vector);
			if(this.onMeasure){
				this.onMeasure({ stage: 'first', startLabel: point.label });
			}
			return;
		}
		// 第二次点选 → 算球面角距 + 画大圆短弧。
		const sep = angularSeparationDeg(this.measureFirst.vector, point.vector);
		this.measureFirst.done = true;
		this.drawMeasureMarker(point.vector);
		this.drawMeasureArc(this.measureFirst.vector, point.vector);
		if(this.onMeasure){
			this.onMeasure({
				stage: 'done',
				startLabel: this.measureFirst.label,
				endLabel: point.label,
				separation: sep,
			});
		}
	}

	drawMeasureMarker(unitVec){
		try{
			const ring = BABYLON.MeshBuilder.CreateTorus(`planetarium-measure-mark-${this.measureMeshes.length}`, { diameter: 18, thickness: 1.3, tessellation: 40 }, this.scene);
			ring.position = unitVec.scale(LINE_RADIUS + 4);
			ring.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
			ring.isPickable = false;
			ring.renderingGroupId = 3;
			const mat = new BABYLON.StandardMaterial(`planetarium-measure-mark-mat-${this.measureMeshes.length}`, this.scene);
			mat.emissiveColor = new BABYLON.Color3(0.4, 0.92, 0.78);
			mat.disableLighting = true;
			mat.alpha = 0.95;
			ring.material = mat;
			this.measureMeshes.push(ring);
		}catch(e){ /* 标记失败不影响测量数值 */ }
	}

	// 两方向间的大圆短弧:在单位球上按夹角等分球面插值(slerp),投到 LINE_RADIUS 半径成弧线。
	drawMeasureArc(a, b){
		try{
			const na = a.clone().normalize();
			const nb = b.clone().normalize();
			let dot = clamp(na.x * nb.x + na.y * nb.y + na.z * nb.z, -1, 1);
			const omega = Math.acos(dot);
			const pts = [];
			const SEG = 64;
			if(omega < 1e-4){
				pts.push(na.scale(LINE_RADIUS + 4));
				pts.push(nb.scale(LINE_RADIUS + 4));
			}else{
				const sinOmega = Math.sin(omega);
				for(let i = 0; i <= SEG; i += 1){
					const t = i / SEG;
					const w1 = Math.sin((1 - t) * omega) / sinOmega;
					const w2 = Math.sin(t * omega) / sinOmega;
					const v = new BABYLON.Vector3(
						na.x * w1 + nb.x * w2,
						na.y * w1 + nb.y * w2,
						na.z * w1 + nb.z * w2,
					).normalize();
					pts.push(v.scale(LINE_RADIUS + 4));
				}
			}
			const arc = BABYLON.MeshBuilder.CreateLines('planetarium-measure-arc', { points: pts }, this.scene);
			arc.color = new BABYLON.Color3(0.4, 0.92, 0.78);
			arc.alpha = 0.9;
			arc.isPickable = false;
			arc.renderingGroupId = 3;
			this.measureMeshes.push(arc);
		}catch(e){ /* 画弧失败不影响测量数值 */ }
	}

	// 空白天区读坐标(任务 3):算当前指针方向坐标,经 onSkyReadout 交 React 显示。
	emitSkyReadout(){
		if(!this.onSkyReadout){ return; }
		const readout = this.skyReadoutFromPointer();
		if(readout){ this.onSkyReadout(readout); }
	}

	// 当前指针方向 → 天区坐标(点击空白处读坐标 / 角距测量共用)。
	// 取拾取射线方向(过点击像素的视线单位向量)= 该方向天球坐标;再反算 ra/decl、黄经黄纬、方位高度。
	// 纯天文:真实赤道/黄道(无 zodiacal/宿度/岁差污染)。ground 加大气折射、orbit 几何原貌(与正向一致)。
	skyReadoutFromPointer(){
		if(!this.camera || !this.scene){ return null; }
		let ray = null;
		try{
			ray = this.scene.createPickingRay(this.scene.pointerX, this.scene.pointerY, BABYLON.Matrix.Identity(), this.camera);
		}catch(e){ ray = null; }
		if(!ray || !ray.direction){ return null; }
		return this.skyReadoutFromVector(ray.direction);
	}

	// 由场景方向向量装配整套坐标读数(供指针/已记测量点复用)。
	skyReadoutFromVector(vec){
		if(!vec){ return null; }
		const dir = vec.clone ? vec.clone() : vec;
		const unit = (dir.normalize ? dir.normalize() : dir);
		const horiz = skyDirectionFromVector(unit);
		if(!horiz){ return null; }
		const jd = (this._readoutJd !== undefined && this._readoutJd !== null) ? this._readoutJd : ((this.lastData && this.lastData.observer && this.lastData.observer.jd) || 2451545);
		const observer = this._readoutObserver || observerFromData(this.lastData && this.lastData.observer);
		const applyRefraction = this.refractionActive();
		const eq = horizontalToEquatorial(horiz.altitudeAppa, horiz.azimuth, jd, observer, applyRefraction);
		const ecl = eq ? equatorialToEcliptic(eq.ra, eq.decl, jd) : null;
		return {
			vector: { x: unit.x, y: unit.y, z: unit.z },
			altitudeAppa: horiz.altitudeAppa,
			azimuth: horiz.azimuth,
			ra: eq ? eq.ra : null,
			decl: eq ? eq.decl : null,
			eclLon: ecl ? ecl.lon : null,
			eclLat: ecl ? ecl.lat : null,
		};
	}

	// React 侧在重投影时把当前 jd / observer 喂进来,使空白处读坐标用当前时刻(否则回退 J2000/数据自带)。
	setReadoutContext(jd, observer){
		this._readoutJd = Number.isFinite(Number(jd)) ? Number(jd) : this._readoutJd;
		if(observer){ this._readoutObserver = observer; }
	}

	flyTo(itemOrKey){
		if(!itemOrKey || !this.camera){
			return false;
		}
		let mesh = null;
		let starHit = null;
		if(typeof itemOrKey === 'string'){
			const key = itemOrKey.trim();
			mesh = this.bodyMeshes[key];
			if(!mesh){
				const found = Object.keys(this.bodyMeshes).find((name)=>name.toLowerCase().indexOf(key.toLowerCase()) >= 0);
				mesh = found ? this.bodyMeshes[found] : null;
			}
			if(!mesh && this.starIndex){
				starHit = findStarByName(this.starIndex, key); // 暗星按名搜索兜底
			}
		}else{
			mesh = this.bodyMeshes[itemOrKey.id] || this.bodyMeshes[itemOrKey.name] || this.bodyMeshes[itemOrKey.displayName];
		}
		if(!mesh && !starHit){
			return false;
		}
		const pos = mesh ? mesh.position : toSkyVector(starHit, STAR_RADIUS);
		if(this.viewMode === 'orbit'){
			// 天球外观:把目标精确居中。ArcRotateCamera 绕球心(target=0)旋转 → 相机移到目标方向的对侧、
			// 穿过球心看向目标即居中:beta=acos(-ny)、alpha=atan2(-nz,-nx)(n=目标单位向量);并归零 target。
			const n = pos.clone().normalize();
			const beta = clamp(Math.acos(clamp(-n.y, -1, 1)), 0.01, Math.PI - 0.01);
			let alpha = Math.atan2(-n.z, -n.x);
			// 取最短旋转路径(避免绕远)
			while(alpha - this.camera.alpha > Math.PI){ alpha -= 2 * Math.PI; }
			while(alpha - this.camera.alpha < -Math.PI){ alpha += 2 * Math.PI; }
			const radius = clamp(this.camera.radius * 0.85, ORBIT_MIN_RADIUS, ORBIT_MAX_RADIUS);
			BABYLON.Animation.CreateAndStartAnimation('planetarium-target-x', this.camera, 'target.x', 60, 30, this.camera.target.x, 0, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
			BABYLON.Animation.CreateAndStartAnimation('planetarium-target-y', this.camera, 'target.y', 60, 30, this.camera.target.y, 0, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
			BABYLON.Animation.CreateAndStartAnimation('planetarium-target-z', this.camera, 'target.z', 60, 30, this.camera.target.z, 0, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
			BABYLON.Animation.CreateAndStartAnimation('planetarium-alpha', this.camera, 'alpha', 60, 30, this.camera.alpha, alpha, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
			BABYLON.Animation.CreateAndStartAnimation('planetarium-beta', this.camera, 'beta', 60, 30, this.camera.beta, beta, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
			BABYLON.Animation.CreateAndStartAnimation('planetarium-radius', this.camera, 'radius', 60, 30, this.camera.radius, radius, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
		}else{
			// 地表观测:相机在观测点向外看,转向目标方向即居中(目标在地平线下则俯视到该方位)。
			const rot = cameraRotationForDirection(pos.subtract(this.camera.position));
			let ry = rot.y;
			while(ry - this.camera.rotation.y > Math.PI){ ry -= 2 * Math.PI; }
			while(ry - this.camera.rotation.y < -Math.PI){ ry += 2 * Math.PI; }
			BABYLON.Animation.CreateAndStartAnimation('planetarium-look-x', this.camera, 'rotation.x', 60, 30, this.camera.rotation.x, rot.x, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
			BABYLON.Animation.CreateAndStartAnimation('planetarium-look-y', this.camera, 'rotation.y', 60, 30, this.camera.rotation.y, ry, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
			BABYLON.Animation.CreateAndStartAnimation('planetarium-fov', this.camera, 'fov', 60, 26, this.camera.fov, 0.62, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
		}
		// 🆕 持续跟随(Stellarium 风格):mesh follow → 相机 lockedTarget 每帧自动跟随 mesh.position,
		// 即使月亮/行星在播放中移动也始终居中;用户拖动相机(pointerMoveHandler)即取消。
		// 暗星(SolidParticle 粒子云,无独立 mesh)通过隐藏 _followerMesh 中介:每帧 updateProjectedTime 末尾把 starHit 重投影到当前 jd
		// → mutate _followerMesh.position → camera.lockedTarget 跟随 _followerMesh = 跟随选中暗星(地球自转 + 岁差自动覆盖)。
		if(this.camera){
			if(mesh){
				this._followMesh = mesh;
				this._followStar = null;
				this.camera.lockedTarget = mesh;
			}else if(starHit && this._followerMesh){
				this._followStar = { ra: starHit.ra, decl: starHit.decl, name: starHit.name, hipId: starHit.hipId };
				this._followMesh = this._followerMesh;
				this._followerMesh.position.copyFrom(pos);
				this.camera.lockedTarget = this._followerMesh;
			}
		}
		// 高亮定位目标(短暂脉冲环),便于一眼看到中心的天体
		if(mesh){ this.pulseLocate(mesh); }
		if(mesh){
			return mesh.metadata && mesh.metadata.body ? mesh.metadata.body : true;
		}
		const starResult = { ...starHit, kind: 'catalogStar', layer: 'stars' };
		const starLabel = starDisplayLabel(starHit);
		if(starLabel){ starResult.displayName = starLabel; }
		return starResult;
	}

	// 定位高亮:在目标处放一个朝向相机的脉冲环,放大+淡出后自动销毁,便于一眼认出居中天体。
	pulseLocate(mesh){
		try{
			if(!mesh || !this.scene){ return; }
			if(this._locateRing){ try{ this._locateRing.dispose(); }catch(e){} this._locateRing = null; }
			const ring = BABYLON.MeshBuilder.CreateTorus('planetarium-locate-ring', { diameter: 26, thickness: 1.6, tessellation: 48 }, this.scene);
			ring.position.copyFrom(mesh.position);
			ring.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
			ring.isPickable = false;
			ring.renderingGroupId = 3;
			const mat = new BABYLON.StandardMaterial('planetarium-locate-mat', this.scene);
			mat.emissiveColor = new BABYLON.Color3(0.85, 0.68, 0.36);
			mat.disableLighting = true;
			mat.alpha = 0.9;
			ring.material = mat;
			this._locateRing = ring;
			BABYLON.Animation.CreateAndStartAnimation('planetarium-locate-scale', ring, 'scaling', 60, 48, new BABYLON.Vector3(0.3, 0.3, 0.3), new BABYLON.Vector3(2.4, 2.4, 2.4), BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
			BABYLON.Animation.CreateAndStartAnimation('planetarium-locate-fade', mat, 'alpha', 60, 48, 0.9, 0, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT, undefined, ()=>{ try{ ring.dispose(); }catch(e){} if(this._locateRing === ring){ this._locateRing = null; } });
		}catch(e){ /* 高亮失败不影响定位 */ }
	}

	applyGridGroupVisibility(group, on){
		group.setEnabled(!!on);
		if(on){
			group.getChildMeshes().forEach((m)=>{
				if(m.metadata && m.metadata.labelKind === 'gridCoord'){ m.setEnabled(!!this.layers.coordLabels); }
			});
		}
	}

	applyLayerVisibility(){
		this.groups.forEach((group)=>{
			if(group.name.indexOf('stars-layer') === 0){
				group.setEnabled(!!this.layers.stars);
			}else if(group.name.indexOf('bright-stars-layer') === 0){
				group.setEnabled(!!this.layers.stars);
			}else if(group.name.indexOf('body-layer') === 0){
				group.setEnabled(!!this.layers.bodies);
			}else if(group.name.indexOf('overlay-layer') === 0){
				group.setEnabled(true);
				group.getChildMeshes().forEach((mesh)=>{
					if(mesh.name.indexOf('horizon') >= 0){ mesh.setEnabled(!!this.layers.horizon); }
					else if(mesh.name.indexOf('meridian') >= 0){ mesh.setEnabled(!!this.layers.horizon); }
					else if(mesh.name.indexOf('equator') >= 0){ mesh.setEnabled(!!this.layers.equator); }
					else if(mesh.name.indexOf('ecliptic') >= 0){ mesh.setEnabled(!!this.layers.ecliptic); }
					else if(mesh.name.indexOf('house') >= 0){ mesh.setEnabled(!!this.layers.houses); }
				});
			}else if(group.name.indexOf('su28-layer') === 0){
				group.setEnabled(!!this.layers.su28);
			}else if(group.name.indexOf('su28-sector-layer') === 0){
				group.setEnabled(!!this.layers.su28Sectors);
			}else if(group.name.indexOf('zodiac-sector-layer') === 0){
				group.setEnabled(!!this.layers.zodiacSectors);
			}else if(group.name.indexOf('beidou-layer') === 0){
				group.setEnabled(!!this.layers.beidou);
			}else if(group.name.indexOf('grid-horizontal-layer') === 0){
				this.applyGridGroupVisibility(group, this.layers.horizontalGrid);
			}else if(group.name.indexOf('grid-equatorial-layer') === 0){
				this.applyGridGroupVisibility(group, this.layers.equatorialGrid);
			}else if(group.name.indexOf('grid-ecliptic-layer') === 0){
				this.applyGridGroupVisibility(group, this.layers.eclipticGrid);
			}else if(group.name.indexOf('grid-su28-layer') === 0){
				group.setEnabled(!!this.layers.su28Grid);
			}else if(group.name.indexOf('scale-equator-layer') === 0){
				group.setEnabled(!!this.layers.raHourScale);
			}else if(group.name.indexOf('scale-ecliptic-layer') === 0){
				group.setEnabled(!!this.layers.eclipticDegreeScale);
			}else if(group.name.indexOf('scale-horizon-layer') === 0){
				group.setEnabled(!!this.layers.azimuthScale);
			}else if(group.name.indexOf('scale-meridian-layer') === 0){
				group.setEnabled(!!this.layers.altitudeScale);
			}else if(group.name.indexOf('galactic-layer') === 0){
				group.setEnabled(!!this.layers.galacticEquator);
			}else if(group.name.indexOf('precession-layer') === 0){
				group.setEnabled(!!this.layers.precessionCircle);
			}else if(group.name.indexOf('analemma-layer') === 0){
				group.setEnabled(!!this.layers.analemma);
			}else if(group.name.indexOf('sanyuan-layer') === 0){
				group.setEnabled(!!this.layers.threeEnclosures);
			}else if(group.name.indexOf('constellation-line-layer') === 0){
				group.setEnabled(!!this.layers.constellationLines);
			}else if(group.name.indexOf('constellation-bound-layer') === 0){
				group.setEnabled(!!this.layers.constellationBounds);
			}else if(group.name.indexOf('milkyway-layer') === 0){
				group.setEnabled(!!this.layers.milkyWay);
			}else if(group.name.indexOf('starname-layer') === 0){
				group.setEnabled(!!this.layers.starNames);
			}else if(group.name.indexOf('asterism-xingguan-layer') === 0){
				group.setEnabled(!!this.layers.xingguan);
			}else if(group.name.indexOf('asterism-trails-layer') === 0){
				group.setEnabled(!!this.layers.planetTrails);
			}else if(group.name.indexOf('pole-layer') === 0){
				group.setEnabled(true);
				group.getChildMeshes().forEach((m)=>{
					const tag = (m.metadata && m.metadata.poleId) || m.name || '';
					const on = tag.indexOf('ecliptic-pole') >= 0 ? this.layers.eclipticPoles : (tag.indexOf('galactic-pole') >= 0 ? this.layers.galacticPoles : this.layers.celestialPoles);
					m.setEnabled(!!on);
				});
			}
		});
		this.applyModeBoundVisibility();
	}

	layerAllowsMesh(mesh){
		if(!mesh){
			return true;
		}
		const name = mesh.name || '';
		const parentName = mesh.parent && mesh.parent.name ? mesh.parent.name : '';
		if(parentName.indexOf('overlay-layer') === 0){
			if(name.indexOf('horizon') >= 0 || name.indexOf('meridian') >= 0){ return !!this.layers.horizon; }
			if(name.indexOf('equator') >= 0){ return !!this.layers.equator; }
			if(name.indexOf('ecliptic') >= 0){ return !!this.layers.ecliptic; }
			if(name.indexOf('house') >= 0){ return !!this.layers.houses; }
		}
		if(parentName.indexOf('su28-sector-layer') === 0){
			return !!this.layers.su28Sectors;
		}
		if(parentName.indexOf('zodiac-sector-layer') === 0){
			return !!this.layers.zodiacSectors;
		}
		const md = mesh.metadata || {};
		if(md.gridKey){
			if(md.labelKind === 'gridCoord'){ return !!this.layers[md.gridKey] && !!this.layers.coordLabels; }
			return !!this.layers[md.gridKey];
		}
		if(parentName.indexOf('scale-equator-layer') === 0){ return !!this.layers.raHourScale; }
		if(parentName.indexOf('scale-ecliptic-layer') === 0){ return !!this.layers.eclipticDegreeScale; }
		if(parentName.indexOf('scale-horizon-layer') === 0){ return !!this.layers.azimuthScale; }
		if(parentName.indexOf('scale-meridian-layer') === 0){ return !!this.layers.altitudeScale; }
		if(parentName.indexOf('galactic-layer') === 0){ return !!this.layers.galacticEquator; }
		if(parentName.indexOf('milkyway-layer') === 0){ return !!this.layers.milkyWay; }
		if(parentName.indexOf('precession-layer') === 0){ return !!this.layers.precessionCircle; }
		if(parentName.indexOf('analemma-layer') === 0){ return !!this.layers.analemma; }
		if(parentName.indexOf('sanyuan-layer') === 0){ return !!this.layers.threeEnclosures; }
		if(parentName.indexOf('constellation-line-layer') === 0){ return !!this.layers.constellationLines; }
		if(parentName.indexOf('constellation-bound-layer') === 0){ return !!this.layers.constellationBounds; }
		if(parentName.indexOf('starname-layer') === 0){ return !!this.layers.starNames; }
		if(parentName.indexOf('asterism-xingguan-layer') === 0){ return !!this.layers.xingguan; }
		if(parentName.indexOf('asterism-trails-layer') === 0){ return !!this.layers.planetTrails; }
		if(parentName.indexOf('pole-layer') === 0){
			const tag = md.poleId || name || '';
			if(tag.indexOf('ecliptic-pole') >= 0){ return !!this.layers.eclipticPoles; }
			if(tag.indexOf('galactic-pole') >= 0){ return !!this.layers.galacticPoles; }
			return !!this.layers.celestialPoles;
		}
		return true;
	}

	// perf:planetariumRenderGating —— 每帧渲染体(原 runRenderLoop 闭包,内容一字不动;新增静止降帧 + metrics 节流)。
	_renderTick(){
		if(!this.scene){
			return;
		}
		const t = nowMs();
		// A2 静止降帧:可见+激活但「未播放 / 无补间动画 / 非刚交互(settle)/ 未被显式请求」时,
		// 渲染降到 ~10fps。静止画面在任何帧率下视觉完全一致,且把 CPU 让回主线程消除全局卡顿;
		// 任何变更最迟 ≤PLANETARIUM_IDLE_FRAME_MS 上屏(不漏帧、不陈旧),播放/拖动/动画期间仍满帧。
		if(this._onDemand){
			const live = this._renderRequested
				|| this._playing
				|| (this.scene.animatables && this.scene.animatables.length > 0)
				|| (t < this._settleUntil);
			if(!live){
				if(this._lastIdleRender && (t - this._lastIdleRender) < PLANETARIUM_IDLE_FRAME_MS){
					return;
				}
			}
			this._renderRequested = false;
			this._lastIdleRender = t;
		}
		this.updateGroundScenePosition();
		this.applyLabelVisibility();
		this.applyGridLod();
		this.scene.render();
		if(this.onMetrics){
			// B:FPS/网格调试读数节流到 ~2Hz(getFps 本就是滚动均值,2Hz 与 60Hz 读同一值类、零精度损失)。
			if(!this._metricsThrottle || !this._lastMetricEmit || (t - this._lastMetricEmit) >= 500){
				this._lastMetricEmit = t;
				const fps = Math.round(this.engine.getFps());
				this.onMetrics({
					fps: Number.isFinite(fps) ? Math.min(240, Math.max(0, fps)) : 0,
					meshes: this.scene.meshes.length,
				});
			}
		}
	}

	_startRenderLoop(){
		if(this._loopRunning || !this.engine){
			return;
		}
		if(!this._boundRenderTick){
			this._boundRenderTick = this._renderTick.bind(this);
		}
		this.engine.runRenderLoop(this._boundRenderTick);
		this._loopRunning = true;
	}

	startRenderLoop(){
		this._startRenderLoop();
	}

	// A1:隐藏/非激活时停渲染循环(只停「画」,scene/engine/state 全保留;恢复时 renderOnce 重绘实况)。
	stopRenderLoop(){
		if(!this.engine){
			this._loopRunning = false;
			return;
		}
		if(this._boundRenderTick){
			this.engine.stopRenderLoop(this._boundRenderTick);
		}else{
			this.engine.stopRenderLoop();
		}
		this._loopRunning = false;
	}

	// 单帧硬渲染:恢复显示时立即重绘当前实况帧(无陈旧、无 A→B 跳变)。
	renderOnce(){
		if(!this.scene || !this.engine){
			return;
		}
		this.updateGroundScenePosition();
		this.applyLabelVisibility();
		this.applyGridLod();
		this.scene.render();
		this._renderRequested = false;
		this._lastIdleRender = nowMs();
	}

	// 显式请求下一帧满帧(场景内容变更后调用 → ≤1 帧上屏;静止降帧下仍即时可见)。
	requestRender(){
		this._renderRequested = true;
	}

	// 一次用户交互/相机变更 → 短窗内维持满帧(拖动顺滑 + 覆盖惯性/收尾)。
	markCameraSettle(){
		this._settleUntil = nowMs() + PLANETARIUM_SETTLE_MS;
	}

	// React 侧 speed 变化时同步(播放中恒满帧)。
	setPlaying(playing){
		this._playing = !!playing;
		if(playing){
			this._renderRequested = true;
		}
	}

	dispose(){
		this.disposed = true;
		this._loopRunning = false;
		window.removeEventListener('resize', this.resizeHandler);
		if(this.wheelHandler){
			this.canvas.removeEventListener('wheel', this.wheelHandler);
		}
		if(this.pointerDownHandler){
			this.canvas.removeEventListener('pointerdown', this.pointerDownHandler);
			this.canvas.removeEventListener('pointermove', this.pointerMoveHandler);
			this.canvas.removeEventListener('pointerup', this.pointerUpHandler);
			this.canvas.removeEventListener('pointercancel', this.pointerUpHandler);
		}
		this.clearMeasureMeshes();
		this.clearData();
		if(this.sky){
			this.sky.dispose(false, true);
		}
		if(this.skyTexture){
			this.skyTexture.dispose();
			this.skyTexture = null;
		}
		if(this.horizonGlow){
			this.horizonGlow.dispose(false, true);
		}
		if(this.groundOccluder){
			this.groundOccluder.dispose(false, true);
		}
		if(this.horizonPanorama){
			this.horizonPanorama.dispose(false, true);
		}
		if(this.horizonMist){
			this.horizonMist.dispose(false, true);
		}
		if(this.horizonMistTexture){
			this.horizonMistTexture.dispose();
			this.horizonMistTexture = null;
		}
		(this.landscapeMeshes || []).forEach((mesh)=>mesh.dispose(false, true));
		if(this.glow){
			this.glow.dispose();
		}
		if(this.scene){
			this.scene.dispose();
			this.scene = null;
		}
		if(this.engine){
			this.engine.stopRenderLoop();
			this.engine.dispose();
			this.engine = null;
		}
	}
}

class PlanetariumBabylon extends Component{
	constructor(props){
		super(props);
		const time = buildObservationTime(props.fields);
		this.state = {
			time,
			data: null,
			selected: null,
			searchQuery: '',
			searchMessage: '',
			leftCollapsed: false,
			immersive: false,
			observerOverride: null,
			loading: false,
			syncing: false,
			syncLabel: '',
			error: null,
			speed: 0,
			viewMode: 'ground',
			layers: {...DEFAULT_LAYERS},
			riseSetRequested: false, // 升落时刻开关(默认关 → 不带 includeRiseSet,零回归;开则重取带参,详情区显本地升落)
			magLimit: 4, // 默认上限 4(只建/显 mag≤4 的较亮星,开场更快、星空更清爽;可拖到 6.5 看全 8404 星)
			measureMode: false, // 角距测量(默认关)
			measureInfo: null, // 测量结果 { stage, startLabel, endLabel, separation }
			skyReadout: null, // 点击空白天区的坐标读数
			collapsedGroups: new Set(['scales', 'poles']),
			metrics: {
				fps: 0,
				meshes: 0,
				loadMs: 0,
				apiMs: 0,
				renderMs: 0,
				runtimeLoadMs: props.runtimeLoadMs || 0,
				firstReadyMs: 0,
				releaseOk: '--',
				catalogCount: 0,
			},
			perfLog: [],
		};
		this.canvasRef = createRef();
		this.renderer = null;
		this.reqSeq = 0;
		this.requestInFlight = false;
		this.playbackSyncInFlight = false;
		this.sceneSyncInFlight = false;
		this.pendingRequestOptions = null;
		this.playTimer = null;
		this.playbackAnchorMs = 0;
		this.playbackAnchorTime = null;
		this.playbackLastFrameMs = 0;
		this.playbackLastStateMs = 0;
		this.playbackLastMetricMs = 0;
		this.backgroundFullTimer = null;
		this.pendingFullRequest = null;
		this.pendingFullRender = null;
		this.lastInteractionAt = 0;
		this.lastPlaybackSyncAt = 0;
		this.metricTimer = null;
		this.mountedAt = nowMs();
		this.firstReadyLogged = false;
		this.requestState = this.requestState.bind(this);
		this.bootstrapState = this.bootstrapState.bind(this);
		this.markInteraction = this.markInteraction.bind(this);
		this.scheduleBackgroundFull = this.scheduleBackgroundFull.bind(this);
		this.toggleLayer = this.toggleLayer.bind(this);
		this.toggleRiseSet = this.toggleRiseSet.bind(this);
		this.changeMagLimit = this.changeMagLimit.bind(this);
		this.toggleMeasureMode = this.toggleMeasureMode.bind(this);
		this.changeSpeed = this.changeSpeed.bind(this);
		this.jumpNow = this.jumpNow.bind(this);
		this.toggleFullscreen = this.toggleFullscreen.bind(this);
		this.toggleImmersive = this.toggleImmersive.bind(this);
		this.searchTarget = this.searchTarget.bind(this);
		this.setSearchQuery = this.setSearchQuery.bind(this);
		this.stepTime = this.stepTime.bind(this);
		this.toggleLeftPanel = this.toggleLeftPanel.bind(this);
		this.changeViewMode = this.changeViewMode.bind(this);
		this.changeObserverGeo = this.changeObserverGeo.bind(this);
		this.clearObserverOverride = this.clearObserverOverride.bind(this);
		this.changeObserverTime = this.changeObserverTime.bind(this);
		this.toggleTimeEditor = this.toggleTimeEditor.bind(this);
		this._onTimeEditorDocMouseDown = this._onTimeEditorDocMouseDown.bind(this);
		this._timeEditorRef = createRef();
		this._timeDisplayRef = createRef();
	}

	componentDidMount(){
		this._isUnmounted = false;
		// 进/出全屏后浏览器改了视口尺寸，但 Babylon 引擎不会自动重算 canvas → 画面不铺满（即「全屏按钮失效」真因）。
		// 监听 fullscreenchange，进/出全屏都触发 engine.resize()（延后一帧等布局稳定）。
		this._onFullscreenChange = ()=>{
			setTimeout(()=>{
				if(this.renderer && this.renderer.engine){
					this.renderer.engine.resize();
				}
			}, 60);
		};
		document.addEventListener('fullscreenchange', this._onFullscreenChange);
		this.renderer = new PlanetariumRenderer(
			this.canvasRef.current,
			(selected)=>{ if(this._isUnmounted){ return; } this.setState({ selected, skyReadout: null }); },
			(metrics)=>{
				if(!this.metricTimer){
					this.metricTimer = setTimeout(()=>{
						this.metricTimer = null;
						if(this._isUnmounted){ return; }
						this.setState((prev)=>({
							metrics: {
								...prev.metrics,
								...metrics,
							},
						}));
					}, 500);
				}
			},
			this.markInteraction,
		);
		// 角距测量结果 + 空白天区读坐标 回调(纯前端派生,不触后端)。
		this.renderer.onMeasure = (info)=>{ if(this._isUnmounted){ return; } this.setState({ measureInfo: info }); };
		this.renderer.onSkyReadout = (readout)=>{ if(this._isUnmounted){ return; } this.setState({ skyReadout: readout, selected: null }); };
		this.renderer.setMagLimit(this.state.magLimit);
		// perf:planetariumRenderGating —— 窗口隐藏/最小化时暂停 Babylon 渲染循环(可见时一字不动);恢复即重绘实况帧。
		this._onVisibility = ()=>{ this._applyRenderActivity(); };
		document.addEventListener('visibilitychange', this._onVisibility);
		this.bootstrapState();
		this._applyRenderActivity();
	}

	componentDidUpdate(prevProps, prevState){
		if(prevState.layers !== this.state.layers && this.renderer){
			this.renderer.setLayers(this.state.layers);
			// 大气层开关切换:重画天空(关→纯黑真空/白天也黑、无地平辉光;开→恢复昼夜天空)+ 重投影(关折射后星体回真高度)。
			if(prevState.layers.atmosphere !== this.state.layers.atmosphere){
				this.renderer.refreshSky();
			}
			// 地面开关切换:按当前模式重算地面显隐(关→地表观测下可见地平线以下整个天球)。
			if(prevState.layers.ground !== this.state.layers.ground){
				this.renderer.refreshGroundLayer();
			}
			// 🚀 默认关贵图层:某层刚开 → 懒建该层(内部只建已开未建者;随后 4112 重投影定位、applyLayerVisibility 显隐)。
			this.renderer._buildOffLayers(false);
			// 星官(312)层刚打开且尚未建 → 懒构建一次(默认关不建省开场;此处补建,随后重投影定位、applyLayerVisibility 显隐)。
			if(this.state.layers.xingguan && !prevState.layers.xingguan){
				this.renderer.ensureChineseAsterismsBuilt();
			}
			// 🔴 切换图层后必须立即按当前时刻重投影:性能守卫会跳过隐藏层的重投影,使其停在旧时刻位置;
			// 重新打开时若不重算,就会与一直可见的图层错位(如二十八宿点 vs 宿区间)。一次重算消除所有此类错位。
			this.renderer.updateProjectedTime(this.state.time, this.getEffectiveFields(), this.refractionActiveState());
			// 行星轨迹层刚打开且当前数据无 trails → 触发一次带 includeTrails 的全量重取(默认关、不开不取 → 零额外请求)。
			if(this.state.layers.planetTrails && !prevState.layers.planetTrails && !(this.state.data && Array.isArray(this.state.data.trails) && this.state.data.trails.length)){
				this.requestState({ requestKind: 'full', reason: 'planet-trails', syncLabel: '计算行星轨迹...' });
			}
		}
		if(prevState.speed !== this.state.speed){
			this.setupPlayback();
			// perf:planetariumRenderGating —— 播放中恒满帧;停播时回落到静止降帧。
			if(this.renderer){ this.renderer.setPlaying(this.state.speed !== 0); }
		}
		if(prevState.viewMode !== this.state.viewMode && this.renderer){
			this.renderer.setViewMode(this.state.viewMode);
			// ① 切换地表观测/天球外观后立即重投影:天球外观去大气折射(几何原貌),地表观测带折射。显式传 override,不等相机动画。
			this.renderer.updateProjectedTime(this.state.time, this.getEffectiveFields(), this.refractionActiveState());
		}
		if(prevProps.fields !== this.props.fields){
			const time = buildObservationTime(this.props.fields);
			this.setState({
				time,
				selected: null,
				speed: 0,
			}, ()=>this.applyFastSceneChange('fields'));
		}
	}

	componentWillUnmount(){
		this._isUnmounted = true;
		document.removeEventListener('mousedown', this._onTimeEditorDocMouseDown, true);
		try{ document.body.classList.remove('planetarium-time-editing'); }catch(e){ /* no-op */ }
		if(this._onFullscreenChange){
			document.removeEventListener('fullscreenchange', this._onFullscreenChange);
			this._onFullscreenChange = null;
		}
		if(this._onVisibility){
			document.removeEventListener('visibilitychange', this._onVisibility);
			this._onVisibility = null;
		}
		if(this._timeEditDebounce){
			clearTimeout(this._timeEditDebounce);
			this._timeEditDebounce = null;
		}
		this.pushPerfLog('release', { canvasReleased: true });
		if(this.playTimer){
			cancelAnimationFrame(this.playTimer);
			this.playTimer = null;
		}
		if(this.metricTimer){
			clearTimeout(this.metricTimer);
			this.metricTimer = null;
		}
		if(this.backgroundFullTimer){
			clearTimeout(this.backgroundFullTimer);
			this.backgroundFullTimer = null;
		}
		if(this.renderer){
			this.renderer.dispose();
			this.renderer = null;
		}
	}

	markInteraction(){
		this.lastInteractionAt = nowMs();
	}

	// perf:planetariumRenderGating —— 依「可见 + 激活」决定渲染循环停/起。
	// 本组件仅在天文馆为激活 tab 时挂载(切走即卸载释放),故此处实质门控的是窗口隐藏/最小化;
	// 可见+激活时:照常满帧/降帧渲染,行为一字不动。
	_applyRenderActivity(){
		if(!this.renderer){
			return;
		}
		const gate = planetariumRenderGatingEnabled();
		const hidden = (typeof document !== 'undefined') && document.hidden;
		const shouldRun = gate ? ((this.props.active !== false) && !hidden) : true;
		if(shouldRun){
			this.renderer.startRenderLoop();
			this.renderer.renderOnce();
		}else{
			this.renderer.stopRenderLoop();
		}
	}

	scheduleBackgroundFull(options = {}){
		if(this._isUnmounted){
			return;
		}
		this.pendingFullRequest = {
			showLoading: false,
			requestKind: 'full',
			reason: options.reason || 'background-full',
			syncLabel: options.syncLabel || '补全天空...',
		};
		if(this.backgroundFullTimer){
			clearTimeout(this.backgroundFullTimer);
			this.backgroundFullTimer = null;
		}
		const waitMs = Math.max(1800, 3200 - (nowMs() - this.lastInteractionAt));
		this.backgroundFullTimer = setTimeout(()=>{
			this.backgroundFullTimer = null;
			if(this._isUnmounted || !this.pendingFullRequest){
				return;
			}
			if(nowMs() - this.lastInteractionAt < 1400){
				this.scheduleBackgroundFull(this.pendingFullRequest);
				return;
			}
			const request = this.pendingFullRequest;
			this.pendingFullRequest = null;
			this.requestState(request);
		}, waitMs);
	}

	schedulePendingFullRender(){
		if(this._isUnmounted || !this.pendingFullRender){
			return;
		}
		if(this.backgroundFullTimer){
			clearTimeout(this.backgroundFullTimer);
			this.backgroundFullTimer = null;
		}
		const waitMs = Math.max(1200, 2200 - (nowMs() - this.lastInteractionAt));
		this.backgroundFullTimer = setTimeout(()=>{
			this.backgroundFullTimer = null;
			if(this._isUnmounted || !this.pendingFullRender){
				return;
			}
			if(nowMs() - this.lastInteractionAt < 1200){
				this.schedulePendingFullRender();
				return;
			}
			const pending = this.pendingFullRender;
			this.pendingFullRender = null;
			this.finishStateData(pending);
		}, waitMs);
	}

	finishStateData(payload){
		const { data, requestKind, started, apiMs, followupFull } = payload || {};
		if(!data || this._isUnmounted){
			this.requestInFlight = false;
			return;
		}
		let renderMs = 0;
		if(this.renderer){
			renderMs = this.renderer.updateData(data, this.state.layers) || 0;
			// Re-project immediately through the SAME frontend pipeline that playback
			// and calibration use, so the paused frame == the first animated frame.
			// Previously the initial draw kept backend (swisseph) alt/az while playback
			// recomputed alt/az on the frontend, so labels sat off their lines and every
			// line/star snapped on the first play frame. (renderCachedState already does this.)
			renderMs += this.renderer.updateProjectedTime(this.state.time, this.getEffectiveFields()) || 0;
		}
		if(requestKind === 'full'){
			cachePlanetariumState(data);
		}
		const firstReadyMs = this.firstReadyLogged ? this.state.metrics.firstReadyMs : Math.round(nowMs() - this.mountedAt);
		this.firstReadyLogged = true;
		this.pushPerfLog(requestKind === 'light' ? 'light-ready' : 'state-ready', {
			apiMs,
			renderMs,
			totalMs: Math.round(nowMs() - started),
			stars: data.meta ? data.meta.renderedCatalogCount : 0,
			skyMode: data.sky ? data.sky.mode : undefined,
		});
		this.setState((prev)=>({
			data,
			loading: false,
			syncing: !!followupFull,
			syncLabel: followupFull ? '补全天空...' : '',
			error: null,
			metrics: {
				...prev.metrics,
				loadMs: Math.round(nowMs() - started),
				apiMs,
				renderMs,
				firstReadyMs,
				catalogCount: data.meta ? data.meta.renderedCatalogCount : 0,
			},
		}), ()=>{
			this.requestInFlight = false;
			this.flushPendingRequest();
			if(followupFull && !this._isUnmounted){
				this.scheduleBackgroundFull({
					reason: 'background-full',
					syncLabel: '补全天空...',
				});
			}
			// 第三阶段·后台补全完整星表:本次取的是亮集(starLimitForMag<9000)时,亮集已渲染(默认星等显示已完整),
			// 置 _starsWantFull → 后续 full 皆取完整,并后台补拉一次完整 8404 供搜索/拖滑块;_starsWantFull 守卫不重复触发。
			if(requestKind === 'full' && !this._starsWantFull && starLimitForMag(this.state.magLimit) < 9000 && !this._isUnmounted){
				this._starsWantFull = true;
				this.scheduleBackgroundFull({ reason: 'star-complete', syncLabel: '补全恒星…' });
			}
		});
	}

	bootstrapState(){
		const cached = getCachedPlanetariumState();
		if(cached && this.renderer){
			this.renderCachedState(cached);
			return;
		}
		if(this.renderer){
			this.renderer.createCardinals();
		}
		this.requestState({
			requestKind: 'light',
			reason: 'initial-light',
			syncLabel: '准备基础天空...',
			followupFull: true,
		});
	}

	renderCachedState(data){
		const started = nowMs();
		let renderMs = 0;
		if(this.renderer){
			renderMs = this.renderer.updateData(data, this.state.layers) || 0;
			renderMs += this.renderer.updateProjectedTime(this.state.time, this.getEffectiveFields()) || 0;
		}
		const firstReadyMs = this.firstReadyLogged ? this.state.metrics.firstReadyMs : Math.round(nowMs() - this.mountedAt);
		this.firstReadyLogged = true;
		this.pushPerfLog('cache-ready', {
			renderMs,
			totalMs: Math.round(nowMs() - started),
			stars: data.meta ? data.meta.renderedCatalogCount : 0,
		});
		this.setState((prev)=>({
			data,
			loading: false,
			syncing: false,
			syncLabel: '',
			error: null,
			metrics: {
				...prev.metrics,
				loadMs: Math.round(nowMs() - started),
				renderMs,
				firstReadyMs,
				catalogCount: data.meta ? data.meta.renderedCatalogCount : 0,
			},
		}));
		// 缓存可能是上次中途离开留下的亮集:若不完整(渲染星数明显少于完整 8404),后台补全完整星表供搜索/拖滑块。
		if(!this._starsWantFull && data && data.meta && Number(data.meta.renderedCatalogCount) > 0
			&& Number(data.meta.renderedCatalogCount) < 5000 && !this._isUnmounted){
			this._starsWantFull = true;
			this.scheduleBackgroundFull({ reason: 'star-complete-cache', syncLabel: '补全恒星…' });
		}
	}

	pushPerfLog(event, extra = {}){
		const row = {
			event,
			at: new Date().toISOString(),
			...extra,
		};
		if(typeof window !== 'undefined'){
			window[PLANETARIUM_PERF_KEY] = window[PLANETARIUM_PERF_KEY] || [];
			window[PLANETARIUM_PERF_KEY].push(row);
		}
		if(this._isUnmounted){
			return;
		}
		this.setState((prev)=>({
			perfLog: [row].concat(prev.perfLog || []).slice(0, 8),
		}));
	}

	getEffectiveFields(){
		const fields = this.props.fields || {};
		const observerOverride = this.state.observerOverride;
		if(!observerOverride){
			return fields;
		}
		return {
			...fields,
			lat: {
				...(fields.lat || { name: ['lat'] }),
				value: observerOverride.lat,
			},
			lon: {
				...(fields.lon || { name: ['lon'] }),
				value: observerOverride.lon,
			},
			gpsLat: {
				...(fields.gpsLat || { name: ['gpsLat'] }),
				value: observerOverride.gpsLat,
			},
			gpsLon: {
				...(fields.gpsLon || { name: ['gpsLon'] }),
				value: observerOverride.gpsLon,
			},
			pos: {
				...(fields.pos || { name: ['pos'] }),
				value: observerOverride.label,
			},
		};
	}

	changeObserverGeo(rec){
		if(!rec){
			return;
		}
		const gpsLat = rec.gpsLat !== undefined && rec.gpsLat !== null ? rec.gpsLat : rec.lat;
		const gpsLon = rec.gpsLng !== undefined && rec.gpsLng !== null ? rec.gpsLng : rec.lng;
		// 选新观测点 → 按新坐标自动校正时区（GeoCoordModal 未手改时区时只传坐标、由上层推断，
		// 与全 App 地点→时区口径一致：ZiWeiInput/NongLi/CnTradition）。rec.zone(手改)优先。
		// setZone 仅改时区标签、保留钟面时刻、不移位时间；applyFastSceneChange 会按新 time 重算天象。
		const time = this.state.time && this.state.time.clone ? this.state.time.clone() : this.state.time;
		if(time && time.setZone){
			try{
				if(rec.zone){
					time.setZone(rec.zone);
				}else{
					const ds = time.format ? time.format('YYYY-MM-DD') : null;
					const z = dstAwareZoneAt(gpsLat, gpsLon, ds);
					if(z && z.offset){ time.setZone(z.offset); }
				}
			}catch(e){ /* 推断失败保留原时区 */ }
		}
		this.setState({
			time,
			observerOverride: {
				lat: convertLatToStr(rec.lat),
				lon: convertLonToStr(rec.lng),
				gpsLat,
				gpsLon,
				// 观测点地名:经纬度查找带回则用其名(城市/区县),否则回退通用「自选观测点」。
				label: (rec && rec.name) ? `${rec.name}` : '自选观测点',
			},
			selected: null,
			speed: 0,
		}, ()=>this.applyFastSceneChange('observer'));
	}

	clearObserverOverride(){
		if(!this.state.observerOverride){
			return;
		}
		this.setState({
			observerOverride: null,
			selected: null,
			speed: 0,
		}, ()=>this.applyFastSceneChange('observer-reset'));
	}

	// 🆕 手动改时间(点开 DateTimeSelector 弹框 → 确定后跳到该时刻重算天象)。
	// 先 speed:0 暂停(走 setupPlayback 既有暂停路径,避免改时间后跳变)+ selected:null,
	// 再 applyFastSceneChange('time') 离散重算整盘+右栏(与 changeObserverGeo 同路径)。
	changeObserverTime(res){
		const dt = (res && res.value && res.value.clone) ? res.value.clone() : (res && res.value) || null;
		if(!dt){ return; }
		if(typeof dt.calcJdn === 'function'){ try{ dt.calcJdn(); }catch(e){ /* 保留现值 */ } }
		// 🔴 改时间=「离散大跳」(可达上千年)。两件事都必须做,否则星体被外推到乱位(太阳脱离黄道):
		//  ① 重置外推基线:`updateProjectedTime` 永远按 `_baseLon + speed×(jd − _calibJd)` 外推;_calibJd 仍停在
		//     旧时刻 → 大跳后 dtJd 达数十万天 → 即便重取真实 _baseLon 也被巨 dtJd 乘乱。置 _calibJd=null(下次
		//     渲染重设为新 jd → dtJd=0=零外推)+ 清各 body _baseLon/_baseLat(重锚到新真实位置)。
		//  ② requestState 全量重取后端真实位置(buildRequestParams 用 this.state.time=dt),而非 applyFastSceneChange 外推。
		if(this.renderer){
			this.renderer._calibJd = null;
			const meshes = this.renderer.projectableMeshes || [];
			meshes.forEach((item)=>{ if(item && item.source){ item.source._baseLon = undefined; item.source._baseLat = undefined; } });
		}
		// speed:0 暂停 + selected:null;面板只在「确定」时关。requestState 内置 in-flight 合并,连改字段也安全。
		if(res && res.confirmed){
			try{ document.body.classList.remove('planetarium-time-editing'); }catch(e){ /* no-op */ }
			document.removeEventListener('mousedown', this._onTimeEditorDocMouseDown, true);
		}
		const confirmed = !!(res && res.confirmed);
		const fireRequest = ()=>{
			if(this._isUnmounted){ return; }
			this.requestState({ requestKind: 'full', reason: 'time-edit', syncLabel: '重算此时天空...' });
		};
		this.setState({
			time: dt,
			selected: null,
			speed: 0,
			...(confirmed ? { timeEditorOpen: false } : {}),
		}, ()=>{
			// C 去抖:显示与外推基线已同步更新(即时实时);只把「后端整盘重算」合并 —— 连续 +/- 期间不重复打后端,
			//   「确定」或关总开关 → 立即重算。requestState 触发时读当下 this.state.time(=最后一次 setState 的值)→
			//   最终结果精确无误,只是省掉中间多余的来回与 syncing 闪烁(不改任何计算内容)。
			if(this._timeEditDebounce){ clearTimeout(this._timeEditDebounce); this._timeEditDebounce = null; }
			if(confirmed || !planetariumTimeEditDebounceEnabled()){
				fireRequest();
			}else{
				this._timeEditDebounce = setTimeout(()=>{ this._timeEditDebounce = null; fireRequest(); }, 220);
			}
		});
	}

	// 时间编辑面板:自控开合(不用 antd Popover,避免其受控 click-outside 与嵌套 Select 下拉互相抢闭)。
	toggleTimeEditor(){
		const next = !this.state.timeEditorOpen;
		// 面板用 position:fixed(逃出左栏 overflow:auto 的裁切),坐标按时间显示元素实时算。
		let pos = this.state.timeEditorPos || null;
		if(next && this._timeDisplayRef.current){
			const r = this._timeDisplayRef.current.getBoundingClientRect();
			const W = 360;
			let left = r.left;
			if(left + W > window.innerWidth - 8){ left = Math.max(8, window.innerWidth - 8 - W); }
			pos = { top: Math.round(r.bottom + 6), left: Math.round(left) };
		}
		this.setState({ timeEditorOpen: next, timeEditorPos: pos });
		try{ document.body.classList.toggle('planetarium-time-editing', next); }catch(e){ /* no-op */ }
		if(next){
			// 用 capture + setTimeout 错开本次点击,避免立即触发自己的 outside 判定。
			setTimeout(()=>{ document.addEventListener('mousedown', this._onTimeEditorDocMouseDown, true); }, 0);
		}else{
			document.removeEventListener('mousedown', this._onTimeEditorDocMouseDown, true);
		}
	}

	_closeTimeEditor(){
		this.setState({ timeEditorOpen: false });
		try{ document.body.classList.remove('planetarium-time-editing'); }catch(e){ /* no-op */ }
		document.removeEventListener('mousedown', this._onTimeEditorDocMouseDown, true);
	}

	_onTimeEditorDocMouseDown(e){
		const t = e.target;
		if(!t){ return; }
		const inEditor = this._timeEditorRef.current && this._timeEditorRef.current.contains(t);
		const onDisplay = this._timeDisplayRef.current && this._timeDisplayRef.current.contains(t);
		// 点在 antd 下拉(Select/DatePicker 弹层,渲染到 body 的门户)上 → 视为编辑器内交互,不关。
		const inAntdPopup = t.closest && t.closest('.ant-select-dropdown, .xq-select-popup, .ant-picker-dropdown, .rc-virtual-list');
		if(inEditor || onDisplay || inAntdPopup){ return; }
		this._closeTimeEditor();
	}

	setupPlayback(){
		if(this.playTimer){
			cancelAnimationFrame(this.playTimer);
			this.playTimer = null;
		}
		const speed = Number(this.state.speed || 0);
		if(!speed){
			// 🆕 暂停时优先用「真实最后一帧 frame_jd」(playbackLastFrameTime,frame() 每帧记的精确播放时刻)
			// 而非 state.time(落后 0-120ms × prevSpeed,3600x 下可达 432s 模拟 = 月亮 0.06° 跳)。
			// 把 state.time 与 src 字段都对齐到 pauseTime → mesh.position 与右栏数字与用户视觉位置三处完全一致,无瞬移。
			const pauseTime = this.playbackLastFrameTime || this.state.time;
			this.playbackAnchorTime = null;
			this.playbackAnchorMs = 0;
			this.playbackLastFrameMs = 0;
			this.playbackLastStateMs = 0;
			this.playbackLastMetricMs = 0;
			// ⚠ 不清 playbackLastFrameTime!保留它作「暂停瞬间真实时刻」给下次开始播放做 anchor。
			// 之前清掉后,开始播放分支 fallback 用 state.time(落后 0-120ms × prevSpeed,3600x 下 ≈100s 模拟),
			// 帧循环第一帧 next = anchor + 0 = state.time = B 位置 → mesh 瞬间跳到 B → 快速追上 A → 用户看到「先跳到 B 闪一下再回 A」。
			// 改为保留 → 下次播放 anchor = pauseTime(真实瞬间) → 从 A 平滑开始,无任何跳变。
			if(this.renderer && this.state.data){
				this.renderer.updateProjectedTime(pauseTime, this.getEffectiveFields());
			}
			// 🆕 暂停时只 forceUpdate 不 setState({time}) — 因 setState 会触发 React commit → componentDidUpdate → re-render → renderSelected 重算 alt/az → 一连串 setState 链让 state.time 在暂停后被多次改写 → mesh 跳动。
			// state.time 保持 frame() 最后一次 setState({time:next}) 的值(落后 0-120ms),right panel 受这点影响微小(alt/az 偏几度方位角),
			// 但 mesh.position 已 mutate 到 pauseTime 时刻、整个 scene 静止 → 用户视觉上「暂停=完全凝固」是最重要的体验。
			// 同时清掉 _pendingCalib:它含暂停前最后一次 sync 的旧 body 数据,若被后续 flushPendingCalib 合并到 state.data 会让右栏跳回 sync 时刻数据。
			this._pendingCalib = null;
			if(!this._isUnmounted){
				this.forceUpdate();
			}
			return;
		}
		this.playbackAnchorMs = nowMs();
		// 🆕 优先用 playbackLastFrameTime(上次暂停瞬间真实时刻)做 anchor — state.time 暂停后落后 0-120ms × prevSpeed,
		// 第一帧推到落后位置 B → 用户看到「点播放瞬间跳回 B 然后跳回 A 继续」。用真实时刻 anchor 无跳变。
		// 首次启动播放(没暂停过): playbackLastFrameTime 不存在,fallback state.time(初次也无差异)。
		const anchorBase = this.playbackLastFrameTime || this.state.time;
		this.playbackAnchorTime = anchorBase.clone ? anchorBase.clone() : anchorBase;
		this.playbackLastFrameTime = null; // 用过即清,下次暂停帧循环重新记录
		this.playbackLastFrameMs = this.playbackAnchorMs;
		this.playbackLastStateMs = this.playbackAnchorMs;
		this.playbackLastMetricMs = this.playbackAnchorMs;
		const frame = ()=>{
			if(this._isUnmounted || Number(this.state.speed || 0) !== speed){
				this.playTimer = null;
				return;
			}
			const frameMs = nowMs();
			const elapsedSeconds = Math.max(0, (frameMs - this.playbackAnchorMs) / 1000);
			const next = this.playbackAnchorTime.clone();
			next.addSecond(speed * elapsedSeconds);
			this.playbackLastFrameTime = next; // 🆕 每帧记真实最新播放时刻(暂停时用这个对齐 mesh+右栏,而非落后 120ms 的 state.time)
			this.applyLocalPlaybackFrame(speed, next, frameMs);
			this.maybeSyncPlayback(speed, next);
			if(frameMs - this.playbackLastStateMs >= 120){
				this.playbackLastStateMs = frameMs;
				// 🚀 有待并校准数据则搭这次 setState({time}) 便车一起更新右栏(无额外重渲);否则只更新时间。
				const pc = this._pendingCalib;
				if(pc){
					this._pendingCalib = null;
					this.setState((prev)=>({ time: next, ...this._mergeCalib(prev, pc) }));
				}else{
					this.setState({ time: next });
				}
			}
			this.playbackLastFrameMs = frameMs;
			this.playTimer = requestAnimationFrame(frame);
		};
		this.playTimer = requestAnimationFrame(frame);
	}

	applyLocalPlaybackFrame(speed, frameTime, frameMs){
		if(!this.renderer || !this.state.data){
			return;
		}
		const renderMs = this.renderer.updateProjectedTime(frameTime || this.state.time, this.getEffectiveFields());
		const metricMs = frameMs || nowMs();
		if(metricMs - this.playbackLastMetricMs >= 500){
			this.playbackLastMetricMs = metricMs;
			this.setState((prev)=>({
				metrics: {
					...prev.metrics,
					renderMs,
					loadMs: 0,
				},
			}));
		}
	}

	maybeSyncPlayback(speed, frameTime){
		const now = nowMs();
		const aspeed = Math.abs(speed); // 反向播放(负速度)也按速率定重取节奏;原 speed<=60 对负值恒真→反向永远落到 15s 慢档
		let syncEvery = aspeed <= 60 ? 15000 : (aspeed <= 86400 ? 7000 : 5000);
		if(this.state.selected && this.state.selected.layer === 'body'){ syncEvery = Math.min(syncEvery, 800); } // 选中体:右栏轨道量随播放更跟手 + 把 calib 间隔(3600x≈50min 模拟)二阶外推误差降到 <0.001°(肉眼绝对不可见)
		if(now - this.lastPlaybackSyncAt < syncEvery){
			return;
		}
		this.lastPlaybackSyncAt = now;
		this.requestPlaybackCalibration(frameTime);
	}

	// 播放校准数据并入 state 的统一合并器(单步直接 setState / 播放搭 120ms 便车 / 停播放 flush 共用)。
	_mergeCalib(prev, pc){
		return {
			data: {
				...prev.data,
				bodies: pc.bodies || prev.data.bodies,
				sky: pc.sky || prev.data.sky,
				events: pc.events || prev.data.events,
				meta: { ...(prev.data.meta || {}), ...(pc.meta || {}), renderedCatalogCount: prev.data.meta ? prev.data.meta.renderedCatalogCount : 0 },
			},
			metrics: { ...prev.metrics, apiMs: pc.apiMs, renderMs: pc.renderMs },
		};
	}

	flushPendingCalib(){
		const pc = this._pendingCalib;
		if(pc){ this._pendingCalib = null; this.setState((prev)=>this._mergeCalib(prev, pc)); }
	}

	async requestPlaybackCalibration(syncTimeArg){
		if(this.playbackSyncInFlight || !this.state.data){
			return;
		}
		this.playbackSyncInFlight = true;
		const syncTime = syncTimeArg && syncTimeArg.clone ? syncTimeArg.clone() : this.state.time.clone();
		const apiStarted = nowMs();
		try{
			const rsp = await fetchPlanetariumState(buildPlaybackSyncParams(this.getEffectiveFields(), syncTime, this.planetariumExtras()));
			const data = rsp && rsp.Result ? rsp.Result : rsp;
			if(!data || data.err || this._isUnmounted || !this.renderer){
				return;
			}
			const apiMs = Math.round(nowMs() - apiStarted);
			// 🚀 播放中:apply 跳过冗余重投影(帧循环每帧已做)。单步无帧循环 → 需重投影。
			const playing = Number(this.state.speed || 0) !== 0;
			// 🆕 暂停期间收到 in-flight calibration 响应:完全 abort 不做任何 mutate/setState。
			// 否则 calibration 会重设 _baseLon/_calibJd + updateProjectedTime → src.lon 跳变(用户描述的 A→B 第二次跳)。
			// 暂停时 scene 应该完全锁定:setupPlayback 已 mutate src 到 pauseTime 时刻位置,显示完全正确,不需要后续 sync 数据。
			// 下次开始播放时新 calibration 自然会基于当前 pauseTime 计算 → seamless 衔接,零回归。
			if(!playing){
				return;
			}
			// 🆕 displayTime = 当前 React state.time(单步=stepTime):重投影到当前显示时刻而非 syncTime
			const displayTime = this.state.time && this.state.time.clone ? this.state.time.clone() : syncTime;
			const renderMs = this.renderer.applyPlaybackCalibration(data, syncTime, this.getEffectiveFields(), playing, displayTime);
			const pc = { bodies: data.bodies, sky: data.sky, events: data.events, meta: data.meta, apiMs, renderMs };
			if(playing){
				// 🚀 校准已 imperative 修正 3D;右栏数据存为待并项,搭下一次 120ms setState({time}) 便车更新 → 消除每 2.5s 的额外整组件重渲尖峰(实测每次校准帧从 25ms 降到基线)。
				this._pendingCalib = pc;
			}else{
				this.setState((prev)=>this._mergeCalib(prev, pc));
			}
		}finally{
			this.playbackSyncInFlight = false;
		}
	}

	applyFastSceneChange(reason){
		if(!this.renderer || !this.state.data){
			this.requestState({
				showLoading: false,
				reason,
				requestKind: 'light',
				followupFull: true,
				syncLabel: '更新基础天空...',
			});
			return;
		}
		const renderMs = this.renderer.updateProjectedTime(this.state.time, this.getEffectiveFields());
		this.setState((prev)=>({
			syncing: true,
			syncLabel: '后台校准天空...',
			metrics: {
				...prev.metrics,
				renderMs,
				loadMs: 0,
			},
		}));
		this.scheduleBackgroundFull({
			reason,
			syncLabel: '后台校准天空...',
		});
	}

	async requestSceneCalibration(syncTimeArg, reason){
		if(this.sceneSyncInFlight || !this.state.data){
			return;
		}
		this.sceneSyncInFlight = true;
		const syncTime = syncTimeArg && syncTimeArg.clone ? syncTimeArg.clone() : this.state.time.clone();
		const fields = this.getEffectiveFields();
		const apiStarted = nowMs();
		try{
			const rsp = await fetchPlanetariumState(buildSceneSyncParams(fields, syncTime, this.planetariumExtras()));
			const data = rsp && rsp.Result ? rsp.Result : rsp;
			if(!data || data.err || this._isUnmounted || !this.renderer){
				return;
			}
			const apiMs = Math.round(nowMs() - apiStarted);
			let renderMs = this.renderer.updateData(data, this.state.layers) || 0;
			renderMs += this.renderer.updateProjectedTime(syncTime, fields) || 0;
			this.pushPerfLog('scene-sync', {
				reason,
				apiMs,
				renderMs,
				stars: data.meta ? data.meta.renderedCatalogCount : 0,
			});
			this.setState((prev)=>{
				const merged = {
					...prev.data,
					...data,
					stars: prev.data && prev.data.stars ? prev.data.stars : data.stars,
					meta: {
						...(prev.data && prev.data.meta ? prev.data.meta : {}),
						...(data.meta || {}),
						renderedCatalogCount: prev.data && prev.data.meta ? prev.data.meta.renderedCatalogCount : 0,
					},
				};
				return {
					data: merged,
					syncing: false,
					syncLabel: '',
					loading: false,
					metrics: {
						...prev.metrics,
						apiMs,
						renderMs,
					},
				};
			}, ()=>{ cachePlanetariumState(this.state.data); });
		}finally{
			this.sceneSyncInFlight = false;
		}
	}

	async requestState(options = {}){
		const opts = options || {};
		if(this.requestInFlight){
			this.pendingRequestOptions = {
				showLoading: false,
				reason: opts.reason || 'pending',
				requestKind: opts.requestKind || 'full',
				syncLabel: opts.syncLabel,
				followupFull: opts.followupFull,
			};
			return;
		}
		this.requestInFlight = true;
		const seq = ++this.reqSeq;
		const started = nowMs();
		const requestKind = opts.requestKind === 'light' ? 'light' : 'full';
		const showLoading = false;
		const syncLabel = opts.syncLabel || (requestKind === 'light' ? '准备基础天空...' : '补全天空...');
		this.setState({
			loading: showLoading,
			syncing: true,
			syncLabel,
			error: null,
		});
		const extras = this.planetariumExtras();
		const params = requestKind === 'light'
			? buildInitialSceneParams(this.getEffectiveFields(), this.state.time, extras)
			: buildRequestParams(this.getEffectiveFields(), this.state.time, extras);
		const apiStarted = nowMs();
		let rsp = null;
		try{
			rsp = await fetchPlanetariumState(params);
		}catch(err){
			rsp = { err: err && err.message ? err.message : '天文馆数据载入失败' };
		}
		const apiMs = Math.round(nowMs() - apiStarted);
		if(seq !== this.reqSeq){
			this.requestInFlight = false;
			this.flushPendingRequest();
			return;
		}
		const data = rsp && rsp.Result ? rsp.Result : rsp;
		if(this._isUnmounted){
			this.requestInFlight = false;
			return;
		}
		if(!data || data.err){
			this.pushPerfLog('request-error', { apiMs, err: data && data.err ? data.err : 'empty' });
			this.setState({
				loading: false,
				syncing: false,
				syncLabel: '',
				error: data && data.err ? data.err : '天文馆数据载入失败',
			});
			this.requestInFlight = false;
			this.flushPendingRequest();
			return;
		}
		const payload = {
			data,
			requestKind,
			started,
			apiMs,
			followupFull: opts.followupFull,
		};
		if(requestKind === 'full' && nowMs() - this.lastInteractionAt < 700){
			this.pendingFullRender = payload;
			this.requestInFlight = false;
			this.schedulePendingFullRender();
			return;
		}
		this.finishStateData(payload);
	}

	flushPendingRequest(){
		if(!this.pendingRequestOptions || this._isUnmounted){
			return;
		}
		const opts = this.pendingRequestOptions;
		this.pendingRequestOptions = null;
		setTimeout(()=>this.requestState({
			...opts,
			showLoading: false,
		}), 0);
	}

	// React 侧大气折射判据(与渲染端 refractionActive 同义):地表观测 + 大气层开。
	// 用于显式传 applyRefractionOverride、详情面板视位置计算 —— 关大气层即真空几何(不抬升)。
	refractionActiveState(){
		return this.state.viewMode === 'ground' && !!(this.state.layers && this.state.layers.atmosphere);
	}

	toggleLayer(key){
		this.setState((prev)=>({
			layers: {
				...prev.layers,
				[key]: !prev.layers[key],
			},
		}));
	}

	// 升落/轨迹门控:仅当对应开关开启才注入 include* → 后端默认零开销、零字节回归(buildRequestParams 默认 extras={})。
	// 行星轨迹默认 ±45 天(后端默认),这里只在开时显式带 includeTrails;升落同理。
	planetariumExtras(){
		const extras = {};
		if(this.state.layers && this.state.layers.planetTrails){ extras.includeTrails = 1; }
		extras.includeRiseSet = 1; // 升落时刻默认开:每次请求都带 → 详情区始终显各星精确升/中天/落(用户:不该是开关、应默认精确)
		// 星等匹配取数:默认只取当前星等上限所需的最亮星(payload ~10x 小 → 首次显星快);
		// 后台补全完成后(_starsWantFull)所有 full 请求改取完整 8404 → 搜索/拖滑块全程不缺星。
		extras.starLimit = this._starsWantFull ? 9000 : starLimitForMag(this.state.magLimit);
		return extras;
	}

	// 升落时刻开关:开 → 触发一次带 includeRiseSet 的全量重取,详情区显该星升/中天/落;关 → 下次重取不带参(零开销)。
	toggleRiseSet(){
		this.setState((prev)=>({ riseSetRequested: !prev.riseSetRequested }), ()=>{
			if(this.state.riseSetRequested){
				this.requestState({ requestKind: 'full', reason: 'rise-set', syncLabel: '计算升落时刻...' });
			}
		});
	}

	toggleGroup(id){
		this.setState((prev)=>{
			const next = new Set(prev.collapsedGroups);
			if(next.has(id)){ next.delete(id); }else{ next.add(id); }
			return { collapsedGroups: next };
		});
	}

	// 星等过滤滑块:仅改恒星显隐(重应用 alpha),不重拉数据。默认 6.5 = 全显(零回归)。
	changeMagLimit(e){
		const raw = e && e.target ? e.target.value : e;
		const next = Number(raw);
		const magLimit = Number.isFinite(next) ? clamp(next, STAR_MAG_LIMIT_MIN, STAR_MAG_LIMIT_MAX) : STAR_MAG_LIMIT_MAX;
		this.setState({ magLimit });
		if(this.renderer){ this.renderer.setMagLimit(magLimit); }
	}

	// 角距测量开关。关闭时渲染端会清起点+连线+读数。
	toggleMeasureMode(){
		this.setState((prev)=>({ measureMode: !prev.measureMode, measureInfo: null }), ()=>{
			if(this.renderer){ this.renderer.setMeasureMode(this.state.measureMode); }
		});
	}

	applyPreset(){
		this.setState((prev)=>({ layers: {...prev.layers, ...PROFESSIONAL_LAYERS}, collapsedGroups: new Set() }));
	}

	resetLayers(){
		this.setState({ layers: {...DEFAULT_LAYERS}, riseSetRequested: false, collapsedGroups: new Set(['scales', 'poles']) });
	}

	changeSpeed(speed){
		this.lastPlaybackSyncAt = nowMs();
		// 🆕 暂停时 setupPlayback(componentDidUpdate 触发) 已完整处理:用 playbackLastFrameTime mutate src/mesh 到 pauseTime=A 位置 + setState({time:pauseTime}) 对齐 React state。
		// 原来这里的 snap 逻辑(applyLocalPlaybackFrame(0) + requestPlaybackCalibration(state.time))会引入双跳:applyLocalPlaybackFrame 用落后 120ms 的 state.time 重投影 → 整个 scene 被拉回 B(几秒前)。删除即修。
		// 右栏轨道量:setupPlayback 已 mutate src.lon/lat/ra/decl/zodiacSign/zodiacDegree/house 到 pauseTime 外推值,state.data.bodies[i] === item.source 同引用 → 右栏直接拿到外推值。
		this.setState({ speed });
	}

	changeViewMode(viewMode){
		this.setState({ viewMode });
	}

	jumpNow(){
		this.setState({
			time: buildObservationTime(this.props.fields),
			speed: 0,
		}, ()=>this.applyFastSceneChange('jump'));
	}

	stepTime(amount, unit){
		this.setState((prev)=>{
			const next = prev.time.clone();
			next.add(amount, unit);
			return {
				time: next,
				speed: 0,
			};
		}, ()=>{
			if(this.renderer && this.state.data){
				this.applyLocalPlaybackFrame(0);
				this.requestPlaybackCalibration(this.state.time);
			}else{
				this.requestState({ showLoading: false, reason: 'step' });
			}
		});
	}

	setSearchQuery(e){
		this.setState({
			searchQuery: e && e.target ? e.target.value : '',
			searchMessage: '',
		});
	}

	searchTarget(){
		const query = `${this.state.searchQuery || ''}`.trim();
		if(!query){
			this.setState({ searchMessage: '输入天体、宿名或北斗星名' });
			return;
		}
		if(!this.renderer){
			return;
		}
		const picked = this.renderer.flyTo(query);
		if(picked && picked !== true){
			this.setState({
				selected: picked,
				searchMessage: `已定位：${bodyName(picked)}`,
			});
			return;
		}
		this.setState({ searchMessage: '没有找到匹配天体' });
	}

	toggleLeftPanel(){
		this.setState((prev)=>({
			leftCollapsed: !prev.leftCollapsed,
		}), ()=>{
			if(this.renderer && this.renderer.engine){
				setTimeout(()=>this.renderer.engine.resize(), 120);
			}
		});
	}

	toggleFullscreen(){
		const node = this.canvasRef.current && this.canvasRef.current.parentNode;
		if(!node){
			return;
		}
		if(document.fullscreenElement){
			document.exitFullscreen();
		}else if(node.requestFullscreen){
			node.requestFullscreen();
		}
	}

	toggleImmersive(){
		this.setState((prev)=>({ immersive: !prev.immersive }), ()=>{
			if(this.renderer && this.renderer.engine){
				setTimeout(()=>this.renderer.engine.resize(), 320); // 等 .28s CSS 过渡结束后再 resize，避免按中间尺寸算
			}
		});
	}

	renderLayerButton(key, label, legendDot){
		return (
			<button
				key={key}
				type="button"
				className={`planetarium-chip ${this.state.layers[key] ? 'is-on' : ''} ${legendDot ? 'has-legend' : ''}`}
				onClick={()=>this.toggleLayer(key)}
			>
				{legendDot ? <span className={`planetarium-legend-dot ${legendDot}`} /> : null}
				{label}
			</button>
		);
	}

	jdToClock(jd){
		const t = this.state.time;
		if(!t || !Number.isFinite(Number(jd))){ return '--'; }
		let zoneJdn = 0;
		try { zoneJdn = (typeof t.getZoneJdn === 'function') ? t.getZoneJdn() : 0; } catch(e){ zoneJdn = 0; }
		const locjdn = Number(jd) + zoneJdn + 0.5; // 与 DateTime 本地时推导一致
		let frac = locjdn - Math.floor(locjdn);
		if(frac < 0){ frac += 1; }
		let mins = ((Math.round(frac * 1440) % 1440) + 1440) % 1440;
		const hh = Math.floor(mins / 60);
		const mm = mins % 60;
		return `${`${hh}`.padStart(2, '0')}:${`${mm}`.padStart(2, '0')}`;
	}

	// 角距测量读数(任务 4):测量模式开时显示进度/结果。
	renderMeasure(){
		if(!this.state.measureMode){ return null; }
		const info = this.state.measureInfo;
		if(!info){
			return <div className="planetarium-measure"><h4>角距测量</h4><p>点选第一点…</p></div>;
		}
		if(info.stage === 'first'){
			return (
				<div className="planetarium-measure">
					<h4>角距测量</h4>
					<div><span>起点</span><strong>{info.startLabel || '—'}</strong></div>
					<p>再点选第二点…</p>
				</div>
			);
		}
		return (
			<div className="planetarium-measure">
				<h4>角距测量</h4>
				<div><span>起点</span><strong>{info.startLabel || '—'}</strong></div>
				<div><span>终点</span><strong>{info.endLabel || '—'}</strong></div>
				<div className="planetarium-measure-result"><span>角距</span><strong>{formatDeg(info.separation)}</strong></div>
				<p>再点选可重置并重新测量</p>
			</div>
		);
	}

	// 点击空白天区的坐标读数(任务 3):赤经赤纬 / 黄经黄纬 / 方位高度。
	renderSkyReadout(){
		const r = this.state.skyReadout;
		if(!r || this.state.measureMode){ return null; } // 测量模式下不并显,避免干扰
		return (
			<div className="planetarium-sky-readout">
				<h4>天区方向</h4>
				<div><span>赤经 / 赤纬</span><strong>{formatRa(r.ra)} / {formatDeg(r.decl)}</strong></div>
				<div><span>黄经 / 黄纬</span><strong>{formatDeg(r.eclLon)} / {formatDeg(r.eclLat)}</strong></div>
				<div><span>方位 / 高度</span><strong>{formatDeg(r.azimuth)} / {formatDeg(r.altitudeAppa)}</strong></div>
			</div>
		);
	}

	renderSelected(){
		const selected = this.state.selected;
		if(!selected){
			if(this.state.skyReadout || this.state.measureMode){ return null; } // 已有读数/测量时不再显空提示
			return <div className="planetarium-empty">点击太阳、月亮、行星、二十八宿或北斗星点查看详情</div>;
		}
		// 选中体随播放/改日期/改经纬度实时刷新:this.state.selected 只是点击那一刻的快照,其轨道星历(赤经赤纬/黄经/距离/相位…)不会自更新。
		// 从最新 state.data.bodies(播放每次重取都合并)按 id 取实时体覆盖之;alt/az 等观测量下方每帧重投影、升落走 rsEvents,均已实时。星(stars)位置恒定→不覆盖。
		let item = selected;
		if(selected.layer === 'body' && this.state.data && Array.isArray(this.state.data.bodies)){
			const fresh = this.state.data.bodies.find((b)=>b && (b.id === selected.id || b.name === selected.name));
			if(fresh){ item = { ...selected, ...fresh }; }
		}
		const jd = this.state.time.jdn || this.state.time.calcJdn();
		const obs = observerFromFields(this.getEffectiveFields(), this.state.data);
		// 地平坐标/可见性须按「当前时刻」实时重投影覆盖:state.data.bodies 里的 alt/az 是后端上次重取时刻的值,
		// 播放/改时后会与下方实时「真/视高度」差几十度自相矛盾;统一用当前 jd 重算(赤经赤纬等轨道量仍用重取值)。
		const proj = (valuePresent(item.ra) && valuePresent(item.decl)) ? projectedEquatorialItem(item, jd, obs, this.refractionActiveState()) : null;
		if(proj){ item = { ...item, altitudeAppa: proj.altitudeAppa, azimuth: proj.azimuth, visible: proj.visible, horizonState: proj.horizonState }; }
		const baseRows = detailRowsForItem(item, this.state.data && this.state.data.sky ? this.state.data.sky.moonPhase : null);
		const extra = [];
		if(proj){
			const ra = Number.isFinite(Number(proj.ra)) ? proj.ra : item.ra;
			const decl = Number.isFinite(Number(proj.decl)) ? proj.decl : item.decl;
			extra.push(['时角', formatHourAngle(hourAngleDeg(jd, obs.lon, ra))]);
			extra.push(['本地恒星时', formatRa(localSiderealDeg(jd, obs.lon))]);
			extra.push(['真/视高度', `${formatDeg(proj.altitudeTrue)} / ${formatDeg(proj.altitudeAppa)}`]);
			// 升落时刻:开「升落时刻」开关重取后显后端权威值(swe.rise_trans,当日历元真赤道、与 bodies 同口径);
			// 此时**不再**显本地简化估算行,避免同一面板两组(月亮可差几分钟)互不一致打架。未开关才显估算行(零回归)。
			const rsEvents = this.state.data && this.state.data.events && this.state.data.events.riseSet;
			const rs = (rsEvents && (rsEvents[item.id] || rsEvents[item.name])) || (item.riseSet); // 优先 state.data 实时升落(播放/改日期/改经纬度后刷新);item.riseSet 是点击时快照仅作兜底
			if(rs){
				extra.push(['升', rs.rise && rs.rise.time ? rs.rise.time : '不升']);
				extra.push(['中天', rs.transit && rs.transit.time ? rs.transit.time : '—']);
				extra.push(['落', rs.set && rs.set.time ? rs.set.time : '不落']);
			}else{
				const rts = riseTransitSet(ra, decl, jd, obs);
				extra.push(['升/中天/落(估算)', rts.circumpolar ? '恒显' : (rts.neverRises ? '恒隐' : `${this.jdToClock(rts.riseJd)} / ${this.jdToClock(rts.transitJd)} / ${this.jdToClock(rts.setJd)}`)]);
			}
		}
		const rows = baseRows.concat(extra.filter((r)=>valuePresent(r[1])));
		const subtitle = item.kind === 'catalogStar' || item.layer === 'stars'
			? catalogIdText(item)
			: bodyEnglishName(item);
		return (
			<div className="planetarium-detail">
				<h3>{bodyName(item)}</h3>
				{valuePresent(subtitle) ? <p>{subtitle}</p> : null}
				{rows.map((row)=>(
					<div key={row[0]}><span>{row[0]}</span><strong>{row[1]}</strong></div>
				))}
			</div>
		);
	}

	render(){
		const { metrics, data } = this.state;
		const sky = data && data.sky ? data.sky : {};
		const moonPhase = sky.moonPhase;
		const effectiveFields = this.getEffectiveFields();
		const observerName = this.state.observerOverride
			? this.state.observerOverride.label
			: (data && data.observer ? data.observer.locationName : '未命名地点');
		const observerLon = effectiveFields && effectiveFields.lon ? effectiveFields.lon.value : '--';
		const observerLat = effectiveFields && effectiveFields.lat ? effectiveFields.lat.value : '--';
		const observerGpsLon = effectiveFields && effectiveFields.gpsLon ? effectiveFields.gpsLon.value : null;
		const observerGpsLat = effectiveFields && effectiveFields.gpsLat ? effectiveFields.gpsLat.value : null;
		const sceneJd = this.state.time.jdn || this.state.time.calcJdn();
		const sceneObs = observerFromFields(effectiveFields, data);
		const sceneLst = formatRa(localSiderealDeg(sceneJd, sceneObs.lon));
		const sceneEps = formatDeg(meanObliquityDeg(sceneJd));
		return (
			<div className={`horosa-planetarium-page ${this.state.leftCollapsed ? 'is-left-collapsed' : ''} ${this.state.immersive ? 'is-immersive' : ''}`}>
				<aside className="planetarium-side planetarium-left">
					<div className="planetarium-title">
						<small>地表观测天空</small>
						<h2>天文馆</h2>
						<button type="button" className="planetarium-collapse" onClick={this.toggleLeftPanel} aria-label={this.state.leftCollapsed ? '展开' : '收合'}>
							<XQIcon name="prev" />
						</button>
					</div>
					<div className="planetarium-time" style={{ position: 'relative' }}>
						<div ref={this._timeDisplayRef} className={`planetarium-time-display${this.state.timeEditorOpen ? ' is-editing' : ''}`} role="button" title="点击修改时间" onClick={this.toggleTimeEditor}>{this.state.time.format('YYYY-MM-DD HH:mm:ss')}</div>
						{this.state.timeEditorOpen ? (
							<div ref={this._timeEditorRef} className="planetarium-time-editor" style={this.state.timeEditorPos ? { top: this.state.timeEditorPos.top, left: this.state.timeEditorPos.left } : undefined}>
								<PlanetariumTimeEditor time={this.state.time} onChange={this.changeObserverTime} />
							</div>
						) : null}
						<small>{this.state.time.zone} · {observerName}</small>
						<div className="planetarium-observer-line">
							<span>{observerLon} · {observerLat}</span>
							{observerGpsLon !== null && observerGpsLat !== null ? <em>GPS {Number(observerGpsLon).toFixed(4)}, {Number(observerGpsLat).toFixed(4)}</em> : null}
						</div>
						<div className="planetarium-observer-actions">
							<GeoCoordModal
								onOk={this.changeObserverGeo}
								lat={observerGpsLat}
								lng={observerGpsLon}
							>
								<button type="button">经纬度选择</button>
							</GeoCoordModal>
							<button type="button" onClick={this.clearObserverOverride} disabled={!this.state.observerOverride}>回命盘地点</button>
						</div>
					</div>
					<div className="planetarium-section">
						<div className="planetarium-section-title">定位</div>
						<div className="planetarium-search">
							<input value={this.state.searchQuery} onChange={this.setSearchQuery} onKeyDown={(e)=>{ if(e.key === 'Enter'){ this.searchTarget(); } }} placeholder="月亮、木星、北斗、角宿..." />
							<button type="button" onClick={this.searchTarget}>定位</button>
						</div>
						{this.state.searchMessage ? <div className="planetarium-hint">{this.state.searchMessage}</div> : null}
					</div>
					<div className="planetarium-section">
						<div className="planetarium-section-title">观察模式</div>
						<div className="planetarium-view-grid">
							<button type="button" className={this.state.viewMode === 'ground' ? 'is-active' : ''} onClick={()=>this.changeViewMode('ground')}>地表观测</button>
							<button type="button" className={this.state.viewMode === 'orbit' ? 'is-active' : ''} onClick={()=>this.changeViewMode('orbit')}>天球外观</button>
						</div>
					</div>
					<div className="planetarium-section">
						<div className="planetarium-section-title">显示</div>
						<div className="planetarium-mag-filter">
							<div className="planetarium-mag-head">
								<span>星等上限</span>
								<b>{Number(this.state.magLimit).toFixed(1)}</b>
							</div>
							<input
								type="range"
								className="planetarium-mag-slider"
								min={STAR_MAG_LIMIT_MIN}
								max={STAR_MAG_LIMIT_MAX}
								step={0.1}
								value={this.state.magLimit}
								onChange={this.changeMagLimit}
								aria-label="星等上限"
							/>
							<div className="planetarium-mag-scale"><span>亮 {STAR_MAG_LIMIT_MIN.toFixed(1)}</span><span>暗 {STAR_MAG_LIMIT_MAX.toFixed(1)}</span></div>
						</div>
						<div className="planetarium-view-grid">
							<button type="button" className={this.state.measureMode ? 'is-active' : ''} onClick={this.toggleMeasureMode}>{this.state.measureMode ? '角距测量·开' : '角距测量'}</button>
							<button type="button" onClick={this.toggleImmersive}>{this.state.immersive ? '退出沉浸' : '全屏'}</button>
						</div>
						{this.state.measureMode ? <div className="planetarium-hint">依次点选两点(天体或天区方向)即得球面角距，再点重置</div> : null}
					</div>
					<div className="planetarium-section">
						<div className="planetarium-section-title">时间播放</div>
						<div className="planetarium-speed-grid">
							<button type="button" className={this.state.speed === 1 ? 'is-active' : ''} onClick={()=>this.changeSpeed(1)}>1x</button>
							<button type="button" className={this.state.speed === 60 ? 'is-active' : ''} onClick={()=>this.changeSpeed(60)}>60x</button>
							<button type="button" className={this.state.speed === 360 ? 'is-active' : ''} onClick={()=>this.changeSpeed(360)}>360x</button>
							<button type="button" className={this.state.speed === 1000 ? 'is-active' : ''} onClick={()=>this.changeSpeed(1000)}>1000x</button>
							<button type="button" className={this.state.speed === 3600 ? 'is-active' : ''} onClick={()=>this.changeSpeed(3600)}>3600x</button>
							<button type="button" className={this.state.speed === 10000 ? 'is-active' : ''} onClick={()=>this.changeSpeed(10000)}>10000x</button>
							<button type="button" className={this.state.speed === 86400 ? 'is-active' : ''} onClick={()=>this.changeSpeed(86400)}>日进</button>
							<button type="button" className={this.state.speed === 2592000 ? 'is-active' : ''} onClick={()=>this.changeSpeed(2592000)}>月进</button>
							<button type="button" className={this.state.speed === 31536000 ? 'is-active' : ''} onClick={()=>this.changeSpeed(31536000)}>年进</button>
						</div>
						<div className="planetarium-speed-grid planetarium-speed-grid-rev">
							<button type="button" className={this.state.speed === -1 ? 'is-active' : ''} onClick={()=>this.changeSpeed(-1)}>-1x</button>
							<button type="button" className={this.state.speed === -60 ? 'is-active' : ''} onClick={()=>this.changeSpeed(-60)}>-60x</button>
							<button type="button" className={this.state.speed === -360 ? 'is-active' : ''} onClick={()=>this.changeSpeed(-360)}>-360x</button>
							<button type="button" className={this.state.speed === -1000 ? 'is-active' : ''} onClick={()=>this.changeSpeed(-1000)}>-1000x</button>
							<button type="button" className={this.state.speed === -3600 ? 'is-active' : ''} onClick={()=>this.changeSpeed(-3600)}>-3600x</button>
							<button type="button" className={this.state.speed === -10000 ? 'is-active' : ''} onClick={()=>this.changeSpeed(-10000)}>-10000x</button>
							<button type="button" className={this.state.speed === -86400 ? 'is-active' : ''} onClick={()=>this.changeSpeed(-86400)}>日退</button>
							<button type="button" className={this.state.speed === -2592000 ? 'is-active' : ''} onClick={()=>this.changeSpeed(-2592000)}>月退</button>
							<button type="button" className={this.state.speed === -31536000 ? 'is-active' : ''} onClick={()=>this.changeSpeed(-31536000)}>年退</button>
						</div>
						<div className="planetarium-actions">
							<button type="button" onClick={this.jumpNow}>回到命盘时间</button>
							<button type="button" className={this.state.speed === 0 ? 'is-active' : ''} onClick={()=>this.changeSpeed(0)}>暂停</button>
						</div>
						<div className="planetarium-step-grid">
							<button type="button" onClick={()=>this.stepTime(-1, 'h')}>-1时</button>
							<button type="button" onClick={()=>this.stepTime(1, 'h')}>+1时</button>
							<button type="button" onClick={()=>this.stepTime(-1, 'd')}>-1日</button>
							<button type="button" onClick={()=>this.stepTime(1, 'd')}>+1日</button>
						</div>
					</div>
					<div className="planetarium-section">
						<div className="planetarium-section-title planetarium-layer-head">
							<span>图层</span>
							<span className="planetarium-layer-actions">
								<button type="button" onClick={()=>this.applyPreset()}>对标专业星图</button>
								<button type="button" onClick={()=>this.resetLayers()}>重置</button>
							</span>
						</div>
						{LAYER_GROUPS.map((g)=>{
							const collapsed = this.state.collapsedGroups.has(g.id);
							return (
								<div key={g.id} className={`planetarium-subgroup ${collapsed ? 'is-collapsed' : ''}`}>
									<button
										type="button"
										className="planetarium-subgroup-header"
										onClick={()=>this.toggleGroup(g.id)}
										aria-expanded={!collapsed}
									>
										<span>{g.title}</span>
										<span className="chevron" aria-hidden="true">▾</span>
									</button>
									<div className="planetarium-layer-grid">
										{g.chips.map(([k, l])=>this.renderLayerButton(k, l, g.legend && g.legend[k]))}
									</div>
								</div>
							);
						})}
					</div>
				</aside>
				<main className="planetarium-stage">
					<canvas ref={this.canvasRef} className="planetarium-canvas" />
					<div className="planetarium-scene-readout">
						<span>JD<b>{Number(sceneJd).toFixed(3)}</b></span>
						<span>LST<b>{sceneLst}</b></span>
						<span>ε<b>{sceneEps}</b></span>
					</div>
					<div className="planetarium-scene-readout planetarium-scene-readout-tr">
						<span>FPS<b>{metrics.fps}</b></span>
						<span>网格<b>{metrics.meshes}</b></span>
						<span>载入<b>{metrics.loadMs}ms</b></span>
						<span>接口<b>{metrics.apiMs}ms</b></span>
						<span>渲染<b>{metrics.renderMs}ms</b></span>
						<span>首次<b>{metrics.firstReadyMs}ms</b></span>
						<span>Babylon<b>{metrics.runtimeLoadMs}ms</b></span>
					</div>
					{this.state.immersive ? (
						<button type="button" className="planetarium-immersive-exit" onClick={this.toggleImmersive} aria-label="退出沉浸">
							<XQIcon name="prev" /><span>退出沉浸</span>
						</button>
					) : null}
					{this.state.syncing ? <div className="planetarium-status is-syncing">{this.state.syncLabel || '更新天空...'}</div> : null}
					{this.state.error ? <div className="planetarium-status is-error">{this.state.error}</div> : null}
				</main>
				<aside className="planetarium-side planetarium-right">
					<div className="planetarium-section">
						<div className="planetarium-section-title">观测状态</div>
						<div className="planetarium-metrics">
							<div><span>恒星</span><strong>{metrics.catalogCount}</strong></div>
							<div><span>天空</span><strong>{sky.mode || '--'}</strong></div>
							<div><span>太阳高度</span><strong>{formatDeg(sky.sunAltitude)}</strong></div>
							<div><span>月相</span><strong>{moonPhase ? `${moonPhaseGlyph(moonPhase)} ${moonPhase.phaseName}` : '--'}</strong></div>
							<div><span>黄赤交角</span><strong>{sceneEps}</strong></div>
							<div><span>本地恒星时</span><strong>{sceneLst}</strong></div>
						</div>
					</div>
					<div className="planetarium-section">
						<div className="planetarium-section-title">天体详情</div>
						{this.renderMeasure()}
						{this.renderSkyReadout()}
						{this.renderSelected()}
					</div>
					<div className="planetarium-section">
						<div className="planetarium-section-title">性能日志</div>
						<div className="planetarium-perf-log">
							{(this.state.perfLog || []).map((item, idx)=>(
								<div key={`${item.event}-${idx}`}>
									<span>{item.event}</span>
									<strong>{item.totalMs || item.apiMs || item.renderMs || 0} ms</strong>
								</div>
							))}
						</div>
					</div>
				</aside>
			</div>
		);
	}
}

// 纯天文坐标反算辅助(无 BABYLON/DOM 依赖)导出,供单元测试钉死正向/逆向往返一致性。
// 另导出星官配色器 + 升落/轨迹参数构造器,钉死配色方案与「默认零回归」(不传 include* 时请求体字节不变)。
export {
	inverseRefractionDeg,
	horizontalToEquatorial,
	equatorialToEcliptic,
	skyDirectionFromVector,
	angularSeparationDeg,
	STAR_MAG_LIMIT_MIN,
	STAR_MAG_LIMIT_MAX,
	asterismColor,
	buildRequestParams,
};

export default PlanetariumBabylon;
