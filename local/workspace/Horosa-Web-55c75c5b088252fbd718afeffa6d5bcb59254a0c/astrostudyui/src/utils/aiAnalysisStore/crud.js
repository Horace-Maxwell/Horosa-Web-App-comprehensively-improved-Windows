// 读写入口:事务封装、密钥类 store 加解密、增删改查与按索引 / 游标读
// 从 aiAnalysisStore.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { encryptSecretText, isEncryptedSecret, decryptSecretText, canEncryptSecrets } from '../secureKeyStore';
import { openDb, notifyStoreChanged, dropPendingMerges, applyMergers, rememberPendingMerge, assertAiStoreDurable } from './db';
import { MEMORY_DB, makeMemoryMap, AI_ANALYSIS_STORES, IDB_STATS } from './schema';
import { migrateRecord } from './migrate';
import { clonePlain, ensureRecordId, nowIso, normalizeArray, indexKeyPath, indexValueEquals, recordIndexValue, canUseIndexedDb } from './records';

export async function withStore(storeName, mode, handler){
	const db = await openDb();
	if(!db){
		// 无 IndexedDB(非浏览器 / SSR / jest)→ 内存回退。必须给 handler 传一个可用的 finish,
		// 否则 handler 内 finish(...) 会抛 "finish is not a function"(此回退此前从未生效)。
		return new Promise((resolve, reject)=>{
			const finish = (value, isError = false)=>{ if(isError){ reject(value); } else { resolve(value); } };
			try { handler(null, finish); } catch(e){ finish(e, true); }
		});
	}
	return new Promise((resolve, reject)=>{
		const tx = db.transaction(storeName, mode);
		const store = tx.objectStore(storeName);
		let settled = false;
		// 写事务:请求成功只说明进了事务,提交阶段仍可能中止(磁盘满 / 提交时 I/O 失败)—— 等事务提交完成才报成功,
		// 中止照实报错。此前请求成功就报成功,之后的中止被吞,对话 / 资料报保存成功、实际没落盘。读事务照旧请求成功即返回。
		const deferToCommit = mode === 'readwrite';
		let ready = false;
		let readyValue = null;
		const finish = (value, isError = false)=>{
			if(settled){
				return;
			}
			if(!isError && deferToCommit){
				if(!ready){
					ready = true;
					readyValue = value;
				}
				return;
			}
			settled = true;
			if(isError){
				reject(value);
			}else{
				resolve(value);
			}
		};
		tx.oncomplete = ()=>{
			if(!settled){
				settled = true;
				resolve(ready ? readyValue : null);
			}
		};
		tx.onerror = ()=>{
			finish(tx.error || new Error(`indexeddb.${storeName}.failed`), true);
		};
		tx.onabort = ()=>{
			finish(tx.error || new Error(`indexeddb.${storeName}.aborted`), true);
		};
		try{
			handler(store, finish);
		}catch(e){
			finish(e, true);
		}
	});
}

export function memoryStore(storeName){
	if(!MEMORY_DB.has(storeName)){
		MEMORY_DB.set(storeName, makeMemoryMap(storeName));
	}
	return MEMORY_DB.get(storeName);
}

// providerProfiles.apiKey 静态加密收口:所有读写都过本层——
//  · 写入:桥可用即密文落库(格式 aesgcm.v1:..),dev 无桥原样明文=零回归;
//  · 读出:密文解回明文只驻内存;解不开(换机器/钥匙串被清)→ 置空 + apiKeyDecryptFailed
//    标记(UI 提示重填),绝不让密文串流进请求头;
//  · 旧明文记录读到后台透明升级为密文(fire-and-forget,失败无害下次再试)。
// 密钥钩覆盖的 store(apiKey 字段静态加密):接口档案 + 集成档案(联网检索等第三方 key)
const SECRET_STORES = Object.freeze([AI_ANALYSIS_STORES.providerProfiles, AI_ANALYSIS_STORES.integrationProfiles]);
function isSecretStore(storeName){ return SECRET_STORES.indexOf(storeName) >= 0; }
function secretPrefixOf(storeName){ return storeName === AI_ANALYSIS_STORES.integrationProfiles ? 'integration' : 'provider'; }

