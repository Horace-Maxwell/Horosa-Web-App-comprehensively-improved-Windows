// 记录版本历史(Obsidian File Recovery / Joplin 范式):每次**更新**保存前把旧版
// 快照推入独立 IndexedDB 库 —— 回收站救「删错」,本件救「改错」。
//
// 设计:
// - 独立库 horosa.record.revisions.v1(绝不碰 AI 分析库——那边有「绝不新建对象仓/升版本号」
//   铁律;本库自立门户零牵连)。IndexedDB 配额磁盘量级,快照不挤 localStorage 的 5MB。
// - 语义:每条记录保留最近 REVISION_CAP=10 版;同一记录 5 分钟内连续保存只留这一串修改开始之前的那一版(去抖,保住改错前的原版);
//   恢复=调用方按快照生成**副本**(新 cid),绝不覆盖现档(Joplin 非破坏范式)。
// - 可靠性:全部 API 永不 throw(IDB 不可用/私有模式自动降内存=会话级;快照失败绝不阻断保存)。
// - 快照本体不进全量备份(可再生性=弱,但体积大且属「本机撤销栈」语义;备份带走的是当前真值)。
const DB_NAME = 'horosa.record.revisions.v1';
const STORE = 'revisions';
const REVISION_CAP = 10;
const DEBOUNCE_MS = 5 * 60 * 1000;

let dbPromise = null;
let memoryRevisions = [];   // 无 IDB 环境(jest/私有模式)回退,会话级
let memorySeq = 1;

function idbAvailable(){
	try{
		return typeof window !== 'undefined' && !!window.indexedDB;
	}catch(_e){
		return false;
	}
}

function openDb(){
	if(!idbAvailable()){
		return Promise.resolve(null);
	}
	if(dbPromise){
		return dbPromise;
	}
	dbPromise = new Promise((resolve)=>{
		// 打不开(被旧连接阻塞 / 偶发错误)只让这一次落空,不把「空句柄」缓存成整个会话的结果 —— 否则之后每次改档的历史版本都静默丢失
		const fail = ()=>{ dbPromise = null; resolve(null); };
		try{
			const req = window.indexedDB.open(DB_NAME, 1);
			req.onupgradeneeded = ()=>{
				const db = req.result;
				if(!db.objectStoreNames.contains(STORE)){
					const s = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
					s.createIndex('cid', 'cid', { unique: false });
				}
			};
			req.onsuccess = ()=>resolve(req.result);
			req.onerror = fail;
			req.onblocked = fail;
		}catch(_e){
			fail();
		}
	});
	return dbPromise;
}

function txStore(db, mode){
	return db.transaction(STORE, mode).objectStore(STORE);
}

async function listByCid(db, storeLabel, cid){
	return new Promise((resolve)=>{
		try{
			const out = [];
			const idx = txStore(db, 'readonly').index('cid');
			const req = idx.openCursor(window.IDBKeyRange.only(cid));
			req.onsuccess = ()=>{
				const cur = req.result;
				if(!cur){
					resolve(out.filter((r)=>r.store === storeLabel));
					return;
				}
				out.push(cur.value);
				cur.continue();
			};
			req.onerror = ()=>resolve([]);
		}catch(_e){
			resolve([]);
		}
	});
}

// 保存前推入旧版快照(fire-and-forget;去抖+每 cid 上限修剪)。
// opts.force:不受去抖限制(被导入 / 恢复 / 影子并回这类外部来源整条换掉之前的那一版 —— 去抖只为合并同一个人的连续手改,
// 不该吞掉「被外部来源覆盖前」的本机版本)
export function pushRecordRevision(storeLabel, record, opts){
	if(!record || !record.cid){
		return Promise.resolve(false);
	}
	const force = !!(opts && opts.force);
	const snap = {
		store: `${storeLabel}`,
		cid: `${record.cid}`,
		at: Date.now(),
		record: JSON.parse(JSON.stringify(record)),
	};
	if(!idbAvailable()){
		const dup = memoryRevisions.filter((r)=>r.cid === snap.cid && r.store === snap.store);
		if(!force && dup.length && snap.at - dup[dup.length - 1].at < DEBOUNCE_MS){
			return Promise.resolve(true);   // 去抖:窗口里已留了这一串修改开始之前的那一版,不覆盖
		}
		memoryRevisions.push({ ...snap, id: memorySeq++ });
		const mine = memoryRevisions.filter((r)=>r.cid === snap.cid && r.store === snap.store);
		while(mine.length > REVISION_CAP){
			memoryRevisions.splice(memoryRevisions.indexOf(mine.shift()), 1);
		}
		return Promise.resolve(true);
	}
	return openDb().then((db)=>{
		if(!db){
			return false;
		}
		return listByCid(db, snap.store, snap.cid).then((mine)=>new Promise((resolve)=>{
			try{
				const s = txStore(db, 'readwrite');
				const last = mine.length ? mine[mine.length - 1] : null;
				if(!force && last && snap.at - last.at < DEBOUNCE_MS){
					// 去抖:窗口里已留了这一串修改开始之前的那一版 —— 不覆盖(此前用新快照覆盖,改错前的原版反倒丢了)
				}else{
					s.add(snap);
					const excess = mine.length + 1 - REVISION_CAP;
					for(let i = 0; i < excess; i++){
						s.delete(mine[i].id);
					}
				}
				resolve(true);
			}catch(_e){
				resolve(false);
			}
		}));
	}).catch(()=>false);
}

// 某记录的历史版本(新在前)。
export function listRecordRevisions(storeLabel, cid){
	if(!idbAvailable()){
		return Promise.resolve(memoryRevisions.filter((r)=>r.cid === `${cid}` && r.store === `${storeLabel}`).slice().reverse());
	}
	return openDb().then((db)=>{
		if(!db){
			return [];
		}
		return listByCid(db, `${storeLabel}`, `${cid}`).then((list)=>list.slice().reverse());
	}).catch(()=>[]);
}

// 本库历史版本里缺这个键的快照补上(恢复备份前把本机旧盘补成本机原来的口径时一并补:「恢复为副本」出来的旧版同样按原口径)。
// 永不 throw;返回补了几条(IDB 不可用 / 失败 → 只补内存回退)。
export function backfillRevisionsMissingField(storeLabel, key, value){
	const missing = (r)=>r && r.store === `${storeLabel}` && r.record && typeof r.record === 'object'
		&& (r.record[key] === undefined || r.record[key] === null);
	if(!idbAvailable()){
		let n = 0;
		memoryRevisions = memoryRevisions.map((r)=>{ if(!missing(r)){ return r; } n += 1; return { ...r, record: { ...r.record, [key]: value } }; });
		return Promise.resolve(n);
	}
	return openDb().then((db)=>{
		if(!db){ return 0; }
		return new Promise((resolve)=>{
			let n = 0;
			try{
				const req = txStore(db, 'readwrite').openCursor();
				req.onsuccess = ()=>{
					const cur = req.result;
					if(!cur){ resolve(n); return; }
					if(missing(cur.value)){
						n += 1;
						cur.update({ ...cur.value, record: { ...cur.value.record, [key]: value } });
					}
					cur.continue();
				};
				req.onerror = ()=>resolve(n);
			}catch(_e){
				resolve(n);
			}
		});
	}).catch(()=>0);
}

export function __resetRevisionsForTests(){
	memoryRevisions = [];
	memorySeq = 1;
	dbPromise = null;
}
