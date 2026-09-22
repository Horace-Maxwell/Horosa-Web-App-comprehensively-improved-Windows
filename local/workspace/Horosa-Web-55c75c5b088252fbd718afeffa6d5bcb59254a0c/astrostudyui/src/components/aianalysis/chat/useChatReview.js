// AI 对话·回答审阅(C6;借鉴 Codex / Claude Code /review)页面钩子:
//   run(item):找到这条回答对应的提问 → 复用 buildResolvedPrompt 得同一份挂载数据 system(前缀同构吃缓存)→ 页面注入的确定性问题(deterministicIssues;公版无=[])
//     → 审阅模型 = 路由 review 槽 > 跨家族 > 当前(非流式,json_schema strict,零工具)→ 批注落在该 assistant 消息 .review。
//   rewrite(item):buildRewriteDirective 进 extraSystemContext(只这一轮)→ 单路流不带工具 → 新气泡 rewriteOf=原 id;原气泡保留并标 supersededBy(主线历史只带重写稿)。
import React from 'react';
import { message } from 'antd';
import { requestAIAnalysisChatStream, requestAIAnalysisChat } from '../../../services/aianalysis';
import { saveConversationMessage } from '../../../utils/aiAnalysisStore';
import { createStreamFlusher } from '../../../utils/aiStreamFlush';
import { applyThinkingLevel, parseModelSelection, applyChatParams } from '../../../utils/aiAnalysisProviders';   // [Q-045] 浮层参数单源
import { applyResponseSchema, requestStructuredWithFallback } from '../../../utils/aiStructuredOutput';
import { readModelRoutes, providerOptionsForSlot } from '../../../utils/aiModelRouting';
import { REVIEW_SCHEMA, buildReviewSystemPrompt, buildReviewUserPrompt, pickReviewModel, parseReview, buildRewriteDirective } from '../../../utils/aiReview';
import { historyContentOf } from '../../../utils/aiBestOfN';
import { readContextPolicy, windowChatMessages } from '../../../utils/aiChatHistory';

const now = ()=>new Date().toISOString();

// 这条回答对应的提问:向前找最近一条 user
export function questionBefore(list, idx){
	for(let i = idx - 1; i >= 0; i--){ const m = list[i]; if(m && m.role === 'user'){ return { text: `${m.content || ''}`, index: i }; } }
	return null;
}

