import * as AstroConst from '../../constants/AstroConst';
import * as LRConst from './LRConst';
import LRCommChart from './LRCommChart';
import D3Circle from '../graph/D3Circle';
import { drawTextH, } from '../graph/GraphHelper';

class LRCircleChart extends LRCommChart {
	constructor(option){
		super(option);

		this.ox = this.x + this.width/2;
		this.oy = this.y + this.height/2;
		let r = 300;
		if(this.height < this.width){
			r = this.height / 2;
		}else{
			r = this.width / 2
		}
		this.r = r;
		this.step = r / 5;

		this.circles = [];
		this.cuangTitle = null;
	}

	set cuangName(name){ 
		this.cuangTitle = name;
		this.drawTitle();
	}

	draw(){
		super.draw();

		this.drawDownCircle();
		this.drawUpCircle();
		this.drawTianJiangCircle();
	}

	drawDownCircle(){
		let options = {
			owner: this.owner,
			x: this.ox,
			y: this.oy,
			r: this.step*3,
			step: this.step,
			color: this.color,
			bgColor: AstroConst.AstroColor.NoColor,
			data: this.downZi,
			highLightData: [this.nongli.time.substr(1)],
			highLightColor: LRConst.LRColor.time.color,
			highLightBgColor: LRConst.LRColor.time.bg,
		};

		let downChart = new D3Circle(options);
		this.circles[0] = downChart;
		downChart.draw();
	}

	drawUpCircle(){
		let options = {
			owner: this.owner,
			x: this.ox,
			y: this.oy,
			r: this.step*4,
			step: this.step,
			color: this.color,
			bgColor: this.bgColor,
			data: this.upZi,
			highLightData: [this.yue],
			highLightColor: LRConst.LRColor.time.color,
			highLightBgColor: LRConst.LRColor.time.bg,
		};

		let downChart = new D3Circle(options);
		this.circles[1] = downChart;
		downChart.draw();
	}

	drawTianJiangCircle(){
		let options = {
			owner: this.owner,
			x: this.ox,
			y: this.oy,
			r: this.r,
			step: this.step,
			color: this.tianJiangColor,
			bgColor: AstroConst.AstroColor.NoColor,
			data: this.houseTianJiang,
		};

		let downChart = new D3Circle(options);
		this.circles[2] = downChart;
		downChart.draw();
	}

	drawTitle(){
		if(this.cuangTitle === undefined || this.cuangTitle === null){
			return;
		}

		let house = this.svg.append('g');

		let fontsize = 20;

		let x = this.ox - this.step;
		let y = this.oy - this.step;
		let w = this.step*2;
		let h = fontsize;
		let data = this.nongli.dayGanZi.split('');
		data.push('日');
		drawTextH(house, data, x, y, w, h, 2, this.color);

		data = this.cuangTitle.split('');
		y = y + h + 5;
		drawTextH(house, data, x, y, w, h, 2, this.color);
	}

}

export default LRCircleChart;
