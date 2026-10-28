// 无头数据目录的几条「不丢数据 / 不放宽权限」合同(node --test;真文件,数据全在临时目录,零窗口、不起后端):
//  ① 存储区文件读不了(权限 / 瞬时 I/O 错误):本进程当空、改动不落盘 —— 原文件不被整份换掉
//  ② 落盘先 fsync 再改名;master.key 是空文件(上次刚建好就崩了)→ 重新生成,不永久卡死
//  ③ 改名留档的坏文件能被列出(doctor / status / 空库提示用)
//  ④ 导出包不打「设置面完整」(桌面恢复不把本机技法设置复位);导入缺省每项取较严的一档(不放宽本机、本机是缺省时按备份收紧、
//     无头恒开的行动能力总开关不动);空库 + 留档文件 / 内容留档键 → list_records 附提示
// 跑法:node --test Horosa-Web/astrostudyui/headless/test/dataSafety.test.js
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');

const RUNTIME = path.join(__dirname, '..', 'runtime.js');
const tmpHome = ()=>fs.mkdtempSync(path.join(os.tmpdir(), 'horosa-ds-test-'));
const sleep = (ms)=>new Promise((r)=>setTimeout(r, ms));
const CHILDREN = new Set();
after(()=>{ CHILDREN.forEach((c)=>{ try{ c.kill('SIGKILL'); }catch(e){ /* noop */ } }); });

function quietStderr(){
	const errs = [];
	const orig = process.stderr.write.bind(process.stderr);
	process.stderr.write = (s)=>{ errs.push(`${s}`); return true; };
	return { errs, restore: ()=>{ process.stderr.write = orig; } };
}

describe('① 读不了的存储区不落盘', ()=>{
	it('🔴 conversations.json 读不了(权限):load 当空,之后的保存不把原文件换掉;unreadable() 列出它', async ()=>{
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'horosa-ds-stores-'));
		const file = path.join(dir, 'conversations.json');
		const original = JSON.stringify([['conv-a', { id: 'conv-a', title: '旧对话 A' }]]);
		fs.writeFileSync(file, original, { mode: 0o600 });
		fs.chmodSync(file, 0o000);
		const q = quietStderr();
		try{
			const { installStoreHook } = require(RUNTIME);
			const flush = installStoreHook(dir);
			const hook = globalThis.__HOROSA_HEADLESS_STORE__;
			assert.equal(hook.load('conversations'), null);
			assert.deepEqual(hook.unreadable().map((x)=>x.name), ['conversations']);
			hook.save('conversations', [['conv-new', { id: 'conv-new', title: '新对话' }]]);
			flush();
			await sleep(300);
			fs.chmodSync(file, 0o600);
			assert.equal(fs.readFileSync(file, 'utf8'), original, '原文件应原样还在');
			assert.ok(q.errs.join('').includes('不落盘'), '应在标准错误里说明不落盘');
		}finally{
			q.restore();
			try{ fs.chmodSync(file, 0o600); }catch(e){ /* noop */ }
		}
	});
});

describe('② fsync 与 master.key', ()=>{
	it('writeAtomic 写临时文件后 fsync 再改名,内容完整', ()=>{
		const { writeAtomic } = require(RUNTIME);
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'horosa-ds-wa-'));
		const file = path.join(dir, 'x.json');
		const origFsync = fs.fsyncSync;
		let n = 0;
		fs.fsyncSync = (fd)=>{ n += 1; return origFsync(fd); };
		try{ writeAtomic(file, '{"a":"中文"}', 0o600); }finally{ fs.fsyncSync = origFsync; }
		assert.ok(n >= 1, '应 fsync');
		assert.equal(fs.readFileSync(file, 'utf8'), '{"a":"中文"}');
		writeAtomic(path.join(dir, 'b.bin'), Buffer.from([1, 2, 3]));
		assert.deepEqual([...fs.readFileSync(path.join(dir, 'b.bin'))], [1, 2, 3]);
	});

	it('🔴 master.key 是空文件:重新生成可用的主密钥(此前 wx 建不了、再读还是空,密钥功能永久卡死)', async ()=>{
		const home = tmpHome();
		const prev = process.env.HOROSA_HOME;
		process.env.HOROSA_HOME = home;
		try{
			const { installMasterKey, masterKeyFile } = require(RUNTIME);
			fs.mkdirSync(path.dirname(masterKeyFile()), { recursive: true });
			fs.writeFileSync(masterKeyFile(), '');
			installMasterKey();
			const k = await globalThis.__HOROSA_HEADLESS_MASTER_KEY__();
			assert.equal(Buffer.from(k, 'base64').length, 32);
			assert.equal(fs.readFileSync(masterKeyFile(), 'utf8').trim(), k);
		}finally{
			if(prev === undefined){ delete process.env.HOROSA_HOME; }else{ process.env.HOROSA_HOME = prev; }
		}
	});
});

