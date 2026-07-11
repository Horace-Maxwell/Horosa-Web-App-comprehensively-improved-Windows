import { getStore, } from './storageutil';
import { copyTextSmart } from './clipboardText';
import { withUtf8Bom } from './aiAnalysisExport';
import request from './request';
import * as ExportConstants from './constants';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from './dayBoundary';
import { getAstroAISnapshotForCurrent, saveAstroAISnapshot, loadAstroAISnapshot, buildClassicalAnalysisSection, } from './astroAiSnapshot';
import { loadModuleAISnapshot, } from './moduleAiSnapshot';
import { buildAcgSectionText } from './acgSnapshot';
import * as AstroConst from '../constants/AstroConst';
import * as AstroText from '../constants/AstroText';
import { buildMeaningTipByCategory, buildAspectMeaningTip, } from '../components/astro/AstroMeaningData';
import { buildQimenXiangTipObj, } from '../components/dunjia/QimenXiangDoc';
import { buildLiuRengShenTipObj, buildLiuRengHouseTipObj, } from '../components/liureng/LRShenJiangDoc';

const SYMBOL_MAP = {
	'☉': '日',
	'☽': '月',
	'☿': '水',
	'♀': '金',
	'♂': '火',
	'♃': '木',
	'♄': '土',
	'♅': '天王',
	'♆': '海王',
	'♇': '冥王',
	'⚷': '凯龙',
	'☊': '北交',
	'☋': '南交',
	'⊗': '福点',
	'♈': '白羊',
	'♉': '金牛',
	'♊': '双子',
	'♋': '巨蟹',
	'♌': '狮子',
	'♍': '处女',
	'♎': '天秤',
	'♏': '天蝎',
	'♐': '射手',
	'♑': '摩羯',
	'♒': '水瓶',
	'♓': '双鱼',
	'☌': '0˚',
	'⚹': '60˚',
	'✶': '60˚',
	'□': '90˚',
	'△': '120˚',
	'☍': '180˚',
	'⚊': '阳爻',
	'⚋': '阴爻',
	'☰': '乾卦',
	'☱': '兑卦',
	'☲': '离卦',
	'☳': '震卦',
	'☴': '巽卦',
	'☵': '坎卦',
	'☶': '艮卦',
	'☷': '坤卦',
	'☯': '阴阳',
};

const COMMON_REPLACERS = [
	{ regex: /\bConjunction\b/gi, value: '0˚' },
	{ regex: /\bSextile\b/gi, value: '60˚' },
	{ regex: /\bSquare\b/gi, value: '90˚' },
	{ regex: /\bTrine\b/gi, value: '120˚' },
	{ regex: /\bOpposition\b/gi, value: '180˚' },
	{ regex: /\bRetrograde\b/gi, value: '逆行' },
	{ regex: /\bDirect\b/gi, value: '顺行' },
	{ regex: /\bruler\b/gi, value: '本垣' },
	{ regex: /\bexalt\b/gi, value: '擢升' },
	{ regex: /\bterm\b/gi, value: '界' },
	{ regex: /\bface\b/gi, value: '十度' },
	{ regex: /\bfall\b/gi, value: '落陷' },
];

const DOMAIN_REPLACERS = {
	sixyao: [
		{ regex: /老阳/g, value: '阳爻(动)' },
		{ regex: /老阴/g, value: '阴爻(动)' },
		{ regex: /少阳/g, value: '阳爻(静)' },
		{ regex: /少阴/g, value: '阴爻(静)' },
		{ regex: /初爻/g, value: '第一爻' },
		{ regex: /上爻/g, value: '第六爻' },
		{ regex: /旬空/g, value: '旬空(空亡)' },
	],
	liureng: [
		{ regex: /旬空/g, value: '旬空(空亡)' },
		{ regex: /三传/g, value: '三传(初传/中传/末传)' },
		{ regex: /贵人/g, value: '贵人(天乙贵人体系)' },
	],
	jinkou: [
		{ regex: /旬空/g, value: '旬空(空亡)' },
		{ regex: /四大空亡/g, value: '四大空亡(金空/水空)' },
		{ regex: /贵神/g, value: '贵神(天将)' },
		{ regex: /将神/g, value: '将神(月将)' },
		{ regex: /地分/g, value: '地分(取课基准)' },
	],
	qimen: [
		{ regex: /值符/g, value: '值符(主事神)' },
		{ regex: /值使/g, value: '值使(主事门)' },
		{ regex: /九星/g, value: '九星(天蓬天任天冲天辅天英天芮天柱天心天禽)' },
		{ regex: /八门/g, value: '八门(休生伤杜景死惊开)' },
		{ regex: /八神/g, value: '八神(值符螣蛇太阴六合白虎玄武九地九天)' },
		{ regex: /遁甲/g, value: '奇门遁甲' },
	],
};

const ENABLE_SVG_TEXT_EXPORT = false;
const AI_EXPORT_SETTINGS_KEY = 'horosa.ai.export.settings.v1';
// v16 — P0 主限法方位+时间补全 (新增 Placidus 方位法 + Cardano/Plantiko/Wollner/SymbolicDegree/SymbolicSolarArc 时间换算)。
// v17 — 汉堡量化盘 AI 段补全 (germany 预设新增 行星图 A+B−C=D / 映点 Spiegelpunkt / 中点列表)。
// v18 — 四同步审计补全:migration keys 补齐占星/星运核心 + 卜卦/择日 19 技法(此前漏登记 → 这些技法预设新增分段
//        升级后并不并入老用户设置;astrochart 的「12分度/主宰链/寿命格局」即曾受此坑)。jieqi 系列走自有 split 迁移,不在此列。
// 升 SETTINGS_VERSION 触发用户旧 export presets 回收;升 MIGRATION_VERSION 把新段并入既有预设(union,不删用户项)。
// v19 — 占星全面扩建:世俗盘(新月/满月/日食/月食/地区盘/行星周期/世俗宫义)+ 星运三技法(三分主星/数字相位/月相推运)。
// v22 — R2 对抗自检:八字「多运限·指定时段」/ 紫微「运限」段未登记进 PRESET_SECTIONS,自定义过导出段+设了多运限的
//        用户,显式要的多运限段被 filterContentByWantedSections 静默删。补 preset 末尾两段 + 升版让旧用户迁移时 union 并入。
// v23 — 七政四余补「政余格局/相位」两段:右栏 Moira 面板已显示但此前未进快照/导出。同 v22 范式(补 preset + 升版 union)。
// v24 — 占星双盘技法补「本命盘配置/时段盘配置」段(返照/小限/太阳弧/流年/主限法盘/行星弧/Vedic/Jayne):预测快照把旧[星盘信息]
//        拆成[本命盘配置]+[时段盘配置]、主限法盘加[主限法盘配置]。自定义过导出段的老用户原会被静默删→同 v22/v23 范式
//        (补 preset + 升版 union + 星盘信息→时段盘配置 legacy map)。
// v25 — 古典占星补全:西占快照新增[古典]段(逐曜古典状态 出界/偕日相/喜乐/宗派/野逸/度数性质·阳阴/月站/远地点/单度·九分·Darijan
//        + 围攻详断 surround.besiegement)。astrochart/astrochart_like/indiachart/mundane 预设补[古典];同 v22/v23 范式
//        (补 preset + 升版 union → 自定义过导出段的老用户也并入[古典])。
// v26 — 古典格局派生分析:astrochart/astrochart_like 预设补[古典格局](护卫/优势相位/相位动态/逐题主星/偶然尊贵/
//        恒星/行星时/埃及历/巴比伦,由 analyze_chart 按需 fetch 拼入,与 AI 挂载同源)。同 v22 范式(补 preset + 升版 union)。
// v27 — 全量四镜审计补漏(in-app 实测):印占[大运Dasha](Vimshottari)、六壬[常用神煞]/[毕法（已命中）]、
//        太乙[起盘]——右栏/导出已输出但未登记 PRESET_SECTIONS → 自定义过导出段的用户被 filterContentByWantedSections
//        静默删、且在导出设置中不可勾选。同 v22-v26 范式(补 preset + 升版 union 并入,不删用户项)。
// v28 — 量化盘补[汉堡学派要素]段:汉堡功能(流派/六宫框/差值表/医学四液/赤纬)由 buildHamburgLines 拼进 germany
//        快照(仅用户介入汉堡功能时附,默认 classic 零回归),但此前未登记 germany PRESET_SECTIONS → 自定义过
//        量化盘导出段的老用户会被 filterContentByWantedSections 静默删、且导出设置里勾不到。同 v22-v27 范式
//        (补 preset 末尾段 + 升版 union 并入,不删用户项;默认未自定义用户走 applyUserSectionFilter 不过滤分支不受影响)。
// v29 — 大六壬全流派补「断卦层」9 段(年月神煞/课体结构/三传旺衰/空亡真假/旬空落点/陷空/遁干特殊/年命上神/占断向导):
//        buildLiuRengSnapshotText 条件产出(每盘几乎必出)但此前未登记 liureng PRESET_SECTIONS → 自定义过六壬导出段的
//        用户被 filterContentByWantedSections 静默删、且导出设置勾不到。liureng 已在 MIGRATION_KEYS → 同 v22-v28 范式
//        (补 preset 末尾段 + 升版 union 并入,不删用户项)。
// v30 — 三式合一(sanshiunited)对齐独立页:此前三式合一快照比独立页贫很多(奇门缺~9派生/法奇门段、太乙缺动态 pan.sections、
//        六壬缺~12 断卦段——UI 已渲染但没进快照=导出/挂载缺内容)。buildSanShiUnitedSnapshotText 改为复用三个独立
//        builder(buildDunJiaSnapshotText/buildTaiyiSnapshotText/buildLiuRengSnapshotText,单一真值源,正文照搬,只选段+改前缀)
//        补齐:太乙7段(加「太乙」前缀)/六壬断卦12段/奇门派生10段(加「奇门」前缀避与六壬「概览」碰撞)。这些段此前未登记
//        sanshiunited PRESET_SECTIONS → 自定义过三式合一导出段的用户会被 filterContentByWantedSections 静默删、且导出设置勾不到。
//        sanshiunited 已在 MIGRATION_KEYS → 同 v22-v29 范式(补 preset 末尾段 + 升版 union 并入,不删用户项)。
// v32 补:风水新增五流派导出段(辅星水法/净阴净阳/玄空大卦/形势峦头/择日选择)登记进 fengshui PRESET_SECTIONS。
//        fengshui 已在 MIGRATION_KEYS → 同 v22-v31 范式(补 preset 末尾段 + 升版 union 并入,不删用户项);
//        MIGRATION_VERSION 升至 == SETTINGS_VERSION 以覆盖曾在 v31 自定义过风水导出段的老用户(否则五新段被 filterContentByWantedSections 静默删)。
// v36 补:一掌经神煞合参层由静态 21×12 表改为按盘计算落宫(生年支/日干/月支/日柱旬定位)→导出新增「神煞合参」段。
//        yizhangjing 已在 MIGRATION_KEYS;MIGRATION_VERSION 升至 == SETTINGS_VERSION 以覆盖曾自定义过一掌经导出段(v33-35)的老用户(否则神煞合参段被静默删)。
export const AI_EXPORT_SETTINGS_VERSION = 40;
const AI_EXPORT_SECTION_MIGRATION_VERSION = 40;
const AI_EXPORT_SECTION_MIGRATION_KEYS = [
	// v18 补:占星/星运核心 + 卜卦/择日(此前漏登记)。务必与新增「有 preset 的技法」同步(aiExport.test 跨系统自检守)。
	'astrochart',
	'astrochart_like',
	'indiachart',
	'mundane',
	'relative',
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
	'horary',
	'election',
	'bazi',
	'ziwei',
	'suzhan',
	'sixyao',
	'tongshefa',
	'liureng',
	'jinkou',
	'qimen',
	'sanshiunited',
	'taiyi',
	'guolao',
	// v39 补:节气盘主键 + 四分点子盘(春分/夏至/秋分/冬至)+ 元数据键;presets 增 3D盘段,自定义用户须并集补入。
	'jieqi',
	'jieqi_chunfen',
	'jieqi_xiazhi',
	'jieqi_qiufen',
	'jieqi_dongzhi',
	'jieqi_meta',
	'germany',
	'otherbu',
	'fengshui',
	'huangji',
	'wuzhao',
	'taixuan',
	'jingjue',
	'shenyishu',
	'geomancy',
	'tarot',
	'shaozi',
	'tieban',
	'fendjing',
	'beiji',
	'nanji',
	'chunzi',
	'xianqin',
	'cetian',
	'qizhengkin',
	'planetaryages',
	'vedicprog',
	'jaynesprog',
	'planetaryarc',
	'persiandirected',
	'yearsystem129',
	'balbillus',
	'triplicityrulers',
	'keypoints',
	'lunationphase',
	'extrareturns',
	'canping',
	'heluo',
	'yizhangjing',
];
const AI_EXPORT_PLANET_INFO_DEFAULT = {
	showHouse: 1,
	showRuler: 1,
};
const AI_EXPORT_ASTRO_MEANING_DEFAULT = {
	enabled: 0,
};
const AI_EXPORT_PLANET_INFO_TECHNIQUES = new Set([
	'astrochart',
	'indiachart',
	'astrochart_like',
	'relative',
	'primarydirect',
	'primarydirchart',
	'zodialrelease',
	'firdaria',
	'profection',
	'solararc',
	'solarreturn',
	'lunarreturn',
	'givenyear',
	'decennials',
	'planetaryages',
	'vedicprog',
	'jaynesprog',
	'planetaryarc',
	'persiandirected',
	'yearsystem129',
	'balbillus',
	'triplicityrulers',
	'keypoints',
	'lunationphase',
	'extrareturns',
	'jieqi',
	'jieqi_meta',
	'jieqi_chunfen',
	'jieqi_xiazhi',
	'jieqi_qiufen',
	'jieqi_dongzhi',
	'sanshiunited',
	'guolao',
	'germany',
]);
const AI_EXPORT_ASTRO_MEANING_TECHNIQUES = new Set([
	...Array.from(AI_EXPORT_PLANET_INFO_TECHNIQUES),
	'otherbu',
	'qimen',
	'liureng',
]);
const AI_EXPORT_HOVER_MEANING_TECHNIQUES = new Set([
	'qimen',
	'liureng',
	'sanshiunited',
]);
const JIEQI_SETTING_PRESETS = {
	jieqi_meta: ['节气盘参数'],
	jieqi_chunfen: ['春分星盘', '春分宿盘', '春分3D盘'],
	jieqi_xiazhi: ['夏至星盘', '夏至宿盘', '夏至3D盘'],
	jieqi_qiufen: ['秋分星盘', '秋分宿盘', '秋分3D盘'],
	jieqi_dongzhi: ['冬至星盘', '冬至宿盘', '冬至3D盘'],
};
const JIEQI_SPLIT_SETTING_KEYS = Object.keys(JIEQI_SETTING_PRESETS);
const JIEQI_SPLIT_TECHNIQUES = [
	{ key: 'jieqi_meta', label: '节气盘-通用参数' },
	{ key: 'jieqi_chunfen', label: '节气盘-春分' },
	{ key: 'jieqi_xiazhi', label: '节气盘-夏至' },
	{ key: 'jieqi_qiufen', label: '节气盘-秋分' },
	{ key: 'jieqi_dongzhi', label: '节气盘-冬至' },
];

const AI_EXPORT_TECHNIQUES = [
	{ key: 'astrochart', label: '星盘' },
	{ key: 'indiachart', label: '印度占星' },
	{ key: 'astrochart_like', label: '十三分盘/占星地图' },
	{ key: 'mundane', label: '世俗盘' },
	{ key: 'relative', label: '合盘' },
	{ key: 'primarydirect', label: '星运-主限法' },
	{ key: 'primarydirchart', label: '星运-主限法盘' },
	{ key: 'zodialrelease', label: '星运-黄道星释' },
	{ key: 'firdaria', label: '星运-法达星限' },
	{ key: 'distributions', label: '星运-界推运' },
	{ key: 'agepoint', label: '星运-年龄推进点' },
	{ key: 'profection', label: '星运-小限法' },
	{ key: 'solararc', label: '星运-太阳弧' },
	{ key: 'solarreturn', label: '星运-太阳返照' },
	{ key: 'lunarreturn', label: '星运-月亮返照' },
	{ key: 'givenyear', label: '星运-流年法' },
	{ key: 'decennials', label: '星运-十年大运' },
	{ key: 'planetaryages', label: '星运-行星年龄' },
	{ key: 'vedicprog', label: '星运-恒星推运' },
	{ key: 'jaynesprog', label: '星运-赤纬推运' },
	{ key: 'planetaryarc', label: '星运-行星弧' },
	{ key: 'persiandirected', label: '星运-波斯向运' },
	{ key: 'yearsystem129', label: '星运-129年系统' },
	{ key: 'balbillus', label: '星运-Balbillus' },
	{ key: 'triplicityrulers', label: '星运-三分主星' },
	{ key: 'keypoints', label: '星运-数字相位' },
	{ key: 'lunationphase', label: '星运-月相推运' },
	{ key: 'extrareturns', label: '星运-多重回归' },
	{ key: 'bazi', label: '八字' },
	{ key: 'ziwei', label: '紫微斗数' },
	{ key: 'suzhan', label: '宿占' },
	{ key: 'sixyao', label: '六爻' },
	{ key: 'tongshefa', label: '统摄法' },
	{ key: 'huangji', label: '皇极经世' },
	{ key: 'wuzhao', label: '五兆' },
	{ key: 'taixuan', label: '太玄筮法' },
	{ key: 'jingjue', label: '荆诀' },
	{ key: 'shenyishu', label: '神易数' },
	{ key: 'geomancy', label: '天文地占' },
	{ key: 'tarot', label: '塔罗' },
	{ key: 'liureng', label: '六壬' },
	{ key: 'jinkou', label: '金口诀' },
	{ key: 'qimen', label: '奇门遁甲' },
	{ key: 'sanshiunited', label: '三式合一' },
	{ key: 'taiyi', label: '太乙' },
	{ key: 'guolao', label: '七政四余' },
	{ key: 'qizhengkin', label: '七政四余（七政）' },
	{ key: 'shaozi', label: '邵子神数' },
	{ key: 'tieban', label: '铁板神数' },
	{ key: 'fendjing', label: '鬼谷分定经' },
	{ key: 'beiji', label: '北极神数' },
	{ key: 'nanji', label: '南极神数' },
	{ key: 'chunzi', label: '蠢子数' },
	{ key: 'canping', label: '邵子参评数' },
	{ key: 'heluo', label: '河洛理数' },
	{ key: 'xianqin', label: '万化仙禽' },
	{ key: 'cetian', label: '策天飞星' },
	{ key: 'yizhangjing', label: '一掌经' },
	{ key: 'germany', label: '量化盘' },
	{ key: 'jieqi', label: '节气盘' },
	...JIEQI_SPLIT_TECHNIQUES,
	{ key: 'otherbu', label: '骰子' },
	{ key: 'fengshui', label: '风水' },
	{ key: 'horary', label: '卜卦盘' },
	{ key: 'election', label: '择日盘' },
	{ key: 'generic', label: '其他页面' },
];

export const AI_EXPORT_PRESET_SECTIONS = {
	horary: ['起卦信息', '根本性', '征象星指派', '完成分析', '月亮的故事', '相位全览', '裁决', '应期方位', '描述', '专题深化·X'],
	election: ['起盘信息', '总评', '红线', '分项', '用事专属', '危象日参照', '应期', '本命合参', '时势合参', '建议'],
	astrochart: ['起盘信息', '宫位宫头', '星与虚点', '信息', '相位', '行星', '希腊点', '12分度', '主宰星链', '古典', '古典格局', '寿命格局', '可能性'],
	indiachart: ['星盘信息', '起盘信息', '信息', '相位', '行星', '希腊点', '古典', '可能性', '大运Dasha',
		// buildJyotishSnapshotLines 无条件派生段(约 40 段,条件产出⊆语义):此前未登记→自定义过 india 导出段的用户被静默删、纳入面板勾不到。
		'Panchanga 五要素', '卡拉卡（8 Chara Karakas）', '节点主照（Rasi Drishti）', '星曜状态', '分盘吉位 Vimśopaka', '八分点 SAV', 'Sodhya Pinda 凝量', 'Shadbala 六力', 'Ishta/Kashta 吉凶果', 'Vimśopaka 分盘 20 分力', 'Hora 行星时', 'Choghadia 民用择时', '择时 Panchaka/Abhijit', 'Mūla 大运', 'Sudarśana Chakra 大运', 'Naisargika 自然大运', '补充上升（Supplementary Lagnas）', 'Nāḍī · Bhrigu Bindu 福点', 'Nāḍī · D150 纳地盘', 'Āyurdāya 寿命基础', '特殊上升 Special Lagnas', 'D60 六十分盘吉凶', '分盘变体对照', '功能吉凶（Functional Nature）', '宫位力（Bhava Bala）', '星曜战（Graha Yuddha）', '扩展大运（Conditional / Chara）', 'Kartari 夹击格局', 'Sudarshana 三盘（命/日/月起）', 'KP 宫头次主星 CSL', 'KP 意义者 Significators', 'KP 六级细分 / 当令星', '敌友（复合五分）', '行运 Gochara（从月·八分点）', '化解（信息·非处方）', 'Jaimini Argala 干涉', 'Tajika Harsha Bala', 'Tajika Pancha-Vargeeya', 'Tajika Mudda 年运', '行运 Gochara（从命）', '座运·X'],
	astrochart_like: ['起盘信息', '宫位宫头', '星与虚点', '信息', '相位', '行星', '希腊点', '12分度', '主宰星链', '古典', '古典格局', '寿命格局', '可能性', '占星地图'],
	mundane: ['世俗入宫', '新月图', '满月图', '日食图', '月食图', '地区盘', '行星周期', '世俗宫义', '定局·年主/盘主', '入境骨架', '地理分野', '地区盘推运', '起盘信息', '宫位宫头', '星与虚点', '信息', '相位', '行星', '希腊点', '12分度', '主宰星链', '古典', '寿命格局', '可能性'],
	relative: ['关系起盘信息', 'A对B相位', 'B对A相位', 'A对B中点相位', 'B对A中点相位', 'A对B映点', 'A对B反映点', 'B对A映点', 'B对A反映点', '合成图盘', '影响图盘-星盘A', '影响图盘-星盘B', '关系量化', '顺畅连接', '张力连接'],
	primarydirect: ['出生时间', '星盘信息', '主限法设置', '主限法表格', '主/界限法设置', '主/界限法表格'],
	distributions: ['界推运（分配法 / Distributions）'],
	agepoint: ['年龄推进点（Age Point / Huber）'],
	primarydirchart: ['出生时间', '星盘信息', '主限法盘设置', '本命盘配置', '主限法盘配置', '主限法盘说明'],
	zodialrelease: ['起盘信息', '星盘信息', '基于X点推运'],
	firdaria: ['出生时间', '星盘信息', '法达星限表格'],
	profection: ['本命盘配置', '起盘信息', '时段盘配置', '相位'],
	solararc: ['本命盘配置', '起盘信息', '时段盘配置', '相位'],
	solarreturn: ['本命盘配置', '起盘信息', '时段盘配置', '相位'],
	lunarreturn: ['本命盘配置', '起盘信息', '时段盘配置', '相位'],
	givenyear: ['本命盘配置', '起盘信息', '时段盘配置', '相位'],
	decennials: ['起盘信息', '星盘信息', '十年大运设置', '基于X起运'],
	planetaryages: ['行星年龄（Ages of Man）'],
	vedicprog: ['恒星推运（Vedic Sidereal）', '本命盘配置', '时段盘配置 二次推运位置'],
	jaynesprog: ['赤纬推运（Declination）', '本命盘配置', '时段盘 赤纬平行/反平行'],
	planetaryarc: ['行星弧（Planetary Arc）', '本命盘配置', '时段盘配置', '相位'],
	persiandirected: ['波斯向运（Persian Directed）'],
	yearsystem129: ['129年系统表格'],
	balbillus: ['Balbillus'],
	triplicityrulers: ['三分主星推运'],
	keypoints: ['数字相位推运'],
	lunationphase: ['月相推运'],
	extrareturns: ['多重回归'],
	bazi: ['起盘信息', '四柱与三元', '神煞（四柱与三元）', '五行力量', '格局·用神', '盲派结构', '月令司令（分野）', '大运', '流年行运概略', '多运限·指定时段'],
	ziwei: ['起盘信息', '宫位总览', '来因宫', '命中格局', '运限'],
	suzhan: ['起盘信息', '宿盘宫位与二十八宿星曜'],
	sixyao: ['起盘信息', '卦象', '六爻与动爻', '断卦结构', '卦辞与断语'],
	tongshefa: ['本卦', '六爻', '潜藏', '亲和'],
	huangji: ['起盘', '元会运世', '天道卦', '人事卦', '心易发微', '历史年表'],
	wuzhao: ['起盘', '揲筮', '兆', '木乡', '火乡', '土乡', '金乡', '水乡', '特殊标记'],
	taixuan: ['起盘', '玄首', '方州部家', '表'],
	jingjue: ['起课', '卦辞', '三分', '十六卦'],
	shenyishu: ['起盘', '干支与五行', '神卦', '五行法则', '兵占', '主客判断', '神煞', '长生', '吉凶'],
	geomancy: ['判定', '解读技法', '十二宫·图形入宫', '十六图形'],
	tarot: ['牌阵综览', '逐牌详解', '综合断语', '定局', '生命牌'],
	liureng: [
		'起盘信息',
		'十二盘式',
		'十二地盘/十二天盘/十二贵神对应',
		'四课',
		'三传',
		'行年',
		'旬日',
		'旺衰',
		'基础神煞',
		'干煞',
		'月煞',
		'支煞',
		'岁煞',
		'十二长生',
		'大格',
		'小局',
		'参考',
		'概览',
		'常用神煞',
		// 大六壬全流派补齐:断卦层派生段(年月神煞/课体结构/三传旺衰/空亡真假/旬空落点/陷空/遁干特殊/年命上神/占断向导)。
		// 这些由 buildLiuRengSnapshotText 条件产出(每盘几乎必出)但此前未登记 → 自定义过六壬导出段的用户被
		// filterContentByWantedSections 静默删、导出设置勾不到(v22/v27 同类坑)。同范式补 preset 末尾 + 升版 union 并入。
		'年月神煞',
		'课体结构',
		'三传旺衰',
		'空亡真假',
		'旬空落点',
		'陷空',
		'遁干特殊',
		'年命上神',
		'占断向导',
		'毕法（已命中）',
	],
	jinkou: [
		'起盘信息',
		'金口诀速览',
		'金口诀四位',
		'金口诀三盘',
		'四位神煞',
		'用神强弱',
		'发用·五动三动',
		'格局',
		'四位生克',
		'应期',
		'太岁月建',
		'地支关系',
		'相关神煞',
		'贵神月将象意',
		'分类用神',
		'行年',
		'旬日',
		'旺衰',
		'基础神煞',
		'干煞',
		'月煞',
		'支煞',
		'岁煞',
		'十二长生',
	],
	taiyi: [
		'起盘信息',
		'起盘',
		'太乙盘',
		'太乙诸神',
		'风游',
		'主客定算',
		'十二神',
		'八门与宿曜',
		'断法',
		'七大兵法',
		'博弈',
		'命法',
		'命宫行限',
		'十六宫标记',
	],
	qimen: ['起盘信息', '盘型', '全局速览', '盘面要素', '奇门演卦', '八宫详解', '九宫方盘', '旺相休囚死·月令能量', '六害总览', '化解方案', '八门化气大阵', '用神分论', '财富七要', '事业七要', '恋爱姻缘', '孤辰寡宿'],
	sanshiunited: [
		'起盘信息',
		'概览',
		'太乙',
		'太乙十六宫',
		'神煞',
		'大六壬',
		'六壬大格',
		'六壬小局',
		'六壬参考',
		'六壬概览',
		'八宫详解',
		'正北坎宫',
		'东北艮宫',
		'正东震宫',
		'东南巽宫',
		'正南离宫',
		'西南坤宫',
		'正西兑宫',
		'西北乾宫',
		// v30 — 三式合一对齐独立页:复用独立 builder(单一真值源)补全此前缺的派生/断卦段。
		// 太乙(复用 buildTaiyiSnapshotText 的 pan.sections,加「太乙」前缀避叠词/碰撞):
		'太乙主客定算',
		'太乙八门与宿曜',
		'太乙断法',
		'太乙七大兵法',
		'太乙博弈',
		'太乙命法',
		'太乙命宫行限',
		// 六壬断卦层(复用 buildLiuRengSnapshotText 断卦段;大格/小局/参考/概览三式合一已自有不重出):
		'十二盘式',
		'常用神煞',
		'年月神煞',
		'课体结构',
		'三传旺衰',
		'空亡真假',
		'旬空落点',
		'陷空',
		'遁干特殊',
		'年命上神',
		'毕法（已命中）',
		'占断向导',
		// 奇门派生/法奇门段(复用 buildDunJiaSnapshotText;加「奇门」前缀避与六壬「概览」等碰撞):
		'奇门九宫方盘',
		'奇门旺相休囚死·月令能量',
		'奇门六害总览',
		'奇门化解方案',
		'奇门八门化气大阵',
		'奇门用神分论',
		'奇门财富七要',
		'奇门事业七要',
		'奇门恋爱姻缘',
		'奇门孤辰寡宿',
	],
	guolao: ['起盘信息', '七政四余宫位与二十八宿星曜', '神煞', '大限', '政余格局', '相位'],
	qizhengkin: ['起盘', '四柱', '星曜', '十二宫', '神煞', '年限', '流时', '择日', '张果断语', '命宫解读', '今制宿度', '古制宿度'],
	shaozi: ['起盘', '四柱', '四位起数', '河洛纳音', '完整结构', '64钥匙', '元会运世', '条文'],
	tieban: ['起盘', '四柱', '算盘定部', '条文', '计算摘要', '命身刻分', '神数号码', '十二宫', '十二宫条文', '紫微安星', '条文库', '大运', '六亲佐证', '框架·流派刻制', '框架·考刻六亲', '框架·八卦滚', '框架·批断顺序', '框架·借用子系统'],
	fendjing: ['起盘', '四柱', '两头钳', '命格', '判断', '六段断语'],
	beiji: ['起盘', '年时', '条文索引', '完整条文', '条文检索', '家亲', '财官性情', '大运'],
	nanji: ['起盘', '四柱', '宫部条文', '条文查询', '大运', '密码', '星图推演'],
	chunzi: ['起盘', '四柱', '代码来源', '结构解析', '候选条文', '代码查询', '批量代码查询', '关键词检索', '多标签检索', '宿名检索', '时辰检索'],
	xianqin: ['起盘', '三宫', '三星', '衍生星', '十二宫', '吞啖合战', '情性与格局', '二十八宿禽', '十二宫顺序', '三元起宿', '合宿表', '科名月宿', '四季得时', '情性赋全表', '二十八宿正像', '吞啖合战规则', '贵贱赋摘要', '演法·流派', '演法·起禽', '演法·择日', '演法·占卜', '演法·投胎'],
	cetian: ['起盘', '农历与命身', '四化', '飞星', '格局', '命宮', '兄弟宮', '夫妻宮', '子女宮', '財帛宮', '疾厄宮', '遷移宮', '交友宮', '官祿宮', '田宅宮', '福德宮', '父母宮', '男女宮', '奴僕宮', '妻妾宮', '相貌宮', '星曜属性', '正曜副曜', '宫干四化表', '飞化规则', '古法格局规则', '三合组'],
	germany: ['起盘信息', '宫位宫头', '行星', '中点', 'TNP星体', '中点相位', '90°中点盘', '行星图', '映点', '中点列表', '汉堡学派要素'],
	jieqi: ['节气盘参数', '春分星盘', '春分宿盘', '春分3D盘', '夏至星盘', '夏至宿盘', '夏至3D盘', '秋分星盘', '秋分宿盘', '秋分3D盘', '冬至星盘', '冬至宿盘', '冬至3D盘'],
	...JIEQI_SETTING_PRESETS,
	otherbu: ['起盘信息', '骰子结果', '骰子盘宫位与星体', '天象盘宫位与星体'],
	fengshui: ['起盘信息', '标记判定', '冲突清单', '未定位标注', '破局危害', '龙虎灶台', '移动盘', '吉凶评分', '缓解建议', '使用要点', '建议汇总', '纳气建议', '八卦定位', '成員卦象', '四类象格局', '应期成格', '改运建议', '风水·纳气盘', '风水·八卦阳宅', '风水·八宅大游年', '风水·玄空飞星', '风水·三合水法', '风水·金锁玉关', '风水·乾坤国宝', '风水·紫白飞星', '风水·辅星水法', '风水·净阴净阳', '风水·玄空大卦', '风水·形势峦头', '风水·择日选择'],
	canping: ['起盘', '本命', '大运·歲運', '流年·歲運'],
	heluo: ['起命', '先天卦·元堂爻辞', '后天卦·元堂爻辞', '命运篇', '大限·岁运', '流年·岁运', '断验'],
	yizhangjing: ['起盘信息', '四柱四宫断语', '命宫与人事十二宫', '格局判定', '重犯', '交互格', '职业适性', '大限', '小限与流年十二神', '流年总论', '神煞合参'],
	generic: ['起盘信息'],
};

