// 七政四余页 · 相位与罗计口径:七政相位行、纯对象深拷贝、罗睺 / 计都互换、罗计口径读取与套用、升落字段。
// 只被 components/guolao/GuoLaoChartMain.js 与同目录 main/ 下的兄弟模块引用。
import * as AstroConst from '../../../constants/AstroConst';
import { GUOLAO_NODE_MODE_NORTH_RAHU, getStoredGuolaoNodeMode, normalizeGuolaoNodeMode } from '../GuoLaoChartStyle';
import { astroMsgPlainText as msg } from '../../astro/AstroHelper';
import { computeMoiraAspectPairs } from '../GuoLaoMoiraWheel';

// 七政相位行(右栏「相位」页与 AI 快照同用):与盘面连线同一单源 computeMoiraAspectPairs ——
// 七种七政相位(會 0° / 衝 180° / 刑 90° / 合 120° / 半合 60° / 半刑 45°·135° / 四合 30°·150°),
// 只列已勾选的相位药丸、按左栏容许度设置、隐藏的曜不列。曾按通用占星相位表列(合 = 0°,名称与容许度都与盘面不同)。
// prefs = 七政显示偏好(guolaoDisplay:aspects / aspectOrbs / hiddenPlanets)。
export function buildGuolaoAspectRows(chart, prefs){
	const p = prefs || {};
	const pairs = computeMoiraAspectPairs(chart, { aspectSet: p.aspects, aspectOrbs: p.aspectOrbs, hiddenPlanets: p.hiddenPlanets });
	return pairs.map((pr)=>({
		key: `${pr.a.id}-${pr.b.id}-${pr.aspect.key}`,
		from: msg(pr.a.id),
		to: msg(pr.b.id),
		aspect: `${pr.aspect.key} ${pr.angle}°`,
		state: pr.state,
		orb: `${Math.round(pr.orb * 1000) / 1000}`,
	}));
}

export function clonePlain(obj){
	if(obj === undefined || obj === null){
		return obj;
	}
	try{
		return JSON.parse(JSON.stringify(obj));
	}catch(e){
		return obj;
	}
}

function swapGuolaoNodeId(id){
	if(id === AstroConst.NORTH_NODE){
		return AstroConst.SOUTH_NODE;
	}
	if(id === AstroConst.SOUTH_NODE){
		return AstroConst.NORTH_NODE;
	}
	return id;
}

function swapGuolaoNodeIdsDeep(value, seen){
	if(value === undefined || value === null){
		return value;
	}
	if(typeof value === 'string'){
		return swapGuolaoNodeId(value);
	}
	if(typeof value !== 'object'){
		return value;
	}
	const visited = seen || new Set();
	if(visited.has(value)){
		return value;
	}
	visited.add(value);
	if(Array.isArray(value)){
		for(let i = 0; i < value.length; i++){
			value[i] = swapGuolaoNodeIdsDeep(value[i], visited);
		}
		return value;
	}
	const keys = Object.keys(value);
	const entries = keys.map((key)=>[swapGuolaoNodeId(key), swapGuolaoNodeIdsDeep(value[key], visited)]);
	keys.forEach((key)=>delete value[key]);
	entries.forEach(([key, val])=>{
		value[key] = val;
	});
	return value;
}

export function guolaoNodeModeFromFields(fields){
	if(fields && fields.guolaoNodeMode && fields.guolaoNodeMode.value !== undefined && fields.guolaoNodeMode.value !== null){
		return normalizeGuolaoNodeMode(fields.guolaoNodeMode.value);
	}
	return getStoredGuolaoNodeMode();
}

export function guolaoNodeModeName(mode){
	const normalized = normalizeGuolaoNodeMode(mode);
	return normalized === GUOLAO_NODE_MODE_NORTH_RAHU ? '北罗南计' : '北计南罗';
}

export function applyGuolaoNodeMode(chartObj, fields){
	const next = clonePlain(chartObj);
	if(!next){
		return next;
	}
	if(guolaoNodeModeFromFields(fields) === GUOLAO_NODE_MODE_NORTH_RAHU){
		swapGuolaoNodeIdsDeep(next);
	}
	return next;
}

const GUOLAO_RISE_SET_KEYS = {
	sunrise: true,
	sunRise: true,
	sunriseTime: true,
	sunRiseTime: true,
	sun_rise: true,
	guolaoSunRiseTime: true,
	sunset: true,
	sunSet: true,
	sunsetTime: true,
	sunSetTime: true,
	sun_set: true,
	moonrise: true,
	moonRise: true,
	moonriseTime: true,
	moonRiseTime: true,
	moon_rise: true,
	moonset: true,
	moonSet: true,
	moonsetTime: true,
	moonSetTime: true,
	moon_set: true,
};

export function hasGuolaoRiseSetFields(value, seen){
	if(value === undefined || value === null){
		return false;
	}
	if(typeof value !== 'object'){
		return false;
	}
	const visited = seen || new Set();
	if(visited.has(value)){
		return false;
	}
	visited.add(value);
	const keys = Object.keys(value);
	for(let i = 0; i < keys.length; i++){
		const key = keys[i];
		const item = value[key];
		if(GUOLAO_RISE_SET_KEYS[key] && item !== undefined && item !== null && `${item}`.trim()){
			return true;
		}
		if(item && typeof item === 'object' && hasGuolaoRiseSetFields(item, visited)){
			return true;
		}
	}
	return false;
}
