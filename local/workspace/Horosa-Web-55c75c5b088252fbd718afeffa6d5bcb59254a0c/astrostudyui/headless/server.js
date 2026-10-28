// 无头本机服务:一个端口同时提供 MCP(POST /mcp,JSON-RPC;要进度时回事件流)、REST(/api/v1)、健康探针(/healthz)
// 与终端人工命令用的管理口(/admin:设置、模型配置、提案采纳、导入导出)。门与桌面壳同一道:Host 必须回环 → Origin 有则必须回环 → Bearer 令牌(常量时间比对)
// → MCP 协议版本头(有则必须认得)。端点文件(地址 + 令牌,0600)写在数据目录,终端命令与外部客户端据此连接;退出即删。
// 管理口用**另一枚**令牌(admin-token,0600,不进端点文件):拿到接口令牌的客户端改不了设置、采纳不了提案(那些只能由人来做)。
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { createRuntime, headlessDir, writeAtomic } = require('./runtime');
const protocol = require('./protocol');
const rest = require('./rest');

const DEFAULT_PORT = 39981;
const PORT_SPAN = 9;
const MAX_BODY_BYTES = 1 << 20;
const MAX_DRAIN_BYTES = 64 << 20;   // 超限请求体照读照丢到这个量(好回 413);再大就直接断开
const KEEPALIVE_MS = 10000;

function baseVersion(){
	const candidates = [
		path.resolve(__dirname, '../../../Horosa_Desktop_Installer/src-tauri/tauri.conf.json'),
		path.resolve(__dirname, '../package.json'),
	];
	for(const f of candidates){
		try{ const v = JSON.parse(fs.readFileSync(f, 'utf8')).version; if(v){ return `${v}`; } }catch(e){ /* 下一个 */ }
	}
	return 'dev';
}
// 源码检出里 HEAD 不在 v<版本号> 标签上 = 比该版本新(或开发中途):如实标「+unreleased」,外部客户端(serverInfo)与终端(--version / status)都看得到。
//   不在 git 检出里(发版包 / 源码压缩包)按发版算;git 不可用 / 超时同样按发版算(不因探测失败误报)。结果按进程缓存。
let _versionCache = null;
function isReleasedCheckout(v, opts){
	const o = opts || {};
	const root = o.root || path.resolve(__dirname, '../../..');
	if(!fs.existsSync(path.join(root, '.git'))){ return true; }
	try{
		const r = (o.spawnSync || require('child_process').spawnSync)('git', ['-C', root, 'tag', '--points-at', 'HEAD'], { encoding: 'utf8', timeout: 3000 });
		if(!r || r.status !== 0 || r.error){ return true; }
		return `${r.stdout || ''}`.split(/\r?\n/).map((s)=>s.trim()).includes(`v${v}`);
	}catch(e){
		return true;
	}
}
function appVersion(opts){
	if(!opts && _versionCache !== null){ return _versionCache; }
	const v = (opts && opts.base) || baseVersion();
	const out = v === 'dev' || isReleasedCheckout(v, opts) ? v : `${v}+unreleased`;
	if(!opts){ _versionCache = out; }
	return out;
}

function endpointFile(){ return path.join(headlessDir(), 'endpoint.json'); }
function adminTokenFile(){ return path.join(headlessDir(), 'admin-token'); }

