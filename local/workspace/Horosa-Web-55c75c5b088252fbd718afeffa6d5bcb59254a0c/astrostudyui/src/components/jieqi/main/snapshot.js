// 节气页 AI 快照:节气宿盘段 / 星盘光度段 / 当前页签与按记录无头重算
// 从 JieQiChartsMain.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import * as AstroText from '../../../constants/AstroText';
import * as AstroConst from '../../../constants/AstroConst';
import * as SZConst from '../../suzhan/SZConst';
import { suzhanAscRaModeOf } from '../../suzhan/SuZhanMain';
import { withAscRaModeRoot, ascRaModeSnapshotLine } from '../../../utils/ascRaMode';
import * as Su28Helper from '../../su28/Su28Helper';
import { appendPlanetHouseInfo, appendPlanetHouseInfoById } from '../../../utils/planetHouseInfo';
import { buildAstroSnapshotContent } from '../../../utils/astroAiSnapshot';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../../utils/dayBoundary';
import { fetchPreciseJieqiYear } from '../../../utils/preciseCalcBridge';
import { getJieqiFourColumns, compactJieqiSeedResult, findJieqiRow, loadJieqiChart } from './charts';
import { paramsToFields } from './fields';

const AI_EXPORT_PLANET_INFO = {
	showHouse: 1,
	showRuler: 1,
};

function isEncodedToken(text){
	return /^[A-Za-z0-9${}]$/.test((text || '').trim());
}

function msg(id){
	if(id === undefined || id === null){
		return '';
	}
	if(AstroText.AstroTxtMsg[id]){
		return AstroText.AstroTxtMsg[id];
	}
	if(AstroText.AstroMsg[id]){
		const val = AstroText.AstroMsg[id];
		if(isEncodedToken(val)){
			return `${id}`;
		}
		return `${val}`;
	}
	return `${id}`;
}

function splitDegree(degree){
	let d = Number(degree);
	if(Number.isNaN(d)){
		return [0, 0];
	}
	if(d < 0){
		d += 360;
	}
	const deg = Math.floor(d % 30);
	const min = Math.floor(((d % 30) - deg) * 60);
	return [deg, min];
}

function signFromLon(lon){
	if(lon === undefined || lon === null || Number.isNaN(Number(lon))){
		return null;
	}
	let val = Number(lon) % 360;
	if(val < 0){
		val += 360;
	}
	const idx = Math.floor(val / 30) % 12;
	return AstroConst.LIST_SIGNS[idx];
}

function resolveHouseStartMode(fields){
	if(fields && fields.houseStartMode && fields.houseStartMode.value !== undefined && fields.houseStartMode.value !== null){
		return parseInt(fields.houseStartMode.value, 10) === SZConst.SZHouseStart_ASC
			? SZConst.SZHouseStart_ASC : SZConst.SZHouseStart_Bazi;
	}
	return SZConst.SZHouseStart_Bazi;
}

function computeAscSignIndex(rootObj, chart, fields){
	const objects = chart && chart.objects ? chart.objects : [];
	const asc = objects.find((obj)=>obj.id === AstroConst.ASC);
	const sun = objects.find((obj)=>obj.id === AstroConst.SUN);
	if(!asc){
		return -1;
	}
	const ascIdx = Math.floor(Number(asc.ra) / 30);
	if(resolveHouseStartMode(fields) === SZConst.SZHouseStart_ASC){
		return ascIdx;
	}
	const bazi = (chart && chart.nongli && chart.nongli.bazi)
		|| (rootObj && rootObj.nongli && rootObj.nongli.bazi);
	if(!bazi || !sun){
		return ascIdx;
	}
	const timezi = bazi.time && bazi.time.branch ? bazi.time.branch.cell : null;
	const timesig = timezi ? SZConst.ZiSign[timezi] : null;
	const tmsigidx = timesig ? AstroConst.LIST_SIGNS.indexOf(timesig) : -1;
	if(tmsigidx < 0){
		return ascIdx;
	}
	const sunidx = Math.floor(Number(sun.ra) / 30);
	return (sunidx - tmsigidx - 5 + 24) % 12;
}

