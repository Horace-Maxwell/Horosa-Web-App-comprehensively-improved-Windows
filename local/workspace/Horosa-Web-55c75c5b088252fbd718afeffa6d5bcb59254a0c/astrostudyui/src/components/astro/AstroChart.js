import * as d3 from 'd3';
import React, { Component } from 'react';
import {randomStr} from '../../utils/helper';
import * as AstroConst from '../../constants/AstroConst';
import * as Constants from '../../utils/constants';
import { chartDrawGuardEnabled, chartSCUEnabled } from '../../utils/perfFlags';
import { watchChartSvgResize } from '../../utils/chartDrawGuard';
import { sameDisplayList, shallowPropsEqual } from '../../utils/chartUpdateGuard';
import AstroChartCircle from './AstroChartCircle';
import AstroWheelArtChart from './AstroWheelArtChart';

// sCU(根因 E):本组件 render 输出 + drawChart/AstroChartCircle 消费的「全部影响盘面输出的 props」。
// 逐项核(grep this.props.* 全集 = 12 项,见 drawChart 转发与 render):
//   value          → drawChart 的 chartObj(盘数据,大对象引用比:后端每次新对象捕获任意字段变更)
//   chartDisplay   → drawChart 的 disp(显示项数组,内容比)
//   planetDisplay  → planetDisp 集来源(数组,内容比)
//   lotsDisplay    → planetDisp 集来源(数组,内容比)
//   keyPlanets     → drawChart 的 keyplanets(数组,内容比)
//   chartStyle     → drawChart 末参(标量/字符串,Object.is)
//   zrHighlightSign→ chartCircle.setZRHighlight(标量,Object.is)
//   showAstroMeaning→ getShowAstroMeaning→setShowAstroMeaning(标量;localStorage 回退由 GlobalSetup
//                     写入后另路重绘,不在本组件 props 流内,故按 prop 值比即可)
//   width / height / style / id → render 出的 <svg> 尺寸/内联样式/id(影响容器,进而影响 draw 的 clientW/H)
// AstroChartCircle 不读任何 this.props(纯类,drawChart 全量入参 + 两 setter),故上列即闭包,无隐藏输入。
const ASTROCHART_SCU_KEYS = [
	'value', 'chartDisplay', 'planetDisplay', 'lotsDisplay', 'keyPlanets', 'aspects',
	'chartStyle', 'zrHighlightSign', 'showAstroMeaning', 'width', 'height', 'style', 'id',
	// 盘面美术:非 classic 时 render 整体切到方形覆盘组件 → 改档必须触发重渲染,漏登=死开关。
	'wheelArt',
	// 卜卦判读叠层(二期):描述对象经 horaryOverlayData 单槽 memo,同盘同设置=同引用 → Object.is 即可;
	// 占星页恒 undefined,零行为变化。
	'horaryOverlay',
	// 世俗盘流派渲染白名单(纯前端隐 glyph/相位线):古典派中盘不绘外行星;
	// 不传=undefined → 渲染路径与既有逐字节一致(仅世俗盘提供)。
	'hideBodies',
];
const ASTROCHART_SCU_COMPARATORS = {
	chartDisplay: sameDisplayList,
	planetDisplay: sameDisplayList,
	lotsDisplay: sameDisplayList,
	keyPlanets: sameDisplayList,
	aspects: sameDisplayList,   // 相位选择(AspSelector)是数组字面量,父级每次新引用 → 内容比;变更须重渲触发 drawChart 重画相位线
	hideBodies: sameDisplayList,
};
// state 中唯一进入 render/draw 的可变量是 ox/oy/radius(resize 时由 clientW/H 派生重算)——
// 必须纳入 sCU,否则 resize setState(props 不变)会被跳过 → 盘不跟着重排。
// chartid/tooltipId/rStep 挂载后恒定;tips(tooltip 点击)从不被 render/draw 读取 → 不纳入 → 其 setState 被正确跳过。
const ASTROCHART_SCU_STATE_KEYS = ['ox', 'oy', 'radius'];

class AstroChart extends Component{

	constructor(props) {
		super(props);
		let svgid = this.props.id ? 'svg' + this.props.id : 'svg' + randomStr(8);

		this.state = {
			chartid: svgid,
			rStep: 30,
			ox: 0,
			oy: 0,
			radius: 0,
			tooltipId: 'div' + randomStr(8),
			tips: null,
		}

		this.chartCircle = null;
		this.redrawTimer = null;

		this.drawChart = this.drawChart.bind(this);
		this.handleResize = this.handleResize.bind(this);
		this.onTipClick = this.onTipClick.bind(this);
		this.scheduleDrawRetry = this.scheduleDrawRetry.bind(this);
		this.getShowAstroMeaning = this.getShowAstroMeaning.bind(this);
	}

