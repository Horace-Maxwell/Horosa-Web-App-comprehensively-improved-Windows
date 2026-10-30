#!/usr/bin/env node
// 无头真栈自测(真工具层、零窗口;数据放临时目录,不碰用户数据):
//   ① 本进程运行时:工具清单(无界面类)、建命盘 → 列档案 → 本机算起盘(八字 / 紫微)→ 读资源 → 提示;
//   ② 本机 HTTP 服务(真运行时):MCP 握手 / 清单 / 调用;REST 索引 / 简写 / 调用 / OpenAPI;
//   ③ 子进程终端命令(自动经服务):status / records / call --json / tools;
//   ④ 子进程 stdio MCP(已有服务 → 转发):握手 / 清单 / 调用;
//   ⑤ 关掉服务后另起进程(本进程模式)读回档案 = 落盘生效;
//   ⑥ 后端在跑才测:西洋盘起盘(走 :9999)、黄历择日与判读;模型接口(./horosa ai 加档案 → 密钥密文落盘 → 经后端代理连本机假上游
//     → 连通测试 + run_analysis 全链);
//   ⑦ 管理口只认管理令牌;环境变量档案只在内存(不落盘);整库导出 → 另一个数据目录导入 → 档案读得回。
// 用法:node headless/selftest.js [--json];./horosa selftest 同跑(并先跑 node --test 合同)。退出码 0 = 全过。
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'horosa-selftest-'));
process.env.HOROSA_HOME = HOME;
process.env.HOROSA_NO_AUTOSTART = '1';
const CLI = path.join(__dirname, 'cli.js');
const results = [];
const check = (name, ok, detail)=>{ results.push({ name, ok: !!ok, detail: detail === undefined ? '' : `${detail}` }); };
const textOf = (r)=>((r && r.content) || []).map((c)=>c.text || '').join('\n');
const json = process.argv.includes('--json');

// 子进程必须异步跑:本进程同时挂着服务,同步等子进程会卡住自己的事件循环,子进程就连不上服务(会悄悄退回本进程模式)
function runCli(args, input, env){
	return new Promise((resolve)=>{
		const child = spawn(process.execPath, [CLI, ...args], { env: { ...process.env, HOROSA_HOME: HOME, ...(env || {}) }, stdio: ['pipe', 'pipe', 'pipe'] });
		let out = ''; let err = '';
		child.stdout.on('data', (d)=>{ out += d; });
		child.stderr.on('data', (d)=>{ err += d; });
		const timer = setTimeout(()=>child.kill('SIGKILL'), 120000);
		child.on('close', (code)=>{ clearTimeout(timer); resolve({ code, out, err }); });
		child.stdin.end(input || '');
	});
}

async function stdioSession(lines){
	return new Promise((resolve)=>{
		const child = spawn(process.execPath, [CLI, 'mcp'], { env: { ...process.env, HOROSA_HOME: HOME }, stdio: ['pipe', 'pipe', 'pipe'] });
		let buf = '';
		child.stdout.on('data', (d)=>{ buf += d; });
		const timer = setTimeout(()=>child.kill('SIGKILL'), 60000);
		child.on('close', ()=>{ clearTimeout(timer); resolve(buf.split('\n').filter(Boolean).map((l)=>{ try{ return JSON.parse(l); }catch(e){ return { bad: l }; } })); });
		child.stdin.end(`${lines.map((m)=>JSON.stringify(m)).join('\n')}\n`);
	});
}

// 探哪个口与运行时发往哪个口同一来源(ports.js)
async function backendsUp(){
	const { serverRoot, chartRoot } = require('./ports').backendPorts();
	const probe = async (root)=>{ try{ await fetch(`${root}/`, { signal: AbortSignal.timeout(2500) }); return true; }catch(e){ return false; } };
	const [a, b] = await Promise.all([probe(serverRoot), probe(chartRoot)]);
	return a && b;
}

