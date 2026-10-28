// 无头 HTTP 服务与终端命令真连合同(node --test;要 Node 18+ 自带的 fetch / AbortController,所以不放 jest):
//  ① HTTP 服务(假运行时、随机端口):门(Host / Origin / 令牌 / 协议版本)、/mcp、事件流进度、notifications/cancelled 中止、
//     REST 全路由与状态码、OpenAPI、管理口(只认管理令牌);
//  ② 终端命令:经端点文件连服务(子命令 / 简写 / --json)、令牌不对 4 / 服务不在 3、Ctrl-C 发取消通知且回 130;
//     人工命令(config / ai / export / import)经管理令牌,密钥不收命令行参数。
// 跑法:node --test Horosa-Web/astrostudyui/headless/test/server.test.js Horosa-Web/astrostudyui/headless/test/runtime.test.js(preflight 与 ./horosa selftest 同跑)。
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('../server');
const { makeAdminHandler } = require('../runtime');
const cli = require('../cli');

// 与 jest 同形的最小断言(本文件由 jest 版平移而来)
const expect = (a)=>({
	toBe: (b)=>assert.strictEqual(a, b),
	toEqual: (b)=>assert.deepStrictEqual(a, b),
	toContain: (b)=>assert.ok(typeof a === 'string' ? a.includes(b) : Array.isArray(a) && a.includes(b), `期望含 ${JSON.stringify(b)},实际 ${JSON.stringify(a).slice(0, 300)}`),
	toBeUndefined: ()=>assert.strictEqual(a, undefined),
	not: { toBe: (b)=>assert.notStrictEqual(a, b) },
});
const beforeAll = before;
const afterAll = after;

function fakeRt(over){
	const calls = [];
	const tools = [
		{ name: 'list_records', title: '列档案', level: 'read', category: 'query', description: '列出\n第二行', inputSchema: { type: 'object' }, outputSchema: { type: 'object' }, annotations: { readOnlyHint: true } },
		{ name: 'create_chart_record', level: 'additive', category: 'records', description: '建命盘', inputSchema: { type: 'object' } },
		{ name: 'delete_all', level: 'additive', description: 'x', inputSchema: { type: 'object' } },
		{ name: 'wipe', level: 'destructive', description: 'x', inputSchema: { type: 'object' } },
		{ name: 'ext_x', level: 'read', description: 'x', inputSchema: { type: 'object' } },
	];
	const rt = {
		calls,
		admin: {
			cfg: { approval: 'auto', 'headless-analysis': 'off', 'private-read': 'off' },
			getConfig(){ return { ...this.cfg }; },
			setConfig(k, v){ if(!(k in this.cfg)){ throw new Error(`没有这个设置 ${k}`); } this.cfg[k] = v; return this.getConfig(); },
			listProposals(){ return [{ id: 'prop-1', status: 'pending' }]; },
			// 与真运行时同形:采纳 / 拒绝 / 撤销采纳走写入通道,回 Promise(管理口不 await 就只回得出 {})
			proposal(op, id){ return new Promise((r)=>setTimeout(()=>r({ ok: true, op, id }), 5)); },
			aiLog: [],
			async aiStatus(){ return { profiles: [{ id: 'p1', key: 'set' }], current: { profileId: 'p1', model: 'm' } }; },
			async aiAdd(b){ this.aiLog.push(['add', b]); if(!b.provider){ throw new Error('要给接口类型'); } return { profile: { id: 'p2', name: 'OpenAI', models: ['m1'], key: b.apiKey ? 'set' : 'missing' }, used: b.use !== false }; },
			async aiKey(id, b){ this.aiLog.push(['key', id, b]); return { profile: { id, key: 'set' } }; },
			async aiUse(b){ this.aiLog.push(['use', b]); return { profileId: b.profileId, model: b.model || 'm' }; },
			async aiRemove(id){ this.aiLog.push(['remove', id]); return { removed: id }; },
			async aiTest(b){ return { ok: true, ms: 5, content: 'OK', profileId: b.profileId || 'p1', model: 'm' }; },
			async exportTo(b){ return { path: b.path, bytes: 10 }; },
			async importFrom(b){ return { dryRun: !!b.dryRun, preview: [{ key: 'charts', label: '命盘', detail: '新增 1 条' }], results: b.dryRun ? undefined : [{ key: 'charts', ok: true, detail: '导入 1 条' }] }; },
		},
		async dispatch(method, params, opts){
			calls.push({ method, params, opts: { clientName: opts && opts.clientName } });
			if(over && over[method]){ return over[method](params, opts); }
			if(method === 'tools/list'){ return { ok: true, result: { tools } }; }
			if(method === 'tools/call'){
				if(opts && opts.progress){ opts.progress({ progress: 1, total: 2, message: '第一步' }); opts.progress({ progress: 2, total: 2 }); }
				return { ok: true, result: { content: [{ type: 'text', text: `called ${params.name}` }], structuredContent: { echo: params.arguments }, isError: false } };
			}
			if(method === 'resources/list'){ return { ok: true, result: { resources: [{ uri: 'horosa://chart/local-1', name: '张三' }], nextCursor: 'o64' } }; }
			if(method === 'resources/templates/list'){ return { ok: true, result: { resourceTemplates: [{ uriTemplate: 'horosa://chart/{cid}', name: '命盘' }] } }; }
			if(method === 'resources/read'){ return { ok: true, result: { contents: [{ uri: params.uri, text: 'snapshot' }] } }; }
			if(method === 'prompts/list'){ return { ok: true, result: { prompts: [{ name: 'guide:horosa', description: '指南' }] } }; }
			if(method === 'prompts/get'){ return { ok: true, result: { messages: [{ role: 'user', content: { type: 'text', text: 'x' } }] } }; }
			return { ok: false, error: { code: -32601, message: 'nope' } };
		},
	};
	rt.admin.handle = makeAdminHandler(rt.admin);
	return rt;
}

