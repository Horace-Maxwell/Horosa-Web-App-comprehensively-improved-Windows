import * as AstroConst from '../../constants/AstroConst';
import * as Su28Helper from './Su28Helper';

function sortPlanets(a, b){
	if(a.ra > 300 && b.ra < 30){
		return -1;
	}
	return a.ra - b.ra;
}

function createSafeSuHouse(name, source){
	const house = {
		...(source || {}),
		name: name || (source && source.name) || '',
		planets: Array.isArray(source && source.planets) ? [...source.planets] : [],
	};
	if(!Number.isFinite(Number(house.ra))){
		house.ra = 0;
	}
	return house;
}

function shouldIncludePlanet(planetDisp, obj){
	if(planetDisp){
		return planetDisp.has(obj.id);
	}
	return AstroConst.isTraditionPlanet(obj.id);
}

export function buildNormalizedSu28State(chartObj, planetDisp){
	const sourceHouses = Array.isArray(chartObj && chartObj.fixedStarSu28) ? chartObj.fixedStarSu28 : [];
	const sourceMap = new Map();
	sourceHouses.forEach((house)=>{
		if(house && house.name){
			sourceMap.set(house.name, house);
		}
	});

	const missingHouseNames = [];
	const houseMap = new Map();
	const houses = Su28Helper.Su28.map((name)=>{
		if(!sourceMap.has(name)){
			missingHouseNames.push(name);
		}
		const house = createSafeSuHouse(name, sourceMap.get(name));
		houseMap.set(name, house);
		return house;
	});

	const unknownAssignments = [];
	const objects = Array.isArray(chartObj && chartObj.objects) ? chartObj.objects : [];
	objects.forEach((obj)=>{
		if(!obj || !shouldIncludePlanet(planetDisp, obj)){
			return;
		}
		const house = houseMap.get(obj.su28);
		if(!house){
			unknownAssignments.push({
				id: obj.id,
				su28: obj.su28,
			});
			return;
		}
		house.planets.push(obj);
	});

	houses.forEach((house)=>{
		house.planets.sort(sortPlanets);
	});

	return {
		houses,
		houseMap,
		missingHouseNames,
		unknownAssignments,
	};
}
