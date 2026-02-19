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
		}

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
		AstroHelper.drawDoubleChart(this.state.chartid, chartobj, this.state.rStep, chartDisplay, planetDisp);
	}

	componentDidMount(){
		window.addEventListener('resize', this.handleResize);
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
