// 三套界主表(埃及 / 托勒密校勘本 / 莉莉传本)与按变体取表
// 从 AstroConst.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。

export const EGYPTIAN_TERMS = {
    
    Aries: [
        ['Jupiter', 0, 6],
        ['Venus', 6, 12],
        ['Mercury', 12, 20],
        ['Mars', 20, 25],
        ['Saturn', 25, 30]
    ],

    Taurus: [
        ['Venus', 0, 8],
        ['Mercury', 8, 14],
        ['Jupiter', 14, 22],
        ['Saturn', 22, 27],
        ['Mars', 27, 30]
    ],
    
    Gemini: [
        ['Mercury', 0, 6],
        ['Jupiter', 6, 12],
        ['Venus', 12, 17],
        ['Mars', 17, 24],
        ['Saturn', 24, 30]
    ],

    Cancer: [
        ['Mars', 0, 7],
        ['Venus', 7, 13],
        ['Mercury', 13, 19],
        ['Jupiter', 19, 26],
        ['Saturn', 26, 30]
    ],

    Leo: [
        ['Jupiter', 0, 6],
        ['Venus', 6, 11],
        ['Saturn', 11, 18],
        ['Mercury', 18, 24],
        ['Mars', 24, 30]
    ],

    Virgo: [
        ['Mercury', 0, 7],
        ['Venus', 7, 17],
        ['Jupiter', 17, 21],
        ['Mars', 21, 28],
        ['Saturn', 28, 30]
    ],

    Libra: [
        ['Saturn', 0, 6],
        ['Mercury', 6, 14],
        ['Jupiter', 14, 21],
        ['Venus', 21, 28],
        ['Mars', 28, 30]
    ],

    Scorpio: [
        ['Mars', 0, 7],
        ['Venus', 7, 11],
        ['Mercury', 11, 19],
        ['Jupiter', 19, 24],
        ['Saturn', 24, 30]
    ],

    Sagittarius: [
        ['Jupiter', 0, 12],
        ['Venus', 12, 17],
        ['Mercury', 17, 21],
        ['Saturn', 21, 26],
        ['Mars', 26, 30]
    ],

    Capricorn: [
        ['Mercury', 0, 7],
        ['Jupiter', 7, 14],
        ['Venus', 14, 22],
        ['Saturn', 22, 26],
        ['Mars', 26, 30]
    ],

    Aquarius: [
        ['Mercury', 0, 7],
        ['Venus', 7, 13],
        ['Jupiter', 13, 20],
        ['Mars', 20, 25],
        ['Saturn', 25, 30]
    ],

    Pisces: [
        ['Venus', 0, 12],
        ['Jupiter', 12, 16],
        ['Mercury', 16, 19],
        ['Mars', 19, 28],
        ['Saturn', 28, 30]
    ]
}

// 界系另两套表,与 EGYPTIAN_TERMS 同结构;由界主表程序生成。盘内「界限环」按所选界系取表。
// 【变体正名 2026-07-23,内容零改动】TETRABIBLOS_TERMS=托勒密界·校勘本(批判本传承:双子7/13/20/26、
// 天秤 ☿11–16/♃16–24、狮子木先水次、金牛♄22–24、摩羯♄19–25);LILLY_TERMS=托勒密界·经典传本
// (1647 印本传承:双子♄21–25/♂25–30、天秤♃11–19/☿19–24、双鱼♂20–25/♄25–30)。
// 两表已与后端 flatlib 同名表逐格互锁(divination/data/__tests__/termsTablesDoc.test.js),
// 并经 Tetrabiblos I.20–21 原典终校——历史上曾疑「天秤/双鱼/射手」三处为错,终校结论均为正确口径,勿改。
export const TETRABIBLOS_TERMS = {

    Aries: [
        ['Jupiter', 0, 6],
        ['Venus', 6, 14],
        ['Mercury', 14, 21],
        ['Mars', 21, 26],
        ['Saturn', 26, 30]
    ],

    Taurus: [
        ['Venus', 0, 8],
        ['Mercury', 8, 15],
        ['Jupiter', 15, 22],
        ['Saturn', 22, 24],
        ['Mars', 24, 30]
    ],

    Gemini: [
        ['Mercury', 0, 7],
        ['Jupiter', 7, 13],
        ['Venus', 13, 20],
        ['Mars', 20, 26],
        ['Saturn', 26, 30]
    ],

    Cancer: [
        ['Mars', 0, 6],
        ['Jupiter', 6, 13],
        ['Mercury', 13, 20],
        ['Venus', 20, 27],
        ['Saturn', 27, 30]
    ],

    Leo: [
        ['Jupiter', 0, 6],
        ['Mercury', 6, 13],
        ['Saturn', 13, 19],
        ['Venus', 19, 25],
        ['Mars', 25, 30]
    ],

    Virgo: [
        ['Mercury', 0, 7],
        ['Venus', 7, 13],
        ['Jupiter', 13, 18],
        ['Saturn', 18, 24],
        ['Mars', 24, 30]
    ],

    Libra: [
        ['Saturn', 0, 6],
        ['Venus', 6, 11],
        ['Mercury', 11, 16],
        ['Jupiter', 16, 24],
        ['Mars', 24, 30]
    ],

    Scorpio: [
        ['Mars', 0, 6],
        ['Venus', 6, 13],
        ['Jupiter', 13, 21],
        ['Mercury', 21, 27],
        ['Saturn', 27, 30]
    ],

    Sagittarius: [
        ['Jupiter', 0, 8],
        ['Venus', 8, 14],
        ['Mercury', 14, 19],
        ['Saturn', 19, 25],
        ['Mars', 25, 30]
    ],

    Capricorn: [
        ['Venus', 0, 6],
        ['Mercury', 6, 12],
        ['Jupiter', 12, 19],
        ['Saturn', 19, 25],
        ['Mars', 25, 30]
    ],

    Aquarius: [
        ['Saturn', 0, 6],
        ['Mercury', 6, 12],
        ['Venus', 12, 20],
        ['Jupiter', 20, 25],
        ['Mars', 25, 30]
    ],

    Pisces: [
        ['Venus', 0, 8],
        ['Jupiter', 8, 14],
        ['Mercury', 14, 20],
        ['Mars', 20, 25],
        ['Saturn', 25, 30]
    ],

};

