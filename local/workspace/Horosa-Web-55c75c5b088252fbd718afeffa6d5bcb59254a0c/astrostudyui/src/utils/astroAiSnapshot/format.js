// 快照正文的取值与格式化小件(度数 / 界 / 逆行 / 速度 / 尊贵 / 互容 / 相位与恒星行)
// 从 astroAiSnapshot.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { classicalGlobalValue } from '../classicalChartGlobals';   // 签名末位+口径自陈共用请求体单源(无环:classicalChartGlobals 只依赖 safeStorage)
import * as AstroText from '../../constants/AstroText';
import { appendPlanetHouseInfoById } from '../planetHouseInfo';
import * as AstroConst from '../../constants/AstroConst';
import { readGlobalSetupField } from '../globalSetupStore';

// 全局仓安全读(headless/jest 环境 storage 缺失守默认)。
export function classicalGlobalValueSafe(key){
	try{ return classicalGlobalValue(key); }catch(e){ return undefined; }
}

const DEFAULT_PLANET_INFO_EXPORT = {
	showHouse: 1,
	showRuler: 1,
};

export const PLANET_HOUSE_INFO_NOTE = '说明：行星名后括号中的 nR 为宫主宫位标记；逆行会明确写为“逆行”。';

// [Windows #79] 快照 payload 格式版本:[主宰星链] 改挂整宫制宫主表+判读口径行、分宫制宫神星表拆成独立段 → 2。
// hasMatchingSavedAstroSnapshot 以此拒绝整份复用旧格式快照(最坏多算一次);身份签名(createAstroSnapshotSignature)不动。
export const ASTRO_SNAPSHOT_FORMAT_VERSION = 2;

export const WHOLE_SIGN_RULERS_HEAD = '◆ 整宫制宫主表(wholeSignRulers)';

export const RULER_CALIBRE_LINE = '判读口径：宫主/主宰一律按整宫制（自上升星座起算，与[起盘信息]行星后的 nR 宫主标记同源，见下表）；行星力量、角/续/果与实际落宫按当前分宫制衡量，见[分宫制宫神星表]段。';

export const HOUSE_SYSTEM_RULERS_COLLAPSED = '当前分宫制即整宫制：宫神星表与[主宰星链]段「◆ 整宫制宫主表(wholeSignRulers)」逐行相同，不再重复列出。';

function isEncodedToken(text){
	return /^[A-Za-z0-9${}]$/.test((text || '').trim());
}

export function msg(id){
	if(id === undefined || id === null){
		return '';
	}
	if(AstroText.AstroTxtMsg[id]){
		return AstroText.AstroTxtMsg[id];
	}
	if(AstroText.AstroMsg[id]){
		const val = AstroText.AstroMsg[id];
		if(isEncodedToken(val)){
			return `${id}`;
		}
		return `${val}`;
	}
	return `${id}`;
}

function normalizeAiPlanetLabel(text){
	return `${text || ''}`.replace(/(\d+)R\s*\(宫主\)/g, '$1R');
}

export function normalizeAiExportText(text){
	return `${text || ''}`.replace(/(\d+)R\s*\(宫主\)/g, '$1R');
}

export function msgWithHouse(id, chartObj, enabled = DEFAULT_PLANET_INFO_EXPORT){
	const text = appendPlanetHouseInfoById(msg(id), chartObj, id, enabled);
	return normalizeAiPlanetLabel(text);
}

export function round3(val){
	if(val === undefined || val === null || Number.isNaN(Number(val))){
		return '';
	}
	return `${Math.round(Number(val) * 1000) / 1000}`;
}

function splitDegree(degree){
	let deg = Number(degree);
	if(Number.isNaN(deg)){
		return [0, 0];
	}
	const negative = deg < 0;
	deg = Math.abs(deg);
	let d = Math.floor(deg);
	let minute = Math.floor((deg - d) * 60);
	if(minute >= 60){
		d += 1;
		minute = 0;
	}
	if(negative){
		d = -d;
	}
	return [d, minute];
}

function whichTerm(sign, deg){
	const terms = AstroConst.EGYPTIAN_TERMS[sign];
	if(!terms || terms.length === 0){
		return '';
	}
	for(let i=0; i<terms.length; i++){
		const item = terms[i];
		if(item[1] <= deg && item[2] > deg){
			return msg(item[0]);
		}
	}
	return '';
}

export function formatSignDegree(sign, signlon){
	if(signlon === undefined || signlon === null || sign === undefined || sign === null){
		return '';
	}
	const sd = splitDegree(signlon);
	const deg = Math.abs(sd[0]);
	const minute = Math.abs(sd[1]);
	const term = whichTerm(sign, deg);
	return `${deg}˚${msg(sign)}${minute}分；位于 ${term} 界`;
}

