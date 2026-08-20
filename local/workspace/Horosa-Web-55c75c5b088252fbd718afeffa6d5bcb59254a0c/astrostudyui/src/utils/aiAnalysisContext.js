import DateTime from '../components/comp/DateTime';
import request from './request';
import * as Constants from './constants';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from './dayBoundary';
import { applyAIExportSectionFilterToSnapshot, splitContentSections, exportSettingKeyForSnapshotModule, applyPlanetInfoFilterByContext } from './aiExport';
import {
	getTechniqueSettingsSchema,
	mergeOptionsIntoRecord,
	mergeOptionsIntoPayload,
	applyLocalStorageSettings,
	snapshotLocalStorageSettings,
	restoreLocalStorageSettings,
	pruneOptionsToNonDefault,
	effectiveMountBaseline,
} from './techniqueMountSettings';

// 用户拍板·v2.2.1: 给 AI 看的"排盘规则"语义说明,作为 first-class metadata 显式标注。
// 让 GPT/Claude/Ollama 看到 snapshot 时知道四柱按哪种规则计算,不会按错语义解读。
function buildDayBoundaryMeta(after23NewDay, lateZiHourUseNextDay){
	const a23 = after23NewDay === 0 || after23NewDay === '0' || after23NewDay === false ? 0 : 1;
	const lzh = lateZiHourUseNextDay === 0 || lateZiHourUseNextDay === '0' || lateZiHourUseNextDay === false ? 0 : 1;
	const dayLabel = a23 === 1 ? '23点算第二天(日柱进位次日)' : '24点算第二天(日柱守今、24点才换日柱)';
	const hourLabel = lzh === 1 ? '晚子时按次日日柱计算(时干用次日日干起子时)' : '晚子时按当日柱计算(时干用今日日干起子时)';
	return {
		after23NewDay: a23,
		lateZiHourUseNextDay: lzh,
		dayBoundaryLabel: dayLabel,
		lateZiHourLabel: hourLabel,
		note: `本盘排盘规则：日柱开关【${dayLabel}】+ 时柱开关【${hourLabel}】。23:00–23:59 范围内,日柱与时柱按上述规则计算;其他时辰两个开关均不影响。`,
	};
}
import { buildAstroSnapshotContent, loadAstroAISnapshot, buildClassicalAnalysisSection, buildStarAndLotPositionLines, buildHouseCuspLines } from './astroAiSnapshot';
import * as AstroConst from '../constants/AstroConst';   // [G1] 主限法盘无头快照的黄道/宫制标签(纯常量,零组件依赖)
import { classicalGlobalValue, classicalBackendOverridesFromFields, classicalBackendOverridesFromPlain, getClassicalChartGlobals, CLASSICAL_GLOBAL_DEFAULTS, classicalSnapshotNeverSig } from './classicalChartGlobals';
// 卜卦/择日「判读参数/流派口径」单一真值(叶子模块,无环):齿轮 hp_/ep_ 扁平键按此表解码。
import { HORARY_PARAM_SPEC, horaryBackendFields } from '../divination/horary/horarySchools';
import { safeLocalStorageSet } from './safeStorage';
import { ELECTION_PARAM_SPEC } from '../divination/election/electionParams';
// 埃及历七轴随盘键(egypt_*):挂载/存盘 record → fields 透传,astroAiSnapshot.egyptSchoolFromFields 优先消费。
import { EGYPT_RECORD_KEYS } from '../divination/data/egyptianSchools';
import { getCaseTypeLabel, getCaseTypeMeta, listLocalCases } from './localcases';
import { listLocalCharts } from './localcharts';
// 「列挂载源」及其纯函数助手抽至轻模块 aiAnalysisSources —— 个别页面只需
// 列源,曾因 import 本文件连带整座 AI 核(~50 技法构建器)进自己的 chunk(46/47 回灌案)。
// 此处 import 供本文件其余函数继续使用,listAnalysisSources 在文件尾 re-export 保旧路径兼容。
import { safeParseJson, normalizeTags, extractSnapshotText, extractCaseSnapshotText } from './aiAnalysisSources';
export { listAnalysisSources } from './aiAnalysisSources';
import { loadModuleAISnapshot, saveModuleAISnapshot } from './moduleAiSnapshot';
import { fetchChart } from '../services/astro';
import { AI_ANALYSIS_STORES, getStoreRecord, putStoreRecord } from './aiAnalysisStore';
import { getStore } from './storageutil';
import { DIVINATION_CASE_SETTING_KEYS } from './divinationCaseSave';
import { buildRetrievedContextText } from './aiAnalysisRag';
import { fetchPreciseNongli } from './preciseCalcBridge';
import { buildLocalJieqiYearSeed } from './localNongliAdapter';
import { calcDunJia, buildDunJiaSnapshotText } from '../components/dunjia/DunJiaCalc';
import {
	parseSnapshotSections as parseSanshiSnapshotSections,
	SANSHI_TAIYI_SECTION_TITLES,
	SANSHI_QIMEN_EXTRA_SECTIONS,
	SANSHI_LIURENG_DUANGUA_SECTIONS,
} from '../components/sanshi/sanshiSnapshotSections';
import { fetchTaiyiPan, buildTaiyiSnapshotText } from '../components/taiyi/TaiYiCalc';
import { applyTaiyiSchool, isDefaultSchool, DEFAULT_TAIYI_SCHOOL } from '../components/taiyi/core/taiyiSchool';
import { buildTongSheFaModel, buildTongSheFaSnapshot } from '../components/tongshefa/TongSheFaMain';
import { buildJinKouData } from '../components/jinkou/JinKouCalc';
import { resolveJinKouDiFen } from '../components/jinkou/JinKouState';
import { buildLiuRengSnapshotText } from '../components/lrzhan/LiuRengMain';
import { buildJinKouSnapshotText, deriveBenMingFromRunYear as deriveJinkouBenMing, deriveXuSuiFromRunYear as deriveJinkouXuSui } from '../components/jinkou/JinKouMain';
import { buildGuaSnapshotText, buildTimeGua } from '../components/guazhan/GuaZhanMain';
import { buildBaziSnapshotForParams } from '../components/cntradition/BaZi';
import { buildZiweiSnapshotForParams } from '../components/ziwei/ZiWeiMain';
import { buildIndiaSnapshotForFields } from '../components/astro/IndiaChart';
import { buildFirdariaSnapshotText, buildPrimaryDirectSnapshotText } from '../components/direction/AstroDirectMain';
import { buildDistributionsSnapshotText } from '../components/astro/AstroDistributions';
import { buildAgePointSnapshotText } from '../components/astro/AstroAgePoint';
import { buildPlanetaryAgesSnapshotText } from './planetaryAges';
import { buildVedicProgSnapshotText } from '../components/astro/AstroVedicProgressions';
import { buildBalbillusSnapshotText } from './balbillus';
import { buildTriplicityRulersSnapshotText } from './triplicityRulers';
import { buildKeypointsSnapshotText } from './keypoints120';
import { buildLunationPhaseSnapshotText } from './lunationPhase';
import { buildExtraReturnsSnapshotText } from '../components/astro/AstroExtraReturns';
import { buildYearSystem129SnapshotText } from '../components/astro/AstroYearSystem129';
import { buildPlanetaryArcSnapshotText } from '../components/astro/AstroPlanetaryArc';
import { buildPersianDirectedSnapshotText } from '../components/astro/AstroPersianDirected';
import { buildJaynesProgSnapshotText } from '../components/astro/AstroJaynesProgressions';
import { buildZodialReleaseSnapshotText } from '../components/astro/AstroZR';
import { buildDecennialsSnapshotText } from '../components/astro/AstroDecennials';
import { buildKinAstroSnapshotForFields } from '../components/kinastro/KinAstroMain';
import { buildHuangJiSnapshotForFields } from '../components/huangji/HuangJiMain';
import { buildTaiXuanSnapshotForFields } from '../components/taixuan/TaiXuanMain';
import { buildJingJueSnapshotForFields } from '../components/jingjue/JingJueMain';
import { buildWuZhaoSnapshotForFields, WUZHAO_CALC_OPTION_KEYS } from '../components/wuzhao/WuZhaoMain';
import { buildShenYiShuSnapshotForFields } from '../components/shenyishu/ShenYiShuMain';
import { buildGeomancySnapshotForFields } from '../components/geomancy/GeomancyMain';
import { buildTarotSnapshotForFields } from '../components/tarot/TarotMain';
// parseDateParts:老黄历日课(case 'huangli')那支按 date 串拆年月日用它;
// 此前只调用未导入 → 挂载黄历事盘时抛 ReferenceError(同型问题先例:
// 调用点在运行时闭包里,模块加载与渲染阶段都踩不到)。
import { parseYearFromDateStr, parseDateParts } from './dateStrSafe';
import { ganzhiYearBase } from './ganzhiYearBase';
import { buildGuolaoSnapshotForFields } from '../components/guolao/GuoLaoChartMain';
import { buildSuzhanSnapshotText } from '../components/suzhan/SuZhanMain';
import { SZChart as SZChartDefaults } from '../components/suzhan/SZConst';
import { buildGermanySnapshotForFields } from '../components/germany/AstroMidpoint';
// [B6] 合盘快照构建器动态化:静态 import 会把 AstroRelative 整组件锚进饿链(本文件被 eager 主组件引用)
// → 首屏白携带;两处消费均在 async 路径,await import 零语义差(与合盘页 lazy 同 chunk 复用)。
async function loadBuildRelativeSnapshotText(){
	const m = await import(/* webpackChunkName: "relative-main" */ '../components/astro/AstroRelative');
	return m.buildRelativeSnapshotText;
}
import { buildPredictiveSnapshotText } from './predictiveAiSnapshot';
import { runHorary } from '../divination/horary/horaryEngine';
import { horaryJudgeOpts } from '../divination/horary/horarySchools';
import { judgeLayerOverrides } from './judgeLayerOverrides';
import { buildHorarySnapshot } from '../divination/horary/horarySnapshot';
import { runElection } from '../divination/election/electionEngine';
import { buildElectionSnapshot } from '../divination/election/electionSnapshot';
import { buildLocalBaziResult } from './baziLunarLocal';
import { calculate as canpingCalculate, buildSnapshotText as buildCanpingSnapshotText, liunianSeries as canpingLiunianSeries } from './canpingLocal';
// 神数正传:引擎与秘数表(~250KB)按需载入 —— 静态引用会把数据表打进 shared-technique,
// 令从不用此技法的用户也付其代价。builder 本就是 async,await 一次后模块级缓存。
let zcMods = null;
async function loadZhengChuanMods(){
	if(!zcMods){
		const [tb, sz, dd, lq, xy, sn] = await Promise.all([
			import(/* webpackChunkName: "zhengchuan-engine" */ './zhengchuanTiebanLocal'),
			import(/* webpackChunkName: "zhengchuan-engine" */ './zhengchuanShaoziLocal'),
			import(/* webpackChunkName: "zhengchuan-engine" */ './zhengchuanDadingLocal'),
			import(/* webpackChunkName: "zhengchuan-engine" */ './zhengchuanLiuqinLocal'),
			import(/* webpackChunkName: "zhengchuan-engine" */ './zhengchuanXinyiLocal'),
			import(/* webpackChunkName: "zhengchuan-engine" */ './zhengchuanSnapshot'),
		]);
		zcMods = {
			calcTieban: tb.calcTieban, loadTiebanVerses: tb.loadTiebanVerses,
			calcShaozi: sz.calcShaozi, loadShaoziVerses: sz.loadShaoziVerses,
			dadingDeathYear: dd.dadingDeathYear, dadingDeathMonth: dd.dadingDeathMonth,
			calcLiuqin: lq.calcLiuqin, calcXinyi: xy.calcXinyi,
			buildText: sn.buildZhengChuanSnapshotText,
		};
	}
	return zcMods;
}
import { calculate as heluoCalc, daYun as heluoDaYun, judge as heluoJudge, buildSnapshotText as buildHeluoSnapshotText, solarTermHuagong as heluoSolarTermHuagong } from './heluoLocal';
import { buildYizhangjingModel, buildYizhangjingSnapshotText } from './yizhangjingReport';
import { Solar as HeluoSolar } from 'lunar-javascript';
// P5 主限法盘快照：方位法/度数换算的中文标签 + 默认（纯 util，无组件依赖、不回环 aiAnalysisContext）。
// horosa_no_undef_fix_v1(check-no-undef 门抓获,上游同病;建议上游同步):
// 2372 行 `pdtype: DEFAULT_PD_TYPE` 引用了从未 import 的常量 → 该处在 try 里被吞成
// 「主限法盘配置(降级)」—— 本版发布说明宣称的「主限法补全盘体」在该段从未真正生效。
// 单一事实源 = primaryDirectionSync(同族 DEFAULT_PD_METHOD/TIME_KEY 本就从这里进)。
import { getPdMethodLabel, getPdTimeKeyLabel, DEFAULT_PD_METHOD, DEFAULT_PD_TIME_KEY, DEFAULT_PD_TYPE } from './primaryDirectionSync';

const DEFAULT_PD_ASPECTS = [0, 60, 90, 120, 180];
// [挂载预算] 上下文字数预算单一真值：发送路径（AIAnalysisMain）与默认裁剪上限共用，消灭散落的字面量。
export const AI_CONTEXT_MAX_CHARS = 20000;
const DEFAULT_CONTEXT_CHAR_LIMIT = AI_CONTEXT_MAX_CHARS;
const MODULE_SNAPSHOT_PREFIX = 'horosa.ai.snapshot.module.v1.';
const DEFAULT_QIMEN_OPTIONS = {
	jieQiType: 1,
	yearGanZhiType: 2,
	monthGanZhiType: 1,
	// live recalc 硬钉 1(引擎内该键只喂标签、不进快照,取 0/1 输出等价),与页面对齐消灭两处默认漂移源。
	dayGanZhiType: 1,
	// 盘类(命局/事局):DunJiaCalc 快照「盘类：」行 + 法奇门用神取向消费;live 默认事局。
	chartCategory: 'shi',
	qijuMethod: 'zhirun',
	school: '转盘',
	kongMode: 'day',
	yimaMode: 'day',
	timeAlg: 0,
	shiftPalace: 0,
	after23NewDay: defaultAfter23NewDay(),
	lateZiHourUseNextDay: defaultLateZiHourUseNextDay(),
	fengJu: false,
	paiPanType: 3,
	zhiShiType: 0,
	yueJiaQiJuType: 0,
	shuziReportNumber: '',
	zhirunLeapDays: 9,
};
const DEFAULT_TAIYI_OPTIONS = {
	style: 3,
	tn: 0,
	tenching: 0,
	sex: '男',
	rotation: '固定',
	// 与 TaiYiMain.state.options 同构:补齐流派/换日/时间基准/博弈,否则存过的非默认事盘重生成时丢档。
	school: { ...DEFAULT_TAIYI_SCHOOL },
	after23NewDay: 0,
	lateZiHourUseNextDay: 1,
	timeBasis: 'direct',
	gameTheory: 0,
};

export const ANALYSIS_TECHNIQUE_LABELS = {
	guice: '皇极轨策',
	xiaoliuren: '小六壬',
	xiaochengtu: '小成图',
	feigong: '飞宫小奇门',
	astrochart: '星盘',
	astrochart_like: '十三分盘 / 占星地图',
	indiachart: '印度占星',
	relative: '合盘',
	guolao: '七政四余',
	germany: '量化盘',
	babylon: '巴比伦占星',
	jieqi: '节气盘',
	jieqi_meta: '节气盘-通用参数',
	jieqi_chunfen: '节气盘-春分',
	jieqi_xiazhi: '节气盘-夏至',
	jieqi_qiufen: '节气盘-秋分',
	jieqi_dongzhi: '节气盘-冬至',
	primarydirect: '星运-主限法',
	primarydirchart: '星运-主限法盘',
	zodialrelease: '星运-黄道星释',
	firdaria: '星运-法达星限',
	distributions: '星运-界推运',
	agepoint: '星运-年龄推进点',
	profection: '星运-小限法',
	solararc: '星运-太阳弧',
	solarreturn: '星运-太阳返照',
	lunarreturn: '星运-月亮返照',
	givenyear: '星运-流年法',
	decennials: '星运-十年大运',
	planetaryages: '星运-行星年龄',
	vedicprog: '星运-恒星推运',
	balbillus: '星运-Balbillus',
	triplicityrulers: '星运-三分主星',
	keypoints: '星运-数字相位',
	lunationphase: '星运-月相推运',
	extrareturns: '星运-多重回归',
	yearsystem129: '星运-129年系统',
	planetaryarc: '星运-行星弧',
	persiandirected: '星运-波斯向运',
	jaynesprog: '星运-赤纬推运',
	cntradition: '辅助',
	bazi: '八字',
	ziwei: '紫微斗数',
	suzhan: '宿占',
	otherbu: '骰子',
	fengshui: '风水',
	sixyao: '六爻',
	tongshefa: '统摄法',
	liureng: '大六壬',
	jinkou: '金口诀',
	qimen: '奇门遁甲',
	sanshiunited: '三式合一',
	taiyi: '太乙',
	horary: '卜卦盘',
	election: '择日盘',
	tianxing: '天星择日',
	qimenzeri: '奇门择日',
	mundane: '世俗盘',
	canping: '邵子参评数',
	zhengchuan: '神数正传',
	heluo: '河洛理数',
	yizhangjing: '一掌经',
	huangli: '老黄历日课', tongshu: '通书择日', rizi: '日子馆择日', jieqipan: '节气盘',
	xianqin: '演禽',
	cetian: '策天飞星',
	// 2026-07-05 审计补:kinastro 系七技法此前「可导出不可挂载」——通用 buildKinAstroSnapshotForFields
	// 按出生数据经 ken 后端起盘,与 xianqin/cetian 同管道,补齐挂载全链。
	qizhengkin: '七政四余（七政）',
	shaozi: '邵子神数',
	tieban: '铁板神数',
	fendjing: '鬼谷分定经',
	beiji: '北极神数',
	nanji: '南极神数',
	chunzi: '蠢子数',
	huangji: '皇极经世',
	wuzhao: '五兆',
	taixuan: '太玄筮法',
	jingjue: '荆诀',
	shenyishu: '神易数',
	geomancy: '天文地占',
	tarot: '塔罗',
	lingqi: '灵棋经',
};

// AI 分析「使用技法」命盘类下拉。仅收录能按本盘数据返回结构化快照的技法。
// 仍排除（命盘类无法复用 builder）：relative(合盘,需两张盘)、cntradition(辅助,无可复用 builder)。
// 注：wuzhao/taixuan/jingjue/shenyishu/huangji 均在 CASE_TYPE_OPTIONS 可存事盘，存案 payload 带 snapshot 字符串。
//   挂载走 ANALYSIS_CASE_TECHNIQUES 的 case 分支：getTechniqueSnapshotFromPayload 经 extractSnapshotText 读 payload.snapshot
//   字符串出正文(确定性、不重算)；事盘列表预览须 extractCaseSnapshotText 同样认字符串(原只认对象 .content → 修)。
//   jieqi(节气盘,非单盘/多次取数)、otherbu(骰子,随机不可复算)、fengshui(风水) 暂无事盘存储(不在 CASE_TYPE_OPTIONS)→ 仍只导出不挂载。
//   [F5 定谳] fengshui/otherbu/jieqi 各页确实会 saveModuleAISnapshot(供 AI 导出取正文)——「有快照」≠「可挂载」:
//   挂载需要 case 源语义(存盘/出生数据),这三者无 case 存储,快照是工作台态(如风水随流派 tab 实时覆盖),
//   挂到命例上会张冠李戴。维持只导出不挂载是结论,不是遗漏;其余仅页内消费的技法同理。
//   [M-5 备案] jieqi 若将来真有挂载需求,最小可行设计:仅限「起课时间」源,年份:=时点年,无头链复用
//   jieqiYearSeeds 机制批量拉四分至盘,段过滤沿 jieqi_* 六键既有 preset——挂载语义是案例/时点中心、
//   节气盘是年度中心,为孤例引入「一键四盘 multi-fetch」新机制类成本过重,本轮维持豁免。
// 标签仍保留在 ANALYSIS_TECHNIQUE_LABELS（导出/他处可能引用）。
export const ANALYSIS_CHART_TECHNIQUES = [
	'astrochart',
	'astrochart_like',
	'indiachart',
	'guolao',
	'germany',
	'babylon',
	'primarydirect',
	'primarydirchart',
	'zodialrelease',
	'firdaria',
	'distributions',
	'agepoint',
	'profection',
	'solararc',
	'solarreturn',
	'lunarreturn',
	'givenyear',
	'decennials',
	'planetaryages',
	'vedicprog',
	'balbillus',
	'triplicityrulers',
	'keypoints',
	'lunationphase',
	'extrareturns',
	'yearsystem129',
	'planetaryarc',
	'persiandirected',
	'jaynesprog',
	'bazi',
	'ziwei',
	'suzhan',
	'canping',
	'heluo',
	'zhengchuan',
	'yizhangjing',
	'xianqin',
	'cetian',
	'qizhengkin',
	'shaozi',
	'tieban',
	'fendjing',
	'beiji',
	'nanji',
	'chunzi',
	'huangji',
	// [D2] 合盘:挂载读合盘页所存模块快照(两盘技法无法单 record 复算,见 buildChartTechniqueContext 特判)
	'relative',
];

export const ANALYSIS_CASE_TECHNIQUES = [
	'sixyao',
	// 皇极轨策：起卦所得为冻结值 → case 分支按 payload.snapshot 出正文，不重算
	'guice',
	'tongshefa',
	'liureng',
	'jinkou',
	'qimen',
	'sanshiunited',
	'taiyi',
	'suzhan',
	'horary',
	'election',
	'tianxing',
	'qimenzeri',
	'mundane',
	// 报数/揲蓍/起例 确定性术：均在 CASE_TYPE_OPTIONS 可存事盘，存案 payload 带 snapshot 字符串 + 起算时定型的
	// 时间设置(fieldSnapshot)；case 分支按 payload.snapshot 出正文(不重算)，与 sixyao/mundane 同范式。
	// huangji 此前只登 ANALYSIS_CHART_TECHNIQUES → 其事盘不被列为可挂技法(listAnalysisTechniqueOptions 给 CASE 集) →
	// 补登于此(同时保留 CHART 登记：命盘侧按出生重算 buildHuangJiSnapshotForFields 不变)。
	'wuzhao',
	'taixuan',
	'xiaoliuren',
	'xiaochengtu',
	'feigong',
	'jingjue',
	'shenyishu',
	'geomancy',
	'tarot',
	'lingqi',
	'huangji',
];

// 「时间确定式法」：盘面完全由起课时间 + 默认设置(含地点)决定，可即时起盘。
// 用途：① 新的「起课时间」入口对它们即时起盘；② 已存事盘若 payload 缺该技法，按其起课时间自动补算。
// 含西洋卜卦盘 horary / 择日盘 election——二者仅凭时间+地点即可起西洋盘、引擎默认类别(general/marriage)即出结构化裁决/评分。
// 六爻/统摄法/宿占等【不在此列】——六爻是摇钱/报数起卦，按时间重算 = 伪造一个不同的卦，永远只认存盘。
export const TIME_CASTABLE_DIVINATION = ['liureng', 'jinkou', 'qimen', 'taiyi', 'sanshiunited', 'horary', 'election'];
const TIME_CASTABLE_SET = new Set(TIME_CASTABLE_DIVINATION);
// 「起课时间」源额外允许六爻——时间起卦是确定性式法（时间即输入，非伪造摇卦）；
// 但「已存事盘」源仍不按时间重算六爻（保持 case 护栏，见 getAnalysisTechniqueContexts）。
// 时间确定/时间派种(seed/数据全由时间派生)式法均纳入「起课时间」源白名单:
// · sixyao 六爻(时间起卦)、huangji 皇极经世(元会运世按时间确定);
// · taixuan/jingjue 报数法用起课时间 yyyyMMddHHmm 派生 seed,反复挂载确定;
// · wuzhao 干支起例(纯时间)/shenyishu hourSource=auto seasonSource=auto 全由时间推断。
// 仍排除 tongshefa/suzhan/mundane —— 需用户手动选盘或事先存盘(凭时间起会得无意义默认值,不如显示「缺失」让用户去事盘存好再挂载)。
// 也排除 rizi(日子馆:builder 需 {year,persons,result} 页面级查询态,非单时刻可推)与
// jieqipan(报告链专用 profile,无独立模块快照;分至内容走 jieqi_* 系列键)——二者标签仅供报告链取名。
const TIMEPOINT_CASTABLE_SET = new Set([...TIME_CASTABLE_DIVINATION, 'sixyao', 'huangji', 'taixuan', 'jingjue', 'wuzhao', 'shenyishu', 'xiaoliuren', 'feigong', 'xiaochengtu', 'huangli', 'tongshu']); // 小六壬/飞宫按占时(农历月日时支)可起;小成图按梅花时间卦(年支序+月+日为上数,加时支序为下数)走既有两数式起

