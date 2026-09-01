// 征象搜索方案库(命名保存/载入/删除 + 最近计算历史)。
// 存储走 safeStorage(FL-4 配额纪律:满配额静默降级绝不抛);键版本化,结构变更升 v 号新键。
// [奇门择日] 工厂化:同一套方案库逻辑按 storageKey/exportFormat 实例化——天星与奇门择日
// 各持独立键与导出格式头,绝不混存(两技法 tree 结构不同,互导必污染,mismatchMsg 把门)。
// 既有天星导出函数绑定原键 horosa.zeri.schemes.v1/horosa-zeri-schemes,行为字节不变。
import { safeJsonParseFromStorage, safeJsonStringifyToStorage } from '../../utils/safeStorage';

const HISTORY_MAX = 20;
const SCHEME_MAX = 60;

export function makeSchemeStore({ storageKey, exportFormat, mismatchMsg }){
	function load(){
		const data = safeJsonParseFromStorage(storageKey);
		if(data && typeof data === 'object' && Array.isArray(data.schemes) && Array.isArray(data.history)){
			return data;
		}
		return { version: 1, schemes: [], history: [] };
	}

	function save(data){
		safeJsonStringifyToStorage(storageKey, data);
	}

	function listSchemes(){
		return load().schemes;
	}

	function saveScheme(name, config, tree){
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

	function deleteScheme(id){
		const data = load();
		data.schemes = data.schemes.filter((s) => s.id !== id);
		save(data);
	}

	function renameScheme(id, name){
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

	/** 导出方案(全部或指定 ids)为带格式头的 JSON 字符串(与本地事盘 JSON 导出同范式)。 */
	function exportSchemes(ids){
		const data = load();
		const schemes = Array.isArray(ids) && ids.length
			? data.schemes.filter((s) => ids.indexOf(s.id) >= 0)
			: data.schemes;
		return JSON.stringify({ format: exportFormat, version: 1, exportedAt: new Date().toISOString(), schemes }, null, 2);
	}

	/** 导入方案 JSON:同名以导入者胜(与保存同名覆盖语义一致);返回 {ok, added, msg}。 */
	function importSchemes(text){
		let parsed = null;
		try{
			parsed = JSON.parse(String(text || ''));
		}catch(e){
			return { ok: false, added: 0, msg: 'JSON 解析失败' };
		}
		if(!parsed || parsed.format !== exportFormat || !Array.isArray(parsed.schemes)){
			return { ok: false, added: 0, msg: mismatchMsg || '不是本技法的方案导出文件' };
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

	function pushHistory(config, tree){
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

	function listHistory(){
		return load().history;
	}

	return { listSchemes, saveScheme, deleteScheme, renameScheme, exportSchemes, importSchemes, pushHistory, listHistory };
}

// ── 天星择日(既有键,字节兼容) ──
const tianxingStore = makeSchemeStore({
	storageKey: 'horosa.zeri.schemes.v1',
	exportFormat: 'horosa-zeri-schemes',
	mismatchMsg: '不是天星择日方案导出文件',
});
export const listSchemes = tianxingStore.listSchemes;
export const saveScheme = tianxingStore.saveScheme;
export const deleteScheme = tianxingStore.deleteScheme;
export const renameScheme = tianxingStore.renameScheme;
export const exportSchemes = tianxingStore.exportSchemes;
export const importSchemes = tianxingStore.importSchemes;
export const pushHistory = tianxingStore.pushHistory;
export const listHistory = tianxingStore.listHistory;

// ── 奇门择日(独立键,独立导出格式头) ──
export const qimenZeriSchemeStore = makeSchemeStore({
	storageKey: 'horosa.zeri.qimen.schemes.v1',
	exportFormat: 'horosa-qimen-zeri-schemes',
	mismatchMsg: '不是奇门择日方案导出文件',
});

// ── [Z1] 黄历择日专属实例(独立键+独立导出格式头,跨技法互导必拒同律) ──
export const huangliZeriSchemeStore = makeSchemeStore({
	storageKey: 'horosa.zeri.huangli.schemes.v1',
	exportFormat: 'horosa-huangli-zeri-schemes',
	mismatchMsg: '不是黄历择日方案文件',
});

// ── [Z2] 八字择日专属实例 ──
export const baziZeriSchemeStore = makeSchemeStore({
	storageKey: 'horosa.zeri.bazi.schemes.v1',
	exportFormat: 'horosa-bazi-zeri-schemes',
	mismatchMsg: '不是八字择日方案文件',
});

// ── [Z3] 太乙择日专属实例 ──
export const taiyiZeriSchemeStore = makeSchemeStore({
	storageKey: 'horosa.zeri.taiyi.schemes.v1',
	exportFormat: 'horosa-taiyi-zeri-schemes',
	mismatchMsg: '不是太乙择日方案文件',
});

export const ziweiZeriSchemeStore = makeSchemeStore({
	storageKey: 'horosa.zeri.ziwei.schemes.v1',
	exportFormat: 'horosa-ziwei-zeri-schemes',
	mismatchMsg: '不是紫微择日方案文件',
});

export const liurengZeriSchemeStore = makeSchemeStore({
	storageKey: 'horosa.zeri.liureng.schemes.v1',
	exportFormat: 'horosa-liureng-zeri-schemes',
	mismatchMsg: '不是六壬择日方案文件',
});

export const sanshiZeriSchemeStore = makeSchemeStore({
	storageKey: 'horosa.zeri.sanshi.schemes.v1',
	exportFormat: 'horosa-sanshi-zeri-schemes',
	mismatchMsg: '不是三式择日方案文件',
});

export const qizhengZeriSchemeStore = makeSchemeStore({
	storageKey: 'horosa.zeri.qizheng.schemes.v1',
	exportFormat: 'horosa-qizheng-zeri-schemes',
	mismatchMsg: '不是七政择日方案文件',
});

export const indiaZeriSchemeStore = makeSchemeStore({
	storageKey: 'horosa.zeri.india.schemes.v1',
	exportFormat: 'horosa-india-zeri-schemes',
	mismatchMsg: '不是印度择日方案文件',
});
