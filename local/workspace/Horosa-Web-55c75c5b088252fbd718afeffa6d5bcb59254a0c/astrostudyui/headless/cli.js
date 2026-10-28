#!/usr/bin/env node
// 星阙无头命令行(仓库根的 ./horosa 即调本文件):不需要桌面 App。子命令与桌面版终端命令一致(status / tools / describe / call / … / 简写),
// 另有服务生命周期(setup / start / stop / serve / mcp / doctor)与人工操作(config、ai 模型接口、proposals 采纳 / 拒绝 / 撤销采纳、export / import)。
// 人工操作走管理口(管理令牌 ≠ 接口令牌);密钥只从隐藏输入 / 标准输入 / 指定的环境变量名读,绝不从命令行参数读(会留在 shell 历史与进程表里)。
// 连接方式自动选:--app = 桌面 App 的本机服务;否则无头服务在跑就经它(HTTP);都没有就在本进程里直接跑工具(持数据锁,防两个进程同写)。
// 退出码:0 成功 · 1 工具回报失败 · 2 用法错 · 3 服务没开 / 连不上 · 4 令牌不对 · 5 其它失败 · 130 Ctrl-C 取消。
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const UI_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(UI_ROOT, '../..');
const EXIT = { OK: 0, TOOL_ERROR: 1, USAGE: 2, NOT_RUNNING: 3, AUTH: 4, FAILED: 5, INTERRUPTED: 130 };
const SHORTCUTS = [['records', 'list_records', 'query'], ['tasks', 'list_tasks', null], ['context', 'get_current_context', null], ['proposals', 'list_proposals', null], ['actions', 'list_actions', null], ['materials', 'search_materials', 'query']];
const HEADLESS_NOT_RUNNING = '无头服务没在跑(./horosa start 起服务;或去掉 --server 让本进程直接跑)';
const APP_NOT_RUNNING = '桌面 App 的本机服务没开:在星阙「AI 分析 › 进阶 › 外部连接」打开「外部智能体连接」';

function usage(){
	const lines = [
		'星阙无头命令行(不需要桌面 App;与桌面版终端命令同一组子命令、同一套工具)',
		'',
		'用法: ./horosa <子命令> [参数] [--json] [--timeout 秒] [--progress | --no-progress] [--app | --server | --local]',
		'',
		'服务:',
		'  setup                       首次部署:工具链(JDK17 / Node / Maven / Python)+ 构建;已就绪的步骤自动跳过',
		'  start [--port N] [--no-rest] 起本机计算服务 + 无头接口服务(后台;MCP / REST / 终端命令共用一份数据)',
		'  stop [--all]                停无头接口服务(--all 连本机计算服务一起停)',
		'  serve [--port N] [--no-rest] 前台跑无头接口服务(Ctrl-C 停)',
		'  mcp                         stdio MCP:给 Claude Code / Claude Desktop / Codex / Cursor 等直接拉起',
		'  doctor                      自检(运行时 / 依赖 / 端口 / 服务 / 数据目录)',
		'  selftest                    全链路自测(真工具层、临时数据目录、零窗口;含写入面三入口矩阵与批量验证,约 3 分钟)',
		'  status                      服务状态(地址 / 版本 / 工具件数)',
		'  endpoint                    端点文件路径',
		'  config [键 [值]]            查看 / 修改设置:approval(auto|read-only)· headless-analysis(on|off)· private-read(on|off)· web-fetch(on|off)',
		'  ai [status]                 模型接口:当前用哪个、有哪些档案(密钥只报有没有)',
		'  ai add <接口类型> [--model M[,M2]] [--base-url U] [--name N] [--key-env 变量名 | --key-stdin] [--no-use]',
		'                              新建接口档案(缺省设为当前;不给密钥来源就隐藏输入;接口类型:openai / anthropic / gemini / deepseek / ollama / custom …)',
		'  ai key <档案> [--key-env 变量名 | --key-stdin] · ai use <档案> [模型] · ai remove <档案> [--yes] · ai test [档案] [--model M]',
		'  export [文件] [--overwrite]  整库导出(与桌面「全量备份」同一格式,桌面可直接恢复;密钥不随包走)',
		'  import <文件> [--dry-run] [--yes]   导入桌面或无头的全量备份(先列出将写入什么;导入前整份数据目录自动留快照)',
		'  proposals [accept|reject|revert <提案id>] [--yes]   AI 提议的档案修改:不带参数 = 列出;采纳等只能由人来做',
		'  (人工子命令在非交互环境要同时 --yes 与 HOROSA_ALLOW_UNATTENDED_APPROVAL=1;放宽设置 config approval auto 等同此)',
		'  undo <动作id> [--yes]       撤销 AI 做过的一条写入(./horosa actions 列出最近的动作与 id)',
		'  import … [--include-security]   备份里的安全开关(审批档 / 私人内容 / 联网等)缺省每项取本机与备份里较严的一档,要整值一并导入加这个',
		'',
		'批量验证:',
		'  batch <命例文件> -t <技法,…|all> [-o 输出.jsonl] [-j 并行数] [--resume]   一批命例逐例起盘,一行一例写 JSONL + 汇总(./horosa batch --help 看全部选项)',
		'  batch --celebrities -t …    用内置名人库(约 5.9 万例)当命例',
		'  batch-pack [输出.tar.gz]    打批量运行包:到 Linux 服务器上只要 Node + Python(+ Java)就能跑,不用装前端依赖',
		'',
		'工具:',
		'  tools                       列出全部工具(只读 / 写入)',
		'  describe <工具>             某件工具的说明与参数结构',
		'  call <工具> [参数…]         调用任意工具;参数 = JSON 对象 / k=v(字符串)/ k:=JSON / -(从标准输入读 JSON)',
		'  call … --idempotency-key K  写入类:同一个键重试不重复写(同键换参数被拒;键随动作账本落盘保留 30 分钟,换进程 / 服务重启后照样认;也可写 --idempotency-key=K)',
		'  resources [--cursor C] · templates · read <资源地址> · prompts [--cursor C] · prompt <名称> [k=v…]',
		'',
		'简写(= call 对应工具):',
	];
	for(const [c, t, p] of SHORTCUTS){ lines.push(`  ${`${c}${p ? ` [${p}]` : ''}`.padEnd(28)}= call ${t}`); }
	lines.push('', '连接:缺省 = 无头服务在跑就经它,否则本进程直接跑;--server 只经无头服务;--local 只在本进程跑;--app = 桌面 App 的本机服务。',
		'数据目录:HOROSA_HOME(缺省 ~/.horosa);后端地址:HOROSA_SERVER_ROOT(缺省 http://127.0.0.1:9999)或 HOROSA_SERVER_PORT;排盘服务端口 HOROSA_CHART_PORT(缺省 8899)。',
		'模型接口也可只用环境变量(不落盘,优先于 ./horosa ai):HOROSA_AI_PROVIDER · HOROSA_AI_MODEL · HOROSA_AI_BASE_URL · HOROSA_AI_API_KEY(或 OPENAI_API_KEY 等各家常用名)。',
		'', '例:', '  ./horosa start', '  ./horosa records 张', '  ./horosa call create_chart_record name=张三 birth=\'1990-01-01 08:00\' place=北京 gender=male',
		'  ./horosa call cast_technique technique=bazi source:=\'{"kind":"record","cid":"local-…"}\'', '  echo \'{"query":"张"}\' | ./horosa call list_records -',
		'', '退出码: 0 成功 · 1 工具回报失败 · 2 用法错 · 3 服务没开 · 4 令牌不对 · 5 其它失败 · 130 Ctrl-C 取消');
	return `${lines.join('\n')}\n`;
}

// ───────────────────────── 参数解析(纯函数)─────────────────────────

function buildArguments(tokens){
	const obj = {};
	let stdin = false;
	for(const t of tokens){
		if(t === '-'){ stdin = true; continue; }
		if(t.trim().startsWith('{')){
			let v;
			try{ v = JSON.parse(t); }catch(e){ throw new Error(`参数不是合法 JSON 对象: ${e.message}`); }
			if(!v || typeof v !== 'object' || Array.isArray(v)){ throw new Error('参数 JSON 须是对象'); }
			Object.assign(obj, v);
			continue;
		}
		const ci = t.indexOf(':=');
		const ei = t.indexOf('=');
		if(ci > 0 && (ei < 0 || ci < ei)){
			const k = t.slice(0, ci);
			try{ obj[k] = JSON.parse(t.slice(ci + 2)); }catch(e){ throw new Error(`参数 ${k} 的 JSON 值不合法: ${e.message}`); }
			continue;
		}
		if(ei > 0){ obj[t.slice(0, ei)] = t.slice(ei + 1); continue; }
		throw new Error(`看不懂的参数「${t}」:参数须是 JSON 对象、k=v、k:=JSON 或 -`);
	}
	return { args: obj, stdin };
}

// 带值选项的 `--选项=值` 写法(与桌面壳终端命令同一组;合同测试:桌面壳认的这里必认)
const EQ_VALUE_OPTIONS = ['timeout', 'port', 'cursor', 'endpoint', 'model', 'base-url', 'name', 'key-env', 'idempotency-key'];
function parseArgs(argv){
	const opts = { json: false, progress: null, timeout: null, via: 'auto', yes: false, port: null, rest: true, all: false, cursor: null, endpoint: null,
		model: null, baseUrl: null, name: null, keyEnv: null, keyStdin: false, use: true, dryRun: false, overwrite: false, includeSecurity: false, idempotencyKey: null };
	const pos = [];
	let help = false;
	for(let i = 0; i < argv.length; i++){
		const a = argv[i];
		const val = (name)=>{ i += 1; if(i >= argv.length){ throw new Error(`${name} 后面要跟一个值`); } return argv[i]; };
		switch(a){
		case '--json': opts.json = true; break;
		case '--progress': opts.progress = true; break;
		case '--no-progress': case '--quiet': case '-q': opts.progress = false; break;
		case '-h': case '--help': help = true; break;
		case '--version': case '-V': return { opts, cmd: 'version', rest: [] };
		case '--app': opts.via = 'app'; break;
		case '--server': opts.via = 'server'; break;
		case '--local': opts.via = 'local'; break;
		case '--yes': case '-y': opts.yes = true; break;
		case '--all': opts.all = true; break;
		case '--no-rest': opts.rest = false; break;
		case '--port': opts.port = Number(val('--port')); break;
		case '--cursor': opts.cursor = val('--cursor'); break;
		case '--endpoint': opts.endpoint = val('--endpoint'); break;
		case '--model': opts.model = val('--model'); break;
		case '--base-url': opts.baseUrl = val('--base-url'); break;
		case '--name': opts.name = val('--name'); break;
		case '--key-env': opts.keyEnv = val('--key-env'); break;
		case '--key-stdin': opts.keyStdin = true; break;
		case '--no-use': opts.use = false; break;
		case '--dry-run': opts.dryRun = true; break;
		case '--overwrite': opts.overwrite = true; break;
		case '--include-security': opts.includeSecurity = true; break;
		// 口径与协议层 / 页面注册表同一份(去首尾空白、按码点计、上限 200;共用用例表对拍)
		case '--idempotency-key': { const proto = require('./protocol'); const n = proto.idempotencyKeyCheck({ _meta: { idempotencyKey: `${val('--idempotency-key')}` } }); if(!n.key){ throw new Error(`--idempotency-key 要 1..${proto.IDEMPOTENCY_KEY_MAX} 字的键`); } opts.idempotencyKey = n.key; break; }
		case '--api-key': case '--key': throw new Error(`${a} 不收:密钥放命令行会留在 shell 历史与进程表里。用 --key-env 变量名、--key-stdin,或不给(隐藏输入)`);
		case '--timeout': { const n = Number(val('--timeout')); if(!(n >= 1 && n <= 600)){ throw new Error('--timeout 要 1..600 之间的秒数'); } opts.timeout = n; break; }
		default:
			if(/^--(api-key|key)=/.test(a)){ throw new Error('--api-key / --key 不收:密钥放命令行会留在 shell 历史与进程表里。用 --key-env 变量名、--key-stdin,或不给(隐藏输入)'); }
			if(EQ_VALUE_OPTIONS.some((o)=>a.startsWith(`--${o}=`))){ const [k, v] = a.slice(2).split(/=(.*)/s); argv.splice(i + 1, 0, v); argv[i] = `--${k}`; i -= 1; break; }
			if(a.startsWith('--')){ throw new Error(`不认识的选项 ${a}`); }
			pos.push(a);
		}
	}
	if(help){ return { opts, cmd: 'help', rest: pos }; }
	return { opts, cmd: pos[0] || 'help', rest: pos.slice(1) };
}

