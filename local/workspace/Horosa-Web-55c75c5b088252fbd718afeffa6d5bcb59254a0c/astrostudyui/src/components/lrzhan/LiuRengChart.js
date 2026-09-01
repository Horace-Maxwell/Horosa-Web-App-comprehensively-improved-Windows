import * as d3 from 'd3';
import React, { Component } from 'react';
import { Modal } from 'antd';
import {randomStr, setupFloatingTooltip} from '../../utils/helper';
import * as AstroConst from '../../constants/AstroConst';
import RengChart from './RengChart';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';

class LiuRengChart extends Component{
	constructor(props) {
		super(props);
		let svgid = this.props.id ? 'svg' + this.props.id : 'svg' + randomStr(8);
		this.state = {
			chartid: svgid,
			ox: 0,
			oy: 0,
			radius: 0,
			tooltipId: 'div' + randomStr(8),
			metaDialog: null,
		};

		this.openMetaDialog = this.openMetaDialog.bind(this);
		this.closeMetaDialog = this.closeMetaDialog.bind(this);

		let opt = {
			id: svgid,
			fields: this.props.fields,
			tooltipId: this.state.tooltipId,
			chartObj: null,
			nongli: this.props.nongli,
			liureng: this.props.liureng,
			runyear: this.props.runyear,
			gender: this.props.gender,
			zhangshengElem: this.props.zhangshengElem,
			guireng: this.props.guireng,
			castOverride: this.props.castOverride,
			panStyleName: this.props.panStyleName,
			onMetaInfoClick: this.openMetaDialog,
			chartType: this.props.chartType,
			compactPreview: this.props.compactPreview,
		};
		this.rengchart = new RengChart(opt);

		this.drawChart = this.drawChart.bind(this);
		this.safeDrawChart = this.safeDrawChart.bind(this);
		this.handleResize = this.handleResize.bind(this);
		this.setupToolTip = this.setupToolTip.bind(this);
	}

