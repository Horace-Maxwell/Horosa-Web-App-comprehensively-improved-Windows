// AI 工作区 IndexedDB 写入:事务提交完成才报成功;请求成功之后事务才中止(磁盘满 / 提交失败)→ 照实报错(此前报成功、实际没落盘)
if(typeof window.indexedDB !== 'undefined'){
	throw new Error('前提失效:jsdom 已定义 indexedDB,fake-indexeddb 的装载顺序需重审');
}
require('fake-indexeddb/auto');
const FIDB = require('fake-indexeddb');

function freshStore(){
	window.indexedDB = new FIDB.IDBFactory();
	let mod = null;
	jest.isolateModules(()=>{ mod = require('../aiAnalysisStore'); });
	return mod;
}

// 请求成功后(在库代码的 onsuccess 之前)中止事务 = 模拟提交阶段失败
function abortAfterRequestSuccess(methodName){
	const proto = window.IDBObjectStore.prototype;
	const orig = proto[methodName];
	proto[methodName] = function patched(...args){
		const req = orig.apply(this, args);
		const tx = this.transaction;
		req.addEventListener('success', ()=>{ try{ tx.abort(); }catch(e){ /* noop */ } });
		return req;
	};
	return ()=>{ proto[methodName] = orig; };
}

test('🔴 写入请求成功、事务随后中止:putStoreRecord 报错(不报成功)', async ()=>{
	const s = freshStore();
	await s.putStoreRecord(s.AI_ANALYSIS_STORES.workspaceMeta, { id: 'warm', v: 1 });   // 先把库建好
	const restore = abortAfterRequestSuccess('put');
	let err = null;
	try{
		await s.putStoreRecord(s.AI_ANALYSIS_STORES.workspaceMeta, { id: 'k1', v: 2 });
	}catch(e){ err = e; }finally{ restore(); }
	expect(err).not.toBe(null);
	expect(await s.getStoreRecord(s.AI_ANALYSIS_STORES.workspaceMeta, 'k1')).toBeFalsy();
});

test('正常写入照常成功,读得回', async ()=>{
	const s = freshStore();
	await s.putStoreRecord(s.AI_ANALYSIS_STORES.workspaceMeta, { id: 'k2', v: 3 });
	expect((await s.getStoreRecord(s.AI_ANALYSIS_STORES.workspaceMeta, 'k2')).v).toBe(3);
	await s.deleteStoreRecord(s.AI_ANALYSIS_STORES.workspaceMeta, 'k2');
	expect(await s.getStoreRecord(s.AI_ANALYSIS_STORES.workspaceMeta, 'k2')).toBeFalsy();
});
