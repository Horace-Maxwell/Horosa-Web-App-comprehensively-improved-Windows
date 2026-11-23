#!/usr/bin/env node
// 命题验证:./horosa verify <命题.json> —— 把一份写明了的命题放到一批命例上机械地判定,出裁决与可复核的凭据。
//
// 一份命题文件写明:命例从哪来(文件或内置名人库)、钉住的时刻与时区、各技法的设置、判据怎么取、要验的命题与门槛。
// 本命令:① 把命例整理成一份带唯一编号的清单;② 调批量验证(./horosa batch,同一引擎、同一份设置)逐例起盘;
// ③ 交给内核(verifyKernel.js:纯函数、精确整数运算)逐条判定;④ 写出报告与凭据。
// 凭据里有命题、命例清单、起盘结果、各条计数的指纹与裁决:别人拿同一份命题与命例,./horosa verify --check 凭据
// 重跑一遍,指纹与裁决对得上才算数。复核分两层:判定层(命题、命例清单、各条的计数 / 检验值 / 裁决)必须逐项相同;
// 结果层(每例每技法的正文)另报 —— 换一种处理器 / 数学库,个别末位取整会不同(秒、小数末位),不影响判据时判定层照样一致;
// --strict 把结果层也算进去。
// 退出码:0 全部命题成立 · 1 有命题不成立 / 证据不足 / 样本不足(--check:复核不一致)· 2 用法或命题文件写错
//        · 3 本机计算服务没开 · 5 其它失败 · 130 Ctrl-C。
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const K = require('./verifyKernel');

const EXIT = { OK: 0, NOT_HOLD: 1, USAGE: 2, NOT_RUNNING: 3, FAILED: 5, INTERRUPTED: 130 };
const FORMAT = 'horosa-verify-certificate/1';
const BATCH = path.join(__dirname, 'batch.js');
class UsageError extends Error{ constructor(message){ super(message); this.exitCode = EXIT.USAGE; } }
class RunError extends Error{ constructor(code, message){ super(message); this.exitCode = code; } }

function usage(){
	return [
		'星阙命题验证:把写明了的命题放到一批命例上机械地判定,出裁决与可复核的凭据',
		'',
		'用法: ./horosa verify <命题.json> [-o 输出目录] [选项]',
		'      ./horosa verify --check <凭据.json> [--cases 命例文件] [--strict]   照凭据重跑一遍,核对指纹与裁决',
		'      ./horosa verify --explain                               命题文件怎么写(字段、判据、三种命题)',
		'',
		'选项:',
		'  -o, --out 目录              输出目录(缺省:命题文件旁的 <文件名>.verify/):cases.jsonl 命例清单 · results.jsonl 起盘结果',
		'                              · certificate.json 凭据 · report.txt 报告',
		'  --reuse                     输出目录里已有同一份命题、同一批命例的起盘结果时直接用,不重跑',
		'  --json                      标准输出只打凭据(JSON);报告照旧写进文件',
		'  --strict                    --check 时:每例每技法的正文也要逐字相同才算一致(缺省只要求判定层一致,正文的差异另报)',
		'  --backends J:P[,J:P…] · -j N · --timeout 秒 · --python-only · --no-probe   原样交给批量验证(见 ./horosa batch --help)',
		'',
		'退出码: 0 全部命题成立 · 1 有命题不成立 / 证据不足 / 样本不足(--check:复核不一致)· 2 用法或命题文件写错',
		'        · 3 本机计算服务没开 · 5 其它失败 · 130 Ctrl-C',
	].join('\n') + '\n';
}

function explain(){
	return [
		'命题文件(JSON)的写法',
		'',
		'{',
		'  "title": "一句话说明(只作显示)",',
		'  "cases": { "file": "命例.csv" }              命例文件(CSV / TSV / JSONL / JSON;列名认法同 ./horosa batch;多出来的列可当判据用)',
		'         可加 "kind": "timepoint":每一行是一个起课时间(+ 地点),起按时间起盘的技法(六壬 / 奇门 / 太乙 / 黄历 …;同 ./horosa batch --kind)',
		'         或 { "celebrities": { "rodden": ["AA","A"], "withTime": true } }   内置名人库;可另加 "offset" / "limit"',
		'  "clock": { "now": "2030-06-01 12:00", "tz": "Asia/Shanghai" }   必填:钉住「此刻」与时区,结果才可复现',
		'  "options": { "技法": { 键: 值 } }             各技法的设置覆盖(同 ./horosa batch --options);没写的一律按出厂缺省 —— 不读本机存的设置',
		'  "sections": { "技法": ["段名", …] }           各技法只取哪几段(同 ./horosa batch --sections;每技法 1–12 个,按段名里含这几个字找)。',
		'                                              正文很长的技法(超过 60000 字会被截断)写上它,只取判据要看的段',
		'  "define": { "名字": 判据, … }                 给判据起名,下面按名字引用',
		'  "statements": [ 命题, … ]                    至少一条',
		'  "correction": "bonferroni"                  多条带检验的命题一起判时的校正:none / bonferroni(缺省)/ holm',
		'}',
		'',
		'判据(对每一例说 是 / 否 / 不知道):',
		'  { "technique": "bazi", "contains": "日主" }                 技法正文里含这串(数组 = 都要含);可加 "section": "段名" 只看某一段',
		'  { "technique": "bazi", "regex": "日主[:：]\\\\s*甲" }         正文匹配正则(可加 "flags": "i")',
		'  { "technique": "x", "number": { "regex": "评分[:：](\\\\d+)", "op": ">=", "value": 60 } }   取出第一个括号里的数来比',
		'  { "field": "gender", "eq": "male" }                         这一例自带的资料:eq / in / regex / gte / lte / exists',
		'                                                              (命例文件的任意列;名人库有 gender rodden birthYear hasTime name pos summary)',
		'  { "category": "1947 births" }  或 { "category": "Birthplace Paris", "prefix": true }      名人库的分类(名字照库里的原文;./horosa call list_celebrity_categories query=关键词 查)',
		'  { "event": { "type": "Marriage" } }                         名人库的生平事件类型(正则)',
		'  { "all": [判据…] } · { "any": [判据…] } · { "not": 判据 } · "名字"(引用 define)',
		'  要看的技法这一例没起出来 → 不知道:这一例不进该命题的计数,报告里写明有多少例。',
		'  正文超过 60000 字被截断的格:看得见的部分里找到了算「是」,没找到记「不知道」(可能在被裁掉的部分里);用 "sections" 只取要用的段可避免。',
		'',
		'命题三种:',
		'  { "kind": "implication", "if": 判据, "then": 判据 }          凡满足 if 的例都满足 then;有反例即不成立,反例逐个列出(可加 "minSupport": 没有反例时满足 if 的例至少要这么多)',
		'  { "kind": "association", "feature": 判据, "label": 判据 }    有特征的例里 label 的比例更高(alternative: greater 缺省 / less / two-sided);',
		'      四格表 + 费希尔精确检验;可加 "alpha": "0.01" · "minCases": 30 · "minSupport": 5 · "minLift": "1.2"',
		'  { "kind": "rate", "feature": 判据, "p0": "1/12" }            满足 feature 的比例与 p0 不同(alternative: two-sided 缺省 / greater / less);二项精确检验',
		'  每条可加 "id"、"title"、"where": 判据(只在这部分人里验)。alpha / p0 / minLift 用字符串写小数或分数。',
		'',
		'裁决:holds 成立 · refuted 不成立(有反例)· not_supported 证据不足以支持 · insufficient 样本不足。',
		'检验值与门槛都用精确的分数算(不用浮点):同一份命题与结果,在任何机器上裁决相同。',
	].join('\n') + '\n';
}

