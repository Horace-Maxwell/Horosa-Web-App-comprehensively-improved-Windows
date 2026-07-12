import React, { Component } from 'react';
import { createPortal } from 'react-dom';
import {
	MOIRA_WHEEL_R as R,
	MOIRA_WHEEL_VIEW as VIEW,
	MOIRA_BACKGROUND as MOIRA_BG,
	MOIRA_BLACK as BLACK,
	MOIRA_GREEN as GREEN,
	MOIRA_BLUE as BLUE,
	MOIRA_RED as RED,
	MOIRA_MAGENTA as MAGENTA,
	MOIRA_PALE as PALE,
	moiraAnnularSectorPath as annularSectorPath,
	moiraBuildFixedStars as buildFixedStars,
	moiraObliquityDeg,
	moiraEclEquConvertDeg,
	moiraCollectGods as collectGods,
	moiraGodColumnStep as godColumnStep,
	moiraGodTextSize as godTextSize,
	moiraHorizontalRingText as horizontalRingText,
	moiraObjectTooltip as objectTooltip,
	moiraOrderedGods as orderedGods,
	moiraPlanetColor as planetColor,
	moiraPlanetPlacements as planetPlacements,
	moiraPairedRadialText as pairedRadialText,
	moiraPoint as point,
	moiraRadialColumns as radialColumns,
	moiraRadialStackText as radialStackText,
	moiraRadialLine as radialLine,
	moiraVerticalText as verticalText,
	moiraGetZiGods as getZiGods,
	moiraBuildStellarRelations as buildStellarRelations,
	MOIRA_BIRTH_GOD_ORDER as BIRTH_GOD_ORDER,
} from './GuoLaoMoiraWheel';
import * as AstroConst from '../../constants/AstroConst';
import { guolaoShenShaTip } from './GuoLaoShenShaDoc';
import { moiraGodsFromRuleHits, moiraLongLifeCharFor, moiraWeakSolidRowForZi, moiraWeakSolidMarkers, moiraZhiDegText, moiraIsEclipticDisplayChart, moiraMapCuspsToDisplay } from './GuoLaoMoiraWheel';
import { azTheta, applyDeclination, mountainPosition, quickWheelAz, shanColor, PLATE_OFFSET, resolveRingShifts, PICK_LAYOUTS, pickLayoutMode, COMPASS_STELLAR } from './electionCore';
import { SHAN_ORDER, SHAN_CENTER_DEG } from '../fengshui/fengshuiData';
import { hsysDisplayName } from './guolaoData';
import { cornerTextBlock, riseSetLines } from './GuoLaoWheelCaptions';
import './GuoLaoMoiraWheel.less';

// 二十八宿环占 r(4)~r(6)（两个边界圆，宽 0.09R≈Moira 0.10R）：内带刻度+宿名+外带刻度三段由 renderStellarTicks/Ring
// 用计算半径(20%/60%/20%)切分，故 r(5)=0.57 现仅作几何参考、不再单独绘环（照抄 Moira r4~r7 宿区结构）。
const PICK_RING_POS = [0.19, 0.31, 0.37, 0.43, 0.51, 0.54, 0.60, 0.68, 0.71, 0.77, 0.92, 0.95, 1.0];
const PICK_RING_DRAW_TYPE = [1, 0, 0, 0, 1, -10, 1, 1, -10, 2, 0, 1, -10];
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
// 择日静盘星集=十一曜+升(Asc)+顶(MC)(用户钦定升/顶必显)
const PICK_BIRTH_DEFS = [
	{id: AstroConst.SUN, label: '日'},
	{id: AstroConst.MOON, label: '月'},
	{id: AstroConst.VENUS, label: '金'},
	{id: AstroConst.JUPITER, label: '木'},
	{id: AstroConst.MERCURY, label: '水'},
	{id: AstroConst.MARS, label: '火'},
	{id: AstroConst.SATURN, label: '土'},
	{id: AstroConst.SOUTH_NODE, label: '计'},
	{id: AstroConst.NORTH_NODE, label: '罗'},
	{id: AstroConst.PURPLE_CLOUDS, label: '炁'},
	{id: AstroConst.DARKMOON, label: '孛'},
	// 天海冥:与主盘 PLANET_DEFS 同步加入,天星择日盘也画(用户钦定「所有中间盘都要接入」)。
	{id: AstroConst.URANUS, label: '天'},
	{id: AstroConst.NEPTUNE, label: '海'},
	{id: AstroConst.PLUTO, label: '冥'},
	{id: AstroConst.ASC, label: '升'},
	{id: AstroConst.MC, label: '顶'},
];
const MOUNTAINS = ['子', '癸', '丑', '艮', '寅', '甲', '卯', '乙', '辰', '巽', '巳', '丙', '午', '丁', '未', '坤', '申', '庚', '酉', '辛', '戌', '乾', '亥', '壬'];
const INNER_PAIR = ['土子', '土丑', '木寅', '火卯', '金辰', '水巳', '日午', '月未', '水申', '金酉', '火戌', '木亥'];
const HOUSE_LABEL = ['命宫', '相貌', '福德', '官禄', '迁移', '疾厄', '夫妻', '奴仆', '男女', '田宅', '兄弟', '财帛'];
const HOUSE_NUMBERS = ['1', '12', '11', '10', '9', '8', '7', '6', '5', '4', '3', '2'];

// 三套布局(pick/compass/fixstar)按左栏开关切换;render 起始刷新,模块级供全部 helper 读。
let ACTIVE_PICK = PICK_LAYOUTS.pick;

function r(idx){
	const pos = ACTIVE_PICK.ringPos[idx];
	return (pos !== undefined ? pos : PICK_RING_POS[idx] || 1) * R;
}

// 语义槽查询(带名→[内界,外界]);布局无此带时返回 null 供门控。
function psPair(name){
	return ACTIVE_PICK.slots[name] || null;
}
function ps(name, side){
	const pair = psPair(name);
	return pair ? r(pair[side]) : 0;
}

function pickThetaFromDegree(degree){
	return 90 + Number(degree || 0);
}

// 择日盘全盘统一线宽 = 最外圈圆的粗细(moira-ring-major 1.15):
// 十个可见圆 + 全部刻度 + 全部分割线一律用它(用户钦定;标记类除外:座山箭头/红标/mark 条)。
const UNI_W = 1.15;

// 静盘两套角函数,语义严格区分:
// 1) staticTheta(支序几何角,输入=支序×30,子=0):支扇区边线/支名/虚实角标/神煞环/整宫宫名锚。
//    子宫中心正下、午宫中心正上,支序增=顺时针(与罗盘方位序一致,山环/度环同向)。
// 2) eclipticTheta(黄经角,输入=黄道经度):静盘行星/28宿/上升红标/西占宫头/宿环刻度。
//    七政镜像「白羊=戌、双鱼=亥…」,黄经增=盘面逆时针(占星恒逆时针增长);
//    白羊 0° 锚在戌扇区顺时针端边(theta=45),theta = 45 − lon。
//    与主盘 moiraThetaFromDegree(30−lon)同向,仅整体多转 15°(支中心对正下,主盘支边对正下)。
const STATIC_ROT = -15;
function staticTheta(degree){
	return pickThetaFromDegree(Number(degree || 0) + STATIC_ROT);
}
function eclipticTheta(lon){
	return 45 - Number(lon || 0);
}

