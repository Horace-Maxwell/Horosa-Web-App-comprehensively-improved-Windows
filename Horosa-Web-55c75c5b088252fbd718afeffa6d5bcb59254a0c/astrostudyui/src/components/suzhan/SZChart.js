import * as d3 from 'd3';
import * as AstroConst from '../../constants/AstroConst';
import Su28ChartCircle from '../su28/Su28ChartCircle';
import Su28Chart from '../su28/Su28Chart';
import SZSignChart from '../szsign/SZSignChart';
import SZSignChartCircle from '../szsign/SZSignChartCircle';
import SZBaGuaChart from '../szbagua/SZBaGuaChart';
import SZDunJiaChart from '../szdunjia/SZDunJiaChart';
import SZTaiYiChart from '../sztaiyi/SZTaiYiChart';
import SZFangWeiChart from '../szfangwei/SZFangWeiChart';
import SZFengYeChart from '../szfengye/SZFengYeChart';
import SZNiXiangChart from '../sznixiang/SZNiXiangChart';
import SZFengYeChartCircle from '../szfengye/SZFengYeChartCircle';
import SZFangWeiChartCircle from '../szfangwei/SZFangWeiChartCircle';
import SZNiXiangChartCircle from '../sznixiang/SZNiXiangChartCircle';
import SZBaGuaChartCircle from '../szbagua/SZBaGuaChartCircle';
import SZDunJiaChartCircle from '../szdunjia/SZDunJiaChartCircle';
import SZTaiYiChartCircle from '../sztaiyi/SZTaiYiChartCircle';
import * as SZConst from './SZConst';

class SZChart {
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
			if(SZConst.SZChart.chart === SZConst.SZChart_NoExternChart){
				this.su28chart = new Su28ChartCircle(option);
			}else if(SZConst.SZChart.chart === SZConst.SZChart_SignChart){
				this.su28chart = new SZSignChartCircle(option);
			}else if(SZConst.SZChart.chart === SZConst.SZChart_BaGuaChart){
				this.su28chart = new SZBaGuaChartCircle(option);
			}else if(SZConst.SZChart.chart === SZConst.SZChart_DunJiaChart){
				this.su28chart = new SZDunJiaChartCircle(option);
			}else if(SZConst.SZChart.chart === SZConst.SZChart_TaiYiChart){
				this.su28chart = new SZTaiYiChartCircle(option);
			}else if(SZConst.SZChart.chart === SZConst.SZChart_FangWeiChart){
				this.su28chart = new SZFangWeiChartCircle(option);
			}else if(SZConst.SZChart.chart === SZConst.SZChart_FengYeChart){
				this.su28chart = new SZFengYeChartCircle(option);
			}else if(SZConst.SZChart.chart === SZConst.SZChart_NiXiangChart){
				this.su28chart = new SZNiXiangChartCircle(option);
			}else{
				this.su28chart = new Su28ChartCircle(option);
			}	
		}else{
			if(SZConst.SZChart.chart === SZConst.SZChart_NoExternChart){
				this.su28chart = new Su28Chart(option);
			}else if(SZConst.SZChart.chart === SZConst.SZChart_SignChart){
				this.su28chart = new SZSignChart(option);
			}else if(SZConst.SZChart.chart === SZConst.SZChart_BaGuaChart){
				this.su28chart = new SZBaGuaChart(option);
			}else if(SZConst.SZChart.chart === SZConst.SZChart_DunJiaChart){
				this.su28chart = new SZDunJiaChart(option);
			}else if(SZConst.SZChart.chart === SZConst.SZChart_TaiYiChart){
				this.su28chart = new SZTaiYiChart(option);
			}else if(SZConst.SZChart.chart === SZConst.SZChart_FangWeiChart){
				this.su28chart = new SZFangWeiChart(option);
			}else if(SZConst.SZChart.chart === SZConst.SZChart_FengYeChart){
				this.su28chart = new SZFengYeChart(option);
			}else if(SZConst.SZChart.chart === SZConst.SZChart_NiXiangChart){
				this.su28chart = new SZNiXiangChart(option);
			}else{
				this.su28chart = new Su28Chart(option);
			}	
		}

		
		this.su28chart.draw();
	}

}

export default SZChart;
