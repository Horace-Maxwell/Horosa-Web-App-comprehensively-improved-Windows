import { Component } from 'react';
import { Card, Spin, Row, Col, Select, Button, message } from 'antd';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { splitDegree, convertLatToStr, convertLonToStr } from '../astro/AstroHelper';
import * as LRConst from '../liureng/LRConst';
import ChuangChart from '../liureng/ChuangChart';
import {
	PAIPAN_OPTIONS,
	ZHISHI_OPTIONS,
	YUEJIA_QIJU_OPTIONS,
	QIJU_METHOD_OPTIONS,
	KONG_MODE_OPTIONS,
	MA_MODE_OPTIONS,
	YIXING_OPTIONS,
	calcDunJia,
} from '../dunjia/DunJiaCalc';
import GeoCoordModal from '../amap/GeoCoordModal';
import PlusMinusTime from '../astro/PlusMinusTime';
import DateTime from '../comp/DateTime';
import { getStore } from '../../utils/storageutil';
import { getHousesOption } from '../comp/CompHelper';
import {
	setNongliLocalCache,
	setJieqiSeedLocalCache,
} from '../../utils/localCalcCache';
import {
	fetchPreciseNongli,
	fetchPreciseJieqiSeed,
	warmupCache,
} from '../../utils/preciseCalcBridge';
import styles from './SanShiUnitedMain.less';

const { Option } = Select;
const BRANCH_ORDER = '子丑寅卯辰巳午未申酉戌亥'.split('');
const PALACE_GRID = {
	1: { row: 2, col: 2 },
	2: { row: 2, col: 3 },
	3: { row: 2, col: 4 },
	4: { row: 3, col: 2 },
	5: { row: 3, col: 3 },
	6: { row: 3, col: 4 },
	7: { row: 4, col: 2 },
	8: { row: 4, col: 3 },
	9: { row: 4, col: 4 },
};

const QIMEN_OPTIONS = {
	sex: 1,
	dateType: 0,
	leapMonthType: 0,
	xuShiSuiType: 0,
	jieQiType: 1,
	paiPanType: 3,
	zhiShiType: 0,
	yueJiaQiJuType: 1,
	yearGanZhiType: 2,
	monthGanZhiType: 1,
	dayGanZhiType: 1,
	qijuMethod: 'zhirun',
	kongMode: 'day',
	yimaMode: 'day',
	shiftPalace: 0,
	fengJu: false,
};

const OUTER_RING_LAYOUT = [
	{ branch: '巳', side: 'top', x0: 11.1, x1: 33.33, y0: 0, y1: 11.1 },
	{ branch: '午', side: 'top', x0: 33.33, x1: 66.67, y0: 0, y1: 11.1 },
	// 未宫：向右移动1.5个单位
	{ branch: '未', side: 'top', x0: 68.17, x1: 90.4, y0: 0, y1: 11.1 },
	// 申宫：向上移动1个单位
	{ branch: '申', side: 'right', x0: 88.9, x1: 100, y0: 10.1, y1: 32.33 },
	{ branch: '酉', side: 'right', x0: 88.9, x1: 100, y0: 33.33, y1: 66.67 },
	// 戌宫：向下移动1个单位
	{ branch: '戌', side: 'right', x0: 88.9, x1: 100, y0: 67.67, y1: 89.9 },
	// 亥宫：向右移动1.5个单位
	{ branch: '亥', side: 'bottom', x0: 68.17, x1: 90.4, y0: 88.9, y1: 100 },
	{ branch: '子', side: 'bottom', x0: 33.33, x1: 66.67, y0: 88.9, y1: 100 },
	{ branch: '丑', side: 'bottom', x0: 11.1, x1: 33.33, y0: 88.9, y1: 100 },
	// 寅宫：向下移动1个单位
	{ branch: '寅', side: 'left', x0: 0, x1: 11.1, y0: 67.67, y1: 89.9 },
	{ branch: '卯', side: 'left', x0: 0, x1: 11.1, y0: 33.33, y1: 66.67 },
	// 辰宫：向上移动1个单位
	{ branch: '辰', side: 'left', x0: 0, x1: 11.1, y0: 10.1, y1: 32.33 },
];

const LIURENG_RING_LAYOUT = {
	// 四正位：放在六壬环四边中央（合并后的主宫位）
	午: { left: '50%', top: '27.8%', kind: 'cardinal' },
	酉: { left: '72.2%', top: '50%', kind: 'cardinal' },
	子: { left: '50%', top: '72.2%', kind: 'cardinal' },
	卯: { left: '27.8%', top: '50%', kind: 'cardinal' },

	// 四角八三角：落点使用各三角形重心，确保文字在三角区域内
	巳: { left: '29.6%', top: '25.9%', kind: 'corner' }, // 西北角-上三角
	辰: { left: '25.9%', top: '29.6%', kind: 'corner' }, // 西北角-下三角

	未: { left: '70.4%', top: '25.9%', kind: 'corner' }, // 东北角-上三角
	申: { left: '74.1%', top: '29.6%', kind: 'corner' }, // 东北角-下三角

	戌: { left: '74.1%', top: '70.4%', kind: 'corner' }, // 东南角-上三角
	亥: { left: '70.4%', top: '74.1%', kind: 'corner' }, // 东南角-下三角

	丑: { left: '29.6%', top: '74.1%', kind: 'corner' }, // 西南角-下三角
	寅: { left: '25.9%', top: '70.4%', kind: 'corner' }, // 西南角-上三角
};

function needJieqiYearSeed(options){
	const opt = options || {};
	return opt.paiPanType === 3 && opt.qijuMethod === 'zhirun';
}

const QIMEN_RING_POSITIONS = {
	1: { left: '16.7%', top: '16.7%' },
	2: { left: '50%', top: '16.7%' },
	3: { left: '83.3%', top: '16.7%' },
	4: { left: '16.7%', top: '50%' },
	6: { left: '83.3%', top: '50%' },
	7: { left: '16.7%', top: '83.3%' },
	8: { left: '50%', top: '83.3%' },
	9: { left: '83.3%', top: '83.3%' },
};
const QIMEN_CORNER_PALACES = new Set([1, 3, 7, 9]);

const MAIN_STAR_IDS = new Set([
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
	AstroConst.ASC,
	AstroConst.MC,
]);

const GAME_TYPE_OPTIONS = [
	{ value: 'ming', label: '命局' },
	{ value: 'shi', label: '事局' },
];

const SEX_OPTIONS = [
	{ value: 1, label: '男' },
	{ value: 0, label: '女' },
];

const GUIRENG_OPTIONS = [
	{ value: 0, label: '六壬法贵人' },
	{ value: 1, label: '遁甲法贵人' },
	{ value: 2, label: '星占法贵人' },
];

const SANSHI_BOARD_MIN = 240;
const SANSHI_BOARD_MAX = 980;
const SANSHI_BOARD_BASE = 700;
const SANSHI_SCALE_MIN = 0.45;
const SANSHI_SCALE_MAX = 1.35;
const SANSHI_VERTICAL_RESERVED = 350;
const SANSHI_WIDTH_PADDING = 10;
const SANSHI_FONT_STACK = "'Microsoft YaHei', 'PingFang SC', 'Noto Sans CJK SC', 'Source Han Sans SC', sans-serif";

// 根据窗口高度动态计算面板最大尺寸
function getDynamicBoardMax(viewportHeight, hostWidth) {
	const byHeight = Math.max(SANSHI_BOARD_MIN, Math.round(viewportHeight - SANSHI_VERTICAL_RESERVED));
	const byWidth = Number.isFinite(hostWidth) && hostWidth > 0
		? Math.round(hostWidth - SANSHI_WIDTH_PADDING)
		: (typeof window !== 'undefined' ? Math.round((window.innerWidth || 1200) * 0.66) : SANSHI_BOARD_BASE);
	return Math.min(Math.max(SANSHI_BOARD_MIN, Math.min(byHeight, byWidth)), SANSHI_BOARD_MAX);
}

function clamp(val, min, max){
	return Math.max(min, Math.min(max, val));
}

function getViewportHeight(){
	if(typeof window !== 'undefined' && window.visualViewport && Number.isFinite(window.visualViewport.height) && window.visualViewport.height > 0){
		return Math.round(window.visualViewport.height);
	}
	if(typeof window !== 'undefined' && Number.isFinite(window.innerHeight) && window.innerHeight > 0){
		return window.innerHeight;
	}
	if(typeof document !== 'undefined' && document.documentElement){
		return document.documentElement.clientHeight || 900;
	}
	return 900;
}

function safe(v, d = ''){
	return v === undefined || v === null ? d : v;
}

function buildSanShiPerf(source, nongliMs, recalcMs, totalMs){
	return {
		source: source || '',
		nongliMs: Number.isFinite(nongliMs) ? Math.max(0, Math.round(nongliMs)) : 0,
		recalcMs: Number.isFinite(recalcMs) ? Math.max(0, Math.round(recalcMs)) : 0,
		totalMs: Number.isFinite(totalMs) ? Math.max(0, Math.round(totalMs)) : 0,
		at: Date.now(),
	};
}

const TIANJIANG_SHORT_MAP = {
	贵人: '贵',
	螣蛇: '蛇',
	腾蛇: '蛇',
	朱雀: '朱',
	六合: '合',
	勾陈: '勾',
	青龙: '龙',
	天空: '空',
	白虎: '虎',
	太常: '常',
	玄武: '玄',
	太阴: '阴',
	天后: '后',
};

function shortTianJiang(name){
	const text = `${safe(name, '')}`.trim();
	if(!text){
		return '—';
	}
	if(TIANJIANG_SHORT_MAP[text]){
		return TIANJIANG_SHORT_MAP[text];
	}
	if(text.length === 1){
		return text;
	}
	if(text.startsWith('天') || text.startsWith('太')){
		return text.substring(text.length - 1);
	}
	return text.substring(0, 1);
}

function splitGanZhi(gz){
	const text = `${safe(gz, '')}`.trim();
	if(!text){
		return { gan: '', zhi: '—' };
	}
	const chars = text.split('');
	const first = chars[0] || '';
	const last = chars[chars.length - 1] || '';
	const hasGan = LRConst.GanList.indexOf(first) >= 0;
	return {
		gan: hasGan ? first : '',
		zhi: last || '—',
	};
}

function getGanzhiParts(gz){
	return {
		gan: (gz || '').substring(0, 1) || ' ',
		zhi: (gz || '').substring(1, 2) || ' ',
	};
}

function fmtSolar(fields){
	if(!fields || !fields.date || !fields.time){
		return { date: '', hm: '' };
	}
	return {
		date: fields.date.value.format('YYYY-MM-DD'),
		hm: fields.time.value.format('HH:mm'),
	};
}

function fmtLunar(nongli){
	if(!nongli){
		return '';
	}
	return `农历${safe(nongli.month)}${safe(nongli.day)}`;
}

function msg(key){
	return AstroText.AstroMsgCN[key] || key || '';
}

function shortMainStarLabel(name){
	const text = `${safe(name, '')}`.trim();
	if(!text){
		return '';
	}
	if(text === '太阳'){
		return '日';
	}
	return text.substring(0, 1);
}

