// AI 分析页 · 模板 / 组合 / 模型服务:编辑与保存、删除、版本回滚、设为当前、连通诊断与试聊
// 从 AIAnalysisMain.js 按职责拆出的 AIAnalysisMain 内层函数 / Hook 回调体 / 渲染树片段:原文原样,用到的局部名字经第一个参数显式传入;
// 门面原位置换成调用它的包装 / 箭头 / 表达式,调用那一刻取值传入(与闭包读到的是同一份)。读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { message } from 'antd';
import { syncSkillTechniqueKeys } from '../../../utils/aiChat/skills';
import { AI_ANALYSIS_STORES, deleteStoreRecord, deleteWhere, putStoreRecord } from '../../../utils/aiAnalysisStore';
import { diagnoseProvider, requestAIAnalysisChat } from '../../../services/aianalysis';
import { getProviderDefaultChatModels, getProviderDisplayName, getProviderPreset, getProviderProtocolFamily, encodeModelSelection, parseModelSelection, cleanProviderBaseUrl } from '../../../utils/aiAnalysisProviders';
import { uniqueTextList, safeParseJson, ensureServiceResponse, normalizeProviderResultModels, buildProviderOptionsFromForm, normalizeProfileModels, normalizeProfileChatModels, sortByUpdatedDesc } from './providerForm';
import { classifyStreamError } from './chatHelpers';
import { buildTemplateVersionSnapshot } from './templates';

export function openTemplateEditor({ setEditingTemplate, templateForm, setTemplateModalOpen }, template){
	setEditingTemplate(template || null);
	templateForm.setFieldsValue({
		name: template ? template.name : '',
		format: template ? template.format : 'text',
		instructionText: template ? (template.instructionText || template.content || '') : '',
		jsonSchema: template ? (template.jsonSchema || template.content || '{\n  \"type\": \"object\"\n}') : '{\n  \"type\": \"object\"\n}',
		exampleInput: template ? (template.exampleInput || '{\n  \"user_prompt\": \"请分析这个案例\"\n}') : '{\n  \"user_prompt\": \"请分析这个案例\"\n}',
		exampleOutput: template ? (template.exampleOutput || '{\n  \"summary\": \"示例输出\"\n}') : '{\n  \"summary\": \"示例输出\"\n}',
	});
	setTemplateModalOpen(true);
}

export async function saveTemplateForm({
	templateForm, editingTemplate, templateVersions, setTemplates, setTemplateVersions,
	setTemplateModalOpen, setEditingTemplate,
}){
	const values = await templateForm.validateFields();
	const snapshot = buildTemplateVersionSnapshot(values);
	if(values.format === 'json' && !safeParseJson(values.jsonSchema, null)){
		message.error('JSON Schema 解析失败');
		return;
	}
	const current = editingTemplate || {};
	let saved = await putStoreRecord(AI_ANALYSIS_STORES.templates, {
		...current,
		/* 用户编辑路径显式刷新更新时间(putStoreRecord 见入参带 updatedAt 即沿用旧值 → 编辑完排序不动、时间不变) */ updatedAt: new Date().toISOString(),
		name: values.name,
		format: values.format,
		instructionText: values.instructionText || '',
		jsonSchema: values.jsonSchema || '',
		exampleInput: values.exampleInput || '',
		exampleOutput: values.exampleOutput || '',
		content: values.format === 'text' ? (values.instructionText || '') : (values.jsonSchema || ''),
	}, 'template');
	const versions = templateVersions.filter((item)=>item.templateId === saved.id);
	// ① 内容一个字没改就别留版(此前每点一次保存都攒一条,版本列表被无意义的副本淹掉);
	//                ② 版本号取库内最大值 + 1(此前用 versions.length + 1:删过旧版本就会撞号)。
	const latest = versions.slice().sort((a, b)=>(Number(b.versionNumber) || 0) - (Number(a.versionNumber) || 0))[0] || null;
	const unchanged = latest && latest.snapshot && JSON.stringify(latest.snapshot) === JSON.stringify(snapshot);
	let version = latest;
	if(!unchanged){
		const maxNo = versions.reduce((mx, item)=>Math.max(mx, Number(item.versionNumber) || 0), 0);
		version = await putStoreRecord(AI_ANALYSIS_STORES.templateVersions, {
			templateId: saved.id,
			versionNumber: maxNo + 1,
			snapshot,
		}, 'tplver');
	}
	saved = await putStoreRecord(AI_ANALYSIS_STORES.templates, {
		...saved,
		activeVersionId: version ? version.id : (saved.activeVersionId || null),
		updatedAt: new Date().toISOString(),
	}, 'template');
	setTemplates((prev)=>sortByUpdatedDesc(prev.some((item)=>item.id === saved.id) ? prev.map((item)=>item.id === saved.id ? saved : item) : [saved].concat(prev)));
	if(version && !unchanged){
		setTemplateVersions((prev)=>sortByUpdatedDesc([version].concat(prev.filter((item)=>item.id !== version.id))));
	}
	setTemplateModalOpen(false);
	setEditingTemplate(null);
	message.success(unchanged ? '模版已保存（内容未变，未新增版本）' : '模版已保存');
}

