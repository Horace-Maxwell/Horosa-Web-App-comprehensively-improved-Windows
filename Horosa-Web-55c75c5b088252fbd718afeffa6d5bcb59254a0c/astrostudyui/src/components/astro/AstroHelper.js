import * as d3 from 'd3';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import {detectOS, printArea, distanceInCircleAbs} from '../../utils/helper';

const ChartMargin = 20;
const ChartMarginDelta = 55;
const ChartMoveUp = 10;

let TxtOffsetTop = 0;
let rThreshold = 100;
let osFlag = detectOS();
if(osFlag === 'Mac'){
	TxtOffsetTop = 2;
}

export function whichTerm(sign, deg){
	let ary = AstroConst.EGYPTIAN_TERMS[sign];
	for(let i=0; i<ary.length; i++){
		let term = ary[i];
		if(term[1] <= deg && term[2] > deg){
			let itm = term[0];
			return AstroText.AstroMsg[itm];
		}
	}
	return '未知';
}

export function splitDegree(degree){
	let res = [];
	let degstr = degree + '';
	degstr = degstr.toLowerCase();
	let parts = degstr.split('e');
	let deg = parseFloat(degree + '');
	res[0] = parseInt(degree + '');
	let neg = false;
	if(deg < 0){
		neg = true;
		deg = Math.abs(deg);
		res[0] = Math.abs(res[0]);
	}

	if(parts.length === 2 && parseInt(parts[1]) < 0){
		res[0] = 0;
		deg = 0;
	}
	let minute = (deg - res[0]) * 60;
	res[1] = parseInt(Math.floor(minute) + '');
	let sec = (minute - res[1]) * 60;
	res[2] = parseInt(Math.round(sec) + '');
	if(res[2] === 60){
		res[1] = res[1] + 1;
		res[2] = 0;
	}
	if(res[1] === 60){
		res[0] = res[0] + 1;
		res[1] = 0;
	}
	if(neg){
		res[0] = 0 - res[0];
		res[3] = ['-'];
	}
	return res;
}

export function convertLatToStr(degree){
	let deg = splitDegree(degree);
	let latdeg = deg[0] >= 0 ? deg[0] : -deg[0];
	let latmin = deg[1] >= 0 ? deg[1] : -deg[1];
	let dir = deg[0] >= 0 ? 'n' : 's';
	latmin = latmin > 10 ? latmin : '0' + latmin;
	return latdeg + dir + latmin;
}

export function convertLonToStr(degree){
	let deg = splitDegree(degree);
	let londeg = deg[0] >= 0 ? deg[0] : -deg[0];
	let lonmin = deg[1] >= 0 ? deg[1] : -deg[1];
	let dir = deg[0] >= 0 ? 'e' : 'w';
	lonmin = lonmin > 10 ? lonmin : '0' + lonmin;
	return londeg + dir + lonmin;
}

export function convertLatStrToDegree(lat){
	if(lat === undefined || lat === null){
		return null;
	}
	let positive = 1;
	let latstr = lat.toLowerCase();
	let parts = latstr.split('n');
	if(parts.length === 1){
		parts = latstr.split('s');
		positive = -1;
	}
	let min = parts[1];
	if(parts[1].length === 2){
		if(parts[1].substr(0, 1) === '0'){
			min = min.substr(1);
		}
		min = parseInt(min);
	}else{
		min = parseInt(min) * 10;
	}

	let deg = parseInt(parts[0]);
	if(min !== 0){
		deg = deg + (1.0 / min);
	}
	return deg * positive;
}

export function convertLonStrToDegree(lon){
	if(lon === undefined || lon === null){
		return null;
	}
	let positive = 1;
	let lonstr = lon.toLowerCase();
	let parts = lonstr.split('e');
	if(parts.length === 1){
		parts = lonstr.split('w');
		positive = -1;
	}

	let min = parts[1];
	if(parts[1].length === 2){
		if(parts[1].substr(0, 1) === '0'){
			min = min.substr(1);
		}
		min = parseInt(min);
	}else{
		min = parseInt(min) * 10;
	}

	let deg = parseInt(parts[0]);
	if(min !== 0){
		deg = deg + (1.0 / min);
	}
	return deg * positive;
}

export function getDignityText(ary){
	if(ary === undefined || ary === null){
		return null;
	}
	let res = ary.map((item)=>{
		return AstroText.AstroMsg[item];
	});
	return res.length === 0 ? '游走' : res.join('，');
}

export function getObjectsText(ary){
	if(ary === undefined || ary === null || ary.length === 0){
		return null;
	}
	let res = ary.map((item)=>{
		return AstroText.AstroMsg[item];
	});
	return res.join(' , ')
}

export function getHouse(chartObj, houseid){
	if(chartObj === undefined || chartObj === null || chartObj.err){
		return null;
	}
	if(chartObj.houseMap){
		return chartObj.houseMap[houseid];
	}
	chartObj.houseMap = {};
	for(let i=0; i<chartObj.chart.houses.length; i++ ){
		let house = chartObj.chart.houses[i];
		chartObj.houseMap[house.id] = house;
	}
	return chartObj.houseMap[houseid];
}

export function getStars(chartObj, objid){
	if(chartObj === undefined || chartObj === null || chartObj.err){
		return null;
	}
	if(chartObj.starMap){
		return chartObj.starMap[objid];
	}
	chartObj.starMap = {};
	for(let i = 0; i<chartObj.chart.stars.length; i++){
		let star = chartObj.chart.stars[i];
		chartObj.starMap[star.id] = star.stars
	}
	return chartObj.starMap[objid];
}

export function getObject(chartObj, objid){
	if(chartObj === undefined || chartObj === null || chartObj.err){
		return null;
	}
	if(chartObj.objectMap){
		return chartObj.objectMap[objid];
	}
	chartObj.objectMap = {};
	for(let i=0; i<chartObj.chart.objects.length; i++ ){
		let obj = chartObj.chart.objects[i];
		chartObj.objectMap[obj.id] = obj;
	}
	if(chartObj.lots){
		for(let i=0; i<chartObj.lots.length; i++ ){
			let obj = chartObj.lots[i];
			chartObj.objectMap[obj.id] = obj;
		}	
	}
	return chartObj.objectMap[objid];
}

export function getSu28(chartObj, suname){
	if(chartObj === undefined || chartObj === null || chartObj.err){
		return null;
	}
	if(chartObj.su28Map){
		return chartObj.su28Map[suname];
	}
	chartObj.su28Map = {};
	for(let i=0; i<chartObj.chart.fixedStarSu28.length; i++ ){
		let obj = chartObj.chart.fixedStarSu28[i];
		chartObj.su28Map[obj.name] = obj;
	}
	return chartObj.su28Map[suname];
}

