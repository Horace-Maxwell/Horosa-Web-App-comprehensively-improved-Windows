// AI 分析工作区库·变更事件(D31):bulkPut / clear / deleteMany / deleteWhere 各派**一次**带 ids/count 的事件;
// 此前 bulkPut 与 clearStore 不派(工作区恢复 = clear+bulkPut ⇒ 外部客户端 prompts 列表陈旧),deleteStoreRecords 逐 id 派 N 次。
import { AI_STORE_CHANGED_EVENT, AI_ANALYSIS_STORES, putStoreRecord, bulkPutStoreRecords, clearStore, deleteStoreRecords, deleteWhere, listStoreRecords } from '../aiAnalysisStore';

const STORE = AI_ANALYSIS_STORES.templates;
let events = [];
const onEv = (e)=>{ events.push(e.detail); };
beforeEach(async ()=>{ events = []; window.addEventListener(AI_STORE_CHANGED_EVENT, onEv); await clearStore(STORE); events = []; });
afterEach(()=>{ window.removeEventListener(AI_STORE_CHANGED_EVENT, onEv); });
const ofOp = (op)=>events.filter((d)=>d && d.store === STORE && d.op === op);

describe('[D31] 库变更事件按调用一发', ()=>{
	it('bulkPut 100 条 ⇒ 恰一个 bulk 事件,ids 100', async ()=>{
		const recs = Array.from({ length: 100 }, (_, i)=>({ id: `t${i}`, name: `模版 ${i}`, content: 'x' }));
		await bulkPutStoreRecords(STORE, recs, 'tpl');
		expect(ofOp('bulk').length).toBe(1);
		expect(ofOp('bulk')[0].ids.length).toBe(100);
		expect(ofOp('bulk')[0].count).toBe(100);
		expect(ofOp('put').length).toBe(0);
		expect((await listStoreRecords(STORE)).length).toBe(100);
	});
	it('clearStore ⇒ 恰一个 clear 事件', async ()=>{
		await putStoreRecord(STORE, { id: 'a', name: 'a' }, 'tpl');
		events = [];
		await clearStore(STORE);
		expect(ofOp('clear').length).toBe(1);
		expect((await listStoreRecords(STORE)).length).toBe(0);
	});
	it('deleteStoreRecords 三条 ⇒ 恰一个 deleteMany 事件(ids 3),零逐条 delete 事件', async ()=>{
		await bulkPutStoreRecords(STORE, [{ id: 'a' }, { id: 'b' }, { id: 'c' }], 'tpl');
		events = [];
		await deleteStoreRecords(STORE, ['a', 'b', 'c']);
		expect(ofOp('deleteMany').length).toBe(1);
		expect(ofOp('deleteMany')[0].ids).toEqual(['a', 'b', 'c']);
		expect(ofOp('delete').length).toBe(0);
	});
	it('deleteWhere(内存径) ⇒ 一次 deleteMany 事件,不再逐条', async ()=>{
		await bulkPutStoreRecords(STORE, [{ id: 'a', kind: 'x' }, { id: 'b', kind: 'y' }, { id: 'c', kind: 'x' }], 'tpl');
		events = [];
		const n = await deleteWhere(STORE, (r)=>r.kind === 'x');
		expect(n).toBe(2);
		expect(ofOp('deleteMany').length).toBe(1);
		expect(ofOp('delete').length).toBe(0);
		expect((await listStoreRecords(STORE)).map((r)=>r.id)).toEqual(['b']);
	});
	it('单条 put 仍一发 put(现状)', async ()=>{
		await putStoreRecord(STORE, { id: 'z', name: 'z' }, 'tpl');
		expect(ofOp('put').length).toBe(1);
		expect(ofOp('put')[0].id).toBe('z');
	});
});