export async function deleteTemplate({
	setTemplates, setTemplateVersions, setReferenceIds, pruneConversationRefs, pruneBundleRefs,
}, templateId){
	await deleteStoreRecord(AI_ANALYSIS_STORES.templates, templateId);
	await deleteWhere(AI_ANALYSIS_STORES.templateVersions, (item)=>item.templateId === templateId, { index: 'templateId', value: templateId });
	setTemplates((prev)=>prev.filter((item)=>item.id !== templateId));
	setTemplateVersions((prev)=>prev.filter((item)=>item.templateId !== templateId));
	setReferenceIds((prev)=>prev.filter((item)=>item !== `template:${templateId}`));   // 本轮挂载里的引用同清
	await pruneConversationRefs(`template:${templateId}`);
	const cleaned = await pruneBundleRefs({ templateId });
	message.success(cleaned ? `模版已删除（同时从 ${cleaned} 个组合里移除）` : '模版已删除');
}

// 回滚三修:
//  ① 回滚本身**写一条新版本**(注「回滚自 Vn」)—— 此前直接改模版、不留痕,回滚之前的那份内容就此消失、无法再回去;
//  ② activeVersionId 指向新写的这条(而不是被回滚的旧版),「当前版」标记才对得上;
//  ③ **不回退名称**:名字是模版的身份,用户改了名再回滚正文,不该连名字一起倒退。
export async function rollbackTemplateVersion({ templateVersions, setTemplates, setTemplateVersions }, template, version){
	const snapshot = version && version.snapshot ? version.snapshot : null;
	if(!snapshot){
		return;
	}
	const keepName = `${(template && template.name) || snapshot.name || ''}`;
	const restored = { ...snapshot, name: keepName };
	const versions = templateVersions.filter((item)=>item.templateId === template.id);
	const maxNo = versions.reduce((mx, item)=>Math.max(mx, Number(item.versionNumber) || 0), 0);
	const newVersion = await putStoreRecord(AI_ANALYSIS_STORES.templateVersions, {
		templateId: template.id,
		versionNumber: maxNo + 1,
		rolledBackFrom: version.versionNumber == null ? null : Number(version.versionNumber),
		note: `回滚自 V${version.versionNumber == null ? '?' : version.versionNumber}`,
		snapshot: restored,
	}, 'tplver');
	const saved = await putStoreRecord(AI_ANALYSIS_STORES.templates, {
		...template,
		...restored,
		activeVersionId: newVersion.id,
		content: restored.content || (restored.format === 'json' ? restored.jsonSchema : restored.instructionText),
		/* 用户编辑路径显式刷新更新时间 */ updatedAt: new Date().toISOString(),
	}, 'template');
	setTemplates((prev)=>sortByUpdatedDesc(prev.map((item)=>item.id === saved.id ? saved : item)));
	setTemplateVersions((prev)=>sortByUpdatedDesc([newVersion].concat(prev.filter((item)=>item.id !== newVersion.id))));
	message.success(`模版已回滚到 V${version.versionNumber == null ? '?' : version.versionNumber}（另存为 V${newVersion.versionNumber}）`);
}

export function openBundleEditor({ setEditingBundle, bundleForm, setBundleModalOpen }, bundle){
	setEditingBundle(bundle || null);
	bundleForm.setFieldsValue({
		name: bundle ? bundle.name : '',
		templateId: bundle ? bundle.templateId : undefined,
		materialIds: bundle ? (bundle.defaultMaterialIds && bundle.defaultMaterialIds.length ? bundle.defaultMaterialIds : (bundle.materialIds || [])) : [],
		defaultModelSelection: bundle && bundle.defaultProviderProfileId && bundle.defaultModel
			? encodeModelSelection(bundle.defaultProviderProfileId, bundle.defaultModel)
			: undefined,
		defaultEmbeddingModel: bundle ? bundle.defaultEmbeddingModel : '',
		defaultSystemPrompt: bundle ? bundle.defaultSystemPrompt : '',
		defaultRetrievalMode: bundle ? bundle.defaultRetrievalMode || 'auto' : 'auto',
		defaultTechniqueKeys: bundle ? (bundle.defaultTechniqueKeys || []) : [],
		defaultChatTemperature: bundle && bundle.defaultChatTemperature != null ? bundle.defaultChatTemperature : null,
		defaultChatTopP: bundle && bundle.defaultChatTopP != null ? bundle.defaultChatTopP : null,
		defaultThinkingLevel: bundle ? (bundle.defaultThinkingLevel || '') : '',
	});
	setBundleModalOpen(true);
}

