// AI 分析挂载上下文 · 命盘技法无头重算:派生盘聚合、合盘匹配、宿占 / 七政字段、按技法总分派。
// 由 utils/aiAnalysisContext.js 门面统一对外导出。
import DateTime from '../../components/comp/DateTime';
// 「列挂载源」及其纯函数助手抽至轻模块 aiAnalysisSources —— 个别页面只需
// 列源,曾因 import 本文件连带整座 AI 核(~50 技法构建器)进自己的 chunk(46/47 回灌案)。
// 此处 import 供本文件其余函数继续使用,listAnalysisSources 在文件尾 re-export 保旧路径兼容。
import { parseRecordPayload } from '../aiAnalysisSources';
import { scrubForeignFlatValues } from '../techniqueMountSettings';
import { loadFreshModuleAISnapshot } from '../moduleSnapshotRefresh';
import { buildBaziSnapshotForParams } from '../../components/cntradition/BaZi';
import { buildZiweiSnapshotForParams } from '../../components/ziwei/ZiWeiMain';
import { buildIndiaSnapshotForFields } from '../../components/astro/IndiaChart';
import { buildFirdariaSnapshotText, buildPrimaryDirectSnapshotText } from '../../components/direction/AstroDirectMain';
import { buildDistributionsSnapshotText } from '../../components/astro/AstroDistributions';
import { buildAgePointSnapshotText } from '../../components/astro/AstroAgePoint';
// 星运·星历 / 回归轴 / 产前朔望 三页上线为技法键(能算即能挂)。
import { buildEphemerisSnapshotText } from '../../components/astro/AstroEphemeris';
import { buildReturnTimelineSnapshotText } from '../../components/astro/AstroReturnTimeline';
import { buildPrenatalSyzygySnapshotText } from '../../components/astro/AstroPrenatalSyzygy';
import { buildPlanetaryAgesSnapshotText } from '../planetaryAges';
import { buildVedicProgSnapshotText, buildTropicalProgSnapshotText } from '../../components/astro/astroProgSnapshot';
import { buildBalbillusSnapshotText } from '../balbillus';
import { buildTriplicityRulersSnapshotText } from '../triplicityRulers';
import { buildKeypointsSnapshotText } from '../keypoints120';
import { buildLunationPhaseSnapshotText } from '../lunationPhase';
import { buildExtraReturnsSnapshotText } from '../../components/astro/AstroExtraReturns';
import { buildYearSystem129SnapshotText } from '../../components/astro/AstroYearSystem129';
import { buildPlanetaryArcSnapshotText } from '../../components/astro/AstroPlanetaryArc';
import { buildPersianDirectedSnapshotText } from '../../components/astro/AstroPersianDirected';
import { buildJaynesProgSnapshotText } from '../../components/astro/AstroJaynesProgressions';
import { buildZodialReleaseSnapshotText } from '../../components/astro/AstroZR';
import { buildDecennialsSnapshotText } from '../../components/astro/AstroDecennials';
import { buildKinAstroSnapshotForFields } from '../../components/kinastro/KinAstroMain';
import { buildHuangJiSnapshotForFields } from '../../components/huangji/HuangJiMain';
import { buildGuolaoSnapshotForFields } from '../../components/guolao/GuoLaoChartMain';
import { GUOLAO_DEFAULT_SU28_MODE } from '../../components/guolao/GuoLaoChartStyle';   // 覆盖作用域
import { buildSuzhanSnapshotText } from '../../components/suzhan/SuZhanMain';
import { SZChart as SZChartDefaults } from '../../components/suzhan/SZConst';
import { buildGermanySnapshotForFields } from '../../components/germany/AstroMidpoint';
import { buildFieldObject, pickKin, kinDayBoundary, kinGenderOverride } from './recordFields';
import {
	buildChartBaziParams, buildChartZiweiParams, buildZhengChuanSnapshotForRecord, buildCanpingSnapshotForRecord,
	buildHeluoSnapshotForRecord, buildYizhangjingSnapshotForRecord, fetchChartResultForRecord,
} from './chartParams';
import { todayDateStr } from './regenHoraryElection';
// 本盘所用时区(推运类缺省「此刻 / 今日」按它换算):盘回包里的为准,没有就用记录的
const chartZoneOf = (chartObj, record)=>(chartObj && chartObj.params && chartObj.params.zone) || (record && record.zone) || '';
import { buildPrimaryDirChartSnapshotText } from './primaryDirection';
import { buildPredictivePeriodSnapshot, runBuilderScan, annotateCaseTimeAsChartBase } from './regenPredictive';
import { normalizeTechniqueKey } from './techniqueKey';
import { isCacheSnapshotConfidentMatch } from './snapshotMatch';
import { toSlashDate, datePartOf } from '../dateStrSafe';

