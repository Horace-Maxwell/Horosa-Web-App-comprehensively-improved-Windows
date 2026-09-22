// 结构化输出(C3)合同:applyResponseSchema 产 OpenAI 形 json_schema(strict 下每个 object 节点 additionalProperties:false + required 全列,不支持关键字剥掉,
// 嵌套 >5 层/根非 object 回落 json_object,不改入参);名字净化;parseStructuredJson 围栏/散文/字符串内括号;判官 schema 构造;指纹键序敏感。
import { applyResponseSchema, normalizeStrictSchema, hasResponseSchema, describeResponseFormat, buildEnumVerdictSchema, parseStructuredJson, sanitizeSchemaName, schemaFingerprint, SCHEMA_NAME_FALLBACK, STRUCTURED_FORMAT_TYPE, requestStructuredWithFallback, withoutResponseFormat } from '../aiStructuredOutput';

describe('applyResponseSchema / normalizeStrictSchema', ()=>{
	it('🔴 strict:每个 object 节点补 additionalProperties:false + required=全部属性;数组 items/anyOf 也走;不改入参', ()=>{
		const schema = { type: 'object', properties: { a: { type: 'string' }, b: { type: 'object', properties: { c: { type: 'integer' } } }, list: { type: 'array', items: { type: 'object', properties: { x: { type: 'number' } } } }, u: { anyOf: [{ type: 'object', properties: { y: { type: 'string' } } }, { type: 'null' }] } } };
		const before = JSON.stringify(schema);
		const base = { temperature: 0.2 };
		const opts = applyResponseSchema(base, { name: 'judge verdict', schema });
		expect(JSON.stringify(schema)).toBe(before);
		expect(base.response_format).toBeUndefined();
		expect(opts.temperature).toBe(0.2);
		expect(opts.response_format.type).toBe(STRUCTURED_FORMAT_TYPE);
		expect(opts.response_format.json_schema.name).toBe('judge_verdict');
		expect(opts.response_format.json_schema.strict).toBe(true);
		const s = opts.response_format.json_schema.schema;
		expect(s.additionalProperties).toBe(false);
		expect(s.required).toEqual(['a', 'b', 'list', 'u']);
		expect(s.properties.b.additionalProperties).toBe(false);
		expect(s.properties.b.required).toEqual(['c']);
		expect(s.properties.list.items.required).toEqual(['x']);
		expect(s.properties.u.anyOf[0].required).toEqual(['y']);
		expect(hasResponseSchema(opts)).toBe(true);
		expect(describeResponseFormat(opts)).toBe('json_schema:judge_verdict');
	});
	it('strict 剥掉不支持的校验关键字(default/minLength/pattern/minimum…)并计数;strict:false 保留且不补 required', ()=>{
		const schema = { type: 'object', properties: { n: { type: 'integer', minimum: 1, maximum: 5, default: 2 }, s: { type: 'string', minLength: 1, pattern: '^a' } }, required: ['n'] };
		const stats = {};
		const strict = normalizeStrictSchema(schema, { stats });
		expect(strict.properties.n).toEqual({ type: 'integer' });
		expect(strict.properties.s).toEqual({ type: 'string' });
		expect(strict.required).toEqual(['n', 's']);
		expect(stats.dropped).toBe(5);
		const loose = normalizeStrictSchema(schema, { strict: false });
		expect(loose.properties.n.minimum).toBe(1);
		expect(loose.required).toEqual(['n']);
		expect(loose.additionalProperties).toBeUndefined();
		const o2 = applyResponseSchema({}, { name: 'x', schema, strict: false });
		expect(o2.response_format.json_schema.strict).toBe(false);
	});
	it('🔴 根非 object / 嵌套超 5 层 / 无 schema → 回落 json_object(仍要求 JSON);名字非法回落缺省名', ()=>{
		expect(applyResponseSchema({}, { name: 'x', schema: { type: 'string' } }).response_format).toEqual({ type: 'json_object' });
		let deep = { type: 'object', properties: { leaf: { type: 'string' } } };
		for(let i = 0; i < 6; i++){ deep = { type: 'object', properties: { inner: deep } }; }
		expect(applyResponseSchema({}, { name: 'x', schema: deep }).response_format).toEqual({ type: 'json_object' });
		expect(applyResponseSchema({}, { name: 'x' }).response_format).toEqual({ type: 'json_object' });
		expect(describeResponseFormat({ response_format: { type: 'json_object' } })).toBe('json_object');
		expect(describeResponseFormat({})).toBe('text');
		expect(hasResponseSchema({ response_format: { type: 'json_object' } })).toBe(false);
		expect(sanitizeSchemaName('判官')).toBe(SCHEMA_NAME_FALLBACK);
		expect(sanitizeSchemaName('9abc')).toBe(SCHEMA_NAME_FALLBACK);
		expect(sanitizeSchemaName('goal-judge_v1')).toBe('goal-judge_v1');
		expect(sanitizeSchemaName('a'.repeat(80)).length).toBe(64);
	});
});

