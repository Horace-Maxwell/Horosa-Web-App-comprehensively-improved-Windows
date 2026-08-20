import { Component } from 'react';
import MidpointMain from './MidpointMain';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { classicalBackendOverridesFromFields, classicalBackendOverridesFromPlain } from '../../utils/classicalChartGlobals';
import { buildAstroSnapshotContent, } from '../../utils/astroAiSnapshot';
import { saveModuleAISnapshot, } from '../../utils/moduleAiSnapshot';
import { planetaryPictures, midpointList, spiegelContacts, solarArcDirections, compositeChart } from '../../utils/uranianDial';
import { getStoredUranianDisplay } from './UranianDialStyle';
import { personalSetForSchool, schoolToBackendParams, SCHOOL_OPTIONS } from './UranianSchools';
import { medicalMeaning, factorLabel } from '../../data/uranianMeanings';
import { tnpReferenceList, TNP_CALIBRE_NOTE, TNP_GROUP_LABEL } from '../../data/uranianTnpReference';
import { chartToPoints, firstSynastryPartnerParams } from './UranianDialMain';
import { markPanelReady } from '../../utils/perfMark';

// AI 快照口径:个人点集随「90°中点盘」当前流派派生(与盘交互层一致,防口径分叉);TNP 集恒定。
const SNAP_URANIAN = new Set(AstroConst.LIST_URANIAN);

function fieldsToParams(fields){
	const params = {
		date: fields.date.value.format('YYYY/MM/DD'),
		time: fields.time.value.format('HH:mm:ss'),
		// zone 出口兜底:坏态(undefined)时与界面时区选择器显示一致落 +08:00,绝不发缺键请求(Java miss.zone)
		zone: fields.zone.value || '+08:00',
		lat: fields.lat.value,
		lon: fields.lon.value,
		gpsLat: fields.gpsLat.value,
		gpsLon: fields.gpsLon.value,
		hsys: fields.hsys.value,
		zodiacal: fields.zodiacal.value,
		siderealAyanamsa: fields.siderealAyanamsa ? fields.siderealAyanamsa.value : '',
		// [SURF-R5g2] user 岁差三元(R4u 第三域):germany 双腿此前 'user' 档同回落 Lahiri
		// (页面与 AI 挂载共用本函数=两侧一致地错,一并修)。
		...((`${fields.siderealAyanamsa ? fields.siderealAyanamsa.value : ''}` === 'user')
			? require('../../utils/customCalibreStores').userAyanParamsFrom((k) => (fields[k] ? fields[k].value : undefined))
			: {}),
		tradition: fields.tradition.value,
		strongRecption: fields.strongRecption.value,
		simpleAsp: fields.simpleAsp.value,
		virtualPointReceiveAsp: fields.virtualPointReceiveAsp.value,
		predictive: 0,
		name: fields.name.value,
		pos: fields.pos.value,
		// [SURF-5] 古典设置单源接入(量化盘本地构参副本此前零古典键);条件发送=默认态字节不变。
		...classicalBackendOverridesFromFields(fields),
	};

	return params;
}

function msg(id){
	if(id === undefined || id === null){
		return '';
	}
	if(AstroText.AstroTxtMsg[id]){
		return AstroText.AstroTxtMsg[id];
	}
	if(AstroText.AstroMsg[id]){
		return `${AstroText.AstroMsg[id]}`;
	}
	return `${id}`;
}

function round3(val){
	if(val === undefined || val === null || Number.isNaN(Number(val))){
		return '';
	}
	return `${Math.round(Number(val) * 1000) / 1000}`;
}

function splitDegree(degree){
	let d = Number(degree);
	if(Number.isNaN(d)){
		return [0, 0];
	}
	if(d < 0){
		d += 360;
	}
	const deg = Math.floor(d % 30);
	const min = Math.floor(((d % 30) - deg) * 60);
	return [deg, min];
}

function aspectText(asp){
	const n = Number(asp);
	if(Number.isNaN(n)){
		return `${asp || ''}`;
	}
	return `${n}˚`;
}

function formatSignDegree(sign, signlon){
	const sd = splitDegree(signlon);
	return `${sd[0]}˚${msg(sign)}${sd[1]}分`;
}

