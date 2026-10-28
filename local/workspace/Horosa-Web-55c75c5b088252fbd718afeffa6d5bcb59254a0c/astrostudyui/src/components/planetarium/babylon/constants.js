// 天文馆 · 场景常量与配色:半径 / 视场、天体标签 / 颜色 / 视觉参数、图层缺省与分组、页面设置、二十八宿与星官配色。
// 只被 components/planetarium/PlanetariumBabylon.js 与同目录 babylon/ 下的兄弟模块引用。
import { definePageSettings } from '../../../utils/pageSettingsStore';

export const BABYLON = typeof window !== 'undefined' ? window.BABYLON : null;

export const SKY_RADIUS = 2600;
export const BODY_RADIUS = 820;
export const STAR_RADIUS = 780;
export const LINE_RADIUS = 760;
export const OBSERVER_EYE_HEIGHT = 5;
export const GROUND_MIN_FOV = 0.18;
export const GROUND_MAX_FOV = 1.62;
export const ORBIT_MIN_RADIUS = 80;
export const ORBIT_MAX_RADIUS = 2400;
export const PLANETARIUM_PERF_KEY = '__horosaPlanetariumPerf';
export const HORIZON_PANORAMA_URL = 'planetarium/horizon-panorama.png?v=20260522-landscape-5'; // 照片全景地面(唯一样式)
// 星等过滤滑块边界:6.5 = BSC5(Yale 亮星表)肉眼可见上限 → 默认即此值,等价「全部显示」,零回归。
export const STAR_MAG_LIMIT_MIN = 1.0;
export const STAR_MAG_LIMIT_MAX = 6.5;

export const BODY_LABELS = {
	Sun: '太阳',
	Moon: '月亮',
	Earth: '地球',
	Mercury: '水星',
	Venus: '金星',
	Mars: '火星',
	Jupiter: '木星',
	Saturn: '土星',
	Uranus: '天王星',
	Neptune: '海王星',
	Pluto: '冥王星',
	'North Node': '北交点',
	'South Node': '南交点',
};

export const BODY_ENGLISH_LABELS = {
	Sun: 'Sun',
	Moon: 'Moon',
	Earth: 'Earth',
	Mercury: 'Mercury',
	Venus: 'Venus',
	Mars: 'Mars',
	Jupiter: 'Jupiter',
	Saturn: 'Saturn',
	Uranus: 'Uranus',
	Neptune: 'Neptune',
	Pluto: 'Pluto',
	'North Node': 'North Node',
	'South Node': 'South Node',
};

export const BODY_COLORS = {
	Sun: new BABYLON.Color3(1.0, 0.76, 0.25),
	Moon: new BABYLON.Color3(0.82, 0.9, 1.0),
	Earth: new BABYLON.Color3(0.24, 0.55, 0.95),
	Mercury: new BABYLON.Color3(0.72, 0.72, 0.68),
	Venus: new BABYLON.Color3(0.98, 0.72, 0.48),
	Mars: new BABYLON.Color3(1.0, 0.34, 0.22),
	Jupiter: new BABYLON.Color3(0.95, 0.72, 0.48),
	Saturn: new BABYLON.Color3(0.92, 0.82, 0.56),
	Uranus: new BABYLON.Color3(0.44, 0.9, 0.96),
	Neptune: new BABYLON.Color3(0.38, 0.52, 1.0),
	Pluto: new BABYLON.Color3(0.78, 0.66, 0.58),
	'North Node': new BABYLON.Color3(0.75, 0.88, 1.0),
	'South Node': new BABYLON.Color3(0.7, 0.58, 0.96),
};

export const TEXTURED_BODY_IDS = new Set([
	'Sun', 'Moon', 'Earth', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
]);

export const ALWAYS_LABELED_BODY_IDS = new Set([
	'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
]);

export const BODY_VISUALS = {
	Sun: { emissive: 1.35, haloScale: 2.85, haloAlpha: 0.2 },
	Moon: { emissive: 0.92, haloScale: 1.75, haloAlpha: 0.1 },
	Mercury: { emissive: 0.58, haloScale: 1.55, haloAlpha: 0.07 },
	Venus: { emissive: 0.9, haloScale: 1.85, haloAlpha: 0.13 },
	Mars: { emissive: 0.72, haloScale: 1.7, haloAlpha: 0.1 },
	Jupiter: { emissive: 0.78, haloScale: 1.75, haloAlpha: 0.11 },
	Saturn: { emissive: 0.72, haloScale: 1.72, haloAlpha: 0.1 },
	Uranus: { emissive: 0.7, haloScale: 1.64, haloAlpha: 0.09 },
	Neptune: { emissive: 0.72, haloScale: 1.64, haloAlpha: 0.09 },
	Pluto: { emissive: 0.56, haloScale: 1.5, haloAlpha: 0.06 },
};

