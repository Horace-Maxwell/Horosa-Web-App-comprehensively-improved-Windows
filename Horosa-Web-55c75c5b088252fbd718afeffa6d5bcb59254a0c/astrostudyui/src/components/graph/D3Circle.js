import * as d3 from 'd3';
import {randomStr,} from '../../utils/helper';

class D3Circle {
	constructor(option){
		this.owner = option.owner;
		this.ox = option.x;
		this.oy = option.y;
		this.or = option.r;
		this.step = option.step;
		this.color = option.color ? option.color : '#000000';
		this.bgColor = option.bgColor ? option.bgColor : 'transparent';
		this.data = option.data;
		this.margin = option.margin ? option.margin : 2;
		this.fontSize = this.step - this.margin > 20 ? 20 : this.step - this.margin;
		this.highLightData = option.highLightData ? option.highLightData : [];
		this.highLightColor = option.highLightColor ? option.highLightColor : '#ffffff';
		this.highLightBgColor = option.highLightBgColor ? option.highLightBgColor : '#CC9900';

		this.id = 'circle' + randomStr(8);
		this.svg = null;

	}

	draw(){
		this.owner.select('#' + this.id).remove();
		let grp = this.owner.append('g').attr('id', this.id);
		this.svg = grp;

		let r = this.or;
		let innerR = r - this.step;
		let txtPosR = r - this.step/2;
		let deg = 360;
		if(this.data.length){
			deg = 360 / this.data.length;
		}
		let startdeg = 180 - deg/2;
		let endDeg = startdeg + deg;
		let stangle = startdeg * Math.PI / 180;
		let edangle = endDeg * Math.PI / 180;

		for(let i=0; i<this.data.length; i++){
			let arc = d3.arc();
			let arcd = arc({
				innerRadius: innerR,
				outerRadius: r,
				startAngle: -stangle,
				endAngle: -edangle
			});

			let txt = this.data[i];
			let txtcolor = this.color;
			let txtbgcolor = this.bgColor;
			if(this.highLightData.indexOf(txt) >= 0){
				txtcolor = this.highLightColor;
				txtbgcolor = this.highLightBgColor;
			}

			let g = grp.append('g').attr("text-anchor", "middle");
			g.append('path')
				.attr('d', arcd).attr('stroke', this.color)
				.attr('fill', txtbgcolor);

			let txts = txt.split('');
			let fz = this.fontSize;
			g.selectAll('text').data(txts).enter().append('text')
				.attr("dominant-baseline","middle")
				.attr('stroke', txtcolor)
				.attr("text-anchor", "middle")
				.attr('font-size', fz).attr('font-weight', 100)
				.attr('transform', function(d, idx){
					let posx = 0;
					let posy = 0;
					let angle = startdeg + deg / 2 - 5;
					let rad = angle * Math.PI / 180;
					let centeridx = txts.length / 2;
					if(idx === centeridx){
						posx = -txtPosR * Math.sin(rad);
						posy = -txtPosR * Math.cos(rad);
					}else{
						let deltaIdx = centeridx - idx;
						angle = angle + deltaIdx*fz/2;
						rad = angle * Math.PI / 180;
						posx = -txtPosR * Math.sin(rad);
						posy = -txtPosR * Math.cos(rad);
					}
					let rotang = -angle;
					let trans = 'translate(' + posx + ', ' + posy + ')';
					return trans;	
				})
				.text(function(d){return d});

			endDeg = startdeg;
			edangle = stangle;
			startdeg = startdeg - deg;
			stangle = startdeg * Math.PI / 180;
	
		}

		let translate = 'translate(' + this.ox + ',' + this.oy + ') ';
		let trans = translate;
		grp.attr("transform", trans);
	}

}

export default D3Circle;
