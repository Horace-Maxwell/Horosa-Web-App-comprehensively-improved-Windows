import * as d3 from 'd3';
import { Component } from 'react';
import { Row, Col, Tabs, DatePicker, Input, Button, Card, Select } from 'antd';
import {randomStr,} from '../../utils/helper';
import * as AstroConst from '../../constants/AstroConst';
import * as SZConst from './SZConst';
import SZChart from './SZChart';

const SQUARE_SIDE_MIN = 620;
const SQUARE_SIDE_MAX = 980;

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
			const parentW = parent ? parent.clientWidth : 0;
			const parentH = parent ? parent.clientHeight : 0;
			if(parentW > 0 && parentH > 0){
				sideByContainer = Math.min(parentW, parentH);
			}else if(parentW > 0){
				sideByContainer = parentW;
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
		
		this.szchart.chartDisp = flags;
		this.szchart.planetDisp = planetDisp;
		this.szchart.fields = this.props.fields;
		this.szchart.chart = chartobj;

		this.szchart.draw();
	}

	componentDidMount(){
		window.addEventListener('resize', this.handleResize);
		d3.select('body').append('div').attr('id', this.state.tooltipId);
		this.updateSquareSide();
		this.drawChart();
	}

	componentWillUnmount() {
		window.removeEventListener('resize', this.handleResize);
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
		}
		if(nextShape === SZConst.SZChart_Square){
			this.updateSquareSide();
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
		}

		this.drawChart();

		return (
			<svg id={this.state.chartid} style={chartstyle}>
			</svg>
		)
	}
}

export default SuZhanChart;
