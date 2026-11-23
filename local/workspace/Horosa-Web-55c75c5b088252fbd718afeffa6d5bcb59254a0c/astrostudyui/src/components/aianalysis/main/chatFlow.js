// AI 分析页 · 对话与生成:新建对话、资料检索、自动标题、流式回复、提示词组装、配图与示例、重生成 / 改问分支、草稿存为来源
// 从 AIAnalysisMain.js 按职责拆出的 AIAnalysisMain 内层函数 / Hook 回调体 / 渲染树片段:原文原样,用到的局部名字经第一个参数显式传入;
// 门面原位置换成调用它的包装 / 箭头 / 表达式,调用那一刻取值传入(与闭包读到的是同一份)。读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { Modal as AntdModal } from 'antd';
import { message } from 'antd';
import { createStreamFlusher } from '../../../utils/aiStreamFlush';
import { classifyQuestion } from '../../../utils/aiAnalysisStarterPrompts';
import { isAgentEnabled as isAgentEnabledForSendGuard } from '../../../utils/aiAgent/prefs';
import { buildSoftwareHelpContext } from '../../../utils/aiAnalysisHelpDocs';
import { renderTemplatesForSend, isImageRejectionError, JSON_MODE_INSTRUCTION } from '../../../utils/aiChat/sendHelpers';
import { shouldAttachWesternSynastry } from '../../../utils/aiChat/skills';
import { turnTechniqueKeysFor } from '../../../utils/aiChat/turnRequest';
import { readModelRoutes, resolveRoute, providerOptionsForSlot } from '../../../utils/aiModelRouting';
import { assembleSystemPrompt } from '../../../utils/aiPromptAssembly';
import { upsertLocalChart } from '../../../utils/localcharts';
import { withNewChartDefaults } from '../../../utils/newChartCapture';
import { toastRecordWrite } from '../../../utils/recordStoreNotice';
import { upsertLocalCase } from '../../../utils/localcases';
import { createAgentTurn } from '../../../utils/aiAgent/runtime';
import { requestApproval as requestAgentApproval } from '../../../utils/aiAgent/approvals';
import { requestElicitation as requestAgentElicitation } from '../../../utils/aiAgent/elicitations';
// 对话上下文策略与真消息窗口(缺省 legacy=现状;window=历史不再双发+按模型窗口预算裁剪)
import { readContextPolicy, windowChatMessages } from '../../../utils/aiChatHistory';
import { emitAutomationEvent } from '../../../utils/aiAgent/automation/events';
import { historyContentOf } from '../../../utils/aiBestOfN';
import { buildEditBranchMessages } from '../../../utils/aiConversationBranch';
import { AI_ANALYSIS_STORES, deleteStoreRecord, listConversationMessages, putStoreRecord, replaceConversationMessages, saveConversationMessage, updateStoreRecordIf } from '../../../utils/aiAnalysisStore';
import { AI_CONTEXT_MAX_CHARS, buildContextLayers, getAnalysisSourceContext, getAnalysisTechniqueContexts, listAnalysisSources, listAnalysisTechniqueOptions, getPairSynastryText, getPairChineseTexts } from '../../../utils/aiAnalysisContext';
import { resolveEffectiveTechniqueOptions } from '../../../utils/techniqueMountSettings';
import { requestAIAnalysisChat, requestAIAnalysisChatStream, requestEmbeddingVectors } from '../../../services/aianalysis';
import { buildRetrievedContextText, ensureChunkEmbeddings, ensureMaterialChunks, mergeRetrievedChunks, rankChunksByKeyword, rerankChunksWithVector, partitionMaterialsByRetrieval } from '../../../utils/aiAnalysisRag';
import { getProviderProtocolFamily, applyThinkingLevel, applyChatParams, isReasoningModel, encodeModelSelection, parseModelSelection, mountCharBudgetFor, effectiveMaxTokensForModel, maxTokensKeyForModel } from '../../../utils/aiAnalysisProviders';
import { sortByUpdatedDesc } from './providerForm';
import { classifyStreamError, asyncInput, asyncConfirm, compactCoversMessage, isInsideCompactRegion, resolveReferenceItems } from './chatHelpers';
import { NATAL_SOURCE_ID } from './sourceContext';

export async function startNewConversation({
	abortRef, setActiveConversationId, setMessages, setPrompt, setSelectedHistoryIds, setPendingImages,
	setPromptClipStats, setInnerTab,
}, options = {}){
	if(abortRef.current){
		abortRef.current.abort();
	}
	setActiveConversationId('');
	setMessages([]);
	setPrompt('');
	setSelectedHistoryIds([]);
	// 新对话要把「上一条对话的残留」清干净:
	//  · pendingImages —— 加了图没发就点「新对话」,图会跟着新对话的第一条消息一起发出去(上一盘的图配这一盘的问);
	//  · promptClipStats —— 裁剪账横幅还挂着上一条对话的「整层未纳入」提示,新对话根本没挂那些层。
	setPendingImages([]);
	setPromptClipStats(null);
	if(options.switchTab !== false){
		setInnerTab('analysis');
	}
}

export async function retrieveMaterialContext(query, resolvedRefs, embeddingTarget, retrievalMode){
	// 分拣走 partitionMaterialsByRetrieval 单源:直挂/检索的档位判定只此一处,
	// 与逐项 shouldUseDirectAttach 判定逐字节等价,避免多处各判各的漂移。
	const { direct: directMaterials, rag: ragMaterials } = partitionMaterialsByRetrieval(resolvedRefs.materials || [], retrievalMode);
	if(!ragMaterials.length){
		return {
			directMaterials,
			retrievedChunks: [],
			retrievedText: '',
		};
	}
	let chunks = [];
	for(let i=0; i<ragMaterials.length; i++){
		const material = ragMaterials[i];
		try{
			const materialChunks = await ensureMaterialChunks(material);
			chunks = chunks.concat(materialChunks.map((chunk)=>({
				...chunk,
				materialName: material.name || material.fileName,   // 标签单源取 name(改名后与直挂层标题 / search_materials 同名);fileName 只作原始文件名
			})));
		}catch(err){
			console.warn('material chunking failed', material && material.name, err);
			message.warning(`资料「${(material && material.name) || ''}」分块失败，本次检索已跳过`);
		}
	}
	let ranked = rankChunksByKeyword(query, chunks).slice(0, 12);
	// issue #13：嵌入用「独立选择的嵌入 provider」，与聊天 provider 解耦（embeddingTarget = {profile, model}）。
	const eProfile = embeddingTarget && embeddingTarget.profile ? embeddingTarget.profile : null;
	const embeddingModel = embeddingTarget && embeddingTarget.model ? embeddingTarget.model : '';
	if(eProfile && embeddingModel && ranked.length){
		try{
			const queryEmbeddingRsp = await requestEmbeddingVectors({
				providerType: eProfile.providerType,
				apiKey: eProfile.apiKey,
				baseUrl: eProfile.baseUrl,
				model: embeddingModel,
				embeddingModel,
				providerOptions: eProfile.providerOptions || {},
				input: [query],
			});
			const queryVector = queryEmbeddingRsp && queryEmbeddingRsp.Result && Array.isArray(queryEmbeddingRsp.Result.vectors)
				? queryEmbeddingRsp.Result.vectors[0]
				: [];
			if(Array.isArray(queryVector) && queryVector.length){
				const enriched = await ensureChunkEmbeddings(eProfile, embeddingModel, ranked);
				ranked = rerankChunksWithVector(queryVector, enriched).slice(0, 6);
			}
		}catch(e){
			console.warn('embedding rerank skipped', e);
			message.warning('向量检索失败，本次仅用关键词排序');
		}
	}
	const retrievedChunks = mergeRetrievedChunks(ranked, 5200);
	return {
		directMaterials,
		retrievedChunks,
		retrievedText: buildRetrievedContextText(retrievedChunks),
	};
}