// 自检用:返回所有「有 preset 段表」的技法 key。配合测试断言 preset key ⊆ AI_EXPORT_TECHNIQUES,
// 堵住「有 preset 却没登记进 AI_EXPORT_TECHNIQUES → 在导出设置下拉隐身 + 不被 getAIExportAuditMatrix 自检」的回归
// (canping 参评数 / heluo 河洛理数 此前正是踩了此坑)。
export function getAIExportPresetKeys(){
	return Object.keys(AI_EXPORT_PRESET_SECTIONS);
}

const AI_EXPORT_FORBIDDEN_SECTIONS = {
	liureng: ['右侧栏目'],
	qimen: ['右侧栏目'],
	sanshiunited: ['右侧栏目'],
};
const MODULE_SNAPSHOT_PREFIX = 'horosa.ai.snapshot.module.v1.';

// ywastr* 字体把术语编码到单字符里，复制后只剩字母，需要反解码。
const STANDALONE_TOKEN_MAP = {
	A: '日',
	B: '月',
	C: '水',
	D: '金',
	E: '火',
	F: '木',
	G: '土',
	H: '天王',
	I: '海王',
	J: '冥王',
	K: '北交',
	L: '南交',
	o: '灵点',
	p: '福点',
	q: '弱点',
	r: '爱点',
	s: '勇点',
	t: '赢点',
	u: '罪点',
	v: '暗月',
	w: '紫气',
	y: '凯龙',
	z: '月亮朔望点',
	$: '月亮平均近地点',
	Y: '月亮平均远地点',
	'{': '',
	'0': '上升',
	'1': '天顶',
	'2': '天底',
	'3': '下降',
	'4': '谷神星',
	'5': '智神星',
	'6': '婚神星',
	'7': '灶神星',
	'8': '人龙星',
	// 相位
	M: '0˚',
	N: '30˚',
	O: '45˚',
	P: '60˚',
	R: '90˚',
	S: '120˚',
	T: '135˚',
	V: '150˚',
	W: '180˚',
	Z: '逆行',
};

const ZODIAC_CODE_MAP = {
	a: '白羊',
	b: '金牛',
	c: '双子',
	d: '巨蟹',
	e: '狮子',
	f: '处女',
	g: '天秤',
	h: '天蝎',
	i: '射手',
	j: '摩羯',
	k: '水瓶',
	l: '双鱼',
};

const ZODIAC_STANDALONE_MAP = {
	a: '白羊',
	b: '金牛',
	c: '双子',
	d: '巨蟹',
	e: '狮子',
	f: '处女',
	g: '天秤',
	h: '天蝎',
	i: '射手',
	j: '摩羯',
	k: '水瓶',
	l: '双鱼',
};

function sleep(ms){
	return new Promise((resolve)=>setTimeout(resolve, ms));
}

function textOf(node){
	if(!node){
		return '';
	}
	return (node.innerText || node.textContent || '').trim();
}

function uniqueArray(arr){
	const out = [];
	const seen = new Set();
	arr.forEach((item)=>{
		if(!item){
			return;
		}
		if(!seen.has(item)){
			seen.add(item);
			out.push(item);
		}
	});
	return out;
}

function safe(text, fallback = ''){
	const val = text === undefined || text === null ? '' : `${text}`.trim();
	if(val){
		return val;
	}
	return `${fallback || ''}`;
}

function normalizePlanetInfoSetting(raw){
	const val = raw && typeof raw === 'object' ? raw : {};
	return {
		showHouse: val.showHouse === 1 || val.showHouse === true ? 1 : 0,
		showRuler: val.showRuler === 1 || val.showRuler === true ? 1 : 0,
	};
}

function isPlanetInfoTechnique(key){
	return AI_EXPORT_PLANET_INFO_TECHNIQUES.has(`${key || ''}`);
}

function normalizeAstroMeaningSetting(raw){
	const val = raw && typeof raw === 'object' ? raw : {};
	return {
		enabled: val.enabled === 1 || val.enabled === true ? 1 : 0,
	};
}

function isAstroMeaningTechnique(key){
	return AI_EXPORT_ASTRO_MEANING_TECHNIQUES.has(`${key || ''}`);
}

function isHoverMeaningTechnique(key){
	return AI_EXPORT_HOVER_MEANING_TECHNIQUES.has(`${key || ''}`);
}

function getMeaningSettingMetaByTechnique(key){
	if(isHoverMeaningTechnique(key)){
		return {
			title: '悬浮注释（仅AI导出）：',
			checkbox: '在对应分段输出六壬/遁甲/占星悬浮注释',
		};
	}
	if(isAstroMeaningTechnique(key)){
		return {
			title: '占星注释（仅AI导出）：',
			checkbox: '在对应分段输出星/宫/座/相/希腊点释义',
		};
	}
	return {
		title: '',
		checkbox: '',
	};
}

function getPlanetInfoSettingByTechnique(settings, key){
	if(!isPlanetInfoTechnique(key)){
		return {
			showHouse: 0,
			showRuler: 0,
		};
	}
	const source = settings && settings.planetInfo && typeof settings.planetInfo === 'object'
		? settings.planetInfo[key]
		: null;
	if(!source){
		return {
			...AI_EXPORT_PLANET_INFO_DEFAULT,
		};
	}
	return normalizePlanetInfoSetting(source);
}

function getAstroMeaningSettingByTechnique(settings, key){
	if(!isAstroMeaningTechnique(key) && !isHoverMeaningTechnique(key)){
		return {
			enabled: 0,
		};
	}
	const source = settings && settings.astroMeaning && typeof settings.astroMeaning === 'object'
		? settings.astroMeaning[key]
		: null;
	if(!source){
		return {
			...AI_EXPORT_ASTRO_MEANING_DEFAULT,
		};
	}
	return normalizeAstroMeaningSetting(source);
}

function normalizeSectionTitle(title){
	const t = `${title || ''}`.trim();
	if(!t){
		return '';
	}
	if(/^基于.+推运$/.test(t)){
		return '基于X点推运';
	}
	if(/^基于.+起运$/.test(t)){
		return '基于X起运';
	}
	// 印占 Rasi Dasha 座运·X(11 变体,IndiaChart.js out[`座运·${name}`])折叠成单占位,
	// 与 preset 的「座运·X」两侧归一 → 一个纳入开关控 11 段(同 基于X点推运 范式)。
	if(/^座运·.+$/.test(t)){
		return '座运·X';
	}
	// 西洋卜卦 horary 专题深化·X(诉讼/买房/怀孕 3 变体,horarySnapshot.js 段头 `[专题深化·${topic.title}]`)
	// 折叠成单占位,与 preset 的「专题深化·X」两侧归一 → 一个纳入开关控 3 类专题(同 座运·X 范式)。
	if(/^专题深化·.+$/.test(t)){
		return '专题深化·X';
	}
	return t;
}

function parseSectionTitleLine(line){
	const txt = `${line || ''}`.trim();
	if(!txt){
		return '';
	}
	let m = txt.match(/^\[(.+)\]$/);
	if(!m || !m[1]){
		m = txt.match(/^【(.+)】$/);
	}
	if(m && m[1]){
		return normalizeSectionTitle(m[1]);
	}
	return '';
}

function extractSectionTitles(content){
	const lines = `${content || ''}`.split('\n');
	const titles = [];
	lines.forEach((line)=>{
		const normalized = parseSectionTitleLine(line);
		if(normalized){
			titles.push(normalized);
		}
	});
	return uniqueArray(titles);
}

function normalizeAIExportSettings(settings){
	const sourceVersion = settings && typeof settings === 'object'
		? parseInt(`${settings.version || 0}`, 10) || 0
		: 0;
	const normalized = {
		version: AI_EXPORT_SETTINGS_VERSION,
		sections: {},
		planetInfo: {},
		astroMeaning: {},
	};
	if(!settings || typeof settings !== 'object'){
		return normalized;
	}
	const sections = settings.sections && typeof settings.sections === 'object' ? settings.sections : {};
	Object.keys(sections).forEach((key)=>{
		const arr = Array.isArray(sections[key]) ? sections[key] : [];
		normalized.sections[key] = uniqueArray(arr.map((item)=>normalizeSectionTitle(item)).filter(Boolean));
	});
	if(sourceVersion < AI_EXPORT_SECTION_MIGRATION_VERSION){
		AI_EXPORT_SECTION_MIGRATION_KEYS.forEach((key)=>{
			if(!Object.prototype.hasOwnProperty.call(sections, key)){
				return;
			}
			const preset = Array.isArray(AI_EXPORT_PRESET_SECTIONS[key]) ? AI_EXPORT_PRESET_SECTIONS[key] : [];
			const merged = uniqueArray([
				...(normalized.sections[key] || []),
				...preset.map((item)=>normalizeSectionTitle(item)).filter(Boolean),
			]);
			normalized.sections[key] = merged;
		});
	}
	const planetInfo = settings.planetInfo && typeof settings.planetInfo === 'object' ? settings.planetInfo : {};
	Object.keys(planetInfo).forEach((key)=>{
		if(!isPlanetInfoTechnique(key)){
			return;
		}
		normalized.planetInfo[key] = normalizePlanetInfoSetting(planetInfo[key]);
	});
	const astroMeaning = settings.astroMeaning && typeof settings.astroMeaning === 'object' ? settings.astroMeaning : {};
	Object.keys(astroMeaning).forEach((key)=>{
		if(!isAstroMeaningTechnique(key) && !isHoverMeaningTechnique(key)){
			return;
		}
		normalized.astroMeaning[key] = normalizeAstroMeaningSetting(astroMeaning[key]);
	});
	return normalized;
}

function snapshotModuleKeyByContextKey(key){
	if(key === 'sixyao'){
		return 'guazhan';
	}
	const map = {
		wuzhao: 'wuzhao',
		taixuan: 'taixuan',
		jingjue: 'jingjue',
		shenyishu: 'shenyishu',
		geomancy: 'geomancy',
		tarot: 'tarot',
		shaozi: 'kinastro-shaozi',
		tieban: 'kinastro-tieban',
		fendjing: 'kinastro-fendjing',
		beiji: 'kinastro-beiji',
		nanji: 'kinastro-nanji',
		chunzi: 'kinastro-chunzi',
		xianqin: 'kinastro-xianqin',
		cetian: 'kinastro-cetian',
		qizhengkin: 'guolao-qizhengkin',
	};
	if(map[key]){
		return map[key];
	}
	return key;
}

function isJieQiSplitSettingKey(key){
	return JIEQI_SPLIT_SETTING_KEYS.includes(key);
}

function getJieQiCachedContent(){
	const current = getModuleCachedContent('jieqi_current');
	const whole = getModuleCachedContent('jieqi');
	return [current, whole].filter(Boolean).join('\n\n');
}

async function requestModuleSnapshotRefresh(moduleName){
	if(!moduleName || typeof window === 'undefined'){
		return '';
	}
	const before = `${getModuleCachedContent(moduleName) || ''}`.trim();
	const detail = {
		module: moduleName,
		snapshotText: '',
	};
	try{
		window.dispatchEvent(new CustomEvent('horosa:refresh-module-snapshot', {
			detail,
		}));
	}catch(e){
		return '';
	}
	// 某些模块会在事件回调里触发异步重算后才写快照；轮询一小段时间。
	const stepMs = 120;
	const maxWaitMs = 1800;
	let waited = 0;
	while(waited <= maxWaitMs){
		const direct = typeof detail.snapshotText === 'string'
			? `${detail.snapshotText}`.trim()
			: '';
		if(direct){
			return direct;
		}
		const cached = `${getModuleCachedContent(moduleName) || ''}`.trim();
		if(cached && (cached !== before || waited >= 480)){
			return cached;
		}
		// 等待下一个轮询周期
		// eslint-disable-next-line no-await-in-loop
		await sleep(stepMs);
		waited += stepMs;
	}
	const direct = typeof detail.snapshotText === 'string'
		? `${detail.snapshotText}`.trim()
		: '';
	if(direct){
		return direct;
	}
	const cached = `${getModuleCachedContent(moduleName) || ''}`.trim();
	return cached || before || '';
}

function getCachedContentForTechnique(key){
	if(key === 'astrochart' || key === 'astrochart_like'){
		return getAstroCachedContent();
	}
	if(key === 'indiachart'){
		return getIndiaCachedContent('');
	}
	if(key === 'jieqi' || isJieQiSplitSettingKey(key)){
		return getJieQiCachedContent();
	}
	if(key === 'generic'){
		return '';
	}
	const moduleKey = snapshotModuleKeyByContextKey(key);
	return getModuleCachedContent(moduleKey);
}

function getOptionsForTechniqueKey(key){
	const preset = AI_EXPORT_PRESET_SECTIONS[key] || [];
	const forbidden = getForbiddenSectionSet(key);
	const cachedTitles = extractSectionTitles(getCachedContentForTechnique(key))
		.map((item)=>mapLegacySectionTitle(key, item))
		.filter(Boolean)
		.filter((item)=>!forbidden || !forbidden.has(normalizeSectionTitle(item)));
	if(isJieQiSplitSettingKey(key)){
		const wanted = new Set(preset.map((item)=>normalizeSectionTitle(item)));
		const filtered = cachedTitles.filter((item)=>wanted.has(normalizeSectionTitle(item)));
		return uniqueArray([...preset, ...filtered]);
	}
	return uniqueArray([...preset, ...cachedTitles].filter((item)=>!forbidden || !forbidden.has(normalizeSectionTitle(item))));
}

function splitContentSections(content){
	const lines = `${content || ''}`.split('\n');
	const sections = [];
	let currentTitle = '';
	let currentLines = [];

	const pushCurrent = ()=>{
		if(!currentTitle && currentLines.every((line)=>!`${line || ''}`.trim())){
			currentLines = [];
			return;
		}
		sections.push({
			title: currentTitle,
			lines: currentLines.slice(0),
		});
		currentLines = [];
	};

	lines.forEach((line)=>{
		const title = parseSectionTitleLine(line);
		if(title){
			if(currentLines.length){
				pushCurrent();
			}
			currentTitle = title;
			currentLines = [line];
			return;
		}
		currentLines.push(line);
	});
	if(currentLines.length){
		pushCurrent();
	}
	return sections;
}

