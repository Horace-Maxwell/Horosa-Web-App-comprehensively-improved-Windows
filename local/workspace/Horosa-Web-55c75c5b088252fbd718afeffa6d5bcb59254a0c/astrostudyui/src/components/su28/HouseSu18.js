import * as d3 from 'd3';
import * as AstroConst from '../../constants/AstroConst';
import * as Su28Helper from './Su28Helper';
import HouseSu from './HouseSu';
import { drawPath, drawTextH, drawTextV} from '../graph/GraphHelper';
import {randomStr,} from '../../utils/helper';

class HouseSu18 extends HouseSu{
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
		let houseH = this.height;
		let x = this.x + this.width - this.fontSize - this.margin*2;
		let y = this.y + houseH/2 - this.fontSize/2;
		let w = this.fontSize + this.margin*2;
		let h = this.fontSize + this.margin;

		let data = [this.houseObj.name];
		this.titleSvg = drawTextH(this.svg, data, x, y, w, h, this.margin, Su28Helper.getSu28Color(18));	
		this.genTooltip();	
	}

	drawStar(){
		let startxts = this.getStarText();
		if(startxts.length === 0){
			return;
		}
		let fz = this.starFontSize;
		let h = fz + this.margin;
		let cnth = this.height / h;
		let rowcnt = startxts.length > cnth ? cnth : startxts.length;

		let x = this.x + this.margin * 2;
		let orgy = this.y + this.height / 2 - h*rowcnt / 2;
		let y = orgy;
		for(let i=0; i<startxts.length; i++){
			let obj = startxts[i];
			let fontfamily = obj.fontFamily;
			let data = obj.data;
			let w = (fz + this.margin)*data.length;
			let lblsvg = drawTextH(this.svg, data, x, y, w, h, this.margin, this.color, null, null, null, null, fontfamily);	
			this.genTooltip(lblsvg, obj.planet);
			y = y + h;
			if(i === rowcnt){
				x = x + w + this.margin;
				y = orgy;
			}
		}

	}
}

export default HouseSu18;
