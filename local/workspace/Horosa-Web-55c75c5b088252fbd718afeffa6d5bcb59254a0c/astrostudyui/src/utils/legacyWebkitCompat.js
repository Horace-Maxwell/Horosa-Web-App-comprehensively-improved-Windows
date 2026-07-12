import { safeLocalStorageSet } from './safeStorage';
// legacyWebkitCompat.js —— macOS 12.0-12.2(WKWebView = Safari 15.0-15.3)兼容层。
//
// 两部分,均「缺特性才激活」,现代引擎零行为差异、零开销:
// 1) ES2022 微填充:Array/String.prototype.at、Array.prototype.findLast/findLastIndex、
//    Object.hasOwn、window.requestIdleCallback/cancelIdleCallback、window.structuredClone。
//    第三方压缩产物可能裸调这些 API(不带 typeof 守卫),统一兜底。
// 2) CSS :has() 类回退:app.less 中的 :has 规则(主导航隐藏 tab)配了同义 class 选择器
//    (.horosa-main-tab-hidden-parent);本文件在不支持 :has 的引擎上用 rAF 批处理的
//    MutationObserver 维护该 class。app.less 侧带「legacyWebkitCompat」注记的规则与
//    此处成对——改任一侧须同步另一侧。
//
// kill-switch(与 perfFlags 同约定,默认开;控制台执行后刷新):
//   safeLocalStorageSet('horosa.compat.hasFallback', '0')  // 关闭 :has 类回退

function compatFlagEnabled(key){
    try{
        if(typeof window !== 'undefined' && window.localStorage){
            return window.localStorage.getItem(key) !== '0';
        }
    }catch(e){ /* 隐私模式等取不到 localStorage 时按默认开 */ }
    return true;
}

/* ── 1) ES2022 微填充 ────────────────────────────────────────────── */

export function atImpl(n){
    var len = this.length;
    var i = Math.trunc(Number(n));
    if(Number.isNaN(i)) i = 0;
    if(i < 0) i += len;
    if(i < 0 || i >= len) return undefined;
    return this[i];
}

export function findLastImpl(cb, thisArg){
    if(typeof cb !== 'function') throw new TypeError(String(cb) + ' is not a function');
    for(var i = this.length - 1; i >= 0; i -= 1){
        if(cb.call(thisArg, this[i], i, this)) return this[i];
    }
    return undefined;
}

export function findLastIndexImpl(cb, thisArg){
    if(typeof cb !== 'function') throw new TypeError(String(cb) + ' is not a function');
    for(var i = this.length - 1; i >= 0; i -= 1){
        if(cb.call(thisArg, this[i], i, this)) return i;
    }
    return -1;
}

function defineIfMissing(target, name, fn){
    try{
        if(typeof target[name] !== 'function'){
            // 必须 defineProperty(不可枚举):裸赋值会让 for...in 遍历数组时多出方法名
            Object.defineProperty(target, name, { value: fn, writable: true, configurable: true });
        }
    }catch(e){ /* 冻结/只读环境下放弃,不阻塞启动 */ }
}

export function installPolyfills(){
    defineIfMissing(Array.prototype, 'at', atImpl);
    defineIfMissing(String.prototype, 'at', atImpl);
    defineIfMissing(Array.prototype, 'findLast', findLastImpl);
    defineIfMissing(Array.prototype, 'findLastIndex', findLastIndexImpl);
    defineIfMissing(Object, 'hasOwn', function hasOwn(obj, key){
        return Object.prototype.hasOwnProperty.call(obj, key);
    });
    if(typeof window === 'undefined') return;
    if(typeof window.requestIdleCallback !== 'function'){
        window.requestIdleCallback = function(cb, opts){
            var start = Date.now();
            var hasTimeout = !!(opts && typeof opts.timeout === 'number');
            return window.setTimeout(function(){
                cb({
                    didTimeout: hasTimeout,
                    timeRemaining: function(){ return Math.max(0, 50 - (Date.now() - start)); },
                });
            }, 1);
        };
        window.cancelIdleCallback = function(id){ window.clearTimeout(id); };
    }
    if(typeof window.structuredClone !== 'function'){
        // JSON 兜底与产物内既有的守卫式降级同语义(Date/Map/循环引用不保真,但调用方均可承受)
        window.structuredClone = function(value){
            return value === undefined ? value : JSON.parse(JSON.stringify(value));
        };
    }
}

/* ── 2) CSS :has() 类回退 ───────────────────────────────────────── */

export function supportsHasSelector(){
    try{
        return typeof CSS !== 'undefined'
            && typeof CSS.supports === 'function'
            && CSS.supports('selector(:has(*))');
    }catch(e){
        return false;
    }
}

var TAB_SEL = '.horosa-workspace-shell .mainRootTabs.ant-tabs-left > .ant-tabs-nav .ant-tabs-tab';

// 一轮全量对账:回退 class 的加与撤都在这里,幂等(状态没变就不动 DOM,不触发观察风暴)
export function applyHasFallbackNow(){
    if(typeof document === 'undefined' || !document.body) return;
    var i;
    var tabs = document.querySelectorAll(TAB_SEL);
    for(i = 0; i < tabs.length; i += 1){
        var hidden = !!tabs[i].querySelector('.horosa-main-tab-hidden');
        if(tabs[i].classList.contains('horosa-main-tab-hidden-parent') !== hidden){
            tabs[i].classList.toggle('horosa-main-tab-hidden-parent', hidden);
        }
    }
}

export function installLegacyHasFallback(){
    if(typeof window === 'undefined' || typeof MutationObserver === 'undefined') return false;
    if(supportsHasSelector()) return false;
    if(!compatFlagEnabled('horosa.compat.hasFallback')) return false;
    var scheduled = false;
    var schedule = function(){
        if(scheduled) return;
        scheduled = true;
        var raf = window.requestAnimationFrame || function(f){ return window.setTimeout(f, 16); };
        raf(function(){
            scheduled = false;
            applyHasFallbackNow();
        });
    };
    var start = function(){
        new MutationObserver(schedule).observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class'],
        });
        applyHasFallbackNow();
    };
    if(document.body){
        start();
    }else{
        document.addEventListener('DOMContentLoaded', start);
    }
    return true;
}

installPolyfills();
installLegacyHasFallback();
