// 节气表取数与缓存:二十四节气种子表、四柱、逐节气起盘请求与合并
// 从 JieQiChartsMain.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { registerProcessCache } from '../../../utils/processCacheRegistry';
import { dateKeyOfStr, toSlashDate } from '../../../utils/dateStrSafe';
import { setJieqiSeedLocalCache } from '../../../utils/localCalcCache';
import { userAyanParamsFrom } from '../../../utils/customCalibreStores';
import { classicalBackendOverridesFromPlain, chartOrbOverridesFromPlain } from '../../../utils/classicalChartGlobals';
import request from '../../../utils/request';
import * as Constants from '../../../utils/constants';
import { silentTechniquePanelsEnabled } from '../../../utils/perfFlags';
import { classicalCalibreSig } from './fields';

const jieqiChartMem = {};

registerProcessCache('jieqi.charts', ()=>{ Object.keys(jieqiChartMem).forEach((k)=>{ delete jieqiChartMem[k]; }); });   // 同参复用上次结果:登记清空函数(只供审计仪器取样前清空)

export function getSeedCacheKey(params){
	return [
		params && params.year,
		params && params.ad,
		params && params.zone,
		params && params.lon,
		params && params.lat,
		params && params.gpsLon,
		params && params.gpsLat,
	].join('|');
}

function getChartCacheKey(params, term, birth){
	return [
		getSeedCacheKey(params),
		term,
		birth,
		params && params.hsys,
		params && params.zodiacal,
		params && params.siderealAyanamsa,
		params && params.doubingSu28,
		params && params.termsVariant,
		params && params.triplicity,
		params && params.lotReversal,
		params && params.westNodeType,
		params && params.sectBuffer,
		params && params.leoBoundFirst,
		classicalCalibreSig(params),   // 十余个古典键进请求体却不进缓存键 → 改设置不重取;现 spec 全键签名
		params && params.after23NewDay,          // 日界 / 晚子时进缓存键(否则改全局后仍拿旧盘)
		params && params.lateZiHourUseNextDay,
	].join('|');
}

function splitBirthToDateTime(birth){
	const txt = `${birth || ''}`.trim();
	const parts = txt.split(' ');
	const date = parts[0] || '';
	const time = parts[1] || '00:00:00';
	return { date, time };
}

function normalizeGanZi(txt){
	const raw = `${txt || ''}`.trim();
	return raw.length >= 2 ? raw.slice(0, 2) : raw;
}

function toSimpleFourColumns(nongli){
	if(!nongli){
		return null;
	}
	return {
		year: {
			ganzi: normalizeGanZi(nongli.yearGanZi || nongli.yearJieqi || nongli.year),
			naying: '',
		},
		month: {
			ganzi: normalizeGanZi(nongli.monthGanZi),
			naying: '',
		},
		day: {
			ganzi: normalizeGanZi(nongli.dayGanZi),
			naying: '',
		},
		time: {
			ganzi: normalizeGanZi(nongli.time || nongli.timeGanZi),
			naying: '',
		},
	};
}

export function getJieqiFourColumns(item){
	if(!item){
		return null;
	}
	if(item.bazi && item.bazi.fourColumns){
		return item.bazi.fourColumns;
	}
	if(item.fourColumns){
		return item.fourColumns;
	}
	if(item.bazi){
		const fromBazi = toSimpleFourColumns(item.bazi);
		if(fromBazi){
			return fromBazi;
		}
	}
	if(item.nongli){
		return toSimpleFourColumns(item.nongli);
	}
	return null;
}

function normalizeFourColumnPart(part){
	const src = part || {};
	return {
		ganzi: src.ganzi ? `${src.ganzi}` : '',
		naying: src.naying ? `${src.naying}` : '',
	};
}

function compactFourColumns(fourCols){
	if(!fourCols){
		return null;
	}
	return {
		year: normalizeFourColumnPart(fourCols.year),
		month: normalizeFourColumnPart(fourCols.month),
		day: normalizeFourColumnPart(fourCols.day),
		time: normalizeFourColumnPart(fourCols.time),
	};
}

