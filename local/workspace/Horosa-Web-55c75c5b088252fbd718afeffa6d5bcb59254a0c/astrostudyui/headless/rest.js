// 无头 REST 接口 /api/v1:与桌面壳 rest_api.rs 同一张路由表、同一组 GET 简写、同一套状态码与回体形态、同一份由目录现生成的 OpenAPI
// (合同测试逐项对拍两边的常量)。REST 只是把请求翻成同一组 JSON-RPC 方法交给协议层,再转回 REST 形态。
'use strict';
const { ERR } = require('./protocol');

const REST_PREFIX = '/api/v1';
const REST_CLIENT_NAME = 'rest';
const GET_ALIASES = [
	['records', 'list_records'],
	['tasks', 'list_tasks'],
	['proposals', 'list_proposals'],
	['context', 'get_current_context'],
	['actions', 'list_actions'],
	['materials', 'search_materials'],
];

// 路由(纯函数):方法 + 去掉查询串的路径 → { kind, name?, allow? }
function route(method, pathname){
	const rest = pathname.startsWith(REST_PREFIX) ? pathname.slice(REST_PREFIX.length) : null;
	if(rest === null){ return { kind: 'NotFound' }; }
	const segs = rest.split('/').filter(Boolean);
	const get = method === 'GET';
	const post = method === 'POST';
	const only = (ok, kind, allow, extra)=>(ok ? { kind, ...(extra || {}) } : { kind: 'MethodNotAllowed', allow });
	const p = segs.map((s)=>{ try{ return decodeURIComponent(s); }catch(e){ return s; } });
	if(p.length === 0){ return only(get, 'Index', 'GET'); }
	if(p.length === 1 && p[0] === 'openapi.json'){ return only(get, 'OpenApi', 'GET'); }
	if(p.length === 1 && p[0] === 'tools'){ return only(get, 'ToolsList', 'GET'); }
	if(p.length === 2 && p[0] === 'tools'){ return only(post, 'ToolCall', 'POST', { name: p[1] }); }
	if(p.length === 1 && p[0] === 'resources'){ return only(get, 'ResourcesList', 'GET'); }
	if(p.length === 2 && p[0] === 'resources' && p[1] === 'templates'){ return only(get, 'ResourceTemplates', 'GET'); }
	if((p.length === 2 && p[0] === 'resources' && p[1] === 'read') || (p.length === 1 && p[0] === 'resource')){ return only(get, 'ResourceRead', 'GET'); }
	if(p.length === 1 && p[0] === 'prompts'){ return only(get, 'PromptsList', 'GET'); }
	if(p.length === 2 && p[0] === 'prompts'){ return only(post, 'PromptGet', 'POST', { name: p[1] }); }
	if(p.length === 1){
		const hit = GET_ALIASES.find(([a])=>a === p[0]);
		if(hit){ return only(get, 'Alias', 'GET', { name: hit[1] }); }
	}
	return { kind: 'NotFound' };
}

// 查询串:百分号解码、+ 为空格、同名取最后一个;值一律字符串(页面校验器按参数结构转型)
function parseQuery(q){
	const out = {};
	for(const pair of `${q || ''}`.split('&')){
		if(!pair){ continue; }
		const i = pair.indexOf('=');
		const k = i >= 0 ? pair.slice(0, i) : pair;
		const v = i >= 0 ? pair.slice(i + 1) : '';
		const dec = (s)=>{ try{ return decodeURIComponent(s.replace(/\+/g, ' ')); }catch(e){ return s; } };
		const key = dec(k);
		if(!key){ continue; }
		out[key] = dec(v);
	}
	return out;
}

function rpcErrorStatus(code){
	switch(code){
	case ERR.INVALID_PARAMS: return 400;
	case ERR.METHOD_NOT_FOUND: return 404;
	case ERR.RATE_LIMITED: return 429;
	case ERR.TIMEOUT: return 504;
	case ERR.NOT_READY: case ERR.RELOADED: return 503;
	case ERR.CANCELLED: return 409;
	case ERR.INTERNAL: return 500;
	default: return 502;
	}
}

