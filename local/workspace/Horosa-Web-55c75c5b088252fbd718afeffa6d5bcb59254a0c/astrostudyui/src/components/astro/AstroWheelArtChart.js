import React, { Component } from 'react';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { splitDegree } from './AstroHelper';
import { sameDisplayList, shallowPropsEqual } from '../../utils/chartUpdateGuard';
import { chartSCUEnabled } from '../../utils/perfFlags';
import {
	SIGN_NAMES,
	getAscSignNumber,
	getHouseNumberForSign,
	getObject,
	getObjectsBySign,
	getSignSymbol,
	normalizeDegree,
} from './IndiaSouthChart';
import '../../css/styles.less';

// 盘面美术(wheel art)方形覆盘:西占数据的希腊盘/中世纪盘/北印度盘/南印度盘画法。
// 布局几何复用印度三盘坐标系(viewBox 0..100 线层 + HTML 百分比定位层);中世纪盘为独立排版。
// 数据面直接消费与圆盘同源的 chartObj(chart.objects/chart.houses/lots),经 IndiaSouthChart 工具族分组 —— 零适配层。
// 覆盘语义:希腊/中世纪/北印 = 宫位固定槽(1 宫恒定位),星座随 AS 转;南印 = 星座固定格,宫号随 AS 转。

// ---- 希腊盘(井字 3×3):槽位=宫号,1 宫恒左中完整格,逆时针。坐标表与东印同几何(东印以星座为键,此处以槽位为键)。
const HELLENISTIC_HOUSE_LABEL_POSITIONS = {
	1: [5, 50],
	2: [5, 88],
	3: [12, 95],
	4: [50, 95],
	5: [88, 95],
	6: [95, 88],
	7: [95, 50],
	8: [95, 12],
	9: [88, 5],
	10: [50, 5],
	11: [12, 5],
	12: [5, 12],
};

const HELLENISTIC_SIGN_BADGE_POSITIONS = {
	1: [29, 50],
	2: [27, 70],
	3: [30, 73],
	4: [50, 71],
	5: [70, 73],
	6: [73, 70],
	7: [71, 50],
	8: [73, 30],
	9: [70, 27],
	10: [50, 29],
	11: [30, 27],
	12: [27, 30],
};

const HELLENISTIC_OBJECT_ANCHOR_POSITIONS = {
	1: [16.7, 50, 18, 16],
	2: [11.5, 77.5, 14, 14],
	3: [22.5, 88.5, 14, 14],
	4: [50, 83.5, 18, 16],
	5: [77.5, 88.5, 14, 14],
	6: [88.5, 77.5, 14, 14],
	7: [83.5, 50, 18, 16],
	8: [88.5, 22.5, 14, 14],
	9: [77.5, 11.5, 14, 14],
	10: [50, 16.5, 18, 16],
	11: [22.5, 11.5, 14, 14],
	12: [11.5, 22.5, 14, 14],
};

// ---- 北印度盘:槽位=宫号(北印原生语义即宫位固定),坐标表与 IndiaNorthChart 同几何。
const NORTHART_HOUSE_LABEL_POSITIONS = {
	1: [50, 5],
	2: [12, 5],
	3: [5, 12],
	4: [8, 50],
	5: [5, 88],
	6: [12, 95],
	7: [50, 95],
	8: [88, 95],
	9: [95, 88],
	10: [92, 50],
	11: [95, 12],
	12: [88, 5],
};

// 角三角徽章对齐「长边(外框边)垂直平分线」(用户校准):沿长边方向坐标钉到 25/75,离斜边交汇区最远,
// 度分横排完整显示不压边界;菱形槽(1/4/7/10)无长边,维持格心位。
const NORTHART_SIGN_BADGE_POSITIONS = {
	1: [50, 39],
	2: [25, 20],
	3: [20, 25],
	4: [40, 50],
	5: [20, 75],
	6: [25, 80],
	7: [50, 61],
	8: [75, 80],
	9: [80, 75],
	10: [60, 50],
	11: [80, 25],
	12: [75, 20],
};

