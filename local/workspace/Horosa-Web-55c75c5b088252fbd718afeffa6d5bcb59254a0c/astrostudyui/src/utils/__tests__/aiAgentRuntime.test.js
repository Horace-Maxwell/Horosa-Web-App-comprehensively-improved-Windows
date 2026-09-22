// AI 助手·运行时:总开关判别向量、单轮调用循环、read 并行/additive 串行、轮数收口、abort、
// 「不支持 tools」同轮降级重发、参数错误回喂、围栏模式解析、审批档跳过、usage 合并。
import { createAgentTurn, NULL_AGENT, AGENT_LIMITS, DEFAULT_AGENT_CONTEXT_POLICY, stableStringify } from '../aiAgent/runtime';
import { AGENT_SYSTEM_RULES, expandHistory, injectSystemRules } from '../aiAgent/protocol';
import { ACTION_FENCE } from '../aiAgent/textProtocol';
import { AGENT_ENABLED_KEY, AGENT_APPROVAL_KEY } from '../aiAgent/prefs';
import { getToolCapability, recordToolCapability } from '../aiAgent/caps';

const MANIFEST = [
	{ name: 'probe_read', level: 'read', description: 'r', inputSchema: { type: 'object', additionalProperties: false, properties: { q: { type: 'string' } } }, annotations: { readOnlyHint: true, destructiveHint: false } },
	{ name: 'probe_read2', level: 'read', description: 'r2', inputSchema: { type: 'object', additionalProperties: false, properties: {} }, annotations: { readOnlyHint: true, destructiveHint: false } },
	{ name: 'probe_add', level: 'additive', description: 'a', inputSchema: { type: 'object', additionalProperties: false, properties: { name: { type: 'string' } } }, annotations: { readOnlyHint: false, destructiveHint: false } },
];
const sleep = (ms)=>new Promise((r)=>setTimeout(r, ms));
function mkRegistry(impl){
	const runTool = jest.fn(async (name, args, ctx)=>impl(name, args, ctx));
	return { exportToolManifest: ()=>MANIFEST, runTool, getTool: (n)=>MANIFEST.find((m)=>m.name === n) };
}
// 脚本化伪流:每轮一组事件;{throw:Error} 表示流层抛错
function mkStream(scripts){
	const calls = [];
	const request = jest.fn(async (values, handlers)=>{
		calls.push(values);
		const evs = scripts[calls.length - 1] || [{ type: 'done', json: { finish_reason: 'stop' } }];
		for(const e of evs){
			if(e.throw){ throw e.throw; }
			handlers.onEvent(e);
		}
	});
	return { request, calls };
}
const BASE = [{ role: 'system', content: 'SYS' }, { role: 'user', content: '帮我建档' }];
// 页面 do/while 的最小同构驱动
async function drive(agent, stream, extra){
	let error = null;
	do{
		agent.beginRound();
		try{
			await stream.request({ messages: agent.messagesForRound(BASE), tools: agent.toolDefs(), toolChoice: agent.toolChoice(), ...(extra || {}) }, { onEvent: (e)=>agent.onEvent(e) });
		}catch(e){
			if(!agent.absorbStreamError(e)){ error = e; break; }
		}
	}while(await agent.settleRound());
	return error;
}
const tc = (id, name, args)=>[{ type: 'tool_call_start', json: { id, name, index: 0 } }, { type: 'tool_call', json: { id, name, index: 0, arguments: JSON.stringify(args) } }];

beforeEach(()=>{ window.localStorage.clear(); });

describe('总开关判别向量', ()=>{
	it('缺省/"0"/"true" → NULL_AGENT:无 tools、无规则块、消息与旧 map 逐字段等价', ()=>{
		['unset', '0', 'true', 'yes'].forEach((v)=>{
			if(v === 'unset'){ window.localStorage.removeItem(AGENT_ENABLED_KEY); }else{ window.localStorage.setItem(AGENT_ENABLED_KEY, v); }
			const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: mkRegistry(()=>({ ok: true })) });
			expect(agent).toBe(NULL_AGENT);
			expect(agent.toolDefs()).toBeUndefined();
			expect(agent.toolChoice()).toBeUndefined();
			const msgs = agent.messagesForRound(BASE.concat([{ role: 'assistant', content: 'a', agentTrace: { rounds: [{ text: 'x', toolCalls: [{ id: '1', name: 'probe_read', args: {} }], results: [] }] } }]));
			expect(msgs).toEqual([{ role: 'system', content: 'SYS', images: undefined }, { role: 'user', content: '帮我建档', images: undefined }, { role: 'assistant', content: 'a', images: undefined }]);
			expect(JSON.stringify(msgs).indexOf(AGENT_SYSTEM_RULES.slice(0, 12))).toBe(-1);
		});
	});
	it('"1" → 原生模式:tools=manifest 三字段,规则块在 system 最前', async ()=>{
		window.localStorage.setItem(AGENT_ENABLED_KEY, '1');
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: mkRegistry(()=>({ ok: true })) });
		expect(agent.enabled).toBe(true);
		expect(agent.mode).toBe('native');
		expect(agent.toolDefs()).toEqual(MANIFEST.map((t)=>({ name: t.name, description: t.description, inputSchema: t.inputSchema })));
		expect(agent.toolChoice()).toBe('auto');
		const msgs = agent.messagesForRound(BASE);
		expect(msgs[0].role).toBe('system');
		// [Q-290/PP-22] 守则按当次目录生成:测试目录无两件界面工具 → 第 9 条去掉
		const { agentSystemRulesFor } = require('../aiAgent/protocol');
		expect(msgs[0].content.indexOf(agentSystemRulesFor(MANIFEST.map((t)=>t.name)))).toBe(0);
		expect(msgs[0].content).not.toContain('9) 界面动作');
		expect(msgs[0].content.endsWith('SYS')).toBe(true);
	});
});

