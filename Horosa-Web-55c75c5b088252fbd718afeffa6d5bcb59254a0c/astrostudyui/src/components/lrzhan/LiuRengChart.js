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
			tooltipId: 'div' + randomStr(8),
		};
		this.unmounted = false;
		this.drawQueued = false;

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
		this.scheduleDraw = this.scheduleDraw.bind(this);
		this.handleResize = this.handleResize.bind(this);
	}

	handleResize(){
		if(this.unmounted){
			return;
		}
		this.scheduleDraw();
	}

	scheduleDraw(){
		if(this.drawQueued || this.unmounted){
			return;
		}
		this.drawQueued = true;
		const runner = ()=>{
			this.drawQueued = false;
			if(!this.unmounted){
				this.drawChart();
			}
		};
		if(typeof window !== 'undefined' && window.requestAnimationFrame){
			window.requestAnimationFrame(runner);
		}else{
			setTimeout(runner, 16);
		}
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
		this.unmounted = false;
		window.addEventListener('resize', this.handleResize)
		d3.select('body').append('div').attr('id', this.state.tooltipId);
		this.scheduleDraw();
	}

	componentDidUpdate(prevProps){
		if(
			prevProps.value !== this.props.value ||
			prevProps.fields !== this.props.fields ||
			prevProps.liureng !== this.props.liureng ||
			prevProps.runyear !== this.props.runyear ||
			prevProps.gender !== this.props.gender ||
			prevProps.zhangshengElem !== this.props.zhangshengElem ||
			prevProps.guireng !== this.props.guireng ||
			prevProps.width !== this.props.width ||
			prevProps.height !== this.props.height ||
			prevProps.style !== this.props.style
		){
			this.scheduleDraw();
		}
	}

	componentWillUnmount() {
		this.unmounted = true;
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

		return (
			<svg id={this.state.chartid} style={chartstyle}>
			</svg>
		)
	}
}

export default LiuRengChart;
