import * as d3 from 'd3';
import ZWHouse from './ZWHouse';
import ZWHouseSangHe from './ZWHouseSangHe';
import ZWCenterHouse from './ZWCenterHouse';
import ZWIndicator from './ZWIndicator';
import * as ZWConst from '../../constants/ZWConst';
import * as ZiWeiHelper from './ZiWeiHelper';
import { parseDateParts } from '../../utils/dateStrSafe';
import { fitSvgDesignBox } from '../../utils/svgDesignBox';

// 紫微盘绘制坐标的设计下限(CSS px)。宫内星列按宫宽切、四化徽 / 小星字号随列宽变(实测最小字:520 → 2.3 px、640 → 5.7、
// 734 → 7.9、774 → 10.4):设计尺寸要让「按设计尺寸画、不缩」时最小字已 ≥ 9 px —— 否则放大档盘一放得下就按像素画、字仍不到 9 px,
// 盘面最小字视觉下限(utils/chartTextFloor)够不着它。780 时最小字 ≈ 10.4;1.8 档反推最小渲染宽 ≈ 0.48 × 780,中栏不够时工作区加宽。
// 盘 ≥ 780 时不写 viewBox、按像素画(1 档常规窗口盘宽 ~976,一字不变)。
export const ZW_DESIGN_MIN = 780;
import { ZWEngineOptions } from './ziweiOptions';   // 手册补齐:活盘太极点

class ZWChart {
	constructor(chartid, chartObj, fields, tooltipId, onTipClick, onCenterInfoClick){
		this.fields = fields;
		this.chartId = chartid;
		this.chartObj = chartObj;
		this.dirIndex = null;
		this.margin = 20;
		this.houses = [];
		this.svgTopgroup = null;
		this.svg = null;
		this.flyHouse = null;
		this.luckMingIndex = null;
		this.zwindicator = new ZWIndicator({
			zwchart: this,
		});
		this.tooltipId = tooltipId;
		this.onTipClick = onTipClick;
		this.onCenterInfoClick = onCenterInfoClick;

		this.rules = null;
	}

	set chart(chartobj){
		this.chartObj = chartobj;
		for(let i=0; i<12; i++){
			this.chartObj.houses[i].years = [];
		}
		let yearzi = this.chartObj.yearZi;
		let yearidx = ZiWeiHelper.getHouseZiIndex(yearzi);

		const _bp = parseDateParts(this.chartObj.birth) || {};
		let birthY = _bp.year;
		let birthM = _bp.month;
		// 本地历算的闰月月名自带「闰」(闰冬月 / 闰腊月),比较前去掉;历法服务给的是「冬月」+ leap 标志
		let nongliM = `${this.chartObj.nongli.month || ''}`.replace(/^闰/, '');
		if(birthM <= 2 && (nongliM === '腊月' || nongliM === '冬月')){
			birthY = birthY - 1;
		}
		if(birthY === 0){
			birthY = 1;
		}
		for(let i=0; i<100; i++){
			let idx = (yearidx + i) % 12;
			let house = this.chartObj.houses[idx];
			let y = birthY + i;
			if(y === 0){
				y = 1;
			}
			house.years.push({
				year: y,
				age: i + 1,
			});
		}
	}

	set dirHouseIndex(idx){
		this.dirIndex = idx;
	}


	get zwhouses(){
		return this.houses;
	}



	clickHouse(house){
		// 活盘(WP-3):huoPan 模式下点宫=设该宫为太极点(新命宫),再点原太极点则复位;星曜地支不动、仅宫名重排。
		// 单击双义:翻完太极点不提前 return,落穿飞化 toggle——落太极点即续飞化(宫底色三态/
		// 飞化染色/三合虚线/斗君文案不再被连坐);同宫再点=太极点与飞化宫双清,对称。末尾单次 draw。
		if(ZWEngineOptions.huoPan){
			const idx = house && house.houseChart ? house.houseChart.houseIndex : null;
			if(idx !== null && idx !== undefined){
				this.taijiIdx = (this.taijiIdx === idx) ? null : idx;
			}
		}
		if(this.flyHouse){
			if(this.flyHouse.ganzi === house.ganzi){
				this.flyHouse = null;
			}else{
				this.flyHouse = house;
			}
		}else{
			this.flyHouse = house;
		}

		let ytxt = house.houseChart.yearText;
		if(ytxt){
			let yearzi = house.ganzi.substr(1, 1);
			let zidou = this.chartObj.zidou;
			let doujun = ZiWeiHelper.getDouJun(zidou, yearzi);
			this.yearDoujun = ytxt + '斗君为：' + doujun;	
		}

		this.draw();
	}

