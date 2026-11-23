// AI 分析页 · 副作用与记忆化回调(useEffect / useCallback 的函数体):勾选修剪、上下文键同步、宿主钩子、界面偏好落盘、挂载源上下文、示例提问、技法 / 对方盘 / 合盘预览、模型选择守护、聊天区滚动与复制、存储健康与恢复、工作区加载、接口预设
// 从 AIAnalysisMain.js 按职责拆出的 AIAnalysisMain 内层函数 / Hook 回调体 / 渲染树片段:原文原样,用到的局部名字经第一个参数显式传入;
// 门面原位置换成调用它的包装 / 箭头 / 表达式,调用那一刻取值传入(与闭包读到的是同一份)。读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { message } from 'antd';
import { copyTextSmart } from '../../../utils/clipboardText';
import { shouldAttachWesternSynastry } from '../../../utils/aiChat/skills';
import { AI_ANALYSIS_STORES, listConversationMessages, listStoreRecords, listStoreRecordsBatched, migrateWorkspaceData, getAiStoreHealth, AI_STORE_DEGRADED_EVENT, AI_STORE_RECOVERED_EVENT } from '../../../utils/aiAnalysisStore';
import { getAnalysisSourceContext, getAnalysisTechniqueContexts, listAnalysisSources, getPairSynastryText, getPairChineseTexts } from '../../../utils/aiAnalysisContext';
import { getProviderDefaultChatModels, getProviderDefaultEmbeddingModels, getProviderPreset } from '../../../utils/aiAnalysisProviders';
import { uniqueTextList, joinModelLines, sortByUpdatedDesc, compareByName } from './providerForm';
import { sameSourceContext, buildTechniqueLoadingState, mergeTechniqueState } from './sourceContext';
import { SETTING_NOT_SAVED_EVENT } from '../../../utils/safeStorage';

// AIAnalysisMain 里 useEffect(…) 的回调(门面原位置换成调用它的箭头,依赖数组不变)
export const pruneHiddenHistorySelection = ({ filteredConversations, setSelectedHistoryIds })=>{
	const visible = new Set(filteredConversations.map((item)=>item && item.id));
	setSelectedHistoryIds((prev)=>{
		const next = (prev || []).filter((id)=>visible.has(id));
		return next.length === (prev || []).length ? prev : next;
	});
};

// AIAnalysisMain 里 useEffect(…) 的回调(门面原位置换成调用它的箭头,依赖数组不变)
export const syncContextActiveKeys = ({ lockedContextItems, setContextActiveKeys, seenContextKeysRef })=>{
	const keys = lockedContextItems.map((item)=>item.key);
	setContextActiveKeys((prev)=>{
		const next = new Set(prev.filter((k)=>keys.includes(k)));
		keys.forEach((k)=>{
			if(!seenContextKeysRef.current.has(k)){
				next.add(k);
			}
			seenContextKeysRef.current.add(k);
		});
		return Array.from(next);
	});
};


