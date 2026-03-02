import * as d3 from 'd3';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import * as Su28Helper from './Su28Helper';
import * as SZConst from '../suzhan/SZConst';
import {splitDegree} from '../astro/AstroHelper';
import {randomStr, detectOS, printArea, distanceInCircleAbs, creatTooltip} from '../../utils/helper';
import {drawTextV, drawTextH} from '../graph/GraphHelper';
import {ZiSign,} from '../suzhan/SZConst';



class Su28ChartCircle {
	constructor(option){
		this.ChartMargin = 20;
		this.ChartMarginDelta = 55;
		this.ChartMoveUp = 10;
		this.TxtOffsetTop = 0;
		this.rThreshold = 100;
		this.osFlag = detectOS();
		if(this.osFlag === 'Mac'){
			this.TxtOffsetTop = 2;
		}
		this.rotateAng = 90;
				
		this.chartId = option.chartId;
		this.owner = option.owner;
		this.fields = option.fields;
		this.chartObj = option.chartObj;
		this.chartDisp = option.chartDisp;
		this.planetDisp = option.planetDisp;
		this.onTipClick = option.onTipClick;

		this.x = option.x;
		this.y = option.y;
		this.width = option.width;
		this.height = option.height;
		this.ox = (option.x + option.width) / 2;
		this.oy = (option.y + option.height) / 2;

		this.houseMap = new Map();

		this.divTooltip = option.divTooltip;

		this.id = 'circlechart' + randomStr(8);

		this.margin = 3;
		this.or = option.width <= option.height ? option.width / 2 : option.height / 2;
		this.or = this.or - 10;

		this.objectMap = new Map();

		this.svg = null;
		this.titleSvg = null;

		this.fontSize = 15;
		this.starFontSize = 14;
		this.starAngleFontSize = 13;
		this.houseBG = AstroConst.AstroColor.ChartBackgroud;
		this.color = AstroConst.AstroColor.Stroke;

		this.ascSign = null;
		this.ascSignIndex = -1;	

		this.setupSuHouses();
		this.setupToolTip();

	}

	setupToolTip(){
		if(this.divTooltip){
			this.divTooltip.style("opacity", 0)
				.style('position', 'absolute')
				.style('text-align', 'left')
				.style('vertical-align', 'middle')
				.style('width', '180px')
				.style('padding', '2px')
				.style('padding-left', '10px')
				.style('font', '13px sans-serif')
				.style('background', 'lightsteelblue')
				.style('border', '0px')
				.style('border-radius', '8px')
				.style('pointer-events', 'none');
		}
	}

	setupSuHouses(){
		if(this.chartObj === null || this.chartObj === undefined){
			return;
		}

		let suhouses = this.chartObj.fixedStarSu28;
		for(let i=0; i<suhouses.length; i++){
			let suh = suhouses[i];
			suh.planets = [];
			this.houseMap.set(suh.name, suh);
		}	

		for(let i=0; i<this.chartObj.objects.length; i++){
			let obj = this.chartObj.objects[i];
			if(this.planetDisp){
				if(this.planetDisp.has(obj.id)){
					let house = this.houseMap.get(obj.su28);
					house.planets.push(obj);
				}	
			}else{
				if(AstroConst.isTraditionPlanet(obj.id)){
					let house = this.houseMap.get(obj.su28);
					house.planets.push(obj);
				}
			}
		}

		for(let su of suhouses){
			let house = this.houseMap.get(su.name);
			house.planets.sort((a, b)=>{
				if(a.ra > 300 && b.ra < 30){
					return -1;
				}
				return a.ra - b.ra;
			});
		}
	}

