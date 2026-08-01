import { Component } from 'react';
// PERF-R9 Ship 7(Windows-ahead):技法步进预取登记 —— 与上游的懒加载改造无关,勿一并删。
// ★ 2026-08-02 教训:上游 v3.6.2 把天球改懒加载时重写了 import 区,我方补丁的 import hunk
// 整块被拒,而下面用到这两个符号的 hunk 却应用成功 ⇒ 用法在、绑定没有 = 打开星运页即
// ReferenceError(与 gotcha #84 逐字同型)。符号绑定门 v2 会拦,但别再让它跑到门那一步。
import { stepPrefetchEnabled } from '../../utils/perfFlags';
import { registerStepPrefetcher } from '../../utils/stepPrefetch';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { safeJsonParseFromStorage } from '../../utils/safeStorage';
import { Row, Col, message, } from 'antd';
import { XQTabs as Tabs } from '../xq-ui';
import DateTime from '../comp/DateTime';
import AstroPrimaryDirection from '../astro/AstroPrimaryDirection';
import AstroPrimaryDirectionChart from '../astro/AstroPrimaryDirectionChart';
// 🔴 主限天球必须懒加载,绝不可改回静态 import(2026-08-01 用户实报「进入星运台卡死」的真因):
//   静态引它 → AstroPDSphere → PDSphereEngine → three,整条链成为本页 chunk 的**同步依赖**,
//   于是只要进星运页,模块求值期就得先解析完 three(vendors-gl 862KB)+ 引擎(90KB);
//   而本页默认停在「主限法」表格,二十多个子页签里只有「主限天球」一个用得着 3D ——
//   从不打开天球的用户每次进页都白等这份解析,配置一般的机器足以让主线程长时间无响应。
//   本页又是 idle 预取队列 order:1(优先级最高),连「从不进星运页」的用户都可能在空闲期吃到它。
//   天球子页签是 TabPane + FreezeInactive(不激活不挂载),故懒化后「不打开=零成本」天然成立;
//   FreezeInactive.render 自带 TechniqueErrorBoundary,此处无需再包一层边界。
import { makeLazyBoundary, idleWarm } from '../../utils/lazyBoundary';
const AstroPDSphere = makeLazyBoundary(
	() => import(/* webpackChunkName: "pd-sphere" */ '../astro3d/AstroPDSphere'),
	{ label: '主限天球', tip: '主限天球加载中…' }
);
import AstroZR from '../astro/AstroZR';
import AstroFirdaria from '../astro/AstroFirdaria';
import AstroDistributions from '../astro/AstroDistributions';
import AstroAgePoint from '../astro/AstroAgePoint';
import AstroSolarReturn from '../astro/AstroSolarReturn';
import AstroLunarReturn from '../astro/AstroLunarReturn';
import AstroGivenYear from '../astro/AstroGivenYear';
import AstroSolarArc from '../astro/AstroSolarArc';
import AstroProfection from '../astro/AstroProfection';
import AstroDecennials from '../astro/AstroDecennials';
import AstroPlanetaryAges from '../astro/AstroPlanetaryAges';
import AstroVedicProgressions from '../astro/AstroVedicProgressions';
import AstroBalbillus from '../astro/AstroBalbillus';
import AstroTriplicityRulers from '../astro/AstroTriplicityRulers';
import AstroKeypoints from '../astro/AstroKeypoints';
import AstroLunationPhase from '../astro/AstroLunationPhase';
import AstroExtraReturns from '../astro/AstroExtraReturns';
import { getFirdariaInterp } from '../../utils/firdariaInterp';
import AstroYearSystem129 from '../astro/AstroYearSystem129';
import AstroPlanetaryArc from '../astro/AstroPlanetaryArc';
import AstroPersianDirected from '../astro/AstroPersianDirected';
import AstroJaynesProgressions from '../astro/AstroJaynesProgressions';
import AstroEphemeris from '../astro/AstroEphemeris';
import AstroProgressions from '../astro/AstroProgressions';
import AstroReturnTimeline from '../astro/AstroReturnTimeline';
import AstroPrenatalSyzygy from '../astro/AstroPrenatalSyzygy';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import * as AstroHelper from '../astro/AstroHelper';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { saveModuleAISnapshot, } from '../../utils/moduleAiSnapshot';
import { buildCurrentMomentLines, buildMethodNoteLines, } from '../../utils/astroAiSnapshot';
import { appendPlanetHouseInfoById, } from '../../utils/planetHouseInfo';

// [YB v42] 补厚 helper 容错:个别测试套件整模块 mock astroAiSnapshot 且只保留部分导出(如 aiAnalysisContext.test),
// 缺失导出经 import 拿到 undefined → 直接调用会炸掉整个 builder;生产环境恒为函数,此守卫零行为差。
const safeHelperLines = (fn, ...args)=>(typeof fn === 'function' ? fn(...args) : []);
import {
	PD_SYNC_REV,
	DEFAULT_PD_METHOD,
	DEFAULT_PD_TIME_KEY,
	DEFAULT_PD_TYPE,
	mergePrimaryDirectionChartObj,
	normalizePrimaryDirectionSubTabKey,
	getPdMethodLabel,
	getPdTimeKeyLabel,
	PD_PROJECTION_LABELS,
	PD_FRAME_LABELS,
	PD_FRAMEWORK_LABELS,
} from '../../utils/primaryDirectionSync';
import FreezeInactive from '../comp/FreezeInactive';

const TabPane = Tabs.TabPane;
const AI_EXPORT_PLANET_INFO = {
	showHouse: 1,
	showRuler: 1,
};
const CORE_PD_SUPPORTED_BASE_IDS = new Set([
	AstroConst.SUN,
	AstroConst.MOON,
	AstroConst.MERCURY,
	AstroConst.VENUS,
	AstroConst.MARS,
	AstroConst.JUPITER,
	AstroConst.SATURN,
	AstroConst.URANUS,
	AstroConst.NEPTUNE,
	AstroConst.PLUTO,
	AstroConst.NORTH_NODE,
	AstroConst.PARS_FORTUNA,
	AstroConst.ASC,
	AstroConst.MC,
	AstroConst.VERTEX,
]);

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

function msgWithHouse(chartObj, id){
	return appendPlanetHouseInfoById(
		msg(id),
		chartObj,
		id,
		AI_EXPORT_PLANET_INFO
	);
}

function degreeText(value, pdMethod){
	if(pdMethod === 'horosa_legacy'){
		const deg = AstroHelper.splitDegree(value);
		return `${deg[0]}度${deg[1]}分`;
	}
	const num = Number(value);
	if(Number.isNaN(num)){
		return `${value || ''}`.trim();
	}
	const neg = num < 0 ? '-' : '';
	const abs = Math.abs(num);
	const d = Math.floor(abs);
	let m = Math.floor((abs - d) * 60);
	if(m >= 60){
		m = 0;
	}
	return `${neg}${d}度${m}分`;
}

// 方位法 / 时间换算的显示名统一走 primaryDirectionSync 的权威 label 字典(覆盖全部方位法与时间换算)，
// 供 AI 导出 / AI 挂载快照复用。此前这里只识别 horosa_legacy、其余一律回退 'Alchabitius'，
// 会把 Placidus / Regiomontanus / Meridian 等全部误标为 Alchabitius——已并入共享字典消除分叉。
function primaryDirectionMethodText(val){
	return getPdMethodLabel(val);
}

function primaryDirectionTimeKeyText(val){
	return getPdTimeKeyLabel(val);
}

// S/P 扩展本体的语义短名(N_Cusp3_0/N_Syzygy_0/N_Spirit_0 等;非扩展体返回 null 走 msgWithHouse)
function extDirectionBaseText(base){
	const b = `${base || ''}`;
	const mc = /^Cusp(\d+)$/.exec(b);
	if(mc){
		return `第${mc[1]}宫头`;
	}
	if(b === 'Syzygy'){
		return '产前朔望';
	}
	if(b === 'Spirit'){
		return '精神点';
	}
	return null;
}

function directionObjText(text, chartObj){
	if(!text){
		return '';
	}
	const parts = `${text}`.split('_');
	if(parts.length < 2){
		return `${text}`;
	}
	const bodyText = (b)=>extDirectionBaseText(b) || msgWithHouse(chartObj, b);
	if(parts[0] === 'T'){
		return `${msgWithHouse(chartObj, parts[2])}的${msgWithHouse(chartObj, parts[1])}界`;
	}
	if(parts[0] === 'A'){
		return `${bodyText(parts[1])}的映点`;
	}
	if(parts[0] === 'C'){
		return `${bodyText(parts[1])}的反映点`;
	}
	if(parts[0] === 'D'){
		return `${bodyText(parts[1])}的${parts[2]}度右相位处`;
	}
	if(parts[0] === 'S'){
		return `${bodyText(parts[1])}的${parts[2]}度左相位处`;
	}
	if(parts[0] === 'N'){
		if(parts[2] && parts[2] !== '0'){
			return `${bodyText(parts[1])}的${parts[2]}度相位处`;
		}
		return `${bodyText(parts[1])}`;
	}
	// P2 扩展迫星七前缀(与表格 convertText 语义同源,纯文本版;绝不裸 ID 出快照/导出)
	if(parts[0] === 'PD'){
		return `${bodyText(parts[1])}的赤纬平行点`;
	}
	if(parts[0] === 'PC'){
		return `${bodyText(parts[1])}的反平行点`;
	}
	if(parts[0] === 'MP' || parts[0] === 'RP'){
		const axis = { '0': 'MC', '90': 'ASC', '180': 'IC', '270': 'DSC' }[parts[2]] || parts[2];
		return `${bodyText(parts[1])}的${parts[0] === 'MP' ? '世界平行' : '急动平行'}·${axis}`;
	}
	if(parts[0] === 'FS'){
		return `恒星 ${msgWithHouse(chartObj, parts[1]) || parts[1]}`;
	}
	if(parts[0] === 'LT'){
		return `${`${parts[1]}`.replace(/^Pars /, '')}点`;
	}
	if(parts[0] === 'HC'){
		const mh = /^Cusp(\d+)$/.exec(`${parts[1] || ''}`);
		return `第${mh ? mh[1] : parts[1]}宫头`;
	}
	return `${text}`;
}

