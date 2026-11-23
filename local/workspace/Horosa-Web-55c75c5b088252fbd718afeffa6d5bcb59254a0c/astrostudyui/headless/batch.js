#!/usr/bin/env node
// 批量验证:./horosa batch <命例文件> --techniques … —— 一批出生资料(CSV / JSONL / JSON,或内置名人库)逐例逐技法起盘,结果一行一例写成 JSONL + 汇总。
// 不另写引擎:每例每技法就是一次 cast_technique(工具注册表 runTool,与 ./horosa call cast_technique / MCP / REST 执行同一个函数、同一份设置),
//   回包里的 data 原样落盘(= 单例调用 --json 时的 structuredContent)。
// 进程:本进程只读输入、分派、写输出;起盘在 N 个子进程(各自一份无头运行时)里做。子进程的数据目录 = 开跑那一刻本机无头数据目录里
//   本机存储(localStorage.json:技法设置、新盘缺省等)的拷贝,放在临时目录里 —— 批量不写你的数据目录,跑的过程中改设置也不影响这一批。
// 规模:输入流式读、结果逐行追加并定期 fsync,内存与命例数无关;断点续跑按键(id 列,没有就用行号)跳过已算完的;单例失败只落一行错误、不中断整批。
// 退出码:0 全部成功 · 1 跑完但有失败行 · 2 用法错 · 3 本机计算服务没开 · 5 其它失败 · 130 Ctrl-C(已写的行都在,--resume 接着跑)。
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const readline = require('readline');
const { fork } = require('child_process');

const EXIT = { OK: 0, ROW_FAILURES: 1, USAGE: 2, NOT_RUNNING: 3, FAILED: 5, INTERRUPTED: 130 };
const TOOL = 'cast_technique';
const MAX_CHARS_CAP = 60000;   // 与 cast_technique 的 maxChars 上限同值(批量缺省取上限:要全文,不要对话里那份 7000 字的截断)
const PROBE_CASE = { kind: 'natal', birth: '2000-01-01 12:00', zone: '+08:00', gpsLat: 39.9, gpsLon: 116.4, gender: 'male', name: '探针' };
// 按起课时间起盘(--kind timepoint)时的探针例:同一刻、同一地,只是当作起课时间
const PROBE_TIMEPOINT = { kind: 'timepoint', divTime: '2000-01-01 12:00', zone: '+08:00', gpsLat: 39.9, gpsLon: 116.4, gender: 'male', name: '探针' };
const KINDS = ['natal', 'timepoint'];
// 输入列名 → 字段(不分大小写;同一字段按表里的先后取第一个出现的列;--map 字段=列名 覆盖)。
// 兼容名人库导出 / 命盘记录的键(birth · zone · gpsLat / gpsLon · lat / lon 罗盘串 · gender 1/0/-1 · name · pos · cid)
const FIELD_ALIASES = {
	id: ['id', 'cid', 'key', 'uid', '编号', '序号'],
	name: ['name', 'title', 'name_zh', '姓名', '名字', '名称'],
	birth: ['birth', 'birth_chart', 'birthtime', 'birth_datetime', 'datetime', 'date_time', '出生时间', '生辰', '出生日期时间', 'divTime', 'div_time', 'moment', '起课时间', '起卦时间'],
	date: ['date', 'birth_date', 'birthdate', 'dob', '出生日期', '日期'],
	time: ['time', 'birth_time', 'tob', '出生时刻', '时刻', '时间'],
	zone: ['zone', 'tz', 'timezone', 'time_zone', 'utc_offset', 'offset', '时区'],
	lat: ['gpsLat', 'latitude', 'lat', '纬度'],
	lon: ['gpsLon', 'longitude', 'lon', 'lng', 'long', '经度'],
	gender: ['gender', 'sex', '性别'],
	place: ['place', 'birthplace', 'birth_place', 'pos', 'city', '出生地', '地点'],
	calendar: ['calendar', '历法'],
};
const FIELDS = Object.keys(FIELD_ALIASES);
// 每技法时限的缺省值;调大它时单次请求的等待随之放宽(按与缺省值的比例)
const DEFAULT_TIMEOUT_MS = 120000;

class BatchError extends Error{ constructor(code, message){ super(message); this.exitCode = code; } }

// ───────────────────────── 参数 ─────────────────────────

function usage(){
	return [
		'星阙批量验证:一批命例 × 一组技法,逐例起盘,结果一行一例写成 JSONL(与单例 ./horosa call cast_technique 同一引擎、同一份设置)',
		'',
		'用法: ./horosa batch <命例文件 | -> --techniques <技法,…|all> [选项]',
		'      ./horosa batch --celebrities --techniques <…> [--rodden AA,A] [--with-time] [选项]',
		'      ./horosa batch --list-techniques',
		'      ./horosa batch-pack [输出.tar.gz] [--no-java] [--no-celebrities]   打一个只要 Node + Python(+ Java)就能跑的批量运行包(Linux 服务器用)',
		'',
		'输入:',
		'  <文件>                      .csv / .tsv / .jsonl / .json(数组);- = 标准输入(首字符 { 按 JSONL,[ 按 JSON,否则按 CSV)',
		'  --format csv|jsonl|json     不按扩展名猜',
		'  --delimiter ,|tab|;         CSV 分隔符(缺省按表头行猜)',
		'  --map 字段=列名[,…]          列名对应(字段:id name birth date time zone lat lon gender place calendar);缺省认常见列名(见文档)',
		'  --celebrities               输入 = 内置名人库(约 5.9 万例,Astro-Databank AA / A 级;时区按库里原值,含地方平时的秒)',
		'  --rodden AA,A · --with-time 名人库筛选:Rodden 评级 / 只要有出生时刻的',
		'  --offset N · --limit N      跳过前 N 例 / 只跑 N 例',
		'  --kind natal|timepoint      每一行是什么:natal(缺省)= 一个人的出生资料,起命盘类技法;timepoint = 一个起课时间(+ 地点),',
		'                              起按时间起盘的技法(六壬 / 奇门 / 太乙 / 金口诀 / 三式合一 / 卜卦盘 / 世俗盘 / 黄历 / 节气 …;--kind timepoint --list-techniques 看全部)。',
		'                              列名照旧(时间列认 birth / datetime / date + time 等)。要用户亲手摇出结果的(六爻铜钱、塔罗、灵棋)不在内:不能凭时间代起',
		'',
		'技法与设置:',
		'  -t, --techniques a,b|all    技法键(./horosa batch --list-techniques 看全部;all = 这一种来源下全部起得出来的)',
		'  --options JSON|@文件         各技法的设置覆盖 {"技法": {键: 值}};键 / 值域同 describe_settings(facet=mount),与单例 options 同义',
		'  --sections JSON|@文件        各技法只取哪几段 {"技法": ["段名", …]}(与单例 sections 同义;全部技法全文每例约 0.6 MB,6 万例要几十 GB)',
		'  --max-chars N               每技法正文上限(缺省 60000 = 单例的上限;超出照单例口径截断并标 truncated)',
		'  --split-sections            另附按段切开的正文(sections: [{title, text}])',
		'',
		'输出与运行:',
		'  -o, --out 文件.jsonl         结果(缺省 horosa-batch-<时刻>.jsonl);汇总写 <输出>.summary.json,子进程日志写 <输出>.log',
		'  --resume                    断点续跑:输出里已有的例跳过(技法齐全才算);--retry-failed 连失败的一起重算',
		'  --overwrite                 输出已存在时覆盖',
		'  -j, --concurrency N         并行子进程数(缺省 = 2 × 计算服务套数;每个约 0.5 GB 内存)',
		'  --backends J:P[,J:P…]       多套本机计算服务(Java端口:Python端口),子进程轮流分到各套;一个 Python 排盘服务只吃满一个核,',
		'                              多起几套才快(bash scripts/linux/backends.sh start --pairs N 会打印这一串)',
		'  --timeout 秒                单技法起盘上限(缺省 120,最多 3600);很慢的机器上调大它,单次请求的等待按同一比例放宽',
		'  --recycle N                 每个子进程跑 N 例后换新(缺省 2000;防长跑内存爬升)',
		'  --now 时刻                  钉住「此刻」:各技法取当前时刻的地方(导出时刻、推运类缺省的目标时刻、今年 / 今日)一律按它算,',
		'                              同一批命例在任何机器、任何时候重跑都得到逐字相同的结果。写法 2030-06-01 12:00[:00](按 --tz 的时区读),',
		'                              或带偏移的 2030-06-01T12:00:00+08:00 / …Z。不给 = 用真实的当前时刻(结果随跑的那一分钟变)',
		'  --tz 时区                   子进程的时区(IANA 名,如 Asia/Shanghai、UTC):正文里的时刻按它显示。给了 --now 时缺省 Asia/Shanghai,',
		'                              否则缺省跟本机',
		'  --python-only               只用 Python 排盘服务(不连 Java 后端;Java 没开时自动进入):要 Java 的技法 all 时略过、明点的开跑前就停',
		'  --no-settings               不带本机存的技法设置:各技法按出厂缺省起,口径只认 --options(换一台机器 / 换一个数据目录结果不变;命题验证恒用它)',
		'  --no-probe                  不先用探针例试跑(缺省先试:all 里略过不能按出生资料起盘的技法,明点的技法起不出来就直接停)',
		'  --progress / --no-progress  进度(缺省:标准错误是终端才显示)',
		'',
		'退出码: 0 全部成功 · 1 跑完但有失败行 · 2 用法错 · 3 本机计算服务没开 · 5 其它失败 · 130 Ctrl-C(--resume 接着跑)',
	].join('\n') + '\n';
}

