import * as d3 from 'd3';
import {randomStr,} from '../../utils/helper';

class D3BaseCircle {
	constructor(option){
		this.owner = option.owner;
		this.ox = option.x;
		this.oy = option.y;
		this.or = option.r;
		this.step = option.step;
		this.color = option.color ? option.color : '#000000';
		this.bgColor = option.bgColor ? option.bgColor : 'transparent';
		this.margin = option.margin ? option.margin : 5;
		this.fontSize = this.step - this.margin > 20 ? 20 : this.step - this.margin;

		this.highLightData = option.highLightData ? option.highLightData : [];
		this.highLightColor = option.highLightColor ? option.highLightColor : '#ffffff';
		this.highLightBgColor = option.highLightBgColor ? option.highLightBgColor : '#CC9900';

	}

	draw(){

	}
}

export default D3BaseCircle;