	onTipClick(tipobj){
		this.setState({
			tips: tipobj,
		});
	}

	handleResize(){
		let svgdom = document.getElementById(this.state.chartid);
		if(svgdom === undefined || svgdom === null){
			return;
		}
		let w = svgdom.clientWidth;
		let h = svgdom.clientHeight;
		if(h < 560 || w < 560){
			return;
		}
	
		let orgx = w / 2;
		let orgy = h / 2;
		let delta = 30;
		let chartR = Math.min(w, h) / 2 - delta;
		this.setState({
			ox: orgx,
			oy: orgy,
			radius: chartR,
		});
	}

	// 重绘签名守卫(流畅度):本组件 componentDidUpdate 无条件 drawChart+scheduleDrawRetry,
	// 任何无关 state/props 变化(开关 drawer、tooltip 点击、120ms retry)都触发整树 d3 重建。
	// 签名 = 绘制实际消费的全部输入(数据引用 + 显示设置 + 容器尺寸):全等 → skip。
	// 不用 chartObj.chartId(每次 fetch 都换新值,同数据不同 id),用引用相等(dva state 不变更新引用稳定)。
	buildDrawSignature(chartobj){
		const svgdom = document.getElementById(this.state.chartid);
		return {
			value: chartobj,
			chartDisplay: this.props.chartDisplay,
			planetDisplay: this.props.planetDisplay,
			lotsDisplay: this.props.lotsDisplay,
			keyPlanets: this.props.keyPlanets,
			horaryOverlay: this.props.horaryOverlay,   // memo 稳引用,引用比;undefined(占星页)恒等
			hideBodies: this.props.hideBodies,         // 世俗盘流派渲染白名单;undefined 恒等
			chartStyle: this.props.chartStyle,
			// 盘面美术纳入签名:方盘期 svg 被卸载、d3 内容随之销毁,切回 classic 时若签名不含此维度,
			// 守卫会误判「输入未变」跳过重画 → 白屏(2026-08-09 世俗盘实报)。方盘早退分支另清签名双保险。
			wheelArt: this.props.wheelArt,
			// 相位选择纳入签名:desposeAspects 按 AstroConst.AspKey(localStorage)过滤相位线,该选择不在任何 props 数据对象内,
			// 不纳入则切相位时签名恒等 → 守卫误判跳过、相位线不重画(死选项)。取 localStorage 同源,与实际绘制依据一致。
			aspKey: (typeof window !== 'undefined' && window.localStorage) ? (window.localStorage.getItem(AstroConst.AspKey) || '') : '',
			zrHl: this.props.zrHighlightSign || '',
			meaning: this.getShowAstroMeaning(),
			rStep: this.state.rStep,
			// 主题纳入签名:黄道带 fill-opacity 等按当前调色板(AstroConst.AstroColor)在绘制时一次性烘焙进 SVG。
			// 真根因是「调色板滞后一帧」:setColorTheme 在 app.js(新 resolvedAppearance)与 index.js(读 model
			// 的 resolvedAppearance,滞后一帧)各调一次,index 用旧值覆写;故仅看 <html data-horosa-appearance>
			// 不够——属性已 settle 但调色板尚未刷新到位的「正确重绘」会被守卫误判相同而 skip,黄道环停在旧主题。
			// 解法:签名直接纳入调色板指纹(ChartBackgroud),调色板真正切换到位的那次重绘必不被跳过。
			appearance: (typeof document !== 'undefined' && document.documentElement) ? document.documentElement.getAttribute('data-horosa-appearance') : '',
			themeFill: (AstroConst.AstroColor && AstroConst.AstroColor.ChartBackgroud) || '',
			w: svgdom ? svgdom.clientWidth : 0,
			h: svgdom ? svgdom.clientHeight : 0,
		};
	}

	sameDrawSignature(a, b){
		if(!a || !b){
			return false;
		}
		// 根因 G:chartDisplay/planetDisplay/lotsDisplay/keyPlanets 父级常每次传新数组字面量(引用恒变),
		// 旧版用引用比 → 签名恒变 → 守卫形同虚设、drawChart 每次全量重建。改内容比让守卫真短路;
		// value/chartStyle 等仍保持引用/===(大对象引用比既完整又廉价,标量直接相等)。
		return a.value === b.value
			&& sameDisplayList(a.chartDisplay, b.chartDisplay)
			&& sameDisplayList(a.planetDisplay, b.planetDisplay)
			&& sameDisplayList(a.lotsDisplay, b.lotsDisplay)
			&& sameDisplayList(a.keyPlanets, b.keyPlanets)
			&& a.horaryOverlay === b.horaryOverlay
			&& sameDisplayList(a.hideBodies, b.hideBodies)
			&& a.chartStyle === b.chartStyle
			&& a.wheelArt === b.wheelArt
			&& a.aspKey === b.aspKey
			&& a.zrHl === b.zrHl
			&& a.meaning === b.meaning
			&& a.appearance === b.appearance
			&& a.themeFill === b.themeFill
			&& a.rStep === b.rStep
			&& a.w === b.w
			&& a.h === b.h;
	}