function isBoundDirectionRow(pd){
	if(!pd || !pd.length){
		return false;
	}
	const promittor = pd[1] ? `${pd[1]}` : '';
	const significator = pd[2] ? `${pd[2]}` : '';
	return promittor.indexOf('T_') === 0 || significator.indexOf('T_') === 0;
}

function baseDirectionObjectId(text){
	const parts = `${text || ''}`.split('_');
	if(parts.length < 3){
		if(parts.length === 2 && (parts[0] === 'A' || parts[0] === 'C')){
			return parts[1];
		}
		return `${text || ''}`.trim();
	}
	if(parts[0] === 'T'){
		return `${parts[1] || ''}`.trim();
	}
	return parts.slice(1, parts.length - 1).join('_').trim();
}

function isCoreUnsupportedDirectionRow(pd){
	if(!pd || !pd.length){
		return false;
	}
	if(isBoundDirectionRow(pd)){
		return true;
	}
	const promBase = baseDirectionObjectId(pd[1]);
	const sigBase = baseDirectionObjectId(pd[2]);
	return !CORE_PD_SUPPORTED_BASE_IDS.has(promBase) || !CORE_PD_SUPPORTED_BASE_IDS.has(sigBase);
}

function appendBirthAndChartInfo(lines, chartObj){
	const obj = chartObj || {};
	const params = obj.params || {};
	const chart = obj.chart || {};
	lines.push('[出生时间]');
	if(params.birth){
		lines.push(`出生时间：${params.birth}${chart.dayofweek ? ` ${chart.dayofweek}` : ''}`);
	}else{
		lines.push('出生时间：无');
	}
	if(chart.nongli && chart.nongli.birth){
		lines.push(`真太阳时：${chart.nongli.birth}`);
	}

	lines.push('');
	lines.push('[星盘信息]');
	if(params.lon || params.lat){
		lines.push(`经纬度：${params.lon || ''} ${params.lat || ''}`.trim());
	}
	if(params.zone !== undefined && params.zone !== null){
		lines.push(`时区：${params.zone}`);
	}
	const zodiacalRaw = chart.zodiacal || AstroConst.ZODIACAL[`${params.zodiacal}`];
	const zodiacal = zodiacalRaw === AstroConst.SIDEREAL ? (AstroText.AstroTxtMsg[AstroConst.SIDEREAL] || zodiacalRaw) : zodiacalRaw;
	if(zodiacal){
		lines.push(`黄道：${zodiacal}`);
	}
	const hsys = AstroConst.HouseSys[`${params.hsys}`] || chart.hsys;
	if(hsys){
		lines.push(`宫制：${hsys}`);
	}
	if(chart.isDiurnal !== undefined && chart.isDiurnal !== null){
		lines.push(`盘型：${chart.isDiurnal ? '日生盘' : '夜生盘'}`);
	}
}

