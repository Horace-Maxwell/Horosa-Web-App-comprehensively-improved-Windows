// AI 助手·各流派择日搜索的适配表:黄历 / 八字 / 紫微 / 六壬 / 太乙 / 奇门(本机算)+ 七政 / 印度(本机服务算)。
// 与各择日页同一条件注册表、同一编译、同一扫描引擎;盘面口径 = 各择日宿主同一构参(工作台出厂参数;紫微读你的紫微设置、八字读八字页的南半球月令 / 命宫起法,与内嵌页同源;页面与本表共用同一函数),
// 用事人本命(可选)用各页自己的 resolveNatal 解析;后端两家与择日页同一按月切段编排。只读、不写任何记录。
// 奇门择日的盘面口径 = 内嵌奇门页的整套排盘设置(你在奇门页亲手设的,没存过 = 出厂值;与择日工作台首开播种同一口径)。
// 三式择日暂不在表内:每个样本同时排三盘,单次扫描很慢(见 unsupported 说明)。
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../dayBoundary';
import { indiaNatalPayload } from '../../divination/zeri/indiaZeriNatal';
import { wallTextToMs, msToWallText } from '../../divination/zeri/hourlyScanEngine';

export const ZERI_SCHOOLS = ['huangli', 'bazi', 'ziwei', 'liureng', 'taiyi', 'qimen', 'qizheng', 'india'];
export const ZERI_UNSUPPORTED = {
	sanshi: '三式择日每个样本同时排六壬 / 奇门 / 太乙三盘,外部调用暂不开放;请在择日页里搜',
};
// AI 一次搜索的跨度上限(天):逐时扫描的本机引擎压到一年内(外部调用有时间预算),逐日的黄历与后端两家同择日页
export const ZERI_AI_MAX_SPAN_DAYS = { huangli: 1830, bazi: 366, ziwei: 366, liureng: 366, taiyi: 366, qimen: 366, qizheng: 1830, india: 1830 };

