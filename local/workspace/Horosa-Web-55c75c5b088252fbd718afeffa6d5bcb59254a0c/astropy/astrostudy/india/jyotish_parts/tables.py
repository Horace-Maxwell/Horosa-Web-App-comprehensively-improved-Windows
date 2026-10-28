"""印占引擎常量表:七曜 / 各大运序列与年数 / 历法名表 / 庙旺 / 八分法吉位 / 时段表 / 自然大运与根本三方大运表(由 jyotish_engine.py 整段搬出,astrostudy.india.jyotish_engine 照旧可取这些名字)。"""
from flatlib import const


JYOTISH_PLANETS = [
    const.SUN, const.MOON, const.MARS, const.MERCURY, const.JUPITER,
    const.VENUS, const.SATURN, const.NORTH_NODE, const.SOUTH_NODE
]

DASHA_SEQUENCE = [
    {'key': 'Ketu', 'id': const.SOUTH_NODE, 'label': '计都', 'years': 7},
    {'key': 'Venus', 'id': const.VENUS, 'label': '金星', 'years': 20},
    {'key': 'Sun', 'id': const.SUN, 'label': '太阳', 'years': 6},
    {'key': 'Moon', 'id': const.MOON, 'label': '月亮', 'years': 10},
    {'key': 'Mars', 'id': const.MARS, 'label': '火星', 'years': 7},
    {'key': 'Rahu', 'id': const.NORTH_NODE, 'label': '罗睺', 'years': 18},
    {'key': 'Jupiter', 'id': const.JUPITER, 'label': '木星', 'years': 16},
    {'key': 'Saturn', 'id': const.SATURN, 'label': '土星', 'years': 19},
    {'key': 'Mercury', 'id': const.MERCURY, 'label': '水星', 'years': 17},
]

# ── Yogini 大运（36 年 / 8 女神，无计都）。权威:8 女神周期 1..8 年 = 36。 ──
# 顺序 Mangala→Pingala→Dhanya→Bhramari→Bhadrika→Ulka→Siddha→Sankata;起始女神由月宿定 (宿序+3) mod 8。
YOGINI_SEQUENCE = [
    {'key': 'Moon', 'id': const.MOON, 'label': '月亮', 'yogini': 'Mangala', 'years': 1},
    {'key': 'Sun', 'id': const.SUN, 'label': '太阳', 'yogini': 'Pingala', 'years': 2},
    {'key': 'Jupiter', 'id': const.JUPITER, 'label': '木星', 'yogini': 'Dhanya', 'years': 3},
    {'key': 'Mars', 'id': const.MARS, 'label': '火星', 'yogini': 'Bhramari', 'years': 4},
    {'key': 'Mercury', 'id': const.MERCURY, 'label': '水星', 'yogini': 'Bhadrika', 'years': 5},
    {'key': 'Saturn', 'id': const.SATURN, 'label': '土星', 'yogini': 'Ulka', 'years': 6},
    {'key': 'Venus', 'id': const.VENUS, 'label': '金星', 'yogini': 'Siddha', 'years': 7},
    {'key': 'Rahu', 'id': const.NORTH_NODE, 'label': '罗睺', 'yogini': 'Sankata', 'years': 8},
]
YOGINI_TOTAL = 36

# ── Ashtottari 大运（108 年 / 8 曜，无计都）。权威曜年:日6 月15 火8 水17 土10 木19 罗12 金21 = 108。 ──
# 大运推进序 日→月→火→水→土→木→罗→金。
ASHTOTTARI_SEQUENCE = [
    {'key': 'Sun', 'id': const.SUN, 'label': '太阳', 'years': 6},
    {'key': 'Moon', 'id': const.MOON, 'label': '月亮', 'years': 15},
    {'key': 'Mars', 'id': const.MARS, 'label': '火星', 'years': 8},
    {'key': 'Mercury', 'id': const.MERCURY, 'label': '水星', 'years': 17},
    {'key': 'Saturn', 'id': const.SATURN, 'label': '土星', 'years': 10},
    {'key': 'Jupiter', 'id': const.JUPITER, 'label': '木星', 'years': 19},
    {'key': 'Rahu', 'id': const.NORTH_NODE, 'label': '罗睺', 'years': 12},
    {'key': 'Venus', 'id': const.VENUS, 'label': '金星', 'years': 21},
]
ASHTOTTARI_TOTAL = 108

