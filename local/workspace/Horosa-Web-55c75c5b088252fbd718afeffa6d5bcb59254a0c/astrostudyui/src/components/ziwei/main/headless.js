// 紫微起盘参数与无头重算(AI 挂载 / 命例覆写 / 本地引擎缓存键;串行快照链)
// 从 ZiWeiMain.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../../utils/dayBoundary';
import * as ZWConst from '../../../constants/ZWConst';
import request from '../../../utils/request';
import * as Constants from '../../../utils/constants';
import * as ZiWeiHelper from '../ZiWeiHelper';
import { ZWBrightnessCustom, normalizeBrightnessCustomTable } from '../data/ziweiTables';
import { ZWEngineOptions, ziweiNeedsLocalEngine, collectEngineOpts } from '../ziweiOptions';
import { registerZiweiTempOverride, notifyZiweiTempOverrideRestored } from '../ziweiTempOverrideScope';
import { calcZiwei, deriveSanPan, applyLifeMasterOption } from '../ZiweiCalc';
import { isYangGan } from '../ziweiCore';
import { detectPatterns } from '../ziweiPatterns';
import { stableSignature } from '../../../utils/memoBySignature';
import { buildZiWeiSnapshotText } from './snapshot';
import { cachedPost } from '../../../services/_requestCache';
import { techniqueResultCacheEnabled } from '../../../utils/perfFlags';

// —— R4-B3:/ziwei/birth 构参的模块级纯函数(组件方法 genParams 纯委托于此)。
//    抽出来的唯一目的:预热/预取要在【组件之外】构出与首点逐字节同键的 body。
//    语义与抽出前逐字节一致(含「非默认流派才附 sihua」这条零回归约定)。
export function buildZiweiBirthParams(flds){
	if(!flds){
		return null;
	}
	const timeAlg = (flds.timeAlg && flds.timeAlg.value !== undefined && flds.timeAlg.value !== null)
		? flds.timeAlg.value
		: 0;
	const params = {
		date: flds.date.value.format('YYYY-MM-DD'),
		time: flds.time.value.format('HH:mm:ss'),
		ad: (flds.ad && flds.ad.value !== undefined) ? flds.ad.value : (flds.date.value.ad || 1),
		zone: flds.zone.value,
		lon: flds.lon.value,
		lat: flds.lat.value,
		gpsLat: flds.gpsLat.value,
		gpsLon: flds.gpsLon.value,
		gender: flds.gender.value,
		timeAlg: timeAlg === 1 ? 1 : 0,
		// 日界/晚子时:记录随盘保真键(after23NewDay/lateZiHourUseNextDay)优先,缺席才回退全局——
		// 此前恒读全局,带非默认日界键的记录 23:00-23:59 生辰页面盘≠AI 挂载盘(无头读记录键)。缺键=全局=现状零回归。
		after23NewDay: (flds.after23NewDay && flds.after23NewDay.value !== undefined && flds.after23NewDay.value !== null && `${flds.after23NewDay.value}` !== '')
			? flds.after23NewDay.value : defaultAfter23NewDay(),
		lateZiHourUseNextDay: (flds.lateZiHourUseNextDay && flds.lateZiHourUseNextDay.value !== undefined && flds.lateZiHourUseNextDay.value !== null && `${flds.lateZiHourUseNextDay.value}` !== '')
			? flds.lateZiHourUseNextDay.value : defaultLateZiHourUseNextDay(),
	}
	// 非默认流派时附四化表，使后端格局判定随流派；beipai(现状)不附＝缓存键不变＝零回归。
	const school = ZWConst.ZWSchool.school;
	if(school && school !== 'beipai'){
		params.sihua = ZWConst.getActiveSiHuaGan();
	}
	return params;
}