// AIAnalysisMain 里 useCallback(…) 的回调(门面原位置换成调用它的箭头,依赖数组不变)
export const loadWorkspaceCb = async ({
	setWorkspaceLoading, setDeepLoading, setProviderProfiles, setMaterialFolders, setTagGroups,
	setTemplates, setBundles, setSources, setMaterials, setTemplateVersions, setConversations,
	activeConversationId, conversationLoadTokenRef, setMessages,
}, options = {})=>{
	setWorkspaceLoading(true);
	setDeepLoading(true);
	try{
		const [
			nextProfiles,
			nextFolders,
			nextTagGroups,
			nextTemplates,
			nextBundles,
		] = await Promise.all([
			listStoreRecords(AI_ANALYSIS_STORES.providerProfiles),
			listStoreRecords(AI_ANALYSIS_STORES.materialFolders),
			listStoreRecords(AI_ANALYSIS_STORES.tagGroups),
			listStoreRecords(AI_ANALYSIS_STORES.templates),
			listStoreRecords(AI_ANALYSIS_STORES.bundles),
		]);
		setProviderProfiles(sortByUpdatedDesc(nextProfiles));
		// 密文解不开(换机器/钥匙串被清)→ 提示重填,绝不带密文串发请求
		// 原密文在本会话内保留不覆写(未重填即照旧),卡片打「请重填」标记;额外请求头令牌同此
		if((nextProfiles || []).some((p)=>p && (p.apiKeyDecryptFailed || p.extraHeadersDecryptFailed))){
			message.warning('部分 AI 接口的 API Key 或鉴权请求头无法解密(钥匙串主密钥缺失),请到「接口设置」重新填入;未重填前原密文保留不覆盖。', 8);
		}
		setMaterialFolders(compareByName(nextFolders));
		setTagGroups(compareByName(nextTagGroups));
		setTemplates(sortByUpdatedDesc(nextTemplates));
		setBundles(sortByUpdatedDesc(nextBundles));
		setSources(listAnalysisSources());
	}catch(e){
		console.error(e);
		message.error('AI分析工作区加载失败');
	}finally{
		setWorkspaceLoading(false);
	}
	(async ()=>{
		try{
			await migrateWorkspaceData();
			const nextMaterials = await listStoreRecordsBatched(AI_ANALYSIS_STORES.materials, { batch: 12 });
			setMaterials(sortByUpdatedDesc(nextMaterials));
			const [nextTemplateVersions, nextConversations] = await Promise.all([
				listStoreRecords(AI_ANALYSIS_STORES.templateVersions),
				listStoreRecordsBatched(AI_ANALYSIS_STORES.conversations, { batch: 40 }),
			]);
			setTemplateVersions(sortByUpdatedDesc(nextTemplateVersions));
			setConversations(sortByUpdatedDesc(nextConversations));
			if(options.keepConversation && activeConversationId){
				// v1.16-O: 防 race
				const loadToken = ++conversationLoadTokenRef.current;
				const msgs = await listConversationMessages(activeConversationId);
				if(loadToken === conversationLoadTokenRef.current){
					setMessages(msgs);
				}
			}
		}catch(e){
			console.error(e);
			message.error('AI分析资料/会话载入失败');
		}finally{
			setDeepLoading(false);
		}
	})();
};

// AIAnalysisMain 里 useEffect(…) 的回调(门面原位置换成调用它的箭头,依赖数组不变)
export const resolveSourceContext = ({ selectedSourceId, setSourceContext, sources, sourceContextMode })=>{
	if(!selectedSourceId){
		setSourceContext(null);
		return;
	}
	const source = sources.find((item)=>item.id === selectedSourceId);
	if(!source){
		setSourceContext(null);
		return;
	}
	let cancelled = false;
	getAnalysisSourceContext(source, {
		mode: sourceContextMode,
	}).then((ctx)=>{
		if(!cancelled){
			setSourceContext((prev)=>sameSourceContext(prev, ctx) ? prev : ctx);
		}
	}).catch(()=>{
		if(!cancelled){
			setSourceContext(null);
		}
	});
	return ()=>{
		cancelled = true;
	};
// mountSettingsNonce:改「纳入内容」后源卡片(full 模式的事盘/命盘全文)也要重取——
// getAnalysisSourceContext 已改为读出后按当下设置过滤,重取即拿到新过滤结果(缓存命中也过滤,零额外成本)。
};

// AIAnalysisMain 里 useEffect(…) 的回调(门面原位置换成调用它的箭头,依赖数组不变)
export const syncTechniqueSelectionToSource = ({
	activeSource, setTechniqueContexts, techniqueOptions, selectedTechniqueKeys,
	setSelectedTechniqueKeys,
})=>{
	if(!activeSource){
		// 无挂载源时不清勾选:activeTechniqueKeys 已按源过滤为 [](挂载/发送零影响),
		//   保留原勾选才能在重选案例后回灌(此前这里清空 + 上面 effect 写空 = 勾选每次启动都丢)。
		setTechniqueContexts([]);
		return;
	}
	const allowed = new Set(techniqueOptions.map((item)=>item.value));
	const next = selectedTechniqueKeys.filter((item)=>allowed.has(item));
	if(next.length !== selectedTechniqueKeys.length){
		setSelectedTechniqueKeys(next);
	}
};

// AIAnalysisMain 里 useEffect(…) 的回调(门面原位置换成调用它的箭头,依赖数组不变)
export const applyPendingBundleTechniques = ({
	activeSource, pendingBundleTechniqueKeys, techniqueOptions, setSelectedTechniqueKeys,
	setPendingBundleTechniqueKeys,
})=>{
	if(activeSource && pendingBundleTechniqueKeys.length){
		const allowed = new Set(techniqueOptions.map((item)=>item.value));
		const next = pendingBundleTechniqueKeys.filter((item)=>allowed.has(item));
		if(next.length){
			setSelectedTechniqueKeys((prev)=>uniqueTextList(prev.concat(next)));
		}
		setPendingBundleTechniqueKeys([]);
	}
};