	getObject(objid){
		if(this.chartObj === undefined || this.chartObj === null){
			return null;
		}
		if(this.objectMap.size > 0){
			return this.objectMap.get(objid);
		}

		for(let i=0; i<this.chartObj.objects.length; i++ ){
			let obj = this.chartObj.objects[i];
			this.objectMap.set(obj.id, obj);
		}
		if(this.chartObj.lots){
			for(let i=0; i<this.chartObj.lots.length; i++ ){
				let obj = this.chartObj.lots[i];
				this.objectMap.set(obj.id, obj);
			}	
		}
		return this.objectMap.get(objid);
	}
	

	genTooltipByTips(titleSvg, tipobj){
		creatTooltip(this.divTooltip, titleSvg, tipobj, this.onTipClick);
	}
	
	genTooltip(titleSvg, houseObj, name){
		if(this.divTooltip === undefined || this.divTooltip === null){
			return;
		}

		let tipobj = {
			title: name,
			tips: null,
		};
		
		let lbl = name;
		if(lbl === undefined || lbl === null){
			if(houseObj.name){
				lbl = houseObj.name;
				if(houseObj.wuxing){
					lbl = lbl + houseObj.wuxing
				}
				if(houseObj.animal){
					lbl = lbl + ', ' + houseObj.name + houseObj.animal;
				}
			}else{
				lbl = AstroText.AstroMsgCN[houseObj.id];
				if(lbl === undefined || lbl === null){
					lbl = '';
				}
			}
		}

		if(houseObj.type && (houseObj.type === 'Planet' || houseObj.type === 'Generic' || houseObj.type === 'GenericCN')){
			let sigdeg = houseObj.ra / 30;
			let sigidx = Math.floor(sigdeg);
			let sigdegs = splitDegree(houseObj.ra - sigidx*30);
			let rasig = AstroConst.LIST_SIGNS[sigidx];
			let zi = AstroText.AstroZiMsg[rasig];
			let degstr = sigdegs[0] + 'º' + zi + sigdegs[1] + "'";
			lbl = lbl + ' ' + degstr;
		}

		let degs = splitDegree(houseObj.ra);
		tipobj.title = lbl + "";
		tipobj.tips = ['RA:' +  degs[0] + 'º' + degs[1] + "'； " + Math.round(houseObj.ra*10000)/10000+ 'º'] ;

		titleSvg.on('mouseover', (evt)=>{
			let degs = splitDegree(houseObj.ra);
			let str = lbl + '<br />RA：' +  degs[0] + 'º' + degs[1] + "'； " + Math.round(houseObj.ra*10000)/10000+ 'º' ;
			this.divTooltip.transition()		
				.duration(200)		
				.style("opacity", .9);
			this.divTooltip.html(str)
				.style("left", (evt.pageX) + "px")
				.style("top", (evt.pageY - 28) + "px");
		}).on('mouseout', (evt)=>{
			this.divTooltip.transition()		
				.duration(500)		
				.style("opacity", 0);
		}).on('click', (evt)=>{
			if(this.onTipClick){
				this.onTipClick(tipobj);
			}
		});
	}

	getPlanet(objid){
		if(this.chartObj === undefined || this.chartObj === null){
			return null;
		}
		if(this.chartObj.objectMap){
			return this.chartObj.objectMap[objid];
		}
		this.chartObj.objectMap = {};
		for(let i=0; i<this.chartObj.objects.length; i++ ){
			let obj = this.chartObj.objects[i];
			this.chartObj.objectMap[obj.id] = obj;
		}
		return this.chartObj.objectMap[objid];
	
	}

	getAscSign(){
		let asc = this.getPlanet(AstroConst.ASC);
		let sun = this.getPlanet(AstroConst.SUN);

		if(asc){
			const houseStartMode = this.getHouseStartMode();
			const useAscMode = houseStartMode === SZConst.SZHouseStart_ASC;
			if(!useAscMode && this.chartObj && this.chartObj.nongli && this.chartObj.nongli.bazi && sun){
				let timezi = this.chartObj.nongli.bazi.time.branch.cell;
				let timesig = ZiSign[timezi];
				let tmsigidx = AstroConst.LIST_SIGNS.indexOf(timesig);
				let sunidx = Math.floor(sun.ra / 30);
				let idx = (sunidx - tmsigidx - 5 + 24) % 12;
				return AstroConst.LIST_SIGNS[idx];
			}
			return AstroConst.LIST_SIGNS[Math.floor(asc.ra / 30)];
		}
		return null;
	}

