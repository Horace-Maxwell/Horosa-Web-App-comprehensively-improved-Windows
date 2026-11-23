// [起盘信息] 段:古典口径行、基础信息、宫头与星体 / 点位位置表
// 从 astroAiSnapshot.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { classicalBackendOverridesFromFields } from '../classicalChartGlobals';   // 签名末位+口径自陈共用请求体单源(无环:classicalChartGlobals 只依赖 safeStorage)
import { buildTimeBasisLine } from '../timeBasisLine';
import * as AstroConst from '../../constants/AstroConst';
import { derivedWholeSignLabelOf, polarMcOf, POLAR_MC_NOTE, rulerOfSign } from '../wholeSignRulers';   // [Windows #79] 宫主派生单源(与 AstroDispositor 同函数;整宫/分宫两表口径分离)
import { fieldValue, msg, PLANET_HOUSE_INFO_NOTE, lonToSignDegree, msgWithHouse, formatSignDegree, formatRetrogradeText, resolveOnlyRulerExaltReception, round3, keepReceptionLine, ruleshipText, keepMutualLine, aspectText, asNameList } from './format';
import { getObjectsMapPure as getObjectsMap } from '../fortuneChartPrimitives';   // 盘面原语单源

// 古典口径 23 键 → 人话短语（仅非默认键成行;全默认返回 ''=零增行）。
// 值翻译与「星盘设置」抽屉/挂载齿轮同语义;WP-1 spec 单源落地后本表改由 spec 派生(消费点不动)。
const CLS_CALIBRE_LABELS = {
	termsVariant: { label: '界系', map: { 1: '托勒密·校勘本', 2: '托勒密·经典传本', 3: '迦勒底(推演)', 4: '自定义界表' } },
	geminiBoundEmended: { label: '双子界序', map: { 1: '校勘对调' } },
	leoBoundFirst: { label: '狮子首界', map: { 1: '土星优先' } },
	triplicity: { label: '三分集', map: { Ptolemaic: '托勒密二主', PtolemaicWaterVariant: '托勒密·水象变体' } },
	westNodeType: { label: '月交点', map: { true: '真交点' } },
	sectBuffer: { label: '区分判定', map: { ptolemy5: 'Ptolemy 5°缓冲', apparent: '视地平(含折射)' } },
	sunriseMode: { label: '日出 / 日没口径', map: { apparent: '日面上缘·含大气折射' } },
	lotReversal: { label: '福点', map: { 0: '恒昼式(不随昼夜反转)' } },
	houseCuspAdvance: { label: '落宫宫头前移', fmt: (v) => `${v}°` },
	cazimiOrb: { label: '日心 cazimi', fmt: (v) => `${Math.round(Number(v) * 60)}′` },
	combustOrb: { label: '燃烧上界', fmt: (v) => `${v}°` },
	underBeamsOrb: { label: '日光束外界', fmt: (v) => `${v}°` },
	vocMode: { label: '空亡口径', map: { by_orb: '容许度12°30′', by_sign_perfect: '本座内须完成(现代)', by_sign_orb: '本座内入容许度(16c)', kenodromia: '30°法(希腊化)', exempt4: '无入相+四座豁免(中世纪)' } },
	vocIncludeOuter: { label: '空亡计三王星', map: { 1: '开' } },
	fixedStarOrb: { label: '恒星平轨', fmt: (v) => `${v}°` },
	fixedStarOrbMode: { label: '恒星轨档', map: { byMagnitude: '按星等' } },
	antisciaOrb: { label: '映点容许度', fmt: (v) => `${v}°` },
	viaCombustaVariant: { label: '燃烧之路', map: { narrow: '窄口径(天秤28°–天蝎7°)', scorpioFull: '天秤后15°+天蝎全宫', bothFull: '天秤+天蝎全段' } },
	lotsDocReverse: { label: '四点文档序公式', map: { 1: '开' } },
	nodeExaltation: { label: '交点入旺', map: { 1: '开' } },
	// 天文口径批(sectBuffer 视地平档已由上表 map 覆盖)
	combustOwnChariotExempt: { label: '免燃烧例外', map: { 1: '界内三分内免(own chariot)' } },
	westLilithType: { label: '黑月', map: { true: '真实远地点' } },
	topocentricMoon: { label: '月亮视差', map: { 1: '站心修正' } },
	stationMarking: { label: '留驻判定', map: { exactWindow: '距留点≤1日', distance: '距留点≤2′', absSpeed: '日速<1′', relSpeed: '日速<3%均速' } },
	// 希腊点变体批
	hermeticLotsReversal: { label: '六星点', map: { 0: '恒同式(批判本校勘)' } },   // 后端只按昼夜反转六个点(福点另由开关定)
	erosConstruction: { label: '爱欲·必然构成', map: { valens: 'Valens 式(福点·精神系)' } },
	lotFortuneVariant: { label: '福点变体', map: { moonAboveNight: '月在地平上恒夜式' } },
	lotFatherCombustAlt: { label: '父点', map: { 1: '土星伏替代式(Dorotheus 系)' } },
	lotProjection: { label: '点度计数', map: { sign: '整星座投射' } },
	// 尊贵与判定批
	dignityDebilities: { label: '弱陷负分', map: { 0: '不计负分' } },
	almutenTripMode: { label: 'Almuten 三分', map: { sectRulerOnly: '仅当值主' } },
	planetaryHourMethod: { label: '行星时', map: { unequal: '昼夜不等时(传统)', equal24: '廿四时等分' } },
	// 容许度体系批
	orbSystem: { label: '容许度体系', map: { byAspect: '按相位名', wholeSign: '整星座位相', wholeSignMoiety: '整星座内半距和' } },
	luminaryOrbBonus: { label: '发光体·四轴加成', fmt: (v) => `${v}%` },
	// 相位对象扩展
	aspectIncludeCusps: { label: '宫头相位', map: { 1: '开(≤3°)' } },
	aspectIncludeLots: { label: '点位相位', map: { 1: '开(受体·≤3°)' } },
	aspectIncludeMidpoints: { label: '中点相位', map: { 1: '开(日月四轴·硬相≤1.5°)' } },
	// 返照专项
	solarReturnVariant: { label: '太阳返照法', map: { hellenistic: '希腊式(月定上升)' } },
	returnLatitudeMode: { label: '返照落宫', map: { withLatitude: '计入黄纬(Umar al-Tabari 法)' } },
	// 灵学扩展
	vulcanCalc: { label: '祝融星', map: { weston: '轨道根数法', baker: '水星系推算' } },
};

