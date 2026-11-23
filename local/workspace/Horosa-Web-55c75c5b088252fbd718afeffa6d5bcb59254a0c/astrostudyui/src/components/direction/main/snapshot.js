// 星运页 AI 快照:主限法 / 法达表的快照正文与它用到的星体 / 度数 / 方法文字
// 从 AstroDirectMain.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import * as AstroConst from '../../../constants/AstroConst';
import * as AstroText from '../../../constants/AstroText';
import { appendPlanetHouseInfoById } from '../../../utils/planetHouseInfo';
import * as AstroHelper from '../../astro/AstroHelper';
import { getPdMethodLabel, getPdTimeKeyLabel, pdStarPointText, pdDisplayMethod, isPdExtensionPromissorId, PD_TYPE_LABELS, normalizePdType, pdProjectionLabelWithGeometry, pdTypeBaselineNote, PD_FRAME_LABELS, PD_FRAMEWORK_LABELS, pdExtraSettingLines, pdExtensionLabels, PD_SIGNIFICATOR_OPTIONS, PD_PROMISSOR_TYPE_OPTIONS } from '../../../utils/primaryDirectionSync';
import { civilInstantMsOfStr } from '../../../utils/dateStrSafe';
import { readPdSphereStamp } from '../../../utils/pdSphereStamp';
import { buildCurrentMomentLines, buildMethodNoteLines } from '../../../utils/astroAiSnapshot';
import { getFirdariaInterp } from '../../../utils/firdariaInterp';

// 补厚 helper 容错:个别测试套件整模块 mock astroAiSnapshot 且只保留部分导出(如 aiAnalysisContext.test),
// 缺失导出经 import 拿到 undefined → 直接调用会炸掉整个 builder;生产环境恒为函数,此守卫零行为差。
const safeHelperLines = (fn, ...args)=>(typeof fn === 'function' ? fn(...args) : []);

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
	const starText = pdStarPointText(text, (b)=>msgWithHouse(chartObj, b));
	if(starText){
		return starText;
	}
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

