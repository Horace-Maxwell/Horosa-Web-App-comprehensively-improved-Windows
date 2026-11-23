// 盘面尺寸 / 环位 / 配色 / 星体与相位定义 / 庙旺徽标等常量
// 从 GuoLaoMoiraWheel.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import * as AstroConst from '../../../constants/AstroConst';

export const R = 560;
// 视窗收紧(1220→1180):Moira 圆盘与天星择日盘直径同步放大约 3.4%;
// 最外缘=年份/度数向心文字(外沿≈574),VIEW/2=590 仍留 ≥16px 安全边距。
export const VIEW = 1180;
// 全开时的历史布局(基准);运行时实际边界 = ACTIVE_RING_POS,由 moiraWheelLayout 按
// 显示开关重算——隐藏的环折叠为零宽、其余环按权重铺满(Moira 式重排,无空带)。
export const RING_POS = [0.10, 0.22, 0.28, 0.34, 0.43, 0.45, 0.51, 0.53, 0.62, 0.77, 0.92, 0.95, 1.0];
export const RING_DRAW_TYPE = [1, 0, 0, 0, 1, -10, -10, 1, 1, 0, 0, 1, -10];

// 槽语义映射(带名→[内界槽,外界槽]):full/half 用恒等 DEFAULT;aspects 模式按 Moira aspects_* 键位
// 重指(行星贴相位网、宿环在行星外、地支/宫号/宫名依次外推、神煞单带)。渲染函数经 rs() 取带界。
export const DEFAULT_SLOTS = {
	anchor: [0, 0],
	branchStars: [0, 1],
	numbers: [1, 2],
	houseNames: [2, 3],
	nowPlanets: [3, 4],
	stellarTickUp: [4, 5],
	stellarNames: [5, 6],
	stellarTickDown: [6, 7],
	birthPlanets: [7, 8],
	godsInner: [8, 9],
	godsOuter: [9, 10],
};
// aspects 六圆槽表(与 ASPECTS_RING_POS_13 的六圆规格 lockstep):
// 星体带 [0,1]=0.415-0.51(圆1 内);锚点=圆1 上;宿三段 [1,4];人事宫 [4,5];
// 八卦支曜 [5,6];本命神煞 [6,7];numbers/nowPlanets/godsOuter 折叠(本布局无此内容)。
export const ASPECTS_SLOTS = {
	anchor: [0, 1],
	birthPlanets: [1, 2],
	stellarTickUp: [2, 3],
	stellarNames: [3, 4],
	stellarTickDown: [3, 4],
	houseNames: [4, 5],
	branchStars: [5, 6],
	numbers: [6, 6],
	nowPlanets: [6, 6],
	godsInner: [6, 7],
	godsOuter: [7, 7],
};

export const LIMIT_SEQ = [11.0, 10.0, 11.0, 15.0, 8.0, 7.0, 11.0, 4.5, 4.5, 4.5, 5.0, 5.0];

export const MOIRA_BG = 'var(--moira-bg, #ffffff)';
export const BLACK = 'var(--moira-ink, #000000)';
export const GREEN = 'var(--moira-green, #008000)';
export const BLUE = 'var(--moira-blue, #000080)';
export const RED = 'var(--moira-red, #ff0000)';
export const MAGENTA = 'var(--moira-magenta, #ff00ff)';
export const NOW_MARK = 'var(--moira-now-mark, #804040)';
export const PALE = 'var(--moira-pale, #b5d8c7)';
export const MUTED_PLANET = 'var(--moira-muted-planet, #8a8a8a)';
export const GOD_RING_INNER = 8;
export const GOD_RING_OUTER = 10;

export const TWELVE_SIGNS = ['酉', '申', '未', '午', '巳', '辰', '卯', '寅', '丑', '子', '亥', '戌'];
// aspects 八卦+支+主宰曜三字(照 Moira full_twelve_signs_alt 官方表,乾用正字;与 RING1/TWELVE_SIGNS 同序=酉起)。
export const TWELVE_SIGNS_ALT = ['兑酉金', '坤申水', '坤未月', '离午日', '巽巳水', '巽辰金', '震卯火', '艮寅木', '艮丑土', '坎子土', '乾亥木', '乾戌火'];

