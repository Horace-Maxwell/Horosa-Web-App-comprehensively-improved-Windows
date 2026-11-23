// 星体 / 虚点 / 星座 / 希腊点的标识与属性,宫 / 星体 / 点 / 相位的清单与缺省集
// 从 AstroConst.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。

export const AstroChartFont = 'ywastrochart';
export const AstroFont = 'ywastro';
export const NormalFont = 'Helvetica Light';

export const SUN = 'Sun'
export const MOON = 'Moon'
export const MERCURY = 'Mercury'
export const VENUS = 'Venus'
export const MARS = 'Mars'
export const JUPITER = 'Jupiter'
export const SATURN = 'Saturn'
export const URANUS = 'Uranus'
export const NEPTUNE = 'Neptune'
export const PLUTO = 'Pluto'
export const CHIRON = 'Chiron'
// 汉堡学派（Uranian）8 颗虚星 TNP —— 仅经汉堡 dial 读取 /germany/midpoint 的 tnp 字段进入显示，绝不进 DEFAULT_OBJECTS
export const CUPIDO = 'Cupido'
export const HADES = 'Hades'
export const ZEUS = 'Zeus'
export const KRONOS = 'Kronos'
export const APOLLON = 'Apollon'
export const ADMETOS = 'Admetos'
export const VULCANUS = 'Vulcanus'
export const POSEIDON = 'Poseidon'
export const LIST_URANIAN = [CUPIDO, HADES, ZEUS, KRONOS, APOLLON, ADMETOS, VULCANUS, POSEIDON]
// 白羊点 / 世界轴（World Axis）——恒为黄经 0°，汉堡学派与 AS/MC 同级的个人点；90°盘上 0/90/180/270 等价。
export const ARIES_POINT = 'AriesPoint'
export const NORTH_NODE = 'North Node'
export const SOUTH_NODE = 'South Node'
export const SYZYGY = 'Syzygy'
export const PARS_FORTUNA = 'Pars Fortuna'
export const VERTEX = 'Vertex'
export const ANTIVERTEX = 'Antivertex'  // 卯酉圈与黄道的东交点(宿命点对点);主限法世俗盘轴应星
export const EAST_POINT = 'EastPoint'  // 赤道上升(子午局 1 宫头);量化盘可选点,读后端 houseFrames.eastPoint
export const DARKMOON = 'Dark Moon'
export const PURPLE_CLOUDS = 'Purple Clouds'
export const PHOLUS = 'Pholus'
export const CERES = 'Ceres'
export const PALLAS = 'Pallas'
export const JUNO = 'Juno'
export const VESTA = 'Vesta'
export const ERIS = 'Eris'
export const INTP_APOG = 'Intp_Apog'
export const INTP_PERG = 'Intp_Perg'
export const MOONSUN = 'MoonSun'
export const SATURNMARS = 'SaturnMars'
export const JUPITERVENUS = 'JupiterVenus'
export const LIFEMASTERDEG74 = 'LifeMasterDeg74';

export const THREE_PLANETS = new Set();
THREE_PLANETS.add(URANUS);
THREE_PLANETS.add(NEPTUNE);
THREE_PLANETS.add(PLUTO);
THREE_PLANETS.add(CHIRON);

export const ARIES = 'Aries'
export const TAURUS = 'Taurus'
export const GEMINI = 'Gemini'
export const CANCER = 'Cancer'
export const LEO = 'Leo'
export const VIRGO = 'Virgo'
export const LIBRA = 'Libra'
export const SCORPIO = 'Scorpio'
export const SAGITTARIUS = 'Sagittarius'
export const CAPRICORN = 'Capricorn'
export const AQUARIUS = 'Aquarius'
export const PISCES = 'Pisces'

export const ASC = 'Asc'
export const DESC = 'Desc'
export const MC = 'MC'
export const IC = 'IC'

export const SIDEREAL = 'Sidereal'
export const TROPICAL = 'Tropical'
export const ZODIACAL = {
    '0': TROPICAL,
    '1': SIDEREAL
}

export const MOON_FIRST_QUARTER = 'First Quarter'
export const MOON_SECOND_QUARTER = 'Second Quarter'
export const MOON_THIRD_QUARTER = 'Third Quarter'
export const MOON_LAST_QUARTER = 'Last Quarter'

