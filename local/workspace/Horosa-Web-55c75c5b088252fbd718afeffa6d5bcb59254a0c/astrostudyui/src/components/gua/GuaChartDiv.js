import * as d3 from 'd3';
import { Component } from 'react';
import { Row, Col, } from 'antd';
import {randomStr,} from '../../utils/helper';
import * as AstroConst from '../../constants/AstroConst';
import GuaChart from './GuaChart';
import { watchChartSvgResize } from '../../utils/chartDrawGuard';

export default class GuaChartDiv extends Component{
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
			tooltipId: this.state.tooltipId,
			chartObj: null,
		};
        this.chart = new GuaChart(opt);

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
		if(h < 0 || w < 0){
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
		
		this.chart.chart = chartobj;

		this.chart.draw();
	}

	componentDidMount(){
		window.addEventListener('resize', this.handleResize)
		d3.select('body').append('div').attr('id', this.state.tooltipId);
		// [Tahoe 订阅补齐] 容器尺寸变化(侧栏收合/缩放档切换/窗口事件断链引擎)也要重画:
		// RO 不依赖 window resize 事件链;GuaChart.draw 只读 clientWidth 不写 svg 尺寸,自观察无循环。
		this._svgWatchDetach = watchChartSvgResize(this.state.chartid, this.drawChart);
		this.drawChart();
	}

	componentWillUnmount() {
		window.removeEventListener('resize', this.handleResize)
		if(this._svgWatchDetach){ this._svgWatchDetach(); this._svgWatchDetach = null; }
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