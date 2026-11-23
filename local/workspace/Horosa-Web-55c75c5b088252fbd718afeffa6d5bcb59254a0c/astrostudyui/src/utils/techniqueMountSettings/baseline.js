// 取 schema、字段现状默认与生效基线(记录 / 事盘 payload / 全局存储三处读回)
// 从 techniqueMountSettings.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { ZIWEI_RECORD_SETTINGS, recordHasZiweiSettingsGen } from '../ziweiRecordSettings';
import { recordHasCaptureMark, RECORD_FIELDS_RESTORE_MANIFEST, RECORD_MISSING_IDENTITY_KEYS, recordMissingValue } from '../recordFieldsRestore';
import { GUOLAO_RECORD_FACTORY_DEFAULTS } from '../../components/guolao/GuoLaoChartStyle';
import { DIRECTION_PAGE_BOUND_FIELDS, TECHNIQUE_SETTINGS_SCHEMA } from './schema';

// 紫微随盘设置的记录键(挂载齿轮字段名与之同名)
const ZIWEI_RECORD_SETTING_KEYS = new Set(ZIWEI_RECORD_SETTINGS.map((it)=>it.key));

// AI 重算入口:记录里缺的页面口径字段按页面保存值补上(齿轮覆盖 / 记录已有的值不动)。
// 两类:星运族(DIRECTION_PAGE_BOUND_FIELDS → pageBoundKey)与东亚 / 诸方(字段自带 pageStoreBound,值取 globalCurrent)。
export function fillPageBoundDefaults(key, record){
	const map = DIRECTION_PAGE_BOUND_FIELDS[`${key || ''}`];
	const schema = TECHNIQUE_SETTINGS_SCHEMA[`${key || ''}`];
	if(!schema || !Array.isArray(schema.fields) || !record || typeof record !== 'object'){
		return record;
	}
	if(!map && !schema.fields.some((f)=>f && f.pageStoreBound)){
		return record;
	}
	let out = record;
	schema.fields.forEach((field)=>{
		if(!(field.pageBoundKey || field.pageStoreBound) || (record[field.name] !== undefined && record[field.name] !== null && record[field.name] !== '')){
			return;
		}
		const v = fieldCurrentDefault(field);
		if(v !== undefined && v !== null){
			if(out === record){ out = { ...record }; }
			out[field.name] = v;
		}
	});
	return out;
}

// ---- 取 schema / 默认值 ----

export function getTechniqueSettingsSchema(key){
	const k = `${key || ''}`;
	return TECHNIQUE_SETTINGS_SCHEMA[k] || null;
}

export function isSectionsOnlyTechnique(key){
	const schema = getTechniqueSettingsSchema(key);
	return !!(schema && schema.kind === 'sectionsOnly');
}

// schema 是否提供「可重算的可调项」（有 fields 且非 sectionsOnly）。
export function hasMountSettingsFields(key){
	const schema = getTechniqueSettingsSchema(key);
	return !!(schema && schema.kind !== 'sectionsOnly' && Array.isArray(schema.fields) && schema.fields.length > 0);
}

export function getTechniqueSettingsDefaults(key){
	const schema = getTechniqueSettingsSchema(key);
	const out = {};
	if(!schema || !Array.isArray(schema.fields)){
		return out;
	}
	schema.fields.forEach((field)=>{
		// 数组型默认（multiselect 等）返回新副本，防共享引用被 UI 草稿就地改动污染 schema。
		out[field.name] = Array.isArray(field.default) ? [...field.default] : field.default;
	});
	return out;
}

// 「现状」草稿锚 = schema 默认 + globalCurrent 现值(与两参 pruneOptionsToNonDefault 的比较锚 fieldCurrentDefault 同源)。
// 设置草稿此前用 getTechniqueSettingsDefaults(裸 schema 默认)铺底、再用两参 prune(锚=全局现值)剪枝
// → 用户在全局改过的键(如界系=托勒密)在草稿里显示 schema 默认,一改别的项就以「≠全局现值」被存成覆盖(136 个 globalCurrent 字段同病)。
export function getTechniqueSettingsCurrentDefaults(key){
	const schema = getTechniqueSettingsSchema(key);
	const out = {};
	if(!schema || !Array.isArray(schema.fields)){
		return out;
	}
	schema.fields.forEach((field)=>{
		const v = fieldCurrentDefault(field);
		out[field.name] = Array.isArray(v) ? [...v] : v;
	});
	return out;
}

// 单字段「现值缺省」(globalCurrent 现值优先,回落 schema 默认):抽屉渲染 / 工具描述 / 剪枝共用
export function fieldCurrentDefault(field){
	if(field && typeof field.globalCurrent === 'function'){
		try{
			const v = field.globalCurrent();
			if(v !== undefined && v !== null){
				return v;
			}
		}catch(_e){ /* 回落静态默认 */ }
	}
	return field ? field.default : undefined;
}

