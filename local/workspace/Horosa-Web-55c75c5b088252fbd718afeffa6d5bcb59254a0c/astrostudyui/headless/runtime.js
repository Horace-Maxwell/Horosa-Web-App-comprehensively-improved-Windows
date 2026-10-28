// 无头运行时:在 Node 里跑与桌面同一套工具层(打包产物 dist/horosa-runtime.cjs),不需要桌面 App、不需要浏览器、零窗口。
//   · 窗口环境:jsdom(页面地址 http://127.0.0.1:<网页口>/,后端根按网页口 +1999 推,与本地网页版同一规则;也可显式给后端根);
//   · 存储:localStorage 换成落盘版(JSON 文件,原子写);对话 / 资料 / 任务 / 接口档案的内存回退接落盘钩子 —— 都在 HOROSA_HOME 下;
//   · 调用:dispatch(method, params, { progress, signal, clientName }) 与壳 → 页面桥同一入口(handleAgentToolRequest),
//     限流 / 外部策略 / 取消 / 进度 / 输出结构 全部同一份代码;写入类按到达序一个一个来(与页面桥独占道同义)。
//   · 界面类工具(切技法页 / 合盘配对 / 设对话挂载 / 读当前页 / 载入工作区 / 反问用户)无头下没有界面 —— 不进目录,直呼其名回「方法不可用」。
//   · 模型接口(给 run_analysis 等要调模型的工具):环境变量 HOROSA_AI_*(只在内存、不落盘,优先)或 ./horosa ai(密钥 AES-256-GCM 加密落盘,
//     主密钥另放 headless/master.key,0600;与桌面同一加密层,桌面的主密钥在钥匙串)。
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const UI_ROOT = path.resolve(__dirname, '..');
const BUNDLE = path.join(__dirname, 'dist', 'horosa-runtime.cjs');
// 无头下没有界面可弹 / 可载入:读当前页、载入工作区、反问用户(反问会弹到本机界面等人作答)
const HEADLESS_UNAVAILABLE_NAMES = ['read_current_page', 'load_record_into_workspace', 'ask_user', 'set_chat_mount'];   // 对话挂载归 AI 分析页管(只增级,但无头没有那一页)
const UI_UNAVAILABLE_MESSAGE = '这件工具要操作星阙界面,无头模式下不可用(请在桌面 App 里用)';
const ENV_PROFILE_ID = 'headless-env';   // 环境变量档案:只在内存,落盘钩子与导出都把它剔掉
const PROVIDER_STORE = 'provider_profiles';
const UI_PREF_KEY = 'horosa.ai.analysis.ui.v3';   // 当前模型选择(modelSelection)所在的界面偏好键
// 无头运行时每次启动自己写的本机键(后端根):不进导出包(导进桌面会把桌面的后端地址钉死),导入时也不收(收了会改掉本进程正在用的后端)
const HEADLESS_LOCAL_KEYS = ['horosaLocalServerRoot', 'horosaLocalServerRootMode'];
// 安全开关类设置:无头导入缺省每项取本机与备份里较严的一档(备份里较宽的值不放宽本机 —— 审批档、私人内容、联网、无头分析、按名禁用 …;
// 来源机收紧过的照样收紧),要整值一并导入(可放宽)得显式 --include-security;预览里单独列出。与恢复层 unifiedBackup.BACKUP_SECURITY_KEYS 同一份(合同测试锁)
const SECURITY_KEYS = [
	'horosa.ai.agent.enabled', 'horosa.ai.agent.approval', 'horosa.ai.agent.approval.categories.v1', 'horosa.ai.agent.trust.records.v1',
	'horosa.ai.agent.toolPolicy.v1', 'horosa.ai.agent.external.policy.v1', 'horosa.ai.tools.external.enabled', 'horosa.ai.tools.webSearch.enabled',
	'horosa.ai.tools.webFetch.enabled', 'horosa.ai.tools.headless.enabled', 'horosa.ai.tools.privateRead.enabled', 'horosa.ai.tasks.goal.enabled',
	'horosa.ai.tasks.scheduler.enabled', 'horosa.ai.automation.enabled', 'horosa.ai.orchestrate.enabled',
	'horosa.ai.subjectFacts.v1',
];
const IMPORT_MAX_ZIP_BYTES = 200 * 1024 * 1024;
const IMPORT_MAX_MANIFEST_BYTES = 512 * 1024 * 1024;   // 解压后上限(防压缩炸弹)

function horosaHome(){
	const h = process.env.HOROSA_HOME && process.env.HOROSA_HOME.trim();
	return h ? path.resolve(h) : path.join(os.homedir(), '.horosa');
}
function headlessDir(){ return path.join(horosaHome(), 'headless'); }
function dataDir(){ return path.join(headlessDir(), 'data'); }

// 先写临时文件并 fsync,再改名覆盖:断电 / 内核崩溃时改名过去的不会是还没落盘的空文件(下次启动被当坏文件留档、从空开始)
function writeAtomic(file, text, mode){
	fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
	const tmp = `${file}.tmp-${process.pid}`;
	const buf = Buffer.isBuffer(text) ? text : Buffer.from(`${text}`, 'utf8');
	const fd = fs.openSync(tmp, 'w', mode || 0o666);
	try{
		let off = 0;
		while(off < buf.length){ off += fs.writeSync(fd, buf, off, buf.length - off); }
		fs.fsyncSync(fd);
	}finally{
		fs.closeSync(fd);
	}
	fs.renameSync(tmp, file);
}

// 数据目录里改名留档的坏文件(<文件>.corrupt-<时刻>):doctor / status 列出,空库时提醒
function listCorruptDataFiles(){
	const out = [];
	const walk = (dir)=>{
		let ents = [];
		try{ ents = fs.readdirSync(dir, { withFileTypes: true }); }catch(e){ return; }
		ents.forEach((ent)=>{
			const full = path.join(dir, ent.name);
			if(ent.isDirectory()){ walk(full); return; }
			if(/\.corrupt-/.test(ent.name)){ out.push(full); }
		});
	};
	walk(dataDir());
	return out.sort();
}

// 本机存储(localStorage.json)里某项数据读不出来时原样另存的留档键('horosa.corrupt.' + 原键 + '.' + 时刻;如命盘库主键坏了):
// 记录库主键坏了时无头没有影子副本可等,原串留档后从空库开始 —— 空库时同样要提醒
const CORRUPT_ARCHIVE_PREFIX = 'horosa.corrupt.';
function corruptArchiveKeysOf(storage){
	const out = [];
	try{
		if(storage && typeof storage.key === 'function'){
			for(let i = 0; i < storage.length; i += 1){ const k = storage.key(i); if(k && `${k}`.indexOf(CORRUPT_ARCHIVE_PREFIX) === 0){ out.push(`${k}`); } }
		}else if(storage && typeof storage === 'object'){
			Object.keys(storage).forEach((k)=>{ if(k.indexOf(CORRUPT_ARCHIVE_PREFIX) === 0){ out.push(k); } });
		}
	}catch(e){ /* 读不了:当没有 */ }
	return out.sort();
}
// 不起运行时也能查(doctor / status):直接读数据目录里的 localStorage.json
function listCorruptArchiveKeys(){
	try{
		const raw = JSON.parse(fs.readFileSync(path.join(dataDir(), 'localStorage.json'), 'utf8'));
		return raw && typeof raw === 'object' && !Array.isArray(raw) ? corruptArchiveKeysOf(raw) : [];
	}catch(e){
		return [];
	}
}

