import * as d3 from 'd3';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { drawPath, drawTextH, drawTextV} from '../graph/GraphHelper';
import {randomStr, randomNum, littleEndian,} from '../../utils/helper';
import YangYao from './YangYao';
import YinYao from './YinYao';
import {getGua64, randYao} from './GuaConst';

class Gua{
	constructor(option){
		let yao = [{
			value:-1, change:false, color:AstroConst.AstroColor.Stroke, god:null, name:null, nameColor:null
		},{
			value:-1, change:false, color:AstroConst.AstroColor.Stroke, god:null, name:null, nameColor:null
		},{
			value:-1, change:false, color:AstroConst.AstroColor.Stroke, god:null, name:null, nameColor:null
		},{
			value:-1, change:false, color:AstroConst.AstroColor.Stroke, god:null, name:null, nameColor:null
		},{
			value:-1, change:false, color:AstroConst.AstroColor.Stroke, god:null, name:null, nameColor:null
		},{
			value:-1, change:false, color:AstroConst.AstroColor.Stroke, god:null, name:null, nameColor:null
		}];
		for(let i=0; i<yao.length; i++){
			let ryao = randYao();
			yao[i].value = ryao.value;
			yao[i].change = ryao.change;
		}

		this.owner = option.owner;
		this.name = option.name;
		this.yao = option.yao && option.yao.length ? option.yao : yao;

		this.x = option.x;
		this.y = option.y;
		this.width = option.width;
		this.height = option.height;

		this.yaoWidth = this.width;
		this.showName = option.showName ? true : false;
		this.yaoX = this.x;

		this.id = 'gua' + randomStr(8);
		this.svg = null;
	}

	draw(){
		this.owner.select('#' + this.id).remove();
		let container = this.owner.append('g').attr('id', this.id);
		this.svg = container;

		let h = this.height / this.yao.length;
		let yaoH = h / 4;

		let gua = this.getGua();

		for(let i=0; i<this.yao.length; i++){
			let yao = this.yao[i].value;
			let change = this.yao[i].change;
			if(yao !== 0 && yao !== 1){
				continue;
			}
			let name = this.yao[i].name;
			if(name === undefined || name === null){
				if(gua){
					name = gua.yaoname[i];
				}
			}
			let y = this.y + h*(this.yao.length - i - 1);
			let option = {
				owner: this.svg,
				name: name,
				color: this.yao[i].color,
				pos: i,
				x: this.x,
				y: y + yaoH,
				width: this.width,
				height: yaoH*2,
				showName: this.showName,
				change: change,
				nameColor: this.yao[i].nameColor,
				god: this.yao[i].god,
			}
			let yaosvg = null;
			if(yao === 0){
				yaosvg = new YinYao(option);
			}else{
				yaosvg = new YangYao(option);
			}
			yaosvg.draw();

			this.yaoWidth = yaosvg.yaoWidth;
			this.yaoX = yaosvg.x;
		}
	}

	getNumber(){
		let n = 0;
		for(let i=0; i<this.yao.length; i++){
			let v = this.yao[i].value;
			if(v < 0){
				return -1;
			}

			n = n | (v<<i);
		}

		return n;
	}

	getGua(){
		let guakey = this.getNumber();
		let gua = getGua64(guakey);
		return gua;
	}


}

export default Gua;
