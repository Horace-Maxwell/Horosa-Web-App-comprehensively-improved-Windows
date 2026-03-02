import * as d3 from 'd3';
import * as ZWConst from '../../constants/ZWConst';

let DiZi = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
let DiZiMap = new Map();

let HuaLuMap = new Map();
let HuaQuanMap = new Map();
let HuaKeMap = new Map();
let HuaJiMap = new Map();

let HuaMaps = [HuaLuMap, HuaQuanMap, HuaKeMap, HuaJiMap];

function initHuaMap(){
	let ganhua = ZWConst.SiHua.gan;
	for(let gan in ganhua){
		let stars = ganhua[gan];
		for(let i=0; i<4; i++){
			let map = HuaMaps[i];
			let hua = map.get(stars[i]);
			if(hua === undefined || hua === null){
				hua = gan;
			}else{
				hua = hua + gan;
			}
			map.set(stars[i], hua);
		}
	}
}

export function getHouseZiIndex(zi){
	if(ZWConst.HouseZiMap.size === 0){
		for(let i=0; i<ZWConst.HouseZi.length; i++){
			ZWConst.HouseZiMap.set(ZWConst.HouseZi[i], i);
		}
	}
	return ZWConst.HouseZiMap.get(zi);
}

export function getSiHua(star, gan){
	if(HuaLuMap.size === 0){
		initHuaMap();
	}

	let lu = HuaLuMap.get(star);
	let quan = HuaQuanMap.get(star);
	let ke = HuaKeMap.get(star);
	let ji = HuaJiMap.get(star);
	if(lu !== undefined && lu !== null && lu.indexOf(gan) >= 0){
		return ZWConst.SiHua.hua[0];
	}
	if(quan !== undefined && quan !== null && quan.indexOf(gan) >= 0){
		return ZWConst.SiHua.hua[1];
	}
	if(ke !== undefined && ke !== null && ke.indexOf(gan) >= 0){
		return ZWConst.SiHua.hua[2];
	}
	if(ji !== undefined && ji !== null && ji.indexOf(gan) >= 0){
		return ZWConst.SiHua.hua[3];
	}
	return null;
}

export function isDirCloseWise(chartobj){
	let gender = chartobj.gender;
	let polar = chartobj.yearPolar;
	if((gender === 'Male' && polar === 'Positive') 
		|| (gender === 'Female' && polar === 'Negative') ){
		return true;
	}
	return false;
}

export function getDouJun(zidou, yearzi){
	if(DiZiMap.size === 0){
		for(let i=0; i<DiZi.length; i++){
			DiZiMap.set(DiZi[i], i);
		}
	}
	let ziidx = DiZiMap.get(zidou);
	let yearziIdx = DiZiMap.get(yearzi);

	let idx = (ziidx + yearziIdx) % 12;
	return DiZi[idx];
}