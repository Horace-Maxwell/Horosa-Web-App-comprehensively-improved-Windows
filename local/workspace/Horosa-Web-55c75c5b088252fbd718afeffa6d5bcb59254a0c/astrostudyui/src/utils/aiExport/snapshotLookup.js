// AI 导出 · 快照查找:星盘缓存、快照正文抽取、模块别名、载荷 / 本地存储 / 模块缓存取快照、三式与印度缓存比对。
// 由 utils/aiExport.js 门面统一对外导出。
import { getStore } from '../storageutil';
import { getAstroAISnapshotForCurrent, saveAstroAISnapshot, loadAstroAISnapshot } from '../astroAiSnapshot';
import { loadModuleAISnapshot, MODULE_SNAPSHOT_PREFIX } from '../moduleAiSnapshot';
import { getTechniqueAliasList } from '../techniqueSlotAliases';
import { textOf, safe } from './settingsModel';

export function getAstroCachedContent(){
	try{
		const store = getStore();
		if(!store || !store.astro){
			const snap = loadAstroAISnapshot();
			return snap && snap.content ? snap.content : '';
		}
		const chartObj = store.astro.chartObj;
		const fields = store.astro.fields;
		const snapshot = getAstroAISnapshotForCurrent(chartObj, fields);
		if(snapshot && snapshot.content){
			return snapshot.content;
		}
		if(chartObj && chartObj.chart){
			const saved = saveAstroAISnapshot(chartObj, fields, { classicalDerived: true });   // 本命主盘救援重建同带衍化四段
			if(saved && saved.content){
				return saved.content;
			}
		}
		// 🔴 兜底不再无校验放行:走到这=当前盘签名严格比对已失败且救援重建也失败 ——
		// 陈旧快照(别的盘/别的宫制算的)从此处漏进导出正是标注撒谎③。有比对基准而不匹配 → 宁空。
		// (无 store 环境的 catch/早退分支仍保留兜底:无基准可比,历史行为不动。)
	}catch(e){
		const snap = loadAstroAISnapshot();
		return snap && snap.content ? snap.content : '';
	}
	return '';
}

function tryParseJSON(raw){
	if(raw === undefined || raw === null){
		return null;
	}
	if(typeof raw !== 'string'){
		return null;
	}
	const txt = raw.trim();
	if(!txt){
		return null;
	}
	if((txt[0] !== '{' || txt[txt.length - 1] !== '}')
		&& (txt[0] !== '[' || txt[txt.length - 1] !== ']')){
		return null;
	}
	try{
		return JSON.parse(txt);
	}catch(e){
		return null;
	}
}

function extractSnapshotText(raw){
	if(raw === undefined || raw === null){
		return '';
	}
	if(typeof raw === 'string'){
		const txt = raw.trim();
		if(!txt){
			return '';
		}
		const parsed = tryParseJSON(txt);
		if(parsed !== null){
			return extractSnapshotText(parsed);
		}
		return txt;
	}
	if(Array.isArray(raw)){
		for(let i=0; i<raw.length; i++){
			const txt = extractSnapshotText(raw[i]);
			if(txt){
				return txt;
			}
		}
		return '';
	}
	if(typeof raw !== 'object'){
		return '';
	}
	if(typeof raw.content === 'string' && raw.content.trim()){
		return raw.content.trim();
	}
	if(typeof raw.text === 'string' && raw.text.trim()){
		return raw.text.trim();
	}
	if(raw.value !== undefined){
		const txt = extractSnapshotText(raw.value);
		if(txt){
			return txt;
		}
	}
	if(raw.snapshot !== undefined){
		const txt = extractSnapshotText(raw.snapshot);
		if(txt){
			return txt;
		}
	}
	if(raw.payload !== undefined){
		const txt = extractSnapshotText(raw.payload);
		if(txt){
			return txt;
		}
	}
	const likelyKeys = ['data', 'result', 'snapshotText', 'moduleSnapshots', 'snapshots', 'modules'];
	for(let i=0; i<likelyKeys.length; i++){
		const key = likelyKeys[i];
		if(raw[key] === undefined){
			continue;
		}
		const txt = extractSnapshotText(raw[key]);
		if(txt){
			return txt;
		}
	}
	const keys = Object.keys(raw);
	for(let i=0; i<keys.length; i++){
		const key = keys[i];
		if(key === 'meta' || key === 'createdAt' || key === 'version' || key === 'module'){
			continue;
		}
		const txt = extractSnapshotText(raw[key]);
		if(txt){
			return txt;
		}
	}
	return '';
}