export function compactJieqiSeedResult(result){
	if(!result || !Array.isArray(result.jieqi24)){
		return result;
	}
	const jieqi24 = result.jieqi24.map((item)=>{
		const fourCols = compactFourColumns(getJieqiFourColumns(item));
		return {
			ord: item && item.ord !== undefined ? item.ord : null,
			jieqi: item && item.jieqi ? `${item.jieqi}` : '',
			jie: item && item.jie !== undefined ? item.jie : null,
			time: item && item.time ? `${item.time}` : '',
			ad: item && item.ad !== undefined ? item.ad : null,
			bazi: fourCols ? { fourColumns: fourCols } : null,
		};
	});
	return {
		...result,
		jieqi24,
		charts: {},
	};
}

export function mergeJieqiRows(baseRows, patchRows){
	const base = Array.isArray(baseRows) ? baseRows : [];
	const patch = Array.isArray(patchRows) ? patchRows : [];
	if(!base.length){
		return patch;
	}
	if(!patch.length){
		return base;
	}
	const patchMap = {};
	patch.forEach((row)=>{
		const key = row && row.jieqi ? `${row.jieqi}` : '';
		if(!key){
			return;
		}
		patchMap[key] = row;
	});
	return base.map((row)=>{
		const key = row && row.jieqi ? `${row.jieqi}` : '';
		const next = key ? patchMap[key] : null;
		if(!next){
			return row;
		}
		return {
			...row,
			ord: next.ord !== undefined ? next.ord : row.ord,
			jie: next.jie !== undefined ? next.jie : row.jie,
			time: next.time || row.time,
			ad: next.ad !== undefined ? next.ad : row.ad,
			bazi: next.bazi || row.bazi || null,
		};
	});
}

export function cacheJieqiSeedRows(params, rows){
	if(!params || !Array.isArray(rows) || !rows.length){
		return;
	}
	const seed = {};
	rows.forEach((entry)=>{
		const term = entry && entry.jieqi ? `${entry.jieqi}` : '';
		const time = entry && entry.time ? `${entry.time}` : '';
		const fourCols = getJieqiFourColumns(entry);
		if(term && time){
			seed[term] = {
				term,
				time,
				dateKey: dateKeyOfStr(time.split(' ')[0]),
				dayGanzhi: fourCols && fourCols.day ? `${fourCols.day.ganzi || ''}` : '',
			};
		}
	});
	if(Object.keys(seed).length){
		setJieqiSeedLocalCache(params, seed);
	}
}

export function findJieqiRow(rows, title){
	if(!Array.isArray(rows) || !title){
		return null;
	}
	for(let i = 0; i < rows.length; i += 1){
		const row = rows[i];
		if(row && row.jieqi === title){
			return row;
		}
	}
	return null;
}

function buildChartRequestParams(params, birth){
	const dt = splitBirthToDateTime(birth);
	return {
		cid: null,
		ad: params.ad,
		date: toSlashDate(dt.date),
		time: dt.time,
		zone: params.zone,
		lat: params.lat,
		lon: params.lon,
		gpsLat: params.gpsLat,
		gpsLon: params.gpsLon,
		hsys: params.hsys,
		southchart: false,
		zodiacal: params.zodiacal,
		siderealAyanamsa: params.siderealAyanamsa,
		tradition: 0,
		doubingSu28: params.doubingSu28,
		strongRecption: 0,
		simpleAsp: 0,
		virtualPointReceiveAsp: 0,
		predictive: 0,
		pdaspects: [0, 60, 90, 120, 180],
		name: null,
		pos: null,
		group: null,
		// 自定义恒星黄道 'user' 档随行历元参数(params 有值优先,缺读当前槽;与主盘 fieldsToParams 同口径),
		// 此前不带 → 后端回落默认岁差而标签仍写自定义。
		...((`${params.siderealAyanamsa}` === 'user') ? userAyanParamsFrom((k)=>params[k]) : {}),
		// 古典占星参数条件透传(默认不下发=请求体零回归,与 fieldsToParams 同条件)
		...((params.termsVariant) ? { termsVariant: params.termsVariant } : {}),
		...((params.geminiBoundEmended) ? { geminiBoundEmended: 1 } : {}),
		// 2026-07 二批九键:共享 helper(平面版)条件透传。
		...classicalBackendOverridesFromPlain(params),
		...chartOrbOverridesFromPlain(params),
		...((params.triplicity && params.triplicity !== 'Dorothean') ? { triplicity: params.triplicity } : {}),
		...((params.lotReversal === 0 || params.lotReversal === '0') ? { lotReversal: 0 } : {}),
		...((params.westNodeType === 'true') ? { westNodeType: 'true' } : {}),
		...((params.sectBuffer === 'ptolemy5') ? { sectBuffer: 'ptolemy5' } : {}),
		...((params.leoBoundFirst === 1 || params.leoBoundFirst === '1') ? { leoBoundFirst: 1 } : {}),
		// 日界 / 晚子时两键随四分至盘透传(Java 缺省 1/1;仅非缺省才发=缺省用户请求体零回归):
		// 此前不发 → 宿盘中心「农历 / 四柱」恒按 23 点换日、晚子时次日干,不随全局设置。
		...((params.after23NewDay !== undefined && params.after23NewDay !== null && Number(params.after23NewDay) !== 1) ? { after23NewDay: Number(params.after23NewDay) } : {}),
		...((params.lateZiHourUseNextDay !== undefined && params.lateZiHourUseNextDay !== null && Number(params.lateZiHourUseNextDay) !== 1) ? { lateZiHourUseNextDay: Number(params.lateZiHourUseNextDay) } : {}),
	};
}

