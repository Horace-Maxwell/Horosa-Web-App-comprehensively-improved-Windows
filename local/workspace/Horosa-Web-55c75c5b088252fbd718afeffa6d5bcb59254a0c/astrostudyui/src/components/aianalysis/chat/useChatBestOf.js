// 多模型对比(C5)页面钩子:runBestOf(question) → 建/续会话 → 落用户消息 → 落带 candidates 的 assistant 占位 → N 路并行流(**不带 tools**,共享 AbortController,各自合帧)
// → 判官(路由 judge 槽;json_schema strict;失败回落按完成顺序第一)→ 采用稿进 content → 落库。采用/合并/停止 皆用户按钮。
import React from 'react';
import { message } from 'antd';
import { requestAIAnalysisChatStream, requestAIAnalysisChat } from '../../../services/aianalysis';
import { saveConversationMessage } from '../../../utils/aiAnalysisStore';
import { createStreamFlusher } from '../../../utils/aiStreamFlush';
import { applyThinkingLevel, parseModelSelection, applyChatParams } from '../../../utils/aiAnalysisProviders';   // [Q-045] 浮层参数单源
import { applyResponseSchema, requestStructuredWithFallback } from '../../../utils/aiStructuredOutput';
import { readModelRoutes, resolveRoute, providerOptionsForSlot } from '../../../utils/aiModelRouting';
import { planCandidates, estimateCandidatesCost, buildJudgePrompt, buildMergePrompt, parseJudge, JUDGE_SCHEMA, historyContentOf, candidateOverflow } from '../../../utils/aiBestOfN';
import { mountCharBudgetFor } from '../../../utils/aiAnalysisProviders';
import { readContextPolicy, windowChatMessages } from '../../../utils/aiChatHistory';
import { readBestOfPrefs } from './BestOfPanel';
import { buildCheckpoint } from '../../../utils/aiChat/checkpoint';

const now = ()=>new Date().toISOString();

