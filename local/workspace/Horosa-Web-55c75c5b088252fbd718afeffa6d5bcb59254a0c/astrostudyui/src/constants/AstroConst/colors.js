// 星盘配色主题(含切换)与三维盘配色
// 从 AstroConst.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import * as AstColor0 from '../AstroColor0';
import * as AstColor1 from '../AstroColor1';
import * as AstColor2 from '../AstroColor2';
import * as AstColor3 from '../AstroColor3';
import * as AstColor4 from '../AstroColor4';
import * as AstColor5 from '../AstroColor5';
import * as AstColor6 from '../AstroColor6';
import * as AstColor7 from '../AstroColor7';
import * as AstColor8 from '../AstroColor8';

const colorSelector = {
    '0': AstColor0.AstroColor,
    '1': AstColor1.AstroColor,
    '2': AstColor2.AstroColor,
    '3': AstColor3.AstroColor,
    '4': AstColor4.AstroColor,
    '5': AstColor5.AstroColor,
    '6': AstColor6.AstroColor,
    '7': AstColor7.AstroColor,
    '8': AstColor8.AstroColor,
}

export const colorThemes = [
    '主题古老', '主题煜熠', '主题和睿', '主题暖阳', '主题莫兰', '主题咖啡',
    '主题银河', '主题伽蓝', '主题暗夜'
];

export const DefaultColorTheme = 0;

export let AstroColor = AstColor0.AstroColor;

export function normalizeColorThemeIndex(val){
    if(val === undefined || val === null){
        return DefaultColorTheme;
    }

    const num = Number(val);
    if(Number.isInteger(num) && colorSelector[num + '']){
        return num;
    }

    if(typeof val === 'string'){
        const byName = colorThemes.indexOf(val);
        if(byName >= 0 && colorSelector[byName + '']){
            return byName;
        }
    }

    return DefaultColorTheme;
}

export function setColorTheme(idx){
    const norm = normalizeColorThemeIndex(idx);
    AstroColor = colorSelector[norm + ''] || AstColor0.AstroColor;
}

export const Astro3DColor = {
    Backgroud: 0x000000,
    ChartBackgroud: 0x000000,
	PlanetStroke: '#FFFF00',
	TextStroke: 0xffffff,
	Fill: '#00FF00',
    NoColor: 'transparent',
    SkyLine: 0xff0000,
    EarthLine: 0x0000ff,
    EarthFill: 0x00ffff,
    AxesColor: 0x00ffff,
};
// 行星真色(与 2D 主盘语义一致化;此前全员 #FFFF00 同色不可辨=体检「中」项):
// 日金/月银白/水灰蓝/金暖白/火赤/木橙/土土黄/天青/海蓝/冥暗紫;交点紫灰、四轴亮金。
Astro3DColor['Mercury'] = '#9db4d8';
Astro3DColor['Venus'] = '#f2e6c9';
Astro3DColor['Mars'] = '#e05a4e';
Astro3DColor['Jupiter'] = '#e8a04c';
Astro3DColor['Saturn'] = '#c9b178';
Astro3DColor['Sun'] = '#ffd24d';
Astro3DColor['Moon'] = '#e8ecf2';
Astro3DColor['Dark Moon'] = '#b08bc9';
Astro3DColor['Purple Clouds'] = '#b08bc9';
Astro3DColor['North Node'] = '#a99ac6';
Astro3DColor['South Node'] = '#8d80a8';
Astro3DColor['Uranus'] = '#6fd6d0';
Astro3DColor['Neptune'] = '#5f8fe0';
Astro3DColor['Chiron'] = '#c9a2d8';
Astro3DColor['Syzygy'] = '#d0d6de';
Astro3DColor['Pluto'] = '#9a6fb0';
Astro3DColor['Asc'] = '#ffd700';
Astro3DColor['Desc'] = '#ffd700';
Astro3DColor['MC'] = '#ffd700';
Astro3DColor['IC'] = '#ffd700';

Astro3DColor['Aries'] = '#FFFF00';
Astro3DColor['Taurus'] = '#948e33';
Astro3DColor['Gemini'] = '#7b5cbc';
Astro3DColor['Cancer'] = '#0b0e66';
Astro3DColor['Leo'] = '#FFFF00';
Astro3DColor['Virgo'] = '#948e33';
Astro3DColor['Libra'] = '#7b5cbc';
Astro3DColor['Scorpio'] = '#0b0e66';
Astro3DColor['Sagittarius'] = '#FFFF00';
Astro3DColor['Capricorn'] = '#948e33';
Astro3DColor['Aquarius'] = '#7b5cbc';
Astro3DColor['Pisces'] = '#0b0e66';

Astro3DColor['Asp0'] = '#FFFF00';
Astro3DColor['Asp60'] = '#FFFF00';
Astro3DColor['Asp90'] = '#FFFF00';
Astro3DColor['Asp120'] = '#FFFF00';
Astro3DColor['Asp180'] = '#FFFF00';
