import * as d3 from 'd3';
import * as AstroConst from '../../constants/AstroConst';
import * as Su28Helper from './Su28Helper';
import HouseSu from './HouseSu';
import { drawPath, drawTextH, drawTextV} from '../graph/GraphHelper';
import {randomStr,} from '../../utils/helper';

class HouseSu6 extends HouseSu{
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
		let x1 = this.x;
		let y1 = this.y;
		let x2 = x1;
		let y2 = y1 + houseH;
		let x3 = x1 + houseW;
		let y3 = y1;

		let points = [[x1, y1], [x2, y2], [x3, y3]]
		drawPath(this.svg, points, this.color);		
	}

	drawTitle(){
		let x = this.x;
		let y = this.y + this.height - (this.fontSize*2 + this.margin);
		let w = this.fontSize + this.margin * 2;
		let h = this.fontSize + this.margin;

		let data = [this.houseObj.name];

		this.titleSvg = drawTextH(this.svg, data, x, y, w, h, this.margin, Su28Helper.getSu28Color(6));		
		this.genTooltip();	
	}

	drawStar(){
		let startxts = this.getStarText();
		if(startxts.length === 0){
			return;
		}
		let fz = this.starAngleFontSize;
		let x = this.x + this.margin;
		let y = this.y + this.margin;
		let h = fz + this.margin;
		for(let i=0; i<startxts.length; i++){
			let obj = startxts[i];
			let fontfamily = obj.fontFamily;
			let data = obj.data;
			let w = (fz + this.margin)*data.length;
			let lblsvg = drawTextH(this.svg, data, x, y, w, h, this.margin, this.color, null, null, null, null, fontfamily);	
			this.genTooltip(lblsvg, obj.planet);
			y = y + h;
		}

	}
}

export default HouseSu6;
