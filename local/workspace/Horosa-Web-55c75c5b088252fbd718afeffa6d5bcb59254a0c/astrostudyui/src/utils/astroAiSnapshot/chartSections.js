// 相位 / 行星 / 希腊点 / 十二分盘 / 定位星 / 宫主 / 寿命 / 可能性各段
// 从 astroAiSnapshot.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import * as AstroConst from '../../constants/AstroConst';
import { buildWholeSignRulerRows, WHOLE_SIGN_RULERS_HEADERS, buildHouseSystemRulerRows, resolveHouseSystem, HOUSE_SYSTEM_RULERS_HEADERS } from '../wholeSignRulers';   // [Windows #79] 宫主派生单源(与 AstroDispositor 同函数;整宫/分宫两表口径分离)
// 寿命格局段:复用本命引擎(纯函数,无 React;已验证不回 import 本文件,无环)。
import buildFacts from '../../divination/engine/chartFacts';
import { runLifespan } from '../../divination/lifespan/lifespanEngine';
import { msgWithHouse, aspectText, round3, msg, getStarsMap, formatSignDegree, formatSpeed, dignityText, asNameList, formatStarsLines, lonToSignDegree, RULER_CALIBRE_LINE, WHOLE_SIGN_RULERS_HEAD, HOUSE_SYSTEM_RULERS_COLLAPSED, classicalGlobalValueSafe } from './format';
import { getObjectsMapPure as getObjectsMap } from '../fortuneChartPrimitives';   // 盘面原语单源
import { EMPTY_CELL, gfmTableLines } from './infoSection';

// 三 ◆ 子块各成一表;事实五元组(主体,相位,对象,相态,误差)/(主体,相位,对象)零变化,
// 相态=入相/离相/正合(Exact 单列「正合」;此前与 Separative 同折为「离相」),None 相态列 '—'。子块头照 v1 无数据也保留。
export function buildAspectSection(chartObj){
	const lines = [];
	const aspects = chartObj && chartObj.aspects ? chartObj.aspects : {};
	const normal = aspects.normalAsp || {};
	const immediate = aspects.immediateAsp || {};
	const signAsp = aspects.signAsp || {};

	const normalRows = [];
	AstroConst.LIST_POINTS.forEach((id)=>{
		const one = normal[id];
		if(!one){
			return;
		}
		const subject = msgWithHouse(id, chartObj);
		(one.Applicative || []).forEach((asp)=>{
			normalRows.push([subject, aspectText(asp.asp), msgWithHouse(asp.id, chartObj), '入相', round3(asp.orb)]);
		});
		// 正合(|orbDir|<0.3,不分入离)相态列写「正合」,不再折为「离相」(与右栏相位表同改)。
		(one.Exact || []).forEach((asp)=>{
			normalRows.push([subject, aspectText(asp.asp), msgWithHouse(asp.id, chartObj), '正合', round3(asp.orb)]);
		});
		(one.Separative || []).forEach((asp)=>{
			normalRows.push([subject, aspectText(asp.asp), msgWithHouse(asp.id, chartObj), '离相', round3(asp.orb)]);
		});
		(one.None || []).forEach((asp)=>{
			normalRows.push([subject, aspectText(asp.asp), msgWithHouse(asp.id, chartObj), EMPTY_CELL, round3(asp.orb)]);
		});
	});
	lines.push('◆ 标准相位');
	lines.push(...gfmTableLines(['主体', '相位', '对象', '相态', '误差'], normalRows));

	const immediateRows = [];
	AstroConst.LIST_OBJECTS.forEach((id)=>{
		const one = immediate[id];
		if(!one || one.length < 2){
			return;
		}
		const subject = msgWithHouse(id, chartObj);
		immediateRows.push([subject, aspectText(one[0].asp), msgWithHouse(one[0].id, chartObj), '离相', round3(one[0].orb)]);
		immediateRows.push([subject, aspectText(one[1].asp), msgWithHouse(one[1].id, chartObj), '入相', round3(one[1].orb)]);
	});
	lines.push('◆ 立即相位');
	lines.push(...gfmTableLines(['主体', '相位', '对象', '相态', '误差'], immediateRows));

	const signRows = [];
	AstroConst.LIST_OBJECTS.forEach((id)=>{
		const one = signAsp[id];
		if(!one || !one.length){
			return;
		}
		const subject = msgWithHouse(id, chartObj);
		one.forEach((asp)=>{
			signRows.push([subject, aspectText(asp.asp), msgWithHouse(asp.id, chartObj)]);
		});
	});
	lines.push('◆ 星座相位');
	lines.push(...gfmTableLines(['主体', '相位', '对象'], signRows));

	// 相位参与对象扩展(段内增行不加段头;默认全关=响应无 extraAspects 字段=零增行)。
	const extra = chartObj && chartObj.extraAspects;
	if(extra && typeof extra === 'object'){
		const GROUP_CN = { cusps: '宫头相位(≤3°)', lots: '点位相位(点为受体·≤3°)', midpoints: '中点接触(日月四轴·硬相≤1.5°)' };
		['cusps', 'lots', 'midpoints'].forEach((g) => {
			const rows = Array.isArray(extra[g]) ? extra[g] : [];
			if(!rows.length){ return; }
			lines.push(`◆ ${GROUP_CN[g]}`);
			lines.push(...gfmTableLines(['行星', '相位', '对象', '误差'],
				rows.map((r) => [msg(r.planet), aspectText(r.asp), `${msg(r.target) || r.target}`, `${r.orb}˚`])));
		});
	}

	return lines;
}

