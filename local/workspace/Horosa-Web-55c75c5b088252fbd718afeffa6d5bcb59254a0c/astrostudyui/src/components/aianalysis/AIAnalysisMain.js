// AI 分析页(函数组件):本文件留 state / ref / Hook 的声明次序、对话助手接线与页面骨架;
// 页内常量与模块级助手在 ./main/ 下(providerForm · chatHelpers · templates · sourceContext · AssistantMarkdown · pageConst),
// 组件体内的函数、Hook 回调体与弹窗 / 抽屉也按职责拆在 ./main/ 下(chatFlow · conversationFlow · conversationActions ·
// materialActions · templateProviderActions · workspaceActions · mountViews · analysisView · sideViews · derivedState ·
// pageEffects · dialogs):实现的第一个参数显式收依赖,本文件原位置留同名包装在调用那一刻取值。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import React from 'react';
import { Alert, Form, Upload, message } from 'antd';
import 'mustache';
import moment from 'moment';
import 'ajv';
import 'ajv-formats';
import '../../utils/reportMarkdownNormalize';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { getLayoutViewportHeight } from '../../utils/shellZoom';   // 版面尺寸一律读布局域(壳缩放下 documentElement.client* 恒为物理域)
import { copyTextSmart } from '../../utils/clipboardText';
import 'highlight.js/styles/atom-one-dark.css';
import styles from './AIAnalysisMain.less';
import { groupMountTechniqueOptions } from './mountTechniqueGroups';
import { XQModal as Modal, XQTabs as Tabs } from '../xq-ui';
// AI 助手·行动能力(总开关默认关;关=NULL_AGENT 现状路径)
import '../../utils/aiAgent/textProtocol';
// 对话交互增强唯一插座(斜杠/@引用/状态栏/压缩·旁问·回退/口径·记忆):钩子内按批次实装,页面只留最小 hunk
import { useChatAssist, ChatAssistOverlays } from './chat';
import { useSubjectFacts } from './chat';   // 命主实况:挂载预览卡与「发送 / 不发送」
import { useChatModels } from './chat/useChatModels';
import { AI_ANALYSIS_STORES, deleteStoreRecord, clearStore, countStoreRecords, listConversationMessages, listStoreRecords, loadUiPrefs, putStoreRecord, saveUiPrefs, getAiStoreHealth } from '../../utils/aiAnalysisStore';
import { highlightCodeUnder } from '../../utils/aiMarkdownRender';
import { listAnalysisSources, listAnalysisTechniqueOptions, mountDraftContextFor } from '../../utils/aiAnalysisContext';
import { applyTechniqueDraftChange } from '../../utils/techniqueMountSettings';
import { loadAIExportSettings, getAIExportEffectiveSectionsForTechnique, listAIExportTechniqueSettings } from '../../utils/aiExport';
import * as Constants from '../../utils/constants';
import { MATERIAL_ACCEPT_ATTR } from '../../utils/aiAnalysisMaterial';   // 导入白名单 + 抽取上限/截断标注单源
import { requestAIAnalysisChat } from '../../services/aianalysis';
import { base64ToBlob, blobToBase64, downloadTextFile, withUtf8Bom, exportConversationBundle, saveBlobToBrowser } from '../../utils/aiAnalysisExport';
import { resolveEmbeddingTargetFromPrefs } from '../../utils/aiAnalysisRag';
import {
	filterTechniqueKeysBySource,
	getTechniqueContextMode,
} from '../../utils/aiAnalysisSelection';
import { isDesktopBridgeAvailable } from '../../utils/aiAnalysisDesktop';
import { applyThinkingLevel, parseModelSelection } from '../../utils/aiAnalysisProviders';
// 组件外的模块级助手(纯函数 / 常量 / 小组件)拆在 ./main/ 下;组件本体与页内状态仍在本文件。
import { buildProviderFormValues } from './main/providerForm';
import { resolveReferenceItems } from './main/chatHelpers';
import { buildTemplatePreview } from './main/templates';
import { formatTimepointNow } from './main/sourceContext';
import { notifySaveResult, SECONDARY_TABS, SECONDARY_TAB_ITEMS } from './main/pageConst';
import { startNewConversation as startNewConversationImpl, retrieveMaterialContext as retrieveMaterialContextImpl, generateAndApplyAutoTitle as generateAndApplyAutoTitleImpl, streamReply as streamReplyImpl, buildResolvedPromptImpl as buildResolvedPromptImplImpl, handlePickImages as handlePickImagesImpl, handleExampleClick as handleExampleClickImpl, countUndoableActions as countUndoableActionsImpl, handleRegenerateLastReply as handleRegenerateLastReplyImpl, handleRegenerateMessage as handleRegenerateMessageImpl, handleSaveQuickDraftAsSource as handleSaveQuickDraftAsSourceImpl, handleEditMessageAndBranch as handleEditMessageAndBranchImpl, handleEditLastUserAndBranch as handleEditLastUserAndBranchImpl } from './main/chatFlow';
import { handleDeleteConversation as handleDeleteConversationImpl, handleDuplicateConversation as handleDuplicateConversationImpl, handleRenameConversation as handleRenameConversationImpl, exportConversation as exportConversationImpl, restoreWorkspaceBackup as restoreWorkspaceBackupImpl, handleRestoreWorkspaceBackup as handleRestoreWorkspaceBackupImpl, handleBackupRestoreInputChange as handleBackupRestoreInputChangeImpl, pruneConversationRefs as pruneConversationRefsImpl } from './main/conversationActions';
import { openMaterialEditor as openMaterialEditorImpl, saveMaterialForm as saveMaterialFormImpl, saveImportedMaterial as saveImportedMaterialImpl, handleImportFileLike as handleImportFileLikeImpl, importFileLikeList as importFileLikeListImpl, handleUploadMaterial as handleUploadMaterialImpl, handleCreateFolder as handleCreateFolderImpl, handleRenameFolder as handleRenameFolderImpl, handleDeleteFolder as handleDeleteFolderImpl, ingestFiles as ingestFilesImpl, handleDesktopFilePick as handleDesktopFilePickImpl, handleDesktopFolderImport as handleDesktopFolderImportImpl, handleDesktopFileInputChange as handleDesktopFileInputChangeImpl, handleDesktopFolderInputChange as handleDesktopFolderInputChangeImpl, deleteMaterial as deleteMaterialImpl, handleReplaceMaterial as handleReplaceMaterialImpl, dedupeMaterials as dedupeMaterialsImpl } from './main/materialActions';
import { openTemplateEditor as openTemplateEditorImpl, saveTemplateForm as saveTemplateFormImpl, deleteTemplate as deleteTemplateImpl, rollbackTemplateVersion as rollbackTemplateVersionImpl, openBundleEditor as openBundleEditorImpl, saveBundleForm as saveBundleFormImpl, saveProviderForm as saveProviderFormImpl, deleteProvider as deleteProviderImpl, setProviderAsCurrent as setProviderAsCurrentImpl, runProviderDiagnostics as runProviderDiagnosticsImpl, testProfileChat as testProfileChatImpl } from './main/templateProviderActions';
import { renderConnChip as renderConnChipImpl, openTechniqueSettings as openTechniqueSettingsImpl, applyTechniqueSettings as applyTechniqueSettingsImpl, saveTechniqueAsDefault as saveTechniqueAsDefaultImpl, resetTechniqueSettings as resetTechniqueSettingsImpl, persistAIExportSettings as persistAIExportSettingsImpl, togglePlanetInfoForTech as togglePlanetInfoForTechImpl, renderTechniqueSettingsDrawer as renderTechniqueSettingsDrawerImpl, renderMountDrawer as renderMountDrawerImpl, renderContextBanner as renderContextBannerImpl } from './main/mountViews';
import { renderLandingExamples as renderLandingExamplesImpl, renderLandingSetup as renderLandingSetupImpl, renderComposerContextRow as renderComposerContextRowImpl, renderComposer as renderComposerImpl, renderAnalysisPane as renderAnalysisPaneImpl } from './main/analysisView';
import { diffLines as diffLinesImpl, renderTemplateVersionDiff as renderTemplateVersionDiffImpl, renderHistoryPane as renderHistoryPaneImpl, renderMaterialsPane as renderMaterialsPaneImpl, renderTemplatesPane as renderTemplatesPaneImpl, renderAdvancedPane as renderAdvancedPaneImpl, renderSettingsPane as renderSettingsPaneImpl } from './main/sideViews';
import { computeActiveSource as computeActiveSourceImpl, computePartnerSource as computePartnerSourceImpl, computeSourceOptions as computeSourceOptionsImpl, computeEffectiveTechniqueOptions as computeEffectiveTechniqueOptionsImpl, computePartnerEffectiveTechniqueOptions as computePartnerEffectiveTechniqueOptionsImpl, computeModelOptions as computeModelOptionsImpl, computeEmbeddingOptions as computeEmbeddingOptionsImpl, computeActiveProviderProfile as computeActiveProviderProfileImpl, computeParamPopover as computeParamPopoverImpl, computeReferenceOptions as computeReferenceOptionsImpl, computeFilteredConversations as computeFilteredConversationsImpl, computeFilteredMaterials as computeFilteredMaterialsImpl, computeFilteredTemplates as computeFilteredTemplatesImpl, computeFilteredProfiles as computeFilteredProfilesImpl } from './main/derivedState';
import { pruneHiddenHistorySelection as pruneHiddenHistorySelectionImpl, syncContextActiveKeys as syncContextActiveKeysImpl, loadWorkspaceCb as loadWorkspaceCbImpl, resolveSourceContext as resolveSourceContextImpl, syncTechniqueSelectionToSource as syncTechniqueSelectionToSourceImpl, applyPendingBundleTechniques as applyPendingBundleTechniquesImpl, buildTechniqueContexts as buildTechniqueContextsImpl, buildPartnerCasePremise as buildPartnerCasePremiseImpl, buildPartnerTechniqueContexts as buildPartnerTechniqueContextsImpl, buildCnPairCompare as buildCnPairCompareImpl, buildWesternPairData as buildWesternPairDataImpl, guardModelSelection as guardModelSelectionImpl, followChatScroll as followChatScrollImpl, watchChatScrollPause as watchChatScrollPauseImpl, delegateCodeCopy as delegateCodeCopyImpl, applyProviderPresetToFormCb as applyProviderPresetToFormCbImpl, watchStoreHealth as watchStoreHealthImpl, notifySettingNotSaved as notifySettingNotSavedImpl, reloadOnStoreRecovered as reloadOnStoreRecoveredImpl } from './main/pageEffects';
import { renderMaterialModal as renderMaterialModalImpl, renderTemplateModal as renderTemplateModalImpl, renderBundlePreviewModal as renderBundlePreviewModalImpl, renderFolderDrawer as renderFolderDrawerImpl, renderBundleModal as renderBundleModalImpl, renderProviderSwitchModal as renderProviderSwitchModalImpl, renderProviderModal as renderProviderModalImpl, renderTemplatePreviewDrawer as renderTemplatePreviewDrawerImpl } from './main/dialogs';
import { openConversation as openConversationImpl, ensureConversationRecord as ensureConversationRecordImpl, updateConversationMeta as updateConversationMetaImpl, handleSend as handleSendImpl, applyBundle as applyBundleImpl, handleBranchFromMessage as handleBranchFromMessageImpl } from './main/conversationFlow';
import { exportWorkspaceBackupInner as exportWorkspaceBackupInnerImpl, pruneBundleRefs as pruneBundleRefsImpl, fetchModelsAndEmbeddings as fetchModelsAndEmbeddingsImpl } from './main/workspaceActions';
import { FreezeSubTab } from '../comp/FreezeInactive';
import { markPanelReady } from '../../utils/perfMark';

const { Dragger } = Upload;
const { TabPane } = Tabs;

