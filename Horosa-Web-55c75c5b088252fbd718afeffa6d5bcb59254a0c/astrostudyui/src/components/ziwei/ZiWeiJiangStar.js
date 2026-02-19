import * as ZiWeiHelper from './ZiWeiHelper';

let taisui = ["岁建", "晦气", "丧门", "贯索", "官符", "小耗", "岁破", "龙德", "白虎", "天德", "吊客", "病符"];

let JiangStars = {
	"寅午戌":{
		"午": "将星",
		"未": "攀鞍",
		"申": "岁驿",
		"酉": "息神",
		"戌": "华盖",
		"亥": "劫煞",
		"子": "灾煞",
		"丑": "天煞",
		"寅": "指背",
		"卯": "咸池",
		"辰": "月煞",
		"巳": "亡神"
	},
	"申子辰":{
		"子": "将星",
		"丑": "攀鞍",
		"寅": "岁驿",
		"卯": "息神",
		"辰": "华盖",
		"巳": "劫煞",
		"午": "灾煞",
		"未": "天煞",
		"申": "指背",
		"酉": "咸池",
		"戌": "月煞",
		"亥": "亡神"
	},
	"巳酉丑":{
		"酉": "将星",
		"戌": "攀鞍",
		"亥": "岁驿",
		"子": "息神",
		"丑": "华盖",
		"寅": "劫煞",
		"卯": "灾煞",
		"辰": "天煞",
		"巳": "指背",
		"午": "咸池",
		"未": "月煞",
		"申": "亡神"
	},
	"亥卯未":{
		"卯": "将星",
		"辰": "攀鞍",
		"巳": "岁驿",
		"午": "息神",
		"未": "华盖",
		"申": "劫煞",
		"酉": "灾煞",
		"戌": "天煞",
		"亥": "指背",
		"子": "咸池",
		"丑": "月煞",
		"寅": "亡神"
	}
};

let jiangMap = new Map();

function initJiangMap(){
	for(let key in JiangStars){
		let obj = JiangStars[key];
		let zi1 = key.substr(0, 1);
		let zi2 = key.substr(1, 1);
		let zi3 = key.substr(2, 1);
		jiangMap.set(zi1, obj);
		jiangMap.set(zi2, obj);
		jiangMap.set(zi3, obj);
	}
}

export function getYearJiang(yearzi){
	if(jiangMap.size === 0){
		initJiangMap();
	}
	return jiangMap.get(yearzi);
}

export function getTaisui(yearzi, housezi){
	let yearidx = ZiWeiHelper.getHouseZiIndex(yearzi);
	let houseidx = ZiWeiHelper.getHouseZiIndex(housezi);
	let idx = (houseidx - yearidx + 24) % 12;
	return taisui[idx];
}
