// 主限法取盘字段:年数归一、请求字段构造、推运响应解包与主限法子页签判定
// 从 AstroDirectMain.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { normalizePdType, pickPdExtraSettings, PD_EXTRA_SETTING_KEYS } from '../../../utils/primaryDirectionSync';
import DateTime from '../../comp/DateTime';
import * as Constants from '../../../utils/constants';

export function normalizePdYears(v){
	const n = Math.round(Number(v));
	if(!Number.isFinite(n)){
		return 100;
	}
	return Math.max(1, Math.min(3000, n));
}

export function buildPrimaryDirectionFetchFields(baseFields, chartObj, pdMethod, pdTimeKey, pdYears, options){
	const fields = {
		...(baseFields || {}),
	};
	const opt = options || {};
	const pdtypeVal = normalizePdType(opt.pdtype);
	const pdDirectVal = (opt.direct === false) ? 0 : 1;
	const pdConverseVal = opt.converse ? 1 : 0;
	const pdAntisciaVal = opt.antiscia ? 1 : 0;
	const pdTermsVal = opt.terms ? 1 : 0;
	const params = chartObj && chartObj.params ? chartObj.params : {};
	const birth = `${params.birth || ''}`.trim();
	if(birth){
		const birthDt = new DateTime();
		try{
			birthDt.parse(birth, 'YYYY-MM-DD HH:mm:ss');
			if(params.zone){
				birthDt.zone = params.zone;
				birthDt.calcJdn();
			}
			// 护栏：parse 对畸形 birth 不抛错却得到 NaN 的 DateTime，若不校验会让后续 /chart 收到
			// date:'NaN/NaN/NaN' → 抛错弹「param error」。此时保留 baseFields 原有日期、不写入 NaN。
			const probe = `${birthDt.format ? birthDt.format('YYYY/MM/DD') : ''}`;
			if(!Number.isFinite(birthDt.jdn) || probe.indexOf('NaN') >= 0){
				throw new Error('invalid birth datetime');
			}
			fields.date = {
				...(fields.date || { name: ['date'] }),
				value: birthDt.clone(),
			};
			fields.time = {
				...(fields.time || { name: ['time'] }),
				value: birthDt.clone(),
			};
			fields.ad = {
				...(fields.ad || { name: ['ad'] }),
				value: birthDt.ad,
			};
			fields.zone = {
				...(fields.zone || { name: ['zone'] }),
				value: birthDt.zone,
			};
		}catch(e){
			// fall back to current field values when birth parsing fails
		}
	}
	if(params.lat !== undefined){
		fields.lat = {
			...(fields.lat || { name: ['lat'] }),
			value: params.lat,
		};
	}
	if(params.lon !== undefined){
		fields.lon = {
			...(fields.lon || { name: ['lon'] }),
			value: params.lon,
		};
	}
	fields.gpsLat = {
		...(fields.gpsLat || { name: ['gpsLat'] }),
		value: params.gpsLat !== undefined && params.gpsLat !== null ? params.gpsLat : params.lat,
	};
	fields.gpsLon = {
		...(fields.gpsLon || { name: ['gpsLon'] }),
		value: params.gpsLon !== undefined && params.gpsLon !== null ? params.gpsLon : params.lon,
	};
	fields.hsys = {
		...(fields.hsys || { name: ['hsys'] }),
		value: params.hsys !== undefined && params.hsys !== null ? params.hsys : 0,
	};
	fields.zodiacal = {
		...(fields.zodiacal || { name: ['zodiacal'] }),
		value: params.zodiacal !== undefined && params.zodiacal !== null ? params.zodiacal : 0,
	};
	fields.tradition = {
		...(fields.tradition || { name: ['tradition'] }),
		value: params.tradition !== undefined && params.tradition !== null ? params.tradition : 0,
	};
	fields.strongRecption = {
		...(fields.strongRecption || { name: ['strongRecption'] }),
		value: params.strongRecption !== undefined && params.strongRecption !== null ? params.strongRecption : (fields.strongRecption ? fields.strongRecption.value : 0),
	};
	fields.simpleAsp = {
		...(fields.simpleAsp || { name: ['simpleAsp'] }),
		value: params.simpleAsp !== undefined && params.simpleAsp !== null ? params.simpleAsp : (fields.simpleAsp ? fields.simpleAsp.value : 0),
	};
	fields.virtualPointReceiveAsp = {
		...(fields.virtualPointReceiveAsp || { name: ['virtualPointReceiveAsp'] }),
		value: params.virtualPointReceiveAsp !== undefined && params.virtualPointReceiveAsp !== null ? params.virtualPointReceiveAsp : (fields.virtualPointReceiveAsp ? fields.virtualPointReceiveAsp.value : 0),
	};
	fields.doubingSu28 = {
		...(fields.doubingSu28 || { name: ['doubingSu28'] }),
		value: params.doubingSu28 !== undefined && params.doubingSu28 !== null ? params.doubingSu28 : (fields.doubingSu28 ? fields.doubingSu28.value : 0),
	};
	fields.predictive = {
		...(fields.predictive || { name: ['predictive'] }),
		value: 1,
	};
	// Java /chart 的参数白名单不收 showPdBounds,回显 params.showPdBounds 恒为 1 ——
	// 旧写法拿回显盖 fields,用户选的「否」每次重排都被静默冲回「是」(表格按 fields 正确隐藏、
	// 快照却照列界限法行并写「显示界限法:是」)。fields 是本项的真值源:有值即保留,只有缺键才回落。
	fields.showPdBounds = {
		...(fields.showPdBounds || { name: ['showPdBounds'] }),
		value: (fields.showPdBounds && fields.showPdBounds.value !== undefined && fields.showPdBounds.value !== null)
			? (fields.showPdBounds.value === 0 || fields.showPdBounds.value === false ? 0 : 1)
			: (params.showPdBounds === 0 ? 0 : 1),
	};
	fields.pdtype = {
		...(fields.pdtype || { name: ['pdtype'] }),
		value: pdtypeVal,
	};
	fields.pdDirect = {
		...(fields.pdDirect || { name: ['pdDirect'] }),
		value: pdDirectVal,
	};
	fields.pdConverse = {
		...(fields.pdConverse || { name: ['pdConverse'] }),
		value: pdConverseVal,
	};
	fields.pdAntiscia = {
		...(fields.pdAntiscia || { name: ['pdAntiscia'] }),
		value: pdAntisciaVal,
	};
	fields.pdTerms = {
		...(fields.pdTerms || { name: ['pdTerms'] }),
		value: pdTermsVal,
	};
	// 工具条的八个解耦维此前只写 app 仓(全仓无读者)与本次请求,不回写 fields ——
	// fields 才是「重排 / 换盘 / 存命盘」都认的那份:于是改生辰或切盘重排后静默回落缺省,存盘也捕获不到。
	// 这里按 opt 回写七维(缺省值照写,与既有 pdtype/pdDirect 等同律;fieldsToParams 仍只对非默认下发 → 零回归)。
	// 界系 termsVariant:用户拍板「界是全局设定 → 工具条选择覆写全局」——
	// 本次「计算」带界系时同样回写 fields.termsVariant(排盘真值,重排/换盘/存盘同认);全局仓写入+广播+主盘重算
	// 由 computePrimaryDirections 在值真变时做(与 ChartDisplaySelector.applyClassicalField 同律)。
	if(opt.projection){
		fields.pdProjection = { ...(fields.pdProjection || { name: ['pdProjection'] }), value: opt.projection };
	}
	if(opt.frame){
		fields.pdFrame = { ...(fields.pdFrame || { name: ['pdFrame'] }), value: opt.frame };
	}
	if(opt.framework){
		fields.pdFramework = { ...(fields.pdFramework || { name: ['pdFramework'] }), value: opt.framework };
	}
	fields.pdParallel = { ...(fields.pdParallel || { name: ['pdParallel'] }), value: opt.parallel ? 1 : 0 };
	fields.pdRaptParallel = { ...(fields.pdRaptParallel || { name: ['pdRaptParallel'] }), value: opt.raptParallel ? 1 : 0 };
	if(opt.timeKeyCustom !== undefined){
		fields.pdTimeKeyCustom = {
			...(fields.pdTimeKeyCustom || { name: ['pdTimeKeyCustom'] }),
			value: Number(opt.timeKeyCustom) > 0 ? Number(opt.timeKeyCustom) : null,
		};
	}
	if(Array.isArray(opt.significators)){
		fields.pdSignificators = { ...(fields.pdSignificators || { name: ['pdSignificators'] }), value: opt.significators };
	}
	if(Array.isArray(opt.promissorTypes)){
		fields.pdPromissorTypes = { ...(fields.pdPromissorTypes || { name: ['pdPromissorTypes'] }), value: opt.promissorTypes };
	}
	if(opt.extra){
		const extra = pickPdExtraSettings(opt.extra);
		PD_EXTRA_SETTING_KEYS.forEach((key)=>{
			fields[key] = { ...(fields[key] || { name: [key] }), value: extra[key] };
		});
	}
	if(opt.termsVariant !== undefined){   // 界系回写排盘字段(与 app 仓/请求体同一归一化:1..4 有效,其余 0=埃及)
		const tv = (opt.termsVariant >= 1 && opt.termsVariant <= 4) ? Number(opt.termsVariant) : 0;
		fields.termsVariant = { ...(fields.termsVariant || { name: ['termsVariant'] }), value: tv };
	}
	fields.pdMethod = {
		...(fields.pdMethod || { name: ['pdMethod'] }),
		value: pdMethod,
	};
	fields.pdTimeKey = {
		...(fields.pdTimeKey || { name: ['pdTimeKey'] }),
		value: pdTimeKey,
	};
	fields.pdYears = {
		...(fields.pdYears || { name: ['pdYears'] }),
		value: normalizePdYears(pdYears !== undefined && pdYears !== null ? pdYears
			: (params.pdYears !== undefined && params.pdYears !== null ? params.pdYears
			: (fields.pdYears ? fields.pdYears.value : 100))),
	};
	fields.pdaspects = {
		...(fields.pdaspects || { name: ['pdaspects'] }),
		value: params.pdaspects !== undefined && params.pdaspects !== null ? params.pdaspects : (fields.pdaspects ? fields.pdaspects.value : [0, 60, 90, 120, 180]),
	};
	fields.name = {
		...(fields.name || { name: ['name'] }),
		value: params.name !== undefined ? params.name : (fields.name ? fields.name.value : null),
	};
	fields.pos = {
		...(fields.pos || { name: ['pos'] }),
		value: params.pos !== undefined ? params.pos : (fields.pos ? fields.pos.value : null),
	};
	fields.southchart = {
		...(fields.southchart || { name: ['southchart'] }),
		value: params.southchart !== undefined && params.southchart !== null ? params.southchart : (fields.southchart ? fields.southchart.value : 0),
	};
	// 命盘身份(cid)原样保留:请求体自带 cid:null(buildPrimaryDirectionRequest),这份 fields 会整份写回全局,
	// 在这里清 cid = 载入的命盘与命盘库断开(保存另生副本、温启不钉住、七政首开按本机偏好播种)。
	return fields;
}

export function unwrapPredictiveResponse(data){
	if(!data || typeof data !== 'object'){
		return null;
	}
	if(data[Constants.ResultKey] && typeof data[Constants.ResultKey] === 'object'){
		return data[Constants.ResultKey];
	}
	return data;
}

export function isPrimaryDirectionTabKey(key){
	// primarydirsphere(WS-3 主限天球)同吃 PD 表行:行数据是 AI 快照(复用主限表段)
	// 与 chart.params pd 系持久化的单一来源,天球自身的 /predict/pd3d 不落盘。
	return key === 'primarydirect' || key === 'primarydirchart' || key === 'primarydirsphere';
}
