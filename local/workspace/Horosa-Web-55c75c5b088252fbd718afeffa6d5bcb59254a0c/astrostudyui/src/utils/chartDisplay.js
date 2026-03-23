import * as AstroConst from '../constants/AstroConst';
import * as AstroText from '../constants/AstroText';

function normalizeText(value){
	if(value === undefined || value === null){
		return '';
	}
	return `${value}`.trim();
}

export function normalizeZodiacalValue(value){
	if(value === undefined || value === null || value === ''){
		return AstroConst.TROPICAL;
	}
	if(value === 0 || value === '0'){
		return AstroConst.TROPICAL;
	}
	if(value === 1 || value === '1'){
		return AstroConst.SIDEREAL;
	}
	const raw = normalizeText(value);
	if(raw === AstroConst.TROPICAL || raw === AstroConst.SIDEREAL){
		return raw;
	}
	if(raw === AstroText.AstroMsg[AstroConst.TROPICAL]){
		return AstroConst.TROPICAL;
	}
	if(
		raw === AstroText.AstroMsg[AstroConst.SIDEREAL]
		|| raw.indexOf(AstroText.AstroMsg[AstroConst.SIDEREAL]) === 0
	){
		return AstroConst.SIDEREAL;
	}
	if(Object.prototype.hasOwnProperty.call(AstroConst.ZODIACAL, raw)){
		return AstroConst.ZODIACAL[raw];
	}
	return raw || AstroConst.TROPICAL;
}

export function getZodiacalDisplayText(value, options = {}){
	const normalized = normalizeZodiacalValue(value);
	const includeDetail = options.includeDetail !== false;
	if(normalized === AstroConst.SIDEREAL && includeDetail && AstroText.AstroTxtMsg[normalized]){
		return AstroText.AstroTxtMsg[normalized];
	}
	return AstroText.AstroMsg[normalized] || normalized || '';
}

export function normalizeHouseSystemValue(value){
	if(value === undefined || value === null || value === ''){
		return '0';
	}
	const raw = normalizeText(value);
	if(Object.prototype.hasOwnProperty.call(AstroConst.HouseSys, raw)){
		return raw;
	}
	const entries = Object.entries(AstroConst.HouseSys);
	for(let i=0; i<entries.length; i++){
		const [key, label] = entries[i];
		if(raw === label){
			return key;
		}
	}
	return raw;
}

export function getHouseSystemDisplayText(value){
	const normalized = normalizeHouseSystemValue(value);
	if(Object.prototype.hasOwnProperty.call(AstroConst.HouseSys, normalized)){
		return AstroConst.HouseSys[normalized];
	}
	if(AstroText.AstroMsg[normalized]){
		return AstroText.AstroMsg[normalized];
	}
	return normalized || '';
}

export function buildChartDisplaySummary(options = {}){
	return {
		zodiacalValue: normalizeZodiacalValue(options.zodiacal),
		hsysValue: normalizeHouseSystemValue(options.hsys),
		zodiacalLabel: getZodiacalDisplayText(options.zodiacal, options),
		houseSystemLabel: getHouseSystemDisplayText(options.hsys),
	};
}
