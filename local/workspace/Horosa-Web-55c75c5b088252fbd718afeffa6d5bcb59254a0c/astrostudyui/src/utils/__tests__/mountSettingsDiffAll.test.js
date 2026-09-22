// [挂载自检 阶段3(a)] 🔴 全技法「设置 → 请求体/入参/全局键 → 快照内容」表驱动差分闸(把逐技法手写的 mountRequestDiff/
// mountPayloadDiff 泛化到 TECHNIQUE_SETTINGS_SCHEMA 全部有字段技法;新增齿轮忘接消费点当场红)。
// 判据(每个齿轮至少一例):
//   ① 覆盖必须被判:pruneOptionsToNonDefault(与 getAnalysisTechniqueContextWithOptions 同一判据)对
//      effectiveMountBaseline 剪不空——所有候选值都剪空=值不可表达/蒸发(病形①),红。
//   ② 覆盖必须留痕:相对缺省路径,四个观测面至少一面出现差分:
//      request=真实请求体(utils/request 默认导出 + 全局 fetch,JSON 扁平化逐路径比)·
//      args=判读引擎入参(runHorary/runElection 第三/第五参,卜卦/择时判读键只影响边缘课例,正文不必变;但正文可观测而逐字不变时只算弱证据,继续换候选 / 盘变体 / 兄弟上下文找正文差分)·
//      content=快照正文逐行比 · storage=C 类全局键写入。
//      四面皆可观测却无差分=死开关(红;DEAD_EXEMPT 可成文豁免,逐键理由)。
// 反假报四件(死开关审计铁律的机械化):
//   噪声:缺省路径跑两遍,两遍之间自然漂移的行/请求路径(此刻时刻、生成时间戳)记为噪声不计差分;
//   值依赖:一个候选值/一张盘看不出差分不算死——候选值(所有选项)× 盘变体(日界敏感 23:30、女命/闰月/阴日干)逐一试;
//   条件依赖:CONTEXT 表显式给出父条件(区间扫描要末点+步长联合、正传分支随流派、紫微小限随流年…),
//     showWhen 字段自动在兄弟字段里搜一枚令条件成立的上下文;还没有强证据的齿轮再穷举单兄弟上下文与 16 个日期兜底;
//   可观测性:后端(:9999/:8899)离线时只做①与 C 类,其余记 UNVERIFIED(不判红也不判绿);HOROSA_DIFFNET_OFFLINE=1 强制离线。
// 产物:HOROSA_DIFFNET_OUT=/abs/path.json 落全部齿轮判定(verdict/via/tries),供审计报告引用。
jest.setTimeout(3600000);
// jest.mock 工厂只许引用 mock* 前缀的惰性变量:捕获器用 var + 函数声明(提升),请求发生时才真访问
var mockCap = { bodies: [], storage: [], args: [] };
function mockPushBody(url, raw){
	let body = raw;
	if(typeof raw === 'string'){ try{ body = JSON.parse(raw); }catch(_e){ body = raw; } }
	mockCap.bodies.push({ url: `${url}`.replace(/^https?:\/\/[^/]+/, ''), body: body === undefined ? null : body });
}
function mockPushArgs(tag, opts){ mockCap.args.push({ url: `args:${tag}`, body: opts === undefined ? null : opts }); }
const CAP = mockCap;
jest.mock('../request', () => {
	const actual = jest.requireActual('../request');
	const wrapped = async (url, opts) => { try{ mockPushBody(url, opts && (opts.body !== undefined ? opts.body : opts.data)); }catch(_e){} return actual.default(url, opts); };
	return { __esModule: true, ...actual, default: wrapped };
});
// 请求面与进程内结果缓存:/chart 的内存缓存、共享 POST 缓存、术数端点缓存都在上面这个捕获点之上 —— 同体二次请求被缓存吸收、
// 不经捕获点,请求面就随「这个请求体本进程里是否出现过」漂移(两遍缺省一遍捕获一遍命中 → 整条请求被记成噪声,
// 请求证据静默失效;测试顺序一变,同一齿轮的判定与指纹就跟着翻)。差分闸里 /chart 一律直通,其余缓存每次取样前清空(结果逐值等价)。
jest.mock('../../services/astro', () => {
	const actual = jest.requireActual('../../services/astro');
	return { __esModule: true, ...actual, fetchChart: (values, requestOptions) => actual.fetchChart(values, { ...(requestOptions || {}), cache: false }) };
});
jest.mock('../../divination/horary/horaryEngine', () => {
	const actual = jest.requireActual('../../divination/horary/horaryEngine');
	return { __esModule: true, ...actual, runHorary: (result, category, opts) => { try{ mockPushArgs('runHorary', { category, opts }); }catch(_e){} return actual.runHorary(result, category, opts); } };
});
jest.mock('../../divination/election/electionEngine', () => {
	const actual = jest.requireActual('../../divination/election/electionEngine');
	return { __esModule: true, ...actual, runElection: (result, topicId, natal, mundane, opts) => { try{ mockPushArgs('runElection', { topicId, opts }); }catch(_e){} return actual.runElection(result, topicId, natal, mundane, opts); } };
});
// 入参面(args):本地引擎入口——值依赖齿轮(寄宫仅中宫数、值使取法仅值符天禽、贵人阴阳系仅特定日干、元运仅特定余数、闰法仅闰月十五子时…)
// 正文层在有限课例里不必变,但值必须到达引擎入参;引擎语义由各家金标(DunJiaCalc/JinKouCalc/heluoSwitches/zhengchuan/yizhangjing 测试)看守。
jest.mock('../../components/dunjia/DunJiaCalc', () => {
	const actual = jest.requireActual('../../components/dunjia/DunJiaCalc');
	return { __esModule: true, ...actual, calcDunJia: (fields, nongli, options, ctx) => { try{ mockPushArgs('calcDunJia', options); }catch(_e){} return actual.calcDunJia(fields, nongli, options, ctx); } };
});
jest.mock('../../components/jinkou/JinKouCalc', () => {
	const actual = jest.requireActual('../../components/jinkou/JinKouCalc');
	return { __esModule: true, ...actual, buildJinKouData: (liureng, opts) => { try{ mockPushArgs('buildJinKouData', opts); }catch(_e){} return actual.buildJinKouData(liureng, opts); } };
});
jest.mock('../heluoLocal', () => {
	const actual = jest.requireActual('../heluoLocal');
	return { __esModule: true, ...actual, calculate: (input) => { try{ mockPushArgs('heluoCalculate', input && input.opts); }catch(_e){} return actual.calculate(input); } };
});
jest.mock('../zhengchuanShaoziLocal', () => {
	const actual = jest.requireActual('../zhengchuanShaoziLocal');
	return { __esModule: true, ...actual, calcShaozi: (input) => { try{ mockPushArgs('calcShaozi', { yuan: input && input.yuan, fatherAge: input && input.fatherAge, motherAge: input && input.motherAge }); }catch(_e){} return actual.calcShaozi(input); } };
});
jest.mock('../yizhangjingReport', () => {
	const actual = jest.requireActual('../yizhangjingReport');
	return { __esModule: true, ...actual, buildYizhangjingModel: (...a) => { try{ mockPushArgs('buildYizhangjingModel', a[1]); }catch(_e){} return actual.buildYizhangjingModel(...a); } };
});
jest.mock('../../components/liureng/LRConst', () => {
	const actual = jest.requireActual('../../components/liureng/LRConst');
	return { __esModule: true, ...actual, getGuiZi: (chartObj, guirengType, isDiurnal, yinyangSystem) => { try{ mockPushArgs('getGuiZi', { guirengType, isDiurnal, yinyangSystem }); }catch(_e){} return actual.getGuiZi(chartObj, guirengType, isDiurnal, yinyangSystem); } };
});
jest.mock('../../components/lrzhan/LiuRengMain', () => {
	const actual = jest.requireActual('../../components/lrzhan/LiuRengMain');
	return { __esModule: true, ...actual, buildLiuRengCastOverride: (chartObj, opts) => { try{ mockPushArgs('buildLiuRengCastOverride', opts); }catch(_e){} return actual.buildLiuRengCastOverride(chartObj, opts); } };
});
jest.mock('../../components/gua/liuyaoFacade', () => {
	const actual = jest.requireActual('../../components/gua/liuyaoFacade');
	return { __esModule: true, ...actual, analyzeLiuyao: (gua, moving, ctx, settings) => { try{ mockPushArgs('analyzeLiuyao', settings); }catch(_e){} return actual.analyzeLiuyao(gua, moving, ctx, settings); } };
});
jest.mock('../localcharts', () => ({ listLocalCharts: jest.fn(() => []), __esModule: true }));
jest.mock('../localcases', () => ({ listLocalCases: jest.fn(() => []), getCaseTypeLabel: jest.fn((t) => t), getCaseTypeMeta: jest.fn(() => ({ module: '', value: '' })), CASE_TYPE_OPTIONS: [], __esModule: true }));
jest.mock('../moduleAiSnapshot', () => ({ loadModuleAISnapshot: jest.fn(() => null), saveModuleAISnapshot: jest.fn(), saveModuleAISnapshotLazy: jest.fn(), clearModuleAISnapshot: jest.fn(), loadModuleStructuredGT: jest.fn(() => null) }));
jest.mock('../aiAnalysisStore', () => ({ AI_ANALYSIS_STORES: { contextCache: 'contextCache' }, getStoreRecord: jest.fn(async () => null), putStoreRecord: jest.fn(async (s, r) => r) }));

