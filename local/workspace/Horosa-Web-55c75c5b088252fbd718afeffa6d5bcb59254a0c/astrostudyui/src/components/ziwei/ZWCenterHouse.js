import * as d3 from 'd3';
import {randomStr, printArea,} from '../../utils/helper';
import * as ZWCont from '../../constants/ZWConst';
import * as ZWText from '../../constants/ZWText';
import * as AstroConst from '../../constants/AstroConst';
import * as ZiWeiHelper from './ZiWeiHelper';
import ZWCommHouse from './ZWCommHouse';
import D3Arrow from '../graph/D3Arrow';
import { drawTextV, drawDashLine, } from '../graph/GraphHelper';

class ZWCenterHouse extends ZWCommHouse {
	constructor(option){
		super(option);

		this.fields = option.fields;
		this.yearDoujun = option.yearDoujun;

		this.id = 'house' + randomStr(8);
		this.svg = null;
		this.margin = 20;
		this.fontSize = 12;
		this.rowgap = 8;

		this.shiTongZHMap = new Map();
	}


	draw(){
		this.owner.select('#' + this.id).remove();
		let container = this.owner.append('g').attr('id', this.id);
		container.append('rect')
				.attr('fill', AstroConst.AstroColor.ChartBackgroud)
				.attr('x', this.x).attr('y', this.y)
				.attr('width', this.width).attr('height', this.height);
		this.svg = container;

		let pos = this.drawName();
		pos = this.drawDouJun(pos.x, pos.y);
		pos = this.drawDate(pos.x, pos.y);
		pos = this.drawBaZi(pos.x, pos.y);
		pos = this.drawPrintBtn(pos.x, pos.y);

		this.drawShiTongZiHua();
		this.drawSanFanSiZeng();

		this.drawSangheLine();
	}

	drawName(){
		let name = '姓名：';
		if(this.fields && this.fields.name && this.fields.name.value){
			name = name + this.fields.name.value;
		}else{
			name = name + '匿名';
		}
		let ju = ZWText.ZWMsg[this.chartObj.yearPolar] + 
			ZWText.ZWMsg[this.chartObj.gender] + ' ' + 
			this.chartObj.wuxingJuText;

		let sz = this.fontSize;
		let x = this.x + this.margin + sz / 2;
		let y = this.y + this.margin*2;
		
		let namesvg = this.svg.append('g');
		namesvg.append('text')
			.attr("dominant-baseline","middle")
			.attr("text-anchor", "left")
			.attr('font-weight', 100)
			.attr('stroke', AstroConst.AstroColor.Stroke)
			.attr('font-size', `${sz}px`)
			.attr('x', x).attr('y', y)
			.text(name);

		let jux = this.x + this.width / 2;
		let jusvg = this.svg.append('g');
		jusvg.append('text')
			.attr("dominant-baseline","middle")
			.attr("text-anchor", "left")
			.attr('font-weight', 100)
			.attr('stroke', AstroConst.AstroColor.Stroke)
			.attr('font-size', `${sz}px`)
			.attr('x', jux).attr('y', y)
			.text(ju);

		let pos = {
			x: x,
			y: y + sz + this.rowgap,
		}
		return pos;
	}