// 「鉴权定制(额外请求头)」的值(自建网关的 Authorization / x-api-key 等令牌)与 apiKey 同走静态加密:
//   落库密文、读出解回明文只驻内存;解不开 → 置空 + extraHeadersDecryptFailed 标记(UI 提示重填)。
//   仅 provider_profiles 有 providerOptions.extraHeaders;值非字符串/空串原样。
function extraHeadersOf(rec){
	const po = rec && rec.providerOptions && typeof rec.providerOptions === 'object' ? rec.providerOptions : null;
	const eh = po && po.extraHeaders && typeof po.extraHeaders === 'object' && !Array.isArray(po.extraHeaders) ? po.extraHeaders : null;
	return eh && Object.keys(eh).length ? eh : null;
}
function withExtraHeaders(rec, eh){
	return { ...rec, providerOptions: { ...(rec.providerOptions || {}), extraHeaders: eh } };
}
async function encryptExtraHeaders(rec){
	const eh = extraHeadersOf(rec);
	if(!eh){ return rec; }
	const out = {};
	const keys = Object.keys(eh);
	for(let i = 0; i < keys.length; i++){
		const v = eh[keys[i]];
		// eslint-disable-next-line no-await-in-loop
		out[keys[i]] = (typeof v === 'string' && v) ? await encryptSecretText(v) : v;
	}
	return withExtraHeaders(rec, out);
}
async function decryptExtraHeaders(rec){
	const eh = extraHeadersOf(rec);
	if(!eh){ return { rec, hasPlainSecret: false, failed: false, kept: null };
	}
	const out = {};
	const kept = {};
	let failed = false;
	let hasPlainSecret = false;
	const keys = Object.keys(eh);
	for(let i = 0; i < keys.length; i++){
		const k = keys[i];
		const v = eh[k];
		if(typeof v !== 'string' || !v){ out[k] = v; continue; }
		if(!isEncryptedSecret(v)){ out[k] = v; hasPlainSecret = true; continue; }
		// eslint-disable-next-line no-await-in-loop
		const plain = await decryptSecretText(v);
		if(plain === null){ out[k] = ''; kept[k] = v; failed = true; }
		else{ out[k] = plain; }
	}
	return { rec: withExtraHeaders(rec, out), hasPlainSecret, failed, kept: failed ? kept : null };
}

async function decryptProfileRecord(rec, storeName = AI_ANALYSIS_STORES.providerProfiles){
	if(!rec || typeof rec !== 'object'){ return rec; }
	const stored = `${rec.apiKey || ''}`;
	const ehRes = await decryptExtraHeaders(rec);
	let out = ehRes.rec;
	if(ehRes.failed){
		// 解不开的密文留在内存态(不落库、不进备份),写路径未重填时原样保留
		out = { ...out, extraHeadersDecryptFailed: true, extraHeadersCipherKept: ehRes.kept };
	}
	if(!isEncryptedSecret(stored)){
		// 明文 + 可加密 → 透明升级(异步重写,不阻塞读路径;putStoreRecord 会加密);额外请求头有明文令牌同此
		if((stored || ehRes.hasPlainSecret) && await canEncryptSecrets()){
			Promise.resolve().then(()=>putStoreRecord(storeName, out, secretPrefixOf(storeName))).catch(()=>{});
		}
		return out;
	}
	const plain = await decryptSecretText(stored);
	if(plain === null){
		// 此前只置空 + 标记:该会话里任何写(连通性诊断写 lastDiagnostics / 打开编辑直接确定)都把
		//   空串「加密」后覆盖库里本可在下次会话解开的密文。现把原密文留在内存态 apiKeyCipherKept,写路径未重填时原样保留。
		return { ...out, apiKey: '', apiKeyDecryptFailed: true, apiKeyCipherKept: stored };
	}
	return { ...out, apiKey: plain };
}