// 真向心文字:字头恒指圆心(rotate = theta − 90,顶部自然倒置)。
// 旧 tangentRotate+180 因 ±90 归正分支在各象限姿态不一(下半盘字头朝外),已废弃。
function inwardRingText(text, radius, theta, opt = {}){
	const p = point(radius, theta);
	return (
		<text x={p.x} y={p.y} fill={opt.color || BLACK} fontSize={opt.size || 18} fontWeight={opt.weight || 600} textAnchor="middle" dominantBaseline="central" transform={`rotate(${theta + 90} ${p.x} ${p.y})`}>{text}</text>
	);
}

// 多字沿圆弧分开排布(各字正立):字距按半径换算成弧角;
// 正立字的视觉左右随上下半圆翻转(下半圆 theta 大=左),保证顺读方向恒从左到右。
function arcUprightText(text, radius, centerTheta, opt = {}){
	const chars = String(text || '').split('');
	const n = chars.length;
	if(!n){ return null; }
	const size = opt.size || 19;
	const stepDeg = (size * (opt.spacing || 1.15)) / Math.max(1, radius) * 180 / Math.PI;
	const dir = Math.sin(centerTheta * Math.PI / 180) > 0 ? -1 : 1;
	return chars.map((ch, k)=>{
		const t = centerTheta + dir * (k - (n - 1) / 2) * stepDeg;
		const p = point(radius, t);
		return (
			<text key={`auc-${k}`} x={p.x} y={p.y} fill={opt.color || BLACK} fontSize={size} fontWeight={opt.weight || 400} textAnchor="middle" dominantBaseline="central">{ch}</text>
		);
	});
}

function tangentRotate(theta){
	let rotate = theta + 90;
	if(rotate > 90 || rotate < -90){
		rotate += 180;
	}
	return rotate;
}

function sectorCenter(index, parts){
	return (index + 0.5) * (360 / parts);
}

// 命宫所在地支扇区(BRANCHES 子=0..亥=11)。
// 七政「地支↔黄道星座」镜像:地支扇区序 = (10 - 黄道星座序 + 12) % 12(白羊=戌、水瓶=子,与 DIGNITY_TABLE 同源)。
// 命度法非「占星上升」用命主度 LifeMasterDeg74 的黄道经度;占星上升用上升点经度(与右栏命度星座口径一致,非 RA)。
function lifeSignIndex(chart, fields){
	const objs = (chart && chart.objects) || [];
	const find = (id)=>objs.find((o)=>o && o.id === id);
	const mode = fields && fields.guolaoLifeMode && fields.guolaoLifeMode.value;
	const useAsc = !mode || mode === 'asc';
	const obj = useAsc ? find(AstroConst.ASC) : (find(AstroConst.LIFEMASTERDEG74) || find(AstroConst.ASC));
	if(!obj){ return 0; }
	const lon = Number(obj.lon);
	if(!Number.isFinite(lon)){ return 0; }
	return Math.floor((((lon % 360) + 360) % 360) / 30) % 12;
}

function lifeSectorIndex(chart, fields){
	const signIdx = lifeSignIndex(chart, fields);
	return (10 - signIdx + 12) % 12;
}

function pickPlanetConnectorLine(markTheta, labelTheta, inner, outer, dir, opt = {}){
	const span = Math.max(1, outer - inner);
	const length = Math.max(7, Math.min(14, opt.length || span * 0.22));
	const startRadius = dir >= 0 ? outer : inner;
	const endRadius = dir >= 0 ? outer - length : inner + length;
	const a = point(startRadius, markTheta);
	const b = point(endRadius, labelTheta);
	return (
		<line
			x1={a.x}
			y1={a.y}
			x2={b.x}
			y2={b.y}
			stroke={opt.color || BLACK}
			strokeWidth={opt.width || 1}
			opacity={opt.opacity === undefined ? 1 : opt.opacity}
		/>
	);
}

function listText(items, empty = '无'){
	const list = (items || []).filter(Boolean);
	return list.length ? list.join('、') : empty;
}

function yearSignRowForZi(rules, zi){
	const rows = rules && rules.natalYearStars ? rules.natalYearStars : [];
	return rows.find((row)=>row && row.zi === zi) || null;
}

class GuoLaoMoiraPickWheel extends Component{
	constructor(props){
		super(props);
		this.state = {
			tooltip: null,
			containerSide: 0,
		};
		this.containerRef = React.createRef();
		this.resizeObserver = null;
		this.measureContainer = this.measureContainer.bind(this);
		this.showTooltip = this.showTooltip.bind(this);
		this.moveTooltip = this.moveTooltip.bind(this);
		this.hideTooltip = this.hideTooltip.bind(this);
	}

	componentDidMount(){
		this.measureContainer();
		if(typeof ResizeObserver !== 'undefined' && this.containerRef.current){
			this.resizeObserver = new ResizeObserver(this.measureContainer);
			this.resizeObserver.observe(this.containerRef.current);
		}
		if(typeof window !== 'undefined'){
			window.addEventListener('resize', this.measureContainer);
		}
	}

	componentDidUpdate(prevProps){
		if(prevProps.height !== this.props.height){
			this.measureContainer();
		}
	}

	componentWillUnmount(){
		if(this.resizeObserver){
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}
		if(typeof window !== 'undefined'){
			window.removeEventListener('resize', this.measureContainer);
		}
	}

	measureContainer(){
		const node = this.containerRef.current;
		if(!node){
			return;
		}
		const rect = node.getBoundingClientRect();
		const fallbackHeight = Number(this.props.height) || 740;
		const availableWidth = rect.width || node.clientWidth || fallbackHeight;
		const availableHeight = rect.height || node.clientHeight || fallbackHeight;
		const nextSide = Math.max(280, Math.floor(Math.min(availableWidth, availableHeight)));
		if(Number.isFinite(nextSide) && nextSide !== this.state.containerSide){
			this.setState({containerSide: nextSide});
		}
	}

	tooltipPoint(evt){
		const maxX = typeof window !== 'undefined' ? Math.max(12, window.innerWidth - 440) : evt.clientX + 14;
		const maxY = typeof window !== 'undefined' ? Math.max(12, window.innerHeight - 220) : evt.clientY + 16;
		return {
			x: Math.min(evt.clientX + 14, maxX),
			y: Math.min(evt.clientY + 16, maxY),
		};
	}

	showTooltip(text, evt){
		if(!text){
			return;
		}
		this.setState({tooltip: {...this.tooltipPoint(evt), text}});
	}

	moveTooltip(evt){
		if(!this.state.tooltip){
			return;
		}
		this.setState({tooltip: {...this.state.tooltip, ...this.tooltipPoint(evt)}});
	}

	hideTooltip(){
		if(this.state.tooltip){
			this.setState({tooltip: null});
		}
	}

	tooltipHandlers(text){
		return {
			onMouseEnter: (evt)=>this.showTooltip(text, evt),
			onMouseOver: (evt)=>this.showTooltip(text, evt),
			onMouseMove: this.moveTooltip,
			onMouseLeave: this.hideTooltip,
			onMouseOut: this.hideTooltip,
			onPointerEnter: (evt)=>this.showTooltip(text, evt),
			onPointerMove: this.moveTooltip,
			onPointerLeave: this.hideTooltip,
			onClick: (evt)=>this.showTooltip(text, evt),
		};
	}

