import * as d3 from 'd3';
import * as AstroConst from '../../constants/AstroConst';
import * as Su28Helper from './Su28Helper';
import HouseSu0 from './HouseSu0';
import HouseSu1 from './HouseSu1';
import HouseSu2 from './HouseSu2';
import HouseSu3 from './HouseSu3';
import HouseSu4 from './HouseSu4';
import HouseSu5 from './HouseSu5';
import HouseSu6 from './HouseSu6';
import HouseSu7 from './HouseSu7';
import HouseSu8 from './HouseSu8';
import HouseSu9 from './HouseSu9';
import HouseSu10 from './HouseSu10';
import HouseSu11 from './HouseSu11';
import HouseSu12 from './HouseSu12';
import HouseSu13 from './HouseSu13';
import HouseSu14 from './HouseSu14';
import HouseSu15 from './HouseSu15';
import HouseSu16 from './HouseSu16';
import HouseSu17 from './HouseSu17';
import HouseSu18 from './HouseSu18';
import HouseSu19 from './HouseSu19';
import HouseSu20 from './HouseSu20';
import HouseSu21 from './HouseSu21';
import HouseSu22 from './HouseSu22';
import HouseSu23 from './HouseSu23';
import HouseSu24 from './HouseSu24';
import HouseSu25 from './HouseSu25';
import HouseSu26 from './HouseSu26';
import HouseSu27 from './HouseSu27';
import HouseSuCenter from './HouseSuCenter';
import { drawPath, drawTextH, drawTextV} from '../graph/GraphHelper';
import {randomStr,} from '../../utils/helper';
import * as SZConst from '../suzhan/SZConst';
import {ZiSign,} from '../suzhan/SZConst';

class Su28Chart {
	constructor(option){
		this.chartId = option.chartId;
		this.owner = option.owner;
		this.fields = option.fields;
		this.chartObj = option.chartObj;
		this.chartDisp = option.chartDisp;
		this.planetDisp = option.planetDisp;

		this.x = option.x;
		this.y = option.y;
		this.width = option.width;
		this.height = option.height;

		this.divTooltip = option.divTooltip;
		this.onTipClick = option.onTipClick;

		this.id = 'chart' + randomStr(8);

		this.dirIndex = null;

		this.houses = [];
		this.svg = null;
		this.flyHouse = null;
		this.houseMap = new Map();

		this.setupSuHouses();
		this.setupToolTip();
	}

	get suhouses(){
		return this.houses;
	}


	setupToolTip(){
		if(this.divTooltip){
			this.divTooltip.style("opacity", 0)
				.style('position', 'absolute')
				.style('text-align', 'left')
				.style('vertical-align', 'middle')
				.style('width', '180px')
				.style('padding', '2px')
				.style('padding-left', '10px')
				.style('font', '13px sans-serif')
				.style('background', 'lightsteelblue')
				.style('border', '0px')
				.style('border-radius', '8px')
				.style('pointer-events', 'none');
		}
	}

	setupSuHouses(){
		if(this.chartObj === null || this.chartObj === undefined){
			return;
		}

		let suhouses = this.chartObj.fixedStarSu28;
		for(let i=0; i<suhouses.length; i++){
			let suh = suhouses[i];
			suh.planets = [];
			this.houseMap.set(suh.name, suh);
		}	

		for(let i=0; i<this.chartObj.objects.length; i++){
			let obj = this.chartObj.objects[i];
			if(this.planetDisp){
				if(this.planetDisp.has(obj.id)){
					let house = this.houseMap.get(obj.su28);
					house.planets.push(obj);
				}	
			}else{
				if(AstroConst.isTraditionPlanet(obj.id)){
					let house = this.houseMap.get(obj.su28);
					house.planets.push(obj);
				}
			}
		}

		for(let su of suhouses){
			let house = this.houseMap.get(su.name);
			house.planets.sort((a, b)=>{
				if(a.ra > 300 && b.ra < 30){
					return -1;
				}
				return a.ra - b.ra;
			});
		}

	}

	clickHouse(house){
		if(this.flyHouse){
			if(this.flyHouse.name === house.name){
				this.flyHouse = null;
			}else{
				this.flyHouse = house;
			}
		}else{
			this.flyHouse = house;
		}

		this.draw();
	}

	draw(){
		this.owner.select('#' + this.id).remove();
		let container = this.owner.append('g').attr('id', this.id);
		this.svg = container;
		this.svg.append('rect')
			.attr('fill', AstroConst.AstroColor.ChartBackgroud)
			.attr('x', this.x).attr('y', this.y)
			.attr('width', this.width).attr('height', this.height);
		
		this.genHouses();
		this.drawHouses();
	}