// 分批游标全量读:WKWebView(Mac APP 的 WebKit)对大 value store 的一次性
// getAll 反序列化极慢且长期占住主线程(Chromium 无感 → 「preview 秒开 / APP 全页转圈很久」的引擎面根因)。
// 每批 batch 条一个独立只读事务,批间 setTimeout(0) 让出主线程 —— 总量不变,首帧与交互不再被冻。
// 返回值与 listStoreRecords 逐条同构(migrateRecord + provider_profiles 自动解密),消费方零改动。
export async function listStoreRecordsBatched(storeName, options = {}){
	const batch = Math.max(1, Number(options.batch) || 15);
	const db = await openDb();
	if(!db){
		return listStoreRecords(storeName);   // 无 IndexedDB 环境走内存回退同径
	}
	const out = [];
	let lastKey = null;
	let done = false;
	while(!done){
		// eslint-disable-next-line no-await-in-loop
		const chunk = await new Promise((resolve, reject)=>{
			const tx = db.transaction(storeName, 'readonly');
			const store = tx.objectStore(storeName);
			const range = lastKey === null ? undefined : window.IDBKeyRange.lowerBound(lastKey, true);
			const req = range === undefined ? store.openCursor() : store.openCursor(range);
			const buf = [];
			req.onsuccess = ()=>{
				const cur = req.result;
				if(!cur){ resolve({ buf, end: true }); return; }
				buf.push(migrateRecord(storeName, cur.value));
				lastKey = cur.key;
				if(buf.length >= batch){ resolve({ buf, end: false }); return; }
				cur.continue();
			};
			req.onerror = ()=>{ reject(req.error); };
		}).then((r)=>{ done = r.end; return r.buf; });
		out.push(...chunk);
		if(!done){
			// eslint-disable-next-line no-await-in-loop
			await new Promise((r)=>setTimeout(r, 0));
		}
	}
	if(isSecretStore(storeName)){
		return Promise.all(out.map((rec)=>decryptProfileRecord(rec, storeName)));
	}
	return out;
}

export async function listStoreRecords(storeName){
	const list = await withStore(storeName, 'readonly', (store, finish)=>{
		if(!store){
			const memList = Array.from(memoryStore(storeName).values()).map((item)=>migrateRecord(storeName, clonePlain(item)));
			finish(memList);
			return;
		}
		IDB_STATS.getAll += 1;
		const req = store.getAll();
		req.onsuccess = ()=>{
			finish((req.result || []).map((item)=>migrateRecord(storeName, item)));
		};
		req.onerror = ()=>{
			finish(req.error, true);
		};
	});
	if(isSecretStore(storeName) && Array.isArray(list)){
		return Promise.all(list.map((rec)=>decryptProfileRecord(rec, storeName)));
	}
	return list;
}

// 测试专用:读库内原始记录(不解密),用于断言落库形态(密文/留存密文)。
export async function __rawStoreRecordForTests(storeName, id){
	return withStore(storeName, 'readonly', (store, finish)=>{
		if(!store){
			const mem = memoryStore(storeName).get(id);
			finish(mem ? clonePlain(mem) : null);
			return;
		}
		const req = store.get(id);
		req.onsuccess = ()=>{ finish(req.result || null); };
		req.onerror = ()=>{ finish(req.error, true); };
	});
}

export async function getStoreRecord(storeName, id){
	const record = await withStore(storeName, 'readonly', (store, finish)=>{
		if(!store){
			const mem = memoryStore(storeName).get(id);
			finish(mem ? migrateRecord(storeName, clonePlain(mem)) : null);
			return;
		}
		const req = store.get(id);
		req.onsuccess = ()=>{
			finish(req.result ? migrateRecord(storeName, req.result) : null);
		};
		req.onerror = ()=>{
			finish(req.error, true);
		};
	});
	if(isSecretStore(storeName) && record){
		return decryptProfileRecord(record, storeName);
	}
	return record;
}

