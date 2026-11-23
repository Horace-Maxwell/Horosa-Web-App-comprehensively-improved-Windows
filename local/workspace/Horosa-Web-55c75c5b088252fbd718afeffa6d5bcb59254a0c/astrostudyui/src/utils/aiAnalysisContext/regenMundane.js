// 世俗盘无头复算(十类盘种,与世俗盘页同一套求根 / 取数 / 正文构建):按起课时间与地点定出起盘时刻,
// 正文交给世俗盘页同一个 buildAiSnapshot(页面类方法;页面按需拉取的段落经同一组页面方法现取,写进临时 state)。
// 起盘时刻怎么定:
//   入宫盘 = 起课时间所在年份(或指定年份)的指定节气入宫时刻;新满月 / 日月食 = 起课时间之前最近的一次(当令的那一次);
//   地区盘 = 预置 / 自定义地区的建置时刻与地点(不给地区 = 本盘时间地点即建置);行星周期 = 起课时间(木土纪元与周期表随页面口径现取);
//   恒星派入境 / 吠陀世运 = 指定年份(缺省起课那年)的恒星入境求根时刻;世运卜卦 = 起课时间本身(问主 = 公众 / 国家)。
// 宫制 / 黄道 / 规则集等口径取世俗盘页保存值,挂载设置可单次覆盖;恒星派与吠陀两类的黄道 / 宫制是盘种固定设计(与页面同)。
import { buildFieldObject } from './recordFields';
import { datePartOf, parseDateParts, formatSignedDate, civilJdnOfDateStr, civilDateStrOfJdn, toSlashDate, leadingYearOf } from '../dateStrSafe';

export const MUNDANE_HEADLESS_TYPES = ['ingress', 'newmoon', 'fullmoon', 'solecl', 'lunecl', 'region', 'cycles', 'solunar', 'vedicmundane', 'mundanehorary'];
export const MUNDANE_VEDIC_EVENTS = ['ingress_0', 'ingress_90', 'ingress_180', 'ingress_270'];
export const MUNDANE_INGRESS_TERMS = ['春分', '夏至', '秋分', '冬至'];
// 往前找事件的窗口(天):新满月一个朔望月内必有;日月食约半年一组,取一年半保证至少一次
const LOOKBACK_DAYS = { newmoon: 35, fullmoon: 35, solecl: 550, lunecl: 550 };

function shiftDate(dateStr, days){
	const j = civilJdnOfDateStr(dateStr);
	return Number.isFinite(j) ? civilDateStrOfJdn(j + days) : dateStr;
}

// 在 [startDate, endDate] 里找 ≤ 截止时刻的最后一次事件
export function pickLatestEvent(events, cutoff){
	const list = (events || []).filter((e)=>e && e.localTime && e.localTime <= cutoff);
	return list.length ? list[list.length - 1] : null;
}