export async function loadJieqiChart(params, term, birth){
	const key = getChartCacheKey(params, term, birth);
	const cached = jieqiChartMem[key];
	if(cached && cached.chart){
		return cached.chart;
	}
	const dt = splitBirthToDateTime(birth);
	const reqParams = buildChartRequestParams(params, birth);
	// WP-C 极速化:silent=不触发全局满屏 Spin 压暗(角标由调用方 requestJieQiCharts 统一管理)
	const data = await request(`${Constants.ServerRoot}/chart`, {
		body: JSON.stringify(reqParams),
		silent: silentTechniquePanelsEnabled(),
	});
	const chartObj = data && data[Constants.ResultKey] ? data[Constants.ResultKey] : null;
	if(!chartObj){
		return null;
	}
	if(!chartObj.params){
		chartObj.params = {};
	}
	chartObj.params = {
		...chartObj.params,
		...reqParams,
		birth: `${dt.date} ${dt.time}`,
		year: params.year,
	};
	jieqiChartMem[key] = {
		...(jieqiChartMem[key] || {}),
		chart: chartObj,
	};
	return chartObj;
}

function normalizeJieqiCompareValue(value){
	if(value === undefined || value === null || value === ''){
		return null;
	}
	return `${value}`;
}

// 合并新盘时按种子参数清理其它节气的陈旧盘(isJieQiChartCompatible 只比种子级键、不比日期,可跨节气判)。
export function mergeJieQiCharts(prevCharts, title, chartObj, reqParams){
	const prev = prevCharts && typeof prevCharts === 'object' ? prevCharts : {};
	const out = {};
	Object.keys(prev).forEach((t)=>{
		if(t === title){ return; }
		if(isJieQiChartCompatible(prev[t], reqParams)){ out[t] = prev[t]; }
	});
	out[title] = chartObj;
	return out;
}

export function isJieQiChartCompatible(chartObj, params){
	const chartParams = chartObj && chartObj.params ? chartObj.params : {};
	const reqParams = params || {};
	return [
		'year',
		'ad',
		'zone',
		'lat',
		'lon',
		'gpsLat',
		'gpsLon',
		'hsys',
		'zodiacal',
		// 🔴 曾漏 siderealAyanamsa:换岁差时 zodiacal 恒 1、其余键全等 → 判「兼容」直接返旧盘,
		// 请求根本不发(同文件 getChartCacheKey 已含该键,两套键漂移)。古典键同理。
		'siderealAyanamsa',
		'doubingSu28',
		'termsVariant',
		'triplicity',
		'lotReversal',
		'westNodeType',
		'sectBuffer',
		'leoBoundFirst',
		'after23NewDay',            // 日界 / 晚子时(reqParams 已并入 chartObj.params,可比;缺省两侧皆缺=兼容)
		'lateZiHourUseNextDay',
	].every((key)=>normalizeJieqiCompareValue(chartParams[key]) === normalizeJieqiCompareValue(reqParams[key]))
		// 其余古典键(spec 全键,后端名)与 'user' 历元同判:任一改动即视为不兼容重取。
		&& classicalCalibreSig(chartParams) === classicalCalibreSig(reqParams);
}
