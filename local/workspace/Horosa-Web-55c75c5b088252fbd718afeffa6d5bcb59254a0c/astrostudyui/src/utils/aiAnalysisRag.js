import { AI_ANALYSIS_STORES, bulkPutStoreRecords, listStoreRecords } from './aiAnalysisStore';
import { requestEmbeddingVectors } from '../services/aianalysis';
import { parseModelSelection } from './aiAnalysisProviders';

const DEFAULT_CHUNK_SIZE = 1200;
const DEFAULT_CHUNK_OVERLAP = 180;
const DIRECT_ATTACH_THRESHOLD = 12000;

function normalizeText(text){
	return `${text || ''}`.replace(/\r/g, '').trim();
}

function tokenize(text){
	return normalizeText(text)
		.toLowerCase()
		.split(/[^a-z0-9\u4e00-\u9fa5]+/g)
		.filter(Boolean);
}

// 「默认检索策略」(组合里的 defaultRetrievalMode)在此落地:
//   'fulltext' → 强制整篇直挂,不看长度(超预算仍由上层裁剪链按水位收);
//   'rag'      → 强制分块+排序,即使资料很短;
//   'auto'/缺省 → 保持原来的纯长度规则,逐字节零回归。
// 此前该控件三档存了、也在组合预览里显示,但检索链从不读它 —— 选了「全文优先/检索优先」毫无变化。
export function shouldUseDirectAttach(material, retrievalMode){
	if(retrievalMode === 'fulltext'){ return true; }
	if(retrievalMode === 'rag'){ return false; }
	return normalizeText(material && material.extractedText).length <= DIRECT_ATTACH_THRESHOLD;
}

// [B1-Bug2] 直挂/RAG 分拣单源:两消费端此前各写分拣——报告侧 `filtered.filter(shouldUseDirectAttach)`
// 把 Array.filter 的第二参(数组下标)当 retrievalMode 传入,数字恒非 'fulltext'/'rag' → 恒走长度
// 规则,「默认检索策略」在报告路径整体坏死(对话侧手写循环传参正确)。收敛为唯一入口后,
// 这一类「裸 filter 复用二参函数」bug 从此无处发生。
export function partitionMaterialsByRetrieval(materials, retrievalMode){
	const direct = [];
	const rag = [];
	(materials || []).forEach((m)=>{
		if(shouldUseDirectAttach(m, retrievalMode)){ direct.push(m); }
		else { rag.push(m); }
	});
	return { direct, rag };
}

export function splitTextIntoChunks(text, options = {}){
	const raw = normalizeText(text);
	if(!raw){
		return [];
	}
	const chunkSize = Math.max(400, options.chunkSize || DEFAULT_CHUNK_SIZE);
	const overlap = Math.max(0, options.overlap || DEFAULT_CHUNK_OVERLAP);
	const chunks = [];
	let start = 0;
	while(start < raw.length){
		const end = Math.min(raw.length, start + chunkSize);
		const content = raw.slice(start, end).trim();
		if(content){
			chunks.push({
				chunkIndex: chunks.length,
				content,
				startOffset: start,
				endOffset: end,
				searchText: content.toLowerCase(),
			});
		}
		if(end >= raw.length){
			break;
		}
		start = Math.max(end - overlap, start + 1);
	}
	return chunks;
}

// v1.16-L: 加全局 lock map 防同一 material 并发 chunking
// 触发场景: 用户快速连点"上传"/"重新计算嵌向量"/同时打开多个 tab → 多次 ensureMaterialChunks
// 风险: 并发 bulkPutStoreRecords → IndexedDB index 混乱 / 重复 chunk
const chunkingLocks = new Map();
export async function ensureMaterialChunks(material, options = {}){
	if(!material || !material.id){
		return [];
	}
	// 已有进行中的 chunking 任务 → 等它完成,不重复跑
	const existingLock = chunkingLocks.get(material.id);
	if(existingLock) return existingLock;

	const promise = (async ()=>{
		const existing = (await listStoreRecords(AI_ANALYSIS_STORES.materialChunks)).filter((item)=>item.materialId === material.id);
		if(existing.length){
			return existing.sort((a, b)=>a.chunkIndex - b.chunkIndex);
		}
		const chunks = splitTextIntoChunks(material.extractedText || '', options).map((item)=>({
			...item,
			materialId: material.id,
		}));
		if(chunks.length === 0){
			return [];
		}
		return bulkPutStoreRecords(AI_ANALYSIS_STORES.materialChunks, chunks, 'chunk');
	})().finally(()=>{
		chunkingLocks.delete(material.id);  // 完成后立即释放 lock
	});

	chunkingLocks.set(material.id, promise);
	return promise;
}