describe('循环', ()=>{
	beforeEach(()=>{ window.localStorage.setItem(AGENT_ENABLED_KEY, '1'); });

	it('🔴 一轮调用:执行→回喂(assistant toolCalls + tool toolResults)→二轮正文收尾;trace 两轮;能力记 native', async ()=>{
		const reg = mkRegistry((name, args)=>({ ok: true, data: { cid: 'local-1', echo: args }, summary: '新建命盘', undo: { actionId: 'act-1', kind: 'trash-record' } }));
		const traces = [];
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg, onTrace: (t)=>traces.push(t) });
		const stream = mkStream([
			[{ type: 'delta', json: { delta: '我来建档' } }, ...tc('call_1', 'probe_add', { name: '张三' }), { type: 'usage', json: { input_tokens: 10, output_tokens: 2, total_tokens: 12 } }, { type: 'done', json: { finish_reason: 'tool_calls', providerMeta: { sig: 's' } } }],
			[{ type: 'delta', json: { delta: '已建好' } }, { type: 'usage', json: { input_tokens: 5, output_tokens: 1, total_tokens: 6 } }, { type: 'done', json: { finish_reason: 'stop' } }],
		]);
		const err = await drive(agent, stream);
		expect(err).toBe(null);
		expect(stream.calls.length).toBe(2);
		expect(reg.runTool).toHaveBeenCalledTimes(1);
		expect(reg.runTool.mock.calls[0][0]).toBe('probe_add');
		expect(reg.runTool.mock.calls[0][1]).toEqual({ name: '张三' });
		expect(reg.runTool.mock.calls[0][2].origin).toBe('in-app');
		const second = stream.calls[1].messages;
		const asst = second[second.length - 2];
		const tool = second[second.length - 1];
		expect(asst).toEqual({ role: 'assistant', content: '我来建档', toolCalls: [{ id: 'call_1', name: 'probe_add', args: { name: '张三' } }], providerMeta: { sig: 's', model: 'm' } });
		expect(tool.role).toBe('tool');
		expect(tool.toolResults[0].callId).toBe('call_1');
		const fed = JSON.parse(tool.toolResults[0].content);
		expect(fed.__horosaType).toBe('toolResult');
		expect(fed.untrusted).toBe(true);
		expect(fed.data.cid).toBe('local-1');
		const t = agent.trace();
		expect(t.rounds.length).toBe(2);
		expect(t.stopReason).toBe('stop');
		expect(t.rounds[0].results[0].status).toBe('completed');
		expect(t.rounds[0].results[0].undo).toEqual({ actionId: 'act-1', kind: 'trash-record', label: undefined });
		expect(t.rounds[1].text).toBe('已建好');
		expect(JSON.parse(JSON.stringify(t))).toEqual(t);
		expect(agent.mergeUsage({ model: 'm' })).toEqual(expect.objectContaining({ input_tokens: 15, output_tokens: 3, total_tokens: 18, rounds: 2 }));
		expect(getToolCapability('p', 'm')).toBe('native');
		expect(traces.length).toBeGreaterThan(2);
	});

	it('read 并行 / additive 串行,回喂顺序=模型给出顺序', async ()=>{
		const log = [];
		const reg = mkRegistry(async (name)=>{ log.push(`start:${name}`); await sleep(name === 'probe_read' ? 30 : 5); log.push(`end:${name}`); return { ok: true }; });
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg });
		const stream = mkStream([[
			{ type: 'tool_call', json: { id: 'c1', name: 'probe_add', index: 0, arguments: '{"name":"a"}' } },
			{ type: 'tool_call', json: { id: 'c2', name: 'probe_read', index: 1, arguments: '{}' } },
			{ type: 'tool_call', json: { id: 'c3', name: 'probe_read2', index: 2, arguments: '{}' } },
			{ type: 'tool_call', json: { id: 'c4', name: 'probe_add', index: 3, arguments: '{"name":"b"}' } },
			{ type: 'done', json: { finish_reason: 'tool_calls' } },
		]]);
		await drive(agent, stream);
		expect(log.slice(0, 2)).toEqual(['start:probe_read', 'start:probe_read2']);   // 两 read 同步并发起跑
		expect(log.indexOf('start:probe_add')).toBeGreaterThan(log.indexOf('end:probe_read'));   // additive 等 read 全部结束
		const addStarts = log.map((x, i)=>x === 'start:probe_add' ? i : -1).filter((i)=>i >= 0);
		const addEnds = log.map((x, i)=>x === 'end:probe_add' ? i : -1).filter((i)=>i >= 0);
		expect(addStarts[1]).toBeGreaterThan(addEnds[0]);   // 第二个 additive 等第一个完成
		const tool = stream.calls[1].messages[stream.calls[1].messages.length - 1];
		expect(tool.toolResults.map((r)=>r.callId)).toEqual(['c1', 'c2', 'c3', 'c4']);
	});

	it('轮数上限:第 MAX_ROUNDS 轮 toolChoice=none 收口;模型仍发调用 → max_rounds 停止且不执行', async ()=>{
		const reg = mkRegistry(()=>({ ok: true }));
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg });
		const scripts = [];
		for(let i = 0; i < AGENT_LIMITS.MAX_ROUNDS + 2; i++){ scripts.push([...tc(`c${i}`, 'probe_read', {}), { type: 'done', json: { finish_reason: 'tool_calls' } }]); }
		const stream = mkStream(scripts);
		await drive(agent, stream);
		expect(stream.calls.length).toBe(AGENT_LIMITS.MAX_ROUNDS);
		expect(stream.calls[AGENT_LIMITS.MAX_ROUNDS - 1].toolChoice).toBe('none');
		expect(stream.calls[AGENT_LIMITS.MAX_ROUNDS - 2].toolChoice).toBe('auto');
		expect(reg.runTool).toHaveBeenCalledTimes(AGENT_LIMITS.MAX_ROUNDS - 1);
		expect(agent.trace().stopReason).toBe('max_rounds');
	});

	it('每轮调用数/每 Turn 写入数超限 → 超出者 skipped(E_LIMIT) 不执行', async ()=>{
		const reg = mkRegistry(()=>({ ok: true }));
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg, limits: { MAX_CALLS_PER_ROUND: 2, MAX_ADDITIVE_PER_TURN: 1 } });
		const stream = mkStream([[
			{ type: 'tool_call', json: { id: 'a1', name: 'probe_add', arguments: '{}' } },
			{ type: 'tool_call', json: { id: 'a2', name: 'probe_add', arguments: '{}' } },
			{ type: 'tool_call', json: { id: 'r1', name: 'probe_read', arguments: '{}' } },
			{ type: 'done', json: { finish_reason: 'tool_calls' } },
		]]);
		await drive(agent, stream);
		expect(reg.runTool).toHaveBeenCalledTimes(1);
		const res = agent.trace().rounds[0].results;
		expect(res.map((r)=>[r.callId, r.status, r.code])).toEqual([['a1', 'completed', undefined], ['a2', 'skipped', 'E_LIMIT'], ['r1', 'skipped', 'E_LIMIT']]);
	});

	it('abort:信号已中止 → settle 立即 false,stopReason=aborted,不执行', async ()=>{
		const reg = mkRegistry(()=>({ ok: true }));
		const ac = new AbortController();
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg, signal: ac.signal });
		const stream = mkStream([[...tc('c1', 'probe_add', {}), { type: 'done', json: { finish_reason: 'tool_calls' } }]]);
		agent.beginRound();
		await stream.request({ messages: agent.messagesForRound(BASE) }, { onEvent: (e)=>agent.onEvent(e) });
		ac.abort();
		expect(await agent.settleRound()).toBe(false);
		expect(agent.trace().stopReason).toBe('aborted');
		expect(reg.runTool).not.toHaveBeenCalled();
	});

	it('🔴 上游「不支持 tools」(流层抛错) → 同轮降级 text 重发一次;能力记 text;第二次请求无 tools 且 system 含围栏规则', async ()=>{
		const reg = mkRegistry(()=>({ ok: true, data: { n: 1 } }));
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'small', registry: reg });
		const stream = mkStream([
			[{ throw: new Error('Unrecognized request argument supplied: tools') }],
			[{ type: 'delta', json: { delta: '好的\n```' + ACTION_FENCE + '\n{"__horosaType":"action","calls":[{"id":"x1","name":"probe_read","args":{"q":"z"}}]}\n```' } }, { type: 'done', json: { finish_reason: 'stop' } }],
			[{ type: 'delta', json: { delta: '结果如下' } }, { type: 'done', json: { finish_reason: 'stop' } }],
		]);
		const err = await drive(agent, stream);
		expect(err).toBe(null);
		expect(agent.mode).toBe('text');
		expect(getToolCapability('p', 'small')).toBe('text');
		expect(stream.calls[0].tools).toBeTruthy();
		expect(stream.calls[1].tools).toBeUndefined();
		expect(stream.calls[1].toolChoice).toBeUndefined();
		expect(stream.calls[1].messages[0].content.indexOf(ACTION_FENCE)).toBeGreaterThan(0);
		expect(reg.runTool).toHaveBeenCalledWith('probe_read', { q: 'z' }, expect.any(Object));
		// 第三次请求:围栏模式结果以 user 信封回喂
		const third = stream.calls[2].messages;
		expect(third[third.length - 1].role).toBe('user');
		expect(third[third.length - 1].content.indexOf('[[__HOROSA_TOOL_RESULTS__]]')).toBe(0);
		expect(agent.trace().rounds.length).toBe(2);   // 失败那次不计轮
	});

	it('鉴权/限流类错误不吸收(照旧上抛),能力不改', async ()=>{
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: mkRegistry(()=>({ ok: true })) });
		const stream = mkStream([[{ throw: new Error('401 Unauthorized: invalid api key (tools)') }]]);
		const err = await drive(agent, stream);
		expect(err && err.message).toMatch(/401/);
		expect(getToolCapability('p', 'm')).toBe('unknown');
	});

	it('SSE error 事件报不支持 tools → 同样降级;其它 error → stopReason=error', async ()=>{
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: mkRegistry(()=>({ ok: true })) });
		const stream = mkStream([
			[{ type: 'error', json: { message: 'This model does not support function calling' } }],
			[{ type: 'delta', json: { delta: 'ok' } }, { type: 'done', json: { finish_reason: 'stop' } }],
		]);
		await drive(agent, stream);
		expect(agent.mode).toBe('text');
		expect(stream.calls.length).toBe(2);
		const agent2 = createAgentTurn({ profile: { id: 'p2' }, model: 'm', registry: mkRegistry(()=>({ ok: true })) });
		const stream2 = mkStream([[{ type: 'error', json: { message: 'upstream 500' } }]]);
		await drive(agent2, stream2);
		expect(agent2.trace().stopReason).toBe('error');
	});

	it('已记 text 的模型直接围栏模式;参数坏 JSON / 工具报 E_ARGS_INVALID 均作 isError 回喂不中断', async ()=>{
		recordToolCapability('p', 'm', false);
		const reg = mkRegistry(()=>({ ok: false, code: 'E_ARGS_INVALID', message: 'bad' }));
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg });
		expect(agent.mode).toBe('text');
		expect(agent.toolDefs()).toBeUndefined();
		const stream = mkStream([
			[{ type: 'delta', json: { delta: '```' + ACTION_FENCE + '\n{"__horosaType":"action","calls":[{"name":"probe_add","args":{"name":1}}]}\n```' } }, { type: 'done', json: { finish_reason: 'stop' } }],
			[{ type: 'delta', json: { delta: '好' } }, { type: 'done', json: { finish_reason: 'stop' } }],
		]);
		await drive(agent, stream);
		const r = agent.trace().rounds[0].results[0];
		expect(r.isError).toBe(true);
		expect(r.code).toBe('E_ARGS_INVALID');
		expect(r.status).toBe('failed');
		// 原生模式坏 JSON 参数
		recordToolCapability('p', 'n', true);
		const reg2 = mkRegistry(()=>({ ok: true }));
		const agent2 = createAgentTurn({ profile: { id: 'p' }, model: 'n', registry: reg2 });
		const stream2 = mkStream([[{ type: 'tool_call', json: { id: 'c1', name: 'probe_read', arguments: '{bad' } }, { type: 'done', json: { finish_reason: 'tool_calls' } }]]);
		await drive(agent2, stream2);
		expect(reg2.runTool).not.toHaveBeenCalled();
		expect(agent2.trace().rounds[0].results[0].code).toBe('E_ARGS_INVALID');
	});

	it('审批档 on-request:additive 等用户;拒绝 → skipped 不执行;read 不问', async ()=>{
		window.localStorage.setItem(AGENT_APPROVAL_KEY, 'on-request');
		const reg = mkRegistry(()=>({ ok: true }));
		const ask = jest.fn(async (call)=>call.name !== 'probe_add');
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg, requestApproval: ask });
		const stream = mkStream([[...tc('c1', 'probe_add', { name: 'x' }), { type: 'tool_call', json: { id: 'c2', name: 'probe_read', arguments: '{}' } }, { type: 'done', json: { finish_reason: 'tool_calls' } }]]);
		await drive(agent, stream);
		expect(ask).toHaveBeenCalledTimes(1);
		expect(reg.runTool).toHaveBeenCalledTimes(1);
		expect(reg.runTool.mock.calls[0][0]).toBe('probe_read');
		const res = agent.trace().rounds[0].results;
		expect(res.find((r)=>r.callId === 'c1').status).toBe('skipped');
		expect(res.find((r)=>r.callId === 'c1').code).toBe('E_USER_SKIPPED');
	});

	it('🔴 归档前补齐未决调用:收口轮/abort 的调用必有 skipped 结果,历史回放调用与结果成对', async ()=>{
		const reg = mkRegistry(()=>({ ok: true }));
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg });
		const scripts = [];
		for(let i = 0; i < AGENT_LIMITS.MAX_ROUNDS + 1; i++){ scripts.push([...tc(`c${i}`, 'probe_read', {}), { type: 'done', json: { finish_reason: 'tool_calls' } }]); }
		await drive(agent, mkStream(scripts));
		const t = agent.trace();
		expect(t.stopReason).toBe('max_rounds');
		t.rounds.forEach((r)=>{ const ids = new Set(r.results.map((x)=>x.callId)); r.toolCalls.forEach((c)=>expect(ids.has(c.id)).toBe(true)); });
		const last = t.rounds[t.rounds.length - 1];
		expect(last.results[0].status).toBe('skipped');
		expect(last.results[0].code).toBe('E_LIMIT');
		const msgs = expandHistory([{ role: 'user', content: 'u' }, { role: 'assistant', content: 'a', agentTrace: t }], { traceTurns: 2 });
		let expectTool = false;
		msgs.forEach((m)=>{ if(expectTool){ expect(m.role).toBe('tool'); expectTool = false; } if(m.role === 'assistant' && m.toolCalls){ expectTool = true; } });
		expect(expectTool).toBe(false);
		// abort 路径
		const ac = new AbortController();
		const agent2 = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: mkRegistry(async ()=>{ ac.abort(); return { ok: true }; }), signal: ac.signal });
		const s2 = mkStream([[...tc('a1', 'probe_add', {}), { type: 'tool_call', json: { id: 'a2', name: 'probe_add', arguments: '{}' } }, { type: 'done', json: { finish_reason: 'tool_calls' } }]]);
		await drive(agent2, s2);
		const r2 = agent2.trace().rounds[0];
		expect(r2.results.map((x)=>x.callId).sort()).toEqual(['a1', 'a2']);
		expect(r2.results.find((x)=>x.callId === 'a2').code).toBe('E_ABORTED');
	});
	it('审批等待中点停止 → 等待立即解开,动作 skipped,settleRound 返回', async ()=>{
		window.localStorage.setItem(AGENT_APPROVAL_KEY, 'on-request');
		const ac = new AbortController();
		const reg = mkRegistry(()=>({ ok: true }));
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg, signal: ac.signal, requestApproval: ()=>new Promise(()=>{}) });
		const stream = mkStream([[...tc('c1', 'probe_add', { name: 'x' }), { type: 'done', json: { finish_reason: 'tool_calls' } }]]);
		setTimeout(()=>ac.abort(), 30);
		const t0 = Date.now();
		await drive(agent, stream);
		expect(Date.now() - t0).toBeLessThan(2000);
		expect(agent.trace().rounds[0].results[0].status).toBe('skipped');
		expect(reg.runTool).not.toHaveBeenCalled();
	});
	it('「不支持 tools」判定不吃调用/结果不成对类报错(否则模型被永久降级)', async ()=>{
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: mkRegistry(()=>({ ok: true })) });
		const stream = mkStream([[{ throw: new Error("400 An assistant message with 'tool_calls' must be followed by tool messages responding to each 'tool_call_id'.") }]]);
		const err = await drive(agent, stream);
		expect(err).not.toBe(null);
		expect(agent.mode).toBe('native');
		expect(getToolCapability('p', 'm')).toBe('unknown');
	});
	it('工具超时 → E_TOOL_TIMEOUT 回喂;未知工具名 → E_TOOL_NOT_FOUND', async ()=>{
		const reg = mkRegistry(async (name)=>{ if(name === 'probe_read'){ await sleep(80); } return { ok: true }; });
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg, limits: { TOOL_TIMEOUT_MS: 20 } });
		const stream = mkStream([[{ type: 'tool_call', json: { id: 'c1', name: 'probe_read', arguments: '{}' } }, { type: 'tool_call', json: { id: 'c2', name: 'delete_all', arguments: '{}' } }, { type: 'done', json: { finish_reason: 'tool_calls' } }]]);
		await drive(agent, stream);
		const res = agent.trace().rounds[0].results;
		expect(res.find((r)=>r.callId === 'c1').code).toBe('E_TOOL_TIMEOUT');
		expect(res.find((r)=>r.callId === 'c2').code).toBe('E_TOOL_NOT_FOUND');
		expect(reg.runTool).toHaveBeenCalledTimes(1);
	});
});

