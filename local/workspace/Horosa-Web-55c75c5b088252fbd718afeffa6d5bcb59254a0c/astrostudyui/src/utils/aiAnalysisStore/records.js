// 记录小件(取号 / 时间 / 深拷贝)与索引补建、按索引取值
// 从 aiAnalysisStore.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { EXTRA_INDEXES } from './schema';

export function randomStr(len = 8){
	const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
	let txt = '';
	for(let i=0; i<len; i++){
		txt += chars[Math.floor(Math.random() * chars.length)];
	}
	return txt;
}

export function canUseIndexedDb(){
	try{
		return typeof window !== 'undefined' && !!window.indexedDB;
	}catch(e){
		return false;
	}
}

export function nowIso(){
	return new Date().toISOString();
}

export function ensureRecordId(record, prefix = 'aianalysis'){
	if(record && record.id){
		return record.id;
	}
	return `${prefix}-${Date.now()}-${randomStr(8)}`;
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

// 幂等补建索引:基础三索引(全 store)+ EXTRA_INDEXES 二级索引(按 store.name 查表)。
// 只在 onupgradeneeded 的版本变更事务里调用;indexNames.contains 判断保证重复调用零 createIndex。
export function ensureIndexes(store){
	if(!store.indexNames.contains('updatedAt')){
		store.createIndex('updatedAt', 'updatedAt', { unique: false });
	}
	if(!store.indexNames.contains('createdAt')){
		store.createIndex('createdAt', 'createdAt', { unique: false });
	}
	if(!store.indexNames.contains('schemaVersion')){
		store.createIndex('schemaVersion', 'schemaVersion', { unique: false });
	}
	const extras = EXTRA_INDEXES[store.name] || [];
	extras.forEach(([name, keyPath])=>{
		if(!store.indexNames.contains(name)){
			store.createIndex(name, keyPath, { unique: false });
		}
	});
}

// 索引名 → keyPath(内存回退径按同一 keyPath 过滤,与 IndexedDB 索引语义一致;未登记的索引名视同字段名)。
export function indexKeyPath(storeName, indexName){
	const hit = (EXTRA_INDEXES[storeName] || []).find(([name])=>name === indexName);
	return hit ? hit[1] : indexName;
}

export function recordIndexValue(rec, keyPath){
	if(Array.isArray(keyPath)){
		return keyPath.map((k)=>rec[k]);
	}
	return rec[keyPath];
}

export function indexValueEquals(a, b){
	if(Array.isArray(a) && Array.isArray(b)){
		return a.length === b.length && a.every((v, i)=>v === b[i]);
	}
	return a === b;
}

export function normalizeArray(val){
	return Array.isArray(val) ? val : [];
}

export function normalizeString(val){
	return `${val || ''}`.trim();
}
