/**
 * @jest-environment node
 */
// 无头接口(Horosa-Web/astrostudyui/headless)合同:
//  ① 与桌面壳逐项对拍常量(协议版本 / 握手说明 / 工具名禁词 / REST 前缀与 GET 简写 / 终端命令简写 / 错误码)—— 两边漂了就红;
//  ② 协议层:握手、工具筛选与投影、参数校验、进度通知、取消、页面错误映射、批量拒绝、通知不回包;
//  ③ 终端命令参数解析与人读输出。
// HTTP 服务与终端命令真连(要 Node 自带的 fetch,jest 的 node 环境没有)在 headless/test/server.test.js(node --test),preflight 同跑。
const fs = require('fs');
const os = require('os');
const path = require('path');

const HEADLESS = path.resolve(__dirname, '../../../headless');
const TAURI_SRC = path.resolve(__dirname, '../../../../../Horosa_Desktop_Installer/src-tauri/src');
const protocol = require(path.join(HEADLESS, 'protocol'));
const rest = require(path.join(HEADLESS, 'rest'));
const cli = require(path.join(HEADLESS, 'cli'));

// horosa_win_shell_const_v1(Windows 侧移植适配):Windows 壳是 Electron,MCP / REST / 终端命令的同名常量住在
// desktop_installer_bundle/electron/{mcp-core,rest-api,horosa-cli}.js(纯 JS,直接 require 取值)。Tauri 源缺席时 ① / ② 与它们逐项对拍,
// 判据零放宽(同一组常量、同一份用例表、同一份 OpenAPI 请求头、同一种投页预算)。逐句换取值处而不另起一组:
// 上游再加读 Rust 源的断言,在 Windows 上会直接红(找不到文件),不会静默少测。
const ELECTRON_SRC = path.resolve(__dirname, '../../../../../../../desktop_installer_bundle/electron');
const EL = fs.existsSync(TAURI_SRC) ? null : {
	core: require(path.join(ELECTRON_SRC, 'mcp-core.js')),
	rest: require(path.join(ELECTRON_SRC, 'rest-api.js')),
	cli: require(path.join(ELECTRON_SRC, 'horosa-cli.js')),
	src: (f)=>fs.readFileSync(path.join(ELECTRON_SRC, f), 'utf8'),
};

const read = (f)=>fs.readFileSync(path.join(TAURI_SRC, f), 'utf8');
const strings = (s)=>Array.from(s.matchAll(/"([^"]*)"/g)).map((m)=>m[1]);