// ───────────────────────── 人读输出(与桌面版终端命令同形)─────────────────────────

const clip = (s, n)=>{ const a = Array.from(`${s || ''}`); return a.length <= n ? a.join('') : `${a.slice(0, n).join('')}…`; };
const firstLine = (s)=>`${s || ''}`.split('\n')[0].trim();
function fmtTools(tools){
	const w = Math.max(0, ...tools.map((t)=>`${t.name}`.length));
	const out = tools.map((t)=>{
		const ro = t.annotations && t.annotations.readOnlyHint === true;
		const desc = firstLine(t.description);
		const summary = t.title ? `${t.title} — ${clip(desc, 48)}` : clip(desc, 60);
		return `${`${t.name}`.padEnd(w)}  ${ro ? '只读' : '写入'}  ${summary}`;
	});
	out.push(`共 ${tools.length} 件(horosa describe <工具> 看参数)`);
	return `${out.join('\n')}\n`;
}
function fmtDescribe(t){
	let s = `${t.name}${t.title ? ` · ${t.title}` : ''}\n\n`;
	if(t.description){ s += `${`${t.description}`.trim()}\n\n`; }
	s += `参数结构:\n${JSON.stringify(t.inputSchema || {}, null, 2)}\n`;
	if(t.outputSchema){ s += `\n回包结构(--json 时的 structuredContent):\n${JSON.stringify(t.outputSchema, null, 2)}\n`; }
	return s;
}
function fmtToolResult(r){
	const isError = !!(r && r.isError);
	let body = ((r && r.content) || []).filter((x)=>x && typeof x.text === 'string').map((x)=>x.text).join('\n');
	if(!body.trim() && r && r.structuredContent){ body = JSON.stringify(r.structuredContent, null, 2); }
	return { text: body.endsWith('\n') ? body : `${body}\n`, isError };
}
function fmtList(items, key, label, next){
	const out = (items || []).map((it)=>{
		const k = `${it[key] || ''}`;
		const name = `${it.name || ''}`;
		const desc = firstLine(it.description);
		if((!name || name === k) && !desc){ return k; }
		if(!name || name === k){ return `${k}  ${clip(desc, 60)}`; }
		return desc ? `${k}  ${name} — ${clip(desc, 48)}` : `${k}  ${name}`;
	});
	out.push(`共 ${(items || []).length} 条${label}`);
	if(next){ out.push(`还有下一页:加 --cursor ${next}`); }
	return `${out.join('\n')}\n`;
}
function fmtContents(r){
	return ((r && r.contents) || []).map((c)=>(typeof c.text === 'string' ? (c.text.endsWith('\n') ? c.text : `${c.text}\n`) : `[二进制内容 ${c.mimeType || ''}]\n`)).join('');
}
function fmtPrompt(r){
	let s = r && r.description ? `# ${r.description}\n\n` : '';
	for(const m of (r && r.messages) || []){ s += `[${m.role}]\n${(m.content && m.content.text) || ''}\n\n`; }
	return s;
}
function fmtProgress(p){
	const n = Number(p.progress);
	const t = Number(p.total);
	const num = (v)=>(Number.isInteger(v) ? `${v}` : `${Math.round(v * 1000) / 1000}`);
	const head = Number.isFinite(n) ? (Number.isFinite(t) ? `[${num(n)}/${num(t)}]` : `[${num(n)}]`) : '[…]';
	return p.message ? `${head} ${p.message}` : head;
}

// ───────────────────────── 连接 ─────────────────────────

class CliError extends Error{ constructor(code, message){ super(message); this.exitCode = code; } }

function readJson(file){ try{ return JSON.parse(fs.readFileSync(file, 'utf8')); }catch(e){ return null; } }
function pidAlive(pid){ try{ process.kill(Number(pid), 0); return true; }catch(e){ return e && e.code === 'EPERM'; } }