describe('协议违规与审批残留(压测实抓 R10/R14)', ()=>{
	it('🔴 同一 call id 先后不同工具名 → E_PROTOCOL_DUP_ID failed,绝不执行(此前静默合并成先到的工具+后到的参数)', async ()=>{
		window.localStorage.setItem(AGENT_ENABLED_KEY, '1');
		const reg = mkRegistry(async ()=>({ ok: true, data: {} }));
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg });
		const stream = mkStream([
			[{ type: 'tool_call_start', json: { id: 'd1', name: 'probe_read', index: 0 } }, { type: 'tool_call', json: { id: 'd1', name: 'probe_add', index: 1, arguments: '{"name":"Eve"}' } }, { type: 'done', json: { finish_reason: 'tool_calls' } }],
			[{ type: 'delta', json: { delta: 'ok' } }, { type: 'done', json: { finish_reason: 'stop' } }],
		]);
		await drive(agent, stream);
		expect(reg.runTool).not.toHaveBeenCalled();
		const res = agent.trace().rounds[0].results;
		expect(res.length).toBe(1);
		expect(res[0].code).toBe('E_PROTOCOL_DUP_ID');
		expect(res[0].status).toBe('failed');
		// 同名重复 id(上游重发)照旧只算一次且正常执行
		const reg2 = mkRegistry(async ()=>({ ok: true, data: {} }));
		const agent2 = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg2 });
		const stream2 = mkStream([
			[{ type: 'tool_call_start', json: { id: 's1', name: 'probe_read', index: 0 } }, { type: 'tool_call', json: { id: 's1', name: 'probe_read', index: 0, arguments: '{"q":"a"}' } }, { type: 'done', json: { finish_reason: 'tool_calls' } }],
			[{ type: 'done', json: { finish_reason: 'stop' } }],
		]);
		await drive(agent2, stream2);
		expect(reg2.runTool).toHaveBeenCalledTimes(1);
		expect(agent2.trace().rounds[0].results[0].status).toBe('completed');
	});
	it('🔴 审批等待中用户停止 → 待审条目撤台(动作条不再残留「允许/跳过」),调用 skipped', async ()=>{
		const approvals = require('../aiAgent/approvals');
		approvals.__resetApprovalsForTests();
		window.localStorage.setItem(AGENT_ENABLED_KEY, '1');
		window.localStorage.setItem(AGENT_APPROVAL_KEY, 'on-request');
		const ac = new AbortController();
		const reg = mkRegistry(async ()=>({ ok: true, data: {} }));
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg, signal: ac.signal, requestApproval: (call)=>approvals.requestApproval('msg-1', call) });
		const stream = mkStream([
			[{ type: 'tool_call', json: { id: 'a1', name: 'probe_add', index: 0, arguments: '{"name":"x"}' } }, { type: 'done', json: { finish_reason: 'tool_calls' } }],
		]);
		const driving = drive(agent, stream);
		for(let i = 0; i < 50 && approvals.listPendingApprovals('msg-1').length === 0; i++){ await sleep(5); }
		expect(approvals.listPendingApprovals('msg-1').length).toBe(1);
		ac.abort();
		await driving;
		expect(approvals.listPendingApprovals('msg-1').length).toBe(0);
		expect(reg.runTool).not.toHaveBeenCalled();
		expect(agent.trace().stopReason).toBe('aborted');
		window.localStorage.setItem(AGENT_APPROVAL_KEY, 'never');
	});
});

