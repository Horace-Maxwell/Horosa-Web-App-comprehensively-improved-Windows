// 征象搜索方案库(命名保存/载入/删除 + 最近计算历史)。
// 存储走 safeStorage(FL-4 配额纪律:满配额静默降级绝不抛);键版本化,结构变更升 v 号新键。
import { safeJsonParseFromStorage, safeJsonStringifyToStorage } from '../../utils/safeStorage';

const KEY = 'horosa.zeri.schemes.v1';
const HISTORY_MAX = 20;
const SCHEME_MAX = 60;

function load(){
	const data = safeJsonParseFromStorage(KEY);
	if(data && typeof data === 'object' && Array.isArray(data.schemes) && Array.isArray(data.history)){
		return data;
	}
	return { version: 1, schemes: [], history: [] };
}

function save(data){
	safeJsonStringifyToStorage(KEY, data);
}

export function listSchemes(){
	return load().schemes;
}

export function saveScheme(name, config, tree){
	const data = load();
	const trimmed = String(name || '').trim();
	if(!trimmed){
		return { ok: false, msg: '方案名不能为空' };
	}
	const rec = {
		id: `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
		name: trimmed,
		savedAt: new Date().toISOString(),
		config: JSON.parse(JSON.stringify(config || {})),
		tree: JSON.parse(JSON.stringify(tree || null)),
	};
	// 同名覆盖(用户心智:保存到同一个名字=更新)
	data.schemes = data.schemes.filter((s) => s.name !== trimmed);
	data.schemes.unshift(rec);
	if(data.schemes.length > SCHEME_MAX){
		data.schemes.length = SCHEME_MAX;
	}
	save(data);
	return { ok: true, id: rec.id };
}

export function deleteScheme(id){
	const data = load();
	data.schemes = data.schemes.filter((s) => s.id !== id);
	save(data);
}

export function renameScheme(id, name){
	const trimmed = String(name || '').trim();
	if(!trimmed){
		return { ok: false, msg: '方案名不能为空' };
	}
	const data = load();
	const hit = data.schemes.find((s) => s.id === id);
	if(!hit){
		return { ok: false, msg: '方案不存在' };
	}
	// 同名覆盖语义与 saveScheme 一致:重命名撞既有名 → 顶掉旧同名方案
	data.schemes = data.schemes.filter((s) => s.id === id || s.name !== trimmed);
	hit.name = trimmed;
	save(data);
	return { ok: true };
}

const EXPORT_FORMAT = 'horosa-zeri-schemes';

/** 导出方案(全部或指定 ids)为带格式头的 JSON 字符串(与本地事盘 JSON 导出同范式)。 */
export function exportSchemes(ids){
	const data = load();
	const schemes = Array.isArray(ids) && ids.length
		? data.schemes.filter((s) => ids.indexOf(s.id) >= 0)
		: data.schemes;
	return JSON.stringify({ format: EXPORT_FORMAT, version: 1, exportedAt: new Date().toISOString(), schemes }, null, 2);
}

/** 导入方案 JSON:同名以导入者胜(与保存同名覆盖语义一致);返回 {ok, added, msg}。 */
export function importSchemes(text){
	let parsed = null;
	try{
		parsed = JSON.parse(String(text || ''));
	}catch(e){
		return { ok: false, added: 0, msg: 'JSON 解析失败' };
	}
	if(!parsed || parsed.format !== EXPORT_FORMAT || !Array.isArray(parsed.schemes)){
		return { ok: false, added: 0, msg: '不是天星择日方案导出文件' };
	}
	const data = load();
	let added = 0;
	parsed.schemes.forEach((s) => {
		if(!s || !s.name || !s.tree){ return; }
		data.schemes = data.schemes.filter((x) => x.name !== s.name);
		data.schemes.unshift({
			id: s.id || `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
			name: `${s.name}`,
			savedAt: s.savedAt || new Date().toISOString(),
			config: s.config || {},
			tree: s.tree,
		});
		added += 1;
	});
	if(data.schemes.length > SCHEME_MAX){
		data.schemes.length = SCHEME_MAX;
	}
	save(data);
	return { ok: true, added, msg: '' };
}

export function pushHistory(config, tree){
	const data = load();
	data.history.unshift({
		at: new Date().toISOString(),
		config: JSON.parse(JSON.stringify(config || {})),
		tree: JSON.parse(JSON.stringify(tree || null)),
	});
	if(data.history.length > HISTORY_MAX){
		data.history.length = HISTORY_MAX;
	}
	save(data);
}

export function listHistory(){
	return load().history;
}
