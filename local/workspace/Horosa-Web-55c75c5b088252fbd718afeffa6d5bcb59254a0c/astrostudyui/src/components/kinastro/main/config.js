// KinAstro 一身多技法的技法配置表与盘面常量(地支 / 天干 / 四化 / 宫位布局 / 策天页签段)
// 从 KinAstroMain.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。

export const TECHNIQUE_CONFIG = {
	shaozi: {
		pageTitle: '数算',
		infoTitle: '数算信息',
		infoSubTitle: '邵子、铁板、鬼谷与条文',
		serviceKey: 'shaozi',
		moduleKey: 'shusuan',
		techniqueLabel: '邵子神数',
		showRail: true,
		tabs: [
			{ key: 'overview', label: '概览' },
			{ key: 'pillars', label: '四柱' },
			{ key: 'digits', label: '起数' },
			{ key: 'text', label: '条文' },
		],
	},
	tieban: {
		pageTitle: '数算',
		infoTitle: '数算信息',
		infoSubTitle: '铁板神数、扣入法与算盘打数',
		serviceKey: 'tieban',
		moduleKey: 'shusuan',
		techniqueLabel: '铁板神数',
		showRail: true,
		tabs: [
			{ key: 'overview', label: '概览' },
			{ key: 'pillars', label: '四柱' },
			{ key: 'core', label: '核心' },
			{ key: 'palaces', label: '宫位' },
			{ key: 'verses', label: '条文' },
			{ key: 'dayun', label: '大运' },
			{ key: 'framework', label: '框架' },
		],
	},
	fendjing: {
		pageTitle: '数算',
		infoTitle: '数算信息',
		infoSubTitle: '鬼谷分定经、两头钳与古文断语',
		serviceKey: 'fendjing',
		moduleKey: 'shusuan',
		techniqueLabel: '鬼谷分定经',
		showRail: true,
		tabs: [
			{ key: 'overview', label: '概览' },
			{ key: 'pillars', label: '四柱' },
			{ key: 'twoGan', label: '两头钳' },
			{ key: 'fate', label: '命格' },
			{ key: 'verses', label: '断语' },
		],
	},
	beiji: {
		pageTitle: '数算',
		infoTitle: '数算信息',
		infoSubTitle: '北极神数、刻分与条文',
		serviceKey: 'beiji',
		moduleKey: 'shusuan',
		techniqueLabel: '北极神数',
		showRail: true,
		tabs: [
			{ key: 'overview', label: '概览' },
			{ key: 'yearHour', label: '年时' },
			{ key: 'queries', label: '条文' },
			{ key: 'search', label: '检索' },
			{ key: 'family', label: '家亲' },
			{ key: 'fortune', label: '财官' },
			{ key: 'dayun', label: '大运' },
		],
	},
	nanji: {
		pageTitle: '数算',
		infoTitle: '数算信息',
		infoSubTitle: '南极神数、宫部与条文',
		serviceKey: 'nanji',
		moduleKey: 'shusuan',
		techniqueLabel: '南极神数',
		showRail: true,
		tabs: [
			{ key: 'overview', label: '概览' },
			{ key: 'pillars', label: '四柱' },
			{ key: 'palaceText', label: '宫部' },
			{ key: 'queryText', label: '查询' },
			{ key: 'dayun', label: '大运' },
			{ key: 'password', label: '密码' },
			{ key: 'divine', label: '星图' },
		],
	},
	chunzi: {
		pageTitle: '数算',
		infoTitle: '数算信息',
		infoSubTitle: '蠢子数、宿度与诗词候选',
		serviceKey: 'chunzi',
		moduleKey: 'shusuan',
		techniqueLabel: '蠢子数',
		showRail: true,
		tabs: [
			{ key: 'overview', label: '概览' },
			{ key: 'pillars', label: '四柱' },
			{ key: 'codes', label: '代码' },
			{ key: 'analysis', label: '解析' },
			{ key: 'candidates', label: '候选' },
			{ key: 'lookup', label: '查询' },
			{ key: 'search', label: '检索' },
		],
	},
	canping: {
		pageTitle: '数算',
		infoTitle: '数算信息',
		infoSubTitle: '邵子参评数、金锁银匙与条文',
		serviceKey: 'canping',
		moduleKey: 'shusuan',
		techniqueLabel: '邵子参评数',
		native: true,
		showRail: true,
		tabs: [],
	},
	heluo: {
		pageTitle: '数算',
		infoTitle: '数算信息',
		infoSubTitle: '河洛理数、先后天卦与爻辞',
		serviceKey: 'heluo',
		moduleKey: 'shusuan',
		techniqueLabel: '河洛理数',
		native: true,
		showRail: true,
		tabs: [],
	},
	zhengchuan: {
		pageTitle: '数算',
		infoTitle: '数算信息',
		infoSubTitle: '神数正传、铁板邵子大定与条文',
		serviceKey: 'zhengchuan',
		moduleKey: 'shusuan',
		techniqueLabel: '神数正传',
		native: true,
		showRail: true,
		tabs: [],
	},
	xianqin: {
		pageTitle: '演禽',
		infoTitle: '演禽信息',
		infoSubTitle: '三宫、星禽与吞啖',
		serviceKey: 'xianqin',
		moduleKey: 'yanqin',
		techniqueLabel: '万化仙禽',
		showRail: false,
		tabs: [
			{ key: 'overview', label: '概览' },
			{ key: 'palaces', label: '宫位' },
			{ key: 'stars', label: '星禽' },
			{ key: 'swallow', label: '吞啖' },
			{ key: 'xqYunxian', label: '运限' },
			{ key: 'yanfa', label: '演法' },
		],
	},
	cetian: {
		pageTitle: '其他',
		infoTitle: '其他信息',
		infoSubTitle: '策天十八飞星（移语本增强·书法/原法可切）',
		serviceKey: 'cetian',
		moduleKey: 'mingother',
		techniqueLabel: '策天飞星',
		showRail: true,
		// 书法(移语本):流年/运限/断诀/典籍四新页;飞星/格局 tab 仅原法(kentang)有数据时
		// 由 visibleTabs 过滤自动出现,书法无该段自动隐藏(反之书法新段原法不产,同一机制互斥)。
		tabs: [
			{ key: 'overview', label: '概览' },
			{ key: 'palaces', label: '宫位' },
			{ key: 'liunian', label: '流年' },
			{ key: 'yunxian', label: '运限' },
			{ key: 'duanjue', label: '断诀' },
			{ key: 'flying', label: '飞星' },
			{ key: 'patterns', label: '格局' },
			{ key: 'ziliao', label: '典籍' },
		],
	},
	yizhangjing: {
		pageTitle: '其他',
		infoTitle: '其他信息',
		infoSubTitle: '一掌经·十二星宫与流年十二神',
		serviceKey: 'yizhangjing',
		moduleKey: 'mingother',
		techniqueLabel: '一掌经',
		native: true,
		showRail: true,
		tabs: [],
	},
};