export const DEFAULT_LAYERS = {
	stars: false, // 默认关闭恒星层(用户偏好:开盘默认不显裸眼恒星,界面更简洁;可在左栏「天体与星官」一键开启)
	bodies: true,
	atmosphere: true, // 大气层(默认开):关→天空纯黑(白天也黑)、关大气折射、无地平辉光,变纯黑底真空星空
	ground: true, // 地面(默认开):地表观测下关→看到地平线以下整个天球(不被地面遮挡)
	horizon: true,
	equator: true,
	ecliptic: true,
	zodiacSectors: true,
	houses: true,
	su28: true,
	su28Sectors: true,
	beidou: true,
	// qizheng 键删除:无芯片、全文件零读取(七政四余不是天文馆图层;天文馆=纯天文)
	// 「对标专业星图」增强层(默认关,经折叠面板/一键预设开启;celestialPoles 例外见下)。
	starNames: false,
	threeEnclosures: false,
	galacticEquator: false,
	constellationLines: false,
	constellationBounds: false,
	horizontalGrid: false,
	equatorialGrid: false,
	eclipticGrid: false,
	su28Grid: false,
	coordLabels: false,
	raHourScale: false,
	eclipticDegreeScale: false,
	azimuthScale: false,
	altitudeScale: false,
	celestialPoles: true, // 保「北天极一直可见」旧行为
	eclipticPoles: false,
	galacticPoles: false,
	precessionCircle: false,
	analemma: false,
	milkyWay: false,
	xingguan: false, // 完整星官(312)连线+名,默认关 → 零回归
	planetTrails: false, // 行星视运动轨迹,默认关 → 默认不带 includeTrails、零额外请求
};

// 显示设置跨会话保留(用户实报同类:设置改了之后每次重开软件都要重设)。本页此前零落盘:
// 图层开关(36 项)/ 星等上限 / 观测视角 每次重开全回出厂值。观测时刻、观测点、搜索词、测量与选中态是输入 / 视图态,不保留。
// 图层是「整张表」而不是覆盖层:每个键都有确定的出厂值,坏键回该键出厂值、未知键丢弃。
export const PLANETARIUM_PAGE_SETTINGS = definePageSettings('horosa.planetarium.settings.v1', {
	layers: { type: 'map', keys: Object.keys(DEFAULT_LAYERS).reduce((acc, k)=>{ acc[k] = { def: DEFAULT_LAYERS[k] }; return acc; }, {}) },
	magLimit: { def: 4, type: 'number', min: STAR_MAG_LIMIT_MIN, max: STAR_MAG_LIMIT_MAX },
	viewMode: { def: 'ground', oneOf: ['ground', 'orbit'] },
});