// ───────────────────────── 参数 ─────────────────────────

function parseArgs(argv){
	const o = { claim: null, out: null, check: null, cases: null, reuse: false, json: false, strict: false, help: false, explain: false, pass: [] };
	const a = argv.slice();
	const val = (i, name)=>{ if(i + 1 >= a.length){ throw new UsageError(`${name} 后面要跟一个值`); } return a[i + 1]; };
	for(let i = 0; i < a.length; i++){
		let k = a[i];
		const eq = /^(--[a-z-]+)=(.*)$/s.exec(k);
		if(eq){ a.splice(i, 1, eq[1], eq[2]); k = eq[1]; }
		switch(k){
		case '-h': case '--help': o.help = true; break;
		case '--explain': o.explain = true; break;
		case '-o': case '--out': o.out = val(i, k); i++; break;
		case '--check': o.check = val(i, k); i++; break;
		case '--cases': o.cases = val(i, k); i++; break;
		case '--reuse': o.reuse = true; break;
		case '--json': o.json = true; break;
		case '--strict': o.strict = true; break;
		case '--backends': case '-j': case '--concurrency': case '--timeout': o.pass.push(k, val(i, k)); i++; break;
		case '--python-only': case '--no-probe': o.pass.push(k); break;
		default:
			if(k.startsWith('-')){ throw new UsageError(`不认识的选项 ${k}(./horosa verify --help 看用法)`); }
			if(o.claim !== null){ throw new UsageError(`只能给一份命题文件(多给了「${k}」)`); }
			o.claim = k;
		}
	}
	if(o.help || o.explain){ return o; }
	if(o.check && o.claim){ throw new UsageError('--check 与命题文件只能二选一(--check 用的是凭据里记下的那份命题)'); }
	if(!o.check && !o.claim){ throw new UsageError('要给命题文件(或 --check 凭据.json;--explain 看命题文件怎么写)'); }
	if(o.cases && !o.check){ throw new UsageError('--cases 只在 --check 时用(凭据里记的命例文件不在原处时另指一份)'); }
	if(o.strict && !o.check){ throw new UsageError('--strict 只在 --check 时用'); }
	return o;
}

// ───────────────────────── 命题文件 ─────────────────────────

const TOP_KEYS = ['title', 'description', 'cases', 'clock', 'techniques', 'options', 'sections', 'define', 'statements', 'correction'];

