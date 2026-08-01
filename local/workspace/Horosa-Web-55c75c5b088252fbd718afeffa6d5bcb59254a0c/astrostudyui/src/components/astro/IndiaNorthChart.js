import { Component } from 'react';
import * as AstroText from '../../constants/AstroText';
import {
	HOUSE_LABELS,
	SIGN_NAMES,
	getAscSignNumber,
	getAspectedSignNumbers,
	getHouseCuspDegree,
	getHouseLabel,
	getObjectColor,
	getObjectDegree,
	getObjectLabel,
	getObjectsBySign,
	getIndiaChartOptionNote,
	getSignSymbol,
	isAspectCaster,
	mirrorPolygonIf,
	mirrorXIf,
	resolveLagnaRefSignNumber,
	resolveObjectGlyph,
	indiaChartShouldUpdate,
	INDIA_CHART_SCU_KEYS_MIRROR,
} from './IndiaSouthChart';
import '../../css/styles.less';

const NORTH_HOUSE_LABEL_POSITIONS = {
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

const NORTH_SIGN_BADGE_POSITIONS = {
	1: [50, 39],
	2: [28, 20],
	3: [20, 28],
	4: [40, 50],
	5: [20, 72],
	6: [28, 80],
	7: [50, 61],
	8: [72, 80],
	9: [80, 72],
	10: [60, 50],
	11: [80, 28],
	12: [72, 20],
};

const NORTH_OBJECT_ANCHOR_POSITIONS = {
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

// 北印盘 12 宫的标准多边形(viewBox 0..100):4 个菱形(1/4/7/10)+ 8 个三角(角宫)。
// WP-A 相映高亮按宫形在 SVG 里画浅色面,避免给叠满整盘的分层 div 着色而糊满全盘。
const NORTH_HOUSE_POLYGONS = {
	1: '50,0 75,25 50,50 25,25',
	2: '0,0 50,0 25,25',
	3: '0,0 25,25 0,50',
	4: '0,50 25,25 50,50 25,75',
	5: '0,50 25,75 0,100',
	6: '0,100 25,75 50,100',
	7: '50,100 25,75 50,50 75,75',
	8: '50,100 75,75 100,100',
	9: '100,100 75,75 100,50',
	10: '100,50 75,75 50,50 75,25',
	11: '100,50 75,25 100,0',
	12: '100,0 75,25 50,0',
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

class IndiaNorthChart extends Component{
	shouldComponentUpdate(nextProps){
		// 北印为图形盘,消费 counterClockwise(镜像)→ 用含镜像项的 keys。
		return indiaChartShouldUpdate(this, nextProps, INDIA_CHART_SCU_KEYS_MIRROR);
	}

	renderObjects(objects, houseNumber, overlaySign){
		const degreeDisplayMode = this.props.degreeDisplayMode;
		const countClass = objects.length > 3 ? ' horosa-india-diagram-objects-very-dense' : (objects.length > 1 ? ' horosa-india-diagram-objects-dense' : ' horosa-india-diagram-objects-single');
		return (
			<div className={`horosa-india-diagram-objects${countClass}`} data-count={objects.length}>
				{objects.map((obj, idx)=>{
					const degree = getObjectDegree(obj, degreeDisplayMode);
					const glyph = resolveObjectGlyph(obj, this.props.planetGlyphMode);
					const clickable = !!(obj && obj.id && typeof this.props.onPlanetClick === 'function');
					const caster = !!(obj && isAspectCaster(obj.id));
					const isSource = !!(obj && this.props.aspectSourceId && this.props.aspectSourceId === obj.id);
					const handleClick = clickable ? (e)=>{ e.stopPropagation(); this.props.onPlanetClick(obj.id); } : undefined;
					return (
						<span
							className={`horosa-india-square-object${clickable ? ' horosa-india-square-object-clickable' : ''}${isSource ? ' is-aspect-source' : ''}`}
							key={`${houseNumber}_${obj.id}_${idx}_${obj.lon}`}
							title={`${AstroText.AstroMsgCN[obj.id] || obj.name || obj.id} ${degree}${clickable ? (caster ? ' · 点击高亮相映宫' : ' · 点击选中') : ''}`}
							style={{ '--india-object-color': getObjectColor(obj) }}
							onClick={handleClick}
						>
							{glyph
								? <span className="horosa-india-square-object-name horosa-india-square-object-glyph">{glyph}</span>
								: <span className="horosa-india-square-object-name">{getObjectLabel(obj)}</span>}
							<span className="horosa-india-square-object-degree">{degree}</span>
							{Number(obj.lonspeed) < 0 ? <span className="horosa-india-square-retro">R</span> : null}
						</span>
					);
				})}
				{(this.props.overlayPoints || []).filter((op)=>op.signNumber === overlaySign).map((op)=>(
					<span className="horosa-india-square-object horosa-india-flag-badge is-good" key={`ov_${op.key}`} title={op.title || op.key}>
						{op.label}
					</span>
				))}
			</div>
		);
	}

	renderHouse(houseNumber, ascSignNumber, objectsBySign, chartObj){
		const signNumber = signNumberForHouse(houseNumber, ascSignNumber);
		const objects = objectsBySign[signNumber] || [];
		const doMirror = this.props.counterClockwise === false;
		const labelPos = NORTH_HOUSE_LABEL_POSITIONS[houseNumber];
		const signPos = NORTH_SIGN_BADGE_POSITIONS[houseNumber];
		const objectsPos = NORTH_OBJECT_ANCHOR_POSITIONS[houseNumber];
		const sign = SIGN_NAMES[signNumber];
		const signName = AstroText.AstroMsgCN[sign] || sign;
		const cuspDegree = getHouseCuspDegree(chartObj, houseNumber, signNumber, this.props.degreeDisplayMode);
		return (
			<div
				key={`north_house_${houseNumber}`}
				className="horosa-india-diagram-layer"
				title={`第${houseNumber}宫 · ${signName}`}
			>
				<div className="horosa-india-diagram-house horosa-india-diagram-house-corner" style={{ left: `${mirrorXIf(labelPos[0], doMirror)}%`, top: `${labelPos[1]}%` }}>
					<div className="horosa-india-square-roman">{getHouseLabel(houseNumber)}</div>
					{cuspDegree ? <div className="horosa-india-square-cusp">{cuspDegree}</div> : null}
				</div>
				<div className="horosa-india-diagram-sign horosa-india-diagram-sign-corner" aria-label={`${signNumber} ${signName}`} style={{ left: `${mirrorXIf(signPos[0], doMirror)}%`, top: `${signPos[1]}%` }}>
					<span className="horosa-india-square-sign-symbol">{getSignSymbol(signNumber)}</span>
				</div>
				<div
					className="horosa-india-diagram-object-anchor horosa-india-diagram-object-anchor-roomy"
					data-house={houseNumber}
					style={{ left: `${mirrorXIf(objectsPos[0], doMirror)}%`, top: `${objectsPos[1]}%`, width: `${objectsPos[2]}%`, height: `${objectsPos[3]}%` }}
				>
					{this.renderObjects(objects, houseNumber, signNumber)}
				</div>
			</div>
		);
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
		const doMirror = this.props.counterClockwise === false;
		const aspectedHouses = [];
		for(let h = 1; h <= 12; h++){
			if(this._aspectedSigns.has(signNumberForHouse(h, ascSignNumber))){
				aspectedHouses.push(h);
			}
		}
		return (
			<div className="horosa-india-square-shell xq-chart-renderer xq-chart-renderer-india" style={chartHeightStyle}>
				<div className="horosa-india-square-board horosa-india-diagram-board horosa-india-north-board xq-india-board">
					<svg className="horosa-india-diagram-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
						<rect x="0" y="0" width="100" height="100" />
						{aspectedHouses.map((h)=>(
							<polygon key={`north_aspect_${h}`} className="horosa-india-aspect-fill" points={mirrorPolygonIf(NORTH_HOUSE_POLYGONS[h], doMirror)} />
						))}
						<polygon points="50,0 100,50 50,100 0,50" />
						<line x1="0" y1="0" x2="50" y2="50" />
						<line x1="100" y1="0" x2="50" y2="50" />
						<line x1="0" y1="100" x2="50" y2="50" />
						<line x1="100" y1="100" x2="50" y2="50" />
					</svg>
					{HOUSE_LABELS.map((_, idx)=>this.renderHouse(idx + 1, ascSignNumber, objectsBySign, chartObj))}
					<div className="horosa-india-diagram-center horosa-india-diagram-center-compact">
						<div className="horosa-india-square-center-d">D{chartnum}</div>
						<div className="horosa-india-square-center-note">{getIndiaChartOptionNote(chartObj)}</div>
					</div>
				</div>
			</div>
		);
	}
}

export default IndiaNorthChart;