describe('buildEnumVerdictSchema / parseStructuredJson / schemaFingerprint', ()=>{
	it('判官 schema:status 枚举 + reason + nextStep(可关)+ 追加字段;封闭且 required 全列', ()=>{
		const s = buildEnumVerdictSchema({ statuses: ['done', 'continue', 'blocked'], extra: { score: { type: 'integer' }, bad: 'nope' } });
		expect(s.properties.status.enum).toEqual(['done', 'continue', 'blocked']);
		expect(Object.keys(s.properties)).toEqual(['status', 'reason', 'nextStep', 'score']);
		expect(s.required).toEqual(['status', 'reason', 'nextStep', 'score']);
		expect(s.additionalProperties).toBe(false);
		const s2 = buildEnumVerdictSchema({ statuses: ['a', 'b'], withNextStep: false });
		expect(Object.keys(s2.properties)).toEqual(['status', 'reason']);
		const opts = applyResponseSchema({}, { name: 'goal_judge', schema: s });
		expect(opts.response_format.json_schema.schema.properties.status.enum).toEqual(['done', 'continue', 'blocked']);
	});
	it('🔴 parseStructuredJson:纯 JSON / ```json 围栏 / 散文包裹 / 数组根 / 字符串内括号不算 / 坏文本 null', ()=>{
		expect(parseStructuredJson('{"a":1}')).toEqual({ a: 1 });
		expect(parseStructuredJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
		expect(parseStructuredJson('判定如下:{"status":"done","reason":"ok}"} 完毕')).toEqual({ status: 'done', reason: 'ok}' });
		expect(parseStructuredJson('结果 [1,2,{"x":"]"}] 后语')).toEqual([1, 2, { x: ']' }]);
		expect(parseStructuredJson('{"a":1')).toBe(null);
		expect(parseStructuredJson('')).toBe(null);
		expect(parseStructuredJson('没有 JSON')).toBe(null);
		expect(parseStructuredJson('{"s":"he said \\"{\\" ok"}')).toEqual({ s: 'he said "{" ok' });
	});
	it('指纹:同形状同值;键序/内容变化即变', ()=>{
		const a = schemaFingerprint({ type: 'object', properties: { x: { type: 'string' } } });
		expect(a).toMatch(/^sch-[0-9a-f]{8}$/);
		expect(schemaFingerprint({ type: 'object', properties: { x: { type: 'string' } } })).toBe(a);
		expect(schemaFingerprint({ type: 'object', properties: { x: { type: 'integer' } } })).not.toBe(a);
		expect(schemaFingerprint({ properties: { x: { type: 'string' } }, type: 'object' })).not.toBe(a);
	});
});

// ---- [压测二轮·D5·C1] 结构化输出降级:超深 schema 必须整条回落 json_object,绝不半截发出去 ----
describe('C1 schema 深度闸', ()=>{
	const chain = (k)=>{ let n = { type: 'object', properties: { leaf: { type: 'string' } } }; for(let i = 1; i < k; i++){ n = { type: 'object', properties: { inner: n } }; } return n; };
	// chain(k) = k 层对象 + 一个叶子 → 走 walk 的层数 = k+1;SCHEMA_MAX_DEPTH=5 → chain(4)(共 5 层)通过、chain(5)(共 6 层)拒
	it('C1 深 6 层 schema → normalizeStrictSchema 为 null 且 applyResponseSchema 回落 json_object;5 层照常出 json_schema', ()=>{
		expect(normalizeStrictSchema(chain(4))).not.toBe(null);
		expect(applyResponseSchema({}, { name: 'ok5', schema: chain(4) }).response_format.type).toBe(STRUCTURED_FORMAT_TYPE);
		expect(normalizeStrictSchema(chain(5))).toBe(null);
		expect(applyResponseSchema({}, { name: 'deep6', schema: chain(5) }).response_format).toEqual({ type: 'json_object' });
		// items / anyOf 分支同样计深度(不是只数 properties)
		const viaItems = { type: 'object', properties: { rows: { type: 'array', items: { type: 'object', properties: { a: { type: 'object', properties: { b: { type: 'object', properties: { c: { type: 'string' } } } } } } } } } };
		expect(applyResponseSchema({}, { name: 'items', schema: viaItems }).response_format).toEqual({ type: 'json_object' });
		// 回落后仍要求 JSON(不是退成纯文本)
		expect(describeResponseFormat(applyResponseSchema({}, { name: 'deep6', schema: chain(5) }))).toBe('json_object');
	});
});

// [D11] 第三级降级(空正文):带 response_format 的结构化短调用拿到空正文 → 去掉 response_format 重发一次;有正文/无 response_format 不重发
describe('[D11] requestStructuredWithFallback', ()=>{
	const ok = (text)=>({ Result: { content: text } });
	test('🔴 首发空正文(DeepSeek 把输出写进 reasoning)→ 去掉 response_format 重发并采用重发结果', async ()=>{
		const calls = [];
		const request = jest.fn(async (p)=>{ calls.push(p.providerOptions); return calls.length === 1 ? { Result: { content: '', reasoning: '…' } } : ok('{"verdict":"ok"}'); });
		const rsp = await requestStructuredWithFallback(request, { model: 'm', providerOptions: { temperature: 0.3, response_format: { type: 'json_object' } } });
		expect(request).toHaveBeenCalledTimes(2);
		expect(calls[0].response_format).toEqual({ type: 'json_object' });
		expect(calls[1].response_format).toBeUndefined();
		expect(calls[1].temperature).toBe(0.3);   // 其它槽参数原样带上
		expect(rsp.Result.content).toBe('{"verdict":"ok"}');
	});
	test('首发有正文 → 不重发;首发空且没带 response_format → 不重发(返回首发);重发仍空 → 返回首发', async ()=>{
		const r1 = jest.fn(async ()=>ok('x'));
		await requestStructuredWithFallback(r1, { providerOptions: { response_format: { type: 'json_object' } } });
		expect(r1).toHaveBeenCalledTimes(1);
		const r2 = jest.fn(async ()=>({ Result: { content: '' } }));
		const out2 = await requestStructuredWithFallback(r2, { providerOptions: { temperature: 0.1 } });
		expect(r2).toHaveBeenCalledTimes(1);
		expect(out2.Result.content).toBe('');
		const first = { Result: { content: '', reasoning: 'r' } };
		const r3 = jest.fn(async ()=>first);
		const out3 = await requestStructuredWithFallback(r3, { providerOptions: { response_format: { type: 'json_schema' } } });
		expect(r3).toHaveBeenCalledTimes(2);
		expect(out3).toBe(first);
		expect(withoutResponseFormat({ a: 1, response_format: {} })).toEqual({ a: 1 });
	});
});
