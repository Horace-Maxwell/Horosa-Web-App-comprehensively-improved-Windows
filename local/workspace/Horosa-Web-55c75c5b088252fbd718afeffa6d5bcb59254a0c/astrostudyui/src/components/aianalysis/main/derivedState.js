// AI 分析页 · 派生状态(useMemo 的计算体):挂载源与对方盘、源选项、技法生效覆盖、模型 / 嵌入选项、当前接口、参数浮层、引用选项、各页签筛选结果、锁定上下文条目
// 从 AIAnalysisMain.js 按职责拆出的 AIAnalysisMain 内层函数 / Hook 回调体 / 渲染树片段:原文原样,用到的局部名字经第一个参数显式传入;
// 门面原位置换成调用它的包装 / 箭头 / 表达式,调用那一刻取值传入(与闭包读到的是同一份)。读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { withNewChartDefaults } from '../../../utils/newChartCapture';
import { buildMaterialSearchText } from '../../../utils/aiAnalysisStore';
import { resolveEffectiveTechniqueOptions } from '../../../utils/techniqueMountSettings';
import { getProviderProtocolFamily, isOpenAiFamily, anthropicThinkingMode, temperatureMaxForFamily, thinkingLevelEffects, isReasoningModel, encodeModelSelection, parseModelSelection } from '../../../utils/aiAnalysisProviders';
import { normalizeProfileModels, normalizeProfileChatModels, normalizeEmbeddingModels, sortByUpdatedDesc, compareByName } from './providerForm';
import { TIMEPOINT_SOURCE_ID, NATAL_SOURCE_ID } from './sourceContext';
import { matchesUserQuery } from '../../../utils/scriptMode';

// AIAnalysisMain 里 useMemo(…) 的回调(门面原位置换成调用它的箭头,依赖数组不变)
export const computeActiveSource = ({ selectedSourceId, timepointDraft, natalDraft, sources })=>{
	if(selectedSourceId === TIMEPOINT_SOURCE_ID){
		// 合成的「起课时间」源（不持久化）：record 仅含时间 + 地点，即可驱动各式法起盘。
		return {
			id: TIMEPOINT_SOURCE_ID,
			sourceType: 'timepoint',
			title: `起课时间 · ${timepointDraft.divTime}`,
			module: 'sanshiunited',
			time: timepointDraft.divTime,
			zone: timepointDraft.zone,
			tags: [],
			snapshotStatus: 'lazy',
			updatedAt: timepointDraft.divTime,
			record: {
				divTime: timepointDraft.divTime,
				zone: timepointDraft.zone,
				lon: timepointDraft.lon,
				lat: timepointDraft.lat,
				gpsLon: timepointDraft.gpsLon,
				gpsLat: timepointDraft.gpsLat,
				gender: timepointDraft.gender,
				sourceModule: '',
			},
		};
	}
	if(selectedSourceId === NATAL_SOURCE_ID){
		// 合成的「命盘时间」源(不持久化):record 含 birth + 地点 → 走命盘技法(八字/紫微/星盘/各推运)即时起盘。
		return {
			id: NATAL_SOURCE_ID,
			sourceType: 'chart',
			title: `命盘时间 · ${natalDraft.birth}`,
			module: 'astrochart',
			time: natalDraft.birth,
			zone: natalDraft.zone,
			tags: [],
			snapshotStatus: 'lazy',
			updatedAt: natalDraft.birth,
			// 按「新命盘」语义带上设置(新盘种子 + 古典全局 + 你自己的紫微设置,打代次标记),与页面「新命盘」排出的一致
			record: withNewChartDefaults({
				birth: natalDraft.birth,
				zone: natalDraft.zone,
				lon: natalDraft.lon,
				lat: natalDraft.lat,
				gpsLon: natalDraft.gpsLon,
				gpsLat: natalDraft.gpsLat,
				gender: natalDraft.gender,
				name: natalDraft.name || '命盘时间',
			}),
		};
	}
	return sources.find((item)=>item.id === selectedSourceId) || null;
};

