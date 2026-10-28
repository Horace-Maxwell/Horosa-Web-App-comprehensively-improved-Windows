// AI 分析挂载上下文(门面):对外的导入路径不变,`from '…/aiAnalysisContext'` 照旧拿到全部导出名。
// 实现按职责拆在同名目录 aiAnalysisContext/ 下(读源码的检查一律读「本文件 + 该目录」全集,登记表 astrostudyui/scripts/source-sets.json):
//   catalog              技法目录与常量
//   recordFields         命盘 / 事盘记录 → 起盘字段与参数
//   regenDivination      卜类无头重算(一)
//   pair                 双盘
//   regenCase            事盘技法快照
//   chartParams          命盘起盘参数
//   regenHoraryElection  卜卦与择日无头重算
//   primaryDirection     主限法盘快照(无头)
//   regenPredictive      推运快照
//   regenChart           命盘技法无头重算
//   sourceContext        源层上下文
//   techniqueKey         技法键规范化、标签与别名
//   snapshotMatch        快照匹配
//   techniqueContext     技法上下文
//   contextLayers        拼层与裁剪

// 依赖按拆分前的导入顺序先行求值(裸导入),再求值各子模块:模块顶层的求值顺序与拆分前一致。
import '../components/comp/DateTime';
import './request';
import './constants';
import './dayBoundary';
import './aiExport';
import './techniqueMountSettings';
import './astroAiSnapshot';
import './mountCalibreSignature';
import './pairChineseData';
import '../constants/ZWConst';
import '../constants/AstroConst';
import './recordFieldsRestore';
import './newChartSeeds';
import './classicalChartGlobals';
import '../divination/horary/horarySchools';
import './safeStorage';
import '../divination/election/electionParams';
import '../divination/data/egyptianSchools';
import './localcases';
import './localcharts';
import './aiAnalysisSources';
import './moduleAiSnapshot';
import '../services/astro';
import './aiAnalysisStore';
import './storageutil';
import './divinationCaseSave';
import './aiAnalysisRag';
import './preciseCalcBridge';
import './localNongliAdapter';
import '../components/dunjia/DunJiaCalc';
import '../components/sanshi/sanshiSnapshotSections';
import '../components/taiyi/TaiYiCalc';
import '../components/taiyi/core/taiyiSchool';
import './ziweiRecordSettings';
import '../components/gua/liuyaoSchools';
import '../components/gua/data/liuyaoDoctrineCache';
import '../components/tongshefa/TongSheFaMain';
import '../components/jinkou/JinKouCalc';
import '../components/jinkou/JinKouState';
import '../components/liureng/LRConst';
import '../components/lrzhan/LiuRengMain';
import '../components/jinkou/JinKouMain';
import '../components/guazhan/GuaZhanMain';
import '../components/cntradition/BaZi';
import '../components/ziwei/ZiWeiMain';
import '../components/ziwei/ziweiOptions';
import '../components/astro/IndiaChart';
import '../components/direction/AstroDirectMain';
import '../components/astro/AstroDistributions';
import '../components/astro/AstroAgePoint';
import '../components/astro/AstroEphemeris';
import '../components/astro/AstroReturnTimeline';
import '../components/astro/AstroPrenatalSyzygy';
import './planetaryAges';
import '../components/astro/astroProgSnapshot';
import './balbillus';
import './triplicityRulers';
import './keypoints120';
import './lunationPhase';
import '../components/astro/AstroExtraReturns';
import '../components/astro/AstroYearSystem129';
import '../components/astro/AstroPlanetaryArc';
import '../components/astro/AstroPersianDirected';
import '../components/astro/AstroJaynesProgressions';
import '../components/astro/AstroZR';
import '../components/astro/AstroDecennials';
import '../components/kinastro/KinAstroMain';
import '../components/huangji/HuangJiMain';
import '../components/taixuan/TaiXuanMain';
import '../components/jingjue/JingJueMain';
import '../components/wuzhao/WuZhaoMain';
import '../components/shenyishu/ShenYiShuMain';
import '../components/geomancy/GeomancyMain';
import '../components/tarot/TarotMain';
import './dateStrSafe';
import './ganzhiYearBase';
import '../components/guolao/GuoLaoChartMain';
import '../components/astro/AstroPrimaryDirectionChart';
import '../components/guolao/GuoLaoChartStyle';
import '../components/suzhan/SuZhanMain';
import '../components/suzhan/SZConst';
import '../components/germany/AstroMidpoint';
import './predictiveAiSnapshot';
import '../divination/horary/horaryEngine';
import '../divination/horary/horarySchools';
import './judgeLayerOverrides';
import '../divination/horary/horarySnapshot';
import '../divination/election/electionEngine';
import '../divination/election/electionSnapshot';
import './baziLunarLocal';
import './canpingLocal';
import './heluoLocal';
import './yizhangjingReport';
import './primaryDirectionSync';

// 对外导出(名字与拆分前逐一相同)
export {
	sourceContextCacheStamp, resolveZhangshengElem, AI_CONTEXT_MAX_CHARS, ANALYSIS_TECHNIQUE_LABELS,
	ANALYSIS_CHART_TECHNIQUES, ANALYSIS_CASE_TECHNIQUES, TIME_CASTABLE_DIVINATION, PAIR_SYNASTRY_MAX_CHARS,
} from './aiAnalysisContext/catalog';
export { buildRecordFieldObject } from './aiAnalysisContext/recordFields';
export { liurengHeadlessCastOpts, ensureLiurengChartObjects } from './aiAnalysisContext/regenDivination';
export {
	PAIR_BAZI_UNAVAILABLE_NOTE, getPairChineseTexts, __resetPairChineseCacheForTests,
	getPairSynastryText, __resetPairSynastryCacheForTests, buildRelativeSnapshotForRecords,
} from './aiAnalysisContext/pair';
export { regenerateCaseTechniqueSnapshot, mergeLiuyaoGearSettings, buildCaseFieldsForRecord, buildSixyaoCaseFromLines } from './aiAnalysisContext/regenCase';
export {
	buildChartBaziParams, buildChartZiweiParamsForRecord, buildChartZiweiParams, mountDraftContextFor,
	heluoSolarTermForDate,
} from './aiAnalysisContext/chartParams';
export {
	ASTRO_LIKE_DERIVED_MODULES, buildAstroLikeContext, buildAstroLikeSingleContext, relativeSnapshotMatchesRecord,
	suzhanFieldsForRecord, resolveGuolaoFields, regenerateChartTechniqueSnapshot,
} from './aiAnalysisContext/regenChart';
export { getTechniqueAliasList } from './aiAnalysisContext/techniqueKey';
export { __resetRegeneratedSnapshotCacheForTests } from './aiAnalysisContext/snapshotMatch';
export {
	getAnalysisTechniqueContextWithOptions, listAnalysisTechniqueOptions, analysisTechniqueLabelMap,
	listAllAnalysisTechniqueOptions, withSerialTechniqueBuild, getAnalysisTechniqueContexts,
	getAnalysisSourceContext,
} from './aiAnalysisContext/techniqueContext';
export {
	estimateTextTokens, hashPromptText, snapshotSourceMismatch, pairDisplayName, buildContextLayers,
	VOLATILE_LAYER_KEYS, clipContentToBudget, clipContextLayersDetailed, clipContextLayers,
	buildPromptContextForTests,
} from './aiAnalysisContext/contextLayers';
export { listAnalysisSources } from './aiAnalysisSources';
