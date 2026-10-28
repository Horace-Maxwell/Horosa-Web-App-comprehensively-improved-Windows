// AI 导出(门面):对外的导入路径不变,`from '…/aiExport'` 照旧拿到全部导出名。
// 实现按职责拆在同名目录 aiExport/ 下(读源码的检查一律读「本文件 + 该目录」全集,登记表 astrostudyui/scripts/source-sets.json):
//   presets          段表与常量:版本号 / 迁移并集 / 各技法预设段 / 禁段 / 符号替换表
//   settingsModel    设置模型:星曜信息与星义开关、段名规范化、设置规范化、格式与开关偏好、快照模块键映射
//   sectionFilter    段文本过滤:切段 / 按勾选过滤 / 旧段名映射 / 禁段剥离 / 节气段 / 行星信息裁剪 / 美化
//   contextResolve   页面上下文识别:页签容器、当前技法判定、按盘面状态解析、店内回落
//   settingsGroups   设置读写与分组:load / save、技法分组、段分组、默认关段、生效段、快照过滤
//   snapshotLookup   快照查找:别名、载荷、本地存储、模块缓存、三式与印度缓存
//   extractors       各技法的页面内容抽取
//   meaning          星义 / 奇门 / 六壬提示附加与符号规范化
//   output           文件输出:墨迹判定、PDF / TXT / Word / DOCX
//   exportKeys       导出键:键名规范化、推运类判定、技法显示名(只依赖 presets 的底层件)
//   pipeline         编排:候选键与兜底键、按键取内容、拼载荷、导出主流程、当前页导出
//   testingSeam      测试缝 __aiExportTesting__(叶子:只 import、不被子模块 import)

// 依赖按拆分前的导入顺序先行求值(裸导入),再求值各子模块:模块顶层的求值顺序与拆分前一致。
import './storageutil';
import '../utils/safeStorage';
import './clipboardText';
import './aiAnalysisExport';
import './request';
import './constants';
import './dayBoundary';
import './astroAiSnapshot';
import './moduleAiSnapshot';
import './acgSnapshot';
import '../constants/AstroConst';
import '../constants/AstroText';
import '../components/astro/AstroMeaningData';
import '../components/dunjia/QimenXiangDoc';
import '../components/liureng/LRShenJiangDoc';
import './aiExportDocModel';
import './mdTableParse';
import './aiExportLegend';
import './classicalChartGlobals';
import './pageScreenshot';
import './subjectFacts';
import './localcharts';

// 对外导出(名字与拆分前逐一相同)
export { AI_EXPORT_SETTINGS_VERSION, AI_EXPORT_PRESET_SECTIONS, getAIExportPresetKeys, AI_SECTION_SPLITS, AI_SECTION_SPLIT_LATEST, migrateSplitSegments } from './aiExport/presets';
export {
	normalizeSectionTitle, getAIExportFormatPreference, isAIExportScreenshotEnabled, isAIExportLegendEnabled,
	isAIExportSubjectFactsEnabled, exportSettingKeyForSnapshotModule, requestModuleSnapshotRefresh,
	getOptionsForTechniqueKey,
} from './aiExport/settingsModel';
export { splitContentSections, filterContentByWantedSections, isUserSectionsExplicitlyCleared, applyPlanetInfoFilterByContext } from './aiExport/sectionFilter';
export { getCurrentAIExportContext } from './aiExport/contextResolve';
export {
	loadAIExportSettings, saveAIExportSettings, subjectFactsExportAllowed, buildSubjectFactsExportSection,
	listAIExportTechniqueGroupDefs, listAIExportTechniqueSettingGroups, getSectionGroupsForTechnique,
	listAIExportTechniqueSettings, getAIExportAuditMatrixForTests, getAIExportDefaultOffSet,
	getAIExportEffectiveSectionsForTechnique, applyAIExportSectionFilterToSnapshot, resolveAIExportContextForTests,
} from './aiExport/settingsGroups';
export { getModuleAliasList } from './aiExport/snapshotLookup';
export { CALENDAR_SUB_SOURCE_LABELS } from './aiExport/extractors';
export { planPdfChunks } from './aiExport/output';
export { AI_EXPORT_SIMPLE_MODULE_KEYS, buildCurrentPageExportForTool, runAIExport } from './aiExport/pipeline';
export { __aiExportTesting__ } from './aiExport/testingSeam';
