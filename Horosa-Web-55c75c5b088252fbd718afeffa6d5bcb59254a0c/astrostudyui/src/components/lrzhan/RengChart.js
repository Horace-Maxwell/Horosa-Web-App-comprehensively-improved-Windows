import * as d3 from 'd3';
import * as AstroConst from '../../constants/AstroConst';
import {randomStr, formatDate, printArea} from '../../utils/helper';
import { drawTextH, } from '../graph/GraphHelper';
import LRCircleChart from '../liureng/LRCircleChart';
import LRChart from '../liureng/LRChart';
import KeChart from '../liureng/KeChart';
import ChuangChart from '../liureng/ChuangChart';
import GodChart from '../liureng/GodChart';
import { getSignZi, LRChartType, LRChart_Circle, LRChart_Square, TaiSui} from '../liureng/LRConst';
import { ZSList, ZhangSheng, } from '../liureng/LRZhangSheng';
import { HourZi, } from '../gua/GuaConst';

class RengChart {
	constructor(options){
		this.chartId = options.id;
		this.chartObj = options.chartObj;
		this.fields = options.fields;
		this.tooltipId = options.tooltipId;
		this.nongli = options.nongli;
		this.liureng = options.liureng;
		this.runyear = options.runyear;
		this.gender = options.gender;
		this.zhangshengElem = options.zhangshengElem;
		this.guireng = options.guireng;

		this.margin = 20;
		this.svgTopgroup = null;
		this.svg = null;

		this.bgColor = AstroConst.AstroColor.Fill;
		this.color = AstroConst.AstroColor.Stroke;
		this.fontSize = 20;

		this.rengs = [];
		this.yue = null;
		if(this.chartObj){
			for(let i=0; i<this.chartObj.objects.length; i++){
				let obj = this.chartObj.objects[i];
				if(obj.id === AstroConst.SUN){
					this.yue = getSignZi(obj.sign);
					break;
				}
			}	
		}

		this.ke = null;

	}

	set chart(chartobj){
		this.chartObj = chartobj;
		for(let i=0; i<chartobj.objects.length; i++){
			let obj = chartobj.objects[i];
			if(obj.id === AstroConst.SUN){
				this.yue = getSignZi(obj.sign);
				break;
			}
		}
	}

	draw(){
		if(this.chartObj === undefined || this.chartObj === null){
			return null;
		}
		let svgdom = document.getElementById(this.chartId); 
		if(svgdom === undefined || svgdom === null){
			return null;
		}
		let width = svgdom.clientWidth;
		let height = svgdom.clientHeight;
		if(width === 0 || height === 0){
			return null;
		}

		let realW = width - this.margin * 2;
		let realH = height - this.margin * 2;

		this.hasDrawGua = false;
		let svgid = '#' + this.chartId;
		this.svg = d3.select(svgid);
		this.svg.html('');
		this.svg.attr('stroke', this.color).attr("stroke-width", 1);
	
		this.svgTopgroup = this.svg.append('g');
		this.svgTopgroup.append('rect')
			.attr('fill', this.bgColor)
			.attr('stroke', this.color)
			.attr('x', this.margin)
			.attr('y', this.margin)
			.attr('width', realW).attr('height', realH);

		let titleH = 50;
		let w = realW/2;
		let h = (realH-titleH)/2;
		let cords = [];
		cords[0] = {x: this.margin, y: this.margin+titleH, w: w, h: h};
		cords[1] = {x: this.margin+w, y: this.margin+titleH, w: w, h: h};
		cords[2] = {x: this.margin, y: this.margin+titleH+h, w: w, h: h};
		cords[3] = {x: this.margin+w, y: this.margin+titleH+h, w: w, h: h};

		let titleords = {x: this.margin, y: this.margin, w: realW, h: titleH};
		let printBtnOrds = {x: this.margin + realW*6/7 , y: this.margin + realH - this.fontSize};


		this.drawGua1(cords[0]);
		this.drawGua2(cords[1]);
		this.drawGua3(cords[2]);
		this.drawGua4(cords[3]);

		this.drawTitle(titleords);
		this.drawPrintBtn(printBtnOrds.x, printBtnOrds.y);
	}

	drawGua1(cord){
		let w = cord.w - this.margin;
		let h = cord.h - this.margin;
		let x = cord.x + this.margin/2;
		let y = cord.y + this.margin/2;

		let opt = {
			chartObj: this.chartObj,
			fields: this.fields,
			x: x,
			y: y,
			width: w,
			height: h,
			owner: this.svgTopgroup,
			yue: this.yue,
			nongli: this.nongli,
			guireng: this.guireng,
		};

		let chartsvg = null;
		if(LRChartType === LRChart_Square){
			chartsvg = new LRChart(opt);
		}else{
			chartsvg = new LRCircleChart(opt);
		}
		this.rengs[0] = chartsvg;	
		this.rengs[0].draw();

		this.ke = this.rengs[0].getKe();

	}

