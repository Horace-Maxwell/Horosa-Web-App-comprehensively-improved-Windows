// 七政四余页 · Moira 常量表:行星序、干支、化曜 / 十干神 / 年神分组、速度阈值、中文名映射、庙旺 / 落陷 / 克制表。
// 只被 components/guolao/GuoLaoChartMain.js 与同目录 main/ 下的兄弟模块引用。
import * as AstroConst from '../../../constants/AstroConst';

export const MOIRA_PLANET_ORDER = [
	{id: AstroConst.SUN, name: '日'},
	{id: AstroConst.MOON, name: '月'},
	{id: AstroConst.VENUS, name: '金'},
	{id: AstroConst.JUPITER, name: '木'},
	{id: AstroConst.MERCURY, name: '水'},
	{id: AstroConst.MARS, name: '火'},
	{id: AstroConst.SATURN, name: '土'},
	{id: AstroConst.SOUTH_NODE, name: '计'},
	{id: AstroConst.NORTH_NODE, name: '罗'},
	{id: AstroConst.PURPLE_CLOUDS, name: '炁'},
	{id: AstroConst.DARKMOON, name: '孛'},
];

export const STEM_BRANCHES = ['甲子', '乙丑', '丙寅', '丁卯', '戊辰', '己巳', '庚午', '辛未', '壬申', '癸酉', '甲戌', '乙亥', '丙子', '丁丑', '戊寅', '己卯', '庚辰', '辛巳', '壬午', '癸未', '甲申', '乙酉', '丙戌', '丁亥', '戊子', '己丑', '庚寅', '辛卯', '壬辰', '癸巳', '甲午', '乙未', '丙申', '丁酉', '戊戌', '己亥', '庚子', '辛丑', '壬寅', '癸卯', '甲辰', '乙巳', '丙午', '丁未', '戊申', '己酉', '庚戌', '辛亥', '壬子', '癸丑', '甲寅', '乙卯', '丙辰', '丁巳', '戊午', '己未', '庚申', '辛酉', '壬戌', '癸亥'];
export const MOIRA_YEAR_STAR_BY_STEM = {
	甲: '火',
	乙: '孛',
	丙: '木',
	丁: '金',
	戊: '土',
	己: '月',
	庚: '水',
	辛: '炁',
	壬: '计',
	癸: '罗',
};
export const MOIRA_YEAR_STAR_SEQ = ['火', '孛', '木', '金', '土', '月', '水', '炁', '计', '罗'];
export const MOIRA_YEAR_STAR_MAP = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
export const MOIRA_TEN_GOD_ORG = ['天禄', '天暗', '天福', '天耗', '天荫', '天贵', '天嗣', '天刑', '天印', '天囚', '天权'];
export const MOIRA_TEN_GOD_ALT = ['比肩', '劫财', '食神', '伤官', '偏财', '正财', '七杀', '正官', '偏印', '正印'];
export const MOIRA_YEAR_INFO_GROUPS = [
	['天禄', '科名', '天马', '生官'],
	['天暗', '科甲', '地驿'],
	['天福', '文星', '禄元'],
	['天耗', '魁星', '马元', '值难'],
	['天荫', '官星', '天元', '职元'],
	['天贵', '印星', '地元', '局主'],
	['天嗣', '寿元', '人元', '天经'],
	['天刑', '催官', '仁元', '地纬'],
	['天印', '禄神', '血支'],
	['天囚', '喜神', '血忌'],
	['天权', '爵星', '产星', '伤官'],
];
export const MOIRA_BIRTH_GOD_ORDER = ['劫杀', '文昌', '禄勋', '大耗', '月杀', '咸池', '唐符', '天厨', '伏尸', '三刑', '勾神', '蓦越', '黄幡', '的杀', '孤辰', '天喜', '注受', '剑锋', '飞廉', '病符', '紫微', '华盖', '天贵', '六害', '孤虚', '游奕', '年符', '死符', '地雌', '卷舌', '绞杀', '天德', '贯索', '亡神', '国印', '岁殿', '卦气', '空亡', '豹尾', '擎天', '天空', '大杀', '天厄', '月廉', '天雄', '天哭', '天狗', '地耗', '月符', '披头', '红鸾', '岁驾', '小耗', '寡宿', '飞刃', '天耗', '斗杓', '驿马', '阳刃', '阑干', '玉贵', '血刃', '浮沉', '解神'];
export const MOIRA_TRANSIT_GOD_ORDER = ['岁驾', '天空', '地雌', '贯索', '五鬼', '死符', '大耗', '天厄', '天雄', '大杀', '卷舌', '天德', '天狗', '蓦越', '亡神', '天喜', '披头', '血刃', '解神', '天哭', '地解', '劫杀', '的杀', '红鸾', '驿马', '游奕', '擎天', '黄幡', '豹尾', '天厨', '三刑', '六害', '咸池', '阳刃', '禄勋', '天贵'];
export const MOIRA_SPEED_LIMITS = {
	Venus: {slow: 0.71, fast: 1.245},
	Jupiter: {slow: 0.05, fast: 0.23},
	Mercury: {slow: 0.88, fast: 1.50},
	Mars: {slow: 0.4, fast: 0.70},
	Saturn: {slow: 0.02, fast: 0.13},
};
export const MOIRA_PLANET_CN_TO_ID = {
	日: AstroConst.SUN,
	月: AstroConst.MOON,
	水: AstroConst.MERCURY,
	金: AstroConst.VENUS,
	火: AstroConst.MARS,
	木: AstroConst.JUPITER,
	土: AstroConst.SATURN,
	罗: AstroConst.NORTH_NODE,
	计: AstroConst.SOUTH_NODE,
	炁: AstroConst.PURPLE_CLOUDS,
	孛: AstroConst.DARKMOON,
};
export const MOIRA_RULER_BY_SIGN = {
	Aries: AstroConst.MARS,
	Taurus: AstroConst.VENUS,
	Gemini: AstroConst.MERCURY,
	Cancer: AstroConst.MOON,
	Leo: AstroConst.SUN,
	Virgo: AstroConst.MERCURY,
	Libra: AstroConst.VENUS,
	Scorpio: AstroConst.MARS,
	Sagittarius: AstroConst.JUPITER,
	Capricorn: AstroConst.SATURN,
	Aquarius: AstroConst.SATURN,
	Pisces: AstroConst.JUPITER,
};
const MOIRA_EXILE_BY_SIGN = {
	Aries: AstroConst.VENUS,
	Taurus: AstroConst.MARS,
	Gemini: AstroConst.JUPITER,
	Cancer: AstroConst.SATURN,
	Leo: AstroConst.SATURN,
	Virgo: AstroConst.JUPITER,
	Libra: AstroConst.MARS,
	Scorpio: AstroConst.VENUS,
	Sagittarius: AstroConst.MERCURY,
	Capricorn: AstroConst.MOON,
	Aquarius: AstroConst.SUN,
	Pisces: AstroConst.MERCURY,
};
export const MOIRA_OVERCOMING = {
	日: '月',
	月: '日',
	金: '火',
	木: '金',
	水: '土',
	火: '水',
	土: '木',
	炁: '金',
	孛: '土',
	罗: '水',
	计: '木',
};