// 头七键的「默认值」(与 classicalChartGlobals 同表;数值键由 helper 判非默认,此表只管头键)。
const CLS_CALIBRE_HEAD_DEFAULTS = {
	termsVariant: 0, geminiBoundEmended: 0, leoBoundFirst: 0, triplicity: 'Dorothean',
	westNodeType: 'mean', sectBuffer: 'geo', sunriseMode: 'center', lotReversal: 1,
};

function classicalCalibrePhrase(key, value){
	const spec = CLS_CALIBRE_LABELS[key];
	if(!spec){ return `${key}=${value}`; }
	if(spec.map && spec.map[value] !== undefined){ return `${spec.label}=${spec.map[value]}`; }
	if(spec.fmt){ return `${spec.label}=${spec.fmt(value)}`; }
	return `${spec.label}=${value}`;
}

export function buildClassicalCalibreLine(fields){
	const parts = [];
	// 头七键:fields 值 ≠ 默认才成短语(与 fieldsToParams 条件透传同判)。
	Object.keys(CLS_CALIBRE_HEAD_DEFAULTS).forEach((k) => {
		const v = fieldValue(fields, k);
		if(v === undefined || v === null){ return; }
		const norm = (CLS_CALIBRE_HEAD_DEFAULTS[k] === 0 || CLS_CALIBRE_HEAD_DEFAULTS[k] === 1) ? parseInt(`${v}`, 10) : `${v}`;
		if(norm !== CLS_CALIBRE_HEAD_DEFAULTS[k] && !Number.isNaN(norm)){
			parts.push(classicalCalibrePhrase(k, norm));
		}
	});
	// 二/四批+三开关:直接复用请求体单源(仅非默认产键;starOrb/starOrbMode 映回前端名翻译)。
	// spec 单源化后 overrides 也含头七键 → 跳过已在上循环产过短语的键(否则非默认头键重复行);
	// customTermsDay/Night 是嵌套表体、userAyanT0/Deg 是历元参数,无人话词条 → 以「自定义界表/自定义历元」概括,绝不倾倒数组。
	const HEAD_DONE = new Set(Object.keys(CLS_CALIBRE_HEAD_DEFAULTS));
	const ov = classicalBackendOverridesFromFields(fields);
	let customTermsNoted = false;
	Object.keys(ov).forEach((k) => {
		if(HEAD_DONE.has(k)){ return; }
		if(k === 'customTermsDay' || k === 'customTermsNight'){
			if(!customTermsNoted){ parts.push('界表=自定义(编辑器存表)'); customTermsNoted = true; }
			return;
		}
		if(k === 'userAyanT0' || k === 'userAyanDeg'){ return; }   // siderealAyanamsa='user' 短语已涵盖
		const front = k === 'starOrb' ? 'fixedStarOrb' : (k === 'starOrbMode' ? 'fixedStarOrbMode' : k);
		parts.push(classicalCalibrePhrase(front, ov[k]));
	});
	if(!parts.length){ return ''; }
	return `古典口径（非默认项）：${parts.join('；')}。`;
}

