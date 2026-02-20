import * as d3 from 'd3';
import { Component } from 'react';
import * as AstroConst from '../../constants/AstroConst';
import { randomStr, } from '../../utils/helper';
import JinKouPanChart from './JinKouPanChart';

class JinKouChart extends Component{
	constructor(props) {
		super(props);
		const svgid = this.props.id ? `svg${this.props.id}` : `svg${randomStr(8)}`;
		this.state = {
			chartid: svgid,
			tooltipId: `div${randomStr(8)}`,
		};

		const opt = {
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
			jinkouData: this.props.jinkouData,
		};
		this.chart = new JinKouPanChart(opt);

		this.drawChart = this.drawChart.bind(this);
	}

	drawChart(){
		const chartobj = this.props.value;
		if(chartobj === undefined || chartobj === null){
			return;
		}
		this.chart.fields = this.props.fields;
		this.chart.chart = chartobj;
		this.chart.nongli = chartobj.nongli;
		this.chart.liureng = this.props.liureng;
		this.chart.runyear = this.props.runyear;
		this.chart.zhangshengElem = this.props.zhangshengElem;
		this.chart.guireng = this.props.guireng;
		this.chart.jinkou = this.props.jinkouData;
		this.chart.draw();
	}

	componentDidMount(){
		d3.select('body').append('div').attr('id', this.state.tooltipId);
		this.drawChart();
	}

	componentWillUnmount() {
		d3.select(`#${this.state.tooltipId}`).remove();
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
		);
	}
}

export default JinKouChart;
