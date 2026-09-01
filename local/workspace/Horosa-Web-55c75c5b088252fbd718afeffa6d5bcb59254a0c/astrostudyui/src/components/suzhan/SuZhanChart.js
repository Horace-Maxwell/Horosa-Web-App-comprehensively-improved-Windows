import * as d3 from 'd3';
import { Component } from 'react';
import {randomStr,} from '../../utils/helper';
import * as AstroConst from '../../constants/AstroConst';
import * as SZConst from './SZConst';
import SZChart from './SZChart';
import { chartDrawGuardEnabled } from '../../utils/perfFlags';
import { buildChartDrawSig, sameChartDrawSig, chartDrawnAtNonZeroSize } from '../../utils/chartDrawGuard';
import { getEffectiveScale } from '../../utils/zoomDomain';

const SQUARE_SIDE_MIN = 480;
const SQUARE_SIDE_MAX = 1280;
const SQUARE_SIDE_PANEL_GAP = 16;
const VIEWPORT_BOTTOM_GAP = 28;

function clamp(val, min, max){
	return Math.max(min, Math.min(max, val));
}

class SuZhanChart extends Component{
	constructor(props) {
		super(props);
		let svgid = this.props.id ? 'svg' + this.props.id : 'svg' + randomStr(8);
		this.state = {
			chartid: svgid,
			ox: 0,
			oy: 0,
			radius: 0,
			tooltipId: 'div' + randomStr(8),
			lockedSide: null,
		};

		this.szchart = new SZChart(svgid, null, this.props.fields, this.state.tooltipId);

		this.drawChart = this.drawChart.bind(this);
		this.updateSquareSide = this.updateSquareSide.bind(this);
		this.handleResize = this.handleResize.bind(this);
		this.scheduleSquareMeasure = this.scheduleSquareMeasure.bind(this);
		this.squareMeasureTimers = [];
		this.squareMeasureFrame = null;
		this.mounted = false;
	}

	updateSquareSide(){
		const parseNum = (v)=>{
			if(typeof v === 'number' && Number.isFinite(v)){
				return v;
			}
			if(typeof v === 'string'){
				const txt = v.trim();
				// 仅接受纯数字或 px，避免把 "calc(100% - 70px)" 错判为 100。
				if(/^[-+]?\d+(\.\d+)?(px)?$/i.test(txt)){
					const n = parseFloat(txt);
					if(Number.isFinite(n)){
						return n;
					}
				}
			}
			return null;
		};

		let sideByProps = null;
		const h = parseNum(this.props.height);
		const w = parseNum(this.props.width);
		if(h !== null && w !== null){
			sideByProps = Math.min(h, w);
		}else if(h !== null){
			sideByProps = h;
		}else if(w !== null){
			sideByProps = w;
		}

		let sideByContainer = null;
		const svgdom = document.getElementById(this.state.chartid);
		if(svgdom){
			const parent = svgdom.parentElement;
			const panel = svgdom.closest ? (svgdom.closest('.horosa-suzhan-chart-panel') || parent) : parent;
			// [Tahoe 域混根修] 容器量宽高用布局域读数(clientWidth/clientHeight)优先;rect 域
			// (getBoundingClientRect)在壳缩放≠1 时已被 zoom 缩放,直接当布局 px 用=方盘边长
			// 算错(z>1 超宽遮裁/z<1 偏小)。clientWidth 为 0 的罕见兜底才用 rect,且必须经
			// getEffectiveScale()(实测探针,非声明值)换回布局域。
			const zScale = getEffectiveScale() || 1;
			const layoutSize = (el, kind)=>{
				if(!el){ return 0; }
				const direct = kind === 'w' ? el.clientWidth : el.clientHeight;
				if(direct > 0){ return Math.floor(direct); }
				const r = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
				const rv = r ? (kind === 'w' ? r.width : r.height) : 0;
				return rv > 0 ? Math.floor(rv / zScale) : 0;
			};
			const panelW = layoutSize(panel, 'w');
			const panelH = layoutSize(panel, 'h');
			const parentW = layoutSize(parent, 'w');
			const parentH = layoutSize(parent, 'h');
			let viewportRemainH = 0;
			const viewportH = window.innerHeight || document.documentElement.clientHeight || 0;
			if(viewportH > 0){
				const rect = svgdom.getBoundingClientRect();
				let bottomLimit = viewportH;
				const footer = document.getElementById('globalFooter');
				if(footer){
					const footerRect = footer.getBoundingClientRect();
					if(footerRect.top > rect.top && footerRect.top < bottomLimit){
						bottomLimit = footerRect.top;
					}
				}
				// rect.top 与 innerHeight 同属 rect/物理域,差值合法;但写进 candidates(布局域
				// px,最终成为 svg 边长)前必须除回布局域,GAP 是布局语义常量放在除后减。
				viewportRemainH = (bottomLimit - rect.top) / zScale - VIEWPORT_BOTTOM_GAP;
			}
			const candidates = [];
			const pushCandidate = (v)=>{
				if(Number.isFinite(v) && v > 0){
					candidates.push(Math.max(v - SQUARE_SIDE_PANEL_GAP, 0));
				}
			};
			pushCandidate(panelW);
			pushCandidate(panelH);
			pushCandidate(parentW);
			pushCandidate(parentH);
			if(viewportRemainH > 0){
				candidates.push(viewportRemainH);
			}
			const usableCandidates = candidates.filter(v=>v >= 360);
			if(usableCandidates.length > 0){
				sideByContainer = Math.min(...usableCandidates);
			}else if(candidates.length > 0){
				sideByContainer = Math.max(...candidates);
			}
		}

		let side = sideByContainer;
		if((side === null || side <= 0) && sideByProps !== null){
			side = sideByProps;
		}
		if(side === null || side <= 0){
			side = 740;
		}

		side = clamp(Math.round(side), SQUARE_SIDE_MIN, SQUARE_SIDE_MAX);
		if(this.state.lockedSide === null || Math.abs(this.state.lockedSide - side) >= 4){
			this.setState({ lockedSide: side });
		}
	}

