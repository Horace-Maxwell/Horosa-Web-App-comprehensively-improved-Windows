// AI 助手·单源工具注册表:应用内 AI(function calling 循环)与外部智能体桥(MCP)只经本文件调工具。
// runTool 固定流水:存在→JSON Schema 校验(Ajv)→只增不删守卫→(additive)预分配 actionId+写前快照→run→账本。
// outputSchema(可选,type:object):进 MCP 导出面(manifest),外部客户端据此校验 structuredContent;运行时 toolDefs 不取。
// 工具定义可选键(原样透传,getTool 可读;不进 manifest):timeoutMs / referenceKeys /
//   cacheable(仅 read 级;运行时同参去重的准入)/ cacheKey(args)(去重键的参数归一,缺省键排序序列化)。
import { containsNeutral, equalsNeutral } from '../scriptNeutralMatch';
import Ajv from 'ajv';
import { emitAutomationEvent, emitAutomationEventSync } from '../aiAgent/automation/events';
import { AGENT_TOOL_LEVELS, AGENT_UNDO_KINDS, TOOL_NAME_PATTERN, DENIED_TOOL_NAME_RE, TOOL_CATEGORIES, TOOL_ORIGINS, buildToolManifest, TOOL_CALL_ORIGINS } from './catalog';
import { guardAdditive } from './guardAdditive';
import { appendAction, newActionId, reserveAction, discardReserved, getAction, findActionByIdempotencySlot } from './ledger';
import { normalizeIdempotencyKey, IDEMPOTENCY_KEY_ERROR_MESSAGE } from './idempotencyKey';

export const LEDGER_LOST_EVENT = 'horosa:agent-ledger-lost';
const tools = new Map();
const validators = new Map();
const sources = new Map();   // name → 注册时传入的定义对象(幂等短路判「同一份定义」用)
// 目录变更订阅(真注册/注销才发;幂等短路不发):本机 MCP 桥据此推 tools/list_changed
const catalogSubs = [];
export function subscribeToolCatalog(fn){
	if(typeof fn !== 'function'){ return ()=>{}; }
	catalogSubs.push(fn);
	return ()=>{ const i = catalogSubs.indexOf(fn); if(i >= 0){ catalogSubs.splice(i, 1); } };
}
function emitCatalogChanged(detail){
	catalogSubs.slice().forEach((fn)=>{ try{ fn(detail); }catch(e){ /* 订阅者抛错不反噬注册 */ } });
}
let ajv = null;
function getAjv(){
	if(!ajv){
		ajv = new Ajv({ allErrors: true, strict: false, coerceTypes: true, useDefaults: true, removeAdditional: true });
	}
	return ajv;
}

