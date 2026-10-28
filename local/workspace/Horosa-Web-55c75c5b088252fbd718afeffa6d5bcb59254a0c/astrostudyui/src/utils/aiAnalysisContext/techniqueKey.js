// AI 分析挂载上下文 · 技法键规范化、标签与别名。
// 由 utils/aiAnalysisContext.js 门面统一对外导出。
import { ANALYSIS_TECHNIQUE_LABELS } from './catalog';

// 技法键规范化与槽名别名表单源在 utils/techniqueSlotAliases(导出侧同引,四路同一张)
import { normalizeTechniqueKey } from '../techniqueSlotAliases';
export { normalizeTechniqueKey, getTechniqueAliasList, KINASTRO_SERVICE_KEYS } from '../techniqueSlotAliases';

export function getTechniqueLabel(key){
	return ANALYSIS_TECHNIQUE_LABELS[normalizeTechniqueKey(key)] || `${key || ''}`.trim();
}