export async function putStoreRecord(storeName, record, prefix = storeName){
	const next = migrateRecord(storeName, {
		...(record || {}),
		id: ensureRecordId(record, prefix),
		updatedAt: record && record.updatedAt ? record.updatedAt : nowIso(),
	});
	let toPersist = next;
	if(isSecretStore(storeName)){
		// 内存态标记/留存密文不落库
		const { apiKeyDecryptFailed, apiKeyCipherKept, extraHeadersDecryptFailed, extraHeadersCipherKept, ...restRec } = next;
		// 解密失败态且未重填(仍为空串)→ 保留原密文,不用空串覆盖;重填了新 Key → 正常加密
		const cipher = (apiKeyDecryptFailed && apiKeyCipherKept && !`${next.apiKey || ''}`)
			? apiKeyCipherKept
			: await encryptSecretText(`${next.apiKey || ''}`);
		let persistRec = { ...restRec, apiKey: cipher };
		// 额外请求头值加密;解不开且未重填的头值保留原密文
		if(extraHeadersDecryptFailed && extraHeadersCipherKept && typeof extraHeadersCipherKept === 'object'){
			const eh = extraHeadersOf(persistRec);
			if(eh){
				const merged = { ...eh };
				Object.keys(extraHeadersCipherKept).forEach((k)=>{
					if(Object.prototype.hasOwnProperty.call(merged, k) && !merged[k]){ merged[k] = extraHeadersCipherKept[k]; }
				});
				persistRec = withExtraHeaders(persistRec, merged);
			}
		}
		toPersist = await encryptExtraHeaders(persistRec);
	}
	// 调用方拿到的是内存态(明文 key),UI/请求路径零改;落库的是 toPersist(桥可用时为密文)
	const r = await withStore(storeName, 'readwrite', (store, finish)=>{
		if(!store){
			memoryStore(storeName).set(toPersist.id, clonePlain(toPersist));
			finish(next);
			return;
		}
		IDB_STATS.put += 1;
		const req = store.put(toPersist);
		req.onsuccess = ()=>{
			finish(next);
		};
		req.onerror = ()=>{
			finish(req.error, true);
		};
	});
	notifyStoreChanged(storeName, next.id, 'put');
	return r;
}

export async function bulkPutStoreRecords(storeName, records, prefix = storeName){
	const list = normalizeArray(records).map((item)=>migrateRecord(storeName, {
		...(item || {}),
		id: ensureRecordId(item, prefix),
	}));
	const out = await bulkPutStoreRecordsRaw(storeName, list);
	notifyStoreChanged(storeName, null, 'bulk', { ids: list.map((x)=>x.id), count: list.length });
	return out;
}
function bulkPutStoreRecordsRaw(storeName, list){
	return withStore(storeName, 'readwrite', (store, finish)=>{
		if(!store){
			const mem = memoryStore(storeName);
			list.forEach((item)=>{
				mem.set(item.id, clonePlain(item));
			});
			finish(list);
			return;
		}
		let pending = list.length;
		if(pending === 0){
			finish([]);
			return;
		}
		IDB_STATS.put += list.length;
		list.forEach((item)=>{
			const req = store.put(item);
			req.onsuccess = ()=>{
				pending -= 1;
				if(pending === 0){
					finish(list);
				}
			};
			req.onerror = ()=>{
				finish(req.error, true);
			};
		});
	});
}

export async function deleteStoreRecord(storeName, id){
	const r = await withStore(storeName, 'readwrite', (store, finish)=>{
		if(!store){
			memoryStore(storeName).delete(id);
			dropPendingMerges(storeName, id);
			finish(true);
			return;
		}
		IDB_STATS.delete += 1;
		const req = store.delete(id);
		req.onsuccess = ()=>{
			finish(true);
		};
		req.onerror = ()=>{
			finish(req.error, true);
		};
	});
	notifyStoreChanged(storeName, id, 'delete');
	return r;
}