	renderRings(){
		return (
			<g className="moira-rings">
				{PICK_RING_POS.map((pos, idx)=>PICK_RING_DRAW_TYPE[idx] <= -10 ? null : (
					<circle
						key={`pick-ring-${idx}`}
						r={pos * R}
						className={PICK_RING_DRAW_TYPE[idx] === 1 || PICK_RING_DRAW_TYPE[idx] === 2 || idx === 0 || idx === 11 ? 'moira-ring-major' : 'moira-ring-minor'}
						style={{strokeWidth: UNI_W}}
					/>
				))}
			</g>
		);
	}

	renderDegreeTicks(){
		const nodes = [];
		for(let degree = 0; degree < 360; degree++){
			const theta = pickThetaFromDegree(degree);
			const major = degree % 15 === 0;
			const mid = degree % 5 === 0;
			const inner = major ? ps('degreeTick', 0) : (mid ? ps('degreeTick', 0) + (ps('degreeTick', 1) - ps('degreeTick', 0)) / 3 : ps('degreeTick', 0) + (ps('degreeTick', 1) - ps('degreeTick', 0)) * 2 / 3);
			nodes.push(
				<g key={`pick-degree-${degree}`}>
					{radialLine(theta, inner, ps('degreeTick', 1), {
						color: BLACK,
						width: UNI_W,
					})}
					{major ? this.renderDegreeLabel(degree, theta) : null}
				</g>
			);
		}
		return <g className="moira-degree-ticks moira-pick-degree-ticks">{nodes}</g>;
	}

	renderDegreeLabel(degree, theta){
		// 度数显示切换:mountain=0-360 罗盘度数字;zodiac=十二支(支中心=30k,子居 0°=正下)。
		const ele = this.props.election || {};
		if(ele.degreeDisplay === 'zodiac'){
			if(degree % 30 !== 0){
				return null;
			}
			const zhi = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'][degree / 30];
			const pz = point(ps('degreeTick', 1) + 16, theta);
			return (
				<text x={pz.x} y={pz.y} fill={BLACK} fontSize={20} fontWeight={600} textAnchor="middle" dominantBaseline="central">{zhi}</text>
			);
		}
		const p = point(ps('degreeTick', 1) + 16, theta);
		return (
			<text
				x={p.x}
				y={p.y}
				fill={BLACK}
				fontSize={degree % 90 === 0 ? 20 : 16}
				fontWeight={degree % 90 === 0 ? 600 : 400}
				textAnchor="middle"
				dominantBaseline="central"
				transform={`rotate(${tangentRotate(theta) + 180} ${p.x} ${p.y})`}
			>
				{degree}
			</text>
		);
	}

	renderSectorLines(){
		const nodes = [];
		for(let ringIdx = 1; ringIdx < PICK_RING_DRAW_TYPE.length; ringIdx++){
			const drawType = PICK_RING_DRAW_TYPE[ringIdx];
			// 西占不等宫带([r(1),r(2)],ringIdx=2)激活时不画整宫扇区线——该带只允许不等宫界线(renderWesternHouses)。
			const skipWholeSign = ringIdx === 2 && this.props.electionData && this.props.electionData.housesBySystem;
			if(drawType <= 0 && drawType > -10 && !skipWholeSign){
				for(let i = 0; i < 12; i++){
					nodes.push(
						<g key={`pick-sector-${ringIdx}-${i}`}>
							{radialLine(staticTheta(i * 30), r(ringIdx - 1), r(ringIdx), {color: BLACK, width: UNI_W})}
						</g>
					);
				}
			}
		}
		return <g className="moira-main-divider">{nodes}</g>;
	}

	renderDegreeMarkBand(inner, outer, keyPrefix, opt = {}){
		const nodes = [];
		const delta = (outer - inner) / 3;
		for(let degree = 0; degree < 360; degree++){
			const theta = eclipticTheta(degree);
			const major = degree % 30 === 0;
			const mid = degree % 5 === 0;
			const anchorInner = opt.anchor === 'inner';
			const start = anchorInner ? inner : (major ? inner : (mid ? inner + delta : inner + 2 * delta));
			const end = anchorInner ? (major ? outer : (mid ? inner + 2 * delta : inner + delta)) : outer;
			const color = opt.mutedMajor ? BLACK : (major ? RED : BLACK);
			nodes.push(
				<g key={`${keyPrefix}-${degree}`}>
					{radialLine(theta, start, end, {
						color,
						width: UNI_W,
						// 刻度纯黑不透明(用户钦定「刻度是黑色不是灰色」)。
						opacity: 1,
					})}
				</g>
			);
		}
		return nodes;
	}

	renderStaticCore(){
		const nodes = [];
		const root = this.props.rootValue || {};
		const chart = this.props.value || root.chart || {};
		const ziGods = getZiGods(root, chart);
		// 后天人事宫位(命宫=1 宫起点)锚定内圈黄道静盘的上升点(与圆9-10 红标同一 ASC 对象,同源不漂);
		// 全黄经体系(照 Moira):取 lon;星座序→支扇区序走七政镜像 (10−s)%12(白羊=戌);
		// 静盘无 ASC 时回退主盘命度。
		const ascObjForHouses = (chart.objects || []).find((o)=>o && o.id === AstroConst.ASC);
		const ascLonForHouses = ascObjForHouses
			? Number(moiraIsEclipticDisplayChart(chart) ? (ascObjForHouses.lon !== undefined && ascObjForHouses.lon !== null ? ascObjForHouses.lon : ascObjForHouses.ra) : (ascObjForHouses.ra !== undefined && ascObjForHouses.ra !== null ? ascObjForHouses.ra : ascObjForHouses.lon))
			: null;
		const lifeSector = Number.isFinite(ascLonForHouses)
			? (10 - Math.floor((((ascLonForHouses % 360) + 360) % 360) / 30) + 12) % 12
			: lifeSectorIndex(chart, this.props.fields);
			for(let i = 0; i < 12; i++){
				const start = i * 30;
				const end = (i + 1) * 30;
				const theta = staticTheta(sectorCenter(i, 12));
				const houseNameRadius = (r(2) + r(3)) / 2;
				const houseNumberRadius = (r(1) + r(2)) / 2;
				// HOUSE_LABEL/HOUSE_NUMBERS 是按物理顺时针槽预反排的表(命宫,相貌,福德…),
				// 配 slot=i−lifeSector 恰得「宫序沿黄经增=逆时针」;勿再反向(会双重反转成顺时针)。
				const houseSlot = ((i - lifeSector) % 12 + 12) % 12;
				const houseLabel = HOUSE_LABEL[houseSlot];
				const houseNumber = HOUSE_NUMBERS[houseSlot];
				const _base = moiraGodsFromRuleHits(this.props.moiraRules, BRANCHES[i], 'birth');
				const _ll = moiraLongLifeCharFor(this.props.moiraRules, BRANCHES[i], 'birth');
				const gods = (_ll ? [_ll] : []).concat(this.filterHiddenGods(orderedGods(_base !== null ? _base : collectGods(ziGods, BRANCHES[i]), BIRTH_GOD_ORDER)));
				const yearRow = yearSignRowForZi(this.props.moiraRules, BRANCHES[i]);
				const wsRow = moiraWeakSolidRowForZi(this.props.moiraRules, BRANCHES[i]);
				const wsText = wsRow ? [wsRow.weak ? `虚${(wsRow.weakPillars || []).join('') || ''}` : '', wsRow.solid ? `实${(wsRow.solidPillars || []).join('') || ''}` : ''].filter(Boolean).join('、') : '';
				const tip = [
					`${BRANCHES[i]}：${houseLabel}；同经：${INNER_PAIR[i]}`,
					wsText ? `虚实：${wsText}` : '',
					yearRow ? `命曜：${yearRow.star || '—'} ${yearRow.shortName || ''}${yearRow.quality ? `；${yearRow.quality}` : ''}` : '',
					gods.length ? `神煞：${listText(gods)}` : '',
				].filter(Boolean).join('\n');
			nodes.push(
				<g key={`pick-static-${i}`}>
					<path
						className="moira-hover-zone"
						d={annularSectorPath(r(0), r(4), staticTheta(start), staticTheta(end))}
						{...this.tooltipHandlers(tip)}
					>
					</path>
						{(this.props.electionData && this.props.electionData.housesBySystem) ? (
							<g>
								{radialLine(staticTheta(start), r(0), r(1), {color: BLACK, width: UNI_W})}
								{radialLine(staticTheta(start), r(2), r(3), {color: BLACK, width: UNI_W})}
							</g>
						) : radialLine(staticTheta(start), r(0), r(3), {color: BLACK, width: UNI_W})}
							{pairedRadialText(INNER_PAIR[i], theta, r(0), r(1), {size: 22, color: BLACK, weight: 600})}
						{this.renderWeakSolidCorner(moiraWeakSolidRowForZi(this.props.moiraRules, BRANCHES[i]), start, end)}
							{(this.props.electionData && this.props.electionData.housesBySystem) ? null : inwardRingText(houseNumber, houseNumberRadius, theta, {size: 19, color: GREEN, weight: 700})}
							{arcUprightText(houseLabel, houseNameRadius, theta, {size: 19, color: GREEN, weight: 700})}
						</g>
				);
			}
			return (
			<g className="moira-static-twelve moira-pick-static-core">
				{nodes}
				{(()=>{
					// 上升点「升」度数红标:画在圆9-10 带([r(10),r(11)]),静盘系。
					// 全黄经体系(照 Moira):取 lon(真黄经),与静盘行星/宿界/西占宫头同口径。
					const ascObj = (chart.objects || []).find((o)=>o && o.id === AstroConst.ASC);
					const ascLon = ascObj ? Number(moiraIsEclipticDisplayChart(chart) ? (ascObj.lon !== undefined && ascObj.lon !== null ? ascObj.lon : ascObj.ra) : (ascObj.ra !== undefined && ascObj.ra !== null ? ascObj.ra : ascObj.lon)) : null;
					if(!Number.isFinite(ascLon)){
						return null;
					}
					const ascP = point((r(10) + r(11)) / 2, eclipticTheta(ascLon));
					return (
						<g {...this.tooltipHandlers(`上升点：${moiraZhiDegText(ascLon)}（1 宫头）`)}>
							<circle className="moira-hover-zone" cx={ascP.x} cy={ascP.y} r={16} />
							{radialLine(eclipticTheta(ascLon), r(10), r(11), {color: RED, width: 2.2})}
						</g>
					);
				})()}
				<circle r={r(0)} fill={MOIRA_BG} stroke={BLACK} strokeWidth="1" />
			</g>
		);
	}

