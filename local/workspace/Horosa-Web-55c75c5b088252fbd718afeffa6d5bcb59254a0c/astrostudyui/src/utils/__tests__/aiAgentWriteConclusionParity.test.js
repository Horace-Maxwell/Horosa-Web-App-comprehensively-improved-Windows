// 写入「有没有变化」四路同结论:对话 / 外部客户端 × 每次确认 / 自动,同一调用给出同一个结论(改了 / 没变),
// 每次确认档下「没变」= 不弹审批、零写入、零账本;「改了」= 必经一次审批才落盘(审批绕过的反向锁)。
// 判据单源 planSettingsWrite(按存储键):从没存过、值恰好等于缺省的项写进去 = 一次落盘(要审批),不是「无变化」。
// 另锁:外部桥见预览自报 reject 直接按该码回、永不进 runTool;同参连调两次第二次不进账本 / 不计外部写入额度。
import fs from 'fs';
import path from 'path';
import { registerBuiltinTools } from '../aiTools';
import * as registry from '../aiTools/registry';
import { registerWorkspaceBridge, __resetWorkspaceBridgeForTests } from '../aiTools/workspaceBridge';
import { __resetLedgerForTests, listActions } from '../aiTools/ledger';
import { setGlobalStore } from '../storageutil';
import { saveMountTechniqueDefaults, getMountTechniqueDefault } from '../techniqueMountSettings';
import { geoPairToRecordFields } from '../aiTools/normalize/geoCompass';
import { setAgentEnabled, setExternalPolicy } from '../aiAgent/prefs';
import { listPendingApprovals, resolveApproval, __resetApprovalsForTests } from '../aiAgent/approvals';
import { handleAgentToolRequest, __resetMcpBridgeForTests, externalPolicyBlock } from '../aiAgent/mcpBridge';
import { createAgentTurn } from '../aiAgent/runtime';

const flush = ()=>new Promise((r)=>setTimeout(r, 0));
let store;
function resetWorld(){
	window.localStorage.clear();
	registry.__resetToolsForTests(); __resetLedgerForTests(); __resetWorkspaceBridgeForTests(); __resetApprovalsForTests();
	if(typeof __resetMcpBridgeForTests === 'function'){ __resetMcpBridgeForTests(); }
	const g = geoPairToRecordFields(39.9, 116.4);
	store = {
		app: { appearanceMode: 'light', colorTheme: 0 },
		astro: { fields: { hsys: { value: 1 }, zodiacal: { value: 0 }, pos: { value: '北京' }, lat: { value: g.lat }, lon: { value: g.lon }, gpsLat: { value: g.gpsLat }, gpsLon: { value: g.gpsLon } } },
	};
	const dispatch = jest.fn((a)=>{ if(a && a.type === 'app/save'){ store.app = { ...store.app, ...a.payload }; } });
	const changeCond = jest.fn((patch)=>{ const f = { ...store.astro.fields }; Object.keys(patch || {}).forEach((k)=>{ if(k !== 'confirmed' && k !== 'fromAgent'){ f[k] = { value: patch[k] }; } }); store.astro = { ...store.astro, fields: f }; });
	registerWorkspaceBridge({ dispatch, changeCond });
	setGlobalStore(store);
	registerBuiltinTools();
	setAgentEnabled(true);
}
// 观测面:本次可能落盘的存储全集(设置六面的存储 + 盘面字段)
// (账本另计;运行时自己的能力缓存 horosa.ai.agent.caps 不是设置)
const worldState = ()=>JSON.stringify({ ls: Object.keys(window.localStorage).filter((k)=>k.indexOf('ledger') < 0 && k.indexOf('horosa.ai.agent.caps') < 0).sort().map((k)=>[k, window.localStorage.getItem(k)]), fields: store.astro.fields });