// 槽名别名表与挂载 / 存案等读盘方同一张(utils/techniqueSlotAliases):此前导出另有一张,
// 还把几门技法轮流覆盖的共用槽(shusuan / mingother)当兜底别名 —— 没进过该页时可能吐出另一门的旧盘
export function getModuleAliasList(moduleName){
	return getTechniqueAliasList(moduleName);
}

function getSnapshotFromPayload(payload, aliases){
	if(!payload || typeof payload !== 'object'){
		return '';
	}
	const aliasSet = new Set((aliases || []).map((item)=>`${item || ''}`).filter(Boolean));
	const candidates = [];
	const pushCandidate = (txt, score)=>{
		const val = `${txt || ''}`.trim();
		if(!val){
			return;
		}
		candidates.push({
			text: val,
			score: Number.isNaN(Number(score)) ? 0 : Number(score),
			len: val.length,
		});
	};
	pushCandidate(extractSnapshotText(payload.snapshot), 70);
	if(payload.module && aliasSet.has(`${payload.module}`)){
		pushCandidate(extractSnapshotText(payload.snapshot), 95);
	}
	(aliases || []).forEach((alias)=>{
		if(!alias){
			return;
		}
		pushCandidate(extractSnapshotText(payload[alias]), 96);
		const moduleSnapshots = payload.moduleSnapshots && typeof payload.moduleSnapshots === 'object'
			? payload.moduleSnapshots
			: null;
		if(moduleSnapshots){
			pushCandidate(extractSnapshotText(moduleSnapshots[alias]), 94);
		}
		const modules = payload.modules && typeof payload.modules === 'object'
			? payload.modules
			: null;
		if(modules){
			pushCandidate(extractSnapshotText(modules[alias]), 92);
		}
	});
	const snapshots = payload.snapshots && typeof payload.snapshots === 'object'
		? payload.snapshots
		: null;
	if(snapshots){
		Object.keys(snapshots).forEach((rawKey)=>{
			const key = `${rawKey || ''}`.trim();
			if(!key){
				return;
			}
			let matched = false;
			if(aliasSet.has(key)){
				matched = true;
			}
			if(key.indexOf(MODULE_SNAPSHOT_PREFIX) === 0){
				const suffix = key.substring(MODULE_SNAPSHOT_PREFIX.length);
				if(aliasSet.has(suffix)){
					matched = true;
				}
			}
			if(!matched){
				return;
			}
			pushCandidate(extractSnapshotText(snapshots[rawKey]), 93);
		});
	}
	const seen = new Set();
	const walk = (node, depth)=>{
		if(!node || depth > 4){
			return;
		}
		if(Array.isArray(node)){
			node.forEach((item)=>walk(item, depth + 1));
			return;
		}
		if(typeof node !== 'object'){
			return;
		}
		if(seen.has(node)){
			return;
		}
		seen.add(node);
		Object.keys(node).forEach((rawKey)=>{
			const key = `${rawKey || ''}`.trim();
			if(!key){
				return;
			}
			let matched = false;
			if(aliasSet.has(key)){
				matched = true;
			}
			if(key.indexOf(MODULE_SNAPSHOT_PREFIX) === 0){
				const suffix = key.substring(MODULE_SNAPSHOT_PREFIX.length);
				if(aliasSet.has(suffix)){
					matched = true;
				}
			}
			if(key.indexOf('snapshot') >= 0 || key.indexOf('module') >= 0){
				matched = true;
			}
			if(matched){
				pushCandidate(extractSnapshotText(node[rawKey]), 68 - depth);
			}
			if(depth < 4){
				walk(node[rawKey], depth + 1);
			}
		});
	};
	walk(payload, 0);
	if(!candidates.length){
		return '';
	}
	candidates.sort((a, b)=>{
		if(a.score !== b.score){
			return b.score - a.score;
		}
		return b.len - a.len;
	});
	return candidates[0].text || '';
}

