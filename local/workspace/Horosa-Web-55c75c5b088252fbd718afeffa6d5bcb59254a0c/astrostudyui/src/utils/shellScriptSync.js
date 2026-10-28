// 界面简繁 → 桌面壳(原生菜单栏 / 原生对话框随档换写法)。
// 壳不做简繁转换,文案两种写法都在壳的文案表里;页面只负责在开机与每次切换时把当前档告诉壳。
// 非桌面环境(网页版 / 测试)零动作。重复安装是空操作(宿主 effect 可能重跑)。回 detach。
import { currentScriptMode, subscribeScriptMode } from './scriptMode';
import { hasTauriInvoke, desktopSetShellScript } from './aiAnalysisDesktop';

let installed = null;

export function installShellScriptSync(){
	if(installed){ return installed; }
	if(!hasTauriInvoke()){ return ()=>{}; }
	const report = (mode)=>{
		try{ Promise.resolve(desktopSetShellScript(mode)).catch(()=>{}); }catch(e){ /* 壳不认这条命令(旧壳)时静默 */ }
	};
	report(currentScriptMode());
	const off = subscribeScriptMode((mode)=>report(mode));
	installed = ()=>{ off(); installed = null; };
	return installed;
}
