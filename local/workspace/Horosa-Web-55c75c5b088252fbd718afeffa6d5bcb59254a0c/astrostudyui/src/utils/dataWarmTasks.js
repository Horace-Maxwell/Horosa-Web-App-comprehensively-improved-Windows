// horosa_data_warm_registry_v1
// dataWarmTasks —— 排盘后「数据层空闲预热」的登记处(R4-B3)。
//
// 为什么单独一个模块:清单若写死在 pages/index.js 的数组里,页面组件因此持有技法知识,
// 漏项没人发现(紫微 /ziwei/birth —— 首点概率最高的技法之一 —— 一直不在组里)。
// 挪到这里之后,新增一条 = 加一行 registerDataWarmTask,登记序 = 首点概率序 = 执行序。
//
// 纪律(与 idleWarmQueue / _requestCache 头注同一条):
//   · 只进【确定性纯计算】端点:同参恒同果、无随机、不依赖「现在时刻」;
//   · 必须走各技法【自己导出的 warm builder + 缓存入口】—— url/body 与用户首点逐字节一致,
//     差一个字节就只是白打一次网络(还污染缓存容量);
//   · 一律 silent + 零重试、丢结果、绝不 dispatch/setState;失败静默;
//   · 任务体内动态 import:不把技法 chunk 拖进主包,顺带把该技法的引擎模块也预热了。
//
// 双闸沿用 idleWarmQueue:horosa.perf.idleWarmQueue(总)/ horosa.perf.dataWarmTasks(细)。
// 组以 chartId 为代:新盘作废旧组;任意时刻至多 1 个预热在途;用户任何交互即让路。
import { registerDataWarmTask, buildRegisteredDataWarmTasks } from './idleWarmQueue';

// —— 登记序 = 首点概率序(靠前的先付) ——

// [Windows-only ①②] 星运/印占两条自 PERF-R9 起在册(上游注册表暂未收编此二项;
// 移除即两页首点回付冷成本)。builder 纪律同上:各技法自己导出的 warm 入口,键逐字节同。
registerDataWarmTask('direction:pd', (fields, chartObj)=>
	import('../components/direction/AstroDirectMain').then((m)=>m.warmPrimaryDirection(chartObj, fields)));

registerDataWarmTask('india:birth', (fields)=>
	import('../components/astro/IndiaChart').then((m)=>m.requestIndiaChartData(m.buildIndiaWarmParams(fields))));

// ① 紫微 /ziwei/birth —— 首点概率最高的技法之一(R4-B3 首铺)。
registerDataWarmTask('ziwei:birth', (fields)=>
	import('../components/ziwei/ZiWeiMain').then((m)=>m.warmZiweiBirth(fields)));

// ② 七政本命 /chart(只暖本命:Moira 流年默认过运时刻=「现在」,取现时禁入;
//    三段链式预热由步进预取登记负责,那里能读到用户显式设置的 transitTime)。
registerDataWarmTask('guolao:natal', (fields)=>
	import('../components/guolao/GuoLaoChartMain').then((m)=>m.warmGuolaoNatal(fields)));

// [Windows-only] 量化盘 /germany/midpoint(辅盘默认子页 germanytech;PERF-R9 起在册)。
registerDataWarmTask('germany:midpoint', (fields)=>
	import('../components/germany/AstroMidpoint').then((m)=>m.warmGermanyMidpoint(fields)));

// ③ 遁甲 stage-1:/nongli/time + /jieqi/year 种子 —— 两段式技法的第一段是纯历法计算,
//    提前付掉后用户点开遁甲时 pan 的输入即时可得。
registerDataWarmTask('dunjia:stage1', (fields)=>
	import('../components/dunjia/DunJiaMain').then((m)=>m.warmDunJiaStage1(fields)));

// ④ 太乙 stage-1:/nongli/time(同上)。
registerDataWarmTask('taiyi:stage1', (fields)=>
	import('../components/taiyi/TaiYiMain').then((m)=>m.warmTaiYiStage1(fields)));

// ⑤ [Windows-only] 分至图年表 /jieqi/year —— 自 PERF-R10 起随组预热(组式调度天然
//    「交互即让路 + 新盘作废旧组」,重端点风险由让路语义吸收;移除即分至图首点回付冷成本)。
registerDataWarmTask('jieqi:year', (fields)=>
	import('../components/jieqi/JieQiChartsMain').then((m)=>m.warmJieqiYear(fields)));

/** 供 pages/index.js 调:按登记序把注册表铺成 scheduleDataWarmGroup 的任务数组。 */
export function buildDataWarmTasks(fields, chartObj){
	return buildRegisteredDataWarmTasks(fields, chartObj);
}