function getFieldKey(fields){
	if(!fields || !fields.date || !fields.time){
		return '';
	}
	return [
		fields.date.value.format('YYYY-MM-DD'),
		fields.time.value.format('HH:mm:ss'),
		safe(fields.zone && fields.zone.value),
		safe(fields.lon && fields.lon.value),
		safe(fields.lat && fields.lat.value),
		safe(fields.ad && fields.ad.value),
	].join('|');
}

function getNongliKey(nongli){
	if(!nongli){
		return '';
	}
	return [
		safe(nongli.yearGanZi),
		safe(nongli.monthGanZi),
		safe(nongli.dayGanZi),
		safe(nongli.time),
		safe(nongli.jieqi),
		safe(nongli.runyear),
	].join('|');
}

function getQimenOptionsKey(options){
	if(!options){
		return '';
	}
	return [
		safe(options.sex),
		safe(options.dateType),
		safe(options.leapMonthType),
		safe(options.xuShiSuiType),
		safe(options.jieQiType),
		safe(options.paiPanType),
		safe(options.zhiShiType),
		safe(options.yueJiaQiJuType),
		safe(options.yearGanZhiType),
		safe(options.monthGanZhiType),
		safe(options.dayGanZhiType),
		safe(options.qijuMethod),
		safe(options.kongMode),
		safe(options.yimaMode),
		safe(options.shiftPalace),
		options.fengJu ? 1 : 0,
	].join('|');
}

function buildWarmupPayload(fields, fallbackGender){
	if(!fields || !fields.date || !fields.time || !fields.zone || !fields.lon || !fields.lat){
		return null;
	}
	return {
		date: fields.date.value.format('YYYY-MM-DD'),
		time: fields.time.value.format('HH:mm:ss'),
		zone: fields.zone.value,
		lon: fields.lon.value,
		lat: fields.lat.value,
		gpsLat: fields.gpsLat ? fields.gpsLat.value : '',
		gpsLon: fields.gpsLon ? fields.gpsLon.value : '',
		ad: fields.ad ? fields.ad.value : 1,
		gender: fields.gender ? fields.gender.value : fallbackGender,
	};
}

function toBirthText(fields){
	if(!fields || !fields.date || !fields.time){
		return '';
	}
	return `${fields.date.value.format('YYYY-MM-DD')} ${fields.time.value.format('HH:mm:ss')}`;
}

