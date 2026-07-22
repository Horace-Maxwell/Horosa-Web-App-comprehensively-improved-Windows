import { Component } from 'react';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { safeJsonParseFromStorage } from '../../utils/safeStorage';
import { stepPrefetchEnabled } from '../../utils/perfFlags';
import { registerStepPrefetcher } from '../../utils/stepPrefetch';
import { Row, Col, } from 'antd';
import { XQTabs as Tabs } from '../xq-ui';
import DateTime from '../comp/DateTime';
import AstroPrimaryDirection from '../astro/AstroPrimaryDirection';
import AstroPrimaryDirectionChart from '../astro/AstroPrimaryDirectionChart';
import AstroPDSphere from '../astro3d/AstroPDSphere';
import AstroZR from '../astro/AstroZR';
import AstroFirdaria from '../astro/AstroFirdaria';
import AstroDistributions from '../astro/AstroDistributions';
import AstroAgePoint from '../astro/AstroAgePoint';
import AstroSolarReturn from '../astro/AstroSolarReturn';
import AstroLunarReturn from '../astro/AstroLunarReturn';
import AstroGivenYear from '../astro/AstroGivenYear';
import AstroSolarArc from '../astro/AstroSolarArc';
import AstroProfection from '../astro/AstroProfection';
import AstroDecennials from '../astro/AstroDecennials';
import AstroPlanetaryAges from '../astro/AstroPlanetaryAges';
import AstroVedicProgressions from '../astro/AstroVedicProgressions';
import AstroBalbillus from '../astro/AstroBalbillus';
import AstroTriplicityRulers from '../astro/AstroTriplicityRulers';
import AstroKeypoints from '../astro/AstroKeypoints';
import AstroLunationPhase from '../astro/AstroLunationPhase';
import AstroExtraReturns from '../astro/AstroExtraReturns';
import { getFirdariaInterp } from '../../utils/firdariaInterp';
import AstroYearSystem129 from '../astro/AstroYearSystem129';
import AstroPlanetaryArc from '../astro/AstroPlanetaryArc';
import AstroPersianDirected from '../astro/AstroPersianDirected';
import AstroJaynesProgressions from '../astro/AstroJaynesProgressions';
import AstroEphemeris from '../astro/AstroEphemeris';
import AstroProgressions from '../astro/AstroProgressions';
import AstroReturnTimeline from '../astro/AstroReturnTimeline';
import AstroPrenatalSyzygy from '../astro/AstroPrenatalSyzygy';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import * as AstroHelper from '../astro/AstroHelper';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { saveModuleAISnapshot, } from '../../utils/moduleAiSnapshot';
import { buildCurrentMomentLines, buildMethodNoteLines, } from '../../utils/astroAiSnapshot';
import { appendPlanetHouseInfoById, } from '../../utils/planetHouseInfo';

// [YB v42] 补厚 helper 容错:个别测试套件整模块 mock astroAiSnapshot 且只保留部分导出(如 aiAnalysisContext.test),
// 缺失导出经 import 拿到 undefined → 直接调用会炸掉整个 builder;生产环境恒为函数,此守卫零行为差。
const safeHelperLines = (fn, ...args)=>(typeof fn === 'function' ? fn(...args) : []);
import {
	PD_SYNC_REV,
	DEFAULT_PD_METHOD,
	DEFAULT_PD_TIME_KEY,
	DEFAULT_PD_TYPE,
	mergePrimaryDirectionChartObj,
	normalizePrimaryDirectionSubTabKey,
	getPdMethodLabel,
	getPdTimeKeyLabel,
} from '../../utils/primaryDirectionSync';
import FreezeInactive from '../comp/FreezeInactive';