import fs from 'fs';
import { getAnalysisTechniqueContextWithOptions, regenerateCaseTechniqueSnapshot, ANALYSIS_CHART_TECHNIQUES, ANALYSIS_CASE_TECHNIQUES } from '../aiAnalysisContext';
import { TECHNIQUE_SETTINGS_SCHEMA, effectiveMountBaseline, pruneOptionsToNonDefault } from '../techniqueMountSettings';
import { installFixedNow } from './fixtures/fixedNow';
import { classifyContentDelta, evidenceIsStrong } from './fixtures/diffEvidence';
import { clearRequestCache } from '../../services/_requestCache';
import { __ktCacheResetForTest } from '../kentangCache';
import { __clearDedupe } from '../requestDedupe';
function resetRequestCaches(){
	try{ clearRequestCache(); }catch(_e){ /* noop */ }
	try{ __ktCacheResetForTest(); }catch(_e){ /* noop */ }
	try{ __clearDedupe(); }catch(_e){ /* noop */ }
}
installFixedNow();   // [指纹包] HOROSA_FIXED_NOW 设了才钉住此刻(推运类缺省目标时刻=此刻);未设零副作用

const realFetch = global.fetch;
let ONLINE = false;
beforeAll(async ()=>{
	global.fetch = async (url, opts)=>{ try{ mockPushBody(url, opts && opts.body); }catch(_e){} return realFetch(url, opts); };
	const origSet = Storage.prototype.setItem;
	Storage.prototype.setItem = function(k, v){ CAP.storage.push(`${k}=${v}`); return origSet.call(this, k, v); };
	if(process.env.HOROSA_DIFFNET_OFFLINE === '1'){ ONLINE = false; return; }
	const probe = async (u)=>{ try{ const ctl = new AbortController(); const t = setTimeout(()=>ctl.abort(), 2500); const r = await realFetch(u, { signal: ctl.signal }); clearTimeout(t); return !!r; }catch(_e){ return false; } };
	const [a, b] = await Promise.all([probe('http://127.0.0.1:9999/'), probe('http://127.0.0.1:8899/')]);
	ONLINE = a && b;
});
afterAll(()=>{ global.fetch = realFetch; });

