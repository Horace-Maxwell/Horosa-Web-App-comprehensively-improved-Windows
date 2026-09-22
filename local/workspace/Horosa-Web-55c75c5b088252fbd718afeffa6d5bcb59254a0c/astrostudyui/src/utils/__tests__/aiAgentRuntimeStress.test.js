// AI 助手·运行时对抗压测:随机事件流(坏 JSON/重复 id/巨型参数/中途 error/abort/无 finish_reason)、
// 随机工具行为(慢/抛/失败)、随机审批;不变量:永不抛、trace 可序列化、限额恒守、状态合法;围栏解析模糊。
import { createAgentTurn, NULL_AGENT, AGENT_LIMITS } from '../aiAgent/runtime';
import { parseActionBlock, stripActionBlockForDisplay, buildToolResultsEnvelope } from '../aiAgent/textProtocol';
import { expandHistory, plainMessages, formatToolResultContent, foldToolResultContent } from '../aiAgent/protocol';
import { AGENT_ENABLED_KEY, AGENT_APPROVAL_KEY } from '../aiAgent/prefs';

function mulberry32(seed){ let a = seed >>> 0; return ()=>{ a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const MANIFEST = [
	{ name: 'r_a', level: 'read', cacheable: true, description: 'r', inputSchema: { type: 'object', properties: {} } },
	{ name: 'r_b', level: 'read', description: 'r', inputSchema: { type: 'object', properties: {} } },
	{ name: 'w_a', level: 'additive', description: 'w', inputSchema: { type: 'object', properties: {} } },
	{ name: 'w_b', level: 'additive', description: 'w', inputSchema: { type: 'object', properties: {} } },
];
const sleep = (ms)=>new Promise((r)=>setTimeout(r, ms));
const STATUSES = ['running', 'completed', 'failed', 'skipped', 'undone'];

function mkRegistry(rnd){
	const runTool = jest.fn(async (name)=>{
		const r = rnd();
		if(r < 0.1){ throw new Error('boom'); }
		if(r < 0.2){ await sleep(5); }
		if(r < 0.35){ return { ok: false, code: 'E_ARGS_INVALID', message: 'bad' }; }
		return { ok: true, data: { name, blob: 'x'.repeat(Math.floor(rnd() * 20000)) }, summary: 's', undo: name.startsWith('w') ? { actionId: `act-${Math.floor(rnd() * 1e9)}`, kind: 'trash-record' } : undefined };
	});
	return { exportToolManifest: ()=>MANIFEST, runTool, getTool: (n)=>MANIFEST.find((m)=>m.name === n) };
}
function randArgsText(rnd){
	const r = rnd();
	if(r < 0.3){ return '{bad json'; }
	if(r < 0.4){ return ''; }
	if(r < 0.5){ return '[1,2,3]'; }
	if(r < 0.6){ return JSON.stringify({ big: 'y'.repeat(200000) }); }
	return JSON.stringify({ q: 'ok', n: Math.floor(rnd() * 100) });
}
function randRound(rnd, ids){
	const evs = [];
	const n = Math.floor(rnd() * 12);
	for(let i = 0; i < n; i++){
		const r = rnd();
		if(r < 0.25){ evs.push({ type: 'delta', json: { delta: '文' + i } }); }
		else if(r < 0.35){ evs.push({ type: 'reasoning', json: { reasoning: '思' } }); }
		else if(r < 0.45){ evs.push({ type: 'usage', json: { input_tokens: 5, output_tokens: 1, total_tokens: 6 } }); }
		else if(r < 0.6){ const id = rnd() < 0.3 ? ids[Math.floor(rnd() * ids.length)] : `c${Math.floor(rnd() * 1e6)}`; ids.push(id); evs.push({ type: 'tool_call_start', json: { id, name: rnd() < 0.8 ? MANIFEST[Math.floor(rnd() * 4)].name : 'ghost', index: i } }); }
		else if(r < 0.85){ const id = rnd() < 0.5 && ids.length ? ids[Math.floor(rnd() * ids.length)] : `c${Math.floor(rnd() * 1e6)}`; ids.push(id); evs.push({ type: 'tool_call', json: { id, name: rnd() < 0.85 ? MANIFEST[Math.floor(rnd() * 4)].name : (rnd() < 0.5 ? '' : 'delete_x'), index: i, arguments: randArgsText(rnd), parseError: rnd() < 0.05 ? 'x' : undefined } }); }
		else if(r < 0.9){ evs.push({ type: 'error', json: { message: rnd() < 0.5 ? 'upstream broke' : 'This model does not support tools' } }); }
		else { evs.push({ type: 'weird', json: { x: 1 } }); }
	}
	if(rnd() < 0.85){ evs.push({ type: 'done', json: { finish_reason: rnd() < 0.5 ? 'tool_calls' : (rnd() < 0.5 ? 'stop' : undefined) } }); }
	return evs;
}

async function drive(agent, rounds, ac, history){
	let error = null;
	let guard = 0;
	do{
		guard += 1;
		if(guard > 20){ throw new Error('runaway loop'); }
		agent.beginRound();
		// 每轮同页面一样构造请求消息(历史带前几个种子留下的真 trace,吃随机回放分级策略):永不抛、恒为数组
		const msgs = agent.messagesForRound(history || []);
		expect(Array.isArray(msgs)).toBe(true);
		msgs.forEach((m)=>expect(['system', 'user', 'assistant', 'tool']).toContain(m.role));
		const evs = rounds.shift() || [{ type: 'done', json: { finish_reason: 'stop' } }];
		try{
			for(const e of evs){
				if(e.throw){ throw e.throw; }
				agent.onEvent(e);
				if(ac && Math.random() < 0.02){ ac.abort(); }
			}
		}catch(e){
			if(!agent.absorbStreamError(e)){ error = e; break; }
		}
	}while(await agent.settleRound());
	return { error, guard };
}

function assertTraceInvariants(t){
	expect(JSON.parse(JSON.stringify(t))).toEqual(t);
	expect(t.rounds.length).toBeLessThanOrEqual(AGENT_LIMITS.MAX_ROUNDS + 1);
	let total = 0;
	t.rounds.forEach((r)=>{
		expect(r.results.length).toBeLessThanOrEqual(AGENT_LIMITS.MAX_CALLS_PER_ROUND + 8);
		r.results.forEach((x)=>{ expect(STATUSES).toContain(x.status); expect(typeof x.content).toBe('string'); expect(x.content.length).toBeLessThanOrEqual(AGENT_LIMITS.RESULT_MAX_CHARS + 600); if(x.status !== 'skipped'){ total += 1; } });
	});
	expect(total).toBeLessThanOrEqual(AGENT_LIMITS.MAX_CALLS_PER_TURN + AGENT_LIMITS.MAX_CALLS_PER_ROUND);
	expect(['stop', 'aborted', 'max_rounds', 'route_close', 'error', null]).toContain(t.stopReason);
}

beforeEach(()=>{ window.localStorage.clear(); window.localStorage.setItem(AGENT_ENABLED_KEY, '1'); });

describe('随机对抗事件流', ()=>{
	it('🔴 160 个种子:永不抛、trace 可序列化、限额恒守、总请求数 ≤ MAX_ROUNDS(随机回放分级/折叠预算/同参去重策略)', async ()=>{
		const history = [{ role: 'system', content: 'S' }, { role: 'user', content: 'u0' }];
		for(let seed = 1; seed <= 160; seed++){
			const rnd = mulberry32(seed);
			window.localStorage.removeItem('horosa.ai.agent.caps.v1');   // 每种子从原生模式起(已记 text 的模型再抛「不支持 tools」是真错误,不吸收)
			window.localStorage.setItem(AGENT_APPROVAL_KEY, rnd() < 0.3 ? 'on-request' : 'never');
			const ac = new AbortController();
			const reg = mkRegistry(rnd);
			// 随机上下文策略(含非法值:负数/字符串/null 一律回缺省)+ 半数种子开同参去重
			const policy = rnd() < 0.2 ? undefined : { traceTurnsFull: [0, 1, 2, 3, -1, 'x', null][Math.floor(rnd() * 7)], traceTurnsFolded: [0, 1, 2, 5, -2, null][Math.floor(rnd() * 6)], foldedResultMaxChars: rnd() < 0.5 ? 200 + Math.floor(rnd() * 2000) : { read: 200 + Math.floor(rnd() * 2000), additive: rnd() < 0.5 ? 0 : 300 }, dedupSameCall: rnd() < 0.5 };
			const agent = createAgentTurn({ profile: { id: `p${seed % 5}` }, model: `m${seed % 3}`, registry: reg, signal: ac.signal, requestApproval: async ()=>rnd() < 0.5, onTrace: (t)=>{ expect(JSON.parse(JSON.stringify(t))).toBeTruthy(); }, ...(policy ? { contextPolicy: policy } : {}) });
			const ids = [];
			const rounds = Array.from({ length: 10 }, ()=>randRound(rnd, ids));
			if(rnd() < 0.15){ rounds.unshift([{ throw: new Error('Unrecognized request argument supplied: tools') }]); }
			const { error, guard } = await drive(agent, rounds, rnd() < 0.2 ? ac : null, history);
			expect(error).toBe(null);
			expect(guard).toBeLessThanOrEqual(AGENT_LIMITS.MAX_ROUNDS + 1);
			const t = agent.trace();
			assertTraceInvariants(t);
			// 去重命中:只指向本 Turn 内更早的调用,且被指向者确有 ok 结果
			const seen = new Map();
			t.rounds.forEach((r)=>r.results.forEach((x)=>{ if(x.dedupOf !== undefined){ expect(seen.get(x.dedupOf)).toBe(true); expect(x.ok).toBe(true); } seen.set(x.callId, seen.get(x.callId) || (x.ok && !x.dedupOf)); }));
			expect(typeof agent.mergeUsage({ x: 1 })).toBe('object');
			// 本种子的真 trace 进历史(保留最近 3 个 Turn),供后续种子随机分级回放
			history.push({ role: 'assistant', content: `a${seed}`, agentTrace: t }, { role: 'user', content: `u${seed}` });
			while(history.length > 8){ history.splice(2, 2); }
		}
	});
	it('关闭态 NULL_AGENT 在随机消息上恒等旧 map', ()=>{
		window.localStorage.removeItem(AGENT_ENABLED_KEY);
		const rnd = mulberry32(7);
		for(let i = 0; i < 50; i++){
			const base = Array.from({ length: Math.floor(rnd() * 8) }, (_, k)=>({ role: ['system', 'user', 'assistant'][k % 3], content: `c${k}`, images: rnd() < 0.3 ? ['data:image/png;base64,x'] : undefined, agentTrace: rnd() < 0.5 ? { rounds: [{ text: 't', toolCalls: [{ id: '1', name: 'r_a', args: {} }], results: [{ callId: '1', name: 'r_a', content: 'x' }] }] } : undefined }));
			const agent = createAgentTurn({ registry: mkRegistry(rnd) });
			expect(agent).toBe(NULL_AGENT);
			expect(agent.messagesForRound(base)).toEqual(plainMessages(base));
			expect(agent.toolDefs()).toBeUndefined();
		}
	});
});

describe('围栏协议模糊', ()=>{
	it('parse/strip 永不抛,strip 幂等;信封往返', ()=>{
		const rnd = mulberry32(99);
		const frags = ['```horosa-action\n', '```json\n', '```\n', '{"__horosaType":"action","calls":[{"name":"r_a","args":{}}]}', '{"__horosaType":"action","calls":"nope"}', '{bad', '\n```', '```', '正文', '{"calls":[]}', '```horosa-action\n{"__horosaType":"action","calls":[{"id":"k","name":"w_a","args":{"x":1}}]}\n```'];
		for(let i = 0; i < 600; i++){
			const text = Array.from({ length: 1 + Math.floor(rnd() * 8) }, ()=>frags[Math.floor(rnd() * frags.length)]).join(rnd() < 0.5 ? '\n' : '');
			let hit;
			expect(()=>{ hit = parseActionBlock(text); }).not.toThrow();
			const once = stripActionBlockForDisplay(text);
			// 只剥正文末尾那块(引用块不执行也不剥);再剥一次只可能继续剥「新变成末尾」的块,永不增长、永不抛
			let twice;
			expect(()=>{ twice = stripActionBlockForDisplay(once); }).not.toThrow();
			expect(twice.length).toBeLessThanOrEqual(once.length);
			expect(hit ? once.length < text.length : once === text).toBe(true);
			if(hit){ hit.calls.forEach((c)=>{ expect(typeof c.name).toBe('string'); expect(c.args && typeof c.args).toBe('object'); }); }
		}
		const env = buildToolResultsEnvelope([{ callId: 'a', name: 'r_a', content: 'x'.repeat(10000), isError: false }]);
		expect(env.length).toBeGreaterThan(10000);
	});
	it('历史展开与结果截断在随机 trace 上恒守形状(含随机回放分级与折叠预算)', ()=>{
		const rnd = mulberry32(5);
		const randContent = ()=>{
			const r = rnd();
			if(r < 0.3){ return 'x'.repeat(Math.floor(rnd() * 3000)); }
			if(r < 0.5){ return formatToolResultContent({ ok: rnd() < 0.7, code: rnd() < 0.5 ? 'E_X' : undefined, message: 'm'.repeat(Math.floor(rnd() * 2000)), assumptions: rnd() < 0.5 ? Array.from({ length: Math.floor(rnd() * 12) }, (_, j)=>`a${j}`.repeat(30)) : undefined, data: { content: rnd() < 0.5 ? '[起盘信息]\n甲\n[四柱]\n乙\n' + 'z'.repeat(Math.floor(rnd() * 8000)) : 'z'.repeat(Math.floor(rnd() * 20000)), items: Array.from({ length: Math.floor(rnd() * 30) }, (_, j)=>({ j, nest: { deep: { deeper: j } } })) } }, { maxChars: 8000 }).content; }
			if(r < 0.7){ return JSON.stringify({ __horosaType: 'toolResult', untrusted: true, ok: true, data: rnd() < 0.5 ? null : [1, 'two', { three: 3 }, [4]] }); }
			return JSON.stringify({ not: 'envelope', big: 'q'.repeat(Math.floor(rnd() * 5000)) });
		};
		const pairingOk = (msgs)=>{
			let expectTool = null;
			msgs.forEach((m)=>{
				if(expectTool){ expect(m.role).toBe('tool'); expect(m.toolResults.map((x)=>x.callId)).toEqual(expectTool); expectTool = null; }
				if(m.role === 'assistant' && m.toolCalls){ expectTool = m.toolCalls.map((c)=>c.id); }
			});
			expect(expectTool).toBe(null);
		};
		for(let i = 0; i < 100; i++){
			const mkRounds = ()=>Array.from({ length: Math.floor(rnd() * 4) }, (_, k)=>({ index: k, text: 't' + k, toolCalls: rnd() < 0.7 ? [{ id: 'c' + i + '-' + k, name: 'r_a', args: { k } }] : [], results: rnd() < 0.7 ? [{ callId: 'c' + i + '-' + k, name: 'r_a', level: rnd() < 0.5 ? 'read' : (rnd() < 0.5 ? 'additive' : null), content: randContent(), isError: rnd() < 0.3 }] : [], providerMeta: rnd() < 0.3 ? { sig: 's' } : null }));
			const base = [{ role: 'system', content: 'S' }, { role: 'user', content: 'u' }, { role: 'assistant', content: 'a', agentTrace: { mode: rnd() < 0.5 ? 'text' : 'native', rounds: mkRounds() } }, { role: 'user', content: 'u2' }, { role: 'assistant', content: 'b', agentTrace: { mode: rnd() < 0.5 ? 'text' : 'native', rounds: mkRounds() } }, { role: 'user', content: 'u3' }];
			const native = expandHistory(base, { traceTurns: 2 });
			const text = expandHistory(base, { traceTurns: 2, mode: 'text' });
			native.forEach((m)=>expect(['system', 'user', 'assistant', 'tool']).toContain(m.role));
			expect(text.some((m)=>m.role === 'tool' || m.toolCalls)).toBe(false);
			pairingOk(native);
			// 随机分级参数(含非法值):永不抛、角色合法、native 配对完整、折叠正文守各自预算
			const foldMax = rnd() < 0.5 ? 200 + Math.floor(rnd() * 3000) : { read: 200 + Math.floor(rnd() * 3000), additive: rnd() < 0.3 ? -5 : 200 + Math.floor(rnd() * 1000) };
			const opts = { traceTurnsFull: [0, 1, 2, -1, 'x', 1.5][Math.floor(rnd() * 6)], traceTurnsFolded: [0, 1, 2, 9, -1, null][Math.floor(rnd() * 6)], foldMaxChars: rnd() < 0.2 ? 'garbage' : foldMax, mode: rnd() < 0.4 ? 'text' : undefined };
			let tiered;
			expect(()=>{ tiered = expandHistory(base, opts); }).not.toThrow();
			tiered.forEach((m)=>expect(['system', 'user', 'assistant', 'tool']).toContain(m.role));
			if(opts.mode === 'text'){ expect(tiered.some((m)=>m.role === 'tool' || m.toolCalls)).toBe(false); }else{ pairingOk(tiered); }
			const cap = typeof foldMax === 'number' ? foldMax : Math.max(foldMax.read, foldMax.additive > 0 ? foldMax.additive : 600);
			tiered.filter((m)=>m.role === 'tool').forEach((m)=>m.toolResults.forEach((r)=>{ expect(typeof r.content).toBe('string'); if(r.content.indexOf('"folded":true') >= 0){ expect(r.content.length).toBeLessThanOrEqual(Math.max(cap, 1200)); } }));
			// 折叠函数自身:守上限、确定性、永不抛;折叠结果再折叠仍是合法 JSON 信封
			const c = randContent();
			const m = 200 + Math.floor(rnd() * 3000);
			let f;
			expect(()=>{ f = foldToolResultContent(c, { maxChars: m }); }).not.toThrow();
			expect(f.length).toBeLessThanOrEqual(m);
			expect(foldToolResultContent(c, { maxChars: m })).toBe(f);
			if(c.indexOf('"__horosaType":"toolResult"') === 0 || c.indexOf('{"__horosaType":"toolResult"') === 0){ expect(JSON.parse(f).__horosaType).toBe('toolResult'); expect(JSON.parse(foldToolResultContent(f, { maxChars: m })).folded).toBe(true); }
			const fmt = formatToolResultContent({ ok: true, data: { blob: 'z'.repeat(Math.floor(rnd() * 50000)) } }, { maxChars: 8000 });
			expect(fmt.content.length).toBeLessThanOrEqual(8100);
			expect(()=>JSON.parse(fmt.content)).not.toThrow();
		}
	});
});