function keywordScore(queryTokens, chunk){
	if(!queryTokens.length){
		return 0;
	}
	const text = `${chunk && chunk.searchText ? chunk.searchText : chunk && chunk.content ? chunk.content : ''}`.toLowerCase();
	let score = 0;
	queryTokens.forEach((token)=>{
		if(text.indexOf(token) >= 0){
			score += 1;
		}
	});
	return score / queryTokens.length;
}

function cosineSimilarity(a, b){
	if(!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0){
		return 0;
	}
	const len = Math.min(a.length, b.length);
	let dot = 0;
	let na = 0;
	let nb = 0;
	for(let i=0; i<len; i++){
		const va = Number(a[i]) || 0;
		const vb = Number(b[i]) || 0;
		dot += va * vb;
		na += va * va;
		nb += vb * vb;
	}
	if(!na || !nb){
		return 0;
	}
	return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function rerankChunksWithVector(queryVector, chunkEntries){
	return (chunkEntries || []).map((item)=>({
		...item,
		vectorScore: cosineSimilarity(queryVector, item.vector || []),
		totalScore: (item.keywordScore || 0) * 0.45 + cosineSimilarity(queryVector, item.vector || []) * 0.55,
	})).sort((a, b)=>b.totalScore - a.totalScore);
}

export function rankChunksByKeyword(query, chunkEntries){
	const queryTokens = tokenize(query);
	return (chunkEntries || []).map((item)=>({
		...item,
		keywordScore: keywordScore(queryTokens, item),
		totalScore: keywordScore(queryTokens, item),
	})).sort((a, b)=>b.totalScore - a.totalScore);
}

export function mergeRetrievedChunks(scoredChunks, maxChars = 5000){
	const picked = [];
	let total = 0;
	for(let i=0; i<(scoredChunks || []).length; i++){
		const item = scoredChunks[i];
		const content = normalizeText(item.content);
		if(!content){
			continue;
		}
		if(total >= maxChars && picked.length > 0){
			break;
		}
		picked.push(item);
		total += content.length;
	}
	return picked;
}

export function buildRetrievedContextText(scoredChunks){
	return (scoredChunks || []).map((item)=>[
		`【资料：${item.materialName || '未命名资料'}】`,
		item.content || '',
	].filter(Boolean).join('\n')).join('\n\n').trim();
}

// 按流派过滤资料（materials 是 store 记录列表 / IDs 列表 不影响，这里按 records 过滤）。
// 规则：selectedSchools 为空 → 全量；否则：material.schools 含至少一个所选 OR material.schools 为空（视为通用）。
// audit 4 修:用户可能选了字面值 '不限流派' / '无' / 'unrestricted' 等,要当成空 schools 处理而非真流派过滤。
const UNRESTRICTED_LITERALS = ['不限流派', '不限', '无', 'unrestricted', 'any', 'all', '通用'];
export function filterMaterialsBySchools(materials, selectedSchools){
	const arr = Array.isArray(materials) ? materials : [];
	const sel = (selectedSchools || [])
		.filter((s)=>`${s || ''}`.trim())
		.filter((s)=>!UNRESTRICTED_LITERALS.includes(`${s}`.trim().toLowerCase()) && !UNRESTRICTED_LITERALS.includes(`${s}`.trim()));
	if(sel.length === 0) return arr;
	return arr.filter((m)=>{
		const ms = Array.isArray(m && m.schools) ? m.schools : [];
		if(ms.length === 0) return true; // 通用资料
		return ms.some((s)=>sel.includes(s));
	});
}

// 节级关键词加权 keyword scoring
// 在标准 query + extraKeywords 上做关键词排序，extra 权重 1.8 倍
export function rankChunksByKeywordWithExtra(query, extraKeywords, chunkEntries){
	const baseTokens = tokenize(query);
	const extraTokens = (extraKeywords || []).flatMap((k)=>tokenize(k));
	return (chunkEntries || []).map((item)=>{
		const base = keywordScore(baseTokens, item);
		const extra = keywordScore(extraTokens, item);
		return {
			...item,
			keywordScore: base + extra * 1.8,
			totalScore: base + extra * 1.8,
		};
	}).sort((a, b)=>b.totalScore - a.totalScore);
}

// ============ 向量嵌入共享件(对话与报告同源,避免两处各养一套) ============

// 解析「嵌入(向量)模型」目标,三态向后兼容:
//   1) UI 显式选了独立嵌入模型(embeddingSelection="profileId::model")→ 用它;
//   2) 未选 → 沿用聊天 profile 自带嵌入模型(embeddingModelIds[0]);
//   3) 都没有 → null,调用方退关键词排序。
export function resolveEmbeddingTargetFromPrefs({ embeddingSelection, providerProfiles, chatProfile }){
	const parsed = parseModelSelection(embeddingSelection || '');
	const explicit = (providerProfiles || []).find((p)=>p && p.id === parsed.profileId && p.enabled !== false);
	if(explicit && parsed.model){ return { profile: explicit, model: parsed.model }; }
	const list = (chatProfile && Array.isArray(chatProfile.embeddingModelIds)) ? chatProfile.embeddingModelIds : [];
	const m = `${list.find((x)=>`${x || ''}`.trim()) || ''}`.trim();
	return (chatProfile && m) ? { profile: chatProfile, model: m } : null;
}

// 为 chunk 列表补齐向量:IndexedDB materialEmbeddings 缓存命中直接用,缺的批量请求 embedding 并落库。
// (平移自对话路径,保持行为逐字一致:缓存键 = chunkId × profileId × embeddingModel。)
export async function ensureChunkEmbeddings(profile, embeddingModel, chunks){
	if(!profile || !embeddingModel || !(chunks || []).length){
		return chunks || [];
	}
	const allEmbeddings = await listStoreRecords(AI_ANALYSIS_STORES.materialEmbeddings);
	const enriched = [];
	const missing = [];
	(chunks || []).forEach((chunk)=>{
		const found = allEmbeddings.find((item)=>item.chunkId === chunk.id && item.providerProfileId === profile.id && item.embeddingModel === embeddingModel);
		if(found && Array.isArray(found.vector) && found.vector.length){
			enriched.push({
				...chunk,
				vector: found.vector,
			});
		}else{
			missing.push(chunk);
		}
	});
	if(missing.length){
		const rsp = await requestEmbeddingVectors({
			providerType: profile.providerType,
			apiKey: profile.apiKey,
			baseUrl: profile.baseUrl,
			model: embeddingModel,
			embeddingModel,
			providerOptions: profile.providerOptions || {},
			input: missing.map((item)=>item.content),
		});
		const vectors = rsp && rsp.Result && Array.isArray(rsp.Result.vectors) ? rsp.Result.vectors : [];
		const saved = await bulkPutStoreRecords(AI_ANALYSIS_STORES.materialEmbeddings, missing.map((chunk, idx)=>({
			id: `emb-${profile.id}-${embeddingModel}-${chunk.id}`,
			materialId: chunk.materialId,
			chunkId: chunk.id,
			providerProfileId: profile.id,
			embeddingModel,
			vector: vectors[idx] || [],
		})), 'emb');
		saved.forEach((item)=>{
			const chunk = missing.find((one)=>one.id === item.chunkId);
			if(chunk){
				enriched.push({
					...chunk,
					vector: item.vector,
				});
			}
		});
	}
	return enriched;
}

// 查询向量便捷封装:返回查询串的 embedding 向量(失败/空返 null,调用方退关键词)。
export async function embedQueryVector(target, query){
	if(!target || !target.profile || !target.model || !`${query || ''}`.trim()) return null;
	const rsp = await requestEmbeddingVectors({
		providerType: target.profile.providerType,
		apiKey: target.profile.apiKey,
		baseUrl: target.profile.baseUrl,
		model: target.model,
		embeddingModel: target.model,
		providerOptions: target.profile.providerOptions || {},
		input: [`${query}`],
	});
	const v = rsp && rsp.Result && Array.isArray(rsp.Result.vectors) ? rsp.Result.vectors[0] : null;
	return (Array.isArray(v) && v.length) ? v : null;
}
