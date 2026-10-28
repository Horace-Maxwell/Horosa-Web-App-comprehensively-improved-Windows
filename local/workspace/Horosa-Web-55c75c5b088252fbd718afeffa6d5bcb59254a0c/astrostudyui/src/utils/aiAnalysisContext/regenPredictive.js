// AI 分析挂载上下文 · 推运快照:目标时刻型推运、构建器扫描、事盘时间标注。
// 由 utils/aiAnalysisContext.js 门面统一对外导出。
import DateTime from '../../components/comp/DateTime';
import { returnPickerSeed } from '../returnPickerSeed';
import request from '../request';
import * as Constants from '../constants';
import { classicalBackendOverridesFromPlain } from '../classicalChartGlobals';
import { buildPredictiveSnapshotText } from '../predictiveAiSnapshot';
import { SCAN_SEGMENT_CAP, buildDatetimeScanPoints } from './regenHoraryElection';

// 5 个「目标时刻型」推运（小限 profection / 太阳弧 solararc / 太阳返照 solarreturn /
// 月亮返照 lunarreturn / 流年 givenyear）：POST /predict/<key>，目标时刻默认「此刻」
// （与各组件 datetime 默认一致 = 当前流年/期），用共享 buildPredictiveSnapshotText 出 [星盘信息]/[起盘信息]/[相位] 快照。
// 无相位数据即返 '' → 挂载显示「缺失」而非空段头。
// opts（AI 挂载「每技法设置」）：datetime（目标时刻）/ tmType（年/月/日步进）/ asporb（容许度）/ nodeRetrograde（南北交逆移）。
// returns 型（solarreturn/lunarreturn/givenyear）另可覆盖 dirLat/dirLon/dirZone（异地返照；缺省=本命经纬时区）。
// 全部缺省/坏值 → 回退现状默认（此刻/年/1/false/本命经纬）→ 与现状逐字一致(守「默认即现状」)。
export async function buildPredictivePeriodSnapshot(chartObj, key, opts){
	if(!chartObj){
		return '';
	}
	const np = chartObj.params || {};
	const o = opts && typeof opts === 'object' ? opts : {};
	let datetimeStr = '';
	try{
		// 「此刻」按本盘时区(与推运页同一入口 DateTime.nowForChart):此前东八区钟面配本命时区下发,非东八区盘错开时差
		datetimeStr = DateTime.nowForChart(np.zone).format('YYYY-MM-DD HH:mm');
		// 三返照/流年页面缺省目标=「今年的生日时刻」(AstroSolarReturn/LunarReturn/GivenYear genNatalParams
		// 同律:当年年份 + 生日月日 + 出生时分),无头此前一律「此刻」→ 同盘两路返照盘不同。小限/太阳弧页面缺省=此刻,不动。
		if((key === 'solarreturn' || key === 'lunarreturn' || key === 'givenyear') && np.birth){
			// 与三页同一函数(returnPickerSeed:出生串按民用历日期串解析,公元前 / 五位年不再拼出错年)
			datetimeStr = returnPickerSeed(np.birth, DateTime.nowForChart(np.zone)).format('YYYY-MM-DD HH:mm');
		}
	}catch(e){
		datetimeStr = '';
	}
	const optDatetime = `${o.datetime || ''}`.trim();
	// 缺省与推运 9 组件同源(transitOrbDefault 读全局 transitOrb,默认 1 零回归)——
	// 硬编码 1 会在全局改 3° 后与页面推运相位表分叉。
	let _orbDefault = 1;
	try{ _orbDefault = require('../../components/astro/AstroExtraCommon').transitOrbDefault() || 1; }catch(e){ _orbDefault = 1; }
	const asporb = (o.asporb !== undefined && o.asporb !== null && `${o.asporb}` !== '' && Number.isFinite(Number(o.asporb))) ? Number(o.asporb) : _orbDefault;
	const nodeRetrograde = (o.nodeRetrograde === true || o.nodeRetrograde === 1 || o.nodeRetrograde === '1');
	// 单一时点的快照（datetimeForPoint = 'YYYY-MM-DD HH:mm'）。区间扫描循环调用它。
	const runOnePoint = async (datetimeForPoint)=>{
		const params = {
			date: np.date,
			time: np.time,
			ad: np.ad !== undefined ? np.ad : 1,
			zone: np.zone,
			dirZone: (o.dirZone !== undefined && o.dirZone !== null && `${o.dirZone}` !== '') ? o.dirZone : np.zone,
			lon: np.lon,
			lat: np.lat,
			gpsLat: np.gpsLat,
			gpsLon: np.gpsLon,
			hsys: np.hsys,
			zodiacal: np.zodiacal, siderealAyanamsa: np.siderealAyanamsa,
			tradition: np.tradition,
			datetime: datetimeForPoint,
			tmType: 'y',   // 页面同款固定值;后端不消费(F-12 已撤齿轮)
			nodeRetrograde: nodeRetrograde,
			asporb: asporb,
		};
		// AI 推运构参补古典口径续传:七头键(响应 params 有即续传,与派生盘组件
		// natalClassicalParams 同语义)+overrides 全量非默认——此前连 termsVariant 都不带,
		// AI 推运段恒按全默认口径重算,与主盘/推运页分叉。
		['termsVariant', 'leoBoundFirst', 'geminiBoundEmended', 'triplicity', 'lotReversal', 'westNodeType', 'sectBuffer'].forEach((ck)=>{
			if(np[ck] !== undefined && np[ck] !== null && `${np[ck]}` !== ''){
				params[ck] = np[ck];
			}
		});
		Object.assign(params, classicalBackendOverridesFromPlain(np));
		// user 自定义岁差三元(照 natalClassicalParams R4u 同款):spec 无 userAyan 两键,
		// overrides 不产——缺此段则 AI 推运段带裸 'user' 键,后端建档失败静默回落 Lahiri,
		// 与页面推运(已修)口径分叉。echo 有值直取,缺则回落本机当前槽。
		if(`${np.siderealAyanamsa}` === 'user'){
			try{ Object.assign(params, require('../customCalibreStores').userAyanParamsFrom((k)=>np[k])); }catch(e){ /* 无槽=后端回落,与页面同 */ }
		}
		// 头键循环先写了 termsVariant;overrides 的「无表降级删 4」撤不回它 → 补刀:4 而无表体=不发(后端等效埃及,显式化)。
		if(Number(params.termsVariant) === 4 && !params.customTermsDay){ delete params.termsVariant; }
		// 异地返照（仅 returns 型：solarreturn/lunarreturn/givenyear）才下发 dirLat/dirLon——与各 Return 组件一致
		// （默认 = 本命经纬，字节级等同现状）；profection/solararc 组件本就不带 dirLat/dirLon，不加以免改默认行为。
		if(key === 'solarreturn' || key === 'lunarreturn' || key === 'givenyear'){
			params.dirLat = (o.dirLat !== undefined && o.dirLat !== null && `${o.dirLat}` !== '') ? o.dirLat : np.lat;
			params.dirLon = (o.dirLon !== undefined && o.dirLon !== null && `${o.dirLon}` !== '') ? o.dirLon : np.lon;
		}
		if(!params.date && np.birth){
			const parts = `${np.birth}`.split(' ');
			params.date = parts[0];
			params.time = params.time || parts[1] || '';
		}
		try{
			const data = await request(`${Constants.ServerRoot}/predict/${key}`, {
				body: JSON.stringify(params),
				timeoutMs: 60000,
			});
			const result = data && data[Constants.ResultKey];
			if(!result){
				return '';
			}
			// [独立复核修] methodKey 必传:漏传时挂载快照缺 [方法说明],与导出侧(组件全部传参)四同步破缺。
			// 小限齿轮 profGrain/profStart 只喂文本 builder(纯前端派生),不进 /predict 请求体(请求体/缓存键零回归)。
			const textParams = key === 'profection' ? { ...params, profGrain: o.profGrain, profStart: o.profStart } : params;
			return buildPredictiveSnapshotText(chartObj, textParams, result, key) || '';
		}catch(e){
			return '';
		}
	};
	// P4 区间扫描：datetimeEnd 非空且 scanStep 合法 → 多时点；否则单点（=现状，datetime=optDatetime||now）。
	const scan = buildDatetimeScanPoints(optDatetime || datetimeStr, o.datetimeEnd, o.scanStep, 'YYYY-MM-DD HH:mm', ()=>datetimeStr);
	if(scan.points.length <= 1){
		return await runOnePoint(scan.points[0] || (optDatetime || datetimeStr));
	}
	const segs = [];
	for(let i=0; i<scan.points.length; i++){
		const txt = await runOnePoint(scan.points[i]);
		if(txt){
			// R2 对抗自检:分隔标签不可用 【】/[] 包裹,否则被 aiExport.parseSectionTitleLine 当成 section title,
			// 用户自定义导出段时该「时段 N/M」行会落在 wanted 外被 filterContentByWantedSections 删掉(正文段仍在,仅丢标签)。
			segs.push(`—— 时段 ${i + 1}/${scan.points.length} · ${scan.points[i]} ——\n${txt}`);
		}
	}
	if(scan.truncated){
		segs.push(`（区间扫描已达单次上限 ${SCAN_SEGMENT_CAP} 段，后续时段已截断；如需更细请缩小区间或加大步进。）`);
	}
	return segs.join('\n\n');
}

