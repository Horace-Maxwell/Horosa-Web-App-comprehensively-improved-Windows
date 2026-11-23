// AI 分析页 · 会话主流程:打开 / 建档 / 更新会话、发送、改问分支、套用组合、事实核对(这几个经 useChatAssist 交给对话助手)
// 从 AIAnalysisMain.js 按职责拆出的 AIAnalysisMain 内层函数 / Hook 回调体 / 渲染树片段:原文原样,用到的局部名字经第一个参数显式传入;
// 门面原位置换成调用它的包装 / 箭头 / 表达式,调用那一刻取值传入(与闭包读到的是同一份)。读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { Modal as AntdModal } from 'antd';
import { message } from 'antd';
import { needsMountBeforeSend } from '../../../utils/aiAnalysisStarterPrompts';
import { isAgentEnabled as isAgentEnabledForSendGuard } from '../../../utils/aiAgent/prefs';
import { normalizeTurnRequest, turnCommandText } from '../../../utils/aiChat/turnRequest';
import { historyContentOf } from '../../../utils/aiBestOfN';
import { buildForkMessages } from '../../../utils/aiConversationBranch';
import { AI_ANALYSIS_SCHEMA_VERSION, AI_ANALYSIS_STORES, getStoreRecord, listConversationMessages, putStoreRecord, replaceConversationMessages, saveConversationMessage, saveUiPrefs } from '../../../utils/aiAnalysisStore';
import { encodeModelSelection, parseModelSelection } from '../../../utils/aiAnalysisProviders';
import { uniqueTextList, sortByUpdatedDesc } from './providerForm';
import { buildConversationTitle, compactCoversMessage } from './chatHelpers';
import { TIMEPOINT_SOURCE_ID, NATAL_SOURCE_ID } from './sourceContext';

export async function openConversation({
	abortRef, setActiveConversationId, setTimepointDraft, setNatalDraft, setSelectedSourceId,
	setPartnerSourceId, setReferenceIds, setSelectedTechniqueKeys, providerProfiles, setModelSelection,
	setSessionSystemPrompt, conversationLoadTokenRef, setMessages, setInnerTab,
}, conversation){
	if(!conversation){
		return;
	}
	if(abortRef.current){
		abortRef.current.abort();
	}
	setActiveConversationId(conversation.id);
	// 合成源会话:先把当时的草稿还原回去,再选中合成 id —— 否则挂载内容用的是此刻的草稿时刻
	const _ref = conversation.sourceRef || null;
	const _draft = _ref && _ref.draft && typeof _ref.draft === 'object' ? _ref.draft : null;
	if(_draft && _ref.id === TIMEPOINT_SOURCE_ID){
		setTimepointDraft((prev)=>({ ...prev, ..._draft }));
	}else if(_draft && _ref.id === NATAL_SOURCE_ID){
		setNatalDraft((prev)=>({ ...prev, ..._draft }));
	}
	setSelectedSourceId(_ref && _ref.id ? _ref.id : '');
	setPartnerSourceId(conversation.partnerRef && conversation.partnerRef.id ? conversation.partnerRef.id : '');   // [双盘挂载]
	setReferenceIds(conversation.referenceIds || []);
	setSelectedTechniqueKeys(conversation.techniqueKeys || []);
	if(conversation.providerProfileId && !providerProfiles.some((item)=>item.id === conversation.providerProfileId)){
		message.info('该对话原用的接口配置已删除，已切换到可用配置，请确认模型后再发送。');
	}
	setModelSelection(encodeModelSelection(conversation.providerProfileId || '', conversation.model || ''));
	setSessionSystemPrompt(conversation.systemPrompt || '');
	// v1.16-O: 防 race 切换 — 用 token check
	const loadToken = ++conversationLoadTokenRef.current;
	const msgs = await listConversationMessages(conversation.id);
	if(loadToken === conversationLoadTokenRef.current){
		setMessages(msgs);
	}
	setInnerTab('analysis');
}

