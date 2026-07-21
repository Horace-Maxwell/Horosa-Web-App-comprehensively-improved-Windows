import { getStore } from './storageutil';

function getFieldValue(fields, key, fallback = ''){
	if(!fields || !fields[key]){
		return fallback;
	}
	const value = fields[key].value;
	return value === undefined || value === null ? fallback : value;
}

function getCaseDateTime(fields){
	const dateValue = getFieldValue(fields, 'date', null);
	const timeValue = getFieldValue(fields, 'time', null);
	if(dateValue && timeValue && dateValue.format && timeValue.format){
		return `${dateValue.format('YYYY-MM-DD')} ${timeValue.format('HH:mm:ss')}`;
	}
	return '';
}

export function openKentangCaseDrawer({ dispatch, fields, module, label, payload }){
	if(!dispatch || !module){
		return;
	}
	const divTime = getCaseDateTime(fields);
	// after23NewDay/lateZiHourUseNextDay/timeAlg 等"非字面坐标"参数必须随案例存档,
	// 否则下次打开会被全局默认覆盖,造成日柱/时柱算错。
	const after23NewDay = getFieldValue(fields, 'after23NewDay', null);
	const lateZiHourUseNextDay = getFieldValue(fields, 'lateZiHourUseNextDay', null);
	const guaAfter23NewDay = getFieldValue(fields, 'guaAfter23NewDay', null);
	const timeAlg = getFieldValue(fields, 'timeAlg', null);
	const extraFieldSnapshot = {};
	if(after23NewDay !== null && after23NewDay !== '') extraFieldSnapshot.after23NewDay = after23NewDay;
	if(lateZiHourUseNextDay !== null && lateZiHourUseNextDay !== '') extraFieldSnapshot.lateZiHourUseNextDay = lateZiHourUseNextDay;
	if(guaAfter23NewDay !== null && guaAfter23NewDay !== '') extraFieldSnapshot.guaAfter23NewDay = guaAfter23NewDay;
	if(timeAlg !== null && timeAlg !== '') extraFieldSnapshot.timeAlg = timeAlg;
	dispatch({
		type: 'astro/openDrawer',
		payload: {
			key: 'caseadd',
			record: {
				event: `${label || module}占断${divTime ? ` ${divTime}` : ''}`,
				caseType: module,
				divTime,
				zone: getFieldValue(fields, 'zone'),
				lat: getFieldValue(fields, 'lat'),
				lon: getFieldValue(fields, 'lon'),
				gpsLat: getFieldValue(fields, 'gpsLat'),
				gpsLon: getFieldValue(fields, 'gpsLon'),
				pos: getFieldValue(fields, 'pos'),
				// [X1] 性别随档(applyCase 读 record.gender 还原;无则 null → 载入跳过不改现状)。
				gender: getFieldValue(fields, 'gender', null),
				payload: {
					module,
					version: 1,
					savedAt: new Date().toISOString(),
					fieldSnapshot: extraFieldSnapshot,
					...(payload || {}),
				},
				sourceModule: module,
			},
		},
	});
}

export function parseKentangCasePayload(raw){
	if(!raw){
		return null;
	}
	if(typeof raw === 'string'){
		try{
			return JSON.parse(raw);
		}catch(e){
			return null;
		}
	}
	if(typeof raw === 'object'){
		return raw;
	}
	return null;
}

export function getKentangSavedCasePayload(module){
	const store = getStore();
	const userState = store && store.user ? store.user : null;
	const currentCase = userState && userState.currentCase ? userState.currentCase : null;
	if(!currentCase || !currentCase.cid || !currentCase.cid.value){
		return null;
	}
	const sourceModule = currentCase.sourceModule ? currentCase.sourceModule.value : null;
	const caseType = currentCase.caseType ? currentCase.caseType.value : null;
	const payload = parseKentangCasePayload(currentCase.payload ? currentCase.payload.value : null);
	const payloadModule = payload && payload.module ? payload.module : null;
	if(sourceModule !== module && caseType !== module && payloadModule !== module){
		return null;
	}
	const cid = `${currentCase.cid.value}`;
	const updateTime = currentCase.updateTime && currentCase.updateTime.value ? `${currentCase.updateTime.value}` : '';
	return {
		payload,
		caseVersion: `${module}|${cid}|${updateTime}`,
	};
}
