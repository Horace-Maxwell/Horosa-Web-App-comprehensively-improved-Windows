// perfFlags.js —— 流畅度优化项的独立开关(默认全开,调用时读取)。
//
// 每项优化只动「时机/调度」不动「内容/语义」,但仍各配 kill-switch:现场发现异常时
// 单项关闭立即回到旧行为,无需回滚代码。关闭方法(控制台执行后刷新):
//   localStorage.setItem('horosa.perf.lazySnapshot', '0')   // 快照惰性构建
//   localStorage.setItem('horosa.perf.ziweiRulesCache', '0')// 紫微 rules 会话缓存
//   localStorage.setItem('horosa.perf.chartDrawGuard', '0') // 图面重绘签名守卫
//   localStorage.setItem('horosa.perf.chartSCU', '0')       // 盘面重组件 shouldComponentUpdate
//   localStorage.setItem('horosa.perf.hookRaf', '0')        // 排盘 hook rAF 化
//   localStorage.setItem('horosa.perf.freezeInactiveTabs','0')// 冻结非激活 TabPane 重渲
//   localStorage.setItem('horosa.perf.planetariumRenderGating','0')// 天文馆:隐藏/非激活时暂停渲染循环
//   localStorage.setItem('horosa.perf.planetariumOnDemandRender','0')// 天文馆:静止时按需渲染(非每帧)
//   localStorage.setItem('horosa.perf.planetariumIdleHeartbeat','0')// 天文馆:按需渲染的 1fps 兜底心跳
//   localStorage.setItem('horosa.perf.planetariumMetricsThrottle','0')// 天文馆:FPS/网格读数节流到 ~2Hz
//   localStorage.setItem('horosa.perf.planetariumTimeEditDebounce','0')// 天文馆:可编辑时间的后端重算去抖
//   localStorage.setItem('horosa.perf.techniqueResultCache','0')// 技法结果:确定性技法(紫微/七政…)同参复用
// 恢复:对应 key removeItem 或设 '1'。

function flagEnabled(key){
	try{
		if(typeof window !== 'undefined' && window.localStorage){
			return window.localStorage.getItem(key) !== '0';
		}
	}catch(e){
		// localStorage 不可用时按默认开
	}
	return true;
}

export function lazySnapshotBuildEnabled(){
	return flagEnabled('horosa.perf.lazySnapshot');
}

export function ziweiRulesCacheEnabled(){
	return flagEnabled('horosa.perf.ziweiRulesCache');
}

export function chartDrawGuardEnabled(){
	return flagEnabled('horosa.perf.chartDrawGuard');
}

export function chartSCUEnabled(){
	return flagEnabled('horosa.perf.chartSCU');
}

export function hookRafEnabled(){
	return flagEnabled('horosa.perf.hookRaf');
}

export function freezeInactiveTabsEnabled(){
	return flagEnabled('horosa.perf.freezeInactiveTabs');
}

// 天文馆性能门控(只动渲染时机,不动任何排盘/外推内容):
//   - renderGating:隐藏/非激活时暂停 Babylon 渲染循环(可见+激活时一字不动)。
//   - onDemandRender:可见+激活但静止(暂停)时按需渲染而非每帧 60fps;配 idleHeartbeat 1fps 兜底。
//   - metricsThrottle:FPS/网格调试读数节流到 ~2Hz。
//   - timeEditDebounce:可编辑时间的后端整盘重算去抖(显示与「确定」提交均同步、不去抖)。
export function planetariumRenderGatingEnabled(){
	return flagEnabled('horosa.perf.planetariumRenderGating');
}

export function planetariumOnDemandRenderEnabled(){
	return flagEnabled('horosa.perf.planetariumOnDemandRender');
}

export function planetariumIdleHeartbeatEnabled(){
	return flagEnabled('horosa.perf.planetariumIdleHeartbeat');
}

export function planetariumMetricsThrottleEnabled(){
	return flagEnabled('horosa.perf.planetariumMetricsThrottle');
}

export function planetariumTimeEditDebounceEnabled(){
	return flagEnabled('horosa.perf.planetariumTimeEditDebounce');
}

// 技法结果缓存:对**确定性纯计算**技法(紫微本盘/七政等,同 birth+设置必产同结果、无随机、无「现在时刻」依赖)
// 做「同参复用 + 在途合并」,让切换/来回访问命中即秒回(返回同一结果深拷贝,与直连逐值等价、只更快)。
// 关掉即回到每次直连后端。严禁用于卜卦随机起卦/塔罗/AI 等(见 _requestCache.js 头部约束)。
export function techniqueResultCacheEnabled(){
	return flagEnabled('horosa.perf.techniqueResultCache');
}

// 首屏并行化:把页面首次加载时**互不依赖**的后端请求从「串行瀑布」改为并行发起(纯发起时机,内容/结果不变)。
// 例:玄学史 总览/玄典/名家/事件 4 个 fetch 同时发;占星首屏独立预取并行。关掉即回到原串行顺序。
export function firstLoadParallelEnabled(){
	return flagEnabled('horosa.perf.firstLoadParallel');
}
