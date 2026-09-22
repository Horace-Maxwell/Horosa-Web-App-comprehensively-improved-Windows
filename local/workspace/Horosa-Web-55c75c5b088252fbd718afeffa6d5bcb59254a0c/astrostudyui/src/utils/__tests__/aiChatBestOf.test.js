// 多模型对比(C5)钩子合同:/多模型 → 两路候选并行流(请求无 tools/toolChoice,各自视角进 system)→ 判官(json_schema strict,路由 judge 槽)→ 采用稿进 content;
// 候选与 bestOf 落在 assistant 消息;用户消息带检查点;停止令两路一起停;判官坏 JSON → 回落第一份并标 error。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { useChatAssist } from '../../components/aianalysis/chat/useChatAssist';

const streamCalls = [];
// [压测二轮·D5·B1/B2] 部分/全部候选失败:用例可临时接管流的行为(缺省=原来的两路都成功)
var mockBestOfHook = { stream: null };
jest.mock('../../services/aianalysis', ()=>({
	requestAIAnalysisChatStream: jest.fn(async (values, handlers)=>{ streamCalls.push(values); if(mockBestOfHook && typeof mockBestOfHook.stream === 'function'){ return mockBestOfHook.stream(values, handlers); } const tag = values.messages[0].content.indexOf('经典派') >= 0 ? '经典' : '审慎'; handlers.onEvent({ type: 'delta', json: { delta: `${tag}回答` } }); handlers.onEvent({ type: 'usage', json: { input_tokens: 10, output_tokens: 5 } }); handlers.onEvent({ type: 'done', json: {} }); }),
	requestAIAnalysisChat: jest.fn(async (values)=>{ const sys = values.messages[0].content; if(sys.indexOf('【多模型判官】') === 0){ return { Result: { content: JSON.stringify({ best: 'c2', ranking: ['c2', 'c1'], reasons: [{ id: 'c2', score: 9, reason: '稳' }] }) } }; } return { Result: { content: '合并稿' } }; }),
}));
// [P3·2026-09-08] 无计价表也弹费用确认(文案「费用未知」):jsdom 里自动按「发送」,并记下文案供断言
var mockConfirmCalls = [];
jest.mock('antd', ()=>{ const antd = jest.requireActual('antd'); return { ...antd, Modal: { ...antd.Modal, confirm: (o)=>{ mockConfirmCalls.push(o); if(o && typeof o.onOk === 'function'){ o.onOk(); } return { destroy(){} }; } } }; });
jest.mock('../aiAnalysisStore', ()=>({ ...jest.requireActual('../aiAnalysisStore'), saveConversationMessage: jest.fn(async (m)=>({ id: m.id || `msg-${Math.random().toString(36).slice(2, 8)}`, ...m })) }));
const { requestAIAnalysisChat } = require('../../services/aianalysis');
const { saveConversationMessage } = require('../aiAnalysisStore');

const profile = { id: 'p1', name: 'P', providerType: 'openai', apiKey: 'k', baseUrl: 'http://x', providerOptions: {} };
const flush = ()=>new Promise((r)=>setTimeout(r, 30));
let host; let api = null;
function Harness({ deps }){ api = useChatAssist(deps); return null; }
beforeEach(()=>{ window.localStorage.clear(); mockBestOfHook.stream = null; streamCalls.length = 0; mockConfirmCalls.length = 0; saveConversationMessage.mockClear(); requestAIAnalysisChat.mockClear(); host = document.createElement('div'); document.body.appendChild(host); });
afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); });