describe('同参去重(策略 dedupSameCall,缺省关)+ 上下文策略接线', ()=>{
	const DEDUP_MANIFEST = [
		{ name: 'probe_read', level: 'read', cacheable: true, description: 'r', inputSchema: { type: 'object', additionalProperties: false, properties: { q: { type: 'string' }, n: { type: 'integer' } } } },
		{ name: 'probe_read2', level: 'read', description: 'r2(未声明 cacheable)', inputSchema: { type: 'object', additionalProperties: false, properties: { q: { type: 'string' } } } },
		{ name: 'probe_read3', level: 'read', cacheable: true, cacheKey: (args)=>`${args && args.q ? args.q : ''}`.toLowerCase(), description: 'r3(自定义 cacheKey)', inputSchema: { type: 'object', additionalProperties: false, properties: { q: { type: 'string' } } } },
		{ name: 'probe_add', level: 'additive', description: 'a', inputSchema: { type: 'object', additionalProperties: false, properties: { name: { type: 'string' } } } },
	];
	function mkReg(impl){
		const runTool = jest.fn(async (name, args, ctx)=>impl(name, args, ctx));
		return { exportToolManifest: ()=>DEDUP_MANIFEST, runTool, getTool: (n)=>DEDUP_MANIFEST.find((m)=>m.name === n) };
	}
	const ON = { dedupSameCall: true };
	const DONE = { type: 'done', json: { finish_reason: 'tool_calls' } };
	const FINAL = [{ type: 'delta', json: { delta: '好' } }, { type: 'done', json: { finish_reason: 'stop' } }];
	const round = (...calls)=>[...calls.flatMap(([id, name, args])=>tc(id, name, args)), DONE];
	const okData = ()=>({ ok: true, data: { rows: [1, 2, 3] } });
	beforeEach(()=>{ window.localStorage.setItem(AGENT_ENABLED_KEY, '1'); });

	it('🔴 ① 同参两轮只执行一次:第二次 dedupOf 指向原调用、回喂不带 data 正文;去重命中仍计入调用限额', async ()=>{
		const reg = mkReg(okData);
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg, contextPolicy: ON, limits: { MAX_CALLS_PER_TURN: 2 } });
		const stream = mkStream([round(['c1', 'probe_read', { q: 'a', n: 1 }]), round(['c2', 'probe_read', { n: 1, q: 'a' }]), round(['c3', 'probe_read', { q: 'a', n: 1 }]), FINAL]);
		expect(await drive(agent, stream)).toBe(null);
		expect(reg.runTool).toHaveBeenCalledTimes(1);
		const t = agent.trace();
		const [r1, r2, r3] = [t.rounds[0].results[0], t.rounds[1].results[0], t.rounds[2].results[0]];
		expect(r1.dedupOf).toBeUndefined();
		expect(JSON.parse(r1.content).data).toEqual({ rows: [1, 2, 3] });
		expect(r2).toEqual(expect.objectContaining({ callId: 'c2', ok: true, status: 'completed', isError: false, dedupOf: 'c1' }));
		expect(r2.summary).toContain('c1');
		const fed = JSON.parse(r2.content);
		expect(fed).toEqual({ __horosaType: 'toolResult', untrusted: true, ok: true, dedupOf: 'c1', message: expect.stringContaining('与调用 c1 参数相同且期间无写入,未重复执行') });
		expect(Object.prototype.hasOwnProperty.call(fed, 'data')).toBe(false);
		// 键序不同的同参(键排序序列化)也命中;第三次:去重命中已计入 MAX_CALLS_PER_TURN(=2)→ 超限跳过
		expect(r3.code).toBe('E_LIMIT');
		expect(r3.status).toBe('skipped');
		// 第 3 次请求回放:第 2 轮 tool 消息内容 = 去重信封(与 trace 同一份)
		const third = stream.calls[2].messages.filter((m)=>m.role === 'tool');
		expect(third.length).toBe(2);
		expect(JSON.parse(third[1].toolResults[0].content).dedupOf).toBe('c1');
		expect(JSON.parse(JSON.stringify(t))).toEqual(t);
		expect(stableStringify({ b: 1, a: [{ y: undefined, x: 2 }] })).toBe('{"a":[{"x":2}],"b":1}');
	});
	it('🔴 ② 中间任一写入成功 → 换代,同参再次真执行;写入失败或被跳过不换代(仍命中)', async ()=>{
		const reg = mkReg((name)=>(name === 'probe_add' ? { ok: true, data: { cid: 'local-x' } } : okData()));
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg, contextPolicy: ON });
		const stream = mkStream([round(['c1', 'probe_read', { q: 'a' }]), round(['a1', 'probe_add', { name: 'x' }]), round(['c2', 'probe_read', { q: 'a' }]), FINAL]);
		expect(await drive(agent, stream)).toBe(null);
		expect(reg.runTool.mock.calls.map((c)=>c[0])).toEqual(['probe_read', 'probe_add', 'probe_read']);
		expect(agent.trace().rounds[2].results[0].dedupOf).toBeUndefined();
		// 写入失败(ok:false)→ 不换代
		const reg2 = mkReg((name)=>(name === 'probe_add' ? { ok: false, code: 'E_X', message: 'no' } : okData()));
		const agent2 = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg2, contextPolicy: ON });
		const stream2 = mkStream([round(['c1', 'probe_read', { q: 'a' }]), round(['a1', 'probe_add', { name: 'x' }]), round(['c2', 'probe_read', { q: 'a' }]), FINAL]);
		expect(await drive(agent2, stream2)).toBe(null);
		expect(reg2.runTool.mock.calls.map((c)=>c[0])).toEqual(['probe_read', 'probe_add']);
		expect(agent2.trace().rounds[2].results[0].dedupOf).toBe('c1');
		// 同轮内:写入与读并存时 read 先并行执行、写入随后换代 → 下一轮同参读重新执行
		const reg3 = mkReg((name)=>(name === 'probe_add' ? { ok: true, data: {} } : okData()));
		const agent3 = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg3, contextPolicy: ON });
		const stream3 = mkStream([round(['c1', 'probe_read', { q: 'a' }], ['a1', 'probe_add', { name: 'x' }]), round(['c2', 'probe_read', { q: 'a' }]), FINAL]);
		expect(await drive(agent3, stream3)).toBe(null);
		expect(reg3.runTool.mock.calls.map((c)=>c[0])).toEqual(['probe_read', 'probe_add', 'probe_read']);
	});
	it('③ 不同参两次各自执行;自定义 cacheKey 归一后视为同参;原调用失败(ok:false)不作命中', async ()=>{
		const reg = mkReg(okData);
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg, contextPolicy: ON });
		const stream = mkStream([round(['c1', 'probe_read', { q: 'a' }]), round(['c2', 'probe_read', { q: 'b' }]), round(['k1', 'probe_read3', { q: 'Beijing' }]), round(['k2', 'probe_read3', { q: 'beijing' }]), FINAL]);
		expect(await drive(agent, stream)).toBe(null);
		expect(reg.runTool.mock.calls.map((c)=>[c[0], c[1].q])).toEqual([['probe_read', 'a'], ['probe_read', 'b'], ['probe_read3', 'Beijing']]);
		const t = agent.trace();
		expect(t.rounds[1].results[0].dedupOf).toBeUndefined();
		expect(t.rounds[3].results[0].dedupOf).toBe('k1');
		// 原调用失败 → 同参再来照常执行
		let n = 0;
		const reg2 = mkReg(()=>{ n += 1; return n === 1 ? { ok: false, code: 'E_TOOL_FAILED', message: 'x' } : okData(); });
		const agent2 = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg2, contextPolicy: ON });
		const stream2 = mkStream([round(['c1', 'probe_read', { q: 'a' }]), round(['c2', 'probe_read', { q: 'a' }]), round(['c3', 'probe_read', { q: 'a' }]), FINAL]);
		expect(await drive(agent2, stream2)).toBe(null);
		expect(reg2.runTool).toHaveBeenCalledTimes(2);
		expect(agent2.trace().rounds[1].results[0].dedupOf).toBeUndefined();
		expect(agent2.trace().rounds[2].results[0].dedupOf).toBe('c2');
	});
	it('④ 未声明 cacheable 的只读工具同参两次照常执行两次', async ()=>{
		const reg = mkReg(okData);
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg, contextPolicy: ON });
		const stream = mkStream([round(['c1', 'probe_read2', { q: 'a' }]), round(['c2', 'probe_read2', { q: 'a' }]), FINAL]);
		expect(await drive(agent, stream)).toBe(null);
		expect(reg.runTool).toHaveBeenCalledTimes(2);
		expect(agent.trace().rounds.every((r)=>r.results.every((x)=>x.dedupOf === undefined))).toBe(true);
	});
	it('🔴 ⑤ 策略关(缺省/显式 false)→ 同参两次执行两次;缺省策略常量 = 现状(2 Turn 原样/不折叠/不去重)', async ()=>{
		expect(DEFAULT_AGENT_CONTEXT_POLICY).toEqual({ traceTurnsFull: 2, traceTurnsFolded: 0, foldedResultMaxChars: { read: 1200, additive: 600 }, dedupSameCall: false });
		for(const policy of [undefined, { dedupSameCall: false }, { dedupSameCall: 'true' }, null]){
			const reg = mkReg(okData);
			const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg, ...(policy === undefined ? {} : { contextPolicy: policy }) });
			const stream = mkStream([round(['c1', 'probe_read', { q: 'a' }]), round(['c2', 'probe_read', { q: 'a' }]), FINAL]);
			expect(await drive(agent, stream)).toBe(null);
			expect(reg.runTool).toHaveBeenCalledTimes(2);
			expect(agent.trace().rounds[1].results[0].dedupOf).toBeUndefined();
		}
	});
	it('⑥ 同轮并行的两条同参读调用只执行一次(在途 promise 共享),回喂序仍按模型给出序', async ()=>{
		const reg = mkReg(async ()=>{ await sleep(10); return okData(); });
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg, contextPolicy: ON });
		const stream = mkStream([round(['c1', 'probe_read', { q: 'a' }], ['c2', 'probe_read', { q: 'a' }], ['c3', 'probe_read', { q: 'z' }]), FINAL]);
		expect(await drive(agent, stream)).toBe(null);
		expect(reg.runTool).toHaveBeenCalledTimes(2);
		const res = agent.trace().rounds[0].results;
		expect(res.map((x)=>[x.callId, x.dedupOf, x.status])).toEqual([['c1', undefined, 'completed'], ['c2', 'c1', 'completed'], ['c3', undefined, 'completed']]);
		const tool = stream.calls[1].messages[stream.calls[1].messages.length - 1];
		expect(tool.toolResults.map((r)=>r.callId)).toEqual(['c1', 'c2', 'c3']);
	});
	it('🔴 ⑦ 策略分级接线:traceTurnsFull/Folded/预算进 messagesForRound;本 Turn 已完成轮永不折叠;缺省与 expandHistory(traceTurns:2) 逐字节同', async ()=>{
		const big = JSON.stringify({ __horosaType: 'toolResult', untrusted: true, ok: true, data: { text: 'x'.repeat(5000) } });
		const mk = (id)=>({ mode: 'native', rounds: [{ index: 0, text: `t${id}`, toolCalls: [{ id: `c${id}`, name: 'probe_read', args: { q: id } }], results: [{ callId: `c${id}`, name: 'probe_read', level: 'read', content: big, isError: false }] }, { index: 1, text: `d${id}`, toolCalls: [], results: [] }] });
		const base = [{ role: 'system', content: 'SYS' }, { role: 'user', content: 'u1' }, { role: 'assistant', content: 'a1', agentTrace: mk(1) }, { role: 'user', content: 'u2' }, { role: 'assistant', content: 'a2', agentTrace: mk(2) }, { role: 'user', content: 'u3' }, { role: 'assistant', content: 'a3', agentTrace: mk(3) }, { role: 'user', content: 'u4' }];
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: mkReg(okData), contextPolicy: { traceTurnsFull: 1, traceTurnsFolded: 1, foldedResultMaxChars: { read: 400, additive: 300 } } });
		agent.beginRound();
		const msgs = agent.messagesForRound(base);
		const tools = msgs.filter((m)=>m.role === 'tool');
		expect(tools.length).toBe(2);   // a2 折叠 + a3 原文;a1 只留正文
		expect(tools[0].toolResults[0].callId).toBe('c2');
		expect(tools[0].toolResults[0].content.length).toBeLessThanOrEqual(400);
		expect(JSON.parse(tools[0].toolResults[0].content).folded).toBe(true);
		expect(tools[1].toolResults[0].content).toBe(big);
		expect(msgs.filter((m)=>m.role === 'assistant' && m.content === 'a1').length).toBe(1);
		// 本 Turn 已完成轮(soFar)不折叠:跑一轮大结果后下一轮请求里该结果原文回喂
		const reg = mkReg(()=>({ ok: true, data: { text: 'y'.repeat(5000) } }));
		const agent2 = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg, contextPolicy: { traceTurnsFull: 0, traceTurnsFolded: 2, foldedResultMaxChars: 300 } });
		const stream = mkStream([round(['c9', 'probe_read', { q: 'a' }]), FINAL]);
		expect(await drive(agent2, stream)).toBe(null);
		const second = stream.calls[1].messages;
		const soFarTool = second[second.length - 1];
		expect(soFarTool.role).toBe('tool');
		expect(JSON.parse(soFarTool.toolResults[0].content).data.text.length).toBe(5000);
		// 缺省策略(不传 contextPolicy)= 与旧 expandHistory(traceTurns:2) 逐字节相同
		const agent3 = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: mkReg(okData) });
		agent3.beginRound();
		expect(JSON.stringify(agent3.messagesForRound(base))).toBe(JSON.stringify(injectSystemRules(expandHistory(base, { traceTurns: 2 }), require('../aiAgent/protocol').agentSystemRulesFor(['probe_read']))));   // [Q-290/PP-22]
		// opts.traceTurns 仍优先于策略的 traceTurnsFull(向后兼容)
		const agent4 = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: mkReg(okData), traceTurns: 3, contextPolicy: { traceTurnsFull: 1 } });
		agent4.beginRound();
		expect(agent4.messagesForRound(base).filter((m)=>m.role === 'tool').length).toBe(3);
	});
});

