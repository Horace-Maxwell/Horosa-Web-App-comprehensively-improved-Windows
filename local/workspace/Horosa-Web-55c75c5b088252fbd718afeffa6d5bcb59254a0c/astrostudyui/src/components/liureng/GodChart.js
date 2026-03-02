import * as d3 from 'd3';
import * as AstroConst from '../../constants/AstroConst';
import * as LRConst from './LRConst';
import {randomStr, isNumber} from '../../utils/helper';
import { drawPath, drawTextH, drawTextV} from '../graph/GraphHelper';


class GodChart {
	constructor(option){
		this.owner = option.owner;
		this.title = option.title;
		this.gods = option.gods ? option.gods : [];

		this.x = option.x;
		this.y = option.y;
		this.width = option.width;
		this.height = option.height;

		this.divTooltip = option.divTooltip;

		this.id = 'chart' + randomStr(8);

		this.svg = null;
		this.color = AstroConst.AstroColor.Stroke;
		this.bgColor = LRConst.getHouseColor(0);
		this.margin = 2;
		this.titleFontSize = 20;
		this.godFontSize = 16;

	}

	draw(){
		this.owner.select('#' + this.id).remove();
		let container = this.owner.append('g').attr('id', this.id);
		this.svg = container;
		this.svg.append('rect')
			.attr('fill', AstroConst.AstroColor.ChartBackgroud)
			.attr('x', this.x).attr('y', this.y)
			.attr('width', this.width).attr('height', this.height);

		this.drawGods();
	}

	drawGods(){
		let x = this.x;
		let y = this.y;
		let w = this.width;
		let h = this.titleFontSize + this.margin*2;
		let realW = this.width - this.margin*2;
		let realH = this.height - this.margin*2;

		this.svg.append('rect')
			.attr('fill', this.bgColor)
			.attr('x', x).attr('y', y)
			.attr('width', w).attr('height', h);

		let txtdata = this.title.split('');
		drawTextH(this.svg, txtdata, x, y, w, h, this.margin*2, this.color, 400);
		
		y = y + h + this.margin;
		let namewidth = this.godFontSize*3;
		if(namewidth > realW / 2){
			namewidth = realW / 2;
		}
		let nameX = x + this.margin;
		let godX = x + namewidth + this.margin*2;
		let godH = this.godFontSize * 1.5;
		let godw = realW - namewidth - this.margin*2;
		let godsH = realH - h - this.margin*2;
		let eachH = godsH / this.gods.length;
		if(eachH < godH){
			godH = eachH;
		}

		
		for(let i=0; i<this.gods.length; i++){
			let god = this.gods[i];
			let txtdata = god.key.split('');
			drawTextH(this.svg, txtdata, nameX, y, namewidth, godH, this.margin, this.color, 300);
			
			txtdata = god.value.split('');
			let tmp = [];
			let txt = '';
			let numcnt = 0;
			for(let j=0; j<txtdata.length; j++){
				txt = txt + txtdata[j];
				if(isNumber(txtdata[j])){
					numcnt = numcnt + 1;
					if(txt.length === 2){
						tmp.push(txt);
						txt = '';	
					}
				}else{
					tmp.push(txt);
					txt = '';
				}	
			}
			
			txtdata = tmp;
			let totalw = (this.godFontSize + this.margin) * (god.value.lenght - numcnt/2);
			if(totalw < godw){
				godw = totalw;
			}

			drawTextH(this.svg, txtdata, godX, y, godw, godH, this.margin, this.color, 100);

			y = y + godH;	
		}
	}

}

export default GodChart;