export function getModuleCachedContent(moduleName){
	if(!moduleName){
		return '';
	}
	const aliases = getModuleAliasList(moduleName);
	for(let i=0; i<aliases.length; i++){
		const snapshot = loadModuleAISnapshot(aliases[i]);
		if(snapshot && snapshot.content){
			return snapshot.content;
		}
	}
	// 兜底：读取当前案例中保存的模块快照（同样来自计算阶段，不依赖右侧DOM采集）。
	try{
		const store = getStore();
		const payloadCandidates = [];
		const pushPayloadCandidate = (one)=>{
			if(one === undefined || one === null){
				return;
			}
			let val = one;
			if(typeof one === 'object' && one.value !== undefined){
				val = one.value;
			}
			if(typeof val === 'string'){
				const parsed = tryParseJSON(val);
				val = parsed !== null ? parsed : val;
			}
			payloadCandidates.push(val);
		};
		const userState = store && store.user ? store.user : null;
		const astroState = store && store.astro ? store.astro : null;
		const appState = store && store.app ? store.app : null;
		pushPayloadCandidate(userState && userState.currentCase ? userState.currentCase.payload : null);
		pushPayloadCandidate(userState && userState.currentChart ? userState.currentChart.payload : null);
		pushPayloadCandidate(astroState && astroState.currentCase ? astroState.currentCase.payload : null);
		pushPayloadCandidate(appState && appState.currentCase ? appState.currentCase.payload : null);
		for(let i=0; i<payloadCandidates.length; i++){
			const fromPayload = getSnapshotFromPayload(payloadCandidates[i], aliases);
			if(fromPayload){
				return fromPayload;
			}
		}
	}catch(e){
		// ignore
	}
	// 存储里的模块快照键上面 loadModuleAISnapshot 已按读序单源读过(内存 / 待落盘 / 存储取较新的一份),不再直读存储兜底。
	return '';
}

export function getModuleSnapshotPayload(moduleName){
	if(!moduleName){
		return null;
	}
	const aliases = getModuleAliasList(moduleName);
	const candidates = [];
	aliases.forEach((alias)=>{
		const snapshot = loadModuleAISnapshot(alias);
		if(!snapshot || !snapshot.content){
			return;
		}
		candidates.push(snapshot);
	});
	if(!candidates.length){
		return null;
	}
	candidates.sort((a, b)=>{
		const aCreated = safe(a && a.createdAt, '');
		const bCreated = safe(b && b.createdAt, '');
		if(aCreated && bCreated && aCreated !== bCreated){
			return aCreated > bCreated ? -1 : 1;
		}
		const aLen = safe(a && a.content, '').length;
		const bLen = safe(b && b.content, '').length;
		return bLen - aLen;
	});
	return candidates[0] || null;
}

function getCurrentStoreFieldSignature(){
	try{
		const store = getStore();
		const astro = store && store.astro ? store.astro : null;
		const fields = astro && astro.fields ? astro.fields : null;
		if(!fields){
			return {
				date: '',
				time: '',
				zone: '',
				lon: '',
				lat: '',
			};
		}
		const fmt = (val, pattern)=>{
			if(!val || typeof val.format !== 'function'){
				return '';
			}
			try{
				return `${val.format(pattern)}`;
			}catch(e){
				return '';
			}
		};
		return {
			date: fmt(fields.date && fields.date.value, 'YYYY-MM-DD'),
			time: fmt(fields.time && fields.time.value, 'HH:mm:ss'),
			zone: safe(fields.zone && fields.zone.value, ''),
			lon: safe(fields.lon && fields.lon.value, ''),
			lat: safe(fields.lat && fields.lat.value, ''),
		};
	}catch(e){
		return {
			date: '',
			time: '',
			zone: '',
			lon: '',
			lat: '',
		};
	}
}

