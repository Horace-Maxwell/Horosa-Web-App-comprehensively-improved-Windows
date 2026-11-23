// AI 助手子系统启动门面:布局层在首帧提交后动态加载本模块,再按原顺序逐个接线(接线顺序只写在 layouts/app.js 一处)。
//
// 为什么延后:外部智能体桥 / 任务中心 / 自动化引擎 / 定时调度这一串若在布局层静态引用,会把工具目录、
// 智能体运行时、挂载快照(连带各技法主组件)整包拖进首屏 —— 首帧要等十几 MB 源码下载 + 解析。
// 延后是安全的:壳侧对「钩子晚装」早有兜底 —— 定时心跳在 window.__horosaSchedulerTick 装上之前进待处理队列
// (只留最新一次),外部桥装上后补读在途队列再通知壳就绪;总开关缺省关时这些接线本来就是零挂钩零监听。
// 合同:src/utils/__tests__/firstScreenStaticGraph.test.js(首屏静态图不得走到本门面与它背后的模块)。
export { bindMcpBridge } from './mcpBridge';
export { bindTaskCenter, bindSchedulerTicks, unbindSchedulerTicks } from './tasks';
export { bindAutomationEngine } from './automation/engine';
export { buildDefaultAutomationDeps } from './automation/deps';
export { bindCrossWindowPrefs } from './prefs';
export { emitAutomationEvent } from './automation/events';