const TabPane = Tabs.TabPane;
const AI_EXPORT_PLANET_INFO = {
	showHouse: 1,
	showRuler: 1,
};
const CORE_PD_SUPPORTED_BASE_IDS = new Set([
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

function msg(id){
	if(id === undefined || id === null){
		return '';
	}
	if(AstroText.AstroTxtMsg[id]){
		return AstroText.AstroTxtMsg[id];
	}
	if(AstroText.AstroMsg[id]){
		return `${AstroText.AstroMsg[id]}`;
	}
	return `${id}`;
}

function msgWithHouse(chartObj, id){
	return appendPlanetHouseInfoById(
		msg(id),
		chartObj,
		id,
		AI_EXPORT_PLANET_INFO
	);
}

function degreeText(value, pdMethod){
	if(pdMethod === 'horosa_legacy'){
		const deg = AstroHelper.splitDegree(value);
		return `${deg[0]}度${deg[1]}分`;
	}
	const num = Number(value);
	if(Number.isNaN(num)){
		return `${value || ''}`.trim();
	}
	const neg = num < 0 ? '-' : '';
	const abs = Math.abs(num);
	const d = Math.floor(abs);
	let m = Math.floor((abs - d) * 60);
	if(m >= 60){
		m = 0;
	}
	return `${neg}${d}度${m}分`;
}

// 方位法 / 时间换算的显示名统一走 primaryDirectionSync 的权威 label 字典(核方位法 + 22 时间换算)，
// 供 AI 导出 / AI 挂载快照复用。此前这里只识别 horosa_legacy、其余一律回退 'Alchabitius'，
// 会把 Meridian/Porphyry 等核方位法误标为 Alchabitius——已并入共享字典消除分叉。
function primaryDirectionMethodText(val){
	return getPdMethodLabel(val);
}

function primaryDirectionTimeKeyText(val){
	return getPdTimeKeyLabel(val);
}

function directionObjText(text, chartObj){
	if(!text){
		return '';
	}
	const parts = `${text}`.split('_');
	if(parts.length < 2){
		return `${text}`;
	}
	if(parts[0] === 'T'){
		return `${msgWithHouse(chartObj, parts[2])}的${msgWithHouse(chartObj, parts[1])}界`;
	}
	if(parts[0] === 'A'){
		return `${msgWithHouse(chartObj, parts[1])}的映点`;
	}
	if(parts[0] === 'C'){
		return `${msgWithHouse(chartObj, parts[1])}的反映点`;
	}
	if(parts[0] === 'D'){
		return `${msgWithHouse(chartObj, parts[1])}的${parts[2]}度右相位处`;
	}
	if(parts[0] === 'S'){
		return `${msgWithHouse(chartObj, parts[1])}的${parts[2]}度左相位处`;
	}
	if(parts[0] === 'N'){
		if(parts[2] && parts[2] !== '0'){
			return `${msgWithHouse(chartObj, parts[1])}的${parts[2]}度相位处`;
		}
		return `${msgWithHouse(chartObj, parts[1])}`;
	}
	return `${text}`;
}

function isBoundDirectionRow(pd){
	if(!pd || !pd.length){
		return false;
	}
	const promittor = pd[1] ? `${pd[1]}` : '';
	const significator = pd[2] ? `${pd[2]}` : '';
	return promittor.indexOf('T_') === 0 || significator.indexOf('T_') === 0;
}

function baseDirectionObjectId(text){
	const parts = `${text || ''}`.split('_');
	if(parts.length < 3){
		if(parts.length === 2 && (parts[0] === 'A' || parts[0] === 'C')){
			return parts[1];
		}
		return `${text || ''}`.trim();
	}
	if(parts[0] === 'T'){
		return `${parts[1] || ''}`.trim();
	}
	return parts.slice(1, parts.length - 1).join('_').trim();
}

function isCoreUnsupportedDirectionRow(pd){
	if(!pd || !pd.length){
		return false;
	}
	if(isBoundDirectionRow(pd)){
		return true;
	}
	const promBase = baseDirectionObjectId(pd[1]);
	const sigBase = baseDirectionObjectId(pd[2]);
	return !CORE_PD_SUPPORTED_BASE_IDS.has(promBase) || !CORE_PD_SUPPORTED_BASE_IDS.has(sigBase);
}

function appendBirthAndChartInfo(lines, chartObj){
	const obj = chartObj || {};
	const params = obj.params || {};
	const chart = obj.chart || {};
	lines.push('[出生时间]');
	if(params.birth){
		lines.push(`出生时间：${params.birth}${chart.dayofweek ? ` ${chart.dayofweek}` : ''}`);
	}else{
		lines.push('出生时间：无');
	}
	if(chart.nongli && chart.nongli.birth){
		lines.push(`真太阳时：${chart.nongli.birth}`);
	}

	lines.push('');
	lines.push('[星盘信息]');
	if(params.lon || params.lat){
		lines.push(`经纬度：${params.lon || ''} ${params.lat || ''}`.trim());
	}
	if(params.zone !== undefined && params.zone !== null){
		lines.push(`时区：${params.zone}`);
	}
	const zodiacalRaw = chart.zodiacal || AstroConst.ZODIACAL[`${params.zodiacal}`];
	const zodiacal = zodiacalRaw === AstroConst.SIDEREAL ? (AstroText.AstroTxtMsg[AstroConst.SIDEREAL] || zodiacalRaw) : zodiacalRaw;
	if(zodiacal){
		lines.push(`黄道：${zodiacal}`);
	}
	const hsys = AstroConst.HouseSys[`${params.hsys}`] || chart.hsys;
	if(hsys){
		lines.push(`宫制：${hsys}`);
	}
	if(chart.isDiurnal !== undefined && chart.isDiurnal !== null){
		lines.push(`盘型：${chart.isDiurnal ? '日生盘' : '夜生盘'}`);
	}
}

function buildPrimaryDirectSnapshotText(chartObj){
	const lines = [];
	const obj = chartObj || {};
	const allPds = obj.predictives && Array.isArray(obj.predictives.primaryDirection) ? obj.predictives.primaryDirection : [];
	const showPdBounds = !(obj.params && (obj.params.showPdBounds === 0 || obj.params.showPdBounds === false));
	const pdMethod = obj.params && obj.params.pdMethod ? obj.params.pdMethod : 'core_alchabitius';
	const pdTimeKey = obj.params && obj.params.pdTimeKey ? obj.params.pdTimeKey : 'Ptolemy';
	const degreeLabel = pdMethod === 'horosa_legacy' ? '赤经' : 'Arc';
	// 与表格 convertToDataSource 口径一致:showPdBounds 只隐藏 core_alchabitius 的界限法行;
	// 新方位法的界(T_)行只在 pdTerms 勾选时产出,应随导出/挂载显示(否则用户勾了界、AI 导出却没有)。
	const pds = allPds.filter((pd)=>{
		if(pdMethod === 'core_alchabitius' && isCoreUnsupportedDirectionRow(pd)){
			return false;
		}
		if(!showPdBounds && pdMethod === 'core_alchabitius' && isBoundDirectionRow(pd)){
			return false;
		}
		return true;
	});

	appendBirthAndChartInfo(lines, obj);

	const pdParams = obj.params || {};
	const pdTypeText = pdParams.pdtype === 1 ? '世俗（In Mundo）' : '黄道（In Zodiaco）';
	const wantDirect = pdParams.pdDirect === 0 ? false : true;
	const wantConverse = !!pdParams.pdConverse;
	let pdDirText = '顺向 Direct';
	if(wantDirect && wantConverse){
		pdDirText = '顺向 Direct + 逆向 Converse';
	}else if(wantConverse){
		pdDirText = '逆向 Converse';
	}
	lines.push('');
	lines.push('[主限法设置]');
	lines.push(`推运方法：${primaryDirectionMethodText(pdMethod)}`);
	lines.push(`度数换算：${primaryDirectionTimeKeyText(pdTimeKey)}`);
	lines.push(`方向类型：${pdTypeText}`);
	lines.push(`向运方向：${pdDirText}`);
	lines.push(`映点迫星：${pdParams.pdAntiscia ? '是' : '否'}`);
	lines.push(`界迫星：${pdParams.pdTerms ? '是' : '否'}`);
	lines.push(`显示界限法：${showPdBounds ? '是' : '否'}`);

	lines.push('');
	lines.push('[主限法表格]');
	lines.push(`| ${degreeLabel} | 迫星 | 应星 | 日期 |`);
	lines.push('| --- | --- | --- | --- |');
	if(pds.length === 0){
		lines.push('| 无 | 无 | 无 | 无 |');
	}else{
		pds.forEach((pd)=>{
			const degree = degreeText(pd && pd[0], pdMethod);
			const promittor = directionObjText(pd && pd[1], obj);
			const significator = directionObjText(pd && pd[2], obj);
			const date = pd && pd[4] ? `${pd[4]}` : '';
			lines.push(`| ${degree || '无'} | ${promittor || '无'} | ${significator || '无'} | ${date || '无'} |`);
		});
	}
	// [YB v42] 尾部补 [当前时点]/[方法说明](共享 helper;段头已登 preset;只动 primarydirect 这一支 builder)。
	// extraLines 提示行:表中日期距今最近的 arc 行(帮 AI 从长表中锚定当下应期;解析不出日期则省略)。
	let nearestLine = '';
	if(pds.length){
		const nowMs = Date.now();
		let best = null;
		pds.forEach((pd)=>{
			const t = Date.parse(`${(pd && pd[4]) || ''}`.trim().replace(/\//g, '-'));
			if(Number.isNaN(t)){ return; }
			const dist = Math.abs(t - nowMs);
			if(!best || dist < best.dist){ best = { pd, dist }; }
		});
		if(best){
			const bpd = best.pd;
			nearestLine = `表中距今最近行：${degreeText(bpd && bpd[0], pdMethod) || '无'}（${directionObjText(bpd && bpd[1], obj) || '无'} → ${directionObjText(bpd && bpd[2], obj) || '无'}，${bpd && bpd[4] ? `${bpd[4]}` : '无'}）`;
		}
	}
	lines.push('');
	// 主限天球可选行:用户最近在 3D 球上选中/播放的向运(≤24h 有效,防跨日陈旧)。
	// 文本由 AstroPDSphere 从选中 row 既有字段拼好盖章,此处只读不再推导。
	const sphereStamp = safeJsonParseFromStorage('horosa.pdsphere.aiCurrentRow');
	if(sphereStamp && sphereStamp.txt && Number.isFinite(sphereStamp.ts) && (Date.now() - sphereStamp.ts) < 24 * 3600 * 1000){
		lines.push('');
		lines.push('[主限天球·当前动画所指]');
		lines.push(`${sphereStamp.txt}`);
	}
	lines.push(...safeHelperLines(buildCurrentMomentLines, obj, nearestLine ? [nearestLine] : []));
	lines.push(...safeHelperLines(buildMethodNoteLines, 'primarydirect'));
	while(lines.length && lines[lines.length - 1] === ''){ lines.pop(); }
	return lines.join('\n');
}

function buildFirdariaSnapshotText(chartObj){
	const lines = [];
	const obj = chartObj || {};
	const firdaria = obj.predictives && Array.isArray(obj.predictives.firdaria) ? obj.predictives.firdaria : [];
	appendBirthAndChartInfo(lines, obj);

	lines.push('');
	lines.push('[法达星限表格]');
	lines.push('| 主限 | 子限 | 日期 |');
	lines.push('| --- | --- | --- |');
	if(firdaria.length === 0){
		lines.push('| 无 | 无 | 无 |');
	}else{
		let rowCount = 0;
		firdaria.forEach((main)=>{
			const mainDirect = msgWithHouse(obj, main && main.mainDirect);
			const subs = main && Array.isArray(main.subDirect) ? main.subDirect : [];
			if(subs.length === 0){
				lines.push(`| ${mainDirect || '无'} | 无 | 无 |`);
				rowCount += 1;
				return;
			}
			subs.forEach((sub)=>{
				const subDirect = msgWithHouse(obj, sub && sub.subDirect);
				const date = sub && sub.date ? `${sub.date}` : '';
				lines.push(`| ${mainDirect || '无'} | ${subDirect || '无'} | ${date || '无'} |`);
				rowCount += 1;
			});
		});
		if(rowCount === 0){
			lines.push('| 无 | 无 | 无 |');
		}
	}
	// 法达解读层：逐主限时段主题（并入「法达星限表格」段，无需新增预设段）。
	if(firdaria.length){
		lines.push('');
		lines.push('解读：');
		firdaria.forEach((main)=>{
			const interp = getFirdariaInterp(main && main.mainDirect);
			if(interp){ lines.push(`· ${interp.mainShort}主限 — ${interp.mainTheme}`); }
		});
	}
	// [独立复核修] v42 preset 已声明 当前时点/方法说明——D/E 组补厚唯独漏接 firdaria(死段:勾了导不出)。
	lines.push('');
	lines.push(...safeHelperLines(buildCurrentMomentLines, obj, []));
	lines.push(...safeHelperLines(buildMethodNoteLines, 'firdaria'));
	while(lines.length && lines[lines.length - 1] === ''){ lines.pop(); }
	return lines.join('\n');
}

function normalizePdYears(v){
	const n = Math.round(Number(v));
	if(!Number.isFinite(n)){
		return 100;
	}
	return Math.max(1, Math.min(3000, n));
}

function buildPrimaryDirectionFetchFields(baseFields, chartObj, pdMethod, pdTimeKey, pdYears, options){
	const fields = {
		...(baseFields || {}),
	};
	const opt = options || {};
	const pdtypeVal = (opt.pdtype === 1) ? 1 : 0;
	const pdDirectVal = (opt.direct === false) ? 0 : 1;
	const pdConverseVal = opt.converse ? 1 : 0;
	const pdAntisciaVal = opt.antiscia ? 1 : 0;
	const pdTermsVal = opt.terms ? 1 : 0;
	const params = chartObj && chartObj.params ? chartObj.params : {};
	const birth = `${params.birth || ''}`.trim();
	if(birth){
		const birthDt = new DateTime();
		try{
			birthDt.parse(birth, 'YYYY-MM-DD HH:mm:ss');
			if(params.zone){
				birthDt.zone = params.zone;
				birthDt.calcJdn();
			}
			// 护栏：parse 对畸形 birth 不抛错却得到 NaN 的 DateTime，若不校验会让后续 /chart 收到
			// date:'NaN/NaN/NaN' → 抛错弹「param error」。此时保留 baseFields 原有日期、不写入 NaN。
			const probe = `${birthDt.format ? birthDt.format('YYYY/MM/DD') : ''}`;
			if(!Number.isFinite(birthDt.jdn) || probe.indexOf('NaN') >= 0){
				throw new Error('invalid birth datetime');
			}
			fields.date = {
				...(fields.date || { name: ['date'] }),
				value: birthDt.clone(),
			};
			fields.time = {
				...(fields.time || { name: ['time'] }),
				value: birthDt.clone(),
			};
			fields.ad = {
				...(fields.ad || { name: ['ad'] }),
				value: birthDt.ad,
			};
			fields.zone = {
				...(fields.zone || { name: ['zone'] }),
				value: birthDt.zone,
			};
		}catch(e){
			// fall back to current field values when birth parsing fails
		}
	}
	if(params.lat !== undefined){
		fields.lat = {
			...(fields.lat || { name: ['lat'] }),
			value: params.lat,
		};
	}
	if(params.lon !== undefined){
		fields.lon = {
			...(fields.lon || { name: ['lon'] }),
			value: params.lon,
		};
	}
	fields.gpsLat = {
		...(fields.gpsLat || { name: ['gpsLat'] }),
		value: params.gpsLat !== undefined && params.gpsLat !== null ? params.gpsLat : params.lat,
	};
	fields.gpsLon = {
		...(fields.gpsLon || { name: ['gpsLon'] }),
		value: params.gpsLon !== undefined && params.gpsLon !== null ? params.gpsLon : params.lon,
	};
	fields.hsys = {
		...(fields.hsys || { name: ['hsys'] }),
		value: params.hsys !== undefined && params.hsys !== null ? params.hsys : 0,
	};
	fields.zodiacal = {
		...(fields.zodiacal || { name: ['zodiacal'] }),
		value: params.zodiacal !== undefined && params.zodiacal !== null ? params.zodiacal : 0,
	};
	fields.tradition = {
		...(fields.tradition || { name: ['tradition'] }),
		value: params.tradition !== undefined && params.tradition !== null ? params.tradition : 0,
	};
	fields.strongRecption = {
		...(fields.strongRecption || { name: ['strongRecption'] }),
		value: params.strongRecption !== undefined && params.strongRecption !== null ? params.strongRecption : (fields.strongRecption ? fields.strongRecption.value : 0),
	};
	fields.simpleAsp = {
		...(fields.simpleAsp || { name: ['simpleAsp'] }),
		value: params.simpleAsp !== undefined && params.simpleAsp !== null ? params.simpleAsp : (fields.simpleAsp ? fields.simpleAsp.value : 0),
	};
	fields.virtualPointReceiveAsp = {
		...(fields.virtualPointReceiveAsp || { name: ['virtualPointReceiveAsp'] }),
		value: params.virtualPointReceiveAsp !== undefined && params.virtualPointReceiveAsp !== null ? params.virtualPointReceiveAsp : (fields.virtualPointReceiveAsp ? fields.virtualPointReceiveAsp.value : 0),
	};
	fields.doubingSu28 = {
		...(fields.doubingSu28 || { name: ['doubingSu28'] }),
		value: params.doubingSu28 !== undefined && params.doubingSu28 !== null ? params.doubingSu28 : (fields.doubingSu28 ? fields.doubingSu28.value : 0),
	};
	fields.predictive = {
		...(fields.predictive || { name: ['predictive'] }),
		value: 1,
	};
	fields.showPdBounds = {
		...(fields.showPdBounds || { name: ['showPdBounds'] }),
		value: params.showPdBounds === 0 ? 0 : 1,
	};
	fields.pdtype = {
		...(fields.pdtype || { name: ['pdtype'] }),
		value: pdtypeVal,
	};
	fields.pdDirect = {
		...(fields.pdDirect || { name: ['pdDirect'] }),
		value: pdDirectVal,
	};
	fields.pdConverse = {
		...(fields.pdConverse || { name: ['pdConverse'] }),
		value: pdConverseVal,
	};
	fields.pdAntiscia = {
		...(fields.pdAntiscia || { name: ['pdAntiscia'] }),
		value: pdAntisciaVal,
	};
	fields.pdTerms = {
		...(fields.pdTerms || { name: ['pdTerms'] }),
		value: pdTermsVal,
	};
	fields.pdMethod = {
		...(fields.pdMethod || { name: ['pdMethod'] }),
		value: pdMethod,
	};
	fields.pdTimeKey = {
		...(fields.pdTimeKey || { name: ['pdTimeKey'] }),
		value: pdTimeKey,
	};
	fields.pdYears = {
		...(fields.pdYears || { name: ['pdYears'] }),
		value: normalizePdYears(pdYears !== undefined && pdYears !== null ? pdYears
			: (params.pdYears !== undefined && params.pdYears !== null ? params.pdYears
			: (fields.pdYears ? fields.pdYears.value : 100))),
	};
	fields.pdaspects = {
		...(fields.pdaspects || { name: ['pdaspects'] }),
		value: params.pdaspects !== undefined && params.pdaspects !== null ? params.pdaspects : (fields.pdaspects ? fields.pdaspects.value : [0, 60, 90, 120, 180]),
	};
	fields.name = {
		...(fields.name || { name: ['name'] }),
		value: params.name !== undefined ? params.name : (fields.name ? fields.name.value : null),
	};
	fields.pos = {
		...(fields.pos || { name: ['pos'] }),
		value: params.pos !== undefined ? params.pos : (fields.pos ? fields.pos.value : null),
	};
	fields.southchart = {
		...(fields.southchart || { name: ['southchart'] }),
		value: params.southchart !== undefined && params.southchart !== null ? params.southchart : (fields.southchart ? fields.southchart.value : 0),
	};
	fields.cid = {
		...(fields.cid || { name: ['cid'] }),
		value: null,
	};
	return fields;
}

// PERF-R8 P2:主限配置/请求构造抽为模块级纯函数 —— 原类方法逻辑逐字搬移(解析顺序
// override → chart.params → fields → 默认 不变),类方法纯委托。数据层预热复用同一构造,
// key/body 与真实首点逐字节一致。
function getDesiredPdConfigPure(chartObj, fields, override = {}){
	const chart = chartObj || {};
	const params = chart.params || {};
	const flds = fields || {};
	const pick = (key)=>{
		if(override[key] !== undefined && override[key] !== null){
			return override[key];
		}
		if(params[key] !== undefined && params[key] !== null){
			return params[key];
		}
		if(flds[key] && flds[key].value !== undefined && flds[key].value !== null){
			return flds[key].value;
		}
		return undefined;
	};
	const toFlag = (v)=>(v === true || v === 1 || v === '1' || v === 'true') ? 1 : 0;
	// 顺向 / 逆向 默认都开(用户偏好「顺逆都开」):仅显式 0/false 才关。
	const offIf = (v)=>(v === 0 || v === '0' || v === false || v === 'false') ? 0 : 1;
	const pdDirect = offIf(pick('pdDirect'));
	const pdConverse = offIf(pick('pdConverse'));
	return {
		pdMethod: override.pdMethod || (params.pdMethod
			? params.pdMethod
			: (flds.pdMethod ? flds.pdMethod.value : DEFAULT_PD_METHOD)),
		pdTimeKey: override.pdTimeKey || (params.pdTimeKey
			? params.pdTimeKey
			: (flds.pdTimeKey ? flds.pdTimeKey.value : DEFAULT_PD_TIME_KEY)),
		pdYears: normalizePdYears(override.pdYears !== undefined && override.pdYears !== null ? override.pdYears
			: (params.pdYears !== undefined && params.pdYears !== null ? params.pdYears
			: (flds.pdYears ? flds.pdYears.value : 100))),
		pdtype: toFlag(pick('pdtype')),
		pdDirect,
		pdConverse,
		pdAntiscia: toFlag(pick('pdAntiscia')),
		pdTerms: toFlag(pick('pdTerms')),
	};
}

function buildPrimaryDirectionRequestPure(chartObj, fields, override = {}){
	const chart = chartObj || {};
	// 与原类方法逐字对齐:配置解析用「组件 props.fields 对应位」(本参数 fields),
	// fetch-fields 基底允许 override.fields 覆盖 —— 两处兜底语义不合并。
	const desired = getDesiredPdConfigPure(chart, fields, override);
	const nextFields = buildPrimaryDirectionFetchFields(
		override.fields || fields,
		chart,
		desired.pdMethod,
		desired.pdTimeKey,
		desired.pdYears,
		{
			pdtype: desired.pdtype,
			direct: desired.pdDirect === 1,
			converse: desired.pdConverse === 1,
			antiscia: desired.pdAntiscia === 1,
			terms: desired.pdTerms === 1,
		}
	);
	const dateValue = nextFields.date && nextFields.date.value;
	const timeValue = nextFields.time && nextFields.time.value;
	if(!dateValue || !timeValue || !dateValue.format || !timeValue.format){
		return null;
	}
	const dateStr = dateValue.format('YYYY/MM/DD');
	const timeStr = timeValue.format('HH:mm:ss');
	// 畸形日期(NaN)绝不发请求——否则后端 Datetime 抛错弹「param error」。
	if(`${dateStr}`.indexOf('NaN') >= 0 || `${timeStr}`.indexOf('NaN') >= 0){
		return null;
	}
	return {
		date: dateStr,
		time: timeStr,
		ad: nextFields.ad && nextFields.ad.value !== undefined ? nextFields.ad.value : (dateValue.ad !== undefined ? dateValue.ad : 1),
		zone: nextFields.zone ? nextFields.zone.value : undefined,
		lat: nextFields.lat ? nextFields.lat.value : undefined,
		lon: nextFields.lon ? nextFields.lon.value : undefined,
		gpsLat: nextFields.gpsLat ? nextFields.gpsLat.value : undefined,
		gpsLon: nextFields.gpsLon ? nextFields.gpsLon.value : undefined,
		hsys: nextFields.hsys ? nextFields.hsys.value : 0,
		southchart: nextFields.southchart ? nextFields.southchart.value : 0,
		zodiacal: nextFields.zodiacal ? nextFields.zodiacal.value : 0, siderealAyanamsa: nextFields.siderealAyanamsa ? nextFields.siderealAyanamsa.value : '',
		tradition: nextFields.tradition ? nextFields.tradition.value : 0,
		strongRecption: nextFields.strongRecption ? nextFields.strongRecption.value : 0,
		simpleAsp: nextFields.simpleAsp ? nextFields.simpleAsp.value : 0,
		virtualPointReceiveAsp: nextFields.virtualPointReceiveAsp ? nextFields.virtualPointReceiveAsp.value : 0,
		doubingSu28: nextFields.doubingSu28 ? nextFields.doubingSu28.value : 0,
		predictive: true,
		includePrimaryDirection: true,
		showPdBounds: nextFields.showPdBounds ? nextFields.showPdBounds.value : 1,
		pdtype: desired.pdtype,
		pdMethod: desired.pdMethod,
		pdTimeKey: desired.pdTimeKey,
		pdYears: desired.pdYears,
		pdDirect: desired.pdDirect,
		pdConverse: desired.pdConverse,
		pdAntiscia: desired.pdAntiscia,
		pdTerms: desired.pdTerms,
		pdaspects: nextFields.pdaspects ? nextFields.pdaspects.value : [0, 60, 90, 120, 180],
		name: nextFields.name ? nextFields.name.value : null,
		pos: nextFields.pos ? nextFields.pos.value : null,
		cid: null,
	};
}

// PERF-R8 P2(数据层空闲预热):按当前盘+默认主限配置预热 /predict/pd —— 与星运首点
// (默认子页 primarydirect)同一构造、同一 url+body → requestDedupe L1/L2 命中(10min 内
// 首点 ≈0ms;超窗回落后端 paramhash 盘 ~百毫秒)。silent 且丢弃结果:绝不 dispatch、
// 绝不触碰全局 state(组件路径的 savePrimaryDirectionRows 副作用与预热无关)。失败静默。
export async function warmPrimaryDirection(chartObj, fields){
	try{
		const req = buildPrimaryDirectionRequestPure(chartObj, fields, {});
		if(!req){ return null; }
		return await request(`${Constants.ServerRoot}/predict/pd`, {
			body: JSON.stringify(req),
			cache: 'no-store',
			silent: true,
			// PERF-R9 Ship 7:预热/预取一律零重试(显式声明,不吃任何调用链上的重试默认值)——
			// 后端重启窗口里 N 个深度预取绝不能变成 N×10 次退避重试风暴。
			retry: { retries: 0 },
		});
	}catch(e){
		return null; // 预热失败静默:首点回到冷即付的现状
	}
}

function unwrapPredictiveResponse(data){
	if(!data || typeof data !== 'object'){
		return null;
	}
	if(data[Constants.ResultKey] && typeof data[Constants.ResultKey] === 'object'){
		return data[Constants.ResultKey];
	}
	return data;
}

function isPrimaryDirectionTabKey(key){
	// primarydirsphere(主限天球)同吃 PD 表行:行数据是 AI 快照(复用主限表段)
	return key === 'primarydirect' || key === 'primarydirchart' || key === 'primarydirsphere';
}

class AstroDirectMain extends Component{
	// [R3-A6] 渲染守卫:宿主无关 dispatch 不再全树重渲(nextState 引用变照常放行;
	// 开关 horosa.perf.chartSCU,语义详 chartUpdateGuard.wrapperPropsEqual)。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){
			return true;
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}


	constructor(props) {
		super(props);
		const initialTab = normalizePrimaryDirectionSubTabKey(props.currentSubTab);

		this.state = {
			currentTab: initialTab,
			hook:{
				primarydirect:{
					fun: null
				},
				primarydirchart:{
					fun: null
				},
				primarydirsphere:{
					fun: null
				},
				firdaria:{
					fun: null
				},
				distributions:{
					fun: null
				},
				agepoint:{
					fun: null
				},
				profection:{
					fun: null
				},
				solararc:{
					fun: null
				},
				solarreturn:{
					fun: null
				},
				lunarreturn:{
					fun: null
				},
				givenyear:{
					fun: null
				},
				decennials:{
					fun: null
				},
				planetaryages:{
					fun: null
				},
				vedicprog:{
					fun: null
				},
				balbillus:{
					fun: null
				},
				triplicityrulers:{
					fun: null
				},
				keypoints:{
					fun: null
				},
				lunationphase:{
					fun: null
				},
				extrareturns:{
					fun: null
				},
				yearsystem129:{
					fun: null
				},
				planetaryarc:{
					fun: null
				},
				persiandirected:{
					fun: null
				},
				jaynesprog:{
					fun: null
				},
					zodialrelease:{
						fun: null
					},
					ephemeris:{
						fun: null
					},
					progressions:{
						fun: null
					},
					returntimeline:{
						fun: null
					},
					prenatalsyzygy:{
						fun: null
					},

				},
		};

		this.changeTab = this.changeTab.bind(this);
		this.applyPrimaryDirectionConfig = this.applyPrimaryDirectionConfig.bind(this);
		this.saveDirectionSnapshot = this.saveDirectionSnapshot.bind(this);
		this.savePrimaryDirectSnapshot = this.savePrimaryDirectSnapshot.bind(this);
		this.saveFirdariaSnapshot = this.saveFirdariaSnapshot.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
		this.ensurePrimaryDirectionReady = this.ensurePrimaryDirectionReady.bind(this);
		this.requestPrimaryDirectionRows = this.requestPrimaryDirectionRows.bind(this);
		this.buildPrimaryDirectionRequest = this.buildPrimaryDirectionRequest.bind(this);
		this.getDesiredPdConfig = this.getDesiredPdConfig.bind(this);
		this.needsPrimaryDirectionLoad = this.needsPrimaryDirectionLoad.bind(this);
		this.syncCurrentSubTab = this.syncCurrentSubTab.bind(this);
		this.savePrimaryDirectionRows = this.savePrimaryDirectionRows.bind(this);

		this.unmounted = false;
		this.primaryDirectionInflightKey = '';
		this.primaryDirectionRequestSeq = 0;

		if(this.props.hook){
			this.props.hook.fun = (chartobj)=>{
				let hook = this.state.hook;
				if(hook[this.state.currentTab].fun){
					hook[this.state.currentTab].fun(chartobj);
				}
			};
			// PERF-R9 Ship 7:星运页默认子页(主限 primarydirect)的 /predict/pd 与主 /chart
			// 互不依赖(pd 的构参只吃 fields + 盘上的 pd 配置)—— 在 /chart 返回【之前】并行发出,
			// latency 从「网络 + 技法」变「max(网络, 技法)」。silent、丢结果、绝不 setState。
			// 闸:horosa.perf.prewarmRequests(模型层判定,关=此函数不被调用,逐字节旧序)。
			this.props.hook.prewarmRequests = (flds)=>{
				if(this.unmounted){
					return;
				}
				if(!isPrimaryDirectionTabKey(this.state.currentTab)){
					return;
				}
				try{
					warmPrimaryDirection(this.props.chartObj, flds || this.props.fields);
				}catch(e){ /* 预热失败无害:正式请求自兜底 */ }
			};
			// horosa_prefetch_registry_v1(PERF-R9 Ship 7):主限推运 /predict/pd 是确定性纯计算
			// (同 盘+主限配置 恒同表)→ 登记步进预取。构参走与首点同一 pure builder。
			// 🔴 登记必须在组件内:pd 配置来自组件所在页的 props/盘面态,模块级构不出同键 body。
			if(stepPrefetchEnabled()){
				registerStepPrefetcher('direction', (steppedFields)=>{
					if(this.unmounted || !isPrimaryDirectionTabKey(this.state.currentTab)){
						return [];
					}
					// 只有 date/time 随步进走;pd 配置(方法/年数/顺逆)取当前盘面 —— 与用户
					// 真点下一步时发出的 body 逐字节同键。
					if(!buildPrimaryDirectionRequestPure(this.props.chartObj, steppedFields, {})){
						return [];
					}
					return [{
						name: 'direction:pd',
						path: '/predict/pd',
						run: ()=> warmPrimaryDirection(this.props.chartObj, steppedFields),
					}];
				});
			}
		}

	}

	syncCurrentSubTab(){
		if(!this.props.dispatch){
			return;
		}
		const nextTab = normalizePrimaryDirectionSubTabKey(this.state.currentTab);
		if(this.props.currentSubTab === nextTab){
			return;
		}
		this.props.dispatch({
			type: 'astro/save',
			payload: {
				currentSubTab: nextTab,
			}
		});
	}

	getDesiredPdConfig(chartObj, override = {}){
		// PERF-R8 P2:逻辑原样抽为模块级纯函数(预热复用同一构造 → key/body 逐字节一致);
		// 本方法保持既有签名与解析语义(chartObj/props 兜底),纯委托零行为变化。
		return getDesiredPdConfigPure(chartObj || this.props.chartObj, this.props.fields, override);
	}

	buildPrimaryDirectionRequest(chartObj, override = {}){
		return buildPrimaryDirectionRequestPure(chartObj || this.props.chartObj, override.fields || this.props.fields, override);
	}

	needsPrimaryDirectionLoad(chartObj){
		if(!isPrimaryDirectionTabKey(this.state.currentTab)){
			return false;
		}
		const chart = chartObj || this.props.chartObj || {};
		const params = chart.params || {};
		const predictives = chart.predictives || {};
		const pds = Array.isArray(predictives.primaryDirection) ? predictives.primaryDirection : [];
		const desired = this.getDesiredPdConfig(chart);
		const hasCompleteParams = !!(
			params.pdMethod
			&& params.pdTimeKey
			&& params.pdtype !== undefined
			&& `${params.pdSyncRev || ''}` === PD_SYNC_REV
		);
		if((params.pdMethod || desired.pdMethod) !== desired.pdMethod){
			return true;
		}
		if((params.pdTimeKey || desired.pdTimeKey) !== desired.pdTimeKey){
			return true;
		}
		if(normalizePdYears(params.pdYears !== undefined && params.pdYears !== null ? params.pdYears : desired.pdYears) !== desired.pdYears){
			return true;
		}
		if(!hasCompleteParams){
			return true;
		}
		// pdtype/pdDirect/pdConverse/pdAntiscia/pdTerms 现为真实选项,已随 chart.params 持久化;
		// desired(无 override)即取自 params,故自动加载不因开关而误触发(显式重算走表格「计算」按钮)。
		return pds.length === 0;
	}

	savePrimaryDirectionRows(chartObj, req, pdRows, options = {}){
		if(!this.props.dispatch){
			return;
		}
		// base 盘不完整(如 /chart 失败后 chartObj 为空)时绝不落盘:merge 会合成只有 pd 系
		// params、无 chart/无 params.zone 的部分态对象,写入全局后宿占/3D 等消费方按
		// chartObj truthy 解引用 .chart/.params.zone 即崩。
		if(!chartObj || !chartObj.chart){
			return;
		}
		const nextChartObj = mergePrimaryDirectionChartObj(chartObj, {
			pdRows,
			showPdBounds: req.showPdBounds,
			pdMethod: req.pdMethod,
			pdTimeKey: req.pdTimeKey,
			pdYears: req.pdYears,
			pdtype: req.pdtype,
			pdDirect: req.pdDirect,
			pdConverse: req.pdConverse,
			pdAntiscia: req.pdAntiscia,
			pdTerms: req.pdTerms,
			name: req.name,
			pos: req.pos,
			chartId: options.chartId,
		});
		const payload = {
			chartObj: nextChartObj,
		};
		if(options.fields){
			payload.fields = options.fields;
		}
		this.props.dispatch({
			type: 'astro/save',
			payload,
		});
		if(options.runHook && options.fields){
			this.props.dispatch({
				type: 'astro/doHook',
				payload: {
					chartObj: nextChartObj,
					fields: options.fields,
				},
			});
		}
	}

	async requestPrimaryDirectionRows(options = {}){
		const chartObj = options.chartObj || this.props.chartObj || {};
		const req = this.buildPrimaryDirectionRequest(chartObj, options);
		if(!req || !this.props.dispatch){
			return;
		}
		const reqKey = JSON.stringify({
			tab: this.state.currentTab,
			date: req.date,
			time: req.time,
			zone: req.zone,
			lat: req.lat,
			lon: req.lon,
			hsys: req.hsys,
			zodiacal: req.zodiacal, siderealAyanamsa: req.siderealAyanamsa,
			pdMethod: req.pdMethod,
			pdTimeKey: req.pdTimeKey,
			pdYears: req.pdYears,
			showPdBounds: req.showPdBounds,
			pdtype: req.pdtype,
			pdDirect: req.pdDirect,
			pdConverse: req.pdConverse,
			pdAntiscia: req.pdAntiscia,
			pdTerms: req.pdTerms,
			pdaspects: req.pdaspects,
		});
		if(this.primaryDirectionInflightKey === reqKey){
			return;
		}
		this.primaryDirectionInflightKey = reqKey;
		const seq = ++this.primaryDirectionRequestSeq;
		let result = null;
		try{
			const data = await request(`${Constants.ServerRoot}/predict/pd`, {
				body: JSON.stringify(req),
				cache: 'no-store',
			});
			result = unwrapPredictiveResponse(data);
		}catch(e){
			result = null;
		}
		if(this.unmounted || seq !== this.primaryDirectionRequestSeq){
			return;
		}
		this.primaryDirectionInflightKey = '';
		const pdRows = result && Array.isArray(result.pd) ? result.pd : null;
		if(!pdRows){
			return;
		}
		this.savePrimaryDirectionRows(chartObj, req, pdRows, {
			fields: options.fields,
			runHook: !!options.runHook,
			chartId: options.chartId,
		});
	}

	ensurePrimaryDirectionReady(){
		if(!this.needsPrimaryDirectionLoad()){
			this.primaryDirectionInflightKey = '';
			return;
		}
		this.requestPrimaryDirectionRows();
	}

	savePrimaryDirectSnapshot(){
		const chartObj = this.props.chartObj || {};
		const chartParams = chartObj.params || {};
		const fields = this.props.fields || {};
		const showPdBounds = chartParams.showPdBounds !== undefined
			? chartParams.showPdBounds
			: (fields.showPdBounds ? fields.showPdBounds.value : 1);
		const pdMethod = chartParams.pdMethod
			? chartParams.pdMethod
			: (fields.pdMethod ? fields.pdMethod.value : 'core_alchabitius');
		const pdTimeKey = chartParams.pdTimeKey
			? chartParams.pdTimeKey
			: (fields.pdTimeKey ? fields.pdTimeKey.value : 'Ptolemy');
		const snapshotChartObj = {
			...chartObj,
			params: {
				...(chartObj.params || {}),
				showPdBounds,
				pdMethod,
				pdTimeKey,
			},
		};
		const txt = buildPrimaryDirectSnapshotText(snapshotChartObj);
		if(!txt){
			return '';
		}
		saveModuleAISnapshot('primarydirect', txt, {
			tab: 'primarydirect',
			pdMethod,
			pdTimeKey,
			showPdBounds,
		});
		return txt;
	}

	saveFirdariaSnapshot(){
		const txt = buildFirdariaSnapshotText(this.props.chartObj);
		if(!txt){
			return '';
		}
		saveModuleAISnapshot('firdaria', txt, {
			tab: 'firdaria',
		});
		return txt;
	}

	saveDirectionSnapshot(){
		this.savePrimaryDirectSnapshot();
		if(this.state.currentTab === 'primarydirect'){
			return;
		}
		if(this.state.currentTab === 'firdaria'){
			this.saveFirdariaSnapshot();
		}
	}

	handleSnapshotRefreshRequest(evt){
		if(!evt || !evt.detail || typeof evt.detail !== 'object'){
			return;
		}
		if(evt.detail.module === 'primarydirect'){
			const txt = this.savePrimaryDirectSnapshot();
			if(txt){
				evt.detail.snapshotText = txt;
			}
			return;
		}
		if(evt.detail.module === 'firdaria'){
			const txt = this.saveFirdariaSnapshot();
			if(txt){
				evt.detail.snapshotText = txt;
			}
		}
	}

	componentDidMount(){
		this.unmounted = false;
		if(typeof window !== 'undefined' && window.addEventListener){
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
		this.syncCurrentSubTab();
		this.ensurePrimaryDirectionReady();
		this.saveDirectionSnapshot();
		// 底部空白根治:静态 props.height-20 比实际工作区矮(链上全满仅本模块 inline 高偏矮)→ Tabs/表格
		// 皆按偏矮值设死高度,页底留空白。改测根容器真高驱动各页签高度。
		this.measureRootHeight();
		if(typeof ResizeObserver !== 'undefined' && this.rootEl){
			this._roRoot = new ResizeObserver(()=>{
				if(this._rafRoot){ cancelAnimationFrame(this._rafRoot); }
				this._rafRoot = requestAnimationFrame(()=> this.measureRootHeight());
			});
			this._roRoot.observe(this.rootEl);
		}
	}

	// 测根容器真高(填满工作区);>120 才采信,变化才 setState(防抖风暴)。回退=静态 props.height-20。
	measureRootHeight(){
		if(this.unmounted || !this.rootEl){ return; }
		const h = Math.round(this.rootEl.getBoundingClientRect().height);
		if(h > 120 && h !== this.state.containerH){ this.setState({ containerH: h }); }
	}

	componentWillUnmount(){
		this.unmounted = true;
		if(typeof window !== 'undefined' && window.removeEventListener){
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
		if(this._roRoot){ try{ this._roRoot.disconnect(); }catch(e){} this._roRoot = null; }
		if(this._rafRoot){ cancelAnimationFrame(this._rafRoot); this._rafRoot = null; }
	}

	componentDidUpdate(prevProps, prevState){
		if(prevProps.currentSubTab !== this.props.currentSubTab){
			const nextTab = normalizePrimaryDirectionSubTabKey(this.props.currentSubTab);
			if(nextTab !== this.state.currentTab){
				this.setState({ currentTab: nextTab }, ()=>{
					this.ensurePrimaryDirectionReady();
					this.saveDirectionSnapshot();
					const hook = this.state.hook[nextTab];
					if(hook && hook.fun){
						hook.fun(this.props.chartObj);
					}
				});
				return;
			}
		}
		if(
			prevState.currentTab !== this.state.currentTab ||
			prevProps.chartObj !== this.props.chartObj ||
			prevProps.fields !== this.props.fields ||
			this.state.currentTab === 'primarydirect' ||
			this.state.currentTab === 'firdaria'
		){
			this.saveDirectionSnapshot();
		}
		if(prevState.currentTab !== this.state.currentTab || prevProps.currentSubTab !== this.props.currentSubTab){
			this.syncCurrentSubTab();
		}
		if(
			prevState.currentTab !== this.state.currentTab
			|| prevProps.chartObj !== this.props.chartObj
			|| prevProps.fields !== this.props.fields
		){
			this.ensurePrimaryDirectionReady();
		}
	}

	changeTab(key){
		let hook = this.state.hook;
		this.setState({
			currentTab: key,
		}, ()=>{
			this.syncCurrentSubTab();
			this.ensurePrimaryDirectionReady();
			this.saveDirectionSnapshot();
			if(hook[key].fun){
				hook[key].fun(this.props.chartObj);
			}
		});
	}

	applyPrimaryDirectionConfig(pdMethod, pdTimeKey, pdYears, options){
		if(!this.props.dispatch || !this.props.fields){
			return;
		}
		const opt = options || {};
		const resolvedPdYears = pdYears !== undefined && pdYears !== null
			? normalizePdYears(pdYears)
			: this.getDesiredPdConfig(this.props.chartObj).pdYears;
		this.props.dispatch({
			type: 'app/save',
			payload: {
				pdMethod,
				pdTimeKey,
				pdYears: resolvedPdYears,
				pdtype: opt.pdtype === 1 ? 1 : 0,
				pdDirect: opt.direct === false ? 0 : 1,
				// 统一 0/1 数字编码:此前混入布尔,而 PD 链下游惯例是 `x === 0 ? 0 : 1`,
				// 布尔 false 会被错判成 1(开),埋给未来消费者的雷。
				pdConverse: opt.converse ? 1 : 0,
				pdAntiscia: opt.antiscia ? 1 : 0,
				pdTerms: opt.terms ? 1 : 0,
			},
		});
		const nextFields = buildPrimaryDirectionFetchFields(
			this.props.fields,
			this.props.chartObj,
			pdMethod,
			pdTimeKey,
			resolvedPdYears,
			opt
		);
		this.props.dispatch({
			type: 'astro/save',
			payload: {
				fields: nextFields,
			},
		});
		this.requestPrimaryDirectionRows({
			chartObj: this.props.chartObj,
			fields: nextFields,
			pdMethod,
			pdTimeKey,
			pdYears: resolvedPdYears,
			// 把本次「计算」选择的进阶开关作为 override 直传,优先级高于已落库 params,
			// 确保用户新选的 方向类型/顺逆/映点/界 立即进入 /predict/pd 请求体。
			pdtype: opt.pdtype === 1 ? 1 : 0,
			pdDirect: opt.direct === false ? 0 : 1,
			pdConverse: opt.converse ? 1 : 0,
			pdAntiscia: opt.antiscia ? 1 : 0,
			pdTerms: opt.terms ? 1 : 0,
			runHook: true,
		});
	}

	render(){
		// 测得的根容器真高优先(填满工作区、消页底空白);未测到时回退静态 props.height-20。
		let height = (this.state.containerH && this.state.containerH > 120)
			? this.state.containerH
			: ((this.props.height ? this.props.height : 760) - 20);
		const chartParams = this.props.chartObj && this.props.chartObj.params ? this.props.chartObj.params : {};
		const appliedPdMethod = chartParams.pdMethod
			? chartParams.pdMethod
			: (this.props.fields && this.props.fields.pdMethod ? this.props.fields.pdMethod.value : 'core_alchabitius');
		const appliedPdTimeKey = chartParams.pdTimeKey
			? chartParams.pdTimeKey
			: (this.props.fields && this.props.fields.pdTimeKey ? this.props.fields.pdTimeKey.value : 'Ptolemy');
		const appliedPdYears = normalizePdYears(chartParams.pdYears !== undefined && chartParams.pdYears !== null
			? chartParams.pdYears
			: (this.props.fields && this.props.fields.pdYears ? this.props.fields.pdYears.value : 100));
		// In Zodiaco(0,黄道) / In Mundo(1,世俗) + 向运方向(converse) + 映点 / 界 开关——
		// 均从已落库 chart.params 读取(applyPrimaryDirectionConfig 写入),缺省回退黄道/顺向/关。
		const appliedPdType = chartParams.pdtype === 1 ? 1 : 0;
		// 顺向 direct 默认开:仅当已落库显式为 0 才关(缺省/未定义都按开)。
		// 漏传此 prop 会让表格 componentDidUpdate 把「顺」误判为 undefined→默认 1,
		// 导致选「仅逆」算完后「顺」又自动勾上,显示与实算对不上。
		const appliedPdDirect = chartParams.pdDirect === 0 ? 0 : 1;
		// 默认「顺逆都开」(用户偏好):pdConverse 缺省/未定义都按开;仅显式落库为 0/false 才关。
		const appliedPdConverse = (chartParams.pdConverse === 0 || chartParams.pdConverse === false) ? 0 : 1;
		const appliedPdAntiscia = chartParams.pdAntiscia ? 1 : 0;
		const appliedPdTerms = chartParams.pdTerms ? 1 : 0;

		return (
			<div className="horosa-direction-page xq-chart-renderer xq-chart-renderer-direction" ref={(el)=>{ this.rootEl = el; }} style={{ height: '100%', minHeight: 0 }}>
				<Tabs
					activeKey={this.state.currentTab} tabPosition='right'
					onChange={this.changeTab}
					style={{ height: height }}
				>
					<TabPane tab="赤纬推运" key="jaynesprog">
						<FreezeInactive active={this.state.currentTab === "jaynesprog"}>
							<AstroJaynesProgressions
								value={this.props.chartObj}
								height={height}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
						</FreezeInactive>
						</TabPane>

					<TabPane tab="恒星推运" key="vedicprog">
						<FreezeInactive active={this.state.currentTab === "vedicprog"}>
							<AstroVedicProgressions
								value={this.props.chartObj}
								height={height}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
						</FreezeInactive>
						</TabPane>

					<TabPane tab="推运" key="progressions">
						<FreezeInactive active={this.state.currentTab === "progressions"}>
							<AstroProgressions
								value={this.props.chartObj}
								height={height}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
						</FreezeInactive>
						</TabPane>

					<TabPane tab="主限法" key="primarydirect">
						<FreezeInactive active={this.state.currentTab === "primarydirect"}>
							<AstroPrimaryDirection
								value={this.props.chartObj} height={height}
								showPdBounds={this.props.fields && this.props.fields.showPdBounds ? this.props.fields.showPdBounds.value : 1}
								pdMethod={appliedPdMethod}
								pdTimeKey={appliedPdTimeKey}
								pdYears={appliedPdYears}
								pdType={appliedPdType}
								pdDirect={appliedPdDirect}
								pdConverse={appliedPdConverse}
								pdAntiscia={appliedPdAntiscia}
								pdTerms={appliedPdTerms}
								onPdConfigApply={this.applyPrimaryDirectionConfig}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
						</FreezeInactive>
					</TabPane>

					<TabPane tab="界推运" key="distributions">
						<FreezeInactive active={this.state.currentTab === "distributions"}>
						<AstroDistributions
							value={this.props.chartObj}
							height={height}
						/>
						</FreezeInactive>
					</TabPane>

					<TabPane tab="年龄推进点" key="agepoint">
						<FreezeInactive active={this.state.currentTab === "agepoint"}>
						<AstroAgePoint
							value={this.props.chartObj}
							height={height}
						/>
						</FreezeInactive>
					</TabPane>

					<TabPane tab="星历" key="ephemeris">
						<FreezeInactive active={this.state.currentTab === "ephemeris"}>
							<AstroEphemeris
								value={this.props.chartObj}
								height={height}
							/>
						</FreezeInactive>
						</TabPane>

					<TabPane tab="回归轴" key="returntimeline">
						<FreezeInactive active={this.state.currentTab === "returntimeline"}>
							<AstroReturnTimeline
								value={this.props.chartObj}
								height={height}
							/>
						</FreezeInactive>
						</TabPane>

					<TabPane tab="主限法盘" key="primarydirchart">
						<FreezeInactive active={this.state.currentTab === "primarydirchart"}>
							<AstroPrimaryDirectionChart
								value={this.props.chartObj}
								height={height}
								showPdBounds={this.props.fields && this.props.fields.showPdBounds ? this.props.fields.showPdBounds.value : 1}
								pdMethod={appliedPdMethod}
								pdTimeKey={appliedPdTimeKey}
								pdYears={appliedPdYears}
								pdType={appliedPdType}
								pdDirect={appliedPdDirect}
								pdConverse={appliedPdConverse}
								pdAntiscia={appliedPdAntiscia}
								pdTerms={appliedPdTerms}
								fields={this.props.fields}
								dispatch={this.props.dispatch}
								onPdConfigApply={this.applyPrimaryDirectionConfig}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								hook={this.state.hook.primarydirchart}
							/>
						</FreezeInactive>
					</TabPane>

										<TabPane tab="主限天球" key="primarydirsphere">
						<FreezeInactive active={this.state.currentTab === "primarydirsphere"}>
							{/* AI 快照复用主限表既有段(buildPrimaryDirectSnapshotText→'primarydirect'),
							    本组件零新增快照段 —— 防 AI 段表漂移;pd3d 构参直接复用
							    buildPrimaryDirectionRequest(与 /predict/pd 同一构参函数,零复刻)。 */}
							<AstroPDSphere
								value={this.props.chartObj}
								height={height}
								active={this.state.currentTab === "primarydirsphere"}
								pdMethod={appliedPdMethod}
								pdTimeKey={appliedPdTimeKey}
								pdYears={appliedPdYears}
								pdType={appliedPdType}
								pdDirect={appliedPdDirect}
								pdConverse={appliedPdConverse}
								pdAntiscia={appliedPdAntiscia}
								pdTerms={appliedPdTerms}
								buildRequest={this.buildPrimaryDirectionRequest}
							/>
						</FreezeInactive>
					</TabPane>

					<TabPane tab="波斯向运" key="persiandirected">
						<FreezeInactive active={this.state.currentTab === "persiandirected"}>
							<AstroPersianDirected
								value={this.props.chartObj}
								height={height}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								chartDisplay={this.props.chartDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
						</FreezeInactive>
						</TabPane>

					<TabPane tab="行星弧" key="planetaryarc">
						<FreezeInactive active={this.state.currentTab === "planetaryarc"}>
							<AstroPlanetaryArc
								value={this.props.chartObj}
								height={height}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								chartDisplay={this.props.chartDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
						</FreezeInactive>
						</TabPane>

					<TabPane tab="小限法" key="profection">
						<FreezeInactive active={this.state.currentTab === "profection"}>
						<AstroProfection 
							value={this.props.chartObj} 
							height={height} 
							chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
								hook={this.state.hook.profection} 
							/>

						</FreezeInactive>
					</TabPane>

					<TabPane tab="太阳弧" key="solararc">
						<FreezeInactive active={this.state.currentTab === "solararc"}>
						<AstroSolarArc 
							value={this.props.chartObj} 
							height={height} 
							chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
								hook={this.state.hook.solararc} 
							/>

						</FreezeInactive>
					</TabPane>

					<TabPane tab="太阳返照" key="solarreturn">
						<FreezeInactive active={this.state.currentTab === "solarreturn"}>
						<AstroSolarReturn 
							value={this.props.chartObj} 
							height={height} 
							chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
								hook={this.state.hook.solarreturn} 
							/>
						</FreezeInactive>
					</TabPane>

					<TabPane tab="月亮返照" key="lunarreturn">
						<FreezeInactive active={this.state.currentTab === "lunarreturn"}>
						<AstroLunarReturn 
							value={this.props.chartObj} 
							height={height} 
							chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
								hook={this.state.hook.lunarreturn} 
							/>
						</FreezeInactive>
					</TabPane>

					<TabPane tab="流年法" key="givenyear">
						<FreezeInactive active={this.state.currentTab === "givenyear"}>
						<AstroGivenYear 
							value={this.props.chartObj} 
							height={height} 
							chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
								hook={this.state.hook.givenyear} 
							/>
						</FreezeInactive>
					</TabPane>

					<TabPane tab="法达星限" key="firdaria">
						<FreezeInactive active={this.state.currentTab === "firdaria"}>
						<AstroFirdaria 
								value={this.props.chartObj} 
								height={height}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
						</FreezeInactive>
					</TabPane>

					<TabPane tab="十年大运" key="decennials">
						<FreezeInactive active={this.state.currentTab === "decennials"}>
						<AstroDecennials
							value={this.props.chartObj}
							height={height}
							chartDisplay={this.props.chartDisplay}
							planetDisplay={this.props.planetDisplay}
							lotsDisplay={this.props.lotsDisplay}
							showPlanetHouseInfo={this.props.showPlanetHouseInfo}
							showAstroMeaning={this.props.showAstroMeaning}
							hook={this.state.hook.decennials}
						/>
						</FreezeInactive>
						</TabPane>

					<TabPane tab="黄道星释" key="zodialrelease">
						<FreezeInactive active={this.state.currentTab === "zodialrelease"}>
						<AstroZR  
							value={this.props.chartObj} 
							height={height} 
							chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
								hook={this.state.hook.zodialrelease}
							/>
						</FreezeInactive>
					</TabPane>

					<TabPane tab="行星年龄" key="planetaryages">
						<FreezeInactive active={this.state.currentTab === "planetaryages"}>
							<AstroPlanetaryAges
								value={this.props.chartObj}
								height={height}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
						</FreezeInactive>
						</TabPane>

					<TabPane tab="129年系统" key="yearsystem129">
						<FreezeInactive active={this.state.currentTab === "yearsystem129"}>
							<AstroYearSystem129
								value={this.props.chartObj}
								height={height}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
						</FreezeInactive>
						</TabPane>

						<TabPane tab="Balbillus" key="balbillus">
							<FreezeInactive active={this.state.currentTab === "balbillus"}>
							<AstroBalbillus
								value={this.props.chartObj}
								height={height}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
							</FreezeInactive>
						</TabPane>

						<TabPane tab="三分主星" key="triplicityrulers">
							<FreezeInactive active={this.state.currentTab === "triplicityrulers"}>
							<AstroTriplicityRulers
								value={this.props.chartObj}
								height={height}
								showAstroMeaning={this.props.showAstroMeaning}
								tripSystem={this.props.tripSystem}
							/>
							</FreezeInactive>
						</TabPane>

						<TabPane tab="数字相位" key="keypoints">
							<FreezeInactive active={this.state.currentTab === "keypoints"}>
							<AstroKeypoints
								value={this.props.chartObj}
								height={height}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
							</FreezeInactive>
						</TabPane>

						<TabPane tab="月相推运" key="lunationphase">
							<FreezeInactive active={this.state.currentTab === "lunationphase"}>
							<AstroLunationPhase
								value={this.props.chartObj}
								height={height}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
							</FreezeInactive>
						</TabPane>

						<TabPane tab="产前朔望" key="prenatalsyzygy">
							<FreezeInactive active={this.state.currentTab === "prenatalsyzygy"}>
							<AstroPrenatalSyzygy
								value={this.props.chartObj}
								height={height}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
							</FreezeInactive>
						</TabPane>

						<TabPane tab="多重回归" key="extrareturns">
							<FreezeInactive active={this.state.currentTab === "extrareturns"}>
							<AstroExtraReturns
								value={this.props.chartObj}
								height={height}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
							</FreezeInactive>
						</TabPane>

					</Tabs>
			</div>
		);
	}
}

export { AstroDirectMain, buildPrimaryDirectionFetchFields, buildPrimaryDirectSnapshotText, buildFirdariaSnapshotText, };
export default AstroDirectMain;
