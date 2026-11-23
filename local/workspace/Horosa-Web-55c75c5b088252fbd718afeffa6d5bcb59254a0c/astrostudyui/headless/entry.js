// 无头运行时的打包入口(由 build.js 用 esbuild 打成 dist/horosa-runtime.cjs,Node 里加载):
// 只导出与桌面页面桥同一套工具层 —— 目录 / 执行 / 资源 / 提示 / 补全全部走 handleAgentToolRequest(与壳 → 页面同一入口),
// 外加只给终端人工命令用的几组函数(工具目录里永远没有它们):开关与提案的「人工采纳」、账本动作的「人工撤销」、模型接口档案、整库导出 / 导入(与桌面「全量备份」同一格式)。
export { handleAgentToolRequest, watchAgentCatalog } from '../src/utils/aiAgent/mcpBridge';
export { registerBuiltinTools } from '../src/utils/aiTools';
export { exportToolManifest, getTool, runTool } from '../src/utils/aiTools/registry';
// 批量验证(./horosa batch):逐例直接调同一件 cast_technique(runTool,与 tools/call 执行同一函数),技法表与段切分取前端同一份
export { listAnalysisTechniqueOptions, analysisTechniqueLabelMap } from '../src/utils/aiAnalysisContext';
export { splitContentSections } from '../src/utils/aiExport';
// 批量每例算完清一次进程内结果缓存(与审计仪器取样前同一个入口):内存不随例数涨,每例的结果也不依赖前面算过哪些例
export { clearRegisteredProcessCaches } from '../src/utils/processCacheRegistry';
export { registerWorkspaceBridge } from '../src/utils/aiTools/workspaceBridge';
export { setKentangRootOverride, getKentangRootOverride } from '../src/integrations/kentang/serviceRoot';
export { setAgentEnabled, isAgentEnabled, getExternalPolicy, setExternalPolicy, isHeadlessEnabled, setHeadlessEnabled, isPrivateReadEnabled, setPrivateReadEnabled, isWebFetchEnabled, setWebFetchEnabled, isSchedulerEnabled, setSchedulerEnabled, isGoalEnabled, setGoalEnabled } from '../src/utils/aiAgent/prefs';
export { listProposals, getProposal, acceptProposal, rejectProposal, revertProposal } from '../src/utils/aiAgent/proposals';
export { undoAction } from '../src/utils/aiTools/ledger';
export { putStoreRecord, getStoreRecord, listStoreRecords, deleteStoreRecord, AI_ANALYSIS_STORES, loadUiPrefs, saveUiPrefs } from '../src/utils/aiAnalysisStore';
export { encodeModelSelection, parseModelSelection } from '../src/utils/aiAnalysisProviders';
export { requireSecretEncryption } from '../src/utils/secureKeyStore';
export { resolveHeadlessProfile } from '../src/utils/aiAgent/goalRunner';
export { buildFullUnifiedManifest, parseUnifiedBackupBlob, validateUnifiedBackup, previewUnifiedRestore, restoreUnifiedBackup, UNIFIED_MANIFEST_NAME, BACKUP_SECURITY_KEYS } from '../src/utils/unifiedBackup';
export { buildManifestChecksums } from '../src/utils/backupChecksum';
export { PROVIDER_TYPES, PROVIDER_KEY_ENVS, newProviderProfile, redactProfile, pingProvider } from './aiProfiles';
// 常驻服务(./horosa start / serve)的任务调度:与桌面任务中心同一套任务库、排期、错过策略与启动对账;
// 执行体换成无人值守版(只读 + 提议、审批只放行提议、无反问)。任务的人工放行(继续 / 开始 / 立即运行)只给终端人工子命令
export { runSchedulerTick, runScheduledTaskNow, pauseScheduledTask, resumeScheduledTask, readLastTickAt, SCHEDULER_TICK_INTERVAL_MS } from '../src/utils/aiAgent/tasks/scheduler';
export { reconcileTasksOnBoot } from '../src/utils/aiAgent/tasks/reconcile';
export { listTasks, getTask, cancelTask } from '../src/utils/aiAgent/tasks/taskStore';
export { controllerOf } from '../src/utils/aiAgent/tasks/taskRegistry';
export { describeSchedule } from '../src/utils/aiAgent/tasks/schedule';
export { runUnattendedScheduledTask, unattendedGoalDeps, unattendedModelGate } from '../src/utils/aiAgent/tasks/unattended';
export { startGoalTask } from '../src/utils/aiAgent/goalRunner';