export const RING1 = ['金酉', '水申', '月未', '日午', '水巳', '金辰', '火卯', '木寅', '土丑', '土子', '木亥', '火戌'];
export const HOUSE_BRANCH = ['命宫', '财帛', '兄弟', '田宅', '男女', '奴仆', '夫妻', '疾厄', '迁移', '官禄', '福德', '相貌'];
export const SIGN_NAMES = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
export const HALF_STELLAR = ['娄', '胃', '昴', '毕', '觜', '参', '井', '鬼', '柳', '星', '张', '翼', '轸', '角', '亢', '氐', '房', '心', '尾', '箕', '斗', '牛', '女', '虚', '危', '室', '壁', '奎'];
export const FULL_STELLAR = ['娄金', '胃土', '昴日', '毕月', '觜火', '参水', '井木', '鬼金', '柳土', '星日', '张月', '翼火', '轸水', '角木', '亢金', '氐土', '房日', '心月', '尾火', '箕水', '斗木', '牛金', '女土', '虚日', '危月', '室火', '壁水', '奎木'];

// 入宿度的中文数字(对齐 Moira 中心「六度」写法,0~30)。
export function cnDegree(n){
	const v = Math.max(0, Math.min(30, Math.floor(Number(n) || 0)));
	const d = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
	if(v <= 10) return d[v];
	if(v < 20) return '十' + d[v - 10];
	if(v === 20) return '二十';
	if(v < 30) return '二十' + d[v - 20];
	return '三十';
}
export const STEM_BRANCHES = ['甲子', '乙丑', '丙寅', '丁卯', '戊辰', '己巳', '庚午', '辛未', '壬申', '癸酉', '甲戌', '乙亥', '丙子', '丁丑', '戊寅', '己卯', '庚辰', '辛巳', '壬午', '癸未', '甲申', '乙酉', '丙戌', '丁亥', '戊子', '己丑', '庚寅', '辛卯', '壬辰', '癸巳', '甲午', '乙未', '丙申', '丁酉', '戊戌', '己亥', '庚子', '辛丑', '壬寅', '癸卯', '甲辰', '乙巳', '丙午', '丁未', '戊申', '己酉', '庚戌', '辛亥', '壬子', '癸丑', '甲寅', '乙卯', '丙辰', '丁巳', '戊午', '己未', '庚申', '辛酉', '壬戌', '癸亥'];
export const BIRTH_GOD_ORDER = ['劫杀', '文昌', '禄勋', '大耗', '月杀', '咸池', '唐符', '天厨', '伏尸', '三刑', '勾神', '蓦越', '黄幡', '的杀', '孤辰', '天喜', '注受', '剑锋', '飞廉', '病符', '紫微', '华盖', '天贵', '六害', '孤虚', '游奕', '年符', '死符', '地雌', '卷舌', '绞杀', '天德', '贯索', '亡神', '国印', '岁殿', '卦气', '空亡', '豹尾', '擎天', '天空', '大杀', '天厄', '月廉', '天雄', '天哭', '天狗', '地耗', '月符', '披头', '红鸾', '岁驾', '小耗', '寡宿', '飞刃', '天耗', '斗杓', '驿马', '阳刃', '阑干', '玉贵', '血刃', '浮沉', '解神'];
export const TRANSIT_GOD_ORDER = ['岁驾', '天空', '地雌', '贯索', '五鬼', '死符', '大耗', '天厄', '天雄', '大杀', '卷舌', '天德', '天狗', '蓦越', '亡神', '天喜', '披头', '血刃', '解神', '天哭', '地解', '劫杀', '的杀', '红鸾', '驿马', '游奕', '擎天', '黄幡', '豹尾', '天厨', '三刑', '六害', '咸池', '阳刃', '禄勋', '天贵'];
export const PLANET_DEFS = [
	{id: AstroConst.SUN, label: '日'},
	{id: AstroConst.MOON, label: '月'},
	{id: AstroConst.VENUS, label: '金'},
	{id: AstroConst.JUPITER, label: '木'},
	{id: AstroConst.MERCURY, label: '水'},
	{id: AstroConst.MARS, label: '火'},
	{id: AstroConst.SATURN, label: '土'},
	{id: AstroConst.SOUTH_NODE, label: '计'},
	{id: AstroConst.NORTH_NODE, label: '罗'},
	{id: AstroConst.PURPLE_CLOUDS, label: '炁'},
	{id: AstroConst.DARKMOON, label: '孛'},
	// 天海冥(天王/海王/冥王):后端 chart.objects 本就返回,加入可显示星曜(星曜选择器可开关、进星曜带/表/相位/AI);
	// 七政四余传统无此三星,但用户钦定加入;色按顺逆留+庙旺派生(planetColor),无需专属色。
	{id: AstroConst.URANUS, label: '天'},
	{id: AstroConst.NEPTUNE, label: '海'},
	{id: AstroConst.PLUTO, label: '冥'},
	// 升(Asc)/顶(MC):本命与流年行星带均画,进星曜选择器可开关,并与 Moira 同款参与相位。
	{id: AstroConst.ASC, label: '升'},
	{id: AstroConst.MC, label: '顶'},
];

