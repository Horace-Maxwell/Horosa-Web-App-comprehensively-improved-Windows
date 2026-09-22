// AI 对话交互增强·唯一插座钩子。AIAnalysisMain 只把状态/setter/函数以 deps 传进来并渲染几个插座组件,
// 斜杠命令/@引用/状态栏/压缩·旁问·回退/口径·记忆·命主工作区 全部在本目录内实装。
// 契约:每个返回项在对应功能未开启/未实装时都是「空路径」——mainline 原样返回、promptLayerExtras 返回 {}、
// filterTechniqueSections 原样返回、buildCheckpoint 返回 undefined——页面行为与缺席本钩子时字节等价。
import React from 'react';
import { readContextPolicy, subscribeContextPolicy, contextPolicyPresetName } from '../../../utils/aiChatHistory';
import { modelOfSelection } from '../../../utils/aiChat/policyPanel';
import ChatContextPolicyPanel from './ChatContextPolicyPanel';
import ChatModelRoutesPanel from './ChatModelRoutesPanel';
import ChatStatusBar from './ChatStatusBar';
import { computeSessionStats, estimateContextPct } from '../../../utils/aiChat/status';
import { contextWindowForModel } from '../../../utils/aiAnalysisProviders';
import { loadUiPrefs } from '../../../utils/aiAnalysisStore';
import { isAgentEnabled, getAgentApprovalMode, subscribeAgentPrefs, isGoalEnabled, isOrchestrateEnabled } from '../../../utils/aiAgent/prefs';
import { listSessionAllowed, setSessionAllowScope } from '../../../utils/aiAgent/sessionAllow';
import { pushSteer, takeSteer, peekSteer, subscribeSteer } from '../../../utils/aiAgent/steer';
// [Q-048④] 与 AIAnalysisMain 落库的两句占位逐字同源(改一处必改另一处)
export const ASSISTANT_PLACEHOLDERS = ['已停止生成。', '模型未返回可用内容'];
export function isPlaceholderAssistantContent(content){ const t = `${content == null ? '' : content}`.trim(); return !!t && ASSISTANT_PLACEHOLDERS.indexOf(t) >= 0; }
import { buildPlanSystem, buildPlanUser, parseActionPlan, renderPlanText, approvedPlanDirective, loadPlanManifest } from '../../../utils/aiAgent/planMode';
import { getToolPolicy } from '../../../utils/aiAgent/prefs';
import { message } from 'antd';
import { parseSlashInput, listCommandItems, findCommand, requirementState, gateState, resolveZeriSubTab } from '../../../utils/aiChat/commands';
import { BUILTIN_SKILLS, skillsOf, parseSkillArgs, renderSkillPrompt, buildSkillDirective, normalizeSkillPack } from '../../../utils/aiChat/skills';
import ComposerAssist from './ComposerAssist';
import SkillPackPanel from './SkillPackPanel';
import { listAnalysisSources, findAnalysisSourceById } from '../../../utils/aiAnalysisSources';
import { registerWorkspaceUi } from '../../../utils/aiTools/workspaceBridge';
import { buildRelativeSnapshotForRecords } from '../../../utils/aiAnalysisContext';
import { createGoalTask } from '../../../utils/aiAgent/goalRunner';
import { buildMentionCandidates, filterMentionCandidatesDetailed, parseMentions, resolveMentions, techniqueHeadMatch, MENTION_TOKEN_RE } from '../../../utils/aiChat/mentions';
import { filterContentSections } from '../../../utils/aiChat/sectionFilter';
import { listAnalysisTechniqueOptions, listAllAnalysisTechniqueOptions, analysisTechniqueLabelMap } from '../../../utils/aiAnalysisContext';
import TECHNIQUE_PINYIN from '../../../data/techniquePinyin.json';
import { groupMountTechniqueOptions } from '../mountTechniqueGroups';
import { getAIExportEffectiveSectionsForTechnique, loadAIExportSettings } from '../../../utils/aiExport';
import { applyCompact, compactLayer, buildCompactInput, compactRecord, canCompact, buildCompactSystem, shouldSuggestCompact } from '../../../utils/aiChat/compact';
import { readCompactAutoTokens, UI_PREFS_CHANGED_EVENT } from '../../../utils/aiChat/compactPrefs';
import { readResumePrefs, setResumeLast, rememberLastConversation, recentConversations, pickResumeConversation, RESUME_RECENT_MAX } from '../../../utils/aiChat/resume';
import { buildDoctorReport } from '../../../utils/aiChat/doctor';
import { isSchedulerEnabled, isAutomationEnabled, isExternalToolsEnabled, isWebSearchEnabled, getToolPolicy as getToolPolicyPrefs } from '../../../utils/aiAgent/prefs';
import { getToolCapability } from '../../../utils/aiAgent/caps';
import { desktopMcpServerStatus, isDesktopBridgeAvailable } from '../../../utils/aiAnalysisDesktop';
import { listBackgroundFailures } from '../../../utils/aiAgent/bgSink';
import { getIdbStatsForDebug } from '../../../utils/aiAnalysisStore';
import { SCHEDULER_LAST_TICK_KEY } from '../../../utils/aiAgent/tasks/scheduler';
import { ServerRoot } from '../../../utils/constants';
import { readModelRoutes, hasAnyRoute, readRouteOptions, hasAnyRouteOption, listRouteProfiles, activeRouteProfile, applyRouteProfile, clearActiveRouteProfile } from '../../../utils/aiModelRouting';
import { buildCheckpoint as buildCheckpointPure, planRewind, applyCheckpoint } from '../../../utils/aiChat/checkpoint';
import { requestShortCompletion } from '../../../utils/aiChat/shortCall';
import { parseModelSelection } from '../../../utils/aiAnalysisProviders';
import { undoAction } from '../../../utils/aiTools/ledger';
import { AI_ANALYSIS_STORES, deleteWhere } from '../../../utils/aiAnalysisStore';
import SideQuestionPanel from './SideQuestionPanel';
import RewindConfirmModal from './RewindConfirmModal';
import { readPersona, subscribePersona, personaLayer, buildInitDraftInput, INIT_SYSTEM, PERSONA_TEXT_MAX } from '../../../utils/aiChat/persona';
import { readPersonaLayers, subscribePersonaLayers, PERSONA_SESSION_TEXT_MAX } from '../../../utils/aiChat/personaLayers';
import { listMemories, subscribeMemory, memoryLayer, extractCandidatesHeuristic, addCandidates, candidatesFromExtraction, MEMORY_EXTRACT_SYSTEM } from '../../../utils/aiChat/memory';
import { parseShortCallJson } from '../../../utils/aiChat/shortCall';
import { listStoreRecords, listConversationMessages } from '../../../utils/aiAnalysisStore';
import PersonaMemoryPanel from './PersonaMemoryPanel';
import SubjectWorkspaceDrawer from './SubjectWorkspaceDrawer';
import { Modal } from 'antd';
import { useChatBestOf } from './useChatBestOf';
import { useChatReview } from './useChatReview';
import ReviewNotes from './ReviewNotes';
import { useChatOrchestrate } from './useChatOrchestrate';
import OrchestrationPanel from './OrchestrationPanel';
import BestOfCards from './BestOfCards';
import BestOfPanel from './BestOfPanel';

export const CHAT_ASSIST_VERSION = 1;

// [2026-09-11] @ 技法池:全技法并集(命盘类 ∪ 事盘类;起课时间源再并其可起集)+ 当前案例可挂集(建池标灰 / 解析提示 用同一把尺)
function mentionTechniquePools(activeSource){
	let all = [];
	let allowed = [];
	try{ all = listAllAnalysisTechniqueOptions() || []; }catch(e){ all = []; }
	try{ allowed = activeSource ? (listAnalysisTechniqueOptions(activeSource) || []) : []; }catch(e){ allowed = []; }
	const seen = new Set(all.map((o)=>o.value));
	allowed.forEach((o)=>{ if(o && o.value && !seen.has(o.value)){ seen.add(o.value); all = all.concat(o); } });
	return { all, allowedKeys: allowed.map((o)=>o.value) };
}
// 技法 → 术数域标题(菜单分组用):只依赖静态域表,按候选池键串缓存一次——此前每次按键都重跑 groupMountTechniqueOptions
// (其内部 listAIExportTechniqueSettingGroups 会对 95 个技法逐个算快照选项、遍历整个 localStorage)
let groupTitleCache = { key: '', map: new Map() };
function groupTitleByKeyOf(all){
	const key = (all || []).map((o)=>(o && o.value) || '').join('|');
	if(groupTitleCache.key === key && groupTitleCache.map.size){ return groupTitleCache.map; }
	const map = new Map();
	try{ groupMountTechniqueOptions(all).forEach((g, gi)=>(g.items || []).forEach((o)=>{ if(o && o.value){ map.set(o.value, { title: g.title, order: gi }); } })); }catch(e){ /* 分组失败退化为单组 */ }
	groupTitleCache = { key, map };
	return map;
}