// B 类基线段解析(effectiveMountBaseline / payloadMountBaseline / mergeOptionsIntoPayload 内层
// prune 三处共用同一双眼睛):schema.baselineSource(payload) 优先(存档层与 optionsPath 不同层的
// 技法,如六爻存档在 payload.gua.liuyaoSettings 而 optionsPath 顶层是覆盖层);否则按 optionsPath。
// 🔴 三处必须同锚 —— 复查轮内容级差分闸实锤:外层判覆盖(存档层锚)放行、merge 内层(顶层锚)
// 二次剪掉「=schema 默认但≠存档」的拨值 ⇒ 覆盖蒸发,重算出的仍是存档档。
export function payloadSegmentOf(schema, payload){
	if(!schema || !payload || typeof payload !== 'object'){
		return null;
	}
	if(typeof schema.baselineSource === 'function'){
		try{
			const seg = schema.baselineSource(payload);
			return seg && typeof seg === 'object' ? seg : null;
		}catch(_e){
			return null;
		}
	}
	const path = schema.optionsPath;
	if(path === '' || path === undefined || path === null){
		return payload;
	}
	const seg = payload[path];
	return seg && typeof seg === 'object' ? seg : null;
}

export function payloadBaselineSegment(schema, record){
	try{
		const raw = record && typeof record === 'object' ? record.payload : null;
		if(!raw){
			return null;
		}
		const payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
		return payloadSegmentOf(schema, payload);
	}catch(_e){
		return null;
	}
}

// C 类基线:builder 真实消费序 = record 平铺长名(field.recordKey,随盘保真键) 优先、
// 全局 localStorage 兜底、schema 默认收尾 —— 此前只认全局,record 带 guolaoLifeMode 的盘
// 抽屉显示全局值而内容按 record 值(误导),「拨回=全局值」被剪空(覆盖失效)。
// 数字型 default 的字段把串值转回数字(storage 恒存串,不转则 select 显示与 prune 比对全乱套)。
export function localStorageMountBaseline(key, record){
	const schema = getTechniqueSettingsSchema(key);
	const out = {};
	if(!schema || schema.kind !== 'localStorage' || !Array.isArray(schema.fields)){
		return out;
	}
	const rec = record && typeof record === 'object' ? record : null;
	schema.fields.forEach((field)=>{
		if(rec && field.recordKey && rec[field.recordKey] !== undefined && rec[field.recordKey] !== null && rec[field.recordKey] !== ''){
			const rv = rec[field.recordKey];
			out[field.name] = (typeof field.default === 'number') ? Number(rv) : rv;
			return;
		}
		if(rec && field.recordMissingIsDefault){
			out[field.name] = field.default;
			return;
		}
		// 带随盘代次标记的记录缺七政起盘键 = 存盘时是出厂值(页面载入后即此值;AI 构造器同口径)。岁差出厂为空 → 照旧取本机仓
		if(rec && field.recordKey && recordHasCaptureMark(rec) && Object.prototype.hasOwnProperty.call(GUOLAO_RECORD_FACTORY_DEFAULTS, field.recordKey)
			&& GUOLAO_RECORD_FACTORY_DEFAULTS[field.recordKey] !== ''){
			const fv = GUOLAO_RECORD_FACTORY_DEFAULTS[field.recordKey];
			out[field.name] = (typeof field.default === 'number') ? Number(fv) : fv;
			return;
		}
		let v = null;
		if(field.storageKey && typeof window !== 'undefined' && window.localStorage){
			try{ v = window.localStorage.getItem(field.storageKey); }catch(_e){ v = null; }
		}
		if(v === null || v === undefined || v === ''){
			out[field.name] = field.default;
			return;
		}
		out[field.name] = (typeof field.default === 'number') ? Number(v) : v;
	});
	return out;
}

// 平铺键撞名(同一个记录平铺键被几个技法的齿轮按各自的值域用:school 量化盘 / 八字等,method 铁板 / 策天 / 参评,mode,direction):
// 齿轮覆盖并进记录是逐技法的副本、存盘链不写这些键 —— 应用内触发不了(合同测试有探针);但导入的旧数据 / 手改的记录可能带着
// 别的技法的值。每个技法只认自己值域里的值:「只在别的技法值域里、不在本技法值域里」的值 = 外来值,当没设。
// 撞名表按齿轮定义自动求(记录类 + 走命盘管道的 payload 类,按 recordKey || name 归组、有两个技法的值域互不包含即算),新撞名自动纳入。
let sharedFlatKeyDomains = null;