function filterContentByWantedSections(content, wanted){
	const sections = splitContentSections(content);
	if(sections.length === 0){
		return content;
	}
	if(!wanted || wanted.size === 0){
		return '';
	}
	const kept = sections.filter((sec)=>{
		if(!sec.title){
			return true;
		}
		return wanted.has(normalizeSectionTitle(sec.title));
	});
	if(kept.length === 0){
		return '';
	}
	const out = [];
	kept.forEach((sec)=>{
		if(out.length && out[out.length - 1] !== ''){
			out.push('');
		}
		out.push(...sec.lines);
	});
	return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function mapLegacySectionTitle(key, title){
	const normalized = normalizeSectionTitle(title);
	// v24：返照/小限/太阳弧/流年 旧[星盘信息]段拆为[本命盘配置]+[时段盘配置]，老用户存的 星盘信息 迁到 时段盘配置。
	if(key === 'profection' || key === 'solararc' || key === 'solarreturn' || key === 'lunarreturn' || key === 'givenyear'){
		if(normalized === '星盘信息'){
			return '时段盘配置';
		}
		return normalized;
	}
	if(key === 'jaynesprog'){
		// v31:首段名「赤纬推运（Jayne Declination）」对齐 builder 实产「赤纬推运（Declination）」(去 Jayne 死段);老用户存的旧段名迁移,避免被当陌生段过滤掉。
		if(normalized === '赤纬推运（Jayne Declination）'){
			return '赤纬推运（Declination）';
		}
		return normalized;
	}
	if(key === 'tongshefa'){
		if(normalized === '互潜'){
			return '潜藏';
		}
		if(normalized === '错亲'){
			return '亲和';
		}
		if(normalized === '统摄法起盘'){
			return '本卦';
		}
		return normalized;
	}
	if(key === 'qimen'){
		if(normalized === '八宫'){
			return '八宫详解';
		}
		if(normalized === '演卦'){
			return '奇门演卦';
		}
		if(normalized === '九宫'){
			return '九宫方盘';
		}
		if(normalized === '右侧栏目' || normalized === '概览'){
			return '盘面要素';
		}
		// 旧版 preset 误写「九宫与宫内星体」(奇门实际产出[旺相休囚死·月令能量])→ 老用户自定义里若残留,归一到真实段。
		if(normalized === '九宫与宫内星体'){
			return '旺相休囚死·月令能量';
		}
	}
	if(key === 'liureng'){
		if(normalized.startsWith('三传(')){
			return '三传';
		}
	}
	if(key === 'mundane'){
		// 地区盘/入宫地理分野段头随数据集动态(如「地理分野·世俗黄道分野」)→ 归一到静态[地理分野]
		// (内容侧已静态化为[地理分野];此分支额外兜住老用户自定义里残留的带数据集后缀的旧段名)。
		if(normalized.startsWith('地理分野')){
			return '地理分野';
		}
	}
	if(key === 'sanshiunited'){
		if(normalized === '状态'){
			return '概览';
		}
		if(normalized === '八宫'){
			return '八宫详解';
		}
		if(normalized === '大格'){
			return '六壬大格';
		}
		if(normalized === '小局'){
			return '六壬小局';
		}
		if(normalized === '参考'){
			return '六壬参考';
		}
		if(normalized === '六壬格局概览'){
			return '六壬概览';
		}
	}
	if(key === 'sixyao'){
		if(normalized === '起卦方式'){
			return '卦象';
		}
		if(normalized === '卦辞'){
			return '卦辞与断语';
		}
	}
	if(key === 'wuzhao'){
		if(normalized === '五兆'){
			return '揲筮';
		}
		if(normalized === '标记'){
			return '特殊标记';
		}
	}
	if(key === 'taixuan'){
		if(normalized === '全文' || normalized === '条文'){
			return '表';
		}
	}
	if(key === 'jingjue'){
		if(normalized === '起盘'){
			return '起课';
		}
	}
	if(key === 'shenyishu'){
		if(normalized === '干支' || normalized === '五行'){
			return '干支与五行';
		}
		if(normalized === '五行法则'){
			return '五行法则';
		}
	}
	if(key === 'qizhengkin'){
		if(normalized === '命宫'){
			return '命宫解读';
		}
		if(normalized === '宿度'){
			return '星曜';
		}
	}
	if(key === 'tieban'){
		if(normalized === '宫位'){
			return '十二宫';
		}
	}
	if(key === 'cetian'){
		const palaceMap = {
			命宫: '命宮',
			兄弟宫: '兄弟宮',
			夫妻宫: '夫妻宮',
			子女宫: '子女宮',
			财帛宫: '財帛宮',
			疾厄宫: '疾厄宮',
			迁移宫: '遷移宮',
			交友宫: '交友宮',
			官禄宫: '官祿宮',
			田宅宫: '田宅宮',
			福德宫: '福德宮',
			父母宫: '父母宮',
			十八飞星: '星曜属性',
		};
		if(palaceMap[normalized]){
			return palaceMap[normalized];
		}
	}
	return normalized;
}

function getForbiddenSectionSet(key){
	const list = AI_EXPORT_FORBIDDEN_SECTIONS[key];
	if(!list || !list.length){
		return null;
	}
	return new Set(list.map((item)=>normalizeSectionTitle(item)).filter(Boolean));
}

function stripForbiddenSections(content, key){
	const forbidden = getForbiddenSectionSet(key);
	if(!forbidden || !content){
		return content;
	}
	const sections = splitContentSections(content);
	if(!sections.length){
		return content;
	}
	const kept = sections.filter((sec)=>{
		if(!sec.title){
			return true;
		}
		const title = normalizeSectionTitle(sec.title);
		return !forbidden.has(title);
	});
	if(!kept.length){
		return '';
	}
	const out = [];
	kept.forEach((sec)=>{
		if(out.length && out[out.length - 1] !== ''){
			out.push('');
		}
		out.push(...sec.lines);
	});
	return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function applyUserSectionFilter(content, key){
	const settings = loadAIExportSettings();
	const selected = settings.sections[key];
	if(!Array.isArray(selected)){
		return stripForbiddenSections(content, key);
	}
	const preset = Array.isArray(AI_EXPORT_PRESET_SECTIONS[key]) ? AI_EXPORT_PRESET_SECTIONS[key] : [];
	const picked = selected.length ? selected.slice(0) : preset.slice(0);
	if(key === 'jinkou'){
		picked.push('金口诀速览');
	}else if(key === 'liureng'){
		// 格局参考为六壬导出的核心内容，避免被旧设置误过滤掉。
		picked.push('大格', '小局', '参考', '概览');
	}else if(key === 'qimen'){
		// 新增分段可能被旧配置遗漏，默认保留遁甲关键输出。
		picked.push('盘面要素', '奇门演卦', '八宫详解');
	}else if(key === 'sanshiunited'){
		// 新增三式合一分段：六壬格局参考与八宫详解。
		picked.push('六壬大格', '六壬小局', '六壬参考', '六壬概览', '八宫详解');
	}else if(key === 'horary'){
		// 「月亮的故事 / 相位全览」为卜卦核心征象，避免被旧设置误过滤掉。
		picked.push('月亮的故事', '相位全览');
	}
	const forbidden = getForbiddenSectionSet(key);
	const normalizedPicked = picked
		.map((item)=>mapLegacySectionTitle(key, item))
		.filter(Boolean)
		.filter((item)=>!forbidden || !forbidden.has(normalizeSectionTitle(item)));
	const wanted = new Set(uniqueArray(normalizedPicked));
	if(wanted.size === 0){
		return stripForbiddenSections(content, key);
	}
	const filtered = filterContentByWantedSections(content, wanted);
	if(!`${filtered || ''}`.trim()){
		// 用户设置与实际分段不一致时回退原文，避免导出空白。
		return stripForbiddenSections(content, key);
	}
	return stripForbiddenSections(filtered, key);
}

function getJieQiWantedSections(settings, activeKey = 'jieqi'){
	const sections = settings && settings.sections && typeof settings.sections === 'object'
		? settings.sections
		: {};
	if(isJieQiSplitSettingKey(activeKey)){
		const defaults = AI_EXPORT_PRESET_SECTIONS[activeKey] || [];
		const picked = Object.prototype.hasOwnProperty.call(sections, activeKey)
			? (Array.isArray(sections[activeKey]) ? sections[activeKey] : [])
			: defaults;
		return new Set(picked.map((item)=>normalizeSectionTitle(item)).filter(Boolean));
	}
	const hasSplitConfig = JIEQI_SPLIT_SETTING_KEYS.some((key)=>Object.prototype.hasOwnProperty.call(sections, key));
	if(!hasSplitConfig){
		if(!Object.prototype.hasOwnProperty.call(sections, 'jieqi')){
			return null;
		}
		const legacy = Array.isArray(sections.jieqi) ? sections.jieqi : [];
		return new Set(legacy.map((item)=>normalizeSectionTitle(item)));
	}
	const wanted = new Set();
	JIEQI_SPLIT_SETTING_KEYS.forEach((key)=>{
		const defaults = AI_EXPORT_PRESET_SECTIONS[key] || [];
		const picked = Object.prototype.hasOwnProperty.call(sections, key)
			? (Array.isArray(sections[key]) ? sections[key] : [])
			: defaults;
		picked.forEach((item)=>{
			const normalized = normalizeSectionTitle(item);
			if(normalized){
				wanted.add(normalized);
			}
		});
	});
	return wanted;
}

function applyUserSectionFilterByContext(content, key){
	if(key !== 'jieqi' && !isJieQiSplitSettingKey(key)){
		return applyUserSectionFilter(content, key);
	}
	const settings = loadAIExportSettings();
	const wanted = getJieQiWantedSections(settings, key);
	if(wanted === null){
		return content;
	}
	const filtered = filterContentByWantedSections(content, wanted);
	if(!`${filtered || ''}`.trim()){
		return content;
	}
	return filtered;
}

function trimPlanetInfoBySetting(content, setting){
	const source = `${content || ''}`;
	const mode = normalizePlanetInfoSetting(setting);
	const showHouse = mode.showHouse === 1;
	const showRuler = mode.showRuler === 1;
	if(showHouse && showRuler){
		return source;
	}
	const isPlanetInfoInner = (inner)=>{
		const txt = `${inner || ''}`.trim();
		if(!txt){
			return false;
		}
		if(/^后天[:：]/.test(txt)){
			return true;
		}
		if(/\b\d{1,2}th\b/i.test(txt)){
			return true;
		}
		if(/\b\d{1,2}R(?:\d{1,2}R)*\b/i.test(txt)){
			return true;
		}
		if(/主.+宫/.test(txt)){
			return true;
		}
		if(/宫位未知|主宫未知/.test(txt)){
			return true;
		}
		if(/[一二三四五六七八九十]+宫/.test(txt)){
			return true;
		}
		return false;
	};
	const splitPlanetInfoParts = (inner)=>{
		const txt = `${inner || ''}`.replace(/^后天[:：]\s*/, '').trim();
		const segs = txt.split(/[；;]/).map((item)=>`${item || ''}`.trim()).filter(Boolean);
		let housePart = '';
		let rulerPart = '';
		segs.forEach((seg)=>{
			if(!housePart && /^(\d{1,2}th|-)$/i.test(seg)){
				housePart = seg;
				return;
			}
			if(!rulerPart && /^\d{1,2}R(?:\d{1,2}R)*$/i.test(seg)){
				rulerPart = seg.toUpperCase();
				return;
			}
			if(!rulerPart && (/^主/.test(seg) || /\b\d{1,2}R(?:\d{1,2}R)*\b/i.test(seg))){
				rulerPart = seg;
				return;
			}
			if(!housePart && /宫/.test(seg)){
				housePart = seg;
				return;
			}
			if(!housePart){
				housePart = seg;
				return;
			}
			if(!rulerPart){
				rulerPart = seg;
			}
		});
		if(!housePart){
			const houseMatch = txt.match(/\b(\d{1,2}th|-)\b/i);
			if(houseMatch && houseMatch[1]){
				housePart = houseMatch[1];
			}
		}
		if(!rulerPart){
			const rulerMatch = txt.match(/\b(\d{1,2}R(?:\d{1,2}R)*)\b/i);
			if(rulerMatch && rulerMatch[1]){
				rulerPart = rulerMatch[1].toUpperCase();
			}
		}
		return {
			housePart: `${housePart || ''}`.trim(),
			rulerPart: `${rulerPart || ''}`.trim(),
		};
	};
	const replaceBracket = (whole, left, inner, right)=>{
		if(!isPlanetInfoInner(inner)){
			return whole;
		}
		const one = splitPlanetInfoParts(inner);
		const pieces = [];
		if(showHouse && one.housePart){
			pieces.push(one.housePart);
		}
		if(showRuler && one.rulerPart){
			pieces.push(one.rulerPart);
		}
		if(!pieces.length){
			return '';
		}
		return `${left}${pieces.join('; ')}${right}`;
	};
	let out = source.replace(/([（(])([^（）()]*)([）)])/g, replaceBracket);
	return out
		.replace(/[ \t]{2,}/g, ' ')
		.replace(/([（(])\s*([）)])/g, '')
		.replace(/\n{3,}/g, '\n\n');
}

function applyPlanetInfoFilterByContext(content, key){
	if(!isPlanetInfoTechnique(key)){
		return content;
	}
	const settings = loadAIExportSettings();
	const planetInfo = getPlanetInfoSettingByTechnique(settings, key);
	return trimPlanetInfoBySetting(content, planetInfo);
}

function normalizeWhitespace(text){
	return (text || '')
		.replace(/\r\n/g, '\n')
		.split('\n')
		.map((line)=>line.replace(/[\t ]+/g, ' ').replace(/[ ]+$/g, '').trimEnd())
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

function replaceStandaloneToken(text, token, replacement){
	const esc = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const pattern = new RegExp(`(^|[\\s,，;；:：()\\[\\]{}\\/\\\\|])${esc}(?=$|[\\s,，;；:：()\\[\\]{}\\/\\\\|])`, 'g');
	return text.replace(pattern, `$1${replacement}`);
}

function likelyHasFontEncodedTokens(text){
	const src = `${text || ''}`;
	if(!src){
		return false;
	}
	if(/[☉☽☿♀♂♃♄♅♆♇⚷☊☋⊗♈♉♊♋♌♍♎♏♐♑♒♓☌⚹✶□△☍]/.test(src)){
		return true;
	}
	if(/(^|[\s,，;；:：()\[\]{}\\/|])([A-Za-z${}])(?=$|[\s,，;；:：()\[\]{}\\/|])/m.test(src)){
		return true;
	}
	if(/[a-l](?=\d{1,2}分)/.test(src)){
		return true;
	}
	return false;
}

function replaceFontEncodedTokens(text){
	let out = text || '';

	// 27˚k52分 / 27°k52分 -> 27˚水瓶52分
	out = out.replace(/(^|[^A-Za-z0-9\u4E00-\u9FFF])(\d{1,2})\s*[˚°º]\s*([a-l])\s*([0-5]?\d)\s*分/gi, (m, p1, deg, code, min)=>{
		const zodiac = ZODIAC_CODE_MAP[code.toLowerCase()] || code;
		return `${p1}${deg}˚${zodiac}${min}分`;
	});
	// 16k16分 -> 16˚水瓶16分
	out = out.replace(/(^|[^A-Za-z0-9\u4E00-\u9FFF])(\d{1,2})\s*([a-l])\s*([0-5]?\d)\s*分/gi, (m, p1, deg, code, min)=>{
		const zodiac = ZODIAC_CODE_MAP[code.toLowerCase()] || code;
		return `${p1}${deg}˚${zodiac}${min}分`;
	});

	// A（日）/ 8（人龙星）/ {（信心点） 这类前缀编码，保留括号中的中文名。
	out = out.replace(/(^|[\s\-•*])([A-Za-z0-9${}])\s*[（(]\s*([^）)]+)\s*[）)]/gm, (m, p1, token, label)=>{
		const name = (label || '').trim();
		if(!name){
			const mapped = STANDALONE_TOKEN_MAP[token];
			return `${p1}${mapped || ''}`;
		}
		return `${p1}${name}`;
	});

	Object.keys(STANDALONE_TOKEN_MAP).forEach((token)=>{
		out = replaceStandaloneToken(out, token, STANDALONE_TOKEN_MAP[token]);
	});

	// 星座单字母残留（如: a , 土 , 海王）转中文星座名。
	Object.keys(ZODIAC_STANDALONE_MAP).forEach((token)=>{
		out = replaceStandaloneToken(out, token, ZODIAC_STANDALONE_MAP[token]);
	});

	// 去掉孤立的编码符号残留。
	out = out.replace(/(^|[\s,，;；:：\-•*])([{]+)(?=$|[\s,，;；:：\-•*])/g, '$1');

	return out;
}

function canonicalLine(text){
	return (text || '')
		.replace(/\s+/g, '')
		.replace(/[，,。；;:：、·'"`~!！?？\[\]\(\)（）{}<>《》【】]/g, '')
		.trim();
}

function isNoiseLine(text){
	const val = (text || '').trim();
	if(!val){
		return true;
	}
	if(val === '[图形标注文本]'){
		return true;
	}
	if(val === '打印星盘'){
		return true;
	}
	if(/^[A-Za-z${}|\\/]{1,2}$/.test(val)){
		return true;
	}
	if(/^\[符号U\+[0-9A-F]+\]$/.test(val)){
		return true;
	}
	return false;
}

function beautifyForAI(text){
	const srcLines = (text || '').split('\n');
	const out = [];
	let sectionSeen = new Set();

	const pushLine = (line)=>{
		const val = line.trim();
		if(!val || isNoiseLine(val)){
			return;
		}
		if(/^\[.+\]$/.test(val)){
			if(out.length && out[out.length - 1] !== ''){
				out.push('');
			}
			out.push(val);
			out.push('');
			sectionSeen = new Set();
			return;
		}
		const clean = val.replace(/^[-*]\s*/, '').trim();
		if(!clean || isNoiseLine(clean)){
			return;
		}
		const key = canonicalLine(clean);
		if(!key || sectionSeen.has(key)){
			return;
		}
		sectionSeen.add(key);
		out.push(`- ${clean}`);
		out.push('');
	};

	srcLines.forEach((line)=>{
		if(!line){
			return;
		}
		// 长句按常见断句符拆分，提高可读性
		const broken = line.length > 100 ? line.replace(/([。；;！？!?])/g, '$1\n') : line;
		broken.split('\n').forEach((seg)=>pushLine(seg));
	});

	while(out.length && !out[out.length - 1]){
		out.pop();
	}

	return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function collectSvgTexts(root){
	if(!root){
		return [];
	}
	const vals = [];
	root.querySelectorAll('svg text').forEach((n)=>{
		const t = (n.textContent || '').trim();
		if(t){
			vals.push(t);
		}
	});
	return uniqueArray(vals);
}

function getTabsNavItems(container){
	if(!container){
		return [];
	}
	return Array.from(container.querySelectorAll('.ant-tabs-nav .ant-tabs-tab'));
}

function getDirectActivePane(container){
	if(!container){
		return null;
	}
	const holder = Array.from(container.children).find((n)=>n.classList && n.classList.contains('ant-tabs-content-holder'));
	if(holder){
		const content = holder.querySelector('.ant-tabs-content');
		if(content){
			const direct = Array.from(content.children).find((n)=>n.classList && n.classList.contains('ant-tabs-tabpane-active'));
			if(direct){
				return direct;
			}
		}
		const any = holder.querySelector('.ant-tabs-tabpane-active');
		if(any){
			return any;
		}
	}
	return container.querySelector('.ant-tabs-tabpane-active');
}

function findTabsContainerByLabels(scopeRoot, labels, requireAll){
	if(!scopeRoot){
		return null;
	}
	const tabs = Array.from(scopeRoot.querySelectorAll('.ant-tabs'));
	for(let i=0; i<tabs.length; i++){
		const tab = tabs[i];
		const names = getTabsNavItems(tab).map((n)=>textOf(n));
		if(names.length === 0){
			continue;
		}
		let ok = false;
		if(requireAll){
			ok = labels.every((k)=>names.some((v)=>v.includes(k)));
		}else{
			ok = labels.some((k)=>names.some((v)=>v.includes(k)));
		}
		if(ok){
			return tab;
		}
	}
	return null;
}

function findTopTabsContainer(root){
	if(!root){
		return null;
	}
	const topLabelHints = [
		'星盘',
		'三维盘',
		'星运',
		'推运盘',
		'辅盘',
		'量化盘',
		'合盘',
		'关系盘',
		'节气盘',
		'十三分盘',
		'占星地图',
		'希腊星术',
		'印度占星',
		'印度律盘',
		'黄历',
		'骰子',
		'辅助',
		'八字紫微',
		'其他术数',
		'易与三式',
		'六爻',
		'六壬',
		'遁甲',
		'太乙',
		'七政四余',
		'风水',
		'三式合一',
	];
	const tabs = Array.from(root.querySelectorAll('.ant-tabs'));
	let best = null;
	let bestScore = -1;
	let bestNavCount = -1;
	for(let i=0; i<tabs.length; i++){
		const names = getTabsNavItems(tabs[i]).map((n)=>textOf(n));
		if(names.includes('星盘') && (names.includes('易与三式') || names.includes('其他术数') || names.includes('六爻'))){
			return tabs[i];
		}
		if(!names.length){
			continue;
		}
		let score = 0;
		topLabelHints.forEach((hint)=>{
			if(names.some((txt)=>txt && txt.includes(hint))){
				score += 1;
			}
		});
		const navCount = names.filter(Boolean).length;
		if(score > bestScore || (score === bestScore && navCount > bestNavCount)){
			bestScore = score;
			best = tabs[i];
			bestNavCount = navCount;
		}
	}
	if(best && bestScore > 0){
		return best;
	}
	const leftTabs = root.querySelector('.ant-tabs-left');
	if(leftTabs){
		return leftTabs;
	}
	if(best){
		return best;
	}
	return tabs[0] || null;
}

function detectChartTypeInPane(scopeRoot){
	if(!scopeRoot){
		return '';
	}
	const items = Array.from(scopeRoot.querySelectorAll('.ant-select-selection-item'));
	for(let i=0; i<items.length; i++){
		const txt = textOf(items[i]);
		if(txt.includes('外盘')){
			return txt;
		}
	}
	return '';
}

function findIndiaActivePane(scopeRoot){
	if(!scopeRoot){
		return {
			pane: null,
			label: '',
		};
	}
	const tabs = Array.from(scopeRoot.querySelectorAll('.ant-tabs'));
	for(let i=0; i<tabs.length; i++){
		const tab = tabs[i];
		const names = getTabsNavItems(tab).map((n)=>textOf(n));
		if(!names.some((n)=>n.includes('命盘'))){
			continue;
		}
		if(!names.some((n)=>n.includes('律盘'))){
			continue;
		}
		const active = getTabsNavItems(tab).find((n)=>n.classList.contains('ant-tabs-tab-active'));
		return {
			pane: getDirectActivePane(tab),
			label: textOf(active),
		};
	}
	return {
		pane: null,
		label: '',
	};
}

function resolveActiveContext(){
	const root = document.getElementById('mainContent') || document.body;
	const topTabs = findTopTabsContainer(root);
	if(!topTabs){
		return {
			displayName: '当前技术',
			key: 'generic',
			domain: null,
			scopeRoot: root,
		};
	}

	const topActiveTab = getTabsNavItems(topTabs).find((n)=>n.classList.contains('ant-tabs-tab-active'));
	const topLabel = textOf(topActiveTab) || '当前技术';
	const topPane = getDirectActivePane(topTabs) || root;

	const context = {
		displayName: topLabel,
		key: 'generic',
		domain: null,
		scopeRoot: topPane,
		topLabel,
		subLabel: '',
		chartType: '',
	};

	const predictiveLabelMap = [
		// 「主限法盘」必须排在「主限法」前:匹配用 subLabel.includes(label),「主限法盘」包含「主限法」。
		{ label: '主限法盘', key: 'primarydirchart', name: '星运-主限法盘' },
		{ label: '主限法', key: 'primarydirect', name: '星运-主限法' },
		{ label: '黄道星释', key: 'zodialrelease', name: '星运-黄道星释' },
		{ label: '法达星限', key: 'firdaria', name: '星运-法达星限' },
		{ label: '界推运', key: 'distributions', name: '星运-界推运' },
		{ label: '年龄推进点', key: 'agepoint', name: '星运-年龄推进点' },
		{ label: '小限法', key: 'profection', name: '星运-小限法' },
		{ label: '太阳弧', key: 'solararc', name: '星运-太阳弧' },
		{ label: '太阳返照', key: 'solarreturn', name: '星运-太阳返照' },
		{ label: '月亮返照', key: 'lunarreturn', name: '星运-月亮返照' },
		{ label: '流年法', key: 'givenyear', name: '星运-流年法' },
		{ label: '十年大运', key: 'decennials', name: '星运-十年大运' },
		{ label: '行星年龄', key: 'planetaryages', name: '星运-行星年龄' },
		{ label: '恒星推运', key: 'vedicprog', name: '星运-恒星推运' },
		{ label: '赤纬推运', key: 'jaynesprog', name: '星运-赤纬推运' },
		{ label: '行星弧', key: 'planetaryarc', name: '星运-行星弧' },
		{ label: '波斯向运', key: 'persiandirected', name: '星运-波斯向运' },
		{ label: '129年系统', key: 'yearsystem129', name: '星运-129年系统' },
		{ label: 'Balbillus', key: 'balbillus', name: '星运-Balbillus' },
		{ label: '三分主星', key: 'triplicityrulers', name: '星运-三分主星' },
		{ label: '数字相位', key: 'keypoints', name: '星运-数字相位' },
		{ label: '月相推运', key: 'lunationphase', name: '星运-月相推运' },
		{ label: '多重回归', key: 'extrareturns', name: '星运-多重回归' },
	];
	const predictiveByTop = predictiveLabelMap.find((item)=>topLabel && topLabel.includes(item.label));
	if(predictiveByTop){
		context.key = predictiveByTop.key;
		context.domain = 'predictive_raw';
		context.displayName = predictiveByTop.name;
		return context;
	}
	// 右侧子标签直接激活时，顶层标题可能不是“星运/量化盘/合盘/印度占星”等；
	// 这里优先按可见标签做直达识别，避免落入 generic 导致导出误判为空。
	if(topLabel.includes('行星中点')){
		context.key = 'germany';
		context.displayName = '量化盘';
		return context;
	}
	if(topLabel.includes('比较盘') || topLabel.includes('组合盘')
		|| topLabel.includes('影响盘') || topLabel.includes('时空中点盘')
		|| topLabel.includes('马克斯盘')){
		context.key = 'relative';
		context.displayName = `合盘-${topLabel}`;
		return context;
	}
	if(topLabel.includes('命盘') || /(^|\s)\d+\s*律盘$/.test(topLabel)){
		context.key = 'indiachart';
		context.displayName = '印度占星';
		return context;
	}
	if(topLabel.includes('节气') || topLabel.includes('春分') || topLabel.includes('夏至')
		|| topLabel.includes('秋分') || topLabel.includes('冬至')){
		context.key = 'jieqi';
		context.displayName = '节气盘';
		return context;
	}
	if(topLabel === '八字' || topLabel.includes('八字')){
		context.key = 'bazi';
		context.displayName = '八字';
		return context;
	}
	if(topLabel.includes('紫微')){
		context.key = 'ziwei';
		context.displayName = '紫微斗数';
		return context;
	}

	if(topLabel.includes('星运') || topLabel.includes('推运盘')){
		const subTabs = findTabsContainerByLabels(topPane, ['主限法', '黄道星释', '法达星限', '小限法', '太阳弧', '太阳返照', '月亮返照', '流年法', '十年大运'], false);
		const subActiveTab = subTabs ? getTabsNavItems(subTabs).find((n)=>n.classList.contains('ant-tabs-tab-active')) : null;
		const subLabel = textOf(subActiveTab);
		context.subLabel = subLabel || '';
		context.scopeRoot = subTabs ? (getDirectActivePane(subTabs) || topPane) : topPane;
		const predictiveBySub = predictiveLabelMap.find((item)=>subLabel && subLabel.includes(item.label));
		if(predictiveBySub){
			context.key = predictiveBySub.key;
			context.domain = 'predictive_raw';
			context.displayName = predictiveBySub.name;
			return context;
		}
		// 子标签识别失败时不要回落到星盘；保留 direction 触发 store 回退，
		// 否则会误读 astrochart 快照并造成“当前页面没有可导出文本”。
		context.key = 'direction';
		context.domain = 'predictive_raw';
		context.displayName = subLabel ? `星运-${subLabel}` : '星运';
		return context;
	}
	const directCnYiBuMap = [
		{ label: '统摄法', key: 'tongshefa', domain: 'tongshefa', name: '统摄法' },
		{ label: '皇极经世', key: 'huangji', domain: 'huangji', name: '皇极经世' },
		{ label: '皇極經世', key: 'huangji', domain: 'huangji', name: '皇极经世' },
		{ label: '五兆', key: 'wuzhao', domain: 'kentang_raw', name: '五兆' },
		{ label: '太玄', key: 'taixuan', domain: 'kentang_raw', name: '太玄筮法' },
		{ label: '荆诀', key: 'jingjue', domain: 'kentang_raw', name: '荆诀' },
		{ label: '荊訣', key: 'jingjue', domain: 'kentang_raw', name: '荆诀' },
		{ label: '神易数', key: 'shenyishu', domain: 'kentang_raw', name: '神易数' },
		{ label: '神易數', key: 'shenyishu', domain: 'kentang_raw', name: '神易数' },
		{ label: '天文地占', key: 'geomancy', domain: 'kentang_raw', name: '天文地占' },
		{ label: '地占', key: 'geomancy', domain: 'kentang_raw', name: '天文地占' },
		{ label: '塔罗', key: 'tarot', domain: 'kentang_raw', name: '塔罗' },
		{ label: '六爻', key: 'sixyao', domain: 'sixyao', name: '六爻' },
		{ label: '易卦', key: 'sixyao', domain: 'sixyao', name: '六爻' },
		{ label: '六壬', key: 'liureng', domain: 'liureng', name: '大六壬' },
		{ label: '金口诀', key: 'jinkou', domain: 'jinkou', name: '金口诀' },
		{ label: '遁甲', key: 'qimen', domain: 'qimen', name: '奇门遁甲' },
		{ label: '太乙', key: 'taiyi', domain: null, name: '太乙' },
	];
	const directCnYiBu = directCnYiBuMap.find((item)=>topLabel && topLabel.includes(item.label));
	if(directCnYiBu){
		context.key = directCnYiBu.key;
		context.domain = directCnYiBu.domain;
		context.displayName = directCnYiBu.name;
		return context;
	}
	if(topLabel.includes('辅盘')){
		const subTabs = findTabsContainerByLabels(topPane, ['量化盘', '十三分盘', '占星地图', '骰子'], false);
		const subActiveTab = subTabs ? getTabsNavItems(subTabs).find((n)=>n.classList.contains('ant-tabs-tab-active')) : null;
		const subLabel = textOf(subActiveTab);
		context.subLabel = subLabel || '';
		context.scopeRoot = subTabs ? (getDirectActivePane(subTabs) || topPane) : topPane;
		// 🔒 显式映射每个辅盘子页 → 对应技法 key。**严禁默认成量化盘(germany)**——否则卜卦/择日/世俗/调波/龙盘点 AI导出全被串成量化盘。
		const auxSubMap = [
			{ label: '卜卦盘', key: 'horary', name: '卜卦盘' },
			{ label: '择日盘', key: 'election', name: '择日盘' },
			{ label: '世俗盘', key: 'mundane', name: '世俗盘' },
			{ label: '十三分盘', key: 'astrochart_like', name: '十三分盘' },
			{ label: '十二分盘', key: 'astrochart_like', name: '十二分盘' },
			{ label: '占星地图', key: 'astrochart_like', name: '占星地图' },
			{ label: '调波盘', key: 'astrochart_like', name: '调波盘' },
			{ label: '龙盘', key: 'astrochart_like', name: '龙盘' },
			{ label: '骰子', key: 'otherbu', name: '骰子' },
			{ label: '量化盘', key: 'germany', name: '量化盘' },
		];
		const auxHit = auxSubMap.find((item)=>subLabel && subLabel.includes(item.label));
		if(auxHit){
			context.key = auxHit.key;
			context.displayName = auxHit.name;
			return context;
		}
		// 子标签识别失败:回落 generic 走 store 兜底,绝不默认量化盘。
		context.key = 'generic';
		context.displayName = subLabel || '辅盘';
		return context;
	}
	if(topLabel.includes('星盘') || topLabel.includes('三维盘')){
		context.key = 'astrochart';
		return context;
	}
	if(topLabel.includes('七政四余')){
		context.key = 'guolao';
		return context;
	}
	if(topLabel.includes('量化盘')){
		context.key = 'germany';
		context.displayName = '量化盘';
		return context;
	}
	if(topLabel.includes('节气盘')){
		context.key = 'jieqi';
		context.displayName = '节气盘';
		return context;
	}
	if(topLabel.includes('印度占星') || topLabel.includes('印度律盘')){
		context.key = 'indiachart';
		context.displayName = '印度占星';
		return context;
	}
	if(topLabel.includes('十三分盘') || topLabel.includes('希腊星术')
		|| topLabel.includes('占星地图') || topLabel.includes('星体地图')){
		context.key = 'astrochart_like';
		context.displayName = topLabel.includes('十三分盘') ? '十三分盘' : (topLabel.includes('占星地图') ? '占星地图' : '十三分盘 / 占星地图');
		return context;
	}
	if(topLabel.includes('合盘') || topLabel.includes('关系盘')){
		const subTabs = findTabsContainerByLabels(topPane, ['比较盘', '组合盘', '影响盘', '时空中点盘', '马克斯盘'], false);
		const subActiveTab = subTabs ? getTabsNavItems(subTabs).find((n)=>n.classList.contains('ant-tabs-tab-active')) : null;
		const subLabel = textOf(subActiveTab);
		context.key = 'relative';
		context.subLabel = subLabel || '';
		context.scopeRoot = subTabs ? (getDirectActivePane(subTabs) || topPane) : topPane;
		context.displayName = subLabel ? `合盘-${subLabel}` : '合盘';
		return context;
	}
	if(topLabel.includes('骰子') || topLabel.includes('西洋游戏')){
		context.key = 'otherbu';
		context.displayName = '骰子';
		return context;
	}
	if(topLabel.includes('风水')){
		context.key = 'fengshui';
		context.displayName = '风水';
		return context;
	}
	if(topLabel.includes('三式合一')){
		context.key = 'sanshiunited';
		context.domain = 'sanshiunited';
		context.displayName = '三式合一';
		return context;
	}

	if(topLabel.includes('易与三式') || topLabel.includes('其他术数')){
		const subTabs = findTabsContainerByLabels(topPane, ['宿盘', '金口诀', '统摄法', '皇极经世'], false);
		if(!subTabs){
			context.key = 'cnyibu';
			return context;
		}

		const subActiveTab = getTabsNavItems(subTabs).find((n)=>n.classList.contains('ant-tabs-tab-active'));
		const subLabel = textOf(subActiveTab);
		const subPane = getDirectActivePane(subTabs) || topPane;
		context.scopeRoot = subPane;
		context.subLabel = subLabel;

		if(subLabel.includes('易卦') || subLabel.includes('六爻')){
			context.key = 'sixyao';
			context.domain = 'sixyao';
			context.displayName = '六爻';
			return context;
		}

		if(subLabel.includes('统摄法')){
			context.key = 'tongshefa';
			context.domain = 'tongshefa';
			context.displayName = '统摄法';
			return context;
		}

		if(subLabel.includes('皇极经世') || subLabel.includes('皇極經世')){
			context.key = 'huangji';
			context.domain = 'huangji';
			context.displayName = '皇极经世';
			return context;
		}

		if(subLabel.includes('五兆')){
			context.key = 'wuzhao';
			context.domain = 'kentang_raw';
			context.displayName = '五兆';
			return context;
		}

		if(subLabel.includes('太玄')){
			context.key = 'taixuan';
			context.domain = 'kentang_raw';
			context.displayName = '太玄筮法';
			return context;
		}

		if(subLabel.includes('荆诀') || subLabel.includes('荊訣')){
			context.key = 'jingjue';
			context.domain = 'kentang_raw';
			context.displayName = '荆诀';
			return context;
		}

		if(subLabel.includes('神易数') || subLabel.includes('神易數')){
			context.key = 'shenyishu';
			context.domain = 'kentang_raw';
			context.displayName = '神易数';
			return context;
		}

		if(subLabel.includes('六壬')){
			context.key = 'liureng';
			context.domain = 'liureng';
			context.displayName = '大六壬';
			return context;
		}

		if(subLabel.includes('金口诀')){
			context.key = 'jinkou';
			context.domain = 'jinkou';
			context.displayName = '金口诀';
			return context;
		}

		if(subLabel.includes('遁甲')){
			context.key = 'qimen';
			context.domain = 'qimen';
			context.displayName = '奇门遁甲';
			return context;
		}

		if(subLabel.includes('太乙')){
			context.key = 'taiyi';
			context.displayName = '太乙';
			return context;
		}

		if(subLabel.includes('宿盘')){
			const chartType = detectChartTypeInPane(subPane);
			context.chartType = chartType;
			if(chartType.includes('遁甲外盘')){
				context.key = 'qimen';
				context.domain = 'qimen';
				context.displayName = '奇门(遁甲外盘)';
			}else{
				context.key = 'suzhan';
				context.displayName = chartType ? `宿盘(${chartType})` : '宿盘';
			}
			return context;
		}

		context.key = 'cnyibu';
		context.displayName = subLabel || '其他术数';
	}
	if(topLabel.includes('八字紫微') || topLabel.includes('辅助')){
		const subTabs = findTabsContainerByLabels(topPane, ['八卦类象', '十二串宫', '八字规则', '八字', '紫微斗数'], false);
		if(!subTabs){
			context.key = 'cntradition';
			context.displayName = topLabel.includes('辅助') ? '辅助' : '八字紫微';
			return context;
		}
		const subActiveTab = getTabsNavItems(subTabs).find((n)=>n.classList.contains('ant-tabs-tab-active'));
		const subLabel = textOf(subActiveTab);
		const subPane = getDirectActivePane(subTabs) || topPane;
		context.scopeRoot = subPane;
		context.subLabel = subLabel;
		if(subLabel.includes('八字')){
			context.key = 'bazi';
			context.displayName = '八字';
			return context;
		}
		if(subLabel.includes('紫微')){
			context.key = 'ziwei';
			context.displayName = '紫微斗数';
			return context;
		}
		context.key = 'cntradition';
		context.displayName = subLabel || (topLabel.includes('辅助') ? '辅助' : '八字紫微');
		return context;
	}

	return context;
}

function resolveContextByAstroState(){
	try{
		const store = getStore();
		const astro = store && store.astro ? store.astro : null;
		if(!astro){
			return null;
		}
		const topTab = `${astro.currentTab || ''}`;
		const subTab = `${astro.currentSubTab || ''}`;
		if(!topTab){
			return null;
		}
		const predictiveMap = {
			primarydirect: { key: 'primarydirect', displayName: '星运-主限法', domain: 'predictive_raw' },
			primarydirchart: { key: 'primarydirchart', displayName: '星运-主限法盘', domain: 'predictive_raw' },
			zodialrelease: { key: 'zodialrelease', displayName: '星运-黄道星释', domain: 'predictive_raw' },
			firdaria: { key: 'firdaria', displayName: '星运-法达星限', domain: 'predictive_raw' },
			distributions: { key: 'distributions', displayName: '星运-界推运', domain: 'predictive_raw' },
			agepoint: { key: 'agepoint', displayName: '星运-年龄推进点', domain: 'predictive_raw' },
			profection: { key: 'profection', displayName: '星运-小限法', domain: 'predictive_raw' },
			solararc: { key: 'solararc', displayName: '星运-太阳弧', domain: 'predictive_raw' },
			solarreturn: { key: 'solarreturn', displayName: '星运-太阳返照', domain: 'predictive_raw' },
			lunarreturn: { key: 'lunarreturn', displayName: '星运-月亮返照', domain: 'predictive_raw' },
			givenyear: { key: 'givenyear', displayName: '星运-流年法', domain: 'predictive_raw' },
			decennials: { key: 'decennials', displayName: '星运-十年大运', domain: 'predictive_raw' },
			planetaryages: { key: 'planetaryages', displayName: '星运-行星年龄', domain: 'predictive_raw' },
			vedicprog: { key: 'vedicprog', displayName: '星运-恒星推运', domain: 'predictive_raw' },
			jaynesprog: { key: 'jaynesprog', displayName: '星运-赤纬推运', domain: 'predictive_raw' },
			planetaryarc: { key: 'planetaryarc', displayName: '星运-行星弧', domain: 'predictive_raw' },
			persiandirected: { key: 'persiandirected', displayName: '星运-波斯向运', domain: 'predictive_raw' },
			yearsystem129: { key: 'yearsystem129', displayName: '星运-129年系统', domain: 'predictive_raw' },
			balbillus: { key: 'balbillus', displayName: '星运-Balbillus', domain: 'predictive_raw' },
			triplicityrulers: { key: 'triplicityrulers', displayName: '星运-三分主星', domain: 'predictive_raw' },
			keypoints: { key: 'keypoints', displayName: '星运-数字相位', domain: 'predictive_raw' },
			lunationphase: { key: 'lunationphase', displayName: '星运-月相推运', domain: 'predictive_raw' },
			extrareturns: { key: 'extrareturns', displayName: '星运-多重回归', domain: 'predictive_raw' },
		};
		const auxchartMap = {
			germanytech: { key: 'germany', displayName: '量化盘' },
			hellenastro: { key: 'astrochart_like', displayName: '十三分盘' },
			// 十二分盘/谐波盘/黄道分盘/换置盘 皆由本命盘派生的占星式衍生盘,导出复用星盘式预设。
			dwadasamsa: { key: 'astrochart_like', displayName: '十二分盘' },
			harmonic: { key: 'astrochart_like', displayName: '谐波盘' },
			draconic: { key: 'astrochart_like', displayName: '黄道分盘' },
			relocation: { key: 'astrochart_like', displayName: '换置盘' },
			locastro: { key: 'astrochart_like', displayName: '占星地图' },
			otherbu: { key: 'otherbu', displayName: '骰子' },
			mundane: { key: 'mundane', displayName: '世俗盘' },
			// 卜卦盘/择日盘 在辅盘页亦可单开(与顶层同术),各归本预设,勿 fallback 到量化盘。
			horary: { key: 'horary', displayName: '卜卦盘', domain: 'horary' },
			election: { key: 'election', displayName: '择日盘', domain: 'election' },
		};
		const cnyibuMap = {
			suzhan: { key: 'suzhan', displayName: '宿盘' },
			guazhan: { key: 'sixyao', displayName: '六爻', domain: 'sixyao' },
			liureng: { key: 'liureng', displayName: '大六壬', domain: 'liureng' },
			jinkou: { key: 'jinkou', displayName: '金口诀', domain: 'jinkou' },
			dunjia: { key: 'qimen', displayName: '奇门遁甲', domain: 'qimen' },
			taiyi: { key: 'taiyi', displayName: '太乙' },
			tongshefa: { key: 'tongshefa', displayName: '统摄法', domain: 'tongshefa' },
			huangji: { key: 'huangji', displayName: '皇极经世', domain: 'huangji' },
			wuzhao: { key: 'wuzhao', displayName: '五兆', domain: 'kentang_raw' },
			taixuan: { key: 'taixuan', displayName: '太玄筮法', domain: 'kentang_raw' },
			jingjue: { key: 'jingjue', displayName: '荆诀', domain: 'kentang_raw' },
			shenyishu: { key: 'shenyishu', displayName: '神易数', domain: 'kentang_raw' },
		};
		switch(topTab){
		case 'astrochart':
			return { key: 'astrochart', displayName: '星盘' };
		case 'astrochart3D':
			return { key: 'astrochart', displayName: '三维盘' };
		case 'bazi':
			return { key: 'bazi', displayName: '八字' };
		case 'ziwei':
			return { key: 'ziwei', displayName: '紫微斗数' };
		case 'guazhan':
			return { key: 'sixyao', displayName: '六爻', domain: 'sixyao' };
		case 'liureng':
			return { key: 'liureng', displayName: '大六壬', domain: 'liureng' };
		case 'dunjia':
			return { key: 'qimen', displayName: '奇门遁甲', domain: 'qimen' };
		case 'taiyi':
			return { key: 'taiyi', displayName: '太乙' };
		case 'direction':
			return predictiveMap[subTab] || predictiveMap.primarydirect;
		case 'germanytech':
			return { key: 'germany', displayName: '量化盘' };
		case 'auxchart':
			return auxchartMap[subTab] || auxchartMap.germanytech;
		case 'relativechart':
			return { key: 'relative', displayName: '合盘' };
		case 'jieqichart':
			return { key: 'jieqi', displayName: '节气盘' };
		case 'locastro':
			return { key: 'astrochart_like', displayName: '占星地图' };
		case 'hellenastro':
			return { key: 'astrochart_like', displayName: '十三分盘' };
		case 'indiachart':
			return { key: 'indiachart', displayName: '印度占星' };
		case 'cntradition':
			if(subTab === 'bazi'){
				return { key: 'bazi', displayName: '八字' };
			}
			if(subTab === 'ziwei'){
				return { key: 'ziwei', displayName: '紫微斗数' };
			}
			return { key: 'cntradition', displayName: '辅助' };
		case 'cnyibu':
			return cnyibuMap[getRuntimeCnYiBuTab()] || cnyibuMap[subTab] || cnyibuMap.suzhan;
		case 'guolao':
			if(getStoredGuolaoEngineModeForExport() === 'kinastro'){
				return { key: 'qizhengkin', displayName: '七政四余（七政）', domain: 'kentang_raw' };
			}
			return { key: 'guolao', displayName: '七政四余' };
		case 'shusuan': {
			const technique = getRuntimeKinAstroTechnique('shusuan') || 'shaozi';
			return KINASTRO_EXPORT_CONTEXTS[technique] || KINASTRO_EXPORT_CONTEXTS.shaozi;
		}
		case 'yanqin':
			return KINASTRO_EXPORT_CONTEXTS.xianqin;
		case 'mingother': {
			// 「其他」页同 moduleKey 承载策天飞星/一掌经，按运行时激活子技法取上下文（默认策天）。
			const mingTech = getRuntimeKinAstroTechnique('mingother');
			if(mingTech === 'yizhangjing'){
				return KINASTRO_EXPORT_CONTEXTS.yizhangjing;
			}
			return KINASTRO_EXPORT_CONTEXTS.cetian;
		}
		case 'otherbu':
			return { key: 'otherbu', displayName: '骰子' };
		case 'fengshui':
			return { key: 'fengshui', displayName: '风水' };
		case 'sanshiunited':
			return { key: 'sanshiunited', displayName: '三式合一', domain: 'sanshiunited' };
		case 'astroreader':
			return { key: 'generic', displayName: '书籍阅读' };
		default:
			return null;
		}
	}catch(e){
		return null;
	}
}

function withStoreContextFallback(context){
	const base = context && typeof context === 'object'
		? { ...context }
		: { key: 'generic', displayName: '当前技术', domain: null, scopeRoot: null };
	const fallback = resolveContextByAstroState();
	if(!fallback || !fallback.key){
		return base;
	}
	const baseKey = `${base.key || ''}`;
	const fallbackKey = `${fallback.key || ''}`;
	const baseKnown = AI_EXPORT_TECHNIQUES.some((item)=>item.key === baseKey);
	const fallbackSpecific = !!fallbackKey && fallbackKey !== 'generic';
	const isBaseUmbrella = baseKey === 'generic'
		|| baseKey === 'cntradition'
		|| baseKey === 'cnyibu'
		|| baseKey === 'direction';
	const shouldUseFallback = !baseKey
		|| !baseKnown
		|| isBaseUmbrella
		|| (baseKey === 'guolao' && fallbackKey === 'qizhengkin')
		|| (baseKey === fallbackKey && fallbackSpecific);
	if(!shouldUseFallback){
		return base;
	}
	return {
		...base,
		...fallback,
	};
}

function detectJieQiSettingKeyByCurrentSnapshot(){
	const current = `${getModuleCachedContent('jieqi_current') || ''}`;
	return detectJieQiSettingKeyByLabel(current) || 'jieqi_meta';
}

function detectJieQiSettingKeyByLabel(label){
	const txt = `${label || ''}`;
	if(txt.includes('春分')){
		return 'jieqi_chunfen';
	}
	if(txt.includes('夏至')){
		return 'jieqi_xiazhi';
	}
	if(txt.includes('秋分')){
		return 'jieqi_qiufen';
	}
	if(txt.includes('冬至')){
		return 'jieqi_dongzhi';
	}
	return '';
}

function detectJieQiSettingKeyByScope(scopeRoot){
	const tab = findTabsContainerByLabels(scopeRoot, ['春分', '夏至', '秋分', '冬至'], false);
	if(!tab){
		return '';
	}
	const active = getTabsNavItems(tab).find((n)=>n.classList.contains('ant-tabs-tab-active'));
	return detectJieQiSettingKeyByLabel(textOf(active));
}

function resolveExportContextForPayload(rawContext){
	const context = rawContext && typeof rawContext === 'object'
		? { ...rawContext }
		: { key: 'generic', displayName: '当前页面' };
	if(context.key === 'direction'){
		return {
			...context,
			key: 'primarydirect',
			displayName: context.displayName || '星运-主限法',
		};
	}
	if(context.key === 'jieqi'){
		const splitKey = detectJieQiSettingKeyByScope(context.scopeRoot) || detectJieQiSettingKeyByCurrentSnapshot();
		if(splitKey){
			return {
				...context,
				key: splitKey,
				displayName: getTechniqueLabelByKey(splitKey) || context.displayName || '节气盘',
			};
		}
	}
	return context;
}

const KINASTRO_EXPORT_CONTEXTS = {
	shaozi: { key: 'shaozi', displayName: '邵子神数', domain: 'kentang_raw' },
	tieban: { key: 'tieban', displayName: '铁板神数', domain: 'kentang_raw' },
	fendjing: { key: 'fendjing', displayName: '鬼谷分定经', domain: 'kentang_raw' },
	beiji: { key: 'beiji', displayName: '北极神数', domain: 'kentang_raw' },
	nanji: { key: 'nanji', displayName: '南极神数', domain: 'kentang_raw' },
	chunzi: { key: 'chunzi', displayName: '蠢子数', domain: 'kentang_raw' },
	xianqin: { key: 'xianqin', displayName: '万化仙禽', domain: 'kentang_raw' },
	cetian: { key: 'cetian', displayName: '策天飞星', domain: 'kentang_raw' },
	canping: { key: 'canping', displayName: '邵子参评数' },   // 原生·模块快照（非 kentang）
	heluo: { key: 'heluo', displayName: '河洛理数' },
	yizhangjing: { key: 'yizhangjing', displayName: '一掌经' },
};

function getRuntimeKinAstroTechnique(group){
	try{
		if(typeof window === 'undefined'){
			return '';
		}
		const raw = window.__horosaKinAstroCurrent;
		if(raw && typeof raw === 'object'){
			if(group && raw[group]){
				return `${raw[group]}`;
			}
			if(raw.technique){
				return `${raw.technique}`;
			}
		}
		if(typeof raw === 'string'){
			return raw;
		}
		if(window.__horosaKinAstroTechnique){
			return `${window.__horosaKinAstroTechnique}`;
		}
	}catch(e){
	}
	return '';
}

function getRuntimeCnYiBuTab(){
	try{
		if(typeof window !== 'undefined' && window.__horosaCnyibuCurrentTab){
			return `${window.__horosaCnyibuCurrentTab}`;
		}
	}catch(e){
	}
	return '';
}

function getStoredGuolaoEngineModeForExport(){
	try{
		if(typeof window !== 'undefined' && window.localStorage){
			return window.localStorage.getItem('horosa.guolao.engineMode') === 'kinastro' ? 'kinastro' : 'horosa';
		}
	}catch(e){
	}
	return 'horosa';
}

export function getCurrentAIExportContext(){
	try{
		const context = resolveExportContextForPayload(withStoreContextFallback(resolveActiveContext()));
		return {
			key: context.key,
			displayName: context.displayName,
		};
	}catch(e){
		return {
			key: 'generic',
			displayName: '当前页面',
		};
	}
}

export function loadAIExportSettings(){
	try{
		if(typeof window === 'undefined' || !window.localStorage){
			return normalizeAIExportSettings(null);
		}
		const raw = window.localStorage.getItem(AI_EXPORT_SETTINGS_KEY);
		if(!raw){
			return normalizeAIExportSettings(null);
		}
		return normalizeAIExportSettings(JSON.parse(raw));
	}catch(e){
		return normalizeAIExportSettings(null);
	}
}

export function saveAIExportSettings(settings){
	const normalized = normalizeAIExportSettings(settings);
	try{
		if(typeof window !== 'undefined' && window.localStorage){
			window.localStorage.setItem(AI_EXPORT_SETTINGS_KEY, JSON.stringify(normalized));
		}
	}catch(e){
	}
	return normalized;
}

export function listAIExportTechniqueSettings(){
	const settings = loadAIExportSettings();
	return AI_EXPORT_TECHNIQUES.map((item)=>{
		const meaningMeta = getMeaningSettingMetaByTechnique(item.key);
		return {
			key: item.key,
			label: item.label,
			options: getOptionsForTechniqueKey(item.key),
			supportsPlanetInfo: isPlanetInfoTechnique(item.key),
			planetInfo: getPlanetInfoSettingByTechnique(settings, item.key),
			supportsAstroMeaning: isAstroMeaningTechnique(item.key) || isHoverMeaningTechnique(item.key),
			astroMeaning: getAstroMeaningSettingByTechnique(settings, item.key),
			astroMeaningTitle: meaningMeta.title,
			astroMeaningCheckbox: meaningMeta.checkbox,
		};
	});
}

function getExtractorKindByExportKey(key){
	const exportKey = normalizeExportKey(key);
	if(exportKey === 'astrochart' || exportKey === 'astrochart_like' || exportKey === 'indiachart'){
		return 'astro';
	}
	if(exportKey === 'mundane'){
		// 世俗盘:走刷新事件抓取(DivinationChartShell 写 detail.snapshotText),与预测同机制。
		return 'predictive';
	}
	if(exportKey === 'germany'){
		return 'germany';
	}
	if(exportKey === 'jieqi' || isJieQiSplitSettingKey(exportKey)){
		return 'jieqi';
	}
	if(isPredictiveExportKey(exportKey)){
		return 'predictive';
	}
	if(exportKey === 'sixyao'){
		return 'sixyao';
	}
	if(exportKey === 'liureng'){
		return 'liureng';
	}
	if(exportKey === 'jinkou'){
		return 'jinkou';
	}
	if(exportKey === 'qimen'){
		return 'qimen';
	}
	if(exportKey === 'sanshiunited'){
		return 'sanshiunited';
	}
	if(exportKey === 'tongshefa'){
		return 'tongshefa';
	}
	if(exportKey === 'huangji' || exportKey === 'wuzhao' || exportKey === 'taixuan' || exportKey === 'jingjue'
		|| exportKey === 'shenyishu' || exportKey === 'geomancy' || exportKey === 'tarot' || exportKey === 'shaozi' || exportKey === 'tieban' || exportKey === 'fendjing'
		|| exportKey === 'beiji' || exportKey === 'nanji' || exportKey === 'chunzi' || exportKey === 'xianqin'
		|| exportKey === 'cetian' || exportKey === 'qizhengkin' || exportKey === 'guolao' || exportKey === 'suzhan'
		|| exportKey === 'bazi' || exportKey === 'ziwei' || exportKey === 'horary' || exportKey === 'election'
		|| exportKey === 'canping' || exportKey === 'heluo' || exportKey === 'yizhangjing'){
		return `module:${snapshotModuleKeyByContextKey(exportKey)}`;
	}
	if(exportKey === 'taiyi'){
		return 'taiyi';
	}
	if(exportKey === 'relative'){
		return 'relative';
	}
	if(exportKey === 'otherbu'){
		return 'otherbu';
	}
	if(exportKey === 'fengshui'){
		return 'fengshui';
	}
	if(exportKey === 'generic'){
		return 'generic';
	}
	return '';
}

function getStructuredSnapshotKeysByExportKey(key){
	const exportKey = normalizeExportKey(key);
	if(exportKey === 'astrochart' || exportKey === 'astrochart_like'){
		return ['astro'];
	}
	if(exportKey === 'mundane'){
		return ['mundane'];
	}
	if(exportKey === 'indiachart'){
		return ['indiachart_current', 'indiachart'];
	}
	if(exportKey === 'jieqi' || isJieQiSplitSettingKey(exportKey)){
		return ['jieqi_current', 'jieqi'];
	}
	if(exportKey === 'sixyao'){
		return ['guazhan', 'sixyao'];
	}
	if(exportKey === 'qizhengkin'){
		return ['guolao-qizhengkin', 'qizhengkin'];
	}
	if(exportKey === 'generic'){
		return [];
	}
	if(isPredictiveExportKey(exportKey)
		|| exportKey === 'liureng'
		|| exportKey === 'jinkou'
		|| exportKey === 'qimen'
		|| exportKey === 'sanshiunited'
		|| exportKey === 'tongshefa'
		|| exportKey === 'taiyi'
		|| exportKey === 'relative'
		|| exportKey === 'germany'
		|| exportKey === 'guolao'
		|| exportKey === 'suzhan'
		|| exportKey === 'bazi'
		|| exportKey === 'ziwei'
		|| exportKey === 'otherbu'
		|| exportKey === 'fengshui'
		|| exportKey === 'horary'
		|| exportKey === 'election'){
		return [exportKey];
	}
	const moduleKey = snapshotModuleKeyByContextKey(exportKey);
	return moduleKey ? [moduleKey] : [];
}

export function getAIExportAuditMatrix(){
	return AI_EXPORT_TECHNIQUES.map((item)=>({
		key: item.key,
		label: item.label,
		presetSections: (AI_EXPORT_PRESET_SECTIONS[item.key] || []).slice(0),
		options: getOptionsForTechniqueKey(item.key),
		extractionKind: getExtractorKindByExportKey(item.key),
		snapshotModuleKey: snapshotModuleKeyByContextKey(item.key),
		structuredSnapshotKeys: getStructuredSnapshotKeysByExportKey(item.key),
		migrationEnabled: AI_EXPORT_SECTION_MIGRATION_KEYS.includes(item.key),
		supportsPlanetInfo: isPlanetInfoTechnique(item.key),
		supportsAstroMeaning: isAstroMeaningTechnique(item.key) || isHoverMeaningTechnique(item.key),
		isJieQiSplit: isJieQiSplitSettingKey(item.key),
	}));
}

export function getAIExportEffectiveSectionsForTechnique(key, settings = loadAIExportSettings()){
	const exportKey = normalizeExportKey(key);
	if(exportKey === 'jieqi' || isJieQiSplitSettingKey(exportKey)){
		const wanted = getJieQiWantedSections(settings, exportKey);
		return wanted ? Array.from(wanted) : [];
	}
	const source = settings && settings.sections && typeof settings.sections === 'object'
		? settings.sections
		: {};
	const selected = Array.isArray(source[exportKey]) ? source[exportKey] : [];
	const preset = Array.isArray(AI_EXPORT_PRESET_SECTIONS[exportKey]) ? AI_EXPORT_PRESET_SECTIONS[exportKey] : [];
	const picked = selected.length ? selected : preset;
	const forbidden = getForbiddenSectionSet(exportKey);
	return uniqueArray(picked
		.map((item)=>mapLegacySectionTitle(exportKey, item))
		.filter(Boolean)
		.filter((item)=>!forbidden || !forbidden.has(normalizeSectionTitle(item))));
}

// 把「按技法选段」过滤套到任意快照文本上（供 AI 挂载复用导出段设置，达成四同步）。
// 安全铁律：仅当用户对该技法**显式自定义了段**时才过滤；未自定义 → 原样返回（默认即现状、零回归）；
// 过滤后为空则回退原文，避免挂载空白。
export function applyAIExportSectionFilterToSnapshot(key, content, settings = loadAIExportSettings()){
	const text = `${content == null ? '' : content}`;
	if(!text.trim()){
		return content;
	}
	const exportKey = normalizeExportKey(key);
	const sectionsCfg = settings && settings.sections && typeof settings.sections === 'object' ? settings.sections : {};
	if(!Array.isArray(sectionsCfg[exportKey]) || sectionsCfg[exportKey].length === 0){
		return content;
	}
	const picked = getAIExportEffectiveSectionsForTechnique(key, settings);
	const wanted = new Set(uniqueArray(picked || []));
	if(wanted.size === 0){
		return content;
	}
	const filtered = filterContentByWantedSections(text, wanted);
	if(!`${filtered || ''}`.trim()){
		return content;
	}
	return filtered;
}

export function resolveAIExportContextForTest(context){
	const normalized = resolveExportContextForPayload(context);
	return {
		key: normalized.key,
		displayName: normalized.displayName,
	};
}

function appendSvgSection(parts, scopeRoot){
	if(!ENABLE_SVG_TEXT_EXPORT){
		return;
	}
	const svgLines = collectSvgTexts(scopeRoot);
	if(svgLines.length){
		parts.push('[图形标注文本]');
		parts.push(svgLines.join('\n'));
	}
}

function getAstroCachedContent(){
	try{
		const store = getStore();
		if(!store || !store.astro){
			const snap = loadAstroAISnapshot();
			return snap && snap.content ? snap.content : '';
		}
		const chartObj = store.astro.chartObj;
		const fields = store.astro.fields;
		const snapshot = getAstroAISnapshotForCurrent(chartObj, fields);
		if(snapshot && snapshot.content){
			return snapshot.content;
		}
		if(chartObj && chartObj.chart){
			const saved = saveAstroAISnapshot(chartObj, fields);
			if(saved && saved.content){
				return saved.content;
			}
		}
		const snap = loadAstroAISnapshot();
		if(snap && snap.content){
			return snap.content;
		}
	}catch(e){
		const snap = loadAstroAISnapshot();
		return snap && snap.content ? snap.content : '';
	}
	return '';
}

function tryParseJSON(raw){
	if(raw === undefined || raw === null){
		return null;
	}
	if(typeof raw !== 'string'){
		return null;
	}
	const txt = raw.trim();
	if(!txt){
		return null;
	}
	if((txt[0] !== '{' || txt[txt.length - 1] !== '}')
		&& (txt[0] !== '[' || txt[txt.length - 1] !== ']')){
		return null;
	}
	try{
		return JSON.parse(txt);
	}catch(e){
		return null;
	}
}

function extractSnapshotText(raw){
	if(raw === undefined || raw === null){
		return '';
	}
	if(typeof raw === 'string'){
		const txt = raw.trim();
		if(!txt){
			return '';
		}
		const parsed = tryParseJSON(txt);
		if(parsed !== null){
			return extractSnapshotText(parsed);
		}
		return txt;
	}
	if(Array.isArray(raw)){
		for(let i=0; i<raw.length; i++){
			const txt = extractSnapshotText(raw[i]);
			if(txt){
				return txt;
			}
		}
		return '';
	}
	if(typeof raw !== 'object'){
		return '';
	}
	if(typeof raw.content === 'string' && raw.content.trim()){
		return raw.content.trim();
	}
	if(typeof raw.text === 'string' && raw.text.trim()){
		return raw.text.trim();
	}
	if(raw.value !== undefined){
		const txt = extractSnapshotText(raw.value);
		if(txt){
			return txt;
		}
	}
	if(raw.snapshot !== undefined){
		const txt = extractSnapshotText(raw.snapshot);
		if(txt){
			return txt;
		}
	}
	if(raw.payload !== undefined){
		const txt = extractSnapshotText(raw.payload);
		if(txt){
			return txt;
		}
	}
	const likelyKeys = ['data', 'result', 'snapshotText', 'moduleSnapshots', 'snapshots', 'modules'];
	for(let i=0; i<likelyKeys.length; i++){
		const key = likelyKeys[i];
		if(raw[key] === undefined){
			continue;
		}
		const txt = extractSnapshotText(raw[key]);
		if(txt){
			return txt;
		}
	}
	const keys = Object.keys(raw);
	for(let i=0; i<keys.length; i++){
		const key = keys[i];
		if(key === 'meta' || key === 'createdAt' || key === 'version' || key === 'module'){
			continue;
		}
		const txt = extractSnapshotText(raw[key]);
		if(txt){
			return txt;
		}
	}
	return '';
}

function getModuleAliasList(moduleName){
	const name = `${moduleName || ''}`.trim();
	if(!name){
		return [];
	}
	const set = new Set([name]);
	if(name === 'guazhan' || name === 'sixyao' || name === 'liuyao'){
		set.add('guazhan');
		set.add('sixyao');
		set.add('liuyao');
	}
	if(name === 'qimen' || name === 'dunjia'){
		set.add('qimen');
		set.add('dunjia');
	}
	if(name === 'primarydirect' || name === 'primarydirchart' || name === 'direction'){
		set.add('primarydirect');
		set.add('primarydirchart');
		set.add('direction');
	}
	if(name === 'decennials' || name === 'decennial'){
		set.add('decennials');
		set.add('decennial');
	}
	if(name === 'zodialrelease' || name === 'zodiacrelease'){
		set.add('zodialrelease');
		set.add('zodiacrelease');
	}
	if(name === 'germany' || name === 'germanytech'){
		set.add('germany');
		set.add('germanytech');
	}
	if(name === 'relative' || name === 'relativechart'){
		set.add('relative');
		set.add('relativechart');
	}
	if(name === 'indiachart' || name === 'indiachart_current' || name.indexOf('indiachart_') === 0){
		set.add('indiachart');
		set.add('indiachart_current');
	}
	if(name === 'jieqi' || name === 'jieqi_current' || name.indexOf('jieqi_') === 0){
		set.add('jieqi');
		set.add('jieqi_current');
	}
	if(name === 'qizhengkin' || name === 'guolao-qizhengkin'){
		set.add('qizhengkin');
		set.add('guolao-qizhengkin');
	}
	if(name === 'shaozi' || name === 'kinastro-shaozi'){
		set.add('shaozi');
		set.add('kinastro-shaozi');
		set.add('shusuan');
	}
	if(name === 'tieban' || name === 'kinastro-tieban'){
		set.add('tieban');
		set.add('kinastro-tieban');
		set.add('shusuan');
	}
	if(name === 'fendjing' || name === 'kinastro-fendjing'){
		set.add('fendjing');
		set.add('kinastro-fendjing');
		set.add('shusuan');
	}
	if(name === 'beiji' || name === 'kinastro-beiji'){
		set.add('beiji');
		set.add('kinastro-beiji');
		set.add('shusuan');
	}
	if(name === 'nanji' || name === 'kinastro-nanji'){
		set.add('nanji');
		set.add('kinastro-nanji');
		set.add('shusuan');
	}
	if(name === 'chunzi' || name === 'kinastro-chunzi'){
		set.add('chunzi');
		set.add('kinastro-chunzi');
		set.add('shusuan');
	}
	if(name === 'canping'){
		set.add('canping');
		set.add('shusuan');
	}
	if(name === 'heluo'){
		set.add('heluo');
		set.add('shusuan');
	}
	if(name === 'xianqin' || name === 'kinastro-xianqin' || name === 'yanqin'){
		set.add('xianqin');
		set.add('kinastro-xianqin');
		set.add('yanqin');
	}
	if(name === 'cetian' || name === 'kinastro-cetian' || name === 'mingother'){
		set.add('cetian');
		set.add('kinastro-cetian');
		set.add('mingother');
	}
	return Array.from(set).filter(Boolean);
}

function getSnapshotFromPayload(payload, aliases){
	if(!payload || typeof payload !== 'object'){
		return '';
	}
	const aliasSet = new Set((aliases || []).map((item)=>`${item || ''}`).filter(Boolean));
	const candidates = [];
	const pushCandidate = (txt, score)=>{
		const val = `${txt || ''}`.trim();
		if(!val){
			return;
		}
		candidates.push({
			text: val,
			score: Number.isNaN(Number(score)) ? 0 : Number(score),
			len: val.length,
		});
	};
	pushCandidate(extractSnapshotText(payload.snapshot), 70);
	if(payload.module && aliasSet.has(`${payload.module}`)){
		pushCandidate(extractSnapshotText(payload.snapshot), 95);
	}
	(aliases || []).forEach((alias)=>{
		if(!alias){
			return;
		}
		pushCandidate(extractSnapshotText(payload[alias]), 96);
		const moduleSnapshots = payload.moduleSnapshots && typeof payload.moduleSnapshots === 'object'
			? payload.moduleSnapshots
			: null;
		if(moduleSnapshots){
			pushCandidate(extractSnapshotText(moduleSnapshots[alias]), 94);
		}
		const modules = payload.modules && typeof payload.modules === 'object'
			? payload.modules
			: null;
		if(modules){
			pushCandidate(extractSnapshotText(modules[alias]), 92);
		}
	});
	const snapshots = payload.snapshots && typeof payload.snapshots === 'object'
		? payload.snapshots
		: null;
	if(snapshots){
		Object.keys(snapshots).forEach((rawKey)=>{
			const key = `${rawKey || ''}`.trim();
			if(!key){
				return;
			}
			let matched = false;
			if(aliasSet.has(key)){
				matched = true;
			}
			if(key.indexOf(MODULE_SNAPSHOT_PREFIX) === 0){
				const suffix = key.substring(MODULE_SNAPSHOT_PREFIX.length);
				if(aliasSet.has(suffix)){
					matched = true;
				}
			}
			if(!matched){
				return;
			}
			pushCandidate(extractSnapshotText(snapshots[rawKey]), 93);
		});
	}
	const seen = new Set();
	const walk = (node, depth)=>{
		if(!node || depth > 4){
			return;
		}
		if(Array.isArray(node)){
			node.forEach((item)=>walk(item, depth + 1));
			return;
		}
		if(typeof node !== 'object'){
			return;
		}
		if(seen.has(node)){
			return;
		}
		seen.add(node);
		Object.keys(node).forEach((rawKey)=>{
			const key = `${rawKey || ''}`.trim();
			if(!key){
				return;
			}
			let matched = false;
			if(aliasSet.has(key)){
				matched = true;
			}
			if(key.indexOf(MODULE_SNAPSHOT_PREFIX) === 0){
				const suffix = key.substring(MODULE_SNAPSHOT_PREFIX.length);
				if(aliasSet.has(suffix)){
					matched = true;
				}
			}
			if(key.indexOf('snapshot') >= 0 || key.indexOf('module') >= 0){
				matched = true;
			}
			if(matched){
				pushCandidate(extractSnapshotText(node[rawKey]), 68 - depth);
			}
			if(depth < 4){
				walk(node[rawKey], depth + 1);
			}
		});
	};
	walk(payload, 0);
	if(!candidates.length){
		return '';
	}
	candidates.sort((a, b)=>{
		if(a.score !== b.score){
			return b.score - a.score;
		}
		return b.len - a.len;
	});
	return candidates[0].text || '';
}

function getSnapshotFromLocalStorageByAliases(aliases){
	try{
		if(typeof window === 'undefined' || !window.localStorage){
			return '';
		}
		const aliasSet = new Set((aliases || []).map((item)=>`${item || ''}`).filter(Boolean));
		if(!aliasSet.size){
			return '';
		}
		const candidates = [];
		for(let i=0; i<window.localStorage.length; i++){
			const key = `${window.localStorage.key(i) || ''}`.trim();
			if(!key || key.indexOf(MODULE_SNAPSHOT_PREFIX) !== 0){
				continue;
			}
			const suffix = key.substring(MODULE_SNAPSHOT_PREFIX.length);
			if(!aliasSet.has(suffix)){
				continue;
			}
			const raw = window.localStorage.getItem(key);
			if(!raw){
				continue;
			}
			const parsed = tryParseJSON(raw);
			const txt = extractSnapshotText(parsed || raw);
			if(!txt){
				continue;
			}
			const createdAt = parsed && parsed.createdAt ? `${parsed.createdAt}` : '';
			candidates.push({
				text: txt,
				createdAt,
				len: txt.length,
			});
		}
		if(!candidates.length){
			return '';
		}
		candidates.sort((a, b)=>{
			if(a.createdAt && b.createdAt && a.createdAt !== b.createdAt){
				return a.createdAt > b.createdAt ? -1 : 1;
			}
			return b.len - a.len;
		});
		return candidates[0].text || '';
	}catch(e){
		return '';
	}
}

function getModuleCachedContent(moduleName){
	if(!moduleName){
		return '';
	}
	const aliases = getModuleAliasList(moduleName);
	for(let i=0; i<aliases.length; i++){
		const snapshot = loadModuleAISnapshot(aliases[i]);
		if(snapshot && snapshot.content){
			return snapshot.content;
		}
	}
	// 兜底：读取当前案例中保存的模块快照（同样来自计算阶段，不依赖右侧DOM采集）。
	try{
		const store = getStore();
		const payloadCandidates = [];
		const pushPayloadCandidate = (one)=>{
			if(one === undefined || one === null){
				return;
			}
			let val = one;
			if(typeof one === 'object' && one.value !== undefined){
				val = one.value;
			}
			if(typeof val === 'string'){
				const parsed = tryParseJSON(val);
				val = parsed !== null ? parsed : val;
			}
			payloadCandidates.push(val);
		};
		const userState = store && store.user ? store.user : null;
		const astroState = store && store.astro ? store.astro : null;
		const appState = store && store.app ? store.app : null;
		pushPayloadCandidate(userState && userState.currentCase ? userState.currentCase.payload : null);
		pushPayloadCandidate(userState && userState.currentChart ? userState.currentChart.payload : null);
		pushPayloadCandidate(astroState && astroState.currentCase ? astroState.currentCase.payload : null);
		pushPayloadCandidate(appState && appState.currentCase ? appState.currentCase.payload : null);
		for(let i=0; i<payloadCandidates.length; i++){
			const fromPayload = getSnapshotFromPayload(payloadCandidates[i], aliases);
			if(fromPayload){
				return fromPayload;
			}
		}
	}catch(e){
		// ignore
	}
	const byStorageScan = getSnapshotFromLocalStorageByAliases(aliases);
	if(byStorageScan){
		return byStorageScan;
	}
	return '';
}

function getModuleSnapshotPayload(moduleName){
	if(!moduleName){
		return null;
	}
	const aliases = getModuleAliasList(moduleName);
	const candidates = [];
	aliases.forEach((alias)=>{
		const snapshot = loadModuleAISnapshot(alias);
		if(!snapshot || !snapshot.content){
			return;
		}
		candidates.push(snapshot);
	});
	if(!candidates.length){
		return null;
	}
	candidates.sort((a, b)=>{
		const aCreated = safe(a && a.createdAt, '');
		const bCreated = safe(b && b.createdAt, '');
		if(aCreated && bCreated && aCreated !== bCreated){
			return aCreated > bCreated ? -1 : 1;
		}
		const aLen = safe(a && a.content, '').length;
		const bLen = safe(b && b.content, '').length;
		return bLen - aLen;
	});
	return candidates[0] || null;
}

function getCurrentStoreFieldSignature(){
	try{
		const store = getStore();
		const astro = store && store.astro ? store.astro : null;
		const fields = astro && astro.fields ? astro.fields : null;
		if(!fields){
			return {
				date: '',
				time: '',
				zone: '',
				lon: '',
				lat: '',
			};
		}
		const fmt = (val, pattern)=>{
			if(!val || typeof val.format !== 'function'){
				return '';
			}
			try{
				return `${val.format(pattern)}`;
			}catch(e){
				return '';
			}
		};
		return {
			date: fmt(fields.date && fields.date.value, 'YYYY-MM-DD'),
			time: fmt(fields.time && fields.time.value, 'HH:mm:ss'),
			zone: safe(fields.zone && fields.zone.value, ''),
			lon: safe(fields.lon && fields.lon.value, ''),
			lat: safe(fields.lat && fields.lat.value, ''),
		};
	}catch(e){
		return {
			date: '',
			time: '',
			zone: '',
			lon: '',
			lat: '',
		};
	}
}

function getSanshiDisplayFieldSignature(scopeRoot){
	const fallback = getCurrentStoreFieldSignature();
	const sig = {
		...fallback,
	};
	if(!scopeRoot){
		return sig;
	}
	const rawText = `${textOf(scopeRoot) || ''}`.replace(/\s+/g, ' ');
	if(!rawText){
		return sig;
	}
	const dateMatched = rawText.match(/(\d{4}[/-]\d{2}[/-]\d{2})/);
	if(dateMatched && dateMatched[1]){
		sig.date = `${dateMatched[1]}`.replace(/\//g, '-');
	}
	// 三式合一左盘固定同时展示“真太阳时/直接时间”，用于导出匹配优先使用直接时间。
	const directMatched = rawText.match(/直接时间[：:]\s*(\d{2}:\d{2}(?::\d{2})?)/);
	if(directMatched && directMatched[1]){
		sig.time = `${directMatched[1]}`;
		return sig;
	}
	const solarMatched = rawText.match(/真太阳时[：:]\s*(\d{2}:\d{2}(?::\d{2})?)/);
	if(solarMatched && solarMatched[1]){
		sig.time = `${solarMatched[1]}`;
	}
	return sig;
}

function normalizeMinuteTime(val){
	const matched = `${val || ''}`.match(/(\d{2}):(\d{2})/);
	if(!matched){
		return '';
	}
	return `${matched[1]}:${matched[2]}`;
}

function parseSanshiDirectStamp(content){
	const txt = `${content || ''}`;
	if(!txt){
		return null;
	}
	const matched = txt.match(/直接时间[：:]\s*([0-9]{4}[/-][0-9]{2}[/-][0-9]{2})\s*([0-9]{2}:[0-9]{2}(?::[0-9]{2})?)/);
	if(!matched){
		return null;
	}
	return {
		date: `${matched[1] || ''}`.replace(/\//g, '-'),
		time: `${matched[2] || ''}`,
	};
}

function isSanshiSnapshotMatchedCurrent(content, snapshotMeta, currentSig){
	const current = currentSig || {};
	if(!current.date || !current.time){
		return true;
	}
	let snapDate = safe(snapshotMeta && snapshotMeta.date, '');
	let snapTime = safe(snapshotMeta && snapshotMeta.time, '');
	const parsedDirect = parseSanshiDirectStamp(content);
	if(!snapDate && parsedDirect && parsedDirect.date){
		snapDate = parsedDirect.date;
	}
	if(!snapTime && parsedDirect && parsedDirect.time){
		snapTime = parsedDirect.time;
	}
	if(!snapDate || !snapTime){
		return false;
	}
	if(snapDate !== current.date){
		return false;
	}
	const curMinute = normalizeMinuteTime(current.time);
	const snapMinute = normalizeMinuteTime(snapTime);
	if(curMinute && snapMinute && curMinute !== snapMinute){
		return false;
	}
	const snapZone = safe(snapshotMeta && snapshotMeta.zone, '');
	if(current.zone && snapZone && current.zone !== snapZone){
		return false;
	}
	const snapLon = safe(snapshotMeta && snapshotMeta.lon, '');
	if(current.lon && snapLon && current.lon !== snapLon){
		return false;
	}
	const snapLat = safe(snapshotMeta && snapshotMeta.lat, '');
	if(current.lat && snapLat && current.lat !== snapLat){
		return false;
	}
	return true;
}

function parseIndiaFractalByLabel(label){
	const txt = `${label || ''}`.trim();
	if(!txt){
		return null;
	}
	if(txt.includes('命盘')){
		return 1;
	}
	const matched = txt.match(/(\d+)\s*律盘/);
	if(!matched){
		return null;
	}
	const val = parseInt(matched[1], 10);
	if(Number.isNaN(val) || val <= 0){
		return null;
	}
	return val;
}

function getIndiaCachedContent(activeLabel){
	const keys = [];
	const fractal = parseIndiaFractalByLabel(activeLabel);
	if(fractal !== null){
		keys.push(`indiachart_${fractal}`);
	}
	keys.push('indiachart_current');
	keys.push('indiachart');

	for(let i=0; i<keys.length; i++){
		const txt = getModuleCachedContent(keys[i]);
		if(txt){
			return txt;
		}
	}
	return '';
}

async function extractAstroContent(context){
	const isAstroLike = context && context.key === 'astrochart_like';
	const topLabel = context && context.topLabel ? context.topLabel : '';
	const isIndia = (context && context.key === 'indiachart') || topLabel.includes('印度占星') || topLabel.includes('印度律盘');
	if(!isIndia){
		// 星盘系导出固定走计算快照，不读取右侧栏目DOM。
		const cached = getAstroCachedContent();
		return cached || '';
	}
	const scopeRoot = context ? context.scopeRoot : null;
	const indiaActive = findIndiaActivePane(scopeRoot);
	const indiaCached = getIndiaCachedContent(indiaActive ? indiaActive.label : '');
	return indiaCached || '';
}

async function extractSixYaoContent(context){
	void context;
	const refreshedGuazhan = await requestModuleSnapshotRefresh('guazhan');
	if(refreshedGuazhan){
		return refreshedGuazhan;
	}
	const refreshedSixyao = await requestModuleSnapshotRefresh('sixyao');
	if(refreshedSixyao){
		return refreshedSixyao;
	}
	const cached = getModuleCachedContent('guazhan') || getModuleCachedContent('sixyao');
	if(cached){
		return cached;
	}
	// 易卦导出仅使用计算快照，不从右侧DOM复制。
	return '';
}

function hasSectionTitle(content, title){
	const src = `${content || ''}`;
	const target = `${title || ''}`.trim();
	if(!src || !target){
		return false;
	}
	const escaped = escapeRegExp(target);
	const headingPattern = new RegExp(`(?:\\[|【)\\s*${escaped}\\s*(?:\\]|】)`);
	return headingPattern.test(src);
}

function hasAnySectionTitle(content, titles){
	const arr = Array.isArray(titles) ? titles : [titles];
	return arr.some((title)=>hasSectionTitle(content, title));
}

async function extractLiuRengContent(context){
	void context;
	const refreshedSnapshot = await requestModuleSnapshotRefresh('liureng');
	if(refreshedSnapshot){
		const hasGeJuRef = hasAnySectionTitle(refreshedSnapshot, ['大格', '小局', '参考', '概览']);
		if(hasGeJuRef){
			return refreshedSnapshot;
		}
	}
	const cached = getModuleCachedContent('liureng');
	if(cached){
		const hasGeJuRef = hasAnySectionTitle(cached, ['大格', '小局', '参考', '概览']);
		if(hasGeJuRef){
			return cached;
		}
	}
	const liveSnapshot = (typeof window !== 'undefined' && typeof window.__horosa_liureng_snapshot_text === 'string')
		? `${window.__horosa_liureng_snapshot_text}`.trim()
		: '';
	if(liveSnapshot){
		const hasGeJuRef = hasAnySectionTitle(liveSnapshot, ['大格', '小局', '参考', '概览']);
		if(hasGeJuRef){
			return liveSnapshot;
		}
	}
	if(refreshedSnapshot){
		return refreshedSnapshot;
	}
	if(cached){
		return cached;
	}
	// 六壬导出仅使用计算快照，不从右侧DOM复制。
	return '';
}

async function extractJinKouContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('jinkou');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('jinkou');
	if(cached){
		return cached;
	}
	// 金口诀导出不能回退到六壬，避免内容串台。
	return '';
}

async function extractQiMenContent(context){
	void context;
	const refreshedSnapshot = await requestModuleSnapshotRefresh('qimen');
	if(refreshedSnapshot){
		const hasYiGua = hasSectionTitle(refreshedSnapshot, '奇门演卦');
		const hasBaGong = hasSectionTitle(refreshedSnapshot, '八宫详解');
		if(hasYiGua && hasBaGong){
			return refreshedSnapshot;
		}
	}
	const cached = getModuleCachedContent('qimen');
	if(cached){
		const hasYiGua = hasSectionTitle(cached, '奇门演卦');
		const hasBaGong = hasSectionTitle(cached, '八宫详解');
		if(hasYiGua && hasBaGong){
			return cached;
		}
	}
	const liveSnapshot = (typeof window !== 'undefined' && typeof window.__horosa_qimen_snapshot_text === 'string')
		? `${window.__horosa_qimen_snapshot_text}`.trim()
		: '';
	if(liveSnapshot){
		const hasYiGua = hasSectionTitle(liveSnapshot, '奇门演卦');
		const hasBaGong = hasSectionTitle(liveSnapshot, '八宫详解');
		if(hasYiGua && hasBaGong){
			return liveSnapshot;
		}
	}
	if(refreshedSnapshot){
		return refreshedSnapshot;
	}
	if(liveSnapshot){
		return liveSnapshot;
	}
	if(cached){
		return cached;
	}
	// 遁甲导出仅使用计算快照，不从右侧DOM复制。
	return '';
}

async function extractSanShiUnitedContent(context){
	void context;
	const isCompleteSnapshot = (txt)=>{
		const src = `${txt || ''}`;
		if(!src){
			return false;
		}
		const hasLiuRengRef = hasAnySectionTitle(src, ['六壬大格', '六壬小局', '六壬参考', '六壬概览']);
		const hasBaGong = hasSectionTitle(src, '八宫详解');
		return hasLiuRengRef && hasBaGong;
	};
	const getSanshiSnapshotMeta = ()=>{
		const payload = getModuleSnapshotPayload('sanshiunited');
		if(payload && payload.meta && typeof payload.meta === 'object'){
			return payload.meta;
		}
		return null;
	};
	const canUseSnapshot = (txt, meta, preferComplete = false)=>{
		const src = `${txt || ''}`.trim();
		if(!src){
			return false;
		}
		const complete = isCompleteSnapshot(src);
		const matched = isSanshiSnapshotMatchedCurrent(src, meta, currentSig);
		if(strictMatch){
			// 严格模式下以当前盘签名匹配为准，命中即可导出，避免误报“无可导出文本”。
			return matched;
		}
		if(preferComplete){
			return complete;
		}
		return true;
	};
	const currentSig = getSanshiDisplayFieldSignature(context && context.scopeRoot ? context.scopeRoot : null);
	const strictMatch = !!(currentSig.date && currentSig.time);

	const refreshedSnapshot = await requestModuleSnapshotRefresh('sanshiunited');
	const refreshedMeta = getSanshiSnapshotMeta();
	if(canUseSnapshot(refreshedSnapshot, refreshedMeta, true)){
		// 优先信任“本次刷新”结果：由三式合一组件当场生成，最贴近当前盘面。
		return refreshedSnapshot;
	}

	const cached = getModuleCachedContent('sanshiunited');
	const cachedPayload = getModuleSnapshotPayload('sanshiunited');
	if(canUseSnapshot(cached, cachedPayload && cachedPayload.meta, true)){
		return cached;
	}

	if(strictMatch){
		const retrySnapshot = await requestModuleSnapshotRefresh('sanshiunited');
		const retryMeta = getSanshiSnapshotMeta();
		if(canUseSnapshot(retrySnapshot, retryMeta, false)){
			return retrySnapshot;
		}
		// 最后再尝试一次已取到的快照，避免“刷新回调无新文本”导致误空。
		if(canUseSnapshot(refreshedSnapshot, refreshedMeta, false)){
			return refreshedSnapshot;
		}
		if(canUseSnapshot(cached, cachedPayload && cachedPayload.meta, false)){
			return cached;
		}
		// 最后兜底：即便签名不匹配，也优先导出当前可见盘面的最新快照，避免误报空导出。
		if(`${retrySnapshot || ''}`.trim()){
			return retrySnapshot;
		}
		if(`${refreshedSnapshot || ''}`.trim()){
			return refreshedSnapshot;
		}
		if(`${cached || ''}`.trim()){
			return cached;
		}
		return '';
	}

	if(canUseSnapshot(cached, cachedPayload && cachedPayload.meta, false)){
		return cached;
	}
	if(canUseSnapshot(refreshedSnapshot, refreshedMeta, false)){
		return refreshedSnapshot;
	}
	return '';
}

const TONGSHEFA_LABEL_TO_KEY = {
	'太阴·本体': 'taiyin',
	'太阳·方法': 'taiyang',
	'少阳·认识': 'shaoyang',
	'少阴·宇宙': 'shaoyin',
};
const TONGSHEFA_SELECT_KEYS = ['taiyin', 'taiyang', 'shaoyang', 'shaoyin'];

function parseTongSheFaBaguaKey(text){
	const val = `${text || ''}`.replace(/\s+/g, '');
	if(!val){
		return '';
	}
	let m = val.match(/[（(]([乾兑离震巽坎艮坤])[）)]/);
	if(m && m[1]){
		return m[1];
	}
	m = val.match(/([乾兑离震巽坎艮坤])卦/);
	if(m && m[1]){
		return m[1];
	}
	m = val.match(/[乾兑离震巽坎艮坤]/);
	return m && m[0] ? m[0] : '';
}

function hasTongSheFaSelection(selection){
	if(!selection || typeof selection !== 'object'){
		return false;
	}
	return TONGSHEFA_SELECT_KEYS.every((key)=>!!selection[key]);
}

function extractTongSheFaSelection(scopeRoot){
	if(!scopeRoot || !scopeRoot.querySelectorAll){
		return null;
	}
	const out = {};
	const cols = Array.from(scopeRoot.querySelectorAll('.ant-col'));
	cols.forEach((col)=>{
		const labelNode = Array.from(col.children || []).find((node)=>{
			if(!node || node.nodeType !== 1){
				return false;
			}
			const label = `${textOf(node)}`.trim();
			return Object.prototype.hasOwnProperty.call(TONGSHEFA_LABEL_TO_KEY, label);
		});
		if(!labelNode){
			return;
		}
		const label = `${textOf(labelNode)}`.trim();
		const key = TONGSHEFA_LABEL_TO_KEY[label];
		if(!key || out[key]){
			return;
		}
		const select = col.querySelector('.ant-select');
		if(!select){
			return;
		}
		const selectedText = textOf(select.querySelector('.ant-select-selection-item')) || textOf(select);
		const baguaKey = parseTongSheFaBaguaKey(selectedText);
		if(baguaKey){
			out[key] = baguaKey;
		}
	});

	if(hasTongSheFaSelection(out)){
		return out;
	}

	const selects = Array.from(scopeRoot.querySelectorAll('.ant-select'));
	selects.forEach((select)=>{
		if(hasTongSheFaSelection(out)){
			return;
		}
		let label = '';
		const prev = select.previousElementSibling;
		const prevLabel = prev ? `${textOf(prev)}`.trim() : '';
		if(Object.prototype.hasOwnProperty.call(TONGSHEFA_LABEL_TO_KEY, prevLabel)){
			label = prevLabel;
		}
		if(!label){
			const holder = select.closest('.ant-col') || select.parentElement;
			if(holder){
				const allDivs = Array.from(holder.querySelectorAll('div'));
				const found = allDivs.map((node)=>`${textOf(node)}`.trim())
					.find((txt)=>Object.prototype.hasOwnProperty.call(TONGSHEFA_LABEL_TO_KEY, txt));
				if(found){
					label = found;
				}
			}
		}
		if(!label){
			return;
		}
		const key = TONGSHEFA_LABEL_TO_KEY[label];
		if(!key || out[key]){
			return;
		}
		const selectedText = textOf(select.querySelector('.ant-select-selection-item')) || textOf(select);
		const baguaKey = parseTongSheFaBaguaKey(selectedText);
		if(baguaKey){
			out[key] = baguaKey;
		}
	});

	return hasTongSheFaSelection(out) ? out : null;
}

async function extractTongSheFaContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('tongshefa');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('tongshefa');
	if(cached){
		return cached;
	}
	return '';
}

async function extractTaiYiContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('taiyi');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('taiyi');
	if(cached){
		return cached;
	}
	return '';
}

async function extractGermanyContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('germany');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('germany');
	if(cached){
		return cached;
	}
	return '';
}

async function extractJieQiContent(context){
	void context;
	const refreshedCurrent = await requestModuleSnapshotRefresh('jieqi_current');
	if(refreshedCurrent){
		return refreshedCurrent;
	}
	const refreshed = await requestModuleSnapshotRefresh('jieqi');
	if(refreshed){
		return refreshed;
	}
	const cachedCurrent = getModuleCachedContent('jieqi_current');
	if(cachedCurrent){
		return cachedCurrent;
	}
	const cached = getModuleCachedContent('jieqi');
	if(cached){
		return cached;
	}
	return '';
}

async function extractPrimaryDirectContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('primarydirect');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('primarydirect');
	if(cached){
		return cached;
	}
	return '';
}

async function extractPrimaryDirChartContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('primarydirchart');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('primarydirchart');
	if(cached){
		return cached;
	}
	return '';
}

async function extractZodialReleaseContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('zodialrelease');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('zodialrelease');
	if(cached){
		return cached;
	}
	return '';
}

async function extractFirdariaContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('firdaria');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('firdaria');
	if(cached){
		return cached;
	}
	return '';
}