export async function saveBundleForm({ bundleForm, editingBundle, setBundles, setBundleModalOpen, setEditingBundle }){
	const values = await bundleForm.validateFields();
	const parsed = parseModelSelection(values.defaultModelSelection || '');
	// 技能包组合:这里改的技法同步写入 skill.techniqueKeys(升版 + 留档);此前只写 defaultTechniqueKeys → 用技能时仍挂旧技法
	const skillSync = syncSkillTechniqueKeys(editingBundle, values.defaultTechniqueKeys || []);
	const saved = await putStoreRecord(AI_ANALYSIS_STORES.bundles, {
		...(editingBundle || {}),
		...skillSync,
		/* 用户编辑路径显式刷新更新时间(putStoreRecord 见入参带 updatedAt 即沿用旧值 → 编辑完排序不动、时间不变) */ updatedAt: new Date().toISOString(),
		name: values.name,
		templateId: values.templateId || null,
		materialIds: values.materialIds || [],
		defaultMaterialIds: values.materialIds || [],
		defaultProviderProfileId: parsed.profileId || null,
		defaultModel: parsed.model || null,
		defaultEmbeddingModel: values.defaultEmbeddingModel || null,
		defaultSystemPrompt: values.defaultSystemPrompt || '',
		defaultRetrievalMode: values.defaultRetrievalMode || 'auto',
		defaultTechniqueKeys: values.defaultTechniqueKeys || [],
		defaultChatTemperature: (values.defaultChatTemperature === undefined || values.defaultChatTemperature === null || values.defaultChatTemperature === '') ? null : values.defaultChatTemperature,
		defaultChatTopP: (values.defaultChatTopP === undefined || values.defaultChatTopP === null || values.defaultChatTopP === '') ? null : values.defaultChatTopP,
		defaultThinkingLevel: values.defaultThinkingLevel || '',
	}, 'bundle');
	setBundles((prev)=>sortByUpdatedDesc(prev.some((item)=>item.id === saved.id) ? prev.map((item)=>item.id === saved.id ? saved : item) : [saved].concat(prev)));
	setBundleModalOpen(false);
	setEditingBundle(null);
	message.success(skillSync.skill ? `组合已保存（技能「${saved.name}」技法已同步，v${skillSync.skill.version}）` : '组合已保存');
}

