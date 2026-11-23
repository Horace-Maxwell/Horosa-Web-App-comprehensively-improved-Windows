// 择日工作台的读源码检查用(非 .test.js:测试公因子,照 helpers/ 惯例)。
// 九家工作台(八字 / 紫微 / 六壬 / 奇门 / 太乙 / 三式 / 七政 / 印度 / 黄历)共用壳 components/zeri/ZeriWorkbenchShell.js:
// 交互、版式、方案存取、结果表都在壳里,各家文件只交一份派描述(条件注册表 / 参数 / 结果列 / 措辞)。
// readWorkbench(文件) —— 该家派文件 + 共用壳首尾相接的文本(共享行为在壳里找,本家特有的在派文件里找);
//                       不是工作台的文件原样读。拼出来的是文本,要解析 AST 的检查逐个文件解析(workbenchFiles)。
// workbenchFiles(文件) —— [派文件, 共用壳] 的绝对路径。
const fs = require('fs');
const path = require('path');

const ZERI_DIR = path.resolve(__dirname, '..', '..', '..', 'components', 'zeri');
const SHELL = path.join(ZERI_DIR, 'ZeriWorkbenchShell.js');
const WORKBENCH_FILES = ['BaziZeriWorkbench.js', 'ZiweiZeriWorkbench.js', 'LiurengZeriWorkbench.js', 'QimenZeriWorkbench.js', 'TaiyiZeriWorkbench.js',
	'SanshiZeriWorkbench.js', 'QizhengZeriWorkbench.js', 'IndiaZeriWorkbench.js', 'HuangliZeriWorkbench.js'];

const isWorkbench = (f)=>/ZeriWorkbench\.js$/.test(path.basename(`${f}`));
const resolve = (f)=>(path.isAbsolute(`${f}`) ? `${f}` : path.join(ZERI_DIR, path.basename(`${f}`)));

function workbenchFiles(f){
	return isWorkbench(f) ? [resolve(f), SHELL] : [resolve(f)];
}
function readWorkbench(f){
	return workbenchFiles(f).map((p)=>fs.readFileSync(p, 'utf8')).join('\n');
}

module.exports = { readWorkbench, workbenchFiles, WORKBENCH_FILES, SHELL, ZERI_DIR };
