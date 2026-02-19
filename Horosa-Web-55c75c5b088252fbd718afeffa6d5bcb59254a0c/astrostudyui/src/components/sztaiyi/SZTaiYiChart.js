import * as d3 from 'd3';
import * as AstroConst from '../../constants/AstroConst';
import Su28Chart from '../su28/Su28Chart';
import * as SZConst from '../suzhan/SZConst';
import { drawPath, drawTextH, drawTextV} from '../graph/GraphHelper';
import {randomStr,} from '../../utils/helper';
import SZChartComm from '../suzhan/SZChartComm';


class SZTaiYiChart extends SZChartComm{
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
		this.drawHouse8(ords[8]);
		this.drawHouse9(ords[9]);
		this.drawHouse10(ords[10]);
		this.drawHouse11(ords[11]);
		this.drawHouse12(ords[12]);
		this.drawHouse13(ords[13]);
		this.drawHouse14(ords[14]);
		this.drawHouse15(ords[15]);
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
		aryXY[0] = {x: su28x+su28w-su28houseW/2, y: su28y+su28houseH*2+su28houseH/2, w:this.su28Offset+su28houseW/2, h:su28houseH/2+this.su28OffsetY};
		aryXY[1] = {x: su28x+su28houseW*2-su28houseW/3, y: su28y+su28h, w:su28houseW/3+su28houseW/2, h:this.su28OffsetY};
		aryXY[2] = {x: su28x+su28houseW+su28houseW/3, y: su28y+su28h, w:su28houseW/3, h:this.su28OffsetY};
		aryXY[3] = {x: su28x+su28houseW/2, y: su28y+su28h, w:su28houseW/2+su28houseW/3, h:this.su28OffsetY};
		
		aryXY[4] = {x: x, y: su28y+su28houseH*2+su28houseH/2, w:su28houseW/2+this.su28Offset, h:this.su28OffsetY+su28houseH/2};
		aryXY[5] = {x: x, y: su28y+su28houseH+2*su28houseH/3, w:this.su28Offset, h:su28houseH/2+su28houseH/3};
		aryXY[6] = {x: x, y: su28y+su28houseH+su28houseH/3, w:this.su28Offset, h:su28houseH/3};
		aryXY[7] = {x: x, y: su28y+su28houseH/2, w:this.su28Offset, h:su28houseH/2+su28houseH/3};
		
		aryXY[8] = {x: x, y: y, w:this.su28Offset+su28houseW/2, h:su28houseH/2+this.su28OffsetY};
		aryXY[9] = {x: su28x+su28houseW/2, y: y, w:su28houseW/2+su28houseW/3, h:this.su28OffsetY};
		aryXY[10] = {x: su28x+su28houseW+su28houseW/3, y: y, w:su28houseW/3, h:this.su28OffsetY};
		aryXY[11] = {x: su28x+su28houseW+2*su28houseW/3, y: y, w:su28houseW/2+su28houseW/3, h:this.su28OffsetY};

		aryXY[12] = {x: su28x+su28houseW*2+su28houseW/2, y: y, w:this.su28Offset+su28houseW/2, h:su28houseH/2+this.su28OffsetY};
		aryXY[13] = {x: su28x+su28w, y: su28y+su28houseH/2, w:this.su28Offset, h:su28houseH/2+su28houseH/3};
		aryXY[14] = {x: su28x+su28w, y: su28y+su28houseH+su28houseH/3, w:this.su28Offset, h:su28houseH/3};
		aryXY[15] = {x: su28x+su28w, y: su28y+su28houseH+2*su28houseH/3, w:this.su28Offset, h:su28houseH/2+su28houseH/3};

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

		let w = this.fontSize + this.margin*2;
		let h = w;
		let x = x1 + ord.w - this.su28Offset + this.su28Offset / 2 - w / 2;
		let y = y1 + ord.h - this.su28OffsetY + this.su28OffsetY/2 - h/2 + this.margin;
		drawTextH(this.svg, SZConst.TaiYi[0], x, y, w, h, this.margin, this.color, null, null, null, null, this.fontFamily);
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

		let data = SZConst.TaiYi[1];
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

		let data = SZConst.TaiYi[2];
		let w = this.fontSize + this.margin*2;
		let h = w;
		let x = x1 + ord.w / 2 - w / 2;
		let y = y1 + ord.h - this.su28OffsetY + this.su28OffsetY/2 - h/2 + this.margin;
		drawTextV(this.svg, data, x, y, w, h, this.margin, this.color, null, null, null, null, this.fontFamily);
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

		let data = SZConst.TaiYi[3];
		let h = this.fontSize + this.margin*2;
		let w = h;
		let x = x1 + ord.w / 2 - w / 2;
		let y = y1 + ord.h - this.su28OffsetY + this.su28OffsetY/2 - h/2 + this.margin;
		drawTextH(this.svg, data, x, y, w, h, this.margin, this.color, null, null, null, null, this.fontFamily);
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