export function getSu28Text(chartObj, planet){
	if(chartObj === undefined || chartObj === null || chartObj.err){
		return null;
	}
	let suname = planet.su28;
	let su = getSu28(chartObj, suname);
	if(su === undefined || su === null){
		return [];
	}
	let radeg = (planet.ra - su.ra + 360) % 360;
	let degs = splitDegree(radeg);
	let startxt = [];
	startxt[0] = '';
	startxt[1] = degs[0] + 'º';
	startxt[2] = planet.su28;
	startxt[3] = degs[1] + "'";	
	return startxt;
}

export function getSuHouse(chartObj, suid){
	if(chartObj === undefined || chartObj === null || chartObj.err){
		return null;
	}
	if(chartObj.suHouseMap){
		return chartObj.suHouseMap[suid];
	}
	chartObj.suHouseMap = {};
	for(let i=0; i<chartObj.guoStarSect.houses.length; i++ ){
		let house = chartObj.guoStarSect.houses[i];
		chartObj.suHouseMap[house.id] = house;
	}
	return chartObj.suHouseMap[suid];

}


export function signsBand(svg, r, rStep, flags, isDiurnal, house1Ang){
	let txtforward = (flags & AstroConst.CHART_TXTPLANETFORWARD) === 0 ? false : true;
	let samecolorwithsign = (flags & AstroConst.CHART_PLANETCOLORWITHSIGN) === 0 ? false : true;
	let needTrip = (flags & AstroConst.CHART_TRIP) === 0 ? false : true;
	let needRuler = (flags & AstroConst.CHART_SIGNRULER) === 0 ? false : true;
	let innerR = r - rStep;
	let txtPosR = r - rStep / 2 - TxtOffsetTop;

	let signs = svg.append('g');
	const signStep = 30 * Math.PI / 180;
	for(let i=0; i<12; i++){
		let ang = 30 * i;
		let a = signStep * i;
		let arc = d3.arc();
		let arcd = arc({
			innerRadius: innerR,
			outerRadius: r,
			startAngle: -a,
			endAngle: -(a + signStep),
		});
		let sig = AstroConst.LIST_SIGNS[i];
		let siggroup = signs.append('g');
		siggroup.append('path')
			.attr('d', arcd).attr('stroke', AstroConst.AstroColor.Stroke)
			.attr('fill', AstroConst.AstroColor.SignFill[sig]);

		let lblgroup = siggroup.append('g').attr("text-anchor", "middle");
		let txts = [
			AstroConst.SignsProp[sig].Ruler,
			sig
		];
		if(AstroConst.SignsProp[sig].Exalt){
			txts.push(AstroConst.SignsProp[sig].Exalt);
		}
		if(needRuler === false){
			txts = [sig];
		}
		if(needTrip){
			txts.push('三');
			if(isDiurnal){
				txts.push(AstroConst.SignsProp[sig].Trip[0]);
				txts.push(AstroConst.SignsProp[sig].Trip[1]);
			}else{
				txts.push(AstroConst.SignsProp[sig].Trip[1]);
				txts.push(AstroConst.SignsProp[sig].Trip[0]);
			}
			txts.push(AstroConst.SignsProp[sig].Trip[2]);
		}
		lblgroup.selectAll('text').data(txts).enter().append('text')
			.attr("dominant-baseline","middle")
			.attr("text-anchor", "middle")
			.attr('font-family', AstroConst.AstroChartFont)
			.attr('font-size', function(d, idx){
				if(d === sig){
					return 16;
				}
				return 12;
			})
			.attr('stroke', function(d, idx){
				if(samecolorwithsign){
					return AstroConst.AstroColor[sig]
				}else{
					return AstroConst.AstroColor[d]
				}
			})
			.attr('transform', function(d, idx){
				let posx = 0;
				let posy = 0;
				let tripidx = txts.indexOf('三');
				let angle = ang + 15;
				if(tripidx > 0){
					angle = angle + 5
				}
				let rad = angle * Math.PI / 180;
				let sigidx = txts.indexOf(sig);
				if(idx === sigidx){
					posx = -txtPosR * Math.sin(rad);
					posy = -txtPosR * Math.cos(rad);
				}else{
					let deltaIdx = sigidx - idx;
					if(tripidx > 0 && idx >= tripidx){
						angle = angle - 2 + deltaIdx*3;
					}else{
						angle = angle + deltaIdx*4;
					}
					rad = angle * Math.PI / 180;
					posx = -txtPosR * Math.sin(rad);
					posy = -txtPosR * Math.cos(rad);
				}
				let rotang = -angle;
				if(house1Ang !== undefined && house1Ang !== null && txtforward){
					// rotang = 90 - house1Ang;
				}
				let trans = 'translate(' + posx + ', ' + posy + ') rotate(' + rotang + ')';
				return trans;	
			})
			.text(function(d){return AstroText.AstroMsg[d]});
	}
	
	return signs;
}

export function termBand(svg, r, rStep, flags){
	let samecolorwithsign = (flags & AstroConst.CHART_PLANETCOLORWITHSIGN) === 0 ? false : true;
	let innerR = r - rStep;
	let txtPosR = r - rStep / 2 - TxtOffsetTop;

	let terms = svg.append('g');
	const signStep = 30;
	for(let i=0; i<12; i++){
		let sig = AstroConst.LIST_SIGNS[i];
		let sigterm = AstroConst.EGYPTIAN_TERMS[sig];
		let sigstart = signStep * i;
		for(let j=0; j<sigterm.length; j++){
			let term = sigterm[j];	
			let delta = term[2] - term[1];
			let stangle = (sigstart + term[1]) * Math.PI / 180;
			let edangle = delta * Math.PI / 180;		
			let arc = d3.arc()	
						.innerRadius(innerR).outerRadius(r)
						.startAngle(-stangle).endAngle(-(stangle + edangle));
			let arcd = arc();
			let termgroup = terms.append('g');
			termgroup.append('path')
				.attr('d', arcd).attr('stroke', AstroConst.AstroColor.Stroke)
				.attr('fill', AstroConst.AstroColor['NoColor']);

			let demiStep = (delta / 2) * Math.PI / 180;
			let lblgroup = termgroup.append('g').attr("text-anchor", "middle");
			let posx = -txtPosR * Math.sin(stangle + demiStep);
			let posy = -txtPosR * Math.cos(stangle + demiStep);
			let transtr = 'translate(' + posx + ',' + posy +  ')';
			lblgroup.attr('transform', transtr);
			let termtxt = AstroText.AstroMsg[term[0]];
			let color = AstroConst.AstroColor[term[0]];
			if(samecolorwithsign){
				color = AstroConst.AstroColor[sig];
			}
			let lbl = lblgroup.append('text')
					.attr("dominant-baseline","middle")
					.attr("text-anchor", "middle")
					.attr('font-family', AstroConst.AstroChartFont)
					.attr('font-size', 13).attr('font-weight', 100).attr('stroke', color)
					.text(termtxt);
			let txtang = -(term[1] + delta) - 30*i;
			let txtrot = 'rotate(' + txtang + ')';
			lbl.attr('transform', txtrot);		
		}

	}

	return terms;
}

