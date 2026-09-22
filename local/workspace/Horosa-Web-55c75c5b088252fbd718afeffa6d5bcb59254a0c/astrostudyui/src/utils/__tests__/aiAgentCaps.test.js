// AI 助手·「不支持 tools」判定语料锁:降级判定是正则对网关自由文案的猜测,双向误判都有代价——
// 该降不降=每轮报错到用户;不该降却降=该 profile::model 永久丢原生 function calling(直到「重新探测」)。
// 语料=各家网关/推理框架的真实报错原文;新增网关文案先进这里再改正则。
import { isUnsupportedToolsError, UNSUPPORTED_TOOLS_RE } from '../aiAgent/caps';

const UNSUPPORTED = [
	'Unrecognized request argument supplied: tools',
	"Unknown parameter: 'tools'.",
	'Invalid parameter: tools is not supported for this model',
	'This model does not support tools',
	'registry.ollama.ai/library/llama2:latest does not support tools',
	'model does not support function calling',
	'Tool calling is not supported by this model',
	'tool_choice is not supported by this model',
	'functions is not supported',
	'unsupported field: tools',
	"{\"error\":{\"message\":\"'tools' is not supported for model glm-3\",\"type\":\"invalid_request_error\"}}",
	'This API does not support tool use',
	'The model does not support function-call',
	'Function calling is not enabled for this model',
	'unknown field `tools`',
	'tools: extra fields not permitted',
];

const NOT_CAPABILITY = [
	'401 Unauthorized',
	'Incorrect API key provided: sk-abc. You can find your API key at …',
	'Rate limit reached for requests',
	'429 Too Many Requests',
	"This model's maximum context length is 8192 tokens. However, your messages resulted in 9000 tokens.",
	'insufficient_quota: You exceeded your current quota, please check your plan and billing details.',
	"An assistant message with 'tool_calls' must be followed by tool messages responding to each 'tool_call_id'.",
	'messages.1: `tool_use` ids were found without `tool_result` blocks immediately after',
	"Invalid value for 'tool_call_id'",
	'Please ensure that function response turn comes immediately after a function call turn.',
	'model not found: gpt-nope',
	'connection timed out',
	'The server had an error while processing your request. Sorry about that!',
	'invalid_request_error: max_tokens must be at least 1',
	'403 Forbidden: account balance insufficient',
];

describe('isUnsupportedToolsError 语料', ()=>{
	UNSUPPORTED.forEach((s)=>{
		it(`应判「不支持 tools」: ${s.slice(0, 60)}`, ()=>{
			expect([s, isUnsupportedToolsError(s)]).toEqual([s, true]);
		});
	});
	NOT_CAPABILITY.forEach((s)=>{
		it(`不得判「不支持 tools」: ${s.slice(0, 60)}`, ()=>{
			expect([s, isUnsupportedToolsError(s)]).toEqual([s, false]);
		});
	});
	it('空/非字符串恒 false', ()=>{
		expect(isUnsupportedToolsError('')).toBe(false);
		expect(isUnsupportedToolsError(null)).toBe(false);
		expect(isUnsupportedToolsError(undefined)).toBe(false);
	});
	it('正则常量导出且不含 g 标志(带 g 的 test() 有 lastIndex 状态,交替结果)', ()=>{
		expect(UNSUPPORTED_TOOLS_RE).toBeInstanceOf(RegExp);
		expect(UNSUPPORTED_TOOLS_RE.flags.includes('g')).toBe(false);
	});
});