// 每星 ~24 属性 → 一段五块:◆位置与速度 / ◆坐标 / ◆尊贵与主宰 / ◆映点与东西 各成一表,
// ◆汇合恒星 保持 kv 行组(不定长列表不进表,星名行=v1 星曜行原文,恒星行值零变化)。
// 每 cell 值表达式与 v1 对应行冒号后逐字一致(坐标 cell 含 ˚ 同 v1);v1 行缺 → cell '—';
// v1 行存在但值为空串(如 东出星：)→ cell 保留空串。块内全行皆缺的星不出该行,块零行不出块。
export function buildPlanetSection(chartObj){
	const lines = [];
	const chart = chartObj && chartObj.chart ? chartObj.chart : {};
	const objectMap = getObjectsMap(chartObj);
	const starsMap = getStarsMap(chartObj);
	const orientOccident = chart.orientOccident || {};
	const nakshatras = (chart && chart.nakshatras) || chartObj.nakshatras || {};

	const posRows = [];
	const coordRows = [];
	const dignityRows = [];
	const antisciaRows = [];
	const starGroups = [];

	AstroConst.LIST_OBJECTS.forEach((id)=>{
		const obj = objectMap[id];
		if(!obj){
			return;
		}
		const name = msgWithHouse(id, chartObj);

		// ◆ 位置与速度 —— FIX-12 落座 cell 内联 29°歧度 / 燃烧之路 / 压抑之路 临界标(字面量原样保留,
		// 参 AstroPlanet.js:181,193,196)。落座列同 v1 无条件产出(星曜存在即有行)。
		let signDegCell = `${formatSignDegree(obj.sign, obj.signlon)}`;
		const extras = [];
		if(typeof obj.signlon === 'number' && Math.floor(obj.signlon) === 29){ extras.push('位于歧度'); }
		if(obj.isViaCombust){ extras.push('位于燃烧之路'); }
		if(obj.isViaRepression){ extras.push('位于压抑之路'); }
		if(extras.length){ signDegCell += '；' + extras.join('；'); }
		// FIX-7 月宿 nakshatra(印度盘场景关键;参 AstroPlanet.js:155,205)。lord 中文化用 AstroConst.NAK_LORD_CN
		// (含 7 行星 + Rahu/Ketu),勿用 AstroMsg(那是星历字体 glyph,会输出 'A/B/C')。
		const nak = nakshatras[id];
		let nakCell = EMPTY_CELL;
		if(nak && nak.index){
			const lordCn = AstroConst.NAK_LORD_CN && AstroConst.NAK_LORD_CN[nak.lord] ? AstroConst.NAK_LORD_CN[nak.lord] : (nak.lord || '');
			nakCell = `第${nak.index}宿 ${nak.name || ''}${nak.label ? `（${nak.label}）` : ''} 第${nak.pada || '?'}步·宿主${lordCn}`;
		}
		posRows.push([
			name,
			signDegCell,
			obj.house ? msg(obj.house) : EMPTY_CELL,
			nakCell,
			obj.meanSpeed !== undefined ? round3(obj.meanSpeed) : EMPTY_CELL,
			obj.lonspeed !== undefined ? formatSpeed(obj) : EMPTY_CELL,
		]);

		// ◆ 坐标(cell 含 ˚,与 v1 行值逐字一致)
		const coordCells = [
			obj.lon !== undefined ? `${round3(obj.lon)}˚` : EMPTY_CELL,
			obj.lat !== undefined ? `${round3(obj.lat)}˚` : EMPTY_CELL,
			obj.ra !== undefined ? `${round3(obj.ra)}˚` : EMPTY_CELL,
			obj.decl !== undefined ? `${round3(obj.decl)}˚` : EMPTY_CELL,
			obj.altitudeTrue !== undefined ? `${round3(obj.altitudeTrue)}˚` : EMPTY_CELL,
			obj.altitudeAppa !== undefined ? `${round3(obj.altitudeAppa)}˚` : EMPTY_CELL,
			obj.azimuth !== undefined ? `${round3(obj.azimuth)}˚` : EMPTY_CELL,
		];
		if(coordCells.some((c)=>c !== EMPTY_CELL)){
			coordRows.push([name, ...coordCells]);
		}

		// ◆ 尊贵与主宰
		let dignityCell = EMPTY_CELL;
		if(obj.selfDignity){
			let dg = dignityText(obj.selfDignity);
			if(obj.hayyiz && obj.hayyiz !== 'None'){
				dg += `，${msg(obj.hayyiz)}`;
			}
			if(obj.isVOC){
				dg += '，空亡';
			}
			dignityCell = dg;
		}
		let governCell = EMPTY_CELL;
		if(obj.governSign){
			governCell = msg(obj.governSign);
			if(obj.governPlanets && obj.governPlanets.length){
				governCell += ` , ${asNameList(obj.governPlanets)}`;
			}
		}
		const dignityCells = [
			dignityCell,
			obj.score !== undefined ? `${obj.score}` : EMPTY_CELL,
			(obj.ruleHouses && obj.ruleHouses.length) ? asNameList(obj.ruleHouses) : EMPTY_CELL,
			obj.exaltHouse ? msg(obj.exaltHouse) : EMPTY_CELL,
			governCell,
			obj.moonPhase !== undefined ? msg(obj.moonPhase) : EMPTY_CELL,
			obj.sunPos !== undefined ? msg(obj.sunPos) : EMPTY_CELL,
		];
		if(dignityCells.some((c)=>c !== EMPTY_CELL)){
			dignityRows.push([name, ...dignityCells]);
		}

		// ◆ 映点与东西(occ 存在时 东出/西入 cell 同 v1 可为空串)
		const occ = orientOccident[id];
		const antisciaCells = [
			obj.antisciaPoint ? formatSignDegree(obj.antisciaPoint.sign, obj.antisciaPoint.signlon) : EMPTY_CELL,
			obj.cantisciaPoint ? formatSignDegree(obj.cantisciaPoint.sign, obj.cantisciaPoint.signlon) : EMPTY_CELL,
			occ ? asNameList((occ.oriental || []).map((x)=>x.id)) : EMPTY_CELL,
			occ ? asNameList((occ.occidental || []).map((x)=>x.id)) : EMPTY_CELL,
		];
		if(obj.antisciaPoint || obj.cantisciaPoint || occ){
			antisciaRows.push([name, ...antisciaCells]);
		}

		const stars = starsMap[id] || [];
		if(stars.length){
			starGroups.push({ name, stars });
		}
	});

	if(posRows.length){
		lines.push('◆ 位置与速度');
		lines.push(...gfmTableLines(['星曜', '落座', '落宫', '月宿', '平均速度', '当前速度'], posRows));
	}
	if(coordRows.length){
		lines.push('◆ 坐标');
		lines.push(...gfmTableLines(['星曜', '黄经', '黄纬', '赤经', '赤纬', '真地平纬度', '视地平纬度', '地坪经度'], coordRows));
	}
	if(dignityRows.length){
		lines.push('◆ 尊贵与主宰');
		lines.push(...gfmTableLines(['星曜', '禀赋', '分值', '入垣宫', '擢升宫', '宰制星座', '月限', '太阳关系'], dignityRows));
	}
	if(antisciaRows.length){
		lines.push('◆ 映点与东西');
		lines.push(...gfmTableLines(['星曜', '映点', '反映点', '东出星', '西入星'], antisciaRows));
	}
	if(starGroups.length){
		lines.push('◆ 汇合恒星');
		starGroups.forEach((group)=>{
			lines.push(group.name);
			lines.push(...formatStarsLines(group.stars));
		});
	}

	return lines;
}

