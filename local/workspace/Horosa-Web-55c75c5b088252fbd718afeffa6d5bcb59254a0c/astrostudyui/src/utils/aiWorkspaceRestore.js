// AI 工作区备份恢复(单源;零 UI):只替换包内存在的数据集、缺席的一律不动;恢复前内存快照 + 中途出错回滚;
// 未来版本包拒绝;体积上限先于解压。此前恢复循环对每个已知 store 一律 clear + bulkPut(缺则 []),
// 一个只含单店的包能把其余二十多个店清空,且无事务无回滚(D54)。
export const AI_BACKUP_MAX_ZIP_BYTES = 200 * 1024 * 1024;
// 备份 manifest 的 snapshotVersion 上限:大于它的包来自更新的版本(字段语义可能变了),拒绝而不是猜。
// [Q-051/M-62] 必须 = 本版能写出的最高值(aiAnalysisStore.AI_ANALYSIS_SCHEMA_VERSION);此前钉死 1 而导出写 5 →
// 本软件导出的每一份备份都被判「由更新版本创建」拒绝(jest aiWorkspaceRestore 锁两者相等 + 「当前值 + 1 必拒」)。
export const AI_BACKUP_SNAPSHOT_VERSION_MAX = 5;
// [Q-058/M-78] 带密钥的店(接口档案 / 集成档案):导出包已剥密(apiKey 空 + apiKeyRedacted),恢复时按 id 保留本机 Key
// (与统一备份 restoreAiWorkspace「本机已有保留」同口径),否则恢复=清空本机全部 Key。
const SECRET_STORE_NAMES = ['provider_profiles', 'integration_profiles'];
const SECRET_FIELDS = ['apiKey', 'token', 'authorization', 'Authorization', 'secret', 'clientSecret'];
export function mergeLocalSecrets(storeName, incoming, local){
	if(SECRET_STORE_NAMES.indexOf(`${storeName || ''}`) < 0 || !Array.isArray(incoming)){ return incoming; }
	const byId = new Map();
	(Array.isArray(local) ? local : []).forEach((r)=>{ if(r && r.id !== undefined && r.id !== null){ byId.set(`${r.id}`, r); } });
	return incoming.map((rec)=>{
		if(!rec || typeof rec !== 'object'){ return rec; }
		const mine = byId.get(`${rec.id}`);
		if(!mine){ return rec; }
		const out = { ...rec };
		SECRET_FIELDS.forEach((f)=>{
			const empty = out[f] === undefined || out[f] === null || out[f] === '';
			if(empty && mine[f] !== undefined && mine[f] !== null && mine[f] !== ''){
				out[f] = mine[f];
				delete out[`${f}Redacted`];
			}
		});
		if(out.headers && typeof out.headers === 'object' && (out.headers.Authorization === '' || out.headers.Authorization === undefined)
			&& mine.headers && typeof mine.headers === 'object' && mine.headers.Authorization){
			out.headers = { ...out.headers, Authorization: mine.headers.Authorization };
		}
		// [Q-059/M-79] 额外请求头(包内已剥空)按头名回填本机值
		const inEh = out.providerOptions && typeof out.providerOptions === 'object' && out.providerOptions.extraHeaders && typeof out.providerOptions.extraHeaders === 'object' ? out.providerOptions.extraHeaders : null;
		const myEh = mine.providerOptions && typeof mine.providerOptions === 'object' && mine.providerOptions.extraHeaders && typeof mine.providerOptions.extraHeaders === 'object' ? mine.providerOptions.extraHeaders : null;
		if(inEh && myEh){
			const merged = { ...inEh };
			Object.keys(myEh).forEach((k)=>{ if((merged[k] === '' || merged[k] === undefined) && myEh[k]){ merged[k] = myEh[k]; } });
			out.providerOptions = { ...out.providerOptions, extraHeaders: merged };
			delete out.extraHeadersRedacted;
		}
		return out;
	});
}
export const RESTORE_HANDLE_ID = 'restore.last';

