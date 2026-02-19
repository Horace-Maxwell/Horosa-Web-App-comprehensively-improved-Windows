import * as d3 from 'd3';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import Yao from './Yao';
import {randomStr,} from '../../utils/helper';

class YinYao extends Yao{
	constructor(option){
		super(option);
		this.value = 0;
	}

	draw(){
		super.draw();
		let w = this.yaoWidth;
		w = w/2 - this.gap/2;
		let picsvg = this.svg.append('g');	
		picsvg.append('rect')
			.attr('stroke', this.color).attr('fill', this.color)
			.attr('x', this.x).attr('y', this.y)
			.attr('width', w).attr('height', this.height);

		picsvg.append('rect')
			.attr('stroke', this.color).attr('fill', this.color)
			.attr('x', this.x+w+this.gap).attr('y', this.y)
			.attr('width', w).attr('height', this.height);

	}

}

export default YinYao;
