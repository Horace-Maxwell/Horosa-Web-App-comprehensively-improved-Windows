import * as d3 from 'd3';
import React, { Component } from 'react';
import {randomStr, setupFloatingTooltip} from '../../utils/helper';
import * as AstroConst from '../../constants/AstroConst';
import { chartDrawGuardEnabled, chartSCUEnabled } from '../../utils/perfFlags';
import ZWChart from './ZWChart';

// horosa_ziwei_chart_scu_v1:本组件 render 与 drawChart 实际消费的**全部** props。
// 逐项相等 → 跳过这次 re-render(连带跳过 cDU→scheduleDrawChart 的双 rAF + getElementById +
// clientWidth/clientHeight 强制回流);任一变化 → 照常渲染重绘。
// 取向「宁可多渲、绝不漏渲」:除下面两个**派生数组**外一律参与比较,未知/新增 props 由键数比兜底。
const ZW_CHART_DERIVED_ARRAY_PROPS = { luckSihuaLayers: true, luckLabelLayers: true };

// 派生数组内容比(长度 + 逐元素逐字段)。它们由 ZiWeiMain.buildLuckRender 每次 render 新建
// (引用恒变),用引用比会让 sCU 恒 true 形同虚设;元素是 3~5 个纯标量小对象,内容比极廉价且精确。
function zwLuckArrayEqual(a, b){
	if(a === b){
		return true;
	}
	if(!Array.isArray(a) || !Array.isArray(b)){
		return a === b;
	}
	if(a.length !== b.length){
		return false;
	}
	for(let i = 0; i < a.length; i += 1){
		const x = a[i];
		const y = b[i];
		if(x === y){
			continue;
		}
		if(!x || !y || typeof x !== 'object' || typeof y !== 'object'){
			return false;
		}
		const xk = Object.keys(x);
		const yk = Object.keys(y);
		if(xk.length !== yk.length){
			return false;
		}
		for(let j = 0; j < xk.length; j += 1){
			const k = xk[j];
			if(x[k] !== y[k]){
				return false;
			}
		}
	}
	return true;
}

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
		// 早退只挡 0 尺寸/极小值:560 级阈值在缩放档下(布局宽=物理/z)会把 resize 路径整个挡死
		// (z=1.8 时中栏布局宽必<560,缩窗后永不重画)——与六壬 LiuRengChart 同病同修,收到 200。
		if(w < 200 || h < 200){
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
		if(source === undefined || source === null || typeof source.offsetWidth !== 'number'){
			return svgdom.clientWidth > 0 && svgdom.clientHeight > 0;
		}

		// [Tahoe 域混根修] 量容器必须用布局域读数(offsetWidth/offsetHeight,border-box),
		// 绝不用 getBoundingClientRect:rect 域在壳缩放(html zoom)≠1 时已被缩放,把 rect 值
		// 写回 style.width(布局域 px)=跨域写错尺寸(z>1 盘面超宽被两侧遮裁/z<1 偏小)。
		// 读写同域直量,任何 zoom 引擎语义下 by construction 成立;z=1 时与旧 rect 写法逐值相等。
		const pad = 14; // 留出 stage 内边距,避免压边/触发滚动(不超出上下边界)
		const w = Math.floor(source.offsetWidth - pad);
		const h = Math.floor(source.offsetHeight - pad);
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
		// [D3] 流年神煞上盘:选中流年支透传(house 绘制期经 resolveSmallStarsForDisplay 消费)。
		this.zwchart.flowZhi = this.props.luckFlowZhi || null;

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
				// 🔴 显示层版本必须进签名:杂曜/十二神开关走 localStorage(ZiWeiHelper.zwShowOthers/zwShowSmall),
				//    draw 每次都读它,但它不是 props —— 签名里没有它,守卫就判「输入未变」而跳过整树重建,
				//    于是 localStorage 明明写了 0、盘上杂曜纹丝不动。签名口径是「draw 实际消费的全部输入」,
				//    localStorage 也是输入,只是没走 props 而已(2026-07-31 运行时死开关审计实证)。
				zwDisplayRev: this.props.zwDisplayRev || 0,
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
				&& last.zwDisplayRev === sig.zwDisplayRev
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

	// horosa_ziwei_chart_scu_v1:见文件头。父级因无关 state(updating 角标/tips/右栏页签切换)重渲时,
	// 本组件不再走 render + cDU + 双 rAF + 强制回流。drawChart 内既有的签名守卫保持不动(它还兜
	// resize/主题/内部交互等非 props 触发的重绘路径),两层互补、都以「输入未变才跳」为准。
	shouldComponentUpdate(nextProps, nextState){
		if(!chartSCUEnabled()){
			return true;   // kill-switch:回到恒重渲的旧行为
		}
		if(nextState !== this.state){
			return true;   // 本组件 state(chartid/tooltipId 等)一变即渲
		}
		const prev = this.props;
		const next = nextProps;
		if(prev === next){
			return false;
		}
		if(!prev || !next){
			return true;
		}
		const pk = Object.keys(prev);
		const nk = Object.keys(next);
		if(pk.length !== nk.length){
			return true;   // 键集合变了 → 保守重渲
		}
		for(let i = 0; i < nk.length; i += 1){
			const k = nk[i];
			const a = prev[k];
			const b = next[k];
			if(a === b){
				continue;
			}
			if(ZW_CHART_DERIVED_ARRAY_PROPS[k]){
				if(zwLuckArrayEqual(a, b)){
					continue;
				}
				return true;
			}
			return true;   // 其余任何 props(含 value/fields/rules/luckKey/回调)一变即渲
		}
		return false;
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
