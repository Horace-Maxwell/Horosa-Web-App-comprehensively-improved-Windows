// AI 分析挂载上下文 · 双盘:中式合盘(八字合婚 / 紫微合盘)缓存、西洋合盘快照、两盘关系快照。
// 由 utils/aiAnalysisContext.js 门面统一对外导出。
import request from '../request';
import * as Constants from '../constants';
import { mergeOptionsIntoRecord, pruneOptionsToNonDefault, effectiveMountBaseline } from '../techniqueMountSettings';
import { mountCalibreSignature } from '../mountCalibreSignature';
import { buildBaziHehunText, buildZiweiPairText, pairChineseWanted } from '../pairChineseData';
import { ZWSchool, sihuaTableFor } from '../../constants/ZWConst';
import { ZWEngineOptions, collectEngineOpts } from '../../components/ziwei/ziweiOptions';
import { loadBuildRelativeSnapshotText, ensureRelativeClassicalLoaded, relativeClassicalParamsOf } from './catalog';
import { buildFieldObject } from './recordFields';
import { buildChartBaziParams, buildChartZiweiParams } from './chartParams';

// 无头合盘(synastry):从两张命盘 record 现算关系快照 —— 比较盘(互摄相位/中点/映点)+ 组合盘(复合图)+ 影响盘(双盘叠加)。
// 供「合盘」技法直接选两张盘生成,无需先在合盘页挂载。后端 /modern/relative(:9999,RSA);任一产品失败优雅跳过。
// 中式合盘数据(纯前端确定性计算,见 utils/pairChineseData.js):两人都挂八字 → 八字合婚;都挂紫微 → 紫微合盘。
//   按「这一对 + 要哪几门 + 四化流派 + 星盘口径」缓存(两盘八字 / 紫微本地排盘约数百毫秒,同一对人追问不重算);算不出 = 空串(不出层)。
const PAIR_CHINESE_CACHE = new Map();
export const PAIR_BAZI_UNAVAILABLE_NOTE = '[说明] 两人中有人的出生年份超出本地八字历法的可靠范围,八字合婚对照这次没能排出;两人各自的八字段照常(由计算服务排出)。';
const PAIR_CHINESE_CACHE_MAX = 8;
// 与单盘紫微挂载(buildZiweiSnapshotForParams)同一套排盘开关键:记录里显式存的盖在当前全局之上(带标记的盘缺键已补成出厂默认)
const PAIR_ZIWEI_ENGINE_KEYS = ['daxianSpan', 'tianmaBasis', 'starSet', 'sanPan', 'shangShi', 'leapMonth', 'lateZi', 'yearBoundary', 'huoling', 'kongNaming',
	'brightnessSource', 'lifeMasterBy', 'liuYueBasis', 'liunianSihuaGan', 'changshengStart', 'changshengDirection', 'kuiYue', 'kongwangStyle', 'flowLuanXi', 'flowHuoLing', 'flowShenshaOnChart', 'childLimit', 'zhongxian', 'huoPan', 'qishuWei', 'borrowPalace', 'taiSuiRuGua', 'taiSuiRelatives', 'xiaoxianMode'];
