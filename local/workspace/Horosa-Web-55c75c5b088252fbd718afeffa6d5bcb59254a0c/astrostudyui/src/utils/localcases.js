const LocalCasesKey = 'horosa.localCases.v1';
const AstroAiSnapshotKey = 'horosa.ai.snapshot.astro.v1';
const ModuleAiSnapshotPrefix = 'horosa.ai.snapshot.module.v1.';
let fallbackToMemoryStore = false;
let fallbackWarned = false;
let memoryCases = [];

function getLocalStorage(){
	try{
		if(typeof window !== 'undefined' && window.localStorage){
			return window.localStorage;
		}
		if(typeof localStorage !== 'undefined'){
			return localStorage;
		}
	}catch(e){
		return null;
	}
	return null;
}

function warnMemoryFallback(){
	if(fallbackWarned){
		return;
	}
	fallbackWarned = true;
	if(typeof console !== 'undefined' && console && typeof console.warn === 'function'){
		console.warn('[horosa] localStorage unavailable, case data falls back to memory for this session.');
	}
}

function enableMemoryFallback(){
	fallbackToMemoryStore = true;
	warnMemoryFallback();
}

function isQuotaError(err){
	if(!err){
		return false;
	}
	const name = `${err.name || ''}`;
	const code = Number(err.code || 0);
	const message = `${err.message || ''}`.toLowerCase();
	if(code === 22 || code === 1014){
		return true;
	}
	if(name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED'){
		return true;
	}
	return message.indexOf('quota') >= 0;
}

function purgeHeavyLocalCache(){
	const storage = getLocalStorage();
	if(!storage){
		return;
	}
	try{
		storage.removeItem(AstroAiSnapshotKey);
	}catch(e){
		// ignore
	}
	const keys = [];
	try{
		for(let i=0; i<storage.length; i++){
			const key = storage.key(i);
			if(key && key.indexOf(ModuleAiSnapshotPrefix) === 0){
				keys.push(key);
			}
		}
	}catch(e){
		return;
	}
	keys.forEach((key)=>{
		try{
			storage.removeItem(key);
		}catch(e){
			// ignore
		}
	});
}

export const CASE_TYPE_OPTIONS = [
	{ value: 'liuyao', label: '六爻', subTab: null, tab: 'guazhan', module: 'guazhan' },
	{ value: 'liureng', label: '六壬', subTab: null, tab: 'liureng', module: 'liureng' },
	{ value: 'suzhan', label: '宿盘', subTab: 'suzhan', tab: 'cnyibu', module: 'suzhan' },
	{ value: 'jinkou', label: '金口诀', subTab: 'jinkou', tab: 'cnyibu', module: 'jinkou' },
	{ value: 'taiyi', label: '太乙', subTab: null, tab: 'taiyi', module: 'taiyi' },
	{ value: 'qimen', label: '奇门', subTab: null, tab: 'dunjia', module: 'qimen' },
	{ value: 'tongshefa', label: '统摄法', subTab: 'tongshefa', tab: 'cnyibu', module: 'tongshefa' },
	{ value: 'huangji', label: '皇极经世', subTab: 'huangji', tab: 'cnyibu', module: 'huangji' },
	{ value: 'wuzhao', label: '五兆', subTab: 'wuzhao', tab: 'cnyibu', module: 'wuzhao' },
	{ value: 'taixuan', label: '太玄', subTab: 'taixuan', tab: 'cnyibu', module: 'taixuan' },
	{ value: 'guice', label: '皇极轨策', subTab: 'guice', tab: 'cnyibu', module: 'guice' },
	{ value: 'xiaoliuren', label: '小六壬', subTab: 'xiaoliuren', tab: 'cnyibu', module: 'xiaoliuren' },
	{ value: 'xiaochengtu', label: '小成图', subTab: 'xiaochengtu', tab: 'cnyibu', module: 'xiaochengtu' },
	{ value: 'feigong', label: '飞宫小奇门', subTab: 'feigong', tab: 'cnyibu', module: 'feigong' },
	{ value: 'jingjue', label: '荆诀', subTab: 'jingjue', tab: 'cnyibu', module: 'jingjue' },
	{ value: 'shenyishu', label: '神易数', subTab: 'shenyishu', tab: 'cnyibu', module: 'shenyishu' },
	{ value: 'geomancy', label: '天文地占', subTab: 'geomancy', tab: 'cnyibu', module: 'geomancy' },
	{ value: 'tarot', label: '塔罗', subTab: 'tarot', tab: 'cnyibu', module: 'tarot' },
	{ value: 'sanshiunited', label: '三式合一', subTab: null, tab: 'sanshiunited', module: 'sanshiunited' },
	{ value: 'horary', label: '卜卦', subTab: 'horary', tab: 'auxchart', module: 'horary' },
	{ value: 'election', label: '择日', subTab: 'election', tab: 'auxchart', module: 'election' },
	{ value: 'mundane', label: '世俗盘', subTab: 'mundane', tab: 'auxchart', module: 'mundane' },
	{ value: 'tianxing', label: '天星择日', subTab: 'tianxing', tab: 'zeri', module: 'tianxing' },
];