export const PARS_SPIRIT = 'Pars Spirit'
export const PARS_FAITH = 'Pars Faith'
export const PARS_SUBSTANCE = 'Pars Substance'
export const PARS_WEDDING_MALE = 'Pars Wedding [Male]'
export const PARS_WEDDING_FEMALE = 'Pars Wedding [Female]'
export const PARS_SONS = 'Pars Sons'
export const PARS_FATHER = 'Pars Father'
export const PARS_MOTHER = 'Pars Mother'
export const PARS_BROTHERS = 'Pars Brothers'
export const PARS_DISEASES = 'Pars Diseases'
export const PARS_DEATH = 'Pars Death'
export const PARS_TRAVEL = 'Pars Travel'
export const PARS_FRIENDS = 'Pars Friends'
export const PARS_ENEMIES = 'Pars Enemies'
export const PARS_SATURN = 'Pars Saturn'
export const PARS_JUPITER = 'Pars Jupiter'
export const PARS_MARS = 'Pars Mars'
export const PARS_VENUS = 'Pars Venus'
export const PARS_MERCURY = 'Pars Mercury'
export const PARS_HORSEMANSHIP = 'Pars Horsemanship'
export const PARS_LIFE = 'Pars Life'
export const PARS_RADIX = 'Pars Radix'
export const PARS_EROS = 'Pars Eros'
export const PARS_NECESSITY = 'Pars Necessity'
export const PARS_COURAGE = 'Pars Courage'
export const PARS_VICTORY = 'Pars Victory'
export const PARS_NEMESIS = 'Pars Nemesis'
// 希腊化补全六点。🔴 前两个 ID 逐字对齐显赫指标「四显赫点」既有硬编码,勿改字符串。
export const PARS_BASIS = 'Pars Basis'
export const PARS_EXALTATION = 'Pars Exaltation'
export const PARS_SONS_VALENS = 'Pars Sons Valens'
export const PARS_DAUGHTERS = 'Pars Daughters'
export const PARS_PRAXIS = 'Pars Praxis'
export const PARS_WEDDING_DOROTHEAN = 'Pars Wedding Dorothean'

export const LOTS = [
    PARS_SPIRIT,
    PARS_MERCURY,
    PARS_VENUS,
    PARS_MARS,
    PARS_JUPITER,
    PARS_SATURN,
    PARS_FAITH,
    PARS_SUBSTANCE,
    PARS_WEDDING_FEMALE,
    PARS_WEDDING_MALE,
    PARS_SONS,
    PARS_MOTHER,
    PARS_FATHER,
    PARS_BROTHERS,
    PARS_FRIENDS,
    PARS_ENEMIES,
    PARS_DISEASES,
    PARS_DEATH,
    PARS_TRAVEL,
    PARS_HORSEMANSHIP,
    PARS_LIFE,
    PARS_RADIX,
    PARS_EROS,
    PARS_NECESSITY,
    PARS_COURAGE,
    PARS_VICTORY,
    PARS_NEMESIS,
    PARS_BASIS,
    PARS_EXALTATION,
    PARS_SONS_VALENS,
    PARS_DAUGHTERS,
    PARS_PRAXIS,
    PARS_WEDDING_DOROTHEAN
]

export const LIST_SIGNS = [
    ARIES, TAURUS, GEMINI, CANCER, LEO, VIRGO, LIBRA,
    SCORPIO, SAGITTARIUS, CAPRICORN, AQUARIUS, PISCES
]

export const SignsProp = {
    Aries:{
        Ruler: MARS,
        Exalt: SUN,
        Exile: VENUS,
        Fall: SATURN,
        Trip: [SUN, JUPITER, SATURN],
        FallDeg: 21,
        ExaltDeg: 19,
    },
    Taurus:{
        Ruler: VENUS,
        Exalt: MOON,
        Exile: MARS,
        Fall: null,
        Trip: [VENUS, MOON, MARS],
        FallDeg: null,
        ExaltDeg: 3,
    },
    Gemini:{
        Ruler: MERCURY,
        Exalt: null,
        Exile: JUPITER,
        Fall: null,
        Trip: [SATURN, MERCURY, JUPITER],
        FallDeg: 28,
        ExaltDeg: 15,
    },
    Cancer:{
        Ruler: MOON,
        Exalt: JUPITER,
        Exile: SATURN,
        Fall: MARS,
        Trip: [VENUS, MARS, MOON],
    },
    Leo:{
        Ruler: SUN,
        Exalt: null,
        Exile: SATURN,
        Fall: null,
        Trip: [SUN, JUPITER, SATURN],
        FallDeg: null,
        ExaltDeg: null,
    },
    Virgo:{
        Ruler: MERCURY,
        Exalt: MERCURY,
        Exile: JUPITER,
        Fall: VENUS,
        Trip: [VENUS, MOON, MARS],
        FallDeg: 27,
        ExaltDeg: 15,
    },
    Libra:{
        Ruler: VENUS,
        Exalt: SATURN,
        Exile: MARS,
        Fall: SUN,
        Trip: [SATURN, MERCURY, JUPITER],
        FallDeg: 19,
        ExaltDeg: 21,
    },
    Scorpio:{
        Ruler: MARS,
        Exalt: null,
        Exile: VENUS,
        Fall: MOON,
        Trip: [VENUS, MARS, MOON],
        FallDeg: 3,
        ExaltDeg: null,
    },
    Sagittarius:{
        Ruler: JUPITER,
        Exalt: null,
        Exile: MERCURY,
        Fall: null,
        Trip: [SUN, JUPITER, SATURN],
        FallDeg: null,
        ExaltDeg: null,
    },
    Capricorn:{
        Ruler: SATURN,
        Exalt: MARS,
        Exile: MOON,
        Fall: JUPITER,
        Trip: [VENUS, MOON, MARS],
        FallDeg: 15,
        ExaltDeg: 28,
    },
    Aquarius:{
        Ruler: SATURN,
        Exalt: null,
        Exile: SUN,
        Fall: null,
        Trip: [SATURN, MERCURY, JUPITER],
        FallDeg: null,
        ExaltDeg: null,
    },
    Pisces:{
        Ruler: JUPITER,
        Exalt: VENUS,
        Exile: MERCURY,
        Fall: MERCURY,
        Trip: [VENUS, MARS, MOON],
        FallDeg: 15,
        ExaltDeg: 27,
    },
};

