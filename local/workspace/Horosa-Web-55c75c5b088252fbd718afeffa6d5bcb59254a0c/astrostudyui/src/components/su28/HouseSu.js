import * as d3 from 'd3';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import {splitDegree} from '../astro/AstroHelper';
import {randomStr, creatTooltip} from '../../utils/helper';

class HouseSu {
	constructor(option){
		this.owner = option.owner;
		this.houseObj = option.houseObj;
		this.su28chart = option.su28chart;
		this.fields = option.fields;
		this.onTipClick = option.onTipClick;

		this.x = option.x;
		this.y = option.y;
		this.width = option.width;
		this.height = option.height;

		this.margin = 3;
		this.svg = null;
		this.titleSvg = null;

		this.id = 'house' + randomStr(8);

		this.fontSize = 20;
		this.starFontSize = 14;
		this.starAngleFontSize = 13;
		this.houseBG = AstroConst.AstroColor.ChartBackgroud;
		this.color = option.color ? option.color : AstroConst.AstroColor.Stroke;
		
	}

	draw(){
		this.owner.select('#' + this.id).remove();
		let container = this.owner.append('g').attr('id', this.id);
		this.svg = container;
	}

	genTooltipByTips(titleSvg, tipobj){
		creatTooltip(this.su28chart.divTooltip, titleSvg, tipobj, this.onTipClick);
	}

	genTooltip(titleSvg, obj, name){
		if(this.su28chart.divTooltip === undefined || this.su28chart.divTooltip === null){
			return;
		}
		
		let lblsvg = this.titleSvg;
		if(titleSvg){
			lblsvg = titleSvg;
		}
		let hobj = this.houseObj;
		if(obj){
			hobj = obj;
		}
		
		let lbl = name;
		if(lbl === undefined || lbl === null){
			if(hobj.name){
				lbl = hobj.name;
				if(hobj.wuxing){
					lbl = lbl + hobj.wuxing
				}
				if(hobj.animal){
					lbl = lbl + ', ' + hobj.name + hobj.animal;
				}
			}else{
				lbl = AstroText.AstroMsgCN[hobj.id];
				if(lbl === undefined || lbl === null){
					lbl = '';
				}
			}
		}
		if(hobj.type && (hobj.type === 'Planet' || hobj.type === 'Generic')){
			let sigdeg = hobj.ra / 30;
			let sigidx = Math.floor(sigdeg);
			let sigdegs = splitDegree(hobj.ra - sigidx*30);
			let rasig = AstroConst.LIST_SIGNS[sigidx];
			let zi = AstroText.AstroZiMsg[rasig];
			lbl = lbl + ' ' + sigdegs[0] + 'º' + zi + sigdegs[1] + "'";
		}

		let degs = splitDegree(hobj.ra);
		let tipobj = {
			title: lbl,
			tips: ['RA:' +  degs[0] + 'º' + degs[1] + "'； " + Math.round(hobj.ra*10000)/10000+ 'º'],
		};


		lblsvg.on('mouseover', (evt)=>{
			let degs = splitDegree(hobj.ra);
			let str = lbl + '<br />RA:' +  degs[0] + 'º' + degs[1] + "'； " + Math.round(hobj.ra*10000)/10000;
			this.su28chart.divTooltip.transition()		
				.duration(200)		
				.style("opacity", .9);
			this.su28chart.divTooltip.html(str)
				.style("left", (evt.pageX) + "px")
				.style("top", (evt.pageY - 28) + "px");
		}).on('mouseout', (evt)=>{
			this.su28chart.divTooltip.transition()		
				.duration(500)		
				.style("opacity", 0);
		}).on('click', (evt)=>{
			if(this.onTipClick){
				this.onTipClick(tipobj);
			}
		});
	}

	hasAsc(){
		let planets = this.houseObj.planets;
		for(let i=0; i<planets.length; i++){
			let pnt = planets[i];
			if(pnt.id === AstroConst.ASC){
				return true;
			}
		}
		return false;
	}

	getStarText(){
		let flags = this.su28chart.chartDisp;
		let txtplanet = true;
		if(flags !== undefined && flags !== null){
			txtplanet = (flags & AstroConst.CHART_TXTPLANET) === 0 ? false : true;
		}
		let res = [];
		let planets = this.houseObj.planets;
		for(let i=0; i<planets.length; i++){
			let pnt = planets[i];
			let pntstr = pnt.id;
			let radeg = pnt.ra - this.houseObj.ra;
			if(radeg < 0){
				radeg = pnt.ra + 360 - this.houseObj.ra;
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
				planet: pnt,
			};
			res.push(obj);
		}

		return res;
	}

}

export default HouseSu;