function flatKeyDomains(){
	if(sharedFlatKeyDomains){ return sharedFlatKeyDomains; }
	const by = {};
	Object.keys(TECHNIQUE_SETTINGS_SCHEMA).forEach((tk)=>{
		const sc = TECHNIQUE_SETTINGS_SCHEMA[tk];
		if(!sc || !Array.isArray(sc.fields) || !(sc.kind === 'record' || (sc.kind === 'payload' && sc.chartRoute))){ return; }
		sc.fields.forEach((f)=>{
			if(!Array.isArray(f.options) || !f.options.length){ return; }
			const t = f.recordKey || f.name;
			(by[t] = by[t] || {})[tk] = new Set(f.options.map((o)=>`${o && o.value}`));
		});
	});
	const out = {};
	Object.keys(by).forEach((t)=>{
		const techs = Object.keys(by[t]);
		if(techs.length < 2){ return; }
		// 同义共用的键(时间算法 / 交角容许度:各技法值域互为子集)不算撞名;有一对互不包含 = 各按各的含义用同一个键
		const sub = (a, b2)=>[...a].every((v)=>b2.has(v));
		const clash = techs.some((a, i)=>techs.slice(i + 1).some((b2)=>!sub(by[t][a], by[t][b2]) && !sub(by[t][b2], by[t][a])));
		if(clash){ out[t] = by[t]; }
	});
	sharedFlatKeyDomains = out;
	return out;
}

export function sharedFlatRecordKeys(){
	return Object.keys(flatKeyDomains()).sort();
}

// value 是不是别的技法写进来的(不在 techKey 的值域、在另一个撞名技法的值域)
export function isForeignFlatValue(techKey, recordKey, value){
	const dom = flatKeyDomains()[recordKey];
	if(!dom || value === undefined || value === null || value === ''){ return false; }
	const own = dom[`${techKey || ""}`];
	const v = `${value}`;
	if(!own || own.has(v)){ return false; }
	return Object.keys(dom).some((tk)=>dom[tk].has(v));
}

// 重算入口用:去掉记录里属于别的技法的撞名平铺值(只改副本)
export function scrubForeignFlatValues(techKey, record){
	if(!record || typeof record !== 'object'){ return record; }
	let out = record;
	Object.keys(flatKeyDomains()).forEach((t)=>{
		if(isForeignFlatValue(techKey, t, record[t])){
			if(out === record){ out = { ...record }; }
			delete out[t];
		}
	});
	return out;
}

const RECORD_MISSING_MANIFEST_KEYS = new Set(RECORD_FIELDS_RESTORE_MANIFEST.map((m)=>m.key).filter((k)=>RECORD_MISSING_IDENTITY_KEYS.indexOf(k) < 0));

