// AI 助手·MCP 资源面(P5):把本机命盘/事盘/资料以 `horosa://` URI 暴露给外部智能体(Claude Code / Codex)读取。
// 只读、只出内容不出令牌;正文由页面既有单源产出(命盘/事盘=挂载快照 getAnalysisSourceContext;资料=资料库正文),
// 截断由传输层(mcpBridge.truncateForMcp)统一做——本文件不猜上限、不引桥、不引运行时。
import { listLocalCharts } from '../localcharts';
import { listLocalCases, getCaseTypeMeta } from '../localcases';
import { findAnalysisSourceById } from '../aiAnalysisSources';
import { getAnalysisSourceContext } from '../aiAnalysisContext';
import { AI_ANALYSIS_STORES, listStoreRecords, getStoreRecord } from '../aiAnalysisStore';

export const RESOURCE_SCHEME = 'horosa://';
export const RESOURCE_KINDS = ['chart', 'case', 'material'];
export const RESOURCE_LIST_MAX = 200;
export const RESOURCE_ID_MAX = 256;   // 再长的 id 不可能对应任何本机记录,只会拖着整条链去扫全表

export function resourceUri(kind, id){ return `${RESOURCE_SCHEME}${kind}/${id}`; }

// `horosa://chart/local-123` → { kind:'chart', id:'local-123' };非法/未知类别 → null
export function parseResourceUri(uri){
	const s = `${uri == null ? '' : uri}`.trim();
	if(s.indexOf(RESOURCE_SCHEME) !== 0){ return null; }
	const rest = s.slice(RESOURCE_SCHEME.length);
	const i = rest.indexOf('/');
	if(i <= 0){ return null; }
	const kind = rest.slice(0, i);
	// [R1] 只认自有键:KIND_READERS 是普通对象,constructor/toString/__proto__ 走原型链都「非 undefined」
	if(!Object.prototype.hasOwnProperty.call(KIND_READERS, kind)){ return null; }
	const rawId = rest.slice(i + 1);
	if(!rawId || rawId.length > RESOURCE_ID_MAX * 3){ return null; }   // 百分号编码后最长 3 倍
	let id = '';
	try{ id = decodeURIComponent(rawId); }catch(e){ return null; }   // [R2] 坏百分号编码不抛:整条 URI 判非法
	if(!id || id.length > RESOURCE_ID_MAX){ return null; }
	return { kind, id };
}

export function listResourceTemplates(){
	return [
		{ uriTemplate: `${RESOURCE_SCHEME}chart/{cid}`, name: '命盘快照', description: '按 cid 读一张命盘的排盘快照(与应用内 AI 挂载同一份真值)', mimeType: 'text/plain' },
		{ uriTemplate: `${RESOURCE_SCHEME}case/{cid}`, name: '事盘快照', description: '按 cid 读一个事盘(占卜/择日等)的起课快照', mimeType: 'text/plain' },
		{ uriTemplate: `${RESOURCE_SCHEME}material/{id}`, name: '资料正文', description: '按 id 读资料库里的一份文档正文', mimeType: 'text/plain' },
	];
}

export async function listResources(opts){
	const limit = Math.max(1, Math.min(RESOURCE_LIST_MAX, Number(opts && opts.limit) || RESOURCE_LIST_MAX));
	const out = [];
	try{
		listLocalCharts({}).forEach((r)=>{ if(r && r.cid){ out.push({ uri: resourceUri('chart', r.cid), name: `命盘·${r.name || r.cid}`, description: `${r.birth || ''}${r.pos ? ` · ${r.pos}` : ''}`.trim(), mimeType: 'text/plain' }); } });
	}catch(e){ /* 单类失败不拖垮整表 */ }
	try{
		listLocalCases({}).forEach((r)=>{ if(r && r.cid){ out.push({ uri: resourceUri('case', r.cid), name: `事盘·${r.event || r.cid}`, description: `${getCaseTypeMeta(r.caseType).label || ''}${r.divTime ? ` · ${r.divTime}` : ''}`.trim(), mimeType: 'text/plain' }); } });
	}catch(e){ /* noop */ }
	try{
		(await listStoreRecords(AI_ANALYSIS_STORES.materials)).forEach((m)=>{ if(m && m.id){ out.push({ uri: resourceUri('material', m.id), name: `资料·${m.name || m.id}`, description: `${((m.extractedText || m.content) || '').length} 字`, mimeType: 'text/plain' }); } });
	}catch(e){ /* noop */ }
	return out.slice(0, limit);
}

async function readChartOrCase(id){
	const source = findAnalysisSourceById(id);
	if(!source){ return null; }
	const ctx = await getAnalysisSourceContext(source, { mode: 'full' });
	const text = `${(ctx && ctx.content) || ''}`.trim();
	return text ? text : null;
}

const KIND_READERS = {
	chart: readChartOrCase,
	case: readChartOrCase,
	material: async (id)=>{
		const rec = await getStoreRecord(AI_ANALYSIS_STORES.materials, id);
		// [Q-056/M-68] 资料正文字段是 extractedText(产品写入形状);此前读 content → 恒「0 字」/ 读取恒 -32602。
		const text = `${(rec && (rec.extractedText || rec.content)) || ''}`.trim();
		return text ? `【资料】${(rec && rec.name) || id}\n\n${text}` : null;
	},
};

// 未知 URI / 记录不存在 / 正文为空 → null(调用方回 -32602;绝不编造内容)
export async function readResource(uri){
	const parsed = parseResourceUri(uri);
	if(!parsed){ return null; }
	const reader = Object.prototype.hasOwnProperty.call(KIND_READERS, parsed.kind) ? KIND_READERS[parsed.kind] : null;
	if(typeof reader !== 'function'){ return null; }
	let text = null;
	try{ text = await reader(parsed.id); }catch(e){ text = null; }
	if(!text){ return null; }
	return { uri: `${uri}`, mimeType: 'text/plain', text };
}
