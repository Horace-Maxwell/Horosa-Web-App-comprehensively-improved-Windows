// AI 结构化输出(C3):JSON Schema 严格模式的单一构造点。前端只产 OpenAI 形 response_format{type:'json_schema', json_schema:{name, schema, strict}};
// 四家翻译在 Java 代理层(OpenAI 透传+400 两级降级 json_schema→json_object→删键 / Anthropic 工具化 tool_choice(仅非流式)/ Gemini responseSchema / Ollama format=schema)。
// 消费方一律缺省关(报告侧判官/审计/统稿按各自旗标;聊天侧判官/审阅/编排后续批接入);未开=现状 json_object 或纯文本,请求字节不变。
// 纪律:schema 只描述形状,不塞业务文案;strict 下 OpenAI 硬约束=每个 object 节点 additionalProperties:false 且 required 列全部属性(可选字段用 type:[…,'null'] 表达);
// 嵌套 ≤5 层;strict 不支持的校验关键字(default/minLength/pattern/format/minimum…)一律剥掉——形状约束交给解析方二次校验。
export const STRUCTURED_FORMAT_TYPE = 'json_schema';
export const SCHEMA_NAME_RE = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
export const SCHEMA_NAME_FALLBACK = 'horosa_output';
export const SCHEMA_MAX_DEPTH = 5;
export const STRICT_UNSUPPORTED_KEYWORDS = ['default', 'minLength', 'maxLength', 'pattern', 'format', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf', 'minItems', 'maxItems', 'uniqueItems', 'minProperties', 'maxProperties'];

export function sanitizeSchemaName(name){
	const s = `${name || ''}`.trim().replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64);
	return SCHEMA_NAME_RE.test(s) ? s : SCHEMA_NAME_FALLBACK;
}

function walk(node, depth, strict, stats){
	if(!node || typeof node !== 'object' || Array.isArray(node)){ return node; }
	if(depth > SCHEMA_MAX_DEPTH){ throw new Error('E_SCHEMA_DEPTH'); }
	const out = {};
	Object.keys(node).forEach((k)=>{
		if(strict && STRICT_UNSUPPORTED_KEYWORDS.indexOf(k) >= 0){ stats.dropped += 1; return; }
		out[k] = node[k];
	});
	const isObject = out.type === 'object' || (Array.isArray(out.type) && out.type.indexOf('object') >= 0) || (out.properties && typeof out.properties === 'object');
	if(isObject){
		const props = out.properties && typeof out.properties === 'object' ? out.properties : {};
		if(!out.type){ out.type = 'object'; }
		out.properties = {};
		Object.keys(props).forEach((k)=>{ out.properties[k] = walk(props[k], depth + 1, strict, stats); });
		if(strict){ out.additionalProperties = false; out.required = Object.keys(props); }
	}
	if(out.items){ out.items = Array.isArray(out.items) ? out.items.map((it)=>walk(it, depth + 1, strict, stats)) : walk(out.items, depth + 1, strict, stats); }
	['anyOf', 'oneOf', 'allOf'].forEach((k)=>{ if(Array.isArray(out[k])){ out[k] = out[k].map((it)=>walk(it, depth + 1, strict, stats)); } });
	if(out.$defs && typeof out.$defs === 'object'){ const d = {}; Object.keys(out.$defs).forEach((k)=>{ d[k] = walk(out.$defs[k], depth + 1, strict, stats); }); out.$defs = d; }
	return out;
}

// 严格化(纯函数,不改入参):根必须是 object 且嵌套 ≤5 层,否则 null(调用方回落 json_object)
export function normalizeStrictSchema(schema, options){
	const strict = !(options && options.strict === false);
	const stats = { dropped: 0 };
	try{
		const s = walk(schema, 1, strict, stats);
		if(!s || typeof s !== 'object' || s.type !== 'object'){ return null; }
		if(options && options.stats && typeof options.stats === 'object'){ options.stats.dropped = stats.dropped; }
		return s;
	}catch(e){ return null; }
}

// 给 providerOptions 挂 response_format(返回新对象,不改入参);schema 不可用 → 退成 json_object(仍要求 JSON,只是无形状约束)
export function applyResponseSchema(providerOptions, spec){
	const opts = { ...(providerOptions || {}) };
	const s = spec && spec.schema ? normalizeStrictSchema(spec.schema, { strict: spec.strict !== false }) : null;
	if(!s){ opts.response_format = { type: 'json_object' }; return opts; }
	opts.response_format = { type: STRUCTURED_FORMAT_TYPE, json_schema: { name: sanitizeSchemaName(spec.name), schema: s, strict: spec.strict !== false } };
	return opts;
}

export function hasResponseSchema(providerOptions){
	const rf = providerOptions && providerOptions.response_format;
	return !!(rf && typeof rf === 'object' && rf.type === STRUCTURED_FORMAT_TYPE && rf.json_schema && rf.json_schema.schema);
}