const CASE_TYPE_ALIASES = {
	'六爻': 'liuyao',
	'六壬': 'liureng',
	'宿盘': 'suzhan',
	'宿盤': 'suzhan',
	'宿占': 'suzhan',
	'金口诀': 'jinkou',
	'太乙': 'taiyi',
	'奇门': 'qimen',
	'奇門': 'qimen',
	'遁甲': 'qimen',
	'三式合一': 'sanshiunited',
	'卜卦': 'horary',
	'卜卦盘': 'horary',
	'卜卦盤': 'horary',
	'择日': 'election',
	'择日盘': 'election',
	'擇日': 'election',
	'擇日盤': 'election',
	'统摄法': 'tongshefa',
	'統攝法': 'tongshefa',
	'皇极经世': 'huangji',
	'皇極經世': 'huangji',
	'皇极': 'huangji',
	'皇極': 'huangji',
	'五兆': 'wuzhao',
	'太玄': 'taixuan',
	'荆诀': 'jingjue',
	'荊訣': 'jingjue',
	'神易数': 'shenyishu',
	'神易數': 'shenyishu',
	'天文地占': 'geomancy',
	'地占': 'geomancy',
	'塔罗': 'tarot',
};

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

function normalizeCaseType(type){
	const val = `${type || ''}`.trim();
	if(!val){
		return 'liuyao';
	}
	if(CASE_TYPE_ALIASES[val]){
		return CASE_TYPE_ALIASES[val];
	}
	if(CASE_TYPE_OPTIONS.find((item)=>item.value === val)){
		return val;
	}
	return val;
}

export function getCaseTypeLabel(type){
	const one = CASE_TYPE_OPTIONS.find((item)=>item.value === normalizeCaseType(type));
	return one ? one.label : (type || '六爻');
}

export function getCaseTypeMeta(type){
	const normalized = normalizeCaseType(type);
	const one = CASE_TYPE_OPTIONS.find((item)=>item.value === normalized);
	if(one){
		return one;
	}
	return {
		value: normalized,
		label: normalized || '六爻',
		subTab: normalized || null,
		tab: 'cnyibu',
		module: normalized || 'guazhan',
	};
}

function sortByUpdateTimeDesc(list){
	return list.sort((a, b)=>{
		const ta = Date.parse(a.updateTime || '') || 0;
		const tb = Date.parse(b.updateTime || '') || 0;
		return tb - ta;
	});
}

function readRawCases(){
	if(fallbackToMemoryStore){
		return memoryCases.slice();
	}
	const storage = getLocalStorage();
	if(!storage){
		enableMemoryFallback();
		return memoryCases.slice();
	}
	let raw = null;
	try{
		raw = storage.getItem(LocalCasesKey);
	}catch(e){
		enableMemoryFallback();
		return memoryCases.slice();
	}
	const ary = safeParseJson(raw, []);
	if(!(ary instanceof Array)){
		return [];
	}
	memoryCases = ary.slice();
	return ary;
}

function writeRawCases(list){
	const next = list instanceof Array ? list.slice() : [];
	memoryCases = next;
	if(fallbackToMemoryStore){
		return true;
	}
	const storage = getLocalStorage();
	if(!storage){
		enableMemoryFallback();
		return true;
	}
	const text = JSON.stringify(next);
	try{
		storage.setItem(LocalCasesKey, text);
		return true;
	}catch(e){
		if(isQuotaError(e)){
			purgeHeavyLocalCache();
			try{
				storage.setItem(LocalCasesKey, text);
				return true;
			}catch(e2){
				// ignore and fallback below
			}
		}
		enableMemoryFallback();
		return true;
	}
}

