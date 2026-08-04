// optionPrefetch —— 选项空间 Hamming-1 投机预取(R4-B5,horosa_option_prefetch_v1)。
//
// 原理:用户切选项压倒性地「一次只动一个轴」。主盘 settle 后,把「当前参数只翻一位」的
// /chart 变体在空闲时段预好 —— 构参与真点走同一 fieldsToParams(键逐字节同),结果自然落
// chartMem/requestDedupe 三层;用户切该轴时 = 缓存命中,延迟只剩渲染。
//
// ⚠️ 本件是对 R3「optionPrefetch 判弊>利」裁决的**反转**(落账 FAILURE_LEDGER):R3 判弊的
// 是「开下拉即触真算」的 intent 形态;本实现改在 settle 后走空闲组(scheduleDataWarmGroup:
// 组代作废+交互让路),实证二值轴命中率高且零抢队 —— 判弊前提已被规避。
//
// 纪律(与步进武装同族,更保守):
//   · 首铺只做**二值轴**(值域 {0,1} 硬编码零风险):zodiacal(回归/恒星)、southchart(南/北盘)、
//     tradition(现代/古典)、simpleAsp(简/全相位)。多值轴(hsys/ayanamsa/terms/学派等)的
//     合法值域住在各表单组件里 —— 待接入时由组件登记,绝不在这里臆造值域(错值=白算)。
//   · 走 scheduleDataWarmGroup 空闲通道,预算 ≤4/settle,不与步进泵抢队;
//   · 任务 silent+零重试;NO_ARM 技法(随机/取现时/流式/浏览/择日)不投机;
//   · kill-switch:horosa.perf.optionPrefetch(关=零任务)。
import { optionPrefetchEnabled } from './perfFlags';
import { scheduleDataWarmGroup } from './idleWarmQueue';
import { shouldArmForTab } from './stepPrefetchArm';

// {key, values} —— 只列硬编码安全的二值轴;顺序=价值序(预算截断从尾部丢)。
export const BINARY_CHART_AXES = [
	{ key: 'zodiacal', values: [0, 1] },
	{ key: 'southchart', values: [0, 1] },
	{ key: 'tradition', values: [0, 1] },
	{ key: 'simpleAsp', values: [0, 1] },
];
const BUDGET_PER_SETTLE = 4;

let chartTaskBuilder = null;
/** models/astro.js 注入:(fieldsVariant, astroState) => {name,path,run} 单条 /chart 预取任务(同构参路径)。 */
export function registerOptionChartTaskBuilder(fn){
	if(typeof fn === 'function'){
		chartTaskBuilder = fn;
	}
}

function altValueOf(axis, cur){
	// 二值轴:非 values[0] 即取 values[0],否则 values[1] —— 当前值缺省/异形时也能给出唯一变体。
	const a = axis.values[0];
	const b = axis.values[1];
	return cur === a ? b : a;
}

/**
 * 主盘 settle 后调用(models/astro.js)。为每个二值轴构一个「只翻该轴」的 /chart 变体任务,
 * 经 idleWarmQueue 空闲执行。返回提交任务数(诊断用)。
 */
export function speculateChartOptions(fieldValues, astroState){
	if(!optionPrefetchEnabled() || !chartTaskBuilder){
		return 0;
	}
	const tab = astroState && astroState.currentTab;
	if(!shouldArmForTab(tab)){
		return 0;
	}
	if(!fieldValues || !fieldValues.date || !fieldValues.date.value){
		return 0;
	}
	const tasks = [];
	for(let i = 0; i < BINARY_CHART_AXES.length && tasks.length < BUDGET_PER_SETTLE; i += 1){
		const axis = BINARY_CHART_AXES[i];
		const entry = fieldValues[axis.key];
		const cur = entry && entry.value !== undefined ? entry.value : undefined;
		const alt = altValueOf(axis, cur);
		const variant = {
			...fieldValues,
			[axis.key]: { ...(entry || { name: [axis.key] }), value: alt },
		};
		try{
			const t = chartTaskBuilder(variant, astroState);
			if(t && typeof t.run === 'function'){
				tasks.push({ name: `opt:${axis.key}=${alt}`, run: t.run });
			}
		}catch(e){ /* 单轴构参失败跳过(如非法组合),不碍其余轴 */ }
	}
	if(!tasks.length){
		return 0;
	}
	// chartId 为代:同一张盘只投机一轮;新盘 settle 自动换组作废旧队(idleWarmQueue 既有语义)。
	const gen = astroState && astroState.chartObj && astroState.chartObj.chartId
		? astroState.chartObj.chartId
		: 'boot';   // 首盘尚无 chartId:固定代号,下一次真盘 settle 即换组作废
	scheduleDataWarmGroup(`opt:${tab}:${gen}`, tasks.map((t)=>({ name: t.name, task: t.run })));
	return tasks.length;
}

export function __resetOptionPrefetchForTest(){
	chartTaskBuilder = null;
}
