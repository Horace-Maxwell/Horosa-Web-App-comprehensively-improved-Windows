import * as AstroConst from '../../constants/AstroConst';
import * as LRConst from './LRConst';
import { drawPath, drawTextH, drawTextV} from '../graph/GraphHelper';
import {randomStr,} from '../../utils/helper';


class LRInnerChart {
	constructor(option){
		this.chartId = option.chartId;
		this.owner = option.owner;
		this.fields = option.fields;
		this.chartObj = option.chartObj;
		this.timezi = option.timezi;
		this.nongli = option.nongli;
		this.cuangName = null;


		this.x = option.x;
		this.y = option.y;
		this.width = option.width;
		this.height = option.height;

		this.divTooltip = option.divTooltip;

		this.id = 'chart' + randomStr(8);

		this.dirIndex = null;

		this.houses = [];
		this.svg = null;

		this.fontSize = 18;
		this.color = AstroConst.AstroColor.Stroke;
		this.bgColor = AstroConst.AstroColor.ChartBackgroud;
		this.margin = 3;

	}

	draw(){
		this.owner.select('#' + this.id).remove();
		let container = this.owner.append('g').attr('id', this.id);
		this.svg = container;
		this.svg.append('rect')
			.attr('fill', this.bgColor)
			.attr('stroke', this.color)
			.attr('x', this.x).attr('y', this.y)
			.attr('width', this.width).attr('height', this.height);

		this.drawHouses();
	}

	drawHouses(){
		let cords = this.getHouseXY();
		this.drawHouse0(cords[0]);
		this.drawHouse1(cords[1]);
		this.drawHouse2(cords[2]);
		this.drawHouse3(cords[3]);
		this.drawHouse4(cords[4]);
		this.drawHouse5(cords[5]);
		this.drawHouse6(cords[6]);
		this.drawHouse7(cords[7]);
		this.drawHouse8(cords[8]);
		this.drawHouse9(cords[9]);
		this.drawHouse10(cords[10]);
		this.drawHouse11(cords[11]);
		this.drawCenterHouse(cords[12]);
	}

	getHouseXY(){
		let realW = this.width;
		let realH = this.height;
		let houseW = realW / 4;
		let houseH = realH / 4;

		let x = this.x;
		let y = this.y;
		let aryXY = [];

		aryXY[0] = {x:x+houseW*2, y:y+houseH*3, w:houseW, h:houseH};
		aryXY[1] = {x:x+houseW, y:y+houseH*3, w:houseW, h:houseH};
		aryXY[2] = {x:x, y:y+houseH*3, w:houseW, h:houseH};
		aryXY[3] = {x:x, y:y+houseH*2, w:houseW, h:houseH};
		aryXY[4] = {x:x, y:y+houseH, w:houseW, h:houseH};
		aryXY[5] = {x:x, y:y, w:houseW, h:houseH};
		aryXY[6] = {x:x+houseW, y:y, w:houseW, h:houseH};
		aryXY[7] = {x:x+houseW*2, y:y, w:houseW, h:houseH};
		aryXY[8] = {x:x+houseW*3, y:y, w:houseW, h:houseH};
		aryXY[9] = {x:x+houseW*3, y:y+houseH, w:houseW, h:houseH};
		aryXY[10] = {x:x+houseW*3, y:y+houseH*2, w:houseW, h:houseH};
		aryXY[11] = {x:x+houseW*3, y:y+houseH*3, w:houseW, h:houseH};
		aryXY[12] = {x:x+houseW, y:y+houseH, w:houseW*2, h:houseH*2};

		return aryXY;
	}

	drawHouse(ord){
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
		return g;
	}

	drawHouseTitle(ord, house, data){
		let color = LRConst.LRColor.time.color;
		let bgColor = LRConst.LRColor.time.bg;

		let w = ord.w/2;
		let h = ord.h/2;
		let x = ord.x + ord.w/2 - w/2;
		let y = ord.y + ord.h/2 - h/2 + 1;
		if(data[0] === this.timezi){
			drawTextH(house, data, x, y, w, h, 2, color, null, bgColor, color);
		}else{
			drawTextH(house, data, x, y, w, h, 2, this.color);
		}
	}

	drawHouse0(ord){
		let house = this.drawHouse(ord);
		let data = [LRConst.ZiList[0]];
		this.drawHouseTitle(ord, house, data);
		this.houses[0] = house;
	}

	drawHouse1(ord){
		let house = this.drawHouse(ord);
		let data = [LRConst.ZiList[1]];
		this.drawHouseTitle(ord, house, data);
		this.houses[1] = house;
	}

	drawHouse2(ord){
		let house = this.drawHouse(ord);
		let data = [LRConst.ZiList[2]];
		this.drawHouseTitle(ord, house, data);
		this.houses[2] = house;
	}

	drawHouse3(ord){
		let house = this.drawHouse(ord);
		let data = [LRConst.ZiList[3]];
		this.drawHouseTitle(ord, house, data);
		this.houses[3] = house;
	}

	drawHouse4(ord){
		let house = this.drawHouse(ord);
		let data = [LRConst.ZiList[4]];
		this.drawHouseTitle(ord, house, data);
		this.houses[4] = house;
	}

	drawHouse5(ord){
		let house = this.drawHouse(ord);
		let data = [LRConst.ZiList[5]];
		this.drawHouseTitle(ord, house, data);
		this.houses[5] = house;
	}

	drawHouse6(ord){
		let house = this.drawHouse(ord);
		let data = [LRConst.ZiList[6]];
		this.drawHouseTitle(ord, house, data);
		this.houses[6] = house;
	}

	drawHouse7(ord){
		let house = this.drawHouse(ord);
		let data = [LRConst.ZiList[7]];
		this.drawHouseTitle(ord, house, data);
		this.houses[7] = house;
	}

	drawHouse8(ord){
		let house = this.drawHouse(ord);
		let data = [LRConst.ZiList[8]];
		this.drawHouseTitle(ord, house, data);
		this.houses[8] = house;
	}

	drawHouse9(ord){
		let house = this.drawHouse(ord);
		let data = [LRConst.ZiList[9]];
		this.drawHouseTitle(ord, house, data);
		this.houses[9] = house;
	}

	drawHouse10(ord){
		let house = this.drawHouse(ord);
		let data = [LRConst.ZiList[10]];
		this.drawHouseTitle(ord, house, data);
		this.houses[10] = house;
	}

	drawHouse11(ord){
		let house = this.drawHouse(ord);
		let data = [LRConst.ZiList[11]];
		this.drawHouseTitle(ord, house, data);
		this.houses[11] = house;		
	}

	drawCenterHouse(ord){
		let house = this.drawHouse(ord);
		this.houses[12] = house;
		if(this.cuangName === undefined || this.cuangName === null){
			return;
		}

		let fontsize = 20;
		let x = ord.x;
		let y = ord.y + fontsize;
		let w = ord.w;
		let h = fontsize;
		let data = this.nongli.dayGanZi.split('');
		data.push('日');
		drawTextH(house, data, x, y, w, h, 2, this.color);

		data = this.cuangName.split('');
		y = y + h + 5;
		drawTextH(house, data, x, y, w, h, 2, this.color);

	}

}

export default LRInnerChart;
