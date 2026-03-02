import * as d3 from 'd3';
import * as AstroConst from '../../constants/AstroConst';
import Su28Chart from '../su28/Su28Chart';
import * as SZConst from '../suzhan/SZConst';
import { drawPath, drawTextH, drawTextV} from '../graph/GraphHelper';
import {randomStr,} from '../../utils/helper';
import { SuiTuTong, } from '../../msg/bazimsg';
import SZChartComm from '../suzhan/SZChartComm';
import * as AstroText from '../../constants/AstroText';


class GLSZSignChart extends SZChartComm{
	constructor(option){
		option.su28Offset = 110;
		super(option);	

		this.ascSign = null;
		this.ascSignIndex = -1;	
		this.sigw = 30;
		this.godw = (this.su28Offset - this.sigw) / 2;

		this.sigH = this.sigw * this.su28OffsetY / this.su28Offset;
		this.godH = (this.su28OffsetY - this.sigH) / 2;
	}

	initDraw(){
		let gods = this.chartObj.nongli.bazi.guolaoGods.ziGods;
		for(let zi in gods){
			let zigods = gods[zi];
			zigods.allGods = [];
			for(let i=0; i<zigods.goodGods.length; i++){
				zigods.allGods.push(zigods.goodGods[i]);
			}
			for(let i=0; i<zigods.neutralGods.length; i++){
				zigods.allGods.push(zigods.neutralGods[i]);
			}
			for(let i=0; i<zigods.badGods.length; i++){
				zigods.allGods.push(zigods.badGods[i]);
			}
		}
		
		if(this.chartObj.signsObjRA){
			return;
		}

		this.chartObj.signsObjRA = {};
		for(let i=0; i<this.chartObj.signsRA.length; i++){
			let sigra = this.chartObj.signsRA[i];
			this.chartObj.signsObjRA[sigra.id] = sigra;
		}
	}

