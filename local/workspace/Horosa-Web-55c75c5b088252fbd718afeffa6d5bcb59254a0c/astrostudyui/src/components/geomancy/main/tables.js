// 地占页常量:符号、细分设置字段、各传本多边形与目录、问事 / 起卦 / 流派选项与判读中文表、页面设置与盘面设计尺寸
// 从 GeomancyMain.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { getSignSymbol } from '../../astro/IndiaSouthChart';
import { GEOMANCY_HISTORY_MAX } from '../geomancyHistory';
import { definePageSettings } from '../../../utils/pageSettingsStore';
import { PCHART_ZODIAC_OPTIONS } from '../geomancyOptions';

// 英文星座名 → 1-12,取我方 ywastro 星座符(与印度盘同一套 glyph,设计语言统一)。
const SIGN_EN_TO_NUM = {
	Aries: 1, Taurus: 2, Gemini: 3, Cancer: 4, Leo: 5, Virgo: 6,
	Libra: 7, Scorpio: 8, Sagittarius: 9, Capricorn: 10, Aquarius: 11, Pisces: 12,
};
export function signGlyph(signEn){
	const num = SIGN_EN_TO_NUM[signEn];
	return num ? getSignSymbol(num) : '';
}
// 行星 → 我方 ywastro 字形(与主星盘同套:A日 B月 C水 D金 E火 F木 G土 K北交 L南交)。
export const PLANET_GLYPH_BY_ZH = {
	'太阳': 'A', '月亮': 'B', '水星': 'C', '金星': 'D', '火星': 'E', '木星': 'F', '土星': 'G',
	'天王星': 'H', '海王星': 'I', '冥王星': 'J',
	'龙头': 'K', '北交': 'K', '北交点': 'K', '罗睺': 'K',
	'龙尾': 'L', '南交': 'L', '南交点': 'L', '计都': 'L',
};
// 落星层用:引擎行星键(英文)→ 同一套 ywastro 字形,避免 Unicode 字形在暗底缺笔/走形。
export const PLANET_GLYPH_BY_EN = {
	Sun: 'A', Moon: 'B', Mercury: 'C', Venus: 'D', Mars: 'E', Jupiter: 'F', Saturn: 'G',
	NorthNode: 'K', SouthNode: 'L',
};
// [高级传本] 逐项改写字段表。key=请求参数名(驼峰,后端已收);backendKey=后端回传 settings 里的键(蛇形)。
// 每项都可「跟随预设」——不发该参,由后端回落所选流派默认 = 字节零回归。
export const GRANULAR_FIELDS = [
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
export const MALAGASY_NAMES = [
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
export const NORTH_POLYGONS = {
	1: '50,0 75,25 50,50 25,25', 2: '0,0 50,0 25,25', 3: '0,0 25,25 0,50',
	4: '0,50 25,25 50,50 25,75', 5: '0,50 25,75 0,100', 6: '0,100 25,75 50,100',
	7: '50,100 25,75 50,50 75,75', 8: '50,100 75,75 100,100', 9: '100,100 75,75 100,50',
	10: '100,50 75,75 50,50 75,25', 11: '100,50 75,25 100,0', 12: '100,0 75,25 50,0',
};

// [中世纪式] 外方+内方(25–75)+菱形(接边中点、过内方四角)+内外角连线 → 十二格。
// 四菱形三角(上下左右)+ 八角部三角(四角各被其连线一分为二);宫一居左,循逆时针下行。
export const MEDIEVAL_POLYGONS = {
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
export const CATALOG_DOMAINS = ['总性', '爱情', '财富', '事业', '健康', '诉讼', '旅行', '失物', '是否', '时机'];

// 十六图形格位标签(row-major:四母→四女→四甥→左右见证+判官+调和者),与引擎 figures_16 同序。
export const FIGURE_SLOTS = ['母一', '母二', '母三', '母四', '女一', '女二', '女三', '女四', '甥一', '甥二', '甥三', '甥四', '右见证', '左见证', '判官', '调和者'];
export const FIGURE_GROUPS = [
	{ label: '四母', span: [0, 4] },
	{ label: '四女', span: [4, 8] },
	{ label: '四甥', span: [8, 12] },
	{ label: '见证·判官', span: [12, 16] },
];

// 点数取样范围中文名(技法卡与 AI 快照同用,免两处口径分岔)
export const PARITY_SCOPE_ZH = { shield16: '全盘十六图', mothers: '四母', houses12: '十二宫' };

export const HISTORY_KEY = 'horosaGeomancyHistory';
export const HISTORY_MAX = GEOMANCY_HISTORY_MAX;
// 时地改动的静默期:时间面板选年/选月/选日各吐一拍,合并成一次重算(逐拍打后端既慢又白费)。
export const RECAST_DEBOUNCE_MS = 260;

// 问题类型(11 类;简体)。后端 reading 也回传 questionTypes 可同步覆盖。
export const QUESTION_TYPE_OPTIONS = [
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

// 问类显示名:后端给了中文名用后端的,没给(自订问题不回中文名)按本表取,不把程序键名直接显示出来。
export function questionTypeText(zh, key){
	if(zh){ return zh; }
	const hit = QUESTION_TYPE_OPTIONS.find((item) => item.key === key);
	return hit ? hit.short : (key || '—');
}

// 所问宫十二项 —— **判读的真值源**(档名在 geomancyOptions.js,与 AI 挂载齿轮同一份)。问类只是快捷预设。
// 🔴 此前所问宫只能由问类查表得出,而表里 custom→1、life→1 与问者宫(恒一)撞车,
//    q==t 使完美恒「入主」、相位恒「合」;前端默认问类正是 custom,故开箱即坏。
// 问类 → 预设所问宫(与引擎 question_house 表同源;改此处须同改引擎数据)
export const QUESTION_TYPE_HOUSE = {
	life: 1, health: 6, wealth: 2, marriage: 7, career: 10, children: 5,
	journey: 9, religion: 9, enemy: 7, death: 8, custom: 1,
};

// 起卦法。传本所载报数、点点、抛硬币、掷骰子诸法俱以奇偶定爻;皮肤四法用同一确定性随机源、
// 只在称名与记号上有别,报数法则真收十六个数(奇=单点/偶=双点)。
export const SEED_MODE_OPTIONS = [
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
export const CAST_SKIN_MODES = ['dice', 'coins', 'sand', 'tablets'];

// 时间起卦确定性种子:取起卦时间(精确到分)的年月日时分拼成一个稳定 int(0..2147483647)。
// 同一分钟内重复起卦 → 同种子 → 同盘(可复现);不同时刻 → 不同种子。
// 喂给后端 timeSeed,后端按其取值优先级落定 effective_seed 并回传,避免退化真随机。
// [自由起盘] 传入左栏所选时间的 fields(date/time)则按其算种子;缺省回退当前系统时间。
export function computeTimeSeed(fields){
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
export const TRADITION_OPTIONS = [
	{ key: 'european_classical', label: '古典定局派', short: '古典' },
	{ key: 'european_planetary', label: '行星共鸣派', short: '共鸣' },
	// 现代综合派引擎口径与古典定局同(traditions 仅 id/label 异);label 如实标注,不臆造分歧。
	{ key: 'european_modern', label: '现代综合派(判读同古典口径)', short: '现代' },
	{ key: 'arabic_raml', label: '阿拉伯沙占派', short: '沙占' },
	{ key: 'india_ramal', label: '印度骰占派', short: '骰占' },
	{ key: 'sikidy', label: '异或表盘(Sikidy)', short: '异或' },
	{ key: 'hakata', label: '四片盘(Hakata)', short: '四片盘' },
];
// 后端 PROFILES 另有两档(起盘后由 result.traditions 覆盖上表)。
// 🔴 此表**只备短名、不进可选集** —— 起盘前少几项是既有约定(帮助文档已明文),不可由此悄悄改变。
export const TRADITION_SHORT_EXTRA = { greek: '希腊', ifa: '结构' };
// 后端独有两档的全名(与引擎 profiles 表同文,合同测试 geomancyTraditionLabels 锁):恢复了这两档的保存值、又还没起过盘时,
// 下拉此前只能显示原始 id(greek / ifa)—— 静态候选集不因此扩大(起盘前少几项仍是既有约定),只给当前值补一条带中文名的项。
export const TRADITION_EXTRA_LABELS = { greek: '希腊拜占庭派', ifa: '西非同族对照' };
export const READING_SCOPE_OPTIONS = [
	{ key: 'L0', label: 'L0 仅判官', short: 'L0' },
	{ key: 'L1', label: 'L1 三图(证·判)', short: 'L1' },
	{ key: 'L2', label: 'L2 盾牌全局', short: 'L2' },
	{ key: 'L3', label: 'L3 十二宫(默认)', short: 'L3' },
	{ key: 'L4', label: 'L4 占星定局', short: 'L4' },
];
export const ZODIAC_SYSTEM_OPTIONS = [
	{ key: 'classical', label: '古典定局体系', short: '古典' },
	{ key: 'planetary', label: '行星归属体系', short: '行星' },
	// 第三套:另一传本之行星归属对应表,与上者恰五图相异(损失/获得/快乐/女子/龙首)
	{ key: 'planetary_alt', label: '行星归属·乙(另一传本表)', short: '行星乙' },
];
// [行星地占盘] 上升所用之星座对应表二式

// ── 传本判语文案(内核只出代码、文案在此,免两处口径分岔;AI 快照同源复用)──
// 法庭三角:左证·法官·右证 三图吉凶之断。
// 🔴 传本首行「吉吉吉」结构上不可达(法官=二证异或,吉图同奇偶两两相配之和恒非吉图,全 16⁴ 穷举实证),
//    故留表以存原貌,界面不宣称其可得。
export const COURT_VERDICT_ZH = {
	all_good: '吉,自天佑之,吉无不利',
	end_good_delay: '终吉,但会延迟或出问题',
	end_good_hard: '终吉,但漫长曲折或事倍功半',
	gain_not_self: '求而可得,非利于己,行道偏欹',
	no_success_has_end: '无成有终',
	well_unused: '井渫不食,为我心恻,可用汲,受福',
	all_bad: '凶',
	unlisted: '传本表未载此组合,当具体分析',
};
export const COURT_JUDGE_SPECIAL_ZH = {
	via: '法官为道路:事情变化剧烈、彻底转变',
	populus: '法官为群众:还是原样、影响因素过多',
};
export const TONE_CLASS_ZH = { good: '吉', bad: '凶', mid: '中' };
// 成败八格(有无精准相位 × 两指示图吉凶)
export const SUCCESS_ZH = {
	occur_both_good: '事件发生,双方都好', occur_querent_better: '事件发生,事主更好',
	occur_quesited_better: '事件发生,对象更好', occur_both_bad: '事件发生,双方都不好',
	fail_both_good: '事件不发生,双方都好', fail_querent_better: '事件不发生,事主更好',
	fail_quesited_better: '事件不发生,对象更好', fail_both_bad: '事件不发生,双方都不好',
	not_covered: '传本表只列吉凶两态,此局有「中」图,当具体分析',
};
// 有效性五则
export const VALIDITY_RULES_ZH = {
	not_asked_or_decided: '首图龙尾:此事不问,或事主已自决',
	deceit: '首图红色:自欺、隐瞒、有意欺骗',
	deceive_quesited: '首图红色且两指示卦有精准相位:事主有意欺骗对象',
	insufficient_info: '首图失去:信息不足',
	question_not_real: '首图群众:所问非事主真实之问,宜重新提问',
	false_question: '一宫群众并十一宫红色:问题虚假,宜重新提问',
};
export const VALIDITY_LABELS = ['一 龙尾', '二 红色', '三 失去', '四 群众', '五 盘式'];
// 得地四档
export const TENANCY_GRADE_ZH = {
	full: { t: '最强', d: '卦与位元素全同,此位最强,能全展此卦之力' },
	assist: { t: '辅助', d: '温度同而湿度异,作补充辅助而现,目标随时而移' },
	stall: { t: '停滞', d: '湿度同而温度异,平衡而稳致行动停滞,他日有增长之潜力,须释放或引外力' },
	weak: { t: '无力', d: '全不相同,于此位无力,不能(或不欲)完成其任' },
};
export const TENANCY_GRADE_MARK = { full: '◎', assist: '○', stall: '◇', weak: '✕' };
export const ELEMENT_ZH_BY_EN = { Fire: '火', Air: '风', Water: '水', Earth: '土' };
// 寻源四线之义
export const VIA_LINE_ZH = {
	fire: { n: '火', d: '目的、目标、渴望、指引、意志' },
	air: { n: '风', d: '交流、创造、思想、主意、逻辑、理论' },
	water: { n: '水', d: '感情、情绪、灵性层面' },
	earth: { n: '土', d: '结果、物质层面、隐藏、财富' },
};
export const VIA_SIDE_ZH = { self: '我方(个人宫位)', other: '对方(人际宫位)' };
export const SUPPLY_ZH = { self_supplied: '元素自给', borrowed: '元素借贷' };
export const ELEMENT_LEVEL_ZH = { abundant: '相对充沛(阳爻三以上)', scarce: '相对匮乏(阳爻二以下)' };
// 精准相位方向细则
export const PERF_DIRECTION_ZH = { forward: '前宫', backward: '后宫' };
export const PERF_KNOWLEDGE_ZH = {
	third_party_hidden: '事主后宫与对象后宫传递:第三方背后做事',
	quesited_knows: '事主后宫与对象前宫传递:对象知晓第三方',
	querent_knows: '事主前宫与对象后宫传递:事主知晓第三方',
	both_know: '事主前宫与对象前宫传递:双方知晓第三方',
};
export const PERF_CONJ_ZH = {
	backward: '联合于对方后宫:其功成于对方背后,用对方不解之知',
	forward: '联合于对方台面(前宫):用通识之知,或双方已有协议认可',
};
// 宣判(补卦)奇偶
export const RECON_PARITY_ZH = {
	objective_real: '偶数卦:客观事实、外在 → 事偏于实',
	subjective_virtual: '奇数卦:主观意志、内在 → 事偏于虚',
};
// 稳定性三联 与 奇偶主客观(传本对应系统)
export const STABILITY_ZH = { stable: '稳·慢·长', mobile: '变·快·短' };
export const PARITY_VIEW_ZH = { odd: '奇数卦:主观意志、内在', even: '偶数卦:客观事实、外在' };
// 相位吉凶(传本:吉相位六合、拱;凶相位刑、冲)
export const ASPECT_TONE_ZH = {
	sextile: '吉', trine: '吉', square: '凶', opposition: '凶', conjunction: '中', none: '—',
};
// 地占三角四组含义两派
export const TRIANGLE_SCHOOLS = [
	{ key: 'recent', label: '近代传本' },
	{ key: 'renaissance', label: '弗卢德古本' },
];
export const TRIANGLE_MEANINGS = {
	recent: ['事主当下的自我状况和条件状况', '事件目前情况,或对象状态',
		'事主所处环境状况,或问题中环境地点', '事主生命中他人的互动、相互作用,或问题中其他人的状态'],
	renaissance: ['事主当下的自我状况和条件状况', '事主未来的自我状况和条件状况',
		'事主当下环境状况,或对象当下状态', '环境或对象未来的发展状况'],
};
// 盾十六位之占断含义(传本另立一套,书明言「不要与法庭三角、地占三角合用,角度不同」)
export const SHIELD16_MEANINGS = [
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
export const TIME_FLOW_ZH = { right_witness: '过去', judge: '现在', left_witness: '未来' };
// 真实星历盘所用之象限宫制(引擎回传键 → 中文名)。只此一家:列宫制全纬度有解,故无极区备用之法。
export const QUADRANT_SYSTEM_ZH = { regiomontanus: '列宫制' };
// 度分记法:12.5 → 12°30′。真实盘之上升与宫头唯此式带度数,故专置一处免各处各写一遍。
export function fmtDegMin(v){
	if(typeof v !== 'number' || !Number.isFinite(v)){ return '—'; }
	const d = Math.floor(v);
	let m = Math.round((v - d) * 60);
	// 59.6′ 四舍五入成 60′ 必须进位,否则出「12°60′」这种不存在的写法
	return m >= 60 ? `${d + 1}°00′` : `${d}°${String(m).padStart(2, '0')}′`;
}

// 排盘设置跨会话保留(用户实报:排盘设置改了之后每次重开软件都要重设)。只收口径与显示偏好:
// 起卦法 / 流派预设 / 读取范围 / 黄道体系 / 高级传本逐项覆盖 / 行星地占盘四项 / 字形叠加。
// 所问、问类、所问宫、手工种子、报数、转宫是每一卦的输入;中栏视图有「未亲手切过则自动切换」的逻辑,都不进。
// 逐项覆盖(granular)是稀疏覆盖层:只存用户显式改过的项,没改过 = 库里没有 = 不发给后端(跟随流派预设)。
// 流派候选可能由后端下发(随内核增减),只校验类型与长度。事盘回灌走 setState,不经这些 handler。
// 载入存档后的起卦法:存档记下的 castMethod(你当时实际用的起卦法)优先;报数另由十六数判;
// 没记的旧档按存档的 seedMode,再缺按当前。
export function restoredGeomancySeedMode(options, current){
	const o = options || {};
	const known = (k)=>SEED_MODE_OPTIONS.some((it)=>it.key === k);
	if(o.castMethod && o.castMethod !== 'numbers' && known(o.castMethod)){ return o.castMethod; }
	return o.seedMode || current;
}

export const GEOMANCY_PAGE_SETTINGS = definePageSettings('horosa.geomancy.settings.v1', {
	// 「手工指定种子 / 报数起卦」离不开逐卦输入(种子 / 十六个数,不保留):只留法不留数,重开后种子是 0、报数是空的 ——
	// 前者每次都起同一卦,后者一点起盘就报错。这两法不进候选(选了照常用,只是不记;库里仍是上一次选的独立起卦法)。
	seedMode: { def: 'random', oneOf: SEED_MODE_OPTIONS.map((o)=>o.key).filter((k)=>k !== 'manual' && k !== 'numbers') },
	tradition: { def: 'european_classical', type: 'string', maxLen: 48 },
	readingScope: { def: 'L3', oneOf: READING_SCOPE_OPTIONS.map((o)=>o.key) },
	zodiacSystem: { def: 'classical', oneOf: ZODIAC_SYSTEM_OPTIONS.map((o)=>o.key) },
	granular: { type: 'map', sparse: true, keys: GRANULAR_FIELDS.reduce((acc, f)=>{
		// 布尔型的项(f.bool):下拉里的键是字符串 'true' / 'false',但 state 里存的是**真布尔值** —— schema 按 state 的形态来
		acc[f.key] = f.bool ? { def: false } : { def: '', oneOf: (f.options || []).map((o)=>o.key) };
		return acc;
	}, {}) },
	planetaryChart: { label: '另起行星地占盘', def: false },
	planetaryChartZodiac: { label: '星座对应表', def: 'classical', oneOf: PCHART_ZODIAC_OPTIONS.map((o)=>o.key) },
	planetaryChartNodes: { label: '加北交·南交(南交取对宫)', def: false },
	planetaryChartExtras: { label: '加月孛·三王星', def: false },
	showUnicodeGlyph: { label: '并显 Unicode 字形', def: false },
	triangleSchool: { label: '地占三角含义流派', def: 'recent', oneOf: TRIANGLE_SCHOOLS.map((o)=>o.key) },   // 右栏「地占三角」含义取哪一派(显示偏好)
});
export function savedGeomancySettings(){
	return GEOMANCY_PAGE_SETTINGS.load();
}

// 方形宫盘 / 两式方盘的设计尺寸(布局 px):低于它时按它排版再等比缩小(XQDesignScaleBox)。
// 方形宫盘是按可用高定边长的正方网格(格 overflow:hidden):取「四行格里的图名 / 宫号 / 点阵整段放得下」的最小边长(真内核实测 620 起零裁切),
// 设计高 = 边长 + 标题与间距;两式方盘(北印度式 / 中世纪盘)取「每宫的宫号 / 星座 / 点阵 / 图名整段落在本宫多边形里」的最小边长
// (真内核六次起卦实测:680 起最坏越界 0.3px,660 越界 2px、640 越界 4px —— 盘内字号是定值,边长再小字就压到分宫线上)。
// 设计高 = 边长 + 盘名一行(21)与行距(12):盘是「高取满、按一比一反推宽」的,设计高多给一截缩放态里盘就被拉成竖长方(分宫线跟着变形)。
export const GEOMANCY_BOARD_TITLE_ROW = 33;
export const GEOMANCY_SQUARE_DESIGN_W = 640;
export const GEOMANCY_SQUARE_DESIGN_H = GEOMANCY_SQUARE_DESIGN_W + GEOMANCY_BOARD_TITLE_ROW;
export const GEOMANCY_POLY_DESIGN_W = 680;
export const GEOMANCY_POLY_DESIGN_H = GEOMANCY_POLY_DESIGN_W + GEOMANCY_BOARD_TITLE_ROW;
