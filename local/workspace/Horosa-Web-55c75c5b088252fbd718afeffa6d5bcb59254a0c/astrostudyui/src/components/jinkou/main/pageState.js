// 页面状态小件:签名比较、深拷贝、起课缓存与排盘设置跨会话保留
// 从 JinKouMain.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { definePageSettings } from '../../../utils/pageSettingsStore';
import { registerProcessCache } from '../../../utils/processCacheRegistry';

// 签名数组逐元素严格相等(引用/值);用于装配缓存命中判定(只多算、绝不少算)。
export function sameSigArr(a, b){
	if(!a || !b || a.length !== b.length){
		return false;
	}
	for(let i = 0; i < a.length; i++){
		if(a[i] !== b[i]){
			return false;
		}
	}
	return true;
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

export function buildCacheKey(obj){
	try{
		return JSON.stringify(obj || {});
	}catch(e){
		return '';
	}
}

export function pushCache(map, key, val, max = 96){
	if(!map || !key || val === undefined || val === null){
		return;
	}
	if(map.has(key)){
		map.delete(key);
	}
	map.set(key, val);
	if(map.size > max){
		const first = map.keys().next().value;
		if(first){
			map.delete(first);
		}
	}
}

// 排盘设置跨会话保留(用户实报:排盘设置改了之后每次重开软件都要重设)。只收排盘流派五键 + 时间基准;
// 地分 / 月将 / 占时 / 专题 / 扣题 / 时段是每一课的输入,十二长生五行缺省随日干,都不进。事盘回灌不经这两个 handler,不落盘。
export const JINKOU_PAGE_SETTINGS = definePageSettings('horosa.jinkou.settings.v1', {
	schoolYueJiang: { def: 'zhongqi', oneOf: ['zhongqi', 'jiaojie'] },
	schoolGuiTable: { def: 'shiwu', oneOf: ['shiwu', 'liuren'] },
	schoolGuiPan: { def: 'di', oneOf: ['di', 'tian'] },
	panShi: { def: 'yang', oneOf: ['yang', 'yin'] },
	soilChangSheng: { def: 'shen', oneOf: ['shen', 'yin'] },
	timeBasis: { def: 'direct', oneOf: ['direct', 'trueSolar'] },
});

// horosa_kentang_result_cache_v1 —— /liureng/gods + /liureng/runyear(金口诀复用六壬两端点)
// 与出生年干支的结果缓存**提升到模块级**。原为 per-instance:切走金口页 → 组件卸载 → 缓存与在途
// Promise 一起蒸发,切回来整趟往返重付。三者均为确定性纯计算(key = genGodsParams/genRunYearParams/
// 出生 params 的 JSON,即请求体本身:'YYYY-MM-DD'/'HH:mm' 格式化字串 + 经纬/时区/性别/日界开关,
// 无 Date 对象、无随机、无「现在时刻」依赖),跨实例复用与直连逐值等价。
// ns 显式写死在常量名里(**不**由 URL 派生:ServerRoot 端口每次后端启动随机)。
// 上限沿用原调用点传给 pushCache 的 72 / 96(未改);出生年干支表另有 localStorage 冷启层,见下。
// 关 horosa.perf.techniqueResultCache → 构造函数回到 new Map()/{}(=今日 per-instance 行为,逐字一致)。
export const JINKOU_BIRTH_GANZI_MEM = {};
const JINKOU_BIRTH_GANZI_MAX = 96;

// 出生年干支表提到模块级后必须有界(原 per-instance 明文无上限,靠卸载「自然清零」);
// 值只是两字干支串,96 条即够整轮命例来回,插入序淘汰最早一条。
export function rememberBirthGanZi(map, key, val){
	if(!map || !key || !val){
		return;
	}
	map[key] = val;
	const keys = Object.keys(map);
	if(keys.length > JINKOU_BIRTH_GANZI_MAX){
		delete map[keys[0]];
	}
}
export const JINKOU_GODS_MEM = new Map();
export const JINKOU_GODS_INFLIGHT = new Map();
export const JINKOU_RUNYEAR_MEM = new Map();
export const JINKOU_RUNYEAR_INFLIGHT = new Map();
// 上面四表 + 出生年干支表是跨实例的进程内同参复用:登记清空函数(只供审计仪器取样前清空;产品运行期从不调用)。
// 上游同名缓存是 per-instance(卸载即清),提到模块级后不登记,审计仪器「缺省两遍请求数」会对不上。
registerProcessCache('jinkou.liurengShared', ()=>{
	JINKOU_GODS_MEM.clear(); JINKOU_GODS_INFLIGHT.clear(); JINKOU_RUNYEAR_MEM.clear(); JINKOU_RUNYEAR_INFLIGHT.clear();
	Object.keys(JINKOU_BIRTH_GANZI_MEM).forEach((k)=>{ delete JINKOU_BIRTH_GANZI_MEM[k]; });
});
