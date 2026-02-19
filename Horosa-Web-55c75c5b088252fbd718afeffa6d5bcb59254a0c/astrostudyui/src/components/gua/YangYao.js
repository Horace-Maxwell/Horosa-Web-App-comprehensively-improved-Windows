import * as d3 from 'd3';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import Yao from './Yao';
import { drawPath, drawTextH, drawTextV} from '../graph/GraphHelper';
import {randomStr,} from '../../utils/helper';

class YangYao extends Yao{
	constructor(option){
		super(option);
		this.value = 1;
	}

	draw(){
		super.draw();
		let w = this.yaoWidth;

		let picsvg = this.svg.append('g');	
		picsvg.append('rect')
			.attr('stroke', this.color).attr('fill', this.color)
			.attr('x', this.x).attr('y', this.y)
			.attr('width', w).attr('height', this.height);

	}

}

export default YangYao;