	getHouseXY(){
		let realW = this.width;
		let realH = this.height;
		let houseW = realW / 3;
		let houseH = realH / 3;

		let x = this.x;
		let y = this.y;
		let aryXY = [];
		aryXY[0] = {x:x, y:y, w:houseW/2, h:houseH/2};
		aryXY[1] = {x:x, y:y + houseH/2, w:houseW, h:houseH/2};
		aryXY[2] = {x:x, y:y + houseH, w:houseW, h:houseH/3};
		aryXY[3] = {x:x, y:y + houseH + houseH/3, w:houseW, h:houseH/3};
		aryXY[4] = {x:x, y:y + houseH + 2*houseH/3, w:houseW, h:houseH/3};
		aryXY[5] = {x:x, y:y + 2*houseH, w:houseW, h:houseH/2};
		aryXY[6] = {x:x, y:y + 2*houseH + houseH/2, w:houseW/2, h:houseH/2};

		aryXY[7] = {x:x, y:y + 3*houseH, w:houseW/2, h:houseH/2};
		aryXY[8] = {x:x + houseW/2, y:y + 2*houseH + houseH/2, w:houseW/2, h:houseH};
		aryXY[9] = {x:x + houseW, y:y + 2*houseH, w:houseW/3, h:houseH};
		aryXY[10] = {x:x + houseW + houseW/3, y:y + 2*houseH, w:houseW/3, h:houseH};
		aryXY[11] = {x:x + houseW + 2*houseW/3, y:y + 2*houseH, w:houseW/3, h:houseH};
		aryXY[12] = {x:x + 2*houseW, y:y + 2*houseH, w:houseW/2, h:houseH};
		aryXY[13] = {x:x + 2*houseW + houseW/2, y:y + 2*houseH + houseH/2, w:houseW/2, h:houseH/2};

		aryXY[14] = {x:x + 2*houseW + houseW/2, y:y + 2*houseH + houseH/2, w:houseW/2, h:houseH/2};
		aryXY[15] = {x:x + 2*houseW, y:y + 2*houseH, w:houseW, h:houseH/2};
		aryXY[16] = {x:x + 2*houseW, y:y + houseH + 2*houseH/3, w:houseW, h:houseH/3};
		aryXY[17] = {x:x + 2*houseW, y:y + houseH + houseH/3, w:houseW, h:houseH/3};
		aryXY[18] = {x:x + 2*houseW, y:y + houseH, w:houseW, h:houseH/3};
		aryXY[19] = {x:x + 2*houseW + houseW/2, y:y + houseH/2, w:houseW, h:houseH/2};
		aryXY[20] = {x:x + 3*houseW, y:y, w:houseW/2, h:houseH/2};
		
		aryXY[21] = {x:x + 2*houseW + houseW/2, y:y, w:houseW/2, h:houseH/2};
		aryXY[22] = {x:x + 2*houseW, y:y, w:houseW/2, h:houseH};
		aryXY[23] = {x:x + houseW + 2*houseW/3, y:y, w:houseW/3, h:houseH};
		aryXY[24] = {x:x + houseW + houseW/3, y:y, w:houseW/3, h:houseH};
		aryXY[25] = {x:x + houseW, y:y, w:houseW/3, h:houseH};
		aryXY[26] = {x:x + houseW/2, y:y, w:houseW/2, h:houseH};
		aryXY[27] = {x:x, y:y, w:houseW/2, h:houseH/2};
		aryXY[28] = {x:x + houseW, y:y + houseH, w:houseW, h:houseH };
		
		return aryXY;
	}

