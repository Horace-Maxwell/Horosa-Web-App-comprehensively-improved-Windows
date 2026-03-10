import {
	appendPlanetMetaName,
	buildPlanetMetaSuffix,
	normalizePlanetMetaDisplay,
	DEFAULT_PLANET_META_DISPLAY,
} from './planetMetaDisplay';

function normalizeLegacyDisplay(enabled){
	if(enabled && typeof enabled === 'object'){
		const raw = {
			...enabled,
		};
		if(
			raw.showPostnatal === undefined
			&& (raw.showHouse !== undefined || raw.showRuler !== undefined)
		){
			raw.showPostnatal = 1;
		}
		return normalizePlanetMetaDisplay(raw);
	}
	if(enabled === 1 || enabled === true){
		return normalizePlanetMetaDisplay({
			showPostnatal: 1,
			showHouse: 1,
			showRuler: 1,
		});
	}
	return normalizePlanetMetaDisplay(DEFAULT_PLANET_META_DISPLAY);
}

function trimTrailingSuffix(label, suffix){
	const base = `${label || ''}`;
	if(!suffix){
		return base;
	}
	if(base.endsWith(suffix)){
		return base.slice(0, base.length - suffix.length);
	}
	return base;
}

export function appendPlanetHouseInfo(label, chartObj, enabled) {
	const display = normalizeLegacyDisplay(enabled);
	const id = chartObj && chartObj.id ? chartObj.id : null;
	const chartSources = id ? { objects: [chartObj] } : chartObj;
	return appendPlanetMetaName(label, id, chartSources, display);
}

export function appendPlanetHouseInfoById(label, chartObj, id, enabled) {
	const display = normalizeLegacyDisplay(enabled);
	return appendPlanetMetaName(label, id, chartObj, display);
}

export function splitPlanetHouseInfoText(text) {
	const src = `${text || ''}`;
	const matched = src.match(/\s*(\((?:\d{1,2}th)?(?:;\s*)?(?:\d{1,2}R+|\d{1,2}R(?:\d{1,2}R)*)?\))\s*$/);
	if(!matched || !matched[1]){
		return {
			label: src,
			info: '',
		};
	}
	const suffix = matched[1];
	return {
		label: trimTrailingSuffix(src, suffix).trim(),
		info: suffix.slice(1, -1).trim(),
	};
}

export function getPlanetHouseInfoSuffix(chartObj, id, enabled){
	const display = normalizeLegacyDisplay(enabled);
	return buildPlanetMetaSuffix(chartObj, id, display);
}
