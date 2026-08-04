import { safeLocalStorageSet } from './safeStorage';
// perfFlags.js —— 流畅度优化项的独立开关(默认全开,调用时读取)。
//
// 每项优化只动「时机/调度」不动「内容/语义」,但仍各配 kill-switch:现场发现异常时
// 单项关闭立即回到旧行为,无需回滚代码。关闭方法(控制台执行后刷新):
//   safeLocalStorageSet('horosa.perf.lazySnapshot', '0')   // 快照惰性构建
//   safeLocalStorageSet('horosa.perf.ziweiRulesCache', '0')// 紫微 rules 会话缓存
//   safeLocalStorageSet('horosa.perf.chartDrawGuard', '0') // 图面重绘签名守卫
//   safeLocalStorageSet('horosa.perf.chartSCU', '0')       // 盘面重组件 shouldComponentUpdate
//   safeLocalStorageSet('horosa.perf.hookRaf', '0')        // 排盘 hook rAF 化
//   safeLocalStorageSet('horosa.perf.freezeInactiveTabs','0')// 冻结非激活 TabPane 重渲(顶层技法页签)
//   safeLocalStorageSet('horosa.perf.freezeSubTabs','0')   // R4-B1:冻结非激活【子页签】重渲(FreezeSubTab)
//   safeLocalStorageSet('horosa.perf.subTabDeferMount','0')// R4-B1:子页签「从未激活过则延迟首次渲染」
//   safeLocalStorageSet('horosa.perf.requestDedupe', '0')  // 计算请求 去重+短TTL缓存
//   safeLocalStorageSet('horosa.perf.techniqueCache', '0') // L2 技法结果缓存(10min,来回拨参数≈0)
//   safeLocalStorageSet('horosa.perf.idleWarmQueue', '0')  // 就绪后空闲预热队列(chunk/引擎/数据)
//   —— 以下九项为「点时间→出盘极速化」大修(2026-07) ——
//   safeLocalStorageSet('horosa.perf.fieldsFastCommit', '0')      // chartFree 页 fields 先行提交(快车道)
//   safeLocalStorageSet('horosa.perf.prewarmRequests', '0')       // 非快车道页并行预热请求集
//   safeLocalStorageSet('horosa.perf.silentTechniquePanels', '0') // 技法面板请求 silent+keep-stale(关=旧全屏 Spin)
//   safeLocalStorageSet('horosa.perf.ziweiLocalFirst', '0')       // 紫微默认本地引擎(关=旧 Java 默认)
//   safeLocalStorageSet('horosa.perf.leadingDebounce', '0')       // 主盘时间防抖 leading 立发(关=纯 trailing 180ms)
//   safeLocalStorageSet('horosa.perf.sharedNativeModel', '0')     // native 技法 center/aux 共享模型 memo
//   safeLocalStorageSet('horosa.perf.singleTriggerPredictive','0')// PD/ZR hook+didUpdate 同签名去重
//   safeLocalStorageSet('horosa.perf.stepPrefetch', '0')          // 时间步进方向预取
//   safeLocalStorageSet('horosa.perf.stepPrefetchArm', '0')       // R4-B2:选步长/出盘/切页即武装 ±N 步预取(关=只剩步进后预取)
//   safeLocalStorageSet('horosa.perf.stepPrefetchDepth', '2')     // R4-B2:武装深度 ±N(默认 3,合法 0..5,0=等效关)
//   safeLocalStorageSet('horosa.perf.dataWarmTasks', '0')         // R4-B3:排盘后数据层空闲预热(组式)细闸
//   safeLocalStorageSet('horosa.perf.neighborPrefetch', '0')      // R4-B3:分至图年份邻位预取(year±1)
//   safeLocalStorageSet('horosa.perf.speculativePrecompute', '0') // R4-B5:表单编辑期防抖预发同参请求(只暖缓存)
//   safeLocalStorageSet('horosa.perf.optionPrefetch', '0')        // R4-B5:选项 Hamming-1 投机预取(关=零任务)
//   safeLocalStorageSet('horosa.perf.bootChartRestore', '0')      // R4-B8:温启恢复上次的盘(关=启动回空白默认态)
//   safeLocalStorageSet('horosa.perf.chartCloneLite', '0')        // 出盘缓存冻结共享引用(关=每次深拷贝)
//   safeLocalStorageSet('horosa.perf.hoverPrefetch', '0')         // 导航悬停预取 chunk(关=点击才载)
//   safeLocalStorageSet('horosa.perf.netResultCache', '0')        // 请求结果 L3 持久缓存(IndexedDB,跨重启 0 往返)
//   safeLocalStorageSet('horosa.perf.bootGate', '0')              // [B1] early 导航后端探活门(关=请求直发,未起时报错重试)
//   safeLocalStorageSet('horosa.perf.rsaSessionKey', '0')         // [A2] RSA 会话密钥复用(关=每请求重算 2048 位模幂)
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