function natalFromBirth(birth, zone, gender){
	const m = /^(-?\d{1,4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?/.exec(`${birth || ''}`.trim());
	if(!m){ return null; }
	return { date: m[1], time: `${m[2]}:${m[3] || '00'}`, zone: zone || '+08:00', gender: gender === 0 ? 0 : 1 };
}

const SPECS = {
	huangli: {
		label: '黄历择日', granularity: 'day', where: false, natal: false,
		async load(){
			const [ct, eng] = await Promise.all([import('../../divination/zeri/huangliZeriConditionTypes'), import('../../divination/zeri/huangliZeriScanEngine')]);
			return { registry: ct.HUANGLI_CONDITION_TYPES, compile: ct.compileHuangliTree, scan: eng.scanHuangli, explain: eng.explainHuangliAt, defaults: ()=>({}) };
		},
	},
	bazi: {
		label: '八字择日', granularity: 'hour', where: true, natal: true,
		async load(){
			const [ct, eng, host, opt, cal] = await Promise.all([import('../../divination/zeri/baziZeriConditionTypes'), import('../../divination/zeri/baziZeriScanEngine'), import('../../components/zeri/BaziZeriMain'), import('../baziStoredOpt'), import('../../divination/zeri/zeriPageCalibre')]);
			// 与八字择日宿主同一扫描口径:工作台出厂参数 + 八字页保存的南半球月令 / 命宫起法(内嵌八字页起盘就读这一份)
			const pageOpts = ()=>{ const o = {}; cal.BAZI_PAGE_SCAN_KEYS.forEach((k)=>{ o[k] = opt.storedBaziOptValue(k) || cal.BAZI_PAGE_FACTORY[k]; }); return o; };
			const calibreOf = (o)=>{ const d = cal.BAZI_PAGE_SCAN_KEYS.filter((k)=>o[k] !== cal.BAZI_PAGE_FACTORY[k]); return d.length ? `工作台出厂参数;八字页设置:${d.map((k)=>({ southMonth: '南半球月令对冲', minggongMethod: '命宫子平数法' })[k] || k).join(' · ')}` : '工作台出厂参数;八字页设置全缺省'; };
			return { registry: ct.BAZI_CONDITION_TYPES, compile: ct.compileBaziTree, scan: eng.scanBazi, explain: eng.explainBaziAt, resolveNatal: host.resolveNatal, defaults: ()=>({ ...host.baziZeriFullDefaultOptions(), ...pageOpts() }), calibreOf };
		},
	},
	ziwei: {
		label: '紫微择日', granularity: 'hour', where: true, natal: true,
		async load(){
			const [ct, eng, host, zs, zo] = await Promise.all([import('../../divination/zeri/ziweiZeriConditionTypes'), import('../../divination/zeri/ziweiZeriScanEngine'), import('../../components/zeri/ZiweiZeriMain'), import('../ziweiRecordSettings'), import('../../components/ziwei/ziweiOptions')]);
			// 与紫微择日宿主同一构参(ziweiZeriScanOptions):工作台出厂参数 + 你的紫微设置(无头没有内嵌页,读本机偏好 = 紫微页读的那一份)
			const engine = ()=>eng.ziweiEngineFromSettings(zs.currentZiweiSettings());
			return {
				registry: ct.ZIWEI_CONDITION_TYPES, compile: ct.compileZiweiTree, scan: eng.scanZiwei, explain: eng.explainZiweiAt,
				resolveNatal: (n)=>host.resolveNatal(n, eng.ziweiPageScanOptions(engine())),
				defaults: ()=>host.ziweiZeriScanOptions(host.ziweiZeriFullDefaultOptions(), engine()),
				calibreOf: (o)=>`工作台出厂参数;${zo.ziweiZeriCalibreText(o)}`,
			};
		},
	},
	liureng: {
		label: '六壬择日', granularity: 'hour', where: true, natal: true,
		async load(){
			const [ct, eng, host, layout, cal] = await Promise.all([import('../../divination/zeri/liurengZeriConditionTypes'), import('../../divination/zeri/liurengZeriScanEngine'), import('../../components/zeri/LiurengZeriMain'), import('../../components/lrzhan/main/castLayout'), import('../../divination/zeri/zeriPageCalibre')]);
			// 与六壬择日宿主同一构参:工作台出厂完整缺省(单源)+ 内嵌六壬页的页面口径键(择日内嵌页恒从出厂值起,不读保存值)
			const pageOpts = ()=>cal.pickKeys(layout.LIURENG_PAGE_SETTINGS.defaults(), cal.LIURENG_PAGE_SCAN_KEYS);
			return { registry: ct.LIURENG_CONDITION_TYPES, compile: ct.compileLiurengTree, scan: eng.scanLiureng, explain: eng.explainLiurengAt, resolveNatal: host.resolveNatal, defaults: ()=>({ ...host.liurengZeriFullDefaultOptions(), ...pageOpts() }) };
		},
	},
	taiyi: {
		label: '太乙择日', granularity: 'hour', where: true, natal: false,
		async load(){
			const [ct, eng, host, page] = await Promise.all([import('../../divination/zeri/taiyiZeriConditionTypes'), import('../../divination/zeri/taiyiZeriScanEngine'), import('../../components/zeri/TaiyiZeriMain'), import('../../components/taiyi/TaiYiMain')]);
			// 择日内嵌的太乙页恒从出厂缺省起(扫描口径钉死,不读保存值)→ 流派取出厂缺省,与择日页同
			const school = (page.TAIYI_PAGE_SETTINGS && page.TAIYI_PAGE_SETTINGS.defaults().school) || undefined;
			return { registry: ct.TAIYI_CONDITION_TYPES, compile: ct.compileTaiyiTree, scan: eng.scanTaiyi, explain: eng.explainTaiyiAt, defaults: ()=>({ ...(school ? { school: { ...school } } : {}), ...host.taiyiZeriFullDefaultOptions() }) };
		},
	},
	qimen: {
		label: '奇门择日', granularity: 'hour', where: true, natal: false,
		async load(){
			const [ct, eng, page] = await Promise.all([import('../../divination/zeri/qimenConditionTypes'), import('../../divination/zeri/qimenScanEngine'), import('../../components/dunjia/DunJiaMain')]);
			return { registry: ct.QIMEN_CONDITION_TYPES, compile: ct.compileQimenTree, scan: eng.scanQimen, explain: eng.explainQimenAt, defaults: page.dunjiaZeriOptions };
		},
	},
	qizheng: {
		label: '七政择日', granularity: 'remote', where: true, natal: false,
		async load(){
			const [ct, svc, host] = await Promise.all([import('../../divination/zeri/qizhengZeriConditionTypes'), import('../../services/electionScan'), import('../../components/zeri/QizhengZeriMain')]);
			// 工作台出厂完整缺省与七政择日宿主同一单源(此前手抄三键)
			return { registry: ct.QIZHENG_CONDITION_TYPES, compile: ct.compileQizhengTree, fetchScan: svc.fetchQizhengElectionScan, fetchExplain: svc.fetchQizhengElectionExplain, defaults: ()=>host.qizhengZeriFullDefaultOptions() };
		},
	},
	india: {
		label: '印度择日', granularity: 'remote', where: true, natal: 'moon',
		async load(){
			const [ct, svc, host] = await Promise.all([import('../../divination/zeri/indiaZeriConditionTypes'), import('../../services/electionScan'), import('../../components/zeri/IndiaZeriMain')]);
			// 工作台出厂完整缺省与印度择日宿主同一单源(此前手抄两键)
			return { registry: ct.INDIA_CONDITION_TYPES, compile: ct.compileIndiaTree, fetchScan: svc.fetchIndiaElectionScan, fetchExplain: svc.fetchIndiaElectionExplain, defaults: ()=>host.indiaZeriFullDefaultOptions() };
		},
	},
};

export function zeriSchoolMeta(school){
	const s = SPECS[school];
	return s ? { school, label: s.label, granularity: s.granularity, needsPlace: s.where, natal: s.natal, maxSpanDays: ZERI_AI_MAX_SPAN_DAYS[school] } : null;
}

const cache = new Map();
export async function loadZeriSchool(school){
	if(!SPECS[school]){ return null; }
	if(cache.has(school)){ return cache.get(school); }
	const impl = await SPECS[school].load();
	const out = { ...zeriSchoolMeta(school), ...impl };
	cache.set(school, out);
	return out;
}

// 本命:命盘档案 → 各页 resolveNatal 的入参;解析失败 = null(调用方报码)
export function natalArgsOfRecord(rec){
	if(!rec){ return null; }
	const g = rec.gender === 0 || rec.gender === '0' ? 0 : 1;
	return natalFromBirth(rec.birth, rec.zone, g);
}
export { natalFromBirth };

// 后端两家:与择日页同一请求体(时刻串带秒、地点、口径)+ 印度的本命月宿 / 月座
export function remotePayloadOf(school, cfg, geo, options, compiled, indiaNatal){
	const base = {
		startDate: cfg.startDate, startTime: `${cfg.startTime || '00:00'}:00`, endDate: cfg.endDate, endTime: `${cfg.endTime || '23:59'}:59`,
		zone: geo.zone || '+08:00', gpsLat: geo.gpsLat, gpsLon: geo.gpsLon, ...options, conditions: compiled,
	};
	if(school === 'india' && indiaNatal){
		const natal = indiaNatalPayload(indiaNatal.moonNak, indiaNatal.moonSign);   // 与择日页同一出处(月座后端 0..11)
		if(natal){ base.natal = natal; }
	}
	return base;
}

// 后端区间 → 与本机引擎同形的行(pickEnd = 末尾内缩一分钟;按扫描时区墙钟手算分钟数,不经本机时区)
export function normalizeRemoteRows(intervals){
	// 墙钟轴与本机扫描引擎同一单源(民用历:0–99 年不当 19xx、1582 以前儒略历;年补足 4 位)
	const wallMs = (s)=>wallTextToMs(`${s}`.replace('T', ' '));
	const fmt = (ms)=>msToWallText(ms);
	return (intervals || []).map((iv)=>{
		const sMs = wallMs(iv.start);
		const eMs = wallMs(iv.end);
		const ok = Number.isFinite(sMs) && Number.isFinite(eMs);
		return { start: iv.start, end: iv.end, pick: iv.pick, pickEnd: ok && eMs - sMs > 60000 ? fmt(eMs - 60000) : iv.pick, durationMin: ok ? Math.max(1, Math.round((eMs - sMs) / 60000)) : 1 };
	});
}