export function registerTool(def){
	if(!def || typeof def !== 'object'){ throw new Error('[aiTools] registerTool: def 缺失'); }
	const name = `${def.name || ''}`;
	if(!TOOL_NAME_PATTERN.test(name)){ throw new Error(`[aiTools] 工具名不合规: ${name}`); }
	if(DENIED_TOOL_NAME_RE.test(name)){ throw new Error(`[aiTools] 工具名含删除/覆盖类词,只增不删目录拒绝注册: ${name}`); }
	if(AGENT_TOOL_LEVELS.indexOf(def.level) < 0){ throw new Error(`[aiTools] level 只允许 ${AGENT_TOOL_LEVELS.join('|')}: ${name}`); }
	const undoKind = def.undoKind || 'none';
	if(AGENT_UNDO_KINDS.indexOf(undoKind) < 0){ throw new Error(`[aiTools] undoKind 不合规: ${name}`); }
	if(undoKind === 'restore-settings' && typeof def.snapshot !== 'function'){ throw new Error(`[aiTools] restore-settings 工具必须提供 snapshot(): ${name}`); }
	if(typeof def.run !== 'function'){ throw new Error(`[aiTools] run 缺失: ${name}`); }
	if(!def.inputSchema || typeof def.inputSchema !== 'object'){ throw new Error(`[aiTools] inputSchema 缺失: ${name}`); }
	// outputSchema 可选;声明了就必须是 type:object 的对象(MCP 规范:structuredContent 是对象)
	if(def.outputSchema !== undefined && (!def.outputSchema || typeof def.outputSchema !== 'object' || def.outputSchema.type !== 'object')){ throw new Error(`[aiTools] outputSchema 须为 type:object 的 JSON Schema: ${name}`); }
	if(def.cacheable !== undefined && typeof def.cacheable !== 'boolean'){ throw new Error(`[aiTools] cacheable 须为布尔: ${name}`); }
	if(def.cacheable && def.level !== 'read'){ throw new Error(`[aiTools] 只有 read 级工具可声明 cacheable(写入永不去重): ${name}`); }
	if(def.cacheKey !== undefined && typeof def.cacheKey !== 'function'){ throw new Error(`[aiTools] cacheKey 须为函数: ${name}`); }
	// preview(args, ctx) → { title, before, after }:纯函数(可 async),只给审批预览用,不进 manifest,不许有副作用
	if(def.preview !== undefined && typeof def.preview !== 'function'){ throw new Error(`[aiTools] preview 须为函数: ${name}`); }
	// noChange(args, ctx) → null | 最终回包:写入类的「无变化」预检(纯读,可 async)。判得出这次什么也不会改,就回给调用方的结果
	//   (如 { ok:true, data:{ changed:false } } 或 { ok:false, code:'E_SETTING_NO_CHANGE' })——审批前(peekNoChange)与执行前同一个函数,
	//   不弹审批卡、不进账本、不计外部写入额度、不发自动化事件
	if(def.noChange !== undefined && typeof def.noChange !== 'function'){ throw new Error(`[aiTools] noChange 须为函数: ${name}`); }
	if(def.noChange !== undefined && def.level !== 'additive'){ throw new Error(`[aiTools] 只有写入类工具可声明 noChange: ${name}`); }
	// 类别(审批按类别收紧的依据)缺省 query;enabled 若声明须为函数(功能开关关=不进 manifest、调用即 E_TOOL_DISABLED);
	// origin 缺省 builtin——只有 external 来源的工具允许注销(只增不删合同只约束内置目录)。
	const category = def.category === undefined ? 'query' : def.category;
	if(TOOL_CATEGORIES.indexOf(category) < 0){ throw new Error(`[aiTools] category 只允许 ${TOOL_CATEGORIES.join('|')}: ${name}`); }
	const origin = def.origin === undefined ? 'builtin' : def.origin;
	if(TOOL_ORIGINS.indexOf(origin) < 0){ throw new Error(`[aiTools] origin 只允许 ${TOOL_ORIGINS.join('|')}: ${name}`); }
	if(def.enabled !== undefined && typeof def.enabled !== 'function'){ throw new Error(`[aiTools] enabled 须为函数: ${name}`); }
	// disabledHint:可选函数,开关关时报错里说「开哪个开关」(switchHints.switchHintText 出文字);只有声明了 enabled 的工具才有意义
	if(def.disabledHint !== undefined && (typeof def.disabledHint !== 'function' || typeof def.enabled !== 'function')){ throw new Error(`[aiTools] disabledHint 须为函数且须与 enabled 同时声明: ${name}`); }
	// alwaysConfirm:始终要用户审批(不论审批档),只给写入类
	if(def.alwaysConfirm !== undefined && (typeof def.alwaysConfirm !== 'boolean' || def.level !== 'additive')){ throw new Error(`[aiTools] alwaysConfirm 须为布尔且只用于写入类: ${name}`); }
	// origins:可选,只对列出的调用来源开放(不在其它来源的目录里、直呼其名也拒);值域 TOOL_CALL_ORIGINS
	if(def.origins !== undefined && (!Array.isArray(def.origins) || !def.origins.length || def.origins.some((o)=>TOOL_CALL_ORIGINS.indexOf(o) < 0))){ throw new Error(`[aiTools] origins 只允许 ${TOOL_CALL_ORIGINS.join('|')} 的非空子集: ${name}`); }
	if(tools.has(name)){
		// 幂等:同一份定义再注册=短路(零 warn、定义同引用、Ajv 校验器缓存不失效)——每开一个 Turn 都会 registerBuiltinTools
		if(sources.get(name) === def){ return tools.get(name); }
		console.warn(`[aiTools] 覆盖重复注册: ${name}`);
	}
	tools.set(name, { ...def, name, undoKind, category, origin });
	sources.set(name, def);
	validators.delete(name);
	emitCatalogChanged({ op: 'register', name, origin });
	return tools.get(name);
}

