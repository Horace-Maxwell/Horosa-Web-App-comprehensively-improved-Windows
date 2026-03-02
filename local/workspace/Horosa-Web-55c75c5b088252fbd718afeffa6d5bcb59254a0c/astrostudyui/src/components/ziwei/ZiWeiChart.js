import * as d3 from 'd3';
import { Component } from 'react';
import { Row, Col, Tabs, DatePicker, Input, Button, Card, Select } from 'antd';
import {randomStr,} from '../../utils/helper';
import * as AstroConst from '../../constants/AstroConst';
import ZWChart from './ZWChart';
import DateTime from '../comp/DateTime';

class ZiWeiChart extends Component{
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

		this.zwchart = new ZWChart(svgid, null, this.props.fields, this.state.tooltipId, this.props.onTipClick);

		this.drawChart = this.drawChart.bind(this);
		this.handleResize = this.handleResize.bind(this);
		this.setupToolTip = this.setupToolTip.bind(this);

		if(this.props.indicate){
			this.props.indicate(this.zwchart.zwindicator);
		}
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
			|| chartobj.houses === undefined || chartobj.houses === null){
			return;
		}
		
		this.zwchart.fileds = this.props.fields;
		this.zwchart.chart = chartobj;
		if(this.props.dirIndex !== undefined && this.props.dirIndex !== null){
			this.zwchart.dirHouseIndex = this.props.dirIndex;
		}else{
			let now = new DateTime();
			let y = now.format('YYYY');
			let year = parseInt(y);
			let birth = parseInt(chartobj.birth.substr(0,4));
			let age = year - birth;
			for(let i = 0; i<12; i++){
				let house = chartobj.houses[i];
				if(house.direction[0]<= age && age<=house.direction[1]){
					this.zwchart.dirHouseIndex = i;
					break;
				}
			}
		}

		this.zwchart.draw();
	}

	setupToolTip(divTooltip){
		if(divTooltip){
			divTooltip.style("opacity", 0)
				.style('position', 'absolute')
				.style('text-align', 'left')
				.style('vertical-align', 'middle')
				.style('width', '460px')
				.style('padding', '2px')
				.style('font', '13px sans-serif')
				.style('background', 'lightsteelblue')
				.style('border', '0px')
				.style('border-radius', '8px')
				.style('pointer-events', 'none');
		}
	}

	componentDidMount(){
		window.addEventListener('resize', this.handleResize);
		d3.select('body').append('div').attr('id', this.state.tooltipId);
		let divtip = d3.select('#' + this.state.tooltipId);
		this.setupToolTip(divtip);
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
			chartstyle = this.props.style;
		}

		this.zwchart.rules = this.props.rules;
		this.drawChart();

		return (
			<svg id={this.state.chartid} style={chartstyle}>
			</svg>
		)
	}
}

export default ZiWeiChart;

