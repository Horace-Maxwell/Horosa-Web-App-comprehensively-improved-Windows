import * as d3 from 'd3';
import * as AstroConst from '../../constants/AstroConst';
import {randomStr, formatDate, printArea} from '../../utils/helper';
import { drawTextH, } from '../graph/GraphHelper';
import Gua from '../gua/Gua';
import TextTable from '../graph/TextTable';
import { randYao, setupYao, ZiList, HourZi, getXunEmpty} from '../gua/GuaConst';

class GZChart {
	constructor(options){
		this.chartId = options.id;
		this.chartObj = options.chartObj;
		this.fields = options.fields;
		this.tooltipId = options.tooltipId;
		this.nongli = options.nongli;

		this.margin = 20;
		this.svgTopgroup = null;
		this.svg = null;

		this.bgColor = AstroConst.AstroColor.Fill;
		this.color = AstroConst.AstroColor.Stroke;
		this.fontSize = 20;

		this.guas = [];
		this.hasDrawGua = false;

		if(options.yao){
			this.yao = options.yao;
		}else{
			this.yao = [{
				value:-1, change:false, color:AstroConst.AstroColor.Stroke, god:null, name:null, nameColor:null
			},{
				value:-1, change:false, color:AstroConst.AstroColor.Stroke, god:null, name:null, nameColor:null
			},{
				value:-1, change:false, color:AstroConst.AstroColor.Stroke, god:null, name:null, nameColor:null
			},{
				value:-1, change:false, color:AstroConst.AstroColor.Stroke, god:null, name:null, nameColor:null
			},{
				value:-1, change:false, color:AstroConst.AstroColor.Stroke, god:null, name:null, nameColor:null
			},{
				value:-1, change:false, color:AstroConst.AstroColor.Stroke, god:null, name:null, nameColor:null
			}];	
			for(let i=0; i<this.yao.length; i++){
				let ryao = randYao();
				this.yao[i].value = ryao.value;
				this.yao[i].change = ryao.change;
			}
		}

		this.showYaoName = false;
		if(this.yao[0].name){
			this.showYaoName = true;
		}

	}

	set chart(chartobj){
		this.chartObj = chartobj;
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
		let printBtnOrds = {x: this.margin + 3*realW/4, y: this.margin + realH - this.fontSize};

		if(this.yao[0].name){
			this.showYaoName = true;
		}else{
			this.showYaoName = false;
		}

		this.drawGua1(cords[0]);
		this.drawGua2(cords[1]);
		this.drawGua3(cords[2]);
		this.drawGua4(cords[3]);

		this.drawTitle(titleords);
		this.drawPrintBtn(printBtnOrds.x, printBtnOrds.y);
	}

	drawGua1(cord){
		let w = cord.w/2;
		let h = cord.h/2;
		let x = cord.x + w/2;
		let y = cord.y + h/2;

		if(this.showYaoName){
			w = cord.w*2/3;
			x = cord.x + w/6;
		}

		let yao = this.yao;

		let opt = {
			x: x,
			y: y,
			width: w,
			height: h,
			owner: this.svgTopgroup,
			yao: yao,
			showName: this.showYaoName,
		};

		let guasvg = new Gua(opt);
		this.guas[0] = guasvg;
		this.guas[0].draw();

		let gua = guasvg.getGua();
		if(gua){
			this.hasDrawGua = true;
			let marg = 3;
			let len = gua.name.length * (this.fontSize + marg);
			let orgx = guasvg.yaoX;
			x = orgx + guasvg.yaoWidth/2 - len/2;
			y = y + h + this.margin/2;
			let data = gua.name.split('');
			drawTextH(this.svgTopgroup, data, x, y, len, this.fontSize+marg, marg, this.color);

			len = 2 * (this.fontSize + marg);
			x = orgx + guasvg.yaoWidth/2 - len/2 + marg;
			y = cord.y + cord.h/4 - this.fontSize*2;
			data = ['本', '卦'];
			drawTextH(this.svgTopgroup, data, x, y, len, this.fontSize+marg, marg, this.color);
		}
	}

	drawGua2(cord){
		let w = cord.w/2;
		let h = cord.h/2;
		let x = cord.x + w/2;
		let y = cord.y + h/2;

		if(this.showYaoName){
			w = cord.w*2/3;
			x = cord.x + w/6;
		}

		let byao = this.yao;

		let yao = [];
		let hasChange = false;
		for(let i=0; i<byao.length; i++){
			let obj = {
				...byao[i],
			};
			if(obj.change){
				hasChange = true;
				obj.value = obj.value === 1 ? 0 : 1;
				obj.change = false;
				obj.nameColor = '#800080';
			}
			yao[i] = obj;
		}
		if(hasChange === false){
			return;
		}
		let guahouse = null;
		if(this.guas[0] && this.guas[0].getGua()){
			guahouse = this.guas[0].getGua().house;
		}
		setupYao(yao, guahouse);
		let orgyao = this.yao;
		for(let i=0; i<orgyao.length; i++){
			yao[i].god = orgyao[i].god;
		}

		let opt = {
			x: x,
			y: y,
			width: w,
			height: h,
			owner: this.svgTopgroup,
			yao: yao,
			showName: this.showYaoName,
		};

		let guasvg = new Gua(opt);
		this.guas[1] = guasvg;
		this.guas[1].draw();

		let gua = guasvg.getGua();
		if(gua){
			let marg = 3;
			let len = gua.name.length * (this.fontSize + marg);
			let orgx = guasvg.yaoX;
			x = orgx + guasvg.yaoWidth/2 - len/2;
			y = y + h + this.margin/2;
			let data = gua.name.split('');
			drawTextH(this.svgTopgroup, data, x, y, len, this.fontSize+marg, marg, this.color);

			len = 2 * (this.fontSize + marg);
			x = orgx + guasvg.yaoWidth/2 - len/2 + marg;
			y = cord.y + cord.h/4 - this.fontSize*2;
			data = ['之', '卦'];
			drawTextH(this.svgTopgroup, data, x, y, len, this.fontSize+marg, marg, this.color);
		}

	}