it('🔴 /多模型:未设置 → 当前模型 × 经典/审慎两路;请求无 tools;判官 strict;采用 c2 进 content;候选/判官/检查点落库', async ()=>{
	let messages = [];
	const deps = { prompt: '', setPrompt: jest.fn(), sending: false, messages, setMessages: jest.fn((fn)=>{ messages = typeof fn === 'function' ? fn(messages) : fn; deps.messages = messages; }), bundles: [], sources: [], activeSource: null, providerProfiles: [profile], modelSelection: 'p1::mock-model', activeProviderProfile: profile, thinkingLevel: 'off',
		ensureConversationRecord: jest.fn(async ()=>({ id: 'conv-1' })), buildResolvedPrompt: jest.fn(async ()=>({ systemPrompt: '【系统】前缀' })), activeConversation: { id: 'conv-1' }, handleSend: jest.fn() };
	act(()=>{ ReactDOM.render(<Harness deps={deps} />, host); });
	expect(api.interceptSend('/多模型 今年事业如何')).toBe(true);
	await flush(); await flush(); await flush();
	expect(deps.ensureConversationRecord).toHaveBeenCalledWith('今年事业如何', profile, 'mock-model');
	expect(streamCalls.length).toBe(2);
	// [P3] 无计价表:仍先弹确认,文案「费用未知」(此前无价档直接跑)
	expect(mockConfirmCalls.length).toBe(1);
	expect(`${mockConfirmCalls[0].content}`).toContain('费用未知');
	streamCalls.forEach((v)=>{ expect(v.tools).toBeUndefined(); expect(v.toolChoice).toBeUndefined(); expect(v.messages[0].content.indexOf('【系统】前缀')).toBe(0); expect(v.messages[v.messages.length - 1].content).toBe('今年事业如何'); });
	expect(streamCalls[0].messages[0].content).toContain('【本候选视角】');
	expect(requestAIAnalysisChat).toHaveBeenCalledTimes(1);
	const judgeReq = requestAIAnalysisChat.mock.calls[0][0];
	expect(judgeReq.providerOptions.response_format.type).toBe('json_schema');
	expect(judgeReq.messages[0].content.indexOf('【多模型判官】')).toBe(0);
	const saved = saveConversationMessage.mock.calls.map((c)=>c[0]);
	expect(saved[0].role).toBe('user'); expect(saved[0].checkpoint).toBeDefined();
	const finalMsg = saved[saved.length - 1];
	expect(finalMsg.role).toBe('assistant');
	expect(finalMsg.candidates.map((c)=>c.status)).toEqual(['done', 'done']);
	expect(finalMsg.bestOf.adoptedId).toBe('c2');
	expect(finalMsg.bestOf.ranking).toEqual(['c2', 'c1']);
	expect(finalMsg.content).toBe('审慎回答');
	expect(finalMsg.streamStatus).toBe('done');
	expect(api.bestOfCards(finalMsg)).not.toBe(null);
	expect(api.bestOfCards({ role: 'assistant', content: 'x' })).toBe(null);
});

// ---- [压测二轮·D5·B1/B2] 候选部分失败 / 全部失败 ----
function mkDeps(){
	let messages = [];
	const deps = { prompt: '', setPrompt: jest.fn(), sending: false, messages, setMessages: jest.fn((fn)=>{ messages = typeof fn === 'function' ? fn(messages) : fn; deps.messages = messages; }), bundles: [], sources: [], activeSource: null, providerProfiles: [profile], modelSelection: 'p1::mock-model', activeProviderProfile: profile, thinkingLevel: 'off',
		ensureConversationRecord: jest.fn(async ()=>({ id: 'conv-1' })), buildResolvedPrompt: jest.fn(async ()=>({ systemPrompt: '【系统】前缀' })), activeConversation: { id: 'conv-1' }, handleSend: jest.fn() };
	return deps;
}