// 读入并校验命题;返回 { claim(规范化,进指纹的部分), title, compiled, techniques }
function loadClaim(raw, baseDir){
	if(!raw || typeof raw !== 'object' || Array.isArray(raw)){ throw new UsageError('命题文件要是一个 JSON 对象'); }
	Object.keys(raw).forEach((k)=>{ if(TOP_KEYS.indexOf(k) < 0){ throw new UsageError(`命题文件里不认识的键「${k}」(只认 ${TOP_KEYS.join(' / ')})`); } });
	// 命例来源
	const c = raw.cases;
	if(!c || typeof c !== 'object' || Array.isArray(c)){ throw new UsageError('cases 要写成 { "file": 路径 } 或 { "celebrities": {…} }'); }
	Object.keys(c).forEach((k)=>{ if(['file', 'celebrities', 'offset', 'limit', 'format', 'map', 'kind'].indexOf(k) < 0){ throw new UsageError(`cases 里不认识的键「${k}」`); } });
	if((c.file === undefined) === (c.celebrities === undefined)){ throw new UsageError('cases 要 file 与 celebrities 二选一'); }
	const cases = {};
	if(c.file !== undefined){
		if(typeof c.file !== 'string' || !c.file){ throw new UsageError('cases.file 要文件路径'); }
		cases.file = c.file;
		if(c.format !== undefined){ if(['csv', 'tsv', 'jsonl', 'json'].indexOf(c.format) < 0){ throw new UsageError('cases.format 只认 csv / tsv / jsonl / json'); } cases.format = c.format; }
		if(c.map !== undefined){
			if(!c.map || typeof c.map !== 'object' || Array.isArray(c.map)){ throw new UsageError('cases.map 要写成 { 字段: 列名 }'); }
			cases.map = c.map;
		}
	}else{
		const cel = c.celebrities === true ? {} : c.celebrities;
		if(!cel || typeof cel !== 'object' || Array.isArray(cel)){ throw new UsageError('cases.celebrities 要写成 true 或 { "rodden": […], "withTime": true }'); }
		Object.keys(cel).forEach((k)=>{ if(['rodden', 'withTime'].indexOf(k) < 0){ throw new UsageError(`cases.celebrities 里不认识的键「${k}」`); } });
		cases.celebrities = {};
		if(cel.rodden !== undefined){
			if(!Array.isArray(cel.rodden) || !cel.rodden.length || cel.rodden.some((x)=>typeof x !== 'string')){ throw new UsageError('cases.celebrities.rodden 要评级数组(如 ["AA","A"])'); }
			cases.celebrities.rodden = cel.rodden.map((x)=>x.trim().toUpperCase());
		}
		if(cel.withTime !== undefined){ if(typeof cel.withTime !== 'boolean'){ throw new UsageError('cases.celebrities.withTime 要 true / false'); } cases.celebrities.withTime = cel.withTime; }
	}
	// 每一行是什么:natal(缺省)= 出生资料;timepoint = 起课时间(起按时间起盘的技法)。缺省值不写进规范化的命题
	if(c.kind !== undefined && c.kind !== 'natal'){
		if(c.kind !== 'timepoint'){ throw new UsageError('cases.kind 只认 natal / timepoint'); }
		if(c.celebrities !== undefined){ throw new UsageError('cases.kind = timepoint 不能配内置名人库(那是出生资料)'); }
		cases.kind = 'timepoint';
	}
	['offset', 'limit'].forEach((k)=>{
		if(c[k] === undefined){ return; }
		if(!Number.isInteger(c[k]) || c[k] < (k === 'limit' ? 1 : 0)){ throw new UsageError(`cases.${k} 要${k === 'limit' ? '正' : '非负'}整数`); }
		cases[k] = c[k];
	});
	// 钉住的时刻:必填(不钉,结果随跑的那一刻变,凭据就没法复核)
	const ck = raw.clock;
	if(!ck || typeof ck !== 'object' || typeof ck.now !== 'string' || !ck.now.trim()){ throw new UsageError('clock.now 必填(如 { "now": "2030-06-01 12:00", "tz": "Asia/Shanghai" }):不钉住「此刻」,结果随跑的那一刻变,没法复核'); }
	Object.keys(ck).forEach((k)=>{ if(['now', 'tz'].indexOf(k) < 0){ throw new UsageError(`clock 里不认识的键「${k}」`); } });
	let clock;
	try{ clock = require('./batch').resolveClock(ck.now.trim(), ck.tz === undefined ? null : `${ck.tz}`.trim()); }
	catch(e){ throw new UsageError(`clock:${e.message.replace(/^--(now|tz) /, '')}`); }
	// 设置覆盖
	const options = raw.options === undefined ? {} : raw.options;
	if(!options || typeof options !== 'object' || Array.isArray(options) || Object.values(options).some((x)=>!x || typeof x !== 'object' || Array.isArray(x))){
		throw new UsageError('options 要写成 {"技法": {键: 值}}');
	}
	// 判定部分交给内核校验
	let compiled;
	try{ compiled = K.compileClaim({ define: raw.define, statements: raw.statements, correction: raw.correction }); }
	catch(e){ if(e instanceof K.VerifyError){ throw new UsageError(e.message); } throw e; }
	const extra = raw.techniques === undefined ? [] : raw.techniques;
	if(!Array.isArray(extra) || extra.some((x)=>typeof x !== 'string' || !x)){ throw new UsageError('techniques 要技法键数组'); }
	const techniques = Array.from(new Set([...compiled.techniques, ...extra])).sort();
	if(!techniques.length){ throw new UsageError('这份命题没有用到任何技法(判据里至少要有一处看技法正文)'); }
	const unknownOpt = Object.keys(options).filter((t)=>techniques.indexOf(t) < 0);
	if(unknownOpt.length){ throw new UsageError(`options 里的技法没有被任何判据用到:${unknownOpt.join(', ')}`); }
	// 各技法只取哪几段(形状同批量的 --sections);没写就不进规范化的命题(早先的命题指纹不变)
	const sections = raw.sections;
	if(sections !== undefined){
		const okShape = sections && typeof sections === 'object' && !Array.isArray(sections) && Object.keys(sections).length > 0
			&& Object.values(sections).every((x)=>Array.isArray(x) && x.length >= 1 && x.length <= 12 && x.every((s)=>typeof s === 'string' && s.trim()));
		if(!okShape){ throw new UsageError('sections 要写成 {"技法": ["段名", …]}(每技法 1–12 个段名)'); }
		const unknownSec = Object.keys(sections).filter((t)=>techniques.indexOf(t) < 0);
		if(unknownSec.length){ throw new UsageError(`sections 里的技法没有被任何判据用到:${unknownSec.join(', ')}`); }
	}
	const claim = { cases, clock: { now: clock.iso, tz: clock.tz }, techniques, options, ...(sections !== undefined ? { sections } : {}), define: raw.define === undefined ? {} : raw.define,
		statements: raw.statements, correction: compiled.correction };
	return { claim, title: raw.title === undefined ? '' : `${raw.title}`, compiled, techniques, clock, baseDir };
}

// ───────────────────────── 命例清单 ─────────────────────────

const str = (v)=>(v === null || v === undefined ? '' : `${v}`);

