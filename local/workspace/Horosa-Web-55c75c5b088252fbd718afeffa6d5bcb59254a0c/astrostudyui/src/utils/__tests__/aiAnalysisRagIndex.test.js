// [D64] RAG 切块/向量读走 materialId 索引:ensureMaterialChunks 与 ensureChunkEmbeddings 不再整店 listStoreRecords。
jest.mock('../aiAnalysisStore', ()=>{
	const actual = jest.requireActual('../aiAnalysisStore');
	return { ...actual, readByIndex: jest.fn(async ()=>[]), listStoreRecords: jest.fn(async ()=>[]), bulkPutStoreRecords: jest.fn(async (n, rows)=>rows) };
});
jest.mock('../../services/aianalysis', ()=>({ requestEmbeddingVectors: jest.fn(async ()=>({ vectors: [] })) }));
import { AI_ANALYSIS_STORES, readByIndex, listStoreRecords } from '../aiAnalysisStore';
import { ensureMaterialChunks, ensureChunkEmbeddings } from '../aiAnalysisRag';

beforeEach(()=>{ readByIndex.mockClear(); listStoreRecords.mockClear(); });

it('🔴 ensureMaterialChunks:已有切块 ⇒ 只走 readByIndex(materialId),零整店读', async ()=>{
	readByIndex.mockImplementationOnce(async ()=>[{ id: 'c2', materialId: 'm1', chunkIndex: 1, content: '二' }, { id: 'c1', materialId: 'm1', chunkIndex: 0, content: '一' }]);
	const out = await ensureMaterialChunks({ id: 'm1', extractedText: '一二' });
	expect(out.map((c)=>c.id)).toEqual(['c1', 'c2']);
	expect(readByIndex).toHaveBeenCalledWith(AI_ANALYSIS_STORES.materialChunks, 'materialId', 'm1');
	expect(listStoreRecords).not.toHaveBeenCalled();
});

it('🔴 ensureChunkEmbeddings:按涉及的 materialId 逐资料索引读;命中的向量回填,零整店读', async ()=>{
	readByIndex.mockImplementation(async (store, idx, value)=>(value === 'm1' ? [{ id: 'e1', chunkId: 'c1', materialId: 'm1', providerProfileId: 'p', embeddingModel: 'emb', vector: [0.1, 0.2] }] : []));
	const out = await ensureChunkEmbeddings({ id: 'p' }, 'emb', [{ id: 'c1', materialId: 'm1', content: 'x' }]);
	expect(out[0].vector).toEqual([0.1, 0.2]);
	expect(readByIndex).toHaveBeenCalledWith(AI_ANALYSIS_STORES.materialEmbeddings, 'materialId', 'm1');
	expect(listStoreRecords).not.toHaveBeenCalled();
});

it('chunk 缺 materialId ⇒ 退回整店读(旧行为同构)', async ()=>{
	listStoreRecords.mockImplementationOnce(async ()=>[]);
	await ensureChunkEmbeddings({ id: 'p' }, 'emb', [{ id: 'c9', content: 'x' }]);
	expect(listStoreRecords).toHaveBeenCalledWith(AI_ANALYSIS_STORES.materialEmbeddings);
});
