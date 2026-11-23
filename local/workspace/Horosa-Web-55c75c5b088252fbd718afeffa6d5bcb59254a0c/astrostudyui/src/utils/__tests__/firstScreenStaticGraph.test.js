// 首屏静态 import 图禁入清单(源码层主锁;产物层有 check-chunk-dup.js 的首屏字节预算兜底)。
//
// 首屏 = 布局层(layouts/index.js → app.js → 页眉 / 横幅 …)+ 首页(pages/index.js)沿静态 import 能走到的全部模块,
// 首帧要等它们全部下载 + 解析。下面这些模块不是首帧要用的,却曾经被一两条静态 import 整包拖进首屏
// (实测首屏同步图源码 31MB,其中任务中心铃铛一条链独占 12MB):它们必须在 import() 之后。
// 判据是「能不能静态走到」,不是「谁 import 了它」:任何人以后从首屏的任何文件新加一条静态链,这里当场红并打出整条链。
const path = require('path');
const { scanSourceTree } = require('./helpers/importGraph');

const SRC = path.resolve(__dirname, '..', '..');
const ROOTS = ['layouts/index.js', 'pages/index.js'];

// 禁入模块 → 为什么它不该在首屏、正确的入口在哪(理由必填,见末条测试)
const FIRST_SCREEN_FORBIDDEN = {
	'utils/aiAgent/boot.js': 'AI 助手子系统门面:布局层首帧提交后 import() 再接线(外部桥 / 任务中心 / 自动化 / 定时调度)',
	'utils/aiAgent/mcpBridge.js': '外部智能体桥:经 aiAgent/boot 延后接线;壳侧对钩子晚装有在途队列兜底',
	'utils/aiAgent/runtime.js': '智能体运行时:只在 AI 分析页 / 目标任务执行时用',
	'utils/aiAgent/goalRunner.js': '目标任务执行器:只在任务中心 / AI 分析页用',
	'utils/aiAgent/automation/engine.js': '自动化引擎:经 aiAgent/boot 延后接线',
	'utils/aiTools/index.js': '工具目录(八十多件工具连带各技法起盘):只在 AI 助手运行时用',
	'components/aianalysis/TaskCenterBell.js': '任务中心铃铛:布局层 makeLazyBoundary 懒加载(连带抽屉 / 目标执行器)',
	'components/aianalysis/TaskCenterPanel.js': '任务中心抽屉:随铃铛懒加载',
	'components/help/techniqueHelpRegistry.js': '技法手册注册表(三十多本手册):页眉打开操作手册弹窗才懒加载 TechniqueHelpModalBody',
	'utils/aiAnalysisExport.js': '会话 docx / 工作区备份 zip(连带 docx 库):轻消费方只存文件,从 utils/fileSave 取',
	'utils/aiAnalysisContext.js': '挂载快照(连带各技法主组件的无头起盘):只在 AI 分析 / 导出 / 工具执行时用',
	'utils/techniqueMountSettings.js': '各技法挂载设置(连带多个技法主组件):只在 AI 分析 / 设置面用',
	// 门面拆成子模块后,直接引子模块也不许进首屏:下面三份各自连带技法组件(其余子模块都经 schema 走到它们)
	'utils/techniqueMountSettings/schema.js': '挂载设置总表(连带各技法选项模块):随门面同属 AI 分析 / 设置面',
	'utils/techniqueMountSettings/divinationFields.js': '卜类挂载字段组(连带奇门 / 太乙 / 六壬等计算模块):随门面同属 AI 分析 / 设置面',
	'utils/techniqueMountSettings/astroFields.js': '星类挂载字段组(连带占星推运组件常量):随门面同属 AI 分析 / 设置面',
};

let scan = null;
beforeAll(()=>{ scan = scanSourceTree(SRC); });

// 广度优先:每个可达模块记下前驱,红了打出从根到它的整条静态链
function reach(graph){
	const prev = new Map();
	const queue = [];
	ROOTS.forEach((r)=>{ const abs = path.join(SRC, r); prev.set(abs, null); queue.push(abs); });
	while(queue.length){
		const f = queue.shift();
		(graph.get(f) || new Set()).forEach((d)=>{ if(!prev.has(d)){ prev.set(d, f); queue.push(d); } });
	}
	return prev;
}
function chainOf(prev, abs){
	const out = [];
	for(let f = abs; f; f = prev.get(f)){ out.unshift(path.relative(SRC, f)); }
	return out.join(' → ');
}

it('首屏根与禁入清单里的文件都真实存在(清单不许腐化成幽灵条目)', ()=>{
	ROOTS.concat(Object.keys(FIRST_SCREEN_FORBIDDEN)).forEach((rel)=>{
		expect(scan.graph.has(path.join(SRC, rel))).toBe(true);
	});
});

it('首屏图不空转:布局层 → app.js → 页眉 / 横幅都走得到,可达模块成百', ()=>{
	const prev = reach(scan.graph);
	['layouts/app.js', 'components/homepage/PageHeader.js', 'components/common/LocalStoreHealthBanner.js', 'utils/fileSave.js', 'utils/aiAgent/automation/events.js'].forEach((rel)=>{
		expect(prev.has(path.join(SRC, rel))).toBe(true);
	});
	expect(prev.size).toBeGreaterThan(300);
});

it('🔴 禁入模块一个都不能从首屏静态走到', ()=>{
	const prev = reach(scan.graph);
	const offenders = Object.keys(FIRST_SCREEN_FORBIDDEN)
		.filter((rel)=>prev.has(path.join(SRC, rel)))
		.map((rel)=>`${rel}:${chainOf(prev, path.join(SRC, rel))}`);
	expect(offenders).toEqual([]);
});

it('🔴 自证:把首屏到禁入模块的一条静态边加回去,判据必须红(否则上面全绿毫无意义)', ()=>{
	const graph = new Map([...scan.graph].map(([k, v])=>[k, new Set(v)]));
	graph.get(path.join(SRC, 'layouts/index.js')).add(path.join(SRC, 'components/aianalysis/TaskCenterBell.js'));
	const prev = reach(graph);
	expect(prev.has(path.join(SRC, 'utils/aiAgent/goalRunner.js'))).toBe(true);
	expect(prev.has(path.join(SRC, 'components/aianalysis/TaskCenterPanel.js'))).toBe(true);
});

it('每条禁入都写明理由与正确入口', ()=>{
	Object.values(FIRST_SCREEN_FORBIDDEN).forEach((why)=>expect(String(why).length).toBeGreaterThan(12));
});
