import * as d3 from 'd3';
import { buildChartDrawSig, sameChartDrawSig, chartDrawnAtNonZeroSize, watchChartSvgResize } from '../../utils/chartDrawGuard';
import { chartDrawGuardEnabled } from '../../utils/perfFlags';
import { Component } from 'react';
import {randomStr} from '../../utils/helper';
import * as AstroConst from '../../constants/AstroConst';
import * as Constants from '../../utils/constants';
import AstroChartCircle from './AstroChartCircle';

class AstroDoubleChart extends Component{

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
		};

		this.chartCircle = null;

		this.drawChart = this.drawChart.bind(this);
		this.handleResize = this.handleResize.bind(this);
		this.onTipClick = this.onTipClick.bind(this);
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

	drawChart(){
		let chartobj = this.props.value;
		if(chartobj === undefined || chartobj === null || 
			chartobj.natualChart === undefined || chartobj.natualChart === null ||
			chartobj.dirChart === undefined || chartobj.dirChart === null ||
			chartobj.natualChart.err || chartobj.dirChart.err){
			return;
		}
		// 重绘签名守卫(与 ZiWeiChart 同款):cDU 无条件 drawChart,父层无关 setState 也会
		// 穿透到这里整树 d3 重建。签名=draw 实际消费的全部 props 引用+主题+尺寸;全等→跳过。
		if(chartDrawGuardEnabled()){
			const sig = buildChartDrawSig(this.state.chartid, {
				value: this.props.value,
				chartDisplay: this.props.chartDisplay,
				planetDisplay: this.props.planetDisplay,
				lotsDisplay: this.props.lotsDisplay,
				showAstroMeaning: this.props.showAstroMeaning,
				termHighlight: this.props.termHighlight,
				width: this.props.width,
				height: this.props.height,
			});
			if(sameChartDrawSig(this._lastDrawSig, sig)){
				return;
			}
			this._pendingDrawSig = sig;
		}
		
		// 【漏传≠全空盘】planetDisplay/lotsDisplay 是显示白名单(desposeStars 按 has() 过滤)。
		// 调用方漏传(undefined/null)时回落默认集(与 models/app 初值同源),与下方 chartDisplay
		// 的 CHART_DEFAULTOPTS 回落同款语义;空数组([])是「有意全隐藏」,不回落。
		// 历史事故:推运 TabPane 漏传 planetDisplay → 双盘有框架无星体。
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
		let chartDisplay = this.props.chartDisplay;
		if(chartDisplay === undefined || chartDisplay === null){
			chartDisplay = AstroConst.CHART_DEFAULTOPTS;
		}
		if(this.chartCircle){
			this.chartCircle.setShowAstroMeaning(this.getShowAstroMeaning());
			this.chartCircle.drawDoubleChart(
				this.state.chartid,
				chartobj,
				this.state.rStep,
				chartDisplay,
				planetDisp,
				this.props.termHighlight
			);
			// 仅「非零尺寸成功绘制」后记录签名:隐藏期(0×0)不记 → 变可见时尺寸变 → 必重画。
			if(this._pendingDrawSig && chartDrawnAtNonZeroSize(this.state.chartid)){
				this._lastDrawSig = this._pendingDrawSig;
				this._pendingDrawSig = null;
			}
		}
	}

	componentDidMount(){
		window.addEventListener('resize', this.handleResize);
		d3.select('body').append('div').attr('id', this.state.tooltipId);
		let option = {
			divTooltip: d3.select('#' + this.state.tooltipId),
			onTipClick: this.onTipClick,
		};
		this.chartCircle = new AstroChartCircle(option);
		this.chartCircle.setShowAstroMeaning(this.getShowAstroMeaning());
		this.drawChart();
		// 隐藏容器(tab 未选中,svg 0×0)期间数据更新时 drawDoubleChart 尺寸早退留旧画面,
		// 切回 tab 又无 React 更新可触发重画 → 表新盘旧;尺寸变化(含 0→非0)时补一次 drawChart。
		this._detachSvgResize = watchChartSvgResize(this.state.chartid, this.drawChart);
	}

	componentDidUpdate(){
		this.drawChart();
	}

	componentWillUnmount() {
		window.removeEventListener('resize', this.handleResize);
		if(this._detachSvgResize){ this._detachSvgResize(); this._detachSvgResize = null; }
		d3.select('#' + this.state.tooltipId).remove();
	}


	render(){
		let chartstyle = {
			width: this.props.width ? this.props.width : '100%',
			height: this.props.height ? this.props.height : '100%',
			backgroundColor: AstroConst.AstroColor.ChartBackgroud,
		};

		if(this.props.style){
			chartstyle = {
				...this.props.style,
				...chartstyle,
			};
		}

		return (
			<svg id={this.state.chartid} style={chartstyle}>
			</svg>
		)
	}
}

export default AstroDoubleChart;