export function su27Band(svg, r, rStep){
	let innerR = r - rStep;
	let txtPosR = r - rStep / 2;

	let terms = svg.append('g');
	for(let i=0; i<AstroConst.LIST_SU.length; i++){
		let sig = AstroConst.LIST_SU[i];
		let term = AstroConst.SU27[sig];
		let delta = term['size'];
		let stangle = term['lon'] * Math.PI / 180;
		let edangle = delta * Math.PI / 180;		
		let arc = d3.arc();
		let arcd = arc({
			innerRadius: innerR,
			outerRadius: r,
			startAngle: -stangle,
			endAngle: -(stangle + edangle)
		});
		let termgroup = terms.append('g');
		termgroup.append('path')
			.attr('d', arcd).attr('stroke', AstroConst.AstroColor.Stroke)
			.attr('fill', AstroConst.AstroColor['NoColor']);

		let demiStep = (delta / 2) * Math.PI / 180;
		let lblgroup = termgroup.append('g').attr("text-anchor", "middle");
		let posx = -txtPosR * Math.sin(stangle + demiStep);
		let posy = -txtPosR * Math.cos(stangle + demiStep);
		let transtr = 'translate(' + posx + ',' + posy +  ')';
		lblgroup.attr('transform', transtr);
		let termtxt = sig;
		let lbl = lblgroup.append('text')
				.attr("dominant-baseline","middle")
				.attr('stroke', AstroConst.AstroColor.Stroke)
				.attr("text-anchor", "middle")
				.attr('font-size', 16).attr('font-weight', 100)
				.text(termtxt);
		let txtang = -(term['lon'] + delta/2);
		let txtrot = 'rotate(' + txtang + ')';
		lbl.attr('transform', txtrot);		

	}

	return terms;
}

export function suRelationBand(svg, r, lifeSu, rStep){
	let startIdx = AstroConst.LIST_SU.indexOf(lifeSu);
	if(startIdx < 0){
		return null;
	}
	
	let innerR = r - rStep;
	let txtPosR = r - rStep / 2;

	let terms = svg.append('g');
	for(let i=0; i<AstroConst.LIST_SU_RELATION.length; i++){
		let idx = (startIdx + i) % AstroConst.LIST_SU.length;
		let surelation = AstroConst.LIST_SU_RELATION[i];
		let sig = AstroConst.LIST_SU[idx];
		let term = AstroConst.SU27[sig];
		let delta = term['size'];
		let stangle = term['lon'] * Math.PI / 180;
		let edangle = delta * Math.PI / 180;		
		let arc = d3.arc();
		let arcd = arc({
			innerRadius: innerR,
			outerRadius: r,
			startAngle: -stangle,
			endAngle: -(stangle + edangle)
		});
		let fillColor = AstroConst.AstroColor['NoColor'];
		if(i % 9 === 0){
			fillColor = AstroConst.AstroColor[surelation];
		}
		let termgroup = terms.append('g');
		termgroup.append('path')
			.attr('d', arcd).attr('stroke', AstroConst.AstroColor.Stroke)
			.attr('fill', fillColor);

		let demiStep = (delta / 2) * Math.PI / 180;
		let lblgroup = termgroup.append('g').attr("text-anchor", "middle");
		let posx = -txtPosR * Math.sin(stangle + demiStep);
		let posy = -txtPosR * Math.cos(stangle + demiStep);
		let transtr = 'translate(' + posx + ',' + posy +  ')';
		lblgroup.attr('transform', transtr);
		let termtxt = surelation;
		let lbl = lblgroup.append('text')
				.attr("dominant-baseline","middle")
				.attr('stroke', AstroConst.AstroColor.Stroke)
				.attr("text-anchor", "middle")
				.attr('font-size', 16).attr('font-weight', 100)
				.text(termtxt);
		let txtang = -(term['lon'] + delta/2);
		let txtrot = 'rotate(' + txtang + ')';
		lbl.attr('transform', txtrot);		

	}

	return terms;
}

export function suSixhouses(svg, r, rStep, chartObj){
	let innerR = r - rStep;
	let txtPosR = r - 10;

	let angstep = 360.0 / AstroConst.LIST_SU.length;
	let terms = svg.append('g');
	for(let i=0; i<AstroConst.LIST_SU.length; i++){
		let ang = angstep * i;
		let sig = AstroConst.LIST_SU[i];
		let suObj = getSuHouse(chartObj, sig);
		let term = AstroConst.SU27[sig];
		let delta = term['size'];
		let stangle = term['lon'] * Math.PI / 180;
		let edangle = delta * Math.PI / 180;		
		let arc = d3.arc();
		let arcd = arc({
			innerRadius: innerR,
			outerRadius: r,
			startAngle: -stangle,
			endAngle: -(stangle + edangle)
		});
		let termgroup = terms.append('g');
		let path = termgroup.append('path').attr('d', arcd);
		if(suObj.sixhouse){
			let fillcolor = AstroConst.AstroColor[suObj.sixhouse];
			if(fillcolor === undefined || fillcolor === null){
				fillcolor = AstroConst.AstroColor['SixHouses'];
			}
			path.attr('stroke', AstroConst.AstroColor.Stroke).attr('fill', fillcolor);
		}else{
			path.attr('stroke', AstroConst.AstroColor.Stroke).attr('fill', AstroConst.AstroColor['NoColor'])
		}

		let lblgroup = termgroup.append('g').attr("text-anchor", "middle");
		let termtxt = suObj.category;
		let txts = termtxt.split('');
		if(suObj.sixhouse){
			txts.push('(' + suObj.sixhouse + ')');
		}
		let lbl = lblgroup.selectAll('text').data(txts).enter().append('text')
				.attr("dominant-baseline","middle")
				.attr('stroke', AstroConst.AstroColor.Stroke)
				.attr("text-anchor", "middle")
				.attr('font-size', 11).attr('font-weight', 100)
				.attr('transform', function(d, idx){
					let posx = 0;
					let posy = 0;
					let angle = ang + angstep / 2.0 - 2;
					let rad = angle * Math.PI / 180;
					let centeridx = txts.length / 2;
					if(idx === centeridx){
						posx = -txtPosR * Math.sin(rad);
						posy = -txtPosR * Math.cos(rad);
					}else{
						let deltaIdx = centeridx - idx;
						angle = angle + deltaIdx*4;
						rad = angle * Math.PI / 180;
						posx = -txtPosR * Math.sin(rad);
						posy = -txtPosR * Math.cos(rad);
					}
					let rotang = -angle;
					let trans = 'translate(' + posx + ', ' + posy + ') rotate(' + rotang + ')';
					return trans;	
				})
				.text(function(d){return d});

	}

	return terms;

}