export function formatRetrogradeText(obj){
	if(!obj || obj.lonspeed === undefined || obj.lonspeed === null){
		return '';
	}
	const speed = Number(obj.lonspeed);
	if(Number.isNaN(speed) || speed >= 0){
		return '';
	}
	return '；逆行';
}

export function lonToSignDegree(lon){
	if(lon === undefined || lon === null || Number.isNaN(Number(lon))){
		return '';
	}
	let value = Number(lon) % 360;
	if(value < 0){
		value += 360;
	}
	const signIdx = Math.floor(value / 30) % 12;
	const sign = AstroConst.LIST_SIGNS[signIdx];
	const signlon = value - signIdx * 30;
	return formatSignDegree(sign, signlon);
}

export function fieldValue(fields, key){
	if(!fields){
		return null;
	}
	const f = fields[key];
	if(f && f.value !== undefined){
		return f.value;
	}
	return f !== undefined ? f : null;
}

export function resolveOnlyRulerExaltReception(options = {}){
	if(options.onlyRulerExaltReception !== undefined && options.onlyRulerExaltReception !== null){
		return !!options.onlyRulerExaltReception;
	}
	try{
		const v = readGlobalSetupField('showOnlyRulExaltReception');   // 全局设置单源的内存镜像
		return v === 1 || v === true;
	}catch(e){
		return false;
	}
}

function hasRulerOrExalt(ary){
	if(!ary || !Array.isArray(ary) || ary.length === 0){
		return false;
	}
	for(let i=0; i<ary.length; i++){
		if(ary[i] === 'ruler' || ary[i] === 'exalt'){
			return true;
		}
	}
	return false;
}

export function keepReceptionLine(item, abnormal = false, onlyRulerExaltReception = false){
	if(!onlyRulerExaltReception){
		return true;
	}
	if(!item){
		return false;
	}
	const supplierOk = hasRulerOrExalt(item.supplierRulerShip);
	if(!abnormal){
		return supplierOk;
	}
	const beneficiaryOk = hasRulerOrExalt(item.beneficiaryDignity);
	return supplierOk || beneficiaryOk;
}

export function keepMutualLine(item, onlyRulerExaltReception = false){
	if(!onlyRulerExaltReception){
		return true;
	}
	if(!item || !item.planetA || !item.planetB){
		return false;
	}
	return hasRulerOrExalt(item.planetA.rulerShip) && hasRulerOrExalt(item.planetB.rulerShip);
}

export function asNameList(ids){
	if(!ids || ids.length === 0){
		return '';
	}
	return ids.map((id)=>msg(id)).filter(Boolean).join(' , ');
}


export function getStarsMap(chartObj){
	const map = {};
	const chart = chartObj && chartObj.chart ? chartObj.chart : null;
	if(!chart || !chart.stars){
		return map;
	}
	for(let i=0; i<chart.stars.length; i++){
		const star = chart.stars[i];
		map[star.id] = star.stars || [];
	}
	return map;
}

export function dignityText(ary){
	if(!ary || ary.length === 0){
		return '游走';
	}
	return ary.map((item)=>msg(item)).join('，');
}

export function formatSpeed(obj){
	if(!obj){
		return '';
	}
	let speed = `${round3(obj.lonspeed)}度`;
	if(obj.lonspeed < 0){
		speed += '；逆行';
	}
	const deltaSpeed = Math.abs((obj.lonspeed || 0) - (obj.meanSpeed || 0));
	if(deltaSpeed > 1){
		speed += obj.lonspeed > obj.meanSpeed ? '; 快速' : '; 慢速';
	}else if(obj.lonspeed < 0.003 && obj.lonspeed > 0){
		speed += '; 停滞';
	}else{
		speed += '; 平均';
	}
	return speed;
}

export function ruleshipText(arr){
	if(!arr || arr.length === 0){
		return '';
	}
	return arr.map((item)=>msg(item)).join('+');
}

export function aspectText(asp){
	if(asp === undefined || asp === null){
		return '';
	}
	const n = Number(asp);
	if(Number.isNaN(n)){
		return `${asp}`;
	}
	return `${n}˚`;
}

export function formatStarsLines(stars){
	if(!stars || stars.length === 0){
		return [];
	}
	const lines = [];
	for(let i=0; i<stars.length; i++){
		const item = stars[i];
		const sname = item.length > 4 ? item[4] : msg(item[0]);
		const deg = splitDegree(item[2]);
		lines.push(`${sname}：${Math.abs(deg[0])}˚${msg(item[1])}${Math.abs(deg[1])}分`);
	}
	return lines;
}
