// 七政四余页 · 盘面取数与 AI 快照:行星 / 神煞 / 宫位行、本地 Moira 格局与规则、快照各段与快照正文(含快照显示口径开关)。
// 只被 components/guolao/GuoLaoChartMain.js 与同目录 main/ 下的兄弟模块引用。
import { buildTimeBasisLine, GUOLAO_TIME_BASIS_NOTE } from '../../../utils/timeBasisLine';
import * as Constants from '../../../utils/constants';
import request from '../../../utils/request';
import { parseDateParts } from '../../../utils/dateStrSafe';
import * as AstroConst from '../../../constants/AstroConst';
import {
	SU28_MODE_LABEL, EXALT_DEGREE as GL_EXALT_DEG, starDignityStatuses as glStarDignity,
	starMotionState as glStarMotion, starCombust as glStarCombust,
} from '../guolaoData';
import { computeDongwei as glDongwei, computeTongxian as glTongxian } from '../guolaoTransit';
import { buildGuolaoMoiraInfoFacts } from '../GuoLaoMoiraPanel';
import { buildLocalNongliLite } from '../../../utils/baziLunarLocal';   // 无头/快照路径的流年月支(月限用)
import {
	moiraBuildLimitTable as buildLimitTable, moiraLifeDegree as lifeDegree, moiraBirthYearBasis,
	moiraGodsFromRuleHits, moiraLongLifeCharFor, moiraFormatGodName as formatGodName,
} from '../GuoLaoMoiraWheel';
import {
	GUOLAO_LIFE_MODE_COTRANS, GUOLAO_LIFE_MODE_YUMAO, getStoredGuolaoDisplay, getStoredGuolaoTrueSolarTime,
	getStoredGuolaoNodeType, getStoredGuolaoLilithType, getStoredGuolaoBodyMode, guolaoStoredOverridesScope,
	runInGuolaoStoredOverrides, GUOLAO_LIMIT_YEAR_BOUNDARIES,
} from '../GuoLaoChartStyle';
import { fetchMoiraQizhengRules } from '../../../services/qizheng';
import * as SZConst from '../../suzhan/SZConst';
import * as Su28Helper from '../../su28/Su28Helper';
import { signDegMin, astroMsgPlainText as msg } from '../../astro/AstroHelper';
import {
	MOIRA_PLANET_ORDER, STEM_BRANCHES, MOIRA_TEN_GOD_ORG, MOIRA_TEN_GOD_ALT, MOIRA_YEAR_INFO_GROUPS,
	MOIRA_BIRTH_GOD_ORDER, MOIRA_TRANSIT_GOD_ORDER, MOIRA_SPEED_LIMITS, MOIRA_PLANET_CN_TO_ID, MOIRA_RULER_BY_SIGN,
	MOIRA_OVERCOMING,
} from './moiraConst';
import { safeList, safeMap, isIncompleteMoiraRules, joinNames, normDegree } from './format';
import { buildAspectRows, guolaoNodeModeFromFields, guolaoNodeModeName, applyGuolaoNodeMode } from './aspectsNodeMode';
import { signFromLon, guolaoLifeModeFromFields, guolaoSu28ModeFromFields, guolaoLifeModeName, computeAscSignIndex, houseFullLabel } from './fieldModes';
import { fieldsToParams, guolaoFieldValue, paramsWithMoiraTransit } from './params';

// AI 快照显示口径(黄仪=lon/赤仪=ra):buildGuolaoSnapshotTextV2 开头按 chart.displayCoord 装载,
// 与盘面/右栏同一真值源;渲染单线程,模块级变量安全(同 ACTIVE_SLOTS 模式)。
let SNAPSHOT_PREFER_LON = false;

function objectLon(obj){
	const raw = obj && (SNAPSHOT_PREFER_LON && obj.lon !== undefined ? obj.lon : (obj.ra !== undefined ? obj.ra : obj.lon));
	const lon = normDegree(raw);
	if(lon !== null){
		return lon;
	}
	const sign = obj && obj.sign ? AstroConst.LIST_SIGNS.indexOf(obj.sign) : -1;
	const signlon = Number(obj && obj.signlon);
	if(sign >= 0 && Number.isFinite(signlon)){
		return normDegree(sign * 30 + signlon);
	}
	return null;
}

function formatSignDegree(lon){
	const deg = normDegree(lon);
	if(deg === null){
		return '';
	}
	const sign = AstroConst.LIST_SIGNS[Math.floor(deg / 30) % 12];
	const parts = signDegMin(deg);
	return `${msg(sign)} ${parts[0]}度${parts[1]}分`;
}

function compactDegree(lon){
	const deg = normDegree(lon);
	if(deg === null){
		return '';
	}
	const one = Math.floor(deg % 30);
	const min = Math.floor(((deg % 30) - one) * 60);
	return `${`${one}`.padStart(2, '0')}.${`${min}`.padStart(2, '0')}`;
}

function speedText(speed){
	const num = Number(speed);
	if(!Number.isFinite(num)){
		return '';
	}
	return `${num > 0 ? '+' : ''}${num.toFixed(4)}`;
}

function planetStatus(obj){
	const speed = Number(obj && obj.lonspeed);
	if(!Number.isFinite(speed)){
		return '顺';
	}
	if(speed < -0.000001){
		return '逆';
	}
	if(Math.abs(speed) < 0.002){
		return '留';
	}
	const limit = MOIRA_SPEED_LIMITS[obj.id];
	if(limit){
		const abs = Math.abs(speed);
		if(abs < limit.slow){
			return '迟';
		}
		if(abs > limit.fast){
			return '速';
		}
	}
	return '顺';
}

export function stemBranchForYear(year){
	const num = Number(year);
	if(!Number.isFinite(num)){
		return '';
	}
	const idx = ((num - 1984) % 60 + 60) % 60;
	return STEM_BRANCHES[idx] || '';
}

export function yearFromParams(params){
	const raw = params && params.date ? `${params.date}` : '';
	const match = raw.match(/-?\d{3,4}/);
	return match ? Number(match[0]) : new Date().getFullYear();
}

function getChartRoot(result){
	return result || {};
}

function getChart(result){
	const root = getChartRoot(result);
	return root.chart || {};
}

function getBazi(result){
	const root = getChartRoot(result);
	const chart = getChart(root);
	return (chart.nongli && chart.nongli.bazi) || (root.nongli && root.nongli.bazi) || {};
}

export function baziStemBranch(result, key, fallbackYear){
	const bazi = getBazi(result);
	const one = bazi[key] || {};
	if(one.text){
		return one.text;
	}
	if(one.stem && one.branch){
		const stem = one.stem.cell || one.stem.name || one.stem.text || one.stem;
		const branch = one.branch.cell || one.branch.name || one.branch.text || one.branch;
		return `${stem || ''}${branch || ''}`;
	}
	return key === 'year' ? stemBranchForYear(fallbackYear) : '';
}

export function baziText(result){
	return ['year', 'month', 'day', 'time'].map((key)=>baziStemBranch(result, key, '')).filter(Boolean).join(' ');
}

export function lunarText(result){
	const root = getChartRoot(result);
	const chart = getChart(root);
	const nongli = chart.nongli || root.nongli || {};
	return nongli.text || nongli.nongli || nongli.lunar || nongli.lunarText || '';
}

function getZiGods(result){
	const root = getChartRoot(result);
	const chart = getChart(root);
	const rootGods = root.nongli && root.nongli.bazi && root.nongli.bazi.guolaoGods
		? root.nongli.bazi.guolaoGods.ziGods : null;
	const chartGods = chart.nongli && chart.nongli.bazi && chart.nongli.bazi.guolaoGods
		? chart.nongli.bazi.guolaoGods.ziGods : null;
	return chartGods || rootGods || {};
}

function orderGods(list, order){
	const priority = new Map(order.map((name, idx)=>[name, idx]));
	const seen = new Set();
	return safeList(list).map(formatGodName).filter((item)=>{
		if(!item || seen.has(item)){
			return false;
		}
		seen.add(item);
		return true;
	}).sort((a, b)=>{
		const ia = priority.has(a) ? priority.get(a) : 999;
		const ib = priority.has(b) ? priority.get(b) : 999;
		if(ia !== ib){
			return ia - ib;
		}
		return `${a}`.localeCompare(`${b}`, 'zh-Hans-CN');
	});
}

function findChartObject(chart, id){
	return safeList(chart.objects).find((obj)=>obj && obj.id === id);
}

