// 就绪后空闲预热队列(WS-3c)。
//
// 目标:暖后「任意技法首点亚秒」——把用户第一次点某技法才付的成本
// (引擎模块初始化/常量表构建/JIT、乃至高频数据请求)挪进就绪后的空闲时段。
// 三层任务:
//   chunk 层 —— UI 组件 chunk 预载已由 pages/index.js startIdlePreload 承担(概率序+悬停预取);
//   引擎层 —— 本注册表:动态 import 本地纯计算引擎模块(模块级常量表/查表结构构建是首点大头;
//             动态 import 不进主包,已预载过的 chunk 秒回);
//   数据层 —— registerIdleWarmTask 留给各技法按真实取数口径登记(绝不在此臆造技法参数)。
//
// 调度纪律:
//   · requestIdleCallback 逐个执行(降级 setTimeout),每次只跑一个任务;
//   · 用户任何交互(pointerdown/keydown/wheel)即让路 —— 暂停队列,静默 4s 后再续;
//   · 任务失败静默跳过(预热是优化不是功能,绝不影响业务);
//   · kill-switch:localStorage horosa.perf.idleWarmQueue = '0'(perfFlags 同款约定)。
import { idleWarmQueueEnabled, dataWarmTasksEnabled } from './perfFlags';

// 引擎层注册表:动态 import 高频技法的本地纯计算模块(与导航概率序同基准)。
// 只列「用户首点该技法必然要初始化」的模块;新技法引擎按同格式追加。
const ENGINE_WARM_IMPORTS = [
	() => import('./baziLunarLocal'),          // 八字本地历法引擎(主盘走本地)
	() => import('./baziShenShaLocal'),        // 八字神煞
	() => import('../components/ziwei/ZiweiCalc'),      // 紫微本地引擎(流派/四化表)
	() => import('../components/guazhan/GuaZhanMain'),  // 六爻装卦引擎(卦表)
	() => import('../components/lrzhan/LiuRengMain'),   // 大六壬(课经/神煞表)
	() => import('../components/dunjia/DunJiaCalc'),    // 奇门排盘引擎
	() => import('../components/taiyi/TaiYiCalc'),      // 太乙本地推演
	() => import('./heluoLocal'),              // 河洛理数
	() => import('./zhengchuanTiebanLocal'),   // 神数正传·铁板(秘数表)
	() => import('./zhengchuanShaoziLocal'),   // 神数正传·邵子(卦数/气数/太玄玉景)
	() => import('./zhengchuanLiuqinLocal'),   // 神数正传·六亲(姓氏谱/遁甲盘/四象)
	() => import('./zhengchuanXinyiLocal'),    // 神数正传·心易(八刻分命/条文秘数表)
	() => import('../components/guice/GuiceMain'),      // 皇极轨策(起卦十二法/演数/断法/十应/大定;组件级 lazy → 预热即首点不等)
	() => import('../components/xiaochengtu/XiaoChengTuMain'), // 小成图(九宫布图/正旁推/股市卦)
	() => import('../components/feigong/FeiGongMain'),  // 飞宫小奇门(十二局/命宫/月运流年)
	() => import('../components/xiaoliuren/XiaoLiuRenMain'), // 小六壬(两派掌诀/三传)
	() => import('../divination/horary/horaryEngine'),  // 卜卦盘引擎
	() => import('../divination/election/electionEngine'), // 择日引擎
];

// 数据层任务注册(各技法自行登记「按当前命盘的真实取数」,如填 L1/L2/后端 paramhash 的
// 幂等请求)。task: () => Promise<any>;name 仅用于诊断。
// 注:本注册表只在 startIdleWarmQueue 启动瞬间被快照一次(引擎层同批);排盘后的
// 动态数据预热走下方 scheduleDataWarmGroup(组式,可作废可重 arm),不要再用本函数。
const DATA_WARM_TASKS = [];
export function registerIdleWarmTask(name, task){
	if(typeof task === 'function'){
		DATA_WARM_TASKS.push({ name: `${name || 'anon'}`, task });
	}
}

// —— horosa_data_warm_registry_v1(PERF-R9 Ship 7):排盘后数据层预热的【任务注册表】 ——
// 病根:任务清单此前写死在 pages/index.js 的一个 4 条数组里 —— 与技法零关系的页面组件
// 持有技法知识,漏项没人发现(紫微 /ziwei/birth 首点概率最高,却整轮不在组里)。
// 改注册表后:追加一条 = 一行登记;Map 的插入序 = 首点概率序 = 执行序。
// 登记方职责(本模块不校验,见上方纪律):确定性端点 + 技法自己的 builder/缓存入口 + silent。
// ⚠️ 登记发生在模块 import 期(见 utils/dataWarmTasks.js),故 __resetIdleWarmQueue 【不】清它。
const DATA_WARM_REGISTRY = new Map();

/**
 * @param {string} taskKey 诊断名(同名重登记=覆盖,顺序保持首次登记位)
 * @param {function} fn (fields, chartObj) => Promise<any>
 */
export function registerDataWarmTask(taskKey, fn){
	if(taskKey && typeof fn === 'function'){
		DATA_WARM_REGISTRY.set(`${taskKey}`, fn);
	}
}

/** 按登记序把注册表铺成 scheduleDataWarmGroup 吃的任务数组。 */
export function buildRegisteredDataWarmTasks(fields, chartObj){
	const tasks = [];
	DATA_WARM_REGISTRY.forEach((fn, name)=>{
		tasks.push({ name, task: ()=> fn(fields, chartObj) });
	});
	return tasks;
}

/** 测试/诊断:当前登记的任务名(即执行序)。 */
export function __dataWarmRegistryKeys(){
	return Array.from(DATA_WARM_REGISTRY.keys());
}

