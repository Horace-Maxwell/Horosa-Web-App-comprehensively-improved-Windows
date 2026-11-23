// 七政 Moira 式圆盘(组件类在这里;盘面几何与数据按职责拆在 moiraWheel/ 下,依赖只朝前一层):
//   constants(尺寸 / 环位 / 配色 / 星体与相位定义)→ geometry(角度与坐标、扇环与连线、相位配对;活动布局 setActiveLayout 唯一写入口)
//   → text(盘面文字排布与度数 / 宿度文字)→ gods(神煞环与恒星环取数)→ stellar(宫头、恒星关系、强弱提示、落点聚合与标签避让)
//   → limits(命度、限度与流年年龄换算)。读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import React, { Component } from 'react';
import { createPortal } from 'react-dom';
import * as AstroConst from '../../constants/AstroConst';
import { computeRingPositions, ringCollapsed } from './moiraWheelLayout';
import { cornerTextBlock, apparentSolarText, lunarText, riseSetLines, su28ModeCaption, computationMethodCaption, geoCaption } from './GuoLaoWheelCaptions';
import { guolaoShenShaTip } from './GuoLaoShenShaDoc';
import { smallLimitBranch, flyLimitBranches, childLimitBranch, childAgeLimitYears } from './guolaoMoiraTables';
import './GuoLaoMoiraWheel.less';
import { getEffectiveScale, visualFloorPx, fixedPopupFrame } from '../../utils/zoomDomain';
import { createDeferredResizeObserver } from '../../utils/deferredResizeObserver';
import { propsOrStateChanged } from '../../utils/sameContent';
import { R, VIEW, RING_DRAW_TYPE, MOIRA_BG, BLACK, GREEN, BLUE, RED, NOW_MARK, PALE, MUTED_PLANET, GOD_RING_INNER, GOD_RING_OUTER, TWELVE_SIGNS, TWELVE_SIGNS_ALT, RING1, HOUSE_BRANCH, cnDegree, BIRTH_GOD_ORDER, TRANSIT_GOD_ORDER, PLANET_DEFS, DIGNITY_STRONG, DIGNITY_WEAK, dignityBadgeChar, MOIRA_DEFAULT_ASPECTS } from './moiraWheel/constants';
import { ACTIVE_RING_POS, ACTIVE_SLOTS, setActiveLayout, rs, computeMoiraAspectPairs, r, norm, point, annularSectorPath, moiraThetaFromDegree, moiraObliquityDeg, eclEquConvertDeg, sectorTheta, radialLine, connectorLine, aspectsPlanetLeads, objectRa, isEclipticDisplayChart } from './moiraWheel/geometry';
import { arcUprightTextMoira, verticalText, horizontalRingText, pairedRadialText, radialStackText, godTextSize, godColumnStep, dmsText, suOffsetText } from './moiraWheel/text';
import { mapCuspsToDisplay, listText, fullStellarByName, stellarIndexForDegree, buildStellarRelations, weakSolidRowForZi, zhiDegText, objectTooltip, signTooltip, weakSolidMarkers, planetColor, planetPlacements } from './moiraWheel/stellar';
import { lifeDegree, lifeLonDegree, houseIndexForSector, limitAnchor, birthYearFraction, birthYearBasis, limitAgeOffset, limitDegreeForAge, limitOffsetFromLife, limitYearForDegree, birthYearFrom } from './moiraWheel/limits';
import { stemBranchForYear, getZiGods, collectGods, godsFromRuleHits, longLifeCharFor, orderedGods, buildFixedStars } from './moiraWheel/gods';
export { R as MOIRA_WHEEL_R, VIEW as MOIRA_WHEEL_VIEW, MOIRA_BG as MOIRA_BACKGROUND, BLACK as MOIRA_BLACK, GREEN as MOIRA_GREEN, BLUE as MOIRA_BLUE, RED as MOIRA_RED, MAGENTA as MOIRA_MAGENTA, PALE as MOIRA_PALE, HALF_STELLAR as MOIRA_HALF_STELLAR, FULL_STELLAR as MOIRA_FULL_STELLAR, BIRTH_GOD_ORDER as MOIRA_BIRTH_GOD_ORDER, TRANSIT_GOD_ORDER as MOIRA_TRANSIT_GOD_ORDER, PLANET_DEFS as MOIRA_PLANET_DEFS, MOIRA_ASPECTS as MOIRA_ASPECT_DEFS } from './moiraWheel/constants';
export { computeMoiraAspectPairs, norm as moiraNormDegree, point as moiraPoint, annularSectorPath as moiraAnnularSectorPath, moiraObliquityDeg, eclEquConvertDeg as moiraEclEquConvertDeg, radialLine as moiraRadialLine, connectorLine as moiraConnectorLine, objectRa as moiraObjectRa, isEclipticDisplayChart as moiraIsEclipticDisplayChart } from './moiraWheel/geometry';
export { formatGodName as moiraFormatGodName, verticalText as moiraVerticalText, horizontalRingText as moiraHorizontalRingText, pairedRadialText as moiraPairedRadialText, radialStackText as moiraRadialStackText, radialColumns as moiraRadialColumns, godTextSize as moiraGodTextSize, godColumnStep as moiraGodColumnStep, dmsText as moiraDmsText, suOffsetText as moiraSuOffsetText } from './moiraWheel/text';
export { mapCuspsToDisplay as moiraMapCuspsToDisplay, fullStellarByName as moiraFullStellarByName, starHostByName as moiraStarHostByName, buildStellarRelations as moiraBuildStellarRelations, mergeStellarRelationRows as moiraMergeStellarRelationRows, weakSolidRowForZi as moiraWeakSolidRowForZi, zhiDegText as moiraZhiDegText, objectTooltip as moiraObjectTooltip, weakSolidMarkers as moiraWeakSolidMarkers, planetColor as moiraPlanetColor, circularGap as moiraCircularGap, planetPlacements as moiraPlanetPlacements } from './moiraWheel/stellar';
export { lifeDegree as moiraLifeDegree, limitAnchor as moiraLimitAnchor, birthYearFraction as moiraBirthYearFraction, birthYearBasis as moiraBirthYearBasis, limitAgeOffset as moiraLimitAgeOffset, limitDegreeForAge as moiraLimitDegreeForAge, buildGuolaoLimitTable as moiraBuildLimitTable, currentLimitIndex as moiraCurrentLimitIndex } from './moiraWheel/limits';
export { stemBranchForYear as moiraStemBranchForYear, getZiGods as moiraGetZiGods, collectGods as moiraCollectGods, godsFromRuleHits as moiraGodsFromRuleHits, longLifeCharFor as moiraLongLifeCharFor, orderedGods as moiraOrderedGods, buildFixedStars as moiraBuildFixedStars } from './moiraWheel/gods';

class GuoLaoMoiraWheel extends Component{
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

	// 只在「画出来会不一样」时重排。上层每次重渲都送来内容相同的新对象(本命盘 / 流年盘 / 规则 / 流年参数),
	// 切回本页时连送四轮,整个轮盘照着重排四遍(那一帧上百毫秒);transitLoading 本组件不读。
	// 主题色走样式变量,不靠重排;命度取法等会改盘的选项都随新数据进来(内容不同 → 照常重排)。
	shouldComponentUpdate(nextProps, nextState){
		return propsOrStateChanged(this.props, nextProps, this.state, nextState, ['transitLoading']);
	}

