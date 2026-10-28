// 无头 MCP 协议层(JSON-RPC 2.0;stdio 与 HTTP 共用):方法集、工具名规则与对外投影、握手说明与桌面壳同义
// (Horosa_Desktop_Installer/src-tauri/src/mcp_server.rs 的握手纪元;合同测试逐项对拍两边的常量)。
// 内容一律来自运行时 dispatch(与壳 → 页面桥同一入口),本层只做协议:校验、投影、进度通知、错误码。
'use strict';

const PROTOCOL_VERSIONS = ['2024-11-05', '2025-03-26', '2025-06-18', '2025-11-25'];
const LATEST_PROTOCOL = '2025-11-25';
const ERR = Object.freeze({
	PARSE: -32700, INVALID_REQUEST: -32600, METHOD_NOT_FOUND: -32601, INVALID_PARAMS: -32602, INTERNAL: -32603,
	NOT_READY: -32001, TIMEOUT: -32002, RELOADED: -32003, RATE_LIMITED: -32004, CANCELLED: -32800,
});
const INSTRUCTIONS = '星阙(Horosa)本机工具:只读或只增——永不删除档案、不覆盖已有命盘/事盘;改设置在内的一切写入都记入应用内账本、可由用户撤销。长文本用 maxChars 限制并分页读取。仅在用户明确要求时调用写入类工具。写入类调用可在 _meta.idempotencyKey 带一个幂等键(1..200 字):同键重试回放第一次的结果、不重复写。';
const HEADLESS_NOTE = '(无头模式:不需要桌面 App;没有界面类工具;档案与设置存在本机数据目录。)';
// 工具名:小写字母开头、只含小写 / 数字 / 下划线、≤48;外部接入工具(ext_)永不再导出;名字里带这些词的一律不放行(与壳同表)
const DENIED_NAME_WORDS = ['delete', 'remove', 'purge', 'clear', 'reset', 'overwrite', 'update', 'rename', 'import', 'export', 'restore', 'undo'];
const DEFAULT_TIMEOUT_MS = 120000;

function toolNameOk(name){
	if(typeof name !== 'string' || !name || name.length > 48 || name.startsWith('ext_')){ return false; }
	if(!/^[a-z][a-z0-9_]*$/.test(name)){ return false; }
	return !DENIED_NAME_WORDS.some((w)=>name.indexOf(w) >= 0);
}

function filterTools(tools){
	return (tools || []).filter((t)=>t && toolNameOk(t.name) && (t.level === 'read' || t.level === 'additive'));
}

// 对外投影:规范字段原样透传,内部字段(level / category / origin)不出
function projectTool(t){
	const out = { name: t.name };
	if(typeof t.title === 'string'){ out.title = t.title; }
	out.description = t.description === undefined ? null : t.description;
	out.inputSchema = t.inputSchema && typeof t.inputSchema === 'object' ? t.inputSchema : { type: 'object' };
	if(t.outputSchema && typeof t.outputSchema === 'object'){ out.outputSchema = t.outputSchema; }
	out.annotations = t.annotations && typeof t.annotations === 'object' ? t.annotations : {};
	if(Array.isArray(t.icons)){ out.icons = t.icons; }
	if(t._meta && typeof t._meta === 'object'){ out._meta = t._meta; }
	return out;
}

// 幂等键:_meta.idempotencyKey 或 _meta['io.horosa/idempotencyKey'](与桌面壳桥同义)。口径与页面注册表
// (src/utils/aiTools/idempotencyKey.js)、桌面壳同一份:去首尾空白;空 = 没带键;按 Unicode 码点计、上限 200;
// 超长 / 不是字符串 → 参数错(不静默丢:静默丢 = 调用方以为受了保护,重试照样重复写)。共用用例表 __tests__/fixtures/idempotencyKeyCases.tsv
const IDEMPOTENCY_KEY_MAX = 200;
function idempotencyKeyCheck(params){
	const m = params && params._meta && typeof params._meta === 'object' ? params._meta : {};
	const raw = m.idempotencyKey !== undefined ? m.idempotencyKey : m['io.horosa/idempotencyKey'];
	if(raw === undefined || raw === null){ return { key: '' }; }
	if(typeof raw !== 'string'){ return { key: '', error: 'not-string' }; }
	const k = raw.trim();
	if(!k){ return { key: '' }; }
	if(Array.from(k).length > IDEMPOTENCY_KEY_MAX){ return { key: '', error: 'too-long' }; }
	return { key: k };
}
function idempotencyKeyOf(params){ return idempotencyKeyCheck(params).key; }
const IDEMPOTENCY_KEY_ERROR = `idempotency key must be a string of 1..${IDEMPOTENCY_KEY_MAX} characters`;

