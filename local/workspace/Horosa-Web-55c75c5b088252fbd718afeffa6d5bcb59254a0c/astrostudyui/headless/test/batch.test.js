// 批量验证(./horosa batch)的行为合同(node --test;真运行时、真子进程、数据与输出全在临时目录,零窗口、不起 Java / Python 计算服务):
//  ① 输入归一(纯函数):CSV 引号 / 字段内换行 / BOM / 分隔符自动认 · 列名别名与 --map · 经纬度 / 时区 / 性别写法 · 坏行如实报
//  ② 端到端(本地就能算的技法:八字 / 河洛;「Python 排盘服务」是一个回 503 的本机假服务,Java 端口关着 → 自动只用 Python):
//     一行一例 · 坏行落错误行不中断 · 输出已存在不加 --resume 拒 · 续跑跳过已算的 · 末尾半行截掉重算 · 加技法后补算 · id 重复另记键
//  ③ 与单例同一口径:批量里每例每技法的 data == 同一输入单例 tools/call cast_technique 的 structuredContent(逐值)
//  ④ 单技法失败 / 超时只落这一格,不中断整批;--python-only 下要 Java 的请求就地失败(不等连接重试)
//  ⑤ Ctrl-C:写完在算的就停、汇总标 interrupted、退 130;--resume 接着跑完,一例一行
// 要真计算服务的逐值对拍(随机名人 × 主要技法)在 batchParity.test.js(服务没开时跳过)。
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const net = require('net');
const { spawn } = require('child_process');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const BATCH = path.join(__dirname, '..', 'batch.js');
const B = require(BATCH);
const tmp = (p)=>fs.mkdtempSync(path.join(os.tmpdir(), p || 'horosa-batch-test-'));
const CHILDREN = new Set();
after(()=>{ CHILDREN.forEach((c)=>{ try{ c.kill('SIGKILL'); }catch(e){ /* noop */ } }); });

async function* fromStrings(arr){ for(const s of arr){ yield s; } }
async function collect(gen){ const out = []; for await (const x of gen){ out.push(x); } return out; }

