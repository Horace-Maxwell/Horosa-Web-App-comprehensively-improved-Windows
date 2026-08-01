import { Component } from 'react';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { splitDegree } from './AstroHelper';
import { sameDisplayList, shallowPropsEqual } from '../../utils/chartUpdateGuard';
import { chartSCUEnabled } from '../../utils/perfFlags';
import '../../css/styles.less';

// 印度盘 sCU(根因 E):三种盘式(南/北/东)render 消费的「全部影响盘面输出 props」。
// 逐项核(grep this.props.* 全集):value(盘数据,大对象引用比)/ planetDisplay·lotsDisplay(显示开关数组,内容比)
//  / chartnum·label·height·degreeDisplayMode·aspectSourceId·planetGlyphMode·lagnaRef·onPlanetClick(标量/函数,Object.is)。
// 北印/东印额外消费 counterClockwise(镜像)→ 各自 keys 追加。
// 三盘均不读 this.state(_aspectedSigns 是 render 内派生的实例字段,随 value/aspectSourceId 变);
// (lockAquarius 死开关已按分治移除:南印固定格即其默认语义,三盘零消费。)
export const INDIA_CHART_SCU_KEYS = [
	'value', 'planetDisplay', 'lotsDisplay', 'chartnum', 'label', 'height',
	'degreeDisplayMode', 'aspectSourceId', 'aspectParadigm', 'planetGlyphMode', 'lagnaRef', 'onPlanetClick',
	'overlayPoints',
];
export const INDIA_CHART_SCU_KEYS_MIRROR = INDIA_CHART_SCU_KEYS.concat(['counterClockwise']);
export const INDIA_CHART_SCU_COMPARATORS = {
	planetDisplay: sameDisplayList,
	lotsDisplay: sameDisplayList,
	overlayPoints: (a, b)=>JSON.stringify(a || null) === JSON.stringify(b || null),
};

export function indiaChartShouldUpdate(self, nextProps, keys){
	if(!chartSCUEnabled()){
		return true;
	}
	return !shallowPropsEqual(self.props, nextProps, keys, INDIA_CHART_SCU_COMPARATORS);
}

const SOUTH_INDIAN_SIGN_GRID = [
	[12, 1, 2, 3],
	[11, null, null, 4],
	[10, null, null, 5],
	[9, 8, 7, 6],
];

function buildChartHeightStyle(height){
	const value = height || 720;
	return {
		'--india-chart-height': typeof value === 'number' ? `${value}px` : value,
	};
}

export const SIGN_NAMES = {
	1: AstroConst.ARIES,
	2: AstroConst.TAURUS,
	3: AstroConst.GEMINI,
	4: AstroConst.CANCER,
	5: AstroConst.LEO,
	6: AstroConst.VIRGO,
	7: AstroConst.LIBRA,
	8: AstroConst.SCORPIO,
	9: AstroConst.SAGITTARIUS,
	10: AstroConst.CAPRICORN,
	11: AstroConst.AQUARIUS,
	12: AstroConst.PISCES,
};

export const HOUSE_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

const INDIA_PLANET_LABELS = {
	[AstroConst.SUN]: 'Su',
	[AstroConst.MOON]: 'Mo',
	[AstroConst.MERCURY]: 'Me',
	[AstroConst.VENUS]: 'Ve',
	[AstroConst.MARS]: 'Ma',
	[AstroConst.JUPITER]: 'Ju',
	[AstroConst.SATURN]: 'Sa',
	[AstroConst.NORTH_NODE]: 'Ra',
	[AstroConst.SOUTH_NODE]: 'Ke',
	[AstroConst.URANUS]: 'Ur',
	[AstroConst.NEPTUNE]: 'Ne',
	[AstroConst.PLUTO]: 'Pl',
	[AstroConst.CHIRON]: 'Ch',
	[AstroConst.DARKMOON]: 'Li',
	[AstroConst.PURPLE_CLOUDS]: 'Zi',
	[AstroConst.ASC]: 'As',
	[AstroConst.DESC]: 'Ds',
	[AstroConst.MC]: 'MC',
	[AstroConst.IC]: 'IC',
};

export function normalizeDegree(lon){
	const num = Number(lon);
	if(!Number.isFinite(num)){
		return 0;
	}
	return ((num % 360) + 360) % 360;
}

