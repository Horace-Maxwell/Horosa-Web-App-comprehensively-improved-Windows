// 择日宿主内嵌页的字段改动单源。
//
// 八字 / 太乙 / 紫微 / 六壬 / 三式 / 七政 / 印度择日的宿主自管 fields(择日时刻 + 择日地点 + 性别等几键),
// 内嵌完整技法页。内嵌页左栏亲手改时间 / 地点 / 性别 / 时间算法 / 子时换日等,此前照主页那样派发
// astro/save · astro/fetchByFields —— 把宿主拼的那张 fields 整张换进主盘:主盘丢了命盘身份与姓名、
// 主页改用择日时刻;内嵌盘自己却不变(宿主下一次渲染又传回原 fields)。
//
// 现在:内嵌页(techniqueScope 非空、宿主传了 onScopedFieldsChange)把改动交给宿主的覆盖层,
// 宿主恒用「宿主 fields + 覆盖层」重排;点选结果起盘时清空覆盖层(起盘按扫描冻结口径),存案记下覆盖层、载入时原样恢复。
// 奇门择日与主盘共用 fields(不传 onScopedFieldsChange),照旧写主盘;天星择日在自己的盘壳里排
// (DivinationChartShell 自管字段,以「此刻」为时间),左栏改动只进壳里与天星页保存值,也不写主盘。

// 只给派发链用的瞬态键,不进覆盖层
const TRANSIENT_FIELD_KEYS = ['__confirmed', '__stepHint', '__requestOptions', 'nohook'];

export function scopedFieldsSinkOf(props){
	return props && props.techniqueScope && typeof props.onScopedFieldsChange === 'function'
		? props.onScopedFieldsChange : null;
}

// 内嵌页侧:交给了宿主返回 true(调用方不再写主盘)。recompute=false = 输入中(没点确定):只更新显示、不重排;
// replace=true = 载入存案:覆盖层整个换成这份(之前亲手改的作废),而不是并进去
export function sendScopedFields(props, patch, opts){
	const sink = scopedFieldsSinkOf(props);
	if(!sink){ return false; }
	const clean = {};
	Object.keys(patch || {}).forEach((k)=>{
		if(TRANSIENT_FIELD_KEYS.indexOf(k) < 0){ clean[k] = patch[k]; }
	});
	try{
		sink(clean, { recompute: !(opts && opts.recompute === false), replace: !!(opts && opts.replace) });
	}catch(e){ /* 宿主处理失败:也不回落去写主盘 */ }
	return true;
}

// 宿主侧:覆盖层并入新改动(meta.replace = 载入存案时整个换掉)
export function mergeEmbedPatch(prev, patch, meta){
	if(meta && meta.replace){ return { ...(patch || {}) }; }
	return { ...(prev || {}), ...(patch || {}) };
}

// 宿主侧:宿主 fields 叠上覆盖层(覆盖层为空原样返回同一对象,备忘身份不变)
export function withEmbedPatch(base, patch){
	return patch && Object.keys(patch).length ? { ...base, ...patch } : base;
}

// 宿主侧:拉底盘的请求参数叠上覆盖层里的同名键(只改请求里本就有的键,外加 extraKeys 列出的、宿主请求缺省不带的键,
// 如三式内嵌改的黄道 / 宫制;时刻从叠过覆盖层的 fields 取,这里跳过)
export function chartParamWithEmbedPatch(param, patch, { extraKeys = [] } = {}){
	if(!patch || !Object.keys(patch).length){ return param; }
	const out = { ...param };
	Object.keys(patch).forEach((k)=>{
		if(k === 'date' || k === 'time'){ return; }
		const f = patch[k];
		if((Object.prototype.hasOwnProperty.call(out, k) || extraKeys.indexOf(k) >= 0) && f && f.value !== undefined){ out[k] = f.value; }
	});
	return out;
}

// 覆盖层随存案落盘 / 载回(存案里记的时间地点与快照是叠过覆盖层的那张盘,载回时覆盖层照原样还原)。
// 日期时间值存成「YYYY-MM-DD HH:mm:ss + 时区」文本,载回时由调用方给的 mkDateTime 重建
export function serializeEmbedPatch(patch){
	if(!patch || !Object.keys(patch).length){ return null; }
	const out = {};
	Object.keys(patch).forEach((k)=>{
		const f = patch[k];
		const v = f && typeof f === 'object' && 'value' in f ? f.value : f;
		if(v && typeof v.format === 'function'){
			out[k] = { dt: v.format('YYYY-MM-DD HH:mm:ss'), zone: v.zone, ad: v.ad };
		}else if(v === undefined || typeof v === 'function'){
			return;
		}else{
			out[k] = { v };
		}
	});
	return Object.keys(out).length ? out : null;
}
export function deserializeEmbedPatch(saved, mkDateTime){
	if(!saved || typeof saved !== 'object'){ return {}; }
	const out = {};
	Object.keys(saved).forEach((k)=>{
		const e = saved[k];
		if(!e || typeof e !== 'object'){ return; }
		if(typeof e.dt === 'string' && typeof mkDateTime === 'function'){
			const dt = mkDateTime(e.dt, e.zone, e.ad);
			if(dt){ out[k] = { value: dt }; }
		}else if('v' in e){
			out[k] = { value: e.v };
		}
	});
	return out;
}
