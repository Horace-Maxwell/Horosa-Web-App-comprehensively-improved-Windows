// 3D 星盘播放插值(WS-2):astronomy-engine 前端星历,统一公式
//   Vector(body, center) = HelioVector(body) − HelioVector(center)
// helio 即 center=Sun 特例(HelioVector(Sun) ≡ 0,减无可减);月球与月心
// 用 Earth + GeoMoon 合成(astronomy-engine 无 HelioVector(Moon) 直算)。
//
// delta-carry:播放帧黄经 = 后端 snap 值 + astronomy-engine 同源差分 ——
// 两套星历的常差类偏(光行差口径/帧微差/ΔT 模型差)在差分里结构性相消。
// 对拍实测(J2000,helio/mars/jupiter/moon 四中心):绝对差 <0.009°(阈 0.5°),
// 30 天窗口差分残差 <2e-4°(阈 0.01°)—— 见 __tests__/chart3dInterp.test.js。
//
// ⚠️ 纯数学模块:绝不 import three(jest 里 three 全族被 threeJestStub 顶替,
// 本模块必须独立可直测);角度归一复用 morphMath.norm360,不重复造轮。
import { Body, HelioVector, GeoMoon, MakeTime, Ecliptic, Vector } from 'astronomy-engine';
import { norm360 } from './morphMath';

export const JD_J2000 = 2451545.0;

// 天体名(chart3d.py BODY_ORDER 同源键)→ astronomy-engine Body 枚举;Moon 走合成分支
const BODY_ENUM = {
	Sun: Body.Sun,
	Mercury: Body.Mercury,
	Venus: Body.Venus,
	Earth: Body.Earth,
	Mars: Body.Mars,
	Jupiter: Body.Jupiter,
	Saturn: Body.Saturn,
	Uranus: Body.Uranus,
	Neptune: Body.Neptune,
	Pluto: Body.Pluto,
};

// 中心键(chart3d.py CENTER_BODY_NAME 同源)→ 中心体天体名
export const CENTER_BODY_NAME = {
	geo: 'Earth',
	helio: 'Sun',
	moon: 'Moon',
	mercury: 'Mercury',
	venus: 'Venus',
	mars: 'Mars',
	jupiter: 'Jupiter',
	saturn: 'Saturn',
	uranus: 'Uranus',
	neptune: 'Neptune',
	pluto: 'Pluto',
};

/** UT 儒略日 → astronomy-engine AstroTime(其 ut 定义 = 距 J2000 正午的 UT 天数) */
export function timeFromJd(jdUt){
	return MakeTime(jdUt - JD_J2000);
}

/** 日心向量(AU,EQJ 帧);Moon = HelioVector(Earth) + GeoMoon 合成 */
function helioVectorOf(bodyName, time){
	if(bodyName === 'Moon'){
		const e = HelioVector(Body.Earth, time);
		const m = GeoMoon(time);
		return new Vector(e.x + m.x, e.y + m.y, e.z + m.z, time);
	}
	const enumVal = BODY_ENUM[bodyName];
	if(enumVal === undefined){
		throw new Error(`ephemInterp: unknown body ${bodyName}`);
	}
	return HelioVector(enumVal, time);
}

/**
 * 中心相对向量(AU,EQJ 帧):Vector(body, center) = Helio(body) − Helio(center)。
 * @param {string} bodyName 天体名('Sun'...'Pluto')
 * @param {string} center   中心键('geo'/'helio'/'moon'/...);也接受直接给天体名
 * @param {number} jdUt     UT 儒略日
 */
export function vectorOf(bodyName, center, jdUt){
	const time = timeFromJd(jdUt);
	const hb = helioVectorOf(bodyName, time);
	const centerBody = CENTER_BODY_NAME[center] || center;
	if(centerBody === 'Sun'){
		return hb;   // helio 特例:太阳即日心原点
	}
	const hc = helioVectorOf(centerBody, time);
	return new Vector(hb.x - hc.x, hb.y - hc.y, hb.z - hc.z, time);
}

/** 中心黄道位置(真黄道 of date,与后端 chart3d 同帧口径):{lon, lat, dist} */
export function eclOf(bodyName, center, jdUt){
	const v = vectorOf(bodyName, center, jdUt);
	const ecl = Ecliptic(v);
	return {
		lon: norm360(ecl.elon),
		lat: ecl.elat,
		dist: Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z),
	};
}

/** 中心黄经(度,[0,360)) */
export function eclLonOf(bodyName, center, jdUt){
	return eclOf(bodyName, center, jdUt).lon;
}

/**
 * delta-carry 播放黄经:后端 t0 快照 + astronomy-engine 差分,归一 [0,360)。
 * @param {number} lonBackend0 后端 snap 黄经(t0)
 * @param {number} lonAe_t0    astronomy-engine 黄经(t0)
 * @param {number} lonAe_t     astronomy-engine 黄经(t)
 */
export function deltaCarry(lonBackend0, lonAe_t0, lonAe_t){
	return norm360(lonBackend0 + (lonAe_t - lonAe_t0));
}
