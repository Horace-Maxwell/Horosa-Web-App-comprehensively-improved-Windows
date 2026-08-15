// [审计修·派生盘快照重定源] 六个占星派生键(hellenastro/dwadasamsa/harmonic/draconic/relocation
// 及其聚合 astrochart_like)的导出/挂载正文曾恒为**本命盘**(astro 单例)冒充分盘 —— 派生盘只活在
// 各页组件 state,全仓无一处把它存进快照。本 util 提供统一「出盘即存本键模块快照」:
// 正文 = 整张派生盘(与本命同一 buildAstroSnapshotContent,段名 ⊆ 各键既有 preset)+ 可选专属段。
// 导出侧 extractContentByKey 对这五键改「模块快照优先,无则回落 astro 单例」(旧快照可用,零硬断)。
import { buildAstroSnapshotContent } from './astroAiSnapshot';
import { saveModuleAISnapshotLazy } from './moduleAiSnapshot';

// 页面里 result.chart 可能是 {chart:{...},params:{...}} 包装,也可能是裸 chart —— 归一成 builder 形状。
export function coerceDerivedChartObj(raw){
	if(!raw || typeof raw !== 'object'){
		return null;
	}
	if(raw.chart && typeof raw.chart === 'object'){
		return raw;
	}
	if(Array.isArray(raw.objects) || Array.isArray(raw.houses)){
		return { chart: raw, params: raw.params || {} };
	}
	return null;
}

function fv(fields, key){
	if(!fields || !fields[key]){
		return '';
	}
	const v = fields[key].value !== undefined ? fields[key].value : fields[key];
	if(v && v.format){
		return key === 'date' ? v.format('YYYY-MM-DD') : v.format('HH:mm:ss');
	}
	return v == null ? '' : `${v}`;
}

// 出盘即存(惰性构建不阻塞渲染):specialtyLines 为函数(返回行数组,含专属段头),缺省无专属段。
export function saveDerivedAstroSnapshot(moduleKey, rawChart, fields, specialtyLines){
	try{
		saveModuleAISnapshotLazy(moduleKey, ()=>{
			const co = coerceDerivedChartObj(rawChart);
			const base = co ? `${buildAstroSnapshotContent(co, fields || null) || ''}`.trim() : '';
			let spec = '';
			try{
				const arr = typeof specialtyLines === 'function' ? (specialtyLines() || []) : [];
				spec = arr.filter(Boolean).join('\n').trim();
			}catch(e){ spec = ''; }
			return [base, spec].filter(Boolean).join('\n\n');
		}, {
			date: fv(fields, 'date'),
			time: fv(fields, 'time'),
			zone: fv(fields, 'zone'),
			lon: fv(fields, 'lon'),
			lat: fv(fields, 'lat'),
		});
	}catch(e){ /* 快照失败不影响页面主流程 */ }
}