// 合盘里一方的记录按本次挂载设置(会话 / 齿轮覆盖)构造:与单盘段同一条路 —— 相对该盘现状剪成真覆盖后 merge 进记录。
// 没覆盖 = 原记录(结果与此前逐字节相同)。
function pairMountOptions(record, key, optionsByKey){
	const raw = optionsByKey && typeof optionsByKey === 'object' ? optionsByKey[key] : null;
	if(!record || !raw || typeof raw !== 'object'){ return null; }
	const opts = pruneOptionsToNonDefault(key, raw, effectiveMountBaseline(key, record));
	return opts && Object.keys(opts).length ? opts : null;
}
function pairRecordFor(record, key, optionsByKey){
	const opts = pairMountOptions(record, key, optionsByKey);
	return opts ? mergeOptionsIntoRecord(record, key, opts) : record;
}
function chartZiweiBirthOf(record, { mountSchool = false } = {}){
	const p = buildChartZiweiParams(record);
	// 排盘口径与单盘挂载、紫微页一致(定年界线 / 晚子时方案 / 闰月 / 起局等):此前只传了时间三键,
	// 本地引擎缺省按立春定年,而紫微页与单盘挂载缺省正月初一 → 生在两者之间的人生年四化整组算错。不改全局单例。
	const eff = { ...ZWEngineOptions };
	PAIR_ZIWEI_ENGINE_KEYS.forEach((k)=>{
		if(p[k] !== undefined && p[k] !== null && (Array.isArray(p[k]) || `${p[k]}` !== '')){ eff[k] = p[k]; }
	});
	const out = {
		birth: { date: p.date, time: p.time, zone: p.zone, lon: p.lon, lat: p.lat, gpsLon: p.gpsLon, gpsLat: p.gpsLat, ad: 1, gender: p.gender },
		opts: { timeAlg: p.timeAlg, after23NewDay: p.after23NewDay, lateZiHourUseNextDay: p.lateZiHourUseNextDay, lateZi: eff.lateZi, yearBoundary: eff.yearBoundary, ...collectEngineOpts(eff), lifeMasterBy: eff.lifeMasterBy || 'year_branch' },
	};
	// 两人各按自己记录里的四化流派(此前两人都按当前全局流派);没存的照旧用当前设置;本次挂载设置改了流派的标明出处
	if(p.sihuaSchool || p.sihuaCustomTable){ out.sihua = { school: p.sihuaSchool || '', customTable: p.sihuaCustomTable, ...(mountSchool ? { source: 'mount' } : {}) }; }
	// 三盘(天 / 地 / 人):与单盘挂载同 —— 本地排出天盘后按所选转地盘 / 人盘(命宫 / 夫妻宫主星与四化入宫的宫名随之)
	if(eff.sanPan && eff.sanPan !== 'tian'){ out.sanPan = eff.sanPan; }
	return out;
}
// pairOpts.optionsA / optionsB:两人各自的本次挂载设置(按技法键,与单盘段同一份);缺省 = 只按记录
export function getPairChineseTexts(recordA, recordB, techniqueKeys, names = {}, pairOpts = {}){
	const want = pairChineseWanted(techniqueKeys);
	const out = { bazi: '', ziwei: '' };
	if(!recordA || !recordB || (!want.bazi && !want.ziwei)){ return out; }
	const optsA = pairOpts && pairOpts.optionsA;
	const optsB = pairOpts && pairOpts.optionsB;
	const zwOf = (rec, o)=>{
		const mo = pairMountOptions(rec, 'ziwei', o);
		return chartZiweiBirthOf(mo ? mergeOptionsIntoRecord(rec, 'ziwei', mo) : rec, { mountSchool: !!(mo && mo.sihuaSchool !== undefined) });
	};
	let zwA = null;
	let zwB = null;
	if(want.ziwei){ try{ zwA = zwOf(recordA, optsA); zwB = zwOf(recordB, optsB); }catch(e){ zwA = null; zwB = null; } }
	let bzA = null;
	let bzB = null;
	if(want.bazi){ try{ bzA = buildChartBaziParams(pairRecordFor(recordA, 'bazi', optsA)); bzB = buildChartBaziParams(pairRecordFor(recordB, 'bazi', optsB)); }catch(e){ bzA = null; bzB = null; } }
	// 缓存键 = 真正喂给两个构造的输入(排盘参数 + 引擎口径 + 实际取用的四化表):记录改了时间算法 / 日界 /
	// 紫微开关、本机自定义四化表改了,都不再命中旧结果(此前只认出生时空与全局口径签名)。
	const sihuaSig = (z)=>{
		if(!z){ return ''; }
		const school = z.sihua && z.sihua.school ? z.sihua.school : (ZWSchool.school || '');
		let table = '';
		try{ table = JSON.stringify(sihuaTableFor(school, z.sihua ? z.sihua.customTable : undefined)); }catch(e){ table = ''; }
		return `${school}|${table}`;
	};
	const sig = (o)=>{ try{ return JSON.stringify(o || null); }catch(e){ return ''; } };
	const key = [pairSynastryKey(recordA, recordB), want.bazi ? 'b' : '', want.ziwei ? 'z' : '', ZWSchool.school || '', sig(bzA), sig(bzB), sig(zwA), sig(zwB), sihuaSig(zwA), sihuaSig(zwB), names.selfName || '', names.otherName || ''].join('#');
	if(PAIR_CHINESE_CACHE.has(key)){ return { ...PAIR_CHINESE_CACHE.get(key) }; }
	// 本地八字算不出(年份超出本地历法可靠范围,单盘段会改由计算服务排):出一行说明,不让这一段静默消失
	if(want.bazi){ try{ out.bazi = (bzA && bzB) ? buildBaziHehunText(bzA, bzB, names) : ''; }catch(e){ out.bazi = (bzA && bzB) ? PAIR_BAZI_UNAVAILABLE_NOTE : ''; } }
	if(want.ziwei){ try{ out.ziwei = (zwA && zwB) ? buildZiweiPairText(zwA, zwB, names) : ''; }catch(e){ out.ziwei = ''; } }
	if(out.bazi || out.ziwei){
		PAIR_CHINESE_CACHE.set(key, { ...out });
		while(PAIR_CHINESE_CACHE.size > PAIR_CHINESE_CACHE_MAX){ PAIR_CHINESE_CACHE.delete(PAIR_CHINESE_CACHE.keys().next().value); }
	}
	return out;
}
export function __resetPairChineseCacheForTests(){ PAIR_CHINESE_CACHE.clear(); }

