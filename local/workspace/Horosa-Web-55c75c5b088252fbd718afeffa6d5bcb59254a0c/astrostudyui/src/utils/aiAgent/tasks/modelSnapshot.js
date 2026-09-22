// [D38] 任务创建时快照 modelSelection —— 纯函数小模块(只依赖 uiPrefs 读端):工具目录里的 schedule_task 不能 import goalRunner
// (goalRunner → runtime → aiTools 目录 → 工具 → goalRunner 成环,注册时 default 为 undefined)。
// 此前四条创建路径没有一条写 spec.modelSelection ⇒ 后台任务永远用「当前」UI 选中的模型,用户换模型后所有排期任务静默换模型;
// 旧任务无字段 ⇒ 仍读当前 UI(现状不变)。
import { loadUiPrefs } from '../../aiAnalysisStore';

export function snapshotModelSelection(explicit){
	if(explicit){ return `${explicit}`; }
	try{ return `${(loadUiPrefs() || {}).modelSelection || ''}`; }catch(e){ return ''; }
}