function pickAstroSections(text, sectionNames){
	const wanted = new Set(sectionNames || []);
	const blocks = [];
	const parts = (text || '').split(/\n{2,}(?=\[)/);
	for(let i=0; i<parts.length; i++){
		const part = parts[i].trim();
		if(!part){
			continue;
		}
		const firstLine = part.split('\n')[0] || '';
		const m = firstLine.match(/^\[([^\]]+)\]$/);
		if(!m){
			continue;
		}
		const title = m[1];
		if(wanted.has(title)){
			blocks.push(part);
		}
	}
	return blocks.join('\n\n').trim();
}

// 汉堡学派要素(WP-8):流派 / 六宫框 / 差值表 / 医学四液 / 赤纬平行,聚合入快照供 AI 读盘。
// 门控 showHamburg:用户介入任一汉堡功能即附加——非默认流派 / 差值表 / 十字指针 / 合盘叠加,
// 以及映点(showAntiscia)/中点列表(showMidpointList)/行星图(showPlanetPicture)/和点(showSumPoints)/差距(showArcOpenings)。
// 注:只纳入「默认 false 的用户主动开关」;showHouseFrames/showDeclination 在 classic 默认即 true,不能进门控
// (否则 classic 默认就触发汉堡段,破坏零回归)。默认 classic 且无任一开关 → 空数组,既有快照逐字零回归
// (硬证见 __tests__/germanyHamburgSnapshot)。
export function buildHamburgLines(disp, dialPoints, result, snapOrb, extras){
	const out = [];
	if(!disp){
		return out;
	}
	const synLen = Array.isArray(disp.synastryPeople) ? disp.synastryPeople.length : 0;
	// 门控追加第3组新开关:任一介入即附汉堡段(默认 classic 全关 → 返回空,金标零回归)。
	const showHamburg = disp.school !== 'classic' || disp.showDiffList || disp.crossPointer || synLen > 0
		|| disp.showAntiscia || disp.showMidpointList || disp.showPlanetPicture || disp.showSumPoints || disp.showArcOpenings
		|| disp.showComposite || disp.showDavison || disp.strictFactors || disp.extendedAxes || disp.showEastPoint || disp.showVertex;
	if(!showHamburg){
		return out;
	}
	const orb = Number.isFinite(Number(snapOrb)) && Number(snapOrb) > 0 ? Number(snapOrb) : 1;
	const pts = Array.isArray(dialPoints) ? dialPoints : [];
	out.push('[汉堡学派要素]');

	// 流派(classic 不进入此分支;此处必为非默认派或显式开关)。
	const schoolOpt = (SCHOOL_OPTIONS || []).find((o)=>o.value === disp.school);
	if(schoolOpt){
		out.push(`流派：${schoolOpt.label}`);
	}

	// 口径行(第3组):开启的口径开关列出,使 AI 判读有据。
	const calibres = [];
	if(disp.strictFactors) calibres.push('严格因子集(剔黑月/紫气)');
	if(disp.extendedAxes) calibres.push('扩展映点轴(15°固定星座;仅360°盘有别)');
	if(disp.showEastPoint) calibres.push('东点入点集');
	if(disp.showVertex) calibres.push('宿命点入点集');
	if(disp.saKey && disp.saKey !== 'naibod') calibres.push(`太阳弧速率:${disp.saKey === 'oneDeg' ? '1°/年' : '0°59′12″/年'}`);
	if(calibres.length){
		out.push(`口径：${calibres.join('；')}`);
	}

	// 六宫框(WP-2):后端 houseFrames.frames[key].placements[id]→宫号;报太阳局四点落宫。
	const frames = result && result.houseFrames && result.houseFrames.frames ? result.houseFrames.frames : null;
	const sunFrame = frames ? frames.sun : null;
	if(sunFrame && sunFrame.placements){
		const pl = sunFrame.placements;
		const hps = [AstroConst.SUN, AstroConst.MOON, AstroConst.ASC, AstroConst.MC]
			.filter((id)=>pl[id])
			.map((id)=>`${msg(id)}→${pl[id]}宫`);
		if(hps.length){
			out.push(`六宫框(太阳局)：${hps.join('、')}`);
		}
	}

	// 差值表(WP-3):太阳弧到期(naibod),目标年龄命中标★。
	if(disp.showDiffList){
		const targetAge = Number.isFinite(Number(disp.diffTargetAge)) ? Number(disp.diffTargetAge) : 30;
		const diffs = solarArcDirections(pts, 90, { saKey: 'naibod', targetAge, win: 1, maxAge: 90 });
		if(diffs && diffs.length){
			out.push(`差值表(太阳弧到期，目标年龄${targetAge}岁)：`);
			diffs.slice(0, 8).forEach((d)=>{
				const due = d.due ? ' ★到期' : '';
				out.push(`  ${factorLabel(d.a)}∠${factorLabel(d.b)} 弧${Number(d.arc).toFixed(2)}° → ${Number(d.age).toFixed(1)}岁${due}`);
			});
		}
	}

	// 医学四液(WP-4):四液中点被本盘因子激活(某点落该中点折叠位,90°盘 orb 内)则报体质倾向。
	const foldOf = (id)=>{
		const p = pts.find((x)=>x && x.id === id);
		return p && Number.isFinite(Number(p.lon)) ? ((Number(p.lon) % 90) + 90) % 90 : null;
	};
	const dialDist = (x, y)=>{ const dd = Math.abs(x - y) % 90; return Math.min(dd, 90 - dd); };
	const MED_PAIRS = [
		[AstroConst.SUN, AstroConst.MARS],
		[AstroConst.VENUS, AstroConst.JUPITER],
		[AstroConst.MERCURY, AstroConst.SATURN],
		[AstroConst.MOON, AstroConst.NEPTUNE],
	];
	const medHits = [];
	MED_PAIRS.forEach(([a, b])=>{
		const fa = foldOf(a);
		const fb = foldOf(b);
		if(fa === null || fb === null){
			return;
		}
		let mid = (fa + fb) / 2;
		if(Math.abs(fa - fb) > 45){
			mid = (mid + 45) % 90;
		}
		const hit = pts.some((p)=>{
			if(!p || p.id === a || p.id === b || !Number.isFinite(Number(p.lon))){
				return false;
			}
			const fp = ((Number(p.lon) % 90) + 90) % 90;
			return dialDist(fp, mid) <= orb;
		});
		if(hit){
			const m = medicalMeaning(a, b);
			if(m){
				medHits.push(`${factorLabel(a)}/${factorLabel(b)}=${m.temperament}`);
			}
		}
	});
	if(medHits.length){
		out.push(`医学四液中点(本盘激活)：${medHits.join('；')}`);
		out.push('（仅为体质倾向参考，不替代医疗诊断）');
	}

	// 赤纬平行/反平行(WP-11):后端 declination top 接触(仅 showDeclination 开时)。
	const decl = (disp.showDeclination !== false && result && result.declination && typeof result.declination === 'object') ? result.declination : null;
	if(decl){
		const par = Array.isArray(decl.parallel) ? decl.parallel : [];
		const cp = Array.isArray(decl.contraParallel) ? decl.contraParallel : [];
		if(par.length || cp.length){
			out.push('赤纬接触：');
			par.slice(0, 6).forEach((p)=>out.push(`  ${msg(p.a)} ∥ ${msg(p.b)}（平行≈合，Δ${Number(p.delta).toFixed(2)}°）`));
			cp.slice(0, 6).forEach((p)=>out.push(`  ${msg(p.a)} ⥮ ${msg(p.b)}（反平行≈冲，Δ${Number(p.delta).toFixed(2)}°）`));
		}
	}

	// ── [组合盘](B5):开启且伙伴点集可得时附(extras.compositePts 由异步快照链拉取;页面中点 Tab 无此数据则跳)。 ──
	const cpts = extras && Array.isArray(extras.compositePts) ? extras.compositePts : null;
	if(disp.showComposite && cpts && cpts.length){
		out.push('[组合盘]');
		out.push(`与「${extras.partnerLabel || '叠盘对象'}」逐因子取近中点(关系本身之盘);点位如下：`);
		cpts.slice(0, 24).forEach((pt)=>{
			out.push(`  ${msg(pt.id)}：${Number(pt.lon).toFixed(2)}°`);
		});
	}

	// ── [戴维森盘](B5):开启且后端返回时附(时空中点真实起盘;数据随 /germany/midpoint 的 davison 字段)。 ──
	const dav = result && result.davison && typeof result.davison === 'object' ? result.davison : null;
	if(disp.showDavison && dav && Array.isArray(dav.points) && dav.points.length){
		out.push('[戴维森盘]');
		out.push(`时空中点真实起盘：UT ${dav.utc || '—'} · 纬 ${Number(dav.lat).toFixed(3)}° · 经 ${Number(dav.lon).toFixed(3)}°`);
		dav.points.slice(0, 24).forEach((pt)=>{
			out.push(`  ${msg(pt.id)}：${Number(pt.lon).toFixed(2)}°${Number(pt.lonspeed) < 0 ? '（逆）' : ''}`);
		});
		if(dav.angles){
			Object.keys(dav.angles).forEach((aid)=>out.push(`  ${msg(aid)}：${Number(dav.angles[aid]).toFixed(2)}°`));
		}
	}

	// ── [虚星参考](A2):启用虚星的流派下附三套周期口径,使 AI 知晓位置计算基准。 ──
	if(disp.showTnp !== false && disp.school !== 'cosmo'){
		out.push('[虚星参考]');
		out.push(TNP_CALIBRE_NOTE);
		tnpReferenceList().forEach((r)=>{
			const pc = r.periodC != null ? `/丙${r.periodC}` : '';
			out.push(`  ${r.label}(${TNP_GROUP_LABEL[r.group]})：周期 甲${r.periodA}/乙${r.periodB}${pc} 年 · ${r.au}AU · ${r.keyword}`);
		});
	}

	return out;
}

