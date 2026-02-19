import * as d3 from 'd3';
import * as AstroConst from '../../constants/AstroConst';
import * as ZWCont from '../../constants/ZWConst';
import * as ZiWeiHelper from './ZiWeiHelper';
import * as GraphHelper from '../graph/GraphHelper';
import ZWCommHouse from './ZWCommHouse';
import D3Arrow from '../graph/D3Arrow';
import {randomStr,} from '../../utils/helper';

class ZWHouse extends ZWCommHouse {
	constructor(option){
		super(option);
	}

	bindClick(){
		if(this.svg === undefined || this.svg === null){
			return;
		}
		this.svg.on('click', ()=>{ this.clickHouse(); });
	}

	clickHouse(){
		if(this.zwchart && this.zwchart.clickHouse){
			this.zwchart.clickHouse(this.houseObj);
		}
	}

	draw(){
		if(this.flyGanzi && this.flyGanzi === this.houseObj.ganzi){
			this.houseBG = ZWCont.ZWColor.SelectedBG;
		}
		this.owner.select('#' + this.id).remove();
		let container = this.owner.append('g').attr('id', this.id);
		container.append('rect')
				.attr('fill', this.houseBG)
				.attr('x', this.x).attr('y', this.y)
				.attr('width', this.width).attr('height', this.height);
		this.svg = container;
		this.bindClick();

		if(ZWCont.ZWChart.chart === ZWCont.ZWChart_FeiXing){
			this.drawFeixing();
		}else if(ZWCont.ZWChart.chart === ZWCont.ZWChart_SangHe){
			this.drawSanghe();
		}else if(ZWCont.ZWChart.chart === ZWCont.ZWChart_SiHua){
			this.drawSihua();
		}

		this.drawLaiYing();
	}

	drawSihuaTitle(){
		let h = this.height / 4;
		let w = this.width / 4;
		let x = this.x;
		let y = this.y + this.height * 3 / 4;

		let container = this.svg.append('g');
		container.append('rect')
				.attr('fill', this.houseBG)
				.attr('x', x).attr('y', y)
				.attr('width', w).attr('height', h);
		let data = [];
		data[0] = this.houseObj.ganzi.substr(0,1);
		data[1] = this.houseObj.ganzi.substr(1,1);
		let gzsvg = GraphHelper.drawTextV(container.append('g'), data, x, y, w, h, this.margin, AstroConst.AstroColor.Stroke, 200);
		let gztip = ZWCont.NaYin[this.houseObj.ganzi];
		if(gztip){
			let tipobj = {
				title: this.houseObj.ganzi,
				tips: '纳音五行：' + gztip,
			};
			this.genTooltip(gzsvg, tipobj, this.houseObj.name)
		}

		let dirX = x + w;
		let dirY = y;
		let dirW = this.width / 2;
		let dirH = h;
		container.append('rect')
				.attr('fill', this.houseBG)
				.attr('x', dirX).attr('y', dirY)
				.attr('width', dirW).attr('height', dirH);
		if(this.dirname !== undefined && this.dirname !== null && this.dirname.length){
			let dirData = [];
			dirData[0] = '运';
			dirData[1] = this.dirname.substr(0, 1);
			if(dirData[1] == '交' ){
				dirData[1] = '友';
			}
			GraphHelper.drawTextH(container.append('g'), dirData, dirX, dirY, dirW, dirH / 2, this.margin, AstroConst.AstroColor.Stroke);
		}

		if(this.yearText){
			let parts = this.yearText.split('年');
			let ageparts = parts[1].split('岁');
			let ydata = [];
			ydata[0] = parts[0].substr(0, 2);
			ydata[1] = parts[0].substr(2, 2);
			ydata[2] = '年';
			ydata[3] = ageparts[0];
			ydata[4] = '岁';
			let yearH = 12;
			let yearW = yearH * ydata.length;
			let yearX = this.x + (this.width - yearW) / 2;
			GraphHelper.drawTextH(container.append('g'), ydata, yearX, dirY-yearH - 0.5*yearH, yearW, yearH, 1, AstroConst.AstroColor.Stroke);
		}

		let dirSubX1 = dirX;
		let dirSubY1 = dirY + dirH / 2;
		let dirSubX2 = dirX + dirW;
		let dirSubY2 = dirSubY1;
		container.append('line')
				.attr('x1', dirSubX1)
				.attr('y1', dirSubY1)
				.attr('x2', dirSubX2)
				.attr('y2', dirSubY2);

		let dirData = [];
		dirData[0] = this.houseObj.direction[0] + '';
		dirData[1] = '~';
		dirData[2] = this.houseObj.direction[1] + '';
		GraphHelper.drawTextH(container.append('g'), dirData, dirSubX1, dirSubY2, dirW, dirH / 2, this.margin, AstroConst.AstroColor.Stroke);

		let titleX = dirX + dirW;
		let titleY = y;
		let titleW = this.width - w - dirW;
		let titleH = h;
		container.append('rect')
				.attr('fill', this.houseBG)
				.attr('x', titleX).attr('y', titleY)
				.attr('width', titleW).attr('height', titleH);
		data[0] = this.houseObj.name.substr(0,1);
		data[1] = this.houseObj.name.substr(1,1);
		let housesvg = GraphHelper.drawTextV(container.append('g'), data, titleX, titleY, titleW, titleH, this.margin, AstroConst.AstroColor.Stroke, 200);
		let tip = this.ZWRules.RuleHouses[this.houseObj.name];
		if(tip){
			let tipobj = {
				title: this.houseObj.name,
				tips: tip,
			};
			this.genTooltip(housesvg, tipobj, this.houseObj.name)
		}
		
	}