	renderMountainRings(){
		// 圆7-圆8 二十四山带。圆7 外侧刻度三档(恒随山盘偏转):
		//   最长=先天十二宫分割线(罗盘支界 15°+30k,通高)/中=其余每 5°(0.62 高)/短=每 1°(1/3 高)。
		// 山界=中心±7.5°(子山中心恒在罗盘 0°,即 i*15;此前用扇区中点致整环偏半山,已纠正),
		// 山字恒居两界正中,随天/地/人盘同步偏转,不与分割线重叠;山五行配色两表。
		const ele = this.props.election || {};
		const wuxingMode = ele.wuxing === 'combo' ? 'combo' : 'main';
		const plateOff = PLATE_OFFSET[ele.plate] !== undefined ? PLATE_OFFSET[ele.plate] : 0;
		const rot = this.electionRotDeg();   // 整盘磁偏旋转:24山环随动盘一同偏转(子正在下关时生效)
		const tickBase = psPair('mountainTick') ? ps('mountainTick', 0) : ps('mountain', 0);
		const tickTop = psPair('mountainTick') ? ps('mountainTick', 1) : ps('mountain', 0) + 14;
		const charInner = ps('mountain', 0);
		const charOuter = ps('mountain', 1);
		const tickSpan = tickTop - tickBase;
		const nodes = [];
		for(let d = 0; d < 360; d++){
			// 刻度带随磁偏整盘偏转(rot),但不随天地人盘偏移;山字与山界另随天地人偏转。
			const t = pickThetaFromDegree(d + rot);
			const isHouseLine = d % 30 === 15;
			const is5 = d % 5 === 0;
			const end = isHouseLine ? tickTop : (is5 ? tickBase + tickSpan * 0.62 : tickBase + tickSpan / 3);
			nodes.push(<g key={`pick-mtick-${d}`}>{radialLine(t, tickBase, end, {
				color: BLACK,
				width: UNI_W,
				opacity: 1,
			})}</g>);
		}
		const plateName = ele.plate === 'tian' ? '天盘' : (ele.plate === 'ren' ? '人盘' : '地盘');
		for(let i = 0; i < 24; i++){
			const center = i * 15 + plateOff;
			const theta = pickThetaFromDegree(center + rot);
			const edgeTheta = pickThetaFromDegree(center - 7.5 + rot);
			const lo = ((center - 7.5) % 360 + 360) % 360;
			const hi = ((center + 7.5) % 360 + 360) % 360;
			nodes.push(<g key={`pick-mline-${i}`}>{radialLine(edgeTheta, charInner, charOuter, {color: BLACK, width: UNI_W})}</g>);
			nodes.push(
				<g key={`mountain-${i}`} {...this.tooltipHandlers(`${MOUNTAINS[i]}山（${plateName}）：罗盘 ${lo.toFixed(1)}° ~ ${hi.toFixed(1)}°`)}>
					<path
						className="moira-hover-zone"
						d={annularSectorPath(charInner, charOuter, pickThetaFromDegree(center - 7.5 + rot), pickThetaFromDegree(center + 7.5 + rot))}
					>
					</path>
					{horizontalRingText(MOUNTAINS[i], (charInner + charOuter) / 2, theta, {size: 23, color: shanColor(MOUNTAINS[i], wuxingMode), weight: 500, upright: true})}
				</g>
			);
		}
		return <g className="moira-pick-mountain-rings">{nodes}</g>;
	}

	// 圆2-3:西洋占星不等宫制宫位(按左栏分宫制 cusps 画界线+宫号,大小不等);
	// 圆4-5:静盘带内加分宫制虚线(同一 cusps)。无 election 数据时回退整宫(原宫号保留)。
	// 虚实宫标记:放支扇形外侧两个角落(贴圆2 内侧)——虚宫「−」在起始角、实宫「+」在结束角。
	renderWeakSolidCorner(row, startDeg, endDeg){
		if(!row || (!row.weak && !row.solid)){
			return null;
		}
		const radius = r(1) - 13;
		const nodes = [];
		if(row.weak){
			const p = point(radius, staticTheta(startDeg + 4.5));
			nodes.push(
				<text key="ws-weak" x={p.x} y={p.y} fill={RED} fontSize={16} fontWeight={700} textAnchor="middle" dominantBaseline="central">−</text>
			);
		}
		if(row.solid){
			const p = point(radius, staticTheta(endDeg - 4.5));
			nodes.push(
				<text key="ws-solid" x={p.x} y={p.y} fill={GREEN} fontSize={16} fontWeight={700} textAnchor="middle" dominantBaseline="central">+</text>
			);
		}
		return <g className="moira-pick-weak-solid">{nodes}</g>;
	}

