// 兼容层必须最先执行(第三方产物可能裸调新 API)——一切其他 import 都排它后面。
import './utils/legacyWebkitCompat'
// 🔴 壳级缩放自恢复(双源:URL query shellZoom 优先——壳导航确定性送达正确 origin/document;
// localStorage 键兜底——页面自刷新时 origin 内有效。浏览器/dev 两源皆无=恒 1 零影响)。
// 含 body 的 fixed 包含块补偿;壳的 __HOROSA_APPLY_SHELL_ZOOM(init script)后到幂等覆盖。
import { safeLocalStorageSet as __hszSet } from './utils/safeStorage';
try{
	var __hszQ = /[?&]shellZoom=([0-9.]+)/.exec(window.location.search || '');
	var __hsz = __hszQ ? Number(__hszQ[1]) : Number(localStorage.getItem('horosa.shell.zoom'));
	if(__hszQ && __hsz && __hsz > 0){ __hszSet('horosa.shell.zoom', String(__hsz)); }
	if(__hsz && __hsz > 0 && __hsz !== 1){
		document.documentElement.style.zoom = String(__hsz);
		var __applyBodyComp = function(){
			if(document.body){
				document.body.style.height = 'calc(100% / ' + __hsz + ')';
				document.body.style.width = 'calc(100% / ' + __hsz + ')';
			}
		};
		__applyBodyComp();
		if(!document.body){ document.addEventListener('DOMContentLoaded', __applyBodyComp); }
	}
}catch(e){ /* storage 不可用时保持 1:1 */ }

// 🔴 [Tahoe 浮层根治] 缩放域钩子:被打过补丁的 dom-align 在**每次对齐时**读
// window.__HOROSA_ALIGN_SCALE__(实测有效缩放)校正 rect→CSS 的换算。必须在首个浮层
// 打开前装好;钩子缺席时补丁内部回落 1 = 与未打补丁完全一致。默认档(zoom=1)下
// getEffectiveScale() 直接返回 1,不建探针 DOM、不触发 reflow。
import { installAlignHooks as __installAlignHooks } from './utils/zoomDomain';
__installAlignHooks();

// [V5-A2] 持久存储保险:persisted origin 免受 WebKit 磁盘压力 LRU 驱逐(非 persisted 的
// origin 在系统磁盘紧张时可能被整体清掉 —— 本地记录库的隐性丢失面之一)。授予与否由
// 引擎启发式决定,失败无害;granted 状态落 device-local 键供存储健康页显示。
try{
	if(navigator.storage && typeof navigator.storage.persist === 'function'){
		navigator.storage.persist().then(function(granted){
			__hszSet('horosa.storage.persisted', granted ? '1' : '0');
		}).catch(function(){ /* 引擎不支持/拒绝:健康页显示未知即可 */ });
	}
}catch(e){ /* 非浏览器环境零影响 */ }

let _globalObj = {}