function houseFullLabel(house, idx, ascSignIndex){
	let houseName = msg(house && house.id ? house.id : null) || `第${idx + 1}宫`;
	const sign = signFromLon(house ? house.lon : null);
	if(!sign){
		return houseName;
	}
	const signIdx = AstroConst.LIST_SIGNS.indexOf(sign);
	if(signIdx >= 0 && ascSignIndex >= 0){
		const hnum = (signIdx - ascSignIndex + 12) % 12 + 1;
		houseName = `第${hnum}宫`;
	}
	const zi = SZConst.SignZi[sign] || '';
	const area = (SZConst.SZSigns[signIdx] && SZConst.SZSigns[signIdx].length >= 2)
		? `${SZConst.SZSigns[signIdx][0]}${SZConst.SZSigns[signIdx][1]}`
		: '';
	const signName = AstroText.AstroMsgCN[sign] || msg(sign);
	return `${zi}—${area}—${signName}座—${houseName}`;
}

function buildJieQiSuSection(rawChartObj, fields, planetDisplay){
	// 内嵌宿盘的上升取法跟随宿占页设置(只在 ASC 起盘时起作用):与页签里画出来的宿盘同一份盘数据
	const ascRaMode = suzhanAscRaModeOf(fields);
	const chartObj = withAscRaModeRoot(rawChartObj, ascRaMode);
	const chart = chartObj && chartObj.chart ? chartObj.chart : {};
	const houses = chart.houses || [];
	const objects = chart.objects || [];
	const lines = [];
	if(resolveHouseStartMode(fields) === SZConst.SZHouseStart_ASC && houses.length){
		lines.push(ascRaModeSnapshotLine(ascRaMode, chart));
	}
	const ascSignIndex = computeAscSignIndex(chartObj, chart, fields);
	let visibleSet = null;
	if(planetDisplay && planetDisplay.length){
		visibleSet = new Set(planetDisplay);
	}
	houses.forEach((house, idx)=>{
		lines.push(`宫位：${houseFullLabel(house, idx, ascSignIndex)}`);
		const inHouse = objects.filter((obj)=>{
			if(obj.house !== house.id){
				return false;
			}
			if(visibleSet){
				return visibleSet.has(obj.id);
			}
			return AstroConst.isTraditionPlanet(obj.id);
		})
			.sort((a, b)=>{
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
			lines.push('二十八宿：无');
			lines.push('星曜：无');
			lines.push('');
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
			lines.push(`二十八宿：${su}`);
			list.forEach((obj)=>{
				let radeg = Number(obj.ra);
				const suRef = (chart.fixedStarSu28 || []).find((it)=>it.name === su);
				if(!Number.isNaN(radeg) && suRef && suRef.ra !== undefined && suRef.ra !== null){
					radeg = Number(obj.ra) - Number(suRef.ra);
					if(radeg < 0){
						radeg += 360;
					}
				}else{
					radeg = Number(obj.signlon);
				}
				const sd = splitDegree(radeg);
				lines.push(`星曜：${appendPlanetHouseInfo(msg(obj.id), obj, AI_EXPORT_PLANET_INFO)} ${sd[0]}˚${su}${sd[1]}分`);
			});
		});
		lines.push('');
	});
	return lines.join('\n').trim();
}

// ⚠️ withHeaders=true 分支为死分支(仓内唯一调用传 false;同类自检 v42 定性):其段头
// (起盘信息/宫位宫头/行星与点)未登 jieqi preset——若启用必须先登记(全树段头哨兵会咬)。
function buildJieQiAstroLightSection(chartObj, fields, withHeaders=true){
	const chart = chartObj && chartObj.chart ? chartObj.chart : {};
	const params = chartObj && chartObj.params ? chartObj.params : {};
	const houses = chart.houses || [];
	const objects = chart.objects || [];
	const lines = [];

	if(withHeaders){
		lines.push('[起盘信息]');
	}
	const lon = fields && fields.lon ? fields.lon.value : params.lon;
	const lat = fields && fields.lat ? fields.lat.value : params.lat;
	if(lon || lat){
		lines.push(`经纬度：${lon || ''} ${lat || ''}`);
	}
	if(params.birth){
		lines.push(`时间：${params.birth}`);
	}
	if(params.zone !== undefined && params.zone !== null){
		lines.push(`时区：${params.zone}`);
	}
	if(chart.zodiacal){
		lines.push(`黄道：${msg(chart.zodiacal)}`);
	}
	if(chart.hsys){
		lines.push(`宫制：${msg(chart.hsys)}`);
	}

	if(withHeaders){
		lines.push('');
		lines.push('[宫位宫头]');
	}else{
		lines.push('');
		lines.push('宫位宫头：');
	}
	houses.forEach((house, idx)=>{
		if(house && house.lon !== undefined && house.lon !== null){
			const deg = splitDegree(house.lon);
			const sign = Math.floor(((house.lon % 360) + 360) % 360 / 30);
			const signs = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
			lines.push(`${msg(house.id) || `第${idx + 1}宫`}：${Math.abs(deg[0] % 30)}˚${signs[sign]}${Math.abs(deg[1])}分`);
		}
	});

	lines.push('');
	if(withHeaders){
		lines.push('[行星与点]');
	}else{
		lines.push('行星与点：');
	}
	objects.forEach((obj)=>{
		const sd = splitDegree(obj.signlon);
		lines.push(`${appendPlanetHouseInfoById(msg(obj.id), chartObj, obj.id, AI_EXPORT_PLANET_INFO)}：${sd[0]}˚${msg(obj.sign)}${sd[1]}分；宫位=${msg(obj.house)}`);
	});
	return lines.join('\n').trim();
}