// [双盘挂载] 两人之间的西洋合盘数据:按「这一对」缓存(两张盘的出生时空 + 宫制 / 黄道 + 星盘口径签名为键),
//   同一对人在会话里反复发送不再每次连打 4 个合盘请求;同时进行的两次取数合并成一次;空结果不缓存(下次重试)。
const PAIR_SYNASTRY_CACHE = new Map();
const PAIR_SYNASTRY_INFLIGHT = new Map();
const PAIR_SYNASTRY_CACHE_MAX = 8;
const PAIR_SYNASTRY_TTL_MS = 30 * 60 * 1000;
// 西洋合盘按「本人盘」口径起两盘(与合盘页一个左栏管两盘同):宫制 / 黄道 / 岁差 / 古典口径都取 A
function pairSynastryCalibreOf(recordA){
	const a = recordA || {};
	const fo = buildFieldObject(a);
	return {
		hsys: (a.hsys !== undefined && a.hsys !== null) ? a.hsys : 1,
		zodiacal: a.zodiacal || 0,
		siderealAyanamsa: a.siderealAyanamsa || '',
		classical: relativeClassicalParamsOf(fo),
	};
}
function pairSynastryKey(recordA, recordB){
	const sig = (r)=>['birth', 'zone', 'lat', 'lon'].map((k)=>`${(r && r[k] != null) ? r[k] : ''}`).join('|');
	const calibre = mountCalibreSignature();
	let cal = '';
	try{ cal = JSON.stringify(pairSynastryCalibreOf(recordA)); }catch(e){ cal = ''; }
	return [sig(recordA), sig(recordB), cal, calibre].join('#');
}
// opts.optionsA / optionsB:两人各自的本次挂载设置(按技法键);西洋合盘取星盘那一门(astrochart / astrochart_like)的覆盖
export async function getPairSynastryText(recordA0, recordB0, opts = {}){
	if(!recordA0 || !recordB0){ return ''; }
	const westKey = (o)=>(o && o.astrochart ? 'astrochart' : (o && o.astrochart_like ? 'astrochart_like' : 'astrochart'));
	const recordA = pairRecordFor(recordA0, westKey(opts.optionsA), opts.optionsA);
	const recordB = pairRecordFor(recordB0, westKey(opts.optionsB), opts.optionsB);
	const build = typeof opts.build === 'function' ? opts.build : buildRelativeSnapshotForRecords;   // 测试缝
	const now = typeof opts.now === 'function' ? opts.now() : Date.now();
	try{ await ensureRelativeClassicalLoaded(); }catch(e){ /* 分包载不了:按空古典段(构造里同样取不到) */ }
	const key = pairSynastryKey(recordA, recordB);
	const hit = PAIR_SYNASTRY_CACHE.get(key);
	if(hit && now - hit.at < PAIR_SYNASTRY_TTL_MS){ return hit.text; }
	if(PAIR_SYNASTRY_INFLIGHT.has(key)){ return PAIR_SYNASTRY_INFLIGHT.get(key); }
	const job = (async ()=>{
		let text = '';
		try{ text = `${(await build(recordA, recordB)) || ''}`; }catch(e){ text = ''; }
		if(text.trim()){
			PAIR_SYNASTRY_CACHE.set(key, { text, at: now });
			while(PAIR_SYNASTRY_CACHE.size > PAIR_SYNASTRY_CACHE_MAX){ PAIR_SYNASTRY_CACHE.delete(PAIR_SYNASTRY_CACHE.keys().next().value); }
		}
		return text;
	})();
	PAIR_SYNASTRY_INFLIGHT.set(key, job);
	try{ return await job; }finally{ PAIR_SYNASTRY_INFLIGHT.delete(key); }
}
export function __resetPairSynastryCacheForTests(){ PAIR_SYNASTRY_CACHE.clear(); PAIR_SYNASTRY_INFLIGHT.clear(); }