// AIAnalysisMain 里 useMemo(…) 的回调(门面原位置换成调用它的箭头,依赖数组不变)
export const computePartnerSource = ({ partnerSourceId, activeSource, sources })=>{
	if(!partnerSourceId || !activeSource || activeSource.sourceType !== 'chart'){
		return null;
	}
	const hit = sources.find((item)=>item.id === partnerSourceId);
	return hit && hit.sourceType === 'chart' && hit.id !== activeSource.id ? hit : null;
};

// AIAnalysisMain 里 useMemo(…) 的回调(门面原位置换成调用它的箭头,依赖数组不变)
export const computeSourceOptions = ({ sources })=>{
	const opts = sources.map((item)=>({
		value: item.id,
		label: `${item.sourceType === 'chart' ? '命盘' : '事盘'} · ${item.title}`,
		searchText: `${item.title} ${item.module || ''} ${(item.tags || []).join(' ')}`.toLowerCase(),
		item,
	}));
	opts.unshift({
		value: NATAL_SOURCE_ID,
		label: '🌐 命盘时间（此刻 / 自定义）',
		searchText: '命盘时间 本命 出生 natal 即时起盘',
		item: null,
	});
	opts.unshift({
		value: TIMEPOINT_SOURCE_ID,
		label: '⏱ 起课时间（此刻 / 自定义）',
		searchText: '起课时间 时间盘 占时 此刻 timepoint',
		item: null,
	});
	return opts;
};

// AIAnalysisMain 里 useMemo(…) 的回调(门面原位置换成调用它的箭头,依赖数组不变)
export const computeEffectiveTechniqueOptions = ({ activeTechniqueKeys, activeSource, techniqueOptionOverrides })=>{
	// 会话覆盖锚盘现状再剪(与草稿/应用同锚);同类默认(getMountTechniqueDefault)
	// 是跨盘模板,原样透传,由重算入口按各盘现状终判。
	// 解析逻辑收编到 resolveEffectiveTechniqueOptions(与无头入口同一函数,口径不再分叉)。
	return resolveEffectiveTechniqueOptions(activeTechniqueKeys, {
		record: activeSource && activeSource.record ? activeSource.record : null,
		sessionOverrides: techniqueOptionOverrides,
	});
};

// AIAnalysisMain 里 useMemo(…) 的回调(门面原位置换成调用它的箭头,依赖数组不变)
export const computePartnerEffectiveTechniqueOptions = ({ partnerSource, activeTechniqueKeys, techniqueOptionOverrides })=>{
	if(!partnerSource){
		return {};
	}
	return resolveEffectiveTechniqueOptions(activeTechniqueKeys, {
		record: partnerSource.record || null,
		sessionOverrides: techniqueOptionOverrides,
	});
};

// AIAnalysisMain 里 useMemo(…) 的回调(门面原位置换成调用它的箭头,依赖数组不变)
export const computeModelOptions = ({ providerProfiles })=>{
	const result = [];
	providerProfiles.forEach((profile)=>{
		if(profile.enabled === false){
			return;
		}
		normalizeProfileChatModels(profile).forEach((model)=>{
			result.push({
				value: encodeModelSelection(profile.id, model),
				label: `${profile.name || '未命名配置'} / ${model}`,
			});
		});
	});
	return result;
};

// AIAnalysisMain 里 useMemo(…) 的回调(门面原位置换成调用它的箭头,依赖数组不变)
export const computeEmbeddingOptions = ({ providerProfiles })=>{
	const result = [];
	providerProfiles.forEach((profile)=>{
		if(profile.enabled === false){ return; }
		normalizeEmbeddingModels(profile).forEach((model)=>{
			result.push({
				value: encodeModelSelection(profile.id, model),
				label: `${profile.name || '未命名配置'} / ${model}`,
			});
		});
	});
	return result;
};

