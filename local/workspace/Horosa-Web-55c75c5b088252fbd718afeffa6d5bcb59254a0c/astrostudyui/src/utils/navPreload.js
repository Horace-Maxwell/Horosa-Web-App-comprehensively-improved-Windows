// navPreload —— 导航悬停预取注册表(WS-N3)。
//
// 原理:鼠标掠过导航入口(主左导航/模块选择器/快捷坞/技法快捷链)即预载对应 lazy chunk。
// React.lazy 幂等(重复调用共享同一 promise),已预载/主包 eager 组件 = no-op,零重复成本。
// 悬停→点击通常有 100-300ms 间隔,足够本地(桌面壳静态服务器)拉完一个技法 chunk ——
// 感知上「点谁谁瞬开」。
//
// 注册表住在本 util 而非 pages/index.js:公共组件(QuickDockBar/HomePageSetup)要消费它,
// 从 pages 导入会形成 components ← pages 反向依赖(循环)。pages 的 lazyPreloadable 声明时
// 调 registerNavPreload 登记,消费方只 import 本文件。
import { hoverPrefetchEnabled } from './perfFlags';

const REGISTRY = new Map();   // navKey -> factory(即 () => import(...))

export function registerNavPreload(navKey, factory){
	if(navKey && typeof factory === 'function'){
		REGISTRY.set(navKey, factory);
	}
}

/** 悬停预取:未注册(eager 组件/未知键)= 静默 no-op;开关关 = no-op(回到点击才载)。 */
export function preloadNavByKey(navKey){
	if(!hoverPrefetchEnabled()){
		return;
	}
	const factory = REGISTRY.get(navKey);
	if(factory){
		Promise.resolve().then(factory).catch(()=>{ /* 预载失败静默:点击时正式加载自会重试/报错 */ });
	}
}

export function getRegisteredNavPreload(navKey){
	return REGISTRY.get(navKey);
}

/** 测试用:清注册表 */
export function __resetNavPreload(){
	REGISTRY.clear();
}