export function degreeOuterLines(svg, r){
	let long = r + 9;
	let medium = r + 6;
	let short = r + 3;
	let lines = svg.append('g');
	for(let i=0; i<360; i++){
		let x1 = r * Math.sin(-i * Math.PI / 180);
		let y1 = r * Math.cos(-i * Math.PI / 180);
		let x2 = 0;
		let y2 = 0;
		if(i % 10 === 0){
			x2 = long * Math.sin(-i * Math.PI / 180);
			y2 = long * Math.cos(-i * Math.PI / 180);
		}else if(i % 5 === 0){
			x2 = medium * Math.sin(-i * Math.PI / 180);
			y2 = medium * Math.cos(-i * Math.PI / 180);
		}else{
			x2 = short * Math.sin(-i * Math.PI / 180);
			y2 = short * Math.cos(-i * Math.PI / 180);
		}
		let line = lines.append('line').attr('stroke', AstroConst.AstroColor.Stroke);
		line.attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2);
	}
	return lines;
}

export function degreeInnerLines(svg, r){
	let long = r - 9;
	let medium = r - 6;
	let short = r - 3;
	let lines = svg.append('g');
	for(let i=0; i<360; i++){
		let x1 = r * Math.sin(-i * Math.PI / 180);
		let y1 = r * Math.cos(-i * Math.PI / 180);
		let x2 = 0;
		let y2 = 0;
		if(i % 10 === 0){
			x2 = long * Math.sin(-i * Math.PI / 180);
			y2 = long * Math.cos(-i * Math.PI / 180);
		}else if(i % 5 === 0){
			x2 = medium * Math.sin(-i * Math.PI / 180);
			y2 = medium * Math.cos(-i * Math.PI / 180);
		}else{
			x2 = short * Math.sin(-i * Math.PI / 180);
			y2 = short * Math.cos(-i * Math.PI / 180);
		}
		let line = lines.append('line').attr('stroke', AstroConst.AstroColor.Stroke);
		line.attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2);
	}
	return lines;
}



export function desposeStars(svg, chartObj, r, rStep, houses, objects, planetDisplay, flags, house1Ang, txtsu28){
	let samecolorwithsign = (flags & AstroConst.CHART_PLANETCOLORWITHSIGN) === 0 ? false : true;
	let txtforward = (flags & AstroConst.CHART_TXTPLANETFORWARD) === 0 ? false : true;
	let txtplanet = (flags & AstroConst.CHART_TXTPLANET) === 0 ? false : true;
	let degSet = [];

	let innerR = r - rStep;
	let txtPosR = r - 10 - TxtOffsetTop;

	let stars = svg.append('g');
	for(let i=0; i<houses.length; i++){
		let house = houses[i];
		let delta = house['size'];
		let stangle = house['lon'] * Math.PI / 180;
		let edangle = delta * Math.PI / 180;		
		let arc = d3.arc();
		let arcd = arc({
			innerRadius: innerR,
			outerRadius: r,
			startAngle: -stangle,
			endAngle: -(stangle + edangle)
		});
		let termgroup = stars.append('g');
		termgroup.append('path')
			.attr('d', arcd).attr('stroke', AstroConst.AstroColor.Stroke)
			.attr('fill', AstroConst.AstroColor.PlanetZoneFill[house.id]);
	}

	for(let i=0; i<objects.length; i++){
		let pnt = objects[i];
		let pntstr = pnt.id;
		if(!planetDisplay.has(pntstr)){
			continue;
		}
		let angoffset = r >= rThreshold ? 5 : 11;
		let tmplon = pnt.lon;
		if((degSet.length > 0 && distanceInCircleAbs(degSet[degSet.length-1], tmplon) < angoffset) || 
			(degSet.length > 0 && degSet[degSet.length-1] + angoffset > tmplon)){
			tmplon = degSet[degSet.length-1] + angoffset;
		}
		degSet.push(tmplon);
		pnt.poslon = tmplon;
		let lon = tmplon * Math.PI / 180;
		let lblgroup = stars.append('g').attr("text-anchor", "middle");

		let degs = splitDegree(pnt.signlon);
		let startxt = [];
		startxt[0] = AstroText.AstroMsg[pntstr];
		if(txtplanet){
			startxt[1] = degs[0] + 'º';
			startxt[2] = AstroText.AstroMsg[pnt.sign];
			startxt[3] = degs[1] + "'";	
		}
		if(pnt.lonspeed < 0){
			startxt.push(AstroText.AstroMsg['Retrograde']);
		}
		if(txtsu28){
			let sudegs = getSu28Text(chartObj, pnt);
			sudegs.map((itm, idx)=>{
				if(pnt.lonspeed < 0 && idx === 0){
					return null;
				}
				startxt.push(itm);
			});
		}

		lblgroup.selectAll('text').data(startxt).enter().append('text')
			.attr("dominant-baseline","middle")
			.attr("text-anchor", "middle")
			.attr('font-size', function(d, idx){
				if(idx === 0 || idx === 4 || (startxt.length === 2 && idx === 1)){
					return r >= rThreshold ? 15 : 13;
				}else if(idx === 2){
					return r >= rThreshold ? 13 : 10;
				}else{
					return r >= rThreshold ? 10 : 8;
				}
			})
			.attr('stroke', function(d, idx){
				if(samecolorwithsign){
					return AstroConst.AstroColor[pnt.sign];
				}else{
					return AstroConst.AstroColor[pntstr];
				}				
			})
			.attr('font-family', function(d,idx){
				if(idx === 0 || idx === 2 || idx === 4 || (startxt.length === 2 && idx === 1)){
					return AstroConst.AstroChartFont;
				}else{
					return AstroConst.NormalFont;
				}
			}).attr('font-weight', 100)
			.attr('transform', function(d, idx){
				let offset = r >= rThreshold ? 20 : 13;
				let x = -(txtPosR - idx * offset) * Math.sin(lon);
				let y = -(txtPosR - idx * offset) * Math.cos(lon);
				let angle = -pnt.lon;
				if(house1Ang !== undefined && house1Ang !== null && txtforward){
					angle = 90 - house1Ang;
				}
				let trans = 'translate(' + x + ', ' + y + ') rotate(' + angle + ')';
				return trans;
			})
			.text(function(d){return d});			

	}

	return stars;

}