// opts.throwOnError:默认路径重算遇后端不可达此前一律 catch → '' 静默成 missing(只有覆盖路径给 error);调用方传 true 即可拿到真因
// 七政无头构参:宿度制缺席回退全局现值(与页面 guolaoSu28ModeFromFields 同口径;导出供合同测试锁)。
// 宿占事盘:存档 payload.options(szchart/szshape/doubingSu28/houseStartMode)打底进 fields,
// 记录平铺键(齿轮 merge 写入)再覆盖 —— 此前事盘拨任一齿轮走 A 路重算只读 record.*,四键恒退默认与存档盘不同口径。
// 派生盘聚合键读取的模块快照名(辅盘页 saveDerivedAstroSnapshot 出盘即存;占星地图 ACG 不存模块快照,暂不含)。
export const ASTRO_LIKE_DERIVED_MODULES = ['hellenastro', 'dwadasamsa', 'harmonic', 'draconic', 'relocation'];
const ASTRO_LIKE_DERIVED_LABELS = { hellenastro: '十三分盘', dwadasamsa: '十二分盘', harmonic: '调波盘', draconic: '龙盘', relocation: '重置盘' };
export function buildAstroLikeContext(source, key, label){
	const parts = [];
	const matched = [];
	const stale = [];
	ASTRO_LIKE_DERIVED_MODULES.forEach((name)=>{
		const m = loadFreshModuleAISnapshot(name);   // 与挂载其它槽同一入口:先请页面按此刻所见重存(派生盘页不应答 = 等同直读)
		const content = m && m.content ? `${m.content}`.trim() : '';
		if(!content){ return; }
		if(isCacheSnapshotConfidentMatch(m.meta, source)){
			matched.push(name);
			parts.push(`（以下为${ASTRO_LIKE_DERIVED_LABELS[name] || name}）\n${content}`);
		}else{
			stale.push(name);
		}
	});
	const content = parts.join('\n\n');
	const hint = content ? '' : (stale.length
		? '辅盘页所存派生盘不属本命主,请在辅盘页以本命主重新出盘'
		: '请先在辅盘页出十三分盘/十二分盘/调波盘/龙盘/重置盘(出盘即自动存快照)');
	return {
		key,
		title: label,
		module: key,
		content,
		available: !!content,
		status: content ? 'ready' : 'missing',
		meta: { derivedCharts: matched, ...(hint ? { hint } : {}) },
	};
}

// 派生盘单键上下文:只读本键模块快照,签名不匹配=missing(不回落本命盘、不混别盘)。
export function buildAstroLikeSingleContext(source, key, label){
	const m = loadFreshModuleAISnapshot(key);
	const content = m && m.content ? `${m.content}`.trim() : '';
	const name = ASTRO_LIKE_DERIVED_LABELS[key] || label || key;
	const matched = !!content && isCacheSnapshotConfidentMatch(m.meta, source);
	const hint = matched ? '' : (content
		? `辅盘页所存${name}不属本命主,请在辅盘页以本命主重新出盘`
		: `请先在辅盘页出${name}(出盘即自动存快照)`);
	return {
		key,
		title: label,
		module: key,
		content: matched ? content : '',
		available: matched,
		status: matched ? 'ready' : 'missing',
		meta: { derivedCharts: matched ? [key] : [], ...(hint ? { hint } : {}) },
	};
}

export function relativeSnapshotMatchesRecord(meta, record){
	const m = meta && typeof meta === 'object' ? meta : {};
	const a = `${m.chartABirth || ''}`.trim(), b = `${m.chartBBirth || ''}`.trim();
	const mine = `${(record && record.birth) || ''}`.trim();
	if(!mine || (!a && !b)){ return null; }
	const key = (t)=>t.slice(0, 16);
	return key(mine) === key(a) || key(mine) === key(b);
}

export function suzhanFieldsForRecord(record){
	const fo = buildFieldObject(record);
	const payload = record ? parseRecordPayload(record.payload) : null;
	const oo = payload && payload.options && typeof payload.options === 'object' ? payload.options : null;
	if(oo){
		['szchart', 'szshape', 'doubingSu28', 'houseStartMode'].forEach((k)=>{
			const recHas = record && record[k] !== undefined && record[k] !== null && record[k] !== '';
			if(!recHas && oo[k] !== undefined && oo[k] !== null && oo[k] !== ''){
				fo[k] = { value: (k === 'doubingSu28' || k === 'houseStartMode') ? Number(oo[k]) : oo[k] };
			}
		});
	}
	return fo;
}

// 记录缺宿度制 = 内建默认(荀爽距星 0):与页面载入同一口径(载入时宿度制是新盘种子键,先复位到内建默认,
// 记录里有才覆盖)。此前回退本机七政仓 → 同一张盘,页面按荀爽、AI 按本机存的(可能是回归今宿)。
export function resolveGuolaoFields(record){
	const fields = buildFieldObject(record);
	const raw = record ? record.doubingSu28 : undefined;
	if(raw === undefined || raw === null || raw === ''){
		fields.doubingSu28 = { value: GUOLAO_DEFAULT_SU28_MODE };
	}
	return fields;
}