	renderWesternHouses(){
		const data = this.props.electionData || {};
		const ele = this.props.election || {};
		// 优先静盘时刻宫位(staticHousesBySystem,与内盘上升同时刻同源——1 宫头严格=静盘 Asc);
		// 端点未回静盘套时回退动盘套(旧数据兼容)。
		const pool = data.staticHousesBySystem || data.housesBySystem;
		const cuspsRaw = pool ? (pool[ele.hsys] || pool.P || pool.A) : null;
		if(!cuspsRaw || cuspsRaw.length < 12){
			return null;
		}
		// 显示口径随黄仪/赤仪:黄仪=端点真黄经直用(1 宫头与上升红标天然同度,Moira 体系);
		// 赤仪=四轴锚定+象限内插(与主盘同一 mapCuspsToDisplay,1/10 宫头严格钉升/顶)。
		const root = this.props.rootValue || {};
		const chart = this.props.value || root.chart || {};
		const cusps = moiraMapCuspsToDisplay(cuspsRaw.map((c)=>Number(c)), chart);
		const nodes = [];
		for(let k = 0; k < 12; k++){
			const cur = Number(cusps[k]);
			let next = Number(cusps[(k + 1) % 12]);
			if(next <= cur){ next += 360; }
			const bTheta = eclipticTheta(cur);
			const mTheta = eclipticTheta(cur + (next - cur) / 2);
			const tip = [
				`第 ${k + 1} 宫（${hsysDisplayName(ele.hsys)} 分宫）`,
				`${moiraZhiDegText(cur)} ~ ${moiraZhiDegText(next % 360)}`,
				`宫宽 ${(next - cur).toFixed(1)}°`,
			].join('\n');
			nodes.push(
				<g key={`whouse-${k}`} {...this.tooltipHandlers(tip)}>
					<path
						className="moira-hover-zone"
						d={annularSectorPath(r(1), r(2), eclipticTheta(next), bTheta)}
					>
					</path>
					{radialLine(bTheta, r(1), r(2), {color: BLACK, width: UNI_W})}
					{radialLine(bTheta, r(3), r(4), {color: BLACK, width: UNI_W, dash: `${(r(4) - r(3)) / 17} ${(r(4) - r(3)) / 17}`})}
					{inwardRingText(String(k + 1), (r(1) + r(2)) / 2, mTheta, {size: 19, color: GREEN, weight: 700})}
				</g>
			);
		}
		return <g className="moira-pick-western-houses">{nodes}</g>;
	}

	renderStellarTicks(){
		// 二十八宿环：完全照抄 Moira 命盘轮结构 —— 一个由两个边界圆(r4 内圆 / r6 外圆)框住的圆环，
		// 里层外层各一条刻度带：内带 base 贴住 r(4) 向外伸、外带 base 贴住 r(6) 向内伸（刻度底端贴两圆）。
		// 中间留 60% 空带给宿名 + 红色宿界线（红线见 renderStellarRing，夹在两刻度带之间、不挨任一圆）。
		const inner = r(4);
		const outer = r(6);
		const band = outer - inner;
		const rA = inner + band * 0.2; // 内刻度带顶 / 宿名带底
		const rB = outer - band * 0.2; // 宿名带顶 / 外刻度带底
		// 圆5 外侧一条刻度带;圆6 内侧不画刻度(宿界红线贴圆6 内侧,见 renderStellarRing)。
		const nodes = [
			...this.renderDegreeMarkBand(inner, rA, 'pick-stellar-up', {mutedMajor: true, anchor: 'inner'}),
		];
		return <g className="moira-stellar-ticks">{nodes}</g>;
	}

	// 择日盘宿界:优先当前宿度制(chart.fixedStarSu28,与主盘/右栏同一真值源——用户钦定
	// 「宿随宿度制变化」;ra 字段=该制置宿度,displayCoord 保证与行星显示度同口径);
	// chart 缺失时回退择日端点 Moira 28 距星实时黄经(stellarLon)。
	pickStellarStars(chart){
		if(chart && Array.isArray(chart.fixedStarSu28) && chart.fixedStarSu28.length){
			const fx = buildFixedStars(chart);
			if(fx && fx.length === 28){
				return fx;
			}
		}
		const data = this.props.electionData || {};
		const sl = Array.isArray(data.stellarLon) && data.stellarLon.length === 28 ? data.stellarLon : null;
		if(sl){
			const stars = sl.map((item)=>({name: item.name, label: item.name, ra: Number(item.lon), lon: Number(item.lon)})).filter((i)=>Number.isFinite(i.ra));
			if(stars.length === 28){
				return stars;
			}
		}
		return buildFixedStars(chart);
	}

	// 宿名查询(当前宿度制宿界区间;deg 小于首界=环绕落末宿)。
	lonSuName(deg, chart){
		const stars = this.pickStellarStars(chart || ((this.props.value || (this.props.rootValue || {}).chart) || {}));
		if(!stars || !stars.length || !Number.isFinite(Number(deg))){
			return null;
		}
		const d = ((Number(deg) % 360) + 360) % 360;
		let hit = null;
		let maxStar = stars[0];
		stars.forEach((s)=>{
			const r = Number(s.ra);
			if(!Number.isFinite(r)){ return; }
			if(r <= d && (hit === null || r > Number(hit.ra))){ hit = s; }
			if(r > Number(maxStar.ra)){ maxStar = s; }
		});
		return (hit || maxStar) ? (hit || maxStar).name : null;
	}

