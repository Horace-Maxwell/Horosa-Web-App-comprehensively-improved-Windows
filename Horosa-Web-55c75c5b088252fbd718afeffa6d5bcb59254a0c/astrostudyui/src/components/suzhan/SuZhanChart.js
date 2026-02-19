import * as d3 from 'd3';
import { Component } from 'react';
import { Row, Col, Tabs, DatePicker, Input, Button, Card, Select } from 'antd';
import {randomStr,} from '../../utils/helper';
import * as AstroConst from '../../constants/AstroConst';
import * as SZConst from './SZConst';
import SZChart from './SZChart';

const SQUARE_SIDE_MIN = 480;
const SQUARE_SIDE_MAX = 1100;
const SUZHAN_SCALE_MIN = 0.45;
const SUZHAN_SCALE_MAX = 1.35;
const SUZHAN_FONT_STACK = "'Microsoft YaHei', 'PingFang SC', 'Noto Sans CJK SC', 'Source Han Sans SC', sans-serif";

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
		this.measureSquareSide = this.measureSquareSide.bind(this);
	}

	measureSquareSide(){
		const svgdom = document.getElementById(this.state.chartid);
		const host = svgdom && svgdom.parentElement ? svgdom.parentElement : null;
		let hostWidth = host && host.clientWidth ? host.clientWidth : 0;
		let hostHeight = 0;
		if(typeof this.props.height === 'number'){
			hostHeight = this.props.height;
		}else if(svgdom && svgdom.clientHeight){
			hostHeight = svgdom.clientHeight;
		}else if(typeof window !== 'undefined'){
			hostHeight = Math.max(320, (window.innerHeight || 900) - 180);
		}
		if(!hostWidth && typeof window !== 'undefined'){
			hostWidth = Math.round((window.innerWidth || 1200) * 0.66);
		}
		let side = hostWidth;
		if(hostHeight > 0){
			side = Math.min(hostWidth, hostHeight);
		}
		if(!side || side <= 0){
			side = 700;
		}
		return clamp(Math.round(side), SQUARE_SIDE_MIN, SQUARE_SIDE_MAX);
	}

	updateSquareSide(force){
		// 如果已经有固定的尺寸，保持不变（不随窗口调整）
		if (!force && this.state.lockedSide !== null && this.state.lockedSide > 0) {
			return;
		}
		const side = this.measureSquareSide();
		if (this.state.lockedSide === null || Math.abs(this.state.lockedSide - side) >= 2) {
			this.setState({ lockedSide: side });
		}
	}

	// 重置方形盘尺寸（当需要重新计算时调用）
	resetSquareSide() {
		this.setState({ lockedSide: null });
		this.updateSquareSide(true);
	}

	handleResize(){
		const szshape = this.props.fields && this.props.fields.szshape
			? parseInt(this.props.fields.szshape.value, 10)
			: SZConst.SZChart.shape;
		if(szshape === SZConst.SZChart_Square){
			// 方形盘：一旦初始化完成就保持尺寸不变，不再随窗口调整
			if (this.state.lockedSide === null) {
				this.updateSquareSide();
			}
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
		this.updateSquareSide(true);
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
		// 当切换到方形盘时，重置尺寸并重新计算
		if(prevShape !== nextShape && nextShape === SZConst.SZChart_Square){
			this.resetSquareSide();
		}
		// 首次渲染方形盘时计算尺寸
		if(nextShape === SZConst.SZChart_Square && this.state.lockedSide === null){
			this.updateSquareSide(true);
		}
	}

	render(){
		const szshape = this.props.fields && this.props.fields.szshape
			? parseInt(this.props.fields.szshape.value, 10)
			: SZConst.SZChart.shape;
		const isSquareChart = szshape === SZConst.SZChart_Square;
		let chartstyle = {
			backgroundColor: AstroConst.AstroColor.ChartBackgroud,
			fontFamily: SUZHAN_FONT_STACK,
		};

		// 方形盘：始终强制设置宽高为正方形，不受外部props影响
		if(isSquareChart){
			const side = this.state.lockedSide || 740;
			chartstyle.width = `${side}px`;
			chartstyle.height = `${side}px`;
		}else{
			// 非方形盘：使用默认样式
			chartstyle.width = this.props.width ? this.props.width : '100%';
			chartstyle.height = this.props.height ? this.props.height : '100%';
		}

		// 外部传入的style只在非方形盘时合并，方形盘必须保持正方形
		if(this.props.style && !isSquareChart){
			chartstyle = {
				...chartstyle,
				...this.props.style,
			};
		}

		this.drawChart();

		return (
			<svg id={this.state.chartid} style={chartstyle}>
			</svg>
		)
	}
}

export default SuZhanChart;