describe('① 与桌面壳逐项对拍', ()=>{
	const mcp = EL ? EL.src('mcp-core.js') : read('mcp_server.rs');
	const restRs = EL ? EL.src('rest-api.js') : read('rest_api.rs');
	const cliRs = EL ? EL.src('horosa-cli.js') : read('horosa_cli.rs');
	it('🔴 协议版本 / 最新版 / 握手说明 / 工具名禁词 / 错误码', ()=>{
		expect(EL ? EL.core.MCP_PROTOCOL_VERSIONS : strings(/pub const MCP_PROTOCOL_VERSIONS: \[&str; \d+\] =\s*\[([^\]]*)\]/.exec(mcp)[1])).toEqual(protocol.PROTOCOL_VERSIONS);
		expect(EL ? EL.core.MCP_LATEST_PROTOCOL : /pub const MCP_LATEST_PROTOCOL: &str = "([^"]+)"/.exec(mcp)[1]).toBe(protocol.LATEST_PROTOCOL);
		expect(EL ? EL.core.INSTRUCTIONS : /fn instructions\(\) -> &'static str \{\s*"([^"]+)"/.exec(mcp)[1]).toBe(protocol.INSTRUCTIONS);
		expect(EL ? strings(/const DENIED_TOOL_WORDS = \[([^\]]*)\]/.exec(mcp)[1].replace(/'/g, '"')) : strings(/const DENIED: \[&str; \d+\] = \[([^\]]*)\]/.exec(mcp)[1])).toEqual(protocol.DENIED_NAME_WORDS);
		const code = (n)=>(EL ? EL.core[`ERR_${n}`] : Number(new RegExp(`pub const ERR_${n}: i64 = (-?\\d+);`).exec(mcp)[1]));
		expect({ PARSE: code('PARSE'), INVALID_REQUEST: code('INVALID_REQUEST'), METHOD_NOT_FOUND: code('METHOD_NOT_FOUND'), INVALID_PARAMS: code('INVALID_PARAMS'), INTERNAL: code('INTERNAL'), NOT_READY: code('NOT_READY'), TIMEOUT: code('TIMEOUT'), RELOADED: code('RELOADED'), RATE_LIMITED: code('RATE_LIMITED'), CANCELLED: code('CANCELLED') }).toEqual({ ...protocol.ERR });
	});
	it('🔴 REST 前缀 / 调用方名 / GET 简写;终端命令简写', ()=>{
		expect(EL ? EL.rest.REST_PREFIX : /pub const REST_PREFIX: &str = "([^"]+)"/.exec(restRs)[1]).toBe(rest.REST_PREFIX);
		expect(EL ? EL.rest.REST_CLIENT_NAME : /pub const REST_CLIENT_NAME: &str = "([^"]+)"/.exec(restRs)[1]).toBe(rest.REST_CLIENT_NAME);
		const aliases = EL ? '' : /pub const GET_ALIASES: \[\(&str, &str\); \d+\] = \[([\s\S]*?)\];/.exec(restRs)[1];
		const pairs = EL ? EL.rest.GET_ALIASES : Array.from(aliases.matchAll(/\("([^"]+)",\s*"([^"]+)"\)/g)).map((m)=>[m[1], m[2]]);
		expect(pairs).toEqual(rest.GET_ALIASES);
		const sc = EL ? '' : /pub const SHORTCUTS: \[\(&str, &str, Option<&str>\); \d+\] = \[([\s\S]*?)\];/.exec(cliRs)[1];
		const rows = EL ? EL.cli.SHORTCUTS : Array.from(sc.matchAll(/\("([^"]+)",\s*"([^"]+)",\s*(None|Some\("([^"]+)"\))\)/g)).map((m)=>[m[1], m[2], m[4] || null]);
		expect(rows).toEqual(cli.SHORTCUTS);
	});
	it('🔴 终端命令带值选项的 --选项=值 写法:桌面壳认的无头必认(此前无头漏了 --idempotency-key=K)', ()=>{
		const desk = Array.from(cliRs.matchAll(EL ? /startsWith\('--([a-z-]+)='\)/g : /strip_prefix\("--([a-z-]+)="\)/g)).map((m)=>m[1]);
		expect(desk.length).toBeGreaterThanOrEqual(4);
		desk.forEach((o)=>{ expect([o, cli.EQ_VALUE_OPTIONS.indexOf(o) >= 0]).toEqual([o, true]); });
		const { opts } = cli.parseArgs(['call', 'x', '--idempotency-key=k2']);
		expect(opts.idempotencyKey).toBe('k2');
	});
	it('🔴 幂等键口径三边同一份用例表(无头协议层;页面注册表与桌面壳各自的用例读同一文件)', ()=>{
		const rows = fs.readFileSync(path.join(__dirname, 'fixtures/idempotencyKeyCases.tsv'), 'utf8').split('\n').filter((l)=>l && !l.startsWith('#')).map((l)=>l.split('\t'));
		expect(rows.length).toBeGreaterThanOrEqual(10);
		rows.forEach(([rawJson, exp, note])=>{
			const n = protocol.idempotencyKeyCheck({ _meta: { idempotencyKey: JSON.parse(rawJson) } });
			const got = n.error ? 'error' : (n.key ? JSON.stringify(n.key) : 'none');
			expect([note, got]).toEqual([note, exp]);
			// 终端命令:合法键收下、空 / 超长是用法错
			if(exp === 'none' || exp === 'error'){ expect(()=>cli.parseArgs(['call', 'x', '--idempotency-key', JSON.parse(rawJson)])).toThrow(/idempotency-key/); }else{ expect(cli.parseArgs(['call', 'x', '--idempotency-key', JSON.parse(rawJson)]).opts.idempotencyKey).toBe(JSON.parse(exp)); }
		});
		expect(protocol.idempotencyKeyCheck({ _meta: { idempotencyKey: 7 } }).error).toBe('not-string');
		// 桌面壳的用例读同一个文件
		expect(EL ? EL.src('mcp.test.js') : mcpSrc()).toMatch(EL ? /path\.join\(fx, 'idempotencyKeyCases\.tsv'\)/ : /include_str!\(\s*"[^"]*fixtures\/idempotencyKeyCases\.tsv"\s*\)/);
	});
	it('🔴 客户端身份两边同一份用例表(_meta.clientName → clientInfo.name → 会话名 → 传输层缺省);桌面壳的用例读同一文件', ()=>{
		const rows = fs.readFileSync(path.join(__dirname, 'fixtures/clientIdentityCases.tsv'), 'utf8').split('\n').filter((l)=>l && !l.startsWith('#')).map((l)=>l.split('\t'));
		expect(rows.length).toBeGreaterThanOrEqual(10);
		rows.forEach(([metaJson, sessJson, transJson, expJson, note])=>{
			expect([note, protocol.clientIdentityOf({ _meta: JSON.parse(metaJson) }, JSON.parse(sessJson), JSON.parse(transJson))]).toEqual([note, JSON.parse(expJson)]);
		});
		expect(EL ? EL.src('mcp.test.js') : mcpSrc()).toMatch(EL ? /path\.join\(fx, 'clientIdentityCases\.tsv'\)/ : /include_str!\(\s*"[^"]*fixtures\/clientIdentityCases\.tsv"\s*\)/);
	});
	it('🔴 两份 OpenAPI 的 POST /tools/{name} 都写出 Idempotency-Key 请求头', ()=>{
		const doc = rest.openApiDoc([{ name: 'create_chart_record', inputSchema: { type: 'object' } }], '9.9.9');
		const h = doc.paths['/tools/create_chart_record'].post.parameters.find((x)=>x.name === 'Idempotency-Key');
		expect(h).toMatchObject({ in: 'header', required: false, schema: { type: 'string', maxLength: 200 } });
		if(EL){ expect(EL.rest.openapiDoc([{ name: 'create_chart_record', inputSchema: { type: 'object' } }], '9.9.9').paths['/tools/create_chart_record'].post.parameters.find((x)=>x.name === 'Idempotency-Key')).toMatchObject({ in: 'header', required: false, schema: { type: 'string', maxLength: 200 } }); }else{ expect(restRs).toMatch(/"name": "Idempotency-Key", "in": "header"/); }
	});
});
const mcpSrc = ()=>fs.readFileSync(path.join(TAURI_SRC, 'mcp_server.rs'), 'utf8');

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
			proposal(op, id){ return { ok: true, op, id }; },
		},
		async dispatch(method, params, opts){
			calls.push({ method, params, opts: { clientName: opts && opts.clientName, sessionId: opts && opts.sessionId } });
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
	return rt;
}

describe('② 协议层', ()=>{
	const h = (msg, o)=>protocol.handleMessage(msg, { rt: fakeRt(), version: '9.9.9', ...(o || {}) });
	it('🔴 握手版本协商 / 说明带无头注;通知不回包;批量拒绝;坏请求', async ()=>{
		const a = await h({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
		expect(a.result.protocolVersion).toBe('2025-06-18');
		expect(a.result.serverInfo).toEqual({ name: 'horosa', version: '9.9.9' });
		expect(a.result.instructions).toContain('无头模式');
		expect((await h({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '1999-01-01' } })).result.protocolVersion).toBe(protocol.LATEST_PROTOCOL);
		expect(await h({ jsonrpc: '2.0', method: 'notifications/initialized' })).toBe(null);
		expect((await h([{ jsonrpc: '2.0', id: 1, method: 'ping' }])).error.code).toBe(-32600);
		expect((await h({ id: 1, method: 'ping' })).error.code).toBe(-32600);
		expect((await h({ jsonrpc: '2.0', id: 3, method: 'nope' })).error.code).toBe(-32601);
	});
	it('🔴 工具清单:只放行读 / 只增级且名字合规;内部字段不出', async ()=>{
		const r = await h({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
		expect(r.result.tools.map((t)=>t.name)).toEqual(['list_records', 'create_chart_record']);
		expect(r.result.tools[0]).toEqual({ name: 'list_records', title: '列档案', description: '列出\n第二行', inputSchema: { type: 'object' }, outputSchema: { type: 'object' }, annotations: { readOnlyHint: true } });
		expect(r.result.tools[1].level).toBeUndefined();
	});
	it('🔴 调用:坏名 / 坏参数 -32602;进度按 progressToken 发通知;结果带结构化内容;页面错误原样映射;已取消 -32800', async ()=>{
		expect((await h({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'Bad-Name' } })).error.code).toBe(-32602);
		expect((await h({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'list_records', arguments: [1] } })).error.code).toBe(-32602);
		const notes = [];
		const r = await h({ jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'list_records', arguments: { q: 1 }, _meta: { progressToken: 't1' } } }, { onNotification: (n)=>notes.push(n) });
		expect(r.result).toEqual({ content: [{ type: 'text', text: 'called list_records' }], isError: false, structuredContent: { echo: { q: 1 } } });
		expect(notes.map((n)=>[n.method, n.params.progressToken, n.params.progress])).toEqual([['notifications/progress', 't1', 1], ['notifications/progress', 't1', 2]]);
		const bad = await protocol.handleMessage({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'list_records' } }, { rt: fakeRt({ 'tools/call': ()=>({ ok: false, error: { code: -32004, message: 'rate', data: { retryAfterMs: 500 } } }) }) });
		expect(bad.error).toEqual({ code: -32004, message: 'rate', data: { retryAfterMs: 500 } });
		expect((await h({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'list_records' } }, { signal: { aborted: true } })).error.code).toBe(-32800);
	});
	it('🔴 超时预算钳 1..600 s,缺省 120 s;投给页面的是原值(与桌面壳同口径;页面桥自己只减一次 3 s 收口余量)', async ()=>{
		expect(protocol.timeoutOf({})).toBe(120000);
		expect(protocol.timeoutOf({ _meta: { timeoutMs: 5 } })).toBe(1000);
		expect(protocol.timeoutOf({ _meta: { timeoutMs: 9e9 } })).toBe(600000);
		const rt = fakeRt();
		await protocol.handleMessage({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'list_records', _meta: { timeoutMs: 10000 } } }, { rt });
		const headlessMeta = rt.calls[0].params._meta;
		expect(headlessMeta.timeoutMs).toBe(10000);
		// 桌面壳投的也是原值(`"timeoutMs": timeout.as_millis()`):同一客户端预算下两边页面实得预算相同
		expect(EL ? EL.src('mcp-core.js') : read('mcp_server.rs')).toMatch(EL ? /_meta: \{ timeoutMs: timeout, / : /"_meta": \{ "timeoutMs": timeout\.as_millis\(\) as u64 \}/);
		const { bridgeTimeoutMs } = require('../aiAgent/withTimeout');
		expect(bridgeTimeoutMs(headlessMeta)).toBe(bridgeTimeoutMs({ timeoutMs: 10000 }));
		expect(bridgeTimeoutMs(headlessMeta)).toBe(7000);
	});
	it('🔴 每条请求的客户端身份经 clientIdentityOf:会话名缺省、逐条 clientName / clientInfo 优先;各传输层不再自己读 _meta', async ()=>{
		const rt = fakeRt();
		await protocol.handleMessage({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'list_records' } }, { rt, clientName: 'http', sessionClient: 'claude-code' });
		await protocol.handleMessage({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'list_records', _meta: { 'io.modelcontextprotocol/clientInfo': { name: 'cursor' } } } }, { rt, clientName: 'http', sessionClient: 'claude-code' });
		await protocol.handleMessage({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'list_records' } }, { rt, clientName: 'http' });
		await protocol.handleMessage({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'list_records' } }, { rt });
		expect(rt.calls.map((c)=>c.opts.clientName)).toEqual(['claude-code', 'cursor', 'http', 'external']);
		const srcs = ['server.js', 'stdio.js', 'cli.js'].map((f)=>[f, fs.readFileSync(path.join(HEADLESS, f), 'utf8')]);
		srcs.forEach(([f, src])=>{
			expect([f, /_meta\.clientName\s*\?/.test(src), /clientInfo\.name\s*\)?\s*\{\s*clientName\s*=/.test(src)]).toEqual([f, false, false]);
		});
	});
	it('🔴 超长幂等键 = 参数错(-32602),不投递页面;会话身份随调用透给运行时(限流按会话分桶)', async ()=>{
		const rt = fakeRt();
		const r = await protocol.handleMessage({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'list_records', _meta: { idempotencyKey: '😀'.repeat(201) } } }, { rt });
		expect(r.error.code).toBe(protocol.ERR.INVALID_PARAMS);
		expect(rt.calls.length).toBe(0);
		await protocol.handleMessage({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'list_records', _meta: { idempotencyKey: '😀'.repeat(200) } } }, { rt, sessionId: 's-1' });
		expect(rt.calls[0].params._meta.idempotencyKey).toBe('😀'.repeat(200));
		expect(rt.calls[0].opts.sessionId).toBe('s-1');
	});
});

