import {randomStr,} from '../../utils/helper';
import * as ZWConst from '../../constants/ZWConst';
import * as ZiWeiHelper from './ZiWeiHelper';

class ZWIndicator {
	constructor(option){
		this.zwchart = option.zwchart;
	}

	isReady(){
		return this.zwchart !== undefined && this.zwchart !== null;
	}

	getFatherRisk(){
		if(!this.isReady()){
			return null;
		}

		let idx = 0;
		for(let i=0; i<this.zwchart.houses.length; i++){
			let house = this.zwchart.houses[i];
			if(house.dirname === ZWConst.ZWHouses[11]){
				idx = i;
				break;
			}
		}
		idx = (idx - 5 + 12) % 12;
		let sickHouse = this.zwchart.houses[idx];
		let sickGan = sickHouse.houseObj.ganzi.substr(0, 1);
		let jiStar = ZWConst.SiHua.gan[sickGan][3];
		let jiHouseIdx = this.zwchart.chartObj.starsHouseIndex[jiStar];
		let jiHouse = this.zwchart.houses[jiHouseIdx];
		let jiGan = jiHouse.houseObj.ganzi.substr(0, 1);
		let dunGan = ZWConst.WuHuDun[jiGan];
		let ganIdx = ZWConst.Gans.indexOf(dunGan);
		let delta = (jiHouseIdx - 2 + 12) % 12;
		idx = (ganIdx + delta) % 10;
		let gan = ZWConst.Gans[idx];
		jiStar = ZWConst.SiHua.gan[gan][3];
		jiHouseIdx = this.zwchart.chartObj.starsHouseIndex[jiStar];
		idx = (jiHouseIdx + 5) % 12;
		let house = this.zwchart.houses[idx];
		return house.yearText;
	}

}

export default ZWIndicator;

