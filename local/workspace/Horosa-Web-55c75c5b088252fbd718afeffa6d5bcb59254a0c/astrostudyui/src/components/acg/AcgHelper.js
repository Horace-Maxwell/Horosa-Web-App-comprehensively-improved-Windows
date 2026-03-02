import * as AstroConst from '../../constants/AstroConst';

export const AstroLines = [
	AstroConst.SUN, AstroConst.MOON, AstroConst.MERCURY, AstroConst.VENUS,
	AstroConst.MARS, AstroConst.JUPITER, AstroConst.SATURN,
	AstroConst.URANUS, AstroConst.NEPTUNE, AstroConst.PLUTO, AstroConst.CHIRON,
	AstroConst.NORTH_NODE, AstroConst.SOUTH_NODE, 
	AstroConst.DARKMOON, AstroConst.PURPLE_CLOUDS
];

export const Angles = [
	AstroConst.ASC, AstroConst.DESC, AstroConst.MC, AstroConst.IC
];

export function getAllLines(){
	let lines = [];
	for(let i=0; i<AstroLines.length; i++){
		let planet = AstroLines[i];
		for(let j=0; j<Angles.length; j++){
			let ang = Angles[j];
			let val = planet + ':' + ang;
			lines.push(val);
		}
	}
	return lines;
}
