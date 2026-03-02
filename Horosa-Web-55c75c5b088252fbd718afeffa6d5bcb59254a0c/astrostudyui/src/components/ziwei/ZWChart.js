import * as d3 from 'd3';
import ZWHouse from './ZWHouse';
import ZWHouseSangHe from './ZWHouseSangHe';
import ZWCenterHouse from './ZWCenterHouse';
import ZWIndicator from './ZWIndicator';
import * as ZWConst from '../../constants/ZWConst';
import * as ZiWeiHelper from './ZiWeiHelper';

class ZWChart {
	constructor(chartid, chartObj, fields, tooltipId, onTipClick){
		this.fields = fields;
		this.chartId = chartid;
		this.chartObj = chartObj;
		this.dirIndex = null;
		this.margin = 20;
		this.houses = [];
		this.svgTopgroup = null;
		this.svg = null;
		this.flyHouse = null;
		this.zwindicator = new ZWIndicator({
			zwchart: this,
		});
		this.tooltipId = tooltipId;
		this.onTipClick = onTipClick;

		this.rules = null;
	}

	set chart(chartobj){
		this.chartObj = chartobj;
		for(let i=0; i<12; i++){
			this.chartObj.houses[i].years = [];
		}
		let yearzi = this.chartObj.yearZi;
		let yearidx = ZiWeiHelper.getHouseZiIndex(yearzi);

		let birthY = parseInt(this.chartObj.birth.substr(0, 4));
		let birthM = parseInt(this.chartObj.birth.substr(5, 2));
		let nongliM = this.chartObj.nongli.month;
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
		let width = svgdom.clientWidth;
		let height = svgdom.clientHeight;
		if(width === 0 || height === 0){
			return null;
		}

		let realW = width - this.margin * 2;
		let realH = height - this.margin * 2;
		let houseW = realW / 4;
		let houseH = realH / 4;

		let svgid = '#' + this.chartId;
		this.svg = d3.select(svgid);
		this.svg.html('');
		this.svg.attr('stroke', '#000000').attr("stroke-width", 1);
	
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
				divTooltip: d3.select('#' + this.tooltipId),
				divTooltipId: this.tooltipId,
				rules: this.rules,
				onTipClick: this.onTipClick,
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
		};
		let cenhouse = new ZWCenterHouse(opt);
		cenhouse.draw();
		this.houses[12] = cenhouse;
	}
}

export default ZWChart;
