// [Q-288] 围栏降级协议:坏块 / 多块 / 参数含三连反引号 / 语言标签带字 / 重复 callId
// 此前一律**静默丢掉整轮调用**,模型收不到任何反馈,只能反复重发同一个坏块。
// 现在:能认的更多(标签带字也认),认不了的回喂结构化错误(带码 + 位置 + 成因提示)。
import { parseActionBlock, parseActionBlockDetailed, protocolErrorCall, ACTION_FENCE } from '../aiAgent/textProtocol';

const fence = (body, tag)=>'```' + (tag || ACTION_FENCE) + '\n' + body + '\n```';
const good = '{"__horosaType":"action","__schema":1,"calls":[{"id":"c1","name":"list_records","args":{}}]}';

it('🔴 正常块照旧解析(零回归);语言标签后带字也认', ()=>{
	const a = parseActionBlockDetailed(`正文\n${fence(good)}`);
	expect(a.error).toBe(null);
	expect(a.hit.calls.map((c)=>c.name)).toEqual(['list_records']);
	// [Q-288] 标签带字:此前整块不匹配 → 调用凭空消失
	const b = parseActionBlockDetailed(`正文\n${fence(good, 'horosa-action json')}`);
	expect(b.error).toBe(null);
	expect(b.hit.calls.length).toBe(1);
	expect(parseActionBlock(`正文\n${fence(good, 'horosa-action json')}`)).not.toBe(null);
});

it('🔴 坏 JSON → E_ACTION_BLOCK_BAD_JSON,消息带解析器原话与块起始偏移', ()=>{
	const bad = '{"__horosaType":"action","calls":[{"id":"c1","name":"x",}]}';   // 尾逗号
	const r = parseActionBlockDetailed(`前言\n${fence(bad)}`);
	expect(r.hit).toBe(null);
	expect(r.error.code).toBe('E_ACTION_BLOCK_BAD_JSON');
	expect(r.error.message).toMatch(/第 \d+ 个字符/);
	expect(r.error.message).toMatch(/未执行/);
});

it('🔴 参数里带三连反引号把围栏截断 → 报坏 JSON 并点名成因', ()=>{
	const withTicks = '{"__horosaType":"action","calls":[{"id":"c1","name":"note_progress","args":{"text":"看这段 ```py\\nx=1\\n```"}}]}';
	const r = parseActionBlockDetailed(`正文\n${fence(withTicks)}`);
	expect(r.hit).toBe(null);
	expect(r.error.code).toBe('E_ACTION_BLOCK_BAD_JSON');
	expect(r.error.message).toContain('三连反引号');
});

it('🔴 多个动作块 → E_ACTION_BLOCK_MULTIPLE,明确拒(不逐个执行)', ()=>{
	const r = parseActionBlockDetailed(`一\n${fence(good)}\n二\n${fence(good)}`);
	expect(r.hit).toBe(null);
	expect(r.error.code).toBe('E_ACTION_BLOCK_MULTIPLE');
	expect(r.error.message).toContain('2 个动作块');
});

it('🔴 同块内重复 callId → E_PROTOCOL_DUP_ID(结果无法与调用配对)', ()=>{
	const dup = '{"__horosaType":"action","calls":[{"id":"c1","name":"list_records"},{"id":"c1","name":"get_current_context"}]}';
	const r = parseActionBlockDetailed(`正文\n${fence(dup)}`);
	expect(r.hit).toBe(null);
	expect(r.error.code).toBe('E_PROTOCOL_DUP_ID');
	expect(r.error.message).toContain('c1');
});

it('🔴 判别向量:块合法但不在末尾仍**静默**不执行(注入回声不回喂),非本协议的块照旧无视', ()=>{
	const mid = parseActionBlockDetailed(`前言\n${fence(good)}\n后话`);
	expect(mid.hit).toBe(null);
	expect(mid.error).toBe(null);
	const notOurs = parseActionBlockDetailed('```json\n{"calls":[{"name":"x"}]}\n```');
	expect(notOurs.hit).toBe(null);
	expect(notOurs.error).toBe(null);
	// 坏 JSON 但没有判别戳 = 不是本协议的块,也不该回喂错误
	const notOursBad = parseActionBlockDetailed('```json\n{"calls":[,]}\n```');
	expect(notOursBad.error).toBe(null);
});

it('🔴 protocolErrorCall 产出运行时能消费的伪调用(带 protocolError + protocolCode)', ()=>{
	const r = parseActionBlockDetailed(`正文\n${fence('{"__horosaType":"action","calls":[}')}`);
	const call = protocolErrorCall(r.error);
	expect(call.protocolCode).toBe('E_ACTION_BLOCK_BAD_JSON');
	expect(call.protocolError).toBe(r.error.message);
	expect(call.name).toBe('');
	expect(protocolErrorCall(null)).toBe(null);
});
