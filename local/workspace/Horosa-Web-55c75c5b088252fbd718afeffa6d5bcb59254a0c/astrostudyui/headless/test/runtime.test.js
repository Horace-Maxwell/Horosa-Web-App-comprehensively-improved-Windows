// 无头落盘层与会话生命周期的行为合同(node --test;真文件、真运行时、真子进程,数据全在临时目录,零窗口、不起后端):
//  ① 数据文件坏了 → 原样改名留档、从空开始,绝不被下一次落盘覆盖(localStorage 与对话等存储区两处)
//  ② 落盘失败(目录不可写)不崩进程、保留待落盘,恢复可写后补写成功
//  ③ 写入成功回包后立刻收到 SIGTERM → 数据已在盘上(此前去抖中的写入会丢)
//  ④ 限流桶不随自报名(clientName)分:换名字换不来新额度
//  ⑤ 两个 stdio 会话共用数据:第二个转发到第一个;./horosa stop 不掐 MCP 会话;第一个关掉后第二个自动接管、数据读得回
// 跑法:node --test Horosa-Web/astrostudyui/headless/test/server.test.js Horosa-Web/astrostudyui/headless/test/runtime.test.js(preflight 与 ./horosa selftest 同跑)。
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');

const CLI = path.join(__dirname, '..', 'cli.js');
const RUNTIME = path.join(__dirname, '..', 'runtime.js');
const tmpHome = ()=>fs.mkdtempSync(path.join(os.tmpdir(), 'horosa-rt-test-'));
const sleep = (ms)=>new Promise((r)=>setTimeout(r, ms));
async function until(fn, ms, step){
	const end = Date.now() + ms;
	while(Date.now() < end){ if(await fn()){ return true; } await sleep(step || 100); }   // eslint-disable-line no-await-in-loop
	return false;
}
const baseEnv = (home)=>({ ...process.env, HOROSA_HOME: home, HOROSA_NO_AUTOSTART: '1', HOROSA_HEADLESS_PORT: '0' });
// 起过的子进程:断言失败时也要收掉(否则留着的会话占着管道,测试进程退不出、整轮卡死)
const CHILDREN = new Set();
const track = (c)=>{ CHILDREN.add(c); c.once('exit', ()=>CHILDREN.delete(c)); return c; };
after(()=>{ CHILDREN.forEach((c)=>{ try{ c.kill('SIGKILL'); }catch(e){ /* noop */ } }); });

describe('① 坏数据文件改名留档,不被覆盖', ()=>{
	it('🔴 localStorage.json 坏了:改名留档、从空开始,写入后原文件内容仍在留档里', async ()=>{
		const home = tmpHome();
		const file = path.join(home, 'localStorage.json');
		fs.writeFileSync(file, '{"charts":"张三的命盘",}');   // 尾逗号 = 坏 JSON
		const { createFileStorage } = require(RUNTIME);
		const errs = [];
		const orig = process.stderr.write.bind(process.stderr);
		process.stderr.write = (s)=>{ errs.push(`${s}`); return true; };
		let st;
		try{ st = createFileStorage(file); }finally{ process.stderr.write = orig; }
		const kept = fs.readdirSync(home).filter((f)=>f.startsWith('localStorage.json.corrupt-'));
		assert.equal(kept.length, 1, '坏文件应改名留档');
		assert.equal(fs.readFileSync(path.join(home, kept[0]), 'utf8'), '{"charts":"张三的命盘",}');
		assert.ok(errs.join('').includes('改名留档'), '应在标准错误里说明');
		st.setItem('k', 'v');
		st.__flush();
		assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { k: 'v' });
		assert.equal(fs.readFileSync(path.join(home, kept[0]), 'utf8'), '{"charts":"张三的命盘",}', '留档不得被覆盖');
	});
	it('🔴 内容不是键值对象(数组)也按坏文件处理', ()=>{
		const home = tmpHome();
		const file = path.join(home, 'localStorage.json');
		fs.writeFileSync(file, '[1,2,3]');
		const { createFileStorage } = require(RUNTIME);
		const orig = process.stderr.write.bind(process.stderr);
		process.stderr.write = ()=>true;
		try{ createFileStorage(file); }finally{ process.stderr.write = orig; }
		assert.equal(fs.readdirSync(home).filter((f)=>f.startsWith('localStorage.json.corrupt-')).length, 1);
	});
	it('🔴 对话等存储区(stores/*.json)坏了:读时改名留档、当空,随后的保存不覆盖留档', async ()=>{
		const home = tmpHome();
		const dir = path.join(home, 'stores');
		fs.mkdirSync(dir);
		fs.writeFileSync(path.join(dir, 'conversations.json'), '[["c1",{"title":"断事记录"}]');   // 截断
		const { installStoreHook } = require(RUNTIME);
		const flush = installStoreHook(dir);
		const orig = process.stderr.write.bind(process.stderr);
		process.stderr.write = ()=>true;
		let loaded;
		try{ loaded = globalThis.__HOROSA_HEADLESS_STORE__.load('conversations'); }finally{ process.stderr.write = orig; }
		assert.equal(loaded, null);
		const kept = fs.readdirSync(dir).filter((f)=>f.startsWith('conversations.json.corrupt-'));
		assert.equal(kept.length, 1);
		globalThis.__HOROSA_HEADLESS_STORE__.save('conversations', [['c2', { title: '新' }]]);
		flush();
		assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'conversations.json'), 'utf8')), [['c2', { title: '新' }]]);
		assert.equal(fs.readFileSync(path.join(dir, kept[0]), 'utf8'), '[["c1",{"title":"断事记录"}]');
	});
});

