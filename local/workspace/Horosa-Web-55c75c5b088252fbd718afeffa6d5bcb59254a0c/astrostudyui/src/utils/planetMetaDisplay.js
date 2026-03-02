import { getStore, } from './storageutil';

export const DEFAULT_PLANET_META_DISPLAY = {
	showPostnatal: 0,
	showHouse: 1,
	showRuler: 1,
};

function flag(val, defVal){
	if(val === undefined || val === null){
		return defVal ? 1 : 0;
	}
	if(val === true || val === 1 || val === '1'){
		return 1;
	}
	return 0;
}

export function normalizePlanetMetaDisplay(raw){
	const src = raw && typeof raw === 'object' ? raw : {};
	return {
		showPostnatal: flag(src.showPostnatal, DEFAULT_PLANET_META_DISPLAY.showPostnatal),
		showHouse: flag(src.showHouse, DEFAULT_PLANET_META_DISPLAY.showHouse),
		showRuler: flag(src.showRuler, DEFAULT_PLANET_META_DISPLAY.showRuler),
	};
}

export function readPlanetMetaDisplayFromStore(){
	const store = getStore();
	const app = store && store.app ? store.app : {};
	return normalizePlanetMetaDisplay(app.planetMetaDisplay);
}

export function houseIdToNumber(houseId){
	if(houseId === undefined || houseId === null){
		return null;
	}
	const matched = `${houseId}`.match(/House\s*(\d+)/i);
	if(!matched || !matched[1]){
		return null;
	}
	const num = parseInt(matched[1], 10);
	if(Number.isNaN(num) || num <= 0){
		return null;
	}
	return num;
}

function formatHouseOrdinal(num){
	return `${num}th`;
}

function formatRulerHouses(ruleHouses){
	if(!Array.isArray(ruleHouses) || ruleHouses.length === 0){
		return '';
	}
	const nums = ruleHouses.map((id)=>houseIdToNumber(id)).filter((n)=>n !== null);
	if(nums.length === 0){
		return '';
	}
	return nums.map((n)=>`${n}R`).join('');
}

function pushObjects(out, source){
	const chart = source && source.chart ? source.chart : null;
	const chartLike = chart || source;

	if(chartLike && Array.isArray(chartLike.objects)){
		for(let i=0; i<chartLike.objects.length; i++){
			const obj = chartLike.objects[i];
			if(obj && obj.id){
				out.push(obj);
			}
		}
	}
	if(source && Array.isArray(source.lots)){
		for(let i=0; i<source.lots.length; i++){
			const obj = source.lots[i];
			if(obj && obj.id){
				out.push(obj);
			}
		}
	}
	if(chart && Array.isArray(chart.lots)){
		for(let i=0; i<chart.lots.length; i++){
			const obj = chart.lots[i];
			if(obj && obj.id){
				out.push(obj);
			}
		}
	}
}

function collectObjectsFromSource(source, out, seen){
	if(!source || typeof source !== 'object'){
		return;
	}
	if(seen.has(source)){
		return;
	}
	seen.add(source);

	pushObjects(out, source);

	const nestedKeys = [
		'natualChart', 'natalChart', 'dirChart',
		'natual', 'natal', 'dir',
		'inner', 'outer',
		'value', 'chartObj', 'result',
	];
	for(let i=0; i<nestedKeys.length; i++){
		const key = nestedKeys[i];
		collectObjectsFromSource(source[key], out, seen);
	}
}

export function findPlanetMetaObject(chartSources, id){
	if(id === undefined || id === null){
		return null;
	}
	const sources = Array.isArray(chartSources) ? chartSources : [chartSources];
	for(let i=0; i<sources.length; i++){
		const out = [];
		collectObjectsFromSource(sources[i], out, new Set());
		for(let j=0; j<out.length; j++){
			if(out[j] && out[j].id === id){
				return out[j];
			}
		}
	}
	return null;
}

export function buildPlanetMetaSuffix(chartSources, id, displayOptions){
	const display = normalizePlanetMetaDisplay(displayOptions || readPlanetMetaDisplayFromStore());
	if(display.showPostnatal !== 1){
		return '';
	}
	if(display.showHouse !== 1 && display.showRuler !== 1){
		return '';
	}

	const obj = findPlanetMetaObject(chartSources, id);
	if(!obj){
		return '';
	}

	const parts = [];
	if(display.showHouse === 1){
		const houseNum = houseIdToNumber(obj.house);
		if(houseNum !== null){
			parts.push(formatHouseOrdinal(houseNum));
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

export function appendPlanetMetaName(name, id, chartSources, displayOptions){
	const base = name === undefined || name === null ? '' : `${name}`;
	return `${base}${buildPlanetMetaSuffix(chartSources, id, displayOptions)}`;
}

export function filterPlanetMetaSuffix(text, displayOptions){
	const cfg = normalizePlanetMetaDisplay(displayOptions || DEFAULT_PLANET_META_DISPLAY);
	const src = `${text || ''}`;
	if(!src){
		return src;
	}
	if(cfg.showPostnatal !== 1){
		return src.replace(/\s*\((\d{1,2}th)?(?:;\s*)?((?:\d{1,2}R)+)?\)/g, '').replace(/[ ]{2,}/g, ' ');
	}
	if(cfg.showHouse === 1 && cfg.showRuler === 1){
		return src;
	}

	const replaced = src.replace(/\s*\((\d{1,2}th)?(?:;\s*)?((?:\d{1,2}R)+)?\)/g, (m, housePart, rulerPart)=>{
		const house = `${housePart || ''}`.trim();
		const ruler = `${rulerPart || ''}`.trim();
		const out = [];
		if(cfg.showHouse === 1 && house){
			out.push(house);
		}
		if(cfg.showRuler === 1 && ruler){
			out.push(ruler);
		}
		if(out.length === 0){
			return '';
		}
		if(out.length === 2){
			return ` (${out[0]}; ${out[1]})`;
		}
		return ` (${out[0]})`;
	});

	return replaced.replace(/[ ]{2,}/g, ' ');
}