		let data = SZConst.TaiYi[4];
		let h = this.fontSize + this.margin*2;
		let w = h;
		let x = x1 + this.su28Offset / 2 - w / 2;
		let y = y1 + ord.h - this.su28OffsetY + this.su28OffsetY/2 - h/2 + this.margin;
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

		let data = SZConst.TaiYi[5];
		let h = this.fontSize + this.margin*2;
		let w = h;
		let x = x1 + this.su28Offset / 2 - w / 2;
		let y = y1 + ord.h / 2 - h / 2
		drawTextV(this.svg, data, x, y, w, h, this.margin, this.color, null, null, null, null, this.fontFamily);
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

		let data = SZConst.TaiYi[6];
		let w = this.fontSize + this.margin*2;
		let h = w;
		let x = x1 + this.su28Offset / 2 - w / 2;
		let y = y1 + ord.h / 2 - h / 2
		drawTextV(this.svg, data, x, y, w, h, this.margin, this.color, null, null, null, null, this.fontFamily);
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

		let data = SZConst.TaiYi[7];
		let w = this.fontSize + this.margin*2;
		let h = w;
		let x = x1 + this.su28Offset / 2 - w / 2;
		let y = y1 + ord.h / 2 - h / 2
		drawTextV(this.svg, data, x, y, w, h, this.margin, this.color, null, null, null, null, this.fontFamily);
	}

	drawHouse8(ord){
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

		let data = SZConst.TaiYi[8];
		let w = this.fontSize + this.margin*2;
		let h = w;
		let x = x1 + this.su28Offset/2 - w/2;
		let y = y1 + this.su28OffsetY/2 - h/2;
		drawTextH(this.svg, data, x, y, w, h, this.margin, this.color, null, null, null, null, this.fontFamily);
	}

	drawHouse9(ord){
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

		let data = SZConst.TaiYi[9];
		let h = this.fontSize + this.margin*2;
		let w = h;
		let x = x1 + ord.w / 2 - w / 2;
		let y = y1 + this.su28OffsetY / 2 - h / 2;
		drawTextH(this.svg, data, x, y, w, h, this.margin, this.color, null, null, null, null, this.fontFamily);
	}

	drawHouse10(ord){
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

		let data = SZConst.TaiYi[10];
		let h = this.fontSize + this.margin*2;
		let w = h;
		let x = x1 + ord.w / 2 - w / 2;
		let y = y1 + this.su28OffsetY / 2 - h / 2;
		drawTextH(this.svg, data, x, y, w, h, this.margin, this.color, null, null, null, null, this.fontFamily);
	}

	drawHouse11(ord){
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

		let data = SZConst.TaiYi[11];
		let h = this.fontSize + this.margin*2;
		let w = h;
		let x = x1 + ord.w / 2 - w / 2;
		let y = y1 + this.su28OffsetY / 2 - h / 2;
		drawTextH(this.svg, data, x, y, w, h, this.margin, this.color, null, null, null, null, this.fontFamily);
	}

	drawHouse12(ord){
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

		let data = SZConst.TaiYi[12];
		let h = this.fontSize + this.margin*2;
		let w = h;
		let x = x1 + ord.w - this.su28Offset + this.su28Offset / 2 - w / 2;
		let y = y1 + this.su28OffsetY / 2 - h / 2;
		drawTextH(this.svg, data, x, y, w, h, this.margin, this.color, null, null, null, null, this.fontFamily);
	}

	drawHouse13(ord){
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

		let data = SZConst.TaiYi[13];
		let h = this.fontSize + this.margin*2;
		let w = h;
		let x = x1 + ord.w - this.su28Offset + this.su28Offset / 2 - w / 2;
		let y = y1 + ord.h / 2 - h / 2
		drawTextV(this.svg, data, x, y, w, h, this.margin, this.color, null, null, null, null, this.fontFamily);
	}

	drawHouse14(ord){
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

		let data = SZConst.TaiYi[14];
		let h = this.fontSize + this.margin*2;
		let w = h;
		let x = x1 + ord.w - this.su28Offset + this.su28Offset / 2 - w / 2;
		let y = y1 + ord.h / 2 - h / 2
		drawTextV(this.svg, data, x, y, w, h, this.margin, this.color, null, null, null, null, this.fontFamily);
	}

	drawHouse15(ord){
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

		let data = SZConst.TaiYi[15];
		let h = this.fontSize + this.margin*2;
		let w = h;
		let x = x1 + ord.w - this.su28Offset + this.su28Offset / 2 - w / 2;
		let y = y1 + ord.h / 2 - h / 2
		drawTextV(this.svg, data, x, y, w, h, this.margin, this.color, null, null, null, null, this.fontFamily);
	}


}

export default SZTaiYiChart;