	getHouseStartMode(){
		let mode = SZConst.SZHouseStart_Bazi;
		if(this.fields && this.fields.houseStartMode &&
			this.fields.houseStartMode.value !== undefined && this.fields.houseStartMode.value !== null){
			mode = parseInt(this.fields.houseStartMode.value, 10);
		}else{
			let localMode = localStorage.getItem('suzhanHouseStartMode');
			if(localMode !== undefined && localMode !== null){
				mode = parseInt(localMode, 10);
			}
		}
		if(mode !== SZConst.SZHouseStart_ASC){
			mode = SZConst.SZHouseStart_Bazi;
		}
		return mode;
	}

	getAscSign0(){
		let asc = null;
		for(let i=0; i<this.chartObj.objects.length; i++){
			let obj = this.chartObj.objects[i];
			if(obj.id === AstroConst.ASC){
				asc = obj;
				break;
			}			
		}
		if(asc){
			let idx = -1;
			let ra = asc.ra;
			let prev = this.chartObj.signsRA[0];
			for(let i=1; i<this.chartObj.signsRA.length; i++){
				let nxt = this.chartObj.signsRA[i];
				if(prev.ra <= ra && ra < nxt.ra){
					idx = i;
					break;
				}
				prev = nxt;
			}
			if(idx === -1){
				idx = 11;
			}else{
				idx = idx - 1;
			}
			let sigra = this.chartObj.signsRA[idx];
			return sigra.id;
		}
		return null;
	}

	getStarText(planet, housera, txtplanet){
		let pnt = planet;
		let pntstr = pnt.id;
		let radeg = pnt.ra - housera;
		if(radeg < 0){
			radeg = pnt.ra + 360 - housera;
		}
		let degs = splitDegree(radeg);
		let startxt = [];
		startxt[0] = AstroText.AstroMsg[pntstr];
		if(txtplanet){
			startxt[1] = degs[0] + 'º';
			startxt[2] = pnt.su28;
			startxt[3] = degs[1] + "'";	
		}
		if(pnt.lonspeed < 0){
			startxt.push(AstroText.AstroMsg['Retrograde']);
		}
		let fontfamily = [
			AstroConst.AstroChartFont,
			AstroConst.NormalFont,
			AstroConst.NormalFont,
			AstroConst.NormalFont
		];
		if(startxt.length === 2){
			fontfamily = [
				AstroConst.AstroChartFont,
			];
		}
		if(startxt.length > 4 || startxt.length === 2){
			fontfamily.push(AstroConst.AstroChartFont);
		}
			
		let obj = {
			data: startxt,
			fontFamily: fontfamily,
		};

		return obj;
	}

	getEastRa(){
		// let signsRA = this.chartObj.signsRA;
		// let scop = signsRA[7];
		// return scop.ra + 15;
		let fang = this.houseMap.get('房');
		return fang.ra;

	}

	getHouseNum(houseIdx){
		let idx = (houseIdx - this.ascSignIndex + 12) % 12 + 1;
		return idx;
	}

	draw(){
		if(this.chartObj === null || this.chartObj === undefined){
			return;
		}
		this.initDraw();

		let su28R = this.or;
		this.drawInnerChart(su28R);

		this.drawBirthInfo();

	}

