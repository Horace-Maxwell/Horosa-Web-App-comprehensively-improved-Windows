// 奇门页 · 中栏九宫盘外壳:盘面随窗口缩放、装配 <DunJiaBoard>(宫格本体只在 DunJiaBoard 一处);行内悬停释义给右栏用
// 从 DunJiaMain.js 按职责拆出的 DunJiaMain 方法:this 仍是 DunJiaMain 实例,门面里 mixinMethods(DunJiaMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { visualFloorRatio } from '../../../utils/zoomDomain';
import { Popover } from 'antd';
import { XQStageEmpty } from '../../xq-ui';
import { buildQimenXiangTipObj, formatQimenDocLineToHtml } from '../QimenXiangDoc';
import DunJiaBoard from '../DunJiaBoard';
import { clamp } from '../qimenPageShared';
import { createDeferredResizeObserver } from '../../../utils/deferredResizeObserver';
import { DUNJIA_BOARD_BASE_WIDTH, DUNJIA_BOARD_BASE_HEIGHT, DUNJIA_SCALE_MIN, DUNJIA_SCALE_MAX } from './options';
import { getViewportHeight } from './pageState';

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

	handleWindowResize(){
		const viewportHeight = getViewportHeight();
		const leftBoardWidth = this.leftBoardHost ? this.leftBoardHost.clientWidth : 0;
		const leftBoardHeight = this.leftBoardHost ? this.leftBoardHost.clientHeight : 0;
		const changed = Math.abs((this.state.leftBoardWidth || 0) - leftBoardWidth) >= 2
			|| Math.abs((this.state.leftBoardHeight || 0) - leftBoardHeight) >= 2
			|| Math.abs((this.state.viewportHeight || 0) - viewportHeight) >= 2;
		if(changed){
			this.setState({
				leftBoardWidth,
				leftBoardHeight,
				viewportHeight,
			});
		}
	},

	calcBoardScale(){
		const viewH = this.state.viewportHeight || 900;
		const availW = this.state.leftBoardWidth > 0 ? (this.state.leftBoardWidth - 22) : DUNJIA_BOARD_BASE_WIDTH;
		const availH = this.state.leftBoardHeight > 0 ? (this.state.leftBoardHeight - 12) : (viewH - 96);
		const widthScale = availW / DUNJIA_BOARD_BASE_WIDTH;
		const heightScale = availH / DUNJIA_BOARD_BASE_HEIGHT;
		// 遁甲盘直接铺在中心栏里，缩放以实际容器高宽为准，不再预留旧卡片外框空间。
		let rawScale = Math.min(widthScale, heightScale);
		if(!Number.isFinite(rawScale) || rawScale <= 0){
			return 1;
		}
		// 缩放下限 0.58 是 CSS px 口径的可读底线;壳放大档(z>1)下布局视口只有 1728/z 宽,
		// 1.8 档中栏 361×440 按比例只能到 0.49,被 0.58 撑住后盘 384×505 > 栏宽 → 九宫第三列被裁、表头顶出舞台。
		// 底线改按视觉口径(÷z,与 zoomDomain.visualFloorPx 同一法则):1.8 档下限 0.32,盘按比例缩进栏里;z≤1 逐字不变。
		return clamp(rawScale, visualFloorRatio(DUNJIA_SCALE_MIN), DUNJIA_SCALE_MAX);
	},

	renderQimenDocPopover(tipObj){
		if(!tipObj){
			return null;
		}
		const blocks = Array.isArray(tipObj.blocks) ? tipObj.blocks : [];
		return (
			<div style={{ maxWidth: 560, maxHeight: 460, overflowY: 'auto', paddingRight: 4 }}>
				<div style={{ fontSize: 17, lineHeight: '24px', fontWeight: 700, color: 'var(--horosa-text, #1f1f1f)' }}>
					{tipObj.title}
				</div>
				<div style={{ borderTop: '1px solid var(--horosa-border, #d9d9d9)', margin: '6px 0 8px' }} />
				{blocks.map((block, idx)=>{
					if(!block){
						return null;
					}
					if(block.type === 'blank'){
						return <div key={`qimen_doc_blank_${idx}`} style={{ height: 6 }} />;
					}
					if(block.type === 'divider'){
						return <div key={`qimen_doc_divider_${idx}`} style={{ borderTop: '1px solid var(--horosa-border, #e8e8e8)', margin: '6px 0' }} />;
					}
					if(block.type === 'subTitle'){
						return (
							<div key={`qimen_doc_subtitle_${idx}`} style={{ margin: '4px 0 6px' }}>
								<div style={{ fontSize: 14, lineHeight: '20px', fontWeight: 700, color: 'var(--horosa-text, #262626)' }}>{block.text}</div>
								<div style={{ borderTop: '1px solid var(--horosa-border, #efefef)', marginTop: 4 }} />
							</div>
						);
					}
					const html = formatQimenDocLineToHtml(block.text || '');
					return (
						<div
							key={`qimen_doc_text_${idx}`}
							style={{ fontSize: 13, lineHeight: '21px', color: 'var(--horosa-text, #262626)', whiteSpace: 'pre-wrap' }}
							dangerouslySetInnerHTML={{ __html: html }}
						/>
					);
				})}
			</div>
		);
	},

	// ⑥ 行内悬浮:把与盘面同款的奇门象意 hover 套到 header 行内元素(年月日时天干 / 值符=九星 / 值使=八门),不破坏行内排版。
	renderQimenHoverInline(type, text, child, key){
		const tipObj = buildQimenXiangTipObj(type, `${text || ''}`.trim());
		if(!tipObj){
			return child;
		}
		return (
			<Popover
				key={key}
				trigger="hover"
				placement="bottom"
				content={this.renderQimenDocPopover(tipObj)}
				overlayStyle={{ maxWidth: 600 }}
			>
				<span style={{ cursor: 'help' }}>{child}</span>
			</Popover>
		);
	},

	renderBoard(){
		const pan = this.state.pan;
		if(!this.state.hasPlotted){
			return <XQStageEmpty>点击左侧“起盘”后显示遁甲盘</XQStageEmpty>;
		}
		if(!pan){
			return <XQStageEmpty>暂无遁甲盘数据</XQStageEmpty>;
		}
		// 盘面九宫×~45 Popover + 表头悬浮抽进 <DunJiaBoard>(sCU 按 pan/boardScale 守门),父无关 setState 不再重建整盘。
		// 渲染内容与原内联实现逐字一致(byte-perfect),仅多一层纯透传组件;kill-switch=chartSCU 关。
		// 盘下「十二建星」按钮与左栏同一键(showJianChu):改值走 onOptionChange(落盘 + 重排),盘随 pan.jianChu 出 / 收外环
		return <DunJiaBoard pan={pan} boardScale={this.calcBoardScale()} onToggleJianChu={()=>this.onOptionChange('showJianChu', !(this.state.options && this.state.options.showJianChu))} />;
	},
};