describe('② 落盘失败不崩、恢复后补写', ()=>{
	it('🔴 目录不可写:不抛、不丢,改回可写后自动补写', async ()=>{
		const home = tmpHome();
		const dir = path.join(home, 'ro');
		fs.mkdirSync(dir);
		const file = path.join(dir, 'localStorage.json');
		const { createFileStorage } = require(RUNTIME);
		const st = createFileStorage(file);
		fs.chmodSync(dir, 0o500);
		const orig = process.stderr.write.bind(process.stderr);
		const errs = [];
		process.stderr.write = (s)=>{ errs.push(`${s}`); return true; };
		try{
			st.setItem('a', '1');
			await sleep(400);   // 150 ms 去抖后落盘失败 → 不抛(抛了 = 进程崩,本测试也跑不到下面)
			assert.equal(fs.existsSync(file), false);
			assert.ok(errs.join('').includes('落盘失败'), '应报落盘失败');
			fs.chmodSync(dir, 0o700);
			assert.ok(await until(()=>fs.existsSync(file), 6000), '恢复可写后应自动补写');
			assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { a: '1' });
		}finally{
			process.stderr.write = orig;
			try{ fs.chmodSync(dir, 0o700); }catch(e){ /* noop */ }
		}
	});
});

// 子进程里起真运行时跑一段脚本;stdout 每行一条 JSON
function runtimeChild(home, body){
	const script = `
		const { createRuntime } = require(${JSON.stringify(RUNTIME)});
		const say = (o)=>process.stdout.write(JSON.stringify(o) + '\\n');
		(async ()=>{ const rt = await createRuntime({ quiet: true }); ${body} })().catch((e)=>{ say({ fatal: e && e.stack ? e.stack : String(e) }); process.exit(9); });
	`;
	return track(spawn(process.execPath, ['-e', script], { env: baseEnv(home), stdio: ['ignore', 'pipe', 'pipe'] }));
}
function lines(child, onLine){
	const got = [];
	let buf = '';
	child.stdout.on('data', (d)=>{ buf += d; let i; while((i = buf.indexOf('\n')) >= 0){ const l = buf.slice(0, i); buf = buf.slice(i + 1); let m; try{ m = JSON.parse(l); }catch(e){ m = { raw: l }; } got.push(m); if(onLine){ onLine(m); } } });
	return got;
}
const exited = (child)=>new Promise((r)=>{ if(child.exitCode !== null || child.signalCode){ r(child.exitCode); return; } child.once('exit', (c)=>r(c)); });