describe('① 输入归一(纯函数)', ()=>{
	it('CSV:引号里的逗号 / "" 转义 / 字段内换行 / CRLF / BOM;分隔符按表头猜(逗号 / 制表 / 分号)', async ()=>{
		const csv = '﻿id,name,birth\r\n1,"Smith, ""J""",1990-01-01 08:00\r\n2,"两\n行",1991-02-02 09:00\r\n';
		const recs = await collect(B.csvRecords(fromStrings([csv.slice(0, 7), csv.slice(7, 30), csv.slice(30)]), null));
		assert.deepEqual(recs, [['id', 'name', 'birth'], ['1', 'Smith, "J"', '1990-01-01 08:00'], ['2', '两\n行', '1991-02-02 09:00']]);
		const tsv = await collect(B.csvRecords(fromStrings(['a\tb\n1\t2']), null));
		assert.deepEqual(tsv, [['a', 'b'], ['1', '2']]);
		const semi = await collect(B.csvRecords(fromStrings(['a;b\n1;2\n']), null));
		assert.deepEqual(semi, [['a', 'b'], ['1', '2']]);
	});
	it('列名别名(不分大小写)与 --map;--map 指了不存在的列 = 用法错', ()=>{
		const cols = B.resolveColumns(['CID', 'Name', 'birth_chart', 'Zone', 'gpsLat', 'gpsLon', 'Gender'], {});
		assert.deepEqual(cols, { id: 'CID', name: 'Name', birth: 'birth_chart', zone: 'Zone', lat: 'gpsLat', lon: 'gpsLon', gender: 'Gender' });
		const zh = B.resolveColumns(['编号', '姓名', '出生日期', '时刻', '时区', '纬度', '经度', '性别'], {});
		assert.equal(zh.date, '出生日期'); assert.equal(zh.time, '时刻'); assert.equal(zh.lat, '纬度');
		assert.equal(B.resolveColumns(['when', 'x'], { birth: 'when' }).birth, 'when');
		assert.throws(()=>B.resolveColumns(['a'], { birth: 'nope' }), /没有这一列/);
	});
	it('经纬度:十进制 / 罗盘串 39n54 / 116e24:30 / 度分秒加半球;越界与方向错 = NaN', ()=>{
		assert.equal(B.parseCoord('39.9', 'lat'), 39.9);
		assert.equal(B.parseCoord('39n54', 'lat'), 39.9);
		assert.ok(Math.abs(B.parseCoord('116e24:30', 'lon') - (116 + 24 / 60 + 30 / 3600)) < 1e-9);
		assert.equal(B.parseCoord('74w00', 'lon'), -74);
		assert.ok(Math.abs(B.parseCoord('33°52\'S', 'lat') + (33 + 52 / 60)) < 1e-9);
		assert.ok(Number.isNaN(B.parseCoord('39e54', 'lat')));
		assert.ok(Number.isNaN(B.parseCoord('abc', 'lon')));
		assert.equal(B.parseCoord('', 'lat'), undefined);
	});
	it('时区:±HH:MM(:SS) 原样;数字 / UTC± / ±HHMM 归一;看不懂 = null', ()=>{
		assert.equal(B.parseZone('+00:09:21'), '+00:09:21');
		assert.equal(B.parseZone('-05:00:00'), '-05:00:00');
		assert.equal(B.parseZone('8'), '+08:00');
		assert.equal(B.parseZone('-5.5'), '-05:30');
		assert.equal(B.parseZone('+0530'), '+05:30');
		assert.equal(B.parseZone('UTC+8'), '+08:00');
		assert.equal(B.parseZone('GMT-03:30'), '-03:30');
		assert.equal(B.parseZone(''), undefined);
		assert.equal(B.parseZone('东八区'), null);
		assert.equal(B.parseZone('+25'), null);
	});
	it('性别:男 / 女 / M / F / 1 / 0 / 乾 / 坤;其余 unknown', ()=>{
		['男', 'M', 'male', '1', '乾造'].forEach((v)=>assert.equal(B.parseGender(v), 'male'));
		['女', 'f', 'Female', '0', '坤'].forEach((v)=>assert.equal(B.parseGender(v), 'female'));
		['', '-1', '?'].forEach((v)=>assert.equal(B.parseGender(v), 'unknown'));
	});
	it('一行 → natal 源(与单例 source 同形);缺出生时间 / 坏经纬度 / 坏时区 如实报 E_INPUT_INVALID', ()=>{
		const cols = B.resolveColumns(['id', 'name', 'date', 'time', 'tz', 'lat', 'lon', 'sex'], {});
		const ok = B.rowToTask({ id: 'a1', name: '张三', date: '1990-01-01', time: '08:00', tz: '+8', lat: '39n54', lon: '116e24', sex: '男' }, cols, 1);
		assert.deepEqual(ok, { key: 'a1', id: 'a1', n: 1, source: { kind: 'natal', birth: '1990-01-01 08:00', zone: '+08:00', gpsLat: 39.9, gpsLon: 116.4, gender: 'male', name: '张三' } });
		assert.equal(B.rowToTask({ id: '', name: 'x' }, cols, 7).key, '#7', '没有 id 按行号记键');
		assert.equal(B.rowToTask({ id: 'b', date: '' }, cols, 2).error.code, 'E_INPUT_INVALID');
		assert.match(B.rowToTask({ id: 'b', date: '1990-01-01', time: '08:00', lat: '99', lon: '0' }, cols, 2).error.message, /经纬度/);
		assert.match(B.rowToTask({ id: 'b', date: '1990-01-01', time: '08:00', tz: '东八区' }, cols, 2).error.message, /时区/);
		const placeOnly = B.rowToTask({ birth: '1990-01-01 08:00', city: '北京' }, B.resolveColumns(['birth', 'city'], {}), 3);
		assert.equal(placeOnly.source.place, '北京', '没坐标:按地名查');
		const both = B.rowToTask({ birth: '1990-01-01 08:00', pos: 'Dessau', gpsLat: 51.8, gpsLon: 12.2 }, B.resolveColumns(['birth', 'pos', 'gpsLat', 'gpsLon'], {}), 4);
		assert.equal(both.source.pos, 'Dessau', '有坐标:地名只作显示');
		assert.equal(both.source.place, undefined);
	});
	it('参数:必须给技法;all 不与具体技法混写;--options / --sections 形状校验;--backends 端口对', ()=>{
		assert.throws(()=>B.parseBatchArgs(['a.csv']), /--techniques/);
		assert.throws(()=>B.parseBatchArgs(['a.csv', '-t', 'all,bazi']), /all/);
		assert.throws(()=>B.parseBatchArgs(['a.csv', '-t', 'bazi', '--options', '{"bazi":1}']), /--options/);
		assert.throws(()=>B.parseBatchArgs(['a.csv', '-t', 'bazi', '--sections', '{"bazi":[]}']), /--sections/);
		assert.throws(()=>B.parseBatchArgs(['a.csv', '-t', 'bazi', '--backends', '9999-8899']), /--backends/);
		const o = B.parseBatchArgs(['a.csv', '-t', 'bazi,heluo', '--backends', '9999:8899,10000:8900', '--max-chars=9000']);
		assert.deepEqual(o.backendPairs, [{ server: 9999, chart: 8899 }, { server: 10000, chart: 8900 }]);
		assert.equal(o.maxChars, 9000);
		assert.equal(B.parseBatchArgs(['a.csv', '-t', 'bazi']).maxChars, B.MAX_CHARS_CAP, '缺省取单例上限(要全文)');
	});
});