export function effectiveMountBaseline(key, record){
	const schema = getTechniqueSettingsSchema(key);
	const out = {};
	if(!schema || !Array.isArray(schema.fields)){
		return out;
	}
	let src = record && typeof record === 'object' ? record : {};
	if(schema.kind === 'localStorage'){
		// C 类现状=record 长名(随盘保真) ?? 全局 storageKey 现值 —— 此前读平铺
		// 短名恒退化 schema 默认:抽屉不显示真实现状,「选 schema 默认」在现状非默认时被剪空。
		return localStorageMountBaseline(key, record);
	}
	if(schema.kind === 'payload' && !schema.chartRoute){
		// 🔴 B 类(payload)技法的现状住 record.payload 存档段,不在平铺键——
		// 此前一律读平铺键 ⇒ B 类基线恒退化 schema 默认:抽屉打开显示想象值(A 类实锤的同型
		// 二次误导),且「存档非默认时调回 schema 默认档」在 UI 层即被剪空,永远到不了重算入口
		// 的 payload 现状锚。
		src = payloadBaselineSegment(schema, src) || {};
	}else if(schema.kind === 'payload' && schema.chartRoute){
		// chartRoute 例外(cetian/huangji):payload kind 但走 A 路,覆盖写 record 平铺;
		// 现状=存档段(事盘 payload,经 baselineSource 映射)打底 + 平铺覆盖——
		// 只锚平铺时,huangji 事盘(存档在 payload.options)基线恒退 schema 默认。命盘无 payload
		// 段自然回落纯平铺(cetian 不受影响)。
		const seg = payloadBaselineSegment(schema, src);
		if(seg){
			const flat = {};
			schema.fields.forEach((f)=>{
				if(src[f.name] !== undefined && src[f.name] !== null){ flat[f.name] = src[f.name]; }
			});
			src = { ...seg, ...flat };
		}
	}
	// record 类事盘:平铺键缺席时构造器改读存档 payload.options 的同名键(宿占 suzhanFieldsForRecord),基线同口径
	src = fillRecordPayloadKeys(schema, src);
	// 紫微:带紫微代次标记的盘,缺的随盘设置 = 存盘时是出厂默认 → 基线取字段默认(不取当前全局现值),
	// 与 AI 挂载构造器、载入该盘后的盘面同一口径。
	const ziweiMarked = key === 'ziwei' && recordHasZiweiSettingsGen(record);
	schema.fields.forEach((field)=>{
		if(src[field.name] !== undefined && src[field.name] !== null && !isForeignFlatValue(key, field.recordKey || field.name, src[field.name])){
			out[field.name] = src[field.name];
		}else if(ziweiMarked && ZIWEI_RECORD_SETTING_KEYS.has(field.name)){
			out[field.name] = field.default;
		}else if(schema.kind === 'record' && !field.baselineRecordKey && RECORD_MISSING_MANIFEST_KEYS.has(field.name)){
			// 随盘清单键缺席:与页面载入、AI 构造器同一个缺键单源(recordMissingValue)——带标记 = 存盘时为默认(古典口径取
			// spec 默认、种子键取「记录缺键时的取值」、其余取 schema 初值);旧盘非种子键随全局(既有口径)。
			// 撤出档 / 空值(null)= 消费方缺省 → 显示字段现值缺省
			const m = recordMissingValue(record, field.name);
			out[field.name] = m.kind === 'value' && m.value !== null && m.value !== undefined ? m.value
				: (m.kind === 'drop' && m.value !== null && m.value !== undefined ? m.value : baselineAliasOrDefault(field, src));
		}else{
			out[field.name] = baselineAliasOrDefault(field, src);
		}
	});
	// 存档段带出的只读上下文键(塔罗进阶对应门控):随基线给显隐判据,不是字段、不计覆盖
	return schema.kind === 'payload' ? { ...out, ...mountContextOf(src) } : out;
}

// 只读上下文键:以 __ 开头、不是 schema 字段 —— 显隐判据要看、但齿轮改不了的本盘事实(存档段经 baselineSource 带出,
// 或抽屉按本盘算出的 mountDraftContextFor)。剪枝、抽屉显隐、AI 工具的显隐判定都从基线取同一份,只读、不计覆盖、不下发
export function mountContextOf(src){
	const out = {};
	if(src && typeof src === 'object'){
		Object.keys(src).forEach((k)=>{ if(k.indexOf('__') === 0 && src[k] !== undefined && src[k] !== null){ out[k] = src[k]; } });
	}
	return out;
}

// 只读基线别名:齿轮短名缺席时先看 record 上的同义长名(field.baselineRecordKey;如三分主星 system ← 盘存
// triplicity),再回 globalCurrent/默认。与 recordKey 不同:不改覆盖写回目标(写回仍落短名,不动排盘参数)。
// 外层(effectiveMountBaseline)与内层(pruneOptionsToNonDefault 直接拿 record 当基线)同用 → 双层锚同构。
export function baselineAliasOrDefault(field, src){
	if(field && field.baselineRecordKey && src && src[field.baselineRecordKey] !== undefined && src[field.baselineRecordKey] !== null
		&& (!Array.isArray(field.options) || field.options.some((o)=>o && `${o.value}` === `${src[field.baselineRecordKey]}`))){
		return src[field.baselineRecordKey];
	}
	return fieldCurrentDefault(field);
}

// ---- merge 进重算用的 record / payload（返回副本，不改原对象）----

// record 类事盘(schema.recordPayloadKeys):平铺键缺席时取存档 payload.options 的同名键。
// 基线与合并后的记录共用这一份:基线说「这张盘现在是 X」而剪掉等于 X 的覆盖,重算起盘也必须按 X 起
// (起盘按平铺键读,缺键 = 0;快照文字缺键读 payload),否则剪掉的值在起盘那一侧并不是现状。
export function fillRecordPayloadKeys(schema, src){
	if(!schema || schema.kind !== 'record' || !Array.isArray(schema.recordPayloadKeys) || !src || !src.payload){ return src; }
	let po = null;
	try{
		const pl = typeof src.payload === 'string' ? JSON.parse(src.payload) : src.payload;
		po = pl && pl.options && typeof pl.options === 'object' ? pl.options : null;
	}catch(_e){ po = null; }
	if(!po){ return src; }
	const merged = { ...src };
	schema.recordPayloadKeys.forEach((k)=>{
		const missing = merged[k] === undefined || merged[k] === null || merged[k] === '';
		if(missing && po[k] !== undefined && po[k] !== null && po[k] !== ''){ merged[k] = po[k]; }
	});
	return merged;
}
