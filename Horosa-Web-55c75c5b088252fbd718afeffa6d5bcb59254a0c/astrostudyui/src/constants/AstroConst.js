import * as AstColor0 from './AstroColor0';
import * as AstColor1 from './AstroColor1';
import * as AstColor2 from './AstroColor2';
import * as AstColor3 from './AstroColor3';
import * as AstColor4 from './AstroColor4';
import * as AstColor5 from './AstroColor5';
import * as AstColor6 from './AstroColor6';
import * as AstColor7 from './AstroColor7';
import * as AstColor8 from './AstroColor8';

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
export const NORTH_NODE = 'North Node'
export const SOUTH_NODE = 'South Node'
export const SYZYGY = 'Syzygy'
export const PARS_FORTUNA = 'Pars Fortuna'
export const NO_PLANET = 'None'
export const DARKMOON = 'Dark Moon'
export const PURPLE_CLOUDS = 'Purple Clouds'
export const PHOLUS = 'Pholus'
export const CERES = 'Ceres'
export const PALLAS = 'Pallas'
export const JUNO = 'Juno'
export const VESTA = 'Vesta'
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
    PARS_RADIX
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
    NORTH_NODE, SOUTH_NODE, DARKMOON, PURPLE_CLOUDS, PARS_FORTUNA,
    ASC, DESC, MC, IC
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

// 二十七宿
export const LOU = '娄'
export const WEI4 = '胃'
export const MAO = '昴'
export const BI = '毕'
export const ZI = '觜'
export const SHEN = '参'
export const JING = '井'
export const GUI = '鬼'
export const LIU = '柳'
export const XING = '星'
export const ZHANG = '张'
export const YI = '翼'
export const ZHEN = '轸'
export const JIAO = '角'
export const KANG = '亢'
export const DI = '氐'
export const FANG = '房'
export const XIN = '心'
export const WEI3 = '尾'
export const JI = '箕'
export const DOU = '斗'
export const NV = '女'
export const XU = '虚'
export const WEI1 = '危'
export const SHI = '室'
export const BIW = '壁'
export const KUI = '奎'

export const LIST_SU = [
    LOU, WEI4, MAO, BI, ZI, SHEN, JING, GUI, LIU, XING, ZHANG, YI, ZHEN, JIAO, KANG, DI, FANG, XIN,
    WEI3, JI, DOU, NV, XU, WEI1, SHI, BIW, KUI
]


export const TERM_SU27 = {

    Aries: [
        ['娄', 0, 13+20/60],
        ['胃', 13+20/60, 26 + 40/60],
        ['昴', 26 + 40/60, 30]
    ],

    Taurus: [
        ['昴', 0, 10],
        ['毕', 10, 23 + 20/60],
        ['觜', 23 + 20/60, 30]
    ],

    Gemini: [
        ['觜', 0, 6 + 40/60],
        ['参', 6 + 40/60, 20],
        ['井', 20, 30]
    ],

    Cancer: [
        ['井', 0, 3 + 20/60],
        ['鬼', 3 + 20/60, 16 + 40/60],
        ['柳', 16 + 40/60, 30]
    ],

    Leo: [
        ['星', 0, 13+20/60],
        ['张', 13+20/60, 26 + 40/60],
        ['翼', 26 + 40/60, 30]
    ],

    Virgo: [
        ['翼', 0, 10],
        ['轸', 10, 23 + 20/60],
        ['角', 23 + 20/60, 30]
    ],

    Libra: [
        ['角', 0, 6 + 40/60],
        ['亢', 6 + 40/60, 20],
        ['氐', 20, 30]
    ],

    Scorpio: [
        ['氐', 0, 3 + 20/60],
        ['房', 3 + 20/60, 16 + 40/60],
        ['心', 16 + 40/60, 30]
    ],

    Sagittarius: [
        ['尾', 0, 13+20/60],
        ['箕', 13+20/60, 26 + 40/60],
        ['斗', 26 + 40/60, 30]
    ],

    Capricorn: [
        ['斗', 0, 10],
        ['女', 10, 23 + 20/60],
        ['虚', 23 + 20/60, 30]
    ],

    Aquarius: [
        ['虚', 0, 6 + 40/60],
        ['危', 6 + 40/60, 20],
        ['室', 20, 30]
    ],

    Pisces: [
        ['室', 0, 3 + 20/60],
        ['壁', 3 + 20/60, 16 + 40/60],
        ['奎', 16 + 40/60, 30]
    ]

}