const NORTHART_OBJECT_ANCHOR_POSITIONS = {
	1: [50, 25, 18, 16],
	2: [25, 12, 14, 14],
	3: [12, 25, 13, 16],
	4: [25, 50, 16, 17],
	5: [12, 75, 13, 16],
	6: [25, 88, 14, 14],
	7: [50, 75, 18, 16],
	8: [75, 88, 14, 14],
	9: [88, 75, 13, 16],
	10: [75, 50, 16, 17],
	11: [88, 25, 13, 16],
	12: [75, 12, 14, 14],
};

// ---- 中世纪盘:独立排版(用户规格)。内方形 25..75;12 三角逆时针,1 宫恒左中(底=内方形左边)。
// 1/4/7/10 宫号=内方形四边中点外侧留安全距;其余宫号成对贴内方形四角,全对称。
const MEDIEVAL_HOUSE_POLYGONS = {
	1: '0,50 25,25 25,75',
	2: '0,50 0,100 25,75',
	3: '0,100 50,100 25,75',
	4: '50,100 25,75 75,75',
	5: '50,100 100,100 75,75',
	6: '100,100 100,50 75,75',
	7: '100,50 75,75 75,25',
	8: '100,50 100,0 75,25',
	9: '100,0 50,0 75,25',
	10: '50,0 25,25 75,25',
	11: '50,0 0,0 25,25',
	12: '0,0 0,50 25,25',
};

// 宫号贴内方形(用户校准:安全距 1~2 个百分点,不再远离);角宫号成对贴内方形四角。逐点核过不压任何分宫线。
const MEDIEVAL_HOUSE_LABEL_POSITIONS = {
	1: [22.5, 50],
	2: [20, 76.5],
	3: [23.5, 80],
	4: [50, 77.5],
	5: [76.5, 80],
	6: [80, 76.5],
	7: [77.5, 50],
	8: [80, 23.5],
	9: [76.5, 20],
	10: [50, 22.5],
	11: [23.5, 20],
	12: [20, 23.5],
};

// 星座徽章锚点(用户标注定版):骑在「该宫宫头分宫线」(斜边)的中点上,白底框垫底防线穿字 ——
// 方形盘上的 cusp 标注位。1 宫头=1|12 界 (0,50)-(25,25) 中点 (12.5,37.5),其余逆时针类推。
const MEDIEVAL_SIGN_BADGE_POSITIONS = {
	1: [12.5, 37.5],
	2: [12.5, 62.5],
	3: [12.5, 87.5],
	4: [37.5, 87.5],
	5: [62.5, 87.5],
	6: [87.5, 87.5],
	7: [87.5, 62.5],
	8: [87.5, 37.5],
	9: [87.5, 12.5],
	10: [62.5, 12.5],
	11: [37.5, 12.5],
	12: [12.5, 12.5],
};

// 星体锚盒(x,y,w,h)=各三角形**精确质心**(用户定版:「星体显示位置放每个三角形的中心」)。
// 质心:1(16.7,50) 2(8.3,75) 3(25,91.7) 4(50,83.3) 5(75,91.7) 6(91.7,75) 7(83.3,50) 8(91.7,25)
//       9(75,8.3) 10(50,16.7) 11(25,8.3) 12(8.3,25)。盒尺寸按槽向收敛,与骑线徽章/宫号框逐对核过零重叠。
const MEDIEVAL_OBJECT_ANCHOR_POSITIONS = {
	1: [16.5, 50, 9, 16],
	2: [8.3, 75, 8, 12],
	3: [25, 91.7, 12, 8],
	4: [50, 83.5, 12, 8],
	5: [75, 91.7, 12, 8],
	6: [91.7, 75, 8, 12],
	7: [83.5, 50, 9, 16],
	8: [91.7, 25, 8, 12],
	9: [75, 8.3, 12, 8],
	10: [50, 16.5, 12, 8],
	11: [25, 8.3, 12, 8],
	12: [8.3, 25, 8, 12],
};

