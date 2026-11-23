// 节气页 字段 ↔ 起盘参数 ↔ state 映射、古典口径键与签名
// 从 JieQiChartsMain.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import DateTime from '../../comp/DateTime';
import * as SZConst from '../../suzhan/SZConst';
import { CLASSICAL_PARAM_SPEC, CLASSICAL_SPEC_KEYS } from '../../../utils/classicalParamSpec';   // 古典口径全键单源
import { CHART_ORB_KEYS, classicalBackendOverridesFromPlain, chartOrbOverridesFromPlain } from '../../../utils/classicalChartGlobals';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../../utils/dayBoundary';
import { fetchPreciseJieqiYear } from '../../../utils/preciseCalcBridge';

export function paramsToFields(params, flds){
	let tm = new DateTime();
	tm.setZone(params.zone);
	const toInt = (val, defval)=>{
		const parsed = parseInt(val, 10);
		return Number.isNaN(parsed) ? defval : parsed;
	};
	const pickValue = (key, defval)=>{
		if(params[key] !== undefined && params[key] !== null){
			return params[key];
		}
		if(flds && flds[key] && flds[key].value !== undefined && flds[key].value !== null){
			return flds[key].value;
		}
		return defval;
	};
	const pickPreferFields = (key, defval)=>{
		if(flds && flds[key] && flds[key].value !== undefined && flds[key].value !== null){
			return flds[key].value;
		}
		if(params[key] !== undefined && params[key] !== null){
			return params[key];
		}
		return defval;
	};
	const doubingSu28Val = pickPreferFields('doubingSu28', 0);
	// 子盘 params 带 birth(交节时刻 'YYYY-MM-DD HH:mm:ss',loadJieqiChart 并入)→ 起盘时间按交节时刻;
	// 此前恒 tm.parse(year,'YYYY')=当年 1 月 1 日 12:00 → 宿盘左栏时空面板 / 右栏概览 / 快照 [起盘信息] 都写错时刻。
	// 无 birth(种子参数)仍按年初(零回归)。
	if(typeof params.birth === 'string' && params.birth.trim()){
		tm.parse(params.birth.trim());
		if(params.ad === -1 || params.ad === '-1'){ tm.ad = -1; }
	}else{
		tm.parse(params.year, 'YYYY');
	}
	// 宿法档 2–8(七政页写入全局)不得被夹成 0/1:state 原样发后端(盘按该档算),显示层须同档,否则下拉与
	// 「宿法」行显示「现实距星法」而盘不是。
	const dbs = (doubingSu28Val === true) ? 1 : toInt(doubingSu28Val, 0);
	const fields = {
		date: {
			value: tm,
		},
		time: {
			value: tm,
		},
		ad: {
			value: tm.ad,
		},
		zone: {
			value: tm.zone,
		},
		lat: {
			value: params.lat,
		},
		lon: {
			value: params.lon,
		},
		gpsLat: {
			value: params.gpsLat,
		},
		gpsLon: {
			value: params.gpsLon,
		},
		name: {
			value: params.name ? params.name : null,
		},
		pos: {
			value: params.pos ? params.pos : null,
		},
		hsys: {
			value: params.hsys,
		},
		zodiacal: {
			value: params.zodiacal,
		},
		siderealAyanamsa: {
			value: params.siderealAyanamsa,
		},
		doubingSu28: {
			value: dbs >= 0 && dbs <= 8 ? dbs : 0,
		},
		houseStartMode: {
			value: toInt(pickPreferFields('houseStartMode', SZConst.SZHouseStart_Bazi), SZConst.SZHouseStart_Bazi) === SZConst.SZHouseStart_ASC
				? SZConst.SZHouseStart_ASC : SZConst.SZHouseStart_Bazi,
		},
		szchart: {
			value: toInt(pickPreferFields('szchart', SZConst.SZChart.chart), SZConst.SZChart.chart),
		},
		szshape: {
			value: toInt(pickPreferFields('szshape', SZConst.SZChart.shape), SZConst.SZChart.shape),
		},
		tradition: {
			value: 0,
		},
		strongRecption: {
			value: 0,
		},
		simpleAsp: {
			value: 0,
		},
		virtualPointReceiveAsp: {
			value: 0,
		},
		predictive: {
			value: 0,
		},
		pdtype: {
			value: 0,
		},
		pdaspects: {
			value: [0, 60, 90, 120, 180],
		},
		gender: {
			value: toInt(pickPreferFields('gender', 1), 1),
		},

	};

	if(params.year === undefined || params.year === null){
		if(params.birth){
			let bir = new DateTime();
			bir.parse(params.birth, 'YYYY-MM-DD HH:mm:ss');
			fields.date.value = bir;
			fields.time.value = bir;
		}	
	}
	if(params.zodiacal === 'Tropical'){
		fields.zodiacal.value = 0;
	}
	if(params.zodiacal === 'Sidereal'){
		fields.zodiacal.value = 1;
	}

	if(flds){
		if(params.gpsLat === undefined || params.gpsLat === null){
			fields.gpsLat = flds.gpsLat;
		}
		if(params.gpsLon === undefined || params.gpsLon === null){
			fields.gpsLon = flds.gpsLon;
		}
	}
	// 古典口径全键(spec 单源)随 params(前端名 / 后端名双轨)或既有 fields 进 fields:
	// 此前一键不带 → 子盘 fields 缺古典键,AI 快照「口径自陈」行恒空。缺值不造键(缺省用户 fields 形状不变)。
	CLASSICAL_PARAM_SPEC.forEach((s)=>{
		const bk = s.backendKey || s.key;
		let v = params[s.key];
		if(v === undefined || v === null){ v = params[bk]; }
		if((v === undefined || v === null) && flds && flds[s.key] && flds[s.key].value !== undefined && flds[s.key].value !== null){ v = flds[s.key].value; }
		if(v !== undefined && v !== null && v !== ''){ fields[s.key] = { value: v }; }
	});
	['userAyanT0', 'userAyanDeg', 'customTermsDay', 'customTermsNight'].forEach((k)=>{
		const v = pickValue(k, undefined);
		if(v !== undefined && v !== null && v !== ''){ fields[k] = { value: v }; }
	});
	return fields;
}