// 希腊点 → 表(点位|落座|落宫) + ◆汇合恒星 kv 行组(同 buildPlanetSection 约定)。
export function buildLotsSection(chartObj){
	const lines = [];
	const objectMap = getObjectsMap(chartObj);
	const starsMap = getStarsMap(chartObj);

	const rows = [];
	const starGroups = [];
	AstroConst.LOTS.forEach((id)=>{
		const obj = objectMap[id];
		if(!obj){
			return;
		}
		const name = msgWithHouse(id, chartObj);
		rows.push([name, formatSignDegree(obj.sign, obj.signlon), obj.house ? msg(obj.house) : EMPTY_CELL]);
		const stars = starsMap[id] || [];
		if(stars.length){
			starGroups.push({ name, stars });
		}
	});

	lines.push(...gfmTableLines(['点位', '落座', '落宫'], rows));
	if(starGroups.length){
		lines.push('◆ 汇合恒星');
		starGroups.forEach((group)=>{
			lines.push(group.name);
			lines.push(...formatStarsLines(group.stars));
		});
	}

	return lines;
}

// 星座庙主(传统七政),按 0=白羊…11=双鱼 顺序。仅用于 12分度/主宰链段,使用 AstroConst 行星常量,
// 不引 divination/data/signs(避免小写 key 与 chart id 格式失配)。
const TRAD_SIGN_RULERS = [
	AstroConst.MARS, AstroConst.VENUS, AstroConst.MERCURY, AstroConst.MOON,
	AstroConst.SUN, AstroConst.MERCURY, AstroConst.VENUS, AstroConst.MARS,
	AstroConst.JUPITER, AstroConst.SATURN, AstroConst.SATURN, AstroConst.JUPITER,
];

