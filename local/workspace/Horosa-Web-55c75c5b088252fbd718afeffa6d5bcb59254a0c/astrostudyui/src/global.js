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
    // 近 1 容差:老壳 f64 累加写下的脏值(实锤 1.0000000000000002)按 1 对待(新壳已 snap,此为存量兜底)。
    if(__hsz && Math.abs(__hsz - 1) < 0.001){ __hsz = 1; }
    if(__hsz && __hsz > 0 && __hsz !== 1){
        document.documentElement.style.zoom = String(__hsz);
        // [Tahoe 根修·加固] 补偿=实测探针决策(与壳 __HOROSA_APPLY_SHELL_ZOOM 同构,jest
        // shellZoomProbeGuard 对偶锁看守):标准化 zoom 引擎(Tahoe)布局空间已自动=物理/z,
        // 再写 calc(100%/z)=过度补偿(内容恒缩 1/z^2);旧语义引擎才需要。判据=清掉补偿后
        // body 是否已铺满 fixed 探针的布局空间,未铺满才补——不认引擎只认实测。
        // 首拍在 CSS 未加载/布局未 settle 时不可信 → rAF/load 两拍重测;窗口 resize 150ms
        // 去抖重跑(z 现场读 documentElement,⌘± 换档后重跑不吃旧闭包值);未补偿态重跑=零写入。
        var __applyBodyComp = function (beat) {
            var __b = document.body;
            if (!__b) { return; }
            var __z = Number(document.documentElement.style.zoom || 1) || 1;
            if (Math.abs(__z - 1) < 0.001) { return; }
            var __t = 0;
            var __need = false;
            try {
                if (__b.style.width !== '' || __b.style.height !== '') { __b.style.width = ''; __b.style.height = ''; }
                var __p = document.createElement('div');
                __p.setAttribute('aria-hidden', 'true');
                __p.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;visibility:hidden;pointer-events:none';
                __b.appendChild(__p);
                __t = __p.offsetWidth;
                __b.removeChild(__p);
                __need = __t > 0 && Math.abs(__b.clientWidth - __t) > 2;
            } catch (__e2) { __need = true; }
            if (__need) {
                __b.style.height = 'calc(100% / ' + __z + ')';
                __b.style.width = 'calc(100% / ' + __z + ')';
            }
            try { window.__HOROSA_ZOOM_PROBE_LAST = { z: __z, target: __t, bodyW: __b.clientWidth, need: __need, beat: beat, ts: Date.now() }; } catch (__e3) { /* noop */ }
        };
        var __armZoomReprobe = function () {
            if (window.__HOROSA_ZOOM_REPROBE_ARMED) { return; }
            try { if (localStorage.getItem('horosa.compat.zoomReprobe') === '0') { return; } } catch (__e4) { /* noop */ }
            window.__HOROSA_ZOOM_REPROBE_ARMED = 1;
            if (typeof requestAnimationFrame === 'function') { requestAnimationFrame(function () { __applyBodyComp('raf'); }); }
            window.addEventListener('load', function () { __applyBodyComp('load'); }, { once: true });
            var __rt = null;
            window.addEventListener('resize', function () {
                if (__rt) { clearTimeout(__rt); }
                __rt = setTimeout(function () { __rt = null; __applyBodyComp('resize'); }, 150);
            });
        };
        __applyBodyComp('first');
        if(!document.body){ document.addEventListener('DOMContentLoaded', function(){ __applyBodyComp('dom'); }); }
        __armZoomReprobe();
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