function getSignNumberFromSign(sign){
	const idx = AstroConst.LIST_SIGNS.indexOf(sign);
	if(idx >= 0){
		return idx + 1;
	}
	return null;
}

export function getSignNumber(obj){
	if(!obj){
		return null;
	}
	const bySign = getSignNumberFromSign(obj.sign);
	if(bySign){
		return bySign;
	}
	if(obj.lon !== undefined && obj.lon !== null){
		return Math.floor(normalizeDegree(obj.lon) / 30) + 1;
	}
	return null;
}

export function getObject(chartObj, objid){
	if(!chartObj || !chartObj.chart || !Array.isArray(chartObj.chart.objects)){
		return null;
	}
	return chartObj.chart.objects.find((obj)=>obj.id === objid) || null;
}

export function getAscSignNumber(chartObj){
	const asc = getObject(chartObj, AstroConst.ASC);
	const ascSign = getSignNumber(asc);
	if(ascSign){
		return ascSign;
	}
	const houses = chartObj && chartObj.chart && Array.isArray(chartObj.chart.houses) ? chartObj.chart.houses : [];
	const house1 = houses.find((house)=>house.id === AstroConst.HOUSE1) || houses[0];
	const houseSign = getSignNumber(house1);
	if(houseSign){
		return houseSign;
	}
	if(house1 && house1.lon !== undefined && house1.lon !== null){
		return Math.floor(normalizeDegree(house1.lon) / 30) + 1;
	}
	return 1;
}

export function getHouseNumberForSign(signNumber, ascSignNumber){
	return ((signNumber - ascSignNumber + 12) % 12) + 1;
}

// WP-B 上升宫位参照:解出「第1宫」的星座号(1-12)。纯显示重参照(§1.6/§12.3),不动黄经。
// 'asc'/空 → 上升星座(默认,零回归);'houseN' → 上升起整宫第 N 宫的星座;行星/虚点 id → 该星座座号。
export function resolveLagnaRefSignNumber(chartObj, lagnaRef){
	const ascSign = getAscSignNumber(chartObj);
	if(!lagnaRef || lagnaRef === 'asc'){
		return ascSign;
	}
	const houseMatch = /^house(\d+)$/.exec(lagnaRef);
	if(houseMatch){
		const n = parseInt(houseMatch[1], 10);
		if(n >= 1 && n <= 12){
			return ((ascSign - 1 + (n - 1)) % 12) + 1;
		}
		return ascSign;
	}
	const sn = getSignNumber(getObject(chartObj, lagnaRef));
	return sn || ascSign;
}

export function getHouseLabel(houseNumber){
	return HOUSE_LABELS[houseNumber - 1] || `${houseNumber}`;
}

export function getSignSymbol(signNumber){
	const sign = SIGN_NAMES[signNumber];
	return AstroText.AstroMsg[sign] || `${signNumber}`;
}

export function getObjectLabel(obj){
	if(!obj || !obj.id){
		return '';
	}
	if(INDIA_PLANET_LABELS[obj.id]){
		return INDIA_PLANET_LABELS[obj.id];
	}
	const cn = AstroText.AstroMsgCN[obj.id] || obj.name || obj.id;
	return `${cn}`.slice(0, 2);
}

// WP-C 星体符号:glyph 模式下返回该星体的 ywastrochart 字形(Su='A'…),无字形(如部分阿拉伯点)返回 ''→回退文字。
export function resolveObjectGlyph(obj, glyphMode){
	if(glyphMode !== AstroConst.INDIA_PLANET_DISPLAY_GLYPH){
		return '';
	}
	if(!obj || !obj.id){
		return '';
	}
	return AstroText.AstroMsg[obj.id] || '';
}

function formatIndiaDegree(value, degreeDisplayMode){
	if(value === undefined || value === null || value === ''){
		return '';
	}
	const num = Number(value);
	if(!Number.isFinite(num)){
		return '';
	}
	const normalizedValue = ((num % 30) + 30) % 30;
	if(degreeDisplayMode !== 'full'){
		return `${Math.floor(normalizedValue)}°`;
	}
	const degs = splitDegree(normalizedValue);
	return `${degs[0]}°${`${degs[1]}`.padStart(2, '0')}′`;
}

export function getObjectDegree(obj, degreeDisplayMode){
	let value = obj && obj.signlon !== undefined && obj.signlon !== null ? obj.signlon : null;
	if(value === null && obj && obj.lon !== undefined && obj.lon !== null){
		value = normalizeDegree(obj.lon) % 30;
	}
	return formatIndiaDegree(value, degreeDisplayMode);
}