export async function ensureConversationRecord({
	activeSource, sources, partnerSource, activeConversation, referenceIds, activeTechniqueKeys,
	sessionSystemPrompt, setConversations, setActiveConversationId,
}, currentPrompt, profile, model, turn){
	const now = new Date().toISOString();
	const source = activeSource || null;
	// 命令轮的标题写命令(「张三 · 流年 2027」),不取展开后长模板的前 24 字;本轮给了合盘对方就按它记
	const titleText = turnCommandText(turn) || currentPrompt;
	const pairForRecord = (turn && turn.partnerSourceId && source && source.sourceType === 'chart'
		? sources.find((item)=>item && item.id === turn.partnerSourceId && item.sourceType === 'chart' && item.id !== source.id) : null) || partnerSource;
	const payload = {
		title: activeConversation ? (activeConversation.title || buildConversationTitle(titleText, source)) : buildConversationTitle(titleText, source),
		sourceRef: source ? {
			id: source.id,
			sourceType: source.sourceType,
			title: source.title,
			module: source.module,
			// 「起课时间 / 命盘时间」是合成源、不入库:只存四键的话,重开会话时挂载内容取的是
			// **当下的草稿时刻**(组件挂载那一刻或用户最近一次手改),标题与「案例」列却还是原时刻 —— 续问时
			// AI 拿到的其实是另一张盘。这里把当时的草稿一起存下,openConversation 还原它。
			draft: (source.id === TIMEPOINT_SOURCE_ID || source.id === NATAL_SOURCE_ID)
				? { ...(source.record || {}), name: (source.record && source.record.name) || '' }
				: undefined,
		} : null,
		// [双盘挂载] 合盘对方:重开会话时还原;单盘为 null
		partnerRef: pairForRecord ? {
			id: pairForRecord.id,
			sourceType: pairForRecord.sourceType,
			title: pairForRecord.title,
			module: pairForRecord.module,
		} : null,
		providerProfileId: profile ? profile.id : '',
		providerName: profile ? profile.name : '',
		providerType: profile ? profile.providerType : '',
		model,
		referenceIds: referenceIds.slice(0),
		techniqueKeys: activeTechniqueKeys.slice(0),
		systemPrompt: sessionSystemPrompt,
		lastMessageAt: now,
		updatedAt: now,
		archived: activeConversation ? activeConversation.archived : false,
		favorite: activeConversation ? activeConversation.favorite : false,
		branchRootId: activeConversation ? (activeConversation.branchRootId || activeConversation.id) : null,
		parentConversationId: activeConversation ? activeConversation.parentConversationId : null,
		schemaVersion: AI_ANALYSIS_SCHEMA_VERSION,
	};
	const conversation = await putStoreRecord(AI_ANALYSIS_STORES.conversations, {
		...(activeConversation || {}),
		...payload,
		createdAt: activeConversation ? activeConversation.createdAt : now,
	}, 'conv');
	setConversations((prev)=>{
		const exists = prev.some((item)=>item.id === conversation.id);
		return sortByUpdatedDesc(exists ? prev.map((item)=>item.id === conversation.id ? conversation : item) : [conversation].concat(prev));
	});
	setActiveConversationId(conversation.id);
	return conversation;
}

// 写回前先重读最新记录。此前 `conversation` 是**发送那一刻**的快照,一路传进 streamReply,
// 回复结束整条覆盖回去 —— 生成期间用户在历史页做的收藏 / 归档 / 重命名全被写回旧值。
// 现在底用库里的最新版,只有本次 patch 的键被改写;记录已被删掉则按传入快照建回(与旧行为同)。
export async function updateConversationMeta({ setConversations }, conversation, patch = {}){
	const base = conversation || {};
	let latest = null;
	if(base.id){
		try{ latest = await getStoreRecord(AI_ANALYSIS_STORES.conversations, base.id); }catch(e){ latest = null; }
	}
	const saved = await putStoreRecord(AI_ANALYSIS_STORES.conversations, {
		...base,
		...(latest || {}),
		...(patch || {}),
		updatedAt: new Date().toISOString(),
	}, 'conv');
	setConversations((prev)=>sortByUpdatedDesc(prev.map((item)=>item.id === saved.id ? saved : item)));
	return saved;
}


