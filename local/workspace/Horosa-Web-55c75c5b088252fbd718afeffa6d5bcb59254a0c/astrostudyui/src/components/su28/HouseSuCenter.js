import * as d3 from 'd3';
import * as AstroConst from '../../constants/AstroConst';
import * as Su28Helper from './Su28Helper';
import HouseSu from './HouseSu';
import { drawPath, drawTextH, drawTextV} from '../graph/GraphHelper';
import {randomStr, printArea, genHtml} from '../../utils/helper';

class HouseSuCenter extends HouseSu{
	constructor(option){
		super(option);

		this.fontSize = 14;
	}

	draw(){
		super.draw();
		
		this.drawHouse();
		this.drawTitle();
	}

	drawHouse(){
		let w = this.width ;
		let h = this.height ;
		let x1 = this.x;
		let y1 = this.y;
		let x2 = x1 + w;
		let y2 = y1;
		let x3 = x2;
		let y3 = y1 + h;
		let x4 = x1;
		let y4 = y3;

		let points = [[x1, y1], [x2, y2], [x3, y3], [x4, y4]]
		drawPath(this.svg, points, this.color);
	}

	drawTitle(){
		let nongli = this.su28chart.chartObj.nongli;
		let bazi = nongli.bazi;
		let leap = nongli.leap ? '闰' : '';
		let nonglistr = `${nongli.year}年${leap}${nongli.month}${nongli.day}${nongli.time.substr(1)}时`;
		let baziganzi = `${bazi.year.ganzi},${bazi.month.ganzi},${bazi.day.ganzi},${bazi.time.ganzi}时`;
		let realtm = nongli.birth.split(' ');
		let data = [
			'时区：' + this.fields.zone.value,
			'经度：' + this.fields.lon.value,
			'纬度：' + this.fields.lat.value,
			'真太阳日：' + realtm[0],
			'真太阳时：' + realtm[1],
			'农历:' + nonglistr,
			'四柱:' + baziganzi,
		];
		if(this.fields.name.value && this.fields.name.value !== ''){
			data.push('姓名：' + this.fields.name.value)
		}
		data.push('打印');

		let zutips = {
			title: '四柱纳音',
			tips: [
				'年：'+ bazi.year.ganzi + '-' + bazi.year.naying,
				'月：'+ bazi.month.ganzi + '-' + bazi.month.naying,
				'日：'+ bazi.day.ganzi + '-' + bazi.day.naying,
				'时：'+ bazi.time.ganzi + '-' + bazi.time.naying,
			]
		}

		let fz = this.fontSize;
		let evlfz = this.height / (data.length+2) - this.margin * 2;
		if(evlfz < fz){
			fz = evlfz;
		}
		let x = this.x + fz;
		let y = this.y + fz*2;
		let h = fz + this.margin * 2;

		let txtgrp = [];
		let txtsvg = this.svg.append('g');
		for(let i=0; i<data.length; i++){
			let txt = data[i];
			txtgrp[i] = txtsvg.append('text')
				.attr("dominant-baseline","middle")
				.attr("text-anchor", "left")
				.attr('font-weight', 100)
				.attr('stroke', this.color)
				.attr('font-size', `${fz}px`)
				.attr('x', x).attr('y', y)
				.text(txt);

			if(txt.indexOf('四柱') >= 0){
				this.genTooltipByTips(txtgrp[i], zutips)
			}
			y = y + h;
		}

		if(txtgrp.length){
			txtgrp[txtgrp.length-1].attr('style', 'cursor:hand');
			txtgrp[txtgrp.length-1].on('click', ()=>{
				let cid = this.su28chart.chartId;
				printArea(cid);
			});	
		}


	}

}

export default HouseSuCenter;