describe('① HTTP 服务', ()=>{
	let srv;
	let rt;
	let slowRelease;
	const slow = { aborted: false };
	beforeAll(async ()=>{
		rt = fakeRt({
			'tools/call': async (params, opts)=>{
				if(params.name === 'search_zeri'){
					if(opts.progress){ opts.progress({ progress: 1, total: 3 }); }
					await new Promise((resolve)=>{ slowRelease = resolve; if(opts.signal){ opts.signal.addEventListener('abort', ()=>{ slow.aborted = true; resolve(); }, { once: true }); } });
					return { ok: true, result: { content: [{ type: 'text', text: 'slow done' }], isError: false } };
				}
				if(opts.progress){ opts.progress({ progress: 1, total: 2, message: '第一步' }); }
				return { ok: true, result: { content: [{ type: 'text', text: JSON.stringify({ ok: false, code: 'E_X', message: '坏了' }) }], isError: params.name === 'create_chart_record' } };
			},
		});
		srv = await startServer({ rt, port: 0, writeEndpoint: false, token: 'tok_TESTTESTTESTTESTTESTTESTTEST01' });
	});
	afterAll(async ()=>{ await srv.close(); });
	const base = ()=>`http://127.0.0.1:${srv.port}`;
	const auth = { Authorization: 'Bearer tok_TESTTESTTESTTESTTESTTESTTEST01' };
	const mcp = (body, headers)=>fetch(`${base()}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth, ...(headers || {}) }, body: JSON.stringify(body) });

	it('🔴 门:健康探针不要令牌;无令牌 401;外来 Origin 403;外来 Host 403;不认得的协议版本 400', async ()=>{
		expect((await (await fetch(`${base()}/healthz`)).json()).mode).toBe('headless');
		expect((await fetch(`${base()}/mcp`, { method: 'POST', body: '{}' })).status).toBe(401);
		expect((await mcp({ jsonrpc: '2.0', id: 1, method: 'ping' }, { Origin: 'https://evil.example' })).status).toBe(403);
		expect((await mcp({ jsonrpc: '2.0', id: 1, method: 'ping' }, { Origin: 'http://localhost:3000' })).status).toBe(200);
		expect((await mcp({ jsonrpc: '2.0', id: 1, method: 'ping' }, { 'MCP-Protocol-Version': '1999-01-01' })).status).toBe(400);
		const evilHost = await new Promise((resolve)=>{
			const req = require('http').request({ host: '127.0.0.1', port: srv.port, path: '/mcp', method: 'POST', headers: { Host: 'evil.example:80', ...auth, 'Content-Type': 'application/json' } }, (res)=>resolve(res.statusCode));
			req.end('{"jsonrpc":"2.0","id":1,"method":"ping"}');
		});
		expect(evilHost).toBe(403);
	});
	it('🔴 客户端身份:握手报的 clientInfo.name 按会话记住,之后这个会话的调用都按它认;逐条 _meta.clientName 优先;不带会话头 = http', async ()=>{
		const init = await mcp({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', clientInfo: { name: 'claude-code', version: '2' } } });
		const sid = init.headers.get('mcp-session-id');
		assert.ok(sid, '握手没发会话身份');
		const n0 = rt.calls.length;
		await (await mcp({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'list_records', arguments: {} } }, { 'Mcp-Session-Id': sid })).json();
		await (await mcp({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'list_records', arguments: {}, _meta: { clientName: 'cli' } } }, { 'Mcp-Session-Id': sid })).json();
		await (await mcp({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'list_records', arguments: {} } })).json();
		expect(rt.calls.slice(n0).filter((c)=>c.method === 'tools/call').map((c)=>c.opts.clientName)).toEqual(['claude-code', 'cli', 'http']);
	});
	it('🔴 /mcp:握手 / 清单 / 调用;要进度且收事件流 → 进度帧 + 回包;通知回 202', async ()=>{
		const init = await (await mcp({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25' } })).json();
		expect(init.result.serverInfo.name).toBe('horosa');
		expect((await (await mcp({ jsonrpc: '2.0', id: 2, method: 'tools/list' })).json()).result.tools.length).toBe(2);
		const sse = await mcp({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'list_records', arguments: {}, _meta: { progressToken: 'p' } } }, { Accept: 'application/json, text/event-stream' });
		expect(sse.headers.get('content-type')).toContain('text/event-stream');
		const text = await sse.text();
		const msgs = text.split('\n\n').map((e)=>e.split('\n').filter((l)=>l.startsWith('data: ')).map((l)=>l.slice(6)).join('')).filter(Boolean).map((d)=>JSON.parse(d));
		expect(msgs[0].method).toBe('notifications/progress');
		expect(msgs[msgs.length - 1].id).toBe(3);
		expect((await mcp({ jsonrpc: '2.0', method: 'notifications/initialized' })).status).toBe(202);
	});
	it('🔴 notifications/cancelled 按请求 id 中止在途调用', async ()=>{
		slow.aborted = false;
		const p = mcp({ jsonrpc: '2.0', id: 'slow-1', method: 'tools/call', params: { name: 'search_zeri', arguments: {} } }).then((r)=>r.json());
		await new Promise((r)=>setTimeout(r, 150));
		expect((await mcp({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 'slow-1' } })).status).toBe(202);
		const out = await p;
		expect(slow.aborted).toBe(true);
		expect(out.error.code).toBe(-32800);
	});
	it('🔴 REST:索引 / 工具清单 / 调用 / 简写 / 资源 / 模版 / 读 / 提示 / OpenAPI / 405 / 404 / 坏 JSON / 工具失败 422 / 事件流', async ()=>{
		const get = (p)=>fetch(`${base()}/api/v1${p}`, { headers: auth });
		const post = (p, b)=>fetch(`${base()}/api/v1${p}`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: b });
		const r401 = await fetch(`${base()}/api/v1/tools`);
		expect(r401.status).toBe(401);
		expect(r401.headers.get('www-authenticate')).toContain('Bearer');
		expect((await (await get('')).json()).mode).toBe('headless');
		expect((await (await get('/tools')).json()).tools.length).toBe(2);
		const call = await (await post('/tools/list_records', '{"query":"张"}')).json();
		expect(call.ok).toBe(true);
		expect((await (await get('/records?query=%E5%BC%A0')).json()).ok).toBe(true);
		expect(rt.calls.filter((c)=>c.method === 'tools/call').pop().params.arguments).toEqual({ query: '张' });
		expect((await (await get('/resources')).json()).nextCursor).toBe('o64');
		expect((await (await get('/resources/templates')).json()).resourceTemplates.length).toBe(1);
		expect((await (await get('/resources/read?uri=horosa%3A%2F%2Fchart%2Flocal-1')).json()).contents[0].text).toBe('snapshot');
		expect((await get('/resources/read')).status).toBe(400);
		expect((await (await get('/prompts')).json()).prompts[0].name).toBe('guide:horosa');
		expect((await (await post('/prompts/guide:horosa', '')).json()).messages.length).toBe(1);
		const doc = await (await get('/openapi.json')).json();
		expect(doc.openapi).toBe('3.1.0');
		expect(doc.paths['/tools/list_records'].post.operationId).toBe('list_records');
		const r405 = await get('/tools/list_records');
		expect(r405.status).toBe(405);
		expect(r405.headers.get('allow')).toBe('POST');
		expect((await get('/nope')).status).toBe(404);
		expect((await post('/tools/list_records', '{oops')).status).toBe(400);
		const failed = await post('/tools/create_chart_record', '{}');
		expect(failed.status).toBe(422);
		expect((await failed.json()).error).toEqual({ code: 'E_X', message: '坏了', retryable: false });
		const stream = await (await post('/tools/search_zeri?stream=1', '{}')).body.getReader();
		setTimeout(()=>slowRelease && slowRelease(), 100);
		let txt = ''; const dec = new TextDecoder();
		for(;;){ const c = await stream.read(); if(c.done){ break; } txt += dec.decode(c.value); }
		expect(txt).toContain('event: progress');
		expect(txt).toContain('event: result');
	});
	it('🔴 管理口:只认管理令牌(接口令牌 401、管理令牌进不了接口);设置读写(未知键 400)、提案列出与人工处理', async ()=>{
		const adm = { Authorization: `Bearer ${srv.adminToken}` };
		expect(srv.adminToken).not.toBe(srv.token);
		expect((await fetch(`${base()}/admin/config`)).status).toBe(401);
		expect((await fetch(`${base()}/admin/config`, { headers: auth })).status).toBe(401);
		expect((await fetch(srv.url, { method: 'POST', headers: { ...adm, 'Content-Type': 'application/json' }, body: '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' })).status).toBe(401);
		expect((await (await fetch(`${base()}/admin/config`, { headers: adm })).json()).config.approval).toBe('auto');
		const set = await (await fetch(`${base()}/admin/config`, { method: 'POST', headers: { ...adm, 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'approval', value: 'read-only' }) })).json();
		expect(set.config.approval).toBe('read-only');
		expect((await fetch(`${base()}/admin/config`, { method: 'POST', headers: adm, body: JSON.stringify({ key: 'nope', value: 1 }) })).status).toBe(400);
		expect((await fetch(`${base()}/admin/config`, { method: 'POST', headers: adm, body: '{oops' })).status).toBe(400);
		expect((await (await fetch(`${base()}/admin/proposals`, { headers: adm })).json()).proposals[0].id).toBe('prop-1');
		expect((await (await fetch(`${base()}/admin/proposals/prop-1/accept`, { method: 'POST', headers: adm, body: '{}' })).json()).result).toEqual({ ok: true, op: 'accept', id: 'prop-1' });
		// 模型接口与导入导出同一道门、同一份路由
		expect((await (await fetch(`${base()}/admin/ai`, { headers: adm })).json()).ai.current.profileId).toBe('p1');
		expect((await fetch(`${base()}/admin/ai`, { headers: auth })).status).toBe(401);
		const added = await (await fetch(`${base()}/admin/ai/profiles`, { method: 'POST', headers: adm, body: JSON.stringify({ provider: 'openai', apiKey: 'k' }) })).json();
		expect(added.profile.key).toBe('set');
		expect((await fetch(`${base()}/admin/ai/profiles`, { method: 'POST', headers: adm, body: '{}' })).status).toBe(400);
		expect((await (await fetch(`${base()}/admin/ai/profiles/p%201/key`, { method: 'POST', headers: adm, body: JSON.stringify({ apiKey: 'k2' }) })).json()).profile.id).toBe('p 1');
		expect((await (await fetch(`${base()}/admin/ai/profiles/p1/remove`, { method: 'POST', headers: adm, body: '{}' })).json()).removed).toBe('p1');
		expect((await (await fetch(`${base()}/admin/import`, { method: 'POST', headers: adm, body: JSON.stringify({ path: '/x.zip', dryRun: true }) })).json()).import.dryRun).toBe(true);
		expect((await fetch(`${base()}/admin/nope`, { headers: adm })).status).toBe(404);
	});
});

describe('① HTTP 服务 · 会话与边界', ()=>{
	let srv;
	const calls = [];
	beforeAll(async ()=>{
		const rt = fakeRt({
			'tools/call': async (params, opts)=>{
				const rec = { tag: params.arguments && params.arguments.tag, aborted: false, release: null };
				calls.push(rec);
				await new Promise((resolve)=>{ rec.release = resolve; if(opts.signal){ opts.signal.addEventListener('abort', ()=>{ rec.aborted = true; resolve(); }, { once: true }); } });
				return { ok: true, result: { content: [{ type: 'text', text: `done ${rec.tag}` }], isError: false } };
			},
		});
		srv = await startServer({ rt, port: 0, writeEndpoint: false, token: 'tok_SESSIONSESSIONSESSIONSESS01' });
	});
	afterAll(async ()=>{ await srv.close(); });
	const auth = { Authorization: 'Bearer tok_SESSIONSESSIONSESSIONSESS01' };
	const mcp = (body, headers)=>fetch(`http://127.0.0.1:${srv.port}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth, ...(headers || {}) }, body: JSON.stringify(body) });
	const rawStatus = (opts, body)=>new Promise((resolve)=>{
		const req = require('http').request({ host: '127.0.0.1', port: srv.port, ...opts }, (res)=>{ res.resume(); resolve(res.statusCode); });
		req.on('error', (e)=>resolve(`ERR ${e.code}`));
		req.end(body);
	});

	it('🔴 握手发 Mcp-Session-Id;两个会话用同一个请求 id:取消只中止本会话那条,另一条照常完成', async ()=>{
		const ia = await mcp({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25' } });
		const ib = await mcp({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25' } });
		const sa = ia.headers.get('mcp-session-id'); const sb = ib.headers.get('mcp-session-id');
		assert.ok(sa && sb && sa !== sb, `握手应各发一个会话身份:${sa} / ${sb}`);
		calls.length = 0;
		const pa = mcp({ jsonrpc: '2.0', id: 'dup', method: 'tools/call', params: { name: 'list_records', arguments: { tag: 'A' } } }, { 'Mcp-Session-Id': sa }).then((r)=>r.json());
		const pb = mcp({ jsonrpc: '2.0', id: 'dup', method: 'tools/call', params: { name: 'list_records', arguments: { tag: 'B' } } }, { 'Mcp-Session-Id': sb }).then((r)=>r.json());
		for(let i = 0; i < 100 && calls.length < 2; i++){ await new Promise((r)=>setTimeout(r, 20)); }   // eslint-disable-line no-await-in-loop
		expect(calls.length).toBe(2);
		expect((await mcp({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 'dup' } }, { 'Mcp-Session-Id': sa })).status).toBe(202);
		const outA = await pa;
		expect(outA.error.code).toBe(-32800);
		const recA = calls.find((c)=>c.tag === 'A'); const recB = calls.find((c)=>c.tag === 'B');
		expect(recA.aborted).toBe(true);
		expect(recB.aborted).toBe(false);
		recB.release();
		const outB = await pb;
		expect(outB.result.content[0].text).toBe('done B');
	});
	it('🔴 请求体超 1 MiB → 回 413(读完再回,客户端拿得到状态码,而不是连接被重置)', async ()=>{
		const big = 'x'.repeat((1 << 20) + 4096);
		const r = await fetch(`http://127.0.0.1:${srv.port}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth }, body: big });
		expect(r.status).toBe(413);
		const rr = await fetch(`http://127.0.0.1:${srv.port}/api/v1/tools/list_records`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth }, body: big });
		expect(rr.status).toBe(413);
	});
	it('🔴 /healthz 不要令牌但只认本机 Host / Origin(DNS 重绑定的网页读不到 pid / 版本)', async ()=>{
		expect(await rawStatus({ path: '/healthz', method: 'GET', headers: { Host: 'evil.example' } })).toBe(403);
		expect(await rawStatus({ path: '/healthz', method: 'GET', headers: { Origin: 'https://evil.example' } })).toBe(403);
		expect(await rawStatus({ path: '/healthz', method: 'GET' })).toBe(200);
	});
});

describe('② 终端命令', ()=>{
	describe('经端点文件连服务', ()=>{
		let srv;
		let ep;
		let slowRelease;
		const state = { aborted: false };
		let outBuf = '';
		let errBuf = '';
		beforeAll(async ()=>{
			const rt = fakeRt({
				'tools/call': async (params, opts)=>{
					if(params.name === 'search_zeri'){
						await new Promise((resolve)=>{ slowRelease = resolve; opts.signal.addEventListener('abort', ()=>{ state.aborted = true; resolve(); }, { once: true }); });
						return { ok: true, result: { content: [{ type: 'text', text: 'late' }], isError: false } };
					}
					return { ok: true, result: { content: [{ type: 'text', text: `called ${params.name} ${JSON.stringify(params.arguments)}` }], structuredContent: { echo: params.arguments }, isError: params.name === 'create_chart_record' } };
				},
			});
			srv = await startServer({ rt, port: 0, writeEndpoint: false, token: 'tok_CLICLICLICLICLICLICLICLICLI01' });
			ep = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'horosa-cli-')), 'endpoint.json');
			fs.writeFileSync(ep, JSON.stringify({ url: srv.url, token: srv.token, pid: process.pid }));
		});
		afterAll(async ()=>{ await srv.close(); });
		beforeEach(()=>{
			outBuf = ''; errBuf = '';
			cli.__setIoForTests({ out: (s)=>{ outBuf += s; return true; }, err: (s)=>{ errBuf += s; return true; } });
			cli.__resetInterruptForTests();
		});
		afterEach(()=>{ cli.__setIoForTests({ out: (s)=>process.stdout.write(s), err: (s)=>process.stderr.write(s) }); });
		const run = (argv)=>cli.main(['--endpoint', ep, ...argv]);

		it('🔴 tools / describe / call(k=v、--json)/ 简写 / 资源 / 读 / 提示;工具失败回 1', async ()=>{
			expect(await run(['tools'])).toBe(0);
			expect(outBuf).toContain('共 2 件');
			outBuf = '';
			expect(await run(['describe', 'list_records'])).toBe(0);
			expect(outBuf).toContain('参数结构');
			outBuf = '';
			expect(await run(['call', 'list_records', 'query=张', 'limit:=5', '--json'])).toBe(0);
			expect(JSON.parse(outBuf).structuredContent.echo).toEqual({ query: '张', limit: 5 });
			outBuf = '';
			expect(await run(['records', '李'])).toBe(0);
			expect(outBuf).toContain('"query":"李"');
			outBuf = '';
			expect(await run(['resources'])).toBe(0);
			expect(outBuf).toContain('horosa://chart/local-1  张三');
			outBuf = '';
			expect(await run(['read', 'horosa://chart/local-1'])).toBe(0);
			expect(outBuf).toBe('snapshot\n');
			outBuf = '';
			expect(await run(['prompt', 'guide:horosa'])).toBe(0);
			expect(outBuf).toContain('[user]');
			expect(await run(['call', 'create_chart_record'])).toBe(1);
			expect(await run(['describe', 'nope'])).toBe(2);
			expect(await run(['frobnicate'])).toBe(2);
		});
		it('🔴 令牌不对 → 4;端点文件不在 → 3', async ()=>{
			const bad = path.join(path.dirname(ep), 'bad.json');
			fs.writeFileSync(bad, JSON.stringify({ url: srv.url, token: 'tok_WRONGWRONGWRONGWRONGWRONG000', pid: process.pid }));
			expect(await cli.main(['--endpoint', bad, 'tools'])).toBe(4);
			expect(await cli.main(['--endpoint', path.join(path.dirname(ep), 'none.json'), 'tools'])).toBe(3);
		});
		it('🔴 Ctrl-C:在途调用 → 发取消通知 → 服务端中止 → 回 130', async ()=>{
			state.aborted = false;
			const p = run(['call', 'search_zeri']);
			await new Promise((r)=>setTimeout(r, 200));
			cli.__interruptForTests();
			expect(await p).toBe(130);
			for(let i = 0; i < 20 && !state.aborted; i++){ await new Promise((r)=>setTimeout(r, 50)); }   // eslint-disable-line no-await-in-loop
			expect(state.aborted).toBe(true);
			expect(errBuf).toContain('已取消');
		});
	});

	describe('人工命令(经在跑的服务的管理口 · 管理令牌)', ()=>{
		let srv;
		let rt;
		let home;
		const prevHome = process.env.HOROSA_HOME;
		let outBuf = '';
		let errBuf = '';
		beforeAll(async ()=>{
			home = fs.mkdtempSync(path.join(os.tmpdir(), 'horosa-admin-'));
			process.env.HOROSA_HOME = home;
			rt = fakeRt();
			srv = await startServer({ rt, port: 0 });   // 写端点文件 + 管理令牌文件(本进程号)
		});
		afterAll(async ()=>{
			await srv.close();
			if(prevHome === undefined){ delete process.env.HOROSA_HOME; }else{ process.env.HOROSA_HOME = prevHome; }
		});
		beforeEach(()=>{
			outBuf = ''; errBuf = '';
			cli.__setIoForTests({ out: (s)=>{ outBuf += s; return true; }, err: (s)=>{ errBuf += s; return true; } });
		});
		afterEach(()=>{ cli.__setIoForTests({ out: (s)=>process.stdout.write(s), err: (s)=>process.stderr.write(s) }); });

		it('🔴 管理令牌文件 0600、不在端点文件里;服务关了就摘', async ()=>{
			const { adminTokenFile, endpointFile, readAdminToken } = require('../server');
			expect(fs.statSync(adminTokenFile()).mode & 0o777).toBe(0o600);
			expect(readAdminToken(process.pid)).toBe(srv.adminToken);
			expect(readAdminToken(process.pid + 1)).toBe('');
			expect(JSON.stringify(JSON.parse(fs.readFileSync(endpointFile(), 'utf8'))).includes(srv.adminToken)).toBe(false);
		});
		it('🔴 config / ai(列 / 加 / 换密钥 / 选用 / 删 / 测)/ export / import:密钥只从环境变量名或标准输入读,命令行里给密钥直接拒', async ()=>{
			expect(await cli.main(['config', 'approval', 'read-only'])).toBe(0);   // 收紧不拦
			expect(outBuf).toContain('approval = read-only');
			// 放宽(写入全自动)是人工操作:非交互只有 --yes 不放行,还要显式环境变量
			delete process.env.HOROSA_ALLOW_UNATTENDED_APPROVAL;
			expect(await cli.main(['config', 'approval', 'auto'])).toBe(2);
			expect(await cli.main(['config', 'approval', 'auto', '--yes'])).toBe(2);
			expect(errBuf).toContain('HOROSA_ALLOW_UNATTENDED_APPROVAL=1');
			expect(await cli.main(['config', 'private-read', 'on', '--yes'])).toBe(2);
			process.env.HOROSA_ALLOW_UNATTENDED_APPROVAL = '1';
			expect(await cli.main(['config', 'approval', 'auto', '--yes'])).toBe(0);
			expect(await cli.main(['config', 'approval', 'read-only'])).toBe(0);
			delete process.env.HOROSA_ALLOW_UNATTENDED_APPROVAL;
			outBuf = '';
			outBuf = '';
			expect(await cli.main(['ai'])).toBe(0);
			expect(outBuf).toContain('当前');
			expect(await cli.main(['ai', 'add', 'openai', '--api-key', 'sk-x'])).toBe(2);
			expect(await cli.main(['ai', 'add', 'openai', '--key=sk-x'])).toBe(2);
			expect(await cli.main(['ai', 'add', 'openai'])).toBe(2);   // 非交互、没给密钥来源
			process.env.XTEST_HEADLESS_KEY_VAR = 'sk-from-env';
			expect(await cli.main(['ai', 'add', 'openai', '--key-env', 'XTEST_HEADLESS_KEY_VAR', '--model', 'm1,m2', '--no-use'])).toBe(0);
			delete process.env.XTEST_HEADLESS_KEY_VAR;
			const add = rt.admin.aiLog.find((x)=>x[0] === 'add');
			expect(add[1]).toEqual({ provider: 'openai', models: 'm1,m2', baseUrl: '', name: '', apiKey: 'sk-from-env', use: false });
			expect(await cli.main(['ai', 'add', 'openai', '--key-env', 'XTEST_NO_SUCH_VAR'])).toBe(2);
			expect(await cli.main(['ai', 'use', 'p1', 'm2'])).toBe(0);
			expect(rt.admin.aiLog.find((x)=>x[0] === 'use')[1]).toEqual({ profileId: 'p1', model: 'm2' });
			expect(await cli.main(['ai', 'remove', 'p1'])).toBe(2);   // 非交互要 --yes
			expect(await cli.main(['ai', 'remove', 'p1', '--yes'])).toBe(2);   // …且要显式环境变量(挡住代理替人批准)
			expect(await cli.main(['proposals', 'accept', 'px1', '--yes'])).toBe(2);
			expect(await cli.main(['undo', 'a1', '--yes'])).toBe(2);
			process.env.HOROSA_ALLOW_UNATTENDED_APPROVAL = '1';
			expect(await cli.main(['ai', 'remove', 'p1', '--yes'])).toBe(0);
			outBuf = '';
			expect(await cli.main(['ai', 'test'])).toBe(0);
			expect(outBuf).toContain('通了');
			expect(await cli.main(['ai', 'frob'])).toBe(2);
			outBuf = '';
			expect(await cli.main(['export', path.join(home, 'b.zip')])).toBe(0);
			expect(outBuf).toContain('已导出');
			outBuf = '';
			expect(await cli.main(['import', path.join(home, 'b.zip'), '--dry-run'])).toBe(0);
			expect(outBuf).toContain('命盘:新增 1 条');
			expect(await cli.main(['import', path.join(home, 'b.zip')])).toBe(2);   // 非交互要 --yes
			delete process.env.HOROSA_ALLOW_UNATTENDED_APPROVAL;
			expect(await cli.main(['import', path.join(home, 'b.zip'), '--yes'])).toBe(2);   // …且要显式环境变量
			process.env.HOROSA_ALLOW_UNATTENDED_APPROVAL = '1';
			outBuf = '';
			expect(await cli.main(['import', path.join(home, 'b.zip'), '--yes'])).toBe(0);
			expect(outBuf).toContain('✅ charts');
			delete process.env.HOROSA_ALLOW_UNATTENDED_APPROVAL;
		});
	});
});