// JSON-RPC 数字码 → REST 字符串码(error.code 一律字符串,原数字码另放 error.rpcCode;与桌面壳 rpc_error_name 同一张表)
const RPC_ERROR_NAMES = [
	[ERR.PARSE, 'BAD_JSON'], [ERR.INVALID_REQUEST, 'BAD_REQUEST'], [ERR.METHOD_NOT_FOUND, 'NOT_FOUND'], [ERR.INVALID_PARAMS, 'INVALID_PARAMS'],
	[ERR.INTERNAL, 'INTERNAL'], [ERR.NOT_READY, 'NOT_READY'], [ERR.TIMEOUT, 'TIMEOUT'], [ERR.RELOADED, 'RELOADED'], [ERR.RATE_LIMITED, 'RATE_LIMITED'], [ERR.CANCELLED, 'CANCELLED'],
];
function rpcErrorName(code){
	const hit = RPC_ERROR_NAMES.find(([c])=>c === code);
	return hit ? hit[1] : 'UPSTREAM';
}
// 保留查询键(不当工具参数):text=0 = 有结构化结果时不再附正文;stream=1 = 事件流
const RESERVED_QUERY_KEYS = ['text', 'stream'];
// 每次调用的超时预算请求头(毫秒;与 MCP _meta.timeoutMs 同义,协议层夹到 1000..1800000;不带 = 按工具声明的预算,没声明的 120000)
const TIMEOUT_HEADER = 'X-Horosa-Timeout-Ms';

// 工具结果({content, structuredContent?, isError})→ REST 形态 { ok, text, data?, error? }。
//   opts.dropText:成功且有 data 时不带 text(?text=0;失败总带正文,错误说明在里面)
// 工具层失败 = 422;两类例外按 HTTP 惯例给码:外部调用 / 写入超限(E_LIMIT 且可重试)= 429(带 Retry-After),工具超时(E_TOOL_TIMEOUT)= 504。与桌面壳 rest_api.rs 同一口径
function toolResultBody(result, opts){
	const isError = !!(result && result.isError);
	const text = ((result && result.content) || []).filter((x)=>x && typeof x.text === 'string').map((x)=>x.text).join('\n');
	const body = { ok: !isError, text };
	let status = isError ? 422 : 200;
	if(result && result.structuredContent !== undefined && result.structuredContent !== null){ body.data = result.structuredContent; }
	if(!isError && opts && opts.dropText && body.data !== undefined){ delete body.text; }
	if(isError){
		try{
			const e = JSON.parse(text);
			if(e && typeof e.code === 'string'){
				const retryable = e.retryable === true;
				body.error = { code: e.code, message: e.message === undefined ? null : e.message, retryable };
				if(typeof e.hint === 'string'){ body.error.hint = e.hint; }
				if(Number.isInteger(e.retryAfterMs) && e.retryAfterMs >= 0){ body.error.retryAfterMs = e.retryAfterMs; }
				if(e.code === 'E_LIMIT' && retryable){ status = 429; }else if(e.code === 'E_TOOL_TIMEOUT'){ status = 504; }
			}
			// 失败的结构化数据(候选 / 可用项)只在正文 JSON 里(结构化结果只给成功)
			if(body.data === undefined && e && e.data && typeof e.data === 'object'){ body.data = e.data; }
		}catch(err){ /* 正文不是 JSON:只留正文 */ }
	}
	return [status, body];
}

function errorBody(status, code, message){ return [status, { ok: false, error: { code, message } }]; }