export function desposeAspects(svg, r, chartObj, planetDisplay, needThreePlanetAspLines){
	let aspects = chartObj.aspects.normalAsp;
	let asps = localStorage.getItem(AstroConst.AspKey);
	if(asps === undefined || asps === null){
		asps = AstroConst.DEFAULT_ASPECTS;
	}else{
		asps = JSON.parse(asps);
	}
	let aspset = new Set();
	for(let i=0; i<asps.length; i++){
		aspset.add(asps[i]);
	}


	let apsgroup = svg.append('g');
	for(let key in aspects){
		if(!planetDisplay.has(key)){
			continue;
		}
		let objA = getObject(chartObj, key);
		if(objA === undefined || objA === null || objA.poslon === undefined || objA.poslon === null){
			continue;
		}
		let x1 = -r * Math.sin(objA.poslon * Math.PI / 180);
		let y1 = -r * Math.cos(objA.poslon * Math.PI / 180);
		let asp = aspects[key];
		let appl = asp.Applicative;
		let sep = asp.Separative;
		let aspary = asp.Exact.map((elm)=>{
			return elm;
		});
		for(let idx=0; idx<sep.length; idx++){
			aspary.push(sep[idx]);
		}
		for(let idx=0; idx<appl.length; idx++){
			aspary.push(appl[idx]);
		}

		for(let i=0; i<aspary.length; i++){
			let item = aspary[i];
			if(!planetDisplay.has(item.id)){
				continue;
			}	
			let objB = getObject(chartObj, item.id);
			if(objB === undefined || objB === null || objB.poslon === undefined || objB.poslon === null
				|| (needThreePlanetAspLines === false && AstroConst.THREE_PLANETS.has(objA.id)
					&& AstroConst.THREE_PLANETS.has(objB.id))){
				continue;
			}
			let aspkey = 'Asp' + item.asp;
			if(!aspset.has(aspkey)){
				continue;
			}

			let x2 = -r * Math.sin(objB.poslon * Math.PI / 180);
			let y2 = -r * Math.cos(objB.poslon * Math.PI / 180);
			let color = AstroConst.AstroColor['Asp' + item.asp];
			let LineGen = d3.line();
			let linedata = [[x1,y1], [x2, y2]];
			let pathStr = LineGen(linedata);
			let path = apsgroup.append('path')
				.attr('stroke', color)
				.attr('stroke-width', 1)
				.attr('fill', 'none');
			path.attr('d', pathStr);	
			let txt = AstroText.AstroMsg['Asp' + item.asp];
			apsgroup.append('text')
			.attr("dominant-baseline","middle")
			.attr("text-anchor", "middle").attr('stroke', color)
			.attr('font-size', 10).attr('font-family', AstroConst.AstroChartFont)
			.text(txt).attr('transform', 'translate(' + (x1+x2)/2 + ',' + (y1+y2)/2 + ')');	;

		}
	}

	return apsgroup;
}

export function desposeHouses(svg, r, rStep, houses){
	let innerR = r - rStep;
	let txtPosR = r - rStep / 2 - 4;

	let terms = svg.append('g');
	for(let i=0; i<houses.length; i++){
		let term = houses[i];
		let sig = term.id;
		let delta = term['size'];
		let stangle = term['lon'] * Math.PI / 180;
		let edangle = delta * Math.PI / 180;		
		let arc = d3.arc();
		let arcd = arc({
			innerRadius: innerR,
			outerRadius: r,
			startAngle: -stangle,
			endAngle: -(stangle + edangle)
		});
		let termgroup = terms.append('g');
		termgroup.append('path')
			.attr('d', arcd).attr('stroke', AstroConst.AstroColor[term.id])
			.attr('fill', AstroConst.AstroColor.HouseFill[term.id]);

		let demiStep = (delta / 2) * Math.PI / 180;
		let lblgroup = termgroup.append('g').attr("text-anchor", "middle");
		let posx = -txtPosR * Math.sin(stangle + demiStep);
		let posy = -txtPosR * Math.cos(stangle + demiStep);
		let transtr = 'translate(' + posx + ',' + posy +  ')';
		lblgroup.attr('transform', transtr);
		let termtxt = sig.substr(5);
		let lbl = lblgroup.append('text')
				.attr('stroke', AstroConst.AstroColor.Stroke)
				.attr("dominant-baseline","middle")
				.attr("text-anchor", "middle")
				.attr('font-size', 16)
				.text(termtxt);
		let txtang = -(term['lon'] + delta/2);
		let txtrot = 'rotate(' + txtang + ')';
		lbl.attr('transform', txtrot);		

	}

	return terms;

}

export function labelHousesDeg(svg, r, len, houses, flags){
	let txtPosR = r;
	let labelHDgrp = svg.append('g');
	for(let i=0; i<houses.length; i++){
		let house = houses[i];
		let lonrad = house.lon * Math.PI / 180;
		let x1 = -r * Math.sin(lonrad);
		let y1 = -r * Math.cos(lonrad);
		let x2 = -(r - len) * Math.sin(lonrad);
		let y2 = -(r - len) * Math.cos(lonrad);
		let path = labelHDgrp.append('line')
			.attr('stroke-dashanray', '3,3')
			.attr('stroke', AstroConst.AstroColor['Stroke']);
		path.attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2);	


		let sig = house.sign;
		let angleparts = splitDegree(house['signlon']);
		let txts = [angleparts[0] + 'º', AstroText.AstroMsg[sig], angleparts[1]+"'"];
		let lblgroup = labelHDgrp.append('g').attr("text-anchor", "middle");
		lblgroup.selectAll('text').data(txts).enter().append('text')
			.attr("dominant-baseline","middle")
			.attr("text-anchor", "middle")
			.attr('font-size', 12)
			.attr('stroke', AstroConst.AstroColor[sig])
			.attr('font-family', function(d,idx){
				if(idx === 1){
					return AstroConst.AstroChartFont;
				}else{
					return AstroConst.NormalFont;
				}
			}).attr('font-weight', 100)
			.attr('transform', function(d, idx){
				let x = 0;
				let y = 0;
				let centeridx = 1;
				let ang = house['lon'];
				let rad = ang * Math.PI / 180;
				if(idx === centeridx){
					x = -txtPosR * Math.sin(rad);
					y = -txtPosR * Math.cos(rad);
				}else{
					let deltaIdx = centeridx - idx;
					ang = ang + deltaIdx*3;
					rad = ang * Math.PI / 180;
					x = -txtPosR * Math.sin(rad);
					y = -txtPosR * Math.cos(rad);
				}
				let rotang = -ang;
				let trans = 'translate(' + x + ', ' + y + ') rotate(' + rotang + ')';
				return trans;
			})
			.text(function(d){return d});			

	}

	return labelHDgrp;
}

