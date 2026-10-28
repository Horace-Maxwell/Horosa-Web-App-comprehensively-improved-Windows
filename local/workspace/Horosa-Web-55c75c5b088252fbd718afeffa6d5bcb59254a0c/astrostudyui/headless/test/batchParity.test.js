// 批量 == 单例 的逐值对拍(真计算服务;node --test;数据与输出全在临时目录,零窗口):
//   随机抽名人库 N 例(缺省 50;种子打印出来,HOROSA_PARITY_SEED 可复现)× 主要技法(西占 / 印占 / 七政 / 德国 / 推运 / 八字 / 紫微 / 七政四余 / 先天 / 皇极 / 河洛 …),
//   ① 批量输出的每例每技法 data == 同一输入单例 cast_technique(./horosa call --local 同一条路,另一个进程、全新数据目录)的 structuredContent;
//   ② == 先 create_celebrity_chart 建档、再按档案起盘(名人库页「加入命盘」后在软件里看到的那张盘);
//   ③ 抽几格用真的 ./horosa call cast_technique … --json --local 子进程再对一次;
//   ④ --celebrities 读库这条路与同样字段的 JSONL 输入逐值相同;同一批再跑一遍逐值相同(确定性);
//   ⑤ 同一进程里同一张盘起两次,两次逐字相同(第一次当场算、第二次读槽 —— 两条路回的是同一规范形)。
// 唯一放过的差异:正文里取「此刻」到分钟的两处 ——「导出时刻」与推运类缺省的「推运时间」(两次运行跨分钟就不同;
// 跨分钟实测全部技法只有这两处随钟面变)—— 逐条计数并打印。
// 要本机 Java + Python 计算服务在跑,且显式打开:HOROSA_BATCH_PARITY=1(端口按 HOROSA_SERVER_PORT / HOROSA_CHART_PORT,与 ./horosa 同一来源);
// 没开 → 整个跳过(不算失败)。例:HOROSA_BATCH_PARITY=1 HOROSA_SERVER_PORT=19999 HOROSA_CHART_PORT=18899 node --test headless/test/batchParity.test.js
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const HL = path.join(__dirname, '..');
const BATCH = path.join(HL, 'batch.js');
const CLI = path.join(HL, 'cli.js');
const B = require(BATCH);
const N = Math.max(1, Number(process.env.HOROSA_PARITY_CASES || 50));
const SEED = Number(process.env.HOROSA_PARITY_SEED || Date.now() % 2147483647);
// 小限的目标时刻缺省 = 此刻(行运位置随分钟变):对拍时给定一个时刻 —— 同时验 --options 与单例 options 同义
const OPTIONS = { profection: { datetime: '2030-06-01 12:00' } };
const TECHS = ['astrochart', 'bazi', 'ziwei', 'guolao', 'indiachart', 'germany', 'primarydirect', 'firdaria', 'solarreturn', 'profection', 'qizhengkin', 'xianqin', 'huangji', 'heluo', 'cetian'];
const tmp = ()=>fs.mkdtempSync(path.join(os.tmpdir(), 'horosa-parity-'));
const CHILDREN = new Set();
after(()=>{ CHILDREN.forEach((c)=>{ try{ c.kill('SIGKILL'); }catch(e){ /* noop */ } }); });

function portOpen(port){
	return new Promise((resolve)=>{
		const s = net.connect({ host: '127.0.0.1', port });
		const done = (v)=>{ s.destroy(); resolve(v); };
		s.once('connect', ()=>done(true)); s.once('error', ()=>done(false)); setTimeout(()=>done(false), 1500);
	});
}
function run(args, opts){
	return new Promise((resolve)=>{
		const c = spawn(process.execPath, args, { env: { ...process.env, ...((opts && opts.env) || {}) }, stdio: ['pipe', 'pipe', 'pipe'] });
		CHILDREN.add(c);
		const out = []; let err = '';
		c.stdout.on('data', (b)=>out.push(b)); c.stderr.on('data', (b)=>{ err += b; });
		c.on('exit', (code)=>{ CHILDREN.delete(c); resolve({ code, out: Buffer.concat(out).toString('utf8'), err }); });
		c.stdin.end(opts && opts.input ? opts.input : '');
	});
}
async function castReference(items, home){
	const r = await run([path.join(__dirname, 'castReference.js')], { env: { HOROSA_HOME: home }, input: JSON.stringify(items) });
	if(r.code !== 0){ throw new Error(`参照进程退出 ${r.code}:${r.err.slice(-800)}`); }
	return JSON.parse(r.out);
}
const readRows = (f)=>fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l)=>JSON.parse(l));
// 取「此刻」到分钟的两处:唯一允许不同的地方(逐条计数)
const WALL_CLOCK = /(导出时刻|推运时间)：\d{4}-\d{2}-\d{2} \d{2}:\d{2}/g;
let wallClockNormalized = 0;
function sameData(a, b, label){
	if(JSON.stringify(a) === JSON.stringify(b)){ return; }
	const norm = (x)=>(x && typeof x.content === 'string' ? { ...x, content: x.content.replace(WALL_CLOCK, '$1：<此刻>') } : x);
	const na = norm(a); const nb = norm(b);
	if(JSON.stringify(na) === JSON.stringify(nb)){ wallClockNormalized += 1; return; }
	const A = `${(a || {}).content}`; const R = `${(b || {}).content}`;
	let k = 0; while(k < A.length && A[k] === R[k]){ k += 1; }
	assert.deepEqual(na, nb, `${label} 第 ${k} 字起不同:${JSON.stringify(A.slice(Math.max(0, k - 50), k + 50))} ≠ ${JSON.stringify(R.slice(Math.max(0, k - 50), k + 50))}`);
}

