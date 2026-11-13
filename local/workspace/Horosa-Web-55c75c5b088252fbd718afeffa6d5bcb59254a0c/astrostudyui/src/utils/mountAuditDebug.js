// AI 挂载真栈审计钩(仅调试):localStorage['horosa.debug.mountAudit']==='1' 时由 layouts/app.js 惰性装载,
// 在 window.__horosaMountAudit 暴露挂载链的真实入口(与页面同一份代码、同一份数据),供预览里机读核对:
//   · 无头重算 ⟷ 技法页所存模块快照 逐段相等(阶段①「无头重算=组件快照」判据)
//   · 拨挂载设置 → 快照正文差分(死开关判据)
//   · 段勾选 → 生效段/过滤后正文(所见即所得判据)
//   · 当前页导出正文(与「AI导出」按钮同一份)
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
	splitContentSections, loadAIExportSettings, saveAIExportSettings, getOptionsForTechniqueKey, normalizeSectionTitle, getAIExportDefaultOffSet,
} from './aiExport';
import { loadModuleAISnapshot } from './moduleAiSnapshot';
import { getDvaApp } from 'umi';

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
		defaultOff(key){ const off = getAIExportDefaultOffSet(key); return off ? [...off] : []; },
		filterBySections(key, text){ return applyAIExportSectionFilterToSnapshot(key, text, loadAIExportSettings()); },
		exportSettings(){ return loadAIExportSettings(); },
		setSections(key, list){ const s = loadAIExportSettings(); s.sections = s.sections || {}; if(list === null){ delete s.sections[key]; }else{ s.sections[key] = list; } saveAIExportSettings(s); return loadAIExportSettings(); },
		moduleSnapshot(moduleName){ return loadModuleAISnapshot(moduleName); },
		async regenChart(cid, key, opts){ const rec = (listLocalCharts() || []).find((c)=>c.cid === cid) || null; return rec ? regenerateChartTechniqueSnapshot({ ...rec, ...(opts || {}) }, key) : ''; },
		// 当前页导出的三种文件形态(只在内存里生成,不落盘、不弹保存框):Word(docx)/ PDF(矢量)的 base64 +
		// PDF 版式节点摘要 + 文档模型摘要,供逐技法核对「段 / 表 / 正文在各格式里都齐」。
		async currentPageFormats(){
			const ex = await import('./aiExport');
			const p = await ex.buildCurrentPageExportForTool();
			const payload = { tech: p.technique, text: p.text || '', content: p.content || '', filenameBase: 'audit' };
			const toB64 = async (blob)=>{
				if(!blob){ return ''; }
				const buf = new Uint8Array(await blob.arrayBuffer());
				let bin = '';
				for(let i = 0; i < buf.length; i += 0x8000){ bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); }
				return btoa(bin);
			};
			const err = {};
			let docx = ''; let pdf = ''; let nodes = null; let model = null;
			try{ const r = await import('./aiExportDocRender'); docx = await toB64(await r.buildExportDocxBlob(payload)); }catch(e){ err.docx = `${(e && e.message) || e}`; }
			try{ const v = await import('./aiExportPdfVector'); pdf = await toB64(await v.buildExportPdfVectorBlob(payload)); }catch(e){ err.pdf = `${(e && e.message) || e}`; }
			try{
				const r = await import('./aiExportDocRender');
				const list = r.renderExportDocToPdfNodes(payload) || [];
				nodes = { count: list.length, sections: list.filter((n)=>n.className === 'exp-sec').map((n)=>n.textContent), tables: list.reduce((a, n)=>a + (n.tagName === 'TABLE' ? 1 : n.querySelectorAll('table').length), 0), text: list.map((n)=>n.textContent).join('\n') };
			}catch(e){ err.nodes = `${(e && e.message) || e}`; }
			try{
				const m = await import('./aiExportDocModel');
				const d = m.parseAiExportDocument(payload.text);
				model = { sections: (d.sections || []).map((sec)=>({ title: sec.title, blocks: (sec.blocks || []).map((b)=>b.type) })) };
			}catch(e){ err.model = `${(e && e.message) || e}`; }
			return { technique: p.technique, exportKey: p.exportKey, text: payload.text, content: payload.content, docx, pdf, nodes, model, err };
		},
		// 同上,但重算抛错时把错误原样抛出(排障用:默认路径吞异常返回空串,看不出是哪一步断的)
		async regenChartStrict(cid, key, opts){ const rec = (listLocalCharts() || []).find((c)=>c.cid === cid) || null; return rec ? regenerateChartTechniqueSnapshot({ ...rec, ...(opts || {}) }, key, { throwOnError: true }) : ''; },
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
		// 当前页「AI导出」正文(与页面导出按钮 / read_current_page 同一函数;只读,不落盘不进剪贴板)
		async currentPageExport(){ const m = await import('./aiExport'); return m.buildCurrentPageExportForTool(); },
		buildLayers: buildContextLayers,
		clipLayers: clipContextLayersDetailed,
	};
	window.__horosaMountAudit = api;
	return api;
}