// 盘变体:V0 常规;V1 日界/晚子时/真太阳时敏感(23:30、经度远离时区中央经线);V2 女命·闰五月(1990)·另一日干奇偶
const CHART_VARIANTS = [
	{ cid: 'diff-chart', name: '差分', birth: '1990-05-18 10:00:00', zone: '+08:00', lon: '118e27', lat: '31n38', gpsLon: 118.45, gpsLat: 31.63, gender: 1, ad: 1 },
	{ cid: 'diff-chart-v1', name: '差分', birth: '1990-05-18 23:30:00', zone: '+08:00', lon: '120e00', lat: '31n38', gpsLon: 120, gpsLat: 31.63, gender: 1, ad: 1 },
	{ cid: 'diff-chart-v2', name: '差分', birth: '1990-07-05 04:30:00', zone: '+08:00', lon: '116e23', lat: '39n54', gpsLon: 116.38, gpsLat: 39.9, gender: 0, ad: 1 },
	{ cid: 'diff-chart-v3', name: '差分', birth: '1991-03-10 08:00:00', zone: '+08:00', lon: '113e15', lat: '23n07', gpsLon: 113.25, gpsLat: 23.12, gender: 0, ad: 1 },
	{ cid: 'diff-chart-v4', name: '差分', birth: '1988-04-25 03:20:00', zone: '+08:00', lon: '121e28', lat: '31n14', gpsLon: 121.47, gpsLat: 31.23, gender: 1, ad: 1 },
	{ cid: 'diff-chart-v5', name: '差分', birth: '1990-05-18 11:02:00', zone: '+08:00', lon: '100e00', lat: '31n38', gpsLon: 100, gpsLat: 31.63, gender: 1, ad: 1 },
	{ cid: 'diff-chart-v6', name: '差分', birth: '1990-07-07 00:30:00', zone: '+08:00', lon: '120e00', lat: '31n38', gpsLon: 120, gpsLat: 31.63, gender: 0, ad: 1 },
	// V7 南纬盘:南半球专属齿轮(southchart 只在 lat<0 生效)的唯一可观测变体;排在末位,强证据齿轮在前面变体即收尾,不触达。
	{ cid: 'diff-chart-v7', name: '差分', birth: '1990-05-18 10:00:00', zone: '+10:00', lon: '151e12', lat: '33s52', gpsLon: 151.2, gpsLat: -33.87, gender: 1, ad: 1 },
	// V8 星曜近战盘:1998-01-21 12:00 火木相距约 0.003°,按赤纬判木胜、按黄经判火胜 —— 星曜战判法齿轮的唯一可观测变体。
	{ cid: 'diff-chart-v8', name: '差分', birth: '1998-01-21 12:00:00', zone: '+08:00', lon: '118e27', lat: '31n38', gpsLon: 118.45, gpsLat: 31.63, gender: 1, ad: 1 },
].map((v)=>({ ...v, orbs: { Sun: 12, Moon: 12 } }));
const CASE_VARIANTS = [
	{ divTime: '2026-05-15 10:12:00', zone: '+08:00', lon: '120e00', lat: '30n00', gpsLon: 120, gpsLat: 30, gender: 1 },
	{ divTime: '2026-05-15 23:30:00', zone: '+08:00', lon: '100e00', lat: '30n00', gpsLon: 100, gpsLat: 30, gender: 1 },
	{ divTime: '2026-01-03 04:05:00', zone: '+08:00', lon: '116e23', lat: '39n54', gpsLon: 116.38, gpsLat: 39.9, gender: 0 },
	{ divTime: '2026-02-10 09:00:00', zone: '+08:00', lon: '120e00', lat: '30n00', gpsLon: 120, gpsLat: 30, gender: 1 },
	{ divTime: '2026-08-21 14:00:00', zone: '+08:00', lon: '113e15', lat: '23n07', gpsLon: 113.25, gpsLat: 23.12, gender: 0 },
	{ divTime: '2026-05-15 23:30:00', zone: '+08:00', lon: '120e00', lat: '30n00', gpsLon: 120, gpsLat: 30, gender: 1 },
	{ divTime: '2026-05-16 09:30:00', zone: '+08:00', lon: '120e00', lat: '30n00', gpsLon: 120, gpsLat: 30, gender: 1 },
	{ divTime: '2026-05-18 20:15:00', zone: '+08:00', lon: '120e00', lat: '30n00', gpsLon: 120, gpsLat: 30, gender: 0 },
	{ divTime: '2026-05-21 03:40:00', zone: '+08:00', lon: '120e00', lat: '30n00', gpsLon: 120, gpsLat: 30, gender: 1 },
];
// 问占型(冻结卦/牌/棋)事盘的最小存档 payload:无它则 builder 依纪律返空(绝不臆造),不是齿轮之过
const GUICE_CTX = { yearZhi: '辰', monthZhi: '午', year: 2000, hourZhi: '午', pillars: ['庚辰', '壬午', '丙申', '甲午'], dayGan: '丙' };
const SEED_PAYLOAD = {
	tarot: [
		{ options: { deckId: 'rws', spreadType: 'three', seed: '77', question: '差分' } },
		{ options: { deckId: 'rws', spreadType: 'celtic', seed: '78', question: '差分' } },
		{ options: { deckId: 'rws', spreadType: 'zodiac', seed: '79', question: '差分' } },
		{ options: { deckId: 'rws', spreadType: 'croix', seed: '80', question: '差分' } },
		{ options: { deckId: 'rws', spreadType: 'horseshoe', seed: '81', question: '差分' } },
		{ options: { deckId: 'thoth', spreadType: 'opening_of_key', seed: '82', question: '差分', settings: { sig: { mode: 'manual', gender: 'male', age: 30, sign: '', manualId: 'wands_king' } } } },
	],
	guice: [
		{ gua: { up: '离', lo: '兑', dongYao: 6, fa: 'time', steps: [] }, ctx: GUICE_CTX, options: {} },
		{ gua: { up: '坤', lo: '坤', dongYao: 5, fa: 'time', steps: [] }, ctx: GUICE_CTX, options: {} },
		{ gua: { up: '坎', lo: '艮', dongYao: 2, fa: 'time', steps: [] }, ctx: GUICE_CTX, options: {} },
		{ gua: { up: '乾', lo: '巽', dongYao: 4, fa: 'time', steps: [] }, ctx: { ...GUICE_CTX, yearZhi: '午', monthZhi: '子', year: 2014, hourZhi: '子', pillars: ['甲午', '丙子', '戊申', '壬子'], dayGan: '戊' }, options: {} },
	],
	lingqi: [{ counts: [1, 2, 3], options: {} }, { counts: [0, 4, 2], options: {} }, { counts: [3, 3, 3], options: {} }],
	geomancy: [
		{ options: { question: '差分', questionType: 'custom', seedMode: 'manual', seed: 12345, tradition: 'european_classical' } },
		{ options: { question: '差分', questionType: 'marriage', seedMode: 'manual', seed: 777, tradition: 'european_classical' } },
		{ options: { question: '差分', questionType: 'custom', seedMode: 'manual', seed: 4242, tradition: 'arabic' } },
	],
};
function seedOf(key, idx){ const s = SEED_PAYLOAD[key]; if(!s){ return {}; } return Array.isArray(s) ? s[idx % s.length] : s; }
function chartSrc(v){ return { id: `chart-${v.cid}`, sourceType: 'chart', record: { ...v } }; }
function caseSrc(key, v, idx){ return { id: `case-${key}-${idx}`, sourceType: 'case', record: { cid: `case-${key}-${idx}`, event: '差分', caseType: key, sourceModule: key, ...v, ad: 1, payload: JSON.stringify({ module: key, ...seedOf(key, idx) }) } }; }