export function drawBirthInfo(svg, margin, chartObj, chartid, inverse){
	let params = chartObj.params;
	let chartType = chartObj.chart.isDiurnal ? '，日生盘' : '，夜生盘';
	let commtxts = [
		'经度：' + params.lon + '， ' + '纬度：' + params.lat,
		params.birth + ' ' + chartObj.chart.dayofweek,
		'时区：' + params.zone + ' ' + chartType,
	];
	if(chartObj.chart.nongli){
		let suntm = '真太阳时：' + chartObj.chart.nongli.birth;
		commtxts.push(suntm);
	}
	if(params.zodiacal === AstroConst.SIDEREAL){
		commtxts.push(AstroText.AstroTxtMsg[params.zodiacal]);
		let txt = AstroConst.HouseSys[params.hsys];
		commtxts.push(txt)
	}else{
		let txt = AstroText.AstroMsg[params.zodiacal] + '，' + AstroConst.HouseSys[params.hsys]
		commtxts.push(txt);
	}
	commtxts.push('日主星：' + AstroText.AstroMsgCN[chartObj.chart.dayerStar]);
	commtxts.push('时主星：' + AstroText.AstroMsgCN[chartObj.chart.timerStar]);

	let txts = [];
	if(params.name){
		txts.push(params.name);
	}
	if(params.pos){
		txts.push(params.pos);
	}
	for(let i=0; i<commtxts.length; i++){
		txts.push(commtxts[i]);
	}
	if(inverse){
		txts.push('外盘');
	}

	let rowheight = 20;
	let txtg = svg.append('g');
	txtg.selectAll('text').data(txts).enter().append('text')
		.attr('font-weight', 100)
		.attr('stroke', AstroConst.AstroColor.Stroke)
		.attr('transform', function(d, idx){
			let x = margin;
			let y = margin + rowheight * idx;
			let trans = 'translate(' + x + ', ' + y + ')';
			return trans;
		})
		.text(function(d){return d});			

	let printsvg = svg.append('g');
	printsvg.append('text')
		.attr("dominant-baseline","middle")
		.attr("text-anchor", "left")
		.attr('font-weight', 100)
		.attr('stroke', AstroConst.AstroColor.Stroke)
		.attr('style', 'cursor:hand')
		.attr('transform', function(d){
			let x = margin;
			let y = margin + rowheight * txts.length;
			let trans = 'translate(' + x + ', ' + y + ')';
			return trans;
		})
		.text('打印星盘');

	printsvg.on('click', ()=>{
		printArea(chartid);
	});
	
}

export function drawBirthInfoInCircle(svg, r, firstX, firstY, chartObj, chartid){
	let params = chartObj.params;
	let chartType = chartObj.chart.isDiurnal ? '，日生盘' : '，夜生盘';
	let commtxts = [
		params.lon + '，' + params.lat,
		params.birth + ' ' + chartObj.chart.dayofweek,
		'时区：' + params.zone + ' ' + chartType,
	];
	if(chartObj.chart.nongli){
		let suntime = '真阳时：' + chartObj.chart.nongli.birth;
		commtxts.push(suntime);
	}
	if(params.zodiacal === AstroConst.SIDEREAL){
		commtxts.push(AstroText.AstroTxtMsg[params.zodiacal]);
		let txt = AstroConst.HouseSys[params.hsys];
		commtxts.push(txt)
	}else{
		let txt = AstroText.AstroMsg[params.zodiacal] + '，' + AstroConst.HouseSys[params.hsys]
		commtxts.push(txt);
	}
	commtxts.push('日主星：' + AstroText.AstroMsgCN[chartObj.chart.dayerStar]);
	commtxts.push('时主星：' + AstroText.AstroMsgCN[chartObj.chart.timerStar]);

	let txts = [];
	if(params.name){
		txts.push(params.name);
	}
	if(params.pos){
		txts.push(params.pos);
	}
	for(let i=0; i<commtxts.length; i++){
		txts.push(commtxts[i]);
	}

	let rowheight = 20;
	let totalH = txts.length * rowheight;
	let deltaH = (2*r - totalH) / 2 + 10;
	let deltaW = (2*r - 180) / 2
	let fy = firstY + deltaH;
	let x = firstX - deltaW*2;
	let y = fy;
	let txtg = svg.append('g');
	txtg.selectAll('text').data(txts).enter().append('text')
		.attr('font-weight', 100)
		.attr('stroke', AstroConst.AstroColor.Stroke)
		.attr('transform', function(d, idx){
			y = fy + rowheight * idx;
			let trans = 'translate(' + x + ', ' + y + ')';
			return trans;
		})
		.text(function(d){return d});	
		
	let printsvg = svg.append('g');
	printsvg.append('text')
		.attr("dominant-baseline","middle")
		.attr("text-anchor", "left")
		.attr('font-weight', 100)
		.attr('stroke', AstroConst.AstroColor.Stroke)
		.attr('style', 'cursor:hand')
		.attr('transform', function(d, idx){
			y = fy + rowheight * txts.length;
			let trans = 'translate(' + x + ', ' + y + ')';
			return trans;
		})
		.text('打印星盘');

	printsvg.on('click', ()=>{
		printArea(chartid);
	});


}

export function drawAngles(svg, r, len, chartObj, flags){
	let asc = getObject(chartObj, AstroConst.ASC);
	let desc = getObject(chartObj, AstroConst.DESC);
	let mc = getObject(chartObj, AstroConst.MC);
	let ic = getObject(chartObj, AstroConst.IC);
	let ary = [asc, desc, mc, ic];

	let angglegroup = svg.append('g');
	for(let i=0; i<ary.length; i++){
		let angobj = ary[i];
		let lonrad = angobj.lon * Math.PI / 180;
		let x1 = -r * Math.sin(lonrad);
		let y1 = -r * Math.cos(lonrad);
		let x2 = -(r - len) * Math.sin(lonrad);
		let y2 = -(r - len) * Math.cos(lonrad);
		let path = angglegroup.append('line')
			.attr('stroke-dashanray', '3,3')
			.attr('stroke-width', 2)
			.attr('stroke', AstroConst.AstroColor['Stroke']);
		path.attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2);	
	}

	return angglegroup;
}

