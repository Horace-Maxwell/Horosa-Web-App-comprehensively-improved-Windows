// 择日宿主(*ZeriMain)共用的小工具:日期补零 / 今日日期串 / fields 单项 / 按 'YYYY-MM-DD HH:mm:ss' 建 DateTime。
// 各宿主原先各抄一份,逐字相同,收成单一来源。
import DateTime from '../comp/DateTime';

export function pad2(n){
	return n < 10 ? `0${n}` : `${n}`;
}

export function todayStr(){
	const d = new Date();
	return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function mkField(v){
	return { value: v };
}

export function mkDT(text){
	const dt = new DateTime();
	return dt.parse ? dt.parse(text, 'YYYY-MM-DD HH:mm:ss') : dt;
}

// 地点依赖键:择日浮窗各卡取数 / 排盘的 effect / memo 都按它重算 —— 浮窗开着时宿主换了地点(返回条件改地点后重扫,
// 预览地点跟着换成新的冻结地点),盘必须跟着换。按值比,不按引用:宿主每次渲染新拼一个同值对象不白算。
export function geoDepKey(geo){
	const g = geo || {};
	return JSON.stringify([g.zone, g.lon, g.lat, g.gpsLon, g.gpsLat, g.pos]);
}