	drawSihuaStars(){
		let starsCount = this.houseObj.starsMain.length + this.houseObj.starsAssist.length + this.houseObj.starsEvil.length;
		let avgsz = (this.width - this.margin*starsCount) / starsCount;
		let sz = this.fontSize < avgsz ? this.fontSize : avgsz;
		this.fontSize = sz;

		let x = this.x;
		let y = this.y;
		let w = sz + this.margin/2;
		let h = sz*2 + this.margin*2;
		for(let i=0; i<this.houseObj.starsMain.length; i++){
			let star = this.houseObj.starsMain[i];
			let sx = x + i*w;
			this.drawStar(star, sx, y, w, h, ZWCont.ZWColor.StarMainStroke);
		}
		x = x + this.houseObj.starsMain.length * w;

		for(let i=0; i<this.houseObj.starsAssist.length; i++){
			let star = this.houseObj.starsAssist[i];
			let sx = x + i*w;
			this.drawStar(star, sx, y, w, h, ZWCont.ZWColor.StarAssistStroke);
		}
		x = x + this.houseObj.starsAssist.length * w;

		for(let i=0; i<this.houseObj.starsEvil.length; i++){
			let star = this.houseObj.starsEvil[i];
			let sx = x + i*w;
			this.drawStar(star, sx, y, w, h, ZWCont.ZWColor.StarEvilStroke);
		}
	}

	drawSihua(){
		this.drawSihuaTitle();
		this.drawSihuaStars();
	}



	drawSanghe(){

	}
	


	drawFeixing(){

	}

