// 紫微自定义表(四化/亮度)跨会话持久双保险。
//
// 主存 = localStorage(同步读,渲染层直读);本文件补两道防线:
//   1) IDB 镜像:每次保存后异步镜像进 workspace_meta(用户数据店,无 LRU 逐出;IDB 坏时
//      自动降内存=尽力而为,绝不抛)。
//   2) 启动自愈:localStorage 键缺失(配额清理/异常丢失)而镜像在 → 写回 localStorage。
// ⚠ 绝不新建对象仓、绝不升库版本号(旧包升级会炸整个 AI 模块)——只住既有 workspace_meta。
import { getStoreRecord, putStoreRecord, AI_ANALYSIS_STORES } from './aiAnalysisStore';
import { safeLocalStorageSet, safeLocalStorageGet } from './safeStorage';

const MIRROR_IDS = {
	brightness: 'ziwei_custom_brightness_table',
	sihua: 'ziwei_custom_sihua_table',
};
const LS_KEYS = {
	brightness: 'ziweiBrightnessCustom',
	sihua: 'ziweiSihuaCustom',
};

// 保存后调用:把 JSON 串镜像进 IDB(fire-and-forget;失败静默=主存仍在,下次保存再补)。
export function mirrorZiweiCustomTable(kind, jsonStr){
	const id = MIRROR_IDS[kind];
	if(!id || typeof jsonStr !== 'string' || !jsonStr){ return Promise.resolve(null); }
	return putStoreRecord(AI_ANALYSIS_STORES.workspaceMeta, { id, json: jsonStr })
		.catch(()=>null);
}

// 启动自愈:两表逐一「LS 缺而镜像在 → 写回 LS」。返回恢复了哪些 kind(空数组=无事发生)。
// 只在键**完全缺失**时恢复——LS 里已有值(哪怕是用户刚清过的新编辑)永远优先,绝不覆盖。
export async function restoreZiweiCustomTablesOnce(){
	const restored = [];
	for(const kind of Object.keys(MIRROR_IDS)){
		try{
			if(safeLocalStorageGet(LS_KEYS[kind]) !== null){ continue; }
			const rec = await getStoreRecord(AI_ANALYSIS_STORES.workspaceMeta, MIRROR_IDS[kind]);
			if(rec && typeof rec.json === 'string' && rec.json){
				if(safeLocalStorageSet(LS_KEYS[kind], rec.json)){ restored.push(kind); }
			}
		}catch(e){ /* 自愈尽力而为,单表失败不影响其余 */ }
	}
	return restored;
}