// 显式父条件/联合条件(单拨该齿轮=现状是设计语义,不是死开关;须带上下文才可观测)
const SCAN_END = (f)=>(f.type === 'date' ? '2032-01-01' : '2032-01-01 00:00');
const CONTEXT = {
	'*.datetimeEnd': (schema)=>({ scanStep: 'y' }),
	'*.scanStep': (schema)=>({ datetimeEnd: SCAN_END(schema.fields.find((x)=>x.name === 'datetimeEnd') || {}) }),
	'zodialrelease.aiL1Idx': { aiMode: 'l2_in_l1' }, 'zodialrelease.aiL2Idx': { aiMode: 'l3_in_l2' }, 'zodialrelease.aiL3Idx': { aiMode: 'l4_in_l3' },
	'decennials.aiL1Idx': { aiMode: 'l2_in_l1' }, 'decennials.aiL2Idx': { aiMode: 'l3_in_l2' }, 'decennials.aiL3Idx': { aiMode: 'l4_in_l3' },
	// 晚子时·时柱进次日 只在「日界=24 点换日」下才有独立语义(23 点换日时次日干=当日干,两档同果)
	'*.lateZiHourUseNextDay': ()=>({ after23NewDay: 0 }),
	'germany.showEastPoint': { showHouseFrames: 0 },
	'indiachart.indiaVarshaLat': { indiaVarshaLon: '0w07', indiaTajakaYear: 2026 }, 'indiachart.indiaVarshaLon': { indiaVarshaLat: '51n30', indiaTajakaYear: 2026 },
	'shenyishu.manualHour': { hourSource: 'manual' }, 'shenyishu.manualSeason': { seasonSource: 'manual' },
	'wuzhao.manualSplits': { mode: 'day', manual: 1 }, 'wuzhao.gender': { mingZhi: '子' }, 'wuzhao.mingZhi': { gender: 'male' },
	'zhengchuan.zcFatherAge': { zcSchool: 'shaozi' }, 'zhengchuan.zcMotherAge': { zcSchool: 'shaozi' }, 'zhengchuan.zcYuan': { zcSchool: 'shaozi' },
	'zhengchuan.zcDayun': { zcSchool: 'dading' }, 'zhengchuan.zcXiaoyun': { zcSchool: 'dading' }, 'zhengchuan.zcSuijun': { zcSchool: 'dading' }, 'zhengchuan.zcAge': { zcSchool: 'dading' }, 'zhengchuan.zcDadingYear': { zcSchool: 'dading' },
	'zhengchuan.zcAskHourZhi': { zcSchool: 'liuqin' }, 'zhengchuan.zcEnv': { zcSchool: 'liuqin' },
	'zhengchuan.zcItem': { zcSchool: 'xinyi' }, 'zhengchuan.zcSound': { zcSchool: 'xinyi' }, 'zhengchuan.zcKe': { zcSchool: 'xinyi' }, 'zhengchuan.zcGong': { zcSchool: 'xinyi' }, 'zhengchuan.zcXqZhi': { zcSchool: 'xinyi' }, 'zhengchuan.zcXqYushu': { zcSchool: 'xinyi' },
	'ziwei.ziweiXiaoxianYinyang': { liunianSel: '2024' }, 'ziwei.sihuaCustomTable': { sihuaSchool: 'custom' }, 'ziwei.brightnessCustomTable': { brightnessSource: 'custom' }, 'ziwei.taiSuiRuGua': {}, 'ziwei.taiSuiRelatives': { taiSuiRuGua: 1 },
	'qimen.yueJiaQiJuType': { paiPanType: 1 }, 'qimen.keJiaFenDun': { paiPanType: 4 }, 'qimen.keZiZhengHuanShi': { paiPanType: 4 }, 'qimen.shuziReportNumber': { qijuMethod: 'shuzi' }, 'qimen.feiMenZhongCan': { school: '飞盘' }, 'qimen.feiMenZhongShow': { school: '飞盘', feiMenZhongCan: 0 }, 'qimen.showAnZhi': { anGanMode: 'dipan' }, 'qimen.jinhanMenPai': { paiPanType: 6 },
	'sanshiunited.yueJiaQiJuType': { paiPanType: 1 }, 'sanshiunited.keJiaFenDun': { paiPanType: 4 }, 'sanshiunited.keZiZhengHuanShi': { paiPanType: 4 }, 'sanshiunited.shuziReportNumber': { qijuMethod: 'shuzi' }, 'sanshiunited.feiMenZhongCan': { school: '飞盘' }, 'sanshiunited.feiMenZhongShow': { school: '飞盘', feiMenZhongCan: 0 }, 'sanshiunited.showAnZhi': { anGanMode: 'dipan' }, 'sanshiunited.jinhanMenPai': { paiPanType: 6 },
	'sixyao.guirenFa': { shenshaOn: 1 }, 'sixyao.benming': { shenshaOn: 1 }, 'sixyao.shenshaSet': { shenshaOn: 1 }, 'sixyao.shenshaBase': { shenshaOn: 1 },
	'indiachart.indiaPrashnaNumber': { indiaPrashnaTime: '2026/05/15 10:12:00' }, 'indiachart.indiaPrashnaMatter': { indiaPrashnaTime: '2026/05/15 10:12:00', indiaPrashnaNumber: 108 },
	// KP 问数段只在给了问时数时出(缺省问时数被 prune 剪掉即整段缺席),宫始法 / 主事宫落在该段 → 两键上下文带问时数
	'indiachart.indiaPrashnaSchools': { indiaPrashnaTime: '2026/05/15 10:12:00' }, 'indiachart.indiaPrashnaCuspMode': { indiaPrashnaTime: '2026/05/15 10:12:00', indiaPrashnaNumber: 108 }, 'indiachart.indiaPrashnaPrimaryHouse': { indiaPrashnaTime: '2026/05/15 10:12:00', indiaPrashnaNumber: 108 },
	'tarot.edVersion': { dignities: 1 },
	'guice.jiGongMode': { qiguaShu: 'houtian' },
	'zhengchuan.zcXqZhi': { zcSchool: 'xinyi', zcXqYushu: 3 }, 'zhengchuan.zcXqYushu': { zcSchool: 'xinyi' },
	'wuzhao.mode': { manual: 1, manualSplits: '17,9,4,3,2,1' },
	'yizhangjing.after23NewDay': { shenshaLayer: 1 }, 'yizhangjing.lateZiHourUseNextDay': { after23NewDay: 0, shenshaLayer: 1 },
	// 自定义钥匙率只在度数换算=User 时读(schema 无 showWhen;缺省 Ptolemy 上下文里只有请求体变 = 弱证据,不是死)
	'primarydirect.pdTimeKeyCustom': { pdTimeKey: 'User' },
	// 岁差只在恒星黄道下读(回归黄道上下文里只有请求体变 = 弱证据);v0 会把全部候选都试一遍(lahiri 恰为恒星制缺省,需后续候选)
	'*.siderealAyanamsa': { zodiacal: 1 },
};
// 观测到无差分但成文豁免(每项带理由;新增=显式决策):`技法.字段` → 理由
const DEAD_EXEMPT = {
	// 敦煌校录揲筮口径只对 mode=dunhuang 生效,而随机揲筮兆无头不复现(WuZhaoMain MOUNT_DETERMINISTIC_MODES 强制回落干支起例,F-29 拍板项):
	// 在挂载链上该档位到不了引擎是设计取舍,不是接线断;拍板放开随机兆复用后此豁免即撤。
	'wuzhao.shifaVariant': 'F-29:敦煌校录筮法口径只作用于「策数→五行」的现场揲筮;无头对存档按六位兆数直输复现(兆数已固化)、无存档兆数时回落干支起例,两路都不再揲策,筮法口径无处生效(成文)',
};
// 自由文本字段的有意义替代值(垃圾值被 builder 忽略=假死)
const TEXT_ALT = { qianThrows: '1,2,3,3,3,4', zhaoNums: '1,2,3,4,5,1', yanShuNum: '37', indiaVargaSet: '1,9', indiaVarshaLat: '51n30', indiaVarshaLon: '0w07',
	marketPreset: 'sse', dirLat: '51n30', dirLon: '0w07', dirZone: '+00:00', ke: '初刻', beijiKe: '1', beijiLookupCode: '1101', beijiKeyword: '财', nanjiSection: '子部', nanjiXiu: '張', nanjiPasswordCode: '天地玄黄',
	chunziKe: '3', chunziMansion: '室', chunziLookupCode: '1', chunziKeyword: '财', chunziTags: '财,官', liunianSel: '2024', zcDadingYear: 2020, indiaTajakaYear: 2026, zcSound: '月', zcXqYushu: 3, manualSplits: '17,9,4,3,2,1',
	sihuaCustomTable: JSON.stringify({ 甲: ['太阳', '武曲', '天机', '廉贞'] }), brightnessCustomTable: JSON.stringify({ 紫微: Object.fromEntries('子丑寅卯辰巳午未申酉戌亥'.split('').map((z)=>[z, '陷'])), 天机: Object.fromEntries('子丑寅卯辰巳午未申酉戌亥'.split('').map((z)=>[z, '陷'])) }), taiSuiRelatives: '午:母:female',
	zcAskGz: '甲子', zcDayun: '甲子', zcXiaoyun: '乙丑', zcSuijun: '丙寅', zcAskHourZhi: '午', zcEnv: '晴', zcKe: '二刻', zcGong: '坤', zcXqZhi: '丑', shuziReportNumber: '123' };