// 注销只对 external 来源开放(外部服务器断开/关开关时收回它带来的工具);内置工具永不可注销。返回是否注销。
export function unregisterTool(name){
	const def = tools.get(`${name}`);
	if(!def || def.origin !== 'external'){ return false; }
	tools.delete(def.name);
	sources.delete(def.name);
	validators.delete(def.name);
	emitCatalogChanged({ op: 'unregister', name: def.name, origin: def.origin });
	return true;
}

export function getTool(name){
	return tools.get(`${name}`) || null;
}

export function listTools(){
	return Array.from(tools.values());
}

function toolEnabled(def){
	if(!def || typeof def.enabled !== 'function'){ return true; }
	try{ return def.enabled() !== false; }catch(e){ return false; }
}

function disabledHintOf(def){
	if(!def || typeof def.disabledHint !== 'function'){ return ''; }
	try{ const t = def.disabledHint(); return typeof t === 'string' ? t : ''; }catch(e){ return ''; }
}
function disabledMessage(def){
	const hint = disabledHintOf(def);
	return `工具 ${def.name} 未启用(对应功能开关关闭)${hint ? `;${hint}` : ''}`;
}
// 外部桥用:名字不在 MCP 目录里时,分清「开关关着的内置工具」与「真没有这个工具」(只认内置、对该来源开放的;外部服务器工具一律算没有)
export function disabledToolInfo(name, origin){
	const def = tools.get(name);
	if(!def || def.origin === 'external' || !originAllowed(def, origin) || toolEnabled(def)){ return null; }
	return { code: 'E_TOOL_DISABLED', message: disabledMessage(def) };
}

function originAllowed(def, origin){
	if(!def || !Array.isArray(def.origins)){ return true; }
	return def.origins.indexOf(origin || 'in-app') >= 0;
}

// opts:{ includeExternal(缺省 true;外部桥传 false=本机 MCP 服务永不再导出外部工具), includeDisabled(缺省 false), origin(缺省 'in-app';带 origins 合同的工具只在其列出的来源目录里) }
export function exportToolManifest(opts){
	const o = opts || {};
	const includeExternal = o.includeExternal !== false;
	const includeDisabled = o.includeDisabled === true;
	const origin = o.origin || 'in-app';
	return buildToolManifest(listTools().filter((d)=>(includeExternal || d.origin !== 'external') && (includeDisabled || toolEnabled(d)) && originAllowed(d, origin)));
}

// 这件工具不认的参数键(schema 写了 additionalProperties:false 的每一层都查;开放对象如 cast 的 options 不查)。
// Ajv 的 removeAdditional 会把它们静默剥掉:拼错的 maxchars、想当然的 remove:true 都「成功」—— 后者在写入类上得到的是相反的动作。
// 回路径数组(顶层写键名,嵌套写 a.b / a[0].b),最多 20 条。
const UNKNOWN_ARGS_MAX = 20;
export function unknownArgPaths(schema, args){
	const out = [];
	const walk = (sch, val, prefix)=>{
		if(out.length >= UNKNOWN_ARGS_MAX || !sch || typeof sch !== 'object' || val === null || typeof val !== 'object'){ return; }
		if(Array.isArray(val)){
			if(sch.items && typeof sch.items === 'object' && !Array.isArray(sch.items)){ val.forEach((v, i)=>walk(sch.items, v, `${prefix}[${i}]`)); }
			return;
		}
		const props = sch.properties && typeof sch.properties === 'object' ? sch.properties : null;
		if(!props){ return; }
		Object.keys(val).forEach((k)=>{
			const path = prefix ? `${prefix}.${k}` : k;
			if(Object.prototype.hasOwnProperty.call(props, k)){ walk(props[k], val[k], path); return; }
			if(sch.additionalProperties === false && !sch.patternProperties && out.length < UNKNOWN_ARGS_MAX){ out.push(path); }
		});
	};
	walk(schema, args, '');
	return out;
}
const allowedArgKeys = (schema)=>Object.keys((schema && schema.properties) || {});

function validateArgs(def, args){
	let v = validators.get(def.name);
	if(!v){
		v = getAjv().compile(def.inputSchema);
		validators.set(def.name, v);
	}
	const data = (args && typeof args === 'object' && !Array.isArray(args)) ? JSON.parse(JSON.stringify(args)) : {};
	const ok = v(data);
	const errs = ok ? [] : (v.errors || []);
	return { ok: !!ok, data, errors: errs.map((e)=>`${e.instancePath || '/'} ${e.message || ''}`.trim()), readable: errs.map((e)=>readableAjvError(def, e, data)) };
}