	renderStellarRing(chart){
		const stars = this.pickStellarStars(chart);
		const useLonSu = stars !== null && Array.isArray(this.props.electionData && this.props.electionData.stellarLon) && this.props.electionData.stellarLon.length === 28;
		// 黄经宿界模式下,「本命落入」按行星黄经在宿界区间自算(赤道 relations 口径不再适用)。
		const relations = useLonSu ? null : buildStellarRelations(chart);
		const lonHits = useLonSu ? (()=>{
			const bucket = stars.map(()=>[]);
			((chart && chart.objects) || []).forEach((obj)=>{
				const def = PICK_BIRTH_DEFS.find((d)=>d.id === (obj && obj.id));
				const lonV = obj ? Number(obj.lon) : NaN;
				if(!def || !Number.isFinite(lonV)){
					return;
				}
				const d = ((lonV % 360) + 360) % 360;
				let idx = stars.length - 1;
				for(let i = 0; i < stars.length; i++){
					if(stars[i].ra <= d){ idx = i; } else { break; }
				}
				bucket[idx].push(def.label);
			});
			return bucket;
		})() : null;
		// 与 renderStellarTicks 同一套半径：宿名居中(两圆中点)，红色宿界线只画在中间空带 rA~rB，
		// 不挨内圆 r(4) 也不挨外圆 r(6)，与上下两条刻度带分离 —— 照抄 Moira 命盘轮 r(5)+1~r(6)-1 的做法。
		const inner = r(4);
		const outer = r(6);
		const band = outer - inner;
		const rA = inner + band * 0.2;
		const rB = outer - band * 0.2;
		const nodes = [];
		stars.forEach((cur, idx)=>{
			const nxt = stars[(idx + 1) % stars.length];
			let span = Number(nxt.ra) - Number(cur.ra);
			if(span <= 0){
				span += 360;
			}
			const edgeTheta = eclipticTheta(cur.ra);
			const centerTheta = eclipticTheta(Number(cur.ra) + span / 2);
			const rel = (relations && relations[idx]) || {};
			const p = point(inner + (outer - inner) * 0.62, centerTheta);
			const nd = (v)=>((Number(v) % 360) + 360) % 360;
			const curLon = Number.isFinite(Number(cur.lon)) ? Number(cur.lon) : Number(cur.ra);
			// 择日盘全黄经体系:宿界置黄道,赤经=lon 占位 → 按黄赤交角算真赤经(黄经≠赤经);赤仪源(ra≠lon)则直用真值。
			const eps = moiraObliquityDeg(chart);
			const chiJing = Math.abs(Number(cur.ra) - curLon) < 0.01 ? moiraEclEquConvertDeg(curLon, eps) : nd(cur.ra);
			const tip = [
				`${cur.label || cur.name}宿`,
				`黄经 ${nd(curLon).toFixed(2)}°`,
				`赤经 ${chiJing.toFixed(2)}°`,
				`宿距 ${span.toFixed(2)}°`,
				lonHits ? `本命落入：${listText(lonHits[idx])}` : `本命落入：${listText(rel.main)}`,
				lonHits ? '' : `本命同经：${listText(rel.same)}`,
			].filter(Boolean).join('\n');
			nodes.push(
				<g key={`pick-stellar-${idx}`}>
					<path
						className="moira-hover-zone"
						d={annularSectorPath(inner, outer, eclipticTheta(Number(cur.ra) + span), edgeTheta)}
						{...this.tooltipHandlers(tip)}
					>
					</path>
					{radialLine(edgeTheta, inner + band / 3, outer - 1, {color: RED, width: UNI_W})}
					{verticalText(cur.name || cur.label, p.x, p.y, {size: 23, maxPerCol: 1, color: BLACK, weight: 600})}
				</g>
			);
		});
		return <g className="moira-stellar-layer">{nodes}</g>;
	}

	renderPlanetRing(chart, opt){
		// 静盘行星显示口径随黄仪/赤仪(displayCoord):黄仪吃 lon(=Moira 全黄经体系),
		// 赤仪吃 ra;宿名按当前宿度制宿界重查(与显示度同口径,displayCoord 保证同体系)。
		const preferLon = moiraIsEclipticDisplayChart(chart);
		const suStars = this.pickStellarStars(chart);
		const placements = planetPlacements(chart, opt.inner, opt.outer, opt.dir, opt.size, preferLon, opt.defs);
		const nodes = placements.map((item, idx)=>{
			const markTheta = eclipticTheta(item.degree);
			const labelTheta = eclipticTheta(item.labelDegree);
			const p = point(item.radius, labelTheta);
			const lonSu = this.lonSuName(item.degree, chart);
			const tipItem = lonSu ? {...item, obj: {...item.obj, su28: lonSu}} : item;
			const tip = objectTooltip(tipItem, opt.kind, this.props.moiraRules, suStars);
			return (
				<g key={`pick-${opt.kind}-planet-${item.id}-${idx}`}>
					<circle
						className="moira-hover-zone"
						cx={p.x}
						cy={p.y}
						r={Math.max(20, opt.size * 0.82)}
						{...this.tooltipHandlers(tip)}
					>
					</circle>
						{pickPlanetConnectorLine(markTheta, labelTheta, opt.markInner, opt.markOuter, opt.lineDir || 1, {color: opt.markColor, width: 1.05})}
					{verticalText(item.label, p.x, p.y, {
						size: opt.size,
						maxPerCol: 1,
						color: planetColor(item.obj, opt.color),
						weight: 600,
					})}
				</g>
			);
		});
		return <g className={`moira-planet-layer moira-pick-planet-layer-${opt.kind}`}>{nodes}</g>;
	}

	// 星曜显示开关(与主 Moira 盘同源 hiddenPlanets 标签名单):本命环 + 择日动盘环都过滤。
	// 病根:天星择日盘原先完全不吃 hiddenPlanets,勾选/取消星曜无反应——此为过滤真值源。
	hiddenPlanetInfo(){
		const labels = new Set(this.props.hiddenPlanets || []);
		const ids = new Set(PICK_BIRTH_DEFS.filter((d)=>labels.has(d.label)).map((d)=>d.id));
		return { labels, ids, any: labels.size > 0 };
	}

	renderPlanetLayers(birthChart, transitChart){
		const hp = this.hiddenPlanetInfo();
		const birthDefs = hp.any ? PICK_BIRTH_DEFS.filter((d)=>!hp.labels.has(d.label)) : PICK_BIRTH_DEFS;
		return (
				<g>
					{this.renderPlanetRing(birthChart, {
						kind: 'birth',
						defs: birthDefs,
						inner: r(3) + 7,
						outer: r(4) - 8,
						dir: -1,
						size: 25,
						color: GREEN,
							markColor: BLACK,
							markInner: r(3),
							markOuter: r(4),
							lineDir: 1,
						})}
				</g>
		);
	}

	// 神煞筛选联动(与主 Moira 盘同源;择日盘两处神煞环均为本命性质 → 吃本命名单)。
	filterHiddenGods(gods){
		const hidden = this.props.hiddenGodsBirth && this.props.hiddenGodsBirth.length ? new Set(this.props.hiddenGodsBirth) : null;
		return hidden ? gods.filter((g)=>!hidden.has(g)) : gods;
	}

	renderGodRing(root, chart){
		if(!psPair('gods')){
			return null;
		}
		const ziGods = getZiGods(root, chart);
		const nodes = [];
		for(let i = 0; i < 12; i++){
			const start = i * 30;
			const end = (i + 1) * 30;
			const theta = staticTheta(sectorCenter(i, 12));
			const _base = moiraGodsFromRuleHits(this.props.moiraRules, BRANCHES[i], 'birth');
				const _ll = moiraLongLifeCharFor(this.props.moiraRules, BRANCHES[i], 'birth');
				const gods = (_ll ? [_ll] : []).concat(this.filterHiddenGods(orderedGods(_base !== null ? _base : collectGods(ziGods, BRANCHES[i]), BIRTH_GOD_ORDER)));
			const godSize = Math.min(25, godTextSize(gods.length));
			const godSteps = godColumnStep(gods.length);
			const palaceTip = `${BRANCHES[i]} · 天星择日神煞\n${gods.length ? gods.join('，') : '无'}`;
			const rawStep = gods.length <= 1 ? 0 : godSteps.arc / (gods.length - 1);
			const step = gods.length <= 1 ? 0 : Math.min(godSteps.maxStep, rawStep);
			const colStart = theta + step * (gods.length - 1) / 2;
			const half = step > 0 ? step / 2 : 3;
			nodes.push(
				<g key={`pick-god-${i}`}>
					<path
						className="moira-hover-zone"
						d={annularSectorPath(ps('gods', 0), ps('gods', 1), staticTheta(start), staticTheta(end))}
						{...this.tooltipHandlers(palaceTip)}
					>
					</path>
					{gods.map((god, idx)=>{
						const gtheta = gods.length <= 1 ? theta : (colStart - idx * step);
						return (
							<g key={`pick-god-${i}-${idx}`}>
								<path
									className="moira-hover-zone"
									d={annularSectorPath(ps('gods', 0), ps('gods', 1), gtheta - half, gtheta + half)}
									{...this.tooltipHandlers(`择日·${guolaoShenShaTip(god)}`)}
								>
								</path>
								{radialStackText(god, gtheta, ps('gods', 0) + 10, ps('gods', 1) - 12, {
									size: godSize,
									color: GREEN,
									weight: 600,
								})}
							</g>
						);
					})}
				</g>
			);
		}
		return <g className="moira-star-table-layer moira-pick-god-layer">{nodes}</g>;
	}