function normalizeBirthText(txt){
	return `${txt || ''}`.trim().replace(/\//g, '-');
}

function pickChartNongli(fields, chartWrap){
	if(!chartWrap){
		return null;
	}
	const chart = chartWrap.chart ? chartWrap.chart : chartWrap;
	if(!chart || !chart.nongli){
		return null;
	}
	const params = chartWrap.params || {};
	const birthFromChart = normalizeBirthText(params.birth);
	const birthFromFields = normalizeBirthText(toBirthText(fields));
	if(birthFromChart && birthFromFields && birthFromChart !== birthFromFields){
		return null;
	}
	return chart.nongli;
}

function extractIsDiurnalFromChartWrap(chartWrap){
	if(!chartWrap){
		return null;
	}
	const chart = chartWrap.chart ? chartWrap.chart : chartWrap;
	if(chart && chart.isDiurnal !== undefined && chart.isDiurnal !== null){
		return !!chart.isDiurnal;
	}
	return null;
}

function getChartYue(chartObj){
	if(!chartObj || !chartObj.objects){
		return '';
	}
	for(let i=0; i<chartObj.objects.length; i++){
		const obj = chartObj.objects[i];
		if(obj.id === AstroConst.SUN){
			return LRConst.getSignZi(obj.sign);
		}
	}
	return '';
}

function buildLiuRengLayout(chartObj, guirengType){
	if(!chartObj || !chartObj.nongli || !chartObj.nongli.time){
		return null;
	}
	const yue = getChartYue(chartObj);
	if(!yue){
		return null;
	}
	const downZi = LRConst.ZiList.slice(0);
	const upZi = LRConst.ZiList.slice(0);
	const yueIndexs = [];
	const timezi = chartObj.nongli.time.substr(1);
	const yueIdx = LRConst.ZiList.indexOf(yue);
	const tmIdx = LRConst.ZiList.indexOf(timezi);
	if(yueIdx < 0 || tmIdx < 0){
		return null;
	}
	const delta = yueIdx - tmIdx;
	for(let i=0; i<12; i++){
		const idx = (i + delta + 12) % 12;
		yueIndexs[i] = idx;
		upZi[i] = LRConst.ZiList[idx];
	}

	const houseTianJiang = LRConst.TianJiang.slice(0);
	const guizi = LRConst.getGuiZi(chartObj, guirengType === undefined ? 2 : guirengType);
	let houseidx = 0;
	for(let i=0; i<12; i++){
		const zi = LRConst.ZiList[yueIndexs[i]];
		if(zi === guizi){
			houseidx = i;
			break;
		}
	}
	const housezi = LRConst.ZiList[houseidx];
	if(LRConst.SummerZiList.indexOf(housezi) >= 0){
		for(let i=0; i<12; i++){
			const idx = (houseidx - i + 12) % 12;
			houseTianJiang[i] = LRConst.TianJiang[idx];
		}
	}else{
		for(let i=0; i<12; i++){
			const idx = (i - houseidx + 12) % 12;
			houseTianJiang[i] = LRConst.TianJiang[idx];
		}
	}
	return { yue, timezi, guizi, downZi, upZi, houseTianJiang };
}

function buildLrNongli(nongli, dunjia){
	const dayGanZi = dunjia && dunjia.ganzhi ? (dunjia.ganzhi.day || '') : '';
	const timeGanZi = dunjia && dunjia.ganzhi ? (dunjia.ganzhi.time || '') : '';
	return {
		...(nongli || {}),
		dayGanZi: dayGanZi || (nongli && nongli.dayGanZi ? nongli.dayGanZi : ''),
		time: timeGanZi || (nongli && nongli.time ? nongli.time : ''),
	};
}

function buildKeData(layout, chartObj){
	const result = { raw: [], lines: [] };
	if(!layout || !chartObj || !chartObj.nongli || !chartObj.nongli.dayGanZi){
		return result;
	}
	const dayGanZi = chartObj.nongli.dayGanZi;
	const daygan = dayGanZi.substr(0, 1);
	const dayzi = dayGanZi.substr(1, 1);

	const idx1 = layout.downZi.indexOf(LRConst.GanJiZi[daygan]);
	if(idx1 < 0){
		return result;
	}
	const ke1zi = layout.upZi[idx1];
	const ke1 = [layout.houseTianJiang[idx1], ke1zi, daygan];

	const idx2 = layout.downZi.indexOf(ke1zi);
	const ke2zi = idx2 >= 0 ? layout.upZi[idx2] : '';
	const ke2 = [idx2 >= 0 ? layout.houseTianJiang[idx2] : '', ke2zi, ke1zi];

	const idx3 = layout.downZi.indexOf(dayzi);
	const ke3zi = idx3 >= 0 ? layout.upZi[idx3] : '';
	const ke3 = [idx3 >= 0 ? layout.houseTianJiang[idx3] : '', ke3zi, dayzi];

	const idx4 = layout.downZi.indexOf(ke3zi);
	const ke4zi = idx4 >= 0 ? layout.upZi[idx4] : '';
	const ke4 = [idx4 >= 0 ? layout.houseTianJiang[idx4] : '', ke4zi, ke3zi];

	result.raw = [ke1, ke2, ke3, ke4];
	result.lines = [
		`四课 ${ke1[2]}${ke1[1]}${ke1[0]}`,
		`三课 ${ke2[2]}${ke2[1]}${ke2[0]}`,
		`二课 ${ke3[2]}${ke3[1]}${ke3[0]}`,
		`一课 ${ke4[2]}${ke4[1]}${ke4[0]}`,
	];
	return result;
}

function buildSanChuan(layout, keRaw, chartObj){
	if(!layout || !keRaw || keRaw.length !== 4 || !chartObj || !chartObj.nongli){
		return null;
	}
	try{
		const helper = new ChuangChart({
			owner: null,
			chartObj: chartObj,
			nongli: chartObj.nongli,
			ke: keRaw,
			liuRengChart: {
				upZi: layout.upZi,
				downZi: layout.downZi,
				houseTianJiang: layout.houseTianJiang,
			},
			x: 0,
			y: 0,
			width: 0,
			height: 0,
		});
		helper.genCuangs();
		return helper.cuangs || null;
	}catch(e){
		return null;
	}
}

function normalizeLon(v){
	let lon = parseFloat(v);
	if(Number.isNaN(lon)){
		return null;
	}
	lon = ((lon % 360) + 360) % 360;
	return lon;
}

function lonToBranch(lon){
	const nlon = normalizeLon(lon);
	if(nlon === null){
		return '';
	}
	// 星座-地支固定映射：
	// 水瓶-子、摩羯-丑、射手-寅、天蝎-卯、天秤-辰、处女-巳、
	// 狮子-午、巨蟹-未、双子-申、金牛-酉、白羊-戌、双鱼-亥
	const signIdx = Math.floor(nlon / 30) % 12; // 白羊=0 ... 双鱼=11
	const branchIdx = (10 - signIdx + 12) % 12;
	return BRANCH_ORDER[branchIdx];
}

function signToBranch(sign){
	if(!sign){
		return '';
	}
	try{
		return LRConst.getSignZi(sign) || '';
	}catch(e){
		return '';
	}
}

function resolveObjBranch(obj){
	if(!obj){
		return '';
	}
	const bySign = signToBranch(obj.sign);
	if(bySign){
		return bySign;
	}
	return lonToBranch(obj.lon);
}

function parseHouseNum(houseId){
	if(!houseId){
		return '';
	}
	const m = `${houseId}`.match(/\d+/);
	return m ? m[0] : '';
}

function buildOuterData(chartObj){
	const housesByBranch = {};
	const starsByBranch = {};
	BRANCH_ORDER.forEach((b)=>{
		housesByBranch[b] = [];
		starsByBranch[b] = [];
	});
	if(!chartObj){
		return { housesByBranch, starsByBranch };
	}
	const objs = chartObj.objects || [];
	let ascBranch = '';
	for(let i=0; i<objs.length; i++){
		const obj = objs[i];
		if(obj && obj.id === AstroConst.ASC){
			ascBranch = resolveObjBranch(obj);
			break;
		}
	}
	const ascIdx = BRANCH_ORDER.indexOf(ascBranch);
	if(ascIdx >= 0){
		// 人事宫位：从上升1宫开始，逆时针排布
		for(let houseNo = 1; houseNo <= 12; houseNo++){
			const idx = (ascIdx - (houseNo - 1) + 12) % 12;
			housesByBranch[BRANCH_ORDER[idx]].push(`${houseNo}`);
		}
	}else{
		// 兜底：若ASC缺失则回退到按宫头经度映射
		const houses = chartObj.houses || [];
		houses.forEach((h)=>{
			const b = signToBranch(h.sign) || lonToBranch(h.lon);
			if(!b){
				return;
			}
			const txt = parseHouseNum(h.id);
			if(txt && housesByBranch[b].indexOf(txt) < 0){
				housesByBranch[b].push(txt);
			}
		});
	}

	const starsByBranchRaw = {};
	BRANCH_ORDER.forEach((b)=>{ starsByBranchRaw[b] = []; });
	objs.forEach((obj)=>{
		if(!MAIN_STAR_IDS.has(obj.id)){
			return;
		}
		const b = resolveObjBranch(obj);
		if(!b){
			return;
		}
		const deg = splitDegree(obj.signlon || 0);
		const retro = obj.lonspeed < 0 ? 'R' : '';
			const txt = `${shortMainStarLabel(msg(obj.id))}${safe(deg[0], 0)}${retro}`;
		starsByBranchRaw[b].push({
			txt,
			deg: Number(safe(deg[0], 0)),
		});
	});
	BRANCH_ORDER.forEach((b)=>{
		starsByBranch[b] = starsByBranchRaw[b]
			.sort((a, c)=>a.deg - c.deg)
			.map((item)=>item.txt);
	});
	return { housesByBranch, starsByBranch };
}

function buildShenShaMap(dunjia){
	const map = {};
	if(!dunjia || !dunjia.shenSha || !dunjia.shenSha.allItems){
		return map;
	}
	dunjia.shenSha.allItems.forEach((item)=>{
		map[item.name] = item.value;
	});
	// 兼容不同命名写法，避免取值缺失。
	if(!map.幕贵 && map.墓贵){
		map.幕贵 = map.墓贵;
	}
	if(!map.墓贵 && map.幕贵){
		map.墓贵 = map.幕贵;
	}
	return map;
}

function getOuterLabelLayout(branch, houseFont){
	// 外圈标签逐宫定位：四正宫按矩形角，八斜宫贴到对应三角区角落。
	const px = 1;
	const py = 1;
	const rowGap = Math.max(10, Math.round(houseFont * 0.92));
	const colGap = Math.max(11, Math.round(houseFont * 0.98));
	// 角宫位移：控制在 2~3 格之间，避免过度偏移。
	const shiftStep = Math.max(6, Math.round(houseFont * 0.34));
	const shiftRows = Math.round(shiftStep * 2.4);
	const shiftCols = Math.round(shiftStep * 2.4);
	const oneGridShift = shiftStep;
	const oneAndHalfGridShift = shiftStep * 1.5;
	const twoGridShift = shiftStep * 2;
	const fourGridShift = shiftStep * 4;
	const cornerOffset = '-16%';
	const wideNumGap = colGap + Math.max(8, Math.round(houseFont * 0.5));
	const topLeft = { left: px, top: py };
	const topRight = { right: px, top: py };
	const bottomLeft = { left: px, bottom: py };
	const bottomRight = { right: px, bottom: py };

	switch(branch){
	case '卯': // 左矩形：地支左下，数字左上
		return { house: topLeft, branch: bottomLeft };
	case '酉': // 右矩形：地支右下，数字右上
		return { house: topRight, branch: bottomRight };
	case '子': // 下矩形：地支右下，数字左下
		return { house: bottomLeft, branch: bottomRight };
	case '午': // 上矩形：地支右上，数字左上
		return { house: topLeft, branch: topRight };
	case '巳': // 上偏左梯形：落入左上角三角，数字左上，地支在其右
		return {
			house: { left: `calc(${cornerOffset} + ${shiftCols}px - ${fourGridShift}px - ${oneAndHalfGridShift}px)`, top: py },
			branch: { left: `calc(${cornerOffset} + ${colGap + shiftCols}px - ${fourGridShift}px)`, top: py },
		};
	case '辰': // 左偏上梯形：落入左上角三角，数字左上，地支在其下
		return {
			house: { left: px, top: `calc(${cornerOffset} + ${shiftRows}px - ${fourGridShift}px - ${oneGridShift}px - ${oneGridShift}px)` },
			branch: { left: px, top: `calc(${cornerOffset} + ${rowGap + shiftRows}px - ${fourGridShift}px - ${oneGridShift}px - ${oneGridShift}px)` },
		};
	case '未': // 上偏右梯形：落入右上角三角，数字右上，地支在其左
		return {
			house: { right: `calc(${cornerOffset} + ${shiftCols}px - ${fourGridShift}px - ${oneAndHalfGridShift}px - ${oneAndHalfGridShift}px)`, top: py },
			branch: { right: `calc(${cornerOffset} + ${wideNumGap + shiftCols}px - ${fourGridShift}px - ${oneAndHalfGridShift}px - ${oneAndHalfGridShift}px)`, top: py },
		};
	case '申': // 右偏上梯形：落入右上角三角，数字右上，地支在其下
		return {
			house: { right: px, top: `calc(${cornerOffset} + ${shiftRows}px - ${fourGridShift}px - ${oneGridShift}px - ${oneGridShift}px)` },
			branch: { right: px, top: `calc(${cornerOffset} + ${rowGap + shiftRows}px - ${fourGridShift}px - ${oneGridShift}px - ${oneGridShift}px)` },
		};
	case '戌': // 右偏下梯形：落入右下角三角，数字右下，地支在其上
		return {
			house: { right: px, bottom: `calc(${cornerOffset} + ${shiftRows}px - ${fourGridShift}px - ${oneGridShift}px + ${oneGridShift}px)` },
			branch: { right: px, bottom: `calc(${cornerOffset} + ${rowGap + shiftRows}px - ${fourGridShift}px - ${oneGridShift}px + ${oneGridShift}px)` },
		};
	case '亥': // 下偏右梯形：落入右下角三角，数字右下，地支在其左
		return {
			house: { right: `calc(${cornerOffset} + ${shiftCols}px - ${fourGridShift}px - ${oneAndHalfGridShift}px - ${oneAndHalfGridShift}px)`, bottom: py },
			branch: { right: `calc(${cornerOffset} + ${wideNumGap + shiftCols}px - ${fourGridShift}px - ${oneAndHalfGridShift}px - ${oneAndHalfGridShift}px)`, bottom: py },
		};
	case '丑': // 下偏左梯形：落入左下角三角，数字左下，地支在其右
		return {
			house: { left: `calc(${cornerOffset} + ${shiftCols}px - ${fourGridShift}px - ${oneAndHalfGridShift}px)`, bottom: py },
			branch: { left: `calc(${cornerOffset} + ${colGap + shiftCols}px - ${fourGridShift}px)`, bottom: py },
		};
	case '寅': // 左偏下梯形：落入左下角三角，数字左下，地支在其上
		return {
			house: { left: px, bottom: `calc(${cornerOffset} + ${shiftRows}px - ${fourGridShift}px - ${oneGridShift}px + ${oneGridShift}px)` },
			branch: { left: px, bottom: `calc(${cornerOffset} + ${rowGap + shiftRows}px - ${fourGridShift}px - ${oneGridShift}px + ${oneGridShift}px)` },
		};
	default:
		return { house: topLeft, branch: topRight };
	}
}

function getOuterStarsLayout(branch, starFont){
	const sidePad = 2;
	const topPad = Math.max(8, Math.round(starFont * 1.35));
	const bottomPad = Math.max(8, Math.round(starFont * 1.35));
	const onePerRowBranches = new Set(['寅', '卯', '辰', '申', '酉', '戌']);
	const perRow = onePerRowBranches.has(branch) ? 1 : 3;
	let style = {};
	let rowJustify = 'center';

	switch(branch){
	case '卯':
		style = { left: sidePad, top: '50%', transform: 'translateY(-50%)', textAlign: 'left' };
		rowJustify = 'flex-start';
		break;
	case '酉':
		style = { right: sidePad, top: '50%', transform: 'translateY(-50%)', textAlign: 'right' };
		rowJustify = 'flex-end';
		break;
	case '午':
		style = { left: '50%', top: topPad, transform: 'translateX(-50%)', textAlign: 'center' };
		rowJustify = 'center';
		break;
	case '子':
		style = { left: '50%', bottom: bottomPad, transform: 'translateX(-50%)', textAlign: 'center' };
		rowJustify = 'center';
		break;
	case '巳':
	case '丑':
		style = { right: sidePad, top: '50%', transform: 'translateY(-50%)', textAlign: 'right' };
		rowJustify = 'flex-end';
		break;
	case '亥':
	case '未':
		style = { left: sidePad, top: '50%', transform: 'translateY(-50%)', textAlign: 'left' };
		rowJustify = 'flex-start';
		break;
	case '辰':
		style = { left: sidePad, top: topPad, textAlign: 'left' };
		rowJustify = 'flex-start';
		break;
	case '申':
		style = { right: sidePad, top: topPad, textAlign: 'right' };
		rowJustify = 'flex-end';
		break;
	case '寅':
		style = { left: sidePad, bottom: bottomPad, textAlign: 'left' };
		rowJustify = 'flex-start';
		break;
	case '戌':
		style = { right: sidePad, bottom: bottomPad, textAlign: 'right' };
		rowJustify = 'flex-end';
		break;
	default:
		style = { left: '50%', top: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' };
		rowJustify = 'center';
		break;
	}

	return {
		perRow,
		rowJustify,
		style,
	};
}

function buildPillarFromPan(pan, key){
	if(!pan || !pan.ganzhi){
		return '';
	}
	return pan.ganzhi[key] || '';
}

class SanShiUnitedMain extends Component{
	constructor(props){
		super(props);
		this.state = {
			loading: false,
			nongli: null,
			liureng: null,
			dunjia: null,
			lrLayout: null,
			keData: null,
			sanChuan: null,
			localFields: null,
			hasPlotted: false,
			rightPanelTab: 'overview',
			perf: buildSanShiPerf('', 0, 0, 0),
			options: {
				mode: 'ming',
				sex: 1,
				guireng: 2,
				zodiacal: 0,
				hsys: 0,
				paiPanType: 3,
				zhiShiType: 0,
				yueJiaQiJuType: 1,
				qijuMethod: 'zhirun',
				kongMode: 'day',
				yimaMode: 'day',
				shiftPalace: 0,
			},
			leftBoardWidth: 0,
			viewportHeight: getViewportHeight(),
		};
		this.unmounted = false;
		this.lastKey = '';
		this.lastRestoredCaseId = null;
		this.jieqiSeedPromises = {};
		this.jieqiYearSeeds = {};
		this.timeHook = {};
		this.lastRecalcSignature = '';
		this.refreshSeq = 0;
		this.pendingRefresh = null;
		this.panCache = new Map();
		this.lrBundleCache = {};
		this.outerDataCache = { chartRef: null, data: null };
		this.resizeObserver = null;

		this.refreshAll = this.refreshAll.bind(this);
		this.genParams = this.genParams.bind(this);
		this.ensureJieqiSeed = this.ensureJieqiSeed.bind(this);
		this.genJieqiParams = this.genJieqiParams.bind(this);
		this.getQimenOptions = this.getQimenOptions.bind(this);
		this.recalcByNongli = this.recalcByNongli.bind(this);
		this.onFieldsChange = this.onFieldsChange.bind(this);
		this.onTimeChanged = this.onTimeChanged.bind(this);
		this.onGenderChange = this.onGenderChange.bind(this);
		this.onOptionChange = this.onOptionChange.bind(this);
		this.onAstroFieldOptionChange = this.onAstroFieldOptionChange.bind(this);
		this.getTimeFieldsFromSelector = this.getTimeFieldsFromSelector.bind(this);
		this.clickPlot = this.clickPlot.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
		this.clickSave = this.clickSave.bind(this);
		this.parseCasePayload = this.parseCasePayload.bind(this);
		this.restoreOptionsFromCurrentCase = this.restoreOptionsFromCurrentCase.bind(this);
		this.captureLeftBoardHost = this.captureLeftBoardHost.bind(this);
		this.handleWindowResize = this.handleWindowResize.bind(this);

		if(this.props.hook){
			this.props.hook.fun = (fields)=>{
				if(this.unmounted){
					return;
				}
				this.restoreOptionsFromCurrentCase();
				// 三式合一改为严格手动起盘：外部字段变化不自动触发计算。
			};
		}
	}

	getCachedDunJia(fields, nongli, qimenOptions, year, isDiurnal){
		const key = [
			getFieldKey(fields),
			getNongliKey(nongli),
			getQimenOptionsKey(qimenOptions),
			`${year || ''}`,
			`${safe(isDiurnal, '')}`,
		].join('|');
		if(this.panCache.has(key)){
			return this.panCache.get(key);
		}
		const pan = calcDunJia(fields, nongli, qimenOptions, {
			year,
			jieqiYearSeeds: this.jieqiYearSeeds,
			isDiurnal,
		});
		this.panCache.set(key, pan);
		if(this.panCache.size > 48){
			const firstKey = this.panCache.keys().next().value;
			if(firstKey){
				this.panCache.delete(firstKey);
			}
		}
		return pan;
	}

	// 添加 shouldComponentUpdate 来避免不必要的重新渲染
	shouldComponentUpdate(nextProps, nextState){
		// 总是允许渲染 loading 状态变化
		if(this.state.loading !== nextState.loading){
			return true;
		}
		// 允许 dunjia 变化
		if(this.state.dunjia !== nextState.dunjia){
			return true;
		}
		// 允许 nongli 变化
		if(this.state.nongli !== nextState.nongli){
			return true;
		}
		// 允许 hasPlotted 变化
		if(this.state.hasPlotted !== nextState.hasPlotted){
			return true;
		}
		// 允许 rightPanelTab 变化
		if(this.state.rightPanelTab !== nextState.rightPanelTab){
			return true;
		}
		// 允许 perf 变化
		if(this.state.perf !== nextState.perf){
			return true;
		}
		// 允许 localFields 时间变化
		if(this.state.localFields !== nextState.localFields){
			const curr = this.state.localFields;
			const next = nextState.localFields;
			if(curr && next){
				const currTime = curr.time && curr.time.value ? curr.time.value.format('YYYY-MM-DD HH:mm:ss') : '';
				const nextTime = next.time && next.time.value ? next.time.value.format('YYYY-MM-DD HH:mm:ss') : '';
				if(currTime !== nextTime){
					return true;
				}
			}
		}
		// 允许 viewport 变化
		if(this.state.viewportHeight !== nextState.viewportHeight || this.state.leftBoardWidth !== nextState.leftBoardWidth){
			return true;
		}
		// 允许 options 变化
		if(this.state.options !== nextState.options){
			return true;
		}
		// 其他情况不重新渲染
		return false;
	}

	componentDidMount(){
		this.unmounted = false;
		this.restoreOptionsFromCurrentCase(true);
		window.addEventListener('resize', this.handleWindowResize);
		this.handleWindowResize();
		// 预热缓存：提前加载数据以加速起盘
		const fields = this.props.fields;
		if(fields && fields.zone && fields.lon && fields.lat){
			warmupCache({
				date: fields.date && fields.date.value ? fields.date.value.format('YYYY-MM-DD') : undefined,
				time: fields.time && fields.time.value ? fields.time.value.format('HH:mm:ss') : undefined,
				zone: fields.zone.value || '8',
				lon: fields.lon.value || '116.4074',
				lat: fields.lat.value || '39.9042',
				gpsLat: fields.gpsLat ? fields.gpsLat.value : '',
				gpsLon: fields.gpsLon ? fields.gpsLon.value : '',
				ad: fields.ad ? fields.ad.value : 1,
				gender: fields.gender ? fields.gender.value : 1,
			}, { mode: 'light' });
		}
	}

	componentDidUpdate(prevProps){
		const prevKey = getFieldKey(prevProps.fields);
		const nextKey = getFieldKey(this.props.fields);
		if(prevKey !== nextKey){
			this.restoreOptionsFromCurrentCase();
		}
	}

	componentWillUnmount(){
		this.unmounted = true;
		window.removeEventListener('resize', this.handleWindowResize);
		if(this.resizeObserver){
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}
	}

	captureLeftBoardHost(node){
		if(this.resizeObserver){
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}
		this.leftBoardHost = node || null;
		if(this.leftBoardHost && typeof ResizeObserver !== 'undefined'){
			this.resizeObserver = new ResizeObserver(()=>{
				this.handleWindowResize();
			});
			this.resizeObserver.observe(this.leftBoardHost);
		}
		this.handleWindowResize();
	}

	handleWindowResize(){
		const viewportHeight = getViewportHeight();
		// 如果leftBoardHost还没有设置，使用窗口宽度的默认值
		let leftBoardWidth = 0;
		if (this.leftBoardHost) {
			leftBoardWidth = this.leftBoardHost.clientWidth || 0;
		} else if (typeof window !== 'undefined') {
			// 左侧盘面区域约占整页 16/24，取 0.66 作为跨浏览器一致的兜底值。
			leftBoardWidth = Math.round(window.innerWidth * 0.66) || 700;
		}
		// 降低阈值使窗口大小变化时更敏感地更新缩放
		const changed = Math.abs((this.state.leftBoardWidth || 0) - leftBoardWidth) >= 1
			|| Math.abs((this.state.viewportHeight || 0) - viewportHeight) >= 1;
		if(changed){
			this.setState({
				leftBoardWidth,
				viewportHeight,
			});
		}
	}

	getActiveFields(){
		return this.state.localFields || this.props.fields || {};
	}

	parseCasePayload(raw){
		if(!raw){
			return null;
		}
		if(typeof raw === 'string'){
			try{
				return JSON.parse(raw);
			}catch(e){
				return null;
			}
		}
		if(typeof raw === 'object'){
			return raw;
		}
		return null;
	}

	restoreOptionsFromCurrentCase(force){
		const store = getStore();
		const userState = store && store.user ? store.user : null;
		const currentCase = userState && userState.currentCase ? userState.currentCase : null;
		if(!currentCase || !currentCase.cid || !currentCase.cid.value){
			return;
		}
		const cid = `${currentCase.cid.value}`;
		const updateTime = currentCase.updateTime && currentCase.updateTime.value ? `${currentCase.updateTime.value}` : '';
		const caseVersion = `${cid}|${updateTime}`;
		if(!force && caseVersion === this.lastRestoredCaseId){
			return;
		}
		const sourceModule = currentCase.sourceModule ? currentCase.sourceModule.value : null;
		const caseType = currentCase.caseType ? currentCase.caseType.value : null;
		if(sourceModule !== 'sanshiunited' && caseType !== 'sanshiunited'){
			return;
		}
		const payload = this.parseCasePayload(currentCase.payload ? currentCase.payload.value : null);
		if(!payload){
			return;
		}
		const options = {
			...this.state.options,
		};
			if(payload.options && typeof payload.options === 'object'){
				if(payload.options.mode === 'ming' || payload.options.mode === 'shi'){
					options.mode = payload.options.mode;
				}
				if(payload.options.sex === 0 || payload.options.sex === 1){
					options.sex = payload.options.sex;
				}
				if(payload.options.guireng === 0 || payload.options.guireng === 1 || payload.options.guireng === 2){
					options.guireng = payload.options.guireng;
				}
				if(payload.options.zodiacal === 0 || payload.options.zodiacal === 1){
					options.zodiacal = payload.options.zodiacal;
				}
				if(payload.options.hsys !== undefined && payload.options.hsys !== null){
					options.hsys = payload.options.hsys;
				}
				if(payload.options.paiPanType !== undefined){
					options.paiPanType = payload.options.paiPanType;
				}
				if(payload.options.zhiShiType !== undefined){
					options.zhiShiType = payload.options.zhiShiType;
				}
				if(payload.options.yueJiaQiJuType !== undefined){
					options.yueJiaQiJuType = payload.options.yueJiaQiJuType;
				}
				if(payload.options.qijuMethod){
					options.qijuMethod = payload.options.qijuMethod;
				}
				if(payload.options.kongMode){
					options.kongMode = payload.options.kongMode;
				}
				if(payload.options.yimaMode){
					options.yimaMode = payload.options.yimaMode;
				}
				if(payload.options.shiftPalace !== undefined){
					options.shiftPalace = payload.options.shiftPalace;
				}
			}
		this.lastRestoredCaseId = caseVersion;
		const patchFields = {};
		if(options.zodiacal !== undefined){
			patchFields.zodiacal = { value: options.zodiacal };
		}
		if(options.hsys !== undefined){
			patchFields.hsys = { value: options.hsys };
		}
		if(options.sex !== undefined){
			patchFields.gender = { value: options.sex };
		}
		const nextLocalFields = {
			...this.getActiveFields(),
			...patchFields,
		};
		const savedResult = payload.result && typeof payload.result === 'object' ? payload.result : null;
		const hasSavedResult = !!(savedResult && savedResult.dunjia);
		const nextState = {
			options,
			localFields: nextLocalFields,
			hasPlotted: hasSavedResult,
		};
		if(hasSavedResult){
			nextState.hasPlotted = true;
			nextState.nongli = savedResult.nongli || null;
			nextState.liureng = savedResult.liureng || null;
			nextState.dunjia = savedResult.dunjia || null;
			nextState.lrLayout = savedResult.lrLayout || null;
			nextState.keData = savedResult.keData || null;
			nextState.sanChuan = savedResult.sanChuan || null;
		}else{
			nextState.nongli = null;
			nextState.liureng = null;
			nextState.dunjia = null;
			nextState.lrLayout = null;
			nextState.keData = null;
			nextState.sanChuan = null;
		}
		this.setState(nextState, ()=>{
			if(hasSavedResult && !savedResult.lrLayout && this.state.nongli){
				this.recalcByNongli(nextLocalFields, this.state.nongli, options);
			}
		});
	}

	onFieldsChange(field){
		if(this.props.dispatch){
			const flds = {
				...(this.props.fields || {}),
				...field,
			};
			this.props.dispatch({
				type: 'astro/fetchByFields',
				payload: flds,
			});
		}
	}

	onTimeChanged(value){
		const dt = value.time;
		const confirmed = !!value.confirmed;

		// 手动起盘模式：时间确认只更新本地字段，不触发全局 fetchByFields。
		if(confirmed){
			const base = this.props.fields || {};
			const localFields = {
				...base,
				date: { value: dt.clone() },
				time: { value: dt.clone() },
				ad: { value: dt.ad },
				zone: { value: dt.zone },
			};
			this.setState({ localFields });
			const warmupParams = buildWarmupPayload(localFields, this.state.options.sex);
			if(warmupParams){
				warmupCache(warmupParams, { mode: 'light', immediate: true });
			}
		}
	}

	onGenderChange(val){
		this.onOptionChange('sex', val);
		this.onFieldsChange({
			gender: { value: val },
		});
	}

	onOptionChange(key, value){
		const options = {
			...this.state.options,
			[key]: value,
		};
		this.setState({ options }, ()=>{
			if(this.state.hasPlotted && this.state.nongli){
				this.recalcByNongli(this.state.localFields || this.props.fields, this.state.nongli, options);
			}
		});
	}

	onAstroFieldOptionChange(key, value){
		this.onOptionChange(key, value);
		this.onFieldsChange({
			[key]: { value },
		});
		const localFields = {
			...this.getActiveFields(),
			[key]: { value },
		};
		this.setState({ localFields });
	}

	getTimeFieldsFromSelector(baseFields){
		if(!this.timeHook || typeof this.timeHook.getValue !== 'function'){
			return null;
		}
		const draft = this.timeHook.getValue();
		if(!draft || !draft.value || !(draft.value instanceof DateTime)){
			return null;
		}
		const dt = draft.value;
		return {
			...(baseFields || this.state.localFields || this.props.fields || {}),
			date: { value: dt.clone() },
			time: { value: dt.clone() },
			ad: { value: dt.ad },
			zone: { value: dt.zone },
		};
	}

	clickPlot(){
		if(this.state.loading){
			return;
		}
		const timeFields = this.getTimeFieldsFromSelector(this.state.localFields || this.props.fields);
		const nextFields = timeFields || this.state.localFields || this.props.fields;
		if(!nextFields){
			return;
		}
		const warmupParams = buildWarmupPayload(nextFields, this.state.options.sex);
		if(warmupParams){
			warmupCache(warmupParams, { mode: 'light', immediate: true });
		}
		this.setState({
			loading: true,
			hasPlotted: true,
			localFields: nextFields,
		}, ()=>{
			this.refreshAll(nextFields, true);
		});
	}

	changeGeo(rec){
		this.onFieldsChange({
			lon: { value: convertLonToStr(rec.lng) },
			lat: { value: convertLatToStr(rec.lat) },
			gpsLon: { value: rec.gpsLng },
			gpsLat: { value: rec.gpsLat },
		});
	}

	clickSave(){
		if(!this.state.hasPlotted || !this.state.dunjia){
			message.warning('请先起盘后再保存');
			return;
		}
		const flds = this.state.localFields || this.props.fields;
		if(!flds){
			return;
		}
		if(this.state.options.mode === 'ming'){
			if(this.props.dispatch){
				this.props.dispatch({
					type: 'astro/openDrawer',
					payload: {
						key: 'chartadd',
					},
				});
			}
			return;
		}
		const divTime = `${flds.date.value.format('YYYY-MM-DD')} ${flds.time.value.format('HH:mm:ss')}`;
		const payload = {
			module: 'sanshiunited',
			options: {
				...this.state.options,
			},
			result: {
				nongli: this.state.nongli,
				liureng: this.state.liureng,
				dunjia: this.state.dunjia,
				lrLayout: this.state.lrLayout,
				keData: this.state.keData,
				sanChuan: this.state.sanChuan,
			},
		};
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'astro/openDrawer',
				payload: {
					key: 'caseadd',
					record: {
						event: `三式合一占断 ${divTime}`,
						caseType: 'sanshiunited',
						divTime: divTime,
						zone: flds.zone.value,
						lat: flds.lat.value,
						lon: flds.lon.value,
						gpsLat: flds.gpsLat.value,
						gpsLon: flds.gpsLon.value,
						pos: flds.pos ? flds.pos.value : '',
						payload: payload,
						sourceModule: 'sanshiunited',
					},
				},
			});
		}
	}

	genParams(fields){
		const flds = fields || this.state.localFields || this.props.fields;
		if(!flds){
			return null;
		}
		return {
			date: flds.date.value.format('YYYY-MM-DD'),
			time: flds.time.value.format('HH:mm:ss'),
			zone: flds.zone.value,
			lon: flds.lon.value,
			lat: flds.lat.value,
			gpsLat: flds.gpsLat.value,
			gpsLon: flds.gpsLon.value,
			gender: this.state.options.sex,
			after23NewDay: 0,
		};
	}

	genJieqiParams(fields, year){
		const flds = fields || this.state.localFields || this.props.fields;
		if(!flds){
			return null;
		}
		return {
			year: `${year}`,
			ad: flds.ad ? flds.ad.value : 1,
			zone: flds.zone.value,
			lon: flds.lon.value,
			lat: flds.lat.value,
			gpsLat: flds.gpsLat.value,
			gpsLon: flds.gpsLon.value,
			hsys: 0,
			zodiacal: 0,
			doubingSu28: false,
		};
	}

	getQimenOptions(overrideOptions){
		const opt = {
			...this.state.options,
			...(overrideOptions || {}),
		};
		return {
			...QIMEN_OPTIONS,
			sex: opt.sex,
			paiPanType: opt.paiPanType,
			zhiShiType: opt.zhiShiType,
			yueJiaQiJuType: opt.yueJiaQiJuType,
			qijuMethod: opt.qijuMethod,
			kongMode: opt.kongMode,
			yimaMode: opt.yimaMode,
			shiftPalace: opt.shiftPalace,
			// 三式合一统一按“交接时刻”计算，避免日级近似切换。
			jieQiType: 1,
			yearGanZhiType: 2,
			monthGanZhiType: 1,
			dayGanZhiType: 1,
		};
	}

	recalcByNongli(fields, nongli, overrideOptions){
		const flds = fields || this.state.localFields || this.props.fields;
		if(!flds || !nongli){
			return;
		}
		const guirengType = overrideOptions && overrideOptions.guireng !== undefined ? overrideOptions.guireng : this.state.options.guireng;
		const qimenOptions = this.getQimenOptions(overrideOptions);
		const recalcSignature = [
			getFieldKey(flds),
			getNongliKey(nongli),
			getQimenOptionsKey(qimenOptions),
			`${guirengType}`,
			safe(flds && flds.zodiacal && flds.zodiacal.value),
			safe(flds && flds.hsys && flds.hsys.value),
			`${safe(extractIsDiurnalFromChartWrap(this.props.chartObj || this.props.chart || null), '')}`,
		].join('|');
		if(this.state.dunjia && recalcSignature === this.lastRecalcSignature){
			return;
		}
		const year = parseInt(flds.date.value.format('YYYY'), 10);
		const chartWrap = this.props.chartObj || this.props.chart || null;
		const isDiurnal = extractIsDiurnalFromChartWrap(chartWrap);
		const dunjia = this.getCachedDunJia(flds, nongli, qimenOptions, year, isDiurnal);
		const astroChart = chartWrap && chartWrap.chart ? chartWrap.chart : null;
		const lrNongli = buildLrNongli(nongli, dunjia);
		const chartForLr = astroChart ? {
			...astroChart,
			nongli: lrNongli,
		} : null;
		const lrCacheKey = [
			getChartYue(astroChart),
			safe(lrNongli.dayGanZi),
			safe(lrNongli.time),
			`${guirengType}`,
		].join('|');
		let lrBundle = this.lrBundleCache[lrCacheKey];
		if(!lrBundle){
			const lrLayout = buildLiuRengLayout(chartForLr, guirengType);
			const keData = buildKeData(lrLayout, chartForLr);
			const sanChuan = buildSanChuan(lrLayout, keData.raw, chartForLr);
			lrBundle = {
				lrLayout,
				keData,
				sanChuan,
				yue: lrLayout ? lrLayout.yue : '',
				timezi: lrLayout ? lrLayout.timezi : '',
				guizi: lrLayout ? lrLayout.guizi : '',
			};
			this.lrBundleCache[lrCacheKey] = lrBundle;
			const cacheKeys = Object.keys(this.lrBundleCache);
			if(cacheKeys.length > 36){
				delete this.lrBundleCache[cacheKeys[0]];
			}
		}
		const liureng = {
			nongli: lrNongli,
			yue: lrBundle.yue,
			timezi: lrBundle.timezi,
			guizi: lrBundle.guizi,
			fourColumns: {
				year: dunjia && dunjia.ganzhi ? (dunjia.ganzhi.year || '') : '',
				month: dunjia && dunjia.ganzhi ? (dunjia.ganzhi.month || '') : '',
				day: dunjia && dunjia.ganzhi ? (dunjia.ganzhi.day || '') : '',
				time: dunjia && dunjia.ganzhi ? (dunjia.ganzhi.time || '') : '',
			},
		};
		this.lastRecalcSignature = recalcSignature;
		this.setState({
			nongli,
			liureng,
			dunjia,
			lrLayout: lrBundle.lrLayout,
			keData: lrBundle.keData,
			sanChuan: lrBundle.sanChuan,
		});
	}

	async ensureJieqiSeed(fields, year){
		if(!year || Number.isNaN(year)){
			return null;
		}
		if(this.jieqiYearSeeds[year]){
			return this.jieqiYearSeeds[year];
		}
		if(this.jieqiSeedPromises[year]){
			return this.jieqiSeedPromises[year];
		}
		const params = this.genJieqiParams(fields, year);
		if(!params){
			return null;
		}
		this.jieqiSeedPromises[year] = Promise.resolve().then(async()=>{
			const seed = await fetchPreciseJieqiSeed(params);
			if(seed){
				this.jieqiYearSeeds[year] = seed;
				setJieqiSeedLocalCache(params, seed);
			}
			return seed;
		}).finally(()=>{
			delete this.jieqiSeedPromises[year];
		});
		return this.jieqiSeedPromises[year];
	}

	async refreshAll(fields, force){
		if(!fields){
			this.setState({ loading: false });
			return;
		}
		const key = `${getFieldKey(fields)}|${this.state.options.sex}`;
		if(!force && key === this.lastKey){
			return;
		}
		if(!force && this.pendingRefresh && this.pendingRefresh.key === key){
			return this.pendingRefresh.promise;
		}
		this.lastKey = key;
		const params = this.genParams(fields);
		if(!params){
			this.setState({ loading: false });
			return;
		}
		if(!this.state.loading){
			this.setState({ loading: true });
		}
		const seq = ++this.refreshSeq;
		const refreshPromise = (async ()=>{
			const totalStart = Date.now();
			const qimenOptions = this.getQimenOptions();
			const shouldWaitSeed = needJieqiYearSeed(qimenOptions);
			try{
				const year = parseInt(fields.date.value.format('YYYY'), 10);
				const chartWrap = this.props.chartObj || this.props.chart || null;
				const nongliStart = Date.now();
				let source = 'chart-nongli';
				let nongli = pickChartNongli(fields, chartWrap);
				if(!nongli){
					source = 'precise-api';
					nongli = await fetchPreciseNongli(params);
				}
				const nongliMs = Date.now() - nongliStart;
				if(!nongli){
					throw new Error('precise.nongli.unavailable');
				}
				setNongliLocalCache(params, nongli);
				if(this.unmounted || seq !== this.refreshSeq){
					return;
				}
				// 移除不必要的延迟以提升性能
				// await new Promise((resolve)=>setTimeout(resolve, 0));
				if(this.unmounted || seq !== this.refreshSeq){
					return;
				}
				const recalcStart = Date.now();
				this.recalcByNongli(fields, nongli);
				const recalcMs = Date.now() - recalcStart;
				const perf = buildSanShiPerf(source, nongliMs, recalcMs, Date.now() - totalStart);
				if(!this.unmounted && seq === this.refreshSeq){
					this.setState({
						loading: false,
						perf,
					});
				}
				if(shouldWaitSeed){
					Promise.all([
						this.ensureJieqiSeed(fields, year - 1),
						this.ensureJieqiSeed(fields, year),
					]).then((seeds)=>{
						if(this.unmounted || seq !== this.refreshSeq){
							return;
						}
						if(seeds && seeds[0] && seeds[1]){
							this.recalcByNongli(fields, nongli);
						}
					}).catch(()=>{});
				}
			}catch(e){
				if(!this.unmounted && seq === this.refreshSeq){
					this.setState({ loading: false });
					message.error('三式合一计算失败：精确历法服务不可用');
				}
			}finally{
				if(this.pendingRefresh && this.pendingRefresh.seq === seq){
					this.pendingRefresh = null;
				}
			}
		})();
		this.pendingRefresh = {
			key,
			seq,
			promise: refreshPromise,
		};
		return refreshPromise;
	}

	calcBoardSize(height){
		const viewH = this.state.viewportHeight || 900;
		const baseH = typeof height === 'number' ? height : (viewH - 20);
		const hostW = this.state.leftBoardWidth > 0 ? this.state.leftBoardWidth : 0;
		const usableH = Math.min(viewH, baseH);
		// 动态计算最大值：高度优先，并带宽度约束，附上下限。
		const dynamicMax = getDynamicBoardMax(usableH, hostW);
		const hCap = Math.max(SANSHI_BOARD_MIN, Math.round(usableH - SANSHI_VERTICAL_RESERVED));
		const wCap = hostW > 0 ? Math.round(hostW - SANSHI_WIDTH_PADDING) : dynamicMax;
		let target = hCap;
		if(Number.isFinite(wCap) && wCap > 0){
			target = Math.min(target, wCap);
		}
		// 使用动态最大值，避免不同机器/浏览器出现失控放大。
		return clamp(Math.round(target), SANSHI_BOARD_MIN, dynamicMax);
	}

	getBoardScale(boardSize){
		const size = Number.isFinite(boardSize) && boardSize > 0 ? boardSize : SANSHI_BOARD_BASE;
		return clamp(size / SANSHI_BOARD_BASE, SANSHI_SCALE_MIN, SANSHI_SCALE_MAX);
	}

	renderTop(boardSize){
		const boardScale = this.getBoardScale(boardSize);
		const { nongli, liureng, dunjia } = this.state;
		const fields = this.getActiveFields();
		const solar = fmtSolar(fields);
		const pillars = [
			{ label: '年', gz: buildPillarFromPan(dunjia, 'year') },
			{ label: '月', gz: buildPillarFromPan(dunjia, 'month') },
			{ label: '日', gz: buildPillarFromPan(dunjia, 'day') },
			{ label: '时', gz: buildPillarFromPan(dunjia, 'time') },
		];
		const chartWrap = this.props.chartObj || this.props.chart || null;
		const astroChart = chartWrap && chartWrap.chart ? chartWrap.chart : null;
		const yuejiang = (liureng && liureng.yue) || getChartYue(astroChart) || '--';
		const nianming = (liureng && liureng.nianMing) || ((dunjia && dunjia.ganzhi && dunjia.ganzhi.year) ? dunjia.ganzhi.year.substring(1, 2) : '--');
		const shenShaMap = buildShenShaMap(dunjia);
		const names = ['驿马', '日德', '幕贵', '日禄', '天马', '破碎'];
		const values = [
			(dunjia && dunjia.yiMa && dunjia.yiMa.yimaZhi) ? dunjia.yiMa.yimaZhi : '—',
			safe(shenShaMap['日德'], '—'),
			safe(shenShaMap['幕贵'], '—'),
			safe(shenShaMap['日禄'], '—'),
			safe(shenShaMap['天马'], '—'),
			safe(shenShaMap['破碎'], '—'),
		];
		const dateText = solar.date || '---- -- --';
		const timeText = solar.hm || '--:--';
		return (
			<div className={styles.topBox} style={{ width: boardSize, '--ss-scale': boardScale }}>
				<div className={styles.topLeft}>
					<div className={styles.datePanel}>
						<div className={styles.dateRow}>
							<div className={styles.dateLabel}>农历</div>
							<div className={styles.dateValue}>{fmtLunar(nongli) || '农历--'}</div>
						</div>
						<div className={styles.dateRow}>
							<div className={styles.dateLabel}>公历</div>
							<div className={styles.dateValue}>
								<span>{dateText}</span>
								<span className={styles.dateTime}>⏲ {timeText}</span>
							</div>
						</div>
					</div>

					<div className={styles.pillarArea}>
						<div className={styles.pillarLeft}>
							<div className={styles.pillarBlocks}>
								{pillars.map((item)=>{
									const parts = getGanzhiParts(item.gz);
									return (
										<div className={styles.pillarBox} key={`pillar_${item.label}`}>
											<div className={styles.pillarGan}>{parts.gan}</div>
											<div className={styles.pillarZhi}>{parts.zhi}</div>
										</div>
									);
								})}
							</div>
							<div className={styles.pillarTags}>
								{pillars.map((item)=>(
									<div key={`ptag_${item.label}`} className={styles.pillarTagDot}>{item.label}</div>
								))}
							</div>
						</div>
						<div className={styles.metaPairWrap}>
							<div className={styles.metaPair}>
								<div className={styles.metaTitle}>月将</div>
								<div className={styles.metaValue}>{yuejiang}</div>
							</div>
							<div className={styles.metaPair}>
								<div className={styles.metaTitle}>年命</div>
								<div className={styles.metaValue}>{nianming}</div>
							</div>
						</div>
					</div>
				</div>
				<div className={styles.ssBox}>
					<div className={styles.ssCol}>
						{names.map((n)=>(
							<div className={styles.ssItem} key={`ssn_${n}`}>{n}</div>
						))}
					</div>
					<div className={styles.ssCol}>
						{values.map((v, idx)=>(
							<div className={styles.ssValue} key={`ssv_${names[idx]}`}>{v}</div>
						))}
					</div>
				</div>
			</div>
		);
	}

	renderOuterMarks(outerData, midFont, boardSize){
		// 外圈文字按盘面尺寸连续缩放，避免在小窗口被最小字号”卡住”。
		const size = boardSize || SANSHI_BOARD_BASE;
		const ringCellPx = size * 0.111;
		const houseFont = clamp(Math.round(ringCellPx * 0.20), 8, 22);
		const branchFont = clamp(Math.round(ringCellPx * 0.18), 7, 20);
		const starFont = clamp(Math.round(ringCellPx * 0.14), 6, 18);
		return OUTER_RING_LAYOUT.map((item)=>{
			const houses = outerData.housesByBranch[item.branch] || [];
			const stars = outerData.starsByBranch[item.branch] || [];
			const starsLayout = getOuterStarsLayout(item.branch, starFont);
			const starRows = [];
			for(let i=0; i<stars.length; i += starsLayout.perRow){
				const row = stars.slice(i, i + starsLayout.perRow);
				while(row.length < starsLayout.perRow){
					row.push('');
				}
				starRows.push(row);
			}
			const houseTxt = houses.length ? houses.join('/') : '';
			const labelLayout = getOuterLabelLayout(item.branch, houseFont);
			return (
				<div
					key={`outer_${item.branch}`}
					className={`${styles.outerCell} ${styles[`outerCell_${item.side}`]}`}
					style={{
						left: `${item.x0}%`,
						top: `${item.y0}%`,
						width: `${item.x1 - item.x0}%`,
						height: `${item.y1 - item.y0}%`,
					}}
				>
					<span
						className={`${styles.outerLabel} ${styles.outerHouse}`}
						style={{
							fontSize: houseFont,
							lineHeight: `${houseFont}px`,
							...labelLayout.house,
						}}
					>
						{houseTxt}
					</span>
					<span
						className={`${styles.outerLabel} ${styles.outerBranch}`}
						style={{
							fontSize: branchFont,
							lineHeight: `${branchFont}px`,
							...labelLayout.branch,
						}}
					>
						{item.branch}
					</span>
						{stars.length ? (
							<div
								className={styles.outerStars}
								style={{
									fontSize: starFont,
									lineHeight: `${Math.round(starFont * 1.12)}px`,
									...starsLayout.style,
								}}
							>
								{starRows.map((row, idx)=>(
									<div
										key={`outer_star_row_${item.branch}_${idx}`}
										className={styles.outerStarsRow}
										style={{ justifyContent: starsLayout.rowJustify }}
									>
											{row.map((txt, rowIdx)=>(
												txt
													? (
														<span
															key={`outer_star_${item.branch}_${idx}_${rowIdx}`}
															className={styles.outerStarItem}
															style={{ fontSize: starFont, lineHeight: `${Math.round(starFont * 1.12)}px` }}
														>
															{txt}
														</span>
													)
													: (
														<span
															key={`outer_star_pad_${item.branch}_${idx}_${rowIdx}`}
															className={`${styles.outerStarItem} ${styles.outerStarPlaceholder}`}
															style={{ fontSize: starFont, lineHeight: `${Math.round(starFont * 1.12)}px` }}
														>
															占位
														</span>
													)
											))}
										</div>
									))}
							</div>
						) : null}
					</div>
			);
		});
	}

	renderLiuRengMarks(layout, midFont, boardSize){
		if(!layout || !layout.downZi || !layout.upZi || !layout.houseTianJiang){
			return null;
		}
		const size = boardSize || SANSHI_BOARD_BASE;
		const ringCellPx = size * 0.111;
		return layout.downZi.map((branch, idx)=>{
			const pos = LIURENG_RING_LAYOUT[branch];
			if(!pos){
				return null;
			}
			const up = layout.upZi[idx] || '';
			const god = shortTianJiang(layout.houseTianJiang[idx] || '');
			const isCardinal = pos.kind === 'cardinal';
			const font = isCardinal
				? clamp(Math.round(ringCellPx * 0.23), 9, 24)
				: clamp(Math.round(ringCellPx * 0.20), 8, 22);
			if(!isCardinal){
				const leftNum = parseFloat(`${pos.left}`) || 50;
				const topNum = parseFloat(`${pos.top}`) || 50;
				const dx = leftNum - 50;
				const dy = topNum - 50;
				const len = Math.sqrt(dx * dx + dy * dy) || 1;
				const ux = dx / len;
				const uy = dy / len;
				// 角三角：地支远离中心，神将靠近中心；使用径向分离保证可读。
				// 稍微减少偏移量以防止元素挤在一起
				const outerShift = 3.0;
				const innerShift = 2.4;
				const ziLeft = `${leftNum + (ux * outerShift)}%`;
				const ziTop = `${topNum + (uy * outerShift)}%`;
				const godLeft = `${leftNum - (ux * innerShift)}%`;
				const godTop = `${topNum - (uy * innerShift)}%`;
				return (
					<>
						<div
							key={`lr_zi_${branch}_${idx}`}
							className={`${styles.lrMark} ${styles.lrMarkZiItem}`}
							style={{
								left: ziLeft,
								top: ziTop,
								fontSize: font,
								lineHeight: `${font}px`,
								transform: 'translate(-50%, -50%)',
							}}
						>
							{up}
						</div>
						<div
							key={`lr_god_${branch}_${idx}`}
							className={`${styles.lrMark} ${styles.lrMarkGodItem}`}
							style={{
								left: godLeft,
								top: godTop,
								fontSize: font,
								lineHeight: `${font}px`,
								transform: 'translate(-50%, -50%)',
							}}
						>
							{god}
						</div>
					</>
				);
			}
			const leftNum = parseFloat(`${pos.left}`) || 50;
			const topNum = parseFloat(`${pos.top}`) || 50;
			const dx = leftNum - 50;
			const dy = topNum - 50;
			const len = Math.sqrt(dx * dx + dy * dy) || 1;
			const ux = dx / len;
			const uy = dy / len;
			const tx = -uy;
			const ty = ux;
			// 规则：地支始终远离中心，神将始终靠近中心；二者分开独立定位。
			// 稍微减少偏移量以防止元素挤在一起
			const outerShift = isCardinal
				? Math.max(11, Math.round(font * 0.64))
				: Math.max(11, Math.round(font * 0.66));
			const innerShift = isCardinal
				? Math.max(9, Math.round(font * 0.52))
				: Math.max(8, Math.round(font * 0.52));
			const tangentShift = isCardinal ? 0 : Math.max(5, Math.round(font * 0.36));
			const ziShiftX = Math.round((ux * outerShift) + (tx * tangentShift));
			const ziShiftY = Math.round((uy * outerShift) + (ty * tangentShift));
			const godShiftX = Math.round((-ux * innerShift) - (tx * tangentShift));
			const godShiftY = Math.round((-uy * innerShift) - (ty * tangentShift));
			const ziTransform = `translate(calc(-50% + ${ziShiftX}px), calc(-50% + ${ziShiftY}px))`;
			const godTransform = `translate(calc(-50% + ${godShiftX}px), calc(-50% + ${godShiftY}px))`;
			return (
				<>
					<div
						key={`lr_zi_${branch}_${idx}`}
						className={`${styles.lrMark} ${styles.lrMarkZiItem}`}
						style={{
							left: pos.left,
							top: pos.top,
							fontSize: font,
							lineHeight: `${font}px`,
							transform: ziTransform,
						}}
					>
						{up}
					</div>
					<div
						key={`lr_god_${branch}_${idx}`}
						className={`${styles.lrMark} ${styles.lrMarkGodItem}`}
						style={{
							left: pos.left,
							top: pos.top,
							fontSize: font,
							lineHeight: `${font}px`,
							transform: godTransform,
						}}
					>
						{god}
					</div>
				</>
			);
		});
	}

	renderQimenBlock(palaceNum, qimenMap, midFont, boardSize){
		const cell = qimenMap[palaceNum] || {};
		const pos = QIMEN_RING_POSITIONS[palaceNum];
		if(!pos){
			return null;
		}
		const size = boardSize || 600;
		const ringCellPx = size * 0.111;
		// “门”方块和字体都按宫格像素连续缩放，并限制上下限，防止挡住干门星神。
		const qimenFont = clamp(Math.round(ringCellPx * 0.15), 5, 12);
		const edgePad = clamp(Math.round(ringCellPx * 0.055), 1, 6);
		const doorSize = clamp(
			Math.round(ringCellPx * 0.095),
			4,
			Math.round(ringCellPx * 0.125),
		);
		const doorFont = clamp(Math.round(doorSize * 0.42), 4, 7);
		const doorBorder = clamp(Math.round((ringCellPx * 0.01) * 10) / 10, 0.5, 1);
		const isCorner = QIMEN_CORNER_PALACES.has(palaceNum);
		return (
			<div
				key={`qm_${palaceNum}`}
				className={`${styles.qmBlock}${isCorner ? ` ${styles.qmBlockCorner}` : ''}`}
				style={{ left: pos.left, top: pos.top }}
			>
				<div className={styles.qmRingCell} />
				<div className={styles.qmTianGan} style={{ left: edgePad, top: edgePad, fontSize: qimenFont, lineHeight: `${qimenFont}px` }}>{safe(cell.tianGan, ' ')}</div>
				<div className={styles.qmGod} style={{ right: edgePad, top: edgePad, fontSize: qimenFont, lineHeight: `${qimenFont}px` }}>{safe(cell.god, ' ')}</div>
				<div className={styles.qmDiGan} style={{ left: edgePad, bottom: edgePad, fontSize: qimenFont, lineHeight: `${qimenFont}px` }}>{safe(cell.diGan, ' ')}</div>
				<div className={styles.qmStar} style={{ right: edgePad, bottom: edgePad, fontSize: qimenFont, lineHeight: `${qimenFont}px` }}>{safe(cell.tianXing, ' ')}</div>
				<div className={styles.qmDoorBox} style={{ width: doorSize, height: doorSize, borderWidth: doorBorder }}>
					<div className={styles.qmDoor} style={{ fontSize: doorFont, lineHeight: `${doorFont}px` }}>{safe(cell.door, ' ')}</div>
				</div>
			</div>
		);
	}

	renderCenterBlock(midFont, boardSize){
		const keRaw = this.state.keData && Array.isArray(this.state.keData.raw) ? this.state.keData.raw : [];
		// 中宫四课按用户习惯固定为：从左到右 四、三、二、一。
		const keCols = [3, 2, 1, 0].map((idx)=>{
			const item = keRaw[idx] || [];
			return {
				// 两层天干上下位置互换（上层取 item[1]，下层取 item[2]）。
				main1: safe(item[1], '—'),
				main2: safe(item[2], '—'),
				god: shortTianJiang(item[0]),
			};
		});
		const chuan = this.state.sanChuan;
		const chuanRows = [0, 1, 2].map((idx)=>{
			const gz = chuan && chuan.cuang ? safe(chuan.cuang[idx], '') : '';
			const parsed = splitGanZhi(gz);
			return {
				gan: parsed.gan,
				zhi: parsed.zhi,
				god: shortTianJiang(chuan && chuan.tianJiang ? chuan.tianJiang[idx] : ''),
			};
		});
		const edgePad = 2;
		const centerPx = Math.max(140, Math.round((boardSize || 500) * 0.334));
		const availableH = Math.max(90, centerPx - edgePad * 2);
		const centerScale = clamp((boardSize || 600) / 700, 0.50, 1.00);
		// 目标：四课(3行) + 三传(3行) 的总行高基本填满中宫高度
		// 稍微减少字体大小以防止四课三传挤在一起
		const txtSize = clamp(Math.min(Math.round((17 * centerScale) + 1), Math.floor(availableH / 7)), 8, 22);
		const linePx = Math.max(8, Math.round(txtSize * 1.02));
		return (
			<div key="qm_center" className={`${styles.qmBlock} ${styles.qmCenter}`} style={{ left: '50%', top: '50%' }}>
				<div className={styles.centerKe} style={{ fontSize: txtSize, lineHeight: `${linePx}px` }}>
					{keCols.map((col, idx)=>(
						<div key={`ke_col_${idx}`} className={styles.centerKeCol}>
							<div className={styles.centerKeGray}>{col.god}</div>
							<div className={styles.centerKeMain}>{col.main1}</div>
							<div className={styles.centerKeMain}>{col.main2}</div>
						</div>
					))}
				</div>
				<div className={styles.centerChuan} style={{ fontSize: txtSize, lineHeight: `${linePx}px` }}>
					{chuanRows.map((row, idx)=>(
						<div key={`chuan_row_${idx}`} className={styles.centerChuanRow}>
							<span className={styles.centerChuanGray}>{row.gan || ''}</span>
							<span className={styles.centerChuanMain}>{row.zhi}</span>
							<span className={styles.centerChuanGray}>{row.god}</span>
						</div>
					))}
				</div>
			</div>
		);
	}

	renderBoardSvg(){
		return (
			<svg className={styles.boardSvg} viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet">
				<rect x="0" y="0" width="1000" height="1000" className={styles.fillOuterRing} />
				<rect x="111" y="111" width="778" height="778" className={styles.fillQimenRing} />
				<rect x="222" y="222" width="556" height="556" className={styles.fillLiurengRing} />
				<rect x="333.33" y="333.33" width="333.34" height="333.34" className={styles.fillCenter} />

				<rect x="1" y="1" width="998" height="998" className={styles.strokeMain} />
				<line x1="333.33" y1="0" x2="333.33" y2="1000" className={styles.strokeMain} />
				<line x1="666.67" y1="0" x2="666.67" y2="1000" className={styles.strokeMain} />
				<line x1="0" y1="333.33" x2="1000" y2="333.33" className={styles.strokeMain} />
				<line x1="0" y1="666.67" x2="1000" y2="666.67" className={styles.strokeMain} />

				<rect x="111" y="111" width="778" height="778" className={styles.strokeSub} />
				<rect x="222" y="222" width="556" height="556" className={styles.strokeSub} />
				<rect x="333.33" y="333.33" width="333.34" height="333.34" className={styles.strokeSub} />

					<line x1="0" y1="0" x2="111" y2="111" className={styles.strokeMain} />
					<line x1="1000" y1="0" x2="889" y2="111" className={styles.strokeMain} />
					<line x1="0" y1="1000" x2="111" y2="889" className={styles.strokeMain} />
					<line x1="1000" y1="1000" x2="889" y2="889" className={styles.strokeMain} />

					<line x1="111" y1="111" x2="222" y2="222" className={styles.strokeMain} />
					<line x1="889" y1="111" x2="778" y2="222" className={styles.strokeMain} />
					<line x1="111" y1="889" x2="222" y2="778" className={styles.strokeMain} />
					<line x1="889" y1="889" x2="778" y2="778" className={styles.strokeMain} />

					<line x1="222" y1="222" x2="333.33" y2="333.33" className={styles.strokeMain} />
					<line x1="778" y1="222" x2="666.67" y2="333.33" className={styles.strokeMain} />
					<line x1="222" y1="778" x2="333.33" y2="666.67" className={styles.strokeMain} />
					<line x1="778" y1="778" x2="666.67" y2="666.67" className={styles.strokeMain} />

				<line x1="333.33" y1="222" x2="333.33" y2="333.33" className={styles.strokeSub} />
				<line x1="666.67" y1="222" x2="666.67" y2="333.33" className={styles.strokeSub} />

				<line x1="333.33" y1="666.67" x2="333.33" y2="778" className={styles.strokeSub} />
				<line x1="666.67" y1="666.67" x2="666.67" y2="778" className={styles.strokeSub} />

				<line x1="222" y1="333.33" x2="333.33" y2="333.33" className={styles.strokeSub} />
				<line x1="222" y1="666.67" x2="333.33" y2="666.67" className={styles.strokeSub} />

				<line x1="666.67" y1="333.33" x2="778" y2="333.33" className={styles.strokeSub} />
				<line x1="666.67" y1="666.67" x2="778" y2="666.67" className={styles.strokeSub} />
			</svg>
		);
	}

	renderMiddle(boardSize){
		const boardScale = this.getBoardScale(boardSize);
		const chartWrap = this.props.chartObj || this.props.chart || null;
		const astroChart = chartWrap && chartWrap.chart ? chartWrap.chart : null;
		let outerData = this.outerDataCache.data;
		if(this.outerDataCache.chartRef !== astroChart){
			outerData = buildOuterData(astroChart);
			this.outerDataCache = {
				chartRef: astroChart,
				data: outerData,
			};
		}
		const midFont = Math.max(10, Math.round(boardSize * 0.018));
		const qimenMap = {};
		if(this.state.dunjia && this.state.dunjia.cells){
			this.state.dunjia.cells.forEach((c)=>{
				qimenMap[c.palaceNum] = c;
			});
		}
		const qmBlocks = [1, 2, 3, 4, 6, 7, 8, 9].map((num)=>this.renderQimenBlock(num, qimenMap, midFont, boardSize));
		return (
			<div className={styles.middleWrap} style={{ width: boardSize, '--ss-scale': boardScale }}>
				<div className={styles.middleBoard} style={{ width: boardSize, height: boardSize }}>
					{this.renderBoardSvg()}
					<div className={styles.boardLayer}>
						{this.renderOuterMarks(outerData, midFont, boardSize)}
						{this.renderLiuRengMarks(this.state.lrLayout, midFont, boardSize)}
						{qmBlocks}
						{this.renderCenterBlock(midFont, boardSize)}
					</div>
				</div>
			</div>
		);
	}

	renderBottom(boardSize){
		const boardScale = this.getBoardScale(boardSize);
		const pan = this.state.dunjia;
		const xun = safe(pan && pan.xunShou, '—');
		const futo = safe(pan && pan.fuTou, '—');
		const kong = safe(pan && pan.xunkong && pan.xunkong.日空, '—');
		const shikong = safe(pan && pan.xunkong && pan.xunkong.时空, '—');
		const dunType = safe(pan && pan.yinYangDun, '—');
		const dunJu = pan && pan.juShu !== undefined && pan.juShu !== null ? `${pan.juShu}局` : '—';
		return (
			<div className={styles.bottomBox} style={{ width: boardSize, '--ss-scale': boardScale }}>
				<div className={styles.bottomGrid}>
					<div className={styles.bottomCell}><span>本旬</span><b>{xun}</b></div>
					<div className={styles.bottomCell}><span>旬仪</span><b>{futo}</b></div>
					<div className={styles.bottomCell}><span>旬空</span><b>{kong}</b></div>
					<div className={styles.bottomCell}><span>时空</span><b>{shikong}</b></div>
				</div>
				<div className={styles.bottomRight}>
					<div>{dunType}</div>
					<div>{dunJu}</div>
				</div>
			</div>
		);
	}

	renderLeftBoard(height){
		if(!this.state.hasPlotted){
			return <Card bordered={false}>点击右侧“起盘”后显示三式合一盘</Card>;
		}
		if(!this.state.dunjia){
			return <Card bordered={false}>暂无三式合一数据</Card>;
		}
		const boardSize = this.calcBoardSize(height);
		const hostCap = this.state.leftBoardWidth > 0
			? Math.max(160, Math.round(this.state.leftBoardWidth - SANSHI_WIDTH_PADDING))
			: boardSize;
		const effectiveBoardSize = Math.max(160, Math.min(boardSize, hostCap));
		return (
			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					gap: 10,
					fontFamily: SANSHI_FONT_STACK,
				}}
			>
				{this.renderTop(effectiveBoardSize)}
				{this.renderMiddle(effectiveBoardSize)}
				{this.renderBottom(effectiveBoardSize)}
			</div>
		);
	}

	renderRight(){
		const fields = this.getActiveFields();
		const pan = this.state.dunjia;
		const opt = this.state.options;
		const perf = this.state.perf || buildSanShiPerf('', 0, 0, 0);
		const perfSourceMap = {
			'chart-nongli': '星盘农历复用',
			'precise-api': '精确历法接口',
		};
		const perfSource = perfSourceMap[perf.source] || '--';
		let datetm = new DateTime();
		if(fields.date && fields.time){
			const str = `${fields.date.value.format('YYYY-MM-DD')} ${fields.time.value.format('HH:mm:ss')}`;
			datetm = datetm.parse(str, 'YYYY-MM-DD HH:mm:ss');
			if(fields.zone){
				datetm.setZone(fields.zone.value);
			}
		}
		return (
			<div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
				<div style={{ paddingBottom: 6, borderBottom: '1px solid #f0f0f0' }}>
					<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
						<div>
							<PlusMinusTime value={datetm} onChange={this.onTimeChanged} hook={this.timeHook} />
						</div>
						<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 4 }}>
							<div>
								<Select size="small" value={opt.mode} onChange={(v)=>this.onOptionChange('mode', v)} style={{ width: '100%' }}>
									{GAME_TYPE_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
								</Select>
							</div>
							<div>
								<Select size="small" value={opt.sex} onChange={this.onGenderChange} style={{ width: '100%' }}>
									{SEX_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
								</Select>
							</div>
							<div>
								<Select size="small" value={opt.guireng} onChange={(v)=>this.onOptionChange('guireng', v)} style={{ width: '100%' }}>
									{GUIRENG_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
								</Select>
							</div>
						</div>
						<div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 4 }}>
							<div>
								<Select size="small" value={opt.paiPanType} onChange={(v)=>this.onOptionChange('paiPanType', v)} style={{ width: '100%' }}>
									{PAIPAN_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
								</Select>
							</div>
							<div>
								<Select size="small" value={opt.zhiShiType} onChange={(v)=>this.onOptionChange('zhiShiType', v)} style={{ width: '100%' }}>
									{ZHISHI_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
								</Select>
							</div>
						</div>
						<div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 4 }}>
							<div>
								<Select
									size="small"
									value={opt.yueJiaQiJuType}
									disabled={opt.paiPanType !== 1}
									onChange={(v)=>this.onOptionChange('yueJiaQiJuType', v)}
									style={{ width: '100%' }}
								>
									{YUEJIA_QIJU_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
								</Select>
							</div>
							<div>
								<Select size="small" value={opt.shiftPalace} onChange={(v)=>this.onOptionChange('shiftPalace', v)} style={{ width: '100%' }}>
									{YIXING_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
								</Select>
							</div>
						</div>
						<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 4 }}>
							<div>
								<Select size="small" value={opt.qijuMethod} disabled={opt.paiPanType !== 3} onChange={(v)=>this.onOptionChange('qijuMethod', v)} style={{ width: '100%' }}>
									{QIJU_METHOD_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
								</Select>
							</div>
							<div>
								<Select size="small" value={opt.kongMode} onChange={(v)=>this.onOptionChange('kongMode', v)} style={{ width: '100%' }}>
									{KONG_MODE_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
								</Select>
							</div>
							<div>
								<Select size="small" value={opt.yimaMode} onChange={(v)=>this.onOptionChange('yimaMode', v)} style={{ width: '100%' }}>
									{MA_MODE_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
								</Select>
							</div>
						</div>
						<div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 4 }}>
							<div>
								<Select size="small" value={opt.zodiacal} onChange={(v)=>this.onAstroFieldOptionChange('zodiacal', v)} style={{ width: '100%' }}>
									<Option value={0}>回归黄道</Option>
									<Option value={1}>恒星黄道</Option>
								</Select>
							</div>
							<div>
								<Select size="small" value={opt.hsys} onChange={(v)=>this.onAstroFieldOptionChange('hsys', v)} style={{ width: '100%' }}>
									{getHousesOption()}
								</Select>
							</div>
						</div>
						<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 4 }}>
							<div>
								<GeoCoordModal onOk={this.changeGeo} lat={fields.gpsLat && fields.gpsLat.value} lng={fields.gpsLon && fields.gpsLon.value}>
									<Button size="small" style={{ width: '100%' }}>经纬度选择</Button>
								</GeoCoordModal>
							</div>
							<div>
								<Button
									size="small"
									type="primary"
									style={{ width: '100%' }}
									onClick={this.clickPlot}
									loading={this.state.loading}
									disabled={this.state.loading}
								>
									起盘
								</Button>
							</div>
							<div>
								<Button size="small" style={{ width: '100%' }} onClick={this.clickSave}>保存</Button>
							</div>
						</div>
						<div style={{ textAlign: 'right' }}>
							<span>{fields.lon ? fields.lon.value : ''} {fields.lat ? fields.lat.value : ''}</span>
						</div>
						<div style={{ marginTop: 2, padding: '4px 6px', border: '1px solid #e8e8e8', borderRadius: 4, background: '#fafafa', fontSize: 12, lineHeight: '18px' }}>
							<div>性能: 来源 {perfSource} | 总耗时 {perf.totalMs}ms</div>
							<div>农历 {perf.nongliMs}ms | 重算 {perf.recalcMs}ms</div>
						</div>
					</div>
				</div>

				<div style={{ display: 'flex', gap: 6, marginTop: 8, paddingBottom: 8, borderBottom: '1px solid #f0f0f0' }}>
					<Button size="small" type={this.state.rightPanelTab === 'overview' ? 'primary' : 'default'} onClick={()=>this.setState({ rightPanelTab: 'overview' })}>概览</Button>
					<Button size="small" type={this.state.rightPanelTab === 'status' ? 'primary' : 'default'} onClick={()=>this.setState({ rightPanelTab: 'status' })}>状态</Button>
					<Button size="small" type={this.state.rightPanelTab === 'shensha' ? 'primary' : 'default'} onClick={()=>this.setState({ rightPanelTab: 'shensha' })}>神煞</Button>
				</div>

				<Card bordered={false} bodyStyle={{ padding: '10px 12px', maxHeight: 'calc(100vh - 420px)', overflowY: 'auto' }} style={{ marginTop: 6 }}>
					{this.state.rightPanelTab === 'overview' && (
						<div style={{ lineHeight: '26px' }}>
							<div>局数：{pan ? pan.juText : '—'}</div>
							<div>旬首：{pan ? pan.xunShou : '—'}</div>
							<div>旬仪：{pan ? pan.fuTou : '—'}</div>
							<div>值符：{pan ? pan.zhiFu : '—'}</div>
							<div>值使：{pan ? pan.zhiShi : '—'}</div>
							<div>月将：{this.state.lrLayout ? this.state.lrLayout.yue : '—'}</div>
						</div>
					)}
					{this.state.rightPanelTab === 'status' && (
						<div style={{ lineHeight: '26px' }}>
							<div>本旬：{pan ? pan.xunShou : '—'}</div>
							<div>旬空：{pan && pan.xunkong ? pan.xunkong.日空 : '—'}</div>
							<div>时空：{pan && pan.xunkong ? pan.xunkong.时空 : '—'}</div>
							<div>{pan && pan.yiMa ? pan.yiMa.text : '日马：无'}</div>
							<div>阴阳遁：{pan ? pan.yinYangDun : '—'}</div>
						</div>
					)}
					{this.state.rightPanelTab === 'shensha' && (
						<div>
							<div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 14, rowGap: 6, lineHeight: '24px' }}>
								{pan && pan.shenSha && pan.shenSha.allItems && pan.shenSha.allItems.length
									? pan.shenSha.allItems.map((item)=>(<div key={`ss_item_${item.name}`}><span style={{ color: '#262626' }}>{item.name}-</span><span style={{ color: '#8c8c8c' }}>{item.value}</span></div>))
									: <div>暂无神煞</div>}
							</div>
						</div>
					)}
				</Card>
			</div>
		);
	}

	render(){
		let height = this.props.height ? this.props.height : 760;
		if(height === '100%'){
			height = 760;
		}else{
			height = height - 20;
		}
		return (
			<div className={styles.root} style={{ minHeight: height }}>
				<Spin spinning={this.state.loading}>
					<Row gutter={6}>
						<Col span={16}>
							<div ref={this.captureLeftBoardHost}>
								{this.renderLeftBoard(height)}
							</div>
						</Col>
						<Col span={8}>
							{this.renderRight()}
						</Col>
					</Row>
				</Spin>
			</div>
		);
	}
}

export default SanShiUnitedMain;
