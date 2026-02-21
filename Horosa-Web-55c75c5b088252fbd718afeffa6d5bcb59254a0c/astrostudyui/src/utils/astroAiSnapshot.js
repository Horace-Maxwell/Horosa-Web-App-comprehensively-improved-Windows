import * as AstroConst from '../constants/AstroConst';
import * as AstroText from '../constants/AstroText';
import {
	appendPlanetMetaName,
	readPlanetMetaDisplayFromStore,
} from './planetMetaDisplay';

export const ASTRO_AI_SNAPSHOT_KEY = 'horosa.ai.snapshot.astro.v1';

function isEncodedToken(text){
	return /^[A-Za-z0-9${}]$/.test((text || '').trim());
}

let snapshotPlanetMetaSources = null;
let snapshotPlanetMetaDisplay = null;
const SNAPSHOT_PLANET_META_DISPLAY = {
	showPostnatal: 1,
	showHouse: 1,
	showRuler: 1,
};

function withPlanetMetaContext(chartObj, fn){
	const prevSources = snapshotPlanetMetaSources;
	const prevDisplay = snapshotPlanetMetaDisplay;
	snapshotPlanetMetaSources = chartObj || null;
	snapshotPlanetMetaDisplay = SNAPSHOT_PLANET_META_DISPLAY;
	try{
		return fn();
	}finally{
		snapshotPlanetMetaSources = prevSources;
		snapshotPlanetMetaDisplay = prevDisplay;
	}
}

