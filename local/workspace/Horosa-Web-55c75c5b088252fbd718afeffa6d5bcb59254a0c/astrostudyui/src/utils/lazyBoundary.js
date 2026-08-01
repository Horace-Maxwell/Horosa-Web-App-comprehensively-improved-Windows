// lazyBoundary —— 懒加载边界的单一真值源(自愈 + Suspense + 错误边界)。
//
// 为什么住在 utils 而不是 pages/index.js:
//   `lazyPreloadable` 原本定义在 pages/index.js 且不导出,组件从 pages 反向 import 会成
//   components ← pages 循环依赖(navPreload.js 的头注是这条纪律的出处)。于是「组件内部要懒加载
//   一个重子组件」时只能各写一份 React.lazy —— 而各写一份必然丢掉下面那段**空模块自愈**,
//   那正是 v3.6.0 辅盘干净安装必炸的真因。故把核心工厂抽到本文件,两端共用一份。
//
// 三处调用面:
//   · pages/index.js 的 lazyPreloadable —— 页面级,在本工厂之上再加 idle 预取队列 + 悬停预取登记
//   · 组件内部(星运页的主限天球 / 节气页的 3D 盘 / 玄史页的图表)—— 直接用 makeLazyBoundary
//   · idleWarmFactory —— 组件 componentDidMount 里空闲预热,不打开=零成本,真去点时通常已就绪
import React from 'react';
import { Spin } from 'antd';
import TechniqueErrorBoundary from '../components/common/TechniqueErrorBoundary';

/**
 * [P0 chunk 自愈] HMR 撕裂/更新中途换包时 import() 可能 resolve 出「无 default 的空模块」——
 * React.lazy 会把这次坏结果永久缓存(React 17 settle 后状态钉死),边界重挂救不回。
 * 工厂层自愈:坏结果不进缓存(下次真正重试 import),并抛明确错误交边界卡走「刷新重载」路。
 *
 * ⚠ 这段逻辑与 pages/index.js 原实现逐字等价 —— 任何改动都要两端同时想清楚,
 *   它是「Lazy chunk resolved empty」那类幽灵故障的唯一防线。
 */
export function makeHealingFactory(factory){
	let cachedGood = null;
	return ()=>{
		if(cachedGood){ return cachedGood; }
		const p = Promise.resolve().then(factory).then((m)=>{
			if(!m || !m.default){
				throw new Error('Lazy chunk resolved empty (stale HMR / 更新中途换包): 请刷新页面');
			}
			cachedGood = p;
			return m;
		});
		return p;
	};
}

/**
 * 把一个 `() => import('...')` 包成可直接当组件用的懒边界。
 *
 * 🔒 为何 Suspense 与 error boundary 都要自带(而不指望外层):
 *   外层 <React.Suspense> 只罩主工作区,抽屉等在其作用域之外 —— lazy chunk 尚未就绪就打开时
 *   组件 suspend 却无 fallback,会抛 "A React component suspended while rendering, but no
 *   fallback UI was specified" 冒泡到根、卸载整树 = 整页黑屏。故每个懒模块自带一套。
 *
 * @param {Function} factory  () => import('...')，务必带 webpackChunkName 魔法注释
 * @param {Object}  [opts]
 * @param {string}  [opts.label]     错误回退卡标题(传了更好定位是哪个面板挂了)
 * @param {string}  [opts.tip]       加载态文案，默认「加载中…」
 * @param {boolean} [opts.plainFallback] true=用轻量单行加载态(适合嵌在已有卡片里的子视图)
 * @returns {Function} 可当组件渲染的包装件，并挂 `.preload()` 供空闲预热调用
 */
export function makeLazyBoundary(factory, opts = {}){
	const healingFactory = makeHealingFactory(factory);
	const C = React.lazy(healingFactory);
	const tip = opts.tip || '加载中…';
	const fallback = opts.plainFallback
		? (<div style={{ padding: 16, textAlign: 'center', opacity: 0.75 }}><Spin size="small" /> {tip}</div>)
		: (<div style={{ padding: 40, textAlign: 'center' }}><Spin size="large" tip={tip} /></div>);
	const Wrapped = (props) => (
		<TechniqueErrorBoundary label={opts.label}>
			<React.Suspense fallback={fallback}>
				<C {...props} />
			</React.Suspense>
		</TechniqueErrorBoundary>
	);
	Wrapped.displayName = 'LazyBoundary';
	// 供空闲预热/悬停预取复用同一个 healingFactory —— React.lazy 幂等,重复调用共享同一 promise。
	Wrapped.preload = healingFactory;
	return Wrapped;
}

/**
 * 空闲预热:组件挂载后趁浏览器空闲把 chunk 拉下来，用户真去点时通常已就绪。
 * 返回一个 cancel 函数 —— 组件卸载时务必调用(照 AstroZR.js 的 cancelIdleCallback + unmounted 双保险)。
 *
 * 失败静默:预热失败不该打扰用户，真去点时会走正常加载路径并由边界报错。
 */
export function idleWarm(factoryOrLazy, { timeout = 2000, fallbackDelay = 400 } = {}){
	const run = ()=>{
		try{
			const f = (factoryOrLazy && factoryOrLazy.preload) ? factoryOrLazy.preload : factoryOrLazy;
			const r = typeof f === 'function' ? f() : null;
			if(r && typeof r.catch === 'function'){ r.catch(()=>{}); }
		}catch(e){ /* 预热失败静默:真去点时走正常路径 */ }
	};
	if(typeof window === 'undefined'){ return ()=>{}; }
	if(typeof window.requestIdleCallback === 'function'){
		const id = window.requestIdleCallback(run, { timeout });
		return ()=>{ if(typeof window.cancelIdleCallback === 'function'){ window.cancelIdleCallback(id); } };
	}
	const t = setTimeout(run, fallbackDelay);
	return ()=>clearTimeout(t);
}

export default makeLazyBoundary;