export function buildQuickPlanetRows(result, rulePlanets){
	const chart = getChart(result);
	const ruleMap = new Map(safeList(rulePlanets).map((item)=>[item.id, item]));
	return MOIRA_PLANET_ORDER.map((def)=>{
		const obj = findChartObject(chart, def.id);
		const lon = objectLon(obj);
		if(!obj || lon === null){
			return null;
		}
		const rule = ruleMap.get(def.id) || {};
		return {
			id: def.id,
			name: def.name,
			signName: rule.signName || msg(obj.sign) || msg(signFromLon(lon)),
			degree: rule.degreeText || formatSignDegree(lon),
			compactDegree: compactDegree(lon),
			su28: obj.su28 || rule.su28 || '',
			house: rule.moiraHouse || msg(obj.house) || '',
			dignity: rule.dignity || '',
			status: planetStatus(obj),
			speed: speedText(obj.lonspeed),
		};
	}).filter(Boolean);
}

export function buildGodRowsFromChart(result, fields){
	const chart = getChart(result);
	const houses = safeList(chart.houses);
	const ziGods = getZiGods(result);
	const ascSignIndex = computeAscSignIndex(result, chart, fields);
	return houses.map((house, idx)=>{
		const sign = signFromLon(house && house.lon);
		const zi = sign ? SZConst.SignZi[sign] : '';
		const one = zi && ziGods ? safeMap(ziGods[zi]) : {};
		return {
			house: houseFullLabel(house, idx, ascSignIndex),
			zi,
			signName: sign ? msg(sign) : '',
			goodGods: orderGods(one.goodGods, MOIRA_BIRTH_GOD_ORDER),
			neutralGods: orderGods(one.neutralGods, MOIRA_BIRTH_GOD_ORDER),
			badGods: orderGods(one.badGods, MOIRA_BIRTH_GOD_ORDER),
			taisuiGods: orderGods(one.taisuiGods, MOIRA_TRANSIT_GOD_ORDER),
		};
	});
}

function buildHouseRowsFromChart(result, fields){
	const chart = getChart(result);
	const ascSignIndex = computeAscSignIndex(result, chart, fields);
	return safeList(chart.houses).map((house, idx)=>{
		const sign = signFromLon(house && house.lon);
		const signIdx = sign ? AstroConst.LIST_SIGNS.indexOf(sign) : -1;
		const area = signIdx >= 0 && SZConst.SZSigns[signIdx] && SZConst.SZSigns[signIdx].length >= 2
			? `${SZConst.SZSigns[signIdx][0]}${SZConst.SZSigns[signIdx][1]}`
			: '';
		return {
			index: idx,
			name: houseFullLabel(house, idx, ascSignIndex),
			zi: sign ? (SZConst.SignZi[sign] || '') : '',
			area,
			signName: sign ? msg(sign) : '',
			moiraStarHouse: msg(house && house.id ? house.id : null) || '',
		};
	});
}

function signIndexFromLon(lon){
	const sign = signFromLon(lon);
	return sign ? AstroConst.LIST_SIGNS.indexOf(sign) : -1;
}

function objectSignIndex(chart, id){
	const obj = findChartObject(chart, id);
	const lon = objectLon(obj);
	return lon === null ? -1 : signIndexFromLon(lon);
}

function localLifeObject(chart, fields){
	const mode = guolaoLifeModeFromFields(fields);
	const life = findChartObject(chart, AstroConst.LIFEMASTERDEG74);
	const asc = findChartObject(chart, AstroConst.ASC);
	const sun = findChartObject(chart, AstroConst.SUN);
	if(mode === GUOLAO_LIFE_MODE_YUMAO || mode === GUOLAO_LIFE_MODE_COTRANS){
		return life || asc || sun || null;
	}
	return asc || life || sun || null;
}

function localLifeSignIndex(chart, fields){
	const life = localLifeObject(chart, fields);
	const lon = objectLon(life);
	return lon === null ? -1 : signIndexFromLon(lon);
}

function localMoiraHouseSign(lifeSignIndex, houseOffset){
	return lifeSignIndex < 0 ? -1 : (lifeSignIndex + houseOffset + 12) % 12;
}

function localSignZi(signIdx){
	const sign = AstroConst.LIST_SIGNS[(signIdx + 12) % 12];
	return sign ? (SZConst.SignZi[sign] || '') : '';
}

function localPlanetCnById(id){
	const row = MOIRA_PLANET_ORDER.find((item)=>item.id === id);
	return row ? row.name : msg(id);
}

function localSignOfCn(chart, name, lifeSignIndex, selfSignIndex, godSigns){
	const houseMap = {
		命: localMoiraHouseSign(lifeSignIndex, 0),
		命宫: localMoiraHouseSign(lifeSignIndex, 0),
		财: localMoiraHouseSign(lifeSignIndex, 1),
		财帛: localMoiraHouseSign(lifeSignIndex, 1),
		兄弟: localMoiraHouseSign(lifeSignIndex, 2),
		田: localMoiraHouseSign(lifeSignIndex, 3),
		田宅: localMoiraHouseSign(lifeSignIndex, 3),
		嗣: localMoiraHouseSign(lifeSignIndex, 4),
		男女: localMoiraHouseSign(lifeSignIndex, 4),
		奴: localMoiraHouseSign(lifeSignIndex, 5),
		奴仆: localMoiraHouseSign(lifeSignIndex, 5),
		妻: localMoiraHouseSign(lifeSignIndex, 6),
		夫妻: localMoiraHouseSign(lifeSignIndex, 6),
		疾: localMoiraHouseSign(lifeSignIndex, 7),
		疾厄: localMoiraHouseSign(lifeSignIndex, 7),
		迁: localMoiraHouseSign(lifeSignIndex, 8),
		迁移: localMoiraHouseSign(lifeSignIndex, 8),
		官: localMoiraHouseSign(lifeSignIndex, 9),
		官禄: localMoiraHouseSign(lifeSignIndex, 9),
		福: localMoiraHouseSign(lifeSignIndex, 10),
		福德: localMoiraHouseSign(lifeSignIndex, 10),
		相: localMoiraHouseSign(lifeSignIndex, 11),
		相貌: localMoiraHouseSign(lifeSignIndex, 11),
		身: selfSignIndex,
	};
	if(Object.prototype.hasOwnProperty.call(houseMap, name)){
		return houseMap[name];
	}
	if(godSigns && godSigns[name] !== undefined){
		return godSigns[name];
	}
	if(MOIRA_PLANET_CN_TO_ID[name]){
		return objectSignIndex(chart, MOIRA_PLANET_CN_TO_ID[name]);
	}
	const signs = ['戌', '酉', '申', '未', '午', '巳', '辰', '卯', '寅', '丑', '子', '亥'];
	const idx = signs.indexOf(name);
	return idx >= 0 ? idx : -1;
}

function localMoiraGodSigns(godRows){
	const res = {};
	safeList(godRows).forEach((row)=>{
		const signIdx = ['戌', '酉', '申', '未', '午', '巳', '辰', '卯', '寅', '丑', '子', '亥'].indexOf(row.zi);
		if(signIdx < 0){
			return;
		}
		['goodGods', 'neutralGods', 'badGods', 'taisuiGods'].forEach((key)=>{
			safeList(row[key]).forEach((name)=>{
				const val = formatGodName(name);
				if(val && res[val] === undefined){
					res[val] = signIdx;
				}
			});
		});
	});
	return res;
}

function localMoiraSuRuler(su){
	if(!su){
		return '';
	}
	if('星房虚昴'.indexOf(su) >= 0){
		return '日';
	}
	if('张心危毕'.indexOf(su) >= 0){
		return '月';
	}
	if('亢牛娄鬼'.indexOf(su) >= 0){
		return '金';
	}
	if('角斗奎井'.indexOf(su) >= 0){
		return '木';
	}
	if('轸壁参箕'.indexOf(su) >= 0){
		return '水';
	}
	if('尾室觜翼'.indexOf(su) >= 0){
		return '火';
	}
	if('氐女胃柳'.indexOf(su) >= 0){
		return '土';
	}
	return '';
}

function localMoiraIsWinter(params){
	// 日期串单源拆(公元前 '-0300-12-10' 不会把年当成月)
	const p = parseDateParts(params && params.date ? params.date : '');
	const month = p ? p.month : NaN;
	return month === 11 || month === 12 || month === 1;
}

function localMoiraIsDay(params){
	const hour = Number(`${params && params.time ? params.time : '12:00:00'}`.split(':')[0]);
	return Number.isFinite(hour) ? hour >= 6 && hour < 18 : true;
}

function localMoiraNearSignBoundary(lon){
	if(lon === null){
		return false;
	}
	const val = ((lon % 30) + 30) % 30;
	return val <= 1 || val >= 29;
}