function optVal(o){ return (o && typeof o === 'object') ? o.value : o; }
function candidates(field, cur){
	const out = [];
	if(field.type === 'multiselect'){
		const opts = (field.options || []).map(optVal);
		out.push(opts.slice(0, 1), opts.slice(1, 2), opts.slice(0, 2), []);
		return out;
	}
	if(Object.prototype.hasOwnProperty.call(TEXT_ALT, field.name)){ out.push(TEXT_ALT[field.name]); }
	if(Array.isArray(field.options)){ field.options.forEach((o)=>out.push(optVal(o))); }
	if(field.type === 'switch' || typeof cur === 'boolean'){ out.push(0, 1, true, false); }
	if(field.type === 'number' || typeof cur === 'number'){ const n = Number(cur); out.push(Number.isFinite(n) ? n + 1 : 1, Number.isFinite(n) ? n - 1 : 2, 0, 3); }
	if(field.type === 'date'){ out.push('2032-01-01', '2001-01-01'); }
	if(field.type === 'datetime' || /datetime|targetDate|Date$/i.test(field.name)){ out.push('2032-01-01 00:00', '2001-01-01 01:01:00'); }
	if(field.type === 'time' || (/time/i.test(field.name) && field.type === 'text')){ out.push('01:01:00', '13:30:00'); }
	out.push(`${cur || 'x'}_alt`);
	return out;
}
function survivingCandidates(key, field, baseline, limit){
	const cur = baseline[field.name] !== undefined ? baseline[field.name] : field.default;
	const out = []; const seen = new Set();
	for(const v of candidates(field, cur)){
		const sig = JSON.stringify(v);
		if(seen.has(sig)){ continue; }
		seen.add(sig);
		const pruned = pruneOptionsToNonDefault(key, { [field.name]: v }, baseline);
		if(pruned && Object.keys(pruned).length){ out.push(v); if(out.length >= limit){ break; } }
	}
	return out;
}
function explicitContext(key, field, schema){
	const hit = CONTEXT[`${key}.${field.name}`] !== undefined ? CONTEXT[`${key}.${field.name}`] : CONTEXT[`*.${field.name}`];
	if(hit === undefined){ return undefined; }
	return typeof hit === 'function' ? hit(schema) : hit;
}
// showWhen 上下文:在兄弟字段里搜一枚单字段覆盖让条件成立
function autoContext(key, field, schema, baseline){
	const cond = field.showWhen || field.when;
	// 对象形 when({ method: 'kentang' }):父字段取到要求值即上下文(挂载抽屉同款判定 TechniqueSettingsFields);
	// 父值已满足 = {};父值不可表达(被 prune 剪空)= null(DEAD-COND)。
	if(cond && typeof cond === 'object' && !Array.isArray(cond)){
		const need = {};
		Object.keys(cond).forEach((k)=>{
			const sib = schema.fields.find((f)=>f.name === k) || {};
			const cur = baseline[k] !== undefined ? baseline[k] : sib.default;
			if(`${cur}` !== `${cond[k]}`){ need[k] = cond[k]; }
		});
		if(!Object.keys(need).length){ return {}; }
		try{ return Object.keys(pruneOptionsToNonDefault(key, need, baseline)).length ? need : null; }catch(_e){ return null; }
	}
	if(typeof cond !== 'function'){ return {}; }
	try{ if(cond(baseline)){ return {}; } }catch(_e){ return null; }
	for(const sib of schema.fields){
		if(sib.name === field.name || !Array.isArray(sib.options)){ continue; }
		for(const o of sib.options){
			const v = optVal(o);
			const d = { ...baseline, [sib.name]: v };
			try{ if(cond(d) && Object.keys(pruneOptionsToNonDefault(key, { [sib.name]: v }, baseline)).length){ return { [sib.name]: v }; } }catch(_e){ /* skip */ }
		}
	}
	return null;
}
function flattenBody(b, prefix, out){
	if(b === null || b === undefined || typeof b !== 'object'){ out.push(`${prefix}=${JSON.stringify(b)}`); return; }
	if(Array.isArray(b)){ b.forEach((x, i)=>flattenBody(x, `${prefix}[${i}]`, out)); if(!b.length){ out.push(`${prefix}=[]`); } return; }
	Object.keys(b).sort().forEach((k)=>flattenBody(b[k], prefix ? `${prefix}.${k}` : k, out));
}
function entriesOf(list){ const out = []; list.forEach((r)=>{ try{ flattenBody(r.body, r.url, out); }catch(_e){ out.push(`${r.url}=<unflattenable>`); } }); return out; }
function symDiff(a, b){ const A = new Set(a), B = new Set(b); const out = []; a.forEach((x)=>{ if(!B.has(x)){ out.push(x); } }); b.forEach((x)=>{ if(!A.has(x)){ out.push(x); } }); return out; }
function pathOf(entry){ return entry.split('=')[0]; }
function lines(txt){ return `${txt || ''}`.split('\n').map((l)=>l.trim()).filter(Boolean); }

