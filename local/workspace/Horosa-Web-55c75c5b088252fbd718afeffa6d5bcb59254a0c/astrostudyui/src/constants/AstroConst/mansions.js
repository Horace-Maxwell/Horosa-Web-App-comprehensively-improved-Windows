// 二十七宿(宿名、宿度表与宿间关系)
// 从 AstroConst.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。

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

export const LIST_SU_RELATION = [
    '命', '荣', '衰', '安', '危', '成', '坏', '友', '亲',
    '业', '荣', '衰', '安', '危', '成', '坏', '友', '亲',
    '胎', '荣', '衰', '安', '危', '成', '坏', '友', '亲'
]
