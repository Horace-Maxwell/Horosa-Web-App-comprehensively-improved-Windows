// 起课时刻的昼夜(定贵人昼夜、分昼夜)单一来源。
// 参照盘(/chart 底盘)与本次起课同一时刻地点 → 用参照盘的昼夜(星历地平判,与原先逐位相同);
// 参照盘是别的时刻的(主盘在途 / 取失败 / 择日宿主传下的是另一时刻的盘)→ 按起课时刻地点用本地日出方程算
// (与择日扫描判昼夜同一函数 isDiurnalLocal),绝不拿别的时刻的昼夜定这一课。认不出时刻地点 → null。
import { isDiurnalLocal } from '../divination/zeri/liurengLocal';
import { castChartFor } from './derivedChartSource';
import { zoneOffsetMinutesOf } from './zoneOffset';
import { geoStrToDegree } from './kentangCaseSave';

const valueOf = (f)=>(f && typeof f === 'object' && Object.prototype.hasOwnProperty.call(f, 'value') ? f.value : f);

function degreeOf(fields, gpsKey, strKey, axis){
	const g = Number(valueOf(fields[gpsKey]));
	if(valueOf(fields[gpsKey]) !== undefined && valueOf(fields[gpsKey]) !== null && valueOf(fields[gpsKey]) !== '' && Number.isFinite(g)){ return g; }
	const d = geoStrToDegree(`${valueOf(fields[strKey]) || ''}`, axis);
	return d === null ? NaN : d;
}

export function castIsDiurnal(chartWrap, castFields){
	const same = castChartFor(chartWrap, castFields);
	const chart = same ? (same.chart || same) : null;
	if(chart && chart.isDiurnal !== undefined && chart.isDiurnal !== null){
		return !!chart.isDiurnal;
	}
	const f = castFields;
	if(!f || !f.date || !f.time){ return null; }
	const d = valueOf(f.date);
	const t = valueOf(f.time);
	if(!d || typeof d.format !== 'function' || !t || typeof t.format !== 'function'){ return null; }
	const zm = zoneOffsetMinutesOf(`${valueOf(f.zone) === undefined || valueOf(f.zone) === null ? '' : valueOf(f.zone)}`.trim());
	if(zm === null){ return null; }
	return isDiurnalLocal(d.format('YYYY-MM-DD'), t.format('HH:mm:ss'), degreeOf(f, 'gpsLat', 'lat', 'lat'), degreeOf(f, 'gpsLon', 'lon', 'lon'), zm / 60);
}
