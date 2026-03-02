import * as AstroConst from '../../constants/AstroConst';
import LRInnerChart from './LRInnerChart';
import * as LRConst from './LRConst';
import {randomStr,} from '../../utils/helper';
import { drawPath, drawTextH, drawTextV} from '../graph/GraphHelper';


class LRCommChart {
	constructor(option){
		this.owner = option.owner;
		this.fields = option.fields;
		this.chartObj = option.chartObj;
		this.yue = option.yue;
		this.nongli = option.nongli;
		this.guireng = option.guireng;

		this.x = option.x;
		this.y = option.y;
		this.width = option.width;
		this.height = option.height;

		this.divTooltip = option.divTooltip;

		this.id = 'chart' + randomStr(8);

		this.dirIndex = null;

		this.svg = null;

		this.fontSize = 18;
		this.color = AstroConst.AstroColor.Stroke;
		this.bgColor = LRConst.getHouseColor(0);
		this.margin = 3;
		this.fontFamily = [
			AstroConst.NormalFont,
			AstroConst.NormalFont,
			AstroConst.NormalFont,
			AstroConst.NormalFont,
			AstroConst.AstroChartFont,
			AstroConst.NormalFont,
		];
		this.timezi = this.nongli.time.substr(1);
		this.yueIndexs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
		this.tianJiangColor = LRConst.LRColor.tianJiangColor;
		this.houseTianJiang = LRConst.TianJiang.slice(0);
		this.upZi = LRConst.ZiList.slice(0);
		this.downZi = LRConst.ZiList.slice(0);
	}

	set cuangName(name){ }

	draw(){
		this.owner.select('#' + this.id).remove();
		let container = this.owner.append('g').attr('id', this.id);
		this.svg = container;

		this.genYueJiangIndex();
		this.genHouseTianJiang();		
	}

	genYueJiangIndex(){
		let yueIdx = LRConst.ZiList.indexOf(this.yue);
		let tmIdx = LRConst.ZiList.indexOf(this.timezi);
		let delta = yueIdx - tmIdx;
		for(let i=0; i<12; i++){
			let idx = (i + delta + 12) % 12;
			this.yueIndexs[i] = idx;
			this.upZi[i] = LRConst.ZiList[idx];
		}
	}

	genHouseTianJiang(){
		let guizi = LRConst.getGuiZi(this.chartObj, this.guireng);
		let houseidx = 0;
		for(let i=0; i<12; i++){
			let zi = LRConst.ZiList[this.yueIndexs[i]];
			if(zi === guizi){
				houseidx = i;
				break;
			}
		}
		let housezi = LRConst.ZiList[houseidx];
		if(LRConst.SummerZiList.indexOf(housezi) >= 0){
			for(let i=0; i<12; i++){
				let idx = (houseidx - i + 12) % 12;
				this.houseTianJiang[i] = LRConst.TianJiang[idx];
			}
		}else{
			for(let i=0; i<12; i++){
				let idx = (i - houseidx + 12) % 12;
				this.houseTianJiang[i] = LRConst.TianJiang[idx];
			}
		}
	}

	getKe(){
		let daygan = this.chartObj.nongli.dayGanZi.substr(0, 1);
		let ganjizi = LRConst.GanJiZi[daygan];
		let idx = this.downZi.indexOf(ganjizi);
		let ke1zi = this.upZi[idx];
		let tj1 = this.houseTianJiang[idx];
		let ke1 = [tj1, ke1zi, daygan];

		idx = this.downZi.indexOf(ke1zi);
		let ke2zi = this.upZi[idx];
		let tj2 = this.houseTianJiang[idx];
		let ke2 = [tj2, ke2zi, ke1zi];

		let dayzi = this.chartObj.nongli.dayGanZi.substr(1);
		idx = this.downZi.indexOf(dayzi);
		let ke3zi = this.upZi[idx];
		let tj3 = this.houseTianJiang[idx];
		let ke3 = [tj3, ke3zi, dayzi];

		idx = this.downZi.indexOf(ke3zi);
		let ke4zi = this.upZi[idx];
		let tj4 = this.houseTianJiang[idx];
		let ke4 = [tj4, ke4zi, ke3zi];

		let res = [ke1, ke2, ke3, ke4];
		return res;
	}

}

export default LRCommChart;
