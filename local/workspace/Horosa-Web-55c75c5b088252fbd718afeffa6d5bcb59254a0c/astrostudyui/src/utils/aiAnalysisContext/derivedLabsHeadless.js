// 辅盘七张派生盘(十三分 / 十二分 / 调波 / 龙盘 / 重置盘 / 变换盘 / 黄道制)的无头复算:辅盘页没对这张盘出过图时
// (或出的是别的命主、或出图时的参数与此刻要的不同),AI 挂载 / 外部智能体直接请求后端,正文与页面出盘即存的快照同一份构建函数。
// 参数:调波数 / 龙盘宫位口径 / 重置地点取挂载设置(记录上的同名键),没设 = 页面缺省(调波 9、龙盘宫位口径取辅盘页保存值、重置地点 = 出生地);
// 变换盘 / 黄道制取辅盘页保存的设置。页面侧模块按需动态载入:不把辅盘页的依赖拉进 AI 上下文的静态链。
import { fetchChartResultForRecord } from './chartParams';
import { buildFieldObject } from './recordFields';
import { REGENERATED_SNAPSHOT_CACHE, REGENERATED_SNAPSHOT_MAX, REGENERATED_SNAPSHOT_TTL_MS, regeneratedSnapshotKey } from './snapshotMatch';

import { clampHarmonic, HARMONIC_DEFAULT, DRACONIC_HOUSE_MODES, harmonicSnapshotLines, draconicSnapshotLines, relocationSnapshotSpecialty, withNatalPlanetSign } from '../derivedAstroLabs';

export const DERIVED_LAB_HEADLESS_KEYS = ['hellenastro', 'dwadasamsa', 'harmonic', 'draconic', 'relocation', 'transformchart', 'zodiacsystems'];

