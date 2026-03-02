import * as d3 from 'd3';
import * as AstroConst from '../../constants/AstroConst';
import * as Su28Helper from './Su28Helper';
import HouseSu from './HouseSu';
import { drawPath, drawTextH, drawTextV} from '../graph/GraphHelper';
import {randomStr,} from '../../utils/helper';

class HouseSu25 extends HouseSu{
	constructor(option){
		super(option)
	}

	draw(){
		super.draw();
		
		this.drawHouse();
		this.drawTitle();
		this.drawStar();
	}

	drawHouse(){
		let houseH = this.height;
		let houseW = this.width;
		let x = this.x;
		let y = this.y;

		this.svg.append('rect')
			.attr('fill', AstroConst.AstroColor.ChartBackgroud)
			.attr('x', x).attr('y', y)
			.attr('width', houseW).attr('height', houseH);
	}

	drawTitle(){
		let x = this.x + this.width/2 - this.fontSize/2 - this.margin;
		let y = this.y + this.margin;
		let w = this.fontSize + this.margin*2;
		let h = this.fontSize + this.margin;

		let data = [this.houseObj.name];
		this.titleSvg = drawTextH(this.svg, data, x, y, w, h, this.margin, Su28Helper.getSu28Color(25));	
		this.genTooltip();	
	}

	drawStar(){
		let startxts = this.getStarText();
		if(startxts.length === 0){
			return;
		}
		let fz = this.starFontSize;
		let w = fz + this.margin;
		let cntw = this.width / w;
		let colcnt = startxts.length > cntw ? cntw : startxts.length;
		let orgx = this.x + this.width / 2 - w*colcnt/2;
		let y = this.y + this.fontSize + this.margin*2;
		let x = orgx;
		for(let i=0; i<startxts.length; i++){
			let obj = startxts[i];
			let fontfamily = obj.fontFamily;
			let data = obj.data;
			let h = (fz + this.margin)*data.length;
			let lblsvg = drawTextV(this.svg, data, x, y, w, h, this.margin, this.color, null, null, null, null, fontfamily);	
			this.genTooltip(lblsvg, obj.planet);
			x = x + w;
			if(i === colcnt){
				y = y + h + this.margin;
				x = orgx;
			}
		}

	}
}

export default HouseSu25;