	initDraw(){
		this.owner.select('#' + this.id).remove();
		let container = this.owner.append('g').attr('id', this.id);
		this.svg = container;

		this.ascSign = this.getAscSign();
		this.ascSignIndex = AstroConst.LIST_SIGNS.indexOf(this.ascSign);

		let gods = this.chartObj.nongli.bazi.guolaoGods.ziGods;
		for(let zi in gods){
			let zigods = gods[zi];
			zigods.allGods = [];
			for(let i=0; i<zigods.goodGods.length; i++){
				zigods.allGods.push(zigods.goodGods[i]);
			}
			for(let i=0; i<zigods.neutralGods.length; i++){
				zigods.allGods.push(zigods.neutralGods[i]);
			}
			for(let i=0; i<zigods.badGods.length; i++){
				zigods.allGods.push(zigods.badGods[i]);
			}
		}
	}

	drawInnerChart(r){
		let su28R = r;
		let su28step = 30;
		this.drawSu28(su28R, su28step);
		this.drawInnerDegLines(su28R);

		let starsR = su28R - su28step;
		let starStep = 85;
		let txtplanet = (this.chartDisp & AstroConst.CHART_TXTPLANET) === 0 ? false : true;
		if(!txtplanet){
			starStep = 50;
		}else{
			if(starsR < this.rThreshold){
				starStep = 70
			}
		}

		this.drawPlanets(starsR, starStep);
		let aspStep = starsR - starStep;
		this.drawAspects(aspStep);
	
		let eastRa = this.getEastRa();
		let translate = 'translate(' + this.ox + ',' + this.oy + ') ';
		let rotate = 'rotate(' + (eastRa - this.rotateAng) + ')';
		let trans = translate + rotate;
		this.svg.attr("transform", trans);

	}