// 这张派生盘「此刻要按什么参数出」(只列带参数的三张;其余回 null)。与页面出盘即存时记的 meta.derivedParams 同形,两边能直接比。
// 龙盘宫位口径没在记录上设 = 辅盘页保存值(读不到 = 整宫);重置地点没设或不成对 = null(按出生地出,与本命同)。
const finiteNum = (v)=>(v !== undefined && v !== null && `${v}` !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
export function derivedParamsFor(key, record, draconicPageMode){
	const r = record || {};
	if(key === 'harmonic'){ return { harmonic: clampHarmonic(r.harmonic, HARMONIC_DEFAULT) }; }
	if(key === 'draconic'){
		const own = DRACONIC_HOUSE_MODES.indexOf(r.draconicHouses) >= 0 ? r.draconicHouses : '';
		return { draconicHouses: own || (DRACONIC_HOUSE_MODES.indexOf(draconicPageMode) >= 0 ? draconicPageMode : 'whole') };
	}
	if(key === 'relocation'){
		// 只给了一个:另一个取出生地(只换纬度 / 只换经度也是合法的问法)
		let lat = finiteNum(r.relocLat); let lon = finiteNum(r.relocLon);
		if(lat === null && lon !== null){ lat = finiteNum(r.gpsLat); }
		if(lon === null && lat !== null){ lon = finiteNum(r.gpsLon); }
		return lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { relocLat: Number(lat.toFixed(4)), relocLon: Number(lon.toFixed(4)) } : null;
	}
	return null;
}
// 变换盘 / 黄道制:记录上有生效的单次覆盖(与辅盘页保存值不同)时回一个「要现算」的标记;没有回 null(页面出过用页面的)
export function derivedOverrideFor(key, record){
	try{
		const tc = require('../transformCharts');
		if(key === 'transformchart'){ const r = tc.transformSettingsFor(record, tc.TRANSFORM_PAGE_SETTINGS.load()); return r.overridden ? { override: JSON.stringify(r.settings) } : null; }
		if(key === 'zodiacsystems'){ const r = tc.zodiacSettingsFor(record, tc.ZODIAC_PAGE_SETTINGS.load()); return r.overridden ? { override: JSON.stringify(r.settings) } : null; }
	}catch(e){ /* 读不到页面设置:按没有覆盖 */ }
	return null;
}
// 记录上明写了这张盘的参数(挂载设置 / 外部智能体单次指定)
export function derivedParamsExplicit(key, record){
	const r = record || {};
	const has = (v)=>v !== undefined && v !== null && `${v}` !== '';
	if(key === 'harmonic'){ return has(r.harmonic); }
	if(key === 'draconic'){ return DRACONIC_HOUSE_MODES.indexOf(r.draconicHouses) >= 0; }
	if(key === 'relocation'){ return has(r.relocLat) || has(r.relocLon); }
	return false;
}
// 页面快照记的参数与此刻要的是否同一组(没有要比的 = 同;页面快照没记参数 = 不同,宁可现算)
export function sameDerivedParams(saved, wanted){
	if(!wanted){ return true; }
	if(!saved || typeof saved !== 'object'){ return false; }
	return Object.keys(wanted).every((k)=>`${saved[k]}` === `${wanted[k]}`);
}
// 取辅盘页保存的龙盘宫位口径(页面模块按需载入;读不到回 '')
export function draconicPageHouseMode(){
	try{ return require('../../components/auxchart/AstroDraconicLab').DRACONIC_PAGE_SETTINGS.load().houseMode || ''; }catch(e){ return ''; }
}

async function loaders(){
	const [common, tc, das, req, consts, text] = await Promise.all([
		import(/* webpackChunkName: "aux-derived-headless" */ '../../components/astro/AstroExtraCommon'),
		import(/* webpackChunkName: "aux-derived-headless" */ '../transformCharts'),
		import(/* webpackChunkName: "aux-derived-headless" */ '../derivedAstroSnapshot'),
		import('../request'),
		import('../constants'),
		import('../../constants/AstroText'),
	]);
	return { common, tc, das, request: req.default || req, Constants: consts, AstroText: text };
}

// 变换盘只发这种变换真正用到的选项(与辅盘页 AstroTransformLab.requestOptions 同口径)
export function transformRequestOptions(settings, kindDef){
	const { kind, planet, shift, house, variant } = settings || {};
	const options = (kindDef && kindDef.options) || [];
	const out = { transformKind: kind };
	if(options.indexOf('planet') >= 0){ out.transformPlanet = planet; }
	if(options.indexOf('shift') >= 0){ out.transformShift = shift ? 1 : 0; }
	if(options.indexOf('house') >= 0){ out.transformHouse = house; }
	if(options.indexOf('variant') >= 0){ out.transformVariant = variant; }
	return out;
}

// 结果与别的技法重算共用一份内存小缓存(32 条、10 分钟):键 = 技法 + 整份记录 + 星盘口径 + 辅盘页这一项的设置。
// 每次发送 / 预览都会建一次上下文,不缓存就每次重取本命盘再请求一次后端(变换盘最长等 60 秒,卡住发送);
// 同一键并发的(预览与发送前后脚)共用一个在途请求。
const HEADLESS_INFLIGHT = new Map();

// 这一项的「设置签名」(进缓存键):变换盘 / 黄道制 = 辅盘页保存的设置;调波 / 龙盘 / 重置盘 = 此刻要的参数;十三分 / 十二分没有
function headlessPageSettings(m, key, record){
	// 记录上的单次覆盖叠在辅盘页保存值之上(不改页面保存值)
	if(key === 'transformchart'){ return m.tc.transformSettingsFor(record, m.tc.TRANSFORM_PAGE_SETTINGS.load()).settings; }
	if(key === 'zodiacsystems'){ return m.tc.zodiacSettingsFor(record, m.tc.ZODIAC_PAGE_SETTINGS.load()).settings; }
	return derivedParamsFor(key, record, draconicPageHouseMode()) || {};
}

export async function buildDerivedLabHeadless(record, key){
	if(!record || DERIVED_LAB_HEADLESS_KEYS.indexOf(key) < 0){ return ''; }
	let m = null;
	let settings = null;
	try{
		m = await loaders();
		settings = headlessPageSettings(m, key, record);
	}catch(e){
		return '';
	}
	const baseKey = regeneratedSnapshotKey(key, record);
	let cacheKey = '';
	try{ cacheKey = baseKey ? `${baseKey}#derived#${JSON.stringify(settings)}` : ''; }catch(e){ cacheKey = ''; }
	if(cacheKey){
		const hit = REGENERATED_SNAPSHOT_CACHE.get(cacheKey);
		if(hit && Date.now() - hit.at < REGENERATED_SNAPSHOT_TTL_MS){ return hit.text; }
		if(HEADLESS_INFLIGHT.has(cacheKey)){ return HEADLESS_INFLIGHT.get(cacheKey); }
	}
	const pending = computeDerivedLabHeadless(record, key, m, settings);
	if(!cacheKey){ return pending; }
	HEADLESS_INFLIGHT.set(cacheKey, pending);
	try{
		const text = await pending;
		if(text){
			REGENERATED_SNAPSHOT_CACHE.set(cacheKey, { text, at: Date.now() });
			while(REGENERATED_SNAPSHOT_CACHE.size > REGENERATED_SNAPSHOT_MAX){ REGENERATED_SNAPSHOT_CACHE.delete(REGENERATED_SNAPSHOT_CACHE.keys().next().value); }
		}
		return text;
	}finally{
		HEADLESS_INFLIGHT.delete(cacheKey);
	}
}

async function computeDerivedLabHeadless(record, key, m, settings){
	try{
		const fields = buildFieldObject(record);
		if(key === 'hellenastro' || key === 'dwadasamsa'){
			// 十三分 / 十二分:与辅盘页同一份构参、同一份取数缓存
			const c13 = await import(/* webpackChunkName: "aux-derived-headless" */ '../../components/hellenastro/AstroChart13');
			const result = await c13.fetchChart13Cached(c13.fieldsToParams(fields), true, key === 'dwadasamsa' ? 'chart12' : 'chart13');
			return result ? m.das.derivedAstroSnapshotText(result, fields, null) : '';
		}
		const natal = await fetchChartResultForRecord(record);
		if(!natal){ return ''; }
		const planetName = (id)=>(m.AstroText.AstroMsgCN && m.AstroText.AstroMsgCN[id]) || id;
		const base = m.common.chartParams(natal);
		if(key === 'harmonic'){
			const data = await m.request(`${m.Constants.ServerRoot}/astroextra/harmonic`, { body: JSON.stringify({ ...base, harmonic: settings.harmonic, orb: 2 }), timeoutMs: 30000, silent: true });
			const res = m.common.unwrapResult(data) || {};
			if(!res.chart){ return ''; }
			return m.das.derivedAstroSnapshotText(res.chart, fields, ()=>harmonicSnapshotLines(res, settings.harmonic));
		}
		if(key === 'draconic'){
			const data = await m.request(`${m.Constants.ServerRoot}/astroextra/draconic`, { body: JSON.stringify({ ...base, orb: 2, draconicHouses: settings.draconicHouses }), timeoutMs: 30000, silent: true });
			const res = m.common.unwrapResult(data) || {};
			if(!res.chart){ return ''; }
			return m.das.derivedAstroSnapshotText(res.chart, fields, ()=>draconicSnapshotLines(res, settings.draconicHouses, natal));
		}
		if(key === 'relocation'){
			const helper = await import('../../components/astro/AstroHelper');
			const lab = await import(/* webpackChunkName: "aux-derived-headless" */ '../../components/auxchart/AstroRelocationLab');
			// 没给重置地点 = 出生地(与辅盘页刚打开时一样:这时盘与本命相同)
			const lat = settings.relocLat !== undefined ? settings.relocLat : Number(Number(helper.convertLatStrToDegree(base.lat)).toFixed(4));
			const lon = settings.relocLon !== undefined ? settings.relocLon : Number(Number(helper.convertLonStrToDegree(base.lon)).toFixed(4));
			if(!Number.isFinite(lat) || !Number.isFinite(lon)){ return ''; }
			const latStr = helper.convertLatToStr(lat); const lonStr = helper.convertLonToStr(lon);
			const data = await m.request(`${m.Constants.ServerRoot}/astroextra/relocation`, { body: JSON.stringify({ ...base, relocLat: latStr, relocLon: lonStr }), timeoutMs: 30000, silent: true });
			const res = m.common.unwrapResult(data) || {};
			if(!res.chart){ return ''; }
			const bodies = lab.relocExtrasRequestBodies({ ...base, lat: latStr, lon: lonStr });
			const extras = await lab.requestRelocExtras(bodies.detailsBody, bodies.classicalBody);
			return m.das.derivedAstroSnapshotText(withNatalPlanetSign(res.chart, natal), fields, ()=>relocationSnapshotSpecialty(natal, res.chart, lat, lon, extras));
		}
		if(key === 'transformchart'){
			const body = { ...base, ...transformRequestOptions(settings, m.tc.transformKindDef(settings.kind)) };
			const data = await m.request(`${m.Constants.ServerRoot}/astroextra/transformchart`, { body: JSON.stringify(body), timeoutMs: 60000, silent: true });
			const res = m.common.unwrapResult(data) || {};
			if(!res.chart){ return ''; }
			return m.das.derivedAstroSnapshotText(m.tc.transformSnapshotChart(res), fields, ()=>m.tc.transformSnapshotLines(res, settings, planetName));
		}
		const data = await m.request(`${m.Constants.ServerRoot}/astroextra/zodiacsystems`, { body: JSON.stringify({ ...base, zodiacVersion: settings.version }), timeoutMs: 30000, silent: true });
		const res = m.common.unwrapResult(data) || {};
		return m.das.derivedAstroSnapshotText(null, fields, ()=>m.tc.zodiacSnapshotLines(res, planetName));
	}catch(e){
		return '';
	}
}
