import { scheduleStorageWrite } from './deferredStorage';
import { lazySnapshotBuildEnabled } from './perfFlags';
const MODULE_SNAPSHOT_PREFIX = 'horosa.ai.snapshot.module.v1.';
const MODULE_SNAPSHOT_MEMORY = new Map();
const MODULE_SNAPSHOT_GLOBAL_KEY = '__horosa_module_ai_snapshot_map';

// 惰性构建登记(流畅度):moduleName -> token。排盘完成路径只登记 factory,真正的快照文本
// 构建挪到空闲时段(与延迟落盘同一时机)或首次读取时(read-time 强制物化,见
// loadModuleAISnapshot 顶部)——AI 挂载/导出读到的内容与同步构建逐字节一致,只是构建变晚。
// 同名后写覆盖(latest-wins):连续重排只构建最后一次,旧 factory 永不执行。
const PENDING_BUILDS = new Map();

function createPendingToken(moduleName, contentFactory, meta){
	const token = {
		// createdAt/meta 在登记时打点:与同步版「save 时刻」语义一致,物化不重算。
		createdAt: new Date().toISOString(),
		meta: meta || {},
		done: false,
		payload: null,
		materialize(){
			if(token.done){
				return token.payload;
			}
			token.done = true;
			try{
				const text = `${contentFactory() || ''}`.trim();
				if(text){
					token.payload = {
						module: moduleName,
						version: 1,
						createdAt: token.createdAt,
						meta: token.meta,
						content: text,
					};
					saveToMemoryAndGlobal(moduleName, token.payload);
				}
				// 空内容与同步版语义一致:不覆盖旧快照、不落盘。
			}catch(e){
				// factory 异常:保留旧快照。(同步版在调用方构建,抛错会中断其后续;
				// 这里吞掉只丢本次快照,属更稳的一侧。)
			}
			if(PENDING_BUILDS.get(moduleName) === token){
				PENDING_BUILDS.delete(moduleName);
			}
			return token.payload;
		},
	};
	return token;
}

// 惰性版 save:contentFactory 在空闲/读取时才执行。排盘完成的关键路径上只做 Map.set,
// 不再同步遍历整盘拼文本(改设置/改时间「卡一下」的主要来源之一)。
export function saveModuleAISnapshotLazy(moduleName, contentFactory, meta){
	if(!moduleName || typeof contentFactory !== 'function'){
		return null;
	}
	if(!lazySnapshotBuildEnabled()){
		// kill-switch:退化为同步构建,行为==现状。
		return saveModuleAISnapshot(moduleName, contentFactory(), meta);
	}
	const token = createPendingToken(moduleName, contentFactory, meta);
	PENDING_BUILDS.set(moduleName, token);
	if(typeof window !== 'undefined' && window.localStorage){
		scheduleStorageWrite(snapshotKey(moduleName), ()=>{
			const payload = token.materialize();
			// 非 string 返回值 deferredStorage 天然跳过写入(空内容不落盘)。
			return payload ? JSON.stringify(payload) : undefined;
		});
	}
	return token;
}

function snapshotKey(moduleName){
	return `${MODULE_SNAPSHOT_PREFIX}${moduleName}`;
}

function getGlobalSnapshotMap(){
	try{
		if(typeof window === 'undefined'){
			return null;
		}
		if(!window[MODULE_SNAPSHOT_GLOBAL_KEY] || typeof window[MODULE_SNAPSHOT_GLOBAL_KEY] !== 'object'){
			window[MODULE_SNAPSHOT_GLOBAL_KEY] = {};
		}
		return window[MODULE_SNAPSHOT_GLOBAL_KEY];
	}catch(e){
		return null;
	}
}

function saveToMemoryAndGlobal(moduleName, payload){
	if(!moduleName || !payload || !payload.content){
		return;
	}
	MODULE_SNAPSHOT_MEMORY.set(moduleName, payload);
	const globalMap = getGlobalSnapshotMap();
	if(globalMap){
		globalMap[moduleName] = payload;
	}
}