// [Q-033/Q-034] 生成中仍可执行的斜杠命令:纯导航 / 开面板 / 只读诊断(不动挂载、不切会话、不另起流)。
// 其余命令在生成中一律拦下并保留输入(见 runCommand 的统一闸)。
const COMMANDS_ALLOWED_WHILE_SENDING = ['择日', '报告', '命主', '任务', 'status', 'doctor', 'help'];

export function useChatAssist(deps){
	const depsRef = React.useRef(deps || {});
	depsRef.current = deps || {};
	// [批五] 工作区 ui 面登记(AI 分析页在前台时才有):工具 get_current_context 读「当前选中源」、自动化规则「设为当前源」、
	// 外部客户端批尾选中、撤销后刷源——全部经这份登记;此前生产从未登记过 ui(四处断链)。卸载即注销。
	// 冻结期(切到别的技法页,页面停止 re-render)deps 会陈旧:助手刚选的源记在 ref 里,渲染追上后清掉。
	const lastSelectedRef = React.useRef('');
	if(lastSelectedRef.current && depsRef.current.selectedSourceId === lastSelectedRef.current){ lastSelectedRef.current = ''; }
	React.useEffect(()=>registerWorkspaceUi({
		getSelectedSource: ()=>{
			const d = depsRef.current;
			const id = lastSelectedRef.current || d.selectedSourceId || (d.activeSource && d.activeSource.id) || '';
			if(!id){ return null; }
			let src = null;
			try{ src = findAnalysisSourceById(id); }catch(e){ src = null; }
			if(!src && d.activeSource && d.activeSource.id === id){ src = d.activeSource; }
			return src ? { id: src.id, sourceType: src.sourceType, title: src.title, module: src.module } : { id };
		},
		selectSource: (cid)=>{ lastSelectedRef.current = `${cid || ''}`; const f = depsRef.current.setSelectedSourceId; if(typeof f === 'function'){ f(cid); } },
		refreshSources: ()=>{ const f = depsRef.current.setSources; if(typeof f === 'function'){ f(listAnalysisSources()); } },
		setInnerTab: (tab)=>{ const f = depsRef.current.setInnerTab; if(typeof f === 'function'){ f(tab); } },
	}), []);

	// 上下文策略(进阶页可改;状态栏展示预设名):订阅写入事件,页面无需自己 useState
	const [policy, setPolicy] = React.useState(()=>readContextPolicy());
	React.useEffect(()=>subscribeContextPolicy((p)=>setPolicy(p)), []);
	const presetName = React.useMemo(()=>contextPolicyPresetName(policy), [policy]);

	// [A5] 压缩:主线视图=压缩点之后的消息(无压缩=同引用);摘要层进稳定层(priority 88);/compact 一次短调用;取消压缩=清字段
	const mainline = React.useCallback((list)=>{
		const conv = depsRef.current.activeConversation;
		const out = applyCompact(list, conv && conv.compact ? conv.compact : null);
		// [C6] 被「按审阅重写」替代的稿不进历史(有替代稿才过滤,否则同引用零变化)
		// [Q-048④ 裁决 2026-09-18] 占位文字(中止「已停止生成。」/ 空回复「模型未返回可用内容」)不是模型产出,不进后续历史(无占位时同引用零变化)
		const drop = (m)=>!!(m && (m.supersededBy || (m.role === 'assistant' && isPlaceholderAssistantContent(m.content))));
		return out.some(drop) ? out.filter((m)=>!drop(m)) : out;
	}, []);
	// [A6] 个人口径 / 记忆:键订阅 + 记忆缓存(写库事件刷新);缺省全关=不产层
	const [persona, setPersona] = React.useState(()=>readPersona());
	React.useEffect(()=>subscribePersona((p)=>setPersona(p)), []);
	const personaRef = React.useRef(persona); personaRef.current = persona;
	// [批二⑨] 分层口径:命主/技法两表(键)+ 会话层(conv.persona);全部受 persona.enabled 总开关约束
	const personaLayersRef = React.useRef(readPersonaLayers());
	const [personaLayersTick, setPersonaLayersTick] = React.useState(0);
	React.useEffect(()=>subscribePersonaLayers((l)=>{ personaLayersRef.current = l; setPersonaLayersTick((n)=>n + 1); }), []);
	// [Q-294/M-109·AR-19] 口径「注入中」判据 = 与 promptLayerExtras 同一合成结果(启用 且 全局/命主/技法/会话 任一层非空),供进阶页胶囊与口径卡;
	//   此前只看全局文本 → 全局空、分层有字时照样注入却显示「未注入」。personaLayersTick 只为分层改动触发重算。
	const personaInjecting = React.useMemo(()=>{
		const d = depsRef.current; const src = d.activeSource; const conv = d.activeConversation;
		return !!personaLayer(persona, { layers: personaLayersRef.current, subjectCid: src ? src.id : '', subjectTitle: src ? src.title : '', techniqueKeys: d.selectedTechniqueKeys, sessionText: conv ? conv.persona : '' });
	}, [persona, personaLayersTick, depsRef.current.activeSource, depsRef.current.activeConversation, depsRef.current.selectedTechniqueKeys]);
	const saveSessionPersona = React.useCallback(async (text)=>{
		const d = depsRef.current; const conv = d.activeConversation;
		if(!conv){ message.warning('先打开一个对话'); return false; }
		const t = `${text || ''}`.trim().slice(0, PERSONA_SESSION_TEXT_MAX);
		if(typeof d.updateConversationMeta === 'function'){ await d.updateConversationMeta(conv, { persona: t || undefined }); }
		message.success(t ? '本会话口径已保存(只对这个对话生效)' : '本会话口径已清空');
		return true;
	}, []);
	const memoriesRef = React.useRef([]);
	React.useEffect(()=>{ const load = ()=>listMemories().then((l)=>{ memoriesRef.current = l; }).catch(()=>{}); load(); return subscribeMemory(load); }, []);
	// 稳定层附加项:口径 102 / 记忆 101 / 压缩摘要 88(裁剪按 priority 降序,口径居首);无=空数组(buildContextLayers 缺省零变化)
	const promptLayerExtras = React.useCallback(()=>{
		const out = [];
		const p = personaRef.current;
		const srcP = depsRef.current.activeSource; const convP = depsRef.current.activeConversation;
		const pl = personaLayer(p, { layers: personaLayersRef.current, subjectCid: srcP ? srcP.id : '', subjectTitle: srcP ? srcP.title : '', techniqueKeys: depsRef.current.selectedTechniqueKeys, techniqueLabels: analysisTechniqueLabelMap(depsRef.current.selectedTechniqueKeys), sessionText: convP ? convP.persona : '' });
		if(pl){ out.push(pl); }
		if(p.memoryInject){ const src = depsRef.current.activeSource; const ml = memoryLayer(memoriesRef.current, { subjectCid: src ? src.id : '' }); if(ml){ out.push(ml); } }
		const conv = depsRef.current.activeConversation;
		const cl = conv && conv.compact ? compactLayer(conv.compact) : null;
		if(cl){ out.push(cl); }
		return out;
	}, []);
	// 自动沉淀候选(缺省关;零 LLM):新用户消息到达即跑启发式
	const lastUserSeenRef = React.useRef('');
	const lastUser = (()=>{ const list = depsRef.current.messages || []; for(let i = list.length - 1; i >= 0; i--){ const m = list[i]; if(m && m.role === 'user'){ return m; } } return null; })();
	React.useEffect(()=>{
		if(!lastUser || !lastUser.id || lastUserSeenRef.current === lastUser.id){ return; }
		lastUserSeenRef.current = lastUser.id;
		if(!personaRef.current.memoryCapture){ return; }
		const cands = extractCandidatesHeuristic(lastUser.content);
		if(cands.length){ addCandidates(cands, 'heuristic').catch(()=>{}); }
	}, [lastUser && lastUser.id]);
	// /init 口径草稿(一次短调用)· 从本会话提炼记忆(一次短调用)· 命主工作区抽屉
	const [initDraft, setInitDraft] = React.useState({ busy: false, text: '', conversations: 0 });
	const [extracting, setExtracting] = React.useState(false);
	const [subjectOpen, setSubjectOpen] = React.useState(false);
	const [compactViewOpen, setCompactViewOpen] = React.useState(false);   // [2026-09-11] 状态栏「已压缩 N 条 · 查看」→ 摘要弹窗
	const shortProfile = React.useCallback(()=>{
		const d = depsRef.current;
		const { profileId, model } = parseModelSelection(d.modelSelection);
		const profile = (d.providerProfiles || []).find((x)=>x && x.id === profileId) || d.activeProviderProfile;
		return profile && model ? { profile, model } : null;
	}, []);
	const runInit = React.useCallback(async ()=>{
		const pm = shortProfile();
		if(!pm){ message.warning('请先选择可用模型'); return true; }
		setInitDraft((x)=>({ ...x, busy: true }));
		try{
			const convs = (await listStoreRecords(AI_ANALYSIS_STORES.conversations)) || [];
			const recent = convs.slice().sort((a, b)=>`${b.updatedAt || ''}`.localeCompare(`${a.updatedAt || ''}`)).slice(0, 30);
			const byId = {};
			for(let i = 0; i < recent.length; i++){ /* eslint-disable-next-line no-await-in-loop */ byId[recent[i].id] = await listConversationMessages(recent[i].id); }
			const input = buildInitDraftInput({ conversations: recent, messagesByConversation: byId });
			if(!input.excerpts){ message.info('最近没有可参考的对话,先聊几轮再生成'); return true; }
			const r = await requestShortCompletion({ profile: pm.profile, model: pm.model, kind: 'init', system: INIT_SYSTEM, user: input.text, timeoutMs: 60000 });
			if(!r.ok){ message.error(`生成失败:${r.error || '无返回'}`); return true; }
			setInitDraft({ busy: false, text: `${r.content}`.slice(0, PERSONA_TEXT_MAX), conversations: input.conversations, onDismiss: ()=>setInitDraft({ busy: false, text: '', conversations: 0 }) });
			// [Q-062/AW-31] 「个人口径」面板渲染在**进阶**页,此前却跳到只有接口配置的「设置」页 —— 提示文案说进阶、动作跳设置
			if(typeof depsRef.current.setInnerTab === 'function'){ depsRef.current.setInnerTab('advanced'); }
			message.success('口径草稿已生成,在进阶页「个人口径」里查看并采用');
		}finally{ setInitDraft((x)=>({ ...x, busy: false })); }
		return true;
	}, [shortProfile]);
	const runExtract = React.useCallback(async ()=>{
		const d = depsRef.current; const pm = shortProfile();
		if(!pm){ message.warning('请先选择可用模型'); return; }
		const live = mainline(d.messages || []).filter((m)=>m && (m.role === 'user' || m.role === 'assistant') && m.content);
		if(live.length < 2){ message.info('本会话还没有可提炼的内容'); return; }
		setExtracting(true);
		try{
			const text = live.slice(-40).map((m)=>`${m.role === 'user' ? '用户' : '助手'}:${`${m.content}`.replace(/\s+/g, ' ').slice(0, 600)}`).join('\n').slice(0, 16000);
			const r = await requestShortCompletion({ profile: pm.profile, model: pm.model, kind: 'memory', system: MEMORY_EXTRACT_SYSTEM, user: text, timeoutMs: 60000 });
			if(!r.ok){ message.error(`提炼失败:${r.error || '无返回'}`); return; }
			const src = d.activeSource;
			const cands = candidatesFromExtraction(parseShortCallJson(r.content), { subjectCid: src ? src.id : '', subjectTitle: src ? src.title : '' });
			const added = await addCandidates(cands, 'extract');
			message.success(added.length ? `提炼出 ${added.length} 条候选,请在「记忆」里确认` : '没有提炼出新的事实');
		}finally{ setExtracting(false); }
	}, [shortProfile]);
	const [compacting, setCompacting] = React.useState(false);
	const [uiPrefsTick, setUiPrefsTick] = React.useState(0);
	React.useEffect(()=>{ const on = ()=>setUiPrefsTick((t)=>t + 1); window.addEventListener(UI_PREFS_CHANGED_EVENT, on); return ()=>window.removeEventListener(UI_PREFS_CHANGED_EVENT, on); }, []);
	const suggestDoneRef = React.useRef({});   // convId → true:本会话已提醒过压缩
	const runCompact = React.useCallback(async (argsText)=>{
		const instruction = typeof argsText === 'string' ? argsText.trim() : '';   // [批二⑧] /compact <指令>;按钮直挂时收到事件对象 → 视为无指令
		const d = depsRef.current;
		const conv = d.activeConversation;
		if(!conv){ message.warning('先打开一个对话'); return false; }
		const live = applyCompact(d.messages || [], conv.compact || null);
		if(!canCompact(d.messages || [], conv.compact || null)){ message.info('压缩点之后的消息太少(不足 4 条),不必压缩'); return true; }
		const { profileId, model } = parseModelSelection(d.modelSelection);
		const profile = (d.providerProfiles || []).find((p)=>p && p.id === profileId) || d.activeProviderProfile;
		if(!profile || !model){ message.warning('请先选择可用模型'); return true; }
		const input = buildCompactInput(live, { prevSummary: conv.compact ? conv.compact.summary : '' });
		setCompacting(true);
		try{
			const r = await requestShortCompletion({ profile, model, kind: 'compact', system: buildCompactSystem(instruction), user: input.text, timeoutMs: 60000 });
			if(!r.ok){ message.error(`压缩失败:${r.error || '无返回'}`); return true; }
			const rec = compactRecord({ summary: r.content, uptoCreatedAt: input.uptoCreatedAt, coveredCount: (conv.compact ? conv.compact.coveredCount : 0) + input.count, model, inputHash: input.inputHash });
			if(!rec){ message.error('压缩结果为空'); return true; }
			if(typeof d.updateConversationMeta === 'function'){ await d.updateConversationMeta(conv, { compact: rec }); }
			message.success(`已压缩 ${rec.coveredCount} 条对话为摘要${instruction ? '(按你的附加要求)' : ''};之后只发摘要 + 新消息(可取消)`);
		}finally{ setCompacting(false); }
		return true;
	}, []);
	const uncompact = React.useCallback(async ()=>{
		const d = depsRef.current; const conv = d.activeConversation;
		if(!conv || !conv.compact){ return; }
		if(typeof d.updateConversationMeta === 'function'){ await d.updateConversationMeta(conv, { compact: null }); }
		message.success('已取消压缩,对话恢复原样');
	}, []);
	// [A5] 旁问 / 回退 浮层状态
	const [side, setSide] = React.useState({ open: false, q: '' });
	const [rewind, setRewind] = React.useState({ open: false, plan: null, item: null, busy: false });
	// [C5] 多模型对比:候选并排流式(不带工具)→ 判官 → 采用/合并;有计价表时发送前确认费用
	const confirmCost = React.useCallback(({ candidates, est })=>new Promise((resolve)=>{
		Modal.confirm({ title: '多模型对比:预估费用', content: est.totalUsd == null ? `${candidates.length} 个候选,费用未知(所选模型无计价表)。继续?` : `${candidates.length} 个候选,预估约 $${est.totalUsd.toFixed(4)}${est.unknown ? `(另 ${est.unknown} 个无计价表)` : ''}。继续?`, okText: '发送', cancelText: '取消', onOk: ()=>resolve(true), onCancel: ()=>resolve(false) });
	}), []);
	const bestOf = useChatBestOf(depsRef, { mainline, confirmCost });
	const bestOfCards = React.useCallback((item)=>{
		if(!item || item.role !== 'assistant' || !Array.isArray(item.candidates) || !item.candidates.length){ return null; }
		return <BestOfCards item={item} busy={bestOf.busy} onAdopt={(id)=>bestOf.adopt(item.id, id)} onJudge={()=>bestOf.rejudge(item.id)} onMerge={()=>bestOf.merge(item.id)} onStop={()=>bestOf.stop()} />;
	}, [bestOf]);
	// [C6] 回答审阅:另一家模型对拍挂载数据 → 批注落消息;按批注重写=新气泡 rewriteOf;确定性问题 deterministicIssues 由页面注入(公版无=[])
	const review = useChatReview(depsRef, { mainline });
	const reviewNotes = React.useCallback((item)=>{
		if(!item || item.role !== 'assistant' || (!item.review && !item.rewriteOf && !item.supersededBy)){ return null; }
		return <ReviewNotes item={item} busy={review.busy} rewriting={review.rewriting} onRewrite={()=>review.rewrite(item)} onRerun={()=>review.run(item)} onStop={review.stop} />;
	}, [review]);
	// [C7] 多技法编排:/编排 问题 → 规划→只读子 Turn(只挂该技法层)→综合+分歧标注;面板按技法折叠子 Turn
	const orchestrate = useChatOrchestrate(depsRef, { mainline });
	const orchestrationPanel = React.useCallback((item)=>{
		if(!item || item.role !== 'assistant' || !item.orchestration){ return null; }
		return <OrchestrationPanel item={item} running={!!orchestrate.busy} onStop={orchestrate.stop} />;
	}, [orchestrate]);
	// [A3] 斜杠命令 + 技能包:命令面板(输入框首字符 /)、发送口拦截(interceptSend)、技能执行(runSkill:会话级技法/口径 → handleSend 渲染后的模板)
	const [statusDetailOpen, setStatusDetailOpen] = React.useState(false);
	const runSkill = React.useCallback(async (bundle, argsText)=>{
		const d = depsRef.current;
		const sk = normalizeSkillPack(bundle);
		if(!sk){ message.warning('技能不存在'); return true; }
		const args = parseSkillArgs(sk.argsSpec, argsText);
		let extra = buildSkillDirective(sk);
		let otherSource = null;
		if(sk.requires === 'two-charts'){
			// [2026-09-11] /合盘 @[命盘:李四] 也可用:参数里的 @ 标记先解析成名字(#尾号一并保留给精确匹配)
			const pm = parseMentions(`${argsText || ''}`);
			const mentioned = pm.mentions.find((m)=>m.type === 'chart' || m.type === 'case');
			const q = `${mentioned ? mentioned.name : (args.other || argsText || '')}`.trim();
			const wantSuffix = mentioned && mentioned.suffix ? mentioned.suffix : '';
			const sources = (d.sources && d.sources.length ? d.sources : listAnalysisSources()) || [];
			let cands = sources.filter((x)=>x && x.sourceType === 'chart' && x.id !== (d.activeSource && d.activeSource.id) && `${x.title || ''}`.indexOf(q) >= 0);
			if(wantSuffix && cands.length > 1){ const bySuffix = cands.filter((x)=>`${x.id}`.endsWith(wantSuffix)); if(bySuffix.length === 1){ cands = bySuffix; } }
			if(!q || !cands.length){ message.warning(q ? `没找到叫「${q}」的命盘` : '写上对方的名字,例:/合盘 李四'); return true; }
			if(cands.length > 1){ message.warning(`有 ${cands.length} 张命盘都含「${q}」,请写更完整的名字`); return true; }
			otherSource = cands[0];
			try{
				const snap = await buildRelativeSnapshotForRecords(d.activeSource.record, otherSource.record);
				const text = typeof snap === 'string' ? snap : `${(snap && (snap.text || snap.snapshotText || snap.snapshot)) || ''}`;
				if(!text.trim()){ message.warning('合盘数据为空'); return true; }
				extra = `${extra ? `${extra}\n\n` : ''}【合盘数据】\n${text.slice(0, 12000)}`;
			}catch(e){ message.warning(`合盘数据生成失败:${e && e.message ? e.message : e}`); return true; }
		}
		// 会话级设置:库内技能套组合(资料/模型/系统提示随组合);技法只改本次对话挂载(不动全局)
		if(bundle.id && `${bundle.id}`.indexOf('builtin:') !== 0 && typeof d.applyBundle === 'function'){ try{ d.applyBundle(bundle); }catch(e){ /* 组合套用失败不阻断 */ } }
		if(sk.techniqueKeys.length && typeof d.setSelectedTechniqueKeys === 'function'){ d.setSelectedTechniqueKeys(sk.techniqueKeys.slice(0)); }
		const promptText = renderSkillPrompt(sk, args, { activeSource: d.activeSource, otherSource });
		if(!promptText){ message.warning('技能提示词为空'); return true; }
		await new Promise((r)=>setTimeout(r, 0));   // 让 setState 落地(handleSend 读最新技法)
		const send = depsRef.current.handleSend;
		if(typeof send === 'function'){ await send(promptText, extra || undefined); }
		return true;
	}, []);
	// [批二⑦] /plan:规划短调用(工具目录摘要 + 目标 → JSON 计划;目录经 planMode.loadPlanManifest 惰性载入)→ PlanCard → 批准后 handleSend(计划正文, 已批准约束)
	const PLAN_CLOSED = { open: false, goal: '', plan: null, dropped: [], busy: false };
	const [planState, setPlanState] = React.useState(PLAN_CLOSED);
	const runPlan = React.useCallback(async (argsText)=>{
		const d = depsRef.current;
		const goal = `${argsText || ''}`.trim();
		if(!goal){ message.warning('写上目标,例:/plan 把这张盘的八字和紫微都看一遍并建档'); return true; }
		if(!isAgentEnabled()){ message.warning('请先在进阶页打开「AI 助手行动能力」总开关(计划只列工具、不执行)'); return true; }
		const pm = shortProfile();
		if(!pm){ message.warning('请先选择可用模型'); return true; }
		setPlanState({ open: false, goal, plan: null, dropped: [], busy: true });
		const hide = message.loading('正在生成行动计划…', 0);
		try{
			const manifest = await loadPlanManifest(getToolPolicy().deny);
			const r = await requestShortCompletion({ profile: pm.profile, model: pm.model, kind: 'plan', system: buildPlanSystem(manifest), user: buildPlanUser(goal, { subjectTitle: d.activeSource ? d.activeSource.title : '', sourceType: d.activeSource ? d.activeSource.sourceType : '', techniqueKeys: d.selectedTechniqueKeys }), timeoutMs: 60000 });
			if(!r.ok){ message.error(`计划生成失败:${r.error || '无返回'}`); setPlanState(PLAN_CLOSED); return true; }
			const parsed = parseActionPlan(r.content, manifest);
			if(!parsed.ok){ message.error(`计划不可读(${parsed.error}${parsed.detail ? `:${parsed.detail}` : ''}),请换个说法再试`); setPlanState(PLAN_CLOSED); return true; }
			setPlanState({ open: true, goal, plan: parsed.plan, dropped: parsed.dropped, busy: false });
		}catch(e){ message.error(`计划生成失败:${e && e.message ? e.message : e}`); setPlanState(PLAN_CLOSED); }
		finally{ hide(); }
		return true;
	}, [shortProfile]);
	const approvePlan = React.useCallback(async ()=>{
		const p = planState;
		if(!p.open || !p.plan){ return; }
		setPlanState(PLAN_CLOSED);
		const send = depsRef.current.handleSend;
		if(typeof send === 'function'){ await send(renderPlanText(p.plan, p.goal), approvedPlanDirective(p.plan)); }
	}, [planState]);
	const editPlan = React.useCallback(()=>{
		const f = depsRef.current.setPrompt;
		if(typeof f === 'function'){ f(`/plan ${planState.goal}`); }
		setPlanState(PLAN_CLOSED);
	}, [planState]);
	// [批二⑪] 会话 resume:开关开着时记住当前对话;启动(对话列表首次到位)且未打开任何对话时继续上次;/resume 浮层
	const [resumeOpen, setResumeOpen] = React.useState(false);
	const resumedRef = React.useRef(false);
	const convIdForResume = depsRef.current.activeConversationId;
	React.useEffect(()=>{ if(convIdForResume){ rememberLastConversation(convIdForResume); } }, [convIdForResume]);
	const convCount = (depsRef.current.conversations || []).length;
	React.useEffect(()=>{
		if(resumedRef.current || !convCount){ return; }
		resumedRef.current = true;
		const pr = readResumePrefs();
		if(!pr.resumeLast || !pr.lastConversationId || depsRef.current.activeConversationId){ return; }
		const c = pickResumeConversation(depsRef.current.conversations, pr.lastConversationId);
		const f = depsRef.current.openConversation;
		if(c && typeof f === 'function'){ Promise.resolve(f(c)).catch(()=>{}); }
	}, [convCount]);
	// [批二⑫] /doctor:采集(全部可失败,失败即「未知」)→ 纯函数定级脱敏 → 浮层
	const [doctorState, setDoctorState] = React.useState({ open: false, report: null });
	const runDoctor = React.useCallback(async ()=>{
		const d = depsRef.current; const pm = shortProfile();
		let mcp = { available: false };
		try{ mcp = (await desktopMcpServerStatus()) || { available: false }; }catch(e){ mcp = { available: false }; }
		let idbStats = {};
		try{ idbStats = getIdbStatsForDebug(); }catch(e){ idbStats = {}; }
		let lastTickAt = '';
		try{ lastTickAt = window.localStorage.getItem(SCHEDULER_LAST_TICK_KEY) || ''; }catch(e){ lastTickAt = ''; }
		const list = d.messages || [];
		const lastAssistant = [...list].reverse().find((m)=>m && m.role === 'assistant');
		const lastError = lastAssistant && lastAssistant.errorInfo ? (lastAssistant.errorInfo.message || lastAssistant.errorInfo.code || '上游错误') : '';
		const report = buildDoctorReport({
			backend: { root: ServerRoot, lastError },
			desktop: { bridge: isDesktopBridgeAvailable() },
			model: pm ? { profileName: pm.profile.name, providerType: pm.profile.providerType, model: pm.model, baseUrl: pm.profile.baseUrl } : null,
			caps: { native: pm ? getToolCapability(pm.profile.id, pm.model) : 'unknown' },
			agent: { sessionAllow: listSessionAllowed(), enabled: isAgentEnabled(), approval: getAgentApprovalMode(), goal: isGoalEnabled(), scheduler: isSchedulerEnabled(), automation: isAutomationEnabled(), external: isExternalToolsEnabled(), webSearch: isWebSearchEnabled(), toolPolicy: getToolPolicyPrefs() },
			mcp, heartbeat: { lastTickAt, schedulerEnabled: isSchedulerEnabled() },
			idb: { stats: idbStats },
			conversations: { count: (d.conversations || []).length, activeId: d.activeConversationId },
			persona: { enabled: personaRef.current.enabled, layers: personaLayersRef.current },
			routes: { hasRoutes: hasAnyRoute(readModelRoutes()), hasRouteOptions: hasAnyRouteOption(readRouteOptions()) },
			contextPolicy: presetName,
			bgFailures: listBackgroundFailures(),
		});
		setDoctorState({ open: true, report });
		return true;
	}, [shortProfile, presetName]);
	const runCommand = React.useCallback(async (text)=>{
		const d = depsRef.current;
		const parsed = parseSlashInput(text);
		if(!parsed){ return false; }
		const userSkills = skillsOf(d.bundles);
		const cmd = findCommand(parsed.name, userSkills);
		// [Q-048② 裁决 2026-09-18·维持现状+补提示] `/etc 目录…` 这类以 / 开头的普通提问会被当命令拦下(设计如此),提示里写明逃逸写法
		if(!cmd){ message.warning(`未知命令 /${parsed.name}（输入 / 看菜单；要发送以 / 开头的普通文字，请写成 //${parsed.name}…）`, 5); return true; }
		const st = requirementState(cmd.requires, { activeSource: d.activeSource, argsText: parsed.argsText });
		if(!st.ok){ message.warning(st.why); return true; }   // 前提不满足只提示,输入原样保留(此前先清空再判,参数白打)
		// 开关门同理:`/编排 问题` `/plan 目标` `/goal 目标` 在开关未开时也只提示,不清输入(各执行器内部的判定保留,这里先拦一道保住已打的字)
		const gs = gateState(cmd.gate, { agent: isAgentEnabled(), goal: isGoalEnabled(), orchestrate: isOrchestrateEnabled() });
		if(!gs.ok){ message.warning(gs.why); return true; }
		// [Q-033/Q-034/M-43/M-44] 生成中统一闸:除「纯导航 / 开面板 / 只读」几条外,命令会改挂载、切会话或另起一条流 ——
		//   此前无闸:`/流年` 之类在流中执行会改挂载并把已打的问题清掉;`/fork` `/resume` 切会话会静默掐断正在写的回复。
		//   拦下时**保留输入**(与前提/开关两闸同款),用户可先停止生成再回车。
		if(d.sending && COMMANDS_ALLOWED_WHILE_SENDING.indexOf(cmd.name) < 0){
			message.warning(`正在生成回复,「/${cmd.name}」要等本轮结束(或先点「停止生成」);你打的字已保留`);
			return true;
		}
		if(typeof d.setPrompt === 'function'){ d.setPrompt(''); }
		if(cmd.name === '择日'){
			// [2026-09-11] 参数=择日子技法(天星/奇门/黄历/…)→ 直达子页签;此前 args 只派发不消费(承诺了做不到)
			const subTab = resolveZeriSubTab(parsed.argsText);
			if(parsed.argsText && !subTab){ message.info(`未识别的择日技法「${parsed.argsText}」,已按当前子页打开(可写:天星 / 奇门 / 黄历 / 八字 / 太乙 / 紫微 / 六壬 / 三式 / 七政 / 印度)`); }
			try{ window.dispatchEvent(new CustomEvent('horosa:navigate', { detail: { key: 'zeri', subTab: subTab || undefined, args: parsed.argsText } })); }catch(e){ /* noop */ }
			return true;
		}
		if(cmd.name === '命主'){ setSubjectOpen(true); return true; }
		if(cmd.name === '任务'){ try{ window.dispatchEvent(new CustomEvent('horosa:task-center', { detail: { open: true } })); }catch(e){ /* noop */ } return true; }
		if(cmd.name === 'status'){ setStatusDetailOpen(true); return true; }
		if(cmd.name === 'plan'){ return runPlan(parsed.argsText); }
		if(cmd.name === 'compact'){ return runCompact(parsed.argsText); }
		if(cmd.name === 'init'){ return runInit(); }
		if(cmd.name === '多模型'){ return bestOf.run(parsed.argsText); }
		if(cmd.name === '编排'){ return orchestrate.run(parsed.argsText); }
		if(cmd.name === '审阅'){
			const list = d.messages || []; const last = [...list].reverse().find((m)=>m && m.role === 'assistant' && m.streamStatus !== 'streaming' && `${m.content || ''}`.trim());
			if(!last){ message.warning('还没有可审阅的回答'); return true; }
			return review.run(last);
		}
		if(cmd.name === 'resume'){ setResumeOpen(true); return true; }
		if(cmd.name === 'profile'){   // [批三②] 具名方案切换(纯本机键操作,零请求)
			const want = `${parsed.argsText || ''}`.trim();
			const names = listRouteProfiles();
			if(!want){ message.info(names.length ? `模型方案:${names.map((n)=>(n === activeRouteProfile() ? `[${n}]` : n)).join(' · ')}(方括号=当前;/profile 名字 切换,/profile 现状 回到现状)` : '还没有模型方案:在进阶页「按任务用模型」里「另存为」'); return true; }
			// [Q-294/AR-11 裁决 2026-09-18·②文案如实] 清方案标记不改活键(路由照旧生效);要真正回到跟随当前模型请用进阶页「全部清空」
			if(want === '现状' || want === 'none'){ clearActiveRouteProfile(); message.success('已退出方案标记（当前路由不变；要回到跟随当前模型请到进阶页点「全部清空」）'); return true; }
			if(!applyRouteProfile(want)){ message.warning(`没有叫「${want}」的方案${names.length ? `;现有:${names.join(' · ')}` : ''}`); return true; }
			message.success(`已切换到方案「${want}」`); return true;
		}
		if(cmd.name === 'doctor'){ return runDoctor(); }
		if(cmd.name === 'side'){ setSide({ open: true, q: parsed.argsText }); return true; }
		if(cmd.name === 'fork'){
			const list = d.messages || []; const last = list[list.length - 1];
			if(!last || typeof d.handleBranchFromMessage !== 'function'){ message.warning('还没有可分叉的消息'); return true; }
			await d.handleBranchFromMessage(last); return true;
		}
		if(cmd.name === 'goal'){
			if(!parsed.argsText){ message.warning('写上目标,例:/goal 把名单里的三个人都建档并各起一份八字快照'); return true; }
			if(!(isAgentEnabled() && isGoalEnabled())){ message.warning('请先在进阶页打开「AI 助手行动能力」总开关与「目标任务」子开关'); return true; }
			const t = await createGoalTask({ goal: parsed.argsText, sourceCid: d.activeSource ? d.activeSource.id : null, techniques: Array.isArray(d.selectedTechniqueKeys) ? d.selectedTechniqueKeys.slice(0, 6) : [], autoStart: true, origin: 'in-app', techniqueOptionOverrides: d.techniqueOptionOverrides });
			message.success(`目标任务「${t.title}」已开始(右下角任务中心可看进度)`);
			return true;
		}
		const skillRec = cmd.kind === 'skill' ? userSkills.find((b)=>b.id === cmd.bundleId) : BUILTIN_SKILLS.find((b)=>b.id === cmd.skill);
		if(!skillRec){ message.warning('这条命令还没接上'); return true; }
		return runSkill(skillRec, parsed.argsText);
	}, [runSkill, runCompact, runInit, runPlan, runDoctor, bestOf, review, orchestrate]);
	// 发送口拦截:输入是命令 → 执行并吞掉发送(按钮/回车同一入口);非命令 → false(页面照常发送)
	// [A4] @引用:发送前解析标记 → 挂载动作(切源/参考/技法/技法段过滤)→ 下一拍以去标记正文重发(overrideText 路径不再拦截)
	const sectionFilterRef = React.useRef({});
	const applyMentions = React.useCallback(async (text)=>{
		const d = depsRef.current;
		const { mentions, text: cleaned } = parseMentions(text);
		if(!mentions.length){ return false; }
		const sources = d.sources && d.sources.length ? d.sources : listAnalysisSources();
		// 两遍:先只解析案例引用拿到「这句话要切到的源」,技法可用性按**切换后**的源判——此前按切源前的源判,
		// 「@[事盘:X] @[技法:六爻]」被当成命盘案例拒掉六爻、切源后再把旧技法剪光、以 0 技法发送;无源时「@[命盘:张三] @[技法:八字]」同病
		const pre = resolveMentions(mentions.filter((m)=>m.type === 'chart' || m.type === 'case'), { sources });
		const effSource = pre.selectSource || d.activeSource;
		const pools = mentionTechniquePools(effSource);
		const plan = resolveMentions(mentions, { sources, materials: d.materials, bundles: d.bundles, templates: d.templates, techniqueOptions: pools.all, allowedTechniqueKeys: pools.allowedKeys, activeSourceType: effSource ? effSource.sourceType : '' });
		if(plan.unresolved.length){ message.warning(`没找到:${plan.unresolved.join(' ')}`); }
		plan.hints.forEach((h)=>message.info(h));
		if(plan.selectSource && typeof d.setSelectedSourceId === 'function' && (!d.activeSource || d.activeSource.id !== plan.selectSource.id)){ d.setSelectedSourceId(plan.selectSource.id); }
		if(plan.referenceIds.length && typeof d.setReferenceIds === 'function'){ const cur = Array.isArray(d.referenceIds) ? d.referenceIds : []; d.setReferenceIds(Array.from(new Set(cur.concat(plan.referenceIds)))); }
		if(plan.techniqueKeys.length && typeof d.setSelectedTechniqueKeys === 'function'){ const cur = Array.isArray(d.selectedTechniqueKeys) ? d.selectedTechniqueKeys : []; d.setSelectedTechniqueKeys(Array.from(new Set(cur.concat(plan.techniqueKeys)))); }
		if(Object.keys(plan.sectionFilter).length){ sectionFilterRef.current = { ...sectionFilterRef.current, ...plan.sectionFilter }; }
		if(typeof d.setPrompt === 'function'){ d.setPrompt(''); }
		await new Promise((r)=>setTimeout(r, 0));
		const send = depsRef.current.handleSend;
		if(cleaned && typeof send === 'function'){ await send(cleaned); }
		return true;
	}, []);
	// [批二⑤] 插话:流式期间(行动能力开)再发一句 → 排到「正在生成的助手消息」名下,运行时下一轮工具回合附在请求末尾
	const streamingAssistantId = React.useCallback(()=>{
		const list = depsRef.current.messages || [];
		for(let i = list.length - 1; i >= 0; i--){ const m = list[i]; if(m && m.role === 'assistant' && m.streamStatus === 'streaming'){ return m.id; } }
		return null;
	}, []);
	const [steerTick, setSteerTick] = React.useState(0);
	React.useEffect(()=>subscribeSteer(()=>setSteerTick((t)=>t + 1)), []);
	const canSteer = !!(depsRef.current.sending && isAgentEnabled() && streamingAssistantId() && `${depsRef.current.prompt || ''}`.trim());
	const steer = React.useCallback(()=>{
		const d = depsRef.current;
		const id = streamingAssistantId();
		const text = `${d.prompt || ''}`.trim();
		if(!id || !text || !isAgentEnabled()){ return false; }
		if(!pushSteer(id, text)){ message.warning('本轮插话已满(最多 3 条),等这一轮结束再说'); return false; }
		if(typeof d.setPrompt === 'function'){ d.setPrompt(''); }
		message.info('已插话:AI 下一轮工具回合会先读到它');
		return true;
	}, [streamingAssistantId]);
	const takeSteerFor = React.useCallback((assistantId)=>takeSteer(assistantId), []);
	const interceptSend = React.useCallback((text)=>{
		if(parseSlashInput(text)){ runCommand(text).catch((e)=>message.error(`命令执行失败:${e && e.message ? e.message : e}`)); return true; }
		MENTION_TOKEN_RE.lastIndex = 0;
		if(MENTION_TOKEN_RE.test(`${text || ''}`)){ MENTION_TOKEN_RE.lastIndex = 0; applyMentions(text).catch((e)=>message.error(`引用处理失败:${e && e.message ? e.message : e}`)); return true; }
		return false;
	}, [runCommand, applyMentions]);
	// 会话切换即清技法段过滤(会话级)。只在「离开一个已有会话」时清:新对话首条消息发送时会话记录才建立(id '' → 新 id),
	// 这一步不能清——此前无条件清,新对话第一条 `@[技法段:…]` 的过滤在 IndexedDB 一拍之间被抹掉、全文挂载
	const convKey = depsRef.current.activeConversationId;
	const prevConvRef = React.useRef(convKey);
	// [AR-31] 「本会话不再问」的放行集按对话 id 分集合:当前对话即作用域(渲染期同步设,不等 effect——审批判定在发送后的
	// 工具回合里读,必须已经是本对话的集合;新对话 '' → 建档后切到新 id,发送前点过的放行随之归该对话)
	setSessionAllowScope(convKey);
	React.useEffect(()=>{ const prev = prevConvRef.current; prevConvRef.current = convKey; if(prev && prev !== convKey){ sectionFilterRef.current = {}; } }, [convKey]);
	// [2026-09-11] 拼音:技法标签的全拼/首字母来自构建期静态表 src/data/techniquePinyin.json(pinyin-pro 只在 devDependencies,
	// preflight [36] 铁律「不得进运行时 bundle」;表 ≡ 标签重算由 aiChatMentionPinyin.contract 测试看守,改标签须 npm run build:technique-pinyin)
	const pinyinTextOf = React.useCallback((item)=>{
		if(!item || (item.kind !== 'technique' && item.kind !== 'section') || !item.key){ return ''; }
		return `${TECHNIQUE_PINYIN[item.key] || ''}`;   // 段候选也带技法拼音:`@zw/命宫` 的头按拼音命中
	}, []);
	const mentionItems = React.useCallback((query)=>{
		const d = depsRef.current;
		const pools = mentionTechniquePools(d.activeSource);
		const allowed = new Set(pools.allowedKeys);
		const srcType = d.activeSource ? d.activeSource.sourceType : '';
		const whyOf = srcType === 'case' ? '需命盘案例' : (srcType === 'timepoint' ? '需命盘 / 事盘案例' : (srcType ? '需事盘案例' : '先挂载案例'));
		// [2026-09-12] 技法按术数域分组(与「选择技法」下拉同一分组器,分组表按池缓存);`@八字/` `@bz/` `@ziwei/` 形态 → 头命中(标签 / 键 / 拼音前缀)的技法的段进候选(不必先勾选)
		const groupTitleByKey = groupTitleByKeyOf(pools.all);
		const q = `${query || ''}`;
		const slash = q.indexOf('/');
		let sectionTechniqueKeys = [];
		if(slash > 0){
			const head = q.slice(0, slash).trim();
			// 只取全等 / 前缀命中(0/1),子串命中(2)不展开段:`@盘/` 不至于为几十个含「盘」的技法建段候选
			sectionTechniqueKeys = pools.all.filter((o)=>{ if(!o || !o.value){ return false; } const h = techniqueHeadMatch(head, { label: o.label, key: o.value, extra: TECHNIQUE_PINYIN[o.value] }); return h >= 0 && h <= 1; }).map((o)=>o.value);
		}
		// 导出设置一次按键只读一遍(`@星/` 头命中 25 个技法时不再逐技法读 localStorage + JSON.parse)
		let exportSettings = null;
		try{ exportSettings = loadAIExportSettings(); }catch(e){ exportSettings = null; }
		const pool = buildMentionCandidates({ sources: d.sources && d.sources.length ? d.sources : listAnalysisSources(), materials: d.materials, bundles: d.bundles, templates: d.templates, techniqueOptions: pools.all, techniqueAvailable: (k)=>(allowed.has(k) ? true : whyOf), techniqueGroupOf: (k)=>groupTitleByKey.get(k) || '', selectedTechniqueKeys: d.selectedTechniqueKeys, sectionTechniqueKeys, sectionsForTechnique: (k)=>{ try{ return exportSettings ? getAIExportEffectiveSectionsForTechnique(k, exportSettings) : getAIExportEffectiveSectionsForTechnique(k); }catch(e){ return []; } } });
		return filterMentionCandidatesDetailed(pool, query, { extraText: pinyinTextOf });
	}, [pinyinTextOf]);
	const promptText = `${depsRef.current.prompt || ''}`;
	const slashPrefix = promptText[0] === '/' && promptText[1] !== '/' ? promptText.slice(1).split(/\s/)[0] : null;
	// 菜单态:two-charts 只要求已挂命盘(menu:true);开关门(gates)在菜单上就置灰并写明去哪开
	const commandItems = slashPrefix !== null ? listCommandItems({ prefix: slashPrefix, skills: skillsOf(depsRef.current.bundles), ctx: { activeSource: depsRef.current.activeSource, argsText: '', menu: true, gates: { agent: isAgentEnabled(), goal: isGoalEnabled(), orchestrate: isOrchestrateEnabled() } } }) : [];
	const composer = { prompt: depsRef.current.prompt, setPrompt: depsRef.current.setPrompt, items: commandItems, onRun: runCommand, mentionItems, canSteer, onSteer: steer };   // [批二⑤] 插话芯片走 ComposerAssist(Main 发送钮不动)

	// [A4] 技法段过滤:@技法段 选过的技法只保留所选段(过滤空=原样;未选=原样引用返回,零变化)
	const filterTechniqueSections = React.useCallback((contexts)=>{
		const f = sectionFilterRef.current || {};
		if(!Array.isArray(contexts) || !Object.keys(f).length){ return contexts; }
		let changed = false;
		const out = contexts.map((c)=>{
			const key = c && (c.key || c.techniqueKey);
			if(!key || !f[key] || !f[key].length){ return c; }
			const next = filterContentSections(c.content, f[key]);
			if(next === c.content){ return c; }
			changed = true;
			return { ...c, content: next };
		});
		return changed ? out : contexts;
	}, []);
	// [A5] 会话检查点:每条用户消息落库时带当时的挂载/引用/技法/系统提示/覆盖/模型/思考/温度/topP
	const buildCheckpoint = React.useCallback(()=>buildCheckpointPure(depsRef.current), []);
	const openRewind = React.useCallback((item)=>{
		const d = depsRef.current;
		const plan = planRewind(d.messages || [], item && item.id, d.activeConversation ? d.activeConversation.compact : null);
		if(!plan){ message.warning('只能回退到你自己的消息'); return; }
		setRewind({ open: true, plan, item, busy: false });
	}, []);
	const confirmRewind = React.useCallback(async (actionIds)=>{
		const d = depsRef.current; const st = rewind; const plan = st.plan; const conv = d.activeConversation;
		if(!plan || !conv){ setRewind({ open: false, plan: null, item: null, busy: false }); return; }
		setRewind((r)=>({ ...r, busy: true }));
		try{
			// ① 先逐条撤销(新→旧);任一失败即停,不删消息
			for(let i = 0; i < (actionIds || []).length; i++){
				const r = undoAction(actionIds[i]);
				if(!r || !r.ok){ message.error(`第 ${i + 1} 条动作撤销失败(${(r && r.code) || '未知'}),已停止,消息未删除`); setRewind((x)=>({ ...x, busy: false })); return; }
			}
			// ② 删该用户消息及其后所有消息
			const removeSet = new Set(plan.remove);
			await deleteWhere(AI_ANALYSIS_STORES.messages, (m)=>m && m.conversationId === conv.id && removeSet.has(m.id), { index: 'conversationId', value: conv.id });
			// ③ 清压缩 ④ 重开会话刷新消息 ⑤ 恢复设置
			// [Q-032/M-47] 顺序必须是「先重开会话、后恢复设置」:openConversation 会按会话记录重设模型 / 技法 / 系统提示,
			//   此前先恢复再重开 → 检查点的值当场被会话记录盖回,用户看到的是「回退了但设置没回来」。
			if(plan.clearCompact && typeof d.updateConversationMeta === 'function'){ await d.updateConversationMeta(conv, { compact: null }); }
			if(typeof d.openConversation === 'function'){ await d.openConversation(plan.clearCompact ? { ...conv, compact: null } : conv); }
			applyCheckpoint(plan.restore, depsRef.current);
			message.success(`已回退:删除 ${plan.removeCount} 条消息${actionIds && actionIds.length ? `,撤销 ${actionIds.length} 个动作` : ''}`);
			setRewind({ open: false, plan: null, item: null, busy: false });
		}catch(e){ message.error(`回退失败:${e && e.message ? e.message : e}`); setRewind((x)=>({ ...x, busy: false })); }
	}, [rewind]);
	// 进阶页插座(A1a 起;曾在设置页):策略卡;A6 起追加口径/记忆卡。AIAnalysisMain 只渲染 {chatAssist.settingsPanels}
	const model = modelOfSelection(depsRef.current.modelSelection);
	// [Q-287/M-102 ③] 键名对齐发送侧:档案里存的是 Ollama 原生 `num_ctx`(设置面写的就是它),
	//   此前策略卡读的是从不写入的 `numCtx` → 恒 undefined → 卡片按「未知模型保底」报数
	//   (Ollama 实测卡上写 110100 字、实发 5898 字)。兼容旧档的驼峰写法。
	const numCtx = (()=>{
		const po = (depsRef.current.activeProviderProfile && depsRef.current.activeProviderProfile.providerOptions) || {};
		const v = Number(po.num_ctx) || Number(po.numCtx) || 0;
		return v > 0 ? v : undefined;
	})();
	// [C4] 按任务用模型:六槽全空=现状;卡片只读渲染,改动才写键
	const settingsPanels = [<ChatContextPolicyPanel key="context-policy" model={model} numCtx={numCtx} />, <ChatModelRoutesPanel key="model-routes" providerProfiles={depsRef.current.providerProfiles} />, <SkillPackPanel key="skill-packs" bundles={depsRef.current.bundles} materials={depsRef.current.materials} reloadBundles={depsRef.current.reloadBundles} />, <PersonaMemoryPanel key="persona-memory" onInit={runInit} initDraft={initDraft} onExtract={runExtract} extracting={extracting} activeSource={depsRef.current.activeSource} activeConversation={depsRef.current.activeConversation} selectedTechniqueKeys={depsRef.current.selectedTechniqueKeys} onSaveSessionPersona={saveSessionPersona} />, <BestOfPanel key="best-of" providerProfiles={depsRef.current.providerProfiles} />];

	// 状态栏(A2):全部数字与气泡同口径(computeSessionStats/estimateContextPct);审批档订阅 prefs 事件;uiPrefs chatAssist.statusBar=false 可关
	const [agentState, setAgentState] = React.useState(()=>({ enabled: isAgentEnabled(), approval: getAgentApprovalMode() }));
	React.useEffect(()=>subscribeAgentPrefs((d)=>setAgentState({ enabled: !!(d && d.enabled), approval: d && d.approval ? d.approval : getAgentApprovalMode() })), []);
	// 不做 useMemo:页面可能就地补写 assistant.usage 而不换数组引用(状态栏实抓 turns 恒 0);计算量 O(消息数),每次渲染算一遍无妨
	const session = computeSessionStats(depsRef.current.messages);
	const lastUsage = session.lastUsage || null;
	const contextPct = lastUsage ? estimateContextPct({ stableChars: lastUsage.prompt && lastUsage.prompt.stableChars, volatileChars: lastUsage.prompt && lastUsage.prompt.volatileChars, historyTokens: lastUsage.history && lastUsage.history.keptTokens, contextWindow: contextWindowForModel(model) }) : null;
	const clip = depsRef.current.promptClipStats && depsRef.current.promptClipStats.stats ? depsRef.current.promptClipStats.stats : null;
	// [批二⑧] 压缩提醒:保留历史 token ≥ 阈值(策略卡设;缺省空=不提醒)→ 状态栏芯片;每会话只提醒一次(点了/关了就不再出现);只提醒、绝不自动压缩
	const historyTokens = lastUsage && lastUsage.history ? lastUsage.history.keptTokens : null;
	const compactThreshold = uiPrefsTick >= 0 ? readCompactAutoTokens() : null;
	const convIdNow = depsRef.current.activeConversationId;
	const suggestCompactOn = !!(convIdNow && !suggestDoneRef.current[convIdNow] && !compacting && shouldSuggestCompact({ historyTokens, threshold: compactThreshold }) && canCompact(depsRef.current.messages || [], depsRef.current.activeConversation ? depsRef.current.activeConversation.compact : null));
	const suggestCompact = suggestCompactOn ? { tokens: historyTokens, threshold: compactThreshold, onRun: ()=>{ suggestDoneRef.current[convIdNow] = true; runCompact('').catch(()=>{}); }, onDismiss: ()=>{ suggestDoneRef.current[convIdNow] = true; setUiPrefsTick((t)=>t + 1); } } : null;
	const activeSource = depsRef.current.activeSource;
	let statusBarVisible = true;
	try{ const ui = loadUiPrefs(); statusBarVisible = !(ui && ui.chatAssist && ui.chatAssist.statusBar === false); }catch(e){ statusBarVisible = true; }
	const statusBarNode = (
		<ChatStatusBar visible={statusBarVisible} model={model} agentEnabled={agentState.enabled} approvalMode={agentState.approval}
			mount={clip ? { kept: clip.totalKept, raw: clip.totalRaw, budget: clip.maxChars, clipped: clip.clippedCount, dropped: clip.droppedCount } : null}
			session={session} cachePct={session.lastCachePct} contextPct={contextPct} presetName={presetName} suggestCompact={suggestCompact}
			subjectTitle={activeSource ? activeSource.title : ''} onOpenMount={()=>{
				// [Q-041/M-52] 未挂载案例时「命主」胶囊此前回落到挂载抽屉,而抽屉里没有案例选择器 → 改为聚焦顶栏那个下拉
				const pick = depsRef.current.focusSourceSelect;
				if(!activeSource && typeof pick === 'function'){ pick(); return; }
				const f = depsRef.current.setMountDrawerOpen; if(typeof f === 'function'){ f(true); }
			}}
			compact={depsRef.current.activeConversation && depsRef.current.activeConversation.compact ? depsRef.current.activeConversation.compact : null} onUncompact={uncompact} onViewCompact={()=>setCompactViewOpen(true)}
			onOpenSubject={activeSource ? ()=>setSubjectOpen(true) : undefined} />
	);

	return {
		version: CHAT_ASSIST_VERSION,
		policy,
		presetName,
		mainline,
		promptLayerExtras,
		filterTechniqueSections,
		buildCheckpoint,
		openRewind,
		composer,
		runCommand,
		interceptSend,
		canSteer, steer, takeSteer: takeSteerFor, steerPending: (id)=>peekSteer(id), steerTick,
		bestOf: { busy: bestOf.busy }, orchestrate: { busy: orchestrate.busy },   // [Q-048⑥] 主发送前的并行提示读这两个 busy
		applyMentions,
		mentionItems,
		statusBar: { policy, presetName },
		settingsPanels,
		personaInjecting,
		statusBarNode,
		compact: { run: runCompact, cancel: uncompact, compacting },
		overlays: {
			statusDetail: { open: statusDetailOpen, onClose: ()=>setStatusDetailOpen(false), model, session, presetName, agentState, contextPct, clip, compact: depsRef.current.activeConversation ? depsRef.current.activeConversation.compact : null },
			compactView: { open: compactViewOpen, compact: depsRef.current.activeConversation ? depsRef.current.activeConversation.compact : null, onClose: ()=>setCompactViewOpen(false), onUncompact: uncompact },
			side: { open: side.open, initialQuestion: side.q, onClose: ()=>setSide({ open: false, q: '' }), deps: depsRef, mainline, onMainline: (t)=>{ setSide({ open: false, q: '' }); const f = depsRef.current.setPrompt; if(typeof f === 'function'){ f(t); } } },
			rewind: { open: rewind.open, plan: rewind.plan, busy: rewind.busy, onCancel: ()=>setRewind({ open: false, plan: null, item: null, busy: false }), onConfirm: confirmRewind, onBranch: ()=>{ const it = rewind.item; setRewind({ open: false, plan: null, item: null, busy: false }); const f = depsRef.current.handleBranchFromMessage; if(it && typeof f === 'function'){ f(it); } } },
			subject: { open: subjectOpen, source: depsRef.current.activeSource, conversations: depsRef.current.conversations, materials: depsRef.current.materials, onClose: ()=>setSubjectOpen(false), onOpenConversation: (c)=>{ setSubjectOpen(false); const f = depsRef.current.openConversation; if(typeof f === 'function'){ f(c); } } },
			plan: { open: planState.open, goal: planState.goal, plan: planState.plan, dropped: planState.dropped, busy: planState.busy, onApprove: approvePlan, onEdit: editPlan, onCancel: ()=>setPlanState(PLAN_CLOSED) },
			resume: { open: resumeOpen, items: resumeOpen ? recentConversations(depsRef.current.conversations, RESUME_RECENT_MAX) : [], activeId: depsRef.current.activeConversationId, pref: readResumePrefs().resumeLast, onClose: ()=>setResumeOpen(false),
				onOpen: (c)=>{ setResumeOpen(false); const f = depsRef.current.openConversation; if(c && typeof f === 'function'){ Promise.resolve(f(c)).catch(()=>{}); } },
				onTogglePref: (on)=>{ setResumeLast(!!on); if(on && depsRef.current.activeConversationId){ rememberLastConversation(depsRef.current.activeConversationId); } setUiPrefsTick((t)=>t + 1); } },
			doctor: { open: doctorState.open, report: doctorState.report, onClose: ()=>setDoctorState({ open: false, report: null }) },
		},
		resume: { open: ()=>setResumeOpen(true) },
		doctor: { run: runDoctor, state: doctorState },
		plan: { run: runPlan, state: planState },
		persona: { persona, runInit, runExtract },
		bestOf,
		bestOfCards,
		review,
		reviewNotes,
		orchestrate,
		orchestrationPanel,
		deps: depsRef,
	};
}