function parseBatchArgs(argv){
	const o = { input: null, format: null, delimiter: null, map: {}, celebrities: false, rodden: null, withTime: false, offset: 0, limit: null,
		techniques: null, options: {}, sections: null, maxChars: MAX_CHARS_CAP, splitSections: false, out: null, resume: false, retryFailed: false, overwrite: false,
		concurrency: null, backendPairs: null, timeoutSec: DEFAULT_TIMEOUT_MS / 1000, recycle: 2000, pythonOnly: false, probe: true, progress: null, list: false, help: false, now: null, tz: null, kind: 'natal' };
	const a = argv.slice();
	const val = (i, name)=>{ if(i + 1 >= a.length){ throw new BatchError(EXIT.USAGE, `${name} 后面要跟一个值`); } return a[i + 1]; };
	const posInt = (v, name, min, max)=>{ const n = Number(v); if(!Number.isInteger(n) || n < min || n > max){ throw new BatchError(EXIT.USAGE, `${name} 要 ${min}..${max} 的整数`); } return n; };
	for(let i = 0; i < a.length; i++){
		let k = a[i];
		const eq = /^(--[a-z-]+)=(.*)$/s.exec(k);
		if(eq){ a.splice(i, 1, eq[1], eq[2]); k = eq[1]; }
		switch(k){
		case '-h': case '--help': o.help = true; break;
		case '--list-techniques': o.list = true; break;
		case '--kind': { const v = `${val(i, k)}`.trim().toLowerCase(); if(KINDS.indexOf(v) < 0){ throw new BatchError(EXIT.USAGE, `--kind 只认 ${KINDS.join(' / ')}(这里是「${v}」)`); } o.kind = v; i++; break; }
		case '--format': o.format = `${val(i, k)}`.toLowerCase(); i++; if(['csv', 'tsv', 'jsonl', 'json'].indexOf(o.format) < 0){ throw new BatchError(EXIT.USAGE, '--format 只能是 csv / tsv / jsonl / json'); } break;
		case '--delimiter': { const d = val(i, k); i++; o.delimiter = d === 'tab' || d === '\\t' ? '\t' : d; if(o.delimiter.length !== 1){ throw new BatchError(EXIT.USAGE, '--delimiter 要一个字符(或 tab)'); } break; }
		case '--map': {
			const s = val(i, k); i++;
			s.split(',').map((x)=>x.trim()).filter(Boolean).forEach((pair)=>{
				const j = pair.indexOf('=');
				const f = j > 0 ? pair.slice(0, j).trim() : '';
				if(FIELDS.indexOf(f) < 0){ throw new BatchError(EXIT.USAGE, `--map 的字段「${f || pair}」不认识(只认 ${FIELDS.join(' / ')})`); }
				o.map[f] = pair.slice(j + 1).trim();
			});
			break;
		}
		case '--celebrities': o.celebrities = true; break;
		case '--rodden': o.rodden = `${val(i, k)}`.split(',').map((x)=>x.trim().toUpperCase()).filter(Boolean); i++; break;
		case '--with-time': o.withTime = true; break;
		case '--offset': o.offset = posInt(val(i, k), k, 0, 1e9); i++; break;
		case '--limit': o.limit = posInt(val(i, k), k, 1, 1e9); i++; break;
		case '-t': case '--techniques': o.techniques = `${val(i, k)}`.split(',').map((x)=>x.trim()).filter(Boolean); i++; break;
		case '--options': {
			const s = val(i, k); i++;
			let text = s;
			if(s.startsWith('@')){ try{ text = fs.readFileSync(s.slice(1), 'utf8'); }catch(e){ throw new BatchError(EXIT.USAGE, `--options 文件读不了:${e.message}`); } }
			let v;
			try{ v = JSON.parse(text); }catch(e){ throw new BatchError(EXIT.USAGE, `--options 不是合法 JSON:${e.message}`); }
			if(!v || typeof v !== 'object' || Array.isArray(v) || Object.values(v).some((x)=>!x || typeof x !== 'object' || Array.isArray(x))){
				throw new BatchError(EXIT.USAGE, '--options 要写成 {"技法": {键: 值}}');
			}
			o.options = v;
			break;
		}
		case '--sections': {
			const s = val(i, k); i++;
			let text = s;
			if(s.startsWith('@')){ try{ text = fs.readFileSync(s.slice(1), 'utf8'); }catch(e){ throw new BatchError(EXIT.USAGE, `--sections 文件读不了:${e.message}`); } }
			let v;
			try{ v = JSON.parse(text); }catch(e){ throw new BatchError(EXIT.USAGE, `--sections 不是合法 JSON:${e.message}`); }
			const okShape = v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every((x)=>Array.isArray(x) && x.length >= 1 && x.length <= 12 && x.every((y)=>typeof y === 'string' && y.trim()));
			if(!okShape){ throw new BatchError(EXIT.USAGE, '--sections 要写成 {"技法": ["段名", …]}(每技法 1–12 个段名,按段名子串匹配,与单例 sections 同义)'); }
			o.sections = v;
			break;
		}
		case '--max-chars': o.maxChars = posInt(val(i, k), k, 500, MAX_CHARS_CAP); i++; break;
		case '--split-sections': o.splitSections = true; break;
		case '-o': case '--out': o.out = val(i, k); i++; break;
		case '--resume': o.resume = true; break;
		case '--retry-failed': o.resume = true; o.retryFailed = true; break;
		case '--overwrite': o.overwrite = true; break;
		case '-j': case '--concurrency': o.concurrency = posInt(val(i, k), k, 1, 64); i++; break;
		case '--timeout': o.timeoutSec = posInt(val(i, k), k, 5, 3600); i++; break;
		case '--recycle': o.recycle = posInt(val(i, k), k, 1, 1e9); i++; break;
		case '--python-only': o.pythonOnly = true; break;
		case '--now': o.now = `${val(i, k)}`.trim(); i++; break;
		case '--tz': o.tz = `${val(i, k)}`.trim(); i++; break;
		case '--backends': {
			const { parsePort } = require('./ports');
			const spec = `${val(i, k)}`; i++;
			try{
				o.backendPairs = spec.split(',').map((x)=>x.trim()).filter(Boolean).map((pair)=>{
					const m = /^(\d+):(\d+)$/.exec(pair);
					if(!m){ throw new Error(`「${pair}」不是 Java端口:Python端口`); }
					return { server: parsePort(m[1], 'Java 端口'), chart: parsePort(m[2], 'Python 端口') };
				});
			}catch(e){ throw new BatchError(EXIT.USAGE, `--backends ${spec}:${e.message}(写成 9999:8899,10000:8900)`); }
			if(!o.backendPairs.length){ throw new BatchError(EXIT.USAGE, '--backends 至少要一套 Java端口:Python端口'); }
			break;
		}
		case '--no-probe': o.probe = false; break;
		case '--no-settings': o.noSettings = true; break;
		case '--progress': o.progress = true; break;
		case '--no-progress': case '--quiet': case '-q': o.progress = false; break;
		default:
			if(k.startsWith('-') && k !== '-'){ throw new BatchError(EXIT.USAGE, `不认识的选项 ${k}(./horosa batch --help 看用法)`); }
			if(o.input !== null){ throw new BatchError(EXIT.USAGE, `只能给一个命例文件(多给了「${k}」)`); }
			o.input = k;
		}
	}
	if(o.help || o.list){ return o; }
	if(o.celebrities && o.input !== null){ throw new BatchError(EXIT.USAGE, '--celebrities 与命例文件只能二选一'); }
	if(o.celebrities && o.kind !== 'natal'){ throw new BatchError(EXIT.USAGE, '--celebrities(名人的出生资料)只能按 --kind natal 起盘'); }
	if(!o.celebrities && o.input === null){ throw new BatchError(EXIT.USAGE, '要给命例文件(或 - 读标准输入,或 --celebrities 用内置名人库)'); }
	if(!o.celebrities && (o.rodden || o.withTime)){ throw new BatchError(EXIT.USAGE, '--rodden / --with-time 只对 --celebrities 有用'); }
	if(!o.techniques || !o.techniques.length){ throw new BatchError(EXIT.USAGE, '要给 --techniques(技法键用逗号隔开,或 all;./horosa batch --list-techniques 看全部)'); }
	if(o.techniques.indexOf('all') >= 0 && o.techniques.length > 1){ throw new BatchError(EXIT.USAGE, '--techniques all 不与具体技法混写'); }
	if(new Set(o.techniques).size !== o.techniques.length){ throw new BatchError(EXIT.USAGE, '--techniques 里有重复的技法'); }
	o.clock = resolveClock(o.now, o.tz);
	return o;
}

// ───────────────────────── 钉住「此刻」与时区 ─────────────────────────
// 验证要能复现:同一批命例重跑,结果不该随「跑的那一分钟」「机器设的时区」而变。--now 把子进程里的时钟钉在一个时刻,
// --tz 把子进程的时区钉住(同一时刻在不同时区写出来的钟点不同)。两者都记进汇总,别人照着重跑。

// 某时区在某一时刻比 UTC 快多少毫秒(东为正)
function zoneOffsetMs(epochMs, tz){
	const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(epochMs));
	const v = {}; parts.forEach((x)=>{ v[x.type] = x.value; });
	const wall = Date.UTC(Number(v.year), Number(v.month) - 1, Number(v.day), Number(v.hour), Number(v.minute), Number(v.second));
	return wall - Math.floor(epochMs / 1000) * 1000;
}

// --now / --tz → { ms, iso, tz, given } 或 null(都没给)。只给 --tz = 只钉时区。
function resolveClock(now, tz){
	if(!now && !tz){ return null; }
	const zone = tz || (now ? 'Asia/Shanghai' : null);
	try{ new Intl.DateTimeFormat('en-US', { timeZone: zone }); }catch(e){ throw new BatchError(EXIT.USAGE, `--tz ${zone} 不是认得的时区名(写 IANA 名,如 Asia/Shanghai、America/New_York、UTC)`); }
	if(!now){ return { ms: null, iso: null, tz: zone, given: null }; }
	const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i.exec(now);   // 秒后可带毫秒(机器写出的 ISO 时刻),毫秒不计
	if(!m){ throw new BatchError(EXIT.USAGE, `--now ${now} 看不懂(写 2030-06-01 12:00 或 2030-06-01T12:00:00+08:00)`); }
	const [y, mo, d, h, mi, sec] = [m[1], m[2], m[3], m[4], m[5], m[6] || '0'].map(Number);
	const wall = Date.UTC(y, mo - 1, d, h, mi, sec);
	const back = new Date(wall);
	if(back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d || h > 23 || mi > 59 || sec > 59){ throw new BatchError(EXIT.USAGE, `--now ${now} 不是一个存在的时刻`); }
	let ms;
	if(m[7]){
		const z = m[7].toUpperCase();
		const off = z === 'Z' ? 0 : (z[0] === '-' ? -1 : 1) * (Number(z.slice(1, 3)) * 60 + Number(z.slice(-2))) * 60000;
		ms = wall - off;
	}else{
		// 没带偏移:按 --tz 的钟面读(夏令时切换处再校一次)
		ms = wall - zoneOffsetMs(wall, zone);
		ms = wall - zoneOffsetMs(ms, zone);
	}
	return { ms, iso: new Date(ms).toISOString(), tz: zone, given: now };
}

// 钉住的时刻随请求头带给计算服务(Java 后端把它放进发给排盘引擎的正文;直连排盘服务的接口直接读头)
function clockHeaders(clock){
	if(!clock || !Number.isFinite(clock.ms)){ return null; }
	const h = { 'X-Horosa-Now': `${Math.round(clock.ms)}` };
	if(clock.tz){ h['X-Horosa-Now-Offset'] = `${Math.round(zoneOffsetMs(clock.ms, clock.tz) / 60000)}`; }
	return h;
}

