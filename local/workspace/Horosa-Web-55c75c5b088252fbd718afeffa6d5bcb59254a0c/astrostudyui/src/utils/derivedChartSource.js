// 派生盘「出自哪张盘」单一来源。
//
// 派生盘 = 由当前命盘另起、异步取回的盘(整宫制专盘、返照盘、推运盘、小限盘…),存进 state 后与当前命盘
// (this.props.value)一起画。换盘(列表载入、改生辰、点此刻)以后,新派生盘在途期间、或者取盘失败时,
// state 里仍是上一张盘的派生盘 —— 只比请求代次(seq)管得住「先发后回」,管不住这个:旧结果本来就是最后一次成功的。
// 规矩:派生盘连同它的来源键一起存(setState({ X: result, XSig: key })),读的时候经 pickKeyedDerived 与当前来源键比,
// 不一致就当没有(回退本命盘 / 不画派生圈)。合同:src/components/__tests__/derivedChartSourceGuard.test.js。
//
// 卜类同形:当前盘不是命主,是「起课参数」(起课时刻 + 地点)。起课参照盘(/chart 底盘:月将、昼夜、外圈星度、
// 底盘农历)与起课结果(农历、课、局、盘)都按起课签名 castSourceKey 配对:参照盘的签名对不上本次起课,就当参照盘
// 还没到(castChartFor → null),绝不拿上一课的底盘定这一课;上一课取到的农历同样不拿来顶这一课。
// 取失败时:失败那次与屏上那份是同一课(只改了设置)才留存,换了起课时刻 / 地点就清掉(castFailureKeeps)。
// 合同:src/components/__tests__/divinationCastSourceGuard.test.js。
import { dateKeyOfStr } from './dateStrSafe';
import { zoneOffsetMinutesOf } from './zoneOffset';

function birthDateTimeOf(p){
	const birth = `${p.birth || ''}`.trim();
	if(birth){
		const sp = birth.split(/\s+/);
		return [sp[0] || '', sp[1] || ''];
	}
	return [`${p.date || ''}`.trim(), `${p.time || ''}`.trim()];
}

/**
 * 命主来源键:出生日期 + 时刻 + 出生时区 + 出生经纬度(同一个人的同一张命盘)。
 * 入参可以是盘对象(读 .params)或起盘参数本身(派生请求里的本命段:date / time / zone / lon / lat)。
 * 不含宫制、黄道、古典口径等设置:同一位命主只改设置时派生盘照旧「旧盘留存 + 更新中」,换人才作废。
 * 认不出 → ''(空键与任何键都不相等,见 pickKeyedDerived)。
 */
export function natalSourceKey(src){
	if(!src || typeof src !== 'object'){ return ''; }
	const p = (src.params && typeof src.params === 'object') ? src.params : src;
	const [date, time] = birthDateTimeOf(p);
	if(!date){ return ''; }
	return [date, time, `${p.zone === undefined || p.zone === null ? '' : p.zone}`, `${p.lon === undefined || p.lon === null ? '' : p.lon}`, `${p.lat === undefined || p.lat === null ? '' : p.lat}`].join('|');
}

/**
 * 只认与当前来源一致的派生值:value 存在且 valueKey 非空、与 currentKey 相等 → value;否则 → fallback。
 */
export function pickKeyedDerived(value, valueKey, currentKey, fallback = null){
	if(value === undefined || value === null){ return fallback; }
	if(!valueKey || valueKey !== currentKey){ return fallback; }
	return value;
}

const fieldValueOf = (f)=>(f && typeof f === 'object' && Object.prototype.hasOwnProperty.call(f, 'value') ? f.value : f);
const isFieldsWrapper = (src)=>!!(src.date && typeof src.date === 'object' && Object.prototype.hasOwnProperty.call(src.date, 'value'));
const textOf = (v)=>`${v === undefined || v === null ? '' : v}`.trim();
function normTimeText(t){
	const s = textOf(t);
	return /^\d{1,2}:\d{2}$/.test(s) ? `${s}:00` : s;
}

/**
 * 起课签名:起课日期(带符号民用历日) + 时刻 + 时区(折成分钟) + 经纬度。
 * 认三种写法,同一时刻给同一个键:
 *   · fields 包装形 { date: { value: DateTime }, time, zone, lon, lat }(起课参数);
 *   · /chart 回包 { params: { birth: 'Y-M-D HH:mm:ss', zone, lon, lat, ad } }(参照盘);
 *   · 起盘参数本身 { date: 'YYYY/MM/DD', time, zone, lon, lat, ad }(ad = -1 且日期不带负号 → 公元前)。
 * 不含时间算法、日界、盘式等设置(那些改了是「同一课换口径」)。认不出 → ''(空键与任何键都不相等)。
 */
export function castSourceKey(src){
	return castSourceKeys(src)[0] || '';
}

// 同一起课参数的全部合法写法:fields 包装形里时区字段与日期自带的时区不一致时两种都认(主盘请求按日期自带的时区发,
// 择日宿主按时区字段发);第一项是规范键(时区字段优先)。
function castSourceKeys(src){
	if(!src || typeof src !== 'object'){ return []; }
	let date = '';
	let time = '';
	let zones = [];
	let p = src;
	if(isFieldsWrapper(src)){
		const d = src.date.value;
		const t = src.time ? fieldValueOf(src.time) : null;
		date = d && typeof d.format === 'function' ? d.format('YYYY-MM-DD') : textOf(d);
		time = t && typeof t.format === 'function' ? t.format('HH:mm:ss') : textOf(t);
		const zf = fieldValueOf(src.zone);
		zones = [zf === undefined || zf === null || zf === '' ? (d && d.zone) : zf, d && d.zone];
		p = { lon: fieldValueOf(src.lon), lat: fieldValueOf(src.lat) };
	}else{
		p = (src.params && typeof src.params === 'object') ? src.params : src;
		[date, time] = birthDateTimeOf(p);
		if(date && date[0] !== '-' && Number(p.ad) === -1){ date = `-${date}`; }
		zones = [p.zone];
	}
	const dk = dateKeyOfStr(date);
	if(!dk){ return []; }
	const zoneText = (z)=>{
		const zm = zoneOffsetMinutesOf(textOf(z));
		return zm === null ? textOf(z) : `${zm}`;
	};
	const out = [];
	zones.forEach((z)=>{
		if(z === undefined || z === null){ return; }
		const k = [dk, normTimeText(time), zoneText(z), textOf(p.lon), textOf(p.lat)].join('|');
		if(out.indexOf(k) < 0){ out.push(k); }
	});
	return out;
}

/** 起课参照盘:参照盘的起课签名与本次起课参数一致才用,否则 null(当作参照盘还没到)。 */
export function castChartFor(chartWrap, castFields){
	if(!chartWrap || typeof chartWrap !== 'object'){ return null; }
	const k = castSourceKey(chartWrap);
	return k && castSourceKeys(castFields).indexOf(k) >= 0 ? chartWrap : null;
}

/** 起课取失败:屏上那份的签名与失败那次相同(同一课只改了设置)→ true 留存;换了起课时刻 / 地点 → false 清掉。 */
export function castFailureKeeps(shownSig, failedSig){
	return !!shownSig && shownSig === failedSig;
}
