// AI 挂载真栈审计钩(仅调试):localStorage['horosa.debug.mountAudit']==='1' 时由 layouts/app.js 惰性装载,
// 在 window.__horosaMountAudit 暴露挂载链的真实入口(与页面同一份代码、同一份数据),供预览里机读核对:
//   · 无头重算 ⟷ 技法页所存模块快照 逐段相等(阶段①「无头重算=组件快照」判据)
//   · 拨挂载设置 → 快照正文差分(死开关判据)
//   · 段勾选 → 生效段/过滤后正文(所见即所得判据)
// 缺省关(键缺席即不装载,零路径);不写任何存储;只读现有 API。
import { listLocalCharts, upsertLocalChart, removeLocalChart } from './localcharts';
import { listLocalCases, upsertLocalCase, removeLocalCase } from './localcases';
import { listAnalysisSources, findAnalysisSourceById } from './aiAnalysisSources';
import {
	regenerateChartTechniqueSnapshot, regenerateCaseTechniqueSnapshot, getAnalysisTechniqueContextWithOptions,
	getAnalysisSourceContext, listAnalysisTechniqueOptions, ANALYSIS_CHART_TECHNIQUES, ANALYSIS_CASE_TECHNIQUES,
	ANALYSIS_TECHNIQUE_LABELS, buildContextLayers, clipContextLayersDetailed,
} from './aiAnalysisContext';
import { TECHNIQUE_SETTINGS_SCHEMA, getTechniqueSettingsDefaults, effectiveMountBaseline, pruneOptionsToNonDefault } from './techniqueMountSettings';
import {
	AI_EXPORT_PRESET_SECTIONS, getAIExportEffectiveSectionsForTechnique, applyAIExportSectionFilterToSnapshot,
	splitContentSections, loadAIExportSettings, saveAIExportSettings, getOptionsForTechniqueKey, normalizeSectionTitle,
} from './aiExport';
import { loadModuleAISnapshot } from './moduleAiSnapshot';
import { getDvaApp } from 'umi';

export const MOUNT_AUDIT_FLAG_KEY = 'horosa.debug.mountAudit';

export function isMountAuditEnabled(){
	try{ return typeof localStorage !== 'undefined' && localStorage.getItem(MOUNT_AUDIT_FLAG_KEY) === '1'; }catch(e){ return false; }
}

function sectionsOf(text){
	const out = [];
	`${text || ''}`.split('\n').forEach((ln)=>{
		const t = ln.trim();
		let m = t.match(/^\[(.+)\]$/);
		if(!m){ m = t.match(/^【(.+)】$/); }
		if(m && m[1]){ out.push(m[1]); }
	});
	return out;
}

export function installMountAuditHook(){
	if(typeof window === 'undefined'){ return null; }
	const api = {
		version: 1,
		labels: ANALYSIS_TECHNIQUE_LABELS,
		chartKeys: ANALYSIS_CHART_TECHNIQUES.slice(0),
		caseKeys: ANALYSIS_CASE_TECHNIQUES.slice(0),
		schema: TECHNIQUE_SETTINGS_SCHEMA,
		presets: AI_EXPORT_PRESET_SECTIONS,
		charts(){ return listLocalCharts() || []; },
		// 审计夹具:预览是新 origin(空库)时用来播种判别盘(调试钩专用;走与页面同一 upsert 通道)。
		upsertChart(values){ return upsertLocalChart(values); },
		removeChart(cid){ return removeLocalChart(cid); },
		upsertCase(values){ return upsertLocalCase(values); },
		removeCase(cid){ return removeLocalCase(cid); },
		cases(){ return listLocalCases() || []; },
		sources(){ return listAnalysisSources({}) || []; },
		source(id){ return findAnalysisSourceById(id); },
		techniqueOptions(sourceId){ return listAnalysisTechniqueOptions(findAnalysisSourceById(sourceId)); },
		defaults(key){ return getTechniqueSettingsDefaults(key); },
		baseline(key, record){ return effectiveMountBaseline(key, record || null); },
		prune(key, options, record){ return pruneOptionsToNonDefault(key, options || {}, effectiveMountBaseline(key, record || null)); },
		sections: sectionsOf,
		normalizeSectionTitle,
		split: splitContentSections,
		effectiveSections(key){ return getAIExportEffectiveSectionsForTechnique(key, loadAIExportSettings()); },
		sectionOptions(key){ return getOptionsForTechniqueKey(key); },
		filterBySections(key, text){ return applyAIExportSectionFilterToSnapshot(key, text, loadAIExportSettings()); },
		exportSettings(){ return loadAIExportSettings(); },
		setSections(key, list){ const s = loadAIExportSettings(); s.sections = s.sections || {}; if(list === null){ delete s.sections[key]; }else{ s.sections[key] = list; } saveAIExportSettings(s); return loadAIExportSettings(); },
		moduleSnapshot(moduleName){ return loadModuleAISnapshot(moduleName); },
		async regenChart(cid, key, opts){ const rec = (listLocalCharts() || []).find((c)=>c.cid === cid) || null; return rec ? regenerateChartTechniqueSnapshot({ ...rec, ...(opts || {}) }, key) : ''; },
		async regenCase(cid, key, payloadExtra){
			const rec = (listLocalCases() || []).find((c)=>c.cid === cid) || null;
			if(!rec){ return ''; }
			let payload = {};
			try{ payload = rec.payload ? JSON.parse(rec.payload) : {}; }catch(e){ payload = {}; }
			return regenerateCaseTechniqueSnapshot(rec, key, { ...payload, ...(payloadExtra || {}) });
		},
		async context(sourceId, key, options){ const src = findAnalysisSourceById(sourceId); return src ? getAnalysisTechniqueContextWithOptions(src, key, options || {}) : null; },
		async sourceContext(sourceId, mode){ const src = findAnalysisSourceById(sourceId); return src ? getAnalysisSourceContext(src, { mode: mode || 'full', preferCache: false }) : null; },
		// 与页面同一 dva store:载入命盘=ChartList.clickInfo 同一动作(user/setCurrentChart),让各技法页按该盘计算并存模块快照。
		dispatch(action){ const app = getDvaApp(); return app && app._store ? app._store.dispatch(action) : null; },
		state(){ const app = getDvaApp(); return app && app._store ? app._store.getState() : null; },
		loadChart(cid){ const rec = (listLocalCharts() || []).find((c)=>c.cid === cid) || null; return rec ? api.dispatch({ type: 'user/setCurrentChart', payload: rec }) : null; },
		buildLayers: buildContextLayers,
		clipLayers: clipContextLayersDetailed,
	};
	window.__horosaMountAudit = api;
	return api;
}