// 数据文件读不了 / 解析不了:原样改名留档(<文件>.corrupt-<时刻>),从空开始 —— 绝不让下一次落盘把它覆盖掉。
// 改名也失败(权限 / 只读盘)→ 抛错拒绝启动:宁可起不来,也不拿空数据盖掉用户的档案。
function quarantineDataFile(file, why){
	const dst = `${file}.corrupt-${new Date().toISOString().replace(/[:.]/g, '-')}`;
	try{ fs.renameSync(file, dst); }catch(e){
		throw new Error(`数据文件 ${file} 读不了(${why}),也没法改名留档(${e.message});为免覆盖,拒绝启动 —— 先手工处理这个文件`);
	}
	process.stderr.write(`[horosa] 数据文件读不了(${why}),已原样改名留档:${dst};这次从空数据开始\n`);
	return dst;
}
// 读 JSON 数据文件:不存在 → null;读得到但坏了 → 改名留档后 null;别的读错误 → 抛(调用方决定)
function readDataJson(file){
	let text;
	try{ text = fs.readFileSync(file, 'utf8'); }catch(e){
		if(e && e.code === 'ENOENT'){ return null; }
		throw e;
	}
	try{ return JSON.parse(text); }catch(e){
		quarantineDataFile(file, `JSON 解析失败:${e.message}`);
		return null;
	}
}

// 落盘失败(磁盘满 / 权限 / 路径不对)不许在定时器里抛 —— 那会把整个进程打崩,这一批改动也丢了:
// 保留「待落盘」状态,退避重试,并在标准错误里提示(首次与每 20 次报一次)
function makeRetryReporter(label){
	let fails = 0;
	return {
		ok(){ if(fails){ process.stderr.write(`[horosa] ${label} 落盘恢复正常\n`); } fails = 0; },
		failing(){ return fails; },
		fail(e){ fails += 1; if(fails === 1 || fails % 20 === 0){ process.stderr.write(`[horosa] ${label} 落盘失败(第 ${fails} 次,稍后重试):${e && e.message ? e.message : e}\n`); } return Math.min(5000, 250 * fails); },
	};
}

// 落盘版 localStorage:与 Web Storage 同一接口(getItem / setItem / removeItem / clear / key / length),
// 且 Object.keys(storage) / storage[键] 也能用(部分代码按此读);写入合并成 150 ms 一次落盘,退出时同步落盘。
function createFileStorage(file){
	let map = new Map();
	const raw = readDataJson(file);   // 坏文件 → 已改名留档,从空开始;读错误(权限等)→ 抛,拒绝启动
	if(raw && typeof raw === 'object' && !Array.isArray(raw)){
		map = new Map(Object.entries(raw).map(([k, v])=>[k, `${v}`]));
	}else if(raw !== null){
		quarantineDataFile(file, '内容不是键值对象');
	}
	let timer = null;
	let dirty = false;
	const report = makeRetryReporter(path.basename(file));
	const flush = ()=>{
		if(timer){ clearTimeout(timer); timer = null; }
		if(!dirty){ return; }
		dirty = false;
		try{
			writeAtomic(file, JSON.stringify(Object.fromEntries(map)), 0o600);
			report.ok();
		}catch(e){
			dirty = true;
			timer = setTimeout(flush, report.fail(e));
			if(timer.unref){ timer.unref(); }
		}
	};
	const touch = ()=>{ dirty = true; if(!timer){ timer = setTimeout(flush, 150); if(timer.unref){ timer.unref(); } } };
	// 读写叠层(只给环境变量档案用):读时把「当前模型」换成环境变量那一档,写回时还原成落盘原值 —— 环境变量永远不写进文件
	const overlays = new Map();
	const api = {
		getItem: (k)=>{
			const key = `${k}`;
			const v = map.has(key) ? map.get(key) : null;
			const o = overlays.get(key);
			return o ? o.read(v) : v;
		},
		setItem: (k, v)=>{ const key = `${k}`; const o = overlays.get(key); map.set(key, o ? `${o.write(`${v}`, map.has(key) ? map.get(key) : null)}` : `${v}`); touch(); },
		removeItem: (k)=>{ if(map.delete(`${k}`)){ touch(); } },
		clear: ()=>{ map.clear(); touch(); },
		key: (i)=>Array.from(map.keys())[i] ?? null,
		get length(){ return map.size; },
		__flush: flush,
		// 立刻同步落盘一次,返回是否已落盘(没有待落盘的改动也算);建档 / 改档后据此如实回报「是否真落盘」
		__flushNow: ()=>{ flush(); return !dirty; },
		__health: ()=>({ dirty, failing: report.failing() }),
		__rawGet: (k)=>(map.has(`${k}`) ? map.get(`${k}`) : null),   // 落盘原值(绕过读写叠层;导出用)
		__setOverlay: (k, o)=>{ if(o){ overlays.set(`${k}`, o); }else{ overlays.delete(`${k}`); } },
	};
	return new Proxy(api, {
		get(t, k){
			if(k in t){ return typeof t[k] === 'function' ? t[k] : t[k]; }
			if(typeof k === 'string' && map.has(k)){ return map.get(k); }
			return undefined;
		},
		set(t, k, v){ if(k in t){ return false; } api.setItem(k, v); return true; },
		deleteProperty(t, k){ api.removeItem(k); return true; },
		has(t, k){ return (k in t) || map.has(k); },
		ownKeys(){ return Array.from(map.keys()); },
		getOwnPropertyDescriptor(t, k){ return map.has(k) ? { value: map.get(k), writable: true, enumerable: true, configurable: true } : undefined; },
	});
}

