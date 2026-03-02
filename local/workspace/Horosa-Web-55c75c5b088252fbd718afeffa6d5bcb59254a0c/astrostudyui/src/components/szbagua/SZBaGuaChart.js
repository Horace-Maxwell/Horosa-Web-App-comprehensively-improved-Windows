import * as d3 from 'd3';
import * as AstroConst from '../../constants/AstroConst';
import Su28Chart from '../su28/Su28Chart';
import * as SZConst from '../suzhan/SZConst';
import { drawPath, drawTextH, drawTextV} from '../graph/GraphHelper';
import {randomStr,} from '../../utils/helper';
import SZChartComm from '../suzhan/SZChartComm';

class SZBaGuaChart extends SZChartComm{
	constructor(option){
		super(option);		
	}

	draw(){
		this.owner.select('#' + this.id).remove();
		let container = this.owner.append('g').attr('id', this.id);
		this.svg = container;
		this.svg.append('rect')
			.attr('fill', AstroConst.AstroColor.ChartBackgroud)
			.attr('x', this.x).attr('y', this.y)
			.attr('width', this.width).attr('height', this.height);
		
		this.su28chart.draw();
		this.drawHouses();
	}

	drawHouses(){
		let ords = this.getHouseXY();

		this.drawHouse0(ords[0]);
		this.drawHouse1(ords[1]);
		this.drawHouse2(ords[2]);
		this.drawHouse3(ords[3]);
		this.drawHouse4(ords[4]);
		this.drawHouse5(ords[5]);
		this.drawHouse6(ords[6]);
		this.drawHouse7(ords[7]);
	}

	getHouseXY(){
		let x = this.x;
		let y = this.y;
		let su28x = this.su28Options.x;
		let su28y = this.su28Options.y;
		let su28w = this.su28Options.width;
		let su28h = this.su28Options.height;
		let su28houseW = su28w / 3;
		let su28houseH = su28h / 3;

		let aryXY = [];
		aryXY[0] = {x: su28x+su28houseW*2, y: su28y+su28houseH*2, w:su28houseW+this.su28Offset, h:su28houseH+this.su28OffsetY};
		aryXY[1] = {x: su28x+su28houseW, y: su28y+su28houseH*2, w:su28houseW, h:su28houseH+this.su28OffsetY};
		aryXY[2] = {x: x, y:su28y+su28houseH*2, w:su28houseW+this.su28Offset, h:su28houseH+this.su28OffsetY};
		aryXY[3] = {x: x, y:su28y+su28houseH, w:su28houseW+this.su28Offset, h:su28houseH};
		aryXY[4] = {x: x, y:y, w:su28houseW+this.su28Offset, h:su28houseH + this.su28OffsetY};
		aryXY[5] = {x: su28x+su28houseW, y:y, w:su28houseW, h:su28houseH + this.su28OffsetY};
		aryXY[6] = {x: su28x+su28houseW*2, y:y, w:su28houseW+this.su28Offset, h:su28houseH+this.su28OffsetY};
		aryXY[7] = {x: su28x+su28houseW*2, y:su28y+su28houseH, w:su28houseW+this.su28Offset, h:su28houseH};

		return aryXY;
	}