export async function saveProviderForm({
	providerForm, editingProvider, setProviderProfiles, setProviderModalOpen, setProviderAdvancedOpen,
	setEditingProvider, fetchModelsAndEmbeddings,
}){
	const checkedValues = await providerForm.validateFields();
	const values = {
		...providerForm.getFieldsValue(true),
		...checkedValues,
	};
	const providerType = values.providerType || 'openai';
	const preset = getProviderPreset(providerType);
	const providerOptions = buildProviderOptionsFromForm(values);
	const manualModels = uniqueTextList(`${values.manualModels || ''}`.split(/[\n,，]/g)).length
		? uniqueTextList(`${values.manualModels || ''}`.split(/[\n,，]/g))
		: getProviderDefaultChatModels(providerType);
	// Embedding 列表允许为空:此前空表单回填预设(OpenAI / Gemini / Ollama 预设非空)
	// ⇒ 一个档案不可能「没有嵌入模型」,向量检索关不掉。清空即当真。
	const embeddingModels = uniqueTextList(`${values.embeddingModels || ''}`.split(/[\n,，]/g));
	// 保存**以表单行为准**:此前把旧 availableModels(拉取结果)与表单行合并重算,
	// 用户从「聊天模型列表」删掉的 dall-e / tts 类模型每次保存都被加回来 —— 删行永远无效。
	// 表单里本来就显示着全部拉取结果(buildProviderFormValues 用 normalizeProfileModels 拼的),
	// 所以只按表单重写不会丢任何用户想留的模型。
	const normalized = normalizeProviderResultModels({
		models: [].concat(manualModels).concat(embeddingModels),
	}, providerType, true);
	const diagnosticsStillValid = !!(editingProvider && editingProvider.healthStatus
		&& `${editingProvider.apiKey || ''}`.trim() === `${values.apiKey || ''}`.trim()
		&& (`${editingProvider.baseUrl || ''}`.trim() || preset.baseUrl) === (`${values.baseUrl || ''}`.trim() || preset.baseUrl)
		&& editingProvider.providerType === providerType);
	const saved = await putStoreRecord(AI_ANALYSIS_STORES.providerProfiles, {
		...(editingProvider || {}),
		/* 用户编辑路径显式刷新更新时间(putStoreRecord 见入参带 updatedAt 即沿用旧值 → 编辑完排序不动、时间不变) */ updatedAt: new Date().toISOString(),
		name: `${values.name || ''}`.trim() || preset.label,
		providerType,
		protocolFamily: getProviderProtocolFamily(providerType),
		apiKey: `${values.apiKey || ''}`.trim(),
		baseUrl: cleanProviderBaseUrl(values.baseUrl) || preset.baseUrl,
		manualModels,
		chatModelIds: normalized.chatModels,
		// 清空过的嵌入列表要真的空;normalizeProviderResultModels 的预设兜底只对「聊天模型」有意义
		embeddingModelIds: embeddingModels.length ? normalized.embeddingModels : [],
		availableModels: normalized.models,
		enabled: values.enabled !== false,
		providerOptions,
		// apiKey / baseUrl / 接口类型任一改动 → 历史诊断作废置 unknown(此前绿标残留到改错的 Key 上)
		healthStatus: diagnosticsStillValid ? editingProvider.healthStatus : 'unknown',
		// 同判据清 lastDiagnostics:此前 ...editingProvider 整体沿用,改成不可达地址后卡片仍显示旧地址的 DNS/TCP/HTTP 全 OK
		lastDiagnostics: diagnosticsStillValid ? (editingProvider.lastDiagnostics || null) : null,
	}, 'provider');
	setProviderProfiles((prev)=>sortByUpdatedDesc(prev.some((item)=>item.id === saved.id) ? prev.map((item)=>item.id === saved.id ? saved : item) : [saved].concat(prev)));
	setProviderModalOpen(false);
	setProviderAdvancedOpen(false);
	const wasNewProvider = !editingProvider || !editingProvider.id;
	setEditingProvider(null);
	message.success('接口配置已保存');
	// 新建接口后自动拉取模型列表（仅新建；编辑沿用既有列表，避免覆盖手填）。非阻塞、内部已 try/catch。
	// 条件曾是 apiKey || baseUrl(Base URL 空则回填预设 → 恒真):不填 Key 时后端不发鉴权头、上游必 401/400,
	//   「已保存」后紧跟「拉取模型列表失败」。改为有 Key 才自动拉(ollama 本地无 Key 仍自动拉;鉴权头写在额外请求头时亦自动拉)。
	const hasAuth = !!(`${saved.apiKey || ''}`.trim() || saved.providerType === 'ollama'
		|| Object.keys((saved.providerOptions && saved.providerOptions.extraHeaders) || {}).length);
	if(wasNewProvider && hasAuth){
		fetchModelsAndEmbeddings(saved);
	}
}

export async function deleteProvider({
	providerProfiles, setProviderProfiles, modelSelection, setModelSelection, pruneBundleRefs,
}, profileId){
	await deleteStoreRecord(AI_ANALYSIS_STORES.providerProfiles, profileId);
	const remaining = providerProfiles.filter((item)=>item.id !== profileId);
	setProviderProfiles(remaining);
	if(parseModelSelection(modelSelection).profileId === profileId){
		const next = remaining.find((item)=>item.enabled !== false) || remaining[0] || null;
		setModelSelection(next ? encodeModelSelection(next.id, normalizeProfileModels(next)[0] || '') : '');
	}
	const cleaned = await pruneBundleRefs({ providerProfileId: profileId });
	message.success(cleaned ? `接口配置已删除（同时清掉 ${cleaned} 个组合里的默认接口）` : '接口配置已删除');
}

