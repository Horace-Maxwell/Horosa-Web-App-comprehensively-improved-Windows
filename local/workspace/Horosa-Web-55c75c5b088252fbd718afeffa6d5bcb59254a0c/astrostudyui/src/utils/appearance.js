export const APPEARANCE_SYSTEM = 'system';
export const APPEARANCE_LIGHT = 'light';
export const APPEARANCE_DARK = 'dark';

import { safeLocalStorageSet } from './safeStorage';
import * as AstroConst from '../constants/AstroConst';

// ── 主题 → 盘面调色板(单源)──────────────────────────────────────────────────────
// 盘面(d3 / canvas)的颜色来自 AstroConst.AstroColor 这份**烘焙调色板**,不是 CSS 变量:切明暗时它必须先换到位,
// 再改 <html data-horosa-appearance>,最后广播 APPEARANCE_APPLIED_EVENT —— 每张盘(watchChartAppearance)收到广播才重画,
// 读到的一定是已切换的调色板。此前调色板由 layouts/app.js 与 pages/index.js 各自在 render 里切(晚一帧且可能互相覆写),
// 而多数盘根本不订阅主题 → 切主题后停在旧色(宿盘 / 七政 / 六壬 / 卦…用户实报)。「谁切调色板」只许这里一处,
// preflight [283] / jest chartThemeFollow.contract 锁:setColorTheme( 只在本文件出现。
export const APPEARANCE_APPLIED_EVENT = 'horosa:appearance-applied';
export const DARK_CHART_COLOR_THEME = 8;   // AstroConst.colorThemes[8] = 主题暗夜

export function chartColorThemeFor(resolved){
    return resolved === APPEARANCE_DARK ? DARK_CHART_COLOR_THEME : AstroConst.DefaultColorTheme;
}

// 同步把盘面调色板切到与外观一致(幂等;render 期 / effect 期都可调)
export function syncChartPalette(resolved){
    AstroConst.setColorTheme(chartColorThemeFor(resolved === APPEARANCE_DARK ? APPEARANCE_DARK : APPEARANCE_LIGHT));
    return AstroConst.AstroColor;
}

export function currentAppearance(){
    if(typeof document === 'undefined' || !document.documentElement){
        return APPEARANCE_LIGHT;
    }
    return document.documentElement.getAttribute('data-horosa-appearance') === APPEARANCE_DARK ? APPEARANCE_DARK : APPEARANCE_LIGHT;
}

// 盘面主题指纹:暗色 = 'dark';亮色带浅色配色档('light' = 古典宣纸 / 'light:classic' = 经典白)。
// 暗色下配色档被暗色变量块整块覆盖、看不出差别,不进指纹。读 CSS 变量烘焙颜色的盘(cssVar(...) 读成字面量画上去)
// 在配色档变化时也要重画 —— 订阅(subscribeAppearance)与绘制签名(chartDrawGuard.buildChartDrawSig)都按它比
export function currentChartThemeKey(){
    const a = currentAppearance();
    if(a === APPEARANCE_DARK){ return APPEARANCE_DARK; }
    return currentLightFlavor() === LIGHT_FLAVOR_CLASSIC ? `${APPEARANCE_LIGHT}:${LIGHT_FLAVOR_CLASSIC}` : APPEARANCE_LIGHT;
}

