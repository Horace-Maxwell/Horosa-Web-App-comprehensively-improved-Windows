// 一次性补字段:写库那一刻存储第一次出错(非配额)→ 已转入内存,补记照算成功,不报「没写进」。
import { createLocalRecordStore } from '../localRecordStore';

function makeStore(){
	return createLocalRecordStore({
		storageKey: 'test.backfill.records.v1',
		searchField: 'name',
		envelopeFormat: 'test-records',
		envelopeListField: 'records',
		buildRecord: (r)=>({ ...r }),
		saveErrorCode: 'test.save.failed',
		deleteErrorCode: 'test.delete.failed',
		warnLabel: 'test',
		trashKey: 'test.backfill.trash.v1',
	});
}

describe('补字段遇到存储首次出错', ()=>{
	afterEach(()=>{ jest.restoreAllMocks(); window.localStorage.clear(); });

	it('存储刚坏、转入内存:返回补了几条(不是 -1),内存里的记录带上补的键', ()=>{
		window.localStorage.setItem('test.backfill.records.v1', JSON.stringify([{ cid: 'a1', name: '甲' }, { cid: 'a2', name: '乙', mode: 2 }]));
		const store = makeStore();
		const orig = Storage.prototype.setItem;
		let thrown = false;
		jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function(k, v){
			if(!thrown && k === 'test.backfill.records.v1'){ thrown = true; throw new Error('disk failure'); }
			return orig.call(this, k, v);
		});
		const n = store.backfillMissingField('mode', 0);
		expect(thrown).toBe(true);
		expect(n).toBe(1);
		const recs = store.list();
		expect(recs.find((r)=>r.cid === 'a1').mode).toBe(0);
		expect(recs.find((r)=>r.cid === 'a2').mode).toBe(2);
	});
});
