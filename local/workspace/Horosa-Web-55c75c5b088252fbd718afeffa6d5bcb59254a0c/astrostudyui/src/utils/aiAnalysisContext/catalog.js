// AI 分析挂载上下文 · 技法目录与常量:日界规则说明、源层缓存戳、长生五行、合盘与神数正传的按需载入、上下文预算常量、奇门 / 太乙缺省、技法标签与命盘 / 事盘技法清单、可凭时间起的技法集。
// 由 utils/aiAnalysisContext.js 门面统一对外导出。
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../dayBoundary';
import { ASTRO_SNAPSHOT_FORMAT_VERSION } from '../astroAiSnapshot';
import { mountCalibreSignature } from '../mountCalibreSignature';
import { DEFAULT_TAIYI_SCHOOL } from '../../components/taiyi/core/taiyiSchool';
import { GanZiWuXing as LRConst_GanZiWuXing } from '../../components/liureng/LRConst';   // 日干→五行(与页面同一张表)
import { resolveAfter23NewDay, resolveLateZiHourUseNextDay } from '../dayBoundaryResolve';

// 用户拍板·v2.2.1: 给 AI 看的"排盘规则"语义说明,作为 first-class metadata 显式标注。
// 让 GPT/Claude/Ollama 看到 snapshot 时知道四柱按哪种规则计算,不会按错语义解读。
export function buildDayBoundaryMeta(after23NewDay, lateZiHourUseNextDay){
	const a23 = resolveAfter23NewDay(after23NewDay);
	const lzh = resolveLateZiHourUseNextDay(lateZiHourUseNextDay);
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
// 源层上下文缓存记录格式版本(拆段/改表时升;与 ASTRO_SNAPSHOT_FORMAT_VERSION 拼成命中维度)
const SOURCE_CONTEXT_CACHE_FORMAT_VERSION = 1;
// 缓存记录戳(写入/命中同源;测试种子记录也用它):{ formatVersion, calibreSig }
export function sourceContextCacheStamp(){
	const formatVersion = `${SOURCE_CONTEXT_CACHE_FORMAT_VERSION}:${Number(ASTRO_SNAPSHOT_FORMAT_VERSION) || 1}`;
	const calibreSig = mountCalibreSignature();
	return { formatVersion, calibreSig };
}
// 六壬 / 金口诀十二长生五行:'auto' 或缺 = 按本课日干现算(两页缺省都随日干);其余为手选或存档已解析的五行
export function resolveZhangshengElem(wx, liurengResult){
	if(wx && wx !== 'auto'){ return wx; }
	const gan = `${(liurengResult && liurengResult.nongli && liurengResult.nongli.dayGanZi) || ''}`.substr(0, 1);
	return LRConst_GanZiWuXing[gan] || '土';
}
// 合盘快照构建器动态化:静态 import 会把 AstroRelative 整组件锚进饿链(本文件被 eager 主组件引用)
// → 首屏白携带;两处消费均在 async 路径,await import 零语义差(与合盘页 lazy 同 chunk 复用)。
export async function loadBuildRelativeSnapshotText(){
	const m = await import(/* webpackChunkName: "relative-main" */ '../../components/astro/AstroRelative');
	return m.buildRelativeSnapshotText;
}
// 合盘页的古典口径段构造(同一分包,按需载入);载入前缓存键按空段算(与合盘请求体零回归同口径)
let relativeClassicalFn = null;
export async function ensureRelativeClassicalLoaded(){
	if(relativeClassicalFn){ return relativeClassicalFn; }
	const m = await import(/* webpackChunkName: "relative-main" */ '../../components/astro/AstroRelative');
	relativeClassicalFn = m.relativeClassicalParamsFromFields;
	return relativeClassicalFn;
}
export function relativeClassicalParamsOf(fieldObj){
	try{ return relativeClassicalFn ? (relativeClassicalFn(fieldObj) || {}) : {}; }catch(e){ return {}; }
}
// 神数正传:引擎与秘数表(~250KB)按需载入 —— 静态引用会把数据表打进 shared-technique,
// 令从不用此技法的用户也付其代价。builder 本就是 async,await 一次后模块级缓存。
let zcMods = null;
export async function loadZhengChuanMods(){
	if(!zcMods){
		const [tb, sz, dd, lq, xy, sn] = await Promise.all([
			import(/* webpackChunkName: "zhengchuan-engine" */ '../zhengchuanTiebanLocal'),
			import(/* webpackChunkName: "zhengchuan-engine" */ '../zhengchuanShaoziLocal'),
			import(/* webpackChunkName: "zhengchuan-engine" */ '../zhengchuanDadingLocal'),
			import(/* webpackChunkName: "zhengchuan-engine" */ '../zhengchuanLiuqinLocal'),
			import(/* webpackChunkName: "zhengchuan-engine" */ '../zhengchuanXinyiLocal'),
			import(/* webpackChunkName: "zhengchuan-engine" */ '../zhengchuanSnapshot'),
		]);
		zcMods = {
			calcTieban: tb.calcTieban, loadTiebanVerses: tb.loadTiebanVerses,
			calcShaozi: sz.calcShaozi, loadShaoziVerses: sz.loadShaoziVerses,
			deriveDadingYearPillars: dd.deriveDadingYearPillars,
			dadingDeathYear: dd.dadingDeathYear, dadingDeathMonth: dd.dadingDeathMonth,
			calcLiuqin: lq.calcLiuqin, calcXinyi: xy.calcXinyi,
			buildText: sn.buildZhengChuanSnapshotText,
		};
	}
	return zcMods;
}

export const DEFAULT_PD_ASPECTS = [0, 60, 90, 120, 180];
// [挂载预算] 上下文字数预算单一真值：发送路径（AIAnalysisMain）与默认裁剪上限共用，消灭散落的字面量。
// [Windows #80] 20000 → 24000：这是**未知模型**的保底(已知模型按窗口实算)。用户报障那盘挂了四技法，
//   gpt-6-astra 不在模型窗口表里 → 回落保底 → 西占 26085 字被裁到 4334、印占 26803 被裁到 6379，
//   AI 于是如实说「缺 Dasha 表 / 分盘 / 行运」。24000 字 ≈ 15k token，对 ≥32k 窗口的未知模型仍安全。
export const AI_CONTEXT_MAX_CHARS = 24000;
export const DEFAULT_CONTEXT_CHAR_LIMIT = AI_CONTEXT_MAX_CHARS;
// [双盘挂载] 两人之间西洋合盘数据(pair 取数、拼层时裁剪)的字数上限。
export const PAIR_SYNASTRY_MAX_CHARS = 12000;
export const DEFAULT_QIMEN_OPTIONS = {
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
export const DEFAULT_TAIYI_OPTIONS = {
	style: 3,
	tn: 0,
	// sex 不给默认值:给了 '男' 就把下面「按记录性别兜底」那一行变成不可达代码 ——
	//   挂载齿轮拨「太乙命法」时女命主照样按男排。缺省 undefined → 走 getCaseGenderLabel(record)。
	// tenching / rotation 已剔除(后端不读、无消费者的死键)。
	// 与 TaiYiMain.state.options 同构:补齐流派/换日/时间基准/博弈,否则存过的非默认事盘重生成时丢档。
	school: { ...DEFAULT_TAIYI_SCHOOL },
	// 日界两键不在此处写死(0/1 是模块载入期字面量,与页面 defaultAfter23NewDay() 不一):
	//   regenerateTaiyiSnapshot 合并时**现取**全局缺省,同一快照内 nongli 与 taiyi/pan 口径一致。
	timeBasis: 'direct',
	gameTheory: 0,
};

export const ANALYSIS_TECHNIQUE_LABELS = {
	guice: '皇极轨策',
	xiaoliuren: '小六壬',
	xiaochengtu: '小成图',
	feigong: '飞宫小奇门',
	astrochart: '星盘',
	astrochart_like: '十三分盘 / 派生盘（十二分盘·调波盘·龙盘·重置盘）',   // 占星地图不在聚合键内(F-27 定谳:只取五个派生盘快照)
	// 派生盘五键独立技法键:各读辅盘页「出盘即存」的本键模块快照(只认本命主签名),
	// 内容勾选走各键既有导出 preset;聚合键 astrochart_like 仍并挂全部(零回归)。占星地图(locastro)
	// 无文本快照生产者(ACG 页为地图/线表,导出走本命盘回落)→ 不设独立键(设了=恒 missing 的死项)。
	hellenastro: '十三分盘',
	dwadasamsa: '十二分盘',
	harmonic: '调波盘',
	draconic: '龙盘',
	relocation: '重置盘',
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
	ephemeris: '星运-星历',
	returntimeline: '星运-回归轴',
	prenatalsyzygy: '星运-产前朔望',
	prog: '星运-二次推运',
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
	huanglizeri: '黄历择日',
	bazizeri: '八字择日',
	taiyizeri: '太乙择日',
	ziweizeri: '紫微择日',
	liurengzeri: '六壬择日',
	sanshizeri: '三式择日',
	qizhengzeri: '七政择日',
	indiazeri: '印度择日',
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
//   fengshui/otherbu/jieqi 各页确实会 saveModuleAISnapshot(供 AI 导出取正文)——「有快照」≠「可挂载」:
//   挂载需要 case 源语义(存盘/出生数据),这三者无 case 存储,快照是工作台态(如风水随流派 tab 实时覆盖),
//   挂到命例上会张冠李戴。维持只导出不挂载是结论,不是遗漏;其余仅页内消费的技法同理。
//   jieqi 若将来真有挂载需求,最小可行设计:仅限「起课时间」源,年份:=时点年,无头链复用
//   jieqiYearSeeds 机制批量拉四分至盘,段过滤沿 jieqi_* 六键既有 preset——挂载语义是案例/时点中心、
//   节气盘是年度中心,为孤例引入「一键四盘 multi-fetch」新机制类成本过重,本轮维持豁免。
// 标签仍保留在 ANALYSIS_TECHNIQUE_LABELS（导出/他处可能引用）。
export const ANALYSIS_CHART_TECHNIQUES = [
	'astrochart',
	'astrochart_like',
	'hellenastro',
	'dwadasamsa',
	'harmonic',
	'draconic',
	'relocation',
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
	'ephemeris',
	'returntimeline',
	'prenatalsyzygy',
	'prog',
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
	// 合盘:挂载读合盘页所存模块快照(两盘技法无法单 record 复算,见 buildChartTechniqueContext 特判)
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
export const TIME_CASTABLE_SET = new Set(TIME_CASTABLE_DIVINATION);
// 「起课时间」源额外允许六爻——时间起卦是确定性式法（时间即输入，非伪造摇卦）；
// 但「已存事盘」源仍不按时间重算六爻（保持 case 护栏，见 getAnalysisTechniqueContexts）。
// 时间确定/时间派种(seed/数据全由时间派生)式法均纳入「起课时间」源白名单:
// · sixyao 六爻(时间起卦)、huangji 皇极经世(元会运世按时间确定);
// · taixuan/jingjue 报数法用起课时间 yyyyMMddHHmm 派生 seed,反复挂载确定;
// · wuzhao 干支起例(纯时间)/shenyishu hourSource=auto seasonSource=auto 全由时间推断。
// 仍排除 tongshefa/suzhan/mundane —— 需用户手动选盘或事先存盘(凭时间起会得无意义默认值,不如显示「缺失」让用户去事盘存好再挂载)。
// 也排除 rizi(日子馆:builder 需 {year,persons,result} 页面级查询态,非单时刻可推)与
// jieqipan(无独立模块快照的 profile;分至内容走 jieqi_* 系列键)——二者标签只作取名用。
export const TIMEPOINT_CASTABLE_SET = new Set([...TIME_CASTABLE_DIVINATION, 'sixyao', 'huangji', 'taixuan', 'jingjue', 'wuzhao', 'shenyishu', 'xiaoliuren', 'feigong', 'xiaochengtu', 'huangli', 'tongshu']); // 小六壬/飞宫按占时(农历月日时支)可起;小成图按梅花时间卦(年支序+月+日为上数,加时支序为下数)走既有两数式起
