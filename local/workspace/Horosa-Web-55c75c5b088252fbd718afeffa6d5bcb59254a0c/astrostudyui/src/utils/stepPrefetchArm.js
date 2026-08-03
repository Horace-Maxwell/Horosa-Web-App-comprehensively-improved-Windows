// stepPrefetchArm —— 「选步长即武装」预取(PERF-R10 Ship2,horosa_step_prefetch_arm_v1)。
//
// 病根(owner 原话「选完步长第一下卡、之后不卡」的机制):
//   · buildStepPrefetchTasks 的单位只来自【上一次步进动作】的 stepHint,无 hint 时硬编码 'm';
//   · DateTimeSelector.changeTimeType(全站唯一步长入口)只 setState,不触发任何预取;
//   · submitStepPrefetch 全仓唯一调用点在 fetchByFields settle —— 而紫微/遁甲的步进走本地
//     漏斗根本不经它,登记的预取器从未被触发。
// 武装 = 不等用户点步进,在四个时机把「当前档位的 ±1..±depth」提前算好塞进缓存:
//   (a) 选步长 —— v3.5.1 收敛后 live 路径=上游 fireStepSelectPrefetch → models/astro 注册的
//       直发处理器(带 earlyBoot 守卫;sameMinute 闸经裁决豁免:opt-in 宿主源头已滤旁路条);
//       本文件的 notifyStepUnitSelected 保留为 armStepPrefetch('unit-select') 的测试口径入口
//   (b) 出盘 settle(models/astro.js:fetchByFields 无 stepHint 分支 → armStepPrefetch)
//   (b′) 本地漏斗 settle(ZiWeiMain.requestZiWei / DunJiaMain.onTimeChanged → armStepPrefetch)
//   (c) 切技法页签(pages/index.js:changeTab 延迟 300ms → armStepPrefetch)
// 任务构造完全复用 models/astro.js 的 buildStepPrefetchTasks(经 registerArmPlanBuilder 注入,
// 避免 utils→models 反向 import 环)——「预取参数与用户真点逐字节同键」的既有纪律原样继承;
// 提交走 submitStepPrefetch:白名单双闸/串行泵/latest-wins/预算 全部沿用,本模块零绕过。
//
// 纪律:
//   · NO_ARM_TABS:随机起卦/取现时/流式/浏览型技法永不武装(端点级 FORBIDDEN 双闸仍兜底);
//   · sameMinute 语境闸:选步长事件若来自「与主盘时间不同」的旁路时间条(moira 流年、
//     案例编辑抽屉),武装主盘 ±N 是白打 —— 直接跳过;比较失败(异形 DateTime)按放行
//     处理:多武装只浪费空闲请求,漏武装才伤体验;
//   · early-boot 未确认前不武装(渲染器提前导航窗口里,后端还没起,排队无意义);
//   · kill-switch:horosa.perf.stepPrefetchArm(关=只剩 R9「步进后预取」旧行为);
//     深度 horosa.perf.stepPrefetchDepth(0..5,0=等效关)。
import { submitStepPrefetch, prefetchRefusalCount } from './stepPrefetch';
import { stepPrefetchEnabled, stepPrefetchArmEnabled, stepPrefetchDepth } from './perfFlags';
import { getStore } from './storageutil';
import { isEarlyBootMode } from './backendBootGate';

// 随机起卦(guazhan=六爻)、取现时(planetarium)、流式(aianalysis)、浏览/查询型
// (astrodata/xuanshi/astroreader/liveplayer/admintools)—— 时间步进不是这些页的交互模型。
const NO_ARM_TABS = new Set([
	'guazhan', 'planetarium', 'aianalysis', 'astrodata', 'xuanshi',
	'astroreader', 'liveplayer', 'admintools',
]);

let planBuilder = null;
// 每技法记住「最近一次用户选择/步进的档位」:settle 兜底武装用它替代硬编码 'm'。
const lastUnitByTab = new Map();
let lastUnitGlobal = null;

const stats = {
	arms: 0,
	skipped: 0,
	lastReason: null,
	lastTab: null,
	lastUnit: null,
	lastDepth: 0,
	lastTasks: 0,
	lastAt: 0,
};

/** models/astro.js 启动时注入 buildStepPrefetchTasks(fields, hint, astroState)。 */
export function registerArmPlanBuilder(fn){
	if(typeof fn === 'function'){
		planBuilder = fn;
	}
}

export function shouldArmForTab(tabKey){
	return !!tabKey && !NO_ARM_TABS.has(tabKey);
}

// horosa_pump_skew_v1(PERF-R12 W3a③):同向连击计量 —— settle 携 dir(±1)时累计,
// 方向翻转/换档/dir 缺省(选档、非步进 settle)/间隔 >2s 一律重置。纯观测状态,
// 消费方只有 models/astro.js 的计划偏斜分支;读写全 try 包,绝不影响主流程。
const stepStreakByTab = new Map();
const STREAK_GAP_MS = 2000;