// 校验报错转成一句中文(字段路径 + 原因);枚举写错时按近似给「是不是要 …」(工具可再给 def.suggestEnum(path, value) 补中文名对照)
const editDistance = (a, b)=>{
	const x = `${a}`.toLowerCase(); const y = `${b}`.toLowerCase();
	const d = Array.from({ length: x.length + 1 }, (_, i)=>[i].concat(new Array(y.length).fill(0)));
	for(let j = 1; j <= y.length; j += 1){ d[0][j] = j; }
	for(let i = 1; i <= x.length; i += 1){ for(let j = 1; j <= y.length; j += 1){ d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1)); } }
	return d[x.length][y.length];
};
function valueAt(data, path){
	return `${path || ''}`.split('/').filter(Boolean).reduce((o, k)=>(o && typeof o === 'object' ? o[k.replace(/~1/g, '/').replace(/~0/g, '~')] : undefined), data);
}
export function enumSuggestions(value, allowed){
	const v = `${value == null ? '' : value}`.trim().toLowerCase();
	if(!v || !Array.isArray(allowed)){ return []; }
	const list = allowed.map((a)=>`${a}`);
	// 比对走简繁中性(scriptNeutralMatch):繁体写法与简体候选同样命中
	const exactCase = list.filter((a)=>equalsNeutral(a, v, { ci: true }));
	if(exactCase.length){ return exactCase; }
	const sub = list.filter((a)=>containsNeutral(a, v) || containsNeutral(v, a));
	if(sub.length){ return sub.slice(0, 3); }
	return list.map((a)=>({ a, d: editDistance(a, v) })).filter((x)=>x.d <= Math.max(2, Math.floor(v.length / 3))).sort((p, q)=>p.d - q.d).slice(0, 3).map((x)=>x.a);
}
function readableAjvError(def, e, data){
	const path = e.instancePath || '/';
	const p = e.params || {};
	switch(e.keyword){
	case 'enum': {
		const value = valueAt(data, e.instancePath);
		let sugg = [];
		try{ sugg = (typeof def.suggestEnum === 'function' ? def.suggestEnum(e.instancePath, value) : null) || []; }catch(err){ sugg = []; }
		if(!sugg.length){ sugg = enumSuggestions(value, p.allowedValues); }
		const allowed = Array.isArray(p.allowedValues) ? p.allowedValues : [];
		return `${path} 取值「${`${value}`.slice(0, 40)}」不在可选范围${sugg.length ? `;是不是要 ${sugg.join(' / ')}?` : ''}${allowed.length <= 12 ? `(可选:${allowed.join(' / ')})` : `(共 ${allowed.length} 个可选值)`}`;
	}
	case 'required': return `${path === '/' ? '' : `${path} `}缺少必填参数 ${p.missingProperty}`.trim();
	case 'type': return `${path} 类型应为 ${p.type}`;
	case 'minimum': case 'maximum': case 'exclusiveMinimum': case 'exclusiveMaximum': return `${path} 应 ${p.comparison} ${p.limit}`;
	case 'minLength': return `${path} 至少 ${p.limit} 个字`;
	case 'maxLength': return `${path} 最多 ${p.limit} 个字`;
	case 'minItems': return `${path} 至少 ${p.limit} 项`;
	case 'maxItems': return `${path} 最多 ${p.limit} 项`;
	case 'pattern': return `${path} 写法不对(应匹配 ${p.pattern})`;
	case 'additionalProperties': return `${path === '/' ? '' : `${path} `}有不认的键 ${p.additionalProperty}`.trim();
	default: return `${path} ${e.message || ''}`.trim();
	}
}