// ---- 南印度盘:星座固定 4×4 环格(与 IndiaSouthChart 同几何),宫号随 AS 转。
const SOUTHART_SIGN_GRID = [
	[12, 1, 2, 3],
	[11, null, null, 4],
	[10, null, null, 5],
	[9, 8, 7, 6],
];

const ANGLE_IDS = new Set([AstroConst.ASC, AstroConst.MC]);
const ANGLE_COLOR = '#b03a2e';

const WHEELART_SCU_KEYS = [
	'value', 'wheelArt', 'planetDisplay', 'lotsDisplay', 'height', 'label',
];
const WHEELART_SCU_COMPARATORS = {
	planetDisplay: sameDisplayList,
	lotsDisplay: sameDisplayList,
};

function buildChartHeightStyle(height){
	const value = height || 720;
	return {
		'--india-chart-height': typeof value === 'number' ? `${value}px` : value,
	};
}

function signNumberForHouse(houseNumber, ascSignNumber){
	return ((ascSignNumber + houseNumber - 2) % 12) + 1;
}

// 西占星体 glyph:恒用 ywastrochart 字形,无字形回退中文名截 2 字(不走印度称谓表)。
function resolveWesternGlyph(obj){
	if(!obj || !obj.id){
		return '';
	}
	return AstroText.AstroMsg[obj.id] || '';
}

function westernObjectLabel(obj){
	if(!obj || !obj.id){
		return '';
	}
	const cn = AstroText.AstroMsgCN[obj.id] || obj.name || obj.id;
	return `${cn}`.slice(0, 2);
}

function formatArtDegree(value){
	const num = Number(value);
	if(!Number.isFinite(num)){
		return '';
	}
	const normalizedValue = ((num % 30) + 30) % 30;
	const degs = splitDegree(normalizedValue);
	return `${degs[0]}°${`${degs[1]}`.padStart(2, '0')}′`;
}

function getWesternObjectDegree(obj){
	let value = obj && obj.signlon !== undefined && obj.signlon !== null ? obj.signlon : null;
	if(value === null && obj && obj.lon !== undefined && obj.lon !== null){
		value = normalizeDegree(obj.lon) % 30;
	}
	return formatArtDegree(value);
}

// 宫头度分三段(度/星座glyph/分):象限制下=该宫头在其星座内的投影;整宫制宫头恒 0°00′ → 不标(格子留星座徽章)。
function getArtCuspParts(chartObj, houseNumber){
	const houses = chartObj && chartObj.chart && Array.isArray(chartObj.chart.houses) ? chartObj.chart.houses : [];
	const house = houses.find((item)=>item && item.id === `House${houseNumber}`);
	if(!house || house.lon === undefined || house.lon === null){
		return null;
	}
	const lon = normalizeDegree(house.lon);
	const inSign = lon % 30;
	const degs = splitDegree(inSign);
	if(degs[0] === 0 && degs[1] === 0){
		return null;
	}
	return {
		deg: `${degs[0]}°`,
		min: `${`${degs[1]}`.padStart(2, '0')}′`,
	};
}

// AS/MC 恒并入显示集:角点是盘骨架,不随「星体显示」勾选被滤掉。
function withAngles(planetDisplay){
	if(!Array.isArray(planetDisplay) || planetDisplay.length === 0){
		return planetDisplay;
	}
	const merged = planetDisplay.slice(0);
	[AstroConst.ASC, AstroConst.MC].forEach((id)=>{
		if(merged.indexOf(id) < 0){
			merged.push(id);
		}
	});
	return merged;
}

class AstroWheelArtChart extends Component{
	shouldComponentUpdate(nextProps){
		if(!chartSCUEnabled()){
			return true;
		}
		return !shallowPropsEqual(this.props, nextProps, WHEELART_SCU_KEYS, WHEELART_SCU_COMPARATORS);
	}

	renderObjects(objects, slotKey){
		return (
			<div className={`horosa-india-diagram-objects${objects.length > 3 ? ' horosa-india-diagram-objects-very-dense' : (objects.length > 1 ? ' horosa-india-diagram-objects-dense' : ' horosa-india-diagram-objects-single')}`} data-count={objects.length}>
				{objects.map((obj, idx)=>this.renderObject(obj, `${slotKey}_${idx}`))}
			</div>
		);
	}