// 条件删除。hint={index,value} 且索引在位 → 单个 readwrite 事务内沿索引游标逐条 predicate 判定后
// cursor.delete()(一次事务、零全表读、零 value 全量反序列化);无 hint / 索引缺席 / 内存回退 → 原路径
// (全量读 + 逐条删)。predicate 在两条路径上都有最终否决权,hint 只是缩小候选集。
export async function deleteWhere(storeName, predicate, hint){
	const indexName = hint && hint.index ? `${hint.index}` : '';
	if(indexName){
		const viaIndex = await withStore(storeName, 'readwrite', (store, finish)=>{
			if(!store || !store.indexNames.contains(indexName)){
				if(store){
					IDB_STATS.fallback += 1;
				}
				finish(null);   // null = 本径不适用,交回原路径
				return;
			}
			let count = 0;
			const req = store.index(indexName).openCursor(window.IDBKeyRange.only(hint.value));
			req.onsuccess = ()=>{
				const cur = req.result;
				if(!cur){
					IDB_STATS.cursorDelete += count;
					finish(count);
					return;
				}
				if(predicate(migrateRecord(storeName, cur.value))){
					cur.delete();
					count += 1;
				}
				cur.continue();
			};
			req.onerror = ()=>{
				finish(req.error, true);
			};
		});
		if(viaIndex !== null){
			if(viaIndex > 0){ notifyStoreChanged(storeName, null, 'deleteWhere', { count: viaIndex }); }
			return viaIndex;
		}
	}
	const items = await listStoreRecords(storeName);
	const toDelete = items.filter((item)=>predicate(item));
	if(toDelete.length){ await deleteStoreRecords(storeName, toDelete.map((item)=>item.id)); }
	return toDelete.length;
}

// 按二级索引读整组记录(P0 热路径:消息按会话读)。返回值与 listStoreRecords 逐条同构(migrateRecord +
// provider_profiles 自动解密)。索引缺席(如升版事务被中断过的库)→ 退回 getAll+filter 并计 fallback,
// 结果不变只是慢;内存回退径按同一 keyPath 过滤。
export async function readByIndex(storeName, indexName, value){
	const keyPath = indexKeyPath(storeName, indexName);
	const matches = (rec)=>!!rec && indexValueEquals(recordIndexValue(rec, keyPath), value);
	const list = await withStore(storeName, 'readonly', (store, finish)=>{
		if(!store){
			const memList = Array.from(memoryStore(storeName).values())
				.filter(matches)
				.map((item)=>migrateRecord(storeName, clonePlain(item)));
			finish(memList);
			return;
		}
		if(store.indexNames.contains(indexName)){
			IDB_STATS.indexGetAll += 1;
			const req = store.index(indexName).getAll(window.IDBKeyRange.only(value));
			req.onsuccess = ()=>{
				finish((req.result || []).map((item)=>migrateRecord(storeName, item)));
			};
			req.onerror = ()=>{
				finish(req.error, true);
			};
			return;
		}
		IDB_STATS.fallback += 1;
		IDB_STATS.getAll += 1;
		const req = store.getAll();
		req.onsuccess = ()=>{
			finish((req.result || []).filter(matches).map((item)=>migrateRecord(storeName, item)));
		};
		req.onerror = ()=>{
			finish(req.error, true);
		};
	});
	if(isSecretStore(storeName) && Array.isArray(list)){
		return Promise.all(list.map((rec)=>decryptProfileRecord(rec, storeName)));
	}
	return list;
}