async function runCtx(src, key, options){
	resetRequestCaches();
	CAP.bodies = []; CAP.storage = []; CAP.args = [];
	let ctx = null; let err = null;
	try{ ctx = await getAnalysisTechniqueContextWithOptions(src, key, options); }catch(e){ err = e; }
	return { content: `${(ctx && ctx.content) || ''}`.trim(), status: ctx ? ctx.status : 'throw', err, req: entriesOf(CAP.bodies), reqN: CAP.bodies.length, args: entriesOf(CAP.args), argsN: CAP.args.length, storage: CAP.storage.slice() };
}
// 事盘源无存档快照时缺省路径=missing(设计语义:不臆造);基线改用「缺省重算」(同一 regen 入口、未改 payload),与覆盖路径只差 options
async function runBase(src, key, ctxOv){
	if(Object.keys(ctxOv).length){ return runCtx(src, key, ctxOv); }
	const r = await runCtx(src, key, {});
	if(r.content || src.sourceType !== 'case'){ return r; }
	resetRequestCaches();
	CAP.bodies = []; CAP.storage = []; CAP.args = [];
	let txt = ''; let err = null;
	try{ const payload = JSON.parse(src.record.payload || '{}'); txt = await regenerateCaseTechniqueSnapshot(src.record, key, payload); }catch(e){ err = e; }
	return { content: `${txt || ''}`.trim(), status: txt ? 'regen-base' : 'missing', err, req: entriesOf(CAP.bodies), reqN: CAP.bodies.length, args: entriesOf(CAP.args), argsN: CAP.args.length, storage: CAP.storage.slice() };
}

const KEYS = Object.keys(TECHNIQUE_SETTINGS_SCHEMA).filter((k)=>{ const s = TECHNIQUE_SETTINGS_SCHEMA[k]; return s && s.kind !== 'sectionsOnly' && Array.isArray(s.fields) && s.fields.length; });
const ONLY = process.env.HOROSA_DIFFNET_ONLY ? process.env.HOROSA_DIFFNET_ONLY.split(',') : null;
const RESULTS = [];