function AIAnalysisMain(props){
	const defaultUi = loadUiPrefs();
	// 同一次 saveUiPrefs 写下的 modelSelection / referenceIds / 技法 / 会话规则都回灌了,
	// 唯独 innerTab 只写不读(注册表却说它保存「内页」)。回灌,并只认 SECONDARY_TABS 里真实存在的页签
	// (旧档存了已下线的 key 时静默落回「分析」,不会开在一个空白页)。
	const [innerTab, setInnerTab] = React.useState(()=>{
		const saved = `${(defaultUi && defaultUi.innerTab) || ''}`;
		return SECONDARY_TABS.some((t)=>t.key === saved) ? saved : 'analysis';
	});
	const [workspaceLoading, setWorkspaceLoading] = React.useState(false);
	// [首开反卡] Wave2(资料/会话/版本)后台载入中 —— 只驱动资料/历史 pane 顶部细提示,绝不全页转圈。
	const [deepLoading, setDeepLoading] = React.useState(false);
	const [sending, setSending] = React.useState(false);
	const [sources, setSources] = React.useState([]);
	const [providerProfiles, setProviderProfiles] = React.useState([]);
	const [materials, setMaterials] = React.useState([]);
	const [materialFolders, setMaterialFolders] = React.useState([]);
	const [tagGroups, setTagGroups] = React.useState([]);
	const [templateVersions, setTemplateVersions] = React.useState([]);
	const [templates, setTemplates] = React.useState([]);
	const [bundles, setBundles] = React.useState([]);
	const [conversations, setConversations] = React.useState([]);
	const [activeConversationId, setActiveConversationId] = React.useState('');
	// v1.16-O: 对话切换 race token — 用户快速切 A→B→A 时,老 listConversationMessages 可能比新的更晚返回,会用 A 的消息覆盖 B。
	// 每次切对话 ++ token,setMessages 前核对 token 一致才写。
	const conversationLoadTokenRef = React.useRef(0);
	const [messages, setMessages] = React.useState([]);
	const [selectedSourceId, setSelectedSourceId] = React.useState('');
	// [双盘挂载] 合盘对方(另一张命盘的源 id);'' = 单盘。随会话存 partnerRef、随检查点回退;不进全局偏好(与当前案例同)。
	const [partnerSourceId, setPartnerSourceId] = React.useState('');
	const [modelSelection, setModelSelection] = React.useState(defaultUi.modelSelection || '');
	// issue #13：嵌入(向量)模型独立选择 + 聊天高级参数（全局，存 UI prefs）
	const [embeddingSelection, setEmbeddingSelection] = React.useState(defaultUi.embeddingSelection || '');
	const [chatTemperature, setChatTemperature] = React.useState(defaultUi.chatTemperature === undefined ? null : defaultUi.chatTemperature);
	const [chatTopP, setChatTopP] = React.useState(defaultUi.chatTopP === undefined ? null : defaultUi.chatTopP);
	const [thinkingLevel, setThinkingLevel] = React.useState(defaultUi.thinkingLevel || 'off');
	// 2B/2G：停止序列（四家通用，出口按家族映射）/ 频率·存在惩罚（仅 OpenAI 兼容）/ JSON 输出模式（OpenAI 兼容 + Gemini）。
	const [stopSequences, setStopSequences] = React.useState(defaultUi.stopSequences || '');
	const [frequencyPenalty, setFrequencyPenalty] = React.useState(defaultUi.frequencyPenalty === undefined ? null : defaultUi.frequencyPenalty);
	const [presencePenalty, setPresencePenalty] = React.useState(defaultUi.presencePenalty === undefined ? null : defaultUi.presencePenalty);
	const [jsonMode, setJsonMode] = React.useState(!!defaultUi.jsonMode);
	// C: 测试连接状态机——key = 当前 modelSelection 指纹。切模型/接口后 key 失配 → chip 自动回灰「点击测试」;
	// 在当前选择下测试成功/失败 → 置绿「测试成功」/ 红「测试失败」。不再读 profile.healthStatus(避免历史诊断残留绿)。
	const [connState, setConnState] = React.useState({ key: '', status: 'idle' });
	const [referenceIds, setReferenceIds] = React.useState(defaultUi.referenceIds || []);
	const [sourceContext, setSourceContext] = React.useState(null);
	const [selectedTechniqueKeys, setSelectedTechniqueKeys] = React.useState(defaultUi.selectedTechniqueKeys || []);
	// 组合包待挂载技法：套用组合时若尚未选案例，先缓存于此，待选定 source 后由 effect 取交集落入 selectedTechniqueKeys。
	const [pendingBundleTechniqueKeys, setPendingBundleTechniqueKeys] = React.useState([]);
	const [techniqueContexts, setTechniqueContexts] = React.useState([]);
	// [双盘挂载] 对方盘的案例前提与各技法快照(挂载预览卡用;发送时另行现算)
	const [partnerSourceContext, setPartnerSourceContext] = React.useState(null);
	const [partnerTechniqueContexts, setPartnerTechniqueContexts] = React.useState([]);
	const [partnerSynastry, setPartnerSynastry] = React.useState(null);   // [双盘挂载] 两人之间的西洋合盘数据(预览卡;{ status, content })
	const [partnerChinese, setPartnerChinese] = React.useState(null);   // 中式合盘对照(预览卡;{ bazi, ziwei })
	// [挂载预算] 最近一次发送的上下文裁剪账本 {byKey,dropped,stats}：预览卡「已裁剪/超预算」Tag + banner 字数用。
	const [promptClipStats, setPromptClipStats] = React.useState(null);
	const [prompt, setPrompt] = React.useState('');
	// 2F：待发送图片（多媒体输入），元素 {url: dataURL, name}；随用户消息以 images 字段发往后端（仅视觉模型有效）。
	const [pendingImages, setPendingImages] = React.useState([]);
	// 「未挂载案例 · 选择案例」此前打开的是**挂载抽屉**,而抽屉里根本没有案例选择器
	// (全页唯一的选择器在顶栏)—— 用户点完一脸茫然。改成直接把顶栏那个下拉打开并聚焦。
	// 注:顶栏那个下拉是 XQSelect(函数组件,未 forwardRef)——挂 ref 只会换来一条 React 警告且拿不到实例,
	// 所以这里只驱动受控的 open(实测足以把下拉展开)。
	const [sourceSelectOpen, setSourceSelectOpen] = React.useState(false);
	function focusSourceSelect(){
		try{ setSources(listAnalysisSources()); }catch(e){ /* noop */ }
		setSourceSelectOpen(true);
	}
	// 空态输入框顶行的「模型」入口:与「案例」同一做法 —— 直接把顶栏那个模型下拉展开(受控 open)
	const [modelSelectOpen, setModelSelectOpen] = React.useState(false);
	// 空态下状态胶囊缺省收起(多数还是「—」),点「状态」展开;有消息后照旧常驻
	const [landingStatusOpen, setLandingStatusOpen] = React.useState(false);
	const imageInputRef = React.useRef(null);
	// 对话栏拖入图片高亮态。
	const [composerDragOver, setComposerDragOver] = React.useState(false);
	// 资料 pane 全区拖拽计数（防 dragLeave 误闪）：用 ref 而非函数静态，避免重渲染丢失。
	const materialDragCounterRef = React.useRef(0);
	// 组件挂载状态：异步流程末段写 state 前先看本 ref，避免 unmount 后 setState 警告。
	const isMountedRef = React.useRef(true);
	const [sessionSystemPrompt, setSessionSystemPrompt] = React.useState(defaultUi.sessionSystemPrompt || '');
	const [mountDrawerOpen, setMountDrawerOpen] = React.useState(false);
	// AI 挂载「每技法设置」：会话级覆盖 {[key]:options}（仅本次，未点「设为同类默认」不持久）。默认空 → 走默认路径。
	const [techniqueOptionOverrides, setTechniqueOptionOverrides] = React.useState({});
	// 当前打开设置抽屉的技法 key + 抽屉内编辑草稿（含 settings 段勾选即时态）。
	const [techniqueSettingsKey, setTechniqueSettingsKey] = React.useState('');
	const [techniqueSettingsDraft, setTechniqueSettingsDraft] = React.useState({});
	// 段勾选写入 aiExport 设置后用此 nonce 触发挂载重新 fetch（让卡片快照按新段刷新）。
	const [mountSettingsNonce, setMountSettingsNonce] = React.useState(0);
	const [timepointDraft, setTimepointDraft] = React.useState(()=>({
		divTime: formatTimepointNow(),
		zone: '+08:00',
		lon: Constants.DefLon,
		lat: Constants.DefLat,
		gpsLon: Constants.DefGpsLon,
		gpsLat: Constants.DefGpsLat,
		gender: 1,
		name: '',
	}));
	// B2:「命盘时间」入口——与起课时间同思路,但合成 chart 型源(record 带 birth)→ 走命盘技法,默认设置即时起命盘。
	const [natalDraft, setNatalDraft] = React.useState(()=>({
		birth: formatTimepointNow(),
		zone: '+08:00',
		lon: Constants.DefLon,
		lat: Constants.DefLat,
		gpsLon: Constants.DefGpsLon,
		gpsLat: Constants.DefGpsLat,
		gender: 1,
		name: '',
	}));
	const [historyKeyword, setHistoryKeyword] = React.useState('');
	const [historyFilter, setHistoryFilter] = React.useState({
		provider: '',
		model: '',
		sourceType: '',
		favorite: 'all',
		archived: 'active',
	});
	const [selectedHistoryIds, setSelectedHistoryIds] = React.useState([]);
	const [materialKeyword, setMaterialKeyword] = React.useState('');
	const [selectedFolderId, setSelectedFolderId] = React.useState('');
	const [materialView, setMaterialView] = React.useState(defaultUi.materialView || 'grid');
	// 组合包「预览影响」弹层。
	const [bundlePreview, setBundlePreview] = React.useState(null);
	// 资料 pane 全区拖拽态 + 上传进度（取代旧的小 Dragger 区 + window.prompt 阻塞）。
	const [materialPaneDragOver, setMaterialPaneDragOver] = React.useState(false);
	const [materialIngestQueue, setMaterialIngestQueue] = React.useState([]); // [{name, status:'parsing|importing|done|skip|error', err?}]
	// 资料 folder 管理 Drawer。
	const [folderDrawerOpen, setFolderDrawerOpen] = React.useState(false);
	const [folderDraftName, setFolderDraftName] = React.useState('');
	// Provider 列表密度切换 + 测试连接进行中态。
	const [providerListDense, setProviderListDense] = React.useState(!!defaultUi.providerListDense);
	// 模板版本 diff Modal。
	const [versionDiffState, setVersionDiffState] = React.useState(null); // {template, leftId, rightId}
	// AI 生成的示例提问缓存（sourceKey → [3 prompts]）；空 source 与失败时退化为静态。
	const [aiExamplePromptsBySource, setAiExamplePromptsBySource] = React.useState({});
	const [aiExamplesLoading, setAiExamplesLoading] = React.useState(false);
	const aiExamplesFetchKeyRef = React.useRef('');
	const [materialSort, setMaterialSort] = React.useState('updated');
	const [templateKeyword, setTemplateKeyword] = React.useState('');
	const [settingKeyword, setSettingKeyword] = React.useState('');
	const [materialModalOpen, setMaterialModalOpen] = React.useState(false);
	const [templateModalOpen, setTemplateModalOpen] = React.useState(false);
	const [bundleModalOpen, setBundleModalOpen] = React.useState(false);
	const [providerModalOpen, setProviderModalOpen] = React.useState(false);
	const [providerSwitchModalOpen, setProviderSwitchModalOpen] = React.useState(false);
	const [providerAdvancedOpen, setProviderAdvancedOpen] = React.useState(false);
	const [previewDrawerOpen, setPreviewDrawerOpen] = React.useState(false);
	const [previewTemplate, setPreviewTemplate] = React.useState(null);
	const [editingMaterial, setEditingMaterial] = React.useState(null);
	const [editingTemplate, setEditingTemplate] = React.useState(null);
	const [editingBundle, setEditingBundle] = React.useState(null);
	const [editingProvider, setEditingProvider] = React.useState(null);
	const [materialForm] = Form.useForm();
	const [templateForm] = Form.useForm();
	const [bundleForm] = Form.useForm();
	const [providerForm] = Form.useForm();
	const abortRef = React.useRef(null);
	const sendingRef = React.useRef(false);   // handleSend 同步重入闸(state 版 sending 在 commit 前是旧值)
	const streamBufferRef = React.useRef('');
	const quickLaunchRef = React.useRef(null);   // 对话栏快捷动作插座(与 useChatAssist 依赖面同形;未接线时恒 null)
	const streamReasoningBufferRef = React.useRef(''); // #16:DeepSeek reasoner 思考过程(独立于答案,仅展示/存档,绝不回灌 messages)
	const streamUsageRef = React.useRef(null); // 2A：本次流的 usage 计量(末帧到达后由 SSE usage 事件填充)
	const lastPromptMetaRef = React.useRef(null); // 上次 buildResolvedPrompt 的稳定层指纹与层账(随 usage.prompt 落盘;跨轮对照前缀缓存是否失效)
	const chatLogRef = React.useRef(null);
	// 聊天区节点以回调 ref 落状态:首帧是落地页(messages 空)时 chatLogRef 为 null,
	// 依赖 [] 的滚动监听 / 代码复制委托永远挂不上(上滚暂停跟随、跳到最新、复制按钮全失效)。
	const [chatLogNode, setChatLogNode] = React.useState(null);
	const setChatLogEl = React.useCallback((el)=>{ chatLogRef.current = el; setChatLogNode(el || null); }, []);
	// 「自动跟随」开关：用户上滚 >40px 后置 false（暂停自动滚到底）；回到底部置 true。
	const [autoFollow, setAutoFollow] = React.useState(true);
	const backupRestoreInputRef = React.useRef(null);
	const desktopFileInputRef = React.useRef(null);
	const desktopFolderInputRef = React.useRef(null);

	const height = props.height ? props.height - 18 : (typeof document !== 'undefined' ? getLayoutViewportHeight() - 100 : 620);
	const desktopBridge = isDesktopBridgeAvailable();

	const activeConversation = React.useMemo(()=>{
		return conversations.find((item)=>item.id === activeConversationId) || null;
	}, [conversations, activeConversationId]);

	const activeSource = React.useMemo((...args)=>computeActiveSourceImpl({ selectedSourceId, timepointDraft, natalDraft, sources }, ...args), [sources, selectedSourceId, timepointDraft, natalDraft]);

	// 挂载抽屉渲染用的只读上下文(随本盘算出才定得下的档位显示,如正传「演算时天象」随本人时支);不进草稿、不下发
	// 草稿里能改的时间算法决定本人时支:随它重算(其余键不影响,不进依赖)
	const techniqueDraftTimeAlg = techniqueSettingsDraft ? techniqueSettingsDraft.timeAlg : undefined;
	const techniqueDraftContext = React.useMemo(()=>(
		techniqueSettingsKey ? mountDraftContextFor(techniqueSettingsKey, activeSource && activeSource.record ? activeSource.record : null, techniqueDraftTimeAlg === undefined ? null : { timeAlg: techniqueDraftTimeAlg }) : null
	), [techniqueSettingsKey, activeSource, techniqueDraftTimeAlg]);
	// [双盘挂载] 只在当前挂的是命盘时生效;对方必须是另一张已存命盘(事盘 / 起课时间不参与合盘)。
	const partnerSource = React.useMemo((...args)=>computePartnerSourceImpl({ partnerSourceId, activeSource, sources }, ...args), [partnerSourceId, activeSource, sources]);

	const sourceOptions = React.useMemo((...args)=>computeSourceOptionsImpl({ sources }, ...args), [sources]);
	// [双盘挂载] 本人换成了原来的对方 → 对方作废(不留一个看不见的旧 id)
	React.useEffect(()=>{
		if(partnerSourceId && activeSource && activeSource.id === partnerSourceId){
			setPartnerSourceId('');
		}
	}, [partnerSourceId, activeSource]);
	// [双盘挂载] 合盘对方候选:其它已存命盘
	const partnerOptions = React.useMemo(()=>{
		return sourceOptions.filter((item)=>item.item && item.item.sourceType === 'chart' && (!activeSource || item.value !== activeSource.id));
	}, [sourceOptions, activeSource]);

	const techniqueOptions = React.useMemo(()=>{
		return activeSource ? listAnalysisTechniqueOptions(activeSource) : [];
	}, [activeSource]);
	// 技法多选下拉按术数域 OptGroup 分组(仅当前可挂集内的键;未归组键落「其他」)。
	const groupedTechniqueOptions = React.useMemo(()=>{
		return groupMountTechniqueOptions(techniqueOptions);
	}, [techniqueOptions]);
	const techniqueLabelMap = React.useMemo(()=>{
		return new Map((techniqueOptions || []).map((item)=>[item.value, item.label]));
	}, [techniqueOptions]);
	const activeTechniqueKeys = React.useMemo(()=>{
		return filterTechniqueKeysBySource(activeSource, techniqueOptions, selectedTechniqueKeys);
	}, [activeSource, techniqueOptions, selectedTechniqueKeys]);
	const sourceContextMode = getTechniqueContextMode(activeTechniqueKeys);

	// 每技法的「生效覆盖」= 会话覆盖 ?? 同类默认(localStorage) ?? 空。仅收非空(有非默认项)的技法 →
	// 传给 getAnalysisTechniqueContexts 走强制重算；空 → 不进映射 → 默认路径(默认即现状)。
	// 依赖 mountSettingsNonce：点「设为同类默认/恢复默认」后重算。
	// eslint-disable-next-line react-hooks/exhaustive-deps
	const effectiveTechniqueOptions = React.useMemo((...args)=>computeEffectiveTechniqueOptionsImpl({ activeTechniqueKeys, activeSource, techniqueOptionOverrides }, ...args), [activeTechniqueKeys, techniqueOptionOverrides, mountSettingsNonce, activeSource]);
	// 稳定签名,供 useEffect 依赖(对象引用每次都变,用 JSON 串避免无谓重算)。
	const effectiveTechniqueOptionsSig = React.useMemo(
		()=>JSON.stringify(effectiveTechniqueOptions),
		[effectiveTechniqueOptions]
	);
	// [双盘挂载] 对方盘的每技法设置:会话覆盖与本人同一份,按对方盘现状剪(与本人同一个解析函数)
	// eslint-disable-next-line react-hooks/exhaustive-deps
	const partnerEffectiveTechniqueOptions = React.useMemo((...args)=>computePartnerEffectiveTechniqueOptionsImpl({ partnerSource, activeTechniqueKeys, techniqueOptionOverrides }, ...args), [activeTechniqueKeys, techniqueOptionOverrides, mountSettingsNonce, partnerSource]);
	const partnerEffectiveTechniqueOptionsSig = React.useMemo(
		()=>JSON.stringify(partnerEffectiveTechniqueOptions),
		[partnerEffectiveTechniqueOptions]
	);

	const modelOptions = React.useMemo((...args)=>computeModelOptionsImpl({ providerProfiles }, ...args), [providerProfiles]);

	// issue #13：嵌入(向量)模型下拉——各 provider 的 embeddingModels，与聊天模型独立。
	const embeddingOptions = React.useMemo((...args)=>computeEmbeddingOptionsImpl({ providerProfiles }, ...args), [providerProfiles]);

	const activeProviderProfile = React.useMemo((...args)=>computeActiveProviderProfileImpl({ modelSelection, providerProfiles }, ...args), [modelSelection, providerProfiles]);

	// 参数浮层的「可拨」必须与请求体一致:
	//  · 推理型号(OpenAI o/gpt-5 系、DeepSeek reasoner、*-r1、kimi-k 系…)由 Java 出口剥掉 temperature/top_p/两惩罚 → 三格置灰;
	//  · Anthropic 自适应族(Opus 4.7 起 / Sonnet 5 / Fable / Mythos)根本不接受采样参数 → 同置灰;
	//  · 温度上限按家族取(Anthropic 0..1,其余 0..2),此前滑杆一律到 2、拨过 1 必 400。
	const paramPopover = React.useMemo((...args)=>computeParamPopoverImpl({ modelSelection, activeProviderProfile }, ...args), [modelSelection, activeProviderProfile]);

	const referenceOptions = React.useMemo((...args)=>computeReferenceOptionsImpl({ materialFolders, bundles, materials, templates }, ...args), [materials, bundles, materialFolders, templates]);

	const visibleMessages = React.useMemo(()=>{
		return (messages || []).filter((item)=>item && item.role !== 'system_hidden');
	}, [messages]);

	const filteredConversations = React.useMemo((...args)=>computeFilteredConversationsImpl({ historyKeyword, conversations, historyFilter }, ...args), [conversations, historyKeyword, historyFilter]);

	// 勾选集只在点勾选框时由表格回调修剪 —— 改筛选 / 输关键词 / 批量归档后行从视图消失,
	// 勾选还在,批量钮照样可点并作用于**看不见的会话**(筛选结果为空时表格根本没挂载,「批量删除」依旧可点)。
	// 这里把勾选集与当前可见集取交:批量动作的作用面 = 你眼前看得见的那些。
	React.useEffect((...args)=>pruneHiddenHistorySelectionImpl({ filteredConversations, setSelectedHistoryIds }, ...args), [filteredConversations]);

	const filteredMaterials = React.useMemo((...args)=>computeFilteredMaterialsImpl({ materialKeyword, materials, selectedFolderId, materialSort }, ...args), [materials, materialKeyword, selectedFolderId, materialSort]);

	const filteredTemplates = React.useMemo((...args)=>computeFilteredTemplatesImpl({ templateKeyword, templates, bundles }, ...args), [templates, bundles, templateKeyword]);

	const filteredProfiles = React.useMemo((...args)=>computeFilteredProfilesImpl({ settingKeyword, providerProfiles }, ...args), [providerProfiles, settingKeyword]);

	// 命主实况(用户本人为这张命盘填写的问卷 / 断事日志等):开着照常出卡,关着但有内容出灰卡;打开挂载抽屉即按本机最新数据重读
	const subjectFacts = useSubjectFacts(activeSource, mountDrawerOpen);
	const lockedContextItems = React.useMemo(()=>{
		const resolved = resolveReferenceItems(referenceIds, materials, bundles, templates);
		const items = [];
		const pairOn = !!partnerSource;   // [双盘挂载] 有对方时两人的卡片都注明归属
		if(activeSource){
			items.push({
				key: `source:${activeSource.id}`,
				title: pairOn ? `案例前提（本人）· ${activeSource.title}` : `案例前提 · ${activeSource.title}`,
				type: activeSource.sourceType === 'chart' ? '命盘' : '事盘',
				content: sourceContext && sourceContext.content ? sourceContext.content : '',
				meta: sourceContext && sourceContext.meta ? sourceContext.meta : null,
				status: sourceContext && sourceContext.content ? 'ready' : 'pending',
				// 源全文也过「纳入内容」:显式全清与「读取中」分开提示。
				emptyHint: sourceContext && sourceContext.sectionsCleared
					? '该技法所有分段已在「纳入内容」中取消,案例前提未挂载任何内容;重新勾选即可恢复。'
					: '将自动读取案例快照',
			});
		}
		if(subjectFacts.card){
			items.push(subjectFacts.card);
		}
		if(sessionSystemPrompt){
			items.push({
				key: 'session-system-prompt',
				title: '本轮系统提示',
				type: 'system',
				content: sessionSystemPrompt,
				status: 'ready',
			});
		}
		(techniqueContexts || []).forEach((item)=>{
			items.push({
				key: `technique:${item.key}`,
				title: pairOn ? `技法 · ${item.title || item.key}（本人）` : `技法 · ${item.title || item.key}`,
				type: 'technique',
				content: item.content || '',
				meta: item.meta || null,
				status: item.status || (item.content ? 'ready' : 'missing'),
				// 显式全清(纳入内容一段未勾)与「快照缺失」分开提示,勿误导用户去排查排盘。
				emptyHint: item.sectionsCleared
					? '该技法所有分段已在「纳入内容」中取消,未挂载任何内容;到挂载设置重新勾选即可恢复。'
					: (item.status === 'missing'
						? '当前未找到该技法可用快照，未挂载该技法内容。'
						: (item.status === 'error'
							? '按挂载设置重算该技法快照失败，本次未挂载该技法内容;可调整设置重试或恢复默认。'
							: '正在按已存案例/命盘数据自动补生成快照。')),
			});
		});
		if(pairOn){
			items.push({
				key: `partner-source:${partnerSource.id}`,
				title: `案例前提（对方）· ${partnerSource.title}`,
				type: '命盘',
				content: partnerSourceContext && partnerSourceContext.content ? partnerSourceContext.content : '',
				meta: partnerSourceContext && partnerSourceContext.meta ? partnerSourceContext.meta : null,
				status: partnerSourceContext && partnerSourceContext.content ? 'ready' : 'pending',
				emptyHint: partnerSourceContext && partnerSourceContext.sectionsCleared
					? '该技法所有分段已在「纳入内容」中取消,案例前提未挂载任何内容;重新勾选即可恢复。'
					: '将自动读取对方命盘快照',
				partner: true,
			});
			(partnerTechniqueContexts || []).forEach((item)=>{
				items.push({
					key: `technique:${item.key}@partner`,
					title: `技法 · ${item.title || item.key}（对方）`,
					type: 'technique',
					content: item.content || '',
					meta: item.meta || null,
					status: item.status || (item.content ? 'ready' : 'missing'),
					emptyHint: item.sectionsCleared
						? '该技法所有分段已在「纳入内容」中取消,未挂载任何内容;到挂载设置重新勾选即可恢复。'
						: (item.status === 'missing'
							? '当前未找到对方命盘该技法的可用快照，未挂载该技法内容。'
							: (item.status === 'error'
								? '按挂载设置重算对方命盘该技法快照失败，本次未挂载该技法内容;可调整设置重试或恢复默认。'
								: '正在按对方命盘数据自动补生成快照。')),
					partner: true,
				});
			});
			// 中式合盘对照卡:两人都挂八字 / 紫微时出现(只有对照事实,不含评分)
			if(partnerChinese && partnerChinese.bazi){
				items.push({ key: 'pair:bazi-hehun', title: `八字合婚对照 · ${activeSource ? activeSource.title : '本人'} × ${partnerSource.title}`, type: '合盘', content: partnerChinese.bazi, status: 'ready', partner: true });
			}
			if(partnerChinese && partnerChinese.ziwei){
				items.push({ key: 'pair:ziwei', title: `紫微合盘对照 · ${activeSource ? activeSource.title : '本人'} × ${partnerSource.title}`, type: '合盘', content: partnerChinese.ziwei, status: 'ready', partner: true });
			}
			if(partnerSynastry){
				items.push({
					key: 'pair:synastry',
					title: `合盘数据（西洋）· ${activeSource ? activeSource.title : '本人'} × ${partnerSource.title}`,
					type: '合盘',
					content: partnerSynastry.content || '',
					status: partnerSynastry.status || (partnerSynastry.content ? 'ready' : 'missing'),
					emptyHint: partnerSynastry.status === 'pending' ? '正在按两张盘现算比较盘 / 组合盘 / 影响盘…' : '西洋合盘数据为空或生成失败,本次只按两张盘各自的挂载内容分析。',
					partner: true,
				});
			}
		}
		resolved.materials.forEach((item)=>{
			items.push({
				key: `material:${item.id}`,
				title: `资料 · ${item.name}`,
				type: item.kind || 'note',
				content: item.extractedText || '',
				status: item.extractedText ? 'ready' : 'pending',
			});
		});
		resolved.templates.forEach((item)=>{
			items.push({
				key: `template:${item.id}`,
				title: `模版 · ${item.name}`,
				type: item.format || 'text',
				content: item.instructionText || item.jsonSchema || item.content || '',
				status: 'ready',
			});
		});
		return items;
	}, [referenceIds, materials, bundles, templates, activeSource, sourceContext, subjectFacts.card, sessionSystemPrompt, techniqueContexts, partnerSource, partnerSourceContext, partnerTechniqueContexts, partnerSynastry, partnerChinese]);

	// 挂载面板：新出现的层默认展开（否则新加技法时面板看起来是空的）；用户手动收起的保持收起。
	const [contextActiveKeys, setContextActiveKeys] = React.useState([]);
	const seenContextKeysRef = React.useRef(new Set());
	React.useEffect((...args)=>syncContextActiveKeysImpl({ lockedContextItems, setContextActiveKeys, seenContextKeysRef }, ...args), [lockedContextItems]);

	// [chat-assist] 对话交互增强唯一插座:缺省全部空路径(mainline 原样/promptLayerExtras {}/checkpoint undefined)=现状
	// 按任务用模型:六槽全空时 pickRound/afterRound 皆零路径(请求字节不变)
	const chatModels = useChatModels({ providerProfiles });
	const chatAssist = useChatAssist({
		prompt, setPrompt, sending, messages, visibleMessages, setMessages, activeConversation, activeConversationId, conversations, setConversations,
		activeSource, sources, setSources, materials, bundles, templates, referenceIds, setReferenceIds, selectedTechniqueKeys, setSelectedTechniqueKeys,
		selectedSourceId, setSelectedSourceId, sessionSystemPrompt, setSessionSystemPrompt, techniqueOptionOverrides, setTechniqueOptionOverrides,
		partnerSourceId, setPartnerSourceId, partnerSource,   // [双盘挂载] /合盘 与 @ 第二张命盘挂对方;检查点随之回退
		modelSelection, setModelSelection, thinkingLevel, setThinkingLevel, activeProviderProfile, providerProfiles,
		// 回退检查点要能把温度 / top_p 也恢复(写偏好,与滑杆同源)
		chatTemperature, chatTopP,
		setChatTemperature: (v)=>{ setChatTemperature(v); saveUiPrefs({ chatTemperature: v }); },
		setChatTopP: (v)=>{ setChatTopP(v); saveUiPrefs({ chatTopP: v }); },
		promptClipStats, lastPromptMetaRef, lockedContextItems, handleSend, handleBranchFromMessage, buildResolvedPrompt, buildResolvedPromptQuiet, applyBundle,
		stopSequences, frequencyPenalty, presencePenalty, jsonMode,   // 浮层五类参数下传,三条旁路与主发送共用 applyChatParams
		updateConversationMeta, openConversation, setMountDrawerOpen, focusSourceSelect, setInnerTab, quickLaunchRef,   // 状态栏「命主」在未挂载时聚焦顶栏案例下拉
		innerTab, innerTabs: SECONDARY_TAB_ITEMS,   // 页内页签:当前值与页签表(navigate_to_technique 切 aianalysis 子页签用)
		reloadBundles: async ()=>setBundles(await listStoreRecords(AI_ANALYSIS_STORES.bundles)),
		ensureConversationRecord,   // 多模型对比在钩子里建/续会话
	});

	// 双波加载:APP(WKWebView)里 materials/conversations 大库的一次性读会把
	// 首开冻成「全页转圈很久」(WebKit IDB 大 value 反序列化慢,Chromium 无感 → preview 好 APP 坏)。
	// Wave1=轻库(接口档/夹/组/模板/包,小记录)——await 完立即收 loading,首帧秒出;
	// Wave2=后台(迁移→资料分批游标→版本/会话)——绝不挡首帧,批间让出主线程,到位即填充。
	// 🔴 迁移必须在 templateVersions 读取之前(migrate 会补建版本记录,先读后迁=模板打开缺版本)。
	const loadWorkspace = React.useCallback((...args)=>loadWorkspaceCbImpl({
		setWorkspaceLoading, setDeepLoading, setProviderProfiles, setMaterialFolders, setTagGroups,
		setTemplates, setBundles, setSources, setMaterials, setTemplateVersions, setConversations,
		activeConversationId, conversationLoadTokenRef, setMessages,
	}, ...args), [activeConversationId]);

	React.useEffect(()=>{
		loadWorkspace();
	}, [loadWorkspace]);

	React.useEffect(()=>{
		if(props.hook){
			props.hook.fun = ()=>{
				// horosa_panel_ready_v1:AI 分析是流式输出,没有「一次 setState 画完」的点;
				// 但 owner 要验收的那个动作(左栏切时间/改选项)在本技法上的完整语义就是
				// predictHook.fun —— 工作区按新盘重载(资料/模版/会话/挂载快照全部落 state)。
				// loadWorkspace 的 finally 里 setWorkspaceLoading(false) 是最后一次状态提交,
				// 故 await 之后即为面板落定;markPanelReady 内双 rAF 再推到下一绘制帧。
				// 流式回答的逐 token 追加**不**计入(那是模型出字速度,不属于渲染预算)。
				loadWorkspace({ keepConversation: true }).then(()=>{
					markPanelReady('aianalysis');
				}).catch(()=>{ /* 失败不记样本 */ });
			};
		}
	}, [props.hook, loadWorkspace]);

	React.useEffect(()=>{
		saveUiPrefs({
			innerTab,
			modelSelection,
			referenceIds,
			// 首帧 selectedSourceId 恒空 → activeTechniqueKeys=[] 曾立刻把 selectedTechniqueKeys 写空
			//   (注册表称保存「挂载勾选」,实际每次启动都丢)。无挂载源时不写该键(saveUiPrefs 合并,undefined 即保留旧值)。
			selectedTechniqueKeys: activeSource ? activeTechniqueKeys : undefined,
			sessionSystemPrompt,
		});
		if(props.dispatch){
			props.dispatch({
				type: 'astro/save',
				payload: {
					currentSubTab: innerTab,
				},
			});
		}
	}, [innerTab, modelSelection, referenceIds, activeTechniqueKeys, activeSource, sessionSystemPrompt, props.dispatch]);

	// eslint-disable-next-line react-hooks/exhaustive-deps
	React.useEffect((...args)=>resolveSourceContextImpl({ selectedSourceId, setSourceContext, sources, sourceContextMode }, ...args), [selectedSourceId, sources, sourceContextMode, mountSettingsNonce]);

	React.useEffect((...args)=>syncTechniqueSelectionToSourceImpl({
		activeSource, setTechniqueContexts, techniqueOptions, selectedTechniqueKeys,
		setSelectedTechniqueKeys,
	}, ...args), [activeSource, techniqueOptions, selectedTechniqueKeys]);

	// AI 生成的示例提问：只在 landing(无消息) 且有可用 Provider 时跑一次；按 (sourceId + provider + model) 缓存。
	// 失败/取消/无 provider → 静默退到静态示例。所有 setState 都通过 cancelled 守门避免组件卸载后写入。
	React.useEffect(()=>{
		const sourceKey = activeSource ? `${activeSource.sourceType}:${activeSource.id}` : 'none';
		const sel = parseModelSelection(modelSelection || '');
		const profile = activeProviderProfile;
		const provKey = profile ? `${profile.id || ''}-${sel.model || ''}` : '';
		const fetchKey = `${sourceKey}::${provKey}`;
		if(aiExamplePromptsBySource[fetchKey] || aiExamplesFetchKeyRef.current === fetchKey){
			return undefined;
		}
		if(!profile || !sel.model || !(profile.apiKey || profile.providerType === 'ollama')){
			return undefined;
		}
		// 已挂载消息时不必生成示例（用户已经在对话中）。
		if(messages.length > 0){
			return undefined;
		}
		aiExamplesFetchKeyRef.current = fetchKey;
		let cancelled = false;
		(async ()=>{
			try{
				setAiExamplesLoading(true);
				const sourceHint = activeSource
					? `当前案例：${activeSource.title}，类型=${activeSource.sourceType === 'chart' ? '命盘' : '事盘'}。`
					: '用户尚未选择案例（命盘/事盘）。';
				const sys = '你是星阙（Horosa）的占星/术数 AI 助手。根据当前案例上下文，给出 3 条用户可能想问的简短示例提问，每条 8-18 个汉字，覆盖差异化角度（如运势/格局/择时/吉凶等）。只输出 JSON 数组，例如：["...","...","..."]。不要加任何前后缀文字。';
				const usr = `${sourceHint}\n请给出 3 条示例提问。仅返回 JSON 数组。`;
				const opts = applyThinkingLevel({ ...(profile.providerOptions || {}) }, 'off', profile.providerType, sel.model);
				const rsp = await requestAIAnalysisChat({
					providerType: profile.providerType,
					apiKey: profile.apiKey,
					baseUrl: profile.baseUrl,
					model: sel.model,
					providerOptions: { ...(opts || {}), requestTimeoutMs: 20000 }, // 20s 上限，慢就不展示
					messages: [
						{ role: 'system', content: sys },
						{ role: 'user', content: usr },
					],
				});
				if(cancelled){ return; }
				const text = rsp && rsp.Result && rsp.Result.content ? `${rsp.Result.content}`.trim() : '';
				let arr = null;
				try{
					const m = text.match(/\[[\s\S]*\]/);
					if(m){ arr = JSON.parse(m[0]); }
				}catch(_){ arr = null; }
				if(Array.isArray(arr)){
					const clean = arr.map((s)=>`${s || ''}`.trim()).filter((s)=>s && s.length <= 50).slice(0, 3);
					if(clean.length >= 2){
						setAiExamplePromptsBySource((prev)=>({ ...prev, [fetchKey]: clean }));
					}
				}
			}catch(e){
				// 静默失败：保持静态示例。
			}finally{
				if(!cancelled){ setAiExamplesLoading(false); }
			}
		})();
		return ()=>{
			cancelled = true;
		};
	}, [activeSource ? `${activeSource.sourceType}:${activeSource.id}` : 'none', modelSelection, messages.length, activeProviderProfile]);

	// 组合包待挂载技法落地：选定 source 后，把 pending 技法与该 source 支持集取交集，合并入已选技法。
	React.useEffect((...args)=>applyPendingBundleTechniquesImpl({
		activeSource, pendingBundleTechniqueKeys, techniqueOptions, setSelectedTechniqueKeys,
		setPendingBundleTechniqueKeys,
	}, ...args), [activeSource, techniqueOptions, pendingBundleTechniqueKeys]);

	React.useEffect((...args)=>buildTechniqueContextsImpl({
		activeSource, activeTechniqueKeys, setTechniqueContexts, techniqueLabelMap,
		effectiveTechniqueOptions, sourceContext,
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, ...args), [activeSource, activeTechniqueKeys, sourceContext, techniqueLabelMap, effectiveTechniqueOptionsSig, mountSettingsNonce]);

	// [双盘挂载] 对方盘的案例前提 + 各技法快照(只供挂载预览卡;发送时 buildResolvedPromptImpl 另行现算,不依赖这里)
	// eslint-disable-next-line react-hooks/exhaustive-deps
	React.useEffect((...args)=>buildPartnerCasePremiseImpl({ partnerSource, setPartnerSourceContext, sourceContextMode }, ...args), [partnerSource, sourceContextMode, mountSettingsNonce]);

	React.useEffect((...args)=>buildPartnerTechniqueContextsImpl({
		partnerSource, activeTechniqueKeys, setPartnerTechniqueContexts, techniqueLabelMap,
		partnerEffectiveTechniqueOptions, partnerSourceContext,
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, ...args), [partnerSource, activeTechniqueKeys, partnerSourceContext, techniqueLabelMap, partnerEffectiveTechniqueOptionsSig, mountSettingsNonce]);

	// 中式合盘对照(预览卡):两人都挂八字 / 紫微才算;纯前端同步计算、按这一对缓存,发送时同一份
	React.useEffect((...args)=>buildCnPairCompareImpl({
		partnerSource, activeSource, setPartnerChinese, activeTechniqueKeys, effectiveTechniqueOptions,
		partnerEffectiveTechniqueOptions,
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, ...args), [partnerSource, activeSource, activeTechniqueKeys, mountSettingsNonce, effectiveTechniqueOptionsSig, partnerEffectiveTechniqueOptionsSig]);

	// [双盘挂载] 两人之间的西洋合盘数据(预览卡):没勾技法或勾了西洋本命类才算;按「这一对」缓存,发送时同一份
	React.useEffect((...args)=>buildWesternPairDataImpl({
		partnerSource, activeSource, activeTechniqueKeys, setPartnerSynastry, effectiveTechniqueOptions,
		partnerEffectiveTechniqueOptions,
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, ...args), [partnerSource, activeSource, activeTechniqueKeys, mountSettingsNonce, effectiveTechniqueOptionsSig, partnerEffectiveTechniqueOptionsSig]);

	React.useEffect((...args)=>guardModelSelectionImpl({ modelOptions, modelSelection, setModelSelection }, ...args), [modelOptions, modelSelection]);

	React.useEffect((...args)=>followChatScrollImpl({ chatLogRef, autoFollow }, ...args), [visibleMessages, autoFollow]);

	// 监听用户滚动：上滚 >40px 自动暂停跟随；回到底部恢复跟随。(依赖聊天区节点,节点出现即挂)
	React.useEffect((...args)=>watchChatScrollPauseImpl({ chatLogNode, setAutoFollow }, ...args), [chatLogNode]);

	// 跟踪组件挂载状态，供异步流程安全 setState。
	React.useEffect(()=>{
		isMountedRef.current = true;
		return ()=>{ isMountedRef.current = false; };
	}, []);

	// 代码块「复制按钮」事件委托（容器级）：点击 .xq-code-copy → 复制紧邻 <pre><code> 的纯文本。(随聊天区节点挂载)
	React.useEffect((...args)=>delegateCodeCopyImpl({ chatLogNode }, ...args), [chatLogNode]);

	// 代码块语法高亮：visibleMessages 变化后，对未高亮过的 <pre><code> 跑 hljs.highlightElement。
	// 流式期间也跑（每次新片段后增量补色），出错静默回退；不会改 textContent，复制功能不受影响。
	React.useEffect(()=>{
		const el = chatLogRef.current;
		if(!el){ return; }
		highlightCodeUnder(el);
	}, [visibleMessages]);

	const applyProviderPresetToForm = React.useCallback((...args)=>applyProviderPresetToFormCbImpl({ providerForm }, ...args), [providerForm]);

	function startNewConversation(...args){ return startNewConversationImpl({
		abortRef, setActiveConversationId, setMessages, setPrompt, setSelectedHistoryIds, setPendingImages,
		setPromptClipStats, setInnerTab,
	}, ...args); }   // 实现在 ./main/chatFlow.js

	function openConversation(...args){ return openConversationImpl({
		abortRef, setActiveConversationId, setTimepointDraft, setNatalDraft, setSelectedSourceId,
		setPartnerSourceId, setReferenceIds, setSelectedTechniqueKeys, providerProfiles, setModelSelection,
		setSessionSystemPrompt, conversationLoadTokenRef, setMessages, setInnerTab,
	}, ...args); }   // 实现在 ./main/conversationFlow.js

	function ensureConversationRecord(...args){ return ensureConversationRecordImpl({
		activeSource, sources, partnerSource, activeConversation, referenceIds, activeTechniqueKeys,
		sessionSystemPrompt, setConversations, setActiveConversationId,
	}, ...args); }   // 实现在 ./main/conversationFlow.js

	// issue #13：解析「嵌入(向量)模型」目标——三态向后兼容，避免老用户回归。
	// 逻辑平移进 aiAnalysisRag.resolveEmbeddingTargetFromPrefs(与其它调用方同源复用),此处仅代理。
	function resolveEmbeddingTarget(chatProfile, bundleEmbeddingModel){
		return resolveEmbeddingTargetFromPrefs({ embeddingSelection, providerProfiles, chatProfile, bundleEmbeddingModel });
	}

	function retrieveMaterialContext(...args){ return retrieveMaterialContextImpl(...args); }   // 实现在 ./main/chatFlow.js

	function updateConversationMeta(...args){ return updateConversationMetaImpl({ setConversations }, ...args); }   // 实现在 ./main/conversationFlow.js

	function generateAndApplyAutoTitle(...args){ return generateAndApplyAutoTitleImpl({ providerProfiles, isMountedRef, updateConversationMeta }, ...args); }   // 实现在 ./main/chatFlow.js

	function streamReply(...args){ return streamReplyImpl({
		streamBufferRef, streamReasoningBufferRef, streamUsageRef, setMessages, abortRef, chatModels,
		setSources, setSelectedSourceId, chatAssist, techniqueOptionOverrides, thinkingLevel,
		chatTemperature, chatTopP, stopSequences, frequencyPenalty, presencePenalty, jsonMode, messages,
		lastPromptMetaRef, updateConversationMeta, generateAndApplyAutoTitle,
	}, ...args); }   // 实现在 ./main/chatFlow.js

	function buildResolvedPromptImpl(...args){ return buildResolvedPromptImplImpl({
		referenceIds, materials, bundles, templates, activeSource, activeConversation, sources,
		activeTechniqueKeys, techniqueOptionOverrides, effectiveTechniqueOptions, partnerSource,
		sourceContext, chatAssist, setSourceContext, setTechniqueContexts, partnerEffectiveTechniqueOptions,
		setPartnerSourceContext, setPartnerTechniqueContexts, retrieveMaterialContext,
		resolveEmbeddingTarget, visibleMessages, sessionSystemPrompt, modelSelection, jsonMode, isMountedRef,
		setPromptClipStats, selectedSourceId, lastPromptMetaRef,
	}, ...args); }   // 实现在 ./main/chatFlow.js
	// 主发送路径(含重试 / 重新生成 / 编辑并分支):照旧写页面态
	async function buildResolvedPrompt(currentPrompt, profile, extraSystemContext, turn){
		return buildResolvedPromptImpl(currentPrompt, profile, extraSystemContext, false, turn);
	}
	// 旁路专用:同一份 system(前缀逐字节同构、照吃缓存),但一个页面态都不写
	async function buildResolvedPromptQuiet(currentPrompt, profile, extraSystemContext, turn){
		return buildResolvedPromptImpl(currentPrompt, profile, extraSystemContext, true, turn);
	}

	function handlePickImages(...args){ return handlePickImagesImpl({ isMountedRef, setPendingImages }, ...args); }   // 实现在 ./main/chatFlow.js

	function handleExampleClick(...args){ return handleExampleClickImpl({ handleSend, activeSource, setPrompt }, ...args); }   // 实现在 ./main/chatFlow.js

	function handleSend(...args){ return handleSendImpl({
		sending, sendingRef, prompt, chatAssist, pendingImages, activeSource, modelSelection,
		providerProfiles, setSending, beginSendAbort, ensureConversationRecord, prepAborted,
		buildResolvedPrompt, setMessages, setPrompt, setPendingImages, streamReply, visibleMessages,
	}, ...args); }   // 实现在 ./main/conversationFlow.js

	function handleStopStreaming(){
		if(abortRef.current){
			abortRef.current.abort();
		}
	}

	// 发送 / 重答 / 重试 / 分支四个入口一按下就建控制器并挂上 abortRef:
	//   此前控制器只在 streamReply 里建,而「重算挂载快照 → 拼提示词 → 落库」这段准备期可长达数秒,
	//   期间停止钮已显示(sending=true)却点不动(abortRef 还是上一轮或 null),等准备完照样发一次请求烧 token。
	function beginSendAbort(){
		const c = new AbortController();
		abortRef.current = c;
		return c;
	}
	// 准备阶段各 await 之后调用:已被停止 → 收尾并早退(true = 调用方 return)
	function prepAborted(c){
		if(!c || !c.signal.aborted){ return false; }
		try{ message.info('已停止'); }catch(e){ /* noop */ }
		if(abortRef.current === c){ abortRef.current = null; }
		return true;
	}

	async function resetConversationDraft(options){
		await startNewConversation(options || {});
	}

	function handleDeleteConversation(...args){ return handleDeleteConversationImpl({
		activeConversationId, abortRef, setConversations, setSelectedHistoryIds, resetConversationDraft,
	}, ...args); }   // 实现在 ./main/conversationActions.js

	function handleDuplicateConversation(...args){ return handleDuplicateConversationImpl({ setConversations }, ...args); }   // 实现在 ./main/conversationActions.js

	function handleRenameConversation(...args){ return handleRenameConversationImpl({ updateConversationMeta }, ...args); }   // 实现在 ./main/conversationActions.js

	async function handleToggleConversationFlag(conversation, key){
		await updateConversationMeta(conversation, {
			[key]: !conversation[key],
		});
	}

	async function handleArchiveSelected(value){
		await Promise.all(selectedHistoryIds.map(async (id)=>{
			const conversation = conversations.find((item)=>item.id === id);
			if(conversation){
				await updateConversationMeta(conversation, { archived: value });
			}
		}));
		message.success(value ? '已归档所选对话' : '已取消归档');
	}

	async function handleFavoriteSelected(value){
		await Promise.all(selectedHistoryIds.map(async (id)=>{
			const conversation = conversations.find((item)=>item.id === id);
			if(conversation){
				await updateConversationMeta(conversation, { favorite: value });
			}
		}));
		message.success(value ? '已收藏所选对话' : '已取消收藏');
	}

	async function handleBatchDeleteConversations(){
		const total = selectedHistoryIds.length;
		for(let i=0; i<total; i++){
			await handleDeleteConversation(selectedHistoryIds[i], { silent: true });   // 只弹一条汇总
		}
		setSelectedHistoryIds([]);
		if(total){ message.success(`已删除 ${total} 个对话`); }
	}

	function exportConversation(...args){ return exportConversationImpl(...args); }   // 实现在 ./main/conversationActions.js

	async function exportSelectedConversations(){
		const list = conversations.filter((item)=>selectedHistoryIds.includes(item.id));
		if(!list.length){
			message.warning('请先选择要导出的对话');
			return;
		}
		const blob = await exportConversationBundle(list, async (conversation)=>listConversationMessages(conversation.id));
		notifySaveResult(await saveBlobToBrowser('ai-analysis-conversations.zip', blob), `已导出 ${list.length} 个对话`);
	}

	// 清理挂载上下文派生缓存:排障(疑似挂载内容陈旧)与腾空间的手动出口;存档与对话不受影响。
	async function handleClearContextCache(){
		try{
			const before = await countStoreRecords(AI_ANALYSIS_STORES.contextCache);
			await clearStore(AI_ANALYSIS_STORES.contextCache);
			message.success(`已清理 ${before} 条上下文缓存,下次挂载按当前存档重建`);
		}catch(e){
			message.error(`清理失败:${e && e.message ? e.message : e}`);
		}
	}

	async function handleExportWorkspaceBackup(){
		// 整段读库 + 序列化包进 try:此前只包桌面保存桥,读库失败 / 大库 JSON.stringify 超限 = 未处理 rejection 且无提示。
		try{
			await exportWorkspaceBackupInner();
		}catch(e){
			console.warn('[ai backup] export failed', e);
			message.error(`导出备份失败:${(e && e.message) || e}`);
		}
	}
	function exportWorkspaceBackupInner(...args){ return exportWorkspaceBackupInnerImpl(...args); }   // 实现在 ./main/workspaceActions.js

	// 库健康态:IndexedDB 打不开(VersionError = 同名库被更新版本升过)落内存回退时顶部横幅告知
	const [storeHealth, setStoreHealth] = React.useState(()=>getAiStoreHealth());
	React.useEffect((...args)=>watchStoreHealthImpl({ setStoreHealth }, ...args), []);
	// 设置没写进(存储满 / 坏原串封锁):写入方已按存储里的实际值广播,这里提示一次(3 秒内只提示一次)
	React.useEffect((...args)=>notifySettingNotSavedImpl(...args), []);
	// 库读不开期间(内存回退)载入的会话 / 资料 / 模板列表是空的、不是库里的真值:库重开后重载一遍
	// (流式回复进行中不重载当前会话的消息,免得把正在写的那条换掉)
	const loadWorkspaceLatestRef = React.useRef(loadWorkspace);
	loadWorkspaceLatestRef.current = loadWorkspace;
	React.useEffect((...args)=>reloadOnStoreRecoveredImpl({ loadWorkspaceLatestRef, sendingRef }, ...args), []);

	function restoreWorkspaceBackup(...args){ return restoreWorkspaceBackupImpl({ loadWorkspace, resetConversationDraft }, ...args); }   // 实现在 ./main/conversationActions.js

	function handleRestoreWorkspaceBackup(...args){ return handleRestoreWorkspaceBackupImpl({ desktopBridge, restoreWorkspaceBackup, backupRestoreInputRef }, ...args); }   // 实现在 ./main/conversationActions.js

	function handleBackupRestoreInputChange(...args){ return handleBackupRestoreInputChangeImpl({ restoreWorkspaceBackup, backupRestoreInputRef }, ...args); }   // 实现在 ./main/conversationActions.js

	function openMaterialEditor(...args){ return openMaterialEditorImpl({ setEditingMaterial, materialForm, setMaterialModalOpen }, ...args); }   // 实现在 ./main/materialActions.js

	function saveMaterialForm(...args){ return saveMaterialFormImpl({ materialForm, editingMaterial, setMaterials, setMaterialModalOpen, setEditingMaterial }, ...args); }   // 实现在 ./main/materialActions.js

	function saveImportedMaterial(...args){ return saveImportedMaterialImpl({ setMaterials }, ...args); }   // 实现在 ./main/materialActions.js

	// batch = 本批导入的去重台账 { seen: Map<fileHash, 已入库记录> }。
	// `materials` 是 render 期快照,`setMaterials` 在同一个批量循环里不会回灌 ⇒ 一批里的第二份同文件
	// 在 materials 里查不到重复、**静默入库**(用户拖一个目录进来,重复文件就这样悄悄翻倍)。
	// 单文件入口不传 batch = 逐字节走原路径。
	function newImportBatch(){ return { seen: new Map() }; }
	function handleImportFileLike(...args){ return handleImportFileLikeImpl({ materials, loadWorkspace, saveImportedMaterial }, ...args); }   // 实现在 ./main/materialActions.js

	function importFileLikeList(...args){ return importFileLikeListImpl({ newImportBatch, handleImportFileLike }, ...args); }   // 实现在 ./main/materialActions.js

	function clearFileInput(ref){
		if(ref && ref.current){
			ref.current.value = '';
		}
	}

	function openFallbackFilePicker(ref){
		if(ref && ref.current){
			ref.current.click();
			return true;
		}
		return false;
	}

	function formatImportError(prefix, error){
		const text = error && error.message ? `${error.message}` : `${error || ''}`;
		if(!text || text === 'Error'){
			return prefix;
		}
		return `${prefix}：${text}`;
	}

	function handleUploadMaterial(...args){ return handleUploadMaterialImpl({ handleImportFileLike }, ...args); }   // 实现在 ./main/materialActions.js

	function handleCreateFolder(...args){ return handleCreateFolderImpl({ folderDraftName, setMaterialFolders, setFolderDraftName }, ...args); }   // 实现在 ./main/materialActions.js
	function handleRenameFolder(...args){ return handleRenameFolderImpl({ setMaterialFolders }, ...args); }   // 实现在 ./main/materialActions.js
	function handleDeleteFolder(...args){ return handleDeleteFolderImpl({ materials, setMaterialFolders, loadWorkspace, selectedFolderId, setSelectedFolderId }, ...args); }   // 实现在 ./main/materialActions.js
	async function handleMoveMaterial(material, folderId){
		try{
			const saved = await putStoreRecord(AI_ANALYSIS_STORES.materials, { ...material, folderId: folderId || null, updatedAt: new Date().toISOString(), }, 'material');
			await loadWorkspace({ keepConversation: true });
			message.success(folderId ? '已移动' : '已移到「未分类」');
			return saved;
		}catch(e){ console.error(e); message.error('移动失败'); }
	}

	function ingestFiles(...args){ return ingestFilesImpl({ isMountedRef, setMaterialIngestQueue, materials, saveImportedMaterial, loadWorkspace }, ...args); }   // 实现在 ./main/materialActions.js

	function pruneConversationRefs(...args){ return pruneConversationRefsImpl({ setConversations }, ...args); }   // 实现在 ./main/conversationActions.js

	// 桌面拿到的文件转成 File 后交给 ingestFiles —— 与拖拽 / 浏览器选择共用同一套
	// 决策弹窗(跳过 / 全部跳过 / 覆盖 / 全部覆盖)、逐文件队列、白名单与超大文件确认。
	function desktopItemsToFiles(items){
		return (items || []).map((item)=>{
			const blob = base64ToBlob(item.base64Data, item.mimeType || 'application/octet-stream');
			return new File([blob], item.fileName, { type: item.mimeType || '' });
		});
	}

	function handleDesktopFilePick(...args){ return handleDesktopFilePickImpl({
		clearFileInput, desktopFileInputRef, openFallbackFilePicker, formatImportError, ingestFiles,
		desktopItemsToFiles,
	}, ...args); }   // 实现在 ./main/materialActions.js

	function handleDesktopFolderImport(...args){ return handleDesktopFolderImportImpl({
		clearFileInput, desktopFolderInputRef, openFallbackFilePicker, formatImportError, ingestFiles,
		desktopItemsToFiles,
	}, ...args); }   // 实现在 ./main/materialActions.js

	function handleDesktopFileInputChange(...args){ return handleDesktopFileInputChangeImpl({ importFileLikeList, formatImportError, clearFileInput, desktopFileInputRef }, ...args); }   // 实现在 ./main/materialActions.js

	function handleDesktopFolderInputChange(...args){ return handleDesktopFolderInputChangeImpl({ importFileLikeList, formatImportError, clearFileInput, desktopFolderInputRef }, ...args); }   // 实现在 ./main/materialActions.js

	function deleteMaterial(...args){ return deleteMaterialImpl({ setMaterials, setReferenceIds, pruneConversationRefs, pruneBundleRefs }, ...args); }   // 实现在 ./main/materialActions.js

	function handleReplaceMaterial(...args){ return handleReplaceMaterialImpl({ setMaterials }, ...args); }   // 实现在 ./main/materialActions.js

	async function exportMaterialOriginal(material){
		if(!material.originBlob){
			message.warning('这份资料没有保存原文件');
			return;
		}
		const blob = base64ToBlob(material.originBlob, material.mimeType || 'application/octet-stream');
		notifySaveResult(await saveBlobToBrowser(material.fileName || material.name || 'material.bin', blob), '已导出原文件');
	}

	// 与兄弟导出(原文件 / 会话 / 备份)同一路数:桌面端先走 saveDesktopFile 弹系统保存框,
	// 失败再回落浏览器下载。此前「提取文本」在桌面端直接落浏览器下载目录(用户选不了位置)。
	// BOM 在两条路上都保:浏览器路径由 downloadTextFile 的 withUtf8Bom 加,桌面路径在这里同款加
	// (少了它,Windows 记事本/Excel 打开中文提取稿是乱码)。
	async function exportMaterialText(material){
		const fileName = `${material.name || 'material'}.txt`;
		const mime = 'text/plain;charset=utf-8';
		const text = material.extractedText || '';
		// downloadTextFile 内部已单源(桌面壳保存桥 + BOM);取消 / 失败如实提示。
		notifySaveResult(await downloadTextFile(fileName, text, mime), '已导出提取文本');
	}

	function dedupeMaterials(...args){ return dedupeMaterialsImpl({ materials, deleteMaterial }, ...args); }   // 实现在 ./main/materialActions.js

	function openTemplateEditor(...args){ return openTemplateEditorImpl({ setEditingTemplate, templateForm, setTemplateModalOpen }, ...args); }   // 实现在 ./main/templateProviderActions.js

	function saveTemplateForm(...args){ return saveTemplateFormImpl({
		templateForm, editingTemplate, templateVersions, setTemplates, setTemplateVersions,
		setTemplateModalOpen, setEditingTemplate,
	}, ...args); }   // 实现在 ./main/templateProviderActions.js

	function pruneBundleRefs(...args){ return pruneBundleRefsImpl({ bundles, setBundles }, ...args); }   // 实现在 ./main/workspaceActions.js

	function deleteTemplate(...args){ return deleteTemplateImpl({
		setTemplates, setTemplateVersions, setReferenceIds, pruneConversationRefs, pruneBundleRefs,
	}, ...args); }   // 实现在 ./main/templateProviderActions.js

	function rollbackTemplateVersion(...args){ return rollbackTemplateVersionImpl({ templateVersions, setTemplates, setTemplateVersions }, ...args); }   // 实现在 ./main/templateProviderActions.js

	function openBundleEditor(...args){ return openBundleEditorImpl({ setEditingBundle, bundleForm, setBundleModalOpen }, ...args); }   // 实现在 ./main/templateProviderActions.js

	function saveBundleForm(...args){ return saveBundleFormImpl({ bundleForm, editingBundle, setBundles, setBundleModalOpen, setEditingBundle }, ...args); }   // 实现在 ./main/templateProviderActions.js

	async function deleteBundle(bundleId){
		await deleteStoreRecord(AI_ANALYSIS_STORES.bundles, bundleId);
		setBundles((prev)=>prev.filter((item)=>item.id !== bundleId));
		setReferenceIds((prev)=>prev.filter((item)=>item !== `bundle:${bundleId}`));
		const cleaned = await pruneConversationRefs(`bundle:${bundleId}`);
		message.success(cleaned ? `组合已删除（同时从 ${cleaned} 个会话的挂载引用里移除）` : '组合已删除');
	}

	function applyBundle(...args){ return applyBundleImpl({
		referenceIds, setReferenceIds, setModelSelection, setSessionSystemPrompt,
		setPendingBundleTechniqueKeys, setChatTemperature, setChatTopP, setThinkingLevel, setInnerTab,
	}, ...args); }   // 实现在 ./main/conversationFlow.js

	function openProviderEditor(profile){
		setEditingProvider(profile || null);
		providerForm.setFieldsValue(buildProviderFormValues(profile));
		setProviderAdvancedOpen(false);
		setProviderModalOpen(true);
	}

	function saveProviderForm(...args){ return saveProviderFormImpl({
		providerForm, editingProvider, setProviderProfiles, setProviderModalOpen, setProviderAdvancedOpen,
		setEditingProvider, fetchModelsAndEmbeddings,
	}, ...args); }   // 实现在 ./main/templateProviderActions.js

	function deleteProvider(...args){ return deleteProviderImpl({
		providerProfiles, setProviderProfiles, modelSelection, setModelSelection, pruneBundleRefs,
	}, ...args); }   // 实现在 ./main/templateProviderActions.js

	function setProviderAsCurrent(...args){ return setProviderAsCurrentImpl({ setModelSelection, setProviderSwitchModalOpen }, ...args); }   // 实现在 ./main/templateProviderActions.js

	function fetchModelsAndEmbeddings(...args){ return fetchModelsAndEmbeddingsImpl({ setProviderProfiles }, ...args); }   // 实现在 ./main/workspaceActions.js

	function runProviderDiagnostics(...args){ return runProviderDiagnosticsImpl({ setProviderProfiles }, ...args); }   // 实现在 ./main/templateProviderActions.js

	function testProfileChat(...args){ return testProfileChatImpl({ setConnState }, ...args); }   // 实现在 ./main/templateProviderActions.js

	function countUndoableActions(...args){ return countUndoableActionsImpl(...args); }   // 实现在 ./main/chatFlow.js

	function handleRegenerateLastReply(...args){ return handleRegenerateLastReplyImpl({
		modelSelection, activeConversation, providerProfiles, sending, sendingRef, countUndoableActions,
		setMessages, setSending, beginSendAbort, buildResolvedPrompt, prepAborted, updateConversationMeta,
		streamReply, chatAssist,
	}, ...args); }   // 实现在 ./main/chatFlow.js

	// A: 复制该条消息全文(copyTextSmart:桌面原生 → navigator.clipboard → execCommand 三级)。
	function handleCopyMessage(item){
		const text = item && item.content ? `${item.content}` : '';
		if(!text){ return; }
		copyTextSmart(text).then((ok)=>{
			if(ok){ message.success('已复制全文'); }
			else{ message.error('复制失败，请手动选择文本复制'); }
		});
	}

	function handleRegenerateMessage(...args){ return handleRegenerateMessageImpl({
		modelSelection, activeConversation, providerProfiles, sending, sendingRef, messages, setMessages,
		setSending, beginSendAbort, buildResolvedPrompt, prepAborted, streamReply, chatAssist,
	}, ...args); }   // 实现在 ./main/chatFlow.js

	function handleSaveQuickDraftAsSource(...args){ return handleSaveQuickDraftAsSourceImpl({ selectedSourceId, natalDraft, timepointDraft, setSources, setSelectedSourceId }, ...args); }   // 实现在 ./main/chatFlow.js

	function handleEditMessageAndBranch(...args){ return handleEditMessageAndBranchImpl({
		activeConversation, modelSelection, providerProfiles, sending, sendingRef, setConversations,
		openConversation, setSending, beginSendAbort, buildResolvedPrompt, prepAborted, streamReply,
		chatAssist,
	}, ...args); }   // 实现在 ./main/chatFlow.js

	function handleEditLastUserAndBranch(...args){ return handleEditLastUserAndBranchImpl({ activeConversation, handleEditMessageAndBranch }, ...args); }   // 实现在 ./main/chatFlow.js

	function handleBranchFromMessage(...args){ return handleBranchFromMessageImpl({ activeConversation, setConversations, openConversation, messages }, ...args); }   // 实现在 ./main/conversationFlow.js

	function renderConnChip(...args){ return renderConnChipImpl({ activeProviderProfile, connState, modelSelection, openProviderEditor, testProfileChat }, ...args); }   // 实现在 ./main/mountViews.js

	// ===== AI 挂载「每技法设置」抽屉：纳入内容(共用 AI导出 sections) + 该技法排盘/起卦设置 =====

	function openTechniqueSettings(...args){ return openTechniqueSettingsImpl({
		activeSource, techniqueOptionOverrides, setTechniqueSettingsKey, setTechniqueSettingsDraft,
	}, ...args); }   // 实现在 ./main/mountViews.js

	function closeTechniqueSettings(){
		setTechniqueSettingsKey('');
		setTechniqueSettingsDraft({});
	}

	function updateTechniqueDraftField(name, value){
		// 草稿是整张(缺省 + 盘现状 + 会话覆盖):改一项经 schema 联动(六爻换派像页面一样套预设细项)
		const k = techniqueSettingsKey;
		setTechniqueSettingsDraft((prev)=>applyTechniqueDraftChange(k, prev, name, value));
	}

	function applyTechniqueSettings(...args){ return applyTechniqueSettingsImpl({
		techniqueSettingsKey, techniqueSettingsDraft, activeSource, setTechniqueOptionOverrides,
	}, ...args); }   // 实现在 ./main/mountViews.js

	function saveTechniqueAsDefault(...args){ return saveTechniqueAsDefaultImpl({
		techniqueSettingsKey, techniqueSettingsDraft, activeSource, setTechniqueOptionOverrides,
		setMountSettingsNonce,
	}, ...args); }   // 实现在 ./main/mountViews.js

	function resetTechniqueSettings(...args){ return resetTechniqueSettingsImpl({
		techniqueSettingsKey, setTechniqueOptionOverrides, setTechniqueSettingsDraft, activeSource,
		setMountSettingsNonce,
	}, ...args); }   // 实现在 ./main/mountViews.js

	// ---- 纳入内容（段勾选）：读写同一份 aiExport 设置 → 与「AI导出设置」四同步 ----

	function persistAIExportSettings(...args){ return persistAIExportSettingsImpl({ setMountSettingsNonce }, ...args); }   // 实现在 ./main/mountViews.js

	function getTechExportMeta(key){
		const list = listAIExportTechniqueSettings();
		return list.find((item)=>item.key === key) || null;
	}

	function getEffectiveSectionSelected(key){
		// 当前生效段（用户选了用选中、否则 preset）。用于复选框勾选态。
		return getAIExportEffectiveSectionsForTechnique(key, loadAIExportSettings());
	}

	function toggleSectionForTech(key, section){
		const selectedNow = getEffectiveSectionSelected(key);
		const has = selectedNow.indexOf(section) >= 0;
		const nextSel = has ? selectedNow.filter((s)=>s !== section) : selectedNow.concat([section]);
		persistAIExportSettings((draft)=>{
			draft.sections[key] = nextSel;
			return draft;
		});
	}

	function selectAllSectionsForTech(key, allOptions){
		persistAIExportSettings((draft)=>{
			draft.sections[key] = (allOptions || []).slice(0);
			return draft;
		});
	}

	function clearSectionsForTech(key){
		persistAIExportSettings((draft)=>{
			draft.sections[key] = [];
			return draft;
		});
	}

	function resetSectionsForTech(key){
		// 删该 key 的段/后天/术语自定义 → 回 preset 全段(默认即现状)。
		persistAIExportSettings((draft)=>{
			delete draft.sections[key];
			delete draft.planetInfo[key];
			delete draft.astroMeaning[key];
			return draft;
		});
	}

	function togglePlanetInfoForTech(...args){ return togglePlanetInfoForTechImpl({ persistAIExportSettings }, ...args); }   // 实现在 ./main/mountViews.js

	function toggleAstroMeaningForTech(key, checked){
		persistAIExportSettings((draft)=>{
			draft.astroMeaning[key] = { enabled: checked ? 1 : 0 };
			return draft;
		});
	}

	function renderTechniqueSettingsDrawer(...args){ return renderTechniqueSettingsDrawerImpl({
		techniqueSettingsKey, techniqueLabelMap, getTechExportMeta, getEffectiveSectionSelected,
		activeSource, techniqueSettingsDraft, closeTechniqueSettings, techniqueDraftContext,
		updateTechniqueDraftField, applyTechniqueSettings, saveTechniqueAsDefault, resetTechniqueSettings,
		toggleSectionForTech, selectAllSectionsForTech, clearSectionsForTech, resetSectionsForTech,
		togglePlanetInfoForTech, toggleAstroMeaningForTech,
	}, ...args); }   // 实现在 ./main/mountViews.js

	function renderMountDrawer(...args){ return renderMountDrawerImpl({
		mountDrawerOpen, setMountDrawerOpen, activeSource, selectedSourceId, natalDraft, timepointDraft,
		setNatalDraft, setTimepointDraft, setSelectedTechniqueKeys, handleSaveQuickDraftAsSource,
		activeTechniqueKeys, groupedTechniqueOptions, partnerSource, partnerOptions, setPartnerSourceId,
		referenceIds, setReferenceIds, referenceOptions, sessionSystemPrompt, setSessionSystemPrompt,
		lockedContextItems, contextActiveKeys, setContextActiveKeys, effectiveTechniqueOptions,
		promptClipStats, openTechniqueSettings,
	}, ...args); }   // 实现在 ./main/mountViews.js

	function renderContextBanner(...args){ return renderContextBannerImpl({
		activeTechniqueKeys, referenceIds, activeSource, focusSourceSelect, partnerSource, promptClipStats,
		setMountDrawerOpen,
	}, ...args); }   // 实现在 ./main/mountViews.js

	function diffLines(...args){ return diffLinesImpl(...args); }   // 实现在 ./main/sideViews.js
	function renderTemplateVersionDiff(...args){ return renderTemplateVersionDiffImpl({ versionDiffState, setVersionDiffState, templateVersions, diffLines }, ...args); }   // 实现在 ./main/sideViews.js

	function renderLandingExamples(...args){ return renderLandingExamplesImpl({
		activeSource, modelSelection, activeProviderProfile, aiExamplePromptsBySource, handleExampleClick,
		aiExamplesLoading,
	}, ...args); }   // 实现在 ./main/analysisView.js

	function renderLandingSetup(...args){ return renderLandingSetupImpl({
		activeProviderProfile, activeTechniqueKeys, openProviderEditor, activeSource, focusSourceSelect,
		setMountDrawerOpen,
	}, ...args); }   // 实现在 ./main/analysisView.js

	function renderComposerContextRow(...args){ return renderComposerContextRowImpl({
		modelSelection, activeProviderProfile, activeTechniqueKeys, referenceIds, partnerSource,
		activeSource, focusSourceSelect, modelOptions, openProviderEditor, setModelSelectOpen,
		setMountDrawerOpen, chatAssist, landingStatusOpen, setLandingStatusOpen,
	}, ...args); }   // 实现在 ./main/analysisView.js

	function renderComposer(...args){ return renderComposerImpl({
		sending, prompt, pendingImages, activeConversation, resetConversationDraft,
		handleRegenerateLastReply, handleEditLastUserAndBranch, setSources, setComposerDragOver,
		handlePickImages, composerDragOver, renderComposerContextRow, landingStatusOpen, chatAssist,
		setPrompt, handleSend, setPendingImages, imageInputRef, setMountDrawerOpen, setInnerTab,
		handleStopStreaming,
	}, ...args); }   // 实现在 ./main/analysisView.js

	function renderAnalysisPane(...args){ return renderAnalysisPaneImpl({
		modelSelection, modelSelectOpen, setModelSelectOpen, setModelSelection, modelOptions,
		activeProviderProfile, openProviderEditor, fetchModelsAndEmbeddings, setProviderSwitchModalOpen,
		setInnerTab, embeddingSelection, setEmbeddingSelection, embeddingOptions, thinkingLevel,
		setThinkingLevel, paramPopover, chatTemperature, setChatTemperature, chatTopP, setChatTopP,
		stopSequences, setStopSequences, frequencyPenalty, setFrequencyPenalty, presencePenalty,
		setPresencePenalty, jsonMode, setJsonMode, renderConnChip, sourceSelectOpen, selectedSourceId,
		setSourceSelectOpen, setSources, sourceOptions, setTimepointDraft, setNatalDraft,
		setSelectedSourceId, activeSource, activeTechniqueKeys, setSelectedTechniqueKeys,
		groupedTechniqueOptions, partnerSource, setPartnerSourceId, lockedContextItems, setMountDrawerOpen,
		visibleMessages, renderLandingSetup, renderComposer, renderLandingExamples, autoFollow, chatLogRef,
		setAutoFollow, setChatLogEl, activeConversation, exportConversation, handleEditMessageAndBranch,
		sending, chatAssist, handleBranchFromMessage, setMessages, handleRegenerateMessage,
		handleCopyMessage, renderContextBanner,
	}, ...args); }   // 实现在 ./main/analysisView.js

	function renderHistoryPane(...args){ return renderHistoryPaneImpl({
		conversations, historyKeyword, setHistoryKeyword, historyFilter, setHistoryFilter,
		resetConversationDraft, exportSelectedConversations, selectedHistoryIds, handleArchiveSelected,
		handleFavoriteSelected, handleBatchDeleteConversations, filteredConversations, setSelectedHistoryIds,
		height, openConversation, handleRenameConversation, handleDuplicateConversation,
		handleToggleConversationFlag, exportConversation, handleDeleteConversation,
	}, ...args); }   // 实现在 ./main/sideViews.js

	function renderMaterialsPane(...args){ return renderMaterialsPaneImpl({
		materialDragCounterRef, setMaterialPaneDragOver, ingestFiles, materialKeyword, setMaterialKeyword,
		materialFolders, selectedFolderId, setSelectedFolderId, materialSort, setMaterialSort, materialView,
		setMaterialView, openMaterialEditor, setFolderDrawerOpen, dedupeMaterials, desktopBridge,
		handleDesktopFilePick, handleDesktopFolderImport, materialIngestQueue, tagGroups, filteredMaterials,
		setReferenceIds, handleMoveMaterial, exportMaterialOriginal, exportMaterialText,
		handleReplaceMaterial, deleteMaterial, materialPaneDragOver,
	}, ...args); }   // 实现在 ./main/sideViews.js

	function renderTemplatesPane(...args){ return renderTemplatesPaneImpl({
		templateKeyword, setTemplateKeyword, openTemplateEditor, openBundleEditor, filteredTemplates,
		templateVersions, setPreviewTemplate, setPreviewDrawerOpen, setVersionDiffState, deleteTemplate,
		rollbackTemplateVersion, applyBundle, setBundlePreview, setReferenceIds, deleteBundle,
	}, ...args); }   // 实现在 ./main/sideViews.js


	function renderAdvancedPane(...args){ return renderAdvancedPaneImpl({ chatAssist }, ...args); }   // 实现在 ./main/sideViews.js

	function renderSettingsPane(...args){ return renderSettingsPaneImpl({
		providerProfiles, settingKeyword, setSettingKeyword, openProviderEditor, providerListDense,
		setProviderListDense, handleExportWorkspaceBackup, handleRestoreWorkspaceBackup,
		handleClearContextCache, setInnerTab, filteredProfiles, fetchModelsAndEmbeddings, testProfileChat,
		runProviderDiagnostics, deleteProvider,
	}, ...args); }   // 实现在 ./main/sideViews.js

	const historyColumns = [];
	void historyColumns;

	const previewResult = previewTemplate ? buildTemplatePreview(previewTemplate) : null;

	return (
		<div className={`${styles.root} horosa-aianalysis-page`}>
			{storeHealth && storeHealth.degraded ? (
				<Alert
					data-ai-store-degraded={storeHealth.reason || 'open-failed'}
					type="warning"
					showIcon
					style={{ margin: '8px 12px 0' }}
					message={storeHealth.reason === 'version' ? 'AI 工作区数据库由更新版本创建,当前版本无法打开:本次以内存模式运行,关闭即丢;升级软件后自动恢复。' : 'AI 工作区数据库暂时打不开:先以内存模式运行,稍后会自动重试;重新打开后,这段时间新建的内容会并回数据库。一直打不开时请重启软件或检查磁盘 / 隐私设置。'}
					description={storeHealth.message ? <span style={{ fontSize: 11, wordBreak: 'break-all' }}>{storeHealth.message}</span> : null}
				/>
			) : null}
			<input
				ref={backupRestoreInputRef}
				type="file"
				accept=".zip"
				style={{ display: 'none' }}
				onChange={handleBackupRestoreInputChange}
			/>
			<input
				ref={desktopFileInputRef}
				type="file"
				multiple
				accept={MATERIAL_ACCEPT_ATTR}
				style={{ display: 'none' }}
				onChange={handleDesktopFileInputChange}
			/>
			<input
				ref={desktopFolderInputRef}
				type="file"
				multiple
				accept={MATERIAL_ACCEPT_ATTR}
				webkitdirectory=""
				directory=""
				style={{ display: 'none' }}
				onChange={handleDesktopFolderInputChange}
			/>
			{/* 全页 Spin 已摘:曾以 workspaceLoading 包住整个工作区 ——
			    APP(WKWebView)里大库首读把它顶成「全页转圈很久」。现在首帧直接渲染,
			    wave2 未到位时资料/历史 pane 顶部各自细提示(deepLoading)。绝不回包全页。 */}
			{/* horosa_freeze_subtabs_v1:五个 renderXxxPane() 此前在**每次** render 都被无条件调用 ——
			    打一个字、流式回答每来一段、切任何设置,都会把「历史」「资料」「模版」「设置」四个
			    看不见的面板(含各自的列表/表单/折叠面板)整套重建一遍。函数式 children 让未激活的
			    面板连函数都不调用;已激活过的在非激活期跳过 re-render,切回时用本轮最新数据渲一帧,
			    不卸载、不重取、不丢用户已填的表单与滚动位置。
			    与上游「首开反卡」的 deepLoading 细提示相容:提示在各自 pane 内,随该 pane 一同求值。 */}
			<Tabs
					className={styles.workspaceTabs}
					tabPosition="right"
					activeKey={innerTab}
					onChange={setInnerTab}
					style={{ height: '100%', minHeight: 0 }}
				>
					<TabPane tab={<span>{SECONDARY_TABS[0].icon}分析</span>} key="analysis">
						<FreezeSubTab active={innerTab === 'analysis'}>{()=>(
						<div className={styles.pane}>{renderAnalysisPane()}</div>
					)}</FreezeSubTab>
					</TabPane>
					<TabPane tab={<span>{SECONDARY_TABS[1].icon}历史</span>} key="history">
						<FreezeSubTab active={innerTab === 'history'}>{()=>(
						<div className={styles.pane}>
							{deepLoading ? <div style={{ padding: '4px 12px', color: 'var(--horosa-text-secondary, #999)', fontSize: 12 }}>会话记录载入中…</div> : null}
							{renderHistoryPane()}
						</div>
					)}</FreezeSubTab>
					</TabPane>
					<TabPane tab={<span>{SECONDARY_TABS[2].icon}资料</span>} key="materials">
						<FreezeSubTab active={innerTab === 'materials'}>{()=>(
						<div className={styles.pane}>
							{deepLoading ? <div style={{ padding: '4px 12px', color: 'var(--horosa-text-secondary, #999)', fontSize: 12 }}>资料库载入中…</div> : null}
							{renderMaterialsPane()}
						</div>
					)}</FreezeSubTab>
					</TabPane>
					<TabPane tab={<span>{SECONDARY_TABS[3].icon}模版</span>} key="templates">
						<FreezeSubTab active={innerTab === 'templates'}>{()=>(
						<div className={styles.pane}>{renderTemplatesPane()}</div>
					)}</FreezeSubTab>
					</TabPane>
					<TabPane tab={<span>{SECONDARY_TABS[4].icon}设置</span>} key="settings">
						<FreezeSubTab active={innerTab === 'settings'}>{()=>(
						<div className={styles.pane}>{renderSettingsPane()}</div>
					)}</FreezeSubTab>
					</TabPane>
					<TabPane tab={<span>{SECONDARY_TABS[5].icon}进阶</span>} key="advanced">
						<div className={styles.pane}>{renderAdvancedPane()}</div>
					</TabPane>
				</Tabs>

			{renderMountDrawer()}
			{renderTechniqueSettingsDrawer()}
			<ChatAssistOverlays {...chatAssist.overlays} />

			{renderMaterialModalImpl({
				editingMaterial, materialModalOpen, saveMaterialForm, setMaterialModalOpen, setEditingMaterial,
				materialForm, materialFolders,
			})}

			{renderTemplateModalImpl({
				editingTemplate, templateModalOpen, saveTemplateForm, setTemplateModalOpen, setEditingTemplate,
				templateForm,
			})}

			{renderBundlePreviewModalImpl({ bundlePreview, setBundlePreview, applyBundle, activeSource, materials })}

			{renderFolderDrawerImpl({
				folderDrawerOpen, setFolderDrawerOpen, folderDraftName, setFolderDraftName, handleCreateFolder,
				materialFolders, materials, handleRenameFolder, handleDeleteFolder,
			})}

			<Modal
				title="模板版本对比"
				open={!!versionDiffState}
				width={960}
				footer={null}
				onCancel={()=>setVersionDiffState(null)}
			>
				{versionDiffState ? renderTemplateVersionDiff() : null}
			</Modal>

			{renderBundleModalImpl({
				editingBundle, bundleModalOpen, saveBundleForm, setBundleModalOpen, setEditingBundle, bundleForm,
				templates, materials, modelOptions,
			})}

			{renderProviderSwitchModalImpl({
				providerSwitchModalOpen, setProviderSwitchModalOpen, providerProfiles, activeProviderProfile,
				setProviderAsCurrent, openProviderEditor,
			})}

			{renderProviderModalImpl({
				editingProvider, providerModalOpen, saveProviderForm, setProviderModalOpen, setProviderAdvancedOpen,
				setEditingProvider, providerForm, applyProviderPresetToForm, providerAdvancedOpen,
			})}

			{renderTemplatePreviewDrawerImpl({
				previewTemplate, previewDrawerOpen, setPreviewDrawerOpen, setPreviewTemplate, previewResult,
				templateVersions,
			})}
		</div>
	);
}

// 函数组件版 sCU:memo + 全 props 机械浅比(函数型恒等;开关 horosa.perf.chartSCU
// 关=恒重渲旧行为)。收益:激活态下宿主无关 dispatch 不再整树重渲 AI 页(其树极重)。
export default React.memo(AIAnalysisMain, (prevProps, nextProps)=>wrapperPropsEqual(prevProps, nextProps));
