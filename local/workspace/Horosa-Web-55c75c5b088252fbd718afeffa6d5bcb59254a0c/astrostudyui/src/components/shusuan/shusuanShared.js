// 数算族页面(参评数 / 河洛理数 / 神数正传 / 一掌经)共用的两个小工具,此前四页各抄一份。

// 取 fields[key].value;字段缺失或值为 undefined / null 时返回 fallback。
export function fieldVal(fields, key, fallback = '') {
	if (!fields || !fields[key] || fields[key].value === undefined || fields[key].value === null) return fallback;
	return fields[key].value;
}

// 共享引用只读契约:模块级共享模型 memo 里的对象,各消费方 render 不就地改写。
// 开发构建下深冻结作保险丝(改写即在严格模式抛错);生产构建原样返回。
export const devFreeze = (v) => {
	if(process.env.NODE_ENV !== 'production' && v && typeof v === 'object'){
		try{ deepFreeze(v); }catch(e){ /* 冻结失败不碍事 */ }
	}
	return v;
};
function deepFreeze(o){
	Object.freeze(o);
	Object.keys(o).forEach((k) => {
		const c = o[k];
		if(c && typeof c === 'object' && !Object.isFrozen(c)){ deepFreeze(c); }
	});
}
