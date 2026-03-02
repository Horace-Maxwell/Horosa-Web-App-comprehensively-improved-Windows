import * as d3 from 'd3';
import * as AstroConst from '../../constants/AstroConst';
import * as SZConst from '../suzhan/SZConst';
import {randomStr,} from '../../utils/helper';
import Su28ChartCircle from '../su28/Su28ChartCircle';
import { SuiTuTong, } from '../../msg/bazimsg';
import * as AstroText from '../../constants/AstroText';

class GuoLaoNatalChart extends Su28ChartCircle{
	constructor(option){
		super(option);	
	}

	draw(){
		if(this.chartObj === null || this.chartObj === undefined){
			return;
		}
		this.initDraw();

		let outR = this.or;
		let outStep = 35;
		this.drawOuterChart(outR, outStep);

		let godsR = outR - outStep;
		let godsStep = 40;
		this.drawGods(godsR, godsStep);

		let taisuiR = godsR - godsStep;
		let taisuiStep = 40;
		this.drawTaisuiGods(taisuiR, taisuiStep);

		let innerR = taisuiR - taisuiStep;
		this.drawInnerChart(innerR);

		this.drawBirthInfo();
	}

	drawOuterChart(r, rStep){
		let eastRa = this.getEastRa();
		let innerR = r - rStep;
		let txtPosR = r - rStep / 2 - this.TxtOffsetTop;

		let signsRA = this.chartObj.signsRA;
		let signs = this.svg.append('g');
		for(let i=0; i<signsRA.length; i++){
			let su = signsRA[i];
			let sucolor = SZConst.getSigColor(i);
			let sufillcolor = AstroConst.AstroColor.SignFill[su.id];
			let nxt = i < signsRA.length - 1 ? signsRA[i+1] : signsRA[0];
			let deg = (nxt.ra - su.ra + 360) % 360;
			let sigsz = deg * Math.PI / 180;
			let a = su.ra * Math.PI / 180;
			let arc = d3.arc();
			let arcd = arc({
				innerRadius: innerR,
				outerRadius: r,
				startAngle: -a,
				endAngle: -(a + sigsz),
			});
			let siggroup = signs.append('g');
			siggroup.append('path')
				.attr('d', arcd).attr('stroke', sucolor)
				.attr('fill', sufillcolor);
	
			let lblgroup = siggroup.append('g').attr("text-anchor", "middle");
			
			let txts = SZConst.SZSignsCircle[i].slice(0);
			let houseN = this.getHouseNum(i);
			txts.push(houseN + '');

			let tiptitle = AstroText.AstroMsgCN[su.id] + ' ' + AstroText.AstroMsgCN['House' + houseN];
			this.genTooltip(lblgroup, su, tiptitle);

			let fz = this.fontSize;
			let rotAngle = this.rotateAng;
			lblgroup.selectAll('text').data(txts).enter().append('text')
				.attr("dominant-baseline","central")
				.attr("text-anchor", "middle")
				.attr('font-family', function(d, idx){
					if(idx === 3){
						return AstroConst.AstroChartFont;
					}
					return AstroConst.NormalFont;
				})
				.attr('font-size', function(d, idx){
					return fz;
				})
				.attr('stroke', function(d, idx){
					return sucolor;
				})
				.attr('transform', function(d, idx){
					let posx = 0;
					let posy = 0;
					let angle = su.ra + deg / 2 - 2;
					let rad = angle * Math.PI / 180;
					let centeridx = txts.length / 2;
					if(idx === centeridx){
						posx = -txtPosR * Math.sin(rad);
						posy = -txtPosR * Math.cos(rad);
					}else{
						let deltaIdx = centeridx - idx;
						if(idx === 1){
							angle = angle + deltaIdx * fz / 3.5;
						}else{
							angle = angle + deltaIdx * fz / 3;
						}
						rad = angle * Math.PI / 180;
						posx = -txtPosR * Math.sin(rad);
						posy = -txtPosR * Math.cos(rad);
					}
					let rotang = rotAngle - eastRa;
					let trans = 'translate(' + posx + ', ' + posy + ') rotate(' + rotang + ')';
					return trans;	
				})
				.text(function(d){return d});
		}

	}