	drawGua2(cord){
		let w = (cord.w - this.margin*2)*4/7;
		let h = cord.h - this.margin;
		let x = cord.x + this.margin/2;
		let y = cord.y + this.margin/2;

		if(this.rengs.length === 0 || this.rengs[0] === undefined || this.rengs[0] === null){
			return;
		}

		let opt = {
			chartObj: this.chartObj,
			x: x,
			y: y,
			width: w,
			height: h,
			owner: this.svgTopgroup,
			ke: this.ke,
			nongli: this.nongli,	
			guireng: this.guireng,		
		};
		let kesvg = new KeChart(opt);
		this.rengs[1] = kesvg;
		this.rengs[1].draw();

		let w1 = (cord.w - this.margin*2)*3/7;
		let h1 = h;
		let x1 = cord.x + w + this.margin;
		let y1 = y;
		let opt1 = {
			chartObj: this.chartObj,
			x: x1,
			y: y1,
			width: w1,
			height: h1,
			owner: this.svgTopgroup,
			ke: this.ke,
			nongli: this.nongli,
			guireng: this.guireng,
			liuRengChart: this.rengs[0],			
		};
		let csvg = new ChuangChart(opt1);
		this.rengs[2] = csvg;
		this.rengs[2].draw();

	}

	drawGua3(cord){
		let w = (cord.w - this.margin) / 3;
		let h = (cord.h - this.margin*2) / 2;
		let x = cord.x + this.margin/2;
		let y = cord.y + this.margin/2;

		if(this.liureng === undefined || this.liureng === null || 
			this.runyear === undefined || this.runyear === null){
			return;
		}
		
		let opt = {
			chartObj: this.chartObj,
			guireng: this.guireng,
			x: x,
			y: y,
			width: w - this.margin/2,
			height: h,
			owner: this.svgTopgroup,
			title: '行年',
			gods: this.getRunYear(),
		};
		let runyear = new GodChart(opt);
		runyear.draw();

		let y1 = y;
		let x1 = x + w;
		opt = {
			chartObj: this.chartObj,
			guireng: this.guireng,
			x: x1,
			y: y1,
			width: w - this.margin/2,
			height: h,
			owner: this.svgTopgroup,
			title: '旬日',
			gods: this.getXun(),
		};
		let xun = new GodChart(opt);
		xun.draw();

		let y2 = y;
		let x2 = x1 + w;
		opt = {
			chartObj: this.chartObj,
			guireng: this.guireng,
			x: x2,
			y: y2,
			width: w,
			height: h,
			owner: this.svgTopgroup,
			title: '旺衰',
			gods: this.getData(this.liureng.season),
		};
		let season = new GodChart(opt);
		season.draw();

		let y3 = y + h + this.margin / 2;
		let x3 = x;
		opt = {
			chartObj: this.chartObj,
			guireng: this.guireng,
			x: x3,
			y: y3,
			width: w - this.margin/2,
			height: h,
			owner: this.svgTopgroup,
			title: '基础神煞',
			gods: this.getData(this.liureng.gods),
		};
		let gods = new GodChart(opt);
		gods.draw();

		let y4 = y3;
		let x4 = x1;
		opt = {
			x: x4,
			y: y4,
			width: w - this.margin/2,
			height: h,
			owner: this.svgTopgroup,
			title: '干煞',
			gods: this.getData(this.liureng.godsGan),
			guireng: this.guireng,
		};
		let godsgan = new GodChart(opt);
		godsgan.draw();

		let y5 = y4;
		let x5 = x2;
		opt = {
			x: x5,
			y: y5,
			width: w,
			height: h,
			owner: this.svgTopgroup,
			title: '月煞',
			gods: this.getData(this.liureng.godsMonth),
			guireng: this.guireng,
		};
		let godsmonth = new GodChart(opt);
		godsmonth.draw();

	}

