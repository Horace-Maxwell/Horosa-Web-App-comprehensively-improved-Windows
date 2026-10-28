// 无头写入面三入口矩阵(node --test;真运行时、真子进程,零窗口):
//   写入类工具 × 三个入口(MCP over HTTP / REST / 终端命令 call),每格同一套判据 ——
//   ① 全自动档:写入成功、回包带动作 id、账本 +1(来源 mcp、客户端名 = 入口名)、盘上数据真变了(提案类只进提案、档案不动);
//   ② 幂等键:同键同参重试 = 回放同一个动作 id、账本不再 +1;同键换参 = E_IDEMPOTENCY_CONFLICT、不执行;
//   ③ 撤销:管理口(HTTP 管理口 / 终端 undo)撤掉后盘上数据回到写入前、账本标已撤销、再撤 = E_UNDO_ALREADY;提案类改为拒绝;
//   ④ 只读档 / 「每次确认」档:三个入口一律 E_APPROVAL_DENIED,账本与盘上数据不动;
//   另测管理口的提案 采纳 / 拒绝 / 撤销采纳(HTTP 管理口与终端人工命令,含非交互放行闸)。
// 矩阵的行由运行中服务的工具目录机械生成(只读提示为假的都算写入):新加写入工具自动入矩阵,没配样例参数即红。
// 隔离:每个服务一个 mkdtemp 数据目录 + 回环随机端口;后端根指向一个刚关掉的随机端口(绝不连本机计算服务的口);
//   用完必停(SIGTERM → 等退出 → SIGKILL 兜底)必清(删临时目录),断言失败也一样。
// 跑法:node --test Horosa-Web/astrostudyui/headless/test/writeMatrix.test.js(preflight [319]③ 与 ./horosa selftest 同跑)。
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const CLI = path.join(__dirname, '..', 'cli.js');
const POLICY_KEY = 'horosa.ai.agent.external.policy.v1';
const LIMITS = { maxCallsPerMinute: 600, maxAdditivePerHour: 10000 };   // 矩阵一轮几百次调用:放宽限额(限流另有合同测试)
const USER_PORTS = new Set([8899, 9999]);
const sleep = (ms)=>new Promise((r)=>setTimeout(r, ms));
const SETTLE_MS = 240;   // 落盘去抖 150 / 200 ms + 余量

// ── 收尾:子进程与临时目录登记在案,断言失败 / 进程意外退出也收掉 ──
const CHILDREN = new Set();
const HOMES = new Set();
function cleanupSync(){
	CHILDREN.forEach((c)=>{ try{ c.kill('SIGKILL'); }catch(e){ /* 已退 */ } });
	HOMES.forEach((h)=>{ try{ fs.rmSync(h, { recursive: true, force: true }); }catch(e){ /* 留给系统清 */ } });
	HOMES.clear();
}
process.once('exit', cleanupSync);

async function closedPort(){
	const srv = net.createServer();
	await new Promise((r)=>srv.listen(0, '127.0.0.1', r));
	const port = srv.address().port;
	await new Promise((r)=>srv.close(r));
	return port;
}

function makeHome(approval){
	const home = fs.mkdtempSync(path.join(os.tmpdir(), 'horosa-write-matrix-'));
	HOMES.add(home);
	const data = path.join(home, 'headless', 'data');
	fs.mkdirSync(data, { recursive: true, mode: 0o700 });
	writePolicy(home, approval);
	return home;
}
function lsFile(home){ return path.join(home, 'headless', 'data', 'localStorage.json'); }
function writePolicy(home, approval){
	let cur = {};
	try{ cur = JSON.parse(fs.readFileSync(lsFile(home), 'utf8')); }catch(e){ cur = {}; }
	cur[POLICY_KEY] = JSON.stringify({ approval, ...LIMITS, uiConfirm: false });
	fs.writeFileSync(lsFile(home), JSON.stringify(cur));
}

// 子进程环境:剥掉继承来的 HOROSA_* 与模型密钥变量,只给本测试的
function childEnv(home, deadPort, extra){
	const e = {};
	Object.keys(process.env).forEach((k)=>{ if(!/^HOROSA_/.test(k) && !/API_KEY$/.test(k)){ e[k] = process.env[k]; } });
	return { ...e, HOROSA_HOME: home, HOROSA_NO_AUTOSTART: '1', HOROSA_HEADLESS_PORT: '0', HOROSA_SERVER_ROOT: `http://127.0.0.1:${deadPort}`, HOROSA_CHART_PORT: `${deadPort}`, ...(extra || {}) };
}

async function startServe(home, deadPort){
	const child = spawn(process.execPath, [CLI, 'serve'], { env: childEnv(home, deadPort), stdio: ['ignore', 'ignore', 'pipe'] });
	CHILDREN.add(child);
	child.once('exit', ()=>CHILDREN.delete(child));
	let log = '';
	child.stderr.on('data', (d)=>{ log += d; });
	const epFile = path.join(home, 'headless', 'endpoint.json');
	const end = Date.now() + 300000;   // 首跑可能要先打包工具层
	let ep = null;
	while(Date.now() < end){
		if(child.exitCode !== null){ throw new Error(`无头服务没起来:${log.slice(-800)}`); }
		try{ const j = JSON.parse(fs.readFileSync(epFile, 'utf8')); if(j && j.url && j.pid === child.pid){ ep = j; break; } }catch(e){ /* 还没写出来 */ }
		await sleep(150);   // eslint-disable-line no-await-in-loop
	}
	if(!ep){ child.kill('SIGKILL'); throw new Error(`等无头服务超时:${log.slice(-800)}`); }
	const u = new URL(ep.url);
	assert.equal(u.hostname, '127.0.0.1', '服务只许挂回环');
	assert.ok(!USER_PORTS.has(Number(u.port)), '服务端口不许撞本机计算服务的口');
	const admin = fs.readFileSync(path.join(home, 'headless', 'admin-token'), 'utf8').split('\n')[0].trim();
	return { home, child, ep, admin, base: ep.url.replace(/\/mcp$/, ''), deadPort, log: ()=>log };
}
async function stopServe(srv){
	if(!srv || !srv.child || srv.child.exitCode !== null){ return; }
	const gone = new Promise((r)=>srv.child.once('exit', r));
	srv.child.kill('SIGTERM');
	const t = setTimeout(()=>{ try{ srv.child.kill('SIGKILL'); }catch(e){ /* 已退 */ } }, 8000);
	await gone;
	clearTimeout(t);
}