async function extractProfectionContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('profection');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('profection');
	if(cached){
		return cached;
	}
	return '';
}

async function extractSolarArcContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('solararc');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('solararc');
	if(cached){
		return cached;
	}
	return '';
}

async function extractSolarReturnContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('solarreturn');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('solarreturn');
	if(cached){
		return cached;
	}
	return '';
}

async function extractLunarReturnContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('lunarreturn');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('lunarreturn');
	if(cached){
		return cached;
	}
	return '';
}

async function extractGivenYearContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('givenyear');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('givenyear');
	if(cached){
		return cached;
	}
	return '';
}

async function extractDecennialsContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('decennials');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('decennials');
	if(cached){
		return cached;
	}
	return '';
}

async function extractRelativeContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('relative');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('relative');
	if(cached){
		return cached;
	}
	return '';
}

async function extractSimpleModuleContent(moduleName){
	const refreshed = await requestModuleSnapshotRefresh(moduleName);
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent(moduleName);
	if(cached){
		return cached;
	}
	return '';
}

async function extractOtherBuContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('otherbu');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('otherbu');
	if(cached){
		return cached;
	}
	return '';
}

async function extractFengShuiContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('fengshui');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('fengshui');
	if(cached){
		return cached;
	}
	return '';
}