function getDegreeText(value, degreeDisplayMode){
	return formatIndiaDegree(value, degreeDisplayMode);
}

function getIndiaAyanamsaLabel(chartObj){
	const params = chartObj && chartObj.params ? chartObj.params : {};
	const key = params.ayanamsa || AstroConst.INDIA_AYANAMSA_DEFAULT;
	const found = AstroConst.INDIA_AYANAMSA_OPTIONS.find((item)=>item.value === key);
	return found ? found.label : (params.ayanamsaLabel || key || 'Lahiri');
}

function getIndiaHouseSystemLabel(chartObj){
	const params = chartObj && chartObj.params ? chartObj.params : {};
	const hsys = AstroConst.normalizeIndiaHouseSystem(params.hsys);
	const found = AstroConst.INDIA_HOUSE_SYSTEM_OPTIONS.find((item)=>item.value === hsys);
	return found ? found.label : `${params.hsys}`;
}

export function getIndiaChartOptionNote(chartObj){
	return `${getIndiaAyanamsaLabel(chartObj)} · ${getIndiaHouseSystemLabel(chartObj)}`;
}

export function getHouseCuspDegree(chartObj, houseNumber, signNumber, degreeDisplayMode){
	const houses = chartObj && chartObj.chart && Array.isArray(chartObj.chart.houses) ? chartObj.chart.houses : [];
	const house = houses.find((item)=>item.id === `House${houseNumber}`);
	if(!house){
		return '';
	}
	if(house.lon !== undefined && house.lon !== null){
		const normalizedLon = normalizeDegree(house.lon);
		const lonSignNumber = Math.floor(normalizedLon / 30) + 1;
		if(signNumber && lonSignNumber !== signNumber){
			return '';
		}
		return getDegreeText(normalizedLon % 30, degreeDisplayMode);
	}
	if(house.signlon !== undefined && house.signlon !== null){
		const houseSignNumber = getSignNumber(house);
		if(houseSignNumber && signNumber && houseSignNumber !== signNumber){
			return '';
		}
		return getDegreeText(house.signlon, degreeDisplayMode);
	}
	return '';
}

function buildDisplaySet(planetDisplay, lotsDisplay){
	const displaySet = new Set();
	if(Array.isArray(planetDisplay)){
		planetDisplay.forEach((id)=>displaySet.add(id));
	}
	if(Array.isArray(lotsDisplay)){
		lotsDisplay.forEach((id)=>displaySet.add(id));
	}
	return displaySet;
}

export function getObjectsBySign(chartObj, planetDisplay, lotsDisplay){
	if(!chartObj || !chartObj.chart){
		return {};
	}
	const displaySet = buildDisplaySet(planetDisplay, lotsDisplay);
	const shouldFilter = displaySet.size > 0;
	let objects = [];
	if(Array.isArray(chartObj.chart.objects)){
		objects = objects.concat(chartObj.chart.objects);
	}
	if(Array.isArray(chartObj.lots)){
		objects = objects.concat(chartObj.lots);
	}
	const bySign = {};
	objects.forEach((obj)=>{
		if(!obj || !obj.id){
			return;
		}
		if(shouldFilter && !displaySet.has(obj.id)){
			return;
		}
		const signNumber = getSignNumber(obj);
		if(!signNumber){
			return;
		}
		if(!bySign[signNumber]){
			bySign[signNumber] = [];
		}
		bySign[signNumber].push(obj);
	});
	Object.keys(bySign).forEach((key)=>{
		bySign[key].sort((a, b)=>{
			const aLon = a.signlon !== undefined && a.signlon !== null ? Number(a.signlon) : normalizeDegree(a.lon) % 30;
			const bLon = b.signlon !== undefined && b.signlon !== null ? Number(b.signlon) : normalizeDegree(b.lon) % 30;
			return aLon - bLon;
		});
	});
	return bySign;
}

export function getObjectColor(obj){
	if(!obj){
		return 'var(--horosa-accent-strong, #e7bd75)';
	}
	return AstroConst.AstroColor[obj.id]
		|| AstroConst.AstroColor[obj.sign]
		|| 'var(--horosa-accent-strong, #e7bd75)';
}