// 四面 × 两种情形(真改 / 写的就是现状)。prep 在每一路之前把世界摆成同一个样
const guolaoLifeMode = async ()=>{
	const d = await registry.runTool('describe_settings', { facet: 'technique', technique: 'guolao' }, { origin: 'in-app' });
	return d.data.items.find((it)=>it.key === 'lifeMode');
};
const CASES = [
	{ id: 'page·从没存过、值等于缺省(落盘 = 有变化)', changed: true, prep: async ()=>{}, args: async ()=>({ facet: 'page', technique: 'liureng', values: { guireng: 2 } }) },
	{ id: 'page·已存同值', changed: false, prep: async ()=>{ window.localStorage.setItem('horosa.liureng.settings.v1', JSON.stringify({ v: 1, values: { guireng: 2 } })); }, args: async ()=>({ facet: 'page', technique: 'liureng', values: { guireng: 2 } }) },
	{ id: 'technique·写现值(剪枝不落盘)', changed: false, prep: async ()=>{}, args: async ()=>({ facet: 'technique', technique: 'guolao', values: { lifeMode: (await guolaoLifeMode()).current } }) },
	{ id: 'technique·写别的档', changed: true, prep: async ()=>{}, args: async ()=>{ const it = await guolaoLifeMode(); return { facet: 'technique', technique: 'guolao', values: { lifeMode: it.options.find((o)=>`${o.value}` !== `${it.current}`).value } }; } },
	{ id: 'mount·从没存过(写进同类默认 = 有变化)', changed: true, prep: async ()=>{}, args: async ()=>({ facet: 'mount', technique: 'bazi', values: { phaseType: 0 } }) },
	{ id: 'mount·已存同值', changed: false, prep: async ()=>{ saveMountTechniqueDefaults('bazi', { phaseType: 0 }); expect(getMountTechniqueDefault('bazi').phaseType).toBe(0); }, args: async ()=>({ facet: 'mount', technique: 'bazi', values: { phaseType: 0 } }) },
	{ id: 'chart·宫制写现值', changed: false, prep: async ()=>{}, args: async ()=>({ facet: 'chart', values: { hsys: 1 } }) },
	{ id: 'chart·按经纬度写同一地点(地名随之清空 = 有变化)', changed: true, prep: async ()=>{}, args: async ()=>({ facet: 'chart', values: { gpsLat: 39.9, gpsLon: 116.4 } }) },
];

// 一路调用 → { ok, code, approvals, ledgerDelta, wrote }
async function viaMcp(args, approval){
	setExternalPolicy({ approval });
	const ledger0 = listActions().length;
	const s0 = worldState();
	let approvals = 0;
	const p = handleAgentToolRequest({ id: 7, method: 'tools/call', clientName: 'parity', params: { name: 'set_settings', arguments: args } }, registry);
	let settled = false;
	p.then(()=>{ settled = true; });
	for(let i = 0; i < 400 && !settled; i++){
		await flush();   // eslint-disable-line no-await-in-loop
		const pend = listPendingApprovals('mcp:parity');
		if(pend.length){ approvals += pend.length; pend.forEach((x)=>resolveApproval(x.callId, true, 'mcp:parity')); }
	}
	const r = await p;
	const body = JSON.parse(r.result.content[0].text);
	return { ok: body.ok, code: body.code || null, approvals, ledgerDelta: listActions().length - ledger0, wrote: worldState() !== s0 };
}
async function viaChat(args, mode){
	const ledger0 = listActions().length;
	const s0 = worldState();
	const ask = jest.fn(async ()=>true);
	const agent = createAgentTurn({ enabled: true, profile: { id: 'p' }, model: 'm', approvalMode: mode, requestApproval: ask });
	const evs = [{ type: 'tool_call_start', json: { id: 'c1', name: 'set_settings', index: 0 } }, { type: 'tool_call', json: { id: 'c1', name: 'set_settings', index: 0, arguments: JSON.stringify(args) } }, { type: 'done', json: { finish_reason: 'tool_calls' } }];
	let round = 0;
	do{
		agent.beginRound();
		(round === 0 ? evs : [{ type: 'done', json: { finish_reason: 'stop' } }]).forEach((e)=>agent.onEvent(e));
		round += 1;
	}while(await agent.settleRound() && round < 3);   // eslint-disable-line no-await-in-loop
	const res = agent.trace().rounds[0].results[0];
	return { ok: !!res.ok, code: res.code || null, approvals: ask.mock.calls.length, ledgerDelta: listActions().length - ledger0, wrote: worldState() !== s0 };
}
const ROUTES = [
	['对话 · 每次确认', (a)=>viaChat(a, 'on-request'), true],
	['对话 · 自动', (a)=>viaChat(a, 'never'), false],
	['外部 · 每次确认', (a)=>viaMcp(a, 'on-request'), true],
	['外部 · 自动', (a)=>viaMcp(a, 'auto'), false],
];

describe('四路同结论(set_settings × 四面)', ()=>{
	CASES.forEach((c)=>{
		it(`🔴 ${c.id}`, async ()=>{
			const seen = [];
			for(const [label, run, asks] of ROUTES){
				resetWorld();
				await c.prep();   // eslint-disable-line no-await-in-loop
				const a = await c.args();   // eslint-disable-line no-await-in-loop
				const r = await run(a);   // eslint-disable-line no-await-in-loop
				seen.push([label, r.ok, r.code]);
				if(c.changed){
					expect([label, r.ok, r.wrote, r.ledgerDelta]).toEqual([label, true, true, 1]);
					expect([label, r.approvals]).toEqual([label, asks ? 1 : 0]);   // 每次确认档:落盘前必经一次审批
				}else{
					expect([label, r.ok, r.code, r.wrote, r.ledgerDelta, r.approvals]).toEqual([label, false, 'E_SETTING_NO_CHANGE', false, 0, 0]);
				}
			}
			// 四路结论逐字相同
			expect(new Set(seen.map((x)=>`${x[1]}|${x[2]}`)).size).toBe(1);
		});
	});
});