	componentDidMount(){
		this.measureContainer();
		if(typeof ResizeObserver !== 'undefined' && this.containerRef.current){
			this.resizeObserver = createDeferredResizeObserver(this.measureContainer);
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
		// 量容器只用布局域读数(clientWidth/clientHeight);rect 域在标准化 zoom 引擎下已×z,当布局 px 用=盘面大 z 倍被裁(旧引擎 rect=布局值故不显)。
		// clientWidth 为 0 的罕见兜底才用 rect,且经 getEffectiveScale()(实测探针)除回布局域。
		const zScale = getEffectiveScale() || 1;
		const rect = node.getBoundingClientRect();
		const fallbackHeight = Number(this.props.height) || 740;
		// 页签切走时容器塌成 0(不参与排版):那不是真尺寸。已经量到过真尺寸的,这时不拿兜底值重排一遍 ——
		// 否则切走排一遍(按兜底边长)、切回来再排一遍(按真边长),回访那一帧上百毫秒。从没量到过的(挂载时就不可见)照旧用兜底值。
		const collapsed = !node.clientWidth && !node.clientHeight && !rect.width && !rect.height;
		if(collapsed && this._measuredLaidOut){
			return;
		}
		if(!collapsed){ this._measuredLaidOut = true; }
		const availableWidth = node.clientWidth || (rect.width / zScale) || fallbackHeight;
		const availableHeight = node.clientHeight || (rect.height / zScale) || fallbackHeight;
		const nextSide = Math.max(visualFloorPx(280), Math.floor(Math.min(availableWidth, availableHeight)));
		if(Number.isFinite(nextSide) && nextSide !== this.state.containerSide){
			this.setState({containerSide: nextSide});
		}
	}

	tooltipPoint(evt){
		// 提示卡是 position:fixed:鼠标坐标(视觉域)先换到布局域,再与布局视口同域夹取;z=1 时逐值不变。
		if(typeof window === 'undefined'){
			return { x: evt.clientX + 14, y: evt.clientY + 16 };
		}
		const frame = fixedPopupFrame();
		const cx = frame.toFixed(evt.clientX);
		const cy = frame.toFixed(evt.clientY);
		const maxX = Math.max(12, frame.viewportWidth - 440);
		const maxY = Math.max(12, frame.viewportHeight - 220);
		return {
			x: Math.min(cx + 14, maxX),
			y: Math.min(cy + 16, maxY),
		};
	}

	showTooltip(text, evt){
		if(!text){
			return;
		}
		this.setState({
			tooltip: {
				...this.tooltipPoint(evt),
				text,
			},
		});
	}

	moveTooltip(evt){
		if(!this.state.tooltip){
			return;
		}
		this.setState({
			tooltip: {
				...this.state.tooltip,
				...this.tooltipPoint(evt),
			},
		});
	}

	hideTooltip(){
		if(this.state.tooltip){
			this.setState({
				tooltip: null,
			});
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
		const outermostDrawn = ACTIVE_RING_POS.reduce((acc, pos, idx)=>(RING_DRAW_TYPE[idx] <= -10 ? acc : idx), 0);
		// 七政+相位(aspects)六圆规格:仅画 idx {2,4,5,6,7,8}(0.51/0.62/0.69/0.76/0.92/0.95);
		// 仅 aspects 生效,full/half 常规 Moira 圆盘零变化。
		const aspectsMode = this.props.showAspectsMode === true;
		const ASPECTS_CIRCLES = [2, 4, 5, 6, 7, 8];
		return (
			<g className="moira-rings">
				{ACTIVE_RING_POS.map((pos, idx)=>{
					if(aspectsMode){
						// 六圆白名单直接画,不受 full 的 drawType/折叠规则约束。
						if(ASPECTS_CIRCLES.indexOf(idx) < 0){
							return null;
						}
					} else {
						if(RING_DRAW_TYPE[idx] <= -10){
							return null;
						}
						if(ringCollapsed(ACTIVE_RING_POS, idx)){
							return null; // 折叠环:与前一边界重合,不重复画圆
						}
					}
					const major = RING_DRAW_TYPE[idx] === 1 || idx === 0 || idx === 11 || (idx === outermostDrawn && pos >= 0.999);
					return (
						<circle
							key={`ring-${idx}`}
							r={pos * R}
							className={major ? 'moira-ring-major' : 'moira-ring-minor'}
						/>
					);
				})}
			</g>
		);
	}

	// 西占不等宫 cusps(真黄经;择日端点 staticHousesBySystem,本盘时刻同源)。
	// 分宫制=左栏所选(election.hsys);无数据返回 null(数字环回退整宫)。
	westernCusps(){
		const data = this.props.electionData || {};
		const ele = this.props.election || {};
		const pool = data.staticHousesBySystem || data.housesBySystem;
		const cusps = pool ? (pool[ele.hsys] || pool.P || pool.A) : null;
		return (cusps && cusps.length >= 12) ? cusps.map(Number) : null;
	}

	mapCuspsToWheel(cusps, chart){
		return mapCuspsToDisplay(cusps, chart);
	}

	// 西占不等宫宫位格(与择日盘同款做法):上升=1宫头,逆时针按所选分宫制切分,
	// 数字带(圆2-3)每格宽=真实宫宽,数字向心置界间中点;宫界以虚线透传
	// 流年行星带(圆4-5)与本命行星带(圆6-7)。
	renderWesternHouseGrid(){
		// aspects 六圆规格无数字宫位环(用户钦定),整格不画。
		if(this.props.showAspectsMode === true){
			return null;
		}
		const cuspsLon = this.westernCusps();
		if(!cuspsLon){
			return null;
		}
		const root = this.props.rootValue || {};
		const chart = this.props.value || root.chart || {};
		const cusps = this.mapCuspsToWheel(cuspsLon, chart);
		const dashOf = (a, b)=>{
			const len = Math.max(0, b - a);
			return len > 2 ? `${len / 17} ${len / 17}` : null;
		};
		const bands = [
			['nowPlanets', rs('nowPlanets', 0), rs('nowPlanets', 1)],
			['birthPlanets', rs('birthPlanets', 0), rs('birthPlanets', 1)],
		];
		const nodes = [];
		for(let k = 0; k < 12; k++){
			const cur = cusps[k];
			let next = cusps[(k + 1) % 12];
			if(next <= cur){ next += 360; }
			const bTheta = moiraThetaFromDegree(cur);
			const mTheta = moiraThetaFromDegree(cur + (next - cur) / 2);
			const p = point((rs('numbers', 0) + rs('numbers', 1)) / 2, mTheta);
			const whTip = [`第 ${k + 1} 宫`, `${zhiDegText(cur)} ~ ${zhiDegText(next % 360)}`, `宫宽 ${(next - cur).toFixed(1)}°`].join('\n');
			nodes.push(
				<g key={`mwh-${k}`} {...this.tooltipHandlers(whTip)}>
					<path
						className="moira-hover-zone"
						d={annularSectorPath(rs('numbers', 0), rs('numbers', 1), moiraThetaFromDegree(next), bTheta)}
					>
					</path>
					{radialLine(bTheta, rs('numbers', 0), rs('numbers', 1), {color: BLACK, width: 1.35})}
					{bands.map(([name, a, b])=>{
						const dash = dashOf(a, b);
						return dash ? <g key={`mwh-${k}-${name}`}>{radialLine(bTheta, a, b, {color: BLACK, width: 0.8, dash})}</g> : null;
					})}
					<text x={p.x} y={p.y} fill={GREEN} fontSize={19} fontWeight={700} textAnchor="middle" dominantBaseline="central" transform={`rotate(${mTheta + 90} ${p.x} ${p.y})`}>{k + 1}</text>
				</g>
			);
		}
		return <g className="moira-western-house-grid">{nodes}</g>;
	}

	renderSectorLines(){
		const nodes = [];
		// 有西占宫位格时,数字带(numbers 槽)的整宫支线让位给不等宫界线(择日盘同款)。
		const skipNumbersRing = this.westernCusps() ? ACTIVE_SLOTS.numbers[1] : -1;
		// 七政+相位(aspects)六圆规格:十二宫扇线只画 人事宫带(ringIdx5)/八卦支曜带(6)/神煞带(7);
		// 星体腔与宿带零扇线。仅 aspects 生效,full/half 常规 Moira 圆盘零变化。
		const aspectsMode = this.props.showAspectsMode === true;
		if(aspectsMode){
			// 六圆规格:仅 人事宫带(idx4-5)/八卦支曜带(5-6)/神煞带(6-7) 画十二宫扇线,直画不看 drawType。
			[5, 6, 7].forEach((ringIdx)=>{
				for(let i = 0; i < 12; i++){
					nodes.push(
						<g key={`sector-${ringIdx}-${i}`}>
							{radialLine(-30 * i, r(ringIdx - 1), r(ringIdx), {color: BLACK, width: 1.35})}
						</g>
					);
				}
			});
			return <g>{nodes}</g>;
		}
		for(let ringIdx = 1; ringIdx < RING_DRAW_TYPE.length; ringIdx++){
			if(ringCollapsed(ACTIVE_RING_POS, ringIdx)){
				continue; // 折叠带无宽度,扇线免画
			}
			const drawType = RING_DRAW_TYPE[ringIdx];
			if(drawType <= 0 && drawType > -10 && ringIdx !== skipNumbersRing){
				for(let i = 0; i < 12; i++){
					nodes.push(
						<g key={`sector-${ringIdx}-${i}`}>
							{radialLine(-30 * i, r(ringIdx - 1), r(ringIdx), {color: BLACK, width: 1.35})}
						</g>
					);
				}
			}
			if(drawType === 2 || drawType === -11){
				for(let i = 0; i < 24; i++){
					nodes.push(
						<g key={`sector24-${ringIdx}-${i}`}>
							{radialLine(-7.5 - 15 * i, r(ringIdx - 1), r(ringIdx), {color: BLACK, width: 1.35})}
						</g>
					);
				}
			}
		}
		return <g>{nodes}</g>;
	}

	renderDegreeMarkBand(inner, outer, keyPrefix, thetaForDegree = moiraThetaFromDegree, opt = {}){
		const nodes = [];
		const delta = (outer - inner) / 3;
		for(let degree = 0; degree < 360; degree++){
			const theta = thetaForDegree(degree);
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
						// 黑色刻度统一外圈粗细+纯黑不透明(用户钦定「刻度是黑色不是灰色」);
						// 红色整宫刻度线除外保持原宽。
						width: color === RED ? (opt.majorWidth || 0.82) : 1.35,
						opacity: 1,
					})}
				</g>
			);
		}
		return nodes;
	}

	renderDegreeTicks(chart, fields){
		const nodes = [];
		const life = lifeDegree(chart, fields);
		const lifeTheta = moiraThetaFromDegree(life);
		// 🔴 birthFrac(公历元旦基准,照 Moira val=age-1-birthFrac)+ 定童限 base(9/10)。类B 显示项,缺省=元旦/9 → 旧版零回归。
		const limitChildBase = Number(this.props.limitChildBase) === 10 ? 10 : 9;
		const limitBirthFrac = birthYearFraction(chart, fields, this.props.limitYearBoundary || 'gregorian');
			if(this.props.showAspectsMode === true){
				// 六圆规格:宿带只在圆1 外侧一条刻度(贴圆1 向外);无下刻度带。
				nodes.push(...this.renderDegreeMarkBand(rs('stellarTickUp', 0), rs('stellarTickUp', 1), 'aspects-stellar-up', moiraThetaFromDegree, {mutedMajor: true, anchor: 'inner'}));
			} else {
				nodes.push(...this.renderDegreeMarkBand(r(4), r(5), 'full-stellar-up', moiraThetaFromDegree, {mutedMajor: true, anchor: 'inner'}));
				nodes.push(...this.renderDegreeMarkBand(r(6), r(7), 'full-stellar-down', moiraThetaFromDegree, {mutedMajor: true}));
			}
		if(this.props.showAgeRing !== false){
			// 每岁数字 = 悬浮触发点(用户钦定,非分割线)+ 始终向心(rotate theta+90,与宫号/度数/年份同姿态)。
			// 限度按当前宿度制的宿界(buildFixedStars 取当前 chart.fixedStarSu28)换算,随宿度制变化而变。
			// 小限/飞限/童限:照 Moira ChartData(getSmallLimit/getFlyLimit/getChildLimit)——以黄经命宫(12 宫地支)推,永远黄道。
			const ageBirthYear = birthYearFrom(null, chart, fields);
			const ageStars = buildFixedStars(chart);
			const ageDisplayEcl = isEclipticDisplayChart(chart); // 黄仪:限度落点=黄经;赤仪:=赤经
			const ageEps = moiraObliquityDeg(chart);
			// 小限/飞限/童限=12 宫地支划分,以黄经命度为准(与地支盘/命宫同口径,不随宿度制黄赤仪变)。
			// 算法单一真值源=guolaoMoiraTables(照 Moira ChartData;flyLimitBranches 的 cur_age 为 0 基)。
			const ageLifeLon = lifeLonDegree(chart, fields);
			const ageLifeSignPos = Math.floor(norm(ageLifeLon) / 30) * 30;
			const ageChildLimit = childAgeLimitYears(ageLifeLon, limitChildBase);
			const ageSuDeg = (deg)=>{
				const idx = stellarIndexForDegree(ageStars, deg);
				// idx 是 fixedStarSu28 位序(壁奎娄…随宿度制变),不能直接切 FULL_STELLAR(娄胃昴…固定序,否则错宿)。
				// 取该位真实宿名 → 按名映射 宿+五行 全名(与中心立命 lifeXiuFull 同法)。
				const suName = idx >= 0 ? (ageStars[idx] && ageStars[idx].name) || '' : '';
				const suFull = fullStellarByName(suName);
				const off = suOffsetText(deg, ageStars);
				return suFull ? `${suFull} ${off || ''}`.trim() : (off || `${norm(deg).toFixed(2)}°`);
			};
			for(let age = 1; age <= 130; age++){
				// 🔴 cell = [起界 startOff, 止界 endOff](自锚点累计角偏移,offset 封顶 360=锚点/出生线)。
				// 1 岁起界=锚点(0,命宫整宫界);末岁 endOff 封顶 360 → 末段 partial cell 一直画到出生线闭合环
				// (照 Moira 12 宫填满 360°:首/末两格都是被出生线一侧截断的窄格)。break 用**起界**越锚点即止,
				// 故末段窄格(中心已过 359.9 但起界未到)仍会画——修「末岁结束少画一节」。
				const startOff = age === 1 ? 0 : limitAgeOffset(life, age, limitBirthFrac, limitChildBase);
				const endOff = limitAgeOffset(life, age + 1, limitBirthFrac, limitChildBase);
				// break 用 **止界**(该岁 END tick=下一元旦)越锚点即止 → 末**数字**=97(同 Moira,不多标 98);
				// 分割线循环则用起界 break(多画一格=末岁 END tick/闭合刻度),故线比数字多一格=闭合环(照 Moira)。
				if(endOff >= 359.9){ break; }
				// 数字落 cell **角度中心**(照 Moira 0.5*(angle+last_angle));首/末 partial 窄格亦按此中心不偏。
				const degree = norm(limitAnchor(life) - (startOff + endOff) / 2);
				const theta = moiraThetaFromDegree(degree);
				// 岁数**贴外圈**(用户钦定:靠最外侧圆圈看着更整齐),留安全距离:数字中心置外圈内侧 6.5px,
				// cap≈10px 居中 → 外缘距外圈约 1.5px 不压线,内侧空出给分割线。
				const p = point(r(11) - 6.5, theta);
				const limitDeg = limitDegreeForAge(life, age, limitBirthFrac, limitChildBase);
				// 限度落点在当前宿度制显示坐标(黄仪=黄经/赤仪=赤经);另一坐标由黄赤交角变换求真值。
				const ageHuang = ageDisplayEcl ? norm(limitDeg) : eclEquConvertDeg(limitDeg, ageEps);
				const ageChi = ageDisplayEcl ? eclEquConvertDeg(limitDeg, ageEps) : norm(limitDeg);
				const smallZhi = smallLimitBranch(ageLifeSignPos, age);
				// flyLimitBranches cur_age=0 基(age-1);childAgeLimit 传真值(勿用默认 5);半年段拼「甲乙各半年」。
				const flyObj = flyLimitBranches(ageLifeSignPos, age - 1, ageChildLimit);
				const flyZhi = flyObj && flyObj.branches.length
					? (flyObj.halfYear ? `${flyObj.branches.join('')}各半年` : flyObj.branches[0])
					: '';
				const inChild = age <= ageChildLimit;
				const childZhi = inChild ? childLimitBranch(ageLifeSignPos, age) : '';
				const limitLine = [
					`小限 ${smallZhi}`,
					flyZhi ? `飞限 ${flyZhi}` : '',
					childZhi ? `童限 ${childZhi}` : '',
				].filter(Boolean).join(' · ');
				const ageTip = [
					`${age} 岁 · ${ageBirthYear + age - 1} 年 ${stemBranchForYear(ageBirthYear + age - 1)}`,
					`限度 ${ageSuDeg(limitDeg)}`,
					`黄经 ${ageHuang.toFixed(2)}° · 赤经 ${ageChi.toFixed(2)}°`,
					limitLine,
				].filter(Boolean).join('\n');
				nodes.push(
					<g
						key={`limit-age-${age}`}
						{...this.tooltipHandlers(ageTip)}
						onClick={this.props.onAgeClick ? (()=>this.props.onAgeClick(ageBirthYear + age - 1)) : undefined}
						style={this.props.onAgeClick ? { cursor: 'pointer' } : undefined}
					>
						{/* 点击该岁格 → 流年跳该岁对应年 7/1 12:00(用户钦定);hover-zone 兼作点击热区。 */}
						<circle className="moira-hover-zone" cx={p.x} cy={p.y} r={9} />
						{/* 岁数数字放到最大(用户钦定「看清楚」):字号 14 —— 数字径向朝心,占满岁数带高(r10→r11)
						    又不压到内外圆环线条。cap height≈0.7·14≈9.8px < 带宽 ~17px。 */}
						<text x={p.x} y={p.y} fill={GREEN} fontSize="14" fontWeight="600" textAnchor="middle" dominantBaseline="central" transform={`rotate(${theta + 90} ${p.x} ${p.y})`}>
							{age}
						</text>
					</g>
				);
			}
		}
		nodes.push(
			<g key="life-degree-marker" className="moira-life-degree-marker">
				{/* 命度(立命)标记:照 Moira mark_up_ring/mark_down_ring —— 上/下刻度带各一段
				    整带高粗红线(chart_life_master_mk_color=0xff0000),中间宿名带断开不相连;
				    aspects 仅上刻度带(aspects_mark_up_ring0=3,圆1 外侧),其 tickDown 槽与宿名带
				    重合故必须跳过;half 上刻度带折叠 → 自动只余下段。岁数带 year_mark 短线恒画。 */}
				{(rs('stellarTickUp', 1) - rs('stellarTickUp', 0)) > 0.5
					? radialLine(lifeTheta, rs('stellarTickUp', 0), rs('stellarTickUp', 1), {color: RED, width: 4.5})
					: null}
				{this.props.showAspectsMode !== true && (rs('stellarTickDown', 1) - rs('stellarTickDown', 0)) > 0.5
					? radialLine(lifeTheta, rs('stellarTickDown', 0), rs('stellarTickDown', 1), {color: RED, width: 4.5})
					: null}
				{radialLine(lifeTheta, r(10), r(11), {color: RED, width: 4.5})}
			</g>
		);
		return <g className="moira-degree-ticks">{nodes}</g>;
	}

	renderStellarTicks(){
		return null;
	}

	renderStaticTwelve(root, chart, fields){
		const nodes = [];
		const life = lifeDegree(chart, fields);
		const ziGods = getZiGods(root, chart);
		const aspectsMode = this.props.showAspectsMode === true;
		for(let i = 0; i < 12; i++){
			const theta = sectorTheta(i);
			const startTheta = -30 * i;
			const endTheta = -30 * (i + 1);
			const pNumber = point((rs('numbers', 0) + rs('numbers', 1)) / 2, theta);
			const houseNameRadius = (rs('houseNames', 0) + rs('houseNames', 1)) / 2;
			const houseIndex = houseIndexForSector(i, life);
			const houseName = HOUSE_BRANCH[houseIndex];
			const houseNumber = `${houseIndex + 1}`;
			const gods = orderedGods(collectGods(ziGods, TWELVE_SIGNS[i]), BIRTH_GOD_ORDER);
			const weakSolid = weakSolidRowForZi(this.props.moiraRules, TWELVE_SIGNS[i]);
			const tip = signTooltip(TWELVE_SIGNS[i], houseName, RING1[i], this.props.moiraRules, gods);
			nodes.push(
				<g key={`static-${i}`}>
					<path
						className="moira-hover-zone"
						d={annularSectorPath(Math.min(rs('branchStars', 0), rs('houseNames', 0)), Math.max(rs('branchStars', 1), rs('houseNames', 1)), endTheta, startTheta)}
						{...this.tooltipHandlers(tip)}
					>
					</path>
					{aspectsMode
						? arcUprightTextMoira(TWELVE_SIGNS_ALT[i], (rs('branchStars', 0) + rs('branchStars', 1)) / 2, theta, {size: 20, color: BLACK, weight: 600})
						: pairedRadialText(RING1[i], theta, rs('branchStars', 0), rs('branchStars', 1), {size: 22, primaryColor: MUTED_PLANET, secondaryColor: BLACK, weight: 600})}
					{aspectsMode ? null : weakSolidMarkers(weakSolid, theta, rs('branchStars', 0), rs('branchStars', 1))}
					{horizontalRingText(houseName, houseNameRadius, theta, {size: 20, color: GREEN, weight: 700})}
					{(this.westernCusps() || aspectsMode) ? null : (
						<text
							x={pNumber.x}
							y={pNumber.y}
							fill={GREEN}
							fontSize="20"
							fontWeight="600"
							textAnchor="middle"
							dominantBaseline="central"
							transform={`rotate(${theta + 90} ${pNumber.x} ${pNumber.y})`}
						>
							{houseNumber}
						</text>
					)}
				</g>
			);
		}
		// 中心立命标注（对齐 Moira「心月 / 六度 / 立命」做法）：显示命度所在宿+七曜、入宿度、立命。
		// 旧版为硬编码「七政/立命/度木」（度木为写死占位、不随盘变），现按真实命度计算。
		const lifeStars = buildFixedStars(chart);
		const lifeXi = stellarIndexForDegree(lifeStars, life);
		const lifeXiuName = lifeXi >= 0 ? (lifeStars[lifeXi].name || '') : '';
		const lifeXiuFull = lifeXiuName ? fullStellarByName(lifeXiuName) : '立命';
		const lifeDegInto = lifeXi >= 0 ? norm(life - norm(lifeStars[lifeXi].ra)) : 0;
		const lifeDegStr = cnDegree(lifeDegInto) + '度';
		return (
			<g className="moira-static-twelve">
				{nodes}
				{this.renderWesternHouseGrid()}
				{/* aspects:中心腔缘圆透明不描边(用户钦定)——相位线端锚仍在 r(0),锚点圆独立可见。 */}
				<circle r={r(0)} fill={MOIRA_BG} stroke={this.props.showAspectsMode === true ? 'none' : BLACK} strokeWidth="1.35" />
				{this.renderAspects(chart)}
				{this.props.showAspectsMode === true ? null : (
					<g {...this.tooltipHandlers([`立命 ${zhiDegText(life)}`, `命度宿 ${lifeXiuFull} ${cnDegree(lifeDegInto)}度`].join('\n'))}>
						<circle className="moira-hover-zone" cx={0} cy={8} r={54} />
						<text x="0" y="-24" fill={GREEN} fontSize="28" fontWeight="700" textAnchor="middle">{lifeXiuFull}</text>
						<text x="0" y="8" fill={GREEN} fontSize="28" fontWeight="700" textAnchor="middle">{lifeDegStr}</text>
						<text x="0" y="40" fill={GREEN} fontSize="28" fontWeight="700" textAnchor="middle">立命</text>
					</g>
				)}
			</g>
		);
	}

	renderStellarRing(chart){
		const stars = buildFixedStars(chart);
		const birthRelations = buildStellarRelations(chart);
		const transitRoot = this.props.transitValue || {};
		const transitChart = transitRoot.chart ? (transitRoot.params ? {...transitRoot.chart, params: transitRoot.params} : transitRoot.chart) : null;
		const transitRelations = transitChart ? buildStellarRelations(transitChart) : [];
		const nodes = [];
		stars.forEach((cur, idx)=>{
			const nxt = stars[(idx + 1) % stars.length];
			let span = Number(nxt.ra) - Number(cur.ra);
			if(span <= 0){
				span += 360;
			}
			const edgeTheta = moiraThetaFromDegree(cur.ra);
			const centerTheta = moiraThetaFromDegree(Number(cur.ra) + span / 2);
			const p = point((rs('stellarNames', 0) + rs('stellarNames', 1)) / 2, centerTheta);
			const endRa = norm(Number(cur.ra) + span);
			const birth = birthRelations[idx] || {};
			const transit = transitRelations[idx] || {};
			// 宿界黄经跨度(可能与赤经跨度不同:赤仪宿度制下二者真值分离)。
			let lonSpan = Number(nxt.lon) - Number(cur.lon);
			if(lonSpan <= 0){ lonSpan += 360; }
			const lonEnd = norm(Number(cur.lon) + lonSpan);
			// 真实黄经/赤经:黄仪宿界置黄道(源侧赤经=lon 占位)→ 按黄赤交角算真赤经,黄经≠赤经;赤仪宿界置赤道→ ra/lon 已是真值。
			const stellarEps = moiraObliquityDeg(chart);
			const isEclSu = Math.abs(Number(cur.ra) - Number(cur.lon)) < 0.01;
			const raStartReal = isEclSu ? eclEquConvertDeg(cur.lon, stellarEps) : norm(Number(cur.ra));
			const raEndReal = isEclSu ? eclEquConvertDeg(lonEnd, stellarEps) : endRa;
			const tip = [
				`${cur.label || cur.name}宿`,
				`黄经 ${norm(cur.lon).toFixed(2)}° ~ ${lonEnd.toFixed(2)}°`,
				`赤经 ${raStartReal.toFixed(2)}° ~ ${raEndReal.toFixed(2)}°`,
				`宿宽 ${dmsText(span)}`,
				`本命落入：${listText(birth.main)}`,
				`本命同经：${listText(birth.same)}`,
				transitChart ? `流年落入：${listText(transit.main)}` : '',
				transitChart ? `流年同经：${listText(transit.same)}` : '',
			].filter(Boolean).join('\n');
			nodes.push(
				<g key={`stellar-${idx}`}>
					<path
						className="moira-hover-zone"
						d={annularSectorPath(rs('stellarNames', 0), rs('stellarNames', 1), moiraThetaFromDegree(Number(cur.ra) + span), edgeTheta)}
						{...this.tooltipHandlers(tip)}
					>
					</path>
					{this.props.showAspectsMode === true
						? radialLine(edgeTheta, rs('stellarNames', 1) - (rs('stellarNames', 1) - rs('stellarTickUp', 0)) * 3 / 5, rs('stellarNames', 1) - 1, {color: RED, width: 1})
						: radialLine(edgeTheta, rs('stellarNames', 0) + 1, rs('stellarNames', 1) - 1, {color: RED, width: 1})}
					{verticalText(cur.name || cur.label, p.x, p.y, {
						size: 23,
						maxPerCol: 1,
						color: BLACK,
						weight: 600,
					})}
				</g>
			);
		});
		return <g className="moira-stellar-layer">{nodes}</g>;
	}

	renderPlanetRing(chart, opt){
		const nodes = [];
		const hiddenIds = this.hiddenPlanetIds();
		const aspectsBirth = this.props.showAspectsMode === true && opt.kind === 'birth';
		// Moira aspects:sign_lock[ASC]=sign_lock[MC]=true —— 升/顶钉真实度数不参与推挤。
		const lockIds = aspectsBirth ? new Set([AstroConst.ASC, AstroConst.MC]) : null;
		const placements = planetPlacements(chart, opt.inner, opt.outer, opt.dir, opt.size, opt.preferLon, PLANET_DEFS, lockIds)
			.filter((item)=>!(hiddenIds && hiddenIds.has(item.id)));
		const showDignity = opt.kind === 'birth' && this.props.showDignity !== false;
		const dignityById = {};
		if(showDignity){
			const rp = (this.props.moiraRules && this.props.moiraRules.planets) || [];
			rp.forEach((row)=>{ if(row && row.id != null){ dignityById[row.id] = row.dignity; } });
		}
		placements.forEach((item, idx)=>{
			const markTheta = moiraThetaFromDegree(item.degree);
			const labelTheta = moiraThetaFromDegree(item.labelDegree);
			const p = point(item.radius, labelTheta);
			const dignity = showDignity ? dignityById[item.id] : null;
			const color = planetColor(item.obj, opt.color, dignity);
			const showBadge = !!dignity && (DIGNITY_STRONG.indexOf(dignity) >= 0 || DIGNITY_WEAK.indexOf(dignity) >= 0);
			const tip = objectTooltip(item, opt.kind, this.props.moiraRules, buildFixedStars(chart));
			nodes.push(
				<g key={`${opt.kind}-planet-${item.id}-${idx}`}>
					<circle
						className="moira-hover-zone"
						cx={p.x}
						cy={p.y}
						r={Math.max(20, opt.size * 0.82)}
						{...this.tooltipHandlers(tip)}
					>
					</circle>
						{aspectsBirth
							? aspectsPlanetLeads(markTheta, labelTheta, rs('birthPlanets', 0), rs('birthPlanets', 1), item.radius, (opt.size || 28) / 2, {color: opt.markColor})
							: connectorLine(markTheta, labelTheta, opt.markInner, opt.markOuter, opt.lineDir || 1, {color: opt.markColor, width: 1.05})}
					{verticalText(item.label, p.x, p.y, {
						size: opt.size,
						maxPerCol: 1,
						color,
						weight: 600,
					})}
					{showBadge ? (
						<text x={p.x + opt.size * 0.6} y={p.y - opt.size * 0.5} fill={color} fontSize={opt.size * 0.44} fontWeight="700" textAnchor="middle" dominantBaseline="central">{dignityBadgeChar(dignity)}</text>
					) : null}
				</g>
			);
		});
		return <g className={`moira-planet-layer moira-planet-layer-${opt.kind}`}>{nodes}</g>;
	}

	// 星曜可见性/相位容许度 均为类B显示偏好(对照 Moira PlanetDialog/AspectDialog):
	// hiddenPlanets=按曜名隐藏(隐藏的曜连带不参与连线);aspectOrbs=每相位 orb 覆盖默认。
	hiddenPlanetIds(){
		const hidden = this.props.hiddenPlanets || [];
		if(!hidden.length){
			return null;
		}
		const ids = new Set();
		PLANET_DEFS.forEach((def)=>{ if(hidden.indexOf(def.label) >= 0){ ids.add(def.id); } });
		return ids;
	}

	renderAspects(chart){
		// 照 Moira show_aspects 语义:仅「显示相位」(aspects 布局)时画中心相位网;
		// full/half 常规模式中心圆内零相位线(用户钦定,与 Moira 一致)。
		if(this.props.showAspectsMode !== true){
			return null;
		}
		const set = this.props.aspectSet || MOIRA_DEFAULT_ASPECTS;
		if(!set || !set.length){
			return null;
		}
		const pairs = computeMoiraAspectPairs(chart, { aspectSet: set, aspectOrbs: this.props.aspectOrbs, hiddenPlanets: this.props.hiddenPlanets });
		const objects = (chart && chart.objects) || [];
		const preferLon = isEclipticDisplayChart(chart);
		const hiddenIds = this.hiddenPlanetIds();
		const items = PLANET_DEFS.map((def)=>{
			if(hiddenIds && hiddenIds.has(def.id)){ return null; }
			const obj = objects.find((o)=>o && o.id === def.id);
			const deg = objectRa(obj, preferLon);
			return (obj && deg !== null) ? {id: def.id, deg: norm(deg)} : null;
		}).filter(Boolean);
		const aspectsMode = this.props.showAspectsMode === true;
		// aspects 模式:相位网画满中心腔,锚点小实心圆列在腔缘(Moira circle_offset 观感),
		// 行星向锚点引点线;常规模式保持原内圈细线(开关关闭时零变化)。
		// aspects:连线端锚在腔缘 r(0)(=aspects_ring 0.38),锚点圆在锚点带([0.38,0.42))中点 0.40(Moira circle_offset)。
		const R0 = aspectsMode ? r(0) : r(0) * 0.92;
		const anchorR = aspectsMode ? (rs('anchor', 0) + rs('anchor', 1)) / 2 : R0;
		const lines = [];
		if(aspectsMode){
			// 星体带纯净化(用户钦定「星体圈只有星体」):锚点引点线不再伸入行星带,仅留锚点圆。
			items.forEach((it)=>{
				const p = point(anchorR, moiraThetaFromDegree(it.deg));
				lines.push(<circle key={`asp-dot-${it.id}`} cx={p.x} cy={p.y} r="4.6" fill={BLACK} />);
			});
		}
		pairs.forEach((pr)=>{
			const a = point(R0, moiraThetaFromDegree(pr.a.deg));
			const b = point(R0, moiraThetaFromDegree(pr.b.deg));
			lines.push(
				<line key={`asp-${pr.a.id}-${pr.b.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={pr.aspect.color} strokeWidth="1.05" strokeDasharray={pr.aspect.dash || undefined} opacity="0.8" />
			);
		});
		return <g className="moira-aspect-layer">{lines}</g>;
	}

	renderPlanetLayers(birthChart, transitChart){
		const birthPreferLon = isEclipticDisplayChart(birthChart);
		const transitPreferLon = isEclipticDisplayChart(transitChart || birthChart);
		return (
			<g>
					{this.props.showMoiraTransitGods !== false && this.props.showAspectsMode !== true ? this.renderPlanetRing(transitChart || birthChart, {
						kind: 'now',
						inner: rs('nowPlanets', 0) + 6,
						outer: rs('nowPlanets', 1) - 6,
						dir: 1,
						size: 27,
						color: BLUE,
							markColor: NOW_MARK,
							markInner: rs('nowPlanets', 0),
							markOuter: rs('nowPlanets', 1),
							lineDir: 1,
							preferLon: transitPreferLon,
						}) : null}
					{this.renderPlanetRing(birthChart, {
						kind: 'birth',
						inner: rs('birthPlanets', 0) + 7,
						outer: rs('birthPlanets', 1) - 8,
						dir: -1,
						size: 28,
						color: GREEN,
							markColor: BLACK,
							markInner: rs('birthPlanets', 0),
							markOuter: r(8),
							lineDir: -1,
							preferLon: birthPreferLon,
						})}
				</g>
			);
	}

	renderGodRing(root, chart, opt){
		const ziGods = getZiGods(root, chart);
		const nodes = [];
		const kindLabel = opt.kind === 'transit' ? '流年' : '本命';
		// 本命/流年独立隐藏名单(按环性质分流,互不影响)
		const hiddenSrc = opt.kind === 'transit' ? this.props.hiddenGodsTransit : this.props.hiddenGodsBirth;
		const hiddenGods = hiddenSrc && hiddenSrc.length ? new Set(hiddenSrc) : null;
		for(let i = 0; i < 12; i++){
			const theta = sectorTheta(i);
			const fromRules = godsFromRuleHits(this.props.moiraRules, TWELVE_SIGNS[i], opt.kind);
			const base = fromRules !== null ? fromRules : collectGods(ziGods, TWELVE_SIGNS[i]);
			// 长生字恒置首位(Moira getStarSigns head 首插),固定画不受筛选。
			const longLife = longLifeCharFor(this.props.moiraRules, TWELVE_SIGNS[i], opt.kind);
			const gods = (longLife ? [longLife] : []).concat(
				orderedGods(base, opt.order).filter((god)=>!(hiddenGods && hiddenGods.has(god)))
			);
			const godSize = opt.size || godTextSize(gods.length);
			const godSteps = godColumnStep(gods.length);
			const startTheta = -30 * i;
			const endTheta = -30 * (i + 1);
			const palaceTip = `${TWELVE_SIGNS[i]} · ${kindLabel}神煞\n${gods.length ? gods.join('，') : '无'}`;
			// 复刻 radialColumns 的列定位，给每个神煞单独的悬浮热区 + 判语。
			const rawStep = gods.length <= 1 ? 0 : godSteps.arc / (gods.length - 1);
			const step = gods.length <= 1 ? 0 : Math.min(godSteps.maxStep, rawStep);
			const start = theta + step * (gods.length - 1) / 2;
			const half = step > 0 ? step / 2 : 3;
			// half(单盘)双带:照 Moira use_lower——神煞分上下两层(层分界=带中点,half 表的 0.77),
			// 奇偶交替上/下层;非双带模式恒用整带(零变化)。
			const bandMid = (opt.inner + opt.outer) / 2;
			// 双层条件:仅 half 单盘显式双带(Moira use_lower)。字多不再自动分层——
			// 神煞恒落同一同心圆沿弧排(用户钦定),密度由字号/步长表自适应收紧。
			const dual = opt.singleBand ? false : !!opt.dualBand;
			const bandFor = (idx)=>{
				if(!dual){ return [opt.inner, opt.outer]; }
				return idx % 2 === 0 ? [bandMid + 4, opt.outer] : [opt.inner, bandMid - 4];
			};
			nodes.push(
				<g key={`${opt.kind}-god-${i}`}>
					<path
						className="moira-hover-zone"
						d={annularSectorPath(opt.inner, opt.outer, endTheta, startTheta)}
						{...this.tooltipHandlers(palaceTip)}
					>
					</path>
					{gods.map((god, idx)=>{
						const gtheta = gods.length <= 1 ? theta : (start - idx * step);
						return (
							<g key={`${opt.kind}-god-${i}-${idx}`}>
								<path
									className="moira-hover-zone"
									d={annularSectorPath(bandFor(idx)[0], bandFor(idx)[1], gtheta - half, gtheta + half)}
									{...this.tooltipHandlers(`${kindLabel}·${guolaoShenShaTip(god)}`)}
								>
								</path>
								{radialStackText(god, gtheta, bandFor(idx)[0], bandFor(idx)[1], {
									size: godSize,
									color: opt.color || GREEN,
									weight: opt.weight || 600,
									opacity: opt.opacity,
								})}
							</g>
						);
					})}
				</g>
			);
		}
		return <g className={`moira-star-table-layer moira-star-table-layer-${opt.kind}`}>{nodes}</g>;
	}

	renderStarTables(root, chart, transitRoot, transitChart){
		const showBirth = this.props.showBirthGods !== false;
		const showTransit = this.props.showMoiraTransitGods !== false && this.props.showAspectsMode !== true;
		// Moira 口径(full_ring_pos 键位):本命神煞=外圈 [r9,r10],流年神煞=内圈 [r8,r9];
		// 单盘(half)时流年圈关闭,本命神煞占 [r8,r10] 双带(half 表 0.62-0.92,0.77 为层分界)。
		return (
			<g>
				{showTransit ? <circle className="moira-transit-god-split" r={rs('godsInner', 1)} fill="none" stroke={BLACK} strokeWidth="1.35" /> : null}
				{(!showTransit && this.props.showAspectsMode !== true) ? <circle className="moira-birth-god-split" r={(rs('godsInner', 0) + 14 + rs('godsOuter', 1) - 12) / 2} fill="none" stroke={BLACK} strokeWidth="0.6" strokeDasharray="3 4" opacity="0.5" /> : null}
				{showBirth ? this.renderGodRing(root, chart, {
					kind: 'birth',
					inner: (showTransit ? rs('godsOuter', 0) + 10 : rs('godsInner', 0) + 14),
					outer: rs('godsOuter', 1) - 12,
					order: BIRTH_GOD_ORDER,
					dualBand: !showTransit && this.props.showAspectsMode !== true,
					// aspects 六圆规格:神煞全部落同一同心圆,不分内外层(用户钦定)。
					singleBand: this.props.showAspectsMode === true,
				}) : null}
				{showTransit ? this.renderGodRing(transitRoot || root, transitChart || chart, {
					kind: 'transit',
					inner: rs('godsInner', 0) + 14,
					outer: rs('godsInner', 1) - 8,
					order: TRANSIT_GOD_ORDER,
					color: BLUE,
					opacity: transitChart ? 1 : 0.72,
				}) : null}
			</g>
		);
	}

	renderLimitRing(root, chart, fields){
		const life = lifeDegree(chart, fields);
		const nodes = [];
		// birthFrac(年界基准)+ 定童限 base(9/10)——与 renderDegreeTicks 同口径,保证刻度/年份/当前岁一致。
		// 年号 = 公历出生年 + 岁次偏移(立春前生人 −1 / 冬至后生人 +1;元旦界恒 0)。
		const limitChildBase = Number(this.props.limitChildBase) === 10 ? 10 : 9;
		const limitBasis = birthYearBasis(chart, fields, this.props.limitYearBoundary || 'gregorian');
		const limitBirthFrac = limitBasis.frac;
		const birthYear = birthYearFrom(root, chart, fields) + limitBasis.yearShift;
		// 立命年份大字标(旧 key:'birth',fontSize 24)已撤:它压在立命位,与岁数带(…105/106/1/2…环绕)+ 命度红线
		// 三者堆叠成一坨(用户点名「乱糟糟」)。立命位已由命度红线明示,不再另标高亮当年年份;仅保留各宫界年份小字标。
		const yearMarks = [];
		for(let sign = 0; sign < 12; sign++){
			const degree = sign * 30;
			const offset = limitOffsetFromLife(life, degree);
			// offset≈0 = 命宫整宫界(出生线/1岁起) → 该处年份=出生年(如 2006),用户钦定必须显示,勿跳;
				// 仅跳 offset>357(紧贴出生线另一侧的末宫界,年份已超可见岁数,避免与出生年标重叠)。
				if(offset > 357){
				continue;
			}
			yearMarks.push({
				degree,
				year: limitYearForDegree(birthYear, life, degree, limitBirthFrac, limitChildBase),
				key: `boundary-${sign}`,
			});
		}
		yearMarks.sort((a, b)=>limitOffsetFromLife(life, a.degree) - limitOffsetFromLife(life, b.degree));
			// 年份标注:圆10 以外只留年份文字(先天宫位分割线在圆9 以外一律不画,用户钦定);
			// 文字贴紧圆10 外侧、向心显示(与最外度数同姿态)。
			yearMarks.forEach((mark)=>{
				const degree = norm(mark.degree);
				const theta = moiraThetaFromDegree(degree);
				const pYear = point(r(11) + 16, theta);
				nodes.push(
					<g key={`year-${mark.key}`} {...this.tooltipHandlers(mark.key === 'birth' ? `立命年份：${mark.year}（1 岁起）` : `宫界年份：${mark.year} 岁次入宫`)}>
						<text
							x={pYear.x}
							y={pYear.y}
							fill={BLACK}
							fontSize={mark.key === 'birth' ? 24 : 21}
							fontWeight={mark.key === 'birth' ? 600 : 400}
							textAnchor="middle"
							dominantBaseline="central"
							transform={`rotate(${theta + 90} ${pYear.x} ${pYear.y})`}
						>
							{mark.year}
						</text>
					</g>
				);
			});
			// 🔴 照 Moira:大限环只画 出生线(命度) + 宿界红线 + 岁数短刻度 + 当前岁数红线;
			// **不画 12 整宫界线**(用户点名:除宿度红线/命度/当前岁数红线外不得有其它十二宫位分割线)。上一轮误加的宫界线已移除。
			// 28 宿界红线(当前宿度制同源=盘面宿环同一套 stars):画满岁数带整带高。
			// full 画 r10-r11;aspects 同带(r10/r11 已钉 0.92/0.95,用户点名加回)。
			buildFixedStars(chart).forEach((star, idx)=>{
				const theta = moiraThetaFromDegree(star.ra);
				nodes.push(
					<g key={`limit-xiu-${idx}`}>
						{radialLine(theta, r(10), r(11), {color: RED, width: 1})}
					</g>
				);
			});
			if(this.props.showAgeRing !== false){
				// 岁数分割线:与最外侧圆圈同粗(1.35)的不透明黑线,画在每岁 cell 起界
				// (=limitDegreeForAge(age),即 age-1-birthFrac 的度)。用户钦定:**不贯穿、不挨内圆**——
				// 内侧空一节(照 Moira drawLine(year_mid → year_upper) 半带口径),只在岁数带外侧约 6 成成线。
				// break 口径与岁数字循环(renderDegreeTicks 用 age+0.5)**统一**——否则线比数字多画一格(末格有线无字)。
				const ageLineInner = r(10) + (r(11) - r(10)) * 0.4;
				for(let age = 1; age <= 130; age++){
					// cell 起界 offset(与数字循环同口径):1 岁=锚点(0,命宫整宫界=一条十二宫分割线),
					// ≥2 岁=该岁 cell 起界。break 用**起界**越锚点即止(与数字循环一致)→ 分割线与数字逐格对齐,
					// 且末段窄格的起界线也画出、由出生线闭合(修「末岁少画一节」)。
					const startOff = age === 1 ? 0 : limitAgeOffset(life, age, limitBirthFrac, limitChildBase);
					if(startOff >= 359.9){ break; }
					const major = age % 10 === 0;
					// 🔴 1 岁头=出生线:落在命宫整宫界(anchor),贯满整带(照 Moira drawLine(i==0) year_pos→year_upper);
					// 逐岁刻度 year_mid→year_upper(内缩半带)。起界线位置 = norm(anchor − startOff)。
					const isBirthLine = age === 1;
					const theta = moiraThetaFromDegree(norm(limitAnchor(life) - startOff));
					nodes.push(
						<g key={`limit-age-line-${age}`}>
							{radialLine(theta, isBirthLine ? r(10) : ageLineInner, r(11), {
								color: BLACK,
								width: (major || isBirthLine) ? 1.7 : 1.35,
								opacity: 1,
							})}
						</g>
					);
				}
			}
// 流年岁次年号与出生岁次同一年界基准(立春前 −1 / 冬至后 +1),虚岁 = 流年岁次 − 出生岁次 + 1。
const transitShift = this.props.transitParams && this.props.transitParams.date
	? birthYearBasis({ params: this.props.transitParams }, null, this.props.limitYearBoundary || 'gregorian').yearShift : 0;
const curAge = (this.props.transitParams && this.props.transitParams.date ? birthYearFrom({params: this.props.transitParams}, null, null) + transitShift : birthYear) - birthYear + 1;
			if(this.props.showAgeRing !== false && this.props.showAspectsMode !== true && curAge >= 1 && curAge <= 130){
				// 🔴 流年岁数标记(用户钦定):不再用红色径向线(会和命度红线混淆),改成
				// **占该岁 cell 内侧(下侧)整条弧**的蓝色弧带——从 cell 起界到止界、贴岁数带内圈。
				const curStartDeg = curAge === 1
					? limitAnchor(life)
					: limitDegreeForAge(life, curAge, limitBirthFrac, limitChildBase);
				const curEndDeg = limitDegreeForAge(life, curAge + 1, limitBirthFrac, limitChildBase);
				const curThStart = moiraThetaFromDegree(curStartDeg);
				// 🔴 归一到**最短弧**:cell 恒窄,但 moiraThetaFromDegree(30−deg) 不归一,cell 若跨 0°/360°
				// 边界时 curThEnd−curThStart 会 >180 → annularSectorPath 的 largeArc 画成整圈补集
				// (「一圈都是黑条只有选中的不是」的病根,刚好画反)。归一差值到 (−180,180] 即修。
				const curThEndRaw = moiraThetaFromDegree(curEndDeg);
				const curThEnd = curThStart + ((((curThEndRaw - curThStart) % 360) + 540) % 360 - 180);
				const curP = point((r(10) + r(11)) / 2, (curThStart + curThEnd) / 2);
				nodes.push(
					<g key="limit-cur-age" {...this.tooltipHandlers(`流年 ${curAge} 岁（流年时刻推算）`)}>
						<circle className="moira-hover-zone" cx={curP.x} cy={curP.y} r={14} />
						{/* 流年黑条(蓝弧)细一点(用户钦定):贴内圈画约 2px 薄弧,不再是粗带。 */}
						<path d={annularSectorPath(r(10) + 1, r(10) + 3, curThStart, curThEnd)} fill={BLUE} stroke="none" />
					</g>
				);
			}
			return <g className="moira-limit-layer">{nodes}</g>;
		}

	// 四角标注(对照 Moira 桌面版):左下=时刻/真太阳/阴历/经纬/四柱/流年;右下=制式/算法/日月出没。
	// 取数与右栏「概览」tab 同源(GuoLaoWheelCaptions 同键),空行自动上提不留档。
	renderSideText(root, chart, fields){
		const birthYear = birthYearFrom(root, chart, fields);
		const transitYear = this.props.transitParams && this.props.transitParams.date
			? birthYearFrom({params: this.props.transitParams}, null, null) : birthYear;
		const params = root && root.params ? root.params : {};
		const transitParams = this.props.transitParams || {};
		const bazi = (root && root.nongli && root.nongli.bazi) || (chart && chart.nongli && chart.nongli.bazi) || {};
		// 四柱结构为 {stem:{cell},branch:{cell}}（非 .text）——与右栏 baziText 同源；逐柱拼干支。
		const pillar = (col)=>{
			if(!col){ return ''; }
			if(col.text){ return col.text; }
			const stem = col.stem && col.stem.cell ? col.stem.cell : '';
			const branch = col.branch && col.branch.cell ? col.branch.cell : '';
			return `${stem}${branch}`;
		};
		const y = pillar(bazi.year) || stemBranchForYear(birthYear);
		const m = pillar(bazi.month);
		const d = pillar(bazi.day);
		const h = pillar(bazi.time);
		const apparent = apparentSolarText(root, chart);
		const lunar = lunarText(root, chart);
		const su28Label = su28ModeCaption(params, fields);
		// 公历行:params 缺失时退回左栏 fields(DateTime),与盘面输入恒一致
		const fmtField = (key, fmt)=>(fields && fields[key] && fields[key].value && fields[key].value.format ? fields[key].value.format(fmt) : '');
		const dateLine = (params.date || params.time)
			? `${params.date || ''} ${params.time || ''}`.trim()
			: `${fmtField('date', 'YYYY/MM/DD')} ${fmtField('time', 'HH:mm:ss')}`.trim();
		const leftLines = [
			dateLine,
			apparent ? `真太阳时：${apparent}` : '',
			lunar ? `阴历：${lunar}` : '',
			geoCaption(params),
			`四柱：${[y, m, d, h].filter(Boolean).join(' ')}`,
			`流年：${transitYear} ${stemBranchForYear(transitYear)}`,
			transitParams.date ? `流年时间：${transitParams.date} ${transitParams.time || ''}` : '',
		];
		const rightLines = [
			su28Label ? `静盘：${su28Label}` : '',
			computationMethodCaption(),
			...riseSetLines(root),
			'七政四余 · Moira 风',
		];
		return (
			<g className="moira-side-text" opacity="0.96">
				{cornerTextBlock({ x: -(VIEW / 2 - 20), y: VIEW / 2 - 152, anchor: 'start', lines: leftLines, size: 17, gap: 22, color: BLACK })}
				{cornerTextBlock({ x: VIEW / 2 - 20, y: VIEW / 2 - 130, anchor: 'end', lines: rightLines, size: 17, gap: 22, color: BLACK })}
			</g>
		);
	}

	renderTooltip(){
		const tooltip = this.state.tooltip;
		if(!tooltip){
			return null;
		}
		// portal 挂 body(照 IndiaChartMain renderDashaFloatingPopover):中栏容器的 container-type/overflow
		// 会把 position:fixed 的包含块重锚进中栏并新建 stacking context → 被右栏压层+裁剪;
		// 单抬 z-index 无效,必须让浮层脱离该容器。坐标本就是 clientX/clientY 视口系,portal 后口径不变。
		if(typeof document === 'undefined' || !document.body){
			return null;
		}
		return createPortal(
			<div
				className="horosa-guolao-moira-tooltip"
				style={{
					left: tooltip.x,
					top: tooltip.y,
				}}
			>
				{tooltip.text}
			</div>,
			document.body
		);
	}

	render(){
		const root = this.props.rootValue || {};
		const rawChart = this.props.value || root.chart || {};
		const chart = root.params ? {...rawChart, params: root.params} : rawChart;
		const transitRoot = this.props.transitValue || {};
		const transitChart = transitRoot.chart ? (transitRoot.params ? {...transitRoot.chart, params: transitRoot.params} : transitRoot.chart) : null;
		const height = this.props.height || 740;
		const side = this.state.containerSide || Math.min(height, 740);
		// 动态环布局:按当前显示开关重算 13 边界(隐藏环折叠、余环铺满);r(idx) 全程读此布局
		// Moira 三基准(照其 prefix 切表):显示相位=aspects(中心 0.38R 相位网腔),
		// 流年圈开=full_ring_pos(双盘),关=half_ring_pos(单盘,内圈重排+神煞双带)。
		const moiraMode = this.props.showAspectsMode === true ? 'aspects' : (this.props.showMoiraTransitGods !== false ? 'full' : 'half');
		setActiveLayout(moiraMode, computeRingPositions({
			birthGods: this.props.showBirthGods !== false,
			transitGods: this.props.showMoiraTransitGods !== false,
			ageRing: this.props.showAgeRing !== false,
		}, moiraMode));
		return (
			<div className="horosa-guolao-moira-wheel" style={{height}} ref={this.containerRef}>
				<svg
					style={{width: side, height: side}}
					viewBox={`${-VIEW / 2} ${-VIEW / 2} ${VIEW} ${VIEW}`}
					role="img"
					aria-label="Moira风格七政星盘"
				>
					<rect x={-VIEW / 2} y={-VIEW / 2} width={VIEW} height={VIEW} fill={MOIRA_BG} stroke="none" />
					<g className="moira-pale-guides">
						{Array.from({length: 24}).map((_, idx)=>(
							<g key={`guide-${idx}`}>{radialLine(-15 * idx, r(GOD_RING_INNER), r(GOD_RING_OUTER), {color: PALE, width: 0.55, opacity: 0.18})}</g>
						))}
					</g>
					{this.renderRings()}
					{this.renderSectorLines()}
					{this.renderDegreeTicks(chart, this.props.fields)}
					{this.renderStellarTicks()}
					{this.renderStaticTwelve(root, chart, this.props.fields)}
					{this.renderStellarRing(chart)}
					{this.renderPlanetLayers(chart, transitChart)}
					{this.renderStarTables(root, chart, transitRoot, transitChart)}
					{this.props.showAgeRing !== false ? this.renderLimitRing(root, chart, this.props.fields) : null}
					{this.renderSideText(root, chart, this.props.fields)}
				</svg>
				{this.renderTooltip()}
			</div>
		);
	}
}

export default GuoLaoMoiraWheel;