// 子进程里把时钟钉住:new Date() / Date.now() 回钉住的那一刻;带参数的 new Date(…)、Date.parse、Date.UTC 照常。
// 时间不是完全冻结:每过真实一秒只走一毫秒 —— 取到的「此刻」实际不变(到秒都相同),而时间仍单调前进,
// 代码里「等到某个时刻为止」的循环不会原地打转(整例另有父进程的硬超时兜底)。每一格起算前调 reset() 回到钉住的那一刻,
// 所以每一格看到的时刻与这个子进程先前算过多少例无关。
function installPinnedClock(ms){
	const RealDate = Date;
	// 走得多慢按单调钟量,不按系统时钟:系统时钟会被校时往回拨(虚拟机里常见),拨回去一点「此刻」就成了上一分钟的 59.999 秒
	const mono = ()=>Number(process.hrtime.bigint() / 1000000n);
	let anchor = mono();
	const nowMs = ()=>ms + Math.max(0, Math.floor((mono() - anchor) / 1000));
	function PinnedDate(...args){
		if(!new.target){ return new RealDate(nowMs()).toString(); }
		return args.length === 0 ? new RealDate(nowMs()) : new RealDate(...args);
	}
	PinnedDate.prototype = RealDate.prototype;
	Object.setPrototypeOf(PinnedDate, RealDate);
	PinnedDate.now = nowMs;
	PinnedDate.parse = RealDate.parse;
	PinnedDate.UTC = RealDate.UTC;
	globalThis.Date = PinnedDate;
	return { reset(){ anchor = mono(); }, real: ()=>RealDate.now() };
}

// ───────────────────────── 值归一(纯函数)─────────────────────────

const clipChars = (s, n)=>{ const a = Array.from(`${s}`); return a.length <= n ? a.join('') : a.slice(0, n).join(''); };
const blank = (v)=>v === undefined || v === null || `${v}`.trim() === '';