	drawChart(){
		// 方形覆盘期无 <svg> 宿主(render 已切走),d3 管线整体休眠;切回 classic 时 svg 重挂,DidUpdate 自然重画。
		// 🔴 必须同时清重绘签名:svg 是新空节点,旧签名残留会让守卫误判「画过」跳过重画 → 切回白屏。
		if(AstroConst.normalizeWheelArt(this.props.wheelArt) !== AstroConst.WHEEL_ART_CLASSIC){
			this._lastDrawnSig = null;
			return;
		}
		let chartobj = this.props.value;
		if(chartobj === undefined || chartobj === null ||
			chartobj.chart === undefined || chartobj.chart === null || chartobj.err){
			return;
		}

		const guardOn = chartDrawGuardEnabled();
		const sig = guardOn ? this.buildDrawSignature(chartobj) : null;
		if(guardOn && this.sameDrawSignature(sig, this._lastDrawnSig)){
			return; // 输入未变,跳过全量 d3 重建(零尺寸时签名从不被记录,retry 轮询不受影响)
		}

		let disp = [];
		if(this.props.chartDisplay !== undefined && this.props.chartDisplay !== null){
			disp = this.props.chartDisplay;
		}
		// 【漏传≠全空盘】漏传(undefined/null)回落默认集;空数组=有意全隐藏,不回落。
		// 同款治本见 AstroDoubleChart(2026-07-12 实案:推运 TabPane 漏传 → 有框架无星体)。
		let planetSrc = this.props.planetDisplay;
		if(planetSrc === undefined || planetSrc === null){
			planetSrc = AstroConst.DEFAULT_OBJECTS;
		}
		let lotsSrc = this.props.lotsDisplay;
		if(lotsSrc === undefined || lotsSrc === null){
			lotsSrc = AstroConst.DEFAULT_LOTS;
		}
		let planetDisp = new Set();
		for(let i=0; i<planetSrc.length; i++){
			planetDisp.add(planetSrc[i]);
		}
		for(let i=0; i<lotsSrc.length; i++){
			planetDisp.add(lotsSrc[i]);
		}
		// 世俗盘流派渲染白名单:古典/中世纪派剔除外行星 → glyph 与相位线同门槛齐隐
		// (AstroChartCircle 两者同吃本 Set);不传恒零剔除=既有渲染逐字节一致。
		if(Array.isArray(this.props.hideBodies)){
			for(let i=0; i<this.props.hideBodies.length; i++){
				planetDisp.delete(this.props.hideBodies[i]);
			}
		}

		let keyplanets = null;
		if(this.props.keyPlanets){
			keyplanets = this.props.keyPlanets;
		}

		let drawOk = false;
		if(this.chartCircle){
			this.chartCircle.setShowAstroMeaning(this.getShowAstroMeaning());
			if(this.chartCircle.setZRHighlight){ this.chartCircle.setZRHighlight(this.props.zrHighlightSign || null); }
			if(this.chartCircle.setHoraryOverlay){ this.chartCircle.setHoraryOverlay(this.props.horaryOverlay || null); }
			try{
				this.chartCircle.drawChart(this.state.chartid, chartobj, this.state.rStep, disp, planetDisp, keyplanets, this.props.chartStyle);
				drawOk = true;
			}catch(err){
				console.error('AstroChart draw failed', err);
			}
		}

		let svgdom = document.getElementById(this.state.chartid);
		if(svgdom && (svgdom.clientWidth === 0 || svgdom.clientHeight === 0)){
			this.scheduleDrawRetry();
		}else if(sig && drawOk){
			// 仅「非零尺寸成功绘制」后记录签名:隐藏期 retry 轮询、tab 变可见首画、resize 重画
			// 三条现状机制全部保留(零尺寸/绘制失败时签名不记录,下次必重画)。
			this._lastDrawnSig = sig;
		}
	}

	getShowAstroMeaning(){
		if(this.props.showAstroMeaning !== undefined && this.props.showAstroMeaning !== null){
			return this.props.showAstroMeaning === 1 || this.props.showAstroMeaning === true;
		}
		try{
			const json = localStorage.getItem(Constants.GlobalSetupKey);
			if(!json){
				return false;
			}
			const cfg = JSON.parse(json);
			return cfg && (cfg.showAstroMeaning === 1 || cfg.showAstroMeaning === true);
		}catch(e){
			return false;
		}
	}