// PERF-R9 Ship 7(数据层空闲预热):紫微本盘 /ziwei/birth —— 首点概率最高的技法之一,
// 却一直不在排盘后的预热组里(本轮补上)。走与 requestZiWei 完全同一入口(同 url、同 body、
// 同缓存层)⇒ 用户首点即命中。silent、丢结果、绝不 dispatch/setState;失败静默。
// horosa_ziwei_warm_cached_post_v1:结果缓存开着时走 cachedPost(与页面同一命名空间 ziwei/birth),预热才打得中页面那一格。
export async function warmZiweiBirth(fields){
	try{
		if(!fields || !fields.date || !fields.date.value || !fields.date.value.format){
			return null;
		}
		const params = buildZiweiBirthParams(fields);
		if(!params){
			return null;
		}
		const opts = { silent: true, retry: { retries: 0 } };
		if(techniqueResultCacheEnabled()){
			return await cachedPost(`${Constants.ServerRoot}/ziwei/birth`, params, opts, { ns: 'ziwei/birth' });
		}
		return await request(`${Constants.ServerRoot}/ziwei/birth`, {
			body: JSON.stringify(params),
			...opts,
		});
	}catch(e){
		return null;   // 预热失败静默:首点回到冷即付的现状
	}
}

// 供 AI 分析无头复算：按出生参数取盘并生成紫微快照文本（不依赖组件挂载）。
// 本构造器在 await 后端期间临时改写全局单例(四化流派 / 自定义四化表 / 亮度表 / 引擎开关),finally 才还原:
// 并发调用(双盘挂载时本人与对方的预览同时构造紫微;挂载与导出同时进行)会互相看到对方的临时值 → 一律排队串行。
let zwSnapshotChain = Promise.resolve();

export function buildZiweiSnapshotForParams(params){
	const run = zwSnapshotChain.then(()=>buildZiweiSnapshotForParamsSerial(params));
	zwSnapshotChain = run.then(()=>undefined, ()=>undefined);
	return run;
}

// 紫微按一张盘的口径临时覆盖引擎单例(四化流派 / 随盘自定义四化与亮度表 / 传本排盘开关),返回还原函数。
// 挂载快照与盘面截图共用。还原只还原「仍是自己临时值」的那几项:临时覆盖期间用户在紫微页亲手改了同一项,
// 不拿旧值盖掉用户的新选择(此前 finally 一律还原到进来时的值)。绝不写本机偏好(崩溃残留不污染本机)。
export const ZW_ENGINE_SWITCH_KEYS = ['daxianSpan', 'tianmaBasis', 'starSet', 'sanPan', 'shangShi', 'leapMonth', 'lateZi', 'yearBoundary', 'huoling', 'kongNaming',
	// 手册补齐:亮度源 + 6 显示 overlay + 紫云关系人(挂载侧 per-技法 record 显式覆盖时透传)。
	'brightnessSource', 'lifeMasterBy', 'liuYueBasis', 'liunianSihuaGan', 'changshengStart', 'changshengDirection', 'kuiYue', 'kongwangStyle', 'flowLuanXi', 'flowHuoLing', 'flowShenshaOnChart', 'childLimit', 'zhongxian', 'huoPan', 'qishuWei', 'borrowPalace', 'taiSuiRuGua', 'taiSuiRelatives', 'xiaoxianMode'];

