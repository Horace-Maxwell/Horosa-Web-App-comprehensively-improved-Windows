// 本地记录存储 · 排序与序列化:置顶分层排序键、按更新时间降序、逐记录序列化缓存与整库拼串、记录规范化
// 从 localRecordStore.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { parseLocalDateTimeMs } from '../dateTimeParse';
import { recordStoreFastWriteEnabled } from '../perfFlags';

// [V 上移/下移] 有效排序键:显式 orderKey 优先,否则 -parseLocalDateTimeMs(updateTime)(时间越新键越小
// =越靠前)。手动序与时间序共用同一数轴 —— 无模式切换,新记录(最新)天然仍到顶。
export function effOrderKey(r){
	if(r && r.orderKey !== undefined && r.orderKey !== null){
		return Number(r.orderKey);
	}
	return -(parseLocalDateTimeMs((r && r.updateTime) || '') || 0);
}

export function sortByUpdateTimeDesc(list){
	if(!recordStoreFastWriteEnabled()){
		return list.sort((a, b)=>{
			const ta = parseLocalDateTimeMs(a.updateTime || '') || 0;
			const tb = parseLocalDateTimeMs(b.updateTime || '') || 0;
			return tb - ta;
		});
	}
	// 装饰-排序-去装饰:每记录只 Date.parse 一次(旧比较器每次比较各 parse 两次,共 N·logN 倍);
	// 排序键 (-t, 原索引) 与稳定排序下的旧比较器逐位同序(同键按原索引先后)。原地写回并返回同一数组,
	// 调用方语义(in-place + 返回值)不变。
	const n = list.length;
	const dec = new Array(n);
	for(let i = 0; i < n; i++){
		const r = list[i];
		dec[i] = { r, t: parseLocalDateTimeMs((r && r.updateTime) || '') || 0, i };
	}
	dec.sort((a, b)=>(b.t - a.t) || (a.i - b.i));
	for(let i = 0; i < n; i++){
		list[i] = dec[i].r;
	}
	return list;
}

// 逐记录序列化缓存:记录对象 → 其 JSON 串(WeakMap,随对象回收;跨 store 共用无碍——键是对象身份)。
// 成立前提=读缓存契约:缓存列表里的记录对象永不原地修改,故串与对象恒一致;新建/合并的记录在写成功后
// 经 JSON 往返为「规范对象」再入缓存列表(键=往返后的对象),调用方拿到的原对象不进缓存列表。
const recordJsonCache = new WeakMap();

// 数组元素口径:undefined/函数/symbol 在 JSON.stringify(list) 里落为 null,而顶层 JSON.stringify(el) 返回 undefined。
function stringifyElement(el){
	const s = JSON.stringify(el);
	return s === undefined ? 'null' : s;
}

// 与 JSON.stringify(list) 字节恒等(属性测试看守);对象元素命中缓存免重序列化。
export function serializeList(list){
	const n = list.length;
	const parts = new Array(n);
	for(let i = 0; i < n; i++){
		const el = list[i];
		if(el !== null && typeof el === 'object'){
			let s = recordJsonCache.get(el);
			if(s === undefined){
				s = stringifyElement(el);
				recordJsonCache.set(el, s);
			}
			parts[i] = s;
		}else{
			parts[i] = stringifyElement(el);
		}
	}
	return '[' + parts.join(',') + ']';
}

// 规范化一条记录:按其序列化串 JSON 往返(与旧路径 JSON.parse(text) 对该元素的结果同构:显式 undefined 键消失、
// -0 归 0、NaN/Infinity 落 null 等),并把串挂到往返后的对象上(下次写直接命中)。
export function canonicalizeRecord(el){
	const cached = (el !== null && typeof el === 'object') ? recordJsonCache.get(el) : undefined;
	const s = cached !== undefined ? cached : stringifyElement(el);
	const obj = JSON.parse(s);
	if(obj !== null && typeof obj === 'object'){
		recordJsonCache.set(obj, s);
	}
	return obj;
}

// 测试专用:序列化器直出口(属性测试与 JSON.stringify 对拍)。
export function __serializeListForTests(list){
	return serializeList(list);
}
