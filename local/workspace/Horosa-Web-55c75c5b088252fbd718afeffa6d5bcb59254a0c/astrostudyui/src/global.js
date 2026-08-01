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

let _globalObj = {}
