import request from './request';

const DEFAULT_MAX_CACHE_SIZE = 96;
const namespaceCache = new Map();
const namespaceInflight = new Map();

function isPlainObject(value){
	if(!value || typeof value !== 'object'){
		return false;
	}
	return Object.getPrototypeOf(value) === Object.prototype;
}

function stableStringify(value){
	if(value === undefined){
		return 'undefined';
	}
	if(value === null){
		return 'null';
	}
	if(typeof value === 'number' || typeof value === 'boolean'){
		return JSON.stringify(value);
	}
	if(typeof value === 'string'){
		return JSON.stringify(value);
	}
	if(Array.isArray(value)){
		return `[${value.map((item)=>stableStringify(item)).join(',')}]`;
	}
	if(isPlainObject(value)){
		const keys = Object.keys(value).sort();
		return `{${keys.map((key)=>`${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
	}
	try{
		return JSON.stringify(value);
	}catch(e){
		return `${value}`;
	}
}

function cloneValue(value){
	if(value === undefined || value === null){
		return value;
	}
	try{
		return JSON.parse(JSON.stringify(value));
	}catch(e){
		return value;
	}
}

function getMem(namespace){
	if(!namespaceCache.has(namespace)){
		namespaceCache.set(namespace, new Map());
	}
	return namespaceCache.get(namespace);
}

function getInflight(namespace){
	if(!namespaceInflight.has(namespace)){
		namespaceInflight.set(namespace, new Map());
	}
	return namespaceInflight.get(namespace);
}

function pushMem(namespace, key, value, maxSize){
	if(!namespace || !key || value === undefined){
		return;
	}
	const mem = getMem(namespace);
	if(mem.has(key)){
		mem.delete(key);
	}
	mem.set(key, cloneValue(value));
	const cap = Number.isFinite(maxSize) && maxSize > 0 ? Math.floor(maxSize) : DEFAULT_MAX_CACHE_SIZE;
	while(mem.size > cap){
		const oldestKey = mem.keys().next().value;
		if(!oldestKey){
			break;
		}
		mem.delete(oldestKey);
	}
}

export function buildApiMemoKey(url, body, extraKey){
	return [url || '', stableStringify(body), stableStringify(extraKey)].join('||');
}

export function clearApiMemo(namespace){
	if(!namespace){
		namespaceCache.clear();
		namespaceInflight.clear();
		return;
	}
	namespaceCache.delete(namespace);
	namespaceInflight.delete(namespace);
}

export async function memoizedJsonRequest(url, body, options = {}, memoOptions = {}){
	const namespace = memoOptions.namespace || url || 'default';
	const extraKey = memoOptions.extraKey;
	const key = buildApiMemoKey(url, body, extraKey);
	const mem = getMem(namespace);
	if(key && mem.has(key)){
		return cloneValue(mem.get(key));
	}
	const inflight = getInflight(namespace);
	if(key && inflight.has(key)){
		return inflight.get(key).then((result)=>cloneValue(result));
	}
	const reqOpts = {
		...(options || {}),
		body: JSON.stringify(body),
	};
	const req = request(url, reqOpts)
		.then((result)=>{
			if(result !== undefined){
				pushMem(namespace, key, result, memoOptions.maxSize);
			}
			return cloneValue(result);
		})
		.finally(()=>{
			if(key){
				inflight.delete(key);
			}
		});
	if(key){
		inflight.set(key, req);
	}
	return req;
}