	// [PERF-R9 Ship 6] 盘面组件 sCU —— 与 DunJiaBoard 同范式,但比它更保守:
	//   · 本组件自身 state 变(metaDialog 开合)→ 恒重渲;
	//   · props 只要有任一项变(wrapperPropsEqual 全键机械浅比,函数型视为恒等)→ 恒重渲,
	//     故 componentDidUpdate 里那 10 项 props 的 d3 重画判据【一次都不会被吞掉】(props 变必渲,
	//     渲了 didUpdate 必跑,判据原样)。本 sCU 只吃掉「props 与 state 都没变」的那种纯冗余重渲
	//     —— 那种情况下旧代码走完 render 后 componentDidUpdate 的 10 项比较也全等、什么都不做,
	//     即跳过前后行为逐字节一致(只少付一次 svg+Modal 的 reconcile)。
	//   · 触发源:父组件 LiuRengMain/SanShiUnitedMain 因右栏子页签、选中态、loading 等无关 state
	//     重渲时会带着完全相同的 props 下来,而六壬主盘是本族最重的 DOM。
	//   · kill-switch:horosa.perf.chartSCU=0 → wrapperPropsEqual 恒返 false = 恒重渲旧行为。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){
			return true;
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}

	openMetaDialog(payload){
		this.setState({
			metaDialog: payload,
		});
	}

	closeMetaDialog(){
		this.setState({
			metaDialog: null,
		});
	}

	handleResize(){
		// 读 host(真实可视容器)而非 svg 自身——svg 可能已被 RengChart 撑高(≥440/720),
		// 旧实现 h<560 直接 return 让缩窗后常常根本不重画,留下上一尺寸的盘(下端超界的帮凶)。
		const svgdom = document.getElementById(this.state.chartid);
		if(!svgdom){
			return;
		}
		const hostEl = svgdom.parentNode;
		const w = hostEl && hostEl.clientWidth ? hostEl.clientWidth : svgdom.clientWidth;
		const h = hostEl && hostEl.clientHeight ? hostEl.clientHeight : svgdom.clientHeight;
		if(w < 200 || h < 120){
			return; // 仅防折叠/隐藏态
		}
		if(this._resizeRaf && typeof cancelAnimationFrame === 'function'){
			cancelAnimationFrame(this._resizeRaf);
		}
		// 隐藏页(最小化/headless)rAF 完全挂起:降级 setTimeout,恢复可见前几何也保持正确。
		if(typeof document !== 'undefined' && document.hidden){
			this._resizeRaf = null;
			setTimeout(()=>{ this.safeDrawChart(); }, 50);
			return;
		}
		this._resizeRaf = requestAnimationFrame(()=>{
			this._resizeRaf = null;
			this.safeDrawChart();
		});
	}

	drawChart(){
		let chartobj = this.props.value;
		if(chartobj === undefined || chartobj === null){
			return;
		}
		
		this.rengchart.fields = this.props.fields;
		this.rengchart.chart = chartobj;
		this.rengchart.nongli = chartobj.nongli;
		this.rengchart.liureng = this.props.liureng;
		this.rengchart.runyear = this.props.runyear;
		this.rengchart.gender = this.props.gender;
		this.rengchart.zhangshengElem = this.props.zhangshengElem;
		this.rengchart.guireng = this.props.guireng;
		this.rengchart.castOverride = this.props.castOverride;
		this.rengchart.panStyleName = this.props.panStyleName || '';
		this.rengchart.onMetaInfoClick = this.openMetaDialog;
		this.rengchart.chartType = this.props.chartType;
		this.rengchart.compactPreview = !!this.props.compactPreview;

		this.rengchart.draw();
	}

	safeDrawChart(){
		try{
			this.drawChart();
		}catch(e){
			if(typeof console !== 'undefined' && console.error){
				console.error('[LiuRengChart] draw failed', e);
			}
		}
	}

	componentDidMount(){
		window.addEventListener('resize', this.handleResize)
		d3.select('body').append('div').attr('id', this.state.tooltipId);
		const tip = d3.select('#' + this.state.tooltipId);
		this.setupToolTip(tip);
		// host 尺寸变化(侧栏收合等不触发 window resize 的场景)也要重画——观察 host 而非 svg
		// (svg 高度被 RengChart 自己改写,观察它会自触发循环)。
		const svgdom = document.getElementById(this.state.chartid);
		if(svgdom && svgdom.parentNode && typeof window !== 'undefined' && typeof window.ResizeObserver === 'function'){
			this.hostResizeObserver = new window.ResizeObserver(()=>{
				this.handleResize();
			});
			this.hostResizeObserver.observe(svgdom.parentNode);
		}
		this.safeDrawChart();
	}

	componentDidUpdate(prevProps){
		if(prevProps.value !== this.props.value
			|| prevProps.liureng !== this.props.liureng
			|| prevProps.runyear !== this.props.runyear
			|| prevProps.gender !== this.props.gender
			|| prevProps.zhangshengElem !== this.props.zhangshengElem
			|| prevProps.guireng !== this.props.guireng
			|| prevProps.castOverride !== this.props.castOverride
			|| prevProps.panStyleName !== this.props.panStyleName
			|| prevProps.chartType !== this.props.chartType
			|| prevProps.compactPreview !== this.props.compactPreview){
			this.safeDrawChart();
		}
	}

	componentWillUnmount() {
		window.removeEventListener('resize', this.handleResize)
		if(this._resizeRaf && typeof cancelAnimationFrame === 'function'){
			cancelAnimationFrame(this._resizeRaf);
			this._resizeRaf = null;
		}
		if(this.hostResizeObserver){
			this.hostResizeObserver.disconnect();
			this.hostResizeObserver = null;
		}
		d3.select('#' + this.state.tooltipId).remove();
	}

	setupToolTip(divTooltip){
		if(divTooltip){
			setupFloatingTooltip(divTooltip, {
				width: 'auto',
				'max-width': '560px',
				'min-width': '220px',
				'max-height': '62vh',
				'overflow-y': 'auto',
				padding: '8px 10px',
				font: '13px sans-serif',
				background: 'var(--horosa-surface-solid, #ffffff)',  // 悬浮层铁律:绝对不透明(raised 带 0.97 透明)
				color: 'var(--horosa-text, #262626)',
				border: '1px solid var(--horosa-border, #e8e8e8)',
				'border-radius': '8px',
				'box-shadow': '0 6px 18px rgba(0,0,0,0.16)',
			});
		}
	}

	render(){
		let chartstyle = {
			width: this.props.width ? this.props.width : '100%',
			height: this.props.height ? this.props.height : '100%',
			backgroundColor: 'var(--horosa-astro-panel, #090b0e)',
		};

		if(this.props.style){
			chartstyle = this.props.style;
		}

		const metaDialog = this.state.metaDialog;
		const metaRows = metaDialog && Array.isArray(metaDialog.gods) ? metaDialog.gods : [];

		return (
			<>
				<svg id={this.state.chartid} style={chartstyle}>
				</svg>
				<Modal
					visible={!!metaDialog}
					title={metaDialog ? metaDialog.title : ''}
					footer={null}
					onCancel={this.closeMetaDialog}
					width={420}
					className="horosa-liureng-meta-modal"
					destroyOnClose
				>
					<div className="horosa-liureng-meta-list">
						{metaRows.length ? metaRows.map((item, idx)=>(
							<div className="horosa-liureng-meta-row" key={`${item.key}_${idx}`}>
								<span>{item.key}</span>
								<strong>{item.value}</strong>
							</div>
						)) : (
							<div className="horosa-liureng-meta-empty">暂无信息</div>
						)}
					</div>
				</Modal>
			</>
		)
	}
}

export default LiuRengChart;