export function reportStepUnit(tabKey, unit, dir){
	if(tabKey && unit){
		lastUnitByTab.set(tabKey, unit);
		lastUnitGlobal = unit;
	}
	try{
		if(!tabKey){ return; }
		if(dir === 1 || dir === -1){
			const now = Date.now();
			const prev = stepStreakByTab.get(tabKey);
			if(prev && prev.dir === dir && prev.unit === unit && (now - prev.at) < STREAK_GAP_MS){
				stepStreakByTab.set(tabKey, { dir, unit, at: now, count: prev.count + 1 });
			}else{
				stepStreakByTab.set(tabKey, { dir, unit, at: now, count: 1 });
			}
		}else{
			stepStreakByTab.delete(tabKey);
		}
	}catch(e){ /* 观测性状态,绝不影响主流程 */ }
}

export function stepStreak(tabKey){
	try{
		const s = tabKey && stepStreakByTab.get(tabKey);
		if(s){
			return { count: s.count, dir: s.dir, at: s.at, unit: s.unit };
		}
	}catch(e){ /* 同上 */ }
	return { count: 0, dir: 0, at: 0, unit: null };
}

export function currentStepUnit(tabKey){
	return (tabKey && lastUnitByTab.get(tabKey)) || lastUnitGlobal || 'm';
}

function sameMinuteOrUnknown(a, b){
	try{
		if(a && b && typeof a.format === 'function' && typeof b.format === 'function'){
			return a.format('YYYYMMDDHHmm') === b.format('YYYYMMDDHHmm');
		}
	}catch(e){ /* 异形对象按未知处理 */ }
	// 比较不了 → 按「同一时间条」放行(fail-open:多武装只费空闲请求,漏武装才伤体验)
	return true;
}

/**
 * 武装一轮 ±depth 预取。返回提交的任务数(0=按纪律跳过/无可做)。
 * @param {string} reason  'unit-select' | 'settle' | 'local-settle' | 'tab-activate'(诊断用)
 * @param {object} opt     { unit, selectorDatetime, fieldsOverride, tabOverride, skipChart }
 */
export function armStepPrefetch(reason, opt){
	const o = opt || {};
	if(!stepPrefetchEnabled() || !stepPrefetchArmEnabled() || !planBuilder){
		return 0;
	}
	try{
		// 渲染器提前导航窗口(early=1)里后端未确认就绪 —— 武装只会在 boot 门排队,无意义。
		if(isEarlyBootMode() && typeof window !== 'undefined' && window.__horosaBackendConfirmed !== true){
			stats.skipped += 1;
			return 0;
		}
	}catch(e){ /* 判定失败不拦 */ }
	const store = getStore();
	const astroState = store && store.astro;
	if(!astroState){
		return 0;
	}
	const tab = o.tabOverride || astroState.currentTab;
	if(!shouldArmForTab(tab)){
		stats.skipped += 1;
		return 0;
	}
	const fields = o.fieldsOverride || astroState.fields;
	const dt = fields && fields.date && fields.date.value;
	if(!dt || typeof dt.clone !== 'function'){
		return 0;
	}
	if(o.selectorDatetime && !sameMinuteOrUnknown(o.selectorDatetime, dt)){
		stats.skipped += 1;
		return 0;
	}
	const unit = o.unit || currentStepUnit(tab);
	if(o.unit){
		reportStepUnit(tab, o.unit);
	}
	const depth = stepPrefetchDepth();
	if(depth <= 0){
		return 0;
	}
	let tasks = [];
	try{
		tasks = planBuilder(fields, { unit, dir: 0, depth, arm: reason, skipChart: !!o.skipChart }, astroState) || [];
	}catch(e){
		return 0; // 构造失败静默:武装是优化不是功能
	}
	if(!tasks.length){
		return 0;
	}
	submitStepPrefetch(tasks);
	stats.arms += 1;
	stats.lastReason = reason || null;
	stats.lastTab = tab;
	stats.lastUnit = unit;
	stats.lastDepth = depth;
	stats.lastTasks = tasks.length;
	stats.lastAt = Date.now();
	return tasks.length;
}

/** DateTimeSelector.changeTimeType 调:选步长即武装(owner 主诉求的那一下)。 */
export function notifyStepUnitSelected(unit, selectorDatetime){
	if(!unit){
		return 0;
	}
	return armStepPrefetch('unit-select', { unit, selectorDatetime });
}

/** 诊断/验收句柄:perf_acceptance.cjs 断言「选步长后确实武装过」靠它。 */
export function armStats(){
	return { ...stats, refusals: prefetchRefusalCount() };
}

/** 测试用:清内部态。 */
export function __resetStepPrefetchArm(){
	planBuilder = null;
	lastUnitByTab.clear();
	lastUnitGlobal = null;
	stats.arms = 0;
	stats.skipped = 0;
	stats.lastReason = null;
	stats.lastTab = null;
	stats.lastUnit = null;
	stats.lastDepth = 0;
	stats.lastTasks = 0;
	stats.lastAt = 0;
}

try{
	if(typeof window !== 'undefined' && !window.__horosaPrefetch){
		window.__horosaPrefetch = { stats: armStats };
	}
}catch(e){ /* observation only */ }