function parseBirthString(text, zone = '+08:00'){
	const raw = `${text || ''}`.trim();
	const matched = raw.match(/^(-?\d+)-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
	if(!matched){
		return new DateTime({ zone });
	}
	const yearVal = parseInt(matched[1], 10);
	return new DateTime({
		ad: yearVal < 0 ? -1 : 1,
		year: Math.abs(yearVal),
		month: parseInt(matched[2], 10),
		date: parseInt(matched[3], 10),
		hour: parseInt(matched[4] || '0', 10),
		minute: parseInt(matched[5] || '0', 10),
		second: parseInt(matched[6] || '0', 10),
		zone: zone || '+08:00',
	});
}

// (normalizeTags 已迁 aiAnalysisSources.js —— 顶部 import)

// 主限推算年数兜底:与 AstroPrimaryDirection.normalizePdYears 同口径(取整、夹 1–3000、坏值回退 100)。
function normalizePdYearsValue(value){
	if(value === undefined || value === null || value === ''){
		return 100;
	}
	const n = Math.round(Number(value));
	if(!Number.isFinite(n)){
		return 100;
	}
	return Math.max(1, Math.min(3000, n));
}

function buildFieldObject(record){
	// 起课时间合成的 timepoint record 用 divTime 不用 birth(参 AIAnalysisMain.js:1029),
	// 旧实现只读 record.birth → 撞 fallback `new DateTime({zone})` 用当前系统时间起盘,
	// 太玄/荆诀/五兆/神易数 等 backend 拿到时再格式化就出 NaN-undefined-undefined。
	// 兜底 birth ?? divTime,两者皆同口径 'YYYY-MM-DD HH:mm:ss' 即可被 parseBirthString 正确匹配。
	const birthText = record.birth || record.divTime || '';
	const birth = parseBirthString(birthText, record.zone);
	return {
		cid: { value: record.cid || null },
		ad: { value: birth.ad },
		date: { value: birth.clone().startOf('date') },
		time: { value: birth.clone() },
		zone: { value: record.zone || birth.zone || '+08:00' },
		lat: { value: record.lat || '' },
		lon: { value: record.lon || '' },
		gpsLat: { value: record.gpsLat || 0 },
		gpsLon: { value: record.gpsLon || 0 },
		name: { value: record.name || '' },
		pos: { value: record.pos || '' },
		// [V6 复查轮] 🔴 缺省回退 1(Alcabitius)=技法页 DefaultHouseSystem 同源:R4「非默认才落键」
		// 存盘后大多数默认盘 record 无 hsys 键,此前回退 0(整宫制) ⇒ 同一记录有旧快照时按 1 复用、
		// 无快照 fresh 重算按 0 起盘 —— 挂载内容随快照槽状态换宫制,且与技法页(恒 1)分叉。
		hsys: { value: record.hsys !== undefined ? record.hsys : 1 },
		zodiacal: { value: record.zodiacal !== undefined ? record.zodiacal : 0 },
		// 恒星黄道盘挂载 AI 时,沿用该盘保存的 ayanāṃśa(缺省 ''=后端默认 Lahiri),
		// 使 AI 快照行星经度与盘面一致(全链路:储存→挂载→AI)。
		siderealAyanamsa: { value: record.siderealAyanamsa !== undefined ? record.siderealAyanamsa : '' },
		// [WP-7] user 档历元参数随盘还原(record 有才建;缺=读全局当前槽由 fieldParams 兜)
		...(record.userAyanT0 !== undefined && record.userAyanT0 !== null ? { userAyanT0: { value: record.userAyanT0 } } : {}),
		...(record.userAyanDeg !== undefined && record.userAyanDeg !== null ? { userAyanDeg: { value: record.userAyanDeg } } : {}),
		// AI 挂载「每技法设置」可覆盖的占星排盘开关:优先读 record(挂载重算时 merge 进 record.*),
		// 缺省回退现状默认(0)→ 不调任何项时与现状逐字一致(守「默认即现状」)。
		tradition: { value: record.tradition !== undefined && record.tradition !== null ? record.tradition : 0 },
		termsVariant: { value: record.termsVariant !== undefined && record.termsVariant !== null ? record.termsVariant : 0 },
		// [F14] 随盘界表表体(termsVariant=4):record 有才建 entry → overrides getVal 直取随盘表,零膨胀
		...(Array.isArray(record.customTermsDay) ? { customTermsDay: { value: record.customTermsDay } } : {}),
		...(Array.isArray(record.customTermsNight) ? { customTermsNight: { value: record.customTermsNight } } : {}),
		// 占星(希腊化)G12/G13/G15/G20-P2:西占月交点真平 / 区分缓冲 / 狮子土星优先 / 三分集 / 福点反转。
		// 挂载重算优先读 record,缺省回退零回归默认(平/几何/木首/Dorothean/反转ON)→ 不调任何项与现状逐字一致;
		// 经 fieldsToParams 条件透传(默认不下发)→ /chart 复算 → AI 快照行星尊贵/界主/福点与盘面一致。
		westNodeType: { value: record.westNodeType !== undefined && record.westNodeType !== null ? record.westNodeType : classicalGlobalValue('westNodeType') },
		sectBuffer: { value: record.sectBuffer !== undefined && record.sectBuffer !== null ? record.sectBuffer : classicalGlobalValue('sectBuffer') },
		leoBoundFirst: { value: record.leoBoundFirst !== undefined && record.leoBoundFirst !== null ? record.leoBoundFirst : classicalGlobalValue('leoBoundFirst') },
		triplicity: { value: record.triplicity !== undefined && record.triplicity !== null ? record.triplicity : classicalGlobalValue('triplicity') },
		lotReversal: { value: record.lotReversal !== undefined && record.lotReversal !== null ? record.lotReversal : classicalGlobalValue('lotReversal') },
		// 希腊补齐三开关(点公式文档口径/交点旺/土星旺20°):与 localcharts 落库键+recordFieldsRestore
		// 还原键成对 ⇒ 挂载复算与所存盘逐字一致。[对标战役 0c] 三键升正仓后缺省改读全局现值
		// (与下方古典口径 10 键同理:record 缺键=「随全局」;全局=默认 0 时 helper 判等仍不下发=零回归)。
		lotsDocReverse: { value: record.lotsDocReverse !== undefined && record.lotsDocReverse !== null ? record.lotsDocReverse : classicalGlobalValue('lotsDocReverse') },
		nodeExaltation: { value: record.nodeExaltation !== undefined && record.nodeExaltation !== null ? record.nodeExaltation : classicalGlobalValue('nodeExaltation') },
		// 双子界序校勘(0/1):fieldParams 的条件透传早已在读它 —— 🔴 此处曾不产该字段,
		// 那行透传恒为永假分支(死透传),挂载改「双子界序」永不生效。
		geminiBoundEmended: { value: record.geminiBoundEmended !== undefined && record.geminiBoundEmended !== null ? record.geminiBoundEmended : 0 },
		// 🔴 古典口径 10 键(空亡口径/焦伤·核心·日光束界值/宫头前移/恒星容许度·档/映点容许度/燃烧之路边界):
		// 曾整段断链 —— live 主盘 fieldsToParams 走 classicalBackendOverridesFromFields,而 AI 侧本函数
		// 不产字段 + fieldParams 不接 helper,挂载改这 10 项 UI 打 regenerated 绿标、正文逐字节不变。
		// [V6 二轮复查] 缺省读全局现值(页面种子=classicalGlobalValue,存盘「值==种子不落键」→
		// record 缺键=「随全局」;此前回退 undefined=内建,改过全局的用户挂载重算与页面分叉)。
		// 全局=默认时 helper 判等仍不下发 = 字节级零回归。
		houseCuspAdvance: { value: record.houseCuspAdvance !== undefined && record.houseCuspAdvance !== null ? record.houseCuspAdvance : classicalGlobalValue('houseCuspAdvance') },
		cazimiOrb: { value: record.cazimiOrb !== undefined && record.cazimiOrb !== null ? record.cazimiOrb : classicalGlobalValue('cazimiOrb') },
		combustOrb: { value: record.combustOrb !== undefined && record.combustOrb !== null ? record.combustOrb : classicalGlobalValue('combustOrb') },
		underBeamsOrb: { value: record.underBeamsOrb !== undefined && record.underBeamsOrb !== null ? record.underBeamsOrb : classicalGlobalValue('underBeamsOrb') },
		vocMode: { value: record.vocMode !== undefined && record.vocMode !== null ? record.vocMode : classicalGlobalValue('vocMode') },
		vocIncludeOuter: { value: record.vocIncludeOuter !== undefined && record.vocIncludeOuter !== null ? record.vocIncludeOuter : classicalGlobalValue('vocIncludeOuter') },
		fixedStarOrb: { value: record.fixedStarOrb !== undefined && record.fixedStarOrb !== null ? record.fixedStarOrb : classicalGlobalValue('fixedStarOrb') },
		fixedStarOrbMode: { value: record.fixedStarOrbMode !== undefined && record.fixedStarOrbMode !== null ? record.fixedStarOrbMode : classicalGlobalValue('fixedStarOrbMode') },
		antisciaOrb: { value: record.antisciaOrb !== undefined && record.antisciaOrb !== null ? record.antisciaOrb : classicalGlobalValue('antisciaOrb') },
		viaCombustaVariant: { value: record.viaCombustaVariant !== undefined && record.viaCombustaVariant !== null ? record.viaCombustaVariant : classicalGlobalValue('viaCombustaVariant') },
		// [WP-2] 天文口径批(record 缺键=随全局;全局=默认时 helper 判等不下发=零回归)
		combustOwnChariotExempt: { value: record.combustOwnChariotExempt !== undefined && record.combustOwnChariotExempt !== null ? record.combustOwnChariotExempt : classicalGlobalValue('combustOwnChariotExempt') },
		westLilithType: { value: record.westLilithType !== undefined && record.westLilithType !== null ? record.westLilithType : classicalGlobalValue('westLilithType') },
		topocentricMoon: { value: record.topocentricMoon !== undefined && record.topocentricMoon !== null ? record.topocentricMoon : classicalGlobalValue('topocentricMoon') },
		stationMarking: { value: record.stationMarking !== undefined && record.stationMarking !== null ? record.stationMarking : classicalGlobalValue('stationMarking') },
		// [WP-3] 希腊点变体批(record 缺键=随全局)
		hermeticLotsReversal: { value: record.hermeticLotsReversal !== undefined && record.hermeticLotsReversal !== null ? record.hermeticLotsReversal : classicalGlobalValue('hermeticLotsReversal') },
		erosConstruction: { value: record.erosConstruction !== undefined && record.erosConstruction !== null ? record.erosConstruction : classicalGlobalValue('erosConstruction') },
		lotFortuneVariant: { value: record.lotFortuneVariant !== undefined && record.lotFortuneVariant !== null ? record.lotFortuneVariant : classicalGlobalValue('lotFortuneVariant') },
		lotFatherCombustAlt: { value: record.lotFatherCombustAlt !== undefined && record.lotFatherCombustAlt !== null ? record.lotFatherCombustAlt : classicalGlobalValue('lotFatherCombustAlt') },
		lotProjection: { value: record.lotProjection !== undefined && record.lotProjection !== null ? record.lotProjection : classicalGlobalValue('lotProjection') },
		// [WP-4] 尊贵与判定批后端三键
		dignityDebilities: { value: record.dignityDebilities !== undefined && record.dignityDebilities !== null ? record.dignityDebilities : classicalGlobalValue('dignityDebilities') },
		almutenTripMode: { value: record.almutenTripMode !== undefined && record.almutenTripMode !== null ? record.almutenTripMode : classicalGlobalValue('almutenTripMode') },
		planetaryHourMethod: { value: record.planetaryHourMethod !== undefined && record.planetaryHourMethod !== null ? record.planetaryHourMethod : classicalGlobalValue('planetaryHourMethod') },
		orbSystem: { value: record.orbSystem !== undefined && record.orbSystem !== null ? record.orbSystem : classicalGlobalValue('orbSystem') },
		luminaryOrbBonus: { value: record.luminaryOrbBonus !== undefined && record.luminaryOrbBonus !== null ? record.luminaryOrbBonus : classicalGlobalValue('luminaryOrbBonus') },
		aspectIncludeCusps: { value: record.aspectIncludeCusps !== undefined && record.aspectIncludeCusps !== null ? record.aspectIncludeCusps : classicalGlobalValue('aspectIncludeCusps') },
		aspectIncludeLots: { value: record.aspectIncludeLots !== undefined && record.aspectIncludeLots !== null ? record.aspectIncludeLots : classicalGlobalValue('aspectIncludeLots') },
		aspectIncludeMidpoints: { value: record.aspectIncludeMidpoints !== undefined && record.aspectIncludeMidpoints !== null ? record.aspectIncludeMidpoints : classicalGlobalValue('aspectIncludeMidpoints') },
		solarReturnVariant: { value: record.solarReturnVariant !== undefined && record.solarReturnVariant !== null ? record.solarReturnVariant : classicalGlobalValue('solarReturnVariant') },
		returnLatitudeMode: { value: record.returnLatitudeMode !== undefined && record.returnLatitudeMode !== null ? record.returnLatitudeMode : classicalGlobalValue('returnLatitudeMode') },
		vulcanCalc: { value: record.vulcanCalc !== undefined && record.vulcanCalc !== null ? record.vulcanCalc : classicalGlobalValue('vulcanCalc') },
		strongRecption: { value: record.strongRecption !== undefined && record.strongRecption !== null ? record.strongRecption : 0 },
		simpleAsp: { value: record.simpleAsp !== undefined && record.simpleAsp !== null ? record.simpleAsp : 0 },
		virtualPointReceiveAsp: { value: record.virtualPointReceiveAsp !== undefined && record.virtualPointReceiveAsp !== null ? record.virtualPointReceiveAsp : 0 },
		doubingSu28: { value: record.doubingSu28 !== undefined && record.doubingSu28 !== null ? Number(record.doubingSu28) : 0 },
		// 宿占人事十二宫起宫(ASC起盘 0 / 八字起盘 1):优先读 record(存盘/挂载重算),缺省回退 0=现状。
		houseStartMode: { value: record.houseStartMode !== undefined && record.houseStartMode !== null ? Number(record.houseStartMode) : ((typeof localStorage !== 'undefined' && parseInt(localStorage.getItem('suzhanHouseStartMode'), 10) === 1) ? 1 : 0) },
		predictive: { value: 1 },
		showPdBounds: { value: 1 },
		pdtype: { value: record.pdtype === 1 ? 1 : 0 },
		// P0 起 record 可能持久化用户实选 (placidus / 其它 timeKey)；优先读 record，
		// 不存在时回退到默认 Alcabitius+Ptolemy (守 v2.5.3 默认路径字节级一致)。
		pdMethod: { value: record.pdMethod || 'core_alchabitius' },
		pdTimeKey: { value: record.pdTimeKey || 'Ptolemy' },
		// 主限法进阶开关(向运顺逆 / 映点 / 界):顺逆默认都开(用户偏好),映点/界默认关。
		pdDirect: { value: record.pdDirect === 0 ? 0 : 1 },
		pdConverse: { value: record.pdConverse === 0 ? 0 : 1 },
		pdAntiscia: { value: record.pdAntiscia ? 1 : 0 },
		pdTerms: { value: record.pdTerms ? 1 : 0 },
		// 主限推算年数:挂载「每技法设置」可经 record.pdYears 覆盖(默认 100、范围 1–3000,
		// 与 AstroPrimaryDirection.normalizePdYears / perchart.py 兜底一致;>360 走多圈复发行)。缺省→100=现状字节级一致。
		pdYears: { value: normalizePdYearsValue(record.pdYears) },
		// 🔴 主限法解耦八键(弧算法/盘面宫制/框架/平行/急动平行/自定义钥匙率/应星扩展/迫星扩展):
		// 曾在挂载链全死(cetian 同型)—— schema 有、本函数无 → mergeOptionsIntoRecord 写进 record 当场蒸发。
		// 缺省 undefined → fieldParams 条件透传全部跳过 = 默认路径字节零回归(golden540 恒绿)。
		pdProjection: { value: record.pdProjection !== undefined && record.pdProjection !== null ? record.pdProjection : undefined },
		pdFrame: { value: record.pdFrame !== undefined && record.pdFrame !== null ? record.pdFrame : undefined },
		pdFramework: { value: record.pdFramework !== undefined && record.pdFramework !== null ? record.pdFramework : undefined },
		pdParallel: { value: record.pdParallel !== undefined && record.pdParallel !== null ? record.pdParallel : undefined },
		pdRaptParallel: { value: record.pdRaptParallel !== undefined && record.pdRaptParallel !== null ? record.pdRaptParallel : undefined },
		pdTimeKeyCustom: { value: record.pdTimeKeyCustom !== undefined && record.pdTimeKeyCustom !== null ? record.pdTimeKeyCustom : undefined },
		pdSignificators: { value: Array.isArray(record.pdSignificators) ? record.pdSignificators : undefined },
		pdPromissorTypes: { value: Array.isArray(record.pdPromissorTypes) ? record.pdPromissorTypes : undefined },
		pdaspects: { value: DEFAULT_PD_ASPECTS.slice(0) },
		// 时间算法(0=真太阳时按经度校正 / 1=直接时间用钟表时)+ 晚子时口径须从存盘读取,
		// 否则 canping/heluo 等八字类快照会对「直接时间」盘错用真太阳时校正、忽略晚子时设置(口径与显示不一致)。
		timeAlg: { value: (record.timeAlg !== undefined && record.timeAlg !== null) ? record.timeAlg : 0 },
		phaseType: { value: record.phaseType !== undefined && record.phaseType !== null ? record.phaseType : 0 },
		godKeyPos: { value: record.godKeyPos !== undefined && record.godKeyPos !== null ? record.godKeyPos : '年' },
		after23NewDay: { value: (record.after23NewDay !== undefined && record.after23NewDay !== null) ? record.after23NewDay : defaultAfter23NewDay() },
		lateZiHourUseNextDay: { value: (record.lateZiHourUseNextDay !== undefined && record.lateZiHourUseNextDay !== null) ? record.lateZiHourUseNextDay : defaultLateZiHourUseNextDay() },
		adjustJieqi: { value: record.adjustJieqi !== undefined && record.adjustJieqi !== null ? record.adjustJieqi : 0 },
		gender: { value: record.gender !== undefined && record.gender !== null ? record.gender : 1 },
		southchart: { value: record.southchart !== undefined && record.southchart !== null ? record.southchart : 0 },
		// 七政四余命度/身宫/罗计模式:挂载设置可经 record 携带(缺省 undefined → builder 回退全局 localStorage 默认,即现状)。
		guolaoLifeMode: { value: record.guolaoLifeMode !== undefined && record.guolaoLifeMode !== null ? record.guolaoLifeMode : undefined },
		guolaoBodyMode: { value: record.guolaoBodyMode !== undefined && record.guolaoBodyMode !== null ? record.guolaoBodyMode : undefined },
		// 七政四余 G6/G10/G11/G12/WP-D 起盘设置:GuoLaoChartMain 的 guolaoFieldValue/guolaoAyanamsaFromFields 据
		// fields.<key> 读回算盘(报时星太阳时/罗计真平/月孛真平/恒星黄道岁差/授时古法推变·古宿岁差·赤道锚点)。
		// 优先读存盘 record(buildLocalChartRecord 已落库);缺省 undefined → guolaoFieldValue 回退全局 localStorage 默认
		// (=现状零回归,与 guolaoLifeMode/Body/Node 同口径)。仅当存盘携带该值时,AI 挂载快照与保存时盘面一致。
		guolaoTrueSolarTime: { value: record.guolaoTrueSolarTime !== undefined && record.guolaoTrueSolarTime !== null ? record.guolaoTrueSolarTime : undefined },
		guolaoNodeType: { value: record.guolaoNodeType !== undefined && record.guolaoNodeType !== null ? record.guolaoNodeType : undefined },
		guolaoLilithType: { value: record.guolaoLilithType !== undefined && record.guolaoLilithType !== null ? record.guolaoLilithType : undefined },
		guolaoAyanamsa: { value: record.guolaoAyanamsa !== undefined && record.guolaoAyanamsa !== null ? record.guolaoAyanamsa : undefined },
		guolaoTuibianMethod: { value: record.guolaoTuibianMethod !== undefined && record.guolaoTuibianMethod !== null ? record.guolaoTuibianMethod : undefined },
		guolaoGufaPrecess: { value: record.guolaoGufaPrecess !== undefined && record.guolaoGufaPrecess !== null ? record.guolaoGufaPrecess : undefined },
		guolaoEqTropicalAnchor: { value: record.guolaoEqTropicalAnchor !== undefined && record.guolaoEqTropicalAnchor !== null ? record.guolaoEqTropicalAnchor : undefined },
		// 命主取法/行运法/童限基数(horosaGuolaoDisplay JSON 罐,per-key storage 盖不住 → record 链):
		guolaoLifeMasterMode: { value: record.guolaoLifeMasterMode !== undefined && record.guolaoLifeMasterMode !== null ? record.guolaoLifeMasterMode : undefined },
		guolaoMinorLimitType: { value: record.guolaoMinorLimitType !== undefined && record.guolaoMinorLimitType !== null ? record.guolaoMinorLimitType : undefined },
		guolaoTongxianBase: { value: record.guolaoTongxianBase !== undefined && record.guolaoTongxianBase !== null ? record.guolaoTongxianBase : undefined },
		// 印占：岁差制/分宫制/交点(挂载设置可调,缺省回退印占默认)。
		indiaHsys: { value: record.indiaHsys !== undefined && record.indiaHsys !== null ? record.indiaHsys : undefined },
		indiaAyanamsa: { value: record.indiaAyanamsa !== undefined && record.indiaAyanamsa !== null ? record.indiaAyanamsa : undefined },
		indiaNodeType: { value: record.indiaNodeType !== undefined && record.indiaNodeType !== null ? record.indiaNodeType : undefined },
		indiaDashaSystem: { value: record.indiaDashaSystem !== undefined && record.indiaDashaSystem !== null ? record.indiaDashaSystem : undefined },
		// Sthira 起座(lagna/brahma):IndiaChart.fieldsToParams 读 fields.indiaSthiraStart→仅非默认 'lagna' 才下发 →
		// 默认 undefined→快照 Sthira 座运走 lagna(后端缺键即 lagna)=现状零回归;挂载/存盘携 brahma 则 AI 与盘一致。
		indiaSthiraStart: { value: record.indiaSthiraStart !== undefined && record.indiaSthiraStart !== null ? record.indiaSthiraStart : undefined },
		// 大运起点 seed / 过运日期 / 年度盘年份 / 分盘集:IndiaChart.fieldsToParams 经 pickOpt 读 fields.indiaDashaSeed/
		// indiaTransitDate/indiaTajakaYear/indiaVargaSet 下发后端。同源却漏透传 → 改这 4 项后挂载快照仍取默认盘、与界面不符。
		// 缺省 undefined → 后端缺键回退默认(seed=moon / 过运=今日 / 年度=当前年 / 分盘集=单盘)=现状零回归;携带则 AI 与盘一致。
		indiaDashaSeed: { value: record.indiaDashaSeed !== undefined && record.indiaDashaSeed !== null ? record.indiaDashaSeed : undefined },
		indiaTransitDate: { value: record.indiaTransitDate !== undefined && record.indiaTransitDate !== null ? record.indiaTransitDate : undefined },
		indiaTajakaYear: { value: record.indiaTajakaYear !== undefined && record.indiaTajakaYear !== null ? record.indiaTajakaYear : undefined },
		indiaVargaSet: { value: record.indiaVargaSet !== undefined && record.indiaVargaSet !== null ? record.indiaVargaSet : undefined },
		// G5 年长 / G13 年盘口径:fieldsToParams 仅非默认才下发 → 缺省 undefined = 现状零回归;
		// 挂载/存盘携带则 AI 大运/年度快照与盘一致(漏透传 = AI 快照取默认盘,本模块已犯过)。
		indiaDashaYearLength: { value: record.indiaDashaYearLength !== undefined && record.indiaDashaYearLength !== null ? record.indiaDashaYearLength : undefined },
		indiaAnnualChartType: { value: record.indiaAnnualChartType !== undefined && record.indiaAnnualChartType !== null ? record.indiaAnnualChartType : undefined },
		indiaSchool: { value: record.indiaSchool !== undefined && record.indiaSchool !== null ? record.indiaSchool : undefined },
		indiaVargaVariant: { value: record.indiaVargaVariant !== undefined && record.indiaVargaVariant !== null ? record.indiaVargaVariant : undefined },
		indiaKarakaScheme: { value: record.indiaKarakaScheme !== undefined && record.indiaKarakaScheme !== null ? record.indiaKarakaScheme : undefined },
		indiaYuddhaCriterion: { value: record.indiaYuddhaCriterion !== undefined && record.indiaYuddhaCriterion !== null ? record.indiaYuddhaCriterion : undefined },
		// 大运流派开关(21 键 JSON 对象)+年盘地点:漏透传 = AI 挂载复算按默认口径(账实不符)。
		indiaDashaVariants: { value: record.indiaDashaVariants !== undefined && record.indiaDashaVariants !== null ? record.indiaDashaVariants : undefined },
		indiaVarshaLat: { value: record.indiaVarshaLat !== undefined && record.indiaVarshaLat !== null ? record.indiaVarshaLat : undefined },
		indiaVarshaLon: { value: record.indiaVarshaLon !== undefined && record.indiaVarshaLon !== null ? record.indiaVarshaLon : undefined },
		guolaoNodeMode: { value: record.guolaoNodeMode !== undefined && record.guolaoNodeMode !== null ? record.guolaoNodeMode : undefined },
		// 容许度（对齐 models/astro.js fieldsToParams）：
		//  - orbScale(整体缩放,数字):挂载可经 record.orbScale 覆盖(0.5–2.5,默认1);缺省/1 → undefined(后端零回归=现状)。
		//  - orbs(逐星对象):仅当挂载开「沿用本盘自定义容许度」(record.useStoredOrbs)时才下发存盘 record.orbs;
		//    默认不下发(=现状,后端用默认容许度)。对象型不进 prune 比较(prune 只看 useStoredOrbs 布尔)。
		orbScale: { value: (record.orbScale !== undefined && record.orbScale !== null && Number(record.orbScale) !== 1 && Number.isFinite(Number(record.orbScale))) ? Number(record.orbScale) : undefined },
		orbs: { value: (record.useStoredOrbs && record.orbs && typeof record.orbs === 'object' && Object.keys(record.orbs).length) ? record.orbs : undefined },
		// 埃及历七轴(egypt_*):astroAiSnapshot 的 egyptSchoolFromFields(fields) 读 fields['egypt_'+k].value,
		// 🔴 曾不产这些字段 → 恒返 null 恒落全局 currentEgyptSchool(),「随盘键优先」承诺落空。
		// 缺省 undefined → egyptSchoolFromFields 判假仍回落全局 = 零回归;挂载/存盘携带则【埃及历】段随盘。
		...EGYPT_RECORD_KEYS.reduce((acc, k)=>{
			acc[k] = { value: record[k] !== undefined && record[k] !== null ? record[k] : undefined };
			return acc;
		}, {}),
		group: { value: normalizeTags(record.group) },
	};
}

function fieldParams(fields){
	return {
		cid: null,
		ad: fields.date.value.ad,
		date: fields.date.value.format('YYYY/MM/DD'),
		time: fields.time.value.format('HH:MM:SS'),
		zone: fields.date.value.zone,
		lat: fields.lat.value,
		lon: fields.lon.value,
		gpsLat: fields.gpsLat.value,
		gpsLon: fields.gpsLon.value,
		hsys: fields.hsys.value,
		southchart: fields.southchart.value,
		zodiacal: fields.zodiacal.value,
		siderealAyanamsa: fields.siderealAyanamsa ? fields.siderealAyanamsa.value : '',
		...((fields.siderealAyanamsa && `${fields.siderealAyanamsa.value}` === 'user')
			? require('./customCalibreStores').userAyanParamsFrom((k) => (fields[k] ? fields[k].value : undefined))
			: {}),
		tradition: fields.tradition.value,
		doubingSu28: fields.doubingSu28.value,
		strongRecption: fields.strongRecption.value,
		simpleAsp: fields.simpleAsp.value,
		virtualPointReceiveAsp: fields.virtualPointReceiveAsp.value,
		predictive: fields.predictive.value,
		showPdBounds: fields.showPdBounds.value,
		pdtype: fields.pdtype.value,
		pdMethod: fields.pdMethod.value,
		pdTimeKey: fields.pdTimeKey.value,
		pdDirect: fields.pdDirect ? fields.pdDirect.value : 1,
		pdConverse: fields.pdConverse ? fields.pdConverse.value : 0,
		pdAntiscia: fields.pdAntiscia ? fields.pdAntiscia.value : 0,
		pdTerms: fields.pdTerms ? fields.pdTerms.value : 0,
		pdYears: fields.pdYears ? fields.pdYears.value : 100,
		// 主限法解耦八键条件透传(照抄 models/astro.js fieldsToParams,默认不下发零回归):
		...(fields.pdProjection && fields.pdProjection.value && fields.pdProjection.value !== 'ptolemy' ? { pdProjection: fields.pdProjection.value } : {}),
		...(fields.pdFrame && fields.pdFrame.value && fields.pdFrame.value !== 'alcabitius' ? { pdFrame: fields.pdFrame.value } : {}),
		...(fields.pdFramework && fields.pdFramework.value && fields.pdFramework.value !== 'aspect' ? { pdFramework: fields.pdFramework.value } : {}),
		...(fields.pdParallel && (fields.pdParallel.value === 1 || fields.pdParallel.value === '1') ? { pdParallel: 1 } : {}),
		...(fields.pdRaptParallel && (fields.pdRaptParallel.value === 1 || fields.pdRaptParallel.value === '1') ? { pdRaptParallel: 1 } : {}),
		...(fields.pdTimeKeyCustom && fields.pdTimeKeyCustom.value ? { pdTimeKeyCustom: fields.pdTimeKeyCustom.value } : {}),
		...(fields.pdSignificators && Array.isArray(fields.pdSignificators.value) && fields.pdSignificators.value.length ? { pdSignificators: fields.pdSignificators.value } : {}),
		...(fields.pdPromissorTypes && Array.isArray(fields.pdPromissorTypes.value) && fields.pdPromissorTypes.value.length ? { pdPromissorTypes: fields.pdPromissorTypes.value } : {}),
		pdaspects: fields.pdaspects.value,
		// 容许度（对齐 models/astro.js fieldsToParams:248-249）：falsy → undefined（不下发=后端零回归）。
		orbs: (fields.orbs && fields.orbs.value) ? fields.orbs.value : undefined,
		orbScale: (fields.orbScale && fields.orbScale.value) ? fields.orbScale.value : undefined,
		// [V6-W1] 🔴 手抄漂移补齐(对拍闸 W3 永久看守):此前 AI 链缺这三组,与 fieldsToParams 分叉——
		// 日界/晚子时开关随盘存档却不进 AI 重算请求(四柱口径与技法页分叉);七政命度模式同漏。
		// 条件透传:缺省不下发=后端默认零回归(与 models 侧同口径)。
		...(fields.after23NewDay && fields.after23NewDay.value !== undefined && fields.after23NewDay.value !== null ? { after23NewDay: fields.after23NewDay.value } : {}),
		...(fields.lateZiHourUseNextDay && fields.lateZiHourUseNextDay.value !== undefined && fields.lateZiHourUseNextDay.value !== null ? { lateZiHourUseNextDay: fields.lateZiHourUseNextDay.value } : {}),
		...(fields.guolaoLifeMode && fields.guolaoLifeMode.value && fields.guolaoLifeMode.value !== 'asc' ? { guolaoLifeMode: fields.guolaoLifeMode.value } : {}),
		// 🔴 [V6-W3 对拍闸抓获] 七政六键此前只在技法页下发,AI 挂载重算不带 ⇒ 报时星太阳时/四余取法/
		// 推变法/古宿岁差/回归锚随盘存非默认时,挂载盘与技法页分叉。条件透传照抄 fieldsToParams 同款。
		...(fields.guolaoTrueSolarTime && (fields.guolaoTrueSolarTime.value === 'mean' || fields.guolaoTrueSolarTime.value === 'off') ? { trueSolarTime: fields.guolaoTrueSolarTime.value } : {}),
		...(fields.guolaoNodeType && fields.guolaoNodeType.value === 'true' ? { guolaoNodeType: 'true' } : {}),
		...(fields.guolaoLilithType && fields.guolaoLilithType.value === 'true' ? { guolaoLilithType: 'true' } : {}),
		...(fields.guolaoTuibianMethod && (fields.guolaoTuibianMethod.value === 'jintui' || fields.guolaoTuibianMethod.value === 'huiyuan') ? { guolaoTuibianMethod: fields.guolaoTuibianMethod.value } : {}),
		...(fields.guolaoGufaPrecess && (fields.guolaoGufaPrecess.value === 1 || fields.guolaoGufaPrecess.value === '1') ? { guolaoGufaPrecess: 1 } : {}),
		...(fields.guolaoEqTropicalAnchor && fields.guolaoEqTropicalAnchor.value === 'chunfen' ? { guolaoEqTropicalAnchor: 'chunfen' } : {}),
		// 🔴 希腊化开关六项：此前本函数只转发 tradition，漏这六项 ⇒ AI 重算盘对界系/交点/区分缓冲/
		// 狮首界/三分集/福点反转全不敏感（与所选流派档分叉）。按 models/astro.js fieldsToParams 同款
		// **条件透传**补齐：默认值不下发 → 请求体与缓存键逐字节不变（改成无条件传即全量回归）。
		// [SURF-R3f] termsVariant/geminiBoundEmended 手写行随 models/astro.js 同步删除:spread(下方)
		// 按 spec 全覆盖且归一更严;两侧同删=fieldParams≡fieldsToParams 对拍闸恰等。
		...(fields.westNodeType && fields.westNodeType.value === 'true' ? { westNodeType: 'true' } : {}),
		...(fields.sectBuffer && fields.sectBuffer.value === 'ptolemy5' ? { sectBuffer: 'ptolemy5' } : {}),
		...(fields.leoBoundFirst && (fields.leoBoundFirst.value === 1 || fields.leoBoundFirst.value === '1') ? { leoBoundFirst: 1 } : {}),
		...(fields.triplicity && fields.triplicity.value && fields.triplicity.value !== 'Dorothean' ? { triplicity: fields.triplicity.value } : {}),
		...(fields.lotReversal && (fields.lotReversal.value === 0 || fields.lotReversal.value === '0') ? { lotReversal: 0 } : {}),
		// 🔴 古典口径覆盖走 classicalBackendOverridesFromFields 单一真值源(与 models/astro.js:390 同款):
		// 覆盖 宫头前移/日心/焦伤/日光束/空亡口径(+外行星)/恒星容许度·档(含 starOrb/starOrbMode 名映射)/
		// 映点容许度/燃烧之路边界 + lotsDocReverse/nodeExaltation 两开关。
		// 此前开关在此手写、其余 10 键整段缺失 —— 手写副本正是主盘/挂载分叉的病根,并入单源。
		...classicalBackendOverridesFromFields(fields),
		name: fields.name.value,
		pos: fields.pos.value,
		group: fields.group.value,
	};
}

function buildSnapshotMetaFromRecord(record, extraMeta = {}){
	const parts = buildSourceSignature({
		sourceType: record && record.birth ? 'chart' : 'case',
		record,
	});
	return {
		date: parts.date || '',
		time: parts.time || '',
		zone: parts.zone || '',
		lon: parts.lon || '',
		lat: parts.lat || '',
		...extraMeta,
	};
}

function buildCaseSnapshotFields(record){
	const dt = parseBirthString(record && (record.divTime || record.updateTime || ''), record && record.zone ? record.zone : '+08:00');
	return {
		ad: { value: dt.ad },
		date: { value: dt.clone() },
		time: { value: dt.clone() },
		zone: { value: record && record.zone ? record.zone : dt.zone || '+08:00' },
		lon: { value: record && record.lon ? record.lon : '' },
		lat: { value: record && record.lat ? record.lat : '' },
		gpsLon: { value: record && record.gpsLon !== undefined ? record.gpsLon : 0 },
		gpsLat: { value: record && record.gpsLat !== undefined ? record.gpsLat : 0 },
		gender: { value: record && record.gender !== undefined && record.gender !== null ? record.gender : 1 },
		after23NewDay: { value: record && record.after23NewDay !== undefined ? record.after23NewDay : defaultAfter23NewDay() },
		lateZiHourUseNextDay: { value: record && record.lateZiHourUseNextDay !== undefined ? record.lateZiHourUseNextDay : defaultLateZiHourUseNextDay() },
		timeAlg: { value: record && record.timeAlg !== undefined ? record.timeAlg : 0 },
	};
}

// [V6-W2] 🔴 第二参 gearOptions:日界/晚子时齿轮值**优先**(record 兜底,再全局兜底)。
// 此前四柱农历(fetchPreciseNongli 的入参)只读 record —— 挂载拨日界齿轮时局/置闰跟着变、
// 日柱不变(B-2 半通死开关,仅 23:00-59 生辰显形,肉眼最难发现的一类)。齿轮与局同源后闭环。
function buildCaseSnapshotParams(record, gearOptions){
	const fields = buildCaseSnapshotFields(record || {});
	const g = gearOptions && typeof gearOptions === 'object' ? gearOptions : {};
	const pickDayRule = (name, recordFallback, globalFallback)=>{
		if(g[name] !== undefined && g[name] !== null && g[name] !== ''){
			return parseInt(`${g[name]}`, 10);
		}
		return recordFallback !== undefined ? recordFallback : globalFallback();
	};
	return {
		date: fields.date.value.format('YYYY-MM-DD'),
		time: fields.time.value.format('HH:mm:ss'),
		ad: fields.date.value.ad || 1,
		zone: fields.zone.value,
		lon: fields.lon.value,
		lat: fields.lat.value,
		gpsLat: fields.gpsLat.value,
		gpsLon: fields.gpsLon.value,
		after23NewDay: pickDayRule('after23NewDay', (fields.after23NewDay && fields.after23NewDay.value !== undefined) ? fields.after23NewDay.value : undefined, defaultAfter23NewDay),
		lateZiHourUseNextDay: pickDayRule('lateZiHourUseNextDay', (fields.lateZiHourUseNextDay && fields.lateZiHourUseNextDay.value !== undefined) ? fields.lateZiHourUseNextDay.value : undefined, defaultLateZiHourUseNextDay),
	};
}

function getSnapshotSaveModuleName(key){
	if(key === 'sixyao'){
		return 'guazhan';
	}
	return key;
}

function getCaseGenderLabel(record){
	return `${record && record.gender !== undefined && record.gender !== null ? record.gender : ''}` === '0' ? '女' : '男';
}

function saveGeneratedTechniqueSnapshot(key, content, record, extraMeta = {}){
	const text = `${content || ''}`.trim();
	if(!text){
		return null;
	}
	return saveModuleAISnapshot(
		getSnapshotSaveModuleName(normalizeTechniqueKey(key)),
		text,
		buildSnapshotMetaFromRecord(record, extraMeta)
	);
}

function buildSanshiUnifiedFallbackSnapshot(record, payload){
	const result = payload && payload.result ? payload.result : {};
	const sections = [];
	if(result.liureng){
		const liurengText = buildLiuRengSnapshotText(
			buildCaseSnapshotParams(record),
			result.liureng,
			null,
			null,
			2,
			'土',
			record && record.gender !== undefined && record.gender !== null ? record.gender : 1
		);
		if(liurengText){
			sections.push(`[大六壬]\n${liurengText}`);
		}
	}
	if(result.dunjia){
		const qimenText = buildDunJiaSnapshotText(result.dunjia);
		if(qimenText){
			sections.push(`[奇门遁甲]\n${qimenText}`);
		}
	}
	if(result.taiyi){
		const taiyiText = buildTaiyiSnapshotText(result.taiyi);
		if(taiyiText){
			sections.push(`[太乙]\n${taiyiText}`);
		}
	}
	if(result.keData || result.sanChuan){
		sections.push('[三式合一结构化数据]\n' + JSON.stringify({
			options: payload && payload.options ? payload.options : {},
			result: payload && payload.result ? payload.result : {},
		}, null, 2));
	}
	return sections.join('\n\n').trim();
}

async function requestLiurengGods(record){
	const fields = buildCaseSnapshotFields(record);
	const params = {
		ad: fields.ad.value,
		date: fields.date.value.format('YYYY-MM-DD'),
		time: fields.time.value.format('HH:mm'),
		zone: fields.zone.value,
		lon: fields.lon.value,
		lat: fields.lat.value,
		gpsLat: fields.gpsLat.value,
		gpsLon: fields.gpsLon.value,
		after23NewDay: fields.after23NewDay.value,
		lateZiHourUseNextDay: fields.lateZiHourUseNextDay && fields.lateZiHourUseNextDay.value !== undefined ? fields.lateZiHourUseNextDay.value : defaultLateZiHourUseNextDay(),
	};
	const data = await request(`${Constants.ServerRoot}/liureng/gods`, {
		body: JSON.stringify(params),
		silent: true,
		timeoutMs: 45000,
	});
	const result = data && data[Constants.ResultKey] ? data[Constants.ResultKey] : null;
	if(!result || !result.liureng){
		return null;
	}
	return {
		params,
		liureng: result.liureng,
	};
}

async function regenerateLiurengSnapshot(record, options, runyear){
	const result = await requestLiurengGods(record);
	if(!result || !result.liureng){
		return '';
	}
	// AI 挂载「每技法设置」:起课法/换将/分昼夜/贵人/五行经 options 透传（缺省=现状）。
	const o = options && typeof options === 'object' ? options : {};
	const castOpts = {
		castMethod: o.castMethod,
		xuanShiZhi: o.xuanShiZhi,
		yanShuNum: o.yanShuNum,
		yueJiangMethod: o.yueJiangMethod,
		fenZhouYe: o.fenZhouYe,
		// 涉害取舍 / 始入课 / 年神排序 / 昼夜阳阴归属 / 土旺衰:LIURENG_FIELDS(techniqueMountSettings)已暴露这 6 项、
		// LiuRengMain.clickSaveCase 也存进 payload 顶层,且 buildLiuRengSnapshotText 据 _castOpts 据此切「涉害取舍/年神/三传旺衰/
		// 旬空旺衰」正文行——但此前 castOpts 漏枚举 → 齿轮调或存档选的这 5 类设置在挂载快照里被丢、回退默认(与独立页不符)。
		// 缺省 undefined → builder 内部 `|| 'app'/false/'sanyuan'/'danmu'/'siji'` 兜底 = 现状字节级一致(零回归)。
		seHaiMethod: o.seHaiMethod,
		seHaiBoundary: o.seHaiBoundary,
		shiRuKe: o.shiRuKe,
		yearShenShaSort: o.yearShenShaSort,
		yinyangSystem: o.yinyangSystem,
		tuWangShuai: o.tuWangShuai,
		// 🔴 占事类型:builder 据它产 [占断向导] 整段(占事/主用神/用神落点/宜忌/三传提示)。
		// 曾三处枚举全漏 → 改任一齿轮项即令该段静默回退「通用」。缺省 undefined = builder 兜底 general(现状)。
		zhanCategory: o.zhanCategory,
	};
	const guirengType = (o.guireng !== undefined && o.guireng !== null) ? o.guireng : 2;
	const zhangshengElem = o.wuxing || '土';
	// buildLiuRengSnapshotText 内部用 chartObj 经 buildLiuRengLayout 算「天地盘/四课/三传」——
	// 需 chartObj.nongli.time + nongli.dayGanZi + objects(月将=太阳座) + isDiurnal。
	// 旧实现第 4 参传 null → 布局为空 → 起课时间/三式合一的大六壬不出。修法：以 result.liureng 为底，
	// 若缺 objects 则补一份 /chart（含太阳座与昼夜）。
	let chartObj = result.liureng;
	if(!chartObj.objects || !chartObj.objects.length){
		try{
			const p = result.params || {};
			const chartParams = { ...p, date: ('' + (p.date || '')).replace(/-/g, '/'), hsys: 0, zodiacal: 0, cid: null };
			const co = await request(`${Constants.ServerRoot}/chart`, { body: JSON.stringify(chartParams), silent: true });
			const r = co && co[Constants.ResultKey] ? co[Constants.ResultKey] : null;
			const inner = r && r.chart ? r.chart : r;
			if(inner && Array.isArray(inner.objects)){
				chartObj = { ...result.liureng, objects: inner.objects, isDiurnal: inner.isDiurnal !== undefined ? inner.isDiurnal : result.liureng.isDiurnal };
			}
		}catch(e){ /* 取不到则退回 result.liureng */ }
	}
	return buildLiuRengSnapshotText(
		result.params,
		result.liureng,
		runyear || null,
		chartObj,
		guirengType,
		zhangshengElem,
		record && record.gender !== undefined && record.gender !== null ? record.gender : 1,
		castOpts
	);
}

async function regenerateJinkouSnapshot(record, payload){
	const result = await requestLiurengGods(record);
	if(!result || !result.liureng){
		return '';
	}
	const timeText = result.liureng && result.liureng.nongli ? result.liureng.nongli.time : '';
	const diFen = resolveJinKouDiFen(
		payload && payload.diFen,
		false,
		timeText,
		!!(payload && payload.diFen)
	);
	const jinkouData = buildJinKouData(result.liureng, {
		diFen,
		// 金口诀贵神兜底 = 0（六壬法）=== JinKouMain state + schema 默认；原写死 2（星占法）会与齿轮显示的「六壬法(默认)」对不上。
		guirengType: payload && payload.guireng !== undefined && payload.guireng !== null ? payload.guireng : 0,
		isDiurnal: null,
		// AI 挂载「每技法设置」:月将/占时经 payload 透传（缺省=自动取，buildJinKouData 内部按节气/时支兜底=现状）。
		yueJiang: payload && payload.yueJiang,
		zhanShi: payload && payload.zhanShi,
		// 流派/盘式透传（缺省=默认派=现状,零回归）。
		schoolYueJiang: payload && payload.schoolYueJiang,
		schoolGuiTable: payload && payload.schoolGuiTable,
		schoolGuiPan: payload && payload.schoolGuiPan,
		panShi: payload && payload.panShi,
		soilChangSheng: payload && payload.soilChangSheng,
		wuxing: payload && payload.wuxing ? payload.wuxing : '土',
		// 专题起式/行年旬法透传（缺省=不选=整段不产=现状,零回归）。
		topicKey: payload && payload.topicKey,
		shiJianKind: payload && payload.shiJianKind,
		// 合占扣题(所问类别/问事时段):builder 据此产 [合占扣题与内外] 段 —— 🔴 曾漏枚举,
		// 改任一齿轮项即令该段回落「未限定/常规」。缺省 undefined = builder 兜底(现状)。
		askKey: payload && payload.askKey,
		timeScope: payload && payload.timeScope,
		// 本命属相/行年虚岁:有存档 runyear(问测人出生档派生)则随档回放,与 case 分支同律;
		// 无档(起课时间纯时点)才留空 —— 专题引擎照实提示「需填属相」,不臆造。
		benMing: deriveJinkouBenMing(payload && payload.runyear),
		birthGanZi: (payload && payload.runyear && payload.runyear.birthGanZi) || '',
		gender: record && record.gender !== undefined && record.gender !== null ? record.gender : 1,
		age: deriveJinkouXuSui(payload && payload.runyear),
	});
	return buildJinKouSnapshotText(
		result.params,
		result.liureng,
		null,
		jinkouData,
		payload && payload.wuxing ? payload.wuxing : '土',
		payload && payload.guireng !== undefined && payload.guireng !== null ? payload.guireng : 0,
		record && record.gender !== undefined && record.gender !== null ? record.gender : 1
	);
}

// AI 快照重算奇门的节气种子上下文(本地全24节气,确定性、无需后端):
// 日家(节气三元60日块)/茅山(精确交节)/置闰·无闰(超神接气)/飞盘·混合(短路本地)皆依赖此种子;
// 此前传空 {} 致这些族/法在 AI 挂载快照里 局算错(退拆补/退夏至)。引擎对本地↔后端两种冬至约定不敏感(dayJiaHalfYear 按实际年取),故本地种子可靠。
function buildQimenSeedContext(fields){
	try {
		const dv = fields && fields.date && fields.date.value;
		const zone = (fields && fields.zone && fields.zone.value) || '+08:00';
		const year = dv ? Number(dv.format('YYYY')) : NaN;
		if(!year || Number.isNaN(year)){
			return {};
		}
		const jieqiYearSeeds = {};
		[year - 1, year, year + 1].forEach((y)=>{
			const seed = buildLocalJieqiYearSeed(y, zone);
			if(seed){
				jieqiYearSeeds[y] = seed;
			}
		});
		return { jieqiYearSeeds };
	} catch(e){
		return {};
	}
}

async function regenerateQimenSnapshot(record, payload){
	const fields = buildCaseSnapshotFields(record);
	// [V6-W2] 日界/晚子时齿轮(merged payload.options)同源进四柱农历——局与日柱不再分叉。
	const qsOpt = payload && payload.qimen && typeof payload.qimen === 'object' ? payload.qimen : payload;
	const params = buildCaseSnapshotParams(record, qsOpt && qsOpt.options && typeof qsOpt.options === 'object' ? qsOpt.options : qsOpt);
	const nongli = await fetchPreciseNongli(params);
	if(!nongli){
		return '';
	}
	// 兼容事盘(payload.options/faRelatedPeople)与命盘(payload.qimen.{options,faRelatedPeople})两种结构。
	const qs = payload && payload.qimen && typeof payload.qimen === 'object' ? payload.qimen : payload;
	const options = {
		...DEFAULT_QIMEN_OPTIONS,
		...(qs && qs.options ? qs.options : {}),
	};
	// 🔴 sex 曾不在 DEFAULT 也不在起课时间源 → SEX_OPTIONS 查无 undefined,快照输出「命式：undefined」。
	// 兜底随记录性别(1 男/0 女,与 DunJiaCalc.SEX_OPTIONS 同域);存档带 sex 则原样优先。
	if(options.sex === undefined || options.sex === null || options.sex === ''){
		const g = record && record.gender;
		options.sex = (g === 0 || g === '0' || g === '女') ? 0 : 1;
	}
	const pan = calcDunJia(fields, nongli, options, buildQimenSeedContext(fields));
	// 显式还原相关人员(空[]也算显式、覆盖全局兜底)，使八门化气大阵生年干随已存记录一致(AI 挂载/储存四同步)。
	pan.faRelatedPeople = qs && Array.isArray(qs.faRelatedPeople) ? qs.faRelatedPeople : [];
	return buildDunJiaSnapshotText(pan);
}

async function regenerateTaiyiSnapshot(record, payload){
	const fields = buildCaseSnapshotFields(record);
	// [V6-W2] 同 qimen:日界齿轮同源进四柱。
	const tyOpt = payload && typeof payload === 'object' ? (payload.options && typeof payload.options === 'object' ? payload.options : payload) : null;
	const params = buildCaseSnapshotParams(record, tyOpt);
	const nongli = await fetchPreciseNongli(params);
	if(!nongli){
		return '';
	}
	const options = {
		...DEFAULT_TAIYI_OPTIONS,
		...(payload && payload.options ? payload.options : {}),
	};
	const po = payload && payload.options && typeof payload.options === 'object' ? payload.options : {};
	// 🔴 三式合一存档用 taiyiStyle/taiyiAccum/taiyiSchool(且 options.school 被奇门盘式字符串占用)——
	// 曾直读 style/tn/school → 存过的三式合一事盘太乙盘式/古法公式/流派挂载重算全落默认。
	if(po.style === undefined && po.taiyiStyle !== undefined){ options.style = po.taiyiStyle; }
	if(po.tn === undefined && po.taiyiAccum !== undefined){ options.tn = po.taiyiAccum; }
	// 流派六轴组装:对象源(独立太乙 school / 三式 taiyiSchool) + 齿轮扁平键(school_* / taiyiSchool_*)覆盖。
	{
		let school = null;
		if(po.taiyiSchool && typeof po.taiyiSchool === 'object'){ school = { ...po.taiyiSchool }; }
		else if(po.school && typeof po.school === 'object'){ school = { ...po.school }; }
		const axes = ['jishen', 'wenchang', 'keJianChen', 'sanji', 'youshen', 'shijiCoord'];
		const flat = {};
		axes.forEach((k)=>{
			const v = po['school_' + k] !== undefined ? po['school_' + k] : po['taiyiSchool_' + k];
			if(v !== undefined && v !== null && v !== ''){ flat[k] = v; }
		});
		if(Object.keys(flat).length){ school = { ...(school || {}), ...flat }; }
		if(school){ options.school = school; }
		else if(typeof options.school === 'string'){ options.school = { ...DEFAULT_TAIYI_SCHOOL }; } // 撞键防御:奇门'转盘'串进来时回默认对象
	}
	// sex 域归一:三式合一存 1/0(与奇门共键),独立太乙/后端吃 '男'/'女'。
	if(options.sex === 1 || options.sex === '1'){ options.sex = '男'; }
	else if(options.sex === 0 || options.sex === '0'){ options.sex = '女'; }
	if(!options.sex){
		options.sex = getCaseGenderLabel(record);
	}
	let pan = await fetchTaiyiPan(fields, nongli, options);
	// 🔴 与 live TaiYiMain.recalc 同口径:非默认流派须在起盘后覆盖(几何重算主客算/神煞),
	//    否则存过的非默认事盘 AI 重生成静默丢覆盖层(实测坑修复)。默认=空操作字节不变。
	if(pan && options.school && !isDefaultSchool(options.school)){
		try{ pan = applyTaiyiSchool(pan, options.school).pan; }catch(e){ /* 覆盖失败回退原盘 */ }
	}
	return buildTaiyiSnapshotText(pan);
}

async function regenerateSanshiUnifiedSnapshot(record, payload){
	// 六壬子组:挂载齿轮的合并选项落在 payload.options(optionsPath:'options');regenerateLiurengSnapshot 读 options.*
	// (castMethod/guireng/wuxing/换将/分昼夜/选时/演数)。原先此处没传 → 三式合一的大六壬永远默认盘(C-❌2 缺口)。
	const [liurengText, qimenText, taiyiText] = await Promise.all([
		regenerateLiurengSnapshot(record, payload && payload.options, payload && payload.runyear),
		regenerateQimenSnapshot(record, payload),
		regenerateTaiyiSnapshot(record, payload),
	]);
	// [制度化] 🔴 与 live 页 buildSanShiUnitedSnapshotText 同源的挑段/前缀规则(sanshiSnapshotSections 单源):
	// 此前三大全文按 [大六壬][奇门遁甲][太乙] 整篇嵌套 → 内嵌段头(盘型/全局速览…)被解析成独立段,
	// 与 AI_EXPORT_PRESET_SECTIONS.sanshiunited 段名全失配 —— 自定义过三式段勾选的用户,
	// 挂载重算内容被段过滤错杀/漏杀(全技法段登记哨兵抓获)。现:挑段按单源段单以前缀重发,
	// 其余段的段头降格为「■段名」文本行并入各自顶段(风水包段先例;信息零丢失、段名恒 ⊆ preset)。
	const flattenInto = (topTitle, fullText, pickTitles, prefix)=>{
		const txt = `${fullText || ''}`.trim();
		if(!txt){ return []; }
		const map = parseSanshiSnapshotSections(txt);
		const picked = new Set(pickTitles || []);
		const bodyLines = [];
		const lead = txt.split('\n');
		// 无 [] 段结构的整文(如奇门金函形态)兜底:整文进顶段
		if(!Object.keys(map).length){
			return [`[${topTitle}]`, ...lead, ''];
		}
		// 段外前导行(首个段头前)先入顶段
		for(let i = 0; i < lead.length; i++){
			if(/^\[.+\]$/.test(lead[i].trim())){ break; }
			bodyLines.push(lead[i]);
		}
		Object.keys(map).forEach((title)=>{
			if(picked.has(title)){ return; }
			bodyLines.push(`■ ${title}`);
			bodyLines.push(...map[title]);
		});
		while(bodyLines.length && bodyLines[0] === ''){ bodyLines.shift(); }
		const out = [`[${topTitle}]`, ...bodyLines, ''];
		(pickTitles || []).forEach((title)=>{
			const body = map[title];
			if(!body || !body.length){ return; }
			out.push(`[${prefix || ''}${title}]`, ...body, '');
		});
		return out;
	};
	const lines = [
		...flattenInto('大六壬', liurengText, SANSHI_LIURENG_DUANGUA_SECTIONS, ''),
		...flattenInto('奇门遁甲', qimenText, SANSHI_QIMEN_EXTRA_SECTIONS, '奇门'),
		...flattenInto('太乙', taiyiText, SANSHI_TAIYI_SECTION_TITLES, '太乙'),
	];
	if(lines.length){
		return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
	}
	return buildSanshiUnifiedFallbackSnapshot(record, payload || {});
}

// 无头合盘(synastry):从两张命盘 record 现算关系快照 —— 比较盘(互摄相位/中点/映点)+ 组合盘(复合图)+ 影响盘(双盘叠加)。
// 供「合盘」技法直接选两张盘生成,无需先在合盘页挂载。后端 /modern/relative(:9999,RSA);任一产品失败优雅跳过。
export async function buildRelativeSnapshotForRecords(recordA, recordB){
	if(!recordA || !recordB) return '';
	const mk = (r)=>{ const [d, t] = `${(r && r.birth) || ''}`.split(' '); return { date: d || '', time: t || '', zone: (r && r.zone) || '', lat: (r && r.lat) || '', lon: (r && r.lon) || '' }; };
	const fetchOne = async (relativeCode, currentTab)=>{
		const params = { inner: mk(recordA), outer: mk(recordB), hsys: (recordA && recordA.hsys !== undefined && recordA.hsys !== null) ? recordA.hsys : 1, zodiacal: (recordA && recordA.zodiacal) || 0, siderealAyanamsa: (recordA && recordA.siderealAyanamsa) || '', relative: relativeCode };
		let data;
		try { data = await request(`${Constants.ServerRoot}/modern/relative`, { body: JSON.stringify(params), silent: true }); }
		catch(_){ return ''; }
		if(!data || data[Constants.ResultKey] === undefined || data[Constants.ResultKey] === null) return '';
		try { const buildRelativeSnapshotText = await loadBuildRelativeSnapshotText(); return buildRelativeSnapshotText({ currentTab, result: data[Constants.ResultKey], chartA: { record: recordA }, chartB: { record: recordB }, params: { hsys: params.hsys, zodiacal: params.zodiacal } }); }
		catch(_){ return ''; }
	};
	// 关系量化(分数)走独立 /astroextra/relative(返回 {score,highlights,challenges,aspects},非 /modern/relative)。
	const fetchScore = async ()=>{
		const params = { inner: mk(recordA), outer: mk(recordB), hsys: (recordA && recordA.hsys !== undefined && recordA.hsys !== null) ? recordA.hsys : 1, zodiacal: (recordA && recordA.zodiacal) || 0, siderealAyanamsa: (recordA && recordA.siderealAyanamsa) || '' };
		let data;
		try { data = await request(`${Constants.ServerRoot}/astroextra/relative`, { body: JSON.stringify(params), silent: true }); }
		catch(_){ return ''; }
		if(!data || data[Constants.ResultKey] === undefined || data[Constants.ResultKey] === null) return '';
		try { const buildRelativeSnapshotText = await loadBuildRelativeSnapshotText(); return buildRelativeSnapshotText({ currentTab: 'Score', result: data[Constants.ResultKey], chartA: { record: recordA }, chartB: { record: recordB }, params: { hsys: params.hsys, zodiacal: params.zodiacal } }); }
		catch(_){ return ''; }
	};
	const comp = await fetchOne(0, 'Comp');            // 比较盘:互摄相位/中点相位/映点
	const composite = await fetchOne(1, 'Composite');  // 组合盘:复合图盘
	const synastry = await fetchOne(2, 'Synastry');    // 影响盘:双盘叠加
	const scoreTxt = await fetchScore();               // 关系量化:契合分数+顺畅/张力 top 相位
	const stripHeader = (txt)=>{ const i = `${txt || ''}`.indexOf('\n['); return i > 0 ? `${txt}`.slice(i + 1) : `${txt || ''}`; }; // 去重复的 [关系起盘信息] 段(仅留首份)
	const parts = [];
	if(comp && comp.trim()) parts.push(comp);
	[composite, synastry, scoreTxt].forEach((t)=>{ if(t && t.trim()) parts.push(parts.length ? stripHeader(t) : t); });
	return parts.join('\n\n');
}

function generateCaseTechniqueSnapshot(record, moduleName, payload){
	const key = normalizeTechniqueKey(moduleName || (payload && payload.module) || (record && record.sourceModule) || '');
	if(!record || !key){
		return '';
	}
	const params = buildCaseSnapshotParams(record);
	switch(key){
	case 'liureng':
		if(!payload || !payload.liureng){
			return '';
		}
		return buildLiuRengSnapshotText(
			params,
			payload.liureng,
			payload.runyear || null,
			null,
			payload.guireng !== undefined && payload.guireng !== null ? payload.guireng : 2,
			payload.wuxing || '土',
			record.gender !== undefined && record.gender !== null ? record.gender : 1,
			{
				castMethod: payload.castMethod,
				xuanShiZhi: payload.xuanShiZhi,
				yanShuNum: payload.yanShuNum,
				yueJiangMethod: payload.yueJiangMethod,
				fenZhouYe: payload.fenZhouYe,
				// 2026-07-05 审计修:与 regenerateCaseTechniqueSnapshot 的 liurengOpts 对齐——
				// 涉害取舍/始入课/年神排序/昼夜阳阴/土旺衰 此前漏枚举 → 挂载快照丢设置回退默认。
				// 缺省 undefined → builder 兜底默认 = 未设置时字节级不变(零回归)。
				seHaiMethod: payload.seHaiMethod,
				seHaiBoundary: payload.seHaiBoundary,
				shiRuKe: payload.shiRuKe,
				yearShenShaSort: payload.yearShenShaSort,
				yinyangSystem: payload.yinyangSystem,
				tuWangShuai: payload.tuWangShuai,
				zhanCategory: payload.zhanCategory,
			}
		);
	case 'jinkou': {
		if(!payload || !payload.liureng){
			return '';
		}
		const timeText = payload.liureng && payload.liureng.nongli ? payload.liureng.nongli.time : '';
		const diFen = resolveJinKouDiFen(
			payload.diFen,
			false,
			timeText,
			!!payload.diFen
		);
		const jinkouData = buildJinKouData(payload.liureng, {
			diFen,
			// 金口诀贵神兜底 0（六壬法）=== 组件/schema 默认（原写死 2 对不上）。
			guirengType: payload.guireng !== undefined && payload.guireng !== null ? payload.guireng : 0,
			isDiurnal: null,
			// 已存事盘 payload 含月将/占时则透传（缺省=自动取=现状）。
			yueJiang: payload.yueJiang,
			zhanShi: payload.zhanShi,
			// 流派/盘式透传（缺省=默认派=现状,零回归）：保证挂载/还原的快照与保存时的流派盘一致。
			schoolYueJiang: payload.schoolYueJiang,
			schoolGuiTable: payload.schoolGuiTable,
			schoolGuiPan: payload.schoolGuiPan,
			panShi: payload.panShi,
			soilChangSheng: payload.soilChangSheng,
			wuxing: payload.wuxing || '土',
			// 专题起式/行年旬法随档回放（缺省=不选=整段不产=现状,零回归）。
			topicKey: payload.topicKey,
			shiJianKind: payload.shiJianKind,
			// 合占扣题(所问类别/问事时段)随档/齿轮回放 —— 漏则 [合占扣题与内外] 段回落默认。
			askKey: payload.askKey,
			timeScope: payload.timeScope,
			// 属相/虚岁自随档的 runyear（其内 birthGanZi/age 来自问测人出生档），与页面派生同律。
			benMing: deriveJinkouBenMing(payload.runyear),
			birthGanZi: payload.runyear && payload.runyear.birthGanZi,
			gender: record.gender !== undefined && record.gender !== null ? record.gender : 1,
			age: deriveJinkouXuSui(payload.runyear),
		});
		return buildJinKouSnapshotText(
			params,
			payload.liureng,
			payload.runyear || null,
			jinkouData,
			// 五行兜底 '土' === 组件/schema/regenerateJinkouSnapshot 默认（原 '' 会整段跳过十二长生、与现状不一致）。
			payload.wuxing || '土',
			payload.guireng !== undefined && payload.guireng !== null ? payload.guireng : 0,
			record.gender !== undefined && record.gender !== null ? record.gender : 1
		);
	}
	case 'qimen': {
		const qpan = payload && (payload.pan || (payload.result && payload.result.dunjia) || payload.dunjia);
		if(!qpan){
			return '';
		}
		// 已存事盘 pan 多已带 faRelatedPeople(存盘时 stamp)；旧记录无则显式置空数组(避免误用全局当前选择)。
		if(!Array.isArray(qpan.faRelatedPeople)){
			qpan.faRelatedPeople = payload && Array.isArray(payload.faRelatedPeople) ? payload.faRelatedPeople : [];
		}
		return buildDunJiaSnapshotText(qpan);
	}
	case 'tongshefa': {
		const selection = payload && (payload.selection || (payload.tongshefa && payload.tongshefa.selection));
		if(!selection){
			return '';
		}
		return buildTongSheFaSnapshot(buildTongSheFaModel(selection));
	}
	case 'sixyao':
		if(!payload || !payload.gua){
			return '';
		}
		return buildGuaSnapshotText(buildCaseSnapshotFields(record), payload && payload.gua ? payload.gua : {});
	case 'mundane':
		// 世俗盘(入宫/新月/满月/日食/月食/地区盘/行星周期):astro 类事盘,存档时 DivinationChartShell 已写
		// 格式化 buildAiSnapshot 全文于 payload.aiSnapshot → 挂载直接复用(世俗盘类型多样,不按时间重算)。
		return (payload && payload.aiSnapshot && `${payload.aiSnapshot}`.trim()) ? `${payload.aiSnapshot}` : '';
	case 'tianxing':
		// 天星择日(征象搜索):同 mundane 范式——存档时 shell 写 buildTianxingSnapshot 全文于
		// payload.aiSnapshot(搜索配置/条件树/命中区间为一次性结果,事盘绝不按时间复算)。
		return (payload && payload.aiSnapshot && `${payload.aiSnapshot}`.trim()) ? `${payload.aiSnapshot}` : '';
	case 'qimenzeri': {
		// 奇门择日:clickSaveCase(scope=qimenzeri)已把「奇门全文+择日三段」拼合文本(经 composeAiSnapshot)
		// 存于 payload.snapshot 并 stamp payload.module —— 只认本模块存档(裸 payload.snapshot 属
		// 存档方模块语义,不甄别直读=把别家事盘内容串进来,挂载穷举测试即为此把门)。
		// 🔴 形状:loadModuleAISnapshot 返回整包对象({module,content,...}),clickSaveCase 原样入档——
		// 按字符串直读会挂出「[object Object]」(真机实抓);兼容对象包(.content)与纯字符串双形。
		// 兜底同档 payload.pan 重拼奇门正文(极端旧档缺 snapshot 时至少盘面完整)。
		if(!payload || payload.module !== 'qimenzeri'){
			return '';
		}
		const zeriSnapRaw = payload.snapshot && typeof payload.snapshot === 'object'
			? payload.snapshot.content
			: payload.snapshot;
		if(zeriSnapRaw && `${zeriSnapRaw}`.trim()){
			return `${zeriSnapRaw}`;
		}
		return payload.pan ? buildDunJiaSnapshotText(payload.pan) : '';
	}
	case 'taiyi':
		if(!payload || !(payload.pan || (payload.result && payload.result.taiyi) || payload.taiyi)){
			return '';
		}
		return buildTaiyiSnapshotText(payload.pan || (payload.result && payload.result.taiyi) || payload.taiyi);
	case 'sanshiunited':
		if(!payload || (!payload.moduleSnapshots && !payload.modules && !payload.snapshot && !payload.result)){
			return '';
		}
		return buildSanshiUnifiedFallbackSnapshot(record, payload || {});
	default:
		return '';
	}
}

// [卜挂载按时补算] record(divTime/birth+zone/经纬)→ 同形农历要件:小六壬三数/飞宫占时支/小成图时间卦
// 全走 deriveLocalNongli 单源(与各页「按占时」同一历法),时支序=1..12(子=1)。
const ZHI_LIST_FOR_CAST = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
async function deriveNongliForRecord(record){
	try{
		const fieldObj = buildFieldObject(record);
		if(!fieldObj){ return null; }
		const { deriveLocalNongli } = await import('./divinationTimeDraft');
		const nl = deriveLocalNongli(fieldObj);
		if(!nl){ return null; }
		const tGZ = (nl.bazi && nl.bazi.time && nl.bazi.time.ganzi) || '';
		const dGZ = (nl.bazi && nl.bazi.day && nl.bazi.day.ganzi) || '';
		const yGZ = nl.yearGZByLunar || (nl.bazi && nl.bazi.year && nl.bazi.year.ganzi) || '';
		const hourZhi = tGZ.charAt(1) || '';
		const yearZhi = yGZ.charAt(1) || '';
		return {
			monthInt: nl.monthInt || null,
			dayInt: nl.dayInt || null,
			hourZhi,
			hourIdx: hourZhi ? ZHI_LIST_FOR_CAST.indexOf(hourZhi) + 1 : 0,
			yearZhiIdx: yearZhi ? ZHI_LIST_FOR_CAST.indexOf(yearZhi) + 1 : 0,
			dayGan: dGZ.charAt(0) || undefined,
			dayZhi: dGZ.charAt(1) || undefined,
		};
	}catch(e){ return null; }
}

// [制度化] export 供全技法段登记哨兵真跑(aiExportSectionsParityAll.test):生产消费不变。
export async function regenerateCaseTechniqueSnapshot(record, moduleName, payload){
	const key = normalizeTechniqueKey(moduleName || (payload && payload.module) || (record && record.sourceModule) || '');
	if(!record || !key){
		return '';
	}
	// 六壬起课法等配置由「每技法设置」merge 进 payload 顶层（mergeOptionsIntoPayload optionsPath:''）→ 透传给 regenerate。
	const p = payload && typeof payload === 'object' ? payload : {};
	const liurengOpts = {
		castMethod: p.castMethod,
		xuanShiZhi: p.xuanShiZhi,
		yanShuNum: p.yanShuNum,
		yueJiangMethod: p.yueJiangMethod,
		fenZhouYe: p.fenZhouYe,
		guireng: p.guireng,
		wuxing: p.wuxing,
		// 涉害取舍 / 始入课 / 年神排序 / 昼夜阳阴归属 / 土旺衰:payload 顶层(clickSaveCase 已存 + 齿轮 mergeOptionsIntoPayload
		// optionsPath:'' 落顶层)→ 此处转交 regenerateLiurengSnapshot 的 castOpts(再喂 buildLiuRengSnapshotText)。漏枚举 →
		// 存档/齿轮选的这 5 类设置在挂载快照丢、回退默认。缺省 undefined → builder 兜底默认 = 现状字节级一致(零回归)。
		seHaiMethod: p.seHaiMethod,
		seHaiBoundary: p.seHaiBoundary,
		shiRuKe: p.shiRuKe,
		yearShenShaSort: p.yearShenShaSort,
		yinyangSystem: p.yinyangSystem,
		tuWangShuai: p.tuWangShuai,
		zhanCategory: p.zhanCategory,
	};
	switch(key){
	case 'huangli': {
		// [D3] 老黄历日课:纯日期确定复算(动态 import 保 AI chunk 不吃 calendar 组件树)
		const prm = buildCaseSnapshotParams(record);
		const _hp = parseDateParts(`${prm.date}`) || {};
		const hy = _hp.year, hm = _hp.month, hd = _hp.day;
		const hh = Number(`${prm.time}`.split(':')[0]);
		if(!(hy > 0 && hm > 0 && hd > 0)){ return ''; }
		const mod = await import('../components/calendar/huangliSnapshot');
		const fn = mod.buildHuangliSnapshotByDate || (mod.default && mod.default.buildHuangliSnapshotByDate);
		return fn ? `${fn(hy, hm, hd, Number.isFinite(hh) ? hh : 12) || ''}` : '';
	}
	case 'tongshu': {
		// [D3] 通书择日:按日期+默认设置(或 payload.tongshu 覆盖)起当日一派断语
		const prm = buildCaseSnapshotParams(record);
		if(!prm.date){ return ''; }
		const [modT, modS] = await Promise.all([
			import('../components/calendar/tongshuSnapshot'),
			import('../components/calendar/tongshuSchools'),
		]);
		const build = modT.buildTongshuSnapshotText;
		const defaults = modS.DEFAULT_TONGSHU_SETTINGS || {};
		const settings = { ...defaults, ...(p.tongshu && typeof p.tongshu === 'object' ? p.tongshu : {}), date: prm.date };
		return build ? `${build(settings, prm.date) || ''}` : '';
	}
	case 'liureng':
		return regenerateLiurengSnapshot(record, liurengOpts, p.runyear);
	case 'jinkou':
		return regenerateJinkouSnapshot(record, payload);
	case 'qimen':
		return regenerateQimenSnapshot(record, payload);
	case 'taiyi':
		return regenerateTaiyiSnapshot(record, payload);
	case 'sanshiunited':
		return regenerateSanshiUnifiedSnapshot(record, payload);
	case 'horary':
		return regenerateHorarySnapshot(record, p);
	case 'election':
		return regenerateElectionSnapshot(record, p);
	case 'sixyao': {
		const lyGear = (p.liuyaoSettings && typeof p.liuyaoSettings === 'object') ? p.liuyaoSettings : null;
		// 🔴 已存卦(payload.gua)恒冻结:仅以合并后的 liuyaoSettings 重算判读层,绝不重起时间卦。
		if(p.gua && (p.gua.currentGua || Array.isArray(p.gua.yao))){
			const merged = mergeLiuyaoGearSettings(p.gua.liuyaoSettings || {}, lyGear || {});
			return buildGuaSnapshotText(buildCaseSnapshotFields(record), { ...p.gua, liuyaoSettings: merged });
		}
		return regenerateSixyaoSnapshot(record, lyGear);
	}
	case 'huangji': {
		// [挂载设置] 齿轮顶层铺平(optionsPath'')优先;🔴 存档在 payload.options.{historyYear,classicKey,
		// classicSectionIndex,xinyiOptions{method,…}}(路径+键名双错曾致存档设置永远读不到,
		// 心易段/所推之年/章节全部回默认)。嵌套档打底、齿轮覆盖。
		const ho = (p.options && typeof p.options === 'object') ? p.options : {};
		const hx = (ho.xinyiOptions && typeof ho.xinyiOptions === 'object') ? ho.xinyiOptions : {};
		const hv = (top, saved)=>(top !== undefined && top !== null && top !== '' ? top : saved);
		return buildHuangJiSnapshotForFields(buildFieldObject(record), {
			classicKey: hv(p.classicKey, ho.classicKey),
			historyYear: hv(p.historyYear, ho.historyYear),
			classicSectionIndex: hv(p.classicSectionIndex, ho.classicSectionIndex),
			xinyiMethod: hv(p.xinyiMethod, hx.method),
			upperNum: hv(p.upperNum, hx.upperNum), lowerNum: hv(p.lowerNum, hx.lowerNum),
			upperStrokes: hv(p.upperStrokes, hx.upperStrokes), lowerStrokes: hv(p.lowerStrokes, hx.lowerStrokes),
			objectGua: hv(p.objectGua, hx.objectGua), direction: hv(p.direction, hx.direction),
		});
	}
	case 'taixuan': {
		// 齿轮 → payload 顶层(optionsPath'')优先;🔴 页面存档落 payload.options.*(路径不同构曾致
		// 存档 seed 永远读不到 —— 页面随机 seed vs 挂载时间派生 seed,一动齿轮挂载出另一卦)。
		const oo = (p.options && typeof p.options === 'object') ? p.options : {};
		return buildTaiXuanSnapshotForFields(buildFieldObject(record), { seed: p.seed !== undefined ? p.seed : oo.seed });
	}
	case 'jingjue': {
		const oo = (p.options && typeof p.options === 'object') ? p.options : {};
		return buildJingJueSnapshotForFields(buildFieldObject(record), { seed: p.seed !== undefined ? p.seed : oo.seed });
	}
	case 'wuzhao': {
		// 🔴 键集驱动,不手抄白名单:此处曾只透传 mode/number/manual/manualSplits 四键,
		// 而挂载 schema 与存案里另有筮法口径/掷钱/卜数/行神月制/年命支/性别六键——
		// 用户在挂载设置里设了却读不到,是彻头彻尾的死开关。键集单源自 WuZhaoMain。
		const oo = (p.options && typeof p.options === 'object') ? p.options : {};
		const opts = {};
		WUZHAO_CALC_OPTION_KEYS.forEach((key)=>{
			const value = p[key] !== undefined ? p[key] : oo[key];
			if(value !== undefined){ opts[key] = value; }
		});
		return buildWuZhaoSnapshotForFields(buildFieldObject(record), opts);
	}
	case 'shenyishu': {
		const oo = (p.options && typeof p.options === 'object') ? p.options : {};
		const sv = (top, saved)=>(top !== undefined ? top : saved);
		return buildShenYiShuSnapshotForFields(buildFieldObject(record), {
			hourSource: sv(p.hourSource, oo.hourSource),
			manualHour: sv(p.manualHour, oo.manualHour),
			seasonSource: sv(p.seasonSource, oo.seasonSource),
			manualSeason: sv(p.manualSeason, oo.manualSeason),
		});
	}
	case 'guice': {
		// 皇极轨策为问占型(无生时);选项嵌于 payload.options。
		// 🔴 卦自 payload.gua 取、绝不按时重起(重起=伪造一个用户没见过的卦);故须整个 payload 一并递进去。
		const { buildGuiceSnapshotForCase } = await import(/* webpackChunkName: "guice-main" */ '../components/guice/GuiceMain');
		return buildGuiceSnapshotForCase(p, (p.options && typeof p.options === 'object') ? p.options : {});
	}
	case 'xiaoliuren': {
		// 小六壬:已存课(payload.nums)优先绝不覆盖;缺课(起课时间/事盘无存)→ 按占时正统起
		// (农历月/日/时支序三数,月上起日日上起时,与页面「按占时」同源 deriveLocalNongli)。
		const { buildXiaoLiuRenSnapshotForCase } = await import(/* webpackChunkName: "xiaoliuren-main" */ '../components/xiaoliuren/XiaoLiuRenMain');
		let xp = p;
		if(!Array.isArray(p.nums) || p.nums.length !== 3){
			const nl = await deriveNongliForRecord(record);
			if(nl && nl.monthInt && nl.dayInt && nl.hourIdx){ xp = { ...p, nums: [nl.monthInt, nl.dayInt, nl.hourIdx] }; }
		}
		return buildXiaoLiuRenSnapshotForCase(xp, (p.options && typeof p.options === 'object') ? p.options : {});
	}
	case 'xiaochengtu': {
		// 小成图:已存卦(payload.qi)优先绝不重起;缺卦 → 梅花时间卦(年支序+农历月+日 为上数,
		// 加时支序为下数,动爻由总数取)走既有两数式引擎——时间即输入,确定可复算。
		const { buildXiaoChengTuSnapshotForCase } = await import(/* webpackChunkName: "xiaochengtu-main" */ '../components/xiaochengtu/XiaoChengTuMain');
		let cp = p;
		if(!p.qi || !p.qi.ben){
			const nl = await deriveNongliForRecord(record);
			if(nl && nl.monthInt && nl.dayInt && nl.hourIdx && nl.yearZhiIdx){
				const upNum = nl.yearZhiIdx + nl.monthInt + nl.dayInt;
				const loNum = upNum + nl.hourIdx;
				const { qiGuaByNumbers } = await import(/* webpackChunkName: "xiaochengtu-main" */ '../components/xiaochengtu/core/xiaochengtuQiGua');
				const qi = qiGuaByNumbers({ upNum, loNum });
				if(qi){ cp = { ...p, qi }; }
			}
		}
		return buildXiaoChengTuSnapshotForCase(cp, (p.options && typeof p.options === 'object') ? p.options : {});
	}
	case 'feigong': {
		// 飞宫:已存局(payload.qiZhi)优先绝不覆盖;缺局 → 按占时支起局(页面「按占时」同源),
		// 日干支随占日(河魁天罡口径依赖日干支)。
		const { buildFeiGongSnapshotForCase } = await import(/* webpackChunkName: "feigong-main" */ '../components/feigong/FeiGongMain');
		let fp = p;
		if(!fp.qiZhi){
			const nl = await deriveNongliForRecord(record);
			if(nl && nl.hourZhi){ fp = { ...p, qiZhi: nl.hourZhi, dayGan: nl.dayGan, dayZhi: nl.dayZhi }; }
		}
		return buildFeiGongSnapshotForCase(fp, (p.options && typeof p.options === 'object') ? p.options : {});
	}
	case 'geomancy':
		// 地占为问占型(无生时);选项嵌于 payload.options,builder 缺则回退已存 case。
		return buildGeomancySnapshotForFields(buildFieldObject(record), (p.options && typeof p.options === 'object') ? p.options : p);
	case 'tarot': {
		// 塔罗为问占型(无生时);牌面由 deckId/spreadType/seed 冻结,齿轮只动判读层。
		// 齿轮扁平键落 p.options 顶层,须提升进 settings 对象(engine buildReading 只读 settings.*);
		// 1/0 三态齿轮值归一为布尔。
		const to = (p.options && typeof p.options === 'object') ? p.options : p;
		// TP9 判读齿轮扩容(与 techniqueMountSettings.tarot.fields 一一对应;牌面键恒不入):
		const liftKeys = [
			'meaningSystem', 'reversalMode', 'variant', 'verdictMode', 'dignities', 'suitElementSwap',
			'quintMode', 'edVersion', 'ookTable', 'astroModern', 'timingMethod', 'timingUnit',
			'courtElementSystem', 'courtZodiacSystem', 'crossingUpright',
		];
		const boolKeys = ['dignities', 'suitElementSwap', 'astroModern', 'crossingUpright'];
		const lift = {};
		liftKeys.forEach((k)=>{
			const v = to[k];
			if(v === undefined || v === null || v === ''){ return; }
			lift[k] = boolKeys.includes(k) ? (v === 1 || v === '1' || v === true) : v;
		});
		const tOpts = Object.keys(lift).length
			? { ...to, settings: { ...((to.settings && typeof to.settings === 'object') ? to.settings : {}), ...lift } }
			: to;
		return buildTarotSnapshotForFields(buildFieldObject(record), tOpts);
	}
	case 'lingqi': {
		// 灵棋经为问占型(无生时);卦=冻结棋数自 payload.counts 取、绝不按时重掷(「不可再擲」)。
		// 🔴 AI 核只 import 轻文件 lingqiSnapshot(纯函数+数据),不 import LingQiMain 组件(chunk 回灌案口径)。
		const { buildLingqiSnapshotForCase } = await import(/* webpackChunkName: "lingqi-snapshot" */ '../components/lingqi/lingqiSnapshot');
		return buildLingqiSnapshotForCase(p, (p.options && typeof p.options === 'object') ? p.options : {});
	}
	default:
		return '';
	}
}

// kinastro 族齿轮透传 helper:只透非空('' = 按盘面/后端自出),与页面 buildPayload 同键。
function pickKin(record, keys){
	const out = {};
	keys.forEach((k)=>{
		const v = record && record[k];
		if(v !== undefined && v !== null && v !== ''){ out[k] = v; }
	});
	return out;
}
// gender 随档(页面 normBinaryGender 同口径:'0'/女/Female → '0',余 '1')。
function kinGenderOverride(record){
	const g = record && record.gender;
	if(g === undefined || g === null || g === ''){ return {}; }
	const sg = `${g}`.trim();
	return { gender: (sg === '0' || sg === '女' || sg === 'Female' || sg === 'female' || sg === 'F') ? '0' : '1' };
}

// 六爻齿轮扁平键(payload.liuyaoSettings.<flat>)→ 嵌套 liuyaoSettings 合并:
// 存档 gua.liuyaoSettings 打底,齿轮覆盖;shensha 三键/shenshaEx 开关折回嵌套形。
// 只动登记键,未动键随档原样 —— 与页面 normalizeLiuyaoSettings 消费同构。
function mergeLiuyaoGearSettings(saved, flat){
	const base = saved && typeof saved === 'object' ? { ...saved } : {};
	const f = flat && typeof flat === 'object' ? flat : {};
	// [V6-W2] 🔴 白名单改 schema 驱动:此前 direct/bools 是手抄清单,guirenFa(贵人歌诀)漏抄 →
	// 该齿轮在挂载链恒死(且既有测试与代码抄同一份漏抄清单,自证同谬)。现从
	// TECHNIQUE_SETTINGS_SCHEMA.sixyao 机械求键集:布尔型按 field.type 归一,shensha 结构块
	// 三键仍特判(它们要折叠进 shensha 嵌套对象,非平铺);未来 schema 加新齿轮自动进白名单。
	const sixyaoSchema = getTechniqueSettingsSchema('sixyao');
	const structural = ['shenshaOn', 'shenshaBase', 'shenshaSet', 'shenshaExOn'];
	const schemaFields = (sixyaoSchema && Array.isArray(sixyaoSchema.fields)) ? sixyaoSchema.fields : [];
	schemaFields.forEach((field)=>{
		const k = field.name;
		if(structural.indexOf(k) >= 0 || f[k] === undefined){
			return;
		}
		if(field.type === 'switch' || typeof field.default === 'boolean'){
			base[k] = (f[k] === true || f[k] === 1 || f[k] === '1');
		}else{
			base[k] = f[k];
		}
	});
	if(f.shenshaOn !== undefined || f.shenshaBase !== undefined || f.shenshaSet !== undefined){
		const prev = (saved && saved.shensha && typeof saved.shensha === 'object') ? saved.shensha : {};
		base.shensha = {
			...prev,
			...(f.shenshaOn !== undefined ? { on: (f.shenshaOn === true || f.shenshaOn === 1 || f.shenshaOn === '1') } : {}),
			...(f.shenshaBase !== undefined ? { base: f.shenshaBase } : {}),
			...(f.shenshaSet !== undefined && Array.isArray(f.shenshaSet) ? { set: f.shenshaSet.slice() } : {}),
		};
	}
	if(f.shenshaExOn !== undefined){
		base.shenshaEx = {
			...((saved && saved.shenshaEx && typeof saved.shenshaEx === 'object') ? saved.shenshaEx : { set: null }),
			on: (f.shenshaExOn === true || f.shenshaExOn === 1 || f.shenshaExOn === '1'),
		};
	}
	return base;
}

// 六爻「时间起卦」——「起课时间」入口 + 已存事盘缺 payload.gua 时走（确定性时间式法、非伪造摇卦，用户拍板放开）。
// 已存 payload.gua 优先、不进此路（在上游 generateCaseTechniqueSnapshot 已处理）。失败(缺时间/历法不全)→优雅返 ''、不崩整个挂载。
async function regenerateSixyaoSnapshot(record, gearFlat){
	try{
		const fields = buildCaseSnapshotFields(record);
		const params = buildCaseSnapshotParams(record);
		const nongli = await fetchPreciseNongli(params);
		if(!nongli){
			return '';
		}
		const gua = buildTimeGua(nongli);
		if(!gua){
			return '';
		}
		// 齿轮判读设置注入(buildTimeGua 不含 liuyaoSettings → 曾恒全默认且无处可设)。
		const st = (gearFlat && typeof gearFlat === 'object' && Object.keys(gearFlat).length)
			? { ...gua, liuyaoSettings: mergeLiuyaoGearSettings(gua.liuyaoSettings || {}, gearFlat) }
			: gua;
		return buildGuaSnapshotText(fields, st);
	}catch(e){
		return '';
	}
}

// 八字多运限（批A，对称 ziwei）：解析 record 的 liunianSel/liuyueSel/liuriSel/liushiSel 为 number[]。
// 任一非空 → 产出多选 period({liunian,liuyue,liuri,liushi})；buildBaziSnapshotText 据此追加多运限段。
// 全空(默认)→ null → 不挂任何运限段，与现状逐字一致（守「默认即现状」）。
function buildChartBaziPeriodFromRecord(record){
	if(!record || typeof record !== 'object'){
		return null;
	}
	const liunian = pickFiniteNumberArray(record.liunianSel);
	const liuyue = pickFiniteNumberArray(record.liuyueSel);
	const liuri = pickFiniteNumberArray(record.liuriSel);
	const liushi = pickFiniteNumberArray(record.liushiSel);
	if(!liunian.length && !liuyue.length && !liuri.length && !liushi.length){
		return null;
	}
	return { liunian, liuyue, liuri, liushi };
}

// 命盘技法的出生参数（形状对齐各组件 genParams：date 'YYYY-MM-DD' / time 'HH:mm:ss'）。
// 导出供命盘图捕获等模块复用,把 chart record 转成 bazi/ziwei 起盘 params。
export { buildChartBaziParams, buildChartZiweiParams };
function buildChartBaziParams(record){
	const fields = buildFieldObject(record);
	const params = {
		date: fields.date.value.format('YYYY-MM-DD'),
		time: fields.time.value.format('HH:mm:ss'),
		zone: fields.zone.value,
		lon: fields.lon.value,
		lat: fields.lat.value,
		gpsLat: fields.gpsLat.value,
		gpsLon: fields.gpsLon.value,
		gender: fields.gender.value,
		timeAlg: fields.timeAlg.value,
		phaseType: fields.phaseType.value,
		godKeyPos: fields.godKeyPos.value,
		// 盘法 4 项:挂载显式设置才改(命宫起法/月律分野/起运精度/藏干版本,与 BaZi.js:767-771 同口径);
		//   缺省取与 BaZi.js 一致的默认 → 默认即现状字节级一致。直接读 record(与 school 同范式,不入 buildFieldObject)。
		minggongMethod: (record && record.minggongMethod) || 'tongxing',
		fenyeVersion: (record && record.fenyeVersion) || 'common',
		dayunPrecision: (record && record.dayunPrecision) || 'precise',
		cangVersion: (record && record.cangVersion) || 'common',
		after23NewDay: fields.after23NewDay.value,
		lateZiHourUseNextDay: fields.lateZiHourUseNextDay && fields.lateZiHourUseNextDay.value !== undefined ? fields.lateZiHourUseNextDay.value : defaultLateZiHourUseNextDay(),
		adjustJieqi: fields.adjustJieqi.value,
	};
	// 断命流派:仅挂载侧显式设置时才挂(builder 据此切「当前主用流派」标注),缺省不挂 → 默认 传统综合 = 现状字节级一致。
	// 对称紫微 sihuaSchool;各派对照数据恒全算,此项只切主标注。后端 /bazi/birth 不读该字段,由 buildBaziSnapshotText 本地消费。
	// shenshaGroups(神煞分组显示过滤)有意不入挂载复算:面板快照(第一优先源)已按用户勾选过滤;
	// 复算兜底恒全量=只多不少,AI 无信息丢失。挂载设置=显式声明域,不从面板 localStorage 偏好偷渡。
	if(record && record.school !== undefined && record.school !== null && `${record.school}` !== ''){
		params.school = `${record.school}`;
	}
	// 多运限仅挂载侧显式覆盖时才挂上（builder 据此追加段），缺省不挂 → 默认字节级一致。
	// 注：period 仅供前端本地消费，不发后端（buildBaziSnapshotForParams 起盘 params 不含它，按需单独消费）。
	const period = buildChartBaziPeriodFromRecord(record);
	if(period){
		params.period = period;
	}
	return params;
}

function pickFiniteNumber(value){
	// 空/空串 → null（不算选择）；可解析数字 → 取整；否则 null。空输入被 UI 强转 0 时由各 level 的
	// find-or-首项兜底吸收，绝不抛、绝不留 undefined。
	if(value === undefined || value === null || `${value}` === ''){
		return null;
	}
	const n = Number(value);
	return Number.isFinite(n) ? Math.round(n) : null;
}

// 把 record.* 的「数组 / 逗号分隔串 / 单值」统一解析为去重的有限整数数组（保序）。
// multiselect 草稿是数组；文本年份列表是逗号/空白分隔串；空/坏值 → []（不算选择，守「默认即现状」）。
function pickFiniteNumberArray(value){
	if(value === undefined || value === null){
		return [];
	}
	let raw = value;
	if(!Array.isArray(raw)){
		const s = `${raw}`.trim();
		if(s === ''){
			return [];
		}
		raw = s.split(/[,，\s]+/);
	}
	const out = [];
	const seen = {};
	raw.forEach((item)=>{
		const v = pickFiniteNumber(item);
		if(v === null){
			return;
		}
		if(!seen[v]){
			seen[v] = true;
			out.push(v);
		}
	});
	return out;
}

function buildChartZiweiPeriodFromRecord(record){
	// 多选运限(批A)：把 record 的 daxianSel/liunianSel/liuyueSel/liuriSel/liushiSel 各解析为 number[]。
	// 任一非空 → 产出多选 period({daxian,liunian,liuyue,liuri,liushi})；buildZiweiPeriodLines 据此多段循环。
	// 全空(默认)→ 返回 null → 走原路径(只含本命+大限)，与现状逐字一致(守「默认即现状」)。
	if(!record || typeof record !== 'object'){
		return null;
	}
	const daxian = pickFiniteNumberArray(record.daxianSel);
	const liunian = pickFiniteNumberArray(record.liunianSel);
	const liuyue = pickFiniteNumberArray(record.liuyueSel);
	const liuri = pickFiniteNumberArray(record.liuriSel);
	const liushi = pickFiniteNumberArray(record.liushiSel);
	if(!daxian.length && !liunian.length && !liuyue.length && !liuri.length && !liushi.length){
		return null;
	}
	return { daxian, liunian, liuyue, liuri, liushi };
}

function buildChartZiweiParams(record){
	const fields = buildFieldObject(record);
	const params = {
		date: fields.date.value.format('YYYY-MM-DD'),
		time: fields.time.value.format('HH:mm:ss'),
		zone: fields.zone.value,
		lon: fields.lon.value,
		lat: fields.lat.value,
		gpsLat: fields.gpsLat.value,
		gpsLon: fields.gpsLon.value,
		gender: fields.gender.value,
		timeAlg: fields.timeAlg.value === 1 ? 1 : 0,
		after23NewDay: fields.after23NewDay.value,
		lateZiHourUseNextDay: fields.lateZiHourUseNextDay && fields.lateZiHourUseNextDay.value !== undefined ? fields.lateZiHourUseNextDay.value : defaultLateZiHourUseNextDay(),
	};
	// 四化流派 + 运限层:仅挂载侧显式覆盖时才挂上(builder 据此切流派/追加[运限]段),缺省不挂 → 默认字节级一致。
	// 注:这两键不是 /ziwei/birth 的后端参数(后端只读上面的起盘字段),由 buildZiweiSnapshotForParams 本地消费。
	if(record && record.sihuaSchool !== undefined && record.sihuaSchool !== null && `${record.sihuaSchool}` !== ''){
		params.sihuaSchool = `${record.sihuaSchool}`;
	}
	// [A4] 随盘自定义四化表(JSON 文本):builder 端归一校验后临时注入 ZWSihuaCustom(用毕清),不写本机 LS。
	if(record && record.sihuaCustomTable !== undefined && record.sihuaCustomTable !== null && `${record.sihuaCustomTable}`.trim() !== ''){
		params.sihuaCustomTable = record.sihuaCustomTable;
	}
	// [B15] 小限顺逆:record 键名沿用 ziweiXiaoxianYinyang(零孤儿),映射到单例键 xiaoxianMode 经 SWITCH_KEYS 覆盖。
	if(record && record.ziweiXiaoxianYinyang !== undefined && record.ziweiXiaoxianYinyang !== null && `${record.ziweiXiaoxianYinyang}` !== ''){
		params.xiaoxianMode = `${record.ziweiXiaoxianYinyang}`;
	}
	// [B14] 随盘自定义亮度表(JSON 文本):同 A4 机制(注入 ZWBrightnessCustom,用毕清)。
	if(record && record.brightnessCustomTable !== undefined && record.brightnessCustomTable !== null && `${record.brightnessCustomTable}`.trim() !== ''){
		params.brightnessCustomTable = record.brightnessCustomTable;
	}
	// 传本/排盘开关:仅挂载侧显式覆盖(非默认,record 里才有)时挂上 → buildZiweiSnapshotForParams 临时切 ZWEngineOptions;
	// 缺省不挂 → builder 回退全局单例 = 现状字节级一致。后端 /ziwei/birth 不读这些键(由本地引擎消费)。
	['daxianSpan', 'tianmaBasis', 'starSet', 'sanPan', 'shangShi', 'leapMonth', 'lateZi', 'yearBoundary', 'huoling', 'kongNaming',
		'brightnessSource', 'lifeMasterBy', 'liuYueBasis', 'liunianSihuaGan', 'changshengStart', 'changshengDirection', 'kuiYue', 'kongwangStyle', 'flowLuanXi', 'flowHuoLing', 'flowShenshaOnChart', 'childLimit', 'zhongxian', 'huoPan', 'qishuWei', 'borrowPalace', 'taiSuiRuGua'].forEach((k)=>{
		if(record && record[k] !== undefined && record[k] !== null && `${record[k]}` !== ''){
			params[k] = record[k];
		}
	});
	// 紫云关系人:record 存字符串(空格/逗号分隔)→ [{branch,role,sex}] 供 taiSuiRuGua 消费。
	// [P2e] 文法扩展:每项支持 `支[:角色[:性别]]`(如「午:母:female 子」);裸支向后兼容(role/sex 空)。
	if(record && record.taiSuiRelatives !== undefined && `${record.taiSuiRelatives}`.trim() !== ''){
		const arr = `${record.taiSuiRelatives}`.split(/[\s,，、]+/).map((tok)=>{
			const seg = `${tok}`.split(/[:：]/);
			const b = seg[0];
			if('子丑寅卯辰巳午未申酉戌亥'.indexOf(b) < 0 || !b){ return null; }
			return { branch: b, role: seg[1] || '', sex: seg[2] || '' };
		}).filter(Boolean);
		if(arr.length){ params.taiSuiRelatives = arr; }
	}
	const period = buildChartZiweiPeriodFromRecord(record);
	if(period){
		params.period = period;
	}
	return params;
}

// 数算（参评数 / 河洛理数）：纯前端。先用本盘出生数据排四柱（buildLocalBaziResult），再喂各自引擎。
// 镜像 HeLuoMain.getModel 的取数口径；缺四柱即返 null → 上层显示「缺失」（不挂空表头）。
function buildChartShusuanBazi(record){
	try{
		const params = buildChartBaziParams(record);
		const bazi = buildLocalBaziResult(params).bazi;
		const fc = (bazi && bazi.fourColumns) || {};
		const gz = (p)=>(p && (p.ganzi || p.ganZhi)) || '';
		const fourPillars = { year: gz(fc.year), month: gz(fc.month), day: gz(fc.day), hour: gz(fc.time) };
		if(!fourPillars.year || !fourPillars.month || !fourPillars.day || !fourPillars.hour){
			return null;
		}
		return {
			fourPillars,
			yearGz: fourPillars.year,
			monthZhi: fourPillars.month.charAt(1),
			dayZhi: fourPillars.day.charAt(1),
			hourZhi: fourPillars.hour.charAt(1),
			// 🔴 干支年基准(非出生公历年):立春前出生者两者差一年,直接用公历年会让
			// 河洛/参评的流年整体错一位。以年柱反推,与页面侧 HeLuoMain/CanPingMain 同源。
			birthYear: ganzhiYearBase(parseYearFromDateStr(`${params.date}`) || 0, fourPillars.year),
			gender: bazi.gender === 'Female' ? '女' : '男',
			// 神数正传另需农历月/日（起月命数、时命数、人命数）。纯增字段，既有取用面不变。
			lunarMonth: Number((bazi.lunar || bazi.nongli || {}).monthNum || (bazi.lunar || bazi.nongli || {}).month) || 0,
			lunarDay: Number((bazi.lunar || bazi.nongli || {}).dayNum || (bazi.lunar || bazi.nongli || {}).day) || 0,
			isLeapMonth: !!((bazi.lunar || bazi.nongli || {}).isLeap || (bazi.lunar || bazi.nongli || {}).leap),
			// [Win-D69] 八字大运真源(lunar-js 节气起运),参评「八字大运法」档注入用。纯增字段。
			direction: Array.isArray(bazi.direction) ? bazi.direction : null,
		};
	}catch(e){
		return null;
	}
}

// 神数正传（数算）：纯前端，按本盘出生四柱起三支之一。
// 挂载齿轮可调 流派/求测时辰/父母年龄/元运/虚岁 → record.* → opts（未改时 undefined，builder 回默认 = 现状）。
// 条文正文库体积大，故 await 动态载入后再建快照（挂载链本就是 async，无首屏代价）。
const ZC_SCHOOLS = ['tieban', 'shaozi', 'dading', 'liuqin', 'xinyi'];
async function buildZhengChuanSnapshotForRecord(record, opts){
	const o = opts || {};
	const school = ZC_SCHOOLS.indexOf(o.school) >= 0 ? o.school : 'tieban';
	const M = await loadZhengChuanMods();
	// 心易为查询层（古籍未出起数入口）→ 不依赖生辰，须先于下方「无农历即返空」之闸
	if(school === 'xinyi'){
		try{
			const m = M.calcXinyi({
				item: o.item, sound: o.sound, ke: o.ke, gong: o.gong, xqZhi: o.xqZhi, xqYushu: o.xqYushu,
				gender: (record && record.gender === 'Female') ? 0 : 1,
			});
			return M.buildText(m, {}) || '';
		}catch(e){ return ''; }
	}
	const b = buildChartShusuanBazi(record);
	if(!b || !b.lunarMonth || !b.lunarDay){ return ''; }
	const pillars = [b.fourPillars.year, b.fourPillars.month, b.fourPillars.day, b.fourPillars.hour];
	try{
		let model = null;
		let verses = {};
		if(school === 'tieban'){
			model = M.calcTieban({
				yearGz: pillars[0], monthGz: pillars[1], dayGz: pillars[2], hourGz: pillars[3],
				gender: b.gender, lunarMonth: b.lunarMonth, lunarDay: b.lunarDay, isLeapMonth: b.isLeapMonth,
				askGz: o.askGz || pillars[3],
			});
			verses = await M.loadTiebanVerses().catch(()=>({}));
		}else if(school === 'shaozi'){
			model = M.calcShaozi({
				pillars, gender: b.gender, lunarMonth: b.lunarMonth, lunarDay: b.lunarDay, isLeapMonth: b.isLeapMonth,
				fatherAge: Number(o.fatherAge) || 27, motherAge: Number(o.motherAge) || 26, yuan: o.yuan || 'zhong',
			});
			verses = await M.loadShaoziVerses().catch(()=>({}));
		}else if(school === 'liuqin'){
			const hourZhi = pillars[3][1];
			const ask = o.askHourZhi || hourZhi;
			model = M.calcLiuqin({
				pillars, gender: b.gender === '女' ? 0 : 1, lunarMonth: b.lunarMonth, lunarDay: b.lunarDay,
				isLeapMonth: b.isLeapMonth, yearZhi: pillars[0][1], hourZhi,
				yangYear: '甲丙戊庚壬'.indexOf(pillars[0][0]) >= 0,
				askHourZhi: ask, env: o.env || ('卯辰巳午未申'.indexOf(ask) >= 0 ? '晴' : '明'),
			});
		}else{
			const input = {
				pillars, dayun: o.dayun || pillars[1], xiaoyun: o.xiaoyun || pillars[3],
				suijun: o.suijun || pillars[0], age: Number(o.age) || 40,
			};
			const year = M.dadingDeathYear(input);
			model = year ? { school: 'dading', input, year, month: M.dadingDeathMonth(pillars[1], pillars[0][0]) } : null;
		}
		return model ? (M.buildText(model, verses) || '') : '';
	}catch(e){
		return '';
	}
}

// opts.method（AI 挂载「每技法设置」）：'ming'(明法,默认) / 'gu'(古法,日支取宫)。
// 缺省/坏值回退 'ming' → 与现状逐字一致(守「默认即现状」)。dayPalace(canpingLocal) 据 method 改命宫取法。
async function buildCanpingSnapshotForRecord(record, opts){
	const b = buildChartShusuanBazi(record);
	if(!b){ return ''; }
	const method = (opts && opts.method === 'gu') ? 'gu' : 'ming';
	// [Win-D69] 挂载复算与页面同构(快照×异步三问自查):此前不传 dayunRule/农历 → 页面选
	// 任何大运档,挂载恒回落默认档+一岁起(「页面对、挂载错」再一例)。现:dayunRule 经挂载
	// 每技法设置透传;农历月日供《参评诀》起运;baziStyle 档注入八字真源 direction(节气起运,
	// 与八字盘/页面侧逐字节同源)。缺省全 undefined=默认档=现状零回归。
	const dayunRule = (opts && ['mingGongQiyun', 'mingGongOne', 'baziStyle'].indexOf(opts.dayunRule) >= 0) ? opts.dayunRule : 'mingGongQiyun';
	let baziYun = null;
	if(dayunRule === 'baziStyle' && Array.isArray(b.direction) && b.direction.length){
		try{
			baziYun = b.direction.map((d)=>{
				const gzd = (d.mainDirect && (d.mainDirect.ganzi || d.mainDirect.ganZhi)) || '';
				return { branch: gzd.charAt(1) || '', ganzi: gzd, ageStart: d.age, ageEnd: d.age + 9, startYear: d.startYear, endYear: d.endYear };
			}).filter((d)=>d.branch);
			if(!baziYun.length){ baziYun = null; }
		}catch(e){ baziYun = null; }
	}
	try{
		const result = canpingCalculate({
			yearGz: b.yearGz,
			monthBranch: b.monthZhi,
			dayBranch: b.dayZhi,
			hourBranch: b.hourZhi,
			gender: b.gender,
			method: method,
			qiyunAge: 1,
			lunarMonth: b.lunarMonth,
			lunarDay: b.lunarDay,
			dayunRule,
			baziYun,
		});
		// 补全生涯流年表:此前不传 liunianRows → result.liunian 恒 null、快照缺整层流年(用户反馈数算缺流年)。
		let liunianRows = null;
		try{
			const series = canpingLiunianSeries({
				yearGz: b.yearGz,
				monthBranch: b.monthZhi,
				dayBranch: b.dayZhi,
				hourBranch: b.hourZhi,
				gender: b.gender,
				method: method,
				qiyunAge: 1,
				birthYear: b.birthYear,
				startAge: 1,
				endAge: 120,
				lunarMonth: b.lunarMonth,
				lunarDay: b.lunarDay,
				dayunRule,
				baziYun,
			});
			liunianRows = (series && series.rows) || null;
		}catch(e){ liunianRows = null; }
		return buildCanpingSnapshotText(result, { liunianRows }) || '';
	}catch(e){
		return '';
	}
}

// 河洛真实节气化工（镜像 HeLuoMain.solarTerm）：据出生公历日算所处节气 + 是否四立前 18 日(土用)，
// 再据取化工法返回 {hg,fh,...}。无 lunar 数据 → null（judge 回退 MONTH_HG 月支近似）。
const HELUO_LI_TERMS = ['立春', '立夏', '立秋', '立冬'];
function heluoSolarTermForDate(dateStr, quHuaGong){
	try{
		const [y, m, d] = `${dateStr || ''}`.split('-').map((x)=>parseInt(x, 10));
		if(!y || !m || !d){ return null; }
		const solar = HeluoSolar.fromYmd(y, m, d);
		const lunar = solar.getLunar();
		const prev = lunar.getPrevJieQi(true);
		const prevName = prev.getName();
		const jd = solar.getJulianDay();
		const tbl = lunar.getJieQiTable();
		const tuyong = HELUO_LI_TERMS.some((n)=>{
			const t = tbl[n];
			if(!t){ return false; }
			const diff = t.getJulianDay() - jd;
			return diff >= 0 && diff <= 18;
		});
		return heluoSolarTermHuagong(prevName, tuyong, { quHuaGong: quHuaGong || 'tuWangKunGen' });
	}catch(e){
		return null;
	}
}

// opts.quHuaGong（AI 挂载「每技法设置」）：'tuWangKunGen'(土王寄坤艮,默认) / 'siFangBoOnly'(直取四方伯)。
// 取化工法只影响真实节气化工（solarTermHuagong）；而本无头 builder 现状给 judge 传 st=null（走 MONTH_HG 月支近似），
// 与主页面 HeLuoMain（用真实节气 st）本就不同。为守「默认即现状」(快照逐字节不变)：
//   - 默认/未覆盖 → 仍传 st=null（MONTH_HG），与现状字节级一致；
//   - 仅当用户显式覆盖 quHuaGong 时 → 据出生公历日算真实节气化工并传入 judge（取化工法在此生效，改 [命运篇] 化工行）。
// 注：覆盖后改用真实节气化工，比 MONTH_HG 更准（与屏显一致），属有意为之；不覆盖则零回归。
async function buildHeluoSnapshotForRecord(record, opts){
	const b = buildChartShusuanBazi(record);
	if(!b){ return ''; }
	const overrideQuHuaGong = opts && (opts.quHuaGong === 'tuWangKunGen' || opts.quHuaGong === 'siFangBoOnly') ? opts.quHuaGong : null;
	// 分歧法门(挂载 record 覆盖;缺省=引擎默认,与现状字节一致)
	const heluoOpts = {
		ziShuMode: record.ziShuMode || 'pair',
		jiGongMode: record.jiGongMode || 'manualSanYuan',
		zhiZunEnabled: !(record.zhiZunEnabled === 0 || record.zhiZunEnabled === false || record.zhiZunEnabled === '0'),
		pureGanKunVariant: record.pureGanKunVariant || 'current',
		liunianStep2: record.liunianStep2 || 'ying',
		liuYueMode: record.liuYueMode || 'ying',
		huangdiOffset: parseInt(record.huangdiOffset, 10) || 2697,
	};
	try{
		const chart = heluoCalc({
			fourPillars: b.fourPillars,
			gender: b.gender,
			hourZhi: b.hourZhi,
			birthYear: b.birthYear,
			monthZhi: b.monthZhi,
			opts: heluoOpts,
		});
		if(!chart || !chart.xian || !chart.xian.name || !chart.hou || !chart.hou.name){
			return '';
		}
		const dy = heluoDaYun(chart.xian, chart.hou, b.birthYear);
		// 默认 st=null（MONTH_HG，=现状）；仅覆盖时算真实节气化工。
		let st = null;
		if(overrideQuHuaGong){
			let dateStr = '';
			try{ dateStr = `${buildChartBaziParams(record).date || ''}`; }catch(e){ dateStr = ''; }
			st = heluoSolarTermForDate(dateStr, overrideQuHuaGong);
		}
		const jg = heluoJudge(chart, b.fourPillars, b.monthZhi, st);
		return buildHeluoSnapshotText(chart, jg, dy, { monthZhi: b.monthZhi, opts: heluoOpts }) || '';
	}catch(e){
		return '';
	}
}

// 一掌经（其他/命）：纯前端，按本盘出生→农历(正月初一年支/月/日/时支)起四柱四宫+断语。
// 挂载齿轮可调 顺逆/命宫/大限运长等 → record.{shunniRule,...} → opts（未改时 undefined，引擎回秘传默认）。
async function buildYizhangjingSnapshotForRecord(record, opts){
	try{
		const params = buildChartBaziParams(record);
		const bazi = buildLocalBaziResult(params).bazi;
		const model = buildYizhangjingModel(bazi, opts || {});
		return buildYizhangjingSnapshotText(model) || '';
	}catch(e){
		return '';
	}
}

// 取该盘的西洋星盘原始结果（含 predictive 衍生数据，如 firdaria；可选含主限法）。
async function fetchChartResultForRecord(record, options = {}){
	const fields = buildFieldObject(record);
	const rsp = await fetchChart({
		...fieldParams(fields),
		includePrimaryDirection: !!options.includePrimaryDirection,
	}, {
		silent: true,
		timeoutMs: 20000,
	});
	return rsp && rsp.Result ? rsp.Result : null;
}

// 卜卦盘 horary：仅凭起课时间+地点起西洋盘(无需人工摇卦),用引擎默认类别 general 出结构化裁决快照。
// 与 DivinationChartShell 同源(fetchChart→Result→runHorary);后端不可达 → 无盘返 '' → 显「缺失」(西洋盘必后端)。
// [V6 二轮复查] 🔴 卜卦/择日事盘的随案技法设置(payload.settings:黄道/宫制/守护+古典 20 键,
// 与 divinationCaseSave 落档、DivinationChartShell 还原白名单三方 lockstep)播回排盘 record——
// 此前两 regenerate 从不读 settings ⇒ 挂载补算按 buildFieldObject 回退起盘:择日页面默认
// 整宫制(hsys=0),hsys 回退修为 1 后挂载与页面新分叉;卜卦存档口径同被无视。settings 打底、
// 流派 backend 播种(显式换派)覆盖 —— 与页面「先还原存档再按换派播 backend」同序。
// [SURF-R0] 三方单源:古典段 import 自 divinationCaseSave(保存侧真源),本地只保留 4 基础键前缀。
const DIVINATION_SETTINGS_KEYS = ['zodiacal', 'siderealAyanamsa', 'hsys', 'tradition',
	...DIVINATION_CASE_SETTING_KEYS];
function divinationSettingsFields(record){
	try{
		const raw = record && record.payload;
		const payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
		const settings = payload && payload.settings && typeof payload.settings === 'object' ? payload.settings : null;
		if(!settings){
			return null;
		}
		const out = {};
		DIVINATION_SETTINGS_KEYS.forEach((k)=>{
			if(settings[k] !== undefined && settings[k] !== null){ out[k] = settings[k]; }
		});
		return Object.keys(out).length ? out : null;
	}catch(_e){
		return null;
	}
}

async function regenerateHorarySnapshot(record, options){
	// 起课/事盘记录用 divTime,但西洋盘 fetch 走 buildFieldObject(读 record.birth)→ 须把起课时刻映射为 birth 才能起盘。
	let chartRecord = (record && record.birth) ? record : { ...record, birth: (record && (record.divTime || record.updateTime)) || '' };
	// 随案存档口径打底(present 才播;老案例缺 settings 零行为)。
	const savedSettings = divinationSettingsFields(record);
	if(savedSettings){
		chartRecord = { ...chartRecord, ...savedSettings };
	}
	// [V6-W2] 🔴 流派 backend 参数组播入排盘 record(与技法页 HoraryMain 同源同函数):此前挂载
	// 重算只把流派用在判读层,盘本身仍按默认起 —— 换 Regiomontanus 档判读变了、宫头没变,
	// 与技法页同档盘面分叉(B-1 死开关)。存档 overrides(hp_ 前缀之外的 backend 键)随档覆盖。
	try{
		const oo = options && typeof options === 'object' ? options : {};
		const oxx = (oo.extra && typeof oo.extra === 'object') ? oo.extra : {};
		const schoolId = oo.horarySchool || oxx.horarySchool;
		if(schoolId){
			const backendFields = horaryBackendFields(schoolId, (oxx.horaryOverrides && typeof oxx.horaryOverrides === 'object') ? oxx.horaryOverrides : null);
			chartRecord = { ...chartRecord, ...backendFields };
		}
	}catch(_e){
		// 流派表异常不阻断(按原 record 起盘=旧行为)。
	}
	const chart = await fetchChartResultForRecord(chartRecord);
	if(!chart){
		return '';
	}
	try{
		const o = options && typeof options === 'object' ? options : {};
		const ox = (o.extra && typeof o.extra === 'object') ? o.extra : {};
		// 🔴 问卜类别键名兼容:齿轮/新档写 topicId,页面存档历来写 questionCategory(payload 顶层+extra 双落)。
		// 曾只读 topicId → 存了「婚姻」的卜卦事盘一动齿轮即回落「综合」,整盘判读换主题。
		const topicId = o.topicId || o.questionCategory || ox.topicId || ox.questionCategory || 'general';
		const horarySchool = (o.horarySchool || ox.horarySchool) || undefined;
		// 判读参数(卜卦专属 22 键):存档 extra.horaryOverrides 打底,齿轮 hp_* 扁平键覆盖 ——
		// 🔴 曾第二参写死 null:页面「判读参数」面板改的全部口径在挂载重算里整组蒸发。
		const savedOverrides = (ox.horaryOverrides && typeof ox.horaryOverrides === 'object') ? ox.horaryOverrides : {};
		const gearOverrides = {};
		HORARY_PARAM_SPEC.forEach((sp)=>{
			if(sp.scope !== 'horary'){ return; }
			const v = o['hp_' + sp.key];
			if(v === undefined || v === null || v === ''){ return; }
			gearOverrides[sp.key] = sp.type === 'switch' ? (v === 1 || v === '1' || v === true) : v;
		});
		const overrides = { ...savedOverrides, ...gearOverrides };
		// 定盘自评(问句真诚/年轻体貌)随档并入 opts(影响 radicality,与页面 HoraryJudgment 同构)。
		const j = runHorary(chart, topicId, {
			...horaryJudgeOpts(horarySchool, Object.keys(overrides).length ? overrides : null, judgeLayerOverrides()),
			...(ox.sincerityConfirmed !== undefined || ox.confirmYouthMatch !== undefined ? {
				sincerityConfirmed: ox.sincerityConfirmed,
				confirmYouthMatch: ox.confirmYouthMatch,
			} : {}),
		});
		// 第三参问句/阵营 → [定盘考量] 段(页面 saveSnap 同构;曾缺参致该段在挂载里必然消失)。
		return j ? (buildHorarySnapshot(j, chart, { questionText: ox.questionText, castingCamp: ox.castingCamp }) || '') : '';
	}catch(e){
		return '';
	}
}

// 择日盘 election：同理,引擎默认 topicId=marriage(runElection 自带兜底)出总评/红线/分项/应期/建议快照。
async function regenerateElectionSnapshot(record, options){
	// 同 horary:起课/事盘记录用 divTime,映射为 birth 后才能起西洋盘。
	let chartRecord = (record && record.birth) ? record : { ...record, birth: (record && (record.divTime || record.updateTime)) || '' };
	// 随案存档口径打底(择日页面默认整宫制随 settings 回放;流派 hsys 联动在后覆盖)。
	const savedSettings = divinationSettingsFields(record);
	if(savedSettings){
		chartRecord = { ...chartRecord, ...savedSettings };
	}
	// [V6-W2] 流派 hsys 联动播入(westernSchools:hsys=null 的档=不联动保持现状,与技法页同语义)。
	try{
		const oo = options && typeof options === 'object' ? options : {};
		const ws = oo.westSchool || (oo.extra && oo.extra.westSchool);
		if(ws){
			// eslint-disable-next-line global-require
			const { schoolOf: electionSchoolOf } = require('../divination/election/westernSchools');
			const sc = electionSchoolOf(ws);
			if(sc && sc.hsys !== null && sc.hsys !== undefined){
				chartRecord = { ...chartRecord, hsys: sc.hsys };
			}
		}
	}catch(_e){
		// 流派表异常不阻断。
	}
	const chart = await fetchChartResultForRecord(chartRecord);
	if(!chart){
		return '';
	}
	try{
		// AI 挂载「每技法设置」:用事类别经 options.topicId 透传（缺省 marriage=现状）。
		const topicId = (options && typeof options === 'object' && options.topicId) ? options.topicId : 'marriage';
		// 西方子流派:齿轮「每技法设置」落顶层 options.westSchool;储存记录落 payload.extra.westSchool。
		// 两处都查(缺省 undefined → 引擎兜底现代主流 = 现状)。
		const westSchool = (options && typeof options === 'object'
			&& (options.westSchool || (options.extra && options.extra.westSchool))) || undefined;
		const pick = (k) => (options && typeof options === 'object'
			&& (options[k] !== undefined ? options[k] : (options.extra ? options.extra[k] : undefined))) || undefined;
		// [R2] 流派口径覆盖/买卖方向/护符主星/部位对宫随存档 extra 全量透传——
		// 缺任一键=挂载再生快照与页面判读口径分叉(静默丢),故与 ElectionJudgment 的 opts 面保持同集。
		// 流派口径 13 键:存档 extra.electionParams(对象)打底,齿轮 ep_* 扁平键覆盖(''=随流派不覆盖)。
		const epSaved = pick('electionParams');
		const epFlat = {};
		ELECTION_PARAM_SPEC.forEach((sp)=>{
			const v = options && options['ep_' + sp.key];
			if(v !== undefined && v !== null && v !== ''){ epFlat[sp.key] = v; }
		});
		const electionParams = { ...((epSaved && typeof epSaved === 'object') ? epSaved : {}), ...epFlat };
		// [R5-P1] 判读全局层与页面(ElectionJudgment:278)同构——缺此 spread 时 AI 再生的择日判读
		// (太阳三态/空亡/partile/恒星轨/映点)全部跌回引擎默认,与页面判读卡分叉。
		const { judgeLayerOverrides } = require('./judgeLayerOverrides');
		const j = runElection(chart, topicId, undefined, undefined, {
			westSchool, surgeryPart: pick('surgeryPart'), crisisBase: pick('crisisBase'),
			...judgeLayerOverrides(),
			electionParams: Object.keys(electionParams).length ? electionParams : undefined, tradeSide: pick('tradeSide'),
			talismanStar: pick('talismanStar'), surgeryPartOpposite: !!pick('surgeryPartOpposite'),
		});
		return j ? (buildElectionSnapshot(j) || '') : '';
	}catch(e){
		return '';
	}
}

// ===== P4 区间扫描：把单一目标时刻扩展为「from→to 按 step」的多时点列表 =====
// 守铁律「默认即现状」：endStr 空 或 step 非 y/m/d → 返回单点 [startStr || now]（与扫描前逐字节一致）。
// 仅当 endStr 非空且 step 合法时才循环；段数上限 SCAN_SEGMENT_CAP（防快照爆），超限截断并置 truncated。
const SCAN_SEGMENT_CAP = 30;
// 今日（YYYY-MM-DD）——date 型扫描起点兜底（与 vedic/jaynes builder 内 today() 同口径，单点时不用它，仅多点起点空时兜底）。
function todayDateStr(){
	const d = new Date();
	return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;
}
function buildDatetimeScanPoints(startStr, endStr, step, fmt, nowFallback){
	const start = `${startStr || ''}`.trim();
	const end = `${endStr || ''}`.trim();
	const stp = (step === 'y' || step === 'm' || step === 'd') ? step : '';
	// 单点（现状）：无终点 / 无步进。
	if(!end || !stp){
		return { points: [start || (typeof nowFallback === 'function' ? nowFallback() : '')], truncated: false };
	}
	let startDt = null;
	let endDt = null;
	try{
		const startSeed = start || (typeof nowFallback === 'function' ? nowFallback() : '');
		startDt = new DateTime().parse(`${startSeed}`, fmt);
		endDt = new DateTime().parse(`${end}`, fmt);
	}catch(e){
		startDt = null;
		endDt = null;
	}
	if(!startDt || !endDt || !Number.isFinite(Number(startDt.jdn)) || !Number.isFinite(Number(endDt.jdn))){
		// 解析失败 → 退回单点（不破坏现状、不抛）。
		return { points: [start || (typeof nowFallback === 'function' ? nowFallback() : '')], truncated: false };
	}
	// 终点早于起点 → 退回单点（避免空/反向循环）。
	if(Number(endDt.jdn) < Number(startDt.jdn)){
		return { points: [start || (typeof nowFallback === 'function' ? nowFallback() : '')], truncated: false };
	}
	const points = [];
	let truncated = false;
	const cur = startDt.clone();
	let guard = 0;
	while(Number(cur.jdn) <= Number(endDt.jdn) + 1e-9){
		points.push(cur.format(fmt));
		if(points.length >= SCAN_SEGMENT_CAP){
			// 还没到终点就到上限 → 截断标记。
			const peek = cur.clone();
			peek.add(1, stp);
			if(Number(peek.jdn) <= Number(endDt.jdn) + 1e-9){
				truncated = true;
			}
			break;
		}
		cur.add(1, stp);
		guard += 1;
		if(guard > 5000){ break; } // 终极防呆（步进异常时不死循环）。
	}
	if(points.length === 0){
		points.push(startDt.format(fmt));
	}
	return { points, truncated };
}

// P5 主限法盘快照（无头）：取含主限法的西洋盘 → 把「所选时刻」换算成主限年龄弧 → 出 [主限法盘设置] 段。
// 搬自 AstroPrimaryDirectionChart.js 的盘快照逻辑（buildSnapshotText + getPdArcFromDate）——纯文本快照，
// 不真正套盘渲染；datetime 缺省（空）→ 取此刻（=组件默认 buildDefaultDateTime≈本命+当前年龄，这里用此刻近似，
// 与表格 fallthrough 旧行为相比是「真盘设置段」而非「表格行」，修正了盘喂表格的 Bug）。
function pdSplitDegreeText(value){
	const num = Number(value);
	if(!Number.isFinite(num)){
		return `${value || ''}`;
	}
	const neg = num < 0 ? '-' : '';
	const abs = Math.abs(num);
	const deg = Math.floor(abs + 1e-12);
	let minute = Math.round((abs - deg) * 60);
	if(minute >= 60){
		return `${neg}${deg + 1}度0分`;
	}
	return `${neg}${deg}度${minute}分`;
}
function pdBirthDateTime(chartObj){
	const params = chartObj && chartObj.params ? chartObj.params : {};
	const birth = `${params.birth || ''}`.trim();
	const parts = birth.split(' ');
	if(parts.length < 2){
		return null;
	}
	let text = `${parts[0]} ${parts[1]}`;
	if(parts[1].split(':').length === 2){
		text = `${text}:00`;
	}
	try{
		const dt = new DateTime().parse(text, 'YYYY-MM-DD HH:mm:ss');
		if(params.zone){
			dt.zone = params.zone;
			dt.calcJdn();
		}
		return dt;
	}catch(e){
		return null;
	}
}
function pdJdnFromArc(birthDt, arc){
	if(!birthDt){
		return 0;
	}
	const magnitude = Math.abs(Number(arc));
	if(!Number.isFinite(magnitude)){
		return birthDt.jdn;
	}
	const years = Math.floor(magnitude + 1e-12);
	const fraction = magnitude - years;
	const whole = birthDt.clone();
	whole.addYear(years);
	const next = birthDt.clone();
	next.addYear(years + 1);
	const wholeDays = whole.jdn - birthDt.jdn;
	const spanDays = next.jdn - whole.jdn;
	return birthDt.jdn + wholeDays + fraction * spanDays;
}
function pdArcFromDate(birthDt, currentDt){
	if(!birthDt || !currentDt){
		return 0;
	}
	const target = Number(currentDt.jdn);
	if(!Number.isFinite(target) || target <= birthDt.jdn){
		return 0;
	}
	let low = 0;
	let high = Math.max(1, Math.ceil((target - birthDt.jdn) / 365) + 2);
	for(let i=0; i<16; i++){
		if(pdJdnFromArc(birthDt, high) >= target){
			break;
		}
		high *= 2;
	}
	for(let i=0; i<64; i++){
		const mid = (low + high) / 2;
		const midJd = pdJdnFromArc(birthDt, mid);
		if(midJd < target){
			low = mid;
		}else{
			high = mid;
		}
	}
	return (low + high) / 2;
}
// 把所选时刻字符串解析为 DateTime（套本命时区）；空 → 此刻。
function pdCurrentDateTime(chartObj, datetimeStr){
	const params = chartObj && chartObj.params ? chartObj.params : {};
	const txt = `${datetimeStr || ''}`.trim();
	const dt = new DateTime();
	try{
		if(txt){
			dt.parse(txt.split(':').length === 2 ? `${txt}:00` : txt, 'YYYY-MM-DD HH:mm:ss');
		}
		if(params.zone){
			dt.zone = params.zone;
			dt.calcJdn();
		}
		return dt;
	}catch(e){
		return dt;
	}
}
// 生成单一时刻的主限法盘快照段（chartObj 须含 params.birth）。opts: { datetime, pdMethod, pdTimeKey, direction }。
// [G1] 无头快照曾是独立阉割实现:缺 [本命盘配置]/[主限法盘配置]/黄道/宫制 —— AI 挂载拿到的
// 主限法盘没有任何星曜/宫位数据。现与页面 buildSnapshotText(AstroPrimaryDirectionChart)同段构成:
// 本命段复用 astroAiSnapshot 同两条 line-builder;外圈盘镜像页面 buildRequestParams POST /predict/pdchart
// (fail → '无（推导盘获取失败）' best-effort,不阻断其余段)。组件实产 6 段=preset 6 段,零登记变更。
async function buildPrimaryDirChartSnapshotText(chartObj, opts){
	if(!chartObj){
		return '';
	}
	const o = opts && typeof opts === 'object' ? opts : {};
	const params = chartObj.params || {};
	const chart = chartObj.chart || {};
	if(!params.birth){
		return '';
	}
	const pdMethod = `${o.pdMethod || params.pdMethod || DEFAULT_PD_METHOD}`;
	const pdTimeKey = `${o.pdTimeKey || params.pdTimeKey || DEFAULT_PD_TIME_KEY}`;
	const direction = `${o.direction || params.direction || 'direct'}`;
	const currentDt = pdCurrentDateTime(chartObj, o.datetime);
	const birthDt = pdBirthDateTime(chartObj);
	const currentArc = pdArcFromDate(birthDt, currentDt);
	const lines = [];
	lines.push('[出生时间]');
	lines.push(`出生时间：${params.birth || '无'}`);
	lines.push('');
	lines.push('[星盘信息]');
	lines.push(`经纬度：${`${params.lon || ''} ${params.lat || ''}`.trim() || '无'}`);
	lines.push(`时区：${params.zone || '无'}`);
	// 黄道/宫制(与页面 buildSnapshotText 同表达式;缺省不产行)
	const zodiacalRaw = chart.zodiacal || AstroConst.ZODIACAL[`${params.zodiacal}`];
	if(zodiacalRaw){
		const ayanKey = params.siderealAyanamsa || chart.siderealAyanamsa || '';
		lines.push(`黄道：${AstroConst.zodiacalDisplayText(zodiacalRaw, ayanKey)}`);
	}
	const hsysLabel = AstroConst.HouseSys[`${params.hsys}`] || chart.hsys;
	if(hsysLabel){
		lines.push(`宫制：${hsysLabel}`);
	}
	lines.push('');
	lines.push('[主限法盘设置]');
	lines.push(`时间选择：${currentDt ? currentDt.format('YYYY-MM-DD HH:mm:ss') : '无'}`);
	lines.push(`推运方法：${getPdMethodLabel(pdMethod)}`);
	lines.push(`度数换算：${getPdTimeKeyLabel(pdTimeKey)}`);
	lines.push(`向运方向：${direction === 'converse' ? '逆向 Converse' : '顺向 Direct'}`);
	lines.push(`当前Arc：${pdSplitDegreeText(currentArc)}`);
	lines.push('');
	// 本命盘配置(内圈):行星落座 + 宫位宫头(与页面同两条 line-builder)。
	// typeof 守卫=仓内范式:测试环境可能部分 mock astroAiSnapshot(只留 buildAstroSnapshotContent 等),缺函数回 []。
	const safeLines = (fn, co)=>(typeof fn === 'function' ? (fn(co) || []) : []);
	lines.push('[本命盘配置]');
	const natalStars = safeLines(buildStarAndLotPositionLines, chartObj);
	const natalHouses = safeLines(buildHouseCuspLines, chartObj);
	if(natalStars.length){ lines.push('星与虚点'); lines.push(...natalStars); }
	if(natalHouses.length){ lines.push('宫位宫头'); lines.push(...natalHouses); }
	if(!natalStars.length && !natalHouses.length){ lines.push('无'); }
	lines.push('');
	// 主限法盘配置(外圈):镜像页面 buildRequestParams 取推导盘;失败降级为一行说明。
	lines.push('[主限法盘配置]');
	let dirChart = null;
	try{
		const birthParts = `${params.birth}`.split(' ');
		const reqBody = {
			date: birthParts[0],
			time: birthParts[1] || '00:00:00',
			ad: params.ad ? params.ad : 1,
			zone: params.zone,
			dirZone: params.zone,
			lon: params.lon,
			lat: params.lat,
			gpsLat: params.gpsLat,
			gpsLon: params.gpsLon,
			hsys: params.hsys,
			zodiacal: params.zodiacal, siderealAyanamsa: params.siderealAyanamsa,
			tradition: params.tradition,
			pdtype: DEFAULT_PD_TYPE,
			pdMethod,
			pdProjection: params.pdProjection || 'ptolemy',
			pdFrame: params.pdFrame || 'alcabitius',
			pdTimeKey,
			showPdBounds: params.showPdBounds,
			datetime: currentDt ? currentDt.format('YYYY-MM-DD HH:mm:ss') : '',
			direction,
		};
		if(reqBody.date && reqBody.datetime){
			const data = await request(`${Constants.ServerRoot}/predict/pdchart`, {
				body: JSON.stringify(reqBody),
				silent: true,
				timeoutMs: 20000,
			});
			const unwrapped = data && data.Result ? data.Result : data;
			dirChart = unwrapped && !unwrapped.err && unwrapped.chart ? unwrapped : null;
		}
	}catch(e){
		dirChart = null;
	}
	const dirStars = dirChart ? safeLines(buildStarAndLotPositionLines, dirChart) : [];
	const dirHouses = dirChart ? safeLines(buildHouseCuspLines, dirChart) : [];
	if(dirStars.length){ lines.push('星与虚点'); lines.push(...dirStars); }
	if(dirHouses.length){ lines.push('宫位宫头'); lines.push(...dirHouses); }
	if(!dirStars.length && !dirHouses.length){ lines.push('无（推导盘获取失败或后端不可用）'); }
	lines.push('');
	lines.push('[主限法盘说明]');
	lines.push('左侧双盘内圈为本命盘，外圈为按当前主限法设置和所选时间推导出的主限法盘位置。');
	lines.push('当前页面会先将所选时间换算为主限年龄弧，再按后台主限法算法推进各星曜与虚点，最后统一投影回黄道后与本命盘套盘显示。');
	return lines.join('\n');
}

// 5 个「目标时刻型」推运（小限 profection / 太阳弧 solararc / 太阳返照 solarreturn /
// 月亮返照 lunarreturn / 流年 givenyear）：POST /predict/<key>，目标时刻默认「此刻」
// （与各组件 datetime 默认一致 = 当前流年/期），用共享 buildPredictiveSnapshotText 出 [星盘信息]/[起盘信息]/[相位] 快照。
// 无相位数据即返 '' → 挂载显示「缺失」而非空段头。
// opts（AI 挂载「每技法设置」）：datetime（目标时刻）/ tmType（年/月/日步进）/ asporb（容许度）/ nodeRetrograde（南北交逆移）。
// returns 型（solarreturn/lunarreturn/givenyear）另可覆盖 dirLat/dirLon/dirZone（异地返照；缺省=本命经纬时区）。
// 全部缺省/坏值 → 回退现状默认（此刻/年/1/false/本命经纬）→ 与现状逐字一致(守「默认即现状」)。
async function buildPredictivePeriodSnapshot(chartObj, key, opts){
	if(!chartObj){
		return '';
	}
	const np = chartObj.params || {};
	const o = opts && typeof opts === 'object' ? opts : {};
	let datetimeStr = '';
	try{
		datetimeStr = new DateTime().format('YYYY-MM-DD HH:mm');
	}catch(e){
		datetimeStr = '';
	}
	const optDatetime = `${o.datetime || ''}`.trim();
	const tmType = (o.tmType === 'm' || o.tmType === 'd' || o.tmType === 'y') ? o.tmType : 'y';
	// [R5-P2] 缺省与推运 9 组件同源(transitOrbDefault 读全局 transitOrb,默认 1 零回归)——
	// 硬编码 1 会在全局改 3° 后与页面推运相位表分叉。
	let _orbDefault = 1;
	try{ _orbDefault = require('../components/astro/AstroExtraCommon').transitOrbDefault() || 1; }catch(e){ _orbDefault = 1; }
	const asporb = (o.asporb !== undefined && o.asporb !== null && `${o.asporb}` !== '' && Number.isFinite(Number(o.asporb))) ? Number(o.asporb) : _orbDefault;
	const nodeRetrograde = (o.nodeRetrograde === true || o.nodeRetrograde === 1 || o.nodeRetrograde === '1');
	// 单一时点的快照（datetimeForPoint = 'YYYY-MM-DD HH:mm'）。区间扫描循环调用它。
	const runOnePoint = async (datetimeForPoint)=>{
		const params = {
			date: np.date,
			time: np.time,
			ad: np.ad !== undefined ? np.ad : 1,
			zone: np.zone,
			dirZone: (o.dirZone !== undefined && o.dirZone !== null && `${o.dirZone}` !== '') ? o.dirZone : np.zone,
			lon: np.lon,
			lat: np.lat,
			gpsLat: np.gpsLat,
			gpsLon: np.gpsLon,
			hsys: np.hsys,
			zodiacal: np.zodiacal, siderealAyanamsa: np.siderealAyanamsa,
			tradition: np.tradition,
			datetime: datetimeForPoint,
			tmType: tmType,
			nodeRetrograde: nodeRetrograde,
			asporb: asporb,
		};
		// [F2 根修] AI 推运构参补古典口径续传:七头键(响应 params 有即续传,与派生盘组件
		// natalClassicalParams 同语义)+overrides 全量非默认——此前连 termsVariant 都不带,
		// AI 推运段恒按全默认口径重算,与主盘/推运页分叉。
		['termsVariant', 'leoBoundFirst', 'geminiBoundEmended', 'triplicity', 'lotReversal', 'westNodeType', 'sectBuffer'].forEach((ck)=>{
			if(np[ck] !== undefined && np[ck] !== null && `${np[ck]}` !== ''){
				params[ck] = np[ck];
			}
		});
		Object.assign(params, classicalBackendOverridesFromPlain(np));
		// [SURF-R5ai] user 自定义岁差三元(照 natalClassicalParams R4u 同款):spec 无 userAyan 两键,
		// overrides 不产——缺此段则 AI 推运段带裸 'user' 键,后端建档失败静默回落 Lahiri,
		// 与页面推运(已修)口径分叉。echo 有值直取,缺则回落本机当前槽。
		if(`${np.siderealAyanamsa}` === 'user'){
			try{ Object.assign(params, require('./customCalibreStores').userAyanParamsFrom((k)=>np[k])); }catch(e){ /* 无槽=后端回落,与页面同 */ }
		}
		// [R2-11] 头键循环先写了 termsVariant;overrides 的「无表降级删 4」撤不回它 → 补刀:4 而无表体=不发(后端等效埃及,显式化)。
		if(Number(params.termsVariant) === 4 && !params.customTermsDay){ delete params.termsVariant; }
		// 异地返照（仅 returns 型：solarreturn/lunarreturn/givenyear）才下发 dirLat/dirLon——与各 Return 组件一致
		// （默认 = 本命经纬，字节级等同现状）；profection/solararc 组件本就不带 dirLat/dirLon，不加以免改默认行为。
		if(key === 'solarreturn' || key === 'lunarreturn' || key === 'givenyear'){
			params.dirLat = (o.dirLat !== undefined && o.dirLat !== null && `${o.dirLat}` !== '') ? o.dirLat : np.lat;
			params.dirLon = (o.dirLon !== undefined && o.dirLon !== null && `${o.dirLon}` !== '') ? o.dirLon : np.lon;
		}
		if(!params.date && np.birth){
			const parts = `${np.birth}`.split(' ');
			params.date = parts[0];
			params.time = params.time || parts[1] || '';
		}
		try{
			const data = await request(`${Constants.ServerRoot}/predict/${key}`, {
				body: JSON.stringify(params),
				timeoutMs: 60000,
			});
			const result = data && data[Constants.ResultKey];
			if(!result){
				return '';
			}
			// [独立复核修] methodKey 必传:漏传时挂载快照缺 [方法说明],与导出侧(组件全部传参)四同步破缺。
			return buildPredictiveSnapshotText(chartObj, params, result, key) || '';
		}catch(e){
			return '';
		}
	};
	// P4 区间扫描：datetimeEnd 非空且 scanStep 合法 → 多时点；否则单点（=现状，datetime=optDatetime||now）。
	const scan = buildDatetimeScanPoints(optDatetime || datetimeStr, o.datetimeEnd, o.scanStep, 'YYYY-MM-DD HH:mm', ()=>datetimeStr);
	if(scan.points.length <= 1){
		return await runOnePoint(scan.points[0] || (optDatetime || datetimeStr));
	}
	const segs = [];
	for(let i=0; i<scan.points.length; i++){
		const txt = await runOnePoint(scan.points[i]);
		if(txt){
			// R2 对抗自检:分隔标签不可用 【】/[] 包裹,否则被 aiExport.parseSectionTitleLine 当成 section title,
			// 用户自定义导出段时该「时段 N/M」行会落在 wanted 外被 filterContentByWantedSections 删掉(正文段仍在,仅丢标签)。
			segs.push(`—— 时段 ${i + 1}/${scan.points.length} · ${scan.points[i]} ——\n${txt}`);
		}
	}
	if(scan.truncated){
		segs.push(`（区间扫描已达单次上限 ${SCAN_SEGMENT_CAP} 段，后续时段已截断；如需更细请缩小区间或加大步进。）`);
	}
	return segs.join('\n\n');
}

// P4 通用「builder 型」推运区间扫描包裹：行星弧/恒星推运/赤纬推运的 standalone builder 各只接单一时刻 opts，
// 此处据 record.{datetimeEnd,scanStep} 把时刻列表化后循环调 builder 产多段；end 空/step 空 → 单点（=现状）。
//  - cfg.start：起点字符串（planetaryarc=record.targetDatetime；vedic/jaynes=record.targetDate）
//  - cfg.fmt：时点格式（datetime='YYYY-MM-DD HH:mm'；date='YYYY-MM-DD'）
//  - cfg.nowFallback：空起点时的兜底（datetime=此刻；date=今日）
//  - cfg.makeOpts(pointStr)：把单一时点字符串包成 builder 的 opts
//  - cfg.run(opts)：调对应 builder（返回 Promise<string>）
async function runBuilderScan(record, cfg){
	const startStr = `${cfg.start || ''}`.trim();
	const scan = buildDatetimeScanPoints(startStr, record && record.datetimeEnd, record && record.scanStep, cfg.fmt, cfg.nowFallback);
	if(scan.points.length <= 1){
		// 单点（现状）：起点空 → 传 undefined（让 builder 走自身默认 today/now，逐字节一致）；非空 → 传起点串。
		return (await cfg.run(cfg.makeOpts(startStr ? startStr : undefined)) || '');
	}
	const segs = [];
	for(let i=0; i<scan.points.length; i++){
		const txt = await cfg.run(cfg.makeOpts(scan.points[i]));
		if(txt){
			// R2 对抗自检:分隔标签不可用 【】/[] 包裹,否则被 aiExport.parseSectionTitleLine 当成 section title,
			// 用户自定义导出段时该「时段 N/M」行会落在 wanted 外被 filterContentByWantedSections 删掉(正文段仍在,仅丢标签)。
			segs.push(`—— 时段 ${i + 1}/${scan.points.length} · ${scan.points[i]} ——\n${txt}`);
		}
	}
	if(scan.truncated){
		segs.push(`（区间扫描已达单次上限 ${SCAN_SEGMENT_CAP} 段，后续时段已截断；如需更细请缩小区间或加大步进。）`);
	}
	return segs.join('\n\n');
}

// 命盘侧：按该盘的出生数据无头复算指定技法的快照文本。占卜/事盘走 Part F，不在此列。
// [制度化] export 供全技法段登记哨兵真跑(chart 技法入口:bazi/ziwei/indiachart/推运系)。
// [M-4 定谳] 事盘源走命盘管道的双栖技法(suzhan/huangji):record 无 birth 时 buildFieldObject 以
// divTime 兜底起盘——以事发时刻起盘是卜法正统语义(horary 同构),非缺陷;但快照必须自声明,
// 防 AI 把事时误读为出生时。命盘源(record.birth 在)零字节不产行;行插 [起盘信息] 段内(可勾选控)。
function annotateCaseTimeAsChartBase(text, record){
	if(!text || !record || record.birth || !record.divTime){ return text; }
	const line = '起盘方式：以事盘时刻起盘（卜法语义，此时刻为事时而非出生时）';
	const lines = `${text}`.split('\n');
	const idx = lines.findIndex((l)=>l.trim() === '[起盘信息]');
	if(idx >= 0){
		lines.splice(idx + 1, 0, line);
		return lines.join('\n');
	}
	return `${line}\n${text}`;
}

export async function regenerateChartTechniqueSnapshot(record, key){
	if(!record){
		return '';
	}
	try{
		switch(normalizeTechniqueKey(key)){
		case 'bazi':
			return await buildBaziSnapshotForParams(buildChartBaziParams(record));
		case 'ziwei':
			// [B15] 小限顺逆已迁入 ZWEngineOptions.xiaoxianMode:record 值经 params 透传,
			// builder 走 SWITCH_KEYS 临时覆盖+finally 还原——不再兜转 localStorage(崩溃残留会污染偏好)。
			return await buildZiweiSnapshotForParams(buildChartZiweiParams(record));
		case 'indiachart': {
			// 挂载分盘可调(2026-07-05):record.indiaChartnum 经挂载齿轮设定;缺省 1=D1 现状零回归。
			const indiaChartnum = Number(record && record.indiaChartnum) || 1;
			return await buildIndiaSnapshotForFields(buildFieldObject(record), indiaChartnum);
		}
		case 'firdaria': {
			// 法达星限随西洋盘 predictive 一并返回，直接读取即可。
			const chartObj = await fetchChartResultForRecord(record);
			return chartObj ? (buildFirdariaSnapshotText(chartObj) || '') : '';
		}
		case 'distributions': {
			// 界推运：上升点经主限运动穿越埃及界，分配星(界主)+参与星。内部 fetch /predict/dist。
			const chartObj = await fetchChartResultForRecord(record);
			return chartObj ? (await buildDistributionsSnapshotText(chartObj) || '') : '';
		}
		case 'agepoint': {
			// 年龄推进点（Huber）：年龄点自上升点起沿 Koch 宫顺行。内部 fetch /predict/agepoint。
			const chartObj = await fetchChartResultForRecord(record);
			return chartObj ? (await buildAgePointSnapshotText(chartObj) || '') : '';
		}
		case 'planetaryages': {
			// 行星年龄（托勒密人生七阶）：纯前端固定七阶表，读本命盘。
			const chartObj = await fetchChartResultForRecord(record);
			return chartObj ? (buildPlanetaryAgesSnapshotText(chartObj) || '') : '';
		}
		case 'vedicprog': {
			// 恒星推运（Vedic）：二/三/小限推运在恒星黄道下计算。内部 fetch /astroextra/progressions + zodiacal:1。
			// 挂载齿轮可调 目标日期/时刻 → record.* → opts（未改时 undefined，builder 回默认 today/12:00=现状）。
			// P4 区间扫描：targetDate 为起点、datetimeEnd/scanStep 循环多个目标日期（时刻沿用 targetTime）。
			const chartObj = await fetchChartResultForRecord(record);
			if(!chartObj){ return ''; }
			return await runBuilderScan(record, {
				start: record.targetDate,
				fmt: 'YYYY-MM-DD',
				nowFallback: ()=>todayDateStr(),
				makeOpts: (pt)=>({ targetDate: pt, targetTime: record.targetTime, minorVariant: record.minorVariant }),
				run: (opts)=>buildVedicProgSnapshotText(chartObj, opts),
			});
		}
		case 'balbillus': {
			// Balbillus：十年大运月制族变体（旺距削减），纯前端独立引擎，读本命盘。
			// 挂载齿轮可调 起始星/年制/距离口径 → record.* → opts（未改时 undefined，builder normalize 回默认=现状）。
			const chartObj = await fetchChartResultForRecord(record);
			return chartObj ? (buildBalbillusSnapshotText(chartObj, { startPlanet: record.startPlanet, yearType: record.yearType, mode: record.mode }) || '') : '';
		}
		case 'triplicityrulers': {
			// 三分主星推运：区间光体三分主星分掌人生阶段。挂载齿轮可调 三分体系/划分法/寿命基准（年龄上限）。
			const chartObj = await fetchChartResultForRecord(record);
			return chartObj ? (buildTriplicityRulersSnapshotText(chartObj, { system: record.system, division: record.division, lifespan: record.lifespan }) || '') : '';
		}
		case 'keypoints': {
			// 数字相位推运：120 年关键点，小年因数激活。挂载齿轮可调 释放点（命/身）。
			const chartObj = await fetchChartResultForRecord(record);
			return chartObj ? (buildKeypointsSnapshotText(chartObj, { mode: record.mode }) || '') : '';
		}
		case 'lunationphase': {
			// 月相推运：次限日月八相，纯前端读本命盘。
			const chartObj = await fetchChartResultForRecord(record);
			return chartObj ? (buildLunationPhaseSnapshotText(chartObj) || '') : '';
		}
		case 'extrareturns': {
			// 多重回归：土/木/月交返照，请求型(内部拉 /astroextra/planetreturn)。
			const chartObj = await fetchChartResultForRecord(record);
			return chartObj ? (await buildExtraReturnsSnapshotText(chartObj) || '') : '';
		}
		case 'yearsystem129': {
			// 129 年系统：七政小年序列（仿 firdaria），随盘 predictive 返回。
			const chartObj = await fetchChartResultForRecord(record);
			return chartObj ? (buildYearSystem129SnapshotText(chartObj) || '') : '';
		}
		case 'planetaryarc': {
			// 行星弧：solararc 引擎换弧源（默认月亮弧）。内部 fetch /predict/planetaryarc。
			// 挂载齿轮可调 弧源/目标时刻/容许度 → record.* → opts（未改时 undefined，builder 回默认 月亮/today/1=现状）。
			// P4 区间扫描：targetDatetime 为起点、datetimeEnd/scanStep 循环多个目标时刻。
			const chartObj = await fetchChartResultForRecord(record);
			if(!chartObj){ return ''; }
			return await runBuilderScan(record, {
				start: record.targetDatetime,
				fmt: 'YYYY-MM-DD HH:mm',
				nowFallback: ()=>{ try{ return new DateTime().format('YYYY-MM-DD HH:mm'); }catch(e){ return ''; } },
				makeOpts: (pt)=>({ arcSource: record.arcSource, datetime: pt, asporb: record.asporb }),
				run: (opts)=>buildPlanetaryArcSnapshotText(chartObj, opts),
			});
		}
		case 'persiandirected': {
			// 波斯向运：黄经象征向运(1°/年,宫头不动)，应期 hit-list 纯前端算术，读本命盘。
			// 挂载齿轮可调 速率/方向/应期年数 → record.* → opts（未改时 undefined，builder 回默认 persian/direct/90=现状）。
			const chartObj = await fetchChartResultForRecord(record);
			return chartObj ? (buildPersianDirectedSnapshotText(chartObj, { rateKey: record.rateKey, direction: record.direction, maxYears: record.maxYears }) || '') : '';
		}
		case 'jaynesprog': {
			// Jayne 赤纬推运：推运后看赤纬平行/反平行。内部 fetch /astroextra/jaynesprog。
			// 挂载齿轮可调 目标日期/时刻 → record.* → opts（未改时 undefined，builder 回默认 today/12:00=现状）。
			// P4 区间扫描：targetDate 为起点、datetimeEnd/scanStep 循环多个目标日期（时刻沿用 targetTime）。
			const chartObj = await fetchChartResultForRecord(record);
			if(!chartObj){ return ''; }
			return await runBuilderScan(record, {
				start: record.targetDate,
				fmt: 'YYYY-MM-DD',
				nowFallback: ()=>todayDateStr(),
				makeOpts: (pt)=>({ targetDate: pt, targetTime: record.targetTime, minorVariant: record.minorVariant }),
				run: (opts)=>buildJaynesProgSnapshotText(chartObj, opts),
			});
		}
		case 'primarydirect': {
			// 主限法·表格：取含主限法的西洋盘 → 列未来 pdYears 年全部 direction 行。P0 起
			// 方位法 + 时间换算 + pdYears 经 record.* → buildFieldObject/fieldParams 透传 /chart 复算（用户选了
			// Placidus/Naibod 等，LLM 上下文也跟着显示）。表格无 datetime（年限范围非单一时刻）。
			const chartObj = await fetchChartResultForRecord(record, { includePrimaryDirection: true });
			if(!chartObj){
				return '';
			}
			// 显式把用户配置的方位法/时间换算/方向类型/顺逆/映点/界回填进快照 params——与 fetchChart
			// 复算所用 fieldParams 同源(buildFieldObject)，不依赖后端是否把请求参回显进 Result.params。
			// 否则 [主限法设置] 段的「向运方向/映点迫星/界迫星」会误显默认值(顺向/否/否)。
			const pdFields = buildFieldObject(record);
			const snapshotChartObj = {
				...chartObj,
				params: {
					...(chartObj.params || {}),
					showPdBounds: 1,
					pdMethod: pdFields.pdMethod.value,
					pdTimeKey: pdFields.pdTimeKey.value,
					pdtype: pdFields.pdtype.value,
					pdDirect: pdFields.pdDirect.value,
					pdConverse: pdFields.pdConverse.value,
					pdAntiscia: pdFields.pdAntiscia.value,
					pdTerms: pdFields.pdTerms.value,
					// 解耦八键同步回填:否则 [主限法设置] 段的「弧算法/盘面宫制/框架/平行…」恒显默认,
					// 与真正参与复算的 fieldParams 口径不一致(显示≠所算)。
					pdProjection: pdFields.pdProjection.value !== undefined ? pdFields.pdProjection.value : 'ptolemy',
					pdFrame: pdFields.pdFrame.value !== undefined ? pdFields.pdFrame.value : 'alcabitius',
					pdFramework: pdFields.pdFramework.value !== undefined ? pdFields.pdFramework.value : 'aspect',
					pdParallel: pdFields.pdParallel.value !== undefined ? pdFields.pdParallel.value : 0,
					pdRaptParallel: pdFields.pdRaptParallel.value !== undefined ? pdFields.pdRaptParallel.value : 0,
					pdTimeKeyCustom: pdFields.pdTimeKeyCustom.value !== undefined ? pdFields.pdTimeKeyCustom.value : 0,
					pdSignificators: Array.isArray(pdFields.pdSignificators.value) ? pdFields.pdSignificators.value : [],
					pdPromissorTypes: Array.isArray(pdFields.pdPromissorTypes.value) ? pdFields.pdPromissorTypes.value : [],
				},
			};
			return buildPrimaryDirectSnapshotText(snapshotChartObj) || '';
		}
		case 'primarydirchart': {
			// 主限法·盘（P5 从表格 fallthrough 拆出）：取本命西洋盘 → 把「所选时刻」换算成主限年龄弧 → 出真盘快照
			// （[主限法盘设置] 段，含时间选择/推运方法/度数换算/向运方向/当前Arc）。修原盘喂表格的 Bug。
			// 挂载齿轮可调 时间(datetime,空=此刻)/方位法/度数换算/向运方向 → record.* → opts（缺省=现状）。
			const chartObj = await fetchChartResultForRecord(record);
			if(!chartObj){
				return '';
			}
			return (await buildPrimaryDirChartSnapshotText(chartObj, {
				datetime: record.datetime,
				pdMethod: record.pdMethod,
				pdTimeKey: record.pdTimeKey,
				direction: record.direction,
			})) || '';
		}
		case 'profection':
		case 'solararc':
		case 'solarreturn':
		case 'lunarreturn':
		case 'givenyear': {
			// 目标时刻型推运：取本命西洋盘后按「此刻」起该期推运（POST /predict/<key>）。
			// 挂载齿轮可调 目标时刻/步进/容许/南北交逆移（returns 另加异地 dirLat/dirLon/dirZone）→ record.* → opts
			//（未改时 undefined，builder 回默认 此刻/年/1/false/本命经纬=现状）。
			const chartObj = await fetchChartResultForRecord(record);
			return chartObj ? (await buildPredictivePeriodSnapshot(chartObj, normalizeTechniqueKey(key), {
				datetime: record.datetime,
				tmType: record.tmType,
				asporb: record.asporb,
				nodeRetrograde: record.nodeRetrograde,
				dirLat: record.dirLat,
				dirLon: record.dirLon,
				dirZone: record.dirZone,
				// P4 区间扫描：end 非空且 step 有值 → 循环多段（每段一个推运时点）；缺省=单点=现状。
				datetimeEnd: record.datetimeEnd,
				scanStep: record.scanStep,
			}) || '') : '';
		}
		case 'zodialrelease': {
			// 黄道星释：取本命盘后 fetch /predict/zr，福点基点 + L1 全列概览。
			// 挂载齿轮可调 推运基点/输出层级/逐层钻取 → record.* → opts（未改时 undefined，builder 回默认 福点/L1全=现状）。
			const chartObj = await fetchChartResultForRecord(record);
			return chartObj ? (await buildZodialReleaseSnapshotText(chartObj, {
				basePoint: record.basePoint,
				aiMode: record.aiMode,
				aiL1Idx: record.aiL1Idx,
				aiL2Idx: record.aiL2Idx,
				aiL3Idx: record.aiL3Idx,
			}) || '') : '';
		}
		case 'decennials': {
			// 十年大运：纯前端 buildDecennialTimeline（默认设置）+ L1 全列概览。
			// 挂载齿轮可调 起运/次序/日限/历法/输出层级 → record.* → opts（未改时 undefined，builder 回默认=现状）。
			const chartObj = await fetchChartResultForRecord(record);
			return chartObj ? (buildDecennialsSnapshotText(chartObj, {
				startMode: record.startMode,
				orderType: record.orderType,
				dayMethod: record.dayMethod,
				calendarType: record.calendarType,
				aiMode: record.aiMode,
				aiL1Idx: record.aiL1Idx,
				aiL2Idx: record.aiL2Idx,
				aiL3Idx: record.aiL3Idx,
			}) || '') : '';
		}
		case 'guolao':
			// 七政四余：命度/罗计沿用已保存设置，显示全部传统星曜。
			return await buildGuolaoSnapshotForFields(buildFieldObject(record));
		case 'suzhan': {
			// 宿占：宿盘随标准西洋盘的二十八宿数据生成，显示全部传统星曜。
			const chartObj = await fetchChartResultForRecord(record);
			const fo = buildFieldObject(record);
			// [X1·P2-11] 外盘/盘型两行与页面快照同源:record 不存此两键,回退 SZConst 持久化默认
			// (页面侧同一来源;此前重算路径恒缺两行,遁甲外盘标注承诺在挂载失效)。
			if(!fo.szchart){ fo.szchart = { value: SZChartDefaults.chart }; }
			if(!fo.szshape){ fo.szshape = { value: SZChartDefaults.shape }; }
			// [M-4] 事盘源(divTime 兜底)时自声明起盘方式,防事时被误读为生时。
			return chartObj ? annotateCaseTimeAsChartBase(buildSuzhanSnapshotText(chartObj, fo, null) || '', record) : '';
		}
		case 'germany': {
			// 量化盘（中点盘）。齿轮 uranian 键('' 已被 prune)→ dispOverride 覆盖全局显示仓。
			const gOv = {};
			// school 白名单闸:record.school 可能被别技法(八字流派)写入 → 非 uranian 四派值一律不透传,
			// 防 schoolToBackendParams 吃到 'fuyi' 之类外域值。
			if(['classic', 'pure', 'uranian', 'cosmo'].indexOf(record.school) >= 0){ gOv.school = record.school; }
			if(record.orb !== undefined && record.orb !== null && record.orb !== '' && Number.isFinite(Number(record.orb))){ gOv.orb = Number(record.orb); }
			if(record.orbPersonal !== undefined && record.orbPersonal !== null && record.orbPersonal !== '' && Number.isFinite(Number(record.orbPersonal))){ gOv.orbPersonal = Number(record.orbPersonal); }
			['strictFactors', 'showDeclination', 'showHouseFrames', 'showEastPoint'].forEach((k)=>{
				const v = record[k];
				if(v !== undefined && v !== null && v !== ''){ gOv[k] = (v === 1 || v === '1' || v === true); }
			});
			return await buildGermanySnapshotForFields(buildFieldObject(record), Object.keys(gOv).length ? gOv : undefined);
		}
		case 'babylon': {
			// 巴比伦占星:恒星黄道(毕宿锚)headless 复算;builder 动态载入(数据表 ~40KB 不入饿链)。
			const m = await import(/* webpackChunkName: "babylon-snapshot" */ './babylonAiSnapshot');
			// 齿轮派系口径 → buildHoroscope opts(builder 第二参早已在收,曾恒空 {} = 恒 swiss/A10 基线;
			// 页面派系是 state 不落档,齿轮为唯一持久入口)。缺省不组 opts = 现状字节零回归。
			const hasBab = ['babylonScheme', 'babylonEphemerisSource', 'babylonSolstice', 'babylonEra']
				.some((k)=>record[k] !== undefined && record[k] !== null && record[k] !== '');
			if(!hasBab){
				return await m.buildBabylonSnapshotForFields(buildFieldObject(record));
			}
			const bs = await import(/* webpackChunkName: "babylon-snapshot" */ '../divination/babylon/babylonSchools');
			const sid = (record.babylonScheme && `${record.babylonScheme}`) || 'swissA10';
			const bOv = {};
			if(record.babylonEphemerisSource){ bOv.ephemerisSource = record.babylonEphemerisSource; }
			if(record.babylonSolstice){ bOv.solstice = record.babylonSolstice; }
			if(record.babylonEra){ bOv.era = record.babylonEra; }
			const sc = bs.schemeOf(sid);
			const bOpts = {
				...bs.judgeOpts(sid, bOv),
				ephemerisSource: bOv.ephemerisSource || sc.backend.ephemerisSource,
				solstice: bOv.solstice || sc.backend.solstice,
				schemeCn: sc.cn,
			};
			return await m.buildBabylonSnapshotForFields(buildFieldObject(record), bOpts);
		}
		case 'canping':
			// 邵子参评数（数算）：纯前端，按本盘出生四柱起本命 + 大运。
			// 挂载齿轮可调 取法(明法/古法) → record.method → opts（未改时 undefined，builder 回默认 ming=现状）。
			return await buildCanpingSnapshotForRecord(record, { method: record.method });
		case 'zhengchuan':
			// 神数正传（数算）：纯前端。挂载齿轮可调 流派/求测时辰/父母年龄/元运/虚岁 → record.* → opts。
			// 未改时 undefined，builder 回默认（铁板 + 本人时柱作求测时辰）＝现状。
			return await buildZhengChuanSnapshotForRecord(record, {
				school: record.zcSchool, askGz: record.zcAskGz,
				fatherAge: record.zcFatherAge, motherAge: record.zcMotherAge, yuan: record.zcYuan,
				dadingYear: record.zcDadingYear, age: record.zcAge,
				dayun: record.zcDayun, xiaoyun: record.zcXiaoyun, suijun: record.zcSuijun,
				askHourZhi: record.zcAskHourZhi, env: record.zcEnv,
				item: record.zcItem, sound: record.zcSound, ke: record.zcKe, gong: record.zcGong,
				xqZhi: record.zcXqZhi, xqYushu: record.zcXqYushu,
			});
		case 'heluo':
			// 河洛理数（数算）：纯前端，按本盘出生四柱起先后天卦 + 大限 + 命运篇判断。
			// 挂载齿轮可调 取化工法 → record.quHuaGong → opts（未改时 undefined，builder 走 st=null 月支近似=现状）。
			return await buildHeluoSnapshotForRecord(record, { quHuaGong: record.quHuaGong });
		case 'yizhangjing':
			// 一掌经（其他/命）：纯前端；挂载齿轮可调十项流派开关 → record.* → opts（未改回秘传默认）。
			return await buildYizhangjingSnapshotForRecord(record, {
				shunniRule: record.shunniRule, mingGongMethod: record.mingGongMethod,
				dayunLength: record.dayunLength, dayunStartAge: record.dayunStartAge,
				xiaoxianStart: record.xiaoxianStart, xiaoxianDir: record.xiaoxianDir,
				annualMethod: record.annualMethod, flowShenSet: record.flowShenSet,
				chongfanKou: record.chongfanKou, dingYue: record.dingYue, leapRule: record.leapRule,
				starNaming: record.starNaming, daoTerm: record.daoTerm, gradeSet: record.gradeSet,
				zaoZiAdjust: record.zaoZiAdjust, tongxianShow: record.tongxianShow, shenshaLayer: record.shenshaLayer,
			});
		case 'xianqin':
			// 演禽（禽星）：经 ken 后端按出生数据起盘;入式历法/农历锚点齿轮与页面 buildPayload 同键。
			return await buildKinAstroSnapshotForFields(buildFieldObject(record), 'xianqin',
				{ ...kinGenderOverride(record), ...pickKin(record, ['calendarMode', 'lunarYear', 'lunarMonth', 'lunarDay']) });
		case 'cetian':
			// 策天飞星：经 ken 后端按出生数据起盘。schema 是 payload 类但键登记在
			// ANALYSIS_CHART_TECHNIQUES(A 类分派) → 8 个排盘选项经 record.* 落到这里,
			// 必须显式透传进 payload,否则齿轮全是死开关(见 buildKinAstroSnapshotForFields 注)。
			return await buildKinAstroSnapshotForFields(buildFieldObject(record), 'cetian', {
				...kinGenderOverride(record),
				method: record.method,
				lunarMode: record.lunarMode,
				starOrder: record.starOrder,
				showBrightness: record.showBrightness,
				showWuXingJu: record.showWuXingJu,
				showSihua: record.showSihua,
				showFlying: record.showFlying,
				showSolarTerm: record.showSolarTerm,
				// 书法(移语本)口径/流年/显示开关 —— 与左栏/buildPayload/schema 三方同键(缺一=挂载死齿轮)
				brightnessSchool: record.brightnessSchool,
				shenGongMode: record.shenGongMode,
				daxianMode: record.daxianMode,
				tianluoMode: record.tianluoMode,
				palaceNameMode: record.palaceNameMode,
				liunianYear: record.liunianYear,
				liunianQishaMode: record.liunianQishaMode,
				showLiunian: record.showLiunian,
				showShensha: record.showShensha,
				showZaYao: record.showZaYao,
				showDuanjue: record.showDuanjue,
				showXiu: record.showXiu,
				showBianyao: record.showBianyao,
			});
		// kinastro 系七技法:同 xianqin/cetian 管道;齿轮键与页面 buildPayload 同名,pickKin 只透非空
		// (''=按盘面/后端自出,与 buildKinAstroSnapshotForFields 的 ''/null 跳过口径一致 = 零回归)。
		// gender 随档:页面恒下发 normBinaryGender,无头曾从不发 → 女命记录挂载按男算(beiji/nanji/chunzi 男女异盘)。
		case 'qizhengkin':
			return await buildKinAstroSnapshotForFields(buildFieldObject(record), 'qizhengkin', kinGenderOverride(record));
		case 'shaozi':
			return await buildKinAstroSnapshotForFields(buildFieldObject(record), 'shaozi',
				{ ...kinGenderOverride(record), ...pickKin(record, ['ke', 'useKey']) });
		case 'tieban':
			return await buildKinAstroSnapshotForFields(buildFieldObject(record), 'tieban',
				{ ...kinGenderOverride(record), ...pickKin(record, ['method', 'startAge', 'dayunSteps', 'ke', 'useKey', 'tiebanSchool', 'tiebanKeSystem', 'tiebanKe']) });
		case 'fendjing':
			return await buildKinAstroSnapshotForFields(buildFieldObject(record), 'fendjing',
				{ ...kinGenderOverride(record), ...pickKin(record, ['stemOverride', 'yearStem', 'hourStem']) });
		case 'beiji':
			return await buildKinAstroSnapshotForFields(buildFieldObject(record), 'beiji',
				{ ...kinGenderOverride(record), ...pickKin(record, ['beijiKeMode', 'beijiKe', 'beijiLookupCode', 'beijiKeyword']) });
		case 'nanji':
			return await buildKinAstroSnapshotForFields(buildFieldObject(record), 'nanji',
				{ ...kinGenderOverride(record), ...pickKin(record, ['nanjiMode', 'nanjiAfterLichun', 'nanjiLunarYear', 'nanjiSolarMonth', 'nanjiDay', 'nanjiHourZhi', 'nanjiDayGan', 'nanjiDayZhi', 'nanjiSection', 'nanjiJianchu', 'nanjiXiu', 'nanjiPasswordCode', 'nanjiChart', 'nanjiPalace', 'nanjiDegree']) });
		case 'chunzi':
			return await buildKinAstroSnapshotForFields(buildFieldObject(record), 'chunzi',
				{ ...kinGenderOverride(record), ...pickKin(record, ['chunziKeMode', 'chunziKe', 'chunziLunarMode', 'chunziLunarMonth', 'chunziLunarDay', 'chunziLookupCode', 'chunziKeyword', 'chunziTags', 'chunziMansion', 'chunziHourBranch', 'chunziResultLimit']) });
		case 'huangji': {
			// 皇极经世：经 ken 后端起元会运世盘;record 顶层同名设置(若有)透传,缺=默认零回归。
			// [M-4] 事盘源(divTime 兜底)时自声明起盘方式(以事时值年推演=卜法语义)。
			// [V6 二轮复查] 🔴 事盘源存档在 payload.options.{...,xinyiOptions.*}(B 路 case 同款
			// hv 打底)——此前 A 路只读 record.* ⇒ 只拨一个齿轮时,未拨的存档设置(所推之年/篇目)
			// 全体回默认。齿轮(record 平铺)优先、存档打底,与 B 路 :1398 同序。
			const hp = (()=>{ try{ const r = record && record.payload; const pp = typeof r === 'string' ? JSON.parse(r) : r; return pp && typeof pp === 'object' ? pp : {}; }catch(_e){ return {}; } })();
			const ho = (hp.options && typeof hp.options === 'object') ? hp.options : {};
			const hx = (ho.xinyiOptions && typeof ho.xinyiOptions === 'object') ? ho.xinyiOptions : {};
			const hv = (top, saved)=>(top !== undefined && top !== null && top !== '' ? top : saved);
			return annotateCaseTimeAsChartBase(await buildHuangJiSnapshotForFields(buildFieldObject(record), {
				classicKey: hv(record.classicKey, ho.classicKey),
				historyYear: hv(record.historyYear, ho.historyYear),
				classicSectionIndex: hv(record.classicSectionIndex, ho.classicSectionIndex),
				xinyiMethod: hv(record.xinyiMethod, hx.method),
				upperNum: hv(record.upperNum, hx.upperNum), lowerNum: hv(record.lowerNum, hx.lowerNum),
				upperStrokes: hv(record.upperStrokes, hx.upperStrokes), lowerStrokes: hv(record.lowerStrokes, hx.lowerStrokes),
				objectGua: hv(record.objectGua, hx.objectGua), direction: hv(record.direction, hx.direction),
			}), record);
		}
		default:
			return '';
		}
	}catch(e){
		return '';
	}
}

// (summarizeCasePayload 已迁 aiAnalysisSources.js —— 顶部 import)

function summarizeCaseMeta(record){
	const lines = [];
	const meta = getCaseTypeMeta(record.caseType);
	lines.push(`案例名称：${record.event || '未命名案例'}`);
	lines.push(`案例类型：${getCaseTypeLabel(record.caseType)}`);
	lines.push(`所属模块：${record.sourceModule || meta.module || meta.value || ''}`);
	if(record.divTime){
		lines.push(`占断时间：${record.divTime}`);
	}
	if(record.zone){
		lines.push(`时区：${record.zone}`);
	}
	if(record.pos){
		lines.push(`地点：${record.pos}`);
	}
	const tags = normalizeTags(record.group);
	if(tags.length){
		lines.push(`标签：${tags.join('、')}`);
	}
	return lines.join('\n').trim();
}

// (extractCaseSnapshotText / listAnalysisSources 已迁 aiAnalysisSources.js —— 顶部 import/re-export。)

function parseAstroSnapshotSignature(signature){
	const raw = `${signature || ''}`.trim();
	if(!raw){
		return null;
	}
	const parts = raw.split('|');
	return {
		chartId: `${parts[0] || ''}`.trim(),
		birth: `${parts[1] || ''}`.trim(),
		zone: `${parts[2] || ''}`.trim(),
		lon: `${parts[3] || ''}`.trim(),
		lat: `${parts[4] || ''}`.trim(),
		zodiacal: `${parts[5] || ''}`.trim(),
		hsys: `${parts[6] || ''}`.trim(),
		// parts[7]=isDiurnal、parts[8]=onlyRulerExalt（不参与匹配）；parts[9]=恒星黄道 ayanāṃśa（新增，旧签名缺→''）。
		siderealAyanamsa: `${parts[9] || ''}`.trim(),
		// [V6-W1] parts[10]/[11]=宫制/黄道**数字位**(与 record 同数轴,精确失效判定;旧签名缺→''=守卫跳过)。
		// parts[5]/[6] 的文本位是后端 echo(拼写不与前端表同构),仅存展示用途,不参与匹配。
		hsysNum: `${parts[10] || ''}`.trim(),
		zodiacalNum: `${parts[11] || ''}`.trim(),
		// [V6 二轮复查] parts[12]/[13]=择宫传统/界系数字位(同范式向后兼容;其余齿轮走覆盖路径
		// 无条件重算,不经本守卫 —— 本守卫只管「默认路径复用已存快照」的失效判定)。
		traditionNum: `${parts[12] || ''}`.trim(),
		termsVariantNum: `${parts[13] || ''}`.trim(),
		// [0e] parts[14]=古典口径 overrides JSON 段(签名侧 createAstroSnapshotSignature 同位):
		// 改燃烧上界/空亡口径/三分集等 22 键任一 → 段串变 → 精确失效。旧签名缺位→''=守卫跳过。
		classicalOv: `${parts[14] || ''}`.trim(),
	};
}

function normalizeSnapshotMatchText(value){
	return `${value || ''}`.trim();
}

function hasMatchingSavedAstroSnapshot(record){
	if(!record){
		return null;
	}
	const snapshot = loadAstroAISnapshot();
	if(!snapshot || !snapshot.content){
		return null;
	}
	const parsed = parseAstroSnapshotSignature(snapshot.signature);
	if(!parsed){
		return null;
	}
	const birth = normalizeSnapshotMatchText(record.birth);
	const zone = normalizeSnapshotMatchText(record.zone || '+08:00');
	const lon = normalizeSnapshotMatchText(record.lon);
	const lat = normalizeSnapshotMatchText(record.lat);
	if(parsed.birth && birth && parsed.birth !== birth){
		return null;
	}
	if(parsed.zone && zone && parsed.zone !== zone){
		return null;
	}
	if(parsed.lon && lon && parsed.lon !== lon){
		return null;
	}
	if(parsed.lat && lat && parsed.lat !== lat){
		return null;
	}
	if(!(parsed.birth || parsed.zone || parsed.lon || parsed.lat)){
		return null;
	}
	// 恒星黄道 ayanāṃśa 变更须使旧快照失效：两侧都有非空 ayanāṃśa 且不同 → 不复用（重新抓取）。
	// 仅「都非空且不同」才拦截：旧签名/回归盘/默认恒星 ayanāṃśa 为空 → 跳过 → 向后兼容（最坏多抓一次，绝不误用旧盘）。
	const recAyan = normalizeSnapshotMatchText(record.siderealAyanamsa);
	if(parsed.siderealAyanamsa && recAyan && parsed.siderealAyanamsa !== recAyan){
		return null;
	}
	// [V6-W1] 🔴 宫制/黄道入比对(用户实锤根因 B):命盘页按别的宫制画盘落的旧快照曾被整份复用。
	// 比对用签名 parts[10]/[11] 的**数字位**(与 record 同数轴;parts[5]/[6] 文本位是后端 echo,
	// 拼写与前端表不同构不可比)。旧签名无数字位 → '' → 跳过(向后兼容,siderealAyanamsa 同范式;
	// 最坏复用一次旧快照,该盘下一次保存/重算即带新签名进入精确判定)。
	// record 缺省按全站默认归一(hsys 缺省=1/zodiacal 缺省=0),避免「缺省 vs 显式同值」误杀。
	const recHsys = `${record.hsys !== undefined && record.hsys !== null ? record.hsys : 1}`;
	if(parsed.hsysNum && parsed.hsysNum !== recHsys){
		return null;
	}
	const recZodiacal = `${record.zodiacal !== undefined && record.zodiacal !== null ? record.zodiacal : 0}`;
	if(parsed.zodiacalNum && parsed.zodiacalNum !== recZodiacal){
		return null;
	}
	// [V6 二轮复查] 择宫传统/界系两键改正文最重(界主/接纳/古典段),同范式比对;record 缺省
	// 归一 0=buildFieldObject 回退与页面初值同源。旧签名缺位 '' 跳过(向后兼容)。
	const recTradition = `${record.tradition !== undefined && record.tradition !== null ? record.tradition : 0}`;
	if(parsed.traditionNum && parsed.traditionNum !== recTradition){
		return null;
	}
	const recTermsVariant = `${record.termsVariant !== undefined && record.termsVariant !== null ? record.termsVariant : 0}`;
	if(parsed.termsVariantNum && parsed.termsVariantNum !== recTermsVariant){
		return null;
	}
	// [0e] 古典口径段比对:record 缺键=「随全局」(buildFieldObject 同款回退),故基准=全局仓打底、
	// record 平铺键覆盖,再经请求体单源归一成 JSON 串(两侧同函数产键,插入序固定=串稳定)。
	// 旧签名缺位 ''=跳过(hsysNum 同范式,向后兼容;最坏复用一次,下一次保存即进精确判定)。
	if(parsed.classicalOv){
		const g = getClassicalChartGlobals();
		const merged = { ...g };
		Object.keys(CLASSICAL_GLOBAL_DEFAULTS).forEach((k) => {
			if(record[k] !== undefined && record[k] !== null){ merged[k] = record[k]; }
		});
		// [R2-7] 随盘界表表体非 spec 键,上面循环带不进——显式 overlay,否则外机自定义表记录
		// 比对侧落到本机仓表,与签名侧(随盘表)恒不等 → 该类记录快照永不命中缓存。
		['customTermsDay', 'customTermsNight'].forEach((k) => {
			if(Array.isArray(record[k])){ merged[k] = record[k]; }
		});
		const recOv = JSON.stringify({
			...classicalBackendOverridesFromPlain(merged),
			...classicalSnapshotNeverSig((k) => merged[k]),
		});
		if(parsed.classicalOv !== recOv){
			return null;
		}
	}
	return snapshot;
}

// G10 空亡古典义:读 app 全局态(星盘设置「空亡古典义(30°内)」开关,非命盘 record 字段),与 AstroAnalysisLab.load
// 透传 voidClassical 同口径 → AI 快照[古典格局]·相位动态·空亡 行与右栏一致。默认 0(且 app 重载不持久 → 复位 0)
// 等价于不发该参(后端缺键即本座义)→ 默认/未开用户字节级零回归。读态失败一律回 0(降级)。
function liveVoidClassical(){
	try{
		const st = getStore();
		const app = st && st.app ? st.app : null;
		return app && (app.voidClassical === 1 || app.voidClassical === '1' || app.voidClassical === true) ? 1 : 0;
	}catch(e){
		return 0;
	}
}

// 古典格局派生分析(analyze_chart)按需 fetch — 优雅降级(失败/异常返回 '',不影响 AI 主体)。
// ~50ms 级(仅极区 heliacal 才慢),只在 AI 实际取数时拉,绝不进每盘预建快照 → 信息tab 不受拖累。
async function fetchClassicalAnalysisSection(params){
	// 守 (HIGH-5):缺 date/zone/lat/lon 任一都静默 skip,后端必校验,缺则 4xx 易经 silent 漏到顶栏。
	if(!params || !params.date || !params.zone || params.lat === undefined || params.lat === null || params.lon === undefined || params.lon === null){
		return '';
	}
	try{
		// voidClassical 默认 0 → 与 AstroAnalysisLab 同参;后端缺键=本座义=现状,默认用户零回归。
		const vc = liveVoidClassical();
		// 恒星轨读全局仓(此前硬编 1° → 用户在星盘设置改恒星轨后,AI 古典段与主盘恒星集漂移)。
		const reqBody = { _v: 'cls1', ...params, fixedStarOrb: classicalGlobalValue('fixedStarOrb') };   // [SURF] 缓存代次盐
		if(vc){ reqBody.voidClassical = true; }
		const data = await request(`${Constants.ServerRoot}/astroextra/analysis`, {
			body: JSON.stringify(reqBody),
			silent: true,
			timeoutMs: 20000,
		});
		const analysis = data && data.Result ? data.Result : data;
		return buildClassicalAnalysisSection(analysis) || '';
	}catch(e){
		return '';
	}
}

async function buildChartContext(source){
	const record = source && source.record ? source.record : null;
	if(!record){
		throw new Error('chart.source.required');
	}
	const fields = buildFieldObject(record);
	const params = fieldParams(fields);
	let content;
	let meta;
	const saved = hasMatchingSavedAstroSnapshot(record);
	if(saved){
		content = `${saved.content || ''}`.trim();
		meta = {
			sourceType: 'chart',
			sourceId: source.id,
			birth: record.birth || '',
			zone: record.zone || '',
			reusedStoredSnapshot: true,
		};
	}else{
		// 修(HIGH-6):fetchChart 失败时不再 throw(原代码 throw 上传至 AI 主流程 → 红屏「构造命盘上下文失败」)。
		// 优雅退化:返回空 content + reused-snapshot-style meta,AI 可降级使用既有片段或提示用户。
		let rsp = null;
		try{
			rsp = await fetchChart({ ...params, includePrimaryDirection: false }, { silent: true, timeoutMs: 20000 });
		}catch(e){
			rsp = null;
		}
		content = (rsp && rsp.Result) ? `${buildAstroSnapshotContent(rsp.Result, fields, { classicalDerived: true }) || ''}`.trim() : '';   // astrochart 挂载与本命保存链同口径(衍化四段)
		meta = {
			sourceType: 'chart',
			sourceId: source.id,
			birth: record.birth || '',
			zone: record.zone || '',
			chartFetchFailed: !(rsp && rsp.Result),
		};
	}
	// 古典格局派生分析(护卫/优势相位/相位动态/逐题主星/偶然尊贵/恒星/行星时/埃及历/巴比伦)按需拼入 → AI 挂载不遗漏。
	const analysisSection = await fetchClassicalAnalysisSection(params);
	if(analysisSection){
		content = `${content}\n\n${analysisSection}`.trim();
	}
	return {
		content,
		title: source.title,
		module: 'astrochart',
		meta,
		// [V6-W2] 🔴 激活 dayBoundaryRule 强制层的死分支:该层「优先用案例自带开关值」的读取点
		// (sourceContext.after23NewDay)此前无任何 builder 供给 → 恒回退全局 localStorage ——
		// 盘存非默认日界时,强制层标注与正文四柱口径分叉(对 AI 撒谎)。现按 record 实值供给。
		...(record.after23NewDay !== undefined && record.after23NewDay !== null ? { after23NewDay: record.after23NewDay } : {}),
		...(record.lateZiHourUseNextDay !== undefined && record.lateZiHourUseNextDay !== null ? { lateZiHourUseNextDay: record.lateZiHourUseNextDay } : {}),
	};
}

function buildChartMetaContext(source){
	const record = source && source.record ? source.record : null;
	if(!record){
		throw new Error('chart.source.required');
	}
	const lines = [];
	lines.push(`命盘名称：${source.title || record.name || '未命名命盘'}`);
	lines.push('案例类型：命盘');
	if(record.birth){
		lines.push(`出生时间：${record.birth}`);
	}
	if(record.zone){
		lines.push(`时区：${record.zone}`);
	}
	if(record.lon || record.lat){
		lines.push(`经纬度：${record.lon || ''} ${record.lat || ''}`.trim());
	}
	if(record.pos){
		lines.push(`地点：${record.pos}`);
	}
	const tags = normalizeTags(record.group);
	if(tags.length){
		lines.push(`标签：${tags.join('、')}`);
	}
	return {
		content: lines.join('\n').trim(),
		title: source.title,
		module: 'chart_meta',
		meta: {
			sourceType: 'chart',
			sourceId: source.id,
			birth: record.birth || '',
			zone: record.zone || '',
			metaOnly: true,
		},
	};
}

async function buildCaseContext(source){
	const record = source && source.record ? source.record : null;
	if(!record){
		throw new Error('case.source.required');
	}
	const extracted = extractCaseSnapshotText(record);
	if(extracted.content && extracted.snapshotStatus === 'ready'){
		return {
			content: extracted.content,
			title: source.title,
			module: extracted.moduleName,
			meta: {
				sourceType: 'case',
				sourceId: source.id,
				caseType: record.caseType,
				divTime: record.divTime,
			},
		};
	}
	// Part F：事盘只从自身 payload 重建文本（用起盘结果，不碰时间），不读全局模块缓存
	// （那是「上次看过的某一卦」，会挂出与所选事盘对不上的内容），也不按时间重新起盘。
	const generated = generateCaseTechniqueSnapshot(record, extracted.moduleName, extracted.payload);
	if(generated){
		saveGeneratedTechniqueSnapshot(extracted.moduleName, generated, record);
		return {
			content: generated,
			title: source.title,
			module: extracted.moduleName,
			meta: {
				sourceType: 'case',
				sourceId: source.id,
				caseType: record.caseType,
				divTime: record.divTime,
				generatedFromStoredCase: true,
			},
		};
	}
	// [V6-W2] 事盘侧同供日界口径(payload.fieldSnapshot 是存案时的口径快照,存案保真战役已接):
	// 让 dayBoundaryRule 强制层读到该盘存档口径而非全局现值。
	let dayRule = {};
	try{
		const pl = typeof record.payload === 'string' ? JSON.parse(record.payload) : record.payload;
		const fs = pl && pl.fieldSnapshot && typeof pl.fieldSnapshot === 'object' ? pl.fieldSnapshot : null;
		if(fs){
			dayRule = {
				...(fs.after23NewDay !== undefined && fs.after23NewDay !== null ? { after23NewDay: fs.after23NewDay } : {}),
				...(fs.lateZiHourUseNextDay !== undefined && fs.lateZiHourUseNextDay !== null ? { lateZiHourUseNextDay: fs.lateZiHourUseNextDay } : {}),
			};
		}
	}catch(_e){
		dayRule = {};
	}
	return {
		content: extracted.content,
		title: source.title,
		module: extracted.moduleName,
		meta: {
			sourceType: 'case',
			sourceId: source.id,
			caseType: record.caseType,
			divTime: record.divTime,
		},
		...dayRule,
	};
}

function buildCaseMetaContext(source){
	const record = source && source.record ? source.record : null;
	if(!record){
		throw new Error('case.source.required');
	}
	return {
		content: summarizeCaseMeta(record),
		title: source.title,
		module: source.module || record.sourceModule || getCaseTypeMeta(record.caseType).module,
		meta: {
			sourceType: 'case',
			sourceId: source.id,
			caseType: record.caseType,
			divTime: record.divTime,
			metaOnly: true,
		},
	};
}

function normalizeTechniqueKey(key){
	const text = `${key || ''}`.trim();
	if(!text){
		return '';
	}
	if(text === 'liuyao' || text === 'guazhan'){
		return 'sixyao';
	}
	if(text === 'dunjia'){
		return 'qimen';
	}
	if(text === 'germanytech'){
		return 'germany';
	}
	if(text === 'hellenastro' || text === 'locastro'){
		return 'astrochart_like';
	}
	if(text === 'relativechart'){
		return 'relative';
	}
	if(text === 'jieqichart'){
		return 'jieqi';
	}
	if(text === 'chart13'){
		return 'astrochart_like';
	}
	return text;
}

function getTechniqueLabel(key){
	return ANALYSIS_TECHNIQUE_LABELS[normalizeTechniqueKey(key)] || `${key || ''}`.trim();
}

export function getTechniqueAliasList(moduleName){
	const name = normalizeTechniqueKey(moduleName);
	if(!name){
		return [];
	}
	const set = new Set([name]);
	if(name === 'sixyao'){
		set.add('guazhan');
		set.add('liuyao');
	}
	if(name === 'qimen'){
		set.add('dunjia');
	}
	if(name === 'primarydirect' || name === 'primarydirchart'){
		set.add('direction');
		set.add('primarydirect');
		set.add('primarydirchart');
	}
	if(name === 'zodialrelease'){
		set.add('zodiacrelease');
	}
	if(name === 'decennials'){
		set.add('decennial');
	}
	if(name === 'germany'){
		set.add('germanytech');
	}
	if(name === 'relative'){
		set.add('relativechart');
	}
	if(name === 'astrochart_like'){
		set.add('hellenastro');
		set.add('locastro');
		set.add('chart13');
	}
	if(name === 'indiachart'){
		set.add('indiachart_current');
	}
	if(name === 'jieqi'){
		set.add('jieqi_current');
		set.add('jieqi_meta');
		set.add('jieqi_chunfen');
		set.add('jieqi_xiazhi');
		set.add('jieqi_qiufen');
		set.add('jieqi_dongzhi');
	}
	if(name === 'calendar'){
		// 黄历四子 tab 各自独立快照，AI 分析挂载须一并纳入（老黄历/通书择日/日子馆）。
		set.add('calendar-huangli');
		set.add('calendar-tongshu');
		set.add('calendar-rizi');
	}
	return Array.from(set);
}

function normalizeDateText(value){
	const raw = `${value || ''}`.trim();
	if(!raw){
		return '';
	}
	const matched = raw.match(/^(-?\d+)[-/](\d{1,2})[-/](\d{1,2})/);
	if(!matched){
		return raw.replace(/-/g, '/');
	}
	return `${matched[1]}/${matched[2].padStart(2, '0')}/${matched[3].padStart(2, '0')}`;
}

function normalizeMinuteTime(value){
	const raw = `${value || ''}`.trim();
	if(!raw){
		return '';
	}
	const matched = raw.match(/^(\d{1,2}):(\d{2})/);
	if(!matched){
		return raw;
	}
	return `${matched[1].padStart(2, '0')}:${matched[2]}`;
}

function buildSourceSignature(source){
	const record = source && source.record ? source.record : null;
	if(!record){
		return {
			date: '',
			time: '',
			zone: '',
			lon: '',
			lat: '',
		};
	}
	const rawTime = source.sourceType === 'chart' ? record.birth : (record.divTime || record.updateTime || '');
	const matched = `${rawTime || ''}`.trim().match(/^(-?\d+)-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
	if(!matched){
		return {
			date: normalizeDateText(rawTime),
			time: normalizeMinuteTime(rawTime),
			zone: `${record.zone || ''}`.trim(),
			lon: `${record.lon || ''}`.trim(),
			lat: `${record.lat || ''}`.trim(),
		};
	}
	return {
		date: `${matched[1]}/${matched[2]}/${matched[3]}`,
		time: normalizeMinuteTime(`${matched[4] || '00'}:${matched[5] || '00'}:${matched[6] || '00'}`),
		zone: `${record.zone || ''}`.trim(),
		lon: `${record.lon || ''}`.trim(),
		lat: `${record.lat || ''}`.trim(),
	};
}

function isSnapshotMetaCompatible(snapshotMeta, source){
	if(!snapshotMeta || typeof snapshotMeta !== 'object'){
		return true;
	}
	const current = buildSourceSignature(source);
	const snapDate = normalizeDateText(snapshotMeta.date || snapshotMeta.birth || '');
	if(current.date && snapDate && current.date !== snapDate){
		return false;
	}
	const snapTime = normalizeMinuteTime(snapshotMeta.time || '');
	if(current.time && snapTime && current.time !== snapTime){
		return false;
	}
	const snapZone = `${snapshotMeta.zone || ''}`.trim();
	if(current.zone && snapZone && current.zone !== snapZone){
		return false;
	}
	const snapLon = `${snapshotMeta.lon || ''}`.trim();
	if(current.lon && snapLon && current.lon !== snapLon){
		return false;
	}
	const snapLat = `${snapshotMeta.lat || ''}`.trim();
	if(current.lat && snapLat && current.lat !== snapLat){
		return false;
	}
	return true;
}

// (extractSnapshotText 已迁 aiAnalysisSources.js —— 顶部 import)

function pickSnapshotCandidate(candidates){
	// 拒绝与当前案例出生/起盘签名明确不匹配的候选，避免挂载到「上次看过的那张盘」。
	// generated 候选恒为 compatible:true；payload/cache 候选由 isSnapshotMetaCompatible 判定（源签名为空时为 true，不误伤）。
	const valid = (candidates || []).filter((item)=>item && item.content && item.compatible !== false);
	if(!valid.length){
		return null;
	}
	valid.sort((a, b)=>{
		const sa = a.specificity || 0;
		const sb = b.specificity || 0;
		if(sa !== sb){
			return sb - sa;
		}
		if(Boolean(a.compatible) !== Boolean(b.compatible)){
			return a.compatible ? -1 : 1;
		}
		if(Boolean(a.fromPayload) !== Boolean(b.fromPayload)){
			return a.fromPayload ? -1 : 1;
		}
		const ta = Date.parse(a.createdAt || '') || 0;
		const tb = Date.parse(b.createdAt || '') || 0;
		if(ta !== tb){
			return tb - ta;
		}
		return `${b.content || ''}`.length - `${a.content || ''}`.length;
	});
	return valid[0];
}

function getTechniqueSnapshotFromPayload(payload, moduleName, source){
	if(!payload || typeof payload !== 'object'){
		return null;
	}
	const aliases = getTechniqueAliasList(moduleName);
	const aliasSet = new Set(aliases);
	const record = source && source.record ? source.record : null;
	const primaryPayloadKey = normalizeTechniqueKey(
		payload.module
		|| payload.moduleName
		|| payload.sourceModule
		|| (record && (record.sourceModule || record.caseType || record.chartType))
		|| ''
	);
	const genericSnapshotMatchesRequest = !primaryPayloadKey || aliasSet.has(primaryPayloadKey);
	const candidates = [];
	const pushCandidate = (raw, extra = {})=>{
		const content = extractSnapshotText(raw);
		if(!content){
			return;
		}
		candidates.push({
			content,
			createdAt: extra.createdAt || '',
			meta: extra.meta || {},
			compatible: isSnapshotMetaCompatible(extra.meta, source),
			fromPayload: true,
			specificity: extra.specificity || 0,
		});
	};
	if(genericSnapshotMatchesRequest){
		pushCandidate(payload.snapshot, {
			meta: payload.meta || {},
			createdAt: payload.createdAt || '',
			specificity: 0,
		});
	}
	if(payload.module && aliasSet.has(normalizeTechniqueKey(payload.module))){
		pushCandidate(payload.snapshot, {
			meta: payload.meta || {},
			createdAt: payload.createdAt || '',
			specificity: 1,
		});
	}
	aliases.forEach((alias, idx)=>{
		const aliasSpecificity = Math.max(2, 40 - idx);
		const moduleSpecificity = Math.max(3, 60 - idx);
		if(payload[alias] !== undefined){
			pushCandidate(payload[alias], {
				meta: payload.meta || {},
				createdAt: payload.createdAt || '',
				specificity: aliasSpecificity,
			});
		}
		const moduleSnapshots = payload.moduleSnapshots && typeof payload.moduleSnapshots === 'object' ? payload.moduleSnapshots : null;
		if(moduleSnapshots && moduleSnapshots[alias] !== undefined){
			pushCandidate(moduleSnapshots[alias], {
				meta: moduleSnapshots[alias] && moduleSnapshots[alias].meta ? moduleSnapshots[alias].meta : payload.meta || {},
				createdAt: moduleSnapshots[alias] && moduleSnapshots[alias].createdAt ? moduleSnapshots[alias].createdAt : payload.createdAt || '',
				specificity: moduleSpecificity,
			});
		}
		const modules = payload.modules && typeof payload.modules === 'object' ? payload.modules : null;
		if(modules && modules[alias] !== undefined){
			pushCandidate(modules[alias], {
				meta: modules[alias] && modules[alias].meta ? modules[alias].meta : payload.meta || {},
				createdAt: modules[alias] && modules[alias].createdAt ? modules[alias].createdAt : payload.createdAt || '',
				specificity: moduleSpecificity,
			});
		}
	});
	const snapshots = payload.snapshots && typeof payload.snapshots === 'object' ? payload.snapshots : null;
	if(snapshots){
		Object.keys(snapshots).forEach((rawKey)=>{
			const key = `${rawKey || ''}`.trim();
			if(!key){
				return;
			}
			const suffix = key.indexOf(MODULE_SNAPSHOT_PREFIX) === 0 ? key.substring(MODULE_SNAPSHOT_PREFIX.length) : key;
			if(!aliasSet.has(normalizeTechniqueKey(suffix))){
				return;
			}
			pushCandidate(snapshots[rawKey], {
				meta: snapshots[rawKey] && snapshots[rawKey].meta ? snapshots[rawKey].meta : payload.meta || {},
				createdAt: snapshots[rawKey] && snapshots[rawKey].createdAt ? snapshots[rawKey].createdAt : payload.createdAt || '',
				specificity: 3,
			});
		});
	}
	return pickSnapshotCandidate(candidates);
}

// 全局模块缓存 `horosa.ai.snapshot.module.v1.<module>` 本质是「上次算过的某一张盘/卦」（key 不含出生时间）。
// 复用它【只能在签名确凿匹配当前源时】，否则宁可回退按本盘出生数据重算，也绝不挂错盘。
// 与宽松的 isSnapshotMetaCompatible 不同：这里要求 date 双方都有且相等（date 是最强身份位）；
// 缺签名 / 单边为空一律判不确凿（false），交由 buildTechniqueContext 走重算分支。
function isCacheSnapshotConfidentMatch(snapshotMeta, source){
	if(!snapshotMeta || typeof snapshotMeta !== 'object'){
		return false;
	}
	const current = buildSourceSignature(source);
	const snapDate = normalizeDateText(snapshotMeta.date || snapshotMeta.birth || '');
	if(!current.date || !snapDate || current.date !== snapDate){
		return false;
	}
	const snapTime = normalizeMinuteTime(snapshotMeta.time || '');
	if(current.time && snapTime && current.time !== snapTime){
		return false;
	}
	const snapZone = `${snapshotMeta.zone || ''}`.trim();
	if(current.zone && snapZone && current.zone !== snapZone){
		return false;
	}
	const snapLon = `${snapshotMeta.lon || ''}`.trim();
	if(current.lon && snapLon && current.lon !== snapLon){
		return false;
	}
	const snapLat = `${snapshotMeta.lat || ''}`.trim();
	if(current.lat && snapLat && current.lat !== snapLat){
		return false;
	}
	return true;
}

function getTechniqueSnapshotFromCache(moduleName, source){
	const aliases = getTechniqueAliasList(moduleName);
	const candidates = aliases.map((alias, idx)=>{
		const snapshot = loadModuleAISnapshot(alias);
		if(!snapshot || !snapshot.content){
			return null;
		}
		return {
			content: snapshot.content,
			createdAt: snapshot.createdAt || '',
			meta: snapshot.meta || {},
			compatible: isCacheSnapshotConfidentMatch(snapshot.meta, source),
			fromPayload: false,
			specificity: Math.max(2, 40 - idx),
		};
	}).filter(Boolean);
	return pickSnapshotCandidate(candidates);
}

async function buildTechniqueContext(source, techniqueKey, baseSourceContext){
	const key = normalizeTechniqueKey(techniqueKey);
	if(!source || !key){
		return null;
	}
	const label = getTechniqueLabel(key);
	const canReuseBaseSourceContext = baseSourceContext
		&& baseSourceContext.content
		&& !(baseSourceContext.meta && baseSourceContext.meta.metaOnly);
	if(source.sourceType === 'chart' && (key === 'astrochart' || key === 'astrochart_like')){
		const ctx = canReuseBaseSourceContext ? baseSourceContext : await buildChartContext(source);
		return {
			key,
			title: label,
			module: key,
			content: ctx && ctx.content ? ctx.content : '',
			available: !!(ctx && ctx.content),
			status: ctx && ctx.content ? 'ready' : 'missing',
			meta: ctx && ctx.meta ? ctx.meta : {},
		};
	}
	const record = source.record || null;
	const payload = record && record.payload ? safeParseJson(record.payload, null) : null;
	const fromPayload = getTechniqueSnapshotFromPayload(payload, key, source);
	let generated = null;
	if(source.sourceType === 'timepoint'){
		// 「起课时间」入口：纯时间 + 地点，没有「已存的卦」→ 时间确定式法按默认设置即时起盘；
		// 六爻在此入口走「时间起卦」(确定性，时间即输入)；统摄法等非纯时间可推的不在白名单。
		let timeText = '';
		if(TIMEPOINT_CASTABLE_SET.has(key)){
			timeText = await regenerateCaseTechniqueSnapshot(record, key, payload);
			if(timeText){
				saveGeneratedTechniqueSnapshot(key, timeText, record, { generatedFromTimepoint: true });
			}
		}
		return {
			key,
			title: label,
			module: key,
			content: timeText || '',
			available: !!timeText,
			status: timeText ? 'ready' : 'missing',
			meta: timeText ? buildSnapshotMetaFromRecord(record, { generatedFromTimepoint: true }) : {},
		};
	}
	if(source.sourceType === 'case'){
		// 事盘：优先用本案例 payload 重建文本（不读全局模块缓存——那是「上次看过的某一卦」）。
		// 若 payload 未存该技法：时间确定式法（六壬/金口诀/奇门/太乙/三式）按本案例起课时间 + 默认【即时补算】，
		// 像命盘一样而非显示「未挂载」。六爻：已存 payload.gua 优先（generateCaseTechniqueSnapshot 读存卦、不被时间覆盖）；
		// 无存卦时按本案例起课时间【时间起卦】补（用户拍板：时间起卦是六爻确定性合法起法、非伪造摇卦）——故 sixyao 显式纳入
		// 补算条件，但**仍不进 TIME_CASTABLE_DIVINATION**（保 preflight[24] 护栏：防其它批量路径凭空补六爻）。
		if(!(fromPayload && fromPayload.content)){
			let generatedText = generateCaseTechniqueSnapshot(record, key, payload);
			let genFlag = { generatedFromStoredCase: true };
			if(!generatedText && (TIME_CASTABLE_SET.has(key) || key === 'sixyao')){
				generatedText = await regenerateCaseTechniqueSnapshot(record, key, payload);
				genFlag = { regeneratedFromCaseTime: true };
			}
			if(generatedText){
				saveGeneratedTechniqueSnapshot(key, generatedText, record, genFlag);
				generated = {
					content: generatedText,
					createdAt: new Date().toISOString(),
					meta: buildSnapshotMetaFromRecord(record, genFlag),
					compatible: true,
					fromPayload: false,
					specificity: 4,
				};
			}
		}
		const pickedCase = pickSnapshotCandidate([fromPayload, generated]);
		return {
			key,
			title: label,
			module: key,
			content: pickedCase && pickedCase.content ? pickedCase.content : '',
			available: !!(pickedCase && pickedCase.content),
			status: pickedCase && pickedCase.content ? 'ready' : 'missing',
			meta: pickedCase && pickedCase.meta ? pickedCase.meta : {},
		};
	}
	// [D2] 合盘特判:须两张盘,无法由单命主 record 无头复算 —— 快照单源=合盘页所存模块快照
	// (AstroRelative componentDidUpdate 对 tab/关系/两盘/结果全 watch,选项一改即重存,故不陈旧)。
	// meta 带 chartA/chartB 名,与当前命主是否相关由用户/AI 自辨(快照首段有关系起盘信息)。
	if(key === 'relative'){
		let mounted = null;
		try{ mounted = loadModuleAISnapshot('relative'); }catch(_){ mounted = null; }
		const mContent = mounted && mounted.content && `${mounted.content}`.trim() ? mounted.content : ''; // 非空即可(与 getTechniqueSnapshotFromCache 同口径,不设长度阈)
		return {
			key,
			title: label,
			module: key,
			content: mContent,
			available: !!mContent,
			status: mContent ? 'ready' : 'missing',
			meta: (mounted && mounted.meta) || {},
		};
	}
	// 命盘（chart）：payload 命中优先；否则查兼容缓存（A1 已过滤掉不匹配的盘）；
	// 仍无则按本盘出生数据无头复算（Part A）。
	const fromCache = getTechniqueSnapshotFromCache(key, source);
	if(!(fromPayload && fromPayload.content) && !(fromCache && fromCache.content)){
		const generatedText = await regenerateChartTechniqueSnapshot(record, key);
		if(generatedText){
			saveGeneratedTechniqueSnapshot(key, generatedText, record, {
				generatedFromChart: true,
			});
			generated = {
				content: generatedText,
				createdAt: new Date().toISOString(),
				meta: buildSnapshotMetaFromRecord(record, {
					generatedFromChart: true,
				}),
				compatible: true,
				fromPayload: false,
				specificity: 5,
			};
		}
	}
	const picked = pickSnapshotCandidate([fromPayload, fromCache, generated]);
	return {
		key,
		title: label,
		module: key,
		content: picked && picked.content ? picked.content : '',
		available: !!(picked && picked.content),
		status: picked && picked.content ? 'ready' : 'missing',
		meta: picked && picked.meta ? picked.meta : {},
	};
}

function isChartTechnique(key){
	return ANALYSIS_CHART_TECHNIQUES.indexOf(normalizeTechniqueKey(key)) >= 0;
}

// 命盘星盘(astrochart / astrochart_like)按 record(含挂载覆盖字段)强制重起西洋盘 → 出快照正文。
// 不走 buildChartContext 的「已存快照复用」(那会无视新设置)，与 buildChartContext 同一 fetch+build 口径。
async function regenerateAstroChartSnapshot(record){
	const fields = buildFieldObject(record);
	const params = fieldParams(fields);
	const rsp = await fetchChart({
		...params,
		includePrimaryDirection: false,
	}, {
		silent: true,
		timeoutMs: 20000,
	});
	if(!rsp || !rsp.Result){
		return '';
	}
	let content = `${buildAstroSnapshotContent(rsp.Result, fields, { classicalDerived: true }) || ''}`.trim();   // astrochart 挂载齿轮重算同口径(衍化四段)
	// [V6-W1] 🔴 与 buildChartContext 同源补齐:默认路径尾部会拼「古典格局派生分析」整段
	// (护卫/优势相位/相位动态/逐题主星/偶然尊贵/恒星/行星时/埃及历/巴比伦),此前齿轮重算
	// 路径漏拼 → 一动挂载设置该整段消失(极易被读成「重算失败」)。
	try{
		const analysisSection = await fetchClassicalAnalysisSection(params);
		if(analysisSection){
			content = `${content}\n\n${analysisSection}`.trim();
		}
	}catch(_e){
		// 派生段失败不阻断主体快照(与默认路径同容错)。
	}
	return content;
}

// AI 挂载「每技法设置」核心入口。
// options 非空 → 强制按新设置重算该技法快照（绕过 payload/cache 命中），返回 status='regenerated' 的技法上下文；
// options 为空 → 直接走原 buildTechniqueContext（默认即现状，一行不改默认路径，守「默认即现状」铁律）。

export async function getAnalysisTechniqueContextWithOptions(source, techniqueKey, options, baseSourceContext){
	const key = normalizeTechniqueKey(techniqueKey);
	if(!source || !key){
		return null;
	}
	const schema = getTechniqueSettingsSchema(key);
	const record = source.record || {};
	// [V6-W1] 🔴 覆盖判定的比较锚=盘现状,不再是裸 schema 默认:盘存 hsys=1 时用户选 0(整宫制)
	// =真覆盖 → 必须重算;此前锚 schema 默认(恰为 0)把它当「无覆盖」直接走默认路径(用户实锤)。
	// [V6 二轮复查] 锚收敛 effectiveMountBaseline 单源(UI 抽屉与重算入口同一双眼睛):
	// A 类=record 平铺 ?? 现状默认(globalCurrent 种子键读全局现值);B 类=payload 存档段
	// (baselineSource 认存档层,六爻 gua.* 同款);C 类=record 长名 ?? 全局 storageKey 现值;
	// chartRoute(cetian/huangji)=存档段打底+平铺覆盖。四叉此前散在两文件各自实现,漂移即分叉。
	const overrideBaseline = effectiveMountBaseline(key, record);
	const opts = pruneOptionsToNonDefault(key, options || {}, overrideBaseline);
	const hasOverride = opts && Object.keys(opts).length > 0;
	if(!hasOverride || !schema || schema.kind === 'sectionsOnly'){
		return buildTechniqueContext(source, key, baseSourceContext); // 默认路径,零行为变化
	}
	const label = getTechniqueLabel(key);
	let text = '';
	let regenError = null;
	try{
		if(schema.kind === 'localStorage'){
			// C 类:临时写全局显示选项(builder 自读)强制重算,用毕 finally 还原现值——
			// 与紫微流派「临时切换 + 用毕还原」同口径;否则一次挂载覆盖会永久改写
			// 用户的七政全局设置(命度/罗计/宿度制),且渗入 doubingSu28 共享请求。
			const prior = snapshotLocalStorageSettings(key);
			try{
				applyLocalStorageSettings(key, opts);
				text = await regenerateChartTechniqueSnapshot(mergeOptionsIntoRecord(record, key, opts), key);
			}finally{
				restoreLocalStorageSettings(prior);
			}
		}else if(isChartTechnique(key)){
			// A 类:把 options merge 进 record.*(buildFieldObject 读)，强制重算。
			// [M-4 定谳] 本分支只查 isChartTechnique、不看 source 类型:事盘源 + 双栖技法(suzhan/huangji)
			// 会走命盘管道、以 divTime 兜底起盘——以事发时刻起盘是卜法正统语义(horary 同构),非缺陷;
			// 快照内由 annotateCaseTimeAsChartBase 自声明起盘方式,防 AI 把事时误读为出生时。
			const mergedRecord = mergeOptionsIntoRecord(record, key, opts);
			if(key === 'astrochart' || key === 'astrochart_like'){
				text = await regenerateAstroChartSnapshot(mergedRecord);
			}else{
				text = await regenerateChartTechniqueSnapshot(mergedRecord, key);
			}
		}else{
			// B 类:把 options 叠进 payload，强制走 regenerateCaseTechniqueSnapshot。
			const payload = record && record.payload ? safeParseJson(record.payload, null) : null;
			const mergedPayload = mergeOptionsIntoPayload(payload || {}, key, opts);
			text = await regenerateCaseTechniqueSnapshot(record, key, mergedPayload);
		}
	}catch(e){
		// [V6-W3 闸5] 吞异常曾致「覆盖重算失败」与「本无快照」同貌(status 都落 missing),
		// 排障只能盲猜——留日志+独立 error 态,UI 端据此给「重算失败」而非「自动补生成」提示。
		text = '';
		regenError = e;
		console.warn('[aiAnalysis] 挂载覆盖重算失败', key, e);
	}
	// 🔒 覆盖结果只回传、绝不写共享模块缓存（saveGeneratedTechniqueSnapshot）：否则会污染该技法槽，命盘默认路径
	// buildTechniqueContext(读 getTechniqueSnapshotFromCache，isCacheSnapshotConfidentMatch 只比生辰、不看 mountOverride)
	// 会读到这条旧覆盖、跳过默认重算 → 用户「恢复默认/清除覆盖」后卡片不回退、且连带污染 AI 导出/储存读到的"最近快照"。
	// 覆盖本就每次按 options 无条件重算（上方），不需缓存；与事盘路径"不读全局缓存"口径一致。「设为同类默认」的持久化
	// 走 saveMountTechniqueDefaults(settings) 而非此缓存。改动前先读本注释——别把 save 加回来。
	return {
		key,
		title: label,
		module: key,
		content: text || '',
		available: !!text,
		status: text ? 'regenerated' : (regenError ? 'error' : 'missing'),
		meta: text ? buildSnapshotMetaFromRecord(record, { mountOverride: true }) : {},
	};
}

export function listAnalysisTechniqueOptions(source){
	let keys;
	if(source && source.sourceType === 'timepoint'){
		// 起课时间源:直接展开 TIMEPOINT_CASTABLE_SET 单源(此前手抄清单与集 drift——
		// 小六壬/飞宫在可起集内却不在下拉=「新技法无法挂载」的根因;单源后入集即入下拉,
		// 黄历/通书/私有扩展亦由集内成员自然带出,不再逐处补抄)。
		keys = [...TIMEPOINT_CASTABLE_SET];
	}else if(source && source.sourceType === 'case'){
		keys = ANALYSIS_CASE_TECHNIQUES;
	}else{
		keys = ANALYSIS_CHART_TECHNIQUES;
	}
	return keys.map((key)=>({
		value: key,
		label: getTechniqueLabel(key),
	}));
}

// 组合包用：与 source 无关的「全技法」选项（命盘类 + 事盘类去重），供组合编辑时预选默认挂载技法。
export function listAllAnalysisTechniqueOptions(){
	const seen = new Set();
	const out = [];
	[...ANALYSIS_CHART_TECHNIQUES, ...ANALYSIS_CASE_TECHNIQUES].forEach((key)=>{
		if(seen.has(key)){
			return;
		}
		seen.add(key);
		out.push({ value: key, label: getTechniqueLabel(key) });
	});
	return out;
}

export async function getAnalysisTechniqueContexts(source, techniqueKeys, options = {}){
	if(!source){
		return [];
	}
	const keys = Array.from(new Set((techniqueKeys || []).map((item)=>normalizeTechniqueKey(item)).filter(Boolean)));
	if(!keys.length){
		return [];
	}
	const baseSourceContext = options.sourceContext || null;
	// 「每技法设置」覆盖映射 {[key]:optionsObj}。某技法有非默认覆盖 → 走强制重算入口；否则走默认 buildTechniqueContext。
	const techniqueOptions = options.techniqueOptions && typeof options.techniqueOptions === 'object'
		? options.techniqueOptions : null;
	const results = [];
	for(let i = 0; i < keys.length; i += 1){
		const k = keys[i];
		const overrideOpts = techniqueOptions && techniqueOptions[k] && typeof techniqueOptions[k] === 'object'
			? techniqueOptions[k] : null;
		// eslint-disable-next-line no-await-in-loop
		const context = overrideOpts
			? await getAnalysisTechniqueContextWithOptions(source, k, overrideOpts, baseSourceContext)
			: await buildTechniqueContext(source, k, baseSourceContext);
		if(context){
			// AI 挂载复用「AI导出设置」的按技法选段（达成四同步）。仅当用户显式自定义该技法段时才过滤，否则原样（默认即现状）。
			if(context.content){
				try{
					const before = context.content;
					const filterKey = context.key || k;
					// [YF v45] 段过滤后串「星曜后天信息」开关(与导出主链同序同语义;非 planetInfo 技法原样)。
					context.content = applyPlanetInfoFilterByContext(
						applyAIExportSectionFilterToSnapshot(filterKey, context.content), filterKey);
					// 原文非空但过滤后为空 = 用户在「纳入内容」显式全清 → 打标供挂载卡诚实提示
					// (区别于「快照缺失」),内容置空自然不进 AI prompt(buildContextLayers 跳空 content)。
					if(`${before || ''}`.trim() && !`${context.content || ''}`.trim()){
						context.sectionsCleared = true;
					}
				}catch(e){ /* 过滤失败保持原文 */ }
			}
			results.push(context);
		}
	}
	return results;
}

// 「起课时间」源的前提上下文：纯时间 + 地点的简短说明（技法快照各自携带正文）。
function buildTimepointContext(source){
	const record = source && source.record ? source.record : {};
	const lines = ['起课时间盘（按所选时间 + 默认设置即时起盘）'];
	if(record.divTime){ lines.push(`起课时间：${record.divTime}`); }
	if(record.zone){ lines.push(`时区：${record.zone}`); }
	if(record.lon || record.lat){ lines.push(`地点：经 ${record.lon || '—'} / 纬 ${record.lat || '—'}`); }
	return {
		content: lines.join('\n').trim(),
		title: source.title,
		module: 'timepoint',
		meta: buildSnapshotMetaFromRecord(record, { sourceType: 'timepoint', sourceId: source.id }),
	};
}

// [YF v45] 源上下文(full 模式)也过「纳入内容」段过滤 —— 补上此前的裸奔面:
// 无挂载技法时事盘/命盘走 source 前提层全文直发,用户在「纳入内容」取消的段照喂 AI(设置形同虚设)。
// 过滤採「读出后过滤」:contextCache 永远存原文,返回前按**当下**设置过滤 → 改设置即刻生效、
// 缓存零失效问题(与技法层 getAnalysisTechniqueContexts 同款成功模式);meta/timepoint 模式无段语义不滤。
function filterSourceContextBySections(ctx, source, mode){
	if(!ctx || !ctx.content || mode === 'meta' || (source && source.sourceType === 'timepoint')){
		return ctx;
	}
	const key = exportSettingKeyForSnapshotModule(ctx.module);
	if(!key){
		return ctx;
	}
	try{
		const before = ctx.content;
		const filtered = applyPlanetInfoFilterByContext(applyAIExportSectionFilterToSnapshot(key, before), key);
		if(filtered === before){
			return ctx;
		}
		const out = { ...ctx, content: filtered };
		// 原文非空但过滤后空 = 显式全清 → 打标供卡片诚实提示(与技法卡同语义)。
		if(`${before || ''}`.trim() && !`${filtered || ''}`.trim()){
			out.sectionsCleared = true;
		}
		return out;
	}catch(e){
		return ctx;
	}
}

export async function getAnalysisSourceContext(source, options = {}){
	if(!source){
		return null;
	}
	const mode = options.mode === 'meta' ? 'meta' : 'full';
	const cacheId = `${source.sourceType}:${source.id}:${mode}`;
	const preferCache = options.preferCache !== false;
	const shouldPreferCache = preferCache
		&& source.sourceType !== 'timepoint'
		&& !(source.sourceType === 'case' && source.snapshotStatus !== 'ready');
	if(shouldPreferCache){
		const cached = await getStoreRecord(AI_ANALYSIS_STORES.contextCache, cacheId);
		if(cached && cached.sourceUpdatedAt === source.updatedAt && cached.content){
			return filterSourceContextBySections(cached, source, mode);
		}
	}
	let built;
	if(source.sourceType === 'timepoint'){
		built = buildTimepointContext(source);
	}else if(mode === 'meta'){
		built = source.sourceType === 'chart' ? buildChartMetaContext(source) : buildCaseMetaContext(source);
	}else{
		built = source.sourceType === 'chart' ? await buildChartContext(source) : await buildCaseContext(source);
	}
	const next = {
		id: cacheId,
		sourceId: source.id,
		sourceType: source.sourceType,
		title: source.title,
		module: built.module,
		content: built.content,
		meta: built.meta || {},
		sourceUpdatedAt: source.updatedAt || '',
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};
	await putStoreRecord(AI_ANALYSIS_STORES.contextCache, next, 'ctx');
	return filterSourceContextBySections(next, source, mode);
}

// [挂载预算] token 估算分 CJK/其他两桶:中文≈1.6 字/token,ASCII≈4 字/token。
// 旧版一刀切 /4 对中文低估 ~2.5 倍,预算判断全线失真。
export function estimateTextTokens(text){
	const raw = `${text || ''}`.trim();
	if(!raw) return 0;
	let cjk = 0;
	for(let i = 0; i < raw.length; i++){
		const c = raw.charCodeAt(i);
		if((c >= 0x2E80 && c <= 0x9FFF) || (c >= 0xF900 && c <= 0xFAFF) || (c >= 0xFF00 && c <= 0xFFEF) || (c >= 0x3000 && c <= 0x303F)){
			cjk++;
		}
	}
	const other = raw.length - cjk;
	return Math.ceil(cjk / 1.6 + other / 4);
}

// [挂载健康] 快照↔当前案例底盘核对:比对快照 meta(各技法存快照时带的起盘时空)与案例
// record 的出生/起课字段。返回 'match' | 'mismatch' | 'unknown'。纪律「宁漏勿误伤」:
// 任一侧信息不足即 unknown(绝不报警);时间裁到分钟、坐标/时区圆到 1 位小数再比,
// 消格式噪声。事盘快照 meta 通常无出生位 → 天然 unknown,恒不按时间妄断。
export function snapshotSourceMismatch(meta, record){
	if(!meta || typeof meta !== 'object' || !record || typeof record !== 'object'){
		return 'unknown';
	}
	const normNum = (v)=>{
		const n = Number(v);
		return Number.isFinite(n) ? n.toFixed(1) : null;
	};
	const normWhen = (v)=>`${v || ''}`.trim().replace('T', ' ').slice(0, 16);
	const cmp = [];
	const metaWhen = normWhen(meta.birth || meta.divTime || [meta.date, meta.time].filter(Boolean).join(' '));
	const recWhen = normWhen(record.birth || record.divTime || '');
	if(metaWhen && recWhen){
		cmp.push([metaWhen, recWhen]);
	}
	const pairs = [['zone', 'zone'], ['lon', 'lon'], ['lat', 'lat']];
	pairs.forEach(([mk, rk])=>{
		const a = normNum(meta[mk]);
		const b = normNum(record[rk]);
		if(a != null && b != null){
			cmp.push([a, b]);
		}
	});
	if(!cmp.length){
		return 'unknown';
	}
	return cmp.every(([a, b])=>a === b) ? 'match' : 'mismatch';
}

export function buildContextLayers({
	sourceContext,
	techniqueContexts,
	materials,
	bundles,
	templates,
	retrievedChunks,
	conversationMessages,
	systemPrompt,
}) {
	const layers = [];
	layers.push({
		key: 'system',
		title: '系统提示',
		priority: 100,
		content: systemPrompt || '你是星阙的 AI 分析助手。请严格依据当前案例上下文、参考资料与回复模版作答。',
	});
	if(sourceContext && sourceContext.content){
		layers.push({
			key: 'source',
			title: `案例前提：${sourceContext.title || ''}`,
			priority: 95,
			content: sourceContext.content,
		});
	}
	// v2.2.1:把「日界点·晚子时」排盘规则作为 first-class 上下文稳定挂载,
	// 让 AI 知道四柱按哪种换日/起时干规则计算,不会误读 23:00–23:59 的日柱/时柱。
	// 优先用案例自带的开关值(命盘 fields / 事盘 payload),否则回退全局设置。
	{
		const a23 = sourceContext && sourceContext.after23NewDay !== undefined
			? sourceContext.after23NewDay : defaultAfter23NewDay();
		const lzh = sourceContext && sourceContext.lateZiHourUseNextDay !== undefined
			? sourceContext.lateZiHourUseNextDay : defaultLateZiHourUseNextDay();
		const meta = buildDayBoundaryMeta(a23, lzh);
		layers.push({
			key: 'dayBoundaryRule',
			title: '排盘规则（日界点·晚子时）',
			priority: 94,
			content: meta.note,
		});
	}
	(techniqueContexts || []).forEach((item, idx)=>{
		if(!item || !item.content){
			return;
		}
		if(sourceContext && sourceContext.content && item.content === sourceContext.content){
			return;
		}
		layers.push({
			key: `technique:${item.key || idx}`,
			title: `使用技法：${item.title || item.key || `技法 ${idx + 1}`}`,
			priority: 93 - idx,
			content: item.content,
		});
	});
	(bundles || []).forEach((bundle)=>{
		if(bundle.defaultSystemPrompt){
			layers.push({
				key: `bundle-system:${bundle.id}`,
				title: `组合系统提示：${bundle.name || ''}`,
				priority: 92,
				content: bundle.defaultSystemPrompt,
			});
		}
	});
	(templates || []).forEach((template)=>{
		const text = template && template.format === 'json'
			? [template.instructionText, template.jsonSchema && `JSON Schema：\n${template.jsonSchema}`].filter(Boolean).join('\n\n')
			: (template && (template.instructionText || template.content));
		if(text){
			layers.push({
				key: `template:${template.id}`,
				title: `模版约束：${template.name || ''}`,
				priority: 90,
				content: text,
			});
		}
	});
	const directMaterials = (materials || []).filter((item)=>!item.retrievedOnly);
	directMaterials.forEach((item, idx)=>{
		if(item.extractedText){
			layers.push({
				key: `material:${item.id}`,
				title: `参考资料 ${idx + 1}：${item.name || '未命名资料'}`,
				priority: 70,
				content: item.extractedText,
			});
		}
	});
	if(Array.isArray(retrievedChunks) && retrievedChunks.length){
		const retrievedText = buildRetrievedContextText(retrievedChunks);
		if(retrievedText){
			layers.push({
				key: 'retrieved-context',
				title: '检索资料片段',
				priority: 80,
				content: retrievedText,
			});
		}
	}
	// [挂载预算] 近期对话从「硬拿末 10 条」改为 token 预算滚动裁剪:由新往旧收,超预算即止;
	// 保底 4 条(最近两轮问答再长也带上),上限 40 条防级联。短消息会话可带更多轮,
	// 长消息会话不再被 10 条巨文吃穿预算。
	const allVisible = (conversationMessages || []).filter((item)=>item && item.role !== 'system_hidden');
	const HISTORY_TOKEN_BUDGET = 4000;
	const HISTORY_MIN_KEEP = 4;
	const HISTORY_MAX_KEEP = 40;
	const pickedHistory = [];
	let histTokens = 0;
	for(let i = allVisible.length - 1; i >= 0 && pickedHistory.length < HISTORY_MAX_KEEP; i--){
		const m = allVisible[i];
		const t = estimateTextTokens(`${m.content || ''}`);
		if(pickedHistory.length >= HISTORY_MIN_KEEP && histTokens + t > HISTORY_TOKEN_BUDGET){
			break;
		}
		pickedHistory.push(m);
		histTokens += t;
	}
	const visibleHistory = pickedHistory.reverse();
	if(visibleHistory.length){
		layers.push({
			key: 'recent-history',
			title: '最近对话',
			priority: 60,
			content: visibleHistory.map((item)=>`[${item.role}] ${item.content || ''}`).join('\n\n'),
		});
	}
	return layers.map((item)=>({
		...item,
		tokenEstimate: estimateTextTokens(item.content),
	}));
}

// [挂载预算] 旧版部分裁剪 marker（legacy 分支 / 无段结构回退共用，字面与历史输出逐字节一致）。
const LEGACY_CLIP_MARKER = '\n...[已裁剪]';
// fairShare 下每个技法层的保底字数：低于它宁可整层记入 dropped（绝不静默丢）。
const MIN_TECH_KEEP = 600;
// fairShare 下给非技法的 rest 层（模版/资料/检索/历史）预留的尾仓比例。
const RESERVE_TAIL_RATIO = 0.15;

// [挂载预算] 段对齐裁剪：按 [段] 边界整段收纳（尾注计入预算，产出总长 ≤ budget）；
// 无 [段] 结构时回退字符 slice + 旧 marker（slice 点为 budget 减 marker 长，同样不超预算）。
function clipContentToBudget(content, budget){
	const sections = splitContentSections(content);
	const hasSectionStructure = sections.some((sec)=>sec.title);
	if(hasSectionStructure){
		const parts = sections.map((sec)=>sec.lines.join('\n'));
		let cut = 0;
		let used = 0;
		for(let i = 0; i < parts.length; i++){
			const add = parts[i].length + (cut > 0 ? 1 : 0);
			if(used + add > budget){
				break;
			}
			used += add;
			cut = i + 1;
		}
		const buildNote = (cutIdx)=>{
			const omitted = sections.slice(cutIdx);
			const names = omitted.slice(0, 3).map((sec)=>sec.title || '前言');
			const extra = omitted.length > 3 ? '等' : '';
			return `\n...[已裁剪:预算不足,略去${omitted.length}段(${names.join('、')}${extra})]`;
		};
		let note = buildNote(cut);
		while(cut > 0 && parts.slice(0, cut).join('\n').length + note.length > budget){
			cut -= 1;
			note = buildNote(cut);
		}
		if(cut > 0){
			return { text: `${parts.slice(0, cut).join('\n')}${note}`, sectionAligned: true };
		}
		// 一段都放不下 → 落到无段结构的字符 slice 保底。
	}
	return {
		text: `${content.slice(0, Math.max(0, budget - LEGACY_CLIP_MARKER.length))}${LEGACY_CLIP_MARKER}`,
		sectionAligned: false,
	};
}

// [挂载预算] 裁剪主引擎：返回 { kept, dropped, stats }，kept 即旧 clipContextLayers 的输出位。
// - 快路径（总量 ≤ maxChars，含等号）：全保留，与旧算法逐字节等价。
// - 触界且未开 fairShare：旧贪心逻辑原样（输出逐字节等价），仅把被丢层记进 dropped。
// - 触界且 fairShare===true：mandatory 全额优先 → rest 预留尾仓 → 技法层 max-min 水位公平分摊，
//   被裁技法层段对齐裁剪；预算连保底都不够时整层移入 dropped（有账可查，绝不静默）。
export function clipContextLayersDetailed(layers, options = {}){
	const maxChars = options.maxChars || DEFAULT_CONTEXT_CHAR_LIMIT;
	const sorted = (layers || []).slice(0).sort((a, b)=>b.priority - a.priority);
	// 与旧算法同口径：trim 后计长；空层直接忽略（不入 kept 也不入 dropped）。
	const nonEmpty = [];
	sorted.forEach((item)=>{
		const content = `${item.content || ''}`.trim();
		if(content){
			nonEmpty.push({ ...item, content });
		}
	});
	const totalRaw = nonEmpty.reduce((sum, item)=>sum + item.content.length, 0);
	const finalize = (kept, dropped)=>{
		const byKey = {};
		nonEmpty.forEach((item)=>{
			byKey[item.key] = {
				title: item.title,
				raw: item.content.length,
				kept: 0,
				clipped: false,
				dropped: false,
			};
		});
		kept.forEach((item)=>{
			if(byKey[item.key]){
				byKey[item.key].kept = item.content.length;
				byKey[item.key].clipped = !!item.clipped;
			}
		});
		dropped.forEach((item)=>{
			if(byKey[item.key]){
				byKey[item.key].dropped = true;
			}
		});
		return {
			kept,
			dropped,
			stats: {
				maxChars,
				totalRaw,
				totalKept: kept.reduce((sum, item)=>sum + item.content.length, 0),
				keptCount: kept.length,
				clippedCount: kept.filter((item)=>item.clipped).length,
				droppedCount: dropped.length,
				fairShare: options.fairShare === true,
				byKey,
			},
		};
	};
	// 快路径：总量未触界（含等号，与旧 nextChars <= maxChars 语义一致）→ 全保留。
	if(totalRaw <= maxChars){
		return finalize(nonEmpty.map((item)=>({ ...item, clipped: false })), []);
	}
	if(options.fairShare !== true){
		// legacy 分支：旧贪心实现体原样（kept 输出逐字节等价），只额外把被丢层记账。
		const kept = [];
		const dropped = [];
		let totalChars = 0;
		sorted.forEach((item)=>{
			const content = `${item.content || ''}`.trim();
			if(!content){
				return;
			}
			const nextChars = totalChars + content.length;
			if(nextChars <= maxChars){
				kept.push({
					...item,
					content,
					clipped: false,
				});
				totalChars = nextChars;
				return;
			}
			if(kept.length === 0 || item.priority >= 90){
				const remain = Math.max(0, maxChars - totalChars);
				if(remain > 120){
					kept.push({
						...item,
						content: `${content.slice(0, remain)}${LEGACY_CLIP_MARKER}`,
						clipped: true,
					});
					totalChars = maxChars;
					return;
				}
			}
			dropped.push(item);
		});
		return finalize(kept, dropped);
	}
	// fairShare 分支。
	const isTechnique = (item)=>typeof item.key === 'string' && item.key.indexOf('technique:') === 0;
	const mandatory = nonEmpty.filter((item)=>!isTechnique(item) && item.priority >= 94);
	const techLayers = nonEmpty.filter(isTechnique);
	const restLayers = nonEmpty.filter((item)=>!isTechnique(item) && item.priority < 94);
	const kept = [];
	const dropped = [];
	let used = 0;
	// 1) mandatory（系统提示/案例前提/排盘规则）逐层收纳；超限沿用旧部分裁剪语义。
	mandatory.forEach((item)=>{
		if(used + item.content.length <= maxChars){
			kept.push({ ...item, clipped: false });
			used += item.content.length;
			return;
		}
		const remain = Math.max(0, maxChars - used);
		if(remain > 120){
			kept.push({ ...item, content: `${item.content.slice(0, remain)}${LEGACY_CLIP_MARKER}`, clipped: true });
			used = maxChars;
			return;
		}
		dropped.push(item);
	});
	// 2) rest 层尾仓预留：技法层不许吃光全部余量。
	const restTotal = restLayers.reduce((sum, item)=>sum + item.content.length, 0);
	const reserveTail = Math.min(restTotal, Math.floor(maxChars * RESERVE_TAIL_RATIO));
	const techBudget = Math.max(0, maxChars - used - reserveTail);
	// 3) 技法层：预算连每层保底 min(len, MIN_TECH_KEEP) 都给不起时，从 idx 最大者
	//    （priority 最低=挂载顺序最后）整层移入 dropped，直到保底可满足。
	const minNeedOf = (arr)=>arr.reduce((sum, item)=>sum + Math.min(item.content.length, MIN_TECH_KEEP), 0);
	let activeTech = techLayers.slice(0);
	while(activeTech.length && minNeedOf(activeTech) > techBudget){
		let worst = activeTech[0];
		activeTech.forEach((item)=>{
			if(item.priority < worst.priority){
				worst = item;
			}
		});
		activeTech = activeTech.filter((item)=>item !== worst);
		dropped.push(worst);
	}
	// max-min 水位公平分摊：按 content.length 升序，短层全保，长层按水位（不低于保底）截。
	const techAsc = activeTech.slice(0).sort((a, b)=>a.content.length - b.content.length);
	let budgetLeft = techBudget;
	let layersLeft = techAsc.length;
	techAsc.forEach((item)=>{
		const share = layersLeft > 0 ? Math.floor(budgetLeft / layersLeft) : 0;
		const take = Math.min(item.content.length, Math.max(share, MIN_TECH_KEEP));
		const alloc = Math.min(take, budgetLeft);
		if(alloc >= item.content.length){
			kept.push({ ...item, clipped: false });
			budgetLeft -= item.content.length;
		}else{
			const cut = clipContentToBudget(item.content, alloc);
			kept.push({ ...item, content: cut.text, clipped: true });
			budgetLeft -= cut.text.length;
		}
		layersLeft -= 1;
	});
	used += techBudget - budgetLeft;
	// 4) rest 层用余量（尾仓+技法层没花完的水位）按旧贪心顺序（priority 降序）收纳，
	//    装不下按旧语义部分裁剪或记入 dropped。
	restLayers.forEach((item)=>{
		if(used + item.content.length <= maxChars){
			kept.push({ ...item, clipped: false });
			used += item.content.length;
			return;
		}
		if(kept.length === 0 || item.priority >= 90){
			const remain = Math.max(0, maxChars - used);
			if(remain > 120){
				kept.push({ ...item, content: `${item.content.slice(0, remain)}${LEGACY_CLIP_MARKER}`, clipped: true });
				used = maxChars;
				return;
			}
		}
		dropped.push(item);
	});
	// 5) 输出顺序 = 原 priority 降序（稳定排序：同 priority 保持 技法层在 rest 层前，与旧序一致）。
	kept.sort((a, b)=>b.priority - a.priority);
	return finalize(kept, dropped);
}

export function clipContextLayers(layers, options = {}){
	return clipContextLayersDetailed(layers, options).kept;
}

export function buildPromptContext({
	sourceContext,
	techniqueContexts,
	materials,
	bundles,
	templates,
	retrievedChunks,
	conversationMessages,
	systemPrompt,
	maxChars,
	fairShare,
}) {
	const layers = buildContextLayers({
		sourceContext,
		techniqueContexts,
		materials,
		bundles,
		templates,
		retrievedChunks,
		conversationMessages,
		systemPrompt,
	});
	const clippedLayers = clipContextLayers(layers, { maxChars, fairShare });
	return clippedLayers.map((item)=>`${item.title}\n${item.content}`).join('\n\n').trim();
}