function localMoiraNearSuBoundary(chart, lon){
	if(lon === null){
		return false;
	}
	return safeList(chart && chart.fixedStarSu28).some((item)=>{
		const ra = normDegree(item && item.ra);
		if(ra === null){
			return false;
		}
		const diff = Math.abs(normDegree(lon) - ra);
		return Math.min(diff, 360 - diff) <= 1;
	});
}

function localMoiraLostRulership(chart, subject, lifeSignIndex, selfSignIndex, godSigns){
	const signIdx = localSignOfCn(chart, subject, lifeSignIndex, selfSignIndex, godSigns);
	if(signIdx < 0){
		return false;
	}
	const sign = AstroConst.LIST_SIGNS[signIdx];
	const rulerId = MOIRA_RULER_BY_SIGN[sign];
	const rulerCn = localPlanetCnById(rulerId);
	const rulerSign = objectSignIndex(chart, rulerId);
	if(rulerSign < 0){
		return false;
	}
	const rulerOfRulerSign = localPlanetCnById(MOIRA_RULER_BY_SIGN[AstroConst.LIST_SIGNS[rulerSign]]);
	return rulerOfRulerSign === MOIRA_OVERCOMING[rulerCn];
}

function addLocalMoiraPattern(list, name, level, score, detail, dsl){
	list.push({
		name,
		level,
		score,
		source: 'moira_s.prop-local',
		dsl,
		detail,
	});
}

function buildLocalMoiraPatterns(chartObj, fields, params, godRows){
	const chart = getChart(chartObj);
	const lifeObj = localLifeObject(chart, fields);
	const lifeLon = objectLon(lifeObj);
	const lifeSignIndex = localLifeSignIndex(chart, fields);
	const selfSignIndex = objectSignIndex(chart, AstroConst.MOON);
	const godSigns = localMoiraGodSigns(godRows);
	const signOf = (name)=>localSignOfCn(chart, name, lifeSignIndex, selfSignIndex, godSigns);
	const same = (a, b)=>a >= 0 && b >= 0 && a === b;
	const rel = (base, offset)=>(base + offset + 12) % 12;
	const sun = signOf('日');
	const moon = signOf('月');
	const venus = signOf('金');
	const mercury = signOf('水');
	const darkMoon = signOf('孛');
	const northNode = signOf('罗');
	const guan = signOf('官');
	const fu = signOf('福');
	const patterns = [];
	const isDay = localMoiraIsDay(params);
	const lifeZi = lifeSignIndex >= 0 ? localSignZi(lifeSignIndex) : '';

	if(lifeSignIndex >= 0 && lifeZi && ('戌亥'.indexOf(lifeZi) >= 0)){
		const diseaseRulerCn = localPlanetCnById(MOIRA_RULER_BY_SIGN[AstroConst.LIST_SIGNS[signOf('疾')]]);
		if(same(signOf(diseaseRulerCn), lifeSignIndex)){
			addLocalMoiraPattern(patterns, '八杀朝天', 'good', '3.2.0', '政余喜格：疾厄宫主入命，且命临戌亥。', '@{@{疾厄}[1]}=@命');
		}
	}
	const moonSign = moon;
	if(moonSign >= 0){
		const sameMoonSignCount = MOIRA_PLANET_ORDER
			.map((item)=>objectSignIndex(chart, item.id))
			.filter((idx)=>idx === moonSign).length;
		if(!isDay && sameMoonSignCount === 1){
			addLocalMoiraPattern(patterns, '孤月独明', 'good', '2.3.0', '政余喜格：夜生月曜独居一方。', '?{孤月} & ?夜');
		}
	}
	if(same(sun, rel(guan, 4)) && same(moon, rel(guan, -4)) || same(sun, rel(guan, -4)) && same(moon, rel(guan, 4))){
		addLocalMoiraPattern(patterns, '日月拱官', 'good', '2.3.0', '政余喜格：日月分拱官禄。', '@日=@官禄+4 & @月=@官禄-4');
	}
	if(same(venus, mercury) && !localMoiraIsWinter(params)){
		addLocalMoiraPattern(patterns, '金水相涵', 'good', '2.3.0', '政余喜格：金水同宫，且不以冬令破格。', '?{金水会} & !?冬');
	}
	const noble = signOf(isDay ? '天贵' : '玉贵');
	if(same(sun, rel(noble, 4)) && same(moon, rel(noble, -4)) || same(sun, rel(noble, -4)) && same(moon, rel(noble, 4))){
		addLocalMoiraPattern(patterns, '日月拱贵人', 'good', '2.2.0', `政余喜格：${isDay ? '昼取天贵' : '夜取玉贵'}，日月分拱。`, '?昼/夜 & 日月拱贵人');
	}
	if(same(lifeSignIndex, signOf('岁驾'))){
		addLocalMoiraPattern(patterns, '命登岁驾', 'good', '2.0.3', '政余喜格：命度临岁驾。', '@命=@{岁驾}');
	}
	if(sun >= 0 && moon >= 0){
		const sunZi = localSignZi(sun);
		const moonZi = localSignZi(moon);
		if(('申酉戌亥子丑'.indexOf(sunZi) >= 0) && ('寅卯辰巳午未'.indexOf(moonZi) >= 0)){
			addLocalMoiraPattern(patterns, '日月失所', 'bad', '2.3.0', '政余忌格：日居西北、月居东南。', '(?{日西}|?{日北}) & (?{月东}|?{月南})');
		}
	}
	if(localMoiraLostRulership(chart, '官', lifeSignIndex, selfSignIndex, godSigns) && localMoiraLostRulership(chart, '福', lifeSignIndex, selfSignIndex, godSigns)){
		addLocalMoiraPattern(patterns, '官福失垣', 'bad', '2.2.0', '政余忌格：官禄、福德主失垣。', '?{官失垣} & ?{福失垣}');
	}
	if(same(darkMoon, sun)){
		addLocalMoiraPattern(patterns, '孛犯太阳', 'bad', '2.2.0', '政余忌格：孛与太阳同宫。', '?{日孛遇}');
	}
	if(same(northNode, sun)){
		addLocalMoiraPattern(patterns, '罗犯太阳', 'bad', '2.2.0', '政余忌格：罗与太阳同宫。', '?{日罗遇}');
	}
	if(same(northNode, darkMoon)){
		addLocalMoiraPattern(patterns, '孛罗交战', 'bad', '2.2.0', '政余忌格：罗孛同宫。', '?{罗孛遇}');
	}
	if(localMoiraNearSignBoundary(lifeLon) || localMoiraNearSuBoundary(chart, lifeLon)){
		addLocalMoiraPattern(patterns, '命坐两歧', 'bad', '2.0.4', '政余忌格：命度近宫界或宿界。', '?{命宫歧} | ?{命宿歧}');
	}
	return patterns.sort((a, b)=>{
		const la = a.level === 'good' ? 0 : (a.level === 'bad' ? 1 : 2);
		const lb = b.level === 'good' ? 0 : (b.level === 'bad' ? 1 : 2);
		return la - lb;
	});
}

export function buildLocalMoiraRules(params, chartObj, fields, reason){
	const godHits = buildGodRowsFromChart(chartObj, fields);
	const patterns = buildLocalMoiraPatterns(chartObj, fields, params, godHits);
	return {
		engine: 'horosa-local-moira-panel-fallback',
		engineLabel: 'Moira政余格局（本地规则）',
		summary: `本地已接入 Moira 政余格局规则：命中喜格 ${patterns.filter((item)=>item.level === 'good').length} 条、忌格 ${patterns.filter((item)=>item.level === 'bad').length} 条。`,
		styleSource: 'moira-dsl-local-evaluated',
		styleWarning: '',
		params: {
			...(params || {}),
		},
		anchors: {},
		houses: buildHouseRowsFromChart(chartObj, fields),
		planets: [],
		patterns,
		godHits,
		fallbackReason: reason ? `${reason}` : '',
	};
}

export function normalizeGodRows(rows, order){
	return safeList(rows).filter(Boolean).map((row)=>({
		...row,
		goodGods: orderGods(row.goodGods, order),
		neutralGods: orderGods(row.neutralGods, order),
		badGods: orderGods(row.badGods, order),
		taisuiGods: orderGods(row.taisuiGods, MOIRA_TRANSIT_GOD_ORDER),
	}));
}

