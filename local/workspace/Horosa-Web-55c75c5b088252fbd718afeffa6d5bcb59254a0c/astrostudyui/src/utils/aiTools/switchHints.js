// 功能开关关掉的工具:报错里直接说「开哪个开关、在哪开」。此前外部客户端调到关着的工具只看到「未知工具」,
//   分不清是拼错了名字还是开关没开。桌面写面板与开关名;无头模式写终端命令(无头没有的开关如实说只在桌面 App 里有)。
//   开关本身永远只由用户本人改 —— 这里只出文字,不提供任何改开关的途径。
const SWITCHES = {
	headless: { cli: 'headless-analysis', desk: '「外部智能体」面板的「无头分析出口(run_analysis)」' },
	privateRead: { cli: 'private-read', desk: '「外部智能体」面板的「私人内容可读」' },
	webFetch: { cli: 'web-fetch', desk: '「联网检索」面板的「网页读取」' },
	webSearch: { cli: null, desk: '「联网检索」面板的总开关' },
	goal: { cli: 'goal-tasks', desk: '「AI 助手行动能力」面板的「目标任务」' },
	scheduler: { cli: 'scheduler', desk: '「AI 助手行动能力」面板的「定时任务」' },
};
export const SWITCH_HINT_KEYS = Object.freeze(Object.keys(SWITCHES));
export function isHeadlessRuntime(){ return typeof globalThis !== 'undefined' && !!globalThis.__HOROSA_HEADLESS_STORE__; }
// keys:都要开(all,缺省)或任开其一(any)
export function switchHintText(keys, mode){
	const list = (Array.isArray(keys) ? keys : [keys]).map((k)=>SWITCHES[k]).filter(Boolean);
	if(!list.length){ return ''; }
	const joiner = mode === 'any' ? ' 或 ' : ' 与 ';
	if(isHeadlessRuntime()){
		const cli = list.filter((s)=>s.cli);
		if(mode === 'any' ? cli.length : cli.length === list.length){
			return `要用须用户本人在终端执行 ${cli.map((s)=>`./horosa config ${s.cli} on`).join(joiner)}`;
		}
		return `无头模式没有这个开关;要用须在星阙桌面 App 里打开 ${list.map((s)=>s.desk).join(joiner)}`;
	}
	return `要用须用户在星阙「进阶」里打开 ${list.map((s)=>s.desk).join(joiner)}`;
}

// 外部客户端建的任务等用户放行:桌面在任务中心点按钮;无头用终端命令(人工子命令,AI 自己执行不了)
const TASK_CENTER_VERBS = { resume: '继续', start: '开始' };
export function taskReleaseHint(op, taskId){
	const verb = TASK_CENTER_VERBS[op] || op;
	if(isHeadlessRuntime()){ return `需用户本人在终端执行 ./horosa tasks ${op} ${taskId || '<任务id>'}(无头常驻服务 ./horosa start 开着时才会到点 / 开跑)`; }
	return `需用户在星阙任务中心点「${verb}」`;
}
