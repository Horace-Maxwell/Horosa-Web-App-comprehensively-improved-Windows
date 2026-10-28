// 无头运行时的打包入口(由 build.js 用 esbuild 打成 dist/horosa-runtime.cjs,Node 里加载):
// 只导出与桌面页面桥同一套工具层 —— 目录 / 执行 / 资源 / 提示 / 补全全部走 handleAgentToolRequest(与壳 → 页面同一入口),
// 外加只给终端人工命令用的几组函数(工具目录里永远没有它们):开关与提案的「人工采纳」、账本动作的「人工撤销」、模型接口档案、整库导出 / 导入(与桌面「全量备份」同一格式)。
export { handleAgentToolRequest } from '../src/utils/aiAgent/mcpBridge';
export { registerBuiltinTools } from '../src/utils/aiTools';
export { exportToolManifest, getTool, runTool } from '../src/utils/aiTools/registry';
// 批量验证(./horosa batch):逐例直接调同一件 cast_technique(runTool,与 tools/call 执行同一函数),技法表与段切分取前端同一份
export { listAnalysisTechniqueOptions, analysisTechniqueLabelMap } from '../src/utils/aiAnalysisContext';
export { splitContentSections } from '../src/utils/aiExport';
// 批量每例算完清一次进程内结果缓存(与审计仪器取样前同一个入口):内存不随例数涨,每例的结果也不依赖前面算过哪些例
export { clearRegisteredProcessCaches } from '../src/utils/processCacheRegistry';
export { registerWorkspaceBridge } from '../src/utils/aiTools/workspaceBridge';
export { setKentangRootOverride, getKentangRootOverride } from '../src/integrations/kentang/serviceRoot';
export { setAgentEnabled, isAgentEnabled, getExternalPolicy, setExternalPolicy, isHeadlessEnabled, setHeadlessEnabled, isPrivateReadEnabled, setPrivateReadEnabled, isWebFetchEnabled, setWebFetchEnabled } from '../src/utils/aiAgent/prefs';
export { listProposals, getProposal, acceptProposal, rejectProposal, revertProposal } from '../src/utils/aiAgent/proposals';
export { undoAction } from '../src/utils/aiTools/ledger';
export { putStoreRecord, getStoreRecord, listStoreRecords, deleteStoreRecord, AI_ANALYSIS_STORES, loadUiPrefs, saveUiPrefs } from '../src/utils/aiAnalysisStore';
export { encodeModelSelection, parseModelSelection } from '../src/utils/aiAnalysisProviders';
export { requireSecretEncryption } from '../src/utils/secureKeyStore';
export { resolveHeadlessProfile } from '../src/utils/aiAgent/goalRunner';
export { buildFullUnifiedManifest, parseUnifiedBackupBlob, validateUnifiedBackup, previewUnifiedRestore, restoreUnifiedBackup, UNIFIED_MANIFEST_NAME, BACKUP_SECURITY_KEYS } from '../src/utils/unifiedBackup';
export { buildManifestChecksums } from '../src/utils/backupChecksum';
export { PROVIDER_TYPES, PROVIDER_KEY_ENVS, newProviderProfile, redactProfile, pingProvider } from './aiProfiles';
