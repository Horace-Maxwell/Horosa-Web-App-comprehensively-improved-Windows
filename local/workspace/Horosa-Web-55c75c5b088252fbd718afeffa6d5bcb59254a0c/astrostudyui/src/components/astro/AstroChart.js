import * as d3 from 'd3';
import { Component } from 'react';
import {randomStr} from '../../utils/helper';
import * as AstroConst from '../../constants/AstroConst';
import AstroChartCircle from './AstroChartCircle';

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
		this.shouldRedraw = this.shouldRedraw.bind(this);
	}

	areArraysEqual(arr1, arr2){
		if(arr1 === arr2){
			return true;
		}
		if(!Array.isArray(arr1) || !Array.isArray(arr2)){
			return false;
		}
		if(arr1.length !== arr2.length){
			return false;
		}
		for(let i=0; i<arr1.length; i++){
			if(arr1[i] !== arr2[i]){
				return false;
			}
		}
		return true;
	}

	areObjectsShallowEqual(obj1, obj2){
		if(obj1 === obj2){
			return true;
		}
		if(!obj1 || !obj2){
			return false;
		}
		let keys1 = Object.keys(obj1);
		let keys2 = Object.keys(obj2);
		if(keys1.length !== keys2.length){
			return false;
		}
		for(let i=0; i<keys1.length; i++){
			let key = keys1[i];
			if(obj1[key] !== obj2[key]){
				return false;
			}
		}
		return true;
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

		this.scheduleDrawRetry();
	}

	shouldRedraw(prevProps, prevState){
		if(prevState.chartid !== this.state.chartid){
			return true;
		}
		if(prevState.rStep !== this.state.rStep){
			return true;
		}
		if(prevProps.value !== this.props.value){
			return true;
		}
		if(prevProps.width !== this.props.width || prevProps.height !== this.props.height){
			return true;
		}
		if(!this.areObjectsShallowEqual(prevProps.style, this.props.style)){
			return true;
		}
		if(!this.areArraysEqual(prevProps.keyPlanets, this.props.keyPlanets)){
			return true;
		}
		if(!this.areArraysEqual(prevProps.chartDisplay, this.props.chartDisplay)){
			return true;
		}
		if(!this.areArraysEqual(prevProps.planetDisplay, this.props.planetDisplay)){
			return true;
		}
		if(!this.areArraysEqual(prevProps.lotsDisplay, this.props.lotsDisplay)){
			return true;
		}
		return false;
	}

	drawChart(){
		let chartobj = this.props.value;
		if(chartobj === undefined || chartobj === null || 
			chartobj.chart === undefined || chartobj.chart === null || chartobj.err){
			return;
		}
		
		let disp = [];
		if(this.props.chartDisplay !== undefined && this.props.chartDisplay !== null){
			disp = this.props.chartDisplay;
		}
		let planetDisp = new Set();
		if(this.props.planetDisplay !== undefined && this.props.planetDisplay !== null){
			for(let i=0; i<this.props.planetDisplay.length; i++){
				let id = this.props.planetDisplay[i];
				planetDisp.add(id);
			}
		}
		if(this.props.lotsDisplay !== undefined && this.props.lotsDisplay !== null){
			for(let i=0; i<this.props.lotsDisplay.length; i++){
				let id = this.props.lotsDisplay[i];
				planetDisp.add(id);
			}
		}

		let keyplanets = null;
		if(this.props.keyPlanets){
			keyplanets = this.props.keyPlanets;
		}

		if(this.chartCircle){
			try{
				this.chartCircle.drawChart(this.state.chartid, chartobj, this.state.rStep, disp, planetDisp, keyplanets);
			}catch(err){
				console.error('AstroChart draw failed', err);
			}
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

		let option = {
			divTooltip: d3.select('#' + this.state.tooltipId),
			onTipClick: this.onTipClick,
		};
		this.chartCircle = new AstroChartCircle(option);

		this.drawChart();
	}

	componentDidUpdate(prevProps, prevState){
		if(this.shouldRedraw(prevProps, prevState)){
			this.drawChart();
		}
	}

	componentWillUnmount() {
		window.removeEventListener('resize', this.handleResize)
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

export default AstroChart;