# Ashtottari 宿→曜映射(权威:权威宿→曜对照表)。
# 按 nakshatra index 1-27(Ashwini 起)排列;每曜领 3 或 4 宿,合 27;年合 6+15+8+17+10+19+12+21 = 108。
# 分组(权威对照表 顺序即 dasa 序):
#   Sun×4    Ardra Punarvasu Pushya Ashlesha           (idx 6-9)
#   Moon×3   Magha P.Phalguni U.Phalguni                (idx 10-12)
#   Mars×4   Hasta Chitra Swati Vishakha                (idx 13-16)
#   Mercury×3 Anuradha Jyeshtha Mula                    (idx 17-19)
#   Saturn×3 P.Ashadha U.Ashadha Shravana               (idx 20-22)
#   Jupiter×3 Dhanishta Shatabhisha P.Bhadra            (idx 23-25)
#   Rahu×4   U.Bhadra Revati Ashwini Bharani            (idx 26-27, 1-2 跨年初)
#   Venus×3  Krittika Rohini Mrigashira                 (idx 3-5)
# 数组按 nakshatra index 1-27 顺序展开(Ashwini=arr[0]):2 Rahu + 3 Venus + 4 Sun + 3 Moon + 4 Mars +
# 3 Mercury + 3 Saturn + 3 Jupiter + 2 Rahu = 27。
ASHTOTTARI_NAK_LORD = (
    ['Rahu'] * 2 +     # 1 Ashwini, 2 Bharani(Rahu 组跨年初尾)
    ['Venus'] * 3 +    # 3 Krittika, 4 Rohini, 5 Mrigashira
    ['Sun'] * 4 +      # 6 Ardra(Ardradi 起点), 7 Punarvasu, 8 Pushya, 9 Ashlesha
    ['Moon'] * 3 +     # 10 Magha, 11 P.Phalguni, 12 U.Phalguni
    ['Mars'] * 4 +     # 13 Hasta, 14 Chitra, 15 Swati, 16 Vishakha
    ['Mercury'] * 3 +  # 17 Anuradha, 18 Jyeshtha, 19 Mula
    ['Saturn'] * 3 +   # 20 P.Ashadha, 21 U.Ashadha, 22 Shravana
    ['Jupiter'] * 3 +  # 23 Dhanishta, 24 Shatabhisha, 25 P.Bhadra
    ['Rahu'] * 2       # 26 U.Bhadra, 27 Revati
)

# Ashtottari 每曜所辖宿弧(起经度, 弧长)，由 ASHTOTTARI_NAK_LORD 的连续宿范围算出(宿宽=360/27)。
# 起运余比 = 月在所属弧内的剩余比(非单宿)。Rahu 弧跨 0°(26,27,1,2)，用 mod 360 处理。
_ASHT_NAK_WIDTH = 360.0 / 27.0
_ASHT_ARC_DEF = {  # lord: (首宿 index 1-based, 宿数)
    'Sun': (6, 4), 'Moon': (10, 3), 'Mars': (13, 4), 'Mercury': (17, 3),
    'Saturn': (20, 3), 'Jupiter': (23, 3), 'Rahu': (26, 4), 'Venus': (3, 3),
}
ASHTOTTARI_ARC = {
    lord: ((first_nak - 1) * _ASHT_NAK_WIDTH, count * _ASHT_NAK_WIDTH)
    for lord, (first_nak, count) in _ASHT_ARC_DEF.items()
}

# Krittikadi 子型:同一主星块长序列(4-3 块循环),锚自 Ardra(宿6)移至 Krittika(宿3)——
# 即各主辖弧首宿整体 −3 宿(mod 27)。主星序/年数/总长 108 不变。
_ASHT_ARC_DEF_KRITTIKADI = {
    lord: (((first_nak - 3 - 1) % 27) + 1, count)
    for lord, (first_nak, count) in _ASHT_ARC_DEF.items()
}
ASHTOTTARI_ARC_KRITTIKADI = {
    lord: ((first_nak - 1) * _ASHT_NAK_WIDTH, count * _ASHT_NAK_WIDTH)
    for lord, (first_nak, count) in _ASHT_ARC_DEF_KRITTIKADI.items()
}


