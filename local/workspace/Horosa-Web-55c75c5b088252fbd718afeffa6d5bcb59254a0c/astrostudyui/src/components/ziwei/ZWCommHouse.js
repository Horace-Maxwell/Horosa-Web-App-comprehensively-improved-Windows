import * as d3 from 'd3';
import * as AstroConst from '../../constants/AstroConst';
import * as ZWCont from '../../constants/ZWConst';
import * as ZiWeiHelper from './ZiWeiHelper';
import * as GraphHelper from '../graph/GraphHelper';
import {randomStr, creatTooltip, genHtml} from '../../utils/helper';

export default class ZWCommHouse {
	constructor(option){
		this.owner = option.owner;
		this.x = option.x;
		this.y = option.y;
		this.width = option.width;
		this.height = option.height;
		this.houseObj = option.houseObj;
		this.dirname = option.dirname;
		this.yearText = option.yearText;
		this.chartObj = option.chartObj;
		this.flyGanzi = option.flyGanzi;
		this.zwchart = option.zwchart;
		this.dirIndex = option.dirIndex;
		if(this.houseObj){
			this.houseObj.houseChart = this;
		}
		this.onTipClick = option.onTipClick;

		this.margin = 3;
		this.svg = null;
		this.id = 'house' + randomStr(8);

		this.stars = new Map();
		this.fontSize = 18;
		this.houseBG = AstroConst.AstroColor.ChartBackgroud;

		this.divTooltip = option.divTooltip;
		this.divTooltipId = option.divTooltipId;

		this.ZWRules = option.rules ? option.rules.ZWRules : null;
		this.ZWRuleSihua = option.rules ? option.rules.ZWRuleSihua : null;
	}

	genTooltip(titleSvg, tipobj, name){
		if(this.divTooltip === undefined || this.divTooltip === null){
			return;
		}

		let lbl = genHtml(tipobj);
		titleSvg.on('mouseover', (evt)=>{
			let x = evt.pageX;
			let y = evt.pageY - 48;
			let ydelta = document.documentElement.clientHeight - y;
			if(tipobj.tips instanceof Array && tipobj.tips.length > 3){
				if(ydelta < 350){
					y = y - 350;
					if(tipobj.tips.length < 8){
						y = y + 250;
					}
				}	
			}

			let str = lbl;
			let tips = localStorage.getItem('ziweiTips');
			let flag = true;
			if(tips !== undefined && tips !== null){
				if(tips+'' === '1'){
					flag = true;
				}else{
					flag = false;
				}
			}
			if(flag){
				this.divTooltip.transition()		
					.duration(200)		
					.style("opacity", .9);
				this.divTooltip.html(str)
					.style("left", x + "px")
					.style("top", y + "px");
			}else{
				this.divTooltip.transition()		
					.duration(500)		
					.style("opacity", 0);
			}
		}).on('mouseout', (evt)=>{
			this.divTooltip.transition().duration(500).style("opacity", 0);
		}).on('click', (evt)=>{
			if(this.onTipClick){
				this.onTipClick(tipobj);
			}
			return false;
		});

	}

}