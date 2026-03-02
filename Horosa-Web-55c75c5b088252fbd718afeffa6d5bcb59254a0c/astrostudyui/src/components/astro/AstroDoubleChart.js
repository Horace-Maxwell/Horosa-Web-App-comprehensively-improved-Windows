import * as d3 from 'd3';
import { Component } from 'react';
import {randomStr} from '../../utils/helper';
import * as AstroHelper from './AstroHelper';
import * as AstroConst from '../../constants/AstroConst';

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
		}

		this.drawChart = this.drawChart.bind(this);
		this.handleResize = this.handleResize.bind(this);
		this.setupToolTip = this.setupToolTip.bind(this);

	}

	setupToolTip(){
		const divTooltip = d3.select('#' + this.state.tooltipId);
		divTooltip.style('opacity', 0)
			.style('position', 'absolute')
			.style('text-align', 'left')
			.style('vertical-align', 'middle')
			.style('width', '340px')
			.style('padding', '2px')
			.style('padding-left', '10px')
			.style('font', '13px sans-serif')
			.style('background', 'lightsteelblue')
			.style('border', '0px')
			.style('border-radius', '8px')
			.style('pointer-events', 'none');
		return divTooltip;
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
		const divTooltip = d3.select('#' + this.state.tooltipId);
		AstroHelper.drawDoubleChart(this.state.chartid, chartobj, this.state.rStep, chartDisplay, planetDisp, divTooltip);
	}

	componentDidMount(){
		window.addEventListener('resize', this.handleResize);
		d3.select('body').append('div').attr('id', this.state.tooltipId);
		this.setupToolTip();
		this.drawChart();
	}

	componentDidUpdate(){
		this.drawChart();
	}

	componentWillUnmount() {
		window.removeEventListener('resize', this.handleResize);
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