// 纯函数:payload(manifest 对象)+ 可恢复的店名清单 → 计划 { ok, error?, present[], absent[], total }
export function planWorkspaceRestore(payload, storeKeys){
	const keys = Array.isArray(storeKeys) ? storeKeys : [];
	if(!payload || typeof payload !== 'object' || Array.isArray(payload)){
		return { ok: false, error: 'backup.invalid', present: [], absent: keys.slice(), total: 0 };
	}
	const sv = payload.snapshotVersion;
	if(sv !== undefined && sv !== null && `${sv}` !== '' && (!Number.isFinite(Number(sv)) || Number(sv) > AI_BACKUP_SNAPSHOT_VERSION_MAX)){
		return { ok: false, error: 'backup.version.future', present: [], absent: keys.slice(), total: 0, snapshotVersion: sv };
	}
	// [Q-412/M-162] 全量备份(命盘列表「导出全量备份」)把 AI 工作区嵌在 aiWorkspace 段:识别并直接取其 stores(unified=true 供提示);
	// 全量包无 aiWorkspace 段 → 独立错误码,界面指路而不是笼统「缺少工作区数据」。
	let stores = payload.stores && typeof payload.stores === 'object' && !Array.isArray(payload.stores) ? payload.stores : null;
	let unified = false;
	if(!stores && payload.aiWorkspace && typeof payload.aiWorkspace === 'object' && payload.aiWorkspace.stores && typeof payload.aiWorkspace.stores === 'object' && !Array.isArray(payload.aiWorkspace.stores)){
		stores = payload.aiWorkspace.stores;
		unified = true;
	}
	if(!stores){
		const isUnified = !!(payload.charts || payload.cases || payload.raw || payload.aiWorkspace === null || payload.format === 'horosa-unified-backup');
		return { ok: false, error: isUnified ? 'backup.unified.no.ai' : 'backup.stores.missing', present: [], absent: keys.slice(), total: 0 };
	}
	const present = keys.filter((name)=>Array.isArray(stores[name]));
	const absent = keys.filter((name)=>!Array.isArray(stores[name]));
	if(!present.length){
		return { ok: false, error: 'backup.stores.empty', present: [], absent, total: 0 };
	}
	const total = present.reduce((n, name)=>n + stores[name].length, 0);
	return { ok: true, present, absent, total, stores, unified };
}

// 执行:只动 plan.present 的店。deps = { clearStore, bulkPutStoreRecords, listStoreRecords, putStoreRecord?, metaStore? }
// 顺序:逐店内存快照 → 写「进行中」句柄 → 逐店 clear+bulkPut → 成功写 ok 句柄;任一店抛错 → 已动过的店按快照回滚 → 写 rolled-back 句柄 → rethrow。
export async function restoreWorkspaceStores(plan, deps){
	if(!plan || !plan.ok){ throw new Error((plan && plan.error) || 'backup.invalid'); }
	const d = deps || {};
	if(typeof d.clearStore !== 'function' || typeof d.bulkPutStoreRecords !== 'function' || typeof d.listStoreRecords !== 'function'){
		throw new Error('restore.deps.missing');
	}
	const snapshots = {};
	for(let i = 0; i < plan.present.length; i++){
		const name = plan.present[i];
		// eslint-disable-next-line no-await-in-loop
		snapshots[name] = await d.listStoreRecords(name);
	}
	const at = new Date().toISOString();
	const writeHandle = async (status, extra)=>{
		if(typeof d.putStoreRecord !== 'function' || !d.metaStore){ return; }
		try{ await d.putStoreRecord(d.metaStore, { id: RESTORE_HANDLE_ID, key: RESTORE_HANDLE_ID, status, at, stores: plan.present.slice(), ...(extra || {}) }, 'restore'); }catch(_e){ /* 句柄写不进不阻断 */ }
	};
	await writeHandle('in-progress');
	const touched = [];
	try{
		for(let i = 0; i < plan.present.length; i++){
			const name = plan.present[i];
			touched.push(name);
			// eslint-disable-next-line no-await-in-loop
			await d.clearStore(name);
			// eslint-disable-next-line no-await-in-loop
			await d.bulkPutStoreRecords(name, mergeLocalSecrets(name, plan.stores[name], snapshots[name]), name);   // [Q-058/M-78]
		}
	}catch(e){
		for(let i = 0; i < touched.length; i++){
			const name = touched[i];
			try{
				// eslint-disable-next-line no-await-in-loop
				await d.clearStore(name);
				// eslint-disable-next-line no-await-in-loop
				await d.bulkPutStoreRecords(name, snapshots[name] || [], name);
			}catch(_e){ /* 回滚尽力而为;句柄记 rolled-back 供排障 */ }
		}
		await writeHandle('rolled-back', { error: `${(e && e.message) || e}` });
		throw e;
	}
	await writeHandle('ok', { total: plan.total });
	return { present: plan.present.slice(), absent: plan.absent.slice(), total: plan.total };
}