	scheduleDrawRetry(){
		if(this.redrawTimer){
			clearTimeout(this.redrawTimer);
		}
		this.redrawTimer = setTimeout(()=>{
			this.drawChart();
		}, 120);
	}

	componentDidMount(){
		window.addEventListener('resize', this.handleResize)
		d3.select('body').append('div').attr('id', this.state.tooltipId);

		let option = {
			divTooltip: d3.select('#' + this.state.tooltipId),
			onTipClick: this.onTipClick,
		};
		this.chartCircle = new AstroChartCircle(option);
		this.chartCircle.setShowAstroMeaning(this.getShowAstroMeaning());

		this.drawChart();
		this.scheduleDrawRetry();

		// 主题切换(亮↔暗)只改 <html data-horosa-appearance>;本组件未订阅 appearanceMode、componentDidUpdate 不触发,
		// 而黄道带等颜色/透明度在绘制时一次性读取烘焙 → 不重绘则停在旧主题。挂 observer 主动重绘(签名已含 appearance 故真重画)。
		if(typeof MutationObserver !== 'undefined' && typeof document !== 'undefined' && document.documentElement){
			this._appearanceObserver = new MutationObserver(()=>{ this.drawChart(); });
			this._appearanceObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-horosa-appearance'] });
		}
		// 隐藏容器(tab 未选中,svg 0×0)期间数据更新时绘制被尺寸早退吞掉,切回 tab 无 React 更新
		// 可触发重画 → 表新盘旧;svg 尺寸变化(含 0→非0)时补一次 drawChart(签名守卫防重画风暴)。
		this._detachSvgResize = watchChartSvgResize(this.state.chartid, this.drawChart);
		this._observedSvg = document.getElementById(this.state.chartid);
	}

	// 方盘期 React 替换掉 <svg> 节点,旧 ResizeObserver 观察的是已 detach 的节点(永不触发);
	// 切回 classic 后 svg 是新节点 → 必须重挂 observer,否则「隐藏 tab 变可见补画」只剩 120ms retry 兜底。
	ensureSvgResizeWatcher(){
		const svgdom = document.getElementById(this.state.chartid);
		if(svgdom && svgdom !== this._observedSvg){
			if(this._detachSvgResize){ this._detachSvgResize(); }
			this._detachSvgResize = watchChartSvgResize(this.state.chartid, this.drawChart);
			this._observedSvg = svgdom;
		}
	}

	shouldComponentUpdate(nextProps, nextState){
		if(!chartSCUEnabled()){
			return true; // kill-switch:回到无条件渲染的旧行为
		}
		// 影响盘面输出的 props 全部相等(显示数组内容比、其余引用/===)且 resize 派生 state 相等 → 跳过冗余 re-render。
		// 任一变化 → true 照常 componentDidUpdate → drawChart(其内部再过重绘签名守卫,双层零漏渲)。
		const propsSame = shallowPropsEqual(this.props, nextProps, ASTROCHART_SCU_KEYS, ASTROCHART_SCU_COMPARATORS);
		const stateSame = shallowPropsEqual(this.state, nextState, ASTROCHART_SCU_STATE_KEYS);
		return !(propsSame && stateSame);
	}

	componentDidUpdate(){
		this.ensureSvgResizeWatcher();
		this.drawChart();
		this.scheduleDrawRetry();
	}

	componentWillUnmount() {
		window.removeEventListener('resize', this.handleResize)
		if(this.redrawTimer){
			clearTimeout(this.redrawTimer);
			this.redrawTimer = null;
		}
		if(this._appearanceObserver){
			this._appearanceObserver.disconnect();
			this._appearanceObserver = null;
		}
		if(this._detachSvgResize){ this._detachSvgResize(); this._detachSvgResize = null; }
		d3.select('#' + this.state.tooltipId).remove();
	}

	render(){
		// 盘面美术分叉:非 classic → 方形覆盘组件(希腊/中世纪/北印/南印),classic → 既有 d3 圆盘管线零字节不动。
		const wheelArt = AstroConst.normalizeWheelArt(this.props.wheelArt);
		if(wheelArt !== AstroConst.WHEEL_ART_CLASSIC){
			return (
				<AstroWheelArtChart
					value={this.props.value}
					wheelArt={wheelArt}
					planetDisplay={this.props.planetDisplay}
					lotsDisplay={this.props.lotsDisplay}
					height={this.props.height}
				/>
			);
		}
		let chartstyle = {
			width: this.props.width ? this.props.width : '100%',
			height: this.props.height ? this.props.height : '100%',
			backgroundColor: AstroConst.AstroColor.ChartBackgroud,
		};

		if(this.props.style){
			chartstyle = this.props.style;
		}

		return (
			<svg id={this.state.chartid} style={chartstyle}>
			</svg>
		)
	}
}

export default AstroChart;
