// aiAnalysisSources —— 「列出可挂载的命盘/事盘源」轻模块(WS-N1C, 2026-07-16)。
//
// 从 aiAnalysisContext.js(3600+ 行,静态吃进 ~50 个技法快照构建器)抽出:某技法页
// (某源列表组件)只需要「列出源」这一件事,却因 import 它连带整座 AI 核进自己的 async
// chunk(dist 逆向:46/47 两页面根 94 个共有模块/重复 2.48MB)。抽出后该组不再含 AI 核,
// 语义上也正确 —— 本模块只依赖 localcharts/localcases 两个轻存储层,零技法构建器。
// aiAnalysisContext 反向 re-export listAnalysisSources 保兼容(旧 import 路径不破)。
//
// [P0-S2] 指纹缓存(开关 horosa.perf.sourcesCache,默认开):
// - 每条记录按「entry 构造实际读到的字段」拼指纹;命中即复用上次的 entry 对象(免 normalizeTags /
//   extractCaseSnapshotText 的 JSON 解析),未命中才构建;缓存 Map 每次调用整体换代(消失的记录自然掉出)。
// - 记录集(序列+对象)与上次逐元素相同 → 返回同一数组引用(setState 同引用免重渲)。
// - findAnalysisSourceById 单条经内核 cid 索引 O(1) 查找,返回与列表同一 entry 对象。
// 关=每次全建新数组/新 entry(旧行为)。输出内容两态逐字段相同(参考实现对拍测试看守)。
import { getCaseTypeLabel, getCaseTypeMeta, listLocalCases, getLocalCase } from './localcases';
import { listLocalCharts, getLocalChart } from './localcharts';
import { sourcesCacheEnabled } from './perfFlags';

export function safeParseJson(txt, defVal = null){
	if(!txt){
		return defVal;
	}
	try{
		return JSON.parse(txt);
	}catch(e){
		return defVal;
	}
}

export function normalizeTags(group){
	const parsed = safeParseJson(group, null);
	if(Array.isArray(parsed)){
		return parsed;
	}
	if(Array.isArray(group)){
		return group;
	}
	if(typeof group === 'string' && group.trim() !== ''){
		return group.split(/[,，\n]/g).map((item)=>`${item || ''}`.trim()).filter(Boolean);
	}
	return [];
}