// 本机假上游(OpenAI 兼容):记下收到的鉴权头与模型;非流式回 JSON、流式回事件流
function startMockUpstream(){
	const http = require('http');
	const log = [];
	const srv = http.createServer((req, res)=>{
		let b = '';
		req.on('data', (c)=>{ b += c; });
		req.on('end', ()=>{
			let body = {}; try{ body = JSON.parse(b || '{}'); }catch(e){ body = {}; }
			log.push({ url: req.url, auth: `${req.headers.authorization || ''}`, model: body.model, stream: !!body.stream });
			if(!/chat\/completions/.test(req.url)){ res.writeHead(404); res.end('{}'); return; }
			const text = `MOCK-OK ${body.model}`;
			if(body.stream){
				res.writeHead(200, { 'Content-Type': 'text/event-stream' });
				res.write(`data: ${JSON.stringify({ id: 'c', object: 'chat.completion.chunk', model: body.model, choices: [{ index: 0, delta: { role: 'assistant', content: text }, finish_reason: null }] })}\n\n`);
				res.write(`data: ${JSON.stringify({ id: 'c', object: 'chat.completion.chunk', model: body.model, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 9, completion_tokens: 2, total_tokens: 11 } })}\n\n`);
				res.end('data: [DONE]\n\n');
				return;
			}
			res.writeHead(200, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify({ id: 'x', object: 'chat.completion', model: body.model, choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }], usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 } }));
		});
	});
	return new Promise((resolve)=>srv.listen(0, '127.0.0.1', ()=>resolve({ url: `http://127.0.0.1:${srv.address().port}/v1`, log, close: ()=>new Promise((r)=>srv.close(()=>r())) })));
}