export function buildJieQiSnapshotText(result, baseFields, jieqis, planetDisplay){   // 具名导出供单测
	const lines = [];
	const charts = result && result.charts ? result.charts : {};
	lines.push('[节气盘参数]');
	if(baseFields && baseFields.date && baseFields.date.value){
		lines.push(`年份：${baseFields.date.value.format('YYYY')}`);
	}
	if(baseFields && baseFields.zone){
		lines.push(`时区：${baseFields.zone.value}`);
	}
	if(baseFields && baseFields.lon && baseFields.lat){
		lines.push(`经纬度：${baseFields.lon.value} ${baseFields.lat.value}`);
	}
	lines.push('说明：以下包含二分二至（春分、夏至、秋分、冬至）的星盘与宿盘专用导出。');
	// 整年快照补 [二十四节气] 段(交节时刻 + 四柱,与页面「二十四节气」页签同源):此前停在默认页签导出只有参数头。
	const rows24 = result && Array.isArray(result.jieqi24) ? result.jieqi24 : [];
	if(rows24.length){
		lines.push('');
		lines.push('[二十四节气]');
		lines.push('| 节气 | 交节时刻 | 年柱 | 月柱 | 日柱 | 时柱 |');
		lines.push('| --- | --- | --- | --- | --- | --- |');
		rows24.forEach((item)=>{
			const fc = getJieqiFourColumns(item) || {};
			const gz = (c)=>(c && c.ganzi ? c.ganzi : '');
			lines.push(`| ${item && item.jieqi ? item.jieqi : ''} | ${item && item.time ? item.time : ''} | ${gz(fc.year)} | ${gz(fc.month)} | ${gz(fc.day)} | ${gz(fc.time)} |`);
		});
	}
	// 四盘未拉取(未点开对应页签)时明示未纳入,而不是静默只剩参数头。
	const missing = (jieqis || []).filter((t)=>!charts[t]);
	if(missing.length){
		lines.push('');
		lines.push(`说明：${missing.join('、')}的星盘 / 宿盘尚未拉取（打开对应页签后再导出即纳入）。`);
	}

	(jieqis || []).forEach((title)=>{
		const one = charts[title];
		if(!one){
			return;
		}
		let flds = baseFields;
		if(one.params){
			flds = paramsToFields(one.params, baseFields);
		}
		lines.push('');
		lines.push(`[${title}星盘]`);
		// 整年快照的星盘段此前用轻量版(起盘信息/宫头/行星三块),而「当前页签」快照同名段走
		// buildAstroSnapshotContent 全口径(相位/希腊点/12 分度/主宰星链/古典…)→ 同名段两种口径。统一为全口径。
		lines.push(buildAstroSnapshotContent(one, flds, { headerless: true }) || buildJieQiAstroLightSection(one, flds, false) || '无数据');
		lines.push('');
		lines.push(`[${title}宿盘]`);
		lines.push(buildJieQiSuSection(one, flds, planetDisplay) || '无数据');
		// 整年快照此前恒无 3D 段(页有 3D 盘页签,preset 也登记了 3D 段却从不产出);
		// 3D 盘与该节气星盘同一盘数据(仅三维视图),故以指引段出现,不整盘重复。
		lines.push('');
		lines.push(`[${title}3D盘]`);
		lines.push(`3D 盘为「${title}星盘」同一节气盘的三维视图(星位/宫位/相位同上 [${title}星盘] 段,无独立数据)。`);
	});
	return lines.join('\n').trim();
}