	genHouses(){
		let aryXY = this.getHouseXY();
		let options = [];
		for(let i=0; i<aryXY.length; i++){
			let xy = aryXY[i];
			let name = Su28Helper.Su28[i];
			let color = Su28Helper.Su28Color[i];
			options[i] = {
				x: xy.x,
				y: xy.y,
				width: xy.w,
				height: xy.h,
				owner: this.svg,
				su28chart: this,
				houseObj: this.houseMap.get(name),
				fields: this.fields,
				color: color,
				onTipClick: this.onTipClick,
			};
		}

		this.houses[0] = new HouseSu0(options[0]);
		this.houses[1] = new HouseSu1(options[1]);
		this.houses[2] = new HouseSu2(options[2]);
		this.houses[3] = new HouseSu3(options[3]);
		this.houses[4] = new HouseSu4(options[4]);
		this.houses[5] = new HouseSu5(options[5]);
		this.houses[6] = new HouseSu6(options[6]);
		this.houses[7] = new HouseSu7(options[7]);
		this.houses[8] = new HouseSu8(options[8]);
		this.houses[9] = new HouseSu9(options[9]);
		this.houses[10] = new HouseSu10(options[10]);
		this.houses[11] = new HouseSu11(options[11]);
		this.houses[12] = new HouseSu12(options[12]);
		this.houses[13] = new HouseSu13(options[13]);
		this.houses[14] = new HouseSu14(options[14]);
		this.houses[15] = new HouseSu15(options[15]);
		this.houses[16] = new HouseSu16(options[16]);
		this.houses[17] = new HouseSu17(options[17]);
		this.houses[18] = new HouseSu18(options[18]);
		this.houses[19] = new HouseSu19(options[19]);
		this.houses[20] = new HouseSu20(options[20]);
		this.houses[21] = new HouseSu21(options[21]);
		this.houses[22] = new HouseSu22(options[22]);
		this.houses[23] = new HouseSu23(options[23]);
		this.houses[24] = new HouseSu24(options[24]);
		this.houses[25] = new HouseSu25(options[25]);
		this.houses[26] = new HouseSu26(options[26]);
		this.houses[27] = new HouseSu27(options[27]);
		this.houses[28] = new HouseSuCenter(options[28]);
	}

	drawHouses(){
		for(let i=0; i<this.houses.length; i++){
			let house = this.houses[i];
			house.draw();
		}
	}

	getPlanet(objid){
		if(this.chartObj === undefined || this.chartObj === null){
			return null;
		}
		if(this.chartObj.objectMap){
			return this.chartObj.objectMap[objid];
		}
		this.chartObj.objectMap = {};
		for(let i=0; i<this.chartObj.objects.length; i++ ){
			let obj = this.chartObj.objects[i];
			this.chartObj.objectMap[obj.id] = obj;
		}
		return this.chartObj.objectMap[objid];
	
	}

	getAscSign(){
		let asc = this.getPlanet(AstroConst.ASC);
		let sun = this.getPlanet(AstroConst.SUN);
		if(asc){
			const houseStartMode = this.getHouseStartMode();
			const useAscMode = houseStartMode === SZConst.SZHouseStart_ASC;
			if(!useAscMode && this.chartObj && this.chartObj.nongli && this.chartObj.nongli.bazi && sun){
				let timezi = this.chartObj.nongli.bazi.time.branch.cell;
				let timesig = ZiSign[timezi];
				let tmsigidx = AstroConst.LIST_SIGNS.indexOf(timesig);
				let sunidx = Math.floor(sun.ra / 30);
				let idx = (sunidx - tmsigidx - 5 + 24) % 12;
				return AstroConst.LIST_SIGNS[idx];
			}
			return AstroConst.LIST_SIGNS[Math.floor(asc.ra / 30)];
		}
		return null;
	}

	getHouseStartMode(){
		let mode = SZConst.SZHouseStart_Bazi;
		if(this.fields && this.fields.houseStartMode &&
			this.fields.houseStartMode.value !== undefined && this.fields.houseStartMode.value !== null){
			mode = parseInt(this.fields.houseStartMode.value, 10);
		}else{
			let localMode = localStorage.getItem('suzhanHouseStartMode');
			if(localMode !== undefined && localMode !== null){
				mode = parseInt(localMode, 10);
			}
		}
		if(mode !== SZConst.SZHouseStart_ASC){
			mode = SZConst.SZHouseStart_Bazi;
		}
		return mode;
	}

	getAscSign0(){
		let asc = null;
		for(let i=0; i<this.chartObj.objects.length; i++){
			let obj = this.chartObj.objects[i];
			if(obj.id === AstroConst.ASC){
				asc = obj;
				break;
			}
		}
		if(asc){
			let idx = -1;
			let ra = asc.ra;
			let prev = this.chartObj.signsRA[0];
			for(let i=1; i<this.chartObj.signsRA.length; i++){
				let nxt = this.chartObj.signsRA[i];
				if(prev.ra <= ra && ra < nxt.ra){
					idx = i;
					break;
				}
				prev = nxt;
			}
			if(idx === -1){
				idx = 11;
			}else{
				idx = idx - 1;
			}
			let sigra = this.chartObj.signsRA[idx];
			return sigra.id;
		}
		return null;
	}

}

export default Su28Chart;