// [FL-20260904-2] 失败收口:工具执行后上游停流/500 抛错时,页面 catch 调 failRound 归档当前轮。
// 端到端真栈实抓——此前 trace.stopReason 恒 null、当前轮(含已完成的建档结果)整个丢掉,回放/账本看不出错在哪。
describe('failRound · 流层抛错的失败收口', ()=>{
	beforeEach(()=>{ window.localStorage.setItem(AGENT_ENABLED_KEY, '1'); });

	it('🔴 工具已完成 + 二轮流层抛错 → 归档该轮(结果保留)且 stopReason=error;幂等', async ()=>{
		const reg = mkRegistry(()=>({ ok: true, data: { cid: 'local-f1' }, summary: '新建命盘' }));
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg });
		const stream = mkStream([
			[...tc('call_f1', 'probe_add', { name: '甲' }), { type: 'done', json: { finish_reason: 'tool_calls' } }],
			[{ type: 'delta', json: { delta: '开始' } }, { throw: new Error('stream stalled') }],
		]);
		const err = await drive(agent, stream);
		expect(err).toBeTruthy();
		expect(agent.trace().stopReason).toBe(null);   // 判别向量:不调 failRound = 旧行为(缺口本体)
		agent.failRound('stream stalled');
		const t = agent.trace();
		expect(t.stopReason).toBe('error');
		const first = t.rounds[0];
		expect(first.results.length).toBe(1);
		expect(first.results[0].ok).toBe(true);        // 已完成的建档结果原样保留
		const last = t.rounds[t.rounds.length - 1];
		expect(last.text).toBe('开始');
		const before = JSON.stringify(t);
		agent.failRound('again');                      // 幂等:二次调用无副作用
		expect(JSON.stringify(agent.trace())).toBe(before);
	});

	it('未解析的调用记 E_STREAM_ERROR;NULL_AGENT.failRound 是空实现(总开关关不炸)', async ()=>{
		const reg = mkRegistry(()=>({ ok: true }));
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg });
		agent.beginRound();
		[...tc('call_f2', 'probe_add', { name: '乙' })].forEach((e)=>agent.onEvent(e));
		agent.failRound('boom');
		const t = agent.trace();
		expect(t.stopReason).toBe('error');
		const r = t.rounds[t.rounds.length - 1].results[0];
		expect(r.ok).toBe(false);
		expect(r.code).toBe('E_STREAM_ERROR');
		expect(typeof NULL_AGENT.failRound).toBe('function');
		expect(NULL_AGENT.failRound('x')).toBeUndefined();
	});
});