export function applyZiweiRecordOverride(params){
	const p = params || {};
	// 流派由可变单例 ZWSchool.school + getActiveSiHuaGan 驱动(snapshot/格局判定都读它),故须临时切换 + 用毕还原
	const overrideSchool = p.sihuaSchool && `${p.sihuaSchool}` !== '' ? `${p.sihuaSchool}` : null;
	let prevSchool = ZWConst.ZWSchool.school;
	const schoolChanged = !!(overrideSchool && overrideSchool !== prevSchool);
	if(schoolChanged){
		ZWConst.ZWSchool.school = overrideSchool;
		ZWConst.refreshActiveSiHua();
		// P1-A 不变量:切流派必须同时失效四化缓存(getSiHua 懒初始化,不清不会按新表重建)
		ZiWeiHelper.resetHuaMap();
	}
	// 随盘自定义四化表:归一合法才注入单例(仅 custom 档会消费)
	const customSihua = (ZWConst.ZWSchool.school === 'custom' && p.sihuaCustomTable)
		? ZWConst.normalizeSihuaCustomTable(p.sihuaCustomTable) : null;
	// 覆盖槽里原有的(载入盘带来的会话临时表)还原时放回去,不清成空
	const prevSihuaOverride = ZWConst.ZWSihuaCustom.override;
	const prevBrightnessOverride = ZWBrightnessCustom.override;
	if(customSihua){
		ZWConst.ZWSihuaCustom.override = customSihua;
		ZWConst.refreshActiveSiHua();
		ZiWeiHelper.resetHuaMap();
	}
	// 随盘自定义亮度表:同 A4 机制。亮度纯显示层无缓存链,注入/清除即时生效。
	const customBrightness = p.brightnessCustomTable ? normalizeBrightnessCustomTable(p.brightnessCustomTable) : null;
	if(customBrightness){ ZWBrightnessCustom.override = customBrightness; }
	// 传本/排盘开关:临时切可变单例 ZWEngineOptions(builder 自读它);空数组放行(清空关系人 = 显式覆盖成 [])
	const prevEngine = {};
	const tempEngine = {};
	ZW_ENGINE_SWITCH_KEYS.forEach((k)=>{
		if(p[k] !== undefined && p[k] !== null && (Array.isArray(p[k]) || `${p[k]}` !== '')){
			prevEngine[k] = ZWEngineOptions[k];
			ZWEngineOptions[k] = p[k];
			tempEngine[k] = ZWEngineOptions[k];
		}
	});
	let restored = false;
	let reasserted = false;
	// 在途登记:覆盖期间紫微左栏构造(按本机偏好重写单例)后,把本覆盖压回单例,还原值改记为刚同步的偏好
	const unregister = registerZiweiTempOverride({
		reassert(){
			if(restored){ return; }
			reasserted = true;
			if(schoolChanged){
				prevSchool = ZWConst.ZWSchool.school;
				if(prevSchool !== overrideSchool){
					ZWConst.ZWSchool.school = overrideSchool;
					ZWConst.refreshActiveSiHua();
					ZiWeiHelper.resetHuaMap();
				}
			}
			Object.keys(tempEngine).forEach((k)=>{
				prevEngine[k] = ZWEngineOptions[k];
				ZWEngineOptions[k] = tempEngine[k];
			});
		},
	});
	return function restore(){
		if(restored){ return; }
		restored = true;
		unregister();
		if(customBrightness && ZWBrightnessCustom.override === customBrightness){ ZWBrightnessCustom.override = prevBrightnessOverride || null; }
		let refresh = false;
		if(customSihua && ZWConst.ZWSihuaCustom.override === customSihua){
			ZWConst.ZWSihuaCustom.override = prevSihuaOverride || null;
			refresh = true;
		}
		if(schoolChanged && ZWConst.ZWSchool.school === overrideSchool){
			ZWConst.ZWSchool.school = prevSchool;
			refresh = true;
		}
		if(refresh){
			ZWConst.refreshActiveSiHua();
			ZiWeiHelper.resetHuaMap();
		}
		Object.keys(prevEngine).forEach((k)=>{
			if(ZWEngineOptions[k] === tempEngine[k]){ ZWEngineOptions[k] = prevEngine[k]; }
		});
		// 期间有紫微页首次挂载:它第一次排盘可能按覆盖值排了,还原后通知重排一次(单例此刻已是本机偏好)
		if(reasserted){ notifyZiweiTempOverrideRestored(); }
	};
}