	renderObject(obj, key){
		const retro = obj && Number(obj.lonspeed) < 0;
		const glyph = resolveWesternGlyph(obj);
		const degree = getWesternObjectDegree(obj);
		const isAngle = !!(obj && ANGLE_IDS.has(obj.id));
		const titleName = AstroText.AstroMsgCN[obj.id] || obj.name || obj.id;
		return (
			<span
				className={`horosa-india-square-object${isAngle ? ' horosa-wheelart-angle' : ''}`}
				key={`${key}_${obj.id}_${obj.lon}`}
				title={`${titleName} ${degree}${retro ? ' 逆行' : ''}`}
				style={{ '--india-object-color': isAngle ? ANGLE_COLOR : 'var(--horosa-text, #162033)' }}
			>
				{glyph
					? <span className="horosa-india-square-object-name horosa-india-square-object-glyph">{glyph}</span>
					: <span className="horosa-india-square-object-name">{westernObjectLabel(obj)}</span>}
				<span className="horosa-india-square-object-degree">{degree}</span>
				{retro ? <span className="horosa-india-square-retro">R</span> : null}
			</span>
		);
	}

	// 通用槽位盘(希腊/中世纪/北印):槽位=宫号固定,星座随 AS 转。
	renderHouseSlot(art, houseNumber, ascSignNumber, objectsBySign, chartObj, tables){
		const signNumber = signNumberForHouse(houseNumber, ascSignNumber);
		const objects = objectsBySign[signNumber] || [];
		const labelPos = tables.house[houseNumber];
		const signPos = tables.sign[houseNumber];
		const objectsPos = tables.anchor[houseNumber];
		const sign = SIGN_NAMES[signNumber];
		const signName = AstroText.AstroMsgCN[sign] || sign;
		const cusp = getArtCuspParts(chartObj, houseNumber);
		const isMedieval = art === AstroConst.WHEEL_ART_MEDIEVAL;
		return (
			<div
				key={`${art}_house_${houseNumber}`}
				className="horosa-india-diagram-layer"
				title={`第${houseNumber}宫 · ${signName}`}
			>
				<div className="horosa-india-diagram-house horosa-india-diagram-house-corner" style={{ left: `${labelPos[0]}%`, top: `${labelPos[1]}%` }}>
					<div className="horosa-india-square-roman">{houseNumber}</div>
				</div>
				<div
					className={`horosa-india-diagram-sign horosa-india-diagram-sign-corner${isMedieval ? ' horosa-wheelart-sign-boxed' : ''}`}
					aria-label={`${signNumber} ${signName}`}
					style={{ left: `${signPos[0]}%`, top: `${signPos[1]}%` }}
				>
					{cusp ? <span className="horosa-wheelart-cusp-deg">{cusp.deg}</span> : null}
					<span className="horosa-india-square-sign-symbol">{getSignSymbol(signNumber)}</span>
					{cusp ? <span className="horosa-wheelart-cusp-deg">{cusp.min}</span> : null}
				</div>
				<div
					className="horosa-india-diagram-object-anchor horosa-india-diagram-object-anchor-roomy"
					data-house={houseNumber}
					style={{ left: `${objectsPos[0]}%`, top: `${objectsPos[1]}%`, width: `${objectsPos[2]}%`, height: `${objectsPos[3]}%` }}
				>
					{this.renderObjects(objects, `${art}_${houseNumber}`)}
				</div>
			</div>
		);
	}

	renderSlotBoard(art, chartObj, ascSignNumber, objectsBySign, lines, tables){
		return (
			<div className={`horosa-india-square-board horosa-india-diagram-board horosa-wheelart-board horosa-wheelart-${art}-board xq-india-board`}>
				<svg className="horosa-india-diagram-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
					{lines}
				</svg>
				{Object.keys(tables.house).map((houseNumber)=>this.renderHouseSlot(art, Number(houseNumber), ascSignNumber, objectsBySign, chartObj, tables))}
			</div>
		);
	}