export function setProviderAsCurrent({ setModelSelection, setProviderSwitchModalOpen }, profile){
	if(!profile){
		return;
	}
	// 未启用档案不进模型下拉(modelOptions 过滤 enabled===false)→ 此前照样提示「已切换」,
	//   而 Select 的值不在选项里,下一拍就被改回 = 提示与实际互斥。现改为拦下并指路。
	if(profile.enabled === false){
		message.warning(`「${profile.name || getProviderDisplayName(profile.providerType)}」未启用,不能设为当前;请先点「编辑」把「启用」打开`);
		return;
	}
	// 首模型取**聊天**模型(此前 normalizeProfileModels 含嵌入模型 → 可能选中一个不能聊天的模型)
	const models = normalizeProfileChatModels(profile);
	setModelSelection(encodeModelSelection(profile.id, models[0] || ''));
	setProviderSwitchModalOpen(false);
	message.success(`已切换到「${profile.name || getProviderDisplayName(profile.providerType)}」${models.length ? '' : '（该配置暂无对话模型，请先在编辑里补全）'}`);
}

export async function runProviderDiagnostics({ setProviderProfiles }, profile){
	try{
		const rsp = ensureServiceResponse(await diagnoseProvider({
			providerType: profile.providerType,
			apiKey: profile.apiKey,
			baseUrl: profile.baseUrl,
			providerOptions: profile.providerOptions || {},
		}), '连接诊断失败');
		const diagnostics = rsp && rsp.Result ? rsp.Result : null;
		const saved = await putStoreRecord(AI_ANALYSIS_STORES.providerProfiles, {
			...profile,
			updatedAt: new Date().toISOString(),
			lastDiagnostics: diagnostics,
			healthStatus: diagnostics && diagnostics.healthy ? 'healthy' : 'error',
		}, 'provider');
		setProviderProfiles((prev)=>sortByUpdatedDesc(prev.map((item)=>item.id === saved.id ? saved : item)));
		if(diagnostics && diagnostics.healthy){
			message.success(`连接测试成功${diagnostics.latencyMs ? ` · ${diagnostics.latencyMs}ms` : ''}`);
		}else{
			message.warning(`连接测试完成：${diagnostics && (diagnostics.failureReason || diagnostics.errorDetail || '请检查配置')}`);
		}
	}catch(e){
		message.error(e && e.message ? `连接诊断失败：${e.message}` : '连接诊断失败');
	}
}

export async function testProfileChat({ setConnState }, profile, preferredModel){
	const chatModels = normalizeProfileChatModels(profile);
	const model = `${preferredModel || ''}`.trim() || chatModels[0] || '';
	if(!model){
		message.warning('该配置还没有可用的对话模型，请在「配置 API」→「聊天模型列表」中填写（如 gemini-2.5-flash），或点「拉取模型」自动获取');
		return;
	}
	// 指纹取**被测的**接口::模型(此前取当前选择 modelSelection → 在接口列表里测 B,
	// chip 却按当前选择 A 的键落绿/落红 = 显示「A 测试成功」而实际测的是 B)。renderConnChip 仍只在
	// 指纹 === 当前选择时显示,故测别的接口不再污染当前 chip。
	const connKey = encodeModelSelection(profile.id, model);
	setConnState({ key: connKey, status: 'testing' });
	const startMs = Date.now();
	try{
		const rsp = ensureServiceResponse(await requestAIAnalysisChat({
			providerType: profile.providerType,
			apiKey: profile.apiKey,
			baseUrl: profile.baseUrl,
			model,
			providerOptions: profile.providerOptions || {},
			messages: [
				{
					role: 'user',
					content: '请仅回复“连接成功”。',
				},
			],
		}), '测试连接失败');
		const text = rsp && rsp.Result && rsp.Result.content ? rsp.Result.content : '';
		const latencyMs = Date.now() - startMs;
		message.success(text ? `测试成功：${text.slice(0, 24)}` : '测试成功');
		setConnState({ key: connKey, status: 'healthy', latencyMs });
	}catch(e){
		// v2.2.1 (Mac #8):后端错误是 URL 编码的原始串,直接抛给用户既看不懂又吓人。
		// 解码 + 对「未登录/未配置凭据」的 401 给出可操作的提示,而不是裸 401 dump。
		let raw = e && e.message ? e.message : '';
		try{ raw = decodeURIComponent(raw); }catch(_){ /* keep raw */ }
		const latencyMs = Date.now() - startMs;
		const classified = classifyStreamError(raw);
		if(/No cookie auth credentials|need\.login|401|Unauthorized/i.test(raw)){
			message.error('未检测到有效凭据：使用内置 AI 需先登录 horosa 账号；若使用自己的供应商，请在「配置 API」中填入正确的 Key 与 Base URL 后重试。');
		}else{
			message.error(raw ? `测试连接失败：${raw.slice(0, 200)}` : '测试连接失败');
		}
		setConnState({ key: connKey, status: 'error', latencyMs, error: { ...classified, raw } });
	}
}
