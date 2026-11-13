// 「内容没变、只是换了个对象」的判定:盘面组件按引用判要不要重画,回访 / 同参再取会拿到内容相同的新对象,
// 整张盘就白白重建一遍。引用不同时再比一次序列化结果(只在引用变了才付这笔;盘数据是纯 JSON,键序由同一出口决定)。
// 比不了(循环引用等)一律当不同 —— 多画一次只是慢,少画一次是错。
// 每次都现序列化、不记缓存:这些对象有的会被就地改写(盘数据取回后再补字段),记下的旧文本会让「改过的对象」被误判成没变。
export function sameJsonContent(a, b){
	if(a === b){ return true; }
	if(!a || !b || typeof a !== 'object' || typeof b !== 'object'){ return false; }
	try{
		return JSON.stringify(a) === JSON.stringify(b);
	}catch(e){
		return false;
	}
}

// 组件该不该重渲:状态浅比;入参逐个比 —— 引用相同过,函数按引用,对象引用不同时再比内容。
// ignore:本组件根本不读的入参名(上层照送,变了也不必重渲)。
export function propsOrStateChanged(prevProps, nextProps, prevState, nextState, ignore){
	if(prevState !== nextState){
		const sk = Object.keys({ ...(prevState || {}), ...(nextState || {}) });
		for(let i = 0; i < sk.length; i += 1){
			if((prevState || {})[sk[i]] !== (nextState || {})[sk[i]]){ return true; }
		}
	}
	const skip = ignore || [];
	const pk = Object.keys({ ...(prevProps || {}), ...(nextProps || {}) });
	for(let i = 0; i < pk.length; i += 1){
		const k = pk[i];
		if(skip.indexOf(k) >= 0){ continue; }
		const a = (prevProps || {})[k];
		const b = (nextProps || {})[k];
		if(a === b){ continue; }
		if(typeof a === 'function' || typeof b === 'function'){ return true; }
		if(!sameJsonContent(a, b)){ return true; }
	}
	return false;
}

// 键序归一的序列化(小对象用:同一份内容由不同出口拼出来,键序可能不同)。
export function stableStringify(value){
	const seen = [];
	const norm = (v)=>{
		if(v === null || typeof v !== 'object'){ return v; }
		if(seen.indexOf(v) >= 0){ throw new Error('circular'); }
		seen.push(v);
		const out = Array.isArray(v) ? v.map(norm) : Object.keys(v).sort().reduce((acc, k)=>{ acc[k] = norm(v[k]); return acc; }, {});
		seen.pop();
		return out;
	};
	try{
		return JSON.stringify(norm(value));
	}catch(e){
		return null;
	}
}