	drawGua4(cord){
		let w = (cord.w - this.margin) / 3;
		let h = (cord.h - this.margin*2) / 2;
		let x = cord.x + this.margin/2;
		let y = cord.y + this.margin/2;

		if(this.liureng === undefined || this.liureng === null || 
			this.runyear === undefined || this.runyear === null){
			return;
		}

		let opt = {
			x: x,
			y: y,
			width: w - this.margin/2,
			height: h * 2 - this.margin,
			owner: this.svgTopgroup,
			title: '支煞',
			gods: this.getData(this.liureng.godsZi),
			guireng: this.guireng,
		};
		let godszi = new GodChart(opt);
		godszi.draw();

		let y1 = y;
		let x1 = x + w;
		opt = {
			chartObj: this.chartObj,
			x: x1,
			y: y1,
			width: w - this.margin/2,
			height: h*2 - this.margin,
			owner: this.svgTopgroup,
			title: '年煞',
			gods: this.getYearGods(),
			guireng: this.guireng,
		};
		let godsyear = new GodChart(opt);
		godsyear.draw();

		let y2 = y1;
		let x2 = x1 + w;
		opt = {
			chartObj: this.chartObj,
			x: x2,
			y: y2,
			width: w - this.margin/2,
			height: h*2 - this.margin,
			owner: this.svgTopgroup,
			title: this.zhangshengElem + '十二长生',
			gods: this.getZhangSheng(),
			guireng: this.guireng,
		};
		let zs = new GodChart(opt);
		zs.draw();
	}

	getZhangSheng(){
		let res = ZSList.map((item, idx)=>{
			let k = this.zhangshengElem + '_' + item;
			return {
				key: item,
				value: ZhangSheng.wxphase[k],
			};
		});
		return res;
	}

	getRunYear(){
		let res = [{
			key: '行年',
			value: this.runyear.year,
		},{
			key: '年龄',
			value: this.runyear.age + '岁',
		},{
			key: '性别',
			value: this.gender ? '男' : '女',
		}];
		return res;
	}

	getYearGods(){
		let res = [];
		let taisui1 = this.liureng.godsYear.taisui1;
		for(let i=0; i<TaiSui.length; i++){
			let k = TaiSui[i];
			let god = {
				key: k,
				value: taisui1[k],
			};
			res.push(god);
		}
		return res;
	}

	getXun(){
		let xuns = [{
			key: '旬空',
			value: this.liureng.xun['旬空'],
		},{
			key: '旬首',
			value: this.liureng.xun['旬首'],
		},{
			key: '旬尾',
			value: this.liureng.xun['旬尾'],
		},{
			key: '旬丁',
			value: this.liureng.xun['旬丁'],
		}];

		return xuns;
	}

	getData(obj){
		let res = [];
		for(let k in obj){
			let data = {
				key: k,
				value: obj[k],
			}
			let pidx = k.indexOf('(');
			if(pidx >= 0){
				let name = k.substr(0, pidx);
				data.key = name;
			}
			if(data.value instanceof Array){
				data.value = data.value.join('');
			}
			res.push(data);
		}
		return res;
	}

	drawTitle(cord){
		let txt = '';
		if(this.liureng){
			if(this.nongli){
				txt = '真太阳时:' + this.nongli.birth;
			}
			let fourcol = this.liureng.fourColumns;
			txt = txt + '； 八字:' 
				+ fourcol.year.ganzi + '年 ' + fourcol.month.ganzi + '月 ' 
				+ fourcol.day.ganzi + '日 '+ fourcol.time.ganzi + '时';
			if(this.nongli){
				let leap = this.nongli.leap ? '闰' : '';
				txt = txt + '（' + leap + this.nongli.month + this.nongli.day + '）';
			}

		}else if(this.nongli){
			let leap = this.nongli.leap ? '闰' : '';
			txt = '真太阳时:' + this.nongli.birth + '； 农历:' 
				+ this.nongli.year + '年 ' + this.nongli.monthGanZi + '月 ' 
				+ this.nongli.dayGanZi + '日 '+ this.nongli.time + '时'
				+ '（' + leap + this.nongli.month + this.nongli.day + '）';
				
		}else{
			let dt = new Date();
			let h = dt.getHours();
			let zi = HourZi[h];
			txt = '起卦时间：' + formatDate(dt) + ' ' + zi + '时';
		}
		
		let marg = 2;
		let fontsz = 15
		let len = (txt.length-9) * fontsz;
		if(len > cord.w){
			len = cord.w;
			fontsz = cord.w / (txt.length-9);
		}
		let h = fontsz + marg*2;
		let x = cord.x + cord.w/2 - len/2;
		let y = cord.y + cord.h/2;
		let data = [txt];
		drawTextH(this.svgTopgroup, data, x, y, len, h, marg, this.color);
	}

	drawPrintBtn(x, y){
		let sz = 14;
		let sx = x;
		let sy = y;

		let txtsvg = this.svgTopgroup.append('g');
		txtsvg.append('text')
			.attr("dominant-baseline","middle")
			.attr("text-anchor", "left")
			.attr('font-weight', 100)
			.attr('stroke', AstroConst.AstroColor.Stroke)
			.attr('font-size', `${sz}px`)
			.attr('x', sx).attr('y', sy)
			.attr('style', 'cursor:hand')
			.text('打印卦盘');

		txtsvg.on('click', ()=>{
			let cid = this.chartId;
			printArea(cid);
		});

	}


}

export default RengChart;
