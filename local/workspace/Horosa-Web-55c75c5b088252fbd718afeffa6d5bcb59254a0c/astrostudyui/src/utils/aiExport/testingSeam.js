// AI 导出 · 测试缝:只 import、不被任何子模块 import(叶子),由 utils/aiExport.js 门面对外导出。
// 放在叶子里 = 它在模块顶层读的那些名字,所在模块都已求值完(不在任何导入环里抢读还没求值的模块)。
import { AI_EXPORT_FORCED_INCLUDE_SECTIONS } from './presets';
import { normalizeAIExportPrefs, normalizeAIExportSettings } from './settingsModel';
import { applyUserSectionFilter, beautifyForAIGentle } from './sectionFilter';
import { extractFengShuiContent } from './extractors';
import { exportPdf, exportPdfPlain, exportPdfStyled, canvasHasInk, planPdfChunks, addScreenshotPageIfAny } from './output';

// 仅供 jest 注入测试(照 services/aianalysis.js __testing__ 先例);生产代码勿 import。
export const __aiExportTesting__ = {
	exportPdf, exportPdfPlain, exportPdfStyled, canvasHasInk, planPdfChunks,
	beautifyForAIGentle, addScreenshotPageIfAny, normalizeAIExportPrefs,
	// 导出主链段过滤(内部函数)直测口:锁「空数组=全清」「强推段已死(取消=真取消)」两语义。
	applyUserSectionFilter, normalizeAIExportSettings, AI_EXPORT_FORCED_INCLUDE_SECTIONS,
	// 风水导出汇合(理气底段与包段:过滤→降格→拼接全链)直测口 —— 挂载/导出分叉正是零测试才存活的。
	extractFengShuiContent,
};
