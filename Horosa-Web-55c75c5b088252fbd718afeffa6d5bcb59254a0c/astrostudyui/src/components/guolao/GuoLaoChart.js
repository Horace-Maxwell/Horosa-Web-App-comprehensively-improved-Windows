import * as d3 from 'd3';
import { Component } from 'react';
import { Row, Col, Tabs, DatePicker, Input, Button, Card, Select } from 'antd';
import {randomStr,} from '../../utils/helper';
import * as AstroConst from '../../constants/AstroConst';
import GLChart from './GLChart';

class GuoLaoChart extends Component{
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

		this.glchart = new GLChart(svgid, null, this.props.fields, this.state.tooltipId, this.props.onTipClick);
		this.redrawTimer = null;

		this.drawChart = this.drawChart.bind(this);
		this.handleResize = this.handleResize.bind(this);
		this.scheduleDrawRetry = this.scheduleDrawRetry.bind(this);
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
		if(chartobj === undefined || chartobj === null 
			|| chartobj.fixedStarSu28 === undefined || chartobj.fixedStarSu28 === null){
			return;
		}

		let disp = [];
		if(this.props.chartDisplay !== undefined && this.props.chartDisplay !== null){
			disp = this.props.chartDisplay;
		}
		let flags = 0;
		for(let i=0; i<disp.length; i++){
			flags = flags + disp[i];
		}

		let planetDisp = new Set();
		if(this.props.planetDisplay !== undefined && this.props.planetDisplay !== null){
			for(let i=0; i<this.props.planetDisplay.length; i++){
				let id = this.props.planetDisplay[i];
				planetDisp.add(id);
			}
		}
		
		this.glchart.chartDisp = flags;
		this.glchart.planetDisp = planetDisp;
		this.glchart.fields = this.props.fields;
		this.glchart.chart = chartobj;

		try{
			this.glchart.draw();
		}catch(err){
			console.error('GuoLaoChart draw failed', err);
		}

		let svgdom = document.getElementById(this.state.chartid);
		if(svgdom && (svgdom.clientWidth === 0 || svgdom.clientHeight === 0)){
			this.scheduleDrawRetry();
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
		this.drawChart();
		this.scheduleDrawRetry();
	}

	componentDidUpdate(){
		this.drawChart();
		this.scheduleDrawRetry();
	}

	componentWillUnmount() {
		window.removeEventListener('resize', this.handleResize)
		d3.select('#' + this.state.tooltipId).remove();
		if(this.redrawTimer){
			clearTimeout(this.redrawTimer);
			this.redrawTimer = null;
		}
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

export default GuoLaoChart;