export const LILLY_TERMS = {

    Aries: [
        ['Jupiter', 0, 6],
        ['Venus', 6, 14],
        ['Mercury', 14, 21],
        ['Mars', 21, 26],
        ['Saturn', 26, 30]
    ],

    Taurus: [
        ['Venus', 0, 8],
        ['Mercury', 8, 15],
        ['Jupiter', 15, 22],
        ['Saturn', 22, 26],
        ['Mars', 26, 30]
    ],

    Gemini: [
        ['Mercury', 0, 7],
        ['Jupiter', 7, 14],
        ['Venus', 14, 21],
        ['Saturn', 21, 25],
        ['Mars', 25, 30]
    ],

    Cancer: [
        ['Mars', 0, 6],
        ['Jupiter', 6, 13],
        ['Mercury', 13, 20],
        ['Venus', 20, 27],
        ['Saturn', 27, 30]
    ],

    Leo: [
        ['Saturn', 0, 6],
        ['Mercury', 6, 13],
        ['Venus', 13, 19],
        ['Jupiter', 19, 25],
        ['Mars', 25, 30]
    ],

    Virgo: [
        ['Mercury', 0, 7],
        ['Venus', 7, 13],
        ['Jupiter', 13, 18],
        ['Saturn', 18, 24],
        ['Mars', 24, 30]
    ],

    Libra: [
        ['Saturn', 0, 6],
        ['Venus', 6, 11],
        ['Jupiter', 11, 19],
        ['Mercury', 19, 24],
        ['Mars', 24, 30]
    ],

    Scorpio: [
        ['Mars', 0, 6],
        ['Jupiter', 6, 14],
        ['Venus', 14, 21],
        ['Mercury', 21, 27],
        ['Saturn', 27, 30]
    ],

    Sagittarius: [
        ['Jupiter', 0, 8],
        ['Venus', 8, 14],
        ['Mercury', 14, 19],
        ['Saturn', 19, 25],
        ['Mars', 25, 30]
    ],

    Capricorn: [
        ['Venus', 0, 6],
        ['Mercury', 6, 12],
        ['Jupiter', 12, 19],
        ['Mars', 19, 25],
        ['Saturn', 25, 30]
    ],

    Aquarius: [
        ['Saturn', 0, 6],
        ['Mercury', 6, 12],
        ['Venus', 12, 20],
        ['Jupiter', 20, 25],
        ['Mars', 25, 30]
    ],

    Pisces: [
        ['Venus', 0, 8],
        ['Jupiter', 8, 14],
        ['Mercury', 14, 20],
        ['Mars', 20, 25],
        ['Saturn', 25, 30]
    ],

};

// termsVariant 0 埃及(默认)/1 托勒密/2 莉莉 → 对应界主表(供星盘「界限环」按所选界绘制)。
export const TERMS_TABLES_BY_VARIANT = [EGYPTIAN_TERMS, TETRABIBLOS_TERMS, LILLY_TERMS];