// 经纬度:十进制数(北 / 东为正)· 罗盘串 39n54 / 116e24 / 39n54:30 · 39°54'N / 116°24'30"E
function parseCoord(v, axis){
	if(blank(v)){ return undefined; }
	if(typeof v === 'number'){ return Number.isFinite(v) ? v : NaN; }
	const s = `${v}`.trim();
	if(/^[+-]?\d+(\.\d+)?$/.test(s)){ return Number(s); }
	let m = /^(\d{1,3})\s*([nsewNSEW])\s*(\d{1,2})(?:[:'′]?\s*(\d{1,2}(?:\.\d+)?))?$/.exec(s);
	let deg; let min; let sec; let hemi;
	if(m){ [, deg, hemi, min, sec] = m; }else{
		m = /^(\d{1,3}(?:\.\d+)?)\s*[°d]\s*(?:(\d{1,2}(?:\.\d+)?)\s*['′m]?)?\s*(?:(\d{1,2}(?:\.\d+)?)\s*["″s]?)?\s*([nsewNSEW])$/.exec(s);
		if(!m){ return NaN; }
		[, deg, min, sec, hemi] = m;
	}
	const h = hemi.toLowerCase();
	if((axis === 'lat' && 'ns'.indexOf(h) < 0) || (axis === 'lon' && 'ew'.indexOf(h) < 0)){ return NaN; }
	const x = Number(deg) + Number(min || 0) / 60 + Number(sec || 0) / 3600;
	return (h === 's' || h === 'w') ? -x : x;
}

// 时区:±HH:MM / ±HH:MM:SS 原样;8 · +8 · -5.5 · +0530 · UTC+8 · GMT-05:00 → ±HH:MM(秒不为零才带秒)
function parseZone(v){
	if(blank(v)){ return undefined; }
	const s0 = `${v}`.trim();
	if(/^[+-]\d{2}:\d{2}(:\d{2})?$/.test(s0)){ return s0; }
	const s = s0.replace(/^(utc|gmt)\s*/i, '');
	let sign = 1; let secs;
	let m = /^([+-])?(\d{1,2})(?::?(\d{2}))?(?::?(\d{2}))?$/.exec(s);
	if(m){
		sign = m[1] === '-' ? -1 : 1;
		secs = Number(m[2]) * 3600 + Number(m[3] || 0) * 60 + Number(m[4] || 0);
	}else{
		m = /^([+-])?(\d{1,2}(?:\.\d+)?)$/.exec(s);
		if(!m){ return null; }
		sign = m[1] === '-' ? -1 : 1;
		secs = Math.round(Number(m[2]) * 3600);
	}
	if(!(secs <= 18 * 3600)){ return null; }
	const hh = Math.floor(secs / 3600); const mm = Math.floor((secs % 3600) / 60); const ss = secs % 60;
	const p2 = (n)=>`${n}`.padStart(2, '0');
	return `${sign < 0 ? '-' : '+'}${p2(hh)}:${p2(mm)}${ss ? `:${p2(ss)}` : ''}`;
}

function parseGender(v){
	if(blank(v)){ return 'unknown'; }
	const s = `${v}`.trim().toLowerCase();
	if(['male', 'm', '男', '1', '乾', '乾造'].indexOf(s) >= 0){ return 'male'; }
	if(['female', 'f', '女', '0', '坤', '坤造'].indexOf(s) >= 0){ return 'female'; }
	return 'unknown';
}

// 表头 → 字段对应:--map 给的列名必须存在;其余按别名表取第一个出现的列。
// lenient(JSONL / JSON 第二行起每行重对):这一行缺 --map 指定的列不抛,记进 __missing 由这一行自己落坏行
function resolveColumns(headers, map, lenient){
	const lower = new Map();
	headers.forEach((h)=>{ const k = `${h}`.trim().toLowerCase(); if(k && !lower.has(k)){ lower.set(k, h); } });
	const cols = {};
	const missing = [];
	for(const f of FIELDS){
		if(map && map[f] !== undefined){
			const want = `${map[f]}`.trim().toLowerCase();
			if(!lower.has(want) && lenient){ missing.push(`${f}=${map[f]}`); continue; }
			if(!lower.has(want)){ throw new BatchError(EXIT.USAGE, `--map ${f}=${map[f]}:输入里没有这一列(有:${headers.slice(0, 30).join(', ')})`); }
			cols[f] = lower.get(want);
			continue;
		}
		const hit = FIELD_ALIASES[f].find((al)=>lower.has(al.toLowerCase()));
		if(hit){ cols[f] = lower.get(hit.toLowerCase()); }
	}
	// 「birth」列已带时刻时,date / time 列不用;没有 birth 才拼 date + time
	Object.defineProperty(cols, '__missing', { value: missing, enumerable: false });
	return cols;
}

// 一行输入 → { key, id, source } 或 { key, error }。source = cast_technique 的 natal 源(与单例同形);
// kind = 'timepoint' 时这一行是一个起课时间:同样的列,时间放进 divTime、源写成 timepoint
function rowToTask(row, cols, n, kind){
	const timepoint = kind === 'timepoint';
	const what = timepoint ? '起课时间' : '出生时间';
	const get = (f)=>(cols[f] !== undefined ? row[cols[f]] : undefined);
	const id = blank(get('id')) ? null : `${get('id')}`.trim();
	const key = id !== null ? id : `#${n}`;
	const fail = (message)=>({ key, id, n, error: { code: 'E_INPUT_INVALID', message } });
	let birth = blank(get('birth')) ? '' : `${get('birth')}`.trim();
	if(!birth){
		const d = blank(get('date')) ? '' : `${get('date')}`.trim();
		const t = blank(get('time')) ? '' : `${get('time')}`.trim();
		if(!d){ return fail(`没有${what}(birth 列,或 date + time 两列)`); }
		birth = t ? `${d} ${t}` : d;
	}
	if(Array.from(birth).length > 60){ return fail(`${what}太长(超过 60 字)`); }
	const source = timepoint ? { kind: 'timepoint', divTime: birth } : { kind: 'natal', birth };
	const cal = blank(get('calendar')) ? '' : `${get('calendar')}`.trim().toLowerCase();
	if(cal){
		if(['lunar', '农历', '阴历', '農曆', '陰曆'].indexOf(cal) >= 0){ source.calendar = 'lunar'; }
		else if(['solar', '公历', '阳历', '公曆', '陽曆', 'gregorian'].indexOf(cal) < 0){ return fail(`历法「${get('calendar')}」不认识(solar / lunar)`); }
	}
	const zone = parseZone(get('zone'));
	if(zone === null){ return fail(`时区「${get('zone')}」看不懂(写 +08:00 / -05:00 / +00:09:21 / 8 / UTC+8)`); }
	if(zone){ source.zone = zone; }
	const lat = parseCoord(get('lat'), 'lat');
	const lon = parseCoord(get('lon'), 'lon');
	if(lat !== undefined || lon !== undefined){
		if(!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180){
			return fail(`经纬度看不懂或越界(纬度「${get('lat')}」经度「${get('lon')}」;十进制北 / 东为正,或 39n54 / 116e24)`);
		}
		source.gpsLat = lat; source.gpsLon = lon;
		// 有坐标时地名只作显示(与命盘记录的 pos 同义,不再按地名查坐标)
		if(!blank(get('place'))){ source.pos = clipChars(`${get('place')}`.trim(), 80); }
	}else if(!blank(get('place'))){
		source.place = clipChars(`${get('place')}`.trim(), 80);
	}
	source.gender = parseGender(get('gender'));
	if(!blank(get('name'))){ source.name = clipChars(`${get('name')}`.trim(), 60); }
	return { key, id, n, source };
}

// ───────────────────────── 输入(流式)─────────────────────────

// RFC 4180:引号包字段、"" 转义、字段内可换行;去 BOM;CRLF / LF 都认。逐字符状态机,一次只攒一行
async function* csvRecords(stream, delimiter){
	let field = ''; let rec = []; let inQ = false; let afterQ = false; let started = false; let delim = delimiter;
	let headerProbe = '';
	const emitField = ()=>{ rec.push(field); field = ''; afterQ = false; };
	const out = [];
	const feed = (ch)=>{
		if(inQ){
			if(ch === '"'){ inQ = false; afterQ = true; }else{ field += ch; }
			return;
		}
		if(ch === '"'){
			if(afterQ){ field += '"'; inQ = true; afterQ = false; return; }   // "" → "
			if(field === ''){ inQ = true; return; }
			field += ch; return;
		}
		if(ch === delim){ emitField(); return; }
		if(ch === '\r'){ return; }
		if(ch === '\n'){ emitField(); out.push(rec); rec = []; return; }
		afterQ = false;
		field += ch;
	};
	for await (const chunk of stream){
		let s = `${chunk}`;
		if(!started){
			s = s.replace(/^﻿/, '');
			if(!delim){
				headerProbe += s;
				const nl = headerProbe.indexOf('\n');
				if(nl < 0 && headerProbe.length < 65536){ continue; }
				const head = nl < 0 ? headerProbe : headerProbe.slice(0, nl);
				const counts = [',', '\t', ';', '|'].map((d)=>[d, head.split(d).length - 1]).sort((x, y)=>y[1] - x[1]);
				delim = counts[0][1] > 0 ? counts[0][0] : ',';
				s = headerProbe; headerProbe = '';
			}
			started = true;
		}
		for(const ch of s){ feed(ch); }
		while(out.length){ yield out.shift(); }
	}
	if(!started && headerProbe){
		const counts = [',', '\t', ';', '|'].map((d)=>[d, headerProbe.split(d).length - 1]).sort((x, y)=>y[1] - x[1]);
		delim = counts[0][1] > 0 ? counts[0][0] : ',';
		for(const ch of headerProbe.replace(/^﻿/, '')){ feed(ch); }
	}
	if(field !== '' || rec.length){ emitField(); out.push(rec); }
	while(out.length){ yield out.shift(); }
}

// CSV → 对象行(表头为键);全空行跳过
async function* csvRows(stream, delimiter){
	let headers = null;
	for await (const rec of csvRecords(stream, delimiter)){
		if(rec.every((x)=>`${x}`.trim() === '')){ continue; }
		if(!headers){ headers = rec.map((h)=>`${h}`.trim()); continue; }
		const o = {};
		headers.forEach((h, i)=>{ o[h] = rec[i] === undefined ? '' : rec[i]; });
		yield { row: o, headers };
	}
}

async function* jsonlRows(stream){
	const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
	let lineNo = 0;
	for await (const line0 of rl){
		lineNo += 1;
		const line = lineNo === 1 ? line0.replace(/^﻿/, '') : line0;
		if(!line.trim()){ continue; }
		let v;
		try{ v = JSON.parse(line); }catch(e){ yield { bad: `第 ${lineNo} 行不是合法 JSON:${e.message}` }; continue; }
		if(!v || typeof v !== 'object' || Array.isArray(v)){ yield { bad: `第 ${lineNo} 行要是 JSON 对象` }; continue; }
		yield { row: v, headers: Object.keys(v) };
	}
}

// JSON 数组(名人库页复制出的命盘 JSON 等):整份读入 —— 只给小文件用,大批量请用 JSONL / CSV
async function* jsonArrayRows(stream){
	const chunks = [];
	for await (const c of stream){ chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(`${c}`)); }
	let v;
	try{ v = JSON.parse(Buffer.concat(chunks).toString('utf8').replace(/^﻿/, '')); }catch(e){ throw new BatchError(EXIT.USAGE, `JSON 解析失败:${e.message}`); }
	const arr = Array.isArray(v) ? v : (v && typeof v === 'object' ? [v] : null);
	if(!arr){ throw new BatchError(EXIT.USAGE, 'JSON 输入要是对象数组'); }
	for(const x of arr){
		if(!x || typeof x !== 'object' || Array.isArray(x)){ yield { bad: '数组元素要是 JSON 对象' }; continue; }
		yield { row: x, headers: Object.keys(x) };
	}
}

// 名人库:与「工具 · 数据库」页 / 名人库工具同一份离线库;出生资料原样(时区含秒、无时刻的按库里的正午)
async function* celebrityRows(o){
	const { openAstrodataDb } = require('./runtime');
	const db = await openAstrodataDb();
	const where = []; const params = [];
	if(o.rodden && o.rodden.length){ where.push(`rodden IN (${o.rodden.map(()=>'?').join(',')})`); params.push(...o.rodden); }
	if(o.withTime){ where.push('has_time = 1'); }
	const st = db.prepare(`SELECT cid, name, birth_chart, zone, gpsLat, gpsLon, pos, gender FROM person${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY id`);
	try{
		if(params.length){ st.bind(params); }
		const headers = ['cid', 'name', 'birth_chart', 'zone', 'gpsLat', 'gpsLon', 'pos', 'gender'];
		while(st.step()){
			const r = st.getAsObject();
			// 库里性别 1 男 / 0 女 / -1 不明(与名人建档同一映射)
			yield { row: { ...r, gender: Number(r.gender) === 1 ? 'male' : Number(r.gender) === 0 ? 'female' : 'unknown' }, headers };
		}
	}finally{
		try{ st.free(); }catch(e){ /* noop */ }
		try{ db.close(); }catch(e){ /* noop */ }
	}
}
async function celebrityCount(o){
	const { openAstrodataDb } = require('./runtime');
	const db = await openAstrodataDb();
	try{
		const where = []; const params = [];
		if(o.rodden && o.rodden.length){ where.push(`rodden IN (${o.rodden.map(()=>'?').join(',')})`); params.push(...o.rodden); }
		if(o.withTime){ where.push('has_time = 1'); }
		const st = db.prepare(`SELECT COUNT(*) n FROM person${where.length ? ` WHERE ${where.join(' AND ')}` : ''}`);
		if(params.length){ st.bind(params); }
		st.step();
		const n = Number(st.getAsObject().n) || 0;
		st.free();
		return n;
	}finally{ try{ db.close(); }catch(e){ /* noop */ } }
}

function detectFormat(o, firstChar){
	if(o.format){ return o.format === 'tsv' ? 'csv' : o.format; }
	if(o.input && o.input !== '-'){
		const ext = path.extname(o.input).toLowerCase();
		if(ext === '.jsonl' || ext === '.ndjson'){ return 'jsonl'; }
		if(ext === '.json'){ return 'json'; }
		if(ext === '.csv' || ext === '.tsv' || ext === '.txt'){ return 'csv'; }
	}
	if(firstChar === '{'){ return 'jsonl'; }
	if(firstChar === '['){ return 'json'; }
	return 'csv';
}

// 原始行流(带行号)→ 任务流:列对应在见到第一行时定下;--offset / --limit 按输入例数算(含坏行)。
// 重复 id 的改名只看这一例在输入里的位置(第一次出现记原 id,之后记「id#行号」,坏行同样占名),
// 被 --offset 跳过的行也登记 —— 分片跑、换 offset 续跑、坏行与好行同 id,键都一样,续跑不会张冠李戴
async function* taskStream(o, rawRows){
	let cols = null; let n = 0; let emitted = 0;
	const seenIds = new Set();
	for await (const item of rawRows){
		n += 1;
		if(o.limit !== null && emitted >= o.limit){ break; }
		const skip = n <= o.offset;
		if(item.bad){
			if(!skip){ emitted += 1; yield { key: `#${n}`, id: null, n, error: { code: 'E_INPUT_INVALID', message: item.bad } }; }
			continue;
		}
		if(!cols || item.headers !== cols.__headers){
			// JSONL / JSON 每行键可能不同:按本行的键重新对应(CSV 只有一个表头,对应一次);第一行缺 --map 的列 = 列名写错,整批停
			const c = resolveColumns(item.headers, o.map, !!cols);
			// 起课时间表里常见只有一列「time / 时间」写完整时刻(没有 date 列):当作时间列用
			if(o.kind === 'timepoint' && c.birth === undefined && c.date === undefined && c.time !== undefined){ c.birth = c.time; delete c.time; }
			if(!cols){
				if(c.birth === undefined && c.date === undefined){ throw new BatchError(EXIT.USAGE, `输入里找不到${o.kind === 'timepoint' ? '起课时间' : '出生时间'}列(认 birth / date+time 等;有:${item.headers.slice(0, 30).join(', ')});用 --map birth=列名 指定`); }
			}
			cols = c; Object.defineProperty(cols, '__headers', { value: item.headers, enumerable: false });
		}
		const rawId = cols.id !== undefined ? item.row[cols.id] : undefined;
		const id = blank(rawId) ? null : `${rawId}`.trim();
		let key = id;
		if(id !== null){ if(seenIds.has(id)){ key = `${id}#${n}`; }else{ seenIds.add(id); } }
		if(skip){ continue; }
		emitted += 1;
		const t = cols.__missing.length
			? { key: id !== null ? id : `#${n}`, id, n, error: { code: 'E_INPUT_INVALID', message: `这一行没有 --map 指定的列:${cols.__missing.join(', ')}` } }
			: rowToTask(item.row, cols, n, o.kind);
		if(key !== null && key !== t.key){ t.dupOf = t.key; t.key = key; }
		yield t;
	}
}

async function openRawRows(o){
	if(o.celebrities){ return { rows: celebrityRows(o), total: Math.max(0, Math.min((await celebrityCount(o)) - o.offset, o.limit === null ? Infinity : o.limit)) }; }
	let stream;
	if(o.input === '-'){ stream = process.stdin; }
	else{
		if(!fs.existsSync(o.input)){ throw new BatchError(EXIT.USAGE, `命例文件不存在:${o.input}`); }
		stream = fs.createReadStream(o.input);
	}
	// 读到第一个非空白字符再定格式(标准输入没有扩展名)
	const it = stream[Symbol.asyncIterator]();
	const head = [];
	let first = '';
	while(!first){
		const r = await it.next();
		if(r.done){ break; }
		head.push(r.value);
		const m = /[^\s﻿]/.exec(`${r.value}`);
		if(m){ first = m[0]; }
	}
	async function* replay(){ for(const c of head){ yield c; } for(;;){ const r = await it.next(); if(r.done){ return; } yield r.value; } }
	const fmt = detectFormat(o, first);
	const src = replay();
	const rows = fmt === 'jsonl' ? jsonlRows(require('stream').Readable.from(src)) : fmt === 'json' ? jsonArrayRows(src) : csvRows(decodeUtf8(src), o.delimiter || (o.format === 'tsv' || (o.input && /\.tsv$/i.test(o.input)) ? '\t' : null));
	let total = null;
	if(o.input !== '-' && fmt !== 'json'){ total = estimateRows(o.input, fmt); if(total !== null){ total = Math.max(0, Math.min(total - o.offset, o.limit === null ? Infinity : o.limit)); } }
	return { rows, total, format: fmt };
}
async function* decodeUtf8(src){
	const { StringDecoder } = require('string_decoder');
	const dec = new StringDecoder('utf8');
	for await (const c of src){ const s = dec.write(Buffer.isBuffer(c) ? c : Buffer.from(`${c}`)); if(s){ yield s; } }
	const tail = dec.end(); if(tail){ yield tail; }
}
// 进度用的总数估计:数非空行(CSV 减表头;字段内换行会多算几行,只影响进度百分比)
function estimateRows(file, fmt){
	try{
		const fd = fs.openSync(file, 'r');
		const buf = Buffer.alloc(1 << 20);
		let lines = 0; let nonEmpty = false; let got;
		while((got = fs.readSync(fd, buf, 0, buf.length, null)) > 0){
			for(let i = 0; i < got; i++){
				const b = buf[i];
				if(b === 10){ if(nonEmpty){ lines += 1; } nonEmpty = false; }else if(b !== 13 && b !== 32 && b !== 9){ nonEmpty = true; }
			}
		}
		if(nonEmpty){ lines += 1; }
		fs.closeSync(fd);
		return fmt === 'csv' ? Math.max(0, lines - 1) : lines;
	}catch(e){ return null; }
}

// ───────────────────────── 输出 · 续跑 ─────────────────────────

// 读已有输出:键 → 是否算完(要的技法都在;--retry-failed 时还要都成功)。末尾半行(写到一半被断)截掉;
// 需要重算的行先从文件里摘掉(先写临时文件再改名),保证一例只有一行
async function prepareOutput(file, o, techniques){
	const done = new Set();
	if(!fs.existsSync(file) || fs.statSync(file).size === 0){ return { done, kept: 0, dropped: 0, truncated: 0 }; }
	if(!o.resume && !o.overwrite){ throw new BatchError(EXIT.USAGE, `输出文件已存在:${file}(加 --resume 续跑,或 --overwrite 覆盖)`); }
	if(o.overwrite && !o.resume){ fs.truncateSync(file, 0); return { done, kept: 0, dropped: 0, truncated: 0 }; }
	const size = fs.statSync(file).size;
	// 末尾没有换行 = 最后一行写到一半:按最后一个换行截断
	let truncated = 0;
	{
		const fd = fs.openSync(file, 'r+');
		const tail = Buffer.alloc(1);
		fs.readSync(fd, tail, 0, 1, size - 1);
		if(tail[0] !== 10){
			let pos = size - 1; const b = Buffer.alloc(1);
			while(pos > 0){ fs.readSync(fd, b, 0, 1, pos - 1); if(b[0] === 10){ break; } pos -= 1; }
			fs.ftruncateSync(fd, pos); truncated = size - pos;
		}
		fs.closeSync(fd);
	}
	const keep = []; let dropped = 0; let kept = 0;
	const needRewrite = { v: false };
	const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
	let idx = 0;
	for await (const line of rl){
		idx += 1;
		if(!line.trim()){ needRewrite.v = true; continue; }
		let r = null;
		try{ r = JSON.parse(line); }catch(e){ r = null; }
		const ok = r && typeof r.key === 'string' && r.results && typeof r.results === 'object';
		// 输入本身坏的行(error):没有技法结果,续跑照样算「已处理」;--retry-failed 才重来
		const complete = ok && (r.error ? !o.retryFailed : techniques.every((t)=>r.results[t] && (!o.retryFailed || r.results[t].ok === true)));
		if(complete && !done.has(r.key)){ done.add(r.key); kept += 1; keep.push(idx); }
		else{ dropped += 1; needRewrite.v = true; }
	}
	if(needRewrite.v){
		const tmp = `${file}.rewrite-${process.pid}`;
		const fdw = fs.openSync(tmp, 'w', 0o644);
		const keepSet = new Set(keep);
		const rl2 = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
		let j = 0;
		for await (const line of rl2){ j += 1; if(keepSet.has(j)){ fs.writeSync(fdw, `${line}\n`); } }
		fs.fsyncSync(fdw); fs.closeSync(fdw);
		fs.renameSync(tmp, file);
	}
	return { done, kept, dropped, truncated };
}

function createWriter(file){
	const fd = fs.openSync(file, 'a', 0o644);
	let pending = 0; let lastSync = Date.now();
	return {
		write(obj){
			// 短写(磁盘将满等)时接着写完这一行,不留半行
			const buf = Buffer.from(`${JSON.stringify(obj)}\n`);
			let off = 0;
			while(off < buf.length){ off += fs.writeSync(fd, buf, off, buf.length - off); }
			pending += 1;
			if(pending >= 200 || Date.now() - lastSync > 2000){ fs.fsyncSync(fd); pending = 0; lastSync = Date.now(); }
		},
		close(){ try{ fs.fsyncSync(fd); }catch(e){ /* noop */ } try{ fs.closeSync(fd); }catch(e){ /* noop */ } },
	};
}

// 汇总:从输出文件流式重算(含续跑前已有的行),与运行信息合在一起;先写临时文件再改名
async function summarize(file, techniques){
	const s = { rows: 0, rowsOk: 0, rowsFailed: 0, inputErrors: 0, byTechnique: {}, errorCodes: {} };
	techniques.forEach((t)=>{ s.byTechnique[t] = { ok: 0, failed: 0, truncated: 0 }; });
	if(!fs.existsSync(file)){ return s; }
	const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
	for await (const line of rl){
		if(!line.trim()){ continue; }
		let r; try{ r = JSON.parse(line); }catch(e){ continue; }
		s.rows += 1;
		if(r.ok){ s.rowsOk += 1; }else{ s.rowsFailed += 1; }
		if(r.error){ s.inputErrors += 1; s.errorCodes[r.error.code] = (s.errorCodes[r.error.code] || 0) + 1; continue; }
		Object.keys(r.results || {}).forEach((t)=>{
			const x = r.results[t];
			const slot = s.byTechnique[t] || (s.byTechnique[t] = { ok: 0, failed: 0, truncated: 0 });
			if(x && x.ok){ slot.ok += 1; if(x.data && x.data.truncated){ slot.truncated += 1; } }
			else{ slot.failed += 1; const c = (x && x.code) || 'E_UNKNOWN'; s.errorCodes[c] = (s.errorCodes[c] || 0) + 1; }
		});
	}
	return s;
}
function writeJsonAtomic(file, obj){
	const tmp = `${file}.tmp-${process.pid}`;
	fs.writeFileSync(tmp, `${JSON.stringify(obj, null, 1)}\n`);
	fs.renameSync(tmp, file);
}

// ───────────────────────── 子进程池 ─────────────────────────

// 子进程的数据目录:临时目录里放一份开跑时的本机存储(技法设置等),其余从空开始(批量不读写档案、对话等)
function makeWorkerHome(root, i, settingsFile){
	const home = path.join(root, `w${i}-${Date.now().toString(36)}`);
	const data = path.join(home, 'headless', 'data');
	fs.mkdirSync(data, { recursive: true, mode: 0o700 });
	if(settingsFile && fs.existsSync(settingsFile)){ fs.copyFileSync(settingsFile, path.join(data, 'localStorage.json')); }
	return home;
}
function removeTree(dir){ try{ fs.rmSync(dir, { recursive: true, force: true }); }catch(e){ /* 临时目录:删不掉留给系统清 */ } }

function createPool(n, init, hooks){
	const h = hooks || {};
	const workers = [];
	let alive = true;
	const spawnOne = (slot)=>new Promise((resolve, reject)=>{
		const home = makeWorkerHome(init.tmpRoot, slot, init.settingsFile);
		const child = fork(__filename, ['--batch-worker'], { env: { ...(init.envForSlot ? init.envForSlot(slot) : process.env), HOROSA_HOME: home, ...(init.worker && init.worker.clock && init.worker.clock.tz ? { TZ: init.worker.clock.tz } : {}) }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
		const w = { slot, child, home, busy: null, served: 0, ready: false };
		const onLog = (b)=>{ if(h.log){ h.log(slot, `${b}`); } };
		child.stdout.on('data', onLog); child.stderr.on('data', onLog);
		child.on('message', (m)=>{
			if(!m || typeof m !== 'object'){ return; }
			if(m.type === 'ready'){ w.ready = true; resolve(w); return; }
			if(m.type === 'fatal'){ reject(new BatchError(EXIT.FAILED, `子进程起不来:${m.message}`)); return; }
			if(m.type === 'result' && w.busy && m.seq === w.busy.seq){ const b = w.busy; w.busy = null; clearTimeout(b.timer); b.resolve(m.out); }
		});
		// 往刚退出的子进程发消息(第二次 Ctrl-C 强杀 / 整例超时重启的空档)失败是异步的:没给回调时 Node 在子进程对象上抛
		// 'error' 事件,无人接即整个父进程 EPIPE 崩掉(try/catch 接不住)。这里兜底接住,各发送点另带回调各自收尾。
		child.on('error', (e)=>{
			if(!w.ready){ reject(new BatchError(EXIT.FAILED, `子进程起不来:${e && e.message ? e.message : e}`)); return; }
			w.dead = w.dead || !child.connected;
		});
		child.on('exit', (code, sig)=>{
			removeTree(home);
			if(!w.ready){ reject(new BatchError(EXIT.FAILED, `子进程启动时退出了(${sig || code});看 ${init.logFile}`)); return; }
			w.dead = true;
			if(w.busy){ const b = w.busy; w.busy = null; clearTimeout(b.timer); b.resolve({ crashed: true, message: `子进程退出(${sig || code})` }); }
			if(h.onExit){ h.onExit(w); }
		});
		child.send({ type: 'init', init: init.worker });
	});
	let seq = 1;
	return {
		async start(){ for(let i = 0; i < n; i++){ workers.push(await spawnOne(i)); } },
		idle(pred){ return workers.find((w)=>w.ready && !w.dead && !w.busy && (!pred || pred(w))) || null; },
		size(){ return workers.length; },
		async replace(w){
			w.reviving = true;
			const i = workers.indexOf(w);
			try{ if(!w.dead){ w.child.send({ type: 'exit' }); } }catch(e){ /* noop */ }
			const nw = await spawnOne(w.slot);
			if(i >= 0){ workers[i] = nw; }else{ workers.push(nw); }
			return nw;
		},
		dead(){ return workers.find((w)=>w.dead && !w.busy && !w.reviving) || null; },
		run(w, task, hardMs){
			if(w.dead){ return Promise.resolve({ crashed: true, message: '子进程已退出' }); }
			return new Promise((resolve)=>{
				const s = seq++;
				const timer = setTimeout(()=>{
					if(w.busy && w.busy.seq === s){ const b = w.busy; w.busy = null; try{ w.child.kill('SIGKILL'); }catch(e){ /* noop */ } b.resolve({ crashed: true, message: `整例超时(${Math.round(hardMs / 1000)} 秒),子进程已重启` }); }
				}, hardMs);
				w.busy = { seq: s, resolve, timer };
				w.served += 1;
				const sendFailed = ()=>{
					if(w.busy && w.busy.seq === s){ const b = w.busy; w.busy = null; clearTimeout(b.timer); b.resolve({ crashed: true, message: '子进程通道已断' }); }
				};
				try{ w.child.send({ type: 'task', seq: s, task }, (e)=>{ if(e){ sendFailed(); } }); }catch(e){ sendFailed(); }
			});
		},
		// 子进程已退出 / 通道已断(第二次 Ctrl-C 强杀后)→ 回空答复,不往断了的通道上发(那会让父进程抛错退出)
		ask(w, msg){
			return new Promise((resolve)=>{
				if(w.dead || !w.child.connected){ resolve({}); return; }
				const done = (m)=>{ w.child.off('message', onMsg); w.child.off('exit', onExit); resolve(m); };
				const onMsg = (m)=>{ if(m && m.type === `${msg.type}:reply`){ done(m); } };
				const onExit = ()=>done({});
				w.child.on('message', onMsg); w.child.once('exit', onExit);
				try{ w.child.send(msg, (e)=>{ if(e){ done({}); } }); }catch(e){ done({}); }
			});
		},
		// 收掉全部子进程;回一个等它们都退出的 Promise(5 秒没退就强杀),之后才能删临时目录
		closeAll(force){
			alive = false;
			return Promise.all(workers.map((w)=>new Promise((resolve)=>{
				if(w.dead || w.child.exitCode !== null || w.child.signalCode !== null){ resolve(); return; }
				const t = setTimeout(()=>{ try{ w.child.kill('SIGKILL'); }catch(e){ /* noop */ } }, force ? 0 : 5000);
				w.child.once('exit', ()=>{ clearTimeout(t); resolve(); });
				try{ if(force){ w.child.kill('SIGKILL'); }else{ w.child.send({ type: 'exit' }); } }catch(e){ /* noop */ }
			})));
		},
		alive: ()=>alive,
		workers,
	};
}

// ───────────────────────── 子进程:一份无头运行时,逐技法调 cast_technique ─────────────────────────

async function workerMain(){
	process.on('SIGINT', ()=>{});   // Ctrl-C 由父进程统一处理(收尾 / 写汇总),子进程不自己退
	process.on('disconnect', ()=>process.exit(0));
	const toErr = (...a)=>process.stderr.write(`${require('util').format(...a)}\n`);
	console.log = toErr; console.info = toErr; console.debug = toErr;   // eslint-disable-line no-console
	let rt = null; let init = null; let clock = null; let ledger = null;
	const usage = new Map();   // 技法 → 用到的计算服务(java / python)
	let current = null;
	process.on('message', async (m)=>{
		if(!m || typeof m !== 'object'){ return; }
		if(m.type === 'exit'){ try{ if(rt){ rt.close(); } }catch(e){ /* noop */ } process.exit(0); }
		if(m.type === 'init'){
			init = m.init;
			try{
				// 钉住的时钟要先于运行时装好:模块加载时就取「此刻」的代码也看到同一刻
				if(init.clock && Number.isFinite(init.clock.ms)){ clock = installPinnedClock(init.clock.ms); }
				// 每技法的时限调大了(慢机器)→ 运行时里单次请求的等待按同一比例放宽(缺省时限下 = 1,不变);见 utils/request.js::requestTimeoutScale
				globalThis.__HOROSA_REQUEST_TIMEOUT_SCALE__ = Math.max(1, init.timeoutMs / DEFAULT_TIMEOUT_MS);
				const { createRuntime } = require('./runtime');
				rt = await createRuntime({ quiet: true, skipStaleCheck: true });
				ledger = createBackendLedger();
				installFetchPolicy(rt, init, ()=>current, usage, ledger);
				process.send({ type: 'ready' });
			}catch(e){ process.send({ type: 'fatal', message: e && e.message ? e.message : `${e}` }); }
			return;
		}
		if(m.type === 'init-update'){ init = m.init; return; }
		if(m.type === 'list'){
			if(m.kind === 'timepoint'){
				// 按起课时间起盘的技法:取工具目录里来源含 timepoint 的(与 list_techniques 同一份;要用户亲手摇出结果的不在内)
				let list = [];
				try{
					const r = await rt.lib.runTool('list_techniques', {}, { origin: 'mcp', clientName: 'batch', requestId: 'batch-list' });
					const all = r && r.ok && r.data && Array.isArray(r.data.items) ? r.data.items : [];
					list = all.filter((x)=>Array.isArray(x.sources) && x.sources.indexOf('timepoint') >= 0).map((x)=>({ key: x.key, label: x.label }));
				}catch(e){ list = []; }
				process.send({ type: 'list:reply', techniques: list });
				return;
			}
			const opts = rt.lib.listAnalysisTechniqueOptions({ sourceType: 'chart' });
			process.send({ type: 'list:reply', techniques: opts.map((x)=>({ key: x.value, label: x.label })) });
			return;
		}
		if(m.type === 'usage'){
			const o = {}; usage.forEach((v, k)=>{ o[k] = Array.from(v).sort(); });
			process.send({ type: 'usage:reply', usage: o });
			return;
		}
		if(m.type === 'task'){
			const out = await runCase(rt.lib, m.task, init, (t)=>{ current = t; }, clock, ledger);
			current = null;
			process.send({ type: 'result', seq: m.seq, out });
		}
	});
}

// 计算服务用量按技法记(汇总里写明哪些技法用到了 Java / Python);--python-only 时发往 Java 后端的请求就地回 503,
// 不连接、不重试(否则每个要 Java 的技法都要等连接重试的几十秒)—— 这些技法如实报失败
// 一次起盘途中发给计算服务的请求的成败台账。
// 不少技法取数失败时不报错、照常出正文(少一层数据,页面上下次自愈)—— 批量里这意味着同一例在机器忙的时候结果会悄悄不同。
// 所以:起盘回报成功、但途中有请求最终失败(连不上 / 超时被掐 / 5xx)的,这一格不采用(记 E_BACKEND_PARTIAL,可重算)。
// 同一个请求(地址 + 正文相同)后来成功了 = 重试成功,不算。reset() 之后才发出的请求才计入本次(上一技法留下的迟到请求不算到这一技法头上)。
function createBackendLedger(){
	let epoch = 0;
	const failed = new Map();
	return {
		reset(){ epoch += 1; failed.clear(); },
		begin(){ return epoch; },
		fail(at, key, url, why){ if(at === epoch && failed.size < 200){ failed.set(key, { path: `${url}`.replace(/^https?:\/\/[^/]+/, '').split('?')[0], why: `${why}`.slice(0, 80) }); } },
		ok(at, key){ if(at === epoch){ failed.delete(key); } },
		unrecovered(){ return Array.from(failed.values()); },
	};
}
// 回报成功但途中有请求失败 → 改记失败(纯函数)
function guardPartial(r, failures){
	if(!r || !r.ok || !failures || !failures.length){ return r; }
	const f = failures[0];
	return { ok: false, code: 'E_BACKEND_PARTIAL', retryable: true,
		message: `起盘途中有 ${failures.length} 个计算服务请求失败(${f.path}:${f.why}),结果可能不全,不采用;服务正常后 --resume --retry-failed 重算` };
}

function installFetchPolicy(rt, init, currentOf, usage, ledger){
	const javaRoot = `${rt.serverRoot}`.replace(/\/+$/, '');
	const chartRoot = `${rt.chartRoot}`.replace(/\/+$/, '');
	const orig = globalThis.fetch;
	const nowHeaders = clockHeaders(init.clock);
	const tracked = (url, opts, p)=>{
		if(!ledger){ return p; }
		const at = ledger.begin();
		const key = `${url}\n${opts && typeof opts.body === 'string' ? opts.body : ''}`;
		p.then((resp)=>{ if(resp && resp.status >= 500){ ledger.fail(at, key, url, `HTTP ${resp.status}`); }else{ ledger.ok(at, key); } },
			(err)=>{ ledger.fail(at, key, url, (err && err.name === 'AbortError') ? '超时或被取消' : ((err && (err.cause && err.cause.code)) || (err && err.message) || '连接失败')); });
		return p;
	};
	const wrapped = (input, opts)=>{
		const url = typeof input === 'string' ? input : (input && input.url) || `${input}`;
		const which = url.indexOf(javaRoot) === 0 ? 'java' : url.indexOf(chartRoot) === 0 ? 'python' : null;
		const t = currentOf();
		if(which && t){ if(!usage.has(t)){ usage.set(t, new Set()); } usage.get(t).add(which); }
		if(which === 'java' && init.pythonOnly){
			// 就地回的 503 是「这一批说好了不用 Java」,不进失败台账(要 Java 的技法自己会如实失败)
			return Promise.resolve(new Response(JSON.stringify({ ResultCode: 503, Result: null, ResultMessage: 'Java 后端未启用(--python-only)' }), { status: 503, headers: { 'Content-Type': 'application/json' } }));
		}
		// 时钟钉住时,把这一刻随请求带给计算服务:它们「没给目标时刻就取当前时间」的地方改用这一刻(不读各自机器的系统时钟)
		if(which && nowHeaders){
			const h = new Headers((opts && opts.headers) || (typeof input !== 'string' && input && input.headers) || undefined);
			Object.keys(nowHeaders).forEach((k)=>h.set(k, nowHeaders[k]));
			return tracked(url, opts, orig(input, { ...(opts || {}), headers: h }));
		}
		return which ? tracked(url, opts, orig(input, opts)) : orig(input, opts);
	};
	globalThis.fetch = wrapped;
	try{ if(global.window){ global.window.fetch = wrapped; } }catch(e){ /* noop */ }
}

// 一例:按技法顺序逐个调 cast_technique(与单例调用同一参数:technique / source / options / maxChars),回包原样收下
async function runCase(lib, task, init, setCurrent, clock, ledger){
	const realNow = clock ? clock.real : Date.now;   // 耗时按真实时钟记(时钟被钉住时 Date.now() 不走)
	const t0 = realNow();
	const results = {};
	let allOk = true;
	for(const tech of init.techniques){
		setCurrent(tech);
		if(clock){ clock.reset(); }
		if(ledger){ ledger.reset(); }
		const args = { technique: tech, source: JSON.parse(JSON.stringify(task.source)), maxChars: init.maxChars };
		if(init.options && init.options[tech]){ args.options = init.options[tech]; }
		if(init.sections && init.sections[tech]){ args.sections = init.sections[tech]; }
		const ac = new AbortController();
		const timer = setTimeout(()=>ac.abort(), init.timeoutMs);
		let r;
		try{
			r = await lib.runTool(TOOL, args, { origin: 'mcp', clientName: 'batch', requestId: `batch-${task.key}-${tech}`, signal: ac.signal });
		}catch(e){
			r = { ok: false, code: 'E_TOOL_THREW', message: e && e.message ? e.message : `${e}` };
		}finally{ clearTimeout(timer); }
		if(ac.signal.aborted && !(r && r.ok)){ r = { ok: false, code: 'E_TOOL_TIMEOUT', message: `起盘超时(${Math.round(init.timeoutMs / 1000)} 秒)` }; }
		if(ledger){ r = guardPartial(r, ledger.unrecovered()); }
		results[tech] = shapeResult(r, init, lib);
		if(!results[tech].ok){ allOk = false; }
	}
	// 每例算完清一次进程内结果缓存(与审计仪器取样前同一个入口;缓存对结果透明):子进程内存不随例数涨,
	// 每例的结果也不依赖这个子进程前面算过哪些例(= 单例在新进程里算的那一份)
	try{ if(typeof lib.clearRegisteredProcessCaches === 'function'){ lib.clearRegisteredProcessCaches(); } }catch(e){ /* 清不掉只影响内存 */ }
	return { ok: allOk, results, ms: realNow() - t0 };
}

// 成功:data = 单例 --json 的 structuredContent(原样);失败:code / message(与单例回包正文同义)
function shapeResult(r, init, lib){
	if(r && r.ok){
		const out = { ok: true, data: r.data };
		if(Array.isArray(r.assumptions) && r.assumptions.length){ out.assumptions = r.assumptions; }
		if(init.splitSections && r.data && typeof r.data.content === 'string'){
			out.sections = lib.splitContentSections(r.data.content).map((s)=>({ title: s.title || '', text: s.lines.join('\n') }));
		}
		return out;
	}
	const out = { ok: false, code: (r && r.code) || 'E_UNKNOWN', message: (r && r.message) || '未知错误' };
	if(r && r.retryable){ out.retryable = true; }
	if(r && r.data && typeof r.data === 'object'){ out.data = r.data; }
	return out;
}

// ───────────────────────── 主流程 ─────────────────────────

function portOpen(port, host){
	return new Promise((resolve)=>{
		const sock = net.connect({ host: `${host || '127.0.0.1'}`.replace(/^\[|\]$/g, ''), port });
		const done = (v)=>{ clearTimeout(t); sock.destroy(); resolve(v); };
		const t = setTimeout(()=>done(true), 1500);   // 超时当作在跑(忙)
		sock.once('connect', ()=>done(true));
		sock.once('error', ()=>done(false));
	});
}
// 计算服务地址:缺省一套 = 与 ./horosa 同一来源(ports.js:HOROSA_SERVER_ROOT / _PORT / HOROSA_CHART_PORT);--backends 多套时
// 每个子进程的环境按它分到的那套写回端口变量(backendPortEnv),子进程里的运行时照常经 ports.js 解析
async function backendsState(pairs){
	const { backendPorts, backendPortEnv, PortConfigError } = require('./ports');
	let list;
	try{
		list = pairs && pairs.length
			? pairs.map((x)=>backendPorts({ serverPort: x.server, chartPort: x.chart, serverRoot: `http://127.0.0.1:${x.server}` }))
			: [backendPorts()];
	}catch(e){ if(e instanceof PortConfigError){ throw new BatchError(EXIT.USAGE, e.message); } throw e; }
	const any = async (p, port)=>(await Promise.all(p.probeHosts.map((h)=>portOpen(port, h)))).some(Boolean);
	const out = [];
	for(const p of list){ out.push({ ...p, java: await any(p, p.server), python: await any(p, p.chart) }); }
	const envForSlot = pairs && pairs.length
		? (slot)=>{
			const p = out[slot % out.length];
			const env = { ...process.env, ...backendPortEnv(p) };
			delete env.HOROSA_SERVER_ROOT;   // 端口已显式给出;留着环境里原来的根会与它冲突(ports.js 报用法错)
			return env;
		}
		: null;
	return { pairs: out, envForSlot };
}

function fmtDuration(sec){
	if(!Number.isFinite(sec) || sec < 0){ return '—'; }
	const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60); const s = Math.floor(sec % 60);
	return h ? `${h} 时 ${m} 分` : (m ? `${m} 分 ${s} 秒` : `${s} 秒`);
}

async function runBatch(o, io){
	const err = io.err;
	const t0 = Date.now();
	const { ensureBundle, dataDir } = require('./runtime');
	await ensureBundle({ quiet: true });
	// 计算服务:Python 必须在;Java 没开 → 只用 Python(要 Java 的技法略过 / 报出)。多套(--backends)逐套查
	const be = await backendsState(o.backendPairs);
	const pyDown = be.pairs.filter((x)=>!x.python);
	if(pyDown.length){
		throw new BatchError(EXIT.NOT_RUNNING, `本机 Python 排盘服务没开(:${pyDown.map((x)=>x.chart).join(' / :')})。起服务:./horosa start,或 bash scripts/linux/backends.sh start(只要 Python:加 --python-only)`);
	}
	let pythonOnly = o.pythonOnly;
	const javaDown = be.pairs.filter((x)=>!x.java);
	if(javaDown.length && !pythonOnly){ pythonOnly = true; err(`[batch] Java 后端没开(:${javaDown.map((x)=>x.server).join(' / :')}):这一批只用 Python 排盘服务,要 Java 的技法会略过\n`); }
	const concurrency = o.concurrency || 2 * be.pairs.length;
	const out = o.out || `horosa-batch-${new Date().toISOString().replace(/[-:]/g, '').replace(/\..*$/, '').replace('T', '-')}.jsonl`;
	const summaryFile = `${out}.summary.json`;
	const logFile = `${out}.log`;
	fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
	const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'horosa-batch-'));
	const logFd = fs.openSync(logFile, 'a', 0o600);
	const log = (slot, s)=>{ try{ fs.writeSync(logFd, s.split('\n').filter(Boolean).map((l)=>`[w${slot}] ${l}\n`).join('')); }catch(e){ /* noop */ } };
	const settingsFile = o.noSettings ? null : path.join(dataDir(), 'localStorage.json');
	let pool = null; let writer = null;
	const state = { interrupted: 0, fatal: null };
	const onSig = ()=>{
		state.interrupted += 1;
		if(state.interrupted === 1){ err('\n[batch] 收到 Ctrl-C:等在算的几例写完就停(再按一次立即停;已写的行都在,--resume 接着跑)\n'); }
		else if(pool){ pool.closeAll(true); }
	};
	process.on('SIGINT', onSig);
	try{
		// 技法表(探针前先拿全表:all 展开 / 键写错早报)
		const init = { techniques: [], options: o.options, sections: o.sections, maxChars: o.maxChars, timeoutMs: o.timeoutSec * 1000, splitSections: o.splitSections, pythonOnly, clock: o.clock || null };
		pool = createPool(concurrency, { tmpRoot, settingsFile, worker: init, logFile, envForSlot: be.envForSlot }, { log });
		await pool.start();
		const catalog = (await pool.ask(pool.workers[0], { type: 'list', kind: o.kind })).techniques;
		if(!catalog.length){ throw new BatchError(EXIT.FAILED, `取不到${o.kind === 'timepoint' ? '按起课时间起盘' : ''}的技法目录(看 ${logFile})`); }
		const known = new Set(catalog.map((x)=>x.key));
		const wantAll = o.techniques[0] === 'all';
		let techniques = wantAll ? catalog.map((x)=>x.key) : o.techniques;
		const unknown = techniques.filter((t)=>!known.has(t));
		if(unknown.length){ throw new BatchError(EXIT.USAGE, `不认识的技法:${unknown.join(', ')}(./horosa batch${o.kind === 'timepoint' ? ' --kind timepoint' : ''} --list-techniques 看这一种来源下的全部;命盘类技法用 --kind natal,按起课时间起盘的用 --kind timepoint)`); }
		const unknownOpt = Object.keys(o.options || {}).filter((t)=>techniques.indexOf(t) < 0);
		if(unknownOpt.length){ throw new BatchError(EXIT.USAGE, `--options 里的技法不在这一批里:${unknownOpt.join(', ')}`); }
		const unknownSec = Object.keys(o.sections || {}).filter((t)=>techniques.indexOf(t) < 0);
		if(unknownSec.length){ throw new BatchError(EXIT.USAGE, `--sections 里的技法不在这一批里:${unknownSec.join(', ')}`); }
		// 探针:用一个固定的普通命例照正式口径跑一遍。all 里起不出来的略过(要在技法页里操作才有内容的、--python-only 下要 Java 的);
		//   明点的技法起不出来 = 配置问题(计算服务 / 设置),直接停,免得整批都是错误行
		let skipped = [];
		if(o.probe){
			init.techniques = techniques;
			pool.workers.forEach((w)=>{ w.child.send({ type: 'init-update', init }); });
			const pr = await pool.run(pool.workers[0], { key: '__probe__', source: o.kind === 'timepoint' ? PROBE_TIMEPOINT : PROBE_CASE }, (techniques.length * o.timeoutSec + 60) * 1000);
			if(pr.crashed){ throw new BatchError(EXIT.FAILED, `探针例跑崩了:${pr.message};看 ${logFile}`); }
			const bad = techniques.filter((t)=>!(pr.results[t] && pr.results[t].ok));
			// 明点的、或给了设置 / 段名的技法起不出来 = 配置问题,停;all 里其余的略过
			const fatal = bad.filter((t)=>!wantAll || (o.options && o.options[t]) || (o.sections && o.sections[t]));
			if(fatal.length){
				const lines = fatal.map((t)=>{
					const x = pr.results[t];
					const avail = x.data && Array.isArray(x.data.availableSections) ? `(可用段名:${x.data.availableSections.join('、')})` : '';
					return `  ${t}:${x.code} ${x.message}${avail}`;
				});
				throw new BatchError(EXIT.FAILED, `这些技法在探针例上起不出来(整批会全是错误行,先停):\n${lines.join('\n')}${pythonOnly ? '\n(当前只用 Python 排盘服务:要 Java 的技法起不出来 —— 起 Java 后端,或去掉这些技法)' : ''}\n不想先试就加 --no-probe`);
			}
			skipped = bad.map((t)=>({ technique: t, code: pr.results[t].code, message: pr.results[t].message }));
			techniques = techniques.filter((t)=>bad.indexOf(t) < 0);
			if(skipped.length){ err(`[batch] all 里略过 ${skipped.length} 个起不出来的技法:${skipped.map((x)=>x.technique).join(', ')}(原因见汇总 skippedTechniques)\n`); }
			if(!techniques.length){ throw new BatchError(EXIT.FAILED, '没有能起盘的技法'); }
		}
		init.techniques = techniques;
		pool.workers.forEach((w)=>{ w.child.send({ type: 'init-update', init }); });
		// 输出与续跑
		const prep = await prepareOutput(out, o, techniques);
		if(o.resume && (prep.kept || prep.dropped)){ err(`[batch] 续跑:输出里已有 ${prep.kept} 例算完,${prep.dropped} 行要重算${prep.truncated ? `(末尾半行 ${prep.truncated} 字节已截掉)` : ''}\n`); }
		writer = createWriter(out);
		const { rows, total } = await openRawRows(o);
		const showProgress = o.progress === null ? !!process.stderr.isTTY : o.progress;
		const runInfo = { tool: TOOL, version: require('./server').appVersion(), startedAt: new Date(t0).toISOString(), input: o.celebrities ? { celebrities: true, rodden: o.rodden, withTime: o.withTime } : { file: o.input === '-' ? '(标准输入)' : path.resolve(o.input) },
			kind: o.kind, env: { node: process.versions.node, platform: process.platform, arch: process.arch }, offset: o.offset, limit: o.limit, techniques, skippedTechniques: skipped, options: o.options, sections: o.sections, maxChars: o.maxChars, concurrency, pythonOnly,
			clock: o.clock ? { now: o.clock.iso, given: o.clock.given, tz: o.clock.tz } : null,
			backends: be.pairs.map((x)=>({ java: x.serverRoot, python: x.chartRoot })), settingsFrom: settingsFile, out: path.resolve(out) };
		const stat = { done: 0, skipped: 0, failed: 0, inflight: 0, lastShow: 0 };
		const show = (force)=>{
			if(!showProgress){ return; }
			const now = Date.now();
			if(!force && now - stat.lastShow < 1000){ return; }
			stat.lastShow = now;
			const el = (now - t0) / 1000;
			const rate = stat.done / Math.max(el, 0.001);
			const left = total !== null ? Math.max(0, total - stat.done - stat.skipped) : null;
			const head = total !== null ? `${stat.done + stat.skipped}/${total}(${(((stat.done + stat.skipped) / Math.max(total, 1)) * 100).toFixed(1)}%)` : `${stat.done + stat.skipped}`;
			const line = `[batch] ${head} · ${rate.toFixed(2)} 例/秒 · 失败 ${stat.failed}${stat.skipped ? ` · 续跑跳过 ${stat.skipped}` : ''}${left !== null && rate > 0 ? ` · 预计剩余 ${fmtDuration(left / rate)}` : ''}`;
			err(process.stderr.isTTY ? `\r${line}\x1b[K` : `${line}\n`);
		};
		const hardMs = (techniques.length * o.timeoutSec + 60) * 1000;
		const writeRow = (task, res)=>{
			const row = { key: task.key, n: task.n };
			if(task.id !== null && task.id !== undefined){ row.id = task.id; }
			if(task.error){ Object.assign(row, { ok: false, error: task.error, results: {} }); }
			else if(res.crashed){
				const results = {}; techniques.forEach((t)=>{ results[t] = { ok: false, code: 'E_WORKER_CRASHED', message: res.message }; });
				Object.assign(row, { input: inputOf(task.source), ok: false, results });
			}else{ Object.assign(row, { input: inputOf(task.source), ok: res.ok, results: res.results, ms: res.ms }); }
			writer.write(row);
			stat.done += 1; if(!row.ok){ stat.failed += 1; }
			show(false);
		};
		// 计算服务健康:某套中途挂了 → 绑在它上面的子进程不再派活,在它上面失败的那例回队列交给别的套重算;
		//   挂掉的套每 5 秒复查、起来了接着用;全部挂了 60 秒没起来 = 停(已写的行都在,--resume 接着跑)
		const pairOf = (w)=>w.slot % be.pairs.length;
		const pairDown = be.pairs.map(()=>false);
		const pairUp = async (i)=>{
			const p = be.pairs[i];
			const any = async (port)=>(await Promise.all(p.probeHosts.map((h)=>portOpen(port, h)))).some(Boolean);
			return (await any(p.chart)) && (pythonOnly || await any(p.server));
		};
		const pairName = (i)=>(pythonOnly ? `:${be.pairs[i].chart}` : `:${be.pairs[i].server} / :${be.pairs[i].chart}`);
		const retryQueue = [];
		let lastRecheck = 0; let allDownSince = 0; let inputDone = false;
		// 分派:有空闲子进程才读下一例(背压:内存与总例数无关)
		const inflight = new Set();
		let lastSummary = Date.now();
		const iter = taskStream(o, rows)[Symbol.asyncIterator]();
		const waitAny = ()=>(inflight.size ? Promise.race(inflight) : Promise.resolve());
		for(;;){
			if(state.interrupted){ break; }
			if(state.fatal){ break; }
			if(pairDown.some(Boolean) && Date.now() - lastRecheck > 5000){
				lastRecheck = Date.now();
				for(let i = 0; i < pairDown.length; i++){
					if(pairDown[i] && await pairUp(i)){ pairDown[i] = false; err(`[batch] 计算服务 ${pairName(i)} 恢复了,接着分活\n`); }
				}
			}
			let w = pool.idle((x)=>!pairDown[pairOf(x)]);
			if(!w){
				const d = pool.dead();
				if(d){ try{ await pool.replace(d); }catch(e){ throw new BatchError(EXIT.FAILED, `子进程重启失败:${e.message};看 ${logFile}`); } continue; }
				if(!inflight.size){
					if(pairDown.every(Boolean)){
						if(!allDownSince){ allDownSince = Date.now(); }
						if(Date.now() - allDownSince > 60000){ throw new BatchError(EXIT.FAILED, `计算服务都连不上了(${be.pairs.map((x, i)=>pairName(i)).join(';')}),已停;服务起来后加 --resume 接着跑`); }
						await new Promise((r)=>setTimeout(r, 2000)); continue;
					}
					throw new BatchError(EXIT.FAILED, `没有可用的子进程;看 ${logFile}`);
				}
				await waitAny(); continue;
			}
			allDownSince = 0;
			let task;
			if(retryQueue.length){
				task = retryQueue.shift();
			}else{
				if(inputDone){
					// 输入读完了:还有在算的就等(它们可能因计算服务挂了回队列),都算完才收
					if(!inflight.size){ break; }
					await waitAny(); continue;
				}
				const nx = await iter.next();
				if(nx.done){ inputDone = true; continue; }
				task = nx.value;
				if(task.dupOf){ err(`[batch] 第 ${task.n} 例的 id「${task.dupOf}」与前面重复:这一例按「${task.key}」记\n`); }
				if(prep.done.has(task.key)){ stat.skipped += 1; show(false); continue; }
				if(task.error){ writeRow(task, null); continue; }
			}
			if(w.served >= o.recycle){ w = await pool.replace(w); }
			const p = (async ()=>{
				try{
					const res = await pool.run(w, task, hardMs);
					// 第二次 Ctrl-C 强杀:被杀的几例不落盘(不记成失败),--resume 照常重算
					if(res.crashed && state.interrupted){ return; }
					if(res.crashed && pool.alive() && !state.interrupted){ try{ await pool.replace(w); }catch(e){ err(`[batch] 子进程重启失败:${e.message}\n`); } }
					if(!res.ok && (task.retries || 0) < 3){
						const i = pairOf(w);
						if(!(await pairUp(i))){
							if(!pairDown[i]){ pairDown[i] = true; lastRecheck = Date.now(); err(`[batch] 计算服务 ${pairName(i)} 连不上了:不再往它上面分活,在它上面失败的例交给别的套重算\n`); }
							task.retries = (task.retries || 0) + 1;
							retryQueue.push(task);
							return;
						}
					}
					writeRow(task, res);
				}catch(e){
					// 写不进输出(磁盘满 / 权限)等:停止分派,已写的行保留
					if(!state.fatal){ state.fatal = e; }
				}
			})();
			inflight.add(p);
			p.finally(()=>inflight.delete(p));
			if(Date.now() - lastSummary > 30000){ lastSummary = Date.now(); writeJsonAtomic(summaryFile, { ...runInfo, running: true, progress: { done: stat.done, skipped: stat.skipped, failed: stat.failed, total } }); }
		}
		await Promise.all(Array.from(inflight));
		if(state.fatal){ throw new BatchError(EXIT.FAILED, `写输出失败,已停:${state.fatal.message}(已写的行都在,--resume 接着跑)`); }
		show(true);
		if(showProgress){ err('\n'); }
		const usage = {};
		for(const w of pool.workers.filter((x)=>!x.dead)){
			const u = (await pool.ask(w, { type: 'usage' })).usage || {};
			Object.keys(u).forEach((t)=>{ usage[t] = Array.from(new Set([...(usage[t] || []), ...u[t]])).sort(); });
		}
		writer.close(); writer = null;
		const agg = await summarize(out, techniques);
		const elapsed = (Date.now() - t0) / 1000;
		const summary = { ...runInfo, finishedAt: new Date().toISOString(), elapsedSec: Math.round(elapsed), interrupted: !!state.interrupted,
			thisRun: { computed: stat.done, skippedByResume: stat.skipped, failed: stat.failed, casesPerSec: Number((stat.done / Math.max(elapsed, 0.001)).toFixed(3)) },
			backendsUsedByTechnique: usage, ...agg };
		writeJsonAtomic(summaryFile, summary);
		err(`[batch] ${state.interrupted ? '已中断' : '完成'}:本次算 ${stat.done} 例(失败 ${stat.failed})${stat.skipped ? `,续跑跳过 ${stat.skipped} 例` : ''},用时 ${fmtDuration(elapsed)};输出 ${out}(共 ${agg.rows} 例,全部成功 ${agg.rowsOk})· 汇总 ${summaryFile}\n`);
		if(state.interrupted){ return EXIT.INTERRUPTED; }
		return agg.rowsFailed ? EXIT.ROW_FAILURES : EXIT.OK;
	}finally{
		process.removeListener('SIGINT', onSig);
		if(writer){ writer.close(); }
		if(pool){ await pool.closeAll(state.interrupted > 1); }
		try{ fs.closeSync(logFd); }catch(e){ /* noop */ }
		removeTree(tmpRoot);   // 子进程都退了再删(此前定时删 + 进程马上退,临时目录一直留着)
	}
}
const inputOf = (src)=>{ const { kind, ...rest } = src || {}; return rest; };   // eslint-disable-line no-unused-vars

async function listTechniques(io, kind){
	const { ensureBundle, dataDir } = require('./runtime');
	await ensureBundle({ quiet: true });
	const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'horosa-batch-'));
	const pool = createPool(1, { tmpRoot, settingsFile: path.join(dataDir(), 'localStorage.json'), worker: { techniques: [], options: {}, maxChars: MAX_CHARS_CAP, timeoutMs: 120000 }, logFile: '(无)' }, {});
	try{
		await pool.start();
		const list = (await pool.ask(pool.workers[0], { type: 'list', kind })).techniques;
		const w = Math.max(...list.map((x)=>x.key.length));
		io.out(`${list.map((x)=>`${x.key.padEnd(w)}  ${x.label}`).join('\n')}\n共 ${list.length} 个(${kind === 'timepoint' ? '按起课时间起盘的技法;--kind timepoint 时用' : '按出生资料起盘的命盘类技法;按起课时间起盘的另见 --kind timepoint --list-techniques'};all 时会先用探针例略过起不出来的)\n`);
		return EXIT.OK;
	}finally{ await pool.closeAll(false); removeTree(tmpRoot); }
}

