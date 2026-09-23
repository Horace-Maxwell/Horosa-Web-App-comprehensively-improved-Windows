export const APPEARANCE_SYSTEM = 'system';
export const APPEARANCE_LIGHT = 'light';
export const APPEARANCE_DARK = 'dark';

import { safeLocalStorageSet } from './safeStorage';
import * as AstroConst from '../constants/AstroConst';

// ── 主题 → 盘面调色板(单源;FL-20260922-1)──────────────────────────────────────────────────────
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

// 订阅「外观已应用」:先听广播(应用路径,调色板已就位),再兜底观察根属性(测试 / 别的窗口 / 直改属性);
// 同一帧内多信号合并成一次回调,且只在实际外观值变化时回调。回 detach。
export function subscribeAppearance(fn){
    if(typeof fn !== 'function' || typeof window === 'undefined' || typeof document === 'undefined'){
        return ()=>{};
    }
    let detached = false;
    let pending = false;
    let last = currentAppearance();
    const schedule = (typeof requestAnimationFrame === 'function') ? requestAnimationFrame : (cb)=>setTimeout(cb, 16);
    const kick = ()=>{
        if(detached || pending){ return; }
        pending = true;
        schedule(()=>{
            pending = false;
            if(detached){ return; }
            const now = currentAppearance();
            if(now === last){ return; }
            last = now;
            try{ fn(now); }catch(e){ /* 订阅方重画失败不上抛:下一次真实更新仍会画 */ }
        });
    };
    window.addEventListener(APPEARANCE_APPLIED_EVENT, kick);
    let observer = null;
    if(typeof MutationObserver !== 'undefined' && document.documentElement){
        try{
            observer = new MutationObserver(kick);
            observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-horosa-appearance'] });
        }catch(e){ observer = null; }
    }
    return ()=>{
        detached = true;
        window.removeEventListener(APPEARANCE_APPLIED_EVENT, kick);
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

export function applyLightFlavorToDocument(flavor){
    if(typeof document === 'undefined'){ return; }
    const f = normalizeLightFlavor(flavor);
    const root = document.documentElement;
    if(f === LIGHT_FLAVOR_CLASSIC){
        root.setAttribute('data-horosa-light-flavor', f);
    }else{
        root.removeAttribute('data-horosa-light-flavor'); // paper=默认块,无属性即宣纸
    }
    // FL-4 配额纪律:写 localStorage 一律走 safeStorage(配额写满降级不炸)
    safeLocalStorageSet(LIGHT_FLAVOR_LS_KEY, f);
}

export function getLightFlavorLabel(flavor){
    return normalizeLightFlavor(flavor) === LIGHT_FLAVOR_CLASSIC ? '经典白色' : '古典宣纸';
}
