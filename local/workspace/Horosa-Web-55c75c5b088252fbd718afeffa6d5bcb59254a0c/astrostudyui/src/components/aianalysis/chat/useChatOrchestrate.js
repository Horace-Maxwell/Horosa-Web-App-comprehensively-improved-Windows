// AI 对话·多技法编排(C7;借鉴 Roo Code 编排模式 / Claude Code 子代理)页面钩子:
//   /编排 问题 → 子开关门 → 建/续会话、落用户消息(检查点)与 assistant 占位 → runOrchestration(纯控制流)注入 IO:
//   plan  = planner 槽非流式 json_schema strict;runSubtask = 每子任务一个子 Turn(buildHeadlessSystemPrompt 只挂该技法层;createAgentTurn 限 3 轮 / 0 写入 / 只读注册表视图;subagent 槽流式);
//   synthesize = final 槽非流式 strict → content=综合稿+分歧标注(确定性渲染);orchestration={plan,subTurns,synthesis,requests,models} 落消息;子 Turn trace 不进 agentTrace(历史不回放)。
import React from 'react';
import { message } from 'antd';
import { requestAIAnalysisChatStream, requestAIAnalysisChat } from '../../../services/aianalysis';
import { saveConversationMessage } from '../../../utils/aiAnalysisStore';
import { createStreamFlusher } from '../../../utils/aiStreamFlush';
import { applyThinkingLevel, parseModelSelection } from '../../../utils/aiAnalysisProviders';
import { applyResponseSchema, requestStructuredWithFallback } from '../../../utils/aiStructuredOutput';
import { readModelRoutes, resolveRoute, providerOptionsForSlot } from '../../../utils/aiModelRouting';
import { createAgentTurn } from '../../../utils/aiAgent/runtime';
import { isOrchestrateEnabled } from '../../../utils/aiAgent/prefs';
import { buildHeadlessSystemPrompt } from '../../../utils/aiAgent/goalRunner';
import { ANALYSIS_TECHNIQUE_LABELS, ANALYSIS_CHART_TECHNIQUES, ANALYSIS_CASE_TECHNIQUES } from '../../../utils/aiAnalysisContext';
import { ORCH_LIMITS, PLAN_SCHEMA, SYNTH_SCHEMA, runOrchestration, defaultReadOnlyRegistry } from '../../../utils/aiAgent/orchestrator';
import { buildCheckpoint } from '../../../utils/aiChat/checkpoint';

const now = ()=>new Date().toISOString();
export const ORCH_SETUP_HINT = '请先在进阶页「行动能力」卡打开「多技法并行分析」子开关(子开关在总开关打开后显示;开好后总开关可关;输入 / 可在菜单里看到这条命令是否已可用)';

export function labelOfTechnique(key){ return (ANALYSIS_TECHNIQUE_LABELS && ANALYSIS_TECHNIQUE_LABELS[key]) || `${key}`; }
// 候选技法:挂载里已选的;一个没选 → 该源类型的全部图表技法(规划者从中挑 ≤4)
export function candidateTechniques(source, selectedKeys){
	const sel = Array.isArray(selectedKeys) ? selectedKeys.filter(Boolean) : [];
	if(sel.length){ return sel; }
	const isCase = !!(source && (source.kind === 'case' || source.type === 'case' || source.sourceType === 'case'));
	return (isCase ? ANALYSIS_CASE_TECHNIQUES : ANALYSIS_CHART_TECHNIQUES).slice();
}