	drawDate(x, y){
		let zonepos = '时区：' + this.chartObj.zone
		+ '； 经度：' + this.chartObj.lon + '； 纬度：' + this.chartObj.lat;
		let nongli = this.chartObj.nongli;
		let birth = '真太阳时：' + nongli.birth;
		let leap = nongli.leap ? '闰' : '';
		let nltxt = '农历：' + nongli.year + '年 ' + leap + nongli.month + nongli.day + ' ' + nongli.time.charAt(1) + '时';

		let sz = this.fontSize;
		
		let birthsvg = this.svg.append('g');
		birthsvg.append('text')
			.attr("dominant-baseline","middle")
			.attr("text-anchor", "left")
			.attr('font-weight', 100)
			.attr('stroke', AstroConst.AstroColor.Stroke)
			.attr('font-size', `${sz}px`)
			.attr('x', x).attr('y', y)
			.text(birth);

		let nlx = x;
		let nly = y + sz + this.rowgap;
		let nlsvg = this.svg.append('g');
		nlsvg.append('text')
			.attr("dominant-baseline","middle")
			.attr("text-anchor", "left")
			.attr('font-weight', 100)
			.attr('stroke', AstroConst.AstroColor.Stroke)
			.attr('font-size', `${sz}px`)
			.attr('x', nlx).attr('y', nly)
			.text(nltxt);

		let zonex = x;
		let zoney = nly + sz + this.rowgap;
		let zonesvg = this.svg.append('g');
		zonesvg.append('text')
			.attr("dominant-baseline","middle")
			.attr("text-anchor", "left")
			.attr('font-weight', 100)
			.attr('stroke', AstroConst.AstroColor.Stroke)
			.attr('font-size', `${sz}px`)
			.attr('x', zonex).attr('y', zoney)
			.text(zonepos);
	
		let lasty = zoney;
		if(this.yearDoujun){
			let ydjx = x;
			let ydjy = zoney + sz + this.rowgap;
			let ydjsvg = this.svg.append('g');
			ydjsvg.append('text')
				.attr("dominant-baseline","middle")
				.attr("text-anchor", "left")
				.attr('font-weight', 100)
				.attr('stroke', AstroConst.AstroColor.Stroke)
				.attr('font-size', `${sz}px`)
				.attr('x', ydjx).attr('y', ydjy)
				.text(this.yearDoujun);

			lasty = ydjy;
		}
		let pos = {
			x: x,
			y: lasty + sz + this.rowgap,
		};

		return pos;
	}

	drawBaZi(x, y){
		let bz = this.chartObj.bazi.bazi;
		let year = ' ' + bz.year.ganzi;
		let m = ' ' + bz.month.ganzi;
		let d = '日' + bz.day.ganzi;
		let t = ' ' + bz.time.ganzi;
		let space = '   ';
		let data = [year, m, d, t, space];

		let fontsize = 18;
		let fzoffset = 4;
		let docw = document.documentElement.clientWidth;
		if(docw > 1440){
			fontsize = 25;
			fzoffset = fontsize / 4;
		}
		let svg = this.svg;
		let sz = this.fontSize;
		let lineWidth = fontsize * data.length;
		let margin = 3;
		let nlx = x - margin;
		let nly = y;
		let w = (lineWidth - margin) / data.length;
		let h = w * 3 + margin;
		for(let i=0; i<data.length; i++){
			drawTextV(svg, data[i], nlx, nly, w, h, margin, AstroConst.AstroColor.Stroke);
			nlx = nlx + w + margin;
		}

		let dirx = nlx - w/2;
		let diry = y + w - margin;
		let dirh = w * 2 + margin*2
		let direct = this.chartObj.bazi.direct.direction;
		direct.map((item, idx)=>{
			let age = item.age + 1;
			let sage = null;
			if(age < 10){
				sage = '0' + age;
			}else{
				sage = age + '';
			}
			let agesvg = this.svg.append('g');
			agesvg.append('text')
				.attr("dominant-baseline","middle")
				.attr("text-anchor", "left")
				.attr('font-weight', 100)
				.attr('stroke', AstroConst.AstroColor.Stroke)
				.attr('font-size', `${w/2}px`)
				.attr('x', dirx+fzoffset).attr('y', diry - margin)
				.text(sage);
			
			let tipobj = {
				title: '开始年份',
				tips: item.startYear,
			};
			this.genTooltip(agesvg, tipobj);
					
			let gz = item.mainDirect.ganzi;
			let gzsvg = drawTextV(svg, gz, dirx, diry, w, dirh, margin, AstroConst.AstroColor.Stroke);

			let subyears = [];
			item.subDirect.map((subdir, idx)=>{
				let year = item.startYear + idx;
				let fage = age + idx;
				let str = `${fage}虚岁 -- ${year}年 -- ${subdir.ganzi}`;
				subyears.push(str);
			});
			let ytipobj = {
				title: `${gz}大运 -- 流年`,
				tips: subyears,
			};
			this.genTooltip(gzsvg, ytipobj);

			dirx = dirx + w + margin;
		});

		let pos = {
			x: x,
			y: y+ h + this.rowgap,
		};
		return pos;
	}

