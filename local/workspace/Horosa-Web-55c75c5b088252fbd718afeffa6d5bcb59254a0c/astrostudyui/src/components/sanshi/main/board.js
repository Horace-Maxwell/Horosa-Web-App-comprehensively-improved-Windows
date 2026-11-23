// 三式合一页 · 中栏盘面:尺寸随窗口、左侧盘
// 从 SanShiUnitedMain.js 按职责拆出的 SanShiUnitedMain 方法:this 仍是 SanShiUnitedMain 实例,门面里 mixinMethods(SanShiUnitedMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { XQStageEmpty } from '../../xq-ui';
import SanshiUnitedBoard from '../SanshiUnitedBoard';
import { getEffectiveScale, visualFloorPx } from '../../../utils/zoomDomain';
import { clamp } from '../../dunjia/qimenPageShared';
import { createDeferredResizeObserver } from '../../../utils/deferredResizeObserver';
import { SANSHI_BOARD_MIN, SANSHI_BOARD_MAX, SANSHI_BOARD_READABLE_MIN } from './options';
import { getViewportHeight } from './format';
import { memo } from 'react';
import { getDeclaredZoom } from '../../../utils/zoomDomain';

// [S4 已收敛 v3.10.0] SanShiBoardLayer 退役:盘面单源迁至共享 SanshiUnitedBoard(上游),
// 渲染隔离由下方 MemoSanshiUnitedBoard(React.memo,浅比)承接 —— 语义与原 wrapperPropsEqual 等价。
// horosa_sanshi_render_slice_v1(S4 残差):共享盘无自带 memo,壳层 props 全引用稳定 ⇒ 浅比隔离盘面重绘。
// 惰性包一次:本文件与 SanshiUnitedBoard 互为 import(同一导入环),模块求值期不得把对方的绑定交给任何调用
// (importCycleContract ①:交出去的函数也可能被当场调用);首次画盘时才 memo(…),此后恒用同一包装(组件身份稳定、不重挂)。
let memoSanshiUnitedBoard = null;
function getMemoSanshiUnitedBoard(){
	if(!memoSanshiUnitedBoard){ memoSanshiUnitedBoard = memo(SanshiUnitedBoard); }
	return memoSanshiUnitedBoard;
}

export const boardMethods = {
	captureLeftBoardHost(node){
		if(this.resizeObserver){
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}
		this.leftBoardHost = node || null;
		if(this.leftBoardHost && typeof ResizeObserver !== 'undefined'){
			this.resizeObserver = createDeferredResizeObserver(()=>{
				this.handleWindowResize();
			});
			this.resizeObserver.observe(this.leftBoardHost);
		}
		this.handleWindowResize();
	},

	captureRightPanel(node){
		this.rightPanelHost = node || null;
		this.handleWindowResize();
	},

	handleWindowResize(){
		const viewportHeight = getViewportHeight();
		const leftBoardWidth = this.leftBoardHost ? this.leftBoardHost.clientWidth : 0;
		const leftBoardHeight = this.leftBoardHost ? this.leftBoardHost.clientHeight : 0;
		// rect.top 属视觉域,与布局域 viewportHeight 相减前先除回布局域(标准化 zoom 引擎下 rect 已×z)。
		const rightTop = this.rightPanelHost ? this.rightPanelHost.getBoundingClientRect().top / (getEffectiveScale() || 1) : 0;
		const fallbackPanelHeight = Math.max(visualFloorPx(420), viewportHeight - 120);
		const rightPanelHeight = rightTop > 0
			? Math.max(220, viewportHeight - rightTop - 8)
			: fallbackPanelHeight;
		const changed = Math.abs((this.state.leftBoardWidth || 0) - leftBoardWidth) >= 2
			|| Math.abs((this.state.leftBoardHeight || 0) - leftBoardHeight) >= 2
			|| Math.abs((this.state.viewportHeight || 0) - viewportHeight) >= 2
			|| Math.abs((this.state.rightPanelHeight || 0) - rightPanelHeight) >= 2;
		if(changed){
			this.setState({
				leftBoardWidth,
				leftBoardHeight,
				viewportHeight,
				rightPanelHeight,
			});
		}
	},

	calcBoardSize(height){
		const viewH = this.state.viewportHeight || 900;
		const baseH = typeof height === 'number' ? height : viewH - 20;
		const hostH = this.state.leftBoardHeight > 0 ? this.state.leftBoardHeight : baseH;
		// 三式方盘必须完整留在中间栏内：顶部历法栏、底部旬空栏和间距先扣掉，再按宽度二次约束。
		// 方盘 380px 底线按视觉口径(÷z):壳放大档中栏只有 1728/z 宽,CSS px 底线会把方盘撑出栏外。
		const wCap = this.state.leftBoardWidth > 0 ? (this.state.leftBoardWidth - 8) : SANSHI_BOARD_MAX;
		const boardMin = Math.max(visualFloorPx(SANSHI_BOARD_MIN), Math.min(wCap, SANSHI_BOARD_READABLE_MIN));
		const hCap = Math.max(boardMin, Math.min(viewH - 340, baseH - 318, hostH - 318));
		let target = hCap;
		if(Number.isFinite(wCap) && wCap > 0){
			target = Math.min(target, wCap);
		}
		return clamp(Math.round(target), boardMin, SANSHI_BOARD_MAX);
	},
	renderLeftBoard(height){
		if(!this.state.hasPlotted){
			return <XQStageEmpty>点击左侧“起盘”后显示三式合一盘</XQStageEmpty>;
		}
		if(!this.state.dunjia){
			return <XQStageEmpty>暂无三式合一数据</XQStageEmpty>;
		}
		const boardSize = this.calcBoardSize(height);
		// 盘面绘制单源迁至 SanshiUnitedBoard(择日概览共享);此壳只装配实例态,JSX 与迁出前逐节点等价。
		const boardFields = this.state.hasPlotted
			? (this.state.plottedFields || this.state.localFields || this.props.fields)
			: this.getActiveFields();
		const MemoSanshiUnitedBoard = getMemoSanshiUnitedBoard();
		return (
			<MemoSanshiUnitedBoard
				boardSize={boardSize}
				fitWidth={this.state.leftBoardWidth > 0 ? this.state.leftBoardWidth - 8 : 0}
				chartWrap={this.state.castChart}
				dunjia={this.state.dunjia}
				lrLayout={this.state.lrLayout}
				keData={this.state.keData}
				sanChuan={this.state.sanChuan}
				nongli={this.state.nongli}
				liureng={this.state.liureng}
				fields={boardFields}
				displaySolarTime={this.state.displaySolarTime}
				outerCoord={this.state.outerCoord}
				ascRaMode={this.state.ascRaMode}
				showWeakSolid={this.state.showWeakSolid}
				showJianChu={!!(this.state.options && this.state.options.showJianChu)}
				zoomTick={getDeclaredZoom()}   // 盘格附注的几何按界面缩放算(盘内直接读全局缩放):缩放档进浅比,换档必重画,不靠「换档恰好也改了盘宽」
				showAstroMeaning={this.props.showAstroMeaning}
			/>
		);
	},
};