// 种子随机(可复现):mulberry32
function rng(seed){ let a = seed >>> 0; return ()=>{ a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

describe(`批量 == 单例(随机名人 ${N} 例 × ${TECHS.length} 技法,种子 ${SEED})`, ()=>{
	let skip = null; let rows = null; let picked = null; const work = tmp();
	before(async ()=>{
		if(process.env.HOROSA_BATCH_PARITY !== '1'){ skip = '没设 HOROSA_BATCH_PARITY=1'; return; }
		const { backendPorts } = require('../ports');
		const p = backendPorts();
		if(!(await portOpen(p.server)) || !(await portOpen(p.chart))){ skip = `计算服务没在跑(Java :${p.server} / Python :${p.chart})`; return; }
		process.stderr.write(`[parity] 种子 ${SEED}(HOROSA_PARITY_SEED=${SEED} 可复现)· Java :${p.server} · Python :${p.chart}\n`);
		const { openAstrodataDb } = require('../runtime');
		const db = await openAstrodataDb();
		const total = Number(db.exec('SELECT COUNT(*) FROM person')[0].values[0][0]);
		const r = rng(SEED); const ids = new Set();
		while(ids.size < Math.min(N, total)){ ids.add(1 + Math.floor(r() * total)); }
		const st = db.prepare('SELECT cid, name, birth_chart, zone, gpsLat, gpsLon, pos, gender FROM person ORDER BY id LIMIT 1 OFFSET ?');
		picked = Array.from(ids).map((k)=>{ st.bind([k - 1]); st.step(); const x = st.getAsObject(); st.reset(); return { ...x, gender: Number(x.gender) === 1 ? 'male' : Number(x.gender) === 0 ? 'female' : 'unknown' }; });
		st.free(); db.close();
		fs.writeFileSync(path.join(work, 'cases.jsonl'), `${picked.map((x)=>JSON.stringify(x)).join('\n')}\n`);
		const b = await run([BATCH, path.join(work, 'cases.jsonl'), '-t', TECHS.join(','), '-o', path.join(work, 'out.jsonl'), '--options', JSON.stringify(OPTIONS), '-j', '2', '--no-progress'], { env: { HOROSA_HOME: tmp() } });
		assert.equal(b.code, 0, b.err.slice(-2000));
		rows = readRows(path.join(work, 'out.jsonl'));
		assert.equal(rows.length, picked.length);
	});
	it('① 批量 data == 单例 cast_technique(natal 源,全新进程与数据目录)的 structuredContent,逐例逐技法', async (t)=>{
		if(skip){ t.skip(skip); return; }
		const items = [];
		rows.forEach((row)=>TECHS.forEach((tech)=>items.push({ technique: tech, source: { kind: 'natal', ...row.input }, maxChars: B.MAX_CHARS_CAP, ...(OPTIONS[tech] ? { options: OPTIONS[tech] } : {}) })));
		const ref = await castReference(items, tmp());
		let k = 0;
		rows.forEach((row)=>TECHS.forEach((tech)=>{
			const a = ref[k++];
			assert.equal(a.isError, false, `${row.key} · ${tech}:${a.text}`);
			assert.equal(row.results[tech].ok, true, `${row.key} · ${tech}`);
			sameData(row.results[tech].data, a.structuredContent, `${row.key} · ${tech}`);
		}));
		process.stderr.write(`[parity] ① ${k} 格逐值相同(其中 ${wallClockNormalized} 格只差此刻时间)\n`);
	});
	it('② 批量 == 名人库建档后按档案起盘(软件里看到的那张盘)', async (t)=>{
		if(skip){ t.skip(skip); return; }
		const before0 = wallClockNormalized;
		const items = [];
		rows.forEach((row)=>TECHS.forEach((tech)=>items.push({ technique: tech, celebrity: row.id, maxChars: B.MAX_CHARS_CAP, ...(OPTIONS[tech] ? { options: OPTIONS[tech] } : {}) })));
		const ref = await castReference(items, tmp());
		let k = 0;
		rows.forEach((row)=>TECHS.forEach((tech)=>{
			const a = ref[k++];
			assert.equal(a.isError, false, `${row.key} · ${tech}:${a.text}`);
			sameData(row.results[tech].data, a.structuredContent, `${row.key} · ${tech}(档案)`);
		}));
		process.stderr.write(`[parity] ② ${k} 格逐值相同(其中 ${wallClockNormalized - before0} 格只差此刻时间)\n`);
	});
	it('③ 抽格用真的 ./horosa call cast_technique --json --local 子进程再对一次', async (t)=>{
		if(skip){ t.skip(skip); return; }
		const home = tmp();
		let k = 0;
		for(const row of rows.slice(0, 5)){
			for(const tech of ['astrochart', 'bazi', 'qizhengkin']){
				const r = await run([CLI, 'call', 'cast_technique', `technique=${tech}`, `source:=${JSON.stringify({ kind: 'natal', ...row.input })}`, `maxChars:=${B.MAX_CHARS_CAP}`, '--json', '--local'], { env: { HOROSA_HOME: home } });
				assert.equal(r.code, 0, r.err.slice(-500));
				sameData(row.results[tech].data, JSON.parse(r.out).structuredContent, `${row.key} · ${tech}(终端命令)`);
				k += 1;
			}
		}
		process.stderr.write(`[parity] ③ 终端命令 ${k} 格逐值相同\n`);
	});
	it('⑤ 同一进程里同一张盘起两次逐字相同(当场算 vs 读槽);全部按出生资料起盘的技法', async (t)=>{
		if(skip){ t.skip(skip); return; }
		const all = ['astrochart', 'indiachart', 'guolao', 'germany', 'babylon', 'primarydirect', 'primarydirchart', 'zodialrelease', 'firdaria', 'distributions', 'agepoint', 'profection', 'solararc', 'solarreturn', 'lunarreturn', 'givenyear', 'decennials', 'planetaryages', 'ephemeris', 'returntimeline', 'prenatalsyzygy', 'prog', 'vedicprog', 'balbillus', 'triplicityrulers', 'keypoints', 'lunationphase', 'extrareturns', 'yearsystem129', 'planetaryarc', 'persiandirected', 'jaynesprog', 'bazi', 'ziwei', 'suzhan', 'canping', 'heluo', 'zhengchuan', 'yizhangjing', 'xianqin', 'cetian', 'qizhengkin', 'shaozi', 'tieban', 'fendjing', 'beiji', 'nanji', 'chunzi', 'huangji'];
		const items = [];
		rows.slice(0, 2).forEach((row)=>all.forEach((tech)=>{ const it0 = { technique: tech, source: { kind: 'natal', ...row.input }, maxChars: B.MAX_CHARS_CAP }; items.push(it0, it0); }));
		const ref = await castReference(items, tmp());
		for(let i = 0; i < ref.length; i += 2){
			assert.equal(ref[i].isError, false, `${items[i].technique}:${ref[i].text}`);
			sameData(ref[i].structuredContent, ref[i + 1].structuredContent, `${items[i].technique}(第一次 vs 第二次)`);
		}
	});
	it('④ --celebrities 读库 == 同字段 JSONL;同一批再跑一遍逐值相同', async (t)=>{
		if(skip){ t.skip(skip); return; }
		const offset = 1000 + (SEED % 50000);
		const a = await run([BATCH, '--celebrities', '--offset', `${offset}`, '--limit', '4', '-t', 'astrochart,bazi,ziwei', '-o', path.join(work, 'c1.jsonl'), '--no-progress'], { env: { HOROSA_HOME: tmp() } });
		assert.equal(a.code, 0, a.err.slice(-1000));
		const c1 = readRows(path.join(work, 'c1.jsonl'));
		fs.writeFileSync(path.join(work, 'c.jsonl'), `${c1.map((r)=>JSON.stringify({ cid: r.id, name: r.input.name, birth_chart: r.input.birth, zone: r.input.zone, gpsLat: r.input.gpsLat, gpsLon: r.input.gpsLon, pos: r.input.pos, gender: r.input.gender })).join('\n')}\n`);
		const b = await run([BATCH, path.join(work, 'c.jsonl'), '-t', 'astrochart,bazi,ziwei', '-o', path.join(work, 'c2.jsonl'), '--no-progress'], { env: { HOROSA_HOME: tmp() } });
		assert.equal(b.code, 0, b.err.slice(-1000));
		const c2 = new Map(readRows(path.join(work, 'c2.jsonl')).map((r)=>[r.id, r]));
		c1.forEach((r)=>Object.keys(r.results).forEach((tech)=>sameData(r.results[tech].data, c2.get(r.id).results[tech].data, `${r.id} · ${tech}(读库 vs JSONL)`)));
		const again = await run([BATCH, path.join(work, 'cases.jsonl'), '-t', TECHS.join(','), '--limit', '10', '-o', path.join(work, 'again.jsonl'), '--options', JSON.stringify(OPTIONS), '--no-progress'], { env: { HOROSA_HOME: tmp() } });
		assert.equal(again.code, 0, again.err.slice(-1000));
		const byKey = new Map(rows.map((r)=>[r.key, r]));
		readRows(path.join(work, 'again.jsonl')).forEach((r)=>TECHS.forEach((tech)=>sameData(r.results[tech].data, byKey.get(r.key).results[tech].data, `${r.key} · ${tech}(再跑一遍)`)));
	});
});
