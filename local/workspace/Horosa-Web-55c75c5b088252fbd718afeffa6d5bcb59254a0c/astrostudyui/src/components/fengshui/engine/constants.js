// 风水纳气盘引擎 · 常量:二十四山扇区与扇区索引 / 相邻判定、标记类型(含八卦)、风位 / 水位数与配色、吸附容差、历史上限、操作提示与摆放建议、罗盘盘面皮肤
// 从 fengshuiEngine.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。

export const SECTORS = [
	{ num: 1, name: '北(坎)', start: 337.5, end: 22.5 },
	{ num: 8, name: '东北(艮)', start: 22.5, end: 67.5 },
	{ num: 3, name: '东(震)', start: 67.5, end: 112.5 },
	{ num: 4, name: '东南(巽)', start: 112.5, end: 157.5 },
	{ num: 9, name: '南(离)', start: 157.5, end: 202.5 },
	{ num: 2, name: '西南(坤)', start: 202.5, end: 247.5 },
	{ num: 7, name: '西(兑)', start: 247.5, end: 292.5 },
	{ num: 6, name: '西北(乾)', start: 292.5, end: 337.5 },
];

export const MARKER_TYPES = [
	{ id: 'entryDoor', label: '入户门', short: '门', category: 'wind', color: '#c34f3a' },
	{ id: 'window', label: '窗户', short: '窗', category: 'wind', color: '#b05445' },
	{ id: 'balcony', label: '阳台', short: '阳', category: 'wind', color: '#c76a3c' },
	{ id: 'stove', label: '灶台', short: '灶', category: 'wind', color: '#d26a4e' },
	{ id: 'sofa', label: '沙发', short: '沙', category: 'wind', color: '#b76b58' },
	{ id: 'bed', label: '床', short: '床', category: 'wind', color: '#a8615e' },
	{ id: 'desk', label: '书桌', short: '桌', category: 'wind', color: '#9e5a6a' },
	{ id: 'altar', label: '神龛', short: '龛', category: 'wind', color: '#8c4e44' },
	{ id: 'petBed', label: '宠物床', short: '宠', category: 'wind', color: '#a96a5b' },
	{ id: 'sink', label: '水槽', short: '槽', category: 'water', color: '#2b5ea0' },
	{ id: 'washbasin', label: '洗手池', short: '洗', category: 'water', color: '#2e6ea7' },
	{ id: 'toilet', label: '马桶', short: '厕', category: 'water', color: '#2f5c88' },
	{ id: 'drain', label: '下水管', short: '管', category: 'water', color: '#2a5a93' },
	{ id: 'washingMachine', label: '洗衣机', short: '机', category: 'water', color: '#2f6f9c' },
	{ id: 'bathroom', label: '卫生间', short: '卫', category: 'water', color: '#275783' },
	{ id: 'custom', label: '自定义', short: '标', category: 'neutral', color: '#6b655a' },
];

// 八卦阳宅标记调色板：成员（8 角色直选，角色→本命卦）+ 四类象格局（灶/厕/厅/门）。
// 落点后由 getSectorForPoint 取扇区→卦自动判读，无需任何表单。
export const BAGUA_MARKER_TYPES = [
	{ id: 'm-fu', label: '父', short: '父', kind: 'member', role: '父', benmingGua: '乾', color: '#b5793a' },
	{ id: 'm-mu', label: '母', short: '母', kind: 'member', role: '母', benmingGua: '坤', color: '#c06aa0' },
	{ id: 'm-zhangzi', label: '长子', short: '长子', kind: 'member', role: '长子', benmingGua: '震', color: '#3f8a6a' },
	{ id: 'm-cizi', label: '次子', short: '次子', kind: 'member', role: '次子', benmingGua: '坎', color: '#3a6e9c' },
	{ id: 'm-sanzi', label: '三子', short: '三子', kind: 'member', role: '三子', benmingGua: '艮', color: '#6b8a3f' },
	{ id: 'm-zhangnv', label: '长女', short: '长女', kind: 'member', role: '长女', benmingGua: '巽', color: '#1497a8' },
	{ id: 'm-cinv', label: '次女', short: '次女', kind: 'member', role: '次女', benmingGua: '离', color: '#c0603a' },
	{ id: 'm-sannv', label: '三女', short: '三女', kind: 'member', role: '三女', benmingGua: '兑', color: '#9a5aa0' },
	{ id: 'f-kitchen', label: '厨房灶', short: '灶', kind: 'feature', feature: 'kitchen', color: '#cf1322' },
	{ id: 'f-toilet', label: '厕所', short: '厕', kind: 'feature', feature: 'toilet', color: '#8b5e3c' },
	{ id: 'f-living', label: '客厅', short: '厅', kind: 'feature', feature: 'living', color: '#6b8aa0' },
	{ id: 'f-door', label: '大门', short: '门', kind: 'feature', feature: 'door', color: '#c0883a' },
];

export const WIND_NUMS = new Set([6, 7, 8, 9]);
export const WATER_NUMS = new Set([1, 2, 3, 4]);
export const WIND_COLOR = 'rgb(180, 30, 30)';
export const WATER_COLOR = 'rgb(20, 30, 100)';
export const SNAP_TOLERANCE = 8;
export const HISTORY_LIMIT = 80;

export const TIPS = [
	'楼门朝向以卫星地图为准，门内朝门外，记录真北角度。',
	'家门方向在户型图上画出，令两箭头平行后再判定。',
	'房屋主体以矩形为准，扩大范围导致空缺大于实体时不再扩大。',
	'盘心放在太极点，八方颜色与数字即可判断气位与水位。',
];
export const ADVICE = '气位建议放置：门、窗、灶台、沙发、床、书桌、神龛、宠物床等。水位建议放置：水槽、洗手池、马桶、下水管、洗衣机、厕所等。';

// 罗盘盘面皮肤（纯视觉层；判读始终用 SECTORS 数学）。northOffset 为南上图相对北上盘的旋转校准（预览微调）。
export const DISK_SKINS = [
	{ key: 'draw', label: '绘制盘', src: null, northOffset: 0, scale: 1 },
	{ key: 'naqi-luopan', label: '纳气罗盘', src: '/fengshui/skins/naqi-luopan.png', northOffset: 180, scale: 1 },
	{ key: 'bagua-24', label: '二十四山阳宅图', src: '/fengshui/skins/bagua-24.png', northOffset: 180, scale: 1 },
];

const SECTOR_INDEX = {};
SECTORS.forEach((s, i) => { SECTOR_INDEX[s.num] = i; });
// 扇区物理相邻（数组循环，相差 ≤1）——用于厨房洗菜池归类（与灶台同/邻扇区）。
export function sectorAdjacent(a, b) {
	const ia = SECTOR_INDEX[a];
	const ib = SECTOR_INDEX[b];
	if (ia === undefined || ib === undefined) return false;
	const d = Math.abs(ia - ib);
	return d === 0 || d === 1 || d === SECTORS.length - 1;
}