	scheduleSquareMeasure(delay = 0){
		const measure = ()=>{
			if(!this.mounted){
				return;
			}
			if(typeof window !== 'undefined' && window.requestAnimationFrame){
				this.squareMeasureFrame = window.requestAnimationFrame(()=>{
					this.squareMeasureFrame = null;
					if(!this.mounted){
						return;
					}
					this.updateSquareSide();
					this.drawChart();
				});
			}else{
				this.updateSquareSide();
				this.drawChart();
			}
		};
		if(delay > 0){
			const timer = window.setTimeout(()=>{
				this.squareMeasureTimers = this.squareMeasureTimers.filter(item=>item !== timer);
				measure();
			}, delay);
			this.squareMeasureTimers.push(timer);
		}else{
			measure();
		}
	}

	handleResize(){
		const szshape = this.props.fields && this.props.fields.szshape
			? parseInt(this.props.fields.szshape.value, 10)
			: SZConst.SZChart.shape;
		if(szshape === SZConst.SZChart_Square){
			this.updateSquareSide();
			return;
		}
		let svgdom = document.getElementById(this.state.chartid);
		if(svgdom === undefined || svgdom === null){
			return;
		}
		let w = svgdom.clientWidth;
		let h = svgdom.clientHeight;
		// 早退只挡 0/极小值:560 级阈值在缩放档(布局宽=物理/z)下会把重绘路径整个挡死。
		if(w < 200 || h < 200){
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
			|| chartobj.fixedStarSu28 === undefined || chartobj.fixedStarSu28 === null){
			return;
		}

		// 重绘签名守卫:render() 每次调 drawChart,输入未变则跳过整树 d3 重建(宿盘缩放/装饰多,重建尤贵)。
		const guardOn = chartDrawGuardEnabled();
		const sig = guardOn ? buildChartDrawSig(this.state.chartid, {
			value: chartobj,
			chartDisplay: this.props.chartDisplay,
			planetDisplay: this.props.planetDisplay,
			fields: this.props.fields,
		}) : null;
		if(guardOn && sameChartDrawSig(sig, this._lastDrawnSig)){
			return;
		}

		let disp = [];
		if(this.props.chartDisplay !== undefined && this.props.chartDisplay !== null){
			disp = this.props.chartDisplay;
		}
		let flags = 0;
		for(let i=0; i<disp.length; i++){
			flags = flags + disp[i];
		}

		let planetDisp = new Set();
		if(this.props.planetDisplay !== undefined && this.props.planetDisplay !== null){
			for(let i=0; i<this.props.planetDisplay.length; i++){
				let id = this.props.planetDisplay[i];
				planetDisp.add(id);
			}
		}
		
		this.szchart.chartDisp = flags;
		this.szchart.planetDisp = planetDisp;
		this.szchart.fields = this.props.fields;
		this.szchart.chart = chartobj;

		this.szchart.draw();

		if(sig && chartDrawnAtNonZeroSize(this.state.chartid)){
			this._lastDrawnSig = sig;
		}
	}