	draw(){
		if(this.chartObj === undefined || this.chartObj === null ||
			this.chartObj.houses === undefined || this.chartObj.houses === null){
			return null;
		}
		let svgdom = document.getElementById(this.chartId); 
		if(svgdom === undefined || svgdom === null){
			return null;
		}
		if(svgdom.clientWidth === 0 || svgdom.clientHeight === 0){
			return null;
		}
		// 盘小于设计下限(放大档 / 择日窄栏)时按下限绘制、viewBox 整体等比缩回 —— 宫内星列按像素切,窄盘里四化徽宽度会算成负数
		const { width, height } = fitSvgDesignBox(svgdom, ZW_DESIGN_MIN, ZW_DESIGN_MIN);

		let realW = width - this.margin * 2;
		let realH = height - this.margin * 2;
		let houseW = realW / 4;
		let houseH = realH / 4;

		let svgid = '#' + this.chartId;
		this.svg = d3.select(svgid);
		this.svg.html('');
		this.svg.attr('stroke', ZWConst.ZWColor.HouseLineStroke).attr("stroke-width", this.kinastroBorrowed ? 1.55 : 1.35);
	
		this.svgTopgroup = this.svg.append('g');
		let x = this.margin;
		let y = this.margin;
		let aryXY = [];
		aryXY[0] = {x:x + 2*houseW, y:y + 3*houseH};
		aryXY[1] = {x:x + houseW, y:y + 3*houseH};
		aryXY[2] = {x:x, y:y + 3*houseH};
		aryXY[3] = {x:x, y:y + 2*houseH};
		aryXY[4] = {x:x, y:y + houseH};
		aryXY[5] = {x:x, y:y};
		aryXY[6] = {x:x + houseW, y:y};
		aryXY[7] = {x:x + 2*houseW, y:y};
		aryXY[8] = {x:x + 3*houseW, y:y};
		aryXY[9] = {x:x + 3*houseW, y:y + houseH};
		aryXY[10] = {x:x + 3*houseW, y:y + 2*houseH};
		aryXY[11] = {x:x + 3*houseW, y:y + 3*houseH};
		aryXY[12] = {x:x + houseW, y:y + houseH};

		for(let i=0; i<12; i++){
			x = aryXY[i].x;
			y = aryXY[i].y;
			let houseobj = {
				...this.chartObj.houses[i],
			};
			let dirname = null;
			let yeartxt = null;
			if(this.dirIndex !== undefined && this.dirIndex !== null){
				let delta = this.dirIndex - i;
				if(delta > 0){
					let idx = delta;
					dirname = ZWConst.ZWHouses[idx];
				}else if(delta === 0){
					dirname = ZWConst.ZWHouses[0];
				}else{
					let idx = delta + 12;
					dirname = ZWConst.ZWHouses[idx];
				}
				let startAge = this.chartObj.houses[this.dirIndex].direction[0];
				let endAge = this.chartObj.houses[this.dirIndex].direction[1];
				for(let j=0; j<houseobj.years.length; j++){
					let fy = houseobj.years[j];
					if(fy.age >= startAge && fy.age <= endAge){
						yeartxt = fy.year + '年' + fy.age + '岁';
						break;
					}
				}
			}
			let opt = {
				owner: this.svgTopgroup,
				x: x,
				y: y,
				width: houseW,
				height: houseH,
				houseObj: houseobj,
				dirname: dirname,
				yearText: yeartxt,
				chartObj: this.chartObj,
				zwchart: this,
				dirIndex: this.dirIndex,
				houseIndex: i,
				luckMingIndex: this.luckMingIndex,
				luckSihuaLayers: this.luckSihuaLayers,
				luckShowZihua: this.luckShowZihua,
				luckLabelLayers: this.luckLabelLayers,
				divTooltip: d3.select('#' + this.tooltipId),
				divTooltipId: this.tooltipId,
				rules: this.rules,
				onTipClick: this.onTipClick,
				onCenterInfoClick: this.onCenterInfoClick,
				kinastroBorrowed: this.kinastroBorrowed,
			};
			if(this.flyHouse){
				opt.flyGanzi = this.flyHouse.ganzi;
			}
			let house = null;
			if(ZWConst.ZWChart.chart === ZWConst.ZWChart_SangHe){
				house = new ZWHouseSangHe(opt);
			}else{
				house = new ZWHouse(opt);
			}
			house.draw();
			this.houses[i] = house;
		}

		let opt = {
			owner: this.svgTopgroup,
			x: aryXY[12].x,
			y: aryXY[12].y,
			width: houseW*2,
			height: houseH*2,
			chartObj: this.chartObj,
			zwchart: this,
			dirIndex: this.dirIndex,
			fields: this.fields,
			yearDoujun: this.yearDoujun,
			divTooltip: d3.select('#' + this.tooltipId),
				divTooltipId: this.tooltipId,
				rules: this.rules,
				onTipClick: this.onTipClick,
				onCenterInfoClick: this.onCenterInfoClick,
			};
		let cenhouse = new ZWCenterHouse(opt);
		cenhouse.draw();
		this.houses[12] = cenhouse;
	}
}

export default ZWChart;