	drawInnerDegLines(r){
		let needInnerDeg = (this.chartDisp & AstroConst.CHART_INNERDEG) === AstroConst.CHART_INNERDEG ? true : false;
		if(!needInnerDeg){
			return;
		}
		let grp = this.svg.append('g');

		let long = r - 9;
		let medium = r - 6;
		let short = r - 3;
		let lines = grp.append('g');
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
			let line = lines.append('line').attr('stroke', this.color);
			line.attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2);
		}
	
	}

	drawSu28(r, rStep){
		let eastRa = this.getEastRa();
		let innerR = r - rStep;
		let txtPosR = r - rStep / 2 - this.TxtOffsetTop;

		let su28 = this.chartObj.fixedStarSu28;
		let signs = this.svg.append('g');
		for(let i=0; i<su28.length; i++){
			let su = su28[i];
			let sutxt = su.name;
			let sucolor = Su28Helper.getSu28ColorCircle(su);
			let sufillcolor = Su28Helper.getSu28FillColorCircle(su);
			let nxt = i < su28.length - 1 ? su28[i+1] : su28[0];
			let deg = (nxt.ra - su.ra + 360) % 360;
			let sigsz = deg * Math.PI / 180;
			let a = su.ra * Math.PI / 180;
			let arc = d3.arc();
			let arcd = arc({
				innerRadius: innerR,
				outerRadius: r,
				startAngle: -a,
				endAngle: -(a + sigsz),
			});
			let siggroup = signs.append('g');
			siggroup.append('path')
				.attr('d', arcd).attr('stroke', sucolor)
				.attr('fill', sufillcolor);
	
			let lblgroup = siggroup.append('g').attr("text-anchor", "middle");
			this.genTooltip(lblgroup, su);
			
			let txts = [sutxt];
			let fz = this.fontSize;
			let rotAngle = this.rotateAng;
			lblgroup.selectAll('text').data(txts).enter().append('text')
				.attr("dominant-baseline","central")
				.attr("text-anchor", "middle")
				.attr('font-family', AstroConst.NormalFont)
				.attr('font-size', function(d, idx){
					return fz;
				})
				.attr('stroke', function(d, idx){
					return sucolor;
				})
				.attr('transform', function(d, idx){
					let posx = 0;
					let posy = 0;
					let angle = su.ra + deg / 2 - 4;
					let rad = angle * Math.PI / 180;
					let centeridx = txts.length / 2;
					if(idx === centeridx){
						posx = -txtPosR * Math.sin(rad);
						posy = -txtPosR * Math.cos(rad);
					}else{
						let deltaIdx = centeridx - idx;
						angle = angle + deltaIdx * fz / 2;
						rad = angle * Math.PI / 180;
						posx = -txtPosR * Math.sin(rad);
						posy = -txtPosR * Math.cos(rad);
					}
					let rotang = rotAngle - eastRa;
					let trans = 'translate(' + posx + ', ' + posy + ') rotate(' + rotang + ')';
					return trans;	
				})
				.text(function(d){return d});
		}
		
	}

	drawPlanetSignZone(starssvg, r, innerR){
		let signsRA = this.chartObj.signsRA;
		for(let i=0; i<signsRA.length; i++){
			let su = signsRA[i];
			let sucolor = SZConst.getSigColor(i);
			let sufillcolor = AstroConst.AstroColor.SignFill[su.id];
			let nxt = i < signsRA.length - 1 ? signsRA[i+1] : signsRA[0];
			let deg = (nxt.ra - su.ra + 360) % 360;
			let sigsz = deg * Math.PI / 180;
			let a = su.ra * Math.PI / 180;
			let arc = d3.arc();
			let arcd = arc({
				innerRadius: innerR,
				outerRadius: r,
				startAngle: -a,
				endAngle: -(a + sigsz),
			});
			let siggroup = starssvg.append('g');
			siggroup.append('path')
				.attr('d', arcd).attr('stroke', sucolor)
				.attr('fill', sufillcolor);
		}
	}

	drawPlanetSu28Zone(starssvg, r, innerR){
		let su28 = this.chartObj.fixedStarSu28;
		for(let i=0; i<su28.length; i++){
			let su = su28[i];
			let sucolor = Su28Helper.getSu28ColorCircle(su);
			let nxt = i < su28.length - 1 ? su28[i+1] : su28[0];
			let deg = (nxt.ra - su.ra + 360) % 360;
			let sigsz = deg * Math.PI / 180;
			let a = su.ra * Math.PI / 180;
			let arc = d3.arc();
			let arcd = arc({
				innerRadius: innerR,
				outerRadius: r,
				startAngle: -a,
				endAngle: -(a + sigsz),
			});
			let siggroup = starssvg.append('g');
			siggroup.append('path')
				.attr('d', arcd).attr('stroke', sucolor)
				.attr('fill', 'transparent');			
		}
	}

	drawPlanets(r, rStep){
		let flags = this.chartDisp;
		let samecolorwithsign = (flags & AstroConst.CHART_PLANETCOLORWITHSIGN) === 0 ? false : true;
		let txtforward = (flags & AstroConst.CHART_TXTPLANETFORWARD) === 0 ? false : true;
		let txtplanet = (flags & AstroConst.CHART_TXTPLANET) === 0 ? false : true;
		let degSet = [];
	
		let innerR = r - rStep;
		let txtPosR = r - 10 - this.TxtOffsetTop;
	
		let stars = this.svg.append('g');	
		this.drawPlanetSignZone(stars, r, innerR);
		
		let su28 = this.chartObj.fixedStarSu28;
		for(let i=0; i<su28.length; i++){
			let su = su28[i];
			let suhouse = this.houseMap.get(su.name);
			for(let i=0; i<suhouse.planets.length; i++){
				let pnt = suhouse.planets[i];
				this.drawPlanet(stars, r, pnt, su.ra, txtPosR, degSet, samecolorwithsign, txtforward, txtplanet);
			}

		}
		
		return stars;	
	}

	drawPlanet(stars, r, pnt, housera, txtPosR, degSet, samecolorwithsign, txtforward, txtplanet){
		let hmap = this.houseMap;
		let sigraList = this.chartObj.signsRA;
		let eastRa = this.getEastRa();
		let angoffset = r >= this.rThreshold ? 5 : 11;
		let tmpra = pnt.ra;
		if(degSet.length > 0 && distanceInCircleAbs(degSet[degSet.length-1], tmpra) < angoffset || 
			(degSet.length > 0 && degSet[degSet.length-1] + angoffset > tmpra)){
			tmpra = degSet[degSet.length-1] + angoffset;
		}
		if(tmpra > 180 && pnt.ra < 180){
			tmpra = pnt.ra;
		}
		degSet.push(tmpra);
		pnt.posra = tmpra;

		let lon = tmpra * Math.PI / 180;
		let lblgroup = stars.append('g').attr("text-anchor", "middle");
		this.genTooltip(lblgroup, pnt);

		let startxtobj = this.getStarText(pnt, housera, txtplanet);
		let startxt = startxtobj.data;
		let fontfamily = startxtobj.fontFamily;
		let rotAngle = this.rotateAng;
		lblgroup.selectAll('text').data(startxt).enter().append('text')
			.attr("dominant-baseline","middle")
			.attr("text-anchor", "middle")
			.attr('font-size', function(d, idx){
				if(idx === 0 || idx === 4 || (startxt.length === 2 && idx === 1)){
					return r >= this.rThreshold ? 15 : 13;
				}else if(idx === 2){
					return r >= this.rThreshold ? 13 : 12;
				}else{
					return r >= this.rThreshold ? 13 : 11;
				}
			})
			.attr('font-family', function(d, idx){
				return fontfamily[idx];
			})
			.attr('stroke', function(d, idx){
				// if(samecolorwithsign){
				// 	return Su28Helper.getSu28PlanetColorCircle(pnt, hmap, sigraList);
				// }else{
				// 	let sn = pnt.su28;
				// 	let su = hmap.get(sn)					
				// 	return Su28Helper.getSu28ColorCircle(su);
				// }				
				return AstroConst.AstroColor[pnt.sign];
			})
			.attr('font-weight', 100)
			.attr('transform', function(d, idx){
				let offset = r >= this.rThreshold ? 20 : 13;
				let x = -(txtPosR - idx * offset) * Math.sin(lon);
				let y = -(txtPosR - idx * offset) * Math.cos(lon);
				let angle = -pnt.ra;
				angle = rotAngle - eastRa;
				let trans = 'translate(' + x + ', ' + y + ') rotate(' + angle + ')';
				return trans;
			})
			.text(function(d){return d});			
	}

	drawAspects(r){
		if(this.chartObj === null || this.chartObj === undefined ||
			this.chartObj.aspects === null || this.chartObj.aspects === undefined){
			return;
		}
		let needAspLines = (this.chartDisp & AstroConst.CHART_ASP_LINES) === AstroConst.CHART_ASP_LINES ? true : false;	
		if(!needAspLines){
			return;
		}
		let needThreePlanetAspLines = false;
		if(needAspLines){
			needThreePlanetAspLines = (this.chartDisp & AstroConst.CHART_THREEPLANETASP) === AstroConst.CHART_THREEPLANETASP ? true : false;
		}

		let aspects = this.chartObj.aspects.normalAsp;
	
		let apsgroup = this.svg.append('g');
		for(let key in aspects){
			if(!this.planetDisp.has(key)){
				continue;
			}
			let objA = this.getObject(key);
			if(objA === undefined || objA === null || objA.posra === undefined || objA.posra === null){
				continue;
			}
			let x1 = -r * Math.sin(objA.posra * Math.PI / 180);
			let y1 = -r * Math.cos(objA.posra * Math.PI / 180);
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
				if(!this.planetDisp.has(item.id)){
					continue;
				}	
				let objB = this.getObject(item.id);
				if(objB === undefined || objB === null || objB.posra === undefined || objB.posra === null
					|| (needThreePlanetAspLines === false && AstroConst.THREE_PLANETS.has(objA.id)
						&& AstroConst.THREE_PLANETS.has(objB.id))){
					continue;
				}
				let x2 = -r * Math.sin(objB.posra * Math.PI / 180);
				let y2 = -r * Math.cos(objB.posra * Math.PI / 180);
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
				.text(txt).attr('transform', 'translate(' + (x1+x2)/2 + ',' + (y1+y2)/2 + ')');		
			}
		}
	
		return apsgroup;
	}

	drawBirthInfo(){
		let params = this.fields;
		let commtxts = [
			'经度：' + params.lon.value + '， ' + '纬度：' + params.lat.value,
			params.date.value.format('YYYY-MM-DD') + ' ' + params.time.value.format('HH:mm:ss'),
			'时区：' + params.zone.value
		];
		if(params.zodiacal.value === AstroConst.SIDEREAL){
			commtxts.push(AstroText.AstroTxtMsg[params.zodiacal.value]);
			let txt = this.chartObj.isDiurnal ? '，日生盘' : '，夜生盘';
			txt = AstroConst.HouseSys[params.hsys.value + ''] + txt;
			commtxts.push(txt)
		}else{
			let zodtxt = AstroConst.ZODIACAL[params.zodiacal.value + ''];
			let txt = AstroText.AstroMsg[zodtxt] + '，' + AstroConst.HouseSys[params.hsys.value + '']
			commtxts.push(txt);
			commtxts.push(this.chartObj.isDiurnal ? '日生盘' : '夜生盘');
		}
		let txts = [];
		if(params.name.value){
			txts.push(params.name.value);
		}
		if(params.pos.value){
			txts.push(params.pos.value);
		}
		for(let i=0; i<commtxts.length; i++){
			txts.push(commtxts[i]);
		}
	
		let rowheight = 20;
		let margin = this.margin + this.ChartMargin;
		let svg = this.owner;
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
			printArea(this.chartId);
		});
		

		this.drawBaZi();
	}
	
	drawBaZi(){
		if(this.chartObj.nongli === undefined || this.chartObj.nongli === null ||
			this.chartObj.nongli.bazi === undefined || this.chartObj.nongli.bazi === null){
			return;
		}

		let svg = this.owner;
		let margin = this.margin;

		let birthtxt = '真太阳时：' + this.chartObj.nongli.birth;
		let x = this.x + this.width - 200 - margin;
		let y = margin + this.fontSize;
		let birthsvg = svg.append('g');
		birthsvg.append('text')
			.attr("dominant-baseline","middle")
			.attr("text-anchor", "left")
			.attr('font-weight', 100)
			.attr('stroke', AstroConst.AstroColor.Stroke)
			.attr('style', 'cursor:hand')
			.attr('transform', function(d){
				let trans = 'translate(' + x + ', ' + y + ')';
				return trans;
			})
			.text(birthtxt);

		let bz = this.chartObj.nongli.bazi;
		let year = ' ' + bz.year.ganzi;
		let m = ' ' + bz.month.ganzi;
		let d = '日' + bz.day.ganzi;
		let t = ' ' + bz.time.ganzi;
		let data = [year, m, d, t];
		let tips = [{
			title: bz.year.ganzi,
			tips: ['年柱纳音：'+ bz.year.naying]
		},{
			title: bz.month.ganzi,
			tips: ['月柱纳音：'+ bz.month.naying]
		},{
			title: bz.day.ganzi,
			tips: ['日柱纳音：'+ bz.day.naying]
		},{
			title: bz.time.ganzi,
			tips: ['时柱纳音：'+ bz.time.naying]
		}];

		let lineWidth = 100;
		x = this.x + this.width - lineWidth - margin;
		y = margin*2 + this.fontSize;
		let w = (lineWidth - margin) / 4;
		let h = w * 3 + margin;
		for(let i=0; i<data.length; i++){
			let zusvg = drawTextV(svg, data[i], x, y, w, h, margin, AstroConst.AstroColor.Stroke);
			this.genTooltipByTips(zusvg, tips[i]);
			x = x + w + margin;
		}
	}

}

export default Su28ChartCircle;
