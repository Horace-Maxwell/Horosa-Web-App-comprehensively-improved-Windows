// AI 助手·检索资料库:让模型在需要时主动查用户资料(关键词;选了嵌入模型且 useVector 时混合向量重排)。
// 只读;命中片段封顶 maxChars;资料正文只回片段不回全文。复用对话侧同一套切块/排序/合并函数(零第二实现)。
import { AI_ANALYSIS_STORES, listStoreRecords, loadUiPrefs } from '../../aiAnalysisStore';
import { ensureMaterialChunks, rankChunksByKeyword, rerankChunksWithVector, mergeRetrievedChunks, resolveEmbeddingTargetFromPrefs, ensureChunkEmbeddings, embedQueryVector } from '../../aiAnalysisRag';
import { GUIDE } from './_shared';

export default {
	name: 'search_materials',
	level: 'read',
	category: 'query',
	undoKind: 'none',
	cacheable: true,
	timeoutMs: 60000,
	description: `按关键词检索用户资料库(已上传的文档/笔记),返回最相关的片段(materialId/title/score/text)。缺省关键词匹配;useVector=true 且已配置嵌入模型时做向量重排。${GUIDE}:用户问「我的资料里怎么说」「查一下上传的书」时调用。`,
	inputSchema: {
		type: 'object', additionalProperties: false, required: ['query'],
		properties: {
			query: { type: 'string', minLength: 1, maxLength: 200 },
			limit: { type: 'integer', minimum: 1, maximum: 20, default: 6 },
			maxChars: { type: 'integer', minimum: 500, maximum: 8000, default: 3000, description: '返回片段总字数上限' },
			materialIds: { type: 'array', maxItems: 20, items: { type: 'string', maxLength: 80 }, description: '只在这些资料里找' },
			useVector: { type: 'boolean', default: false, description: '已配置嵌入模型时用向量重排(会发一次 embedding 请求)' },
		},
	},
	async run(args){
		const query = `${args.query || ''}`.trim();
		const only = Array.isArray(args.materialIds) && args.materialIds.length ? new Set(args.materialIds.map((x)=>`${x}`)) : null;
		const materials = (await listStoreRecords(AI_ANALYSIS_STORES.materials)).filter((m)=>m && m.id && (!only || only.has(m.id)));
		if(!materials.length){ return { ok: false, code: 'E_MATERIAL_INDEX_EMPTY', message: only ? '指定的资料不存在' : '资料库为空' }; }
		let chunks = [];
		for(let i = 0; i < materials.length; i++){
			const m = materials[i];
			// eslint-disable-next-line no-await-in-loop
			const cs = await ensureMaterialChunks(m);
			(cs || []).forEach((c)=>chunks.push({ ...c, materialName: m.name || '' }));
		}
		if(!chunks.length){ return { ok: false, code: 'E_MATERIAL_INDEX_EMPTY', message: '资料尚未提取出文本(请先在资料页完成上传与提取)' }; }
		let scored = rankChunksByKeyword(query, chunks);
		let mode = 'keyword';
		if(args.useVector){
			try{
				const prefs = loadUiPrefs() || {};
				const profiles = await listStoreRecords(AI_ANALYSIS_STORES.providerProfiles);
				const target = resolveEmbeddingTargetFromPrefs({ embeddingSelection: prefs.embeddingSelection, providerProfiles: profiles, chatProfile: null });
				if(target){
					const qv = await embedQueryVector(target, query);
					if(qv){
						const withVec = await ensureChunkEmbeddings(target.profile, target.model, scored.slice(0, 60));
						scored = rerankChunksWithVector(qv, withVec);
						mode = 'hybrid';
					}
				}
			}catch(e){ mode = 'keyword'; }
		}
		const positive = scored.filter((c)=>(c.totalScore || 0) > 0);
		const picked = mergeRetrievedChunks(positive.slice(0, args.limit || 6), args.maxChars || 3000);
		const hits = picked.map((c)=>({ materialId: c.materialId, title: c.materialName || '', score: Math.round((c.totalScore || 0) * 1000) / 1000, text: `${c.content || ''}` }));
		return { ok: true, data: { hits, mode, totalMaterials: materials.length, totalChunks: chunks.length }, summary: hits.length ? `命中 ${hits.length} 段(${mode})` : '无命中片段', assumptions: hits.length ? undefined : ['关键词未命中任何片段,可换更具体的词或用资料原文里的术语'] };
	},
};