function constantTimeEq(a, b){
	const x = Buffer.from(`${a}`);
	const y = Buffer.from(`${b}`);
	return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function isLoopbackAuthority(authority){
	const a = `${authority || ''}`.trim().toLowerCase();
	const host = a.startsWith('[') ? a.slice(0, a.indexOf(']') + 1) : a.split(':')[0];
	return host === '127.0.0.1' || host === 'localhost' || host === '[::1]';
}
function originAllowed(origin){
	if(origin === undefined){ return true; }
	const o = `${origin}`.trim().toLowerCase();
	const m = /^https?:\/\/(.+)$/.exec(o);
	return !!m && isLoopbackAuthority(m[1]);
}

// 门:回 null = 放行;否则 [状态, 说明]
function gate(req, token, checkProtocol){
	if(req.headers.host !== undefined && !isLoopbackAuthority(req.headers.host)){ return [403, 'forbidden host']; }
	if(!originAllowed(req.headers.origin)){ return [403, 'forbidden origin']; }
	const m = /^bearer\s+(.+)$/i.exec(`${req.headers.authorization || ''}`.trim());
	if(!m || !constantTimeEq(m[1].trim(), token)){ return [401, 'missing or invalid bearer token']; }
	const pv = req.headers['mcp-protocol-version'];
	if(checkProtocol && pv !== undefined && protocol.PROTOCOL_VERSIONS.indexOf(`${pv}`.trim()) < 0){ return [400, 'unsupported MCP-Protocol-Version']; }
	return null;
}

function sendJson(res, status, body, headers){
	if(res.headersSent){ return; }
	const text = JSON.stringify(body);
	res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(text), ...(headers || {}) });
	res.end(text);
}
function sendPlain(res, status, text, headers){
	if(res.headersSent){ return; }
	res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...(headers || {}) });
	res.end(`${text}`);
}

// 超限:不再收集、但把余下的读完丢掉,读完再回 413(先断连接 = 客户端只看到 ECONNRESET,拿不到 413);
// 丢到 MAX_DRAIN_BYTES 还没完 → 断开
function readBody(req){
	return new Promise((resolve, reject)=>{
		let size = 0;
		let tooLarge = false;
		const chunks = [];
		req.on('data', (c)=>{
			size += c.length;
			if(tooLarge){ if(size > MAX_DRAIN_BYTES){ req.destroy(); } return; }
			if(size > MAX_BODY_BYTES){ tooLarge = true; chunks.length = 0; return; }
			chunks.push(c);
		});
		req.on('end', ()=>(tooLarge ? reject(Object.assign(new Error('payload too large'), { status: 413 })) : resolve(Buffer.concat(chunks).toString('utf8'))));
		req.on('error', reject);
	});
}

// 事件流:每帧 flush;断开 = 取消(与桌面现代纪元同法)
function openSse(req, res, ac, extraHeaders){
	res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive', ...(extraHeaders || {}) });
	let done = false;
	const timer = setInterval(()=>{ if(!done){ res.write(': keep-alive\n\n'); } }, KEEPALIVE_MS);
	res.on('close', ()=>{ if(!done){ done = true; clearInterval(timer); try{ ac.abort(); }catch(e){ /* noop */ } } });
	return {
		event(name, payload){ if(!done){ res.write(`event: ${name}\ndata: ${JSON.stringify(payload)}\n\n`); } },
		end(){ if(!done){ done = true; clearInterval(timer); res.end(); } },
	};
}