// AI 自动起名：用一个独立的非流式微调用，让 AI 根据「用户首问 + AI 首回」总结一个 6-14 字标题。
// 成功：覆盖 title + 置 titleAutoNamed=true；失败：退到「截首回前 16 字」兜底，仍置 titleAutoNamed=true（防再触发）。
// 不阻塞主对话流程；组件卸载时 isMountedRef 守门防 setState 警告；重命名/再次手动改名后 titleManuallyEdited=true 永不再触发。
export async function generateAndApplyAutoTitle({ providerProfiles, isMountedRef, updateConversationMeta }, { conversation, profile, model, userPrompt, aiReply }){
	const fallbackTitle = ()=>{
		const cleaned = `${aiReply || ''}`
			.replace(/^\s*[#>*\-\d\.\s]+/, '')
			.replace(/\s+/g, ' ')
			.trim();
		if(!cleaned){ return null; }
		return cleaned.length > 16 ? cleaned.slice(0, 16) + '…' : cleaned;
	};
	let titleFromAI = null;
	try{
		if(!profile || !model){ throw new Error('no_provider'); }
		const sys = '你是对话标题生成器。根据用户问题和 AI 第一次回复，给出一个 6-14 个汉字的简短中文对话标题，能让用户在历史列表里一眼看出主题。仅返回标题文本本身，不要加引号、标点结尾、序号、表情、或任何前后缀。';
		const usrText = `用户问题：${(userPrompt || '').slice(0, 600)}\n\nAI 回复（前 400 字）：${(aiReply || '').slice(0, 400)}\n\n请生成标题：`;
		// 自动起标题走「辅助」槽(按任务用模型;留空 = 跟随本轮模型,选项逐字节同此前)
		const titleRoute = resolveRoute('utility', { routes: readModelRoutes(), providerProfiles, profile, model });
		const opts = providerOptionsForSlot('utility', titleRoute.profile, titleRoute.model, { applyThinkingLevel });
		const rsp = await requestAIAnalysisChat({
			providerType: titleRoute.profile.providerType,
			apiKey: titleRoute.profile.apiKey,
			baseUrl: titleRoute.profile.baseUrl,
			model: titleRoute.model,
			providerOptions: { ...(opts || {}), requestTimeoutMs: 15000 },
			messages: [
				{ role: 'system', content: sys },
				{ role: 'user', content: usrText },
			],
		});
		const raw = rsp && rsp.Result && rsp.Result.content ? `${rsp.Result.content}` : '';
		// 清洗：去引号/换行/「标题：」/Markdown 修饰/末尾标点
		let t = raw.trim();
		t = t.replace(/^["'"「『《【\s]+|["'"」』》】\s]+$/g, '');
		t = t.replace(/^标题[:：\s]*/, '');
		t = t.replace(/^[#>*\-\d\.\s]+/, '');
		t = t.replace(/[\s\n\r]+/g, ' ').trim();
		t = t.replace(/[。.!！?？,，;；:：]+$/, '');
		if(t.length >= 4 && t.length <= 30){
			titleFromAI = t;
		}
	}catch(_){
		// 静默失败：fallback 兜底
	}
	const finalTitle = titleFromAI || fallbackTitle();
	if(!finalTitle){ return; }
	if(!isMountedRef.current){ return; }
	try{
		await updateConversationMeta(conversation, {
			title: finalTitle,
			titleAutoNamed: true,
			titleSource: titleFromAI ? 'ai' : 'fallback',
		});
	}catch(e){
		console.warn('autoTitle apply failed', e);
	}
}

export async function streamReply({
	streamBufferRef, streamReasoningBufferRef, streamUsageRef, setMessages, abortRef, chatModels,
	setSources, setSelectedSourceId, chatAssist, techniqueOptionOverrides, thinkingLevel,
	chatTemperature, chatTopP, stopSequences, frequencyPenalty, presencePenalty, jsonMode, messages,
	lastPromptMetaRef, updateConversationMeta, generateAndApplyAutoTitle,
}, {
	conversation,
	profile,
	model,
	chatMessages,
	appendAssistant = true,
	existingAssistantId = '',
	controller,   // 发送入口在准备阶段就建好的控制器(缺省=本函数自建,老调用点零变化)
}) {
	const assistantMessage = await saveConversationMessage({
		id: existingAssistantId || null,
		conversationId: conversation.id,
		role: 'assistant',
		content: '',
		streamStatus: 'streaming',
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	});
	streamBufferRef.current = '';
	streamReasoningBufferRef.current = '';
	streamUsageRef.current = null;
	if(appendAssistant){
		setMessages((prev)=>{
			const exists = prev.some((item)=>item.id === assistantMessage.id);
			return exists ? prev.map((item)=>item.id === assistantMessage.id ? assistantMessage : item) : prev.concat(assistantMessage);
		});
	}else{
		setMessages((prev)=>prev.map((item)=>item.id === assistantMessage.id ? assistantMessage : item));
	}
	// 复用发送入口的控制器:准备阶段按下的「停止」要能传导到本次流(缺省自建=零回归)。
	const abortController = (controller && !controller.signal.aborted) ? controller : new AbortController();
	abortRef.current = abortController;
	let streamError = null;
	// [流式渲染合帧·A] 高吞吐上游每秒可推数百个 delta,逐 delta 提交状态会把主线程打满(真模型长回复实测:
	// 163s 内事件环两次停顿 85.9s/44.6s,停止钮/输入框全部失灵)。合并到 80ms 一帧落状态;末帧由 flush() 同步兜底,
	// 出错/中止/finally 里 cancel() 防止定稿后残留计时器把 'streaming' 态写回已定稿消息。
	const streamFlusher = createStreamFlusher(()=>{
		const content = streamBufferRef.current;
		const reasoning = streamReasoningBufferRef.current;
		setMessages((prev)=>prev.map((item)=>item.id === assistantMessage.id ? {
			...item,
			content,
			...(reasoning ? { reasoning } : {}),
			streamStatus: 'streaming',
			updatedAt: new Date().toISOString(),
		} : item));
	});
	// 真消息窗口:缺省 legacy → 原数组同引用(现状);window → 按模型窗口预算裁剪历史(末条 user 恒保留、对齐问答对)。
	// 四个发送口皆经本函数,窗口只在此处做一次;各轮请求一律消费 baseMessages。
	// 总开关关=NULL_AGENT 只发正文:窗口不计工具轮回放量(此前按不会发送的回放量把历史裁得只剩几条)
	const agentReplayOn = isAgentEnabledForSendGuard();
	const { messages: baseMessages, meta: historyMeta } = windowChatMessages(chatMessages, {
		model,
		numCtx: profile && profile.providerType === 'ollama' ? Number((profile.providerOptions || {}).num_ctx) || undefined : undefined,
		policy: readContextPolicy(),
		replayTrace: agentReplayOn,
	});
	// 按任务用模型可能把某一轮路由到**窗口更小**的模型(工具轮常配小模型),
	//   而历史窗口只按主选模型算过一次 → 小模型那一轮收到超窗历史(上游 400 或悄悄截前文)。
	//   这里按轮模型重算一次并取「更紧的那一份」(路由模型窗口更大时不放宽,保持主选口径);同模型=同引用零开销。
	const roundWindowCache = new Map();
	const baseMessagesForRound = (rp)=>{
		if(!rp || !rp.model || rp.model === model){ return baseMessages; }
		const key = `${rp.model}`;
		if(roundWindowCache.has(key)){ return roundWindowCache.get(key); }
		let out = baseMessages;
		try{
			const w = windowChatMessages(chatMessages, {
				model: rp.model,
				numCtx: rp.profile && rp.profile.providerType === 'ollama' ? Number((rp.profile.providerOptions || {}).num_ctx) || undefined : undefined,
				policy: readContextPolicy(),
				replayTrace: agentReplayOn,
			});
			if(w && Array.isArray(w.messages) && w.messages.length < baseMessages.length){ out = w.messages; }
		}catch(e){ out = baseMessages; }
		roundWindowCache.set(key, out);
		return out;
	};
	// AI 助手·一个气泡=一个 Turn:总开关关 → NULL_AGENT(下面的 do/while 恰跑一轮,请求体无 tools,消息与旧 map 逐字段等价)
	const toolPick = chatModels.pickTool({ profile, model });
	const agent = createAgentTurn({
		profile: toolPick.profile, model: toolPick.model, signal: abortController.signal,
		lastUserMessage: (()=>{ for(let i = chatMessages.length - 1; i >= 0; i--){ const m = chatMessages[i]; if(m && m.role === 'user'){ return `${m.content || ''}`; } } return ''; })(),
		ui: { refreshSources: ()=>setSources(listAnalysisSources()), selectSource: (cid)=>setSelectedSourceId(cid) },
		onTrace: (trace)=>setMessages((prev)=>prev.map((item)=>item.id === assistantMessage.id ? { ...item, agentTrace: trace } : item)),
		requestApproval: (call)=>requestAgentApproval(assistantMessage.id, call),
		requestElicitation: (q)=>requestAgentElicitation(assistantMessage.id, q),
		steer: ()=>chatAssist.takeSteer(assistantMessage.id),   // 每轮开始取一次用户插话(取即清)
		techniqueOptionOverrides,   // 建目标任务的工具在创建时快照本会话的每技法覆盖
	});
	// issue #13：把聊天高级参数（思考档/温度/top_p）并入 providerOptions（reasoning 模型不发 temperature）。
	const chatProviderOptions = applyThinkingLevel({ ...(profile.providerOptions || {}) }, thinkingLevel, profile.providerType, model);
	// 2B/2G：停止序列 / 频率·存在惩罚 / JSON 模式——按接口家族下发（透传由后端 buildProviderBodyOptions 完成，无需改 jar）。
	// 五类浮层参数改走单源 applyChatParams(与多模型候选 / 按审阅重写 / 旁问同一份实现);
	// 温度在其中按家族夹逼;推理型号不写 top_p(出口会剥,浮层同步置灰)。
	const protoFamily = profile.protocolFamily || getProviderProtocolFamily(profile.providerType);
	Object.assign(chatProviderOptions, applyChatParams(chatProviderOptions, {
		profile, model, protocolFamily: protoFamily,
		temperature: chatTemperature, topP: chatTopP, stopSequences,
		frequencyPenalty, presencePenalty, jsonMode,
	}));
	// 聊天路径推理模型输出预算兜底:档案未显式配上限(anthropic max_tokens/ollama num_predict)
	// 时,后端默认 2048/1024 会被思考 token 吃光 → 正文空(同病根,见 effectiveMaxTokensForModel)。
	// 只在「未配」时按同一放大逻辑兜底;用户配过任何值 = 尊重原值,零覆盖。
	{
		const hasExplicitCap = chatProviderOptions.max_tokens != null
			|| chatProviderOptions.num_predict != null
			|| chatProviderOptions.maxOutputTokens != null;
		if(!hasExplicitCap && isReasoningModel(model)){
			const boosted = effectiveMaxTokensForModel(model, 4096);
			// 🔴 键名单一真值源:本兜底恰恰只对推理模型注入,而 gpt-5/6/7 正是不收
			// max_tokens 的那一代 —— 用错键=每次请求先吃一个 400。
			chatProviderOptions[maxTokensKeyForModel(protoFamily, model)] = boosted;
		}
	}
	try{
		do{
		agent.beginRound();
		if(agent.enabled){ streamBufferRef.current = ''; streamReasoningBufferRef.current = ''; streamError = null; }
		const roundPick = chatModels.pickRound({ agent, profile, model, providerOptions: chatProviderOptions, thinkingLevel });
		try{
		await requestAIAnalysisChatStream({
			providerType: roundPick.profile.providerType,
			apiKey: roundPick.profile.apiKey,
			baseUrl: roundPick.profile.baseUrl,
			model: roundPick.model,
			providerOptions: roundPick.providerOptions,
			messages: agent.messagesForRound(baseMessagesForRound(roundPick)),   // 按轮模型收紧历史窗口
			tools: agent.toolDefs(),
			toolChoice: agent.toolChoice(),
		}, {
			signal: abortController.signal,
			onEvent: (event)=>{
				agent.onEvent(event);
				if(event.type === 'delta'){
					if(abortController.signal.aborted){
						return;
					}
					const delta = event.json && event.json.delta ? `${event.json.delta}` : '';
					if(!delta){
						return;
					}
					streamBufferRef.current += delta;
					streamFlusher.schedule();
				}else if(event.type === 'reasoning'){
					// #16:DeepSeek reasoner 等的思维链增量。单独累计并渲染「思考过程」,让长思考期可见、不再像「卡死/空」。
					if(abortController.signal.aborted){
						return;
					}
					const r = event.json && event.json.reasoning ? `${event.json.reasoning}` : '';
					if(!r){
						return;
					}
					streamReasoningBufferRef.current += r;
					streamFlusher.schedule();
				}else if(event.type === 'usage'){
					// 2A：后端按家族解析后的统一 usage 事件 {input_tokens, output_tokens, total_tokens}。
					if(event.json && typeof event.json === 'object'){
						streamUsageRef.current = event.json;
					}
				}else if(event.type === 'error'){
					streamError = (event.json && event.json.message) ? `${event.json.message}` : (event.data || '上游服务返回错误');
				}
			},
		});
		}catch(streamEx){
			// 仅「原生模式 + 上游明确不支持 tools」被吸收并同轮降级重发;其它错误照旧上抛
			if(!agent.absorbStreamError(streamEx)){ throw streamEx; }
		}
		chatModels.afterRound({ agent, profile, model });
		}while(await agent.settleRound());
		streamFlusher.flush();
		// 未被本轮消费的插话随 Turn 结束丢弃(设计如此:插话只在下一轮工具调用前生效);此前静默 → 现明说并清队列
		try{
			const leftoverSteer = chatAssist.steerPending(assistantMessage.id);
			if(leftoverSteer && leftoverSteer.length){
				chatAssist.takeSteer(assistantMessage.id);
				message.info(`本轮已结束，${leftoverSteer.length} 条插话未被消费，已丢弃（插话只在下一轮工具调用前生效；可把它作为新问题再发）`, 6);
			}
		}catch(e){ /* 提示失败不影响收尾 */ }
		const finalContent = `${streamBufferRef.current || ''}`.trim();
		// 错误不再拼进 content（破坏 markdown），改为 errorInfo 字段；content 为空时给暗灰占位。
		const resolvedContent = finalContent || (streamError ? '' : '模型未返回可用内容');
		// 上游在正文之后发 error 帧(半截回答):此前只在正文为空时才记 errorInfo ⇒ 半截当完整、错误静默吞掉;
		//   现只要有 streamError 就记 errorInfo(气泡下方照常渲染错误卡、可重试),正文非空时状态仍 done(历史/上下文照常吃)但带 partial:true
		const errorInfo = streamError ? classifyStreamError(streamError) : null;
		const partialAfterError = !!(finalContent && streamError);
		// 图片被模型拒绝(非视觉模型)→ 把本会话历史里的图片剥离并落库(imagesStripped),
		// 否则整段对话每轮都带同一批图、持续失败;气泡里保留「已剥离」标记,换视觉模型可重新发图。
		if(streamError && isImageRejectionError(streamError)){
			const withImages = (chatMessages || []).filter((m)=>m && Array.isArray(m.images) && m.images.length);
			if(withImages.length){
				const ids = new Set(messages.filter((m)=>m && Array.isArray(m.images) && m.images.length && m.conversationId === conversation.id).map((m)=>m.id));
				for(const mid of ids){
					// eslint-disable-next-line no-await-in-loop
					try{ await updateStoreRecordIf(AI_ANALYSIS_STORES.messages, mid, ()=>true, (rec)=>({ ...rec, images: undefined, imagesStripped: true, imagesStrippedReason: `${streamError}`.slice(0, 200) })); }catch(e){ /* 落库失败只影响下次载入 */ }
				}
				setMessages((prev)=>prev.map((m)=>(ids.has(m.id) ? { ...m, images: undefined, imagesStripped: true } : m)));
				message.info('模型拒绝了图片输入，已把图片从这段对话的历史中剥离；换用视觉模型后可重新发送图片');
			}
		}
		// usage 随带稳定层指纹(prompt)与历史窗口账(history):气泡 tooltip/账本按轮核对缓存命中与窗口裁剪
		const usage = streamUsageRef.current ? { ...agent.mergeUsage(streamUsageRef.current), model, providerType: profile.providerType, prompt: lastPromptMetaRef.current || undefined, history: historyMeta } : undefined;
		const saved = await saveConversationMessage({
			...assistantMessage,
			content: resolvedContent,
			reasoning: `${streamReasoningBufferRef.current || ''}`.trim() || undefined,
			streamStatus: (!finalContent && streamError) ? 'error' : ((agent.trace() && agent.trace().stopReason === 'aborted') ? 'aborted' : 'done'),
			errorInfo,
			partial: partialAfterError || undefined,
			usage,
			agentTrace: agent.trace() || undefined,
			updatedAt: new Date().toISOString(),
		});
		setMessages((prev)=>prev.map((item)=>item.id === saved.id ? saved : item));
		// 「一轮对话结束」自动规则事件此前从未有人发出(规则弹窗里能选、引擎能听、就是没人发):助手消息落库即发
		emitAutomationEvent('turn.end', { conversationId: conversation.id, messageId: saved.id, status: saved.streamStatus, hadToolCalls: !!(agent.trace() && (agent.trace().rounds || []).some((r)=>(r.results || []).length)), origin: 'in-app' });
		// 首回 AI 完整后自动命名：仅落基础 meta；真正的 AI 起名通过 generateAndApplyAutoTitle 异步另发一轮微调用，
		// 完成后再更新 title。失败时再退化到「截首回 N 字」兜底（避免一直叫「未命名对话」）。
		const convNow = await updateConversationMeta(conversation, { lastMessageAt: saved.updatedAt });
		// 起名判定按**库里最新**的会话记录,不按发送时的快照:生成期间用户手动改过标题
		// (titleManuallyEdited=true)时,快照里没有这个标记 → AI 起名会把手改标题盖掉。
		const convForTitle = convNow || conversation;
		if(!convForTitle.titleAutoNamed && !convForTitle.titleManuallyEdited && finalContent && finalContent.length > 4){
			// 取用户问题（messages 数组里最后一条 user 的 content）作为命名依据。
			const lastUserPrompt = (()=>{
				for(let i = chatMessages.length - 1; i >= 0; i--){
					const m = chatMessages[i];
					if(m && m.role === 'user' && m.content){ return `${m.content}`; }
				}
				return '';
			})();
			// 非阻塞触发，不 await——streamReply 不被卡住。
			generateAndApplyAutoTitle({ conversation: convForTitle, profile, model, userPrompt: lastUserPrompt, aiReply: finalContent });
		}
		return saved;
	}catch(e){
		streamFlusher.cancel();
		const aborted = e && e.name === 'AbortError';
		const failMessage = streamError || (e && e.message ? `${e.message}` : '') || '生成失败。';
		// 工具执行后上游停流/500 抛错:当前轮归档并记 stopReason='error'(运行时缺 failRound 时守卫跳过,不炸)
		if(!aborted && agent && typeof agent.failRound === 'function'){ agent.failRound(failMessage); }
		const errorInfo = aborted ? null : classifyStreamError(failMessage);
		const saved = await saveConversationMessage({
			...assistantMessage,
			content: streamBufferRef.current || (aborted ? '已停止生成。' : ''),
			reasoning: `${streamReasoningBufferRef.current || ''}`.trim() || undefined,
			streamStatus: aborted ? 'aborted' : 'error',
			errorInfo,
			agentTrace: agent.trace() || undefined,
			updatedAt: new Date().toISOString(),
		});
		setMessages((prev)=>prev.map((item)=>item.id === saved.id ? saved : item));
		if(!aborted){
			throw e;
		}
		return saved;
	}finally{
		streamFlusher.cancel();
		abortRef.current = null;
	}
}

// 本函数**会写页面态**(挂载快照 / 技法上下文 / 裁剪账 / 稳定层指纹),所以只许主发送路径调用。
// 旁问 / 多模型对比 / 回答审阅是「借同一份 system 吃前缀缓存」的旁路,和主发送并发时会把横幅的
// 裁剪账与 usage.prompt 指纹串台(看到的账不是本条回复的)。它们一律走下面的 buildResolvedPromptQuiet。
export async function buildResolvedPromptImpl({
	referenceIds, materials, bundles, templates, activeSource, activeConversation, sources,
	activeTechniqueKeys, techniqueOptionOverrides, effectiveTechniqueOptions, partnerSource,
	sourceContext, chatAssist, setSourceContext, setTechniqueContexts, partnerEffectiveTechniqueOptions,
	setPartnerSourceContext, setPartnerTechniqueContexts, retrieveMaterialContext,
	resolveEmbeddingTarget, visibleMessages, sessionSystemPrompt, modelSelection, jsonMode, isMountedRef,
	setPromptClipStats, selectedSourceId, lastPromptMetaRef,
}, currentPrompt, profile, extraSystemContext, silent, turn){
	const _policy = readContextPolicy();
	const resolvedRefs = resolveReferenceItems(referenceIds, materials, bundles, templates);
	const currentSource = activeSource || (activeConversation && activeConversation.sourceRef ? sources.find((item)=>item.id === activeConversation.sourceRef.id) : null);
	// 本轮请求:技能的技法只作用本轮(按当前案例可挂集过滤);本轮给了合盘对方就按它(页面状态下一拍才更新)。turn 缺省 = 此前路径
	const turnScope = turnTechniqueKeysFor(turn, activeTechniqueKeys, turn && turn.techniqueKeys ? listAnalysisTechniqueOptions(currentSource).map((o)=>o.value) : null);
	const keysThisTurn = turnScope.keys;
	const optsThisTurn = turnScope.turnOnly
		? resolveEffectiveTechniqueOptions(keysThisTurn, { record: currentSource && currentSource.record ? currentSource.record : null, sessionOverrides: techniqueOptionOverrides })
		: effectiveTechniqueOptions;
	const previewable = !silent && !turnScope.turnOnly;   // 本轮专用技法不写挂载预览(预览只反映会话挂载)
	const turnPartner = turn && turn.partnerSourceId && currentSource && currentSource.sourceType === 'chart'
		? (sources.find((item)=>item && item.id === turn.partnerSourceId && item.sourceType === 'chart' && item.id !== currentSource.id) || null) : null;
	const pairSource = turnPartner || partnerSource;
	const ctx = currentSource && currentSource.record ? await getAnalysisSourceContext(currentSource, {
		mode: keysThisTurn.length ? 'meta' : 'full',
	}) : sourceContext;
	// @技法段:选过段的技法只保留所选段(未选=原样引用返回,零变化);本人与合盘对方经同一插座
	const filterSections = (list)=>chatAssist.filterTechniqueSections(list);
	const resolvedTechniqueContexts = filterSections(currentSource && keysThisTurn.length
		? await getAnalysisTechniqueContexts(currentSource, keysThisTurn, {
			sourceContext: ctx,
			// 发送给 LLM 的最终上下文也带上「每技法设置」覆盖（与预览卡一致）。
			techniqueOptions: optsThisTurn,
		})
		: []);
	if(ctx && previewable){
		setSourceContext(ctx);
	}
	if(previewable){ setTechniqueContexts(resolvedTechniqueContexts); }
	// [双盘挂载] 对方盘:同一组技法、同一份会话覆盖(按对方盘现状剪),发送时现算;@技法段过滤同样作用于对方
	let partnerForPrompt = null;
	if(pairSource && pairSource.record){
		const pctx = await getAnalysisSourceContext(pairSource, { mode: keysThisTurn.length ? 'meta' : 'full' });
		const pairOpts = (turnScope.turnOnly || pairSource !== partnerSource)
			? resolveEffectiveTechniqueOptions(keysThisTurn, { record: pairSource.record || null, sessionOverrides: techniqueOptionOverrides })
			: partnerEffectiveTechniqueOptions;
		const ptechs = filterSections(keysThisTurn.length
			? await getAnalysisTechniqueContexts(pairSource, keysThisTurn, {
				sourceContext: pctx,
				techniqueOptions: pairOpts,
			})
			: []);
		partnerForPrompt = { title: pairSource.title, sourceContext: pctx, techniqueContexts: ptechs };
		// 两人之间的西洋合盘数据:没勾技法或勾了西洋本命类才附(只看紫微 / 八字不附,免得串体系);按「这一对」缓存,进会话层
		if(currentSource && currentSource.record && shouldAttachWesternSynastry(keysThisTurn)){
			partnerForPrompt.synastry = await getPairSynastryText(currentSource.record, pairSource.record, { optionsA: optsThisTurn, optionsB: pairOpts });
		}
		// 中式合盘对照:两人都挂八字 → 八字合婚;都挂紫微 → 紫微合盘(纯前端确定性计算,按这一对缓存)
		if(currentSource && currentSource.record){
			const chinese = getPairChineseTexts(currentSource.record, pairSource.record, keysThisTurn, { selfName: currentSource.title, otherName: pairSource.title }, { optionsA: optsThisTurn, optionsB: pairOpts });
			if(chinese.bazi || chinese.ziwei){ partnerForPrompt.chinese = chinese; }
		}
		if(previewable && pairSource === partnerSource){
			setPartnerSourceContext(pctx);
			setPartnerTechniqueContexts(ptechs);
		}
	}
	// 「默认检索策略」属组合(bundle)的设置,故直接从本轮挂载的组合读,不另立会话态。
	// 挂了多个组合时取第一个显式非 auto 的(auto 等于不表态);都没挂/都 auto → undefined = 原长度规则。
	const bundleRetrievalMode = (resolvedRefs.bundles || [])
		.map((b)=>b && b.defaultRetrievalMode)
		.find((m)=>m === 'fulltext' || m === 'rag');
	// 组合的「默认 Embedding 模型」与「默认检索策略」同源取法:挂了多个组合取第一个填了的
	const bundleEmbeddingModel = (resolvedRefs.bundles || [])
		.map((b)=>`${(b && b.defaultEmbeddingModel) || ''}`.trim())
		.find(Boolean);
	const retrieval = await retrieveMaterialContext(currentPrompt, resolvedRefs, resolveEmbeddingTarget(profile, bundleEmbeddingModel), bundleRetrievalMode);
	// 模版变量({{user_prompt}} / {{source_context}} / {{retrieved_context}} / {{conversation_history}} / {{system_prompt}})
	// 此前从不渲染(帮助却称「预览即实发」)。发送层按约定取本轮真实值渲染;渲染失败 / 无占位符 → 原文;与预览同款关 HTML 转义。
	const renderedTemplates = renderTemplatesForSend(resolvedRefs.templates, {
		user_prompt: `${currentPrompt || ''}`,
		source_context: `${(ctx && ctx.content) || ''}`,
		retrieved_context: (()=>{ try{ return buildRetrievedContextText(retrieval.retrievedChunks || []); }catch(e){ return ''; } })(),
		conversation_history: chatAssist.mainline(visibleMessages).slice(-8).map((m)=>`[${m.role}] ${`${historyContentOf(m) || ''}`.slice(0, 600)}`).join('\n'),
		system_prompt: `${sessionSystemPrompt || ''}`,
	});
	const layers = buildContextLayers({
		sourceContext: ctx,
		techniqueContexts: resolvedTechniqueContexts,
		materials: retrieval.directMaterials.map((item)=>({
			...item,
			retrievedOnly: false,
		})),
		bundles: resolvedRefs.bundles,
		templates: renderedTemplates,   // 已按本轮真实值渲染的模版副本
		retrievedChunks: retrieval.retrievedChunks,
		// window 模式:历史不再进 system 的「最近对话」层(空数组不产该层),只随消息数组发一份=去双发
		conversationMessages: _policy.historyMode === 'window' ? [] : chatAssist.mainline(visibleMessages),
		// 组合提示不再从 resolvedRefs 拼进来(它只走 bundle-system 独立层)
		// 本轮附加上下文不再并进系统层(稳定前缀被单轮技能重写两次),改独立挥发层 turn-extra
		systemPrompt: sessionSystemPrompt,
		turnExtraContext: extraSystemContext,
		// 压缩摘要 / 口径 / 记忆 等附加稳定层:无=空数组(零变化)
		extraLayers: chatAssist.promptLayerExtras(turnScope.turnOnly ? { techniqueKeys: keysThisTurn } : undefined),   // 本轮专用技法时技法口径按本轮取
		partner: partnerForPrompt,   // [双盘挂载] null = 单盘(各层与此前逐字节相同)
	});
	// [挂载预算] 单次裁剪消双算：同一份 layers 只过一遍 clipContextLayersDetailed（旧代码这里
	// clipContextLayers + buildPromptContext 同输入各算一遍）。fairShare 让多技法触界时
	// 公平分摊而非低序技法整层静默丢；账本 {byKey,dropped,stats} 落 state 供预览卡/banner 可见化。
	// [挂载预算] 按当前模型窗口给预算:大窗口模型解除 2 万字硬颈,Ollama 按 num_ctx
	// 实算(小窗口低于保底,防静默截断),未知模型回落 AI_CONTEXT_MAX_CHARS=零回归。
	const _selModel = parseModelSelection(modelSelection).model || '';
	const _numCtx = profile && profile.providerType === 'ollama'
		? Number((profile.providerOptions || {}).num_ctx) || undefined
		: undefined;
	// [Windows #80] 策略里填了「挂载字数预算」就用它,没填按模型窗口实算 —— 单一入口,各调用点同源。
	const ctxCharBudget = mountCharBudgetFor(_selModel, { numCtx: _numCtx, floorChars: AI_CONTEXT_MAX_CHARS, policy: _policy });
	// [调用链合并] 裁剪 → 稳定 / 挥发分段 → 缓存断点 → 丢层留痕 → 指纹 → JSON 模式尾句:与无头回合同一个拼装函数
	//   (utils/aiPromptAssembly.js;口径与此前这里的写法逐字节一致,合同 aiPromptAssembly.test 锁)。fairShare 让多技法触界时公平分摊;
	//   缓存家族稳定层在前、挥发层在后、交界插断点,window 模式挥发层常为空 → 稳定层非空即插断点;非缓存家族先稳定后挥发无断点;
	//   被整层丢弃的层在断点之后给模型留痕;「只输出 JSON」尾句追加在最后(挥发区,不动稳定前缀)。
	const assembled = assembleSystemPrompt({ layers, maxChars: ctxCharBudget, providerType: profile && profile.providerType, breakpointWhenNoVolatile: _policy.historyMode === 'window', tailInstruction: jsonMode ? JSON_MODE_INSTRUCTION : '' });
	const clipDetail = assembled.clip;
	if(isMountedRef.current && !silent){
		setPromptClipStats({
			byKey: (clipDetail.stats && clipDetail.stats.byKey) || {},
			dropped: clipDetail.dropped || [],
			stats: clipDetail.stats || null,
		});
	}
	// 稳定层指纹:跨轮逐字节不变才命中上游前缀缓存;挂载源/技法未变而指纹变了=某稳定层在漂(console 留痕排障)。
	{
		const _mountSig = `${(currentSource && currentSource.id) || selectedSourceId || ''}|${(keysThisTurn || []).join(',')}${partnerForPrompt ? `|pair:${pairSource.id}` : ''}`;
		const _promptMeta = {
			stableHash: assembled.meta.stableHash,
			stableChars: assembled.meta.stableChars,
			volatileChars: assembled.meta.volatileChars,
			layerKeys: assembled.meta.layerKeys,
			mountSig: _mountSig,
		};
		const _prev = lastPromptMetaRef.current;
		if(!silent && _prev && _prev.mountSig === _mountSig && _prev.stableHash !== _promptMeta.stableHash){
			console.warn('[ai-prompt] stable prefix changed', _prev.stableHash, _promptMeta.stableHash);
		}
		if(!silent){ lastPromptMetaRef.current = _promptMeta; }
	}
	const _sysJoined = assembled.systemPrompt;
	return {
		systemPrompt: _sysJoined,
		retrieval,
		clippedLayers: clipDetail.kept,
	};
}

// 2F：选择图片（多媒体输入）→ 读为 dataURL 暂存，随下一条消息发送。
export function handlePickImages({ isMountedRef, setPendingImages }, fileList){
	const files = Array.from(fileList || []).filter((f)=>f && /^image\//.test(f.type || ''));
	if(!files.length){
		return;
	}
	// 10MB / 张 上限：base64 编码膨胀 ~33%、conversation message 持久化进 IndexedDB 太大会卡。
	const MAX_BYTES = 10 * 1024 * 1024;
	const oversize = files.filter((f)=>f.size > MAX_BYTES);
	if(oversize.length){
		message.warning(`${oversize.length} 张图片超过 10MB，已跳过`);
	}
	const accepted = files.filter((f)=>f.size <= MAX_BYTES);
	accepted.forEach((file)=>{
		const reader = new FileReader();
		reader.onload = ()=>{
			if(!isMountedRef.current) return;
			const url = `${reader.result || ''}`;
			if(url){
				setPendingImages((prev)=>prev.concat({ url, name: file.name || 'image' }));
			}
		};
		reader.onerror = ()=>{ if(isMountedRef.current){ message.error(`图片读取失败：${file.name || '未知'}`); } };
		reader.onabort = ()=>{ /* 静默 */ };
		try{ reader.readAsDataURL(file); }catch(e){ if(isMountedRef.current){ message.error(`图片读取失败：${(e && e.message) || ''}`); } }
	});
}

// v1.21: 点击落地页建议问题 chip。软件类→注入帮助文档后自动发送；命/事类未挂载→弹框引导挂载；其余→正常发送。
export function handleExampleClick({ handleSend, activeSource, setPrompt }, txt){
	const { category, helpKey } = classifyQuestion(txt);
	if(category === 'software'){
		handleSend(txt, buildSoftwareHelpContext(helpKey));
		return;
	}
	if(category === 'case-required' && !activeSource && !isAgentEnabledForSendGuard()){
		setPrompt(txt);
		AntdModal.info({
			title: '需要先挂载案例',
			// 案例选择器在**顶栏**(右组),本页从来没有左栏 —— 旧文案指向一个不存在的位置
			content: '分析某个具体的命主 / 事件，需要先挂载对应案例：① 在顶栏「选择案例」里选已保存的命盘；② 或到 八字 / 紫微 等 tab 起盘后用顶栏「新命盘」旁菜单的「存为命盘」，再回到这里在顶栏选它。挂载后 AI 才能拿到精确的盘面数据来分析。',
			okText: '我知道了',
		});
		return;
	}
	handleSend(txt);
}

// 一条 assistant 消息里「已完成且未撤销」的写入动作条数(0=纯问答,无需提示)
export function countUndoableActions(msg){
	const t = msg && msg.agentTrace;
	if(!t || !Array.isArray(t.rounds)){ return 0; }
	let n = 0;
	t.rounds.forEach((r)=>{
		(r && Array.isArray(r.results) ? r.results : []).forEach((x)=>{
			if(x && x.status === 'completed' && x.undo && x.undo.actionId && !x.undone){ n += 1; }
		});
	});
	return n;
}

export async function handleRegenerateLastReply({
	modelSelection, activeConversation, providerProfiles, sending, sendingRef, countUndoableActions,
	setMessages, setSending, beginSendAbort, buildResolvedPrompt, prepAborted, updateConversationMeta,
	streamReply, chatAssist,
}){
	const { profileId, model } = parseModelSelection(modelSelection || encodeModelSelection(activeConversation && activeConversation.providerProfileId, activeConversation && activeConversation.model));
	const profile = providerProfiles.find((item)=>item.id === profileId);
	if(!activeConversation || !profile || !model){
		message.warning('请先选择一段对话和模型');
		return;
	}
	// 重入闸在删任何消息之前就占(与 handleSend 同形):此前删掉末条回复之后才查,读库的这几毫秒里回车发送了新问题 →
	// 回答被删了、重答这一路却在闸前静默退出。占了闸之后的每条早退都由外层 finally 复位
	if(sending || sendingRef.current){ return; }
	sendingRef.current = true;
	try{
		const list = await listConversationMessages(activeConversation.id);
		let trimmedList = list.slice(0);
		if(trimmedList.length && trimmedList[trimmedList.length - 1].role === 'assistant'){
			// 被删的回复若带已完成的写入动作:删掉气泡后那几条动作的「撤销」入口就没了
			//   (账本面板仍能撤,但用户在气泡上找不到)。重生成本身不撤销任何动作 → 先说清楚再删。
			const pending = countUndoableActions(trimmedList[trimmedList.length - 1]);
			if(pending > 0){
				const go = await asyncConfirm({
					title: '这条回复里有已执行的动作',
					content: `该回复执行了 ${pending} 个可撤销的写入动作。重新生成只会删掉这条回复,**不会**撤销这些动作(仍可在「动作账本」里逐条撤销)。继续?`,
					okText: '继续重新生成',
					cancelText: '取消',
				});
				if(!go){ return; }
			}
			const removed = trimmedList.pop();
			await deleteStoreRecord(AI_ANALYSIS_STORES.messages, removed.id);
			setMessages(trimmedList);
		}
		const lastUser = [...trimmedList].reverse().find((item)=>item.role === 'user');
		if(!lastUser){
			message.warning('没有可重新生成的用户提问');
			return;
		}
		if(isInsideCompactRegion(activeConversation, lastUser)){ return; }
		setSending(true);
		const regenAbort = beginSendAbort();
		try{
			const promptResult = await buildResolvedPrompt(lastUser.content || '', profile, lastUser.extraSystemContext, lastUser.turn);   // 还原附加上下文;本轮请求同还原
			if(prepAborted(regenAbort)){ return; }
			// 重答用的是**当前**选的接口/模型,会话记录却还写着原来那套 —— 顶栏与历史列表显示的
			// 「这条对话用的模型」和实际所发不一致(与 Q-036 编辑并分支同一类)。差了才写,没换=零写入。
			let regenConversation = activeConversation;
			if(activeConversation && (activeConversation.model !== model || activeConversation.providerProfileId !== (profile ? profile.id : ''))){
				regenConversation = await updateConversationMeta(activeConversation, {
					providerProfileId: profile ? profile.id : '',
					providerName: profile ? profile.name : '',
					providerType: profile ? profile.providerType : '',
					model,
				}) || activeConversation;
			}
			await streamReply({
				conversation: regenConversation,
				profile,
				model,
				controller: regenAbort,
				chatMessages: [
					{ role: 'system', content: promptResult.systemPrompt },
				].concat(chatAssist.mainline(trimmedList).map((item)=>({
					role: item.role,
					content: historyContentOf(item),   // 历史只带采用稿
					// 与首发路径同形:重生成/编辑分支曾丢 images → 多模态输入被静默剥离,
					// 模型对着空文本谈图(用户只觉得「重答就变傻」)。
					images: Array.isArray(item.images) && item.images.length ? item.images : undefined,
					agentTrace: item.agentTrace,
				}))),
			});
		}catch(e){
			console.error(e);
			message.error('重新生成失败');
		}finally{
			setSending(false);
		}
	}finally{
		sendingRef.current = false;
	}
}

// A: 重新生成「任意一条」AI 回复——删除该条及其之后的所有消息,以它之前最近的用户提问重答。
// (不能像 handleRegenerateLastReply 那样硬 pop 末条,否则点中间某条会误删真正的末条。)
export async function handleRegenerateMessage({
	modelSelection, activeConversation, providerProfiles, sending, sendingRef, messages, setMessages,
	setSending, beginSendAbort, buildResolvedPrompt, prepAborted, streamReply, chatAssist,
}, targetMessage){
	if(!targetMessage || targetMessage.role !== 'assistant'){ return; }
	const { profileId, model } = parseModelSelection(modelSelection || encodeModelSelection(activeConversation && activeConversation.providerProfileId, activeConversation && activeConversation.model));
	const profile = providerProfiles.find((item)=>item.id === profileId);
	if(!activeConversation || !profile || !model){
		message.warning('请先选择一段对话和模型');
		return;
	}
	// 重入闸在删任何消息之前就占(与 handleSend 同形):此前删掉末条回复之后才查,读库的这几毫秒里回车发送了新问题 →
	// 回答被删了、重答这一路却在闸前静默退出。占了闸之后的每条早退都由外层 finally 复位
	if(sending || sendingRef.current){ return; }
	sendingRef.current = true;
	try{
		const list = await listConversationMessages(activeConversation.id);
		const idx = list.findIndex((item)=>item.id === targetMessage.id);
		if(idx < 0){ return; }
		const keep = list.slice(0, idx);
		const removeList = list.slice(idx);
		await Promise.all(removeList.map((m)=>deleteStoreRecord(AI_ANALYSIS_STORES.messages, m.id)));
		// 重答删掉「按审阅重写稿」后,原回答的 supersededBy 曾悬空(主线继续过滤它、批注仍写「见下方新回答」)→ 指向已删消息的标记一并清掉
		try{
			const removedIds = new Set(removeList.map((m)=>m.id));
			const dangling = (messages || []).filter((m)=>m && m.supersededBy && removedIds.has(m.supersededBy) && !removedIds.has(m.id));
			for(const dm of dangling){
				// eslint-disable-next-line no-await-in-loop
				await updateStoreRecordIf(AI_ANALYSIS_STORES.messages, dm.id, ()=>true, (rec)=>({ ...rec, supersededBy: undefined }));
			}
			if(dangling.length){ setMessages((prev)=>prev.map((m)=>(m && m.supersededBy && removedIds.has(m.supersededBy) ? { ...m, supersededBy: undefined } : m))); }
		}catch(e){ /* 清标记失败不阻断重答 */ }
		setMessages(keep);
		const lastUser = [...keep].reverse().find((item)=>item.role === 'user');
		if(!lastUser){
			message.warning('没有可重新生成的用户提问');
			return;
		}
		if(isInsideCompactRegion(activeConversation, lastUser)){ return; }
		setSending(true);
		const retryAbort = beginSendAbort();
		try{
			const promptResult = await buildResolvedPrompt(lastUser.content || '', profile, lastUser.extraSystemContext, lastUser.turn);
			if(prepAborted(retryAbort)){ return; }
			await streamReply({
				conversation: activeConversation,
				profile,
				model,
				controller: retryAbort,
				chatMessages: [
					{ role: 'system', content: promptResult.systemPrompt },
				].concat(chatAssist.mainline(keep).map((item)=>({
					role: item.role,
					content: historyContentOf(item),   // 历史只带采用稿
					// 与首发路径同形:重生成/编辑分支曾丢 images → 多模态输入被静默剥离,
					// 模型对着空文本谈图(用户只觉得「重答就变傻」)。
					images: Array.isArray(item.images) && item.images.length ? item.images : undefined,
					agentTrace: item.agentTrace,
				}))),
			});
		}catch(e){
			console.error(e);
			message.error('重新生成失败');
		}finally{
			setSending(false);
		}
	}finally{
		sendingRef.current = false;
	}
}

// B3:把「起课时间 / 命盘时间」快速草稿保存为正式 事盘 / 命盘(进案例列表复用),保存后自动选中。
export function handleSaveQuickDraftAsSource({ selectedSourceId, natalDraft, timepointDraft, setSources, setSelectedSourceId }){
	const isNatal = selectedSourceId === NATAL_SOURCE_ID;
	const draft = isNatal ? natalDraft : timepointDraft;
	try{
		let saved;
		if(isNatal){
			// 按「此刻点新命盘会用的设置」随盘记下(新盘种子 + 古典全局 + 你自己的紫微设置)并打代次标记,与页面新建一致
			saved = upsertLocalChart(withNewChartDefaults({
				name: draft.name || '命盘时间',
				birth: draft.birth,
				zone: draft.zone,
				lat: draft.lat,
				lon: draft.lon,
				gpsLat: draft.gpsLat,
				gpsLon: draft.gpsLon,
				gender: draft.gender,
			}, { forStore: true }));
		}else{
			saved = upsertLocalCase({
				event: draft.name || '起课时间',
				divTime: draft.divTime,
				zone: draft.zone,
				lat: draft.lat,
				lon: draft.lon,
				gpsLat: draft.gpsLat,
				gpsLon: draft.gpsLon,
				sourceModule: 'sanshiunited',
			});
		}
		setSources(listAnalysisSources());
		if(saved && saved.cid){
			setSelectedSourceId(saved.cid);
		}
		toastRecordWrite(message, isNatal ? 'chart' : 'case', isNatal ? '已保存为命盘并选中' : '已保存为事盘并选中');
	}catch(e){
		console.error(e);
		message.error('保存失败：本地存储空间不足，请先导出清理后重试');
	}
}

// 编辑「指定」用户消息并基于此创建分支（2D：任意用户消息可编辑重发，不止最后一条）。
export async function handleEditMessageAndBranch({
	activeConversation, modelSelection, providerProfiles, sending, sendingRef, setConversations,
	openConversation, setSending, beginSendAbort, buildResolvedPrompt, prepAborted, streamReply,
	chatAssist,
}, targetMessage){
	if(!activeConversation){
		message.warning('请先打开一段对话');
		return;
	}
	if(!targetMessage || targetMessage.role !== 'user'){
		return;
	}
	const list = await listConversationMessages(activeConversation.id);
	const targetIndex = list.findIndex((item)=>item.id === targetMessage.id);
	if(targetIndex < 0){
		message.warning('没有找到该用户消息');
		return;
	}
	const targetUser = list[targetIndex];
	const nextText = await asyncInput({ title: '编辑该用户消息并基于此分支', defaultValue: targetUser.content || '', placeholder: '修改后回车发送，或点确定', multiline: true });
	if(nextText === null){
		return;
	}
	const trimmed = `${nextText || ''}`.trim();
	if(!trimmed){
		return;
	}
	const { profileId, model } = parseModelSelection(modelSelection || encodeModelSelection(activeConversation.providerProfileId, activeConversation.model));
	const profile = providerProfiles.find((item)=>item.id === profileId);
	if(!profile || !model){
		message.warning('请先选择模型');
		return;
	}
	// 重入闸在建分支 / 写消息之前就占(与 handleSend 同形),占了之后的每条早退都在 finally 里复位
	if(sending || sendingRef.current){ message.warning('正在生成中,请稍后再分支'); return; }
	sendingRef.current = true;
	try{
		const branchConversation = await putStoreRecord(AI_ANALYSIS_STORES.conversations, {
			...activeConversation,
			// 分支按分支点裁压缩:分支点(被编辑的问题)在压缩区内 → 分支不继承 compact(否则主线把编辑后的问题滤掉,请求无 user 消息)
			...(compactCoversMessage(activeConversation.compact, targetUser) ? { compact: undefined } : {}),
			// 分支会话记录写**本次实际所用**的接口/模型:此前继承原会话记录,而请求用的是当前选择 →
			//   openConversation 把界面改回原会话模型 = 「所见≠所发」(用户以为换了模型重问,顶栏显示的却是旧模型)。
			providerProfileId: profile.id,
			providerName: profile.name || '',
			providerType: profile.providerType,
			model,
			id: null,
			title: `${activeConversation.title || '未命名对话'}（分支）`,
			parentConversationId: activeConversation.id,
			branchRootId: activeConversation.branchRootId || activeConversation.id,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		}, 'conv');
		// 🔴 前缀消息必须 id:null(与「分支」同形):沿用原 id 会被 IDB 同键覆盖搬进分支,原会话只剩编辑点之后的消息(M-34)
		const branchMessages = buildEditBranchMessages(list, targetIndex, targetUser, trimmed, branchConversation.id);
		await replaceConversationMessages(branchConversation.id, branchMessages);
		setConversations((prev)=>sortByUpdatedDesc([branchConversation].concat(prev)));
		await openConversation(branchConversation);
		setSending(true);
		const branchAbort = beginSendAbort();
		try{
			const promptResult = await buildResolvedPrompt(trimmed, profile, targetUser.extraSystemContext, targetUser.turn);
			if(prepAborted(branchAbort)){ return; }
			await streamReply({
				conversation: branchConversation,
				profile,
				model,
				controller: branchAbort,
				chatMessages: [
					{ role: 'system', content: promptResult.systemPrompt },
				].concat(chatAssist.mainline(branchMessages).map((item)=>({
					role: item.role,
					content: historyContentOf(item),   // 历史只带采用稿
					// 与首发路径同形:重生成/编辑分支曾丢 images → 多模态输入被静默剥离,
					// 模型对着空文本谈图(用户只觉得「重答就变傻」)。
					images: Array.isArray(item.images) && item.images.length ? item.images : undefined,
					agentTrace: item.agentTrace,
				}))),
			});
			message.success('已基于编辑创建分支对话');
		}catch(e){
			message.error('分支对话生成失败');
		}finally{
			setSending(false);
		}
	}finally{
		sendingRef.current = false;
	}
}

// 「编辑上一条并分支」工具条入口：定位最后一条用户消息，委托给 handleEditMessageAndBranch。
export async function handleEditLastUserAndBranch({ activeConversation, handleEditMessageAndBranch }){
	if(!activeConversation){
		message.warning('请先打开一段对话');
		return;
	}
	const list = await listConversationMessages(activeConversation.id);
	let lastUser = null;
	for(let i=list.length - 1; i>=0; i--){
		if(list[i].role === 'user'){
			lastUser = list[i];
			break;
		}
	}
	if(!lastUser){
		message.warning('没有找到上一条用户消息');
		return;
	}
	await handleEditMessageAndBranch(lastUser);
}
