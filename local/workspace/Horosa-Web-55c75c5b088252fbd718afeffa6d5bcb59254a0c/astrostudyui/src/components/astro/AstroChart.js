import * as d3 from 'd3';
import { Component } from 'react';
import {randomStr} from '../../utils/helper';
import * as AstroConst from '../../constants/AstroConst';
import AstroChartCircle from './AstroChartCircle';
import { isMeaningEnabled } from './AstroMeaningPopover';

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
		this.resizeObserver = null;
		this.resizeFrame = null;
		this.lastDrawSignature = null;
		this.lastDrawSize = null;

		this.drawChart = this.drawChart.bind(this);
		this.handleResize = this.handleResize.bind(this);
		this.onTipClick = this.onTipClick.bind(this);
		this.scheduleDrawRetry = this.scheduleDrawRetry.bind(this);
		this.observeChartResize = this.observeChartResize.bind(this);
		this.getShowAstroMeaning = this.getShowAstroMeaning.bind(this);
		this.buildDrawSignature = this.buildDrawSignature.bind(this);
	}

	onTipClick(tipobj){
		this.setState({
			tips: tipobj,
		});
	}

	handleResize(){
		this.scheduleDrawRetry();
	}

	getShowAstroMeaning(){
		const propFlag = this.props.showAstroMeaning !== undefined && this.props.showAstroMeaning !== null
			? this.props.showAstroMeaning
			: this.props.showAstroAnnotation;
		return isMeaningEnabled(propFlag);
	}

	buildDrawSignature(chartobj){
		return JSON.stringify({
			params: chartobj && chartobj.params ? chartobj.params : null,
			chartDisplay: this.props.chartDisplay || [],
			planetDisplay: this.props.planetDisplay || [],
			lotsDisplay: this.props.lotsDisplay || [],
			keyPlanets: this.props.keyPlanets || null,
			showAstroMeaning: this.getShowAstroMeaning(),
		});
	}

	drawChart(){
		let chartobj = this.props.value;
		if(chartobj === undefined || chartobj === null || 
			chartobj.chart === undefined || chartobj.chart === null || chartobj.err){
			return;
		}
		let svgdom = document.getElementById(this.state.chartid);
		if(!svgdom){
			return;
		}
		if(svgdom.clientWidth === 0 || svgdom.clientHeight === 0){
			this.scheduleDrawRetry();
			return;
		}
		const sizeSignature = `${svgdom.clientWidth}x${svgdom.clientHeight}`;
		const drawSignature = this.buildDrawSignature(chartobj);
		if(this.lastDrawSignature === drawSignature && this.lastDrawSize === sizeSignature){
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
				this.chartCircle.setShowAstroMeaning(this.getShowAstroMeaning());
				this.chartCircle.drawChart(this.state.chartid, chartobj, this.state.rStep, disp, planetDisp, keyplanets);
				this.lastDrawSignature = drawSignature;
				this.lastDrawSize = sizeSignature;
			}catch(err){
				console.error('AstroChart draw failed', err);
			}
		}
	}

	scheduleDrawRetry(){
		if(this.redrawTimer){
			clearTimeout(this.redrawTimer);
		}
		this.redrawTimer = setTimeout(()=>{
			this.redrawTimer = null;
			this.drawChart();
		}, 80);
	}

	observeChartResize(){
		let svgdom = document.getElementById(this.state.chartid);
		if(!svgdom || typeof ResizeObserver === 'undefined'){
			return;
		}
		this.resizeObserver = new ResizeObserver(()=>{
			if(this.resizeFrame){
				cancelAnimationFrame(this.resizeFrame);
			}
			this.resizeFrame = requestAnimationFrame(()=>{
				this.resizeFrame = null;
				this.drawChart();
			});
		});
		this.resizeObserver.observe(svgdom);
		if(svgdom.parentElement){
			this.resizeObserver.observe(svgdom.parentElement);
		}
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

		this.observeChartResize();
		this.drawChart();
	}

	componentDidUpdate(){
		this.drawChart();
	}

	componentWillUnmount() {
		window.removeEventListener('resize', this.handleResize)
		if(this.redrawTimer){
			clearTimeout(this.redrawTimer);
			this.redrawTimer = null;
		}
		if(this.resizeFrame){
			cancelAnimationFrame(this.resizeFrame);
			this.resizeFrame = null;
		}
		if(this.resizeObserver){
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
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