export const SU_HOUSE_SIZE = 30 * 4 / 9

export const SU27 = {
    '娄': {
        'sign': 'Aries',
        'signlon': 0,
        'lon': 0,
        'size': SU_HOUSE_SIZE,
        'category': '急速',
        'character': ['癖好收集，拈花惹草', '苑牧、聚集、聚众、狱']
    },
    '胃': {
        'sign': 'Aries',
        'signlon': 13+20/60,
        'lon': 13+20/60,
        'size': SU_HOUSE_SIZE,
        'category': '急速',
        'character': ['强硬驱策，意欲主宰', '五谷、仓廪、运输']
    },
    '昴': {
        'sign': 'Aries',
        'signlon': 26 + 40/60,
        'lon': 26 + 40/60,
        'size': SU_HOUSE_SIZE,
        'category': '刚柔',
        'character': ['小气胆怯、擅长辩论', '狱事、囚犯、白衣']
    },
    '毕': {
        'sign': 'Taurus',
        'signlon': 10,
        'lon': 40,
        'size': SU_HOUSE_SIZE,
        'category': '安重',
        'character': ['满腹理想，优柔寡断', '听察、谗言/良言、边兵']
    },
    '觜': {
        'sign': 'Taurus',
        'signlon': 23 + 20/60,
        'lon': 30 + 23 + 20/60,
        'size': SU_HOUSE_SIZE,
        'category': '和善',
        'character': ['巧言善辩，擅理好礼', '贼寇']
    },
    '参': {
        'sign': 'Gemini',
        'signlon': 6 + 40/60,
        'lon': 60 + 6 + 40/60,
        'size': SU_HOUSE_SIZE,
        'category': '毒害',
        'character': ['冒险改革、明亮花心', '度量衡']
    },
    '井': {
        'sign': 'Gemini',
        'signlon': 20,
        'lon': 80,
        'size': SU_HOUSE_SIZE,
        'category': '轻燥',
        'character': ['双面不定，柔和擅行', '水、池、渠']
    },
    '鬼': {
        'sign': 'Cancer',
        'signlon': 3 + 20/60,
        'lon': 90 + 3 + 20/60,
        'size': SU_HOUSE_SIZE,
        'category': '急速',
        'character': ['人情世故、沟通健谈', '尸、鬼']
    },
    '柳': {
        'sign': 'Cancer',
        'signlon': 16 + 40/60,
        'lon': 90 + 16 + 40/60,
        'size': SU_HOUSE_SIZE,
        'category': '毒害',
        'character': ['善恶分明，倔强激烈', '草木、木工、厨、食、味']
    },

    '星': {
        'sign': 'Leo',
        'signlon': 0,
        'lon': 120,
        'size': SU_HOUSE_SIZE,
        'category': '猛恶',
        'character': ['较真古怪，责任刻板', '衣裳']
    },
    '张': {
        'sign': 'Leo',
        'signlon': 13+20/60,
        'lon': 120 + 13+20/60,
        'size': SU_HOUSE_SIZE,
        'category': '猛恶',
        'character': ['傲慢讨好，擅势利用', '酒食、赏赐']
    },
    '翼': {
        'sign': 'Leo',
        'signlon': 26 + 40/60,
        'lon': 120 + 26 + 40/60,
        'size': SU_HOUSE_SIZE,
        'category': '安重',
        'character': ['计划持重、不喜纷争', '音律、礼乐']
    },
    '轸': {
        'sign': 'Virgo',
        'signlon': 10,
        'lon': 160,
        'size': SU_HOUSE_SIZE,
        'category': '急速',
        'character': ['思维敏迅，内敛善妒', '风、车骑']
    },
    '角': {
        'sign': 'Virgo',
        'signlon': 23 + 20/60,
        'lon': 150 + 23 + 20/60,
        'size': SU_HOUSE_SIZE,
        'category': '和善',
        'character': ['思纯情浮，阴弱聪策', '天门']
    },
    '亢': {
        'sign': 'Libra',
        'signlon': 6 + 40/60,
        'lon': 180 + 6 + 40/60,
        'size': SU_HOUSE_SIZE,
        'category': '轻燥',
        'character': ['骄傲虚荣，自尊反叛', '三公、丞相、布政、享祠']
    },
    '氐': {
        'sign': 'Libra',
        'signlon': 20,
        'lon': 200,
        'size': SU_HOUSE_SIZE,
        'category': '刚柔',
        'character': ['不拘好闲，爽直轻松', '行宫、后宫、疫病、徭役']
    },
    '房': {
        'sign': 'Scorpio',
        'signlon': 3 + 20/60,
        'lon': 210 + 3 + 20/60,
        'size': SU_HOUSE_SIZE,
        'category': '和善',
        'character': ['开朗任性、自我拒外', '天子明堂、车架']
    },
    '心': {
        'sign': 'Scorpio',
        'signlon': 16 + 40/60,
        'lon': 210 + 16 + 40/60,
        'size': SU_HOUSE_SIZE,
        'category': '毒害',
        'character': ['难以捉摸，擅弄心理', '中枢、天子、宰相']
    },
    '尾': {
        'sign': 'Sagittarius',
        'signlon': 0,
        'lon': 240,
        'size': SU_HOUSE_SIZE,
        'category': '毒害',
        'character': ['顽固报复，偏激好斗', '后宫、皇后、内室、边臣']
    },
    '箕': {
        'sign': 'Sagittarius',
        'signlon': 13+20/60,
        'lon': 240 + 13+20/60,
        'size': SU_HOUSE_SIZE,
        'category': '猛恶',
        'character': ['粗暴直爽、心急独行', '嫔妃、大风、蛮夷']
    },
    '斗': {
        'sign': 'Sagittarius',
        'signlon': 26 + 40/60,
        'lon': 240 + 26 + 40/60,
        'size': SU_HOUSE_SIZE,
        'category': '安重',
        'character': ['争强好胜，力趋人上', '兵、（天子）寿命']
    },
    '女': {
        'sign': 'Capricorn',
        'signlon': 10,
        'lon': 280,
        'size': SU_HOUSE_SIZE,
        'category': '轻燥',
        'character': ['擅技冷情，自私漠然', '嫁娶、女工、布帛']
    },
    '虚': {
        'sign': 'Capricorn',
        'signlon': 23 + 20/60,
        'lon': 270 + 23 + 20/60,
        'size': SU_HOUSE_SIZE,
        'category': '轻燥',
        'character': ['阴沉神秘，宗密祝祷', '庙堂、祭祀、坟冢']
    },
    '危': {
        'sign': 'Aquarius',
        'signlon': 6 + 40/60,
        'lon': 300 + 6 + 40/60,
        'size': SU_HOUSE_SIZE,
        'category': '轻燥',
        'character': ['多情飘忽，小聪大失', '市场、架构、盖屋、亦主坟祀']
    },
    '室': {
        'sign': 'Aquarius',
        'signlon': 20,
        'lon': 320,
        'size': SU_HOUSE_SIZE,
        'category': '猛恶',
        'character': ['刚猛无畏、野心机权', '军粮']
    },
    '壁': {
        'sign': 'Pisces',
        'signlon': 3 + 20/60,
        'lon': 330 + 3 + 20/60,
        'size': SU_HOUSE_SIZE,
        'category': '安重',
        'character': ['慎密悭涩，内向冷静', '文章、图书']
    },
    '奎': {
        'sign': 'Pisces',
        'signlon': 16 + 40/60,
        'lon': 330 + 16 + 40/60,
        'size': SU_HOUSE_SIZE,
        'category': '和善',
        'character': ['高傲洁癖、眼高挑剔', '军库、将军']
    },
}