// horosa_freeze_subtabs_v1(R4-B1):子页签冻结总闸。
// 关掉 → FreezeSubTab 的 sCU 恒真且不再延迟首渲,回到「技法内所有子面板每次父重渲都跟着重渲」的旧行为。
export function freezeSubTabsEnabled(){
	return flagEnabled('horosa.perf.freezeSubTabs');
}

// horosa_freeze_subtabs_v1 细闸:只管「从未激活过的子页签延迟到首次激活才渲染」。
// 关掉 → 子面板一开始就渲一次(冻结仍生效),用于排查「某面板必须挂载才注册副作用」类问题。
export function subTabDeferMountEnabled(){
	return flagEnabled('horosa.perf.subTabDeferMount');
}

export function requestDedupeEnabled(){
	return flagEnabled('horosa.perf.requestDedupe');
}

export function techniqueCacheEnabled(){
	return flagEnabled('horosa.perf.techniqueCache');
}

// [A1] L3 持久结果缓存(IndexedDB):同参跨会话零网络零 RSA。默认开;置 '0' 一键回退到纯内存 L1/L2。
export function netResultCacheEnabled(){
	return flagEnabled('horosa.perf.netResultCache');
}

export function idleWarmQueueEnabled(){
	return flagEnabled('horosa.perf.idleWarmQueue');
}

// —— 「点时间→出盘极速化」大修(2026-07) 九开关 ——
// 与既有开关同则:默认开、只动时机/调度不动内容语义、单项关闭即回旧行为。

export function fieldsFastCommitEnabled(){
	return flagEnabled('horosa.perf.fieldsFastCommit');
}

export function prewarmRequestsEnabled(){
	return flagEnabled('horosa.perf.prewarmRequests');
}

export function silentTechniquePanelsEnabled(){
	return flagEnabled('horosa.perf.silentTechniquePanels');
}

export function ziweiLocalFirstEnabled(){
	// ⚠️ 本开关是【opt-in】(缺省=关),与其余默认开的开关相反。
	//    2026-07-19:24 例网格对拍已【全绿】(Java 兼容档三键 yearBoundary:lunar_1_1 /
	//    ziweiLunarBasis:calendar / lifeMasterBy:year_branch,见 ziweiLocalParity.test)=
	//    排盘核心字节证明达成;但「切默认」还差【全响应形状】装配审计(nongli 文本/bazi 块/
	//    顶层兼容字段的本地组装逐字对拍)——审计过前本开关保持 opt-in 且暂无消费者(荷载待接线)。
	try{
		if(typeof window !== 'undefined' && window.localStorage){
			return window.localStorage.getItem('horosa.perf.ziweiLocalFirst') === '1';
		}
	}catch(e){ /* 默认关 */ }
	return false;
}

export function leadingDebounceEnabled(){
	return flagEnabled('horosa.perf.leadingDebounce');
}

export function bootGateEnabled(){
	// [B1] 桌面壳 early 导航(前后端启动重叠)时,请求层按目标根探活排队;
	// 关=请求直发(后端未起时走既有报错/重试/离线横幅,行为回到旧序)。
	return flagEnabled('horosa.perf.bootGate');
}

export function rsaSessionKeyEnabled(){
	// [A2] :9999 请求体加密的 AES 钥+RSA 密文会话内复用(每会话一次 2048 位模幂,
	// 旧式=每请求一次、主线程)。关=逐请求随机钥(字节行为回旧)。Java 侧零改动。
	return flagEnabled('horosa.perf.rsaSessionKey');
}

export function aiBodyEncryptEnabled(){
	// [G2] :9999 AI 分析请求体 RSA 会话束封套(与排盘 API 同机制)。关=回明文请求体
	// (后端有明文直通宽容,恒可回退);响应两态皆不加密。
	return flagEnabled('horosa.sec.aiBodyEncrypt');
}

