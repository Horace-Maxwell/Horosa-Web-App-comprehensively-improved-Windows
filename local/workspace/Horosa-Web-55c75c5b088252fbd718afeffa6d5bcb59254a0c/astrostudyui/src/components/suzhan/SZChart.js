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
import { fitSvgDesignBox } from '../../utils/svgDesignBox';

// 宿盘绘制坐标的设计下限(CSS px)
export const SZ_DESIGN_MIN = 520;

// 宿盘外盘类 / 盘形取值单源:与左栏下拉、版面量尺寸同源 —— fields 有值即为准,缺省才回落全站共享单例。
// (单例在别处的宿盘实例构造时会按本机偏好重置;只读单例画盘会出现「左栏显示 A、盘面画 B」)
function szFieldInt(fields, key){
	const f = fields && fields[key];
	if(f && f.value !== undefined && f.value !== null && f.value !== ''){
		const n = parseInt(f.value, 10);
		if(Number.isFinite(n)){
			return n;
		}
	}
	return null;
}

export function szChartSelection(fields){
	const chart = szFieldInt(fields, 'szchart');
	const shape = szFieldInt(fields, 'szshape');
	return {
		chart: chart !== null ? chart : SZConst.SZChart.chart,
		shape: shape !== null ? shape : SZConst.SZChart.shape,
	};
}

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
		if(svgdom.clientWidth === 0 || svgdom.clientHeight === 0){
			return null;
		}
		// 盘比设计下限小(放大档 / 窄中栏)时按下限绘制、viewBox 整体等比缩回 —— 写死 px 的星名 / 宿名不再越出盘边被裁
		const { width, height } = fitSvgDesignBox(svgdom, SZ_DESIGN_MIN, SZ_DESIGN_MIN);

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

		const sel = szChartSelection(this.fields);
		if(sel.shape === SZConst.SZChart_Circle){
			if(sel.chart === SZConst.SZChart_NoExternChart){
				this.su28chart = new Su28ChartCircle(option);
			}else if(sel.chart === SZConst.SZChart_SignChart){
				this.su28chart = new SZSignChartCircle(option);
			}else if(sel.chart === SZConst.SZChart_BaGuaChart){
				this.su28chart = new SZBaGuaChartCircle(option);
			}else if(sel.chart === SZConst.SZChart_DunJiaChart){
				this.su28chart = new SZDunJiaChartCircle(option);
			}else if(sel.chart === SZConst.SZChart_TaiYiChart){
				this.su28chart = new SZTaiYiChartCircle(option);
			}else if(sel.chart === SZConst.SZChart_FangWeiChart){
				this.su28chart = new SZFangWeiChartCircle(option);
			}else if(sel.chart === SZConst.SZChart_FengYeChart){
				this.su28chart = new SZFengYeChartCircle(option);
			}else if(sel.chart === SZConst.SZChart_NiXiangChart){
				this.su28chart = new SZNiXiangChartCircle(option);
			}else{
				this.su28chart = new Su28ChartCircle(option);
			}	
		}else{
			if(sel.chart === SZConst.SZChart_NoExternChart){
				this.su28chart = new Su28Chart(option);
			}else if(sel.chart === SZConst.SZChart_SignChart){
				this.su28chart = new SZSignChart(option);
			}else if(sel.chart === SZConst.SZChart_BaGuaChart){
				this.su28chart = new SZBaGuaChart(option);
			}else if(sel.chart === SZConst.SZChart_DunJiaChart){
				this.su28chart = new SZDunJiaChart(option);
			}else if(sel.chart === SZConst.SZChart_TaiYiChart){
				this.su28chart = new SZTaiYiChart(option);
			}else if(sel.chart === SZConst.SZChart_FangWeiChart){
				this.su28chart = new SZFangWeiChart(option);
			}else if(sel.chart === SZConst.SZChart_FengYeChart){
				this.su28chart = new SZFengYeChart(option);
			}else if(sel.chart === SZConst.SZChart_NiXiangChart){
				this.su28chart = new SZNiXiangChart(option);
			}else{
				this.su28chart = new Su28Chart(option);
			}	
		}

		
		this.su28chart.draw();
	}

}

export default SZChart;