// OpenAPI 3.1(由工具目录现生成;错误体结构 + 全部错误状态码 + GET 简写参数由工具 schema 生成 + 幂等键只挂写入类 + 超时请求头)
const ERROR_RESPONSES = [
	['400', '参数 / 请求体不合规(error.code:INVALID_PARAMS / BAD_JSON / BAD_REQUEST)'],
	['401', '令牌缺失或不对(Authorization: Bearer <令牌>)'],
	['404', '没有这个接口 / 资源 / 提示(error.code:NOT_FOUND)'],
	['405', '方法不对(看 Allow 响应头)'],
	['409', '请求被取消(error.code:CANCELLED)'],
	['413', '请求体过大(error.code:PAYLOAD_TOO_LARGE)'],
	['422', '工具执行失败(error.code 见错误码表,error.retryable / error.hint 说明能否重试、下一步做什么)'],
	['429', '超出调用 / 写入上限(看 Retry-After 响应头与 error.retryAfterMs)'],
	['500', '服务内部错误(error.code:INTERNAL)'],
	['503', '页面未就绪 / 服务重启中(error.code:NOT_READY / RELOADED;看 error.data.retryAfterMs)'],
	['504', '工具执行超时(error.code:TIMEOUT / E_TOOL_TIMEOUT;缩小范围或加大 X-Horosa-Timeout-Ms 后再试)'],
];
const ERROR_DETAIL_SCHEMA = { type: 'object', required: ['code'], properties: {
	code: { type: 'string', description: '工具错误码(E_*)或 REST 码(INVALID_PARAMS / NOT_FOUND / …)' }, message: { type: ['string', 'null'] }, retryable: { type: 'boolean' }, hint: { type: 'string' }, retryAfterMs: { type: 'integer' },
	rpcCode: { type: 'integer', description: '协议层原数字码(-326xx / -320xx),只在协议层错误时有' }, data: { type: 'object' } } };
const ERROR_SCHEMA = { type: 'object', required: ['ok', 'error'], properties: { ok: { type: 'boolean', const: false }, text: { type: 'string' }, data: { type: 'object' }, error: { $ref: '#/components/schemas/ErrorDetail' } } };
function errorResponses(skip){
	const out = {};
	ERROR_RESPONSES.forEach(([code, description])=>{ if(!skip || skip.indexOf(code) < 0){ out[code] = { description, content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } }; } });
	return out;
}
// GET 简写的查询参数:取工具 inputSchema 的顶层属性(值一律按字符串传,服务端按参数结构转型)
function queryParamsOf(inputSchema){
	const props = inputSchema && inputSchema.properties && typeof inputSchema.properties === 'object' ? inputSchema.properties : {};
	const req = Array.isArray(inputSchema && inputSchema.required) ? inputSchema.required : [];
	return Object.keys(props).map((k)=>({ name: k, in: 'query', required: req.indexOf(k) >= 0, schema: props[k], ...(typeof props[k].description === 'string' ? { description: props[k].description } : {}) }));
}
const TEXT_PARAM = { name: 'text', in: 'query', required: false, schema: { type: 'string', enum: ['0'] }, description: '0 = 成功且有 data 时不再附 text(正文与 data 是同一份结果的两种写法)' };
const TIMEOUT_PARAM = { name: TIMEOUT_HEADER, in: 'header', required: false, schema: { type: 'integer', minimum: 1000, maximum: 1800000 }, description: '本次调用的超时预算(毫秒;缺省按工具声明,没声明的 120000)' };

