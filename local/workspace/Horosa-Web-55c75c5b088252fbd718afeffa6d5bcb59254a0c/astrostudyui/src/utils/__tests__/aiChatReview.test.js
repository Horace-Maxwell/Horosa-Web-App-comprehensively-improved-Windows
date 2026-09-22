// 回答审阅(C6)钩子合同:/审阅 → 找到上一条回答与其提问 → 复用 buildResolvedPrompt 的 system + 页面注入的确定性问题 → 审阅模型(跨家族优先)非流式 json_schema strict、零工具
// → 批注落消息 .review;按批注重写 → buildResolvedPrompt 第三参带【按审阅重写】→ 单路流不带工具 → 新气泡 rewriteOf、原气泡 supersededBy、mainline 剔除被替代稿。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { useChatAssist } from '../../components/aianalysis/chat/useChatAssist';
import { encodeModelSelection } from '../aiAnalysisProviders';

const streamCalls = [];
jest.mock('../../services/aianalysis', ()=>({
	requestAIAnalysisChatStream: jest.fn(async (values, handlers)=>{ streamCalls.push(values); handlers.onEvent({ type: 'delta', json: { delta: '改正后:日主甲木' } }); handlers.onEvent({ type: 'usage', json: { input_tokens: 10, output_tokens: 5 } }); handlers.onEvent({ type: 'done', json: {} }); }),
	requestAIAnalysisChat: jest.fn(async (values)=>{ const sys = values.messages[0].content; if(sys.indexOf('【回答审阅】') >= 0){ return { Result: { content: JSON.stringify({ verdict: 'issues', issues: [{ kind: 'error', quote: '日主乙木', reason: '排盘为甲木', severity: 3 }], summary: '一处错误' }) } }; } return { Result: { content: '{}' } }; }),
}));
jest.mock('../aiAnalysisStore', ()=>({ ...jest.requireActual('../aiAnalysisStore'), saveConversationMessage: jest.fn(async (m)=>({ id: m.id || `msg-${Math.random().toString(36).slice(2, 8)}`, ...m })) }));
const { requestAIAnalysisChat } = require('../../services/aianalysis');
const { saveConversationMessage } = require('../aiAnalysisStore');

const pA = { id: 'p1', name: 'A', providerType: 'openai', apiKey: 'k', baseUrl: 'http://x', providerOptions: {}, enabled: true, chatModelIds: ['gpt-x'] };
const pB = { id: 'p2', name: 'B', providerType: 'anthropic', apiKey: 'k2', baseUrl: 'http://y', providerOptions: {}, enabled: true, chatModelIds: ['claude-y'] };
const flush = ()=>new Promise((r)=>setTimeout(r, 30));
let host; let api = null;
function Harness({ deps }){ api = useChatAssist(deps); return null; }
function mkDeps(extra){
	let messages = extra.messages || [];
	const deps = { prompt: '', setPrompt: jest.fn(), sending: false, bundles: [], sources: [], providerProfiles: [pA, pB], activeProviderProfile: pA, modelSelection: encodeModelSelection('p1', 'gpt-x'), activeConversation: { id: 'conv-1' }, activeConversationId: 'conv-1', handleSend: jest.fn(), ...extra };
	deps.messages = messages;
	deps.setMessages = jest.fn((fn)=>{ messages = typeof fn === 'function' ? fn(messages) : fn; deps.messages = messages; });
	return deps;
}
beforeEach(()=>{ window.localStorage.clear(); streamCalls.length = 0; saveConversationMessage.mockClear(); requestAIAnalysisChat.mockClear(); host = document.createElement('div'); document.body.appendChild(host); });
afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); });

const baseMsgs = ()=>[{ id: 'u1', role: 'user', content: '我的日主是什么', streamStatus: 'done', createdAt: '2026-01-01T00:00:00.000Z' }, { id: 'a1', role: 'assistant', content: '你的日主乙木', streamStatus: 'done', createdAt: '2026-01-01T00:00:01.000Z' }];

