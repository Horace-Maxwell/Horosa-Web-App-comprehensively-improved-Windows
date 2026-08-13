import { Component } from 'react';
import {randomStr} from '../../utils/helper';
import Astro3D from './Astro3D';
import * as AstroConst from '../../constants/AstroConst';
import {launchFullScreen, exitFullScreen, checkFullScreen, onFullScreenChange} from '../../utils/helper';

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
		this.handleFullScreenChange = this.handleFullScreenChange.bind(this);
		this.syncCanvasSize = this.syncCanvasSize.bind(this);
		this.unsubscribeFullScreen = null;
		this._styleBeforeFull = null;
	}

	// horosa_fullscreen_state_v1(2026-08-13,GitHub issue #68;跨平台真 bug,建议上游化 Mac)
	//
	// 原实现:进全屏时把画布尺寸**猜**成 `window.screen.width/height`,再靠 `setTimeout(100)` +
	// `flip`/`waitEsc` 两个手写标志去追状态。三个后果(用户实报「显示不完整」「就是没法全屏」):
	//   ① `screen.*` 是**整块屏幕**的 CSS 尺寸,而全屏视口要减去 Windows 缩放/多显示器等因素 ⇒ 画不满;
	//   ② 100ms 定时器与浏览器全屏过渡是竞态,过渡慢一点就按旧尺寸画完再不更新;
	//   ③ 用户按 Esc 退出时没有任何事件回灌 ⇒ `fullScreen` 永远停在 true,**此后双击再也进不去全屏**。
	// 现改为「事件驱动 + 真实测量」:状态一律读 `checkFullScreen()`(即 fullscreenElement),
	// 尺寸一律量**元素自己的盒子**(全屏时它就是全屏视口),并在 rAF 里量以确保过渡已落定。
	syncCanvasSize(){
		const svgdom = document.getElementById(this.state.chartid);
		if(!svgdom || !this.astro3d){
			return;
		}
		const isFull = checkFullScreen();
		if(isFull){
			// 全屏:元素已升到 top-layer,其视口即全屏区域。用 innerWidth/innerHeight 兜底
			// (个别实现里过渡首帧 clientWidth 仍是旧值)。
			const w = Math.max(svgdom.clientWidth, window.innerWidth || 0);
			const h = Math.max(svgdom.clientHeight, window.innerHeight || 0);
			svgdom.style.width = `${w}px`;
			svgdom.style.height = `${h}px`;
			this.astro3d.resize(w, h);
			return;
		}
		// 非全屏:把进全屏前的内联尺寸**原样还原**。
		// ⚠️ 这里不能简单清空:该 div 的 width/height 是 React 经 style prop 写下的内联样式,
		// 清空后在下一次重渲染之前它就没有尺寸了(退出全屏会看到画布塌掉)。
		// 故进全屏那一刻精确捕获、退出时逐字写回。
		if(this._styleBeforeFull){
			svgdom.style.width = this._styleBeforeFull.width;
			svgdom.style.height = this._styleBeforeFull.height;
			this._styleBeforeFull = null;
		}
		const w = svgdom.clientWidth;
		const h = svgdom.clientHeight;
		if(w > 0 && h > 0){
			this.width = w;
			this.height = h;
		}
		this.astro3d.resize(this.width, this.height);
	}

	// 过渡未必在事件触发时就完成:量两次(下一帧 + 再下一帧),两次都按事实测量,幂等无副作用。
	scheduleSizeSync(){
		const raf = (typeof window !== 'undefined' && window.requestAnimationFrame)
			? window.requestAnimationFrame.bind(window)
			: (fn)=>setTimeout(fn, 16);
		raf(()=>{
			this.syncCanvasSize();
			raf(()=>this.syncCanvasSize());
		});
	}

	handleResize(){
		this.syncCanvasSize();
	}

	// 全屏状态由浏览器事件回灌(涵盖 Esc / F11 / 系统强制退出)—— 不再自己记标志。
	handleFullScreenChange(){
		const wasFull = !!this.fullScreen;
		this.fullScreen = checkFullScreen();
		if(this.fullScreen && !wasFull){
			// 刚进全屏:先把 React 写下的内联尺寸原样存起来,退出时才能逐字还原(见 syncCanvasSize)。
			const svgdom = document.getElementById(this.state.chartid);
			if(svgdom){
				this._styleBeforeFull = { width: svgdom.style.width, height: svgdom.style.height };
			}
		}
		this.scheduleSizeSync();
	}

	doubleClick(){
		const svgdom = document.getElementById(this.state.chartid);
		if(!svgdom){
			return;
		}
		// 以**真实状态**决定进还是出(而不是组件里那个可能已经过期的标志)。
		if(checkFullScreen()){
			exitFullScreen();
		}else{
			launchFullScreen(svgdom);
		}
		// 尺寸不在这里猜:等 fullscreenchange 回来后按真实盒子量(见 handleFullScreenChange)。
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
		// horosa_fullscreen_state_v1:全屏状态由浏览器事件回灌 —— 用户按 Esc/F11 退出时组件才不会
		// 停在过期的 fullScreen=true(那正是 issue #68「就是没法全屏」的成因:此后双击只会调 exit)。
		this.unsubscribeFullScreen = onFullScreenChange(this.handleFullScreenChange);
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
		if(this.unsubscribeFullScreen){
			this.unsubscribeFullScreen();
			this.unsubscribeFullScreen = null;
		}
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
