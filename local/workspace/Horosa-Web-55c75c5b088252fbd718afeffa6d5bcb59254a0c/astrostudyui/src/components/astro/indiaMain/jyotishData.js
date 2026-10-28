// 印占页 · 排盘数据:Jyotish 载荷读取、日期 / 时长格式、参数键、字段克隆、可用盘判定、选项值转字段补丁。
// 只被 components/astro/IndiaChartMain.js 与同目录 indiaMain/ 下的兄弟模块引用。
import * as AstroConst from '../../../constants/AstroConst';
import { pickKeyedDerived } from '../../../utils/derivedChartSource';
import { DASHA_SEED_DEFAULT } from './optionState';
import { currentDashaYearDays, momentFromFieldValue, dashaMoment, flatlibCalendarFields } from './dasha';

// 庙旺态(引擎枚举 → 中文)单一来源:页面「Graha 状态 / 分盘吉位」与 AI 快照「星曜状态 / 分盘吉位」同读这一张表。
export const INDIA_DIGNITY_CN = Object.freeze({ deep_exaltation: '深旺', exaltation: '入旺', moolatrikona: '自旺MT', own_sign: '入庙', debilitation: '入弱', neutral: '平' });
export function indiaDignityLabel(dignity){
	if(dignity === undefined || dignity === null || dignity === ''){ return ''; }
	return INDIA_DIGNITY_CN[dignity] || `${dignity}`;
}

// Tajika 年主取用途径(引擎枚举 → 中文)单一来源:页面年盘「取用」行与 AI 快照「Tajika 年主」同读这一张表。
export const TAJIKA_YEAR_LORD_VIA_CN = Object.freeze({
	benefic_aspect: '吉相照年上升',
	malefic_aspect: '凶相照年上升',
	strong_no_aspect: '无相照·取力极强者',
	first_candidate_fallback: '无相照无强者·取首候选',
});
export function tajikaYearLordViaLabel(via){
	if(via === undefined || via === null || via === ''){ return ''; }
	return TAJIKA_YEAR_LORD_VIA_CN[via] || `${via}`;
}

export function getJyotish(chartObj){
	return chartObj && chartObj.jyotish ? chartObj.jyotish : null;
}

// 引擎子块失败的落账名(jyotish.partialErrors)→ 中文段名:页面提示与 AI 快照「未能计算」段共用这一张。
// 子块内部落账名带点(kp.deep / muhurta.panchaka …);整块失败时是块键本身(kp / muhurta / dasha …)。没登记的名字原样写出(不吞)。
export const INDIA_PARTIAL_LABELS = Object.freeze({
	'kp.deep': 'KP 深化(六级细分 / 宫头次主星 / 当令星 / 意义者)',
	'muhurta.panchaka': 'Panchaka 五忌',
	'muhurta.birthMuhurta': '出生须臾',
	dashaSeed: '大运所选起点(已按月亮起运)',
	dashaCondition: '大运条件上下文(依赖它的体系按不适用处理)',
	'dashaCondition.weekday': '大运条件·吠陀日',
	'dashaCondition.vargaLagna': '大运条件·D12 / Hora 上升',
	'ayurdaya.neechaHalf': '寿命·落陷减半',
	kp: 'KP 全段',
	muhurta: 'Muhurta 全段',
	prasna: '问时全段',
	dasha: '大运全段',
	rasiDasha: '星座大运',
	extendedDashas: '扩展大运',
	ayurdaya: '寿命基础',
	ayurdayaFinal: '寿命判读',
});

export function jyotishPartialErrorLabel(name){
	const key = `${name}`;
	if(INDIA_PARTIAL_LABELS[key]){ return INDIA_PARTIAL_LABELS[key]; }
	if(key.indexOf('dasha.') === 0){ return `大运·${key.slice(6)}`; }
	return key;
}

export function jyotishPartialErrors(jyotish){
	return jyotish && Array.isArray(jyotish.partialErrors) ? jyotish.partialErrors.map((n)=>`${n}`) : [];
}

// 页面一行提示:filter(名字) 选出本面板相关的落账名;没有 → ''。
export function jyotishPartialNotice(jyotish, filter){
	const names = jyotishPartialErrors(jyotish).filter((n)=>(typeof filter === 'function' ? filter(n) : true));
	return names.length ? `本次未能计算:${names.map(jyotishPartialErrorLabel).join('、')}` : '';
}

// 各面板认领哪些落账名(大运面板:大运 / 条件 / 起点 / 寿命;KP·Muhurta 面板:KP / Muhurta / 问时)。
export const isDashaPartialName = (n)=>/^(dasha|rasiDasha|extendedDashas|ayurdaya)/.test(n);
export const isKpMuhurtaPartialName = (n)=>/^(kp|muhurta|prasna)(\.|$)/.test(n);

