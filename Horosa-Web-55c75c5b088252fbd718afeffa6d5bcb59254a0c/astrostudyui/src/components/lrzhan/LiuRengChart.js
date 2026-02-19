import * as d3 from 'd3';
import { Component } from 'react';
import { Row, Col, Tabs, DatePicker, Input, Button, Card, Select } from 'antd';
import {randomStr,} from '../../utils/helper';
import * as AstroConst from '../../constants/AstroConst';
import RengChart from './RengChart';

class LiuRengChart extends Component{
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
			chartObj: null,
			nongli: this.props.nongli,
			liureng: this.props.liureng,
			runyear: this.props.runyear,
			gender: this.props.gender,
			zhangshengElem: this.props.zhangshengElem,
			guireng: this.props.guireng,
		};
		this.rengchart = new RengChart(opt);

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
		
		this.rengchart.fields = this.props.fields;
		this.rengchart.chart = chartobj;
		this.rengchart.nongli = chartobj.nongli;
		this.rengchart.liureng = this.props.liureng;
		this.rengchart.runyear = this.props.runyear;
		this.rengchart.zhangshengElem = this.props.zhangshengElem;
		this.rengchart.guireng = this.props.guireng;

		this.rengchart.draw();
	}

	componentDidMount(){
		window.addEventListener('resize', this.handleResize)
		d3.select('body').append('div').attr('id', this.state.tooltipId);
		this.drawChart();
	}

	componentWillUnmount() {
		window.removeEventListener('resize', this.handleResize)
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

export default LiuRengChart;