	drawHouse0(ord){
		let x1 = ord.x;
		let y1 = ord.y;
		let x2 = x1 + ord.w;
		let y2 = y1;
		let x3 = x2;
		let y3 = y2 + ord.h;
		let x4 = x1;
		let y4 = y3;
		let points = [[x1, y1], [x2, y2], [x3, y3], [x4, y4]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let data = SZConst.BaGua[0];
		let w = this.fontSize + this.margin*2;
		let h = w;
		let x = x1 + ord.w - this.su28Offset + this.su28Offset / 2 - w / 2;
		let y = y1 + ord.h - this.su28OffsetY + this.su28OffsetY/2 - h/2 + this.margin;
		drawTextH(this.svg, data, x, y, w, h, this.margin, this.color, null, null, null, null, this.fontFamily);
	}

	drawHouse1(ord){
		let x1 = ord.x;
		let y1 = ord.y;
		let x2 = x1 + ord.w;
		let y2 = y1;
		let x3 = x2;
		let y3 = y2 + ord.h;
		let x4 = x1;
		let y4 = y3;
		let points = [[x1, y1], [x2, y2], [x3, y3], [x4, y4]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let data = SZConst.BaGua[1];
		let w = this.fontSize + this.margin*2;
		let h = w;
		let x = x1 + ord.w / 2 - w / 2;
		let y = y1 + ord.h - this.su28OffsetY + this.su28OffsetY/2 - h/2 + this.margin;
		drawTextH(this.svg, data, x, y, w, h, this.margin, this.color, null, null, null, null, this.fontFamily);
	}

	drawHouse2(ord){
		let x1 = ord.x;
		let y1 = ord.y;
		let x2 = x1 + ord.w;
		let y2 = y1;
		let x3 = x2;
		let y3 = y2 + ord.h;
		let x4 = x1;
		let y4 = y3;
		let points = [[x1, y1], [x2, y2], [x3, y3], [x4, y4]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let data = SZConst.BaGua[2];
		let w = this.fontSize + this.margin*2;
		let h = w;
		let x = x1 + this.su28Offset / 2 - w / 2;
		let y = y1 + ord.h - this.su28OffsetY + this.su28OffsetY/2 - h/2 + this.margin;
		drawTextH(this.svg, data, x, y, w, h, this.margin, this.color, null, null, null, null, this.fontFamily);
	}

	drawHouse3(ord){
		let x1 = ord.x;
		let y1 = ord.y;
		let x2 = x1 + ord.w;
		let y2 = y1;
		let x3 = x2;
		let y3 = y2 + ord.h;
		let x4 = x1;
		let y4 = y3;
		let points = [[x1, y1], [x2, y2], [x3, y3], [x4, y4]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let data = SZConst.BaGua[3];
		let h = this.fontSize + this.margin*2;
		let w = h;
		let x = x1 + this.su28Offset / 2 - w / 2;
		let y = y1 + ord.h / 2 - h / 2
		drawTextV(this.svg, data, x, y, w, h, this.margin, this.color, null, null, null, null, this.fontFamily);
	}

	drawHouse4(ord){
		let x1 = ord.x;
		let y1 = ord.y;
		let x2 = x1 + ord.w;
		let y2 = y1;
		let x3 = x2;
		let y3 = y2 + ord.h;
		let x4 = x1;
		let y4 = y3;
		let points = [[x1, y1], [x2, y2], [x3, y3], [x4, y4]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let data = SZConst.BaGua[4];
		let h = this.fontSize + this.margin*2;
		let w = h;
		let x = x1 + this.su28Offset/2 - w/2;
		let y = y1 + this.su28OffsetY/2 - h/2;
		drawTextH(this.svg, data, x, y, w, h, this.margin, this.color, null, null, null, null, this.fontFamily);
	}

	drawHouse5(ord){
		let x1 = ord.x;
		let y1 = ord.y;
		let x2 = x1 + ord.w;
		let y2 = y1;
		let x3 = x2;
		let y3 = y2 + ord.h;
		let x4 = x1;
		let y4 = y3;
		let points = [[x1, y1], [x2, y2], [x3, y3], [x4, y4]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let data = SZConst.BaGua[5];
		let h = this.fontSize + this.margin*2;
		let w = h;
		let x = x1 + ord.w / 2 - w / 2;
		let y = y1 + this.su28OffsetY / 2 - h / 2;
		drawTextH(this.svg, data, x, y, w, h, this.margin, this.color, null, null, null, null, this.fontFamily);
	}

	drawHouse6(ord){
		let x1 = ord.x;
		let y1 = ord.y;
		let x2 = x1 + ord.w;
		let y2 = y1;
		let x3 = x2;
		let y3 = y2 + ord.h;
		let x4 = x1;
		let y4 = y3;
		let points = [[x1, y1], [x2, y2], [x3, y3], [x4, y4]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let data = SZConst.BaGua[6];
		let w = this.fontSize + this.margin*2;
		let h = w;
		let x = x1 + ord.w - this.su28Offset + this.su28Offset / 2 - w / 2;
		let y = y1 + this.su28OffsetY / 2 - h / 2;
		drawTextH(this.svg, data, x, y, w, h, this.margin, this.color, null, null, null, null, this.fontFamily);
	}

	drawHouse7(ord){
		let x1 = ord.x;
		let y1 = ord.y;
		let x2 = x1 + ord.w;
		let y2 = y1;
		let x3 = x2;
		let y3 = y2 + ord.h;
		let x4 = x1;
		let y4 = y3;
		let points = [[x1, y1], [x2, y2], [x3, y3], [x4, y4]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let data = SZConst.BaGua[7];
		let w = this.fontSize + this.margin*2;
		let h = w;
		let x = x1 + ord.w - this.su28Offset + this.su28Offset / 2 - w / 2;
		let y = y1 + ord.h / 2 - h / 2
		drawTextV(this.svg, data, x, y, w, h, this.margin, this.color, null, null, null, null, this.fontFamily);
	}

}

export default SZBaGuaChart;
