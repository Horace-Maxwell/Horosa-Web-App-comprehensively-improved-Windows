

# 二十七宿
LOU = '娄'
WEI4 = '胃'
MAO = '昴'
BI = '毕'
ZI = '觜'
SHEN = '参'
JING = '井'
GUI = '鬼'
LIU = '柳'
XING = '星'
ZHANG = '张'
YI = '翼'
ZHEN = '轸'
JIAO = '角'
KANG = '亢'
DI = '氐'
FANG = '房'
XIN = '心'
WEI3 = '尾'
JI = '箕'
DOU = '斗'
NV = '女'
XU = '虚'
WEI1 = '危'
SHI = '室'
BIW = '壁'
KUI = '奎'

LIST_SU = [
    LOU, WEI4, MAO, BI, ZI, SHEN, JING, GUI, LIU, XING, ZHANG, YI, ZHEN, JIAO, KANG, DI, FANG, XIN,
    WEI3, JI, DOU, NV, XU, WEI1, SHI, BIW, KUI
]


TERM_SU27 = {

    'Aries': [
        ['娄', 0, 13+20/60],
        ['胃', 13+20/60, 26 + 40/60],
        ['昴', 26 + 40/60, 30]
    ],

    'Taurus': [
        ['昴', 0, 10],
        ['毕', 10, 23 + 20/60],
        ['觜', 23 + 20/60, 30]
    ],

    'Gemini': [
        ['觜', 0, 6 + 40/60],
        ['参', 6 + 40/60, 20],
        ['井', 20, 30]
    ],

    'Cancer': [
        ['井', 0, 3 + 20/60],
        ['鬼', 3 + 20/60, 16 + 40/60],
        ['柳', 16 + 40/60, 30]
    ],

    'Leo': [
        ['星', 0, 13+20/60],
        ['张', 13+20/60, 26 + 40/60],
        ['翼', 26 + 40/60, 30]
    ],

    'Virgo': [
        ['翼', 0, 10],
        ['轸', 10, 23 + 20/60],
        ['角', 23 + 20/60, 30]
    ],

    'Libra': [
        ['角', 0, 6 + 40/60],
        ['亢', 6 + 40/60, 20],
        ['氐', 20, 30]
    ],

    'Scorpio': [
        ['氐', 0, 3 + 20/60],
        ['房', 3 + 20/60, 16 + 40/60],
        ['心', 16 + 40/60, 30]
    ],

    'Sagittarius': [
        ['尾', 0, 13+20/60],
        ['箕', 13+20/60, 26 + 40/60],
        ['斗', 26 + 40/60, 30]
    ],

    'Capricorn': [
        ['斗', 0, 10],
        ['女', 10, 23 + 20/60],
        ['虚', 23 + 20/60, 30]
    ],

    'Aquarius': [
        ['虚', 0, 6 + 40/60],
        ['危', 6 + 40/60, 20],
        ['室', 20, 30]
    ],

    'Pisces': [
        ['室', 0, 3 + 20/60],
        ['壁', 3 + 20/60, 16 + 40/60],
        ['奎', 16 + 40/60, 30]
    ]

}

AnZong = '安重'
HeShan = '和善'
DuHai = '毒害'
JiSu = '急速'
MengE = '猛恶'
QingZao = '轻燥'
GangRou = '刚柔'

LIST_SU_CAT = [
    AnZong, HeShan, DuHai, JiSu, MengE, QingZao, GangRou
]

SU_CATEGORY = {
    '安重': {
        'su': ['毕', '翼', '斗', '壁'],
        'duty': '宜修殿宇园林、贮纳仓库、结交朋友婚姻、造家具、设学供养入道场及安稳、随师长入坛受灌顶法、造久长之事。唯不宜远行索债、无保进路造酒、剃头剪甲博戏',
        'birth': '法合安重威肃正福德、有大名闻。'
    },

    '和善': {
        'su': ['觜', '角', '房', '奎'],
        'duty': '宜入道场问学技艺、真言结斋戒、立道场受灌顶、造功德设音乐、及吉祥事喜庆、求婚举放、对君王参将相、冠带出行、服药合和。',
        'birth': '法合柔软温良。聪明而爱典教。'
    },

    '毒害': {
        'su': ['参', '柳', '心', '尾'],
        'duty': '宜围城破营、设兵掠贼、交阵破敌、劫盗攎蒱射猎。',
        'birth': '法合碜毒刚猛恶性。'
    },

    '急速': {
        'su': ['鬼', '轸', '胃', '娄'],
        'duty': '宜放债贷钱、买卖交关、进路出行、调六畜乘习鹰鹞、设斋行道入学受业、服药入道场受灌顶市买。',
        'birth': '法合刚猛而捷疾有筋力。'
    },

    '猛恶': {
        'su': ['星', '张', '箕', '室'],
        'duty': '宜守路设险劫掠相攻、攎蒱博戏造兵器谋断决囚徒、放药行酪射猎、祭天祀神承兵威并吉。',
        'birth': '法合凶害猛杀。宜舍身出家作沙门。'
    },

    '轻燥': {
        'su': ['井', '亢', '女', '虚', '危'],
        'duty': '宜学乘象马骄射驰走、浮江泛舟、奉使绝域和国入蕃、又劝行礼乐兰阅兵马、种莳造酒合和药。',
        'birth': '法合浇薄不然则质直平稳。'
    },

    '刚柔': {
        'su': ['昴', '氐'],
        'duty': '宜锻炼炉治修五行家具、及造瓦买卖之事、又宜设斋送葬钻、炼酥乳计算畜生入宅王者作盟会。',
        'birth': '法合为性、宽柔而猛、君子之人流也。'
    },

}

SU_HOUSE_SIZE = 30 * 4 / 9

SU27 = {
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


LIST_SU_RELATION = [
    '命', '荣', '衰', '安', '危', '成', '坏', '友', '亲',
    '业', '荣', '衰', '安', '危', '成', '坏', '友', '亲',
    '胎', '荣', '衰', '安', '危', '成', '坏', '友', '亲'
]

SU_YI = {
    'id': '意',
    'count': 4
}

SU_SHI = {
    'id': '事',
    'count': 10
}

SU_KE = {
    'id': '克',
    'count': 13
}

SU_JU = {
    'id': '聚',
    'count': 16
}

SU_TONG = {
    'id': '同',
    'count': 20
}


LIST_SU_SIXHOUSE = [
    SU_YI, SU_SHI, SU_KE, SU_JU, SU_TONG
]

def copySu(suid):
    su = SU27[suid]
    return {
        'id': suid,
        'sign': su['sign'],
        'signlon': su['signlon'],
        'lon': su['lon'],
        'size': su['size'],
        'category': su['category'],
        'character': su['character'].copy()
    }

def copySu27():
    res = {}
    for suid in LIST_SU:
        su = copySu(suid)
        su['planets'] = []
        res[suid] = su
    return res