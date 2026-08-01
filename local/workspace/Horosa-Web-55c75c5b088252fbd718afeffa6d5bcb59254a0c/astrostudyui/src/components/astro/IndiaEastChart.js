import { Component } from 'react';
import * as AstroText from '../../constants/AstroText';
import {
	SIGN_NAMES,
	getAscSignNumber,
	getAspectedSignNumbers,
	getHouseCuspDegree,
	getHouseLabel,
	getHouseNumberForSign,
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

const EAST_HOUSE_LABEL_POSITIONS = {
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

const EAST_SIGN_BADGE_POSITIONS = {
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

const EAST_OBJECT_ANCHOR_POSITIONS = {
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

// 东印盘按「星座」固定布局(positions 以 signNumber 为键):4 个边中矩形 + 8 个角三角。
// WP-A 相映高亮直接按被相映的星座号在 SVG 里画浅色面(避免给叠满整盘的分层 div 着色)。
const EAST_SIGN_POLYGONS = {
	1: '0,33.333 33.333,33.333 33.333,66.667 0,66.667',
	2: '0,66.667 33.333,66.667 0,100',
	3: '33.333,66.667 33.333,100 0,100',
	4: '33.333,66.667 66.667,66.667 66.667,100 33.333,100',
	5: '100,100 66.667,100 66.667,66.667',
	6: '100,66.667 100,100 66.667,66.667',
	7: '66.667,33.333 100,33.333 100,66.667 66.667,66.667',
	8: '100,0 100,33.333 66.667,33.333',
	9: '66.667,0 100,0 66.667,33.333',
	10: '33.333,0 66.667,0 66.667,33.333 33.333,33.333',
	11: '0,0 33.333,0 33.333,33.333',
	12: '0,0 33.333,33.333 0,33.333',
};

function buildChartHeightStyle(height){
	const value = height || 720;
	return {
		'--india-chart-height': typeof value === 'number' ? `${value}px` : value,
	};
}

class IndiaEastChart extends Component{
	shouldComponentUpdate(nextProps){
		// 东印为图形盘,消费 counterClockwise(镜像)→ 用含镜像项的 keys。
		return indiaChartShouldUpdate(this, nextProps, INDIA_CHART_SCU_KEYS_MIRROR);
	}

	renderObjects(objects, signNumber){
		const overlaySign = signNumber;
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
							key={`${signNumber}_${obj.id}_${idx}_${obj.lon}`}
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

	renderSign(signNumber, ascSignNumber, objectsBySign, chartObj){
		const houseNumber = getHouseNumberForSign(signNumber, ascSignNumber);
		const objects = objectsBySign[signNumber] || [];
		const doMirror = this.props.counterClockwise === false;
		const housePos = EAST_HOUSE_LABEL_POSITIONS[signNumber];
		const signPos = EAST_SIGN_BADGE_POSITIONS[signNumber];
		const objectsPos = EAST_OBJECT_ANCHOR_POSITIONS[signNumber];
		const sign = SIGN_NAMES[signNumber];
		const signName = AstroText.AstroMsgCN[sign] || sign;
		const cuspDegree = getHouseCuspDegree(chartObj, houseNumber, signNumber, this.props.degreeDisplayMode);
		return (
			<div
				key={`east_sign_${signNumber}`}
				className="horosa-india-diagram-layer"
				title={`${signName} · 第${houseNumber}宫`}
			>
				<div className="horosa-india-diagram-house horosa-india-diagram-house-corner" style={{ left: `${mirrorXIf(housePos[0], doMirror)}%`, top: `${housePos[1]}%` }}>
					<div className="horosa-india-square-roman">{getHouseLabel(houseNumber)}</div>
					{cuspDegree ? <div className="horosa-india-square-cusp">{cuspDegree}</div> : null}
				</div>
				<div className="horosa-india-diagram-sign horosa-india-diagram-sign-corner" aria-label={`${signNumber} ${signName}`} style={{ left: `${mirrorXIf(signPos[0], doMirror)}%`, top: `${signPos[1]}%` }}>
					<span className="horosa-india-square-sign-symbol">{getSignSymbol(signNumber)}</span>
				</div>
				<div
					className="horosa-india-diagram-object-anchor horosa-india-diagram-object-anchor-roomy"
					data-sign={signNumber}
					style={{ left: `${mirrorXIf(objectsPos[0], doMirror)}%`, top: `${objectsPos[1]}%`, width: `${objectsPos[2]}%`, height: `${objectsPos[3]}%` }}
				>
					{this.renderObjects(objects, signNumber)}
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
		const aspectedSignNumbers = Array.from(this._aspectedSigns);
		const doMirror = this.props.counterClockwise === false;
		return (
			<div className="horosa-india-square-shell xq-chart-renderer xq-chart-renderer-india" style={chartHeightStyle}>
				<div className="horosa-india-square-board horosa-india-diagram-board horosa-india-east-board xq-india-board">
					<svg className="horosa-india-diagram-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
						<rect x="0" y="0" width="100" height="100" />
						{aspectedSignNumbers.map((sn)=>(
							EAST_SIGN_POLYGONS[sn] ? <polygon key={`east_aspect_${sn}`} className="horosa-india-aspect-fill" points={mirrorPolygonIf(EAST_SIGN_POLYGONS[sn], doMirror)} /> : null
						))}
						<line x1="33.333" y1="0" x2="33.333" y2="33.333" />
						<line x1="66.667" y1="0" x2="66.667" y2="33.333" />
						<line x1="33.333" y1="66.667" x2="33.333" y2="100" />
						<line x1="66.667" y1="66.667" x2="66.667" y2="100" />
						<line x1="0" y1="33.333" x2="33.333" y2="33.333" />
						<line x1="66.667" y1="33.333" x2="100" y2="33.333" />
						<line x1="0" y1="66.667" x2="33.333" y2="66.667" />
						<line x1="66.667" y1="66.667" x2="100" y2="66.667" />
						<line x1="33.333" y1="0" x2="66.667" y2="0" />
						<line x1="33.333" y1="100" x2="66.667" y2="100" />
						<line x1="0" y1="0" x2="33.333" y2="33.333" />
						<line x1="100" y1="0" x2="66.667" y2="33.333" />
						<line x1="0" y1="100" x2="33.333" y2="66.667" />
						<line x1="100" y1="100" x2="66.667" y2="66.667" />
						<rect x="33.333" y="33.333" width="33.334" height="33.334" />
					</svg>
					{Object.keys(EAST_SIGN_BADGE_POSITIONS).map((signNumber)=>this.renderSign(Number(signNumber), ascSignNumber, objectsBySign, chartObj))}
					<div className="horosa-india-diagram-center horosa-india-diagram-center-compact">
						<div className="horosa-india-square-center-d">D{chartnum}</div>
						<div className="horosa-india-square-center-note">{getIndiaChartOptionNote(chartObj)}</div>
					</div>
				</div>
			</div>
		);
	}
}

export default IndiaEastChart;
