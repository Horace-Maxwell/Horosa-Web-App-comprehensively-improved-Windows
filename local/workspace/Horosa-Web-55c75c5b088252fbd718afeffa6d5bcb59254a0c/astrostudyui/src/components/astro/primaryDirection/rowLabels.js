// 主限法表 · 行的标签:相位符号与平行轴名、迫星类型标签与相位符号、迫星扩展筛选、核心支持星体、行的相位方向
// 从 AstroPrimaryDirection.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { parsePdStarPointId } from '../../../utils/primaryDirectionSync';
import * as AstroConst from '../../../constants/AstroConst';

export const PD_ASPECT_GLYPHS = { 0: '☌', 60: '✶', 90: '□', 120: '△', 180: '☍' };
// 平行行第三段=物理轴名(MER 子午/HOR 地平;后端两路径统一,轴收敛后不再有 180/270)。
// 数字键仅为旧档快照兼容:两后端域(MC=0 vs ASC=0)对数字异义,无法可靠回译轴名,
// 故旧数字统一显示中性「平行轴·N°」而非臆断 MC/ASC。
const PD_AXIS_LABEL = { MER: '子午轴', HOR: '地平轴' };

// 迫星 ID → 类型标签(Aspect / Type 列)。ID 语法 <prefix>_<body>_<third>。
function pdRowTypeLabel(promId){
	const star = parsePdStarPointId(promId);
	if(star){
		if(star.head === 'D' || star.head === 'S'){
			return `${PD_ASPECT_GLYPHS[star.deg] || ''} 恒星相位${star.deg}°（${star.head === 'D' ? '右' : '左'}）`;
		}
		return star.deg === 180 ? '☍ 恒星冲' : '恒星';
	}
	const parts = `${promId || ''}`.split('_');
	const prefix = parts[0] || '';
	const third = parts.length >= 3 ? parts[2] : '0';
	const asp = Number(third);
	if(prefix === 'N'){
		if(Number.isFinite(asp) && asp === 180){ return '☍ 冲'; }
		return '☌ 本体';
	}
	if(prefix === 'D' || prefix === 'S'){
		const g = PD_ASPECT_GLYPHS[asp] || '';
		return `${g} 相位${asp || ''}°（${prefix === 'D' ? '右' : '左'}）`;
	}
	if(prefix === 'A'){ return '映点'; }
	if(prefix === 'C'){ return '反映点'; }
	if(prefix === 'PD'){ return '赤纬平行'; }
	if(prefix === 'PC'){ return '赤纬反平行'; }
	if(prefix === 'MP'){ return `世界平行·${PD_AXIS_LABEL[third] || (Number.isFinite(asp) ? `平行轴${asp}°` : third)}`; }
	if(prefix === 'RP'){ return `急动平行·${PD_AXIS_LABEL[third] || (Number.isFinite(asp) ? `平行轴${asp}°` : third)}`; }
	if(prefix === 'T'){ return '界分界'; }
	if(prefix === 'HC'){ return '宫始点'; }
	if(prefix === 'FS'){ return '恒星'; }
	if(prefix === 'LT'){ return '阿拉伯点'; }
	return prefix || '—';
}

// 迫星行相位 glyph(融合进迫星列;合/冲走 N 前缀单点,60/90/120 走 D/S 双侧)
function pdRowAspectGlyph(promId){
	const parts = `${promId || ''}`.split('_');
	const star = parsePdStarPointId(promId);
	const prefix = star ? star.head : (parts[0] || '');
	const asp = star ? star.deg : Number(parts.length >= 3 ? parts[2] : 0);
	if(prefix === 'N' && asp === 0){ return '☌'; }
	if(prefix === 'N' && asp === 180){ return '☍'; }
	if((prefix === 'D' || prefix === 'S') && PD_ASPECT_GLYPHS[asp]){ return PD_ASPECT_GLYPHS[asp]; }
	return '';
}

