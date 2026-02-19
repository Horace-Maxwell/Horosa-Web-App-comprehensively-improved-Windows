import * as d3 from 'd3';
import * as AstroConst from '../../constants/AstroConst';
import GuoLaoNatalChart from './GuoLaoNatalChart';
import GLSZSignChart from './GLSZSignChart';
import * as SZConst from '../suzhan/SZConst';

class GLChart {
	constructor(chartid, chartObj, fields, tooltipId, onTipClick){
		this.fields = fields;
		this.chartId = chartid;
		this.chartObj = chartObj;
		this.tooltipId = tooltipId;
		this.onTipClick = onTipClick;
		this.aspectsObj = null;

		this.margin = 20;
		this.svgTopgroup = null;
		this.svg = null;

		this.su28chart = null;

		this.planetDisp = new Set();
		this.chartDisp = 0;
	}

	set chart(chartobj){
		this.chartObj = chartobj;
	}

	draw(){
		if(this.chartObj === undefined || this.chartObj === null ||
			this.chartObj.fixedStarSu28 === undefined || this.chartObj.fixedStarSu28 === null){
			return null;
		}
		let svgdom = document.getElementById(this.chartId); 
		if(svgdom === undefined || svgdom === null){
			return null;
		}
		let width = svgdom.clientWidth;
		let height = svgdom.clientHeight;
		if(width === 0 || height === 0){
			return null;
		}

		let realW = width - this.margin * 2;
		let realH = height - this.margin * 2;

		let svgid = '#' + this.chartId;
		this.svg = d3.select(svgid);
		this.svg.html('');
		this.svg.attr('stroke', AstroConst.AstroColor.Stroke).attr("stroke-width", 1);
	
		this.svgTopgroup = this.svg.append('g');

		let option = {
			x: this.margin,
			y: this.margin,
			width: realW,
			height: realH,
			chartId: this.chartId,
			owner: this.svgTopgroup,
			chartObj: this.chartObj,
			fields: this.fields,
			divTooltip: d3.select('#' + this.tooltipId),
			chartDisp: this.chartDisp,
			planetDisp: this.planetDisp,
			onTipClick: this.onTipClick,
		};

		if(SZConst.SZChart.shape === SZConst.SZChart_Circle){
			this.su28chart = new GuoLaoNatalChart(option);
		}else{
			this.su28chart = new GLSZSignChart(option);
		}
		
		this.su28chart.draw();
	}

}

export default GLChart;