// 命例文件 → 清单(每例一个不重复的编号 + 原样保留的全部列)
async function casesFromFile(spec, file){
	const B = require('./batch');
	if(!fs.existsSync(file)){ throw new UsageError(`命例文件不存在:${file}`); }
	const o = { input: file, format: spec.format || null, delimiter: null, celebrities: false };
	const { rows } = await B.openRawRows(o);
	const list = []; const seen = new Set(); let n = 0;
	for await (const item of rows){
		n += 1;
		if(n <= (spec.offset || 0)){ continue; }
		if(spec.limit !== undefined && list.length >= spec.limit){ break; }
		const fields = {};
		if(item.bad){ fields.__bad = item.bad; }
		else{ item.headers.forEach((h, i)=>{ fields[`${h}`] = Array.isArray(item.row) ? item.row[i] : item.row[h]; }); }
		// 编号:文件里有就用(认 id / cid / key / uid / 编号 / 序号 这几种列名),重复的从第二次起加行号;没有就按行号
		const idCol = (item.headers || []).find((h)=>B.FIELD_ALIASES.id.map((x)=>x.toLowerCase()).indexOf(`${h}`.trim().toLowerCase()) >= 0);
		let id = idCol !== undefined && str(fields[idCol]).trim() !== '' ? str(fields[idCol]).trim() : `r${n}`;
		if(seen.has(id)){ id = `${id}#${n}`; }
		seen.add(id);
		list.push({ key: id, n, fields, categories: [], events: [] });
	}
	return list;
}

// 内置名人库 → 清单(出生资料 + 分类 + 生平事件;与「工具 · 数据库」页同一份离线库)
async function casesFromCelebrities(spec){
	const { openAstrodataDb } = require('./runtime');
	const db = await openAstrodataDb();
	try{
		const cel = spec.celebrities || {};
		const where = []; const params = [];
		if(cel.rodden && cel.rodden.length){ where.push(`rodden IN (${cel.rodden.map(()=>'?').join(',')})`); params.push(...cel.rodden); }
		if(cel.withTime){ where.push('has_time = 1'); }
		const st = db.prepare(`SELECT title, cid, name, birth_chart, birth_year, has_time, zone, gpsLat, gpsLon, pos, gender, rodden, wiki_summary, evt_json FROM person${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY id`);
		if(params.length){ st.bind(params); }
		const list = []; const byTitle = new Map(); let n = 0;
		while(st.step()){
			n += 1;
			if(n <= (spec.offset || 0)){ continue; }
			if(spec.limit !== undefined && list.length >= spec.limit){ break; }
			const r = st.getAsObject();
			let events = [];
			try{ const ev = JSON.parse(r.evt_json || '[]'); if(Array.isArray(ev)){ events = ev.map((x)=>({ type: str(x && x.type), date: str(x && x.date) })); } }catch(e){ events = []; }
			const fields = { id: str(r.cid), name: str(r.name), birth: str(r.birth_chart), zone: str(r.zone), gpsLat: r.gpsLat, gpsLon: r.gpsLon, pos: str(r.pos),
				gender: Number(r.gender) === 1 ? 'male' : Number(r.gender) === 0 ? 'female' : 'unknown',
				rodden: str(r.rodden), birthYear: r.birth_year, hasTime: Number(r.has_time) === 1 ? 'true' : 'false', summary: str(r.wiki_summary) };
			const item = { key: fields.id || `r${n}`, n, fields, categories: [], events };
			list.push(item); byTitle.set(str(r.title), item);
		}
		st.free();
		const cs = db.prepare('SELECT person_title, category FROM category');
		while(cs.step()){ const r = cs.getAsObject(); const it = byTitle.get(str(r.person_title)); if(it){ it.categories.push(str(r.category)); } }
		cs.free();
		list.forEach((it)=>it.categories.sort());
		return list;
	}finally{ try{ db.close(); }catch(e){ /* noop */ } }
}

// 交给批量验证的那份输入:只带起盘要用的列(名人库的长文简介、分类、事件留在内存里当判据用)
const BATCH_COLUMNS_CELEB = ['id', 'name', 'birth', 'zone', 'gpsLat', 'gpsLon', 'pos', 'gender'];
function writeCasesFile(file, list, celebrities){
	const fd = fs.openSync(file, 'w', 0o600);
	try{
		list.forEach((c)=>{
			let row;
			if(celebrities){ row = {}; BATCH_COLUMNS_CELEB.forEach((k)=>{ row[k] = c.fields[k]; }); }
			else if(c.fields.__bad){ row = { id: c.key, __bad: c.fields.__bad }; }
			else{ row = { ...c.fields, id: c.key }; }
			fs.writeSync(fd, `${JSON.stringify(row)}\n`);
		});
	}finally{ fs.closeSync(fd); }
}
// 命例清单的指纹:起盘用的资料 + 当判据用的资料,都算进去
const casesFingerprint = (list)=>K.fingerprint(list.map((c)=>[c.key, c.fields, c.categories, c.events]));

// ───────────────────────── 起盘(调批量验证)─────────────────────────