async function buildZiweiSnapshotForParamsSerial(params){
	if(!params){
		return '';
	}
	// 挂载侧 taiSuiRelatives 可能以文本"午 子"直达(text 字段未经 schema normalize 的路径)→ 就地归一成 [{branch}] 数组,
	// 与 live UI 同结构;否则 buildZiweiOverlayLines/taiSuiRuGua 的 Array.isArray 判死,挂载/导出的太岁入卦段静默丢失(双保险)。
	if(typeof params.taiSuiRelatives === 'string' && params.taiSuiRelatives.trim()){
		params = { ...params, taiSuiRelatives: params.taiSuiRelatives.trim().split(/[,，\s]+/).map((x)=>x.trim()).filter(Boolean).map((b)=>({ branch: b })) };
	}
	const restoreOverride = applyZiweiRecordOverride(params);
	try{
		const p = { ...params };
		// 这些键只供前端本地消费,不发后端(后端按白名单忽略,但避免无谓体积/缓存键扰动一并删掉)。
		delete p.sihuaSchool;
		delete p.sihuaCustomTable;
		delete p.brightnessCustomTable;
		delete p.period;
		ZW_ENGINE_SWITCH_KEYS.forEach((k)=>{ delete p[k]; });
		const school = ZWConst.ZWSchool.school;
		if(school && school !== 'beipai'){
			p.sihua = ZWConst.getActiveSiHuaGan();
		}
		const data = await request(`${Constants.ServerRoot}/ziwei/birth`, {
			body: JSON.stringify(p),
			silent: true,
		});
		const result = data && data[Constants.ResultKey] ? data[Constants.ResultKey] : null;
		if(!result || !result.chart){
			return '';
		}
		// WP-F:挂载/导出快照与 live 同口径——传本开关非默认时,用本地引擎重排盘+重算格局,
		// 使快照「传本设置」注记与实际盘数据一致(否则注记说局数年、盘却是 Java 默认 10 年)。失败回退 Java。
		if(ziweiNeedsLocalEngine()){
			try{
				const birth = { date: params.date, time: params.time, zone: params.zone, lon: params.lon, lat: params.lat, gpsLon: params.gpsLon, gpsLat: params.gpsLat, ad: 1, gender: params.gender };
				const opts = { timeAlg: params.timeAlg, after23NewDay: params.after23NewDay, lateZiHourUseNextDay: params.lateZiHourUseNextDay, lateZi: ZWEngineOptions.lateZi, yearBoundary: ZWEngineOptions.yearBoundary, ...collectEngineOpts(ZWEngineOptions), lifeMasterBy: ZWEngineOptions.lifeMasterBy || 'year_branch' };
				// ⚠️ lifeMasterBy 显式选项(默认 'year_branch'=Java 同源;fallback 字面量保留防单例缺位)。
				//    历史上此处钉死生年支防「翻拨开关误改命主」——现由显式选项+ziweiCalc 哨兵金标接防
				//    (默认零回归;ming_branch=用户主动选,命主按天盘命宫支且不随观察盘移)。
				let localChart = calcZiwei(birth, opts);
				if(ZWEngineOptions.sanPan && ZWEngineOptions.sanPan !== 'tian'){ localChart = deriveSanPan(localChart, ZWEngineOptions.sanPan); }
				if(localChart && Array.isArray(localChart.houses) && localChart.houses.length === 12){
					result.chart = { ...result.chart, ...localChart };
					if(localChart.yearGan){ result.chart.yearPolar = isYangGan(localChart.yearGan) ? 'Positive' : 'Negative'; }   // 同上
					try{ const lp = detectPatterns(result.chart); if(Array.isArray(lp)){ result.patterns = lp; } }catch(e3){ /* 保留 Java patterns */ }
				}
			}catch(e4){ /* 本地异常 → 保留 Java 盘 */ }
		}
		// 命主取法后处理:仅 Java 盘路径(本地引擎盘已按 ctx 算好且防观察盘错基,见函数头注)
		if(!ziweiNeedsLocalEngine()){ applyLifeMasterOption(result.chart, ZWEngineOptions.lifeMasterBy); }
		return buildZiWeiSnapshotText(params, result);
	}finally{
		restoreOverride();
	}
}

// 本地引擎记忆键:生辰 + 引擎开关 + 三盘 + 四化流派 + 生效中的十干四化表(自定义 / 随盘表切换时表内容变)。
export function localEngineMemoKey(birth, opts, sanPan){
	const table = ZWConst.getActiveSiHuaGan();
	return stableSignature(birth, opts, sanPan, (ZWConst.ZWSchool && ZWConst.ZWSchool.school) || '', table);
}
