// AI 助手·search_materials 工具合同:只读可缓存;资料库空/未提取 → E_MATERIAL_INDEX_EMPTY;关键词命中形状;materialIds 过滤;向量无目标回退关键词。
jest.mock('../aiAnalysisStore', ()=>{
	const records = { materials: [], provider_profiles: [] };
	return {
		AI_ANALYSIS_STORES: { materials: 'materials', providerProfiles: 'provider_profiles' },
		listStoreRecords: async (store)=>records[store] || [],
		loadUiPrefs: ()=>({}),
		__records: records,
	};
});
jest.mock('../aiAnalysisRag', ()=>({
	ensureMaterialChunks: async (m)=>(m.text ? [{ id: `${m.id}-0`, materialId: m.id, content: m.text }] : []),
	rankChunksByKeyword: (q, chunks)=>chunks.map((c)=>({ ...c, totalScore: c.content.indexOf(q) >= 0 ? 1 : 0 })).sort((a, b)=>b.totalScore - a.totalScore),
	rerankChunksWithVector: (qv, chunks)=>chunks,
	mergeRetrievedChunks: (list)=>list,
	resolveEmbeddingTargetFromPrefs: ()=>null,
	ensureChunkEmbeddings: async (p, m, list)=>list,
	embedQueryVector: async ()=>null,
}));
import def from '../aiTools/tools/searchMaterials';
import { __records } from '../aiAnalysisStore';

beforeEach(()=>{ __records.materials.length = 0; });

describe('search_materials', ()=>{
	it('目录形状:read/query/cacheable;query 必填;顶层封闭', ()=>{
		expect(def.name).toBe('search_materials');
		expect(def.level).toBe('read');
		expect(def.category).toBe('query');
		expect(def.cacheable).toBe(true);
		expect(def.inputSchema.required).toEqual(['query']);
		expect(def.inputSchema.additionalProperties).toBe(false);
	});
	it('资料库为空 → E_MATERIAL_INDEX_EMPTY;有资料但未提取文本 → 同码不同文案', async ()=>{
		const r0 = await def.run({ query: '紫微' });
		expect(r0.ok).toBe(false);
		expect(r0.code).toBe('E_MATERIAL_INDEX_EMPTY');
		__records.materials.push({ id: 'm1', name: '空文档' });
		const r1 = await def.run({ query: '紫微' });
		expect(r1.code).toBe('E_MATERIAL_INDEX_EMPTY');
		expect(r1.message).not.toBe(r0.message);
	});
	it('关键词命中:hits[{materialId,title,score,text}];未命中给 assumptions 不给 hits;summary 含 mode', async ()=>{
		__records.materials.push({ id: 'm1', name: '紫微讲义', text: '紫微斗数十四主星' }, { id: 'm2', name: '八字笔记', text: '十神六亲' });
		const hit = await def.run({ query: '紫微', limit: 5, maxChars: 3000 });
		expect(hit.ok).toBe(true);
		expect(hit.data.hits).toEqual([{ materialId: 'm1', title: '紫微讲义', score: 1, text: '紫微斗数十四主星' }]);
		expect(hit.data).toEqual(expect.objectContaining({ mode: 'keyword', totalMaterials: 2, totalChunks: 2 }));
		expect(hit.summary).toContain('keyword');
		const miss = await def.run({ query: '奇门' });
		expect(miss.ok).toBe(true);
		expect(miss.data.hits).toEqual([]);
		expect(Array.isArray(miss.assumptions)).toBe(true);
	});
	it('materialIds 只在指定资料里找;指定不存在 → E_MATERIAL_INDEX_EMPTY(指定的资料不存在)', async ()=>{
		__records.materials.push({ id: 'm1', name: 'A', text: '紫微' }, { id: 'm2', name: 'B', text: '紫微' });
		const r = await def.run({ query: '紫微', materialIds: ['m2'] });
		expect(r.data.hits.map((h)=>h.materialId)).toEqual(['m2']);
		const none = await def.run({ query: '紫微', materialIds: ['zzz'] });
		expect(none.code).toBe('E_MATERIAL_INDEX_EMPTY');
		expect(none.message).toContain('指定');
	});
	it('useVector 但未配置嵌入模型 → 静默回退 keyword(不报错)', async ()=>{
		__records.materials.push({ id: 'm1', name: 'A', text: '紫微' });
		const r = await def.run({ query: '紫微', useVector: true });
		expect(r.ok).toBe(true);
		expect(r.data.mode).toBe('keyword');
	});
});