export function buildBaseInfoLines(chartObj, fields, options){
	const lines = [];
	const chart = chartObj && chartObj.chart ? chartObj.chart : {};
	const params = chartObj && chartObj.params ? chartObj.params : {};
	const lon = fieldValue(fields, 'lon') || params.lon || '';
	const lat = fieldValue(fields, 'lat') || params.lat || '';
	const zone = params.zone !== undefined && params.zone !== null ? params.zone : fieldValue(fields, 'zone');

	if(lon || lat){
		lines.push(`经度：${lon}， 纬度：${lat}`);
	}
	if(params.birth){
		lines.push(params.birth + (chart.dayofweek ? ` ${chart.dayofweek}` : ''));
	}
	if(zone !== undefined && zone !== null){
		lines.push(`时区：${zone} ，${chart.isDiurnal ? '日生盘' : '夜生盘'}`);
	}
	if(chart.nongli && chart.nongli.birth){
		lines.push(`真太阳时：${chart.nongli.birth}`);
	}
	// 跨技法时间基准自声明:星盘按输入钟面时刻与时区换算世界时起盘(上一行真太阳时仅为八字口径参考)
	if(options && options.withTimeBasis){
		lines.push(buildTimeBasisLine({ timeAlg: 1, lateZiHourUseNextDay: fieldValue(fields, 'lateZiHourUseNextDay'), after23NewDay: fieldValue(fields, 'after23NewDay') }));
	}
	// 用户拍板·v2.2.1: AI 必须明确知道排盘按哪种规则计算,否则可能用错语义解读四柱。
	const after23 = fieldValue(fields, 'after23NewDay');
	const lateZi = fieldValue(fields, 'lateZiHourUseNextDay');
	if(after23 !== undefined || lateZi !== undefined){
		const a23 = after23 === 0 || after23 === '0' || after23 === false ? 0 : 1;
		const lzh = lateZi === 0 || lateZi === '0' || lateZi === false ? 0 : 1;
		const dayLabel = a23 === 1 ? '23点算第二天(日柱进位次日)' : '24点算第二天(日柱守今、24点才换日柱)';
		const hourLabel = lzh === 1 ? '晚子时按次日日柱计算(时干用次日日干起子时)' : '晚子时按当日柱计算(时干用今日日干起子时)';
		lines.push(`排盘规则：日柱开关【${dayLabel}】+ 时柱开关【${hourLabel}】。本盘四柱按此规则计算。`);
	}

	// 🔴 取值源统一为「请求参数优先、后端 echo 兜底」(与 buildPredictiveBirthLines:1795 同序):
	// fields 数字值就是发出去的排盘入参 —— 标注与计算恒同源;此前 chart echo 优先,与同文件推运行
	// 双标准并存(echo 缺失/命名不一时标注口径漂)。
	const zodiacal = AstroConst.ZODIACAL[fieldValue(fields, 'zodiacal')] || chart.zodiacal;
	// 派生盘(调波/龙盘/十三分/十二分)宫位被强制为「变换后上升整宫」:
	// fields/echo 里的分宫制不是这张盘实际用的,标注必须说真话(数值不动)。
	const hsys = derivedWholeSignLabelOf(chart) || AstroConst.HouseSys[fieldValue(fields, 'hsys')] || chart.hsys;
	if(zodiacal || hsys){
		const ayanKey = fieldValue(fields, 'siderealAyanamsa', '') || (chart && chart.siderealAyanamsa) || '';
		const zodiacalTxt = zodiacal ? AstroConst.zodiacalDisplayText(zodiacal, ayanKey) : msg(zodiacal);
		lines.push(`${zodiacalTxt}，${msg(hsys)}`);
	}
	// 极区天顶徽记(与盘面信息卡同一标记 houses[].polarMc):AI 须知 MC 取的是上中天交点、可能与 10 宫头不同。
	if(polarMcOf(chart)){
		lines.push(POLAR_MC_NOTE);
	}
	// 古典口径自陈:AI 此前拿到的是按口径**算好的数**,但快照从不声明用的哪套界表/三分/空亡/
	// 焦伤阈——模型无法自陈口径,也无从解释「为何界主与常见表不同」。仅列非默认键:默认态零增行,
	// 旧快照 parity 逐字节不破。
	const calibre = buildClassicalCalibreLine(fields);
	if(calibre){
		lines.push(calibre);
	}
	lines.push(PLANET_HOUSE_INFO_NOTE);

	if(chart.dayerStar){
		lines.push(`日主星：${msg(chart.dayerStar)}`);
	}
	if(chart.timerStar){
		lines.push(`时主星：${msg(chart.timerStar)}`);
	}
	// FIX-16 命主星 1R(派生 ASC→落座→该星主→该星落宫;庙主查表走 wholeSignRulers.rulerOfSign 单源,与 AstroInfo 格局速览同函数)。
	// 排盘信息层显式标识,AI 不必再去主宰星链推导。
	const objectMapForRuler = getObjectsMap(chartObj);
	const asc = objectMapForRuler.Asc;
	if(asc && asc.sign){
		const rulerId = rulerOfSign(asc.sign);
		const rulerObj = rulerId ? objectMapForRuler[rulerId] : null;
		if(rulerObj){
			const housePart = rulerObj.house ? `落${msg(rulerObj.house)}` : '';
			const signPart = rulerObj.sign ? `（${msg(rulerObj.sign)}）` : '';
			lines.push(`命主星：${msg(rulerId)} ${housePart}${signPart}`);
		}
	}
	return lines;
}