async function main(){
	const { createRuntime } = require('./runtime');
	const protocol = require('./protocol');
	const { startServer } = require('./server');
	const t0 = Date.now();
	const rt = await createRuntime({ quiet: true });
	check('运行时就绪', true, `${Date.now() - t0} ms`);
	const call = async (name, args)=>protocol.handleMessage({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args || {} } }, { rt, clientName: 'selftest' });

	// ① 本进程
	const list = await protocol.handleMessage({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, { rt });
	const names = list.result.tools.map((t)=>t.name);
	check('工具清单', names.length >= 25 && names.indexOf('cast_technique') >= 0 && names.indexOf('search_zeri') >= 0, `${names.length} 件`);
	check('界面类工具不进无头目录', ['navigate_to_technique', 'set_chat_mount', 'compare_records', 'read_current_page', 'ask_user'].every((n)=>names.indexOf(n) < 0));
	const created = await call('create_chart_record', { name: '自测甲', birth: '1990-01-01 08:00', place: '北京', gender: 'male' });
	const cid = created.result && created.result.structuredContent && created.result.structuredContent.cid;
	check('建命盘', !!cid && !created.result.isError, cid);
	const listed = await call('list_records', { query: '自测' });
	check('列档案', listed.result && listed.result.structuredContent && listed.result.structuredContent.total === 1);
	for(const tech of ['bazi', 'ziwei']){
		const r = await call('cast_technique', { technique: tech, source: { kind: 'record', cid }, maxChars: 1500 });   // eslint-disable-line no-await-in-loop
		check(`本机算起盘 ${tech}`, r.result && !r.result.isError && textOf(r.result).length > 100, r.result && r.result.isError ? clip(textOf(r.result)) : `${textOf(r.result).length} 字`);
	}
	const res = await protocol.handleMessage({ jsonrpc: '2.0', id: 1, method: 'resources/read', params: { uri: `horosa://chart/${cid}` } }, { rt });
	check('读资源(命盘)', res.result && res.result.contents && res.result.contents.length > 0);
	const guide = await protocol.handleMessage({ jsonrpc: '2.0', id: 1, method: 'prompts/get', params: { name: 'guide:horosa' } }, { rt });
	check('使用指南提示', guide.result && guide.result.messages && guide.result.messages.length > 0);
	// 名人库:检索 → 详情 → 存成命盘 → 用存好的命盘起盘(八字本机算)
	const celeb = await call('search_celebrities', { query: '爱因斯坦', limit: 3 });
	const cId = celeb.result && celeb.result.structuredContent && celeb.result.structuredContent.items[0] && celeb.result.structuredContent.items[0].id;
	check('名人库检索(姓名命中排最前)', cId === 'adb-2939', cId);
	const cDetail = await call('get_celebrity', { id: 'adb-2939', maxChars: 300 });
	check('名人库详情(出生资料与署名)', cDetail.result && cDetail.result.structuredContent && cDetail.result.structuredContent.person.birthData.birth === '1879-03-14 11:30:00');
	const cSaved = await call('create_celebrity_chart', { id: 'adb-2939' });
	const cCid = cSaved.result && cSaved.result.structuredContent && cSaved.result.structuredContent.cid;
	check('名人存成命盘', !!cCid && cSaved.result.structuredContent.created === true, cCid);
	const cCast = await call('cast_technique', { technique: 'bazi', source: { kind: 'record', cid: cCid }, maxChars: 800 });
	check('名人命盘起盘', cCast.result && !cCast.result.isError && textOf(cCast.result).length > 100);
	const qz = await call('search_zeri', { school: 'qimen', start: '2026-04-01', end: '2026-04-07', place: '北京', conditions: { type: 'door', params: { values: ['开'], palaces: [2] } } });
	check('奇门择日搜索', qz.result && !qz.result.isError && qz.result.structuredContent.total > 0, qz.result && qz.result.structuredContent ? `${qz.result.structuredContent.total} 段` : clip(textOf(qz.result)));
	const ui = await call('navigate_to_technique', { technique: 'bazi' });
	check('界面类工具直呼 → 说明不可用', ui.error && /无头/.test(ui.error.message));

	// ② HTTP(真运行时)
	const srv = await startServer({ rt, port: 0 });
	const auth = { Authorization: `Bearer ${srv.token}`, 'Content-Type': 'application/json' };
	const mcp = async (body)=>(await fetch(srv.url, { method: 'POST', headers: auth, body: JSON.stringify(body) })).json();
	const init = await mcp({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', clientInfo: { name: 'selftest' } } });
	check('HTTP MCP 握手', init.result && init.result.serverInfo.name === 'horosa');
	const httpList = await mcp({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
	check('HTTP MCP 工具清单与本进程同', httpList.result && httpList.result.tools.length === names.length);
	const httpCall = await mcp({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'list_records', arguments: { query: '自测' } } });
	check('HTTP MCP 调用', httpCall.result && httpCall.result.structuredContent.total === 1);
	const r401 = await fetch(`${srv.restUrl}/tools`);
	check('REST 无令牌 401', r401.status === 401);
	const idx = await (await fetch(srv.restUrl, { headers: auth })).json();
	check('REST 索引', idx.mode === 'headless');
	const alias = await (await fetch(`${srv.restUrl}/records?query=${encodeURIComponent('自测')}`, { headers: auth })).json();
	check('REST GET 简写', alias.ok && alias.data && alias.data.total === 1);
	const rcall = await (await fetch(`${srv.restUrl}/tools/cast_technique`, { method: 'POST', headers: auth, body: JSON.stringify({ technique: 'bazi', source: { kind: 'record', cid }, maxChars: 800 }) })).json();
	check('REST 调用起盘', rcall.ok && rcall.text.length > 50);
	const doc = await (await fetch(`${srv.restUrl}/openapi.json`, { headers: auth })).json();
	check('REST OpenAPI', doc.openapi === '3.1.0' && !!doc.paths['/tools/cast_technique']);
	const base = srv.url.replace(/\/mcp$/, '');
	const admWithApi = await fetch(`${base}/admin/config`, { headers: auth });
	const admWithAdmin = await fetch(`${base}/admin/config`, { headers: { Authorization: `Bearer ${srv.adminToken}` } });
	check('管理口只认管理令牌(接口令牌 401)', admWithApi.status === 401 && admWithAdmin.status === 200 && srv.adminToken !== srv.token);

	// ③ 子进程终端命令(自动经服务)
	const st = await runCli(['status']);
	check('终端 status(经服务)', st.code === 0 && /无头服务运行中/.test(st.out), clip(st.err || st.out));
	const rec = await runCli(['records', '自测', '--json', '--server']);
	check('终端 records 简写(只经服务)', rec.code === 0 && /自测甲/.test(rec.out), clip(rec.err));
	const cj = await runCli(['call', 'list_records', '-', '--json', '--server'], JSON.stringify({ query: '自测' }));
	check('终端 call 标准输入参数(只经服务)', cj.code === 0 && JSON.parse(cj.out).structuredContent.total === 1, clip(cj.err));
	const bad = await runCli(['frobnicate']);
	check('终端用法错回 2', bad.code === 2);

	// ④ 子进程 stdio MCP(转发到在跑的服务)
	const sess = await stdioSession([
		{ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', clientInfo: { name: 'selftest-stdio' } } },
		{ jsonrpc: '2.0', method: 'notifications/initialized' },
		{ jsonrpc: '2.0', id: 2, method: 'tools/list' },
		{ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'list_records', arguments: { query: '自测' } } },
	]);
	const byId = (i)=>sess.find((m)=>m.id === i) || {};
	check('stdio MCP 握手', byId(1).result && byId(1).result.serverInfo.name === 'horosa');
	check('stdio MCP 清单', byId(2).result && byId(2).result.tools.length === names.length);
	check('stdio MCP 调用', byId(3).result && byId(3).result.structuredContent && byId(3).result.structuredContent.total === 1);

	// ⑥ 后端在跑才测
	if(await backendsUp()){
		const astro = await call('cast_technique', { technique: 'astrochart', source: { kind: 'record', cid }, maxChars: 1500 });
		check('后端起盘 西洋盘', astro.result && !astro.result.isError && textOf(astro.result).length > 100, astro.result && astro.result.isError ? clip(textOf(astro.result)) : '');
		const z = await call('search_zeri', { school: 'huangli', start: '2026-03-01', end: '2026-03-31', conditions: { type: 'jianchu', params: { values: ['成'] } } });
		const total = z.result && z.result.structuredContent ? z.result.structuredContent.total : -1;
		check('黄历择日搜索', total > 0, `${total} 段`);
		// 模型接口:终端加档案(经服务的管理口)→ 密钥密文落盘 → 经后端代理连本机假上游
		const up = await startMockUpstream();
		const KEY = 'sk-selftest-0123456789';
		const added = await runCli(['ai', 'add', 'custom', '--model', 'mock-a', '--base-url', up.url, '--name', '自测假上游', '--key-stdin'], KEY);
		check('终端 ai add(密钥走标准输入)', added.code === 0 && /已添加接口档案/.test(added.out), clip(added.err || added.out));
		const stores = (()=>{ try{ return fs.readFileSync(path.join(HOME, 'headless', 'data', 'stores', 'provider_profiles.json'), 'utf8'); }catch(e){ return ''; } })();
		check('接口密钥密文落盘(明文不在盘上)', stores.indexOf(KEY) < 0 && /aesgcm\.v1:/.test(stores) && (fs.statSync(path.join(HOME, 'headless', 'master.key')).mode & 0o777) === 0o600);
		const pinged = await runCli(['ai', 'test']);
		check('终端 ai test(经后端代理到上游,带对鉴权头)', pinged.code === 0 && up.log.some((x)=>x.auth === `Bearer ${KEY}` && !x.stream), clip(pinged.err || pinged.out));
		// 打开无头分析出口 = 放宽外部访问,非交互环境下是人工操作(要 --yes + HOROSA_ALLOW_UNATTENDED_APPROVAL=1,见 cli.js loosensPolicy);
		// 自测跑在临时数据目录里,由自测自己显式放行(此前漏带 → 开关没开 → run_analysis「未知工具」,该项恒红)
		const on = await runCli(['config', 'headless-analysis', 'on', '--yes'], '', { HOROSA_ALLOW_UNATTENDED_APPROVAL: '1' });
		const ra = await mcp({ jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'run_analysis', arguments: { question: '今年事业如何', recordId: cid, techniques: ['bazi'] } } });
		const raText = ra.result && ra.result.structuredContent ? `${ra.result.structuredContent.content || ''}` : '';
		check('run_analysis 全链(挂八字盘 · 流式 · 经后端代理)', on.code === 0 && /MOCK-OK mock-a/.test(raText) && up.log.some((x)=>x.stream), clip(raText || JSON.stringify(ra).slice(0, 200)));
		await up.close();
	}else{
		check('后端相关(西洋盘 / 择日 / 模型接口)', true, '本机计算服务没开,跳过(./horosa start 后再跑可覆盖)');
	}

	await srv.close();
	rt.close();
	await new Promise((r)=>setTimeout(r, 400));   // 落盘去抖

	// ⑤ 另起进程读回(本进程模式)
	const again = await runCli(['records', '自测', '--local', '--json']);
	check('重启后档案还在(落盘)', again.code === 0 && /自测甲/.test(again.out), clip(again.err));

	// ⑦ 环境变量档案只在内存;整库导出 → 另一个数据目录导入
	const envAi = await runCli(['ai', '--local', '--json'], '', { HOROSA_AI_PROVIDER: 'openai', HOROSA_AI_MODEL: 'env-model', HOROSA_AI_API_KEY: 'sk-env-not-on-disk' });
	let envCur = null; try{ envCur = JSON.parse(envAi.out).current; }catch(e){ envCur = null; }
	const onDisk = ['stores/provider_profiles.json', 'localStorage.json'].map((f)=>{ try{ return fs.readFileSync(path.join(HOME, 'headless', 'data', f), 'utf8'); }catch(e){ return ''; } }).join('\n');
	check('环境变量档案优先且不落盘', envAi.code === 0 && envCur && envCur.profileId === 'headless-env' && envCur.model === 'env-model' && onDisk.indexOf('sk-env-not-on-disk') < 0 && onDisk.indexOf('headless-env') < 0, clip(envAi.err));
	const zip = path.join(HOME, 'export-selftest.zip');
	const ex = await runCli(['export', zip, '--local']);
	const HOME2 = fs.mkdtempSync(path.join(os.tmpdir(), 'horosa-selftest-import-'));
	const im = await runCli(['import', zip, '--yes', '--local'], '', { HOROSA_HOME: HOME2, HOROSA_ALLOW_UNATTENDED_APPROVAL: '1' });   // 非交互的人工命令要显式放行
	const back = await runCli(['records', '自测', '--local', '--json'], '', { HOROSA_HOME: HOME2 });
	check('整库导出 → 另一数据目录导入 → 档案读得回(导入前自动留快照)', ex.code === 0 && im.code === 0 && /自测甲/.test(back.out) && fs.existsSync(path.join(HOME2, 'headless', 'backups')), clip(ex.err || im.err || back.err));
	try{ fs.rmSync(HOME2, { recursive: true, force: true }); }catch(e){ /* 留给系统清 */ }
}

function clip(s){ const t = `${s || ''}`.replace(/\s+/g, ' ').trim(); return t.length > 160 ? `${t.slice(0, 160)}…` : t; }

main().catch((e)=>{ check('自测进程', false, e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e); }).then(()=>{
	const failed = results.filter((r)=>!r.ok);
	if(json){ process.stdout.write(`${JSON.stringify({ ok: failed.length === 0, results }, null, 2)}\n`); }else{
		results.forEach((r)=>process.stdout.write(`${r.ok ? '✅' : '❌'} ${r.name}${r.detail ? `:${r.detail}` : ''}\n`));
		process.stdout.write(`${failed.length === 0 ? '全过' : `${failed.length} 项没过`}(${results.length} 项;数据目录 ${HOME})\n`);
	}
	try{ fs.rmSync(HOME, { recursive: true, force: true }); }catch(e){ /* 留给系统清 */ }
	require('./exit').exitAfterFlush(failed.length === 0 ? 0 : 1);
});