// PERF-R8 P2(数据层空闲预热):按当前盘 fields 预热 /germany/midpoint —— 与量化盘
// (germanytech,辅盘默认子页)首点的 requestChart 同一构造:fieldsToParams(fields) +
// 存储流派派生(school/orb/personalOrb,**不含** declination 键——那是 AI 无头版的口径,
// body 不同不可混用)→ url+body 逐字节一致 → requestDedupe L1/L2 命中。silent 丢结果,
// 绝不 setState/dispatch。失败静默。
export async function warmGermanyMidpoint(fields){
	try{
		if(!fields || !fields.date || !fields.date.value || !fields.date.value.format){ return null; }
		const params = fieldsToParams(fields);
		const disp = getStoredUranianDisplay();
		const schoolParams = { ...schoolToBackendParams(disp.school), orb: disp.orb, personalOrb: disp.orbPersonal };
		return await request(`${Constants.ServerRoot}/germany/midpoint`, {
			body: JSON.stringify({ ...params, ...schoolParams }),
			silent: true,
			// PERF-R9 Ship 7:预热/预取一律零重试(显式声明,不吃调用链上的任何重试默认值)。
			retry: { retries: 0 },
		});
	}catch(e){
		return null; // 预热失败静默:首点回到冷即付的现状
	}
}

