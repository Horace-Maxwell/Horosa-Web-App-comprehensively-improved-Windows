// 辅盘「变换盘」「黄道制」的无头复算:辅盘页没对这张盘出过图时(或出的是别的命主),AI 挂载 / 外部智能体按
// 辅盘页保存的设置(变换种类与其选项 / 黄道版本)直接请求后端,正文与页面出盘即存的快照同一份构建函数。
// 页面侧模块按需动态载入:不把辅盘页的依赖拉进 AI 上下文的静态链。
import { fetchChartResultForRecord } from './chartParams';
import { buildFieldObject } from './recordFields';
import { REGENERATED_SNAPSHOT_CACHE, REGENERATED_SNAPSHOT_MAX, REGENERATED_SNAPSHOT_TTL_MS, regeneratedSnapshotKey } from './snapshotMatch';

export const DERIVED_LAB_HEADLESS_KEYS = ['transformchart', 'zodiacsystems'];

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

function headlessPageSettings(m, key){
	return key === 'transformchart' ? m.tc.TRANSFORM_PAGE_SETTINGS.load() : m.tc.ZODIAC_PAGE_SETTINGS.load();
}

export async function buildDerivedLabHeadless(record, key){
	if(!record || DERIVED_LAB_HEADLESS_KEYS.indexOf(key) < 0){ return ''; }
	let m = null;
	let settings = null;
	try{
		m = await loaders();
		settings = headlessPageSettings(m, key);
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
		const natal = await fetchChartResultForRecord(record);
		if(!natal){ return ''; }
		const fields = buildFieldObject(record);
		const planetName = (id)=>(m.AstroText.AstroMsgCN && m.AstroText.AstroMsgCN[id]) || id;
		const base = m.common.chartParams(natal);
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