	draw(){
		if(this.chartObj === null || this.chartObj === undefined){
			return;
		}
		this.initDraw();

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

	drawGodsH(x, y, w, h, gods, color){
		let sz = gods.length;
		let wid = w / sz;
		let hei = h;
		let x1 = x;
		for(let i=0; i<sz; i++){
			let god = gods[i];
			let orgdata = god.split('');
			let data = [orgdata[0], orgdata[1]];
			drawTextV(this.svg, data, x1, y, wid, hei, this.margin, color);
			x1 += wid;
		}
	}

	drawGodsV(x, y, w, h, gods, color){
		let sz = gods.length;
		let hei = h / sz;
		let wid = w;
		let y1 = y;
		for(let i=0; i<sz; i++){
			let god = gods[i];
			let orgdata = god.split('');
			let data = [orgdata[0], orgdata[1]];
			drawTextH(this.svg, data, x, y1, wid, hei, this.margin, color);
			y1 += hei;
		}
	}

	genTaiSuiGods(houseIdx){
		let zi = SZConst.SZSignsCircle[houseIdx][0];
		let gods = this.chartObj.nongli.bazi.guolaoGods.ziGods[zi];
		let taisui = gods.taisuiGods;
		let nay = this.chartObj.nongli.bazi.year.naying;
		let wx = nay.substr(2,1);
		let zs = wx + '_' + zi;
		let txt = [SuiTuTong.wxzhi[zs]];
		taisui.map((item, idx)=>{
			txt.push(item);
		});
		return txt;
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

		let sigx1 = x2 - this.sigw;
		let sigy1 = y1;
		points = [[sigx1, sigy1], [x2, y2], [x3, y3], [sigx1, y3 - this.sigH]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let data = SZConst.SZSigns[0].slice(0);
		let houseN = this.getHouseNum(0);
		data.push(houseN + '');
		let w = this.fontSize + this.margin*2;
		let h = data.length * (this.margin + this.fontSize);
		let x = sigx1 + this.sigw / 2 - w / 2;
		let y = sigy1 + ord.h / 2 - h / 2;
		let sigsvg = drawTextV(this.svg, data, x, y, w, h, this.margin, SZConst.getSigColor(0), null, null, null, null, this.fontFamily);
		let su = this.chartObj.signsObjRA[AstroConst.LIST_SIGNS[0]];
		this.genTooltip(sigsvg, su, AstroText.AstroMsgCN[su.id] + ' ' + AstroText.AstroMsgCN['House' + houseN]);


		points = [[x1, y1], [x1+this.godw, y1], [x1+this.godw, y4+this.godw], [x4, y4]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let zi = SZConst.SZSignsCircle[0][0];
		let gods = this.chartObj.nongli.bazi.guolaoGods.ziGods[zi];
		let color = SZConst.getSigColor(0);
		this.drawGodsV(x1, y1, this.godw, y4-y1, this.genTaiSuiGods(0), color);
		this.drawGodsV(x1+this.godw, y1, this.godw, y3-y1-this.sigw-this.godw, gods.allGods, color);
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

		let sigx1 = x2 - this.sigw;
		let sigy1 = y1;
		points = [[sigx1, sigy1], [x2, y2], [x3, y3], [sigx1, y3]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let data = SZConst.SZSigns[1].slice(0);
		let houseN = this.getHouseNum(1);
		data.push(houseN + '');
		let w = this.fontSize + this.margin*2;
		let h = data.length * (this.margin + this.fontSize);
		let x = sigx1 + this.sigw / 2 - w / 2;
		let y = sigy1 + ord.h / 2 - h / 2
		let sigsvg = drawTextV(this.svg, data, x, y, w, h, this.margin, SZConst.getSigColor(1), null, null, null, null, this.fontFamily);
		let su = this.chartObj.signsObjRA[AstroConst.LIST_SIGNS[1]];
		this.genTooltip(sigsvg, su, AstroText.AstroMsgCN[su.id] + ' ' + AstroText.AstroMsgCN['House' + houseN]);

		
		points = [[x1, y1], [x1+this.godw, y1], [x1+this.godw, y4], [x4, y4]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let zi = SZConst.SZSignsCircle[1][0];
		let gods = this.chartObj.nongli.bazi.guolaoGods.ziGods[zi];
		let color = SZConst.getSigColor(1);
		this.drawGodsV(x1, y1, this.godw, y4-y1, this.genTaiSuiGods(1), color);
		this.drawGodsV(x1+this.godw, y1, this.godw, y4-y1, gods.allGods, color);

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

		let sigx1 = x3-this.sigw;
		let sigy1 = y2+this.sigH;
		points = [[sigx1, sigy1], [x2, y2], [x3, y3], [sigx1, y3]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let data = SZConst.SZSigns[2].slice(0);
		let houseN = this.getHouseNum(2);
		data.push(houseN + '');
		let w = this.fontSize + this.margin*2;
		let h = data.length * (this.margin + this.fontSize);
		let x = x3-this.sigw + this.sigw / 2 - w / 2;
		let y = y2 + ord.h / 2 - h / 2
		let sigsvg = drawTextV(this.svg, data, x, y, w, h, this.margin, SZConst.getSigColor(2), null, null, null, null, this.fontFamily);
		let su = this.chartObj.signsObjRA[AstroConst.LIST_SIGNS[2]];
		this.genTooltip(sigsvg, su, AstroText.AstroMsgCN[su.id] + ' ' + AstroText.AstroMsgCN['House' + houseN]);

		
		points = [[x1, y1], [x1+this.godw, y1-this.godw], [x4+this.godw, y4], [x4, y4]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let zi = SZConst.SZSignsCircle[2][0];
		let gods = this.chartObj.nongli.bazi.guolaoGods.ziGods[zi];
		let color = SZConst.getSigColor(2);
		this.drawGodsV(x1, y1, this.godw, y4-y1, this.genTaiSuiGods(2), color);
		this.drawGodsV(x1+this.godw, y1-this.godw, this.godw, y4-y1+this.godw, gods.allGods, color);
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

		points = [[x1, y1], [x2, y2], [x2-this.sigw, y1+this.sigH], [x4, y1+this.sigH]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let data = SZConst.SZSigns[3].slice(0);
		let houseN = this.getHouseNum(3);
		data.push(houseN + '');
		let h = this.fontSize + this.margin*2;
		let w = data.length * (this.margin + this.fontSize);
		let x = x1 + ord.w / 2 - w / 2;
		let y = y1 + this.sigH / 2 - h / 2
		let sigsvg = drawTextH(this.svg, data, x, y, w, h, this.margin, SZConst.getSigColor(3), null, null, null, null, this.fontFamily);
		let su = this.chartObj.signsObjRA[AstroConst.LIST_SIGNS[3]];
		this.genTooltip(sigsvg, su, AstroText.AstroMsgCN[su.id] + ' ' + AstroText.AstroMsgCN['House' + houseN]);

		
		points = [[x4, y4-this.godH], [x3+this.godw, y3-this.godH], [x3, y3], [x4, y4]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let zi = SZConst.SZSignsCircle[3][0];
		let gods = this.chartObj.nongli.bazi.guolaoGods.ziGods[zi];
		let color = SZConst.getSigColor(3);
		this.drawGodsH(x1, y4-this.godH, x3-x1, this.godH, this.genTaiSuiGods(3), color);
		this.drawGodsH(x1, y1+this.sigH, x3-x1+this.godH, this.godH, gods.allGods, color);
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

		points = [[x1, y1], [x2, y2], [x3, y1+this.sigH], [x4, y1+this.sigH]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let data = SZConst.SZSigns[4].slice(0);
		let houseN = this.getHouseNum(4);
		data.push(houseN + '');
		let h = this.fontSize + this.margin*2;
		let w = data.length * (this.margin + this.fontSize);
		let x = x1 + ord.w / 2 - w / 2;
		let y = y1 + this.sigH / 2 - h / 2
		let sigsvg = drawTextH(this.svg, data, x, y, w, h, this.margin, SZConst.getSigColor(4), null, null, null, null, this.fontFamily);
		let su = this.chartObj.signsObjRA[AstroConst.LIST_SIGNS[4]];
		this.genTooltip(sigsvg, su, AstroText.AstroMsgCN[su.id] + ' ' + AstroText.AstroMsgCN['House' + houseN]);

		
		points = [[x4, y4-this.godH], [x2, y4-this.godH], [x3, y3], [x4, y4]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let zi = SZConst.SZSignsCircle[4][0];
		let gods = this.chartObj.nongli.bazi.guolaoGods.ziGods[zi];
		let color = SZConst.getSigColor(4);
		this.drawGodsH(x1, y4-this.godH, x3-x1, this.godH, this.genTaiSuiGods(4), color);
		this.drawGodsH(x1, y1+this.sigH, x3-x1, this.godH, gods.allGods, color);
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

		points = [[x1, y1], [x2, y2], [x3, y1+this.sigH], [x1+this.sigw, y1+this.sigH]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let data = SZConst.SZSigns[5].slice(0);
		let houseN = this.getHouseNum(5);
		data.push(houseN + '');
		let h = this.fontSize + this.margin*2;
		let w = data.length * (this.margin + this.fontSize);
		let x = x1 + ord.w / 2 - w / 2;
		let y = y1 + this.sigH / 2 - h / 2
		let sigsvg = drawTextH(this.svg, data, x, y, w, h, this.margin, SZConst.getSigColor(5), null, null, null, null, this.fontFamily);
		let su = this.chartObj.signsObjRA[AstroConst.LIST_SIGNS[5]];
		this.genTooltip(sigsvg, su, AstroText.AstroMsgCN[su.id] + ' ' + AstroText.AstroMsgCN['House' + houseN]);
		

		points = [[x4-this.godw, y4-this.godH], [x2, y3-this.godH], [x3, y3], [x4, y4]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let zi = SZConst.SZSignsCircle[5][0];
		let gods = this.chartObj.nongli.bazi.guolaoGods.ziGods[zi];
		let color = SZConst.getSigColor(5);
		this.drawGodsH(x4, y4-this.godH, x3-x4, this.godH, this.genTaiSuiGods(5), color);
		this.drawGodsH(x4-this.godw, y1+this.sigH, x3-x4+this.godw, this.godH, gods.allGods, color);
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

		points = [[x1, y1], [x2, y2], [x2+this.sigw, y3], [x1+this.sigw, y1+this.sigH]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let data = SZConst.SZSigns[6].slice(0);
		let houseN = this.getHouseNum(6);
		data.push(houseN + '');
		let w = this.fontSize + this.margin*2;
		let h = data.length * (this.margin + this.fontSize);
		let x = x1 + this.sigw / 2 - w / 2;
		let y = y1 + ord.h / 2 - h / 2
		let sigsvg = drawTextV(this.svg, data, x, y, w, h, this.margin, SZConst.getSigColor(6), null, null, null, null, this.fontFamily);
		let su = this.chartObj.signsObjRA[AstroConst.LIST_SIGNS[6]];
		this.genTooltip(sigsvg, su, AstroText.AstroMsgCN[su.id] + ' ' + AstroText.AstroMsgCN['House' + houseN]);


		points = [[x4-this.godw, y4-this.godH], [x4, y4], [x3, y3], [x3-this.godw, y3]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let zi = SZConst.SZSignsCircle[6][0];
		let gods = this.chartObj.nongli.bazi.guolaoGods.ziGods[zi];
		let color = SZConst.getSigColor(6);
		this.drawGodsV(x4-this.godw, y4, this.godw, y3-y4, this.genTaiSuiGods(6), color);
		this.drawGodsV(x4-this.godw*2, y4-this.godH, this.godw, y3-y4+this.godH, gods.allGods, color);
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

		points = [[x1, y1], [x2, y2], [x2+this.sigw, y3], [x1+this.sigw, y1]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let data = SZConst.SZSigns[7].slice(0);
		let houseN = this.getHouseNum(7);
		data.push(houseN + '');
		let w = this.fontSize + this.margin*2;
		let h = data.length * (this.margin + this.fontSize);
		let x = x1 + this.sigw / 2 - w / 2;
		let y = y1 + ord.h / 2 - h / 2
		let sigsvg = drawTextV(this.svg, data, x, y, w, h, this.margin, SZConst.getSigColor(7), null, null, null, null, this.fontFamily);
		let su = this.chartObj.signsObjRA[AstroConst.LIST_SIGNS[7]];
		this.genTooltip(sigsvg, su, AstroText.AstroMsgCN[su.id] + ' ' + AstroText.AstroMsgCN['House' + houseN]);


		points = [[x4-this.godw, y4], [x4, y4], [x3, y3], [x3-this.godw, y3]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let zi = SZConst.SZSignsCircle[7][0];
		let gods = this.chartObj.nongli.bazi.guolaoGods.ziGods[zi];
		let color = SZConst.getSigColor(7);
		this.drawGodsV(x4-this.godw, y4, this.godw, y3-y4, this.genTaiSuiGods(7), color);
		this.drawGodsV(x1+this.sigw, y4, this.godw, y3-y4, gods.allGods, color);
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

		points = [[x1, y1], [x2, y2], [x2+this.sigw, y2-this.sigH], [x1+this.sigw, y1]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let data = SZConst.SZSigns[8].slice(0);
		let houseN = this.getHouseNum(8);
		data.push(houseN + '');
		let w = this.fontSize + this.margin*2;
		let h = data.length * (this.margin + this.fontSize);
		let x = x1 + this.sigw / 2 - w / 2;
		let y = y1 + ord.h / 2 - h / 2
		let sigsvg = drawTextV(this.svg, data, x, y, w, h, this.margin, SZConst.getSigColor(8), null, null, null, null, this.fontFamily);
		let su = this.chartObj.signsObjRA[AstroConst.LIST_SIGNS[8]];
		this.genTooltip(sigsvg, su, AstroText.AstroMsgCN[su.id] + ' ' + AstroText.AstroMsgCN['House' + houseN]);


		points = [[x4-this.godw, y4], [x4, y4], [x3, y3], [x3-this.godw, y3+this.godH]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let zi = SZConst.SZSignsCircle[8][0];
		let gods = this.chartObj.nongli.bazi.guolaoGods.ziGods[zi];
		let color = SZConst.getSigColor(8);
		this.drawGodsV(x4-this.godw, y4, this.godw, y3-y4, this.genTaiSuiGods(8), color);
		this.drawGodsV(x1+this.sigw, y4, this.godw, y3-y4+this.godH, gods.allGods, color);
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

		points = [[x2, y2], [x3, y3], [x3, y3-this.sigH], [x2+this.sigw, y2-this.sigH]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let data = SZConst.SZSigns[9].slice(0);
		let houseN = this.getHouseNum(9);
		data.push(houseN + '');
		let h = this.fontSize + this.margin*2;
		let w = data.length * (this.margin + this.fontSize);
		let x = x2 + ord.w / 2 - w / 2;
		let y = y3-this.sigH + this.sigH / 2 - h / 2
		let sigsvg = drawTextH(this.svg, data, x, y, w, h, this.margin, SZConst.getSigColor(9), null, null, null, null, this.fontFamily);
		let su = this.chartObj.signsObjRA[AstroConst.LIST_SIGNS[9]];
		this.genTooltip(sigsvg, su, AstroText.AstroMsgCN[su.id] + ' ' + AstroText.AstroMsgCN['House' + houseN]);


		points = [[x1-this.godw, y1+this.godH], [x4, y4+this.godH], [x4, y4], [x1, y1]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let zi = SZConst.SZSignsCircle[9][0];
		let gods = this.chartObj.nongli.bazi.guolaoGods.ziGods[zi];
		let color = SZConst.getSigColor(9);
		this.drawGodsH(x1, y1, x4-x1, this.godH, this.genTaiSuiGods(9), color);
		this.drawGodsH(x1-this.godw, y1+this.godH, x4-x1+this.godw, this.godH, gods.allGods, color);
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

		points = [[x2, y2-this.sigH], [x2, y2], [x3, y3], [x3, y3-this.sigH]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let data = SZConst.SZSigns[10].slice(0);
		let houseN = this.getHouseNum(10);
		data.push(houseN + '');
		let h = this.fontSize + this.margin*2;
		let w = data.length * (this.margin + this.fontSize);
		let x = x2 + ord.w / 2 - w / 2;
		let y = y2-this.sigH + this.sigH / 2 - h / 2
		let sigsvg = drawTextH(this.svg, data, x, y, w, h, this.margin, SZConst.getSigColor(10), null, null, null, null, this.fontFamily);
		let su = this.chartObj.signsObjRA[AstroConst.LIST_SIGNS[10]];
		this.genTooltip(sigsvg, su, AstroText.AstroMsgCN[su.id] + ' ' + AstroText.AstroMsgCN['House' + houseN]);


		points = [[x1, y1+this.godH], [x4, y4+this.godH], [x4, y4], [x1, y1]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let zi = SZConst.SZSignsCircle[10][0];
		let gods = this.chartObj.nongli.bazi.guolaoGods.ziGods[zi];
		let color = SZConst.getSigColor(10);
		this.drawGodsH(x1, y1, x4-x1, this.godH, this.genTaiSuiGods(10), color);
		this.drawGodsH(x1, y1+this.godH, x4-x1, this.godH, gods.allGods, color);
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

		points = [[x2, y2-this.sigH], [x2, y2], [x3, y3], [x3-this.sigw, y3-this.sigH]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let data = SZConst.SZSigns[11].slice(0);
		let houseN = this.getHouseNum(11);
		data.push(houseN + '');
		let h = this.fontSize + this.margin*2;
		let w = data.length * (this.margin + this.fontSize);
		let x = x2 + ord.w / 2 - w / 2;
		let y = y2-this.sigH + this.sigH / 2 - h / 2;
		let sigsvg = drawTextH(this.svg, data, x, y, w, h, this.margin, SZConst.getSigColor(11), null, null, null, null, this.fontFamily);
		let su = this.chartObj.signsObjRA[AstroConst.LIST_SIGNS[11]];
		this.genTooltip(sigsvg, su, AstroText.AstroMsgCN[su.id] + ' ' + AstroText.AstroMsgCN['House' + houseN]);

		points = [[x1, y1+this.godH], [x4+this.godw, y4+this.godH], [x4, y4], [x1, y1]];
		drawPath(this.svg, points, this.color, this.bgColor);

		let zi = SZConst.SZSignsCircle[11][0];
		let gods = this.chartObj.nongli.bazi.guolaoGods.ziGods[zi];
		let color = SZConst.getSigColor(11);
		this.drawGodsH(x1, y1, x4-x1, this.godH, this.genTaiSuiGods(11), color);
		this.drawGodsH(x1, y1+this.godH, x4-x1+this.godw, this.godH, gods.allGods, color);
	}


}

export default GLSZSignChart;