describe('③ SIGTERM 不丢刚写入的数据', ()=>{
	it('🔴 建档成功回包后立刻 SIGTERM → 档案已在盘上', { timeout: 120000 }, async ()=>{
		const home = tmpHome();
		const child = runtimeChild(home, `
			const r = await rt.dispatch('tools/call', { name: 'create_chart_record', arguments: { name: '信号测试', birth: '1990-01-01 08:00', place: '北京', gender: 'male' } }, { clientName: 'test' });
			// 回包前再写一笔(落在 150 ms 去抖窗口里):没有信号处理时,SIGTERM 一到这一笔必丢
			rt.storage.setItem('horosa.test.lastWrite', 'just-before-sigterm');
			say({ ok: !!(r && r.ok && r.result && !r.result.isError), cid: r && r.result && r.result.structuredContent && r.result.structuredContent.cid });
			setInterval(()=>{}, 1000);
		`);
		// 收到回话当场发信号(不能轮询:轮询间隔一长,150 ms 的去抖早就自己落盘了,测不出来)
		const got = lines(child, ()=>{ child.kill('SIGTERM'); });
		assert.ok(await until(()=>got.length > 0, 90000), '子进程没回话');
		assert.ok(got[0].ok && got[0].cid, JSON.stringify(got[0]));
		await exited(child);
		const file = path.join(home, 'headless', 'data', 'localStorage.json');
		assert.ok(fs.existsSync(file), 'SIGTERM 后数据文件应已落盘');
		const text = fs.readFileSync(file, 'utf8');
		assert.ok(text.includes(got[0].cid), '刚建的档案应在盘上');
		assert.ok(text.includes('just-before-sigterm'), '去抖窗口里的最后一笔写入应在盘上');
	});
});

describe('④ 限流桶不随自报名分', ()=>{
	it('🔴 70 次调用、每次换一个 clientName:超出每分钟上限的被拒', { timeout: 120000 }, async ()=>{
		const home = tmpHome();
		const child = runtimeChild(home, `
			let ok = 0, limited = 0;
			for(let i = 0; i < 70; i++){
				const r = await rt.dispatch('tools/call', { name: 'list_records', arguments: {} }, { clientName: 'rotating-' + i });
				const t = r && r.result && r.result.content && r.result.content[0] ? r.result.content[0].text : '';
				if(r && r.ok && r.result && !r.result.isError){ ok++; }else if(/E_LIMIT/.test(t) || (r && r.error && /上限|limit/i.test(r.error.message || ''))){ limited++; }
			}
			say({ ok, limited });
			process.exit(0);
		`);
		const got = lines(child);
		await exited(child);
		assert.ok(got.length > 0, '子进程没回话');
		assert.ok(got[0].limited > 0 && got[0].ok <= 60, `换名字绕过了限流:${JSON.stringify(got[0])}`);
	});
});

// stdio MCP 会话:逐行写请求、按 id 收回包
function mcpSession(home, extraEnv){
	const child = track(spawn(process.execPath, [CLI, 'mcp'], { env: { ...baseEnv(home), ...(extraEnv || {}) }, stdio: ['pipe', 'pipe', 'pipe'] }));
	const replies = new Map();
	let buf = '';
	let stdoutJunk = 0;
	child.stdout.on('data', (d)=>{
		buf += d;
		let i;
		while((i = buf.indexOf('\n')) >= 0){
			const l = buf.slice(0, i); buf = buf.slice(i + 1);
			if(!l.trim()){ continue; }
			try{ const m = JSON.parse(l); if(m.id !== undefined){ replies.set(JSON.stringify(m.id), m); } }catch(e){ stdoutJunk += 1; }
		}
	});
	let err = '';
	child.stderr.on('data', (d)=>{ err += d; });
	return {
		child,
		send(m){ child.stdin.write(`${JSON.stringify(m)}\n`); },
		async reply(id, ms){ const k = JSON.stringify(id); await until(()=>replies.has(k), ms || 60000); return replies.get(k); },
		junk: ()=>stdoutJunk,
		err: ()=>err,
	};
}
function runCli(home, args){
	return new Promise((resolve)=>{
		const c = track(spawn(process.execPath, [CLI, ...args], { env: baseEnv(home), stdio: ['ignore', 'pipe', 'pipe'] }));
		let out = ''; let err = '';
		c.stdout.on('data', (d)=>{ out += d; }); c.stderr.on('data', (d)=>{ err += d; });
		c.on('close', (code)=>resolve({ code, out, err }));
	});
}

