import * as d3 from 'd3';
import * as AstroConst from '../../constants/AstroConst';
import * as SZConst from '../suzhan/SZConst';
import {randomStr,} from '../../utils/helper';
import Su28ChartCircle from '../su28/Su28ChartCircle';
import * as AstroText from '../../constants/AstroText';

class SZNiXiangChartCircle extends Su28ChartCircle{
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
		this.drawOuterChartBySu(outR, outStep);
		let innerR = this.or - outStep;
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
			this.genTooltip(lblgroup, su, AstroText.AstroMsgCN[su.id] + ' ');
			
			let txts = SZConst.SZInverseDirectCircle[i].slice(0);
			let houseN = this.getHouseNum(i);
			txts.push(houseN + '');
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
					let angle = su.ra + deg / 2 - 2.5;
					let rad = angle * Math.PI / 180;
					let centeridx = txts.length / 2;
					if(idx === centeridx){
						posx = -txtPosR * Math.sin(rad);
						posy = -txtPosR * Math.cos(rad);
					}else{
						let deltaIdx = centeridx - idx;
						angle = angle + deltaIdx * fz / 3;
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

	drawOuterChartBySu(r, rStep){
		let eastRa = this.getEastRa();
		let innerR = r - rStep;
		let txtPosR = r - rStep / 2 - this.TxtOffsetTop;

		let suRA = SZConst.SZInverseDirectBySu;
		let signs = this.svg.append('g');
		for(let key in suRA){
			let su = suRA[key];
			let suobj = this.houseMap.get(su.su[0]);
			let sucolor = su.color;
			let sufillcolor = su.fillColor;
			let nxt = this.houseMap.get(su.next);
			let deg = (nxt.ra - suobj.ra + 360) % 360;
			let sigsz = deg * Math.PI / 180;
			let a = suobj.ra * Math.PI / 180;
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
			
			let txts = su.name;
			let fz = this.fontSize;
			let rotAngle = this.rotateAng;
			lblgroup.selectAll('text').data(txts).enter().append('text')
				.attr("dominant-baseline","central")
				.attr("text-anchor", "middle")
				.attr('font-family', function(d, idx){
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
					let angle = suobj.ra + deg / 2 - 2;
					let rad = angle * Math.PI / 180;
					let centeridx = txts.length / 2;
					if(idx === centeridx){
						posx = -txtPosR * Math.sin(rad);
						posy = -txtPosR * Math.cos(rad);
					}else{
						let deltaIdx = centeridx - idx;
						angle = angle + deltaIdx * fz / 3;
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

}

export default SZNiXiangChartCircle;



