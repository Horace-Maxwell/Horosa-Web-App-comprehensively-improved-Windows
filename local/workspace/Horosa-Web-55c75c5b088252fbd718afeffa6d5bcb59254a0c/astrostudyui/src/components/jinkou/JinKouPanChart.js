import * as d3 from 'd3';
import * as AstroConst from '../../constants/AstroConst';
import { formatDate, printArea } from '../../utils/helper';
import { drawTextH, } from '../graph/GraphHelper';
import LRCircleChart from '../liureng/LRCircleChart';
import LRChart from '../liureng/LRChart';
import KeChart from '../liureng/KeChart';
import ChuangChart from '../liureng/ChuangChart';
import GodChart from '../liureng/GodChart';
import * as LRConst from '../liureng/LRConst';
import { HourZi, } from '../gua/GuaConst';
import { JinKouElementColor } from './JinKouCalc';

function safeText(val, def = '—'){
	if(val === undefined || val === null || val === ''){
		return def;
	}
	return `${val}`;
}

function fitText(txt, width, fontSize){
	const text = safeText(txt, '');
	if(text === ''){
		return '—';
	}
	const avg = fontSize * 0.95;
	const max = Math.max(1, Math.floor(width / Math.max(1, avg)));
	if(text.length <= max){
		return text;
	}
	return `${text.substring(0, Math.max(1, max - 1))}…`;
}

class JinKouPanChart {
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
		this.jinkouData = options.jinkouData;

		this.margin = 20;
		this.svgTopgroup = null;
		this.svg = null;

		this.bgColor = AstroConst.AstroColor.Fill;
		this.color = AstroConst.AstroColor.Stroke;
		this.fontSize = 20;
		this.labelBg = LRConst.getHouseColor(0);

		this.rengs = [];
		this.yue = null;
		if(this.chartObj){
			for(let i=0; i<this.chartObj.objects.length; i++){
				const obj = this.chartObj.objects[i];
				if(obj.id === AstroConst.SUN){
					this.yue = LRConst.getSignZi(obj.sign);
					break;
				}
			}
		}