export function buildPrimaryDirectSnapshotText(chartObj){
	const lines = [];
	const obj = chartObj || {};
	const allPds = obj.predictives && Array.isArray(obj.predictives.primaryDirection) ? obj.predictives.primaryDirection : [];
	const showPdBounds = !(obj.params && (obj.params.showPdBounds === 0 || obj.params.showPdBounds === false));
	const pdMethod = pdDisplayMethod(obj.params && obj.params.pdMethod, obj.params && obj.params.pdProjection);
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
		if(isPdExtensionPromissorId(prom)){ return true; }
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
	const pdTypeText = PD_TYPE_LABELS[normalizePdType(pdParams.pdtype)];
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
	// 旧单维「推运方法」只在命盘没有显式弧算法时决定弧(旧盘);有显式两维时由下面「弧算法 / 盘面宫制」两行表达,
	// 不再写一行与实算不符的旧方法名
	if(!pdParams.pdProjection){
		lines.push(`推运方法：${primaryDirectionMethodText(pdMethod)}`);
	}
	lines.push(`度数换算：${primaryDirectionTimeKeyText(pdTimeKey)}`);
	lines.push(`方向类型：${pdTypeText}`);
	lines.push(`向运方向：${pdDirText}`);
	lines.push(`映点迫星：${pdParams.pdAntiscia ? '是' : '否'}`);
	lines.push(`界迫星：${pdParams.pdTerms ? '是' : '否'}`);
	// 解耦九键设置行(AI 解读 ground-truth 与盘同口径;默认值也照实写,便于 LLM 对照)
	// 受几何口径影响的方法带「（改进）/（经典）」(几何口径不另起一行,与弧算法下拉同名)
	let projLabel = pdProjectionLabelWithGeometry(pdParams, pdParams.pdGeometry) || pdParams.pdProjection || 'Ptolemy（半弧）';
	// 诚实回显:世俗 / Field Plane 下没有专属实现的 (投影, 分宫) 统一走核内基线,照实注明
	// (曾照抄所选投影名,几种选择输出逐字节相同却显示不同名字)。
	projLabel += pdTypeBaselineNote(pdParams.pdtype, pdParams.pdProjection, pdParams.pdFrame);
	const frameLabel = PD_FRAME_LABELS[pdParams.pdFrame] || pdParams.pdFrame || 'Alcabitius';
	const fwLabel = PD_FRAMEWORK_LABELS[pdParams.pdFramework] || pdParams.pdFramework || '相位主限';
	lines.push(`弧算法（投影）：${projLabel}`);
	lines.push(`盘面宫制（分宫）：${frameLabel}`);
	lines.push(`框架：${fwLabel}`);
	pdExtraSettingLines(pdParams).forEach((line)=>lines.push(line));
	if(pdParams.pdParallel){
		lines.push(`平行迫星：${pdParams.pdtype === 1 ? '世界平行' : '赤纬平行（映点法）'}`);
	}
	if(pdParams.pdRaptParallel){
		lines.push('急动平行迫星：是');
	}
	if(pdParams.termsVariant >= 1 && pdParams.termsVariant <= 4){   // 放行自定义(4)
		// 标签正名(旧「莉莉界」)+迦勒底(3)放行:主限法链此前三元限死 1/2,全局选迦勒底被静默降 0。
		lines.push(`界系：${({ 1: '托勒密界·校勘本', 2: '托勒密界·经典传本', 3: '迦勒底界', 4: '自定义界表' })[pdParams.termsVariant]}`);   // 补 4,否则快照出「界系：undefined」
	}
	if(pdParams.pdTimeKey === 'User' && pdParams.pdTimeKeyCustom){
		lines.push(`自定义钥匙率：${pdParams.pdTimeKeyCustom}°/年`);
	}
	// 写面板上的名字(曾写内部键 Desc / stars 等裸 ID)
	if(Array.isArray(pdParams.pdSignificators) && pdParams.pdSignificators.length){
		lines.push(`应星扩展：${pdExtensionLabels(pdParams.pdSignificators, PD_SIGNIFICATOR_OPTIONS).join('、')}`);
	}
	if(Array.isArray(pdParams.pdPromissorTypes) && pdParams.pdPromissorTypes.length){
		lines.push(`迫星扩展：${pdExtensionLabels(pdParams.pdPromissorTypes, PD_PROMISSOR_TYPE_OPTIONS).join('、')}`);
	}
	lines.push(`显示界限法：${showPdBounds ? '是' : '否'}`);

	lines.push('');
	lines.push('[主限法表格]');
	lines.push(`| ${degreeLabel} | 迫星 | 应星 | 日期(UTC) |`);   // 引擎给的是 UTC 墙钟,快照表头一并标明(AI 据此换算本地)
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
	// 尾部补 [当前时点]/[方法说明](共享 helper;段头已登 preset;只动 primarydirect 这一支 builder)。
	// extraLines 提示行:表中日期距今最近的 arc 行(帮 AI 从长表中锚定当下应期;解析不出日期则省略)。
	let nearestLine = '';
	if(pds.length){
		const nowMs = Date.now();
		let best = null;
		pds.forEach((pd)=>{
			const t = civilInstantMsOfStr(`${(pd && pd[4]) || ''}`.trim().replace(/\//g, '-'));   // 民用历真实时刻
			if(Number.isNaN(t)){ return; }
			const dist = Math.abs(t - nowMs);
			if(!best || dist < best.dist){ best = { pd, dist }; }
		});
		if(best){
			const bpd = best.pd;
			nearestLine = `表中距今最近行：${degreeText(bpd && bpd[0], pdMethod) || '无'}（${directionObjText(bpd && bpd[1], obj) || '无'} → ${directionObjText(bpd && bpd[2], obj) || '无'}，${bpd && bpd[4] ? `${bpd[4]}` : '无'}）`;
		}
	}
	// 主限天球可选行:用户最近在 3D 球上选中/播放的向运(≤24h 有效,防跨日陈旧)。
	// 文本由 AstroPDSphere 从选中 row 既有字段拼好盖章,此处只读不再推导。
	// 只认同一张盘(签名=obj.params 的 date/time/lon/lat)的盖章:此前无签名,A 盘选过行 → B 盘快照也带 A 行。
	const sphereStamp = readPdSphereStamp(obj.params || {});
	if(sphereStamp){
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

export function buildFirdariaSnapshotText(chartObj){
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
