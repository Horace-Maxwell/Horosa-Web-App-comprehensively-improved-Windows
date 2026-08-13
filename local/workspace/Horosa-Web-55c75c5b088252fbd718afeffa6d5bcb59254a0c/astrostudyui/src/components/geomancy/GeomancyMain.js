import QuickDockBar from '../common/QuickDockBar';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { safeLocalStorageSet } from '../../utils/safeStorage';
// 🔴 React 须显式导入:JSX 编译成 React.createElement,应用构建靠 umi 自动注入才没炸,
//    但 jest 直接载入本模块时无此注入 → render 期 ReferenceError。仓内同族坑已犯过一次。
import React, { Component } from 'react';
import { Input, InputNumber, Spin, message } from 'antd';
import XQIcon from '../xq-icons';
import { XQButton as Button, XQSelect as Select, XQTabs as Tabs, XQSideSection } from '../xq-ui';
import { saveModuleAISnapshotLazy, saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { ServerRoot, ResultKey } from '../../utils/constants';
import { AstroFont } from '../../constants/AstroConst';
import { buildKentangEndpoint } from '../../integrations/kentang/serviceRoot';
import { cachedKentangFetch } from '../../utils/kentangCache';
import { openKentangCaseDrawer, getKentangSavedCasePayload } from '../../utils/kentangCaseSave';
import TechniqueErrorBoundary from '../common/TechniqueErrorBoundary';
import { getSignSymbol } from '../astro/IndiaSouthChart';
import SpaceTimePanel, { buildDateTimeFromFields } from '../comp/SpaceTimePanel';
import { sideSectionIcon } from '../../constants/sideSectionIcons';
import { subscribeRemoteNongli, paramsFromFields, timePatchFromDateTime, geoPatchFromRec, snapshotMetaFromFields } from '../../utils/divinationTimeDraft';
import './GeomancyMain.less';

const { TabPane } = Tabs;
const { Option } = Select;
const { TextArea } = Input;

// 英文星座名 → 1-12,取我方 ywastro 星座符(与印度盘同一套 glyph,设计语言统一)。
const SIGN_EN_TO_NUM = {
	Aries: 1, Taurus: 2, Gemini: 3, Cancer: 4, Leo: 5, Virgo: 6,
	Libra: 7, Scorpio: 8, Sagittarius: 9, Capricorn: 10, Aquarius: 11, Pisces: 12,
};
function signGlyph(signEn){
	const num = SIGN_EN_TO_NUM[signEn];
	return num ? getSignSymbol(num) : '';
}
// 行星 → 我方 ywastro 字形(与主星盘同套:A日 B月 C水 D金 E火 F木 G土 K北交 L南交)。
const PLANET_GLYPH_BY_ZH = {
	'太阳': 'A', '月亮': 'B', '水星': 'C', '金星': 'D', '火星': 'E', '木星': 'F', '土星': 'G',
	'天王星': 'H', '海王星': 'I', '冥王星': 'J',
	'龙头': 'K', '北交': 'K', '北交点': 'K', '罗睺': 'K',
	'龙尾': 'L', '南交': 'L', '南交点': 'L', '计都': 'L',
};
function planetGlyph(planetZh){
	return PLANET_GLYPH_BY_ZH[planetZh] || '';
}
// 落星层用:引擎行星键(英文)→ 同一套 ywastro 字形,避免 Unicode 字形在暗底缺笔/走形。
const PLANET_GLYPH_BY_EN = {
	Sun: 'A', Moon: 'B', Mercury: 'C', Venus: 'D', Mars: 'E', Jupiter: 'F', Saturn: 'G',
	NorthNode: 'K', SouthNode: 'L',
};
// [高级传本] 逐项改写字段表。key=请求参数名(驼峰,后端已收);backendKey=后端回传 settings 里的键(蛇形)。
// 每项都可「跟随预设」——不发该参,由后端回落所选流派默认 = 字节零回归。
const GRANULAR_FIELDS = [
	{ key: 'direction', backendKey: 'direction', label: '书写方向', options: [
		{ key: 'LTR', label: '自左向右', short: '左起' }, { key: 'RTL', label: '自右向左', short: '右起' }] },
	{ key: 'markStyle', backendKey: 'mark_style', label: '记号样式', options: [
		{ key: 'dots', label: '点阵(单点/双点)', short: '点阵' }, { key: 'lines', label: '线形(单线/双线)', short: '线形' },
		{ key: 'bindu', label: '点线(点/横)', short: '点线' }, { key: 'tablets', label: '片(开/合)', short: '片' }] },
	// 「点数取样」:基准所载为「统计全盘(或四母、或某些关键图)」。
	// 🔴 十二宫取样是**数学退化**(四女为四母转置、四甥成对异或 ⇒ 和恒偶),答案恒为「是」,
	//    故默认取全盘十六图;十二宫仍留作对照,但界面如实标注其不具判别力。
	{ key: 'parityScope', backendKey: 'parity_scope', label: '点数取样', options: [
		{ key: 'shield16', label: '全盘(十六图)', short: '全盘' },
		{ key: 'mothers', label: '四母', short: '四母' },
		{ key: 'houses12', label: '十二宫(结构恒偶)', short: '十二宫' }] },
	// 「图形入宫」三式(传本载三家):顺铺为绝对主流(默认零回归);四正入宫者四母入四正、四女入续宫、
	// 四果宫另取对位两图之和;近世学派另有一套固定置换。与下方「落星法」是正交两维,勿混。
	{ key: 'housePlacement', backendKey: 'house_placement', label: '图形入宫', options: [
		{ key: 'sequential', label: '顺铺(一至十二卦入一至十二宫)', short: '顺铺' },
		{ key: 'angular', label: '四正入宫(果宫取合成卦)', short: '四正' },
		{ key: 'golden_dawn', label: '近世学派置换', short: '近世' }] },
	// 「落星法」:真正分歧在**要不要落星、怎么落**。
	// 故此选择器只管落星:不落星 / 甲(星落所主图之宫)/ 乙(另起点数定宫)。后端键值不动,存档兼容。
	{ key: 'houseProjection', backendKey: 'house_projection', label: '落星法', options: [
		{ key: 'sequential', label: '不落星(仅图形入宫)', short: '不落' },
		{ key: 'astro_from_chart', label: '占星定局甲(星落所主图之宫)', short: '定局甲' },
		{ key: 'astro_bytwelves', label: '占星定局乙(另起点数定宫)', short: '定局乙' },
		// 丁:据左栏所选时地起真实星历盘,各体按真实黄经落宫(缺时地即如实回落甲法)
		{ key: 'real_ephemeris', label: '真实星历(按所选时地落宫)', short: '真星历' }] },
	{ key: 'wrapHouses', backendKey: 'wrap_houses', label: '宫位成环', bool: true, options: [
		{ key: 'false', label: '不环(一与十二不相邻)', short: '不环' }, { key: 'true', label: '成环(首尾相接)', short: '成环' }] },
	{ key: 'reconciler', backendKey: 'reconciler', label: '调和者', bool: true, options: [
		{ key: 'true', label: '取', short: '取' }, { key: 'false', label: '不取', short: '不取' }] },
	// ⚠️ 二式在未转宫时**数学上恒等**(顺铺下宫一之图即首母),非开关失灵;转宫后方分野。
	//    该事实由引擎回传 settings.reconciler_modes_coincide,右栏据此如实说明。
	{ key: 'reconcilerMode', backendKey: 'reconciler_mode', label: '调和者取法', options: [
		{ key: 'judge_first_mother', label: '判官与首母之和', short: '⊕首母' },
		{ key: 'judge_querent_significator', label: '判官与问者指示星之和', short: '⊕问者' }] },
	{ key: 'haltEnabled', backendKey: 'halt_enabled', label: '首母中止', bool: true, options: [
		{ key: 'true', label: '启用(遇大凶首母即止)', short: '启用' }, { key: 'false', label: '不启用', short: '不启用' }] },
	{ key: 'compoundMode', backendKey: 'compound_mode', label: '合成同伴判法', options: [
		{ key: 'inverse', label: '取反(单双互换)', short: '取反' }, { key: 'reverse', label: '逆转(上下翻转)', short: '逆转' }] },
	{ key: 'numberSystem', backendKey: 'number_system', label: '图数体系', options: [
		{ key: 'points', label: '点数(四至八)', short: '点数' }, { key: 'planetary', label: '行星序', short: '行星序' },
		{ key: 'abjad', label: '字母数值', short: '字母值' }] },
	// 上升四源:第三源「取法官之图」为传本自出之法,可免「一宫星体必定入庙」之弊;
	// 第四源「据时地起真实上升」非传本之法(传本盘式之上升取自图形),故只作可选之档,缺省绝不启用 ——
	// 但唯有它带真实度数,故也唯有它能让「象限宫制」真正成立(其余三源无度数必退化整宫)。
	{ key: 'ascSource', backendKey: 'asc_source', label: '上升取法', options: [
		{ key: 'h1_figure', label: '取第一宫之图', short: '一宫' }, { key: 'fresh_points', label: '另起四行点', short: '四点' },
		{ key: 'judge_figure', label: '取法官之图(免一宫必入庙)', short: '法官' },
		{ key: 'real_chart', label: '据所选时地起真实上升', short: '真时地' }] },
	{ key: 'houseSystem', backendKey: 'house_system', label: '宫制', options: [
		{ key: 'whole_sign', label: '整宫制', short: '整宫' },
		{ key: 'quadrant', label: '象限制(须真实上升方不退化)', short: '象限' }] },
	// 名表:只列有配对依据者;马语名与月之十六相名未载「名↔图」配属,故不入此选(在各自视图作参考名录)
	{ key: 'namesSystem', backendKey: 'names_system', label: '名表体系', options: [
		{ key: 'latin', label: '拉丁名', short: '拉丁' }, { key: 'arabic', label: '阿拉伯名', short: '阿拉伯' },
		{ key: 'greek', label: '希腊名', short: '希腊' }, { key: 'hebrew', label: '希伯来名', short: '希伯来' },
		{ key: 'yoruba', label: '约鲁巴名', short: '约鲁巴' }] },
];

// 十六图形马达加斯加名与词义(参考名录)。所据基准只载名与词义、**未载「名↔图」之配对**,
// 故仅作名录呈现,绝不臆造配对;lunar 者亦为太阴月名。
const MALAGASY_NAMES = [
	{ n: 'Taraiky', g: '消瘦;道路' }, { n: 'Alohotsy', g: '钱;不幸', lunar: true },
	{ n: 'Karija', g: '奴;冷语' }, { n: 'Adalo', g: '首领/子;泪', lunar: true },
	{ n: 'Alakaosy', g: '子;恶念', lunar: true }, { n: 'Alatsimay', g: '奴;恶念' },
	{ n: 'Adabara', g: '至圣/神' }, { n: 'Alokola', g: '屋;食' },
	{ n: 'Alikasajy', g: '符咒;哀悼' }, { n: 'Alabiavo', g: '水灵;喜' },
	{ n: 'Alahijana', g: '女;死' }, { n: 'Alahamora', g: '占者;群;忧' },
	{ n: 'Alikisy', g: '地;吉' }, { n: 'Alahasady', g: '食;怒', lunar: true },
	{ n: 'Asombola', g: '丰盛', lunar: true }, { n: 'Alakarabo', g: '盗;不幸', lunar: true },
];

// [北印度式] 十二宫多边形,与本仓印度占星北盘同一套几何(外方+菱形+四角向心半对角线)。
const NORTH_POLYGONS = {
	1: '50,0 75,25 50,50 25,25', 2: '0,0 50,0 25,25', 3: '0,0 25,25 0,50',
	4: '0,50 25,25 50,50 25,75', 5: '0,50 25,75 0,100', 6: '0,100 25,75 50,100',
	7: '50,100 25,75 50,50 75,75', 8: '50,100 75,75 100,100', 9: '100,100 75,75 100,50',
	10: '100,50 75,75 50,50 75,25', 11: '100,50 75,25 100,0', 12: '100,0 75,25 50,0',
};

// [中世纪式] 外方+内方(25–75)+菱形(接边中点、过内方四角)+内外角连线 → 十二格。
// 四菱形三角(上下左右)+ 八角部三角(四角各被其连线一分为二);宫一居左,循逆时针下行。
const MEDIEVAL_POLYGONS = {
	1: '0,50 25,25 25,75',        // 左·菱形三角
	2: '0,100 0,50 25,75',        // 左下角·近左边
	3: '0,100 25,75 50,100',      // 左下角·近下边
	4: '50,100 25,75 75,75',      // 下·菱形三角
	5: '100,100 50,100 75,75',    // 右下角·近下边
	6: '100,100 75,75 100,50',    // 右下角·近右边
	7: '100,50 75,25 75,75',      // 右·菱形三角
	8: '100,0 100,50 75,25',      // 右上角·近右边
	9: '100,0 75,25 50,0',        // 右上角·近上边
	10: '50,0 25,25 75,25',       // 上·菱形三角
	11: '0,0 50,0 25,25',         // 左上角·近上边
	12: '0,0 25,25 0,50',         // 左上角·近左边
};

// 目录卡十域(与含义数据同键同序)。
const CATALOG_DOMAINS = ['总性', '爱情', '财富', '事业', '健康', '诉讼', '旅行', '失物', '是否', '时机'];

// 十六图形格位标签(row-major:四母→四女→四甥→左右见证+判官+调和者),与引擎 figures_16 同序。
const FIGURE_SLOTS = ['母一', '母二', '母三', '母四', '女一', '女二', '女三', '女四', '甥一', '甥二', '甥三', '甥四', '右见证', '左见证', '判官', '调和者'];
const FIGURE_GROUPS = [
	{ label: '四母', span: [0, 4] },
	{ label: '四女', span: [4, 8] },
	{ label: '四甥', span: [8, 12] },
	{ label: '见证·判官', span: [12, 16] },
];

// 点数取样范围中文名(技法卡与 AI 快照同用,免两处口径分岔)
const PARITY_SCOPE_ZH = { shield16: '全盘十六图', mothers: '四母', houses12: '十二宫' };

const HISTORY_KEY = 'horosaGeomancyHistory';
const HISTORY_MAX = 30;
// 时地改动的静默期:时间面板选年/选月/选日各吐一拍,合并成一次重算(逐拍打后端既慢又白费)。
const RECAST_DEBOUNCE_MS = 260;

// 问题类型(11 类;简体)。后端 reading 也回传 questionTypes 可同步覆盖。
const QUESTION_TYPE_OPTIONS = [
	{ key: 'life', label: '🌟 生命与命运', short: '命运' },
	{ key: 'health', label: '⚕️ 健康与疾病', short: '健康' },
	{ key: 'wealth', label: '💰 财富与资源', short: '财富' },
	{ key: 'marriage', label: '💑 婚姻与感情', short: '婚姻' },
	{ key: 'career', label: '🏆 事业与名誉', short: '事业' },
	{ key: 'children', label: '👶 子女与生育', short: '子女' },
	{ key: 'journey', label: '✈️ 旅行与迁移', short: '旅行' },
	{ key: 'religion', label: '🕌 宗教与灵性', short: '宗教' },
	{ key: 'enemy', label: '⚔️ 敌人与诉讼', short: '诉讼' },
	{ key: 'death', label: '⚰️ 死亡与遗产', short: '遗产' },
	{ key: 'custom', label: '💬 自订问题', short: '自订' },
];

// 所问宫十二项 —— **判读的真值源**。问类只是快捷预设,正法是「取与问题主题对应之宫的图」。
// 🔴 此前所问宫只能由问类查表得出,而表里 custom→1、life→1 与问者宫(恒一)撞车,
//    q==t 使完美恒「入主」、相位恒「合」;前端默认问类正是 custom,故开箱即坏。
const QUESITED_HOUSE_OPTIONS = [
	{ v: 1, label: '一命 · 本人身体' },
	{ v: 2, label: '二财 · 钱财动产' },
	{ v: 3, label: '三兄弟 · 近邻消息' },
	{ v: 4, label: '四田宅 · 家宅根基' },
	{ v: 5, label: '五子女 · 恋爱子嗣' },
	{ v: 6, label: '六疾厄 · 疾病仆役' },
	{ v: 7, label: '七夫妻 · 婚姻合伙对手' },
	{ v: 8, label: '八疾死 · 遗产他人之财' },
	{ v: 9, label: '九迁移 · 远行学问' },
	{ v: 10, label: '十官禄 · 事业名誉' },
	{ v: 11, label: '十一福德 · 友朋愿望' },
	{ v: 12, label: '十二玄秘 · 暗敌隐患' },
];
// 问类 → 预设所问宫(与引擎 question_house 表同源;改此处须同改引擎数据)
const QUESTION_TYPE_HOUSE = {
	life: 1, health: 6, wealth: 2, marriage: 7, career: 10, children: 5,
	journey: 9, religion: 9, enemy: 7, death: 8, custom: 1,
};

// 起卦法。传本所载报数、点点、抛硬币、掷骰子诸法俱以奇偶定爻;皮肤四法用同一确定性随机源、
// 只在称名与记号上有别,报数法则真收十六个数(奇=单点/偶=双点)。
const SEED_MODE_OPTIONS = [
	{ key: 'random', label: '随机起卦', short: '随机' },
	{ key: 'time_seed', label: '时间起卦', short: '时间' },
	{ key: 'manual', label: '手工指定种子', short: '手工' },
	{ key: 'numbers', label: '报数起卦(自报十六数)', short: '报数' },
	{ key: 'dice', label: '掷骰子', short: '掷骰' },
	{ key: 'coins', label: '抛硬币', short: '硬币' },
	{ key: 'sand', label: '沙痕点点', short: '沙痕' },
	{ key: 'tablets', label: '掷片', short: '掷片' },
];
// 皮肤四法:走同一随机源,以 castMethod 如实回传所用之法(记号样式仍由高级传本决定)
const CAST_SKIN_MODES = ['dice', 'coins', 'sand', 'tablets'];

// 时间起卦确定性种子:取起卦时间(精确到分)的年月日时分拼成一个稳定 int(0..2147483647)。
// 同一分钟内重复起卦 → 同种子 → 同盘(可复现);不同时刻 → 不同种子。
// 喂给后端 timeSeed,后端按其取值优先级落定 effective_seed 并回传,避免退化真随机。
// [自由起盘] 传入左栏所选时间的 fields(date/time)则按其算种子;缺省回退当前系统时间。
function computeTimeSeed(fields){
	let y; let mo; let da; let h; let mi;
	const dv = fields && fields.date && fields.date.value;
	const tv = fields && fields.time && fields.time.value;
	if(dv && dv.format && tv && tv.format){
		y = parseInt(dv.format('YYYY'), 10);
		mo = parseInt(dv.format('MM'), 10);
		da = parseInt(dv.format('DD'), 10);
		h = parseInt(tv.format('HH'), 10);
		mi = parseInt(tv.format('mm'), 10);
	}else{
		const d = new Date();
		y = d.getFullYear(); mo = d.getMonth() + 1; da = d.getDate(); h = d.getHours(); mi = d.getMinutes();
	}
	// (YYMMDDHHmm) 折叠进 32 位有符号正整数域;乘子混合各分量避免低位塌缩。
	const v = ((y % 100) * 100000000) + (mo * 1000000) + (da * 10000) + (h * 100) + mi;
	return v % 2147483647;
}

// 流派预设(中性命名;后端 reading 也回传 traditions 可同步覆盖)。默认古典定局派=现状零回归。
const TRADITION_OPTIONS = [
	{ key: 'european_classical', label: '古典定局派', short: '古典' },
	{ key: 'european_planetary', label: '行星共鸣派', short: '共鸣' },
	// [X1·P1-21] 现代综合派引擎口径与古典定局同(traditions 仅 id/label 异);label 如实标注,不臆造分歧。
	{ key: 'european_modern', label: '现代综合派(判读同古典口径)', short: '现代' },
	{ key: 'arabic_raml', label: '阿拉伯沙占派', short: '沙占' },
	{ key: 'india_ramal', label: '印度骰占派', short: '骰占' },
	{ key: 'sikidy', label: '异或表盘(Sikidy)', short: '异或' },
	{ key: 'hakata', label: '四片盘(Hakata)', short: '四片盘' },
];
// 后端 PROFILES 另有两档(起盘后由 result.traditions 覆盖上表)。
// 🔴 此表**只备短名、不进可选集** —— 起盘前少几项是既有约定(帮助文档已明文),不可由此悄悄改变。
const TRADITION_SHORT_EXTRA = { greek: '希腊', ifa: '结构' };
const READING_SCOPE_OPTIONS = [
	{ key: 'L0', label: 'L0 仅判官', short: 'L0' },
	{ key: 'L1', label: 'L1 三图(证·判)', short: 'L1' },
	{ key: 'L2', label: 'L2 盾牌全局', short: 'L2' },
	{ key: 'L3', label: 'L3 十二宫(默认)', short: 'L3' },
	{ key: 'L4', label: 'L4 占星定局', short: 'L4' },
];
const ZODIAC_SYSTEM_OPTIONS = [
	{ key: 'classical', label: '古典定局体系', short: '古典' },
	{ key: 'planetary', label: '行星归属体系', short: '行星' },
	// 第三套:另一传本之行星归属对应表,与上者恰五图相异(损失/获得/快乐/女子/龙首)
	{ key: 'planetary_alt', label: '行星归属·乙(另一传本表)', short: '行星乙' },
];
// [行星地占盘] 上升所用之星座对应表二式
const PCHART_ZODIAC_OPTIONS = [
	{ key: 'classical', label: '古典行星地占表(默认)', short: '古典' },
	{ key: 'planetary_alt', label: '另一传本对应表', short: '传本乙' },
];

// ── 传本判语文案(内核只出代码、文案在此,免两处口径分岔;AI 快照同源复用)──
// 法庭三角:左证·法官·右证 三图吉凶之断。
// 🔴 传本首行「吉吉吉」结构上不可达(法官=二证异或,吉图同奇偶两两相配之和恒非吉图,全 16⁴ 穷举实证),
//    故留表以存原貌,界面不宣称其可得。
const COURT_VERDICT_ZH = {
	all_good: '吉,自天佑之,吉无不利',
	end_good_delay: '终吉,但会延迟或出问题',
	end_good_hard: '终吉,但漫长曲折或事倍功半',
	gain_not_self: '求而可得,非利于己,行道偏欹',
	no_success_has_end: '无成有终',
	well_unused: '井渫不食,为我心恻,可用汲,受福',
	all_bad: '凶',
	unlisted: '传本表未载此组合,当具体分析',
};
const COURT_JUDGE_SPECIAL_ZH = {
	via: '法官为道路:事情变化剧烈、彻底转变',
	populus: '法官为群众:还是原样、影响因素过多',
};
const TONE_CLASS_ZH = { good: '吉', bad: '凶', mid: '中' };
// 成败八格(有无精准相位 × 两指示图吉凶)
const SUCCESS_ZH = {
	occur_both_good: '事件发生,双方都好', occur_querent_better: '事件发生,事主更好',
	occur_quesited_better: '事件发生,对象更好', occur_both_bad: '事件发生,双方都不好',
	fail_both_good: '事件不发生,双方都好', fail_querent_better: '事件不发生,事主更好',
	fail_quesited_better: '事件不发生,对象更好', fail_both_bad: '事件不发生,双方都不好',
	not_covered: '传本表只列吉凶两态,此局有「中」图,当具体分析',
};
// 有效性五则
const VALIDITY_RULES_ZH = {
	not_asked_or_decided: '首图龙尾:此事不问,或事主已自决',
	deceit: '首图红色:自欺、隐瞒、有意欺骗',
	deceive_quesited: '首图红色且两指示卦有精准相位:事主有意欺骗对象',
	insufficient_info: '首图失去:信息不足',
	question_not_real: '首图群众:所问非事主真实之问,宜重新提问',
	false_question: '一宫群众并十一宫红色:问题虚假,宜重新提问',
};
const VALIDITY_LABELS = ['一 龙尾', '二 红色', '三 失去', '四 群众', '五 盘式'];
// 得地四档
const TENANCY_GRADE_ZH = {
	full: { t: '最强', d: '卦与位元素全同,此位最强,能全展此卦之力' },
	assist: { t: '辅助', d: '温度同而湿度异,作补充辅助而现,目标随时而移' },
	stall: { t: '停滞', d: '湿度同而温度异,平衡而稳致行动停滞,他日有增长之潜力,须释放或引外力' },
	weak: { t: '无力', d: '全不相同,于此位无力,不能(或不欲)完成其任' },
};
const TENANCY_GRADE_MARK = { full: '◎', assist: '○', stall: '◇', weak: '✕' };
const ELEMENT_ZH_BY_EN = { Fire: '火', Air: '风', Water: '水', Earth: '土' };
// 寻源四线之义
const VIA_LINE_ZH = {
	fire: { n: '火', d: '目的、目标、渴望、指引、意志' },
	air: { n: '风', d: '交流、创造、思想、主意、逻辑、理论' },
	water: { n: '水', d: '感情、情绪、灵性层面' },
	earth: { n: '土', d: '结果、物质层面、隐藏、财富' },
};
const VIA_SIDE_ZH = { self: '我方(个人宫位)', other: '对方(人际宫位)' };
const SUPPLY_ZH = { self_supplied: '元素自给', borrowed: '元素借贷' };
const ELEMENT_LEVEL_ZH = { abundant: '相对充沛(阳爻三以上)', scarce: '相对匮乏(阳爻二以下)' };
// 精准相位方向细则
const PERF_DIRECTION_ZH = { forward: '前宫', backward: '后宫' };
const PERF_KNOWLEDGE_ZH = {
	third_party_hidden: '事主后宫与对象后宫传递:第三方背后做事',
	quesited_knows: '事主后宫与对象前宫传递:对象知晓第三方',
	querent_knows: '事主前宫与对象后宫传递:事主知晓第三方',
	both_know: '事主前宫与对象前宫传递:双方知晓第三方',
};
const PERF_CONJ_ZH = {
	backward: '联合于对方后宫:其功成于对方背后,用对方不解之知',
	forward: '联合于对方台面(前宫):用通识之知,或双方已有协议认可',
};
// 宣判(补卦)奇偶
const RECON_PARITY_ZH = {
	objective_real: '偶数卦:客观事实、外在 → 事偏于实',
	subjective_virtual: '奇数卦:主观意志、内在 → 事偏于虚',
};
// 稳定性三联 与 奇偶主客观(传本对应系统)
const STABILITY_ZH = { stable: '稳·慢·长', mobile: '变·快·短' };
const PARITY_VIEW_ZH = { odd: '奇数卦:主观意志、内在', even: '偶数卦:客观事实、外在' };
// 相位吉凶(传本:吉相位六合、拱;凶相位刑、冲)
const ASPECT_TONE_ZH = {
	sextile: '吉', trine: '吉', square: '凶', opposition: '凶', conjunction: '中', none: '—',
};
// 地占三角四组含义两派
const TRIANGLE_SCHOOLS = [
	{ key: 'recent', label: '近代传本' },
	{ key: 'renaissance', label: '弗卢德古本' },
];
const TRIANGLE_MEANINGS = {
	recent: ['事主当下的自我状况和条件状况', '事件目前情况,或对象状态',
		'事主所处环境状况,或问题中环境地点', '事主生命中他人的互动、相互作用,或问题中其他人的状态'],
	renaissance: ['事主当下的自我状况和条件状况', '事主未来的自我状况和条件状况',
		'事主当下环境状况,或对象当下状态', '环境或对象未来的发展状况'],
};
// 盾十六位之占断含义(传本另立一套,书明言「不要与法庭三角、地占三角合用,角度不同」)
const SHIELD16_MEANINGS = [
	'身体、事项、目的、目标、意识、灵魂、生命、初始生命',
	'处理金钱和所有形式的财务事项(购买、销售、接受、馈赠、结算、个人财务状况、赏金、抢劫、民生、收购、获奖、寻找宝藏失物等),表孩子的房子',
	'兄弟姐妹、短期旅行、交通、法律、亲密的举动、短距离运动、新闻记者',
	'事主的主题或焦点、父亲、母亲、产权、房地产、住宅、次要结果、丢失物品的交易、谋杀、小病、后代、母亲的合作者、存储的地方、地穴、珍品、耕作、农业、暗处',
	'儿童、礼物、衣服、好消息、活动庆典、需求、下雨、灵性、送信员、军队骑兵、死后灵魂状态',
	'疾病、焦虑、忧愁、悲伤、离婚、孤独、盗贼、监禁、指责、谎言、家畜、奴隶、奴隶主、表亲的半亲兄弟',
	'妇女、两性关系、伙伴关系、招待场所、人道主义目标和意向、当前的统治者、战士、原告、缺席者、祖母、中年人的评价、争论、某个国家',
	'死亡、恐惧、虚无、继承、债务、司法监狱、兄弟的婚姻、死亡前几年的生活、危险的处境、血、杀戮、受难、非法食品、赏金',
	'旅游、运动、科学、哲学、崇拜、朝圣、参观、梦想愿望、妻子的兄弟们、父亲的姐妹、堂兄弟',
	'事业、专业、荣耀、政府、权利、公务员、处理问题的能力、调解事务、羞辱、推广、纪念、来世的事项、不同伴侣的孩子、生存、高军衔、国家',
	'社团、团体、希望期望、目的地的描述、应酬、友谊、朋友、政府部长及其下属、统治阶级的财富、远距离运动',
	'敌人、对手、叛军、嫉妒或羡的人、弄虚作假、焦虑、困难、监狱、医院、不好的东西、佣人、墓地、长途或极远的旅行、坐骑、埋藏的宝藏',
	'调查者、隐秘的学识、忽略的线索、细节(加强一宫,与一宫含义相同)',
	'预防、障碍、期望、期望的事项(加强十宫)',
	'官、统治者、平衡、测量称量(加强七宫)',
	'空虚、失败、家庭、被国家流放、最终结果(加强四宫)',
];
// 时间流:右证过去、法官现在、左证未来(传本口径)
const TIME_FLOW_ZH = { right_witness: '过去', judge: '现在', left_witness: '未来' };
// 真实星历盘所用之象限宫制(引擎回传键 → 中文名)。只此一家:列宫制全纬度有解,故无极区备用之法。
const QUADRANT_SYSTEM_ZH = { regiomontanus: '列宫制' };
// 度分记法:12.5 → 12°30′。真实盘之上升与宫头唯此式带度数,故专置一处免各处各写一遍。
function fmtDegMin(v){
	if(typeof v !== 'number' || !Number.isFinite(v)){ return '—'; }
	const d = Math.floor(v);
	let m = Math.round((v - d) * 60);
	// 59.6′ 四舍五入成 60′ 必须进位,否则出「12°60′」这种不存在的写法
	return m >= 60 ? `${d + 1}°00′` : `${d}°${String(m).padStart(2, '0')}′`;
}

async function postGeomancy(path, payload){
	let rsp = null;
	try{
		const rawResponse = await cachedKentangFetch(buildKentangEndpoint('geomancy', path), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json; charset=UTF-8' },
			body: JSON.stringify(payload),
		}, { retries: 0 });
		const rawText = await rawResponse.text();
		rsp = rawText ? JSON.parse(rawText) : null;
		if(!rsp || (rsp.ResultCode !== undefined && rsp.ResultCode !== 0)){
			throw new Error(rsp && rsp[ResultKey] ? `${rsp[ResultKey]}` : 'geomancy.local.fetch.failed');
		}
	}catch(e){
		const rawResponse = await cachedKentangFetch(`${ServerRoot}/geomancy/${path}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json; charset=UTF-8' },
			body: JSON.stringify(payload),
		}, { retries: 0 });
		const rawText = await rawResponse.text();
		rsp = rawText ? JSON.parse(rawText) : null;
	}
	if(!rsp || (rsp.ResultCode !== undefined && rsp.ResultCode !== 0)){
		throw new Error(rsp && rsp[ResultKey] ? `${rsp[ResultKey]}` : 'geomancy.fetch.failed');
	}
	return rsp && rsp[ResultKey] ? rsp[ResultKey] : rsp;
}

function figureLine(fig, role){
	if(!fig){ return ''; }
	const parts = [fig.nameZh || fig.nameEn].filter(Boolean);
	if(fig.planetZh){ parts.push(`行星${fig.planetZh}`); }
	if(fig.elementZh){ parts.push(fig.elementZh); }
	if(fig.keywordsZh){ parts.push(fig.keywordsZh); }
	return `${role}：${parts.join(' · ')}`;
}

// 地占快照文本:问题/类型/上升 + 传本 + 判定(判官/调和者/见证) + 解读技法 + 十二宫图形入宫断语 + 十六图形。
export function buildGeomancySnapshotText(result){
	if(!result){ return '暂无地占数据'; }
	const reading = result.reading || {};
	const lines = [];
	if(result.aiPrompt){
		lines.push(result.aiPrompt.trim());
		lines.push('');
	}else{
		lines.push(`问题：${reading.question || '—'}`);
		lines.push(`问类：${reading.questionTypeZh || reading.questionType || '—'}`);
		lines.push(`上升图形：${(reading.ascendantFigure || {}).nameZh || ''}（上升星座 ${reading.ascendantSignZh || ''}）`);
		lines.push('');
	}
	// 传本(非默认才注记,供 AI 知本盘传本口径)
	const TRAD = { european_classical: '古典定局派', european_planetary: '行星共鸣派', european_modern: '现代综合派(同古典口径)', arabic_raml: '阿拉伯沙占派', india_ramal: '印度骰占派', sikidy: '异或表盘', hakata: '四片盘', ifa: '西非同族结构对照' };
	const tb = [];
	if(reading.profileId && reading.profileId !== 'european_classical'){ tb.push(`流派=${TRAD[reading.profileId] || reading.profileId}`); }
	if(reading.zodiacSystem === 'planetary'){ tb.push('黄道=行星归属体系'); }
	if(reading.zodiacSystem === 'planetary_alt'){ tb.push('黄道=行星归属·乙(另一传本对应表)'); }
	if(reading.readingScope && reading.readingScope !== 'L3'){ tb.push(`范围=${reading.readingScope}`); }
	// 传本逐项设置:仅注记与主流缺省不同者,免刷屏又不漏口径(AI 据此才知本盘按何法判读)。
	const gs = reading.settings || {};
	const GNAME = {
		house_projection: { sequential: '落星=不落(仅图形入宫)', astro_from_chart: '落星=占星甲(星落所主图之宫)', astro_bytwelves: '落星=占星乙(另起点数定宫)' },
		compound_mode: { reverse: '合成同伴=逆转法' },
		number_system: { planetary: '图数=行星序', abjad: '图数=字母值' },
		reconciler_mode: { judge_querent_significator: '调和者=判官⊕问者指示星' },
		mark_style: { lines: '记号=线形', bindu: '记号=点线', tablets: '记号=开合片' },
		direction: { RTL: '书写=自右向左' },
		// 传本对齐新增:图形入宫三式 / 上升三源 / 起卦诸法
		house_placement: { angular: '入宫=四正入宫(四果宫取合成卦)', golden_dawn: '入宫=近世学派置换' },
		asc_source: { fresh_points: '上升=另起四行点', judge_figure: '上升=取法官之图' },
		cast_method: { numbers: '起卦=报数(十六数奇偶定爻)', dice: '起卦=掷骰子', coins: '起卦=抛硬币',
			sand: '起卦=沙痕点点', tablets: '起卦=掷片' },
	};
	Object.keys(GNAME).forEach((k)=>{ const hit = GNAME[k][gs[k]]; if(hit){ tb.push(hit); } });
	if(gs.wrap_houses === true){ tb.push('宫位成环'); }
	if(gs.reconciler === false){ tb.push('不取调和者'); }
	if(gs.halt_enabled === false){ tb.push('不启用首母中止'); }
	if(gs.planetary_chart === true){ tb.push('另起行星地占盘'); }
	if(tb.length){ lines.push(`传本设置：${tb.join('、')}`); }
	// 结构对照模式:先申明边界,再不出任何地占判读(下游 AI 不得越界解读)。
	if(reading.structuralOnly){
		lines.push('');
		lines.push('[边界声明]');
		lines.push(reading.culturalNotice || '独立圣传体系,仅结构同构对照,不套地占含义、不构成占断。');
		const ifa = reading.ifa || {};
		if(ifa.label){
			lines.push(`结构对照：${ifa.label}${ifa.is_meji ? '(主形)' : ''};右列 ${(ifa.right || {}).odu_name || '—'}→${(ifa.right || {}).figure || '—'}、左列 ${(ifa.left || {}).odu_name || '—'}→${(ifa.left || {}).figure || '—'}(自右向左读)`);
		}
		lines.push('※ 本模式只作形的识别与比特对照,不产出该体系之占断,亦不套用地占含义。');
		return lines.join('\n');
	}
	lines.push('[判定]');
	// [X1·P1-22] 首母中止警示(约 1/8 盘触发,后端早已算出而前端/AI 双盲):传统口径此占应中止另占。
	if(reading.haltedOnFirstMother){ lines.push('⚠ 首母中止：首母落 Rubeus/Cauda 之属,依所选传本传统应中止本占、另择时再占(以下判读仅作参考)。'); }
	// 时间流(传本口径):右证=过去、法官=现在、左证=未来。
	// ⚠️ 此前左证误标「现在」而法官无时间标 —— 与传本相左,已按传本改正。
	const j = figureLine(reading.judge, '判官(现在)');
	if(j){ lines.push(j); }
	const r = figureLine(reading.reconciler, '调和者(宣判/补卦)');
	if(r){ lines.push(r); }
	if(reading.rightWitness){ lines.push(figureLine(reading.rightWitness, '右证(过去/问者/事主)')); }
	if(reading.leftWitness){ lines.push(figureLine(reading.leftWitness, '左证(未来/所问/条件环境)')); }
	if(reading.primaryHouse){ lines.push(`主宫：第 ${reading.primaryHouse} 宫`); }
	// [X1·P1-23] sikidy/hakata 流派中栏特有结论入快照(此前 AI 全盲):三道校验/红 Sikidy/诸侯列;四片开合/断语。
	if(reading.sikidy){
		const sk = reading.sikidy;
		lines.push(`异或表盘：三道校验${sk.valid ? '通过' : '未过'}${sk.red_sikidy ? '；红 Sikidy(大凶)' : ''}${Array.isArray(sk.princes) && sk.princes.length ? `；诸侯列:${sk.princes.join('、')}` : ''}`);
		// 列比对:本体系判事之正法(问者列与某主题列同形即事之所系),此前 AI 全盲。
		if(sk.compare && sk.columns){
			const hits = Object.keys(sk.compare).filter((k)=>sk.compare[k] && sk.compare[k].equal)
				.map((k)=>`第${k}列 ${(sk.columns[k] || {}).name || ''}(${(sk.columns[k] || {}).meaning || ''})`);
			lines.push(`列比对：问者列与${hits.length ? hits.join('、') + ' 同形 —— 事之所系在此' : '各主题列皆不同形,无直指之应'}`);
		}
	}
	if(reading.hakata){
		const hk = reading.hakata;
		const tb = (hk.tablets || []).map((t)=>`${t.name || ''}${t.open ? '开' : '合'}`).join(' ');
		lines.push(`四片盘：${tb || '—'} → ${hk.figure_zh || hk.figure || '—'}${hk.reading ? `；${hk.reading}` : ''}${hk.orientation ? `；${hk.orientation}` : ''}`);
	}
	// 解读技法(可计算)
	const t = reading.technique;
	if(t){
		lines.push('');
		lines.push('[解读技法]');
		const PERF = { occupation: '入主成局', conjunction: '会合成局', mutation: '互变成局', translation: '传递成局', none: '未成局' };
		const ASP = { conjunction: '合', sextile: '六分(吉)', square: '刑(凶)', trine: '拱(吉)', opposition: '冲', none: '无相位' };
		lines.push(`完美：${t.perfection && t.perfection !== 'none' ? PERF[t.perfection] : (t.perfection_by_aspect ? `借相位(${ASP[t.perfection_by_aspect]})成局` : '未成局')}`);
		lines.push(`相位：${ASP[t.aspect] || t.aspect}`);
		if(t.prohibition){ lines.push(`阻碍：第 ${t.prohibition} 宫强凶图阻断`); }
		if(t.points_parity){
			const pp = t.points_parity;
			lines.push(`点数是否：总 ${pp.total} 点·${pp.parity === 'even' ? '偶→是/稳' : '奇→否/动'}（取样 ${PARITY_SCOPE_ZH[pp.scope] || '全盘十六图'}${pp.degenerate ? '，该取样结构恒偶、不具判别力' : ''}）`);
		}
		if(t.timing){ lines.push(`应期：${t.timing.speed === 'fast' ? '速' : '迟'}·以「${t.timing.unit}」计`); }
		if(t.via_puncti){ lines.push(`点之路：${t.via_puncti.through ? '贯通' : '断于' + t.via_puncti.broken_at}`); }
		if(t.natural_cosignificator){ lines.push('自然共主：月亮'); }
		if((t.triplicities || []).length > 1){
			const TRI = { 1: '火', 5: '火', 9: '火', 2: '地', 6: '地', 10: '地',
				3: '风', 7: '风', 11: '风', 4: '水', 8: '水', 12: '水' };
			lines.push(`黄道宫三方：宫 ${t.triplicities.join('/')}（${TRI[t.triplicities[0]] || ''}三方）`);
		}
		// 数量:答「几件/几人/多少」一类问法(总点数三分)。
		if(t.timing && t.timing.quantity){
			const q = t.timing.quantity;
			lines.push(`数量：${q.label}(总 ${q.total} 点·域 ${q.min}–${q.max})`);
		}
		// 精准相位方向细则:联合之前后宫、传递之知晓格局、突变之场所线索
		const pdir = t.perfection_direction;
		if(pdir){
			(pdir.conjunctions_all || []).forEach((c)=>{
				lines.push(`联合方向：${c.mover === 'querent' ? '事主之图' : '对象之图'}现于第 ${c.house} 宫(${PERF_DIRECTION_ZH[c.direction] || ''}) —— ${PERF_CONJ_ZH[c.direction] || ''}`);
			});
			if(pdir.knowledge_code){ lines.push(`传递知晓：${PERF_KNOWLEDGE_ZH[pdir.knowledge_code]}`); }
			if(pdir.hint_code === 'venue_clue'){ lines.push('突变线索：两图所落之宫即完成之法与地之线索(偶然意外促成,非双方所想之完成方式)'); }
		}
	}
	// ── 传本对齐新增六段 ──
	if(t && t.court_verdict){
		const cv = t.court_verdict;
		lines.push('');
		lines.push('[法庭三角]');
		lines.push(`右证(过去/事主)：${cv.right.figure}(${TONE_CLASS_ZH[cv.right.tone_class]})`);
		lines.push(`法官(现在/总方向)：${cv.judge.figure}(${TONE_CLASS_ZH[cv.judge.tone_class]})`);
		lines.push(`左证(未来/条件环境)：${cv.left.figure}(${TONE_CLASS_ZH[cv.left.tone_class]})`);
		if(cv.judge_special){ lines.push(`法官特例：${COURT_JUDGE_SPECIAL_ZH[cv.judge_special]}`); }
		lines.push(`合断：${COURT_VERDICT_ZH[cv.verdict_code] || cv.verdict_code}${cv.listed ? '' : '(传本表未载此组合,当具体分析,不得臆造断语)'}`);
		lines.push('※ 论一段时间之吉凶则三等分:右证第一段、法官第二段、左证第三段。此三角与盾位十六宫含义角度不同,勿合用。');
		if((t.shield_triangles || []).length){
			lines.push('地占三角(四组·底二为补充、顶卦为概括之果):');
			t.shield_triangles.forEach((g)=>{
				lines.push(`  第${g.index}三角 ${g.base.map((b)=>b.figure).join(' ⊕ ')} → ${g.apex.figure}(${TONE_CLASS_ZH[g.apex.tone_class]})`
					+ `：近代传本作「${TRIANGLE_MEANINGS.recent[g.index - 1]}」;弗卢德古本作「${TRIANGLE_MEANINGS.renaissance[g.index - 1]}」`);
			});
		}
	}
	if(t && t.validity){
		lines.push('');
		lines.push('[有效性判断]');
		(t.validity.rules || []).forEach((x)=>{
			lines.push(`${VALIDITY_LABELS[x.id - 1]}：${x.hit ? (VALIDITY_RULES_ZH[x.code] || x.code) : '不成立'}${x.book_note ? `(${x.book_note})` : ''}`);
		});
		if(!t.validity.any_hit){ lines.push('※ 五则皆过,卦盘可判。'); }
	}
	if(t && (t.tenancy || []).length){
		lines.push('');
		lines.push('[盾面得地]');
		lines.push('| 位 | 图形 | 位元素 | 卦元素 | 档位 |');
		lines.push('| --- | --- | --- | --- | --- |');
		t.tenancy.forEach((x)=>{
			lines.push(`| ${x.position} ${x.label} | ${x.figure || '—'} | ${ELEMENT_ZH_BY_EN[x.position_element] || '—'} | ${ELEMENT_ZH_BY_EN[x.figure_element] || '—'} | ${x.grade ? (TENANCY_GRADE_ZH[x.grade] || {}).t : '—'} |`);
		});
		lines.push('※ 全同者最强(能全展此卦之力)、同温者辅助(目标随时而移)、同湿者停滞(有增长潜力须引外力)、全异者无力。');
	}
	if(t && (t.via_elements || t.element_supply)){
		lines.push('');
		lines.push('[元素与寻源]');
		const ve = t.via_elements || {};
		const es = (t.element_supply || {}).elements || {};
		['fire', 'air', 'water', 'earth'].forEach((k)=>{
			const L = VIA_LINE_ZH[k] || {};
			const b = ve[k] || {};
			const e = es[k] || {};
			const src = b.traceable
				? (b.through
					? `贯通至盾位${(b.terminus || {}).position}(${VIA_SIDE_ZH[(b.terminus || {}).side] || ''})`
					: `断于${b.broken_at}`)
				: '法官此行阴爻,不可由此寻源';
			lines.push(`${L.n}(${L.d})：${src}${e.active_count !== undefined ? `;女卦 ${e.figure} 阳爻 ${e.active_count} → ${ELEMENT_LEVEL_ZH[e.level] || ''}` : ''}${e.supply ? `;${SUPPLY_ZH[e.supply]}` : ''}`);
		});
		lines.push('※ 元素之有无、充沛与否皆非吉凶之判,须结合盾图综合考虑。');
	}
	if(t && (t.success || t.greek_points || t.reconciler_parity)){
		lines.push('');
		lines.push('[成败与福灵点]');
		if(t.success){
			const sc = t.success;
			lines.push(`成败：${sc.has_perfection ? '有精准相位 → 事将发生' : '无精准相位 → 事不发生'};事主${TONE_CLASS_ZH[sc.querent_tone]}·对象${TONE_CLASS_ZH[sc.quesited_tone]} → ${SUCCESS_ZH[sc.code] || sc.code}`);
			lines.push(`※ ${sc.caveat}`);
		}
		if(t.greek_points){
			const gp = t.greek_points;
			lines.push(`福点：第 ${gp.fortune_house} 宫(十二卦点数和 ${gp.fortune_total} 除十二取余) —— 好运所在、身体健康、财富、事业成败、心理素质`);
			lines.push(`灵点：第 ${gp.spirit_house} 宫(十二卦阳爻数和 ${gp.spirit_total} 除十二取余) —— 意志、梦想、希望、追求、欲望、幻想`);
		}
		if(t.reconciler_parity){
			const rp = t.reconciler_parity;
			lines.push(`宣判(补卦)：${rp.figure}·${rp.points} 点·${RECON_PARITY_ZH[rp.code] || rp.code}(据传本对应系统之奇偶主客观义推得)`);
		}
	}
	if(reading.planetaryChart){
		const pc = reading.planetaryChart;
		lines.push('');
		lines.push('[行星地占盘]');
		lines.push(`上升：${pc.asc_sign_zh}(首图 ${pc.first_figure} 定上升,顺序排列黄道十二宫;星座表=${pc.zodiac_table === 'planetary_alt' ? '另一传本对应表' : '古典行星地占表'})`);
		lines.push('| 星 | 落宫 | 报数 |');
		lines.push('| --- | --- | --- |');
		[].concat(pc.planets || [],
			pc.nodes ? [pc.nodes.north, pc.nodes.south] : [],
			pc.extras || []).forEach((p)=>{
			lines.push(`| ${p.planet_zh || p.planet} | 第 ${p.house} 宫 | ${p.draws ? `${p.draws.join('+')}=${p.total}` : '取北交对宫'} |`);
		});
		lines.push('※ 此盘与盾面「占星定局落星」正交:本盘自成一盘,宫中并无盾面图形。');
	}
	// 转宫派生:以某宫为新命宫重算(问他人之事/事中之事时,此为正解所依)。
	if(reading.derived){
		const d = reading.derived;
		const PERF2 = { occupation: '入主成局', conjunction: '会合成局', mutation: '互变成局', translation: '传递成局', none: '未成局' };
		lines.push('');
		lines.push('[转宫派生]');
		lines.push(`以第 ${d.turn_to} 宫为新命宫：新命宫 ${d.derived_querent_house} → 所问宫 ${d.derived_quesited_house}`);
		lines.push(`派生完美：${PERF2[d.perfection] || d.perfection}${d.prohibition ? `；派生阻碍在第 ${d.prohibition} 宫` : ''}`);
		if(d.figure){ lines.push(`派生宫图：${d.figure.nameZh || d.figure.nameEn || '—'}`); }
	}
	// 占星定局落星:甲=星落其所主图之宫(可缺可多现,本法固有);乙=另起点数定宫(每星必有且仅一宫)。
	const PZH = { Sun: '日', Moon: '月', Mercury: '水', Venus: '金', Mars: '火', Jupiter: '木', Saturn: '土', NorthNode: '龙头', SouthNode: '龙尾' };
	const ppA = reading.planetPlacement || {};
    const ppAKeys = Object.keys(ppA).filter((k)=>(ppA[k] || []).length);
	if(ppAKeys.length){
		lines.push('');
		lines.push('[定局落星·甲]');
		lines.push(ppAKeys.map((k)=>`${PZH[k] || k}→${(ppA[k] || []).map((h)=>`${h}宫`).join('/')}`).join('；'));
		const absent = Object.keys(ppA).filter((k)=>!(ppA[k] || []).length).map((k)=>PZH[k] || k);
		if(absent.length){ lines.push(`（缺席：${absent.join('、')} —— 星所主之图未入盘,乃本法固有,非算漏）`); }
	}
	if(reading.planetPlacementByTwelves){
		const b = reading.planetPlacementByTwelves;
		lines.push('');
		lines.push('[定局落星·乙]');
		lines.push(Object.keys(b).map((k)=>`${PZH[k] || k}→${b[k]}宫`).join('；'));
	}
	// 丁:真实星历落星 —— 各体按其真实黄经落宫。此段只在用户选了该档且时地俱备时才有,
	// 故未启用者快照逐字不变。⚠️ 必须同时交代此式非传本之法,免得模型把它当传本口径引用。
	if(reading.planetPlacementReal){
		const c = reading.planetPlacementReal;
		const rc = reading.realChart || {};
		const er = reading.astroErection || {};
		lines.push('');
		lines.push('[定局落星·真实星历]');
		lines.push(`按所问之时地起真实星历盘：上升 ${er.sign_zh || '—'}${
			typeof er.asc_deg_in_sign === 'number' ? ` ${er.asc_deg_in_sign.toFixed(2)}°` : ''
		}${typeof rc.mc_lon === 'number' ? `；中天黄经 ${rc.mc_lon.toFixed(2)}°` : ''}${
			rc.quadrant_system ? `；象限分宫用${QUADRANT_SYSTEM_ZH[rc.quadrant_system] || rc.quadrant_system}` : '；整宫制'
		}`);
		lines.push(Object.keys(c).map((k)=>`${PZH[k] || k}→${c[k]}宫`).join('；'));
		lines.push('※ 此式非传本之法：传本盘式之上升取自图形、不起真实星盘,此为本软件另备之可选第四式,'
			+ '引用时须与传本口径分辨清楚。');
	}
	// 用户选了真实星历而时地不全者,如实写明已回落 —— 不写则模型会以为盘真按时地起。
	if((reading.settings || {}).real_chart_requested && (reading.settings || {}).real_chart_available === false){
		lines.push('');
		lines.push('※ 已选「据所选时地起真实上升」或「真实星历落星」,然时地不全(须日期与经纬俱备)或星历不可用,'
			+ '本盘已如实回落图形取法,勿按真实星盘解读。');
	}
	// 图数(非点数体系时注记,供择时/寻隐一类专门占法)
	if(reading.judge && reading.judge.number && reading.judge.number.system !== 'points'){
		const n = reading.judge.number;
		lines.push(`判官之数：${n.value}（${n.basis || n.system}）`);
	}
	// 十二宫:图形入宫 + 192 断语
	const houses = reading.houses || [];
	if(houses.length){
		lines.push('');
		// 印度派多一列宫位之该支名 —— AI 口径已承诺给出,不给就是让模型据不存在的字段臆造。
		const isIndia = reading.profileId === 'india_ramal';
		lines.push('[十二宫·图形入宫]');
		lines.push(isIndia ? '| 宫 | 宫名 | 支名 | 角色 | 图形 | 曜 | 断语 |' : '| 宫 | 宫名 | 角色 | 图形 | 断语 |');
		lines.push(isIndia ? '| --- | --- | --- | --- | --- | --- | --- |' : '| --- | --- | --- | --- | --- |');
		houses.forEach((h)=>{
			const fig = h.figure || {};
			const role = (h.roles || []).indexOf('quesited') >= 0 ? '【所问】' : ((h.roles || []).indexOf('querent') >= 0 ? '【问者】' : '');
			if(isIndia){
				const bh = h.bhava ? `${h.bhava}(${h.bhavaZh || ''})` : '—';
				const gr = ((fig.vedic || {}).graha_zh) || '—';
				lines.push(`| 第${h.house}宫 | ${h.nameZh || '—'} | ${bh} | ${role || '—'} | ${fig.nameZh || fig.nameEn || '—'} | ${gr} | ${h.reading || '—'} |`);
			}else{
				lines.push(`| 第${h.house}宫 | ${h.nameZh || '—'} | ${role || '—'} | ${fig.nameZh || fig.nameEn || '—'} | ${h.reading || '—'} |`);
			}
		});
	}
	const figs = reading.figures16 || [];
	if(figs.length){
		lines.push('');
		lines.push('[十六图形]');
		const slot = ['母一', '母二', '母三', '母四', '女一', '女二', '女三', '女四', '甥一', '甥二', '甥三', '甥四', '右证', '左证', '判官', '调和'];
		lines.push('| 位 | 图形 | 行星 | 元素 |');
		lines.push('| --- | --- | --- | --- |');
		figs.forEach((f, i)=>{
			lines.push(`| ${slot[i] || `图${i + 1}`} | ${f.nameZh || f.nameEn} | ${f.planetZh || '—'} | ${f.elementZh || '—'} |`);
		});
	}
	// [图形释义] doctrine 段(默认关段:builder 恒产,导出层按设置控)：与右栏「十六图形」renderFigureCatalog 同源
	// result.figures(16 图形完整象意库,含逐域断语 meanings);象意原文零改写;无目录数据不产段。
	const catalog = Array.isArray(result.figures) ? result.figures : [];
	if(catalog.length){
		lines.push('');
		lines.push('[图形释义]');
		const TONE_ZH = { good: '吉', bad: '凶', neutral: '中' };
		catalog.forEach((f)=>{
			const tone = TONE_ZH[f.tone] || '';
			const alt = f.displayName || f.nameEn;   // 名表体系选定之名(拉丁档即拉丁名 → 快照默认零变)
			lines.push(`◆ ${f.nameZh || f.latin || f.nameEn}${tone ? `（${tone}）` : ''}${alt ? ` ${alt}` : ''}${f.points ? ` · ${f.points}点` : ''}`);
			const attrLine = [f.planetZh, f.elementZh, f.signZh].filter(Boolean).join(' · ');
			if(attrLine){ lines.push(attrLine); }
			const bodyLine = [f.elementOuterZh ? `外元素${f.elementOuterZh}` : '', f.bodyPart ? `身体${f.bodyPart}` : '', f.color || ''].filter(Boolean).join(' · ');
			if(bodyLine){ lines.push(bodyLine); }
			if(f.keywordsZh){ lines.push(`象意：${f.keywordsZh}`); }
			if(f.meanings){
				const domainText = Object.keys(f.meanings)
					.filter((k)=>k !== 'name_zh' && k !== 'tone')
					.map((k)=>`${k}：${f.meanings[k]}`)
					.join('；');
				if(domainText){ lines.push(domainText); }
			}
			const altLine = [f.nameArabic ? `阿:${f.nameArabic}` : '', f.nameGreek ? `希:${f.nameGreek}` : '', f.nameHebrew ? `伯:${f.nameHebrew}` : ''].filter(Boolean).join('　');
			if(altLine){ lines.push(altLine); }
		});
	}
	return lines.join('\n').trim();
}

// AI 挂载:地占为 case 型(无生时),按已保存 case 的问题/种子复算,得不到则空。
export async function buildGeomancySnapshotForFields(fields, opts){
	try{
		const o = opts || {};
		let question = o.question;
		let questionType = o.questionType;
		let quesitedHouse = o.quesitedHouse;
		let seedMode = o.seedMode;
		let seed = o.seed;
		let tradition = o.tradition;
		let readingScope = o.readingScope;
		let zodiacSystem = o.zodiacSystem;
		let granular = o.granular;
		let turnTo = o.turnTo;
		// 传本对齐:图形入宫(齿轮可选)/报数所报之数/行星地占盘四键亦须随档复算,否则 AI 复算出的盘与界面两样
		let housePlacement = o.housePlacement;
		let castNumbers = o.castNumbers;
		let planetaryChart = o.planetaryChart;
		let planetaryChartZodiac = o.planetaryChartZodiac;
		let planetaryChartNodes = o.planetaryChartNodes;
		let planetaryChartExtras = o.planetaryChartExtras;
		if(question === undefined || question === null){
			const saved = getKentangSavedCasePayload('geomancy');
			const so = saved && saved.payload && saved.payload.options ? saved.payload.options : null;
			if(so){
				question = so.question; questionType = so.questionType;
				seedMode = so.seedMode; seed = so.seed;
				tradition = so.tradition; readingScope = so.readingScope; zodiacSystem = so.zodiacSystem;
				granular = so.granular; turnTo = so.turnTo;
				if(quesitedHouse === undefined || quesitedHouse === null){ quesitedHouse = so.quesitedHouse; }
				if(housePlacement === undefined){ housePlacement = so.housePlacement; }
				castNumbers = so.castNumbers;
				if(planetaryChart === undefined){ planetaryChart = so.planetaryChart; }
				if(planetaryChartZodiac === undefined){ planetaryChartZodiac = so.planetaryChartZodiac; }
				if(planetaryChartNodes === undefined){ planetaryChartNodes = so.planetaryChartNodes; }
				if(planetaryChartExtras === undefined){ planetaryChartExtras = so.planetaryChartExtras; }
			}
		}
		if(question === undefined || question === null){ return ''; }
		const payload = {
			question: question || '',
			questionType: questionType || 'custom',
			// 四本账:所问宫是判读主宫,不随存随取则 AI 复算出的是问类预设宫,与用户所见两样
			quesitedHouse: Number(quesitedHouse) || QUESTION_TYPE_HOUSE[questionType || 'custom'] || 1,
			seedMode: (seedMode === 'manual' && (seed || seed === 0)) ? 'manual' : (seedMode || 'random'),
			tradition: tradition || 'european_classical',
			readingScope: readingScope || 'L3',
			zodiacSystem: zodiacSystem || 'classical',
		};
		// 🔴 时地必须与主起盘路径同发:上升取法「据所选时地起真实上升」或落星法「真实星历」之下,
		//    盘由时地定 —— 复算侧不发时地,则内核以为无时地而如实回落图形取法,
		//    于是 AI 读到的定局与用户界面所见**两样**(界面按真实时地起,AI 却是一宫之图)。
		//    fields 来自存档记录(aiAnalysisContext 以 buildFieldObject(record) 造),故复算得的是存盘那一刻之时地。
		const gp = paramsFromFields(fields);
		if(gp){
			payload.date = gp.date; payload.time = gp.time; payload.zone = gp.zone;
			payload.lon = gp.lon; payload.lat = gp.lat;
			// ad 只在纪元前(-1)才发:如此则公元后之请求体与本次改动前逐字节相同
			if(Number(gp.ad) === -1){ payload.ad = -1; }
		}
		// 🔴 四本账:传本逐项改写与转宫也须随存随取,否则复算出来的是流派默认盘,
		//    与用户存盘时所见不符(AI 挂载据此复算,不带则 AI 看到的与界面两样)。
		Object.keys(granular || {}).forEach((k)=>{
			const v = granular[k];
			if(v !== null && v !== undefined){ payload[k] = v; }
		});
		if(Number.isFinite(Number(turnTo))){ payload.turnTo = Number(turnTo); }
		// 传本对齐:入宫式(齿轮档优先于 granular)/报数/行星地占盘四键
		if(housePlacement){ payload.housePlacement = housePlacement; }
		if(Array.isArray(castNumbers) && castNumbers.length === 16){
			payload.castMethod = 'numbers';
			payload.castNumbers = castNumbers;
			payload.seedMode = 'manual';
		}
		if(planetaryChart){
			payload.planetaryChart = true;
			payload.planetaryChartZodiac = planetaryChartZodiac || 'classical';
			if(planetaryChartNodes){ payload.planetaryChartNodes = true; }
			if(planetaryChartExtras){ payload.planetaryChartExtras = true; }
		}
		if(payload.seedMode === 'manual'){ payload.seed = seed || 0; }
		const result = await postGeomancy('reading', payload);
		return buildGeomancySnapshotText(result);
	}catch(e){ return ''; }
}

class GeomancyMain extends Component{
	// [R3-A6] 渲染守卫:宿主无关 dispatch 不再全树重渲(nextState 引用变照常放行;
	// 开关 horosa.perf.chartSCU,语义详 chartUpdateGuard.wrapperPropsEqual)。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){
			return true;
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}

	constructor(props){
		super(props);
		this.state = {
			loading: false,
			result: null,
			question: '',
			questionType: 'custom',
			// 所问宫默认随问类预设(custom→一宫)。
			// ⚠️ custom/life → 一宫与问者宫重合是**合法自指**(问的就是自身),不是数据错;
			//    错在此时完美/相位数学上恒成立却不加说明。今由技法卡如实标注并指引改选。
			quesitedHouse: 1,
			seedMode: 'random',
			manualSeed: 0,
			tradition: 'european_classical',   // 流派预设(默认古典定局派=现状零回归)
			readingScope: 'L3',
			zodiacSystem: 'classical',
			rightPanelTab: 'reading',
			centerView: 'square',
			history: [],
			// [高级传本] 只存**用户显式改过**的项:未改=不发 → 后端回落所选流派默认 = 字节零回归。
			// 显示值取「用户覆盖 ?? 后端回传的生效值」;换流派预设即清空覆盖(预设=批量写默认)。
			granular: {},
			// 转宫:以某宫为新命宫重算指示与完美(null=不转)
			turnTo: null,
			// 图形 Unicode 字形叠加:默认关 —— 自绘点阵为主(字体缺字时 Unicode 会显方框),
			// 开启则在图形卡旁并显该码位字形,供有对应字体者查对。
			showUnicodeGlyph: false,
			// [自由起盘] 本地时间地理草稿(null=跟主命盘;非空=用户左栏自选时间/经纬:时间起卦按此算种子,
			// 经纬/时间随事盘存储 + 透传后端占星盘)。
			localFields: null,
			// [报数起卦] 用户自报十六数(奇=单点/偶=双点),空白或逗号分隔;仅 seedMode==='numbers' 时用。
			castNumbersText: '',
			// [行星地占盘] 独立盘型:默认关(关则后端一颗随机数不取 ⇒ 全响应字节零变)。
			planetaryChart: false,
			planetaryChartZodiac: 'classical',
			planetaryChartNodes: false,
			planetaryChartExtras: false,
			// [地占三角] 含义两派 —— 纯显示态,不发后端、不改计算。
			triangleSchool: 'recent',
			// [寻源四线] 金字塔盘当前所寻之线(火/风/水/土)
			pyrLine: 'fire',
		};
		this.unmounted = false;
		this.requestSeq = 0;
		this._recastTimer = null;
		this._suppressRecast = false;
		// [实时重算] 时地签名基线须在构造期就取真值:否则首次 didUpdate 会把「本来就没变」误判成变了,
		// 而那一拍若正带着载入的存档盘,就会把存档盘重算覆盖掉。
		this._lastCastParamSig = this.castParamSig();
		this.onTimeChanged = this.onTimeChanged.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
		this.clickCast = this.clickCast.bind(this);
		this.clickReproduce = this.clickReproduce.bind(this);
		this.clickSaveCase = this.clickSaveCase.bind(this);
		this.restoreFromCurrentCase = this.restoreFromCurrentCase.bind(this);
		this.setRightPanelTab = this.setRightPanelTab.bind(this);
		this.setCenterView = this.setCenterView.bind(this);
		this.changeGeomancyOpt = this.changeGeomancyOpt.bind(this);
		this.commitQuestion = this.commitQuestion.bind(this);
		this.changeQuestionType = this.changeQuestionType.bind(this);
		this.changeQuesitedHouse = this.changeQuesitedHouse.bind(this);
		this.changePlanetaryOpt = this.changePlanetaryOpt.bind(this);
		this.traditionOptions = this.traditionOptions.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
		this.applyHistory = this.applyHistory.bind(this);

		if(this.props.hook){
			this.props.hook.fun = ()=>{
				if(this.unmounted){ return; }
				this.restoreFromCurrentCase();
			};
		}
	}

	componentDidMount(){
		this._unsubNongli = subscribeRemoteNongli(() => this.forceUpdate());
		this.loadHistory();
		window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		this.restoreFromCurrentCase();
	}

	// 🔴 载档触发通路:本组件此前**只有** componentDidMount 这一条。
	// 子技法面板常驻挂载(Tabs 无 destroyInactiveTabPane),用户若已停在地占页再从事盘列表
	// 载一条地占档,组件不重挂 → mount 不响 → 载档静默不生效。补上 fields 变化即还原
	// (照 lingqi:90 / guice:94 同款范式;restore 内部自带去重守卫,不会反复覆盖用户现场)。
	componentDidUpdate(prev){
		let restored = false;
		if(prev.fields !== this.props.fields && this.props.fields){ restored = this.restoreFromCurrentCase(); }
		// 🔴 [实时重算] 时地一改即按新时地重排判读,不必再点一次「起盘」(原先改了地点毫无反应,
		//    非得重起一盘才生效 —— 而重起就是重掷,那副卦就没了)。护盾盘由 recastPinned 钉住不动。
		//    签名无论是否重算都要同步:载档那一拍若留下陈旧签名,下一拍就会误触发一次重算把存档盘覆盖掉。
		const sig = this.castParamSig();
		const changed = (sig !== this._lastCastParamSig);
		this._lastCastParamSig = sig;
		if(changed && !restored && !this._suppressRecast){ this.scheduleRecastPinned(); }
	}

	componentWillUnmount(){
		if(this._recastTimer){ clearTimeout(this._recastTimer); this._recastTimer = null; }
		if(this._centerRO){ this._centerRO.disconnect(); this._centerRO = null; }
		if(this._unsubNongli){ this._unsubNongli(); }
		this.unmounted = true;
		window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
	}

	loadHistory(){
		try{
			const raw = window.localStorage.getItem(HISTORY_KEY);
			const arr = raw ? JSON.parse(raw) : [];
			this.setState({ history: Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [] });
		}catch(e){ /* ignore */ }
	}

	pushHistory(result){
		const reading = (result && result.reading) || {};
		const entry = {
			question: reading.question || '',
			questionType: reading.questionType || 'custom',
			questionTypeZh: reading.questionTypeZh || '',
			quesitedHouse: (reading.settings || {}).quesited_house || reading.primaryHouse || 1,
			judge: (reading.judge || {}).nameZh || (reading.judge || {}).nameEn || '',
			ascendant: (reading.ascendantFigure || {}).nameZh || '',
			seed: reading.seed,
			tradition: this.state.tradition, readingScope: this.state.readingScope, zodiacSystem: this.state.zodiacSystem,
			// 四本账:历史回放须能还原当时的传本改写与转宫,否则回放出的是另一副判读
			granular: { ...(this.state.granular || {}) }, turnTo: this.state.turnTo,
			// 四本账续扩:起卦诸法(报数所报之数)与行星地占盘四键
			castMethod: this.state.seedMode,
			castNumbers: this.parsedCastNumbers(),
			planetaryChart: this.state.planetaryChart,
			planetaryChartZodiac: this.state.planetaryChartZodiac,
			planetaryChartNodes: this.state.planetaryChartNodes,
			planetaryChartExtras: this.state.planetaryChartExtras,
			ts: Date.now(),
		};
		let next = [entry];
		try{
			const raw = window.localStorage.getItem(HISTORY_KEY);
			const prev = raw ? JSON.parse(raw) : [];
			if(Array.isArray(prev)){
				// 🔴 一次起卦只占一条:钉盘重算(改时地/流派/传本/所问宫…)出的还是**同一副卦**,
				//    若照旧追加,拖一下时间选择器就能把三十条上限刷满、把真正起过的卦挤出去。
				//    故种子相同即原地替换首条(该条随之反映当前设置,回放亦得最新那份判读)。
				// 判据须含起卦源:报数盘的默认种子恒为 0,只比种子会把两组不同的十六数误当同一盘。
				const castKey = (e)=>[e && e.seed, e && e.castMethod || '',
					JSON.stringify((e && e.castNumbers) || null)].join('|');
				const same = prev.length && prev[0] && Number.isFinite(Number(entry.seed))
					&& castKey(prev[0]) === castKey(entry);
				next = same ? [entry, ...prev.slice(1)] : [entry, ...prev];
			}
		}catch(e){ /* ignore */ }
		next = next.slice(0, HISTORY_MAX);
		try{ safeLocalStorageSet(HISTORY_KEY, JSON.stringify(next)); }catch(e){ /* ignore */ }
		this.setState({ history: next });
	}

	handleSnapshotRefreshRequest(evt){
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		if(moduleName !== 'geomancy'){ return; }
		const result = this.state ? this.state.result : null;
		if(!result){ return; }
		let text = '';
		try{ text = `${buildGeomancySnapshotText(result) || ''}`.trim(); }catch(e){ text = ''; }
		if(text){
			saveModuleAISnapshot('geomancy', text);
			if(evt && evt.detail && typeof evt.detail === 'object'){
				evt.detail.snapshotText = text;
			}
		}
	}

	restoreFromCurrentCase(force){
		const saved = getKentangSavedCasePayload('geomancy');
		if(!saved || !saved.payload){ return false; }
		if(!force && this.lastRestoredCaseId === saved.caseVersion){ return false; }
		const payload = saved.payload;
		const options = payload.options && typeof payload.options === 'object' ? payload.options : {};
		this.lastRestoredCaseId = saved.caseVersion;
		this.requestSeq += 1;
		// 🔴 载档整个提交周期内一律不许重算。真机 setState 是异步的:此处清掉的本地时地草稿要到
		//    下一拍才生效,而那一拍 restored 已是 false、签名却变了 —— 存档盘就被重算覆盖掉了
		//    (jest 若用同步 setState 模拟,这条永远测不出来)。并作废在途的时地重排。
		this._suppressRecast = true;
		if(this._recastTimer){ clearTimeout(this._recastTimer); this._recastTimer = null; }
		this.setState({
			loading: false,
			result: payload.result || null,
			question: options.question !== undefined ? options.question : this.state.question,
			questionType: options.questionType || this.state.questionType,
			quesitedHouse: options.quesitedHouse !== undefined && options.quesitedHouse !== null
				? Number(options.quesitedHouse) : this.state.quesitedHouse,
			// 报数盘同理:存档带十六数者起卦法复位为报数,否则照存档所记(有盘时存的是 manual+种子)
			seedMode: (Array.isArray(options.castNumbers) && options.castNumbers.length === 16)
				? 'numbers' : (options.seedMode || this.state.seedMode),
			manualSeed: options.seed !== undefined ? options.seed : this.state.manualSeed,
			// 🔴 castMethod 此前**存而不载**:保存时 seedMode 被硬写成 'manual'(锁定复现用),
			// 真正用过的起卦法(掷骰/抛硬币/沙痕/掷片/报数)只记在 castMethod 里,而无人读回 →
			// 载档后「这一卦当初是怎么起的」这条信息彻底丢失。此处如实读回;
			// seedMode 仍保持 manual+冻结种子(复现锁语义不动),两者各司其职。
			castMethod: options.castMethod || this.state.castMethod || null,
			// 载档必清本地时地草稿:否则左栏仍显示用户先前改的草稿时地,与存档所记不符
			// (guice:71 / lingqi / feigong / xiaoliuren / xiaochengtu 皆已如此)。
			localFields: null,
			tradition: options.tradition || this.state.tradition,
			readingScope: options.readingScope || this.state.readingScope,
			zodiacSystem: options.zodiacSystem || this.state.zodiacSystem,
			// 四本账:载入/回放时一并还原传本改写与转宫(缺省用 ?? 而非 ||,免把「空对象/0/null」误当未提供)
			granular: options.granular !== undefined && options.granular !== null
				? { ...options.granular } : (this.state.granular || {}),
			turnTo: options.turnTo !== undefined ? options.turnTo : this.state.turnTo,
			// 四本账续扩:起卦诸法与行星地占盘四键(旧存档缺键则保持现值,不写 undefined)
			castNumbersText: Array.isArray(options.castNumbers) && options.castNumbers.length === 16
				? options.castNumbers.join(' ') : this.state.castNumbersText,
			planetaryChart: options.planetaryChart !== undefined
				? !!options.planetaryChart : this.state.planetaryChart,
			planetaryChartZodiac: options.planetaryChartZodiac || this.state.planetaryChartZodiac,
			planetaryChartNodes: options.planetaryChartNodes !== undefined
				? !!options.planetaryChartNodes : this.state.planetaryChartNodes,
			planetaryChartExtras: options.planetaryChartExtras !== undefined
				? !!options.planetaryChartExtras : this.state.planetaryChartExtras,
		}, ()=>{
			this._lastCastParamSig = this.castParamSig();
			this._suppressRecast = false;
			const result = this.state.result;
			// [X1·P2-40] 快照带时地 meta:命盘挂载缓存路径可确凿命中,免每次挂载都复算。
			if(result){ saveModuleAISnapshotLazy('geomancy', ()=>buildGeomancySnapshotText(result), snapshotMetaFromFields(this.activeFields(), { source: 'react', savedAt: Date.now() })); }
		});
		return true;
	}

	// 当前生效 fields:本地草稿优先,否则主命盘 fields。
	activeFields(){
		return this.state.localFields || this.props.fields || {};
	}
	// [自由起盘] 左栏时间选择 → 写本地草稿(不 dispatch)。时间起卦即用此时刻算种子;占星盘用此时刻。
	onTimeChanged(value){
		const dt = value && value.time;
		if(!dt){ return; }
		const base = this.state.localFields || this.props.fields || {};
		this.setState({ localFields: { ...base, ...timePatchFromDateTime(dt) } });
	}
	// [自由起盘] 左栏经纬度选择 → 写本地草稿(经纬 + 时区自动校正 + 重锚时间 + 地名);占星盘用此地点。
	changeGeo(rec){
		const base = this.state.localFields || this.props.fields || {};
		this.setState({ localFields: { ...base, ...geoPatchFromRec(rec, base) } });
	}
	async clickCast(pinnedSeed){
		// 待触发的时地重排就此作废:用户改完时地立刻点「起盘」时,那一拍会在新盘出来后又多打一次
		// (盘不会错,requestSeq 挡得住乱序,但白费一次往返)。
		if(this._recastTimer){ clearTimeout(this._recastTimer); this._recastTimer = null; }
		const seq = ++this.requestSeq;
		const seedMode = this.state.seedMode;
		// pinnedSeed(有限数)= 用既有母图种子定盘重算:同护盾盘、赋义随流派/范围/黄道变,不重新揲卦。
		// (onClick 透传的是 event 对象,Number.isFinite 自然过滤掉,不会误当种子。)
		const pinned = Number.isFinite(pinnedSeed) ? Math.floor(pinnedSeed) : null;
		const af = this.activeFields();
		const payload = {
			question: this.state.question || '',
			questionType: this.state.questionType || 'custom',
			quesitedHouse: Number(this.state.quesitedHouse) || (QUESTION_TYPE_HOUSE[this.state.questionType || 'custom'] || 1),
			seedMode: pinned !== null ? 'manual' : seedMode,
			tradition: this.state.tradition || 'european_classical',
			readingScope: this.state.readingScope || 'L3',
			zodiacSystem: this.state.zodiacSystem || 'classical',
		};
		// [自由起盘] 透传所选时间地理:占星定局(L4)/十二宫(L3)的星盘按此时刻地点起(后端不识则忽略,无害)。
		const gp = paramsFromFields(af);
		if(gp){
			payload.date = gp.date; payload.time = gp.time; payload.zone = gp.zone;
			payload.lon = gp.lon; payload.lat = gp.lat;
			// 纪元前才发 ad:公元后之请求体与本次改动前逐字节相同(负年之真实盘方能起对)
			if(Number(gp.ad) === -1){ payload.ad = -1; }
		}
		// [高级传本] 只发用户显式改过的项;未改的键根本不出现在请求里 → 后端回落所选流派默认。
		// 这是零回归的关键:不传 ≠ 传默认值,后者会在换流派时把旧流派的值钉死。
		const g = this.state.granular || {};
		Object.keys(g).forEach((k)=>{ if(g[k] !== null && g[k] !== undefined){ payload[k] = g[k]; } });
		if(Number.isFinite(Number(this.state.turnTo))){ payload.turnTo = Number(this.state.turnTo); }
		// [起卦诸法] 皮肤四法(掷骰/抛硬币/沙痕/掷片)走同一随机源,以 castMethod 如实回传所用之法;
		// 报数法真收十六数(奇=单点/偶=双点),数不足十六即报错不发,免得静默回落成随机盘。
		if(pinned === null && CAST_SKIN_MODES.indexOf(seedMode) >= 0){
			payload.castMethod = seedMode;
			payload.seedMode = 'random';
		}
		if(pinned === null && seedMode === 'numbers'){
			const nums = this.parsedCastNumbers();
			if(!nums){
				message.error('报数起卦须自报十六个正整数(奇数为单点、偶数为双点;序为母一至母四之火风水土)');
				return;
			}
			payload.castMethod = 'numbers';
			payload.castNumbers = nums;
			payload.seedMode = 'manual';
			// 盾牌由报数定,但辅助随机(另起四行点之上升、异或表盘等)仍须确定性,否则同一组数两次起盘不全同。
			payload.seed = Number(this.state.manualSeed) || 0;
		}
		// [行星地占盘] 仅开启时发四键:关则请求体与开此功能前逐字节相同(零回归)。
		if(this.state.planetaryChart){
			payload.planetaryChart = true;
			payload.planetaryChartZodiac = this.state.planetaryChartZodiac || 'classical';
			if(this.state.planetaryChartNodes){ payload.planetaryChartNodes = true; }
			if(this.state.planetaryChartExtras){ payload.planetaryChartExtras = true; }
		}
		// [钉盘重算] 起卦源取**这副盘自己**回传的 settings,而非左栏现值 —— 左栏那串是下一次起卦的
		// 草稿,不该反噬已出之卦(用户改完报数框却没点起盘,不等于要换掉手上这一卦)。
		// 🔴 报数盘之母图全由那十六个数定、与种子无涉:只钉种子而不带数,后端即改由 RNG 重揲 ——
		//    切一次流派就换了一副卦(实测同种子下 Amissio×4 变成 Puella/Coniunctio…)。
		// 🔴 时间档只认 timeSeed(seed 对它无效),钉错字段即退化真随机 → 按档分派。
		// 八档起卦法逐档实证:回带起卦法 + 按档钉种子 = 八档全同盘,且「当初是怎么起的」不丢。
		if(pinned !== null){
			const fz = (this.state.result && this.state.result.reading && this.state.result.reading.settings) || {};
			const fzMethod = fz.cast_method || '';
			if(fzMethod === 'time'){ payload.castMethod = 'time'; payload.timeSeed = pinned; }
			else{
				payload.seed = pinned;
				if(fzMethod && fzMethod !== 'manual'){ payload.castMethod = fzMethod; }
				if(fzMethod === 'numbers' && Array.isArray(fz.cast_numbers) && fz.cast_numbers.length === 16){
					payload.castNumbers = fz.cast_numbers.slice();
				}
			}
		}
		else if(seedMode === 'manual'){ payload.seed = this.state.manualSeed || 0; }
		// 时间起卦:由左栏所选时间(精确到分)算确定性种子塞 timeSeed,使同一时刻起卦可复现;
		// 不塞则后端走 secrets.randbelow 退化真随机,刷新即变盘(后端 webgeomancysrv.py 已就绪接收 timeSeed)。
		else if(seedMode === 'time_seed'){ payload.timeSeed = computeTimeSeed(af); }
		this.setState({ loading: true });
		try{
			const result = await postGeomancy('reading', payload);
			if(this.unmounted || seq !== this.requestSeq){ return; }
			this.setState({ loading: false, result }, ()=>{
				saveModuleAISnapshotLazy('geomancy', ()=>buildGeomancySnapshotText(result), snapshotMetaFromFields(this.activeFields(), { source: 'react', savedAt: Date.now() }));
				this.pushHistory(result);
			});
		}catch(e){
			if(this.unmounted || seq !== this.requestSeq){ return; }
			this.setState({ loading: false });
			message.error('地占起盘失败，请稍后重试');
		}
	}

	clickReproduce(){
		// 把当前盘的种子锁定为手工种子,便于复现。
		const reading = this.state.result && this.state.result.reading;
		if(!reading || (reading.seed === undefined || reading.seed === null)){ return; }
		this.setState({ seedMode: 'manual', manualSeed: reading.seed });
		message.success(`已锁定种子 ${reading.seed}，再次起盘可复现此盘`);
	}

	clickSaveCase(){
		if(!this.state.result){
			message.info('请先起盘');
			return;
		}
		openKentangCaseDrawer({
			dispatch: this.props.dispatch,
			// 存事盘用生效 fields:改过时间地理则存草稿值(divTime/经纬/地名来自草稿,不写主命盘)。
			fields: this.activeFields(),
			module: 'geomancy',
			label: '天文地占',
			payload: {
				options: {
					question: this.state.question,
					questionType: this.state.questionType,
					quesitedHouse: Number(this.state.quesitedHouse) || QUESTION_TYPE_HOUSE[this.state.questionType || 'custom'] || 1,
					seedMode: this.state.result.reading ? 'manual' : this.state.seedMode,
					seed: this.state.result.reading ? this.state.result.reading.seed : this.state.manualSeed,
					tradition: this.state.tradition,
					readingScope: this.state.readingScope,
					zodiacSystem: this.state.zodiacSystem,
					// 🔴 四本账:传本逐项改写与转宫**此前只存在于内存**,存盘不带、载回即丢
					//    —— 而 restoreFromCurrentCase 一直在读这两个键,存写两侧长期不对称,
					//    载回来的是流派默认盘,与用户存盘时所见判读不同。往返用例已锁死。
					granular: { ...(this.state.granular || {}) },
					turnTo: this.state.turnTo,
					// 四本账续扩:起卦诸法(含报数所报之数)与行星地占盘四键,存写两侧须对称
					castMethod: this.state.seedMode,
					castNumbers: this.parsedCastNumbers(),
					planetaryChart: this.state.planetaryChart,
					planetaryChartZodiac: this.state.planetaryChartZodiac,
					planetaryChartNodes: this.state.planetaryChartNodes,
					planetaryChartExtras: this.state.planetaryChartExtras,
				},
				result: this.state.result,
				snapshot: buildGeomancySnapshotText(this.state.result),
			},
		});
	}

	applyHistory(entry){
		if(!entry){ return; }
		this.setState({
			question: entry.question || '',
			questionType: entry.questionType || 'custom',
			quesitedHouse: Number(entry.quesitedHouse) || QUESTION_TYPE_HOUSE[entry.questionType || 'custom'] || 1,
			// 🔴 报数盘之母图全由那十六个数定 —— 回放若一律按手工种子重揲,得出的是另一副母图。
			//    故存有十六数者复位为报数档(clickCast 即带 castNumbers 重出同盘),余者照旧按种子复现。
			seedMode: (Array.isArray(entry.castNumbers) && entry.castNumbers.length === 16) ? 'numbers' : 'manual',
			manualSeed: entry.seed !== undefined ? entry.seed : 0,
			tradition: entry.tradition || this.state.tradition,
			readingScope: entry.readingScope || this.state.readingScope,
			zodiacSystem: entry.zodiacSystem || this.state.zodiacSystem,
			// 🔴 pushHistory 一直在**存** granular/turnTo(注释写着「回放须能还原当时的传本改写与转宫」),
			//    而此处从不**载** —— 存写两侧长期不对称,回放出来的是流派默认盘,不是当时那副判读。
			//    用 !== undefined 判定而非 ||,免把「空对象 / 0 / null」误当未提供。
			granular: entry.granular !== undefined && entry.granular !== null
				? { ...entry.granular } : (this.state.granular || {}),
			turnTo: entry.turnTo !== undefined ? entry.turnTo : this.state.turnTo,
			// 四本账续扩:回放亦须还原起卦诸法与行星地占盘四键(报数条目按 manual 种子回放同盘)
			castNumbersText: Array.isArray(entry.castNumbers) && entry.castNumbers.length === 16
				? entry.castNumbers.join(' ') : this.state.castNumbersText,
			planetaryChart: entry.planetaryChart !== undefined
				? !!entry.planetaryChart : this.state.planetaryChart,
			planetaryChartZodiac: entry.planetaryChartZodiac || this.state.planetaryChartZodiac,
			planetaryChartNodes: entry.planetaryChartNodes !== undefined
				? !!entry.planetaryChartNodes : this.state.planetaryChartNodes,
			planetaryChartExtras: entry.planetaryChartExtras !== undefined
				? !!entry.planetaryChartExtras : this.state.planetaryChartExtras,
		}, ()=>{ this.clickCast(); });
	}

	setRightPanelTab(key){ this.setState({ rightPanelTab: key }); }
	// centerViewTouched:用户一旦手点过视图,就不再被「结构对照模式自动落其专属盘」覆盖其选择。
	setCenterView(v){ this.setState({ centerView: v, centerViewTouched: true }); }

	// [实时重算·唯一入口] 左栏一改(流派/范围/黄道/传本/行星盘/问类/所问宫/时地)即重排判读,
	// 不必再点一次「起盘」。关键:用既有盘的实际起卦源定盘重算 → 同一母图(护盾盘不变),
	// 仅赋义随设置与时地变;否则随机/时间起卦下会重新揲卦得另一副盘,切一次流派整盘跳变(原 bug)。
	// 未起盘则什么都不算 —— 此时左栏改动只是下一次起卦的草稿。
	recastPinned(){
		const reading = this.state.result && this.state.result.reading;
		if(!reading){ return; }
		const seed = reading.seed;
		if(seed === undefined || seed === null || !Number.isFinite(Number(seed))){ this.clickCast(); return; }
		this.clickCast(Number(seed));
	}

	// 时地面板逐段吐值(选年→选月→选日各一拍),逐拍打后端既慢又白费 → 并到静默期后一次算。
	scheduleRecastPinned(){
		if(this._recastTimer){ clearTimeout(this._recastTimer); }
		this._recastTimer = setTimeout(()=>{
			this._recastTimer = null;
			if(this.unmounted){ return; }
			this.recastPinned();
		}, RECAST_DEBOUNCE_MS);
	}

	// 时地判据:取**真正送进请求体的那几个值**,而非 fields 引用 —— 全局 fields 会因无关 dispatch
	// 换新引用(按引用判会平白重打后端),而本地草稿 localFields 每次都是新对象(按引用判则每敲一下都重算)。
	castParamSig(){
		const gp = paramsFromFields(this.activeFields());
		return gp ? [gp.date, gp.time, gp.zone, gp.lon, gp.lat, gp.ad].join('|') : '';
	}

	// 所问之事:失焦时若与盘上那份不同才重排(逐字重算 = 每敲一下打一次后端)。
	commitQuestion(){
		const rd = this.state.result && this.state.result.reading;
		if(rd && (rd.question || '') !== (this.state.question || '')){ this.recastPinned(); }
	}

	// 问类:选问类即填入其预设所问宫 —— 预设仍在,只是不再是唯一出路。
	changeQuestionType(value){
		this.setState({ questionType: value, quesitedHouse: QUESTION_TYPE_HOUSE[value] || 1 },
			()=>this.recastPinned());
	}

	// 所问宫定的是判读主宫(法官/证人取谁、得地算哪一宫),改了必须重排判读。
	// 手改所问宫即脱离预设 → 问类转「自订」,免得界面显示的问类与实际主宫不符。
	changeQuesitedHouse(value){
		const v = Number(value);
		this.setState({ quesitedHouse: v,
			questionType: (QUESTION_TYPE_HOUSE[this.state.questionType] === v) ? this.state.questionType : 'custom' },
			()=>this.recastPinned());
	}

	// 高级传本逐项改写:写入覆盖表 → 锁种子重算(护盾盘不变,仅判读随设置变)。
	changeGranular(key, value){
		const next = { ...(this.state.granular || {}) };
		if(value === null || value === undefined || value === '__profile__'){ delete next[key]; }
		else{ next[key] = value; }
		this.setState({ granular: next }, ()=>{
			this.recastPinned();
		});
	}

	// 下拉当前值:用户改过则显该值(bool 转字符串以配 Select),未改则显「跟随预设」。
	granularValue(key, backendKey){
		const g = this.state.granular || {};
		const v = g[key];
		if(v === undefined || v === null){ return '__profile__'; }
		return typeof v === 'boolean' ? String(v) : v;
	}

	// 后端回传的实际生效值(供「跟随预设」档标注当前到底是什么,避免用户蒙着点)。
	effLabel(field){
		const st = ((this.state.result || {}).reading || {}).settings || {};
		const raw = st[field.backendKey];
		if(raw === undefined || raw === null){ return ''; }
		const k = typeof raw === 'boolean' ? String(raw) : raw;
		const hit = (field.options || []).find((o)=>o.key === k);
		return hit ? hit.label : String(raw);
	}

	// 生效值之**短名**:供闭合态显示。
	// 🔴 左栏仅 ~195px,而选项全称长至「跟随预设（现为:顺铺(一至十二卦入一至十二宫)）」(实测 277px)
	//    —— 闭合态必被省略号吃掉,等于「选项被遮挡」。故闭合态显短名、下拉列表显全称(optionLabelProp),
	//    并保留 title 悬浮全文;长值之项另改单列全宽,断无截断之理。
	effShort(field){
		const st = ((this.state.result || {}).reading || {}).settings || {};
		const raw = st[field.backendKey];
		if(raw === undefined || raw === null){ return ''; }
		const k = typeof raw === 'boolean' ? String(raw) : raw;
		const hit = (field.options || []).find((o)=>o.key === k);
		return hit ? (hit.short || hit.label) : String(raw);
	}

	// [行星地占盘] 选项变更:与 changeGeomancyOpt 同构(锁种子重算:盾牌盘不变,行星盘随选项重取)。
	changePlanetaryOpt(key, value){
		this.setState({ [key]: value }, ()=>{
			this.recastPinned();
		});
	}

	// [报数起卦] 文本 → 十六个数;非十六个或含非数则返回 null(调用方据此报错不发请求)。
	parsedCastNumbers(){
		const raw = `${this.state.castNumbersText || ''}`.replace(/[，、]/g, ' ').replace(/,/g, ' ');
		const parts = raw.split(/\s+/).filter((x)=>x !== '');
		if(parts.length !== 16){ return null; }
		const nums = parts.map((x)=>Number(x));
		if(nums.some((n)=>!Number.isFinite(n) || n < 1 || Math.floor(n) !== n)){ return null; }
		return nums;
	}

	changeGeomancyOpt(key, value){
		// 换流派预设 = 批量写默认:清空逐项覆盖,让新预设的默认值全面生效(用户可再逐项改写)。
		const patch = key === 'tradition' ? { [key]: value, granular: {} } : { [key]: value };
		this.setState(patch, ()=>{
			this.recastPinned();
		});
	}

	// 流派选项:优先后端回传 traditions(随内核),缺则静态。
	// 🔴 后端只回 id/label 而无短名 —— 若直接用,闭合态短名即丢、窄屏下被省略号截断(实测 63/57px)。
	//    故按 key 从静态表补 short;后端新出的流派无短名则回落其 label(照旧,不至于空)。
	traditionOptions(){
		const t = this.state.result && this.state.result.traditions;
		if(Array.isArray(t) && t.length){
			const shortByKey = { ...TRADITION_SHORT_EXTRA };
			TRADITION_OPTIONS.forEach((o)=>{ if(o.short){ shortByKey[o.key] = o.short; } });
			return t.map((x)=>({ key: x.id, label: x.label, short: shortByKey[x.id] }));
		}
		return TRADITION_OPTIONS;
	}

	renderInputPanel(){
		const r = this.state.result && this.state.result.reading;
		return (
			<div className="horosa-huangji-input-stack horosa-geomancy-input-stack">
				<div>
					<div className="horosa-side-panel-title">天文地占</div>
					<div className="horosa-side-panel-subtitle">护盾盘 · 16 图形 · 判官</div>
				</div>
				{/* [自由起盘] 时间与地点:独立草稿,不写主命盘。此三处用得着它:
			    ①「时间起卦」按此时刻算确定性种子;
			    ② 上升取法选「据所选时地起真实上升」时,按此时地起真实星历盘(唯此式带度数,象限宫制方不退化);
			    ③ 落星法选「真实星历」时,各体按其真实黄经落宫。
			    其余档位一概不用时地(传本盘式之上升取自图形),详见帮助手册「时间与地点」一章。 */}
				<XQSideSection iconName={sideSectionIcon('time')} title="时间与地点" collapsible={false}>
					<SpaceTimePanel
						fields={this.activeFields()}
						value={buildDateTimeFromFields(this.activeFields())}
						onTimeChange={this.onTimeChanged}
						onGeoChange={this.changeGeo}
					/>
				</XQSideSection>
				{/* [左栏统一] 三节收编 XQSideSection(原图标语义保留,卡片类透传) */}
				<XQSideSection iconName="note" title="问题" storageKey="geomancy.question" className="horosa-huangji-input-section">
					<TextArea
						value={this.state.question}
						onChange={(e)=>this.setState({ question: e.target.value })}
						// 所问之事进中栏摘要与 AI 快照(取的是盘上那份 reading.question),改了不重排就一直是旧的。
						// 但逐字重算等于每敲一下打一次后端 → 落在失焦,且只在「真跟盘上那份不一样」时才发。
						onBlur={this.commitQuestion}
						placeholder="输入所问之事（可留空）"
						autoSize={{ minRows: 2, maxRows: 4 }}
						maxLength={200}
					/>
				</XQSideSection>
				<XQSideSection iconName="target" title="起卦选项" storageKey="geomancy.cast" className="horosa-huangji-input-section">
					<div className="horosa-huangji-select-grid">
						<label className="horosa-huangji-select-field horosa-geomancy-half-field">
							<span>问类</span>
							<Select
								value={this.state.questionType}
								onChange={this.changeQuestionType}
								dropdownMatchSelectWidth={false}
								optionLabelProp="label"
							>
								{QUESTION_TYPE_OPTIONS.map((o)=>(
									<Option value={o.key} key={o.key} label={o.short || o.label}>{o.label}</Option>
								))}
							</Select>
						</label>
						<label className="horosa-huangji-select-field horosa-geomancy-half-field">
							<span>所问宫</span>
							<Select
								value={Number(this.state.quesitedHouse) || (QUESTION_TYPE_HOUSE[this.state.questionType] || 1)}
								onChange={this.changeQuesitedHouse}
								dropdownMatchSelectWidth={false}
									optionLabelProp="label"
							>
								{QUESITED_HOUSE_OPTIONS.map((o)=>(
									<Option value={o.v} key={o.v} label={`第${o.v}宫`}>{`第 ${o.v} 宫 · ${o.label}`}</Option>
								))}
							</Select>
						</label>
						<label className="horosa-huangji-select-field horosa-geomancy-half-field">
							<span>起卦法</span>
							<Select value={this.state.seedMode} onChange={(value)=>this.setState({ seedMode: value })} dropdownMatchSelectWidth={false} optionLabelProp="label">
								{SEED_MODE_OPTIONS.map((o)=>(<Option value={o.key} key={o.key} label={o.short || o.label}>{o.label}</Option>))}
							</Select>
						</label>
						{(this.state.seedMode === 'manual' || this.state.seedMode === 'numbers') ? (
							<label className="horosa-huangji-select-field horosa-geomancy-half-field">
								<span>手工种子</span>
								<InputNumber style={{ width: '100%' }} value={this.state.manualSeed} min={0} max={2147483647} onChange={(v)=>this.setState({ manualSeed: v || 0 })} />
							</label>
						) : null}
						{/* [报数起卦] 十六数,奇为单点、偶为双点;序=母一至母四之火风水土(详解见帮助手册) */}
						{this.state.seedMode === 'numbers' ? (
							<label className="horosa-huangji-select-field horosa-geomancy-granular-field">
								<span>报数（十六个）</span>
								<TextArea
									value={this.state.castNumbersText}
									onChange={(e)=>this.setState({ castNumbersText: e.target.value })}
									placeholder="奇数为单点、偶数为双点，如 7 4 3 6 2 9 5 8 1 4 7 2 6 3 8 5"
									autoSize={{ minRows: 2, maxRows: 3 }}
									maxLength={80}
								/>
							</label>
						) : null}
					</div>
				</XQSideSection>
				<XQSideSection iconName="target" title="流派 · 传本设置" storageKey="geomancy.school" className="horosa-huangji-input-section">
					<div className="horosa-huangji-select-grid">
						<label className="horosa-huangji-select-field horosa-geomancy-school-field">
							<span>流派预设</span>
							<Select value={this.state.tradition} onChange={(value)=>this.changeGeomancyOpt('tradition', value)} dropdownMatchSelectWidth={false} optionLabelProp="label">
								{(this.traditionOptions()).map((o)=>(<Option value={o.key} key={o.key} label={o.short || o.label}>{o.label}</Option>))}
							</Select>
						</label>
						<label className="horosa-huangji-select-field horosa-geomancy-school-field">
							<span>读取范围</span>
							<Select value={this.state.readingScope} onChange={(value)=>this.changeGeomancyOpt('readingScope', value)} dropdownMatchSelectWidth={false} optionLabelProp="label">
								{READING_SCOPE_OPTIONS.map((o)=>(<Option value={o.key} key={o.key} label={o.short || o.label}>{o.label}</Option>))}
							</Select>
						</label>
						<label className="horosa-huangji-select-field horosa-geomancy-school-field">
							<span>黄道体系</span>
							<Select value={this.state.zodiacSystem} onChange={(value)=>this.changeGeomancyOpt('zodiacSystem', value)} dropdownMatchSelectWidth={false} optionLabelProp="label">
								{ZODIAC_SYSTEM_OPTIONS.map((o)=>(<Option value={o.key} key={o.key} label={o.short || o.label}>{o.label}</Option>))}
							</Select>
						</label>
					</div>
				</XQSideSection>
				{/* [高级传本] 预设作快捷入口,此处逐项改写;每项「跟随预设」= 不发该参 → 后端回落流派默认。
				    改任一项都走锁种子重算:护盾盘(母图)不变,只有判读随设置变。 */}
				<XQSideSection iconName="target" title="高级传本" storageKey="geomancy.granular" className="horosa-huangji-input-section">
					<div className="horosa-huangji-select-grid">
						{GRANULAR_FIELDS.map((f)=>(
							<label className="horosa-huangji-select-field horosa-geomancy-granular-field" key={f.key}>
								<span>{f.label}</span>
								<Select
									value={this.granularValue(f.key, f.backendKey)}
									onChange={(value)=>this.changeGranular(f.key, value === '__profile__' ? null : (f.bool ? value === 'true' : value))}
									dropdownMatchSelectWidth={false}
									optionLabelProp="label"
								>
									{/* 闭合态显短名(免被省略号吃掉)、下拉列表显全称 */}
									<Option
										value="__profile__"
										key="__profile__"
										label={this.effShort(f) ? `随·${this.effShort(f)}` : '跟随预设'}
									>
										{this.effLabel(f) ? `跟随预设（现为：${this.effLabel(f)}）` : '跟随预设'}
									</Option>
									{f.options.map((o)=>(
										<Option value={o.key} key={o.key} label={o.short || o.label}>{o.label}</Option>
									))}
								</Select>
							</label>
						))}
					</div>
					<label className="horosa-geomancy-uni-toggle">
						<input
							type="checkbox"
							checked={!!this.state.showUnicodeGlyph}
							onChange={(e)=>this.setState({ showUnicodeGlyph: e.target.checked })}
						/>
						<span>并显 Unicode 字形(需系统装有对应字体,缺字会显方框)</span>
					</label>
					<div className="horosa-geomancy-granular-hint">
						未改动的项跟随所选流派预设;换预设即清空全部改写。改动只影响判读,不重新揲卦。
					</div>
				</XQSideSection>
				{/* [行星地占盘] 自成一盘:以首图定上升、七政各以报数落宫。与盾牌落星正交并存(详解见帮助手册) */}
				<XQSideSection iconName="target" title="行星地占盘" storageKey="geomancy.pchart" className="horosa-huangji-input-section">
					<label className="horosa-geomancy-uni-toggle">
						<input
							type="checkbox"
							checked={!!this.state.planetaryChart}
							onChange={(e)=>this.changePlanetaryOpt('planetaryChart', e.target.checked)}
						/>
						<span>另起行星地占盘</span>
					</label>
					{this.state.planetaryChart ? (
						<>
							<div className="horosa-huangji-select-grid">
								<label className="horosa-huangji-select-field horosa-geomancy-granular-field">
									<span>星座对应表</span>
									<Select
										value={this.state.planetaryChartZodiac}
										onChange={(value)=>this.changePlanetaryOpt('planetaryChartZodiac', value)}
										dropdownMatchSelectWidth={false}
									optionLabelProp="label"
									>
										{PCHART_ZODIAC_OPTIONS.map((o)=>(
										<Option value={o.key} key={o.key} label={o.short || o.label}>{o.label}</Option>
									))}
									</Select>
								</label>
							</div>
							<label className="horosa-geomancy-uni-toggle">
								<input
									type="checkbox"
									checked={!!this.state.planetaryChartNodes}
									onChange={(e)=>this.changePlanetaryOpt('planetaryChartNodes', e.target.checked)}
								/>
								<span>加北交·南交(南交取对宫)</span>
							</label>
							<label className="horosa-geomancy-uni-toggle">
								<input
									type="checkbox"
									checked={!!this.state.planetaryChartExtras}
									onChange={(e)=>this.changePlanetaryOpt('planetaryChartExtras', e.target.checked)}
								/>
								<span>加月孛·三王星</span>
							</label>
						</>
					) : null}
				</XQSideSection>
				{r ? (
					<div className="horosa-geomancy-seed-row">
						<span>本盘种子：<strong>{r.seed}</strong></span>
						<Button size="small" onClick={this.clickReproduce}>锁定复现</Button>
					</div>
				) : null}
				<div className="horosa-huangji-action-row">
					<Button type="primary" onClick={this.clickCast}>起盘</Button>
				</div>
			</div>
		);
	}

	// 当前记号样式:传本设置优先,回落点阵。dots 点阵 / lines 单双线 / bindu_rekha 点线 / tablets 开合片。
	markStyle(){
		const st = ((this.state.result || {}).reading || {}).settings || {};
		return st.mark_style || 'dots';
	}

	renderDots(dots, styleOverride){
		// 一个地占图形 = 4 行,每行单点(true)或双点(false)。记号呈现随传本切换,结构恒同。
		const rows = Array.isArray(dots) && dots.length === 4 ? dots : [true, true, true, true];
		const style = styleOverride || this.markStyle();
		const cls = `horosa-geomancy-fig-dots is-${String(style).replace(/_/g, '-')}`;
		return (
			<div className={cls}>
				{rows.map((single, i)=>{
					let body;
					if(style === 'lines'){
						// 单线 I / 双线 II —— 西非同族体系与部分传本用线不用点。
						body = single
							? <span className="horosa-geomancy-fig-line" />
							: (<><span className="horosa-geomancy-fig-line is-half" /><span className="horosa-geomancy-fig-line is-half" /></>);
					}else if(style === 'bindu' || style === 'bindu_rekha'){
						// 点(单)/ 线(双)—— 骰占传本记法。
						body = single
							? <span className="horosa-geomancy-fig-dot" />
							: <span className="horosa-geomancy-fig-rekha" />;
					}else if(style === 'tablets'){
						// 片之开合:刻纹面(开)= 单、素面(合)= 双。
						body = <span className={`horosa-geomancy-fig-tablet${single ? ' is-open' : ''}`} />;
					}else{
						body = single
							? <span className="horosa-geomancy-fig-dot" />
							: (<><span className="horosa-geomancy-fig-dot" /><span className="horosa-geomancy-fig-dot" /></>);
					}
					return <div className="horosa-geomancy-fig-dotrow" key={i}>{body}</div>;
				})}
			</div>
		);
	}

	renderShield(reading){
		const figs = (reading && reading.figures16) || [];
		// [RTL] 自右向左的传本:四格一行逐行镜像(母一在最右)。格位标签随图同镜,不错位。
		const rtl = (((reading && reading.settings) || {}).direction || 'LTR') === 'RTL';
		const idxOf = (i)=>(rtl ? (Math.floor(i / 4) * 4 + (3 - (i % 4))) : i);
		// [得地] 十六位各配一元素(位序循环火风水土),与所盛图之主元素论四档强弱 —— 角标就地标示。
		const tenancy = ((reading && reading.technique) || {}).tenancy || [];
		// [时间流] 右证过去、法官现在、左证未来(传本口径)
		const TIME_BY_SLOT = { 12: '过去', 13: '未来', 14: '现在' };
		return (
			<div className="horosa-geomancy-shield">
				<div className="horosa-geomancy-shield-title">护盾方盘 · 十六图形{rtl ? ' · 自右向左' : ''}</div>
				<div className="horosa-geomancy-shield-grid">
					{/* 每行恰为一族(母/女/甥/证判):FIGURE_GROUPS 作行组标签,slot 序与 RTL 镜像逻辑不变 */}
					{FIGURE_GROUPS.map((g, gi)=>(
						<div className="horosa-geomancy-shield-rowgroup" key={g.label}>
							<span className="horosa-geomancy-shield-grouplab">{g.label}</span>
							<div className="horosa-geomancy-shield-rowcells">
								{Array.from({ length: 4 }).map((_, c)=>{
									const slot = gi * 4 + c;
									const i = idxOf(slot);
									const f = figs[i] || {};
									const tone = (f.tone || '').toLowerCase();
									const qcls = tone === 'good' ? ' is-good' : (tone === 'bad' ? ' is-bad' : '');
									const ten = tenancy[i] || null;
									const when = TIME_BY_SLOT[i];
									return (
										<div className={`horosa-geomancy-shield-cell${qcls}`} key={slot}>
											<span className="horosa-geomancy-shield-slot">
												{FIGURE_SLOTS[i]}
												{when ? <em className="horosa-geomancy-shield-time">{when}</em> : null}
											</span>
											{ten && ten.grade ? (
												<span
													className={`horosa-geomancy-shield-tenancy is-${ten.grade}`}
													title={`${ELEMENT_ZH_BY_EN[ten.figure_element]}入${ELEMENT_ZH_BY_EN[ten.position_element]}位 · ${(TENANCY_GRADE_ZH[ten.grade] || {}).t}:${(TENANCY_GRADE_ZH[ten.grade] || {}).d}`}
												>{TENANCY_GRADE_MARK[ten.grade]}</span>
											) : null}
											{this.renderDots(f.dots)}
											<div className="horosa-geomancy-shield-name">
												<strong>{f.nameZh || f.nameEn || '—'}</strong>
												<em>{f.displayName || f.nameEn || ''}</em>
											</div>
										</div>
									);
								})}
							</div>
						</div>
					))}
				</div>
			</div>
		);
	}

	// 金字塔盘:正统二叉归约树。顶层八图(四母+四女)两两异或成四甥,四甥成二证,二证成判官;
	// 调和者立于盘外(判官与另一图之和)。父子以连线示生成关系 —— 平铺方格看不出这层结构。
	renderPyramid(reading){
		const M = (reading && reading.motherFigures) || [];
		const D = (reading && reading.daughterFigures) || [];
		const N = (reading && reading.nieceFigures) || [];
		const rw = (reading && reading.rightWitness) || null;
		const lw = (reading && reading.leftWitness) || null;
		const judge = (reading && reading.judge) || null;
		const recon = (reading && reading.reconciler) || null;
		const rtl = (((reading && reading.settings) || {}).direction || 'LTR') === 'RTL';
		const tech = (reading && reading.technique) || {};
		// [寻源四线] 传本四线俱可寻(火主目的意志/风主思想交流/水主感情灵性/土主结果物质),
		// 由法官该行之阳爻上溯。所选之线无数据时(或旧盘无此键)回落旧「点之路」(只沿火行)。
		const line = this.state.pyrLine || 'fire';
		const veAll = tech.via_elements || null;
		const ve = veAll ? (veAll[line] || null) : null;
		const vp = ve || tech.via_puncti || {};
		const onPath = new Set(Array.isArray(vp.path) ? vp.path : []);

		const W = 1010, H = 700;
		const COLW = W / 8;
		// 各层节点中心:顶层八列,逐层折半居中
		const rowY = [86, 256, 426, 588];
		const top = [...M.slice(0, 4), ...D.slice(0, 4)];
		const xOf = (col, span)=>{
			const raw = (col + 0.5) * (W / span);
			return rtl ? (W - raw) : raw;
		};
		// [亲缘三元 · 溯源] 盘之生成即「父·父→子」七组亲缘三元,内核 shield_triads 已逐组出参。
		// 此处以**版面接线**(引擎不掌握的几何信息)对齐内核那七组之次序:
		//   甥一←母一二、甥二←母三四、甥三←女一二、甥四←女三四;右证←甥一二、左证←甥三四;判官←二证。
		// TRIAD_WIRING 与内核 shield_triads 逐位同序 —— 故内核标签可直接贴到版面节点上,不必在前端另写一份关系。
		const TRIAD_WIRING = [
			{ child: 'n0', parents: ['t0', 't1'], links: ['l00a', 'l00b'] },
			{ child: 'n1', parents: ['t2', 't3'], links: ['l01a', 'l01b'] },
			{ child: 'n2', parents: ['t4', 't5'], links: ['l02a', 'l02b'] },
			{ child: 'n3', parents: ['t6', 't7'], links: ['l03a', 'l03b'] },
			{ child: 'rw', parents: ['n0', 'n1'], links: ['l10a', 'l10b'] },
			{ child: 'lw', parents: ['n2', 'n3'], links: ['l11a', 'l11b'] },
			{ child: 'jd', parents: ['rw', 'lw'], links: ['l2a', 'l2b'] },
		];
		const SOURCES = TRIAD_WIRING.reduce((m, w)=>{ m[w.child] = w.parents; return m; }, {});
		const triads = Array.isArray(tech.shield_triads) ? tech.shield_triads : [];
		const sel = this.state.pyrSel || null;
		const selIdx = TRIAD_WIRING.findIndex((w)=>w.child === sel);
		const selTriad = selIdx >= 0 ? (triads[selIdx] || null) : null;
		const litSet = new Set(sel ? (SOURCES[sel] || []) : []);
		// 选中时连线同描金 —— 父与子若只亮方块而线不亮,三元的「亲缘」正是看不出来的那一环。
		const litLinks = new Set(selIdx >= 0 ? TRIAD_WIRING[selIdx].links : []);
		const nodes = [];
		const lines = [];
		const push = (f, x, y, tag, key)=>{
			if(!f){ return; }
			const nm = f.nameEn || '';
			const hot = onPath.has(nm);
			const lit = litSet.has(key);
			const isSel = sel === key;
			const tone = (f.tone || '').toLowerCase();
			nodes.push(
				<g key={key}
					className={`horosa-geomancy-pyr-node${hot ? ' is-onpath' : ''}${lit ? ' is-source' : ''}${isSel ? ' is-selected' : ''}${tone === 'good' ? ' is-good' : (tone === 'bad' ? ' is-bad' : '')}${SOURCES[key] ? ' is-clickable' : ''}`}
					onClick={()=>{ if(SOURCES[key]){ this.setState({ pyrSel: sel === key ? null : key }); } }}
					transform={`translate(${x},${y})`}>
					<rect x={-50} y={-58} width={100} height={116} rx={9} className="horosa-geomancy-pyr-box" />
					<text x={0} y={-44} className="horosa-geomancy-pyr-tag" textAnchor="middle">{tag}</text>
					<foreignObject x={-32} y={-34} width={64} height={76}>
						<div className="horosa-geomancy-pyr-dots">{this.renderDots(f.dots)}</div>
					</foreignObject>
					<text x={0} y={50} className="horosa-geomancy-pyr-name" textAnchor="middle">{f.nameZh || nm}</text>
				</g>,
			);
		};
		const link = (x1, y1, x2, y2, hot, key)=>{
			lines.push(<path key={key} d={`M ${x1} ${y1 + 58} L ${x1} ${(y1 + y2) / 2} L ${x2} ${(y1 + y2) / 2} L ${x2} ${y2 - 58}`}
				className={`horosa-geomancy-pyr-link${hot ? ' is-onpath' : ''}${litLinks.has(key) ? ' is-triad' : ''}`} />);
		};
		const TAGS = ['母一', '母二', '母三', '母四', '女一', '女二', '女三', '女四'];
		top.forEach((f, i)=>push(f, xOf(i, 8), rowY[0], TAGS[i], `t${i}`));
		N.slice(0, 4).forEach((f, i)=>push(f, xOf(i, 4), rowY[1], `甥${'一二三四'[i]}`, `n${i}`));
		push(rw, xOf(0, 2), rowY[2], '右证', 'rw');
		push(lw, xOf(1, 2), rowY[2], '左证', 'lw');
		push(judge, xOf(0, 1), rowY[3], '判官', 'jd');
		// 父子连线:甥←两图、证←两甥、判官←二证
		for(let i = 0; i < 4; i++){
			const cx = xOf(i, 4);
			const hot = N[i] && onPath.has(N[i].nameEn);
			link(xOf(i * 2, 8), rowY[0], cx, rowY[1], hot, `l0${i}a`);
			link(xOf(i * 2 + 1, 8), rowY[0], cx, rowY[1], hot, `l0${i}b`);
		}
		[[0, 1, rw], [2, 3, lw]].forEach((grp, gi)=>{
			const cx = xOf(gi, 2);
			const hot = grp[2] && onPath.has(grp[2].nameEn);
			link(xOf(grp[0], 4), rowY[1], cx, rowY[2], hot, `l1${gi}a`);
			link(xOf(grp[1], 4), rowY[1], cx, rowY[2], hot, `l1${gi}b`);
		});
		const jhot = judge && onPath.has(judge.nameEn);
		link(xOf(0, 2), rowY[2], xOf(0, 1), rowY[3], jhot, 'l2a');
		link(xOf(1, 2), rowY[2], xOf(0, 1), rowY[3], jhot, 'l2b');

		return (
			<div className="horosa-geomancy-pyramid">
				<div className="horosa-geomancy-shield-title">
					金字塔盘 · 生成树{rtl ? ' · 自右向左' : ''}
					<span className="horosa-geomancy-pyr-tip">
						{selTriad
							? `亲缘三元 ${selTriad.label}:${(selTriad.parents || []).join(' ⊕ ')} = ${selTriad.child}(再点取消)`
							: (sel ? '已高亮其两源(再点取消)' : '点判官/证/甥可溯其亲缘三元(父·父→子)')}
					</span>
					{/* [寻源四线] 传本:由法官之阳爻上溯,四线各主一层面;线切换即改高亮路径 */}
					{veAll ? (
						<span className="horosa-geomancy-pyr-lines">
							{['fire', 'air', 'water', 'earth'].map((k)=>(
								<button
									type="button"
									key={k}
									title={(VIA_LINE_ZH[k] || {}).d}
									className={`${line === k ? 'is-active' : ''}${(veAll[k] || {}).traceable ? '' : ' is-miss'}`}
									onClick={()=>this.setState({ pyrLine: k })}
								>{(VIA_LINE_ZH[k] || {}).n}</button>
							))}
						</span>
					) : null}
					{ve && !ve.traceable
						? <span className="horosa-geomancy-pyr-vp">{`${(VIA_LINE_ZH[line] || {}).n}线:法官此行阴爻,不可由此寻源`}</span>
						: (vp.through
							? (
								<span className="horosa-geomancy-pyr-vp is-through">
									{veAll
										? `${(VIA_LINE_ZH[line] || {}).n}线贯通${(ve && ve.terminus) ? ` → 盾位${ve.terminus.position}·${VIA_SIDE_ZH[ve.terminus.side]}` : ''}`
										: '点之路贯通'}
								</span>
							)
							: (vp.broken_at ? <span className="horosa-geomancy-pyr-vp">{`${veAll ? `${(VIA_LINE_ZH[line] || {}).n}线` : '点之路'}断于${vp.broken_at}`}</span> : null))}
				</div>
				<svg viewBox={`0 0 ${W} ${H}`} className="horosa-geomancy-pyr-svg" xmlns="http://www.w3.org/2000/svg">
					{lines}
					{nodes}
				</svg>
				{recon ? (
					<div className="horosa-geomancy-pyr-recon">
						<span className="horosa-geomancy-pyr-tag">调和者(盘外)</span>
						{this.renderDots(recon.dots)}
						<strong>{recon.nameZh || recon.nameEn}</strong>
					</div>
				) : null}
			</div>
		);
	}

	renderWheel(reading){
		const houses = (reading && reading.houses) || [];
		const SIZE = 600, C = SIZE / 2;
		// 三环:外环=黄道带(星座符),中环=宫位(宫号+行星),内圆=中心标签。
		const rOuter = 288, rZodiac = 234, rSign = 261, rNum = 214, rPlanetBand = 156, rFigName = 120, rInner = 96;
		const D2R = Math.PI / 180;
		// 宫1 在左(9 点钟,180°),逆时针递增——标准占星盘向。
		// [RTL] 自右向左的传本:宫序顺时针递增(整盘镜像),宫一仍在 9 点钟位。
		const wheelRtl = (((reading && reading.settings) || {}).direction || 'LTR') === 'RTL';
		const houseCenterDeg = (houseIdx)=>(wheelRtl
			? 180 - (houseIdx - 0.5) * 30
			: 180 + (houseIdx - 0.5) * 30);
		const polar = (r, deg)=>[C + r * Math.cos(deg * D2R), C - r * Math.sin(deg * D2R)];
		// 外环+宫环分隔线
		const outerSpokes = [];
		const houseSpokes = [];
		for(let i = 0; i < 12; i++){
			const deg = 180 + i * 30;
			const [ox1, oy1] = polar(rZodiac, deg);
			const [ox2, oy2] = polar(rOuter, deg);
			outerSpokes.push(<line key={`os${i}`} x1={ox1} y1={oy1} x2={ox2} y2={oy2} className="horosa-geomancy-wheel-spoke" />);
			const [hx1, hy1] = polar(rInner, deg);
			const [hx2, hy2] = polar(rZodiac, deg);
			houseSpokes.push(<line key={`hs${i}`} x1={hx1} y1={hy1} x2={hx2} y2={hy2} className="horosa-geomancy-wheel-spoke" />);
		}
		return (
			<div className="horosa-geomancy-wheel">
				<svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="horosa-geomancy-wheel-svg" xmlns="http://www.w3.org/2000/svg">
					<circle cx={C} cy={C} r={rOuter} className="horosa-geomancy-wheel-ring is-gold" />
					<circle cx={C} cy={C} r={rZodiac} className="horosa-geomancy-wheel-ring is-gold" />
					<circle cx={C} cy={C} r={rInner} className="horosa-geomancy-wheel-ring is-gold" />
					{outerSpokes}
					{houseSpokes}
					{houses.map((h, i)=>{
						const deg = houseCenterDeg(i + 1);
						const [sx, sy] = polar(rSign, deg);
						const [nx, ny] = polar(rNum, deg);
						// [希腊点] 福/灵徽记贴宫号侧;四式宫位盘同接一件(greekPointsByHouse)
						const gk = (this.greekPointsByHouse(reading) || {})[h.house] || [];
						return (
							<g key={`h${i}`}>
								<text x={sx} y={sy} className="horosa-geomancy-wheel-sign" style={{ fontFamily: AstroFont }} textAnchor="middle" dominantBaseline="central">{signGlyph(h.sign)}</text>
								<text x={nx} y={ny} className="horosa-geomancy-wheel-num" textAnchor="middle" dominantBaseline="central">{h.house}</text>
								{gk.length ? (
									<text x={nx} y={ny + 17} className="horosa-geomancy-wheel-greek" textAnchor="middle" dominantBaseline="central">
										{gk.map((k)=>(k === 'fortune' ? '福' : '灵')).join('')}
									</text>
								) : null}
							</g>
						);
					})}
					{houses.map((h, i)=>{
						// 图形入宫:图名内移一环,把中环带让给落星;指示星宫(问者/所问)描金。
						const fig = h.figure || {};
						const nm = (fig.nameZh || fig.nameEn || '').slice(0, 2);
						if(!nm){ return null; }
						const [px, py] = polar(rFigName, houseCenterDeg(i + 1));
						const sig = (h.roles || []).length > 0;
						return (
							<text key={`f${i}`} x={px} y={py} className={`horosa-geomancy-wheel-figure${sig ? ' is-significator' : ''}`} textAnchor="middle" dominantBaseline="central">{nm}</text>
						);
					})}
					{/* 占星定局落星:甲=星落其所主图之宫(可缺可多现,是本法固有特征,照实呈现);
					    乙=另起点数定宫(每星必有且仅有一宫)。同宫多星沿宫楔均分,不越界。 */}
					{(()=>{
						const byHouse = this.planetsByHouse(reading) || {};   // 单一真值源;不落星时为空,盘上自然无星
						const out = [];
						Object.keys(byHouse).forEach((hs)=>{
							const hh = parseInt(hs, 10);
							const list = byHouse[hh] || [];
							const base = houseCenterDeg(hh);
							const step = list.length > 1 ? Math.min(22, 26 / list.length) : 0;
							const start = base - (step * (list.length - 1)) / 2;
							list.forEach((p, k)=>{
								const [gx, gy] = polar(rPlanetBand, start + k * step);
								out.push(
									<text key={`pl${hh}-${p}`} x={gx} y={gy} className="horosa-geomancy-wheel-planet"
										style={{ fontFamily: AstroFont }} textAnchor="middle" dominantBaseline="central">
										{PLANET_GLYPH_BY_EN[p] || ''}
									</text>,
								);
							});
						});
						return out;
					})()}
					<text x={C} y={C - 9} className="horosa-geomancy-wheel-center-title" textAnchor="middle">地占占星</text>
					<text x={C} y={C + 14} className="horosa-geomancy-wheel-center-sub" textAnchor="middle">{(reading && reading.ascendantSignZh) || ''}</text>
				</svg>
			</div>
		);
	}

	// 西非同族体系结构对照盘:两列各四记号(线形)+ 主形名 + 对应地占图 + 十六主形参考条。
	// ⚠️ 顶部文化边界声明为**强制呈现**,不可折叠隐藏。
	renderIfa(reading){
		const blk = (reading && reading.ifa) || {};
		const notice = (reading && reading.culturalNotice) || blk.cultural_notice || '';
		const col = (c, tag)=>{
			if(!c){ return null; }
			return (
				<div className="horosa-geomancy-ifa-col">
					<div className="horosa-geomancy-ifa-coltag">{tag}</div>
					<div className="horosa-geomancy-ifa-marks">
						{(c.marks || []).map((m, i)=>(
							<div className="horosa-geomancy-ifa-markrow" key={i}>
								{m === 'I'
									? <span className="horosa-geomancy-fig-line" />
									: (<><span className="horosa-geomancy-fig-line is-half" /><span className="horosa-geomancy-fig-line is-half" /></>)}
							</div>
						))}
					</div>
					<div className="horosa-geomancy-ifa-oduname">{c.odu_name || '—'}</div>
					<div className="horosa-geomancy-ifa-figname">对应图形 · {c.figure || '—'}</div>
				</div>
			);
		};
		return (
			<div className="horosa-geomancy-ifa">
				{notice ? <div className="horosa-geomancy-ifa-notice">{notice}</div> : null}
				<div className="horosa-geomancy-shield-title">
					结构对照盘 · {blk.label || ''}{blk.is_meji ? ' (主形)' : ''} · 自右向左读
				</div>
				<div className="horosa-geomancy-ifa-cols">
					{col(blk.right, '右列(资深)')}
					{col(blk.left, '左列')}
				</div>
				<div className="horosa-geomancy-ifa-reftitle">十六主形 · 比特对照</div>
				<div className="horosa-geomancy-ifa-ref">
					{(blk.meji_reference || []).map((e)=>(
						<div className="horosa-geomancy-ifa-refcell" key={e.seniority}>
							<span className="horosa-geomancy-ifa-refnum">{e.seniority}</span>
							<strong>{e.name}</strong>
							<em>{e.figure}</em>
						</div>
					))}
				</div>
			</div>
		);
	}

	// [方形宫盘] 中世纪通行之方盘:四方十二宫环列、中心留作提要。
	// 宫一居左中,循逆时针下行(一二三在左、四五六在下、七八九在右、十十一十二在上)。
	// 与「护盾方盘」不同 —— 后者是十六图平铺格,此为十二宫之方形排布。
	renderSquareHouses(reading){
		const houses = (reading && reading.houses) || [];
		const rtl = (((reading && reading.settings) || {}).direction || 'LTR') === 'RTL';
		// 四行四列之周边十二格 → 宫位。(行,列) 自左中起逆时针下行。
		const SLOTS = [
			[1, 0, 1], [2, 0, 2], [3, 0, 3],          // 左侧下行:一二三
			[3, 1, 4], [3, 2, 5], [3, 3, 6],          // 下侧右行:四五六
			[2, 3, 7], [1, 3, 8], [0, 3, 9],          // 右侧上行:七八九
			[0, 2, 10], [0, 1, 11], [0, 0, 12],       // 上侧左行:十十一十二
		];
		const byHouse = {};
		houses.forEach((h)=>{ byHouse[h.house] = h; });
		const planetsAt = this.planetsByHouse(reading) || {};
		const greekAt = this.greekPointsByHouse(reading) || {};
		const isIndia = (reading || {}).profileId === 'india_ramal';   // 印度派:宫名改标该支支名
		const cells = SLOTS.map(([r, c, hn])=>{
			const h = byHouse[hn] || {};
			const fig = h.figure || {};
			const sig = (h.roles || []).length > 0;
			const col = rtl ? (3 - c) : c;
			const tone = (fig.tone || '').toLowerCase();
			return (
				<div
					key={hn}
					className={`horosa-geomancy-sq-cell${sig ? ' is-significator' : ''}${tone === 'good' ? ' is-good' : (tone === 'bad' ? ' is-bad' : '')}`}
					style={{ gridRow: r + 1, gridColumn: col + 1 }}
				>
					<div className="horosa-geomancy-sq-head">
						<span className="horosa-geomancy-sq-num">{hn}</span>
						<span className="horosa-geomancy-sq-sign" style={{ fontFamily: AstroFont }}>{signGlyph(h.sign)}</span>
						<span className="horosa-geomancy-sq-topic">{isIndia && h.bhava ? h.bhava : (h.nameZh || h.topicsZh || '')}</span>
						{this.renderGreekMarks(greekAt[hn])}
					</div>
					{this.renderDots(fig.dots)}
					<div className="horosa-geomancy-sq-fig">
						<strong>{fig.displayName || fig.nameZh || fig.nameEn || '—'}</strong>
						{sig ? <em>{(h.roles || []).indexOf('querent') >= 0 ? '问者' : '所问'}</em> : null}
					</div>
					{this.renderHousePlanets(planetsAt[hn])}
				</div>
			);
		});
		return (
			<div className="horosa-geomancy-square">
				<div className="horosa-geomancy-shield-title">方形宫盘 · 十二宫{rtl ? ' · 自右向左' : ''}</div>
				<div className="horosa-geomancy-sq-grid">
					{cells}
					{this.renderBoardCenter(reading, 'horosa-geomancy-sq-center')}
				</div>
			</div>
		);
	}

	// 中心提要之缩放系数:块与点阵都是定值像素,而中心块随窗口在 190~430px 间浮动 ——
	// 定值在最小窗口(壳层硬性 1180×760)下必然越界。CSS 无法读取父元素像素,故此处量一次写成变量,
	// 由 LESS 用 calc(定值 × 系数) 统一缩放。**点阵的槽位按同一系数预留精确高度**,
	// 故缩放后视觉盒恰等于布局盒 —— 截断在结构上不可能发生(此前正是视觉盒>布局盒才被切)。
	attachCenterScale(el){
		if(this._centerRO){ this._centerRO.disconnect(); this._centerRO = null; }
		this._centerEl = el || null;
		if(!el || typeof ResizeObserver === 'undefined'){ return; }
		const apply = ()=>{
			const w = el.clientWidth, h = el.clientHeight;
			if(!w || !h){ return; }
			// 设计基准把**列距/行距/内距一并算进去**(三者同系数缩放,故可整体按比例):
			//   宽 = 3×122 + 2×6(列距) + 2×4(内距) = 386;高 = 3×106 + 2×2(行距) + 2×4 = 330。
			const k = Math.min(1, w / 386, h / 330);
			// 下限只防除零与极端塌缩,不做「不许再小」的约束 —— 硬性下限正是块越界的成因。
			el.style.setProperty('--geo-center-k', String(Math.max(0.3, Math.round(k * 1000) / 1000)));
		};
		apply();
		this._centerRO = new ResizeObserver(apply);
		this._centerRO.observe(el);
	}

	// ── 两式方盘共用:中心提要 ──
	// 判官居中,余下三图按**倒三角**列其周:上二角左证/右证、下一角调和者(RTL 时二证左右互易,与盘面同向)。
	// 🔴 抽成共用件只此一份 —— 两式此前各写一份,已因此掉过队(中世纪盘漏了点阵)。
	renderBoardCenter(reading, cls){
		const r = reading || {};
		const rtl = ((r.settings || {}).direction || 'LTR') === 'RTL';
		const nameOf = (f)=>((f || {}).displayName || (f || {}).nameZh || (f || {}).nameEn || '—');
		const mini = (fig, tag, slot)=>(fig ? (
			<div className={`horosa-geomancy-center-mini is-${slot}`} key={slot}>
				<span className="horosa-geomancy-center-tag">{tag}</span>
				<strong>{nameOf(fig)}</strong>
				<span className="horosa-geomancy-center-dots-slot">{this.renderDots(fig.dots)}</span>
			</div>
		) : null);
		const [leftSlot, rightSlot] = rtl
			? [mini(r.rightWitness, '右证', 'tl'), mini(r.leftWitness, '左证', 'tr')]
			: [mini(r.leftWitness, '左证', 'tl'), mini(r.rightWitness, '右证', 'tr')];
		return (
			<div className={`horosa-geomancy-board-center ${cls}`} ref={(el)=>this.attachCenterScale(el)}>
				{leftSlot}
				{r.ascendantSignZh ? (
					<span className="horosa-geomancy-center-asc">{`上升 ${r.ascendantSignZh}`}</span>
				) : null}
				{rightSlot}
				<div className="horosa-geomancy-center-judge">
					<span className="horosa-geomancy-center-tag">判官</span>
					<strong>{nameOf(r.judge)}</strong>
					<span className="horosa-geomancy-center-dots-slot">{this.renderDots((r.judge || {}).dots)}</span>
				</div>
				{mini(r.reconciler, '调和者', 'bc')}
			</div>
		);
	}

	// ── 落星层(单一真值源)──
	// 🔴 此前落星只画在十二宫盘一处(PLANET_GLYPH_BY_EN 全文件仅现于 renderWheel),
	//    用户停在其余八式时切落星法**零反馈**,看上去就是「这开关坏了」。
	//    今抽成共用件,凡十二宫盘(圆轮/方形宫盘/北印度/中世纪)一律落星;非宫位盘则明说不呈现。
	planetsByHouse(reading){
		const st = (reading && reading.settings) || {};
		const mode = st.house_projection || 'sequential';
		const byHouse = {};
		if(mode === 'astro_bytwelves'){
			const b = (reading && reading.planetPlacementByTwelves) || null;
			if(!b){ return null; }
			Object.keys(b).forEach((p)=>{ const hh = b[p]; if(hh >= 1 && hh <= 12){ (byHouse[hh] = byHouse[hh] || []).push(p); } });
			return byHouse;
		}
		if(mode === 'astro_from_chart'){
			const pp = (reading && reading.planetPlacement) || null;
			if(!pp || !Object.keys(pp).length){ return null; }
			Object.keys(pp).forEach((p)=>{ (pp[p] || []).forEach((hh)=>{ (byHouse[hh] = byHouse[hh] || []).push(p); }); });
			return byHouse;
		}
		return null;                       // 不落星:如实返回空,盘上不画行星
	}

	// [希腊点] 福点/灵点各落一宫 → {宫号: ['fortune'|'spirit', …]}。
	// 🔴 单一真值源 + 共用件:落星层曾只画在圆轮盘一处,其余八式切了零反馈(B0 之病),
	//    故此件由**四式宫位盘全接**(圆轮/方形宫盘/北印度/中世纪),不得只接一处。
	greekPointsByHouse(reading){
		const gp = ((reading && reading.technique) || {}).greek_points || null;
		if(!gp){ return null; }
		const by = {};
		if(gp.fortune_house >= 1 && gp.fortune_house <= 12){ (by[gp.fortune_house] = by[gp.fortune_house] || []).push('fortune'); }
		if(gp.spirit_house >= 1 && gp.spirit_house <= 12){ (by[gp.spirit_house] = by[gp.spirit_house] || []).push('spirit'); }
		return Object.keys(by).length ? by : null;
	}

	// 希腊点徽记(HTML 盘用):福=好运所在·身体财业;灵=意志梦想欲求。
	renderGreekMarks(list){
		if(!list || !list.length){ return null; }
		return (
			<span className="horosa-geomancy-greek-marks">
				{list.map((k)=>(
					<em
						className={`horosa-geomancy-greek-mark is-${k}`}
						key={k}
						title={k === 'fortune' ? '地占式福点:好运所在、身体健康、财富、事业成败、心理素质'
							: '地占式灵点:意志、梦想、希望、追求、欲望、幻想'}
					>{k === 'fortune' ? '福' : '灵'}</em>
				))}
			</span>
		);
	}

	// 宫格内的落星行(HTML 盘用)。圆轮盘另有沿宫楔均分之画法,不共用此件。
	renderHousePlanets(list){
		if(!list || !list.length){ return null; }
		return (
			<span className="horosa-geomancy-house-planets" style={{ fontFamily: AstroFont }}>
				{list.map((p)=>PLANET_GLYPH_BY_EN[p] || '').join('')}
			</span>
		);
	}

	// 非宫位盘上落星法无处可画 —— 静默无反馈会被当成开关坏了,故明说一句。
	renderPlanetHint(reading){
		const st = (reading && reading.settings) || {};
		const mode = st.house_projection || 'sequential';
		if(mode === 'sequential'){ return null; }
		return (
			<div className="horosa-geomancy-planet-hint">
				{`已选${mode === 'astro_bytwelves' ? '占星定局乙' : '占星定局甲'} —— 本式非十二宫盘,不呈现落星;切至十二宫盘/方形宫盘/北印度式/中世纪盘可见。`}
			</div>
		);
	}

	// ── 两式方盘共用:按多边形重心摆图 ──
	// 重心 = 顶点均值(三角与凸多边形皆适用),故图形恒落格内不越界。
	sqCentroid(pts){
		const p = pts.split(' ').map((s)=>s.split(',').map(Number));
		const n = p.length;
		return [p.reduce((a, q)=>a + q[0], 0) / n, p.reduce((a, q)=>a + q[1], 0) / n];
	}

	renderPolyChart(reading, polys, opts){
		const houses = (reading && reading.houses) || [];
		const byHouse = {};
		houses.forEach((h)=>{ byHouse[h.house] = h; });
		const planetsAt = this.planetsByHouse(reading) || {};
		const greekAt = this.greekPointsByHouse(reading) || {};
		const rtl = (((reading && reading.settings) || {}).direction || 'LTR') === 'RTL';
		const mirror = (pts)=>(rtl
			? pts.split(' ').map((s)=>{ const [x, y] = s.split(',').map(Number); return `${100 - x},${y}`; }).join(' ')
			: pts);
		return (
			<div className={`horosa-geomancy-polychart ${opts.cls}`}>
				<div className="horosa-geomancy-shield-title">{opts.title}{rtl ? ' · 自右向左' : ''}</div>
				<div className="horosa-geomancy-poly-board">
					<svg viewBox="0 0 100 100" preserveAspectRatio="none" className="horosa-geomancy-poly-lines" aria-hidden="true">
						<rect x="0" y="0" width="100" height="100" />
						{opts.frame}
						{Object.keys(polys).map((hn)=>{
							const h = byHouse[hn] || {};
							if(!(h.roles || []).length){ return null; }
							return <polygon key={`sig${hn}`} className="horosa-geomancy-poly-sig" points={mirror(polys[hn])} />;
						})}
					</svg>
					{Object.keys(polys).map((hn)=>{
						const h = byHouse[hn] || {};
						const fig = h.figure || {};
						const [cx, cy] = this.sqCentroid(mirror(polys[hn]));
						const sig = (h.roles || []).length > 0;
						const tone = (fig.tone || '').toLowerCase();
						return (
							<div
								key={hn}
								className={`horosa-geomancy-poly-cell${sig ? ' is-significator' : ''}${tone === 'good' ? ' is-good' : (tone === 'bad' ? ' is-bad' : '')}`}
								style={{ left: `${cx}%`, top: `${cy}%` }}
							>
								<span className="horosa-geomancy-poly-head">
									<span className="horosa-geomancy-poly-num">{hn}</span>
									<span className="horosa-geomancy-poly-sign" style={{ fontFamily: AstroFont }}>{signGlyph(h.sign)}</span>
									{this.renderGreekMarks(greekAt[hn])}
								</span>
								{this.renderDots(fig.dots)}
								<span className="horosa-geomancy-poly-name">{fig.displayName || fig.nameZh || fig.nameEn || ''}</span>
								{this.renderHousePlanets(planetsAt[hn])}
							</div>
						);
					})}
					{opts.center ? this.renderBoardCenter(reading, 'horosa-geomancy-poly-center') : null}
				</div>
			</div>
		);
	}

	// [北印度式] 复用印度占星北盘几何:外方 + 菱形(接四边中点) + 四角向心半对角线,成十二格无中心。
	renderNorthChart(reading){
		return this.renderPolyChart(reading, NORTH_POLYGONS, {
			cls: 'is-north', title: '北印度式方盘 · 十二宫', center: false,
			frame: (<>
				<polygon points="50,0 100,50 50,100 0,50" />
				<line x1="0" y1="0" x2="50" y2="50" />
				<line x1="100" y1="0" x2="50" y2="50" />
				<line x1="0" y1="100" x2="50" y2="50" />
				<line x1="100" y1="100" x2="50" y2="50" />
			</>),
		});
	}

	// [中世纪式] 外方 + 内方 + 菱形(顶点接外方边中点、边恰过内方四角)+ 内外四角连线。
	// 几何必然:内方四角落在菱形边上 ⇒ 内方恰为外方正中之半(跨 25 至 75)。成十二格 + 中心提要。
	renderMedievalChart(reading){
		return this.renderPolyChart(reading, MEDIEVAL_POLYGONS, {
			cls: 'is-medieval', title: '中世纪方盘 · 十二宫', center: true,
			frame: (<>
				<rect x="25" y="25" width="50" height="50" />
				<polygon points="50,0 100,50 50,100 0,50" />
				<line x1="0" y1="0" x2="25" y2="25" />
				<line x1="100" y1="0" x2="75" y2="25" />
				<line x1="100" y1="100" x2="75" y2="75" />
				<line x1="0" y1="100" x2="25" y2="75" />
			</>),
		});
	}

	renderCenter(){
		const result = this.state.result;
		if(!result){
			return <div className="horosa-geomancy-empty">输入所问之事后点「起盘」,生成地占护盾方盘与十二宫盘</div>;
		}
		const reading = result.reading || {};
		const hasSikidy = !!reading.sikidy;
		const hasHakata = !!reading.hakata;
		const hasIfa = !!reading.ifa;
		const hasPChart = !!reading.planetaryChart;
		// 当前视图若不可用(如切回非 sikidy 流派)→ 回落护盾方盘;结构对照模式默认落其专属盘。
		let view = this.state.centerView;
		if(view === 'sikidy' && !hasSikidy){ view = 'square'; }
		if(view === 'hakata' && !hasHakata){ view = 'square'; }
		if(view === 'ifa' && !hasIfa){ view = 'square'; }
		if(view === 'planetwheel' && !hasPChart){ view = 'square'; }
		if(hasIfa && !this.state.centerViewTouched){ view = 'ifa'; }
		const stage = view === 'planetwheel' ? this.renderPlanetaryWheel(reading)
			: view === 'wheel' ? this.renderWheel(reading)
			: view === 'north' ? this.renderNorthChart(reading)
				: view === 'medieval' ? this.renderMedievalChart(reading)
					: view === 'squarehouse' ? this.renderSquareHouses(reading)
				: view === 'pyramid' ? this.renderPyramid(reading)
				: view === 'sikidy' ? this.renderSikidy(reading)
					: view === 'hakata' ? this.renderHakata(reading)
						: view === 'ifa' ? this.renderIfa(reading)
							: this.renderShield(reading);
		return (
			<div className="horosa-geomancy-board">
				<div className="horosa-geomancy-board-switch">
					<button type="button" className={`horosa-geomancy-switch-btn${view === 'square' ? ' is-active' : ''}`} onClick={()=>this.setCenterView('square')}>护盾方盘</button>
					<button type="button" className={`horosa-geomancy-switch-btn${view === 'pyramid' ? ' is-active' : ''}`} onClick={()=>this.setCenterView('pyramid')}>金字塔盘</button>
					<button type="button" className={`horosa-geomancy-switch-btn${view === 'wheel' ? ' is-active' : ''}`} onClick={()=>this.setCenterView('wheel')}>十二宫盘</button>
					<button type="button" className={`horosa-geomancy-switch-btn${view === 'squarehouse' ? ' is-active' : ''}`} onClick={()=>this.setCenterView('squarehouse')}>方形宫盘</button>
					<button type="button" className={`horosa-geomancy-switch-btn${view === 'north' ? ' is-active' : ''}`} onClick={()=>this.setCenterView('north')}>北印度式</button>
					<button type="button" className={`horosa-geomancy-switch-btn${view === 'medieval' ? ' is-active' : ''}`} onClick={()=>this.setCenterView('medieval')}>中世纪盘</button>
					{hasSikidy ? <button type="button" className={`horosa-geomancy-switch-btn${view === 'sikidy' ? ' is-active' : ''}`} onClick={()=>this.setCenterView('sikidy')}>异或表盘</button> : null}
					{hasHakata ? <button type="button" className={`horosa-geomancy-switch-btn${view === 'hakata' ? ' is-active' : ''}`} onClick={()=>this.setCenterView('hakata')}>四片盘</button> : null}
					{hasIfa ? <button type="button" className={`horosa-geomancy-switch-btn${view === 'ifa' ? ' is-active' : ''}`} onClick={()=>this.setCenterView('ifa')}>结构对照盘</button> : null}
					{/* [行星地占盘] 左栏开启后方出此钮 —— 无数据不摆死按钮 */}
					{hasPChart ? <button type="button" className={`horosa-geomancy-switch-btn${view === 'planetwheel' ? ' is-active' : ''}`} onClick={()=>this.setCenterView('planetwheel')}>行星地占盘</button> : null}
				</div>
				{['wheel', 'squarehouse', 'north', 'medieval'].indexOf(view) < 0 ? this.renderPlanetHint(reading) : null}
				<div className="horosa-geomancy-board-stage">{stage}</div>
			</div>
		);
	}

	// [行星地占盘] 自成一盘:上升取首图之星座、七政各以报数落宫。
	// 与十二宫盘同用三环几何(外环黄道、中环带落星、内圆盘心),故设计语言一致;
	// 但此盘宫中并无盾面图形 —— 与「占星定局落星」正交,不可混为一谈。
	renderPlanetaryWheel(reading){
		const pc = (reading && reading.planetaryChart) || null;
		if(!pc){ return null; }
		const SIZE = 600, C = SIZE / 2;
		const rOuter = 288, rZodiac = 234, rSign = 261, rNum = 214, rPlanetBand = 156, rInner = 96;
		const D2R = Math.PI / 180;
		const polar = (r, deg)=>[C + r * Math.cos(deg * D2R), C - r * Math.sin(deg * D2R)];
		const houseCenterDeg = (h)=>180 + (h - 1) * 30 + 15;      // 宫一在左(9 点钟),逆时针递增
		const houseEdgeDeg = (h)=>180 + (h - 1) * 30;
		const spokes = [];
		for(let h = 1; h <= 12; h++){
			const [x1, y1] = polar(rInner, houseEdgeDeg(h));
			const [x2, y2] = polar(rOuter, houseEdgeDeg(h));
			spokes.push(<line key={`sp${h}`} x1={x1} y1={y1} x2={x2} y2={y2} className="horosa-geomancy-wheel-spoke" />);
		}
		// 落宫:同宫多星沿宫楔均分,恒不越界(与十二宫盘同法)
		const byHouse = {};
		const all = [].concat(pc.planets || [],
			pc.nodes ? [pc.nodes.north, pc.nodes.south] : [],
			pc.extras || []);
		all.forEach((p)=>{ if(p && p.house >= 1 && p.house <= 12){ (byHouse[p.house] = byHouse[p.house] || []).push(p); } });
		const glyphs = [];
		Object.keys(byHouse).forEach((hs)=>{
			const hh = parseInt(hs, 10);
			const list = byHouse[hh];
			const base = houseCenterDeg(hh);
			const step = list.length > 1 ? Math.min(22, 26 / list.length) : 0;
			const start = base - (step * (list.length - 1)) / 2;
			list.forEach((p, k)=>{
				const [gx, gy] = polar(rPlanetBand, start + k * step);
				const gl = PLANET_GLYPH_BY_EN[p.planet] || PLANET_GLYPH_BY_ZH[p.planet_zh] || '';
				glyphs.push(gl
					? (
						<text key={`pw${hh}-${p.planet}`} x={gx} y={gy} className="horosa-geomancy-wheel-planet"
							style={{ fontFamily: AstroFont }} textAnchor="middle" dominantBaseline="central">{gl}</text>
					)
					: (
						<text key={`pw${hh}-${p.planet}`} x={gx} y={gy} className="horosa-geomancy-wheel-planet is-text"
							textAnchor="middle" dominantBaseline="central">{(p.planet_zh || '').slice(0, 1)}</text>
					));
			});
		});
		return (
			<div className="horosa-geomancy-wheel is-planetary">
				{/* 标题在上、说明在下、盘居中占满横宽(壳层 flex 横排会把二者挤到盘两侧,故 is-planetary 改纵向) */}
				<div className="horosa-geomancy-shield-title">
					{`行星地占盘 · 七政报数落宫`}
					<span className="horosa-geomancy-pyr-tip">
						{`星座表:${(PCHART_ZODIAC_OPTIONS.find((o)=>o.key === pc.zodiac_table) || {}).label || pc.zodiac_table}`}
					</span>
				</div>
				<svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="horosa-geomancy-wheel-svg" xmlns="http://www.w3.org/2000/svg">
					<circle cx={C} cy={C} r={rOuter} className="horosa-geomancy-wheel-ring is-gold" />
					<circle cx={C} cy={C} r={rZodiac} className="horosa-geomancy-wheel-ring is-gold" />
					<circle cx={C} cy={C} r={rInner} className="horosa-geomancy-wheel-ring is-gold" />
					{spokes}
					{(pc.houses || []).map((h)=>{
						const [sx, sy] = polar(rSign, houseCenterDeg(h.house));
						const [nx, ny] = polar(rNum, houseCenterDeg(h.house));
						return (
							<g key={`ph${h.house}`}>
								<text x={sx} y={sy} className="horosa-geomancy-wheel-sign" style={{ fontFamily: AstroFont }} textAnchor="middle" dominantBaseline="central">{signGlyph(h.sign)}</text>
								<text x={nx} y={ny} className="horosa-geomancy-wheel-num" textAnchor="middle" dominantBaseline="central">{h.house}</text>
							</g>
						);
					})}
					{glyphs}
					<text x={C} y={C - 10} className="horosa-geomancy-wheel-center-title" textAnchor="middle">行星地占</text>
					<text x={C} y={C + 16} className="horosa-geomancy-wheel-center-sub" textAnchor="middle">
						{`上升 ${pc.asc_sign_zh}`}
					</text>
				</svg>
				<div className="horosa-geomancy-planet-hint">
					{`首图 ${pc.first_figure} 定上升,顺序排列黄道十二宫;七政各起报数(四数求和除十二取余,余零入十二宫)。`}
					{pc.nodes ? '北交同法、南交取其对宫。' : ''}
					{pc.extras ? '月孛与三王星为传本可选加项。' : ''}
				</div>
			</div>
		);
	}

	// Sikidy 异或表盘:16 列 × 4 行点阵 + 列名/指代义 + 三道校验状态 + 诸侯/奴隶配色。
	renderSikidy(reading){
		const sk = reading.sikidy || {};
		const cols = sk.columns || {};
		const princes = new Set(sk.princes || []);
		return (
			<div className="horosa-geomancy-sikidy">
				<div className="horosa-geomancy-sikidy-status">
					三道校验：<strong className={sk.valid ? 'is-ok' : 'is-bad'}>{sk.valid ? '通过' : '未过'}</strong>
					{sk.red_sikidy ? <span className="horosa-geomancy-sikidy-red">红 Sikidy(大凶)</span> : null}
				</div>
				<div className="horosa-geomancy-sikidy-grid">
					{Array.from({ length: 16 }, (_, k)=>String(k + 1)).map((ci)=>{
						const c = cols[ci] || {};
						const rows = c.rows || [];
						return (
							<div className={`horosa-geomancy-sikidy-col${princes.has(Number(ci)) ? ' is-prince' : ' is-slave'}`} key={ci}>
								<div className="horosa-geomancy-sikidy-dots">
									{rows.map((v, ri)=>(
										<div className="horosa-geomancy-sikidy-dotrow" key={ri}>
											{v ? <span className="horosa-geomancy-dot" /> : (<><span className="horosa-geomancy-dot" /><span className="horosa-geomancy-dot" /></>)}
										</div>
									))}
								</div>
								<div className="horosa-geomancy-sikidy-meta"><span>{ci}</span><em>{c.name}</em><small>{c.meaning}</small></div>
							</div>
						);
					})}
				</div>
				{/* [列比对] 本体系判事靠「列与列是否相同」,而非盾牌的完美/相位。
				    问者列与某主题列同形 = 事之所系即在该主题(如与造物主列同主愈、与诸灵列同主灵扰)。 */}
				{sk.compare ? (()=>{
					const hits = Object.keys(sk.compare)
						.filter((k)=>sk.compare[k] && sk.compare[k].equal)
						.map((k)=>({ col: k, name: (cols[k] || {}).name, meaning: (cols[k] || {}).meaning }));
					return (
						<div className="horosa-geomancy-sikidy-compare">
							<div className="horosa-geomancy-sikidy-compare-title">
								列比对 · 问者列对各主题列（{Object.keys(sk.compare).length} 组）
							</div>
							{hits.length ? (
								<div className="horosa-geomancy-sikidy-hits">
									{hits.map((h)=>(
										<div className="horosa-geomancy-sikidy-hit" key={h.col}>
											<strong>第 {h.col} 列 · {h.name}</strong>
											<em>{h.meaning}</em>
										</div>
									))}
									<div className="horosa-geomancy-sikidy-hint">问者列与以上各列同形 —— 事之所系即在此。</div>
								</div>
							) : (
								<div className="horosa-geomancy-sikidy-hint">问者列与各主题列皆不同形:无直指之应,当以诸侯／奴隶分野与全局形势断。</div>
							)}
						</div>
					);
				})() : null}
				{/* [马语名录] 所据基准只载十六名与其词义、**未载「名↔图」之配对**,故只作名录呈现,不臆造配对。 */}
				<details className="horosa-geomancy-sikidy-mal">
					<summary>十六图形马达加斯加名（参考名录）</summary>
					<div className="horosa-geomancy-sikidy-malgrid">
						{MALAGASY_NAMES.map((m)=>(
							<div className="horosa-geomancy-sikidy-malcell" key={m.n}>
								<strong>{m.n}{m.lunar ? <span className="horosa-geomancy-sikidy-mallunar">月</span> : null}</strong>
								<em>{m.g}</em>
							</div>
						))}
					</div>
					<div className="horosa-geomancy-sikidy-hint">
						区域差异大;所据基准仅载名与词义、未载其与十六图形之配对,故不作配对显示。
					</div>
				</details>
			</div>
		);
	}

	// Hakata 四片盘:4 片正反(开/合)→ 4bit → 局图。
	renderHakata(reading){
		const hk = reading.hakata || {};
		const tablets = hk.tablets || [];
		return (
			<div className="horosa-geomancy-hakata">
				<div className="horosa-geomancy-hakata-tablets">
					{tablets.map((t, i)=>(
						<div className={`horosa-geomancy-hakata-tablet${t.open ? ' is-open' : ' is-closed'}`} key={i}>
							<strong>{t.label}</strong>
							<span className="horosa-geomancy-hakata-state">{t.open ? '开（单）' : '合（双）'}</span>
						</div>
					))}
				</div>
				<div className="horosa-geomancy-hakata-result">
					<div className="horosa-geomancy-hakata-figure" data-tone={hk.tone || ''}>{hk.figure_zh || hk.figure}</div>
					<small>{hk.reading}</small>
					{hk.orientation ? <small className="horosa-geomancy-hakata-orient">{hk.orientation}</small> : null}
				</div>
			</div>
		);
	}

	renderFigureCard(fig, role){
		if(!fig){ return null; }
		const dots = Array.isArray(fig.dots) ? fig.dots : [];
		return (
			<div className="horosa-geomancy-figure-card" key={role}>
				<div className="horosa-geomancy-figure-dots">
					{dots.map((single, i)=>(
						<div className="horosa-geomancy-dot-row" key={i}>
							{single ? <span className="horosa-geomancy-dot" /> : (<><span className="horosa-geomancy-dot" /><span className="horosa-geomancy-dot" /></>)}
						</div>
					))}
				</div>
				<div className="horosa-geomancy-figure-meta">
					<span className="horosa-geomancy-figure-role">{role}</span>
					<strong>{fig.nameZh || fig.nameEn}
						{fig.displayName ? <span className="horosa-geomancy-figure-alt">{fig.displayName}</span> : null}
					</strong>
					<em>{[fig.planetZh, fig.elementZh, fig.signZh].filter(Boolean).join(' · ')}</em>
					{fig.keywordsZh ? <small>{fig.keywordsZh}</small> : null}
				</div>
			</div>
		);
	}

	// [边界] 结构对照模式:只作形的识别与比特对照,**不产出该体系之占断,亦不套用地占含义**。
	// 🔴 引擎守了(reading 只回 structural_only)、AI 快照守了(只出边界声明即 return),
	//    而右栏此前照旧全出地占判读(概要/判定图形/二十一行技法卡/十二宫断语)—— 边界在显示层被越。
	//    今三页签统一改出此卡。
	renderStructuralNotice(r){
		const ifa = r.ifa || {};
		return (
			<div className="horosa-geomancy-reading">
				<div className="horosa-geomancy-card">
					<div className="horosa-geomancy-card-title">边界声明</div>
					<div className="horosa-geomancy-odu-notice">
						{r.culturalNotice || '独立圣传体系,与地占仅十六个四行二元图形外形同构。此处仅作结构与比特对照,不套用地占含义、不构成该体系之占断。'}
					</div>
					{ifa.label ? (
						<div className="horosa-geomancy-summary">
							<div className="horosa-geomancy-summary-row"><span>结构对照</span><strong>{`${ifa.label}${ifa.is_meji ? '(主形)' : ''}`}</strong></div>
							<div className="horosa-geomancy-summary-row"><span>右列</span><strong>{`${(ifa.right || {}).odu_name || '—'} → ${(ifa.right || {}).figure || '—'}`}</strong></div>
							<div className="horosa-geomancy-summary-row"><span>左列</span><strong>{`${(ifa.left || {}).odu_name || '—'} → ${(ifa.left || {}).figure || '—'}`}</strong></div>
						</div>
					) : null}
					{/* 区块内之注一律用 note-hint:tech-hint 是技法行释义专用类,
					    混用会破坏「技法每行恰一句释义」的计数不变量 */}
					<div className="horosa-geomancy-note-hint">
						本模式不出地占之判定、解读技法与十二宫断语;欲作地占判读请在左栏另择流派。
						中栏「结构对照盘」可见两列记号与十六主形之比特对照。
					</div>
				</div>
			</div>
		);
	}

	renderReading(){
		const result = this.state.result;
		if(!result){ return <div className="horosa-huangji-empty">暂无地占数据</div>; }
		const r = result.reading || {};
		if(r.structuralOnly){ return this.renderStructuralNotice(r); }
		const houses = r.houses || [];
		// [X1·P1-20] 读取范围真门控:L0 仅判官 / L1 +解读技法 / L2 盾牌全局(中栏恒在,解读同 L1) /
		// L3 +十二宫(默认,字节不变) / L4 = L3 并标注占星定局体系(黄道体系选择器所出,不臆造新层)。
		const depth = ({ L0: 0, L1: 1, L2: 2, L3: 3, L4: 4 })[this.state.readingScope];
		const lvl = depth === undefined ? 3 : depth;
		return (
			<div className="horosa-geomancy-reading">
				{/* [X1·P1-22] 首母中止警示:后端算出而此前前端零渲染(约 1/8 盘触发) */}
				{r.haltedOnFirstMother ? (
					<div className="horosa-geomancy-card" style={{ borderColor: 'var(--horosa-danger, #cf1322)' }}>
						<div className="horosa-geomancy-card-title" style={{ color: 'var(--horosa-danger, #cf1322)' }}>⚠ 首母中止</div>
						<div style={{ fontSize: 12.5, lineHeight: 1.6 }}>首母落 Rubeus/Cauda 之属——依所选传本传统,此占应中止、另择时再占;以下判读仅作参考。</div>
					</div>
				) : null}
				<div className="horosa-geomancy-card">
					<div className="horosa-geomancy-card-title">本占概要</div>
					<div className="horosa-geomancy-summary">
						<div className="horosa-geomancy-summary-row"><span>问题</span><strong>{r.question || '—'}</strong></div>
						<div className="horosa-geomancy-summary-row"><span>问类</span><strong>{r.questionTypeZh || r.questionType || '—'}</strong></div>
						<div className="horosa-geomancy-summary-row"><span>上升</span><strong>{(r.ascendantFigure || {}).nameZh || '—'} · {r.ascendantSignZh || ''}</strong></div>
						<div className="horosa-geomancy-summary-row"><span>主宫</span><strong>第 {r.primaryHouse || '—'} 宫</strong></div>
					</div>
				</div>
				<div className="horosa-geomancy-card">
					<div className="horosa-geomancy-card-title">判定图形</div>
					<div className="horosa-geomancy-figure-grid horosa-geomancy-key-figures">
						{this.renderFigureCard(r.judge, '判官')}
						{this.renderFigureCard(r.reconciler, '调和者')}
						{this.renderFigureCard(r.ascendantFigure, '命主')}
					</div>
					{/* 两法恒等是**数学事实**而非开关失灵:顺铺下宫一所盛正是首母,故 J⊕M1 与 J⊕问者指示星同值。
					    引擎早已回传该事实,但界面从不说 —— 用户只会以为「调和者取法」这开关坏了。今如实说明。 */}
					{((r.settings || {}).reconciler_modes_coincide) ? (
						<div className="horosa-geomancy-coincide-note">
							调和者取法二式此盘同值:顺铺下宫一所盛正是首母,故「判官⊕首母」与「判官⊕问者指示星」恒等。
							转宫后问者指示星随之易主,二式即分野。
						</div>
					) : null}
				</div>
				{lvl >= 1 ? this.renderFlowChecklist(r) : null}
				{lvl >= 4 ? (() => {
					// 如实描述定局链路:上升怎么来 → 十二宫怎么铺。此前文案称「按星座体系定十二宫星座」,
					// 而盘上画的却是写死的自然星座,与盘心上升矛盾;今与实际取值同源如实陈述。
					const er = r.astroErection || {};
					// 🔴 上升取法与黄道体系皆已增至三档,此处若仍写「非乙即甲」的二分,第三档就会被显示成第一档
					//    (选了「取法官之图」却写「取第一宫之图」= 显示层撒谎)。故一律**由选项表按实际值取名**,
					//    且以引擎回传值为准(而非组件 state,后者在载入/回放途中可能尚未同步)。
					const ASC_OPTS = (GRANULAR_FIELDS.find((f)=>f.key === 'ascSource') || {}).options || [];
					const ascWay = ((ASC_OPTS.find((o)=>o.key === er.asc_source) || {}).label)
						|| '取第一宫之图';
					const zsysKey = r.zodiacSystem || this.state.zodiacSystem;
					const zsysZh = ((ZODIAC_SYSTEM_OPTIONS.find((o)=>o.key === zsysKey) || {}).label)
						|| '古典定局体系';
					// 真实星历盘为唯一带度数之取法:有度数则如实报度、报所用象限宫制,并说明十二宫按真宫头分
					//(而非自上升整宫顺铺)。用户选了此档而时地不全者,如实报回落原因 —— 绝不假作已按时地起。
					const rc = r.realChart || null;
					const st = r.settings || {};
					const isReal = er.asc_source === 'real_chart' && er.asc_lon !== undefined;
					const PROJ_OPTS = (GRANULAR_FIELDS.find((f)=>f.key === 'houseProjection') || {}).options || [];
					const projWay = ((PROJ_OPTS.find((o)=>o.key === st.house_projection) || {}).label) || '';
					const projReal = st.house_projection === 'real_ephemeris';
					return (
						<div className="horosa-geomancy-card">
							<div className="horosa-geomancy-card-title">占星定局(L4)</div>
							<div style={{ fontSize: 12.5, lineHeight: 1.6 }}>
								上升 <strong>{isReal ? (er.sign_zh || '—') : (r.ascendantSignZh || '—')}</strong>
								{isReal ? <strong>{` ${fmtDegMin(er.asc_deg_in_sign)}`}</strong> : null}
								(取法:{ascWay}
								{isReal ? '' : (er.figure ? ` · ${er.figure}` : '')}
								{isReal ? '' : `,按「${zsysZh}」得其星座`});
								{isReal
									? '十二宫按真实宫头度数分,见下各行星座与宫头度数。'
									: '十二宫自上升起按黄道顺铺,见下各行星座列。'}
							</div>
							{isReal ? (
								<div className="horosa-geomancy-note-hint">
									已按左栏所选时地起真实星历盘
									{er.quadrant_system
										? `(象限分宫用${QUADRANT_SYSTEM_ZH[er.quadrant_system] || er.quadrant_system})`
										: '(整宫制:各宫头为其星座之零度)'}
									{rc && typeof rc.mc_lon === 'number' ? `;中天黄经 ${rc.mc_lon.toFixed(2)}°` : ''}。
									⚠️ 此式非传本之法 —— 传本盘式之上升取自图形、不起真实星盘,故此为可选之第四式。
								</div>
							) : null}
							{(st.real_chart_requested && st.real_chart_available === false) ? (
								<div className="horosa-geomancy-note-hint">
									⚠️ 已选「据所选时地起真实上升」{projReal ? `与「${projWay}」` : ''},
									然左栏时地不全(须日期与经纬俱备)或星历不可用,
									故已如实回落图形取法{projReal ? '与占星定局甲' : ''}。
								</div>
							) : null}
							{er.degenerate_to_whole_sign ? (
								<div style={{ fontSize: 12, lineHeight: 1.6, marginTop: 6, opacity: 0.75 }}>
									{er.note || '地占定局只出上升星座而无度数,象限分宫须有宫头度数,故此处退化为整宫制'}。
								</div>
							) : null}
						</div>
					);
				})() : null}
				{lvl < 3 ? (
					<div className="horosa-geomancy-card">
						<div style={{ fontSize: 12, opacity: 0.7 }}>读取范围 {this.state.readingScope}:更深层(解读技法/十二宫)已按档隐藏,切至 L3/L4 展开全部。</div>
					</div>
				) : null}
			</div>
		);
	}

	// 图名 → 所选名表之名。引擎在 technique/亲缘三元 等处一律用**拉丁标识**指代图形,
	// 故此前无论名表怎么切,右栏都纹丝不动(实测拉丁 vs 阿拉伯 三 tab 逐字相同)。
	// 今据 figures16 建映射就地译名。🔴 拉丁档下 displayName === nameEn ⇒ 默认路径逐字不变。
	figNameMap(r){
		const m = {};
		((r && r.figures16) || []).forEach((f)=>{
			if(f && f.nameEn){ m[f.nameEn] = f.displayName || f.nameEn; }
		});
		return m;
	}

	// [判断 tab] 解读技法 + 转宫。独立成 tab —— 此前与概要/判定/九步/十二宫同挤一栏,
	// 一屏塞十几张卡,长到要滚很久才看得完,判读时来回找。
	renderJudgementTab(){
		const result = this.state.result;
		if(!result){ return <div className="horosa-huangji-empty">暂无地占数据,请先起盘</div>; }
		const r = result.reading || {};
		if(r.structuralOnly){ return this.renderStructuralNotice(r); }
		const depth = ({ L0: 0, L1: 1, L2: 2, L3: 3, L4: 4 })[this.state.readingScope];
		const lvl = depth === undefined ? 3 : depth;
		if(lvl < 1){
			return (
				<div className="horosa-geomancy-reading">
					<div className="horosa-geomancy-card">
						<div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.6 }}>
							读取范围 {this.state.readingScope} 只出判官一图,解读技法按档隐藏 —— 切至 L1 以上即展开。
						</div>
					</div>
				</div>
			);
		}
		return <div className="horosa-geomancy-reading">{this.renderTechniqueCard(r)}</div>;
	}

	// [十二宫 tab] 图形入宫 · 断语。独立成 tab(十二行断语很长,与判断混排会互相埋没)。
	renderHousesTab(){
		const result = this.state.result;
		if(!result){ return <div className="horosa-huangji-empty">暂无地占数据,请先起盘</div>; }
		const r = result.reading || {};
		if(r.structuralOnly){ return this.renderStructuralNotice(r); }
		const houses = r.houses || [];
		const depth = ({ L0: 0, L1: 1, L2: 2, L3: 3, L4: 4 })[this.state.readingScope];
		const lvl = depth === undefined ? 3 : depth;
		if(lvl < 3){
			return (
				<div className="horosa-geomancy-reading">
					<div className="horosa-geomancy-card">
						<div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.6 }}>
							读取范围 {this.state.readingScope} 不铺十二宫 —— 切至 L3/L4 即展开图形入宫与逐宫断语。
						</div>
					</div>
				</div>
			);
		}
		return (
			<div className="horosa-geomancy-reading">
				<div className="horosa-geomancy-card">
					<div className="horosa-geomancy-card-title">十二宫（图形入宫 · 断语）</div>
					{/* 入宫式非顺铺时如实交代:四正入宫者四果宫为对位两图之和,近世式为固定置换 */}
					{((r.settings || {}).house_placement === 'angular') ? (
						<div className="horosa-geomancy-coincide-note">
							四正入宫式:四母入一/十/七/四宫、四女入十一/二/八/五宫,
							三·六·九·十二四果宫所盛为对位两图相加之<strong>合成卦</strong>(非盾面原图)。
						</div>
					) : null}
					{((r.settings || {}).house_placement === 'golden_dawn') ? (
						<div className="horosa-geomancy-coincide-note">
							近世学派置换入宫:十二图按固定置换入宫(盾位一→十宫、盾位二→一宫……),非顺铺。
						</div>
					) : null}
					<div className="horosa-geomancy-house-list">
						{houses.map((h)=>{
							const fig = h.figure || {};
							const roles = h.roles || [];
							return (
								<div className={`horosa-geomancy-house-row${roles.length ? ' is-significator' : ''}`} key={h.house}>
									<span className="horosa-geomancy-house-num">{h.house}</span>
									<span
										className="horosa-geomancy-house-sign"
										title={h.naturalSignZh && h.naturalSignZh !== h.signZh
											? `定局星座 ${h.signZh}(自上升顺铺)· 自然星座 ${h.naturalSignZh}(次要判断)`
											: undefined}
									><span className="horosa-geomancy-sign-glyph" style={{ fontFamily: AstroFont }}>{signGlyph(h.sign)}</span> {h.signZh}
										{/* 宫头度数只在真实星历盘下有(图形取法无度数);无则此处一字不多,默认路径逐字不变 */}
										{typeof h.cuspDegInSign === 'number'
											? <em className="horosa-geomancy-cusp-deg">{fmtDegMin(h.cuspDegInSign)}</em>
											: null}
									</span>
									<span className="horosa-geomancy-house-topic">
										<span className="horosa-geomancy-house-name">{h.nameZh || h.topicsZh}</span>
										{/* 🔴 图名 / 副名 / 角色**各自独立成项**,由 topic 的 flex-wrap 自然换行。
										    此前三者挤在同一个 `white-space: nowrap` 的 span 里:
										    宫一既带长拉丁副名又同时挂「·问者 ·所问」,整段挤出行外 17.5px(实测)。
										    分开之后,窄栏下先折角色、再折副名,任何宽度都不会戳出去。 */}
										<span className="horosa-geomancy-house-figure" data-tone={fig.tone || ''}>
											{fig.nameZh || fig.nameEn}
										</span>
										{fig.displayName ? (
											<em className="horosa-geomancy-house-figure-alt">{fig.displayName}</em>
										) : null}
										{roles.length ? (
											<span className="horosa-geomancy-house-roles">
												{roles.indexOf('querent') >= 0 ? '·问者' : ''}
												{roles.indexOf('quesited') >= 0 ? '·所问' : ''}
											</span>
										) : null}
									</span>
									{((this.state.result || {}).reading || {}).profileId === 'india_ramal' && (h.figure || {}).vedic ? (
										<small className="horosa-geomancy-house-vedic">
											{[h.bhava ? `${h.bhava}(${h.bhavaZh || ''})` : '',
												h.figure.vedic.graha_zh || '',
												h.figure.vedic.rashi || ''].filter(Boolean).join(' · ')}
										</small>
									) : null}
									{h.reading ? <small className="horosa-geomancy-house-reading">{h.reading}</small> : null}
									{/* 盘式十二宫主宰事项(传本关键词树):展开即见该宫所主之全谱 */}
									{h.topicsDetailZh ? (
										<details className="horosa-geomancy-house-detail">
											<summary>{`本宫主宰事项`}</summary>
											<div>{h.topicsDetailZh}</div>
										</details>
									) : null}
								</div>
							);
						})}
					</div>
				</div>
			</div>
		);
	}

	// 技法卡。读 reading.technique(引擎可计算解读)。
	// 🔴 **两组分列**:多项「技法」实为**问者宫↔所问宫之纯函数**,与本卦无关 ——
	//    实测 300 盘固定问类下:相位恒 opposition、黄道宫三方恒 [3,7,11]、
	//    位置之宫性恒「吉宫/平宫」、应期之宫角恒 fast。算法合基准,但与随卦而变者并列陈列、
	//    不加半句注记,会让人误以为这些是本卦算得的。故分「随卦而变 / 随问类而定」两组,后者显式加注。
	renderTechniqueCard(r){
		const t = r && r.technique;
		if(!t){ return null; }
		const PERF = { occupation: '入主(同居一宫)', conjunction: '会合(邻宫)', mutation: '互变(他处相邻)', translation: '传递(第三图转介)', none: '未成局' };
		const ASP = { conjunction: '合', sextile: '六分(吉)', square: '刑(凶)', trine: '拱(吉)', opposition: '冲', none: '无相位' };
		const COMP = { simple: '全同', demi_simple: '半同(同行星)', compound: '互反', capitular: '同首(火行)', none: '—' };
		const TONE_ZH = { good: '吉', bad: '凶', neutral: '中性' };
		const TRI_EL = { 1: '火', 5: '火', 9: '火', 2: '地', 6: '地', 10: '地',
			3: '风', 7: '风', 11: '风', 4: '水', 8: '水', 12: '水' };
		const NM = this.figNameMap(r);
		const fn = (x)=>((x && NM[x]) ? NM[x] : x);          // 拉丁标识 → 所选名表之名
		const perfHit = t.perfection && t.perfection !== 'none';
		// group: 'chart' 随卦而变 | 'topic' 随问类而定(同一问类下恒同)
		// 🔴 **全项常驻**:此前未命中即整行消失 —— 实测 200 盘渲染率 阻碍 54.5%、中介 30%、
		//    自然共主 24%,同一卡显 11~13 行不等,用户**无从分辨「查过但未成立」与「根本没实现」**。
		//    今每项恒在其位,未命中显「无/不适用/未成立」并弱化配色;每行附一句释义。
		const rows = [];
		const push = (label, value, hint, group, miss)=>rows.push({
			label, value, hint, group: group || 'chart', miss: !!miss });

		// ── 传本解卦之首二步:先验卦盘是否有效,再看法庭三角总断 ──
		{
			const va = t.validity;
			const hits = ((va && va.rules) || []).filter((x)=>x.hit);
			push('有效性', va
				? (hits.length
					? hits.map((x)=>`${VALIDITY_LABELS[x.id - 1]}:${VALIDITY_RULES_ZH[x.code] || x.code}${x.book_note ? `(${x.book_note})` : ''}`).join('；')
					: '五则皆过,卦盘可判')
				: '—',
				'传本五则:首图龙尾/红色/失去/群众各有所警,另一则看一宫群众并十一宫红色', 'chart', !va || !hits.length);
		}
		{
			const cv = t.court_verdict;
			let v = '—';
			if(cv){
				const three = `左证${fn(cv.left.figure)}(${TONE_CLASS_ZH[cv.left.tone_class]})·`
					+ `法官${fn(cv.judge.figure)}(${TONE_CLASS_ZH[cv.judge.tone_class]})·`
					+ `右证${fn(cv.right.figure)}(${TONE_CLASS_ZH[cv.right.tone_class]})`;
				v = `${three} → ${COURT_VERDICT_ZH[cv.verdict_code] || cv.verdict_code}`;
				if(cv.judge_special){ v = `${COURT_JUDGE_SPECIAL_ZH[cv.judge_special]};${v}`; }
			}
			push('法庭三角', v,
				'法官定总方向、右证为事主、左证为条件环境;三图吉凶合断成否(传本表未载之组合如实标出)',
				'chart', !cv);
		}
		push('完美', perfHit ? PERF[t.perfection] : (t.perfection_by_aspect ? `借相位(${ASP[t.perfection_by_aspect]})成局` : PERF.none),
			'两指示星能否接上:同宫/邻宫/互变/借第三图转介,四者有其一即成局',
			'chart', !perfHit && !t.perfection_by_aspect);
		push('阻碍', t.prohibition ? `第 ${t.prohibition} 宫强凶图阻断` : '无阻碍',
			'成局之路上若横亘强凶之图,则事将成而中折', 'chart', !t.prohibition);
		{
			const pp = t.points_parity;
			push('点数是否', pp
				? `总 ${pp.total} 点·${pp.parity === 'even' ? '偶→是/稳' : '奇→否/动'}(取样:${PARITY_SCOPE_ZH[pp.scope] || '全盘十六图'})`
					+ (pp.degenerate ? ' ⚠ 该取样结构恒偶,不具判别力' : '')
				: '—',
				'总点数奇偶断是非成否:偶主是/稳成,奇主否/变动', 'chart', !pp);
		}
		push('应期', t.timing
			? `${t.timing.speed === 'fast' ? '速' : '迟'}·以「${t.timing.unit}」计`
				+ `·${{ fast: '角宫快', mid: '续宫中', slow: '果宫慢' }[t.timing.angularity] || ''}(宫角由所问宫定)`
			: '—',
			'快慢由图之动静定、单位由图之元素定,再以所问宫之角/续/果加权', 'chart', !t.timing);
		{
			const q = t.timing && t.timing.quantity;
			push('数量', q ? `${q.label}(总 ${q.total} 点·域 ${q.min}–${q.max})` : '—',
				'答「几件/几人/多少」一类问法:总点数于其域中三分为多/中/少', 'chart', !q);
		}
		push('点之路', t.via_puncti
			? (t.via_puncti.through ? `贯通(${(t.via_puncti.path || []).map(fn).join('→')})` : `断于${t.via_puncti.broken_at}`)
			: '—',
			'自判官循单点上溯至母图:贯通则事有来路,断则中途失据', 'chart', !t.via_puncti);
		push('自然共主', t.natural_cosignificator ? '月亮(判官属月亮系)' : '不涉',
			'判官若属月亮所主之图,则月亮为本占之自然共主', 'chart', !t.natural_cosignificator);
		{
			// 位置:**图之吉凶须与所落之宫吉凶并看** —— 图吉而落凶宫,其吉减半。
			// 宫性(吉/平/凶宫)由宫号定、同问类恒同;图则随卦而变,故两者都要显出来。
			const lq = t.locus_quesited;
			const lqq = t.locus_querent || {};
			const one = (x)=>(x && x.figure)
				? `${fn(x.figure)}(${TONE_ZH[x.figure_tone] || '—'})落第 ${x.house} 宫·${x.label}`
				: '—';
			push('位置', lq ? `所问 ${one(lq)}；问者 ${one(lqq)}` : '—',
				'图之吉凶须与所落之宫吉凶并看:图吉而落凶宫,其吉减半(宫性同问类恒同,图随卦而变)',
				'chart', !lq);
		}
		{
			const rec = (t.motus && t.motus.recurring) || [];
			push('移动', rec.length
				? rec.slice(0, 3).map((x)=>`${fn(x.figure)}现于${x.houses.join('/')}宫(${x.count}次)`).join('；')
				: '无重现',
				'同一图重现愈多,其象愈贯穿全局', 'chart', !rec.length);
		}
		{
			const d0 = t.perfection_detail || {};
			let v = '不适用';
			if(d0.via_figure){
				const vf = Array.isArray(d0.via_figure) ? d0.via_figure.map(fn).join('、') : fn(d0.via_figure);
				const vh = Array.isArray(d0.via_house) ? d0.via_house.join('/') : d0.via_house;
				v = `${vf}(第 ${vh} 宫)${d0.mover ? `；${d0.mover === 'querent' ? '问者' : '所问'}移就` : ''}`;
			}else if(d0.mover){
				v = `${d0.mover === 'querent' ? '问者' : '所问'}移就`;
			}
			push('中介', v, '传递成局时,居中之图所落之宫即揭示促成者身份(如落七宫则配偶或合伙之人)',
				'chart', v === '不适用');
		}
		{
			const comp = (t.company || []).filter((c)=>c.type && c.type !== 'none')
				.map((c)=>`宫${c.pair[0]}/${c.pair[1]}:${COMP[c.type]}`);
			push('同伴', comp.length ? comp.join('；') : '无同伴',
				'成对之宫所盛二图若同/半同/互反/同首,则二事同气相连', 'chart', !comp.length);
		}
		// ── 传本补齐:成败 / 得地 / 寻源四线 / 元素法 / 希腊点 / 宣判奇偶 ──
		{
			const sc = t.success;
			push('成败判定', sc
				? `${sc.has_perfection ? '有精准相位' : '无精准相位'}·事主${TONE_CLASS_ZH[sc.querent_tone]}`
					+ `·对象${TONE_CLASS_ZH[sc.quesited_tone]} → ${SUCCESS_ZH[sc.code] || sc.code}`
				: '—',
				'有精准相位则事发生、无则不发生;再以两指示图吉凶分四格。只判成否,不判好坏顺逆,须与法官合参,勿滥用',
				'chart', !sc);
		}
		{
			const tn = t.tenancy || [];
			const key = { 13: '右证', 14: '左证', 15: '判官', 16: '宣判' };
			const brief = tn.filter((x)=>x.position >= 13 && x.figure)
				.map((x)=>`${key[x.position]}${fn(x.figure)}入${ELEMENT_ZH_BY_EN[x.position_element]}位·${(TENANCY_GRADE_ZH[x.grade] || {}).t || '—'}`);
			push('得地', brief.length ? brief.join('；') : '—',
				'盾十六位以火风水土按序分配;卦元素与位元素全同者最强、同温者辅助、同湿者停滞、全异者无力(盘面已标角标)',
				'chart', !brief.length);
		}
		{
			const ve = t.via_elements || {};
			const parts = ['fire', 'air', 'water', 'earth'].map((k)=>{
				const b = ve[k] || {};
				const nm = (VIA_LINE_ZH[k] || {}).n || k;
				if(!b.traceable){ return `${nm}:法官此行阴爻,不可由此寻`; }
				if(!b.through){ return `${nm}:断于${b.broken_at}`; }
				const tm = b.terminus || {};
				return `${nm}:至盾位${tm.position}(${VIA_SIDE_ZH[tm.side] || ''})`;
			});
			push('寻源四线', parts.join('；'),
				'由法官之阳爻上溯以探事之根源:火主目的意志、风主思想交流、水主感情灵性、土主结果物质;'
				+ '终于盾位一至四多关事主自身之行,终于五至八多关他人环境',
				'chart', !t.via_elements);
		}
		{
			const es = (t.element_supply || {}).elements || {};
			const parts = ['fire', 'air', 'water', 'earth'].map((k)=>{
				const b = es[k] || {};
				const nm = (VIA_LINE_ZH[k] || {}).n || k;
				return `${nm}${b.active_count}爻·${b.level === 'abundant' ? '充沛' : '匮乏'}`
					+ (b.supply ? `·${SUPPLY_ZH[b.supply]}` : '');
			});
			push('元素法', Object.keys(es).length ? parts.join('；') : '—',
				'四女各由四母同爻位构成,数其阳爻:三以上为相对充沛、二以下为匮乏。'
				+ '法官有此元素者以寻源法追之,得于我方为自给、于对方为借贷。⚠️元素有无与充沛与否皆非吉凶之判',
				'chart', !Object.keys(es).length);
		}
		{
			const gp = t.greek_points;
			push('福点灵点', gp
				? `福点第 ${gp.fortune_house} 宫(总 ${gp.fortune_total} 点)；灵点第 ${gp.spirit_house} 宫(阳爻 ${gp.spirit_total})`
				: '—',
				'福点取十二卦点数之和、灵点取十二卦阳爻数之和,各除十二取余入盘:福点主好运所在与身体财业,灵点主意志梦想欲求',
				'chart', !gp);
		}
		{
			const rp = t.reconciler_parity;
			push('宣判', rp
				? `补卦 ${fn(rp.figure)}(${rp.points} 点)·${RECON_PARITY_ZH[rp.code] || rp.code}`
				: '不取调和者',
				'第十六卦=一卦与法官相加,示所问之事最终如何影响当事人;并参其奇偶以断事之真假虚实',
				'chart', !rp);
		}
		// ── 随问类而定:只依赖问者宫↔所问宫,与本卦无关(实测固定问类下 300 盘取值种数恒为 1)──
		push('相位', `${ASP[t.aspect] || t.aspect || '无相位'}${ASPECT_TONE_ZH[t.aspect] && t.aspect !== 'none' ? `(${ASPECT_TONE_ZH[t.aspect]}相位)` : ''}`,
			'由问者宫与所问宫之宫距定:合/六分/刑/拱/冲。传本以六合、拱为吉相位,刑、冲为凶相位 —— 所描述者是过程之顺逆,非成败',
			'topic');
		{
			const tri = t.triplicities || [];
			const el = tri.length > 1 ? (TRI_EL[tri[0]] || '') : '';
			push('黄道宫三方', tri.length > 1 ? `宫 ${tri.join('/')}${el ? `(${el}三方)` : ''}` : '—',
				'所问宫与同三方之二宫同气相求,断事时并看。与「亲缘三元」非同一概念 —— 后者是盾牌生成之父·父→子',
				'topic', tri.length <= 1);
		}
		// [转宫] 以所选之宫为新命宫,按转宫式重算指示与完美 —— 问「他人之事」「事中之事」时用。
		const d = r.derived;
		const HOUSE_LABEL = ['一命', '二财', '三兄弟', '四田宅', '五子女', '六疾厄', '七夫妻', '八疾死', '九迁移', '十官禄', '十一福德', '十二玄秘'];
		return (
			<div className="horosa-geomancy-card">
				<div className="horosa-geomancy-card-title">解读技法</div>
				{/* 退化:问者宫与所问宫重合时,hc[q]==hc[t] 恒真 → 完美恒「入主」;宫距 0 → 相位恒「合」。
				    这是数学必然、不是本卦算得,不说清用户只会看到「怎么起盘都一样」而以为算坏了。
				    问自身(自订/生命与命运,主宫皆一)时此重合本属正当,故不是错,只是不具判别力。 */}
				{((r.settings || {}).indicators_coincide) ? (
					<div className="horosa-geomancy-coincide-note">
						问者宫与所问宫同为第 {(r.settings || {}).quesited_house || 1} 宫:二指示星取自同一图,
						完美恒「入主」、相位恒「合」,<strong>此二项此时不具判别力</strong>(问自身时本属正当)。
						欲断他事,请在左栏「所问宫」另选与所问主题相应之宫。
					</div>
				) : null}
				<div className="horosa-geomancy-summary horosa-geomancy-tech-list">
					{rows.filter((x)=>x.group === 'chart').map((x, i)=>(
						<div className={`horosa-geomancy-summary-row horosa-geomancy-tech-row${x.miss ? ' is-miss' : ''}`} key={`c${i}`}>
							<span>{x.label}</span>
							<strong>{x.value}{x.hint ? <em className="horosa-geomancy-tech-hint">{x.hint}</em> : null}</strong>
						</div>
					))}
				</div>
				{rows.some((x)=>x.group === 'topic') ? (
					<div className="horosa-geomancy-topic-group">
						<div className="horosa-geomancy-topic-title">
							随问类而定
							<em>只由问者宫↔所问宫之宫距/宫性决定,与本卦无关 —— 同一问类下恒同</em>
						</div>
						<div className="horosa-geomancy-summary horosa-geomancy-tech-list">
							{rows.filter((x)=>x.group === 'topic').map((x, i)=>(
								<div className={`horosa-geomancy-summary-row horosa-geomancy-tech-row${x.miss ? ' is-miss' : ''}`} key={`t${i}`}>
									<span>{x.label}</span>
									<strong>{x.value}{x.hint ? <em className="horosa-geomancy-tech-hint">{x.hint}</em> : null}</strong>
								</div>
							))}
						</div>
					</div>
				) : null}
				{/* [传本] 法庭三角详卡:三图带时间流(右证过去·法官现在·左证未来),论一段时间之吉凶则三等分 */}
				{t.court_verdict && t.time_flow ? (
					<div className="horosa-geomancy-court">
						<div className="horosa-geomancy-triads-title">法庭三角 · 时间流</div>
						<div className="horosa-geomancy-court-row">
							{[['past', 'right_witness', t.court_verdict.right],
								['present', 'judge', t.court_verdict.judge],
								['future', 'left_witness', t.court_verdict.left]].map(([slot, role, blk])=>(
								<div className={`horosa-geomancy-court-cell is-tone-${blk.tone_class}`} key={slot}>
									<div className="horosa-geomancy-court-when">{TIME_FLOW_ZH[role]}</div>
									<div className="horosa-geomancy-court-role">
										{role === 'judge' ? '法官' : (role === 'right_witness' ? '右证·事主' : '左证·条件环境')}
									</div>
									<div className="horosa-geomancy-court-fig">{fn(blk.figure)}<em>{TONE_CLASS_ZH[blk.tone_class]}</em></div>
								</div>
							))}
						</div>
						<div className="horosa-geomancy-court-verdict">
							{t.court_verdict.judge_special
								? <div><strong>{COURT_JUDGE_SPECIAL_ZH[t.court_verdict.judge_special]}</strong></div> : null}
							<div>{COURT_VERDICT_ZH[t.court_verdict.verdict_code] || t.court_verdict.verdict_code}</div>
						</div>
						<div className="horosa-geomancy-note-hint">
							论一段时间之状况吉凶,则将该时间三等分:右证第一段、法官第二段、左证第三段。
							此三角与盾位十六宫含义角度不同,勿合用。
						</div>
					</div>
				) : null}
				{/* [传本] 地占三角四组:底二卦为补充、顶卦为概括之果;含义两派并列由用户择取 */}
				{(t.shield_triangles || []).length ? (
					<div className="horosa-geomancy-triangles">
						<div className="horosa-geomancy-triads-title">
							地占三角(四组)
							<span className="horosa-geomancy-tri-school">
								{TRIANGLE_SCHOOLS.map((s)=>(
									<button
										type="button"
										key={s.key}
										className={this.state.triangleSchool === s.key ? 'is-active' : ''}
										onClick={()=>this.setState({ triangleSchool: s.key })}
									>{s.label}</button>
								))}
							</span>
						</div>
						{t.shield_triangles.map((g)=>(
							<div className="horosa-geomancy-triangle-row" key={g.index}>
								<span className="horosa-geomancy-triad-label">{`第${g.index}三角`}</span>
								<span className="horosa-geomancy-triad-expr">
									{g.base.map((b)=>(
										<em className={`is-tone-${b.tone_class}`} key={b.position}>{fn(b.figure)}</em>
									))}
									→ <strong className={`is-tone-${g.apex.tone_class}`}>{fn(g.apex.figure)}</strong>
								</span>
								<span className="horosa-geomancy-triangle-mean">
									{(TRIANGLE_MEANINGS[this.state.triangleSchool] || [])[g.index - 1]}
								</span>
							</div>
						))}
						<div className="horosa-geomancy-note-hint">
							静态以顶卦(甥)概括其果、底二卦为补充;动态则按时间流看过去现在未来。
						</div>
					</div>
				) : null}
				{/* [传本] 盾位十六宫含义:另一套判读角度,书明言不与法庭三角、地占三角合用 */}
				{(t.tenancy || []).length ? (
					<details className="horosa-geomancy-shield16">
						<summary>盾位十六宫 · 占断含义与得地</summary>
						<div className="horosa-geomancy-odu-notice">
							此为另一套判读角度 —— <strong>不要与法庭三角、地占三角合用,角度不同</strong>。
							十三宫加强一宫、十四宫加强十宫、十五宫加强七宫、十六宫加强四宫。
						</div>
						{t.tenancy.map((x)=>(
							<div className="horosa-geomancy-shield16-row" key={x.position}>
								<span className="horosa-geomancy-shield16-num">{`${x.position} ${x.label}`}</span>
								<span className="horosa-geomancy-shield16-fig">
									{x.figure ? fn(x.figure) : '—'}
									{x.grade ? (
										<em title={(TENANCY_GRADE_ZH[x.grade] || {}).d}>
											{`${TENANCY_GRADE_MARK[x.grade]} ${ELEMENT_ZH_BY_EN[x.figure_element]}入${ELEMENT_ZH_BY_EN[x.position_element]}·${(TENANCY_GRADE_ZH[x.grade] || {}).t}`}
										</em>
									) : null}
								</span>
								<span className="horosa-geomancy-shield16-mean">{SHIELD16_MEANINGS[x.position - 1]}</span>
							</div>
						))}
					</details>
				) : null}
				{/* [传本] 精准相位方向细则:联合之前后宫、传递之知晓格局、突变之场所线索 */}
				{t.perfection_direction && (t.perfection_direction.conjunctions_all || []).length
					+ (t.perfection_direction.knowledge_code ? 1 : 0)
					+ (t.perfection_direction.hint_code ? 1 : 0) > 0 ? (
						<div className="horosa-geomancy-perfdir">
							<div className="horosa-geomancy-triads-title">精准相位 · 方向细则</div>
							{(t.perfection_direction.conjunctions_all || []).map((c, i)=>(
								<div className="horosa-geomancy-summary-row" key={`cj${i}`}>
									<span>{c.mover === 'querent' ? '事主→对象' : '对象→事主'}</span>
									<strong>
										{`${fn(c.figure)}现于第 ${c.house} 宫(${PERF_DIRECTION_ZH[c.direction] || ''})`}
										<em className="horosa-geomancy-note-hint">{PERF_CONJ_ZH[c.direction]}</em>
									</strong>
								</div>
							))}
							{t.perfection_direction.knowledge_code ? (
								<div className="horosa-geomancy-summary-row">
									<span>传递知晓</span>
									<strong>{PERF_KNOWLEDGE_ZH[t.perfection_direction.knowledge_code]}</strong>
								</div>
							) : null}
							{t.perfection_direction.hint_code === 'venue_clue' ? (
								<div className="horosa-geomancy-summary-row">
									<span>突变线索</span>
									<strong>
										两图所落之宫即完成之法与地之线索
										<em className="horosa-geomancy-note-hint">偶然之意外事件使双方解决此事,非双方想象之完成方式</em>
									</strong>
								</div>
							) : null}
							{(t.perfection_direction.conjunctions_all || []).length > 1 ? (
								<div className="horosa-geomancy-note-hint">
									双方皆有联合:可由联合之多寡与卦形吉凶判何方付出多、起促进抑或反作用。
								</div>
							) : null}
						</div>
					) : null}
				{/* [传本] 行星地占盘落宫表(左栏开启该盘时出) */}
				{r.planetaryChart ? (
					<div className="horosa-geomancy-pchart-table">
						<div className="horosa-geomancy-triads-title">
							{`行星地占盘 · 上升 ${r.planetaryChart.asc_sign_zh}(首图 ${fn(r.planetaryChart.first_figure)})`}
						</div>
						{[].concat(r.planetaryChart.planets || [],
							r.planetaryChart.nodes ? [r.planetaryChart.nodes.north, r.planetaryChart.nodes.south] : [],
							r.planetaryChart.extras || []).map((p, i)=>(
							<div className="horosa-geomancy-summary-row" key={`pc${i}`}>
								<span>{p.planet_zh || p.planet}</span>
								<strong>
									{`第 ${p.house} 宫`}
									{p.draws ? <em className="horosa-geomancy-note-hint">{`报数 ${p.draws.join('+')} = ${p.total}`}</em> : null}
									{p.derived_from === 'north_opposite' ? <em className="horosa-geomancy-note-hint">取北交对宫</em> : null}
								</strong>
							</div>
						))}
					</div>
				) : null}
				{/* 亲缘三元:盘之生成即七组「父·父→子」,追某结论之来源即循此逐层上溯。
				    与黄道宫三方(火 1/5/9 等)是两回事,勿混。点某组即跳金字塔盘并高亮该组三节点与连线。 */}
				{(t.shield_triads || []).length ? (
					<div className="horosa-geomancy-triads">
						<div className="horosa-geomancy-triads-title">亲缘三元(父·父→子 · 七组)</div>
						{t.shield_triads.map((g, i)=>(
							<div className="horosa-geomancy-triad-row" key={i}
								onClick={()=>{ this.setCenterView('pyramid'); this.setState({ pyrSel: ['n0', 'n1', 'n2', 'n3', 'rw', 'lw', 'jd'][i] }); }}>
								<span className="horosa-geomancy-triad-label">{g.label}</span>
								<span className="horosa-geomancy-triad-expr">{(g.parents || []).map(fn).join(' ⊕ ')} = <strong>{fn(g.child)}</strong></span>
							</div>
						))}
					</div>
				) : null}
				<div className="horosa-geomancy-turn">
					<label className="horosa-geomancy-turn-field">
						<span>转宫(以某宫为新命宫)</span>
						<Select
							value={Number.isFinite(Number(this.state.turnTo)) ? Number(this.state.turnTo) : '__none__'}
							onChange={(v)=>this.setState({ turnTo: v === '__none__' ? null : Number(v) },
								()=>this.recastPinned())}
							dropdownMatchSelectWidth={false}
						>
							<Option value="__none__" key="__none__">不转(本命起)</Option>
							{HOUSE_LABEL.map((lb, i)=>(<Option value={i + 1} key={i + 1}>{`第 ${i + 1} 宫 · ${lb}`}</Option>))}
						</Select>
					</label>
					{d ? (
						<div className="horosa-geomancy-summary">
							<div className="horosa-geomancy-summary-row"><span>派生指示</span><strong>{`新命宫 ${d.derived_querent_house} → 所问宫 ${d.derived_quesited_house}`}</strong></div>
							<div className="horosa-geomancy-summary-row"><span>派生完美</span><strong>{PERF[d.perfection] || d.perfection}{d.perfection === 'none' && d.perfection_by_aspect ? `(借${ASP[d.perfection_by_aspect]}成局)` : ''}</strong></div>
							<div className="horosa-geomancy-summary-row"><span>派生相位</span><strong>{ASP[d.aspect] || d.aspect}</strong></div>
							{d.prohibition ? <div className="horosa-geomancy-summary-row"><span>派生阻碍</span><strong>{`第 ${d.prohibition} 宫`}</strong></div> : null}
							{d.figure ? <div className="horosa-geomancy-summary-row"><span>派生宫图</span><strong>{d.figure.nameZh || d.figure.nameEn}</strong></div> : null}
						</div>
					) : null}
				</div>
			</div>
		);
	}

	// [C4] 十六图 ↔ 十六主形 线形对照(静态)。中栏结构对照盘只在该流派下可见,此处让用户不切流派也能查。
	// ⚠️ 必带边界声明:独立圣传体系,仅结构同构对照,不套地占含义、不构成占断。
	renderOduTable(figures){
		const rows = (figures || []).filter((f)=>f && f.odu)
			.slice().sort((a, b)=>((a.odu.seniority || 99) - (b.odu.seniority || 99)));
		if(!rows.length){ return null; }
		return (
			<details className="horosa-geomancy-odu-table">
				<summary>十六图 ↔ 十六主形 · 线形对照</summary>
				<div className="horosa-geomancy-odu-notice">
					独立圣传体系,与地占仅十六个四行二元图形外形同构。此处仅作结构与比特对照,
					不套用地占含义、不构成该体系之占断。
				</div>
				<div className="horosa-geomancy-odu-grid">
					{rows.map((f)=>(
						<div className="horosa-geomancy-odu-cell" key={f.nameEn}>
							<span className="horosa-geomancy-odu-seniority">{f.odu.seniority}</span>
							<span className="horosa-geomancy-odu-marks">
								{(f.odu.marks || []).map((m, i)=>(
									<span className="horosa-geomancy-odu-markrow" key={i}>
										{m === 'I'
											? <span className="horosa-geomancy-fig-line" />
											: (<><span className="horosa-geomancy-fig-line is-half" /><span className="horosa-geomancy-fig-line is-half" /></>)}
									</span>
								))}
							</span>
							<span className="horosa-geomancy-odu-names">
								<strong>{f.odu.name}</strong>
								<em>{f.nameZh || f.nameEn}</em>
							</span>
						</div>
					))}
				</div>
			</details>
		);
	}

	// [判读流程] 九步 checklist:基准明言此流程可编码为状态机。每步显实际判定与是否成立,
	// 使判读有据可循、不致东看一眼西看一眼。
	renderFlowChecklist(r){
		const t = (r && r.technique) || {};
		if(!t || r.structuralOnly){ return null; }
		const PERF = { occupation: '入主成局', conjunction: '会合成局', mutation: '互变成局', translation: '传递成局', none: '未成局' };
		const ASP = { conjunction: '合', sextile: '六分(吉)', square: '刑(凶)', trine: '拱(吉)', opposition: '冲', none: '无相位' };
		const perfHit = t.perfection && t.perfection !== 'none';
		const d = t.perfection_detail || {};
		const comp = (t.company || []).filter((c)=>c.type && c.type !== 'none');
		const va = t.validity;
		const vaHits = ((va && va.rules) || []).filter((x)=>x.hit);
		const cv = t.court_verdict;
		const rp = t.reconciler_parity;
		const steps = [
			// 传本解卦六步之首:先看一宫定卦盘是否有效
			['验卦盘有效', vaHits.length
				? vaHits.map((x)=>VALIDITY_RULES_ZH[x.code] || x.code).join('；')
				: (va ? '五则皆过,卦盘可判' : '—'), !!va && !vaHits.length],
			['定主题之宫', `问类主宫 第 ${r.primaryHouse || '—'} 宫`, !!r.primaryHouse],
			['取两指示星', `问者 第 ${r.querentHouse || 1} 宫 · 所问 第 ${r.primaryHouse || '—'} 宫`, true],
			// 传本第二步:法庭三角总断吉凶方向
			['看法庭三角', cv
				? `${TONE_CLASS_ZH[cv.left.tone_class]}${TONE_CLASS_ZH[cv.judge.tone_class]}${TONE_CLASS_ZH[cv.right.tone_class]} → ${COURT_VERDICT_ZH[cv.verdict_code] || cv.verdict_code}`
				: '—', !!cv && cv.judge.tone_class !== 'bad'],
			['查完美', perfHit ? PERF[t.perfection] : (t.perfection_by_aspect ? `借相位(${ASP[t.perfection_by_aspect]})成局` : '未成局'), !!(perfHit || t.perfection_by_aspect)],
			['查阻碍', t.prohibition ? `第 ${t.prohibition} 宫强凶图阻断` : '无阻碍', !t.prohibition],
			['相位与同伴', `${ASP[t.aspect] || t.aspect}${comp.length ? `；同伴 ${comp.length} 对` : '；无同伴'}`, true],
			['吉凶动静(位置)', t.locus_quesited ? `所问落${t.locus_quesited.label}` : '—', t.locus_quesited ? t.locus_quesited.band !== 'unfortunate' : true],
			['自然共主', t.natural_cosignificator ? '月亮(判官属月亮系)' : '不涉', true],
			['点之路·点数', `${t.via_puncti ? (t.via_puncti.through ? '点之路贯通' : `断于${t.via_puncti.broken_at}`) : '—'}；${t.points_parity ? (t.points_parity.parity === 'even' ? '总点偶→是/稳' : '总点奇→否/动') : '—'}`, !!(t.via_puncti && t.via_puncti.through)],
			// 传本第六步:看第十六卦宣判 —— 按提示改变后之结果,并参其奇偶断真假虚实
			['看宣判(补卦)', rp
				? `${rp.figure}·${rp.parity === 'even' ? '偶→偏实' : '奇→偏虚'}`
				: '不取调和者', !!rp],
			['综合断', d.via_figure ? `经中介成局(${Array.isArray(d.via_figure) ? d.via_figure.join('、') : d.via_figure})` : (perfHit ? '直接成局' : '未见成局之路'), !!perfHit],
		];
		return (
			<div className="horosa-geomancy-card horosa-geomancy-flow">
				<div className="horosa-geomancy-card-title">{`判读流程 · ${steps.length}步`}</div>
				<ol className="horosa-geomancy-flow-list">
					{steps.map(([label, val, ok], i)=>(
						<li className={`horosa-geomancy-flow-step${ok ? ' is-ok' : ' is-no'}`} key={i}>
							<span className="horosa-geomancy-flow-idx">{i + 1}</span>
							<span className="horosa-geomancy-flow-label">{label}</span>
							<span className="horosa-geomancy-flow-val">{val}</span>
							<span className="horosa-geomancy-flow-mark">{ok ? '✔' : '✘'}</span>
						</li>
					))}
				</ol>
			</div>
		);
	}

	renderFigureCatalog(){
		const figures = (this.state.result && this.state.result.figures) || [];
		if(!figures.length){ return <div className="horosa-huangji-empty">起盘后显示 16 图形目录</div>; }
		return (
			<div className="horosa-geomancy-catalog-wrap">
			{this.renderOduTable(figures)}
			<div className="horosa-geomancy-catalog-grid">
				{figures.map((f, i)=>{
					const tone = { good: '吉', bad: '凶', neutral: '中' }[f.tone] || '';
					// 传本吉凶口径(tone_book)与本仓固有口径(tone)六图相异 —— 两口径并显,不相覆盖
					const toneBook = { good: '吉', bad: '凶', neutral: '中', weak_good: '弱吉' }[f.toneBook] || '';
					const line2 = [f.planetZh, f.elementZh, f.signZh].filter(Boolean).join(' · ');
					const line3 = [f.elementOuterZh ? `外元素${f.elementOuterZh}` : '', f.bodyPart ? `身体${f.bodyPart}` : '', f.color || ''].filter(Boolean).join(' · ');
					// 传本对应系统:稳定性三联(稳慢长/变快短)+ 奇偶主客观 + 卡巴拉源质 + 身体详表
					const zt = f.zodiacTriple || {};
					const line4 = [
						f.qualityBook ? `稳定性${STABILITY_ZH[f.qualityBook]}` : '',
						f.points ? PARITY_VIEW_ZH[f.points % 2 === 0 ? 'even' : 'odd'] : '',
						(f.kabbalah && f.kabbalah.length) ? `源质${f.kabbalah.join('·')}` : '',
					].filter(Boolean).join(' · ');
					return (
						<div className={`horosa-geomancy-catalog-card${f.tone ? ` is-tone-${f.tone}` : ''}`} key={f.nameEn || i}>
							<strong>{f.nameZh || f.latin || f.nameEn}{tone ? <span className="horosa-geomancy-catalog-tone">{tone}</span> : null}
								{toneBook && toneBook !== tone ? (
									<span className="horosa-geomancy-catalog-tone is-book" title="传本普遍吉凶性(与本仓固有口径相异者并显)">{`传${toneBook}`}</span>
								) : null}
							</strong>
							<em>{f.displayName || f.nameEn}{f.points ? ` · ${f.points}点` : ''}</em>
							{line2 ? <small>{line2}</small> : null}
							{line3 ? <small className="horosa-geomancy-catalog-astro">{line3}</small> : null}
							{line4 ? <small className="horosa-geomancy-catalog-corr">{line4}</small> : null}
							{f.bodyDetailZh ? <small className="horosa-geomancy-catalog-body">{`身体详:${f.bodyDetailZh}`}</small> : null}
							{f.keywordsZh ? <small>{f.keywordsZh}</small> : null}
							{/* 传本逐卦意象(整段):卦名之外另有物象与情境之喻,为解卦取象所本 */}
							{f.imageryZh ? (
								<details className="horosa-geomancy-catalog-more">
									<summary>传本意象</summary>
									<div className="horosa-geomancy-catalog-imagery">{f.imageryZh}</div>
								</details>
							) : null}
							{/* 三套黄道并显:古典定局 / 行星归属 / 行星归属·乙(另一传本表) */}
							{(zt.classical || zt.planetary || zt.planetaryAlt) ? (
								<small className="horosa-geomancy-catalog-zodiac">
									{[zt.classical ? `古典${zt.classical.zh}` : '',
										zt.planetary ? `行星${zt.planetary.zh}` : '',
										zt.planetaryAlt ? `行星乙${zt.planetaryAlt.zh}` : ''].filter(Boolean).join('　')}
								</small>
							) : null}
							{f.meanings ? <small className="horosa-geomancy-catalog-mean">爱情{f.meanings['爱情']} · 财{f.meanings['财富']} · 业{f.meanings['事业']}</small> : null}
							{/* 十域全表:此前只内联三域,另七域数据在册却不显 —— 展开即见,不必另开页 */}
							{f.meanings ? (
								<details className="horosa-geomancy-catalog-more">
									<summary>十域全表</summary>
									<div className="horosa-geomancy-catalog-domains">
										{CATALOG_DOMAINS.map((k)=>(f.meanings[k] ? (
											<div className="horosa-geomancy-catalog-domain" key={k}><span>{k}</span><strong>{f.meanings[k]}</strong></div>
										) : null))}
										{f.meanings.tone_detail ? <div className="horosa-geomancy-catalog-domain"><span>吉凶</span><strong>{f.meanings.tone_detail}</strong></div> : null}
									</div>
								</details>
							) : null}
							{this.state.showUnicodeGlyph && f.unicode ? (
								<small className="horosa-geomancy-catalog-uni" title="Unicode 码位字形(需系统装有对应字体)">{f.unicode}</small>
							) : null}
							{/* 东传一路:该图所主之曜与星座宫位之该支名(引擎叠加层,纯显示不改判读) */}
							{f.vedic && f.vedic.graha_zh ? (
								<small className="horosa-geomancy-catalog-vedic">
									{`${f.vedic.graha_zh}(${f.vedic.graha_sanskrit})${f.vedic.rashi ? ` · ${f.vedic.rashi}` : ''}`}
								</small>
							) : null}
							{(f.isPalindrome || (f.activeElements && f.activeElements.count >= 0)) ? (
								<small className="horosa-geomancy-catalog-struct">
									{[f.isPalindrome ? '自逆转' : '',
										f.activeElements ? `在场:${(f.activeElements.zh || []).join('') || '无'}` : ''].filter(Boolean).join('　')}
								</small>
							) : null}
							{(f.number || f.directionCompass) ? (
								<small className="horosa-geomancy-catalog-num">
									{[f.number ? `图数${f.number.value}(${{ points: '点数', planetary: '行星序', abjad: '字母值' }[f.number.system] || f.number.system})` : '',
										f.directionCompass ? `方位${f.directionCompass}` : ''].filter(Boolean).join('　')}
								</small>
							) : null}
							{/* 图形关系六式(传本明言「与解卦无关,只为理解十六卦之内在关系」)*/}
							{(f.oppositeOf || f.reverseOf || f.inverseOf || f.converseOf || f.rotateOf) ? (
								<small className="horosa-geomancy-catalog-rel" title="与解卦无关,只为理解十六卦之内在关系">
									{[f.oppositeOf ? `对:${f.oppositeOf}` : '',
										f.reverseOf ? `倒:${f.reverseOf}` : '',
										f.inverseOf ? `逆:${f.inverseOf}` : '',
										f.converseOf ? `倒逆:${f.converseOf}` : '',
										f.rotateOf ? `减:${f.rotateOf}` : ''].filter(Boolean).join('　')}
								</small>
							) : null}
							{(f.nameArabic || f.nameGreek || f.nameHebrew || f.nameYoruba || f.odu) ? (
								<small className="horosa-geomancy-catalog-alt">
									{[f.nameArabic ? `阿:${f.nameArabic}` : '', f.nameArabicScript ? `(${f.nameArabicScript})` : '',
										f.nameGreek ? `希:${f.nameGreek}` : '', f.nameHebrew ? `伯:${f.nameHebrew}` : '',
										f.nameYoruba ? `约:${f.nameYoruba}` : '',
										f.odu ? `主形:${f.odu.name}` : ''].filter(Boolean).join('　')}
								</small>
							) : null}
						</div>
					);
				})}
			</div>
			</div>
		);
	}

	renderHistory(){
		const history = this.state.history || [];
		if(!history.length){ return <div className="horosa-huangji-empty">暂无历史记录</div>; }
		return (
			<div className="horosa-geomancy-history-list">
				{history.map((h, i)=>(
					<button type="button" className="horosa-geomancy-history-row" key={`${h.ts}_${i}`} onClick={()=>this.applyHistory(h)}>
						<span className="horosa-geomancy-history-q">{h.question || '（无问题）'}</span>
						<span className="horosa-geomancy-history-meta">{h.questionTypeZh || ''} · 判官{h.judge || '—'}</span>
					</button>
				))}
			</div>
		);
	}

	renderRightPanel(){
		return (
			<Tabs size="small" activeKey={this.state.rightPanelTab} onChange={this.setRightPanelTab} className="horosa-geomancy-aux horosa-cnx-aux">
				<TabPane tab="解读" key="reading">{this.renderReading()}</TabPane>
				<TabPane tab="判断" key="judgement">{this.renderJudgementTab()}</TabPane>
				<TabPane tab="十二宫" key="houses">{this.renderHousesTab()}</TabPane>
				<TabPane tab="十六图形" key="figures">{this.renderFigureCatalog()}</TabPane>
				<TabPane tab="历史" key="history">{this.renderHistory()}</TabPane>
			</Tabs>
		);
	}

	// 快捷栏契约:右栏 tab 镜像撤除;快捷栏只放本页没有的动词,配置由 cnyibu 容器透传渲染。护盾/宫盘切换中栏已有,不进栏。
	getQuickDockConfig(){
		return {
			hasResult: !!this.state.result,
			primary: { key: 'cast', label: '起盘', onClick: ()=>this.clickCast() },
			save: ()=>this.clickSaveCase(),
		};
	}

	renderBottomQuickDock(){
		return (
			<QuickDockBar
				page="geomancy"
				className="horosa-huangji-quick-dock horosa-geomancy-quick-dock"
				dispatch={this.props.dispatch}
				{...this.getQuickDockConfig()}
			/>
		);
	}

	render(){
		const embedded = !!this.props.hideQuickDock;
		let height = this.props.height ? this.props.height : 760;
		let pageStyle = { height, minHeight: height, overflow: 'hidden' };
		if(embedded){
			pageStyle = { height: '100%', minHeight: 0, overflow: 'hidden' };
		}else if(height === '100%'){
			height = 760;
			pageStyle = { height, minHeight: height, overflow: 'hidden' };
		}else{
			height = height - 20;
			pageStyle = { height, minHeight: height, overflow: 'hidden' };
		}
		return (
			<TechniqueErrorBoundary label="天文地占">
			<div className={`horosa-huangji-page horosa-astro-redesign horosa-huangji-redesign horosa-geomancy-redesign${embedded ? ' horosa-huangji-embedded' : ''}`} style={pageStyle}>
				<div className="horosa-astro-layout horosa-astro-redesign-layout horosa-huangji-redesign-layout">
					<Spin spinning={this.state.loading}>
						<div className="horosa-astro-redesign-grid horosa-huangji-redesign-grid">
							<div className="horosa-astro-context-panel horosa-astro-input-panel horosa-huangji-input-panel">
								{this.renderInputPanel()}
							</div>
							<div className="horosa-chart-stage horosa-chart-stage-redesign horosa-huangji-chart-panel xq-chart-renderer">
								<div className="horosa-huangji-board-host">{this.renderCenter()}</div>
							</div>
							<div className="horosa-inspector-panel horosa-astro-content-panel horosa-huangji-info-panel">
								<div className="horosa-side-panel-heading horosa-huangji-info-heading-main">
									<div>
										<div className="horosa-side-panel-title">地占信息</div>
										<div className="horosa-side-panel-subtitle">判官、宫位与图形</div>
									</div>
								</div>
								{this.renderRightPanel()}
							</div>
						</div>
					</Spin>
					{!this.props.hideQuickDock && this.renderBottomQuickDock()}
				</div>
			</div>
			</TechniqueErrorBoundary>
		);
	}
}

export default GeomancyMain;
