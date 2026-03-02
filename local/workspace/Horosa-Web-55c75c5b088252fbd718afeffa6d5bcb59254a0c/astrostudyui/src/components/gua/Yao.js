import * as d3 from 'd3';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { drawPath, drawTextH, drawTextV} from '../graph/GraphHelper';
import {randomStr,} from '../../utils/helper';

class Yao{
	constructor(option){
		this.value = -1;

		this.owner = option.owner;
		this.name = option.name;
		this.pos = option.pos;
		this.god = option.god;

		this.x = option.x;
		this.y = option.y;
		this.width = option.width;
		this.height = option.height;

		this.yaoWidth = this.width;
		this.showName = option.showName ? true : false;

		this.change = option.change ? true : false;

		this.gap = this.showName ? 20 : 20;
		if(this.showName === false){
			if(this.yaoWidth <= 30){
				this.gap = 5;
			}else if(this.yaoWidth <= 40){
				this.gap = 6;
			}
		}
		this.fontSize = 16;
		this.txtMargin = 2;
		this.txtLen = 0;
		this.txtSize = 0;
		this.nameMargin = 10;
		this.nameColor = AstroConst.AstroColor.Stroke;
		this.changedNameColor = '#800080';
		if(option.nameColor){
			this.nameColor = option.nameColor;
			this.changedNameColor = option.nameColor;
		}
		this.color = option.color ? option.color : AstroConst.AstroColor.Stroke;

		this.id = 'yao' + randomStr(8);
		this.svg = null;
	}

	draw(){
		this.owner.select('#' + this.id).remove();
		let container = this.owner.append('g').attr('id', this.id);
		this.svg = container;

		this.yaoWidth = this.width;
		if(this.showName && this.name){
			this.txtSize = this.name.length > 3 ? 5 : this.name.length;
			let len = this.txtSize * (this.fontSize + this.txtMargin);
			this.txtLen = len + this.nameMargin;
			if(this.txtLen > this.width/2){
				this.txtLen = this.width/2;
			}
			this.yaoWidth = this.yaoWidth - this.txtLen;
		}
		if(this.god){
			this.drawGod();
		}

		if(this.showName){
			this.drawName();
		}
	}

	drawName(){
		if(this.name === undefined || this.name === null){
			return;
		}
		let txtColor = this.change ? this.changedNameColor : this.nameColor;
		let w = this.yaoWidth;
		let nameW = this.txtLen-this.nameMargin;
		let data = this.name.split('');
		let last = data.length > 4 ? data[4] : null;
		if(last){
			data = data.slice(0,4);
		}
		let txtx = this.x+w+this.nameMargin;
		let h = this.height;
		if(h < this.fontSize){
			h = this.fontSize;
		}
		let txty = this.y + this.height/2 - h/2 + this.txtMargin;
		drawTextH(this.svg, data, txtx, txty, nameW, h, 0, txtColor);	

		if(last){
			txtx = txtx + nameW;
			let txtw = nameW/4;
			data = [last];
			drawTextH(this.svg, data, txtx, txty, txtw, h, 0, txtColor);	
		}
		if(this.change){
			txtx = this.x+w + this.txtMargin;
			if(this.value === 1){
				data = ['○'];
				drawTextH(this.svg, data, txtx, txty, nameW/4, h, 0, txtColor);	
			}else if(this.value === 0){
				data = ['✕'];
				drawTextH(this.svg, data, txtx, txty, nameW/4, h, 0, txtColor);
			}
		}
	}

	drawGod(){
		if(this.god === undefined || this.god === null){
			return;
		}

		let txtColor = this.change ? this.changedNameColor : this.nameColor;
		let txtx = this.x;
		let h = this.height;
		if(h < this.fontSize){
			h = this.fontSize;
		}
		let txty = this.y + this.height/2 - h/2 + this.txtMargin;
		let godw = 2 * (this.fontSize + this.txtMargin);
		let data = this.god.split('');
		drawTextH(this.svg, data, txtx, txty, godw, h, 0, txtColor);	
		this.x = this.x + godw + this.nameMargin;
		this.yaoWidth = this.yaoWidth - godw - this.nameMargin;
	}

}

export default Yao;