describe('③ 终端命令参数解析', ()=>{
	it('🔴 参数解析:全局开关任意位置 / k=v / k:=JSON / - / 用法错', ()=>{
		const p = cli.parseArgs(['call', 'x', '--json', '--timeout', '30', 'a=1']);
		expect([p.cmd, p.rest, p.opts.json, p.opts.timeout]).toEqual(['call', ['x', 'a=1'], true, 30]);
		expect(cli.parseArgs(['--version']).cmd).toBe('version');
		expect(cli.parseArgs(['tools', '--timeout=12']).opts.timeout).toBe(12);
		expect(()=>cli.parseArgs(['tools', '--bogus'])).toThrow('不认识的选项');
		expect(()=>cli.parseArgs(['tools', '--timeout', '0'])).toThrow('1..600');
		expect(cli.buildArguments(['{"a":1}', 'b=2', 'c:=[1]', 'd=x=y', '-'])).toEqual({ args: { a: 1, b: '2', c: [1], d: 'x=y' }, stdin: true });
		expect(()=>cli.buildArguments(['oops'])).toThrow('看不懂的参数');
		expect(cli.fmtProgress({ progress: 2, total: 3, message: '起盘' })).toBe('[2/3] 起盘');
		expect(cli.fmtTools([{ name: 'a', title: 'T', description: 'd', annotations: { readOnlyHint: true } }])).toContain('a  只读  T — d');
	});

});