describe('⑤ 两个 stdio 会话共用数据', ()=>{
	it('🔴 第二个转发到第一个;stop 不掐 MCP 会话;第一个关掉后第二个接管、数据读得回;标准输出只有协议', { timeout: 240000 }, async ()=>{
		const home = tmpHome();
		const epFile = path.join(home, 'headless', 'endpoint.json');
		const a = mcpSession(home);
		a.send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test-a', version: '1' } } });
		assert.ok(await a.reply(1, 90000), `A 握手没回:${a.err().slice(-400)}`);
		assert.ok(await until(()=>{ try{ return JSON.parse(fs.readFileSync(epFile, 'utf8')).role === 'mcp'; }catch(e){ return false; } }, 30000), 'A 应挂出 role=mcp 的端点');
		const b = mcpSession(home);
		b.send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test-b', version: '1' } } });
		assert.ok(await b.reply(1, 60000), `B 握手没回:${b.err().slice(-400)}`);
		// 同一个 id 在两个会话里各发一次:各自拿到自己的回包(转发时改写了 id,不串)
		b.send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'create_chart_record', arguments: { name: '接管测试', birth: '1991-02-03 04:05', place: '上海', gender: 'female' } } });
		a.send({ jsonrpc: '2.0', id: 2, method: 'ping' });
		const b2 = await b.reply(2, 90000);
		const a2 = await a.reply(2, 30000);
		assert.ok(b2 && b2.result && !b2.result.isError, `B 建档失败:${JSON.stringify(b2).slice(0, 300)}`);
		assert.deepEqual(a2 && a2.result, {});
		// stop:端点由 MCP 会话托管 → 不动它
		const st = await runCli(home, ['stop']);
		assert.ok(st.err.includes('MCP 会话托管'), st.err);
		assert.equal(a.child.exitCode, null, 'stop 掐掉了 MCP 会话');
		// A 的客户端关会话(关标准输入)→ A 退出
		a.child.stdin.end();
		await exited(a.child);
		// B 之后的请求:自动接管,数据读得回
		b.send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'list_records', arguments: { query: '接管测试' } } });
		const b3 = await b.reply(3, 90000);
		assert.ok(b3 && b3.result && !b3.result.isError, `A 关掉后 B 失联:${JSON.stringify(b3).slice(0, 300)} ${b.err().slice(-400)}`);
		assert.equal(b3.result.structuredContent && b3.result.structuredContent.total, 1);
		assert.equal(a.junk() + b.junk(), 0, '标准输出混进了非协议内容');
		b.child.stdin.end();
		await exited(b.child);
		assert.equal(fs.existsSync(epFile), false, '会话都关了,端点文件应已摘掉');
		assert.equal(fs.existsSync(path.join(home, 'headless', 'data', '.lock')), false, '数据锁应已放开');
	});
});

// 子进程里先打桩 fetch(记下请求 URL 与请求体,回空结果;不向任何后端发请求)再起真运行时
function stubbedRuntimeChild(home, env, body){
	const script = `
		const seen = [];
		globalThis.fetch = async (url, init)=>{ seen.push({ url: String(url), body: init && init.body ? String(init.body) : '' }); return new Response(JSON.stringify({ items: [], total: 0, events: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }); };
		const { createRuntime } = require(${JSON.stringify(RUNTIME)});
		const say = (o)=>process.stdout.write(JSON.stringify(o) + '\\n');
		(async ()=>{ const rt = await createRuntime({ quiet: true }); ${body}; process.exit(0); })().catch((e)=>{ say({ fatal: e && e.stack ? e.stack : String(e) }); process.exit(9); });
	`;
	const e = { ...baseEnv(home), ...env };
	Object.keys(e).forEach((k)=>{ if(e[k] === undefined){ delete e[k]; } });
	return track(spawn(process.execPath, ['-e', script], { env: e, stdio: ['ignore', 'pipe', 'pipe'] }));
}
async function childSays(child){
	const got = lines(child);
	let errText = '';
	child.stderr.on('data', (d)=>{ errText += d; });
	await exited(child);
	assert.ok(got.length && !got.some((m)=>m.fatal), `子进程失败:${JSON.stringify(got).slice(0, 600)} ${errText.slice(-400)}`);
	return got;
}
const NO_PORT_ENV = { HOROSA_SERVER_ROOT: undefined, HOROSA_SERVER_PORT: undefined, HOROSA_CHART_PORT: undefined };