// ⚠️ 死代码(零调用,同类自检 v42 定性):主链=buildGuolaoSnapshotTextV2;本函数段头(宫位与星体/宫位二十八宿)
// 未登 preset 属死码段——若复活必须先登记 preset+migration(全树段头哨兵会咬)。
function buildGuolaoSnapshotText(params, result){
	const lines = [];
	const chart = result && result.chart ? result.chart : {};
	const houses = chart.houses || [];
	const objects = chart.objects || [];
	const signsRA = result && result.signsRA ? result.signsRA : [];
	const ziGods = result && result.nongli && result.nongli.bazi && result.nongli.bazi.guolaoGods
		? result.nongli.bazi.guolaoGods.ziGods : null;

	lines.push('[起盘信息]');
	lines.push(`日期：${params.date} ${params.time}`);
	lines.push(`时区：${params.zone}`);
	lines.push(`经纬度：${params.lon} ${params.lat}`);
	lines.push(buildTimeBasisLine({ timeAlg: params.timeAlg, lateZiHourUseNextDay: params.lateZiHourUseNextDay, after23NewDay: params.after23NewDay, note: GUOLAO_TIME_BASIS_NOTE }));   // 两套时标说清

	lines.push('');
	lines.push('[宫位与星体]');
	houses.forEach((house, idx)=>{
		lines.push(`宫位：${msg(house.id) || `第${idx + 1}宫`}`);
		const inHouse = objects.filter((obj)=>obj.house === house.id);
		if(inHouse.length === 0){
			lines.push('星体：无');
			lines.push('');
			return;
		}
		inHouse.forEach((obj)=>{
			const sd = signDegMin(obj.signlon);
			const su28 = obj.su28 ? `，宿:${obj.su28}` : '';
			lines.push(`星体：${msg(obj.id)} ${sd[0]}˚${msg(obj.sign)}${sd[1]}分${su28}`);
		});
		lines.push('');
	});

	if(signsRA.length){
		lines.push('');
		lines.push('[宫位二十八宿]');
		signsRA.forEach((sig)=>{
			lines.push(`${msg(sig.id)}：赤经${Math.round(sig.ra * 1000) / 1000}`);
		});
	}

	if(ziGods){
		lines.push('');
		lines.push('[神煞]');
		Object.keys(ziGods).forEach((zi)=>{
			const one = ziGods[zi] || {};
			const all = orderGods(one.allGods || [], MOIRA_BIRTH_GOD_ORDER);
			const tai = orderGods(one.taisuiGods || [], MOIRA_TRANSIT_GOD_ORDER);
			lines.push(`${zi}：神煞=${all.join('、') || '无'}；太岁神=${tai.join('、') || '无'}`);
		});
	}
	return lines.join('\n');
}

function buildGuolaoSuSection(result, planetDisplay){
	const chart = result && result.chart ? result.chart : {};
	const suHouses = chart && chart.fixedStarSu28 ? chart.fixedStarSu28 : [];
	const objects = chart && chart.objects ? chart.objects : [];
	const lines = [];
	let visibleSet = null;
	if(planetDisplay && planetDisplay.length){
		visibleSet = new Set(planetDisplay);
	}

	suHouses.forEach((su)=>{
		lines.push(`${su.name}`);
		let inSu = objects.filter((obj)=>{
			if(obj.su28 !== su.name){
				return false;
			}
			if(visibleSet){
				return visibleSet.has(obj.id);
			}
			return AstroConst.isTraditionPlanet(obj.id);
		});
		inSu = inSu.sort((a, b)=>{
			if(a.ra > 300 && b.ra < 30){
				return -1;
			}
			// 环形序须对称全序:跨 0°RA 两向都判,单侧判 = 非对称比较器,sort 行为未定义。
			if(b.ra > 300 && a.ra < 30){
				return 1;
			}
			return a.ra - b.ra;
		});
		if(inSu.length === 0){
			lines.push('星体：无');
			lines.push('');
			return;
		}
		inSu.forEach((obj)=>{
			let radeg = Number(objectLon(obj)) - Number(su.ra);
			if(Number.isNaN(radeg)){
				radeg = Number(obj.signlon);
			}
			if(radeg < 0){
				radeg += 360;
			}
			const sd = signDegMin(radeg);
			lines.push(`星体：${msg(obj.id)} ${sd[0]}˚${obj.su28}${sd[1]}分`);
		});
		lines.push('');
	});

	return lines.join('\n').trim();
}

// GFM 表化(段内排版,值零变化):行=宫×宿(空宫一行 无/无),宫内星列表一 cell 内联「；」相接,
// 星字串(曜 d˚宿m分)与旧「星曜：」行逐字同。(宫位,宿,星)元组集合证明见 guolaoSnapshotTables.test.js。
export function buildHouseSuAndGodsSection(result, planetDisplay, fields){
	const chart = result && result.chart ? result.chart : {};
	const houses = chart && chart.houses ? chart.houses : [];
	const objects = chart && chart.objects ? chart.objects : [];
	const ascSignIndex = computeAscSignIndex(result, chart, fields);
	let visibleSet = null;
	if(planetDisplay && planetDisplay.length){
		visibleSet = new Set(planetDisplay);
	}
	const lines = [];

	houses.forEach((house, idx)=>{
		const label = houseFullLabel(house, idx, ascSignIndex);
		let inHouse = objects.filter((obj)=>{
			if(obj.house !== house.id){
				return false;
			}
			if(visibleSet){
				return visibleSet.has(obj.id);
			}
			return AstroConst.isTraditionPlanet(obj.id);
		});
		inHouse = inHouse.sort((a, b)=>{
			if(a.ra > 300 && b.ra < 30){
				return -1;
			}
			// 环形序须对称全序:跨 0°RA 两向都判,单侧判 = 非对称比较器,sort 行为未定义。
			if(b.ra > 300 && a.ra < 30){
				return 1;
			}
			return a.ra - b.ra;
		});

		if(inHouse.length === 0){
			lines.push(`| ${label} | 无 | 无 |`);
			return;
		}
		const suMap = new Map();
		inHouse.forEach((obj)=>{
			const su = obj.su28 || '未知宿';
			if(!suMap.has(su)){
				suMap.set(su, []);
			}
			suMap.get(su).push(obj);
		});

		const suKeys = Array.from(suMap.keys()).sort((a, b)=>{
			const ia = Su28Helper.Su28.indexOf(a);
			const ib = Su28Helper.Su28.indexOf(b);
			if(ia < 0 && ib < 0){
				return `${a}`.localeCompare(`${b}`);
			}
			if(ia < 0){
				return 1;
			}
			if(ib < 0){
				return -1;
			}
			return ia - ib;
		});

		suKeys.forEach((su)=>{
			const list = suMap.get(su) || [];
			const stars = list.map((obj)=>{
				let radeg = Number(objectLon(obj));
				if(!Number.isNaN(radeg)){
					const suRef = (chart.fixedStarSu28 || []).find((it)=>it.name === su);
					if(suRef && suRef.ra !== undefined && suRef.ra !== null){
						radeg = Number(objectLon(obj)) - Number(suRef.ra);
						if(radeg < 0){
							radeg += 360;
						}
					}else{
						radeg = Number(obj.signlon);
					}
				}else{
					radeg = Number(obj.signlon);
				}
				const sd = signDegMin(radeg);
				return `${msg(obj.id)} ${sd[0]}˚${su}${sd[1]}分`;
			});
			lines.push(`| ${label} | ${su} | ${stars.join('；') || '无'} |`);
		});
	});
	if(!lines.length){
		return '';
	}
	return ['| 宫位 | 二十八宿 | 星曜 |', '| --- | --- | --- |'].concat(lines).join('\n').trim();
}

function buildHouseGodsSection(result, fields){
	const chart = result && result.chart ? result.chart : {};
	const houses = chart && chart.houses ? chart.houses : [];
	const ascSignIndex = computeAscSignIndex(result, chart, fields);
	const rootZiGods = result && result.nongli && result.nongli.bazi && result.nongli.bazi.guolaoGods
		? result.nongli.bazi.guolaoGods.ziGods : null;
	const chartZiGods = chart && chart.nongli && chart.nongli.bazi && chart.nongli.bazi.guolaoGods
		? chart.nongli.bazi.guolaoGods.ziGods : null;
	const ziGods = chartZiGods || rootZiGods || null;
	const lines = [];

	houses.forEach((house, idx)=>{
		lines.push(`宫位：${houseFullLabel(house, idx, ascSignIndex)}`);
		const sign = signFromLon(house.lon);
		const zi = sign ? SZConst.SignZi[sign] : null;
		const gz = ziGods && zi ? ziGods[zi] : null;
		const allGods = orderGods(gz ? []
			.concat(gz.goodGods || [])
			.concat(gz.neutralGods || [])
			.concat(gz.badGods || []) : [], MOIRA_BIRTH_GOD_ORDER);
		const taiGods = orderGods(gz ? (gz.taisuiGods || []) : [], MOIRA_TRANSIT_GOD_ORDER);
		lines.push(`神煞：${allGods.join('、') || '无'}`);
		lines.push(`太岁神：${taiGods.join('、') || '无'}`);
		lines.push('');
	});

	return lines.join('\n').trim();
}

