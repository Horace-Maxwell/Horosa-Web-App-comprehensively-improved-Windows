import * as AstroConst from '../constants/AstroConst';
import * as AstroText from '../constants/AstroText';
import {
	buildHouseCuspLines,
	buildStarAndLotPositionLines,
	buildInfoSection,
} from './astroAiSnapshot';
import {
	appendPlanetMetaName,
} from './planetMetaDisplay';

const PREDICTIVE_SNAPSHOT_PLANET_META = {
	showPostnatal: 1,
	showHouse: 1,
	showRuler: 1,
};

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

function msgWithMeta(id, chartSources){
	const base = msg(id);
	return appendPlanetMetaName(base, id, chartSources, PREDICTIVE_SNAPSHOT_PLANET_META);
}

function normalizeDateTime(value){
	if(!value){
		return '';
	}
	if(value.format){
		return value.format('YYYY-MM-DD HH:mm:ss');
	}
	return `${value}`;
}

function round3(val){
	const num = Number(val);
	if(Number.isNaN(num)){
		return `${val || ''}`.trim();
	}
	return `${Math.round(num * 1000) / 1000}`;
}

function buildStarInfoLines(natalChartObj){
	const lines = [];
	const obj = natalChartObj || {};
	const params = obj.params || {};
	const chart = obj.chart || {};

	if(params.lon || params.lat){
		lines.push(`经纬度：${params.lon || ''} ${params.lat || ''}`.trim());
	}
	if(params.zone !== undefined && params.zone !== null){
		lines.push(`时区：${params.zone}`);
	}

	const zodiacalRaw = chart.zodiacal || AstroConst.ZODIACAL[`${params.zodiacal}`];
	if(zodiacalRaw === AstroConst.SIDEREAL){
		lines.push(`黄道：${AstroText.AstroTxtMsg[AstroConst.SIDEREAL] || zodiacalRaw}`);
	}else if(zodiacalRaw){
		lines.push('黄道：回归黄道');
	}
	const hsys = AstroConst.HouseSys[`${params.hsys}`] || chart.hsys;
	if(hsys){
		lines.push(`宫制：${hsys}`);
	}
	if(chart.isDiurnal !== undefined && chart.isDiurnal !== null){
		lines.push(`盘型：${chart.isDiurnal ? '日生盘' : '夜生盘'}`);
	}

	const houseLines = buildHouseCuspLines(natalChartObj);
	if(houseLines.length){
		lines.push('宫位宫头');
		lines.push(...houseLines);
	}

	const starLotLines = buildStarAndLotPositionLines(natalChartObj);
	if(starLotLines.length){
		lines.push('星与虚点');
		lines.push(...starLotLines);
	}

	const infoLines = buildInfoSection(natalChartObj, null);
	const infoOnly = pickInfoBlocks(infoLines, [
		'映点/反映点',
		'接纳',
		'互容',
		'光线围攻',
		'夹宫',
		'夹星',
		'纬照',
	]);
	if(infoOnly.length){
		lines.push('信息');
		lines.push(...infoOnly);
	}

	return lines;
}

function pickInfoBlocks(lines, titles){
	const src = Array.isArray(lines) ? lines : [];
	const titleSet = new Set(titles || []);
	const out = [];
	let inBlock = false;
	const normLine = (text)=>`${text}`.replace(/互容/g, '互融');

	src.forEach((line)=>{
		const t = `${line || ''}`.trim();
		if(!t){
			return;
		}
		if(titleSet.has(t)){
			inBlock = true;
			out.push(normLine(t));
			return;
		}
		if(inBlock){
			if(titleSet.has(t)){
				out.push(normLine(t));
				return;
			}
			out.push(normLine(t));
		}
	});

	return out;
}

function buildSetupLines(params){
	const lines = [];
	const p = params || {};
	const timeTxt = normalizeDateTime(p.datetime);
	if(timeTxt){
		lines.push(`推运时间：${timeTxt}`);
	}
	if(p.dirZone !== undefined && p.dirZone !== null){
		lines.push(`推运时区：${p.dirZone}`);
	}
	const lon = p.dirLon || p.lon;
	const lat = p.dirLat || p.lat;
	if(lon || lat){
		lines.push(`推运经纬度：${lon || ''} ${lat || ''}`.trim());
	}
	if(p.tmType){
		lines.push(`时间步进：${p.tmType}`);
	}
	if(p.asporb !== undefined && p.asporb !== null){
		lines.push(`相位容许度：${p.asporb}`);
	}
	if(p.nodeRetrograde !== undefined && p.nodeRetrograde !== null){
		lines.push(`月交点逆行：${p.nodeRetrograde ? '是' : '否'}`);
	}
	return lines;
}

function buildAspectLines(result, natalChartObj){
	const lines = [];
	const chart = result && result.chart ? result.chart : {};
	const aspects = Array.isArray(chart.aspects) ? chart.aspects : [];
	const chartSources = [result, natalChartObj];
	aspects.forEach((item)=>{
		const direct = msgWithMeta(item.directId || item.id, chartSources);
		const objs = Array.isArray(item.objects) ? item.objects : [];
		objs.forEach((o)=>{
			const natal = msgWithMeta(o.natalId || o.id, chartSources);
			const asp = AstroText.AstroTxtMsg[`Asp${o.aspect}`] || `${o.aspect}º`;
			lines.push(`行运${direct} 与 本命${natal} 成 ${asp} 相位，误差${round3(o.delta)}`);
		});
	});
	return lines;
}

export function buildPredictiveSnapshotText(natalChartObj, params, result){
	const lines = [];

	lines.push('[星盘信息]');
	const starLines = buildStarInfoLines(natalChartObj);
	if(starLines.length){
		lines.push(...starLines);
	}else{
		lines.push('无');
	}

	lines.push('');
	lines.push('[起盘信息]');
	const setupLines = buildSetupLines(params);
	if(setupLines.length){
		lines.push(...setupLines);
	}else{
		lines.push('无');
	}

	lines.push('');
	lines.push('[相位]');
	const aspectLines = buildAspectLines(result, natalChartObj);
	if(aspectLines.length){
		lines.push(...aspectLines);
	}else{
		lines.push('无');
	}

	return lines.join('\n');
}