function norm360Lon(x){
	let v = Number(x) % 360;
	if(v < 0){
		v += 360;
	}
	return v;
}

// 取星体绝对黄经:优先 obj.lon,缺则用 sign+signlon 还原(对序列化里没带 lon 的盘兜底)。
function objAbsLon(obj){
	if(obj && obj.lon !== undefined && obj.lon !== null && !Number.isNaN(Number(obj.lon))){
		return Number(obj.lon);
	}
	if(obj && obj.sign !== undefined && obj.signlon !== undefined && obj.signlon !== null){
		const idx = AstroConst.LIST_SIGNS.indexOf(obj.sign);
		if(idx >= 0){
			return idx * 30 + Number(obj.signlon);
		}
	}
	return null;
}

function dodecaLonOf(lon){
	const L = norm360Lon(lon);
	return norm360Lon(Math.floor(L / 30) * 30 + (L % 30) * 12);
}

function rulerIdOfLon(lon){
	return TRAD_SIGN_RULERS[Math.floor(norm360Lon(lon) / 30) % 12];
}

// 12 分度(Dodekatemoria):每星本命黄经 → floor(度/30)*30 + (度%30)*12 落入的分度座。
// 表(曜|本命|12分度),两位置 cell 值与 v1 行内片段逐字一致。
export function buildDodecaSection(chartObj){
	const objectMap = getObjectsMap(chartObj);
	const rows = [];
	AstroConst.LIST_OBJECTS.forEach((id)=>{
		const lon = objAbsLon(objectMap[id]);
		if(lon === null){
			return;
		}
		const natal = lonToSignDegree(lon);
		const dodeca = lonToSignDegree(dodecaLonOf(lon));
		if(!natal || !dodeca){
			return;
		}
		rows.push([msg(id), natal, dodeca]);
	});
	return gfmTableLines(['曜', '本命', '12分度'], rows);
}