// AIAnalysisMain 里 useEffect(…) 的回调(门面原位置换成调用它的箭头,依赖数组不变)
export const buildTechniqueContexts = ({
	activeSource, activeTechniqueKeys, setTechniqueContexts, techniqueLabelMap,
	effectiveTechniqueOptions, sourceContext,
})=>{
	if(!activeSource || !activeTechniqueKeys.length){
		setTechniqueContexts([]);
		return;
	}
	let cancelled = false;
	setTechniqueContexts(buildTechniqueLoadingState(activeTechniqueKeys, techniqueLabelMap));
	activeTechniqueKeys.forEach((techniqueKey)=>{
		// 该技法若有「每技法设置」覆盖 → 走强制重算；否则默认路径(默认即现状)。段过滤复用 AI导出设置(Phase 1)。
		const optsForKey = effectiveTechniqueOptions[techniqueKey];
		getAnalysisTechniqueContexts(activeSource, [techniqueKey], {
			sourceContext,
			techniqueOptions: optsForKey ? { [techniqueKey]: optsForKey } : null,
		}).then((items)=>{
			if(cancelled){
				return;
			}
			const nextItem = items && items[0]
				? items[0]
				: {
					key: techniqueKey,
					title: techniqueLabelMap.get(techniqueKey) || techniqueKey,
					module: techniqueKey,
					content: '',
					available: false,
					status: 'missing',
					meta: {},
				};
			setTechniqueContexts((prev)=>mergeTechniqueState(prev, nextItem, activeTechniqueKeys, techniqueLabelMap));
		}).catch(()=>{
			if(cancelled){
				return;
			}
			setTechniqueContexts((prev)=>mergeTechniqueState(prev, {
				key: techniqueKey,
				title: techniqueLabelMap.get(techniqueKey) || techniqueKey,
				module: techniqueKey,
				content: '',
				available: false,
				status: 'missing',
				meta: {},
			}, activeTechniqueKeys, techniqueLabelMap));
		});
	});
	return ()=>{
		cancelled = true;
	};
// effectiveTechniqueOptionsSig / mountSettingsNonce 变更(改设置或段勾选) → 重新 fetch 让卡片快照刷新。
};

// AIAnalysisMain 里 useEffect(…) 的回调(门面原位置换成调用它的箭头,依赖数组不变)
export const buildPartnerCasePremise = ({ partnerSource, setPartnerSourceContext, sourceContextMode })=>{
	if(!partnerSource){
		setPartnerSourceContext(null);
		return undefined;
	}
	let cancelled = false;
	getAnalysisSourceContext(partnerSource, { mode: sourceContextMode }).then((ctx)=>{
		if(!cancelled){
			setPartnerSourceContext((prev)=>sameSourceContext(prev, ctx) ? prev : ctx);
		}
	}).catch(()=>{
		if(!cancelled){
			setPartnerSourceContext(null);
		}
	});
	return ()=>{
		cancelled = true;
	};
};

// AIAnalysisMain 里 useEffect(…) 的回调(门面原位置换成调用它的箭头,依赖数组不变)
export const buildPartnerTechniqueContexts = ({
	partnerSource, activeTechniqueKeys, setPartnerTechniqueContexts, techniqueLabelMap,
	partnerEffectiveTechniqueOptions, partnerSourceContext,
})=>{
	if(!partnerSource || !activeTechniqueKeys.length){
		setPartnerTechniqueContexts([]);
		return undefined;
	}
	let cancelled = false;
	setPartnerTechniqueContexts(buildTechniqueLoadingState(activeTechniqueKeys, techniqueLabelMap));
	activeTechniqueKeys.forEach((techniqueKey)=>{
		const optsForKey = partnerEffectiveTechniqueOptions[techniqueKey];
		const missing = {
			key: techniqueKey,
			title: techniqueLabelMap.get(techniqueKey) || techniqueKey,
			module: techniqueKey,
			content: '',
			available: false,
			status: 'missing',
			meta: {},
		};
		getAnalysisTechniqueContexts(partnerSource, [techniqueKey], {
			sourceContext: partnerSourceContext,
			techniqueOptions: optsForKey ? { [techniqueKey]: optsForKey } : null,
		}).then((items)=>{
			if(!cancelled){
				setPartnerTechniqueContexts((prev)=>mergeTechniqueState(prev, items && items[0] ? items[0] : missing, activeTechniqueKeys, techniqueLabelMap));
			}
		}).catch(()=>{
			if(!cancelled){
				setPartnerTechniqueContexts((prev)=>mergeTechniqueState(prev, missing, activeTechniqueKeys, techniqueLabelMap));
			}
		});
	});
	return ()=>{
		cancelled = true;
	};
};