export const HOUSE1 = 'House1'
export const HOUSE2 = 'House2'
export const HOUSE3 = 'House3'
export const HOUSE4 = 'House4'
export const HOUSE5 = 'House5'
export const HOUSE6 = 'House6'
export const HOUSE7 = 'House7'
export const HOUSE8 = 'House8'
export const HOUSE9 = 'House9'
export const HOUSE10 = 'House10'
export const HOUSE11 = 'House11'
export const HOUSE12 = 'House12'

export const LIST_HOUSES = [
    HOUSE1, HOUSE2, HOUSE3, HOUSE4, HOUSE5, HOUSE6,
    HOUSE7, HOUSE8, HOUSE9, HOUSE10, HOUSE11, HOUSE12,
]

export const LIST_OBJECTS = [
    SUN, MOON, MERCURY, VENUS, MARS, JUPITER, SATURN, 
    URANUS, NEPTUNE, PLUTO, NORTH_NODE,
    SOUTH_NODE, DARKMOON, PURPLE_CLOUDS, SYZYGY, PARS_FORTUNA,
    INTP_APOG, INTP_PERG,
    CHIRON, PHOLUS, CERES, PALLAS, JUNO, VESTA,
    LIFEMASTERDEG74,
]

export const DEFAULT_OBJECTS = [
    SUN, MOON, MERCURY, VENUS, MARS, JUPITER, SATURN, 
    NORTH_NODE, SOUTH_NODE, PARS_FORTUNA,
    ASC, MC
]

export const TRADITION_OBJECTS = [
    SUN, MOON, MERCURY, VENUS, MARS, JUPITER, SATURN, 
    NORTH_NODE, SOUTH_NODE, DARKMOON, PURPLE_CLOUDS, 
    ASC, DESC, MC, IC
]

let TraditionPlanets = new Set();

export function isTraditionPlanet(id){
    if(TraditionPlanets.size === 0){
        for(let i=0; i<TRADITION_OBJECTS.length; i++){
            TraditionPlanets.add(TRADITION_OBJECTS[i]);
        }
    }
    return TraditionPlanets.has(id);
}

export const DEFAULT_LOTS = [
    
]

export const LIST_POINTS = [
    SUN, MOON, MERCURY, VENUS, MARS, JUPITER, SATURN, 
    URANUS, NEPTUNE, PLUTO, NORTH_NODE,
    SOUTH_NODE, DARKMOON, PURPLE_CLOUDS, SYZYGY, PARS_FORTUNA,
    ASC, DESC, MC, IC,
    CHIRON, PHOLUS, CERES, PALLAS, JUNO, VESTA,
    INTP_APOG, INTP_PERG,
    MOONSUN, SATURNMARS, JUPITERVENUS,
    LIFEMASTERDEG74,
    CUPIDO, HADES, ZEUS, KRONOS, APOLLON, ADMETOS, VULCANUS, POSEIDON,
]

export const LIST_SMALL_PLANETS = [
    PHOLUS, CERES, PALLAS, JUNO, VESTA, INTP_APOG, INTP_PERG
]

export const AspKey = 'aspects';
export const ASP0 = 'Asp0';
export const ASP60 = 'Asp60';
export const ASP90 = 'Asp90';
export const ASP120 = 'Asp120';
export const ASP180 = 'Asp180';
export const ASP45 = 'Asp45';
export const LIST_ASP = [
    ASP0, ASP60, ASP90, ASP120, ASP180, ASP45
]

export const DEFAULT_ASPECTS = [
    ASP0, ASP60, ASP90, ASP120, ASP180
]