// 起课时间 → 'YYYY-MM-DD HH:mm:ss'(起盘时刻串)
function cutoffOf(divTime){
	const s = `${divTime || ''}`.replace(/\//g, '-').trim();
	return /\d{1,2}:\d{2}/.test(s) ? (s.split(' ').length > 1 && s.split(' ')[1].length === 5 ? `${s}:00` : s) : `${s} 12:00:00`;
}

// 年份类参数:给了整数用它,空 / 非数用缺省
function yearOr(v, dflt){
	return (v !== undefined && v !== null && `${v}` !== '' && Number.isFinite(Number(v))) ? Math.trunc(Number(v)) : dflt;
}

// 页面方法的临时宿主:setState 直接并进 state(页面按需拉取的方法照原样跑,结果留在这里供 buildAiSnapshot 读)
function makeHost(state){
	const host = { state: { ...(state || {}) } };
	host.setState = (patch, cb)=>{ Object.assign(host.state, typeof patch === 'function' ? patch(host.state) : (patch || {})); if(typeof cb === 'function'){ cb(); } };
	return host;
}
const asFields = (geo)=>({ zone: { value: geo.zone }, lat: { value: geo.lat }, lon: { value: geo.lon }, gpsLat: { value: geo.gpsLat }, gpsLon: { value: geo.gpsLon } });

export async function buildMundaneSnapshotForRecord(record, payload){
	const p = payload || {};
	const r = record || {};
	const type = MUNDANE_HEADLESS_TYPES.indexOf(p.mundaneType) >= 0 ? p.mundaneType : 'ingress';
	const divTime = `${r.divTime || r.birth || ''}`.trim();
	const dateStr = datePartOf(divTime).replace(/\//g, '-');
	const dp = parseDateParts(dateStr);
	if(!dp){ return ''; }
	const [{ default: MundaneMain, MUNDANE_PAGE_SETTINGS }, mp, bridge, regionMod, solunarMod, vedicMod, horaryMod] = await Promise.all([
		import(/* webpackChunkName: "mundane-headless" */ '../../components/mundane/MundaneMain'),
		import('../../divination/mundane/momentPipeline'),
		import('../preciseCalcBridge'),
		import('../../divination/data/regionCharts'),
		import('../../divination/mundane/solunar'),
		import('../../divination/mundane/vedicMundane'),
		import('../../divination/mundane/mundaneHorary'),
	]);
	const mod = {
		allRegions: regionMod.allRegions, regionCandidates: regionMod.regionCandidates,
		solveSiderealIngress: solunarMod.solveSiderealIngress, SOLUNAR_TYPE_KEYS: solunarMod.SOLUNAR_TYPES.map((x)=>x.key),
		solveVedicSolarIngress: vedicMod.solveVedicSolarIngress,
		MUNDANE_HORARY_KIND_KEYS: horaryMod.MUNDANE_HORARY_KINDS.map((x)=>x.key),
	};
	const page = MUNDANE_PAGE_SETTINGS.load();
	const fields = buildFieldObject(r);
	const fv = (k, d)=>(fields[k] && fields[k].value !== undefined && fields[k].value !== null ? fields[k].value : d);
	const zone = fv('zone', r.zone || '+08:00');
	const geo = { zone, lat: fv('lat', r.lat || '0n00'), lon: fv('lon', r.lon || '0e00'), gpsLat: fv('gpsLat', 0), gpsLon: fv('gpsLon', 0) };
	const extra = {
		mundaneType: type,
		mundaneRuleset: p.mundaneRuleset || page.mundaneRuleset,
		mundaneOrbScheme: p.mundaneOrbScheme || page.mundaneOrbScheme,
		mundaneIngressRule: p.mundaneIngressRule || page.mundaneIngressRule,
	};
	let moment = '';
	let chart = null;
	let chartGeo = geo;
	let host = makeHost({});
	const baseChartOpts = { hsys: page.hsys !== undefined ? page.hsys : 0, zodiacal: page.zodiacal !== undefined ? page.zodiacal : 0, siderealAyanamsa: page.siderealAyanamsa || '' };
	if(type === 'ingress'){
		const year = yearOr(p.ingressYear, dp.year);
		const term = MUNDANE_INGRESS_TERMS.indexOf(p.ingressTerm) >= 0 ? p.ingressTerm : '春分';
		// 与世俗盘页「排入宫盘」同一请求(入宫时刻只看经度与时区)
		const seed = await bridge.fetchPreciseJieqiSeed({ year: String(year), ad: 1, zone, lon: geo.lon, lat: '23n26', gpsLat: 23.43, gpsLon: geo.gpsLon, timeAlg: 0, jieqis: [term] });
		const hit = seed && seed[term];
		if(!hit || !hit.time){ return ''; }
		moment = hit.time;
		Object.assign(extra, { ingressTerm: term, ingressYear: year, ingressMoment: moment });
	}else if(type === 'newmoon' || type === 'fullmoon' || type === 'solecl' || type === 'lunecl'){
		const back = LOOKBACK_DAYS[type];
		const isEcl = type === 'solecl' || type === 'lunecl';
		const res = await mp.fetchMundaneEvents({ ...geo, startDate: shiftDate(formatSignedDate(dp.year, dp.month, dp.day), -back), endDate: formatSignedDate(dp.year, dp.month, dp.day), kinds: [isEcl ? 'eclipses' : 'lunations'] });
		const cutoff = divTime.replace(/\//g, '-');
		const pool = isEcl
			? (res.eclipses || []).filter((e)=>e.kind === (type === 'solecl' ? 'solar' : 'lunar'))
			: (res.lunations || []).filter((e)=>`${e.phase || ''}`.toLowerCase().indexOf(type === 'newmoon' ? 'new' : 'full') >= 0);
		const ev = pickLatestEvent(pool, cutoff);
		if(!ev){ return ''; }
		moment = ev.localTime;
		extra.selectedMoment = moment;
		if(isEcl){ extra.eclipseTypeText = ev.eclipseType || ''; }
	}else if(type === 'region'){
		// 地区盘:给了地区键 = 该地区的建置时刻与地点(多候选取指定的,缺省首候选);没给 = 本盘时间地点即建置
		const regions = mod.allRegions();
		const rec = p.regionKey ? regions[p.regionKey] : null;
		if(p.regionKey && !rec){ return ''; }
		if(rec){
			const cands = mod.regionCandidates(p.regionKey);
			const cand = cands ? (cands.find((c)=>c.key === p.regionCandidate) || cands[0]) : null;
			moment = `${rec.date} ${(cand && cand.time) || rec.time || '12:00:00'}`;
			chartGeo = { zone: rec.zone || '+00:00', lat: rec.lat, lon: rec.lon, gpsLat: rec.gpsLat, gpsLon: rec.gpsLon };
			Object.assign(extra, { regionKey: p.regionKey, regionCn: rec.cn + (cand ? ` · ${cand.label}` : ''), regionFoundingYear: leadingYearOf(rec.date) || null });
		}else{
			moment = cutoffOf(divTime);
			Object.assign(extra, { regionKey: null, regionCn: (r.name || r.title) ? `${r.name || r.title}(本盘时间地点为建置)` : '本盘时间地点为建置', regionFoundingYear: dp.year });
		}
		// 推运目标年:指定的优先;给了地区 = 起课那年,本盘即建置 = 今年(与页面缺省同)
		host = makeHost({ progTargetYear: yearOr(p.regionTargetYear, rec ? dp.year : new Date().getFullYear()) });
	}else if(type === 'cycles' || type === 'mundanehorary'){
		moment = cutoffOf(divTime);
		if(type === 'mundanehorary'){ extra.mhKind = mod.MUNDANE_HORARY_KIND_KEYS.indexOf(p.mhKind) >= 0 ? p.mhKind : 'war'; }
	}else if(type === 'solunar'){
		const typeKey = mod.SOLUNAR_TYPE_KEYS.indexOf(p.solunarType) >= 0 ? p.solunarType : 'capsolar';
		const year = yearOr(p.ingressYear, dp.year);
		const res = await mod.solveSiderealIngress(typeKey, year, geo);
		if(!res || !res.moment){ return ''; }
		moment = res.moment;
		Object.assign(extra, { solunarType: typeKey, solunarYear: year, solunarWeights: page.solunarWeights, solunarOrb: page.solunarOrb });
		Object.assign(baseChartOpts, { zodiacal: 1, siderealAyanamsa: 'fagan_bradley', hsys: 10, tradition: 0 });
	}else if(type === 'vedicmundane'){
		const ev = MUNDANE_VEDIC_EVENTS.indexOf(p.vedicEvent) >= 0 ? p.vedicEvent : 'ingress_0';
		const year = yearOr(p.ingressYear, dp.year);
		const res = await mod.solveVedicSolarIngress(ev, year, geo);
		if(!res || !res.moment){ return ''; }
		moment = res.moment;
		Object.assign(extra, { vedicYear: year, vedicDashaYearLen: page.vedicDashaYearLen });
		Object.assign(baseChartOpts, { zodiacal: 1, siderealAyanamsa: 'lahiri', hsys: 0, tradition: 0 });
		host = makeHost({ vedicMoment: moment });
		// 年之九主:与页面「九主」页签同一方法
		try{ await MundaneMain.prototype.computeVedicNavanayaka.call(host, extra, asFields(geo)); }catch(e){ /* 取不到只少这一段 */ }
	}
	if(!moment){ return ''; }
	chart = await mp.chartAtMoment(moment, { ...chartGeo, ...baseChartOpts });
	if(!chart){ return ''; }
	if(type === 'cycles'){
		// 木土纪元(页面进页即算的缺省年段)与周期表(存案前补取的同一方法)
		host = makeHost({ gcStart: 1300, gcEnd: 2200, gcPair: 'jupiter-saturn', gcAspect: 0, gcMode: 'ages', gcResults: null });
		try{ await MundaneMain.prototype.computeGreatConj.call(host); }catch(e){ /* 取不到只少这一段 */ }
		try{ await MundaneMain.prototype.ensureCycleTableText.call(host, chart, extra); }catch(e){ /* 同上 */ }
	}
	// 快照里的起盘时刻 / 地点 = 事件时刻 / 起盘地点
	const [d, t] = `${moment}`.split(' ');
	const evFields = buildFieldObject({ ...r, birth: `${toSlashDate(d)} ${t || '12:00:00'}`, divTime: undefined, ...(chartGeo !== geo ? chartGeo : {}) });
	try{
		return `${MundaneMain.prototype.buildAiSnapshot.call(host, chart, evFields, extra) || ''}`.trim();
	}catch(e){
		return '';
	}
}