// AIAnalysisMain 里 useEffect(…) 的回调(门面原位置换成调用它的箭头,依赖数组不变)
export const buildCnPairCompare = ({
	partnerSource, activeSource, setPartnerChinese, activeTechniqueKeys, effectiveTechniqueOptions,
	partnerEffectiveTechniqueOptions,
})=>{
	if(!partnerSource || !partnerSource.record || !activeSource || !activeSource.record){
		setPartnerChinese(null);
		return;
	}
	// 两人各按本次挂载设置(与单盘段同一份;改了齿轮合盘段跟着变)
	const chinese = getPairChineseTexts(activeSource.record, partnerSource.record, activeTechniqueKeys, { selfName: activeSource.title, otherName: partnerSource.title }, { optionsA: effectiveTechniqueOptions, optionsB: partnerEffectiveTechniqueOptions });
	setPartnerChinese(chinese.bazi || chinese.ziwei ? chinese : null);
};

// AIAnalysisMain 里 useEffect(…) 的回调(门面原位置换成调用它的箭头,依赖数组不变)
export const buildWesternPairData = ({
	partnerSource, activeSource, activeTechniqueKeys, setPartnerSynastry, effectiveTechniqueOptions,
	partnerEffectiveTechniqueOptions,
})=>{
	if(!partnerSource || !partnerSource.record || !activeSource || !activeSource.record || !shouldAttachWesternSynastry(activeTechniqueKeys)){
		setPartnerSynastry(null);
		return undefined;
	}
	let cancelled = false;
	setPartnerSynastry({ status: 'pending', content: '' });
	getPairSynastryText(activeSource.record, partnerSource.record, { optionsA: effectiveTechniqueOptions, optionsB: partnerEffectiveTechniqueOptions }).then((text)=>{
		if(!cancelled){ setPartnerSynastry({ status: `${text || ''}`.trim() ? 'ready' : 'missing', content: `${text || ''}` }); }
	}).catch(()=>{
		if(!cancelled){ setPartnerSynastry({ status: 'missing', content: '' }); }
	});
	return ()=>{
		cancelled = true;
	};
};

// AIAnalysisMain 里 useEffect(…) 的回调(门面原位置换成调用它的箭头,依赖数组不变)
export const guardModelSelection = ({ modelOptions, modelSelection, setModelSelection })=>{
	// 档案列表异步加载,首帧 modelOptions 为空:此时不能把持久化的 modelSelection 清掉——否则档案
	// 一到位就落到第一项,用户每次进页都被换成别的模型(压测实抓)。为空=尚未就绪,原样保留即可;
	// 真正「选择已失效」只在 options 就绪后判定。
	if(!modelOptions.length){
		return;
	}
	if(!modelSelection || !modelOptions.some((item)=>item.value === modelSelection)){
		setModelSelection(modelOptions[0].value);
	}
};

// AIAnalysisMain 里 useEffect(…) 的回调(门面原位置换成调用它的箭头,依赖数组不变)
export const followChatScroll = ({ chatLogRef, autoFollow })=>{
	const el = chatLogRef.current;
	if(el && autoFollow){
		el.scrollTop = el.scrollHeight;
	}
};

// AIAnalysisMain 里 useEffect(…) 的回调(门面原位置换成调用它的箭头,依赖数组不变)
export const watchChatScrollPause = ({ chatLogNode, setAutoFollow })=>{
	const el = chatLogNode;
	if(!el){ return undefined; }
	const onScroll = ()=>{
		const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
		setAutoFollow(distFromBottom < 40);
	};
	el.addEventListener('scroll', onScroll, { passive: true });
	return ()=>{ el.removeEventListener('scroll', onScroll); };
};

