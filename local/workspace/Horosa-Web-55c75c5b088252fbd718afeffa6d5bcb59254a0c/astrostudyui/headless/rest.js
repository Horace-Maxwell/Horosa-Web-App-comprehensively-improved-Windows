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

// 工具结果({content, structuredContent?, isError})→ REST 形态 { ok, text, data?, error? };工具层失败 = 422
function toolResultBody(result){
	const isError = !!(result && result.isError);
	const text = ((result && result.content) || []).filter((x)=>x && typeof x.text === 'string').map((x)=>x.text).join('\n');
	const body = { ok: !isError, text };
	if(result && result.structuredContent !== undefined && result.structuredContent !== null){ body.data = result.structuredContent; }
	if(isError){
		try{
			const e = JSON.parse(text);
			if(e && typeof e.code === 'string'){ body.error = { code: e.code, message: e.message === undefined ? null : e.message, retryable: e.retryable === undefined ? false : e.retryable }; }
			// 失败的结构化数据(候选 / 可用项)只在正文 JSON 里(结构化结果只给成功)
			if(body.data === undefined && e && e.data && typeof e.data === 'object'){ body.data = e.data; }
		}catch(err){ /* 正文不是 JSON:只留正文 */ }
	}
	return [isError ? 422 : 200, body];
}

function errorBody(status, code, message){ return [status, { ok: false, error: { code, message } }]; }

function openApiDoc(tools, version){
	const paths = {};
	const resultSchema = (output)=>({ type: 'object', required: ['ok'], properties: { ok: { type: 'boolean' }, text: { type: 'string' }, error: { type: 'object' }, data: output || { type: 'object' } } });
	paths['/tools'] = { get: { operationId: 'listTools', summary: '列出全部工具(与 MCP tools/list 同一份)', responses: { 200: { description: '工具清单' } } } };
	for(const t of tools || []){
		if(!t || typeof t.name !== 'string'){ continue; }
		paths[`/tools/${t.name}`] = { post: {
			operationId: t.name, summary: typeof t.title === 'string' ? t.title : t.name, description: typeof t.description === 'string' ? t.description : '',
			parameters: [
				{ name: 'stream', in: 'query', required: false, schema: { type: 'string', enum: ['1'] }, description: '1 = 以 text/event-stream 回报进度(event: progress)与结果(event: result)' },
				{ name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string', maxLength: 200 }, description: '写入类:同一个键重试回放第一次的结果、不重复写(同键换参数被拒;1..200 字,超长 = 400)' },
			],
			requestBody: { required: false, content: { 'application/json': { schema: t.inputSchema || { type: 'object' } } } },
			responses: {
				200: { description: '工具成功', content: { 'application/json': { schema: resultSchema(t.outputSchema) } } },
				422: { description: '工具失败(error.code 见错误码表)', content: { 'application/json': { schema: resultSchema(null) } } },
				429: { description: '超出调用上限' }, 503: { description: '页面未就绪 / 服务重启中(看 error.data.retryAfterMs)' },
			},
		} };
	}
	for(const [alias, tool] of GET_ALIASES){
		paths[`/${alias}`] = { get: { operationId: `get_${alias}`, summary: `${tool} 的 GET 别名(查询串 = 参数)`, responses: { 200: { description: `同 POST /tools/{tool}` } } } };
	}
	paths['/resources'] = { get: { operationId: 'listResources', parameters: [{ name: 'cursor', in: 'query', required: false, schema: { type: 'string' } }], responses: { 200: { description: '资源清单(nextCursor 翻页)' } } } };
	paths['/resources/templates'] = { get: { operationId: 'listResourceTemplates', responses: { 200: { description: '资源模版' } } } };
	paths['/resources/read'] = { get: { operationId: 'readResource', parameters: [{ name: 'uri', in: 'query', required: true, schema: { type: 'string' } }], responses: { 200: { description: '资源正文' } } } };
	paths['/prompts'] = { get: { operationId: 'listPrompts', parameters: [{ name: 'cursor', in: 'query', required: false, schema: { type: 'string' } }], responses: { 200: { description: '提示清单' } } } };
	paths['/prompts/{name}'] = { post: { operationId: 'getPrompt', parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: false, content: { 'application/json': { schema: { type: 'object' } } } }, responses: { 200: { description: '提示消息' } } } };
	return {
		openapi: '3.1.0',
		info: { title: '星阙 Horosa 本机接口', version: `${version || 'dev'}`, description: '与本机 MCP 同一服务、同一令牌(Authorization: Bearer)、同一套工具;只接受本机回环地址。写入类工具受「外部客户端策略」管(审批 / 上限)。' },
		servers: [{ url: REST_PREFIX }],
		security: [{ bearer: [] }],
		components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } } },
		paths,
	};
}

module.exports = { REST_PREFIX, REST_CLIENT_NAME, GET_ALIASES, route, parseQuery, rpcErrorStatus, toolResultBody, errorBody, openApiDoc };