// 侧栏折叠分组(阶段 C):新旧图层统一收进 5 个可折叠分组。
export const LAYER_GROUPS = [
	{ id: 'scene', title: '场景 · 地面', chips: [['atmosphere', '大气层'], ['ground', '地面']] },
	{ id: 'objects', title: '天体与星官', chips: [['stars', '恒星'], ['bodies', '星体'], ['starNames', '星名'], ['su28', '二十八宿'], ['su28Sectors', '宿区间'], ['threeEnclosures', '三垣'], ['beidou', '北斗'], ['xingguan', '星官']] },
	{ id: 'circles', title: '参考圈', chips: [['horizon', '地平/子午'], ['equator', '天赤道'], ['ecliptic', '黄道'], ['zodiacSectors', '星座区间'], ['houses', '宫位'], ['galacticEquator', '银道'], ['constellationLines', '星座连线'], ['constellationBounds', '星座边界']] },
	{ id: 'grids', title: '坐标网格', legend: { horizontalGrid: 'grid-h', equatorialGrid: 'grid-eq', eclipticGrid: 'grid-ec', su28Grid: 'grid-su28' }, chips: [['horizontalGrid', '地平网格'], ['equatorialGrid', '赤道网格'], ['eclipticGrid', '黄道网格'], ['su28Grid', '宿度网格']] },
	{ id: 'scales', title: '刻度与标注', chips: [['coordLabels', '坐标数字'], ['raHourScale', '赤经时标'], ['eclipticDegreeScale', '黄道度标'], ['azimuthScale', '方位刻度'], ['altitudeScale', '高度刻度']] },
	{ id: 'poles', title: '极点与高阶', chips: [['celestialPoles', '天极'], ['eclipticPoles', '黄极'], ['galacticPoles', '银极'], ['milkyWay', '银河'], ['precessionCircle', '岁差圈'], ['analemma', '日行迹'], ['planetTrails', '行星轨迹']] }, // 银河(milkyWay)程序化银道带,默认关;行星轨迹(planetTrails)开启才带 includeTrails 重取
];
// 「对标专业星图」一键预设:常用专业坐标层一次铺开。
export const PROFESSIONAL_LAYERS = { equatorialGrid: true, eclipticGrid: true, coordLabels: true, raHourScale: true, eclipticDegreeScale: true, celestialPoles: true, eclipticPoles: true, galacticEquator: true, starNames: true };

export const SU28_PALACE_COLORS = [
	new BABYLON.Color3(0.34, 0.78, 0.92),
	new BABYLON.Color3(0.44, 0.82, 0.58),
	new BABYLON.Color3(0.94, 0.74, 0.38),
	new BABYLON.Color3(0.78, 0.58, 0.96),
];

// 二十八宿传统序(角起:东方七宿→北方→西方→南方,每 7 宿一象)。四象配色/象首强调须按此序,
// 而非按赤经升序(否则 idx=0=赤经最小的奎宿区,四象色与象首整体偏移一象)。宿名不识别则退回 idx(零回归)。
const SU28_SEQUENCE = ['角', '亢', '氐', '房', '心', '尾', '箕', '斗', '牛', '女', '虚', '危', '室', '壁', '奎', '娄', '胃', '昴', '毕', '觜', '参', '井', '鬼', '柳', '星', '张', '翼', '轸'];
export function su28SequenceIndex(item){
	const raw = String((item && (item.name || item.displayName || item.id)) || '').trim();
	if(!raw){ return -1; }
	let i = SU28_SEQUENCE.indexOf(raw);
	if(i < 0){ i = SU28_SEQUENCE.indexOf(raw.replace(/宿$/, '')); }
	if(i < 0){ i = SU28_SEQUENCE.indexOf(raw[0]); }
	return i;
}

// 星官(312)配色:按四象/三垣分色 —— 纯传统象征色,与坐标制无关(纯天文铁律:坐标全用数据集真实 ra/decl)。
// 四象:东方青龙=青、北方玄武=玄(紫黑)、西方白虎=白银、南方朱雀=赤;三垣三色(紫微/太微/天市);近南极一色。
// 取色优先用 group(可区分三垣三墙),回退 symbol(四象/近南极)。
const ASTERISM_GROUP_COLORS = {
	紫微垣: new BABYLON.Color3(0.86, 0.62, 0.98),
	太微垣: new BABYLON.Color3(0.7, 0.7, 0.98),
	天市垣: new BABYLON.Color3(0.62, 0.86, 0.96),
};
const ASTERISM_SYMBOL_COLORS = {
	青龙: new BABYLON.Color3(0.34, 0.82, 0.86),
	玄武: new BABYLON.Color3(0.56, 0.5, 0.86),
	白虎: new BABYLON.Color3(0.86, 0.88, 0.92),
	朱雀: new BABYLON.Color3(0.96, 0.46, 0.42),
	三垣: new BABYLON.Color3(0.82, 0.7, 0.96),
	近南极: new BABYLON.Color3(0.62, 0.78, 0.7),
};
const ASTERISM_DEFAULT_COLOR = new BABYLON.Color3(0.72, 0.78, 0.86);
export function asterismColor(item){
	if(item && item.group && ASTERISM_GROUP_COLORS[item.group]){ return ASTERISM_GROUP_COLORS[item.group]; }
	if(item && item.symbol && ASTERISM_SYMBOL_COLORS[item.symbol]){ return ASTERISM_SYMBOL_COLORS[item.symbol]; }
	return ASTERISM_DEFAULT_COLOR;
}