async function extractGenericContent(context){
	if(context.key === 'suzhan'){
		const cached = getModuleCachedContent('suzhan');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'guolao'){
		const cached = getModuleCachedContent('guolao');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'bazi'){
		const cached = getModuleCachedContent('bazi');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'ziwei'){
		const cached = getModuleCachedContent('ziwei');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'germany'){
		const cached = getModuleCachedContent('germany');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'jieqi'){
		const cachedCurrent = getModuleCachedContent('jieqi_current');
		if(cachedCurrent){
			return cachedCurrent;
		}
		const cached = getModuleCachedContent('jieqi');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'zodialrelease'){
		const cached = getModuleCachedContent('zodialrelease');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'decennials'){
		const cached = getModuleCachedContent('decennials');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'planetaryages' || context.key === 'vedicprog' || context.key === 'jaynesprog'
		|| context.key === 'planetaryarc' || context.key === 'persiandirected' || context.key === 'yearsystem129'
		|| context.key === 'balbillus' || context.key === 'triplicityrulers' || context.key === 'keypoints'
		|| context.key === 'lunationphase' || context.key === 'extrareturns'){
		const cached = getModuleCachedContent(context.key);
		if(cached){
			return cached;
		}
	}
	if(context.key === 'relative'){
		const cached = getModuleCachedContent('relative');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'otherbu'){
		const cached = getModuleCachedContent('otherbu');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'qimen'){
		const cached = getModuleCachedContent('qimen');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'sanshiunited'){
		const cached = getModuleCachedContent('sanshiunited');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'tongshefa'){
		const cached = getModuleCachedContent('tongshefa');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'huangji'){
		const cached = getModuleCachedContent('huangji');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'wuzhao' || context.key === 'taixuan' || context.key === 'jingjue' || context.key === 'shenyishu'
		|| context.key === 'shaozi' || context.key === 'tieban' || context.key === 'fendjing' || context.key === 'beiji'
		|| context.key === 'nanji' || context.key === 'chunzi' || context.key === 'xianqin' || context.key === 'cetian'
		|| context.key === 'qizhengkin'){
		const cached = getModuleCachedContent(snapshotModuleKeyByContextKey(context.key));
		if(cached){
			return cached;
		}
	}
	if(context.key === 'sixyao'){
		const cached = getModuleCachedContent('guazhan');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'jinkou'){
		const cached = getModuleCachedContent('jinkou');
		if(cached){
			return cached;
		}
	}

	void context;
	return '';
}