// 客户端身份(单一来源;桌面壳 mcp_server.rs 的 client_identity_of 同一规则,共用用例表 __tests__/fixtures/clientIdentityCases.tsv):
//   _meta.clientName → _meta['io.modelcontextprotocol/clientInfo'].name → 本会话 initialize 报的 clientInfo.name → 传输层缺省。
//   只认非空字符串(去首尾空白),按码点截 64。幂等槽 / 审批键 / 来源标签都按它:同一客户端经代理转发、原服务退出后
//   由本会话接管,前后同一个名字(此前代理转发时记成 http、接管后记成自报名 → 同键重试换了槽位,照样重复写)。
const META_CLIENT_INFO = 'io.modelcontextprotocol/clientInfo';
const CLIENT_NAME_MAX = 64;
function clientNameNorm(v){
	if(typeof v !== 'string'){ return ''; }
	const t = v.trim();
	return t ? Array.from(t).slice(0, CLIENT_NAME_MAX).join('') : '';
}
function clientIdentityOf(params, sessionClient, transportDefault){
	const m = params && params._meta && typeof params._meta === 'object' ? params._meta : {};
	const info = m[META_CLIENT_INFO] && typeof m[META_CLIENT_INFO] === 'object' ? m[META_CLIENT_INFO] : {};
	return clientNameNorm(m.clientName) || clientNameNorm(info.name) || clientNameNorm(sessionClient) || clientNameNorm(transportDefault) || null;
}
// initialize 里客户端自报的名字(传输层按会话记住,之后每条请求的身份缺省取它)
function initializeClientName(msg){
	const p = msg && msg.method === 'initialize' && msg.params && typeof msg.params === 'object' ? msg.params : null;
	return p && p.clientInfo && typeof p.clientInfo === 'object' ? clientNameNorm(p.clientInfo.name) : '';
}

function timeoutOf(params){
	const ms = Number(params && params._meta && params._meta.timeoutMs);
	if(!Number.isFinite(ms) || ms <= 0){ return DEFAULT_TIMEOUT_MS; }
	return Math.max(1000, Math.min(600000, Math.round(ms)));
}

const errorOf = (id, code, message, data)=>({ jsonrpc: '2.0', id: id === undefined ? null : id, error: data === undefined ? { code, message } : { code, message, data } });
const resultOf = (id, result)=>({ jsonrpc: '2.0', id, result });

function pageError(id, r){
	const e = (r && r.error) || {};
	return errorOf(id, Number.isFinite(Number(e.code)) ? Number(e.code) : ERR.INTERNAL, `${e.message || 'error'}`, e.data);
}