export function listLocalCases(filter){
	let list = readRawCases();
	if(filter && filter.name){
		const name = (filter.name + '').trim().toLowerCase();
		if(name !== ''){
			list = list.filter((item)=>{
				const txt = item && item.event ? (item.event + '').toLowerCase() : '';
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

export function getPagedLocalCases(params){
	const pidx = params && params.PageIndex ? parseInt(params.PageIndex + '', 10) : 1;
	const psz = params && params.PageSize ? parseInt(params.PageSize + '', 10) : 30;
	const list = listLocalCases(params || {});
	const start = (pidx - 1) * psz;
	const end = start + psz;
	return {
		List: list.slice(start, end),
		Total: list.length,
		PageIndex: pidx,
		PageSize: psz,
	};
}

function normalizePayload(payload){
	if(payload === undefined || payload === null){
		return null;
	}
	if(typeof payload === 'string'){
		return payload;
	}
	try{
		return JSON.stringify(payload);
	}catch(e){
		return `${payload}`;
	}
}

export function buildLocalCaseRecord(values){
	const cid = values && values.cid ? values.cid : `local-case-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
	let divTime = values.divTime;
	if(divTime && typeof divTime.format === 'function'){
		divTime = divTime.format('YYYY-MM-DD HH:mm:ss');
	}
	const caseType = normalizeCaseType(values.caseType || values.sourceModule);
	const caseMeta = getCaseTypeMeta(caseType);
	const record = {
		cid: cid,
		event: values.event ? values.event : '',
		caseType: caseType,
		divTime: divTime ? divTime : nowStr(),
		zone: values.zone !== undefined && values.zone !== null ? values.zone : '+08:00',
		lat: values.lat,
		lon: values.lon,
		gpsLat: values.gpsLat,
		gpsLon: values.gpsLon,
		pos: values.pos ? values.pos : '',
		isPub: values.isPub !== undefined && values.isPub !== null ? parseInt(values.isPub + '', 10) : 0,
		group: normalizeGroup(values.group),
		creator: values.creator ? values.creator : 'local',
		updateTime: values.preserveUpdateTime && values.updateTime ? values.updateTime : nowStr(),
		payload: normalizePayload(values.payload),
		sourceModule: values.sourceModule ? values.sourceModule : caseMeta.module,
	};
	return record;
}

export function upsertLocalCase(values){
	const list = readRawCases();
	const cid = values && values.cid ? values.cid : null;
	const idx = cid ? list.findIndex((item)=> item.cid === cid) : -1;
	const base = idx >= 0 ? list[idx] : {};
	const next = buildLocalCaseRecord({
		...base,
		...(values || {}),
	});
	if(idx >= 0){
		list[idx] = {
			...list[idx],
			...next,
		};
	}else{
		list.push(next);
	}
	const saved = writeRawCases(sortByUpdateTimeDesc(list));
	if(!saved){
		throw new Error('local.case.save.failed');
	}
	return next;
}

export function removeLocalCase(cid){
	const list = readRawCases();
	const next = list.filter((item)=> item.cid !== cid);
	const saved = writeRawCases(next);
	if(!saved){
		throw new Error('local.case.delete.failed');
	}
}

export function exportLocalCasesBackup(){
	const cases = sortByUpdateTimeDesc(readRawCases().slice());
	return {
		format: 'horosa-local-cases',
		version: 1,
		exportedAt: nowStr(),
		total: cases.length,
		cases: cases,
	};
}

export function importLocalCasesBackup(payload){
	if(!payload || typeof payload !== 'object'){
		return { imported: 0, total: readRawCases().length };
	}
	const incoming = payload.cases;
	if(!(incoming instanceof Array)){
		return { imported: 0, total: readRawCases().length };
	}
	let imported = 0;
	incoming.forEach((item)=>{
		if(!item || typeof item !== 'object'){
			return;
		}
		upsertLocalCase({
			...item,
			preserveUpdateTime: true,
		});
		imported += 1;
	});
	const total = readRawCases().length;
	return { imported, total };
}
