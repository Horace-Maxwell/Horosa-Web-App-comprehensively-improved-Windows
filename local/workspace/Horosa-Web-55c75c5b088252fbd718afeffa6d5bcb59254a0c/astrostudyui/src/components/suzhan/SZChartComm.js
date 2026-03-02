import * as d3 from 'd3';
import * as AstroConst from '../../constants/AstroConst';
import Su28Chart from '../su28/Su28Chart';
import * as SZConst from '../suzhan/SZConst';
import {randomStr, creatTooltip} from '../../utils/helper';
import * as AstroText from '../../constants/AstroText';
import {splitDegree, } from '../astro/AstroHelper';


class SZChartComm {
	constructor(option){
		this.chartId = option.chartId;
		this.owner = option.owner;
		this.fields = option.fields;
		this.chartObj = option.chartObj;

		this.x = option.x;
		this.y = option.y;
		this.width = option.width;
		this.height = option.height;

		this.divTooltip = option.divTooltip;
		this.onTipClick = option.onTipClick;

		this.id = 'chart' + randomStr(8);

		this.dirIndex = null;

		this.houses = [];
		this.svg = null;

		this.su28Offset = option.su28Offset ? option.su28Offset : 50;
		this.su28OffsetY = this.su28Offset*this.height/this.width;
		this.su28Options = {
			...option,
			x: this.x + this.su28Offset,
			y: this.y + this.su28OffsetY,
			width: this.width - this.su28Offset * 2,
			height: this.height - this.su28OffsetY * 2,
		}

		this.su28chart = new Su28Chart(this.su28Options);

		this.fontSize = 18;
		this.color = AstroConst.AstroColor.Stroke;
		this.bgColor = SZConst.getHouseColor(0);
		this.margin = 3;
		this.fontFamily = [
			AstroConst.NormalFont,
			AstroConst.NormalFont,
			AstroConst.NormalFont,
			AstroConst.NormalFont,
			AstroConst.AstroChartFont,
			AstroConst.NormalFont,
		];

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

		if(houseObj.type && (houseObj.type === 'Planet' || houseObj.type === 'Generic')){
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
			let str = lbl + '<br />RA:' +  degs[0] + 'º' + degs[1] + "'； " + Math.round(houseObj.ra*10000)/10000+ 'º' ;
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


}

export default SZChartComm;
