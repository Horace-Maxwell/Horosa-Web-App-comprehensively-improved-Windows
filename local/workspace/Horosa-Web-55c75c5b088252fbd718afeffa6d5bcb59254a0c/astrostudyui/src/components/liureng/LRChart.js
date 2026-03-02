import * as AstroConst from '../../constants/AstroConst';
import LRInnerChart from './LRInnerChart';
import * as LRConst from './LRConst';
import LRCommChart from './LRCommChart';
import { drawPath, drawTextH, drawTextV} from '../graph/GraphHelper';


class LRChart extends LRCommChart {
	constructor(option){
		super(option);

		this.houses = [];
		this.svg = null;

		this.innerChartOffsetX = this.width / 6;
		this.innerChartOffsetY = this.height / 6;
		this.innerOptions = {
			...option,
			x: this.x + this.innerChartOffsetX,
			y: this.y + this.innerChartOffsetY,
			width: this.width - this.innerChartOffsetX * 2,
			height: this.height - this.innerChartOffsetY * 2,
			timezi: this.nongli.time.substr(1),			
		}

		this.innerChart = new LRInnerChart(this.innerOptions);

	}

	set cuangName(name){
		this.innerChart.cuangName = name;
		this.innerChart.draw();
	}

	draw(){
		super.draw();

		this.svg.append('rect')
			.attr('fill', AstroConst.AstroColor.ChartBackgroud)
			.attr('x', this.x).attr('y', this.y)
			.attr('width', this.width).attr('height', this.height);

		this.innerChart.draw();
		this.drawHouses();
		
	}