export function drawChart(chartid, chartObj, rStep, chartDisplay, planetDisplay, keyplanets){
	if(chartObj === undefined || chartObj === null || chartObj.err){
		return null;
	}
	let svgdom = document.getElementById(chartid); 
	if(svgdom === undefined || svgdom === null){
		return null;
	}
	let width = svgdom.clientWidth;
	let height = svgdom.clientHeight;
	if(width === 0 || height === 0){
		return null;
	}

	let disp = chartDisplay ? chartDisplay : [];
	let flags = 0;
	for(let i=0; i<disp.length; i++){
		flags = flags + disp[i];
	}

	let orgx = width / 2;
	let orgy = height / 2 - ChartMoveUp;
	let delta = ChartMarginDelta - ChartMoveUp ;
	let signsR = Math.min(width, height) / 2 - delta;

	let ressvg = drawChartWithOrgXY(chartid, chartObj, orgx, orgy, signsR, rStep, flags, planetDisplay, keyplanets);
	let svg = ressvg.svg;
	if((flags & AstroConst.CHART_INFOINCIRCLE) === AstroConst.CHART_INFOINCIRCLE){
		let r = ressvg.chart.radius;
		let x = orgx - r * Math.sin(0);
		let y = orgy - r * Math.cos(0);
		drawBirthInfoInCircle(svg, r, x, y, chartObj, chartid);
	}else{
		drawBirthInfo(svg, ChartMargin, chartObj, chartid);
	}

}

export function drawChartWithOrgXY(chartid, chartObj, orgx, orgy, radius, rStep, flags, planetDisplay, keyplanets){
	if(chartObj === undefined || chartObj === null || chartObj.err){
		return null;
	}
	let svgdom = document.getElementById(chartid); 
	if(svgdom === undefined || svgdom === null){
		return null;
	}
	let width = svgdom.clientWidth;
	let height = svgdom.clientHeight;
	if(width === 0 || height === 0){
		return null;
	}

	let svgid = '#' + chartid;
	let svg = d3.select(svgid);
	svg.html('');
	svg.attr('stroke', '#000000').attr("stroke-width", 1);

	let topgroup = svg.append('g');

	if((flags & AstroConst.CHART_HOUSEDEGREE) === AstroConst.CHART_HOUSEDEGREE){
		let lblHousedegR = radius + 20;
		labelHousesDeg(topgroup, lblHousedegR, 70, chartObj.chart.houses, flags);	
	}
	let houseR = drawOuterSigns(chartObj, topgroup, radius, rStep, flags, chartObj.chart.isDiurnal);

	let txtsu28 = (flags & AstroConst.CHART_SU28_TEXT) === 0 ? false : true;
	let chartres = drawInnerChartWithOrgXY(topgroup, chartObj, orgx, orgy, houseR, rStep, flags, planetDisplay, txtsu28, keyplanets);
	let resobj = {
		svg: svg,
		chart: chartres,
	}
	return resobj;
}

export function drawOuterSigns(chartObj, topgroup, radius, rStep, flags, isDiurnal){
	let needOutDeg = (flags & AstroConst.CHART_OUTERDEG) === AstroConst.CHART_OUTERDEG ? true : false;
	if(needOutDeg){
		let outerDegLines = degreeOuterLines(topgroup, radius);
	}
	let house1 = null;
	if(chartObj){
		house1 = getHouse(chartObj, AstroConst.HOUSE1);
	}
	let house1ang = house1 ? house1['lon'] : null;
	let signs = signsBand(topgroup, radius, rStep, flags, isDiurnal, house1ang);

	let needTerm = (flags & AstroConst.CHART_TERM) === AstroConst.CHART_TERM ? true : false;

	if(needTerm){
		let termR = radius - rStep;
		let termStep = 20;
		let terms = termBand(topgroup, termR, termStep, flags);
	
		let houseR = termR - termStep;
		return houseR;	
	}

	return radius - rStep;
}

export function drawInnerChartWithOrgXY(topgroup, chartObj, orgx, orgy, houseR, rStep, flags, planetDisplay, txtsu28, keyplanets){
	let housesObj = chartObj.chart.houses;
	let houses = desposeHouses(topgroup, houseR, rStep, housesObj);

	let needInnerDeg = (flags & AstroConst.CHART_INNERDEG) === AstroConst.CHART_INNERDEG ? true : false;
	if(needInnerDeg){
		let innerDegLines = degreeInnerLines(topgroup, houseR);
	}

	let starsR = houseR - rStep;
	let starStep = 105;
	let txtplanet = (flags & AstroConst.CHART_TXTPLANET) === 0 ? false : true;
	if(!txtplanet){
		starStep = 50;
	}else{
		if(starsR < rThreshold){
			starStep = 70
		}
		if(txtsu28){
			starStep = starStep + 60;
		}
	}

	let housesAry = chartObj.chart.houses;
	let objectsAry = [];
	for(let i=0; i<chartObj.chart.objects.length; i++){
		objectsAry.push(chartObj.chart.objects[i]);
	}
	if(chartObj.lots){
		for(let i=0; i<chartObj.lots.length; i++){
			objectsAry.push(chartObj.lots[i]);
		}	
	}
	objectsAry.sort((a,b)=>{ return a.lon - b.lon});

	let house1 = getHouse(chartObj, AstroConst.HOUSE1);

	let needPlanets = (flags & AstroConst.CHART_PLANETS) === AstroConst.CHART_PLANETS ? true : false;
	if(needPlanets){
		let stars = desposeStars(topgroup, chartObj, starsR, starStep, housesAry, objectsAry, planetDisplay, flags, house1['lon'], txtsu28);
		if((flags & AstroConst.CHART_ANGLELINE) === AstroConst.CHART_ANGLELINE){
			let angleR = houseR + 60;
			let len = starStep + 90;
			if(starsR < rThreshold){
				angleR = houseR + 40;
				len = starStep + 70;
			}
			drawAngles(topgroup, angleR, len, chartObj, flags);	
		}
	
	}else{
		starStep = 0;
	}

	let aspR = starsR - starStep;
	let needSu = (flags & AstroConst.CHART_SU27) === AstroConst.CHART_SU27 ? true : false;
	if(needSu){
		let suSixHouseR = starsR - starStep;
		let suSH = suSixhouses(topgroup, suSixHouseR, rStep, chartObj);
	
		let suR = suSixHouseR - rStep;
		let needOutDeg = (flags & AstroConst.CHART_OUTERDEG) === AstroConst.CHART_OUTERDEG ? true : false;
		if(needOutDeg){
			let outerSuDegLines = degreeOuterLines(topgroup, suR);
		}
		let suTerms = su27Band(topgroup, suR, rStep);
	
		let guohouses = chartObj.guoStarSect.houses;
		let lifeSu = guohouses[0].id;
		let suRelationR = suR - rStep;
		let suRelations = suRelationBand(topgroup, suRelationR, lifeSu, rStep);
	
		aspR = suRelationR - rStep;		
	}

	let needAspLines = (flags & AstroConst.CHART_ASP_LINES) === AstroConst.CHART_ASP_LINES ? true : false;	
	if(needAspLines){
		let needThreePlanetAspLines = (flags & AstroConst.CHART_THREEPLANETASP) === AstroConst.CHART_THREEPLANETASP ? true : false;
		let asp = desposeAspects(topgroup, aspR, chartObj, planetDisplay, needThreePlanetAspLines);
	}

	if(keyplanets){
		let maskStep = rStep + starStep;
		drawMask(topgroup, chartObj, houseR, maskStep, keyplanets);
	}

	let translate = 'translate(' + orgx + ',' + orgy + ') ';
	let rotate = 'rotate(' + (house1.lon-90) + ')';
	let trans = translate + rotate;
	topgroup.attr("transform", trans);

	let resobj = {
		topgroup: topgroup,
		radius: aspR,
	}
	return resobj;

}