// 主宰星链(dispositor chains):七政各落星座的庙主,顺链至「落自家星座」的终极主宰(或互容成环)。
export function buildDispositorSection(chartObj){
	const lines = [];
	const objectMap = getObjectsMap(chartObj);
	const TRAD = [AstroConst.SUN, AstroConst.MOON, AstroConst.MERCURY, AstroConst.VENUS, AstroConst.MARS, AstroConst.JUPITER, AstroConst.SATURN];
	TRAD.forEach((id)=>{
		if(objAbsLon(objectMap[id]) === null){
			return;
		}
		const chain = [id];
		let cur = id;
		let guard = 0;
		while(guard < 12){
			const lon = objAbsLon(objectMap[cur]);
			if(lon === null){
				break;
			}
			const ruler = rulerIdOfLon(lon);
			if(!ruler || ruler === cur){
				break;
			}
			chain.push(ruler);
			if(chain.indexOf(ruler) !== chain.length - 1){
				break;
			}
			cur = ruler;
			guard += 1;
		}
		lines.push(`${msg(id)}：${chain.map((k)=>msg(k)).join(' → ')}`);
	});
	// [Windows #79] 宫主/主宰口径 = 整宫制(自上升星座起算),与 [起盘信息] 行星后的 nR 标记同源(后端 perchart 同样自 Asc 座起数 12 宫取庙主)。
	// 此前此处挂的是「当前分宫制宫头星座」的宫神星表 —— 与同一份快照里的 nR 口径互相打架,AI 按四分仪宫头定主宰
	// (4/10 宫与整宫制不同)。分宫制表迁出成独立段 [分宫制宫神星表](行星力量/落宫口径)。派生单源 utils/wholeSignRulers。
	const wsRows = buildWholeSignRulerRows(chartObj);
	if(wsRows.length){
		lines.push(RULER_CALIBRE_LINE);
		lines.push(WHOLE_SIGN_RULERS_HEAD);
		lines.push(...gfmTableLines(WHOLE_SIGN_RULERS_HEADERS, wsRows.map(rulerRowCells)));
	}
	return lines;
}

// 宫主表行 → 表 cell(整宫/分宫两表同一编码):宫主对象整体缺 → '—';宫主对象在但缺落宫/落座 → 空串 cell
// (对应 v1「落  座」空位编码,astroV2FactEquivalence L1 逆变换看死)。
function rulerRowCells(r){
	if(!r.rulerFound){
		return [`${r.house}宫`, msg(r.sign), msg(r.ruler), EMPTY_CELL, EMPTY_CELL];
	}
	return [`${r.house}宫`, msg(r.sign), msg(r.ruler), r.rulerHouseId ? msg(r.rulerHouseId) : '', r.rulerSign ? msg(r.rulerSign) : ''];
}

