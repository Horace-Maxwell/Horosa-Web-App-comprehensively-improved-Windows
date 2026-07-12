import React, { Component } from 'react';
import { safeLocalStorageSet } from '../../utils/safeStorage';
import { freezeInactiveTabsEnabled } from '../../utils/perfFlags';
import TechniqueErrorBoundary from '../common/TechniqueErrorBoundary';

// FreezeInactive —— 冻结「非激活」TabPane 内容的重渲(切页流畅度最高杠杆)。
//
// 背景(用户头号痛点):全部重技法 wrapper(ZiWeiMain / BaZi / AstroChartMain / GuoLaoChartMain /
// DunJiaMain …)零 sCU/memo。XQTabs/antd Tabs 是 keep-alive(切过的面板不卸载、DOM 仍在 React 树里),
// 所以每次 dva dispatch(切 tab / 当前 tab 改选项 / 改设置)→ pages/index.js AstroIndex 整体重渲 →
// **所有已挂载的隐藏 TabPane 内容也全部重渲一遍**(虽不可见,但 React reconcile + 各重图表 render 照跑)。
// 实测:盘没变、changeTab 脏标记已跳过 predictHook.fun 的「紫微再访」仍有 ~310ms longtask = 纯隐藏面板重渲开销。
//
// 修法:把每个 TabPane 的内容包一层 <FreezeInactive active={当前激活键 === 本面板键}>。
// shouldComponentUpdate 只在「即将激活 next.active」或「当前激活 this.props.active」时返 true:
//   - 当前激活面板:active 恒 true → 照常重渲(实时反映最新 fields/设置,零陈旧)。
//   - 刚被切走(true→false):返 true 渲一次进入隐藏态(无害,之后保持隐藏即冻结)。
//   - 保持隐藏(false→false):返 false 跳过 —— 一次 dispatch 不再触发它重渲。
//   - 即将被激活(false→true):返 true 重渲 → 此刻拿到 AstroIndex 当前构造的最新 children(携带最新
//     fields/chartObj/设置),故被激活时必显最新数据,**零功能降级**。
// render 透明返回 children(单个 TabPane 内容),不引入任何额外 DOM 层。
//
// kill-switch:safeLocalStorageSet('horosa.perf.freezeInactiveTabs','0') 后刷新 → sCU 永远返 true,
// 回到「所有面板每次都重渲」的旧行为。
class FreezeInactive extends Component{
	shouldComponentUpdate(nextProps){
		if(!freezeInactiveTabsEnabled()){
			return true; // kill-switch:回到无条件渲染的旧行为
		}
		// 即将激活 或 当前激活 → 重渲;两次都非激活(保持隐藏)→ 跳过。
		return !!nextProps.active || !!this.props.active;
	}

	render(){
		// 防白屏:每个技法面板经此统一包既有 TechniqueErrorBoundary(单处接入=全站覆盖)。
		// 背景:lazyPreloadable 只给「懒加载」技法包了边界(pages/index.js LazyBoundary),
		// 直接 import 的高频技法(八字/紫微/占星/七政…)此前无任何边界 → 单组件 render 崩
		// =整页白屏(生产实告)。本层补上这个缺口:单技法崩溃只显本页错误卡(含技术详情+重试),
		// 顶栏/导航/其它技法全部可用;无错误时 boundary 透明返回 children,sCU 冻结语义不变。
		return (
			<TechniqueErrorBoundary label={this.props.boundaryName}>
				{this.props.children}
			</TechniqueErrorBoundary>
		);
	}
}

export default FreezeInactive;
