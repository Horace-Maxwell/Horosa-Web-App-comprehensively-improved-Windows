import * as d3 from 'd3';
import * as AstroConst from '../../constants/AstroConst';
import * as Su28Helper from './Su28Helper';
import HouseSu from './HouseSu';
import { drawPath, drawTextH, drawTextV} from '../graph/GraphHelper';
import {randomStr,} from '../../utils/helper';

class HouseSu8 extends HouseSu{
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
		let h = this.height ;
		let w = this.width ;
		let x1 = this.x;
		let y1 = this.y;
		let x2 = x1;
		let y2 = y1 + h/2;
		let x3 = x1 + w;
		let y3 = y2;
		let x4 = x1 + w;
		let y4 = y1 - h/2;

		let points = [[x1, y1], [x2, y2], [x3, y3], [x4, y4]];
		drawPath(this.svg, points, this.color);
	}

	drawTitle(){
		let houseH = this.height;
		let x = this.x + this.width/2 - this.fontSize/2 - this.margin;
		let y = this.y + houseH/2 - this.fontSize - this.margin;
		let w = this.fontSize + this.margin * 2;
		let h = this.fontSize + this.margin;

		let data = [this.houseObj.name];

		this.titleSvg = drawTextH(this.svg, data, x, y, w, h, this.margin, Su28Helper.getSu28Color(8));		
		this.genTooltip();	
	}

	drawStar(){
		let startxts = this.getStarText();
		if(startxts.length === 0){
			return;
		}
		let fz = this.starFontSize;
		let w = fz + this.margin;
		let totalw = startxts.length * w;
		let x = this.x + this.width / 2 - totalw / 2;
		let y = this.y;
		for(let i=0; i<startxts.length; i++){
			let obj = startxts[i];
			let fontfamily = obj.fontFamily;
			let data = obj.data;
			let h = (fz + this.margin)*data.length;
			let lblsvg = drawTextV(this.svg, data, x, y, w, h, this.margin, this.color, null, null, null, null, fontfamily);	
			this.genTooltip(lblsvg, obj.planet);
			x = x + w;
		}

	}
}

export default HouseSu8;