// ══════════════════════════════════════════════════════════════════════════════
// 七函数(宫头/星与虚点/相位/行星/希腊点/12分度/主宰星链·宫神星)逐条行改 GFM 表。
// 铁律:值表达式逐字复用(零信息丢失),仅排版骨架换 表头+分隔行+数据行;段头 [X] 零变更;
// 空值 cell 用 '—'(em dash,不进 fact token 正则),值本身为空串('')时保留空 cell 以区分「行存在但值空」;
// 绝不输出 undefined/NaN/null 字面量;列固定不因盘裁列;某实体全属性缺 → 不出该行。
// 等价证明:astroV2FactEquivalence.test.js(L1 逆变换/fact-tuple-set/逐实体属性字典)对照改前基线 fixture。
// ══════════════════════════════════════════════════════════════════════════════
export const EMPTY_CELL = '—';

// 表骨架:零行 → [](不产孤表头);cell 内容为本文件自产文本,天然无 '|' 与换行,不做转义。
export function gfmTableLines(headers, rows){
	if(!rows || !rows.length){
		return [];
	}
	return [
		`| ${headers.join(' | ')} |`,
		`| ${headers.map(()=>'---').join(' | ')} |`,
		...rows.map((cells)=>`| ${cells.join(' | ')} |`),
	];
}

export function buildHouseCuspLines(chartObj){
	const chart = chartObj && chartObj.chart ? chartObj.chart : {};
	const houses = chart.houses || [];
	const rows = [];
	for(let i=0; i<houses.length; i++){
		const h = houses[i];
		if(!h || h.lon === undefined || h.lon === null){
			continue;
		}
		rows.push([msg(h.id), lonToSignDegree(h.lon)]);
	}
	return gfmTableLines(['宫位', '宫头'], rows);
}

