import { matchesAstroChartParams } from '../../utils/astroParamDisplay';

function findJieqiRow(rows, title){
	if(!Array.isArray(rows) || !title){
		return null;
	}
	for(let i = 0; i < rows.length; i += 1){
		const row = rows[i];
		if(row && row.jieqi === title){
			return row;
		}
	}
	return null;
}

export function getJieqiChartBirth(result, title){
	const row = findJieqiRow(result && result.jieqi24, title);
	if(row && row.time){
		return row.time;
	}
	const chart = result && result.charts ? result.charts[title] : null;
	return chart && chart.params && chart.params.birth ? chart.params.birth : '';
}

export function getReusableJieqiChart(result, title, params){
	if(!result || !result.charts || !title){
		return null;
	}
	const chart = result.charts[title];
	if(!chart){
		return null;
	}
	const expectedBirth = getJieqiChartBirth(result, title);
	const isMatch = matchesAstroChartParams(chart, {
		hsys: params && params.hsys,
		zodiacal: params && params.zodiacal,
		doubingSu28: params && params.doubingSu28,
		birth: expectedBirth || undefined,
	});
	return isMatch ? chart : null;
}