// 对话 / 资料 / 任务 / 接口档案的内存回退落盘(每个存储区一个 JSON,文件权限 0600;接口档案的密钥由存储层加密后才到这里;环境变量档案不落盘)
function installStoreHook(dir){
	const timers = new Map();
	const pending = new Map();
	// 读不了(权限 / 瞬时 I/O 错误,不是「不存在」也不是「坏了」)的存储区:本进程里当空,但**不许落盘** ——
	// 落盘是先写临时文件再改名,目录可写就会把读不了的原文件整份换掉(此前注释说「写不进去、不会丢原文件」不成立)
	const unreadable = new Map();   // 名 → 读错误说明
	const fileOf = (name)=>path.join(dir, `${`${name}`.replace(/[^A-Za-z0-9_.-]/g, '_')}.json`);
	const reporters = new Map();
	const schedule = (name, ms)=>{ if(!timers.has(name)){ const t = setTimeout(()=>flushOne(name), ms); if(t.unref){ t.unref(); } timers.set(name, t); } };
	const flushOne = (name)=>{
		const entries = pending.get(name);
		pending.delete(name);
		if(timers.has(name)){ clearTimeout(timers.get(name)); timers.delete(name); }
		if(!entries){ return; }
		if(unreadable.has(name)){
			process.stderr.write(`[horosa] stores/${name} 启动时读不了(${unreadable.get(name)}),这次的改动不落盘,以免盖掉原文件 —— 先处理这个文件的权限再重启(./horosa doctor)\n`);
			return;
		}
		if(!reporters.has(name)){ reporters.set(name, makeRetryReporter(`stores/${name}`)); }
		try{
			writeAtomic(fileOf(name), JSON.stringify(entries), 0o600);
			reporters.get(name).ok();
		}catch(e){
			if(!pending.has(name)){ pending.set(name, entries); }   // 这期间没有更新的写入 → 这一批留着重试
			schedule(name, reporters.get(name).fail(e));
		}
	};
	globalThis.__HOROSA_HEADLESS_STORE__ = {
		load(name){
			// 坏文件 → 改名留档后当空(下一次落盘不会盖掉它);读错误(权限等)→ 当空,并记下这个存储区:之后的落盘一律拒写
			try{ unreadable.delete(name); return readDataJson(fileOf(name)); }catch(e){
				unreadable.set(name, e && e.code ? e.code : (e && e.message) || `${e}`);
				process.stderr.write(`[horosa] 读不了 stores/${name}(${e.message});本进程里它当空、改动不落盘(不盖掉原文件)\n`);
				return null;
			}
		},
		unreadable(){ return Array.from(unreadable.entries()).map(([name, why])=>({ name, why })); },
		save(name, entries){
			pending.set(name, name === PROVIDER_STORE ? entries.filter((e)=>e && e[0] !== ENV_PROFILE_ID) : entries);
			schedule(name, 200);
		},
	};
	return ()=>{ Array.from(pending.keys()).forEach(flushOne); };
}

