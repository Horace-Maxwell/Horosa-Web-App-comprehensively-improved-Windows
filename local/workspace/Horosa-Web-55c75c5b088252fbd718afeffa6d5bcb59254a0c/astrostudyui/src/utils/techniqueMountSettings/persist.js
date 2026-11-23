// 挂载默认的存取,以及把选项套进记录 / payload / 全局存储的入口
// 从 techniqueMountSettings.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { safeLocalStorageSet } from '../safeStorage';
import { sanitizeOptionsToSchema, pruneOptionsToNonDefault } from './draft';
import { getTechniqueSettingsSchema, effectiveMountBaseline, fillRecordPayloadKeys, payloadSegmentOf, localStorageMountBaseline } from './baseline';

export const MOUNT_TECHNIQUE_DEFAULTS_KEY = 'horosa.ai.mount.techniqueDefaults.v1';

export const MOUNT_TECHNIQUE_DEFAULTS_VERSION = 1;

function emptyMountDefaults(){
	return { version: MOUNT_TECHNIQUE_DEFAULTS_VERSION, techniques: {} };
}

export function loadMountTechniqueDefaults(){
	try{
		if(typeof window === 'undefined' || !window.localStorage){
			return emptyMountDefaults();
		}
		const raw = window.localStorage.getItem(MOUNT_TECHNIQUE_DEFAULTS_KEY);
		if(!raw){
			return emptyMountDefaults();
		}
		const parsed = JSON.parse(raw);
		const techniques = parsed && parsed.techniques && typeof parsed.techniques === 'object' ? parsed.techniques : {};
		const cleaned = {};
		Object.keys(techniques).forEach((k)=>{
			// 读侧同款只滤字段不比值(比值会把「显式存的 schema 默认值」在载入时又吃掉)。
			const sane = sanitizeOptionsToSchema(k, techniques[k]);
			if(sane && Object.keys(sane).length){
				cleaned[k] = sane;
			}
		});
		return { version: MOUNT_TECHNIQUE_DEFAULTS_VERSION, techniques: cleaned };
	}catch(e){
		return emptyMountDefaults();
	}
}

export function getMountTechniqueDefault(key){
	const all = loadMountTechniqueDefaults();
	const v = all.techniques[`${key || ''}`];
	return v && typeof v === 'object' ? v : {};
}

// 保存某技法的「同类默认」。传空对象 → 删除该键（回归现状）。调用方负责按盘现状剪 no-op;
// 本函数只滤 schema 字段+归一,不比默认值(见 sanitizeOptionsToSchema 注)。
export function saveMountTechniqueDefaults(key, options){
	const all = loadMountTechniqueDefaults();
	const k = `${key || ''}`;
	const sane = sanitizeOptionsToSchema(k, options || {});
	if(sane && Object.keys(sane).length){
		all.techniques[k] = sane;
	}else{
		delete all.techniques[k];
	}
	try{
		if(typeof window !== 'undefined' && window.localStorage){
			safeLocalStorageSet(MOUNT_TECHNIQUE_DEFAULTS_KEY, JSON.stringify(all));
		}
	}catch(e){ /* 存储失败静默 */ }
	return all;
}

