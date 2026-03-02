import * as d3 from 'd3';
import D3BaseCircle from './D3BaseCircle';
import {randomStr,} from '../../utils/helper';

class D3DegreeOuterLine extends D3BaseCircle {
	constructor(option){
		super(option)
		
		this.id = 'degreeOuterLine' + randomStr(8);
		this.svg = null;
	}

	draw(){
		this.owner.select('#' + this.id).remove();
		let grp = this.owner.append('g').attr('id', this.id);
		this.svg = grp;

		let r = this.or;
		let long = r + 9;
		let medium = r + 6;
		let short = r + 3;
		let lines = grp.append('g');
		for(let i=0; i<360; i++){
			let x1 = r * Math.sin(-i * Math.PI / 180);
			let y1 = r * Math.cos(-i * Math.PI / 180);
			let x2 = 0;
			let y2 = 0;
			if(i % 10 === 0){
				x2 = long * Math.sin(-i * Math.PI / 180);
				y2 = long * Math.cos(-i * Math.PI / 180);
			}else if(i % 5 === 0){
				x2 = medium * Math.sin(-i * Math.PI / 180);
				y2 = medium * Math.cos(-i * Math.PI / 180);
			}else{
				x2 = short * Math.sin(-i * Math.PI / 180);
				y2 = short * Math.cos(-i * Math.PI / 180);
			}
			let line = lines.append('line').attr('stroke', this.color);
			line.attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2);
		}

		let translate = 'translate(' + this.ox + ',' + this.oy + ') ';
		let trans = translate;
		grp.attr("transform", trans);
		
	}

}

export default D3DegreeOuterLine;