describe('⑥ 检索词简繁写法:无头里转换器真加载(不是原样返回的空壳)', ()=>{
	it('🔴 search_xuanshi 查「荧惑」:请求体带 q_any 且含「熒惑」;反过来查「熒惑」带「荧惑」', { timeout: 120000 }, async ()=>{
		const got = await childSays(stubbedRuntimeChild(tmpHome(), NO_PORT_ENV, `
			for(const q of ['荧惑', '熒惑']){
				seen.length = 0;
				await rt.dispatch('tools/call', { name: 'search_xuanshi', arguments: { query: q, kind: 'events' } }, { clientName: 'test' });
				const hit = seen.find((s)=>/\\/xuanshi\\//.test(s.url));
				say({ q, body: hit ? JSON.parse(hit.body) : null });
			}
		`));
		const byQ = Object.fromEntries(got.map((m)=>[m.q, m.body]));
		assert.ok(byQ['荧惑'] && Array.isArray(byQ['荧惑'].q_any) && byQ['荧惑'].q_any.includes('熒惑'), JSON.stringify(byQ['荧惑']));
		assert.ok(byQ['熒惑'] && Array.isArray(byQ['熒惑'].q_any) && byQ['熒惑'].q_any.includes('荧惑'), JSON.stringify(byQ['熒惑']));
	});
	it('🔴 list_records:繁体检索词找得到简体名档案,简体检索词找得到繁体名档案', { timeout: 120000 }, async ()=>{
		const got = await childSays(stubbedRuntimeChild(tmpHome(), NO_PORT_ENV, `
			const mk = (name)=>rt.dispatch('tools/call', { name: 'create_chart_record', arguments: { name, birth: '1990-01-01 08:00', place: '北京', gender: 'male' } }, { clientName: 'test' });
			await mk('张三丰'); await mk('劉備');
			const ls = async (query)=>{ const r = await rt.dispatch('tools/call', { name: 'list_records', arguments: { query } }, { clientName: 'test' }); return r.result.structuredContent.items.map((it)=>it.title); };
			say({ trad: await ls('張三豐'), simp: await ls('刘备'), same: await ls('张三丰') });
		`));
		assert.deepEqual(got[0].trad, ['张三丰']);
		assert.deepEqual(got[0].simp, ['劉備']);
		assert.deepEqual(got[0].same, ['张三丰']);
	});
});