// ── 端到端:假的 Python 排盘服务(回 503,或对某些路由一直不回)+ 关着的 Java 端口 ──

function freePort(){
	return new Promise((resolve)=>{ const s = net.createServer(); s.listen(0, '127.0.0.1', ()=>{ const p = s.address().port; s.close(()=>resolve(p)); }); });
}
let fake = null; let fakePort = 0; let javaPort = 0; let hangHits = 0;
before(async ()=>{
	fake = http.createServer((req, res)=>{
		if(/\/qizhengkin\//.test(req.url)){ hangHits += 1; return; }   // 一直不回:验单技法超时
		res.writeHead(503, { 'Content-Type': 'application/json' }); res.end('{"ResultCode":503}');
	});
	await new Promise((r)=>fake.listen(0, '127.0.0.1', r));
	fakePort = fake.address().port;
	javaPort = await freePort();   // 关着的口
});
after(()=>{ if(fake){ fake.close(); } });

function envFor(home){
	const env = { ...process.env, HOROSA_HOME: home, HOROSA_SERVER_PORT: `${javaPort}`, HOROSA_CHART_PORT: `${fakePort}` };
	delete env.HOROSA_SERVER_ROOT;
	return env;
}
function runBatch(args, home, opts){
	return new Promise((resolve)=>{
		const env = { ...envFor(home), ...((opts && opts.env) || {}) };
		const c = spawn(process.execPath, [BATCH, ...args], { env, cwd: (opts && opts.cwd) || home, stdio: ['ignore', 'pipe', 'pipe'] });
		CHILDREN.add(c);
		let out = ''; let err = '';
		c.stdout.on('data', (b)=>{ out += b; }); c.stderr.on('data', (b)=>{ err += b; if(opts && opts.onErr){ opts.onErr(err, c); } });
		c.on('exit', (code)=>{ CHILDREN.delete(c); resolve({ code, out, err }); });
	});
}
// 单例参照:子进程里按 ./horosa call --local 同一条路逐条调 cast_technique(见 castReference.js)
function castReference(items, home){
	return new Promise((resolve, reject)=>{
		const c = spawn(process.execPath, [path.join(__dirname, 'castReference.js')], { env: envFor(home), stdio: ['pipe', 'pipe', 'pipe'] });
		CHILDREN.add(c);
		const out = []; let err = '';
		c.stdout.on('data', (b)=>{ out.push(b); }); c.stderr.on('data', (b)=>{ err += b; });   // 按字节收齐再解码(多字节字符会跨块)
		c.on('exit', (code)=>{ CHILDREN.delete(c); if(code !== 0){ reject(new Error(`参照进程退出 ${code}:${err.slice(-800)}`)); return; } resolve(JSON.parse(Buffer.concat(out).toString('utf8'))); });
		c.stdin.end(JSON.stringify(items));
	});
}
const readRows = (f)=>fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l)=>JSON.parse(l));
function writeCsv(file, n, extra){
	const lines = ['id,name,date,time,zone,lat,lon,gender'];
	for(let i = 0; i < n; i++){
		const d = new Date(Date.UTC(1950 + (i * 7) % 60, (i * 5) % 12, 1 + (i * 3) % 27, (i * 11) % 24, (i * 13) % 60));
		const p2 = (x)=>`${x}`.padStart(2, '0');
		lines.push(`c${i},人${i},${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())},${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())},+08:00,${(20 + i % 20).toFixed(2)},${(100 + i % 30).toFixed(2)},${i % 2 ? '女' : '男'}`);
	}
	(extra || []).forEach((l)=>lines.push(l));
	fs.writeFileSync(file, `${lines.join('\n')}\n`);
}