export async function buildRelativeSnapshotForRecords(recordA, recordB){
	if(!recordA || !recordB) return '';
	const mk = (r)=>{ const [d, t] = `${(r && r.birth) || ''}`.split(' '); return { date: d || '', time: t || '', zone: (r && r.zone) || '', lat: (r && r.lat) || '', lon: (r && r.lon) || '' }; };
	// 与合盘页同一请求口径:宫制 / 黄道 / 岁差 + 古典口径段(界系 / 三分 / 交点 / 自定义岁差历元等;默认不下发 = 请求体零回归)
	await ensureRelativeClassicalLoaded();
	const cal = pairSynastryCalibreOf(recordA);
	const headerParams = { hsys: cal.hsys, zodiacal: cal.zodiacal, siderealAyanamsa: cal.siderealAyanamsa, unifiedByA: true };
	const fetchOne = async (relativeCode, currentTab)=>{
		const params = { inner: mk(recordA), outer: mk(recordB), hsys: cal.hsys, zodiacal: cal.zodiacal, siderealAyanamsa: cal.siderealAyanamsa, relative: relativeCode, ...cal.classical };
		let data;
		try { data = await request(`${Constants.ServerRoot}/modern/relative`, { body: JSON.stringify(params), silent: true }); }
		catch(_){ return ''; }
		if(!data || data[Constants.ResultKey] === undefined || data[Constants.ResultKey] === null) return '';
		try { const buildRelativeSnapshotText = await loadBuildRelativeSnapshotText(); return buildRelativeSnapshotText({ currentTab, result: data[Constants.ResultKey], chartA: { record: recordA }, chartB: { record: recordB }, params: headerParams }); }
		catch(_){ return ''; }
	};
	// 关系量化(分数)走独立 /astroextra/relative(返回 {score,highlights,challenges,aspects},非 /modern/relative)。
	const fetchScore = async ()=>{
		const params = { inner: mk(recordA), outer: mk(recordB), hsys: (recordA && recordA.hsys !== undefined && recordA.hsys !== null) ? recordA.hsys : 1, zodiacal: (recordA && recordA.zodiacal) || 0, siderealAyanamsa: (recordA && recordA.siderealAyanamsa) || '' };
		let data;
		try { data = await request(`${Constants.ServerRoot}/astroextra/relative`, { body: JSON.stringify(params), silent: true }); }
		catch(_){ return ''; }
		if(!data || data[Constants.ResultKey] === undefined || data[Constants.ResultKey] === null) return '';
		try { const buildRelativeSnapshotText = await loadBuildRelativeSnapshotText(); return buildRelativeSnapshotText({ currentTab: 'Score', result: data[Constants.ResultKey], chartA: { record: recordA }, chartB: { record: recordB }, params: headerParams }); }
		catch(_){ return ''; }
	};
	const comp = await fetchOne(0, 'Comp');            // 比较盘:互摄相位/中点相位/映点
	const composite = await fetchOne(1, 'Composite');  // 组合盘:复合图盘
	const synastry = await fetchOne(2, 'Synastry');    // 影响盘:双盘叠加
	const scoreTxt = await fetchScore();               // 关系量化:契合分数+顺畅/张力 top 相位
	const stripHeader = (txt)=>{ const i = `${txt || ''}`.indexOf('\n['); return i > 0 ? `${txt}`.slice(i + 1) : `${txt || ''}`; }; // 去重复的 [关系起盘信息] 段(仅留首份)
	const parts = [];
	if(comp && comp.trim()) parts.push(comp);
	[composite, synastry, scoreTxt].forEach((t)=>{ if(t && t.trim()) parts.push(parts.length ? stripHeader(t) : t); });
	return parts.join('\n\n');
}