export function parseJieQiTab(currentTab, jieqis){
	if(!currentTab){
		return null;
	}
	if((jieqis || []).indexOf(currentTab) >= 0){
		return { title: currentTab, type: 'astro' };
	}
	for(let i=0; i<(jieqis || []).length; i++){
		const title = jieqis[i];
		if(currentTab === `宿盘${title}`){
			return { title, type: 'suzhan' };
		}
		if(currentTab === `3D盘${title}`){
			return { title, type: 'astro3d' };
		}
	}
	return null;
}

// 无头:按记录(起课时间 / 出生资料)的年份与地点起整年分至盘 —— 与页面同一份取数(fetchPreciseJieqiYear + loadJieqiChart)
// 与同一个正文构建函数。年份 = 记录时刻那一年;宫制 / 黄道 / 宿度制取记录上的(没有 = 缺省)。四张盘都取齐才出正文的对应段。
export async function buildJieQiSnapshotForRecordFields(fields){
	if(!fields || !fields.date || !fields.date.value){ return ''; }
	const fv = (k, d)=>(fields[k] && fields[k].value !== undefined && fields[k].value !== null ? fields[k].value : d);
	const jieqis = ['春分', '夏至', '秋分', '冬至'];
	const params = {
		year: fields.date.value.format('YYYY'), ad: fv('ad', 1), zone: fv('zone', '+08:00'), lon: fv('lon', '116e23'), lat: fv('lat', '39n54'),
		hsys: fv('hsys', 0), zodiacal: fv('zodiacal', 0), siderealAyanamsa: fv('siderealAyanamsa', ''), gpsLat: fv('gpsLat', 0), gpsLon: fv('gpsLon', 0),
		doubingSu28: fv('doubingSu28', 0), after23NewDay: defaultAfter23NewDay(), lateZiHourUseNextDay: defaultLateZiHourUseNextDay(),
	};
	const full = await fetchPreciseJieqiYear(params);
	const compact = compactJieqiSeedResult(full);
	const rows = compact && Array.isArray(compact.jieqi24) ? compact.jieqi24 : [];
	if(!rows.length){ return ''; }
	const charts = {};
	for(const title of jieqis){
		const row = findJieqiRow(rows, title);
		if(!row || !row.time){ continue; }
		try{
			// eslint-disable-next-line no-await-in-loop
			const one = await loadJieqiChart(params, title, row.time);
			if(one){ charts[title] = one; }
		}catch(e){ /* 取不到的那张在正文里明示未纳入 */ }
	}
	return buildJieQiSnapshotText({ jieqi24: rows, charts }, paramsToFields(params, fields), jieqis, undefined) || '';
}

export function buildJieQiCurrentSnapshotText(currentTab, result, baseFields, jieqis, planetDisplay){   // 具名导出供单测
	const info = parseJieQiTab(currentTab, jieqis);
	if(!info){
		return '';
	}
	const charts = result && result.charts ? result.charts : {};
	const one = charts[info.title];
	if(!one){
		return '';
	}
	let flds = baseFields;
	if(one.params){
		flds = paramsToFields(one.params, baseFields);
	}
	const lines = [];
	if(info.type === 'suzhan'){
		lines.push(`[${info.title}宿盘]`);
		lines.push(buildJieQiSuSection(one, flds, planetDisplay) || '无数据');
	}else{
		const panelName = info.type === 'astro3d' ? `${info.title}3D盘` : `${info.title}星盘`;
		lines.push(`[${panelName}]`);
		lines.push(buildAstroSnapshotContent(one, flds, { headerless: true }) || '无数据');
	}
	return lines.join('\n').trim();
}

export function tabNeedsJieqiCharts(currentTab, jieqis){
	return parseJieQiTab(currentTab, jieqis) !== null;
}

// 节气盘快照 meta(平时写槽与刷新应答同一份):起盘参数里的年份 / 时区 / 经纬 / 宫制 / 黄道;当前盘槽另带页签
export function jieqiSnapshotMeta(params, currentTab){
	const p = params || {};
	return {
		year: p.year,
		zone: p.zone,
		lon: p.lon,
		lat: p.lat,
		hsys: p.hsys,
		zodiacal: p.zodiacal, siderealAyanamsa: p.siderealAyanamsa,
		...(currentTab !== undefined ? { currentTab } : {}),
	};
}