// 庙旺落陷着色（庙旺=吉金、陷失=弱色），与顺逆留色互不冲突（顺逆留优先）
export const DIGNITY_STRONG = ['庙', '旺', '入垣', '得地', '入庙', '升殿'];
export const DIGNITY_WEAK = ['陷', '失', '落', '失垣', '落陷'];
export const DIGNITY_GOLD = 'var(--moira-dignity-strong, #9a6a25)';
export const DIGNITY_WEAK_COLOR = 'var(--moira-dignity-weak, #b06a5e)';
// 庙旺标注徽标取单字：入庙/庙→庙、入垣→垣、得地→得，旺/陷/失/落 原样。
// （原 dignity.slice(0,1) 把「入庙/入垣」一律截成「入」，致庙旺星显示成「入」。）
const DIGNITY_BADGE_CHAR = {
	'入庙': '庙', '庙': '庙', '入垣': '垣', '垣': '垣',
	'旺': '旺', '得地': '得', '得': '得', '升殿': '殿',
	'陷': '陷', '失': '失', '落': '落', '失垣': '失', '落陷': '陷', '平': '平', '不': '不',
};
export function dignityBadgeChar(dignity){
	const key = `${dignity || ''}`.trim();
	return DIGNITY_BADGE_CHAR[key] || key.slice(0, 1);
}
// 相位（會衝刑合半合半刑四合）：度 / 容许度 / 色 / 线型，照 Moira aspects 表
export const MOIRA_ASPECTS = [
	{key: '會', angle: 0, orb: 12, color: '#00b35a', dash: '5 3'},
	{key: '衝', angle: 180, orb: 6, color: '#8a4bff', dash: '8 3 2 3'},
	{key: '刑', angle: 90, orb: 3, color: '#e07a18', dash: ''},
	{key: '合', angle: 120, orb: 4, color: '#d23b3b', dash: '10 4'},
	{key: '半合', angle: 60, orb: 2, color: '#c79a1e', dash: '2 3'},
	{key: '半刑', angle: 45, alt: 135, orb: 1.5, color: '#c64fb8', dash: '2 3'},
	{key: '四合', angle: 30, alt: 150, orb: 1, color: '#8a8a3a', dash: '2 3'},
];
export const MOIRA_DEFAULT_ASPECTS = ['會', '衝', '刑', '合', '半合'];

// 七政相位单源(盘面连线 / 右栏「相位」页 / AI 快照同用):会照角度按盘面显示口径(黄仪取黄经、赤仪取赤经),
// 只认已勾选的相位药丸(aspectSet)与容许度设置(aspectOrbs,缺项取上表内置值);隐藏的曜不参与。
// 一对星按上表次序取第一个命中的相位(與盘面连线逐条一致)。状态(入相 / 离相)按两星日速推下一时刻误差增减判,无速度给「—」;
// 日速与位置同口径:黄仪取黄经日速 lonspeed,赤仪取赤经日速 raspeed(曾赤仪也拿黄经日速推赤经位置,近合 / 慢星对子会判反)。
export function moiraHiddenIds(hiddenPlanets){
	const hidden = hiddenPlanets || [];
	if(!hidden.length){ return null; }
	const ids = new Set();
	PLANET_DEFS.forEach((def)=>{ if(hidden.indexOf(def.label) >= 0){ ids.add(def.id); } });
	return ids;
}
export function moiraObjSpeed(obj, preferLon = false){
	if(!obj){ return null; }
	const lonSpeed = Number(obj.lonspeed !== undefined ? obj.lonspeed : obj.speed);
	if(!preferLon && obj.raspeed !== undefined && obj.raspeed !== null){
		const raSpeed = Number(obj.raspeed);
		// 后端合成点(福点 / 紫炁等)raspeed 恒写 0、不是真日速:此时若有黄经日速就退回黄经日速。
		if(Number.isFinite(raSpeed) && (raSpeed !== 0 || !Number.isFinite(lonSpeed) || lonSpeed === 0)){ return raSpeed; }
	}
	return Number.isFinite(lonSpeed) ? lonSpeed : null;
}
