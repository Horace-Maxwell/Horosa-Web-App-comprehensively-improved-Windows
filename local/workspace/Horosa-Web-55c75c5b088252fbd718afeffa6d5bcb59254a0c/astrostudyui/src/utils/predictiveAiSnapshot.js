import * as AstroConst from '../constants/AstroConst';
import * as AstroText from '../constants/AstroText';
import {
	buildHouseCuspLines,
	buildStarAndLotPositionLines,
	buildInfoSection,
	buildPredictiveBirthLines,
	buildMethodNoteLines,
} from './astroAiSnapshot';
import { appendPlanetHouseInfoById, } from './planetHouseInfo';
const DEFAULT_PLANET_INFO_EXPORT = {
	showHouse: 1,
	showRuler: 1,
};
const PLANET_HOUSE_INFO_NOTE = '说明：行星名后括号中的 nR 为宫主宫位标记；逆行会明确写为“逆行”。';

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

function normalizeAiPlanetLabel(text){
	return `${text || ''}`.replace(/(\d+)R\s*\(宫主\)/g, '$1R');
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
	if(zodiacalRaw){
		const ayanKey = params.siderealAyanamsa || (chart && chart.siderealAyanamsa) || '';
		lines.push(`黄道：${AstroConst.zodiacalDisplayText(zodiacalRaw, ayanKey)}`);
	}
	const hsys = AstroConst.HouseSys[`${params.hsys}`] || chart.hsys;
	if(hsys){
		lines.push(`宫制：${hsys}`);
	}
	if(chart.isDiurnal !== undefined && chart.isDiurnal !== null){
		lines.push(`盘型：${chart.isDiurnal ? '日生盘' : '夜生盘'}`);
	}
	lines.push(PLANET_HOUSE_INFO_NOTE);

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
	// 恒星黄道时标注具体 ayanāṃśa（与主命盘快照口径一致，让 AI 明确知道是 Raman/Fagan 等而非默认 Lahiri）。
	// 仅恒星盘追加此行 → 回归盘输出逐字不变（向后兼容）。
	if(`${p.zodiacal}` === '1'){
		lines.push(`黄道：${AstroConst.zodiacalDisplayText(p.zodiacal, p.siderealAyanamsa)}`);
	}
	return lines;
}

function buildAspectLines(result, natalChartObj){
	const lines = [];
	const chart = result && result.chart ? result.chart : {};
	const aspects = Array.isArray(chart.aspects) ? chart.aspects : [];
	aspects.forEach((item)=>{
		const directId = item.directId || item.id;
		const direct = appendPlanetHouseInfoById(
			msg(directId),
			result,
			directId,
			DEFAULT_PLANET_INFO_EXPORT
		);
		const directTxt = normalizeAiPlanetLabel(direct);
		const objs = Array.isArray(item.objects) ? item.objects : [];
		objs.forEach((o)=>{
			const natalId = o.natalId || o.id;
			const natal = appendPlanetHouseInfoById(
				msg(natalId),
				natalChartObj,
				natalId,
				DEFAULT_PLANET_INFO_EXPORT
			);
			const natalTxt = normalizeAiPlanetLabel(natal);
			const asp = AstroText.AstroTxtMsg[`Asp${o.aspect}`] || `${o.aspect}º`;
			lines.push(`行运${directTxt} 与 本命${natalTxt} 成 ${asp} 相位，误差${round3(o.delta)}`);
		});
	});
	return lines;
}

// 时段盘(推运/返照/向运)本身的星盘配置:行星落座 + 宫位宫头。
// 取 result.dirChart(完整时段盘 chartObj)优先,退回 result(其 chart.objects 即时段盘行星)。
function buildDirectedChartLines(result){
	const lines = [];
	const directed = (result && result.dirChart) ? result.dirChart : result;
	if(!directed){
		return lines;
	}
	const starLotLines = buildStarAndLotPositionLines(directed);
	if(starLotLines.length){
		lines.push('时段盘 星与虚点');
		lines.push(...starLotLines);
	}
	const houseLines = buildHouseCuspLines(directed);
	if(houseLines.length){
		lines.push('时段盘 宫位宫头');
		lines.push(...houseLines);
	}
	return lines;
}

// [YB] 第 4 参 methodKey(profection/solararc/solarreturn/lunarreturn/givenyear):出 [方法说明] 段;
// 缺省不出段(向前兼容)。生辰行并入 [本命盘配置] 段头部(此前只有星位无生辰,AI 不知在分析谁;
// 不新开 [起盘信息] 段——本函数既有 [起盘信息] 承载的是推运时间语义,撞名会被段过滤误并)。
export function buildPredictiveSnapshotText(natalChartObj, params, result, methodKey){
	const lines = [];

	lines.push('[本命盘配置]');
	const birthLines = buildPredictiveBirthLines(natalChartObj);
	if(birthLines.length){
		lines.push(...birthLines);
	}
	const starLines = buildStarInfoLines(natalChartObj);
	if(starLines.length){
		lines.push(...starLines);
	}else if(!birthLines.length){
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
	lines.push('[时段盘配置]');
	const directedLines = buildDirectedChartLines(result);
	if(directedLines.length){
		lines.push(...directedLines);
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

	const methodLines = buildMethodNoteLines(methodKey);
	if(methodLines.length){
		lines.push('');
		lines.push(...methodLines);
	}

	return lines.join('\n');
}