it('B1 一路 500 一路成功:采存活稿进 content,candidates.status 含 error,候选不足两份时不再花判官一跑', async ()=>{
	mockBestOfHook.stream = async (values, handlers)=>{
		// 第一路 = 经典视角(directive 原文,不是 label);它整条 500
		if(values.messages[0].content.indexOf('以经典古法为准绳') >= 0){ throw new Error('HTTP 500 上游服务错误'); }
		handlers.onEvent({ type: 'delta', json: { delta: '审慎回答' } });
		handlers.onEvent({ type: 'usage', json: { input_tokens: 10, output_tokens: 5 } });
		handlers.onEvent({ type: 'done', json: {} });
	};
	const deps = mkDeps();
	act(()=>{ ReactDOM.render(<Harness deps={deps} />, host); });
	expect(api.interceptSend('/多模型 今年事业如何')).toBe(true);
	await flush(); await flush(); await flush();
	expect(streamCalls.length).toBe(2);
	const saved = saveConversationMessage.mock.calls.map((c)=>c[0]);
	const finalMsg = saved[saved.length - 1];
	expect(finalMsg.candidates.map((c)=>c.status).sort()).toEqual(['done', 'error']);
	expect(finalMsg.candidates.find((c)=>c.status === 'error').error).toContain('500');
	expect(finalMsg.content).toBe('审慎回答');
	expect(finalMsg.streamStatus).toBe('done');
	expect(finalMsg.bestOf.adoptedId).toBe('c2');
	expect(finalMsg.bestOf.judge.skipped).toBe(true);
	expect(requestAIAnalysisChat).not.toHaveBeenCalled();   // 只剩一份存活稿 → 不发判官请求
});

it('B2 两路全失败:content 空、streamStatus=error、errorInfo 说明,且零判官请求', async ()=>{
	mockBestOfHook.stream = async ()=>{ throw new Error('HTTP 500 上游服务错误'); };
	const deps = mkDeps();
	act(()=>{ ReactDOM.render(<Harness deps={deps} />, host); });
	expect(api.interceptSend('/多模型 今年事业如何')).toBe(true);
	await flush(); await flush(); await flush();
	expect(streamCalls.length).toBe(2);
	const saved = saveConversationMessage.mock.calls.map((c)=>c[0]);
	const finalMsg = saved[saved.length - 1];
	expect(finalMsg.candidates.map((c)=>c.status)).toEqual(['error', 'error']);
	expect(finalMsg.content).toBe('');
	expect(finalMsg.streamStatus).toBe('error');
	expect(finalMsg.errorInfo.message).toContain('所有候选');
	expect(finalMsg.bestOf.adoptedId).toBe(null);
	expect(finalMsg.bestOf.judge.error).toBe('no_candidates');
	expect(requestAIAnalysisChat).not.toHaveBeenCalled();
});

// ---- [进阶审计 D1] 判官槽参数:此前判官请求硬编码 applyThinkingLevel(...,'off'),表格里判官行的温度/上限写了键从不生效 ----
it('🔴 [D1] 判官槽 temperature 0.3 / maxTokens 555 进判官请求;槽空孪生两键皆无(缺省字节锁)', async ()=>{
	const { writeRouteOptions } = require('../aiModelRouting');
	writeRouteOptions({ judge: { temperature: 0.3, maxTokens: 555 } });
	let deps = mkDeps();
	act(()=>{ ReactDOM.render(<Harness deps={deps} />, host); });
	expect(api.interceptSend('/多模型 今年事业如何')).toBe(true);
	await flush(); await flush(); await flush();
	expect(requestAIAnalysisChat).toHaveBeenCalledTimes(1);
	const judgeReq = requestAIAnalysisChat.mock.calls[0][0];
	expect(judgeReq.providerOptions.temperature).toBe(0.3);
	expect(judgeReq.providerOptions.max_tokens).toBe(555);
	expect(judgeReq.providerOptions.response_format.type).toBe('json_schema');
	// 候选流本身不吃判官槽参数
	streamCalls.forEach((v)=>{ expect(v.providerOptions.max_tokens).toBeUndefined(); });
	// 孪生:清键 → 两键皆无
	act(()=>{ ReactDOM.unmountComponentAtNode(host); });
	window.localStorage.clear(); requestAIAnalysisChat.mockClear(); streamCalls.length = 0; saveConversationMessage.mockClear();
	deps = mkDeps();
	act(()=>{ ReactDOM.render(<Harness deps={deps} />, host); });
	expect(api.interceptSend('/多模型 今年事业如何')).toBe(true);
	await flush(); await flush(); await flush();
	const twin = requestAIAnalysisChat.mock.calls[0][0];
	expect(twin.providerOptions.temperature).toBeUndefined();
	expect(twin.providerOptions.max_tokens).toBeUndefined();
});