export function describeResponseFormat(providerOptions){
	const rf = providerOptions && providerOptions.response_format;
	if(!rf || typeof rf !== 'object'){ return 'text'; }
	if(rf.type === STRUCTURED_FORMAT_TYPE){ return `json_schema:${(rf.json_schema && rf.json_schema.name) || SCHEMA_NAME_FALLBACK}`; }
	if(rf.type === 'json_object' || rf.type === 'json'){ return 'json_object'; }
	return `${rf.type || 'text'}`;
}

// 判官/裁决类通用 schema:{status ∈ 枚举, reason, nextStep?} + 可追加字段(每个值须是 schema 片段)
export function buildEnumVerdictSchema({ statuses, withNextStep = true, extra }){
	const list = Array.isArray(statuses) ? statuses.map((s)=>`${s}`).filter(Boolean) : [];
	const properties = { status: { type: 'string', enum: list.length ? list : ['done', 'continue', 'blocked'], description: '判定' }, reason: { type: 'string', description: '一句话理由' } };
	if(withNextStep){ properties.nextStep = { type: 'string', description: '下一步(没有则空串)' }; }
	if(extra && typeof extra === 'object'){ Object.keys(extra).forEach((k)=>{ if(extra[k] && typeof extra[k] === 'object'){ properties[k] = extra[k]; } }); }
	return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false };
}

// 宽松解析:剥 ``` 围栏 → 取第一个平衡的 {…}/[…](字符串内的括号不算)→ JSON.parse;失败 null
export function parseStructuredJson(text){
	let s = `${text == null ? '' : text}`.trim();
	if(!s){ return null; }
	const fence = /^```(?:json|JSON)?\s*([\s\S]*?)\s*```$/.exec(s);
	if(fence){ s = fence[1].trim(); }
	try{ return JSON.parse(s); }catch(e){ /* 继续找平衡块 */ }
	const start = (()=>{ const a = s.indexOf('{'); const b = s.indexOf('['); if(a < 0){ return b; } if(b < 0){ return a; } return Math.min(a, b); })();
	if(start < 0){ return null; }
	const open = s[start]; const close = open === '{' ? '}' : ']';
	let depth = 0; let inStr = false; let esc = false;
	for(let i = start; i < s.length; i++){
		const ch = s[i];
		if(inStr){ if(esc){ esc = false; } else if(ch === '\\'){ esc = true; } else if(ch === '"'){ inStr = false; } continue; }
		if(ch === '"'){ inStr = true; continue; }
		if(ch === open){ depth += 1; }
		else if(ch === close){ depth -= 1; if(depth === 0){ try{ return JSON.parse(s.slice(start, i + 1)); }catch(e){ return null; } } }
	}
	return null;
}

// schema 指纹(FNV-1a 32 位;供判官 pin / 磁带键):同形状同指纹,键序敏感=改 schema 即换 pin
export function schemaFingerprint(schema){
	const str = JSON.stringify(schema === undefined ? null : schema);
	let h = 0x811c9dc5;
	for(let i = 0; i < str.length; i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
	return `sch-${h.toString(16).padStart(8, '0')}`;
}

// [进阶审计·真模型 D11·2026-09-07] 第三级降级(空正文):DeepSeek V4 flash 在 json_object 模式下把整段输出写进 reasoning_content、
// content 为空且 finish_reason=stop(磁带实抓:completion_tokens 1243 = reasoning_tokens 1243)。代理层的两级降级只认 HTTP 400,
// 对这种「200 但空正文」无感 → /审阅 恒「审阅模型没有返回合法 JSON」。结构化短调用若拿到空正文且本次带了 response_format,
// 去掉 response_format 原样重发一次(仍空才算失败)。只在空正文时触发:有正文的请求字节零变化。
export function withoutResponseFormat(providerOptions){
	const o = { ...(providerOptions || {}) };
	delete o.response_format;
	return o;
}
export function structuredContentOf(rsp){
	return rsp && rsp.Result && rsp.Result.content ? `${rsp.Result.content}` : '';
}
// [Q-294/M-109·AR-05] options(如 { signal })两次调用都透传:此前只有两个形参,调用方传的 signal 被静默丢弃 →
//   规划 / 综合 / 判官 / 审阅短调用不受「停止」影响。
export async function requestStructuredWithFallback(request, params, options){
	const first = await request(params, options);
	if(structuredContentOf(first)){ return first; }
	const po = params && params.providerOptions;
	if(!po || !po.response_format || typeof request !== 'function'){ return first; }
	if(options && options.signal && options.signal.aborted){ return first; }
	const retry = await request({ ...params, providerOptions: withoutResponseFormat(po) }, options);
	return structuredContentOf(retry) ? retry : first;
}
