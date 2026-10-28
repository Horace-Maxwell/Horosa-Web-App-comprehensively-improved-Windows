// 七政四余页 · 相位与罗计口径:相位中文名与相位行、纯对象深拷贝、罗睺 / 计都互换、罗计口径读取与套用、升落字段。
// 只被 components/guolao/GuoLaoChartMain.js 与同目录 main/ 下的兄弟模块引用。
import * as AstroConst from '../../../constants/AstroConst';
import { GUOLAO_NODE_MODE_NORTH_RAHU, getStoredGuolaoNodeMode, normalizeGuolaoNodeMode } from '../GuoLaoChartStyle';
import * as AstroText from '../../../constants/AstroText';
import { astroMsgPlainText as msg } from '../../astro/AstroHelper';
import { safeList } from './format';

// 🆕 中文相位名(含度数)用于 AI 挂载快照 + AI 导出 — 避免输出占星字体字形码(R/W/P/M 等)给 LLM 看成乱码。
// UI 内部渲染走 AstroMsg 字形码 + 占星字体不受影响(各自管线分离)。
const GUOLAO_ASPECT_LABEL_CN = {
	Asp0: '合 (0°)',
	Asp30: '半六合 (30°)',
	Asp45: '半方 (45°)',
	Asp60: '六合 (60°)',
	Asp90: '方 (90°)',
	Asp120: '三合 (120°)',
	Asp135: '补半方 (135°)',
	Asp150: '梅花 (150°)',
	Asp180: '冲 (180°)',
};
function aspectName(deg){
	if(GUOLAO_ASPECT_LABEL_CN[`Asp${deg}`]){ return GUOLAO_ASPECT_LABEL_CN[`Asp${deg}`]; }
	if(AstroText.AstroTxtMsg && AstroText.AstroTxtMsg[`Asp${deg}`]){ return AstroText.AstroTxtMsg[`Asp${deg}`]; }
	return Number.isFinite(Number(deg)) ? `${deg}°` : '';
}

export function buildAspectRows(aspects){
	const normal = aspects && aspects.normalAsp ? aspects.normalAsp : aspects;
	const rows = [];
	if(!normal || typeof normal !== 'object'){
		return rows;
	}
	Object.keys(normal).forEach((key)=>{
		const bucket = normal[key] || {};
		[
			['Applicative', '入相'],
			['Exact', '精确'],
			['Separative', '离相'],
			['None', '容许'],
		].forEach(([field, state])=>{
			safeList(bucket[field]).forEach((asp, idx)=>{
				if(!asp || !asp.id){
					return;
				}
				rows.push({
					key: `${key}-${asp.id}-${field}-${idx}`,
					from: msg(key),
					to: msg(asp.id),
					aspect: aspectName(asp.asp),
					state,
					orb: Number.isFinite(Number(asp.orb)) ? `${Math.round(Number(asp.orb) * 1000) / 1000}` : '',
				});
			});
		});
	});
	return rows;
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