// 供 AI 分析无头复算：取本命西洋盘 + 中点盘，生成量化盘快照（不依赖组件挂载）。
export async function buildGermanySnapshotForFields(fields, dispOverride){
	if(!fields){
		return '';
	}
	const params = fieldsToParams(fields);
	const chartData = await request(`${Constants.ServerRoot}/chart`, {
		body: JSON.stringify({ ...params, cid: null }),
		silent: true,
	});
	const chartObj = chartData && chartData[Constants.ResultKey] ? chartData[Constants.ResultKey] : null;
	// 流派/赤纬随「90°中点盘」存储派生(同盘口径);默认 classic → schoolParams=后端默认、declination 默认开,既有段字节零回归。
	// dispOverride:AI 挂载齿轮覆盖(school/orb/orbPersonal/strictFactors/showDeclination/frames);
	// 缺省 = 全局显示仓原值(现状零回归)。
	const dispReq = { ...getStoredUranianDisplay(), ...(dispOverride && typeof dispOverride === 'object' ? dispOverride : {}) };
	// 供给面与 90°盘页面同参面(第3组):strictFactors/frames(live+东点)/davison 条件下发——
	// 默认全关时逐字节同旧请求(零回归);开启后快照与页面判读永不分叉。
	const partnerParams = (dispReq.showComposite || dispReq.showDavison) ? firstSynastryPartnerParams(dispReq) : null;
	const schoolReq = {
		...schoolToBackendParams(dispReq.school), orb: dispReq.orb, personalOrb: dispReq.orbPersonal,
		declination: dispReq.showDeclination !== false,
		frames: dispReq.showHouseFrames !== false || !!dispReq.showEastPoint,
		...(dispReq.strictFactors ? { strictFactors: true } : {}),
		...(dispReq.showDavison && partnerParams ? { davison: partnerParams } : {}),
	};
	const mpData = await request(`${Constants.ServerRoot}/germany/midpoint`, {
		body: JSON.stringify({ ...params, ...schoolReq }),
		silent: true,
	});
	const result = mpData && mpData[Constants.ResultKey] ? mpData[Constants.ResultKey] : null;
	if(!result){
		return '';
	}
	// [组合盘] 段数据:开启且伙伴可解析(命盘库来源)时拉伙伴盘点,前端近中点合成。
	let extras = null;
	if(dispReq.showComposite && partnerParams){
		try{
			const [pcData, pmData] = await Promise.all([
				request(`${Constants.ServerRoot}/chart`, { body: JSON.stringify({ ...partnerParams, cid: null }), silent: true }),
				request(`${Constants.ServerRoot}/germany/midpoint`, { body: JSON.stringify({ ...partnerParams, ...schoolToBackendParams(dispReq.school) }), silent: true }),
			]);
			const pChart = pcData && pcData[Constants.ResultKey] ? pcData[Constants.ResultKey] : null;
			const pMp = pmData && pmData[Constants.ResultKey] ? pmData[Constants.ResultKey] : null;
			const pPts = chartToPoints(pChart);
			if(pMp && Array.isArray(pMp.tnp)) pMp.tnp.forEach((t)=>pPts.push({ id: t.id, lon: t.lon }));
			const natalPts = chartToPoints(chartObj);
			if(Array.isArray(result.tnp)) result.tnp.forEach((t)=>natalPts.push({ id: t.id, lon: t.lon }));
			const cpts = compositeChart(natalPts, pPts);
			if(cpts.length) extras = { compositePts: cpts, partnerLabel: partnerParams.name || '叠盘对象' };
		}catch(e){ /* 伙伴盘拉取失败 → 跳过组合段(仅数据可得时附) */ }
	}
	return buildGermanySnapshotText(params, chartObj, result, fields, extras);
}