// 沿二级索引游标读:按索引序(direction 'next'|'prev')逐条取、predicate 过滤、limit 到手即停——
// 「取最新 20 条通知」不再整表 getAll + 全量反序列化。索引缺席 → 退回 getAll + 按 keyPath 排序(计 fallback);
// 内存回退径按 keyPath 排序同径。返回值与 listStoreRecords 逐条同构(migrateRecord + 密钥 store 自动解密)。
export async function listStoreRecordsByIndexCursor(storeName, indexName, options = {}){
	const direction = options.direction === 'prev' ? 'prev' : 'next';
	const limit = Number.isFinite(options.limit) && options.limit > 0 ? Math.floor(options.limit) : 0;
	const predicate = typeof options.predicate === 'function' ? options.predicate : null;
	const keyPath = indexKeyPath(storeName, indexName);
	const keyText = (rec)=>{ const v = recordIndexValue(rec, keyPath); return v == null ? '' : `${v}`; };
	const collect = (raws)=>{
		const sorted = raws.slice().sort((a, b)=>{ const x = keyText(a); const y = keyText(b); return x < y ? -1 : (x > y ? 1 : 0); });
		if(direction === 'prev'){ sorted.reverse(); }
		const out = [];
		for(let i = 0; i < sorted.length; i++){
			const rec = migrateRecord(storeName, sorted[i]);
			if(predicate && !predicate(rec)){ continue; }
			out.push(rec);
			if(limit && out.length >= limit){ break; }
		}
		return out;
	};
	const list = await withStore(storeName, 'readonly', (store, finish)=>{
		if(!store){
			finish(collect(Array.from(memoryStore(storeName).values()).map((item)=>clonePlain(item))));
			return;
		}
		if(!store.indexNames.contains(indexName)){
			IDB_STATS.fallback += 1;
			IDB_STATS.getAll += 1;
			const req = store.getAll();
			req.onsuccess = ()=>{ finish(collect(req.result || [])); };
			req.onerror = ()=>{ finish(req.error, true); };
			return;
		}
		IDB_STATS.indexCursor += 1;
		const out = [];
		const req = store.index(indexName).openCursor(null, direction);
		req.onsuccess = ()=>{
			const cur = req.result;
			if(!cur){ finish(out); return; }
			const rec = migrateRecord(storeName, cur.value);
			if(!predicate || predicate(rec)){ out.push(rec); }
			if(limit && out.length >= limit){ finish(out); return; }
			cur.continue();
		};
		req.onerror = ()=>{ finish(req.error, true); };
	});
	if(isSecretStore(storeName) && Array.isArray(list)){
		return Promise.all(list.map((rec)=>decryptProfileRecord(rec, storeName)));
	}
	return list;
}

// 单事务「比较并交换」:同一 readwrite 事务内 get → predicate → put。IndexedDB 同 store 的 readwrite 事务
// 串行执行(内存回退径同步执行),因此并发写同一条只有一个赢家。predicate(cur) 为假 → { ok:false, reason:'predicate', record:cur } 不写;
// 记录不存在 → reason:'not-found'。updater(cur) 回完整下一版(id 由本层钉死)。密钥 store 不支持(它们走加密写路径)。
export async function updateStoreRecordIf(storeName, id, predicate, updater){
	if(isSecretStore(storeName)){ throw new Error(`updateStoreRecordIf 不支持密钥 store: ${storeName}`); }
	const next = (cur)=>migrateRecord(storeName, { ...(updater(cur) || {}), id: cur.id });
	return withStore(storeName, 'readwrite', (store, finish)=>{
		if(!store){
			const mem = memoryStore(storeName);
			const raw = mem.get(id);
			if(!raw){ finish({ ok: false, reason: 'not-found', record: null }); return; }
			const cur = migrateRecord(storeName, clonePlain(raw));
			if(!predicate(cur)){ finish({ ok: false, reason: 'predicate', record: cur }); return; }
			const rec = next(cur);
			mem.set(rec.id, clonePlain(rec));
			finish({ ok: true, record: rec });
			return;
		}
		const getReq = store.get(id);
		getReq.onsuccess = ()=>{
			if(!getReq.result){ finish({ ok: false, reason: 'not-found', record: null }); return; }
			const cur = migrateRecord(storeName, getReq.result);
			let rec = null;
			try{
				if(!predicate(cur)){ finish({ ok: false, reason: 'predicate', record: cur }); return; }
				rec = next(cur);
			}catch(e){ finish(e, true); return; }
			IDB_STATS.put += 1;
			const putReq = store.put(rec);
			putReq.onsuccess = ()=>{ finish({ ok: true, record: rec }); };
			putReq.onerror = ()=>{ finish(putReq.error, true); };
		};
		getReq.onerror = ()=>{ finish(getReq.error, true); };
	});
}

