import * as d3 from 'd3';
import { Component } from 'react';
import { Row, Col, Tabs, DatePicker, Input, Button, Card, Select } from 'antd';
import {randomStr,} from '../../utils/helper';
import * as AstroConst from '../../constants/AstroConst';
import GLChart from './GLChart';

const SQUARE_SIDE_MIN = 420;
const SQUARE_SIDE_MAX = 980;
const SQUARE_SIDE_HARD_MIN = 160;
const VIEWPORT_GAP = 12;

function clamp(val, min, max){
	return Math.max(min, Math.min(max, val));
}

function getViewportHeight(){
	if(typeof window !== 'undefined' && Number.isFinite(window.innerHeight) && window.innerHeight > 0){
		return window.innerHeight;
	}
	if(typeof document !== 'undefined' && document.documentElement){
		return document.documentElement.clientHeight || 900;
	}
	return 900;
}

function getViewportSideLimit(elem){
	const viewport = getViewportHeight();
	const absCap = Math.max(SQUARE_SIDE_HARD_MIN, viewport - VIEWPORT_GAP);
	if(!elem || !elem.getBoundingClientRect){
		return absCap;
	}
	const rect = elem.getBoundingClientRect();
	const top = Number.isFinite(rect.top) ? rect.top : 0;
	const remain = viewport - top - VIEWPORT_GAP;
	return Math.max(SQUARE_SIDE_HARD_MIN, Math.min(absCap, remain));
}

class GuoLaoChart extends Component{
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

		this.glchart = new GLChart(svgid, null, this.props.fields, this.state.tooltipId, this.props.onTipClick);
		this.redrawTimer = null;

		this.drawChart = this.drawChart.bind(this);
		this.updateSquareSide = this.updateSquareSide.bind(this);
		this.handleResize = this.handleResize.bind(this);
		this.scheduleDrawRetry = this.scheduleDrawRetry.bind(this);
	}

	updateSquareSide(){
		const parseNum = (v)=>{
			if(typeof v === 'number' && Number.isFinite(v)){
				return v;
			}
			if(typeof v === 'string'){
				const txt = v.trim();
				// Avoid parsing "calc(100% - 70px)" as 100.
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
		let parentW = 0;
		let parentH = 0;
		const svgdom = document.getElementById(this.state.chartid);
		if(svgdom){
			const parent = svgdom.parentElement;
			parentW = parent ? parent.clientWidth : 0;
			parentH = parent ? parent.clientHeight : 0;
			if(parentW > 0 && parentH > 0){
				sideByContainer = Math.min(parentW, parentH);
			}else if(parentW > 0){
				sideByContainer = parentW;
			}
		}

		const limits = [];
		if(sideByProps !== null && sideByProps > 0){
			limits.push(sideByProps);
		}
		if(sideByContainer !== null && sideByContainer > 0){
			limits.push(sideByContainer);
		}
		if(parentW > 0){
			limits.push(parentW);
		}
		if(parentH > 0){
			limits.push(parentH);
		}
		const viewportLimit = getViewportSideLimit(svgdom);
		if(viewportLimit > 0){
			limits.push(viewportLimit);
		}

		let side = limits.length > 0 ? Math.min(...limits) : 740;
		if(!Number.isFinite(side) || side <= 0){
			side = 740;
		}
		side = Math.round(side);
		side = side >= SQUARE_SIDE_MIN
			? clamp(side, SQUARE_SIDE_MIN, SQUARE_SIDE_MAX)
			: clamp(side, SQUARE_SIDE_HARD_MIN, SQUARE_SIDE_MAX);

		if(this.state.lockedSide === null || Math.abs(this.state.lockedSide - side) >= 4){
			this.setState({ lockedSide: side });
		}
	}

	handleResize(){
		this.updateSquareSide();

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
		
		this.glchart.chartDisp = flags;
		this.glchart.planetDisp = planetDisp;
		this.glchart.fields = this.props.fields;
		this.glchart.chart = chartobj;

		try{
			this.glchart.draw();
		}catch(err){
			console.error('GuoLaoChart draw failed', err);
		}

		let svgdom = document.getElementById(this.state.chartid);
		if(svgdom && (svgdom.clientWidth === 0 || svgdom.clientHeight === 0)){
			this.scheduleDrawRetry();
		}
	}

	scheduleDrawRetry(){
		if(this.redrawTimer){
			clearTimeout(this.redrawTimer);
		}
		this.redrawTimer = setTimeout(()=>{
			this.drawChart();
		}, 120);
	}

	componentDidMount(){
		window.addEventListener('resize', this.handleResize)
		d3.select('body').append('div').attr('id', this.state.tooltipId);
		this.updateSquareSide();
		this.drawChart();
		this.scheduleDrawRetry();
	}

	componentDidUpdate(){
		this.updateSquareSide();
		this.drawChart();
		this.scheduleDrawRetry();
	}

	componentWillUnmount() {
		window.removeEventListener('resize', this.handleResize)
		d3.select('#' + this.state.tooltipId).remove();
		if(this.redrawTimer){
			clearTimeout(this.redrawTimer);
			this.redrawTimer = null;
		}
	}

	render(){
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

		const side = this.state.lockedSide || 740;
		if(side > 0){
			chartstyle.width = `${side}px`;
			chartstyle.height = `${side}px`;
			chartstyle.display = 'block';
			chartstyle.margin = '0 auto';
		}

		return (
			<svg id={this.state.chartid} style={chartstyle}>
			</svg>
		)
	}
}

export default GuoLaoChart;