	componentDidMount(){
		this.mounted = true;
		window.addEventListener('resize', this.handleResize);
		d3.select('body').append('div').attr('id', this.state.tooltipId);
		this.updateSquareSide();
		this.scheduleSquareMeasure(80);
		this.scheduleSquareMeasure(240);
		this.drawChart();
		// 🔴 防「首开比例严重错误」:宿盘 szchart.draw() 按 svgdom 实时尺寸绘,首挂载时容器可能尚 0/未 settle,
		// 80/240ms 定时重试会「有几率」错过慢渲染。改用 ResizeObserver——容器 0→实际尺寸的那次变化必可靠重测+重绘。
		if(typeof ResizeObserver !== 'undefined'){
			const svgdom = document.getElementById(this.state.chartid);
			const target = svgdom ? ((svgdom.closest && svgdom.closest('.horosa-suzhan-chart-panel')) || svgdom.parentElement || svgdom) : null;
			if(target){
				this._ro = new ResizeObserver(()=>{ if(this.mounted){ this.handleResize(); this.drawChart(); } });
				this._ro.observe(target);
			}
		}
	}

	componentWillUnmount() {
		this.mounted = false;
		window.removeEventListener('resize', this.handleResize);
		if(this.squareMeasureFrame !== null && window.cancelAnimationFrame){
			window.cancelAnimationFrame(this.squareMeasureFrame);
			this.squareMeasureFrame = null;
		}
		for(let i=0; i<this.squareMeasureTimers.length; i++){
			window.clearTimeout(this.squareMeasureTimers[i]);
		}
		this.squareMeasureTimers = [];
		if(this._ro){ this._ro.disconnect(); this._ro = null; }
		d3.select('#' + this.state.tooltipId).remove();
	}

	componentDidUpdate(prevProps){
		const prevShape = prevProps.fields && prevProps.fields.szshape
			? parseInt(prevProps.fields.szshape.value, 10)
			: SZConst.SZChart.shape;
		const nextShape = this.props.fields && this.props.fields.szshape
			? parseInt(this.props.fields.szshape.value, 10)
			: SZConst.SZChart.shape;
		if(prevShape !== nextShape && nextShape === SZConst.SZChart_Square){
			this.updateSquareSide();
			this.scheduleSquareMeasure(80);
		}
		if(nextShape === SZConst.SZChart_Square){
			this.updateSquareSide();
			if(prevProps.height !== this.props.height
				|| prevProps.width !== this.props.width
				|| prevProps.value !== this.props.value
				|| prevProps.fields !== this.props.fields){
				this.scheduleSquareMeasure(80);
			}
		}
	}

	render(){
		const szshape = this.props.fields && this.props.fields.szshape
			? parseInt(this.props.fields.szshape.value, 10)
			: SZConst.SZChart.shape;
		const isSquareChart = szshape === SZConst.SZChart_Square;
		let chartstyle = {
			width: this.props.width ? this.props.width : '100%',
			height: this.props.height ? this.props.height : '100%',
			backgroundColor: AstroConst.AstroColor.ChartBackgroud,
		};
		if(this.props.style){
			chartstyle = {
				...chartstyle,
				...this.props.style,
			};
		}

			if(isSquareChart){
				const side = this.state.lockedSide || 740;
				chartstyle.width = `${side}px`;
				chartstyle.height = `${side}px`;
				chartstyle.maxWidth = '100%';
				chartstyle.maxHeight = '100%';
				chartstyle.aspectRatio = '1 / 1';
				chartstyle.flex = '0 1 auto';
				chartstyle.display = 'block';
			}

		this.drawChart();

			const chartClassName = isSquareChart ? 'horosa-suzhan-square-svg' : 'horosa-suzhan-circle-svg';
			return (
				<svg
					id={this.state.chartid}
					className={chartClassName}
					width={isSquareChart ? (this.state.lockedSide || 740) : undefined}
					height={isSquareChart ? (this.state.lockedSide || 740) : undefined}
					style={chartstyle}
				>
				</svg>
			)
	}
}

export default SuZhanChart;
