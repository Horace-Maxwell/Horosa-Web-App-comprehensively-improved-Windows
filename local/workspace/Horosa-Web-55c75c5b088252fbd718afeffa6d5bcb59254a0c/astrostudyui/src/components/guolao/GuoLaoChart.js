import * as d3 from 'd3';
import { Component } from 'react';
import { Row, Col, Tabs, DatePicker, Input, Button, Card, Select } from 'antd';
import {randomStr,} from '../../utils/helper';
import * as AstroConst from '../../constants/AstroConst';
import GLChart from './GLChart';
import * as SZConst from '../suzhan/SZConst';

const SQUARE_SIDE_MIN = 620;
const SQUARE_SIDE_MAX = 980;
const SQUARE_SIDE_FALLBACK = 740;
const VIEWPORT_BOTTOM_GAP = 28;

function clamp(val, min, max){
	return Math.max(min, Math.min(max, val));
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
		this.getChartShape = this.getChartShape.bind(this);
		this.updateSquareSide = this.updateSquareSide.bind(this);
		this.handleResize = this.handleResize.bind(this);
		this.scheduleDrawRetry = this.scheduleDrawRetry.bind(this);
	}

	getChartShape(){
		const fields = this.props.fields || {};
		if(fields.szshape !== undefined && fields.szshape !== null &&
			fields.szshape.value !== undefined && fields.szshape.value !== null){
			const parsed = parseInt(fields.szshape.value, 10);
			if(Number.isFinite(parsed)){
				return parsed;
			}
		}
		return SZConst.SZChart.shape;
	}

	updateSquareSide(){
		if(this.getChartShape() !== SZConst.SZChart_Square){
			return;
		}

		const parseNum = (v)=>{
			if(typeof v === 'number' && Number.isFinite(v)){
				return v;
			}
			if(typeof v === 'string'){
				const txt = v.trim();
				if(/^[-+]?\d+(\.\d+)?(px)?$/i.test(txt)){
					const n = parseFloat(txt);
					if(Number.isFinite(n)){
						return n;
					}
				}
			}
			return null;
		};
		const pickFirstPositive = (vals)=>{
			for(let i=0; i<vals.length; i++){
				const v = vals[i];
				if(typeof v === 'number' && Number.isFinite(v) && v > 0){
					return v;
				}
			}
			return null;
		};

		const propH = parseNum(this.props.height);
		const propW = parseNum(this.props.width);

		let parentW = 0;
		let parentH = 0;
		let viewportRemainH = 0;
		const svgdom = document.getElementById(this.state.chartid);
		if(svgdom){
			const parent = svgdom.parentElement;
			parentW = parent ? parent.clientWidth : svgdom.clientWidth;
			parentH = parent ? parent.clientHeight : svgdom.clientHeight;

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
				viewportRemainH = bottomLimit - rect.top - VIEWPORT_BOTTOM_GAP;
			}
		}

		const availableWidth = pickFirstPositive([parentW, propW]);
		const availableHeight = pickFirstPositive([viewportRemainH, parentH, propH]);

		let side = availableHeight || availableWidth || SQUARE_SIDE_FALLBACK;
		side = clamp(side, SQUARE_SIDE_MIN, SQUARE_SIDE_MAX);

		if(availableHeight){
			side = Math.min(side, availableHeight);
		}
		if(availableWidth){
			side = Math.min(side, availableWidth);
		}

		if(!Number.isFinite(side) || side <= 0){
			side = SQUARE_SIDE_FALLBACK;
		}
		side = Math.round(side);

		if(this.state.lockedSide === null || Math.abs(this.state.lockedSide - side) >= 4){
			this.setState({ lockedSide: side });
		}
	}

	handleResize(){
		if(this.getChartShape() === SZConst.SZChart_Square){
			this.updateSquareSide();
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
	}

	componentDidUpdate(){
		if(this.getChartShape() === SZConst.SZChart_Square){
			this.updateSquareSide();
		}
		this.drawChart();
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
		const isSquareChart = this.getChartShape() === SZConst.SZChart_Square;
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
			const side = this.state.lockedSide || SQUARE_SIDE_FALLBACK;
			chartstyle.width = `${side}px`;
			chartstyle.height = `${side}px`;
			chartstyle.display = 'block';
			if(!chartstyle.margin){
				chartstyle.margin = '0 auto';
			}
		}

		return (
			<svg id={this.state.chartid} style={chartstyle}>
			</svg>
		)
	}
}

export default GuoLaoChart;