describe('无变化收口在注册表(同参连调两次)', ()=>{
	beforeEach(()=>{ resetWorld(); });
	const mkChart = async ()=>{
		const r = await registry.runTool('create_chart_record', { name: '无变化甲', birth: '1990-01-01 08:00', gender: 'male', place: '北京', selectAsAnalysisSource: false }, { origin: 'in-app' });
		return r.data.cid;
	};
	it('🔴 星标 / 置顶 / 标签:第二次不进账本、不发 tool.after、外部不计写入额度、每次确认档不弹审批', async ()=>{
		const cid = await mkChart();
		const calls = [['star_record', { recordId: cid }], ['pin_record', { recordId: cid }], ['add_record_tag', { recordId: cid, tag: '客户' }]];
		for(const [name, args] of calls){
			const first = await registry.runTool(name, args, { origin: 'in-app' });   // eslint-disable-line no-await-in-loop
			expect([name, first.ok, first.data.changed]).toEqual([name, true, true]);
			const n0 = listActions().length;
			const again = await registry.runTool(name, args, { origin: 'in-app' });   // eslint-disable-line no-await-in-loop
			expect([name, again.ok, again.data.changed, again.noChange, again.undo]).toEqual([name, true, false, true, undefined]);
			expect([name, listActions().length]).toEqual([name, n0]);
			// 外部每次确认档:无变化预检先于审批,零审批条目
			setExternalPolicy({ approval: 'on-request' });
			const p = handleAgentToolRequest({ id: 9, method: 'tools/call', clientName: 'nc', params: { name, arguments: args } }, registry);
			let pend = 0;
			for(let i = 0; i < 60; i++){ await flush(); pend = Math.max(pend, listPendingApprovals('mcp:nc').length); }   // eslint-disable-line no-await-in-loop
			const r = JSON.parse((await p).result.content[0].text);   // eslint-disable-line no-await-in-loop
			expect([name, pend, r.ok, r.noChange, listActions().length]).toEqual([name, 0, true, true, n0]);
		}
	});
	it('判别力:没声明 noChange 的写入工具执行回 changed:false 也照样不进账本(注册表兜底)', async ()=>{
		registry.registerTool({ name: 'probe_same_write', level: 'additive', category: 'records', description: `探针 仅当用户明确要求时调用`, inputSchema: { type: 'object', additionalProperties: false, properties: {} }, run: async ()=>({ ok: true, data: { changed: false }, message: '没变' }) });
		const n0 = listActions().length;
		const r = await registry.runTool('probe_same_write', {}, { origin: 'in-app' });
		expect(r.noChange).toBe(true); expect(listActions().length).toBe(n0);
	});
});