describe('② 端到端:一行一例 · 坏行 · 续跑 · 半行 · 补技法 · 重复 id', ()=>{
	const home = tmp();
	const input = path.join(home, 'cases.csv');
	const out = path.join(home, 'out.jsonl');
	before(()=>writeCsv(input, 8, [',缺时间,,,,,,', 'c3,重复编号,1980-05-05,05:05,+08:00,30,110,男']));

	it('🔴 一行一例写 JSONL,坏行落 E_INPUT_INVALID 不中断;有失败行退 1;汇总按输出文件统计', async ()=>{
		const r = await runBatch([input, '-t', 'bazi', '-o', out, '-j', '2', '--no-progress'], home);
		assert.equal(r.code, 1, r.err);
		assert.match(r.err, /只用 Python 排盘服务/, 'Java 没开应自动进入只用 Python');
		const rows = readRows(out);
		assert.equal(rows.length, 10);
		assert.equal(new Set(rows.map((x)=>x.key)).size, 10, '一例一行、键不重复');
		const bad = rows.find((x)=>x.n === 9);
		assert.equal(bad.ok, false); assert.equal(bad.error.code, 'E_INPUT_INVALID');
		const dup = rows.find((x)=>x.n === 10);
		assert.equal(dup.key, 'c3#10', 'id 与前面重复 → 另记键');
		rows.filter((x)=>x.n <= 8).forEach((x)=>{ assert.equal(x.ok, true); assert.equal(x.results.bazi.ok, true); assert.ok(x.results.bazi.data.content.includes('[起盘信息]')); });
		const s = JSON.parse(fs.readFileSync(`${out}.summary.json`, 'utf8'));
		assert.equal(s.rows, 10); assert.equal(s.rowsOk, 9); assert.equal(s.inputErrors, 1); assert.equal(s.byTechnique.bazi.ok, 9);
		assert.equal(s.pythonOnly, true);
		assert.deepEqual(s.techniques, ['bazi']);
	});
	it('🔴 跑完不留临时目录(子进程的数据目录拷贝在子进程退出后删掉)', async ()=>{
		const t = tmp('horosa-batch-tmpdir-');
		const r = await runBatch([input, '-t', 'bazi', '-o', path.join(home, 'tmpcheck.jsonl'), '--no-progress'], home, { env: { TMPDIR: t } });
		assert.equal(r.code, 1, r.err);
		assert.deepEqual(fs.readdirSync(t), [], '临时目录没删干净');
	});
	it('🔴 输出已存在不加 --resume / --overwrite 拒(退 2);--resume 全部跳过、一例不重算', async ()=>{
		const r1 = await runBatch([input, '-t', 'bazi', '-o', out, '--no-progress'], home);
		assert.equal(r1.code, 2); assert.match(r1.err, /--resume/);
		const before0 = fs.readFileSync(out, 'utf8');
		const r2 = await runBatch([input, '-t', 'bazi', '-o', out, '--resume', '--no-progress'], home);
		assert.equal(r2.code, 1, r2.err);   // 坏行还在输出里(续跑不改它)
		const s = JSON.parse(fs.readFileSync(`${out}.summary.json`, 'utf8'));
		assert.equal(s.thisRun.computed, 0, '已算完的不重算');
		assert.equal(s.thisRun.skippedByResume, 10);
		assert.equal(fs.readFileSync(out, 'utf8'), before0, '输出原样');
	});
	it('🔴 末尾半行(写到一半被断)截掉、只重算那一例;--retry-failed 重算失败行;一例仍只一行', async ()=>{
		const txt = fs.readFileSync(out, 'utf8');
		const lines = txt.split('\n').filter(Boolean);
		const last = JSON.parse(lines[lines.length - 1]);
		fs.writeFileSync(out, `${lines.slice(0, -1).join('\n')}\n${lines[lines.length - 1].slice(0, 40)}`);
		const r = await runBatch([input, '-t', 'bazi', '-o', out, '--resume', '--no-progress'], home);
		assert.equal(r.code, 1, r.err);
		assert.match(r.err, /末尾半行/);
		const rows = readRows(out);
		assert.equal(rows.length, 10);
		assert.ok(rows.some((x)=>x.key === last.key), '截掉的那例重算回来了');
		const s = JSON.parse(fs.readFileSync(`${out}.summary.json`, 'utf8'));
		assert.equal(s.thisRun.computed, 1);
		const r2 = await runBatch([input, '-t', 'bazi', '-o', out, '--retry-failed', '--no-progress'], home);
		assert.equal(r2.code, 1);
		assert.equal(JSON.parse(fs.readFileSync(`${out}.summary.json`, 'utf8')).thisRun.computed, 1, '只重算那一行坏行');
		assert.equal(readRows(out).length, 10, '失败行重算前先从输出里摘掉旧行');
	});
	it('🔴 续跑时多要一个技法:缺这个技法的例整例重算,一例仍只一行', async ()=>{
		const r = await runBatch([input, '-t', 'bazi,heluo', '-o', out, '--resume', '--no-progress'], home);
		assert.equal(r.code, 1, r.err);
		const rows = readRows(out);
		assert.equal(rows.length, 10);
		rows.filter((x)=>!x.error).forEach((x)=>{ assert.equal(x.results.heluo.ok, true); assert.equal(x.results.bazi.ok, true); });
	});
});