function appIdentifier(){
	const conf = readJson(path.join(REPO_ROOT, 'Horosa_Desktop_Installer/src-tauri/tauri.conf.json'));
	return (conf && conf.identifier) || 'com.horacedong.horosa';
}
function appEndpointPath(){
	if(process.env.HOROSA_MCP_ENDPOINT){ return process.env.HOROSA_MCP_ENDPOINT; }
	const base = process.platform === 'darwin' ? path.join(os.homedir(), 'Library/Application Support')
		: process.platform === 'win32' ? (process.env.APPDATA || os.homedir()) : (process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'));
	return path.join(base, appIdentifier(), 'mcp-endpoint.json');
}
function headlessEndpointPath(){ return require('./server').endpointFile(); }

// 端点地址只认本机回环(不带用户名 / 密码段):端点文件被换成外部地址时,令牌与工具参数绝不往外发
function loopbackUrl(u){
	try{
		const x = new URL(`${u}`);
		return (x.protocol === 'http:' || x.protocol === 'https:') && !x.username && !x.password
			&& ['127.0.0.1', 'localhost', '[::1]', '::1'].indexOf(x.hostname) >= 0;
	}catch(e){ return false; }
}
// 健康探针:回包要是星阙、且(端点文件写了 pid 时)pid 对得上 —— 进程号被复用 / 端口被别的程序占了,都不把令牌交出去
async function httpAlive(ep){
	try{
		if(!ep || !loopbackUrl(ep.url)){ return null; }
		const base = ep.url.replace(/\/mcp$/, '');
		const r = await fetch(`${base}/healthz`, { signal: AbortSignal.timeout(2000) });
		if(!r.ok){ return null; }
		const h = await r.json();
		if(!h || h.app !== 'horosa'){ return null; }
		if(ep.pid !== undefined && h.pid !== undefined && Number(h.pid) !== Number(ep.pid)){ return null; }
		return h;
	}catch(e){ return null; }
}

// HTTP 传输:一条 JSON-RPC(要进度就带 progressToken + 事件流);Ctrl-C = 发取消通知
function httpTransport(ep, label){
	let seq = 1;
	const post = (body, signal)=>fetch(ep.url, { method: 'POST', signal, headers: { Authorization: `Bearer ${ep.token}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) });
	return {
		label,
		async request(method, params, onProgress){
			const id = `cli-${process.pid}-${seq++}`;
			const ac = new AbortController();
			const onSig = ()=>{ INTERRUPT.fired = true; post({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: id, reason: '用户在终端按了 Ctrl-C' } }).catch(()=>{}).finally(()=>ac.abort()); };
			INTERRUPT.handlers.add(onSig);
			try{
				let resp;
				try{ resp = await post({ jsonrpc: '2.0', id, method, params }, ac.signal); }catch(e){
					if(INTERRUPT.fired){ throw new CliError(EXIT.INTERRUPTED, '已取消'); }
					throw new CliError(EXIT.NOT_RUNNING, label === 'app' ? APP_NOT_RUNNING : HEADLESS_NOT_RUNNING);
				}
				if(resp.status === 401){ throw new CliError(EXIT.AUTH, '令牌不对:服务重启或轮换过令牌,端点文件不是正在跑的那份(horosa endpoint 看路径)'); }
				if(resp.status === 403){ throw new CliError(EXIT.AUTH, `被拒绝(HTTP 403):${(await resp.text()).trim()}`); }
				const ct = `${resp.headers.get('content-type') || ''}`.toLowerCase();
				let answer = null;
				if(ct.startsWith('text/event-stream')){
					const reader = resp.body.getReader();
					const dec = new TextDecoder();
					let buf = '';
					for(;;){
						let chunk;
						try{ chunk = await reader.read(); }catch(e){ break; }
						if(chunk.done){ break; }
						buf += dec.decode(chunk.value, { stream: true });
						let idx;
						while((idx = buf.indexOf('\n\n')) >= 0){
							const ev = buf.slice(0, idx); buf = buf.slice(idx + 2);
							const data = ev.split('\n').filter((l)=>l.startsWith('data:')).map((l)=>l.slice(5).replace(/^ /, '')).join('\n');
							if(!data){ continue; }
							let m; try{ m = JSON.parse(data); }catch(e){ continue; }
							if(m.method === 'notifications/progress'){ if(onProgress){ onProgress(m.params || {}); } continue; }
							if(m.id === id && !m.method){ answer = m; }
						}
						if(answer){ break; }
					}
				}else{
					try{ answer = JSON.parse(await resp.text()); }catch(e){ throw new CliError(EXIT.FAILED, `回体不是 JSON(HTTP ${resp.status})`); }
				}
				if(INTERRUPT.fired){ throw new CliError(EXIT.INTERRUPTED, '已取消'); }
				if(!answer){ throw new CliError(EXIT.FAILED, '响应流没有回包就结束了'); }
				return answer;
			}finally{
				INTERRUPT.handlers.delete(onSig);
			}
		},
		close(){},
	};
}

// 本进程传输:直接跑工具层(持数据锁,防两个进程同写一份数据)
async function localTransport(opts){
	const lock = acquireDataLock();
	const { createRuntime } = require('./runtime');
	const protocol = require('./protocol');
	const { appVersion } = require('./server');
	const toErr = (...a)=>process.stderr.write(`${require('util').format(...a)}\n`);
	console.log = toErr; console.info = toErr; console.debug = toErr;   // eslint-disable-line no-console
	const rt = await createRuntime({ quiet: true });
	const version = appVersion();
	let seq = 1;
	return {
		label: 'local',
		async request(method, params, onProgress){
			const ac = new AbortController();
			const onSig = ()=>{ INTERRUPT.fired = true; ac.abort(); };
			INTERRUPT.handlers.add(onSig);
			try{
				const out = await protocol.handleMessage({ jsonrpc: '2.0', id: `local-${seq++}`, method, params }, { rt, clientName: 'cli', sessionId: 'cli', version, signal: ac.signal, onNotification: (n)=>{ if(onProgress && n.params){ onProgress(n.params); } } });
				if(INTERRUPT.fired){ throw new CliError(EXIT.INTERRUPTED, '已取消'); }
				return out;
			}finally{ INTERRUPT.handlers.delete(onSig); }
		},
		rt,
		close(){ try{ rt.close(); }catch(e){ /* noop */ } lock.release(); },
	};
}

// 进程号对应的确实是星阙无头进程(进程号被系统复用给别的程序时,不把它当持锁者)
function isHorosaProcess(pid){
	const r = spawnSync('ps', ['-p', `${pid}`, '-o', 'command='], { encoding: 'utf8' });
	return /headless\/cli\.js|horosa/.test(`${r.stdout || ''}`);
}
function lockHolder(file){
	try{ return Number(`${fs.readFileSync(file, 'utf8')}`.split('\n')[0].trim()) || 0; }catch(e){ return 0; }
}
// 数据锁:先把「pid + 时刻」写进临时文件,再 link 成锁文件 —— link 是原子的,锁文件一出现就带着内容
// (此前「建空文件 → 再写 pid」之间,别的进程会读到空内容、当成残留锁删掉,两个进程同时持锁、各写各的互相覆盖)
function acquireDataLock(){
	const { dataDir } = require('./runtime');
	fs.mkdirSync(dataDir(), { recursive: true, mode: 0o700 });
	const file = path.join(dataDir(), '.lock');
	for(let i = 0; i < 3; i++){
		const tmp = `${file}.${process.pid}.${Date.now()}.${i}`;
		fs.writeFileSync(tmp, `${process.pid}\n${new Date().toISOString()}\n`, { mode: 0o600 });
		try{
			fs.linkSync(tmp, file);
			try{ fs.unlinkSync(tmp); }catch(e){ /* noop */ }
			const release = ()=>{ try{ if(lockHolder(file) === process.pid){ fs.unlinkSync(file); } }catch(e){ /* noop */ } };
			process.once('exit', release);
			return { release };
		}catch(e){
			try{ fs.unlinkSync(tmp); }catch(err){ /* noop */ }
			if(!e || e.code !== 'EEXIST'){ throw e; }
			const holder = lockHolder(file);
			if(holder && holder !== process.pid && pidAlive(holder) && isHorosaProcess(holder)){
				throw new CliError(EXIT.FAILED, `数据正被另一个星阙进程使用(pid ${holder});先 ./horosa start 起无头服务,所有命令就都经它并发使用`);
			}
			// 残留锁(持锁进程已不在 / 进程号已被别的程序占用):按读到的内容核对后再删,删完重试
			if(lockHolder(file) === holder){ try{ fs.unlinkSync(file); }catch(err){ /* 竞争:重试 */ } }
		}
	}
	throw new CliError(EXIT.FAILED, '拿不到数据锁');
}

async function pickTransport(opts){
	if(opts.via === 'app' || opts.endpoint){
		const file = opts.endpoint || appEndpointPath();
		const ep = readJson(file);
		if(!ep || !ep.url || !ep.token){ throw new CliError(EXIT.NOT_RUNNING, opts.via === 'app' ? APP_NOT_RUNNING : `端点文件不可用:${file}`); }
		if(!loopbackUrl(ep.url)){ throw new CliError(EXIT.AUTH, `端点地址不是本机回环(${ep.url}),拒绝把令牌发过去:${file}`); }
		return httpTransport(ep, opts.via === 'app' ? 'app' : 'endpoint');
	}
	if(opts.via !== 'local'){
		const ep = readJson(headlessEndpointPath());
		if(ep && ep.url && ep.token && pidAlive(ep.pid) && await httpAlive(ep)){ return httpTransport(ep, 'server'); }
		if(opts.via === 'server'){ throw new CliError(EXIT.NOT_RUNNING, HEADLESS_NOT_RUNNING); }
	}
	return localTransport(opts);
}

const INTERRUPT = { fired: false, handlers: new Set() };
process.on('SIGINT', ()=>{
	if(INTERRUPT.handlers.size === 0){ process.exit(EXIT.INTERRUPTED); }
	INTERRUPT.handlers.forEach((h)=>{ try{ h(); }catch(e){ /* noop */ } });
});

// ───────────────────────── 本机计算服务(Java / Python)─────────────────────────

// 后端地址单一来源 = ports.js(探测 / 起服务脚本 / 运行时三处同一份):HOROSA_SERVER_ROOT > HOROSA_SERVER_PORT > 9999;
// 排盘服务 HOROSA_CHART_PORT > 8899;端口写错 / 两处不一致 = 用法错
function backendPorts(){
	const { backendPorts: resolvePorts, PortConfigError } = require('./ports');
	try{ return resolvePorts(); }catch(e){
		if(e instanceof PortConfigError){ throw new CliError(EXIT.USAGE, e.message); }
		throw e;
	}
}
// 端口探测按「有没有进程在听」判(TCP 连得上 = 在跑;连接被拒 = 没开;超时 = 当作在跑 —— 宁可不拉,也不去重启一个忙着的服务)
function portStateAt(port, host){
	return new Promise((resolve)=>{
		const sock = require('net').connect({ host: `${host || '127.0.0.1'}`.replace(/^\[|\]$/g, ''), port });
		const done = (st)=>{ clearTimeout(t); sock.destroy(); resolve(st); };
		const t = setTimeout(()=>done('busy'), 1500);
		sock.once('connect', ()=>done('open'));
		// 连接被拒 / 本机没有这个地址族(如关了 IPv6)= 这一族没在听
		sock.once('error', (e)=>done(e && (e.code === 'ECONNREFUSED' || e.code === 'EADDRNOTAVAIL' || e.code === 'EAFNOSUPPORT') ? 'closed' : 'busy'));
	});
}
// hosts:ports.js 的 probeHosts(本机回环两个地址族都试):任一连得上 = 在跑;都被拒 = 没开;其余(超时等)= 当作在跑
async function portState(port, hosts){
	const list = Array.isArray(hosts) && hosts.length ? hosts : [hosts || '127.0.0.1'];
	const states = await Promise.all(list.map((h)=>portStateAt(port, h)));
	if(states.includes('open')){ return 'open'; }
	return states.every((s)=>s === 'closed') ? 'closed' : 'busy';
}
async function backendsUp(){
	const p = backendPorts();
	const [a, b] = await Promise.all([portState(p.server, p.probeHosts), portState(p.chart, p.probeHosts)]);
	const up = (st)=>st !== 'closed';
	return { server: up(a), chart: up(b), ok: up(a) && up(b), none: a === 'closed' && b === 'closed', remote: !!p.remote, ports: p };
}
// 起 / 停后端的子进程:端口按 backendPorts 显式写回脚本认的两个变量(只设了 HOROSA_SERVER_ROOT 时脚本也落在同一个口);
// 不带模型密钥(它们用不着;后端常驻,密钥会一直留在它们的环境里)
function backendEnv(){
	const env = { ...process.env, HOROSA_SKIP_UI_BUILD: '1', HOROSA_SKIP_UI_CHECK: '1', ...require('./ports').backendPortEnv(backendPorts()) };
	Object.keys(env).forEach((k)=>{ if(/_API_KEY$/i.test(k) || /^HOROSA_AI_/.test(k)){ delete env[k]; } });
	return env;
}
// 只开了一半时不跑起服务脚本:它按端口回收再起,会把在跑的那个也重启(打断桌面 App / 别的会话正在算的盘)
function halfUpMessage(be){
	return `本机计算服务只开了一半(Java :${be.ports.server} ${be.server ? '在' : '不在'} · Python :${be.ports.chart} ${be.chart ? '在' : '不在'}):不自动起 —— 起服务脚本会把在跑的那个也重启、打断正在用它的会话。确认可以重启就先 ./horosa stop --all 再 ./horosa start;或把 HOROSA_SERVER_PORT / HOROSA_CHART_PORT 都指到空闲端口`;
}
// 「正在拉起后端」标记:多个会话同时打开时只拉一次(标记 2 分钟内有效)
function claimBackendStart(){
	const { headlessDir } = require('./runtime');
	const f = path.join(headlessDir(), 'backends-starting');
	fs.mkdirSync(headlessDir(), { recursive: true, mode: 0o700 });
	try{
		const st = fs.statSync(f);
		if(Date.now() - st.mtimeMs < 120000){ return false; }
		fs.unlinkSync(f);
	}catch(e){ /* 没有标记 */ }
	try{ fs.writeFileSync(f, `${process.pid}\n`, { flag: 'wx', mode: 0o600 }); return true; }catch(e){ return false; }
}
function openLog(name){
	const { headlessDir } = require('./runtime');
	const dir = path.join(headlessDir(), 'logs');
	fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
	const file = path.join(dir, name);
	const fd = fs.openSync(file, 'a', 0o600);
	try{ fs.chmodSync(file, 0o600); }catch(e){ /* noop */ }
	return fd;
}
function startBackends(opts){
	const script = path.join(REPO_ROOT, 'Horosa-Web/start_horosa_local.sh');
	if(!fs.existsSync(script)){ throw new CliError(EXIT.FAILED, `找不到 ${script}`); }
	const env = backendEnv();
	if(opts && opts.background){
		const log = openLog('backends.log');
		const child = spawn('bash', [script], { cwd: path.dirname(script), env, detached: true, stdio: ['ignore', log, log] });
		child.unref();
		return null;
	}
	const r = spawnSync('bash', [script], { cwd: path.dirname(script), env, stdio: ['ignore', process.stderr, process.stderr] });
	return r.status;
}
// 起服务脚本的调用口(测试换成记录器,断言「只开了一半 / 地址在别的机器」时根本不跑脚本;生产路径恒为 startBackends)
const BACKEND = { start: startBackends };

// ───────────────────────── 子命令 ─────────────────────────

// 输出出口(测试可换成收集器;缺省直写标准输出 / 标准错误)
const IO = { out: (s)=>process.stdout.write(s), err: (s)=>process.stderr.write(s) };
const out = (s)=>IO.out(s);
const err = (s)=>IO.err(s);

async function cmdTool(opts, method, params, render){
	const tr = await pickTransport(opts);
	try{
		const show = (opts.progress === null ? process.stderr.isTTY : opts.progress) && !opts.json;
		const p = { ...(params || {}) };
		if(method === 'tools/call'){
			p._meta = { ...(p._meta || {}), clientName: 'cli' };
			if(opts.timeout){ p._meta.timeoutMs = opts.timeout * 1000; }
			if(opts.idempotencyKey){ p._meta.idempotencyKey = opts.idempotencyKey; }   // 同键重试不重复写(与 MCP 的 _meta.idempotencyKey、REST 的 Idempotency-Key 头同义)
			if(show){ p._meta.progressToken = `cli-${process.pid}`; }
		}
		const ans = await tr.request(method, p, show ? (pp)=>err(`${fmtProgress(pp)}\n`) : null);
		if(ans.error){
			if(ans.error.code === -32001){ throw new CliError(EXIT.NOT_RUNNING, `${tr.label === 'app' ? APP_NOT_RUNNING : '本机服务未就绪'}(${ans.error.message})`); }
			throw new CliError(EXIT.FAILED, `${ans.error.message}(错误码 ${ans.error.code})`);
		}
		return render(ans.result);
	}finally{ tr.close(); }
}

async function readStdinJson(){
	const chunks = [];
	for await (const c of process.stdin){ chunks.push(c); }
	let v;
	try{ v = JSON.parse(Buffer.concat(chunks).toString('utf8').trim()); }catch(e){ throw new CliError(EXIT.USAGE, '标准输入须是一个 JSON 对象'); }
	if(!v || typeof v !== 'object' || Array.isArray(v)){ throw new CliError(EXIT.USAGE, '标准输入须是一个 JSON 对象'); }
	return v;
}

async function callTool(opts, tool, tokens){
	let built;
	try{ built = buildArguments(tokens); }catch(e){ throw new CliError(EXIT.USAGE, e.message); }
	let args = built.args;
	if(built.stdin){ args = { ...(await readStdinJson()), ...args }; }
	return cmdTool(opts, 'tools/call', { name: tool, arguments: args }, (r)=>{
		if(opts.json){ out(`${JSON.stringify(r, null, 2)}\n`); }
		const f = fmtToolResult(r);
		if(!opts.json){ (f.isError ? err : out)(f.text); }
		if(f.isError && /本机服务|后端|E_CAST_BACKEND/.test(f.text)){ err('提示:本机计算服务可能没开 —— ./horosa start(或 ./horosa doctor 看哪里不对)\n'); }
		return f.isError ? EXIT.TOOL_ERROR : EXIT.OK;
	});
}

async function waitFor(fn, ms, step){
	const until = Date.now() + ms;
	while(Date.now() < until){
		if(await fn()){ return true; }   // eslint-disable-line no-await-in-loop
		await new Promise((r)=>setTimeout(r, step || 500));   // eslint-disable-line no-await-in-loop
	}
	return false;
}

async function cmdStart(opts){
	const be = await backendsUp();
	if(!be.ok && be.remote){
		err(`[horosa] 计算服务地址在别的机器(${be.ports.serverRoot}):不在本机起服务(那边 Java :${be.ports.server} ${be.server ? '在' : '没响应'} · Python :${be.ports.chart} ${be.chart ? '在' : '没响应'};请在那台机器上起)\n`);
	}else if(!be.ok){
		if(!be.none){ err(`[horosa] ${halfUpMessage(be)}\n`); return EXIT.FAILED; }
		err(`[horosa] 起本机计算服务(Java :${be.ports.server} / Python :${be.ports.chart})…\n`);
		const code = BACKEND.start({ background: false });
		if(code !== 0){ err('[horosa] 本机计算服务没起来:先 ./horosa setup(首次部署),再 ./horosa doctor 看哪里不对\n'); return EXIT.FAILED; }
	}else{
		err('[horosa] 本机计算服务已在跑,直接复用\n');
	}
	const epFile = headlessEndpointPath();
	const cur = readJson(epFile);
	if(cur && pidAlive(cur.pid) && await httpAlive(cur)){ err(`[horosa] 无头服务已在跑:${cur.url}\n`); return cmdStatus(opts); }
	const { headlessDir } = require('./runtime');
	const log = openLog('server.log');
	const args = [__filename, 'serve'];
	if(opts.port){ args.push('--port', `${opts.port}`); }
	if(!opts.rest){ args.push('--no-rest'); }
	const child = spawn(process.execPath, args, { detached: true, stdio: ['ignore', log, log], env: process.env });
	child.unref();
	const ok = await waitFor(async ()=>{ const ep = readJson(epFile); return !!(ep && ep.pid === child.pid && await httpAlive(ep)); }, 30000, 300);
	if(!ok){ err(`[horosa] 无头服务没起来,看日志:${path.join(headlessDir(), 'logs', 'server.log')}\n`); return EXIT.FAILED; }
	return cmdStatus(opts);
}

async function cmdStop(opts){
	const ep = readJson(headlessEndpointPath());
	let stopped = false;
	if(ep && ep.pid && pidAlive(ep.pid)){
		const ps = spawnSync('ps', ['-p', `${ep.pid}`, '-o', 'command='], { encoding: 'utf8' });
		const cmdline = `${ps.stdout || ''}`;
		if(ep.role === 'mcp' || / mcp(\s|$)/.test(cmdline)){
			// 端点由某个 MCP 客户端拉起的会话托管:停它 = 掐断用户正在用的 AI 会话 → 不动,让用户在那个客户端里关
			err(`[horosa] 无头端点由一个 MCP 会话托管(pid ${ep.pid},是某个 AI 客户端拉起的):不停它 —— 在那个客户端里关掉 horosa 会话即可\n`);
		}else if(cmdline.indexOf('headless/cli.js') >= 0){
			process.kill(ep.pid, 'SIGTERM');
			stopped = await waitFor(async ()=>!pidAlive(ep.pid), 5000, 200);
			err(stopped ? `[horosa] 无头服务已停(pid ${ep.pid})\n` : `[horosa] 无头服务(pid ${ep.pid})没按时退出\n`);
		}else{
			err(`[horosa] 端点文件里的 pid ${ep.pid} 不是星阙无头服务,不动它\n`);
		}
	}else{
		err('[horosa] 无头服务没在跑\n');
	}
	if(opts.all){
		const script = path.join(REPO_ROOT, 'Horosa-Web/stop_horosa_local.sh');
		const ports = backendPorts();
		if(ports.remote){
			err(`[horosa] 计算服务地址在别的机器(${ports.serverRoot}):不停本机服务\n`);
		}else{
			const r = spawnSync('bash', [script], { cwd: path.dirname(script), env: backendEnv(), stdio: ['ignore', process.stderr, process.stderr] });
			err(r.status === 0 ? `[horosa] 本机计算服务已停(Java :${ports.server} / Python :${ports.chart})\n` : '[horosa] 停本机计算服务时有报错(见上)\n');
		}
	}
	return EXIT.OK;
}

async function cmdServe(opts){
	const { startServer } = require('./server');
	const toErr = (...a)=>process.stderr.write(`${require('util').format(...a)}\n`);
	console.log = toErr;   // eslint-disable-line no-console
	const lock = acquireDataLock();
	const srv = await startServer({ port: opts.port === null ? undefined : opts.port, rest: opts.rest, role: 'serve', handleSignals: false });
	err(`[horosa] 无头服务在跑:MCP ${srv.url}${srv.restUrl ? ` · REST ${srv.restUrl}` : ''}(端点文件 ${headlessEndpointPath()})\n`);
	await new Promise((resolve)=>{ process.once('SIGTERM', resolve); process.once('SIGINT', resolve); process.once('SIGHUP', resolve); });
	await srv.close();
	srv.rt.close();
	lock.release();
	return EXIT.OK;
}

async function cmdMcp(opts){
	// 标准输出只走协议:前端代码里的 console.log 一律改道标准错误 —— 必须在加载运行时之前改(加载期间就可能打日志)
	const toErr = (...a)=>process.stderr.write(`${require('util').format(...a)}\n`);
	console.log = toErr; console.info = toErr; console.debug = toErr;   // eslint-disable-line no-console
	// 本机计算服务两个都没开才后台拉起(不挡握手);只开了一个不拉 —— 起服务脚本会把在跑的那个也重启,打断别的会话正在算的盘
	const be = await backendsUp();
	if(process.env.HOROSA_NO_AUTOSTART !== '1' && !be.remote){
		if(be.none){
			if(claimBackendStart()){ try{ BACKEND.start({ background: true }); process.stderr.write('[horosa] 本机计算服务没开,已在后台拉起(日志 ~/.horosa/headless/logs/backends.log)\n'); }catch(e){ process.stderr.write(`[horosa] ${e.message}\n`); } }
		}else if(!be.ok){
			process.stderr.write(`[horosa] ${halfUpMessage(be)}\n`);
		}
	}
	const cur = readJson(headlessEndpointPath());
	if(cur && pidAlive(cur.pid) && await httpAlive(cur)){
		// 已有无头服务:stdio 只做转发(数据只由那一个进程持有);它没了会自动改连新的或自己接管
		return proxyStdioToHttp(cur);
	}
	let lock = null;
	try{ lock = acquireDataLock(); }catch(e){
		// 另一个会话正在起(已持锁、端点还没写出来)→ 等它的端点出现再转发
		const ep = await waitForEndpoint(10000);
		if(ep){ return proxyStdioToHttp(ep); }
		throw e;
	}
	const { runStdio } = require('./stdio');
	const { createRuntime } = require('./runtime');
	const rt = await createRuntime({ quiet: true });
	try{ await require('./server').startServer({ rt, rest: true, role: 'mcp' }); }catch(e){ process.stderr.write(`[horosa] 本机 HTTP 端点没挂上(${e.message}),stdio 照常可用\n`); }
	await runStdio({});
	lock.release();
	return EXIT.OK;
}

async function waitForEndpoint(ms){
	let found = null;
	await waitFor(async ()=>{ const ep = readJson(headlessEndpointPath()); if(ep && pidAlive(ep.pid) && await httpAlive(ep)){ found = ep; return true; } return false; }, ms, 250);
	return found;
}

// 事件流逐帧读:每凑齐一帧(空行分隔)就交给 onMessage(进度实时转出去,不攒到最后)
async function readSse(resp, onMessage){
	const reader = resp.body.getReader();
	const dec = new TextDecoder();
	let buf = '';
	const emit = (ev)=>{
		const data = ev.split('\n').filter((l)=>l.startsWith('data:')).map((l)=>l.slice(5).replace(/^ /, '')).join('\n');
		if(!data){ return; }
		try{ onMessage(JSON.parse(data)); }catch(e){ /* 跳过坏帧 */ }
	};
	for(;;){
		let chunk;
		try{ chunk = await reader.read(); }catch(e){ break; }   // eslint-disable-line no-await-in-loop
		if(chunk.done){ break; }
		buf += dec.decode(chunk.value, { stream: true }).replace(/\r\n/g, '\n');
		let idx;
		while((idx = buf.indexOf('\n\n')) >= 0){ emit(buf.slice(0, idx)); buf = buf.slice(idx + 2); }
	}
	if(buf.trim()){ emit(buf); }
}

// stdio ↔ 已在跑的无头服务:逐行转发。
//  · 请求 id 改写成本会话独有的(px<pid>-<序号>),回包再换回原 id:几个会话都从 1 编号,也不会互相取消 / 串回包;
//  · 事件流逐帧转发(进度实时到客户端);
//  · 转发目标没了(持数据的那个会话关了 / 服务停了):改连端点文件里新的那个;没有就自己抢数据锁、起运行时接管 ——
//    之后的请求照常服务,不用重启客户端。连接被拒(请求根本没送到)才重发;送到一半断了的请求不重发(写入类可能已执行),回错误让客户端决定。
async function proxyStdioToHttp(ep){
	const readline = require('readline');
	const protocol = require('./protocol');
	const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
	const write = (m)=>process.stdout.write(`${JSON.stringify(m)}\n`);
	const pending = new Set();
	const prefix = `px${process.pid}-`;
	let n = 0;
	const toOrig = new Map();   // 改写后的 id → 原 id
	const toNew = new Map();    // JSON(原 id)→ 改写后的 id(取消通知用)
	let target = ep;
	let local = null;           // 接管后:{ rt, version, inflight }
	let sessionClient = '';     // initialize 报的名字(身份规则单源 protocol.clientIdentityOf,传输层缺省 stdio)
	let failover = null;
	// 转发前给请求补上本会话的客户端名(_meta.clientName 缺席才补):经 HTTP 转发时服务端认的、原服务退出后本会话接管时
	// 本地认的,是同一个名字 —— 幂等槽含客户端名,前后不同名 = 同键重试换了槽位、照样重复写
	const withIdentity = (msg)=>{
		if(!msg || typeof msg !== 'object' || Array.isArray(msg) || !Object.prototype.hasOwnProperty.call(msg, 'id') || msg.method === 'initialize'){ return msg; }
		const params = msg.params && typeof msg.params === 'object' && !Array.isArray(msg.params) ? msg.params : {};
		const meta = params._meta && typeof params._meta === 'object' && !Array.isArray(params._meta) ? params._meta : {};
		if(meta.clientName !== undefined){ return msg; }
		return { ...msg, params: { ...params, _meta: { ...meta, clientName: protocol.clientIdentityOf(params, sessionClient, 'stdio') } } };
	};

	async function takeOver(deadUrl){
		if(failover){ return failover; }
		failover = (async ()=>{
			if(target && target.url !== deadUrl){ return; }   // 别的请求已经换好了
			const cur = readJson(headlessEndpointPath());
			if(cur && cur.url !== deadUrl && pidAlive(cur.pid) && await httpAlive(cur)){ target = cur; return; }
			let lock = null;
			for(let i = 0; i < 40 && !lock; i++){
				try{ lock = acquireDataLock(); }catch(e){
					const c2 = await waitForEndpoint(250);   // eslint-disable-line no-await-in-loop
					if(c2 && c2.url !== deadUrl){ target = c2; return; }
				}
			}
			if(!lock){ throw new Error('原服务已退出,数据锁又被别的进程占着、它也没挂端点'); }
			const { createRuntime } = require('./runtime');
			const { appVersion, startServer } = require('./server');
			const rt = await createRuntime({ quiet: true });
			try{ await startServer({ rt, rest: true, role: 'mcp' }); }catch(e){ process.stderr.write(`[horosa] 接管后本机 HTTP 端点没挂上(${e.message}),stdio 照常可用\n`); }
			local = { rt, version: appVersion(), inflight: new Map() };
			target = null;
			process.stderr.write('[horosa] 原无头服务已退出:本会话已接管数据,继续服务\n');
		})().finally(()=>{ failover = null; });
		return failover;
	}

	async function viaLocal(msg){
		if(msg && msg.method === 'notifications/cancelled'){
			const ac = local.inflight.get(JSON.stringify(msg.params && msg.params.requestId));
			if(ac){ ac.abort(); }
			return;
		}
		if(msg && !Object.prototype.hasOwnProperty.call(msg, 'id')){ return; }
		const ac = new AbortController();
		const k = JSON.stringify(msg && msg.id);
		local.inflight.set(k, ac);
		try{
			const out = await protocol.handleMessage(msg, { rt: local.rt, clientName: 'stdio', sessionClient, sessionId: 'stdio', version: local.version, signal: ac.signal, onNotification: write });
			if(out){ write(out); }
		}finally{ if(local.inflight.get(k) === ac){ local.inflight.delete(k); } }
	}

	async function viaHttp(msg, attempt){
		const isReq = msg && typeof msg === 'object' && !Array.isArray(msg) && Object.prototype.hasOwnProperty.call(msg, 'id');
		let out = msg;
		let newId = null;
		if(isReq){
			newId = `${prefix}${n++}`;
			toOrig.set(newId, msg.id); toNew.set(JSON.stringify(msg.id), newId);
			out = { ...msg, id: newId };
		}else if(msg && msg.method === 'notifications/cancelled' && msg.params){
			const mapped = toNew.get(JSON.stringify(msg.params.requestId));
			if(!mapped){ return; }
			out = { ...msg, params: { ...msg.params, requestId: mapped } };
		}
		const back = (m)=>{
			if(m && typeof m.id === 'string' && toOrig.has(m.id)){ const o = toOrig.get(m.id); return { ...m, id: o }; }
			return m;
		};
		const url = target.url;
		try{
			let resp;
			try{
				resp = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${target.token}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify(out) });
			}catch(e){
				const code = e && e.cause && e.cause.code;
				if(attempt === 0 && (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'EADDRNOTAVAIL')){
					// 请求根本没送到:换目标 / 接管后重发(id 映射在 finally 里清,重发时重新建)
					await takeOver(url);
					return dispatchLine(msg, 1);
				}
				if(isReq){ write({ jsonrpc: '2.0', id: msg.id, error: { code: -32001, message: `无头服务连接中断:${e.message}(请求可能没执行完,请重试;写入类带同一个幂等键 _meta.idempotencyKey 重试才不会重复写)` } }); }
				takeOver(url).catch(()=>{});
				return undefined;
			}
			if(resp.status === 202){ return undefined; }
			const ct = `${resp.headers.get('content-type') || ''}`;
			if(ct.startsWith('text/event-stream')){
				await readSse(resp, (m)=>write(back(m)));
			}else{
				const text = await resp.text();
				if(text.trim()){
					try{ write(back(JSON.parse(text))); }catch(e){ if(isReq){ write({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: `HTTP ${resp.status}` } }); } }
				}
			}
			return undefined;
		}finally{
			if(newId){ toOrig.delete(newId); if(toNew.get(JSON.stringify(msg.id)) === newId){ toNew.delete(JSON.stringify(msg.id)); } }
		}
	}

	async function dispatchLine(msg, attempt){
		if(failover){ try{ await failover; }catch(e){ /* 下面按当前状态走 */ } }
		if(local){ return viaLocal(msg); }
		if(!target){ if(msg && msg.id !== undefined){ write({ jsonrpc: '2.0', id: msg.id, error: { code: -32001, message: '无头服务连不上,接管也失败了' } }); } return undefined; }
		return viaHttp(msg, attempt);
	}

	rl.on('line', (line)=>{
		const t = line.trim();
		if(!t){ return; }
		let msg; try{ msg = JSON.parse(t); }catch(e){ write({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }); return; }
		const reported = protocol.initializeClientName(msg);
		if(reported){ sessionClient = reported; }
		msg = withIdentity(msg);
		const job = dispatchLine(msg, 0)
			.catch((e)=>{ if(msg && msg.id !== undefined){ write({ jsonrpc: '2.0', id: msg.id, error: { code: -32001, message: `无头服务连不上:${e.message}` } }); } })
			.finally(()=>pending.delete(job));
		pending.add(job);
	});
	await new Promise((r)=>rl.on('close', r));
	await Promise.allSettled(Array.from(pending));
	if(local){ try{ local.rt.close(); }catch(e){ /* noop */ } }
	return EXIT.OK;
}

async function cmdStatus(opts){
	if(opts.via === 'app'){
		const ep = readJson(appEndpointPath());
		const h = ep ? await httpAlive(ep) : null;
		if(!h){ err(`horosa: ${APP_NOT_RUNNING}\n`); return EXIT.NOT_RUNNING; }
		return cmdTool(opts, 'tools/list', {}, (r)=>{ out(opts.json ? `${JSON.stringify({ running: true, mode: 'app', url: ep.url, version: h.version, tools: r.tools.length }, null, 2)}\n` : `桌面 App 运行中 · ${ep.url} · 版本 ${h.version} · 工具 ${r.tools.length} 件\n`); return EXIT.OK; });
	}
	const be = await backendsUp();
	const ep = readJson(headlessEndpointPath());
	const h = ep && pidAlive(ep.pid) ? await httpAlive(ep) : null;
	const info = { headless: h ? { running: true, url: ep.url, restUrl: ep.restUrl || '', version: h.version, pid: ep.pid } : { running: false }, backends: { java: be.server, python: be.chart, ports: be.ports } };
	if(h){
		const n = await cmdToolCount(ep);
		info.headless.tools = n;
	}
	let corrupt = [];
	try{ corrupt = require('./runtime').listCorruptDataFiles(); }catch(e){ corrupt = []; }
	if(corrupt.length){ info.corruptDataFiles = corrupt; }
	let archived = [];
	try{ archived = require('./runtime').listCorruptArchiveKeys(); }catch(e){ archived = []; }
	if(archived.length){ info.corruptArchiveKeys = archived; }
	if(opts.json){ out(`${JSON.stringify(info, null, 2)}\n`); }else{
		out(h ? `无头服务运行中 · MCP ${ep.url}${ep.restUrl ? ` · REST ${ep.restUrl}` : ''} · 版本 ${h.version} · 工具 ${info.headless.tools} 件\n` : '无头服务没在跑(./horosa start;或不起服务、命令直接在本进程跑)\n');
		out(`本机计算服务:Java :${be.ports.server} ${be.server ? '在跑' : '没开'} · Python :${be.ports.chart} ${be.chart ? '在跑' : '没开'}\n`);
		if(corrupt.length){ out(`注意:数据目录里有 ${corrupt.length} 个读不了、已改名留档的数据文件(./horosa doctor 看详情)\n`); }
		if(archived.length){ out(`注意:本机存储里有 ${archived.length} 份读不出来时原样另存的内容留档(./horosa doctor 看详情)\n`); }
	}
	return h || be.ok ? EXIT.OK : EXIT.NOT_RUNNING;
}
async function cmdToolCount(ep){
	try{ const a = await httpTransport(ep, 'server').request('tools/list', {}); return a.result ? a.result.tools.length : 0; }catch(e){ return 0; }
}

async function cmdDoctor(opts){
	const rows = [];
	const add = (ok, label, detail)=>rows.push({ ok, label, detail });
	const major = Number(process.versions.node.split('.')[0]);
	add(major >= 18, 'Node.js', `${process.versions.node}${major >= 18 ? '' : '(要 18+:./horosa setup 会装项目内 Node)'}`);
	add(fs.existsSync(path.join(UI_ROOT, 'node_modules/jsdom')) && fs.existsSync(path.join(UI_ROOT, 'node_modules/esbuild')), '前端依赖', fs.existsSync(path.join(UI_ROOT, 'node_modules')) ? 'Horosa-Web/astrostudyui/node_modules 在' : '缺:./horosa setup(或在 Horosa-Web/astrostudyui 里 npm ci)');
	const bundle = path.join(__dirname, 'dist/horosa-runtime.cjs');
	add(true, '无头运行时', fs.existsSync(bundle) ? '已打包(源码变了下次运行自动重打)' : '还没打包(首次运行时自动打,约 1 秒)');
	const jar = [path.join(REPO_ROOT, 'Horosa-Web/astrostudysrv/astrostudyboot/target/astrostudyboot.jar'), path.join(REPO_ROOT, 'runtime/mac/bundle/astrostudyboot.jar')].find((f)=>fs.existsSync(f));
	add(!!jar, 'Java 后端产物', jar ? `在(${path.relative(REPO_ROOT, jar)})` : '缺 astrostudyboot.jar:./horosa setup');
	// Java 17+ 与 Python 运行时:起服务脚本按这些位置找(找不到就起不来后端)
	const javaHome = spawnSync('/usr/libexec/java_home', ['-v', '17+'], { encoding: 'utf8' });
	const javaDirs = [path.join(REPO_ROOT, 'runtime/mac/java'), path.join(REPO_ROOT, '.runtime/mac/java')].filter((d)=>fs.existsSync(d));
	const javaOk = javaHome.status === 0 || javaDirs.length > 0 || !!process.env.HOROSA_JAVA_BIN;
	add(javaOk, 'Java 17+', javaOk ? (javaDirs.length ? `项目内 ${path.relative(REPO_ROOT, javaDirs[0])}` : (process.env.HOROSA_JAVA_BIN ? `HOROSA_JAVA_BIN=${process.env.HOROSA_JAVA_BIN}` : `${`${javaHome.stdout || ''}`.trim()}`)) : '没找到:./horosa setup');
	const pyDirs = [path.join(REPO_ROOT, 'runtime/mac/python/bin/python3'), path.join(REPO_ROOT, '.runtime/mac/venv/bin/python3')].filter((f)=>fs.existsSync(f));
	add(pyDirs.length > 0 || !!process.env.HOROSA_PYTHON, 'Python 运行时', pyDirs.length ? `项目内 ${path.relative(REPO_ROOT, pyDirs[0])}` : (process.env.HOROSA_PYTHON ? `HOROSA_PYTHON=${process.env.HOROSA_PYTHON}` : '没找到项目内 Python(3.11+):./horosa setup'));
	const be = await backendsUp();
	add(be.server, `Java 服务 :${be.ports.server}`, be.server ? '在跑' : '没开(./horosa start)');
	add(be.chart, `Python 服务 :${be.ports.chart}`, be.chart ? '在跑' : '没开(./horosa start)');
	const ep = readJson(headlessEndpointPath());
	const h = ep && pidAlive(ep.pid) ? await httpAlive(ep) : null;
	add(true, '无头接口服务', h ? `在跑 ${ep.url}${ep.role === 'mcp' ? '(由一个 MCP 会话托管)' : ''}${ep.repoRoot && path.resolve(ep.repoRoot) !== REPO_ROOT ? `;注意:它来自另一份仓库副本 ${ep.repoRoot}(多份副本请各设各的 HOROSA_HOME)` : ''}` : '没在跑(可选:./horosa start;不起也能用,命令在本进程直接跑)');
	const app = readJson(appEndpointPath());
	add(true, '桌面 App 本机服务', app ? `端点文件在(--app 可连)` : '未开(可选)');
	const { horosaHome, dataDir, listCorruptDataFiles, listCorruptArchiveKeys } = require('./runtime');
	add(true, '数据目录', `${horosaHome()}(HOROSA_HOME 可改)`);
	// 数据文件体检:改名留档的坏文件(启动时只在标准错误提示一次,MCP 会话里看不到)+ 读不了的数据文件(本进程会当空、拒写)
	const corrupt = listCorruptDataFiles();
	add(!corrupt.length, '数据文件留档', corrupt.length ? `有 ${corrupt.length} 个读不了、已改名留档的数据文件(原来的档案可能在里面,确认后可手工改回原名):${corrupt.map((f)=>path.relative(horosaHome(), f)).join('、')}` : '没有');
	// 本机存储(localStorage.json)里的内容留档键:某项数据读不出来时原样另存(如命盘库主键坏了 → 留档后从空库开始)
	const archivedKeys = listCorruptArchiveKeys();
	add(!archivedKeys.length, '内容留档', archivedKeys.length ? `本机存储里有 ${archivedKeys.length} 份读不出来时原样另存的内容(原来的档案可能在里面;在 data/localStorage.json 里按键名找):${archivedKeys.join('、')}` : '没有');
	const unreadable = [];
	const scan = (dir)=>{
		let ents = [];
		try{ ents = fs.readdirSync(dir, { withFileTypes: true }); }catch(e){ return; }
		ents.forEach((ent)=>{
			const full = path.join(dir, ent.name);
			if(ent.isDirectory()){ scan(full); return; }
			if(!/\.json$/.test(ent.name)){ return; }
			try{ fs.closeSync(fs.openSync(full, 'r')); }catch(e){ unreadable.push(`${path.relative(horosaHome(), full)}(${e.code || e.message})`); }
		});
	};
	scan(dataDir());
	add(!unreadable.length, '数据文件可读', unreadable.length ? `读不了:${unreadable.join('、')} —— 无头运行时会把它当空、改动不落盘;先改好权限(如曾用 sudo 跑过,改回本人属主)` : '全部可读');
	if(opts.json){ out(`${JSON.stringify(rows, null, 2)}\n`); }else{ rows.forEach((r)=>out(`${r.ok ? '✅' : '❌'} ${r.label}:${r.detail}\n`)); }
	return rows.every((r)=>r.ok) ? EXIT.OK : EXIT.FAILED;
}

// 人工操作:无头服务在跑就走它的管理口(管理令牌),否则本进程(同一份路由 rt.admin.handle)
async function adminCall(opts, fn){
	const ep = readJson(headlessEndpointPath());
	if(ep && pidAlive(ep.pid) && await httpAlive(ep)){
		const base = ep.url.replace(/\/mcp$/, '');
		const adminToken = require('./server').readAdminToken(ep.pid);
		if(!adminToken){ throw new CliError(EXIT.AUTH, `读不到管理令牌(${require('./server').adminTokenFile()});服务是别的用户 / 别的数据目录起的?`); }
		const send = async (method, p, b)=>{
			let r;
			try{ r = await fetch(`${base}${p}`, { method, headers: { Authorization: `Bearer ${adminToken}`, ...(b ? { 'Content-Type': 'application/json' } : {}) }, body: b ? JSON.stringify(b) : undefined }); }catch(e){ throw new CliError(EXIT.NOT_RUNNING, HEADLESS_NOT_RUNNING); }
			if(r.status === 401){ throw new CliError(EXIT.AUTH, '管理令牌不对:服务重启过?再跑一次命令'); }
			try{ return await r.json(); }catch(e){ return { ok: false, error: { message: `回体不是 JSON(HTTP ${r.status})` } }; }
		};
		return fn({ get: (p)=>send('GET', p), post: (p, b)=>send('POST', p, b || {}) });
	}
	const tr = await localTransport(opts);
	try{
		const h = tr.rt.admin.handle;
		return await fn({ get: async (p)=>(await h('GET', p, {})).body, post: async (p, b)=>(await h('POST', p, b || {})).body });
	}finally{ tr.close(); }
}

async function cmdConfig(opts, rest){
	if(rest.length > 2){ throw new CliError(EXIT.USAGE, 'config 用法:./horosa config [键 [值]]'); }
	if(rest.length === 2 && loosensPolicy(rest[0], rest[1]) && !process.stdin.isTTY && !(await humanConfirm(opts, '', ''))){ return EXIT.USAGE; }
	return adminCall(opts, async (c)=>{
		const r = rest.length >= 2 ? await c.post('/admin/config', { key: rest[0], value: rest[1] }) : await c.get('/admin/config');
		if(!r.ok){ err(`horosa: ${r.error && r.error.message}\n`); return EXIT.USAGE; }
		if(opts.json){ out(`${JSON.stringify(r.config, null, 2)}\n`); return EXIT.OK; }
		const keys = rest.length === 1 ? [rest[0]] : Object.keys(r.config);
		keys.forEach((k)=>out(`${k} = ${r.config[k] === undefined ? '(没有这个设置)' : r.config[k]}\n`));
		return EXIT.OK;
	});
}

// 人工子命令的确认(单一来源):交互终端照旧(问一句;--yes 直接过)。非交互环境(标准输入不是终端 —— 脚本、定时任务,
// 也包括能跑终端命令的 AI 代理)只有 --yes 不够,还要显式设 HOROSA_ALLOW_UNATTENDED_APPROVAL=1:挡住代理替用户批准自己的提议。
const UNATTENDED_ENV = 'HOROSA_ALLOW_UNATTENDED_APPROVAL';
async function humanConfirm(opts, question, hint){
	if(process.stdin.isTTY){
		if(opts.yes || await confirmTty(question)){ return true; }
		err('已取消\n');
		return false;
	}
	if(opts.yes && process.env[UNATTENDED_ENV] === '1'){ return true; }
	err(`horosa: 这是人工操作:非交互环境要同时加 --yes 并设环境变量 ${UNATTENDED_ENV}=1 才放行(防止能跑命令的程序替你批准)${hint || ''}\n`);
	return false;
}
// 放宽外部访问的设置(写入全自动 / 私人内容 / 网页抓取 / 无头分析出口)同样是人工操作;收紧(只读 / 关)不拦
function loosensPolicy(key, value){
	const v = `${value}`.trim().toLowerCase();
	if(key === 'approval'){ return v === 'auto'; }
	return ['headless-analysis', 'private-read', 'web-fetch'].indexOf(key) >= 0 && ['on', '1', 'true', 'yes', '开'].indexOf(v) >= 0;
}

async function confirmTty(question){
	if(!process.stdin.isTTY){ return false; }
	const readline = require('readline');
	const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
	const ans = await new Promise((r)=>rl.question(`${question} [y/N] `, r));
	rl.close();
	return /^y(es)?$/i.test(`${ans}`.trim());
}

async function cmdProposals(opts, rest){
	const op = rest[0];
	if(!op || op === 'list'){
		return callTool(opts, 'list_proposals', rest.slice(op ? 1 : 0));
	}
	if(['accept', 'reject', 'revert'].indexOf(op) < 0){ throw new CliError(EXIT.USAGE, 'proposals 只认 list / accept / reject / revert'); }
	const id = rest[1];
	if(!id){ throw new CliError(EXIT.USAGE, `proposals ${op} 要给提案 id(./horosa proposals 列出)`); }
	const verb = { accept: '采纳(改动写进档案)', reject: '拒绝(档案不动)', revert: '撤销采纳(档案改回提案前)' }[op];
	if(!(await humanConfirm(opts, `确认${verb}提案 ${id}?`))){ return EXIT.USAGE; }
	return adminCall(opts, async (c)=>{
		const r = await c.post(`/admin/proposals/${encodeURIComponent(id)}/${op}`, {});
		if(!r.ok){ err(`horosa: ${r.error && r.error.message}\n`); return EXIT.FAILED; }
		const res = r.result || {};
		if(opts.json){ out(`${JSON.stringify(res, null, 2)}\n`); }else{ out(res.ok ? `已${verb.slice(0, 2)}:${id}\n` : `没做成:${res.message || res.code}\n`); }
		return res.ok ? EXIT.OK : EXIT.TOOL_ERROR;
	});
}

// 撤销 AI 做过的一条写入(与桌面「动作记录 › 撤销」同一函数):./horosa undo <动作id>;动作 id 用 ./horosa actions 列出
async function cmdUndo(opts, rest){
	const id = rest[0];
	if(!id){ throw new CliError(EXIT.USAGE, 'undo 要给动作 id(./horosa actions 列出最近的动作)'); }
	if(!(await humanConfirm(opts, `确认撤销动作 ${id}?`))){ return EXIT.USAGE; }
	return adminCall(opts, async (c)=>{
		const r = await c.post(`/admin/actions/${encodeURIComponent(id)}/undo`, {});
		if(!r.ok){ err(`horosa: ${r.error && r.error.message}\n`); return EXIT.FAILED; }
		const res = r.result || {};
		if(opts.json){ out(`${JSON.stringify(res, null, 2)}\n`); }else{ out(res.ok ? `已撤销:${id}\n` : `没撤成:${res.message || res.code}\n`); }
		return res.ok ? EXIT.OK : EXIT.TOOL_ERROR;
	});
}

// ───────────────────────── 模型接口(./horosa ai)─────────────────────────

// 隐藏输入(终端里输密钥不回显);非交互环境回 null
function promptHidden(question){
	const stdin = process.stdin;
	if(!stdin.isTTY || typeof stdin.setRawMode !== 'function'){ return Promise.resolve(null); }
	return new Promise((resolve, reject)=>{
		process.stderr.write(question);
		let buf = '';
		const cleanup = ()=>{ stdin.removeListener('data', onData); try{ stdin.setRawMode(false); }catch(e){ /* noop */ } stdin.pause(); process.stderr.write('\n'); };
		function onData(chunk){
			for(const c of `${chunk}`){
				if(c === '\r' || c === '\n'){ cleanup(); resolve(buf); return; }
				if(c === '\u0003'){ cleanup(); reject(new CliError(EXIT.INTERRUPTED, '已取消')); return; }
				if(c === '\u007f' || c === '\b'){ buf = buf.slice(0, -1); continue; }
				buf += c;
			}
		}
		stdin.setRawMode(true);
		stdin.setEncoding('utf8');
		stdin.resume();
		stdin.on('data', onData);
	});
}
async function readStdinText(){
	const chunks = [];
	for await (const c of process.stdin){ chunks.push(c); }
	return Buffer.concat(chunks).toString('utf8');
}
const KEYLESS_PROVIDERS = ['ollama', 'custom'];
// 密钥来源:--key-stdin > --key-env 变量名 > 隐藏输入;都没有 → 本地无钥接口回空,其它报用法错
async function readKey(opts, provider){
	if(opts.keyStdin){
		const k = (await readStdinText()).trim();
		if(!k){ throw new CliError(EXIT.USAGE, '--key-stdin:标准输入是空的'); }
		return k;
	}
	if(opts.keyEnv){
		const k = `${process.env[opts.keyEnv] || ''}`.trim();
		if(!k){ throw new CliError(EXIT.USAGE, `--key-env:环境变量 ${opts.keyEnv} 没设或是空的`); }
		return k;
	}
	const optional = KEYLESS_PROVIDERS.indexOf(`${provider || ''}`) >= 0;
	const k = await promptHidden(optional ? '密钥(没有就直接回车):' : '密钥(输入不回显):');
	if(k === null){
		if(optional){ return ''; }
		throw new CliError(EXIT.USAGE, '非交互环境要给密钥来源:--key-env 变量名 或 --key-stdin(或改用环境变量 HOROSA_AI_* 不落盘)');
	}
	if(!k.trim() && !optional){ throw new CliError(EXIT.USAGE, '密钥是空的'); }
	return k.trim();
}
const KEY_LABEL = { set: '已设置', missing: '未设置', undecryptable: '解不开(./horosa ai key 重填)' };
function fmtAiStatus(ai){
	const lines = [];
	lines.push(ai.current ? `当前:${ai.current.name}(${ai.current.profileId})· 模型 ${ai.current.model}` : '当前:没有可用的模型接口(./horosa ai add <接口类型>,或设环境变量 HOROSA_AI_PROVIDER)');
	if(ai.env && ai.env.error){ lines.push(`环境变量:${ai.env.error}`); }
	if(ai.env && !ai.env.error){ lines.push(`环境变量档案生效(优先于已存档案):${ai.env.provider} · ${ai.env.model}${ai.env.keyEnv ? ` · 密钥来自 ${ai.env.keyEnv}` : ' · 没有密钥'}`); }
	lines.push(`无头分析 run_analysis:${ai.headlessAnalysis}${ai.headlessAnalysis === 'on' ? '' : '(要用:./horosa config headless-analysis on)'}`);
	if(!ai.profiles.length){ lines.push('接口档案:还没有'); }else{
		lines.push('接口档案:');
		ai.profiles.forEach((p)=>{
			const cur = ai.current && ai.current.profileId === p.id ? '*' : ' ';
			const key = p.source === 'env' ? (p.keyEnv ? `密钥来自 ${p.keyEnv}` : '没有密钥') : `密钥${KEY_LABEL[p.key] || p.key}`;
			lines.push(`  ${cur} ${p.id}  ${p.name} · ${p.providerType} · ${p.baseUrl} · 模型 ${clip((p.models || []).join(', '), 60)} · ${key}${p.enabled ? '' : ' · 已停用'}`);
		});
	}
	return `${lines.join('\n')}\n`;
}
async function cmdAi(opts, rest){
	const sub = rest[0] || 'status';
	const need = (v, what)=>{ if(!v){ throw new CliError(EXIT.USAGE, `ai ${sub} 要给${what}(./horosa ai 列出档案)`); } return v; };
	const fail = (r)=>{ err(`horosa: ${r && r.error ? r.error.message : '没做成'}\n`); return EXIT.FAILED; };
	if(sub === 'status' || sub === 'list'){
		return adminCall(opts, async (c)=>{ const r = await c.get('/admin/ai'); if(!r.ok){ return fail(r); } out(opts.json ? `${JSON.stringify(r.ai, null, 2)}\n` : fmtAiStatus(r.ai)); return EXIT.OK; });
	}
	if(sub === 'add'){
		const provider = `${need(rest[1], '接口类型(openai / anthropic / gemini / deepseek / ollama / custom …)')}`.trim().toLowerCase();
		const apiKey = await readKey(opts, provider);
		return adminCall(opts, async (c)=>{
			const r = await c.post('/admin/ai/profiles', { provider, models: opts.model || '', baseUrl: opts.baseUrl || '', name: opts.name || '', apiKey, use: opts.use });
			if(!r.ok){ return fail(r); }
			if(opts.json){ out(`${JSON.stringify(r, null, 2)}\n`); return EXIT.OK; }
			out(`已添加接口档案 ${r.profile.id}(${r.profile.name || r.profile.id} · 模型 ${(r.profile.models || []).join(', ')} · 密钥${KEY_LABEL[r.profile.key] || r.profile.key})${r.used ? ',已设为当前' : ''}\n`);
			out('试一下:./horosa ai test;要让外部 AI 用 run_analysis:./horosa config headless-analysis on\n');
			return EXIT.OK;
		});
	}
	if(sub === 'key'){
		const id = need(rest[1], '档案 id');
		const apiKey = await readKey(opts, '');
		return adminCall(opts, async (c)=>{ const r = await c.post(`/admin/ai/profiles/${encodeURIComponent(id)}/key`, { apiKey }); if(!r.ok){ return fail(r); } out(opts.json ? `${JSON.stringify(r, null, 2)}\n` : `已更新 ${id} 的密钥\n`); return EXIT.OK; });
	}
	if(sub === 'use'){
		const id = need(rest[1], '档案 id');
		return adminCall(opts, async (c)=>{
			const r = await c.post('/admin/ai/use', { profileId: id, model: rest[2] || opts.model || '' });
			if(!r.ok){ return fail(r); }
			out(opts.json ? `${JSON.stringify(r, null, 2)}\n` : `当前模型接口:${r.profileId} · ${r.model}${r.envOverrides ? '(注意:设了 HOROSA_AI_PROVIDER 的进程里环境变量档案仍优先)' : ''}\n`);
			return EXIT.OK;
		});
	}
	if(sub === 'remove'){
		const id = need(rest[1], '档案 id');
		if(!(await humanConfirm(opts, `确认删除接口档案 ${id}(连同存着的密钥)?`))){ return EXIT.USAGE; }
		return adminCall(opts, async (c)=>{ const r = await c.post(`/admin/ai/profiles/${encodeURIComponent(id)}/remove`, {}); if(!r.ok){ return fail(r); } out(opts.json ? `${JSON.stringify(r, null, 2)}\n` : `已删除接口档案 ${id}\n`); return EXIT.OK; });
	}
	if(sub === 'test'){
		return adminCall(opts, async (c)=>{
			const r = await c.post('/admin/ai/test', { profileId: rest[1] || '', model: opts.model || '', timeoutMs: opts.timeout ? opts.timeout * 1000 : 30000 });
			if(!r.ok){ return fail(r); }
			const t = r.test;
			if(opts.json){ out(`${JSON.stringify(t, null, 2)}\n`); }else if(t.ok){ out(`✅ ${t.profileId} · ${t.model} 通了(${t.ms} ms):${clip(t.content, 60)}\n`); }else{ err(`❌ ${t.profileId || ''} · ${t.model || ''} 没通(${t.ms === undefined ? '-' : `${t.ms} ms`}):${t.error}\n`); }
			return t.ok ? EXIT.OK : EXIT.TOOL_ERROR;
		});
	}
	throw new CliError(EXIT.USAGE, 'ai 只认 status / add / key / use / remove / test');
}

// ───────────────────────── 整库导出 / 导入 ─────────────────────────

function stamp(){ const d = new Date(); const p = (n)=>`${n}`.padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; }
async function cmdExport(opts, rest){
	const file = path.resolve(rest[0] || `horosa-backup-${stamp()}.zip`);
	return adminCall(opts, async (c)=>{
		const r = await c.post('/admin/export', { path: file, overwrite: opts.overwrite });
		if(!r.ok){ err(`horosa: ${r.error && r.error.message}\n`); return EXIT.FAILED; }
		const e = r.export;
		out(opts.json ? `${JSON.stringify(e, null, 2)}\n` : `已导出 ${e.path}(${Math.round(e.bytes / 1024)} KB${e.charts !== undefined ? ` · 命盘 ${e.charts}` : ''}${e.cases !== undefined ? ` · 事盘 ${e.cases}` : ''} · AI 工作区 ${e.aiStores} 类;密钥不随包走)\n桌面 App 可在「数据管理 › 全量备份」里恢复它。\n`);
		return EXIT.OK;
	});
}
async function cmdImport(opts, rest){
	if(!rest[0]){ throw new CliError(EXIT.USAGE, 'import 要给备份文件(.zip)'); }
	const file = path.resolve(rest[0]);
	return adminCall(opts, async (c)=>{
		const pre = await c.post('/admin/import', { path: file, dryRun: true, includeSecurity: opts.includeSecurity });
		if(!pre.ok){ err(`horosa: ${pre.error && pre.error.message}\n`); return EXIT.FAILED; }
		const pv = pre.import;
		if(!opts.json || opts.dryRun){
			const rows = (pv.preview || []).map((row)=>`  ${row.label}:${row.detail}`);
			(opts.json ? err : out)(`${['将写入(本机已有的同 id 档案会被备份里的版本替换):'].concat(rows).concat((pv.warnings || []).map((w)=>`  注意:${w}`)).join('\n')}\n`);
		}
		if(opts.dryRun){ if(opts.json){ out(`${JSON.stringify(pv, null, 2)}\n`); } return EXIT.OK; }
		if(!(await humanConfirm(opts, '确认导入?(导入前整份数据目录会自动留快照)', ';或先 --dry-run 看看'))){ return EXIT.USAGE; }
		// 真导入绑定预览时的内容哈希:预览之后文件被换了 → 服务端拒
		const r = await c.post('/admin/import', { path: file, dryRun: false, expectSha256: pv.sha256, includeSecurity: opts.includeSecurity });
		if(!r.ok){ err(`horosa: ${r.error && r.error.message}\n`); return EXIT.FAILED; }
		const im = r.import;
		if(opts.json){ out(`${JSON.stringify(im, null, 2)}\n`); }else{
			(im.results || []).forEach((x)=>out(`${x.ok ? '✅' : '❌'} ${x.key}:${x.detail}\n`));
			out(`导入前的数据快照:${im.snapshot}(要撤销:./horosa stop 后把它拷回数据目录 data/)\n`);
			if(im.keylessProfiles && im.keylessProfiles.length){ out(`备份里的接口档案不带密钥:./horosa ai key <档案> 补上(${im.keylessProfiles.join(', ')})\n`); }
		}
		return (im.results || []).every((x)=>x.ok) ? EXIT.OK : EXIT.TOOL_ERROR;
	});
}

// 自测:合同(node --test,假运行时)+ 真栈(真工具层、临时数据目录、零窗口)
function cmdSelftest(opts){
	const a = spawnSync(process.execPath, ['--test', path.join(__dirname, 'test', 'server.test.js'), path.join(__dirname, 'test', 'runtime.test.js'), path.join(__dirname, 'test', 'version.test.js'), path.join(__dirname, 'test', 'writeMatrix.test.js'), path.join(__dirname, 'test', 'batch.test.js')], { stdio: 'inherit' });
	const b = spawnSync(process.execPath, [path.join(__dirname, 'selftest.js'), ...(opts.json ? ['--json'] : [])], { stdio: 'inherit' });
	return a.status === 0 && b.status === 0 ? EXIT.OK : EXIT.FAILED;
}

function cmdSetup(){
	const script = path.join(REPO_ROOT, 'scripts/mac/bootstrap_and_run.sh');
	if(!fs.existsSync(script)){ err(`horosa: 找不到 ${script}\n`); return EXIT.FAILED; }
	const r = spawnSync('bash', [script], { cwd: REPO_ROOT, env: { ...process.env, HOROSA_SKIP_LAUNCH: '1' }, stdio: 'inherit' });
	return r.status === 0 ? EXIT.OK : EXIT.FAILED;
}

async function main(argv){
	// 批量验证有自己的一组选项(列名对应 / 并发 / 续跑 …),整段交给 batch.js;Ctrl-C 也由它收尾(写完在算的几例、写汇总)
	if(argv[0] === 'batch' || argv[0] === 'batch-pack'){
		const noop = ()=>{};
		INTERRUPT.handlers.add(noop);
		try{ return argv[0] === 'batch' ? await require('./batch').main(argv.slice(1), IO) : await require('./batchPack').main(argv.slice(1), IO); }
		finally{ INTERRUPT.handlers.delete(noop); }
	}
	let parsed;
	try{ parsed = parseArgs(argv.slice()); }catch(e){ err(`horosa: ${e.message}\n(./horosa help 看用法)\n`); return EXIT.USAGE; }
	const { opts, cmd, rest } = parsed;
	try{
		switch(cmd){
		case 'help': out(usage()); return EXIT.OK;
		case 'version': { const v = require('./server').appVersion(); out(`horosa ${v}(无头${/\+unreleased$/.test(v) ? ';源码比该版本新,未发版' : ''})\n`); return EXIT.OK; }
		case 'setup': return cmdSetup();
		case 'start': return await cmdStart(opts);
		case 'stop': return await cmdStop(opts);
		case 'serve': return await cmdServe(opts);
		case 'mcp': return await cmdMcp(opts);
		case 'doctor': return await cmdDoctor(opts);
		case 'selftest': return cmdSelftest(opts);
		case 'status': return await cmdStatus(opts);
		case 'endpoint': { const f = opts.via === 'app' ? appEndpointPath() : headlessEndpointPath(); const ok = fs.existsSync(f); out(`${f}${ok ? '' : '(不存在:服务没在跑)'}\n`); return ok ? EXIT.OK : EXIT.NOT_RUNNING; }
		case 'config': return await cmdConfig(opts, rest);
		case 'ai': return await cmdAi(opts, rest);
		case 'export': return await cmdExport(opts, rest);
		case 'import': return await cmdImport(opts, rest);
		case 'tools': return await cmdTool(opts, 'tools/list', {}, (r)=>{ out(opts.json ? `${JSON.stringify(r.tools, null, 2)}\n` : fmtTools(r.tools)); return EXIT.OK; });
		case 'describe': {
			if(!rest[0]){ throw new CliError(EXIT.USAGE, 'describe 要给工具名'); }
			return await cmdTool(opts, 'tools/list', {}, (r)=>{
				const t = r.tools.find((x)=>x.name === rest[0]);
				if(!t){ err(`horosa: 没有这件工具 ${rest[0]}(horosa tools 看全部)\n`); return EXIT.USAGE; }
				out(opts.json ? `${JSON.stringify(t, null, 2)}\n` : fmtDescribe(t));
				return EXIT.OK;
			});
		}
		case 'call': if(!rest[0]){ throw new CliError(EXIT.USAGE, 'call 要给工具名'); } return await callTool(opts, rest[0], rest.slice(1));
		case 'resources':
		case 'prompts': {
			const isRes = cmd === 'resources';
			return await cmdTool(opts, isRes ? 'resources/list' : 'prompts/list', opts.cursor ? { cursor: opts.cursor } : {}, (r)=>{
				out(opts.json ? `${JSON.stringify(r, null, 2)}\n` : fmtList(r[isRes ? 'resources' : 'prompts'], isRes ? 'uri' : 'name', isRes ? '资源' : '提示', r.nextCursor));
				return EXIT.OK;
			});
		}
		case 'templates': return await cmdTool(opts, 'resources/templates/list', {}, (r)=>{ out(opts.json ? `${JSON.stringify(r, null, 2)}\n` : fmtList(r.resourceTemplates, 'uriTemplate', '资源模版')); return EXIT.OK; });
		case 'read': if(!rest[0]){ throw new CliError(EXIT.USAGE, 'read 要给资源地址'); } return await cmdTool(opts, 'resources/read', { uri: rest[0] }, (r)=>{ out(opts.json ? `${JSON.stringify(r, null, 2)}\n` : fmtContents(r)); return EXIT.OK; });
		case 'prompt': {
			if(!rest[0]){ throw new CliError(EXIT.USAGE, 'prompt 要给提示名称'); }
			let b; try{ b = buildArguments(rest.slice(1)); }catch(e){ throw new CliError(EXIT.USAGE, e.message); }
			return await cmdTool(opts, 'prompts/get', { name: rest[0], arguments: b.args }, (r)=>{ out(opts.json ? `${JSON.stringify(r, null, 2)}\n` : fmtPrompt(r)); return EXIT.OK; });
		}
		default: {
			if(cmd === 'proposals'){ return await cmdProposals(opts, rest); }
			if(cmd === 'undo'){ return await cmdUndo(opts, rest); }
			if(cmd === 'actions' && rest[0] === 'undo'){ return await cmdUndo(opts, rest.slice(1)); }
			const hit = SHORTCUTS.find(([c])=>c === cmd);
			if(!hit){ throw new CliError(EXIT.USAGE, `不认识的子命令 ${cmd}(./horosa help 看全部)`); }
			const toks = rest.map((t, i)=>(i === 0 && hit[2] && !(t === '-' || t.startsWith('{') || t.indexOf('=') >= 0) ? `${hit[2]}=${t}` : t));
			return await callTool(opts, hit[1], toks);
		}
		}
	}catch(e){
		if(e instanceof CliError){ err(`horosa: ${e.message}\n`); return e.exitCode; }
		if(e && e.code === 'E_PORT_CONFIG'){ err(`horosa: ${e.message}\n`); return EXIT.USAGE; }
		err(`horosa: ${e && e.message ? e.message : e}\n`);
		return EXIT.FAILED;
	}
}

module.exports = { main, EQ_VALUE_OPTIONS, humanConfirm, UNATTENDED_ENV, backendEnv, backendsUp, parseArgs, buildArguments, fmtTools, fmtToolResult, fmtList, fmtProgress, fmtAiStatus, usage, EXIT, SHORTCUTS, __interruptForTests: ()=>{ INTERRUPT.handlers.forEach((h)=>h()); }, __resetInterruptForTests: ()=>{ INTERRUPT.fired = false; }, __setIoForTests: (o)=>{ IO.out = o.out; IO.err = o.err; }, __setBackendStarterForTests: (fn)=>{ BACKEND.start = fn || startBackends; } };
if(require.main === module){
	main(process.argv.slice(2)).then((code)=>require('./exit').exitAfterFlush(code));
}