describe('静态锁', ()=>{
	const src = (rel)=>fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
	it('🔴 外部桥:预览自报 reject 的分支不得放行执行(不得 allowed = true;直接按该码落定)', ()=>{
		const br = src('aiAgent/mcpBridge.js');
		const i = br.indexOf('}else if(preview && preview.reject){');
		expect(i).toBeGreaterThan(0);
		const branch = br.slice(i, br.indexOf('}else{', i));
		expect(branch).not.toMatch(/allowed\s*=\s*true/);
		expect(branch).toMatch(/precheck\s*=\s*\{\s*ok:\s*false,\s*code:\s*preview\.reject\.code/);
		// 落定的结果先于执行判定:precheck 有值 ⇒ 不进 runTool
		const iPre = br.indexOf('if(precheck){');
		const iRun = br.indexOf('d.runTool(name, args, ctx)');
		expect(iPre).toBeGreaterThan(0); expect(iPre).toBeLessThan(iRun);
	});
	it('🔴 无变化预检:对话运行时与外部桥都在挂审批之前调 peekNoChange;注册表执行前调同一个 def.noChange', ()=>{
		const rt = src('aiAgent/runtime.js');
		expect(rt.indexOf('registry.peekNoChange(')).toBeGreaterThan(0);
		expect(rt.indexOf('registry.peekNoChange(')).toBeLessThan(rt.indexOf('opts.requestApproval({ callId: call.id'));
		const br = src('aiAgent/mcpBridge.js');
		expect(br.indexOf('d.peekNoChange(')).toBeGreaterThan(0);
		expect(br.indexOf('d.peekNoChange(')).toBeLessThan(br.indexOf('const approvalP = requestApproval('));
		const reg = src('aiTools/registry.js');
		const body = reg.slice(reg.indexOf('async function runToolOnce('));
		expect(body.indexOf('callNoChange(def, validated.data')).toBeGreaterThan(0);
		expect(body.indexOf('callNoChange(def, validated.data')).toBeLessThan(body.indexOf('reserveAction({'));
	});
	it('🔴 set_settings:预览 reject、无变化预检、执行回包三处同一判据(planSettingsWrite / settingsChangedKeys),预览不再按含缺省的现值判', ()=>{
		const ss = src('aiTools/tools/setSettings.js');
		expect(ss).toMatch(/planSettingsWrite\(/);
		expect(ss).toMatch(/settingsChangedKeys\(args\.facet/);
		expect(ss).not.toMatch(/sameSettingValue\(cur\[k\]/);   // 判别力向量:改回「按 describe 现值判无变化」即红
		const sf = src('aiTools/settingsFacets.js');
		expect(sf).toMatch(/const moved = keys\.filter\(\(k\)=>!storedSettingValueSame\(facet, k/);   // 撤销核对同一个值相等判据
	});
	it('🔴 目录合同:执行回包里会出现 changed: false(或提案 status:\'unchanged\')的写入工具必须声明 noChange(无变化预检)', ()=>{
		resetWorld();
		const dir = path.join(__dirname, '../aiTools/tools');
		const strip = (t)=>t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
		const files = fs.readdirSync(dir).filter((f)=>/\.js$/.test(f)).map((f)=>strip(fs.readFileSync(path.join(dir, f), 'utf8')));
		// 一件工具的源码 = 它的定义段(name: 'x' 到下一个顶层定义)+ 段内调用到的本文件顶层函数
		const segOf = (name)=>{
			const src = files.find((t)=>t.indexOf(`name: '${name}'`) >= 0);
			if(!src){ return ''; }
			const i = src.indexOf(`name: '${name}'`);
			const nexts = [src.indexOf('\nexport ', i), src.indexOf('\nconst ', i), src.indexOf('\nfunction ', i)].filter((x)=>x > i);
			const seg = src.slice(i, nexts.length ? Math.min(...nexts) : src.length);
			const helpers = [];
			src.replace(/\nfunction (\w+)\(([\s\S]*?)\n}/g, (m, fn)=>{ if(seg.indexOf(`${fn}(`) >= 0){ helpers.push(m); } return m; });
			return seg + helpers.join('\n');
		};
		const NO_CHANGE_RE = /changed:\s*false|status:\s*'unchanged'/;
		const offenders = registry.listTools().filter((d)=>d.level === 'additive' && d.origin === 'builtin' && NO_CHANGE_RE.test(segOf(d.name)) && typeof d.noChange !== 'function').map((d)=>d.name);
		expect(offenders).toEqual([]);
		// 判别力:扫描器看得见星标那件的无变化回包(改回「只在 run 里回 changed:false、不声明 noChange」即红)
		expect(NO_CHANGE_RE.test(segOf('star_record'))).toBe(true);
		expect(NO_CHANGE_RE.test(segOf('append_record_journal'))).toBe(false);
	});
});

describe('外部目录「列出来」⇔ 调用不被审批档拒(同一判据 externalPolicyBlock)', ()=>{
	beforeEach(()=>{ resetWorld(); });
	const list = async ()=>(await handleAgentToolRequest({ id: 1, method: 'tools/list', clientName: 'cat' }, registry)).result.tools.map((t)=>t.name);
	it('🔴 三档 × 全目录逐件等价;只读档不列写入工具,调用照拒且不执行;切档目录随之变(缓存键含审批档)', async ()=>{
		const full = registry.exportToolManifest({ includeExternal: false, origin: 'mcp' });
		expect(full.some((t)=>t.level === 'additive')).toBe(true);
		for(const approval of ['auto', 'on-request', 'read-only']){
			setExternalPolicy({ approval });
			const names = await list();   // eslint-disable-line no-await-in-loop
			full.forEach((t)=>{ expect([approval, t.name, names.indexOf(t.name) >= 0]).toEqual([approval, t.name, !externalPolicyBlock(t, { approval })]); });
			if(approval === 'read-only'){
				expect(names.some((n)=>full.find((t)=>t.name === n).level === 'additive')).toBe(false);
				const spy = jest.spyOn(registry, 'runTool');
				const r = await handleAgentToolRequest({ id: 2, method: 'tools/call', clientName: 'cat', params: { name: 'star_record', arguments: { recordId: 'local-x' } } }, { ...registry, runTool: spy });   // eslint-disable-line no-await-in-loop
				expect(JSON.parse(r.result.content[0].text).code).toBe('E_APPROVAL_DENIED');
				expect(spy).not.toHaveBeenCalled();
				spy.mockRestore();
			}else{
				expect(names.indexOf('star_record')).toBeGreaterThanOrEqual(0);
			}
		}
	});
});
