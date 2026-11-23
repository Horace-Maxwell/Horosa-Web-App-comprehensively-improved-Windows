// 3D 星盘 · 天体的位置偏移表与半径表(缺省值 + 逐天体登记)及取值
// 从 Astro3D.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import * as AstroConst from '../../../constants/AstroConst';

const PosOffset = {
	DefaultOffset: 6,
};

PosOffset[AstroConst.SUN] = 12;
PosOffset[AstroConst.MOON] = 3;
PosOffset[AstroConst.MERCURY] = 8;
PosOffset[AstroConst.VENUS] = 6;
PosOffset[AstroConst.MARS] = 10;
PosOffset[AstroConst.JUPITER] = 14.2;
PosOffset[AstroConst.SATURN] = 18.5;
PosOffset[AstroConst.URANUS] = 22.2;
PosOffset[AstroConst.NEPTUNE] = 26.1;
PosOffset[AstroConst.PLUTO] = 28.1;
PosOffset[AstroConst.CHIRON] = 12;
PosOffset[AstroConst.NORTH_NODE] = 5;
PosOffset[AstroConst.SOUTH_NODE] = 5;
PosOffset[AstroConst.SYZYGY] = 5;
PosOffset[AstroConst.PARS_FORTUNA] = PosOffset.DefaultOffset;
PosOffset[AstroConst.DARKMOON] = 4;
PosOffset[AstroConst.PURPLE_CLOUDS] = 2;
PosOffset[AstroConst.PHOLUS] = 13;
PosOffset[AstroConst.CERES] = 13;
PosOffset[AstroConst.PALLAS] = 13;
PosOffset[AstroConst.JUNO] = 13;
PosOffset[AstroConst.VESTA] = 13;
PosOffset[AstroConst.INTP_APOG] = 13;
PosOffset[AstroConst.INTP_PERG] = 13;

export function getPosOffset(name){
	let offset = PosOffset[name];
	if(offset){
		return offset;
	}
	return PosOffset.DefaultOffset;
}

export const PlanetRadius = {
	DefaultR: 8,
	Earth: 120,
}
PlanetRadius[AstroConst.SUN] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.MOON] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.MERCURY] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.VENUS] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.MARS] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.JUPITER] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.SATURN] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.URANUS] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.NEPTUNE] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.PLUTO] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.CHIRON] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.NORTH_NODE] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.SOUTH_NODE] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.SYZYGY] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.PARS_FORTUNA] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.DARKMOON] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.PURPLE_CLOUDS] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.PHOLUS] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.CERES] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.PALLAS] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.JUNO] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.VESTA] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.INTP_APOG] = PlanetRadius.DefaultR;
PlanetRadius[AstroConst.INTP_PERG] = PlanetRadius.DefaultR;

export function getPlanetRadius(name){
	let r = PlanetRadius[name];
	if(r){
		return r;
	}
	return PlanetRadius.DefaultR;
}
