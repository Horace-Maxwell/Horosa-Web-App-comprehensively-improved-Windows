import * as d3 from 'd3';
import {randomStr,} from '../../utils/helper';

class D3Arrow {
	constructor(option){
		this.owner = option.owner;
		this.x1 = option.x1;
		this.y1 = option.y1;
		this.x2 = option.x2;
		this.y2 = option.y2;
		this.color = option.color ? option.color : 'var(--horosa-text, #000000)';
		// 线宽可选:缺省不落 attr(继承宿主 svg 的 stroke-width,现状),显式传入才生效。
		this.strokeWidth = option.strokeWidth;
		this.width = 12;
		this.height = 12;

		this.id = 'arrow' + randomStr(8);
		let defs = this.owner.append("defs");
		this.marker = defs.append("marker")
						.attr('id', this.id)
						.attr("markerUnits", "strokeWidth")
						.attr("markerWidth", this.width)
						.attr("markerHeight", this.height)
						.attr("viewBox", `0 0 ${this.width} ${this.height}`)
						.attr('refX', this.width/2).attr('refY', this.width/2)
						.attr("orient", "auto");

		let arrow_path = `M2,2 L10,6 L2,10`;
		this.marker.append('path').attr('d', arrow_path)
			.attr('fill', 'transparent').attr('stroke', this.color);
	}

	draw(){
		const line = this.owner.append('line')
			.attr('x1', this.x1).attr('y1', this.y1)
			.attr('x2', this.x2).attr('y2', this.y2)
			.attr('stroke', this.color)
			.attr('marker-end', 'url(#' + this.id + ')');
		if(this.strokeWidth != null){ line.attr('stroke-width', this.strokeWidth); }
	}

}

export default D3Arrow;