function openApiDoc(tools, version){
	const paths = {};
	const resultSchema = (output)=>({ type: 'object', required: ['ok'], properties: { ok: { type: 'boolean' }, text: { type: 'string' }, error: { $ref: '#/components/schemas/ErrorDetail' }, data: output || { type: 'object' } } });
	const byName = {};
	paths['/tools'] = { get: { operationId: 'listTools', summary: '列出全部工具(与 MCP tools/list 同一份)', responses: { 200: { description: '工具清单' }, ...errorResponses(['400', '404', '409', '413', '422', '429', '504']) } } };
	for(const t of tools || []){
		if(!t || typeof t.name !== 'string'){ continue; }
		byName[t.name] = t;
		const parameters = [
			{ name: 'stream', in: 'query', required: false, schema: { type: 'string', enum: ['1'] }, description: '1 = 以 text/event-stream 回报进度(event: progress)与结果(event: result)' },
			TEXT_PARAM, TIMEOUT_PARAM,
		];
		// 幂等键只对写入类有意义(读类重复调用本来就不改任何东西)
		if(t.level === 'additive'){ parameters.push({ name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string', maxLength: 200 }, description: '写入类:同一个键重试回放第一次的结果、不重复写(同键换参数被拒;1..200 字,超长 = 400)' }); }
		paths[`/tools/${t.name}`] = { post: {
			operationId: t.name, summary: typeof t.title === 'string' ? t.title : t.name, description: typeof t.description === 'string' ? t.description : '',
			parameters,
			requestBody: { required: false, content: { 'application/json': { schema: t.inputSchema || { type: 'object' } } } },
			responses: { 200: { description: '工具成功', content: { 'application/json': { schema: resultSchema(t.outputSchema) } } }, ...errorResponses() },
		} };
	}
	for(const [alias, tool] of GET_ALIASES){
		const t = byName[tool];
		paths[`/${alias}`] = { get: {
			operationId: `get_${alias}`, summary: `${tool} 的 GET 别名(查询串 = 参数)`,
			parameters: queryParamsOf(t && t.inputSchema).concat([TEXT_PARAM, TIMEOUT_PARAM]),
			responses: { 200: { description: `同 POST /tools/${tool}`, content: { 'application/json': { schema: resultSchema(t && t.outputSchema) } } }, ...errorResponses(['413']) },
		} };
	}
	const listErr = errorResponses(['409', '413', '422', '429', '504']);
	paths['/resources'] = { get: { operationId: 'listResources', parameters: [{ name: 'cursor', in: 'query', required: false, schema: { type: 'string' } }], responses: { 200: { description: '资源清单(nextCursor 翻页)' }, ...listErr } } };
	paths['/resources/templates'] = { get: { operationId: 'listResourceTemplates', responses: { 200: { description: '资源模版' }, ...listErr } } };
	paths['/resources/read'] = { get: { operationId: 'readResource', parameters: [{ name: 'uri', in: 'query', required: true, schema: { type: 'string' } }], responses: { 200: { description: '资源正文' }, ...listErr } } };
	paths['/prompts'] = { get: { operationId: 'listPrompts', parameters: [{ name: 'cursor', in: 'query', required: false, schema: { type: 'string' } }], responses: { 200: { description: '提示清单' }, ...listErr } } };
	paths['/prompts/{name}'] = { post: { operationId: 'getPrompt', parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: false, content: { 'application/json': { schema: { type: 'object' } } } }, responses: { 200: { description: '提示消息' }, ...errorResponses(['409', '422', '429', '504']) } } };
	return {
		openapi: '3.1.0',
		info: { title: '星阙 Horosa 本机接口', version: `${version || 'dev'}`, description: '与本机 MCP 同一服务、同一令牌(Authorization: Bearer)、同一套工具;只接受本机回环地址。写入类工具受「外部客户端策略」管(审批 / 上限)。' },
		servers: [{ url: REST_PREFIX }],
		security: [{ bearer: [] }],
		components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } }, schemas: { Error: ERROR_SCHEMA, ErrorDetail: ERROR_DETAIL_SCHEMA } },
		paths,
	};
}

module.exports = { REST_PREFIX, REST_CLIENT_NAME, GET_ALIASES, RPC_ERROR_NAMES, RESERVED_QUERY_KEYS, TIMEOUT_HEADER, ERROR_RESPONSES, route, parseQuery, rpcErrorStatus, rpcErrorName, toolResultBody, errorBody, openApiDoc };