export const SU_YI = {
    'id': '意',
    'count': 4
}

export const SU_SHI = {
    'id': '事',
    'count': 10
}

export const SU_KE = {
    'id': '克',
    'count': 13
}

export const SU_JU = {
    'id': '聚',
    'count': 16
}

export const SU_TONG = {
    'id': '同',
    'count': 4
}

export const LIST_SU_SIXHOUSE = [
    SU_YI, SU_SHI, SU_KE, SU_JU, SU_TONG
]


export const LIST_SU_RELATION = [
    '命', '荣', '衰', '安', '危', '成', '坏', '友', '亲',
    '业', '荣', '衰', '安', '危', '成', '坏', '友', '亲',
    '胎', '荣', '衰', '安', '危', '成', '坏', '友', '亲'
]

export const HouseSys = {
    '0': '整宫制',
    '1': 'Alcabitus',
    '2': 'Regiomontanus',
    '3': 'Placidus',
    '4': 'Koch',
    '5': 'Vehlow Equal',
    '6': 'Polich Page',
    '7': 'Sripati',
    '8': '天顶为10宫中点等宫制'
}

export const HSYS_Whole_Sign = 'Whole Sign';
export const HSYS_Alcabitus = 'Alcabitus';
export const HSYS_Regiomontanus = 'Regiomontanus';
export const HSYS_Placidus = 'Placidus';
export const HSYS_Koch = 'Koch';
export const HSYS_Vehlow_Equal = 'Vehlow Equal';
export const HSYS_PolichPage = 'Polich Page';
export const HSYS_Sripati = 'Sripati';