// 供 AI 分析无头复算：按出生字段取七政四余盘并生成快照（命度/罗计沿用已保存设置，显示全部传统星曜）。
export async function buildGuolaoSnapshotForFields(fields){
	if(!fields){
		return '';
	}
	// AI 挂载按覆盖重算时,覆盖作用域只在同步段可见:此处(第一个 await 之前)取下,之后各同步段重入
	const ovScope = guolaoStoredOverridesScope();
	const params = fieldsToParams(fields);
	const data = await request(`${Constants.ServerRoot}/chart`, {
		body: JSON.stringify({ ...params, cid: null }),
		silent: true,
	});
	const result = data && data[Constants.ResultKey] ? data[Constants.ResultKey] : null;
	if(!result){
		return '';
	}
	return runInGuolaoStoredOverrides(ovScope, ()=>buildGuolaoSnapshotAfterChart(params, result, fields, ovScope));
}

async function buildGuolaoSnapshotAfterChart(params, result, fields, ovScope){
	// 罗计换位与页面同源:页面存快照前 applyGuolaoNodeMode(chartObj, fields)(北罗南计=深换
	// NORTH/SOUTH_NODE id),再用换位后的盘取 rules、出快照;无头此前直接拿 /chart 原始 result 喂 rules/builder →
	// 快照 [起盘信息] 标「北罗南计」而 [宫位与二十八宿]/[星曜庙旺]/[相位] 里罗睺/计都仍在北计南罗位置。
	const display = applyGuolaoNodeMode(result, fields) || result;
	// 无头路径曾漏传第 5 参 moiraRules(恒 undefined)→ 挂载复算恒丢 [虚实]/[本命化曜]/
	// [流年流曜] 三段、[神煞] 降级历法源——与页面快照不等长。补:远端规则同页面口径,
	// 不完整/失败回退本地纯算(与 requestMoiraRules 同两级兜底,绝不阻断主体段)。
	let rules = null;
	try{
		const rsp = await fetchMoiraQizhengRules({
			params, chartObj: display, transitParams: null, transitChartObj: null,
		}, { silent: true, timeoutMs: 12000 });
		const remote = rsp && rsp[Constants.ResultKey] ? rsp[Constants.ResultKey] : null;
		rules = isIncompleteMoiraRules(remote)
			? runInGuolaoStoredOverrides(ovScope, ()=>buildLocalMoiraRules(params, display, fields, 'headless-fallback'))
			: remote;
	}catch(e){
		try{ rules = runInGuolaoStoredOverrides(ovScope, ()=>buildLocalMoiraRules(params, display, fields, 'headless-error')); }catch(_e){ rules = null; }
	}
	return runInGuolaoStoredOverrides(ovScope, ()=>buildGuolaoSnapshotTextV2(params, display, null, fields, rules));
}

// AI 快照·神煞段与盘面同源(rules 引擎 godHits+十二长生;rules 未到回退历法 ziGods)——
// 「显示什么就导出什么」:盘面/右栏已切 rules 源,快照必须同步,防 AI 拿到另一套神煞。
function buildRulesGodsSection(moiraRules){
	const hits = moiraRules && moiraRules.godHits;
	if(!hits || !hits.length){
		return '';
	}
	const ZHI12 = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
	const out = [];
	ZHI12.forEach((zi)=>{
		const gods = moiraGodsFromRuleHits(moiraRules, zi, 'birth') || [];
		const ll = moiraLongLifeCharFor(moiraRules, zi, 'birth');
		const all = (ll ? [ll] : []).concat(gods);
		if(all.length){
			out.push(`${zi}：${all.join('、')}`);
		}
	});
	return out.join('\n');
}

// AI 快照·星曜庙旺与星点动态段（与右栏「星点动态」表同源函数 glStarDignity/glStarMotion，单一真值）：
// 每点 曜｜地支｜所属(殿垣庙旺乐喜怒)｜速度态(顺逆留伏迟速)。天海冥无庙旺、升顶无庙旺无自行 → '-'。
// GFM 表化(段内排版,值零变化):所属/速度态字串(glStarDignity·连、glStarMotion)与旧「所属:X 速度:Y」逐字同,
// 仅去内联「所属:」「速度:」标签移入表头。31 golden(guolaoDignityMotion.test.js)锚的是底层算法值、不受排版影响;
// (曜,地支,所属,速度态) 元组集合证明见 guolaoSnapshotTables.test.js。
export function buildStarDignityMotionSection(result, fields){
	const chart = result && result.chart ? result.chart : {};
	const objects = Array.isArray(chart.objects) ? chart.objects : [];
	if(!objects.length){ return ''; }
	const ecl = chart.displayCoord === 'ecliptic';
	const ZLIST = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
	const ziOf = (lon)=>{ const n = ((lon % 360) + 360) % 360; const s = Math.floor(n / 30) % 12; return ZLIST[(10 - s + 12) % 12] || ''; };
	const lonOf = (obj)=>{ const raw = obj && (ecl && obj.lon !== undefined ? obj.lon : (obj.ra !== undefined ? obj.ra : obj.lon)); return Number(raw); };
	const sun = objects.find((o)=>o && o.id === AstroConst.SUN);
	const sunLon = sun ? lonOf(sun) : NaN;
	const STAR_POINTS = [
		['日', AstroConst.SUN], ['月', AstroConst.MOON], ['金', AstroConst.VENUS], ['木', AstroConst.JUPITER],
		['水', AstroConst.MERCURY], ['火', AstroConst.MARS], ['土', AstroConst.SATURN],
		['计', AstroConst.SOUTH_NODE], ['罗', AstroConst.NORTH_NODE], ['炁', AstroConst.PURPLE_CLOUDS], ['孛', AstroConst.DARKMOON],
		['天', AstroConst.URANUS], ['海', AstroConst.NEPTUNE], ['冥', AstroConst.PLUTO],
	];
	const ANGLE_POINTS = [['升', AstroConst.ASC], ['顶', AstroConst.MC]];
	const rows = [];
	STAR_POINTS.forEach(([name, id])=>{
		const obj = objects.find((o)=>o && o.id === id);
		if(!obj){ return; }
		const lon = lonOf(obj);
		if(!Number.isFinite(lon)){ return; }
		const zhi = ziOf(lon);
		const ex = GL_EXALT_DEG[name];
		const atPeak = !!(ex && Math.floor((((lon % 360) + 360) % 360) / 30) % 12 === ex.signIndex && Math.abs((((lon % 360) + 360) % 360) % 30 - ex.deg) <= 1);
		const combust = glStarCombust(name, lon, sunLon);   // Moira 合日 3°(单一真值,与右栏星点动态同源)
		const belong = glStarDignity(name, zhi, atPeak).join('·') || '-';
		const motion = glStarMotion(name, Number(obj.lonspeed), combust) || '-';
		rows.push(`| ${name} | ${zhi} | ${belong} | ${motion} |`);
	});
	ANGLE_POINTS.forEach(([name, id])=>{
		const obj = objects.find((o)=>o && o.id === id);
		if(!obj){ return; }
		const lon = lonOf(obj);
		if(!Number.isFinite(lon)){ return; }
		rows.push(`| ${name} | ${ziOf(lon)} | - | - |`);
	});
	if(!rows.length){
		return '';
	}
	return ['| 曜 | 地支 | 所属 | 速度态 |', '| --- | --- | --- | --- |'].concat(rows).join('\n');
}

// AI 快照·流年流曜段（右栏「流曜」快捷面板已显示但此前未导出）：与 renderQuickTransitStars 同一取数——
// 流年干支=rules.yearStars.transit.yearPole（缺则按 UI 同式 stemBranchForYear(流年时间之年) 兜底）；
// 流年化曜=rules.yearStars.transit.planetRows（曜/化曜/同归项）；流曜落宫=rules.transitYearStars（宫名/化曜/曜名/宫性）。
// 流年时间口径=UI 默认（paramsWithMoiraTransit 缺省走 makeDefaultMoiraTransitTime，即「当前流年」）。
// 无规则层或无流年数据（未起盘/headless 复算）→ 返回 ''（不产段）；异常降级 ''，不影响既有段。
// [虚实] 段(v44 硬缺修):虚实 tab 整层此前显示了完全导不出——虚宫(四柱旬空推)/实宫(四柱地支定)
// 是果老明确断项。值与 renderQuickWeakSolid 主路同源(moiraRules.weakSolid.houses);无数据不产段。
export function buildGuolaoWeakSolidSection(moiraRules){
	try{
		const rows = safeList(safeMap(safeMap(moiraRules).weakSolid).houses);
		if(!rows.length){
			return '';
		}
		const out = [];
		out.push('| 宫位 | 虚实 | 虚柱 | 实柱 |');
		out.push('| --- | --- | --- | --- |');
		rows.forEach((house)=>{
			out.push(`| ${house.house || '—'} | ${house.label || '—'} | ${joinNames(house.weakPillars) || '—'} | ${joinNames(house.solidPillars) || '—'} |`);
		});
		out.push('口径：虚宫按四柱旬空推虚；实宫按年、月、日、时四柱地支定实。');
		return out.join('\n');
	}catch(e){
		return '';
	}
}