async function startServer(opts){
	const o = opts || {};
	const rt = o.rt || await createRuntime(o);
	const version = appVersion();
	const token = o.token || crypto.randomBytes(32).toString('base64url');
	const adminToken = o.adminToken || crypto.randomBytes(32).toString('base64url');
	const restEnabled = o.rest !== false;
	// 谁托管这个端点:serve(./horosa start / serve 起的常驻服务)或 mcp(某个 MCP 客户端拉起的 stdio 会话顺带挂的)。
	// ./horosa stop 只停 serve;mcp 托管的要由那个客户端关会话来停(停了它 = 掐断用户正在用的 AI 会话)
	const role = o.role === 'mcp' ? 'mcp' : 'serve';
	// 在途请求:(会话, 请求 id)→ AbortController(notifications/cancelled 命中即中止)。
	// 会话 = 握手时发给客户端的 Mcp-Session-Id(客户端之后每条都带);不带的老客户端共用空会话。
	// 不同会话各自从 1 编号也不会互相取消 / 互相摘掉在途表项。
	const inflight = new Map();
	let seq = 1;
	const key = (req, id)=>`${`${req.headers['mcp-session-id'] || ''}`.slice(0, 128)}|${JSON.stringify(id)}`;

	async function rpc(method, params, signal, onNotification, clientName){
		return protocol.handleMessage({ jsonrpc: '2.0', id: `rest-${seq++}`, method, params: params || {} }, { rt, clientName: clientName || rest.REST_CLIENT_NAME, sessionId: 'rest', version, signal, onNotification });
	}
	// MCP over HTTP 的限流桶按会话身份分(握手发的 Mcp-Session-Id;不带的老客户端共用一个)—— 与桌面壳按会话分桶同义
	const mcpSessionOf = (req)=>`mcp:${`${req.headers['mcp-session-id'] || ''}`.slice(0, 128)}`;
	// 会话 → 握手时客户端报的 clientInfo.name(规范里 clientInfo 只在 initialize 报一次;之后每条请求的身份缺省取它)。
	// 身份规则单源在 protocol.clientIdentityOf;不带会话头的老客户端退回传输层缺省 http。有界:最多记 256 个会话
	const SESSION_CLIENTS_MAX = 256;
	const sessionClients = new Map();
	const rememberSessionClient = (sid, name)=>{
		if(!sid || !name){ return; }
		sessionClients.delete(sid);
		sessionClients.set(sid, name);
		while(sessionClients.size > SESSION_CLIENTS_MAX){ sessionClients.delete(sessionClients.keys().next().value); }
	};
	const sessionClientOf = (req)=>{ const sid = `${req.headers['mcp-session-id'] || ''}`.slice(0, 128); return sid ? (sessionClients.get(sid) || '') : ''; };
	const rpcFail = (r)=>{
		const code = r.error.code;
		const body = { ok: false, error: { code, message: r.error.message } };
		if(r.error.data !== undefined){ body.error.data = r.error.data; }
		return [rest.rpcErrorStatus(code), body];
	};
	function respondRest(res, status, body){
		const headers = {};
		if(status === 401){ headers['WWW-Authenticate'] = 'Bearer realm="horosa"'; }
		if(status === 503){
			const ms = Number(body && body.error && body.error.data && body.error.data.retryAfterMs);
			headers['Retry-After'] = `${Number.isFinite(ms) ? Math.max(1, Math.ceil(ms / 1000)) : 1}`;
		}
		sendJson(res, status, body, headers);
	}

	async function handleMcp(req, res){
		const g = gate(req, token, true);
		if(g){ return sendPlain(res, g[0], g[1]); }
		if(req.method !== 'POST'){ return sendPlain(res, 405, 'method not allowed', { Allow: 'POST' }); }
		let msg;
		try{ msg = JSON.parse(await readBody(req)); }catch(e){
			if(e && e.status === 413){ return sendPlain(res, 413, 'payload too large'); }
			return sendJson(res, 200, protocol.errorOf(null, protocol.ERR.PARSE, 'parse error'));
		}
		if(msg && !Array.isArray(msg) && typeof msg === 'object' && !Object.prototype.hasOwnProperty.call(msg, 'id')){
			if(msg.method === 'notifications/cancelled'){
				const ac = inflight.get(key(req, msg.params && msg.params.requestId));
				if(ac){ ac.abort(); }
			}
			res.writeHead(202); return res.end();
		}
		const ac = new AbortController();
		const id = msg && msg.id;
		const wantsProgress = !!(msg && msg.params && msg.params._meta && msg.params._meta.progressToken !== undefined);
		const accept = `${req.headers.accept || ''}`.toLowerCase();
		const stream = wantsProgress && accept.indexOf('text/event-stream') >= 0;
		const k = key(req, id);
		if(id !== undefined){ inflight.set(k, ac); }
		// 握手:发会话身份(规范的 Mcp-Session-Id;不强制客户端回带 —— 不带的照常服务,只是共用空会话),并记下这个会话的客户端名
		const newSid = msg && msg.method === 'initialize' ? crypto.randomUUID() : '';
		if(newSid){ rememberSessionClient(newSid, protocol.initializeClientName(msg)); }
		const extraHeaders = newSid ? { 'Mcp-Session-Id': newSid } : undefined;
		const ident = { clientName: 'http', sessionClient: sessionClientOf(req) };
		try{
			if(stream){
				const sse = openSse(req, res, ac, extraHeaders);
				const out = await protocol.handleMessage(msg, { rt, ...ident, sessionId: mcpSessionOf(req), version, signal: ac.signal, onNotification: (n)=>sse.event('message', n) });
				if(out){ sse.event('message', out); }
				sse.end();
				return undefined;
			}
			const out = await protocol.handleMessage(msg, { rt, ...ident, sessionId: mcpSessionOf(req), version, signal: ac.signal });
			return out ? sendJson(res, 200, out, extraHeaders) : (res.writeHead(202), res.end());
		}finally{
			// 只摘自己这一条(同键的另一条在途请求不受影响)
			if(id !== undefined && inflight.get(k) === ac){ inflight.delete(k); }
		}
	}

	async function handleRest(req, res, url){
		const g = gate(req, token, false);
		if(g){
			if(g[0] === 401){ return respondRest(res, 401, { ok: false, error: { code: 'UNAUTHORIZED', message: g[1] } }); }
			return sendPlain(res, g[0], g[1]);
		}
		if(!restEnabled){ return respondRest(res, 403, { ok: false, error: { code: 'REST_DISABLED', message: '无头服务启动时关掉了 REST 接口(去掉 --no-rest 重启)' } }); }
		const r = rest.route(req.method, url.pathname);
		const query = rest.parseQuery(url.search.replace(/^\?/, ''));
		const readArgs = async ()=>{
			const text = await readBody(req);
			if(!text.trim()){ return {}; }
			let v;
			try{ v = JSON.parse(text); }catch(e){ throw Object.assign(new Error(`请求体不是 JSON: ${e.message}`), { restCode: 'BAD_JSON' }); }
			if(!v || typeof v !== 'object' || Array.isArray(v)){ throw Object.assign(new Error('请求体须为 JSON 对象(工具参数)'), { restCode: 'BAD_JSON' }); }
			return v;
		};
		try{
			switch(r.kind){
			case 'Index':
				return respondRest(res, 200, { app: 'horosa', mode: 'headless', version, base: rest.REST_PREFIX, docs: `${rest.REST_PREFIX}/openapi.json`,
					endpoints: ['GET /tools', 'POST /tools/{name}[?stream=1]', 'GET /resources[?cursor=]', 'GET /resources/templates', 'GET /resources/read?uri=', 'GET /prompts[?cursor=]', 'POST /prompts/{name}', 'GET /openapi.json'],
					aliases: rest.GET_ALIASES.map(([a, t])=>({ path: `${rest.REST_PREFIX}/${a}`, tool: t })) });
			case 'OpenApi':
			case 'ToolsList': {
				const out = await rpc('tools/list', {});
				if(out.error){ return respondRest(res, ...rpcFail(out)); }
				return respondRest(res, 200, r.kind === 'OpenApi' ? rest.openApiDoc(out.result.tools, version) : { ok: true, tools: out.result.tools });
			}
			case 'ToolCall':
			case 'Alias': {
				const args = r.kind === 'Alias' ? query : await readArgs();
				const params = { name: r.name, arguments: args, _meta: { clientName: rest.REST_CLIENT_NAME } };
				// 幂等键(Idempotency-Key 请求头;与 MCP 的 _meta.idempotencyKey 同义):同键重试不重复写。
				// 口径单源在协议层(去空白 / 按码点 / 超长 = 参数错 → 400):这里只原样带过去,不自己判、不静默丢
				if(req.headers['idempotency-key'] !== undefined){ params._meta.idempotencyKey = `${req.headers['idempotency-key']}`; }
				const wantsStream = r.kind === 'ToolCall' && (query.stream === '1' || `${req.headers.accept || ''}`.indexOf('text/event-stream') >= 0);
				if(wantsStream){
					const ac = new AbortController();
					const sse = openSse(req, res, ac);
					params._meta.progressToken = 'rest';
					const out = await rpc('tools/call', params, ac.signal, (n)=>{ const p = n.params || {}; const v = { progress: p.progress }; if(p.total !== undefined){ v.total = p.total; } if(p.message !== undefined){ v.message = p.message; } sse.event('progress', v); });
					if(!ac.signal.aborted){
						if(out.error){ const [s, b] = rpcFail(out); sse.event('error', { ...b, status: s }); }else{ const [s, b] = rest.toolResultBody(out.result); sse.event('result', { ...b, status: s }); }
					}
					sse.end();
					return undefined;
				}
				const out = await rpc('tools/call', params);
				if(out.error){ return respondRest(res, ...rpcFail(out)); }
				return respondRest(res, ...rest.toolResultBody(out.result));
			}
			case 'ResourcesList':
			case 'PromptsList': {
				const p = {};
				if(query.cursor !== undefined){ p.cursor = query.cursor; }
				const out = await rpc(r.kind === 'ResourcesList' ? 'resources/list' : 'prompts/list', p);
				if(out.error){ return respondRest(res, ...rpcFail(out)); }
				return respondRest(res, 200, { ...out.result, ok: true });
			}
			case 'ResourceTemplates': {
				const out = await rpc('resources/templates/list', {});
				if(out.error){ return respondRest(res, ...rpcFail(out)); }
				return respondRest(res, 200, { ok: true, resourceTemplates: out.result.resourceTemplates || [] });
			}
			case 'ResourceRead': {
				if(!query.uri){ return respondRest(res, ...rest.errorBody(400, 'BAD_REQUEST', '缺查询参数 uri(如 horosa://chart/local-…)')); }
				const out = await rpc('resources/read', { uri: query.uri });
				if(out.error){ return respondRest(res, ...rpcFail(out)); }
				return respondRest(res, 200, { ok: true, contents: out.result.contents || [] });
			}
			case 'PromptGet': {
				const out = await rpc('prompts/get', { name: r.name, arguments: await readArgs() });
				if(out.error){ return respondRest(res, ...rpcFail(out)); }
				return respondRest(res, 200, { ...out.result, ok: true });
			}
			case 'MethodNotAllowed':
				return sendJson(res, 405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: `只接受 ${r.allow}` } }, { Allow: r.allow });
			default:
				return respondRest(res, ...rest.errorBody(404, 'NOT_FOUND', `没有这个接口:${url.pathname};接口清单见 GET ${rest.REST_PREFIX}`));
			}
		}catch(e){
			if(e && e.status === 413){ return respondRest(res, ...rest.errorBody(413, 'PAYLOAD_TOO_LARGE', 'payload too large')); }
			if(e && e.restCode){ return respondRest(res, ...rest.errorBody(400, e.restCode, e.message)); }
			return respondRest(res, ...rest.errorBody(500, 'INTERNAL', e && e.message ? e.message : `${e}`));
		}
	}

	// 管理口(终端人工命令用;管理令牌 ≠ 接口令牌):设置、模型配置、提案采纳 / 拒绝 / 撤销采纳、导入导出 —— 不是工具,MCP / REST 工具面里没有它们
	async function handleAdmin(req, res, url){
		const g = gate(req, adminToken, false);
		if(g){ return sendJson(res, g[0], { ok: false, error: { code: g[0] === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN', message: g[0] === 401 ? '管理口只认管理令牌(admin-token;接口令牌不行)' : g[1] } }); }
		let body = {};
		if(req.method === 'POST'){
			try{ body = JSON.parse((await readBody(req)) || '{}'); }catch(e){
				if(e && e.status === 413){ return sendJson(res, 413, { ok: false, error: { code: 'PAYLOAD_TOO_LARGE', message: 'payload too large' } }); }
				return sendJson(res, 400, { ok: false, error: { code: 'BAD_JSON', message: '请求体不是 JSON' } });
			}
		}
		const r = await rt.admin.handle(req.method, `${url.pathname}${url.search}`, body);
		return sendJson(res, r.status, r.body);
	}

	const server = http.createServer((req, res)=>{
		let url;
		try{ url = new URL(req.url, 'http://127.0.0.1'); }catch(e){ return sendPlain(res, 400, 'bad url'); }
		const p = url.pathname;
		const go = ()=>{
			if(p === '/healthz' && req.method === 'GET'){
				// 不要令牌(终端命令据此核对端点文件里的 pid),但 Host / Origin 照样只认本机:DNS 重绑定的网页读不到 pid / 版本
				if(req.headers.host !== undefined && !isLoopbackAuthority(req.headers.host)){ return sendPlain(res, 403, 'forbidden host'); }
				if(!originAllowed(req.headers.origin)){ return sendPlain(res, 403, 'forbidden origin'); }
				return sendJson(res, 200, { app: 'horosa', mode: 'headless', role, pid: process.pid, version, protocolVersion: protocol.LATEST_PROTOCOL });
			}
			if(p === '/mcp'){ return handleMcp(req, res); }
			if(p === rest.REST_PREFIX || p.startsWith(`${rest.REST_PREFIX}/`)){ return handleRest(req, res, url); }
			if(p.startsWith('/admin/')){ return handleAdmin(req, res, url); }
			return sendPlain(res, 404, 'not found');
		};
		Promise.resolve().then(go).catch((e)=>{ try{ sendPlain(res, 500, e && e.message ? e.message : 'internal error'); }catch(err){ /* noop */ } });
	});
	server.keepAliveTimeout = 5000;

	const base = o.port === 0 ? 0 : Number(o.port || process.env.HOROSA_HEADLESS_PORT || DEFAULT_PORT);
	const tryListen = (port)=>new Promise((resolve, reject)=>{
		const onErr = (e)=>{ server.removeListener('listening', onOk); reject(e); };
		const onOk = ()=>{ server.removeListener('error', onErr); resolve(port); };
		server.once('error', onErr);
		server.once('listening', onOk);
		server.listen(port, '127.0.0.1');
	});
	let port = null;
	const span = o.port || o.port === 0 ? 1 : PORT_SPAN;
	for(let i = 0; i < span && port === null; i++){
		try{ port = await tryListen(base + i); }catch(e){ if(!e || e.code !== 'EADDRINUSE' || i === span - 1){ throw e; } }
	}
	if(port === 0){ port = server.address().port; }   // 随机端口(测试用)
	const url = `http://127.0.0.1:${port}/mcp`;
	const info = { url, restUrl: restEnabled ? `http://127.0.0.1:${port}${rest.REST_PREFIX}` : '', token, pid: process.pid, version, mode: 'headless', role, repoRoot: path.resolve(__dirname, '../../..'), startedAt: new Date().toISOString() };
	// 管理令牌文件第一行 = 令牌,第二行 = 写它的进程号(摘文件时只摘自己写的)
	const dropOwnFiles = ()=>{
		try{ const cur = JSON.parse(fs.readFileSync(endpointFile(), 'utf8')); if(cur && cur.pid === process.pid){ fs.unlinkSync(endpointFile()); } }catch(e){ /* 已删 */ }
		try{ const lines = fs.readFileSync(adminTokenFile(), 'utf8').split('\n'); if(Number(lines[1]) === process.pid){ fs.unlinkSync(adminTokenFile()); } }catch(e){ /* 已删 */ }
	};
	if(o.writeEndpoint !== false){
		writeAtomic(adminTokenFile(), `${adminToken}\n${process.pid}\n`, 0o600);
		writeAtomic(endpointFile(), JSON.stringify(info, null, 1), 0o600);
		// 进程无论怎么退出(含 stdio 会话结束直接退)都摘掉自己写的端点文件与管理令牌,别留给别人一个死地址
		process.once('exit', dropOwnFiles);
	}
	const close = ()=>new Promise((resolve)=>{
		if(o.writeEndpoint !== false){ dropOwnFiles(); }
		inflight.forEach((ac)=>{ try{ ac.abort(); }catch(e){ /* noop */ } });
		server.close(()=>resolve());
		setTimeout(resolve, 2000).unref();
	});
	return { port, url, restUrl: info.restUrl, token, adminToken, version, close, rt };
}

// 终端人工命令读管理令牌(只认正在跑的那个服务写的:进程号对得上)
function readAdminToken(pid){
	try{
		const lines = fs.readFileSync(adminTokenFile(), 'utf8').split('\n');
		return lines[0] && (!pid || Number(lines[1]) === Number(pid)) ? lines[0].trim() : '';
	}catch(e){ return ''; }
}

module.exports = { startServer, endpointFile, adminTokenFile, readAdminToken, appVersion, isReleasedCheckout, gate, isLoopbackAuthority, originAllowed, DEFAULT_PORT, MAX_BODY_BYTES };