// WP-A 相映高亮：只有九曜(日月五星+罗计)投射 graha drishti(§4.1 表4-4)，故仅这些可点。
export const ASPECT_CASTERS = [
	AstroConst.SUN,
	AstroConst.MOON,
	AstroConst.MARS,
	AstroConst.MERCURY,
	AstroConst.JUPITER,
	AstroConst.VENUS,
	AstroConst.SATURN,
	AstroConst.NORTH_NODE,
	AstroConst.SOUTH_NODE,
];

export function isAspectCaster(objId){
	return ASPECT_CASTERS.indexOf(objId) >= 0;
}

// WP-N 逆时针→顺时针:北印/东印为图形盘,顺时针即把整盘水平镜像(X→100−X)。
// 文字用绝对定位(非 transform),镜像后仍正立可读。doMirror=true 时翻转,否则原样。
export function mirrorXIf(coord, doMirror){
	return doMirror ? (100 - Number(coord)) : Number(coord);
}

export function mirrorPolygonIf(points, doMirror){
	if(!doMirror || !points){
		return points;
	}
	return points.split(' ').map((pt)=>{
		const xy = pt.split(',');
		return `${100 - parseFloat(xy[0])},${xy[1]}`;
	}).join(' ');
}

// 由「当前显示盘」解出源星 aspectSourceId 所相映的星座号集合(1-12)。零请求，纯前端读真值。
//  - graha(Parashari，默认):整宫、非对称的曜相 jyotish.grahaDrishti——火 4/7/8、木·罗·计 5/7/9、土 3/7/10、余仅 7(§4.1)。
//  - rasi(Jaimini):座相 jyotish.jaimini.rasiDrishti——按源星「所在星座」查该座照见的座集(动→定/定→动[除邻]/双→双，§4.3)。
//    源星所在座本身不计(自照无意义)。tajika/kp/nadi 范式无对应高亮真值结构 → 回退 graha(切派只改右栏 tab 子集)。
export function getAspectedSignNumbers(chartObj, aspectSourceId, aspectParadigm){
	const set = new Set();
	if(!chartObj || !chartObj.jyotish || !aspectSourceId){
		return set;
	}
	if(aspectParadigm === 'rasi'){
		// Jaimini 座相:先定源星所在座 → 查 rasiDrishti;载荷缺表时前端静态算
		// (座相是纯几何:动看固除紧邻下一、固看动除紧邻前一、双看双,与 12×12 矩阵同规则)。
		const src = getObject(chartObj, aspectSourceId);
		const srcSign = src ? src.sign : null;
		const jaimini = chartObj.jyotish.jaimini;
		const rasiDrishti = (jaimini && Array.isArray(jaimini.rasiDrishti)) ? jaimini.rasiDrishti : [];
		const row = srcSign ? rasiDrishti.find((r)=>r && r.sign === srcSign) : null;
		const aspects = (row && Array.isArray(row.aspects)) ? row.aspects : [];
		if(aspects.length){
			aspects.forEach((sign)=>{
				const num = getSignNumberFromSign(sign);
				if(num){
					set.add(num);
				}
			});
			return set;
		}
		const srcNum = srcSign ? getSignNumberFromSign(srcSign) : null;
		if(srcNum){
			const i = srcNum - 1;                       // 0 基座号
			const MOV = [0, 3, 6, 9], FIX = [1, 4, 7, 10];
			let hits = [];
			if(MOV.indexOf(i) >= 0){ hits = FIX.filter((f)=>f !== (i + 1) % 12); }
			else if(FIX.indexOf(i) >= 0){ hits = MOV.filter((mv)=>mv !== (i + 11) % 12); }
			else { hits = [2, 5, 8, 11].filter((d)=>d !== i); }
			hits.forEach((j)=>set.add(j + 1));
		}
		return set;
	}
	if(aspectParadigm === 'tajika'){
		// Tajika:行星→行星,角距落 {0,60,90,120,180} 且在两曜 deeptamsha 半和容许度内 → 高亮对方所在座。
		const DEEPT = { Sun: 15, Moon: 12, Mars: 8, Mercury: 7, Jupiter: 9, Venus: 7, Saturn: 9,
			'North Node': 8, 'South Node': 8 };
		const src = getObject(chartObj, aspectSourceId);
		if(!src){ return set; }
		const ids = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'North Node', 'South Node'];
		ids.forEach((oid)=>{
			if(oid === aspectSourceId){ return; }
			const other = getObject(chartObj, oid);
			if(!other){ return; }
			let d = Math.abs(((Number(src.lon) - Number(other.lon)) % 360 + 360) % 360);
			if(d > 180){ d = 360 - d; }
			const orb = ((DEEPT[aspectSourceId] || 8) + (DEEPT[oid] || 8)) / 2;
			const hit = [0, 60, 90, 120, 180].some((ang)=>Math.abs(d - ang) <= orb);
			if(hit){
				const num = getSignNumberFromSign(other.sign);
				if(num){ set.add(num); }
			}
		});
		return set;
	}
	if(aspectParadigm === 'kp'){
		// KP:不画相位 —— 高亮该曜 significator 链所指诸宫的「座」(A>B>C>D ranked)。
		const sig = chartObj.jyotish.kp && chartObj.jyotish.kp.significators;
		const row = sig && sig[aspectSourceId];
		const houses = (row && Array.isArray(row.ranked)) ? row.ranked : [];
		const hs = Array.isArray(chartObj.chart && chartObj.chart.houses) ? chartObj.chart.houses : [];
		houses.forEach((hnum)=>{
			// 🔴 houses 数组非 House1..12 顺序(实测可从 House11 起排)——按 id 反查,
			// 位置下标取宫会随盘偏移(同文件其余取宫处均已用 find(id))。
			const h = hs.find((x)=>x && x.id === `House${hnum}`) || null;
			if(h && h.sign){
				const num = getSignNumberFromSign(h.sign);
				if(num){ set.add(num); }
			}else if(h && h.lon !== undefined){
				set.add((Math.floor((Number(h.lon) % 360) / 30) % 12) + 1);
			}
		});
		return set;
	}
	if(aspectParadigm === 'nadi'){
		// Nadi:高亮 同座合组(本座) + 含该曜的交换对之对方座。
		const nd = chartObj.jyotish.nadi || {};
		const src = getObject(chartObj, aspectSourceId);
		if(src){
			(nd.combinations || []).forEach((c)=>{
				if((c.planets || []).indexOf(aspectSourceId) >= 0){
					const num = getSignNumberFromSign(c.sign);
					if(num){ set.add(num); }
				}
			});
			(nd.exchanges || []).forEach((ex)=>{
				// 交换=双向强联动 → 高亮两端座(自座 + 对方座)。
				if(ex.a === aspectSourceId || ex.b === aspectSourceId){
					const na = getSignNumberFromSign(ex.aSign);
					const nb = getSignNumberFromSign(ex.bSign);
					if(na){ set.add(na); }
					if(nb){ set.add(nb); }
				}
			});
		}
		return set;
	}
	const graha = Array.isArray(chartObj.jyotish.grahaDrishti) ? chartObj.jyotish.grahaDrishti : [];
	graha.forEach((item)=>{
		if(item && item.giver === aspectSourceId){
			const num = getSignNumberFromSign(item.targetSign);
			if(num){
				set.add(num);
			}
		}
	});
	return set;
}

