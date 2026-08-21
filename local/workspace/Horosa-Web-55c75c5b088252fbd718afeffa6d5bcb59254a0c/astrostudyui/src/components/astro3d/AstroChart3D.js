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
		// [Issue#68] 全屏尺寸改「实测」:旧版用 window.screen.width/height 估算(含菜单栏/Dock/缩放
		// 误差,Tauri 窗口全屏更非整屏)+ flip/waitEsc 手工状态机围绕恒真的 checkFullScreen 打补丁,
		// 结果=按 Esc 退出后状态永远对不上、画布尺寸与容器不符 →「全屏后显示不完整」。
		// 判据修为状态位后,这里只需:全屏态按视口实测、常态按容器实测,由 fullscreenchange 驱动。
		const full = checkFullScreen();
		this.fullScreen = full;
		if(full){
			const w = Math.max(1, window.innerWidth || svgdom.clientWidth);
			const h = Math.max(1, window.innerHeight || svgdom.clientHeight);
			svgdom.style.width = w + 'px';
			svgdom.style.height = h + 'px';
			if(this.astro3d){ this.astro3d.resize(w, h); }
			return;
		}
		// 退出全屏:先摘掉内联尺寸让容器回到布局尺寸,再按实测重排(rect 优先,回退 client*)。
		svgdom.style.width = '';
		svgdom.style.height = '';
		const rect = svgdom.getBoundingClientRect ? svgdom.getBoundingClientRect() : null;
		const w = Math.max(1, Math.round((rect && rect.width) || svgdom.clientWidth));
		const h = Math.max(1, Math.round((rect && rect.height) || svgdom.clientHeight));
		this.width = w;
		this.height = h;
		if(this.astro3d){ this.astro3d.resize(w, h); }
	}

	doubleClick(){
		let svgdom = document.getElementById(this.state.chartid);
		if(svgdom === undefined || svgdom === null){
			return;
		}
		// [Issue#68] 只负责进出全屏;尺寸一律交给 fullscreenchange → handleResize 实测,
		// 不再在这里按 screen.* 预写(旧版预写值与真实全屏视口不一致=显示不完整的另一半)。
		if(checkFullScreen()){
			exitFullScreen();
		}else{
			launchFullScreen(svgdom);
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
		// [Issue#68] 全屏进出必须由浏览器事件驱动:此前只有 doubleClick 手工翻 this.fullScreen,
		// 用户按 Esc / 系统退出全屏时组件毫不知情 → 状态与尺寸双双卡死(「按过 Esc 后再也全屏不了」)。
		// 四前缀全挂(Tauri WKWebView 走 webkit 前缀)。
		['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach((evt)=>{
			document.addEventListener(evt, this.handleResize);
		});
		this.drawChart();

		let svgdom = document.getElementById(this.state.chartid);
		if(svgdom){
			const rect = svgdom.getBoundingClientRect ? svgdom.getBoundingClientRect() : null;
			this.width = Math.max(1, Math.round((rect && rect.width) || svgdom.clientWidth));
			this.height = Math.max(1, Math.round((rect && rect.height) || svgdom.clientHeight));
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
		['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach((evt)=>{
			document.removeEventListener(evt, this.handleResize);
		});
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
			position: 'relative',
			overflow: 'hidden',
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