function runBatch(args, io){
	return new Promise((resolve)=>{
		const child = spawn(process.execPath, [BATCH, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
		let errTail = '';
		child.stdout.on('data', (b)=>io.err(`${b}`));
		child.stderr.on('data', (b)=>{ const s = `${b}`; errTail = `${errTail}${s}`.slice(-4000); io.err(s); });
		const onSig = ()=>{ try{ child.kill('SIGINT'); }catch(e){ /* noop */ } };
		process.on('SIGINT', onSig);
		child.on('exit', (code, sig)=>{ process.off('SIGINT', onSig); resolve({ code: code === null ? (sig === 'SIGINT' ? 130 : 5) : code, errTail }); });
	});
}

// 一行一行地读(不把整份文件读成一个字符串:名人库规模的结果有上 GB,超过单个字符串的上限)
function forEachLine(file, fn){
	const fd = fs.openSync(file, 'r');
	try{
		const buf = Buffer.allocUnsafe(1 << 20); let parts = []; let n;
		while((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0){
			let start = 0;
			for(let i = 0; i < n; i++){
				if(buf[i] !== 0x0a){ continue; }
				parts.push(Buffer.from(buf.subarray(start, i)));
				fn(Buffer.concat(parts).toString('utf8')); parts = []; start = i + 1;
			}
			if(start < n){ parts.push(Buffer.from(buf.subarray(start, n))); }
		}
		if(parts.length){ fn(Buffer.concat(parts).toString('utf8')); }
	}finally{ fs.closeSync(fd); }
}
// 读起盘结果:每读到一例,当场算好它的正文指纹与全部看正文的判据,随即把正文丢掉(内存里只留判定要用的东西)。
// 同一编号出现多行时以后一行为准。
function readResults(file, list, techniques, compiled){
	const byKey = new Map(); list.forEach((c)=>{ byKey.set(c.key, c); c.results = {}; c.marks = null; c.leaf = undefined; c.row = null; });
	forEachLine(file, (line)=>{
		if(!line.trim()){ return; }
		let row; try{ row = JSON.parse(line); }catch(e){ return; }
		if(!row || row.key === undefined){ return; }
		const c = byKey.get(`${row.key}`);
		if(!c){ return; }
		c.results = {}; c.marks = null; c.leaf = undefined;
		if(row.error){ c.row = 'error'; return; }
		c.row = 'ok'; c.marks = {};
		techniques.forEach((t)=>{
			const x = row.results && row.results[t];
			if(x && x.ok && x.data && typeof x.data.content === 'string'){
				c.results[t] = { ok: true, content: x.data.content, sections: Array.isArray(x.sections) ? x.sections : [], truncated: !!x.data.truncated };
				c.marks[t] = K.sha256(x.data.content);
			}else{
				c.results[t] = { ok: false, code: (x && x.code) || 'E_MISSING' };
				c.marks[t] = `ERR:${(x && x.code) || 'E_MISSING'}`;
			}
		});
		if(compiled){
			K.prepareCase(compiled, c);
			techniques.forEach((t)=>{ const r = c.results[t]; if(r.ok){ c.results[t] = { ok: true, truncated: r.truncated }; } });
		}
	});
	let missing = 0; let inputErrors = 0;
	const cellStats = {}; techniques.forEach((t)=>{ cellStats[t] = { ok: 0, failed: 0, truncated: 0 }; });
	list.forEach((c)=>{
		if(!c.row){ missing += 1; return; }
		if(c.row === 'error'){ inputErrors += 1; return; }
		techniques.forEach((t)=>{ const r = c.results[t]; if(r && r.ok){ cellStats[t].ok += 1; if(r.truncated){ cellStats[t].truncated += 1; } }else{ cellStats[t].failed += 1; } });
	});
	return { missing, inputErrors, cellStats };
}
// 起盘结果的指纹:每例每技法的正文(或失败码)
const cellMark = (c, t)=>{
	if(c.marks && c.marks[t] !== undefined){ return c.marks[t]; }
	const r = c.results && c.results[t];
	return r && r.ok && typeof r.content === 'string' ? K.sha256(r.content) : `ERR:${(r && r.code) || 'E_MISSING'}`;
};
const resultsFingerprint = (list, techniques)=>K.fingerprint(list.map((c)=>[c.key, techniques.map((t)=>cellMark(c, t))]));
// 每个技法各一枚(复核时说得出是哪些技法的正文不同)
const resultsByTechnique = (list, techniques)=>{ const o = {}; techniques.forEach((t)=>{ o[t] = K.fingerprint(list.map((c)=>[c.key, cellMark(c, t)])); }); return o; };

// ───────────────────────── 报告 ─────────────────────────

const VERDICT_ZH = { holds: '成立', refuted: '不成立(有反例)', not_supported: '证据不足以支持', insufficient: '样本不足' };
const ALT_ZH = { greater: '更高', less: '更低', 'two-sided': '不同' };

function reportText(cert){
	const L = [];
	L.push(`命题验证报告${cert.title ? ` · ${cert.title}` : ''}`);
	L.push(`命例 ${cert.cases.count} 例(${cert.cases.source});钉住的时刻 ${cert.claim.clock.now}(${cert.claim.clock.tz});技法 ${cert.claim.techniques.join('、')}`);
	const failed = Object.keys(cert.run.cells).filter((t)=>cert.run.cells[t].failed);
	if(cert.run.inputErrors || cert.run.missing || failed.length){
		L.push(`起盘:输入有问题的 ${cert.run.inputErrors} 例,没有结果的 ${cert.run.missing} 例${failed.length ? `;没起出来的格:${failed.map((t)=>`${t} ${cert.run.cells[t].failed}`).join('、')}` : ''}(这些例在用到该技法的命题里记作「不知道」)`);
	}
	const cut = Object.keys(cert.run.cells).filter((t)=>cert.run.cells[t].truncated);
	if(cut.length){
		L.push(`正文超过上限被截断的格:${cut.map((t)=>`${t} ${cert.run.cells[t].truncated}`).join('、')}(这些格里没找到的内容记作「不知道」—— 可能在被裁掉的部分里;在命题文件写 "sections" 只取要用的段可避免)`);
	}
	if(Array.isArray(cert.definitions) && cert.definitions.length){
		L.push('');
		L.push('判据(在全部命例上):');
		cert.definitions.forEach((d)=>{
			const odd = d.yes === 0 ? '  ← 没有一例满足:检查写法(正则 / 段名 / 列名)' : (d.no === 0 && d.unknown === 0 ? '  ← 每一例都满足:检查写法' : '');
			L.push(`  ${d.name}:是 ${d.yes} · 否 ${d.no}${d.unknown ? ` · 不知道 ${d.unknown}` : ''}${odd}`);
		});
	}
	L.push('');
	cert.statements.forEach((s, i)=>{
		L.push(`${i + 1}. [${VERDICT_ZH[s.verdict]}] ${s.id}${s.title ? ` · ${s.title}` : ''}`);
		const pop = `人群 ${s.population} 例${s.whereUnknown ? `(另有 ${s.whereUnknown} 例圈不出来)` : ''}${s.unknown ? `,其中 ${s.unknown} 例判不出来、不计` : ''}`;
		if(s.kind === 'implication'){
			L.push(`   凡满足前件的例都满足后件:${pop};满足前件的 ${s.support} 例,反例 ${s.counterexamples} 例`);
			if(s.counterexamples){ L.push(`   反例:${s.counterexampleKeys.join('、')}${s.counterexamples > s.counterexampleKeys.length ? ` …(共 ${s.counterexamples} 例)` : ''}`); }
			if(s.verdict === 'insufficient'){ L.push(`   没有反例,但满足前件的例少于 ${s.params.minSupport} 例`); }
		}else if(s.kind === 'association'){
			const t = s.table;
			L.push(`   有特征的例里该结论的比例${ALT_ZH[s.params.alternative]}:${pop};计入 ${s.n} 例`);
			L.push(`   四格表:有特征且是 ${t.featureAndLabel} · 有特征不是 ${t.featureOnly} · 无特征但是 ${t.labelOnly} · 都不是 ${t.neither}`);
			L.push(`   比例:有特征 ${s.rateWithFeature} · 无特征 ${s.rateWithoutFeature} · 总体 ${s.baseRate};提升 ${s.lift},比值比 ${s.oddsRatio}`);
			if(s.verdict === 'insufficient'){ L.push(`   样本不足(要至少 ${s.params.minCases} 例、有特征且是的至少 ${s.params.minSupport} 例,且四个边际都不为零)`); }
			else{ L.push(`   费希尔精确检验 p = ${s.p};门槛 ${s.threshold}(alpha ${s.params.alpha}${cert.claim.correction !== 'none' ? `,${cert.claim.correction} 校正` : ''})${s.liftOk === false ? `;提升没达到 ${s.params.minLift}` : ''}`); }
		}else{
			L.push(`   满足特征的比例与 ${s.p0} ${ALT_ZH[s.params.alternative]}:${pop};计入 ${s.n} 例,满足 ${s.hits} 例,比例 ${s.rate}`);
			if(s.verdict === 'insufficient'){ L.push(`   样本不足(要至少 ${s.params.minCases} 例)`); }
			else{ L.push(`   二项精确检验 p = ${s.p};门槛 ${s.threshold}(alpha ${s.params.alpha}${cert.claim.correction !== 'none' ? `,${cert.claim.correction} 校正` : ''})`); }
		}
	});
	L.push('');
	L.push(`裁决:${cert.verdict === 'holds' ? '全部命题成立' : '有命题没有成立'}`);
	L.push(`指纹:命题 ${cert.fingerprints.claim.slice(0, 16)} · 命例 ${cert.fingerprints.cases.slice(0, 16)} · 起盘结果 ${cert.fingerprints.results.slice(0, 16)} · 判定 ${cert.fingerprints.statements.slice(0, 16)}`);
	L.push(`引擎:星阙 ${cert.engine.version}(${cert.engine.platform} ${cert.engine.arch},Node ${cert.engine.node})`);
	return `${L.join('\n')}\n`;
}

// ───────────────────────── 主流程 ─────────────────────────

// 跑一遍:命题 → 清单 → 起盘 → 判定 → 凭据(不写凭据文件;调用方决定)
async function runClaim(loaded, o, io, outDir, casesFileOverride){
	const { claim, techniques, compiled, title } = loaded;
	fs.mkdirSync(outDir, { recursive: true });
	// ① 命例清单
	let list; let source; let caseFile = null; let caseFileSha = null;
	if(claim.cases.file !== undefined){
		caseFile = casesFileOverride || path.resolve(loaded.baseDir, claim.cases.file);
		list = await casesFromFile(claim.cases, caseFile);
		caseFileSha = K.sha256(fs.readFileSync(caseFile));
		source = `文件 ${path.basename(caseFile)}`;
	}else{
		list = await casesFromCelebrities(claim.cases);
		source = `内置名人库${claim.cases.celebrities.rodden ? ` · 评级 ${claim.cases.celebrities.rodden.join('/')}` : ''}${claim.cases.celebrities.withTime ? ' · 有出生时刻' : ''}`;
	}
	if(!list.length){ throw new UsageError('命例清单是空的(检查 cases 的 offset / limit 与筛选)'); }
	const fpCases = casesFingerprint(list);
	const fpClaim = K.fingerprint(claim);
	const casesOut = path.join(outDir, 'cases.jsonl');
	const resultsOut = path.join(outDir, 'results.jsonl');
	const stampFile = path.join(outDir, 'results.stamp.json');
	// ② 起盘:同一份命题、同一批命例已有结果且 --reuse → 直接用
	// 戳只记与起盘有关的:命例、技法、钉住的时刻、设置覆盖、取哪几段、引擎版本(只改门槛 / 判据不必重跑;升级后的引擎不沿用旧结果)
	const engineVersion = require('./server').appVersion();
	const stamp = { cases: fpCases, kind: claim.cases.kind || 'natal', techniques, clock: claim.clock, options: claim.options, sections: claim.sections || null, engine: engineVersion };
	let reused = false;
	if(o.reuse && fs.existsSync(resultsOut) && fs.existsSync(stampFile)){
		try{ reused = K.canonical(JSON.parse(fs.readFileSync(stampFile, 'utf8'))) === K.canonical(stamp); }catch(e){ reused = false; }
	}
	if(!reused){
		writeCasesFile(casesOut, list, claim.cases.celebrities !== undefined);
		try{ fs.unlinkSync(stampFile); }catch(e){ /* 没有旧戳 */ }
		// --no-settings:不带本机存的技法设置 —— 口径只能来自命题文件的 options(写明、进指纹),换一台机器 / 换一个数据目录结果不变
		const args = [casesOut, '--format', 'jsonl', '-t', techniques.join(','), '-o', resultsOut, '--overwrite', '--split-sections', '--no-progress', '--no-settings',
			'--now', claim.clock.now, '--tz', claim.clock.tz, ...(claim.cases.kind === 'timepoint' ? ['--kind', 'timepoint'] : []), ...o.pass];
		if(claim.cases.map && Object.keys(claim.cases.map).length){ args.push('--map', Object.keys(claim.cases.map).map((f)=>`${f}=${claim.cases.map[f]}`).join(',')); }
		if(claim.sections){
			const secFile = path.join(outDir, 'sections.json');
			fs.writeFileSync(secFile, `${JSON.stringify(claim.sections)}\n`);
			args.push('--sections', `@${secFile}`);
		}
		if(Object.keys(claim.options).length){
			const optFile = path.join(outDir, 'options.json');
			fs.writeFileSync(optFile, `${JSON.stringify(claim.options)}\n`);
			args.push('--options', `@${optFile}`);
		}
		const r = await runBatch(args, io);
		if(r.code === 130){ throw new RunError(EXIT.INTERRUPTED, '已中断'); }
		if(r.code === 3){ throw new RunError(EXIT.NOT_RUNNING, '本机计算服务没开(起服务:./horosa start,或 bash scripts/linux/backends.sh start)'); }
		if(r.code !== 0 && r.code !== 1){ throw new RunError(r.code === 2 ? EXIT.USAGE : EXIT.FAILED, `起盘这一步没跑成(批量验证退出码 ${r.code})`); }
		fs.writeFileSync(stampFile, `${JSON.stringify(stamp)}\n`);
	}
	// ③ 判定
	const stats = readResults(resultsOut, list, techniques, compiled);
	const fpResults = resultsFingerprint(list, techniques);
	const statements = K.evaluateClaim(compiled, list);
	const definitions = K.countDefinitions(compiled, list);
	const verdict = statements.every((s)=>s.verdict === 'holds') ? 'holds' : 'not_all_hold';
	const cert = {
		format: FORMAT,
		title,
		claim,
		cases: { count: list.length, source, file: caseFile ? path.basename(caseFile) : null, fileSha256: caseFileSha },   // 只记文件名:凭据是要交给别人复核的,不带本机路径
		run: { reused, inputErrors: stats.inputErrors, missing: stats.missing, cells: stats.cellStats },
		definitions,
		statements,
		verdict,
		fingerprints: { claim: fpClaim, cases: fpCases, results: fpResults, definitions: K.fingerprint(definitions), statements: K.fingerprint(statements), resultsByTechnique: resultsByTechnique(list, techniques) },
		engine: { version: engineVersion, node: process.versions.node, platform: process.platform, arch: process.arch },
	};
	return cert;
}

async function cmdVerify(o, io){
	const claimFile = path.resolve(o.claim);
	if(!fs.existsSync(claimFile)){ throw new UsageError(`命题文件不存在:${o.claim}`); }
	let raw;
	try{ raw = JSON.parse(fs.readFileSync(claimFile, 'utf8')); }catch(e){ throw new UsageError(`命题文件不是合法 JSON:${e.message}`); }
	const loaded = loadClaim(raw, path.dirname(claimFile));
	const outDir = path.resolve(o.out || `${claimFile.replace(/\.json$/i, '')}.verify`);
	const cert = await runClaim(loaded, o, io, outDir);
	const certFile = path.join(outDir, 'certificate.json');
	fs.writeFileSync(certFile, `${JSON.stringify(cert, null, 1)}\n`);
	const report = reportText(cert);
	fs.writeFileSync(path.join(outDir, 'report.txt'), report);
	if(o.json){ io.out(`${JSON.stringify(cert)}\n`); }else{ io.out(report); io.out(`凭据:${certFile}\n`); }
	return cert.verdict === 'holds' ? EXIT.OK : EXIT.NOT_HOLD;
}

// 凭据与重跑结果的比对(纯函数)。判定层 = 命题 + 命例清单 + 各条的计数 / 检验值 / 裁决;结果层 = 每例每技法的正文。
// 返回 { consistent, level, differing, differingTechniques, lines }:
//   level 'full' 四层都对得上 · 'statements' 判定层一致、正文有不同 · 'none' 判定层不一致。
//   缺省判定层一致即算一致;strict 时要 'full'。
function compareCertificates(cert, again, opts){
	const strict = !!(opts && opts.strict);
	const differing = [];
	if(again.fingerprints.claim !== cert.fingerprints.claim){ differing.push('命题'); }
	[['cases', '命例清单'], ['results', '起盘结果'], ['definitions', '判据计数'], ['statements', '判定(计数 / 检验值 / 裁决)']].forEach(([k, name])=>{
		if(cert.fingerprints[k] === undefined && k === 'definitions'){ return; }   // 早先的凭据没有这一层
		if(again.fingerprints[k] !== cert.fingerprints[k]){ differing.push(name); }
	});
	const judged = differing.filter((x)=>x !== '起盘结果');
	const resultsDiffer = differing.indexOf('起盘结果') >= 0;
	const level = judged.length ? 'none' : (resultsDiffer ? 'statements' : 'full');
	const was = cert.fingerprints.resultsByTechnique || {}; const now = again.fingerprints.resultsByTechnique || {};
	const differingTechniques = resultsDiffer ? Object.keys(now).filter((t)=>was[t] !== undefined && was[t] !== now[t]).sort() : [];
	const env = `凭据:星阙 ${cert.engine.version} · ${cert.engine.platform} ${cert.engine.arch};这里:星阙 ${again.engine.version} · ${again.engine.platform} ${again.engine.arch}`;
	const verdictText = again.verdict === 'holds' ? '全部命题成立' : '有命题没有成立';
	const lines = [];
	if(level === 'full'){
		lines.push(`复核一致:命题、命例清单、起盘结果、判据计数、判定各层指纹都对得上;裁决 ${verdictText}。`);
	}else if(level === 'statements'){
		lines.push(`${strict ? '复核不一致(--strict)' : '复核一致(判定层)'}:命题、命例清单、判据计数、各条的计数 / 检验值 / 裁决都对得上;裁决 ${verdictText}。`);
		lines.push(`  起盘结果的正文与凭据不全相同${differingTechniques.length ? `(技法:${differingTechniques.join('、')})` : ''} —— 判据没有因此变。`);
		lines.push(`  ${env}。换一种处理器 / 数学库时个别末位取整会不同(秒、小数末位);同一种环境下应当逐字相同。`);
		if(!strict){ lines.push('  要把正文也逐字核对,加 --strict。'); }
	}else{
		lines.push(`复核不一致:${differing.join('、')}对不上。`);
		if(differing.indexOf('命例清单') >= 0){ lines.push('  命例清单不同:命例文件或名人库与出凭据时不是同一份。'); }
		else if(resultsDiffer){ lines.push(`  命例相同而起盘结果不同${differingTechniques.length ? `(技法:${differingTechniques.join('、')})` : ''}:引擎版本或运行环境不同(${env})。`); }
		const prev = new Map((cert.statements || []).map((x)=>[x.id, x.verdict]));
		again.statements.forEach((x)=>{ if(prev.get(x.id) !== x.verdict){ lines.push(`  命题 ${x.id}:凭据里是「${VERDICT_ZH[prev.get(x.id)] || prev.get(x.id)}」,这里是「${VERDICT_ZH[x.verdict]}」`); } });
		if(again.statements.every((x)=>prev.get(x.id) === x.verdict)){ lines.push('  各条命题的裁决与凭据相同(差在计数或检验值的细处)。'); }
	}
	return { consistent: level === 'full' || (level === 'statements' && !strict), level, differing, differingTechniques, lines };
}

// 照凭据重跑一遍,逐层核对:命题、命例、起盘结果、判定
async function cmdCheck(o, io){
	const certFile = path.resolve(o.check);
	if(!fs.existsSync(certFile)){ throw new UsageError(`凭据文件不存在:${o.check}`); }
	let cert;
	try{ cert = JSON.parse(fs.readFileSync(certFile, 'utf8')); }catch(e){ throw new UsageError(`凭据文件不是合法 JSON:${e.message}`); }
	if(!cert || cert.format !== FORMAT || !cert.claim || !cert.fingerprints){ throw new UsageError(`这不是一份星阙命题验证凭据(format 应为 ${FORMAT})`); }
	if(K.fingerprint(cert.claim) !== cert.fingerprints.claim){ throw new UsageError('凭据里的命题与它记下的命题指纹对不上(凭据被改过)'); }
	if(!Array.isArray(cert.statements) || K.fingerprint(cert.statements) !== cert.fingerprints.statements){ throw new UsageError('凭据里的判定内容(计数 / 检验值 / 裁决)与它记下的指纹对不上(凭据被改过)'); }
	if(cert.fingerprints.definitions !== undefined && K.fingerprint(cert.definitions) !== cert.fingerprints.definitions){ throw new UsageError('凭据里的判据计数与它记下的指纹对不上(凭据被改过)'); }
	const loaded = loadClaim({ ...cert.claim, clock: { now: cert.claim.clock.now, tz: cert.claim.clock.tz }, title: cert.title }, path.dirname(certFile));
	let override = null;
	if(cert.claim.cases.file !== undefined){
		// 命例文件按命题里写的相对路径找:凭据旁边、凭据目录的上一级(缺省布局:凭据在命题文件旁的 <名字>.verify/ 里,命例相对命题文件);
		//   早先的凭据记的是绝对路径,原处还在就用
		const certDir = path.dirname(certFile);
		const candidates = o.cases ? [path.resolve(o.cases)] : [path.resolve(certDir, cert.claim.cases.file), path.resolve(certDir, '..', cert.claim.cases.file),
			...(cert.cases.file && path.isAbsolute(cert.cases.file) ? [cert.cases.file] : [])];
		override = candidates.find((f)=>fs.existsSync(f)) || null;
		if(!override){ throw new UsageError(`找不到凭据里记的命例文件(${cert.claim.cases.file});用 --cases 另指一份`); }
	}
	const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'horosa-verify-check-'));
	try{
		const again = await runClaim(loaded, { ...o, reuse: false }, io, outDir, override);
		const res = compareCertificates(cert, again, { strict: o.strict });
		if(o.json){ io.out(`${JSON.stringify({ consistent: res.consistent, level: res.level, differing: res.differing, differingTechniques: res.differingTechniques, certificate: cert.fingerprints, recomputed: again.fingerprints, verdict: again.verdict })}\n`); }
		else{ io.out(`${res.lines.join('\n')}\n`); }
		return res.consistent ? EXIT.OK : EXIT.NOT_HOLD;
	}finally{ try{ fs.rmSync(outDir, { recursive: true, force: true }); }catch(e){ /* 临时目录:删不掉留给系统清 */ } }
}

async function main(argv, ioIn){
	const io = ioIn || { out: (s)=>process.stdout.write(s), err: (s)=>process.stderr.write(s) };
	let o;
	try{ o = parseArgs(argv); }catch(e){ io.err(`horosa verify: ${e.message}\n`); return e.exitCode || EXIT.USAGE; }
	if(o.help){ io.out(usage()); return EXIT.OK; }
	if(o.explain){ io.out(explain()); return EXIT.OK; }
	try{
		return o.check ? await cmdCheck(o, io) : await cmdVerify(o, io);
	}catch(e){
		if(e instanceof UsageError || e instanceof RunError){ io.err(`horosa verify: ${e.message}\n`); return e.exitCode; }
		if(e instanceof K.VerifyError){ io.err(`horosa verify: ${e.message}\n`); return EXIT.USAGE; }
		if(e && e.exitCode){ io.err(`horosa verify: ${e.message}\n`); return e.exitCode; }
		io.err(`horosa verify: ${e && e.stack ? e.stack : e}\n`);
		return EXIT.FAILED;
	}
}

module.exports = { main, usage, explain, parseArgs, loadClaim, casesFromFile, casesFromCelebrities, casesFingerprint, resultsFingerprint, resultsByTechnique, compareCertificates, reportText, runClaim, EXIT, FORMAT };

if(require.main === module){
	main(process.argv.slice(2)).then((code)=>require('./exit').exitAfterFlush(code)).catch((e)=>{ process.stderr.write(`horosa verify: ${e && e.stack ? e.stack : e}\n`); process.exit(EXIT.FAILED); });
}