export function drawMask(svg, chartObj, r, rStep, keyplanets){
	let innerR = r - rStep;
	let houses = chartObj.chart.houses;
	let masks = svg.append('g');
	for(let i=0; i<houses.length; i++){
		let house = houses[i];
		let hasKey = false;
		for(let i = 0; i<keyplanets.length; i++){
			let obj = getObject(chartObj, keyplanets[i]);
			let lon = obj.lon;
			if(house.lon <= lon && lon <= house.lon + house.size){
				hasKey = true;
				break;
			}
		}
		let delta = house['size'];
		let stangle = house['lon'] * Math.PI / 180;
		let edangle = delta * Math.PI / 180;		
		let arc = d3.arc();
		let arcd = arc({
			innerRadius: innerR,
			outerRadius: r,
			startAngle: -stangle,
			endAngle: -(stangle + edangle)
		});
		let maksgrp = masks.append('g');
		if(hasKey){
			maksgrp.append('path')
				.attr('d', arcd).attr('stroke', AstroConst.AstroColor.Stroke)
				.attr('fill', AstroConst.AstroColor.HouseFill[house.id]);	
		}else{
			maksgrp.append('path')
				.attr('d', arcd).attr('stroke', AstroConst.AstroColor.Stroke)
				.attr('opacity', 0.2)
				.attr('fill', AstroConst.AstroColor.HouseMask);	
		}
	}

}

export function drawOutterChartInfo(svg, margin, width, datetime, lat, lon, inverse){
	if(datetime === undefined || datetime === null){
		return;
	}
	
	let txts = [];
	if(lat !== undefined && lat !== null){
		let latstr = convertLatToStr(lat);
		let lonstr = convertLonToStr(lon);
		txts.push('行运经度：' + lonstr + '， ' + '纬度：' + latstr);
	}
	txts.push('行运时间：' + datetime);
	if(inverse){
		txts.push('内盘');
	}

	let rowheight = 20;
	let txtg = svg.append('g');
	txtg.selectAll('text').data(txts).enter().append('text')
		.attr('font-weight', 100)
		.attr('stroke', AstroConst.AstroColor.Stroke)
		.attr('transform', function(d, idx){
			let x = width - 200 - margin;
			let y = margin + rowheight * idx;
			let trans = 'translate(' + x + ', ' + y + ')';
			return trans;
		})
		.text(function(d){return d});			

}

export function drawDoubleChart(chartid, chartObj, rStep, chartDisplay, planetDisplay){
	if(chartObj === undefined || chartObj === null || chartObj.err ||
		chartObj.natualChart === undefined || chartObj.natualChart === null ||
		chartObj.dirChart === undefined || chartObj.dirChart === null){
		return null;
	}
	let svgdom = document.getElementById(chartid); 
	if(svgdom === undefined || svgdom === null){
		return null;
	}
	let width = svgdom.clientWidth;
	let height = svgdom.clientHeight;
	if(width === 0 || height === 0){
		return null;
	}

	let innerChart = chartObj.natualChart;
	let outerChart = chartObj.dirChart;
	if(chartObj.inverse && chartObj.dirChart.dirChart){
		innerChart = chartObj.dirChart.dirChart;
		outerChart = chartObj.natualChart;
	}

	let disp = chartDisplay ? chartDisplay : [];
	let flags = 0;
	for(let i=0; i<disp.length; i++){
		flags = flags + disp[i];
	}
	if((flags & AstroConst.CHART_SU27) === AstroConst.CHART_SU27){
		flags = flags - AstroConst.CHART_SU27;
	}

	let orgx = width / 2;
	let orgy = height / 2 - ChartMoveUp;
	let delta = ChartMarginDelta - ChartMoveUp;
	let signsR = Math.min(width, height) / 2 - delta;

	let svgid = '#' + chartid;
	let svg = d3.select(svgid);
	svg.html('');
	svg.attr('stroke', '#000000').attr("stroke-width", 1);

	let topgroup = svg.append('g');

	if((flags & AstroConst.CHART_HOUSEDEGREE) === AstroConst.CHART_HOUSEDEGREE){
		let lblHousedegR = signsR + 20;
		labelHousesDeg(topgroup, lblHousedegR, 70, innerChart.chart.houses, flags);	
	}
	let restR = drawOuterSigns(null, topgroup, signsR, rStep, flags, innerChart.chart.isDiurnal);
	let housesAry = innerChart.chart.houses;
	let objectsAry = [];
	for(let i=0; i<outerChart.chart.objects.length; i++){
		objectsAry.push(outerChart.chart.objects[i]);
	}
	if(outerChart.lots){
		for(let i=0; i<outerChart.lots.length; i++){
			objectsAry.push(outerChart.lots[i]);
		}	
	}
	objectsAry.sort((a,b)=>{ return a.lon - b.lon});
	let starStep = 100;
	let txtplanet = (flags & AstroConst.CHART_TXTPLANET) === 0 ? false : true;
	if(!txtplanet){
		starStep = 50;
	}

	let natalchart = chartObj.dirChart.natalChart ? chartObj.dirChart.natalChart : chartObj.natualChart;
	if(chartObj.dirChart.dirChart && chartObj.inverse){
		natalchart = chartObj.dirChart.dirChart;
	}
	let house1 = getHouse(natalchart, AstroConst.HOUSE1);	
	let stars = desposeStars(topgroup, chartObj, restR, starStep, housesAry, objectsAry, planetDisplay, flags, house1['lon'], false);

	let houseR = restR - starStep;
	drawInnerChartWithOrgXY(topgroup, natalchart, orgx, orgy, houseR, rStep, flags, planetDisplay, false);

	drawBirthInfo(svg, ChartMargin, chartObj.natualChart, chartid, chartObj.inverse);
	let lat = chartObj.dirChart.pos ? chartObj.dirChart.pos.lat : null;
	let lon = chartObj.dirChart.pos ? chartObj.dirChart.pos.lon : null;
	drawOutterChartInfo(svg, ChartMargin, width, chartObj.dirChart.date, lat, lon, chartObj.inverse);

	return svg;
}

