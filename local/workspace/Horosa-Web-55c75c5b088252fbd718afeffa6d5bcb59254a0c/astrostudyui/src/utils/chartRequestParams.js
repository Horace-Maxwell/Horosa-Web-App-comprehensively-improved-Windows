function getFieldValue(fields, key, fallback = null){
	if(!fields || !Object.prototype.hasOwnProperty.call(fields, key)){
		return fallback;
	}
	const field = fields[key];
	if(field && Object.prototype.hasOwnProperty.call(field, 'value')){
		return field.value;
	}
	return field === undefined ? fallback : field;
}

function normalizePdAspects(value){
	if(typeof value === 'string'){
		try{
			return JSON.parse(value);
		}catch(e){
			return value;
		}
	}
	return value;
}

export function buildChartParamsFromFields(fields, options = {}){
	const includePredictive = options.includePredictive === true;
	const dateValue = getFieldValue(fields, 'date');
	const timeValue = getFieldValue(fields, 'time', dateValue);
	const params = {
		cid: getFieldValue(fields, 'cid'),
		ad: dateValue && dateValue.ad !== undefined ? dateValue.ad : getFieldValue(fields, 'ad', 1),
		date: dateValue && dateValue.format ? dateValue.format('YYYY/MM/DD') : '',
		time: timeValue && timeValue.format ? timeValue.format('HH:mm:ss') : '',
		zone: dateValue && dateValue.zone !== undefined ? dateValue.zone : getFieldValue(fields, 'zone'),
		lat: getFieldValue(fields, 'lat'),
		lon: getFieldValue(fields, 'lon'),
		gpsLat: getFieldValue(fields, 'gpsLat'),
		gpsLon: getFieldValue(fields, 'gpsLon'),
		hsys: getFieldValue(fields, 'hsys', 0),
		southchart: getFieldValue(fields, 'southchart', 0),
		zodiacal: getFieldValue(fields, 'zodiacal', 0),
		tradition: getFieldValue(fields, 'tradition', 0),
		doubingSu28: getFieldValue(fields, 'doubingSu28', 0),
		strongRecption: getFieldValue(fields, 'strongRecption', 0),
		simpleAsp: getFieldValue(fields, 'simpleAsp', 0),
		virtualPointReceiveAsp: getFieldValue(fields, 'virtualPointReceiveAsp', 0),
		houseStartMode: getFieldValue(fields, 'houseStartMode', 0),
		timeAlg: getFieldValue(fields, 'timeAlg', 0),
		phaseType: getFieldValue(fields, 'phaseType', 0),
		godKeyPos: getFieldValue(fields, 'godKeyPos', '年'),
		after23NewDay: getFieldValue(fields, 'after23NewDay', 0),
		adjustJieqi: getFieldValue(fields, 'adjustJieqi', 0),
		gender: getFieldValue(fields, 'gender', 1),
		name: getFieldValue(fields, 'name'),
		pos: getFieldValue(fields, 'pos'),
		group: getFieldValue(fields, 'group'),
	};

	if(includePredictive){
		params.predictive = getFieldValue(fields, 'predictive', 1);
		params.showPdBounds = getFieldValue(fields, 'showPdBounds', 1);
		params.pdtype = getFieldValue(fields, 'pdtype', 0);
		params.pdMethod = getFieldValue(fields, 'pdMethod', 'astroapp_alchabitius');
		params.pdTimeKey = getFieldValue(fields, 'pdTimeKey', 'Ptolemy');
		params.pdaspects = normalizePdAspects(getFieldValue(fields, 'pdaspects', [0, 60, 90, 120, 180]));
	}

	return params;
}

export function buildBaseChartParamsFromFields(fields){
	return buildChartParamsFromFields(fields, {
		includePredictive: false,
	});
}
