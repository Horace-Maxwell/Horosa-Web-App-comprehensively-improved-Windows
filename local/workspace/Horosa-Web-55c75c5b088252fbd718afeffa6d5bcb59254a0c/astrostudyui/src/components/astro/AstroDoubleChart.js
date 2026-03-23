import * as d3 from 'd3';
import { Component } from 'react';
import {randomStr} from '../../utils/helper';
import * as AstroConst from '../../constants/AstroConst';
import AstroChartCircle from './AstroChartCircle';
import { isMeaningEnabled } from './AstroMeaningPopover';

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
		this.redrawTimer = null;
		this.resizeObserver = null;
		this.drawRetryAttempts = 0;
		this.maxDrawRetryAttempts = 40;

		this.drawChart = this.drawChart.bind(this);
		this.handleResize = this.handleResize.bind(this);
		this.onTipClick = this.onTipClick.bind(this);
		this.getShowAstroMeaning = this.getShowAstroMeaning.bind(this);
		this.scheduleDrawRetry = this.scheduleDrawRetry.bind(this);
		this.observeChartResize = this.observeChartResize.bind(this);

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
		const propFlag = this.props.showAstroMeaning !== undefined && this.props.showAstroMeaning !== null
			? this.props.showAstroMeaning
			: this.props.showAstroAnnotation;
		return isMeaningEnabled(propFlag);
	}

	drawChart(){
		let chartobj = this.props.value;
		if(chartobj === undefined || chartobj === null || 
			chartobj.natualChart === undefined || chartobj.natualChart === null ||
			chartobj.dirChart === undefined || chartobj.dirChart === null ||
			chartobj.natualChart.err || chartobj.dirChart.err){
			return;
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
		}

		let svgdom = document.getElementById(this.state.chartid);
		if(svgdom && (svgdom.clientWidth === 0 || svgdom.clientHeight === 0)){
			this.scheduleDrawRetry();
		}else if(svgdom){
			this.drawRetryAttempts = 0;
		}
	}

	scheduleDrawRetry(reset = false){
		if(reset){
			this.drawRetryAttempts = 0;
		}
		if(this.redrawTimer){
			clearTimeout(this.redrawTimer);
		}
		if(this.drawRetryAttempts >= this.maxDrawRetryAttempts){
			return;
		}
		this.drawRetryAttempts += 1;
		this.redrawTimer = setTimeout(()=>{
			this.drawChart();
		}, 120);
	}

	observeChartResize(){
		let svgdom = document.getElementById(this.state.chartid);
		if(!svgdom || typeof ResizeObserver === 'undefined'){
			return;
		}
		this.resizeObserver = new ResizeObserver(()=>{
			this.drawChart();
			this.scheduleDrawRetry();
		});
		this.resizeObserver.observe(svgdom);
		if(svgdom.parentElement){
			this.resizeObserver.observe(svgdom.parentElement);
			if(svgdom.parentElement.parentElement){
				this.resizeObserver.observe(svgdom.parentElement.parentElement);
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
		this.observeChartResize();
		this.drawChart();
		this.scheduleDrawRetry(true);
	}

	componentDidUpdate(){
		this.drawChart();
		this.scheduleDrawRetry(true);
	}

	componentWillUnmount() {
		window.removeEventListener('resize', this.handleResize);
		if(this.redrawTimer){
			clearTimeout(this.redrawTimer);
			this.redrawTimer = null;
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