	drawPrintBtn(x, y){
		let sz = this.fontSize;
		let sx = x;
		let sy = y + this.rowgap;

		let txtsvg = this.svg.append('g');
		txtsvg.append('text')
			.attr("dominant-baseline","middle")
			.attr("text-anchor", "left")
			.attr('font-weight', 100)
			.attr('stroke', AstroConst.AstroColor.Stroke)
			.attr('font-size', `${sz}px`)
			.attr('x', sx).attr('y', sy)
			.attr('style', 'cursor:hand')
			.text('打印命盘');

		txtsvg.on('click', ()=>{
			let cid = this.zwchart.chartId;
			printArea(cid);
		});

		let pos = {
			x: x,
			y: sy + sz + this.rowgap,
		};
		return pos;
	}

	drawDouJun(x, y){
		let lifemaster = '命主：' + this.chartObj.lifeMaster;
		let bodymaster = '身主：' + this.chartObj.bodyMaster;
		let zidou = '子斗：' + this.chartObj.zidou;
		let doujun = '斗君：' + this.chartObj.doujun;

		let sz = this.fontSize;
		let sx = x;
		let sy = y;

		let txtsvg = this.svg.append('g');
		txtsvg.append('text')
			.attr("dominant-baseline","middle")
			.attr("text-anchor", "left")
			.attr('font-weight', 100)
			.attr('stroke', AstroConst.AstroColor.Stroke)
			.attr('font-size', `${sz}px`)
			.attr('x', sx).attr('y', sy)
			.text(lifemaster);

		sx = this.x + this.width / 2;
		txtsvg = this.svg.append('g');
		txtsvg.append('text')
			.attr("dominant-baseline","middle")
			.attr("text-anchor", "left")
			.attr('font-weight', 100)
			.attr('stroke', AstroConst.AstroColor.Stroke)
			.attr('font-size', `${sz}px`)
			.attr('x', sx).attr('y', sy)
			.text(bodymaster);

		sx = x;
		sy = sy + sz + this.rowgap;
		txtsvg = this.svg.append('g');
		txtsvg.append('text')
			.attr("dominant-baseline","middle")
			.attr("text-anchor", "left")
			.attr('font-weight', 100)
			.attr('stroke', AstroConst.AstroColor.Stroke)
			.attr('font-size', `${sz}px`)
			.attr('x', sx).attr('y', sy)
			.text(zidou);

		sx = this.x + this.width / 2;
		txtsvg = this.svg.append('g');
		txtsvg.append('text')
			.attr("dominant-baseline","middle")
			.attr("text-anchor", "left")
			.attr('font-weight', 100)
			.attr('stroke', AstroConst.AstroColor.Stroke)
			.attr('font-size', `${sz}px`)
			.attr('x', sx).attr('y', sy)
			.text(doujun);

		let pos = {
			x: x,
			y: sy + sz + this.rowgap,
		};
		return pos;
	}

	drawShiTongZiHua(){
		this.shiTongZHMap.clear();
		for(let i=0; i<12; i++){
			let pairIdx = (i + 6) % 12;
			let gan = this.chartObj.houses[i].ganzi.charAt(0) + '';
			let pairHouse = this.chartObj.houses[pairIdx];
			let hua = this.checkPairHouse(pairHouse, gan);
			if(hua.length > 0){
				let n = this.shiTongZHMap.get(i + '_' + pairIdx);
				if(n === undefined || n === null){
					n = this.shiTongZHMap.get(pairIdx + '_' + i);
				}
				if(n === undefined || n === null){
					n = 0;
				}else{
					n = n + 1;
				}
				let offset = n * 15;
				offset = this.drawSihuaArrow(i, pairIdx, hua, offset);
				this.shiTongZHMap.set(i + '_' + pairIdx, n);
				this.shiTongZHMap.set(pairIdx + '_' + i, n);
			}
		}
	}

	drawSanFanSiZeng(){
		if(ZWCont.ZWChart !== ZWCont.ZWChart_SangHe){
			return;
		}

	}

	checkPairHouse(house, gan){
		let res = [];
		for(let i=0; i<house.starsMain.length; i++){
			let star = house.starsMain[i];
			let hua = ZiWeiHelper.getSiHua(star.name, gan);
			if(hua){
				res.push(hua);
			}
		}
		for(let i=0; i<house.starsAssist.length; i++){
			let star = house.starsAssist[i];
			let hua = ZiWeiHelper.getSiHua(star.name, gan);
			if(hua){
				res.push(hua);
			}
		}
		return res;
	}

