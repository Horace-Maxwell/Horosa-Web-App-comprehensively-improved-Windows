// aiAnalysisSources —— 「列出可挂载的命盘/事盘源」轻模块(WS-N1C, 2026-07-16)。
//
// 从 aiAnalysisContext.js(3600+ 行,静态吃进 ~50 个技法快照构建器)抽出:某私有页
// (某私有源组件)只需要「列出源」这一件事,却因 import 它连带整座 AI 核进自己的 async
// chunk(dist 逆向:46/47 两页面根 94 个共有模块/重复 2.48MB)。抽出后该组不再含 AI 核,
// 语义上也正确 —— 本模块只依赖 localcharts/localcases 两个轻存储层,零技法构建器。
// aiAnalysisContext 反向 re-export listAnalysisSources 保兼容(旧 import 路径不破)。
import { getCaseTypeLabel, getCaseTypeMeta, listLocalCases } from './localcases';
import { listLocalCharts } from './localcharts';

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

export function listAnalysisSources(){
	const charts = listLocalCharts({}).map((item)=>({
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
	}));
	const cases = listLocalCases({}).map((item)=>{
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
	});
	return charts.concat(cases).sort((a, b)=>{
		const ta = Date.parse(a.updatedAt || a.time || '') || 0;
		const tb = Date.parse(b.updatedAt || b.time || '') || 0;
		return tb - ta;
	});
}
