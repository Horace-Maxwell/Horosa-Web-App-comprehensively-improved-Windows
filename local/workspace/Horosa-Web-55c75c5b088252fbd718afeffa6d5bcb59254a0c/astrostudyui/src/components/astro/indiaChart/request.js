// 印占取盘:页面字段 → 请求参数、缓存键与请求去重缓存
// 从 IndiaChart.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { registerProcessCache } from '../../../utils/processCacheRegistry';
import DateTime from '../../comp/DateTime';
import * as AstroConst from '../../../constants/AstroConst';
import request from '../../../utils/request';
import * as Constants from '../../../utils/constants';
import { INDIA_TABLE_SETTINGS } from '../../../utils/indiaExtraTables';

const indiaChartCache = new Map();
const INDIA_CHART_CACHE_MAX = 64;   // LRU 上限:印占 payload 大(yogas+多级dasha+varga+shadbala),会话内键空间随分盘/过运日/大运派别/ayanamsa 发散,须封顶防越用越占内存(全仓唯一曾漏上限者)。
const indiaChartInflight = new Map();
registerProcessCache('india.chart', ()=>{ indiaChartCache.clear(); indiaChartInflight.clear(); });
// v5:引擎新增 sensitivePoints 顶层键 + 服务层挂 sarvatobhadra/prashna(opt-in)/年长参数化。
// 🔴 凡引擎输出加新键必升此版 —— 否则 LRU 里旧缓存缺新键,右栏新面板静默空盘
//    (hasCurrentJyotishPayload 只查 jyotish.yogas,抓不到缺键)。
// v7:大运+行运补齐——引擎新增 chakra/trikona/navamsaDasha/varnada/paryaya/taraDasha/akkg/
// ayurdayaFinal/fromSun/dashaLink/annualYogini/tripatakiNak 九曜等输出键 + dashaVariants 流派开关。
// v9:六力只出六源式(粗估层删)、KP 意义星按标准四级 + 恒 D1、星期按日出换日、Choghadia 夜段 / Panchaka
// 公式订正、宿名单源、子运起讫带精确 ISO、过运默认日恒进请求。
// v10:引擎新增 yogaTable / extraTables 两个顶层键(Yoga 判定表与补充表)。
const INDIA_CHART_CACHE_REV = 'india_kernel_v10_tables';

