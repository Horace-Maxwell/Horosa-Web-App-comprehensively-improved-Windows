import * as d3 from 'd3';
import { Component } from 'react';
import {randomStr,} from '../../utils/helper';
import * as AstroConst from '../../constants/AstroConst';
import GZChart from './GZChart';
import { chartDrawGuardEnabled } from '../../utils/perfFlags';
import { buildChartDrawSig, sameChartDrawSig, chartDrawnAtNonZeroSize, watchChartSvgResize } from '../../utils/chartDrawGuard';

class GuaZhanChart extends Component{
	constructor(props) {
		super(props);
		let svgid = this.props.id ? 'svg' + this.props.id : 'svg' + randomStr(8);
		this.state = {
			chartid: svgid,
			ox: 0,
			oy: 0,
			radius: 0,
			tooltipId: 'div' + randomStr(8),
		};

		let opt = {
			id: svgid,
			fields: this.props.fields,
			tooltipId: this.state.tooltipId,
			yao: this.props.yao,
			chartObj: null,
			nongli: this.props.nongli,
		};
		this.gzchart = new GZChart(opt);

		this.drawChart = this.drawChart.bind(this);
		this.handleResize = this.handleResize.bind(this);
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

	drawChart(){
		let chartobj = this.props.value;
		if(chartobj === undefined || chartobj === null){
			return;
		}

		// 重绘签名守卫:render() 每次调 drawChart,输入(盘/fields/爻/农历/分析 引用 + 主题 + 尺寸)未变则跳过整树 d3 重建。
		const guardOn = chartDrawGuardEnabled();
		const sig = guardOn ? buildChartDrawSig(this.state.chartid, {
			value: chartobj,
			fields: this.props.fields,
			yao: this.props.yao,
			nongli: this.props.nongli,
			analysis: this.props.analysis,
		}) : null;
		if(guardOn && sameChartDrawSig(sig, this._lastDrawnSig)){
			return;
		}

		this.gzchart.fields = this.props.fields;
		this.gzchart.chart = chartobj;
		this.gzchart.yao = this.props.yao;
		this.gzchart.nongli = this.props.nongli;
		this.gzchart.analysis = this.props.analysis;

		this.gzchart.draw();

		if(sig && chartDrawnAtNonZeroSize(this.state.chartid)){
			this._lastDrawnSig = sig;
		}
	}

	componentDidMount(){
		window.addEventListener('resize', this.handleResize)
		d3.select('body').append('div').attr('id', this.state.tooltipId);
		this.drawChart();
		// 隐藏容器(tab 未选中,svg 0×0)期间数据更新时绘制停旧画面,切回 tab 无 React 更新可触发
		// 重画 → 表新盘旧;svg 尺寸变化(含 0→非0)时补一次 drawChart(签名守卫防重画风暴)。
		this._detachSvgResize = watchChartSvgResize(this.state.chartid, this.drawChart);
	}

	componentWillUnmount() {
		window.removeEventListener('resize', this.handleResize)
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
			chartstyle = this.props.style;
		}

		this.drawChart();

		return (
			<svg id={this.state.chartid} style={chartstyle}>
			</svg>
		)
	}
}

export default GuaZhanChart;
