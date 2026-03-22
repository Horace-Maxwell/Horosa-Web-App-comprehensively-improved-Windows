import {
	findPlanetMetaObject,
	houseIdToNumber,
	normalizePlanetMetaDisplay,
	readPlanetMetaDisplayFromStore,
} from './planetMetaDisplay';

function flag(val){
	return val === true || val === 1 || val === '1';
}

function normalizeLegacyDisplay(enabled){
	if(enabled === undefined || enabled === null || enabled === false || enabled === 0 || enabled === '0'){
		return {
			showPostnatal: 0,
			showHouse: 0,
			showRuler: 0,
		};
	}

	const storeDisplay = readPlanetMetaDisplayFromStore();
	if(flag(enabled)){
		return normalizePlanetMetaDisplay({
			...storeDisplay,
			showPostnatal: 1,
		});
	}

	if(typeof enabled === 'object'){
		const src = enabled || {};
		const next = {
			...storeDisplay,
			...src,
		};
		if(!Object.prototype.hasOwnProperty.call(src, 'showPostnatal')
			&& (flag(src.showHouse) || flag(src.showRuler))){
			next.showPostnatal = 1;
		}
		return normalizePlanetMetaDisplay(next);
	}

	return normalizePlanetMetaDisplay({
		...storeDisplay,
		showPostnatal: 1,
	});
}

function formatRulerHouses(ruleHouses){
	if(!Array.isArray(ruleHouses) || ruleHouses.length === 0){
		return '';
	}
	const nums = ruleHouses
		.map((id)=>houseIdToNumber(id))
		.filter((num)=>num !== null);
	if(nums.length === 0){
		return '';
	}
	return nums.map((num)=>`${num}R`).join('');
}

function buildPlanetMetaSuffixFromObject(obj, display){
	if(!obj || display.showPostnatal !== 1){
		return '';
	}
	const parts = [];
	if(display.showHouse === 1){
		const houseNum = houseIdToNumber(obj.house);
		if(houseNum !== null){
			parts.push(`${houseNum}th`);
		}
	}
	if(display.showRuler === 1){
		const rulerTxt = formatRulerHouses(obj.ruleHouses);
		if(rulerTxt){
			parts.push(rulerTxt);
		}
	}
	if(parts.length === 0){
		return '';
	}
	if(parts.length === 2){
		return ` (${parts[0]}; ${parts[1]})`;
	}
	return ` (${parts[0]})`;
}

export function appendPlanetHouseInfo(label, obj, enabled) {
	const display = normalizeLegacyDisplay(enabled);
	if(display.showPostnatal !== 1){
		return `${label || ''}`;
	}
	return `${label || ''}${buildPlanetMetaSuffixFromObject(obj, display)}`;
}

export function appendPlanetHouseInfoById(label, chartObj, id, enabled) {
	const display = normalizeLegacyDisplay(enabled);
	if(display.showPostnatal !== 1){
		return `${label || ''}`;
	}
	const obj = findPlanetMetaObject(chartObj, id);
	return `${label || ''}${buildPlanetMetaSuffixFromObject(obj, display)}`;
}

export function splitPlanetHouseInfoText(text) {
	const src = `${text || ''}`.trim();
	if(!src){
		return {
			label: '',
			info: '',
		};
	}
	const matched = src.match(/^(.*?)(?:\s*\(([^()]*)\))$/);
	if(!matched){
		return {
			label: src,
			info: '',
		};
	}
	return {
		label: `${matched[1] || ''}`.trimEnd(),
		info: `${matched[2] || ''}`.trim(),
	};
}