// 过运缺省日 = 「今日」按本盘时区(DateTime.wallClockForChart;不给时区 = 本机今日,原样)
export function localTodaySlash(zone){
	const d = DateTime.wallClockForChart(zone);
	const pad = (n)=>(n < 10 ? `0${n}` : `${n}`);
	return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

export function fieldsToParams(fields, overrides = {}){
	const indiaHsys = overrides.indiaHsys !== undefined && overrides.indiaHsys !== null
		? AstroConst.normalizeIndiaHouseSystem(overrides.indiaHsys)
		: (fields.indiaHsys ? AstroConst.normalizeIndiaHouseSystem(fields.indiaHsys.value) : AstroConst.INDIA_HOUSE_SYSTEM_DEFAULT);
	const indiaAyanamsa = overrides.indiaAyanamsa !== undefined && overrides.indiaAyanamsa !== null
		? AstroConst.normalizeIndiaAyanamsa(overrides.indiaAyanamsa)
		: (fields.indiaAyanamsa ? AstroConst.normalizeIndiaAyanamsa(fields.indiaAyanamsa.value) : AstroConst.INDIA_AYANAMSA_DEFAULT);
	const indiaNodeType = overrides.indiaNodeType !== undefined && overrides.indiaNodeType !== null
		? AstroConst.normalizeIndiaNodeType(overrides.indiaNodeType)
		: (fields.indiaNodeType ? AstroConst.normalizeIndiaNodeType(fields.indiaNodeType.value) : AstroConst.INDIA_NODE_TYPE_DEFAULT);
	const params = {
		date: fields.date.value.format('YYYY/MM/DD'),
		time: fields.time.value.format('HH:mm:ss'),
		ad: fields.ad.value,
		zone: fields.zone.value,
		lat: fields.lat.value,
		lon: fields.lon.value,
		gpsLat: fields.gpsLat.value,
		gpsLon: fields.gpsLon.value,
		hsys: indiaHsys,
		indiaHsys,
		indiaAyanamsa,
		ayanamsa: indiaAyanamsa,
		siderealMode: indiaAyanamsa,
		_jyotishRev: INDIA_CHART_CACHE_REV,
		zodiacal: 1,
		tradition: fields.tradition.value,
		predictive: 0,
	};

	if(fields.chartnum){
		params.chartnum = fields.chartnum.value;
	}

	// 仅非默认('true')才下发,默认 mean 保持与历史请求一致(零缓存 churn / 零回归)。
	if(indiaNodeType === 'true'){
		params.nodeType = 'true';
	}

	// 印度功能扩展可选参数：分盘集/过运日期/年度盘(年份+近似)/大运派别。
	// 仅在 overrides 或对应字段提供时下发；缺省 undefined → 不入请求体与 cache key(零 churn)。
	const pickOpt = (key, field)=>{
		if(overrides[key] !== undefined && overrides[key] !== null){
			return overrides[key];
		}
		return (fields[field] && fields[field].value !== undefined && fields[field].value !== null)
			? fields[field].value : undefined;
	};
	// vargaSet 不再下发:后端为每个分盘再算整份 jyotish 挂 jyotishByVarga,前端全仓零读者(默认四盘每次响应多约 2.1 MB);
	// 页面分盘网格自行按 indiaVargaSet 渲染,与请求无关。
	const transitDate = pickOpt('transitDate', 'indiaTransitDate');
	// 过运日恒下发(未选 = 本地今天):进前端 LRU 与后端参数缓存键,跨日后不再拿到前一天的过运 / Tara / Sade Sati。
	params.transitDate = transitDate || localTodaySlash(params.zone);
	const tajakaYear = pickOpt('tajakaYear', 'indiaTajakaYear');
	// 年度盘(Varshaphal)默认取当前公历年(用户未显式选年时);随过运盘同为服务器侧轻量补算。
	params.tajakaYear = tajakaYear || DateTime.wallClockForChart(params.zone).getFullYear();   // 「今年」按本盘时区
	// tajakaApprox 双端死键已删;另七键(日界两键 / strongRecption / simpleAsp / virtualPointReceiveAsp / name / pos)
	// Java 未登记转发、Python india 包零引用 → 不再下发、不进缓存键(此前全局开关或盘名变化会让同一印度盘重取)。
	const dashaSystem = pickOpt('dashaSystem', 'indiaDashaSystem');
	// taraDasha/akkg 为前端展示体系(数据恒在响应):不下发 → 与默认树同缓存键、零额外请求。
	if(dashaSystem && AstroConst.INDIA_DASHA_DISPLAY_ONLY_SYSTEMS.indexOf(dashaSystem) < 0){
		params.dashaSystem = dashaSystem;
	}
	// 大运起点(seed):仅非默认 'moon' 才下发 → 默认 moon 零 cache churn / 零回归。
	const dashaSeed = pickOpt('dashaSeed', 'indiaDashaSeed');
	if(dashaSeed && dashaSeed !== 'moon'){ params.dashaSeed = dashaSeed; }
	// Sthira 起座:仅非默认 'lagna' 才下发 → 默认零 cache churn / 零回归。
	const sthiraStart = pickOpt('sthiraStart', 'indiaSthiraStart');
	if(sthiraStart && sthiraStart !== 'lagna'){ params.sthiraStart = sthiraStart; }
	// 大运年长(G5,§10.1.5):仅非默认 365.25 才下发 → 默认零 cache churn / 输出字节零回归。
	const dashaYearLength = pickOpt('dashaYearLength', 'indiaDashaYearLength');
	if(dashaYearLength && Math.abs(Number(dashaYearLength) - 365.25) > 1e-6){
		params.dashaYearLength = Number(dashaYearLength);
	}
	// 年盘口径(G13,§15.3):仅 'tithi' 才下发(varsha=默认零 churn)。
	const annualChartType = pickOpt('annualChartType', 'indiaAnnualChartType');
	if(annualChartType === 'tithi'){ params.annualChartType = 'tithi'; }
	// 大运流派开关(21 枚举键单 JSON 对象):仅非默认键下发 → 全默认零 cache churn/字节零回归。
	const dashaVariantsRaw = pickOpt('dashaVariants', 'indiaDashaVariants');
	const dashaVariantsSer = AstroConst.serializeIndiaDashaVariants(dashaVariantsRaw);
	if(dashaVariantsSer){ params.dashaVariants = dashaVariantsSer; }
	// 年盘地点(居住地)可选覆盖:仅两者齐备才下发。
	const varshaLat = pickOpt('varshaLat', 'indiaVarshaLat');
	const varshaLon = pickOpt('varshaLon', 'indiaVarshaLon');
	if(varshaLat !== undefined && varshaLat !== null && varshaLat !== ''
		&& varshaLon !== undefined && varshaLon !== null && varshaLon !== ''){
		params.varshaLat = varshaLat;
		params.varshaLon = varshaLon;
	}
	// 分盘变体(W1-A):形状 {"2":"parivritti",...},仅含非 standard 项才下发(JSON 串,同 vargaSet 范式)。
	const vargaVariant = pickOpt('vargaVariant', 'indiaVargaVariant');
	if(vargaVariant){
		const vvStr = typeof vargaVariant === 'string' ? vargaVariant : JSON.stringify(vargaVariant);
		if(vvStr && vvStr !== '{}'){ params.vargaVariant = vvStr; }
	}
	// Chara Karaka 方案(W1-B):仅 '7'(古典)才下发;'8' 默认零 churn。
	const karakaScheme = pickOpt('karakaScheme', 'indiaKarakaScheme');
	if(String(karakaScheme) === '7'){ params.karakaScheme = '7'; }
	// 星曜战判据(W1-C):仅 'longitude' 才下发;'latitude' 默认零 churn。
	const yuddhaCriterion = pickOpt('yuddhaCriterion', 'indiaYuddhaCriterion');
	if(yuddhaCriterion === 'longitude'){ params.yuddhaCriterion = 'longitude'; }
	// 三旗盘(G8,opt-in):12 次建盘较重,仅面板显式开启才带。
	const tripataki = pickOpt('tripataki', 'indiaTripataki');
	if(tripataki){ params.tripataki = 1; }
	// 问事族(G1/G12):🔴「起卦」必须是显式动作 —— prashnaTime 是一次性冻结的字符串
	// (绝不 render 时取 now,否则缓存键每秒变一次)。未起卦不下发任何 prashna* 键
	// → buildIndiaChartCacheKey 与今日逐字一致(零 churn 契约)。
	const prashnaTime = pickOpt('prashnaTime', 'indiaPrashnaTime');
	if(prashnaTime){
		params.prashnaTime = prashnaTime;
		// KP 问时数:齿轮缺省 1 被 prune 剪掉 → 无头不发 → 后端 missing_or_invalid_number → AI「问事」段恒无 KP;
		// 页面 castPrashna 恒发 1,此处同源:起了卦而数缺/非法 → 1。
		const prashnaNumber = pickOpt('prashnaNumber', 'indiaPrashnaNumber');
		const _pn = Number(prashnaNumber);
		params.prashnaNumber = (Number.isFinite(_pn) && _pn >= 1 && _pn <= 249) ? _pn : 1;
		const prashnaMatter = pickOpt('prashnaMatter', 'indiaPrashnaMatter');
		if(prashnaMatter){ params.prashnaMatter = prashnaMatter; }
		const prashnaSchools = pickOpt('prashnaSchools', 'indiaPrashnaSchools');
		if(prashnaSchools){ params.prashnaSchools = prashnaSchools; }
		const prashnaCuspMode = pickOpt('prashnaCuspMode', 'indiaPrashnaCuspMode');
		if(prashnaCuspMode && prashnaCuspMode !== 'asc_driven_placidus'){ params.prashnaCuspMode = prashnaCuspMode; }
		const prashnaPrimaryHouse = pickOpt('prashnaPrimaryHouse', 'indiaPrashnaPrimaryHouse');
		if(prashnaPrimaryHouse){ params.prashnaPrimaryHouse = Number(prashnaPrimaryHouse); }
	}

	return params;
}

// PERF-R8 P2(数据层空闲预热):预热参数的权威入口 —— 复刻「组件默认态首点」的参数构造。
// 与纯 fieldsToParams(fields) 的唯一差异是 dashaSystem:IndiaChartMain.withIndiaOptionFields
// 首点恒带默认大运体系(state.dashaSystem || 'vimshottari'),而 dva 默认 fields 不含该键 →
// 不带则 cache key 差一项、预热必 miss。其余默认(seed=moon/sthira=lagna/nodeType=mean)两
// 路径同为「不下发」,tajakaYear 同函数取当前年,天然一致。预热与首点 key/body 逐字节相同。
// 第二处差异(v3.14.0 起):页面构造时读保存的中栏盘面,上次停在三旗盘 ⇒ 首点就带 tripataki=1
// (IndiaChartMain 的 indiaTripatakiOn 初值);预热读同一份保存值同带,否则这批用户键差一项、预热白打一发。
export function buildIndiaWarmParams(fields){
	const overrides = { dashaSystem: AstroConst.INDIA_DASHA_SYSTEM_DEFAULT };
	try{
		const saved = INDIA_TABLE_SETTINGS.load() || {};
		if(AstroConst.normalizeIndiaStageMode(saved.indiaStageMode) === 'tripataki'){ overrides.tripataki = 1; }
	}catch(e){
		// 读不到保存值 = 按出厂盘面(不带 tripataki)预热
	}
	return fieldsToParams(fields, overrides);
}

export function resolveIndiaFractal(chartnum, hook){
	let fractal = parseInt(chartnum, 10);
	if(Number.isNaN(fractal) || fractal <= 0){
		if(hook && hook.fractal){
			fractal = parseInt(hook.fractal, 10);
		}
	}
	if(Number.isNaN(fractal) || fractal <= 0){
		fractal = 1;
	}
	return fractal;
}

export function resolveIndiaLabel(fractal, hook){
	if(hook && hook.txt){
		return hook.txt;
	}
	if(fractal === 1){
		return '命盘';
	}
	return `${fractal}分盘`;
}

export function buildIndiaChartCacheKey(params){
	if(!params){
		return '';
	}
	const normalized = {
		date: params.date || '',
		time: params.time || '',
		ad: params.ad,
		zone: params.zone,
		lat: params.lat,
		lon: params.lon,
		gpsLat: params.gpsLat,
		gpsLon: params.gpsLon,
		hsys: params.hsys,
		indiaHsys: params.indiaHsys,
		indiaAyanamsa: params.indiaAyanamsa || AstroConst.INDIA_AYANAMSA_DEFAULT,
		nodeType: params.nodeType || AstroConst.INDIA_NODE_TYPE_DEFAULT,
		jyotishRev: params._jyotishRev || INDIA_CHART_CACHE_REV,
		zodiacal: params.zodiacal,
		tradition: params.tradition,
		predictive: params.predictive,
		chartnum: params.chartnum || 1,
		// 扩展可选参数：未提供时为 undefined → JSON.stringify 自动略过 → 既有请求 cache key 不变。
		transitDate: params.transitDate,
		tajakaYear: params.tajakaYear,
		dashaSystem: params.dashaSystem,
		dashaSeed: params.dashaSeed,
		sthiraStart: params.sthiraStart,
		// G5/G13/G8/G1:新设置不进此处 = 切了设置不重算(本模块最易犯的坑)。
		// 全为条件下发键:缺省 undefined → JSON.stringify 略过 → 既有缓存键逐字不变。
		dashaYearLength: params.dashaYearLength,
		vargaVariant: params.vargaVariant,
		karakaScheme: params.karakaScheme,
		yuddhaCriterion: params.yuddhaCriterion,
		annualChartType: params.annualChartType,
		tripataki: params.tripataki,
		prashnaTime: params.prashnaTime,
		prashnaNumber: params.prashnaNumber,
		prashnaMatter: params.prashnaMatter,
		prashnaSchools: params.prashnaSchools,
		prashnaCuspMode: params.prashnaCuspMode,
		prashnaPrimaryHouse: params.prashnaPrimaryHouse,
		dashaVariants: params.dashaVariants,
		varshaLat: params.varshaLat,
		varshaLon: params.varshaLon,
	};
	return JSON.stringify(normalized);
}

function hasCurrentJyotishPayload(result){
	return !!(result && result.jyotish && result.jyotish.yogas);
}

export async function requestIndiaChartData(params){
	const cacheKey = buildIndiaChartCacheKey(params);
	let result = indiaChartCache.get(cacheKey);
	if(result && !hasCurrentJyotishPayload(result)){
		indiaChartCache.delete(cacheKey);
		result = null;
	}
	if(!result){
		let inflight = indiaChartInflight.get(cacheKey);
		if(!inflight){
			inflight = request(`${Constants.ServerRoot}/india/chart`, {
				body: JSON.stringify(params),
				// silent:不触发全局工作区「载入中」满屏压暗遮罩。印度有 keep-stale(旧盘留存 + 「更新中…」角标)
				// + 首屏本地 dashaLoading/「等待排盘数据」占位,自带加载反馈;否则每次真重算都全屏 loading(用户报的)。
				silent: true,
			}).then((data)=>{
				if(!data || data[Constants.ResultKey] === undefined || data[Constants.ResultKey] === null){
					return null;
				}
				const resolved = data[Constants.ResultKey];
				if(resolved && hasCurrentJyotishPayload(resolved)){
					if(indiaChartCache.has(cacheKey)){ indiaChartCache.delete(cacheKey); }
					indiaChartCache.set(cacheKey, resolved);
					while(indiaChartCache.size > INDIA_CHART_CACHE_MAX){
						const oldest = indiaChartCache.keys().next().value;
						if(oldest === undefined){ break; }
						indiaChartCache.delete(oldest);
					}
				}
				return resolved;
			}).finally(()=>{
				indiaChartInflight.delete(cacheKey);
			});
			indiaChartInflight.set(cacheKey, inflight);
		}
		result = await inflight;
	}
	return result;
}