describe('P0 审批三档·类别收紧·信任档案·反问通道(运行时接线)', ()=>{
	beforeEach(()=>{ window.localStorage.clear(); window.localStorage.setItem(AGENT_ENABLED_KEY, '1'); });
	it('🔴 read-only 档:additive 直接 skipped/E_APPROVAL_DENIED,不问不执行;read 照跑', async ()=>{
		window.localStorage.setItem(AGENT_APPROVAL_KEY, 'read-only');
		const reg = mkRegistry(()=>({ ok: true }));
		const ask = jest.fn(async ()=>true);
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg, requestApproval: ask });
		const stream = mkStream([[...tc('c1', 'probe_add', { name: 'x' }), { type: 'tool_call', json: { id: 'c2', name: 'probe_read', arguments: '{}' } }, { type: 'done', json: { finish_reason: 'tool_calls' } }]]);
		await drive(agent, stream);
		expect(ask).not.toHaveBeenCalled();
		expect(reg.runTool).toHaveBeenCalledTimes(1);
		expect(reg.runTool.mock.calls[0][0]).toBe('probe_read');
		const r = agent.trace().rounds[0].results.find((x)=>x.callId === 'c1');
		expect(r.status).toBe('skipped');
		expect(r.code).toBe('E_APPROVAL_DENIED');
	});
	it('🔴 总档 never + 类别 query=read-only → deny(类别只能更严);总档 on-request + 类别 never → 仍问', async ()=>{
		const prefs = require('../aiAgent/prefs');
		window.localStorage.setItem(AGENT_APPROVAL_KEY, 'never');
		prefs.setAgentApprovalCategory('query', 'read-only');
		const reg = mkRegistry(()=>({ ok: true }));
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg });
		await drive(agent, mkStream([[...tc('c1', 'probe_add', { name: 'x' }), { type: 'done', json: { finish_reason: 'tool_calls' } }]]));
		expect(reg.runTool).not.toHaveBeenCalled();
		expect(agent.trace().rounds[0].results[0].code).toBe('E_APPROVAL_DENIED');
		window.localStorage.setItem(AGENT_APPROVAL_KEY, 'on-request');
		prefs.setAgentApprovalCategory('query', 'never');
		const ask = jest.fn(async ()=>false);
		const reg2 = mkRegistry(()=>({ ok: true }));
		const agent2 = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg2, requestApproval: ask });
		await drive(agent2, mkStream([[...tc('c1', 'probe_add', { name: 'x' }), { type: 'done', json: { finish_reason: 'tool_calls' } }]]));
		expect(ask).toHaveBeenCalledTimes(1);
		expect(reg2.runTool).not.toHaveBeenCalled();
		expect(agent2.trace().rounds[0].results[0].code).toBe('E_USER_SKIPPED');
	});
	it('🔴 on-request + 信任档案命中(query 类,args.cid)→ 免问执行;未命中 → 照问', async ()=>{
		const prefs = require('../aiAgent/prefs');
		window.localStorage.setItem(AGENT_APPROVAL_KEY, 'on-request');
		prefs.setTrustedRecords(['local-abc']);
		const ask = jest.fn(async ()=>false);
		const reg = mkRegistry(()=>({ ok: true }));
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg, requestApproval: ask });
		await drive(agent, mkStream([[...tc('c1', 'probe_add', { name: 'x', cid: 'local-abc' }), { type: 'done', json: { finish_reason: 'tool_calls' } }]]));
		expect(ask).not.toHaveBeenCalled();
		expect(reg.runTool).toHaveBeenCalledTimes(1);
		expect(agent.trace().rounds[0].results[0].status).toBe('completed');
		const reg2 = mkRegistry(()=>({ ok: true }));
		const agent2 = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg2, requestApproval: ask });
		await drive(agent2, mkStream([[...tc('c1', 'probe_add', { name: 'x', cid: 'local-other' }), { type: 'done', json: { finish_reason: 'tool_calls' } }]]));
		expect(ask).toHaveBeenCalledTimes(1);
		expect(reg2.runTool).not.toHaveBeenCalled();
	});
	it('ctx.elicit 只在提供 requestElicitation 时透传,并补 callId/name/signal;不提供则 undefined(ask_user 自回 E_ELICIT_UNAVAILABLE)', async ()=>{
		const reg = mkRegistry(()=>({ ok: true }));
		const re = jest.fn(async ()=>({ answer: '08:00' }));
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg, requestElicitation: re, signal: new AbortController().signal });
		await drive(agent, mkStream([[{ type: 'tool_call', json: { id: 'c1', name: 'probe_read', arguments: '{}' } }, { type: 'done', json: { finish_reason: 'tool_calls' } }]]));
		const ctx = reg.runTool.mock.calls[0][2];
		expect(typeof ctx.elicit).toBe('function');
		await expect(ctx.elicit({ question: 'q' })).resolves.toEqual({ answer: '08:00' });
		expect(re.mock.calls[0][0]).toEqual(expect.objectContaining({ question: 'q', callId: 'c1', name: 'probe_read' }));
		expect(re.mock.calls[0][0].signal).toBeDefined();
		const reg2 = mkRegistry(()=>({ ok: true }));
		const agent2 = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg2 });
		await drive(agent2, mkStream([[{ type: 'tool_call', json: { id: 'c1', name: 'probe_read', arguments: '{}' } }, { type: 'done', json: { finish_reason: 'tool_calls' } }]]));
		expect(reg2.runTool.mock.calls[0][2].elicit).toBeUndefined();
	});
});

