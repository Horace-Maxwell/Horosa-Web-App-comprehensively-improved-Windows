// 「改了时间立刻点起盘」的最新时刻(共用):立即派发型页面(太乙 / 皇极 / 五兆 / 神易数 / 荆诀 / 太玄 / 策天演禽)
// 每次改时间都派发全局取数,全局盘回来之前页面 props 还是旧时刻;此前「起盘」/ 预取读时间控件 hook(值也是旧的)
// → 把时间改回去。现:改时间时记下最新时刻,取时刻时优先用它;页面收到新的盘面字段(全局追上或外部改动)即清掉,
// 过期草稿不会反过来盖掉外部改动(载入命盘 / 全局事件)。
export function notePendingTime(host, dt){
	if(!host || !dt || typeof dt.clone !== 'function'){ return; }
	host._pendingTimePatch = {
		date: { value: dt.clone() },
		time: { value: dt.clone() },
		ad: { value: dt.ad },
		zone: { value: dt.zone },
	};
}

export function pendingTimePatch(host){
	return host && host._pendingTimePatch ? host._pendingTimePatch : null;
}

export function clearPendingTimeOnFieldsChange(host, prevProps){
	if(host && prevProps && prevProps.fields !== (host.props && host.props.fields)){
		host._pendingTimePatch = null;
	}
}

// 盘面时间 / 地点的取值签名:宿主每次渲染都新建 fields 对象时(择日宿主),拿对象身份判「外面换了盘」会把
// 用户还没确认的草稿在无关重渲染时清掉 —— 按值比
function fieldVal(f){
	const v = f && typeof f === 'object' && 'value' in f ? f.value : f;
	if(v && typeof v.format === 'function'){
		try{ return v.format('YYYY-MM-DD HH:mm:ss'); }catch(e){ return `${v}`; }
	}
	return v === undefined || v === null ? '' : `${v}`;
}
export function timeGeoFieldsSig(fields){
	const f = fields || {};
	return ['date', 'time', 'ad', 'zone', 'lon', 'lat', 'gpsLon', 'gpsLat'].map((k)=>fieldVal(f[k])).join('|');
}
export function timeGeoFieldsChanged(prevFields, nextFields){
	if(prevFields === nextFields){ return false; }
	return timeGeoFieldsSig(prevFields) !== timeGeoFieldsSig(nextFields);
}