export function useChatOrchestrate(depsRef, { mainline } = {}){
	const [busy, setBusy] = React.useState('');
	const busyRef = React.useRef('');
	const abortRef = React.useRef(null);
	const patchMessage = React.useCallback((id, fn)=>{ const set = depsRef.current.setMessages; if(typeof set === 'function'){ set((prev)=>prev.map((m)=>(m && m.id === id ? fn(m) : m))); } }, [depsRef]);
	const latestOf = React.useCallback((id, fallback)=>(depsRef.current.messages || []).find((m)=>m && m.id === id) || fallback, [depsRef]);
	const patchOrch = React.useCallback((id, fn)=>patchMessage(id, (m)=>({ ...m, orchestration: fn(m.orchestration || {}) })), [patchMessage]);

	const shortJson = React.useCallback(async ({ slot, profile, model, system, user, schemaName, schema, signal })=>{
		const d = depsRef.current;
		const route = resolveRoute(slot, { routes: readModelRoutes(), providerProfiles: d.providerProfiles, profile, model });
		// [D1] 规划/综合槽的思考档/推理档/温度/输出上限经单源施加(槽空=今日字节)
		let opts = providerOptionsForSlot(slot, route.profile, route.model, { applyThinkingLevel });
		opts = applyResponseSchema(opts, { name: schemaName, schema });
		opts.requestTimeoutMs = 90000;
		// [Q1] 规划/综合的短调用带 signal:用户点停止 → 这两次非流式请求同样中止
		const rsp = await requestStructuredWithFallback(requestAIAnalysisChat, { providerType: route.profile.providerType, apiKey: route.profile.apiKey, baseUrl: route.profile.baseUrl, model: route.model, providerOptions: opts, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }, { signal: signal || (abortRef.current ? abortRef.current.signal : undefined) });
		return { text: rsp && rsp.Result && rsp.Result.content ? `${rsp.Result.content}` : '', model: route.model };
	}, [depsRef]);

	// 一个只读子 Turn:只挂该技法层;≤3 轮;0 写入;只读注册表视图;流式增量写进 subTurns[index].text
	const runSubTurn = React.useCallback(async ({ assistantId, index, technique, prompt, profile, model, ac })=>{
		const d = depsRef.current;
		const sub = resolveRoute('subagent', { routes: readModelRoutes(), providerProfiles: d.providerProfiles, profile, model });
		const t0 = Date.now();
		const patchSub = (patch)=>patchOrch(assistantId, (o)=>({ ...o, subTurns: (o.subTurns || []).map((s, i)=>(i === index ? { ...s, ...patch } : s)) }));
		const sys = await buildHeadlessSystemPrompt({ source: d.activeSource, techniqueKeys: [technique], systemPrompt: d.sessionSystemPrompt || '', profile: sub.profile, model: sub.model });
		let text = ''; let usage = null; let streamError = null; let error = null;
		const flusher = createStreamFlusher(()=>patchSub({ text, status: 'running' }));
		const agent = createAgentTurn({
			profile: sub.profile, model: sub.model, signal: ac.signal, lastUserMessage: prompt, origin: 'orchestrate',
			limits: { MAX_ROUNDS: ORCH_LIMITS.SUB_MAX_ROUNDS, MAX_ADDITIVE_PER_TURN: ORCH_LIMITS.SUB_MAX_ADDITIVE },
			registry: defaultReadOnlyRegistry(),   // 只读视图:manifest 只露 read 级;取/跑 additive 一律拒
			onTrace: (t)=>patchSub({ trace: t }),
			requestApproval: ()=>Promise.resolve(false),
		});
		// [D1] 子任务槽参数经单源施加(槽空=今日字节)
		const opts = providerOptionsForSlot('subagent', sub.profile, sub.model, { applyThinkingLevel });
		const base = [{ role: 'system', content: `${sys.systemPrompt || ''}` }, { role: 'user', content: prompt }];
		try{
			do{
				agent.beginRound();
				if(agent.enabled){ text = ''; streamError = null; }
				try{
					// eslint-disable-next-line no-await-in-loop
					await requestAIAnalysisChatStream({ providerType: sub.profile.providerType, apiKey: sub.profile.apiKey, baseUrl: sub.profile.baseUrl, model: sub.model, providerOptions: opts, messages: agent.messagesForRound(base), tools: agent.toolDefs(), toolChoice: agent.toolChoice() }, {
						signal: ac.signal,
						onEvent: (ev)=>{
							if(!ev){ return; }
							agent.onEvent(ev);
							if(ev.type === 'delta'){ const dlt = ev.json && ev.json.delta ? `${ev.json.delta}` : ''; if(dlt && !ac.signal.aborted){ text += dlt; flusher.schedule(); } }
							else if(ev.type === 'usage'){ if(ev.json && typeof ev.json === 'object'){ usage = ev.json; } }
							else if(ev.type === 'error'){ streamError = (ev.json && ev.json.message) ? `${ev.json.message}` : (ev.data || '上游错误'); }
						},
					});
				}catch(sx){ if(!agent.absorbStreamError(sx)){ throw sx; } }
			// eslint-disable-next-line no-await-in-loop
			}while(await agent.settleRound());
		}catch(e){
			error = e && e.name === 'AbortError' ? null : (streamError || (e && e.message ? `${e.message}` : '生成失败'));
			if(error && typeof agent.failRound === 'function'){ agent.failRound(error); }
		}
		flusher.flush();
		const finalText = text.trim();
		const status = ac.signal.aborted ? (finalText ? 'done' : 'aborted') : ((!finalText && (error || streamError)) ? 'error' : 'done');
		const out = { text: finalText, trace: agent.trace() || null, usage: usage ? (agent.mergeUsage ? agent.mergeUsage(usage) : usage) : null, error: status === 'error' ? (error || streamError) : null, status, elapsedMs: Date.now() - t0, model: sub.model, promptMeta: sys.meta || null };
		patchSub({ ...out });
		return out;
	}, [depsRef, patchOrch]);

	const run = React.useCallback(async (question)=>{
		const d = depsRef.current;
		const q = `${question || ''}`.trim();
		if(!q){ message.warning('写上要拆解的问题,例:/编排 综合八字和紫微看我适合什么时候创业'); return true; }
		if(!isOrchestrateEnabled()){ message.warning(ORCH_SETUP_HINT); return true; }
		if(busyRef.current || d.sending){ message.warning('正在生成,稍后再试'); return true; }
		if(!d.activeSource || !d.activeSource.record){ message.warning('先挂载一张命盘再编排'); return true; }
		const { profileId, model } = parseModelSelection(d.modelSelection);
		const profile = (d.providerProfiles || []).find((p)=>p && p.id === profileId) || d.activeProviderProfile;
		if(!profile || !model){ message.warning('请先选择可用模型'); return true; }
		if(typeof d.ensureConversationRecord !== 'function'){ message.warning('多技法编排暂不可用'); return true; }
		const techniques = candidateTechniques(d.activeSource, d.selectedTechniqueKeys).map((k)=>({ key: k, label: labelOfTechnique(k) }));
		if(!techniques.length){ message.warning('没有可用技法'); return true; }
		busyRef.current = 'run'; setBusy('run');
		const ac = new AbortController(); abortRef.current = ac;
		let assistant = null;
		try{
			const conversation = await d.ensureConversationRecord(q, profile, model);
			const userMessage = await saveConversationMessage({ conversationId: conversation.id, role: 'user', content: q, streamStatus: 'done', checkpoint: buildCheckpoint(d) });
			assistant = await saveConversationMessage({ conversationId: conversation.id, role: 'assistant', content: '', streamStatus: 'streaming', orchestration: { status: 'planning', question: q, candidates: techniques.map((t)=>t.key), plan: null, subTurns: [], synthesis: null, startedAt: now() } });
			if(typeof d.setMessages === 'function'){ d.setMessages((prev)=>prev.concat(userMessage, assistant)); }
			if(typeof d.setPrompt === 'function'){ d.setPrompt(''); }
			const models = { planner: null, subagent: null, final: null };
			const io = {
				plan: async ({ system, user })=>{ const r = await shortJson({ slot: 'planner', profile, model, system, user, schemaName: 'orchestration_plan', schema: PLAN_SCHEMA, signal: ac.signal }); models.planner = r.model; return r.text; },
				runSubtask: async (st)=>runSubTurn({ assistantId: assistant.id, index: st.index, technique: st.technique, prompt: st.prompt, profile, model, ac }),
				synthesize: async ({ system, user })=>{ const r = await shortJson({ slot: 'final', profile, model, system, user, schemaName: 'orchestration_synthesis', schema: SYNTH_SCHEMA, signal: ac.signal }); models.final = r.model; return r.text; },
			};
			const result = await runOrchestration({ question: q, techniques, io, signal: ac.signal, onProgress: (ev)=>{
				if(ev.stage === 'planned'){ patchOrch(assistant.id, (o)=>({ ...o, status: 'running', plan: ev.plan, subTurns: ev.plan.subtasks.map((s, i)=>({ index: i, technique: s.technique, label: labelOfTechnique(s.technique), question: s.question, why: s.why, text: '', status: 'queued' })) })); }
				else if(ev.stage === 'synthesized'){ patchOrch(assistant.id, (o)=>({ ...o, status: 'synthesizing', synthesis: ev.synthesis })); }
			} });
			const latest = latestOf(assistant.id, assistant);
			const okUsage = result.subTurns.reduce((acc, s)=>{ if(s.usage){ acc.input_tokens += Number(s.usage.input_tokens) || 0; acc.output_tokens += Number(s.usage.output_tokens) || 0; acc.n += 1; } return acc; }, { input_tokens: 0, output_tokens: 0, n: 0 });
			const final = { ...latest, content: result.content, streamStatus: result.status === 'done' ? 'done' : (result.status === 'aborted' ? 'aborted' : 'error'),
				errorInfo: result.status === 'error' ? { message: result.error || '编排失败' } : null,
				orchestration: { ...(latest.orchestration || {}), status: result.status, plan: result.plan, subTurns: result.subTurns.map((s)=>({ ...s, prompt: undefined })), synthesis: result.synthesis, requests: result.requests, models: { ...models, subagent: (result.subTurns.find((s)=>s.model) || {}).model || null }, finishedAt: now() },
				usage: okUsage.n ? { input_tokens: okUsage.input_tokens, output_tokens: okUsage.output_tokens, total_tokens: okUsage.input_tokens + okUsage.output_tokens, model, providerType: profile.providerType, subTurns: okUsage.n } : undefined,
				updatedAt: now() };
			patchMessage(assistant.id, ()=>final);
			try{ await saveConversationMessage(final); }catch(e){ /* 落库失败不阻断显示 */ }
			if(result.status === 'error'){ message.error(`多技法编排失败:${result.error || '未知错误'}`); }
		}catch(e){
			const err = e && e.message ? `${e.message}` : `${e}`;
			if(assistant){ const failed = { ...latestOf(assistant.id, assistant), streamStatus: 'error', errorInfo: { message: err }, orchestration: { ...((latestOf(assistant.id, assistant) || {}).orchestration || {}), status: 'error' }, updatedAt: now() }; patchMessage(assistant.id, ()=>failed); try{ await saveConversationMessage(failed); }catch(e2){ /* noop */ } }
			message.error(`多技法编排失败:${err}`);
		}finally{ abortRef.current = null; busyRef.current = ''; setBusy(''); }
		return true;
	}, [depsRef, shortJson, runSubTurn, patchOrch, patchMessage, latestOf]);

	const stop = React.useCallback(()=>{ const ac = abortRef.current; if(ac){ ac.abort(); } }, []);
	return { run, stop, busy };
}
