import * as d3 from 'd3';
import { Component } from 'react';
import * as AstroConst from '../../constants/AstroConst';
import { randomStr, } from '../../utils/helper';
import JinKouPanChart from './JinKouPanChart';
import { chartDrawGuardEnabled } from '../../utils/perfFlags';
import { buildChartDrawSig, sameChartDrawSig, chartDrawnAtNonZeroSize, watchChartSvgResize } from '../../utils/chartDrawGuard';

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

		// 重绘签名守卫:render() 每次调 drawChart,输入(盘/fields/六壬底/流年/长生五行/贵神/金口数据 引用 + 主题 + 尺寸)未变则跳过整树 d3 重建。
		// 切右栏 tab、tooltip、sibling setState 不改这些引用 → 跳过;重排盘/换流派/切主题/resize → 签名变 → 真重画。
		// 暗黑切换走 redrawForAppearance 双帧重绘:__appearance 指纹变 → 签名必不同 → 那两帧真重画(不被误跳)。
		const guardOn = chartDrawGuardEnabled();
		const sig = guardOn ? buildChartDrawSig(this.state.chartid, {
			value: chartobj,
			fields: this.props.fields,
			liureng: this.props.liureng,
			runyear: this.props.runyear,
			zhangshengElem: this.props.zhangshengElem,
			guireng: this.props.guireng,
			jinkouData: this.props.jinkouData,
			// gender 漏进签名 → 改性别不重绘，中栏「性别」格恒停在挂载时的值。
			gender: this.props.gender,
		}) : null;
		if(guardOn && sameChartDrawSig(sig, this._lastDrawnSig)){
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
		// 与上面各项同律逐次刷新 —— 原先只在构造时取一次，性别永远停在默认「男」。
		this.chart.gender = this.props.gender;
		this.chart.draw();

		if(sig && chartDrawnAtNonZeroSize(this.state.chartid)){
			this._lastDrawnSig = sig;
		}
	}

	// 暗黑切换专用:跨两帧重绘,避开「调色板滞后一帧」竞态(读到已就位的盘底色)。
	redrawForAppearance(){
		if(typeof requestAnimationFrame === 'undefined'){
			this.drawChart();
			return;
		}
		requestAnimationFrame(()=>{
			this.drawChart();
			requestAnimationFrame(()=>{ this.drawChart(); });
		});
	}

	componentDidMount(){
		d3.select('body').append('div').attr('id', this.state.tooltipId);
		this.drawChart();
		// 主题(明暗)切换只改 <html data-horosa-appearance>;盘底/格子/五行色为 SVG presentation 属性,
		// 不重绘则停在旧主题(切明暗后盘不变·很丑)。挂 observer 主动重绘,仿 ZiWeiChart/AstroChart 同款修法。
		// 关键:调色板 AstroColor 由 app.js/index.js 响应 appearance 用 setColorTheme 切换,index.js「滞后一帧」
		// 且可能用旧值覆写(见 AstroChart 注释)。若属性一变就立刻重绘,会读到旧调色板(暗黑下盘底仍白)。
		// 故跨两帧延后重绘:首帧待 app.js 调色板就位,次帧兜底 index.js 的滞后覆写,确保读到已切换到位的盘底色。
		if(typeof MutationObserver !== 'undefined' && typeof document !== 'undefined' && document.documentElement){
			this._appearanceObserver = new MutationObserver(()=>{ this.redrawForAppearance(); });
			this._appearanceObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-horosa-appearance'] });
		}
		// 隐藏容器(tab 未选中,svg 0×0)期间数据更新时绘制停旧画面,切回 tab 无 React 更新可触发
		// 重画 → 表新盘旧;svg 尺寸变化(含 0→非0)时补一次 drawChart(签名守卫防重画风暴)。
		this._detachSvgResize = watchChartSvgResize(this.state.chartid, this.drawChart);
	}

	componentWillUnmount() {
		d3.select(`#${this.state.tooltipId}`).remove();
		if(this._appearanceObserver){
			this._appearanceObserver.disconnect();
			this._appearanceObserver = null;
		}
		if(this._detachSvgResize){ this._detachSvgResize(); this._detachSvgResize = null; }
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