export function buildGermanySnapshotText(params, chartObj, result, fields, extras){
	const lines = [];
	const midpoints = result && result.midpoints ? result.midpoints : [];
	const aspects = result && result.aspects ? result.aspects : {};

	lines.push('[起盘信息]');
	lines.push(`日期：${params.date} ${params.time}`);
	lines.push(`时区：${params.zone}`);
	lines.push(`经纬度：${params.lon} ${params.lat}`);
	if(params.zodiacal !== undefined){
		lines.push(`黄道：${msg(AstroConst.ZODIACAL[params.zodiacal])}`);
	}
	if(params.hsys !== undefined){
		lines.push(`宫制：${msg(AstroConst.HouseSys[params.hsys])}`);
	}

	const astroText = buildAstroSnapshotContent(chartObj, fields);
	const baseSections = pickAstroSections(astroText, ['宫位宫头', '行星']);
	if(baseSections){
		lines.push('');
		lines.push(baseSections);
	}

	lines.push('');
	lines.push('[中点]');
	if(midpoints.length === 0){
		lines.push('暂无中点数据');
	}else{
		// [v2 排版] 中点逐行改 GFM 表(经 v1/v2 归一器直通、docx/PDF 渲染真表)。
		// 单元格值表达式逐字同源:msg(idA)/msg(idB)/formatSignDegree;
		// 因子对分隔「|」→「/」(GFM 单元格不容裸竖线,与本文[中点列表]既有对记号一致)。
		lines.push('| 中点 | 位置 |');
		lines.push('| --- | --- |');
		midpoints.forEach((item)=>{
			lines.push(`| ${msg(item.idA)} / ${msg(item.idB)} | ${formatSignDegree(item.sign, item.signlon)} |`);
		});
	}

	lines.push('');
	lines.push('[TNP星体]');
	const tnpList = result && Array.isArray(result.tnp) ? result.tnp : [];
	if(tnpList.length === 0){
		lines.push('暂无 TNP 数据');
	}else{
		lines.push('| 星体 | 位置 |');
		lines.push('| --- | --- |');
		tnpList.forEach((item)=>{
			lines.push(`| ${msg(item.id)} | ${formatSignDegree(item.sign, item.signlon)} |`);
		});
	}

	lines.push('');
	lines.push('[中点相位]');
	const aspectKeys = Object.keys(aspects || {});
	if(aspectKeys.length === 0){
		lines.push('暂无中点相位数据');
	}else{
		lines.push('| 主体 | 中点 | 相位 | 误差 |');
		lines.push('| --- | --- | --- | --- |');
		aspectKeys.forEach((key)=>{
			const arr = aspects[key] || [];
			if(arr.length === 0){
				lines.push(`| ${msg(key)} | 无 | — | — |`);
				return;
			}
			arr.forEach((asp, k)=>{
				const mid = asp.midpoint || {};
				const idA = mid.idA !== undefined ? mid.idA : asp.idA;
				const idB = mid.idB !== undefined ? mid.idB : asp.idB;
				lines.push(`| ${k === 0 ? msg(key) : '—'} | ${msg(idA)}·${msg(idB)} | ${aspectText(asp.aspect)} | ${round3(asp.delta)} |`);
			});
		});
	}

	// [90°中点盘]：把行星/三王/角点/TNP 折叠到 0–90°，度数相近者即互成硬相位(0/90/180/270)，供 AI 读盘。
	lines.push('');
	lines.push('[90°中点盘]');
	const DIAL_IDS = new Set([
		AstroConst.SUN, AstroConst.MOON, AstroConst.MERCURY, AstroConst.VENUS, AstroConst.MARS,
		AstroConst.JUPITER, AstroConst.SATURN, AstroConst.URANUS, AstroConst.NEPTUNE, AstroConst.PLUTO,
		AstroConst.NORTH_NODE, AstroConst.SOUTH_NODE, AstroConst.ASC, AstroConst.MC,
	]);
	const innerChart = (chartObj && chartObj.chart) ? chartObj.chart : (chartObj || {});
	const dialFactors = [];
	const pushFactor = (id, lon) => { const n = Number(lon); if (id && Number.isFinite(n)) dialFactors.push({ id, fold: ((n % 90) + 90) % 90 }); };
	(innerChart.objects || []).forEach((o)=>{ if(DIAL_IDS.has(o.id)) pushFactor(o.id, o.lon); });
	(innerChart.angles || []).forEach((o)=>{ if(DIAL_IDS.has(o.id)) pushFactor(o.id, o.lon); });
	tnpList.forEach((t)=>pushFactor(t.id, t.lon));
	if(dialFactors.length === 0){
		lines.push('暂无可折叠因子');
	}else{
		lines.push('（盘基 90°；各因子折叠位相近者互成硬相位 0/90/180/270）');
		// [v2 排版] 折叠位逐行改 GFM 表(单元格值表达式逐字同源:msg(f.id)/f.fold.toFixed(2))。
		lines.push('| 因子 | 折叠位 |');
		lines.push('| --- | --- |');
		dialFactors.sort((a, b)=>a.fold - b.fold).forEach((f)=>{
			lines.push(`| ${msg(f.id)} | ${f.fold.toFixed(2)}° |`);
		});
	}

	// 行星图 / 映点 / 中点列表(与盘交互层同口径:base=90、orb=1 严格口径),供 AI 完整读盘。
	const dialPoints = [];
	const pushPoint = (id, lon) => { const n = Number(lon); if (id && Number.isFinite(n)) dialPoints.push({ id, lon: n }); };
	(innerChart.objects || []).forEach((o)=>{ if(DIAL_IDS.has(o.id)) pushPoint(o.id, o.lon); });
	(innerChart.angles || []).forEach((o)=>{ if(DIAL_IDS.has(o.id)) pushPoint(o.id, o.lon); });
	tnpList.forEach((t)=>pushPoint(t.id, t.lon));
	pushPoint(AstroConst.ARIES_POINT, 0);
	// 流派/容许度随「90°中点盘」存储派生(与盘一致);缺省 classic → 个人点含白羊+南交、orb 1°,即现状口径。
	const disp = getStoredUranianDisplay();
	const snapPersonal = personalSetForSchool(disp.school);
	const SNAP_BASE = 90;
	const SNAP_ORB = Number.isFinite(Number(disp.orb)) && Number(disp.orb) > 0 ? Number(disp.orb) : 1;
	const scanOpts = { personal: snapPersonal, uranian: SNAP_URANIAN, orbPersonal: disp.orbPersonal };

	lines.push('');
	lines.push('[行星图]');
	const pics = planetaryPictures(dialPoints, SNAP_BASE, SNAP_ORB, { ...scanOpts, limit: 40 });
	if(pics.length === 0){
		lines.push('暂无行星图');
	}else{
		lines.push('（敏感点和差式 A+B−C=D，含个人点/TNP 优先）');
		// [v2 排版] 和差式逐行改 GFM 表(单元格值表达式逐字同源:msg(a/b/c/d)/p.sep.toFixed(2))。
		lines.push('| 和差式 A+B−C | 落点 D | 误差 |');
		lines.push('| --- | --- | --- |');
		pics.forEach((p)=>lines.push(`| ${msg(p.a)} + ${msg(p.b)} − ${msg(p.c)} | ${msg(p.d)} | ${p.sep.toFixed(2)}° |`));
	}

	lines.push('');
	lines.push('[映点]');
	const sp = spiegelContacts(dialPoints, SNAP_BASE, SNAP_ORB, scanOpts);
	if(sp.length === 0){
		lines.push('暂无映点接触');
	}else{
		lines.push('（Spiegelpunkt 回照接触；90°盘上回照与对映折叠重合）');
		// [v2 排版] 映点接触逐行改 GFM 表(单元格值表达式逐字同源:msg(s.a)/msg(s.b)/s.sep.toFixed(2))。
		lines.push('| 映点对 | 误差 |');
		lines.push('| --- | --- |');
		sp.forEach((s)=>lines.push(`| ${msg(s.a)} ⟷ ${msg(s.b)} | ${s.sep.toFixed(2)}° |`));
	}

	lines.push('');
	lines.push('[中点列表]');
	const mpl = midpointList(dialPoints, SNAP_BASE, scanOpts);
	if(mpl.length === 0){
		lines.push('暂无中点');
	}else{
		// [v2 排版] 中点列表逐行改 GFM 表(单元格值表达式逐字同源:msg(m.a)/msg(m.b)/m.lon.toFixed(2))。
		lines.push('| 因子 | 折叠位 |');
		lines.push('| --- | --- |');
		mpl.slice(0, 120).forEach((m)=>lines.push(`| ${msg(m.a)} / ${msg(m.b)} | ${m.lon.toFixed(2)}° |`));
	}

	// 汉堡学派要素(WP-8):流派/六宫框/差值/医学/赤纬,仅用户介入汉堡功能时附加(默认 classic 零回归)。
	const hamburgLines = buildHamburgLines(disp, dialPoints, result, SNAP_ORB, extras);
	if(hamburgLines.length){
		lines.push('');
		lines.push(hamburgLines.join('\n'));
	}

	return lines.join('\n');
}

