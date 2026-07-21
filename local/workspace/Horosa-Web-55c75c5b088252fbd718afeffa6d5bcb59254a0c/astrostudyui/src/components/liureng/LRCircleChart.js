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
		this.panStyleTitle = option.panStyleName || '';
	}

	set cuangName(name){ 
		this.cuangTitle = name;
		this.drawTitle();
	}

	set panStyleName(name){
		this.panStyleTitle = name || '';
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
			highLightData: [this.realTimeBranch], // 地盘高亮=真实时支(占时),恒定不随起课法
			highLightColor: LRConst.LRColor.time.color,
			highLightBgColor: LRConst.LRColor.time.bg,
			onSegment: (group, idx)=>{
				this.bindShenTooltip(group, this.downZi && this.downZi[idx] ? this.downZi[idx] : '');
			},
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
			highLightData: [this.actualYue], // 天盘高亮=真实月将(非起课法天盘起支 X);二者非起课法下相等
			highLightColor: LRConst.LRColor.time.color,
			highLightBgColor: LRConst.LRColor.time.bg,
			onSegment: (group, idx)=>{
				this.bindShenTooltip(group, this.upZi && this.upZi[idx] ? this.upZi[idx] : '');
			},
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
			onSegment: (group, idx)=>{
				this.bindHouseTooltip(group, idx);
			},
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
		let data = ((this.nongli && this.nongli.dayGanZi) ? this.nongli.dayGanZi : '').split(''); // nongli 未就绪守卫
		data.push('日');
		drawTextH(house, data, x, y, w, h, 2, this.color);

		data = this.cuangTitle.split('');
		y = y + h + 5;
		drawTextH(house, data, x, y, w, h, 2, this.color);
		if(this.panStyleTitle){
			data = this.panStyleTitle.split('');
			y = y + h + 5;
			drawTextH(house, data, x, y, w, h, 2, this.color);
		}
	}

}

export default LRCircleChart;
