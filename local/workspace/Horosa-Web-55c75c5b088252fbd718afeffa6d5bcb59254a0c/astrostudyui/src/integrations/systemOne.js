// 决策层(TypeSafe System One)· 档案接线:key / 基址 / 模型别名 存 IndexedDB 的 integration_profiles(与接口档案同一加密钩:
// 字段就叫 apiKey ⇒ 落库加密、备份剥密、恢复回填全部自动继承,不新增任何放令牌的字段,不升 DB_VERSION)。
// 本文件零直连:调用一律经 services/aianalysis.requestSystemOne → 本地 Java 转发(前端不能直连外网)。
// 读 / 存 / 删档案都把「有无可用档案」同步进 prefs 的内存事实,pointOn 才能同步判断。
import { AI_ANALYSIS_STORES, listStoreRecords, putStoreRecord, deleteStoreRecord } from '../utils/aiAnalysisStore';
import { setSystemOneProfilePresent } from '../utils/systemOne/prefs';
import { normalizeModelName, SYSTEMONE_DEFAULT_MODEL, SYSTEMONE_DEFAULT_BASE_URL } from '../utils/systemOne/wire';

export const SYSTEMONE_KIND = 'systemone';
export const SYSTEMONE_PROFILE_ID = 'systemone-default';
export const SYSTEMONE_PROFILE_NAME = 'TypeSafe';
export { SYSTEMONE_DEFAULT_MODEL, SYSTEMONE_DEFAULT_BASE_URL };

function usable(p){
	return !!(p && p.kind === SYSTEMONE_KIND && p.enabled !== false && `${p.apiKey || ''}`.trim());
}

export function normalizeBaseUrl(url){
	const u = `${url || ''}`.trim().replace(/\/+$/, '');
	if(!u){ return ''; }
	return /^https?:\/\/[^\s]+$/i.test(u) ? u : '';
}

export async function listSystemOneProfiles(){
	const all = await listStoreRecords(AI_ANALYSIS_STORES.integrationProfiles);
	return (all || []).filter((p)=>p && p.kind === SYSTEMONE_KIND);
}

// 可用档案(启用且带 key)或 null;顺手把「有无档案」写进 prefs 内存事实
export async function getSystemOneProfile(){
	let list = [];
	try{ list = await listSystemOneProfiles(); }catch(e){ list = []; }
	const p = list.find(usable) || null;
	setSystemOneProfilePresent(!!p);
	return p;
}

// 存:令牌留空 = 保留已存的(与联网检索密钥同口径);基址留空 = 官方地址;模型别名非法 → jev-latest
export async function saveSystemOneProfile({ apiKey, baseUrl, model, enabled } = {}){
	const existing = (await listSystemOneProfiles()).find((p)=>p.id === SYSTEMONE_PROFILE_ID) || null;
	const typed = `${apiKey || ''}`.trim();
	const key = typed || `${(existing && existing.apiKey) || ''}`;
	if(!key){ return { ok: false, reason: 'need-key' }; }
	const rec = {
		id: SYSTEMONE_PROFILE_ID,
		kind: SYSTEMONE_KIND,
		name: SYSTEMONE_PROFILE_NAME,
		baseUrl: normalizeBaseUrl(baseUrl),
		model: normalizeModelName(model),
		apiKey: key,
		enabled: enabled !== false,
	};
	const saved = await putStoreRecord(AI_ANALYSIS_STORES.integrationProfiles, rec, SYSTEMONE_KIND);
	setSystemOneProfilePresent(usable(rec));
	return { ok: true, profile: saved || rec };
}

export async function removeSystemOneProfile(){
	const list = await listSystemOneProfiles();
	for(let i = 0; i < list.length; i += 1){
		// eslint-disable-next-line no-await-in-loop
		await deleteStoreRecord(AI_ANALYSIS_STORES.integrationProfiles, list[i].id);
	}
	setSystemOneProfilePresent(false);
	return list.length;
}

// 启动 / 面板挂载时把 IndexedDB 里的事实读进内存(只在总开关开着时调用:关路径零 IO)
export async function primeSystemOneProfile(){
	return getSystemOneProfile();
}