// 一条消息 → 一条回包(通知回 null)。opts:{ rt, clientName(传输层缺省名), sessionClient(本会话 initialize 报的名字),
//   sessionId(传输层的会话身份:限流按它分桶), version, signal, onNotification(msg) }
async function handleMessage(msg, opts){
	const o = opts || {};
	if(Array.isArray(msg)){ return errorOf(null, ERR.INVALID_REQUEST, 'batch requests are not supported'); }
	if(!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string'){
		return errorOf(msg && msg.id, ERR.INVALID_REQUEST, 'invalid request');
	}
	const isNotification = !Object.prototype.hasOwnProperty.call(msg, 'id');
	const id = msg.id;
	const method = msg.method;
	const params = msg.params && typeof msg.params === 'object' ? msg.params : {};
	if(isNotification){ return null; }   // notifications/initialized、notifications/cancelled 由传输层处理
	const clientName = clientIdentityOf(params, o.sessionClient, o.clientName) || 'external';
	const rt = o.rt;
	try{
		switch(method){
		case 'initialize': {
			const requested = typeof params.protocolVersion === 'string' ? params.protocolVersion : '';
			return resultOf(id, {
				protocolVersion: PROTOCOL_VERSIONS.indexOf(requested) >= 0 ? requested : LATEST_PROTOCOL,
				capabilities: { tools: { listChanged: false }, resources: { subscribe: false, listChanged: false }, prompts: { listChanged: false }, completions: {}, logging: {} },
				serverInfo: { name: 'horosa', version: `${o.version || 'dev'}` },
				instructions: `${INSTRUCTIONS}${HEADLESS_NOTE}`,
			});
		}
		case 'ping':
		case 'logging/setLevel':
			return resultOf(id, {});
		case 'tools/list': {
			const r = await rt.dispatch('tools/list', {}, { clientName, sessionId: o.sessionId });
			if(!r || !r.ok){ return pageError(id, r); }
			return resultOf(id, { tools: filterTools(r.result && r.result.tools).map(projectTool) });
		}
		case 'tools/call': {
			const name = params.name;
			if(!toolNameOk(name)){ return errorOf(id, ERR.INVALID_PARAMS, 'invalid tool name'); }
			const args = params.arguments === undefined ? {} : params.arguments;
			if(!args || typeof args !== 'object' || Array.isArray(args)){ return errorOf(id, ERR.INVALID_PARAMS, 'arguments must be an object'); }
			if(o.signal && o.signal.aborted){ return errorOf(id, ERR.CANCELLED, 'request cancelled'); }
			const token = params._meta && (typeof params._meta.progressToken === 'string' || Number.isFinite(params._meta.progressToken)) ? params._meta.progressToken : null;
			const progress = token !== null && typeof o.onNotification === 'function'
				? (p)=>o.onNotification({ jsonrpc: '2.0', method: 'notifications/progress', params: { progressToken: token, ...p } })
				: undefined;
			const timeoutMs = timeoutOf(params);
			const idem = idempotencyKeyCheck(params);
			if(idem.error){ return errorOf(id, ERR.INVALID_PARAMS, IDEMPOTENCY_KEY_ERROR); }
			// 转给页面工具层的 _meta 只带它认的键:超时预算 + 幂等键(同键重试不重复写;此前这里重建 _meta 把幂等键丢了 →
			//   无头的 MCP / REST / 终端命令三个入口带了键也照样重复写)。
			// 超时预算投原值(与桌面壳同口径):页面桥 bridgeTimeoutMs 自己留 3 秒收口余量,这里再减 = 无头工具比桌面少 3 秒
			const meta = { timeoutMs };
			if(idem.key){ meta.idempotencyKey = idem.key; }
			const r = await rt.dispatch('tools/call', { name, arguments: args, _meta: meta }, { clientName, sessionId: o.sessionId, signal: o.signal, progress });
			if(o.signal && o.signal.aborted){ return errorOf(id, ERR.CANCELLED, 'request cancelled'); }
			if(!r || !r.ok){ return pageError(id, r); }
			if(!r.result || !Array.isArray(r.result.content)){ return errorOf(id, ERR.INTERNAL, 'tool result malformed'); }
			const out = { content: r.result.content, isError: !!r.result.isError };
			if(r.result.structuredContent !== undefined && r.result.structuredContent !== null){ out.structuredContent = r.result.structuredContent; }
			return resultOf(id, out);
		}
		case 'resources/list':
		case 'resources/templates/list':
		case 'resources/read':
		case 'prompts/list':
		case 'prompts/get':
		case 'completion/complete': {
			const r = await rt.dispatch(method, params, { clientName, sessionId: o.sessionId });
			if(!r || !r.ok){ return pageError(id, r); }
			return resultOf(id, r.result);
		}
		default:
			return errorOf(id, ERR.METHOD_NOT_FOUND, `method not found: ${method}`);
		}
	}catch(e){
		return errorOf(id, ERR.INTERNAL, e && e.message ? `${e.message}` : `${e}`);
	}
}

module.exports = { PROTOCOL_VERSIONS, LATEST_PROTOCOL, ERR, INSTRUCTIONS, HEADLESS_NOTE, DENIED_NAME_WORDS, toolNameOk, filterTools, projectTool, handleMessage, errorOf, timeoutOf, idempotencyKeyOf, idempotencyKeyCheck, IDEMPOTENCY_KEY_MAX, IDEMPOTENCY_KEY_ERROR, clientIdentityOf, initializeClientName, META_CLIENT_INFO, CLIENT_NAME_MAX };