	renderHellenistic(chartObj, ascSignNumber, objectsBySign){
		const lines = (
			<>
				<rect x="0" y="0" width="100" height="100" />
				<line x1="33.333" y1="0" x2="33.333" y2="33.333" />
				<line x1="66.667" y1="0" x2="66.667" y2="33.333" />
				<line x1="33.333" y1="66.667" x2="33.333" y2="100" />
				<line x1="66.667" y1="66.667" x2="66.667" y2="100" />
				<line x1="0" y1="33.333" x2="33.333" y2="33.333" />
				<line x1="66.667" y1="33.333" x2="100" y2="33.333" />
				<line x1="0" y1="66.667" x2="33.333" y2="66.667" />
				<line x1="66.667" y1="66.667" x2="100" y2="66.667" />
				<line x1="0" y1="0" x2="33.333" y2="33.333" />
				<line x1="100" y1="0" x2="66.667" y2="33.333" />
				<line x1="0" y1="100" x2="33.333" y2="66.667" />
				<line x1="100" y1="100" x2="66.667" y2="66.667" />
				<rect x="33.333" y="33.333" width="33.334" height="33.334" />
			</>
		);
		return this.renderSlotBoard(AstroConst.WHEEL_ART_HELLENISTIC, chartObj, ascSignNumber, objectsBySign, lines, {
			house: HELLENISTIC_HOUSE_LABEL_POSITIONS,
			sign: HELLENISTIC_SIGN_BADGE_POSITIONS,
			anchor: HELLENISTIC_OBJECT_ANCHOR_POSITIONS,
		});
	}

	renderMedieval(chartObj, ascSignNumber, objectsBySign){
		const lines = (
			<>
				<rect x="0" y="0" width="100" height="100" />
				<rect x="25" y="25" width="50" height="50" />
				<line x1="0" y1="0" x2="25" y2="25" />
				<line x1="100" y1="0" x2="75" y2="25" />
				<line x1="100" y1="100" x2="75" y2="75" />
				<line x1="0" y1="100" x2="25" y2="75" />
				<line x1="50" y1="0" x2="25" y2="25" />
				<line x1="50" y1="0" x2="75" y2="25" />
				<line x1="100" y1="50" x2="75" y2="25" />
				<line x1="100" y1="50" x2="75" y2="75" />
				<line x1="50" y1="100" x2="25" y2="75" />
				<line x1="50" y1="100" x2="75" y2="75" />
				<line x1="0" y1="50" x2="25" y2="25" />
				<line x1="0" y1="50" x2="25" y2="75" />
			</>
		);
		return this.renderSlotBoard(AstroConst.WHEEL_ART_MEDIEVAL, chartObj, ascSignNumber, objectsBySign, lines, {
			house: MEDIEVAL_HOUSE_LABEL_POSITIONS,
			sign: MEDIEVAL_SIGN_BADGE_POSITIONS,
			anchor: MEDIEVAL_OBJECT_ANCHOR_POSITIONS,
		});
	}

	renderNorthIndian(chartObj, ascSignNumber, objectsBySign){
		const lines = (
			<>
				<rect x="0" y="0" width="100" height="100" />
				<polygon points="50,0 100,50 50,100 0,50" />
				<line x1="0" y1="0" x2="50" y2="50" />
				<line x1="100" y1="0" x2="50" y2="50" />
				<line x1="0" y1="100" x2="50" y2="50" />
				<line x1="100" y1="100" x2="50" y2="50" />
			</>
		);
		return this.renderSlotBoard(AstroConst.WHEEL_ART_NORTH_INDIAN, chartObj, ascSignNumber, objectsBySign, lines, {
			house: NORTHART_HOUSE_LABEL_POSITIONS,
			sign: NORTHART_SIGN_BADGE_POSITIONS,
			anchor: NORTHART_OBJECT_ANCHOR_POSITIONS,
		});
	}