// 单例文档「库内读改写」单一入口:同一 readwrite 事务里读出库里现存那份 → merger(cur | null) → put。
// 页面手里那份可能是库读不开时(内存回退)读到的空表、或读失败当成的空表,整份 put 会把库里没读到的内容盖掉;
// merger 拿到的永远是库里现存那份,只把这次的改动并进去。merger 必须只依赖 cur 与调用方这次传进来的改动(可重放):
// 内存回退期间调用时对内存那份合并、并记下 merger,库重开并回时对库里现存那份再重放一遍。回 null / undefined = 不写。
// 密钥 store 不支持(它们走加密写路径)。
export async function mergeStoreRecord(storeName, id, merger){
	if(isSecretStore(storeName)){ throw new Error(`mergeStoreRecord 不支持密钥 store: ${storeName}`); }
	if(id === undefined || id === null || id === ''){ throw new Error('mergeStoreRecord 需要固定 id'); }
	if(typeof merger !== 'function'){ throw new Error('mergeStoreRecord 需要合并函数'); }
	const r = await withStore(storeName, 'readwrite', (store, finish)=>{
		if(!store){
			const mem = memoryStore(storeName);
			const raw = mem.get(id);
			const cur = raw ? migrateRecord(storeName, clonePlain(raw)) : null;
			let rec = null;
			try{ rec = applyMergers(storeName, id, cur, [merger]); }catch(e){ finish(e, true); return; }
			if(rec && rec !== cur){
				mem.set(id, clonePlain(rec));
				if(canUseIndexedDb()){ rememberPendingMerge(storeName, id, merger); }
			}
			finish(rec || null);
			return;
		}
		const getReq = store.get(id);
		getReq.onsuccess = ()=>{
			const cur = getReq.result ? migrateRecord(storeName, getReq.result) : null;
			let rec = null;
			try{ rec = applyMergers(storeName, id, cur, [merger]); }catch(e){ finish(e, true); return; }
			if(!rec || rec === cur){ finish(cur); return; }
			IDB_STATS.put += 1;
			const putReq = store.put(rec);
			putReq.onsuccess = ()=>{ finish(rec); };
			putReq.onerror = ()=>{ finish(putReq.error, true); };
		};
		getReq.onerror = ()=>{ finish(getReq.error, true); };
	});
	notifyStoreChanged(storeName, id, 'put');
	return r;
}

// 一次事务批量删(裁掉几千条终态任务不再每条一个事务);回实际提交的 id 数。内存回退同径。
export async function deleteStoreRecords(storeName, ids){
	const list = normalizeArray(ids).filter((x)=>x !== undefined && x !== null);
	if(!list.length){ return 0; }
	const r = await withStore(storeName, 'readwrite', (store, finish)=>{
		if(!store){
			const mem = memoryStore(storeName);
			let n = 0;
			list.forEach((id)=>{ if(mem.delete(id)){ n += 1; } });
			finish(n);
			return;
		}
		IDB_STATS.delete += list.length;
		let pending = list.length;
		list.forEach((id)=>{
			const req = store.delete(id);
			req.onsuccess = ()=>{ pending -= 1; if(pending === 0){ finish(list.length); } };
			req.onerror = ()=>{ finish(req.error, true); };
		});
	});
	notifyStoreChanged(storeName, null, 'deleteMany', { ids: list.slice(), count: list.length });
	return r;
}

export async function clearStore(storeName){
	// 派生缓存清了无害;其余店库读不开时拒绝(清的只是内存,库里原样,见 assertAiStoreDurable)
	if(storeName !== AI_ANALYSIS_STORES.contextCache){ await assertAiStoreDurable(); }
	const out = await clearStoreRaw(storeName);
	notifyStoreChanged(storeName, null, 'clear');
	return out;
}
function clearStoreRaw(storeName){
	return withStore(storeName, 'readwrite', (store, finish)=>{
		if(!store){
			memoryStore(storeName).clear();
			dropPendingMerges(storeName);
			finish(true);
			return;
		}
		const req = store.clear();
		req.onsuccess = ()=>{
			finish(true);
		};
		req.onerror = ()=>{
			finish(req.error, true);
		};
	});
}

export async function countStoreRecords(storeName){
	return withStore(storeName, 'readonly', (store, finish)=>{
		if(!store){
			finish(memoryStore(storeName).size);
			return;
		}
		const req = store.count();
		req.onsuccess = ()=>{
			finish(req.result || 0);
		};
		req.onerror = ()=>{
			finish(req.error, true);
		};
	});
}