export async function regenerateChartTechniqueSnapshot(record, key, opts){
	if(!record){
		return '';
	}
	// 撞名平铺键(school / method / mode / direction)只认本技法值域:别的技法写进记录的值当没设(各分支不必各设白名单)
	record = scrubForeignFlatValues(normalizeTechniqueKey(key), record);
	try{
		switch(normalizeTechniqueKey(key)){
		case 'bazi':
			return await buildBaziSnapshotForParams(buildChartBaziParams(record));
		case 'ziwei': {
			// 小限顺逆已迁入 ZWEngineOptions.xiaoxianMode:record 值经 params 透传,
			// builder 走 SWITCH_KEYS 临时覆盖+finally 还原——不再兜转 localStorage(崩溃残留会污染偏好)。
			const zwText = await buildZiweiSnapshotForParams(buildChartZiweiParams(record));
			if(!zwText){ console.warn('[aiAnalysis] ziwei 快照构造为空(记录 birth=' + `${record && record.birth}` + ')'); }
			return zwText;
		}
		case 'indiachart': {
			// 挂载分盘可调(2026-07-05):record.indiaChartnum 经挂载齿轮设定;缺省 1=D1 现状零回归。
			const indiaChartnum = Number(record && record.indiaChartnum) || 1;
			// [Windows #80] 附加分盘(D9 合作 / D7 子嗣…)与主盘同挂,各出一份简表;缺省空 = 零回归。
			return await buildIndiaSnapshotForFields(buildFieldObject(record), indiaChartnum,
				record && record.indiaExtraVargas);
		}
		case 'firdaria': {
			// 法达星限随西洋盘 predictive 一并返回，直接读取即可。
			const chartObj = await fetchChartResultForRecord(record);
			return chartObj ? (buildFirdariaSnapshotText(chartObj) || '') : '';
		}
		case 'distributions': {
			// 界推运：上升点经主限运动穿越埃及界，分配星(界主)+参与星。内部 fetch /predict/dist。
			const chartObj = await fetchChartResultForRecord(record);
			return chartObj ? (await buildDistributionsSnapshotText(chartObj) || '') : '';
		}
		case 'agepoint': {
			// 年龄推进点（Huber）：年龄点自上升点起沿 Koch 宫顺行。内部 fetch /predict/agepoint。
			const chartObj = await fetchChartResultForRecord(record);
			return chartObj ? (await buildAgePointSnapshotText(chartObj) || '') : '';
		}
		case 'planetaryages': {
			// 行星年龄（托勒密人生七阶）：纯前端固定七阶表，读本命盘。
			const chartObj = await fetchChartResultForRecord(record);
			return chartObj ? (buildPlanetaryAgesSnapshotText(chartObj) || '') : '';
		}
		case 'ephemeris': {
			// 星历：今日起 90 天入座/留逆/朔望弦/食相 + 行运触发本命。内部 fetch /astroextra/ephemeris。
			const chartObj = await fetchChartResultForRecord(record);
			return chartObj ? (await buildEphemerisSnapshotText(chartObj) || '') : '';
		}
		case 'returntimeline': {
			// 回归轴：今年起 12 年太阳/月亮返照时间轴。内部 fetch /astroextra/returns。
			const chartObj = await fetchChartResultForRecord(record);
			return chartObj ? (await buildReturnTimelineSnapshotText(chartObj) || '') : '';
		}
		case 'prenatalsyzygy': {
			// 产前朔望：回溯最近朔/望 + 以该时刻排盘。内部 fetch /astroextra/prenatal_syzygy + /chart。
			const chartObj = await fetchChartResultForRecord(record);
			return chartObj ? (await buildPrenatalSyzygySnapshotText(chartObj) || '') : '';
		}
		case 'prog': {
			// [Windows #80] 二次推运（回归黄道）：西占主流行运。与恒星支同一后端 /astroextra/progressions、
			// 同一 builder（只差不下发 zodiacal），此前只有页面没有技法键 ⇒ AI 挂不到「西占的行运推运」。
			const chartObjP = await fetchChartResultForRecord(record);
			if(!chartObjP){ return ''; }
			return await runBuilderScan(record, {
				start: record.targetDate,
				fmt: 'YYYY-MM-DD',
				nowFallback: ()=>todayDateStr(chartZoneOf(chartObjP, record)),   // 「今日」按本盘时区(与页面同一入口)
				makeOpts: (pt)=>({ targetDate: pt, targetTime: record.targetTime, minorVariant: record.minorVariant }),
				run: (opts)=>buildTropicalProgSnapshotText(chartObjP, opts),
			});
		}
		case 'vedicprog': {
			// 恒星推运（Vedic）：二/三/小限推运在恒星黄道下计算。内部 fetch /astroextra/progressions + zodiacal:1。
			// 挂载齿轮可调 目标日期/时刻 → record.* → opts（未改时 undefined，builder 回默认 today/12:00=现状）。
			// P4 区间扫描：targetDate 为起点、datetimeEnd/scanStep 循环多个目标日期（时刻沿用 targetTime）。
			const chartObj = await fetchChartResultForRecord(record);
			if(!chartObj){ return ''; }
			return await runBuilderScan(record, {
				start: record.targetDate,
				fmt: 'YYYY-MM-DD',
				nowFallback: ()=>todayDateStr(chartZoneOf(chartObj, record)),   // 「今日」按本盘时区(与页面同一入口)
				makeOpts: (pt)=>({ targetDate: pt, targetTime: record.targetTime, minorVariant: record.minorVariant }),
				run: (opts)=>buildVedicProgSnapshotText(chartObj, opts),
			});
		}
		case 'balbillus': {
			// Balbillus：十年大运月制族变体（旺距削减），纯前端独立引擎，读本命盘。
			// 挂载齿轮可调 起始星/年制/距离口径 → record.* → opts（未改时 undefined，builder normalize 回默认=现状）。
			const chartObj = await fetchChartResultForRecord(record);
			return chartObj ? (buildBalbillusSnapshotText(chartObj, { startPlanet: record.startPlanet, yearType: record.yearType, mode: record.mode }) || '') : '';
		}
		case 'triplicityrulers': {
			// 三分主星推运：区间光体三分主星分掌人生阶段。挂载齿轮可调 三分体系/划分法/寿命基准（年龄上限）。
			const chartObj = await fetchChartResultForRecord(record);
			return chartObj ? (buildTriplicityRulersSnapshotText(chartObj, { system: record.system, division: record.division, lifespan: record.lifespan }) || '') : '';
		}
		case 'keypoints': {
			// 数字相位推运：120 年关键点，小年因数激活。挂载齿轮可调 释放点（命/身）。
			const chartObj = await fetchChartResultForRecord(record);
			return chartObj ? (buildKeypointsSnapshotText(chartObj, { mode: record.mode }) || '') : '';
		}
		case 'lunationphase': {
			// 月相推运：次限日月八相，纯前端读本命盘。
			const chartObj = await fetchChartResultForRecord(record);
			return chartObj ? (buildLunationPhaseSnapshotText(chartObj) || '') : '';
		}
		case 'extrareturns': {
			// 多重回归：土/木/月交返照，请求型(内部拉 /astroextra/planetreturn)。
			const chartObj = await fetchChartResultForRecord(record);
			return chartObj ? (await buildExtraReturnsSnapshotText(chartObj) || '') : '';
		}
		case 'yearsystem129': {
			// 129 年系统：七政小年序列（仿 firdaria），随盘 predictive 返回。
			const chartObj = await fetchChartResultForRecord(record);
			return chartObj ? (buildYearSystem129SnapshotText(chartObj) || '') : '';
		}
		case 'planetaryarc': {
			// 行星弧：solararc 引擎换弧源（默认月亮弧）。内部 fetch /predict/planetaryarc。
			// 挂载齿轮可调 弧源/目标时刻/容许度 → record.* → opts（未改时 undefined，builder 回默认 月亮/today/1=现状）。
			// P4 区间扫描：targetDatetime 为起点、datetimeEnd/scanStep 循环多个目标时刻。
			const chartObj = await fetchChartResultForRecord(record);
			if(!chartObj){ return ''; }
			return await runBuilderScan(record, {
				start: record.targetDatetime,
				fmt: 'YYYY-MM-DD HH:mm',
				// 缺省目标时刻与页面同律=「明天此刻」(页面 state 构造期 dt.addDate(1));
				// 此前无头兜底取「此刻」、builder 内兜底取「今天 12:00」,同一条记录页面与挂载各算各的日子。
				nowFallback: ()=>{ try{ const d = DateTime.nowForChart(chartZoneOf(chartObj, record)); d.addDate(1); return d.format('YYYY-MM-DD HH:mm'); }catch(e){ return ''; } },   // 「此刻」按本盘时区(与页面同一入口)
				// nodeRetrograde 随齿轮下传(页面有、Python 读;此前挂载表达不了)
				makeOpts: (pt)=>({ arcSource: record.arcSource, datetime: pt, asporb: record.asporb, nodeRetrograde: record.nodeRetrograde }),
				run: (opts)=>buildPlanetaryArcSnapshotText(chartObj, opts),
			});
		}
		case 'persiandirected': {
			// 波斯向运：黄经象征向运(1°/年,宫头不动)，应期 hit-list 纯前端算术，读本命盘。
			// 挂载齿轮可调 速率/方向/应期年数 → record.* → opts（未改时 undefined，builder 回默认 persian/direct/90=现状）。
			const chartObj = await fetchChartResultForRecord(record);
			return chartObj ? (buildPersianDirectedSnapshotText(chartObj, { rateKey: record.rateKey, direction: record.direction, maxYears: record.maxYears }) || '') : '';
		}
		case 'jaynesprog': {
			// Jayne 赤纬推运：推运后看赤纬平行/反平行。内部 fetch /astroextra/jaynesprog。
			// 挂载齿轮可调 目标日期/时刻 → record.* → opts（未改时 undefined，builder 回默认 today/12:00=现状）。
			// P4 区间扫描：targetDate 为起点、datetimeEnd/scanStep 循环多个目标日期（时刻沿用 targetTime）。
			const chartObj = await fetchChartResultForRecord(record);
			if(!chartObj){ return ''; }
			return await runBuilderScan(record, {
				start: record.targetDate,
				fmt: 'YYYY-MM-DD',
				nowFallback: ()=>todayDateStr(chartZoneOf(chartObj, record)),   // 「今日」按本盘时区(与页面同一入口)
				makeOpts: (pt)=>({ targetDate: pt, targetTime: record.targetTime, minorVariant: record.minorVariant }),
				run: (opts)=>buildJaynesProgSnapshotText(chartObj, opts),
			});
		}
		case 'primarydirect': {
			// 主限法·表格：取含主限法的西洋盘 → 列未来 pdYears 年全部 direction 行。P0 起
			// 方位法 + 时间换算 + pdYears 经 record.* → buildFieldObject/fieldParams 透传 /chart 复算（用户选了
			// Placidus/Naibod 等，LLM 上下文也跟着显示）。表格无 datetime（年限范围非单一时刻）。
			const chartObj = await fetchChartResultForRecord(record, { includePrimaryDirection: true });
			if(!chartObj){
				return '';
			}
			// 显式把用户配置的方位法/时间换算/方向类型/顺逆/映点/界回填进快照 params——与 fetchChart
			// 复算所用 fieldParams 同源(buildFieldObject)，不依赖后端是否把请求参回显进 Result.params。
			// 否则 [主限法设置] 段的「向运方向/映点迫星/界迫星」会误显默认值(顺向/否/否)。
			const pdFields = buildFieldObject(record);
			const snapshotChartObj = {
				...chartObj,
				params: {
					...(chartObj.params || {}),
					// 此前写死 1:选「否」的记录在无头复算里照样列界限法行并写「是」。
					// 与页面同源,读记录自己的值(buildFieldObject 已给缺省 1)。
					showPdBounds: (pdFields.showPdBounds && pdFields.showPdBounds.value === 0) ? 0 : 1,
					pdMethod: pdFields.pdMethod.value,
					pdTimeKey: pdFields.pdTimeKey.value,
					pdtype: pdFields.pdtype.value,
					pdDirect: pdFields.pdDirect.value,
					pdConverse: pdFields.pdConverse.value,
					pdAntiscia: pdFields.pdAntiscia.value,
					pdTerms: pdFields.pdTerms.value,
					// 解耦八键同步回填:否则 [主限法设置] 段的「弧算法/盘面宫制/框架/平行…」恒显默认,
					// 与真正参与复算的 fieldParams 口径不一致(显示≠所算)。
					pdProjection: pdFields.pdProjection.value !== undefined ? pdFields.pdProjection.value : 'ptolemy',
					pdFrame: pdFields.pdFrame.value !== undefined ? pdFields.pdFrame.value : 'alcabitius',
					pdFramework: pdFields.pdFramework.value !== undefined ? pdFields.pdFramework.value : 'aspect',
					pdParallel: pdFields.pdParallel.value !== undefined ? pdFields.pdParallel.value : 0,
					pdRaptParallel: pdFields.pdRaptParallel.value !== undefined ? pdFields.pdRaptParallel.value : 0,
					pdTimeKeyCustom: pdFields.pdTimeKeyCustom.value !== undefined ? pdFields.pdTimeKeyCustom.value : 0,
					pdSignificators: Array.isArray(pdFields.pdSignificators.value) ? pdFields.pdSignificators.value : [],
					pdPromissorTypes: Array.isArray(pdFields.pdPromissorTypes.value) ? pdFields.pdPromissorTypes.value : [],
				},
			};
			return buildPrimaryDirectSnapshotText(snapshotChartObj) || '';
		}
		case 'primarydirchart': {
			// 主限法·盘（P5 从表格 fallthrough 拆出）：取本命西洋盘 → 把「所选时刻」换算成主限年龄弧 → 出真盘快照
			// （[主限法盘设置] 段，含时间选择/推运方法/度数换算/向运方向/当前Arc）。修原盘喂表格的 Bug。
			// 挂载齿轮可调 时间(datetime,空=此刻)/方位法/度数换算/向运方向 → record.* → opts（缺省=现状）。
			const chartObj = await fetchChartResultForRecord(record);
			if(!chartObj){
				return '';
			}
			return (await buildPrimaryDirChartSnapshotText(chartObj, {
				datetime: record.datetime,
				pdMethod: record.pdMethod,
				pdTimeKey: record.pdTimeKey,
				direction: record.direction,
			})) || '';
		}
		case 'profection':
		case 'solararc':
		case 'solarreturn':
		case 'lunarreturn':
		case 'givenyear': {
			// 目标时刻型推运：取本命西洋盘后按「此刻」起该期推运（POST /predict/<key>）。
			// 挂载齿轮可调 目标时刻/步进/容许/南北交逆移（returns 另加异地 dirLat/dirLon/dirZone）→ record.* → opts
			//（未改时 undefined，builder 回默认 此刻/年/1/false/本命经纬=现状）。
			const chartObj = await fetchChartResultForRecord(record);
			return chartObj ? (await buildPredictivePeriodSnapshot(chartObj, normalizeTechniqueKey(key), {
				datetime: record.datetime,
				asporb: record.asporb,
				nodeRetrograde: record.nodeRetrograde,
				dirLat: record.dirLat,
				dirLon: record.dirLon,
				dirZone: record.dirZone,
				// P4 区间扫描：end 非空且 step 有值 → 循环多段（每段一个推运时点）；缺省=单点=现状。
				datetimeEnd: record.datetimeEnd,
				scanStep: record.scanStep,
				// [Windows #80] 小限摘要粒度 / 起点(只喂文本 builder,见 runOnePoint textParams):此前本分支漏传 → 命盘挂载这两个齿轮恒按
				// 年 / 上升出摘要,改了没用(差分套件的「通过」全靠「推运时间 = 此刻」跨分钟漂移出的假差分)。未改时 undefined = 缺省 年 / 上升。
				profGrain: record.profGrain,
				profStart: record.profStart,
			}) || '') : '';
		}
		case 'zodialrelease': {
			// 黄道星释：取本命盘后 fetch /predict/zr，福点基点 + L1 全列概览。
			// 挂载齿轮可调 推运基点/输出层级/逐层钻取 → record.* → opts（未改时 undefined，builder 回默认 福点/L1全=现状）。
			const chartObj = await fetchChartResultForRecord(record);
			return chartObj ? (await buildZodialReleaseSnapshotText(chartObj, {
				basePoint: record.basePoint,
				aiMode: record.aiMode,
				aiL1Idx: record.aiL1Idx,
				aiL2Idx: record.aiL2Idx,
				aiL3Idx: record.aiL3Idx,
			}) || '') : '';
		}
		case 'decennials': {
			// 十年大运：纯前端 buildDecennialTimeline（默认设置）+ L1 全列概览。
			// 挂载齿轮可调 起运/次序/日限/历法/输出层级 → record.* → opts（未改时 undefined，builder 回默认=现状）。
			const chartObj = await fetchChartResultForRecord(record);
			return chartObj ? (buildDecennialsSnapshotText(chartObj, {
				startMode: record.startMode,
				orderType: record.orderType,
				dayMethod: record.dayMethod,
				calendarType: record.calendarType,
				aiMode: record.aiMode,
				aiL1Idx: record.aiL1Idx,
				aiL2Idx: record.aiL2Idx,
				aiL3Idx: record.aiL3Idx,
			}) || '') : '';
		}
		case 'guolao': {
			// 七政四余：命度/罗计沿用已保存设置，显示全部传统星曜。
			// 宿度制口径与页面载入同一张盘时一致:record 缺 doubingSu28 = 荀爽距星(0);显式存的按存的。
			return await buildGuolaoSnapshotForFields(resolveGuolaoFields(record));
		}
		case 'suzhan': {
			// 宿占：宿盘随标准西洋盘的二十八宿数据生成，显示全部传统星曜。
			const chartObj = await fetchChartResultForRecord(record);
			const fo = suzhanFieldsForRecord(record);
			// 外盘/盘型两行与页面快照同源:record 不存此两键,回退 SZConst 持久化默认
			// (页面侧同一来源;此前重算路径恒缺两行,遁甲外盘标注承诺在挂载失效)。
			if(!fo.szchart){ fo.szchart = { value: SZChartDefaults.chart }; }
			if(!fo.szshape){ fo.szshape = { value: SZChartDefaults.shape }; }
			// 事盘源(divTime 兜底)时自声明起盘方式,防事时被误读为生时。
			return chartObj ? annotateCaseTimeAsChartBase(buildSuzhanSnapshotText(chartObj, fo, null) || '', record) : '';
		}
		case 'germany': {
			// 量化盘（中点盘）。齿轮 uranian 键('' 已被 prune)→ dispOverride 覆盖全局显示仓。
			const gOv = {};
			// school 白名单闸:record.school 可能被别技法(八字流派)写入 → 非 uranian 四派值一律不透传,
			// 防 schoolToBackendParams 吃到 'fuyi' 之类外域值。
			if(['classic', 'pure', 'uranian', 'cosmo'].indexOf(record.school) >= 0){ gOv.school = record.school; }
			if(record.orb !== undefined && record.orb !== null && record.orb !== '' && Number.isFinite(Number(record.orb))){ gOv.orb = Number(record.orb); }
			if(record.orbPersonal !== undefined && record.orbPersonal !== null && record.orbPersonal !== '' && Number.isFinite(Number(record.orbPersonal))){ gOv.orbPersonal = Number(record.orbPersonal); }
			['strictFactors', 'showDeclination', 'showHouseFrames', 'showEastPoint'].forEach((k)=>{
				const v = record[k];
				if(v !== undefined && v !== null && v !== ''){ gOv[k] = (v === 1 || v === '1' || v === true); }
			});
			return await buildGermanySnapshotForFields(buildFieldObject(record), Object.keys(gOv).length ? gOv : undefined);
		}
		case 'babylon': {
			// 巴比伦占星:恒星黄道(毕宿锚)headless 复算;builder 动态载入(数据表 ~40KB 不入饿链)。
			const m = await import(/* webpackChunkName: "babylon-snapshot" */ '../babylonAiSnapshot');
			// 齿轮派系口径 → buildHoroscope opts(builder 第二参早已在收,曾恒空 {} = 恒 swiss/A10 基线;
			// 页面派系是 state 不落档,齿轮为唯一持久入口)。缺省不组 opts = 现状字节零回归。
			// babylonEphemerisSource 已自挂载 schema 撤下(无头历象摘要恒取后端实位,无消费点)。
			const hasBab = ['babylonScheme', 'babylonEra']   /* 分至规范齿轮已撤 */
				.some((k)=>record[k] !== undefined && record[k] !== null && record[k] !== '');
			if(!hasBab){
				return await m.buildBabylonSnapshotForFields(buildFieldObject(record));
			}
			const bs = await import(/* webpackChunkName: "babylon-snapshot" */ '../../divination/babylon/babylonSchools');
			const sid = (record.babylonScheme && `${record.babylonScheme}`) || 'swissA10';
			const bOv = {};
			if(record.babylonEra){ bOv.era = record.babylonEra; }
			const sc = bs.schemeOf(sid);
			const bOpts = {
				...bs.judgeOpts(sid, bOv),
				ephemerisSource: bOv.ephemerisSource || sc.backend.ephemerisSource,
				solstice: bOv.solstice || sc.backend.solstice,
				schemeCn: sc.cn,
			};
			return await m.buildBabylonSnapshotForFields(buildFieldObject(record), bOpts);
		}
		case 'canping':
			// 邵子参评数（数算）：纯前端，按本盘出生四柱起本命 + 大运。
			// 挂载齿轮可调 取法(明法/古法)+大运排法三档 → record.* → opts(未改时 undefined,builder 回默认=现状)。
			// 🔴 dayunRule 曾漏传(builder 支持、调用点只传 method → 齿轮拨大运档不生效,审计实抓)。
			return await buildCanpingSnapshotForRecord(record, { method: record.method, dayunRule: record.dayunRule });
		case 'zhengchuan':
			// 神数正传（数算）：纯前端。挂载齿轮可调 流派/求测时辰/父母年龄/元运/虚岁 → record.* → opts。
			// 未改时 undefined，builder 回默认（铁板 + 本人时柱作求测时辰）＝现状。
			return await buildZhengChuanSnapshotForRecord(record, {
				school: record.zcSchool, askGz: record.zcAskGz,
				fatherAge: record.zcFatherAge, motherAge: record.zcMotherAge, yuan: record.zcYuan,
				dadingYear: record.zcDadingYear, age: record.zcAge,
				dayun: record.zcDayun, xiaoyun: record.zcXiaoyun, suijun: record.zcSuijun,
				askHourZhi: record.zcAskHourZhi, env: record.zcEnv,
				// 心易查询层缺省=schema/页面缺省(父母·日·一刻·乾·子):此前只透传 record.*(未设=undefined)
				// ⇒ 缺省挂载 calcXinyi 无声音 → [条文秘数查询]/[八刻分命] 整段不产,且「查询项目」齿轮拨任何值都同空=恒死。
				item: record.zcItem || '父母', sound: record.zcSound || '日', ke: record.zcKe || '一刻', gong: record.zcGong || '乾',
				xqZhi: record.zcXqZhi || '子', xqYushu: record.zcXqYushu,
			});
		case 'heluo':
			// 河洛理数（数算）：纯前端，按本盘出生四柱起先后天卦 + 大限 + 命运篇判断。
			// 挂载齿轮可调 取化工法 → record.quHuaGong → opts（未改时 undefined，builder 走 st=null 月支近似=现状）。
			return await buildHeluoSnapshotForRecord(record, { quHuaGong: record.quHuaGong });
		case 'yizhangjing':
			// 一掌经（其他/命）：纯前端；挂载齿轮可调十项流派开关 → record.* → opts（未改回秘传默认）。
			return await buildYizhangjingSnapshotForRecord(record, {
				shunniRule: record.shunniRule, mingGongMethod: record.mingGongMethod,
				dayunLength: record.dayunLength, dayunStartAge: record.dayunStartAge,
				xiaoxianStart: record.xiaoxianStart, xiaoxianDir: record.xiaoxianDir,
				annualMethod: record.annualMethod, flowShenSet: record.flowShenSet,
				chongfanKou: record.chongfanKou, dingYue: record.dingYue, leapRule: record.leapRule,
				starNaming: record.starNaming, daoTerm: record.daoTerm, gradeSet: record.gradeSet,
				zaoZiAdjust: record.zaoZiAdjust, tongxianShow: record.tongxianShow, shenshaLayer: record.shenshaLayer,
			});
		case 'xianqin':
			// 演禽（禽星）：经 ken 后端按出生数据起盘;入式历法/农历锚点齿轮与页面 buildPayload 同键。
			return await buildKinAstroSnapshotForFields(buildFieldObject(record), 'xianqin',
				{ ...kinGenderOverride(record), ...pickKin(record, ['calendarMode', 'lunarYear', 'lunarMonth', 'lunarDay']) });
		case 'cetian':
			// 策天飞星：经 ken 后端按出生数据起盘。schema 是 payload 类但键登记在
			// ANALYSIS_CHART_TECHNIQUES(A 类分派) → 8 个排盘选项经 record.* 落到这里,
			// 必须显式透传进 payload,否则齿轮全是死开关(见 buildKinAstroSnapshotForFields 注)。
			return await buildKinAstroSnapshotForFields(buildFieldObject(record), 'cetian', {
				...kinGenderOverride(record),
				method: record.method,
				lunarMode: record.lunarMode,
				starOrder: record.starOrder,
				showBrightness: record.showBrightness,
				showWuXingJu: record.showWuXingJu,
				showSihua: record.showSihua,
				showFlying: record.showFlying,
				showSolarTerm: record.showSolarTerm,
				// 书法(移语本)口径/流年/显示开关 —— 与左栏/buildPayload/schema 三方同键(缺一=挂载死齿轮)
				brightnessSchool: record.brightnessSchool,
				shenGongMode: record.shenGongMode,
				daxianMode: record.daxianMode,
				tianluoMode: record.tianluoMode,
				palaceNameMode: record.palaceNameMode,
				liunianYear: record.liunianYear,
				liunianQishaMode: record.liunianQishaMode,
				showLiunian: record.showLiunian,
				showShensha: record.showShensha,
				showZaYao: record.showZaYao,
				showDuanjue: record.showDuanjue,
				showXiu: record.showXiu,
				showBianyao: record.showBianyao,
			});
		// kinastro 系七技法:同 xianqin/cetian 管道;齿轮键与页面 buildPayload 同名,pickKin 只透非空
		// (''=按盘面/后端自出,与 buildKinAstroSnapshotForFields 的 ''/null 跳过口径一致 = 零回归)。
		// gender 随档:页面恒下发 normBinaryGender,无头曾从不发 → 女命记录挂载按男算(beiji/nanji/chunzi 男女异盘)。
		case 'qizhengkin': {
			// ①七齿轮透传(与页面 requestKinastroQizheng 同键);②无头载荷此前只有 date/time/zone/lat/lon/gender,
			// 页面 genParams 还带 日界/晚子时/gps/地名 → 同盘两路分叉(时柱与地理口径)。现同集下发。
			const qf = buildFieldObject(record);
			const qv = (k)=>(qf[k] && qf[k].value !== undefined && qf[k].value !== null ? qf[k].value : undefined);
			return await buildKinAstroSnapshotForFields(qf, 'qizhengkin', {
				...kinGenderOverride(record),
				...pickKin(record, ['qizhengKinCurrentYear', 'qizhengKinTransitMode', 'qizhengKinTransitDate', 'qizhengKinTransitTime', 'qizhengKinElectionalStartDate', 'qizhengKinElectionalCriteria', 'qizhengKinElectionalDays']),
				after23NewDay: qv('after23NewDay'), lateZiHourUseNextDay: qv('lateZiHourUseNextDay'),
				gpsLat: qv('gpsLat'), gpsLon: qv('gpsLon'), pos: qv('pos'),
			});
		}
		// 邵子/铁板/鬼谷/北极/南极/蠢子六技法:页面 buildPayload 恒带 日界/晚子时 两键(读全局),无头此前不带 → 后端缺省 1/1,
		// 全局设 24 点换日时 23 点档页面 ≠ 挂载(七政 F-44 已补,本族同集下发;两键随档 record.* 优先、缺读全局 = 与页面同源)。
		case 'shaozi':
			return await buildKinAstroSnapshotForFields(buildFieldObject(record), 'shaozi',
				{ ...kinGenderOverride(record), ...kinDayBoundary(record), ...pickKin(record, ['ke', 'useKey']) });
		case 'tieban':
			return await buildKinAstroSnapshotForFields(buildFieldObject(record), 'tieban',
				{ ...kinGenderOverride(record), ...kinDayBoundary(record), ...pickKin(record, ['method', 'startAge', 'dayunSteps', 'ke', 'useKey', 'tiebanSchool', 'tiebanKeSystem', 'tiebanKe']) });
		case 'fendjing':
			return await buildKinAstroSnapshotForFields(buildFieldObject(record), 'fendjing',
				{ ...kinGenderOverride(record), ...kinDayBoundary(record), ...pickKin(record, ['stemOverride', 'yearStem', 'hourStem']) });
		case 'beiji':
			return await buildKinAstroSnapshotForFields(buildFieldObject(record), 'beiji',
				{ ...kinGenderOverride(record), ...kinDayBoundary(record), ...pickKin(record, ['beijiKeMode', 'beijiKe', 'beijiLookupCode', 'beijiKeyword']) });
		case 'nanji':
			return await buildKinAstroSnapshotForFields(buildFieldObject(record), 'nanji',
				{ ...kinGenderOverride(record), ...kinDayBoundary(record), ...pickKin(record, ['nanjiMode', 'nanjiAfterLichun', 'nanjiLunarYear', 'nanjiSolarMonth', 'nanjiDay', 'nanjiHourZhi', 'nanjiDayGan', 'nanjiDayZhi', 'nanjiSection', 'nanjiJianchu', 'nanjiXiu', 'nanjiPasswordCode', 'nanjiChart', 'nanjiPalace', 'nanjiDegree']) });
		case 'chunzi':
			return await buildKinAstroSnapshotForFields(buildFieldObject(record), 'chunzi',
				{ ...kinGenderOverride(record), ...kinDayBoundary(record), ...pickKin(record, ['chunziKeMode', 'chunziKe', 'chunziLunarMode', 'chunziLunarMonth', 'chunziLunarDay', 'chunziLookupCode', 'chunziKeyword', 'chunziTags', 'chunziMansion', 'chunziHourBranch', 'chunziResultLimit']) });
		case 'huangji': {
			// 皇极经世：经 ken 后端起元会运世盘;record 顶层同名设置(若有)透传,缺=默认零回归。
			// 事盘源(divTime 兜底)时自声明起盘方式(以事时值年推演=卜法语义)。
			// 🔴 事盘源存档在 payload.options.{...,xinyiOptions.*}(B 路 case 同款
			// hv 打底)——此前 A 路只读 record.* ⇒ 只拨一个齿轮时,未拨的存档设置(所推之年/篇目)
			// 全体回默认。齿轮(record 平铺)优先、存档打底,与 B 路 :1398 同序。
			const hp = (()=>{ try{ const r = record && record.payload; const pp = typeof r === 'string' ? JSON.parse(r) : r; return pp && typeof pp === 'object' ? pp : {}; }catch(_e){ return {}; } })();
			const ho = (hp.options && typeof hp.options === 'object') ? hp.options : {};
			const hx = (ho.xinyiOptions && typeof ho.xinyiOptions === 'object') ? ho.xinyiOptions : {};
			// 记录顶层有这个键 = 齿轮拨过:拨成空串也算数(所推之年留空 = 按盘面年),与 B 路同口径
			const hv = (k, saved)=>(record && Object.prototype.hasOwnProperty.call(record, k) && record[k] !== undefined && record[k] !== null ? record[k] : saved);
			return annotateCaseTimeAsChartBase(await buildHuangJiSnapshotForFields(buildFieldObject(record), {
				classicKey: hv('classicKey', ho.classicKey),
				historyYear: hv('historyYear', ho.historyYear),
				classicSectionIndex: hv('classicSectionIndex', ho.classicSectionIndex),
				xinyiMethod: hv('xinyiMethod', hx.method),
				upperNum: hv('upperNum', hx.upperNum), lowerNum: hv('lowerNum', hx.lowerNum),
				upperStrokes: hv('upperStrokes', hx.upperStrokes), lowerStrokes: hv('lowerStrokes', hx.lowerStrokes),
				objectGua: hv('objectGua', hx.objectGua), direction: hv('direction', hx.direction),
			}), record);
		}
		default:
			return '';
		}
	}catch(e){
		if(opts && opts.throwOnError){ throw e; }
		return '';
	}
}