function isKentangRawExportKey(key){
	const val = normalizeExportKey(key);
	return [
		'huangji',
		'wuzhao',
		'taixuan',
		'jingjue',
		'shenyishu',
		'shaozi',
		'tieban',
		'fendjing',
		'beiji',
		'nanji',
		'chunzi',
		'xianqin',
		'cetian',
		'qizhengkin',
	].indexOf(val) >= 0;
}

function applyReplacers(text, replacers){
	let out = text;
	replacers.forEach((item)=>{
		out = out.replace(item.regex, item.value);
	});
	return out;
}

function replaceKnownSymbols(text, domain){
	let output = text || '';
	if(likelyHasFontEncodedTokens(output)){
		output = replaceFontEncodedTokens(output);
	}
	Object.keys(SYMBOL_MAP).forEach((key)=>{
		output = output.split(key).join(` ${SYMBOL_MAP[key]} `);
	});

	output = applyReplacers(output, COMMON_REPLACERS);
	if(domain && DOMAIN_REPLACERS[domain]){
		output = applyReplacers(output, DOMAIN_REPLACERS[domain]);
	}

	output = output.replace(/[\u4DC0-\u4DFF]/g, (ch)=>{
		const idx = ch.charCodeAt(0) - 0x4DC0 + 1;
		return ` 六十四卦#${idx} `;
	});

	// 私有区字符多为字体残留，不输出乱码标记，直接清理。
	output = output.replace(/[\uE000-\uF8FF]/g, ' ');

	output = output
		.replace(/[°º]/g, '˚')
		.replace(/[−﹣]/g, '-')
		.replace(/([0-9]+)\s*[′']/g, '$1分')
		.replace(/([0-9]+)\s*[″"]/g, '$1秒')
		.replace(/℞/g, '逆行')
		.replace(/\uFFFD/g, '[异常字符]')
		.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
		.replace(/\u200B/g, '')
		.replace(/\u00A0/g, ' ')
		.replace(/[ ]{2,}/g, ' ');
	if(domain !== 'sanshiunited'){
		output = output
			.replace(/([+-]?\d+(?:\.\d+)?)\s*度\s*R\b/g, '$1度 逆行')
			.replace(/(\d{1,2}\s*˚\s*(?:[^\s，,；;]{0,6})\s*\d{1,2}\s*分)\s*R\b/g, '$1 逆行');
	}

	return output;
}

function normalizeText(text, domain){
	let output = replaceKnownSymbols(text, domain);
	output = output.replace(/\r\n/g, '\n');
	output = output
		.split('\n')
			.map((line)=>line.replace(/[ \t]+$/g, ''))
			.join('\n');
	output = output.replace(/\n{3,}/g, '\n\n');
	if(domain === 'predictive_raw'
		|| domain === 'tongshefa'
		|| domain === 'liureng'
		|| domain === 'qimen'
		|| domain === 'sanshiunited'
		|| domain === 'kentang_raw'){
		return output.trim();
	}
	if(output.length > 120000){
		return normalizeWhitespace(output);
	}
	output = beautifyForAI(output);
	return output.trim();
}

const ASTRO_MEANING_PLANET_IDS = [
	AstroConst.SUN, AstroConst.MOON, AstroConst.MERCURY, AstroConst.VENUS, AstroConst.MARS, AstroConst.JUPITER,
	AstroConst.SATURN, AstroConst.URANUS, AstroConst.NEPTUNE, AstroConst.PLUTO, AstroConst.NORTH_NODE, AstroConst.SOUTH_NODE,
];
const ASTRO_MEANING_LOT_IDS = [
	AstroConst.PARS_FORTUNA, AstroConst.PARS_SPIRIT, AstroConst.PARS_VENUS, AstroConst.PARS_MERCURY, AstroConst.PARS_MARS,
	AstroConst.PARS_JUPITER, AstroConst.PARS_SATURN, AstroConst.PARS_FATHER, AstroConst.PARS_MOTHER, AstroConst.PARS_BROTHERS,
	AstroConst.PARS_WEDDING_MALE, AstroConst.PARS_WEDDING_FEMALE, AstroConst.PARS_SONS, AstroConst.PARS_DISEASES,
	AstroConst.PARS_LIFE, AstroConst.PARS_RADIX,
];

function escapeRegExp(text){
	return `${text || ''}`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function astroMeaningDisplayName(id){
	return AstroText.AstroMsgCN[id] || AstroText.AstroTxtMsg[id] || `${id || ''}`;
}

function buildAliasMap(entries){
	const aliasMap = new Map();
	entries.forEach((entry)=>{
		const id = entry.id;
		(entry.aliases || []).forEach((alias)=>{
			const a = `${alias || ''}`.trim();
			if(!a){
				return;
			}
			if(!aliasMap.has(a)){
				aliasMap.set(a, []);
			}
			const arr = aliasMap.get(a);
			if(!arr.includes(id)){
				arr.push(id);
			}
		});
	});
	return aliasMap;
}

const EXTRA_LOT_ALIASES = {
	[AstroConst.PARS_FORTUNA]: ['福点', '幸运点', 'Part of Fortune', 'Lot of Fortune'],
	[AstroConst.PARS_SPIRIT]: ['精神点', 'Lot of Spirit'],
	[AstroConst.PARS_VENUS]: ['爱情点', 'Lot of Eros'],
	[AstroConst.PARS_MERCURY]: ['必要点', 'Lot of Necessity'],
	[AstroConst.PARS_MARS]: ['勇气点', 'Lot of Courage'],
	[AstroConst.PARS_JUPITER]: ['胜利点', 'Lot of Victory'],
	[AstroConst.PARS_SATURN]: ['复仇点', 'Lot of Nemesis'],
	[AstroConst.PARS_FATHER]: ['父亲点', 'Lot of The Father'],
	[AstroConst.PARS_MOTHER]: ['母亲点', 'Lot of The Mother'],
	[AstroConst.PARS_BROTHERS]: ['手足点', 'Lot of Siblings'],
	[AstroConst.PARS_WEDDING_MALE]: ['婚姻点', 'Lot of Marriage'],
	[AstroConst.PARS_WEDDING_FEMALE]: ['婚姻点', 'Lot of Marriage'],
	[AstroConst.PARS_SONS]: ['孩童点', 'Lot of Children'],
	[AstroConst.PARS_DISEASES]: ['疾病点', 'Lot of Illness'],
	[AstroConst.PARS_LIFE]: ['旺点', 'Lot of Exaltation'],
	[AstroConst.PARS_RADIX]: ['基础点', 'Lot of Foundation'],
};

const PLANET_ALIAS_MAP = buildAliasMap(ASTRO_MEANING_PLANET_IDS.map((id)=>({
	id,
	aliases: uniqueArray([
		AstroText.AstroMsgCN[id],
		AstroText.AstroTxtMsg[id],
		`${id}`,
	]),
})));

const LOT_ALIAS_MAP = buildAliasMap(ASTRO_MEANING_LOT_IDS.map((id)=>({
	id,
	aliases: uniqueArray([
		AstroText.AstroMsgCN[id],
		AstroText.AstroTxtMsg[id],
		...(EXTRA_LOT_ALIASES[id] || []),
		`${id}`,
	]),
})));

const SIGN_ALIAS_MAP = buildAliasMap((AstroConst.LIST_SIGNS || []).map((id)=>({
	id,
	aliases: uniqueArray([
		AstroText.AstroMsgCN[id],
		AstroText.AstroTxtMsg[id],
		`${id}`,
	]),
})));

const HOUSE_ALIAS_MAP = buildAliasMap((AstroConst.LIST_HOUSES || []).map((id)=>({
	id,
	aliases: uniqueArray([
		AstroText.AstroMsg[id],
		AstroText.AstroMsgCN[id],
		AstroText.AstroTxtMsg[id],
		`${id}`,
	]),
})));

function lineContainsAlias(line, alias, options = {}){
	const txt = `${line || ''}`;
	if(!txt || !alias){
		return false;
	}
	if(alias.length === 1){
		const escaped = escapeRegExp(alias);
		const pattern = new RegExp(`(^|[\\s,，;；:：()（）\\[\\]{}\\/\\\\|\\-])(${escaped})(?=$|[\\s,，;；:：()（）\\[\\]{}\\/\\\\|\\-])`, 'g');
		const weakPlanetAlias = options.category === 'planet'
			&& ['日', '月', '水', '金', '火', '木', '土'].includes(alias);
		let matched = pattern.exec(txt);
		while(matched){
			const prefix = matched[1] || '';
			const start = (matched.index || 0) + prefix.length;
			const tail = txt.slice(start + alias.length).replace(/^\s+/, '');
			// 避免把“五行界”的“木/火/土/金/水”误判为行星简称。
			if(weakPlanetAlias && /^界/.test(tail)){
				matched = pattern.exec(txt);
				continue;
			}
			return true;
		}
		return false;
	}
	return txt.includes(alias);
}

function detectIdsByAliasMap(lines, aliasMap, options = {}){
	const out = new Set();
	const src = Array.isArray(lines) ? lines : [];
	if(!src.length){
		return out;
	}
	aliasMap.forEach((ids, alias)=>{
		for(let i=0; i<src.length; i++){
			if(lineContainsAlias(src[i], alias, options)){
				ids.forEach((id)=>out.add(id));
				break;
			}
		}
	});
	return out;
}

function detectAspectDegreesFromLines(lines){
	const found = new Set();
	(lines || []).forEach((line)=>{
		const txt = `${line || ''}`;
		if(!txt){
			return;
		}
		const regex = /(^|[^\d])(0|30|45|60|90|120|135|150|180)\s*˚/g;
		let matched = regex.exec(txt);
		while(matched){
			const deg = parseInt(matched[2], 10);
			if(!Number.isNaN(deg)){
				found.add(deg);
			}
			matched = regex.exec(txt);
		}
	});
	return found;
}

function buildMeaningLinesForIds(category, ids, title){
	const lines = [];
	const arr = Array.from(ids || []);
	if(!arr.length){
		return lines;
	}
	lines.push(`【${title}】`);
	arr.forEach((id)=>{
		const tip = buildMeaningTipByCategory(category, id);
		if(!tip){
			return;
		}
		lines.push(`### ${astroMeaningDisplayName(id)}`);
		if(tip.title){
			lines.push(`${tip.title}`);
		}
		(tip.tips || []).forEach((one)=>{
			lines.push(`${one}`);
		});
		lines.push('');
	});
	while(lines.length && lines[lines.length - 1] === ''){
		lines.pop();
	}
	return lines;
}

function buildMeaningLinesForAspects(degrees){
	const lines = [];
	const arr = Array.from(degrees || []).sort((a, b)=>a - b);
	if(!arr.length){
		return lines;
	}
	lines.push('【相位释义】');
	arr.forEach((deg)=>{
		const tip = buildAspectMeaningTip(deg, null, null);
		if(!tip){
			return;
		}
		lines.push(`### ${deg}˚`);
		if(tip.title){
			lines.push(`${tip.title}`);
		}
		(tip.tips || []).forEach((one)=>{
			lines.push(`${one}`);
		});
		lines.push('');
	});
	while(lines.length && lines[lines.length - 1] === ''){
		lines.pop();
	}
	return lines;
}

function joinSectionBlocks(sections){
	if(!Array.isArray(sections) || sections.length === 0){
		return '';
	}
	const out = [];
	sections.forEach((sec)=>{
		if(!sec || !Array.isArray(sec.lines) || !sec.lines.length){
			return;
		}
		if(out.length && out[out.length - 1] !== ''){
			out.push('');
		}
		out.push(...sec.lines);
	});
	return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function getSectionMeaningMode(title){
	const t = `${title || ''}`;
	if(!t || t.includes('释义')){
		return {
			skip: true,
			explicit: false,
			forceAllPlanets: false,
			forceAllLots: false,
		};
	}
	const explicit = t.includes('行星')
		|| t.includes('希腊点')
		|| t.includes('相位')
		|| t.includes('宫位')
		|| t.includes('星与虚点')
		|| t === '信息'
		|| t === '星盘信息'
		|| t === '可能性'
		|| t.includes('推运');
	return {
		skip: false,
		explicit,
		forceAllPlanets: t.includes('行星'),
		forceAllLots: t.includes('希腊点'),
	};
}

function appendAstroMeaningSections(content){
	const sections = splitContentSections(content);
	if(!sections || sections.length === 0){
		return content;
	}

	const outSections = [];
	const seen = {
		planets: new Set(),
		lots: new Set(),
		signs: new Set(),
		houses: new Set(),
		aspects: new Set(),
	};
	sections.forEach((sec)=>{
		outSections.push(sec);
		const mode = getSectionMeaningMode(sec && sec.title);
		if(mode.skip){
			return;
		}
		const lines = (sec.lines || []).slice(1);
		let planets = detectIdsByAliasMap(lines, PLANET_ALIAS_MAP, { category: 'planet' });
		let lots = detectIdsByAliasMap(lines, LOT_ALIAS_MAP, { category: 'lot' });
		const signs = detectIdsByAliasMap(lines, SIGN_ALIAS_MAP, { category: 'sign' });
		const houses = detectIdsByAliasMap(lines, HOUSE_ALIAS_MAP, { category: 'house' });
		const aspects = detectAspectDegreesFromLines(lines);

		if(mode.forceAllPlanets && planets.size === 0){
			planets = new Set(ASTRO_MEANING_PLANET_IDS);
		}
		if(mode.forceAllLots && lots.size === 0){
			lots = new Set(ASTRO_MEANING_LOT_IDS);
		}
		const hasDetected = planets.size > 0
			|| lots.size > 0
			|| signs.size > 0
			|| houses.size > 0
			|| aspects.size > 0;
		if(!mode.explicit && !hasDetected){
			return;
		}

		const uniquePlanets = new Set(Array.from(planets).filter((id)=>!seen.planets.has(id)));
		const uniqueLots = new Set(Array.from(lots).filter((id)=>!seen.lots.has(id)));
		const uniqueSigns = new Set(Array.from(signs).filter((id)=>!seen.signs.has(id)));
		const uniqueHouses = new Set(Array.from(houses).filter((id)=>!seen.houses.has(id)));
		const uniqueAspects = new Set(Array.from(aspects).filter((deg)=>!seen.aspects.has(deg)));

		const meaningLines = []
			.concat(buildMeaningLinesForIds('planet', uniquePlanets, '星释义'))
			.concat(buildMeaningLinesForIds('lot', uniqueLots, '希腊点释义'))
			.concat(buildMeaningLinesForIds('sign', uniqueSigns, '星座释义'))
			.concat(buildMeaningLinesForIds('house', uniqueHouses, '宫位释义'))
			.concat(buildMeaningLinesForAspects(uniqueAspects));

		if(!meaningLines.length){
			return;
		}
		uniquePlanets.forEach((id)=>seen.planets.add(id));
		uniqueLots.forEach((id)=>seen.lots.add(id));
		uniqueSigns.forEach((id)=>seen.signs.add(id));
		uniqueHouses.forEach((id)=>seen.houses.add(id));
		uniqueAspects.forEach((deg)=>seen.aspects.add(deg));
		outSections.push({
			title: `${sec.title}释义`,
			lines: [
				`[${sec.title}释义]`,
				...meaningLines,
			],
		});
	});

	const appended = joinSectionBlocks(outSections);
	return appended || content;
}

const LIURENG_BRANCH_ORDER = '子丑寅卯辰巳午未申酉戌亥'.split('');
const QIMEN_STEM_ORDER = '甲乙丙丁戊己庚辛壬癸'.split('');
const QIMEN_DOOR_ORDER = ['休门', '生门', '伤门', '杜门', '景门', '死门', '惊门', '开门'];
const QIMEN_STAR_ORDER = ['天蓬', '天任', '天冲', '天辅', '天英', '天芮', '天禽', '天柱', '天心'];
const QIMEN_GOD_ORDER = ['值符', '螣蛇', '太阴', '六合', '白虎', '玄武', '九地', '九天'];

const QIMEN_DOOR_MAP = {
	休: '休门',
	生: '生门',
	伤: '伤门',
	杜: '杜门',
	景: '景门',
	死: '死门',
	惊: '惊门',
	開: '开门',
	开: '开门',
	休门: '休门',
	生门: '生门',
	伤门: '伤门',
	杜门: '杜门',
	景门: '景门',
	死门: '死门',
	惊门: '惊门',
	开门: '开门',
};
const QIMEN_STAR_MAP = {
	蓬: '天蓬',
	任: '天任',
	冲: '天冲',
	沖: '天冲',
	辅: '天辅',
	輔: '天辅',
	英: '天英',
	芮: '天芮',
	禽: '天禽',
	柱: '天柱',
	心: '天心',
	天蓬: '天蓬',
	天任: '天任',
	天冲: '天冲',
	天輔: '天辅',
	天辅: '天辅',
	天英: '天英',
	天芮: '天芮',
	天禽: '天禽',
	天柱: '天柱',
	天心: '天心',
};
const QIMEN_GOD_MAP = {
	符: '值符',
	值符: '值符',
	蛇: '螣蛇',
	腾蛇: '螣蛇',
	螣蛇: '螣蛇',
	阴: '太阴',
	太陰: '太阴',
	太阴: '太阴',
	合: '六合',
	六合: '六合',
	虎: '白虎',
	白虎: '白虎',
	玄: '玄武',
	玄武: '玄武',
	地: '九地',
	九地: '九地',
	天: '九天',
	九天: '九天',
};

function sortByOrderSet(values, order){
	const arr = Array.from(values || []);
	if(!arr.length){
		return arr;
	}
	const idxMap = new Map();
	(order || []).forEach((txt, idx)=>idxMap.set(txt, idx));
	return arr.sort((a, b)=>{
		const ai = idxMap.has(a) ? idxMap.get(a) : 999;
		const bi = idxMap.has(b) ? idxMap.get(b) : 999;
		if(ai !== bi){
			return ai - bi;
		}
		return `${a}`.localeCompare(`${b}`);
	});
}

function normalizeQimenStem(raw){
	const txt = `${raw || ''}`.trim();
	if(!txt){
		return '';
	}
	const match = txt.match(/[甲乙丙丁戊己庚辛壬癸]/);
	return match ? match[0] : '';
}

function normalizeQimenDoor(raw){
	const txt = `${raw || ''}`.trim();
	if(!txt){
		return '';
	}
	const key = txt.replace(/門/g, '门');
	return QIMEN_DOOR_MAP[key] || QIMEN_DOOR_MAP[key.substring(0, 1)] || '';
}

function normalizeQimenStar(raw){
	const txt = `${raw || ''}`.trim();
	if(!txt){
		return '';
	}
	return QIMEN_STAR_MAP[txt] || QIMEN_STAR_MAP[txt.substring(0, 1)] || '';
}

function normalizeQimenGod(raw){
	const txt = `${raw || ''}`.trim();
	if(!txt){
		return '';
	}
	return QIMEN_GOD_MAP[txt] || QIMEN_GOD_MAP[txt.substring(0, 1)] || '';
}

function collectQimenTokensFromSectionLines(lines){
	const stems = new Set();
	const doors = new Set();
	const stars = new Set();
	const gods = new Set();
	const src = Array.isArray(lines) ? lines : [];

	const addByList = (list, type)=>{
		(list || []).forEach((one)=>{
			const txt = `${one || ''}`.trim();
			if(!txt){
				return;
			}
			if(type === 'stem'){
				const v = normalizeQimenStem(txt);
				if(v){
					stems.add(v);
				}
				return;
			}
			if(type === 'door'){
				const v = normalizeQimenDoor(txt);
				if(v){
					doors.add(v);
				}
				return;
			}
			if(type === 'star'){
				const v = normalizeQimenStar(txt);
				if(v){
					stars.add(v);
				}
				return;
			}
			if(type === 'god'){
				const v = normalizeQimenGod(txt);
				if(v){
					gods.add(v);
				}
			}
		});
	};

	src.forEach((line)=>{
		const txt = `${line || ''}`.trim();
		if(!txt){
			return;
		}
		const detailMatch = txt.match(/天盘干[：:]\s*([甲乙丙丁戊己庚辛壬癸]).*?八神[：:]\s*([^\s；;，,]+).*?九星[：:]\s*([^\s；;，,]+).*?地盘干[：:]\s*([甲乙丙丁戊己庚辛壬癸])/);
		if(detailMatch){
			addByList([detailMatch[1], detailMatch[4]], 'stem');
			addByList([detailMatch[2]], 'god');
			addByList([detailMatch[3]], 'star');
		}
		const lineMap = [
			{ prefix: '地盘', type: 'stem' },
			{ prefix: '天盘', type: 'stem' },
			{ prefix: '人盘', type: 'door' },
			{ prefix: '神盘', type: 'god' },
		];
		lineMap.forEach((item)=>{
			const m = txt.match(new RegExp(`^${item.prefix}\\s*[：:]\\s*(.+)$`));
			if(!m || !m[1]){
				return;
			}
			const list = `${m[1]}`.split(/[\s、,，;；/]+/).filter(Boolean);
			addByList(list, item.type);
		});
		if(!txt.includes('宫')){
			return;
		}
		const m = txt.match(/^[^：:]+[：:]\s*(.+)$/);
		if(!m || !m[1]){
			return;
		}
		const list = `${m[1]}`.split(/[\s、,，;；/]+/).filter(Boolean);
		if(list.length >= 5){
			addByList([list[0], list[4]], 'stem');
			addByList([list[1]], 'god');
			addByList([list[2]], 'door');
			addByList([list[3]], 'star');
			return;
		}
		addByList(list, 'stem');
		addByList(list, 'god');
		addByList(list, 'door');
		addByList(list, 'star');
	});

	return {
		stems,
		doors,
		stars,
		gods,
	};
}

function buildQimenTipLines(type, key){
	const tipObj = buildQimenXiangTipObj(type, key);
	if(!tipObj){
		return [];
	}
	const lines = [];
	lines.push(`### ${safe(tipObj.title, key)}`);
	const blocks = Array.isArray(tipObj.blocks) ? tipObj.blocks : [];
	blocks.forEach((block)=>{
		if(!block){
			return;
		}
		if(block.type === 'blank'){
			lines.push('');
			return;
		}
		if(block.type === 'divider'){
			lines.push('==');
			return;
		}
		if(block.type === 'subTitle'){
			lines.push(`### ${safe(block.text, '')}`);
			return;
		}
		const plain = safe(block.text, '').replace(/<[^>]+>/g, '');
		lines.push(plain);
	});
	lines.push('');
	return lines;
}

function buildQimenMeaningLinesByTokens(tokens){
	const lines = [];
	const stems = sortByOrderSet(tokens && tokens.stems, QIMEN_STEM_ORDER);
	const doors = sortByOrderSet(tokens && tokens.doors, QIMEN_DOOR_ORDER);
	const stars = sortByOrderSet(tokens && tokens.stars, QIMEN_STAR_ORDER);
	const gods = sortByOrderSet(tokens && tokens.gods, QIMEN_GOD_ORDER);

	if(stems.length){
		lines.push('【十天干释义】');
		stems.forEach((one)=>{
			lines.push(...buildQimenTipLines('stem', one));
		});
	}
	if(doors.length){
		lines.push('【八门释义】');
		doors.forEach((one)=>{
			lines.push(...buildQimenTipLines('door', one));
		});
	}
	if(stars.length){
		lines.push('【九星释义】');
		stars.forEach((one)=>{
			lines.push(...buildQimenTipLines('star', one));
		});
	}
	if(gods.length){
		lines.push('【八神释义】');
		gods.forEach((one)=>{
			lines.push(...buildQimenTipLines('god', one));
		});
	}
	while(lines.length && lines[lines.length - 1] === ''){
		lines.pop();
	}
	return lines;
}

function normalizeLiurengBranch(raw){
	const match = `${raw || ''}`.match(/[子丑寅卯辰巳午未申酉戌亥]/);
	return match ? match[0] : '';
}

function normalizeLiurengJiang(raw){
	const txt = `${raw || ''}`
		.replace(/（[^）]*）/g, '')
		.replace(/\([^)]*\)/g, '')
		.replace(/^贵神/, '')
		.replace(/^神将/, '')
		.trim();
	return txt;
}

function collectLiurengEntriesFromSectionLines(lines){
	const entries = [];
	const src = Array.isArray(lines) ? lines : [];
	let currentBranch = '';
	src.forEach((line)=>{
		const txt = `${line || ''}`.trim();
		if(!txt){
			return;
		}
		const branchMark = txt.match(/「([子丑寅卯辰巳午未申酉戌亥])\s*[-－]/);
		if(branchMark && branchMark[1]){
			currentBranch = branchMark[1];
		}
		const m = txt.match(/地盘\s*([子丑寅卯辰巳午未申酉戌亥]).*?天盘\s*([子丑寅卯辰巳午未申酉戌亥]).*?贵神[:：]?\s*([^\s；;，,]+)/);
		if(m && m[1] && m[2] && m[3]){
			entries.push({
				di: m[1],
				tian: m[2],
				jiang: normalizeLiurengJiang(m[3]),
			});
			return;
		}
		const s = txt.match(/六壬[:：].*?天盘[:：]\s*([子丑寅卯辰巳午未申酉戌亥]).*?神将[:：]\s*([^\s；;，,]+)/);
		if(s && s[1] && s[2] && currentBranch){
			entries.push({
				di: currentBranch,
				tian: s[1],
				jiang: normalizeLiurengJiang(s[2]),
			});
		}
	});
	const uniq = [];
	const seen = new Set();
	entries.forEach((one)=>{
		if(!one || !one.di || !one.tian || !one.jiang){
			return;
		}
		const key = `${one.di}|${one.tian}|${one.jiang}`;
		if(seen.has(key)){
			return;
		}
		seen.add(key);
		uniq.push(one);
	});
	return uniq;
}

function buildLiurengTipLines(tipObj){
	if(!tipObj){
		return [];
	}
	const lines = [];
	lines.push(`### ${safe(tipObj.title, '')}`);
	(tipObj.tips || []).forEach((one)=>{
		lines.push(`${one}`);
	});
	lines.push('');
	return lines;
}

function buildLiurengMeaningLinesByEntries(entries){
	const lines = [];
	const branchSet = new Set();
	(entries || []).forEach((one)=>{
		if(one && one.tian){
			branchSet.add(one.tian);
		}
	});
	const branches = sortByOrderSet(branchSet, LIURENG_BRANCH_ORDER);
	if(branches.length){
		lines.push('【十二神释义】');
		branches.forEach((branch)=>{
			lines.push(...buildLiurengTipLines(buildLiuRengShenTipObj(branch)));
		});
	}
	const houseTips = [];
	const seenHouse = new Set();
	(entries || []).forEach((one)=>{
		if(!one){
			return;
		}
		const key = `${one.di}|${one.tian}|${one.jiang}`;
		if(seenHouse.has(key)){
			return;
		}
		seenHouse.add(key);
		const tip = buildLiuRengHouseTipObj(one.jiang, one.tian, one.di);
		if(tip){
			houseTips.push(tip);
		}
	});
	if(houseTips.length){
		lines.push('【天将释义】');
		houseTips.forEach((tip)=>{
			lines.push(...buildLiurengTipLines(tip));
		});
	}
	while(lines.length && lines[lines.length - 1] === ''){
		lines.pop();
	}
	return lines;
}

function appendQimenMeaningSections(content){
	const sections = splitContentSections(content);
	if(!sections || !sections.length){
		return content;
	}
	const relevantTitles = new Set(['盘型', '盘面要素', '九宫方盘', '八宫详解']);
	const outSections = [];
	sections.forEach((sec)=>{
		outSections.push(sec);
		const title = `${sec && sec.title ? sec.title : ''}`.trim();
		if(!title || title.includes('注释') || title.includes('释义')){
			return;
		}
		if(!relevantTitles.has(title)){
			return;
		}
		const tokens = collectQimenTokensFromSectionLines((sec.lines || []).slice(1));
		const meaningLines = buildQimenMeaningLinesByTokens(tokens);
		if(!meaningLines.length){
			return;
		}
		outSections.push({
			title: `${title}注释`,
			lines: [
				`[${title}注释]`,
				...meaningLines,
			],
		});
	});
	return joinSectionBlocks(outSections) || content;
}

function appendLiurengMeaningSections(content){
	const sections = splitContentSections(content);
	if(!sections || !sections.length){
		return content;
	}
	const outSections = [];
	sections.forEach((sec)=>{
		outSections.push(sec);
		const title = `${sec && sec.title ? sec.title : ''}`.trim();
		if(!title || title.includes('注释') || title.includes('释义')){
			return;
		}
		if(title !== '十二地盘/十二天盘/十二贵神对应' && title !== '大六壬'){
			return;
		}
		const entries = collectLiurengEntriesFromSectionLines((sec.lines || []).slice(1));
		const meaningLines = buildLiurengMeaningLinesByEntries(entries);
		if(!meaningLines.length){
			return;
		}
		outSections.push({
			title: `${title}注释`,
			lines: [
				`[${title}注释]`,
				...meaningLines,
			],
		});
	});
	return joinSectionBlocks(outSections) || content;
}

function appendSanShiUnitedMeaningSections(content){
	const sections = splitContentSections(content);
	if(!sections || !sections.length){
		return content;
	}
	const outSections = [];
	sections.forEach((sec)=>{
		outSections.push(sec);
		const title = `${sec && sec.title ? sec.title : ''}`.trim();
		if(!title || title.includes('注释') || title.includes('释义')){
			return;
		}
		const isPalaceSection = title.includes('宫');
		const isLiuRengRefSection = title.indexOf('六壬') === 0;
		if(!isPalaceSection && title !== '大六壬' && !isLiuRengRefSection){
			return;
		}
		const lines = (sec.lines || []).slice(1);
		const qimenTokens = collectQimenTokensFromSectionLines(lines);
		const liurengEntries = collectLiurengEntriesFromSectionLines(lines);
		const planets = detectIdsByAliasMap(lines, PLANET_ALIAS_MAP);
		const lots = detectIdsByAliasMap(lines, LOT_ALIAS_MAP);
		const signs = detectIdsByAliasMap(lines, SIGN_ALIAS_MAP);
		const houses = detectIdsByAliasMap(lines, HOUSE_ALIAS_MAP);
		const aspects = detectAspectDegreesFromLines(lines);

		const meaningLines = []
			.concat(buildQimenMeaningLinesByTokens(qimenTokens))
			.concat(buildLiurengMeaningLinesByEntries(liurengEntries))
			.concat(buildMeaningLinesForIds('planet', planets, '星释义'))
			.concat(buildMeaningLinesForIds('lot', lots, '希腊点释义'))
			.concat(buildMeaningLinesForIds('sign', signs, '星座释义'))
			.concat(buildMeaningLinesForIds('house', houses, '宫位释义'))
			.concat(buildMeaningLinesForAspects(aspects));
		if(!meaningLines.length){
			return;
		}
		outSections.push({
			title: `${title}注释`,
			lines: [
				`[${title}注释]`,
				...meaningLines,
			],
		});
	});
	return joinSectionBlocks(outSections) || content;
}

function applyAstroMeaningFilterByContext(content, key){
	const support = isAstroMeaningTechnique(key) || isHoverMeaningTechnique(key);
	if(!support){
		return content;
	}
	const settings = loadAIExportSettings();
	const mode = getAstroMeaningSettingByTechnique(settings, key);
	if(mode.enabled !== 1){
		return content;
	}
	if(key === 'qimen'){
		return appendQimenMeaningSections(content);
	}
	if(key === 'liureng'){
		return appendLiurengMeaningSections(content);
	}
	if(key === 'sanshiunited'){
		return appendSanShiUnitedMeaningSections(content);
	}
	return appendAstroMeaningSections(content);
}

function safeFileName(name){
	const val = (name || 'export')
		.replace(/[\\/:*?"<>|]/g, '_')
		.replace(/\s+/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_+|_+$/g, '');
	return val || 'export';
}

function escapeHtml(str){
	return (str || '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function pad2(num){
	return `${num}`.padStart(2, '0');
}

function formatDateTime(date){
	return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

function formatStamp(date){
	return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}_${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`;
}

function downloadBlob(filename, content, mime){
	// 🔧 文字类导出补 UTF-8 BOM(政策单源 aiAnalysisExport.withUtf8Bom:仅人读的 txt/Word/markdown 加,
	//   json/csv/pdf 等机读或二进制不加;content 非字符串时原样透传,天然安全)。
	const payload = withUtf8Bom(content, mime);
	const blob = new Blob([payload], { type: mime });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.style.display = 'none';
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

// 复制统一走共享件 clipboardText.copyTextSmart(三级降级;原私有 copyText 逐字平移过去)。

// v2.6.10:弃用 window.open 打印窗(桌面 webview 拦截 + 浏览器弹窗拦截)。
// 改为离屏 DOM → html-to-image → jsPDF 分页直接下载 .pdf:无窗口、CJK 安全(走系统字体渲染成图)、
// 浏览器与 Tauri 一致(downloadBlob 路径既有,TXT/Word 同款已验证可用)。
// [E3] 修「PDF 全空白」:html-to-image 是克隆节点(内联样式)→ SVG foreignObject 栅格化,宿主若用
//   大负值离屏偏移,克隆携带该定位 → 画到视口外全白(html2canvas 的同坑修法见 reportExport.js
//   exportReportPdf,机制不同不能照抄:那边靠 onclone 复位,这边靠 style 克隆覆盖)。三层防线:
//   ① toCanvas 的 style 选项把克隆定位归零(顺带绕 WebKit foreignObject 定位层老 bug);
//   ② 宿主 fixed(0,0)+z-index:-1+pointer-events:none(即使 ① 回归,克隆 fixed(0,0) 落 SVG 原点仍出图);
//   ③ 墨迹守卫 + blob 尺寸守卫:空白绝不落盘假成功(失败由调用方降级 TXT)。

// [E3] 位图导出墨迹守卫:从顶向下按块扫描,命中非白像素即停(payload 恒以标题/header 行开篇 →
// 正常路径首块即命中,~1ms)。阈值沿 reportExport 同款实战值;canvas 异常按无墨迹处理(保守降级)。
function canvasHasInk(canvas){
	try{
		if(!canvas || !canvas.width || !canvas.height){ return false; }
		const ctx = canvas.getContext('2d', { willReadFrequently: true });
		if(!ctx){ return false; }
		const step = 64;
		const maxScan = Math.min(canvas.height, 4000);
		for(let y = 0; y < maxScan; y += step){
			const h = Math.min(step, maxScan - y);
			const data = ctx.getImageData(0, y, canvas.width, h).data;
			for(let i = 0; i < data.length; i += 4){
				if(data[i + 3] > 8 && (data[i] < 244 || data[i + 1] < 244 || data[i + 2] < 244)){
					return true;
				}
			}
		}
		return false;
	}catch(e){
		return false;
	}
}

const PDF_HOST_WIDTH = 794;                 // A4 宽 @96dpi
const PDF_MAX_CANVAS_EDGE = 16000;          // 设备px;浏览器 canvas 单边硬上限 32767,留足余量防静默空白/截断
const PDF_CHUNK_HEIGHT = 8000;              // CSS px;超限时按行分块逐块渲染续页

// [E3] PDF 内容分块(纯逻辑,可测):把 text 按「物理行占实测总高 fullH 的比例」摊成多块,
// 每块目标 CSS 高 ≈ chunkHeight。title 只进第 0 块。fullH<=0 或 chunkHeight<=0 → 单块(不分)。
// 关键:比例摊法对「少数超长物理行折成很多视觉行」也稳健——总高大而物理行少时每块自动收到 1 行,
// 不会像固定行数那样把长折行塞成超上限的块(退回静默空白/截断)。
export function planPdfChunks(text, title, fullH, chunkHeight){
	const head = title ? `${title}\n\n` : '';
	const body = `${text == null ? '' : text}`;
	const lines = body.split('\n');
	if(!(fullH > 0) || !(chunkHeight > 0)){
		return [`${head}${body}`];
	}
	const linesPerChunk = Math.max(1, Math.floor((chunkHeight * lines.length) / fullH));
	const chunks = [];
	for(let i = 0; i < lines.length; i += linesPerChunk){
		chunks.push(lines.slice(i, i + linesPerChunk).join('\n'));
	}
	if(chunks.length){ chunks[0] = `${head}${chunks[0]}`; }
	else{ chunks.push(head); }
	return chunks;
}

async function exportPdf(payload){
	const title = payload.tech || '';
	const text = payload.text || '';
	let host = null;
	try{
		const htiMod = await import('html-to-image');
		const toCanvas = htiMod.toCanvas || (htiMod.default && htiMod.default.toCanvas);
		const jspdfMod = await import('jspdf');
		const jsPDF = jspdfMod.jsPDF || jspdfMod.default || jspdfMod;
		if(!toCanvas || !jsPDF){ return false; }
		host = document.createElement('div');
		host.style.cssText = `position:fixed;left:0;top:0;width:${PDF_HOST_WIDTH}px;padding:48px 56px;box-sizing:border-box;background:#ffffff;color:#111111;font:13px/1.7 "PingFang SC","Microsoft YaHei",Arial,sans-serif;white-space:pre-wrap;word-break:break-word;z-index:-1;pointer-events:none;`;
		host.textContent = `${title ? title + '\n\n' : ''}${text}`;
		document.body.appendChild(host);

		// 自适应清晰度 + 超长分块:canvas 高 = CSS 高 × pixelRatio,超上限即静默空白——先降 PR,再按行切块。
		const fullH = host.offsetHeight || 0;
		const pixelRatio = (fullH * 2 <= PDF_MAX_CANVAS_EDGE) ? 2 : 1;
		const contents = (fullH * pixelRatio > PDF_MAX_CANVAS_EDGE)
			? planPdfChunks(text, title, fullH, PDF_CHUNK_HEIGHT)
			: [`${title ? title + '\n\n' : ''}${text}`];

		const renderChunk = async (content)=>{
			host.textContent = content;
			// style 覆盖作用于「克隆节点」:定位归零到普通流(防线①);skipFonts:纯 textContent+系统字体,
			// 免 html-to-image 在 WKWebView 抓全文档 @font-face 失败/挂起一类问题。
			return toCanvas(host, {
				pixelRatio,
				backgroundColor: '#ffffff',
				cacheBust: true,
				skipFonts: true,
				style: { position: 'static', left: '0', top: '0', margin: '0' },
			});
		};

		const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
		const margin = 10;
		const cwMm = pdf.internal.pageSize.getWidth() - margin * 2;     // 内容宽(mm)
		const chMm = pdf.internal.pageSize.getHeight() - margin * 2;    // 内容高(mm)
		let first = true;
		for(let ci = 0; ci < contents.length; ci++){
			let canvas = await renderChunk(contents[ci]);
			// 墨迹守卫覆盖「每一块」(非仅首块):任何本应有内容的块渲染空白 → 重试一次 → 仍空白则整份放弃降级 TXT,
			// 绝不把空白页当正常页 addImage(续块在 WKWebView 大 canvas 内存压力/超上限 clamp 下也会偶发空白)。
			// 「本应有墨迹」= 该块去空白后非空(首块含 header 恒 true;尾部纯空行块合法空白,跳过墨迹校验只查尺寸)。
			const expectInk = `${contents[ci]}`.trim().length > 0;
			if(expectInk && !canvasHasInk(canvas)){
				canvas = await renderChunk(contents[ci]);
				if(!canvasHasInk(canvas)){
					console.error(`[aiExport] PDF 第 ${ci} 块渲染空白(重试后仍无墨迹),放弃落盘`);
					return false;
				}
			}
			if(!canvas || !canvas.width || !canvas.height){
				console.error('[aiExport] PDF 渲染 canvas 尺寸为 0,放弃落盘');
				return false;
			}
			const pxPerMm = canvas.width / cwMm;
			const pageHpx = Math.floor(chMm * pxPerMm);
			let y = 0;
			while(y < canvas.height){
				const sliceH = Math.min(pageHpx, canvas.height - y);
				const slice = document.createElement('canvas');
				slice.width = canvas.width; slice.height = sliceH;
				slice.getContext('2d').drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
				if(!first) pdf.addPage();
				pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, cwMm, sliceH / pxPerMm);
				first = false; y += sliceH;
			}
		}
		const blob = pdf.output('blob');
		if(!blob || blob.size < 5000){
			console.error(`[aiExport] PDF blob 异常(size=${blob && blob.size}),放弃落盘`);
			return false;
		}
		downloadBlob(`${payload.filenameBase}.pdf`, blob, 'application/pdf');
		return true;
	}catch(e){
		console.error('[aiExport] PDF 导出失败:', e);
		return false;
	}finally{
		if(host && host.parentNode){ try{ host.parentNode.removeChild(host); }catch(e){} }
	}
}

function exportTxt(payload){
	downloadBlob(`${payload.filenameBase}.txt`, payload.text, 'text/plain;charset=utf-8');
}

function exportWord(payload){
	const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(payload.tech)}</title>
</head>
<body>
<pre style="white-space: pre-wrap; word-break: break-word; font-family: 'Microsoft YaHei', Arial, sans-serif; line-height: 1.5;">${escapeHtml(payload.text)}</pre>
</body>
</html>`;
	downloadBlob(`${payload.filenameBase}.doc`, html, 'application/msword;charset=utf-8');
}

function normalizeExportKey(key){
	const val = `${key || ''}`;
	if(val === 'direction'){
		return 'primarydirect';
	}
	return val;
}

function isStrictSpecificExportKey(key){
	const val = normalizeExportKey(key);
	if(!val){
		return false;
	}
	if(val === 'generic' || val === 'cntradition' || val === 'cnyibu'){
		return false;
	}
	return AI_EXPORT_TECHNIQUES.some((item)=>item.key === val);
}

function isPredictiveExportKey(key){
	const val = normalizeExportKey(key);
	return val === 'primarydirect'
		|| val === 'primarydirchart'
		|| val === 'zodialrelease'
		|| val === 'firdaria'
		|| val === 'distributions'
		|| val === 'agepoint'
		|| val === 'profection'
		|| val === 'solararc'
		|| val === 'solarreturn'
		|| val === 'lunarreturn'
		|| val === 'givenyear'
		|| val === 'decennials'
		|| val === 'planetaryages'
		|| val === 'vedicprog'
		|| val === 'jaynesprog'
		|| val === 'planetaryarc'
		|| val === 'persiandirected'
		|| val === 'yearsystem129'
		|| val === 'balbillus'
		|| val === 'triplicityrulers'
		|| val === 'keypoints'
		|| val === 'lunationphase'
		|| val === 'extrareturns';
}

function isAstroFamilyExportKey(key){
	const val = normalizeExportKey(key);
	if(!val){
		return false;
	}
	if(isPredictiveExportKey(val)){
		return true;
	}
	return val === 'astrochart'
		|| val === 'astrochart_like'
		|| val === 'indiachart'
		|| val === 'relative'
		|| val === 'germany'
		|| val === 'jieqi'
		|| val === 'guolao';
}

function getTechniqueLabelByKey(key){
	const found = AI_EXPORT_TECHNIQUES.find((item)=>item.key === `${key || ''}`);
	return found ? found.label : '';
}

function getCandidateExportKeys(context){
	const keys = [];
	const primary = normalizeExportKey(context && context.key ? context.key : '');
	if(primary){
		keys.push(primary);
	}
	const hasPrimarySpecific = !!primary && primary !== 'generic';
	const stateContext = resolveContextByAstroState();
	const stateKey = normalizeExportKey(stateContext && stateContext.key ? stateContext.key : '');
	const shouldAppendStateKey = !!stateKey && (
		!hasPrimarySpecific
		|| stateKey === primary
		|| !isStrictSpecificExportKey(primary)
	);
	if(shouldAppendStateKey){
		keys.push(stateKey);
	}

	const topInfo = [
		context && context.topLabel ? context.topLabel : '',
		context && context.displayName ? context.displayName : '',
		stateContext && stateContext.displayName ? stateContext.displayName : '',
	].join(' ');
	const predictiveKeys = ['primarydirect', 'primarydirchart', 'zodialrelease', 'firdaria', 'distributions', 'agepoint', 'profection', 'solararc', 'solarreturn', 'lunarreturn', 'givenyear', 'decennials', 'planetaryages', 'vedicprog', 'jaynesprog', 'planetaryarc', 'persiandirected', 'yearsystem129', 'balbillus', 'triplicityrulers', 'keypoints', 'lunationphase', 'extrareturns'];
	const primaryIsPredictive = isPredictiveExportKey(primary);
	const stateIsPredictive = isPredictiveExportKey(stateKey);
	// 仅在上下文无法定位具体推运子模块时，才展开推运候选全量兜底；
	// 避免“太阳弧导出成主限法”这类串台。
	if((topInfo.includes('星运') || topInfo.includes('推运盘') || stateIsPredictive) && !primaryIsPredictive){
		keys.push(...predictiveKeys);
	}
	if(topInfo.includes('三式合一') && !hasPrimarySpecific){
		keys.push('sanshiunited', 'qimen', 'jinkou', 'liureng', 'sixyao', 'tongshefa', 'taiyi');
	}
	if((topInfo.includes('易与三式') || topInfo.includes('其他术数') || topInfo.includes('六爻')
		|| topInfo.includes('六壬') || topInfo.includes('金口诀') || topInfo.includes('遁甲') || topInfo.includes('太乙')
		|| topInfo.includes('皇极') || topInfo.includes('五兆') || topInfo.includes('太玄') || topInfo.includes('荆诀') || topInfo.includes('神易')) && !hasPrimarySpecific){
		keys.push('suzhan', 'sixyao', 'jinkou', 'liureng', 'qimen', 'taiyi', 'tongshefa', 'huangji', 'wuzhao', 'taixuan', 'jingjue', 'shenyishu');
	}
	if((topInfo.includes('数算') || topInfo.includes('邵子') || topInfo.includes('铁板') || topInfo.includes('鬼谷') || topInfo.includes('北极') || topInfo.includes('南极') || topInfo.includes('蠢子')) && !hasPrimarySpecific){
		keys.push('shaozi', 'tieban', 'fendjing', 'beiji', 'nanji', 'chunzi');
	}
	if((topInfo.includes('演禽') || topInfo.includes('仙禽')) && !hasPrimarySpecific){
		keys.push('xianqin');
	}
	if(topInfo.includes('策天') && !hasPrimarySpecific){
		keys.push('cetian');
	}
	if((topInfo.includes('八字紫微') || topInfo.includes('八字') || topInfo.includes('紫微')) && !hasPrimarySpecific){
		keys.push('bazi', 'ziwei');
	}
	if(topInfo.includes('量化盘') && !hasPrimarySpecific){
		keys.push('germany');
	}
	if(topInfo.includes('卜卦') && !hasPrimarySpecific){
		keys.push('horary');
	}
	if(topInfo.includes('择日') && !hasPrimarySpecific){
		keys.push('election');
	}
	if(topInfo.includes('世俗') && !hasPrimarySpecific){
		keys.push('mundane');
	}
	if((topInfo.includes('合盘') || topInfo.includes('关系盘')) && !hasPrimarySpecific){
		keys.push('relative');
	}
	if(topInfo.includes('七政四余') && !hasPrimarySpecific){
		keys.push('qizhengkin', 'guolao');
	}
	if(topInfo.includes('节气盘') && !hasPrimarySpecific){
		keys.push('jieqi');
	}
	if((topInfo.includes('印度占星') || topInfo.includes('印度律盘')) && !hasPrimarySpecific){
		keys.push('indiachart');
	}
	if((topInfo.includes('星盘') || topInfo.includes('三维盘') || topInfo.includes('十三分盘') || topInfo.includes('希腊星术') || topInfo.includes('占星地图') || topInfo.includes('星体地图')) && !hasPrimarySpecific){
		keys.push('astrochart', 'astrochart_like');
	}

	// 兜底候选：确保上下文误判时仍能从计算快照抓到内容。
	if(!hasPrimarySpecific){
		keys.push('astrochart', 'astrochart_like', 'indiachart', 'relative', 'germany', 'jieqi', 'guolao', 'qizhengkin', 'bazi', 'ziwei', 'qimen', 'liureng', 'jinkou', 'sanshiunited', 'tongshefa', 'huangji', 'wuzhao', 'taixuan', 'jingjue', 'shenyishu', 'sixyao', 'taiyi', 'shaozi', 'tieban', 'fendjing', 'beiji', 'nanji', 'chunzi', 'xianqin', 'cetian', 'otherbu', 'fengshui');
	}

	return uniqueArray(keys.map((key)=>normalizeExportKey(key)).filter(Boolean));
}

function getRescueExportKeys(context, fallbackStateContext, triedKeys){
	const tried = triedKeys instanceof Set ? triedKeys : new Set();
	const keys = [];
	const push = (...arr)=>{
		arr.forEach((item)=>{
			const key = normalizeExportKey(item);
			if(!key || key === 'generic'){
				return;
			}
			if(tried.has(key)){
				return;
			}
			if(keys.includes(key)){
				return;
			}
			keys.push(key);
		});
	};

	const contextKey = normalizeExportKey(context && context.key ? context.key : '');
	const stateKey = normalizeExportKey(fallbackStateContext && fallbackStateContext.key ? fallbackStateContext.key : '');
	const hasContextSpecific = isStrictSpecificExportKey(contextKey);
	const topInfo = [
		context && context.topLabel ? context.topLabel : '',
		context && context.displayName ? context.displayName : '',
		fallbackStateContext && fallbackStateContext.displayName ? fallbackStateContext.displayName : '',
	].join(' ');

	push(contextKey);
	if(!hasContextSpecific){
		push(stateKey);
	}
	if(hasContextSpecific){
		if(contextKey === 'jieqi'){
			push('jieqi', 'jieqi_current');
			return keys;
		}
		push(contextKey);
		return keys;
	}
	if(topInfo.includes('星运') || topInfo.includes('推运盘') || topInfo.includes('主限法') || topInfo.includes('法达星限')
		|| topInfo.includes('太阳弧') || topInfo.includes('太阳返照') || topInfo.includes('月亮返照')){
		push('primarydirect', 'primarydirchart', 'firdaria', 'zodialrelease', 'profection', 'solararc', 'solarreturn', 'lunarreturn', 'givenyear', 'decennials', 'planetaryages', 'vedicprog', 'jaynesprog', 'planetaryarc', 'persiandirected', 'yearsystem129', 'balbillus', 'triplicityrulers', 'keypoints', 'lunationphase', 'extrareturns');
	}
	if(topInfo.includes('三式合一')){
		push('sanshiunited', 'qimen', 'jinkou', 'liureng', 'sixyao', 'tongshefa', 'taiyi', 'astrochart');
	}
	if(topInfo.includes('易与三式') || topInfo.includes('其他术数') || topInfo.includes('六爻')
		|| topInfo.includes('六壬') || topInfo.includes('金口诀') || topInfo.includes('遁甲') || topInfo.includes('太乙')
		|| topInfo.includes('皇极') || topInfo.includes('五兆') || topInfo.includes('太玄') || topInfo.includes('荆诀') || topInfo.includes('神易')){
		push('jinkou', 'liureng', 'qimen', 'sixyao', 'tongshefa', 'huangji', 'wuzhao', 'taixuan', 'jingjue', 'shenyishu', 'taiyi', 'suzhan');
	}
	if(topInfo.includes('数算') || topInfo.includes('邵子') || topInfo.includes('铁板') || topInfo.includes('鬼谷') || topInfo.includes('北极') || topInfo.includes('南极') || topInfo.includes('蠢子')){
		push('shaozi', 'tieban', 'fendjing', 'beiji', 'nanji', 'chunzi');
	}
	if(topInfo.includes('演禽') || topInfo.includes('仙禽')){
		push('xianqin');
	}
	if(topInfo.includes('策天')){
		push('cetian');
	}
	if(topInfo.includes('八字') || topInfo.includes('紫微')){
		push('bazi', 'ziwei');
	}
	if(topInfo.includes('合盘') || topInfo.includes('关系盘')){
		push('relative');
	}
	if(topInfo.includes('量化盘')){
		push('germany');
	}
	if(topInfo.includes('节气盘')){
		push('jieqi');
	}
	if(topInfo.includes('印度占星') || topInfo.includes('印度律盘')){
		push('indiachart', 'astrochart');
	}
	if(topInfo.includes('七政四余')){
		push('qizhengkin', 'guolao', 'astrochart_like', 'astrochart');
	}
	if(topInfo.includes('星盘') || topInfo.includes('十三分盘') || topInfo.includes('希腊星术') || topInfo.includes('占星地图') || topInfo.includes('星体地图') || topInfo.includes('三维盘')){
		push('astrochart', 'astrochart_like', 'indiachart');
	}
	// 终极兜底：按术法族群补全，避免误报“无可导出文本”。
	push(
		'astrochart', 'astrochart_like', 'indiachart',
		'relative', 'germany', 'jieqi',
		'primarydirect', 'primarydirchart', 'zodialrelease', 'firdaria', 'profection', 'solararc', 'solarreturn', 'lunarreturn', 'givenyear', 'decennials',
		'planetaryages', 'vedicprog', 'jaynesprog', 'planetaryarc', 'persiandirected', 'yearsystem129', 'balbillus', 'triplicityrulers', 'keypoints', 'lunationphase', 'extrareturns',
		'sanshiunited', 'qimen', 'liureng', 'jinkou', 'sixyao', 'tongshefa', 'huangji', 'wuzhao', 'taixuan', 'jingjue', 'shenyishu', 'taiyi', 'suzhan',
		'guolao', 'qizhengkin', 'shaozi', 'tieban', 'fendjing', 'beiji', 'nanji', 'chunzi', 'xianqin', 'cetian', 'otherbu', 'fengshui',
		'bazi', 'ziwei',
	);
	return keys;
}

// 「简单模块」预测技法：内容来自前端保存的模块快照(saveModuleAISnapshot)而非预测后端 payload。
// 路由与自检共用此单一真值表 —— 防「登记进 predictive 却漏配 extractContentByKey 路由」(extrareturns 曾正是漏此条 → AI导出/挂载拿不到多重回归快照)。
export const AI_EXPORT_SIMPLE_MODULE_KEYS = ['planetaryages', 'vedicprog', 'jaynesprog', 'planetaryarc', 'persiandirected', 'yearsystem129', 'balbillus', 'triplicityrulers', 'keypoints', 'lunationphase', 'extrareturns'];

async function extractContentByKey(exportKey, context){
	if(exportKey === 'astrochart' || exportKey === 'astrochart_like' || exportKey === 'indiachart'){
		return extractAstroContent(context);
	}
	if(exportKey === 'germany'){
		return extractGermanyContent(context);
	}
	if(exportKey === 'jieqi' || isJieQiSplitSettingKey(exportKey)){
		return extractJieQiContent(context);
	}
	if(exportKey === 'horary' || exportKey === 'election' || exportKey === 'mundane'){
		// 卜卦/择日:读 saveModuleAISnapshot 存的模块快照;世俗:走 refresh-event(DivinationChartShell 写 detail.snapshotText)。
		// extractSimpleModuleContent 先派发 refresh-event 再回落 cached,三者统一覆盖(此前缺分支 → 落 generic / 被辅盘默认串成量化盘)。
		return extractSimpleModuleContent(exportKey);
	}
	if(exportKey === 'primarydirect'){
		return extractPrimaryDirectContent(context);
	}
	if(exportKey === 'primarydirchart'){
		return extractPrimaryDirChartContent(context);
	}
	if(exportKey === 'zodialrelease'){
		return extractZodialReleaseContent(context);
	}
	if(exportKey === 'firdaria'){
		return extractFirdariaContent(context);
	}
	if(exportKey === 'profection'){
		return extractProfectionContent(context);
	}
	if(exportKey === 'solararc'){
		return extractSolarArcContent(context);
	}
	if(exportKey === 'solarreturn'){
		return extractSolarReturnContent(context);
	}
	if(exportKey === 'lunarreturn'){
		return extractLunarReturnContent(context);
	}
	if(exportKey === 'givenyear'){
		return extractGivenYearContent(context);
	}
	if(exportKey === 'decennials'){
		return extractDecennialsContent(context);
	}
	if(exportKey === 'distributions' || exportKey === 'agepoint'){
		// 界推运/年龄推进点：组件内 fetch /predict/dist|agepoint 后经 refresh-event 回写快照(同主限法机制)。
		// 此前缺分支 → 落 extractGenericContent → 导出「无可导出文本」；补齐后与其余推运一致。
		return extractSimpleModuleContent(exportKey);
	}
	if(AI_EXPORT_SIMPLE_MODULE_KEYS.indexOf(exportKey) >= 0){
		return extractSimpleModuleContent(exportKey);
	}
	if(exportKey === 'sixyao'){
		return extractSixYaoContent(context);
	}
	if(exportKey === 'liureng'){
		return extractLiuRengContent(context);
	}
	if(exportKey === 'jinkou'){
		return extractJinKouContent(context);
	}
	if(exportKey === 'qimen'){
		return extractQiMenContent(context);
	}
	if(exportKey === 'sanshiunited'){
		return extractSanShiUnitedContent(context);
	}
	if(exportKey === 'tongshefa'){
		return extractTongSheFaContent(context);
	}
	if(exportKey === 'huangji'){
		return extractSimpleModuleContent('huangji');
	}
	if(exportKey === 'wuzhao' || exportKey === 'taixuan' || exportKey === 'jingjue' || exportKey === 'shenyishu'
		|| exportKey === 'shaozi' || exportKey === 'tieban' || exportKey === 'fendjing' || exportKey === 'beiji'
		|| exportKey === 'nanji' || exportKey === 'chunzi' || exportKey === 'xianqin' || exportKey === 'cetian'
		|| exportKey === 'qizhengkin'){
		return extractSimpleModuleContent(snapshotModuleKeyByContextKey(exportKey));
	}
	if(exportKey === 'taiyi'){
		return extractTaiYiContent(context);
	}
	if(exportKey === 'relative'){
		return extractRelativeContent(context);
	}
	if(exportKey === 'guolao'){
		return extractSimpleModuleContent('guolao');
	}
	if(exportKey === 'suzhan'){
		return extractSimpleModuleContent('suzhan');
	}
	if(exportKey === 'bazi'){
		return extractSimpleModuleContent('bazi');
	}
	if(exportKey === 'ziwei'){
		return extractSimpleModuleContent('ziwei');
	}
	if(exportKey === 'otherbu'){
		return extractOtherBuContent(context);
	}
	if(exportKey === 'fengshui'){
		return extractFengShuiContent(context);
	}
	if(exportKey === 'canping'){
		return extractSimpleModuleContent('canping');
	}
	if(exportKey === 'heluo'){
		return extractSimpleModuleContent('heluo');
	}
	if(exportKey === 'yizhangjing'){
		// 一掌经（其他/命）：中栏组件按当前流派即时构建快照，refresh-event → 回退模块缓存。
		return extractSimpleModuleContent('yizhangjing');
	}
	return extractGenericContent(context);
}

// 古典格局派生分析(analyze_chart)按需 fetch — 与 AI 挂载同源(astroAiSnapshot.buildClassicalAnalysisSection)。
// 仅导出 astrochart/astrochart_like 时拉,优雅降级(失败/无参数返回 '')。~50ms 级,不进每盘预建快照。
async function fetchAstroClassicalAnalysisSectionForExport(){
	try{
		const store = getStore();
		const chartObj = store && store.astro ? store.astro.chartObj : null;
		const raw = chartObj && chartObj.params ? chartObj.params : null;
		if(!raw){
			return '';
		}
		// chartObj.params 用合并的 birth「YYYY-MM-DD HH:mm:ss」,无独立 date/time → 须像 chartParams 那样拆出,
		// 否则 /astroextra/analysis 报 miss.date。无 date 则直接放弃(静默,不发请求、不弹错)。
		const birthParts = `${raw.birth || ''}`.split(' ');
		const params = {
			...raw,
			date: raw.date || birthParts[0],
			time: raw.time || birthParts[1] || '12:00:00',
		};
		// 守 (HIGH-4):缺 date/zone/lat/lon 任一都静默 skip(后端必校验,缺则 4xx)。
		if(!params.date || !params.zone || params.lat === undefined || params.lat === null || params.lon === undefined || params.lon === null){
			return '';
		}
		const data = await request(`${ExportConstants.ServerRoot}/astroextra/analysis`, {
			body: JSON.stringify({ ...params, fixedStarOrb: 1 }),
			silent: true,
			timeoutMs: 20000,
		});
		const analysis = data && data.Result ? data.Result : data;
		return buildClassicalAnalysisSection(analysis) || '';
	}catch(e){
		return '';
	}
}

async function buildPayload(){
	const context = resolveExportContextForPayload(withStoreContextFallback(resolveActiveContext()));
	const exportKey = normalizeExportKey(context.key);
	const now = new Date();

	let content = '';
	let usedExportKey = exportKey;
	const fallbackStateContext = resolveContextByAstroState();
	const fallbackStateKey = normalizeExportKey(fallbackStateContext && fallbackStateContext.key ? fallbackStateContext.key : '');
	const candidateKeys = getCandidateExportKeys(context);

	for(let i=0; i<candidateKeys.length; i++){
		const key = candidateKeys[i];
		const candidateContext = (fallbackStateKey && key === fallbackStateKey)
			? { ...context, ...fallbackStateContext }
			: context;
		const txt = await extractContentByKey(key, candidateContext);
		if(txt && `${txt}`.trim()){
			content = txt;
			usedExportKey = key;
			break;
		}
	}
	if(!content){
		content = await extractContentByKey(usedExportKey, context);
	}
	if(!`${content || ''}`.trim()){
		const tried = new Set(candidateKeys.map((key)=>normalizeExportKey(key)).filter(Boolean));
		const rescueKeys = getRescueExportKeys(context, fallbackStateContext, tried);
		for(let i=0; i<rescueKeys.length; i++){
			const key = rescueKeys[i];
			const candidateContext = (fallbackStateKey && key === fallbackStateKey)
				? { ...context, ...fallbackStateContext }
				: context;
			// eslint-disable-next-line no-await-in-loop
			const txt = await extractContentByKey(key, candidateContext);
			if(txt && `${txt}`.trim()){
				content = txt;
				usedExportKey = key;
				break;
			}
		}
	}

	// 古典格局派生分析按需拼入(仅西占主盘/十三分盘),置于段过滤前 → 受「古典格局」导出段开关控制、不遗漏。
	if(usedExportKey === 'astrochart' || usedExportKey === 'astrochart_like'){
		const classicalAnalysis = await fetchAstroClassicalAnalysisSectionForExport();
		if(classicalAnalysis){
			content = `${`${content || ''}`.trim()}\n\n${classicalAnalysis}`.trim();
		}
	}
	// 占星地图专属真值(仅当前上下文=占星地图 tab):最近一次地图状态(口径/线经度/CCG/关系盘/落点),
	// 单一真值源=后端 ACGraph 响应;置于段过滤前 → 受「占星地图」导出段开关控制。无快照优雅降级。
	if(usedExportKey === 'astrochart_like' && context && context.displayName === '占星地图'){
		try{
			const acgSection = buildAcgSectionText();
			if(acgSection){
				content = `${`${content || ''}`.trim()}\n\n${acgSection}`.trim();
			}
		}catch(e){ /* graceful */ }
	}
	const rawSnapshotContent = stripForbiddenSections(content, usedExportKey);
	content = applyUserSectionFilterByContext(rawSnapshotContent, usedExportKey);
	let planetSettingKey = usedExportKey;
	if(usedExportKey === 'jieqi' || isJieQiSplitSettingKey(usedExportKey)){
		planetSettingKey = isJieQiSplitSettingKey(usedExportKey)
			? usedExportKey
			: (detectJieQiSettingKeyByScope(context.scopeRoot) || detectJieQiSettingKeyByCurrentSnapshot() || 'jieqi');
	}
	content = applyPlanetInfoFilterByContext(content, planetSettingKey);
	const normalizeDomain = isKentangRawExportKey(usedExportKey) ? 'kentang_raw' : context.domain;
	content = normalizeText(content, normalizeDomain);
	content = applyAstroMeaningFilterByContext(content, planetSettingKey)
		.replace(/\n{3,}/g, '\n\n')
		.trim();
	if(!content && rawSnapshotContent){
		// 兜底：设置过滤链条异常时，回退到计算快照原文，避免“无可导出文本”误报。
		content = applyAstroMeaningFilterByContext(normalizeText(rawSnapshotContent, normalizeDomain), planetSettingKey)
			.replace(/\n{3,}/g, '\n\n')
			.trim();
	}
	const displayName = getTechniqueLabelByKey(usedExportKey) || context.displayName || '当前技术';
	const stamp = formatStamp(now);
	const time = formatDateTime(now);
	const filenameBase = `horosa_${safeFileName(displayName)}_${stamp}`;
	// v2.2.1:把「日界点·晚子时」排盘规则写进导出头,让 AI 知道四柱按哪种换日/起时干规则计算。
	const a23 = defaultAfter23NewDay();
	const lzh = defaultLateZiHourUseNextDay();
	const dayRule = `排盘规则: 日界点【${a23 === 0 ? '24点算第二天·日柱守今' : '23点算第二天·日柱进位次日'}】, 晚子时·时柱起干【${lzh === 0 ? '按当日柱·今日干起子时' : '按次日柱·次日干起子时'}】(仅 23:00–23:59 影响日柱/时柱)`;
	const header = [
		`技术: ${displayName}`,
		`导出时间: ${time}`,
		`页面: ${window.location.href}`,
		'说明: 当前激活技术面板专属导出；符号已转为AI可识别文本。',
		dayRule,
		'',
		'========== 内容开始 =========='
	].join('\n');
	const text = `${header}\n${content}\n========== 内容结束 ==========`;

	return {
		tech: displayName,
		content,
		text,
		filenameBase,
	};
}

export async function runAIExport(action){
	try{
		const payload = await buildPayload();
		const pure = (payload.content || '').replace(/\s/g, '');
		if(!pure){
			return { ok: false, message: '当前页面没有可导出文本。' };
		}

		if(action === 'copy'){
			const ok = await copyTextSmart(payload.text);
			if(ok){ return { ok: true, message: 'AI纯文字已复制。' }; }
			// 剪贴板不可用(桌面 webview / 非聚焦 / 安全上下文)→ 自动导出 TXT,用户必有产物。
			exportTxt(payload);
			return { ok: true, message: '剪贴板不可用，已自动导出 TXT 文件。' };
		}
		if(action === 'txt'){
			exportTxt(payload);
			return { ok: true, message: 'TXT 已导出。' };
		}
		if(action === 'word'){
			exportWord(payload);
			return { ok: true, message: 'Word 已导出。' };
		}
		if(action === 'pdf'){
			const ok = await exportPdf(payload);
			if(ok){ return { ok: true, message: 'PDF 已导出。' }; }
			// PDF 生成失败(渲染空白/异常)→ 自动导出 TXT,用户必有产物(同 copy 分支降级先例)。
			exportTxt(payload);
			return { ok: true, message: 'PDF 生成失败，已自动导出 TXT（内容相同，可改用 Word）。' };
		}
		if(action === 'all'){
			const copied = await copyTextSmart(payload.text);
			exportTxt(payload);
			exportWord(payload);
			const pdfOk = await exportPdf(payload);
			const got = ['TXT', 'Word'].concat(pdfOk ? ['PDF'] : []);
			let message = `已导出 ${got.join(' / ')}${copied ? '，并复制到剪贴板' : ''}。`;
			if(!copied){ message += '（剪贴板不可用，全文已在 TXT 内）'; }
			if(!pdfOk){ message += '（PDF 生成失败，可用 Word）'; }
			return { ok: true, message };
		}
		return { ok: false, message: '未知导出动作。' };
	}catch(e){
		const msg = e && e.message ? e.message : 'AI导出异常，请重试。';
		return { ok: false, message: msg };
	}
}

// 仅供 jest 注入测试(照 services/aianalysis.js __testing__ 先例);生产代码勿 import。
export const __aiExportTesting__ = { exportPdf, canvasHasInk, planPdfChunks };