// [分宫制宫神星表]:当前分宫制(Alcabitus/Regiomontanus…)宫头星座的宫主表(houseRows)——行星力量/角续果/实际落宫口径,
// 不是主宰依据。标题带当前分宫制名;上升整宫制盘(hsys 0)与 [主宰星链] 的整宫表逐行相同 → 折叠成一行说明。
// 福点整宫制(24)从福点起算 ≠ 上升整宫制,不折叠。chart.houses 空 → [] 不产段(buildSectionText 契约)。
export function buildHouseSystemRulerSection(chartObj, fields){
	const rows = buildHouseSystemRulerRows(chartObj);
	if(!rows.length){
		return [];
	}
	const hs = resolveHouseSystem(chartObj, fields);
	if(hs.isAscWholeSign && buildWholeSignRulerRows(chartObj).length){
		return [HOUSE_SYSTEM_RULERS_COLLAPSED];
	}
	const label = hs.label ? msg(hs.label) : '';
	return [
		`◆ 当前分宫制${label ? `(${label})` : ''}宫神星表(houseRows)`,
		...gfmTableLines(HOUSE_SYSTEM_RULERS_HEADERS, rows.map(rulerRowCells)),
	];
}

// 非破坏地补出 buildFacts 需要的 objectMap/houseMap(不改原 chartObj)。
function chartObjWithFactsMaps(chartObj){
	if(!chartObj || !chartObj.chart){
		return chartObj;
	}
	let objectMap = chartObj.objectMap;
	if(!objectMap && Array.isArray(chartObj.chart.objects)){
		objectMap = {};
		chartObj.chart.objects.forEach((o)=>{ if(o && o.id){ objectMap[o.id] = o; } });
	}
	let houseMap = chartObj.houseMap;
	if(!houseMap && Array.isArray(chartObj.chart.houses)){
		houseMap = {};
		chartObj.chart.houses.forEach((h)=>{ if(h && h.id){ houseMap[h.id] = h; } });
	}
	return Object.assign({}, chartObj, { objectMap, houseMap });
}

// 寿命引擎产出的 key/sign 是小写(buildFacts 统一 toLowerCase),需映射回 chart id 供 msg 显示中文。
const LIFESPAN_KEY_TO_ID = {
	sun: AstroConst.SUN, moon: AstroConst.MOON, mercury: AstroConst.MERCURY,
	venus: AstroConst.VENUS, mars: AstroConst.MARS, jupiter: AstroConst.JUPITER,
	saturn: AstroConst.SATURN, asc: AstroConst.ASC, mc: AstroConst.MC,
	fortune: AstroConst.PARS_FORTUNA, syzygy: AstroConst.SYZYGY,
	north_node: AstroConst.NORTH_NODE, south_node: AstroConst.SOUTH_NODE,
};

function lifespanName(key){
	if(!key){
		return '-';
	}
	const lk = String(key).toLowerCase();
	if(LIFESPAN_KEY_TO_ID[lk]){
		return msg(LIFESPAN_KEY_TO_ID[lk]);
	}
	const cap = lk.charAt(0).toUpperCase() + lk.slice(1);
	const m = msg(cap);
	return (m && m !== cap) ? m : `${key}`;
}