// 迫星列「相位/类型」筛选维(与星名筛选同列并存,value 前缀分流)
export const PD_PROM_FILTER_EXTRA = [
	{ text: '☌ 合相', value: 'ASP:0' },
	{ text: '✶ 六合 60°', value: 'ASP:60' },
	{ text: '□ 刑 90°', value: 'ASP:90' },
	{ text: '△ 拱 120°', value: 'ASP:120' },
	{ text: '☍ 冲 180°', value: 'ASP:180' },
	{ text: '右相位', value: 'HAND:dexter' },
	{ text: '左相位', value: 'HAND:sinister' },
	{ text: '映点/反映点', value: 'TYPE:anti' },
	{ text: '平行族', value: 'TYPE:par' },
	{ text: '界分界', value: 'TYPE:term' },
	{ text: '宫始点', value: 'TYPE:cusp' },
	{ text: '恒星', value: 'TYPE:star' },
	{ text: '阿拉伯点', value: 'TYPE:lot' },
];

export function pdPromFilterMatch(value, promId){
	const parts = `${promId || ''}`.split('_');
	const star = parsePdStarPointId(promId);
	// 恒星行按其相位参与「相位 / 方向」筛选,类型筛选另认 star
	const prefix = star ? star.head : (parts[0] || '');
	const asp = star ? star.deg : Number(parts.length >= 3 ? parts[2] : 0);
	if(`${value}`.indexOf('ASP:') === 0){
		const want = Number(`${value}`.slice(4));
		if(want === 0){ return prefix === 'N' && asp === 0; }
		if(want === 180){ return prefix === 'N' && asp === 180; }
		return (prefix === 'D' || prefix === 'S') && asp === want;
	}
	// 相位方向(用户点单:进迫星列筛选,与相位/类型维并存):判定与行文案渲染同前缀源
	// (D()/S() 的「右相位处/左相位处」),D_=右 dexter / S_=左 sinister;无方向行不命中。
	if(`${value}`.indexOf('HAND:') === 0){ return directionRowAspectHand(promId) === `${value}`.slice(5); }
	if(value === 'TYPE:anti'){ return prefix === 'A' || prefix === 'C'; }
	if(value === 'TYPE:par'){ return prefix === 'PD' || prefix === 'PC' || prefix === 'MP' || prefix === 'RP'; }
	if(value === 'TYPE:term'){ return prefix === 'T'; }
	if(value === 'TYPE:cusp'){ return prefix === 'HC'; }
	if(value === 'TYPE:star'){ return !!star; }
	if(value === 'TYPE:lot'){ return prefix === 'LT'; }
	return null;   // 非扩展值 → 交回星名 indexOf
}
export const CORE_PD_SUPPORTED_BASE_IDS = new Set([
	AstroConst.SUN,
	AstroConst.MOON,
	AstroConst.MERCURY,
	AstroConst.VENUS,
	AstroConst.MARS,
	AstroConst.JUPITER,
	AstroConst.SATURN,
	AstroConst.URANUS,
	AstroConst.NEPTUNE,
	AstroConst.PLUTO,
	AstroConst.NORTH_NODE,
	AstroConst.PARS_FORTUNA,
	AstroConst.ASC,
	AstroConst.MC,
	AstroConst.VERTEX,
]);

// 行的相位方向:促发 ID 前缀 D_=右相位(dexter)/S_=左相位(sinister)——与行文案渲染
// (下方 D()/S() 的「右相位处/左相位处」)同一前缀源,天然零分叉;其余(N_/A_/C_/T_)无方向。
// 消费方=迫星列筛选 pdPromFilterMatch 的 HAND: 分支(用户点单:筛选入口在列头下拉)。
export function directionRowAspectHand(promittor){
	const star = parsePdStarPointId(promittor);
	if(star){
		return star.head === 'D' ? 'dexter' : (star.head === 'S' ? 'sinister' : null);
	}
	const id = `${promittor || ''}`;
	if(id.indexOf('D_') === 0){ return 'dexter'; }
	if(id.indexOf('S_') === 0){ return 'sinister'; }
	return null;
}