class AstroMidpoint extends Component{
	constructor(props) {
		super(props);
		this.state = {
			midpoints: null,
		};

		this.unmounted = false;
		this.lastSnapshotParams = null;

		this.requestChart = this.requestChart.bind(this);
		this.genParams = this.genParams.bind(this);
		this.onFieldsChange = this.onFieldsChange.bind(this);
		this.requestChartObj = this.requestChartObj.bind(this);
		this.saveGermanySnapshot = this.saveGermanySnapshot.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);

		if(this.props.hook){
			this.props.hook.fun = ()=>{
				if(this.unmounted){
					return;
				}
				this.requestChartObj(this.props.fields);
			};
		}

	}

	async requestChart(params){
		// [SURF-R5m] 乱序/卸载防(同批 seq 范式;onFieldsChange 连改连发窗口小但存在)。
		const seq = ++this._mpSeq || (this._mpSeq = 1);
		// 流派出参随「90°中点盘」存储派生(同盘口径);默认 classic 即现状字节零回归,不扰后端缓存。
		// 第3组:strictFactors/frames(live+东点)/davison 与 90°盘、挂载链同参面(供给三链一致)。
		const disp = getStoredUranianDisplay();
		const partnerParams = disp.showDavison ? firstSynastryPartnerParams(disp) : null;
		const schoolParams = {
			...schoolToBackendParams(disp.school), orb: disp.orb, personalOrb: disp.orbPersonal,
			frames: disp.showHouseFrames !== false || !!disp.showEastPoint,
			...(disp.strictFactors ? { strictFactors: true } : {}),
			...(partnerParams ? { davison: partnerParams } : {}),
		};
		const data = await request(`${Constants.ServerRoot}/germany/midpoint`, {
			body: JSON.stringify({ ...params, ...schoolParams }),
		});
		const result = data && data[Constants.ResultKey] ? data[Constants.ResultKey] : null; // 后端无响应/异常时优雅降级(与本文件 229/237 同口径),不再 data undefined 时 data[ResultKey] 崩红屏

		if(this.unmounted || seq !== this._mpSeq){ return; }
		const st = {
			midpoints: result,
		};

		this.lastSnapshotParams = params;
		// horosa_panel_ready_v1:量化盘(辅盘默认子页)中栏盘 + 右栏中点/相位列表全部由
		// midpoints 派生,这一次 setState 即「面板数据落定」。
		this.setState(st, ()=>{
			markPanelReady('auxchart');
		});
		// AI 快照重建(planetaryPictures/midpointList/spiegelContacts 的 O(n²~n³) 扫描 + 全文拼装)
		// 移出交互路径 → 空闲时段。导出/分析侧永远走 horosa:refresh-module-snapshot 事件同步重建
		// (handleSnapshotRefreshRequest),故此处延后**不会**让 AI 拿到陈旧快照;卸载前同步兜底 flush。
		this.scheduleSnapshotSave(params, result);
	}

	// horosa_snapshot_idle_v1(PERF-R9 Ship 6):快照重建合并到空闲时段,同一批多次触发只跑最后一次。
	scheduleSnapshotSave(paramsOverride, resultOverride){
		this._pendingSnapshot = { params: paramsOverride, result: resultOverride };
		if(this._snapshotScheduled){
			return;
		}
		this._snapshotScheduled = true;
		const run = ()=>{
			this._snapshotScheduled = false;
			const pending = this._pendingSnapshot;
			this._pendingSnapshot = null;
			if(!pending || this.unmounted){
				return;
			}
			this.saveGermanySnapshot(pending.params, pending.result);
		};
		try{
			if(typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function'){
				window.requestIdleCallback(run, { timeout: 1200 });
			}else{
				setTimeout(run, 200);
			}
		}catch(e){
			run();
		}
	}

	// 卸载/离开前把尚未落盘的快照同步补写(绝不丢:AI 导出可能在组件不在时读缓存)。
	flushSnapshotSave(){
		const pending = this._pendingSnapshot;
		this._pendingSnapshot = null;
		if(!pending){
			return;
		}
		this.saveGermanySnapshot(pending.params, pending.result);
	}

	saveGermanySnapshot(paramsOverride, resultOverride){
		try{
			const params = paramsOverride || this.lastSnapshotParams || this.genParams();
			if(!params){
				return '';
			}
			const result = resultOverride === undefined ? this.state.midpoints : resultOverride;
			const snapshotText = buildGermanySnapshotText(params, this.props.chart, result || {}, this.props.fields);
			if(!snapshotText){
				return '';
			}
			saveModuleAISnapshot('germany', snapshotText, {
				date: params.date,
				time: params.time,
				zone: params.zone,
				lon: params.lon,
				lat: params.lat,
			});
			return snapshotText;
		}catch(e){
			return '';
		}
	}

	handleSnapshotRefreshRequest(evt){
		if(!evt || !evt.detail || evt.detail.module !== 'germany'){
			return;
		}
		// 导出/分析路径:一律**同步**用当前 state 重建(不吃空闲队列),口径与延后前逐字一致。
		this._pendingSnapshot = null;
		const snapshotText = this.saveGermanySnapshot();
		if(snapshotText && evt.detail && typeof evt.detail === 'object'){
			evt.detail.snapshotText = snapshotText;
		}
	}

	requestChartObj(fields){
		let params = null;
		if(fields){
			params = fieldsToParams(fields);
		}else{
			params = this.genParams();
		}
		this.requestChart(params);
	}

	genParams(){
		let fields = this.props.fields;
		let params = fieldsToParams(fields);
		return params;
	}

	onFieldsChange(values){
		let flds = {
			...this.props.fields,
			...values
		};
		this.requestChartObj(flds);

		if(this.props.onChange){
			this.props.onChange(values);
		}		
	}

	componentDidMount(){
		this.unmounted = false;
		if(typeof window !== 'undefined' && window.addEventListener){
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
		this.scheduleSnapshotSave(undefined, undefined);
	}

	componentDidUpdate(prevProps, prevState){
		if(
			prevState.midpoints !== this.state.midpoints
			|| prevProps.chart !== this.props.chart
			|| prevProps.fields !== this.props.fields
		){
			this.scheduleSnapshotSave(undefined, undefined);
		}
	}

	componentWillUnmount(){
		this.flushSnapshotSave();
		this.unmounted = true;
		if(typeof window !== 'undefined' && window.removeEventListener){
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}

	render(){
		let fields = this.props.fields;
		let height = this.props.height ? this.props.height : 760;
		let chartObj = {
			midpoints: this.state.midpoints,
			chartObj: this.props.chart,
		}

		return (
			<div className="horosa-midpoint-host">
					<MidpointMain
						value={chartObj}
						onChange={this.onFieldsChange}
						fields={fields}
						height={height}
						wheelArt={this.props.wheelArt}
						chartDisplay={this.props.chartDisplay}
						planetDisplay={this.props.planetDisplay}
						lotsDisplay={this.props.lotsDisplay}
						showAstroMeaning={this.props.showAstroMeaning}
					/>
			</div>
		);
	}
}

export default AstroMidpoint;
