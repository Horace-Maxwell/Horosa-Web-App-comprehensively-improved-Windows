import { Component } from 'react';
import {randomStr} from '../../utils/helper';
import Astro3D from './Astro3D';
import * as AstroConst from '../../constants/AstroConst';
import {launchFullScreen, exitFullScreen, checkFullScreen} from '../../utils/helper';

class AstroChart3D extends Component{

	constructor(props) {
		super(props);
		let svgid = this.props.id ? 'div3d' + this.props.id : 'div3d' + randomStr(8);

		this.state = {
			chartid: svgid,
		}
		this.fullScreen = false;

		this.astro3d = null;

		this.getChartParams = this.getChartParams.bind(this);
		this.handleResize = this.handleResize.bind(this);
		this.drawChart = this.drawChart.bind(this);
		this.doubleClick = this.doubleClick.bind(this);
	}

	handleResize(){
		let svgdom = document.getElementById(this.state.chartid);
		if(svgdom === undefined || svgdom === null){
			return;
		}

		let w = svgdom.clientWidth;
		let h = svgdom.clientHeight;

		let flag = checkFullScreen();
		if(!this.fullScreen){
			this.width = w;
			this.height = h;	
		}else{
			if(flag){
				setTimeout(()=>{
					w = this.orgWidth;
					h = this.orgHeight;	
					if(this.flip){
						w = window.screen.width;
						h = window.screen.height;
						this.flip = false;
						this.waitEsc = true;
					}
					svgdom.style.width = w + 'px';
					svgdom.style.height = h + 'px';
					this.astro3d.resize(w, h);	
				}, 100);
			}else{
				setTimeout(()=>{
					if(this.waitEsc){
						w = this.width;
						h = this.height;
						this.waitEsc = false;
					}
					svgdom.style.width = w + 'px';
					svgdom.style.height = h + 'px';
					this.astro3d.resize(w, h);	
				}, 100);
			}
			return;
		}

		this.astro3d.resize(w, h);

	}

	doubleClick(){
		let svgdom = document.getElementById(this.state.chartid);
		if(svgdom === undefined || svgdom === null){
			return;
		}

		if(this.fullScreen){
			this.fullScreen = false;
			exitFullScreen();
			let w = this.width;
			let h = this.height;
			svgdom.style.width = w + 'px';
			svgdom.style.height = h + 'px';	
		}else{
			this.orgHeight = this.height;
			this.orgWidth = this.width;
			this.fullScreen = true;
			launchFullScreen(svgdom);
			let w = window.screen.width;
			let h = window.screen.height;
			svgdom.style.width = w + 'px';
			svgdom.style.height = h + 'px';	
			this.flip = true;
		}
	}

	getChartParams(){
		let disp = [];
		if(this.props.chartDisplay !== undefined && this.props.chartDisplay !== null){
			disp = this.props.chartDisplay;
		}
		let planetDisp = new Set();
		if(this.props.planetDisplay !== undefined && this.props.planetDisplay !== null){
			for(let i=0; i<this.props.planetDisplay.length; i++){
				let id = this.props.planetDisplay[i];
				planetDisp.add(id);
			}
		}
		if(this.props.lotsDisplay !== undefined && this.props.lotsDisplay !== null){
			for(let i=0; i<this.props.lotsDisplay.length; i++){
				let id = this.props.lotsDisplay[i];
				planetDisp.add(id);
			}
		}

		let keyplanets = null;
		if(this.props.keyPlanets){
			keyplanets = this.props.keyPlanets;
		}

		return {
			planetDisp: planetDisp,
			chartDisp: disp,
			keyPlanets: keyplanets,
		};
	}

	drawChart(){
		if(!this.props.needChart3D){
			if(this.astro3d !== undefined && this.astro3d !== null){
				this.astro3d.hide = true;
			}
			return;
		}
		if(this.astro3d){
			this.astro3d.hide = false;
		}

		let chartobj = this.props.value;
		if(chartobj === undefined || chartobj === null || 
			chartobj.chart === undefined || chartobj.chart === null || chartobj.err){
			return;
		}
		
		let svgdom = document.getElementById(this.state.chartid);
		if(svgdom === undefined || svgdom === null){
			return;
		}
		let w = svgdom.clientWidth;
		let h = svgdom.clientHeight;
		if(h < 260 || w < 260){
			return;
		}

		let chartparams = this.getChartParams();

		let opt = {
			width: w,
			height: h,
			chartId: this.state.chartid,
			chartObj: chartobj,
			fields: this.props.fields,
			chartDisp: chartparams.chartDisp,
			planetDisp: chartparams.planetDisp,
			keyPlanets: chartparams.keyPlanets,
		}

		let oldastro = this.astro3d;
		if(oldastro){
			oldastro.setParams(opt);
		}else{
			svgdom.innerHTML = '';
			this.astro3d = new Astro3D(opt);
			this.astro3d.init();	
		}
	}

	componentDidMount(){
		window.addEventListener('resize', this.handleResize);
		this.drawChart();

		let svgdom = document.getElementById(this.state.chartid);
		if(svgdom){
			this.width = svgdom.clientWidth;
			this.height = svgdom.clientHeight;
			this.orgWidth = this.width;
			this.orgHeight = this.height;
		}
	}

	componentDidUpdate(prevProps){
		const needRedraw =
			prevProps.needChart3D !== this.props.needChart3D
			|| prevProps.value !== this.props.value
			|| prevProps.fields !== this.props.fields
			|| prevProps.chartDisplay !== this.props.chartDisplay
			|| prevProps.planetDisplay !== this.props.planetDisplay
			|| prevProps.lotsDisplay !== this.props.lotsDisplay
			|| prevProps.height !== this.props.height
			|| prevProps.width !== this.props.width
			|| prevProps.style !== this.props.style;
		if(needRedraw){
			this.drawChart();
		}
	}

	componentWillUnmount() {
		window.removeEventListener('resize', this.handleResize);
		try{
			if(this.astro3d){
				this.astro3d.dispose()
			}	
		}catch(e){
		}
	}

	render(){
		let height = '100%';
		if(this.props.height){
			height = this.props.height - 50;
		}
		let chartstyle = {
			width: this.props.width ? this.props.width : '100%',
			height: height,
			backgroundColor: AstroConst.AstroColor.ChartBackgroud,
		};

		if(this.props.style){
			chartstyle = this.props.style;
		}

		return (
			<div id={this.state.chartid} style={chartstyle} 
				onDoubleClick={this.doubleClick}
			>
			</div>
		)
	}
}

export default AstroChart3D;
