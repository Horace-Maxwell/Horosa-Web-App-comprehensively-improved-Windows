import * as AstroConst from '../../constants/AstroConst';

export const AstroLines = [
	AstroConst.SUN, AstroConst.MOON, AstroConst.MERCURY, AstroConst.VENUS,
	AstroConst.MARS, AstroConst.JUPITER, AstroConst.SATURN,
	AstroConst.URANUS, AstroConst.NEPTUNE, AstroConst.PLUTO, AstroConst.CHIRON,
	AstroConst.NORTH_NODE, AstroConst.SOUTH_NODE, 
	AstroConst.DARKMOON, AstroConst.PURPLE_CLOUDS
];

// 小行星线(§ 天体集):谷神/智神/婚神/灶神/阋神。默认不勾选、不进 getAllLines(=默认选集不变,
// 零回归);选择器单列一组。任一被勾选时前端下发 asteroids='1' 触发后端 swisseph 直算出线。
export const AsteroidLines = [
	AstroConst.CERES, AstroConst.PALLAS, AstroConst.JUNO, AstroConst.VESTA, AstroConst.ERIS
];

export const Angles = [
	AstroConst.ASC, AstroConst.DESC, AstroConst.MC, AstroConst.IC
];

function linesFor(bodies){
	let lines = [];
	for(let i=0; i<bodies.length; i++){
		let planet = bodies[i];
		for(let j=0; j<Angles.length; j++){
			lines.push(planet + ':' + Angles[j]);
		}
	}
	return lines;
}

export function getAllLines(){
	return linesFor(AstroLines);
}

// 全部小行星×四角(20 项),供选择器小行星分组渲染(不入默认选集)。
export function getAsteroidLines(){
	return linesFor(AsteroidLines);
}

// 判断某线选集里是否含任一小行星线 → 决定是否下发 asteroids='1'。
export function hasAsteroidLine(linesSet){
	if(!linesSet) return false;
	const arr = Array.isArray(linesSet) ? linesSet : Array.from(linesSet);
	return AsteroidLines.some((a) => arr.some((l) => l.split(':')[0] === a));
}
