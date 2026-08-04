import React, { Component } from 'react';
import { safeLocalStorageSet } from '../../utils/safeStorage';
import { freezeInactiveTabsEnabled, freezeSubTabsEnabled, subTabDeferMountEnabled } from '../../utils/perfFlags';
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

// ═══════════════════════════════════════════════════════════════════════════════
// horosa_freeze_subtabs_v1(R4-B1):把上面的冻结语义下放到【子页签】。
//
// 病灶:FreezeInactive 只守【顶层】技法页签。技法内部的右栏/中栏子页签(星运/占星/辅盘/
// 卜其他/三式/七政/紫微/数算/黄历各若干)一律「children 直接内联」—— antd Tabs 是
// keep-alive,首次激活后永久挂载,此后父组件每次重渲(切时间/改选项/换页签)都把【用户
// 看不见的】那十几个面板一起 reconcile + render 一遍,吃掉本该属于可见内容的预算。
//
// FreezeSubTab = 同源 wrapper,三条语义:
//   1) 【冻结 ≠ 卸载】已渲染过的面板永远保留 DOM 与组件实例(componentWillUnmount 不会跑),
//      非激活期间只是 sCU 返 false 跳过 re-render。切回去时 sCU 返 true,拿到父组件本轮
//      构造的【最新】children 立即渲一帧 —— 不重新挂载、不重发请求、不闪烁、组件 state
//      (滚动位置/已展开折叠面板/用户输入)原样还在。这是「功能不得降级」的硬保证。
//   2) 【从未激活过的面板延迟首次渲染】那本来就没画过、用户也没见过,不构成降级。
//      children 传函数(() => node)时连 React 元素都不创建 = 真零成本;传节点时元素已由
//      父组件创建(那只是 createElement,便宜),但不进 reconcile。
//   3) 【防呆】active 传 undefined(调用方忘了接 activeKey)→ 一律透明渲染,绝不出现空白面板。
//
// 用法(子页签接线方照抄):
//   import FreezeInactive, { FreezeSubTab } from '../comp/FreezeInactive';
//   // A. 节点式(最省事,适合原地包住已有内联 children)
//   <FreezeSubTab active={this.state.rightTab === '2'}>{ ...原内联内容... }</FreezeSubTab>
//   // B. 函数式(推荐:未激活过时连元素都不建)
//   <FreezeSubTab active={activeKey === t.key}>{() => t.content()}</FreezeSubTab>
//   // C. 需要局部错误边界时(默认【不】包,避免在已有边界内多一层):
//   <FreezeSubTab active={...} boundaryName="六壬·占断">{...}</FreezeSubTab>
//   // D. 该面板必须从一开始就存在(挂载副作用/对外注册)→ eager 关掉延迟首渲,只保留冻结。
//
// 前提:承载它的 Tabs 必须是【受控】的(activeKey + onChange 记进 state),否则拿不到 active。
//       非受控(defaultActiveKey)的 Tabs 由各技法接线方先改受控,本组件不代劳。
//
// kill-switch:
//   safeLocalStorageSet('horosa.perf.freezeSubTabs','0')    → 冻结与延迟首渲【全关】;
//   safeLocalStorageSet('horosa.perf.subTabDeferMount','0') → 只关「延迟首次渲染」,冻结仍生效。
class FreezeSubTab extends Component{
	constructor(props){
		super(props);
		// 「曾经激活过」的粘性标记:一旦为 true 永不回落 —— 它只控制【首次】渲染时机,
		// 之后无论激活与否都保持已挂载(冻结≠卸载)。
		this._everActive = props.active === undefined || !!props.active || !!props.eager;
	}

	shouldComponentUpdate(nextProps){
		if(!freezeSubTabsEnabled()){
			return true; // kill-switch:回到无条件渲染的旧行为
		}
		if(nextProps.active === undefined){
			return true; // 防呆:调用方没接 activeKey → 行为与未包裹时一致
		}
		if(!this._everActive && !subTabDeferMountEnabled()){
			// 延迟首渲被单独关掉:尚未激活过的面板照常参与重渲(eager 面板 _everActive 在
			// 构造期即为 true,走不到这条,故 eager 只免「延迟首渲」、冻结照常生效)。
			return true;
		}
		// 即将激活 或 当前激活 → 渲染(切回时拿到最新 children,零陈旧);
		// 两次都非激活(保持隐藏)→ 跳过,这一次父重渲不再穿透到本面板。
		return !!nextProps.active || !!this.props.active;
	}

	render(){
		const { active, children, boundaryName, eager } = this.props;
		const flagOn = freezeSubTabsEnabled();
		if(active){
			this._everActive = true;
		}
		// 延迟首次渲染:仅限「从未激活过」且开关开着且未 eager 豁免的面板。
		if(flagOn && !this._everActive && !eager && subTabDeferMountEnabled() && active !== undefined){
			return null;
		}
		// children 支持函数式(未激活过时不求值 = 连 React 元素都不创建)。
		const node = typeof children === 'function' ? children() : children;
		if(boundaryName){
			return (
				<TechniqueErrorBoundary label={boundaryName}>
					{node}
				</TechniqueErrorBoundary>
			);
		}
		// 默认不包边界、不加 DOM 层:透明返回,包裹前后的 DOM 结构逐字节一致。
		return node === undefined ? null : node;
	}
}

export { FreezeSubTab };
export default FreezeInactive;