// 策天流年星盘面单字短名(繁体星名→盘面徽字;毛頭=耗、紅鸞=红)
export const CETIAN_LIUNIAN_SHORT = {
	'天庫': '库', '天貫': '贯', '文昌': '文', '天福': '福', '天祿': '禄', '紫微': '紫',
	'天虛': '虚', '天貴': '贵', '天印': '印', '天壽': '寿', '天空': '空', '紅鸞': '红',
	'天杖': '杖', '天異': '异', '毛頭': '耗', '天刃': '刃', '天刑': '刑', '天姚': '姚', '天哭': '哭',
};

// 策天流年年份点选范围(当前年±120;左栏铁律:年份全点选)
export const CETIAN_LIUNIAN_YEARS = (()=>{
	const now = new Date().getFullYear();
	const list = [];
	for(let y = now - 120; y <= now + 120; y += 1){ list.push(y); }
	return list;
})();

export const BRANCH_INDEX = {
	子: 0, 丑: 1, 寅: 2, 卯: 3, 辰: 4, 巳: 5,
	午: 6, 未: 7, 申: 8, 酉: 9, 戌: 10, 亥: 11,
};

export const TWELVE_PALACE_LAYOUT = [
	{ row: 1, col: 1, branch: 5 }, { row: 1, col: 2, branch: 6 }, { row: 1, col: 3, branch: 7 }, { row: 1, col: 4, branch: 8 },
	{ row: 2, col: 1, branch: 4 }, { row: 2, col: 4, branch: 9 },
	{ row: 3, col: 1, branch: 3 }, { row: 3, col: 4, branch: 10 },
	{ row: 4, col: 1, branch: 2 }, { row: 4, col: 2, branch: 1 }, { row: 4, col: 3, branch: 0 }, { row: 4, col: 4, branch: 11 },
];