export function mergeOptionsIntoRecord(record, key, options){
	const base = record && typeof record === 'object' ? { ...record } : {};
	// baseline=record 本身:与盘现状不同才写(盘存 hsys=1 时选 0=真差异 → 写入生效)。
	// C 类内层锚=与外层同源的 localStorageMountBaseline(record 短名缺键会错锚
	// schema 默认,把「=schema 默认但≠现状」的合法覆盖二次剪掉——双层锚不同构又一例)。
	const schema = getTechniqueSettingsSchema(key);
	// 内层剪枝锚 = 外层判「已改」的同一个基线函数(effectiveMountBaseline):两层锚不同构时,外层判已改的覆盖
	// 会被内层剪掉(紫微带代次标记的盘:外层缺键取出厂默认,内层曾按全局现值剪 → 选「恰等于全局现值」的值不生效)。
	const baseline = effectiveMountBaseline(key, base);
	let opts = options;
	if(schema && typeof schema.expandMergeOptions === 'function' && options && typeof options === 'object'){
		try{ opts = schema.expandMergeOptions(options, base) || options; }catch(_e){ opts = options; }
	}
	const pruned = pruneOptionsToNonDefault(key, opts, baseline);
	const fieldByName = {};
	if(schema && Array.isArray(schema.fields)){
		schema.fields.forEach((f)=>{ fieldByName[f.name] = f; });
	}
	Object.keys(pruned).forEach((name)=>{
		// C 类覆盖写 record 长名(builder 消费序 record 优先——写短名恒被既有长名遮蔽=死开关)。
		const f = fieldByName[name];
		const target = f && f.recordKey ? f.recordKey : name;
		base[target] = pruned[name];
	});
	// 剪枝锚含存档 payload 的键(宿占宿法):剪掉的覆盖 = 盘现状,补进平铺让重算起盘按同一个现状起
	return fillRecordPayloadKeys(schema, base);
}

// B 类同构:baseline=存档 payload 的 optionsPath 现值(存档流派非默认时,调回默认档同样要可表达)。
function payloadOptionsBaseline(schema, payload){
	// 与外层覆盖判定同锚(payloadSegmentOf 认 baselineSource 存档层) —— 此前只按
	// optionsPath 取顶层覆盖层,六爻类「存档层≠optionsPath 层」技法在此二次剪掉合法覆盖。
	return payloadSegmentOf(schema, payload);
}

export function mergeOptionsIntoPayload(payload, key, options){
	const schema = getTechniqueSettingsSchema(key);
	const base = payload && typeof payload === 'object' ? { ...payload } : {};
	const pruned = pruneOptionsToNonDefault(key, options, payloadOptionsBaseline(schema, base));
	if(!schema || schema.kind !== 'payload' || !Object.keys(pruned).length){
		return base;
	}
	const path = schema.optionsPath;
	if(path){
		// 嵌套命名空间(如 'options' 六壬子组 / 'tongshu' 通书):写 payload.<path>.<name>,
		// 与各自 regenerate 读点({...defaults, ...p[path]})同构。
		// schema.applyOverrides(存档段, 覆盖):覆盖要像页面上逐项改那样落(如轨策改单项后流派偏离预设 → 标自定义)
		const stored = base[path] && typeof base[path] === 'object' ? base[path] : {};
		base[path] = typeof schema.applyOverrides === 'function' ? schema.applyOverrides(stored, pruned) : { ...stored, ...pruned };
	}else{
		// 顶层铺平（liureng/jinkou/horary/election）。
		Object.keys(pruned).forEach((name)=>{
			base[name] = pruned[name];
		});
	}
	return base;
}

// C 类：把用户选项写进全局 localStorage（builder 自读）。仅写有 storageKey 的 field 且与默认不同的项。
// C 类覆盖 → {storageKey: 值串}(与 applyLocalStorageSettings 同一 prune 锚),交给 GuoLaoChartStyle 的进程内覆盖作用域,
//   不再落 localStorage。applyLocalStorageSettings 保留给「真要持久化」的调用方(当前无),AI 挂载重算不再用它。
export function localStorageOverrideMap(key, options, record){
	const schema = getTechniqueSettingsSchema(key);
	if(!schema || schema.kind !== 'localStorage'){
		return {};
	}
	// 与外层 / 记录合并同锚(record 长名 ?? 全局现值)
	const pruned = pruneOptionsToNonDefault(key, options, localStorageMountBaseline(key, record));
	const out = {};
	schema.fields.forEach((field)=>{
		if(!field.storageKey){
			return;
		}
		if(Object.prototype.hasOwnProperty.call(pruned, field.name)){
			out[field.storageKey] = `${pruned[field.name]}`;
		}
	});
	return out;
}

