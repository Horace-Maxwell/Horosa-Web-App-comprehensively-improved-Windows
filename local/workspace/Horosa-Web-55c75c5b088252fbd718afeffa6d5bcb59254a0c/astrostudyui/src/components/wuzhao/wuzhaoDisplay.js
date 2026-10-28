// 五兆界面显示名:引擎回包按底本写着繁体(六兽 青龍 / 勾陳、六亲 子孫 / 妻財、宫名 離 / 兌、旺相 廢 / 沒、乡名 木鄉 …),
// 界面一律显示简体写法(新文字照写简体;繁体档由界面显示层转回繁体)。只改显示:回包的键、查表与挂载用的原值、
// 发给 AI 的快照照原样。字表只收这一路回包里出现过的繁体写法字(合同 wuzhaoDisplay.test.js 拿真实回包夹具比对);
// 「乾」「徵」简体里本来也用,不收。
export const WUZHAO_DISPLAY_CHARS = {
	廢: '废', 關: '关', 鄉: '乡', 離: '离', 陳: '陈', 孫: '孙', 虛: '虚', 兌: '兑', 沒: '没', 龍: '龙',
	樑: '梁', 弔: '吊', 電: '电', 財: '财', 將: '将', 軍: '军', 獸: '兽', 親: '亲', 數: '数', 宮: '宫', 農: '农', 曆: '历',
};
const CHAR_RE = new RegExp(`[${Object.keys(WUZHAO_DISPLAY_CHARS).join('')}]`, 'g');

export function wuzhaoShow(value){
	if(typeof value !== 'string'){ return value; }
	return value.replace(CHAR_RE, (c)=>WUZHAO_DISPLAY_CHARS[c]);
}

function deep(v){
	if(typeof v === 'string'){ return wuzhaoShow(v); }
	if(Array.isArray(v)){ return v.map(deep); }
	if(v && typeof v === 'object'){
		const out = {};
		Object.keys(v).forEach((k)=>{ out[k] = deep(v[k]); });
		return out;
	}
	return v;
}

// 显示用副本(只换字符串值,键不动);同一份回包只算一次
const cache = new WeakMap();
export function wuzhaoDisplayPan(pan){
	if(!pan || typeof pan !== 'object'){ return pan; }
	let hit = cache.get(pan);
	if(!hit){ hit = deep(pan); cache.set(pan, hit); }
	return hit;
}