def _nak_lord_table_from_arcdef(arc_def):
    table = [None] * 27
    for lord, (first_nak, count) in arc_def.items():
        for k in range(count):
            table[((first_nak - 1) + k) % 27] = lord
    return table


ASHTOTTARI_NAK_LORD_KRITTIKADI = _nak_lord_table_from_arcdef(_ASHT_ARC_DEF_KRITTIKADI)


def ashtottari_arc_remaining(lord_key, moon_lon, arc_table=None):
    """月在所辖弧内的剩余比(0,1]。弧内已过 = (月经−弧起) mod360；剩余 = (弧长−已过)/弧长。"""
    start, length = (arc_table or ASHTOTTARI_ARC)[lord_key]
    elapsed = (float(moon_lon) - start) % 360.0
    if elapsed > length:  # 数值边界兜底(月理应落在弧内)
        elapsed = min(elapsed, length)
    return (length - elapsed) / length

# NAKSHATRAS 已迁至 astrostudy/nakshatra.py(共享),见顶部 import。

TITHI_NAMES = [
    'Pratipada', 'Dvitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi',
    'Saptami', 'Ashtami', 'Navami', 'Dashami', 'Ekadashi', 'Dwadashi',
    'Trayodashi', 'Chaturdashi', 'Purnima/Amavasya'
]


def tithi_name(tithi_day):
    """Tithi 名(1..30):第 15 日 Purnima(白分望)、第 30 日 Amavasya(黑分朔),其余按半月序。"""
    d = int(tithi_day)
    if d == 15:
        return 'Purnima'
    if d == 30:
        return 'Amavasya'
    return TITHI_NAMES[(d - 1) % 15]

YOGA_NAMES = [
    'Vishkambha', 'Priti', 'Ayushman', 'Saubhagya', 'Shobhana', 'Atiganda',
    'Sukarman', 'Dhriti', 'Shula', 'Ganda', 'Vriddhi', 'Dhruva', 'Vyaghata',
    'Harshana', 'Vajra', 'Siddhi', 'Vyatipata', 'Variyan', 'Parigha', 'Shiva',
    'Siddha', 'Sadhya', 'Shubha', 'Shukla', 'Brahma', 'Indra', 'Vaidhriti'
]

KARANA_SEQUENCE = [
    'Bava', 'Balava', 'Kaulava', 'Taitila', 'Gara', 'Vanija', 'Vishti'
]

VARA_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
VARA_CN = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

OWN_SIGNS = {
    const.SUN: [const.LEO],
    const.MOON: [const.CANCER],
    const.MARS: [const.ARIES, const.SCORPIO],
    const.MERCURY: [const.GEMINI, const.VIRGO],
    const.JUPITER: [const.SAGITTARIUS, const.PISCES],
    const.VENUS: [const.TAURUS, const.LIBRA],
    const.SATURN: [const.CAPRICORN, const.AQUARIUS],
    const.NORTH_NODE: [],
    const.SOUTH_NODE: [],
}

EXALTATION = {
    const.SUN: (const.ARIES, 10),
    const.MOON: (const.TAURUS, 3),
    const.MARS: (const.CAPRICORN, 28),
    const.MERCURY: (const.VIRGO, 15),
    const.JUPITER: (const.CANCER, 5),
    const.VENUS: (const.PISCES, 27),
    const.SATURN: (const.LIBRA, 20),
    const.NORTH_NODE: (const.TAURUS, 20),
    const.SOUTH_NODE: (const.SCORPIO, 20),
}