export function useChatReview(depsRef, { mainline } = {}){
	const [busy, setBusy] = React.useState('');           // 审阅中的消息 id
	const [rewriting, setRewriting] = React.useState(''); // 重写中的原消息 id
	const busyRef = React.useRef(''); const rewritingRef = React.useRef('');
	const abortRef = React.useRef(null);
	const patchMessage = React.useCallback((id, fn)=>{ const set = depsRef.current.setMessages; if(typeof set === 'function'){ set((prev)=>prev.map((m)=>(m && m.id === id ? fn(m) : m))); } }, [depsRef]);
	const latestOf = React.useCallback((id, fallback)=>(depsRef.current.messages || []).find((m)=>m && m.id === id) || fallback, [depsRef]);
	const currentModel = React.useCallback(()=>{
		const d = depsRef.current;
		const { profileId, model } = parseModelSelection(d.modelSelection);
		const profile = (d.providerProfiles || []).find((p)=>p && p.id === profileId) || d.activeProviderProfile;
		return { profile, model };
	}, [depsRef]);

	const run = React.useCallback(async (item)=>{
		const d = depsRef.current;
		if(!item || item.role !== 'assistant' || !`${item.content || ''}`.trim()){ message.warning('只能审阅已完成的回答'); return true; }
		if(busyRef.current){ message.warning('上一条审阅还在进行'); return true; }
		const { profile, model } = currentModel();
		if(!profile || !model){ message.warning('请先选择可用模型'); return true; }
		const list = d.messages || [];
		const idx = list.findIndex((m)=>m && m.id === item.id);
		const q = questionBefore(list, idx);
		if(!q || !q.text.trim()){ message.warning('找不到这条回答对应的提问'); return true; }
		busyRef.current = item.id; setBusy(item.id);
		patchMessage(item.id, (m)=>({ ...m, review: { ...(m.review || {}), status: 'running' } }));
		try{
			// [Q-324] 审阅是旁路:借同一份 system(前缀同构吃缓存)但不写页面态
			const _buildPrompt = typeof d.buildResolvedPromptQuiet === 'function' ? d.buildResolvedPromptQuiet : d.buildResolvedPrompt;
			const promptResult = typeof _buildPrompt === 'function' ? await _buildPrompt(q.text, profile, undefined) : { systemPrompt: '' };
			let det = [];
			try{ if(typeof d.deterministicIssues === 'function'){ det = (await d.deterministicIssues(item, promptResult)) || []; } }catch(e){ det = []; }
			const pick = pickReviewModel({ routes: readModelRoutes(), providerProfiles: d.providerProfiles, profile, model });
			const hasData = !!d.activeSource;
			const system = buildReviewSystemPrompt({ snapshotSystem: promptResult && promptResult.systemPrompt, deterministicIssues: det, hasData });
			// [D1] 审阅槽的思考档/推理档/温度/输出上限经单源施加(槽空=今日字节)
			let opts = providerOptionsForSlot('review', pick.profile, pick.model, { applyThinkingLevel });
			opts = applyResponseSchema(opts, { name: 'answer_review', schema: REVIEW_SCHEMA });
			opts.requestTimeoutMs = 90000;
			const rsp = await requestStructuredWithFallback(requestAIAnalysisChat, { providerType: pick.profile.providerType, apiKey: pick.profile.apiKey, baseUrl: pick.profile.baseUrl, model: pick.model, providerOptions: opts, messages: [{ role: 'system', content: system }, { role: 'user', content: buildReviewUserPrompt({ question: q.text, answer: item.content }) }] });
			const text = rsp && rsp.Result && rsp.Result.content ? `${rsp.Result.content}` : '';
			const parsed = parseReview(text);
			const base = { model: pick.model, profileName: pick.profile.name || '', crossFamily: !!pick.crossFamily, via: pick.via, hasData, deterministicCount: det.length, at: now() };
			const review = parsed ? { ...parsed, ...base, status: 'done' } : { verdict: '', issues: [], summary: '', ...base, status: 'error', error: '审阅模型没有返回合法 JSON' };
			const next = { ...latestOf(item.id, item), review, updatedAt: now() };
			patchMessage(item.id, ()=>next);
			try{ await saveConversationMessage(next); }catch(e){ /* 落库失败不阻断显示 */ }
			if(!parsed){ message.warning('审阅结果无法解析,可再审一次'); }
		}catch(e){
			const err = e && e.message ? `${e.message}` : `${e}`;
			const next = { ...latestOf(item.id, item), review: { verdict: '', issues: [], summary: '', status: 'error', error: err, at: now() }, updatedAt: now() };
			patchMessage(item.id, ()=>next);
			try{ await saveConversationMessage(next); }catch(e2){ /* noop */ }
			message.error(`审阅失败:${err}`);
		}finally{ busyRef.current = ''; setBusy(''); }
		return true;
	}, [depsRef, currentModel, patchMessage, latestOf]);

	const rewrite = React.useCallback(async (item)=>{
		const d = depsRef.current;
		const cur = latestOf(item && item.id, item);
		const rv = cur && cur.review;
		if(!rv || !Array.isArray(rv.issues) || !rv.issues.length){ message.info('这条回答没有需要改正的批注'); return true; }
		if(cur.supersededBy){ message.info('这条回答已经按审阅重写过了'); return true; }
		if(d.sending || rewritingRef.current){ message.warning('正在生成,稍后再试'); return true; }
		const { profile, model } = currentModel();
		const _buildPrompt2 = typeof d.buildResolvedPromptQuiet === 'function' ? d.buildResolvedPromptQuiet : d.buildResolvedPrompt;   // [Q-324]
		if(!profile || !model || !d.activeConversation || typeof _buildPrompt2 !== 'function'){ message.warning('请先选择可用模型'); return true; }
		const list = d.messages || [];
		const idx = list.findIndex((m)=>m && m.id === cur.id);
		const q = questionBefore(list, idx);
		if(!q){ message.warning('找不到这条回答对应的提问'); return true; }
		const directive = buildRewriteDirective(rv);
		rewritingRef.current = cur.id; setRewriting(cur.id);
		let placeholder = null;
		try{
			const promptResult = await _buildPrompt2(q.text, profile, directive);
			placeholder = await saveConversationMessage({ conversationId: d.activeConversation.id, role: 'assistant', content: '', streamStatus: 'streaming', rewriteOf: cur.id, createdAt: now(), updatedAt: now() });
			if(typeof d.setMessages === 'function'){ d.setMessages((prev)=>prev.concat(placeholder)); }
			// 历史 = 原回答之前的主线(以这条提问收尾),不含被替代稿
			const base = list.slice(0, idx);
			// [Q-045] 同式带上历史图片(此前「按审阅重写」看不到原对话里的图)
			const history = (typeof mainline === 'function' ? mainline(base) : base).filter((m)=>m && (m.role === 'user' || m.role === 'assistant') && m.streamStatus !== 'streaming' && `${historyContentOf(m) || ''}`.trim()).map((m)=>({ role: m.role, content: historyContentOf(m), ...(Array.isArray(m.images) && m.images.length ? { images: m.images } : {}) }));
			if(!history.length || history[history.length - 1].role !== 'user'){ history.push({ role: 'user', content: q.text }); }
			// [Q-287/PP-11] 按审阅重写(用当前主选模型发)的历史同样经窗口策略(此前全量直拼;legacy 档零裁剪)
			let msgs = [{ role: 'system', content: `${promptResult.systemPrompt || ''}` }].concat(history);
			try{
				msgs = windowChatMessages(msgs, {
					model,
					numCtx: profile && profile.providerType === 'ollama' ? Number((profile.providerOptions || {}).num_ctx) || undefined : undefined,
					policy: readContextPolicy(), replayTrace: false,
				}).messages;
			}catch(e){ /* 窗口失败保留全量 */ }
			// [Q-045] 与主发送同一份 applyChatParams(此前停止序列 / 两惩罚在「按审阅重写」上是死的);
			// 重写走单路流、不挂 response_format,故 withJsonMode:false。
			let opts = applyChatParams(applyThinkingLevel({ ...(profile.providerOptions || {}) }, d.thinkingLevel || 'off', profile.providerType, model), {
				profile, model,
				temperature: d.chatTemperature, topP: d.chatTopP, stopSequences: d.stopSequences,
				frequencyPenalty: d.frequencyPenalty, presencePenalty: d.presencePenalty, withJsonMode: false,
			});
			const ac = new AbortController(); abortRef.current = ac;
			let text = ''; let usage = null; let err = null;
			const flusher = createStreamFlusher(()=>patchMessage(placeholder.id, (m)=>({ ...m, content: text })));
			try{
				await requestAIAnalysisChatStream({ providerType: profile.providerType, apiKey: profile.apiKey, baseUrl: profile.baseUrl, model, providerOptions: opts, messages: msgs }, {
					signal: ac.signal,
					onEvent: (ev)=>{
						if(!ev){ return; }
						if(ev.type === 'delta'){ const dlt = ev.json && ev.json.delta ? `${ev.json.delta}` : ''; if(dlt && !ac.signal.aborted){ text += dlt; flusher.schedule(); } }
						else if(ev.type === 'usage'){ if(ev.json && typeof ev.json === 'object'){ usage = ev.json; } }
						else if(ev.type === 'error'){ err = (ev.json && ev.json.message) ? `${ev.json.message}` : (ev.data || '上游错误'); }
					},
				});
			}catch(e){ if(!(e && e.name === 'AbortError')){ err = e && e.message ? `${e.message}` : `${e}`; } }
			finally{ abortRef.current = null; }
			flusher.flush();
			const status = ac.signal.aborted ? (text ? 'aborted' : 'error') : (err && !text ? 'error' : 'done');
			const final = { ...latestOf(placeholder.id, placeholder), content: text, streamStatus: status, errorInfo: status === 'error' ? { message: err || '已停止' } : null, usage: usage || undefined, updatedAt: now() };
			patchMessage(placeholder.id, ()=>final);
			try{ await saveConversationMessage(final); }catch(e){ /* noop */ }
			if(status !== 'error'){
				const orig = { ...latestOf(cur.id, cur), supersededBy: placeholder.id, updatedAt: now() };
				patchMessage(cur.id, ()=>orig);
				try{ await saveConversationMessage(orig); }catch(e){ /* noop */ }
			}
		}catch(e){
			const err = e && e.message ? `${e.message}` : `${e}`;
			if(placeholder){ const failed = { ...latestOf(placeholder.id, placeholder), streamStatus: 'error', errorInfo: { message: err }, updatedAt: now() }; patchMessage(placeholder.id, ()=>failed); try{ await saveConversationMessage(failed); }catch(e2){ /* noop */ } }
			message.error(`重写失败:${err}`);
		}finally{ rewritingRef.current = ''; setRewriting(''); }
		return true;
	}, [depsRef, currentModel, patchMessage, latestOf, mainline]);

	const stop = React.useCallback(()=>{ const ac = abortRef.current; if(ac){ ac.abort(); } }, []);

	return { run, rewrite, stop, busy, rewriting };
}