// baseline:剪枝锚的现状(不给 = 本机仓现值);助手改技法本地设置时传入与 describe 同一份现状(宿度制取新盘缺省)
export function applyLocalStorageSettings(key, options, baseline){
	const schema = getTechniqueSettingsSchema(key);
	if(!schema || schema.kind !== 'localStorage' || typeof window === 'undefined' || !window.localStorage){
		return;
	}
	// 内层 prune 锚全局现状(与外层同锚):锚裸 schema 默认时,「全局存非默认、
	// 挂载临时拨回默认档」会在这里被剪掉不写 → builder 仍读到全局非默认值,临时覆盖失效。
	const pruned = pruneOptionsToNonDefault(key, options, baseline && typeof baseline === 'object' ? baseline : localStorageMountBaseline(key));
	schema.fields.forEach((field)=>{
		if(!field.storageKey){
			return;
		}
		if(Object.prototype.hasOwnProperty.call(pruned, field.name)){
			try{ safeLocalStorageSet(field.storageKey, `${pruned[field.name]}`); }catch(e){ /* ignore */ }
		}
	});
}

// C 类配套：施加覆盖前快照全局 key 现值（含「不存在」= null），用毕由调用方还原。
// 没有这一对，一次 AI 挂载覆盖就会永久改写用户的全局显示设置（builder 自读的正是这些 key），
// 且 applyLocalStorageSettings 只写不删、改回默认也清不掉残值。
export function snapshotLocalStorageSettings(key){
	const schema = getTechniqueSettingsSchema(key);
	if(!schema || schema.kind !== 'localStorage' || typeof window === 'undefined' || !window.localStorage){
		return null;
	}
	const snap = {};
	schema.fields.forEach((field)=>{
		if(!field.storageKey){
			return;
		}
		try{ snap[field.storageKey] = window.localStorage.getItem(field.storageKey); }catch(e){ snap[field.storageKey] = null; }
	});
	return snap;
}

export function restoreLocalStorageSettings(snapshot){
	if(!snapshot || typeof window === 'undefined' || !window.localStorage){
		return;
	}
	Object.keys(snapshot).forEach((storageKey)=>{
		try{
			const prev = snapshot[storageKey];
			if(prev === null || prev === undefined){
				window.localStorage.removeItem(storageKey);
			}else{
				safeLocalStorageSet(storageKey, prev);
			}
		}catch(e){ /* ignore */ }
	});
}

// 审计矩阵（供五同步自检 + UI）：技法 → kind / 字段数 / 是否可重算。
export function getMountableTechniqueAuditEntry(key){
	const schema = getTechniqueSettingsSchema(key);
	if(!schema){
		return { key, kind: 'none', fieldCount: 0, supportsMountSettings: false };
	}
	const fieldCount = Array.isArray(schema.fields) ? schema.fields.length : 0;
	return {
		key,
		kind: schema.kind,
		fieldCount,
		supportsMountSettings: schema.kind !== 'sectionsOnly' && fieldCount > 0,
	};
}

// 「生效挂载设置」单一解析:会话覆盖(锚盘现状再剪) ?? 同类默认(跨盘模板原样透传,由重算入口按各盘现状终判) ?? 无。
// 对话页(effectiveTechniqueOptions)与无头入口(目标任务 / 定时任务 / 自动简报 / run_analysis / 编排子任务)共用 ——
// 此前无头拼装不带任何覆盖,同一张盘同一技法后台看到的快照与对话页挂载卡口径不同。只收非空(有非默认项)的技法。
export function resolveEffectiveTechniqueOptions(techniqueKeys, opts){
	const o = opts && typeof opts === 'object' ? opts : {};
	const record = o.record || null;
	const overrides = o.sessionOverrides && typeof o.sessionOverrides === 'object' ? o.sessionOverrides : {};
	const out = {};
	(Array.isArray(techniqueKeys) ? techniqueKeys : []).forEach((key)=>{
		if(!key){ return; }
		const session = overrides[key];
		const eff = (session && typeof session === 'object')
			? pruneOptionsToNonDefault(key, session, effectiveMountBaseline(key, record))
			: getMountTechniqueDefault(key);
		if(eff && Object.keys(eff).length){
			out[key] = eff;
		}
	});
	return out;
}