BENEFIC_HOUSES = {
    'Sun': {
        'Sun': [1, 2, 4, 7, 8, 9, 10, 11],
        'Moon': [3, 6, 10, 11],
        'Mars': [1, 2, 4, 7, 8, 9, 10, 11],
        'Mercury': [3, 5, 6, 9, 10, 11, 12],
        'Jupiter': [5, 6, 9, 11],
        'Venus': [6, 7, 12],
        'Saturn': [1, 2, 4, 7, 8, 9, 10, 11],
        'Lagna': [3, 4, 6, 10, 11, 12],
    },
    'Moon': {
        'Sun': [3, 6, 7, 8, 10, 11],
        'Moon': [1, 3, 6, 7, 10, 11],
        'Mars': [2, 3, 5, 6, 9, 10, 11],
        'Mercury': [1, 3, 4, 5, 7, 8, 10, 11],
        'Jupiter': [1, 4, 7, 8, 10, 11, 12],
        'Venus': [3, 4, 5, 7, 9, 10, 11],
        'Saturn': [3, 5, 6, 11],
        'Lagna': [3, 6, 10, 11],
    },
    'Mars': {
        'Sun': [3, 5, 6, 10, 11],
        'Moon': [3, 6, 11],
        'Mars': [1, 2, 4, 7, 8, 10, 11],
        'Mercury': [3, 5, 6, 11],
        'Jupiter': [6, 10, 11, 12],
        'Venus': [6, 8, 11, 12],
        'Saturn': [1, 4, 7, 8, 9, 10, 11],
        'Lagna': [1, 3, 6, 10, 11],
    },
    'Mercury': {
        'Sun': [5, 6, 9, 11, 12],
        'Moon': [2, 4, 6, 8, 10, 11],
        'Mars': [1, 2, 4, 7, 8, 9, 10, 11],
        'Mercury': [1, 3, 5, 6, 9, 10, 11, 12],
        'Jupiter': [6, 8, 11, 12],
        'Venus': [1, 2, 3, 4, 5, 8, 9, 11],
        'Saturn': [1, 2, 4, 7, 8, 9, 10, 11],
        'Lagna': [1, 2, 4, 6, 8, 10, 11],
    },
    'Jupiter': {
        'Sun': [1, 2, 3, 4, 7, 8, 9, 10, 11],
        'Moon': [2, 5, 7, 9, 11],
        'Mars': [1, 2, 4, 7, 8, 10, 11],
        'Mercury': [1, 2, 4, 5, 6, 9, 10, 11],
        'Jupiter': [1, 2, 3, 4, 7, 8, 10, 11],
        'Venus': [2, 5, 6, 9, 10, 11],
        'Saturn': [3, 5, 6, 12],
        'Lagna': [1, 2, 4, 5, 6, 7, 9, 10, 11],
    },
    'Venus': {
        'Sun': [8, 11, 12],
        'Moon': [1, 2, 3, 4, 5, 8, 9, 11, 12],
        'Mars': [3, 5, 6, 9, 11, 12],
        'Mercury': [3, 5, 6, 9, 11],
        'Jupiter': [5, 8, 9, 10, 11],
        'Venus': [1, 2, 3, 4, 5, 8, 9, 10, 11],
        'Saturn': [3, 4, 5, 8, 9, 10, 11],
        'Lagna': [1, 2, 3, 4, 5, 8, 9, 11],
    },
    'Saturn': {
        'Sun': [1, 2, 4, 7, 8, 10, 11],
        'Moon': [3, 6, 11],
        'Mars': [3, 5, 6, 10, 11, 12],
        'Mercury': [6, 8, 9, 10, 11, 12],
        'Jupiter': [5, 6, 11, 12],
        'Venus': [6, 11, 12],
        'Saturn': [3, 5, 6, 11],
        'Lagna': [1, 3, 4, 6, 10, 11],
    },
}


# Kakshya(分区)过运:每座 30° 分 8 段(各 3°45′),自 0° 起主管次序固定。
KAKSHYA_LORDS = ['Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon', 'Lagna']
# Sodhya Pinda(削减后凝量):Rasi Gunakara(座乘,Ari..Pis)+ Graha Gunakara(曜乘,已核验)。
RASI_GUNAKARA = [7, 10, 8, 4, 10, 5, 7, 8, 9, 5, 11, 12]
GRAHA_GUNAKARA = {'Sun': 5, 'Moon': 5, 'Mars': 8, 'Mercury': 5,
                  'Jupiter': 10, 'Venus': 7, 'Saturn': 5}