describe('⑦ 后端端口单一来源:探测 / 起服务脚本 / 运行时同一份', ()=>{
	const { backendPorts, backendPortEnv } = require(path.join(__dirname, '..', 'ports.js'));
	it('🔴 HOROSA_CHART_PORT=8900:卜类 / 玄史请求发往 8900(不是 8899)', { timeout: 120000 }, async ()=>{
		const got = await childSays(stubbedRuntimeChild(tmpHome(), { ...NO_PORT_ENV, HOROSA_CHART_PORT: '8900' }, `
			await rt.dispatch('tools/call', { name: 'search_xuanshi', arguments: { query: 'abc', kind: 'events' } }, { clientName: 'test' });
			say({ urls: seen.map((s)=>s.url), serverRoot: rt.serverRoot, chartRoot: rt.chartRoot });
		`));
		assert.equal(got[0].chartRoot, 'http://127.0.0.1:8900');
		assert.equal(got[0].serverRoot, 'http://127.0.0.1:9999');
		assert.ok(got[0].urls.length && got[0].urls.every((u)=>u.startsWith('http://127.0.0.1:8900/xuanshi/')), JSON.stringify(got[0].urls));
	});
	it('🔴 HOROSA_SERVER_ROOT=…:9100:卜类请求不打到 Java 9100(Java 没有这些路由),仍发往排盘服务口', { timeout: 120000 }, async ()=>{
		const got = await childSays(stubbedRuntimeChild(tmpHome(), { ...NO_PORT_ENV, HOROSA_SERVER_ROOT: 'http://127.0.0.1:9100' }, `
			await rt.dispatch('tools/call', { name: 'search_xuanshi', arguments: { query: 'abc', kind: 'events' } }, { clientName: 'test' });
			say({ urls: seen.map((s)=>s.url) });
		`));
		assert.ok(got[0].urls.length && got[0].urls.every((u)=>u.startsWith('http://127.0.0.1:8899/xuanshi/')), JSON.stringify(got[0].urls));
	});
	it('🔴 只设 HOROSA_SERVER_ROOT 时,起服务脚本拿到的 HOROSA_SERVER_PORT 与之同口', ()=>{
		const p = backendPorts({}, { HOROSA_SERVER_ROOT: 'http://127.0.0.1:9100/' });
		assert.equal(p.server, 9100);
		assert.equal(p.chart, 8899);
		assert.equal(p.remote, false);
		assert.deepEqual(backendPortEnv(p), { HOROSA_SERVER_PORT: '9100', HOROSA_CHART_PORT: '8899' });
		const cli = require(CLI);
		const keep = { root: process.env.HOROSA_SERVER_ROOT, port: process.env.HOROSA_SERVER_PORT, chart: process.env.HOROSA_CHART_PORT };
		try{
			process.env.HOROSA_SERVER_ROOT = 'http://127.0.0.1:9100';
			delete process.env.HOROSA_SERVER_PORT; delete process.env.HOROSA_CHART_PORT;
			const env = cli.backendEnv();
			assert.equal(env.HOROSA_SERVER_PORT, '9100');
			assert.equal(env.HOROSA_CHART_PORT, '8899');
		}finally{
			const put = (k, v)=>{ if(v === undefined){ delete process.env[k]; }else{ process.env[k] = v; } };
			put('HOROSA_SERVER_ROOT', keep.root); put('HOROSA_SERVER_PORT', keep.port); put('HOROSA_CHART_PORT', keep.chart);
		}
	});
	it('🔴 端口写错 / 两处不一致 / 根不是 http 地址 → 用法错(不拼出 NaN)', ()=>{
		assert.throws(()=>backendPorts({}, { HOROSA_SERVER_PORT: '9100 HOROSA_CHART_PORT=8900' }), /不是端口号/);
		assert.throws(()=>backendPorts({}, { HOROSA_CHART_PORT: '0' }), /超出端口范围/);
		assert.throws(()=>backendPorts({}, { HOROSA_CHART_PORT: '70000' }), /超出端口范围/);
		assert.throws(()=>backendPorts({}, { HOROSA_SERVER_ROOT: 'http://127.0.0.1:9100', HOROSA_SERVER_PORT: '9999' }), /不一致/);
		assert.throws(()=>backendPorts({}, { HOROSA_SERVER_ROOT: 'ftp://127.0.0.1:9100' }), /http\(s\)/);
		assert.throws(()=>backendPorts({}, { HOROSA_SERVER_ROOT: 'not a url' }), /http\(s\)/);
		assert.deepEqual(backendPorts({}, {}), { server: 9999, chart: 8899, host: '127.0.0.1', remote: false, serverRoot: 'http://127.0.0.1:9999', chartRoot: 'http://127.0.0.1:8899', probeHosts: ['127.0.0.1', '::1'] });
	});
	it('🔴 地址在别的机器:remote = true(不在本机起 / 停服务);本机回环三种写法都不算', ()=>{
		assert.equal(backendPorts({}, { HOROSA_SERVER_ROOT: 'http://10.0.0.5:9999' }).remote, true);
		assert.equal(backendPorts({}, { HOROSA_SERVER_ROOT: 'http://10.0.0.5:9999' }).chartRoot, 'http://10.0.0.5:8899');
		['http://127.0.0.1:9999', 'http://localhost:9999', 'http://[::1]:9999'].forEach((r)=>assert.equal(backendPorts({}, { HOROSA_SERVER_ROOT: r }).remote, false, r));
	});
	it('🔴 localhost 不经名字解析:规范成 127.0.0.1(探测与发请求同);本机回环两个地址族都探,远端只探本机', ()=>{
		const p = backendPorts({}, { HOROSA_SERVER_ROOT: 'http://localhost:9100' });
		assert.equal(p.host, '127.0.0.1');
		assert.equal(p.serverRoot, 'http://127.0.0.1:9100');
		assert.equal(p.chartRoot, 'http://127.0.0.1:8899');
		assert.equal(p.remote, false);
		assert.deepEqual(p.probeHosts, ['127.0.0.1', '::1']);
		assert.deepEqual(backendPorts({}, { HOROSA_SERVER_ROOT: 'http://[::1]:9100' }).probeHosts, ['::1', '127.0.0.1']);
		assert.deepEqual(backendPorts({}, { HOROSA_SERVER_ROOT: 'http://10.0.0.5:9999' }).probeHosts, ['10.0.0.5']);
	});
	it('🔴 探测:只在 127.0.0.1 听的服务,根写成 localhost 也判「在跑」(不会被当成没开而回收重启)', { timeout: 20000 }, async ()=>{
		const net = require('net');
		const a = net.createServer(()=>{}).listen(0, '127.0.0.1');
		const b = net.createServer(()=>{}).listen(0, '127.0.0.1');
		await Promise.all([a, b].map((x)=>new Promise((r)=>x.once('listening', r))));
		const cli = require(CLI);
		const keep = { root: process.env.HOROSA_SERVER_ROOT, port: process.env.HOROSA_SERVER_PORT, chart: process.env.HOROSA_CHART_PORT };
		try{
			delete process.env.HOROSA_SERVER_PORT;
			process.env.HOROSA_SERVER_ROOT = `http://localhost:${a.address().port}`;
			process.env.HOROSA_CHART_PORT = `${b.address().port}`;
			const be = await cli.backendsUp();
			assert.equal(be.server, true);
			assert.equal(be.chart, true);
			assert.equal(be.none, false);
		}finally{
			const put = (k, v)=>{ if(v === undefined){ delete process.env[k]; }else{ process.env[k] = v; } };
			put('HOROSA_SERVER_ROOT', keep.root); put('HOROSA_SERVER_PORT', keep.port); put('HOROSA_CHART_PORT', keep.chart);
			await Promise.all([a, b].map((x)=>new Promise((r)=>x.close(r))));
		}
	});
	it('🔴 ./horosa start 遇到只开了一半:不跑起服务脚本(它会把在跑的那个也重启),退出码非 0 并说明', { timeout: 30000 }, async ()=>{
		const net = require('net');
		const listening = net.createServer(()=>{}).listen(0, '127.0.0.1');
		await new Promise((r)=>listening.once('listening', r));
		const closedSrv = net.createServer().listen(0, '127.0.0.1');
		await new Promise((r)=>closedSrv.once('listening', r));
		const closedPort = closedSrv.address().port;
		await new Promise((r)=>closedSrv.close(r));
		const cli = require(CLI);
		const calls = [];
		const errs = [];
		const keep = { root: process.env.HOROSA_SERVER_ROOT, port: process.env.HOROSA_SERVER_PORT, chart: process.env.HOROSA_CHART_PORT, home: process.env.HOROSA_HOME };
		// 记录器回非 0:万一判据回归、真走到起服务这一步,也就此返回,不会再去起无头服务子进程
		cli.__setBackendStarterForTests((o)=>{ calls.push(o); return 1; });
		cli.__setIoForTests({ out: ()=>true, err: (s)=>{ errs.push(`${s}`); return true; } });
		try{
			delete process.env.HOROSA_SERVER_ROOT;
			process.env.HOROSA_HOME = tmpHome();
			process.env.HOROSA_SERVER_PORT = `${listening.address().port}`;
			process.env.HOROSA_CHART_PORT = `${closedPort}`;
			const code = await cli.main(['start']);
			assert.notEqual(code, 0);
			assert.equal(calls.length, 0, '只开了一半时不得跑起服务脚本');
			assert.ok(errs.join('').includes('只开了一半'), errs.join(''));
		}finally{
			cli.__setBackendStarterForTests(null);
			cli.__setIoForTests({ out: (s)=>process.stdout.write(s), err: (s)=>process.stderr.write(s) });
			const put = (k, v)=>{ if(v === undefined){ delete process.env[k]; }else{ process.env[k] = v; } };
			put('HOROSA_SERVER_ROOT', keep.root); put('HOROSA_SERVER_PORT', keep.port); put('HOROSA_CHART_PORT', keep.chart); put('HOROSA_HOME', keep.home);
			await new Promise((r)=>listening.close(r));
		}
	});
});