function msgRaw(id){
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

function msg(id){
	const base = msgRaw(id);
	return appendPlanetMetaName(base, id, snapshotPlanetMetaSources, snapshotPlanetMetaDisplay);
}

function round3(val){
	if(val === undefined || val === null || Number.isNaN(Number(val))){
		return '';
	}
	return `${Math.round(Number(val) * 1000) / 1000}`;
}

function splitDegree(degree){
	let deg = Number(degree);
	if(Number.isNaN(deg)){
		return [0, 0];
	}
	const negative = deg < 0;
	deg = Math.abs(deg);
	let d = Math.floor(deg);
	let minute = Math.floor((deg - d) * 60);
	if(minute >= 60){
		d += 1;
		minute = 0;
	}
	if(negative){
		d = -d;
	}
	return [d, minute];
}

function whichTerm(sign, deg){
	const terms = AstroConst.EGYPTIAN_TERMS[sign];
	if(!terms || terms.length === 0){
		return '';
	}
	for(let i=0; i<terms.length; i++){
		const item = terms[i];
		if(item[1] <= deg && item[2] > deg){
			return msg(item[0]);
		}
	}
	return '';
}

function formatSignDegree(sign, signlon){
	if(signlon === undefined || signlon === null || sign === undefined || sign === null){
		return '';
	}
	const sd = splitDegree(signlon);
	const deg = Math.abs(sd[0]);
	const minute = Math.abs(sd[1]);
	const term = whichTerm(sign, deg);
	return `${deg}˚${msg(sign)}${minute}分；位于 ${term} 界`;
}

function lonToSignDegree(lon){
	if(lon === undefined || lon === null || Number.isNaN(Number(lon))){
		return '';
	}
	let value = Number(lon) % 360;
	if(value < 0){
		value += 360;
	}
	const signIdx = Math.floor(value / 30) % 12;
	const sign = AstroConst.LIST_SIGNS[signIdx];
	const signlon = value - signIdx * 30;
	return formatSignDegree(sign, signlon);
}

function fieldValue(fields, key){
	if(!fields){
		return null;
	}
	const f = fields[key];
	if(f && f.value !== undefined){
		return f.value;
	}
	return f !== undefined ? f : null;
}

function asNameList(ids){
	if(!ids || ids.length === 0){
		return '';
	}
	return ids.map((id)=>msg(id)).filter(Boolean).join(' , ');
}

function getObjectsMap(chartObj){
	const map = {};
	const chart = chartObj && chartObj.chart ? chartObj.chart : null;
	if(chart && chart.objects){
		for(let i=0; i<chart.objects.length; i++){
			const obj = chart.objects[i];
			map[obj.id] = obj;
		}
	}
	if(chartObj && chartObj.lots){
		for(let i=0; i<chartObj.lots.length; i++){
			const obj = chartObj.lots[i];
			map[obj.id] = obj;
		}
	}
	return map;
}

function getStarsMap(chartObj){
	const map = {};
	const chart = chartObj && chartObj.chart ? chartObj.chart : null;
	if(!chart || !chart.stars){
		return map;
	}
	for(let i=0; i<chart.stars.length; i++){
		const star = chart.stars[i];
		map[star.id] = star.stars || [];
	}
	return map;
}

function dignityText(ary){
	if(!ary || ary.length === 0){
		return '游走';
	}
	return ary.map((item)=>msg(item)).join('，');
}

function formatSpeed(obj){
	if(!obj){
		return '';
	}
	let speed = `${round3(obj.lonspeed)}度`;
	if(obj.lonspeed < 0){
		speed += '；逆行';
	}
	const deltaSpeed = Math.abs((obj.lonspeed || 0) - (obj.meanSpeed || 0));
	if(deltaSpeed > 1){
		speed += obj.lonspeed > obj.meanSpeed ? '; 快速' : '; 慢速';
	}else if(obj.lonspeed < 0.003 && obj.lonspeed > 0){
		speed += '; 停滞';
	}else{
		speed += '; 平均';
	}
	return speed;
}

function ruleshipText(arr){
	if(!arr || arr.length === 0){
		return '';
	}
	return arr.map((item)=>msg(item)).join('+');
}

function aspectText(asp){
	if(asp === undefined || asp === null){
		return '';
	}
	const n = Number(asp);
	if(Number.isNaN(n)){
		return `${asp}`;
	}
	return `${n}˚`;
}

function formatStarsLines(stars){
	if(!stars || stars.length === 0){
		return [];
	}
	const lines = [];
	for(let i=0; i<stars.length; i++){
		const item = stars[i];
		const sname = item.length > 4 ? item[4] : msg(item[0]);
		const deg = splitDegree(item[2]);
		lines.push(`${sname}：${Math.abs(deg[0])}˚${msg(item[1])}${Math.abs(deg[1])}分`);
	}
	return lines;
}

function buildBaseInfoLines(chartObj, fields){
	const lines = [];
	const chart = chartObj && chartObj.chart ? chartObj.chart : {};
	const params = chartObj && chartObj.params ? chartObj.params : {};
	const lon = fieldValue(fields, 'lon') || params.lon || '';
	const lat = fieldValue(fields, 'lat') || params.lat || '';
	const zone = params.zone !== undefined && params.zone !== null ? params.zone : fieldValue(fields, 'zone');

	if(lon || lat){
		lines.push(`经度：${lon}， 纬度：${lat}`);
	}
	if(params.birth){
		lines.push(params.birth + (chart.dayofweek ? ` ${chart.dayofweek}` : ''));
	}
	if(zone !== undefined && zone !== null){
		lines.push(`时区：${zone} ，${chart.isDiurnal ? '日生盘' : '夜生盘'}`);
	}
	if(chart.nongli && chart.nongli.birth){
		lines.push(`真太阳时：${chart.nongli.birth}`);
	}

	const zodiacal = chart.zodiacal || AstroConst.ZODIACAL[fieldValue(fields, 'zodiacal')];
	const hsys = chart.hsys || AstroConst.HouseSys[fieldValue(fields, 'hsys')];
	if(zodiacal || hsys){
		lines.push(`${msg(zodiacal)}，${msg(hsys)}`);
	}

	if(chart.dayerStar){
		lines.push(`日主星：${msg(chart.dayerStar)}`);
	}
	if(chart.timerStar){
		lines.push(`时主星：${msg(chart.timerStar)}`);
	}
	return lines;
}

export function buildHouseCuspLines(chartObj){
	return withPlanetMetaContext(chartObj, ()=>{
		const lines = [];
		const chart = chartObj && chartObj.chart ? chartObj.chart : {};
		const houses = chart.houses || [];
		for(let i=0; i<houses.length; i++){
			const h = houses[i];
			if(!h || h.lon === undefined || h.lon === null){
				continue;
			}
			lines.push(`${msg(h.id)} 宫头：${lonToSignDegree(h.lon)}`);
		}
		return lines;
	});
}

export function buildStarAndLotPositionLines(chartObj){
	return withPlanetMetaContext(chartObj, ()=>{
		const lines = [];
		const objectMap = getObjectsMap(chartObj);
		const pushOne = (id)=>{
			const obj = objectMap[id];
			if(!obj || obj.sign === undefined || obj.signlon === undefined){
				return;
			}
			lines.push(`${msg(id)}：${formatSignDegree(obj.sign, obj.signlon)}`);
		};

		AstroConst.LIST_OBJECTS.forEach((id)=>pushOne(id));
		AstroConst.LOTS.forEach((id)=>pushOne(id));

		return lines;
	});
}

export function buildInfoSection(chartObj, fields){
	return withPlanetMetaContext(chartObj, ()=>{
		const lines = [];
		const chart = chartObj && chartObj.chart ? chartObj.chart : {};
		const chartData = chartObj || {};
		const planetMap = getObjectsMap(chartObj);

		lines.push(...buildBaseInfoLines(chartObj, fields));

		const anti = chart.antiscias || {};
		const antiLines = [];
		(anti.antiscia || []).forEach((item)=>{
			antiLines.push(`${msg(item[0])} 与 ${msg(item[1])} 成映点 误差${round3(item[2])}`);
		});
		(anti.cantiscia || []).forEach((item)=>{
			antiLines.push(`${msg(item[0])} 与 ${msg(item[1])} 成反映点 误差${round3(item[2])}`);
		});
		if(antiLines.length){
			lines.push('映点/反映点');
			lines.push(...antiLines);
		}

		const receptions = chartData.receptions || {};
		if((receptions.normal || []).length || (receptions.abnormal || []).length){
			lines.push('接纳');
			lines.push('正接纳：');
			(receptions.normal || []).forEach((item)=>{
				lines.push(`${msg(item.beneficiary)} 被 ${msg(item.supplier)} 接纳 (${ruleshipText(item.supplierRulerShip)})`);
			});
			lines.push('邪接纳：');
			(receptions.abnormal || []).forEach((item)=>{
				lines.push(`${msg(item.beneficiary)} (${ruleshipText(item.beneficiaryDignity)}) 被 ${msg(item.supplier)} 接纳 (${ruleshipText(item.supplierRulerShip)})`);
			});
		}

		const mutuals = chartData.mutuals || {};
		if((mutuals.normal || []).length || (mutuals.abnormal || []).length){
			lines.push('互容');
			lines.push('正互容：');
			(mutuals.normal || []).forEach((item)=>{
				lines.push(`${msg(item.planetA.id)} (${ruleshipText(item.planetA.rulerShip)}) 与 ${msg(item.planetB.id)} (${ruleshipText(item.planetB.rulerShip)}) 互容`);
			});
			lines.push('邪互容：');
			(mutuals.abnormal || []).forEach((item)=>{
				lines.push(`${msg(item.planetA.id)} (${ruleshipText(item.planetA.rulerShip)}) 与 ${msg(item.planetB.id)} (${ruleshipText(item.planetB.rulerShip)}) 互容`);
			});
		}

		const surround = chartData.surround || {};
		const attacks = surround.attacks || {};
		const attackLines = [];
		Object.keys(attacks).forEach((key)=>{
			const planet = attacks[key];
			const candidates = [];
			if(planet.MinDelta && planet.MinDelta.length === 2){
				candidates.push(planet.MinDelta);
			}
			if(planet.MarsSaturn && planet.MarsSaturn.length === 2){
				candidates.push(planet.MarsSaturn);
			}
			if(planet.SunMoon && planet.SunMoon.length === 2){
				candidates.push(planet.SunMoon);
			}
			if(planet.VenusJupiter && planet.VenusJupiter.length === 2){
				candidates.push(planet.VenusJupiter);
			}
			candidates.forEach((pair)=>{
				attackLines.push(
					`${msg(key)} 被 ${msg(pair[0].id)} (通过${aspectText(pair[0].aspect)}相位) 与 ${msg(pair[1].id)} (通过${aspectText(pair[1].aspect)}相位) 围攻`
				);
			});
		});
		if(attackLines.length){
			lines.push('光线围攻');
			lines.push(...attackLines);
		}

		const houses = surround.houses || {};
		const houseLines = [];
		Object.keys(houses).forEach((key)=>{
			const pair = houses[key];
			if(pair && pair.length === 2){
				houseLines.push(`${msg(pair[0].id)} 与 ${msg(pair[1].id)} 夹 ${msg(key)}`);
			}
		});
		if(houseLines.length){
			lines.push('夹宫');
			lines.push(...houseLines);
		}

		const planets = surround.planets || {};
		const planetLines = [];
		Object.keys(planets).forEach((key)=>{
			const pair = planets[key];
			if(key === 'BySunMoon' && pair && pair.id){
				planetLines.push(`${msg(AstroConst.MOON)} 与 ${msg(AstroConst.SUN)} 夹 ${msg(pair.id)}`);
				return;
			}
			if(pair && pair.SunMoon && pair.SunMoon.length === 2){
				planetLines.push(`${msg(pair.SunMoon[0].id)} 与 ${msg(pair.SunMoon[1].id)} 夹 ${msg(key)}`);
				return;
			}
			if(pair && pair.length === 2){
				planetLines.push(`${msg(pair[0].id)} 与 ${msg(pair[1].id)} 夹 ${msg(key)}`);
			}
		});
		if(planetLines.length){
			lines.push('夹星');
			lines.push(...planetLines);
		}

		const declParallel = chartData.declParallel || {};
		const parallelLines = [];
		(declParallel.parallel || []).forEach((ids, idx)=>{
			parallelLines.push(`平行星体${idx + 1}：${asNameList(ids)}`);
		});
		Object.keys(declParallel.contraParallel || {}).forEach((id)=>{
			const ids = declParallel.contraParallel[id] || [];
			if(ids.length){
				parallelLines.push(`相对 ${msg(id)} 星体：${asNameList(ids)}`);
			}
		});
		if(parallelLines.length){
			lines.push('纬照');
			lines.push(...parallelLines);
		}

		Object.keys(planetMap).forEach((id)=>{
			planetMap[id].__name = msg(id);
		});
		return lines;
	});
}

function buildAspectSection(chartObj){
	const lines = [];
	const aspects = chartObj && chartObj.aspects ? chartObj.aspects : {};
	const normal = aspects.normalAsp || {};
	const immediate = aspects.immediateAsp || {};
	const signAsp = aspects.signAsp || {};

	lines.push('标准相位');
	AstroConst.LIST_POINTS.forEach((id)=>{
		const one = normal[id];
		if(!one){
			return;
		}
		lines.push(msg(id));
		(one.Applicative || []).forEach((asp)=>{
			lines.push(`${aspectText(asp.asp)} ${msg(asp.id)} 入相 误差${round3(asp.orb)}`);
		});
		(one.Exact || []).forEach((asp)=>{
			lines.push(`${aspectText(asp.asp)} ${msg(asp.id)} 离相 误差${round3(asp.orb)}`);
		});
		(one.Separative || []).forEach((asp)=>{
			lines.push(`${aspectText(asp.asp)} ${msg(asp.id)} 离相 误差${round3(asp.orb)}`);
		});
		(one.None || []).forEach((asp)=>{
			lines.push(`${aspectText(asp.asp)} ${msg(asp.id)} 误差${round3(asp.orb)}`);
		});
	});

	lines.push('立即相位');
	AstroConst.LIST_OBJECTS.forEach((id)=>{
		const one = immediate[id];
		if(!one || one.length < 2){
			return;
		}
		lines.push(`${msg(id)} ${aspectText(one[0].asp)} ${msg(one[0].id)} 离相 误差${round3(one[0].orb)}；${aspectText(one[1].asp)} ${msg(one[1].id)} 入相 误差${round3(one[1].orb)}`);
	});

	lines.push('星座相位');
	AstroConst.LIST_OBJECTS.forEach((id)=>{
		const one = signAsp[id];
		if(!one || !one.length){
			return;
		}
		lines.push(`主体：${msg(id)}`);
		one.forEach((asp)=>{
			lines.push(`与 ${msg(asp.id)} 成 ${aspectText(asp.asp)} 相位`);
		});
	});

	return lines;
}

function buildPlanetSection(chartObj){
	const lines = [];
	const chart = chartObj && chartObj.chart ? chartObj.chart : {};
	const objectMap = getObjectsMap(chartObj);
	const starsMap = getStarsMap(chartObj);
	const orientOccident = chart.orientOccident || {};

	AstroConst.LIST_OBJECTS.forEach((id)=>{
		const obj = objectMap[id];
		if(!obj){
			return;
		}
		lines.push(msg(id));
		lines.push(`落座：${formatSignDegree(obj.sign, obj.signlon)}`);
		if(obj.house){
			lines.push(`落宫：${msg(obj.house)}`);
		}
		if(obj.antisciaPoint){
			lines.push(`映点：${formatSignDegree(obj.antisciaPoint.sign, obj.antisciaPoint.signlon)}`);
		}
		if(obj.cantisciaPoint){
			lines.push(`反映点：${formatSignDegree(obj.cantisciaPoint.sign, obj.cantisciaPoint.signlon)}`);
		}
		if(obj.meanSpeed !== undefined){
			lines.push(`平均速度：${round3(obj.meanSpeed)}`);
		}
		if(obj.lonspeed !== undefined){
			lines.push(`当前速度：${formatSpeed(obj)}`);
		}
		if(obj.selfDignity){
			let dg = dignityText(obj.selfDignity);
			if(obj.hayyiz && obj.hayyiz !== 'None'){
				dg += `，${msg(obj.hayyiz)}`;
			}
			if(obj.isVOC){
				dg += '，空亡';
			}
			lines.push(`禀赋：${dg}`);
		}
		if(obj.score !== undefined){
			lines.push(`分值：${obj.score}`);
		}
		if(obj.altitudeTrue !== undefined){
			lines.push(`真地平纬度：${round3(obj.altitudeTrue)}˚`);
		}
		if(obj.altitudeAppa !== undefined){
			lines.push(`视地平纬度：${round3(obj.altitudeAppa)}˚`);
		}
		if(obj.azimuth !== undefined){
			lines.push(`地坪经度：${round3(obj.azimuth)}˚`);
		}
		if(obj.lon !== undefined){
			lines.push(`黄经：${round3(obj.lon)}˚`);
		}
		if(obj.lat !== undefined){
			lines.push(`黄纬：${round3(obj.lat)}˚`);
		}
		if(obj.ra !== undefined){
			lines.push(`赤经：${round3(obj.ra)}˚`);
		}
		if(obj.decl !== undefined){
			lines.push(`赤纬：${round3(obj.decl)}˚`);
		}
		if(obj.moonPhase !== undefined){
			lines.push(`月限：${msg(obj.moonPhase)}`);
		}
		if(obj.sunPos !== undefined){
			lines.push(`太阳关系：${msg(obj.sunPos)}`);
		}
		if(obj.ruleHouses && obj.ruleHouses.length){
			lines.push(`入垣宫：${asNameList(obj.ruleHouses)}`);
		}
		if(obj.exaltHouse){
			lines.push(`擢升宫：${msg(obj.exaltHouse)}`);
		}
		if(obj.governSign){
			let govern = msg(obj.governSign);
			if(obj.governPlanets && obj.governPlanets.length){
				govern += ` , ${asNameList(obj.governPlanets)}`;
			}
			lines.push(`宰制星座：${govern}`);
		}

		const occ = orientOccident[id];
		if(occ){
			const oc = (occ.occidental || []).map((x)=>x.id);
			const or = (occ.oriental || []).map((x)=>x.id);
			lines.push(`东出星：${asNameList(or)}`);
			lines.push(`西入星：${asNameList(oc)}`);
		}

		const stars = starsMap[id] || [];
		if(stars.length){
			lines.push('汇合恒星：');
			lines.push(...formatStarsLines(stars));
		}
	});

	return lines;
}

function buildLotsSection(chartObj){
	const lines = [];
	const objectMap = getObjectsMap(chartObj);
	const starsMap = getStarsMap(chartObj);

	AstroConst.LOTS.forEach((id)=>{
		const obj = objectMap[id];
		if(!obj){
			return;
		}
		lines.push(msg(id));
		lines.push(`落座：${formatSignDegree(obj.sign, obj.signlon)}`);
		if(obj.house){
			lines.push(`落宫：${msg(obj.house)}`);
		}
		const stars = starsMap[id] || [];
		if(stars.length){
			lines.push('汇合恒星：');
			lines.push(...formatStarsLines(stars));
		}
	});

	return lines;
}

function buildPossibilitySection(chartObj){
	const lines = [];
	const predict = chartObj && chartObj.predict ? chartObj.predict : {};
	const planetSign = predict.PlanetSign || {};
	Object.keys(planetSign).forEach((key)=>{
		lines.push(msg(key));
		const items = planetSign[key] || [];
		items.forEach((txt)=>lines.push(`${txt}`));
	});
	return lines;
}

function buildSectionText(title, lines){
	const clean = (lines || []).map((line)=>`${line}`.trim()).filter(Boolean);
	if(clean.length === 0){
		return '';
	}
	return `[${title}]\n${clean.join('\n')}`;
}

export function createAstroSnapshotSignature(chartObj, fields){
	const chart = chartObj && chartObj.chart ? chartObj.chart : {};
	const params = chartObj && chartObj.params ? chartObj.params : {};
	const lon = fieldValue(fields, 'lon') || params.lon || '';
	const lat = fieldValue(fields, 'lat') || params.lat || '';
	const zone = params.zone !== undefined && params.zone !== null ? params.zone : fieldValue(fields, 'zone');
	const birth = params.birth || '';
	const zodiacal = chart.zodiacal || AstroConst.ZODIACAL[fieldValue(fields, 'zodiacal')] || '';
	const hsys = chart.hsys || AstroConst.HouseSys[fieldValue(fields, 'hsys')] || '';
	const chartId = chartObj && chartObj.chartId ? chartObj.chartId : '';
	const display = readPlanetMetaDisplayFromStore();
	return [
		chartId,
		birth,
		zone,
		lon,
		lat,
		zodiacal,
		hsys,
		chart.isDiurnal ? '1' : '0',
		display.showPostnatal,
		display.showHouse,
		display.showRuler,
	].join('|');
}

export function buildAstroSnapshotContent(chartObj, fields){
	if(!chartObj || !chartObj.chart){
		return '';
	}
	return withPlanetMetaContext(chartObj, ()=>{
		const sections = [];
		sections.push(buildSectionText('起盘信息', buildBaseInfoLines(chartObj, fields)));
		sections.push(buildSectionText('宫位宫头', buildHouseCuspLines(chartObj)));
		sections.push(buildSectionText('星与虚点', buildStarAndLotPositionLines(chartObj)));
		sections.push(buildSectionText('信息', buildInfoSection(chartObj, fields)));
		sections.push(buildSectionText('相位', buildAspectSection(chartObj)));
		sections.push(buildSectionText('行星', buildPlanetSection(chartObj)));
		sections.push(buildSectionText('希腊点', buildLotsSection(chartObj)));
		sections.push(buildSectionText('可能性', buildPossibilitySection(chartObj)));
		return sections.filter(Boolean).join('\n\n').trim();
	});
}

export function saveAstroAISnapshot(chartObj, fields){
	try{
		if(typeof window === 'undefined' || !window.localStorage){
			return null;
		}
		const content = buildAstroSnapshotContent(chartObj, fields);
		if(!content){
			return null;
		}
		const payload = {
			version: 1,
			createdAt: new Date().toISOString(),
			signature: createAstroSnapshotSignature(chartObj, fields),
			chartId: chartObj && chartObj.chartId ? chartObj.chartId : null,
			content: content,
		};
		window.localStorage.setItem(ASTRO_AI_SNAPSHOT_KEY, JSON.stringify(payload));
		return payload;
	}catch(e){
		return null;
	}
}

export function loadAstroAISnapshot(){
	try{
		if(typeof window === 'undefined' || !window.localStorage){
			return null;
		}
		const raw = window.localStorage.getItem(ASTRO_AI_SNAPSHOT_KEY);
		if(!raw){
			return null;
		}
		const obj = JSON.parse(raw);
		if(!obj || !obj.content){
			return null;
		}
		return obj;
	}catch(e){
		return null;
	}
}

export function getAstroAISnapshotForCurrent(chartObj, fields){
	const snap = loadAstroAISnapshot();
	if(!snap){
		return null;
	}
	if(!chartObj){
		return snap;
	}
	const sig = createAstroSnapshotSignature(chartObj, fields);
	if(snap.signature !== sig){
		return null;
	}
	return snap;
}