describe('[进阶复查 2026-09-08] D12 读级类别档 / D14 来源目录 / D15 fail-closed / D16 计额 / D17 ledgerLost / P1 会话放行', ()=>{
	const MAN2 = MANIFEST.concat([
		{ name: 'probe_ext', level: 'read', category: 'external', description: 'e', inputSchema: { type: 'object', additionalProperties: false, properties: {} }, annotations: { readOnlyHint: true, destructiveHint: false } },
		{ name: 'probe_q', level: 'read', category: 'query', description: 'q', inputSchema: { type: 'object', additionalProperties: false, properties: {} }, annotations: { readOnlyHint: true, destructiveHint: false } },
	]);
	function mkReg2(impl, man){
		const m = man || MAN2;
		const runTool = jest.fn(async (name, args, ctx)=>impl(name, args, ctx));
		return { exportToolManifest: jest.fn(()=>m), runTool, getTool: (n)=>m.find((x)=>x.name === n) };
	}
	const call = (id, name, args)=>({ type: 'tool_call', json: { id, name, index: 0, arguments: JSON.stringify(args || {}) } });
	const done = { type: 'done', json: { finish_reason: 'tool_calls' } };
	beforeEach(()=>{ window.localStorage.clear(); window.localStorage.setItem(AGENT_ENABLED_KEY, '1'); require('../aiAgent/sessionAllow').__resetSessionAllowForTests(); });

	it('🔴 D12 显式类别档对读级工具生效:external=read-only → probe_ext skipped/E_APPROVAL_DENIED 零执行;query=on-request → probe_q 先问再跑(审批载荷带 level:read)', async ()=>{
		// 当前代码为何红(修前):approvalPolicy.js:40 `level!=='additive' → auto`,类别档对读工具零效果
		window.localStorage.setItem(AGENT_APPROVAL_KEY, 'never');
		const reg = mkReg2(()=>({ ok: true }));
		const ask = jest.fn(async ()=>true);
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg, requestApproval: ask, approvalCategories: { external: 'read-only', query: 'on-request' } });
		await drive(agent, mkStream([[...tc('e1', 'probe_ext', {}), call('q1', 'probe_q'), call('q2', 'probe_q'), done]]));
		const res = agent.trace().rounds[0].results;
		const e = res.find((r)=>r.callId === 'e1');
		expect(e.status).toBe('skipped'); expect(e.code).toBe('E_APPROVAL_DENIED'); expect(e.summary).toContain('只读');
		expect(reg.runTool.mock.calls.map((c)=>c[0])).toEqual(['probe_q', 'probe_q']);
		expect(ask).toHaveBeenCalledTimes(2);
		expect(ask.mock.calls[0][0].level).toBe('read');
	});
	it('🔴 D12 零变化锚:类别 inherit + 总档 on-request / read-only → 读工具照跑不问', async ()=>{
		for(const mode of ['on-request', 'read-only']){
			window.localStorage.setItem(AGENT_APPROVAL_KEY, mode);
			const reg = mkReg2(()=>({ ok: true }));
			const ask = jest.fn(async ()=>true);
			const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg, requestApproval: ask });
			await drive(agent, mkStream([[...tc('e1', 'probe_ext', {}), call('q1', 'probe_q'), done]]));
			expect(ask).not.toHaveBeenCalled();
			expect(reg.runTool).toHaveBeenCalledTimes(2);
		}
	});
	it('🔴 D14 目录按来源列:exportToolManifest 收到 { origin }(goal / 缺省 in-app)', ()=>{
		// 当前代码为何红(修前):runtime.js:121 `registry.exportToolManifest()` 不传 origin → 目标/定时轮向模型宣告 origins 合同外的工具,一调即 E_TOOL_DISABLED
		const reg = mkReg2(()=>({ ok: true }));
		createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg, origin: 'goal' }).toolDefs();
		expect(reg.exportToolManifest).toHaveBeenCalledWith({ origin: 'goal' });
		const reg2 = mkReg2(()=>({ ok: true }));
		createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg2 }).toolDefs();
		expect(reg2.exportToolManifest).toHaveBeenCalledWith({ origin: 'in-app' });
	});
	it('🔴 D15 判「询问」却无审批通道 → fail-closed:skipped/E_APPROVAL_DENIED(no-approval-channel),零执行', async ()=>{
		// 当前代码为何红(修前):runtime.js:203 `decision==='ask' && typeof opts.requestApproval==='function'` 不成立时 result 为空 → 照常执行
		window.localStorage.setItem(AGENT_APPROVAL_KEY, 'on-request');
		const reg = mkReg2(()=>({ ok: true }));
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg });
		await drive(agent, mkStream([[...tc('c1', 'probe_add', { name: 'x' }), done]]));
		expect(reg.runTool).not.toHaveBeenCalled();
		const r = agent.trace().rounds[0].results[0];
		expect(r.status).toBe('skipped'); expect(r.code).toBe('E_APPROVAL_DENIED'); expect(r.content).toContain('no-approval-channel');
	});
	it('🔴 D16 被拒/未知名的尝试同样计入每 Turn 总额:上限 2 → 一次被禁用 + 一次未知名之后,下一轮 E_LIMIT', async ()=>{
		// 当前代码为何红(修前):runtime.js:294-303 被拒/未知在 totalCalls+=1 之前 return → 只受每轮 8 限,可硬调禁用工具 ~48 次
		const reg = mkReg2(()=>({ ok: true }));
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg, limits: { MAX_CALLS_PER_TURN: 2 }, toolPolicy: { deny: ['probe_read'], allow: [] } });
		await drive(agent, mkStream([
			[...tc('d1', 'probe_read', {}), call('d2', 'nope_tool'), done],
			[...tc('d3', 'probe_read2', {}), done],
		]));
		const rounds = agent.trace().rounds;
		expect(rounds[0].results.map((r)=>r.code)).toEqual(['E_APPROVAL_DENIED', 'E_TOOL_NOT_FOUND']);
		expect(rounds[1].results[0].code).toBe('E_LIMIT');
		expect(reg.runTool).not.toHaveBeenCalled();
	});
	it('🔴 D17 账本提交失败(ledgerLost)进 trace 结果项;正常写入无该键', async ()=>{
		const reg = mkReg2((name)=>(name === 'probe_add' ? { ok: true, ledgerLost: true, undo: { actionId: 'a1', kind: 'none', label: '' } } : { ok: true }));
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg });
		await drive(agent, mkStream([[...tc('a1', 'probe_add', { name: 'x' }), call('r1', 'probe_read'), done]]));
		const res = agent.trace().rounds[0].results;
		expect(res.find((r)=>r.callId === 'a1').ledgerLost).toBe(true);
		expect(res.find((r)=>r.callId === 'r1').ledgerLost).toBeUndefined();
	});
	it('🔴 P1 会话放行:首次询问时用户选「本会话不再问」→ 同轮第二次同名写入不再问;opts.sessionAllow 可注入', async ()=>{
		window.localStorage.setItem(AGENT_APPROVAL_KEY, 'on-request');
		const sa = require('../aiAgent/sessionAllow');
		const reg = mkReg2(()=>({ ok: true }));
		const ask = jest.fn(async (c)=>{ sa.allowToolForSession(c.name); return true; });
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg, requestApproval: ask });
		await drive(agent, mkStream([[...tc('a1', 'probe_add', { name: 'x' }), call('a2', 'probe_add', { name: 'y' }), done]]));
		expect(ask).toHaveBeenCalledTimes(1);
		expect(reg.runTool).toHaveBeenCalledTimes(2);
		expect(agent.trace().rounds[0].results.map((r)=>r.status)).toEqual(['completed', 'completed']);
		const reg2 = mkReg2(()=>({ ok: true }));
		const ask2 = jest.fn(async ()=>true);
		const agent2 = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg2, requestApproval: ask2, sessionAllow: ()=>true });
		await drive(agent2, mkStream([[...tc('b1', 'probe_add', { name: 'x' }), done]]));
		expect(ask2).not.toHaveBeenCalled();
		expect(reg2.runTool).toHaveBeenCalledTimes(1);
		// 只读档不吃会话放行
		window.localStorage.setItem(AGENT_APPROVAL_KEY, 'read-only');
		const reg3 = mkReg2(()=>({ ok: true }));
		const agent3 = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg3, requestApproval: ask2, sessionAllow: ()=>true });
		await drive(agent3, mkStream([[...tc('b1', 'probe_add', { name: 'x' }), done]]));
		expect(reg3.runTool).not.toHaveBeenCalled();
	});
});

