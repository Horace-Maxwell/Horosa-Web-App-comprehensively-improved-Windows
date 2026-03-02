const LocalChartsKey = 'horosa.localCharts.v1';

function safeParseJson(txt, defVal){
	if(!txt){
		return defVal;
	}
	try{
		return JSON.parse(txt);
	}catch(e){
		return defVal;
	}
}

function nowStr(){
	const dt = new Date();
	const y = dt.getFullYear();
	const m = String(dt.getMonth() + 1).padStart(2, '0');
	const d = String(dt.getDate()).padStart(2, '0');
	const hh = String(dt.getHours()).padStart(2, '0');
	const mm = String(dt.getMinutes()).padStart(2, '0');
	const ss = String(dt.getSeconds()).padStart(2, '0');
	return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

function normalizeGroup(group){
	if(group === undefined || group === null || group === ''){
		return null;
	}
	if(group instanceof Array){
		return JSON.stringify(group);
	}
	if(typeof group === 'string'){
		const parsed = safeParseJson(group, null);
		if(parsed instanceof Array){
			return JSON.stringify(parsed);
		}
		return group;
	}
	return JSON.stringify([group]);
}

function sortByUpdateTimeDesc(list){
	return list.sort((a, b)=>{
		const ta = Date.parse(a.updateTime || '') || 0;
		const tb = Date.parse(b.updateTime || '') || 0;
		return tb - ta;
	});
}

function readRawCharts(){
	const ary = safeParseJson(localStorage.getItem(LocalChartsKey), []);
	if(!(ary instanceof Array)){
		return [];
	}
	return ary;
}

function writeRawCharts(list){
	localStorage.setItem(LocalChartsKey, JSON.stringify(list));
}

export function listLocalCharts(filter){
	let list = readRawCharts();
	if(filter && filter.name){
		const name = (filter.name + '').trim().toLowerCase();
		if(name !== ''){
			list = list.filter((item)=>{
				const txt = item && item.name ? (item.name + '').toLowerCase() : '';
				return txt.indexOf(name) >= 0;
			});
		}
	}
	if(filter && filter.tag){
		const tag = filter.tag + '';
		if(tag !== ''){
			list = list.filter((item)=>{
				const grp = safeParseJson(item.group, []);
				return grp instanceof Array && grp.indexOf(tag) >= 0;
			});
		}
	}
	return sortByUpdateTimeDesc(list);
}

export function getPagedLocalCharts(params){
	const pidx = params && params.PageIndex ? parseInt(params.PageIndex + '', 10) : 1;
	const psz = params && params.PageSize ? parseInt(params.PageSize + '', 10) : 30;
	const list = listLocalCharts(params || {});
	const start = (pidx - 1) * psz;
	const end = start + psz;
	return {
		List: list.slice(start, end),
		Total: list.length,
		PageIndex: pidx,
		PageSize: psz,
	};
}

export function buildLocalChartRecord(values){
	const cid = values && values.cid ? values.cid : `local-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
	let birth = values.birth;
	if(birth && typeof birth.format === 'function'){
		birth = birth.format('YYYY-MM-DD HH:mm:ss');
	}
	const record = {
		cid: cid,
		name: values.name ? values.name : '',
		birth: birth ? birth : nowStr(),
		zone: values.zone !== undefined && values.zone !== null ? values.zone : '+08:00',
		lat: values.lat,
		lon: values.lon,
		gpsLat: values.gpsLat,
		gpsLon: values.gpsLon,
		pos: values.pos ? values.pos : '',
		gender: values.gender !== undefined && values.gender !== null ? parseInt(values.gender + '', 10) : -1,
		isPub: values.isPub !== undefined && values.isPub !== null ? parseInt(values.isPub + '', 10) : 0,
		doubingSu28: values.doubingSu28 ? 1 : 0,
		group: normalizeGroup(values.group),
		creator: values.creator ? values.creator : 'local',
		updateTime: nowStr(),
		memoAstro: values.memoAstro ? values.memoAstro : null,
		memoBaZi: values.memoBaZi ? values.memoBaZi : null,
		memoZiWei: values.memoZiWei ? values.memoZiWei : null,
		memo74: values.memo74 ? values.memo74 : null,
		memoGua: values.memoGua ? values.memoGua : null,
		memoLiuReng: values.memoLiuReng ? values.memoLiuReng : null,
		memoQiMeng: values.memoQiMeng ? values.memoQiMeng : null,
		memoSuZhan: values.memoSuZhan ? values.memoSuZhan : null,
	};
	return record;
}

export function upsertLocalChart(values){
	const next = buildLocalChartRecord(values);
	const list = readRawCharts();
	const idx = list.findIndex((item)=> item.cid === next.cid);
	if(idx >= 0){
		list[idx] = {
			...list[idx],
			...next,
		};
	}else{
		list.push(next);
	}
	writeRawCharts(sortByUpdateTimeDesc(list));
	return next;
}

export function removeLocalChart(cid){
	const list = readRawCharts();
	const next = list.filter((item)=> item.cid !== cid);
	writeRawCharts(next);
}

export function exportLocalChartsBackup(){
	const charts = sortByUpdateTimeDesc(readRawCharts().slice());
	return {
		format: 'horosa-local-charts',
		version: 1,
		exportedAt: nowStr(),
		total: charts.length,
		charts: charts,
	};
}

export function importLocalChartsBackup(payload){
	if(!payload || typeof payload !== 'object'){
		return { imported: 0, total: readRawCharts().length };
	}
	const incoming = payload.charts;
	if(!(incoming instanceof Array)){
		return { imported: 0, total: readRawCharts().length };
	}
	let imported = 0;
	incoming.forEach((item)=>{
		if(!item || typeof item !== 'object'){
			return;
		}
		upsertLocalChart(item);
		imported += 1;
	});
	const total = readRawCharts().length;
	return { imported, total };
}