// ── 写入类的幂等键(客户端重试不重复写)──
// 外部客户端在 tools/call 的 _meta 里带 idempotencyKey(桥原样放进 ctx.idempotencyKey):同一客户端 + 同一工具 + 同一键 ——
//   参数也相同 → 第一次成功的结果原样回放(replayed: true,不再写、不再记账本);在途中再来 = 等同一次的结果;
//   参数不同 → E_IDEMPOTENCY_CONFLICT(不执行);第一次失败的不留(重试照常执行);第一次写入已被用户撤销 → E_IDEMPOTENCY_UNDONE(不回放「成功」也不重写)。
// 内存表(本进程)之外,成功写入的键随动作账本落盘(条目 idem 字段):页面重载 / 进程重启之后同键重试照样回放。30 分钟有效、内存最多 500 条。
export const IDEMPOTENCY_TTL_MS = 30 * 60 * 1000;
const IDEMPOTENCY_MAX = 500;
const IDEMPOTENCY_REPLAY_DATA_MAX = 4000;   // 随账本落盘的回放 data 上限(字符);超出只回放摘要
const idempotent = new Map();   // key → { argsKey, at, promise, result }
function stableArgsKey(v){
	if(v === null || typeof v !== 'object'){ return JSON.stringify(v); }
	if(Array.isArray(v)){ return `[${v.map(stableArgsKey).join(',')}]`; }
	return `{${Object.keys(v).sort().map((k)=>`${JSON.stringify(k)}:${stableArgsKey(v[k])}`).join(',')}}`;
}
function pruneIdempotent(now){
	for(const [k, e] of idempotent){ if(now - e.at > IDEMPOTENCY_TTL_MS){ idempotent.delete(k); } }
	while(idempotent.size > IDEMPOTENCY_MAX){ idempotent.delete(idempotent.keys().next().value); }
}
// 槽 = 来源|客户端|工具|键:内存表、账本落盘与桥的预查同一个函数
function idempotencySlotOf(name, ctx, key){ return `${(ctx && ctx.origin) || 'in-app'}|${(ctx && ctx.clientName) || ''}|${name}|${key}`; }
// 幂等判定(纯查询,不执行):runTool 与外部桥(限流 / 审批之前)同一份。回 { state, result? }:
//   none = 没带键 / 非写入类 / 没记录 → 照常执行;hit = 回放(result);conflict / undone / invalid = 直接回 result(不执行)
export async function peekIdempotent(name, args, ctx){
	const def = getTool(name);
	if(!def || def.level !== 'additive'){ return { state: 'none' }; }
	const norm = normalizeIdempotencyKey(ctx && ctx.idempotencyKey);
	if(norm.error){ return { state: 'invalid', result: { ok: false, code: 'E_ARGS_INVALID', message: IDEMPOTENCY_KEY_ERROR_MESSAGE } }; }
	if(!norm.key){ return { state: 'none' }; }
	const idemKey = norm.key;
	const now = Date.now();
	pruneIdempotent(now);
	const slot = idempotencySlotOf(name, ctx, idemKey);
	const argsKey = stableArgsKey(args && typeof args === 'object' ? args : {});
	const conflict = { state: 'conflict', result: { ok: false, code: 'E_IDEMPOTENCY_CONFLICT', message: `幂等键 ${idemKey.slice(0, 40)} 已用于 ${name} 的另一组参数,未执行` } };
	const undone = { state: 'undone', result: { ok: false, code: 'E_IDEMPOTENCY_UNDONE', message: `幂等键 ${idemKey.slice(0, 40)} 的第一次写入已被用户撤销:没有重放成功,也没有再写;确要重新写入请换一个新键` } };
	const hit = idempotent.get(slot);
	if(hit){
		if(hit.argsKey !== argsKey){ return conflict; }
		const prev = hit.result || await hit.promise;
		if(prev && prev.ok){
			const aid = prev.undo && prev.undo.actionId;
			const act = aid ? getAction(aid) : null;
			if(act && act.undone){ return undone; }
			return { state: 'hit', result: { ...prev, replayed: true } };
		}
		if(idempotent.get(slot) === hit){ idempotent.delete(slot); }
	}
	// 内存里没有(重载 / 换进程):按账本反查
	const act = findActionByIdempotencySlot(slot, IDEMPOTENCY_TTL_MS, now);
	if(act){
		if(act.idem.argsKey !== argsKey){ return conflict; }
		if(act.undone){ return undone; }
		const r = act.idem.reply || {};
		const kind = act.undo && act.undo.kind ? act.undo.kind : 'none';
		return { state: 'hit', result: { ok: true, code: r.code || undefined, message: r.message || act.summary || name, summary: act.summary, ...(r.data !== undefined ? { data: r.data } : {}), undo: { actionId: act.id, kind, label: undoLabel(kind) }, replayed: true } };
	}
	return { state: 'none' };
}