// 出生时空签名(全局 hook 用):只有它变了才允许 hook 覆盖本页年份/时区/地点。
export function hookBirthSig(f){
	try{
		const d = f && f.date && f.date.value;
		const v = (k)=>(f && f[k] ? f[k].value : undefined);
		return [d && d.format ? d.format('YYYY/MM/DD HH:mm:ss') : `${d}`, v('ad'), v('zone'), v('lat'), v('lon'), v('gpsLat'), v('gpsLon')].join('|');
	}catch(e){ return `err:${Date.now()}:${Math.random()}`; }
}

export function fieldsToState(fields){
	let st = {
		time: fields.date.value,
		ad: fields.ad.value,
		zone: fields.zone.value,
		lat: fields.lat.value,
		lon: fields.lon.value,
		hsys: fields.hsys.value,
		zodiacal: fields.zodiacal.value, siderealAyanamsa: fields.siderealAyanamsa ? fields.siderealAyanamsa.value : '',
		gpsLat: fields.gpsLat.value,
		gpsLon: fields.gpsLon.value,
		doubingSu28: fields.doubingSu28.value,
		// 古典占星参数随分至盘透传(节气盘=标准星盘,须与主盘 fieldsToParams 同口径)。
		// 键集改由 CLASSICAL_PARAM_SPEC 单源生成(全部古典键 + 自定义界表体 + 'user' 历元键):
		// 此前手写 16 键,其余(尊贵计分/时主算法/交点尊贵/福点变体/容许度体系/相位纳入宫头…)恒走后端缺省,
		// 非缺省全局口径用户的分至盘与主盘系统性分叉。
		...classicalStateFromFields(fields),
		fields: {
			...fields
		},
	};
	return st;
}

// fields(wrapper 形) → state 平面键:spec 全键 + 自定义界表体 + 'user' 档历元(缺=''，与旧手写形态同)。
const CLASSICAL_STATE_KEYS = [...CLASSICAL_SPEC_KEYS, 'customTermsDay', 'customTermsNight', 'userAyanT0', 'userAyanDeg', ...CHART_ORB_KEYS];

function classicalStateFromFields(fields){
	const out = {};
	CLASSICAL_STATE_KEYS.forEach((k)=>{
		out[k] = fields && fields[k] && fields[k].value !== undefined && fields[k].value !== null ? fields[k].value : '';
	});
	return out;
}

// 缓存键 / 兼容判定共用的古典口径签名:按 spec 归一(仅非默认键,后端名)+ 'user' 历元 → 稳定 JSON。
// 缺省用户恒 '{}'(旧键串仅多一段常量,内存缓存键无持久化)。
export function classicalCalibreSig(params){
	const p = params || {};
	const ov = classicalBackendOverridesFromPlain(p);
	// 随盘容许度也进签名:改了容许度,四季盘的缓存键 / 兼容判定要跟着变(默认态不产键,签名不变)
	Object.assign(ov, chartOrbOverridesFromPlain(p));
	if(`${p.siderealAyanamsa}` === 'user'){
		if(p.userAyanT0 !== undefined && p.userAyanT0 !== null && p.userAyanT0 !== ''){ ov.userAyanT0 = p.userAyanT0; }
		if(p.userAyanDeg !== undefined && p.userAyanDeg !== null && p.userAyanDeg !== ''){ ov.userAyanDeg = p.userAyanDeg; }
	}
	return JSON.stringify(Object.keys(ov).sort().reduce((acc, k)=>{ acc[k] = ov[k]; return acc; }, {}));
}

// PERF-R9 Ship 7(数据层空闲预热):分至图的 /jieqi/year 年表。
// 构参与组件 genSeedParams(=genParams(false))【逐字段同序同值】—— 经 fieldsToState 拿到
// 与组件挂载后完全相同的取数口径,再走 fetchPreciseJieqiYear(技法自己的 L1/localStorage/
// inflight 三层入口)⇒ 用户首点分至页即命中。
// ⚠️ 本条是【重端点】,故在预热组里排最后一位(前面的轻端点先付,交互随时让路)。
// silent(fetchPreciseJieqiYear 内置)、丢结果、绝不 dispatch/setState;失败静默。
export async function warmJieqiYear(fields){
	try{
		if(!fields || !fields.date || !fields.date.value || !fields.date.value.format){
			return null;
		}
		const st = fieldsToState(fields);
		if(!st || !st.time || typeof st.time.format !== 'function'){
			return null;
		}
		return await fetchPreciseJieqiYear({
			year: st.time.format('YYYY'),
			ad: st.ad,
			zone: st.zone,
			lon: st.lon,
			lat: st.lat,
			hsys: st.hsys,
			zodiacal: st.zodiacal,
			siderealAyanamsa: st.siderealAyanamsa,
			gpsLat: st.gpsLat,
			gpsLon: st.gpsLon,
			doubingSu28: st.doubingSu28,
			after23NewDay: defaultAfter23NewDay(),
			lateZiHourUseNextDay: defaultLateZiHourUseNextDay(),
		});
	}catch(e){
		return null;   // 预热失败静默:首点回到冷即付的现状
	}
}