// [本命化曜] 段(v44 半缺修):化曜 tab 此前只导流年侧——本命化曜为核心,十神序/天禄至天权为参考表。
// 值与 renderQuickYearStars 的本命侧同源(moiraRules.yearStars.birth);无数据不产段。
export function buildGuolaoBirthStarsSection(moiraRules){
	try{
		const birthYearStars = safeMap(safeMap(safeMap(moiraRules).yearStars).birth);
		const planetRows = safeList(birthYearStars.planetRows);
		if(!planetRows.length){
			return '';
		}
		const out = [];
		if(birthYearStars.yearPole){
			out.push(`本命年柱：${birthYearStars.yearPole}`);
		}
		out.push('◆ 本命化曜');
		planetRows.forEach((row)=>{
			const items = safeList(row.items).length ? joinNames(row.items) : '';
			out.push(`${row.star}：化${row.changeTo || '-'}${items && items !== '无' ? `（同归：${items}）` : ''}`);
		});
		// 命曜表(右栏「宫位化曜·本命」列 = rules.natalYearStars:宫名/化曜/曜名/宫性)此前不进快照。
		const natalSignRows = safeList(safeMap(moiraRules).natalYearStars);
		if(natalSignRows.length){
			out.push('◆ 命曜落宫');
			natalSignRows.forEach((row)=>{
				const pos = [row.quality, row.zi, row.signName].filter(Boolean).join(' · ');
				out.push(`${row.name}：${row.star || '-'}（${row.shortName || '-'}${pos ? `；${pos}` : ''}）`);
			});
		}
		out.push('◆ 十神序（参考）');
		out.push(`原十神序：${MOIRA_TEN_GOD_ORG.join('、')}`);
		out.push(`替代十神序：${MOIRA_TEN_GOD_ALT.join('、')}`);
		out.push('◆ 天禄至天权（年曜主项）');
		MOIRA_YEAR_INFO_GROUPS.forEach((items)=>{
			out.push(`${items[0]}：${items.slice(1).join('、') || '主项'}`);
		});
		return out.join('\n');
	}catch(e){
		return '';
	}
}

function buildGuolaoTransitStarsSection(fields, moiraRules){
	try{
		if(!moiraRules){
			return '';
		}
		const currentYearStars = safeMap(safeMap(moiraRules.yearStars).transit);
		const planetRows = safeList(currentYearStars.planetRows);
		const signRows = safeList(moiraRules.transitYearStars);
		if(!planetRows.length && !signRows.length){
			return '';
		}
		const out = [];
		const yearGz = currentYearStars.yearPole
			|| stemBranchForYear(yearFromParams(paramsWithMoiraTransit(fields, null)));
		if(yearGz){
			out.push(`流年干支：${yearGz}`);
		}
		if(planetRows.length){
			out.push('◆ 流年化曜');
			planetRows.forEach((row)=>{
				const items = safeList(row.items).length ? joinNames(row.items) : '';
				out.push(`${row.star}：化${row.changeTo || '-'}${items && items !== '无' ? `（同归：${items}）` : ''}`);
			});
		}
		if(signRows.length){
			out.push('◆ 流曜落宫');
			signRows.forEach((row)=>{
				const pos = [row.quality, row.zi, row.signName].filter(Boolean).join(' · ');
				out.push(`${row.name}：${row.star || '-'}（${row.shortName || '-'}${pos ? `；${pos}` : ''}）`);
			});
		}
		return out.join('\n');
	}catch(e){
		return '';
	}
}

// AI 快照取右栏「命身与限度 / 三主·化曜 / 难仇恩用 / 五限 / 行运法」诸卡的事实层:
// 与 GuoLaoMoiraPanel 同一 buildGuolaoMoiraInfoFacts(页面显示什么、快照就写什么)。流年时刻按 fields 缺省
// (paramsWithMoiraTransit,与 [流年流曜] 段同口径);月限所需流年月支无头无后端流年盘 → 本地历法(lunar.js)
// 算流年四柱伪 root,页面/无头两路同走此处 → 两路快照逐字相同。任何异常降级 null,不影响既有段。
function buildGuolaoInfoFactsForSnapshot(params, result, fields, display, moiraRules){
	try{
		const transitParams = paramsWithMoiraTransit(fields, null);
		let transitValue = null;
		try{
			const lite = buildLocalNongliLite(transitParams);
			transitValue = lite && lite.bazi ? { nongli: { bazi: lite.bazi } } : null;
		}catch(e){ transitValue = null; }
		return buildGuolaoMoiraInfoFacts({
			value: moiraRules || {}, rootValue: result || {}, transitValue, params, transitParams, display: display || {}, fields: fields || {},
		});
	}catch(e){
		return null;
	}
}

// [起盘信息] 命度实值 / 身度 / 命度宿主 / 身度宿主 四行(右栏「命身与限度」卡同源)。
function buildGuolaoAnchorLines(info){
	if(!info || !info.life){ return []; }
	const out = [];
	const anchorText = (a, extra)=>{
		const main = `${a.signName || '随盘面'} ${a.degreeText || ''}`.trim();
		const tail = [a.zi, a.area, a.moiraHouse].concat(extra || []).filter(Boolean).join(' · ');
		return tail ? `${main}（${tail}）` : main;
	};
	out.push(`命度：${anchorText(info.life, [info.lifeModeName])}`);
	if(info.self && (info.self.signName || info.self.degreeText)){
		out.push(`身度：${anchorText(info.self)}`);
	}
	out.push(`命度宿主：${info.lifeSuHost ? info.lifeSuHost.value : '随盘面'}；身度宿主：${info.selfSuHost ? info.selfSuHost.value : '随盘面'}`);
	return out;
}

// [三主与化曜] 段:三主(命主/宫主/度主/身主)+ 命宫配干 + 生年化曜 + 难仇恩用(度/宫两役行)。
// 「命主取法」齿轮在此对正文生效(命主(宫主)/命主(度主) 与难仇恩用主星随之改变)。
export function buildGuolaoMastersSection(info){
	try{
		if(!info){ return ''; }
		const out = [];
		if(info.masterItems && info.masterItems.length){
			out.push(`◆ 三主 · 命宫配干 · 化曜（${info.useDu ? '专度主' : '主宫主'}）`);
			info.masterItems.forEach((it)=>{ out.push(`${it.label}：${it.value}`); });
		}
		if(info.helperRows && info.helperRows.length){
			out.push('◆ 难仇恩用（主星五行四役）');
			const labels = info.helperLabels || ['难', '仇', '恩', '用'];
			info.helperRows.forEach((row)=>{
				out.push(`${row.head}(${row.main})：${labels.map((lab, li)=>`${lab}=${row.roles[li] || '-'}`).join('，')}`);
			});
		}
		return out.join('\n');
	}catch(e){
		return '';
	}
}