// ctx 至少 { origin:'in-app'|'mcp' };可带 dispatch/getStore/ui/signal/lastUserMessage/requestId/clientName/idempotencyKey
export async function runTool(name, args, ctx = {}){
	const def = getTool(name);
	if(!def || def.level !== 'additive' || ctx.idempotencyKey === undefined || ctx.idempotencyKey === null){ return runToolOnce(name, args, ctx); }
	const peek = await peekIdempotent(name, args, ctx);
	if(peek.state !== 'none'){ return peek.result; }
	const norm = normalizeIdempotencyKey(ctx.idempotencyKey);
	if(!norm.key){ return runToolOnce(name, args, ctx); }
	const slot = idempotencySlotOf(name, ctx, norm.key);
	// 预查跨过了 await:期间同键的另一次调用可能已登记在途 → 重走一遍预查(等它的结果 / 判冲突),不重复执行
	if(idempotent.has(slot)){ return runTool(name, args, ctx); }
	const argsKey = stableArgsKey(args && typeof args === 'object' ? args : {});
	const entry = { argsKey, at: Date.now(), promise: null, result: null };
	entry.promise = runToolOnce(name, args, { ...ctx, idempotencySlot: slot, idempotencyArgsKey: argsKey }).then((r)=>{
		if(r && r.ok){ entry.result = r; }else if(idempotent.get(slot) === entry){ idempotent.delete(slot); }
		return r;
	});
	idempotent.set(slot, entry);
	return entry.promise;
}

// 无变化预检(审批之前用;与 runToolOnce 执行前那一次同一个 def.noChange):过不了守卫 / 校验、工具没声明、判不了 → null
export const NO_CHANGE_PRECHECK_TIMEOUT_MS = 3000;
async function callNoChange(def, data, ctx){
	if(!def || def.level !== 'additive' || typeof def.noChange !== 'function'){ return null; }
	let timer = null;
	try{
		const r = await Promise.race([
			Promise.resolve().then(()=>def.noChange(data, ctx || {})),
			new Promise((resolve)=>{ timer = setTimeout(()=>resolve(null), NO_CHANGE_PRECHECK_TIMEOUT_MS); }),
		]);
		return r && typeof r === 'object' ? r : null;
	}catch(e){
		return null;
	}finally{
		if(timer){ clearTimeout(timer); }
	}
}
// 无变化回包的统一形:不带撤销句柄(没有动作、不进账本),标 noChange
function noChangeResult(r){
	const { undo, ...rest } = r || {};
	void undo;
	return { ...rest, noChange: true };
}
export async function peekNoChange(name, args, ctx){
	const def = getTool(name);
	if(!def || def.level !== 'additive' || typeof def.noChange !== 'function' || !toolEnabled(def) || !originAllowed(def, ctx && ctx.origin)){ return null; }
	// 与 runToolOnce 同序:守卫先于 Ajv(过不了 = 判不了,交给执行路径如实回错)
	const pre = guardAdditive(def.name, args, def.referenceKeys);
	if(!pre.ok){ return null; }
	if(unknownArgPaths(def.inputSchema, args).length){ return null; }   // 带不认的键:执行路径会拒,这里不预判
	const checked = validateArgs(def, args);
	if(!checked.ok){ return null; }
	const r = await callNoChange(def, checked.data, ctx);
	return r ? noChangeResult(r) : null;
}