export const STAR_ALGENIB = 'Algenib'
export const STAR_ALPHERATZ = 'Alpheratz'
export const STAR_ZAUR = 'Zaur'
export const STAR_ALGOL = 'Algol'
export const STAR_ALCYONE = 'Alcyone'
export const STAR_PLEIADES = STAR_ALCYONE
export const STAR_ALDEBARAN = 'Aldebaran'
export const STAR_RIGEL = 'Rigel'
export const STAR_CAPELLA = 'Capella'
export const STAR_BETELGEUSE = 'Betelgeuse'
export const STAR_SIRIUS = 'Sirius'
export const STAR_CANOPUS = 'Canopus'
export const STAR_CASTOR = 'Castor'
export const STAR_POLLUX = 'Pollux'
export const STAR_PROCYON = 'Procyon'
export const STAR_ASELLUS_BOREALIS = 'Asellus Borealis'
export const STAR_ASELLUS_AUSTRALIS = 'Asellus Australis'
export const STAR_ALPHARD = 'Alphard'
export const STAR_REGULUS = 'Regulus'
export const STAR_DENEBOLA = 'Denebola'
export const STAR_ALGORAB = 'Algorab'
export const STAR_SPICA = 'Spica'
export const STAR_ARCTURUS = 'Arcturus'
export const STAR_ALPHECCA = 'Alphecca'
export const STAR_ZUBEN_ELGENUBI = 'Zuben Elgenubi'
export const STAR_ZUBEN_ELSCHEMALI = 'Zuben Eshamali'
export const STAR_UNUKALHAI = 'Unukalhai'
export const STAR_AGENA = 'Agena'
export const STAR_RIGEL_CENTAURUS = 'Rigel Kentaurus'
export const STAR_ANTARES = 'Antares'
export const STAR_LESATH = 'Lesath'
export const STAR_VEGA = 'Vega'
export const STAR_ALTAIR = 'Altair'
export const STAR_DENEB_ALGEDI = 'Deneb Algedi'
export const STAR_FOMALHAUT = 'Fomalhaut'
export const STAR_DENEB_ADIGE = 'Deneb'  // Alpha-Cygnus
export const STAR_ACHERNAR = 'Achernar'