export function hasYogaPayload(chartObj){
	return !!(chartObj && chartObj.jyotish && chartObj.jyotish.yogas !== undefined);
}

export function hasJyotishPayload(chartObj){
	return !!(chartObj && chartObj.jyotish);
}

// 日期显示:moment 视为真时刻,1582-10-15 以前按儒略历标注(与后端标签 / 起盘历法同口径);
// 字符串视为后端标签,经 dashaMoment 解释后同路格式化(标签原样回出,不双重换算)。
function _pad(n, w){ return `${Math.abs(n)}`.padStart(w, '0'); }
function _asInstant(value){
	if(!value){ return null; }
	if(value.format){ return value.isValid && !value.isValid() ? null : value; }
	return dashaMoment(null, value);
}
export function formatJyotishDate(value){
	if(!value){
		return '—';
	}
	const m = _asInstant(value);
	if(!m){ return `${value}`; }
	const f = flatlibCalendarFields(m);
	return `${f.year < 0 ? '-' : ''}${_pad(f.year, 4)}-${_pad(f.month, 2)}-${_pad(f.day, 2)}`;
}

// 微运/息运 极短(时/分级),仅按日期会出现多段同日 → 精确到 时:分。
export function formatJyotishDateTime(value){
	if(!value){
		return '—';
	}
	const m = _asInstant(value);
	if(!m){ return `${value}`; }
	return `${formatJyotishDate(m)} ${m.format('HH:mm')}`;
}

// 短运段(年→0月无意义)的细粒度时长:天/时/分。
export function formatDurationFine(years){
	const totalMs = Math.max(0, Number(years) || 0) * currentDashaYearDays() * 24 * 60 * 60 * 1000;
	const days = totalMs / 86400000;
	if(days >= 1){
		const d = Math.floor(days);
		const hrs = Math.round((days - d) * 24);
		return hrs ? `${d}天${hrs}时` : `${d}天`;
	}
	const hours = totalMs / 3600000;
	if(hours >= 1){
		const h = Math.floor(hours);
		const m = Math.round((hours - h) * 60);
		return m ? `${h}时${m}分` : `${h}时`;
	}
	const mins = Math.max(1, Math.round(totalMs / 60000));
	return `${mins}分`;
}

// WP-B 用宫号(从 asc)反查其星座 → 再按参照重数(供 Bhava Bala 标题最强/最弱宫)。
export function dispHouseByNum(houses, houseNum, dispHouse){
	const b = Array.isArray(houses) ? houses.find((x)=>x.house === houseNum) : null;
	return b ? dispHouse(b.sign, b.house) : houseNum;
}

export function formatDegree(value){
	const num = Number(value);
	if(!Number.isFinite(num)){
		return '—';
	}
	const deg = Math.floor(num);
	const min = Math.floor((num - deg) * 60);
	return `${deg}°${`${min}`.padStart(2, '0')}′`;
}

export function getJyotishPlanetStates(jyotish){
	return jyotish && jyotish.strengths && Array.isArray(jyotish.strengths.planetaryStates)
		? jyotish.strengths.planetaryStates
		: [];
}

export function getJyotishDasha(chartObj){
	return chartObj && chartObj.jyotish && chartObj.jyotish.dasha ? chartObj.jyotish.dasha.vimshottari : null;
}

