// horosa_data_warm_registry_v1
// dataWarmTasks —— 排盘后「数据层空闲预热」的登记处(PERF-R8 P2 的清单 → PERF-R9 Ship 7 的注册表)。
//
// ⚠️ 本文件是 **Windows overlay 的原创新文件**(Mac 基线里不存在),故走 windows-adaptations
//    的**全量拷贝层** `files/astrostudyui/src/utils/dataWarmTasks.js`,不是 patches/。
//    改这里 = 必须同步改那份拷贝(HARNESS_MANIFEST 与哨兵 horosa_data_warm_registry_v1 双守)。
//
// 为什么单独一个模块:清单原本写死在 pages/index.js 的一个 4 条数组里,页面组件因此持有技法
// 知识,漏项没人发现(紫微 /ziwei/birth —— 首点概率最高的技法之一 —— 一直不在组里)。
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

// ① 星运(direction 默认子页 primarydirect 的 /predict/pd)
registerDataWarmTask('direction:pd', (fields, chartObj)=>
	import('../components/direction/AstroDirectMain').then((m)=>m.warmPrimaryDirection(chartObj, fields)));

// ② 印占 /india/chart
registerDataWarmTask('india:birth', (fields)=>
	import('../components/astro/IndiaChart').then((m)=>m.requestIndiaChartData(m.buildIndiaWarmParams(fields))));

// ③ 紫微 /ziwei/birth —— PERF-R9 Ship 7 补入(此前最大的漏项)
registerDataWarmTask('ziwei:birth', (fields)=>
	import('../components/ziwei/ZiWeiMain').then((m)=>m.warmZiweiBirth(fields)));

// ④ 七政本命 /chart(只暖本命:Moira 流年默认过运时刻=「现在」,禁入)
registerDataWarmTask('guolao:natal', (fields)=>
	import('../components/guolao/GuoLaoChartMain').then((m)=>m.warmGuolaoNatal(fields)));

// ⑤ 量化盘 /germany/midpoint(辅盘默认子页 germanytech)
registerDataWarmTask('germany:midpoint', (fields)=>
	import('../components/germany/AstroMidpoint').then((m)=>m.warmGermanyMidpoint(fields)));

// ⑥ 遁甲 stage-1:/nongli/time + /jieqi/year 种子 —— PERF-R9 Ship 7 补入。
//    两段式技法的第一段是纯历法计算,提前付掉后用户点开遁甲时 pan 的输入即时可得。
registerDataWarmTask('dunjia:stage1', (fields)=>
	import('../components/dunjia/DunJiaMain').then((m)=>m.warmDunJiaStage1(fields)));

// ⑦ 太乙 stage-1:/nongli/time —— PERF-R9 Ship 7 补入(同上)。
registerDataWarmTask('taiyi:stage1', (fields)=>
	import('../components/taiyi/TaiYiMain').then((m)=>m.warmTaiYiStage1(fields)));

// ⑧ 分至 /jieqi/year —— PERF-R9 Ship 7 补入,【排最后一位】。
//    这是本组唯一的重端点(全年 24 节气高精度求解)。此前的判断是「重端点不进默认组」;
//    改判的前提是:组已改成串行 + 交互即让路 + 排在全部轻端点之后 —— 它只会吃到真正的
//    空闲尾巴,而分至页首点省下的是整整一次重算。年份步进另有 prefetchJieqiYearNeighbors 接手。
registerDataWarmTask('jieqi:year', (fields)=>
	import('../components/jieqi/JieQiChartsMain').then((m)=>m.warmJieqiYear(fields)));

/** 供 pages/index.js 调:按登记序铺成 scheduleDataWarmGroup 的任务数组。 */
export function buildDataWarmTasks(fields, chartObj){
	return buildRegisteredDataWarmTasks(fields, chartObj);
}
