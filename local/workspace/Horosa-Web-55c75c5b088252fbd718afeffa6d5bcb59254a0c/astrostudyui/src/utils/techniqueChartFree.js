// techniqueChartFree —— 「点时间→出盘」快车道的期望表(哨兵用,非运行时真值源)。
//
// 🔴 运行时真值源是【hook 自描述】:组件在注册 predictHook[tab].fun 的同处声明
//    `this.props.hook.chartFree = true`(=本页中右栏零消费共享 chartObj)。
//    fetchByFields 据此走快车道(fields 立即提交,不等 /chart)。
//    用自描述而非本表驱动,是防「注册表与现实漂移」——组件改了消费面,声明就在改动现场。
//
// 本表只作两用:
//    ① jest 静态哨兵(chartFreeContract.test.js)的期望清单:声明了 chartFree 的组件,
//       其源文件必须【零】出现 props.value / chartObj 读取(机械 grep,漂移即红);
//    ② 实施清单:哪些页已核、哪些待核(未列=未核=不声明=走旧路径,零风险)。
//
// ⚠️ 新增条目的唯一合法流程:先 grep 该组件(及其渲染的子组件树)确认零 chartObj 消费,
//    再在组件里声明 + 在此登记。只登记不声明=无效;只声明不登记=哨兵红。

/** 已声明 chartFree 的组件(源文件路径 → 所在 tab 说明) */
export const CHART_FREE_DECLARED = {
	'components/cntradition/BaZi.js': '八字(本地引擎 baziLunarLocal,fields 即算)',
	'components/kinastro/KinAstroMain.js': '数算/其他命(native 技法本地算;pan 技法自发 kentang 请求,均只吃 fields)',
	'components/ziwei/ZiWeiMain.js': '紫微(/ziwei/birth 只依赖 fields;本地引擎同)',
};

/** 已核实但尚未声明(候选,逐个核毕子组件树后迁入上表) */
export const CHART_FREE_CANDIDATES = [
	'components/fengshui/FengShuiMain.js',     // 纯本地 fengshuiEngine,无 hook 注册(无从声明,须先接 hook)
	'components/calendar/CalendarMain.js',     // 黄历,本地
	'components/cntradition/CnTraditionMain.js', // 辅助,本地
];