export const CHART_PLANETS = 1;
export const CHART_ASP_LINES = 2;
export const CHART_SU27 = 4;
export const CHART_TRIP = 8;
export const CHART_PLANETCOLORWITHSIGN = 16;
export const CHART_HOUSEDEGREE = 32;
export const CHART_INFOINCIRCLE = 64;
export const CHART_ANGLELINE = 128;
export const CHART_TXTPLANETFORWARD = 256;
export const CHART_SIGNRULER = 512;
export const CHART_TERM = 1024;
export const CHART_OUTERDEG = 2048;
export const CHART_INNERDEG = 4096;
export const CHART_TXTPLANET = 8192;
export const CHART_THREEPLANETASP = 16384;
export const CHART_SU28_TEXT = 32768;
export const CHART_3D_SKYBALL_LATLINE = 65536;
export const CHART_3D_EARTH_LATLINE = 131072;
export const CHART_3D_EARTH_LONLINE = 262144;
export const CHART_3D_EARTH_RADIUS_SAMESKY = 524288;
export const CHART_3D_EARTH = 1048576;
export const CHART_3D_PLANET_SYM = 2097152;
export const CHART_OPTIONS = [
    CHART_PLANETS, 
    CHART_ASP_LINES, 
    CHART_SU27,
    CHART_TRIP,
    CHART_PLANETCOLORWITHSIGN,
    CHART_HOUSEDEGREE,
    CHART_INFOINCIRCLE,
    CHART_ANGLELINE,
    CHART_TXTPLANET,
    CHART_TXTPLANETFORWARD,
    CHART_SIGNRULER,
    CHART_TERM,
    CHART_OUTERDEG,
    CHART_INNERDEG,
    CHART_THREEPLANETASP,
    CHART_SU28_TEXT,
    CHART_3D_SKYBALL_LATLINE,
    CHART_3D_EARTH_LATLINE,
    CHART_3D_EARTH_LONLINE,
    CHART_3D_EARTH_RADIUS_SAMESKY,
    CHART_3D_EARTH,
    CHART_3D_PLANET_SYM
];
export const CHART_DEFAULTOPTS = [
    CHART_PLANETS, 
    CHART_ASP_LINES,
    CHART_PLANETCOLORWITHSIGN,
    CHART_HOUSEDEGREE,
    CHART_SIGNRULER,
    CHART_TERM,
    CHART_ANGLELINE,
    CHART_TXTPLANET,
    CHART_TXTPLANETFORWARD,
    CHART_OUTERDEG,
    CHART_INNERDEG
];

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
Astro3DColor['Mercury'] = '#FFFF00';
Astro3DColor['Venus'] = '#FFFF00';
Astro3DColor['Mars'] = '#FFFF00';
Astro3DColor['Jupiter'] = '#FFFF00';
Astro3DColor['Saturn'] = '#FFFF00';
Astro3DColor['Sun'] = '#FFFF00';
Astro3DColor['Moon'] = '#FFFF00';
Astro3DColor['Dark Moon'] = '#FFFF00';
Astro3DColor['Purple Clouds'] = '#FFFF00';
Astro3DColor['North Node'] = '#FFFF00';
Astro3DColor['South Node'] = '#FFFF00';
Astro3DColor['Uranus'] = '#FFFF00';
Astro3DColor['Neptune'] = '#FFFF00';
Astro3DColor['Chiron'] = '#FFFF00';
Astro3DColor['Syzygy'] = '#FFFF00';
Astro3DColor['Pluto'] = '#FFFF00';
Astro3DColor['Asc'] = '#FFFF00';
Astro3DColor['Desc'] = '#FFFF00';
Astro3DColor['MC'] = '#FFFF00';
Astro3DColor['IC'] = '#FFFF00';

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

