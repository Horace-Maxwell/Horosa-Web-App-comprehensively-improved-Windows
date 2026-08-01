import * as AstroConst from '../../constants/AstroConst';
import LRInnerChart from './LRInnerChart';
import * as LRConst from './LRConst';
import {randomStr,} from '../../utils/helper';
import { drawPath, drawTextH, drawTextV} from '../graph/GraphHelper';
import { creatTooltip } from '../../utils/helper';
import { buildLiuRengHouseTipObj, buildLiuRengShenTipObj } from './LRShenJiangDoc';

// 取象点击桥：点击盘中地支 / 天将 → 派发窗口事件，右栏「取象」tab 接收并钉住（解耦 d3 ↔ React，仿既有 window 事件用法）。
// 与悬浮提示互不影响：仅新增 click 监听，hover 行为不变；「取象」开关关闭时，监听端会忽略事件。
function emitLiurengXiangPick(detail){
	if(typeof window === 'undefined' || typeof window.dispatchEvent !== 'function'){
		return;
	}
	try{
		window.dispatchEvent(new CustomEvent('horosa:liureng-xiang-pick', { detail: detail || {} }));
	}catch(e){
		/* 老环境无 CustomEvent 构造器则忽略 */
	}
}


class LRCommChart {
	constructor(option){
		this.owner = option.owner;
		this.fields = option.fields;
		this.chartObj = option.chartObj;
		// 起课法/换将覆盖：天盘起支(yue) 与 临位(timezi) 取 castOverride，缺省=月将/正时(现状)。
		this.castOverride = option.castOverride || null;
		this.yue = (this.castOverride && this.castOverride.yue) || option.yue;
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
		// nongli 可能未就绪(后端瞬断/首载 race);缺失时空串兜底,与 :63 realTimeBranch 同款守卫,防构造期崩渲染
		this.timezi = (this.castOverride && this.castOverride.timeZhi) || ((this.nongli && this.nongli.time) ? this.nongli.time.substr(1) : '');
		// 高亮用「真实月将」「真实时支」:起课法只改 yue(天盘起支 X)/timezi(临位 Y) 来对齐上下盘,
		// 但高亮恒标真实月将(actualYue)与真实占时(realTimeBranch),不随起课法漂移到 X/Y 的对齐格。
		this.actualYue = (this.castOverride && this.castOverride.actualYue) || this.yue;
		this.realTimeBranch = this.nongli && this.nongli.time ? this.nongli.time.substr(1) : this.timezi;
		this.yueIndexs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
		this.tianJiangColor = LRConst.LRColor.tianJiangColor;
		this.houseTianJiang = LRConst.TianJiang.slice(0);
		this.upZi = LRConst.ZiList.slice(0);
		this.downZi = LRConst.ZiList.slice(0);
		this._panStyleName = option.panStyleName || '';
	}

	set cuangName(name){ }
	set panStyleName(name){ this._panStyleName = name || ''; }

	buildHouseTipObj(houseIndex){
		if(houseIndex === undefined || houseIndex === null){
			return null;
		}
		const idx = Number(houseIndex);
		if(!Number.isFinite(idx) || idx < 0 || idx >= 12){
			return null;
		}
		const tianBranch = this.upZi && this.upZi[idx] ? this.upZi[idx] : '';
		const diBranch = this.downZi && this.downZi[idx] ? this.downZi[idx] : '';
		const jiang = this.houseTianJiang && this.houseTianJiang[idx] ? this.houseTianJiang[idx] : '';
		return buildLiuRengHouseTipObj(jiang, tianBranch, diBranch);
	}

	buildShenTipObj(branch){
		return buildLiuRengShenTipObj(branch);
	}

	_liurengDayGan(){
		try{
			return this.chartObj && this.chartObj.nongli && this.chartObj.nongli.dayGanZi
				? `${this.chartObj.nongli.dayGanZi}`.substr(0, 1)
				: '';
		}catch(e){
			return '';
		}
	}

	bindHouseTooltip(target, houseIndex){
		if(!this.divTooltip || !target){
			return;
		}
		const tipObj = this.buildHouseTipObj(houseIndex);
		if(!tipObj){
			return;
		}
		creatTooltip(this.divTooltip, target, tipObj, null, true, true);
		const hi = Number(houseIndex);
		const tian = this.upZi && this.upZi[hi] ? this.upZi[hi] : '';
		const di = this.downZi && this.downZi[hi] ? this.downZi[hi] : '';
		const jiang = this.houseTianJiang && this.houseTianJiang[hi] ? this.houseTianJiang[hi] : '';
		target.on('click.xiang', ()=>emitLiurengXiangPick({ branch: tian, secondBranch: di, jiang, role: '宫', dayGan: this._liurengDayGan() }));
	}

	bindShenTooltip(target, branch){
		if(!this.divTooltip || !target){
			return;
		}
		const tipObj = this.buildShenTipObj(branch);
		if(!tipObj){
			return;
		}
		creatTooltip(this.divTooltip, target, tipObj, null, true, true);
		const zhi = `${branch || ''}`.substring(0, 1);
		target.on('click.xiang', ()=>emitLiurengXiangPick({ branch: zhi, role: '神', dayGan: this._liurengDayGan() }));
	}

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
		// 第 4 参(昼夜阳阴归属)从前漏传 → 中栏盘十二天将起点与右栏断辞/AI 快照(均传 4 参)分叉:
		// 阳阴系 + 六壬法贵人 + 日干甲乙丙辛壬癸 时两侧贵人不同,界面自相矛盾。缺省 undefined ≡ 旦暮系 = 零回归。
		let guizi = LRConst.getGuiZi(this.chartObj, this.guireng, this.castOverride ? this.castOverride.isDiurnal : undefined, this.castOverride ? this.castOverride.yinyangSystem : undefined);
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