async function main(argv, ioIn){
	const io = ioIn || { out: (s)=>process.stdout.write(s), err: (s)=>process.stderr.write(s) };
	let o;
	try{ o = parseBatchArgs(argv); }catch(e){ io.err(`horosa batch: ${e.message}\n`); return e.exitCode || EXIT.USAGE; }
	if(o.help){ io.out(usage()); return EXIT.OK; }
	try{
		if(o.list){ return await listTechniques(io, o.kind); }
		return await runBatch(o, io);
	}catch(e){
		if(e instanceof BatchError){ io.err(`horosa batch: ${e.message}\n`); return e.exitCode; }
		if(e && e.code === 'E_PORT_CONFIG'){ io.err(`horosa batch: ${e.message}\n`); return EXIT.USAGE; }
		io.err(`horosa batch: ${e && e.stack ? e.stack : e}\n`);
		return EXIT.FAILED;
	}
}

module.exports = { main, usage, createPool, parseBatchArgs, createBackendLedger, guardPartial, resolveClock, installPinnedClock, zoneOffsetMs, clockHeaders, openRawRows, parseCoord, parseZone, parseGender, resolveColumns, rowToTask, csvRows, csvRecords, jsonlRows, taskStream, prepareOutput, summarize, shapeResult, runCase, FIELD_ALIASES, EXIT, MAX_CHARS_CAP, PROBE_CASE, BatchError };

if(require.main === module){
	if(process.argv.includes('--batch-worker')){ workerMain(); }
	else{ main(process.argv.slice(2)).then((code)=>require('./exit').exitAfterFlush(code)); }
}