	drawSihuaArrow(fromIdx, toIdx, huas, staroffset){
		let hFrom = this.zwchart.houses[fromIdx];
		let hTo = this.zwchart.houses[toIdx];
		let offset = staroffset;
		for(let i=0; i<huas.length; i++){
			offset = staroffset + i*15;
			let hua = huas[i];
			let coloropt = ZWCont.ZWColor[hua];
			let opt = {};
			if(fromIdx === 0){
				opt = {
					owner: this.svg.append('g'),
					x1: hFrom.x + hFrom.width / 3 * 2 - offset,
					y1: hFrom.y,
					x2: hTo.x + hTo.width / 3,
					y2: hTo.y + hTo.height,
					color: coloropt.bg,	
				};
				let arrow = new D3Arrow(opt);
				arrow.draw();
			}else if(fromIdx === 1){
				opt = {
					owner: this.svg.append('g'),
					x1: hFrom.x + hFrom.width / 3 + offset,
					y1: hFrom.y,
					x2: hTo.x + hTo.width / 3 * 2,
					y2: hTo.y + hTo.height,
					color: coloropt.bg,	
				};
				let arrow = new D3Arrow(opt);
				arrow.draw();
			}else if(fromIdx === 2){
				opt = {
					owner: this.svg.append('g'),
					x1: hFrom.x + hFrom.width - offset,
					y1: hFrom.y,
					x2: hTo.x,
					y2: hTo.y + hTo.height,
					color: coloropt.bg,	
				};
				let arrow = new D3Arrow(opt);
				arrow.draw();
			}else if(fromIdx === 3){
				opt = {
					owner: this.svg.append('g'),
					x1: hFrom.x + hFrom.width,
					y1: hFrom.y + hTo.height / 3 * 2 - offset,
					x2: hTo.x,
					y2: hTo.y + hTo.height / 3,
					color: coloropt.bg,	
				};
				let arrow = new D3Arrow(opt);
				arrow.draw();
			}else if(fromIdx === 4){
				opt = {
					owner: this.svg.append('g'),
					x1: hFrom.x + hFrom.width,
					y1: hFrom.y + hTo.height / 3 + offset,
					x2: hTo.x,
					y2: hTo.y + hTo.height / 3 * 2,
					color: coloropt.bg,	
				};
				let arrow = new D3Arrow(opt);
				arrow.draw();
			}else if(fromIdx === 5){
				opt = {
					owner: this.svg.append('g'),
					x1: hFrom.x + hFrom.width - offset,
					y1: hFrom.y + hTo.height,
					x2: hTo.x,
					y2: hTo.y,
					color: coloropt.bg,	
				};
				let arrow = new D3Arrow(opt);
				arrow.draw();
			}else if(fromIdx === 6){
				opt = {
					owner: this.svg.append('g'),
					x1: hFrom.x + hFrom.width / 3 + offset,
					y1: hFrom.y + hTo.height,
					x2: hTo.x + hFrom.width / 3 * 2,
					y2: hTo.y,
					color: coloropt.bg,	
				};
				let arrow = new D3Arrow(opt);
				arrow.draw();
			}else if(fromIdx === 7){
				opt = {
					owner: this.svg.append('g'),
					x1: hFrom.x + hFrom.width / 3 * 2 - offset,
					y1: hFrom.y + hTo.height,
					x2: hTo.x + hFrom.width / 3,
					y2: hTo.y,
					color: coloropt.bg,	
				};
				let arrow = new D3Arrow(opt);
				arrow.draw();
			}else if(fromIdx === 8){
				opt = {
					owner: this.svg.append('g'),
					x1: hFrom.x + offset,
					y1: hFrom.y + hTo.height,
					x2: hTo.x + hFrom.width,
					y2: hTo.y,
					color: coloropt.bg,	
				};
				let arrow = new D3Arrow(opt);
				arrow.draw();
			}else if(fromIdx === 9){
				opt = {
					owner: this.svg.append('g'),
					x1: hFrom.x,
					y1: hFrom.y + hTo.height / 3 + offset,
					x2: hTo.x + hFrom.width,
					y2: hTo.y + hTo.height / 3 * 2,
					color: coloropt.bg,	
				};
				let arrow = new D3Arrow(opt);
				arrow.draw();
			}else if(fromIdx === 10){
				opt = {
					owner: this.svg.append('g'),
					x1: hFrom.x,
					y1: hFrom.y + hTo.height / 3 * 2 - offset,
					x2: hTo.x + hFrom.width,
					y2: hTo.y + hTo.height / 3,
					color: coloropt.bg,	
				};
				let arrow = new D3Arrow(opt);
				arrow.draw();
			}else if(fromIdx === 11){
				opt = {
					owner: this.svg.append('g'),
					x1: hFrom.x + offset,
					y1: hFrom.y,
					x2: hTo.x + hFrom.width,
					y2: hTo.y + hTo.height,
					color: coloropt.bg,	
				};
				let arrow = new D3Arrow(opt);
				arrow.draw();
			}	
		}
		return offset;
	}