function normalizeChartDateKey(value){
	return `${value || ''}`.replace(/\//g, '-');
}

export function buildJyotishParamsKey(params){
	if(!params){
		return '';
	}
	return [
		normalizeChartDateKey(params.date),
		params.time || '',
		params.ad,
		params.zone || '',
		params.lon || '',
		params.lat || '',
		params.gpsLon,
		params.gpsLat,
		params.hsys,
		params.indiaAyanamsa || AstroConst.INDIA_AYANAMSA_DEFAULT,
	].join('|');
}

function cloneIndiaFieldValue(value){
	if(value && value.clone){
		try{
			return value.clone();
		}catch(e){}
	}
	if(value && typeof value === 'object'){
		return {
			...value,
		};
	}
	return value;
}

export function cloneIndiaFieldsForJyotish(fields){
	if(!fields){
		return null;
	}
	const cloned = {
		...fields,
	};
	Object.keys(cloned).forEach((key)=>{
		const item = cloned[key];
		if(item && typeof item === 'object' && Object.prototype.hasOwnProperty.call(item, 'value')){
			cloned[key] = {
				...item,
				value: cloneIndiaFieldValue(item.value),
			};
		}
	});
	return cloned;
}

export function resolveJyotishChartObj(state, fields){
	const activeKey = buildDashaFieldsKey(fields);
	if(!state || !activeKey){
		return null;
	}
	if(hasJyotishPayload(state.mainChartObj) && state.mainChartKey === activeKey){
		return state.mainChartObj;
	}
	if(hasJyotishPayload(state.dashaChartObj) && state.dashaChartKey === activeKey){
		return state.dashaChartObj;
	}
	// keep-stale(stale-while-revalidate):当前 key 暂无匹配(切换/重取进行中)→ 回退上次成功盘,
	// 面板不空白、不闪满屏加载框;后台算好后 setState 替换为新盘(配「更新中…」角标提示)。
	// 首次加载前 lastChartObj 为 null → 返回 null,仍走 dashaLoading 的「计算中」首屏提示。
	// 回退盘只许出自当前命主(lastChartObjSig 与本次请求的命主键 activeNatalSig 一致);换了人 → null(首屏「计算中」)。
	const last = pickKeyedDerived(state.lastChartObj, state.lastChartObjSig, state.activeNatalSig);
	return hasJyotishPayload(last) ? last : null;
}

export function hasUsableJyotishChart(state, fieldsKey){
	if(!state || !fieldsKey){
		return false;
	}
	if(hasYogaPayload(state.mainChartObj) && state.mainChartKey === fieldsKey){
		return true;
	}
	if(hasYogaPayload(state.dashaChartObj) && state.dashaChartKey === fieldsKey){
		return true;
	}
	return false;
}

export function buildDashaFieldsKey(fields){
	if(!fields || !fields.date || !fields.time){
		return '';
	}
	// date 位直接用 DateTime 自身 format(带符号年,BC/五位年保真)——不经 moment,
	// 消灭「不同 BC 生日撞同一 dasha 缓存键」的串盘面。
	const dateText = (fields.date.value && fields.date.value.format)
		? fields.date.value.format('YYYY-MM-DD') : '';
	const timeMoment = momentFromFieldValue(fields.time.value, 'HH:mm:ss');
	return [
		dateText,
		timeMoment ? timeMoment.format('HH:mm:ss') : '',
		fields.ad ? fields.ad.value : '',
		fields.zone ? fields.zone.value : '',
		fields.lon ? fields.lon.value : '',
		fields.lat ? fields.lat.value : '',
		fields.gpsLon ? fields.gpsLon.value : '',
		fields.gpsLat ? fields.gpsLat.value : '',
		fields.indiaHsys ? fields.indiaHsys.value : AstroConst.INDIA_HOUSE_SYSTEM_DEFAULT,
		fields.indiaAyanamsa ? fields.indiaAyanamsa.value : AstroConst.INDIA_AYANAMSA_DEFAULT,
		fields.indiaNodeType ? fields.indiaNodeType.value : AstroConst.INDIA_NODE_TYPE_DEFAULT,
		// 🔴 年度盘年份必须进缓存/取盘键:否则换年与旧盘同键 → resolveJyotishChartObj 取回旧年盘、
		// requestDashaChart 守卫误判已有数据而跳过 fetch（年份输入「先跳别年再算/算错」的根因）。
		(fields.indiaTajakaYear && fields.indiaTajakaYear.value != null && fields.indiaTajakaYear.value !== '') ? fields.indiaTajakaYear.value : '',
		// 🔴 大运起点(seed)同理:换起点后端重算全体系大运,不进键则守卫跳过 fetch / 取回旧起点盘。
		(fields.indiaDashaSeed && fields.indiaDashaSeed.value) ? fields.indiaDashaSeed.value : DASHA_SEED_DEFAULT,
		// 🔴 当前显示盘分盘号:右边栏随显示盘算(分盘集取第一个),不进键则换分盘守卫跳过 fetch / 取回旧盘。
		(fields.indiaActiveFractal && fields.indiaActiveFractal.value) ? fields.indiaActiveFractal.value : 1,
		// 🔴 行运过运日期:换日期后端重算 gochara,不进键则守卫跳过 fetch / 取回旧过运盘。
		(fields.indiaTransitDate && fields.indiaTransitDate.value) ? fields.indiaTransitDate.value : '',
		// 🔴 Sthira 起座(lagna/brahma):换起座后端重算 Sthira 运,不进键则守卫跳过 fetch。
		(fields.indiaSthiraStart && fields.indiaSthiraStart.value) ? fields.indiaSthiraStart.value : 'lagna',
		// 🔴 大运体系:dasha-selected 重构后后端只算选中体系全树,换体系=须重取;不进键则 requestDashaChart
		// 守卫(同 key + loading)早退跳过 fetch → 「选其他大运压根不算」(blank 等待排盘数据 + 大运计算中 卡死)。
		(fields.indiaDashaSystem && fields.indiaDashaSystem.value) ? fields.indiaDashaSystem.value : 'vimshottari',
		// 🔴 KP 补齐四键同理(不进键 = 切了设置守卫跳过 fetch / 取回旧盘 —— 本模块最易犯的坑):
		// 年长 / 年盘口径 / 三旗 opt-in / 问事起卦(prashnaTime 冻结串,一次起卦一个键)。
		(fields.indiaDashaYearLength && fields.indiaDashaYearLength.value) ? fields.indiaDashaYearLength.value : AstroConst.INDIA_DASHA_YEAR_DEFAULT,
		(fields.indiaVargaVariant && fields.indiaVargaVariant.value) ? fields.indiaVargaVariant.value : '',
		(fields.indiaKarakaScheme && fields.indiaKarakaScheme.value) ? fields.indiaKarakaScheme.value : AstroConst.INDIA_KARAKA_SCHEME_DEFAULT,
		(fields.indiaYuddhaCriterion && fields.indiaYuddhaCriterion.value) ? fields.indiaYuddhaCriterion.value : AstroConst.INDIA_YUDDHA_CRITERION_DEFAULT,
		(fields.indiaAnnualChartType && fields.indiaAnnualChartType.value) ? fields.indiaAnnualChartType.value : 'varsha',
		(fields.indiaTripataki && fields.indiaTripataki.value) ? '1' : '',
		// 🔴 大运流派开关:21 键任一切换=后端重算(体系方向/期长/寿命管线全受影响),不进键则守卫跳过 fetch。
		AstroConst.serializeIndiaDashaVariants(fields.indiaDashaVariants && fields.indiaDashaVariants.value),
		// 年盘地点(居住地)覆盖同理(仅动年盘 Lagna/宫,亦须重取)。
		(fields.indiaVarshaLat && fields.indiaVarshaLat.value != null) ? `${fields.indiaVarshaLat.value}~${(fields.indiaVarshaLon || {}).value}` : '',
		(fields.indiaPrashnaTime && fields.indiaPrashnaTime.value) ? [
			fields.indiaPrashnaTime.value,
			fields.indiaPrashnaNumber ? fields.indiaPrashnaNumber.value : '',
			fields.indiaPrashnaMatter ? fields.indiaPrashnaMatter.value : '',
			fields.indiaPrashnaSchools ? fields.indiaPrashnaSchools.value : '',
			fields.indiaPrashnaCuspMode ? fields.indiaPrashnaCuspMode.value : '',
			fields.indiaPrashnaPrimaryHouse ? fields.indiaPrashnaPrimaryHouse.value : '',
		].join('~') : '',
	].join('|');
}

export function canBuildIndiaChartParams(fields){
	const nullableKeys = ['name', 'pos'];
	const requiredKeys = [
		'date', 'time', 'ad', 'zone', 'lat', 'lon', 'gpsLat', 'gpsLon',
		'tradition', 'strongRecption', 'simpleAsp', 'virtualPointReceiveAsp',
		'name', 'pos',
	];
	return requiredKeys.every((key)=>fields && fields[key] && fields[key].value !== undefined
		&& (nullableKeys.indexOf(key) >= 0 || fields[key].value !== null));
}


// 本页左栏改动(时刻 tm + 裸值 / 字段形混用)→ 标准字段补丁(与主页 changeCond 同口径),交给择日宿主的覆盖层
export function indiaValuesToFieldPatch(values){
	const out = {};
	const v0 = values || {};
	Object.keys(v0).forEach((k)=>{
		if(k === 'confirmed' || k === 'nohook' || k === 'tm'){ return; }
		const v = v0[k];
		out[k] = v && typeof v === 'object' && Object.prototype.hasOwnProperty.call(v, 'value') ? v : { value: v };
	});
	if(v0.tm && typeof v0.tm.clone === 'function'){
		out.date = { value: v0.tm.clone() };
		out.time = { value: v0.tm.clone() };
		out.ad = { value: v0.tm.ad };
		out.zone = { value: v0.tm.zone || (out.zone && out.zone.value) || '+08:00' };
	}
	return out;
}

// ── 问事块文字(页面卡 / AI 快照同一来源)──
// 问时 Yoga:后端 present_yogas_brief 简表 [{key, name, nameEn}] → 去重中文名。
export function prashnaYogaNames(yogas){
	const out = [];
	(Array.isArray(yogas) ? yogas : []).forEach((y)=>{
		const n = y && (y.name || y.nameEn || y.key);
		if(n && out.indexOf(n) < 0){ out.push(n); }
	});
	return out;
}
// 传光 / 集光 / 月助:后端 higher_yogas_for_pair 展平条目 [{type, label, a, b, via}]。
export function prashnaHigherYogaText(y){
	if(!y){ return ''; }
	const label = y.label || y.type || '';
	return y.via ? `${label}(经 ${y.via})` : label;
}
// 白黑分:后端 panchanga.tithi.paksha('Shukla' | 'Krishna')→ 中文标签。
export function pakshaLabel(p){
	if(p === 'Shukla'){ return '白分 Shukla'; }
	if(p === 'Krishna'){ return '黑分 Krishna'; }
	return p || '';
}