// 订阅「外观已应用」:先听广播(应用路径,调色板已就位),再兜底观察根属性(测试 / 别的窗口 / 直改属性);
// 明暗与浅色配色档(宣纸 / 经典白)两者任一变化都算 —— 同一帧内多信号合并成一次回调,且只在主题指纹
// (currentChartThemeKey)实际变化时回调,回调参数仍是明暗(light / dark)。回 detach。
export function subscribeAppearance(fn){
    if(typeof fn !== 'function' || typeof window === 'undefined' || typeof document === 'undefined'){
        return ()=>{};
    }
    let detached = false;
    let pending = false;
    let last = currentChartThemeKey();
    const schedule = (typeof requestAnimationFrame === 'function') ? requestAnimationFrame : (cb)=>setTimeout(cb, 16);
    const kick = ()=>{
        if(detached || pending){ return; }
        pending = true;
        schedule(()=>{
            pending = false;
            if(detached){ return; }
            const now = currentChartThemeKey();
            if(now === last){ return; }
            last = now;
            try{ fn(currentAppearance()); }catch(e){ /* 订阅方重画失败不上抛:下一次真实更新仍会画 */ }
        });
    };
    window.addEventListener(APPEARANCE_APPLIED_EVENT, kick);
    window.addEventListener(LIGHT_FLAVOR_APPLIED_EVENT, kick);
    let observer = null;
    if(typeof MutationObserver !== 'undefined' && document.documentElement){
        try{
            observer = new MutationObserver(kick);
            observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-horosa-appearance', 'data-horosa-light-flavor'] });
        }catch(e){ observer = null; }
    }
    return ()=>{
        detached = true;
        window.removeEventListener(APPEARANCE_APPLIED_EVENT, kick);
        window.removeEventListener(LIGHT_FLAVOR_APPLIED_EVENT, kick);
        if(observer){ try{ observer.disconnect(); }catch(e){ /* noop */ } observer = null; }
    };
}
export const APPEARANCE_MODES = [
    APPEARANCE_SYSTEM,
    APPEARANCE_LIGHT,
    APPEARANCE_DARK,
];

export function normalizeAppearanceMode(mode){
    if(APPEARANCE_MODES.indexOf(mode) >= 0){
        return mode;
    }
    return APPEARANCE_SYSTEM;
}

export function resolveAppearance(mode, prefersDark){
    const normalized = normalizeAppearanceMode(mode);
    if(normalized === APPEARANCE_DARK){
        return APPEARANCE_DARK;
    }
    if(normalized === APPEARANCE_LIGHT){
        return APPEARANCE_LIGHT;
    }
    return prefersDark ? APPEARANCE_DARK : APPEARANCE_LIGHT;
}

export function getNextAppearanceMode(mode){
    const normalized = normalizeAppearanceMode(mode);
    if(normalized === APPEARANCE_SYSTEM){
        return APPEARANCE_LIGHT;
    }
    if(normalized === APPEARANCE_LIGHT){
        return APPEARANCE_DARK;
    }
    return APPEARANCE_SYSTEM;
}

export function getAppearanceLabel(mode, resolved){
    const normalized = normalizeAppearanceMode(mode);
    if(normalized === APPEARANCE_SYSTEM){
        return resolved === APPEARANCE_DARK ? '跟随系统 · 夜' : '跟随系统 · 昼';
    }
    if(normalized === APPEARANCE_DARK){
        return '暗夜';
    }
    return '昼间';
}

export function applyAppearanceToDocument(mode, resolved){
    const normalized = normalizeAppearanceMode(mode);
    const actual = resolved === APPEARANCE_DARK ? APPEARANCE_DARK : APPEARANCE_LIGHT;
    // ① 调色板先到位(盘收到广播 / 观察到属性时读到的已是新调色板)
    syncChartPalette(actual);
    if(typeof document === 'undefined'){
        return;
    }
    // ② 根属性(CSS 变量层随之切换)
    const root = document.documentElement;
    root.setAttribute('data-horosa-appearance-mode', normalized);
    root.setAttribute('data-horosa-appearance', actual);
    if(document.body){ document.body.setAttribute('data-horosa-appearance', actual); }
    // ③ 广播:盘面重画订阅方(watchChartAppearance)在此之后合帧重画
    try{
        if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function'){
            window.dispatchEvent(new CustomEvent(APPEARANCE_APPLIED_EVENT, { detail: { appearance: actual, mode: normalized } }));
        }
    }catch(e){ /* noop */ }
}