export function sharedNativeModelEnabled(){
	return flagEnabled('horosa.perf.sharedNativeModel');
}

export function singleTriggerPredictiveEnabled(){
	return flagEnabled('horosa.perf.singleTriggerPredictive');
}

export function stepPrefetchEnabled(){
	return flagEnabled('horosa.perf.stepPrefetch');
}

// —— R4-B2(horosa_step_prefetch_arm_v1):「选步长即武装」 ——
// 病根:预取单位只来自上一次步进 hint(无 hint 硬编码 'm'),选完新步长的第一下必 miss
// (owner 原话「第一下卡之后不卡」)。武装 = 不等步进,先按当前档位把 ±1..±depth 预好。
export function stepPrefetchArmEnabled(){
	return flagEnabled('horosa.perf.stepPrefetchArm');
}

// 武装深度 ±N。默认 3(±1 即时命中,±2/±3 吃空闲窗);合法 0..5,0=等效关;
// 非法值一律回默认 —— 现场只需 safeLocalStorageSet('horosa.perf.stepPrefetchDepth','2') 即可调。
export function stepPrefetchDepth(){
	try{
		if(typeof window !== 'undefined' && window.localStorage){
			const raw = window.localStorage.getItem('horosa.perf.stepPrefetchDepth');
			if(raw !== null && raw !== undefined && raw !== ''){
				const n = parseInt(raw, 10);
				if(Number.isFinite(n) && n >= 0 && n <= 5){
					return n;
				}
			}
		}
	}catch(e){
		// localStorage 不可用时走默认
	}
	return 3;
}

// R4-B3:排盘后数据层空闲预热(scheduleDataWarmGroup)的细闸——在总闸 idleWarmQueue
// 之内再单独可关。预热只经各技法自己的缓存入口取数(结果与用户首点逐字节一致,只是提前付),
// 关掉即回到「首点付冷成本」的现状。
export function dataWarmTasksEnabled(){
	return flagEnabled('horosa.perf.dataWarmTasks');
}

// R4-B3:分至图年份邻位预取(year±1)的独立闸。
export function neighborPrefetchEnabled(){
	return flagEnabled('horosa.perf.neighborPrefetch');
}

// R4-B5 预测性预计算(speculativePrecompute):用户在排盘表单里编辑参数时,防抖后提前发出与
// 「提交」完全相同的确定性计算请求 —— 结果只进 services 层缓存(chartMem/在途合并),不落任何
// 状态、不动 UI;点提交时直接命中/加入在途 → 点击→显示≈渲染耗时。严禁随机/取现时类端点。
// 关掉(horosa.perf.speculativePrecompute=0)即回到「点提交才计算」。
export function speculativePrecomputeEnabled(){
	return flagEnabled('horosa.perf.speculativePrecompute');
}

// R4-B5(horosa_option_prefetch_v1):选项空间 Hamming-1 投机预取。
export function optionPrefetchEnabled(){
	return flagEnabled('horosa.perf.optionPrefetch');
}

// R4-B5b(horosa_option_debounce_v1):「选项即发」路径 leading 立发+250ms trailing 并帧
// (与时间轴 debounce 分通道)。关=每次选项变更各发各的旧行为。
export function optionDebounceEnabled(){
	return flagEnabled('horosa.perf.optionDebounce');
}

// R4-B5b(horosa_main_chain_abort_v1):/chart 主链新发先 abort 旧在途(网络层取消;
// 结果层正确性本就由 fieldsEpoch 代际保证,此闸释放连接与后端算力)。关=旧请求自然完成。
export function mainChainAbortEnabled(){
	return flagEnabled('horosa.perf.mainChainAbort');
}

// R4-B8(horosa_boot_chart_restore_v1):温启恢复上次工作现场(owner 拍板默认开)。
export function bootChartRestoreEnabled(){
	return flagEnabled('horosa.perf.bootChartRestore');
}

export function chartCloneLiteEnabled(){
	return flagEnabled('horosa.perf.chartCloneLite');
}

// —— WS-N3(2026-07-16):导航悬停预取 ——
export function hoverPrefetchEnabled(){
	return flagEnabled('horosa.perf.hoverPrefetch');
}

// —— 3D 星盘大修 WS-0(2026-07-16) ——
export function astro3dOnDemandEnabled(){
	// 按需渲染:idle 停 rAF(交互/动画/参数变化时唤醒);关=旧持续 rAF 全速渲染
	return flagEnabled('horosa.perf.astro3dOnDemand');
}