	drawGua3(cord){
		let w = cord.w/2;
		let h = cord.h/2;
		let x = cord.x + w/2;
		let y = cord.y + h/2;

		if(this.showYaoName){
			w = cord.w*2/3;
			x = cord.x + w/6;
		}

		let byao = this.yao;

		let yao = [];
		for(let i=1; i<4; i++){
			let obj = {
				...byao[i],
				change: false,
			};
			yao.push(obj);
		}
		for(let i=2; i<5; i++){
			let obj = {
				...byao[i],
				change: false,
			};
			yao.push(obj);
		}
		let guahouse = null;
		if(this.guas[0] && this.guas[0].getGua()){
			guahouse = this.guas[0].getGua().house;
		}
		setupYao(yao, guahouse);
		let orgyao = this.yao;
		for(let i=0; i<orgyao.length; i++){
			yao[i].god = orgyao[i].god;
		}

		let opt = {
			x: x,
			y: y,
			width: w,
			height: h,
			owner: this.svgTopgroup,
			yao: yao,
			showName: this.showYaoName,
		};

		let guasvg = new Gua(opt);
		this.guas[2] = guasvg;
		this.guas[2].draw();

		let gua = guasvg.getGua();
		if(gua){
			let marg = 3;
			let len = gua.name.length * (this.fontSize + marg);
			let orgx = guasvg.yaoX;
			x = orgx + guasvg.yaoWidth/2 - len/2;
			y = y + h + this.margin/2;
			let data = gua.name.split('');
			drawTextH(this.svgTopgroup, data, x, y, len, this.fontSize+marg, marg, this.color);

			len = 2 * (this.fontSize + marg);
			x = orgx + guasvg.yaoWidth/2 - len/2 + marg;
			y = cord.y + cord.h/4 - this.fontSize*2;
			data = ['互', '卦'];
			drawTextH(this.svgTopgroup, data, x, y, len, this.fontSize+marg, marg, this.color);
		}

	}

	drawGua4(cord){
		if(this.nongli === undefined || this.nongli === null){
			return;
		}

		let month = this.nongli.monthGanZi;
		let day = this.nongli.dayGanZi;
		let mxunempty = getXunEmpty(month.substr(0, 1), month.substr(1, 1));
		let dxunempty = getXunEmpty(day.substr(0, 1), day.substr(1, 1));
		let xuns = [{
			key: '月空',
			value: mxunempty,
		},{
			key: '日空',
			value: dxunempty,
		}];


		let w = (cord.w - this.margin) / 3;
		let h = (cord.h - this.margin*2) / 2;
		let x = cord.x + this.margin/2;
		let y = cord.y + this.margin/2;
		let opt = {
			chartObj: this.chartObj,
			x: x,
			y: y,
			width: w - this.margin/2,
			height: h,
			owner: this.svgTopgroup,
			title: '旬空',
			gods: xuns,
		};
		let xun = new TextTable(opt);
		xun.draw();

	}

	drawTitle(cord){
		if(this.hasDrawGua === false){
			return;
		}
		let txt = '';
		let bztxt = null;
		let nltxt = null;
		if(this.nongli){
			let leap = this.nongli.leap ? '闰' : '';
			nltxt = '农历：' + this.nongli.year + '年 ' + this.nongli.monthGanZi + '月 ' 
				+ this.nongli.dayGanZi + '日 '+ this.nongli.time + '时';
			txt = '真太阳时:' + this.nongli.birth+ '（' + leap + this.nongli.month + this.nongli.day + '）';

			let bz = this.nongli.bazi;

			bztxt = nltxt + '； 八字：' + bz.year.ganzi + '年 ' + bz.month.ganzi + '月 '
				+ bz.day.ganzi + '日 '+ bz.time.ganzi + '时';
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
		let y = cord.y + cord.h/4;
		let data = [txt];
		drawTextH(this.svgTopgroup, data, x, y, len, h, marg, this.color);

		if(bztxt){
			y = y + h + marg;
			data = [bztxt];
			drawTextH(this.svgTopgroup, data, x, y, len, h, marg, this.color);
		}
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

export default GZChart;
