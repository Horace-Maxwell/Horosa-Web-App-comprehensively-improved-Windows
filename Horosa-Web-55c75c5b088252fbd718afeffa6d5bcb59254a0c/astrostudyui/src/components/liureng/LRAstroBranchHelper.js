import * as LRConst from './LRConst';
import { Su28, getSu28Sign } from '../su28/Su28Helper';
import * as AstroConst from '../../constants/AstroConst';

const SU28_SET = new Set(Su28 || []);

function safeText(v){
	return `${v === undefined || v === null ? '' : v}`.trim();
}

function extractBranchToken(token){
	const txt = safeText(token);
	for(let i = txt.length - 1; i >= 0; i--){
		const c = txt.substring(i, i + 1);
		if(LRConst.ZiList.indexOf(c) >= 0){
			return c;
		}
	}
	return '';
}

function normalizeSu28Name(value){
	const txt = safeText(value).replace(/\s/g, '').replace(/星宿/g, '').replace(/宿/g, '');
	if(!txt){
		return '';
	}
	if(SU28_SET.has(txt)){
		return txt;
	}
	for(let i=0; i<txt.length; i++){
		const c = txt.substring(i, i + 1);
		if(SU28_SET.has(c)){
			return c;
		}
	}
	return '';
}

function branchFromSu28(value){
	const su = normalizeSu28Name(value);
	if(!su){
		return '';
	}
	const sign = getSu28Sign(su);
	if(!sign){
		return '';
	}
	return safeText(LRConst.getSignZi(sign));
}

function resolveBranchFromObj(obj){
	if(!obj){
		return { branch: '', su28: '', source: '' };
	}

	const directBranch = extractBranchToken(
		obj.branch
		|| obj.zi
		|| obj.xiuBranch
		|| obj.sunBranch
		|| obj.moonBranch
		|| obj.sunXiuBranch
		|| obj.moonXiuBranch
	);
	if(directBranch){
		return { branch: directBranch, su28: normalizeSu28Name(obj.su28), source: 'explicit' };
	}

	const suCandidates = [obj.su28, obj.su, obj.xiu, obj.suName, obj.su28Name];
	for(let i=0; i<suCandidates.length; i++){
		const suVal = suCandidates[i];
		const suName = normalizeSu28Name(suVal);
		const suBranch = branchFromSu28(suVal);
		if(suBranch){
			return { branch: suBranch, su28: suName, source: 'su28' };
		}
	}

	return { branch: '', su28: normalizeSu28Name(obj.su28), source: '' };
}

function pickChart(chartLike){
	if(!chartLike){
		return null;
	}
	return chartLike.chart ? chartLike.chart : chartLike;
}

function findPlanetObj(chartLike, planetId){
	const chart = pickChart(chartLike);
	if(!chart || !Array.isArray(chart.objects)){
		return null;
	}
	for(let i=0; i<chart.objects.length; i++){
		const obj = chart.objects[i];
		if(obj && obj.id === planetId){
			return obj;
		}
	}
	return null;
}

function preferBranch(existingBranch, resolved){
	const current = extractBranchToken(existingBranch);
	const next = extractBranchToken(resolved && resolved.branch);
	if(!next){
		return current;
	}
	const source = resolved && resolved.source ? resolved.source : '';
	if(source === 'su28' || source === 'explicit'){
		return next;
	}
	return current || next;
}

function preferSu(existingSu, resolved){
	const current = safeText(existingSu);
	const next = safeText(resolved && resolved.su28);
	if(!next){
		return current;
	}
	return next;
}

export function extractSunMoonXiuBranchesFromChart(chartLike){
	const sunObj = findPlanetObj(chartLike, AstroConst.SUN);
	const moonObj = findPlanetObj(chartLike, AstroConst.MOON);
	const sunResolved = resolveBranchFromObj(sunObj);
	const moonResolved = resolveBranchFromObj(moonObj);
	return {
		sunBranch: extractBranchToken(sunResolved.branch),
		moonBranch: extractBranchToken(moonResolved.branch),
		sunSu: safeText(sunResolved.su28),
		moonSu: safeText(moonResolved.su28),
		sunSource: safeText(sunResolved.source),
		moonSource: safeText(moonResolved.source),
	};
}

export function mergeNongliSunMoonXiu(nongli, chartLike){
	const base = nongli || {};
	const extracted = extractSunMoonXiuBranchesFromChart(chartLike);
	const sunBranch = preferBranch(base.sunBranch || base.sunXiuBranch, {
		branch: extracted.sunBranch,
		source: extracted.sunSource,
	});
	const moonBranch = preferBranch(base.moonBranch || base.moonXiuBranch, {
		branch: extracted.moonBranch,
		source: extracted.moonSource,
	});
	const sunSu = preferSu(base.sunSu || base.sunXiu, { su28: extracted.sunSu });
	const moonSu = preferSu(base.moonSu || base.moonXiu, { su28: extracted.moonSu });
	return {
		...base,
		sunBranch,
		moonBranch,
		sunXiuBranch: sunBranch,
		moonXiuBranch: moonBranch,
		sunSu,
		moonSu,
	};
}

export function mergeLiurengSunMoonXiu(liureng, chartLike){
	const base = liureng || {};
	const mergedNongli = mergeNongliSunMoonXiu(base.nongli || {}, chartLike);
	return {
		...base,
		nongli: mergedNongli,
		sunBranch: mergedNongli.sunBranch || safeText(base.sunBranch || base.sunXiuBranch),
		moonBranch: mergedNongli.moonBranch || safeText(base.moonBranch || base.moonXiuBranch),
		sunXiuBranch: mergedNongli.sunXiuBranch || safeText(base.sunXiuBranch || base.sunBranch),
		moonXiuBranch: mergedNongli.moonXiuBranch || safeText(base.moonXiuBranch || base.moonBranch),
	};
}