// AIAnalysisMain 里 useEffect(…) 的回调(门面原位置换成调用它的箭头,依赖数组不变)
export const delegateCodeCopy = ({ chatLogNode })=>{
	const el = chatLogNode;
	if(!el){ return undefined; }
	const onClick = (e)=>{
		const btn = e.target && e.target.closest ? e.target.closest('.xq-code-copy') : null;
		if(!btn){ return; }
		const wrap = btn.closest('.xq-code-block');
		const code = wrap ? wrap.querySelector('pre code') : null;
		const text = code ? code.textContent || '' : '';
		if(!text){ return; }
		copyTextSmart(text).then((ok)=>{
			if(ok){
				message.success('已复制代码', 1);
				btn.classList.add('xq-code-copy--ok');
				setTimeout(()=>btn.classList.remove('xq-code-copy--ok'), 1200);
			}else{
				message.error('复制失败', 1.5);
			}
		});
	};
	el.addEventListener('click', onClick);
	return ()=>{ el.removeEventListener('click', onClick); };
};

// AIAnalysisMain 里 useCallback(…) 的回调(门面原位置换成调用它的箭头,依赖数组不变)
export const applyProviderPresetToFormCb = ({ providerForm }, providerType)=>{
	const preset = getProviderPreset(providerType);
	const currentValues = providerForm.getFieldsValue(true);
	// 换预设:用户已填的配置名不被预设名覆盖(只有空或仍是上一预设名时才换);
	//   清 Key 的同时也清「额外请求头」(鉴权定制里的令牌不该跟着换到新预设地址)。
	const prevPreset = getProviderPreset(currentValues.providerType || 'openai');
	const typedName = `${currentValues.name || ''}`.trim();
	const keepName = typedName && typedName !== prevPreset.label;
	providerForm.setFieldsValue({
		...currentValues,
		apiKey: '',
		extraHeadersText: '{}',
		providerType,
		name: keepName ? typedName : preset.label,
		baseUrl: preset.baseUrl,
		manualModels: joinModelLines(getProviderDefaultChatModels(providerType)),
		embeddingModels: joinModelLines(getProviderDefaultEmbeddingModels(providerType)),
		requestTimeoutMs: preset.requestTimeoutMs || 120000,
		anthropicApiVersion: preset.anthropicApiVersion || '2023-06-01',
		anthropicMaxTokens: preset.anthropicMaxTokens || '2048',
		anthropicThinkingBudget: preset.anthropicThinkingBudget || '',
		anthropicTopP: preset.anthropicTopP || '',
		anthropicTopK: preset.anthropicTopK || '',
		geminiGenerationConfigText: currentValues.geminiGenerationConfigText || '{}',
		geminiSafetySettingsText: currentValues.geminiSafetySettingsText || '[]',
		ollamaKeepAlive: preset.ollamaKeepAlive || '5m',
		ollamaNumCtx: preset.ollamaNumCtx || '8192',
		ollamaNumPredict: preset.ollamaNumPredict || '1024',
		ollamaTopK: preset.ollamaTopK || '40',
		ollamaTopP: preset.ollamaTopP || '0.9',
		ollamaRepeatPenalty: preset.ollamaRepeatPenalty || '1.1',
		enabled: currentValues.enabled !== false,
	});
};

// AIAnalysisMain 里 useEffect(…) 的回调(门面原位置换成调用它的箭头,依赖数组不变)
export const watchStoreHealth = ({ setStoreHealth })=>{
	const onDegraded = ()=>setStoreHealth(getAiStoreHealth());
	window.addEventListener(AI_STORE_DEGRADED_EVENT, onDegraded);
	onDegraded();
	return ()=>window.removeEventListener(AI_STORE_DEGRADED_EVENT, onDegraded);
};

// AIAnalysisMain 里 useEffect(…) 的回调(门面原位置换成调用它的箭头,依赖数组不变)
export const notifySettingNotSaved = ()=>{
	let last = 0;
	const onNotSaved = ()=>{
		const now = Date.now();
		if(now - last < 3000){ return; }
		last = now;
		message.warning('本机存储已满,没能保存这项设置(界面按实际保存的值显示)');
	};
	window.addEventListener(SETTING_NOT_SAVED_EVENT, onNotSaved);
	return ()=>window.removeEventListener(SETTING_NOT_SAVED_EVENT, onNotSaved);
};

// AIAnalysisMain 里 useEffect(…) 的回调(门面原位置换成调用它的箭头,依赖数组不变)
export const reloadOnStoreRecovered = ({ loadWorkspaceLatestRef, sendingRef })=>{
	const onRecovered = ()=>{
		try{ loadWorkspaceLatestRef.current({ keepConversation: !sendingRef.current }); }catch(_e){ /* noop */ }
	};
	window.addEventListener(AI_STORE_RECOVERED_EVENT, onRecovered);
	return ()=>window.removeEventListener(AI_STORE_RECOVERED_EVENT, onRecovered);
};