// [限法实算] 段:飞限 / 童限 / 小限 / 月限 / 限度(当年虚岁实算)+ 所选「行运法」的实算
// (洞微本年吊度 / 童限顺排 / 小限宫 / 月限宫)。「行运法」齿轮在此对正文生效(此前只改 [大限] 段一行标签)。
export function buildGuolaoLimitCalcSection(info){
	try{
		if(!info){ return ''; }
		const out = [];
		const lim = info.limits;
		if(lim && lim.items && lim.items.length){
			out.push(`◆ 飞限 · 童限 · 小限 · 月限 · 限度（${lim.age} 岁 · ${lim.transitYearText}年）`);
			out.push(lim.items.map((it)=>`${it.label}：${it.value}`).join('；'));
		}
		const rl = info.runLaw;
		if(rl && rl.type === 'dongwei'){
			out.push(`◆ 行运法实算 · 洞微大限（起限 ${rl.startAge} 岁）`);
			out.push(rl.curDiaodu ? `本年飞星吊度 ≈ ${rl.curDiaodu.deg}°（${rl.age} 岁）` : '本年飞星吊度：需年龄');
		}else if(rl && rl.type === 'tong'){
			out.push(`◆ 行运法实算 · 童限（基数${rl.baseName}）`);
			out.push(`童限顺排：${(rl.palaces || []).join('→')}；出童限(约)：${rl.exitAge} 岁`);
		}else if(rl && rl.type === 'month'){
			out.push(`◆ 行运法实算 · 月限（小限宫起生月逆寻 · 生月${rl.bMonth}）`);
			out.push(rl.palaceName ? `月限(${rl.age}岁)：${rl.palaceName}（${rl.palaceZi}）` : '月限：需年龄/生月');
		}else if(rl && rl.type === 'minor'){
			out.push('◆ 行运法实算 · 小限（生年支加命宫逆数）');
			out.push(rl.palaceName ? `小限(${rl.age}岁)：${rl.palaceName}（${rl.palaceZi}）` : '小限：需年龄');
		}
		return out.join('\n');
	}catch(e){
		return '';
	}
}

// 无头路径(挂载按记录复算)的显示偏好:以本机仓为底,fields(挂载齿轮 / 存档)有值者覆盖
export function guolaoSnapshotDisplayFromFields(fields){
	const f = fields || {};
	return {
		...getStoredGuolaoDisplay(),
		...(f.guolaoLifeMasterMode && f.guolaoLifeMasterMode.value ? { lifeMasterMode: f.guolaoLifeMasterMode.value } : {}),
		// 'gudu' = 钉死古度限度法(页面行运法的空档),不随全局显示偏好
		...(f.guolaoMinorLimitType && f.guolaoMinorLimitType.value !== undefined && f.guolaoMinorLimitType.value !== null && f.guolaoMinorLimitType.value !== '' ? { minorLimitType: f.guolaoMinorLimitType.value === 'gudu' ? '' : f.guolaoMinorLimitType.value } : {}),
		...(f.guolaoTongxianBase && f.guolaoTongxianBase.value ? { tongxianBase: f.guolaoTongxianBase.value } : {}),
		// 定童限同样 fields 优先(挂载齿轮/存档)→ 快照 [大限] 段起讫岁与页面一致。
		...(f.guolaoLimitChildBase && f.guolaoLimitChildBase.value ? { limitChildBase: Number(f.guolaoLimitChildBase.value) } : {}),
		// 大限年界同理(挂载齿轮 / 存档有合法值者覆盖)→ [大限] 段起讫年与页面一致
		...(f.guolaoLimitYearBoundary && GUOLAO_LIMIT_YEAR_BOUNDARIES.indexOf(f.guolaoLimitYearBoundary.value) >= 0 ? { limitYearBoundary: f.guolaoLimitYearBoundary.value } : {}),
	};
}

// displayPrefs(可选):页面实例传本页的显示偏好(this.state.guolaoDisplay,右栏与大限环画的就是它)——
// 命主取法 / 行运法 / 童限基数 / 定童限 / 大限年界都按它写,与页面同源(择日里内嵌的七政盘改这些项不写七政页记忆,
// 再回读本机仓就与页面不一致)。无头路径(挂载按记录复算)不传,照旧以本机仓为底、fields 有值者覆盖。
export function buildGuolaoSnapshotTextV2(params, result, planetDisplay, fields, moiraRules, displayPrefs){
	// 🔴 模块级 SNAPSHOT_PREFER_LON 只允许在本函数生命周期内为真:曾写脏后永不复位 →
	// 黄仪盘导过一次快照后,切回赤仪的 UI 渲染(objectLon 全部消费点)改吃黄经,
	// 盘面与后端不一致且仅在「导过快照」的会话出现。finally 恒复位根治。
	try{
		return _buildGuolaoSnapshotTextV2Core(params, result, planetDisplay, fields, moiraRules, displayPrefs);
	}finally{
		SNAPSHOT_PREFER_LON = false;
	}
}

function _buildGuolaoSnapshotTextV2Core(params, result, planetDisplay, fields, moiraRules, displayPrefs){
	const _snapChart = result && result.chart ? result.chart : result;
	SNAPSHOT_PREFER_LON = !!(_snapChart && _snapChart.displayCoord === 'ecliptic');
	const lines = [];
	const chart = result && result.chart ? result.chart : {};
	const rootZiGods = result && result.nongli && result.nongli.bazi && result.nongli.bazi.guolaoGods
		? result.nongli.bazi.guolaoGods.ziGods : null;
	const chartZiGods = chart && chart.nongli && chart.nongli.bazi && chart.nongli.bazi.guolaoGods
		? chart.nongli.bazi.guolaoGods.ziGods : null;
	const ziGods = chartZiGods || rootZiGods || null;

	lines.push('[起盘信息]');
	lines.push(`日期：${params.date} ${params.time}`);
	lines.push(`时区：${params.zone}`);
	lines.push(`经纬度：${params.lon} ${params.lat}`);
	lines.push(buildTimeBasisLine({ timeAlg: params.timeAlg, lateZiHourUseNextDay: params.lateZiHourUseNextDay, after23NewDay: params.after23NewDay, note: GUOLAO_TIME_BASIS_NOTE }));   // 两套时标说清
	lines.push(`七政命度：${guolaoLifeModeName(guolaoLifeModeFromFields(fields))}`);
	lines.push(`罗计：${guolaoNodeModeName(guolaoNodeModeFromFields(fields))}`);
	// G6/G10/G11 起盘设置注入快照(AI 据此解读报时星/四余取法)。
	const _gTs = guolaoFieldValue(fields, 'guolaoTrueSolarTime', getStoredGuolaoTrueSolarTime);
	const _gNt = guolaoFieldValue(fields, 'guolaoNodeType', getStoredGuolaoNodeType);
	const _gLt = guolaoFieldValue(fields, 'guolaoLilithType', getStoredGuolaoLilithType);
	const _gHm = params && params.planetaryHourMethod === 'unequal' ? '昼夜不等时' : (params && params.planetaryHourMethod === 'equal24' ? '廿四时等分' : '日出起算 · 等长时');
	lines.push(`报时星太阳时：${_gTs === 'off' ? '钟表时' : (_gTs === 'mean' ? '平太阳时(仅经度)' : '真太阳时(经度+均时差)')}（行星时制式：${_gHm}${_gHm === '日出起算 · 等长时' ? ',此制式下太阳时三档结果相同' : ''}）`);
	lines.push(`罗计取法：${_gNt === 'true' ? '真交点' : '平交点'}；月孛取法：${_gLt === 'true' ? '真远地点' : '平远地点'}`);
	// G20/G22/G31/G3 身宫法/命主取法/行运法/宿度制 注入快照。身宫法读 fields(类A);命主取法/行运法读全局显示偏好(类B)。
	const _gBody = guolaoFieldValue(fields, 'guolaoBodyMode', getStoredGuolaoBodyMode);
// 命主取法/行运法/童限基数:fields(挂载齿轮/存档)优先,缺省回退全局显示偏好 ——
	// 🔴 曾直读全局 JSON 罐:三值逐字进快照正文且改 [大限] 段结构,却在覆盖机制射程外。
	const _gDisp = (displayPrefs && typeof displayPrefs === 'object') ? { ...displayPrefs } : guolaoSnapshotDisplayFromFields(fields);
	const _su28Name = SU28_MODE_LABEL[guolaoSu28ModeFromFields(fields)] || SU28_MODE_LABEL[0];   // 单源 SU28_MODE_LABEL(不再另抄一套标签)
	const _lmName = { gong: '宫主', du: '度主', dudegrade: '贬宫主专度主' }[_gDisp.lifeMasterMode || 'gong'] || '宫主';
	const _mlName = { '': '古度限度法', dongwei: '洞微大限', minor: '小限', month: '月限', tong: '童限' }[_gDisp.minorLimitType || ''] || '古度限度法';
	const _gBodyName = _gBody === 'youjin' ? '逢酉(琴堂)' : ('子丑寅卯辰巳午未申酉戌亥'.indexOf(_gBody) >= 0 ? `自定身宫·${_gBody}` : '太阴落宫(果老)');
	lines.push(`宿度制：${_su28Name}；身宫法：${_gBodyName}`);
	lines.push(`命主取法：${_lmName}；行运法：${_mlName}`);
	// 命度实值 / 身度 / 命度宿主 / 身度宿主(右栏「命身与限度」卡同源)。
	const _info = buildGuolaoInfoFactsForSnapshot(params, result, fields, _gDisp, moiraRules);
	buildGuolaoAnchorLines(_info).forEach((l)=>lines.push(l));
	lines.push('');

	lines.push('[七政四余宫位与二十八宿星曜]');
	lines.push(buildHouseSuAndGodsSection(result, planetDisplay, fields) || '无');
	lines.push('');
	lines.push('[星曜庙旺与星点动态（殿垣庙旺乐喜怒 · 顺逆留伏迟速）]');
	lines.push(buildStarDignityMotionSection(result, fields) || '无');
	lines.push('');
	lines.push('[神煞]');
	lines.push(buildRulesGodsSection(moiraRules) || buildHouseGodsSection(result, fields) || '无');
	lines.push('');
	lines.push('[大限]');
	lines.push(buildGuolaoLimitSection(chart, fields, params, _gDisp.minorLimitType || '', _gDisp.tongxianBase || 'tong10',
		{ limitYearBoundary: _gDisp.limitYearBoundary, limitChildBase: _gDisp.limitChildBase }) || '无');
	lines.push('');
	// 三主化曜 / 难仇恩用 与 五限实算 / 行运法实算(右栏同源,有数据才产段)。
	const mastersSection = buildGuolaoMastersSection(_info);
	if(mastersSection){
		lines.push('[三主与化曜]');
		lines.push(mastersSection);
		lines.push('');
	}
	const limitCalcSection = buildGuolaoLimitCalcSection(_info);
	if(limitCalcSection){
		lines.push('[限法实算]');
		lines.push(limitCalcSection);
		lines.push('');
	}
	// 虚实段（v44 硬缺补挂，纯增）：有 weakSolid 规则数据才产段，缺数据时既有输出逐字不变。
	const weakSolidSection = buildGuolaoWeakSolidSection(moiraRules);
	if(weakSolidSection){
		lines.push('[虚实]');
		lines.push(weakSolidSection);
		lines.push('');
	}
	// 本命化曜段（v44 半缺补挂，纯增）：此前只导流年侧。
	const birthStarsSection = buildGuolaoBirthStarsSection(moiraRules);
	if(birthStarsSection){
		lines.push('[本命化曜]');
		lines.push(birthStarsSection);
		lines.push('');
	}
	// 流年流曜段（A 类硬缺补挂，纯增）：有流年规则数据才产段，缺数据时既有输出逐字不变。
	const transitStarsSection = buildGuolaoTransitStarsSection(fields, moiraRules);
	if(transitStarsSection){
		lines.push('[流年流曜]');
		lines.push(transitStarsSection);
		lines.push('');
	}
	lines.push('[政余格局]');
	lines.push(buildGuolaoPatternSection(result, fields, params) || '无');
	lines.push('');
	lines.push('[相位]');
	lines.push(buildGuolaoAspectSection(result) || '无');
	return lines.join('\n').trim();
}

