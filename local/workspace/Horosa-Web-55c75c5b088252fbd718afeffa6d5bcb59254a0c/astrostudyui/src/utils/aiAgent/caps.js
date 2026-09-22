// AI 助手·模型工具能力记忆:按「接口档案::模型」记 native(原生 function calling)/text(围栏降级)。
// 首次未知按 native 试;上游明确报「不支持 tools」→ 记 text 并同轮降级重发一次;可「重新探测」清空。
import { safeJsonParseFromStorage, safeJsonStringifyToStorage } from '../safeStorage';

export const AGENT_CAPS_KEY = 'horosa.ai.agent.caps.v1';
// 网关措辞不可穷举:关键词 + 排除鉴权/限流类(那些不是能力问题,降级重发只会再吃一次)。
// 只认「参数不被识别 / 明确不支持工具或函数调用」类措辞;泛泛含 tool 一词的报错(如调用与结果不成对的
// 「must be followed by tool messages」「tool_use ids without tool_result」)绝不算能力问题——那是历史形状错,降级会把模型永久打成围栏模式。
export const UNSUPPORTED_TOOLS_RE = /unrecognized request argument[^.]*\btools?\b|unknown (parameter|argument|field)[^.]*\btools?\b|(does not|doesn't|do not|don't|cannot|can't|not) support(ed)?[^.]*(\btools?\b|function[\s_-]?call|\bfunctions?\b|tool use)|(\btools?\b|\bfunctions?\b|function[\s_-]?call(ing)?)[^.]*(not supported|unsupported|not available|not enabled|not permitted|not allowed|extra fields?)|unsupported[^.]*\btools?\b|tool_choice[^.]*(unsupported|not supported|unrecognized|unknown|invalid)|functionDeclarations[^.]*(unsupported|not supported|unrecognized|unknown|invalid)|invalid (parameter|argument)[^.]*\btools?\b|unknown field `?tools?`?/i;
const NOT_CAPABILITY_RE = /\b(401|403|429)\b|rate.?limit|unauthori[sz]ed|invalid api key|insufficient|quota|balance|must be followed|tool_result|tool_use ids|without tool_result|function response|function call turn|tool_call_id|preceding message/i;

export function capKey(profileId, model){
	return `${profileId || ''}::${model || ''}`;
}

function readAll(){
	const v = safeJsonParseFromStorage(AGENT_CAPS_KEY);
	return v && typeof v === 'object' ? v : {};
}

export function getToolCapability(profileId, model){
	const rec = readAll()[capKey(profileId, model)];
	if(!rec || typeof rec.native !== 'boolean'){ return 'unknown'; }
	return rec.native ? 'native' : 'text';
}

export function recordToolCapability(profileId, model, native){
	const all = readAll();
	all[capKey(profileId, model)] = { native: !!native, at: new Date().toISOString() };
	safeJsonStringifyToStorage(AGENT_CAPS_KEY, all);
}

export function resetToolCapabilities(){
	safeJsonStringifyToStorage(AGENT_CAPS_KEY, {});
}

export function isUnsupportedToolsError(message){
	const m = `${message || ''}`;
	if(!m){ return false; }
	if(NOT_CAPABILITY_RE.test(m)){ return false; }
	return UNSUPPORTED_TOOLS_RE.test(m);
}