	drawSangheLine(){
		let starthouse = this.zwchart.flyHouse;
		if(starthouse === undefined || starthouse === null){
			return;
		}
		let zi = starthouse.ganzi.substr(1,1);
		let fromIdx = ZiWeiHelper.getHouseZiIndex(zi);
		let caiIdx = (fromIdx - 4 + 12) % 12;
		let guanIdx = (fromIdx + 4) % 12;
		let mingHouse = this.zwchart.houses[fromIdx];
		let caiHouse = this.zwchart.houses[caiIdx];
		let guanHouse = this.zwchart.houses[guanIdx];

		let color = AstroConst.AstroColor.Stroke;
		let grp = this.svg.append('g');
		if(fromIdx === 0){
			let x1 = mingHouse.x + mingHouse.width/2;
			let y1 = mingHouse.y;
			let x2 = caiHouse.x;
			let y2 = caiHouse.y + caiHouse.height;
			let x3 = guanHouse.x + guanHouse.width;
			let y3 = guanHouse.y + guanHouse.height/2;

			drawDashLine(grp, x1, y1, x2, y2, color);
			drawDashLine(grp, x1, y1, x3, y3, color);
			drawDashLine(grp, x2, y2, x3, y3, color);
		}else if(fromIdx === 1){
			let x1 = mingHouse.x + mingHouse.width/2;
			let y1 = mingHouse.y;
			let x2 = caiHouse.x;
			let y2 = caiHouse.y + caiHouse.height/2;
			let x3 = guanHouse.x + guanHouse.width;
			let y3 = guanHouse.y + guanHouse.height;

			drawDashLine(grp, x1, y1, x2, y2, color);
			drawDashLine(grp, x1, y1, x3, y3, color);
			drawDashLine(grp, x2, y2, x3, y3, color);
		}else if(fromIdx === 2){
			let x1 = mingHouse.x + mingHouse.width;
			let y1 = mingHouse.y;
			let x2 = caiHouse.x;
			let y2 = caiHouse.y + caiHouse.height/2;
			let x3 = guanHouse.x + guanHouse.width/2;
			let y3 = guanHouse.y + guanHouse.height;

			drawDashLine(grp, x1, y1, x2, y2, color);
			drawDashLine(grp, x1, y1, x3, y3, color);
			drawDashLine(grp, x2, y2, x3, y3, color);
		}else if(fromIdx === 3){
			let x1 = mingHouse.x + mingHouse.width;
			let y1 = mingHouse.y + mingHouse.height / 2;
			let x2 = caiHouse.x;
			let y2 = caiHouse.y;
			let x3 = guanHouse.x + guanHouse.width/2;
			let y3 = guanHouse.y + guanHouse.height;

			drawDashLine(grp, x1, y1, x2, y2, color);
			drawDashLine(grp, x1, y1, x3, y3, color);
			drawDashLine(grp, x2, y2, x3, y3, color);
		}else if(fromIdx === 4){
			let x1 = mingHouse.x + mingHouse.width;
			let y1 = mingHouse.y + mingHouse.height / 2;
			let x2 = caiHouse.x + caiHouse.width / 2;
			let y2 = caiHouse.y;
			let x3 = guanHouse.x;
			let y3 = guanHouse.y + guanHouse.height;

			drawDashLine(grp, x1, y1, x2, y2, color);
			drawDashLine(grp, x1, y1, x3, y3, color);
			drawDashLine(grp, x2, y2, x3, y3, color);
		}else if(fromIdx === 5){
			let x1 = mingHouse.x + mingHouse.width;
			let y1 = mingHouse.y + mingHouse.height;
			let x2 = caiHouse.x + caiHouse.width / 2;
			let y2 = caiHouse.y;
			let x3 = guanHouse.x;
			let y3 = guanHouse.y + guanHouse.height / 2;

			drawDashLine(grp, x1, y1, x2, y2, color);
			drawDashLine(grp, x1, y1, x3, y3, color);
			drawDashLine(grp, x2, y2, x3, y3, color);
		}else if(fromIdx === 6){
			let x1 = mingHouse.x + mingHouse.width / 2;
			let y1 = mingHouse.y + mingHouse.height;
			let x2 = caiHouse.x + caiHouse.width;
			let y2 = caiHouse.y;
			let x3 = guanHouse.x;
			let y3 = guanHouse.y + guanHouse.height / 2;

			drawDashLine(grp, x1, y1, x2, y2, color);
			drawDashLine(grp, x1, y1, x3, y3, color);
			drawDashLine(grp, x2, y2, x3, y3, color);
		}else if(fromIdx === 7){
			let x1 = mingHouse.x + mingHouse.width / 2;
			let y1 = mingHouse.y + mingHouse.height;
			let x2 = caiHouse.x + caiHouse.width;
			let y2 = caiHouse.y + caiHouse.height/2;
			let x3 = guanHouse.x;
			let y3 = guanHouse.y;

			drawDashLine(grp, x1, y1, x2, y2, color);
			drawDashLine(grp, x1, y1, x3, y3, color);
			drawDashLine(grp, x2, y2, x3, y3, color);
		}else if(fromIdx === 8){
			let x1 = mingHouse.x;
			let y1 = mingHouse.y + mingHouse.height;
			let x2 = caiHouse.x + caiHouse.width;
			let y2 = caiHouse.y + caiHouse.height/2;
			let x3 = guanHouse.x + guanHouse.width/2;
			let y3 = guanHouse.y;

			drawDashLine(grp, x1, y1, x2, y2, color);
			drawDashLine(grp, x1, y1, x3, y3, color);
			drawDashLine(grp, x2, y2, x3, y3, color);
		}else if(fromIdx === 9){
			let x1 = mingHouse.x;
			let y1 = mingHouse.y + mingHouse.height/2;
			let x2 = caiHouse.x + caiHouse.width;
			let y2 = caiHouse.y + caiHouse.height;
			let x3 = guanHouse.x + guanHouse.width/2;
			let y3 = guanHouse.y;

			drawDashLine(grp, x1, y1, x2, y2, color);
			drawDashLine(grp, x1, y1, x3, y3, color);
			drawDashLine(grp, x2, y2, x3, y3, color);
		}else if(fromIdx === 10){
			let x1 = mingHouse.x;
			let y1 = mingHouse.y + mingHouse.height/2;
			let x2 = caiHouse.x + caiHouse.width/2;
			let y2 = caiHouse.y + caiHouse.height;
			let x3 = guanHouse.x + guanHouse.width;
			let y3 = guanHouse.y;

			drawDashLine(grp, x1, y1, x2, y2, color);
			drawDashLine(grp, x1, y1, x3, y3, color);
			drawDashLine(grp, x2, y2, x3, y3, color);
		}else if(fromIdx === 11){
			let x1 = mingHouse.x;
			let y1 = mingHouse.y;
			let x2 = caiHouse.x + caiHouse.width/2;
			let y2 = caiHouse.y + caiHouse.height;
			let x3 = guanHouse.x + guanHouse.width;
			let y3 = guanHouse.y + guanHouse.height/2;

			drawDashLine(grp, x1, y1, x2, y2, color);
			drawDashLine(grp, x1, y1, x3, y3, color);
			drawDashLine(grp, x2, y2, x3, y3, color);
		}
	}

}

export default ZWCenterHouse;