export function buildStarAndLotPositionLines(chartObj){
	const objectMap = getObjectsMap(chartObj);
	const rows = [];
	const pushOne = (id)=>{
		const obj = objectMap[id];
		if(!obj || obj.sign === undefined || obj.signlon === undefined){
			return;
		}
		// 逆行列=原 retro 后缀字面量('；逆行')或 '—'。
		rows.push([msgWithHouse(id, chartObj), formatSignDegree(obj.sign, obj.signlon), formatRetrogradeText(obj) || EMPTY_CELL]);
	};

	AstroConst.LIST_OBJECTS.forEach((id)=>pushOne(id));
	AstroConst.LOTS.forEach((id)=>pushOne(id));

	return gfmTableLines(['点位', '位置', '逆行'], rows);
}

export function buildInfoSection(chartObj, fields, options = {}){
	const lines = [];
	const chart = chartObj && chartObj.chart ? chartObj.chart : {};
	const chartData = chartObj || {};
	const planetMap = getObjectsMap(chartObj);
	const onlyRulerExaltReception = resolveOnlyRulerExaltReception(options);

	lines.push(...buildBaseInfoLines(chartObj, fields));

	const anti = chart.antiscias || {};
	const antiLines = [];
	(anti.antiscia || []).forEach((item)=>{
		antiLines.push(`${msg(item[0])} 与 ${msg(item[1])} 成映点 误差${round3(item[2])}`);
	});
	(anti.cantiscia || []).forEach((item)=>{
		antiLines.push(`${msg(item[0])} 与 ${msg(item[1])} 成反映点 误差${round3(item[2])}`);
	});
	if(antiLines.length){
		lines.push('映点/反映点');
		lines.push(...antiLines);
	}

	const receptions = chartData.receptions || {};
	const normalReceptions = (receptions.normal || []).filter((item)=>keepReceptionLine(item, false, onlyRulerExaltReception));
	const abnormalReceptions = (receptions.abnormal || []).filter((item)=>keepReceptionLine(item, true, onlyRulerExaltReception));
	if(normalReceptions.length || abnormalReceptions.length){
		// FIX-15 「拒绝」标识(supplier 在 beneficiary 所在座为 exile/fall = 该 supplier 实际是 beneficiary 的「凶接纳」=拒绝);
		// 与 AstroInfo.genReceptionsDom 一致;abnormal 接纳尤须标识(承接星自身落陷)。
		const isReject = (item)=>{
			const dig = item && item.supplierRulerShip;
			if(!dig) return false;
			const arr = Array.isArray(dig) ? dig : [dig];
			return arr.some((d)=> d === 'exile' || d === 'fall');   // 全栈代码库只产 exile/fall(detriment 不存在,删死分支)
		};
		lines.push('接纳');
		lines.push('正接纳：');
		normalReceptions.forEach((item)=>{
			const rejMark = isReject(item) ? '（拒绝）' : '';
			lines.push(`${msgWithHouse(item.beneficiary, chartObj)} 被 ${msgWithHouse(item.supplier, chartObj)} 接纳 (${ruleshipText(item.supplierRulerShip)})${rejMark}`);
		});
		lines.push('邪接纳：');
		abnormalReceptions.forEach((item)=>{
			const rejMark = isReject(item) ? '（拒绝）' : '';
			lines.push(`${msgWithHouse(item.beneficiary, chartObj)} (${ruleshipText(item.beneficiaryDignity)}) 被 ${msgWithHouse(item.supplier, chartObj)} 接纳 (${ruleshipText(item.supplierRulerShip)})${rejMark}`);
		});
	}

	const mutuals = chartData.mutuals || {};
	const normalMutuals = (mutuals.normal || []).filter((item)=>keepMutualLine(item, onlyRulerExaltReception));
	const abnormalMutuals = (mutuals.abnormal || []).filter((item)=>keepMutualLine(item, onlyRulerExaltReception));
	if(normalMutuals.length || abnormalMutuals.length){
		lines.push('互容');
		lines.push('正互容：');
		normalMutuals.forEach((item)=>{
			lines.push(`${msgWithHouse(item.planetA.id, chartObj)} (${ruleshipText(item.planetA.rulerShip)}) 与 ${msgWithHouse(item.planetB.id, chartObj)} (${ruleshipText(item.planetB.rulerShip)}) 互容`);
		});
		lines.push('邪互容：');
		abnormalMutuals.forEach((item)=>{
			lines.push(`${msgWithHouse(item.planetA.id, chartObj)} (${ruleshipText(item.planetA.rulerShip)}) 与 ${msgWithHouse(item.planetB.id, chartObj)} (${ruleshipText(item.planetB.rulerShip)}) 互容`);
		});
	}

	const surround = chartData.surround || {};
	const attacks = surround.attacks || {};
	const attackLines = [];
	Object.keys(attacks).forEach((key)=>{
		const planet = attacks[key];
		const candidates = [];
		if(planet.MinDelta && planet.MinDelta.length === 2){
			candidates.push(planet.MinDelta);
		}
		if(planet.MarsSaturn && planet.MarsSaturn.length === 2){
			candidates.push(planet.MarsSaturn);
		}
		if(planet.SunMoon && planet.SunMoon.length === 2){
			candidates.push(planet.SunMoon);
		}
		if(planet.VenusJupiter && planet.VenusJupiter.length === 2){
			candidates.push(planet.VenusJupiter);
		}
		candidates.forEach((pair)=>{
			attackLines.push(
				`${msgWithHouse(key, chartObj)} 被 ${msgWithHouse(pair[0].id, chartObj)} (通过${aspectText(pair[0].aspect)}相位) 与 ${msgWithHouse(pair[1].id, chartObj)} (通过${aspectText(pair[1].aspect)}相位) 围攻`
			);
		});
	});
	if(attackLines.length){
		lines.push('光线围攻');
		lines.push(...attackLines);
	}

	const houses = surround.houses || {};
	const houseLines = [];
	Object.keys(houses).forEach((key)=>{
		const pair = houses[key];
		if(pair && pair.length === 2){
			houseLines.push(`${msgWithHouse(pair[0].id, chartObj)} 与 ${msgWithHouse(pair[1].id, chartObj)} 夹 ${msg(key)}`);
		}
	});
	if(houseLines.length){
		lines.push('夹宫');
		lines.push(...houseLines);
	}

	const planets = surround.planets || {};
	const planetLines = [];
	Object.keys(planets).forEach((key)=>{
		const pair = planets[key];
		if(key === 'BySunMoon' && pair && pair.id){
			planetLines.push(`${msgWithHouse(AstroConst.MOON, chartObj)} 与 ${msgWithHouse(AstroConst.SUN, chartObj)} 夹 ${msgWithHouse(pair.id, chartObj)}`);
			return;
		}
		if(pair && pair.SunMoon && pair.SunMoon.length === 2){
			planetLines.push(`${msgWithHouse(pair.SunMoon[0].id, chartObj)} 与 ${msgWithHouse(pair.SunMoon[1].id, chartObj)} 夹 ${msgWithHouse(key, chartObj)}`);
			return;
		}
		if(pair && pair.length === 2){
			planetLines.push(`${msgWithHouse(pair[0].id, chartObj)} 与 ${msgWithHouse(pair[1].id, chartObj)} 夹 ${msgWithHouse(key, chartObj)}`);
		}
	});
	if(planetLines.length){
		lines.push('夹星');
		lines.push(...planetLines);
	}

	const declParallel = chartData.declParallel || {};
	const parallelLines = [];
	(declParallel.parallel || []).forEach((ids, idx)=>{
		parallelLines.push(`平行星体${idx + 1}：${asNameList(ids)}`);
	});
	Object.keys(declParallel.contraParallel || {}).forEach((id)=>{
		const ids = declParallel.contraParallel[id] || [];
		if(ids.length){
			parallelLines.push(`相对 ${msg(id)} 星体：${asNameList(ids)}`);
		}
	});
	if(parallelLines.length){
		lines.push('纬照');
		lines.push(...parallelLines);
	}

	Object.keys(planetMap).forEach((id)=>{
		planetMap[id].__name = msg(id);
	});
	return lines;
}