// AIAnalysisMain 里 useMemo(…) 的回调(门面原位置换成调用它的箭头,依赖数组不变)
export const computeActiveProviderProfile = ({ modelSelection, providerProfiles })=>{
	const parsed = parseModelSelection(modelSelection);
	if(parsed.profileId){
		const selectedProfile = providerProfiles.find((item)=>item.id === parsed.profileId && item.enabled !== false);
		if(selectedProfile){
			return selectedProfile;
		}
	}
	return providerProfiles.find((item)=>item.enabled !== false) || null;
};

// AIAnalysisMain 里 useMemo(…) 的回调(门面原位置换成调用它的箭头,依赖数组不变)
export const computeParamPopover = ({ modelSelection, activeProviderProfile })=>{
	const model = parseModelSelection(modelSelection).model;
	const protoFamily = activeProviderProfile
		? (activeProviderProfile.protocolFamily || getProviderProtocolFamily(activeProviderProfile.providerType))
		: 'openai-compatible';
	const reasoning = isReasoningModel(model);
	const anthropicAdaptive = protoFamily === 'anthropic' && anthropicThinkingMode(model) === 'adaptive';
	return {
		model,
		protoFamily,
		reasoning,
		anthropicAdaptive,
		samplingDead: reasoning || anthropicAdaptive,
		// kimi-k 系:前端不入 isReasoningModel(滑杆可拨),后端出口按推理模型剥温度 / top_p(有意分治)→ 浮层明说
		kimiNote: /^kimi-k\d/i.test(`${model || ''}`.replace(/^.*\//, '')) ? 'kimi-k 系：温度 / top_p 在后端出口按推理模型剥除，此处拨动不生效' : '',
		penaltyDead: reasoning || !isOpenAiFamily(protoFamily),
		tempMax: temperatureMaxForFamily(protoFamily),
		// 思考档逐档自证:与更低档产出同一份请求键的档一律置灰(极高/最大对 OpenAI 系 == 高;
		// Ollama / R1 等无思考参数的模型全部 == 关闭)。此前六个档一律可选,拨了毫无差别也不提示。
		thinkingLevels: thinkingLevelEffects(
			activeProviderProfile ? activeProviderProfile.providerType : 'openai',
			model,
			(activeProviderProfile && activeProviderProfile.providerOptions) || {},
		),
	};
};

// AIAnalysisMain 里 useMemo(…) 的回调(门面原位置换成调用它的箭头,依赖数组不变)
export const computeReferenceOptions = ({ materialFolders, bundles, materials, templates })=>{
	const folderLookup = new Map(materialFolders.map((item)=>[item.id, item]));
	const bundleOptions = bundles.map((item)=>({
		value: `bundle:${item.id}`,
		label: `组合 · ${item.name}`,
	}));
	const materialOptions = materials.map((item)=>({
		value: `material:${item.id}`,
		label: `资料 · ${item.name}${item.folderId && folderLookup.get(item.folderId) ? ` / ${folderLookup.get(item.folderId).name}` : ''}`,
	}));
	// 参考下拉补模板项(与 @模板 引用同键 template:<id>)
	const templateOptions = (templates || []).map((item)=>({
		value: `template:${item.id}`,
		label: `模板 · ${item.name}`,
	}));
	return bundleOptions.concat(materialOptions).concat(templateOptions);
};

// AIAnalysisMain 里 useMemo(…) 的回调(门面原位置换成调用它的箭头,依赖数组不变)
export const computeFilteredConversations = ({ historyKeyword, conversations, historyFilter })=>{
	const keyword = `${historyKeyword || ''}`.trim().toLowerCase();
	return sortByUpdatedDesc(conversations).filter((item)=>{
		if(item.archived && historyFilter.archived === 'active'){
			return false;
		}
		if(!item.archived && historyFilter.archived === 'archived'){
			return false;
		}
		if(historyFilter.favorite !== 'all'){
			const expectFavorite = historyFilter.favorite === 'favorite';
			if(Boolean(item.favorite) !== expectFavorite){
				return false;
			}
		}
		if(historyFilter.provider && `${item.providerName || item.providerType || ''}` !== historyFilter.provider){
			return false;
		}
		if(historyFilter.model && `${item.model || ''}` !== historyFilter.model){
			return false;
		}
		// 案例类型筛选补「起课时间」与「未挂案例」(此前只有命盘 / 事盘,起课时间会话与无案例会话筛不出)
		if(historyFilter.sourceType === '__none__'){
			if(item.sourceRef && item.sourceRef.sourceType){ return false; }
		}else if(historyFilter.sourceType && `${item.sourceRef && item.sourceRef.sourceType ? item.sourceRef.sourceType : ''}` !== historyFilter.sourceType){
			return false;
		}
		if(!keyword){
			return true;
		}
		const text = [
			item.title,
			item.model,
			item.providerName,
			item.providerType,
			item.sourceRef && item.sourceRef.title,
		].join(' ').toLowerCase();
		return matchesUserQuery(text, keyword);   // 界面繁体时照屏幕输入繁体也能命中
	});
};

// AIAnalysisMain 里 useMemo(…) 的回调(门面原位置换成调用它的箭头,依赖数组不变)
export const computeFilteredMaterials = ({ materialKeyword, materials, selectedFolderId, materialSort })=>{
	const keyword = `${materialKeyword || ''}`.trim().toLowerCase();
	let list = materials.filter((item)=>{
		if(selectedFolderId && item.folderId !== selectedFolderId){
			return false;
		}
		if(!keyword){
			return true;
		}
		return matchesUserQuery(buildMaterialSearchText(item), keyword);
	});
	if(materialSort === 'name'){
		list = compareByName(list);
	}else if(materialSort === 'size'){
		list = list.slice(0).sort((a, b)=>(b.size || 0) - (a.size || 0));
	}else{
		list = sortByUpdatedDesc(list);
	}
	return list;
};

// AIAnalysisMain 里 useMemo(…) 的回调(门面原位置换成调用它的箭头,依赖数组不变)
export const computeFilteredTemplates = ({ templateKeyword, templates, bundles })=>{
	const keyword = `${templateKeyword || ''}`.trim().toLowerCase();
	const allCards = sortByUpdatedDesc(templates).map((item)=>({
		...item,
		cardType: 'template',
	})).concat(sortByUpdatedDesc(bundles).map((item)=>({
		...item,
		cardType: 'bundle',
	})));
	if(!keyword){
		return allCards;
	}
	return allCards.filter((item)=>{
		const text = [
			item.name,
			item.instructionText,
			item.jsonSchema,
			item.defaultSystemPrompt,
		].join(' ').toLowerCase();
		return matchesUserQuery(text, keyword);   // 界面繁体时照屏幕输入繁体也能命中
	});
};

// AIAnalysisMain 里 useMemo(…) 的回调(门面原位置换成调用它的箭头,依赖数组不变)
export const computeFilteredProfiles = ({ settingKeyword, providerProfiles })=>{
	const keyword = `${settingKeyword || ''}`.trim().toLowerCase();
	const list = sortByUpdatedDesc(providerProfiles);
	if(!keyword){
		return list;
	}
	return list.filter((item)=>{
		const text = [
			item.name,
			item.providerType,
			normalizeProfileModels(item).join(' '),
			normalizeEmbeddingModels(item).join(' '),
			item.baseUrl,
			// 检索文本不含额外请求头的值(令牌位)
			JSON.stringify({ ...(item.providerOptions || {}), extraHeaders: Object.keys((item.providerOptions || {}).extraHeaders || {}) }),
		].join(' ').toLowerCase();
		return matchesUserQuery(text, keyword);   // 界面繁体时照屏幕输入繁体也能命中
	});
};
