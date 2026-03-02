import * as d3 from 'd3';
import * as AstroConst from '../../constants/AstroConst';
import Su28Chart from '../su28/Su28Chart';
import * as SZConst from '../suzhan/SZConst';
import { drawPath, drawTextH, drawTextV} from '../graph/GraphHelper';
import {randomStr,} from '../../utils/helper';
import SZChartComm from '../suzhan/SZChartComm';


class SZFengYeChart extends SZChartComm{
	constructor(option){
		super(option);	
		this.ascSign = null;
		this.ascSignIndex = -1;	
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
		this.ascSign = this.su28chart.getAscSign();
		this.ascSignIndex = AstroConst.LIST_SIGNS.indexOf(this.ascSign);

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
	}

	getHouseNum(houseIdx){
		let idx = (houseIdx - this.ascSignIndex + 12) % 12 + 1;
		return idx;
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
		aryXY[0] = {x: su28x+su28w, y: su28y+su28houseH*2, w:this.su28Offset, h:su28houseH+this.su28OffsetY};
		aryXY[1] = {x: su28x+su28w, y: su28y+su28houseH, w:this.su28Offset, h:su28houseH};
		aryXY[2] = {x: su28x+su28w, y: su28y, w:this.su28Offset, h:su28houseH+this.su28OffsetY};
		aryXY[3] = {x: su28x+su28houseW*2, y: y, w:su28houseW+this.su28Offset, h:this.su28OffsetY};
		aryXY[4] = {x: su28x+su28houseW, y: y, w:su28houseW, h:this.su28OffsetY};
		aryXY[5] = {x: x, y: y, w:su28houseW+this.su28Offset, h:this.su28OffsetY};
		aryXY[6] = {x: x, y: y, w:this.su28Offset, h:su28houseH+this.su28OffsetY};
		aryXY[7] = {x: x, y: su28y+su28houseH, w:this.su28Offset, h:su28houseH};
		aryXY[8] = {x: x, y: su28y+su28houseH*2, w:this.su28Offset, h:su28houseH+this.su28OffsetY};
		aryXY[9] = {x: su28x, y: su28y+su28h, w:su28houseW+this.su28Offset, h:this.su28OffsetY};
		aryXY[10] = {x: su28x+su28houseW, y: su28y+su28h, w:su28houseW, h:this.su28OffsetY};
		aryXY[11] = {x: su28x+su28houseW*2, y: su28y+su28h, w:su28houseW+this.su28Offset, h:this.su28OffsetY};

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
		let y4 = y3 - this.su28OffsetY;
		let points = [[x1, y1], [x2, y2], [x3, y3], [x4, y4]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let data = SZConst.SZFengYe[0].slice(0);
		let houseN = this.getHouseNum(0);
		data.push(houseN + '');
		let w = this.fontSize + this.margin*2;
		let h = data.length * (this.margin + this.fontSize);
		let x = x1 + ord.w / 2 - w / 2;
		let y = y1 + ord.h / 2 - h / 2;
		drawTextV(this.svg, data, x, y, w, h, this.margin, SZConst.getSigColor(0), null, null, null, null, this.fontFamily);
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

		let data = SZConst.SZFengYe[1].slice(0);
		let houseN = this.getHouseNum(1);
		data.push(houseN + '');
		let w = this.fontSize + this.margin*2;
		let h = data.length * (this.margin + this.fontSize);
		let x = x1 + ord.w / 2 - w / 2;
		let y = y1 + ord.h / 2 - h / 2
		drawTextV(this.svg, data, x, y, w, h, this.margin, SZConst.getSigColor(1), null, null, null, null, this.fontFamily);
	}

	drawHouse2(ord){
		let x1 = ord.x;
		let y1 = ord.y;
		let x2 = x1 + this.su28Offset;
		let y2 = y1 - this.su28OffsetY;
		let x3 = x2;
		let y3 = y2 + ord.h;
		let x4 = x1;
		let y4 = y3;
		let points = [[x1, y1], [x2, y2], [x3, y3], [x4, y4]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let data = SZConst.SZFengYe[2].slice(0);
		let houseN = this.getHouseNum(2);
		data.push(houseN + '');
		let w = this.fontSize + this.margin*2;
		let h = data.length * (this.margin + this.fontSize);
		let x = x1 + ord.w / 2 - w / 2;
		let y = y2 + ord.h / 2 - h / 2
		drawTextV(this.svg, data, x, y, w, h, this.margin, SZConst.getSigColor(2), null, null, null, null, this.fontFamily);
	}

	drawHouse3(ord){
		let x1 = ord.x;
		let y1 = ord.y;
		let x2 = x1 + ord.w;
		let y2 = y1;
		let x3 = x1 + ord.w - this.su28Offset;
		let y3 = y1 + this.su28OffsetY;
		let x4 = x1;
		let y4 = y3;
		let points = [[x1, y1], [x2, y2], [x3, y3], [x4, y4]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let data = SZConst.SZFengYe[3].slice(0);
		let houseN = this.getHouseNum(3);
		data.push(houseN + '');
		let h = this.fontSize + this.margin*2;
		let w = data.length * (this.margin + this.fontSize);
		let x = x1 + ord.w / 2 - w / 2;
		let y = y1 + ord.h / 2 - h / 2
		drawTextH(this.svg, data, x, y, w, h, this.margin, SZConst.getSigColor(3), null, null, null, null, this.fontFamily);
	}

	drawHouse4(ord){
		let x1 = ord.x;
		let y1 = ord.y;
		let x2 = x1 + ord.w;
		let y2 = y1;
		let x3 = x2;
		let y3 = y2 + this.su28OffsetY;
		let x4 = x1;
		let y4 = y3;
		let points = [[x1, y1], [x2, y2], [x3, y3], [x4, y4]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let data = SZConst.SZFengYe[4].slice(0);
		let houseN = this.getHouseNum(4);
		data.push(houseN + '');
		let h = this.fontSize + this.margin*2;
		let w = data.length * (this.margin + this.fontSize);
		let x = x1 + ord.w / 2 - w / 2;
		let y = y1 + ord.h / 2 - h / 2
		drawTextH(this.svg, data, x, y, w, h, this.margin, SZConst.getSigColor(4), null, null, null, null, this.fontFamily);
	}

	drawHouse5(ord){
		let x1 = ord.x;
		let y1 = ord.y;
		let x2 = x1 + ord.w;
		let y2 = y1;
		let x3 = x2;
		let y3 = y2 + this.su28OffsetY;
		let x4 = x1 + this.su28Offset;
		let y4 = y3;
		let points = [[x1, y1], [x2, y2], [x3, y3], [x4, y4]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let data = SZConst.SZFengYe[5].slice(0);
		let houseN = this.getHouseNum(5);
		data.push(houseN + '');
		let h = this.fontSize + this.margin*2;
		let w = data.length * (this.margin + this.fontSize);
		let x = x1 + ord.w / 2 - w / 2;
		let y = y1 + ord.h / 2 - h / 2
		drawTextH(this.svg, data, x, y, w, h, this.margin, SZConst.getSigColor(5), null, null, null, null, this.fontFamily);
	}

	drawHouse6(ord){
		let x1 = ord.x;
		let y1 = ord.y;
		let x2 = x1;
		let y2 = y1 + ord.h;
		let x3 = x2 + this.su28Offset;
		let y3 = y2;
		let x4 = x3;
		let y4 = y1 + this.su28OffsetY;
		let points = [[x1, y1], [x2, y2], [x3, y3], [x4, y4]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let data = SZConst.SZFengYe[6].slice(0);
		let houseN = this.getHouseNum(6);
		data.push(houseN + '');
		let w = this.fontSize + this.margin*2;
		let h = data.length * (this.margin + this.fontSize);
		let x = x1 + ord.w / 2 - w / 2;
		let y = y1 + ord.h / 2 - h / 2
		drawTextV(this.svg, data, x, y, w, h, this.margin, SZConst.getSigColor(6), null, null, null, null, this.fontFamily);
	}

	drawHouse7(ord){
		let x1 = ord.x;
		let y1 = ord.y;
		let x2 = x1;
		let y2 = y1 + ord.h;
		let x3 = x2 + ord.w;
		let y3 = y2;
		let x4 = x3;
		let y4 = y1;
		let points = [[x1, y1], [x2, y2], [x3, y3], [x4, y4]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let data = SZConst.SZFengYe[7].slice(0);
		let houseN = this.getHouseNum(7);
		data.push(houseN + '');
		let w = this.fontSize + this.margin*2;
		let h = data.length * (this.margin + this.fontSize);
		let x = x1 + ord.w / 2 - w / 2;
		let y = y1 + ord.h / 2 - h / 2
		drawTextV(this.svg, data, x, y, w, h, this.margin, SZConst.getSigColor(7), null, null, null, null, this.fontFamily);
	}

	drawHouse8(ord){
		let x1 = ord.x;
		let y1 = ord.y;
		let x2 = x1;
		let y2 = y1 + ord.h;
		let x3 = x2 + ord.w;
		let y3 = y2 - this.su28OffsetY;
		let x4 = x3;
		let y4 = y1;
		let points = [[x1, y1], [x2, y2], [x3, y3], [x4, y4]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let data = SZConst.SZFengYe[8].slice(0);
		let houseN = this.getHouseNum(8);
		data.push(houseN + '');
		let w = this.fontSize + this.margin*2;
		let h = data.length * (this.margin + this.fontSize);
		let x = x1 + ord.w / 2 - w / 2;
		let y = y1 + ord.h / 2 - h / 2
		drawTextV(this.svg, data, x, y, w, h, this.margin, SZConst.getSigColor(8), null, null, null, null, this.fontFamily);
	}

	drawHouse9(ord){
		let x1 = ord.x;
		let y1 = ord.y;
		let x2 = x1 - this.su28Offset;
		let y2 = y1 + this.su28OffsetY;
		let x3 = x2 + ord.w;
		let y3 = y2;
		let x4 = x3;
		let y4 = y1;
		let points = [[x1, y1], [x2, y2], [x3, y3], [x4, y4]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let data = SZConst.SZFengYe[9].slice(0);
		let houseN = this.getHouseNum(9);
		data.push(houseN + '');
		let h = this.fontSize + this.margin*2;
		let w = data.length * (this.margin + this.fontSize);
		let x = x2 + ord.w / 2 - w / 2;
		let y = y1 + ord.h / 2 - h / 2
		drawTextH(this.svg, data, x, y, w, h, this.margin, SZConst.getSigColor(9), null, null, null, null, this.fontFamily);
	}

	drawHouse10(ord){
		let x1 = ord.x;
		let y1 = ord.y;
		let x2 = x1;
		let y2 = y1 + this.su28OffsetY;
		let x3 = x2 + ord.w;
		let y3 = y2;
		let x4 = x3;
		let y4 = y1;
		let points = [[x1, y1], [x2, y2], [x3, y3], [x4, y4]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let data = SZConst.SZFengYe[10].slice(0);
		let houseN = this.getHouseNum(10);
		data.push(houseN + '');
		let h = this.fontSize + this.margin*2;
		let w = data.length * (this.margin + this.fontSize);
		let x = x1 + ord.w / 2 - w / 2;
		let y = y1 + ord.h / 2 - h / 2
		drawTextH(this.svg, data, x, y, w, h, this.margin, SZConst.getSigColor(10), null, null, null, null, this.fontFamily);
	}

	drawHouse11(ord){
		let x1 = ord.x;
		let y1 = ord.y;
		let x2 = x1;
		let y2 = y1 + this.su28OffsetY;
		let x3 = x2 + ord.w;
		let y3 = y2;
		let x4 = x1 + ord.w - this.su28Offset;
		let y4 = y1;
		let points = [[x1, y1], [x2, y2], [x3, y3], [x4, y4]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let data = SZConst.SZFengYe[11].slice(0);
		let houseN = this.getHouseNum(11);
		data.push(houseN + '');
		let h = this.fontSize + this.margin*2;
		let w = data.length * (this.margin + this.fontSize);
		let x = x1 + ord.w / 2 - w / 2;
		let y = y1 + ord.h / 2 - h / 2
		drawTextH(this.svg, data, x, y, w, h, this.margin, SZConst.getSigColor(11), null, null, null, null, this.fontFamily);
	}


}

export default SZFengYeChart;