describe('🔴 全技法齿轮差分闸(表驱动;后端在线时正文/请求/入参级,离线时只判蒸发)', ()=>{
	KEYS.filter((k)=>!ONLY || ONLY.includes(k)).forEach((key)=>{
		const schema = TECHNIQUE_SETTINGS_SCHEMA[key];
		const isChart = ANALYSIS_CHART_TECHNIQUES.includes(key) && !ANALYSIS_CASE_TECHNIQUES.includes(key);
		const chartLike = isChart || schema.kind === 'localStorage';
		// 双栖技法(同时是命盘类与事盘类:宿占 / 皇极)按事盘源跑时缺省路径恒 missing、正文面不可观测(AM-09 仪器盲区)
		// → 事盘变体之后追加命盘源变体,正文面才有基线可比(只增证据,判定口径不变)
		const isDual = ANALYSIS_CHART_TECHNIQUES.includes(key) && ANALYSIS_CASE_TECHNIQUES.includes(key);
		const variants = chartLike ? CHART_VARIANTS.map((v)=>chartSrc(v)) : CASE_VARIANTS.map((v, i)=>caseSrc(key, v, i)).concat(isDual ? CHART_VARIANTS.map((v)=>chartSrc(v)) : []);
		it(`${key}(${schema.kind},${schema.fields.length} 齿轮)`, async ()=>{
			const baseCache = {};
			const baseFor = async (vi, ctxOv)=>{
				const ck = `${vi}|${JSON.stringify(ctxOv)}`;
				if(!baseCache[ck]){
					const b1 = await runBase(variants[vi], key, ctxOv);
					const b2 = await runBase(variants[vi], key, ctxOv);
					const noiseLines = new Set(symDiff(lines(b1.content), lines(b2.content)));
					const seqOf = (txt)=>lines(txt).filter((l)=>!noiseLines.has(l)).join('\n');
					baseCache[ck] = {
						b1,
						noiseLines,
						noisePaths: new Set(symDiff(b1.req, b2.req).map(pathOf)),
						noiseArgs: new Set(symDiff(b1.args, b2.args).map(pathOf)),
						// 两遍缺省正文剔噪后行序不同 = 行序本身不稳定,此时不以「只换顺序」作证据
						seqNoisy: seqOf(b1.content) !== seqOf(b2.content),
					};
					// [指纹包] HOROSA_DIFFNET_DUMP_DIR:落缺省路径正文/请求/入参 + 噪声集(零回归对拍用;未设不产文件、判定不变)
					if(process.env.HOROSA_DIFFNET_DUMP_DIR){
						try{
							const tag = JSON.stringify(ctxOv).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
							const nb = baseCache[ck];
							fs.writeFileSync(`${process.env.HOROSA_DIFFNET_DUMP_DIR}/${key}__v${vi}${tag ? '__' + tag : ''}.txt`,
								`#STATUS ${b1.status}\n#CONTENT\n${b1.content}\n#REQ\n${b1.req.join('\n')}\n#ARGS\n${b1.args.join('\n')}\n#NOISE-LINES\n${[...nb.noiseLines].join('\n')}\n#NOISE-PATHS\n${[...nb.noisePaths].join('\n')}\n#NOISE-ARGS\n${[...nb.noiseArgs].join('\n')}\n`);
						}catch(_e){ /* ignore */ }
					}
				}
				return baseCache[ck];
			};
			// [指纹包] 落盘模式下每个盘变体的缺省路径都先算一遍:变体只在「找强证据」时才惰性计算,仪器一改(证据提前命中)
			// 某些变体就不再落盘 → 零回归对拍的覆盖面随仪器版本漂移。未设 DUMP_DIR 时不跑、判定不变。
			if(process.env.HOROSA_DIFFNET_DUMP_DIR && ONLINE){
				for(let vi = 0; vi < variants.length; vi += 1){ await baseFor(vi, {}); }
			}
			// 证据强度:正文里算法结果行变 / 引擎入参变 = 强;只有设置回显行里的取值字样变(label)、只有请求体变(request)、
			// 只有全局键写入(storage)= 弱(值被送出或写下,不证明被消费)。判定(verdict)照旧「任一命中即 OK」,强度另记 strength。
			const diffOf = (base, ov, field, cand, baseVal)=>{
				const storageHit = schema.kind === 'localStorage' && field.storageKey && ov.storage.some((s)=>s.indexOf(`${field.storageKey}=`) === 0);
				const reqDiff = ov.reqN > 0 && symDiff(ov.req, base.b1.req).some((e)=>!base.noisePaths.has(pathOf(e)));
				const argsDiff = ov.argsN > 0 && symDiff(ov.args, base.b1.args).some((e)=>!base.noiseArgs.has(pathOf(e)));
				const contentObservable = !!(base.b1.content && ov.content);
				const contentDiff = contentObservable && symDiff(lines(ov.content), lines(base.b1.content)).some((l)=>!base.noiseLines.has(l));
				const cls = contentDiff ? classifyContentDelta({ ovLines: lines(ov.content), baseLines: lines(base.b1.content), noise: base.noiseLines, field, cand, base: baseVal }) : null;
				const labelOnly = !!(cls && cls.labelOnly);
				// 行集合相等而行序不同(起座 / 排序类选项只改顺序):按正文面强证据记 order;缺省两遍行序本就不稳时不采信
				const seqA = contentObservable && !contentDiff ? lines(ov.content).filter((l)=>!base.noiseLines.has(l)) : null;
				const seqB = seqA ? lines(base.b1.content).filter((l)=>!base.noiseLines.has(l)) : null;
				const orderDiff = !!(seqA && !base.seqNoisy && seqA.join('\n') !== seqB.join('\n'));
				let orderSample;
				if(orderDiff){ const i = seqA.findIndex((l, j)=>l !== seqB[j]); orderSample = [`~${seqA[i]}`, `~${seqB[i]}`]; }
				const observable = contentObservable || ov.reqN > 0 || ov.argsN > 0 || (schema.kind === 'localStorage' && !!field.storageKey);
				// 入参差分只在正文不可观测时算强证据:正文可观测却逐字不变 = 算了但没进快照(引擎入参到了、结果没写进正文),记弱证据
				const strong = evidenceIsStrong({ contentDiff, labelOnly, orderDiff, argsDiff, contentObservable });
				const via = (contentDiff && !labelOnly) ? 'content' : (orderDiff ? 'order' : (argsDiff ? 'args' : (labelOnly ? 'label' : (reqDiff ? 'request' : (storageHit ? 'storage' : '-')))));
				return { hit: storageHit || contentDiff || orderDiff || reqDiff || argsDiff, strong, via, observable, contentObservable, sample: cls ? cls.sample : orderSample };
			};
			for(const field of schema.fields){
				const name = field.name;
				const rec = { key, name, verdict: 'OK', via: '-', tries: 0, value: undefined };
				RESULTS.push(rec);
				const baseline0 = effectiveMountBaseline(key, variants[0].record) || {};
				const explicit = explicitContext(key, field, schema);
				const ctxOv = explicit !== undefined ? explicit : autoContext(key, field, schema, baseline0);
				if(ctxOv === null){ rec.verdict = 'DEAD-COND'; continue; }
				const cands0 = survivingCandidates(key, field, { ...baseline0, ...ctxOv }, 6);
				if(!cands0.length){ rec.verdict = 'FAIL-OVERRIDE'; continue; }
				rec.value = cands0[0];
				if(!ONLINE && schema.kind !== 'localStorage'){ rec.verdict = 'UNVERIFIED-OFFLINE'; continue; }
				let found = false; let anyObservable = false; let lastNote = '';
				let weak = null; // 首个弱命中 { via, value, sample };强命中才结束搜索,弱命中继续找强证据(v0 试全部候选,其余变体各试首候选)
				const baseValOf = (bl)=>(Object.prototype.hasOwnProperty.call(ctxOv, name) ? ctxOv[name] : (Object.prototype.hasOwnProperty.call(bl, name) ? bl[name] : field.default));
				const noteWeak = (d, tag, value)=>{ if(!weak){ weak = { via: `${d.via}@${tag}`, value, sample: d.sample }; } };
				for(let vi = 0; vi < variants.length && !found; vi += 1){
					const baselineV = vi === 0 ? baseline0 : (effectiveMountBaseline(key, variants[vi].record) || {});
					const candsAll = vi === 0 ? cands0 : survivingCandidates(key, field, { ...baselineV, ...ctxOv }, 3);
					const cands = (weak && vi > 0) ? candsAll.slice(0, 1) : candsAll;
					if(!cands.length){ continue; }
					const base = await baseFor(vi, ctxOv);
					for(const cand of cands){
						const ov = await runCtx(variants[vi], key, { ...ctxOv, [name]: cand });
						rec.tries += 1;
						const d = diffOf(base, ov, field, cand, baseValOf(baselineV));
						anyObservable = anyObservable || d.observable;
						lastNote = `${base.b1.status}/${ov.status}${ov.err ? ' ' + ov.err.message : ''}`;
						if(d.hit && d.strong){ found = true; rec.via = `${d.via}@v${vi}`; rec.value = cand; if(d.sample){ rec.evidence = d.sample; } break; }
						if(d.hit){ noteWeak(d, `v${vi}`, cand); if(vi > 0){ break; } continue; }
						if(!d.observable){ break; }
					}
					if(!found && vi === 0 && anyObservable && explicit === undefined){
						// 穷举单兄弟上下文(每个 select/switch 兄弟 × 每个选项),抓「父条件未在 schema 声明」的条件齿轮。
						// 只要还没有强证据就搜(弱证据:回显 / 入参 / 请求 / 全局键都证不了被消费);此前门槛「缺省路径零请求 = 本地引擎」
						// 实际取决于请求是否被进程内缓存吸收 —— 捕获点改到缓存之外后,走后端的技法(十年大运、择时)再也进不了这里,
						// 5 个靠兄弟上下文找到正文差分的齿轮掉回弱证据(实抓),故门槛只看证据强度
						let budget = 160;
						for(const sib of schema.fields){
							if(found || budget <= 0 || sib.name === name || !Array.isArray(sib.options) || Object.prototype.hasOwnProperty.call(ctxOv, sib.name)){ continue; }
							for(const o of sib.options){
								if(found || budget <= 0){ break; }
								const sv = optVal(o);
								const ctx2 = { ...ctxOv, [sib.name]: sv };
								if(!Object.keys(pruneOptionsToNonDefault(key, { [sib.name]: sv }, baseline0)).length){ continue; }
								const base2 = await baseFor(0, ctx2);
								const ov2 = await runCtx(variants[0], key, { ...ctx2, [name]: cands0[0] });
								budget -= 1; rec.tries += 1;
								const d2 = diffOf(base2, ov2, field, cands0[0], baseValOf(baseline0));
								if(d2.hit && d2.strong){ found = true; rec.via = `${d2.via}@v0+${sib.name}=${JSON.stringify(sv)}`; rec.value = cands0[0]; if(d2.sample){ rec.evidence = d2.sample; } }
								else if(d2.hit){ noteWeak(d2, `v0+${sib.name}=${JSON.stringify(sv)}`, cands0[0]); }
							}
						}
					}
				}
				if(!found && anyObservable){
					// 值依赖兜底:同一齿轮扫 16 个日期/时点(含节气/立春/闰月/土旺/子时等敏感段),任一有正文差分即强证据(门槛同上,只看证据强度)
					const SWEEP_CHART = ['1985-02-05 12:00:00', '1986-08-08 23:15:00', '1987-11-30 06:40:00', '1989-01-28 17:05:00', '1992-03-21 00:30:00', '1993-06-21 15:45:00', '1995-09-23 09:10:00', '1997-12-22 21:20:00', '2000-02-04 04:00:00', '2003-07-18 13:30:00', '2006-10-08 19:50:00', '2009-04-20 02:15:00', '2012-05-05 11:11:00', '2015-01-05 23:59:00', '2018-08-23 08:08:00', '2021-12-07 16:16:00'];
					const SWEEP_CASE = ['2026-01-05 00:10:00', '2026-02-04 11:00:00', '2026-03-20 18:30:00', '2026-04-05 05:05:00', '2026-06-21 12:12:00', '2026-07-23 22:45:00', '2026-09-23 03:33:00', '2026-10-08 15:15:00', '2026-11-22 09:45:00', '2026-12-22 20:20:00', '2027-01-20 07:07:00', '2027-02-17 23:05:00', '2027-05-05 14:40:00', '2027-08-08 01:01:00', '2027-10-23 17:17:00', '2027-12-07 10:10:00'];
					const sweep = chartLike ? SWEEP_CHART : SWEEP_CASE;
					for(let si = 0; si < sweep.length && !found; si += 1){
						const base0 = variants[0];
						const rec0 = { ...base0.record, cid: `${base0.record.cid}-s${si}` };
						if(chartLike){ rec0.birth = sweep[si]; }else{ rec0.divTime = sweep[si]; }
						const srcS = { ...base0, id: `${base0.id}-s${si}`, record: rec0 };
						const b1 = await runBase(srcS, key, ctxOv);
						// 扫描点也取两遍缺省定噪声(走后端的技法会随扫描点带进此刻 / 生成时刻类行,不定噪声会把它们当正文差分)
						const b2 = await runBase(srcS, key, ctxOv);
						const ov = await runCtx(srcS, key, { ...ctxOv, [name]: cands0[0] });
						rec.tries += 1;
						const sweepNoise = { b1, noiseLines: new Set(symDiff(lines(b1.content), lines(b2.content))), noisePaths: new Set(symDiff(b1.req, b2.req).map(pathOf)), noiseArgs: new Set(symDiff(b1.args, b2.args).map(pathOf)) };
						const d = diffOf(sweepNoise, ov, field, cands0[0], baseValOf(baseline0));
						if(d.hit && d.strong){ found = true; rec.via = `${d.via}@sweep${si}`; rec.value = cands0[0]; if(d.sample){ rec.evidence = d.sample; } }
						else if(d.hit){ noteWeak(d, `sweep${si}`, cands0[0]); }
					}
				}
				if(found){ rec.verdict = 'OK'; rec.strength = 'strong'; continue; }
				// 成文豁免的齿轮只拿到弱证据(值进了请求体 / 回显行 / 全局键,正文逐字不变)时仍记豁免并留下弱证据路径:
				// 弱证据证明不了被消费,定性以豁免理由为准(否则请求面一变得可见,判定就在 EXEMPT 与 OK 之间随仪器版本翻)
				if(weak && DEAD_EXEMPT[`${key}.${name}`]){ rec.verdict = 'EXEMPT'; rec.note = DEAD_EXEMPT[`${key}.${name}`]; rec.weakVia = weak.via; rec.value = weak.value; continue; }
				if(weak){ rec.verdict = 'OK'; rec.strength = 'weak'; rec.via = weak.via; rec.value = weak.value; if(weak.sample){ rec.evidence = weak.sample; } continue; }
				if(!anyObservable){ rec.verdict = 'UNVERIFIED-EMPTY'; rec.note = lastNote; continue; }
				rec.verdict = DEAD_EXEMPT[`${key}.${name}`] ? 'EXEMPT' : 'FAIL-DEAD';
				rec.note = DEAD_EXEMPT[`${key}.${name}`] || lastNote;
			}
			const bad = RESULTS.filter((r)=>r.key === key && (r.verdict === 'FAIL-OVERRIDE' || r.verdict === 'FAIL-DEAD'));
			expect(bad.map((r)=>`${r.verdict} ${key}.${r.name}=${JSON.stringify(r.value)}`)).toEqual([]);
		});
	});

	it('汇总(非 OK 行打印/落盘;UNVERIFIED/DEAD-COND 不判红,供后端在线复核)', ()=>{
		const counts = RESULTS.reduce((a, r)=>{ a[r.verdict] = (a[r.verdict] || 0) + 1; return a; }, {});
		const strengthCounts = RESULTS.filter((r)=>r.verdict === 'OK').reduce((a, r)=>{ const k = r.strength === 'weak' ? `weak:${`${r.via}`.split('@')[0]}` : 'strong'; a[k] = (a[k] || 0) + 1; return a; }, {});
		const linesOut = [`DIFF-NET online=${ONLINE} 汇总 ${JSON.stringify(counts)} 总齿轮 ${RESULTS.length} 证据强度 ${JSON.stringify(strengthCounts)}`];
		RESULTS.filter((r)=>r.verdict !== 'OK').forEach((r)=>linesOut.push(`DIFF-NET ${r.verdict} ${r.key}.${r.name}=${JSON.stringify(r.value)} via=${r.via} tries=${r.tries}${r.note ? ' ' + r.note : ''}`));
		// eslint-disable-next-line no-console
		console.log(linesOut.join('\n'));
		if(process.env.HOROSA_DIFFNET_OUT){ try{ fs.writeFileSync(process.env.HOROSA_DIFFNET_OUT, JSON.stringify({ online: ONLINE, counts, strengthCounts, results: RESULTS }, null, 1)); }catch(_e){ /* ignore */ } }
		if(!ONLY){ expect(RESULTS.length).toBeGreaterThan(500); }
	});
});