// —— 3D 星盘大修 WS-1(2026-07-16) ——
export function astro3dSpriteLabelsEnabled(){
	// 标签走 canvas sprite(每标签 1 quad,billboard 恒可读);关=旧 TextGeometry 网格观感
	return flagEnabled('horosa.perf.astro3dSpriteLabels');
}

// —— 3D 星盘大修 WS-1b(2026-07-16) ——
export function astro3dMorphEnabled(){
	// 改时间滑移补间:仅 chartObj 变化(坐标语义/显示集合未变)时行星沿最短弧 tween 滑到
	// 新位(~600ms),不走全量重建;关=旧全量 disposeMesh+重建
	return flagEnabled('horosa.perf.astro3dMorph');
}

// —— R3-A3(2026-07-21):kentang(:8899 直连 C 型)统一缓存壳 ——
export function kentangCacheEnabled(){
	// /pan 族请求 L1/L2/L3 缓存+在途去重(键=path+body,同 body 恒同果);
	// 关=逐字节旧行为(裸 fetchChartWithRetry 直通,每次全程 Python 重算)
	return flagEnabled('horosa.perf.kentangCache');
}

// —— R3-A1(2026-07-21):选定步长那一刻的双向预取 ——
export function stepSelectPrefetchEnabled(){
	// 时间组件选步长档即预取 ±1、±2 步(第一下也不冷);关=仅 settle 后预取(旧行为)
	return flagEnabled('horosa.perf.stepSelectPrefetch');
}

// ═══ Windows-only 闸族(与上游同步时整块保全,哨兵逐函数钉;上游收编某项后按 #49 就地删行) ═══
// 关闭方法同上:safeLocalStorageSet('<key>','0') 后刷新。

// PERF-R9 Ship 6:城市大库 chunk(3.85MB)空闲预载。关=打开经纬度选择器时才现场下载+解析。
export function cityDbIdlePreloadEnabled(){
	return flagEnabled('horosa.perf.cityDbIdlePreload');
}

// PERF-R12 W3a①(horosa_pump_fastfirst_v1):泵首任务快发 —— rIC 在快速连点下饥饿,
// 首目标组(≤2 任务)改 setTimeout(32ms) 让出一帧即发;与上游 livelock 修(排干旧代+500ms
// 保底)互补:fast-first 管首拍要快,保底管长队列持续有拍。关=恒走 rIC 旧调度。
export function stepPrefetchFastFirstEnabled(){
	return flagEnabled('horosa.perf.stepPrefetchFastFirst');
}

// PERF-R12 W3a③(horosa_pump_skew_v1):同向连点 ≥3 且间隔 <2s 时,计划丢反向换前伸
// (+4/+5)—— 反向目标(刚渲染过的那张)本就温在缓存,丢弃零损,前伸纯赚;
// 翻向/换页/换档/dir=0/停 >2s 即重置。只改 settle 路径 plan 形状,白名单与预算结构不动。
export function stepPrefetchSkewEnabled(){
	return flagEnabled('horosa.perf.stepPrefetchSkew');
}

// PERF-R12 W3d-G5(horosa_guolao_render_slice_v1):七政 bundle 全命中路径的中间 setState 合并
// —— 流年盘+Moira 规则都已在缓存时跳过中间帧,终态一次落齐(字节一致,少一整轮重渲);
// 规则缓存窥探为假(冷/在途)⇒ 保留中间帧,流年环照旧先行上屏。关=恒两段式。
export function guolaoMergedPaintEnabled(){
	return flagEnabled('horosa.perf.guolaoMergedPaint');
}

// —— FE-9 天文馆五闸(渲染门控/按需渲染/空闲心跳/指标节流/时间编辑防抖) ——
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

// FE-2:确定性纯计算技法结果「同参复用 + 在途合并」(紫微本盘/七政等;严禁随机/取现时端点,
// 判据见 _requestCache.js 头注)。关=每次直连后端。
export function techniqueResultCacheEnabled(){
	return flagEnabled('horosa.perf.techniqueResultCache');
}

// FE-11:页面首载互不依赖请求并行发起(玄学史四 fetch/占星首屏独立预取)。关=原串行顺序。
export function firstLoadParallelEnabled(){
	return flagEnabled('horosa.perf.firstLoadParallel');
}