describe('③ 与单例同一口径(本地就能算的技法,不要计算服务)', ()=>{
	it('🔴 批量每例每技法的 data == 单例 tools/call cast_technique 的 structuredContent(逐值)', async ()=>{
		const home = tmp();
		const input = path.join(home, 'p.csv');
		const out = path.join(home, 'p.jsonl');
		writeCsv(input, 6);
		const r = await runBatch([input, '-t', 'bazi,heluo,canping', '-o', out, '--no-progress', '--split-sections'], home);
		assert.equal(r.code, 0, r.err);
		const rows = readRows(out);
		// 单例:另一个进程、全新数据目录,与 ./horosa call --local 同一条路逐条调(castReference.js)
		const items = [];
		rows.forEach((row)=>['bazi', 'heluo', 'canping'].forEach((t)=>items.push({ technique: t, source: { kind: 'natal', ...row.input }, maxChars: B.MAX_CHARS_CAP })));
		const ref = await castReference(items, tmp());
		let compared = 0;
		rows.forEach((row)=>['bazi', 'heluo', 'canping'].forEach((t)=>{
			const a = ref[compared];
			assert.equal(a.isError, false, a.text);
			if(JSON.stringify(row.results[t].data) !== JSON.stringify(a.structuredContent)){
				const A = `${(row.results[t].data || {}).content}`; const R = `${(a.structuredContent || {}).content}`;
				let k = 0; while(k < A.length && A[k] === R[k]){ k += 1; }
				process.stderr.write(`DIFF ${row.key} ${t} @${k}: ${JSON.stringify(A.slice(k - 60, k + 60))} | ${JSON.stringify(R.slice(k - 60, k + 60))}\n`);
			}
			assert.deepEqual(row.results[t].data, a.structuredContent, `${row.key} · ${t}`);
			// --split-sections 只是另附切段,拼回去就是原文
			assert.equal(row.results[t].sections.map((x)=>x.text).join('\n'), row.results[t].data.content);
			compared += 1;
		}));
		assert.equal(compared, 18);
	});
});