export async function handleSend({
	sending, sendingRef, prompt, chatAssist, pendingImages, activeSource, modelSelection,
	providerProfiles, setSending, beginSendAbort, ensureConversationRecord, prepAborted,
	buildResolvedPrompt, setMessages, setPrompt, setPendingImages, streamReply, visibleMessages,
}, overrideText, extraSystemContext, turnOptions){
	// 重入闸走 ref 同步判定:state 版 `sending` 在 React commit 前仍是旧值,连点/回车+点击可双双过闸,
	// 两条流共用 streamBufferRef 互相踩缓冲(压测按构造判定)。
	if(sending || sendingRef.current){
		return;
	}
	sendingRef.current = true;
	// 闸后整段 try/finally:此前「空问题 / 需先挂载 / 未选模型 / 缺密钥」四条早退不复位门闩 ⇒ 之后每次发送都在入口被吞(按钮看着可用却永不发,首次无密钥必踩;同病)
	try{
		// overrideText 只认字符串：onClick 直挂 handleSend 这类写法会把点击事件对象塞进来，
		// 模板串化后用户消息就成了 "[object Object]"（Windows #24/#25 实锅）——非字符串一律回落输入框内容。
		const overrideStr = typeof overrideText === 'string' ? overrideText : null;
		const trimmed = `${(overrideStr != null ? overrideStr : prompt) || ''}`.trim();
		// 本轮请求(命令 / 技能显式传入:命令芯片、只作用本轮的技法、本轮合盘对方);没有 = null,与此前逐字节同路径
		const turn = overrideStr != null ? normalizeTurnRequest(turnOptions) : null;
		// 斜杠命令:输入框内容是命令(首字符 / 且次字符非 /)→ 交给命令面板执行,不发送;非命令零路径
		if(overrideStr == null && chatAssist.interceptSend(trimmed)){ return; }
		const sendImages = pendingImages.map((p)=>p.url).filter(Boolean);
		if(!trimmed && !sendImages.length){
			message.warning('请输入要分析的问题');
			return;
		}
		// v1.21: 手动输入「具体命/事」问题但未挂载案例 → 提醒去挂载,不盲发(AI 无盘面数据只会臆测)。
		// 软件类(带 extraSystemContext)与已挂载案例不受影响; chip 的命/事未挂载分支已在 handleExampleClick 拦截。
		if(needsMountBeforeSend({ text: trimmed, activeSource, extraSystemContext, agentEnabled: isAgentEnabledForSendGuard() })){
			AntdModal.info({
				title: '需要先挂载案例',
				content: '你问的是某个具体命主 / 事件，但当前没有挂载案例。请在顶栏「选择案例」里选已保存的命盘，或到 八字 / 紫微 等 tab 起盘后用顶栏「新命盘」旁菜单的「存为命盘」再回来选择。挂载后 AI 才能拿到精确盘面数据来分析。',   // 顶栏,非左栏
				okText: '我知道了',
			});
			return;
		}
		const { profileId, model } = parseModelSelection(modelSelection);
		const profile = providerProfiles.find((item)=>item.id === profileId);
		if(!profile || !model){
			message.warning('请先选择可用模型');
			return;
		}
		if(!profile.apiKey && profile.providerType !== 'ollama'){
			message.warning('当前配置缺少 API Key，请先到设置中补全');
			return;
		}
		// 多模型对比 / 编排各用自己的 busy 态,不占主发送门闩(设计如此);并行两条流时明说
		if((chatAssist.bestOf && chatAssist.bestOf.busy) || (chatAssist.orchestrate && chatAssist.orchestrate.busy)){
			message.warning('多模型对比 / 编排仍在生成，本次发送会与它并行进行（互不占用发送门闩）', 5);
		}
		setSending(true);
		const sendAbort = beginSendAbort();   // 准备阶段即可停止
		try{
			const conversation = await ensureConversationRecord(trimmed, profile, model, turn);
			if(prepAborted(sendAbort)){ return; }
			const promptResult = await buildResolvedPrompt(trimmed, profile, extraSystemContext, turn);
			if(prepAborted(sendAbort)){ return; }
			const userMessage = await saveConversationMessage({
				conversationId: conversation.id,
				role: 'user',
				content: trimmed,
				images: sendImages.length ? sendImages : undefined,
				streamStatus: 'done',
				checkpoint: chatAssist.buildCheckpoint(),   // 回退用检查点(挂载/引用/技法/系统提示/模型…)
				// 附加上下文(软件帮助 / 技能口径 / 【合盘数据】/ 已批准计划约束)随消息落库,重答时还原,否则重答基于缺失数据
				extraSystemContext: extraSystemContext ? `${extraSystemContext}` : undefined,
				turn: turn || undefined,   // 本轮请求随消息落库:重答 / 重试 / 编辑分支按当时的命令与技法还原
			});
			setMessages((prev)=>prev.concat(userMessage));
			setPrompt('');
			setPendingImages([]);
			if(prepAborted(sendAbort)){ return; }
			await streamReply({
				conversation,
				profile,
				model,
				controller: sendAbort,
				chatMessages: [
					{
						role: 'system',
						content: promptResult.systemPrompt,
					},
				].concat(chatAssist.mainline(visibleMessages).concat(userMessage).map((item)=>({
					role: item.role,
					content: historyContentOf(item),   // 历史只带采用稿
					images: Array.isArray(item.images) && item.images.length ? item.images : undefined,
					agentTrace: item.agentTrace,
				}))),
			});
		}catch(e){
			console.error(e);
			message.error('发送分析请求失败');
		}
	}finally{
		sendingRef.current = false;
		setSending(false);
	}
}