// ── 亮色配色档(flavor):paper=古典宣纸(默认) / classic=经典白色(宣纸换血前原亮色) ──
// 纯显示层:CSS 变量覆盖块按 data-horosa-light-flavor 生效,切换即时、零 re-render 需求;
// localStorage 直存(不进 dva),暗色模式下属性保留但被暗色块覆盖=无感。
export const LIGHT_FLAVOR_PAPER = 'paper';
export const LIGHT_FLAVOR_CLASSIC = 'classic';
const LIGHT_FLAVOR_LS_KEY = 'horosa.ui.lightFlavor';

export function normalizeLightFlavor(flavor){
    return flavor === LIGHT_FLAVOR_CLASSIC ? LIGHT_FLAVOR_CLASSIC : LIGHT_FLAVOR_PAPER;
}

export function getStoredLightFlavor(){
    try{
        if(typeof window === 'undefined' || !window.localStorage){ return LIGHT_FLAVOR_PAPER; }
        return normalizeLightFlavor(window.localStorage.getItem(LIGHT_FLAVOR_LS_KEY));
    }catch(_){ return LIGHT_FLAVOR_PAPER; }
}

// 浅色风味应用到页面之后广播(页头按钮的提示文字据此跟上;别的窗口改了也走这里)
export const LIGHT_FLAVOR_APPLIED_EVENT = 'horosa:light-flavor-applied';

// 只改页面属性、不写存储(别的窗口改了设置时跟随用 —— 回写会与那个窗口互相触发)
export function applyLightFlavorAttribute(flavor){
    if(typeof document === 'undefined'){ return; }
    const f = normalizeLightFlavor(flavor);
    const root = document.documentElement;
    if(f === LIGHT_FLAVOR_CLASSIC){
        root.setAttribute('data-horosa-light-flavor', f);
    }else{
        root.removeAttribute('data-horosa-light-flavor'); // paper=默认块,无属性即宣纸
    }
    try{
        if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function'){
            window.dispatchEvent(new CustomEvent(LIGHT_FLAVOR_APPLIED_EVENT, { detail: { flavor: f } }));
        }
    }catch(e){ /* noop */ }
}

// 页面上现在实际是哪一档(以页面属性为准:存储写失败 / 全量恢复写进去还没刷新时,存储里的与眼前的不是同一档)
export function currentLightFlavor(){
    if(typeof document === 'undefined' || !document.documentElement){ return getStoredLightFlavor(); }
    return document.documentElement.getAttribute('data-horosa-light-flavor') === LIGHT_FLAVOR_CLASSIC ? LIGHT_FLAVOR_CLASSIC : LIGHT_FLAVOR_PAPER;
}

// 应用并记住。返回是否写进了存储(false = 存储写不进:本次照常生效,重启后回到原来那档 —— 调用方据此提示)
export function applyLightFlavorToDocument(flavor){
    if(typeof document === 'undefined'){ return false; }
    const f = normalizeLightFlavor(flavor);
    applyLightFlavorAttribute(f);
    // FL-4 配额纪律:写 localStorage 一律走 safeStorage(配额写满降级不炸)
    return safeLocalStorageSet(LIGHT_FLAVOR_LS_KEY, f) === true;
}

// 别的窗口(同一本机存储)改了浅色风味 / 清空了存储:本窗口跟着换,只应用、不回写。回 detach
export function bindLightFlavorStorageSync(){
    if(typeof window === 'undefined' || typeof window.addEventListener !== 'function'){ return ()=>{}; }
    const onStorage = (e)=>{
        if(!e){ return; }
        try{
            if(e.storageArea && typeof window.localStorage !== 'undefined' && e.storageArea !== window.localStorage){ return; }
        }catch(err){ return; }
        // key === null = 别的窗口 localStorage.clear():回到缺省那档
        if(e.key === LIGHT_FLAVOR_LS_KEY || e.key === null){
            applyLightFlavorAttribute(getStoredLightFlavor());
        }
    };
    window.addEventListener('storage', onStorage);
    return ()=>window.removeEventListener('storage', onStorage);
}

export function getLightFlavorLabel(flavor){
    return normalizeLightFlavor(flavor) === LIGHT_FLAVOR_CLASSIC ? '经典白色' : '古典宣纸';
}
