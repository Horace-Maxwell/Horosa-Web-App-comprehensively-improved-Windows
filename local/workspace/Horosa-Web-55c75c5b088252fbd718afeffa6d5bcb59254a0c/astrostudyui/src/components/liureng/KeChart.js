import * as AstroConst from '../../constants/AstroConst';
import * as LRConst from './LRConst';
import {randomStr,} from '../../utils/helper';
import { drawPath, drawTextH, drawTextV} from '../graph/GraphHelper';


class KeChart {
	constructor(option){
		this.owner = option.owner;
		this.chartObj = option.chartObj;
		this.nongli = option.nongli;
		this.ke = option.ke;

		this.x = option.x;
		this.y = option.y;
		this.width = option.width;
		this.height = option.height;

		this.divTooltip = option.divTooltip;

		this.id = 'chart' + randomStr(8);

		this.svg = null;
		this.color = AstroConst.AstroColor.Stroke;
		this.bgColor = LRConst.getHouseColor(0);

	}

	draw(){
		this.owner.select('#' + this.id).remove();
		let container = this.owner.append('g').attr('id', this.id);
		this.svg = container;
		this.svg.append('rect')
			.attr('fill', AstroConst.AstroColor.ChartBackgroud)
			.attr('x', this.x).attr('y', this.y)
			.attr('width', this.width).attr('height', this.height);

		this.drawKes();
	}

	getKeXY(){
		let x = this.x;
		let y = this.y;
		let houseW = this.width/4;
		let houseH = this.height;

		let aryXY = [];
		aryXY[0] = {x:x+houseW*3, y:y, w:houseW, h:houseH};
		aryXY[1] = {x:x+houseW*2, y:y, w:houseW, h:houseH};
		aryXY[2] = {x:x+houseW, y:y, w:houseW, h:houseH};
		aryXY[3] = {x:x, y:y, w:houseW, h:houseH};
		return aryXY;
	}

	drawKes(){
		let ords = this.getKeXY();
		this.drawKe(ords[0], '一课', this.ke[0]);
		this.drawKe(ords[1], '二课', this.ke[1]);
		this.drawKe(ords[2], '三课', this.ke[2]);
		this.drawKe(ords[3], '四课', this.ke[3]);
	}

	drawKe(ord, title, data){
		let x1 = ord.x;
		let y1 = ord.y;
		let w = ord.w;
		let h = ord.h/4;
		
		this.svg.append('rect')
			.attr('fill', this.bgColor)
			.attr('x', x1).attr('y', y1)
			.attr('width', w).attr('height', h);
		this.svg.append('rect')
			.attr('fill', AstroConst.AstroColor.ChartBackgroud)
			.attr('x', x1).attr('y', y1 + ord.h/4)
			.attr('width', w).attr('height', 3*h);

		let tw = w*3/4;
		let x = x1 + w/2 - tw/2;
		let txtdata = title.split('');
		h = h/2;
		let y = ord.y + h/2;
		drawTextH(this.svg, txtdata, x, y, tw, h, 2, this.color);

		y1 = ord.y + ord.h/4;
		h = (ord.h - ord.h/4) / 2;
		txtdata = data[0].split('');
		drawTextV(this.svg, txtdata, x1, y1, w, h, 5, LRConst.LRColor.tianJiangColor);

		y1 = y1 + h;
		h = h;
		txtdata = [data[1], data[2]];
		drawTextV(this.svg, txtdata, x1, y1, w, h, 5, this.color);

	}


}

export default KeChart;