export function extractSnapshotText(raw){
	if(raw === undefined || raw === null){
		return '';
	}
	if(typeof raw === 'string'){
		const txt = raw.trim();
		if(!txt){
			return '';
		}
		const parsed = safeParseJson(txt, null);
		return parsed !== null ? extractSnapshotText(parsed) : txt;
	}
	if(Array.isArray(raw)){
		for(let i = 0; i < raw.length; i += 1){
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
	const likelyKeys = ['value', 'snapshot', 'payload', 'data', 'result', 'snapshotText', 'moduleSnapshots', 'snapshots', 'modules'];
	for(let i = 0; i < likelyKeys.length; i += 1){
		const key = likelyKeys[i];
		if(raw[key] === undefined){
			continue;
		}
		const txt = extractSnapshotText(raw[key]);
		if(txt){
			return txt;
		}
	}
	return '';
}

export function summarizeCasePayload(record, payload){
	const lines = [];
	const meta = getCaseTypeMeta(record.caseType);
	lines.push(`案例名称：${record.event || '未命名案例'}`);
	lines.push(`案例类型：${getCaseTypeLabel(record.caseType)}`);
	lines.push(`所属模块：${record.sourceModule || meta.module || meta.value || ''}`);
	if(record.divTime){
		lines.push(`占断时间：${record.divTime}`);
	}
	if(record.zone){
		lines.push(`时区：${record.zone}`);
	}
	if(record.pos){
		lines.push(`地点：${record.pos}`);
	}
	const tags = normalizeTags(record.group);
	if(tags.length){
		lines.push(`标签：${tags.join('、')}`);
	}
	lines.push('');
	lines.push('结构化案例数据：');
	lines.push(JSON.stringify(payload || {}, null, 2));
	return lines.join('\n').trim();
}

export function extractCaseSnapshotText(record){
	const payload = safeParseJson(record.payload, null);
	if(!payload){
		return {
			content: summarizeCasePayload(record, null),
			payload: null,
			moduleName: record.sourceModule || getCaseTypeMeta(record.caseType).module,
			snapshotStatus: 'generated',
		};
	}
	// payload.snapshot 可能是对象 {content/text}（世俗/卜卦），也可能是纯字符串
	// （kentang 报数法：五兆/皇极/太玄/荆诀/神易数 存 `snapshot: buildSnapshotText(...)`）。
	// 用 extractSnapshotText 统一识别字符串/对象/嵌套 —— 旧式 `.content/.text` 对字符串取属性得 undefined，
	// 会把真盘文本误判为空 → 退回 summarizeCasePayload 泛化摘要（源选择器看着「没接好」）。
	const snapshot =
		extractSnapshotText(payload.snapshot) ||
		payload.aiExport ||
		payload.aiSnapshot ||
		(payload.result && payload.result.aiSnapshot) ||
		(payload.result && payload.result.snapshotText) ||
		'';
	if(`${snapshot || ''}`.trim()){
		return {
			content: `${snapshot}`.trim(),
			payload,
			moduleName: payload.module || record.sourceModule || getCaseTypeMeta(record.caseType).module,
			snapshotStatus: 'ready',
		};
	}
	return {
		content: summarizeCasePayload(record, payload),
		payload,
		moduleName: payload.module || record.sourceModule || getCaseTypeMeta(record.caseType).module,
		snapshotStatus: 'generated',
	};
}

function buildChartEntry(item){
	return {
		id: item.cid,
		sourceType: 'chart',
		title: item.name || '未命名命盘',
		module: 'astrochart',
		time: item.birth || item.updateTime || '',
		zone: item.zone || '+08:00',
		tags: normalizeTags(item.group),
		snapshotStatus: 'lazy',
		updatedAt: item.updateTime || '',
		record: item,
	};
}

function buildCaseEntry(item){
	const meta = getCaseTypeMeta(item.caseType);
	const extracted = extractCaseSnapshotText(item);
	return {
		id: item.cid,
		sourceType: 'case',
		title: item.event || '未命名事盘',
		module: item.sourceModule || extracted.moduleName || meta.module,
		time: item.divTime || item.updateTime || '',
		zone: item.zone || '+08:00',
		tags: normalizeTags(item.group),
		snapshotStatus: extracted.snapshotStatus,
		updatedAt: item.updateTime || '',
		record: item,
	};
}

// 排序键与旧比较器同源:Date.parse(updatedAt || time) || 0,倒序;稳定排序下平局按输入序(命盘在前、事盘在后)。
function entryTs(entry){
	return Date.parse(entry.updatedAt || entry.time || '') || 0;
}

// ---- 指纹缓存 ----
// 指纹字段 = entry 构造实际读到的字段;分隔符用 US(0x1f) 控制字符,避免字段值含 '|' 之类可见符号时错位。
const FP_SEP = '';

function fpVal(v){
	if(v === undefined || v === null){
		return '';
	}
	if(typeof v === 'string'){
		return v;
	}
	// 非串值带类型标记(数字 1 与串 '1' 不同指纹);对象/数组(如历史记录的 group 数组)按 JSON 串。
	if(typeof v === 'object'){
		try{
			return '' + JSON.stringify(v);
		}catch(e){
			return null;
		}
	}
	return '' + typeof v + ':' + String(v);
}

function joinFp(parts){
	for(let i = 0; i < parts.length; i++){
		if(parts[i] === null){
			return null;   // 任一字段无法廉价指纹 → 本条不缓存(每次重建)
		}
	}
	return parts.join(FP_SEP);
}

function chartFingerprint(item){
	return joinFp(['c', fpVal(item.cid), fpVal(item.updateTime), fpVal(item.name), fpVal(item.birth), fpVal(item.zone), fpVal(item.group)]);
}

function caseFingerprint(item){
	const p = item.payload;
	// payload 正常为归一后的串(normalizePayload);非串对象无法廉价指纹 → 不缓存。
	if(p !== undefined && p !== null && typeof p !== 'string'){
		return null;
	}
	return joinFp(['k', fpVal(item.cid), fpVal(item.updateTime), fpVal(item.event), fpVal(item.divTime), fpVal(item.zone), fpVal(item.group), fpVal(item.caseType), fpVal(item.sourceModule), typeof p === 'string' ? String(p.length) : '']);
}

let entryCache = new Map();   // fp → { entry, ts }
let lastList = null;
const cacheStats = { builds: 0, hits: 0 };

function makeSlot(item, kind){
	const entry = kind === 'chart' ? buildChartEntry(item) : buildCaseEntry(item);
	cacheStats.builds += 1;
	return { entry, ts: entryTs(entry) };
}

// 命中槽:entry 对象身份不变;record 指向最新记录对象(记录经 touch/置顶等指纹外字段写入后内核会换出新对象)。
function refreshSlot(slot, item){
	cacheStats.hits += 1;
	if(slot.entry.record !== item){
		slot.entry.record = item;
	}
	return slot;
}

// opts.force=true:忽略缓存全量重建(entry 与数组皆新)。
export function listAnalysisSources(opts){
	const force = !!(opts && opts.force);
	const useCache = sourcesCacheEnabled();
	const charts = listLocalCharts({});
	const cases = listLocalCases({});
	const nextCache = new Map();
	const slots = new Array(charts.length + cases.length);
	let builds = 0;
	let n = 0;
	const take = (item, kind)=>{
		const fp = useCache ? (kind === 'chart' ? chartFingerprint(item) : caseFingerprint(item)) : null;
		// 同一次调用里指纹重复(同 cid 重复记录属数据异常)只让首条复用,后续条各自重建。
		let slot = (fp !== null && !force && !nextCache.has(fp)) ? entryCache.get(fp) : undefined;
		if(slot){
			refreshSlot(slot, item);
		}else{
			slot = makeSlot(item, kind);
			builds += 1;
		}
		if(fp !== null && !nextCache.has(fp)){
			nextCache.set(fp, slot);
		}
		slots[n++] = slot;
	};
	for(let i = 0; i < charts.length; i++){
		take(charts[i], 'chart');
	}
	for(let i = 0; i < cases.length; i++){
		take(cases[i], 'case');
	}
	slots.sort((a, b)=>b.ts - a.ts);
	entryCache = nextCache;
	if(!useCache){
		lastList = null;
		return slots.map((s)=>s.entry);
	}
	if(builds === 0 && lastList && lastList.length === slots.length){
		let same = true;
		for(let i = 0; i < slots.length; i++){
			if(lastList[i] !== slots[i].entry){
				same = false;
				break;
			}
		}
		if(same){
			return lastList;
		}
	}
	lastList = slots.map((s)=>s.entry);
	return lastList;
}

function entryForRecord(item, kind){
	const fp = sourcesCacheEnabled() ? (kind === 'chart' ? chartFingerprint(item) : caseFingerprint(item)) : null;
	if(fp !== null){
		const slot = entryCache.get(fp);
		if(slot){
			return refreshSlot(slot, item).entry;
		}
	}
	const slot = makeSlot(item, kind);
	if(fp !== null){
		entryCache.set(fp, slot);
	}
	return slot.entry;
}

// 单条查找:命盘先、事盘后,排除已归档(与 listAnalysisSources().find(s => s.id === cid) 语义一致);
// 不存在/已归档 → null。返回的 entry 与列表里的是同一对象(缓存开启时)。
export function findAnalysisSourceById(cid){
	if(cid === undefined || cid === null || cid === ''){
		return null;
	}
	const chart = getLocalChart(cid);
	if(chart && chart.archived !== true){
		return entryForRecord(chart, 'chart');
	}
	const kase = getLocalCase(cid);
	if(kase && kase.archived !== true){
		return entryForRecord(kase, 'case');
	}
	return null;
}

export function __sourcesCacheStatsForTests(){
	return { builds: cacheStats.builds, hits: cacheStats.hits };
}

export function __resetSourcesCacheForTests(){
	entryCache = new Map();
	lastList = null;
	cacheStats.builds = 0;
	cacheStats.hits = 0;
}
