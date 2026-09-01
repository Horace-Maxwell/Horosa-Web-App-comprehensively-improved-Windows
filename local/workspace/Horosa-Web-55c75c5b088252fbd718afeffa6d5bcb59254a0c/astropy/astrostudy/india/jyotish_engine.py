import math
from datetime import datetime, timedelta

from flatlib import const
from flatlib.datetime import Datetime
from flatlib.ephem import eph

from astrostudy.india.yoga_engine import build_yogas
from astrostudy.india.primitives import chara_karakas, KARAKA_PLANETS
from astrostudy.nakshatra import NAKSHATRAS, nakshatra_from_lon


SIGN_CN = {
    const.ARIES: '白羊',
    const.TAURUS: '金牛',
    const.GEMINI: '双子',
    const.CANCER: '巨蟹',
    const.LEO: '狮子',
    const.VIRGO: '处女',
    const.LIBRA: '天秤',
    const.SCORPIO: '天蝎',
    const.SAGITTARIUS: '射手',
    const.CAPRICORN: '摩羯',
    const.AQUARIUS: '水瓶',
    const.PISCES: '双鱼',
}

PLANET_CN = {
    const.SUN: '太阳',
    const.MOON: '月亮',
    const.MARS: '火星',
    const.MERCURY: '水星',
    const.JUPITER: '木星',
    const.VENUS: '金星',
    const.SATURN: '土星',
    const.NORTH_NODE: '罗睺',
    const.SOUTH_NODE: '计都',
}

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