	drawStar(star, x, y, w, h, color){
		let yearGan = this.chartObj.yearGan;
		let txt = [];
		for(let i=0; i<star.name.length; i++){
			txt[i] = star.name.charAt(i) + '';
		}
		let flyhua = null;
		if(this.flyGanzi){
			let gan = this.flyGanzi.charAt(0) + '';
			flyhua = ZiWeiHelper.getSiHua(star.name, gan);
		}
		let starsvg = null;
		if(flyhua){
			let coloropt = ZWCont.ZWColor[flyhua];
			starsvg = GraphHelper.drawTextV(this.svg.append('g'), txt, x, y, w, h, 2, 
				coloropt.color, null, coloropt.bg);
		}else{
			starsvg = GraphHelper.drawTextV(this.svg.append('g'), txt, x, y, w, h, 2, color);
		}
		let tip = this.ZWRules.RuleStars[star.name];
		if(tip){
			let tipobj = {
				title: star.name,
				tips: tip,
			};
			this.genTooltip(starsvg, tipobj, star.name)
		}

		let dim = {
			x: x,
			y: y,
			w: w,
			h: h
		};
		let hua = ZiWeiHelper.getSiHua(star.name, yearGan);
		if(hua){
			let coloropt = ZWCont.ZWColor[hua];
			let huax = x + 2;
			let huay = y + h;
			let huaw = w - 4;
			let huah = w;
			let huatxt = [hua];
			let huasvg = GraphHelper.drawTextV(this.svg.append('g'), 
				huatxt, huax, huay, huaw, huah, 2, 
				coloropt.color, null, coloropt.bg);
				
			let huatip = this.ZWRules.RuleSihua[hua].slice(0);
			let huahouse = this.ZWRuleSihua.HuaInHouse[hua];
			let huahousetip = huahouse[this.houseObj.name].slice(0);
			let hasflag = false;
			for(let val of huatip){
				if(val === '=='){
					hasflag = true;
					break;
				}
			}
			if(!hasflag){
				huatip.push('==');
				huatip.push(`${hua}在${this.houseObj.name}`);
				huatip.push(huahousetip);	
			}
			if(huatip){
				let tipobj = {
					title: hua,
					tips: huatip,
				};
				this.genTooltip(huasvg, tipobj, hua)
			}
					
			dim.h = dim.h + huah; 
		}

		let housegan = this.houseObj.ganzi.charAt(0);
		let ganhua = ZiWeiHelper.getSiHua(star.name, housegan);
		if(ganhua){
			let coloropt = ZWCont.ZWColor[ganhua];
			let huax = x + 2;
			let huay = y + dim.h;
			let huaw = w - 4;
			let huah = w;
			let huatxt = [ganhua];
			if(hua){
				huay = huay + 2;
			}
			GraphHelper.drawTextV(this.svg.append('g'), 
				huatxt, huax, huay, huaw, huah, 2, 
				coloropt.bg, null, null, coloropt.bg);
			
			dim.h = dim.h + huah; 

			let opt = {
				owner: this.svg.append('g'),
				x2: x + w/2,
				y2: huay + w,
				x1: x + w/2,
				y1: huay,
				color: coloropt.bg,
			};
			let arrow = new D3Arrow(opt);
			arrow.draw();
		}
/*
		if(this.dirIndex !== undefined && this.dirIndex !== null){
			let dirhouse = this.chartObj.houses[this.dirIndex];
			let dirgan = dirhouse.ganzi.charAt(0);
			let dirhua = ZiWeiHelper.getSiHua(star.name, dirgan);
			if(dirhua){
				let coloropt = ZWCont.ZWColor[dirhua];
				let huax = x + 2;
				let huay = y + dim.h + 4;
				let huaw = w - 4;
				let huah = w;
				let huatxt = [dirhua];
				GraphHelper.drawTextV(this.svg.append('g'), 
					huatxt, huax, huay, huaw, huah, 2, 
					coloropt.bg, null, null, coloropt.bg, 30);
				
				dim.h = dim.h + huah + 4; 
			}	
		}
*/
		this.stars.set(star.name, dim);
	}

	drawLaiYing(){
		let hgan = this.houseObj.ganzi.charAt(0) + '';
		let hzi = this.houseObj.ganzi.charAt(1) + '';
		if(hgan !== this.chartObj.yearGan || hzi === '子' || hzi === '丑'){
			return;
		}

		let hw = this.fontSize;
		let hh = hw * 2 + this.margin;
		let hx = this.x + this.width - 25;
		let hy = this.y + this.height - this.height/4 - hh - 10;
		let txt = ['来', '因'];
		let color = AstroConst.AstroColor.Stroke;
		GraphHelper.drawTextV(this.svg.append('g'), txt, hx, hy, hw, hh, 2, 
			color, null, null, color);

	}
	
}

export default ZWHouse;
