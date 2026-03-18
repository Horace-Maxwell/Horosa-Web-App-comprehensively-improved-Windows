import * as d3 from 'd3';
import { Component } from 'react';
import { Row, Col, Tabs, DatePicker, Input, Button, Card, Select } from 'antd';
import {randomStr,} from '../../utils/helper';
import * as AstroConst from '../../constants/AstroConst';
import * as SZConst from './SZConst';
import SZChart from './SZChart';

const SQUARE_SIDE_MIN = 620;
const SQUARE_SIDE_MAX = 980;
const VIEWPORT_BOTTOM_GAP = 56;
const SQUARE_SIDE_FALLBACK = 420;

function clamp(val, min, max){
	return Math.max(min, Math.min(max, val));
}

function getSuZhanShape(fields){
	if(fields && fields.szshape && fields.szshape.value !== undefined && fields.szshape.value !== null){
		const shape = parseInt(fields.szshape.value, 10);
		if(shape === SZConst.SZChart_Circle || shape === SZConst.SZChart_Square){
			return shape;
		}
	}
	return SZConst.SZChart.shape === SZConst.SZChart_Circle
		? SZConst.SZChart_Circle
		: SZConst.SZChart_Square;
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
		this.chartWrap = null;
		this.redrawTimer = null;
		this.resizeObserver = null;
		this.resizeFrame = null;
		this.resizeTimer = null;
		this.observerFrame = null;

		this.drawChart = this.drawChart.bind(this);
		this.updateSquareSide = this.updateSquareSide.bind(this);
		this.handleResize = this.handleResize.bind(this);
		this.setChartWrapRef = this.setChartWrapRef.bind(this);
		this.clearPendingResize = this.clearPendingResize.bind(this);
		this.clearDrawRetry = this.clearDrawRetry.bind(this);
		this.scheduleDrawRetry = this.scheduleDrawRetry.bind(this);
		this.disconnectChartResize = this.disconnectChartResize.bind(this);
		this.observeChartResize = this.observeChartResize.bind(this);
		this.clearObserverFrame = this.clearObserverFrame.bind(this);
		this.scheduleSquareSideSync = this.scheduleSquareSideSync.bind(this);
		this.isChartActive = this.isChartActive.bind(this);
	}

	isChartActive(){
		return this.props.active !== false;
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
		let measuredMaxSide = null;
		const wrap = this.chartWrap;
		const svgdom = document.getElementById(this.state.chartid);
		if(wrap || svgdom){
			const parent = wrap || (svgdom ? svgdom.parentElement : null);
			const parentW = parent ? parent.clientWidth : 0;
			const parentH = parent ? parent.clientHeight : 0;
			let viewportRemainH = 0;
			const viewportH = window.innerHeight || document.documentElement.clientHeight || 0;
			if(viewportH > 0 && svgdom){
				const rect = svgdom.getBoundingClientRect();
				let bottomLimit = viewportH;
				const footer = document.getElementById('globalFooter');
				if(footer){
					const footerRect = footer.getBoundingClientRect();
					if(footerRect.top > rect.top && footerRect.top < bottomLimit){
						bottomLimit = footerRect.top;
					}
				}
				viewportRemainH = bottomLimit - rect.top - VIEWPORT_BOTTOM_GAP;
			}
			const sizeLimits = [];
			if(parentW > 0){
				sizeLimits.push(parentW);
			}
			if(parentH > 0){
				sizeLimits.push(parentH);
			}
			if(viewportRemainH > 0){
				sizeLimits.push(viewportRemainH);
			}
			if(sizeLimits.length > 0){
				measuredMaxSide = Math.min(...sizeLimits);
			}
			if(parentW > 0 && parentH > 0){
				sideByContainer = Math.min(parentW, parentH, viewportRemainH > 0 ? viewportRemainH : parentH);
			}else if(parentW > 0){
				sideByContainer = viewportRemainH > 0 ? Math.min(parentW, viewportRemainH) : parentW;
			}
			if((sideByContainer === null || sideByContainer <= 0) && viewportRemainH > 0){
				sideByContainer = viewportRemainH;
			}
		}

		if(measuredMaxSide !== null && measuredMaxSide > 0 && measuredMaxSide < 160){
			return false;
		}

		let side = sideByContainer;
		if((side === null || side <= 0) && sideByProps !== null){
			side = sideByProps;
		}
		if(side === null || side <= 0){
			return false;
		}

		const effectiveMin = measuredMaxSide !== null && measuredMaxSide > 0
			? Math.min(SQUARE_SIDE_MIN, measuredMaxSide)
			: Math.min(SQUARE_SIDE_MIN, side);
		side = clamp(Math.round(side), Math.max(120, Math.round(effectiveMin)), SQUARE_SIDE_MAX);
		if(this.state.lockedSide === null || Math.abs(this.state.lockedSide - side) >= 4){
			this.setState({ lockedSide: side });
		}
		return true;
	}

	clearPendingResize(){
		if(this.resizeFrame !== null && typeof window !== 'undefined' && window.cancelAnimationFrame){
			window.cancelAnimationFrame(this.resizeFrame);
		}
		if(this.resizeTimer !== null && typeof window !== 'undefined' && window.clearTimeout){
			window.clearTimeout(this.resizeTimer);
		}
		this.resizeFrame = null;
		this.resizeTimer = null;
	}

	clearDrawRetry(){
		if(this.redrawTimer !== null && typeof window !== 'undefined' && window.clearTimeout){
			window.clearTimeout(this.redrawTimer);
		}
		this.redrawTimer = null;
	}

	clearObserverFrame(){
		if(this.observerFrame !== null && typeof window !== 'undefined' && window.cancelAnimationFrame){
			window.cancelAnimationFrame(this.observerFrame);
		}
		this.observerFrame = null;
	}

	scheduleDrawRetry(){
		if(!this.isChartActive()){
			return;
		}
		this.clearDrawRetry();
		this.redrawTimer = window.setTimeout(()=>{
			this.redrawTimer = null;
			if(!this.isChartActive()){
				return;
			}
			this.scheduleSquareSideSync(4);
			this.drawChart();
		}, 120);
	}

	disconnectChartResize(){
		this.clearObserverFrame();
		if(this.resizeObserver){
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}
	}

	observeChartResize(){
		if(!this.isChartActive() || typeof ResizeObserver === 'undefined'){
			return;
		}
		const svgdom = document.getElementById(this.state.chartid);
		const wrap = this.chartWrap;
		const parent = wrap ? wrap.parentElement : (svgdom ? svgdom.parentElement : null);
		if(!wrap && !parent){
			return;
		}
		this.disconnectChartResize();
		this.resizeObserver = new ResizeObserver(()=>{
			if(!this.isChartActive()){
				return;
			}
			if(this.observerFrame !== null){
				return;
			}
			this.observerFrame = window.requestAnimationFrame(()=>{
				this.observerFrame = null;
				if(!this.isChartActive()){
					return;
				}
				this.scheduleSquareSideSync();
				this.drawChart();
			});
		});
		if(wrap){
			this.resizeObserver.observe(wrap);
		}
		if(parent && parent !== wrap){
			this.resizeObserver.observe(parent);
		}
	}

	scheduleSquareSideSync(retryCount = 6){
		const szshape = getSuZhanShape(this.props.fields);
		if(!this.isChartActive()){
			return;
		}
		if(szshape !== SZConst.SZChart_Square){
			return;
		}
		if(this.updateSquareSide() || retryCount <= 0){
			return;
		}
		this.clearPendingResize();
		this.resizeFrame = window.requestAnimationFrame(()=>{
			this.resizeFrame = null;
			this.resizeTimer = window.setTimeout(()=>{
				this.resizeTimer = null;
				this.scheduleSquareSideSync(retryCount - 1);
			}, 60);
		});
	}

	setChartWrapRef(node){
		this.chartWrap = node;
	}

	handleResize(){
		if(!this.isChartActive()){
			return;
		}
		const szshape = getSuZhanShape(this.props.fields);
		if(szshape === SZConst.SZChart_Square){
			this.scheduleSquareSideSync();
			return;
		}
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
		if(!this.isChartActive()){
			return;
		}
		let chartobj = this.props.value;
		if(chartobj === undefined || chartobj === null 
			|| chartobj.fixedStarSu28 === undefined || chartobj.fixedStarSu28 === null){
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

		const shape = getSuZhanShape(this.props.fields);
		SZConst.SZChart.shape = shape;
		if(this.props.fields && this.props.fields.szchart &&
			this.props.fields.szchart.value !== undefined && this.props.fields.szchart.value !== null){
			SZConst.SZChart.chart = parseInt(this.props.fields.szchart.value, 10);
		}
		if(this.props.fields && this.props.fields.houseStartMode &&
			this.props.fields.houseStartMode.value !== undefined && this.props.fields.houseStartMode.value !== null){
			const mode = parseInt(this.props.fields.houseStartMode.value, 10);
			SZConst.SZChart.houseStartMode = mode === SZConst.SZHouseStart_ASC
				? SZConst.SZHouseStart_ASC
				: SZConst.SZHouseStart_Bazi;
		}
		
		this.szchart.chartDisp = flags;
		this.szchart.planetDisp = planetDisp;
		this.szchart.fields = this.props.fields;
		this.szchart.chart = chartobj;

		this.szchart.draw();

		const svgdom = document.getElementById(this.state.chartid);
		if(svgdom && (svgdom.clientWidth === 0 || svgdom.clientHeight === 0)){
			this.scheduleDrawRetry();
		}
	}

	componentDidMount(){
		window.addEventListener('resize', this.handleResize);
		d3.select('body').append('div').attr('id', this.state.tooltipId);
		if(this.isChartActive()){
			this.observeChartResize();
			this.scheduleSquareSideSync();
			this.drawChart();
			this.scheduleDrawRetry();
		}
	}

	componentWillUnmount() {
		window.removeEventListener('resize', this.handleResize);
		this.clearPendingResize();
		this.clearDrawRetry();
		this.clearObserverFrame();
		this.disconnectChartResize();
		d3.select('#' + this.state.tooltipId).remove();
	}

	componentDidUpdate(prevProps, prevState){
		const prevShape = getSuZhanShape(prevProps.fields);
		const nextShape = getSuZhanShape(this.props.fields);
		const isActive = this.isChartActive();
		const wasActive = prevProps.active !== false;
		const becameActive = isActive && !wasActive;
		const becameInactive = !isActive && wasActive;

		const sizePropsChanged = prevProps.width !== this.props.width || prevProps.height !== this.props.height;
		if(becameInactive){
			this.clearPendingResize();
			this.clearDrawRetry();
			this.disconnectChartResize();
			d3.select('#' + this.state.tooltipId).style('opacity', 0);
			return;
		}

		if(becameActive){
			this.observeChartResize();
		}

		if(!isActive){
			return;
		}

		if(nextShape === SZConst.SZChart_Square && (prevShape !== nextShape || sizePropsChanged || becameActive || prevProps.active !== this.props.active)){
			this.scheduleSquareSideSync();
		}

		const shouldRedraw = prevProps.value !== this.props.value
			|| prevProps.fields !== this.props.fields
			|| prevProps.chartDisplay !== this.props.chartDisplay
			|| prevProps.planetDisplay !== this.props.planetDisplay
			|| sizePropsChanged
			|| prevShape !== nextShape
			|| prevState.lockedSide !== this.state.lockedSide;

		if(shouldRedraw){
			this.drawChart();
			this.scheduleDrawRetry();
		}
	}

	render(){
		const szshape = getSuZhanShape(this.props.fields);
		const isSquareChart = szshape === SZConst.SZChart_Square;
		let chartstyle = {
			width: this.props.width ? this.props.width : '100%',
			height: this.props.height ? this.props.height : '100%',
			backgroundColor: AstroConst.AstroColor.ChartBackgroud,
			display: 'block',
			maxWidth: '100%',
			maxHeight: '100%',
		};
		if(this.props.style){
			chartstyle = {
				...chartstyle,
				...this.props.style,
			};
		}

		if(isSquareChart){
			const side = this.state.lockedSide || SQUARE_SIDE_FALLBACK;
			chartstyle.width = `${side}px`;
			chartstyle.height = `${side}px`;
		}

		return (
			<div
				ref={this.setChartWrapRef}
				style={{
					width: '100%',
					height: this.props.height ? this.props.height : '100%',
					minWidth: 0,
					overflow: 'hidden',
					display: 'flex',
					alignItems: 'flex-start',
					justifyContent: isSquareChart ? 'center' : 'flex-start',
					pointerEvents: this.isChartActive() ? 'auto' : 'none',
				}}
			>
				<svg id={this.state.chartid} style={chartstyle}>
				</svg>
			</div>
		)
	}
}

export default SuZhanChart;
