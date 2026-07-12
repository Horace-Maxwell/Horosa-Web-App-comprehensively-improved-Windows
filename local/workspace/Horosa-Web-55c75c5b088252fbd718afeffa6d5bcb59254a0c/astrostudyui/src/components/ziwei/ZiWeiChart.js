import * as d3 from 'd3';
import { Component } from 'react';
import {randomStr, setupFloatingTooltip} from '../../utils/helper';
import * as AstroConst from '../../constants/AstroConst';
import { chartDrawGuardEnabled } from '../../utils/perfFlags';
import ZWChart from './ZWChart';

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

		this.zwchart = new ZWChart(svgid, null, this.props.fields, this.state.tooltipId, this.props.onTipClick, this.props.onCenterInfoClick);

		this.drawChart = this.drawChart.bind(this);
		this.handleResize = this.handleResize.bind(this);
		this.scheduleDrawChart = this.scheduleDrawChart.bind(this);
		this.ensureChartSurfaceSize = this.ensureChartSurfaceSize.bind(this);
		this.setupToolTip = this.setupToolTip.bind(this);
		this.drawFrame = null;
		this.resizeObserver = null;
		this.sizeRetryCount = 0;

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
	
		this.scheduleDrawChart();
	}

	scheduleDrawChart(){
		if(this.drawFrame){
			cancelAnimationFrame(this.drawFrame);
		}
		this.drawFrame = requestAnimationFrame(()=>{
			this.drawFrame = requestAnimationFrame(()=>{
				this.drawFrame = null;
				this.drawChart();
			});
		});
	}

	ensureChartSurfaceSize(){
		const svgdom = document.getElementById(this.state.chartid);
		if(svgdom === undefined || svgdom === null){
			return false;
		}

		// 紫微盘占满中间栏:按 chart-stage 实际宽高把 viewport+svg 撑满(非正方,竖向拉高填满,不超出边界)。
		// 用 JS 显式定尺寸(覆写 CSS)——flex 主轴上 width:100% 会塌成 svg 固有 300,故不靠纯 CSS。
		const viewport = svgdom.parentElement;
		const panel = viewport ? viewport.parentElement : null; // .horosa-chart-stage
		const source = panel || viewport;
		if(source === undefined || source === null || typeof source.getBoundingClientRect !== 'function'){
			return svgdom.clientWidth > 0 && svgdom.clientHeight > 0;
		}

		const rect = source.getBoundingClientRect();
		const pad = 14; // 留出 stage 内边距,避免压边/触发滚动(不超出上下边界)
		const w = Math.floor(rect.width - pad);
		const h = Math.floor(rect.height - pad);
		if(w <= 0 || h <= 0){
			return svgdom.clientWidth > 0 && svgdom.clientHeight > 0;
		}

		if(viewport){
			viewport.style.width = w + 'px';
			viewport.style.height = h + 'px';
		}
		svgdom.style.width = w + 'px';
		svgdom.style.height = h + 'px';
		this.sizeRetryCount = 0;
		return true;
	}

	drawChart(){
		let chartobj = this.props.value;
		if(chartobj === undefined || chartobj === null 
			|| chartobj.houses === undefined || chartobj.houses === null){
			return;
		}

		if(!this.ensureChartSurfaceSize()){
			if(this.sizeRetryCount < 8){
				this.sizeRetryCount += 1;
				this.scheduleDrawChart();
			}
			return;
		}
		
		this.zwchart.fileds = this.props.fields;
		this.zwchart.fields = this.props.fields;
		this.zwchart.onCenterInfoClick = this.props.onCenterInfoClick;
		this.zwchart.chart = chartobj;
		this.zwchart.kinastroBorrowed = !!chartobj.kinastroBorrowed;
		// dirIndex 现由 ZiWeiMain 的 luckSel 单一真值源派生：无大限选中=null=不显「运X」(经典 natal 盘)。
		this.zwchart.dirHouseIndex = (this.props.dirIndex !== undefined && this.props.dirIndex !== null)
			? this.props.dirIndex : null;

		this.zwchart.luckMingIndex = (this.props.luckMingIndex !== undefined && this.props.luckMingIndex !== null)
			? this.props.luckMingIndex : null;
		// 运限四化滑窗层 + 自化开关 + 长生左侧标签层（需求3/5）：随 luckSel 派生，draw 时各宫消费。
		this.zwchart.luckSihuaLayers = this.props.luckSihuaLayers || null;
		this.zwchart.luckShowZihua = this.props.luckShowZihua !== false; // 默认 true（无运限=本命四化+自化）
		this.zwchart.luckLabelLayers = this.props.luckLabelLayers || null;

		// 重绘签名守卫(流畅度):cDU 无条件 scheduleDrawChart,父组件无关 setState(tips/输入区)
		// 也会穿透到这里整树重建(ZWChart.draw 内 svg.html('') 全清空)。签名取「draw 实际消费的
		// 全部输入」(含解析后的 dirHouseIndex,而非可能为 undefined 的 props.dirIndex);引用相等
		// 比较;仅成功 draw 后记录(draw 抛错不记录,传播行为不变);ensureChartSurfaceSize 已保证
		// 此处尺寸非零,隐藏期 retry 机制不受影响。ZWChart 内部交互(飞星点击等)直调 this.draw()
		// 不经本函数,零影响。
		if(chartDrawGuardEnabled()){
			const svgdom = document.getElementById(this.state.chartid);
			const sig = {
				value: chartobj,
				fields: this.props.fields,
				rules: this.props.rules,
				dirHouseIndex: this.zwchart.dirHouseIndex,
				luckMingIndex: this.zwchart.luckMingIndex,
				luckKey: this.props.luckKey, // 运限选择稳定签名（派生数组每次新引用，故用此 key 比较，见 ZiWeiMain.buildLuckRender）
				appearance: (typeof document !== 'undefined' && document.documentElement) ? document.documentElement.getAttribute('data-horosa-appearance') : '', // 主题指纹：切明暗必重绘(盘底烘焙色随之更新)
				kinastroBorrowed: this.zwchart.kinastroBorrowed,
				onCenterInfoClick: this.props.onCenterInfoClick,
				w: svgdom ? svgdom.clientWidth : 0,
				h: svgdom ? svgdom.clientHeight : 0,
			};
			const last = this._lastDrawnSig;
			if(last
				&& last.value === sig.value
				&& last.fields === sig.fields
				&& last.rules === sig.rules
				&& last.dirHouseIndex === sig.dirHouseIndex
				&& last.luckMingIndex === sig.luckMingIndex
				&& last.luckKey === sig.luckKey
				&& last.appearance === sig.appearance
				&& last.kinastroBorrowed === sig.kinastroBorrowed
				&& last.onCenterInfoClick === sig.onCenterInfoClick
				&& last.w === sig.w
				&& last.h === sig.h){
				return; // 输入未变,跳过整树重建
			}
			this.zwchart.draw();
			this._lastDrawnSig = sig;
			return;
		}
		this.zwchart.draw();
	}

	setupToolTip(divTooltip){
		if(divTooltip){
			setupFloatingTooltip(divTooltip, {
				width: '460px',
				padding: '8px 10px',
				font: '13px sans-serif',
				background: 'var(--horosa-surface-solid, lightsteelblue)',  // 悬浮层铁律:绝对不透明(raised 带 0.97 透明)
				color: 'var(--horosa-text, #182235)',
				border: '1px solid var(--horosa-border, transparent)',
				'border-radius': '8px',
				'box-shadow': '0 10px 28px rgba(0,0,0,0.18)',
			});
		}
	}

	componentDidMount(){
		window.addEventListener('resize', this.handleResize);
		d3.select('body').append('div').attr('id', this.state.tooltipId);
		let divtip = d3.select('#' + this.state.tooltipId);
		this.setupToolTip(divtip);
		const svgdom = document.getElementById(this.state.chartid);
		if(svgdom && typeof ResizeObserver !== 'undefined'){
			this.resizeObserver = new ResizeObserver(()=>{
				this.scheduleDrawChart();
			});
			this.resizeObserver.observe(svgdom);
			if(svgdom.parentElement){
				this.resizeObserver.observe(svgdom.parentElement);
			}
		}
		// 主题(明暗)切换只改 <html data-horosa-appearance>；盘底等烘焙色不重绘则停在旧主题(切明暗紫微盘不变·很丑)。
		// 挂 observer 主动重绘(重绘签名已含 appearance，故确实重画)。仿 AstroChart 同款修法。
		if(typeof MutationObserver !== 'undefined' && typeof document !== 'undefined' && document.documentElement){
			this._appearanceObserver = new MutationObserver(()=>{ this.scheduleDrawChart(); });
			this._appearanceObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-horosa-appearance'] });
		}
		this.scheduleDrawChart();
	}

	componentDidUpdate(){
		this.scheduleDrawChart();
	}

	componentWillUnmount() {
		window.removeEventListener('resize', this.handleResize);
		if(this.drawFrame){
			cancelAnimationFrame(this.drawFrame);
			this.drawFrame = null;
		}
		if(this.resizeObserver){
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}
		if(this._appearanceObserver){
			this._appearanceObserver.disconnect();
			this._appearanceObserver = null;
		}
		d3.select('#' + this.state.tooltipId).remove();
	}

	render(){
		let chartstyle = {
			width: this.props.width ? this.props.width : '100%',
			height: this.props.height ? this.props.height : '100%',
			backgroundColor: 'var(--horosa-ziwei-chart-bg, #f6f1e7)', // 盘底随主题(原 ChartBackgroud=0 恒黑不跟明暗)
		};

		if(this.props.style){
			chartstyle = this.props.style;
		}

		this.zwchart.rules = this.props.rules;

		return (
			<svg id={this.state.chartid} style={chartstyle}>
			</svg>
		)
	}
}

export default ZiWeiChart;