	getHouseXY(){
		let x = this.x;
		let y = this.y;
		let houseW = this.innerChartOffsetX;
		let houseH = this.innerChartOffsetY;

		let aryXY = [];
		aryXY[0] = {x:x+houseW*3, y:y+houseH*5, w:houseW, h:houseH};
		aryXY[1] = {x:x+houseW*2, y:y+houseH*5, w:houseW, h:houseH};
		aryXY[2] = {x:x, y:y+houseH*4, w:houseW, h:houseH};
		aryXY[3] = {x:x, y:y+houseH*3, w:houseW, h:houseH};
		aryXY[4] = {x:x, y:y+houseH*2, w:houseW, h:houseH};
		aryXY[5] = {x:x, y:y, w:houseW, h:houseH};
		aryXY[6] = {x:x+houseW*2, y:y, w:houseW, h:houseH};
		aryXY[7] = {x:x+houseW*3, y:y, w:houseW, h:houseH};
		aryXY[8] = {x:x+houseW*4, y:y, w:houseW, h:houseH};
		aryXY[9] = {x:x+houseW*5, y:y+houseH*2, w:houseW, h:houseH};
		aryXY[10] = {x:x+houseW*5, y:y+houseH*3, w:houseW, h:houseH};
		aryXY[11] = {x:x+houseW*5, y:y+houseH*4, w:houseW, h:houseH};

		return aryXY;
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


	drawHouse0(ord){
		let g = this.svg.append('g');
		let x1 = ord.x;
		let y1 = ord.y;
		let x2 = x1 + ord.w;
		let y2 = y1;
		let x3 = x2;
		let y3 = y2 + ord.h;
		let x4 = x1;
		let y4 = y3;
		let points = [[x1, y1], [x2, y2], [x3, y3], [x4, y4]];
		drawPath(g, points, this.color, this.bgColor);

		let jiangIdx = this.yueIndexs[0];
		let data = [LRConst.ZiList[jiangIdx]];
		let color = LRConst.LRColor.time.color;
		let bgColor = LRConst.LRColor.time.bg;

		let w = ord.w/2;
		let h = ord.h/2;
		let x = ord.x + ord.w/2 - w/2;
		let y = ord.y + ord.h - h - 2;
		if(data[0] === this.yue){
			drawTextH(g, data, x, y, w, h, 2, color, null, bgColor, color);
		}else{
			drawTextH(g, data, x, y, w, h, 2, this.color);
		}

		x = ord.x + 2;
		y = ord.y + 2;
		w = ord.w - 4;
		h = ord.h/2-6;
		data = this.houseTianJiang[0].split('');
		drawTextH(g, data, x, y, w, h, 2, this.tianJiangColor);

	}

	drawHouse1(ord){
		let g = this.svg.append('g');
		let x1 = ord.x;
		let y1 = ord.y;
		let x2 = x1 + ord.w;
		let y2 = y1;
		let x3 = x2;
		let y3 = y2 + ord.h;
		let x4 = x1;
		let y4 = y3;
		let points = [[x1, y1], [x2, y2], [x3, y3], [x4, y4]];
		drawPath(g, points, this.color, this.bgColor);

		let jiangIdx = this.yueIndexs[1];
		let data = [LRConst.ZiList[jiangIdx]];
		let color = LRConst.LRColor.time.color;
		let bgColor = LRConst.LRColor.time.bg;

		let w = ord.w/2;
		let h = ord.h/2;
		let x = ord.x + ord.w/2 - w/2;
		let y = ord.y + ord.h - h - 2;
		if(data[0] === this.yue){
			drawTextH(g, data, x, y, w, h, 2, color, null, bgColor, color);
		}else{
			drawTextH(g, data, x, y, w, h, 2, this.color);
		}

		x = ord.x + 2;
		y = ord.y + 2;
		w = ord.w - 4;
		h = ord.h/2-6;
		data = this.houseTianJiang[1].split('');
		drawTextH(g, data, x, y, w, h, 2, this.tianJiangColor);

	}

	drawHouse2(ord){
		let g = this.svg.append('g');
		let x1 = ord.x;
		let y1 = ord.y;
		let x2 = x1 + ord.w;
		let y2 = y1;
		let x3 = x2;
		let y3 = y2 + ord.h;
		let x4 = x3 + ord.w;
		let y4 = y3;
		let x5 = x4;
		let y5 = y4 + ord.h;
		let x6 = x1;
		let y6 = y5;
		let points = [[x1, y1], [x2, y2], [x3, y3], [x4, y4], [x5, y5], [x6, y6]];
		drawPath(g, points, this.color, this.bgColor);

		let jiangIdx = this.yueIndexs[2];
		let data = [LRConst.ZiList[jiangIdx]];
		let color = LRConst.LRColor.time.color;
		let bgColor = LRConst.LRColor.time.bg;

		let w = ord.w/2;
		let h = ord.h/2;
		let x = ord.x + 2;
		let y = ord.y + ord.h*2 - h - 2;
		if(data[0] === this.yue){
			drawTextH(g, data, x, y, w, h, 2, color, null, bgColor, color);
		}else{
			drawTextH(g, data, x, y, w, h, 2, this.color);
		}

		x = ord.x + ord.w/2 + 4;
		y = ord.y + 2;
		w = ord.w/2 - 6;
		h = ord.h-4;
		data = this.houseTianJiang[2].split('');
		drawTextV(g, data, x, y, w, h, 2, this.tianJiangColor);

	}

	drawHouse3(ord){
		let g = this.svg.append('g');
		let x1 = ord.x;
		let y1 = ord.y;
		let x2 = x1 + ord.w;
		let y2 = y1;
		let x3 = x2;
		let y3 = y2 + ord.h;
		let x4 = x1;
		let y4 = y3;
		let points = [[x1, y1], [x2, y2], [x3, y3], [x4, y4]];
		drawPath(g, points, this.color, this.bgColor);

		let jiangIdx = this.yueIndexs[3];
		let data = [LRConst.ZiList[jiangIdx]];
		let color = LRConst.LRColor.time.color;
		let bgColor = LRConst.LRColor.time.bg;

		let w = ord.w/2;
		let h = ord.h/2;
		let x = ord.x + 2;
		let y = ord.y + ord.h/2 - h/2 + 1;
		if(data[0] === this.yue){
			drawTextH(g, data, x, y, w, h, 2, color, null, bgColor, color);
		}else{
			drawTextH(g, data, x, y, w, h, 2, this.color);
		}

		x = ord.x + ord.w/2 + 4;
		y = ord.y + 2;
		w = ord.w/2 - 6;
		h = ord.h-4;
		data = this.houseTianJiang[3].split('');
		drawTextV(g, data, x, y, w, h, 2, this.tianJiangColor);

	}

	drawHouse4(ord){
		let g = this.svg.append('g');
		let x1 = ord.x;
		let y1 = ord.y;
		let x2 = x1 + ord.w;
		let y2 = y1;
		let x3 = x2;
		let y3 = y2 + ord.h;
		let x4 = x1;
		let y4 = y3;
		let points = [[x1, y1], [x2, y2], [x3, y3], [x4, y4]];
		drawPath(g, points, this.color, this.bgColor);

		let jiangIdx = this.yueIndexs[4];
		let data = [LRConst.ZiList[jiangIdx]];
		let color = LRConst.LRColor.time.color;
		let bgColor = LRConst.LRColor.time.bg;

		let w = ord.w/2;
		let h = ord.h/2;
		let x = ord.x + 2;
		let y = ord.y + ord.h/2 - h/2 + 1;
		if(data[0] === this.yue){
			drawTextH(g, data, x, y, w, h, 2, color, null, bgColor, color);
		}else{
			drawTextH(g, data, x, y, w, h, 2, this.color);
		}

		x = ord.x + ord.w/2 + 4;
		y = ord.y + 2;
		w = ord.w/2 - 6;
		h = ord.h-4;
		data = this.houseTianJiang[4].split('');
		drawTextV(g, data, x, y, w, h, 2, this.tianJiangColor);

	}

	drawHouse5(ord){
		let g = this.svg.append('g');
		let x1 = ord.x;
		let y1 = ord.y;
		let x2 = x1;
		let y2 = y1 + ord.h*2;
		let x3 = x2 + ord.w;
		let y3 = y2;
		let x4 = x3;
		let y4 = y3 - ord.h;
		let x5 = x4 + ord.w;
		let y5 = y4;
		let x6 = x5;
		let y6 = y5 - ord.h;
		let points = [[x1, y1], [x2, y2], [x3, y3], [x4, y4], [x5, y5], [x6, y6]];
		drawPath(g, points, this.color, this.bgColor);

		let jiangIdx = this.yueIndexs[5];
		let data = [LRConst.ZiList[jiangIdx]];
		let color = LRConst.LRColor.time.color;
		let bgColor = LRConst.LRColor.time.bg;

		let w = ord.w/2;
		let h = ord.h/2;
		let x = ord.x + 2;
		let y = ord.y + 2;
		if(data[0] === this.yue){
			drawTextH(g, data, x, y, w, h, 2, color, null, bgColor, color);
		}else{
			drawTextH(g, data, x, y, w, h, 2, this.color);
		}

		x = ord.x + ord.w/2 + 4;
		y = ord.y + ord.h + 2;
		w = ord.w/2 - 6;
		h = ord.h-4;
		data = this.houseTianJiang[5].split('');
		drawTextV(g, data, x, y, w, h, 2, this.tianJiangColor);

	}

	drawHouse6(ord){
		let g = this.svg.append('g');
		let x1 = ord.x;
		let y1 = ord.y;
		let x2 = x1 + ord.w;
		let y2 = y1;
		let x3 = x2;
		let y3 = y2 + ord.h;
		let x4 = x1;
		let y4 = y3;
		let points = [[x1, y1], [x2, y2], [x3, y3], [x4, y4]];
		drawPath(g, points, this.color, this.bgColor);

		let jiangIdx = this.yueIndexs[6];
		let data = [LRConst.ZiList[jiangIdx]];
		let color = LRConst.LRColor.time.color;
		let bgColor = LRConst.LRColor.time.bg;

		let w = ord.w/2;
		let h = ord.h/2;
		let x = ord.x + ord.w/2 - w/2;
		let y = ord.y + 2;
		if(data[0] === this.yue){
			drawTextH(g, data, x, y, w, h, 2, color, null, bgColor, color);
		}else{
			drawTextH(g, data, x, y, w, h, 2, this.color);
		}

		x = ord.x + 2;
		y = ord.y + ord.h/2 + 6;
		w = ord.w - 4;
		h = ord.h/2-6;
		data = this.houseTianJiang[6].split('');
		drawTextH(g, data, x, y, w, h, 2, this.tianJiangColor);

	}

	drawHouse7(ord){
		let g = this.svg.append('g');
		let x1 = ord.x;
		let y1 = ord.y;
		let x2 = x1 + ord.w;
		let y2 = y1;
		let x3 = x2;
		let y3 = y2 + ord.h;
		let x4 = x1;
		let y4 = y3;
		let points = [[x1, y1], [x2, y2], [x3, y3], [x4, y4]];
		drawPath(g, points, this.color, this.bgColor);

		let jiangIdx = this.yueIndexs[7];
		let data = [LRConst.ZiList[jiangIdx]];
		let color = LRConst.LRColor.time.color;
		let bgColor = LRConst.LRColor.time.bg;

		let w = ord.w/2;
		let h = ord.h/2;
		let x = ord.x + ord.w/2 - w/2;
		let y = ord.y + 2;
		if(data[0] === this.yue){
			drawTextH(g, data, x, y, w, h, 2, color, null, bgColor, color);
		}else{
			drawTextH(g, data, x, y, w, h, 2, this.color);
		}

		x = ord.x + 2;
		y = ord.y + ord.h/2 + 6;
		w = ord.w - 4;
		h = ord.h/2-6;
		data = this.houseTianJiang[7].split('');
		drawTextH(g, data, x, y, w, h, 2, this.tianJiangColor);


	}

	drawHouse8(ord){
		let g = this.svg.append('g');
		let x1 = ord.x;
		let y1 = ord.y;
		let x2 = x1 + ord.w*2;
		let y2 = y1;
		let x3 = x2;
		let y3 = y2 + ord.h*2;
		let x4 = x3 - ord.w;
		let y4 = y3;
		let x5 = x4;
		let y5 = y4 - ord.h;
		let x6 = x1;
		let y6 = y5;
		let points = [[x1, y1], [x2, y2], [x3, y3], [x4, y4], [x5, y5], [x6, y6]];
		drawPath(g, points, this.color, this.bgColor);

		let jiangIdx = this.yueIndexs[8];
		let data = [LRConst.ZiList[jiangIdx]];
		let color = LRConst.LRColor.time.color;
		let bgColor = LRConst.LRColor.time.bg;

		let w = ord.w/2;
		let h = ord.h/2;
		let x = ord.x + ord.w*2 - w - 2;
		let y = ord.y + 2;
		if(data[0] === this.yue){
			drawTextH(g, data, x, y, w, h, 2, color, null, bgColor, color);
		}else{
			drawTextH(g, data, x, y, w, h, 2, this.color);
		}

		x = ord.x + ord.w + 2;
		y = ord.y + ord.h + 2;
		w = ord.w/2 - 6;
		h = ord.h-4;
		data = this.houseTianJiang[8].split('');
		drawTextV(g, data, x, y, w, h, 2, this.tianJiangColor);

	}

	drawHouse9(ord){
		let g = this.svg.append('g');
		let x1 = ord.x;
		let y1 = ord.y;
		let x2 = x1 + ord.w;
		let y2 = y1;
		let x3 = x2;
		let y3 = y2 + ord.h;
		let x4 = x1;
		let y4 = y3;
		let points = [[x1, y1], [x2, y2], [x3, y3], [x4, y4]];
		drawPath(g, points, this.color, this.bgColor);

		let jiangIdx = this.yueIndexs[9];
		let data = [LRConst.ZiList[jiangIdx]];
		let color = LRConst.LRColor.time.color;
		let bgColor = LRConst.LRColor.time.bg;

		let w = ord.w/2;
		let h = ord.h/2;
		let x = ord.x + ord.w - w - 2;
		let y = ord.y + ord.h/2 - h/2 + 1;
		if(data[0] === this.yue){
			drawTextH(g, data, x, y, w, h, 2, color, null, bgColor, color);
		}else{
			drawTextH(g, data, x, y, w, h, 2, this.color);
		}

		x = ord.x + 2;
		y = ord.y + 2;
		w = ord.w/2 - 6;
		h = ord.h-4;
		data = this.houseTianJiang[9].split('');
		drawTextV(g, data, x, y, w, h, 2, this.tianJiangColor);


	}

	drawHouse10(ord){
		let g = this.svg.append('g');
		let x1 = ord.x;
		let y1 = ord.y;
		let x2 = x1 + ord.w;
		let y2 = y1;
		let x3 = x2;
		let y3 = y2 + ord.h;
		let x4 = x1;
		let y4 = y3;
		let points = [[x1, y1], [x2, y2], [x3, y3], [x4, y4]];
		drawPath(g, points, this.color, this.bgColor);

		let jiangIdx = this.yueIndexs[10];
		let data = [LRConst.ZiList[jiangIdx]];
		let color = LRConst.LRColor.time.color;
		let bgColor = LRConst.LRColor.time.bg;

		let w = ord.w/2;
		let h = ord.h/2;
		let x = ord.x + ord.w - w - 2;
		let y = ord.y + ord.h/2 - h/2 + 1;
		if(data[0] === this.yue){
			drawTextH(g, data, x, y, w, h, 2, color, null, bgColor, color);
		}else{
			drawTextH(g, data, x, y, w, h, 2, this.color);
		}

		x = ord.x + 2;
		y = ord.y + 2;
		w = ord.w/2 - 6;
		h = ord.h-4;
		data = this.houseTianJiang[10].split('');
		drawTextV(g, data, x, y, w, h, 2, this.tianJiangColor);


	}

	drawHouse11(ord){
		let g = this.svg.append('g');
		let x1 = ord.x;
		let y1 = ord.y;
		let x2 = x1 + ord.w;
		let y2 = y1;
		let x3 = x2;
		let y3 = y2 + ord.h*2;
		let x4 = x3 - ord.w*2;
		let y4 = y3;
		let x5 = x4;
		let y5 = y4 - ord.h;
		let x6 = x5 + ord.w;
		let y6 = y5;
		let points = [[x1, y1], [x2, y2], [x3, y3], [x4, y4], [x5, y5], [x6, y6]];
		drawPath(g, points, this.color, this.bgColor);

		let jiangIdx = this.yueIndexs[11];
		let data = [LRConst.ZiList[jiangIdx]];
		let color = LRConst.LRColor.time.color;
		let bgColor = LRConst.LRColor.time.bg;

		let w = ord.w/2;
		let h = ord.h/2;
		let x = ord.x + ord.w - w - 2;
		let y = ord.y + ord.h*2 - h - 2;
		if(data[0] === this.yue){
			drawTextH(g, data, x, y, w, h, 2, color, null, bgColor, color);
		}else{
			drawTextH(g, data, x, y, w, h, 2, this.color);
		}

		x = ord.x + 2;
		y = ord.y + 2;
		w = ord.w/2 - 6;
		h = ord.h-4;
		data = this.houseTianJiang[11].split('');
		drawTextV(g, data, x, y, w, h, 2, this.tianJiangColor);

	}

}

export default LRChart;