describe('⑧ 接口密钥 fail-closed:取不到主密钥就不收、绝不明文落盘', ()=>{
	it('🔴 master.key 读不了(是个目录):ai add 带密钥被拒,数据目录里找不到明文密钥;预检与真加密同一条路', { timeout: 120000 }, async ()=>{
		const home = tmpHome();
		fs.mkdirSync(path.join(home, 'headless', 'master.key'), { recursive: true });
		const got = await childSays(stubbedRuntimeChild(home, NO_PORT_ENV, `
			let err = '';
			try{ await rt.admin.aiAdd({ provider: 'openai', apiKey: 'sk-PLAINTEXT-SHOULD-NOT-LAND', models: 'm1', use: false }); }catch(e){ err = e.message; }
			let err2 = '';
			try{ await rt.lib.putStoreRecord(rt.lib.AI_ANALYSIS_STORES.providerProfiles, rt.lib.newProviderProfile({ providerType: 'openai', models: 'm2', apiKey: 'sk-PLAINTEXT-DIRECT-PUT' }), 'provider'); }catch(e){ err2 = e.message; }
			rt.close && rt.close();
			say({ err, err2 });
		`));
		assert.match(got[0].err, /不收密钥|明文/);
		assert.match(got[0].err2, /明文/);
		const walk = (d)=>fs.readdirSync(d, { withFileTypes: true }).flatMap((e)=>(e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
		const leaked = walk(home).filter((f)=>{ try{ const t = fs.readFileSync(f, 'utf8'); return t.includes('sk-PLAINTEXT-SHOULD-NOT-LAND') || t.includes('sk-PLAINTEXT-DIRECT-PUT'); }catch(e){ return false; } });
		assert.deepEqual(leaked, []);
	});
});

describe('⑨ 后端地址显式给定:连不上也不换到别的地址(不悄悄改用桌面 App 的后端)', ()=>{
	it('🔴 配的 Java / Python 端口都关着:启动自检与起盘失败后都不去试其它候选地址(含 127.0.0.1:9999),当前后端根不变;不把开关写进数据目录', async ()=>{
		const home = tmpHome();
		// 子进程:起运行时(端口指向关着的口),把发往配置之外地址的请求记下并就地拒掉(一个都不放出去),等过启动自检(2.5 s),再起一次要后端的盘
		const code = `
			const net = require('net');
			const free = ()=>new Promise((r)=>{ const s = net.createServer(); s.listen(0, '127.0.0.1', ()=>{ const p = s.address().port; s.close(()=>r(p)); }); });
			(async ()=>{
				const jp = await free(); const cp = await free();
				const foreign = [];
				const allowed = new Set(['http://127.0.0.1:' + jp, 'http://127.0.0.1:' + cp]);
				const orig = globalThis.fetch;
				const guard = (u, o)=>{ const url = typeof u === 'string' ? u : (u && u.url) || String(u); let origin = ''; try{ origin = new URL(url).origin; }catch(e){} if(!allowed.has(origin)){ foreign.push(origin); return Promise.reject(new TypeError('blocked in test')); } return orig(u, o); };
				globalThis.fetch = guard;
				const { createRuntime } = require(${JSON.stringify(RUNTIME)});
				const rt = await createRuntime({ quiet: true, serverPort: jp, chartPort: cp, handleSignals: false });
				global.window.fetch = guard;
				await new Promise((r)=>setTimeout(r, 4000));
				const before = rt.storage.getItem('horosaLocalServerRoot');
				const lib = rt.lib;
				const r0 = await lib.runTool('cast_technique', { technique: 'ziwei', source: { kind: 'natal', birth: '1990-01-01 08:00', gpsLat: 39.9, gpsLon: 116.4, zone: '+08:00', gender: 'male' } }, { origin: 'mcp' });
				rt.storage.__flushNow();
				const disk = JSON.parse(require('fs').readFileSync(require('path').join(process.env.HOROSA_HOME, 'headless', 'data', 'localStorage.json'), 'utf8'));
				process.stdout.write(JSON.stringify({ foreign, before, after: rt.storage.getItem('horosaLocalServerRoot'), mode: rt.storage.getItem('horosaLocalServerRootMode'), want: 'http://127.0.0.1:' + jp, castOk: !!r0.ok, offOnDisk: disk.horosaBackendIdentityOff === undefined ? null : disk.horosaBackendIdentityOff }), ()=>process.exit(0));
			})().catch((e)=>{ process.stderr.write(String(e && e.stack || e)); process.exit(1); });`;
		const out = await new Promise((resolve)=>{
			const c = track(spawn(process.execPath, ['-e', code], { env: { ...baseEnv(home) }, stdio: ['ignore', 'pipe', 'pipe'] }));
			const bufs = []; let err = '';
			c.stdout.on('data', (b)=>bufs.push(b)); c.stderr.on('data', (b)=>{ err += b; });
			c.on('exit', (st)=>resolve({ st, text: Buffer.concat(bufs).toString('utf8'), err }));
		});
		assert.equal(out.st, 0, out.err.slice(-1500));
		const r = JSON.parse(out.text);
		assert.deepEqual(r.foreign, [], `向配置之外的地址发了请求:${r.foreign.join(', ')}`);
		assert.equal(r.before, r.want); assert.equal(r.after, r.want); assert.equal(r.mode, 'manual');
		assert.equal(r.castOk, false, '后端都关着,要 Java 的技法应如实失败');
		assert.equal(r.offOnDisk, null, '旁路开关只在本进程里读作开,不写进数据目录');
	});
});