class IndiaSouthChart extends Component{
	shouldComponentUpdate(nextProps){
		// 南印为固定 4×4 星座网格,不用 counterClockwise → 用基础 keys(不含镜像项)。
		return indiaChartShouldUpdate(this, nextProps, INDIA_CHART_SCU_KEYS);
	}

	renderObject(obj, idx){
		const retro = obj && Number(obj.lonspeed) < 0;
		const label = getObjectLabel(obj);
		const glyph = resolveObjectGlyph(obj, this.props.planetGlyphMode);
		const degree = getObjectDegree(obj, this.props.degreeDisplayMode);
		const titleName = AstroText.AstroMsgCN[obj.id] || obj.name || obj.id;
		const clickable = !!(obj && obj.id && typeof this.props.onPlanetClick === 'function');
		const caster = !!(obj && isAspectCaster(obj.id));
		const isSource = !!(obj && this.props.aspectSourceId && this.props.aspectSourceId === obj.id);
		const handleClick = clickable ? (e)=>{ e.stopPropagation(); this.props.onPlanetClick(obj.id); } : undefined;
		return (
			<span
				className={`horosa-india-square-object${clickable ? ' horosa-india-square-object-clickable' : ''}${isSource ? ' is-aspect-source' : ''}`}
				key={`${obj.id}_${idx}_${obj.lon}`}
				title={`${titleName} ${degree}${retro ? ' 逆行' : ''}${clickable ? (caster ? ' · 点击高亮相映宫' : ' · 点击选中') : ''}`}
				style={{ '--india-object-color': getObjectColor(obj) }}
				onClick={handleClick}
			>
				{glyph
					? <span className="horosa-india-square-object-name horosa-india-square-object-glyph">{glyph}</span>
					: <span className="horosa-india-square-object-name">{label}</span>}
				<span className="horosa-india-square-object-degree">{degree}</span>
				{retro ? <span className="horosa-india-square-retro">R</span> : null}
			</span>
		);
	}

