// 旁问(A5)合同:面板发起的请求复用页面 buildResolvedPrompt 的 system、不带 tools、不落任何消息;流式增量渲染到面板;「转入主线」把问题交回;关闭即丢。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import SideQuestionPanel from '../../components/aianalysis/chat/SideQuestionPanel';

jest.mock('../../services/aianalysis', ()=>({ requestAIAnalysisChatStream: jest.fn(async (values, handlers)=>{ handlers.onEvent({ type: 'delta', json: { delta: '上升狮子=' } }); handlers.onEvent({ type: 'delta', json: { delta: '外显自信' } }); handlers.onEvent({ type: 'done', json: {} }); }), requestAIAnalysisChat: jest.fn() }));
jest.mock('../aiAnalysisStore', ()=>({ ...jest.requireActual('../aiAnalysisStore'), saveConversationMessage: jest.fn() }));
const { requestAIAnalysisChatStream } = require('../../services/aianalysis');
const { saveConversationMessage } = require('../aiAnalysisStore');

const flush = ()=>new Promise((r)=>setTimeout(r, 20));
let host;
beforeEach(()=>{ host = document.createElement('div'); document.body.appendChild(host); requestAIAnalysisChatStream.mockClear(); });
afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); });

it('🔴 [Q-287/PP-11] 旁问带窗口化主线历史:mainline 过滤替代稿与流式中消息,历史夹在 system 与本问之间', async ()=>{
	const profile = { id: 'p1', providerType: 'openai', apiKey: 'k', baseUrl: 'http://x', providerOptions: {} };
	const messages = [
		{ id: 'u1', role: 'user', content: '我的大运是哪一步', streamStatus: 'done' },
		{ id: 'a0', role: 'assistant', content: '(被替代稿)', streamStatus: 'done', supersededBy: 'a1' },
		{ id: 'a1', role: 'assistant', content: '现行第三步壬申大运', streamStatus: 'done' },
		{ id: 'a2', role: 'assistant', content: '生成中', streamStatus: 'streaming' },
	];
	const deps = { current: { modelSelection: 'p1::m', providerProfiles: [profile], thinkingLevel: 'off', messages, buildResolvedPrompt: jest.fn(async ()=>({ systemPrompt: 'S' })) } };
	const mainline = (list)=>list.filter((m)=>!m.supersededBy);
	await act(async ()=>{ ReactDOM.render(<SideQuestionPanel open initialQuestion="刚才说的大运是哪一步" onClose={jest.fn()} deps={deps} mainline={mainline} onMainline={jest.fn()} />, host); await flush(); });
	await act(async ()=>{ document.querySelector('[data-side-ask="1"]').click(); await flush(); await flush(); });
	const values = requestAIAnalysisChatStream.mock.calls[requestAIAnalysisChatStream.mock.calls.length - 1][0];
	expect(values.messages.map((m)=>m.role)).toEqual(['system', 'user', 'assistant', 'user']);
	expect(values.messages[1].content).toBe('我的大运是哪一步');
	expect(values.messages[2].content).toBe('现行第三步壬申大运');
	expect(values.messages[3].content).toBe('刚才说的大运是哪一步');
});

it('🔴 旁问:system 来自 buildResolvedPrompt、请求无 tools、不落库;答案流式进面板;转入主线回调带问题', async ()=>{
	const profile = { id: 'p1', providerType: 'openai', apiKey: 'k', baseUrl: 'http://x', providerOptions: {} };
	const deps = { current: { modelSelection: 'p1::m', providerProfiles: [profile], thinkingLevel: 'off', buildResolvedPrompt: jest.fn(async ()=>({ systemPrompt: '【系统】同一前缀' })) } };
	const onMainline = jest.fn(); const onClose = jest.fn();
	await act(async ()=>{ ReactDOM.render(<SideQuestionPanel open initialQuestion="上升狮子是什么意思" onClose={onClose} deps={deps} onMainline={onMainline} />, host); await flush(); });
	const ask = document.querySelector('[data-side-ask="1"]');
	await act(async ()=>{ ask.click(); await flush(); await flush(); });
	expect(deps.current.buildResolvedPrompt).toHaveBeenCalledWith('上升狮子是什么意思', profile, undefined);
	expect(requestAIAnalysisChatStream).toHaveBeenCalledTimes(1);
	const values = requestAIAnalysisChatStream.mock.calls[0][0];
	expect(values.tools).toBeUndefined();
	expect(values.toolChoice).toBeUndefined();
	expect(values.messages[0]).toEqual({ role: 'system', content: '【系统】同一前缀' });
	expect(values.messages[1].content).toBe('上升狮子是什么意思');
	expect(document.querySelector('[data-side-answer="1"]').textContent).toBe('上升狮子=外显自信');
	expect(saveConversationMessage).not.toHaveBeenCalled();
	// [Q-287/PP-11] 无主线消息时仍是 [system, user] 两条(下一例验带历史)
	expect(values.messages.length).toBe(2);
	await act(async ()=>{ document.querySelector('[data-side-mainline="1"]').click(); await flush(); });
	expect(onMainline).toHaveBeenCalledWith('上升狮子是什么意思');
});

// [Q-324] 旁问是旁路:页面给了无副作用的构造就必须用它(否则与主发送并发时,横幅裁剪账/usage 稳定层指纹串台)
it('🔴 旁问优先用 buildResolvedPromptQuiet(无副作用构造),不碰会写页面态的那个', async ()=>{
	const profile = { id: 'p1', providerType: 'openai', apiKey: 'k', baseUrl: 'http://x', providerOptions: {} };
	const loud = jest.fn(async ()=>({ systemPrompt: '【会写页面态】' }));
	const quiet = jest.fn(async ()=>({ systemPrompt: '【无副作用】' }));
	const deps = { current: { modelSelection: 'p1::m', providerProfiles: [profile], thinkingLevel: 'off', buildResolvedPrompt: loud, buildResolvedPromptQuiet: quiet } };
	await act(async ()=>{ ReactDOM.render(<SideQuestionPanel open initialQuestion="问一句" onClose={jest.fn()} deps={deps} onMainline={jest.fn()} />, host); await flush(); });
	await act(async ()=>{ document.querySelector('[data-side-ask="1"]').click(); await flush(); await flush(); });
	expect(quiet).toHaveBeenCalledWith('问一句', profile, undefined);
	expect(loud).not.toHaveBeenCalled();
	expect(requestAIAnalysisChatStream.mock.calls[0][0].messages[0].content).toBe('【无副作用】');
});