describe('[复查 D24/D65] 非对话来源:读级「询问」自动放行(deny 保留)· 会话放行集只对对话来源', ()=>{
	const prefs3 = require('../aiAgent/prefs');
	const sess = require('../aiAgent/sessionAllow');
	beforeEach(()=>{ window.localStorage.clear(); sess.__resetSessionAllowForTests(); window.localStorage.setItem(AGENT_ENABLED_KEY, '1'); prefs3.setAgentEnabled(true); recordToolCapability('p', 'm', true); });
	const READ_MAN = [{ name: 'q_read', level: 'read', category: 'query', description: 'r', inputSchema: { type: 'object', additionalProperties: false, properties: {} }, annotations: { readOnlyHint: true, destructiveHint: false } },
		{ name: 'x_ext', level: 'read', category: 'external', description: 'r', inputSchema: { type: 'object', additionalProperties: false, properties: {} }, annotations: { readOnlyHint: true, destructiveHint: false } }];
	function regOf(impl){ const runTool = jest.fn(async (n, a, c)=>impl(n, a, c)); return { exportToolManifest: ()=>READ_MAN, runTool, getTool: (n)=>READ_MAN.find((m)=>m.name === n) }; }
	it('🔴 [D24] 显式「查询=每次确认」:对话来源问(无通道 ⇒ fail-closed);goal/mcp/automation 来源自动放行并打 autoApproved 标记', async ()=>{
		prefs3.setAgentApprovalCategory('query', 'on-request');
		// 对话来源无审批通道 ⇒ E_APPROVAL_DENIED(D15)
		const regA = regOf(()=>({ ok: true, data: { hit: 1 } }));
		const a = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: regA });
		await drive(a, mkStream([tc('c1', 'q_read', {}), [{ type: 'done', json: { finish_reason: 'stop' } }]]));
		expect(regA.runTool).not.toHaveBeenCalled();
		expect(a.trace().rounds[0].results[0].code).toBe('E_APPROVAL_DENIED');
		for(const origin of ['goal', 'mcp', 'automation', 'scheduled', 'orchestrate']){
			const reg = regOf(()=>({ ok: true, data: { hit: 1 } }));
			const g = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg, origin, requestApproval: ()=>Promise.resolve(false) });
			await drive(g, mkStream([tc('c1', 'q_read', {}), [{ type: 'done', json: { finish_reason: 'stop' } }]]));
			expect(reg.runTool).toHaveBeenCalledTimes(1);
			expect(g.trace().rounds[0].results[0].autoApproved).toBe('no-channel');
			expect(g.trace().rounds[0].results[0].ok).toBe(true);
		}
	});
	it('🔴 [D24] 显式「外部=只读」的 deny 在 goal 来源仍生效(只把 ask 降 auto,不放行 deny)', async ()=>{
		prefs3.setAgentApprovalCategory('external', 'read-only');
		const reg = regOf(()=>({ ok: true }));
		const g = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: reg, origin: 'goal', requestApproval: ()=>Promise.resolve(true) });
		await drive(g, mkStream([tc('c1', 'x_ext', {}), [{ type: 'done', json: { finish_reason: 'stop' } }]]));
		expect(reg.runTool).not.toHaveBeenCalled();
		expect(g.trace().rounds[0].results[0].code).toBe('E_APPROVAL_DENIED');
	});
	it('🔴 [D65] 「本会话不再问」只对对话来源:同名写入在 goal 来源仍询问', async ()=>{
		window.localStorage.setItem(AGENT_APPROVAL_KEY, 'on-request');
		sess.allowToolForSession('probe_add');
		const ask = jest.fn(()=>Promise.resolve(false));
		const regA = mkRegistry(()=>({ ok: true, undo: { actionId: 'a1', kind: 'trash-record' } }));
		const a = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: regA, requestApproval: ask });
		await drive(a, mkStream([tc('c1', 'probe_add', { name: 'x' }), [{ type: 'done', json: { finish_reason: 'stop' } }]]));
		expect(ask).not.toHaveBeenCalled();
		expect(regA.runTool).toHaveBeenCalledTimes(1);   // 对话来源:会话放行集免问
		const askG = jest.fn(()=>Promise.resolve(false));
		const regG = mkRegistry(()=>({ ok: true }));
		const g = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry: regG, origin: 'goal', requestApproval: askG });
		await drive(g, mkStream([tc('c1', 'probe_add', { name: 'x' }), [{ type: 'done', json: { finish_reason: 'stop' } }]]));
		expect(askG).toHaveBeenCalledTimes(1);           // goal 来源:仍问
		expect(regG.runTool).not.toHaveBeenCalled();
	});
});

// [Q-290/M-105·PP-14] 围栏模式收口轮:末尾追加「本轮不要再输出动作块」提示;路由收口记 route_close(不再误记 max_rounds)。
describe('[Q-290/PP-14] 围栏模式收口', ()=>{
	beforeEach(()=>{ window.localStorage.setItem(AGENT_ENABLED_KEY, '1'); });
	it('text 模式轮数上限收口轮:请求末条 user 含「收口」提示;模型仍发动作块 → max_rounds + E_LIMIT', async ()=>{
		recordToolCapability('p', 'tm', false);
		const reg = mkRegistry(()=>({ ok: true }));
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'tm', registry: reg });
		expect(agent.mode).toBe('text');
		const act = '```' + ACTION_FENCE + '\n{"__horosaType":"action","calls":[{"name":"probe_read","args":{"q":"z"}}]}\n```';
		const scripts = [];
		for(let i = 0; i < AGENT_LIMITS.MAX_ROUNDS + 1; i++){ scripts.push([{ type: 'delta', json: { delta: act } }, { type: 'done', json: { finish_reason: 'stop' } }]); }
		const stream = mkStream(scripts);
		await drive(agent, stream);
		const lastReq = stream.calls[stream.calls.length - 1];
		const lastMsg = lastReq.messages[lastReq.messages.length - 1];
		expect(lastMsg.role).toBe('user');
		expect(`${lastMsg.content}`).toContain('【收口】');
		const prevReq = stream.calls[stream.calls.length - 2];
		expect(`${prevReq.messages[prevReq.messages.length - 1].content}`).not.toContain('【收口】');
		expect(agent.trace().stopReason).toBe('max_rounds');
	});
	it('路由收口(requestClose)后模型仍发调用 → stopReason=route_close 且提示文案不称「轮数上限」', async ()=>{
		recordToolCapability('p', 'nm', true);
		const reg = mkRegistry(()=>({ ok: true }));
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'nm', registry: reg });
		const stream = mkStream([
			[{ type: 'delta', json: { delta: '先答' } }, { type: 'done', json: { finish_reason: 'stop' } }],
			[...tc('c9', 'probe_read', {}), { type: 'done', json: { finish_reason: 'tool_calls' } }],
		]);
		let n = 0;
		await drive(agent, { calls: stream.calls, request: async (req, h)=>{ const r = await stream.request(req, h); if(n === 0){ agent.requestClose(); } n += 1; return r; } });
		const t = agent.trace();
		expect(t.stopReason).toBe('route_close');
		const last = t.rounds[t.rounds.length - 1];
		expect(last.results[0].code).toBe('E_LIMIT');
		expect(`${last.results[0].message}`).not.toContain('轮数已达上限');
	});
});