export function applyBundle({
	referenceIds, setReferenceIds, setModelSelection, setSessionSystemPrompt,
	setPendingBundleTechniqueKeys, setChatTemperature, setChatTopP, setThinkingLevel, setInnerTab,
}, bundle, opts){
	const nextRefs = uniqueTextList(referenceIds.filter((item)=>item.indexOf('bundle:') !== 0).concat(`bundle:${bundle.id}`));
	setReferenceIds(nextRefs);
	if(bundle.defaultProviderProfileId && bundle.defaultModel){
		setModelSelection(encodeModelSelection(bundle.defaultProviderProfileId, bundle.defaultModel));
	}
	if(bundle.defaultSystemPrompt){
		setSessionSystemPrompt(bundle.defaultSystemPrompt);
	}
	// 组合包：缓存待挂载技法（待选案例后 effect 取交集落地）+ 套用生成设置。技能包经 /命令使用时不套技法(技能的技法只作用本轮)
	if(!(opts && opts.skipTechniques) && Array.isArray(bundle.defaultTechniqueKeys) && bundle.defaultTechniqueKeys.length){
		setPendingBundleTechniqueKeys(bundle.defaultTechniqueKeys.slice(0));
	}
	if(bundle.defaultChatTemperature != null){ setChatTemperature(bundle.defaultChatTemperature); saveUiPrefs({ chatTemperature: bundle.defaultChatTemperature }); }
	if(bundle.defaultChatTopP != null){ setChatTopP(bundle.defaultChatTopP); saveUiPrefs({ chatTopP: bundle.defaultChatTopP }); }
	if(bundle.defaultThinkingLevel){ setThinkingLevel(bundle.defaultThinkingLevel); saveUiPrefs({ thinkingLevel: bundle.defaultThinkingLevel }); }
	setInnerTab('analysis');
	message.success(`已应用组合：${bundle.name}`);
}

export async function handleBranchFromMessage({ activeConversation, setConversations, openConversation, messages }, messageRecord){
	if(!activeConversation || !messageRecord){
		return;
	}
	const list = await listConversationMessages(activeConversation.id);
	const idx = list.findIndex((item)=>item.id === messageRecord.id);
	if(idx < 0){
		return;
	}
	const branchConversation = await putStoreRecord(AI_ANALYSIS_STORES.conversations, {
		...activeConversation,
		// 分支点在压缩区内 → 不继承 compact(同编辑分支)
		...(compactCoversMessage(activeConversation.compact, messageRecord) ? { compact: undefined } : {}),
		id: null,
		title: `${activeConversation.title || '未命名对话'}（分支）`,
		parentConversationId: activeConversation.id,
		branchRootId: activeConversation.branchRootId || activeConversation.id,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	}, 'conv');
	const copiedMessages = buildForkMessages(list, idx, branchConversation.id);
	await replaceConversationMessages(branchConversation.id, copiedMessages);
	setConversations((prev)=>sortByUpdatedDesc([branchConversation].concat(prev)));
	await openConversation(branchConversation);
	message.success('已从这一轮创建分支');
	// 分支拷贝带 agentTrace 的气泡 → 两会话指向同一批动作账本(设计如此);明说撤销互相影响
	try{
		if((messages || []).some((m)=>m && m.agentTrace && Array.isArray(m.agentTrace.rounds) && m.agentTrace.rounds.some((rd)=>rd && Array.isArray(rd.results) && rd.results.length))){
			message.info('分支与原对话共享同一批动作账本：在任一边撤销 / 回退，另一边的气泡与写入也会受影响', 6);
		}
	}catch(e){ /* 提示失败不影响分支 */ }
}