	renderTooltip(){
		const tooltip = this.state.tooltip;
		if(!tooltip){
			return null;
		}
		// portal 挂 body:同 GuoLaoMoiraWheel(中栏 container-type 收纳陷阱),择日轮共用同一 class 同一根因。
		if(typeof document === 'undefined' || !document.body){
			return null;
		}
		return createPortal(
			<div
				className="horosa-guolao-moira-tooltip"
				style={{left: tooltip.x, top: tooltip.y}}
			>
				{tooltip.text}
			</div>,
			document.body
		);
	}

	/* ── 天星择日动盘层(照 Moira PICK_MODE:动盘元素叠画在原生轮上,不外挂环) ── */

	// 整盘磁偏旋转(用户钦定):子正在下 开→0;关→−磁偏。不论子正=正北/磁北,整盘罗盘层(24山环+动盘星
	// +座山+罗盘宿)一同按磁偏偏转——磁北转到正下、真北随之偏离正下;外圈方位度环恒为固定参照不转。
	electionRotDeg(){
		const ele = this.props.election || {};
		return ele.alignNorth === false ? -(Number(this.props.declination) || 0) : 0;
	}

	// 动盘显示方位统一入口:罗盘方位 → 套磁偏(子正=磁北时定星落山) → 盘面极角(子下卯左) → 整盘磁偏旋转。
	electionTheta(azCompass){
		const ele = this.props.election || {};
		const decl = Number(this.props.declination) || 0;
		const shown = applyDeclination(azCompass, ele.ziZheng === 'magnetic' ? 'magnetic' : 'true', decl);
		return azTheta(shown, this.electionRotDeg());
	}

	// 动盘行星:按方位角(或黄道动盘投影)放进 24 山带(r7~r9,同 Moira 绿色动盘字),
	// 相邻星简单径向错层避让;逆行 MAGENTA,高度正负号上标(照 Moira 双列表 +/− 记号)。
	renderElectionPlanets(){
		// 照 Moira now_sign_ring 段(pick_now_sign_ring=7):动盘行星恒画 [r(6), r(7)) 带内单圈;
		// 密集处按 computeSignShift 语义环向推挤,真实方位由棕色引线(now_degree_mk 0x804040)自带外界指向字;
		// 字色=Moira 动盘色(地平上 0x000080 深蓝 / 地平下 0xff0000 红,chart_now_ring_speed_color 前两档)。
		const data = this.props.electionData || {};
		const ele = this.props.election || {};
		const planets = Array.isArray(data.planets) ? data.planets : [];
		const quick = ele.dynMode === 'quick';
		const cusps = quick && data.housesBySystem
			? (data.housesBySystem[ele.hsys] || data.housesBySystem.A || null)
			: null;
		const hp = this.hiddenPlanetInfo();
		const items = planets.map((pl)=>{
			const az = quick
				? quickWheelAz(pl.lonTropical, cusps || Array.from({length: 12}, (_, i)=>i * 30))
				: pl.azimuth;
			if(az === null || az === undefined){
				return null;
			}
			return { ...pl, dynAz: ((Number(az) % 360) + 360) % 360 };
		}).filter(Boolean)
			// 星曜显示开关:择日动盘同吃 hiddenPlanets(勾选/取消即时增删,不需重算)。
			.filter((pl)=>!hp.any || (!hp.ids.has(pl.id) && !hp.labels.has(pl.label)));
		if(!items.length){
			return null;
		}
		const bandInner = ps('nowPlanets', 0);
		const bandOuter = ps('nowPlanets', 1);
		const radius = (bandInner + bandOuter) / 2;
		// 最小角距=字宽(30px 字+上标余量)在带中半径的弧对应角
		const minGap = (34 / (2 * Math.PI * radius)) * 360;
		const shifted = resolveRingShifts(items.map((pl)=>pl.dynAz), minGap);
		const nodes = [];
		items.forEach((pl, i)=>{
			const trueTheta = this.electionTheta(pl.dynAz);
			const drawTheta = this.electionTheta(shifted[i]);
			const p = point(radius, drawTheta);
			const above = Number(pl.altitudeTrue) >= 0;
			const color = above ? 'var(--moira-ele-now, #000080)' : 'var(--moira-ele-below, #cc0000)';
			const altSign = above ? '+' : '−';
			const plate = PLATE_OFFSET[ele.plate] !== undefined ? ele.plate : 'di';
			const shownAz = applyDeclination(pl.dynAz, ele.ziZheng === 'magnetic' ? 'magnetic' : 'true', Number(this.props.declination) || 0);
			const mp = mountainPosition(shownAz, plate);
			const lineStart = point(bandOuter - 2, trueTheta);
			const lineEnd = point(radius + 18, drawTheta);
			const eleTip = [
				`${pl.label}${pl.retrograde ? '（逆行）' : ''}`,
				`黄经 ${moiraZhiDegText(pl.lonTropical)}`,
				`动盘 ${mp.text}`,
				`方位 ${shownAz.toFixed(1)}°`,
				`高度 ${Number(pl.altitudeTrue).toFixed(1)}°（地平${above ? '以上' : '以下'}）`,
			].join('\n');
			nodes.push(
				<g key={`ele-planet-${pl.id}`} {...this.tooltipHandlers(eleTip)}>
					{/* hover 命中区(细线+文字命中面太小,悬浮触发不了——照主盘行星补透明命中圆) */}
					<circle className="moira-hover-zone" cx={p.x} cy={p.y} r={22} />
				<line x1={lineStart.x} y1={lineStart.y} x2={lineEnd.x} y2={lineEnd.y} stroke="var(--moira-ele-mark, #804040)" strokeWidth="0.9" opacity="0.85" />
					<text x={p.x} y={p.y} fontSize={25} fontWeight={700} fill={color} textAnchor="middle" dominantBaseline="middle">{pl.label}</text>
					<text x={p.x + 15} y={p.y - 11} fontSize={13} fill={color}>{altSign}</text>
				</g>
			);
		});
		return <g className="moira-pick-election-planets">{nodes}</g>;
	}

