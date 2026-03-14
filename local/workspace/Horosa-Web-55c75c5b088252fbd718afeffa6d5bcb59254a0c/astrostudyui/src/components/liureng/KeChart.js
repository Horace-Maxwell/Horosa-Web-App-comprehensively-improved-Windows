import * as AstroConst from '../../constants/AstroConst';
import * as LRConst from './LRConst';
import {randomStr,} from '../../utils/helper';
import { drawPath, drawTextH, drawTextV} from '../graph/GraphHelper';


class KeChart {
	constructor(option){
		this.owner = option.owner;
		this.chartObj = option.chartObj;
		this.nongli = option.nongli;
		this.ke = Array.isArray(option.ke) ? option.ke : [];

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
		if(!this.owner){
			return;
		}
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
		const safeKes = [0, 1, 2, 3].map((idx)=>{
			const row = this.ke[idx];
			if(!(row instanceof Array)){
				return ['', '', ''];
			}
			return [
				row[0] !== undefined && row[0] !== null ? `${row[0]}` : '',
				row[1] !== undefined && row[1] !== null ? `${row[1]}` : '',
				row[2] !== undefined && row[2] !== null ? `${row[2]}` : '',
			];
		});
		this.drawKe(ords[0], '一课', safeKes[0]);
		this.drawKe(ords[1], '二课', safeKes[1]);
		this.drawKe(ords[2], '三课', safeKes[2]);
		this.drawKe(ords[3], '四课', safeKes[3]);
	}

	drawKe(ord, title, data){
		const safeData = data instanceof Array ? data : ['', '', ''];
		const topText = safeData[0] ? `${safeData[0]}` : '—';
		const midText = safeData[1] ? `${safeData[1]}` : '—';
		const bottomText = safeData[2] ? `${safeData[2]}` : '—';
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
		txtdata = topText.split('');
		drawTextV(this.svg, txtdata, x1, y1, w, h, 5, LRConst.LRColor.tianJiangColor);

		y1 = y1 + h;
		h = h;
		txtdata = [midText, bottomText];
		drawTextV(this.svg, txtdata, x1, y1, w, h, 5, this.color);

	}


}

export default KeChart;