// AI 快照·政余格局段（右栏「格局」面板已显示但此前未导出）：复用盘面同源 buildLocalMoiraPatterns
// （styleSource=moira-dsl-local-evaluated，本地已评估、非屏蔽态），喜/忌/察看分组与右栏一致；异常降级「无」，不影响既有段。
function buildGuolaoPatternSection(result, fields, params){
	try{
		const godRows = buildGodRowsFromChart(result, fields);
		const patterns = buildLocalMoiraPatterns(result, fields, params, godRows) || [];
		if(!patterns.length){
			return '无';
		}
		const fmt = (list)=>list.map((it)=>`${it.name}（${it.detail || it.dsl || ''}）`).join('；');
		const good = patterns.filter((it)=>it.level === 'good');
		const bad = patterns.filter((it)=>it.level === 'bad');
		const other = patterns.filter((it)=>it.level !== 'good' && it.level !== 'bad');
		const out = [];
		out.push(`喜格：${good.length ? fmt(good) : '（无）'}`);
		out.push(`忌格：${bad.length ? fmt(bad) : '（无）'}`);
		if(other.length){
			out.push(`察看：${fmt(other)}`);
		}
		return out.join('\n');
	}catch(e){
		return '无';
	}
}

// AI 快照·相位段（右栏「相位」面板已显示但此前未导出）：复用 buildAspectRows，与盘面的相位表同源；异常降级「无」。
export function buildGuolaoAspectSection(result){
	try{
		const chart = getChart(result);
		const aspects = (chart && chart.aspects) || (result && result.aspects) || null;
		const rows = buildAspectRows(aspects);
		if(!rows || !rows.length){
			return '无';
		}
		// GFM 表化(段内排版,值零变化):五元组(主体/相位/对象/状态/误差)与旧行一一对应,
		// 无误差值 cell='—'(旧行该情形整个省略「，误差X」)。元组集合证明见 guolaoSnapshotTables.test.js。
		const out = [];
		out.push('| 主体 | 相位 | 对象 | 状态 | 误差 |');
		out.push('| --- | --- | --- | --- | --- |');
		rows.forEach((row)=>{
			out.push(`| ${row.from} | ${row.aspect} | ${row.to} | ${row.state} | ${row.orb || '—'} |`);
		});
		return out.join('\n');
	}catch(e){
		return '无';
	}
}

// AI 快照·大限段：复用 Moira 命盘轮的命度→十二宫大限算法（moiraBuildLimitTable/lifeDegree），
// 保证导出/挂载与盘面「命身与限度·大限」列表完全同口径。出生年取自 params.date（YYYY/MM/DD）。
// limitOpts:{ limitYearBoundary, limitChildBase } 与右栏/大限环同源(缺省 元旦/9 → 段逐字同旧)。
export function buildGuolaoLimitSection(chart, fields, params, minorLimitType, tongxianBase, limitOpts){
	try{
		const lifeDeg = lifeDegree(chart, fields);
		const lo = limitOpts && typeof limitOpts === 'object' ? limitOpts : {};
		const limitBasis = moiraBirthYearBasis(chart, fields, lo.limitYearBoundary || 'gregorian');
		const limitChildBase = Number(lo.limitChildBase) === 10 ? 10 : 9;
		const birthYear = (Number(String(params.date || '').split('/')[0]) || 0) + limitBasis.yearShift;
		const rows = buildLimitTable(lifeDeg, birthYear, limitChildBase, limitBasis.frac);
		const out = [];
		if(rows && rows.length){
			// GFM 表化(段内排版,值零变化):cell 沿用旧行字面片段(第N限/a-b岁/a-b年/约N年),
			// fact-multiset 证明见 guolaoSnapshotTables.test.js。
			out.push('古度限度法（命度十二宫大限）：');
			out.push('| 限 | 宫 | 起讫岁 | 起讫年 | 年数 |');
			out.push('| --- | --- | --- | --- | --- |');
			rows.forEach((row)=>{
				out.push(`| 第${row.index}限 | ${row.palace || '—'} | ${row.fromAge}-${row.toAge}岁 | ${row.fromYear}-${row.toYear}年 | 约${row.years}年 |`);
			});
		}
		// WP-E：所选行运法(类B minorLimitType)结构同入快照——洞微大限含飞星吊度,童限顺排,小限/月限注明法。
		const mlt = String(minorLimitType || '');
		if(mlt === 'dongwei'){
			const sun = findChartObject(chart, AstroConst.SUN);
			if(sun && Number.isFinite(Number(sun.lon))){
				const dw = glDongwei(((Number(sun.lon) % 30) + 30) % 30);
				out.push('');
				out.push(`洞微大限（命宫顺行·飞星吊度·起限${dw.startAge}岁）：`);
				out.push('| 限 | 宫 | 起讫岁 | 年数 | 吊度 |');
				out.push('| --- | --- | --- | --- | --- |');
				dw.rows.forEach((r)=>{
					out.push(`| 第${r.index}限 | ${r.palace || '—'} | ${r.fromAge}-${r.toAge}岁 | ${r.years}年 | 入${r.entryDeg}°·每年吊度${r.perYearDeg}° |`);
				});
			}
		}else if(mlt === 'tong'){
			const sun = findChartObject(chart, AstroConst.SUN);
			if(sun && Number.isFinite(Number(sun.lon))){
				const tx = glTongxian(Number(sun.lon), tongxianBase || 'tong10');
				out.push('');
				out.push(`童限：命财疾妻福顺排（${tx.palaces.join('→')}），出童限约${tx.exitAge}岁。`);
			}
		}else if(mlt === 'minor'){
			out.push('');
			out.push('小限：生年支加命宫逆数（age1=命宫宫支，逐年逆行一宫，12年一轮）。');
		}else if(mlt === 'month'){
			out.push('');
			out.push('月限：由当年小限宫起生月、按月逆寻（节气月口径）。');
		}
		return out.join('\n');
	}catch(e){
		return '';
	}
}