MOOLATRIKONA = {
    const.SUN: (const.LEO, 0, 20),
    const.MOON: (const.TAURUS, 4, 30),
    const.MARS: (const.ARIES, 0, 12),
    const.MERCURY: (const.VIRGO, 16, 20),
    const.JUPITER: (const.SAGITTARIUS, 0, 10),
    const.VENUS: (const.LIBRA, 0, 15),
    const.SATURN: (const.AQUARIUS, 0, 20),
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


def norm(deg):
    return deg % 360


def sign_index_from_lon(lon):
    return int(norm(lon) / 30) % 12


def sign_from_lon(lon):
    return const.LIST_SIGNS[sign_index_from_lon(lon)]


# nakshatra_from_lon 已迁至 astrostudy/nakshatra.py(共享),见顶部 import。


def house_number(obj):
    house = getattr(obj, 'house', None)
    if isinstance(house, str) and house.startswith('House'):
        try:
            return int(house[5:])
        except Exception:
            return None
    return None


def safe_get(chart, obj_id):
    try:
        return chart.get(obj_id)
    except Exception:
        return None


def get_local_birth_datetime(perchart):
    try:
        year = int(perchart.year)
        if year <= 0:
            return None
        parts = [int(x) for x in perchart.time.split(':')]
        while len(parts) < 3:
            parts.append(0)
        return datetime(year, int(perchart.month), int(perchart.day), parts[0], parts[1], parts[2])
    except Exception:
        return None


def format_dt(value):
    if value is None:
        return None
    return value.strftime('%Y-%m-%d')


def dasha_lord(key):
    for item in DASHA_SEQUENCE:
        if item['key'] == key:
            return item
    return DASHA_SEQUENCE[0]


class JyotishEngine:
    # 四个 nakshatra 树形大运体系(maha→antar→pratyantar 三级树)。UI 一次只显示选中一个,
    # 故仅「选中体系」算完整三级(与历史字节一致),其余只算 maha 顶层(省 antar/pratyantar)→
    # 响应 dasha 体积大降。前端切体系会重取(带新 dashaSystem)。
    _DASHA_TREE_SYSTEMS = ('vimshottari', 'yogini', 'ashtottari', 'tribhagi')

    # 年长五档白名单(古法权威口径):儒略(默认)/格里/Savana/回归/恒星。
    _DASHA_YEAR_CHOICES = (365.25, 365.2425, 360.0, 365.2422, 365.2563)
    # 类级默认:兜住 __new__ 直构(仓内 pytest 直构即如此)与任何绕过 __init__ 的路径。
    dasha_year_days = 365.25
    varga_variant_map = {}
    karaka_scheme = '8'
    yuddha_criterion = 'latitude'
    # 流派开关全默认(类级兜底同 __new__ 直构):见 dasha_variants.VARIANT_SPECS。
    from astrostudy.india.dasha_variants import DEFAULT_VARIANTS as _DV_DEFAULTS
    dasha_variants = dict(_DV_DEFAULTS)

    def __init__(self, perchart, chartnum=1, d1_perchart=None, dasha_seed=None, sthira_start=None, dasha_system=None,
                 dasha_year_days=None, varga_variants=None, karaka_scheme=None, yuddha_criterion=None,
                 dasha_variants=None):
        self.perchart = perchart
        # 流派开关(21 枚举键):容错规范化;缺省/坏值 = 全默认 = 今日行为字节一致。
        from astrostudy.india.dasha_variants import resolve_variants as _rv
        self.dasha_variants = _rv(dasha_variants)
        # 大运年长(日):贯穿全大运族(Vimshottari/Tribhagi/Yogini/Ashtottari/Mula/Naisargika/
        # Sudarshana 年齿 + extended 条件宿系)。默认 365.25 与既有主 Vimshottari 字节一致;
        # 非白名单值静默回落默认(绝不因坏参炸盘)。🔴 只存实例属性,绝不写任何模块全局。
        try:
            _yd = float(dasha_year_days) if dasha_year_days is not None else 365.25
        except (TypeError, ValueError):
            _yd = 365.25
        self.dasha_year_days = _yd if any(abs(_yd - c) < 1e-6 for c in self._DASHA_YEAR_CHOICES) else 365.25
        # 分盘变体映射 {chartnum:variant}(缺省 {} = 全 standard,零回归);经 normalize 只留合法值。
        from astrostudy.india.varga import normalize_varga_variants as _nvv
        self.varga_variant_map = _nvv(varga_variants)
        # Chara Karaka 方案:'8'(默认,含罗睺)/'7'(古典);其余值回落 '8'。
        self.karaka_scheme = '7' if str(karaka_scheme) == '7' else '8'
        # 星曜战判据:'latitude'(默认,纬北者胜)/'longitude'(黄经小者胜);其余回落默认。
        self.yuddha_criterion = 'longitude' if str(yuddha_criterion) == 'longitude' else 'latitude'
        self.chart = perchart.chart
        # 大运起点(seed):默认 'moon'(标准月宿起运);可改取七政/节点/上升/特殊上升/副星任一点。
        self.dasha_seed = (str(dasha_seed).lower() if dasha_seed else 'moon')
        self.sthira_start = (str(sthira_start).lower() if sthira_start else 'lagna')   # Sthira 起座:lagna(默认)/brahma
        # 选中的树形大运体系(决定哪个算完整三级);非四树之一(或缺省)→ 'vimshottari'(默认全展开,零回归)。
        _ds = str(dasha_system).lower() if dasha_system else 'vimshottari'
        self.dasha_system = _ds if _ds in self._DASHA_TREE_SYSTEMS else 'vimshottari'
        try:
            self.chartnum = int(chartnum)
        except (TypeError, ValueError):
            self.chartnum = 1
        self.asc = safe_get(self.chart, const.ASC)
        self.sun = safe_get(self.chart, const.SUN)
        self.moon = safe_get(self.chart, const.MOON)
        # always-D1 子项(月宿大运起点 / Panchanga 真日月 / Gochara 本命参照)恒用 D1 盘。
        # 分盘时由 webindiasrv 传入独立 D1 副本，避免分盘 in-place 重定位污染这些子项；
        # chartnum==1 时 d1_perchart 为 None → D1 引用即自身，行为与重构前字节一致。
        d1p = d1_perchart if d1_perchart is not None else perchart
        self.d1_perchart = d1p
        self.d1_chart = d1p.chart
        self.d1_asc = safe_get(self.d1_chart, const.ASC)
        self.d1_sun = safe_get(self.d1_chart, const.SUN)
        self.d1_moon = safe_get(self.d1_chart, const.MOON)

    def _dasha_block(self):
        """七体系大运块:逐体系容错(个别体系在极端年份炸时置 None,不拖垮整块)。"""
        block = {}
        for key, fn in [
            ('vimshottari', self.vimshottari), ('yogini', self.yogini),
            ('ashtottari', self.ashtottari), ('naisargika', self.naisargika_dasha),
            ('tribhagi', self.tribhagi), ('mula', self.mula_dasha),
            ('sudarshanaChakra', self.sudarshana_chakra_dasha),
            ('taraDasha', self.tara_dasha), ('akkg', self.akkg_dasha),
        ]:
            try:
                block[key] = fn()
            except Exception:
                block[key] = None
        return block

    def compute(self):
        # 逐键安全组装:任一子块在极端年份(如凯龙域外/极地历法边界)失败时,
        # 该键置 None 并记入 partialErrors,其余子块照常输出——绝不整包丢失。
        # 正常年份全部成功 ⇒ 键序与键值与旧实现完全一致(零回归),且不出现 partialErrors 键。
        res = {
            'engine': {
                'name': 'Horosa JyotishEngine',
                'version': '0.1.0',
                'ephemeris': 'Horosa Swiss Ephemeris / IndiaChartKernel',
                'source': 'chart_json_only',
                'chartnum': self.chartnum,
            },
        }
        errs = []
        for key, fn in [
            ('panchanga', self.panchanga), ('nakshatras', self.nakshatras),
            ('yogas', self.yogas), ('dasha', self._dasha_block),
            ('rasiDasha', self.rasi_dashas), ('grahaDrishti', self.graha_drishti),
            ('nodeRasiDrishti', self.node_rasi_drishti), ('ashtakavarga', self.ashtakavarga),
            ('shadbala', self.shadbala), ('shadbalaBphs', self.shadbala_bphs),
            ('strengths', self.strengths), ('jaimini', self.jaimini),
            ('arudha', self.arudha), ('kp', self.kp),
            ('prasna', self.prasna), ('muhurta', self.muhurta),
            ('transit', self.transit_notes), ('upagraha', self.upagraha),
            ('supplementaryLagnas', self.supplementary_lagnas), ('remedies', self.remedies),
            ('functionalNature', self.functional_nature), ('bhavaBala', self.bhava_bala),
            ('extendedDashas', self.extended_dashas), ('grahaYuddha', self.graha_yuddha),
            ('kartari', self.kartari), ('sudarshana', self.sudarshana),
            ('grahaMaitri', self.graha_maitri), ('outerPlanets', self.outer_planets),
            ('compatibility', self.compatibility_shell), ('nadi', self.nadi),
            ('shashtiamsa', self.shashtiamsa), ('vargaVariants', self.varga_variants),
            ('ayurdaya', self.ayurdaya), ('ayurdayaFinal', self.ayurdaya_final),
            ('sensitivePoints', self.sensitive_points),
        ]:
            try:
                res[key] = fn()
            except Exception:
                res[key] = None
                errs.append(key)
        if errs:
            res['partialErrors'] = errs
        return res

    # Āyurdāya(寿命)Piṇḍāyu:满寿(深庙旺)年 + 庙旺点黄经(度)。落陷=庙旺+180°,半值。
    PINDAYU_FULL = {const.SUN: 19, const.MOON: 25, const.MARS: 15, const.MERCURY: 12,
                    const.JUPITER: 15, const.VENUS: 21, const.SATURN: 20}
    PINDAYU_EXALT_LON = {const.SUN: 10.0, const.MOON: 33.0, const.MARS: 298.0,
                         const.MERCURY: 165.0, const.JUPITER: 95.0, const.VENUS: 357.0,
                         const.SATURN: 200.0}
    # Nisargāyu 自然寿年(VERIFIED 多源;Sun=20 异于 Piṇḍāyu 19)。
    NISARGAYU_YEARS = {const.SUN: 20, const.MOON: 1, const.MARS: 2, const.MERCURY: 9,
                       const.JUPITER: 18, const.VENUS: 20, const.SATURN: 50}

    def ayurdaya(self):
        """Āyurdāya 寿命基础贡献。Piṇḍāyu(Grahadatta)度式:每曜贡献 = 满寿 ×(½+½(180−|A−180|)/180),
        A=曜黄经距其落陷点的弧(庙旺满、落陷半、线性内插);7 曜和 = 基础 Piṇḍāyu(未施 haraṇa)。
        另列 Nisargāyu 自然寿表 + 强者定法说明。haraṇa(敌座⅓/合日½/Chakrapata/Krurodaya)门派分歧大,
        本视图给『基础值』并标注未施减,不臆断。零回归:纯新增 compute 键。"""
        try:
            CN = {const.SUN: '日', const.MOON: '月', const.MARS: '火', const.MERCURY: '水',
                  const.JUPITER: '木', const.VENUS: '金', const.SATURN: '土'}
            contribs = []
            base = 0.0
            for pid in [const.SUN, const.MOON, const.MARS, const.MERCURY,
                        const.JUPITER, const.VENUS, const.SATURN]:
                # 🔴 寿命法是 D1 量:恒取 d1_chart(同块 harana/vargottama 本就恒 D1)。
                # 曾用 self.chart → 切分盘时 pindayu/amsayu 随分盘漂移,与 harana 自相矛盾。
                obj = safe_get(self.d1_chart, pid)
                if obj is None:
                    continue
                full = self.PINDAYU_FULL[pid]
                debil = (self.PINDAYU_EXALT_LON[pid] + 180.0) % 360.0
                a = (float(obj.lon) - debil) % 360.0                  # 距落陷弧
                frac = 0.5 + 0.5 * (180.0 - abs(a - 180.0)) / 180.0    # 落陷½→庙旺1
                years = full * frac
                base += years
                contribs.append({
                    'planet': pid, 'planetCN': CN[pid], 'fullYears': full,
                    'exaltLon': self.PINDAYU_EXALT_LON[pid],
                    'lon': float(obj.lon) % 360.0,
                    'arcFromDebil': a, 'fraction': round(frac, 4),
                    'years': round(years, 3),
                })
            nis = [{'planet': p, 'planetCN': CN[p], 'years': self.NISARGAYU_YEARS[p]}
                   for p in [const.SUN, const.MOON, const.MARS, const.MERCURY,
                             const.JUPITER, const.VENUS, const.SATURN]]
            # Aṁśāyu(Satyacharya ÷200 式):每曜 base=(自白羊总角分/200)%12(≤12);Bharaṇa 增:
            # ×3(庙旺 或 逆行)、×2(自座 或 vargottama),两适只取 ×3(多数派)。haraṇa 同标注未施。
            from astrostudy.india.primitives import is_vargottama as _is_varg
            ams = []
            ams_total = 0.0
            ams_total_bphs = 0.0
            ams_total_mul = 0.0
            for pid in [const.SUN, const.MOON, const.MARS, const.MERCURY,
                        const.JUPITER, const.VENUS, const.SATURN]:
                o = safe_get(self.d1_chart, pid)   # 同上:Aṁśāyu 亦恒 D1
                if o is None:
                    continue
                base_y = ((float(o.lon) % 360.0) * 60.0 / 200.0) % 12.0
                dig = self.dignity(pid, o.sign, o.signlon)
                exalt = dig in ('exaltation', 'deep_exaltation')
                retro = getattr(o, 'movedir', None) == 'Retrograde'
                d1o = safe_get(self.d1_chart, pid)
                varg = bool(d1o and _is_varg(d1o.lon, 9))
                own = o.sign in OWN_SIGNS.get(pid, set())
                mult = 3 if (exalt or retro) else (2 if (own or varg) else 1)        # 多数派(默认):庙旺/逆×3·自座/vargottama×2·取最高
                mult_bphs = 3 if (exalt or own) else 1                               # BPHS-literal:svakṣetra 入×3组,略逆/vargottama
                mult_mul = (6 if ((exalt or retro) and (own or varg))               # Sārāvalī 相乘:×3 与 ×2 合并 →×6
                            else (3 if (exalt or retro) else (2 if (own or varg) else 1)))
                y = base_y * mult
                ams_total += y
                ams_total_bphs += base_y * mult_bphs
                ams_total_mul += base_y * mult_mul
                ams.append({'planet': pid, 'planetCN': CN[pid], 'baseYears': round(base_y, 3),
                            'multiplier': mult, 'multiplierBphs': mult_bphs, 'multiplierMul': mult_mul,
                            'years': round(y, 3)})
            return {
                'available': True,
                'pindayu': {
                    'method': 'Piṇḍāyu (Grahadatta)',
                    'contributions': contribs,
                    'baseYears': round(base, 2),
                    'note': '7 曜度式基础贡献和(未施 haraṇa 减);满寿表 Sun19/Moon25/Mars15/Mer12/Jup15/Ven21/Sat20。',
                },
                'nisargayu': {
                    'method': 'Nisargāyu (自然寿)',
                    'naturalYears': nis,
                    'totalYears': 120,
                    'note': '自然寿表(Sun20/Moon1/Mars2/Mer9/Jup18/Ven20/Sat50=120);全期派原样不施 haraṇa。',
                },
                'amsayu': {
                    'method': 'Aṁśāyu (Satyacharya ÷200)',
                    'contributions': ams,
                    'baseYears': round(ams_total, 2),
                    'bharanaVariants': [
                        {'key': 'majority', 'label': '多数派(svakṣetra×2·庙旺/逆×3·取最高)', 'baseYears': round(ams_total, 2)},
                        {'key': 'bphs', 'label': 'BPHS-literal(svakṣetra×3·略逆/vargottama)', 'baseYears': round(ams_total_bphs, 2)},
                        {'key': 'multiply', 'label': 'Sārāvalī 相乘(×3·×2 合并→×6)', 'baseYears': round(ams_total_mul, 2)},
                    ],
                    'note': '每曜 base=(自白羊角分/200)%12(≤12);Bharaṇa 分组/合并门派分歧→三选项:多数派(默认)/BPHS-literal/Sārāvalī相乘;未施 haraṇa。',
                },
                'methodSelection': '强者定法:Lagna 强→Aṁśāyu、Sun 强→Piṇḍāyu、Moon 强→Nisargāyu(以 bala 比强;本视图列候选不自动选)。',
                'haranaNote': 'haraṇa 减(敌座⅓/合日½/Chakrapata/Krurodaya)门派分歧大;基础值未施,见下 harana 块的流派选项。',
                'harana': self._ayurdaya_harana(),
                'haranaNisarga': self._ayurdaya_harana(self.NISARGAYU_YEARS, 'Nisargāyu', raw_total=120.0),
            }
        except Exception as exc:
            return {'available': False, 'reason': str(exc)}

    def ayurdaya_final(self):
        """Āyurdāya 判读层(全量):方法自动选定 + 开关化 haraṇa 并入总值 + 寿命档 +
        三对法离散寿数 + maraka 致死大运投影 + 22nd Drekkana/64th Navamsa。
        🔴 呈现纪律:风险窗口/因子清单语气,仅信息·非处方,不作个人断言。附加输出键零回归。"""
        try:
            dv = self.dasha_variants
            CN = {const.SUN: '日', const.MOON: '月', const.MARS: '火', const.MERCURY: '水',
                  const.JUPITER: '木', const.VENUS: '金', const.SATURN: '土',
                  const.NORTH_NODE: '罗', const.SOUTH_NODE: '计'}
            SOLAR = 360.0 / 365.0
            asc = self.d1_asc
            if asc is None:
                return {'available': False, 'reason': 'missing_lagna'}
            # ── 方法选定(43.30-31:{Lagna,日,月}最强 → Amsayu/Pindayu/Nisargayu)。
            # 强度判据按「尊位级+座内推进度」简化口径(原典未给逐级表;Lagna 以其主代比),注明。
            DIG_RANK = {'deep_exaltation': 5, 'exaltation': 5, 'moolatrikona': 4,
                        'own_sign': 3, 'neutral': 2, 'debilitation': 1}
            def _score(pid):
                o = safe_get(self.d1_chart, pid)
                if o is None:
                    return -1.0
                try:
                    dig = self.dignity(pid, o.sign, o.signlon)
                except Exception:
                    dig = 'neutral'
                return DIG_RANK.get(dig, 2) * 100.0 + float(o.signlon)
            from astrostudy.india.rasi_dasha import SIGN_LORDS as _SL
            lag_lord = _SL.get(asc.sign)
            scores = {'lagna': _score(lag_lord) if lag_lord else -1.0,
                      'sun': _score(const.SUN), 'moon': _score(const.MOON)}
            auto_pick = max(scores, key=lambda k: scores[k])
            AUTO_METHOD = {'sun': 'pindayu', 'moon': 'nisargayu', 'lagna': 'amsayu'}
            method_override = dv.get('ayurdayaMethod', 'auto')
            selected = AUTO_METHOD[auto_pick] if method_override == 'auto' else method_override
            # ── 三法「开关化管线」总值。
            satru = dv.get('satruksetraExemption', 'retrograde')
            kruro_mode = dv.get('krurodayaDenominator', 'zodiac21600')
            def _final_of(harana_res, no_harana=False, raw_total=None):
                if not harana_res or not harana_res.get('available'):
                    return None
                if no_harana:
                    base = raw_total if raw_total is not None else harana_res['baseSum']
                    sav = base + harana_res['lagnaAyu']
                else:
                    kr = harana_res['krurodaya']
                    kd = kr['formulaA'] if kruro_mode == 'zodiac21600' else kr['formulaB']
                    sav = harana_res['sumReduced'] - kd + harana_res['lagnaAyu']
                return {'savanaYears': round(sav, 2), 'solarYears': round(sav * SOLAR, 2)}
            pind_h = self._ayurdaya_harana(satruksetra_exemption=satru)
            finals = {'pindayu': _final_of(pind_h)}
            nis_mode = dv.get('nisargayuHarana', 'none')
            nis_h = self._ayurdaya_harana(self.NISARGAYU_YEARS, 'Nisargāyu', raw_total=120.0,
                                          satruksetra_exemption=satru)
            finals['nisargayu'] = _final_of(nis_h, no_harana=(nis_mode == 'none'), raw_total=120.0)
            # Amsayu:base×bharana(#倍数开关)→ 同管线(无 Krurodaya·落陷减半)
            from astrostudy.india.primitives import is_vargottama as _is_varg
            amult = dv.get('amsayuMultiplier', 'majority_highest')
            ams_map = {}
            for pid in [const.SUN, const.MOON, const.MARS, const.MERCURY,
                        const.JUPITER, const.VENUS, const.SATURN]:
                o = safe_get(self.d1_chart, pid)
                if o is None:
                    continue
                base_y = ((float(o.lon) % 360.0) * 60.0 / 200.0) % 12.0
                try:
                    dig = self.dignity(pid, o.sign, o.signlon)
                except Exception:
                    dig = 'neutral'
                exalt = dig in ('exaltation', 'deep_exaltation')
                retro = getattr(o, 'movedir', None) == 'Retrograde'
                d1o = safe_get(self.d1_chart, pid)
                varg = bool(d1o and _is_varg(d1o.lon, 9))
                own = o.sign in OWN_SIGNS.get(pid, set())
                if amult == 'bphs_literal':
                    mult = 3 if (exalt or own) else 1
                elif amult == 'saravali_multiply':
                    mult = (6 if ((exalt or retro) and (own or varg))
                            else (3 if (exalt or retro) else (2 if (own or varg) else 1)))
                else:
                    mult = 3 if (exalt or retro) else (2 if (own or varg) else 1)
                ams_map[pid] = base_y * mult
            ams_h = self._ayurdaya_harana(method_label='Aṁśāyu', base_map=ams_map,
                                          satruksetra_exemption=satru,
                                          apply_krurodaya=False, neecha_half=True)
            finals['amsayu'] = _final_of(ams_h)
            sel_final = finals.get(selected)
            # ── 寿命档(#边界开关)。
            bounds_mode = dv.get('ayuClassBoundaries', 'bphs_32_64_120')
            mid_hi = 64.0 if bounds_mode == 'bphs_32_64_120' else 70.0
            def _classify(y):
                if y is None:
                    return None
                if y < 8:
                    return {'key': 'balarishta', 'label': '婴夭险段(0-8)'}
                if y < 20:
                    return {'key': 'yogarishta', 'label': '少亡险段(8-20)'}
                if y < 32:
                    return {'key': 'alpa', 'label': '短寿 Alpa(≤32)'}
                if y < mid_hi:
                    return {'key': 'madhya', 'label': '中寿 Madhya(32-%d)' % int(mid_hi)}
                if y <= 120:
                    return {'key': 'purna', 'label': '长寿 Purna(%d-120)' % int(mid_hi)}
                return {'key': 'divya', 'label': '神寿 Divya(>120)'}
            final_years = sel_final['solarYears'] if sel_final else None
            # ── 三对法离散寿数(读票映射:长3/2/1→120/108/91;中3/2/1→80/72/64;短3/2/1→32/36/40)。
            tri = self._jaimini_ayur_tri_pair()
            tri_years = None
            if tri and tri.get('available') is not False and tri.get('votes'):
                v = tri['votes']
                L, M, S = int(v.get('purna', 0)), int(v.get('madhya', 0)), int(v.get('alpa', 0))
                if L > 0:
                    tri_years = {3: 120, 2: 108, 1: 91}[L]
                elif M > 0:
                    tri_years = {3: 80, 2: 72, 1: 64}[M]
                elif S > 0:
                    tri_years = {3: 32, 2: 36, 1: 40}[S]
            # ── maraka 因子清单。
            SIGN_IDX = {sg: i for i, sg in enumerate(const.LIST_SIGNS)}
            lag_i = SIGN_IDX[asc.sign]
            second_sign = const.LIST_SIGNS[(lag_i + 1) % 12]
            seventh_sign = const.LIST_SIGNS[(lag_i + 6) % 12]
            maraka_lords = sorted({_SL.get(second_sign), _SL.get(seventh_sign)} - {None})
            occupants = []
            for pid in [const.SUN, const.MOON, const.MARS, const.MERCURY, const.JUPITER,
                        const.VENUS, const.SATURN, const.NORTH_NODE, const.SOUTH_NODE]:
                o = safe_get(self.d1_chart, pid)
                if o and o.sign in (second_sign, seventh_sign):
                    occupants.append(pid)
            maraka_set = set(maraka_lords) | set(occupants)
            # Trishula 座(Rudra + 5 + 9;rasi_dasha.trishoola 现成)。
            tri_signs = None
            try:
                from astrostudy.india.primitives import rudra_candidate_signs as _rcs, trishoola as _trish
                from astrostudy.india.rasi_dasha import stronger_sign as _ss
                ps = {}
                pl = {}
                for pid in JYOTISH_PLANETS:
                    o = safe_get(self.d1_chart, pid)
                    if o:
                        ps[pid] = o.sign
                        pl[pid] = o.lon
                _ra, _rb = _rcs(asc.sign)
                _rudra = _ss(_ra, _rb, ps, None, pl)
                tri_signs = {'rudraSign': _rudra, 'signs': _trish(_rudra)}
            except Exception:
                tri_signs = None
            # 22nd Drekkana / 64th Navamsa(Khara)。
            lag_lon = float(asc.lon) % 360.0
            d3_g0 = int(lag_lon // 10.0)                     # 全局 drekkana 序 0-35
            d3_22 = (d3_g0 + 21) % 36
            d3_sign = const.LIST_SIGNS[d3_22 // 3]
            DREK_LORD_OFFSET = (0, 4, 8)                     # 1st=座主/2nd=第5座主/3rd=第9座主
            d3_lord_sign = const.LIST_SIGNS[(SIGN_IDX[d3_sign] + DREK_LORD_OFFSET[d3_22 % 3]) % 12]
            drek22 = {'sign': d3_sign, 'lord': _SL.get(d3_lord_sign)}
            moon_o = self.d1_moon
            nav_base = float(moon_o.lon) if moon_o is not None else lag_lon
            n0 = int((nav_base % 360.0) // (30.0 / 9.0))     # 全局 navamsa 序 0-107
            n64 = (n0 + 63) % 108
            nav_sign = const.LIST_SIGNS[n64 % 12]
            nav64 = {'sign': nav_sign, 'lord': _SL.get(nav_sign), 'basis': 'moon' if moon_o is not None else 'lagna'}
            # ── 致死运投影:寿龄落 Vimshottari 轴(大运/中运)。
            projection = None
            if final_years is not None:
                try:
                    vim = self.vimshottari()
                    tgt = float(final_years)
                    for m in (vim.get('mahadashas') or []):
                        sa, ea = m.get('startAge'), m.get('endAge')
                        if sa is None or ea is None:
                            continue
                        if sa <= tgt < ea:
                            proj = {'mahaLord': m.get('lord'), 'mahaStartAge': sa, 'mahaEndAge': ea,
                                    'mahaIsMaraka': bool((m.get('lord') or {}).get('id') in maraka_set)}
                            for ad in (m.get('antardashas') or []):
                                asa, aea = ad.get('startAge'), ad.get('endAge')
                                if asa is not None and aea is not None and asa <= tgt < aea:
                                    proj['antarLord'] = ad.get('lord')
                                    proj['antarIsMaraka'] = bool((ad.get('lord') or {}).get('id') in maraka_set)
                                    break
                            projection = proj
                            break
                except Exception:
                    projection = None
            return {
                'available': True,
                'methodSelection': {
                    'auto': AUTO_METHOD[auto_pick],
                    'override': method_override,
                    'selected': selected,
                    'scores': {k: round(v, 2) for k, v in scores.items()},
                    'note': '强度判据按尊位级+座内推进度简化口径(Lagna 以其主代比);可手动指定法覆盖',
                },
                'finals': finals,
                'selectedFinal': sel_final,
                'ayuClass': _classify(final_years),
                'classBoundaries': bounds_mode,
                'triPairYears': tri_years,
                'triPairVotes': (tri or {}).get('votes'),
                'triPairNote': '离散寿数按三票读表(长3/2/1→120/108/91;中→80/72/64;短→32/36/40);'
                               '木星升档/土星降档修正之触发条件权威未详,未施',
                'maraka': {
                    'sthana': {'second': second_sign, 'seventh': seventh_sign},
                    'lords': maraka_lords,
                    'occupants': occupants,
                    'planets': sorted(maraka_set),
                },
                'trishula': tri_signs,
                'drekkana22': drek22,
                'navamsa64': nav64,
                'chhidraNote': 'Chhidra 脆弱窗定义权威未详 → 不输出(不臆造)',
                'projection': projection,
                'disclaimer': '仅信息·非处方:风险窗口与因子清单,不构成对任何个人的生死断言',
            }
        except Exception as exc:
            return {'available': False, 'reason': str(exc)}

    def _ayurdaya_harana(self, full_table=None, method_label='Piṇḍāyu', raw_total=None,
                         satruksetra_exemption='retrograde', base_map=None,
                         apply_krurodaya=True, neecha_half=False):
        """Āyurdāya haraṇa(减)逐项 — 古法减寿全规则。施于 Piṇḍāyu(度式)或 Nisargāyu:
        敌座(Śatrukṣetra)⅓ 与合日(Astangata)½ 只取大者(BPHS 43.22 max;逆行免敌座、金/土免合日);
        Chakrapata 可见半球(自 Lagna 12/11/10/9/8/7 宫)凶星按表损·吉星半,独立连乘;
        Krurodaya(凶升 Lagna)对总和一次(式A 角分/21600 默认、式B navāṁśa/108 变体);
        +Lagna_Ayu=(Lagna 座内角分)/200;末 ×360/365 Savana→Solar。
        『做成不同流派选项』:未减(全期/Rath)vs 施减(技术/Sārāvalī)·Krurodaya A/B。
        full_table=贡献满寿表(Piṇḍāyu 默认);raw_total 给「全期派原值」(Nisargāyu=120,按流派开关)。
        恒 D1 算。零回归:纯新增子键。"""
        try:
            if full_table is None:
                full_table = self.PINDAYU_FULL
            from astrostudy.india.primitives import is_combust, natural_relation, house_distance
            from astrostudy.india.rasi_dasha import SIGN_LORDS
            CN = {const.SUN: '日', const.MOON: '月', const.MARS: '火', const.MERCURY: '水',
                  const.JUPITER: '木', const.VENUS: '金', const.SATURN: '土'}
            CHAKRA_KRURA = {12: 1.0, 11: 0.5, 10: 1.0 / 3, 9: 0.25, 8: 0.2, 7: 1.0 / 6}
            asc = self.d1_asc
            if asc is None:
                return {'available': False, 'reason': 'missing_lagna'}
            sun = safe_get(self.d1_chart, const.SUN)
            sun_lon = float(sun.lon) if sun else None
            moon = safe_get(self.d1_chart, const.MOON)
            moon_waning = bool(moon is not None and sun is not None
                               and (((float(moon.lon) - float(sun.lon)) % 360.0) > 180.0))   # 残月=Krishna paksha
            mal_signs = set()
            for mp in (const.SUN, const.MARS, const.SATURN):
                mo = safe_get(self.d1_chart, mp)
                if mo is not None:
                    mal_signs.add(mo.sign)

            def is_malefic(pid, sign):
                if pid in (const.SUN, const.MARS, const.SATURN):
                    return True
                if pid == const.MOON:
                    return moon_waning
                if pid == const.MERCURY:
                    return sign in mal_signs   # 恶配水星(与凶同座)
                return False

            rows = []
            sum_reduced = 0.0
            base_sum = 0.0
            krurodaya_planet = None
            for pid in [const.SUN, const.MOON, const.MARS, const.MERCURY,
                        const.JUPITER, const.VENUS, const.SATURN]:
                obj = safe_get(self.d1_chart, pid)
                if obj is None:
                    continue
                if base_map is not None:
                    if pid not in base_map:
                        continue
                    base_y = float(base_map[pid])       # 直供口径(Amsayu:base×bharana 后)
                else:
                    full = full_table[pid]
                    debil = (self.PINDAYU_EXALT_LON[pid] + 180.0) % 360.0
                    a = (float(obj.lon) - debil) % 360.0
                    base_y = full * (0.5 + 0.5 * (180.0 - abs(a - 180.0)) / 180.0)
                base_sum += base_y
                retro = getattr(obj, 'movedir', None) == 'Retrograde'
                lord = SIGN_LORDS.get(obj.sign)
                enemy_sign = bool(lord and lord != pid and natural_relation(pid, lord) == 'enemy')
                # 敌座豁免两读:vakra=逆行(多数,默认) / vakra=火星(变体:火星在敌座亦免)。
                if satruksetra_exemption == 'mars':
                    shatru = enemy_sign and pid != const.MARS
                else:
                    shatru = enemy_sign and not retro              # 逆行免敌座
                combust = bool(sun_lon is not None and pid not in (const.VENUS, const.SATURN)
                               and is_combust(pid, float(obj.lon), sun_lon, retro))   # 金/土免合日
                dignity_harana = max(1.0 / 3 if shatru else 0.0, 0.5 if combust else 0.0)   # 只取大者,绝不并施
                if neecha_half:
                    # Amsayu 附加:落陷减半(与尊位减取大者合并前独立;按同法连乘口径并入)
                    try:
                        if self.dignity(pid, obj.sign, obj.signlon) == 'debilitation':
                            dignity_harana = max(dignity_harana, 0.5)
                    except Exception:
                        pass
                house = house_distance(asc.sign, obj.sign)
                chakra = 0.0
                if house in CHAKRA_KRURA:
                    chakra = CHAKRA_KRURA[house] if is_malefic(pid, obj.sign) else CHAKRA_KRURA[house] / 2.0
                reduced = base_y * (1.0 - dignity_harana) * (1.0 - chakra)
                sum_reduced += reduced
                if house == 1 and is_malefic(pid, obj.sign) and krurodaya_planet is None:
                    krurodaya_planet = pid
                rows.append({
                    'planet': pid, 'planetCN': CN[pid], 'baseYears': round(base_y, 3),
                    'enemySign': enemy_sign, 'combust': combust,
                    'dignityHarana': round(dignity_harana, 3), 'house': house,
                    'chakrapata': round(chakra, 4), 'reducedYears': round(reduced, 3),
                })
            # Krurodaya 缓和(古法):吉星望 Lagna → 减半(吉星在7宫冲、或木星在5/9宫特殊相;Indira 例 Moon 望致 Saturn 减半)。
            kruro_mitigated = False
            if krurodaya_planet:
                for bp in (const.JUPITER, const.VENUS, const.MERCURY, const.MOON):
                    bo = safe_get(self.d1_chart, bp)
                    if bo is None:
                        continue
                    if bp == const.MERCURY and bo.sign in mal_signs:
                        continue          # 恶配水星不作吉
                    if bp == const.MOON and moon_waning:
                        continue          # 残月不作吉
                    bh = house_distance(asc.sign, bo.sign)
                    if bh == 7 or (bp == const.JUPITER and bh in (5, 9)):   # 望 Lagna(7宫冲 / 木5·9特殊相)
                        kruro_mitigated = True
                        break
            if not apply_krurodaya:
                krurodaya_planet = None                 # Amsayu 不施 Krurodaya
            mit = 0.5 if kruro_mitigated else 1.0
            asc_arcmin = (float(asc.lon) % 30.0) * 60.0
            kruro_a = sum_reduced * asc_arcmin / 21600.0 * mit if krurodaya_planet else 0.0
            navamsa_count = int((float(asc.lon) % 360.0) / (30.0 / 9.0)) + 1   # 自白羊 navāṁśa 数 1-108
            kruro_b = sum_reduced * navamsa_count / 108.0 * mit if krurodaya_planet else 0.0
            lagna_ayu = asc_arcmin / 200.0
            SOLAR = 360.0 / 365.0
            final_a = sum_reduced - kruro_a + lagna_ayu
            final_b = sum_reduced - kruro_b + lagna_ayu
            # 全期派原值:Nisargāyu 用 raw_total(=120,全期派不施缩放/haraṇa);Piṇḍāyu 无 raw→用 scaled 未减和。
            full_base = raw_total if raw_total is not None else base_sum
            profiles = [
                {'key': 'noharana', 'label': '未减·全期派(传承)',
                 'savanaYears': round(full_base + lagna_ayu, 2),
                 'solarYears': round((full_base + lagna_ayu) * SOLAR, 2)},
                {'key': 'harana_a', 'label': '施减·式A 角分(技术派/Sārāvalī)',
                 'savanaYears': round(final_a, 2), 'solarYears': round(final_a * SOLAR, 2)},
                {'key': 'harana_b', 'label': '施减·式B navāṁśa',
                 'savanaYears': round(final_b, 2), 'solarYears': round(final_b * SOLAR, 2)},
            ]
            return {
                'available': True,
                'method': method_label,
                'planets': rows,
                'baseSum': round(base_sum, 3),
                'sumReduced': round(sum_reduced, 3),
                'krurodaya': {'applies': krurodaya_planet is not None,
                              'planetCN': (CN.get(krurodaya_planet) if krurodaya_planet else None),
                              'mitigated': kruro_mitigated,
                              'formulaA': round(kruro_a, 3), 'formulaB': round(kruro_b, 3)},
                'lagnaAyu': round(lagna_ayu, 3),
                'profiles': profiles,
                'note': 'Piṇḍāyu haraṇa:敌座⅓/合日½取大者(逆免敌·金土免合)·Chakrapata可见半球(12→1·11→½·10→⅓·9→¼·8→1/5·7→1/6,吉星半)独立·Krurodaya总和一次(吉星望Lagna减半);未施「一宫只取最强」与Krurodaya「吉在Lagna远近」细分(标注)。',
            }
        except Exception as exc:
            return {'available': False, 'reason': str(exc)}

    def nadi(self):
        """Nāḍī 流派敏感点。Bhrigu Bindu(福点)= Rahu 与 Moon 的「较短弧中点」
        =(λRahu+λMoon)/2,若两点黄经差 >180° 则 +180°(取短弧)。落座/宫 = 业力焦点/应期。
        缺月/罗睺 → available False(不臆造)。零回归:纯新增 compute 键。"""
        try:
            moon = self.moon
            rahu = safe_get(self.chart, const.NORTH_NODE)
            if moon is None or rahu is None:
                return {'available': False, 'reason': 'missing_moon_or_rahu'}
            m = float(moon.lon) % 360.0
            r = float(rahu.lon) % 360.0
            mid = ((m + r) / 2.0) % 360.0
            if abs(r - m) > 180.0:               # 取较短弧中点
                mid = (mid + 180.0) % 360.0
            sidx = sign_index_from_lon(mid)
            sign = const.LIST_SIGNS[sidx]
            # D150 Nāḍiāṃśa(每座 30°/150 = 0°12′):奇座顺/偶座逆(五支古法)。
            # 专名表(Vasudha/Vaishnavi… 150 名)所给文档仅列 3 例 → 号位先显,名 blocked 不臆造。
            def _nadiamsa(lon):
                psidx = sign_index_from_lon(lon)
                raw = int((float(lon) % 30.0) / 0.2)
                if raw > 149:
                    raw = 149
                num = (raw + 1) if (psidx % 2 == 0) else (150 - raw)   # 奇座(0基偶)顺、偶座逆
                return num, psidx
            d150 = []
            for pid in (const.SUN, const.MOON, const.MARS, const.MERCURY,
                        const.JUPITER, const.VENUS, const.SATURN,
                        const.NORTH_NODE, const.SOUTH_NODE):
                pobj = safe_get(self.chart, pid)
                if pobj is None:
                    continue
                plon = float(pobj.lon) % 360.0
                num, psidx = _nadiamsa(plon)
                psign = const.LIST_SIGNS[psidx]
                # A3:每格 0°12′ 精确边界(座内 raw 格序 = 顺排第 raw+1 格,与号位的奇顺偶逆无关)
                raw = int((plon % 30.0) / 0.2)
                if raw > 149:
                    raw = 149
                start_in_sign = raw * 0.2
                d150.append({'planet': pid, 'nadiamsa': num,
                             'sign': psign, 'signLabel': SIGN_CN.get(psign, psign),
                             'withinSignDeg': round(plon % 30.0, 4),
                             'startLon': round(psidx * 30.0 + start_in_sign, 4),
                             'endLon': round(psidx * 30.0 + start_in_sign + 0.2, 4),
                             'name': None})
            # ── A1:同座合 + parivartana 交换(Bhrigu Nadi「同座=合;庙座互驻=强联动」)──
            from astrostudy.india.rasi_dasha import SIGN_LORDS as _SL, SIGN_LORDS_DUAL as _SLD
            nine = (const.SUN, const.MOON, const.MARS, const.MERCURY, const.JUPITER,
                    const.VENUS, const.SATURN, const.NORTH_NODE, const.SOUTH_NODE)
            by_sign = {}
            plon_map = {}
            for pid in nine:
                pobj = safe_get(self.chart, pid)
                if pobj is None:
                    continue
                plon_map[pid] = float(pobj.lon) % 360.0
                by_sign.setdefault(pobj.sign, []).append(pid)
            combinations = []
            for sgn in const.LIST_SIGNS:
                grp = by_sign.get(sgn) or []
                if len(grp) >= 2:
                    combinations.append({'sign': sgn, 'signLabel': SIGN_CN.get(sgn, sgn),
                                         'planets': list(grp), 'count': len(grp)})

            def _own_signs(pid):
                out = set()
                for sg, lord in _SL.items():
                    if lord == pid:
                        out.add(sg)
                for sg, lord in _SLD.items():
                    if lord == pid:
                        out.add(sg)
                return out

            exchanges = []
            seen_pairs = set()
            for a in nine:
                for b in nine:
                    if a >= b or a not in plon_map or b not in plon_map:
                        continue
                    a_sign = const.LIST_SIGNS[sign_index_from_lon(plon_map[a])]
                    b_sign = const.LIST_SIGNS[sign_index_from_lon(plon_map[b])]
                    if a_sign == b_sign:
                        continue
                    owns_a = _own_signs(a)
                    owns_b = _own_signs(b)
                    if a_sign in owns_b and b_sign in owns_a:
                        key = (a, b)
                        if key in seen_pairs:
                            continue
                        seen_pairs.add(key)
                        dual = (a_sign in _SLD) or (b_sign in _SLD) \
                            or (a in _SLD.values()) or (b in _SLD.values())
                        exchanges.append({'a': a, 'b': b,
                                          'aSign': a_sign, 'aSignLabel': SIGN_CN.get(a_sign, a_sign),
                                          'bSign': b_sign, 'bSignLabel': SIGN_CN.get(b_sign, b_sign),
                                          'dualLord': bool(dual)})
            # ── A2:木星逐座推进时间轴(默认每座 1 木星年;各 Bhrigu 派年数不同 → 标版本)──
            JUPITER_YEARS_PER_SIGN = 1.0
            jup_prog = None
            jup = safe_get(self.chart, const.JUPITER)
            if jup is not None:
                import datetime as _dt
                start_sidx = sign_index_from_lon(float(jup.lon))
                birth_dt = None
                try:
                    jd0 = float(self.perchart.dateTime.jd)
                    birth_dt = _dt.datetime(2000, 1, 1, 12) + _dt.timedelta(days=jd0 - 2451545.0)
                except Exception:
                    birth_dt = None
                segments = []
                for k in range(24):
                    sidx_k = (start_sidx + k) % 12
                    sgn_k = const.LIST_SIGNS[sidx_k]
                    seg = {'index': k + 1, 'sign': sgn_k,
                           'signLabel': SIGN_CN.get(sgn_k, sgn_k),
                           'startAge': round(k * JUPITER_YEARS_PER_SIGN, 2),
                           'endAge': round((k + 1) * JUPITER_YEARS_PER_SIGN, 2),
                           'natalPlanets': list(by_sign.get(sgn_k) or [])}
                    if birth_dt is not None:
                        sd = birth_dt + _dt.timedelta(days=k * JUPITER_YEARS_PER_SIGN * 365.25)
                        ed = birth_dt + _dt.timedelta(days=(k + 1) * JUPITER_YEARS_PER_SIGN * 365.25)
                        seg['startDate'] = sd.strftime('%Y-%m-%d')
                        seg['endDate'] = ed.strftime('%Y-%m-%d')
                    segments.append(seg)
                jup_prog = {'rule': 'one_year_per_sign',
                            'ruleLabel': '推进规则:每座 1 木星年(各 Bhrigu 派年数不同,版本可调)',
                            'startSign': const.LIST_SIGNS[start_sidx],
                            'segments': segments}
            # ── A3:Nadi Karaka 体系(九曜象征,Bhrigu Nadi 木星为首要 karaka)──
            nadi_karakas = [
                {'planet': const.SUN, 'label': PLANET_CN.get(const.SUN, 'Sun'), 'significations': ['父', '灵魂']},
                {'planet': const.MOON, 'label': PLANET_CN.get(const.MOON, 'Moon'), 'significations': ['母', '心']},
                {'planet': const.MARS, 'label': PLANET_CN.get(const.MARS, 'Mars'), 'significations': ['兄弟', '技术']},
                {'planet': const.MERCURY, 'label': PLANET_CN.get(const.MERCURY, 'Mercury'), 'significations': ['言', '商']},
                {'planet': const.JUPITER, 'label': PLANET_CN.get(const.JUPITER, 'Jupiter'), 'significations': ['子', '智', '夫(女命)'], 'primary': True},
                {'planet': const.VENUS, 'label': PLANET_CN.get(const.VENUS, 'Venus'), 'significations': ['妻', '欲']},
                {'planet': const.SATURN, 'label': PLANET_CN.get(const.SATURN, 'Saturn'), 'significations': ['寿', '业']},
                {'planet': const.NORTH_NODE, 'label': PLANET_CN.get(const.NORTH_NODE, 'Rahu'), 'significations': ['外缘']},
                {'planet': const.SOUTH_NODE, 'label': PLANET_CN.get(const.SOUTH_NODE, 'Ketu'), 'significations': ['解脱', '旧业']},
            ]
            return {
                'available': True,
                'bhriguBindu': {
                    'lon': mid,
                    'sign': sign,
                    'signLabel': SIGN_CN.get(sign, sign),
                    'signIndex': sidx,
                    'signlon': mid % 30.0,
                    'nakshatra': nakshatra_from_lon(mid),
                    'moonLon': m, 'rahuLon': r,
                },
                'd150': d150,
                'namesAvailable': False,
                'd150Note': 'D150 纳地盘:各曜落第几个 nāḍiāṃśa(150/座,0°12′);150 专名待录入原典表,暂显号位。',
                'combinations': combinations,
                'exchanges': exchanges,
                'jupiterProgression': jup_prog,
                'karakas': nadi_karakas,
                'combinationNote': '同座=合;仅出结构不出断语(组合字典原典未列全,不臆造)。',
                'note': 'Bhrigu Bindu = Rahu/Moon 短弧中点;业力焦点,过运触发为重大应期。',
            }
        except Exception as exc:
            return {'available': False, 'reason': str(exc)}

    def sensitive_points(self):
        """敏感点 Sphuta(古法三类):生育点 + Gandanta/Sandhi 界位 + 死亡指示点
        (仅风险标注)+ Mrityu Bhaga(表空即 None,待录入)。纯派生,失败整块置 None
        由 compute() 的逐键 try/except 兜住。"""
        from astrostudy.india import sensitive_points as sp
        lons = {}
        for pid in (const.SUN, const.MOON, const.MARS, const.MERCURY, const.JUPITER,
                    const.VENUS, const.SATURN, const.NORTH_NODE, const.SOUTH_NODE):
            obj = safe_get(self.chart, pid)
            lons[pid] = getattr(obj, 'lon', None)
        lagna_lon = getattr(self.asc, 'lon', None)
        bodies = dict(lons)
        if lagna_lon is not None:
            bodies['Lagna'] = lagna_lon
        return {
            'available': True,
            'beejaKshetra': sp.beeja_kshetra_sphuta(
                lons.get(const.SUN), lons.get(const.VENUS), lons.get(const.JUPITER),
                lons.get(const.MOON), lons.get(const.MARS)),
            'gandanta': {
                'orbArcmin': 48,
                'hits': sp.boundary_flags_for(bodies),
                'note': '三处水火交界(双鱼↔白羊/巨蟹↔狮子/天蝎↔射手)±0°48′;Rasi Sandhi 为任意座界 ±1°,判力减分',
            },
            'deathIndicators': sp.death_indicator_points(lagna_lon, lons.get(const.MOON)),
            'mrityuBhaga': sp.mrityu_bhaga_hits(bodies),
        }

    def shashtiamsa(self):
        """D60 Ṣaṣṭyāṃśa(六十分盘)吉凶:各曜本命经度落第几个 0°30′ 段(1..60),
        奇象顺/偶象神名逆序(deity=61−段);Krūra(恶段)24 个 → 凶,余吉(D60 古法)。
        神名全表(Ghora/Rakshasa/Deva… 60 名,Santhanam BPHS)已落地;显段号+神名+吉凶+D60 落座。
        恒以本命 D1 经度算(与所绘分盘无关)。零回归:纯新增 compute 键。"""
        try:
            from astrostudy.india.varga import shashtiamsa_nature, varga_position
            rows = []
            for pid in (const.SUN, const.MOON, const.MARS, const.MERCURY,
                        const.JUPITER, const.VENUS, const.SATURN,
                        const.NORTH_NODE, const.SOUTH_NODE):
                pobj = safe_get(self.d1_chart, pid)
                if pobj is None:
                    continue
                d1_lon = float(pobj.lon) % 360.0
                nat = shashtiamsa_nature(d1_lon)
                vsidx = sign_index_from_lon(varga_position(d1_lon, 60))
                vsign = const.LIST_SIGNS[vsidx]
                rows.append({
                    'planet': pid,
                    'segment': nat['segment'],
                    'deityIndex': nat['deityIndex'],
                    'deity': nat['deity'],
                    'nature': nat['nature'],
                    'sign': vsign,
                    'signLabel': SIGN_CN.get(vsign, vsign),
                })
            if not rows:
                return {'available': False, 'reason': 'no_planets'}
            benefic = sum(1 for r in rows if r['nature'] == 'benefic')
            return {
                'available': True,
                'planets': rows,
                'beneficCount': benefic,
                'maleficCount': len(rows) - benefic,
                'note': 'D60 六十分盘吉凶:本命经度落第几段(1..60);Krūra 恶段→凶,余吉。偶象神名逆序(61−段)。60 神名(BPHS 译本)已显。',
            }
        except Exception as exc:
            return {'available': False, 'reason': str(exc)}

    def varga_variants(self):
        """分盘变体对照(古籍分盘章):D2/D3/D24/D30 各流派下落座可异。
        标准 Parāśara 为默认;另列 D2 Parivṛtti·D3 Parivṛtti/Jagannātha·D24 Narasiṃha(偶座逆)·D30 等分。
        含 D2 Kashinatha(依源座主星)、D3 Somanatha(奇顺偶逆),公式 _agentA_chartcasting.md。
        恒以本命 D1 经度算;同曜在各方案落座并列,differs 标差异。零回归:纯新增 compute 键。"""
        try:
            from astrostudy.india.varga import varga_position
            schemes = [
                {'chartnum': 2,  'key': 'd2',  'label': 'D2 Horā 二分盘',
                 'variants': [('standard', '标准 Parāśara'), ('parivritti', 'Parivṛtti 循环'), ('kashinatha', 'Kāśīnātha 财富·依主星')]},
                {'chartnum': 3,  'key': 'd3',  'label': 'D3 Drekkāṇa 三分盘',
                 'variants': [('standard', '标准 Parāśara'), ('parivritti', 'Parivṛtti 循环'), ('jagannatha', 'Jagannātha'), ('somanatha', 'Somanātha 奇顺偶逆')]},
                {'chartnum': 24, 'key': 'd24', 'label': 'D24 Siddhāṃśa 廿四分盘',
                 'variants': [('standard', '标准'), ('correct', 'Narasiṃha 偶座逆')]},
                {'chartnum': 30, 'key': 'd30', 'label': 'D30 Triṃśāṃśa 卅分盘',
                 'variants': [('standard', '标准 不等分'), ('equal', '等分 1°')]},
            ]
            planets = (const.SUN, const.MOON, const.MARS, const.MERCURY, const.JUPITER,
                       const.VENUS, const.SATURN, const.NORTH_NODE, const.SOUTH_NODE)
            charts = []
            for sc in schemes:
                rows = []
                has_diff = False
                for pid in planets:
                    pobj = safe_get(self.d1_chart, pid)
                    if pobj is None:
                        continue
                    d1_lon = float(pobj.lon) % 360.0
                    cells = []
                    for vk, _vlabel in sc['variants']:
                        sidx = sign_index_from_lon(
                            varga_position(d1_lon, sc['chartnum'], None if vk == 'standard' else vk))
                        sign = const.LIST_SIGNS[sidx]
                        cells.append({'variant': vk, 'sign': sign, 'signLabel': SIGN_CN.get(sign, sign)})
                    differs = len({c['sign'] for c in cells}) > 1
                    has_diff = has_diff or differs
                    rows.append({'planet': pid, 'cells': cells, 'differs': differs})
                charts.append({
                    'chartnum': sc['chartnum'], 'key': sc['key'], 'label': sc['label'],
                    'variants': [{'key': k, 'label': l} for k, l in sc['variants']],
                    'planets': rows, 'hasDifference': has_diff,
                    'selected': self.varga_variant_map.get(sc['chartnum']) or 'standard',
                })
            return {
                'available': True,
                'charts': charts,
                'note': '分盘变体对照:同曜在各流派分盘落座可异;标准 Parāśara 为默认。含 Kashinatha/Somanatha 等变体。',
            }
        except Exception as exc:
            return {'available': False, 'reason': str(exc)}

    def remedies(self):
        """补救(宝石/化解)：取需增力的弱曜(落陷/燃烧)→ 宝石建议。恒以 D1 盘算。"""
        try:
            from astrostudy.india.remedies import compute as remedies_compute
            from astrostudy.india.primitives import is_combust
            weak = []
            sun_lon = getattr(self.sun, 'lon', None)
            for obj_id in JYOTISH_PLANETS:
                obj = safe_get(self.chart, obj_id)
                if not obj:
                    continue
                dignity = self.dignity(obj_id, obj.sign, obj.signlon)
                retro = getattr(obj, 'movedir', None) == 'Retrograde'
                combust = bool(sun_lon is not None and is_combust(obj_id, obj.lon, sun_lon, retro))
                if dignity == 'debilitation' or combust:
                    weak.append(obj_id)
            return remedies_compute(weak)
        except Exception:
            return {'available': False}

    def functional_nature(self):
        """行星功能吉凶(按上升分类:吉/凶/中/Yogakaraka/Maraka/Badhaka)。**以当前显示盘算**
        (chartnum==1 时即 D1;分盘时按该分盘的上升/星座,使右边栏随显示盘变化)。"""
        try:
            from astrostudy.india.functional_nature import functional_nature as _fn
            if not self.asc:
                return {'available': False}
            planet_signs = {}
            for obj_id in JYOTISH_PLANETS:
                obj = safe_get(self.chart, obj_id)
                if obj:
                    planet_signs[obj_id] = obj.sign
            return {'available': True, 'lagnaSign': self.asc.sign,
                    'grahas': _fn(self.asc.sign, planet_signs)}
        except Exception:
            return {'available': False}

    def bhava_bala(self):
        """宫力 Bhava Bala(宫主力+方位力+受视力+居宫星力)。**以当前显示盘算**。复用 shadbala_bphs 六力。"""
        try:
            from astrostudy.india import bhava_bala as bb
            if not self.asc:
                return {'available': False}
            planet_signs, planet_lons = {}, {}
            for obj_id in (const.SUN, const.MOON, const.MARS, const.MERCURY,
                           const.JUPITER, const.VENUS, const.SATURN):
                o = safe_get(self.chart, obj_id)
                if o is not None:
                    planet_signs[obj_id] = o.sign
                    planet_lons[obj_id] = float(o.lon)
            return bb.bhava_bala(lagna_sign=self.asc.sign,
                                 planet_shadbala=self.shadbala_bphs(),
                                 planet_lons=planet_lons, planet_signs=planet_signs)
        except Exception:
            return {'available': False}

    def extended_dashas(self):
        """补充大运批量(条件型 8 宿系 + Chara Jaimini)。恒 D1。条件不满足仍可查 mahadasha。"""
        try:
            from astrostudy.india.dasha_extended import build_extended_dashas
            if not self.d1_asc or not self.d1_moon:
                return {'available': False}
            planet_signs, planet_lons = {}, {}
            for obj_id in JYOTISH_PLANETS:
                obj = safe_get(self.d1_chart, obj_id)
                if obj:
                    planet_signs[obj_id] = obj.sign
                    planet_lons[obj_id] = obj.lon
            seed_lon = self._dasha_seed_lon()  # 大运起点(默认 D1 月宿,可选七政/虚点)
            moon_lon = float(seed_lon if seed_lon is not None else self.d1_moon.lon)
            mk = nakshatra_from_lon(moon_lon)
            inputs = {
                'lagna_sign': self.d1_asc.sign,
                'planet_signs': planet_signs,
                'planet_lons': planet_lons,
                'moon_lon': moon_lon,
                'moon_nak_index': mk['index'],
                'moon_nak_name': mk['name'],
                'moon_nak_remaining_ratio': mk.get('remainingRatio', mk.get('progress')),
                'conditionContext': self._dasha_condition_context(),
            }
            inputs['year_length_days'] = self.dasha_year_days
            inputs['dashaVariants'] = self.dasha_variants
            return build_extended_dashas(inputs)
        except Exception:
            return {'available': False}

    def _dasha_condition_context(self):
        """补充大运适用条件上下文(尽量算,缺则该系 available:False 仍出 mahadasha)。"""
        ctx = {}
        SIGNS = [const.ARIES, const.TAURUS, const.GEMINI, const.CANCER, const.LEO, const.VIRGO,
                 const.LIBRA, const.SCORPIO, const.SAGITTARIUS, const.CAPRICORN, const.AQUARIUS, const.PISCES]
        try:
            from astrostudy.india.rasi_dasha import SIGN_LORDS
        except Exception:
            SIGN_LORDS = None
        try:
            ctx['lagna_sign'] = self.d1_asc.sign
            try:
                ctx['is_day'] = bool(self.d1_chart.isDiurnal())
            except Exception:
                ctx['is_day'] = None
            if self.d1_moon and self.d1_sun:
                diff = (float(self.d1_moon.lon) - float(self.d1_sun.lon)) % 360.0
                ctx['paksha'] = 'Shukla' if diff < 180.0 else 'Krishna'
            try:
                ctx['weekday'] = self.perchart.dateTime.date.dayofweek()
            except Exception:
                pass
            d9_idx = int(float(self.d1_asc.lon) / (30.0 / 9.0)) % 12
            ctx['d9_lagna_sign'] = SIGNS[d9_idx]
            ctx['lagna_is_vargottama'] = (ctx['d9_lagna_sign'] == self.d1_asc.sign)
            # 🔴 条件系缺口根修:Panchottari 读 d12_lagna_sign、Shattrimsha-sama 读 lagna_hora,
            # 此前引擎从不生产这两键 → 两式 available 恒 False(条件恒判不满足)。
            # 分盘换算走 primitives.varga_sign 单源(排盘标准式,D2 恒出 Leo/Cancer)。
            try:
                from astrostudy.india.primitives import varga_sign as _vsign
                ctx['d12_lagna_sign'] = _vsign(self.d1_asc.lon, 12)
                _d2 = _vsign(self.d1_asc.lon, 2)
                ctx['lagna_hora'] = 'Sun' if _d2 == const.LEO else (
                    'Moon' if _d2 == const.CANCER else None)
            except Exception:
                pass
            if self.d1_sun:
                ctx['sun_in_lagna'] = (self.d1_sun.sign == self.d1_asc.sign)
            if SIGN_LORDS:
                lidx = SIGNS.index(self.d1_asc.sign)
                tenth_sign = SIGNS[(lidx + 9) % 12]
                tenth_lord = SIGN_LORDS.get(tenth_sign)
                lagna_lord = SIGN_LORDS.get(self.d1_asc.sign)

                def _house_of(planet_id):
                    o = safe_get(self.d1_chart, planet_id)
                    if not o:
                        return None
                    return ((SIGNS.index(o.sign) - lidx) % 12) + 1
                if tenth_lord:
                    ctx['tenth_lord_in_tenth'] = (_house_of(tenth_lord) == 10)
                if lagna_lord:
                    ctx['lagna_lord_in_1_or_7'] = (_house_of(lagna_lord) in (1, 7))
        except Exception:
            pass
        return ctx

    def graha_yuddha(self):
        """行星战争(Graha Yuddha):两星 <1° 同宫即战;纬度更北者胜,败者力损。**以当前显示盘算**。仅五星参战。"""
        try:
            war_ids = [const.MARS, const.MERCURY, const.JUPITER, const.VENUS, const.SATURN]
            objs = [(p, safe_get(self.chart, p)) for p in war_ids]
            objs = [(p, o) for p, o in objs if o]
            pairs = []
            for i in range(len(objs)):
                for j in range(i + 1, len(objs)):
                    pa, oa = objs[i]
                    pb, ob = objs[j]
                    if oa.sign != ob.sign:
                        continue
                    sep = abs(float(oa.lon) - float(ob.lon)) % 360.0
                    sep = min(sep, 360.0 - sep)
                    if sep < 1.0:
                        if self.yuddha_criterion == 'longitude':
                            # 另说:黄经较小(更西/先到)者胜
                            winner, loser = (pa, pb) if float(oa.lon) <= float(ob.lon) else (pb, pa)
                        else:
                            la = float(getattr(oa, 'lat', 0.0) or 0.0)
                            lb = float(getattr(ob, 'lat', 0.0) or 0.0)
                            winner, loser = (pa, pb) if la >= lb else (pb, pa)
                        pairs.append({'a': pa, 'aLabel': PLANET_CN.get(pa, pa),
                                      'b': pb, 'bLabel': PLANET_CN.get(pb, pb),
                                      'winner': winner, 'winnerLabel': PLANET_CN.get(winner, winner),
                                      'loser': loser, 'loserLabel': PLANET_CN.get(loser, loser),
                                      'sepDeg': round(sep, 3)})
            return {'available': True, 'pairs': pairs, 'criterion': self.yuddha_criterion}
        except Exception:
            return {'available': False}

    def _d1_planet_signs(self):
        """D1 各曜星座 {planet_id: sign}(供 Sudarshana 等**本命**三盘视图复用,恒 D1)。"""
        out = {}
        for obj_id in JYOTISH_PLANETS:
            obj = safe_get(self.d1_chart, obj_id)
            if obj:
                out[obj_id] = obj.sign
        return out

    def _planet_signs(self):
        """**当前显示盘**各曜星座 {planet_id: sign}(供 Kartari/敌友 等随显示盘变化的格局复用)。"""
        out = {}
        for obj_id in JYOTISH_PLANETS:
            obj = safe_get(self.chart, obj_id)
            if obj:
                out[obj_id] = obj.sign
        return out

    def kartari(self):
        """QW4 Kartari 夹击格局(吉夹 Shubha / 凶夹 Papa):某宫曜被前后相邻宫所夹。**以当前显示盘算**。"""
        try:
            from astrostudy.india.kartari import kartari_yogas
            if not self.asc:
                return {'available': False}
            return kartari_yogas(self._planet_signs(), self.asc.sign)
        except Exception:
            return {'available': False}

    def sudarshana(self):
        """QW4 Sudarshana Chakra 三盘合参(命/日/月分别为上升,同断一事三方印证)。恒 D1。"""
        try:
            from astrostudy.india.sudarshana import sudarshana_chakra
            if not self.d1_asc:
                return {'available': False}
            return sudarshana_chakra(
                self._d1_planet_signs(), self.d1_asc.sign,
                getattr(self.d1_sun, 'sign', None), getattr(self.d1_moon, 'sign', None))
        except Exception:
            return {'available': False}

    def graha_maitri(self):
        """敌友 Pañcadhā Maitrī(复合五分敌友 7×7 矩阵,非对称)+ Jaimini Rāśi Dṛṣṭi 座相(12×12)。
        恒 D1。古籍关系章:自然友敌表 × 临时(2/3/4/10/11/12 宫=友)→ 复合 5 档。
        算法在 primitives(natural/tatkalika/compound_relation),此处只组矩阵。"""
        try:
            from astrostudy.india.primitives import (
                natural_relation, tatkalika_relation, compound_relation, rasi_drishti)
            SEVEN = [const.SUN, const.MOON, const.MARS, const.MERCURY,
                     const.JUPITER, const.VENUS, const.SATURN]
            planet_signs = {}
            for pid in SEVEN:
                o = safe_get(self.chart, pid)
                if o:
                    planet_signs[pid] = o.sign
            planets = [pid for pid in SEVEN if pid in planet_signs]
            if not planets:
                return {'available': False}
            NAT_CN = {'friend': '友', 'neutral': '中', 'enemy': '敌'}
            TAT_CN = {'friend': '临友', 'enemy': '临敌'}
            COMP_CN = {'adhimitra': '大友', 'mitra': '友', 'sama': '中立',
                       'satru': '敌', 'adhisatru': '大敌'}
            matrix = []
            for a in planets:
                cells = []
                for b in planets:
                    if a == b:
                        cells.append({'planet': b, 'planetLabel': PLANET_CN.get(b, b), 'self': True})
                        continue
                    nat = natural_relation(a, b)
                    tat = tatkalika_relation(a, b, planet_signs)
                    comp = compound_relation(a, b, planet_signs)
                    cells.append({
                        'planet': b, 'planetLabel': PLANET_CN.get(b, b),
                        'natural': nat, 'naturalCn': NAT_CN.get(nat, nat),
                        'temporal': tat, 'temporalCn': TAT_CN.get(tat, '—'),
                        'compound': comp, 'compoundCn': COMP_CN.get(comp, '—'),
                    })
                matrix.append({'planet': a, 'planetLabel': PLANET_CN.get(a, a), 'cells': cells})
            # Jaimini Rāśi Dṛṣṭi 座相(每座照见的座) — Jaimini 古法。
            SIGNS = [const.ARIES, const.TAURUS, const.GEMINI, const.CANCER, const.LEO, const.VIRGO,
                     const.LIBRA, const.SCORPIO, const.SAGITTARIUS, const.CAPRICORN, const.AQUARIUS, const.PISCES]
            rasi_matrix = []
            for s in SIGNS:
                try:
                    seen = rasi_drishti(s)
                except Exception:
                    seen = []
                rasi_matrix.append({'sign': s, 'signLabel': SIGN_CN.get(s, s),
                                    'aspects': list(seen),
                                    'aspectLabels': [SIGN_CN.get(x, x) for x in seen]})
            return {
                'available': True,
                'planets': planets,
                'planetLabels': [PLANET_CN.get(p, p) for p in planets],
                'matrix': matrix,
                'legend': [{'key': k, 'label': v} for k, v in
                           [('adhimitra', '大友'), ('mitra', '友'), ('sama', '中立'), ('satru', '敌'), ('adhisatru', '大敌')]],
                'rasiDrishti': rasi_matrix,
            }
        except Exception:
            return {'available': False}

    def outer_planets(self):
        """外行星 Ur/Ne/Pl(虚星,古籍补编)。内核已算,补输出供副星面板;以当前显示盘算。"""
        try:
            out = []
            for pid, label in [(const.URANUS, '天王 Ur'), (const.NEPTUNE, '海王 Ne'), (const.PLUTO, '冥王 Pl')]:
                o = safe_get(self.chart, pid)
                if not o:
                    continue
                nk = nakshatra_from_lon(o.lon)
                out.append({
                    'id': pid, 'label': label,
                    'sign': o.sign, 'signLabel': SIGN_CN.get(o.sign, o.sign),
                    'signlon': round(float(o.signlon), 2),
                    'house': house_number(o),
                    'nakshatra': nk.get('name'), 'pada': nk.get('pada'),
                    'retrograde': getattr(o, 'movedir', None) == 'Retrograde',
                })
            return {'available': bool(out), 'planets': out}
        except Exception:
            return {'available': False}

    def _nak_with_detail(self, lon):
        """nakshatra_from_lon + 合并 27 宿富属性(种姓/活动/方向/三性/动机/五行/阴阳/神人鬼/身体/象征/主神/yoni)。"""
        nk = dict(nakshatra_from_lon(lon))
        try:
            from astrostudy.india.nakshatra_data import nakshatra_detail_from_lon
            nk['detail'] = nakshatra_detail_from_lon(lon)
        except Exception:
            nk['detail'] = None
        # 28 宿口径(G6):纯增量键,显示/择吉专用。27 宿编号与全部 Dasha/Varga 计算不受影响
        # (Abhijit 恒不入 Vimshottari —— 权威口径,与 primitives 注释一致)。
        try:
            from astrostudy.india.primitives import is_abhijit, nakshatra_number_28, ABHIJIT_LABEL
            nk['isAbhijit'] = bool(is_abhijit(lon))
            nk['number28'] = nakshatra_number_28(lon, nk.get('index'))
            if nk['isAbhijit']:
                nk['abhijitLabel'] = ABHIJIT_LABEL
        except Exception:
            nk['isAbhijit'] = False
            nk['number28'] = nk.get('index')
        return nk

    def yogas(self):
        try:
            return build_yogas(self.perchart)
        except Exception as exc:
            return {
                'available': False,
                'error': str(exc),
            }

    def panchanga(self):
        # Panchanga 取真日月经度，恒以 D1 盘为准(分盘不改 tithi/yoga/karana)。
        sun_lon = getattr(self.d1_sun, 'lon', 0)
        moon_lon = getattr(self.d1_moon, 'lon', 0)
        lunar_angle = norm(moon_lon - sun_lon)
        tithi_index = min(29, int(lunar_angle / 12))
        tithi_day = tithi_index + 1
        paksha = 'Shukla' if tithi_day <= 15 else 'Krishna'
        tithi_name_idx = (tithi_day - 1) % 15
        yoga_index = min(26, int(norm(sun_lon + moon_lon) / (360.0 / 27.0)))
        karana_index = min(59, int(lunar_angle / 6))
        vara_index = self.perchart.dateTime.date.dayofweek()
        return {
            'vara': {
                'index': vara_index,
                'name': VARA_NAMES[vara_index],
                'label': VARA_CN[vara_index],
                'lord': dasha_lord(['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'][vara_index]),
            },
            'tithi': {
                'index': tithi_day,
                'name': TITHI_NAMES[tithi_name_idx],
                'paksha': paksha,
                'angle': lunar_angle,
                'progress': (lunar_angle % 12) / 12.0,
            },
            'nakshatra': self._nak_with_detail(moon_lon),
            'yoga': {
                'index': yoga_index + 1,
                'name': YOGA_NAMES[yoga_index],
                'progress': (norm(sun_lon + moon_lon) % (360.0 / 27.0)) / (360.0 / 27.0),
            },
            'karana': self.karana(karana_index),
            'sunrise': self.safe_sunrise(),
        }

    def karana(self, karana_index):
        if karana_index == 0:
            name = 'Kimstughna'
        elif karana_index == 57:
            name = 'Shakuni'
        elif karana_index == 58:
            name = 'Chatushpada'
        elif karana_index == 59:
            name = 'Naga'
        else:
            name = KARANA_SEQUENCE[(karana_index - 1) % len(KARANA_SEQUENCE)]
        return {
            'index': karana_index + 1,
            'name': name,
        }

    def safe_sunrise(self):
        try:
            return self.perchart.getSunRiseTime()['timeStr']
        except Exception:
            return None

    def nakshatras(self):
        result = {}
        for obj_id in JYOTISH_PLANETS:
            obj = safe_get(self.chart, obj_id)
            if obj:
                result[obj_id] = self._nak_with_detail(obj.lon)
        if self.asc:
            result[const.ASC] = self._nak_with_detail(self.asc.lon)
        return result

    def _dasha_seed_lon(self):
        """大运起点黄经:默认 D1 月亮宿(seed='moon');可改取七政/节点/上升/特殊上升/副星(虚点)
        任一点。虚点不可用(极地/求根失败)优雅回退月亮,绝不让大运因起点缺失而 unavailable。"""
        seed = getattr(self, 'dasha_seed', 'moon') or 'moon'
        default_lon = getattr(self.d1_moon, 'lon', None)
        if seed == 'moon':
            return default_lon
        PLANET_SEED = {
            'sun': const.SUN, 'mars': const.MARS, 'mercury': const.MERCURY,
            'jupiter': const.JUPITER, 'venus': const.VENUS, 'saturn': const.SATURN,
            'rahu': const.NORTH_NODE, 'ketu': const.SOUTH_NODE,
        }
        try:
            if seed in ('asc', 'lagna'):
                return getattr(self.d1_asc, 'lon', default_lon)
            if seed in PLANET_SEED:
                o = safe_get(self.d1_chart, PLANET_SEED[seed])
                v = getattr(o, 'lon', None) if o else None
                return v if v is not None else default_lon
            # 虚点:取 upagraha() 输出对应点黄经(特殊上升 / 时基副星 / 日基副星)。
            up = self.upagraha() or {}
            SL_MAP = {'bhavalagna': 'bhavaLagna', 'horalagna': 'horaLagna',
                      'ghatikalagna': 'ghatikaLagna', 'ghatilagna': 'ghatikaLagna',
                      'sreelagna': 'sreeLagna'}
            sl = up.get('specialLagnas') or {}
            if seed in SL_MAP and isinstance(sl.get(SL_MAP[seed]), dict):
                lon = sl[SL_MAP[seed]].get('lon')
                if lon is not None:
                    return lon
            for bucket in ('timeBased', 'sunBased'):
                for it in (up.get(bucket) or []):
                    if isinstance(it, dict) and str(it.get('key', '')).lower() == seed and it.get('lon') is not None:
                        return it['lon']
        except Exception:
            pass
        return default_lon

    def vimshottari(self):
        birth = get_local_birth_datetime(self.perchart)
        moon_lon = self._dasha_seed_lon()  # 大运起点(默认 D1 月宿,可选七政/虚点)
        if birth is None or moon_lon is None:
            return {
                'available': False,
                'reason': 'birth_date_outside_python_datetime_range',
            }

        moon_nak = nakshatra_from_lon(moon_lon)
        lord = dasha_lord(moon_nak['lord'])
        first_balance_years = lord['years'] * moon_nak['remainingRatio']
        first_elapsed_years = lord['years'] - first_balance_years
        cycle_start = birth - timedelta(days=first_elapsed_years * self.dasha_year_days)
        lord_index = [x['key'] for x in DASHA_SEQUENCE].index(lord['key'])
        current_start = cycle_start
        now = datetime.now()
        # 仅当本体系被选中才算三级 antar/pratyantar(下钻);未选中只出 maha 顶层(省体积)。
        full = (self.dasha_system == 'vimshottari')
        items = []
        current = None
        for i in range(10):
            item_lord = DASHA_SEQUENCE[(lord_index + i) % len(DASHA_SEQUENCE)]
            duration_days = item_lord['years'] * self.dasha_year_days
            current_end = current_start + timedelta(days=duration_days)
            is_active = current_start <= now < current_end
            item = {
                'lord': item_lord,
                'years': item_lord['years'],
                'start': format_dt(current_start),
                'end': format_dt(current_end),
                'startIso': current_start.isoformat(),
                'endIso': current_end.isoformat(),
                'startAge': (current_start - birth).total_seconds() / 86400.0 / self.dasha_year_days,
                'endAge': (current_end - birth).total_seconds() / 86400.0 / self.dasha_year_days,
                'birthBalance': i == 0,
                'active': is_active,
            }
            if full:
                # 三级大运(pratyantardasha)全算,使每个大运卡片均可下钻到三级。
                item['antardashas'] = self.dasha_sub_periods(item_lord, current_start, duration_days, 3)
            if is_active:
                current = item
            items.append(item)
            current_start = current_end
        return {
            'available': True,
            'system': 'Vimshottari',
            'yearLengthDays': self.dasha_year_days,
            'moonLongitude': moon_lon,
            'moonNakshatra': moon_nak,
            'firstLord': lord,
            'firstBalanceYears': first_balance_years,
            'firstElapsedYears': first_elapsed_years,
            'cycleStart': format_dt(cycle_start),
            'current': current,
            'mahadashas': items,
        }

    def tribhagi(self):
        """Tribhāgī(三分大运,Vimśottarī ÷3):每曜周期 ÷3,9 曜序绕 3 遍(3×40=120 年,
        对应 Alpa/Madhya/Pūrṇa 短/中/全寿三分)。起运同 Vimśottarī(月宿主),首运余 = 正常 ÷3;
        中运比例尺度不变(AD=MD×AD年/120)。归属 Rath/PVR Rao。零回归:纯新增。"""
        birth = get_local_birth_datetime(self.perchart)
        moon_lon = self._dasha_seed_lon()
        if birth is None or moon_lon is None:
            return {'available': False, 'reason': 'birth_date_outside_python_datetime_range'}
        moon_nak = nakshatra_from_lon(moon_lon)
        lord = dasha_lord(moon_nak['lord'])
        scale = 1.0 / 3.0
        first_balance_years = lord['years'] * scale * moon_nak['remainingRatio']
        first_elapsed_years = lord['years'] * scale - first_balance_years
        cycle_start = birth - timedelta(days=first_elapsed_years * self.dasha_year_days)
        lord_index = [x['key'] for x in DASHA_SEQUENCE].index(lord['key'])
        current_start = cycle_start
        now = datetime.now()
        # 仅当本体系被选中才算三级 antar/pratyantar(下钻);未选中只出 maha 顶层(省体积)。
        full = (self.dasha_system == 'tribhagi')
        items = []
        current = None
        n = len(DASHA_SEQUENCE)
        BHAGA = ['Alpa（短寿分）', 'Madhya（中寿分）', 'Pūrṇa（全寿分）']
        for i in range(3 * n + 1):                    # 3 遍 ×9 = 27,+首余裕度
            item_lord = DASHA_SEQUENCE[(lord_index + i) % n]
            years = item_lord['years'] * scale
            duration_days = years * self.dasha_year_days
            current_end = current_start + timedelta(days=duration_days)
            is_active = current_start <= now < current_end
            item = {
                'lord': item_lord, 'years': years,
                'start': format_dt(current_start), 'end': format_dt(current_end),
                'startIso': current_start.isoformat(), 'endIso': current_end.isoformat(),
                'startAge': (current_start - birth).total_seconds() / 86400.0 / self.dasha_year_days,
                'endAge': (current_end - birth).total_seconds() / 86400.0 / self.dasha_year_days,
                'birthBalance': i == 0, 'active': is_active,
                'bhaga': BHAGA[min(2, i // n)],
            }
            if full:
                item['antardashas'] = self.dasha_sub_periods(item_lord, current_start, duration_days, 3)
            if is_active:
                current = item
            items.append(item)
            current_start = current_end
        return {
            'available': True, 'system': 'Tribhagi', 'yearLengthDays': self.dasha_year_days,
            'totalYears': 120, 'bhagaYears': 40,
            'moonLongitude': moon_lon, 'moonNakshatra': moon_nak, 'firstLord': lord,
            'firstBalanceYears': first_balance_years, 'firstElapsedYears': first_elapsed_years,
            'cycleStart': format_dt(cycle_start), 'current': current, 'mahadashas': items,
            'note': 'Vimśottarī ÷3,9 曜序绕 3 遍=120 年(Alpa/Madhya/Pūrṇa 三分寿)。',
        }

    # AKKG「所主之座」表(双主曜数向近者取;罗=水瓶/计=天蝎共主口径)。
    _AKKG_OWN = {
        const.SUN: (const.LEO,), const.MOON: (const.CANCER,),
        const.MARS: (const.ARIES, const.SCORPIO), const.MERCURY: (const.GEMINI, const.VIRGO),
        const.JUPITER: (const.SAGITTARIUS, const.PISCES), const.VENUS: (const.TAURUS, const.LIBRA),
        const.SATURN: (const.CAPRICORN, const.AQUARIUS),
        const.NORTH_NODE: (const.AQUARIUS,), const.SOUTH_NODE: (const.SCORPIO,),
    }

    def _kendradi_graha_order(self, ref_sign):
        """自 ref_sign 起 kendra(1/4/7/10)→panaphara→apoklima 的 9 曜强度序
        (组内旺庙>平>弱、再度数高;与 Mula 同判;ref 奇象先 panaphara、偶象先 apoklima)。"""
        SIGN_IDX = {sg: i for i, sg in enumerate(const.LIST_SIGNS)}
        ref_idx = SIGN_IDX[ref_sign]
        ents = []
        for pid in [const.SUN, const.MOON, const.MARS, const.MERCURY, const.JUPITER,
                    const.VENUS, const.SATURN, const.NORTH_NODE, const.SOUTH_NODE]:
            obj = safe_get(self.chart, pid)
            if not obj:
                continue
            si = SIGN_IDX[obj.sign]
            house = ((si - ref_idx) % 12) + 1
            try:
                dig = self.dignity(pid, obj.sign, obj.signlon)
            except Exception:
                dig = 'neutral'
            ents.append({'planet': pid, 'sign': obj.sign, 'house': house, 'dignity': dig,
                         'signlon': float(obj.signlon)})
        KEN, PAN, APO = {1, 4, 7, 10}, {2, 5, 8, 11}, {3, 6, 9, 12}
        ref_odd = ref_sign in {const.ARIES, const.GEMINI, const.LEO, const.LIBRA,
                               const.SAGITTARIUS, const.AQUARIUS}
        groups = [KEN, PAN, APO] if ref_odd else [KEN, APO, PAN]
        DIG_RANK = {'deep_exaltation': 5, 'exaltation': 5, 'moolatrikona': 4,
                    'own_sign': 3, 'neutral': 2, 'debilitation': 1}
        ordered = []
        for g in groups:
            ordered.extend(sorted([x for x in ents if x['house'] in g],
                                  key=lambda en: (-DIG_RANK.get(en['dignity'], 2), -en['signlon'])))
        return ordered

    def tara_dasha(self):
        """Tara 大运(graha):期长 = Vimshottari 年表;排序 = 自 Lagna 的 kendra 行星(按强)
        →panaphara→apoklima;适用 = 至少一行星在 kendra;首运余额 = 起始行星自身宿未行比
        × 首运年;中运同 Vimshottari 比例(序用本强度环)。勿混座基 Tara Lagna(9 年/座)。"""
        from datetime import timedelta
        try:
            if not self.asc:
                return {'available': False, 'reason': 'missing_lagna'}
            birth = get_local_birth_datetime(self.perchart)
            if birth is None:
                return {'available': False, 'reason': 'birth_date_outside_python_datetime_range'}
            ordered = self._kendradi_graha_order(self.asc.sign)
            if not ordered:
                return {'available': False, 'reason': 'missing_planets'}
            kendra_occupied = any(x['house'] in (1, 4, 7, 10) for x in ordered)
            seq = []
            for x in ordered:
                pid = x['planet']
                row = next((d for d in DASHA_SEQUENCE if d['id'] == pid), None)
                if row:
                    seq.append(dict(row))
            if not seq:
                return {'available': False, 'reason': 'missing_planets'}
            first = seq[0]
            # 大运种子恒 D1(与同块 vimshottari/yogini 的 _dasha_seed_lon 同基准;曾用当前分盘 → 漂移)
            first_obj = safe_get(self.d1_chart, first['id'])
            nak = nakshatra_from_lon(float(first_obj.lon)) if first_obj else None
            remaining = float(nak['remainingRatio']) if nak else 1.0
            res = self._build_periods(seq, 120, first['key'], remaining, birth,
                                      full=False)
            res.update({
                'available': True,
                'system': 'TaraDasha',
                'label': 'Tara 大运(kendra 强度序 · Vimshottari 年表)',
                'applicable': bool(kendra_occupied),
                'applicabilityNote': '至少一行星在 kendra 时适用' if kendra_occupied
                                     else 'kendra 无行星:条件未满足(仍可备览)',
                'totalYears': 120,
                'yearLengthDays': self.dasha_year_days,
                'orderPlanets': [x['planet'] for x in ordered],
                'seedNakshatra': nak,
                'firstLord': first,
            })
            return res
        except Exception:
            return {'available': False, 'reason': 'tara_dasha_failed'}

    def akkg_dasha(self):
        """AKKG(Karaka Kendradi Graha)大运:自 Atmakaraka 所在座起 kendra→panaphara→apoklima
        强度序;期长 = (沿数向数到其所主之座 − 1),自座 = 12,庙旺 +1/落陷 −1,钳 1-12;
        二轮 = 12 − 首轮。双主曜取沿数向较近之主座(口径注明);数向按曜所在座足性(同 Mula)。"""
        from datetime import timedelta
        try:
            birth = get_local_birth_datetime(self.perchart)
            if birth is None:
                return {'available': False, 'reason': 'birth_date_outside_python_datetime_range'}
            _ak_lons = {}
            for _pid in KARAKA_PLANETS:
                _o = safe_get(self.d1_chart, _pid)   # Chara Karaka 是本命(D1)量
                if _o:
                    _ak_lons[_pid] = _o.lon
            karakas = chara_karakas(_ak_lons, scheme=self.karaka_scheme)
            ak_row = karakas[0] if karakas else None
            ak_id = ak_row.get('planet') if isinstance(ak_row, dict) else None
            ak_obj = safe_get(self.d1_chart, ak_id) if ak_id else None
            if not ak_obj:
                return {'available': False, 'reason': 'missing_atmakaraka'}
            SIGN_IDX = {sg: i for i, sg in enumerate(const.LIST_SIGNS)}
            ordered = self._kendradi_graha_order(ak_obj.sign)
            CN = {const.SUN: '日', const.MOON: '月', const.MARS: '火', const.MERCURY: '水',
                  const.JUPITER: '木', const.VENUS: '金', const.SATURN: '土',
                  const.NORTH_NODE: '罗', const.SOUTH_NODE: '计'}
            maha = []
            firsts = []
            for x in ordered:
                pid = x['planet']
                si = SIGN_IDX[x['sign']]
                fwd = x['sign'] in _ODD_FOOTED_SIGNS
                best = None
                for own in self._AKKG_OWN.get(pid, ()):
                    oi = SIGN_IDX[own]
                    n = ((oi - si) % 12) + 1 if fwd else ((si - oi) % 12) + 1
                    if best is None or n < best:
                        best = n
                n = best if best is not None else 1
                yrs = 12 if n == 1 else (n - 1)
                dig = x['dignity']
                if dig in ('exaltation', 'deep_exaltation'):
                    yrs += 1
                elif dig == 'debilitation':
                    yrs -= 1
                yrs = max(1, min(12, yrs))
                firsts.append({'planet': pid, 'planetCN': CN[pid], 'sign': x['sign'],
                               'house': x['house'], 'years': yrs, 'count': n, 'dignity': dig})
            YEAR = self.dasha_year_days
            cum = 0.0
            for cycle in (1, 2):
                for f in firsts:
                    yrs = f['years'] if cycle == 1 else (12 if f['years'] == 12 else 12 - f['years'])
                    try:
                        sdt = birth + timedelta(days=cum * YEAR)
                        edt = birth + timedelta(days=(cum + yrs) * YEAR)
                        sd, ed = sdt.strftime('%Y-%m-%d'), edt.strftime('%Y-%m-%d')
                    except Exception:
                        sd = ed = None
                    maha.append(dict(f, years=yrs, cycle=cycle, start=sd, end=ed,
                                     startAge=round(cum, 2), endAge=round(cum + yrs, 2)))
                    cum += yrs
            return {
                'available': True,
                'system': 'AKKG',
                'label': 'Karaka Kendradi Graha(AK 播种)',
                'atmakaraka': ak_id,
                'seedSign': ak_obj.sign,
                'yearLengthDays': YEAR,
                'mahadashas': maha,
                'note': '年=(数到所主之座−1)·自座12·庙旺±1·钳1-12;二轮=12−首轮(12 仍 12);双主取沿数向近者',
            }
        except Exception:
            return {'available': False, 'reason': 'akkg_failed'}

    def mula_dasha(self):
        """Mūla(=Lagna Kendrādi Graha)大运。期长:N=曜数到其本三角座(奇足座顺/偶足座逆,含端);
        Reduction=(N−1)+E(庙旺+1/落陷−1);Mūla 年=Vimśottarī 年−Reduction(0→满,负→绝对值)。
        序:最强被占 kendra(1/4/7/10)起 → panaphara/apoklima(Lagna 奇先 panaphara、偶先 apoklima);
        组内强者先(旺>庙>平>弱,再度数高)。二轮补足 120(各曜 Vimśottarī−首轮)。归属 Rath/Sārāvalī。"""
        try:
            from datetime import timedelta
            if not self.asc:
                return {'available': False, 'reason': 'missing_lagna'}
            birth = get_local_birth_datetime(self.perchart)
            lagna = self.asc.sign
            SIGN_IDX = {s: i for i, s in enumerate(const.LIST_SIGNS)}
            lagna_idx = SIGN_IDX[lagna]
            CN = {const.SUN: '日', const.MOON: '月', const.MARS: '火', const.MERCURY: '水',
                  const.JUPITER: '木', const.VENUS: '金', const.SATURN: '土',
                  const.NORTH_NODE: '罗', const.SOUTH_NODE: '计'}
            ents = []
            for pid in [const.SUN, const.MOON, const.MARS, const.MERCURY, const.JUPITER,
                        const.VENUS, const.SATURN, const.NORTH_NODE, const.SOUTH_NODE]:
                obj = safe_get(self.d1_chart, pid)   # Mūla 座位判据恒 D1(与兄弟系同基准)
                if not obj:
                    continue
                si = SIGN_IDX[obj.sign]
                mi = SIGN_IDX[MULA_MT_SIGN[pid]]
                n = ((mi - si) % 12) + 1 if obj.sign in _ODD_FOOTED_SIGNS else ((si - mi) % 12) + 1
                try:
                    dig = self.dignity(pid, obj.sign, obj.signlon)
                except Exception:
                    dig = 'neutral'
                e = 1 if dig in ('exaltation', 'deep_exaltation') else (-1 if dig == 'debilitation' else 0)
                yrs = MULA_VIMS_YEARS[pid] - ((n - 1) + e)
                yrs = MULA_VIMS_YEARS[pid] if yrs == 0 else (abs(yrs) if yrs < 0 else yrs)
                house = ((si - lagna_idx) % 12) + 1
                ents.append({'planet': pid, 'planetCN': CN[pid], 'sign': obj.sign,
                             'signLabel': SIGN_CN.get(obj.sign, obj.sign), 'house': house,
                             'years': yrs, 'count': n, 'adjust': e, 'dignity': dig,
                             'signlon': float(obj.signlon)})
            KEN, PAN, APO = {1, 4, 7, 10}, {2, 5, 8, 11}, {3, 6, 9, 12}
            lagna_odd = lagna in {const.ARIES, const.GEMINI, const.LEO, const.LIBRA, const.SAGITTARIUS, const.AQUARIUS}
            groups = [KEN, PAN, APO] if lagna_odd else [KEN, APO, PAN]
            DIG_RANK = {'deep_exaltation': 5, 'exaltation': 5, 'moolatrikona': 4,
                        'own_sign': 3, 'neutral': 2, 'debilitation': 1}
            ordered = []
            for g in groups:
                ordered.extend(sorted([e for e in ents if e['house'] in g],
                                      key=lambda en: (-DIG_RANK.get(en['dignity'], 2), -en['signlon'])))
            maha = []
            cum = [0.0]
            YEAR = self.dasha_year_days

            def _emit(items, rnd, yfn):
                for en in items:
                    y = yfn(en)
                    if birth is not None:
                        try:
                            s = (birth + timedelta(days=cum[0] * YEAR)).strftime('%Y-%m-%d')
                            e2 = (birth + timedelta(days=(cum[0] + y) * YEAR)).strftime('%Y-%m-%d')
                        except Exception:
                            s = e2 = None
                    else:
                        s = e2 = None
                    maha.append({'planet': en['planet'], 'planetCN': en['planetCN'],
                                 'sign': en['sign'], 'signLabel': en['signLabel'], 'house': en['house'],
                                 'years': round(y, 3), 'round': rnd, 'start': s, 'end': e2})
                    cum[0] += y
            _emit(ordered, 1, lambda en: en['years'])
            _emit(ordered, 2, lambda en: max(0.0, MULA_VIMS_YEARS[en['planet']] - en['years']))
            return {'available': True, 'system': 'Mula', 'totalYears': 120, 'lagna': lagna,
                    'order': [e['planetCN'] for e in ordered], 'mahadashas': maha,
                    'note': 'Mūla=Lagna Kendrādi Graha;期长由数到本三角座±庙旺得;二轮补足 120(Sārāvalī 系)。'}
        except Exception as exc:
            return {'available': False, 'reason': str(exc)}

    def sudarshana_chakra_dasha(self):
        """Sudarśana Chakra 大运(BPHS76):每宫 1 太阳年、12 年循环;三同心轮自 太阳(SL 灵)/月(CL 心)/
        上升(JL 身)并行,各每年顺行 1 宫。第 n 年活跃宫=((n−1)%12)+1,三处并读(全 3 合→最强)。
        固定-Lagna 标准式(近 Hellenistic Annual Profections)。"""
        try:
            # 三轮起点恒 D1(日/月/上升皆本命量;曾用当前分盘 → 切分盘时三轮整体漂移)
            if not (self.d1_sun and self.d1_moon and self.d1_asc):
                return {'available': False, 'reason': 'missing_sun_moon_or_lagna'}
            SIGN_IDX = {s: i for i, s in enumerate(const.LIST_SIGNS)}
            sun_i = SIGN_IDX[self.d1_sun.sign]
            moon_i = SIGN_IDX[self.d1_moon.sign]
            lag_i = SIGN_IDX[self.d1_asc.sign]
            cur_year = None
            birth = get_local_birth_datetime(self.perchart)
            if birth is not None:
                try:
                    age = (datetime.now() - birth).total_seconds() / 86400.0 / self.dasha_year_days
                    cur_year = (int(age) % 12) + 1
                except Exception:
                    cur_year = None
            rows = []
            for n in range(1, 13):
                h = (n - 1) % 12
                sl = const.LIST_SIGNS[(sun_i + h) % 12]
                cl = const.LIST_SIGNS[(moon_i + h) % 12]
                jl = const.LIST_SIGNS[(lag_i + h) % 12]
                rows.append({
                    'year': n,
                    'sl': sl, 'slLabel': SIGN_CN.get(sl, sl),
                    'cl': cl, 'clLabel': SIGN_CN.get(cl, cl),
                    'jl': jl, 'jlLabel': SIGN_CN.get(jl, jl),
                    'current': (n == cur_year),
                })
            return {
                'available': True, 'system': 'SudarshanaChakra', 'cycleYears': 12,
                'currentYear': cur_year, 'rows': rows,
                'wheels': {'SL': '太阳(灵)', 'CL': '月(心)', 'JL': '上升(身)'},
                'note': '每宫 1 太阳年、12 年循环;三轮(日 SL/月 CL/升 JL)并读,全 3 合→最强。固定-Lagna 标准式。',
            }
        except Exception as exc:
            return {'available': False, 'reason': str(exc)}

    def dasha_sub_periods(self, parent_lord, start, parent_days, max_depth):
        result = []
        lord_index = [x['key'] for x in DASHA_SEQUENCE].index(parent_lord['key'])
        current_start = start
        for i in range(len(DASHA_SEQUENCE)):
            sub_lord = DASHA_SEQUENCE[(lord_index + i) % len(DASHA_SEQUENCE)]
            sub_days = parent_days * sub_lord['years'] / 120.0
            end = current_start + timedelta(days=sub_days)
            item = {
                'lord': sub_lord,
                'start': format_dt(current_start),
                'end': format_dt(end),
                'years': sub_days / self.dasha_year_days,
            }
            if max_depth > 2:
                item['pratyantardashas'] = self.dasha_sub_periods(sub_lord, current_start, sub_days, max_depth - 1)
            result.append(item)
            current_start = end
        return result

    def _sub_periods_generic(self, sequence, total_years, parent, start, parent_days, max_depth, start_offset=0):
        """通用子周期(antardasha/pratyantardasha):按所选大运体系的 sequence + total_years 比例细分。
        start_offset：子运起序偏移。Vim/Yogini=0(从本曜起);Ashtottari=1(B3:从下一曜起、末位本曜)。"""
        keys = [x['key'] for x in sequence]
        idx = keys.index(parent['key'])
        cur = start
        out = []
        for j in range(len(sequence)):
            sub = sequence[(idx + start_offset + j) % len(sequence)]
            sub_days = parent_days * sub['years'] / float(total_years)
            end = cur + timedelta(days=sub_days)
            item = {
                'lord': sub,
                'start': format_dt(cur),
                'end': format_dt(end),
                'years': sub_days / self.dasha_year_days,
            }
            if max_depth > 2:
                item['pratyantardashas'] = self._sub_periods_generic(sequence, total_years, sub, cur, sub_days, max_depth - 1, start_offset)
            out.append(item)
            cur = end
        return out

    def _build_periods(self, sequence, total_years, start_key, remaining_ratio, birth, start_offset=0, full=True):
        """通用大运表(Yogini/Ashtottari 共用,与 vimshottari 同口径):起始曜+月宿余比 → 主运序列 + 子周期。
        覆盖 120 年(含多轮循环,如 Yogini 36 年需 ~3 轮);full=True 时三级 pratyantardasha 对所有主运全算(均可下钻),
        full=False 时只出 maha 顶层(省 antar/pratyantar 体积,未选中体系用)。maha 层两者字节一致。
        start_offset 透传给子周期(Ashtottari=1，子运从下一曜起)。"""
        keys = [x['key'] for x in sequence]
        start_idx = keys.index(start_key)
        start_item = sequence[start_idx]
        first_balance = start_item['years'] * remaining_ratio
        first_elapsed = start_item['years'] - first_balance
        cycle_start = birth - timedelta(days=first_elapsed * self.dasha_year_days)
        now = datetime.now()
        horizon = birth + timedelta(days=120 * self.dasha_year_days)
        cur = cycle_start
        items = []
        current = None
        i = 0
        while cur < horizon and i < 60:
            it = sequence[(start_idx + i) % len(sequence)]
            duration_days = it['years'] * self.dasha_year_days
            end = cur + timedelta(days=duration_days)
            is_active = cur <= now < end
            item = {
                'lord': it,
                'years': it['years'],
                'start': format_dt(cur),
                'end': format_dt(end),
                'startIso': cur.isoformat(),
                'endIso': end.isoformat(),
                'startAge': (cur - birth).total_seconds() / 86400.0 / self.dasha_year_days,
                'endAge': (end - birth).total_seconds() / 86400.0 / self.dasha_year_days,
                'birthBalance': i == 0,
                'active': is_active,
            }
            if full:
                item['antardashas'] = self._sub_periods_generic(sequence, total_years, it, cur, duration_days, 3, start_offset)
            if is_active:
                current = item
            items.append(item)
            cur = end
            i += 1
        return {
            'cycleStart': format_dt(cycle_start),
            'firstBalanceYears': first_balance,
            'firstElapsedYears': first_elapsed,
            'current': current,
            'mahadashas': items,
        }

    def yogini(self):
        birth = get_local_birth_datetime(self.perchart)
        moon_lon = self._dasha_seed_lon()  # 大运起点(默认 D1 月宿,可选七政/虚点)
        if birth is None or moon_lon is None:
            return {'available': False, 'reason': 'birth_date_outside_python_datetime_range'}
        nak = nakshatra_from_lon(moon_lon)
        # 起始女神:(月宿序 + 3) mod 8(0→8 Sankata)。
        r = (nak['index'] + 3) % 8
        r = 8 if r == 0 else r
        start = YOGINI_SEQUENCE[r - 1]
        res = self._build_periods(YOGINI_SEQUENCE, YOGINI_TOTAL, start['key'], nak['remainingRatio'], birth,
                                  full=(self.dasha_system == 'yogini'))
        res.update({
            'available': True,
            'system': 'Yogini',
            'totalYears': YOGINI_TOTAL,
            'yearLengthDays': self.dasha_year_days,
            'moonLongitude': moon_lon,
            'moonNakshatra': nak,
            'firstYogini': start,
            'firstLord': start,
        })
        return res

    def ashtottari(self):
        birth = get_local_birth_datetime(self.perchart)
        moon_lon = self._dasha_seed_lon()  # 大运起点(默认 D1 月宿,可选七政/虚点)
        if birth is None or moon_lon is None:
            return {'available': False, 'reason': 'birth_date_outside_python_datetime_range'}
        nak = nakshatra_from_lon(moon_lon)
        # 子型:Ardradi(默认=现状)/Krittikadi/依 Rahu 位自动(Rahu 自 Lagna 座距 5/9=trikona→Krittikadi,
        # 否则(含 kendra 与其余)→Ardradi;古典另有「从 Lagna 主起算」口径,此处按自 Lagna,注释存档)。
        reckoning = self.dasha_variants.get('ashtottariReckoning', 'ardradi')
        if reckoning == 'auto_by_rahu':
            reckoning = 'ardradi'
            try:
                rahu = safe_get(self.d1_chart, const.NORTH_NODE)
                if rahu is not None and self.d1_asc is not None:
                    dist = (const.LIST_SIGNS.index(rahu.sign) - const.LIST_SIGNS.index(self.d1_asc.sign)) % 12 + 1
                    if dist in (5, 9):
                        reckoning = 'krittikadi'
            except (ValueError, AttributeError, TypeError):
                pass
        krittikadi = (reckoning == 'krittikadi')
        nak_table = ASHTOTTARI_NAK_LORD_KRITTIKADI if krittikadi else ASHTOTTARI_NAK_LORD
        arc_table = ASHTOTTARI_ARC_KRITTIKADI if krittikadi else ASHTOTTARI_ARC
        lord_key = nak_table[(nak['index'] - 1) % 27]
        start = next(x for x in ASHTOTTARI_SEQUENCE if x['key'] == lord_key)
        arc_remaining = ashtottari_arc_remaining(lord_key, moon_lon, arc_table)  # 月在所辖弧的剩余比(非单宿)
        res = self._build_periods(
            ASHTOTTARI_SEQUENCE, ASHTOTTARI_TOTAL, lord_key, arc_remaining, birth, start_offset=1,
            full=(self.dasha_system == 'ashtottari'),
        )  # 子运从下一曜起、末位本曜
        res.update({
            'available': True,
            'system': 'Ashtottari',
            'reckoning': 'Krittikadi' if krittikadi else 'Ardradi',
            'totalYears': ASHTOTTARI_TOTAL,
            'yearLengthDays': self.dasha_year_days,
            'moonLongitude': moon_lon,
            'moonNakshatra': nak,
            'firstLord': start,
        })
        return res

    def naisargika_dasha(self):
        """Naisargika(自然/生命阶段)大运:7 曜固定自然年(总 120)。默认 Varahamihira 成熟序
        (月→火→水→金→木→日→土,年龄段几乎通行)。逐运给年龄段 + 由本命起算的日历起讫;
        子运(antardasha)按 drishti 权重(Sārāvalī/Rath),专门且少实现,暂不出。零回归:纯新增。"""
        from datetime import timedelta
        birth = get_local_birth_datetime(self.perchart)
        if birth is None:
            return {'available': False, 'reason': 'birth_date_outside_python_datetime_range'}
        YEAR = self.dasha_year_days
        # 排序变体(#排序分歧):固定自然序(默认,成长-衰老序,年龄档通行) vs
        # kendra 强度序(BPHS 原则:自月亮起,余曜按自 Lagna 的 kendra→panaphara→apoklima
        # 组序、组内按宫距升序;年数不变只换排序)。
        order_mode = self.dasha_variants.get('naisargikaOrder', 'fixed_natural')
        order_rows = list(NAISARGIKA_ORDER)
        if order_mode == 'kendra_strength' and self.d1_asc is not None:
            try:
                lag_i = const.LIST_SIGNS.index(self.d1_asc.sign)
                def _grp_rank(pid):
                    o = safe_get(self.d1_chart, pid)
                    if not o:
                        return (3, 99)
                    dist = (const.LIST_SIGNS.index(o.sign) - lag_i) % 12 + 1
                    grp = 0 if dist in (1, 4, 7, 10) else (1 if dist in (2, 5, 8, 11) else 2)
                    return (grp, dist)
                moon_row = [r for r in order_rows if r[0] == const.MOON]
                rest = [r for r in order_rows if r[0] != const.MOON]
                rest.sort(key=lambda r: _grp_rank(r[0]))
                order_rows = moon_row + rest
            except (ValueError, AttributeError, TypeError):
                order_rows = list(NAISARGIKA_ORDER)
        periods = []
        cum = 0
        for pid, cn, yrs in order_rows:
            try:
                s = birth + timedelta(days=cum * YEAR)
                e = birth + timedelta(days=(cum + yrs) * YEAR)
                sd, ed = s.strftime('%Y-%m-%d'), e.strftime('%Y-%m-%d')
            except Exception:
                sd = ed = None
            periods.append({
                'planet': pid, 'planetCN': cn, 'years': yrs,
                'startAge': cum, 'endAge': cum + yrs, 'start': sd, 'end': ed,
            })
            cum += yrs
        return {
            'available': True, 'mode': 'varahamihira', 'totalYears': 120,
            'orderMode': order_mode,
            'note': ('Varahamihira 成熟序(月→火→水→金→木→日→土);年龄段通行'
                     if order_mode == 'fixed_natural'
                     else 'kendra 强度序(自月亮起,余曜按 kendra→panaphara→apoklima·组内宫距升序;年数不变)'),
            'antardashaNote': '中运按相位加权(对望 1/7·四八位 1/4·强相更高),完整权值表待原典,暂不输出',
            'periods': periods,
        }

    def graha_drishti(self):
        aspects = {
            const.SUN: [7],
            const.MOON: [7],
            const.MARS: [4, 7, 8],
            const.MERCURY: [7],
            const.JUPITER: [5, 7, 9],
            const.VENUS: [7],
            const.SATURN: [3, 7, 10],
            const.NORTH_NODE: [5, 7, 9],
            const.SOUTH_NODE: [5, 7, 9],
        }
        sign_map = self.planet_sign_map()
        result = []
        for giver, houses in aspects.items():
            if giver not in sign_map:
                continue
            giver_sign = sign_map[giver]
            for offset in houses:
                target_sign = (giver_sign + offset - 1) % 12
                receives = [
                    obj_id for obj_id, obj_sign in sign_map.items()
                    if obj_id != giver and obj_sign == target_sign
                ]
                result.append({
                    'giver': giver,
                    'giverLabel': PLANET_CN.get(giver, giver),
                    'aspectHouse': offset,
                    'targetSign': const.LIST_SIGNS[target_sign],
                    'targetSignLabel': SIGN_CN.get(const.LIST_SIGNS[target_sign], const.LIST_SIGNS[target_sign]),
                    'receives': receives,
                })
        return result

    def node_rasi_drishti(self):
        # 节点(罗/计)只取 rasi drishti「主照」，无 graha drishti，与 grahaDrishti 分列。
        # grahaDrishti 里节点仍保留 [5,7,9](零回归);此处另给 rasi drishti 并标注「主照」。
        from astrostudy.india.primitives import rasi_drishti as prim_rasi_drishti
        sign_map = self.planet_sign_map()  # {obj_id: 0-11}
        idx_of = {const.LIST_SIGNS[i]: i for i in range(12)}
        out = []
        for node in (const.NORTH_NODE, const.SOUTH_NODE):
            if node not in sign_map:
                continue
            node_sign = const.LIST_SIGNS[sign_map[node]]
            for tgt_sign in prim_rasi_drishti(node_sign):
                tgt_idx = idx_of[tgt_sign]
                receives = [oid for oid, s in sign_map.items() if oid != node and s == tgt_idx]
                out.append({
                    'giver': node,
                    'giverLabel': PLANET_CN.get(node, node),
                    'kind': 'rasiDrishti',
                    'note': '节点主照(rasi drishti)',
                    'targetSign': tgt_sign,
                    'targetSignLabel': SIGN_CN.get(tgt_sign, tgt_sign),
                    'receives': receives,
                })
        return out

    def planet_sign_map(self):
        result = {}
        for obj_id in JYOTISH_PLANETS:
            obj = safe_get(self.chart, obj_id)
            if obj:
                result[obj_id] = sign_index_from_lon(obj.lon)
        return result

    def ashtakavarga(self):
        sign_names = const.LIST_SIGNS
        natal = {}
        for obj_id in [const.SUN, const.MOON, const.MARS, const.MERCURY, const.JUPITER, const.VENUS, const.SATURN]:
            obj = safe_get(self.chart, obj_id)
            if obj:
                natal[obj_id] = sign_index_from_lon(obj.lon)
        if self.asc:
            natal['Lagna'] = sign_index_from_lon(self.asc.lon)
        if len(natal) < 8:
            return {'available': False, 'reason': 'missing_planets'}

        bhinna = {}
        for target, table in BENEFIC_HOUSES.items():
            values = {sign: 0 for sign in sign_names}
            for contributor, houses in table.items():
                source_key = contributor if contributor == 'Lagna' else contributor
                if source_key not in natal:
                    continue
                source_sign = natal[source_key]
                for house in houses:
                    sign = sign_names[(source_sign + house - 1) % 12]
                    values[sign] += 1
            bhinna[target] = values

        sarva = {sign: 0 for sign in sign_names}
        for values in bhinna.values():
            for sign, count in values.items():
                sarva[sign] += count

        # Trikona + Ekadhipatya Sodhana(化减)：各曜 BAV 化减。occupied = 七曜所居星座。
        sodhana_bhinna = {}
        try:
            from astrostudy.india.shadbala_bphs import sodhana as _sodhana
            occupied = sorted({
                natal[p] for p in  # natal[p] 已是星座索引 0-11
                [const.SUN, const.MOON, const.MARS, const.MERCURY, const.JUPITER, const.VENUS, const.SATURN]
                if p in natal
            })
            for target, values in bhinna.items():
                sodhana_bhinna[target] = _sodhana(values, occupied)
        except Exception:
            sodhana_bhinna = {}

        # Kakshya(分区)展开:每曜 BAV 按 8 主管(KAKSHYA_LORDS)逐座是否贡献 bindu(prastara)。
        # 过运判据:行星落某座第 k 段(3°45′),若该段主管对其在该座贡献 bindu 则吉。零回归:新增键。
        kakshya = {}
        try:
            for target in BENEFIC_HOUSES:
                if target == 'Lagna':
                    continue
                grid = []
                for sidx in range(12):
                    cells = []
                    for lord in KAKSHYA_LORDS:
                        houses = BENEFIC_HOUSES[target].get(lord, [])
                        if lord in natal and (((sidx - natal[lord]) % 12) + 1) in houses:
                            cells.append(1)
                        else:
                            cells.append(0)
                    grid.append(cells)
                kakshya[target] = grid
        except Exception:
            kakshya = {}

        # Sodhya Pinda:对削减后(sodhana)BAV 求 RasiPinda + GrahaPinda(P0-6)。
        sodhya_pinda = {}
        try:
            occupants = [p for p in [const.SUN, const.MOON, const.MARS, const.MERCURY,
                                     const.JUPITER, const.VENUS, const.SATURN] if p in natal]
            for target, reduced in sodhana_bhinna.items():
                if target == 'Lagna' or not isinstance(reduced, (list, tuple)) or len(reduced) < 12:
                    continue
                rasi_pinda = sum(reduced[i] * RASI_GUNAKARA[i] for i in range(12))
                graha_pinda = sum(reduced[natal[q]] * GRAHA_GUNAKARA.get(q, 0)
                                  for q in occupants)
                sodhya_pinda[target] = {
                    'rasiPinda': rasi_pinda,
                    'grahaPinda': graha_pinda,
                    'total': rasi_pinda + graha_pinda,
                }
        except Exception:
            sodhya_pinda = {}

        return {
            'available': True,
            'bhinna': bhinna,
            'sodhana': sodhana_bhinna,
            'sarva': sarva,
            'sarvaBySign': [
                {
                    'sign': sign,
                    'label': SIGN_CN.get(sign, sign),
                    'bindu': sarva[sign],
                }
                for sign in sign_names
            ],
            'kakshya': kakshya,
            'kakshyaLords': KAKSHYA_LORDS,
            'sodhyaPinda': sodhya_pinda,
        }

    def _sayanadi_ghati(self):
        """G：日出后的 ghati 序(1 ghati=24 分；日出起第 G 个 24 分段)。

        复用 upagraha()/_time_based_upagrahas() 的日出口径(eph.lastSunrise)。
        日出不定(极地等)或求根失败 → None（则 sayanadi 优雅降级为 None）。
        """
        try:
            jd = self.d1_perchart.dateTime.jd
            lat = self.d1_perchart.pos.lat
            lon = self.d1_perchart.pos.lon
            sunrise_jd = eph.lastSunrise(jd, lat, lon)
            elapsed_minutes = (jd - sunrise_jd) * 1440.0
            return int(elapsed_minutes // 24.0) + 1
        except Exception:
            return None

    def strengths(self):
        from astrostudy.india.primitives import is_combust, baladi_avastha, is_vargottama
        from astrostudy.india.avastha import (
            jagradadi_avastha, deeptadi_avastha, sayanadi_avastha,
            naisargika_karaka_table, sthira_karaka, lajjitadi_avastha)
        sun_lon = getattr(self.sun, 'lon', None)
        # Sayanadi 公共项(全曜共用)：M 月宿序、G 出生 ghati、L 上升星座序。恒以 D1 月/上升。
        sayanadi_moon_nak = nakshatra_from_lon(self.d1_moon.lon)['index'] if self.d1_moon else None
        sayanadi_ghati = self._sayanadi_ghati()
        sayanadi_lagna_sign = (
            const.LIST_SIGNS.index(self.d1_asc.sign) + 1 if self.d1_asc else None)
        navamsa_step = 30.0 / 9.0  # 每 navamsa 3°20′
        # Lajjitādi 前置:全曜星座 + 被自然凶曜(日火土罗计)相照的星座集(用各凶曜特殊相)。
        _SIGN_IDX = {s: i for i, s in enumerate(const.LIST_SIGNS)}
        _MALEFIC_ASP = {const.SUN: [7], const.MARS: [4, 7, 8], const.SATURN: [3, 7, 10],
                        const.NORTH_NODE: [5, 7, 9], const.SOUTH_NODE: [5, 7, 9]}
        _all_signs = {}
        for _pid in JYOTISH_PLANETS:
            _o = safe_get(self.chart, _pid)
            if _o:
                _all_signs[_pid] = _o.sign
        _malefic_aspected = set()
        for _mp, _offs in _MALEFIC_ASP.items():
            _ms = _all_signs.get(_mp)
            if _ms is None:
                continue
            _mi = _SIGN_IDX[_ms]
            for _off in _offs:
                _malefic_aspected.add((_mi + _off - 1) % 12)
        planets = []
        for obj_id in JYOTISH_PLANETS:
            obj = safe_get(self.chart, obj_id)
            if not obj:
                continue
            dignity = self.dignity(obj_id, obj.sign, obj.signlon)
            retro = getattr(obj, 'movedir', None) == 'Retrograde'
            combust = bool(sun_lon is not None and is_combust(obj_id, obj.lon, sun_lon, retro))
            # vargottama = D1 与 D9 同宫，恒以 D1 盘判(与所绘分盘无关)。
            d1_obj = safe_get(self.d1_chart, obj_id)
            vargottama = bool(d1_obj and is_vargottama(d1_obj.lon, 9))
            # Sayanadi 逐曜项：C 本曜宿序、P=obj_id(函数内映射)、A 本曜星座内 navamsa 序(1-9)。
            sayanadi_nak = nakshatra_from_lon(obj.lon)['index']
            sayanadi_navamsa = int(obj.signlon // navamsa_step) + 1
            planets.append({
                'id': obj_id,
                'label': PLANET_CN.get(obj_id, obj_id),
                'lon': obj.lon,
                'sign': obj.sign,
                'signLabel': SIGN_CN.get(obj.sign, obj.sign),
                'signlon': obj.signlon,
                'house': house_number(obj),
                'motion': getattr(obj, 'movedir', None),
                'retrograde': retro,
                'combust': combust,
                'vargottama': vargottama,
                'baladi': baladi_avastha(obj.sign, obj.signlon),
                'jagradadi': jagradadi_avastha(dignity),
                'deeptadi': deeptadi_avastha(dignity, combust=combust),
                'sayanadi': sayanadi_avastha(
                    sayanadi_nak, obj_id, sayanadi_navamsa,
                    sayanadi_moon_nak, sayanadi_ghati, sayanadi_lagna_sign),
                'lajjitadi': lajjitadi_avastha(
                    house_number(obj), dignity, obj.sign,
                    {q for q in _all_signs if q != obj_id and _all_signs[q] == obj.sign},
                    _SIGN_IDX[obj.sign] in _malefic_aspected, combust),
                'dignity': dignity,
                'nakshatra': self._nak_with_detail(obj.lon),
            })
        return {
            'planetaryStates': planets,
            'vargaDignity': self.varga_dignity(planets),
            'naisargikaKaraka': naisargika_karaka_table(),
            'sthiraKaraka': sthira_karaka(),
        }

    def shadbala(self):
        dignity_scores = {
            'deep_exaltation': 60,
            'exaltation': 55,
            'moolatrikona': 50,
            'own_sign': 45,
            'neutral': 30,
            'debilitation': 15,
        }
        natural_scores = {
            const.SUN: 60,
            const.MOON: 51,
            const.VENUS: 43,
            const.JUPITER: 34,
            const.MERCURY: 26,
            const.MARS: 17,
            const.SATURN: 9,
        }
        digbala_houses = {
            const.SUN: 10,
            const.MARS: 10,
            const.JUPITER: 1,
            const.MERCURY: 1,
            const.MOON: 4,
            const.VENUS: 4,
            const.SATURN: 7,
        }
        rows = []
        for obj_id in [const.SUN, const.MOON, const.MARS, const.MERCURY, const.JUPITER, const.VENUS, const.SATURN]:
            obj = safe_get(self.chart, obj_id)
            if not obj:
                continue
            dignity = self.dignity(obj_id, obj.sign, obj.signlon)
            house = house_number(obj)
            target_house = digbala_houses.get(obj_id)
            if house and target_house:
                house_distance = min((house - target_house) % 12, (target_house - house) % 12)
                digbala = max(0, 60 - house_distance * 10)
            else:
                digbala = 0
            chestabala = 45 if getattr(obj, 'movedir', None) == 'Retrograde' else 30
            sthanabala = dignity_scores.get(dignity, 30)
            naisargika = natural_scores.get(obj_id, 0)
            total = sthanabala + digbala + chestabala + naisargika
            # QW8 Uchcha Bala（出曜力，连续值）：与卑陷点角距 ÷ 3（卑陷=0，曜旺=60）。
            #   深旺度：日10°白羊/月3°金牛/火28°摩羯/水15°处女/木5°巨蟹/金27°双鱼/土20°天秤。
            deep_exalt = {const.SUN: 10.0, const.MOON: 33.0, const.MARS: 298.0,
                          const.MERCURY: 165.0, const.JUPITER: 95.0,
                          const.VENUS: 357.0, const.SATURN: 200.0}
            full_lon = getattr(obj, 'lon', None)
            uchcha_bala = None
            if full_lon is not None and obj_id in deep_exalt:
                debil = (deep_exalt[obj_id] + 180.0) % 360.0
                d = abs((full_lon % 360.0) - debil)
                d = min(d, 360.0 - d)  # 0..180 最短弧
                uchcha_bala = round(d / 3.0, 4)  # 0..60
            # QW8 Ishta/Kashta phala（吉果/凶果）：Ishta=√(Uchcha×Cheshta)、Kashta=√((60−Uchcha)×(60−Cheshta)）。
            ishta = kashta = None
            if uchcha_bala is not None:
                uc = max(0.0, min(60.0, uchcha_bala))
                ch = max(0.0, min(60.0, float(chestabala)))
                ishta = round((uc * ch) ** 0.5, 4)
                kashta = round(((60.0 - uc) * (60.0 - ch)) ** 0.5, 4)
            rows.append({
                'id': obj_id,
                'label': PLANET_CN.get(obj_id, obj_id),
                'sthana': sthanabala,
                'dig': digbala,
                'chesta': chestabala,
                'naisargika': naisargika,
                'uchchaBala': uchcha_bala,
                'ishta': ishta,
                'kashta': kashta,
                'totalVirupa': total,
                'totalRupa': round(total / 60.0, 2),
                'dignity': dignity,
                'house': house,
            })
        rows.sort(key=lambda item: item['totalVirupa'], reverse=True)
        return {
            'available': bool(rows),
            'method': 'structured_rule_estimate_from_Horosa_D1',
            'note': 'Uses Horosa chart JSON positions only; replaceable with full BPHS component formulas in the same isolated layer.',
            'planets': rows,
        }

    def shadbala_bphs(self):
        """六源六力(Sthana/Dig/Kala/Cheshta/Naisargika/Drik)。

        各子项按标准口径计算:Saptavargaja 七盘尊贵档(用 D1 友谊)、Tribhaga 段主(日出/日落分
        三段)、Ayana 赤纬式(obj.decl)、Cheshta 八态(逆/留/速度比)、Drik 分段虚拉(全曜 Sphuta)、
        Vara/Hora(行星时序)、Abda/Masa(平太阳回推入宫日的 vara 主近似)。回推/取主曜异常时该子项
        保持 pending。"""
        from astrostudy.india import shadbala_bphs as sb
        sun_lon = getattr(self.sun, 'lon', 0.0)
        moon_lon = getattr(self.moon, 'lon', 0.0)
        is_day = bool(getattr(self.perchart, 'isDiurnal', True))
        planets = [const.SUN, const.MOON, const.MARS, const.MERCURY,
                   const.JUPITER, const.VENUS, const.SATURN]
        # 星期主(vara lord)的 const id（panchanga 给 dasha_lord dict，取其 'id'）。
        try:
            lord = (self.panchanga().get('vara') or {}).get('lord')
            weekday_lord = lord.get('id') if isinstance(lord, dict) else None
        except Exception:
            weekday_lord = None
        # 全曜 D1 星座(0-based)→ Saptavargaja 复合友谊用；同时备 D1 经度。
        planet_signs = {}
        d1_lons = {}
        for obj_id in planets:
            d1_obj = safe_get(self.d1_chart, obj_id)
            if d1_obj is not None:
                planet_signs[obj_id] = d1_obj.sign            # 星座名(const)
                d1_lons[obj_id] = float(d1_obj.lon)
        # Tribhaga：出生在昼/夜的第几段(0/1/2)+ fractionFromMidnight，由日出/日落分三段算。
        tribhaga_index, frac_mid, hora_seq = self._shadbala_time_context(is_day)
        hora_lord = sb.hora_lord_at(self.perchart.dateTime.date.dayofweek(), hora_seq) \
            if hora_seq is not None else None
        # 年/月主(Abda/Masa)：太阳入白羊 / 入当前星座时刻的 hora 主。
        # 以平太阳速度回推入宫日(≈365 日年 / 30 日月近似)，取该日「日出 hora 主」(= vara 主)为近似。
        year_lord, month_lord = self._shadbala_abda_masa_lords(sun_lon)
        contexts = {}
        for obj_id in planets:
            obj = safe_get(self.chart, obj_id)
            if not obj:
                continue
            speed = abs(float(getattr(obj, 'lonspeed', 0.0)))
            try:
                mean_speed = float(obj.meanMotion())
            except Exception:
                mean_speed = None
            movedir = getattr(obj, 'movedir', None)
            # 被照点:本曜外其余六曜对本曜的 Sphuta Drishti(传各照者真黄经,模块按角差算)。
            aspecting = [(o2, getattr(safe_get(self.chart, o2), 'lon', 0.0))
                         for o2 in planets if o2 != obj_id and safe_get(self.chart, o2)]
            contexts[obj_id] = {
                'lon': obj.lon, 'signlon': obj.signlon,
                'houseFromLagna': house_number(obj),
                'd1Lon': d1_lons.get(obj_id, obj.lon),
                'd1Signlon': (float(d1_lons.get(obj_id, obj.lon)) % 30.0),
                'planetSigns': planet_signs,
                'vargaVariants': self.varga_variant_map,
                'sunLon': sun_lon, 'moonLon': moon_lon,
                'isDay': is_day, 'tribhagaIndex': tribhaga_index,
                'fractionFromMidnight': frac_mid,
                'weekdayLord': weekday_lord, 'horaLord': hora_lord,
                'yearLord': year_lord, 'monthLord': month_lord,
                'declination': getattr(obj, 'decl', None),
                'retrograde': movedir == 'Retrograde',
                'stationary': movedir == 'Stationary',
                'speed': speed, 'meanSpeed': mean_speed,
                'aspecting': aspecting,
            }
        try:
            return sb.compute_all(contexts)
        except Exception:
            return {'available': False}

    def _shadbala_time_context(self, is_day):
        """三分时段序(0/1/2)+ fractionFromMidnight + 行星时序号(日出后第几时,0 起)。

        由出生 JD 与当日日出/次日日出算;失败则回退(段 0、正午、None)。
        """
        try:
            jd = self.perchart.dateTime.jd
            lat = self.perchart.pos.lat
            lon = self.perchart.pos.lon
            sunrise_jd = eph.lastSunrise(jd, lat, lon)
            sunset_jd = eph.nextSunset(sunrise_jd, lat, lon)
            next_sunrise_jd = eph.nextSunrise(sunset_jd, lat, lon)
            if is_day and sunset_jd > sunrise_jd:
                frac = (jd - sunrise_jd) / (sunset_jd - sunrise_jd)      # 昼内比例 0..1
            elif next_sunrise_jd > sunset_jd:
                # 夜:出生在日落后。若 jd 早于当日日出(凌晨段),用上一日落参照。
                if jd < sunrise_jd:
                    prev_sunset_jd = eph.lastSunset(jd, lat, lon)
                    frac = (jd - prev_sunset_jd) / (sunrise_jd - prev_sunset_jd)
                else:
                    frac = (jd - sunset_jd) / (next_sunrise_jd - sunset_jd)
            else:
                frac = 0.0
            frac = min(0.999999, max(0.0, frac))
            seg = min(2, int(frac * 3.0))
            # 行星时:一昼夜按昼 12 / 夜 12 不等分简化为 24 等分自日出计;序号 = 自日出经过的时数。
            day_len = sunset_jd - sunrise_jd
            night_len = next_sunrise_jd - sunset_jd
            if jd >= sunrise_jd and jd < sunset_jd and day_len > 0:
                hora_seq = int((jd - sunrise_jd) / (day_len / 12.0))
            elif jd >= sunset_jd and night_len > 0:
                hora_seq = 12 + int((jd - sunset_jd) / (night_len / 12.0))
            elif jd < sunrise_jd:
                prev_sunset_jd = eph.lastSunset(jd, lat, lon)
                pn_len = sunrise_jd - prev_sunset_jd
                hora_seq = 12 + int((jd - prev_sunset_jd) / (pn_len / 12.0)) if pn_len > 0 else 0
            else:
                hora_seq = 0
            hora_seq = max(0, min(23, hora_seq))
            # fractionFromMidnight:0=午夜 0.5=正午,用昼夜比例近似(昼:0.25→0.75;夜:0.75→1.25%1)。
            if is_day:
                frac_mid = 0.25 + frac * 0.5
            else:
                frac_mid = (0.75 + frac * 0.5) % 1.0
            return seg, frac_mid, hora_seq
        except Exception:
            return 0, 0.5, None

    def _shadbala_abda_masa_lords(self, sun_lon):
        """年/月主(Abda/Masa)的 const 主曜(近似)。

        Masa 主 = 太阳进入「当前星座 0°」时刻的 hora 主;Abda 主 = 太阳进入白羊 0°时刻的 hora 主。
        近似:以平太阳速度(≈0.98565°/日)由本命太阳经度回推入宫日,取该日「日出 hora 主」(=当日 vara
        主)代该时刻 hora 主。星座边界用 D1(本命)太阳的 sidereal 经度,故入宫日与所用历元一致。
        回推/取主曜任一步异常 → (None, None)(则该子项保持 pending)。
        """
        from astrostudy.india import shadbala_bphs as sb
        try:
            jd = self.perchart.dateTime.jd
            sun = float(sun_lon) % 360.0
            mean = 360.0 / 365.2422                    # 平太阳日速(°/日)
            sign_start = (int(sun // 30.0) * 30.0)     # 当前星座 0°(sidereal)
            days_since_masa = (sun - sign_start) / mean
            days_since_abda = sun / mean
            masa_jd = jd - days_since_masa
            abda_jd = jd - days_since_abda
            # JD → 星期(0=周日),取当日 vara 主 = 该日日出 hora 主。
            masa_wd = int(masa_jd + 1.5) % 7
            abda_wd = int(abda_jd + 1.5) % 7
            return sb.WEEKDAY_LORDS[abda_wd], sb.WEEKDAY_LORDS[masa_wd]
        except Exception:
            return None, None

    def dignity(self, obj_id, sign, signlon):
        if obj_id in EXALTATION:
            exalt_sign, exalt_deg = EXALTATION[obj_id]
            deb_sign = const.LIST_SIGNS[(const.LIST_SIGNS.index(exalt_sign) + 6) % 12]
            if sign == exalt_sign:
                return 'deep_exaltation' if abs(signlon - exalt_deg) < 1 else 'exaltation'
            if sign == deb_sign:
                return 'debilitation'
        if obj_id in MOOLATRIKONA:
            mt_sign, mt_start, mt_end = MOOLATRIKONA[obj_id]
            if sign == mt_sign and mt_start <= signlon <= mt_end:
                return 'moolatrikona'
        if sign in OWN_SIGNS.get(obj_id, []):
            return 'own_sign'
        return 'neutral'

    def varga_dignity(self, planets):
        # Amsa-bala：各 varga 组(Shad/Sapta/Dasa/Shodasavarga)内该曜居 MT/own/旺的分盘数 → amsa 名。
        # 各分盘星座由 D1 经度算(varga_position)，恒以 D1 盘判。
        from astrostudy.india.varga import varga_position
        from astrostudy.india.primitives import amsa_bala, VARGA_GROUPS, SHODASAVARGA, sign_of_lon
        dignified_set = {'deep_exaltation', 'exaltation', 'moolatrikona', 'own_sign'}
        out = []
        for item in planets:
            obj_id = item['id']
            row = {'id': obj_id, 'label': item['label'], 'd1': item['dignity']}
            d1_obj = safe_get(self.d1_chart, obj_id)
            if d1_obj is not None:
                d1_lon = float(d1_obj.lon)
                dignified = set()
                for v in SHODASAVARGA:
                    vlon = varga_position(d1_lon, v, self.varga_variant_map.get(v))
                    if self.dignity(obj_id, sign_of_lon(vlon), vlon % 30.0) in dignified_set:
                        dignified.add(v)
                row['amsa'] = {g: amsa_bala(dignified, g) for g in VARGA_GROUPS}
            out.append(row)
        return out

    def jaimini(self):
        # 8 卡拉卡(含罗睺逆量 30−宿内度)，降序 → AK..DK。复用 primitives.chara_karakas。
        objs = {}
        planet_lons = {}
        for obj_id in KARAKA_PLANETS:
            obj = safe_get(self.chart, obj_id)
            if obj:
                objs[obj_id] = obj
                planet_lons[obj_id] = obj.lon
        karakas = chara_karakas(planet_lons, scheme=self.karaka_scheme)
        rows = []
        for k in karakas:
            obj_id = k['planet']
            obj = objs.get(obj_id)
            if not obj:
                continue
            rows.append({
                'karaka': k['full'],          # 全名 Atmakaraka..Darakaraka(8)
                'karakaLabel': k['label'],    # 缩写 AK..DK
                'planet': obj_id,
                'label': PLANET_CN.get(obj_id, obj_id),
                'sign': obj.sign,
                'signLabel': SIGN_CN.get(obj.sign, obj.sign),
                'signlon': obj.signlon,
                'karakaDegree': k['degree'],  # 卡拉卡用度(罗睺为逆量)
            })
        return {'charaKarakas': rows, 'karakaScheme': self.karaka_scheme,
                'ayurTriPair': self._jaimini_ayur_tri_pair()}

    def _jaimini_ayur_tri_pair(self):
        """Jaimini 寿命三对法(古籍通行版本):①Lagna×Hora Lagna ②Moon×Lagna ③Saturn×Hora Lagna。
        每对按两点所在座「动/固/双」三态组合映射档位(各教材一致的循环表):
        同动=purna(长)/同固=alpa(短)/同双=madhya(中);混合取第三态档
        (动+固=madhya、固+双=purna、动+双=alpa)。三票多数,平票取 madhya。
        「前后关系」诸版本仅作次级微调且口径不一 → 不实现(不臆造),note 标注。"""
        try:
            from flatlib.ephem import eph
            from astrostudy.india.primitives import MOVABLE, FIXED
            asc = self.d1_asc if self.d1_asc is not None else self.asc
            moon = self.d1_moon if self.d1_moon is not None else self.moon
            sat = safe_get(self.d1_chart, const.SATURN)
            sun = self.d1_sun if getattr(self, 'd1_sun', None) is not None else safe_get(self.d1_chart, const.SUN)
            if asc is None or moon is None or sat is None or sun is None:
                return {'available': False, 'reason': 'missing_points'}
            # Hora Lagna:日出起每 2.5 灵时进 1 座 → 经度式 = 日出太阳 + elapsed×(360/720min)
            jd = self.d1_perchart.dateTime.jd
            lat = self.d1_perchart.pos.lat
            lon_geo = self.d1_perchart.pos.lon
            try:
                sunrise_jd = eph.lastSunrise(jd, lat, lon_geo)
                elapsed_minutes = (jd - sunrise_jd) * 1440.0
                sun_at_sunrise = (float(sun.lon) - 0.98565 * (elapsed_minutes / 1440.0)) % 360.0
                hl = (sun_at_sunrise + elapsed_minutes * 0.5) % 360.0
            except Exception:
                return {'available': False, 'reason': 'sunrise_unavailable'}

            def _quality(lon):
                sgn = const.LIST_SIGNS[sign_index_from_lon(lon)]
                if sgn in MOVABLE:
                    return 'movable'
                if sgn in FIXED:
                    return 'fixed'
                return 'dual'

            BAND = {'movable': 'purna', 'fixed': 'alpa', 'dual': 'madhya'}
            THIRD = {frozenset(('movable', 'fixed')): 'madhya',
                     frozenset(('fixed', 'dual')): 'purna',
                     frozenset(('movable', 'dual')): 'alpa'}
            BAND_CN = {'purna': '长寿 Pūrṇa(约64-100)', 'madhya': '中寿 Madhya(约32-64)', 'alpa': '短寿 Alpa(约0-32)'}

            def _verdict(a_lon, b_lon):
                qa, qb = _quality(a_lon), _quality(b_lon)
                if qa == qb:
                    return BAND[qa]
                return THIRD[frozenset((qa, qb))]

            asc_lon = float(asc.lon) % 360.0
            moon_lon = float(moon.lon) % 360.0
            sat_lon = float(sat.lon) % 360.0
            pairs_def = [
                ('Lagna × Hora Lagna', 'Lagna', asc_lon, 'Hora Lagna', hl),
                ('Moon × Lagna', 'Moon', moon_lon, 'Lagna', asc_lon),
                ('Saturn × Hora Lagna', 'Saturn', sat_lon, 'Hora Lagna', hl),
            ]
            pairs = []
            votes = {'purna': 0, 'madhya': 0, 'alpa': 0}
            for name, an, al, bn, bl in pairs_def:
                v = _verdict(al, bl)
                votes[v] += 1
                a_sign = const.LIST_SIGNS[sign_index_from_lon(al)]
                b_sign = const.LIST_SIGNS[sign_index_from_lon(bl)]
                pairs.append({'name': name, 'aPoint': an, 'bPoint': bn,
                              'aSign': a_sign, 'aSignLabel': SIGN_CN.get(a_sign, a_sign),
                              'bSign': b_sign, 'bSignLabel': SIGN_CN.get(b_sign, b_sign),
                              'aQuality': _quality(al), 'bQuality': _quality(bl),
                              'verdict': v, 'verdictLabel': BAND_CN[v]})
            best = max(votes.values())
            leaders = [k for k, n in votes.items() if n == best]
            majority = leaders[0] if len(leaders) == 1 else 'madhya'   # 平票取中档
            return {'available': True, 'pairs': pairs, 'votes': votes,
                    'majority': majority, 'band': majority, 'bandLabel': BAND_CN[majority],
                    'horaLagnaLon': round(hl, 4),
                    'note': '三对法·古籍通行版本(各版配对略异);同质=本档(动长/固短/双中),混合取第三态;仅档位参考,不作寿命断言。'}
        except Exception as exc:
            return {'available': False, 'reason': str(exc)}

    def _kp_placidus_cusps(self):
        """KP CSL 用真 Placidus 不等宫 sidereal 宫始(P0-9)。KP 标准恒用 Placidus,
        与盘面 hsys 设置无关。返回 12 个 sidereal 宫始度数(宫 1..12),首宫 = 上升点;
        求根失败(极地/无日出区等)→ None,由调用方退化为等宫近似。"""
        try:
            from flatlib.ephem import swe as fswe
            jd = self.perchart.dateTime.jd
            lat = self.perchart.pos.lat
            lon = self.perchart.pos.lon
            with self.chart._siderealContext():
                hlist, _ = fswe.sweHousesLon(jd, lat, lon, const.HOUSES_PLACIDUS,
                                             fswe.swisseph.FLG_SIDEREAL)
            if not hlist or len(hlist) < 12:
                return None
            return [float(h) % 360.0 for h in hlist[:12]]
        except Exception:
            return None

    def prasna(self):
        """Praśna KP 卜卦(最小版):问数 1-249 → 问时上升所落 KP 子段(243 宿×Sub + 6 跨界拆 = 249,
        全黄道固定结构,与盘/岁差无关)。返回 249 段表;前端按问数取行,显上升座/度区/宿/星主/子主/座主链。
        完整问时盘(该上升 + 问时九曜重排 + 显著星判读)后续。零回归:纯新增 compute 键。"""
        try:
            from astrostudy.india.kp_system import kp_249_table, sign_lord
            SIGN = const.LIST_SIGNS
            rows = []
            for seg in kp_249_table():
                rows.append({
                    'index': seg['index'],
                    'sign': SIGN[(seg['signNo'] - 1) % 12],
                    'startLon': round(seg['startLon'], 3),
                    'endLon': round(seg['endLon'], 3),
                    'nakName': seg['nakName'],
                    'starLord': seg['starLord'],
                    'subLord': seg['subLord'],
                    'signLord': sign_lord(seg['signNo']),
                })
            return {
                'available': True, 'count': len(rows), 'table': rows,
                'note': '问数 1-249 → 问时上升落该 KP 子段;子主链=座主→星主(宿主)→子主(Sub 主)。完整问时盘需另定问时刻重排九曜+显著星,本最小版只给上升定位。',
            }
        except Exception as exc:
            return {'available': False, 'reason': str(exc)}

    def kp(self):
        sublords = {}
        kp_levels = {}
        for obj_id in JYOTISH_PLANETS:
            obj = safe_get(self.chart, obj_id)
            if not obj:
                continue
            sublords[obj_id] = self.kp_sublord(obj.lon)
        if self.asc:
            sublords[const.ASC] = self.kp_sublord(self.asc.lon)
        result = {
            'ayanamsa': getattr(self.perchart, 'siderealModeLabel', 'Lahiri / Horosa sidereal context'),
            'ayanamsaKey': getattr(self.perchart, 'siderealModeKey', 'lahiri'),
            'sublords': sublords,
        }
        # KP 深化:6 级细分(Nak⊃Sub⊃Prati⊃Sook⊃Praana⊃Deha)+ CSL(等宫近似)+ Ruling Planets。
        try:
            from astrostudy.india.kp_system import kp_levels as _kpl, cuspal_sublords, ruling_planets
            for obj_id in JYOTISH_PLANETS:
                obj = safe_get(self.chart, obj_id)
                if obj:
                    kp_levels[obj_id] = _kpl(obj.lon, 6)
            if self.asc:
                kp_levels[const.ASC] = _kpl(self.asc.lon, 6)
            result['kpLevels'] = kp_levels
            SIGNS = [const.ARIES, const.TAURUS, const.GEMINI, const.CANCER, const.LEO, const.VIRGO,
                     const.LIBRA, const.SCORPIO, const.SAGITTARIUS, const.CAPRICORN, const.AQUARIUS, const.PISCES]
            if self.asc:
                cusps = self._kp_placidus_cusps()       # P0-9 KP 标准:真 Placidus 不等宫
                if cusps:
                    cusp_mode = 'placidus_sidereal'
                else:
                    cusps = [(float(self.asc.lon) + i * 30.0) % 360.0 for i in range(12)]
                    cusp_mode = 'equal_from_asc'         # 极地等求根失败优雅降级
                result['cuspalSubLords'] = cuspal_sublords(cusps)
                result['cuspMode'] = cusp_mode
                moon = safe_get(self.chart, const.MOON)
                try:
                    weekday = (self.perchart.dateTime.date.dayofweek() - 1) % 7  # → 0=Mon..6=Sun
                except Exception:
                    weekday = 0
                result['rulingPlanets'] = ruling_planets(
                    SIGNS.index(self.asc.sign) + 1, nakshatra_from_lon(self.asc.lon)['lord'],
                    (SIGNS.index(moon.sign) + 1) if moon else None,
                    nakshatra_from_lon(moon.lon)['lord'] if moon else None, weekday)
                # QW6 KP 四重意义者(significators):每曜对各宫意义强度 A(宿主所占/主)>B(自占)>C(自主)>D(受影响)。
                from astrostudy.india.kp_system import significators as _significators
                from astrostudy.india.rasi_dasha import SIGN_LORDS as _SIGN_LORDS
                asc_idx = SIGNS.index(self.asc.sign)
                owns = {}
                for sgn, lord in (_SIGN_LORDS or {}).items():
                    owns.setdefault(lord, []).append(sgn)
                planet_data = {}
                for obj_id in JYOTISH_PLANETS:
                    o = safe_get(self.chart, obj_id)
                    if not o:
                        continue
                    p_idx = SIGNS.index(o.sign)
                    own_houses = sorted(set(((SIGNS.index(s) - asc_idx) % 12) + 1
                                            for s in owns.get(obj_id, []) if s in SIGNS))
                    planet_data[obj_id] = {
                        'sign': p_idx + 1,
                        'house': ((p_idx - asc_idx) % 12) + 1,
                        'starLord': nakshatra_from_lon(o.lon)['lord'],
                        'ownHouses': own_houses,
                    }
                result['significators'] = _significators(planet_data)
        except Exception:
            pass
        return result

    def kp_sublord(self, lon):
        nak = nakshatra_from_lon(lon)
        lord_index = [x['key'] for x in DASHA_SEQUENCE].index(nak['lord'])
        span = 360.0 / 27.0
        progress_deg = (norm(lon) % span)
        cursor = 0
        sublord = DASHA_SEQUENCE[lord_index]
        for i in range(len(DASHA_SEQUENCE)):
            candidate = DASHA_SEQUENCE[(lord_index + i) % len(DASHA_SEQUENCE)]
            part = span * candidate['years'] / 120.0
            if progress_deg <= cursor + part:
                sublord = candidate
                break
            cursor += part
        return {
            'nakshatra': nak,
            'starLord': dasha_lord(nak['lord']),
            'subLord': sublord,
        }

    def muhurta(self):
        try:
            sunrise_jd = eph.lastSunrise(self.perchart.dateTime.jd + 0.5, self.perchart.pos.lat, self.perchart.pos.lon)
            sunset_jd = eph.nextSunset(sunrise_jd, self.perchart.pos.lat, self.perchart.pos.lon)
            sunrise = Datetime.fromJD(sunrise_jd, self.perchart.zone)
            sunset = Datetime.fromJD(sunset_jd, self.perchart.zone)
            day_length_hours = (sunset_jd - sunrise_jd) * 24
            weekday = self.perchart.dateTime.date.dayofweek()
            rahu_slots = [8, 2, 7, 5, 6, 4, 3]
            yama_slots = [5, 4, 3, 2, 1, 7, 6]
            gulika_slots = [7, 6, 5, 4, 3, 2, 1]
            slot_hours = day_length_hours / 8.0
            result = {
                'sunrise': sunrise.toCNString(),
                'sunset': sunset.toCNString(),
                'rahuKalam': self.muhurta_interval(sunrise, slot_hours, rahu_slots[weekday]),
                'yamaganda': self.muhurta_interval(sunrise, slot_hours, yama_slots[weekday]),
                'gulika': self.muhurta_interval(sunrise, slot_hours, gulika_slots[weekday]),
            }
            # 出生须臾(昼/夜各 15 = 30 muhurta)+ 全表;用出生日的日出→日没→次日出窗口(正确括住凌晨生)。
            try:
                from astrostudy.india.muhurta_day import birth_muhurta, all_muhurtas
                bjd = self.perchart.dateTime.jd
                blat = self.perchart.pos.lat
                blon = self.perchart.pos.lon
                bsr = eph.lastSunrise(bjd, blat, blon)
                bss = eph.nextSunset(bsr, blat, blon)
                bnsr = eph.nextSunrise(bss, blat, blon)
                result['birthMuhurta'] = birth_muhurta(bjd, bsr, bss, bnsr)
                result['muhurtaTable'] = all_muhurtas()
            except Exception:
                result['birthMuhurta'] = None
            # 昼夜 24 行星时(Hora)表(P0-7;新增键，零回归)。
            result['horaTable'] = self.hora_table()
            # Choghadia 民用择时(昼夜各 8 段;P1;新增键,零回归)。
            result['choghadia'] = self.choghadia_table()
            # Panchaka 五忌:((Tithi+Vara+Nakshatra+Lagna)×2)%9 → 1死/2火/4王/6盗/8病为忌。
            try:
                pan = self.panchanga()
                tithi_n = (pan.get('tithi') or {}).get('index')
                vara_n = (pan.get('vara') or {}).get('index')
                nak = pan.get('nakshatra') or {}
                nak_n = nak.get('index')
                lagna_n = (list(const.LIST_SIGNS).index(self.asc.sign) + 1) if self.asc else None
                if tithi_n and vara_n is not None and nak_n and lagna_n:
                    rem = ((int(tithi_n) + (int(vara_n) + 1) + int(nak_n) + int(lagna_n)) * 2) % 9
                    PANCHAKA = {1: ('Mrityu', '死忌'), 2: ('Agni', '火忌'), 4: ('Raja', '王忌'),
                                6: ('Chora', '盗忌'), 8: ('Roga', '病忌')}
                    result['panchaka'] = {
                        'remainder': rem,
                        'isPanchaka': rem in PANCHAKA,
                        'type': PANCHAKA.get(rem, (None, None))[0],
                        'typeLabel': PANCHAKA.get(rem, (None, '无忌(吉)'))[1],
                        'note': '((Tithi+Vara+Nakshatra+Lagna)×2)%9;余1死/2火/4王/6盗/8病为忌,余0/3/5/7吉。',
                    }
            except Exception:
                pass
            # Abhijit Muhurta(古法):全日 15 昼须臾之第 8(正午前后),除周三外通用大吉。
            try:
                wd = self.perchart.dateTime.date.dayofweek()   # 0=周日..3=周三
                result['abhijit'] = {
                    'muhurtaIndex': 8,
                    'auspicious': (wd != 3),
                    'note': '第 8 昼须臾(正午前后)通用大吉、破诸障;周三除外。',
                }
            except Exception:
                pass
            return result
        except Exception as exc:
            return {'available': False, 'reason': str(exc)}

    def hora_table(self):
        """昼夜 24 行星时(Hora)表:昼=日出→日没均分 12、夜=日没→次日出均分 12。
        每段主曜 = sb.hora_lord_at(当日 vara 序, 段序),日出首段恒为当日 vara 主,
        之后按 Chaldean 序循环(与年/月主同源)。时段含起讫时刻。零回归:仅新增键。"""
        try:
            from astrostudy.india import shadbala_bphs as sb
            lat = self.perchart.pos.lat
            lon = self.perchart.pos.lon
            sr = eph.lastSunrise(self.perchart.dateTime.jd + 0.5, lat, lon)
            ss = eph.nextSunset(sr, lat, lon)
            nsr = eph.nextSunrise(ss, lat, lon)
            if not (ss > sr and nsr > ss):
                return None
            weekday = Datetime.fromJD(sr, self.perchart.zone).date.dayofweek()
            cn = {const.SUN: '太阳', const.MOON: '月亮', const.MARS: '火星',
                  const.MERCURY: '水星', const.JUPITER: '木星', const.VENUS: '金星',
                  const.SATURN: '土星'}
            day_slot = (ss - sr) / 12.0
            night_slot = (nsr - ss) / 12.0
            rows = []
            for i in range(24):
                if i < 12:
                    start_jd = sr + i * day_slot
                    end_jd = start_jd + day_slot
                    period = 'day'
                else:
                    start_jd = ss + (i - 12) * night_slot
                    end_jd = start_jd + night_slot
                    period = 'night'
                lord = sb.hora_lord_at(weekday, i)
                rows.append({
                    'index': i + 1,
                    'period': period,
                    'lord': lord,
                    'lordCN': cn.get(lord, lord),
                    'start': Datetime.fromJD(start_jd, self.perchart.zone).toCNString(),
                    'end': Datetime.fromJD(end_jd, self.perchart.zone).toCNString(),
                })
            return {'weekday': weekday, 'rows': rows}
        except Exception:
            return None

    def choghadia_table(self):
        """Choghadia 民用择时:昼夜各 8 段(段长=昼/夜 ÷8)。昼首段=当日 vara 类,夜首段= 昼首 +5,
        之后按 CHOGHADIA_CYCLE 循环序推进。每段含类(吉/凶)+对应曜+起讫。零回归:仅新增键。"""
        try:
            lat = self.perchart.pos.lat
            lon = self.perchart.pos.lon
            sr = eph.lastSunrise(self.perchart.dateTime.jd + 0.5, lat, lon)
            ss = eph.nextSunset(sr, lat, lon)
            nsr = eph.nextSunrise(ss, lat, lon)
            if not (ss > sr and nsr > ss):
                return None
            weekday = Datetime.fromJD(sr, self.perchart.zone).date.dayofweek()
            day_first = CHOGHADIA_DAY_FIRST[weekday % 7]
            night_first = (day_first + 5) % 7
            day_slot = (ss - sr) / 8.0
            night_slot = (nsr - ss) / 8.0

            def _seg(period, base, i, slot, origin):
                c = CHOGHADIA_CYCLE[(base + i) % 7]
                start_jd = origin + i * slot
                return {
                    'index': i + 1, 'period': period,
                    'key': c['key'], 'cn': c['cn'], 'nature': c['nature'], 'planet': c['planet'],
                    'start': Datetime.fromJD(start_jd, self.perchart.zone).toCNString(),
                    'end': Datetime.fromJD(start_jd + slot, self.perchart.zone).toCNString(),
                }
            rows = [_seg('day', day_first, i, day_slot, sr) for i in range(8)]
            rows += [_seg('night', night_first, i, night_slot, ss) for i in range(8)]
            return {'weekday': weekday, 'rows': rows}
        except Exception:
            return None

    def muhurta_interval(self, sunrise, slot_hours, slot):
        start_jd = sunrise.jd + (slot - 1) * slot_hours / 24.0
        end_jd = start_jd + slot_hours / 24.0
        return {
            'start': Datetime.fromJD(start_jd, self.perchart.zone).toCNString(),
            'end': Datetime.fromJD(end_jd, self.perchart.zone).toCNString(),
        }

    def upagraha(self):
        """副星：日基 5(由日)+ 特殊上升 BL/HL/GL/SL(日出 + 历时)+ 时基 6(Gulika/Maandi 等，
        昼/夜 8 段段中点/起点升起的 lagna)。恒以 D1 盘算。"""
        from astrostudy.india.upagraha import sun_based_upagrahas, special_lagnas
        sun_lon = getattr(self.d1_sun, 'lon', None)
        result = {'available': sun_lon is not None}
        if sun_lon is None:
            return result
        result['sunBased'] = sun_based_upagrahas(sun_lon)
        try:
            jd = self.d1_perchart.dateTime.jd
            lat = self.d1_perchart.pos.lat
            lon = self.d1_perchart.pos.lon
            sunrise_jd = eph.lastSunrise(jd, lat, lon)
            elapsed_minutes = (jd - sunrise_jd) * 1440.0
            # 太阳日均行 ~0.98565°，由出生太阳回推日出时太阳经度(对特殊上升足够精度)。
            sun_at_sunrise = (sun_lon - 0.98565 * (elapsed_minutes / 1440.0)) % 360.0
            result['specialLagnas'] = special_lagnas(
                sun_at_sunrise, elapsed_minutes,
                getattr(self.d1_asc, 'lon', 0.0), getattr(self.d1_moon, 'lon', 0.0),
                sun_lon_at_birth=sun_lon)   # PP 出生太阳变体(现代变体)
        except Exception:
            result['specialLagnas'] = None
            result['note'] = '日出不定(极地等)，特殊上升优雅降级'
        result['timeBased'] = self._time_based_upagrahas()
        return result

    def _time_based_upagrahas(self):
        """时基 6 副星：定昼/夜 8 段(印度日界从日出起算)，取所属段中点(Maandi 起点)升起的
        sidereal 上升点黄经。日出不定(极地)或求根失败 → None(优雅降级)。"""
        try:
            from astrostudy.india.upagraha import time_based_segment, TIME_BASED_DEFS
            from flatlib.ephem import swe as fswe
            jd = self.d1_perchart.dateTime.jd
            lat = self.d1_perchart.pos.lat
            lon = self.d1_perchart.pos.lon
            hsys = self.d1_chart.hsys
            sr = eph.lastSunrise(jd, lat, lon)
            ss = eph.nextSunset(sr, lat, lon)
            if jd < ss:                                  # 昼生：日出 → 日没
                night, origin, span = False, sr, ss - sr
            else:                                        # 夜生：日没 → 次日出
                nsr = eph.nextSunrise(ss, lat, lon)
                night, origin, span = True, ss, nsr - ss
            if span <= 0:
                return None
            # 印度日界从日出起算：星期取「起始日出」那天(夜生/午夜后仍属该日)。
            weekday = Datetime.fromJD(sr, self.d1_perchart.zone).date.dayofweek()
            out = []
            with self.d1_chart._siderealContext():
                for name, planet, note in TIME_BASED_DEFS:
                    seg = time_based_segment(name, weekday, night)
                    if not seg:
                        continue
                    frac = (seg['segment'] + (0.5 if seg['point'] == 'mid' else 0.0)) / 8.0
                    _, angles = fswe.sweHousesLon(origin + frac * span, lat, lon, hsys,
                                                  fswe.swisseph.FLG_SIDEREAL)
                    out.append({
                        'key': name, 'planet': planet, 'note': note,
                        'segment': seg['segment'], 'point': seg['point'],
                        'lon': angles[0] % 360.0,
                    })
            return out
        except Exception:
            return None

    def supplementary_lagnas(self):
        """补充上升族(月上升 / 烹煮上升 / Karakamsa / Swamsa / 行星参照点)。恒以 D1 盘算。

        Karakamsa = Atmakaraka(AK) 的 navamsa(D9)星座；AK 取 jaimini() charaKarakas 中
        karaka=='Atmakaraka'(label 'AK')那条的行星。D9 复用 varga_position(lon, 9)，不另算。
        失败 → {'available': False}。"""
        try:
            from astrostudy.india.supplementary_lagna import compute_supplementary_lagnas
            from astrostudy.india.varga import varga_position
            from astrostudy.india.primitives import sign_of_lon
            if not self.d1_asc:
                return {'available': False}
            lagna_sign = self.d1_asc.sign
            moon_sign = getattr(self.d1_moon, 'sign', None)

            # 上升主星所居星座(供 Paaka Lagna)：上升主用 D1 盘该行星星座。
            from astrostudy.india.arudha import SIGN_LORDS
            lagna_lord_id = SIGN_LORDS.get(lagna_sign)
            lagna_lord_obj = safe_get(self.d1_chart, lagna_lord_id) if lagna_lord_id else None
            lagna_lord_sign = getattr(lagna_lord_obj, 'sign', None)

            # AK → 其 D1 黄经 → D9 星座(Karakamsa)。
            ak_navamsa_sign = None
            karakas = (self.jaimini() or {}).get('charaKarakas') or []
            ak_row = next(
                (k for k in karakas
                 if k.get('karaka') == 'Atmakaraka' or k.get('karakaLabel') == 'AK'),
                None)
            if ak_row is not None:
                ak_obj = safe_get(self.d1_chart, ak_row.get('planet'))
                if ak_obj is not None:
                    ak_navamsa_sign = sign_of_lon(varga_position(float(ak_obj.lon), 9))

            # Graha Lagnas 用 D1 各行星星座。
            planet_signs = {}
            for obj_id in JYOTISH_PLANETS:
                obj = safe_get(self.d1_chart, obj_id)
                if obj:
                    planet_signs[obj_id] = obj.sign

            # Hora Lagna(供 Varṇada):取 upagraha 特殊上升 horaLagna 的座。
            hora_lagna_sign = None
            try:
                _sl = (self.upagraha() or {}).get('specialLagnas') or {}
                _hl = _sl.get('horaLagna')
                if isinstance(_hl, dict) and _hl.get('lon') is not None:
                    hora_lagna_sign = sign_of_lon(float(_hl['lon']))
            except Exception:
                hora_lagna_sign = None

            res = compute_supplementary_lagnas(
                lagna_sign, moon_sign, ak_navamsa_sign,
                planet_signs=planet_signs, lagna_lord_sign=lagna_lord_sign,
                hora_lagna_sign=hora_lagna_sign)
            res['available'] = True
            return res
        except Exception:
            return {'available': False}

    def rasi_dashas(self):
        """Jaimini rasi 大运族(Narayana/Sudasa/Drigdasa/Niryana Shoola/Shoola/Kalachakra)。恒 D1。
        部分逐格序/Kalachakra 全表为权威待补,缺则该体系优雅降级。"""
        from astrostudy.india.rasi_dasha import build_rasi_dashas
        from astrostudy.india.primitives import sign_of_lon
        if not self.d1_asc:
            return {'available': False}
        planet_signs = {}
        planet_lons = {}
        for obj_id in JYOTISH_PLANETS:
            obj = safe_get(self.d1_chart, obj_id)
            if obj:
                planet_signs[obj_id] = obj.sign
                planet_lons[obj_id] = obj.lon
        # planet_lons 供 rasi 大运强弱判据的度数级 tiebreak(双主/seed 比较的终极一级)。
        inputs = {'lagna_sign': self.d1_asc.sign, 'planet_signs': planet_signs,
                  'planet_lons': planet_lons,
                  'sthira_start': getattr(self, 'sthira_start', 'lagna'),
                  'dashaVariants': self.dasha_variants}
        # 新增座运输入:Chakra 昼夜/座主、Navamsa D9 全盘、Varnada VL、Chara 结果(Paryaya 用)。
        try:
            inputs['is_day'] = bool(self.d1_chart.isDiurnal())
        except Exception:
            inputs['is_day'] = None
        inputs['lagna_signlon'] = float(getattr(self.d1_asc, 'signlon', 0.0) or 0.0)
        from astrostudy.india.rasi_dasha import SIGN_LORDS as _P_SIGN_LORDS
        _lag_lord = _P_SIGN_LORDS.get(self.d1_asc.sign)
        inputs['lagna_lord_sign'] = planet_signs.get(_lag_lord)
        if self.d1_moon is not None:
            _moon_lord = _P_SIGN_LORDS.get(self.d1_moon.sign)
            inputs['moon_lord_sign'] = planet_signs.get(_moon_lord)
        # D9 全盘(navamsa 座:lon×9 mod 360 与标准 D9 座同构)
        inputs['d9_lagna_sign'] = sign_of_lon((float(self.d1_asc.lon) * 9.0) % 360.0)
        inputs['d9_planet_signs'] = {pid: sign_of_lon((float(l) * 9.0) % 360.0)
                                     for pid, l in planet_lons.items()}
        inputs['d9_planet_lons'] = {pid: (float(l) * 9.0) % 360.0 for pid, l in planet_lons.items()}
        # Varnada Lagna:HL 与 upagraha.special_lagnas 同口径内联(日出回推),再经
        # supplementary_lagna.varnada_lagna 求 VL 座;日出不定(极地)→ 降级 None。
        try:
            from astrostudy.india.supplementary_lagna import varnada_lagna as _vl
            _jd = self.d1_perchart.dateTime.jd
            _sunrise = eph.lastSunrise(_jd, self.d1_perchart.pos.lat, self.d1_perchart.pos.lon)
            _elapsed_min = (_jd - _sunrise) * 1440.0
            _sun_lon = float(self.d1_sun.lon)
            _sun_rise_lon = (_sun_lon - 0.98565 * (_elapsed_min / 1440.0)) % 360.0
            _hl_lon = (_sun_rise_lon + (_elapsed_min / 60.0) * 30.0) % 360.0
            _vl_entry = _vl(self.d1_asc.sign, sign_of_lon(_hl_lon))
            inputs['varnada_lagna_sign'] = (_vl_entry or {}).get('sign')
        except Exception:
            inputs['varnada_lagna_sign'] = None
        # Chara 结果供 Paryaya(直接复算一次轻量 chara;年数序列小)
        try:
            from astrostudy.india.dasha_extended import chara_dasha as _chd
            _dvv = self.dasha_variants
            inputs['chara_result'] = _chd(
                self.d1_asc.sign, planet_signs, planet_lons, with_antardashas=False,
                direction_rule=_dvv.get('charaDirection', 'lagna_parity_sign'),
                dignity_rule=_dvv.get('charaDignity', 'plus_minus_one'))
        except Exception:
            inputs['chara_result'] = None
        if self.d1_moon:
            nak = 360.0 / 27.0
            moon_lon = float(self.d1_moon.lon)
            # Sree Lagna = lagna + 月在本宿进度×360°(内联，免重算 upagraha)。
            sl_lon = (float(self.d1_asc.lon) + ((moon_lon % nak) / nak) * 360.0) % 360.0
            inputs['sree_lagna_sign'] = sign_of_lon(sl_lon)
            inputs['sree_lagna_signlon'] = sl_lon % 30.0
            mk = nakshatra_from_lon(moon_lon)
            inputs['moon_lon'] = moon_lon
            # 月亮 D9(navamsa)座:Kalachakra 适用条件变体(#月navamsa强于rasi)判据输入。
            inputs['moon_d9_sign'] = sign_of_lon((moon_lon * 9.0) % 360.0)
            inputs['moon_nak_name'] = mk['name']
            inputs['moon_pada'] = mk['pada']
            inputs['moon_nak_progress'] = mk['progress']
        try:
            return build_rasi_dashas(inputs)
        except Exception:
            return {'available': False}

    def arudha(self):
        """Arudha pada(12 宫 + AL/UL + graha pada)+ Argala。恒以 D1 盘算(natal)。"""
        from astrostudy.india.arudha import compute_arudha
        if not self.d1_asc:
            return {'available': False}
        planet_signs = {}
        planet_lons = {}
        for obj_id in JYOTISH_PLANETS:
            obj = safe_get(self.d1_chart, obj_id)
            if obj:
                planet_signs[obj_id] = obj.sign
                planet_lons[obj_id] = obj.lon
        try:
            res = compute_arudha(self.d1_asc.sign, planet_signs, planet_lons)
            res['available'] = True
            return res
        except Exception:
            return {'available': False}

    def transit_notes(self):
        # Gochara(过运)本命参照恒取 D1 月/土，分盘不改 Sade Sati 本命基准。
        moon_house = house_number(self.d1_moon) if self.d1_moon else None
        saturn = safe_get(self.d1_chart, const.SATURN)
        return {
            'sadeSatiNatalBasis': {
                'moonSign': getattr(self.d1_moon, 'sign', None),
                'saturnSign': getattr(saturn, 'sign', None),
                'moonHouse': moon_house,
                'note': 'natal_basis_only_current_transit_requires_transit_chart',
            }
        }

    def compatibility_shell(self):
        return {
            'available': False,
            'reason': 'requires_second_chart',
            'supportedFutureMethods': ['kuta_matching', 'tara_bala', 'yoni', 'graha_maitri'],
        }


def build_jyotish(perchart, chartnum=1, d1_perchart=None, dasha_seed=None, sthira_start=None, dasha_system=None,
                  dasha_year_days=None, varga_variants=None, karaka_scheme=None, yuddha_criterion=None,
                  dasha_variants=None):
    """在 perchart(可为分盘) 上计算 Jyotish；d1_perchart 提供 always-D1 子项的 D1 盘。

    chartnum==1 且 d1_perchart 为 None、dasha_seed/dasha_system 缺省时退化为重构前行为
    (dasha_system 缺省 → 'vimshottari' 全展开,与历史字节一致)。
    dasha_seed 改大运起点(默认月亮宿;可选七政/节点/上升/特殊上升/副星)。
    dasha_system 选中的树形大运体系:仅该体系算完整三级(maha→antar→pratyantar),
    其余三树(vimshottari/yogini/ashtottari/tribhagi)只出 maha 顶层(剪 antar/pratyantar,顶层元数据与 maha 时间轴保留)。
    """
    return JyotishEngine(perchart, chartnum=chartnum, d1_perchart=d1_perchart, dasha_seed=dasha_seed,
                         dasha_year_days=dasha_year_days,
                         varga_variants=varga_variants, karaka_scheme=karaka_scheme,
                         yuddha_criterion=yuddha_criterion, dasha_variants=dasha_variants,
                         sthira_start=sthira_start, dasha_system=dasha_system).compute()