function buildPrimaryDirectSnapshotText(chartObj){
	const lines = [];
	const obj = chartObj || {};
	const allPds = obj.predictives && Array.isArray(obj.predictives.primaryDirection) ? obj.predictives.primaryDirection : [];
	const showPdBounds = !(obj.params && (obj.params.showPdBounds === 0 || obj.params.showPdBounds === false));
	const pdMethod = obj.params && obj.params.pdMethod ? obj.params.pdMethod : 'core_alchabitius';
	const pdTimeKey = obj.params && obj.params.pdTimeKey ? obj.params.pdTimeKey : 'Ptolemy';
	const degreeLabel = pdMethod === 'horosa_legacy' ? '赤经' : 'Arc';
	// 与表格 convertToDataSource 口径一致:showPdBounds 只隐藏 core_alchabitius 的界限法行;
	// 新方位法的界(T_)行只在 pdTerms 勾选时产出,应随导出/挂载显示(否则用户勾了界、AI 导出却没有)。
	// 🔴 S/P 扩展行放行(与表格 isExtensionRow 同构):core 白名单是「历史默认体」集,
	// 用户勾选产生的扩展行(HC_/FS_/LT_/平行 PD_/PC_/MP_/RP_ 迫星、Cusp/恒星/阿点/朔望/精神点应星)
	// 被它误滤 = AI 导出/挂载快照永远缺扩展行(表格显示与 ground-truth 不一致)。
	const extParams = obj.params || {};
	const extSigKeys = Array.isArray(extParams.pdSignificators) ? extParams.pdSignificators : [];
	const isExtensionDirectionRow = (pd)=>{
		const prom = `${(pd && pd[1]) || ''}`;
		if(/^(HC|FS|LT|PD|PC|MP|RP)_/.test(prom)){ return true; }
		if(!extSigKeys.length){ return false; }
		const sigBase = `${(pd && pd[2]) || ''}`.split('_')[1] || '';
		if(extSigKeys.indexOf('Desc') >= 0 && sigBase === 'Desc'){ return true; }
		if(extSigKeys.indexOf('IC') >= 0 && sigBase === 'IC'){ return true; }
		if(extSigKeys.indexOf('Syzygy') >= 0 && sigBase === 'Syzygy'){ return true; }
		if(extSigKeys.indexOf('Spirit') >= 0 && sigBase === 'Spirit'){ return true; }
		if(extSigKeys.indexOf('Cusps') >= 0 && /^Cusp\d+$/.test(sigBase)){ return true; }
		if((extSigKeys.indexOf('Stars') >= 0 || extSigKeys.indexOf('Lots') >= 0)
			&& sigBase && !/^(Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto)$/.test(sigBase)){
			return true;
		}
		return false;
	};
	const pds = allPds.filter((pd)=>{
		if(pdMethod === 'core_alchabitius' && isCoreUnsupportedDirectionRow(pd) && !isExtensionDirectionRow(pd)){
			return false;
		}
		if(!showPdBounds && pdMethod === 'core_alchabitius' && isBoundDirectionRow(pd)){
			return false;
		}
		return true;
	});

	appendBirthAndChartInfo(lines, obj);

	const pdParams = obj.params || {};
	const pdTypeText = pdParams.pdtype === 1 ? '世俗（In Mundo）' : '黄道（In Zodiaco）';
	const wantDirect = pdParams.pdDirect === 0 ? false : true;
	const wantConverse = !!pdParams.pdConverse;
	let pdDirText = '顺向 Direct';
	if(wantDirect && wantConverse){
		pdDirText = '顺向 Direct + 逆向 Converse';
	}else if(wantConverse){
		pdDirText = '逆向 Converse';
	}
	lines.push('');
	lines.push('[主限法设置]');
	lines.push(`推运方法：${primaryDirectionMethodText(pdMethod)}`);
	lines.push(`度数换算：${primaryDirectionTimeKeyText(pdTimeKey)}`);
	lines.push(`方向类型：${pdTypeText}`);
	lines.push(`向运方向：${pdDirText}`);
	lines.push(`映点迫星：${pdParams.pdAntiscia ? '是' : '否'}`);
	lines.push(`界迫星：${pdParams.pdTerms ? '是' : '否'}`);
	// 解耦九键设置行(AI 解读 ground-truth 与盘同口径;默认值也照实写,便于 LLM 对照)
	let projLabel = PD_PROJECTION_LABELS[pdParams.pdProjection] || pdParams.pdProjection || 'Ptolemy（半弧）';
	// 诚实回显:世界主限(pdtype=1)只有定局四法有各自实现,其余投影(纯黄道弧语义)
	// 统一走核内世俗基线 —— 曾照抄所选投影名,四种选择输出逐字节相同却显示四个名字。
	const PROJ_WITH_MUNDO = ['placidus', 'regiomontanus', 'campanus', 'topocentric'];
	if(Number(pdParams.pdtype) === 1 && PROJ_WITH_MUNDO.indexOf(pdParams.pdProjection) < 0){
		projLabel += '（世界主限下走核内基线）';
	}
	const frameLabel = PD_FRAME_LABELS[pdParams.pdFrame] || pdParams.pdFrame || 'Alcabitius';
	const fwLabel = PD_FRAMEWORK_LABELS[pdParams.pdFramework] || pdParams.pdFramework || '相位主限';
	lines.push(`弧算法（投影）：${projLabel}`);
	lines.push(`盘面宫制（分宫）：${frameLabel}`);
	lines.push(`框架：${fwLabel}`);
	if(pdParams.pdParallel){
		lines.push(`平行迫星：${pdParams.pdtype === 1 ? '世界平行' : '赤纬平行（映点法）'}`);
	}
	if(pdParams.pdRaptParallel){
		lines.push('急动平行迫星：是');
	}
	if(pdParams.termsVariant === 1 || pdParams.termsVariant === 2){
		lines.push(`界系：${pdParams.termsVariant === 1 ? '托勒密界' : '莉莉界'}`);
	}
	if(pdParams.pdTimeKey === 'User' && pdParams.pdTimeKeyCustom){
		lines.push(`自定义钥匙率：${pdParams.pdTimeKeyCustom}°/年`);
	}
	if(Array.isArray(pdParams.pdSignificators) && pdParams.pdSignificators.length){
		lines.push(`应星扩展：${pdParams.pdSignificators.join('、')}`);
	}
	if(Array.isArray(pdParams.pdPromissorTypes) && pdParams.pdPromissorTypes.length){
		lines.push(`迫星扩展：${pdParams.pdPromissorTypes.join('、')}`);
	}
	lines.push(`显示界限法：${showPdBounds ? '是' : '否'}`);

	lines.push('');
	lines.push('[主限法表格]');
	lines.push(`| ${degreeLabel} | 迫星 | 应星 | 日期 |`);
	lines.push('| --- | --- | --- | --- |');
	if(pds.length === 0){
		lines.push('| 无 | 无 | 无 | 无 |');
	}else{
		pds.forEach((pd)=>{
			const degree = degreeText(pd && pd[0], pdMethod);
			const promittor = directionObjText(pd && pd[1], obj);
			const significator = directionObjText(pd && pd[2], obj);
			const date = pd && pd[4] ? `${pd[4]}` : '';
			lines.push(`| ${degree || '无'} | ${promittor || '无'} | ${significator || '无'} | ${date || '无'} |`);
		});
	}
	// [YB v42] 尾部补 [当前时点]/[方法说明](共享 helper;段头已登 preset;只动 primarydirect 这一支 builder)。
	// extraLines 提示行:表中日期距今最近的 arc 行(帮 AI 从长表中锚定当下应期;解析不出日期则省略)。
	let nearestLine = '';
	if(pds.length){
		const nowMs = Date.now();
		let best = null;
		pds.forEach((pd)=>{
			const t = Date.parse(`${(pd && pd[4]) || ''}`.trim().replace(/\//g, '-'));
			if(Number.isNaN(t)){ return; }
			const dist = Math.abs(t - nowMs);
			if(!best || dist < best.dist){ best = { pd, dist }; }
		});
		if(best){
			const bpd = best.pd;
			nearestLine = `表中距今最近行：${degreeText(bpd && bpd[0], pdMethod) || '无'}（${directionObjText(bpd && bpd[1], obj) || '无'} → ${directionObjText(bpd && bpd[2], obj) || '无'}，${bpd && bpd[4] ? `${bpd[4]}` : '无'}）`;
		}
	}
	// [WP-5.5] 主限天球可选行:用户最近在 3D 球上选中/播放的向运(≤24h 有效,防跨日陈旧)。
	// 文本由 AstroPDSphere 从选中 row 既有字段拼好盖章,此处只读不再推导。
	const sphereStamp = safeJsonParseFromStorage('horosa.pdsphere.aiCurrentRow');
	if(sphereStamp && sphereStamp.txt && Number.isFinite(sphereStamp.ts) && (Date.now() - sphereStamp.ts) < 24 * 3600 * 1000){
		lines.push('');
		lines.push('[主限天球·当前动画所指]');
		lines.push(`${sphereStamp.txt}`);
	}
	lines.push('');
	lines.push(...safeHelperLines(buildCurrentMomentLines, obj, nearestLine ? [nearestLine] : []));
	lines.push(...safeHelperLines(buildMethodNoteLines, 'primarydirect'));
	while(lines.length && lines[lines.length - 1] === ''){ lines.pop(); }
	return lines.join('\n');
}

function buildFirdariaSnapshotText(chartObj){
	const lines = [];
	const obj = chartObj || {};
	const firdaria = obj.predictives && Array.isArray(obj.predictives.firdaria) ? obj.predictives.firdaria : [];
	appendBirthAndChartInfo(lines, obj);

	lines.push('');
	lines.push('[法达星限表格]');
	lines.push('| 主限 | 子限 | 日期 |');
	lines.push('| --- | --- | --- |');
	if(firdaria.length === 0){
		lines.push('| 无 | 无 | 无 |');
	}else{
		let rowCount = 0;
		firdaria.forEach((main)=>{
			const mainDirect = msgWithHouse(obj, main && main.mainDirect);
			const subs = main && Array.isArray(main.subDirect) ? main.subDirect : [];
			if(subs.length === 0){
				lines.push(`| ${mainDirect || '无'} | 无 | 无 |`);
				rowCount += 1;
				return;
			}
			subs.forEach((sub)=>{
				const subDirect = msgWithHouse(obj, sub && sub.subDirect);
				const date = sub && sub.date ? `${sub.date}` : '';
				lines.push(`| ${mainDirect || '无'} | ${subDirect || '无'} | ${date || '无'} |`);
				rowCount += 1;
			});
		});
		if(rowCount === 0){
			lines.push('| 无 | 无 | 无 |');
		}
	}
	// 法达解读层：逐主限时段主题（并入「法达星限表格」段，无需新增预设段）。
	if(firdaria.length){
		lines.push('');
		lines.push('解读：');
		firdaria.forEach((main)=>{
			const interp = getFirdariaInterp(main && main.mainDirect);
			if(interp){ lines.push(`· ${interp.mainShort}主限 — ${interp.mainTheme}`); }
		});
	}
	// [独立复核修] v42 preset 已声明 当前时点/方法说明——D/E 组补厚唯独漏接 firdaria(死段:勾了导不出)。
	lines.push('');
	lines.push(...safeHelperLines(buildCurrentMomentLines, obj, []));
	lines.push(...safeHelperLines(buildMethodNoteLines, 'firdaria'));
	while(lines.length && lines[lines.length - 1] === ''){ lines.pop(); }
	return lines.join('\n');
}

function normalizePdYears(v){
	const n = Math.round(Number(v));
	if(!Number.isFinite(n)){
		return 100;
	}
	return Math.max(1, Math.min(3000, n));
}

function buildPrimaryDirectionFetchFields(baseFields, chartObj, pdMethod, pdTimeKey, pdYears, options){
	const fields = {
		...(baseFields || {}),
	};
	const opt = options || {};
	const pdtypeVal = (opt.pdtype === 1) ? 1 : 0;
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
	fields.showPdBounds = {
		...(fields.showPdBounds || { name: ['showPdBounds'] }),
		value: params.showPdBounds === 0 ? 0 : 1,
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
	fields.cid = {
		...(fields.cid || { name: ['cid'] }),
		value: null,
	};
	return fields;
}

// PERF-R8 P2:主限配置/请求构造抽为模块级纯函数 —— 原类方法逻辑逐字搬移(解析顺序
// override → chart.params → fields → 默认 不变),类方法纯委托。数据层预热复用同一构造,
// key/body 与真实首点逐字节一致。
function getDesiredPdConfigPure(chartObj, fields, override = {}){
	const chart = chartObj || {};
	const params = chart.params || {};
	const flds = fields || {};
	const pick = (key)=>{
		if(override[key] !== undefined && override[key] !== null){
			return override[key];
		}
		if(params[key] !== undefined && params[key] !== null){
			return params[key];
		}
		if(flds[key] && flds[key].value !== undefined && flds[key].value !== null){
			return flds[key].value;
		}
		return undefined;
	};
	const toFlag = (v)=>(v === true || v === 1 || v === '1' || v === 'true') ? 1 : 0;
	// 顺向 / 逆向 默认都开(用户偏好「顺逆都开」):仅显式 0/false 才关。
	const offIf = (v)=>(v === 0 || v === '0' || v === false || v === 'false') ? 0 : 1;
	const pdDirect = offIf(pick('pdDirect'));
	const pdConverse = offIf(pick('pdConverse'));
	return {
		pdMethod: override.pdMethod || (params.pdMethod
			? params.pdMethod
			: (flds.pdMethod ? flds.pdMethod.value : DEFAULT_PD_METHOD)),
		pdTimeKey: override.pdTimeKey || (params.pdTimeKey
			? params.pdTimeKey
			: (flds.pdTimeKey ? flds.pdTimeKey.value : DEFAULT_PD_TIME_KEY)),
		pdYears: normalizePdYears(override.pdYears !== undefined && override.pdYears !== null ? override.pdYears
			: (params.pdYears !== undefined && params.pdYears !== null ? params.pdYears
			: (flds.pdYears ? flds.pdYears.value : 100))),
		pdtype: toFlag(pick('pdtype')),
		pdDirect,
		pdConverse,
		pdAntiscia: toFlag(pick('pdAntiscia')),
		pdTerms: toFlag(pick('pdTerms')),
		// P0 解耦补齐维:投影/定局/框架/平行×2/自定义率/S·P 清单/界系(默认=引擎缺省)。
		pdProjection: pick('pdProjection') || 'ptolemy',
		pdFrame: pick('pdFrame') || 'alcabitius',
		pdFramework: pick('pdFramework') || 'aspect',
		pdParallel: toFlag(pick('pdParallel')),
		pdRaptParallel: toFlag(pick('pdRaptParallel')),
		pdTimeKeyCustom: (()=>{ const v = pick('pdTimeKeyCustom'); const n = Number(v); return (v !== undefined && Number.isFinite(n) && n > 0) ? n : null; })(),
		pdSignificators: Array.isArray(pick('pdSignificators')) && pick('pdSignificators').length ? pick('pdSignificators') : null,
		pdPromissorTypes: Array.isArray(pick('pdPromissorTypes')) && pick('pdPromissorTypes').length ? pick('pdPromissorTypes') : null,
		termsVariant: (()=>{ const v = Number(pick('termsVariant')); return (v === 1 || v === 2) ? v : 0; })(),
	};
}

function buildPrimaryDirectionRequestPure(chartObj, fields, override = {}){
	const chart = chartObj || {};
	// 与原类方法逐字对齐:配置解析用「组件 props.fields 对应位」(本参数 fields),
	// fetch-fields 基底允许 override.fields 覆盖 —— 两处兜底语义不合并。
	const desired = getDesiredPdConfigPure(chart, fields, override);
	const nextFields = buildPrimaryDirectionFetchFields(
		override.fields || fields,
		chart,
		desired.pdMethod,
		desired.pdTimeKey,
		desired.pdYears,
		{
			pdtype: desired.pdtype,
			direct: desired.pdDirect === 1,
			converse: desired.pdConverse === 1,
			antiscia: desired.pdAntiscia === 1,
			terms: desired.pdTerms === 1,
		}
	);
	const dateValue = nextFields.date && nextFields.date.value;
	const timeValue = nextFields.time && nextFields.time.value;
	if(!dateValue || !timeValue || !dateValue.format || !timeValue.format){
		return null;
	}
	const dateStr = dateValue.format('YYYY/MM/DD');
	const timeStr = timeValue.format('HH:mm:ss');
	// 畸形日期(NaN)绝不发请求——否则后端 Datetime 抛错弹「param error」。
	if(`${dateStr}`.indexOf('NaN') >= 0 || `${timeStr}`.indexOf('NaN') >= 0){
		return null;
	}
	return {
		date: dateStr,
		time: timeStr,
		ad: nextFields.ad && nextFields.ad.value !== undefined ? nextFields.ad.value : (dateValue.ad !== undefined ? dateValue.ad : 1),
		zone: nextFields.zone ? nextFields.zone.value : undefined,
		lat: nextFields.lat ? nextFields.lat.value : undefined,
		lon: nextFields.lon ? nextFields.lon.value : undefined,
		gpsLat: nextFields.gpsLat ? nextFields.gpsLat.value : undefined,
		gpsLon: nextFields.gpsLon ? nextFields.gpsLon.value : undefined,
		hsys: nextFields.hsys ? nextFields.hsys.value : 0,
		southchart: nextFields.southchart ? nextFields.southchart.value : 0,
		zodiacal: nextFields.zodiacal ? nextFields.zodiacal.value : 0, siderealAyanamsa: nextFields.siderealAyanamsa ? nextFields.siderealAyanamsa.value : '',
		tradition: nextFields.tradition ? nextFields.tradition.value : 0,
		strongRecption: nextFields.strongRecption ? nextFields.strongRecption.value : 0,
		simpleAsp: nextFields.simpleAsp ? nextFields.simpleAsp.value : 0,
		virtualPointReceiveAsp: nextFields.virtualPointReceiveAsp ? nextFields.virtualPointReceiveAsp.value : 0,
		doubingSu28: nextFields.doubingSu28 ? nextFields.doubingSu28.value : 0,
		predictive: true,
		includePrimaryDirection: true,
		showPdBounds: nextFields.showPdBounds ? nextFields.showPdBounds.value : 1,
		pdtype: desired.pdtype,
		pdMethod: desired.pdMethod,
		pdTimeKey: desired.pdTimeKey,
		pdYears: desired.pdYears,
		pdDirect: desired.pdDirect,
		pdConverse: desired.pdConverse,
		pdAntiscia: desired.pdAntiscia,
		pdTerms: desired.pdTerms,
		pdProjection: desired.pdProjection,
		pdFrame: desired.pdFrame,
		pdFramework: desired.pdFramework,
		pdParallel: desired.pdParallel,
		pdRaptParallel: desired.pdRaptParallel,
		...(desired.pdTimeKeyCustom ? { pdTimeKeyCustom: desired.pdTimeKeyCustom } : {}),
		...(desired.pdSignificators ? { pdSignificators: desired.pdSignificators } : {}),
		...(desired.pdPromissorTypes ? { pdPromissorTypes: desired.pdPromissorTypes } : {}),
		termsVariant: desired.termsVariant,
		pdaspects: nextFields.pdaspects ? nextFields.pdaspects.value : [0, 60, 90, 120, 180],
		name: nextFields.name ? nextFields.name.value : null,
		pos: nextFields.pos ? nextFields.pos.value : null,
		cid: null,
	};
}

// PERF-R8 P2(数据层空闲预热):按当前盘+默认主限配置预热 /predict/pd —— 与星运首点
// (默认子页 primarydirect)同一构造、同一 url+body → requestDedupe L1/L2 命中(10min 内
// 首点 ≈0ms;超窗回落后端 paramhash 盘 ~百毫秒)。silent 且丢弃结果:绝不 dispatch、
// 绝不触碰全局 state(组件路径的 savePrimaryDirectionRows 副作用与预热无关)。失败静默。
export async function warmPrimaryDirection(chartObj, fields){
	try{
		const req = buildPrimaryDirectionRequestPure(chartObj, fields, {});
		if(!req){ return null; }
		return await request(`${Constants.ServerRoot}/predict/pd`, {
			body: JSON.stringify(req),
			cache: 'no-store',
			silent: true,
			// PERF-R9 Ship 7:预热/预取一律零重试(显式声明,不吃任何调用链上的重试默认值)——
			// 后端重启窗口里 N 个深度预取绝不能变成 N×10 次退避重试风暴。
			retry: { retries: 0 },
		});
	}catch(e){
		return null; // 预热失败静默:首点回到冷即付的现状
	}
}

function unwrapPredictiveResponse(data){
	if(!data || typeof data !== 'object'){
		return null;
	}
	if(data[Constants.ResultKey] && typeof data[Constants.ResultKey] === 'object'){
		return data[Constants.ResultKey];
	}
	return data;
}

function isPrimaryDirectionTabKey(key){
	// primarydirsphere(WS-3 主限天球)同吃 PD 表行:行数据是 AI 快照(复用主限表段)
	// 与 chart.params pd 系持久化的单一来源,天球自身的 /predict/pd3d 不落盘。
	return key === 'primarydirect' || key === 'primarydirchart' || key === 'primarydirsphere';
}

class AstroDirectMain extends Component{
	// [R3-A6] 渲染守卫:宿主无关 dispatch 不再全树重渲(nextState 引用变照常放行;
	// 开关 horosa.perf.chartSCU,语义详 chartUpdateGuard.wrapperPropsEqual)。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){
			return true;
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}


	constructor(props) {
		super(props);
		const initialTab = normalizePrimaryDirectionSubTabKey(props.currentSubTab);

		this.state = {
			currentTab: initialTab,
			hook:{
				primarydirect:{
					fun: null
				},
				primarydirchart:{
					fun: null
				},
				primarydirsphere:{
					fun: null
				},
				firdaria:{
					fun: null
				},
				distributions:{
					fun: null
				},
				agepoint:{
					fun: null
				},
				profection:{
					fun: null
				},
				solararc:{
					fun: null
				},
				solarreturn:{
					fun: null
				},
				lunarreturn:{
					fun: null
				},
				givenyear:{
					fun: null
				},
				decennials:{
					fun: null
				},
				planetaryages:{
					fun: null
				},
				vedicprog:{
					fun: null
				},
				balbillus:{
					fun: null
				},
				triplicityrulers:{
					fun: null
				},
				keypoints:{
					fun: null
				},
				lunationphase:{
					fun: null
				},
				extrareturns:{
					fun: null
				},
				yearsystem129:{
					fun: null
				},
				planetaryarc:{
					fun: null
				},
				persiandirected:{
					fun: null
				},
				jaynesprog:{
					fun: null
				},
					zodialrelease:{
						fun: null
					},
					ephemeris:{
						fun: null
					},
					progressions:{
						fun: null
					},
					returntimeline:{
						fun: null
					},
					prenatalsyzygy:{
						fun: null
					},

				},
		};

		this.changeTab = this.changeTab.bind(this);
		this.applyPrimaryDirectionConfig = this.applyPrimaryDirectionConfig.bind(this);
		this.saveDirectionSnapshot = this.saveDirectionSnapshot.bind(this);
		this.savePrimaryDirectSnapshot = this.savePrimaryDirectSnapshot.bind(this);
		this.saveFirdariaSnapshot = this.saveFirdariaSnapshot.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
		this.ensurePrimaryDirectionReady = this.ensurePrimaryDirectionReady.bind(this);
		this.requestPrimaryDirectionRows = this.requestPrimaryDirectionRows.bind(this);
		this.buildPrimaryDirectionRequest = this.buildPrimaryDirectionRequest.bind(this);
		this.getDesiredPdConfig = this.getDesiredPdConfig.bind(this);
		this.needsPrimaryDirectionLoad = this.needsPrimaryDirectionLoad.bind(this);
		this.syncCurrentSubTab = this.syncCurrentSubTab.bind(this);
		this.savePrimaryDirectionRows = this.savePrimaryDirectionRows.bind(this);

		this.unmounted = false;
		this.primaryDirectionInflightKey = '';
		this.primaryDirectionRequestSeq = 0;

		if(this.props.hook){
			this.props.hook.fun = (chartobj)=>{
				let hook = this.state.hook;
				if(hook[this.state.currentTab].fun){
					hook[this.state.currentTab].fun(chartobj);
				}
			};
			// PERF-R9 Ship 7:星运页默认子页(主限 primarydirect)的 /predict/pd 与主 /chart
			// 互不依赖(pd 的构参只吃 fields + 盘上的 pd 配置)—— 在 /chart 返回【之前】并行发出,
			// latency 从「网络 + 技法」变「max(网络, 技法)」。silent、丢结果、绝不 setState。
			// 闸:horosa.perf.prewarmRequests(模型层判定,关=此函数不被调用,逐字节旧序)。
			this.props.hook.prewarmRequests = (flds)=>{
				if(this.unmounted){
					return;
				}
				if(!isPrimaryDirectionTabKey(this.state.currentTab)){
					return;
				}
				try{
					warmPrimaryDirection(this.props.chartObj, flds || this.props.fields);
				}catch(e){ /* 预热失败无害:正式请求自兜底 */ }
			};
			// horosa_prefetch_registry_v1(PERF-R9 Ship 7):主限推运 /predict/pd 是确定性纯计算
			// (同 盘+主限配置 恒同表)→ 登记步进预取。构参走与首点同一 pure builder。
			// 🔴 登记必须在组件内:pd 配置来自组件所在页的 props/盘面态,模块级构不出同键 body。
			if(stepPrefetchEnabled()){
				registerStepPrefetcher('direction', (steppedFields)=>{
					if(this.unmounted || !isPrimaryDirectionTabKey(this.state.currentTab)){
						return [];
					}
					// 只有 date/time 随步进走;pd 配置(方法/年数/顺逆)取当前盘面 —— 与用户
					// 真点下一步时发出的 body 逐字节同键。
					if(!buildPrimaryDirectionRequestPure(this.props.chartObj, steppedFields, {})){
						return [];
					}
					return [{
						name: 'direction:pd',
						path: '/predict/pd',
						run: ()=> warmPrimaryDirection(this.props.chartObj, steppedFields),
					}];
				});
			}
		}

	}

	syncCurrentSubTab(){
		if(!this.props.dispatch){
			return;
		}
		const nextTab = normalizePrimaryDirectionSubTabKey(this.state.currentTab);
		if(this.props.currentSubTab === nextTab){
			return;
		}
		this.props.dispatch({
			type: 'astro/save',
			payload: {
				currentSubTab: nextTab,
			}
		});
	}

	getDesiredPdConfig(chartObj, override = {}){
		// PERF-R8 P2:逻辑原样抽为模块级纯函数(预热复用同一构造 → key/body 逐字节一致);
		// 本方法保持既有签名与解析语义(chartObj/props 兜底),纯委托零行为变化。
		return getDesiredPdConfigPure(chartObj || this.props.chartObj, this.props.fields, override);
	}

	buildPrimaryDirectionRequest(chartObj, override = {}){
		return buildPrimaryDirectionRequestPure(chartObj || this.props.chartObj, override.fields || this.props.fields, override);
	}

	needsPrimaryDirectionLoad(chartObj){
		if(!isPrimaryDirectionTabKey(this.state.currentTab)){
			return false;
		}
		const chart = chartObj || this.props.chartObj || {};
		const params = chart.params || {};
		const predictives = chart.predictives || {};
		const pds = Array.isArray(predictives.primaryDirection) ? predictives.primaryDirection : [];
		const desired = this.getDesiredPdConfig(chart);
		const hasCompleteParams = !!(
			params.pdMethod
			&& params.pdTimeKey
			&& params.pdtype !== undefined
			&& `${params.pdSyncRev || ''}` === PD_SYNC_REV
		);
		if((params.pdMethod || desired.pdMethod) !== desired.pdMethod){
			return true;
		}
		if((params.pdTimeKey || desired.pdTimeKey) !== desired.pdTimeKey){
			return true;
		}
		if(normalizePdYears(params.pdYears !== undefined && params.pdYears !== null ? params.pdYears : desired.pdYears) !== desired.pdYears){
			return true;
		}
		if(!hasCompleteParams){
			return true;
		}
		// 解耦九键漂移 → 重算(与 pdMethod 同级的真实算法维)。
		if((params.pdProjection || 'ptolemy') !== desired.pdProjection){ return true; }
		if((params.pdFrame || 'alcabitius') !== desired.pdFrame){ return true; }
		if((params.pdFramework || 'aspect') !== desired.pdFramework){ return true; }
		if(((params.pdParallel ? 1 : 0)) !== desired.pdParallel){ return true; }
		if(((params.pdRaptParallel ? 1 : 0)) !== desired.pdRaptParallel){ return true; }
		if(((params.termsVariant === 1 || params.termsVariant === 2) ? params.termsVariant : 0) !== desired.termsVariant){ return true; }
		// pdtype/pdDirect/pdConverse/pdAntiscia/pdTerms 现为真实选项,已随 chart.params 持久化;
		// desired(无 override)即取自 params,故自动加载不因开关而误触发(显式重算走表格「计算」按钮)。
		return pds.length === 0;
	}

	savePrimaryDirectionRows(chartObj, req, pdRows, options = {}){
		if(!this.props.dispatch){
			return;
		}
		// base 盘不完整(如 /chart 失败后 chartObj 为空)时绝不落盘:merge 会合成只有 pd 系
		// params、无 chart/无 params.zone 的部分态对象,写入全局后宿占/3D 等消费方按
		// chartObj truthy 解引用 .chart/.params.zone 即崩(2026-07-16 诊断实证链)。
		if(!chartObj || !chartObj.chart){
			return;
		}
		const nextChartObj = mergePrimaryDirectionChartObj(chartObj, {
			pdRows,
			showPdBounds: req.showPdBounds,
			pdMethod: req.pdMethod,
			pdTimeKey: req.pdTimeKey,
			pdYears: req.pdYears,
			pdtype: req.pdtype,
			pdDirect: req.pdDirect,
			pdConverse: req.pdConverse,
			pdAntiscia: req.pdAntiscia,
			pdTerms: req.pdTerms,
			pdProjection: req.pdProjection,
			pdFrame: req.pdFrame,
			pdFramework: req.pdFramework,
			pdParallel: req.pdParallel,
			pdRaptParallel: req.pdRaptParallel,
			// req 是完整 desired 解析产物:无键=用户显式清空 → 归一成 null/[] 落库覆盖旧值,
			// 否则清空后旧勾选残留在 params,天球扩展 Popover 勾选回弹、清空失灵。
			pdTimeKeyCustom: req.pdTimeKeyCustom !== undefined ? req.pdTimeKeyCustom : null,
			pdSignificators: Array.isArray(req.pdSignificators) ? req.pdSignificators : [],
			pdPromissorTypes: Array.isArray(req.pdPromissorTypes) ? req.pdPromissorTypes : [],
			termsVariant: req.termsVariant,
			name: req.name,
			pos: req.pos,
			chartId: options.chartId,
		});
		const payload = {
			chartObj: nextChartObj,
		};
		if(options.fields){
			payload.fields = options.fields;
		}
		this.props.dispatch({
			type: 'astro/save',
			payload,
		});
		if(options.runHook && options.fields){
			this.props.dispatch({
				type: 'astro/doHook',
				payload: {
					chartObj: nextChartObj,
					fields: options.fields,
				},
			});
		}
	}

	async requestPrimaryDirectionRows(options = {}){
		const chartObj = options.chartObj || this.props.chartObj || {};
		const req = this.buildPrimaryDirectionRequest(chartObj, options);
		if(!req || !this.props.dispatch){
			return;
		}
		const reqKey = JSON.stringify({
			tab: this.state.currentTab,
			date: req.date,
			time: req.time,
			zone: req.zone,
			lat: req.lat,
			lon: req.lon,
			hsys: req.hsys,
			zodiacal: req.zodiacal, siderealAyanamsa: req.siderealAyanamsa,
			pdMethod: req.pdMethod,
			pdTimeKey: req.pdTimeKey,
			pdYears: req.pdYears,
			showPdBounds: req.showPdBounds,
			pdtype: req.pdtype,
			pdDirect: req.pdDirect,
			pdConverse: req.pdConverse,
			pdAntiscia: req.pdAntiscia,
			pdTerms: req.pdTerms,
			pdProjection: req.pdProjection, pdFrame: req.pdFrame, pdFramework: req.pdFramework,
			pdParallel: req.pdParallel, pdRaptParallel: req.pdRaptParallel,
			pdTimeKeyCustom: req.pdTimeKeyCustom, pdSignificators: req.pdSignificators,
			pdPromissorTypes: req.pdPromissorTypes, termsVariant: req.termsVariant,
			pdaspects: req.pdaspects,
		});
		if(this.primaryDirectionInflightKey === reqKey){
			return;
		}
		this.primaryDirectionInflightKey = reqKey;
		const seq = ++this.primaryDirectionRequestSeq;
		let result = null;
		try{
			const data = await request(`${Constants.ServerRoot}/predict/pd`, {
				body: JSON.stringify(req),
				cache: 'no-store',
			});
			result = unwrapPredictiveResponse(data);
		}catch(e){
			result = null;
		}
		if(this.unmounted || seq !== this.primaryDirectionRequestSeq){
			return;
		}
		this.primaryDirectionInflightKey = '';
		const pdRows = result && Array.isArray(result.pd) ? result.pd : null;
		if(!pdRows){
			// 失败不静默:applied 不动(merge 不跑),按钮保持「重新计算」;可见提示防「假已同步」体感
			try{ message.warning('主限法计算未完成（服务未响应），请点「重新计算」重试'); }catch(e){ /* SSR/测试环境无 message */ }
			return;
		}
		this.savePrimaryDirectionRows(chartObj, req, pdRows, {
			fields: options.fields,
			runHook: !!options.runHook,
			chartId: options.chartId,
		});
	}

	ensurePrimaryDirectionReady(){
		if(!this.needsPrimaryDirectionLoad()){
			this.primaryDirectionInflightKey = '';
			return;
		}
		this.requestPrimaryDirectionRows();
	}

	savePrimaryDirectSnapshot(){
		const chartObj = this.props.chartObj || {};
		const chartParams = chartObj.params || {};
		const fields = this.props.fields || {};
		const showPdBounds = chartParams.showPdBounds !== undefined
			? chartParams.showPdBounds
			: (fields.showPdBounds ? fields.showPdBounds.value : 1);
		const pdMethod = chartParams.pdMethod
			? chartParams.pdMethod
			: (fields.pdMethod ? fields.pdMethod.value : 'core_alchabitius');
		const pdTimeKey = chartParams.pdTimeKey
			? chartParams.pdTimeKey
			: (fields.pdTimeKey ? fields.pdTimeKey.value : 'Ptolemy');
		const snapshotChartObj = {
			...chartObj,
			params: {
				...(chartObj.params || {}),
				showPdBounds,
				pdMethod,
				pdTimeKey,
			},
		};
		const txt = buildPrimaryDirectSnapshotText(snapshotChartObj);
		if(!txt){
			return '';
		}
		// meta 是挂载面板显示与快照识别用的「这份快照按哪组设置算的」——P0/P2 九键
		// 不进 meta 则用户在 AI 分析里看不出快照对应投影/分宫/扩展,与正文自相矛盾。
		saveModuleAISnapshot('primarydirect', txt, {
			tab: 'primarydirect',
			pdMethod,
			pdTimeKey,
			showPdBounds,
			pdProjection: chartParams.pdProjection || 'ptolemy',
			pdFrame: chartParams.pdFrame || 'alcabitius',
			pdFramework: chartParams.pdFramework || 'aspect',
			pdtype: chartParams.pdtype === 1 ? 1 : 0,
			pdParallel: chartParams.pdParallel ? 1 : 0,
			pdRaptParallel: chartParams.pdRaptParallel ? 1 : 0,
			termsVariant: (chartParams.termsVariant === 1 || chartParams.termsVariant === 2) ? chartParams.termsVariant : 0,
			...(chartParams.pdTimeKeyCustom ? { pdTimeKeyCustom: chartParams.pdTimeKeyCustom } : {}),
			...(Array.isArray(chartParams.pdSignificators) && chartParams.pdSignificators.length
				? { pdSignificators: chartParams.pdSignificators } : {}),
			...(Array.isArray(chartParams.pdPromissorTypes) && chartParams.pdPromissorTypes.length
				? { pdPromissorTypes: chartParams.pdPromissorTypes } : {}),
		});
		return txt;
	}

	saveFirdariaSnapshot(){
		const txt = buildFirdariaSnapshotText(this.props.chartObj);
		if(!txt){
			return '';
		}
		saveModuleAISnapshot('firdaria', txt, {
			tab: 'firdaria',
		});
		return txt;
	}

	saveDirectionSnapshot(){
		this.savePrimaryDirectSnapshot();
		if(this.state.currentTab === 'primarydirect'){
			return;
		}
		if(this.state.currentTab === 'firdaria'){
			this.saveFirdariaSnapshot();
		}
	}

	handleSnapshotRefreshRequest(evt){
		if(!evt || !evt.detail || typeof evt.detail !== 'object'){
			return;
		}
		if(evt.detail.module === 'primarydirect'){
			const txt = this.savePrimaryDirectSnapshot();
			if(txt){
				evt.detail.snapshotText = txt;
			}
			return;
		}
		if(evt.detail.module === 'firdaria'){
			const txt = this.saveFirdariaSnapshot();
			if(txt){
				evt.detail.snapshotText = txt;
			}
		}
	}

	componentDidMount(){
		this.unmounted = false;
		// 天球 chunk 空闲预热:不打开天球=零成本(它只在空闲拍拉取,不占进页面这一帧),
		// 真去点「主限天球」时通常已就绪,体感不比静态 import 差。卸载时必须 cancel。
		this._cancelSphereWarm = idleWarm(AstroPDSphere, { timeout: 2500 });
		if(typeof window !== 'undefined' && window.addEventListener){
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
		this.syncCurrentSubTab();
		this.ensurePrimaryDirectionReady();
		this.saveDirectionSnapshot();
		// (原 horosa_pdsphere_lazy_v1 的空闲预热已退役:上游 v3.6.2 的 idleWarm 是超集 ——
		//  它在 componentWillUnmount 里 cancel,我方那版没有。见本文件顶部 idleWarm 调用。)
		// 底部空白根治:静态 props.height-20 比实际工作区矮(链上全满仅本模块 inline 高偏矮)→ Tabs/表格
		// 皆按偏矮值设死高度,页底留空白(用户实告 主限法 页底空条)。改测根容器真高驱动各页签高度。
		this.measureRootHeight();
		// 🔴 祖先滚动归零闸:overflow:hidden 挡不住 scrollIntoView/focus 等编程式滚动
		// (选中时间轴章后滚轮,焦点链会把 hidden 祖先滚出视口——App 实告)。捕获期监听全局 scroll,
		// 凡「本页祖先容器」被滚出即刻复位,机械保证本页任何交互不产生页面级位移。
		this._scrollZeroGuard = (e)=>{
			const t = e && e.target;
			if(!t || !this.rootEl){ return; }
			// 🔴 页面级滚动(target=document/window)不再放行:WKWebView pageZoom≠1/拖拽 autoscroll 会
			// 编程式滚动 scrollingElement(html/body 的 overflow:hidden 挡不住编程滚)——真机 0.9 缩放实告。
			// rAF 复归一帧:WebKit 可能在同帧内恢复滚动位。
			if(t === document || t === window){
				const zero = ()=>{
					const se = document.scrollingElement;
					if(se){ se.scrollTop = 0; se.scrollLeft = 0; }
					if(document.documentElement){ document.documentElement.scrollTop = 0; document.documentElement.scrollLeft = 0; }
					if(document.body){ document.body.scrollTop = 0; document.body.scrollLeft = 0; }
				};
				zero();
				if(typeof requestAnimationFrame === 'function'){ requestAnimationFrame(zero); }
				return;
			}
			// 🔴 页内相关容器(祖先或后代)按「方向合法性」归零:overflow 为 auto/scroll 的
			// 方向=设计滚动(右栏列表纵滚/时间轴轨道横滚)一律放行;hidden 方向被滚(焦点滚动/
			// 拖拽 autoscroll/编程滚)=溢出泄漏,归零。绝不可按容器一刀切——曾把推运右栏
			// 纵滚整体锁死(真机实告)。
			const related = (typeof t.contains === 'function' && t.contains(this.rootEl)) || (typeof this.rootEl.contains === 'function' && this.rootEl.contains(t));
			if(related && (t.scrollTop || t.scrollLeft)){
				let cs = null;
				try{ cs = window.getComputedStyle(t); }catch(e){ /* ignore */ }
				const oy = cs ? cs.overflowY : '';
				const ox = cs ? cs.overflowX : '';
				if(t.scrollTop && oy !== 'auto' && oy !== 'scroll'){ t.scrollTop = 0; }
				if(t.scrollLeft && ox !== 'auto' && ox !== 'scroll'){ t.scrollLeft = 0; }
			}
		};
		window.addEventListener('scroll', this._scrollZeroGuard, true);
		if(typeof ResizeObserver !== 'undefined' && this.rootEl){
			this._roRoot = new ResizeObserver(()=>{
				if(this._rafRoot){ cancelAnimationFrame(this._rafRoot); }
				this._rafRoot = requestAnimationFrame(()=> this.measureRootHeight());
			});
			this._roRoot.observe(this.rootEl);
		}
	}

	// 测根容器真高(填满工作区);>120 才采信,变化才 setState(防抖风暴)。回退=静态 props.height-20。
	// 🔴 取 min(自身高, 父容器 clientHeight):自身高会被内容撑大(实测比父可用高多 16px+,App 窄窗下更多),
	// 按撑大值设 Tabs/pane 高度 → 整块超出工作区 → 页面可上下滚、底部时间轴被滚出视口。
	measureRootHeight(){
		if(this.unmounted || !this.rootEl){ return; }
		// 🔴 量高必须用布局域 clientHeight,勿用 getBoundingClientRect().height:
		// 壳级 CSS zoom 下 rect 返回×zoom 的视觉值(0.9 时偏小 ~10%),当布局值用会把
		// pane 设矮 → 底部恒空带(真机 0.9 实告)。1:1 时两者等值=零回归。
		let h = this.rootEl.clientHeight;
		const parent = this.rootEl.parentElement;
		if(parent && parent.clientHeight > 120){ h = Math.min(h, parent.clientHeight); }
		if(h > 120 && h !== this.state.containerH){ this.setState({ containerH: h }); }
	}

	componentWillUnmount(){
		this.unmounted = true;
		if(this._cancelSphereWarm){ this._cancelSphereWarm(); this._cancelSphereWarm = null; }
		if(this._scrollZeroGuard){ window.removeEventListener('scroll', this._scrollZeroGuard, true); this._scrollZeroGuard = null; }
		if(typeof window !== 'undefined' && window.removeEventListener){
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
		if(this._roRoot){ try{ this._roRoot.disconnect(); }catch(e){} this._roRoot = null; }
		if(this._rafRoot){ cancelAnimationFrame(this._rafRoot); this._rafRoot = null; }
	}

	componentDidUpdate(prevProps, prevState){
		if(prevProps.currentSubTab !== this.props.currentSubTab){
			const nextTab = normalizePrimaryDirectionSubTabKey(this.props.currentSubTab);
			if(nextTab !== this.state.currentTab){
				this.setState({ currentTab: nextTab }, ()=>{
					this.ensurePrimaryDirectionReady();
					this.saveDirectionSnapshot();
					const hook = this.state.hook[nextTab];
					if(hook && hook.fun){
						hook.fun(this.props.chartObj);
					}
				});
				return;
			}
		}
		if(
			prevState.currentTab !== this.state.currentTab ||
			prevProps.chartObj !== this.props.chartObj ||
			prevProps.fields !== this.props.fields ||
			this.state.currentTab === 'primarydirect' ||
			this.state.currentTab === 'firdaria'
		){
			this.saveDirectionSnapshot();
		}
		if(prevState.currentTab !== this.state.currentTab || prevProps.currentSubTab !== this.props.currentSubTab){
			this.syncCurrentSubTab();
		}
		if(
			prevState.currentTab !== this.state.currentTab
			|| prevProps.chartObj !== this.props.chartObj
			|| prevProps.fields !== this.props.fields
		){
			this.ensurePrimaryDirectionReady();
		}
	}

	changeTab(key){
		let hook = this.state.hook;
		this.setState({
			currentTab: key,
		}, ()=>{
			this.syncCurrentSubTab();
			this.ensurePrimaryDirectionReady();
			this.saveDirectionSnapshot();
			if(hook[key].fun){
				hook[key].fun(this.props.chartObj);
			}
		});
	}

	applyPrimaryDirectionConfig(pdMethod, pdTimeKey, pdYears, options){
		if(!this.props.dispatch || !this.props.fields){
			return;
		}
		const opt = options || {};
		const resolvedPdYears = pdYears !== undefined && pdYears !== null
			? normalizePdYears(pdYears)
			: this.getDesiredPdConfig(this.props.chartObj).pdYears;
		this.props.dispatch({
			type: 'app/save',
			payload: {
				pdMethod,
				pdTimeKey,
				pdYears: resolvedPdYears,
				pdtype: opt.pdtype === 1 ? 1 : 0,
				pdDirect: opt.direct === false ? 0 : 1,
				// 统一 0/1 数字编码:此前混入布尔,而 PD 链下游惯例是 `x === 0 ? 0 : 1`,
				// 布尔 false 会被错判成 1(开),埋给未来消费者的雷。
				pdConverse: opt.converse ? 1 : 0,
				pdAntiscia: opt.antiscia ? 1 : 0,
				pdTerms: opt.terms ? 1 : 0,
				...(opt.projection ? { pdProjection: opt.projection } : {}),
				...(opt.frame ? { pdFrame: opt.frame } : {}),
				...(opt.framework ? { pdFramework: opt.framework } : {}),
				pdParallel: opt.parallel ? 1 : 0,
				pdRaptParallel: opt.raptParallel ? 1 : 0,
				...(opt.timeKeyCustom ? { pdTimeKeyCustom: opt.timeKeyCustom } : {}),
				...(Array.isArray(opt.significators) ? { pdSignificators: opt.significators } : {}),
				...(Array.isArray(opt.promissorTypes) ? { pdPromissorTypes: opt.promissorTypes } : {}),
				...(opt.termsVariant !== undefined ? { termsVariant: (opt.termsVariant === 1 || opt.termsVariant === 2) ? opt.termsVariant : 0 } : {}),
			},
		});
		const nextFields = buildPrimaryDirectionFetchFields(
			this.props.fields,
			this.props.chartObj,
			pdMethod,
			pdTimeKey,
			resolvedPdYears,
			opt
		);
		this.props.dispatch({
			type: 'astro/save',
			payload: {
				fields: nextFields,
			},
		});
		this.requestPrimaryDirectionRows({
			chartObj: this.props.chartObj,
			fields: nextFields,
			pdMethod,
			pdTimeKey,
			pdYears: resolvedPdYears,
			// 把本次「计算」选择的进阶开关作为 override 直传,优先级高于已落库 params,
			// 确保用户新选的 方向类型/顺逆/映点/界 立即进入 /predict/pd 请求体。
			pdtype: opt.pdtype === 1 ? 1 : 0,
			pdDirect: opt.direct === false ? 0 : 1,
			pdConverse: opt.converse ? 1 : 0,
			pdAntiscia: opt.antiscia ? 1 : 0,
			pdTerms: opt.terms ? 1 : 0,
			...(opt.projection ? { pdProjection: opt.projection } : {}),
			...(opt.frame ? { pdFrame: opt.frame } : {}),
			...(opt.framework ? { pdFramework: opt.framework } : {}),
			pdParallel: opt.parallel ? 1 : 0,
			pdRaptParallel: opt.raptParallel ? 1 : 0,
			...(opt.timeKeyCustom ? { pdTimeKeyCustom: opt.timeKeyCustom } : {}),
			...(Array.isArray(opt.significators) ? { pdSignificators: opt.significators } : {}),
			...(Array.isArray(opt.promissorTypes) ? { pdPromissorTypes: opt.promissorTypes } : {}),
			...(opt.termsVariant !== undefined ? { termsVariant: (opt.termsVariant === 1 || opt.termsVariant === 2) ? opt.termsVariant : 0 } : {}),
			runHook: true,
		});
	}

	render(){
		// 测得的根容器真高优先(填满工作区、消页底空白);未测到时回退静态 props.height-20。
		let height = (this.state.containerH && this.state.containerH > 120)
			? this.state.containerH
			: ((this.props.height ? this.props.height : 760) - 20);
		const chartParams = this.props.chartObj && this.props.chartObj.params ? this.props.chartObj.params : {};
		const appliedPdMethod = chartParams.pdMethod
			? chartParams.pdMethod
			: (this.props.fields && this.props.fields.pdMethod ? this.props.fields.pdMethod.value : 'core_alchabitius');
		const appliedPdTimeKey = chartParams.pdTimeKey
			? chartParams.pdTimeKey
			: (this.props.fields && this.props.fields.pdTimeKey ? this.props.fields.pdTimeKey.value : 'Ptolemy');
		const appliedPdYears = normalizePdYears(chartParams.pdYears !== undefined && chartParams.pdYears !== null
			? chartParams.pdYears
			: (this.props.fields && this.props.fields.pdYears ? this.props.fields.pdYears.value : 100));
		// In Zodiaco(0,黄道) / In Mundo(1,世俗) + 向运方向(converse) + 映点 / 界 开关——
		// 均从已落库 chart.params 读取(applyPrimaryDirectionConfig 写入),缺省回退黄道/顺向/关。
		// [WP-C.2] pdtype 全链(前端选项/后端引擎/2D 表)只有 0/1 两值——「界」不是 pdtype=2/3,
		// 而是 pdTerms 开关产出的行级 cat='T';天球徽章按二态 + pdTerms 尾缀「+界」呈现,与实算一致。
		const appliedPdType = chartParams.pdtype === 1 ? 1 : 0;
		// 顺向 direct 默认开:仅当已落库显式为 0 才关(缺省/未定义都按开)。
		// 漏传此 prop 会让表格 componentDidUpdate 把「顺」误判为 undefined→默认 1,
		// 导致选「仅逆」算完后「顺」又自动勾上,显示与实算对不上。
		const appliedPdDirect = chartParams.pdDirect === 0 ? 0 : 1;
		// 默认「顺逆都开」(用户偏好):pdConverse 缺省/未定义都按开;仅显式落库为 0/false 才关。
		const appliedPdConverse = (chartParams.pdConverse === 0 || chartParams.pdConverse === false) ? 0 : 1;
		const appliedPdAntiscia = chartParams.pdAntiscia ? 1 : 0;
		const appliedPdTerms = chartParams.pdTerms ? 1 : 0;
		// 解耦九键:与上同口径(params 已落库 → fields → 默认),交由 getDesiredPdConfig 统一解析。
		const appliedPdExt = this.getDesiredPdConfig(this.props.chartObj);

		return (
			<div className="horosa-direction-page xq-chart-renderer xq-chart-renderer-direction" ref={(el)=>{ this.rootEl = el; }} style={{ height: '100%', minHeight: 0, overflow: 'hidden' }}>
				<Tabs
					activeKey={this.state.currentTab} tabPosition='right'
					onChange={this.changeTab}
					style={{ height: height }}
				>
					<TabPane tab="赤纬推运" key="jaynesprog">
						<FreezeInactive active={this.state.currentTab === "jaynesprog"}>
							<AstroJaynesProgressions
								value={this.props.chartObj}
								height={height}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
						</FreezeInactive>
						</TabPane>

					<TabPane tab="恒星推运" key="vedicprog">
						<FreezeInactive active={this.state.currentTab === "vedicprog"}>
							<AstroVedicProgressions
								value={this.props.chartObj}
								height={height}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
						</FreezeInactive>
						</TabPane>

					<TabPane tab="推运" key="progressions">
						<FreezeInactive active={this.state.currentTab === "progressions"}>
							<AstroProgressions
								value={this.props.chartObj}
								height={height}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
						</FreezeInactive>
						</TabPane>

					<TabPane tab="主限法" key="primarydirect">
						<FreezeInactive active={this.state.currentTab === "primarydirect"}>
							<AstroPrimaryDirection
								value={this.props.chartObj} height={height}
								showPdBounds={this.props.fields && this.props.fields.showPdBounds ? this.props.fields.showPdBounds.value : 1}
								pdMethod={appliedPdMethod}
								pdTimeKey={appliedPdTimeKey}
								pdYears={appliedPdYears}
								pdType={appliedPdType}
								pdDirect={appliedPdDirect}
								pdConverse={appliedPdConverse}
								pdAntiscia={appliedPdAntiscia}
								pdTerms={appliedPdTerms}
								pdProjection={appliedPdExt.pdProjection}
								pdFrame={appliedPdExt.pdFrame}
								pdFramework={appliedPdExt.pdFramework}
								pdParallel={appliedPdExt.pdParallel}
								pdRaptParallel={appliedPdExt.pdRaptParallel}
								pdTimeKeyCustom={appliedPdExt.pdTimeKeyCustom}
								pdSignificators={appliedPdExt.pdSignificators}
								pdPromissorTypes={appliedPdExt.pdPromissorTypes}
								termsVariant={appliedPdExt.termsVariant}
								onPdConfigApply={this.applyPrimaryDirectionConfig}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
						</FreezeInactive>
					</TabPane>

					<TabPane tab="界推运" key="distributions">
						<FreezeInactive active={this.state.currentTab === "distributions"}>
						<AstroDistributions
							value={this.props.chartObj}
							height={height}
						/>
						</FreezeInactive>
					</TabPane>

					<TabPane tab="年龄推进点" key="agepoint">
						<FreezeInactive active={this.state.currentTab === "agepoint"}>
						<AstroAgePoint
							value={this.props.chartObj}
							height={height}
						/>
						</FreezeInactive>
					</TabPane>

					<TabPane tab="星历" key="ephemeris">
						<FreezeInactive active={this.state.currentTab === "ephemeris"}>
							<AstroEphemeris
								value={this.props.chartObj}
								height={height}
							/>
						</FreezeInactive>
						</TabPane>

					<TabPane tab="回归轴" key="returntimeline">
						<FreezeInactive active={this.state.currentTab === "returntimeline"}>
							<AstroReturnTimeline
								value={this.props.chartObj}
								height={height}
							/>
						</FreezeInactive>
						</TabPane>

					<TabPane tab="主限法盘" key="primarydirchart">
						<FreezeInactive active={this.state.currentTab === "primarydirchart"}>
							<AstroPrimaryDirectionChart
								value={this.props.chartObj}
								height={height}
								showPdBounds={this.props.fields && this.props.fields.showPdBounds ? this.props.fields.showPdBounds.value : 1}
								pdMethod={appliedPdMethod}
								pdTimeKey={appliedPdTimeKey}
								pdYears={appliedPdYears}
								pdType={appliedPdType}
								pdDirect={appliedPdDirect}
								pdConverse={appliedPdConverse}
								pdAntiscia={appliedPdAntiscia}
								pdTerms={appliedPdTerms}
								pdProjection={appliedPdExt.pdProjection}
								pdFrame={appliedPdExt.pdFrame}
								pdFramework={appliedPdExt.pdFramework}
								pdParallel={appliedPdExt.pdParallel}
								pdRaptParallel={appliedPdExt.pdRaptParallel}
								pdTimeKeyCustom={appliedPdExt.pdTimeKeyCustom}
								pdSignificators={appliedPdExt.pdSignificators}
								pdPromissorTypes={appliedPdExt.pdPromissorTypes}
								termsVariant={appliedPdExt.termsVariant}
								fields={this.props.fields}
								dispatch={this.props.dispatch}
								onPdConfigApply={this.applyPrimaryDirectionConfig}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								hook={this.state.hook.primarydirchart}
							/>
						</FreezeInactive>
					</TabPane>

					<TabPane tab="主限天球" key="primarydirsphere">
						<FreezeInactive active={this.state.currentTab === "primarydirsphere"}>
							{/* AI 快照复用主限表既有段(buildPrimaryDirectSnapshotText→'primarydirect'),
							    本组件零新增快照段 —— 防 AI 段表漂移;pd3d 构参直接复用
							    buildPrimaryDirectionRequest(与 /predict/pd 同一构参函数,零复刻)。 */}
							<AstroPDSphere
								value={this.props.chartObj}
								height={height}
								active={this.state.currentTab === "primarydirsphere"}
								pdMethod={appliedPdMethod}
								pdTimeKey={appliedPdTimeKey}
								pdYears={appliedPdYears}
								pdType={appliedPdType}
								pdDirect={appliedPdDirect}
								pdConverse={appliedPdConverse}
								pdAntiscia={appliedPdAntiscia}
								pdTerms={appliedPdTerms}
								pdProjection={appliedPdExt.pdProjection}
								pdFrame={appliedPdExt.pdFrame}
								pdFramework={appliedPdExt.pdFramework}
								pdParallel={appliedPdExt.pdParallel}
								pdRaptParallel={appliedPdExt.pdRaptParallel}
								pdTimeKeyCustom={appliedPdExt.pdTimeKeyCustom}
								pdSignificators={appliedPdExt.pdSignificators}
								pdPromissorTypes={appliedPdExt.pdPromissorTypes}
								termsVariant={appliedPdExt.termsVariant}
								buildRequest={this.buildPrimaryDirectionRequest}
								onPdConfigApply={this.applyPrimaryDirectionConfig}
							/>
						</FreezeInactive>
					</TabPane>

					<TabPane tab="波斯向运" key="persiandirected">
						<FreezeInactive active={this.state.currentTab === "persiandirected"}>
							<AstroPersianDirected
								value={this.props.chartObj}
								height={height}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								chartDisplay={this.props.chartDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
						</FreezeInactive>
						</TabPane>

					<TabPane tab="行星弧" key="planetaryarc">
						<FreezeInactive active={this.state.currentTab === "planetaryarc"}>
							<AstroPlanetaryArc
								value={this.props.chartObj}
								height={height}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								chartDisplay={this.props.chartDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
						</FreezeInactive>
						</TabPane>

					<TabPane tab="小限法" key="profection">
						<FreezeInactive active={this.state.currentTab === "profection"}>
						<AstroProfection 
							value={this.props.chartObj} 
							height={height} 
							chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
								hook={this.state.hook.profection} 
							/>

						</FreezeInactive>
					</TabPane>

					<TabPane tab="太阳弧" key="solararc">
						<FreezeInactive active={this.state.currentTab === "solararc"}>
						<AstroSolarArc 
							value={this.props.chartObj} 
							height={height} 
							chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
								hook={this.state.hook.solararc} 
							/>

						</FreezeInactive>
					</TabPane>

					<TabPane tab="太阳返照" key="solarreturn">
						<FreezeInactive active={this.state.currentTab === "solarreturn"}>
						<AstroSolarReturn 
							value={this.props.chartObj} 
							height={height} 
							chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
								hook={this.state.hook.solarreturn} 
							/>
						</FreezeInactive>
					</TabPane>

					<TabPane tab="月亮返照" key="lunarreturn">
						<FreezeInactive active={this.state.currentTab === "lunarreturn"}>
						<AstroLunarReturn 
							value={this.props.chartObj} 
							height={height} 
							chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
								hook={this.state.hook.lunarreturn} 
							/>
						</FreezeInactive>
					</TabPane>

					<TabPane tab="流年法" key="givenyear">
						<FreezeInactive active={this.state.currentTab === "givenyear"}>
						<AstroGivenYear 
							value={this.props.chartObj} 
							height={height} 
							chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
								hook={this.state.hook.givenyear} 
							/>
						</FreezeInactive>
					</TabPane>

					<TabPane tab="法达星限" key="firdaria">
						<FreezeInactive active={this.state.currentTab === "firdaria"}>
						<AstroFirdaria 
								value={this.props.chartObj} 
								height={height}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
						</FreezeInactive>
					</TabPane>

					<TabPane tab="十年大运" key="decennials">
						<FreezeInactive active={this.state.currentTab === "decennials"}>
						<AstroDecennials
							value={this.props.chartObj}
							height={height}
							chartDisplay={this.props.chartDisplay}
							planetDisplay={this.props.planetDisplay}
							lotsDisplay={this.props.lotsDisplay}
							showPlanetHouseInfo={this.props.showPlanetHouseInfo}
							showAstroMeaning={this.props.showAstroMeaning}
							hook={this.state.hook.decennials}
						/>
						</FreezeInactive>
						</TabPane>

					<TabPane tab="黄道星释" key="zodialrelease">
						<FreezeInactive active={this.state.currentTab === "zodialrelease"}>
						<AstroZR
							value={this.props.chartObj}
							height={height}
							chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
								hook={this.state.hook.zodialrelease}
							/>
						</FreezeInactive>
					</TabPane>

					<TabPane tab="行星年龄" key="planetaryages">
						<FreezeInactive active={this.state.currentTab === "planetaryages"}>
							<AstroPlanetaryAges
								value={this.props.chartObj}
								height={height}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
						</FreezeInactive>
						</TabPane>

					<TabPane tab="129年系统" key="yearsystem129">
						<FreezeInactive active={this.state.currentTab === "yearsystem129"}>
							<AstroYearSystem129
								value={this.props.chartObj}
								height={height}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
						</FreezeInactive>
						</TabPane>

						<TabPane tab="Balbillus" key="balbillus">
							<FreezeInactive active={this.state.currentTab === "balbillus"}>
							<AstroBalbillus
								value={this.props.chartObj}
								height={height}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
							</FreezeInactive>
						</TabPane>

						<TabPane tab="三分主星" key="triplicityrulers">
							<FreezeInactive active={this.state.currentTab === "triplicityrulers"}>
							<AstroTriplicityRulers
								value={this.props.chartObj}
								height={height}
								showAstroMeaning={this.props.showAstroMeaning}
								tripSystem={this.props.tripSystem}
							/>
							</FreezeInactive>
						</TabPane>

						<TabPane tab="数字相位" key="keypoints">
							<FreezeInactive active={this.state.currentTab === "keypoints"}>
							<AstroKeypoints
								value={this.props.chartObj}
								height={height}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
							</FreezeInactive>
						</TabPane>

						<TabPane tab="月相推运" key="lunationphase">
							<FreezeInactive active={this.state.currentTab === "lunationphase"}>
							<AstroLunationPhase
								value={this.props.chartObj}
								height={height}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
							</FreezeInactive>
						</TabPane>

						<TabPane tab="产前朔望" key="prenatalsyzygy">
							<FreezeInactive active={this.state.currentTab === "prenatalsyzygy"}>
							<AstroPrenatalSyzygy
								value={this.props.chartObj}
								height={height}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
							</FreezeInactive>
						</TabPane>

						<TabPane tab="多重回归" key="extrareturns">
							<FreezeInactive active={this.state.currentTab === "extrareturns"}>
							<AstroExtraReturns
								value={this.props.chartObj}
								height={height}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
							</FreezeInactive>
						</TabPane>

					</Tabs>
			</div>
		);
	}
}

export { AstroDirectMain, buildPrimaryDirectionFetchFields, buildPrimaryDirectSnapshotText, buildFirdariaSnapshotText, };
export default AstroDirectMain;