	// 座山(照 Moira ChartData 座山箭头):红色全径主轴(−dist→dist 贯穿中心)+ 箭头两撇
	// (指向座山方),外带(r10~r11)与内带(r5~r6)两段红 mark 条;「座山」标签置于箭头端外。
	renderElectionZuoShan(){
		const ele = this.props.election || {};
		const zuoShan = Number(ele.zuoShanDeg) || 0;
		const theta = this.electionTheta(zuoShan);
		const dist = r(0) - 1;
		const len = dist / 4;
		// 箭头尖指「向山」(座山对面),座山度数在箭头后端(尾)——照用户钦定,整支调转 180°。
		const rad = (theta + 180) * Math.PI / 180;
		const ux = Math.cos(rad);
		const uy = Math.sin(rad);
		const tip = { x: dist * ux, y: dist * uy };
		const tail = { x: -dist * ux, y: -dist * uy };
		// 箭头两撇(在 tip 端,向内 len,横向 ±len/2)
		const back = { x: (dist - len) * ux, y: (dist - len) * uy };
		const perp = { x: -uy, y: ux };
		const wingA = { x: back.x + perp.x * len * 0.55, y: back.y + perp.y * len * 0.55 };
		const wingB = { x: back.x - perp.x * len * 0.55, y: back.y - perp.y * len * 0.55 };
		const bars = [];
		ACTIVE_PICK.markBands.map(([a, b])=>[r(a), r(b)]).forEach(([lo, hi], idx)=>{
			bars.push(
				<g key={`zs-bar-${idx}`}>
					<line x1={lo * ux} y1={lo * uy} x2={hi * ux} y2={hi * uy} stroke={RED} strokeWidth={4.2} />
					<line x1={-lo * ux} y1={-lo * uy} x2={-hi * ux} y2={-hi * uy} stroke={RED} strokeWidth={4.2} />
				</g>
			);
		});
		const plate = PLATE_OFFSET[ele.plate] !== undefined ? ele.plate : 'di';
		const mpZuo = mountainPosition(zuoShan, plate);
		const mpXiang = mountainPosition((zuoShan + 180) % 360, plate);
		const zsTip = [
			`座山 ${Number(zuoShan).toFixed(2)}°（${mpZuo.text}）`,
			`向山 ${((zuoShan + 180) % 360).toFixed(2)}°（${mpXiang.text}）`,
			'箭头指向山',
		].join('\n');
		return (
			<g className="moira-election-zuoshan" {...this.tooltipHandlers(zsTip)}>
				<circle className="moira-hover-zone" cx={tip.x} cy={tip.y} r={20} />
				<circle className="moira-hover-zone" cx={tail.x} cy={tail.y} r={20} />
				<line x1={tail.x} y1={tail.y} x2={tip.x} y2={tip.y} stroke={RED} strokeWidth={3.2} opacity={0.92} />
				<line x1={tip.x} y1={tip.y} x2={wingA.x} y2={wingA.y} stroke={RED} strokeWidth={3.2} />
				<line x1={tip.x} y1={tip.y} x2={wingB.x} y2={wingB.y} stroke={RED} strokeWidth={3.2} />
				{bars}
			</g>
		);
	}

	// 四角标注(照 Moira:左下时刻链,右下算法/内外盘说明/太阳分速/座山读数)
	// 罗盘宿带(compass 布局专属):28 宿名按方位度数表排(排列天然不均),画带中水平字。
	renderCompassStellarRing(){
		if(!psPair('compassRing')){
			return null;
		}
		const mid = (ps('compassRing', 0) + ps('compassRing', 1)) / 2;
		const nodes = COMPASS_STELLAR.map(([name, az])=>{
			const theta = this.electionTheta(az);
			const p = point(mid, theta);
			return (
				<g key={`compass-su-${name}`} {...this.tooltipHandlers(`罗盘宿 ${name}：方位 ${Number(az).toFixed(1)}°`)}>
					<circle className="moira-hover-zone" cx={p.x} cy={p.y} r={20} />
					<text x={p.x} y={p.y} fontSize={26} fontWeight={600} fill={BLACK} textAnchor="middle" dominantBaseline="central">{name}</text>
				</g>
			);
		});
		return <g className="moira-pick-compass-stellar">{nodes}</g>;
	}

	renderElectionCaptions(){
		const data = this.props.electionData || {};
		const ele = this.props.election || {};
		const params = this.props.transitParams || {};
		const decl = Number(this.props.declination) || 0;
		const declText = `${decl >= 0 ? '' : '-'}${Math.abs(decl).toFixed(2)}°${ele.adjNorth === false ? '(手动)' : '(WMM)'}${this.props.declinationOutOfRange ? '·超模型年限' : ''}`;
		const zuoShan = Number(ele.zuoShanDeg) || 0;
		const mp = mountainPosition(zuoShan, PLATE_OFFSET[ele.plate] !== undefined ? ele.plate : 'di');
		const hsysName = hsysDisplayName(ele.hsys);
		const lifeName = { sunrise: '日出立命', noon: '正午立命', sunset: '日落立命', custom: '自定立命' }[ele.eleLifeMode || 'sunrise'] || '日出立命';
		const leftLines = [
			params.date ? `${params.date} ${params.time || ''}`.trim() : '',
			data.trueSolarTime ? `真太阳时：${data.trueSolarTime}` : '',
			`磁北：${declText}`,
		];
		const rightLines = [
			'地心计算法',
			...riseSetLines({ rise: data.rise, sunrise: data.rise && data.rise.sunrise, sunset: data.rise && data.rise.sunset, moonrise: data.rise && data.rise.moonrise, moonset: data.rise && data.rise.moonset }),
			`内盘：黄道静盘 ${lifeName}`,
			ele.dynMode === 'quick' ? `外盘：黄道动盘 · ${hsysName}` : '外盘：地平动盘',
			data.sunAzimuthSpeedDegPerMin !== undefined ? `太阳分速 ${Number(data.sunAzimuthSpeedDegPerMin).toFixed(2)}度/分` : '',
			`座山度数 ${zuoShan.toFixed(2)} ${mp.text}`,
		];
		return (
			<g className="moira-election-captions" opacity="0.96">
				{cornerTextBlock({ x: -(VIEW / 2 - 20), y: VIEW / 2 - 110, anchor: 'start', lines: leftLines, size: 17, gap: 22, color: BLACK })}
				{cornerTextBlock({ x: VIEW / 2 - 20, y: VIEW / 2 - 152, anchor: 'end', lines: rightLines, size: 17, gap: 22, color: BLACK })}
			</g>
		);
	}

	render(){
		ACTIVE_PICK = PICK_LAYOUTS[pickLayoutMode(this.props.election)] || PICK_LAYOUTS.pick;
		const root = this.props.rootValue || {};
		const chart = this.props.value || root.chart || {};
		const transitRoot = this.props.transitValue || {};
		const transitChart = transitRoot.chart || null;
		const height = this.props.height || 740;
		const side = this.state.containerSide || Math.min(height, 740);
		// 择日双盘(照 Moira PICK_MODE 原生管线):静盘=本轮既有全部环(半径表即 Moira
		// pick_ring_pos 官方值);动盘=行星按方位角叠画在 24 山带,座山=红色全径箭头。
		const hasElection = !!(this.props.electionData && Array.isArray(this.props.electionData.planets) && this.props.electionData.planets.length);
		return (
			<div className="horosa-guolao-moira-wheel horosa-guolao-moira-pick-wheel" style={{height}} ref={this.containerRef}>
				<svg
					style={{width: side, height: side}}
					viewBox={`${-VIEW / 2} ${-VIEW / 2} ${VIEW} ${VIEW}`}
					role="img"
					aria-label="Moira天星择日盘"
				>
					<rect x={-VIEW / 2} y={-VIEW / 2} width={VIEW} height={VIEW} fill={MOIRA_BG} />
					{this.renderRings()}
					{this.renderSectorLines()}
					{this.renderDegreeTicks()}
					{this.renderStellarTicks()}
					{this.renderStaticCore()}
					{this.renderStellarRing(chart)}
					{this.renderPlanetLayers(chart, transitChart)}
					{this.renderMountainRings()}
					{this.renderCompassStellarRing()}
					{this.renderWesternHouses()}
					{this.renderGodRing(root, chart)}
					{hasElection ? this.renderElectionPlanets() : null}
					{hasElection ? this.renderElectionZuoShan() : null}
					{hasElection ? this.renderElectionCaptions() : null}
				</svg>
				{this.renderTooltip()}
			</div>
		);
	}
}

export default GuoLaoMoiraPickWheel;