it('🔴 /审阅:跨家族审阅模型 strict JSON 零工具;确定性问题与挂载 system 进审阅 system;批注落消息;按批注重写 → 新气泡 rewriteOf + 原稿 supersededBy + mainline 剔除', async ()=>{
	const det = jest.fn(async ()=>['[错误·bazi] 日主应为甲木']);
	const deps = mkDeps({ messages: baseMsgs(), activeSource: { id: 'local-1', title: '张三' }, buildResolvedPrompt: jest.fn(async ()=>({ systemPrompt: '【案例】张三 日主甲木' })), deterministicIssues: det });
	act(()=>{ ReactDOM.render(<Harness deps={deps} />, host); });
	expect(api.interceptSend('/审阅')).toBe(true);
	await flush(); await flush(); await flush();
	expect(requestAIAnalysisChat).toHaveBeenCalledTimes(1);
	const req = requestAIAnalysisChat.mock.calls[0][0];
	expect(req.providerType).toBe('anthropic');
	expect(req.model).toBe('claude-y');
	expect(req.providerOptions.response_format.type).toBe('json_schema');
	expect(req.tools).toBeUndefined();
	const sys = req.messages[0].content;
	expect(sys.indexOf('【回答审阅】')).toBeGreaterThan(0);   // [Q-290/PP-19] 挂载 system 在最前,审阅标记在其后
	expect(sys).toContain('1. [错误·bazi] 日主应为甲木');
	expect(sys).toContain('【案例】张三 日主甲木');
	expect(req.messages[1].content).toContain('你的日主乙木');
	expect(det).toHaveBeenCalledTimes(1);
	expect(deps.buildResolvedPrompt).toHaveBeenCalledWith('我的日主是什么', pA, undefined);
	const a1 = deps.messages.find((m)=>m.id === 'a1');
	expect(a1.review.status).toBe('done');
	expect(a1.review.verdict).toBe('issues');
	expect(a1.review.issues[0].kind).toBe('error');
	expect(a1.review.crossFamily).toBe(true);
	expect(a1.review.hasData).toBe(true);
	expect(a1.review.deterministicCount).toBe(1);
	expect(saveConversationMessage.mock.calls.some((c)=>c[0].id === 'a1' && c[0].review && c[0].review.status === 'done')).toBe(true);
	// 按批注重写
	await act(async ()=>{ await api.review.rewrite(a1); });
	await flush();
	expect(deps.buildResolvedPrompt).toHaveBeenLastCalledWith('我的日主是什么', pA, expect.stringContaining('【按审阅重写】'));
	expect(deps.buildResolvedPrompt.mock.calls[1][2]).toContain('「日主乙木」:排盘为甲木');
	expect(streamCalls.length).toBe(1);
	expect(streamCalls[0].tools).toBeUndefined();
	expect(streamCalls[0].messages[0].role).toBe('system');
	expect(streamCalls[0].messages[streamCalls[0].messages.length - 1]).toEqual({ role: 'user', content: '我的日主是什么' });
	expect(streamCalls[0].messages.some((m)=>m.content === '你的日主乙木')).toBe(false);
	const rw = deps.messages.find((m)=>m.rewriteOf === 'a1');
	expect(rw.content).toBe('改正后:日主甲木');
	expect(rw.streamStatus).toBe('done');
	expect(deps.messages.find((m)=>m.id === 'a1').supersededBy).toBe(rw.id);
	expect(api.mainline(deps.messages).map((m)=>m.id)).toEqual(['u1', rw.id]);
	expect(api.reviewNotes(deps.messages.find((m)=>m.id === 'a1'))).not.toBe(null);
	expect(api.reviewNotes({ id: 'x', role: 'assistant', content: 'plain' })).toBe(null);
});

it('无对应提问 → 不请求;无其它家族档案且未挂数据 → 同家族 + 未对拍;坏 JSON → status error;重写无批注 → 不发流', async ()=>{
	const deps = mkDeps({ messages: [{ id: 'a0', role: 'assistant', content: '孤零零的回答', streamStatus: 'done' }], providerProfiles: [pA], activeSource: null, buildResolvedPrompt: jest.fn(async ()=>({ systemPrompt: '' })) });
	act(()=>{ ReactDOM.render(<Harness deps={deps} />, host); });
	expect(api.interceptSend('/审阅')).toBe(true);
	await flush();
	expect(requestAIAnalysisChat).toHaveBeenCalledTimes(0);
	requestAIAnalysisChat.mockImplementationOnce(async ()=>({ Result: { content: '不是 JSON' } }));
	deps.messages = baseMsgs(); deps.setMessages((prev)=>deps.messages);
	await act(async ()=>{ await api.review.run(deps.messages[1]); });
	await flush();
	expect(requestAIAnalysisChat).toHaveBeenCalledTimes(1);
	const req = requestAIAnalysisChat.mock.calls[0][0];
	expect(req.providerType).toBe('openai');
	expect(req.messages[0].content).toContain('未挂载排盘数据');
	const a1 = deps.messages.find((m)=>m.id === 'a1');
	expect(a1.review.status).toBe('error');
	expect(a1.review.crossFamily).toBe(false);
	expect(a1.review.hasData).toBe(false);
	await act(async ()=>{ await api.review.rewrite(a1); });
	expect(streamCalls.length).toBe(0);
});

// ---- [进阶审计 D1] 审阅槽参数:此前审阅请求硬编码 applyThinkingLevel(...,'off'),审阅行的温度/上限写了键从不生效 ----
it('🔴 [D1] 审阅槽 maxTokens 444 / temperature 0.2 进审阅请求(跨家族目标不变);槽空孪生两键皆无', async ()=>{
	const { writeRouteOptions } = require('../aiModelRouting');
	writeRouteOptions({ review: { maxTokens: 444, temperature: 0.2 } });
	const mk = ()=>mkDeps({ messages: baseMsgs(), activeSource: { id: 'local-1', title: '张三' }, buildResolvedPrompt: jest.fn(async ()=>({ systemPrompt: 'S' })) });
	let deps = mk();
	act(()=>{ ReactDOM.render(<Harness deps={deps} />, host); });
	expect(api.interceptSend('/审阅')).toBe(true);
	await flush(); await flush(); await flush();
	const req = requestAIAnalysisChat.mock.calls[0][0];
	expect(req.model).toBe('claude-y');
	expect(req.providerOptions.max_tokens).toBe(444);
	expect(req.providerOptions.temperature).toBe(0.2);
	expect(req.providerOptions.response_format.type).toBe('json_schema');
	act(()=>{ ReactDOM.unmountComponentAtNode(host); });
	window.localStorage.clear(); requestAIAnalysisChat.mockClear(); streamCalls.length = 0; saveConversationMessage.mockClear();
	deps = mk();
	act(()=>{ ReactDOM.render(<Harness deps={deps} />, host); });
	expect(api.interceptSend('/审阅')).toBe(true);
	await flush(); await flush(); await flush();
	const twin = requestAIAnalysisChat.mock.calls[0][0];
	expect(twin.providerOptions.max_tokens).toBeUndefined();
	expect(twin.providerOptions.temperature).toBeUndefined();
});
