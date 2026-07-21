export const APPEARANCE_SYSTEM = 'system';
export const APPEARANCE_LIGHT = 'light';
export const APPEARANCE_DARK = 'dark';

import { safeLocalStorageSet } from './safeStorage';
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
    if(typeof document === 'undefined'){
        return;
    }
    const normalized = normalizeAppearanceMode(mode);
    const actual = resolved === APPEARANCE_DARK ? APPEARANCE_DARK : APPEARANCE_LIGHT;
    const root = document.documentElement;
    root.setAttribute('data-horosa-appearance-mode', normalized);
    root.setAttribute('data-horosa-appearance', actual);
    document.body.setAttribute('data-horosa-appearance', actual);
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