describe('③ 留档坏文件列得出', ()=>{
	it('listCorruptDataFiles 找出数据目录里(含 stores/)改名留档的文件', ()=>{
		const home = tmpHome();
		const prev = process.env.HOROSA_HOME;
		process.env.HOROSA_HOME = home;
		try{
			const { listCorruptDataFiles, dataDir } = require(RUNTIME);
			fs.mkdirSync(path.join(dataDir(), 'stores'), { recursive: true });
			fs.writeFileSync(path.join(dataDir(), 'localStorage.json.corrupt-2026-10-19T10-00-00-000Z'), '{');
			fs.writeFileSync(path.join(dataDir(), 'stores', 'conversations.json.corrupt-2026-10-19T10-00-00-000Z'), '[');
			fs.writeFileSync(path.join(dataDir(), 'stores', 'materials.json'), '[]');
			assert.deepEqual(listCorruptDataFiles().map((f)=>path.basename(f)).sort(), ['conversations.json.corrupt-2026-10-19T10-00-00-000Z', 'localStorage.json.corrupt-2026-10-19T10-00-00-000Z']);
		}finally{
			if(prev === undefined){ delete process.env.HOROSA_HOME; }else{ process.env.HOROSA_HOME = prev; }
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
	const c = spawn(process.execPath, ['-e', script], { env: { ...process.env, HOROSA_HOME: home, HOROSA_NO_AUTOSTART: '1', HOROSA_HEADLESS_PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
	CHILDREN.add(c);
	c.once('exit', ()=>CHILDREN.delete(c));
	return c;
}
function collect(child){
	return new Promise((resolve)=>{
		let buf = '';
		child.stdout.on('data', (d)=>{ buf += d; });
		child.once('exit', ()=>resolve(buf.split('\n').filter(Boolean).map((l)=>{ try{ return JSON.parse(l); }catch(e){ return { raw: l }; } })));
	});
}

describe('④ 导出 / 导入 / 空库提示', ()=>{
	it('🔴 导出包 settingsComplete=false;导入缺省保留本机收紧过的安全开关;空库 + 留档文件 → list_records 附提示', { timeout: 240000 }, async ()=>{
		const home = tmpHome();
		const pkg = path.join(home, 'out.zip');
		const child = runtimeChild(home, `
			const exp = await rt.admin.exportTo({ path: ${JSON.stringify(pkg)} });
			const Zip = require(${JSON.stringify(path.join(__dirname, '..', '..', 'node_modules', 'jszip'))});
			const z = await Zip.loadAsync(require('fs').readFileSync(${JSON.stringify(pkg)}));
			const m = JSON.parse(await z.file('manifest.json').async('string'));
			say({ settingsComplete: m.settingsComplete, source: m.source });
			// 本机收紧:只读 + 按名禁用;包里(来源机)是全自动、联网开
			rt.storage.setItem('horosa.ai.agent.external.policy.v1', JSON.stringify({ approval: 'read-only', maxCallsPerMinute: 10, maxAdditivePerHour: 0, uiConfirm: true }));
			rt.storage.setItem('horosa.ai.agent.toolPolicy.v1', JSON.stringify({ allow: [], deny: ['create_chart_record'] }));
			m.settingsComplete = true;
			m.raw = { ...(m.raw || {}), 'horosa.ai.tools.webSearch.enabled': '1' };
			m.checksums = rt.lib.buildManifestChecksums(m);
			const z2 = new Zip(); z2.file('manifest.json', JSON.stringify(m));
			require('fs').writeFileSync(${JSON.stringify(pkg)}, await z2.generateAsync({ type: 'nodebuffer' }));
			const imp = await rt.admin.importFrom({ path: ${JSON.stringify(pkg)} });
			say({ ext: rt.lib.getExternalPolicy().approval, deny: JSON.parse(rt.storage.getItem('horosa.ai.agent.toolPolicy.v1') || '{}').deny, web: rt.storage.getItem('horosa.ai.tools.webSearch.enabled'), secRow: (imp.results || []).some((r)=>r.key === 'security') });
			require('fs').writeFileSync(require('path').join(require(${JSON.stringify(RUNTIME)}).dataDir(), 'localStorage.json.corrupt-2026-10-19T10-00-00-000Z'), '{');
			const lr = await rt.dispatch('tools/call', { name: 'list_records', arguments: {} }, { clientName: 'test' });
			const texts = (lr && lr.result && lr.result.content || []).map((c)=>c.text || '');
			say({ hint: texts.some((t)=>t.indexOf('留档') >= 0) });
			process.exit(0);
		`);
		const got = await collect(child);
		const fatal = got.find((x)=>x.fatal);
		assert.ok(!fatal, fatal && fatal.fatal);
		assert.deepEqual(got[0], { settingsComplete: false, source: 'headless' });
		assert.equal(got[1].ext, 'read-only');
		assert.deepEqual(got[1].deny, ['create_chart_record']);
		assert.equal(got[1].web, null);
		assert.equal(got[1].secRow, true);
		assert.equal(got[2].hint, true);
	});

	it('🔴 导入:本机安全开关还是缺省时按备份收紧(每项取较严的一档);无头恒开的行动能力总开关不被关掉', { timeout: 240000 }, async ()=>{
		const home = tmpHome();
		const pkg = path.join(home, 'out.zip');
		const child = runtimeChild(home, `
			await rt.admin.exportTo({ path: ${JSON.stringify(pkg)} });
			const Zip = require(${JSON.stringify(path.join(__dirname, '..', '..', 'node_modules', 'jszip'))});
			const z = await Zip.loadAsync(require('fs').readFileSync(${JSON.stringify(pkg)}));
			const m = JSON.parse(await z.file('manifest.json').async('string'));
			// 来源机:收紧过外部客户端档与按名禁用;设置面完整、没有行动能力总开关这一项(= 来源机缺省关)
			m.settingsComplete = true;
			m.raw = { ...(m.raw || {}) };
			delete m.raw['horosa.ai.agent.enabled'];
			m.raw['horosa.ai.agent.external.policy.v1'] = JSON.stringify({ approval: 'read-only', maxCallsPerMinute: 10, maxAdditivePerHour: 0, uiConfirm: true });
			m.raw['horosa.ai.agent.toolPolicy.v1'] = JSON.stringify({ allow: [], deny: ['create_chart_record'] });
			m.checksums = rt.lib.buildManifestChecksums(m);
			const z2 = new Zip(); z2.file('manifest.json', JSON.stringify(m));
			require('fs').writeFileSync(${JSON.stringify(pkg)}, await z2.generateAsync({ type: 'nodebuffer' }));
			rt.storage.removeItem('horosa.ai.agent.external.policy.v1');
			rt.storage.removeItem('horosa.ai.agent.toolPolicy.v1');
			const imp = await rt.admin.importFrom({ path: ${JSON.stringify(pkg)} });
			const lr = await rt.dispatch('tools/list', {}, { clientName: 'test' });
			say({ enabled: rt.lib.isAgentEnabled(), toolsOk: !!(lr && lr.ok), ext: rt.lib.getExternalPolicy().approval, deny: JSON.parse(rt.storage.getItem('horosa.ai.agent.toolPolicy.v1') || '{}').deny, warn: (imp.warnings || []).join('|') });
			process.exit(0);
		`);
		const got = await collect(child);
		const fatal = got.find((x)=>x.fatal);
		assert.ok(!fatal, fatal && fatal.fatal);
		assert.equal(got[0].enabled, true);
		assert.equal(got[0].toolsOk, true);
		assert.equal(got[0].ext, 'read-only');
		assert.deepEqual(got[0].deny, ['create_chart_record']);
		assert.ok(got[0].warn.indexOf('较严的一档') >= 0, got[0].warn);
	});

	it('🔴 命盘库主键坏了:原串留档后从空库开始(无头没有影子副本可等);list_records 空库提示认得内容留档', { timeout: 240000 }, async ()=>{
		const home = tmpHome();
		const data = path.join(home, 'headless', 'data');
		fs.mkdirSync(data, { recursive: true });
		fs.writeFileSync(path.join(data, 'localStorage.json'), JSON.stringify({ 'horosa.localCharts.v1': '{"broken":' }));
		const child = runtimeChild(home, `
			const lr = await rt.dispatch('tools/call', { name: 'list_records', arguments: {} }, { clientName: 'test' });
			const texts = (lr && lr.result && lr.result.content || []).map((c)=>c.text || '');
			const keys = require(${JSON.stringify(RUNTIME)}).corruptArchiveKeysOf(rt.storage);
			say({ hint: texts.some((t)=>t.indexOf('内容留档') >= 0), main: rt.storage.getItem('horosa.localCharts.v1'), kept: keys.map((k)=>rt.storage.getItem(k)) });
			process.exit(0);
		`);
		const got = await collect(child);
		const fatal = got.find((x)=>x.fatal);
		assert.ok(!fatal, fatal && fatal.fatal);
		assert.equal(got[0].hint, true);
		assert.equal(got[0].main, '[]');
		assert.deepEqual(got[0].kept, ['{"broken":']);
	});
});