let started = false;
let paused = false;
let pauseTimer = null;

// ── PERF-R8 P2:排盘后数据层预热(组式)────────────────────────────────────────
// 与上面的启动期一次性快照不同:每次排盘成功都会带来一组新的「按当前盘参数」的预热任务,
// 且新盘必须作废旧盘的未执行任务。因此:
//   · scheduleDataWarmGroup(generationKey, tasks):登记一组任务并(必要时)重新拉起泵;
//     generationKey 通常 = chartObj.chartId —— 新组到来即作废旧组(出队与执行前双检);
//   · 泵与启动期队列共用同一 paused 让路状态与单任务串行纪律(任意时刻至多 1 个预热在途);
//   · 任务约束(调用方职责,本模块不校验):确定性端点白名单、走该技法自己导出的
//     builder + 缓存入口、请求一律 silent:true、绝不 dispatch 任何全局 state;
//   · 双闸:总闸 horosa.perf.idleWarmQueue(连本模块一起关)+ 细闸 horosa.perf.dataWarmTasks
//     (调度时与执行前各读一次,中途关闸立即生效);
//   · 失败静默:预热是优化不是功能。

let dataGroupGeneration = null;
let dataGroupTasks = [];
let dataPumpRunning = false;

export function scheduleDataWarmGroup(generationKey, tasks){
	if(!idleWarmQueueEnabled() || !dataWarmTasksEnabled()){
		return;
	}
	if(typeof window === 'undefined' || !generationKey || !Array.isArray(tasks)){
		return;
	}
	attachYieldListeners();
	dataGroupGeneration = String(generationKey);
	dataGroupTasks = tasks
		.filter((t)=>t && typeof t.task === 'function')
		.map((t)=>({ name: `${t.name || 'anon'}`, task: t.task, generation: dataGroupGeneration }));
	if(dataPumpRunning){
		return; // 在跑的泵会自然读到新组(旧组条目因 generation 不匹配被丢弃)
	}
	dataPumpRunning = true;
	const pump = ()=>{
		if(paused){
			scheduleIdle(pump);
			return;
		}
		if(!dataWarmTasksEnabled()){
			dataPumpRunning = false;
			dataGroupTasks = [];
			return;
		}
		const entry = dataGroupTasks.shift();
		if(!entry){
			dataPumpRunning = false;
			return; // 组耗尽,泵停;下一次 scheduleDataWarmGroup 会重新拉起
		}
		if(entry.generation !== dataGroupGeneration){
			// 旧盘遗留任务:直接丢弃,继续下一条(不执行、不计时)
			scheduleIdle(pump);
			return;
		}
		Promise.resolve()
			.then(entry.task)
			.catch(()=>{ /* 预热失败静默:首点回到冷即付的现状 */ })
			.finally(()=>{ scheduleIdle(pump); });
	};
	// 让位给排盘自身的渲染与 doHook 刷新:2s 后从空闲档起步。
	setTimeout(()=>{ scheduleIdle(pump); }, 2000);
}

function scheduleIdle(fn){
	if(typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function'){
		window.requestIdleCallback(fn, { timeout: 4000 });
	}else{
		setTimeout(fn, 500);
	}
}

function attachYieldListeners(){
	if(typeof window === 'undefined'){
		return;
	}
	const yieldNow = ()=>{
		paused = true;
		if(pauseTimer){
			clearTimeout(pauseTimer);
		}
		// 交互后静默 4s 再续跑:预热永远给用户操作让路。
		pauseTimer = setTimeout(()=>{ paused = false; }, 4000);
	};
	try{
		window.addEventListener('pointerdown', yieldNow, { passive: true });
		window.addEventListener('keydown', yieldNow, { passive: true });
		window.addEventListener('wheel', yieldNow, { passive: true });
	}catch(e){ /* 监听失败不影响队列(只是不让路) */ }
}

// 启动队列:index.js 首屏就绪后调用(幂等)。initialDelayMs 默认 4s——
// 排在 chunk 预载(1s 起步)之后,错峰不抢同一段空闲。
export function startIdleWarmQueue(options = {}){
	if(started || !idleWarmQueueEnabled()){
		return;
	}
	if(typeof window === 'undefined'){
		return;
	}
	started = true;
	attachYieldListeners();
	// __tasksOverride:仅测试注入(调度语义可测,不真拉引擎模块)。
	const tasks = Array.isArray(options.__tasksOverride)
		? options.__tasksOverride.slice()
		: [
			...ENGINE_WARM_IMPORTS.map((imp, i) => ({ name: `engine:${i}`, task: imp })),
			...DATA_WARM_TASKS,
		];
	const next = ()=>{
		if(paused){
			scheduleIdle(next);
			return;
		}
		const entry = tasks.shift();
		if(!entry){
			return;
		}
		Promise.resolve()
			.then(entry.task)
			.catch(()=>{ /* 预热失败静默:首点回到冷即付的现状 */ })
			.finally(()=>{ scheduleIdle(next); });
	};
	setTimeout(()=>{ scheduleIdle(next); }, options.initialDelayMs || 4000);
}

// 测试用
export function __resetIdleWarmQueue(){
	started = false;
	paused = false;
	DATA_WARM_TASKS.length = 0;
	dataGroupGeneration = null;
	dataGroupTasks = [];
	dataPumpRunning = false;
}
export function __idleWarmStats(){
	return {
		started, paused,
		dataTasks: DATA_WARM_TASKS.length,
		engines: ENGINE_WARM_IMPORTS.length,
		dataGroupGeneration,
		dataGroupPending: dataGroupTasks.length,
		dataPumpRunning,
	};
}