// P4 通用「builder 型」推运区间扫描包裹：行星弧/恒星推运/赤纬推运的 standalone builder 各只接单一时刻 opts，
// 此处据 record.{datetimeEnd,scanStep} 把时刻列表化后循环调 builder 产多段；end 空/step 空 → 单点（=现状）。
//  - cfg.start：起点字符串（planetaryarc=record.targetDatetime；vedic/jaynes=record.targetDate）
//  - cfg.fmt：时点格式（datetime='YYYY-MM-DD HH:mm'；date='YYYY-MM-DD'）
//  - cfg.nowFallback：空起点时的兜底（datetime=此刻；date=今日）
//  - cfg.makeOpts(pointStr)：把单一时点字符串包成 builder 的 opts
//  - cfg.run(opts)：调对应 builder（返回 Promise<string>）
export async function runBuilderScan(record, cfg){
	const startStr = `${cfg.start || ''}`.trim();
	const scan = buildDatetimeScanPoints(startStr, record && record.datetimeEnd, record && record.scanStep, cfg.fmt, cfg.nowFallback);
	if(scan.points.length <= 1){
		// 单点（现状）：起点空 → 传 undefined（让 builder 走自身默认 today/now，逐字节一致）；非空 → 传起点串。
		return (await cfg.run(cfg.makeOpts(startStr ? startStr : undefined)) || '');
	}
	const segs = [];
	for(let i=0; i<scan.points.length; i++){
		const txt = await cfg.run(cfg.makeOpts(scan.points[i]));
		if(txt){
			// R2 对抗自检:分隔标签不可用 【】/[] 包裹,否则被 aiExport.parseSectionTitleLine 当成 section title,
			// 用户自定义导出段时该「时段 N/M」行会落在 wanted 外被 filterContentByWantedSections 删掉(正文段仍在,仅丢标签)。
			segs.push(`—— 时段 ${i + 1}/${scan.points.length} · ${scan.points[i]} ——\n${txt}`);
		}
	}
	if(scan.truncated){
		segs.push(`（区间扫描已达单次上限 ${SCAN_SEGMENT_CAP} 段，后续时段已截断；如需更细请缩小区间或加大步进。）`);
	}
	return segs.join('\n\n');
}

// 命盘侧：按该盘的出生数据无头复算指定技法的快照文本。占卜/事盘走 Part F，不在此列。
// [制度化] export 供全技法段登记哨兵真跑(chart 技法入口:bazi/ziwei/indiachart/推运系)。
// 事盘源走命盘管道的双栖技法(suzhan/huangji):record 无 birth 时 buildFieldObject 以
// divTime 兜底起盘——以事发时刻起盘是卜法正统语义(horary 同构),非缺陷;但快照必须自声明,
// 防 AI 把事时误读为出生时。命盘源(record.birth 在)零字节不产行;行插 [起盘信息] 段内(可勾选控)。
export function annotateCaseTimeAsChartBase(text, record){
	if(!text || !record || record.birth || !record.divTime){ return text; }
	const line = '起盘方式：以事盘时刻起盘（卜法语义，此时刻为事时而非出生时）';
	const lines = `${text}`.split('\n');
	const idx = lines.findIndex((l)=>l.trim() === '[起盘信息]');
	if(idx >= 0){
		lines.splice(idx + 1, 0, line);
		return lines.join('\n');
	}
	return `${line}\n${text}`;
}