// ── 三个入口(回体统一成 { ok, code, data, actionId, undoKind, exit? })──
function normBody(text, extra){
	let b = {};
	try{ b = JSON.parse(text || '{}'); }catch(e){ b = { ok: false, code: 'E_NOT_JSON', message: `${text}`.slice(0, 200) }; }
	return { ok: b.ok === true, code: b.code || null, message: b.message || '', data: b.data, replayed: b.replayed === true, actionId: b.undo && b.undo.actionId ? b.undo.actionId : null, undoKind: b.undo ? b.undo.kind : null, ...(extra || {}) };
}
let rpcId = 1;
const CALL_MS = 60000;   // 单次调用上限:拒绝档下写入应当场被拒,挂住(在等一个无头里不存在的审批台)按超时判红,不拖到整条用例超时
async function mcpRaw(srv, method, params, ms){
	const r = await fetch(srv.ep.url, { method: 'POST', headers: { Authorization: `Bearer ${srv.ep.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: rpcId++, method, params }), signal: AbortSignal.timeout(ms || CALL_MS) });
	return r.json();
}
const DENY_MS = 15000;   // 拒绝档:当场就该拒
const TIMED_OUT = { ok: false, code: 'E_TEST_CALL_HUNG', message: '调用挂住没回(超时)' };
const hung = (e)=>e && (e.name === 'TimeoutError' || e.name === 'AbortError');
function runCli(srv, args, input, extraEnv, ms){
	return new Promise((resolve)=>{
		const child = spawn(process.execPath, [CLI, ...args], { env: childEnv(srv.home, srv.deadPort, extraEnv), stdio: ['pipe', 'pipe', 'pipe'] });
		CHILDREN.add(child);
		let out = ''; let err = '';
		child.stdout.on('data', (d)=>{ out += d; });
		child.stderr.on('data', (d)=>{ err += d; });
		let killed = false;
		const timer = setTimeout(()=>{ killed = true; child.kill('SIGKILL'); }, ms || CALL_MS);
		child.on('close', (code)=>{ clearTimeout(timer); CHILDREN.delete(child); resolve({ code, out, err, killed }); });
		child.stdin.end(input || '');
	});
}
const ENTRIES = {
	mcp: {
		client: 'http',
		async call(srv, name, args, key, ms){
			let j;
			try{ j = await mcpRaw(srv, 'tools/call', { name, arguments: args, ...(key ? { _meta: { idempotencyKey: key } } : {}) }, ms); }catch(e){ if(hung(e)){ return TIMED_OUT; } throw e; }
			if(j.error){ return { ok: false, code: `RPC_${j.error.code}`, message: j.error.message }; }
			return normBody(((j.result && j.result.content) || []).map((c)=>c.text || '').join(''));
		},
	},
	rest: {
		client: 'rest',
		async call(srv, name, args, key, ms){
			let r;
			try{ r = await fetch(`${srv.ep.restUrl}/tools/${name}`, { method: 'POST', headers: { Authorization: `Bearer ${srv.ep.token}`, 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) }, body: JSON.stringify(args), signal: AbortSignal.timeout(ms || CALL_MS) }); }catch(e){ if(hung(e)){ return TIMED_OUT; } throw e; }
			const b = await r.json();
			const n = normBody(b.text, { status: r.status });
			assert.equal(r.status, n.ok ? 200 : 422, `REST 状态码与回体不一致:${r.status} ${b.text}`);
			return n;
		},
	},
	cli: {
		client: 'cli',
		async call(srv, name, args, key, ms){
			const r = await runCli(srv, ['call', name, '-', '--json', '--server', ...(key ? ['--idempotency-key', key] : [])], JSON.stringify(args), undefined, ms);
			if(r.killed){ return TIMED_OUT; }
			let res = null;
			try{ res = JSON.parse(r.out); }catch(e){ return { ok: false, code: 'E_CLI_OUTPUT', message: `${r.code} ${r.err.slice(0, 300)}`, exit: r.code }; }
			const n = normBody(((res && res.content) || []).map((c)=>c.text || '').join(''), { exit: r.code });
			assert.equal(r.code, n.ok ? 0 : 1, `终端命令退出码与回体不一致:${r.code} ${r.err.slice(0, 200)}`);
			return n;
		},
	},
};

// ── 读状态:账本走工具(活状态),数据走盘上文件(真落盘)──
async function readTool(srv, name, args){
	const j = await mcpRaw(srv, 'tools/call', { name, arguments: args || {} });
	assert.ok(j.result && !j.result.isError, `${name} 读失败:${JSON.stringify(j).slice(0, 300)}`);
	return j.result.structuredContent;
}
async function ledgerTotal(srv){ return (await readTool(srv, 'list_actions', { limit: 1, includeUndone: true })).total; }
async function ledgerItem(srv, actionId){ return ((await readTool(srv, 'list_actions', { limit: 50, includeUndone: true })).items || []).find((x)=>x.actionId === actionId) || null; }
// 盘上指纹:本机存储 + 存储区文件;剔掉账本 / 提案 / 回收站 / 限额计数等「记账」类键与记录里的时间戳(撤销后这些合理地不同)
const BOOKKEEPING = /ledger|proposal|trash|recycle|external\.(rate|writes|bucket)|ratelimit|lastWrite|notice|undo|^horosaLocalServerRoot/i;
// 「空」一律当「没有」:null / 空串 / 空数组 / 空对象 / 存成字符串的 "[]"(撤销把缺省字段还原成空值是等价的)
const isEmptyish = (v)=>v === null || v === undefined || v === '' || v === '[]' || v === '{}' || (Array.isArray(v) && v.length === 0) || (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);
function stripTimes(v){
	if(Array.isArray(v)){ return v.map(stripTimes); }
	if(v && typeof v === 'object'){
		const o = {};
		Object.keys(v).sort().forEach((k)=>{
			if(/^(updateTime|updatedAt|createTime|createdAt|lastOpenedAt)$/.test(k)){ return; }
			const x = stripTimes(v[k]);
			if(!isEmptyish(x)){ o[k] = x; }
		});
		return o;
	}
	return v;
}
function parseMaybe(s){ try{ return JSON.parse(s); }catch(e){ return s; } }
async function diskPrint(home){
	await sleep(SETTLE_MS);
	const out = {};
	let ls = {};
	try{ ls = JSON.parse(fs.readFileSync(lsFile(home), 'utf8')); }catch(e){ ls = {}; }
	Object.keys(ls).sort().forEach((k)=>{ if(!BOOKKEEPING.test(k)){ const v = stripTimes(parseMaybe(ls[k])); if(!isEmptyish(v)){ out[`ls:${k}`] = v; } } });
	const dir = path.join(home, 'headless', 'data', 'stores');
	if(fs.existsSync(dir)){
		fs.readdirSync(dir).filter((f)=>/\.json$/.test(f) && !BOOKKEEPING.test(f)).sort().forEach((f)=>{ try{ const v = stripTimes(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))); if(!isEmptyish(v)){ out[`store:${f}`] = v; } }catch(e){ /* 正在写 */ } });
	}
	return JSON.stringify(out);
}
// 不同之处:逐层下钻到叶子路径(最多 6 条;数组里按 cid / id 对位),失败信息里直接看出哪个字段没还原
function diffKeys(a, b){
	const out = [];
	const walk = (x, y, p)=>{
		if(out.length >= 6 || JSON.stringify(x) === JSON.stringify(y)){ return; }
		if(Array.isArray(x) && Array.isArray(y)){
			const idOf = (e)=>(e && typeof e === 'object' ? (e.cid || e.id) : undefined);
			if(x.concat(y).every((e)=>idOf(e))){
				const ids = Array.from(new Set(x.map(idOf).concat(y.map(idOf))));
				ids.forEach((id)=>walk(x.find((e)=>idOf(e) === id), y.find((e)=>idOf(e) === id), `${p}[${id}]`));
				return;
			}
		}
		if(x && y && typeof x === 'object' && typeof y === 'object' && !Array.isArray(x) && !Array.isArray(y)){
			Array.from(new Set(Object.keys(x).concat(Object.keys(y)))).forEach((k)=>walk(x[k], y[k], p ? `${p}.${k}` : k));
			return;
		}
		out.push(`${p}: ${JSON.stringify(x === undefined ? '(无)' : x).slice(0, 80)} → ${JSON.stringify(y === undefined ? '(无)' : y).slice(0, 80)}`);
	};
	walk(JSON.parse(a), JSON.parse(b), '');
	return out;
}

// ── 样例参数:每件写入工具一条(ctx 给新建的目标档案;variant=1 是「同键换参」用的另一组参数)──
let seq = 0;
async function freshChart(srv, tag){
	seq += 1;
	const r = await ENTRIES.mcp.call(srv, 'create_chart_record', { name: `矩阵目标${tag}${seq}`, birth: `19${60 + (seq % 39)}-0${1 + (seq % 9)}-1${seq % 10} 08:00`, place: '北京', gender: 'male', allowDuplicate: true });
	assert.ok(r.ok && r.data && r.data.cid, `建目标档案失败:${r.code} ${r.message}`);
	return r.data.cid;
}
const FIXTURES = {
	create_chart_record: { args: (c, v)=>({ name: `矩阵建档${c.n}${v ? '乙' : '甲'}`, birth: '1990-01-01 08:00', place: '北京', gender: 'male', allowDuplicate: true }) },
	create_case_record: { args: (c, v)=>({ caseType: 'liureng', event: `矩阵问事${c.n}${v ? '乙' : '甲'}`, divTime: '2026-01-01 10:00', place: '北京', allowDuplicate: true }) },
	// 当前盘 / 全局显示两面要界面(无头如实拒绝,见下面专条):矩阵用会落盘的古典占星全局参数面
	//   古典全局参数按整张存:第一次写会把缺省整张落盘(之后撤销只还原改的键)—— 先写一次再撤,让「写入前」已是整张,只比本次改的键
	set_settings: {
		prep: async (s)=>{
			const w = await ENTRIES.mcp.call(s, 'set_settings', { facet: 'classical', values: { termsVariant: 1 } });
			if(w.ok){ assert.ok((await undoVia(s, 'mcp', w.actionId)).ok); }
			return {};
		},
		args: (c, v)=>({ facet: 'classical', values: v ? { geminiBoundEmended: 1 } : { leoBoundFirst: 1 } }),
	},
	star_record: { prep: async (s)=>({ a: await freshChart(s, '星'), b: await freshChart(s, '星') }), args: (c, v)=>({ recordId: v ? c.b : c.a }) },
	pin_record: { prep: async (s)=>({ a: await freshChart(s, '顶') }), args: (c, v)=>({ recordId: c.a, ...(v ? { position: 'bottom' } : {}) }) },
	add_record_tag: { prep: async (s)=>({ a: await freshChart(s, '签') }), args: (c, v)=>({ recordId: c.a, tag: v ? '矩阵乙' : '矩阵甲' }) },
	append_record_journal: { prep: async (s)=>({ a: await freshChart(s, '志') }), args: (c, v)=>({ recordId: c.a, text: v ? '矩阵日志乙' : '矩阵日志甲' }) },
	link_records: { prep: async (s)=>({ a: await freshChart(s, '甲'), b: await freshChart(s, '乙') }), args: (c, v)=>({ recordId: c.a, otherRecordId: c.b, relation: v ? 'friend' : 'spouse' }) },
	cast_divination_case: { args: (c, v)=>({ caseType: 'liuyao', inputs: { numbers: v ? [4, 6, 1] : [3, 5, 2] }, divTime: '2026-01-01 10:00', place: '北京', event: `矩阵起卦${c.n}`, allowDuplicate: true }) },
	propose_record_edit: { proposal: true, prep: async (s)=>({ a: await freshChart(s, '改') }), args: (c, v)=>({ recordId: c.a, changes: { memo: v ? '矩阵备注乙' : '矩阵备注甲' } }) },
	propose_record_archive: { proposal: true, prep: async (s)=>({ a: await freshChart(s, '归') }), args: (c, v)=>({ recordId: c.a, ...(v ? { reason: '换个理由' } : {}) }) },
	create_celebrity_chart: { prep: async (s, n)=>({ id: CELEB_IDS[(2 * n) % CELEB_IDS.length], id2: CELEB_IDS[(2 * n + 1) % CELEB_IDS.length] }), args: (c, v)=>({ id: v ? c.id2 : c.id }) },
};
let CELEB_IDS = [];

async function prepCtx(srv, tool, n){
	const f = FIXTURES[tool];
	return { n, ...(f.prep ? await f.prep(srv, n) : {}) };
}
async function adminCall(srv, method, p, body){
	const r = await fetch(`${srv.base}${p}`, { method, headers: { Authorization: `Bearer ${srv.admin}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
	return { status: r.status, body: await r.json() };
}
const UNATTENDED = { HOROSA_ALLOW_UNATTENDED_APPROVAL: '1' };
// 撤销:MCP / REST 格走 HTTP 管理口,终端格走终端人工命令(非交互:--yes + 放行变量)
async function undoVia(srv, entry, actionId){
	if(entry === 'cli'){
		const r = await runCli(srv, ['undo', actionId, '--yes', '--json'], '', UNATTENDED);
		let res = {}; try{ res = JSON.parse(r.out); }catch(e){ res = { ok: false, code: 'E_CLI_OUTPUT', message: r.err }; }
		assert.equal(r.code, res.ok ? 0 : 1, `终端 undo 退出码与结果不一致:${r.code} ${r.err.slice(0, 200)}`);
		return res;
	}
	const r = await adminCall(srv, 'POST', `/admin/actions/${encodeURIComponent(actionId)}/undo`, {});
	assert.equal(r.status, 200);
	return r.body.result;
}
async function proposalVia(srv, entry, op, id){
	if(entry === 'cli'){
		const r = await runCli(srv, ['proposals', op, id, '--yes', '--json'], '', UNATTENDED);
		let res = {}; try{ res = JSON.parse(r.out); }catch(e){ res = { ok: false, code: 'E_CLI_OUTPUT', message: r.err }; }
		assert.equal(r.code, res.ok ? 0 : 1, `终端 proposals ${op} 退出码与结果不一致:${r.code} ${r.err.slice(0, 200)}`);
		return res;
	}
	const r = await adminCall(srv, 'POST', `/admin/proposals/${encodeURIComponent(id)}/${op}`, {});
	assert.equal(r.status, 200);
	return r.body.result;
}
async function proposalStatus(srv, id){
	const r = await adminCall(srv, 'GET', '/admin/proposals');
	const p = (r.body.proposals || []).find((x)=>x.id === id);
	return p ? p.status : null;
}

// 拒绝档要用的目标:每件写入工具一份(全自动档那条先跑过就复用它建好的,单跑拒绝档时自己建 —— 绝不因为没有目标而空过)
async function denyTargets(srv, tools, pool, pick){
	const out = [];
	for(const tool of tools){
		const have = pool.filter((d)=>d.tool === tool);
		out.push(have.length ? have[pick % have.length] : { tool, ctx: await prepCtx(srv, tool, 900 + out.length) });   // eslint-disable-line no-await-in-loop
	}
	return out;
}

describe('无头写入面三入口矩阵', ()=>{
	let srv = null;
	let WRITE_TOOLS = [];
	const deny = [];   // 只读 / 每次确认档要复用的目标(全自动档下先建好)
	before(async ()=>{
		const dead = await closedPort();
		assert.ok(!USER_PORTS.has(dead));
		srv = await startServe(makeHome('auto'), dead);
		const listed = await mcpRaw(srv, 'tools/list', {});
		WRITE_TOOLS = listed.result.tools.filter((t)=>!(t.annotations && t.annotations.readOnlyHint === true)).map((t)=>t.name).sort();
		const celeb = await readTool(srv, 'search_celebrities', { query: 'a', limit: 12 });
		CELEB_IDS = (celeb.items || []).map((x)=>x.id);
	}, { timeout: 360000 });
	after(async ()=>{ await stopServe(srv); cleanupSync(); });

	it('🔴 矩阵行由工具目录生成:写入工具集合 = 样例表(新写入工具没配样例即红;样例表不许留已不存在的工具)', async ()=>{
		assert.ok(WRITE_TOOLS.length >= 10, `写入工具太少:${WRITE_TOOLS.join(' ; ')}`);
		const missing = WRITE_TOOLS.filter((t)=>!FIXTURES[t]);
		const stale = Object.keys(FIXTURES).filter((t)=>WRITE_TOOLS.indexOf(t) < 0);
		assert.deepEqual(missing, [], `新写入工具没配矩阵样例参数(在 writeMatrix.test.js 的 FIXTURES 补):${missing.join(', ')}`);
		assert.deepEqual(stale, [], `样例表里有工具目录已没有的工具:${stale.join(', ')}`);
		// REST 与 MCP 列的是同一份目录
		const r = await fetch(`${srv.ep.restUrl}/tools`, { headers: { Authorization: `Bearer ${srv.ep.token}` } });
		const restWrites = (await r.json()).tools.filter((t)=>!(t.annotations && t.annotations.readOnlyHint === true)).map((t)=>t.name).sort();
		assert.deepEqual(restWrites, WRITE_TOOLS);
		assert.ok(CELEB_IDS.length >= 4, '名人库样例 id 不够');
	});

	it('🔴 全自动档 × 三入口:写入落盘 + 账本 +1(来源 / 客户端名)、幂等键回放与冲突、撤销还原(提案类:拒绝后档案不动)', { timeout: 900000 }, async ()=>{
		const fails = [];
		let n = 0;
		// 调试用:WRITE_MATRIX_ONLY=工具1,工具2 只跑这几行(目录覆盖那条照常查全集)
		const only = `${process.env.WRITE_MATRIX_ONLY || ''}`.split(',').map((x)=>x.trim()).filter(Boolean);
		for(const tool of WRITE_TOOLS.filter((t)=>!only.length || only.indexOf(t) >= 0)){
			for(const entry of Object.keys(ENTRIES)){
				n += 1;
				const cell = `${tool} × ${entry}`;
				try{
					const E = ENTRIES[entry];
					const f = FIXTURES[tool];
					const ctx = await prepCtx(srv, tool, n);   // eslint-disable-line no-await-in-loop
					deny.push({ tool, ctx });
					const args = f.args(ctx, 0);
					const key = `matrix-${tool}-${entry}-${n}`;
					const f0 = await diskPrint(srv.home);   // eslint-disable-line no-await-in-loop
					const t0 = await ledgerTotal(srv);   // eslint-disable-line no-await-in-loop
					// ① 写入
					const r1 = await E.call(srv, tool, args, key);   // eslint-disable-line no-await-in-loop
					assert.ok(r1.ok, `写入失败 ${r1.code} ${r1.message}`);
					assert.ok(r1.actionId, '回包没带动作 id');
					assert.equal(await ledgerTotal(srv), t0 + 1, '账本没有恰好 +1');   // eslint-disable-line no-await-in-loop
					const item = await ledgerItem(srv, r1.actionId);   // eslint-disable-line no-await-in-loop
					assert.ok(item, '账本里找不到这条动作');
					assert.deepEqual([item.tool, item.origin, item.clientName, item.undone], [tool, 'mcp', E.client, false], '账本条目的工具 / 来源 / 客户端名不对');
					const f1 = await diskPrint(srv.home);   // eslint-disable-line no-await-in-loop
					if(f.proposal){
						assert.equal(f1, f0, `提案不该改档案(变了:${diffKeys(f0, f1).join(' ; ')})`);
						assert.ok(r1.data && r1.data.proposalId, '提案回包没带提案 id');
						assert.equal(await proposalStatus(srv, r1.data.proposalId), 'pending');   // eslint-disable-line no-await-in-loop
					}else{
						assert.notEqual(f1, f0, '写入回包成功,盘上数据却没变');
					}
					// ② 幂等键:同键同参 = 回放
					const r2 = await E.call(srv, tool, args, key);   // eslint-disable-line no-await-in-loop
					assert.ok(r2.ok, `同键重试失败 ${r2.code} ${r2.message}`);
					assert.equal(r2.actionId, r1.actionId, '同键重试没回放(动作 id 变了 = 又写了一次)');
					assert.equal(r2.replayed, true, '回放的回包没标 replayed');
					assert.equal(r1.replayed, false, '第一次写入不该标 replayed');
					assert.equal(await ledgerTotal(srv), t0 + 1, '同键重试让账本又 +1');   // eslint-disable-line no-await-in-loop
					//      同键换参 = 冲突,不执行
					const r3 = await E.call(srv, tool, f.args(ctx, 1), key);   // eslint-disable-line no-await-in-loop
					assert.deepEqual([r3.ok, r3.code], [false, 'E_IDEMPOTENCY_CONFLICT'], `同键换参应被拒:${r3.code} ${r3.message}`);
					assert.equal(await ledgerTotal(srv), t0 + 1, '同键换参让账本 +1');   // eslint-disable-line no-await-in-loop
					//      (同键换参若偷偷写了盘,下面「撤销 / 拒绝后 == 写入前」必不等,不另读一次盘)
					// ③ 撤销
					if(f.proposal){
						assert.equal(r1.undoKind, 'none', '提案类的撤销应走拒绝');
						const rj = await proposalVia(srv, entry, 'reject', r1.data.proposalId);   // eslint-disable-line no-await-in-loop
						assert.ok(rj && rj.ok, `拒绝提案失败 ${rj && rj.code}`);
						assert.equal(await proposalStatus(srv, r1.data.proposalId), 'rejected');   // eslint-disable-line no-await-in-loop
						assert.equal(await diskPrint(srv.home), f0, '拒绝提案后档案不该变');   // eslint-disable-line no-await-in-loop
					}else{
						assert.ok(r1.undoKind && r1.undoKind !== 'none', `写入类必须可撤销(撤销类别 ${r1.undoKind})`);
						const u = await undoVia(srv, entry, r1.actionId);   // eslint-disable-line no-await-in-loop
						assert.ok(u && u.ok, `撤销失败 ${u && u.code} ${u && u.message}`);
						const f2 = await diskPrint(srv.home);   // eslint-disable-line no-await-in-loop
						assert.equal(f2, f0, `撤销后盘上数据没回到写入前(不同:${diffKeys(f0, f2).join(' ; ')})`);
						assert.equal((await ledgerItem(srv, r1.actionId)).undone, true, '账本没标已撤销');   // eslint-disable-line no-await-in-loop
						const u2 = await undoVia(srv, entry, r1.actionId);   // eslint-disable-line no-await-in-loop
						assert.deepEqual([u2.ok, u2.code], [false, 'E_UNDO_ALREADY'], '再撤一次应回已撤销');
					}
				}catch(e){
					fails.push(`${cell}:${e.message.split('\n')[0]}`);
				}
			}
		}
		if(!only.length){ assert.equal(n, WRITE_TOOLS.length * Object.keys(ENTRIES).length, '矩阵格数不对'); }
		assert.ok(n > 0, '矩阵一格都没跑');
		assert.deepEqual(fails, [], `矩阵 ${n} 格里 ${fails.length} 格不过`);
	});

	it('🔴 无头没有界面:改「当前盘口径」「全局显示偏好」三入口一律如实拒绝(不记账本、不回成功),描述整面标只读且原因同句;建档要求载入工作区回 loaded:false', { timeout: 120000 }, async ()=>{
		const t0 = await ledgerTotal(srv);
		const fails = [];
		for(const [facet, values] of [['chart', { hsys: 3 }], ['app', { wheelArt: 'hellenistic' }]]){
			for(const entry of Object.keys(ENTRIES)){
				const r = await ENTRIES[entry].call(srv, 'set_settings', { facet, values }, `ui-${facet}-${entry}`);   // eslint-disable-line no-await-in-loop
				if(r.ok || r.code !== 'E_BRIDGE_UNAVAILABLE'){ fails.push(`${facet} × ${entry}:${r.ok ? '回了成功' : r.code}`); }
				// 描述与写入同一判据:整面标只读,原因就是写入时那句拒绝
				const d = await ENTRIES[entry].call(srv, 'describe_settings', { facet });   // eslint-disable-line no-await-in-loop
				const items = (d.data && d.data.items) || [];
				if(!d.ok || !d.data || d.data.writable !== false || d.data.readOnlyReason !== r.message || !items.length || items.some((it)=>it.settable !== false)){
					fails.push(`${facet} × ${entry}:描述没标只读或原因与写入拒绝不一致(${JSON.stringify(d.data && { writable: d.data.writable, readOnlyReason: d.data.readOnlyReason })})`);
				}
			}
		}
		assert.deepEqual(fails, []);
		assert.equal(await ledgerTotal(srv), t0, '如实拒绝的写入不该记账本');
		const c = await ENTRIES.rest.call(srv, 'create_chart_record', { name: '矩阵载入', birth: '1990-01-01 08:00', place: '北京', loadIntoWorkspace: true, allowDuplicate: true });
		assert.ok(c.ok);
		assert.equal(c.data.loaded, false, '无头没有工作区,不能回「已载入」');
		assert.ok((await undoVia(srv, 'mcp', c.actionId)).ok);
	});

	it('🔴 管理口:提案 采纳 → 撤销采纳 / 拒绝 → 再采纳被拒;回体如实(成功 ok:true、失败带错误码);终端人工命令非交互要放行变量', { timeout: 300000 }, async ()=>{
		// 改档提案:HTTP 管理口采纳 → 盘上档案真改了 → 终端撤销采纳 → 改回 → 再撤 = 不在可撤状态
		const a = await freshChart(srv, '采');
		const f0 = await diskPrint(srv.home);
		const pe = await ENTRIES.mcp.call(srv, 'propose_record_edit', { recordId: a, changes: { memo: '采纳后的备注' } });
		assert.ok(pe.ok);
		const acc = await proposalVia(srv, 'mcp', 'accept', pe.data.proposalId);
		assert.equal(acc.ok, true, `采纳回体:${JSON.stringify(acc)}`);
		assert.equal(await proposalStatus(srv, pe.data.proposalId), 'accepted');
		const charts = JSON.parse(JSON.parse(fs.readFileSync(lsFile(srv.home), 'utf8'))['horosa.localCharts.v1']);
		assert.equal((charts.find((c)=>c.cid === a) || {}).memo, '采纳后的备注', '采纳后盘上档案没改');
		const rv = await proposalVia(srv, 'cli', 'revert', pe.data.proposalId);
		assert.equal(rv.ok, true, `撤销采纳回体:${JSON.stringify(rv)}`);
		assert.equal(await diskPrint(srv.home), f0, '撤销采纳后档案没改回');
		const rv2 = await proposalVia(srv, 'mcp', 'revert', pe.data.proposalId);
		assert.deepEqual([rv2.ok, rv2.code], [false, 'E_PROPOSAL_NOT_PENDING'], `再撤销采纳应如实失败:${JSON.stringify(rv2)}`);
		// 归档提案:终端拒绝 → 档案不动 → HTTP 再采纳 = 已处理过(如实失败)→ 终端再采纳退出码 1
		const b = await freshChart(srv, '拒');
		const g0 = await diskPrint(srv.home);
		const pa = await ENTRIES.rest.call(srv, 'propose_record_archive', { recordId: b });
		assert.ok(pa.ok);
		const rj = await proposalVia(srv, 'cli', 'reject', pa.data.proposalId);
		assert.equal(rj.ok, true);
		assert.equal(await proposalStatus(srv, pa.data.proposalId), 'rejected');
		assert.equal(await diskPrint(srv.home), g0);
		const acc2 = await proposalVia(srv, 'mcp', 'accept', pa.data.proposalId);
		assert.deepEqual([acc2.ok, acc2.code], [false, 'E_PROPOSAL_NOT_PENDING']);
		const acc3 = await proposalVia(srv, 'cli', 'accept', pa.data.proposalId);
		assert.deepEqual([acc3.ok, acc3.code], [false, 'E_PROPOSAL_NOT_PENDING']);
		// 非交互放行闸:只有 --yes 不够(退出码 2、提案仍待定);带放行变量才采纳,归档真落盘,HTTP 撤销采纳改回
		const c = await freshChart(srv, '闸');
		const h0 = await diskPrint(srv.home);
		const pc = await ENTRIES.cli.call(srv, 'propose_record_archive', { recordId: c });
		assert.ok(pc.ok);
		const blocked = await runCli(srv, ['proposals', 'accept', pc.data.proposalId, '--yes', '--json'], '');
		assert.equal(blocked.code, 2, `没放行变量应拒绝:${blocked.code} ${blocked.err.slice(0, 200)}`);
		assert.match(blocked.err, /HOROSA_ALLOW_UNATTENDED_APPROVAL/);
		assert.equal(await proposalStatus(srv, pc.data.proposalId), 'pending');
		const okc = await proposalVia(srv, 'cli', 'accept', pc.data.proposalId);
		assert.equal(okc.ok, true);
		const charts2 = JSON.parse(JSON.parse(fs.readFileSync(lsFile(srv.home), 'utf8'))['horosa.localCharts.v1']);
		assert.equal(!!(charts2.find((x)=>x.cid === c) || {}).archived, true, '采纳归档后盘上档案没归档');
		const rvc = await proposalVia(srv, 'mcp', 'revert', pc.data.proposalId);
		assert.equal(rvc.ok, true);
		assert.equal(await diskPrint(srv.home), h0);
		// 终端 undo 同样要放行变量
		const s = await ENTRIES.mcp.call(srv, 'star_record', { recordId: c });
		const ub = await runCli(srv, ['undo', s.actionId, '--yes'], '');
		assert.equal(ub.code, 2);
		assert.equal((await ledgerItem(srv, s.actionId)).undone, false, '没放行的 undo 不该生效');
		assert.equal((await undoVia(srv, 'cli', s.actionId)).ok, true);
	});

	it('🔴 只读档 × 三入口:一律 E_APPROVAL_DENIED,账本与盘上数据不动;切回全自动后照常', { timeout: 300000 }, async ()=>{
		const targets = await denyTargets(srv, WRITE_TOOLS, deny, 0);   // 在全自动档下先备好目标
		assert.equal(targets.length, WRITE_TOOLS.length);
		const set = await adminCall(srv, 'POST', '/admin/config', { key: 'approval', value: 'read-only' });
		assert.equal(set.body.config.approval, 'read-only');
		const fails = [];
		try{
			let cells = 0;
			const f0 = await diskPrint(srv.home);
			const t0 = await ledgerTotal(srv);
			outer: for(const { tool, ctx } of targets){   // eslint-disable-line no-labels
				for(const entry of Object.keys(ENTRIES)){
					cells += 1;
					const r = await ENTRIES[entry].call(srv, tool, FIXTURES[tool].args(ctx, 0), `ro-${tool}-${entry}`, DENY_MS);   // eslint-disable-line no-await-in-loop
					if(r.ok || r.code !== 'E_APPROVAL_DENIED'){ fails.push(`${tool} × ${entry}:${r.ok ? '执行了' : r.code}`); }
					if(r === TIMED_OUT){ break outer; }
				}
			}
			assert.deepEqual(fails, [], '只读档下有写入没被当场拒绝');
			assert.equal(cells, WRITE_TOOLS.length * Object.keys(ENTRIES).length, '只读档矩阵格数不对');
			assert.equal(await ledgerTotal(srv), t0, '只读档下账本动了');
			assert.equal(await diskPrint(srv.home), f0, '只读档下盘上数据动了');
		}finally{
			await adminCall(srv, 'POST', '/admin/config', { key: 'approval', value: 'auto' });
		}
		assert.deepEqual(fails, []);
		const back = await ENTRIES.rest.call(srv, 'star_record', { recordId: await freshChart(srv, '回') });
		assert.ok(back.ok, `切回全自动后写入应照常:${back.code}`);
	});

	it('🔴 「每次确认」档(无头没有审批台)× 三入口:一律 E_APPROVAL_DENIED,账本与盘上数据不动', { timeout: 420000 }, async ()=>{
		const targets = await denyTargets(srv, WRITE_TOOLS, deny, 1);   // 在全自动档下先备好目标
		const home = srv.home;
		const dead = srv.deadPort;
		await stopServe(srv);
		writePolicy(home, 'on-request');
		srv = await startServe(home, dead);
		const fails = [];
		let cells = 0;
		const f0 = await diskPrint(home);
		const t0 = await ledgerTotal(srv);
		outer: for(const { tool, ctx } of targets){   // eslint-disable-line no-labels
			for(const entry of Object.keys(ENTRIES)){
				cells += 1;
				const r = await ENTRIES[entry].call(srv, tool, FIXTURES[tool].args(ctx, 0), `or-${tool}-${entry}`, DENY_MS);   // eslint-disable-line no-await-in-loop
				if(r.ok || r.code !== 'E_APPROVAL_DENIED'){ fails.push(`${tool} × ${entry}:${r.ok ? '执行了' : r.code}`); }
				if(r === TIMED_OUT){ break outer; }   // 挂住 = 在等审批台:一格就够判红,不再逐格等
			}
		}
		assert.deepEqual(fails, [], '每次确认档下有写入没被当场拒绝');
		assert.equal(cells, WRITE_TOOLS.length * Object.keys(ENTRIES).length, '每次确认档矩阵格数不对');
		assert.equal(await ledgerTotal(srv), t0, '每次确认档下账本动了');
		assert.equal(await diskPrint(home), f0, '每次确认档下盘上数据动了');
		assert.deepEqual(fails, []);
	});
});

// 幂等键跨进程:没起服务时终端命令走本进程模式,每次一个新进程 —— 键随动作账本落盘,第二个进程照样认
// (此前键只在进程内存里:两个进程同键各写一条日志)。同一个 mkdtemp 数据目录,两个独立子进程依次调用,零服务、零端口
describe('幂等键跨进程(本进程模式)', ()=>{
	let home = null;
	let dead = 0;
	before(async ()=>{ dead = await closedPort(); home = makeHome('auto'); });
	after(()=>{ cleanupSync(); });
	const local = (args, input)=>runCli({ home, deadPort: dead }, [...args, '--local', '--json'], input, undefined, 300000);
	const body = (r)=>{ const res = JSON.parse(r.out); return normBody(((res && res.content) || []).map((c)=>c.text || '').join(''), { exit: r.code }); };
	const disk = ()=>JSON.parse(fs.readFileSync(lsFile(home), 'utf8'));
	it('🔴 两个子进程同键同参 append_record_journal:第二次回放(replayed)、日志只有一条、账本只有一笔;换参 = E_IDEMPOTENCY_CONFLICT', { timeout: 900000 }, async ()=>{
		const mk = body(await local(['call', 'create_chart_record', '-'], JSON.stringify({ name: '跨进程幂等', birth: '1990-01-01 08:00', place: '北京', allowDuplicate: true })));
		assert.ok(mk.ok, `建档失败:${mk.code} ${mk.message}`);
		const recordId = mk.data.cid;
		const args = JSON.stringify({ recordId, text: '同一条日志' });
		const a = body(await local(['call', 'append_record_journal', '-', '--idempotency-key', 'J-1'], args));
		assert.ok(a.ok, `第一次写日志失败:${a.code} ${a.message}`);
		const b = body(await local(['call', 'append_record_journal', '-', '--idempotency-key=J-1'], args));
		assert.deepEqual([b.ok, b.replayed, b.actionId], [true, true, a.actionId], `第二个进程没回放:${JSON.stringify(b)}`);
		const charts = JSON.parse(disk()['horosa.localCharts.v1']);
		const journal = ((charts.find((c)=>c.cid === recordId) || {}).journal || []).filter((j)=>j && j.text === '同一条日志');
		assert.equal(journal.length, 1, '跨进程同键重试写了第二条日志');
		const ledger = JSON.parse(disk()['horosa.ai.agent.ledger.v1']).filter((x)=>x && !x.pending && x.tool === 'append_record_journal');
		assert.equal(ledger.length, 1, '跨进程同键重试记了第二笔账');
		const c = body(await local(['call', 'append_record_journal', '-', '--idempotency-key', 'J-1'], JSON.stringify({ recordId, text: '另一条' })));
		assert.deepEqual([c.ok, c.code], [false, 'E_IDEMPOTENCY_CONFLICT']);
		const charts2 = JSON.parse(disk()['horosa.localCharts.v1']);
		assert.equal(((charts2.find((x)=>x.cid === recordId) || {}).journal || []).filter((j)=>j && j.text === '另一条').length, 0, '冲突的调用执行了');
	});
});

describe('stdio 代理:原服务退出、本会话接管前后同一个客户端名', ()=>{
	let home = null;
	let dead = 0;
	let srv = null;
	let proxy = null;
	before(async ()=>{ dead = await closedPort(); home = makeHome('auto'); });
	after(async ()=>{ if(proxy && proxy.exitCode === null){ try{ proxy.kill('SIGKILL'); }catch(e){ /* 已退 */ } } await stopServe(srv); cleanupSync(); });
	const disk = ()=>JSON.parse(fs.readFileSync(lsFile(home), 'utf8'));
	it('🔴 经 HTTP 写 → 杀服务 → 同会话接管 → 同键重试 replayed:true,日志与账本各一条(客户端只在 initialize 报名)', { timeout: 900000 }, async ()=>{
		srv = await startServe(home, dead);
		const mk = await ENTRIES.mcp.call(srv, 'create_chart_record', { name: '接管同名', birth: '1990-01-01 08:00', place: '北京', allowDuplicate: true });
		assert.ok(mk.ok, `建档失败:${mk.code} ${mk.message}`);
		const recordId = mk.data.cid;
		proxy = spawn(process.execPath, [CLI, 'mcp'], { env: childEnv(home, dead), stdio: ['pipe', 'pipe', 'pipe'] });
		CHILDREN.add(proxy);
		proxy.once('exit', ()=>CHILDREN.delete(proxy));
		let buf = ''; let errLog = '';
		const replies = new Map();
		proxy.stdout.on('data', (d)=>{
			buf += d;
			let i;
			while((i = buf.indexOf('\n')) >= 0){
				const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
				if(!line){ continue; }
				try{ const m = JSON.parse(line); if(m && m.id !== undefined){ replies.set(m.id, m); } }catch(e){ /* 非协议行 */ }
			}
		});
		proxy.stderr.on('data', (d)=>{ errLog += d; });
		const send = (m)=>proxy.stdin.write(`${JSON.stringify(m)}\n`);
		const reply = async (id, ms)=>{
			const end = Date.now() + (ms || CALL_MS);
			while(Date.now() < end){
				if(replies.has(id)){ return replies.get(id); }
				if(proxy.exitCode !== null){ throw new Error(`代理退出了:${errLog.slice(-600)}`); }
				await sleep(100);   // eslint-disable-line no-await-in-loop
			}
			throw new Error(`等回包 ${id} 超时:${errLog.slice(-600)}`);
		};
		const toolBody = (m)=>{ assert.ok(m.result, `调用出错:${JSON.stringify(m.error || m).slice(0, 300)}`); return normBody((m.result.content || []).map((c)=>c.text || '').join('')); };
		send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'claude-code', version: '9' } } });
		assert.ok((await reply(1)).result, '握手失败');
		const call = (id)=>send({ jsonrpc: '2.0', id, method: 'tools/call', params: { name: 'append_record_journal', arguments: { recordId, text: '接管前后同一条' }, _meta: { idempotencyKey: 'TK-1' } } });
		call(2);
		const a = toolBody(await reply(2));
		assert.ok(a.ok && a.actionId, `经 HTTP 第一次写失败:${a.code} ${a.message}`);
		await stopServe(srv);   // 原服务退出(数据锁随之释放):代理下一条请求连不上 → 本会话接管
		call(3);
		const b = toolBody(await reply(3, 300000));
		assert.deepEqual([b.ok, b.replayed, b.actionId], [true, true, a.actionId], `接管后同键重试没回放:${JSON.stringify(b)} ${errLog.slice(-400)}`);
		proxy.stdin.end();
		await new Promise((r)=>{ if(proxy.exitCode !== null){ r(); }else{ proxy.once('exit', r); } });
		await sleep(SETTLE_MS);
		const charts = JSON.parse(disk()['horosa.localCharts.v1']);
		const journal = ((charts.find((c)=>c.cid === recordId) || {}).journal || []).filter((j)=>j && j.text === '接管前后同一条');
		assert.equal(journal.length, 1, '接管后同键重试写了第二条日志');
		const ledger = JSON.parse(disk()['horosa.ai.agent.ledger.v1']).filter((x)=>x && !x.pending && x.tool === 'append_record_journal');
		assert.equal(ledger.length, 1, '接管后同键重试记了第二笔账');
		assert.equal(ledger[0].clientName, 'claude-code', '经代理转发的写入没记成客户端自报的名字');
	});
});