	drawGodsBand(r, rStep, drawGodsHandle){
		let flags = this.chartDisp;
		let samecolorwithsign = (flags & AstroConst.CHART_PLANETCOLORWITHSIGN) === 0 ? false : true;
		let innerR = r - rStep;
		let signsRA = this.chartObj.signsRA;
		let signs = this.svg.append('g');
		let gods = this.svg.append('g');
		for(let i=0; i<signsRA.length; i++){
			let su = signsRA[i];
			let sucolor = SZConst.getSigColor(i);
			let sufillcolor = 'transparent';
			let nxt = i < signsRA.length - 1 ? signsRA[i+1] : signsRA[0];
			let deg = (nxt.ra - su.ra + 360) % 360;
			let sigsz = deg * Math.PI / 180;
			let a = su.ra * Math.PI / 180;
			let arc = d3.arc();
			let arcd = arc({
				innerRadius: innerR,
				outerRadius: r,
				startAngle: -a,
				endAngle: -(a + sigsz),
			});
			let siggroup = signs.append('g');
			siggroup.append('path')
				.attr('d', arcd).attr('stroke', sucolor)
				.attr('fill', sufillcolor);	
				
			if(drawGodsHandle){
				let zi = SZConst.SZSignsCircle[i][0];
				let godcolor = null;
				if(samecolorwithsign){
					godcolor = sucolor;
				}
				drawGodsHandle(gods, su.ra, deg, zi, this.chartObj.nongli.bazi.guolaoGods.ziGods, godcolor);
			}
		}

	}

	drawGodsTxt(svg, r, startdeg, sigsz, gods, color){
		let txtPosR = r - 10 - this.TxtOffsetTop;
		let eastRa = this.getEastRa();
		let unitdeg = sigsz / gods.length;
		let angoffset = unitdeg / 3;

		for(let i=0; i<gods.length; i++){
			let god = gods[i];
			let tmplon = startdeg + angoffset + i * unitdeg;
			let lon = tmplon * Math.PI / 180;
			let lblgroup = svg.append('g').attr("text-anchor", "middle");
	
			let orgstartxt = god.split('');
			let startxt = [orgstartxt[0], orgstartxt[1]];
			let fontfamily = AstroConst.NormalFont;
			let rotAngle = this.rotateAng;
			lblgroup.selectAll('text').data(startxt).enter().append('text')
				.attr("dominant-baseline","middle")
				.attr("text-anchor", "middle")
				.attr('font-size', function(d, idx){
					return r >= this.rThreshold ? 15 : 13;
				})
				.attr('font-family', function(d, idx){
					return fontfamily;
				})
				.attr('stroke', function(d, idx){
					if(color){
						return color;
					}
					return AstroConst.AstroColor.Stroke;
				})
				.attr('font-weight', 100)
				.attr('transform', function(d, idx){
					let offset = r >= this.rThreshold ? 20 : 13;
					let x = -(txtPosR - idx * offset) * Math.sin(lon);
					let y = -(txtPosR - idx * offset) * Math.cos(lon);
					let angle = rotAngle - eastRa;
					let trans = 'translate(' + x + ', ' + y + ') rotate(' + angle + ')';
					return trans;
				})
				.text(function(d){return d});			
	
		}

	}

	drawTaisuiGods(r, rStep){
		this.drawGodsBand(r, rStep, (svg, startdeg, sigsz, zi, ziGods, color)=>{
			let nay = this.chartObj.nongli.bazi.year.naying;
			let wx = nay.substr(2,1);
			let zs = wx + '_' + zi;
			let txt = [SuiTuTong.wxzhi[zs]];
			ziGods[zi].taisuiGods.map((item, idx)=>{
				txt.push(item);
			});
			this.drawGodsTxt(svg, r, startdeg, sigsz, txt, color);
		});

	}

	drawGods(r, rStep){
		this.drawGodsBand(r, rStep, (svg, startdeg, sigsz, zi, ziGods, color)=>{
			this.drawGodsTxt(svg, r, startdeg, sigsz, ziGods[zi].allGods, color);
		});
	}


}

export default GuoLaoNatalChart;