		this.ke = null;
	}

	set chart(chartobj){
		this.chartObj = chartobj;
		this.yue = null;
		if(!chartobj || !chartobj.objects){
			return;
		}
		for(let i=0; i<chartobj.objects.length; i++){
			const obj = chartobj.objects[i];
			if(obj.id === AstroConst.SUN){
				this.yue = LRConst.getSignZi(obj.sign);
				break;
			}
		}
	}

	set jinkou(data){
		this.jinkouData = data;
	}

	draw(){
		if(this.chartObj === undefined || this.chartObj === null){
			return null;
		}
		const svgdom = document.getElementById(this.chartId);
		if(svgdom === undefined || svgdom === null){
			return null;
		}
		const width = svgdom.clientWidth;
		const height = svgdom.clientHeight;
		if(width === 0 || height === 0){
			return null;
		}

		const realW = width - this.margin * 2;
		const realH = height - this.margin * 2;

		const svgid = `#${this.chartId}`;
		this.svg = d3.select(svgid);
		this.svg.html('');
		this.svg.attr('stroke', this.color).attr('stroke-width', 1);

		this.svgTopgroup = this.svg.append('g');
		this.svgTopgroup.append('rect')
			.attr('fill', this.bgColor)
			.attr('stroke', this.color)
			.attr('x', this.margin)
			.attr('y', this.margin)
			.attr('width', realW)
			.attr('height', realH);

		const titleH = 50;
		const w = realW / 2;
		const h = (realH - titleH) / 2;
		const cords = [];
		cords[0] = { x: this.margin, y: this.margin + titleH, w: w, h: h };
		cords[1] = { x: this.margin + w, y: this.margin + titleH, w: w, h: h };
		cords[2] = { x: this.margin, y: this.margin + titleH + h, w: w, h: h };
		cords[3] = { x: this.margin + w, y: this.margin + titleH + h, w: w, h: h };

		const titleords = { x: this.margin, y: this.margin, w: realW, h: titleH };
		const printBtnOrds = { x: this.margin + 18, y: this.margin + titleH / 2 };

		this.drawLiuRengCircle(cords[0]);
		this.drawKeChuan(cords[1]);
		this.drawJinKouTables(cords[2]);
		this.drawRightGodPanels(cords[3]);
		this.drawTitle(titleords);
		this.drawPrintBtn(printBtnOrds.x, printBtnOrds.y);
		return null;
	}

	drawLiuRengCircle(cord){
		const w = cord.w - this.margin;
		const h = cord.h - this.margin;
		const x = cord.x + this.margin / 2;
		const y = cord.y + this.margin / 2;

		const opt = {
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
		if(LRConst.LRChartType === LRConst.LRChart_Square){
			chartsvg = new LRChart(opt);
		}else{
			chartsvg = new LRCircleChart(opt);
		}
		this.rengs[0] = chartsvg;
		this.rengs[0].draw();
		this.ke = this.rengs[0].getKe();
	}

	drawKeChuan(cord){
		const w = (cord.w - this.margin * 2) * 4 / 7;
		const h = cord.h - this.margin;
		const x = cord.x + this.margin / 2;
		const y = cord.y + this.margin / 2;

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
		const kesvg = new KeChart(opt);
		this.rengs[1] = kesvg;
		this.rengs[1].draw();

		const w1 = (cord.w - this.margin * 2) * 3 / 7;
		const h1 = h;
		const x1 = cord.x + w + this.margin;
		const y1 = y;
		opt = {
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
		const csvg = new ChuangChart(opt);
		this.rengs[2] = csvg;
		this.rengs[2].draw();
	}

	getColorByToken(token, def = '#262626'){
		const txt = `${token || ''}`;
		for(let i=0; i<txt.length; i++){
			const one = txt.substr(i, 1);
			if(LRConst.GanZiWuXing[one]){
				const elem = LRConst.GanZiWuXing[one];
				if(JinKouElementColor[elem]){
					return JinKouElementColor[elem];
				}
			}
		}
		return def;
	}

	drawCell(x, y, w, h, fill){
		this.svgTopgroup.append('rect')
			.attr('x', x)
			.attr('y', y)
			.attr('width', w)
			.attr('height', h)
			.attr('fill', fill || AstroConst.AstroColor.ChartBackgroud)
			.attr('stroke', this.color)
			.attr('stroke-width', 1);
	}

	drawText(option){
		const x = option.x;
		const y = option.y;
		const w = option.w;
		const h = option.h;
		const fontSize = option.fontSize ? option.fontSize : 16;
		const padding = option.padding !== undefined ? option.padding : 6;
		const align = option.align ? option.align : 'center';
		const color = option.color ? option.color : '#262626';
		const bold = option.bold ? 400 : 300;

		const tx = align === 'left' ? x + padding : x + w / 2;
		const anchor = align === 'left' ? 'start' : 'middle';
		let txt = '';
		const rawText = option.text === undefined || option.text === null ? '' : `${option.text}`;
		if(option.allowEmpty && rawText === ''){
			txt = '';
		}else{
			txt = fitText(option.text, Math.max(1, w - padding * 2), fontSize);
		}
		this.svgTopgroup.append('text')
			.attr('x', tx)
			.attr('y', y + h / 2)
			.attr('dominant-baseline', 'middle')
			.attr('text-anchor', anchor)
			.attr('font-size', `${fontSize}px`)
			.attr('font-weight', bold)
			.attr('stroke', 'none')
			.attr('fill', color)
			.text(txt);
	}

	drawTopLineSection(x, y, w, h){
		const meta = this.jinkouData && this.jinkouData.topInfo ? this.jinkouData.topInfo : {};
		const cells = [{
			text: '地分',
			color: '#262626',
			fill: this.labelBg,
			widthRate: 0.12,
		}, {
			text: safeText(meta.diFen, ''),
			color: this.getColorByToken(meta.diFen),
			fill: AstroConst.AstroColor.ChartBackgroud,
			widthRate: 0.13,
		}, {
			text: '空亡',
			color: '#262626',
			fill: this.labelBg,
			widthRate: 0.12,
		}, {
			text: safeText(meta.xunKong, ''),
			color: '#7a6a00',
			fill: AstroConst.AstroColor.ChartBackgroud,
			widthRate: 0.16,
		}, {
			text: '四大空亡',
			color: '#262626',
			fill: this.labelBg,
			widthRate: 0.25,
		}, {
			text: safeText(meta.siDaKong, ''),
			color: this.getColorByToken(meta.siDaKong, '#7a6a00'),
			fill: AstroConst.AstroColor.ChartBackgroud,
			widthRate: 0.22,
		}];
		let cx = x;
		for(let i=0; i<cells.length; i++){
			const one = cells[i];
			const cw = w * one.widthRate;
			this.drawCell(cx, y, cw, h, one.fill);
			this.drawText({
				x: cx,
				y: y,
				w: cw,
				h: h,
				text: one.text,
				fontSize: 18,
				color: one.color,
			});
			cx += cw;
		}
	}

	drawMiddleSection(x, y, w, h){
		const rows = this.jinkouData && this.jinkouData.rows ? this.jinkouData.rows : [];
		const cleanVal = (val)=>{
			const txt = safeText(val, '');
			if(txt === '-' || txt === '—' || txt === '无'){
				return '';
			}
			return txt;
		};
		const shortKong = (val)=>{
			let txt = cleanVal(val);
			if(txt === ''){
				return '';
			}
			txt = txt.replace(/四大空亡/g, '四空');
			txt = txt.replace(/空亡/g, '空');
			txt = txt.replace(/\s*[\/&]\s*/g, '/');
			return txt;
		};
		if(rows.length === 0){
			this.drawCell(x, y, w, h, AstroConst.AstroColor.ChartBackgroud);
			this.drawText({
				x: x,
				y: y,
				w: w,
				h: h,
				text: '暂无金口诀数据',
				fontSize: 18,
			});
			return;
		}
		const widths = [0.14, 0.09, 0.15, 0.15, 0.21, 0.26];
		const rowH = h / rows.length;
		const xs = [x];
		for(let i=0; i<widths.length; i++){
			xs.push(xs[xs.length - 1] + w * widths[i]);
		}
		this.svgTopgroup.append('rect')
			.attr('x', x)
			.attr('y', y)
			.attr('width', w)
			.attr('height', h)
			.attr('fill', AstroConst.AstroColor.ChartBackgroud)
			.attr('stroke', 'none');
		for(let i=0; i<rows.length; i++){
			const row = rows[i];
			const showContent = cleanVal(row.content);
			const data = [
				{ text: row.label, color: '#262626', align: 'center' },
				{ text: cleanVal(row.gan), color: row.ganColor ? row.ganColor : '#262626', align: 'center' },
				{ text: showContent, color: row.contentColor ? row.contentColor : '#262626', align: 'center' },
				{ text: cleanVal(row.shenjiang), color: this.getColorByToken(showContent, '#5b3f91'), align: 'center' },
				{ text: cleanVal(row.power), color: row.powerColor ? row.powerColor : '#262626', align: 'center' },
				{ text: shortKong(row.kong), color: row.kong && row.kong !== '—' ? '#8a6a00' : '#8c8c8c', align: 'center' },
			];
			for(let j=0; j<widths.length; j++){
				const cx = xs[j];
				const cw = xs[j + 1] - xs[j];
				if(j === 0){
					this.svgTopgroup.append('rect')
						.attr('x', cx)
						.attr('y', y + rowH * i)
						.attr('width', cw)
						.attr('height', rowH)
						.attr('fill', this.labelBg)
						.attr('stroke', 'none');
				}
				this.drawText({
					x: cx,
					y: y + rowH * i,
					w: cw,
					h: rowH,
					text: data[j].text,
					color: data[j].color,
					fontSize: 17,
					align: data[j].align,
					allowEmpty: true,
				});
			}
		}
		for(let i=1; i<rows.length; i++){
			this.svgTopgroup.append('line')
				.attr('x1', x)
				.attr('y1', y + rowH * i)
				.attr('x2', x + w)
				.attr('y2', y + rowH * i)
				.attr('stroke', this.color)
				.attr('stroke-width', 1);
		}
		this.svgTopgroup.append('line')
			.attr('x1', xs[1])
			.attr('y1', y)
			.attr('x2', xs[1])
			.attr('y2', y + h)
			.attr('stroke', this.color)
			.attr('stroke-width', 1);
		this.svgTopgroup.append('rect')
			.attr('x', x)
			.attr('y', y)
			.attr('width', w)
			.attr('height', h)
			.attr('fill', 'none')
			.attr('stroke', this.color)
			.attr('stroke-width', 1);
	}

	drawBottomSection(x, y, w, h){
		const rows = this.jinkouData && this.jinkouData.shenshaRows ? this.jinkouData.shenshaRows : [];
		if(rows.length === 0){
			this.drawCell(x, y, w, h, AstroConst.AstroColor.ChartBackgroud);
			return;
		}
		const rowH = h / rows.length;
		const labelW = w * 0.20;
		const valueW = w - labelW;
		for(let i=0; i<rows.length; i++){
			const row = rows[i];
			const cy = y + rowH * i;
			this.drawCell(x, cy, labelW, rowH, this.labelBg);
			this.drawText({
				x: x,
				y: cy,
				w: labelW,
				h: rowH,
				text: row.label,
				fontSize: 16,
			});
			this.drawCell(x + labelW, cy, valueW, rowH, AstroConst.AstroColor.ChartBackgroud);
			this.drawText({
				x: x + labelW,
				y: cy,
				w: valueW,
				h: rowH,
				text: row.value,
				fontSize: 15,
				align: 'left',
				padding: 8,
				color: '#262626',
			});
		}
	}

	drawJinKouTables(cord){
		const x = cord.x + this.margin / 2;
		const y = cord.y + this.margin / 2;
		const w = cord.w - this.margin;
		const h = cord.h - this.margin;

		if(!this.jinkouData || !this.jinkouData.ready){
			this.drawCell(x, y, w, h, AstroConst.AstroColor.ChartBackgroud);
			this.drawText({
				x: x,
				y: y,
				w: w,
				h: h,
				text: '点击右侧“起盘”后显示金口诀盘',
				fontSize: 20,
			});
			return;
		}

		const gap = 10;
		let topH = Math.floor(h * 0.16);
		let middleH = Math.floor(h * 0.50);
		if(topH < 42){
			topH = 42;
		}
		if(middleH < 150){
			middleH = 150;
		}
		if(topH + middleH + gap * 2 > h - 44){
			middleH = Math.max(120, h - topH - gap * 2 - 40);
		}
		const bottomH = h - topH - middleH - gap * 2;

		this.drawTopLineSection(x, y, w, topH);
		this.drawMiddleSection(x, y + topH + gap, w, middleH);
		this.drawBottomSection(x, y + topH + gap + middleH + gap, w, bottomH);
	}

	getRunYear(){
		return [{
			key: '行年',
			value: this.runyear.year,
		}, {
			key: '年龄',
			value: `${this.runyear.age}岁`,
		}, {
			key: '性别',
			value: this.gender === 0 ? '女' : (this.gender === 1 ? '男' : '未知'),
		}];
	}

	getXun(){
		return [{
			key: '旬空',
			value: this.liureng.xun['旬空'],
		}, {
			key: '旬首',
			value: this.liureng.xun['旬首'],
		}, {
			key: '旬尾',
			value: this.liureng.xun['旬尾'],
		}, {
			key: '旬丁',
			value: this.liureng.xun['旬丁'],
		}];
	}

	getData(obj){
		if(!obj || typeof obj !== 'object'){
			return [];
		}
		const res = [];
		for(const k in obj){
			const data = {
				key: k,
				value: obj[k],
			};
			const pidx = k.indexOf('(');
			if(pidx >= 0){
				data.key = k.substr(0, pidx);
			}
			if(data.value instanceof Array){
				data.value = data.value.join('');
			}
			res.push(data);
		}
		return res;
	}

	drawRightGodPanels(cord){
		const x = cord.x + this.margin / 2;
		const y = cord.y + this.margin / 2;
		const w = cord.w - this.margin;
		const h = cord.h - this.margin;

		if(this.liureng === undefined || this.liureng === null ||
			this.runyear === undefined || this.runyear === null){
			this.drawCell(x, y, w, h, AstroConst.AstroColor.ChartBackgroud);
			this.drawText({
				x: x,
				y: y,
				w: w,
				h: h,
				text: '起盘后显示行年/旬日/旺衰/神煞',
				fontSize: 18,
			});
			return;
		}

		const gap = this.margin / 2;
		const cw = (w - gap * 2) / 3;
		const ch = (h - gap) / 2;
		const p1 = { x: x, y: y, w: cw, h: ch };
		const p2 = { x: x + cw + gap, y: y, w: cw, h: ch };
		const p3 = { x: x + (cw + gap) * 2, y: y, w: cw, h: ch };
		const p4 = { x: x, y: y + ch + gap, w: cw, h: ch };
		const p5 = { x: x + cw + gap, y: y + ch + gap, w: cw, h: ch };
		const p6 = { x: x + (cw + gap) * 2, y: y + ch + gap, w: cw, h: ch };

		new GodChart({
			x: p1.x,
			y: p1.y,
			width: p1.w,
			height: p1.h,
			owner: this.svgTopgroup,
			title: '行年',
			gods: this.getRunYear(),
		}).draw();

		new GodChart({
			x: p2.x,
			y: p2.y,
			width: p2.w,
			height: p2.h,
			owner: this.svgTopgroup,
			title: '旬日',
			gods: this.getXun(),
		}).draw();

		new GodChart({
			x: p3.x,
			y: p3.y,
			width: p3.w,
			height: p3.h,
			owner: this.svgTopgroup,
			title: '旺衰',
			gods: this.getData(this.liureng.season),
		}).draw();

		new GodChart({
			x: p4.x,
			y: p4.y,
			width: p4.w,
			height: p4.h,
			owner: this.svgTopgroup,
			title: '基础神煞',
			gods: this.getData(this.liureng.gods),
		}).draw();

		new GodChart({
			x: p5.x,
			y: p5.y,
			width: p5.w,
			height: p5.h,
			owner: this.svgTopgroup,
			title: '干煞',
			gods: this.getData(this.liureng.godsGan),
		}).draw();

		new GodChart({
			x: p6.x,
			y: p6.y,
			width: p6.w,
			height: p6.h,
			owner: this.svgTopgroup,
			title: '月煞',
			gods: this.getData(this.liureng.godsMonth),
		}).draw();
	}

	drawTitle(cord){
		let txt = '';
		if(this.liureng){
			if(this.nongli){
				txt = `真太阳时:${this.nongli.birth}`;
			}
			const fourcol = this.liureng.fourColumns;
			if(fourcol){
				txt = `${txt}； 八字:${fourcol.year.ganzi}年 ${fourcol.month.ganzi}月 ${fourcol.day.ganzi}日 ${fourcol.time.ganzi}时`;
			}
			if(this.nongli){
				const leap = this.nongli.leap ? '闰' : '';
				txt = `${txt}（${leap}${this.nongli.month}${this.nongli.day}）`;
			}

		}else if(this.nongli){
			const leap = this.nongli.leap ? '闰' : '';
			txt = `真太阳时:${this.nongli.birth}； 农历:${this.nongli.year}年 ${this.nongli.monthGanZi}月 ${this.nongli.dayGanZi}日 ${this.nongli.time}时（${leap}${this.nongli.month}${this.nongli.day}）`;
		}else{
			const dt = new Date();
			const h = dt.getHours();
			const zi = HourZi[h];
			txt = `起卦时间：${formatDate(dt)} ${zi}时`;
		}

		const marg = 2;
		let fontsz = 15;
		let unitLen = txt.length > 9 ? (txt.length - 9) : txt.length;
		if(unitLen <= 0){
			unitLen = 1;
		}
		let len = unitLen * fontsz;
		if(len > cord.w){
			len = cord.w;
			fontsz = cord.w / unitLen;
		}
		const hh = fontsz + marg * 2;
		const x = cord.x + cord.w / 2 - len / 2;
		const y = cord.y + cord.h / 2;
		drawTextH(this.svgTopgroup, [txt], x, y, len, hh, marg, this.color);
	}

	drawPrintBtn(x, y){
		const sz = 14;
		const txtsvg = this.svgTopgroup.append('g');
		txtsvg.append('text')
			.attr('dominant-baseline', 'middle')
			.attr('text-anchor', 'left')
			.attr('font-weight', 100)
			.attr('stroke', AstroConst.AstroColor.Stroke)
			.attr('font-size', `${sz}px`)
			.attr('x', x)
			.attr('y', y)
			.attr('style', 'cursor:hand')
			.text('打印卦盘');

		txtsvg.on('click', ()=>{
			printArea(this.chartId);
		});
	}
}

export default JinKouPanChart;