function loadFromMemoryAndGlobal(moduleName){
	const mem = MODULE_SNAPSHOT_MEMORY.get(moduleName);
	if(mem && mem.content){
		return mem;
	}
	const globalMap = getGlobalSnapshotMap();
	if(globalMap && globalMap[moduleName] && globalMap[moduleName].content){
		const payload = globalMap[moduleName];
		MODULE_SNAPSHOT_MEMORY.set(moduleName, payload);
		return payload;
	}
	return null;
}

// [D1-sidecar] 结构化真值随载契约:meta.structuredGT = 引擎真值对象(schema 四类:
// elements/timeline/patterns/keyFactors 任意子集)。下游 GT 消费端
// 与事实核对(reportFactCheck)优先吃 sidecar,缺则回落文本解析 —— 渐进增强,不注册恒零回归。
export function loadModuleStructuredGT(moduleName){
	try{
		const snap = loadModuleAISnapshot(moduleName);
		const gt = snap && snap.meta && snap.meta.structuredGT;
		return (gt && typeof gt === 'object') ? gt : null;
	}catch(_){
		return null;
	}
}

export function saveModuleAISnapshot(moduleName, content, meta){
	try{
		if(!moduleName){
			return null;
		}
		// 同步 save 即最新真值:丢弃同名 pending,防止读取时旧 factory 物化盖过本次内容。
		PENDING_BUILDS.delete(moduleName);
		const text = (content || '').trim();
		if(!text){
			return null;
		}
		const payload = {
			module: moduleName,
			version: 1,
			createdAt: new Date().toISOString(),
			meta: meta || {},
			content: text,
		};
		saveToMemoryAndGlobal(moduleName, payload);
		if(typeof window !== 'undefined' && window.localStorage){
			// 流畅度:大快照落盘移到空闲时段(内存态已可用,见 deferredStorage 说明)。
			scheduleStorageWrite(snapshotKey(moduleName), ()=>JSON.stringify(payload));
		}
		return payload;
	}catch(e){
		// localStorage 写入失败时，仍保留本次会话内快照，保证 AI 导出可用。
		try{
			if(moduleName && content){
				const text = `${content}`.trim();
				if(text){
					const payload = {
						module: moduleName,
						version: 1,
						createdAt: new Date().toISOString(),
						meta: meta || {},
						content: text,
					};
					saveToMemoryAndGlobal(moduleName, payload);
					return payload;
				}
			}
		}catch(inner){
			// ignore
		}
		return null;
	}
}

export function loadModuleAISnapshot(moduleName){
	try{
		if(!moduleName){
			return null;
		}
		// read-time 强制物化(铁律):pending 即最新快照,必须先于 localStorage 直返——
		// localStorage 此刻还是上一次的旧值(延迟落盘窗口),走旧分支会读到过期内容。
		const pending = PENDING_BUILDS.get(moduleName);
		if(pending){
			const fresh = pending.materialize();
			if(fresh){
				return fresh;
			}
			// 物化为空(本次快照为空)→ 按同步版语义回落旧快照。
		}
		if(typeof window !== 'undefined' && window.localStorage){
			const raw = window.localStorage.getItem(snapshotKey(moduleName));
			if(raw){
				try{
					const data = JSON.parse(raw);
					if(data && data.content){
						saveToMemoryAndGlobal(moduleName, data);
						return data;
					}
				}catch(parseErr){
					// 兼容旧版本：localStorage 里可能直接保存纯文本而非 JSON。
					const txt = `${raw}`.trim();
					if(txt){
						const legacy = {
							module: moduleName,
							version: 1,
							createdAt: '',
							meta: {},
							content: txt,
						};
						saveToMemoryAndGlobal(moduleName, legacy);
						return legacy;
					}
				}
			}
		}
		return loadFromMemoryAndGlobal(moduleName);
	}catch(e){
		return loadFromMemoryAndGlobal(moduleName);
	}
}