async function runToolOnce(name, args, ctx = {}){
	const def = getTool(name);
	if(!def){
		return { ok: false, code: 'E_TOOL_NOT_FOUND', message: `未知工具: ${name}` };
	}
	// 功能开关关的工具不进 manifest;直呼其名(外部客户端/历史回放)一律拒,不执行
	if(!toolEnabled(def)){
		return { ok: false, code: 'E_TOOL_DISABLED', message: disabledMessage(def) };
	}
	// origins 合同:只对列出的来源开放;别的来源直呼其名一律拒,不执行
	if(!originAllowed(def, ctx.origin)){
		return { ok: false, code: 'E_TOOL_DISABLED', message: `工具 ${def.name} 只对 ${def.origins.join('/')} 来源开放` };
	}
	// hooks 否决:规则可在工具执行前同步否决,零写入;自动化总开关关或无规则 = 永不否决(缺省=现状)
	const veto = emitAutomationEventSync('tool.before', { toolName: def.name, level: def.level, category: def.category, origin: ctx.origin || 'in-app' });
	if(veto && veto.vetoed){
		return { ok: false, code: 'E_HOOK_DENIED', message: `已被自动化规则拒绝${veto.reason ? `:${veto.reason}` : ''}`, data: veto.ruleId ? { ruleId: veto.ruleId } : undefined };
	}
	// 守卫先于 Ajv:removeAdditional 会把未声明的禁键静默剥掉——先剥再查=零判别力。
	// 引用键只认 def.referenceKeys 的显式声明(schema 里写了 cid 也不放行;目录合同锁定谁可声明)。
	const guard = guardAdditive(def.name, args, def.referenceKeys);
	if(!guard.ok){
		return { ok: false, code: guard.code, message: guard.code === 'E_FORBIDDEN_KEY' ? `参数含禁用键(只增不删): ${guard.keys.join(',')}` : '工具不存在' };
	}
	// 不认的参数键:写入类一律拒(零写入)—— 带着没被理解的参数去写,可能正好写反(add_record_tag remove:true 曾照样把标签加上);
	// 读类照做,但在回包里点名(ignoredArgs + assumptions),调用方才知道那个参数没生效
	const unknownArgs = unknownArgPaths(def.inputSchema, args);
	if(unknownArgs.length && def.level === 'additive'){
		return { ok: false, code: 'E_ARGS_INVALID', message: `参数里有 ${def.name} 不认的键: ${unknownArgs.join(', ')}(未执行;可用的键: ${allowedArgKeys(def.inputSchema).join(', ')})`, data: { errors: unknownArgs.map((k)=>`/${k} 不是这件工具的参数`), unknownArgs, allowedArgs: allowedArgKeys(def.inputSchema) } };
	}
	const validated = validateArgs(def, args);
	if(!validated.ok){
		return { ok: false, code: 'E_ARGS_INVALID', message: `参数不合规: ${(validated.readable && validated.readable.length ? validated.readable : validated.errors).join('; ')}`, data: { errors: validated.errors } };
	}
	// 调用方已取消 / 已超时(桥的中止信号):写入类一律不开始执行(零写入)—— 客户端早已收到超时,再写就是重试时的重复
	if(def.level === 'additive' && ctx.signal && ctx.signal.aborted){
		return { ok: false, code: 'E_CANCELLED', message: `调用已取消或超时,${def.name} 未执行` };
	}
	// 无变化预检(与审批前的 peekNoChange 同一个函数):什么也不会改 → 直接回,不预留账本、不快照、不执行
	if(def.level === 'additive' && typeof def.noChange === 'function'){
		const nc = await callNoChange(def, validated.data, { ...ctx, tool: def.name });
		if(nc){ return noChangeResult(nc); }
	}
	const actionId = def.level === 'additive' ? newActionId() : null;
	const { idempotencySlot, idempotencyArgsKey, ...ctxRest } = ctx;
	const runCtx = { ...ctxRest, actionId, tool: def.name, now: ctx.now || new Date() };
	let snapshot = null;
	if(def.level === 'additive' && def.undoKind === 'restore-settings'){
		// 快照阶段失败是工具层的事,不是调用方给错了值——借用取值类码会让模型去反复改参数(改不动)。
		try{ snapshot = await def.snapshot(validated.data, runCtx); }catch(e){ return { ok: false, code: 'E_SETTING_SNAPSHOT_FAILED', message: `写前快照失败,已放弃写入: ${e && e.message}` }; }
	}
	// 写前预留账本位:写不进账本就拒绝执行(零写入)——「可一键撤销」不能因本机存储配额满而悄悄降级
	let reserved = null;
	if(def.level === 'additive'){
		reserved = reserveAction({ id: actionId, origin: ctx.origin || 'in-app', tool: def.name, level: def.level });
		if(!reserved){
			return { ok: false, code: 'E_LEDGER_UNAVAILABLE', message: `账本写不进去(本机存储配额已满),${def.name} 未执行;先清理本地存储(回收站/备份导出)再重试` };
		}
	}
	// 写前快照这类异步准备做完时调用方可能已中止:落库之前再看一次
	if(reserved && ctx.signal && ctx.signal.aborted){
		discardReserved(actionId);
		return { ok: false, code: 'E_CANCELLED', message: `调用已取消或超时,${def.name} 未执行` };
	}
	let result;
	try{
		result = await def.run(validated.data, runCtx);
	}catch(e){
		if(reserved){ discardReserved(actionId); }
		return { ok: false, code: 'E_TOOL_FAILED', message: `${def.name} 执行异常: ${e && e.message ? e.message : e}` };
	}
	if(!result || typeof result !== 'object'){
		if(reserved){ discardReserved(actionId); }
		return { ok: false, code: 'E_TOOL_FAILED', message: `${def.name} 返回形态不合法` };
	}
	if(reserved && !result.ok){ discardReserved(actionId); }
	// 执行到了才发现无变化(预检判不了 / 期间状态变了):照样收回账本占位、不记账、不发事件
	if(def.level === 'additive' && result.ok && result.data && typeof result.data === 'object' && result.data.changed === false){
		if(reserved){ discardReserved(actionId); }
		return noChangeResult(result);
	}
	if(def.level === 'additive' && result.ok){
		// 兜底 payload 直接用 def.snapshot() 的产物({facet,technique,snapshot,identity}),与 restoreSettingsSnapshot 同构
		const undo = result.undo || (def.undoKind === 'restore-settings' ? { kind: 'restore-settings', payload: snapshot } : { kind: 'none' });
		if(undo.kind === 'restore-settings' && (!undo.payload || undo.payload.snapshot === undefined) && snapshot){ undo.payload = snapshot; }
		const committed = appendAction({
			id: actionId,
			origin: ctx.origin || 'in-app',
			clientName: ctx.clientName || undefined,
			tool: def.name,
			level: def.level,
			args: sanitizeArgsForLedger(validated.data),
			summary: result.summary || result.message || def.name,
			result: { ok: true, code: result.code || null },
			undo,
			...(idempotencySlot ? { idem: { slot: idempotencySlot, argsKey: idempotencyArgsKey, reply: replyForLedger(result) } } : {}),
		});
		if(!committed){
			// 预留成功而提交失败(极端:占位与正式条目之间配额恰好耗尽):记录已落库、收不回;如实回「不可撤销」并留痕
			console.warn(`[aiTools] 账本提交失败,动作 ${actionId}(${def.name})不可撤销`);
			// 此前 ledgerLost 全仓无人消费(用户不知这条不可撤销):派 DOM 事件让动作条徽标 + 通知中心留痕(零 import)
			try{ if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function'){ window.dispatchEvent(new CustomEvent(LEDGER_LOST_EVENT, { detail: { actionId, tool: def.name, origin: ctx.origin || 'in-app' } })); } }catch(e){ /* noop */ }
			return { ...result, undo: { actionId, kind: 'none', label: '' }, ledgerLost: true };
		}
		// 自动化事件:只增类动作成功后广播(引擎默认关;origin 透传给深度守卫)
		emitAutomationEvent('tool.after', { toolName: def.name, level: def.level, origin: ctx.origin || 'in-app', actionId });
		return { ...result, undo: { actionId, kind: undo.kind, label: undoLabel(undo.kind) } };
	}
	// 读类带了不认的键:结果照给,同时点名(调用方据此知道那个参数没生效)
	if(unknownArgs.length){
		return { ...result, ignoredArgs: unknownArgs, assumptions: [...(Array.isArray(result.assumptions) ? result.assumptions : []), `这些不是 ${def.name} 的参数,已忽略: ${unknownArgs.join(', ')}(可用的键: ${allowedArgKeys(def.inputSchema).join(', ')})`] };
	}
	return result;
}

// 随账本落盘的回放内容:message / code + 有界的 data(超出上限只回放摘要)
function replyForLedger(result){
	const out = { message: `${result.message || ''}`.slice(0, 2000), code: result.code || null };
	if(result.data !== undefined){
		try{ const j = JSON.stringify(result.data); if(j && j.length <= IDEMPOTENCY_REPLAY_DATA_MAX){ out.data = JSON.parse(j); } }catch(e){ /* 不可序列化:只回放摘要 */ }
	}
	return out;
}

function sanitizeArgsForLedger(args){
	const out = { ...(args || {}) };
	['memo', 'question'].forEach((k)=>{ if(out[k] !== undefined){ out[k] = `${out[k]}`.slice(0, 80); } });
	return out;
}

function undoLabel(kind){
	if(kind === 'trash-record'){ return '撤销(移入回收站)'; }
	if(kind === 'restore-settings'){ return '撤销(恢复设置)'; }
	if(kind === 'restore-chat-mount'){ return '撤销(恢复挂载)'; }
	return '';
}

export function __resetToolsForTests(){
	idempotent.clear();
	tools.clear();
	sources.clear();
	validators.clear();
}
