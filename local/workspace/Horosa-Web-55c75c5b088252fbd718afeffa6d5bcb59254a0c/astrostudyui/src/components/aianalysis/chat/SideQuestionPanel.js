// 旁问面板(A5;借鉴 Codex /side):临时问一句,右侧小面板流式作答——不进主线、不落库、不带工具;
// [Q-324] system 走页面的 buildResolvedPromptQuiet:与主发送**同一份**构造(前缀逐字节同构、照吃缓存),但一个页面态都不写
// ——否则旁问与主发送并发时会把横幅的裁剪账与 usage.prompt 稳定层指纹串台。
// 「转入主线」把问题交给 handleSend 正常发送。关闭即丢。
import React from 'react';
import { Drawer, Input, Button, message } from 'antd';
import { requestAIAnalysisChatStream } from '../../../services/aianalysis';
import { applyThinkingLevel, parseModelSelection, applyChatParams } from '../../../utils/aiAnalysisProviders';   // [Q-045] 浮层参数单源
import { readContextPolicy, windowChatMessages } from '../../../utils/aiChatHistory';
import { historyContentOf } from '../../../utils/aiBestOfN';

// [Q-287/PP-11] 旁问口径:带窗口化的主线历史(与主发送同 windowChatMessages;此前只发 [system,user],历史全靠 system 的
// 「最近对话」层——缺省窗口档该层不产生 → 旁问「刚才说的大运是哪一步」答不上,切不裁档才答得上)。
function sideHistory(d, mainline){
	const list = Array.isArray(d.messages) ? d.messages : [];
	const line = typeof mainline === 'function' ? mainline(list) : list;
	return line
		.filter((m)=>m && (m.role === 'user' || m.role === 'assistant') && m.streamStatus !== 'streaming' && `${historyContentOf(m) || ''}`.trim())
		.map((m)=>({ role: m.role, content: historyContentOf(m) }));
}

export default function SideQuestionPanel({ open, initialQuestion, onClose, deps, mainline, onMainline }){
	const [q, setQ] = React.useState(initialQuestion || '');
	const [answer, setAnswer] = React.useState('');
	const [busy, setBusy] = React.useState(false);
	const abortRef = React.useRef(null);
	React.useEffect(()=>{ if(open){ setQ(initialQuestion || ''); setAnswer(''); } }, [open, initialQuestion]);
	React.useEffect(()=>()=>{ if(abortRef.current){ abortRef.current.abort(); } }, []);
	async function ask(){
		const d = (deps && deps.current) || deps || {};
		const text = `${q || ''}`.trim();
		if(!text){ message.warning('写上要旁问的问题'); return; }
		const { profileId, model } = parseModelSelection(d.modelSelection);
		const profile = (d.providerProfiles || []).find((p)=>p && p.id === profileId) || d.activeProviderProfile;
		if(!profile || !model){ message.warning('请先选择可用模型'); return; }
		const _buildPrompt = typeof d.buildResolvedPromptQuiet === 'function' ? d.buildResolvedPromptQuiet : d.buildResolvedPrompt;
		if(typeof _buildPrompt !== 'function'){ message.warning('旁问暂不可用'); return; }
		setBusy(true); setAnswer('');
		const ac = new AbortController(); abortRef.current = ac;
		try{
			const pr = await _buildPrompt(text, profile, undefined);
			const system = pr && (pr.systemPrompt || pr.prompt || pr.system) ? `${pr.systemPrompt || pr.prompt || pr.system}` : '';
			// [Q-045] 旁问此前只套思考档,浮层里的温度 / top_p / 停止序列 / 两惩罚 / JSON 模式一概不发;
			// 现在与主发送同一份 applyChatParams —— 旁问问的是同一盘,参数口径该一致。
			const opts = applyChatParams(applyThinkingLevel({ ...(profile.providerOptions || {}) }, d.thinkingLevel || 'off', profile.providerType, model), {
				profile, model,
				temperature: d.chatTemperature, topP: d.chatTopP, stopSequences: d.stopSequences,
				frequencyPenalty: d.frequencyPenalty, presencePenalty: d.presencePenalty, jsonMode: d.jsonMode,
			});
			let buf = '';
			let sideMsgs = [{ role: 'system', content: system }].concat(sideHistory(d, mainline), [{ role: 'user', content: text }]);
			try{
				sideMsgs = windowChatMessages(sideMsgs, {
					model,
					numCtx: profile.providerType === 'ollama' ? Number((profile.providerOptions || {}).num_ctx) || undefined : undefined,
					policy: readContextPolicy(), replayTrace: false,
				}).messages;
			}catch(e){ /* 窗口失败保留全量 */ }
			await requestAIAnalysisChatStream({ providerType: profile.providerType, apiKey: profile.apiKey, baseUrl: profile.baseUrl, model, providerOptions: opts,
				messages: sideMsgs }, {
				signal: ac.signal,
				onEvent: (ev)=>{ if(ev && ev.type === 'delta' && ev.json && ev.json.delta){ buf += `${ev.json.delta}`; setAnswer(buf); } else if(ev && ev.type === 'error'){ message.error(`${(ev.json && ev.json.message) || ev.data || '上游错误'}`); } },
			});
			if(!buf.trim()){ setAnswer('(模型未返回内容)'); }
		}catch(e){ if(!(e && e.name === 'AbortError')){ message.error(`旁问失败:${e && e.message ? e.message : e}`); } }
		finally{ setBusy(false); abortRef.current = null; }
	}
	return (
		<Drawer title="旁问(不进主线、不保存)" placement="right" width={420} open={!!open} visible={!!open} onClose={()=>{ if(abortRef.current){ abortRef.current.abort(); } onClose(); }} data-side-question="1">
			<div data-side-question-panel="1" style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
				<Input.TextArea rows={3} value={q} onChange={(e)=>setQ(e.target.value)} placeholder="例:上升狮子是什么意思?" data-side-question-input="1" onPressEnter={(e)=>{ if(!e.shiftKey){ e.preventDefault(); if(!busy){ ask(); } } }} />
				<div style={{ display: 'flex', gap: 8 }}>
					<Button type="primary" size="small" loading={busy} onClick={ask} data-side-ask="1">问</Button>
					{busy ? <Button size="small" onClick={()=>{ if(abortRef.current){ abortRef.current.abort(); } }}>停止</Button> : null}
					<Button size="small" disabled={!`${q || ''}`.trim() || busy} onClick={()=>{ if(typeof onMainline === 'function'){ onMainline(`${q}`.trim()); } }} data-side-mainline="1">转入主线</Button>
				</div>
				<div data-side-answer="1" style={{ whiteSpace: 'pre-wrap', minHeight: 80, padding: 8, border: '1px dashed var(--horosa-border, #e5e7eb)', borderRadius: 8, color: answer ? 'inherit' : 'var(--horosa-text-soft, #8a8f99)' }}>{answer || '答案只显示在这里,关掉就没了。'}</div>
			</div>
		</Drawer>
	);
}
