// 星盘圆盘 · 显示口径与配色:逆行 / 留驻 / 分数字墨色、深色盘填充透明度、黄道 / 宫制 / 显示模式解析与文案、填色亮度判定、盘式档
// 从 AstroChartCircle.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import * as AstroConst from '../../../constants/AstroConst';
import * as AstroText from '../../../constants/AstroText';
import * as d3 from 'd3';

// 逆行 / 留驻标与分数字的颜色在盘面调色板里按主题成对(Retrograde / StationS / StationD / MinuteText),画的那一刻读:
// 旧的模块常量只为亮盘挑(逆行暗红在暗盘底上 2.1:1、留驻琥珀在亮盘底上 2.3:1)。
const retrogradeInk = ()=>AstroConst.AstroColor.Retrograde;
export const minuteInk = ()=>AstroConst.AstroColor.MinuteText;
export const stationInk = (v)=>(v === 'S' ? AstroConst.AstroColor.StationS : (v === 'D' ? AstroConst.AstroColor.StationD : retrogradeInk()));
export const DARK_SIGN_FILL_OPACITY = 0.18;
export const DARK_HOUSE_FILL_OPACITY = 0.36;
export const KEY_HOUSE_FILL_OPACITY = 0.18;
export const NON_KEY_HOUSE_MASK_OPACITY = 0.08;

const ZODIACAL_LABELS = {
	0: '回归黄道',
	1: '恒星黄道',
	'0': '回归黄道',
	'1': '恒星黄道',
	[AstroConst.TROPICAL]: '回归黄道',
	[AstroConst.SIDEREAL]: '恒星黄道',
};

function resolveChartCircleZodiacal(value, ayanKey){
	if(value === undefined || value === null || value === ''){
		return null;
	}
	// 恒星黄道:拼上具体 ayanāṃśa(恒星黄道·Raman),复用统一口径;无具体岁差则退「恒星黄道」。
	const isSid = value === AstroConst.SIDEREAL || `${value}` === '1' || value === '恒星黄道';
	if(isSid){
		return AstroConst.zodiacalDisplayText(AstroConst.SIDEREAL, ayanKey);
	}
	return ZODIACAL_LABELS[value] || AstroText.AstroMsg[value] || AstroText.AstroTxtMsg[value] || `${value}`;
}

function resolveChartCircleHouseSystem(value){
	if(value === undefined || value === null || value === ''){
		return null;
	}
	return AstroConst.HouseSys[`${value}`] || AstroText.AstroMsg[value] || `${value}`;
}

export function resolveChartCircleDisplayMode(params = {}){
	return {
		zodiacal: resolveChartCircleZodiacal(params.zodiacal, params.siderealAyanamsa),
		hsys: resolveChartCircleHouseSystem(params.hsys),
	};
}

export function buildChartCircleDisplayModeText(params = {}){
	const display = resolveChartCircleDisplayMode(params);
	return [display.zodiacal, display.hsys].filter(Boolean).join('，');
}

function isTransparentFill(fill){
	return fill === undefined || fill === null || `${fill}`.toLowerCase() === 'transparent';
}

function getColorLuminance(fill){
	const color = d3.color(fill);
	if(!color){
		return 255;
	}
	return (0.2126 * color.r) + (0.7152 * color.g) + (0.0722 * color.b);
}

function isDarkChartTheme(){
	return getColorLuminance(AstroConst.AstroColor.ChartBackgroud) < 80;
}

export function getChartLayerFillOpacity(fill, darkOpacity){
	if(isTransparentFill(fill)){
		return 1;
	}
	return isDarkChartTheme() ? darkOpacity : 1;
}

export const ChartStyleProfiles = {
	[AstroConst.CHART_STYLE_CURRENT]: {
		outerMode: 'cusp',
		starScale: 1.04,
		innerHouseScale: 1,
		forceFlags: 0,
		clearFlags: 0,
	},
	[AstroConst.CHART_STYLE_ORIGINAL]: {
		outerMode: 'zodiac',
		starScale: 1.04,
		innerHouseScale: 1,
		forceFlags: 0,
		clearFlags: 0,
	},
};