// 寿命格局(Hyleg/Alcocoden):生命主 + 寿主星 + 预测寿数 + 盘主体系。默认 Ptolemy 取主法(与组件同)。
// 位置统一用 lonToSignDegree(lon)(引擎 sign 是小写、term 取不到;用绝对黄经重算座度+界,得中文)。
export function buildLifespanSection(chartObj){
	const lines = [];
	let res = null;
	try {
		// 太阳三态阈值随设置(与 AstroLifespan 同修):优先本盘回显,兜全局仓;
		// 此前不传 opts=快照行星状态盘「日下」列恒硬编码 17′/8.5°/17°。
		const _p = (chartObj && chartObj.params) || {};
		const _pick = (k) => (_p[k] !== undefined && _p[k] !== null && _p[k] !== '' ? Number(_p[k]) : Number(classicalGlobalValueSafe(k)));
		const facts = buildFacts(chartObjWithFactsMaps(chartObj), {
			cazimiOrb: _pick('cazimiOrb'), combustOrb: _pick('combustOrb'), underBeamsOrb: _pick('underBeamsOrb'),
		});
		// method 与组件同键传导(用户换取主法快照即跟),缺省 ptolemy 零回归。
		let _lifespanMethod = 'ptolemy';
		try{ _lifespanMethod = localStorage.getItem('horosa.lifespan.method') || 'ptolemy'; }catch(_){ }
		res = facts ? runLifespan(facts, { method: _lifespanMethod }) : null;
	} catch(e){
		return lines;
	}
	if(!res){
		return lines;
	}
	lines.push(`区分：${res.isDiurnal ? '昼生盘' : '夜生盘'}`);
	const hy = res.hyleg;
	if(hy){
		const pos = (hy.lon !== undefined && hy.lon !== null) ? lonToSignDegree(hy.lon) : '';
		lines.push(`生命主(Hyleg)：${lifespanName(hy.key)} ${pos}${hy.house ? `（第${hy.house}宫）` : ''}`);
	} else {
		lines.push('生命主(Hyleg)：未定');
	}
	const alc = res.alcocoden;
	if(alc && alc.alcocoden){
		lines.push(`寿主星(Alcocoden)：${lifespanName(alc.alcocoden)}`);
		if(alc.aspectToHyleg){
			lines.push(`与生命主相照：${alc.aspectToHyleg}`);
		}
		if(alc.predictedYears !== undefined && alc.predictedYears !== null){
			lines.push(`预测寿数 ≈ ${alc.predictedYears} 年（基础 ${alc.baseYears} 年）`);
		}
	} else {
		lines.push('寿主星(Alcocoden)：未能确定');
	}
	if(res.rulers){
		const r = res.rulers;
		const parts = [];
		if(r.epikratetor){ parts.push(`占控星 ${lifespanName(r.epikratetor)}`); }
		if(r.oikodespotes){ parts.push(`家主星 ${lifespanName(r.oikodespotes)}`); }
		if(r.kurios){ parts.push(`盘主星 ${lifespanName(r.kurios)}`); }
		if(parts.length){
			lines.push(`盘主体系：${parts.join('；')}${r.concordant ? '（家主=盘主，格局相合）' : ''}`);
		}
	}
	// FIX-8 取主法 + 朔/望月 显式标识。
	if(res.method){ lines.push(`取主法：${res.method}`); }
	if(res.birthType){ lines.push(`朔/望月：${res.birthType === 'conjunctional' ? '朔月(合)' : '望月(冲)'}`); }
	// FIX-8 Hyleg 候选列表(key/house/aphetic/rank/reason)。
	if(Array.isArray(res.candidates) && res.candidates.length){
		lines.push('生命主候选：');
		res.candidates.forEach((c)=>{
			if(!c || !c.key) return;
			const ah = c.aphetic ? '投射' : '非投射';
			const rk = (c.rank !== undefined && c.rank !== null) ? `rank=${c.rank}` : '';
			const rsn = c.reason ? `·${c.reason}` : '';
			const hs = c.house ? `第${c.house}宫` : '';
			lines.push(`${lifespanName(c.key)} ${hs}·${ah}${rk ? '·' + rk : ''}${rsn}`);
		});
	}
	// FIX-8 Alcocoden 全字段(viaDignity/angularity/band/modifiers);英文 token 中文化。
	const VIA_DIG = { ruler: '本垣', exalt: '擢升', triplicity: '三分', term: '界', face: '面 / 十度' };
	const ANGLR = { angular: '角宫', succedent: '续宫', cadent: '果宫' };
	const BAND_CN = { greatest: '大限', mean: '中限', least: '小限', max: '大限', min: '小限' };
	if(res.alcocoden){
		const a = res.alcocoden;
		const detail = [];
		if(a.viaDignity){ detail.push(`经${VIA_DIG[a.viaDignity] || a.viaDignity}`); }
		if(a.angularity){ detail.push(ANGLR[a.angularity] || a.angularity); }
		if(a.band){ detail.push(`限 ${BAND_CN[a.band] || a.band}`); }
		if(a.baseYears !== undefined){ detail.push(`基础${a.baseYears}年`); }
		if(detail.length){ lines.push(`寿主星细节：${detail.join('；')}`); }
		if(Array.isArray(a.modifiers) && a.modifiers.length){
			a.modifiers.forEach((m)=>{
				if(!m) return;
				const p = m.planet ? lifespanName(m.planet) : '';
				const asp = m.aspect ? `·${m.aspect}` : '';
				const dlt = (m.delta !== undefined && m.delta !== null) ? `(Δ${m.delta})` : '';
				const k = m.kind ? `·${m.kind}` : '';
				lines.push(`修正：${p}${asp}${dlt}${k}`);
			});
		}
	}
	// FIX-9 医疗危机 Zoller v1(sixthSign/sixthRuler/hylegAfflictions/bodyHyleg/note)。
	// HIGH-2 修:lifespan 引擎 sixth.sign 来自 facts.houses(全 lowercase 'virgo'/'pisces');msg() 仅识 PascalCase
	// → 直出原英文。先首字大写再 msg(),与逐曜古典段 sign 输出一致。
	const capSign = (s)=> (s && typeof s === 'string') ? s.charAt(0).toUpperCase() + s.slice(1) : s;
	if(res.medical){
		const m = res.medical;
		const mp = [];
		if(m.sixthSign){ mp.push(`六宫${msg(capSign(m.sixthSign))}`); }
		if(m.sixthRuler){ mp.push(`六宫主 ${lifespanName(m.sixthRuler)}`); }
		if(mp.length){ lines.push(`医疗危机：${mp.join('；')}`); }
		if(Array.isArray(m.hylegAfflictions) && m.hylegAfflictions.length){
			const ha = m.hylegAfflictions.map((x)=> `${lifespanName(x.planet || x.id)}${x.aspect ? '·' + x.aspect : ''}`).join('、');
			lines.push(`生命主受克：${ha}`);
		}
		if(Array.isArray(m.bodyHyleg) && m.bodyHyleg.length){
			lines.push(`生命主部位：${m.bodyHyleg.join('、')}`);
		}
		if(m.note){ lines.push(`备注：${m.note}`); }
	}
	// FIX-10 行星状态盘 states.rows;全部英文 raw 字段中文化;inSect 是 boolean(非字串) → 显式判 true/false。
	const STATE_HAYYIZ = { Hayyiz: '得时得地', DemiHayyiz: '半得', InWrongPos: '失位', None: '' };
	const STATE_SUN = { cazimi: '核心', combust: '焦伤', under_beams: '日光束下', underBeams: '日光束下', free: '自由光' };
	const STATE_ORIENT = { oriental: '东出', occidental: '西入' };
	const STATE_MOTION = { retro: '逆行', direct: '顺行', stationary: '停滞' };
	if(res.states && Array.isArray(res.states.rows) && res.states.rows.length){
		lines.push('行星状态盘：');
		res.states.rows.forEach((row)=>{
			if(!row || !row.planet) return;
			const parts = [];
			if(row.hayyiz && row.hayyiz !== 'None'){ const v = STATE_HAYYIZ[row.hayyiz]; if(v) parts.push(v); }
			if(row.sunState && row.sunState !== 'None'){ parts.push(STATE_SUN[row.sunState] || row.sunState); }
			if(row.orient){ parts.push(STATE_ORIENT[row.orient] || row.orient); }
			if(row.motion){ parts.push(STATE_MOTION[row.motion] || row.motion); }
			if(row.inSect === true){ parts.push('同宗派'); } else if(row.inSect === false){ parts.push('异宗派'); }
			if(row.house){ parts.push(`第${row.house}宫`); }
			lines.push(`${lifespanName(row.planet)}：${parts.join('·')}`);
		});
	}
	return lines;
}

export function buildPossibilitySection(chartObj){
	const lines = [];
	const predict = chartObj && chartObj.predict ? chartObj.predict : {};
	const planetSign = predict.PlanetSign || {};
	Object.keys(planetSign).forEach((key)=>{
		lines.push(msg(key));
		const items = planetSign[key] || [];
		items.forEach((txt)=>lines.push(`${txt}`));
	});
	return lines;
}

export function buildSectionText(title, lines){
	const clean = (lines || []).map((line)=>`${line}`.trim()).filter(Boolean);
	if(clean.length === 0){
		return '';
	}
	return `[${title}]\n${clean.join('\n')}`;
}