export const BRANCH_NAMES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

// 南极推演宫:空 = 「自出」,交后端取宫部首支(与 AI 挂载齿轮缺省同一口径);其余为指定某一支
export const NANJI_PALACE_OPTIONS = [{ value: '', label: '自出（宫部首支）' }].concat(BRANCH_NAMES.map((z)=>({ value: z, label: z })));

export const STEM_NAMES = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

export const SIHUA_KEYS = ['禄', '权', '科', '忌'];

export const HUA_NORMALIZE = {
	祿: '禄',
	權: '权',
	科: '科',
	忌: '忌',
};

export const GANZHI_PATTERN = /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/;

export const INTERNAL_SECTION_TITLES = new Set([
	'十二宫顺序',
	'三元起宿',
	'合宿表',
	'科名月宿',
	'四季得时',
	'情性赋全表',
	'二十八宿正像',
	'吞啖合战规则',
	'贵贱赋摘要',
	'星曜属性',
	'正曜副曜',
	'宫干四化表',
	'飞化规则',
	'古法格局规则',
	'三合组',
	'星曜别名',
	'廿八宿分野',
	'十干变曜',
	'杂曜',
]);

// 策天(移语本)右栏页签 → 段名映射(单源;getTabSections 与 ziliao 特渲共用)。
// ziliao 组含 INTERNAL 资料段,取段时须绕过 INTERNAL 过滤直读 pan.sections。
export const CETIAN_TAB_SECTIONS = {
	liunian: ['流年飞星', '流年七煞', '十七飞星', '神煞·岁前', '神煞·岁后', '神煞·年干', '神煞·月煞'],
	yunxian: ['运限', '童限', '凶限提示', '会照', '阴阳宫', '星解与运限歌', '三日宫'],
	duanjue: ['断诀'],
	ziliao: ['廿八宿分野', '十干变曜', '杂曜', '星曜别名', '星曜属性', '正曜副曜',
		'宫干四化表', '飞化规则', '古法格局规则', '三合组'],   // 后三段仅原法(kentang)产
};

export const XIANQIN_PALACE_STAR_MAP = [
	{ match: ['命'], label: '命星', source: 'ming_xing' },
	{ match: ['财帛', '財帛'], label: '财帛星', key: '財帛星' },
	{ match: ['兄弟'], label: '兄弟星', key: '兄弟星' },
	{ match: ['田宅'], label: '田宅星', key: '田宅星' },
	{ match: ['子女', '子息'], label: '子息星', key: '子息星' },
	{ match: ['奴仆', '奴僕'], label: '奴仆星', key: '奴僕星' },
	{ match: ['夫妻', '妻妾'], label: '妻妾星', key: '妻妾星' },
	{ match: ['疾厄'], label: '疾厄星', key: '疾厄星' },
	{ match: ['迁移', '遷移'], label: '迁移星', key: '遷移星' },
	{ match: ['官禄', '官祿'], label: '官禄星', key: '官祿星' },
	{ match: ['福德'], label: '福德星', key: '福德星' },
	{ match: ['相貌'], label: '相貌星', key: '相貌星' },
];

// 中宫内容档位(clean/bazi/full)。策天与演禽各自一个键 —— 与紫微的 ziweiCenterContent 分开,
// 免得「在策天调了档,紫微跟着变」。缺省 bazi:借用中宫的这两法本就要看四柱与命/身要素,
// 空着一格中宫反而是浪费(紫微自身默认仍是 clean,零回归)。
export const KIN_CENTER_CONTENT_KEY = { cetian: 'cetianCenterContent', xianqin: 'xianqinCenterContent' };
