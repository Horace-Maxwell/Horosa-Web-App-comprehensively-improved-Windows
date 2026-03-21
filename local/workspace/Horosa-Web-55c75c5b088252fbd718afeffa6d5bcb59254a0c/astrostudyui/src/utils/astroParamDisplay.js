import * as AstroConst from '../constants/AstroConst';
import * as AstroText from '../constants/AstroText';

function isNil(value){
	return value === undefined || value === null || value === '';
}

function asString(value){
	if(isNil(value)){
		return '';
	}
	return `${value}`.trim();
}

export function normalizeZodiacalKey(value){
	if(isNil(value)){
		return '';
	}
	if(value === 0 || value === '0'){
		return AstroConst.TROPICAL;
	}
	if(value === 1 || value === '1'){
		return AstroConst.SIDEREAL;
	}
	const txt = asString(value);
	if(!txt){
		return '';
	}
	if(txt === AstroConst.TROPICAL || txt.toLowerCase() === AstroConst.TROPICAL.toLowerCase()){
		return AstroConst.TROPICAL;
	}
	if(txt === AstroConst.SIDEREAL || txt.toLowerCase() === AstroConst.SIDEREAL.toLowerCase()){
		return AstroConst.SIDEREAL;
	}
	if(AstroConst.ZODIACAL[txt]){
		return AstroConst.ZODIACAL[txt];
	}
	return txt;
}

export function getZodiacalDisplay(value, options = {}){
	const key = normalizeZodiacalKey(value);
	if(!key){
		return '';
	}
	if(options.preferDetailedSidereal && key === AstroConst.SIDEREAL){
		return AstroText.AstroTxtMsg[key] || AstroText.AstroMsg[key] || key;
	}
	return AstroText.AstroMsg[key] || AstroText.AstroTxtMsg[key] || key;
}

export function normalizeHouseSystemDisplay(value){
	if(isNil(value)){
		return '';
	}
	const txt = asString(value);
	if(!txt){
		return '';
	}
	if(AstroConst.HouseSys[txt]){
		return AstroConst.HouseSys[txt];
	}
	for(const key in AstroConst.HouseSys){
		if(AstroConst.HouseSys[key] === txt){
			return txt;
		}
	}
	return AstroText.AstroMsg[txt] || txt;
}

export function getHouseSystemDisplay(value){
	return normalizeHouseSystemDisplay(value);
}

export function getAstroParamLine(zodiacalValue, hsysValue, options = {}){
	const zodiacal = getZodiacalDisplay(zodiacalValue, options);
	const hsys = normalizeHouseSystemDisplay(hsysValue);
	if(zodiacal && hsys){
		return `${zodiacal}，${hsys}`;
	}
	return zodiacal || hsys || '';
}

export function matchesAstroChartParams(chartObj, expected = {}){
	const params = chartObj && chartObj.params ? chartObj.params : {};
	if(expected.zodiacal !== undefined && expected.zodiacal !== null){
		if(normalizeZodiacalKey(params.zodiacal) !== normalizeZodiacalKey(expected.zodiacal)){
			return false;
		}
	}
	if(expected.hsys !== undefined && expected.hsys !== null){
		if(normalizeHouseSystemDisplay(params.hsys) !== normalizeHouseSystemDisplay(expected.hsys)){
			return false;
		}
	}
	if(expected.doubingSu28 !== undefined && expected.doubingSu28 !== null){
		const actual = parseInt(params.doubingSu28, 10);
		const target = parseInt(expected.doubingSu28, 10);
		if((Number.isNaN(actual) ? 0 : actual) !== (Number.isNaN(target) ? 0 : target)){
			return false;
		}
	}
	if(expected.birth){
		if(asString(params.birth) !== asString(expected.birth)){
			return false;
		}
	}
	return true;
}