describe('④ 单技法失败 / 超时只落这一格;--python-only 下要 Java 的请求就地失败', ()=>{
	it('🔴 计算服务一直不回的技法按 --timeout 落 E_TOOL_TIMEOUT,同一例的其它技法照常、整批照常跑完', async ()=>{
		const home = tmp();
		const input = path.join(home, 't.csv');
		const out = path.join(home, 't.jsonl');
		writeCsv(input, 2);
		const t0 = Date.now();
		const r = await runBatch([input, '-t', 'bazi,qizhengkin', '-o', out, '--timeout', '5', '-j', '1', '--no-probe', '--no-progress'], home);
		assert.equal(r.code, 1, r.err);
		const rows = readRows(out);
		assert.equal(rows.length, 2);
		rows.forEach((x)=>{ assert.equal(x.results.bazi.ok, true); assert.equal(x.results.qizhengkin.ok, false); assert.equal(x.results.qizhengkin.code, 'E_TOOL_TIMEOUT'); });
		assert.ok(hangHits >= 2, '确实打到了那个不回的服务');
		assert.ok(Date.now() - t0 < 60000, '超时按 --timeout 落定,不挂住整批');
	});
	it('🔴 --python-only:要 Java 的技法几秒内如实失败(不等连接重试);探针上明点的技法起不出来 → 退 5 并说明', async ()=>{
		const home = tmp();
		const input = path.join(home, 'j.csv');
		const out = path.join(home, 'j.jsonl');
		writeCsv(input, 2);
		const t0 = Date.now();
		const r = await runBatch([input, '-t', 'bazi,astrochart', '-o', out, '--python-only', '--no-probe', '-j', '1', '--no-progress'], home);
		assert.equal(r.code, 1, r.err);
		readRows(out).forEach((x)=>{ assert.equal(x.results.bazi.ok, true); assert.equal(x.results.astrochart.ok, false); });
		assert.ok(Date.now() - t0 < 25000, `要 Java 的请求应就地失败(用了 ${Date.now() - t0} ms)`);
		const r2 = await runBatch([input, '-t', 'bazi,astrochart', '-o', path.join(home, 'j2.jsonl'), '--python-only', '--no-progress'], home);
		assert.equal(r2.code, 5);
		assert.match(r2.err, /astrochart/); assert.match(r2.err, /Java/);
		assert.equal(fs.existsSync(path.join(home, 'j2.jsonl')) ? readRows(path.join(home, 'j2.jsonl')).length : 0, 0, '探针不过就不开跑');
	});
	it('Python 排盘服务没开 → 退 3 并指路', async ()=>{
		const home = tmp();
		const input = path.join(home, 'n.csv');
		writeCsv(input, 1);
		const closed = await freePort();
		const r = await new Promise((resolve)=>{
			const env = { ...envFor(home), HOROSA_CHART_PORT: `${closed}` };
			const c = spawn(process.execPath, [BATCH, input, '-t', 'bazi', '-o', path.join(home, 'n.jsonl')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
			let err = ''; c.stderr.on('data', (b)=>{ err += b; });
			c.on('exit', (code)=>resolve({ code, err }));
		});
		assert.equal(r.code, 3); assert.match(r.err, /Python 排盘服务没开/);
	});
});

describe('⑤ Ctrl-C:写完在算的就停,--resume 接着跑完', ()=>{
	it('🔴 SIGINT → 退 130、汇总 interrupted;--resume 补齐,一例一行', async ()=>{
		const home = tmp();
		const input = path.join(home, 's.csv');
		const out = path.join(home, 's.jsonl');
		writeCsv(input, 150);
		let sent = false;
		const r = await runBatch([input, '-t', 'bazi,heluo', '-o', out, '-j', '1', '--progress'], home, {
			onErr: (all, c)=>{ if(!sent && /\[batch\] ([2-9]|\d\d)\//.test(all)){ sent = true; c.kill('SIGINT'); } },
		});
		assert.equal(sent, true, r.err);
		assert.equal(r.code, 130, r.err);
		const s = JSON.parse(fs.readFileSync(`${out}.summary.json`, 'utf8'));
		assert.equal(s.interrupted, true);
		const partial = readRows(out).length;
		assert.ok(partial >= 2 && partial < 150, `中断时已写 ${partial} 例`);
		const r2 = await runBatch([input, '-t', 'bazi,heluo', '-o', out, '--resume', '--no-progress'], home);
		assert.equal(r2.code, 0, r2.err);
		const rows = readRows(out);
		assert.equal(rows.length, 150);
		assert.equal(new Set(rows.map((x)=>x.key)).size, 150);
		assert.equal(JSON.parse(fs.readFileSync(`${out}.summary.json`, 'utf8')).thisRun.computed, 150 - partial);
	});
});

describe('⑦ 键与 --map(纯函数):重复 id 按输入位置定键 · JSONL 某行缺 --map 的列只落这一行', ()=>{
	const { Readable } = require('stream');
	const csvTasks = (text, o)=>collect(B.taskStream({ offset: 0, limit: null, map: null, ...(o || {}) }, B.csvRows(fromStrings([text]))));
	it('🔴 坏行与好行同 id:坏行占原 id,好行记「id#行号」(续跑时不会被当成同一例摘掉)', async ()=>{
		const ts = await csvTasks('id,birth\nA,\nA,1990-01-01 08:00\n');
		assert.deepEqual(ts.map((t)=>t.key), ['A', 'A#2']);
		assert.equal(ts[0].error.code, 'E_INPUT_INVALID');
		assert.ok(ts[1].source, '好行照常起盘');
	});
	it('🔴 重复 id 的键与 --offset 无关:被跳过的行也登记(分片 / 换 offset 续跑键一致)', async ()=>{
		const rows = ['id,birth']; for(let i = 1; i <= 8; i++){ rows.push(`${i === 3 || i === 7 ? 'A' : `r${i}`},1990-01-0${i} 08:00`); }
		const text = `${rows.join('\n')}\n`;
		const all = await csvTasks(text);
		const shard = await csvTasks(text, { offset: 5 });
		assert.deepEqual(all.map((t)=>t.key), ['r1', 'r2', 'A', 'r4', 'r5', 'r6', 'A#7', 'r8']);
		assert.deepEqual(shard.map((t)=>t.key), ['r6', 'A#7', 'r8']);
		assert.equal(shard[1].dupOf, 'A');
	});
	it('🔴 JSONL 加 --map:某一行缺指定的键 → 这一行 E_INPUT_INVALID,其余照常(不整批用法错退出);第一行就缺 = 用法错', async ()=>{
		const lines = ['{"id":"a","dob":"1990-01-01 08:00","tz":"+08:00"}', '{"id":"b","dob":"1991-01-01 08:00"}', '{"id":"c","dob":"1992-01-01 08:00","tz":"-05:00"}'];
		const ts = await collect(B.taskStream({ offset: 0, limit: null, map: { birth: 'dob', zone: 'tz' } }, B.jsonlRows(Readable.from([`${lines.join('\n')}\n`]))));
		assert.deepEqual(ts.map((t)=>t.key), ['a', 'b', 'c']);
		assert.equal(ts[0].source.zone, '+08:00'); assert.equal(ts[2].source.zone, '-05:00');
		assert.equal(ts[1].error.code, 'E_INPUT_INVALID'); assert.match(ts[1].error.message, /--map/); assert.match(ts[1].error.message, /zone=tz/);
		await assert.rejects(collect(B.taskStream({ offset: 0, limit: null, map: { zone: 'tz' } }, B.jsonlRows(Readable.from(['{"id":"x","birth":"1990-01-01 08:00"}\n'])))), /--map zone=tz/);
	});
});

describe('⑧ 连按两次 Ctrl-C · 多套计算服务中途挂一套', ()=>{
	it('🔴 第二次 Ctrl-C 强杀:被杀的例不落成失败行;--resume(不加 --retry-failed)把它们算回来、全部成功', async ()=>{
		const home = tmp();
		const input = path.join(home, 'k.csv');
		const out = path.join(home, 'k.jsonl');
		writeCsv(input, 150);
		let sent = 0;
		const r = await runBatch([input, '-t', 'bazi,heluo', '-o', out, '-j', '2', '--progress'], home, {
			onErr: (all, c)=>{ if(!sent && /\[batch\] ([2-9]|\d\d)\//.test(all)){ sent = 1; c.kill('SIGINT'); setTimeout(()=>{ sent = 2; c.kill('SIGINT'); }, 30); } },
		});
		assert.equal(r.code, 130, r.err);
		const partial = readRows(out);
		assert.ok(partial.every((x)=>x.ok), `强杀的例不应落成失败行:${JSON.stringify(partial.filter((x)=>!x.ok).map((x)=>x.key))}`);
		const r2 = await runBatch([input, '-t', 'bazi,heluo', '-o', out, '--resume', '--no-progress'], home);
		assert.equal(r2.code, 0, r2.err);
		const rows = readRows(out);
		assert.equal(rows.length, 150);
		assert.ok(rows.every((x)=>x.ok), '续跑后全部成功');
	});
	it('🔴 --backends 两套、第二套中途挂了:不再往它上面分活,在它上面失败的例交给第一套重算(每例都真打到了活着的服务)', async ()=>{
		const home = tmp();
		const input = path.join(home, 'f.csv');
		const out = path.join(home, 'f.jsonl');
		const N = 12;
		writeCsv(input, N);
		let hits1 = 0; let hits2 = 0;
		const mk = (onHit)=>http.createServer((req, res)=>{ onHit(); res.writeHead(503, { 'Content-Type': 'application/json', Connection: 'close' }); res.end('{"ResultCode":503}'); });
		const f1 = mk(()=>{ hits1 += 1; });
		const f2 = mk(()=>{ hits2 += 1; if(hits2 === 1){ f2.close(); f2.closeAllConnections(); } });
		await new Promise((r)=>f1.listen(0, '127.0.0.1', r)); await new Promise((r)=>f2.listen(0, '127.0.0.1', r));
		const j1 = await freePort(); const j2 = await freePort();
		try{
			const r = await runBatch([input, '-t', 'qizhengkin', '-o', out, '--backends', `${j1}:${f1.address().port},${j2}:${f2.address().port}`, '-j', '2', '--no-probe', '--no-progress', '--timeout', '20'], home);
			assert.equal(r.code, 1, r.err);
			assert.match(r.err, /连不上了/);
			const rows = readRows(out);
			assert.equal(rows.length, N); assert.equal(new Set(rows.map((x)=>x.key)).size, N);
			assert.ok(hits1 >= N - 1, `挂掉那套上的例应改由第一套重算(第一套收到 ${hits1} 次,第二套 ${hits2} 次)`);
		}finally{ f1.close(); try{ f2.close(); }catch(e){ /* 已关 */ } }
	});
});

describe('⑧b 往刚退出的子进程发消息(EPIPE)不崩父进程', ()=>{
	// 第二次 Ctrl-C 强杀 / 整例超时重启的空档里,子进程对象 connected 还是 true、写管道却已断:send 的失败是异步的,
	// 没给回调时 Node 抛 'error' 事件 → 父进程 EPIPE 崩掉。发送点带回调后各自收尾,不挂住、不崩。
	const { EventEmitter } = require('events');
	const fakeWorker = ()=>{
		const child = new EventEmitter();
		child.connected = true;
		child.send = (m, cb)=>{ setImmediate(()=>{ const e = Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }); if(cb){ cb(e); }else{ child.emit('error', e); } }); return true; };
		child.kill = ()=>true;
		return { slot: 0, child, busy: null, served: 0, ready: true, dead: false };
	};
	it('🔴 run:发送失败立即按「子进程崩了」收尾(不等整例超时)', async ()=>{
		const { createPool } = require('../batch');
		const pool = createPool(0, { tmpRoot: os.tmpdir() });
		const t0 = Date.now();
		const r = await pool.run(fakeWorker(), { id: 'x' }, 60000);
		assert.equal(r.crashed, true);
		assert.ok(Date.now() - t0 < 5000);
	});
	it('🔴 ask:发送失败回空答复', async ()=>{
		const { createPool } = require('../batch');
		const pool = createPool(0, { tmpRoot: os.tmpdir() });
		assert.deepEqual(await pool.ask(fakeWorker(), { type: 'usage' }), {});
	});
	it('🔴 每个子进程都挂了 error 监听(其余发送点的兜底)', ()=>{
		const src = fs.readFileSync(path.join(__dirname, '..', 'batch.js'), 'utf8');
		const spawn = src.slice(src.indexOf('const spawnOne ='), src.indexOf('let seq = 1;'));
		assert.match(spawn, /child\.on\('error'/);
	});
});

describe('⑥ 命令行入口退出前等输出写完(接管道时大回包不被截断)', ()=>{
	const big = (mode)=>new Promise((resolve)=>{
		const code = mode === 'flush'
			? `const s = 'x'.repeat(1 << 20); for(let i = 0; i < 3; i++){ process.stdout.write(s); } require(${JSON.stringify(path.join(__dirname, '..', 'exit.js'))}).exitAfterFlush(0);`
			: `const s = 'x'.repeat(1 << 20); for(let i = 0; i < 3; i++){ process.stdout.write(s); } setImmediate(()=>process.exit(0));`;
		const c = spawn(process.execPath, ['-e', code], { stdio: ['ignore', 'pipe', 'ignore'] });
		let n = 0; c.stdout.on('data', (b)=>{ n += b.length; });
		c.on('exit', ()=>setTimeout(()=>resolve(n), 50));
	});
	it('🔴 exitAfterFlush:3 MB 全部到达;对照(直接 process.exit)确实会丢 —— 证明这个用例分得出两者', async ()=>{
		assert.equal(await big('flush'), 3 << 20);
		assert.ok(await big('raw') < 3 << 20, '对照组没丢数据:这个用例分不出修没修');
	});
	it('🔴 ./horosa 的入口(cli.js / batch.js / selftest.js)都经 exitAfterFlush 退出,不再 setImmediate(process.exit)', ()=>{
		for(const f of ['cli.js', 'batch.js', 'selftest.js']){
			const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
			assert.ok(src.includes("require('./exit').exitAfterFlush("), `${f} 没走 exitAfterFlush`);
			assert.ok(!/setImmediate\(\(\)=>process\.exit\(/.test(src), `${f} 还有直接退出`);
		}
	});
});
