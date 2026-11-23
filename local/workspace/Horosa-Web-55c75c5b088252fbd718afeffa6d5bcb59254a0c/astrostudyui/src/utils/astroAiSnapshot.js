// 占星 AI 快照门面(对外导入路径与导出不变),实现按职责拆在 astroAiSnapshot/ 下,依赖只朝前一层:
//   format(取值与格式化小件)→ infoSection([起盘信息] 段)→ chartSections(相位 / 行星 / 希腊点 / 分盘 / 定位星 / 宫主 / 寿命)
//   → classical(古典分析段)→ store(签名、正文组装与存取);predictive(推运类共用的出生 / 此刻行与方法说明)独立。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
export { ASTRO_SNAPSHOT_FORMAT_VERSION } from './astroAiSnapshot/format';
export { buildClassicalCalibreLine, buildHouseCuspLines, buildStarAndLotPositionLines, buildInfoSection } from './astroAiSnapshot/infoSection';
export { buildClassicalAnalysisSection } from './astroAiSnapshot/classical';
export { ASTRO_AI_SNAPSHOT_KEY, createAstroSnapshotSignature, buildAstroSnapshotContent, saveAstroAISnapshot, saveAstroAISnapshotLazy, loadAstroAISnapshot, getAstroAISnapshotForCurrent } from './astroAiSnapshot/store';
export { buildPredictiveBirthLines, buildPredictiveBirthHeaderLines, buildCurrentMomentLines, PREDICTIVE_METHOD_NOTES, buildMethodNoteLines } from './astroAiSnapshot/predictive';