// 名人库:与网页同一份离线库与 sql.js(public/astrodata 或已构建的 dist-file/astrodata),从磁盘读、Node 自带 zlib 解压;只在第一次用到时加载
// openAstrodataDb 单独导出:批量验证(--celebrities)按同一份库逐行读,不必起整个运行时
const ASTRODATA_DIRS = [path.join(UI_ROOT, 'public', 'astrodata'), path.join(UI_ROOT, 'dist-file', 'astrodata'), path.join(UI_ROOT, 'dist', 'astrodata')];
async function openAstrodataDb(){
	const dir = ASTRODATA_DIRS.find((d)=>fs.existsSync(path.join(d, 'astrodata-aa.sqlite.gz')) || fs.existsSync(path.join(d, 'astrodata-aa.sqlite')));
	if(!dir){ throw new Error('找不到名人库文件 astrodata-aa.sqlite.gz(应在 Horosa-Web/astrostudyui/public/astrodata/)'); }
	const gz = path.join(dir, 'astrodata-aa.sqlite.gz');
	const bytes = fs.existsSync(gz) ? require('zlib').gunzipSync(fs.readFileSync(gz)) : fs.readFileSync(path.join(dir, 'astrodata-aa.sqlite'));
	const initSqlJs = require(path.join(dir, 'vendor', 'sql-wasm.js'));
	const SQL = await initSqlJs({ locateFile: (f)=>path.join(dir, 'vendor', f) });
	return new SQL.Database(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
}
function installAstrodataLoader(){
	globalThis.__HOROSA_ASTRODATA_LOADER__ = async ()=>{ return openAstrodataDb(); };
}

// 主密钥(给存储层加密接口档案的密钥用):headless/master.key,32 字节 base64,0600;与数据目录分开放(拷走 data/ 不带它)。
// 首次真要加密时才生成;读不到 / 写不了就报错(存储层据此当「没有主密钥」,终端命令据此拒收密钥,绝不明文落盘)。
function masterKeyFile(){ return path.join(headlessDir(), 'master.key'); }
// 独占新建(已存在即 EEXIST)、0600、写完 fsync
function createExclusiveSynced(file, text){
	const fd = fs.openSync(file, 'wx', 0o600);
	try{ fs.writeSync(fd, text); fs.fsyncSync(fd); }finally{ fs.closeSync(fd); }
}
function installMasterKey(){
	const crypto = require('crypto');
	if(!globalThis.crypto || !globalThis.crypto.subtle){ Object.defineProperty(globalThis, 'crypto', { value: crypto.webcrypto, configurable: true, writable: true }); }
	let cached = '';
	globalThis.__HOROSA_HEADLESS_MASTER_KEY__ = async ()=>{
		if(cached){ return cached; }
		const file = masterKeyFile();
		let b64 = '';
		try{ b64 = fs.readFileSync(file, 'utf8').trim(); }catch(e){ b64 = ''; }
		if(!b64){
			// 不存在 / 存在却是空的(上次刚建好文件、还没写进内容就崩了)一律当没有:先写临时文件并 fsync,再用 link 原子地放到位
			// (与别的进程抢着生成:谁先放到位谁的作数)。空文件先挪开留档 —— 此前空文件会让 wx 建不了、再读还是空,密钥功能永久卡死
			b64 = crypto.randomBytes(32).toString('base64');
			fs.mkdirSync(path.dirname(file), { recursive: true });
			try{
				const st = fs.statSync(file);
				if(st.size === 0 || !fs.readFileSync(file, 'utf8').trim()){ fs.renameSync(file, `${file}.empty-${Date.now()}`); }
			}catch(e){ /* 不存在:直接生成 */ }
			const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
			try{
				createExclusiveSynced(tmp, `${b64}\n`);
				try{
					fs.linkSync(tmp, file);
				}catch(e){
					if(!e || e.code !== 'EEXIST'){ throw e; }
					b64 = fs.readFileSync(file, 'utf8').trim();
				}
			}finally{
				try{ fs.unlinkSync(tmp); }catch(e){ /* noop */ }
			}
		}
		if(Buffer.from(b64, 'base64').length !== 32){ throw new Error(`主密钥文件损坏:${file}`); }
		cached = b64;
		return cached;
	};
}

// 环境变量档案:HOROSA_AI_PROVIDER(必给)· HOROSA_AI_MODEL · HOROSA_AI_BASE_URL · HOROSA_AI_API_KEY(没给就认各家常用名,如 OPENAI_API_KEY)
function envAiSpec(lib){
	const provider = `${process.env.HOROSA_AI_PROVIDER || ''}`.trim().toLowerCase();
	if(!provider){ return null; }
	if(lib.PROVIDER_TYPES.indexOf(provider) < 0){ return { error: `HOROSA_AI_PROVIDER=${provider} 不认识(可选:${lib.PROVIDER_TYPES.join(' / ')})` }; }
	const names = ['HOROSA_AI_API_KEY'].concat(lib.PROVIDER_KEY_ENVS[provider] || []);
	const keyEnv = names.find((n)=>`${process.env[n] || ''}`.trim());
	let record;
	try{
		record = lib.newProviderProfile({ id: ENV_PROFILE_ID, providerType: provider, models: process.env.HOROSA_AI_MODEL || '', baseUrl: process.env.HOROSA_AI_BASE_URL || '', apiKey: keyEnv ? process.env[keyEnv] : '', name: `环境变量 · ${provider}` });
	}catch(e){ return { error: `环境变量档案不可用:${e.message}` }; }
	return { record, model: record.chatModelIds[0], provider, keyEnv: keyEnv || '', keyNames: names };
}

function bundleStale(){
	// 批量运行包(./horosa batch-pack)里没有前端源码:产物就是唯一的一份,不判陈旧(也无从重打)
	if(!fs.existsSync(path.join(UI_ROOT, 'src'))){ return !fs.existsSync(BUNDLE); }
	try{
		const info = JSON.parse(fs.readFileSync(path.join(__dirname, 'dist', 'build-info.json'), 'utf8'));
		if(!fs.existsSync(BUNDLE)){ return true; }
		const { sourceNewest } = require('./build');
		return sourceNewest() > Number(info.srcNewestMs || 0) + 1;
	}catch(e){
		return true;
	}
}

async function ensureBundle(opts){
	const o = opts || {};
	if(!o.forceRebuild && fs.existsSync(BUNDLE) && (o.skipStaleCheck || !bundleStale())){ return BUNDLE; }
	await require('./build').build({ quiet: !!o.quiet });
	return BUNDLE;
}

// 后端根(Java)与排盘 / 卜类 / 玄史服务根(Python):与 ./horosa start 的探测、起服务脚本同一来源(ports.js)
function resolveBackendRoots(opts){
	const p = require('./ports').backendPorts(opts);
	return { serverRoot: p.serverRoot, chartRoot: p.chartRoot, ports: p };
}
function resolveServerRoot(opts){
	return resolveBackendRoots(opts).serverRoot;
}

// 管理口单入口(服务的 /admin/* 与本进程终端命令同一份路由;ops = 上面那组人工操作):handle(method, 路径含查询串, 请求体) → { status, body }
// 每个 op 一律 await:提案采纳 / 拒绝 / 撤销采纳走写入通道(返回 Promise),此前没 await → 回体恒 {ok:true,result:{}}
//   (失败也报成功、终端命令拿不到 result.ok 把成功报成「没做成」);同步 op 被 await 无害,以后改成异步也不会悄悄坏
function makeAdminHandler(ops){
	return async function handle(method, pathAndQuery, body){
		const u = new URL(pathAndQuery, 'http://127.0.0.1');
		const segs = u.pathname.split('/').filter(Boolean).slice(1).map((x)=>decodeURIComponent(x));   // 去掉 admin
		const b = body && typeof body === 'object' ? body : {};
		const ok = (o)=>({ status: 200, body: { ok: true, ...o } });
		const route = `${method} ${segs.join('/')}`;
		const profileOp = method === 'POST' && segs[0] === 'ai' && segs[1] === 'profiles' && segs.length === 4 ? segs[3] : '';
		try{
			if(route === 'GET config'){ return ok({ config: await ops.getConfig() }); }
			if(route === 'POST config'){ return ok({ config: await ops.setConfig(`${b.key}`, b.value) }); }
			if(route === 'GET proposals'){ const st = u.searchParams.get('status'); return ok({ proposals: await ops.listProposals(st ? { status: st } : {}) }); }
			if(method === 'POST' && segs[0] === 'proposals' && segs.length === 3){ return ok({ result: await ops.proposal(segs[2], segs[1], b.note) }); }
			if(route === 'GET ai'){ return ok({ ai: await ops.aiStatus() }); }
			if(route === 'POST ai/profiles'){ return ok(await ops.aiAdd(b)); }
			if(profileOp === 'key'){ return ok(await ops.aiKey(segs[2], b)); }
			if(profileOp === 'remove'){ return ok(await ops.aiRemove(segs[2])); }
			if(route === 'POST ai/use'){ return ok(await ops.aiUse(b)); }
			if(route === 'POST ai/test'){ return ok({ test: await ops.aiTest(b) }); }
			if(route === 'POST export'){ return ok({ export: await ops.exportTo(b) }); }
			if(route === 'POST import'){ return ok({ import: await ops.importFrom(b) }); }
			if(method === 'POST' && segs[0] === 'actions' && segs.length === 3 && segs[2] === 'undo'){ return ok({ result: await ops.undo(segs[1]) }); }
			return { status: 404, body: { ok: false, error: { code: 'NOT_FOUND', message: '没有这个管理口' } } };
		}catch(e){
			return { status: 400, body: { ok: false, error: { code: 'BAD_REQUEST', message: e && e.message ? e.message : `${e}` } } };
		}
	};
}

let singleton = null;

// 装窗口、换存储、加载工具层;同一进程只装一次
async function createRuntime(opts){
	if(singleton){ return singleton; }
	const o = opts || {};
	await ensureBundle({ quiet: o.quiet !== false, skipStaleCheck: !!o.skipStaleCheck, forceRebuild: !!o.forceRebuild });
	const { JSDOM } = require(path.join(UI_ROOT, 'node_modules/jsdom'));
	const { serverRoot, chartRoot, ports } = resolveBackendRoots(o);
	const webPort = ports.server - 1999;
	const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: `http://127.0.0.1:${webPort > 0 ? webPort : 8000}/`, pretendToBeVisual: true });
	const w = dom.window;
	// 数据目录只给本人(日志 / 端点 / 令牌 / 档案都在这下面)
	for(const d of [horosaHome(), headlessDir(), dataDir()]){
		try{ fs.mkdirSync(d, { recursive: true, mode: 0o700 }); }catch(e){ /* 下面写盘时再报 */ }
	}
	for(const d of [headlessDir(), dataDir()]){ try{ fs.chmodSync(d, 0o700); }catch(e){ /* noop */ } }
	const storage = createFileStorage(path.join(dataDir(), 'localStorage.json'));
	Object.defineProperty(w, 'localStorage', { value: storage, configurable: true });
	global.window = w;
	for(const k of ['document', 'navigator', 'location', 'history', 'HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'DOMParser', 'XMLSerializer', 'MutationObserver', 'Blob', 'FileReader', 'File', 'Image', 'screen', 'sessionStorage']){
		try{ if(w[k] !== undefined){ global[k] = w[k]; } }catch(e){ /* 只读全局:跳过 */ }
	}
	global.localStorage = storage;
	// 记录写入「是否真落盘」的单源判据(recordStoreNotice.recordStorePersisted)在无头下据此同步落盘一次再答:
	// 此前无头存储只在内存里合并、150 ms 后落盘,失败只重试不上抛,建档 / 改档工具一律回「已保存」
	global.__horosaDurableFlush = ()=>{ try{ return storage.__flushNow(); }catch(e){ return false; } };
	if(!w.matchMedia){ w.matchMedia = (q)=>({ matches: false, media: q, onchange: null, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){}, dispatchEvent(){ return false; } }); }
	global.matchMedia = w.matchMedia;
	w.fetch = globalThis.fetch;
	// 后端根:与本地网页版同一对存储键(手动根)—— 显式给了就用显式的
	storage.setItem('horosaLocalServerRoot', serverRoot);
	storage.setItem('horosaLocalServerRootMode', 'manual');
	// 无头的后端地址是显式给定的(ports.js 单源):页面那套「后端身份核对 + 连不上就换根」在这里一律旁路(用它自带的总开关,只在本进程里读作开,
	// 不写进数据目录)。此前配的口连不上时,页面会逐个试候选地址、悄悄换到 127.0.0.1:9999(桌面 App 的后端)并记成 verified ——
	// 之后的起盘、批量结果都出自另一个后端,终端里还看不出来
	storage.__setOverlay('horosaBackendIdentityOff', { read: ()=>'1', write: (v)=>v });
	const flushStores = installStoreHook(path.join(dataDir(), 'stores'));
	installAstrodataLoader();
	installMasterKey();
	const lib = require(BUNDLE);
	// 卜类 / 玄史等直连排盘服务的模块:根按 HOROSA_CHART_PORT 显式注入(与桌面壳注入 kentangSrv 同一入口);
	// 不注入时页面按「后端根以 :9999 结尾才换成 8899」推,端口一改就打到 Java 上没有的路由
	lib.setKentangRootOverride(chartRoot);
	// 不登记工作区桥:无头没有界面里的当前盘 / dva 状态。此前登记两个什么也不做的空函数 → 改「当前盘口径」「全局显示偏好」
	//   与建档时「载入工作区」一律回成功(账本记一笔、实际什么都没改);不登记时这些路径各自如实回 E_BRIDGE_UNAVAILABLE / loaded:false
	lib.registerBuiltinTools();
	lib.setAgentEnabled(true);
	// 环境变量档案:只进内存(落盘钩子剔掉它),并在读「当前模型」时顶到最前(写回时还原落盘原值)
	const envAi = envAiSpec(lib);
	if(envAi && envAi.error){ process.stderr.write(`[horosa] ${envAi.error}\n`); }
	if(envAi && envAi.record){
		await lib.putStoreRecord(lib.AI_ANALYSIS_STORES.providerProfiles, envAi.record, 'provider');
		const envSel = lib.encodeModelSelection(ENV_PROFILE_ID, envAi.model);
		const parse = (v)=>{ try{ const o = JSON.parse(v || '{}'); return o && typeof o === 'object' ? o : {}; }catch(e){ return {}; } };
		storage.__setOverlay(UI_PREF_KEY, {
			read: (v)=>JSON.stringify({ ...parse(v), modelSelection: envSel }),
			write: (v, prev)=>{ const o = parse(v); if(o.modelSelection === envSel){ const p0 = parse(prev); if(p0.modelSelection){ o.modelSelection = p0.modelSelection; }else{ delete o.modelSelection; } } return JSON.stringify(o); },
		});
		if(!envAi.keyEnv && ['ollama', 'custom'].indexOf(envAi.provider) < 0){ process.stderr.write(`[horosa] HOROSA_AI_PROVIDER=${envAi.provider} 但环境变量里没有密钥(${envAi.keyNames.join(' / ')}),调模型会被上游拒\n`); }
	}
	// 无头没有本机审批台:「每次确认」档在这里没人点 —— 按只读处理(写入一律拒绝并说明),不让调用干等到超时
	const policy = lib.getExternalPolicy();
	if(policy && policy.approval === 'on-request'){ process.stderr.write('[horosa] 外部客户端审批档为「每次确认」,无头模式没有审批台:写入按只读拒绝(horosa config approval auto 可改)\n'); }

	let seq = 1;
	let exclusiveTail = Promise.resolve();
	const manifestOf = ()=>{ try{ return lib.exportToolManifest({ includeExternal: false, origin: 'mcp' }) || []; }catch(e){ return []; } };
	const unavailable = (t)=>!!t && (t.category === 'ui' || HEADLESS_UNAVAILABLE_NAMES.indexOf(t.name) >= 0);

	async function raw(method, params, extra){
		// 限流桶按传输层给的会话身份分(与桌面壳按会话分桶同义):HTTP MCP = 握手发的 Mcp-Session-Id、stdio / 终端命令 / REST 各一个;
		// 自报名(clientName)只作显示标签,换个名字不能换来一份新额度。传输层没给 = 共用 headless 一个桶
		const sid = extra && typeof extra.sessionId === 'string' && extra.sessionId ? `headless:${extra.sessionId.slice(0, 160)}` : 'headless';
		const req = { id: `h${seq++}`, method, params: params || {}, sessionId: sid, clientName: (extra && extra.clientName) || (params && params.clientName) || 'headless' };
		return lib.handleAgentToolRequest(req, undefined, extra && extra.ctx ? extra.ctx : undefined);
	}
	// 写入通道:写入类工具与人工的导入 / 导出 / 采纳 / 撤销 按到达序一个一个来(导入时的快照与恢复之间不会混进工具写入)
	function exclusive(fn){
		const next = exclusiveTail.then(fn, fn);
		exclusiveTail = next.catch(()=>{});
		return next;
	}

	// 档案读出来是空的,而数据目录里有改名留档的坏文件 → 回包附一句(MCP 会话里标准错误只进客户端日志,AI 和用户只看到「档案全空」)
	function withCorruptHint(r){
		try{
			const content = r && r.ok && r.result && Array.isArray(r.result.content) ? r.result.content : null;
			if(!content || !content.length){ return r; }
			const body = JSON.parse(content[0].text || '{}');
			const total = body && body.data ? body.data.total : (body ? body.total : undefined);
			if(total !== 0){ return r; }
			const files = listCorruptDataFiles();
			const keys = corruptArchiveKeysOf(storage);
			if(!files.length && !keys.length){ return r; }
			const parts = [];
			if(files.length){ parts.push(`数据目录里有 ${files.length} 个读不了、已改名留档的数据文件(${files.slice(0, 3).map((f)=>path.basename(f)).join('、')}${files.length > 3 ? ' 等' : ''})`); }
			if(keys.length){ parts.push(`本机存储里有 ${keys.length} 份读不出来时原样另存的内容留档(${keys.slice(0, 3).join('、')}${keys.length > 3 ? ' 等' : ''})`); }
			content.push({ type: 'text', text: `提示:档案为空,但${parts.join(';')};原来的档案可能在里面,请用户运行 ./horosa doctor 查看` });
		}catch(e){ /* 附不上提示不影响回包 */ }
		return r;
	}

	async function dispatch(method, params, opts2){
		const x = opts2 || {};
		const clientName = x.clientName || 'headless';
		const sessionId = typeof x.sessionId === 'string' ? x.sessionId : undefined;
		if(method === 'tools/list'){
			const r = await raw('tools/list', {}, { clientName, sessionId });
			if(r && r.ok && r.result && Array.isArray(r.result.tools)){ r.result.tools = r.result.tools.filter((t)=>!unavailable(t)); }
			return r;
		}
		if(method === 'tools/call'){
			const name = `${(params && params.name) || ''}`;
			const def = manifestOf().find((t)=>t && t.name === name);
			if(unavailable(def)){ return { ok: false, error: { code: -32601, message: UI_UNAVAILABLE_MESSAGE } }; }
			const p = { ...(params || {}), clientName };
			const live = lib.getExternalPolicy();
			if(def && def.level === 'additive' && live && live.approval === 'on-request'){
				return { ok: true, result: { content: [{ type: 'text', text: JSON.stringify({ ok: false, code: 'E_APPROVAL_DENIED', message: '无头模式没有审批台,「每次确认」档下写入不执行(horosa config approval auto 可改为全自动可撤销)' }) }], isError: true } };
			}
			const ctx = {};
			if(x.signal){ ctx.cancelSignal = x.signal; }
			if(typeof x.progress === 'function'){
				let last = -Infinity;
				ctx.progress = (pv, total, message)=>{
					let v = Number(pv);
					if(!Number.isFinite(v)){ v = last === -Infinity ? 0 : last + 1; }
					if(v <= last){ v = last + 0.001; }
					last = v;
					const out = { progress: v };
					if(Number.isFinite(Number(total)) && total !== null && total !== undefined){ out.total = Number(total); }
					if(message){ out.message = `${message}`.slice(0, 200); }
					try{ x.progress(out); }catch(e){ /* 进度回调不反噬 */ }
				};
			}
			const run0 = ()=>raw('tools/call', p, { clientName, sessionId, ctx });
			const run = name === 'list_records' ? ()=>run0().then(withCorruptHint) : run0;
			if(def && def.level !== 'read'){
				// 写入类按到达序一个一个来(与页面桥独占道同义:批量建档不互相踩)
				return exclusive(run);
			}
			return run();
		}
		return raw(method, params, { clientName, sessionId });
	}

	// 人工操作(只给终端命令的人工子命令与本机管理口用;工具目录里永远没有这些 —— AI 只能提议,采纳要人来做)
	const CONFIG_KEYS = {
		approval: { get: ()=>lib.getExternalPolicy().approval, set: (v)=>{ if(['auto', 'read-only'].indexOf(v) < 0){ throw new Error('approval 只能是 auto(全自动,可撤销)或 read-only(只读)'); } lib.setExternalPolicy({ approval: v }); } },
		'headless-analysis': { get: ()=>(lib.isHeadlessEnabled() ? 'on' : 'off'), set: (v)=>lib.setHeadlessEnabled(onOff(v)) },
		'private-read': { get: ()=>(lib.isPrivateReadEnabled() ? 'on' : 'off'), set: (v)=>lib.setPrivateReadEnabled(onOff(v)) },
		'web-fetch': { get: ()=>(lib.isWebFetchEnabled() ? 'on' : 'off'), set: (v)=>lib.setWebFetchEnabled(onOff(v)) },
	};
	function onOff(v){
		const t = `${v}`.trim().toLowerCase();
		if(['on', '1', 'true', 'yes', '开'].indexOf(t) >= 0){ return true; }
		if(['off', '0', 'false', 'no', '关'].indexOf(t) >= 0){ return false; }
		throw new Error('取值只能是 on 或 off');
	}
	function flushAll(){ try{ storage.__flush(); }catch(e){ /* noop */ } try{ flushStores(); }catch(e){ /* noop */ } }
	const PS = lib.AI_ANALYSIS_STORES.providerProfiles;

	// ── 模型接口(./horosa ai)──
	async function aiStatus(){
		const profiles = (await lib.listStoreRecords(PS)) || [];
		const resolved = await lib.resolveHeadlessProfile({}).catch(()=>null);
		const sel = lib.parseModelSelection((lib.loadUiPrefs() || {}).modelSelection || '');
		return {
			profiles: profiles.map((p)=>lib.redactProfile(p, p.id === ENV_PROFILE_ID ? { source: 'env', keyEnv: envAi && envAi.keyEnv } : { source: 'saved' })),
			current: resolved ? { profileId: resolved.profile.id, model: resolved.model, name: resolved.profile.name } : null,
			selection: sel.profileId ? sel : null,
			env: envAi ? (envAi.error ? { error: envAi.error } : { provider: envAi.provider, model: envAi.model, keyEnv: envAi.keyEnv }) : null,
			headlessAnalysis: lib.isHeadlessEnabled() ? 'on' : 'off',
			masterKeyFile: masterKeyFile(),
		};
	}
	// 收密钥前的预检与落盘时的真加密走同一条路(secureKeyStore 的同一份主密钥缓存):预检过了,落盘就不会退回明文;
	// 两边各取各的(此前预检直接调钩子、加密走缓存)时,缓存里一份失败结果会让「预检通过、实际明文落盘」。
	async function requireEncryption(){
		try{ await lib.requireSecretEncryption(); }catch(e){ throw new Error(`${e.message}。改用环境变量 HOROSA_AI_API_KEY`); }
	}
	async function savedProfile(id){
		if(`${id}` === ENV_PROFILE_ID){ throw new Error('环境变量档案只在本进程内存里,改环境变量即可(不能在这里改 / 删)'); }
		const p = await lib.getStoreRecord(PS, `${id}`);
		if(!p){ throw new Error(`没有这个接口档案 ${id}(./horosa ai 列出)`); }
		return p;
	}
	async function aiAdd(b){
		const rec = lib.newProviderProfile({ providerType: b.provider, models: b.models || b.model || '', baseUrl: b.baseUrl || '', apiKey: b.apiKey || '', name: b.name || '' });
		if(rec.apiKey){ await requireEncryption(); }
		const saved = await lib.putStoreRecord(PS, rec, 'provider');
		if(b.use !== false){ lib.saveUiPrefs({ modelSelection: lib.encodeModelSelection(saved.id, rec.chatModelIds[0]) }); }
		flushAll();
		return { profile: lib.redactProfile(saved, { source: 'saved' }), used: b.use !== false };
	}
	async function aiKey(id, b){
		const p = await savedProfile(id);
		const key = `${b.apiKey || ''}`.trim();
		if(!key){ throw new Error('密钥是空的'); }
		await requireEncryption();
		const { apiKeyDecryptFailed, apiKeyCipherKept, ...rest } = p;   // eslint-disable-line no-unused-vars
		const saved = await lib.putStoreRecord(PS, { ...rest, apiKey: key, healthStatus: 'unknown', lastDiagnostics: null, updatedAt: new Date().toISOString() }, 'provider');
		flushAll();
		return { profile: lib.redactProfile(saved, { source: 'saved' }) };
	}
	async function aiUse(b){
		const id = `${b.profileId || ''}`;
		if(id === ENV_PROFILE_ID){ throw new Error('环境变量档案在设了 HOROSA_AI_PROVIDER 时本来就优先;换模型改 HOROSA_AI_MODEL'); }
		const profiles = (await lib.listStoreRecords(PS)) || [];
		const p = profiles.find((x)=>x.id === id);
		if(!p){ throw new Error(`没有这个接口档案 ${id}(./horosa ai 列出)`); }
		const models = (p.chatModelIds && p.chatModelIds.length ? p.chatModelIds : p.manualModels) || [];
		const model = `${b.model || ''}`.trim() || models[0] || '';
		if(!model){ throw new Error('这个档案没有模型:./horosa ai use <档案> <模型>'); }
		if(models.indexOf(model) < 0){
			const { apiKeyDecryptFailed, apiKeyCipherKept, ...rest } = p;   // eslint-disable-line no-unused-vars
			if(apiKeyDecryptFailed){ throw new Error('这个档案的密钥解不开,先 ./horosa ai key 重填再加模型'); }
			await lib.putStoreRecord(PS, { ...rest, chatModelIds: models.concat([model]), manualModels: (p.manualModels || []).concat([model]), updatedAt: new Date().toISOString() }, 'provider');
		}
		lib.saveUiPrefs({ modelSelection: lib.encodeModelSelection(id, model) });
		flushAll();
		return { profileId: id, model, envOverrides: !!(envAi && envAi.record) };
	}
	async function aiRemove(id){
		const p = await savedProfile(id);
		await lib.deleteStoreRecord(PS, p.id);
		const sel = lib.parseModelSelection((lib.loadUiPrefs() || {}).modelSelection || '');
		if(sel.profileId === p.id){ lib.saveUiPrefs({ modelSelection: '' }); }
		flushAll();
		return { removed: p.id };
	}
	async function aiTest(b){
		let target = null;
		if(b.profileId){
			const p = (await lib.listStoreRecords(PS) || []).find((x)=>x.id === `${b.profileId}`);
			if(!p){ throw new Error(`没有这个接口档案 ${b.profileId}`); }
			const models = (p.chatModelIds && p.chatModelIds.length ? p.chatModelIds : p.manualModels) || [];
			target = { profile: p, model: `${b.model || ''}`.trim() || models[0] };
		}else{
			target = await lib.resolveHeadlessProfile({});
		}
		if(!target || !target.model){ throw new Error('没有可用的接口档案 / 模型:先 ./horosa ai add,或设环境变量 HOROSA_AI_PROVIDER'); }
		if(target.profile.apiKeyDecryptFailed){ return { ok: false, error: '这个档案的密钥解不开(主密钥换了?):./horosa ai key <档案> 重填', profileId: target.profile.id, model: target.model }; }
		const r = await lib.pingProvider(target.profile, target.model, Number(b.timeoutMs) || 30000);
		return { ...r, profileId: target.profile.id };
	}

	// ── 整库导出 / 导入(与桌面「全量备份」同一格式;密钥一律不随包走)──
	function jszip(){ return require(path.join(UI_ROOT, 'node_modules/jszip')); }
	async function exportTo(b){
		const file = path.resolve(`${b.path || ''}`);
		if(!b.path){ throw new Error('要给导出文件路径'); }
		if(fs.existsSync(file) && !b.overwrite){ throw new Error(`文件已存在:${file}(换个名字,或加 --overwrite)`); }
		flushAll();
		const manifest = await lib.buildFullUnifiedManifest();
		// 无头数据目录里几乎没有技法设置:包不打「设置面完整」—— 否则桌面恢复时把本机全部技法设置当「备份里为默认」复位
		manifest.settingsComplete = false;
		manifest.source = 'headless';
		// 环境变量档案与本机键不进包(它们不属于这份数据);改了数据段要重算校验和
		const pp = manifest.aiWorkspace && manifest.aiWorkspace.stores && manifest.aiWorkspace.stores[PROVIDER_STORE];
		if(Array.isArray(pp)){ manifest.aiWorkspace.stores[PROVIDER_STORE] = pp.filter((r)=>r && r.id !== ENV_PROFILE_ID); }
		if(manifest.raw && typeof manifest.raw === 'object'){
			HEADLESS_LOCAL_KEYS.forEach((k)=>{ delete manifest.raw[k]; });
			// 界面偏好按落盘原值导出:读写叠层会把「当前模型」换成只在内存里的环境变量档案(导出包里没有它 → 选择悬空)
			if(Object.prototype.hasOwnProperty.call(manifest.raw, UI_PREF_KEY)){
				const onDisk = storage.__rawGet(UI_PREF_KEY);
				if(onDisk === null){ delete manifest.raw[UI_PREF_KEY]; }else{ manifest.raw[UI_PREF_KEY] = onDisk; }
			}
		}
		manifest.checksums = lib.buildManifestChecksums(manifest);
		const Zip = jszip();
		const zip = new Zip();
		zip.file(lib.UNIFIED_MANIFEST_NAME, JSON.stringify(manifest));
		const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
		writeAtomic(file, buf, 0o600);
		const count = (env)=>(env && Array.isArray(env.charts) ? env.charts.length : (env && Array.isArray(env.cases) ? env.cases.length : (env && Number.isFinite(Number(env.total)) ? Number(env.total) : 0)));
		return { path: file, bytes: buf.length, charts: count(manifest.charts), cases: count(manifest.cases), aiStores: manifest.aiWorkspace && manifest.aiWorkspace.stores ? Object.keys(manifest.aiWorkspace.stores).length : 0 };
	}
	async function importFrom(b){
		const file = path.resolve(`${b.path || ''}`);
		if(!b.path || !fs.existsSync(file)){ throw new Error(`找不到备份文件:${file}`); }
		const st = fs.statSync(file);
		if(st.size > IMPORT_MAX_ZIP_BYTES){ throw new Error('备份文件超过 200 MB 上限'); }
		const bytes = fs.readFileSync(file);
		// 预览与真导入之间文件被换掉 → 拒(导入的必须是用户在预览里确认过的那一份)
		const sha256 = require('crypto').createHash('sha256').update(bytes).digest('hex');
		if(b.expectSha256 && `${b.expectSha256}` !== sha256){ throw new Error('备份文件在预览之后变了(内容哈希对不上):重新预览再导入'); }
		// 解压后大小先看清单(防压缩炸弹;只读中央目录,不解压)
		try{
			const z = await jszip().loadAsync(bytes);
			const entry = z.file(lib.UNIFIED_MANIFEST_NAME);
			const size = entry && entry._data && Number(entry._data.uncompressedSize);
			if(Number.isFinite(size) && size > IMPORT_MAX_MANIFEST_BYTES){ throw Object.assign(new Error(`备份内容解压后 ${Math.round(size / 1048576)} MB,超过 ${IMPORT_MAX_MANIFEST_BYTES / 1048576} MB 上限`), { tooBig: true }); }
		}catch(e){ if(e && e.tooBig){ throw e; } /* 不是 zip 等:交给下面的解析报错 */ }
		const manifest = await lib.parseUnifiedBackupBlob(new Uint8Array(bytes));
		if(!manifest){ throw new Error('不是星阙备份文件(没有 manifest.json)'); }
		const v = lib.validateUnifiedBackup(manifest);
		// 剔本机键:连同它们各自的校验和条目一起剔(只剔这几条;别的段的校验和原样保留,坏段照常能查出来)。
		// 安全开关不在这里剔 —— 恢复层缺省就不恢复、也不复位本机的(includeSecurity 才一并恢复);此前剔掉后恢复层把
		// 「本机有、包里没有」当成「备份里为默认」,把本机收紧过的审批档 / 外部客户端档 / 按名禁用复位成最宽的缺省
		const secKeys = Array.isArray(lib.BACKUP_SECURITY_KEYS) ? lib.BACKUP_SECURITY_KEYS : SECURITY_KEYS;
		const securityInBackup = manifest.raw && typeof manifest.raw === 'object' ? secKeys.filter((k)=>Object.prototype.hasOwnProperty.call(manifest.raw, k)) : [];
		const dropKeys = HEADLESS_LOCAL_KEYS;
		// 行动能力总开关在无头里恒开(每次启动都写开,不是用户设置):导入不比也不写它 —— 否则按「较严的一档」被关掉,
		// 本进程之后的每次工具调用都回「行动能力未开」,直到重启
		const restoreOpts = { includeSecurity: !!b.includeSecurity, keepLocalKeys: ['horosa.ai.agent.enabled'] };
		if(manifest.raw && typeof manifest.raw === 'object'){
			dropKeys.forEach((k)=>{
				delete manifest.raw[k];
				if(manifest.checksums && manifest.checksums.raw && typeof manifest.checksums.raw === 'object'){ delete manifest.checksums.raw[k]; }
			});
		}
		const reasons = { 'not-object': '内容不是对象', 'format-mismatch': '不是星阙全量备份格式', 'reader-too-old': '备份来自更新的版本,先更新星阙仓库', empty: '备份里没有数据' };
		if(!v.ok){ throw new Error(`备份不可用:${reasons[v.reason] || v.reason}`); }
		const preview = lib.previewUnifiedRestore(manifest, restoreOpts);
		const warnings = [];
		if(v.reason === 'checksum-bad'){ warnings.push(`校验和不符的段会跳过:${(v.badSections || []).join(', ')}`); }
		if(v.reason === 'newer-version'){ warnings.push('备份来自更新的版本,能认的部分照常导入'); }
		const security = { keys: securityInBackup, included: !!b.includeSecurity };
		if(securityInBackup.length && !b.includeSecurity){ warnings.push(`备份里有 ${securityInBackup.length} 项安全开关(审批档 / 私人内容 / 联网 / 无头分析 / 按名禁用等):缺省每项取本机与备份里较严的一档,不会放宽本机;要整值一并导入(可能放宽)加 --include-security`); }
		if(b.dryRun){ return { dryRun: true, preview, warnings, version: v.version, sha256, security }; }
		// 导入前整份数据目录留一份快照(撤销 = 停服务后把快照目录拷回 data/)
		flushAll();
		const snap = path.join(headlessDir(), 'backups', `pre-import-${new Date().toISOString().replace(/[:.]/g, '-')}`);
		fs.mkdirSync(path.dirname(snap), { recursive: true });
		if(fs.existsSync(dataDir())){ fs.cpSync(dataDir(), snap, { recursive: true, filter: (src)=>path.basename(src) !== '.lock' }); }
		const results = await lib.restoreUnifiedBackup(manifest, restoreOpts);
		flushAll();
		const keyless = ((manifest.aiWorkspace && manifest.aiWorkspace.stores && manifest.aiWorkspace.stores[PROVIDER_STORE]) || []).filter((r)=>r && r.id !== ENV_PROFILE_ID).map((r)=>r.id);
		return { dryRun: false, results, warnings, snapshot: snap, keylessProfiles: keyless, sha256, security };
	}

	// 撤销一条账本动作(与桌面「动作记录 › 撤销」同一函数;AI 只能做、撤销要人来)
	async function undo(actionId){
		const id = `${actionId || ''}`.trim();
		if(!id){ throw new Error('要给动作 id(./horosa actions 列出)'); }
		const r = lib.undoAction(id);
		// 异步撤销(任务类):等它真落定(至多 15 秒)
		const until = Date.now() + 15000;
		while(r && r.pending && Date.now() < until){ await new Promise((res)=>setTimeout(res, 100)); }   // eslint-disable-line no-await-in-loop
		flushAll();
		return r;
	}

	// 数据目录体检(doctor / status 用):改名留档的坏文件 + 启动时读不了、本进程拒写的存储区
	function dataHealth(){
		const hook = globalThis.__HOROSA_HEADLESS_STORE__;
		return { corruptFiles: listCorruptDataFiles(), unreadableStores: hook && typeof hook.unreadable === 'function' ? hook.unreadable() : [] };
	}

	const admin = {
		dataHealth,
		getConfig(){ const out = { serverRoot }; Object.keys(CONFIG_KEYS).forEach((k)=>{ out[k] = CONFIG_KEYS[k].get(); }); return out; },
		setConfig(key, value){
			const c = CONFIG_KEYS[key];
			if(!c){ throw new Error(`没有这个设置 ${key}(可设:${Object.keys(CONFIG_KEYS).join(' / ')})`); }
			c.set(value);
			return admin.getConfig();
		},
		listProposals(opts3){ return lib.listProposals(opts3 || {}); },
		proposal(op, id, note){
			if(['accept', 'reject', 'revert'].indexOf(op) < 0){ throw new Error('操作只能是 accept / reject / revert'); }
			return exclusive(async ()=>{
				const r = op === 'accept' ? lib.acceptProposal(id) : (op === 'reject' ? lib.rejectProposal(id, note) : lib.revertProposal(id));
				flushAll();
				return r;
			});
		},
		aiStatus, aiAdd, aiKey, aiUse, aiRemove, aiTest,
		// 导入 / 导出 / 撤销 进写入通道:与工具写入串行(导入的快照与恢复之间不会混进别的写入)
		exportTo: (b)=>exclusive(()=>exportTo(b)),
		importFrom: (b)=>exclusive(()=>importFrom(b)),
		undo: (id)=>exclusive(()=>undo(id)),
	};
	admin.handle = makeAdminHandler(admin);

	function close(){
		try{ storage.__flush(); }catch(e){ /* noop */ }
		try{ flushStores(); }catch(e){ /* noop */ }
		try{ w.close(); }catch(e){ /* noop */ }
	}
	process.once('exit', ()=>{ try{ storage.__flush(); flushStores(); }catch(e){ /* noop */ } });
	// 被 SIGTERM / SIGHUP 结束(MCP 客户端关会话、./horosa stop、关终端)时 Node 缺省直接终止、不触发 exit 事件 →
	// 合并中的写入(150 / 200 ms 去抖)会丢、端点文件与数据锁会残留。这里改成正常退出:exit 监听者照常落盘、摘文件、放锁。
	// 前台服务(serve)自己接这两个信号做优雅关停,传 handleSignals:false。
	if(o.handleSignals !== false){
		[['SIGTERM', 143], ['SIGHUP', 129]].forEach(([sig, code])=>{ process.once(sig, ()=>process.exit(code)); });
	}

	singleton = { dispatch, close, admin, lib, storage, serverRoot, chartRoot, home: horosaHome() };
	return singleton;
}

module.exports = { createRuntime, makeAdminHandler, ensureBundle, openAstrodataDb, horosaHome, headlessDir, dataDir, masterKeyFile, resolveServerRoot, resolveBackendRoots, createFileStorage, installStoreHook, installMasterKey, writeAtomic, quarantineDataFile, listCorruptDataFiles, listCorruptArchiveKeys, corruptArchiveKeysOf, UI_UNAVAILABLE_MESSAGE, ENV_PROFILE_ID, SECURITY_KEYS };