	renderCell(signNumber, rowIndex, colIndex, ascSignNumber, objectsBySign, chartObj){
		const sign = SIGN_NAMES[signNumber];
		const houseNumber = getHouseNumberForSign(signNumber, ascSignNumber);
		const objects = objectsBySign[signNumber] || [];
		const signName = AstroText.AstroMsgCN[sign] || sign;
		const cuspDegree = getHouseCuspDegree(chartObj, houseNumber, signNumber, this.props.degreeDisplayMode);
		const isAscCell = houseNumber === 1;
		const isAspected = !!(this._aspectedSigns && this._aspectedSigns.has(signNumber));
		return (
			<div
				key={`india_sign_${signNumber}`}
				className={`horosa-india-square-cell${isAscCell ? ' horosa-india-square-cell-asc' : ''}${isAspected ? ' is-aspected' : ''}`}
				style={{
					gridColumn: colIndex + 1,
					gridRow: rowIndex + 1,
				}}
				title={`${signName} · 第${houseNumber}宫`}
			>
				<div className="horosa-india-square-house">
					<div className="horosa-india-square-roman">{getHouseLabel(houseNumber)}</div>
					{cuspDegree ? <div className="horosa-india-square-cusp">{cuspDegree}</div> : null}
				</div>
				<div className="horosa-india-square-objects">
					{objects.map((obj, idx)=>this.renderObject(obj, idx))}
					{(this.props.overlayPoints || []).filter((op)=>op.signNumber === signNumber).map((op)=>(
						<span className="horosa-india-square-object horosa-india-flag-badge is-good" key={`ov_${op.key}`} title={op.title || op.key}>
							{op.label}
						</span>
					))}
				</div>
				<div className="horosa-india-square-sign" aria-label={`${signNumber} ${signName}`}>
					<span className="horosa-india-square-sign-symbol">{getSignSymbol(signNumber)}</span>
				</div>
			</div>
		);
	}

	renderCells(ascSignNumber, objectsBySign, chartObj){
		const cells = [];
		SOUTH_INDIAN_SIGN_GRID.forEach((row, rowIndex)=>{
			row.forEach((signNumber, colIndex)=>{
				if(!signNumber){
					return;
				}
				cells.push(this.renderCell(signNumber, rowIndex, colIndex, ascSignNumber, objectsBySign, chartObj));
			});
		});
		return cells;
	}

	render(){
		const chartObj = this.props.value;
		const chartnum = this.props.chartnum || 1;
		const label = this.props.label || (chartnum === 1 ? '命盘' : `${chartnum}分盘`);
		const height = this.props.height || 720;
		const chartHeightStyle = buildChartHeightStyle(height);
		if(!chartObj || !chartObj.chart || chartObj.err){
			return (
				<div className="horosa-india-square-shell" style={chartHeightStyle}>
					<div className="horosa-india-square-placeholder">等待排盘数据</div>
				</div>
			);
		}
		const ascSignNumber = resolveLagnaRefSignNumber(chartObj, this.props.lagnaRef);
		const objectsBySign = getObjectsBySign(chartObj, this.props.planetDisplay, this.props.lotsDisplay);
		this._aspectedSigns = getAspectedSignNumbers(chartObj, this.props.aspectSourceId, this.props.aspectParadigm);
		return (
			<div className="horosa-india-square-shell xq-chart-renderer xq-chart-renderer-india" style={chartHeightStyle}>
				<div className="horosa-india-square-board xq-india-board">
					{this.renderCells(ascSignNumber, objectsBySign, chartObj)}
					<div className="horosa-india-square-center">
						<div className="horosa-india-square-center-d">D{chartnum}</div>
						<div className="horosa-india-square-center-label">{label}</div>
						<div className="horosa-india-square-center-note">{getIndiaChartOptionNote(chartObj)}</div>
					</div>
				</div>
			</div>
		);
	}
}

export default IndiaSouthChart;