export function getSanshiDisplayFieldSignature(scopeRoot){
	const fallback = getCurrentStoreFieldSignature();
	const sig = {
		...fallback,
	};
	if(!scopeRoot){
		return sig;
	}
	const rawText = `${textOf(scopeRoot) || ''}`.replace(/\s+/g, ' ');
	if(!rawText){
		return sig;
	}
	const dateMatched = rawText.match(/(\d{4}[/-]\d{2}[/-]\d{2})/);
	if(dateMatched && dateMatched[1]){
		sig.date = `${dateMatched[1]}`.replace(/\//g, '-');
	}
	// 三式合一左盘固定同时展示“真太阳时/直接时间”，用于导出匹配优先使用直接时间。
	const directMatched = rawText.match(/直接时间[：:]\s*(\d{2}:\d{2}(?::\d{2})?)/);
	if(directMatched && directMatched[1]){
		sig.time = `${directMatched[1]}`;
		return sig;
	}
	const solarMatched = rawText.match(/真太阳时[：:]\s*(\d{2}:\d{2}(?::\d{2})?)/);
	if(solarMatched && solarMatched[1]){
		sig.time = `${solarMatched[1]}`;
	}
	return sig;
}

function normalizeMinuteTime(val){
	const matched = `${val || ''}`.match(/(\d{2}):(\d{2})/);
	if(!matched){
		return '';
	}
	return `${matched[1]}:${matched[2]}`;
}

function parseSanshiDirectStamp(content){
	const txt = `${content || ''}`;
	if(!txt){
		return null;
	}
	const matched = txt.match(/直接时间[：:]\s*([0-9]{4}[/-][0-9]{2}[/-][0-9]{2})\s*([0-9]{2}:[0-9]{2}(?::[0-9]{2})?)/);
	if(!matched){
		return null;
	}
	return {
		date: `${matched[1] || ''}`.replace(/\//g, '-'),
		time: `${matched[2] || ''}`,
	};
}

export function isSanshiSnapshotMatchedCurrent(content, snapshotMeta, currentSig){
	const current = currentSig || {};
	if(!current.date || !current.time){
		return true;
	}
	let snapDate = safe(snapshotMeta && snapshotMeta.date, '');
	let snapTime = safe(snapshotMeta && snapshotMeta.time, '');
	const parsedDirect = parseSanshiDirectStamp(content);
	if(!snapDate && parsedDirect && parsedDirect.date){
		snapDate = parsedDirect.date;
	}
	if(!snapTime && parsedDirect && parsedDirect.time){
		snapTime = parsedDirect.time;
	}
	if(!snapDate || !snapTime){
		return false;
	}
	if(snapDate !== current.date){
		return false;
	}
	const curMinute = normalizeMinuteTime(current.time);
	const snapMinute = normalizeMinuteTime(snapTime);
	if(curMinute && snapMinute && curMinute !== snapMinute){
		return false;
	}
	const snapZone = safe(snapshotMeta && snapshotMeta.zone, '');
	if(current.zone && snapZone && current.zone !== snapZone){
		return false;
	}
	const snapLon = safe(snapshotMeta && snapshotMeta.lon, '');
	if(current.lon && snapLon && current.lon !== snapLon){
		return false;
	}
	const snapLat = safe(snapshotMeta && snapshotMeta.lat, '');
	if(current.lat && snapLat && current.lat !== snapLat){
		return false;
	}
	return true;
}

function parseIndiaFractalByLabel(label){
	const txt = `${label || ''}`.trim();
	if(!txt){
		return null;
	}
	if(txt.includes('命盘')){
		return 1;
	}
	const matched = txt.match(/(\d+)\s*律盘/);
	if(!matched){
		return null;
	}
	const val = parseInt(matched[1], 10);
	if(Number.isNaN(val) || val <= 0){
		return null;
	}
	return val;
}

export function getIndiaCachedContent(activeLabel){
	const keys = [];
	const fractal = parseIndiaFractalByLabel(activeLabel);
	if(fractal !== null){
		keys.push(`indiachart_${fractal}`);
	}
	keys.push('indiachart_current');
	keys.push('indiachart');

	for(let i=0; i<keys.length; i++){
		const txt = getModuleCachedContent(keys[i]);
		if(txt){
			return txt;
		}
	}
	return '';
}