export function useChatBestOf(depsRef, { mainline, confirmCost } = {}){
	const [busy, setBusy] = React.useState('');
	const abortRef = React.useRef(null);

	const patchMessage = React.useCallback((id, fn)=>{ const set = depsRef.current.setMessages; if(typeof set === 'function'){ set((prev)=>prev.map((m)=>(m && m.id === id ? fn(m) : m))); } }, [depsRef]);

	// 一路候选流:不带 tools/toolChoice;增量合帧写进 candidates[i].text
	const streamCandidates = React.useCallback(async ({ candidates, baseMessages, assistantId, ac }) =>{
		const d = depsRef.current;
		const texts = candidates.map(()=>'');
		const flushers = candidates.map((c, i)=>createStreamFlusher(()=>patchMessage(assistantId, (m)=>({ ...m, candidates: m.candidates.map((x, j)=>(j === i ? { ...x, text: texts[i] } : x)) }))));
		const runOne = async (c, i)=>{
			const t0 = Date.now();
			// [Q-045] 五类浮层参数走与主发送同一份 applyChatParams(此前只套了思考档 + 温度 + top_p,
			// 停止序列 / 两惩罚在多模型候选上是死的);候选流不挂 response_format,故 withJsonMode:false。
			let opts = applyChatParams(applyThinkingLevel({ ...(c.profile.providerOptions || {}) }, d.thinkingLevel || 'off', c.profile.providerType, c.model), {
				profile: c.profile, model: c.model,
				temperature: d.chatTemperature, topP: d.chatTopP, stopSequences: d.stopSequences,
				frequencyPenalty: d.frequencyPenalty, presencePenalty: d.presencePenalty, withJsonMode: false,
			});
			// [Q-287/PP-11] 历史经窗口策略(与主发送同函数):按候选自身模型/num_ctx 裁(此前全量历史直拼,窗口档对多模型无效);
			// legacy 档=原数组同引用零裁剪;候选历史不含 agentTrace,replayTrace 无关。
			let winMsgs = baseMessages;
			try{
				winMsgs = windowChatMessages(baseMessages, {
					model: c.model,
					numCtx: c.profile && c.profile.providerType === 'ollama' ? Number((c.profile.providerOptions || {}).num_ctx) || undefined : undefined,
					policy: readContextPolicy(), replayTrace: false,
				}).messages;
			}catch(e){ winMsgs = baseMessages; }
			const msgs = winMsgs.map((m, k)=>(k === 0 && m.role === 'system' && c.angle ? { ...m, content: `${m.content}\n\n【本候选视角】${c.angle.directive}` } : m));
			let usage = null; let err = null;
			try{
				await requestAIAnalysisChatStream({ providerType: c.profile.providerType, apiKey: c.profile.apiKey, baseUrl: c.profile.baseUrl, model: c.model, providerOptions: opts, messages: msgs }, {
					signal: ac.signal,
					onEvent: (ev)=>{
						if(!ev){ return; }
						if(ev.type === 'delta'){ const dlt = ev.json && ev.json.delta ? `${ev.json.delta}` : ''; if(dlt && !ac.signal.aborted){ texts[i] += dlt; flushers[i].schedule(); } }
						else if(ev.type === 'usage'){ if(ev.json && typeof ev.json === 'object'){ usage = ev.json; } }
						else if(ev.type === 'error'){ err = (ev.json && ev.json.message) ? `${ev.json.message}` : (ev.data || '上游错误'); }
					},
				});
			}catch(e){ if(!(e && e.name === 'AbortError')){ err = e && e.message ? `${e.message}` : `${e}`; } }
			flushers[i].flush();
			const elapsedMs = Date.now() - t0;
			const cost = usage ? estimateCandidatesCost({ candidates: [c], inputTokens: usage.input_tokens, outputTokens: usage.output_tokens }).per[0].costUsd : null;
			const status = ac.signal.aborted ? (texts[i] ? 'done' : 'aborted') : (err && !texts[i] ? 'error' : 'done');
			patchMessage(assistantId, (m)=>({ ...m, candidates: m.candidates.map((x, j)=>(j === i ? { ...x, text: texts[i], status, error: err || undefined, usage: usage || undefined, elapsedMs, costUsd: cost } : x)) }));
			return { id: c.id, text: texts[i], status, error: err, usage, elapsedMs, costUsd: cost };
		};
		return Promise.all(candidates.map((c, i)=>runOne(c, i)));
	}, [depsRef, patchMessage]);

	const judgeCandidates = React.useCallback(async ({ question, results, candidates, profile, model }) =>{
		const d = depsRef.current;
		const ok = results.filter((r)=>r.status === 'done' && `${r.text || ''}`.trim());
		if(ok.length < 2){ return { best: ok.length ? ok[0].id : null, ranking: ok.map((r)=>r.id), reasons: [], error: ok.length ? null : 'no_candidates', model: null, skipped: true }; }
		const route = resolveRoute('judge', { routes: readModelRoutes(), providerProfiles: d.providerProfiles, profile, model });
		// [Q-331/M-52] 候选上限按判官槽模型的挂载预算动态分配,并在截断处标注(此前固定 6000 字硬切、无标注)
		const judgeBudget = mountCharBudgetFor(route.model, { policy: readContextPolicy() });
		const jp = buildJudgePrompt({ question, candidates: ok.map((r)=>({ id: r.id, label: (candidates.find((c)=>c.id === r.id) || {}).label, text: r.text })), charBudget: judgeBudget });
		// [D1] 判官槽的思考档/推理档/温度/输出上限经单源施加(槽空=今日字节)
		let opts = providerOptionsForSlot('judge', route.profile, route.model, { applyThinkingLevel });
		opts = applyResponseSchema(opts, { name: 'bestof_judge', schema: JUDGE_SCHEMA });
		opts.requestTimeoutMs = 60000;
		try{
			const rsp = await requestStructuredWithFallback(requestAIAnalysisChat, { providerType: route.profile.providerType, apiKey: route.profile.apiKey, baseUrl: route.profile.baseUrl, model: route.model, providerOptions: opts, messages: [{ role: 'system', content: jp.system }, { role: 'user', content: jp.user }] });
			const text = rsp && rsp.Result && rsp.Result.content ? `${rsp.Result.content}` : '';
			const parsed = parseJudge(text, ok.map((r)=>r.id));
			if(!parsed){ return { best: ok[0].id, ranking: ok.map((r)=>r.id), reasons: [], error: 'unparseable', model: route.model }; }
			return { ...parsed, error: null, model: route.model };
		}catch(e){ return { best: ok[0].id, ranking: ok.map((r)=>r.id), reasons: [], error: e && e.message ? `${e.message}` : 'judge_failed', model: route.model }; }
	}, [depsRef]);

	const adopt = React.useCallback(async (assistantId, candidateId)=>{
		const d = depsRef.current;
		const cur = (d.messages || []).find((m)=>m && m.id === assistantId);
		if(!cur){ return; }
		const c = (cur.candidates || []).find((x)=>x.id === candidateId);
		if(!c){ return; }
		const next = { ...cur, content: `${c.text || ''}`, bestOf: { ...(cur.bestOf || {}), adoptedId: candidateId }, streamStatus: 'done', updatedAt: now() };
		patchMessage(assistantId, ()=>next);
		try{ await saveConversationMessage(next); }catch(e){ /* 落库失败不阻断显示 */ }
	}, [depsRef, patchMessage]);

	const merge = React.useCallback(async (assistantId)=>{
		const d = depsRef.current;
		const cur = (d.messages || []).find((m)=>m && m.id === assistantId);
		if(!cur || !Array.isArray(cur.candidates)){ return; }
		const ok = cur.candidates.filter((c)=>c.status === 'done' && `${c.text || ''}`.trim());
		if(ok.length < 2){ message.info('可合并的候选不足两份'); return; }
		const { profileId, model } = parseModelSelection(d.modelSelection);
		const profile = (d.providerProfiles || []).find((p)=>p && p.id === profileId) || d.activeProviderProfile;
		if(!profile || !model){ message.warning('请先选择可用模型'); return; }
		const route = resolveRoute('final', { routes: readModelRoutes(), providerProfiles: d.providerProfiles, profile, model });
		// [Q-331/M-52] 同判官:上限随终稿槽模型;有候选超限就先告诉用户哪几份是节选
		const mergeBudget = mountCharBudgetFor(route.model, { policy: readContextPolicy() });
		const over = candidateOverflow(ok, mergeBudget);
		if(over.length){
			message.info(`有 ${over.length} 份候选超过本次单份上限(${over[0].cap} 字),合并时按节选投喂并已注明`);
		}
		const mp = buildMergePrompt({ question: cur.bestOf && cur.bestOf.question, candidates: ok, ranking: cur.bestOf && cur.bestOf.ranking, charBudget: mergeBudget });
		setBusy('merge');
		try{
			// [D1] 合并稿走终稿槽:全局思考档为底,再按 final 槽参数施加(槽空=今日字节)
			const opts = providerOptionsForSlot('final', route.profile, route.model, { applyThinkingLevel, baseThinking: d.thinkingLevel || 'off' });
			const rsp = await requestAIAnalysisChat({ providerType: route.profile.providerType, apiKey: route.profile.apiKey, baseUrl: route.profile.baseUrl, model: route.model, providerOptions: { ...opts, requestTimeoutMs: 120000 }, messages: [{ role: 'system', content: mp.system }, { role: 'user', content: mp.user }] });
			const text = rsp && rsp.Result && rsp.Result.content ? `${rsp.Result.content}` : '';
			if(!text.trim()){ message.error('合并稿为空'); return; }
			const next = { ...cur, content: text, candidates: cur.candidates.concat(cur.candidates.some((c)=>c.id === 'merged') ? [] : [{ id: 'merged', label: `合并稿 · ${route.model}`, model: route.model, text, status: 'done' }]).map((c)=>(c.id === 'merged' ? { ...c, text } : c)), bestOf: { ...(cur.bestOf || {}), adoptedId: 'merged', mergedBy: route.model }, updatedAt: now() };
			patchMessage(assistantId, ()=>next);
			try{ await saveConversationMessage(next); }catch(e){ /* noop */ }
			message.success('已合并为一稿并采用');
		}catch(e){ message.error(`合并失败:${e && e.message ? e.message : e}`); }
		finally{ setBusy(''); }
	}, [depsRef, patchMessage]);

	const rejudge = React.useCallback(async (assistantId)=>{
		const d = depsRef.current;
		const cur = (d.messages || []).find((m)=>m && m.id === assistantId);
		if(!cur || !Array.isArray(cur.candidates)){ return; }
		const { profileId, model } = parseModelSelection(d.modelSelection);
		const profile = (d.providerProfiles || []).find((p)=>p && p.id === profileId) || d.activeProviderProfile;
		setBusy('judge');
		try{
			const results = cur.candidates.filter((c)=>c.id !== 'merged').map((c)=>({ id: c.id, text: c.text, status: c.status }));
			const j = await judgeCandidates({ question: cur.bestOf && cur.bestOf.question, results, candidates: cur.candidates, profile, model });
			const next = { ...cur, bestOf: { ...(cur.bestOf || {}), ranking: j.ranking, judge: { model: j.model, reasons: j.reasons, error: j.error } }, updatedAt: now() };
			patchMessage(assistantId, ()=>next);
			try{ await saveConversationMessage(next); }catch(e){ /* noop */ }
		}finally{ setBusy(''); }
	}, [depsRef, judgeCandidates, patchMessage]);

	const stop = React.useCallback(()=>{ if(abortRef.current){ abortRef.current.abort(); } }, []);

	// 主流程
	const run = React.useCallback(async (question)=>{
		const d = depsRef.current;
		const q = `${question || ''}`.trim();
		if(!q){ message.warning('写上要对比的问题,例:/多模型 今年事业如何'); return true; }
		if(d.sending){ message.warning('正在生成,稍后再试'); return true; }
		const { profileId, model } = parseModelSelection(d.modelSelection);
		const profile = (d.providerProfiles || []).find((p)=>p && p.id === profileId) || d.activeProviderProfile;
		if(!profile || !model){ message.warning('请先选择可用模型'); return true; }
		const prefs = readBestOfPrefs();
		let candidates = planCandidates({ mode: prefs.mode, selections: prefs.selections, providerProfiles: d.providerProfiles, profile, model, angles: prefs.angles });
		if(!candidates.length){ candidates = planCandidates({ mode: 'angles', selections: [], providerProfiles: d.providerProfiles, profile, model, angles: ['classic', 'cautious'] }); }
		if(!candidates.length){ message.warning('候选不足两份:到进阶页「多模型对比」选模型'); return true; }
		// [Q-324] 多模型对比是旁路:借同一份 system(前缀同构吃缓存)但不写页面态
		const _buildPrompt = typeof d.buildResolvedPromptQuiet === 'function' ? d.buildResolvedPromptQuiet : d.buildResolvedPrompt;
		if(typeof d.ensureConversationRecord !== 'function' || typeof _buildPrompt !== 'function'){ message.warning('多模型对比暂不可用'); return true; }
		const conversation = await d.ensureConversationRecord(q, profile, model);
		const promptResult = await _buildPrompt(q, profile, undefined);
		const est = estimateCandidatesCost({ candidates, inputTokens: Math.ceil(`${promptResult.systemPrompt || ''}`.length / 1.6) + Math.ceil(q.length / 1.6), outputTokens: 1200 });
		// [进阶复查 P3·2026-09-08] 无计价表也要确认(此前无价档直接跑 = 最不知道花多少的配置反而不问):文案改「费用未知」
		if(typeof confirmCost === 'function'){ const ok = await confirmCost({ candidates, est }); if(!ok){ return true; } }
		const userMessage = await saveConversationMessage({ conversationId: conversation.id, role: 'user', content: q, streamStatus: 'done', checkpoint: buildCheckpoint(d) });
		const assistant = await saveConversationMessage({ conversationId: conversation.id, role: 'assistant', content: '', streamStatus: 'streaming', candidates: candidates.map((c)=>({ id: c.id, label: c.label, model: c.model, angle: c.angle ? c.angle.key : null, text: '', status: 'streaming' })), bestOf: { mode: prefs.mode, question: q, adoptedId: null, ranking: [], startedAt: now() } });
		if(typeof d.setMessages === 'function'){ d.setMessages((prev)=>prev.concat(userMessage, assistant)); }
		if(typeof d.setPrompt === 'function'){ d.setPrompt(''); }
		// [Q-045] 历史消息带上图片(与主线 streamReply 同式):此前只取 content,带图会话的历史图片在多模型
		// 候选里整个丢掉 —— 候选看到的上下文比主线少一截。
		const history = (typeof mainline === 'function' ? mainline(d.messages || []) : (d.messages || [])).filter((m)=>m && (m.role === 'user' || m.role === 'assistant') && m.streamStatus !== 'streaming').map((m)=>({ role: m.role, content: historyContentOf(m), ...(Array.isArray(m.images) && m.images.length ? { images: m.images } : {}) }));
		const baseMessages = [{ role: 'system', content: `${promptResult.systemPrompt || ''}` }].concat(history, [{ role: 'user', content: q }]);
		const ac = new AbortController(); abortRef.current = ac;
		let results = [];
		try{ results = await streamCandidates({ candidates, baseMessages, assistantId: assistant.id, ac }); }
		finally{ abortRef.current = null; }
		// [Q-294/M-109·AR-05③] 「停止全部」后不再跑判官(此前半截文字记 done、≥2 份即照发判官请求):直接取首个有文字的候选
		const j = ac.signal.aborted
			? (()=>{ const ok = results.filter((r)=>`${r.text || ''}`.trim()); return { best: ok.length ? ok[0].id : null, ranking: ok.map((r)=>r.id), reasons: [], error: ok.length ? null : 'aborted', model: null, skipped: true }; })()
			: await judgeCandidates({ question: q, results, candidates, profile, model });
		const adoptedId = j.best;
		const adoptedText = adoptedId ? `${(results.find((r)=>r.id === adoptedId) || {}).text || ''}` : '';
		const latest = (depsRef.current.messages || []).find((m)=>m && m.id === assistant.id) || assistant;
		const final = { ...latest, candidates: (latest.candidates || []).map((c)=>{ const r = results.find((x)=>x.id === c.id); return r ? { ...c, text: r.text, status: r.status, error: r.error || undefined, usage: r.usage || undefined, elapsedMs: r.elapsedMs, costUsd: r.costUsd } : c; }),
			content: adoptedText, streamStatus: adoptedId ? 'done' : 'error', errorInfo: adoptedId ? null : { message: '所有候选都失败了' },
			bestOf: { ...(latest.bestOf || {}), adoptedId, ranking: j.ranking, judge: { model: j.model, reasons: j.reasons, error: j.error, skipped: !!j.skipped }, costUsd: results.reduce((s, r)=>(r.costUsd != null ? s + r.costUsd : s), 0) || null, finishedAt: now() },
			usage: (results.find((r)=>r.id === adoptedId) || {}).usage || undefined, updatedAt: now() };
		patchMessage(assistant.id, ()=>final);
		try{ await saveConversationMessage(final); }catch(e){ /* noop */ }
		return true;
	}, [depsRef, mainline, confirmCost, streamCandidates, judgeCandidates, patchMessage]);

	return { run, adopt, merge, rejudge, stop, busy };
}