	renderSouthCell(signNumber, rowIndex, colIndex, ascSignNumber, objectsBySign, chartObj){
		const sign = SIGN_NAMES[signNumber];
		const houseNumber = getHouseNumberForSign(signNumber, ascSignNumber);
		const objects = objectsBySign[signNumber] || [];
		const signName = AstroText.AstroMsgCN[sign] || sign;
		const cusp = getArtCuspParts(chartObj, houseNumber);
		const isAscCell = houseNumber === 1;
		return (
			<div
				key={`wheelart_south_${signNumber}`}
				className={`horosa-india-square-cell${isAscCell ? ' horosa-india-square-cell-asc' : ''}`}
				style={{
					gridColumn: colIndex + 1,
					gridRow: rowIndex + 1,
				}}
				title={`${signName} · 第${houseNumber}宫`}
			>
				<div className="horosa-india-square-house">
					<div className="horosa-india-square-roman">{houseNumber}</div>
					{cusp ? <div className="horosa-india-square-cusp">{`${cusp.deg}${cusp.min}`}</div> : null}
				</div>
				<div className="horosa-india-square-objects">
					{objects.map((obj, idx)=>this.renderObject(obj, `south_${signNumber}_${idx}`))}
				</div>
				<div className="horosa-india-square-sign" aria-label={`${signNumber} ${signName}`}>
					<span className="horosa-india-square-sign-symbol">{getSignSymbol(signNumber)}</span>
				</div>
			</div>
		);
	}

	renderSouthIndian(chartObj, ascSignNumber, objectsBySign){
		const cells = [];
		SOUTHART_SIGN_GRID.forEach((row, rowIndex)=>{
			row.forEach((signNumber, colIndex)=>{
				if(!signNumber){
					return;
				}
				cells.push(this.renderSouthCell(signNumber, rowIndex, colIndex, ascSignNumber, objectsBySign, chartObj));
			});
		});
		return (
			<div className="horosa-india-square-board horosa-wheelart-south-board xq-india-board">
				{cells}
				<div className="horosa-india-square-center">
					<div className="horosa-india-square-center-label">{this.props.label || '命盘'}</div>
				</div>
			</div>
		);
	}

	render(){
		const chartObj = this.props.value;
		const art = AstroConst.normalizeWheelArt(this.props.wheelArt);
		const height = this.props.height || 720;
		const chartHeightStyle = buildChartHeightStyle(height);
		if(!chartObj || !chartObj.chart || chartObj.err){
			return (
				<div className="horosa-india-square-shell horosa-wheelart-shell" style={chartHeightStyle}>
					<div className="horosa-india-square-placeholder">等待排盘数据</div>
				</div>
			);
		}
		const ascSignNumber = getAscSignNumber(chartObj);
		const objectsBySign = getObjectsBySign(chartObj, withAngles(this.props.planetDisplay), this.props.lotsDisplay);
		let board = null;
		if(art === AstroConst.WHEEL_ART_HELLENISTIC){
			board = this.renderHellenistic(chartObj, ascSignNumber, objectsBySign);
		}else if(art === AstroConst.WHEEL_ART_MEDIEVAL){
			board = this.renderMedieval(chartObj, ascSignNumber, objectsBySign);
		}else if(art === AstroConst.WHEEL_ART_NORTH_INDIAN){
			board = this.renderNorthIndian(chartObj, ascSignNumber, objectsBySign);
		}else if(art === AstroConst.WHEEL_ART_SOUTH_INDIAN){
			board = this.renderSouthIndian(chartObj, ascSignNumber, objectsBySign);
		}
		return (
			<div className="horosa-india-square-shell horosa-wheelart-shell xq-chart-renderer xq-chart-renderer-wheelart" style={chartHeightStyle}>
				{board}
			</div>
		);
	}
}

export { getArtCuspParts, signNumberForHouse, withAngles, MEDIEVAL_HOUSE_POLYGONS, MEDIEVAL_HOUSE_LABEL_POSITIONS, MEDIEVAL_SIGN_BADGE_POSITIONS, MEDIEVAL_OBJECT_ANCHOR_POSITIONS };
export default AstroWheelArtChart;
