// [V5-A3] 影子副本前端侧:本地记录库四键(两库+两回收站)每次落盘后镜像到壳层文件。
//
// 为什么:WebView 数据目录由系统派生、app 不可控、用户不可见,存在被清理工具/磁盘压力
// 驱逐/文件损坏/写后立即退出未落盘 四类丢失路径;镜像住壳层 app 数据目录(原子写,
// invoke 返回即已 fsync 在盘),四种死法同一张保险单。
//
// 恢复语义(与紫微自定义表 IDB 镜像自愈同款,仓内既有先例):
//   🔴 仅在主存(localStorage)键**完全缺失**时把影子写回 —— 存在的主存永远优先,绝不覆盖
//   (主存可能比影子新:极端退出时最后一写可能只到主存未及镜像)。
// 非桌面环境(浏览器 dev / jest)全部 no-op,零依赖零影响。
import { isDesktopBridgeAvailable, invokeDesktopCommand } from './aiAnalysisDesktop';
import { safeLocalStorageGet, safeLocalStorageSet } from './safeStorage';
import { isSecondaryInstancePort } from '../components/common/MultiInstanceNotice';

// horosa_shadow_mirror_electron_v1(Windows 对位;建议上游知悉):上游把「双保险副本」的
// 壳侧文件镜像走 Tauri invoke —— Electron 壳没有 __TAURI__,不对位则该特性在 Windows
// **静默不存在**(发布说明承诺的数据保险死件)。对位=同语义三件套:壳层 IPC 原子写
// (tmp+fsync+rename,与 Rust 端同款)+ preload 桥 + 本适配层;白名单/恢复规则逐字对齐。
// jest/浏览器无 horosaDesktop ⇒ 返回 null 走原 Tauri 判定,上游测试与 Mac 行为零改变。
function electronShadowBridge(){
	try{
		const d = typeof window !== 'undefined' ? window.horosaDesktop : null;
		return (d && typeof d.shadowStoreWrite === 'function' && typeof d.shadowStoreReadAll === 'function') ? d : null;
	}catch(_e){
		return null;
	}
}

// 🔴 只有主实例(首选端口)做影子镜像与对账:第二实例(阶梯口 38992+)是**独立数据集**
// (localStorage 按 origin=端口分区,R3 定谳互不相通),若也写同一 shadow/ 文件会把主实例
// 的影子覆盖成第二实例的数据 —— 恢复时数据混串。第二实例:不镜像、不对账。
function shadowEligible(){
	if(!isDesktopBridgeAvailable() && !electronShadowBridge()){
		return false;
	}
	try{
		return !isSecondaryInstancePort(window.location.port);
	}catch(_e){
		return false;
	}
}

// 与壳层 SHADOW_ALLOWED_KEYS 白名单一致(壳侧还会再验一遍,双保险)。
export const SHADOW_MIRROR_KEYS = [
	'horosa.localCharts.v1',
	'horosa.localCases.v1',
	'horosa.localCharts.trash.v1',
	'horosa.localCases.trash.v1',
];

let lastMirrorError = null;
let lastReconcile = null;

// 写镜像:fire-and-forget(失败静默记录状态供健康页;主存已成功,镜像失败不阻断业务)。
export function mirrorShadowWrite(key, text){
	if(SHADOW_MIRROR_KEYS.indexOf(key) < 0){
		return;
	}
	if(!shadowEligible()){
		return;
	}
	if(typeof text !== 'string'){
		return;
	}
	const eb = electronShadowBridge();
	(eb ? eb.shadowStoreWrite(key, text) : invokeDesktopCommand('shadow_store_write_command', { key, text }))
		.then(()=>{ lastMirrorError = null; })
		.catch((e)=>{ lastMirrorError = `${(e && e.message) || e}`; });
}

// 启动对账:主存缺失而影子在 → 写回主存;返回 {restored:[key...], diverged:[key...]}。
// diverged=两边都在但字节不同(主存优先,不动;仅记录供健康页)。
export async function reconcileShadowOnBoot(){
	const result = { restored: [], diverged: [], checked: false };
	if(!shadowEligible()){
		lastReconcile = result;
		return result;
	}
	let mirror = null;
	try{
		const eb = electronShadowBridge();
		mirror = eb ? await eb.shadowStoreReadAll() : await invokeDesktopCommand('shadow_store_read_all_command', {});
	}catch(e){
		lastMirrorError = `${(e && e.message) || e}`;
		lastReconcile = result;
		return result;
	}
	result.checked = true;
	if(!mirror || typeof mirror !== 'object'){
		lastReconcile = result;
		return result;
	}
	SHADOW_MIRROR_KEYS.forEach((key)=>{
		const shadowText = mirror[key];
		if(typeof shadowText !== 'string' || !shadowText){
			return;
		}
		const localText = safeLocalStorageGet(key);
		if(localText === null || localText === undefined || localText === ''){
			if(safeLocalStorageSet(key, shadowText)){
				result.restored.push(key);
			}
			return;
		}
		if(localText !== shadowText){
			result.diverged.push(key);
		}
	});
	lastReconcile = result;
	return result;
}

// 健康页状态出口。
export function getShadowMirrorStatus(){
	return {
		enabled: shadowEligible(),
		keys: SHADOW_MIRROR_KEYS.slice(),
		lastMirrorError,
		lastReconcile,
	};
}