# Choghadia(民用择时):7 类循环序(曜对应),昼/夜各 8 段。吉=Amrit/Shubh/Labh/Char、凶=Rog/Kaal/Udveg。
CHOGHADIA_CYCLE = [
    {'key': 'Udveg', 'cn': '扰', 'nature': 'bad', 'planet': 'Sun'},
    {'key': 'Char', 'cn': '动', 'nature': 'good', 'planet': 'Venus'},
    {'key': 'Labh', 'cn': '利', 'nature': 'good', 'planet': 'Mercury'},
    {'key': 'Amrit', 'cn': '甘露', 'nature': 'good', 'planet': 'Moon'},
    {'key': 'Kaal', 'cn': '时', 'nature': 'bad', 'planet': 'Saturn'},
    {'key': 'Shubh', 'cn': '吉', 'nature': 'good', 'planet': 'Jupiter'},
    {'key': 'Rog', 'cn': '病', 'nature': 'bad', 'planet': 'Mars'},
]
# 昼首段下标(weekday 0=周日:Udveg/周一 Amrit/周二 Rog/周三 Labh/周四 Shubh/周五 Char/周六 Kaal)。
CHOGHADIA_DAY_FIRST = [0, 3, 6, 2, 5, 1, 4]
# 推进步长(在 CHOGHADIA_CYCLE 里):昼段每段 +1;夜首段 = 昼首 +5,夜段每段 +5(即 −2)。
# 例 周日 昼:Udveg Char Labh Amrit Kaal Shubh Rog Udveg;夜:Shubh Amrit Char Rog Kaal Labh Udveg Shubh。
CHOGHADIA_DAY_STEP = 1
CHOGHADIA_NIGHT_OFFSET = 5
CHOGHADIA_NIGHT_STEP = 5


def choghadia_sequence(weekday):
    """Choghadia 单一排法(本命面板 / 择日条件共用):weekday 0=周日(吠陀日,日界=日出)。
    返回 (昼 8 段, 夜 8 段),每段为 CHOGHADIA_CYCLE 的条目。"""
    day_first = CHOGHADIA_DAY_FIRST[int(weekday) % 7]
    night_first = (day_first + CHOGHADIA_NIGHT_OFFSET) % 7
    day = [CHOGHADIA_CYCLE[(day_first + CHOGHADIA_DAY_STEP * i) % 7] for i in range(8)]
    night = [CHOGHADIA_CYCLE[(night_first + CHOGHADIA_NIGHT_STEP * i) % 7] for i in range(8)]
    return day, night

# Naisargika(自然/生命阶段)大运:7 曜固定自然年(总 120)。Varahamihira 成熟序(默认,年龄段通行):
# 月1→火2→水9→金20→木18→日20→土50。数值经 Varahamihira/Saravali 等多源核验;无节点。
NAISARGIKA_ORDER = [
    (const.MOON, '月', 1), (const.MARS, '火', 2), (const.MERCURY, '水', 9),
    (const.VENUS, '金', 20), (const.JUPITER, '木', 18), (const.SUN, '日', 20),
    (const.SATURN, '土', 50),
]

# Mūla(=Lagna Kendrādi Graha)大运:期长由曜数到其本三角座 + 庙旺±1 自 Vimśottarī 年减得。
MULA_MT_SIGN = {const.SUN: const.LEO, const.MOON: const.TAURUS, const.MARS: const.ARIES,
                const.MERCURY: const.VIRGO, const.JUPITER: const.SAGITTARIUS,
                const.VENUS: const.LIBRA, const.SATURN: const.AQUARIUS,
                const.NORTH_NODE: const.AQUARIUS, const.SOUTH_NODE: const.SCORPIO}
MULA_VIMS_YEARS = {const.SUN: 6, const.MOON: 10, const.MARS: 7, const.MERCURY: 17,
                   const.JUPITER: 16, const.VENUS: 20, const.SATURN: 19,
                   const.NORTH_NODE: 18, const.SOUTH_NODE: 7}
_ODD_FOOTED_SIGNS = {const.ARIES, const.TAURUS, const.GEMINI, const.LIBRA, const.SCORPIO, const.SAGITTARIUS}
