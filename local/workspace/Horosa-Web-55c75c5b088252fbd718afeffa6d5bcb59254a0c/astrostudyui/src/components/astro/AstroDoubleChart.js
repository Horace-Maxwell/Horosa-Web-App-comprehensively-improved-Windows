import * as d3 from 'd3';
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
	}

	componentDidUpdate(){
		this.drawChart();
	}

	componentWillUnmount() {
		window.removeEventListener('resize', this.handleResize);
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
