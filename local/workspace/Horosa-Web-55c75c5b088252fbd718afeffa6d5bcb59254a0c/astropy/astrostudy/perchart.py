import copy
import threading
import flatlib
import datetime
import math
import traceback
import swisseph
from multiprocessing.dummy import Pool as ThreadPool
from flatlib.datetime import Datetime
from flatlib.geopos import GeoPos
from flatlib.chart import Chart
from flatlib import const
from flatlib import object
from flatlib import aspects
from flatlib.dignities import essential
from flatlib.dignities import tables
from flatlib.tools.chartdynamics import ChartDynamics
from flatlib import props
from flatlib import utils
from flatlib.tools import arabicparts
from flatlib.ephem import swe
from astrostudy.nakshatra import nakshatra_from_lon
from astrostudy import classical_tables as ctab
from astrostudy.helper import distance
from astrostudy.jieqi.realsuntime import getOffsetByDate

from astrostudy.perpredict import PerPredict
from astrostudy.guostarsect import guotables

dayerStar = [
    const.SUN,
    const.MOON,
    const.MARS,
    const.MERCURY,
    const.JUPITER,
    const.VENUS,
    const.SATURN,
]

dayofweekStr = [
    '周日', '周一', '周二', '周三', '周四', '周五', '周六',
]

timerStar = [
    const.SATURN,
    const.JUPITER,
    const.MARS,
    const.SUN,
    const.VENUS,
    const.MERCURY,
    const.MOON
]

SU28_MODE_REAL = 0
SU28_MODE_DOUBING = 1
SU28_MODE_MOIRA_CURRENT = 2
SU28_MODE_MOIRA_KAIXI = 3
SU28_MODE_ZHENG_SIDEREAL = 4
SU28_MODE_EQUATORIAL_SIDEREAL = 5   # G3/G4 赤道恒星制(制一):现代赤道距星案进动赤经定宿,planets 按赤经置宿,落宫仍黄道
SU28_MODE_GUFA_LICHENG = 6           # WP-D 授时历古法立成:推变黄道宿度(极黄经)按黄经置宿;古宿固定(元时·默认)或随岁差
SU28_MODE_EQUATORIAL_TROPICAL = 7    # 额外档·赤道回归制(元明):固定元明赤道宿度立成(春分/牛前冬至锚、赤经常数、不随岁差),行星按赤经落宿(与 mode5「宿随星走」正相反)
SU28_MODE_EQUATORIAL_TROPICAL_LIVE = 8   # 赤道回归·实时:宿宽=盘历元距星真赤经差(mode5 同源活体),锚=回归点(mode7 同款牛前冬至/春分壁2.3)——授时历「实测宿度+冬至锚」的活体版
ZHENG_SIDEREAL_MODE = {
    'mode': swe.SE_SIDM_USER,
    't0': 2195875.5,
    'ayan_t0': 4.0,
}

MOIRA_STELLAR_ORDER = [
    '娄', '胃', '昴', '毕', '觜', '参', '井', '鬼', '柳', '星', '张', '翼', '轸', '角',
    '亢', '氐', '房', '心', '尾', '箕', '斗', '牛', '女', '虚', '危', '室', '壁', '奎'
]

MOIRA_CURRENT_STELLAR_DEGREES = [
    15.9, 26.3, 41.1, 53.2, 69.0, 70.0, 81.8, 112.3, 115.2, 130.5, 136.4, 151.4,
    170.1, 187.2, 200.0, 208.9, 225.2, 230.6, 237.0, 255.6, 266.3, 290.1, 298.0,
    308.9, 318.3, 333.6, 349.4, 358.3
]

MOIRA_KAIXI_STELLAR_DEGREES = [
    16.0, 29.0, 44.0, 55.0, 70.5, 71.0, 80.0, 110.0, 113.0, 126.0, 133.0, 150.0,
    170.0, 189.0, 201.0, 211.0, 227.0, 233.0, 239.0, 256.0, 266.0, 288.0, 295.0,
    306.0, 315.0, 331.0, 349.0, 358.0
]

# 二十八宿距星 J2000 赤道坐标(自有星案,顺序同 MOIRA_STELLAR_ORDER 娄..奎)。
# 字段: (宿名, RA_h, RA_m, RA_s, dec_sign, Dec_d, Dec_m, Dec_s, pmRA, pmDec)。
# pmRA/pmDec 单位 0.01 (RA: s/yr 时秒; Dec: arcsec/yr)。
# 「回归今制」用此表逐宿做严格 IAU 岁差→盘历元 tropical 黄经(活体距星)。
MOIRA_DISTAR_J2000 = [
    ('娄', 1, 54, 38.401,  1, 20, 48, 28.82,  0.684, -11.11),
    ('胃', 3, 46, 50.889, -1, 23, 14, 58.97, -1.148, -52.91),
    ('昴', 3, 44, 48.180,  1, 24, 17, 21.44,  0.060,  -5.10),
    ('毕', 4, 28, 36.997,  1, 19, 10, 49.46,  0.756,  -3.77),
    ('觜', 5, 35,  8.419,  1,  9, 56,  3.96,  0.130,  -0.20),
    ('参', 5, 40, 45.520, -1,  1, 56, 33.30,  0.027,  -0.25),
    ('井', 6, 22, 57.621,  1, 22, 30, 48.79,  0.391, -11.10),
    ('鬼', 7, 49, 17.655, -1, 24, 51, 35.31, -0.022,  -0.18),
    ('柳', 11, 31, 24.248, 1, 69, 19, 51.87, -0.733,  -1.71),
    ('星', 8, 43, 35.545, -1, 33, 11, 11.02, -0.086,   1.08),
    ('张', 11, 46,  3.018, 1, 47, 46, 45.90, -1.361,   2.95),
    ('翼', 12, 26, 56.271, 1, 28, 16,  6.34, -0.626,  -8.02),
    ('轸', 12, 15, 48.366, -1, 17, 32, 30.97, -1.124,  2.33),
    ('角', 13, 25, 11.587, -1, 11,  9, 40.71, -0.278, -2.83),
    ('亢', 11, 35, 46.845, -1, 63,  1, 11.32, -0.606, -0.49),
    ('氐', 14, 56, 46.118, -1, 11, 24, 35.05,  0.076,  0.83),
    ('房', 15, 58, 51.120, -1, 26,  6, 50.75, -0.084, -2.55),
    ('心', 16, 21, 11.317, -1, 25, 35, 34.17, -0.076, -2.07),
    ('尾', 17, 14, 38.860,  1, 14, 23, 24.90, -0.046,  3.28),
    ('箕', 18,  5, 48.491, -1, 30, 25, 26.69, -0.412,-18.52),
    ('斗', 18, 24, 13.779,  1, 39, 30, 26.24, -0.200, -0.19),
    ('牛', 20, 21,  0.673, -1, 14, 46, 52.99,  0.291,  0.16),
    ('女', 20, 47, 40.559, -1,  9, 29, 44.74,  0.235, -3.43),
    ('虚', 21, 10, 20.518,  1, 10,  7, 53.57,  0.383,-15.33),
    ('危', 22,  5, 47.038, -1,  0, 19, 11.47,  0.131, -0.96),
    ('室', 23,  4, 45.658,  1, 15, 12, 18.90,  0.436, -4.25),
    ('壁', 23, 57, 45.535,  1, 25,  8, 28.98, -0.247, -3.32),
    ('奎',  0, 36, 52.858,  1, 33, 43,  9.63,  0.124, -0.40),
]

# 自有恒星案 ayanamsha 基准: 基准历元 1300-01-01, 基准黄经差 4.0°(与「恒星制」一致)。
MOIRA_AYAN_BASE_YMD = (1300, 1, 1, 0.0)
MOIRA_AYAN_BASE_DEG = 4.0


def _moira_ayanamsha(jd):
    """指定 jd 的 ayanamsha(SE_SIDM_USER, 基准 1300/4.0)。用于回归古制/恒星制基值→tropical 投射。

    ⚠️ 并发约定:set_sid_mode 是 swisseph 进程级全局态;下面 set→get 两行必须保持
    相邻直线代码(中间不得插入任何 Python 语句),否则多线程下会被其他制式抢改。
    钉子: tests/test_swe_concurrency.py。
    """
    y, m, d, h = MOIRA_AYAN_BASE_YMD
    swisseph.set_sid_mode(swisseph.SIDM_USER, swisseph.julday(y, m, d, h), MOIRA_AYAN_BASE_DEG)
    return swisseph.get_ayanamsa_ut(jd)


def _moira_distar_lon(rec, jd):
    """单颗距星 J2000 赤道坐标 → 盘历元 tropical 黄经(proper motion + 严格 IAU 岁差)。"""
    name, rh, rm, rs, sg, dd, dm, ds, pmra, pmdec = rec
    ra = (rh + rm / 60.0 + rs / 3600.0) * 15.0
    dec = sg * (dd + dm / 60.0 + ds / 3600.0)
    yr = (jd - 2451545.0) / 365.25
    ra += pmra * 0.01 * 15.0 * yr / 3600.0
    dec += pmdec * 0.01 * yr / 3600.0
    T = (jd - 2451545.0) / 36525.0
    zeta = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T ** 3) / 3600.0
    z = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T ** 3) / 3600.0
    th = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T ** 3) / 3600.0
    rr = math.radians(ra)
    dr = math.radians(dec)
    Z = math.radians(zeta)
    ZZ = math.radians(z)
    TH = math.radians(th)
    A = math.cos(dr) * math.sin(rr + Z)
    B = math.cos(TH) * math.cos(dr) * math.cos(rr + Z) - math.sin(TH) * math.sin(dr)
    C = math.sin(TH) * math.cos(dr) * math.cos(rr + Z) + math.cos(TH) * math.sin(dr)
    ra_d = math.atan2(A, B) + ZZ
    dec_d = math.asin(C)
    eps = math.radians(swisseph.calc_ut(jd, swisseph.ECL_NUT)[0][0])
    lon = math.degrees(math.atan2(
        math.sin(ra_d) * math.cos(eps) + math.tan(dec_d) * math.sin(eps),
        math.cos(ra_d))) % 360.0
    return (name, lon)


def _moira_distar_lons(jd):
    """全 28 距星盘历元 tropical 黄经,返回 {宿名: 黄经}。"""
    return dict(_moira_distar_lon(rec, jd) for rec in MOIRA_DISTAR_J2000)


def _moira_distar_ra(rec, jd):
    """单颗距星 J2000 赤道坐标 → 盘历元赤经(度;proper motion + IAU 进动,不转黄道)。G3 赤道恒星制用。"""
    name, rh, rm, rs, sg, dd, dm, ds, pmra, pmdec = rec
    ra = (rh + rm / 60.0 + rs / 3600.0) * 15.0
    dec = sg * (dd + dm / 60.0 + ds / 3600.0)
    yr = (jd - 2451545.0) / 365.25
    ra += pmra * 0.01 * 15.0 * yr / 3600.0
    dec += pmdec * 0.01 * yr / 3600.0
    T = (jd - 2451545.0) / 36525.0
    zeta = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T ** 3) / 3600.0
    z = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T ** 3) / 3600.0
    th = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T ** 3) / 3600.0
    rr = math.radians(ra)
    dr = math.radians(dec)
    Z = math.radians(zeta)
    ZZ = math.radians(z)
    TH = math.radians(th)
    A = math.cos(dr) * math.sin(rr + Z)
    B = math.cos(TH) * math.cos(dr) * math.cos(rr + Z) - math.sin(TH) * math.sin(dr)
    C = math.sin(TH) * math.cos(dr) * math.cos(rr + Z) + math.cos(TH) * math.sin(dr)
    ra_d = math.degrees(math.atan2(A, B) + ZZ) % 360.0
    dec_d = math.degrees(math.asin(C))
    return (name, ra_d, dec_d)


def _moira_distar_ras(jd):
    """全 28 距星盘历元赤经/赤纬,返回 [(宿名, 赤经, 赤纬)]。"""
    return [_moira_distar_ra(rec, jd) for rec in MOIRA_DISTAR_J2000]

SU28_ID_BY_NAME = dict(zip(const.LIST_FIXED_SU28_NAME, const.LIST_FIXED_SU28))


def excludeBad(x):
    return x != 'exile' and x != 'fall'

def isStrongGood(x):
    return x == 'exalt' or x == 'ruler'

custHouse_Equal_MC_Middle = 'Equal_MC_Middle'
# 福点整宫制：以本命福点(Part of Fortune)所在星座为第一宫的整宫制(whole-sign from Fortune)。
# 自定义标记，底盘走 WHOLE_SIGN(取真实 ASC/MC 角)，再在 custHouse() 把 12 宫头重定位到福点星座 0°起。
custHouse_Fortuna_Whole = 'Fortuna_Whole'

hsys=[
    const.HOUSES_WHOLE_SIGN,
    const.HOUSES_ALCABITUS,
    const.HOUSES_REGIOMONTANUS,
    const.HOUSES_PLACIDUS,
    const.HOUSES_KOCH,
    const.HOUSES_VEHLOW_EQUAL,
    const.HOUSES_POLICH_PAGE,
    const.HOUSES_SRIPATI,
    custHouse_Equal_MC_Middle,
    const.HOUSES_PORPHYRIUS,
    const.HOUSES_CAMPANUS,
    const.HOUSES_EQUAL,
    const.HOUSES_EQUAL_MC,
    const.HOUSES_MERIDIAN,
    const.HOUSES_AZIMUTHAL,
    const.HOUSES_MORINUS,
    const.HOUSES_CARTER_POLI_EQUATORIAL,
    const.HOUSES_SUNSHINE,
    const.HOUSES_SUNSHINE_ALT,
    const.HOUSES_KRUSINSKI,
    const.HOUSES_PULLEN_SD,
    const.HOUSES_PULLEN_SR,
    const.HOUSES_APC,
    const.HOUSES_SAVARD_A,
    custHouse_Fortuna_Whole
]

LOTS = [
    const.PARS_FORTUNA,
    arabicparts.PARS_SPIRIT,
    arabicparts.PARS_FAITH,
    arabicparts.PARS_SUBSTANCE,
    arabicparts.PARS_WEDDING_MALE,
    arabicparts.PARS_WEDDING_FEMALE,
    arabicparts.PARS_SONS,
    arabicparts.PARS_FATHER,
    arabicparts.PARS_MOTHER,
    arabicparts.PARS_BROTHERS,
    arabicparts.PARS_DISEASES,
    arabicparts.PARS_DEATH,
    arabicparts.PARS_TRAVEL,
    arabicparts.PARS_FRIENDS,
    arabicparts.PARS_ENEMIES,
    arabicparts.PARS_SATURN,
    arabicparts.PARS_JUPITER,
    arabicparts.PARS_MARS,
    arabicparts.PARS_VENUS,
    arabicparts.PARS_MERCURY,
    arabicparts.PARS_HORSEMANSHIP,
    arabicparts.PARS_LIFE,
    arabicparts.PARS_RADIX,
    # 希腊化补全六点(基础/旺宫为四要点其二,补齐后显赫指标「四显赫点」方可实算)
    arabicparts.PARS_BASIS,
    arabicparts.PARS_EXALTATION,
    arabicparts.PARS_SONS_VALENS,
    arabicparts.PARS_DAUGHTERS,
    arabicparts.PARS_PRAXIS,
    arabicparts.PARS_WEDDING_DOROTHEAN,
]

# 窄域天体的星历数据域(JD,二分实测后各收 1 天安全边;其余天体与主行星同全域)。
# 旧降级表在凯龙域外把 Pholus/Ceres/Pallas/Juno/Vesta/Intp_* 一并剔除——现按各自域
# 精确取舍:域内在场、域外缺席,PerChart 下游对 objlists 内任何星的取用都保证命中。
BODY_JD_DOMAIN = {
    const.CHIRON: (1967602.5, 3419436.2),      # AD 675 ~ 4649
    const.PHOLUS: (640648.6, 4390615.4),       # BC 2960 ~ AD 7308
    const.INTP_APOG: (625000.6, 2817999.5),    # BC 3002 ~ AD 3003
    const.INTP_PERG: (625000.6, 2817999.5),
}


def objectsForJD(jd):
    """按儒略日筛全星表:窄域天体仅在其数据域内纳入。"""
    res = []
    for o in const.LIST_OBJECTS:
        dom = BODY_JD_DOMAIN.get(o)
        if dom and not (dom[0] <= jd <= dom[1]):
            continue
        res.append(o)
    return res


def getHSys(house):
    try:
        house = int(house)
    except (TypeError, ValueError):
        return const.HOUSES_WHOLE_SIGN
    if house < 0 or house >= len(hsys):
        return const.HOUSES_WHOLE_SIGN
    return hsys[house]


def takeDelta(obj):
    return obj['delta']

def takeAsp(obj):
    return obj['asp']

def takeRa(obj):
    return obj.ra

def takeDecl(obj):
    return obj.decl

def takeLon(obj):
    return obj.lon

def takeAttackDelta(stars):
    delta = (stars[1]['lon'] - stars[0]['lon'] + 360) % 360
    return delta

# 偕日相可见弧 arcus visionis(度,标准值,可入设置微调):内行星偏小、外行星偏大。
# 日下细分:核心 cazimi ≤16′、焦伤 combust <8°、日光束下 underBeams <arcus、否则自由光 free。
ARCUS_VISIONIS = {
    const.MERCURY: 10.0, const.VENUS: 5.0, const.MARS: 11.5, const.JUPITER: 10.0, const.SATURN: 11.0,
}


# 界系(bounds/terms)三套表:0 埃及(默认)/1 托勒密 Tetrabiblos/2 莉莉。essential.TERMS 是模块级全局,
# 所有界主相关计算(尊贵/界主/互容接纳/围攻日木互容/主限法界)都读它。CherryPy 多线程下:/chart 请求级
# 用锁包住「换表→整盘计算(尊贵+接纳+围攻+predictives)→还原」,防并发请求串界;默认 0=埃及 与现状逐字一致。
_TERMS_TABLES = [tables.EGYPTIAN_TERMS, tables.TETRABIBLOS_TERMS, tables.LILLY_TERMS]
# G15 托勒密界·狮子土星优先变体:狮子段首星 Jupiter↔Saturn 互换(度界 0-6/13-19 不变),余座同托勒密。
# 默认走 _TERMS_TABLES[1](木优先);仅 leoBoundFirst 且 termsVariant==1 时换本表。
_TETRABIBLOS_LEO_SATURN_FIRST = copy.deepcopy(tables.TETRABIBLOS_TERMS)
_TETRABIBLOS_LEO_SATURN_FIRST['Leo'] = [['Saturn', 0, 6], ['Mercury', 6, 13], ['Jupiter', 13, 19], ['Venus', 19, 25], ['Mars', 25, 30]]

# 托勒密界·经典传本(termsVariant==2)双子界4/5 校勘口径:原书 ♄21–25/♂25–30 → 校勘本对调 ♂21–25/♄25–30。
# 仅 geminiBoundEmended 且 termsVariant==2 时换本表;默认忠原书(零回归)。与 leoBoundFirst 同款请求级开关。
_LILLY_GEMINI_EMENDED = copy.deepcopy(tables.LILLY_TERMS)
_LILLY_GEMINI_EMENDED['Gemini'] = [['Mercury', 0, 7], ['Jupiter', 7, 14], ['Venus', 14, 21], ['Mars', 21, 25], ['Saturn', 25, 30]]

# G15 迦勒底界(界系 3·推演慎用):宽度 [8,7,6,5,4](和 30),星序按元素昼序;夜盘土↔水位置互换。
# 仅白羊有源、余按规则推演(故 UI 标「推演·慎用」)。按 sect 预生成昼/夜两表,perchart 据 isDiurnal 选。
_CHALDEAN_WIDTHS = [8, 7, 6, 5, 4]
_CHALDEAN_DAY_ORDER = {
    'Fire':  ['Jupiter', 'Venus', 'Saturn', 'Mercury', 'Mars'],
    'Earth': ['Venus', 'Saturn', 'Mercury', 'Mars', 'Jupiter'],
    'Air':   ['Saturn', 'Mercury', 'Mars', 'Jupiter', 'Venus'],
    'Water': ['Mercury', 'Venus', 'Saturn', 'Mars', 'Jupiter'],
}
_CHALDEAN_SIGN_ELEMENT = {
    'Aries': 'Fire', 'Leo': 'Fire', 'Sagittarius': 'Fire',
    'Taurus': 'Earth', 'Virgo': 'Earth', 'Capricorn': 'Earth',
    'Gemini': 'Air', 'Libra': 'Air', 'Aquarius': 'Air',
    'Cancer': 'Water', 'Scorpio': 'Water', 'Pisces': 'Water',
}

def _build_chaldean_terms(night=False):
    tbl = {}
    for sign, elem in _CHALDEAN_SIGN_ELEMENT.items():
        order = list(_CHALDEAN_DAY_ORDER[elem])
        if night:   # 夜盘:土↔水位置互换
            si, mi = order.index('Saturn'), order.index('Mercury')
            order[si], order[mi] = order[mi], order[si]
        segs, start = [], 0
        for lord, w in zip(order, _CHALDEAN_WIDTHS):
            segs.append([lord, start, start + w]); start += w
        tbl[sign] = segs
    return tbl

_CHALDEAN_TERMS_DAY = _build_chaldean_terms(False)
_CHALDEAN_TERMS_NIGHT = _build_chaldean_terms(True)
_PERCHART_TERMS_LOCK = threading.Lock()


def parse_terms_variant(v):
    """界系入参 → 合法 0/1/2/3(非法回落 0=埃及)。3=迦勒底界(推演慎用)。"""
    try:
        tv = int(v)
    except (TypeError, ValueError):
        tv = 0
    return tv if tv in (0, 1, 2, 3) else 0


def push_request_terms(termsVariant, leoBoundFirst=False, geminiBoundEmended=False):
    """/chart 请求级界系:获取锁 + 换 essential.TERMS,返回还原令牌(原表);必须在 finally 配对 pop_request_terms。
    G15:leoBoundFirst 且托勒密界·校勘本(tv==1)时换狮子土星优先变体表;默认木优先零回归。
    卜卦 2b:geminiBoundEmended 且经典传本(tv==2)时换双子校勘口径表;默认忠原书零回归。"""
    tv = parse_terms_variant(termsVariant)
    _PERCHART_TERMS_LOCK.acquire()
    orig = essential.TERMS
    if tv == 3:
        essential.TERMS = _CHALDEAN_TERMS_DAY   # 迦勒底界:先昼表;夜盘由 perchart setupPlanets 据 isDiurnal 换夜表(锁内安全)
    elif tv == 1 and leoBoundFirst in (True, 1, '1', 'true'):
        essential.TERMS = _TETRABIBLOS_LEO_SATURN_FIRST
    elif tv == 2 and geminiBoundEmended in (True, 1, '1', 'true'):
        essential.TERMS = _LILLY_GEMINI_EMENDED
    else:
        essential.TERMS = _TERMS_TABLES[tv]
    return orig


def pop_request_terms(token):
    """还原 essential.TERMS 并释放锁;token=None(未 push)时安全 no-op。"""
    if token is None:
        return
    try:
        essential.TERMS = token
    finally:
        _PERCHART_TERMS_LOCK.release()


# G20-P2 三分集变体:默认 Dorothean(=ESSENTIAL_DIGNITIES,零回归);Ptolemaic 二主(无共同主、水象单主火星)。
# essential.TABLE 是模块级全局(尊贵评分/almuten 读 trip);请求级换表(同 terms 机制,独立锁)。
_PTOL_TRIP = {
    'Fire': ['Sun', 'Jupiter', ''], 'Earth': ['Venus', 'Moon', ''],
    'Air': ['Saturn', 'Mercury', ''], 'Water': ['Mars', 'Mars', ''],
}

def _build_ptolemaic_dignities():
    tbl = copy.deepcopy(tables.ESSENTIAL_DIGNITIES)
    for sign, elem in _CHALDEAN_SIGN_ELEMENT.items():
        if sign in tbl:
            tbl[sign]['trip'] = list(_PTOL_TRIP[elem])
    return tbl

_PTOLEMAIC_DIGNITIES = _build_ptolemaic_dignities()

# PtolemaicWaterVariant(托勒密·水象变体):火/土/风三象同托勒密二主;唯水象座(巨蟹/天蝎/双鱼)
# 改取另一套水象主星——昼盘 火主+金次、夜盘 火主+月次(对齐前端 triplicityRulers.js / hellenisticData
# Water.text_variant: day=[Mars,Venus] / night=[Mars,Moon])。
# essential.score()/getInfo() 非 sect-aware(dayTrip/nightTrip 一律各 +3,不查 isDiurnal),
# 故单张静态 trip 三元无法把「昼第二主=金、夜第二主=月」的区别投影到评分上(两套的曜集合都是 {火,金,月},
# 与默认水象 [Venus,Mars,Moon] 同集合→评分塌成默认)。因此按 sect 预生成昼/夜两表:
#   昼:水象 trip=[Mars, Venus, '']  → 评分计 火(昼主)+金(昼次)
#   夜:水象 trip=[Mars, Moon,  '']  → 评分计 火(夜主)+月(夜次)
# push_request_trip 先置昼表(锁内),夜盘由 perchart.setupPlanets 据 isDiurnal 换夜表(同迦勒底界夜表机制)。
_PTOL_WATER_TRIP_DAY = ['Mars', 'Venus', '']
_PTOL_WATER_TRIP_NIGHT = ['Mars', 'Moon', '']

def _build_ptolemaic_water_variant_dignities(night=False):
    # 起点=普通托勒密表(火/土/风三象二主不变),仅水象座覆盖为昼/夜专表 → 非水象座与 Ptolemaic 字节一致。
    tbl = copy.deepcopy(_PTOLEMAIC_DIGNITIES)
    water_trip = _PTOL_WATER_TRIP_NIGHT if night else _PTOL_WATER_TRIP_DAY
    for sign, elem in _CHALDEAN_SIGN_ELEMENT.items():
        if elem == 'Water' and sign in tbl:
            tbl[sign]['trip'] = list(water_trip)
    return tbl

_PTOLEMAIC_WATER_VARIANT_DIGNITIES_DAY = _build_ptolemaic_water_variant_dignities(night=False)
_PTOLEMAIC_WATER_VARIANT_DIGNITIES_NIGHT = _build_ptolemaic_water_variant_dignities(night=True)
_PERCHART_TRIP_LOCK = threading.Lock()

def push_request_trip(triplicity):
    """G20-P2 请求级三分集:Ptolemaic 换 essential.TABLE 的 trip;默认 Dorothean 不动零回归。配对 pop_request_trip。
    PtolemaicWaterVariant:先置水象变体「昼」表(火/土/风同托勒密,水象昼=火+金);夜盘由 setupPlanets 据
    isDiurnal 换「夜」表(水象夜=火+月)——sect 区分仅在水象座可见(火/土/风与 Ptolemaic 一致)。"""
    tv = str(triplicity or 'Dorothean')
    if tv not in ('Ptolemaic', 'PtolemaicWaterVariant'):
        return None
    _PERCHART_TRIP_LOCK.acquire()
    orig = essential.TABLE
    if tv == 'PtolemaicWaterVariant':
        essential.TABLE = _PTOLEMAIC_WATER_VARIANT_DIGNITIES_DAY
    else:
        essential.TABLE = _PTOLEMAIC_DIGNITIES
    return orig

def pop_request_trip(token):
    """还原 essential.TABLE 并释放锁;token=None(未 push,默认 Dorothean)时安全 no-op。"""
    if token is None:
        return
    try:
        essential.TABLE = token
    finally:
        _PERCHART_TRIP_LOCK.release()


# ── 旺位异文两开关(月交点旺 / 土星旺 20°)请求级参数化 ────────────────────
# 二者皆改 essential.TABLE 的 exalt/fall 位 ⇒ 会动全盘尊贵计分,故一律默认关(零回归),
# 仅显式开启才 锁+换表,finally 配对 pop。照 push_request_trip 同款范式(pop(None)=no-op)。
#   nodeExaltation:北交旺 3°双子 / 南交旺 3°射手(对宫互为落);少数派传统,文档标「可作软件开关」。
#   saturnExalt20 :土星旺 天秤 20°(默认 21°);少数异文。
# 🔴 必须用独立锁:本开关叠加在 push_request_trip 之后(同线程),复用 _PERCHART_TRIP_LOCK 会自锁死。
#    两者串行嵌套(trip 先 push、exalt 后 push;pop 反序),各自持锁不交叉,无 ABBA 风险。
_PERCHART_EXALT_LOCK = threading.Lock()
_SATURN_EXALT_DEFAULT_DEG = 21
_SATURN_EXALT_VARIANT_DEG = 20


def _build_dignities_variant(base_table, node_exalt=False, saturn20=False):
    """在给定基表上叠加旺位异文;不改基表本身(深拷贝)。"""
    tbl = copy.deepcopy(base_table)
    if node_exalt:
        # 交点无 ruler/trip/face 语义,仅置 exalt/fall 两位(essential.score 只查这两处)
        if 'Gemini' in tbl:
            tbl['Gemini']['exalt'] = [const.NORTH_NODE, 3]
            tbl['Gemini']['fall'] = [const.SOUTH_NODE, 3]
        if 'Sagittarius' in tbl:
            tbl['Sagittarius']['exalt'] = [const.SOUTH_NODE, 3]
            tbl['Sagittarius']['fall'] = [const.NORTH_NODE, 3]
    if saturn20:
        if 'Libra' in tbl and tbl['Libra'].get('exalt') and tbl['Libra']['exalt'][0] == const.SATURN:
            tbl['Libra']['exalt'] = [const.SATURN, _SATURN_EXALT_VARIANT_DEG]
        # 土星之落(白羊)随旺度同步为对宫同度,保持旺落对称
        if 'Aries' in tbl and tbl['Aries'].get('fall') and tbl['Aries']['fall'][0] == const.SATURN:
            tbl['Aries']['fall'] = [const.SATURN, _SATURN_EXALT_VARIANT_DEG]
    return tbl


def _truthy(v):
    return v in (1, '1', True, 'true', 'True')


def push_request_exalt_variants(nodeExaltation=None, saturnExalt20=None):
    """请求级旺位异文:两者全关 → 不 push(返回 None,零锁开销零回归);任一开 → 锁+叠加换表。
    在当前 essential.TABLE(可能已被 push_request_trip 换成托勒密表)之上叠加,故两层可共存。"""
    node_on = _truthy(nodeExaltation)
    sat_on = _truthy(saturnExalt20)
    if not node_on and not sat_on:
        return None
    _PERCHART_EXALT_LOCK.acquire()
    orig = essential.TABLE
    essential.TABLE = _build_dignities_variant(orig, node_exalt=node_on, saturn20=sat_on)
    return orig


def pop_request_exalt_variants(token):
    """还原 essential.TABLE 并释放锁;token=None(未 push)时安全 no-op。"""
    if token is None:
        return
    try:
        essential.TABLE = token
    finally:
        _PERCHART_EXALT_LOCK.release()


# ── 落宫宫头前移(five-degree rule)请求级参数化 ─────────────────────────────
# flatlib House._OFFSET 是类全局(-5.0=传统 5° 律):象限制 inHouse 以 [cusp+OFFSET, +size) 收纳,
# 星距下一宫头 |OFFSET|° 内前移入下一宫;整宫制分支天然豁免(无偏移)。落宫输出(object.house/
# house.planets/四角 house)全走 getHouseByLon→inHouse → 换 OFFSET 即全站落宫随动,且随当前 hsys 宫表。
# 照 push_request_trip 范式:默认 5° 不 push(零回归零锁开销);仅非默认才 锁+换值,finally 配对 pop。
_PERCHART_HOUSE_OFFSET_LOCK = threading.Lock()
_HOUSE_CUSP_ADVANCE_DEFAULT = 5.0

def _optional_float(v):
    """None/缺省/畸形 → None(调用方回落现值);数字/数串 → float。"""
    if v is None or v == '':
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def parse_house_cusp_advance(v):
    """收编 houseCuspAdvance(度):仅认 0/1/3/5,缺省/畸形一律回 5=现状。"""
    try:
        n = float(v)
    except (TypeError, ValueError):
        return _HOUSE_CUSP_ADVANCE_DEFAULT
    return n if n in (0.0, 1.0, 3.0, 5.0) else _HOUSE_CUSP_ADVANCE_DEFAULT

def push_request_house_offset(houseCuspAdvance):
    """请求级换 House._OFFSET;返回还原令牌(原值)或 None(默认未 push)。必须 finally 配对 pop。"""
    adv = parse_house_cusp_advance(houseCuspAdvance)
    if adv == _HOUSE_CUSP_ADVANCE_DEFAULT:
        return None
    _PERCHART_HOUSE_OFFSET_LOCK.acquire()
    orig = object.House._OFFSET
    object.House._OFFSET = -adv
    return orig

def pop_request_house_offset(token):
    """还原 House._OFFSET 并释放锁;token=None(未 push)时安全 no-op。"""
    if token is None:
        return
    try:
        object.House._OFFSET = token
    finally:
        _PERCHART_HOUSE_OFFSET_LOCK.release()


class PerChart:

    @staticmethod
    def parseSu28Mode(value):
        if isinstance(value, bool):
            return SU28_MODE_DOUBING if value else SU28_MODE_REAL
        if value is None:
            return SU28_MODE_REAL
        if isinstance(value, str):
            txt = value.strip().lower()
            if txt == 'true':
                return SU28_MODE_DOUBING
            if txt == 'false' or txt == '':
                return SU28_MODE_REAL
        try:
            mode = int(value)
        except:
            return SU28_MODE_REAL
        if mode in (SU28_MODE_REAL, SU28_MODE_DOUBING, SU28_MODE_MOIRA_CURRENT, SU28_MODE_MOIRA_KAIXI, SU28_MODE_ZHENG_SIDEREAL, SU28_MODE_EQUATORIAL_SIDEREAL, SU28_MODE_GUFA_LICHENG, SU28_MODE_EQUATORIAL_TROPICAL, SU28_MODE_EQUATORIAL_TROPICAL_LIVE):
            return mode
        return SU28_MODE_REAL

    def __init__(self, data):
        self.data = data

        # ── 古典口径请求级参数(全局设置「星盘组件」;缺省 None/默认=各保现硬编码值,零回归)──
        # 太阳三态阈值:传键时 sunPos(合相口径)与 phase(可见弧口径)两套统一吃全局值;
        # 缺省时各保历史现值(sunPos 17'/8.5/17,phase 16'/8),phase 日光束界恒逐星 arcus visionis。
        _cz = _optional_float(data.get('cazimiOrb'))
        _cb = _optional_float(data.get('combustOrb'))
        _ub = _optional_float(data.get('underBeamsOrb'))
        self._sunPosCazimi = _cz if _cz is not None else 17.0 / 60.0
        self._sunPosCombust = _cb if _cb is not None else 8.5
        self._sunPosBeams = _ub if _ub is not None else 17.0
        self._phaseCazimi = _cz if _cz is not None else 16.0 / 60.0
        self._phaseCombust = _cb if _cb is not None else 8.0
        # 恒星合相轨:starOrb 平轨(默认 1°=现状);starOrbMode='byMagnitude' 走 FixedStar.orb() 星等表。
        _so = _optional_float(data.get('starOrb'))
        self._starOrb = _so if _so is not None else 1.0
        self._starOrbByMag = (data.get('starOrbMode') == 'byMagnitude')
        # 映点接触容许度(同座 signlon 差,默认 1°=现状)。
        _ao = _optional_float(data.get('antisciaOrb'))
        self._antisciaOrb = _ao if _ao is not None else 1.0
        # 月亮空亡口径(六口径,默认 lilly=现实现「无入相/正合主相位即空」;前端 'classic'/'backend' 同义)。
        _vm = data.get('vocMode') or 'lilly'
        self._vocMode = 'lilly' if _vm in ('classic', 'backend') else _vm
        self._vocIncludeOuter = bool(data.get('vocIncludeOuter'))
        # 燃烧之路边界(默认 standard=195–225 传统口径;2026-07 用户拍板由旧窄口径 208–217 归正,
        # 旧值以 'narrow' 档保留)。畸形键回默认。
        self._viaCombustaRange = self._VIA_COMBUSTA_RANGES.get(
            data.get('viaCombustaVariant') or 'standard', self._VIA_COMBUSTA_RANGES['standard'])

        date = data['date']
        self.time = data['time']
        self.zone = data['zone']
        self.lat = data['lat']
        self.lon = data['lon']

        parts = date.split('/')
        if len(parts) == 1:
            parts = date.split('-')
        if len(parts) == 4:
            self.year = '-{0}'.format(parts[1])
            self.month = parts[2]
            self.day = parts[3]
        else:
            self.year = parts[0]
            self.month = parts[1]
            self.day = parts[2]

        self.date = '{0}/{1}/{2}'.format(self.year, self.month, self.day)

        self.pdaspects = const.MAJOR_ASPECTS
        self.tradition = False
        self.house = const.HOUSES_WHOLE_SIGN
        self.strongRecption = True
        self.virtualPointReceiveAsp = False
        self.simpleAsp = False
        self.pdtype = 0
        self.pdMethod = 'core_alchabitius'
        # 投影×定局解耦(正交):pdProjection 决定弧、pdFrame 决定盘面宫始点。
        # None = 未显式指定 → 由 pdMethod 兼容映射推导(perpredict._PD_METHOD_TO_PAIR),
        # 全缺省时 = ('ptolemy','alcabitius') = 现状默认路径,字节零回归。
        self.pdProjection = None
        self.pdFrame = None
        self.pdTimeKey = 'Ptolemy'
        self.pdYears = 100
        # 自研引擎方位法的开关(仅 placidus / regio / campanus / topo 生效；core/legacy 不受影响）。
        # 默认「顺逆都开」(用户偏好):Alcabitius 走自有引擎本就含正负弧、忽略此开关;
        # 切到新方位法时默认两向都算、按年龄交错。
        self.pdDirect = True      # 顺向 direct(默认开)
        self.pdConverse = True    # 逆向 converse(默认开;可与 direct 同时开)
        self.pdAntiscia = False   # 映点/反映点作 promissor
        self.pdTerms = False      # 界(terms)边界作 promissor
        self.pdParallel = False       # 赤纬平行/反平行(映点法);pdtype=1 时为世界平行
        self.pdRaptParallel = False   # 急动平行(双动求根;仅世界主限)
        self.pdFramework = 'aspect'   # 框架:aspect 相位主限(默认)/bounds 界行/release 释放(hyleg)
        # S/P 清单扩展(默认 None=现状集,零回归):
        # pdSignificators 追加键 ∈ {Desc, IC, Syzygy, Spirit, Cusps};pdPromissorTypes ∈ {cusps}
        self.pdSignificators = None
        self.pdPromissorTypes = None
        self.pdTimeKeyCustom = None   # User 钥匙:自定义每年度数(仅 pdTimeKey='User' 时消费)
        self.termsVariant = 0         # 界系:0 埃及(默认)/1 托勒密/2 莉莉(PD 界行/分配星同用)

        self.isBC = False
        if 'ad' in data.keys():
            if int(data['ad']) == 1:
                self.isBC = False
            else:
                self.isBC = True
                if self.date[0:1] != '-':
                    self.date = '-{0}'.format(self.date)
                    self.year = '-{0}'.format(self.year)

        if self.year[0:1] == '-':
            self.isBC = True

        if 'strongRecption' in data.keys():
            self.strongRecption = data['strongRecption']

        if 'virtualPointReceiveAsp' in data.keys():
            self.virtualPointReceiveAsp = data['virtualPointReceiveAsp']
        if 'simpleAsp' in data.keys():
            self.simpleAsp = data['simpleAsp']

        self.houseCust = None
        if 'hsys' in data.keys():
            self.house = getHSys(data['hsys'])
            if self.house == custHouse_Equal_MC_Middle:
                self.house = const.HOUSES_ALCABITUS
                self.houseCust = custHouse_Equal_MC_Middle
            elif self.house == custHouse_Fortuna_Whole:
                self.house = const.HOUSES_WHOLE_SIGN
                self.houseCust = custHouse_Fortuna_Whole

        if 'pdaspects' in data.keys():
            # 🔴 空/非法相位集回落主相位默认:pdaspects 继承自主盘相位设置,用户在主盘
            # 清空相位会让主限表变成 0 行死表(合相 0 也是相位集成员,清空 = 连本体行都没有)。
            # 与其它参数「非法值回落默认」同口径;显式给出的非空集合原样尊重(零回归)。
            _asp = data['pdaspects']
            self.pdaspects = _asp if (isinstance(_asp, (list, tuple)) and len(_asp)) else const.MAJOR_ASPECTS

        self.southchart = False
        if 'southchart' in data.keys():
            self.southchart = data['southchart']

        if 'pdtype' in data.keys():
            self.pdtype = data['pdtype']

        if 'pdMethod' in data.keys():
            self.pdMethod = data['pdMethod']
            # whitelist 与 perpredict._PD_METHOD_REGISTRY 保持同步；未识别 method 一律
            # 回退到默认 Alcabitius (core_alchabitius)，护住默认路径字节级一致。
            if self.pdMethod not in ('core_alchabitius', 'horosa_legacy', 'placidus',
                                     'regiomontanus', 'campanus', 'topocentric',
                                     'meridian', 'porphyry', 'equal_ecliptic',
                                     'equal_hour_circle', 'morinus',
                                     'in_zodiaco_lon', 'in_zodiaco_abs'):
                self.pdMethod = 'core_alchabitius'

        if 'pdProjection' in data.keys():
            v = '{0}'.format(data['pdProjection'] or '')
            if v in ('ptolemy', 'placidus', 'regiomontanus', 'campanus', 'topocentric',
                     'zodiacal', 'ra_direct', 'in_zodiaco_lon', 'in_zodiaco_abs', 'horosa_legacy',
                     'placidus_under_pole'):
                self.pdProjection = v
        if 'pdFrame' in data.keys():
            v = '{0}'.format(data['pdFrame'] or '')
            if v in ('alcabitius', 'placidus', 'regiomontanus', 'campanus', 'topocentric',
                     'meridian', 'porphyry', 'equal', 'wholesign', 'morinus', 'koch',
                     'equal_hour_circle'):
                self.pdFrame = v

        if 'pdTimeKey' in data.keys():
            self.pdTimeKey = data['pdTimeKey']

        if 'pdYears' in data.keys():
            try:
                # 上限 3000 年:>360 走多圈复发行(perpredict._extendCorePdRecurrences),≤360 与既往逐位一致。
                self.pdYears = max(1, min(3000, int(round(float(data['pdYears'])))))
            except (TypeError, ValueError):
                self.pdYears = 100

        def _truthy(v):
            return v is True or v == 1 or v == '1' or v == 'true'
        if 'pdDirect' in data.keys():
            # 顺向默认开;仅当显式传 0/false 才关。
            v = data['pdDirect']
            self.pdDirect = not (v is False or v == 0 or v == '0' or v == 'false')
        if 'pdConverse' in data.keys():
            self.pdConverse = _truthy(data['pdConverse'])
        if 'pdAntiscia' in data.keys():
            self.pdAntiscia = _truthy(data['pdAntiscia'])
        if 'pdTerms' in data.keys():
            self.pdTerms = _truthy(data['pdTerms'])
        if 'pdParallel' in data.keys():
            self.pdParallel = _truthy(data['pdParallel'])
        if 'pdRaptParallel' in data.keys():
            self.pdRaptParallel = _truthy(data['pdRaptParallel'])
        if 'pdFramework' in data.keys():
            v = '{0}'.format(data['pdFramework'] or '')
            if v in ('aspect', 'bounds', 'release'):
                self.pdFramework = v
        def _strlist(v):
            if isinstance(v, (list, tuple)):
                return [str(x) for x in v]
            if isinstance(v, str) and v.strip():
                return [x.strip() for x in v.split(',') if x.strip()]
            return None
        if 'pdSignificators' in data.keys():
            vs = _strlist(data['pdSignificators'])
            if vs is not None:
                allow = ('Desc', 'IC', 'Syzygy', 'Spirit', 'Cusps', 'Stars', 'Lots')
                self.pdSignificators = [x for x in vs if x in allow] or None
        if 'pdPromissorTypes' in data.keys():
            vs = _strlist(data['pdPromissorTypes'])
            if vs is not None:
                self.pdPromissorTypes = [x for x in vs if x in ('cusps', 'stars', 'lots')] or None
        if 'pdTimeKeyCustom' in data.keys():
            try:
                v = float(data['pdTimeKeyCustom'])
                if 0.001 <= v <= 30.0:
                    self.pdTimeKeyCustom = v
            except (TypeError, ValueError):
                pass
        if 'termsVariant' in data.keys():
            self.termsVariant = parse_terms_variant(data['termsVariant'])

        # 容许度自定义：orbs(逐星 id->度) / orbScale(全局倍数)。默认 None → 盘对象 orb() 回退默认表，零回归。
        self.orbOverrides = None
        self.orbScale = None
        if isinstance(data.get('orbs'), dict):
            try:
                self.orbOverrides = {k: float(v) for k, v in data['orbs'].items() if v is not None and str(v) != ''}
            except (TypeError, ValueError):
                self.orbOverrides = None
        if 'orbScale' in data.keys():
            try:
                sc = float(data['orbScale'])
                self.orbScale = sc if sc > 0 else None
            except (TypeError, ValueError):
                self.orbScale = None

        self.su28Mode = self.parseSu28Mode(data.get('doubingSu28', SU28_MODE_REAL))
        # WP-D 授时历古法(mode6)子参:推变法(jiyuan闭式·默认/jintui进退/huiyuan会圆) + 古宿是否随岁差(默认固定·元时永不变)。
        _tm = str(data.get('guolaoTuibianMethod', 'jiyuan') or 'jiyuan')
        self.guolaoTuibianMethod = _tm if _tm in ('jiyuan', 'jintui', 'huiyuan') else 'jiyuan'
        self.guolaoGufaPrecess = 1 if data.get('guolaoGufaPrecess') in (1, '1', True) else 0
        # 赤道回归制(mode7)锚定(做成选项):dongzhi 牛前冬至 270°(默认) / chunfen 春分壁2.3°。
        self.guolaoEqTropicalAnchor = 'chunfen' if str(data.get('guolaoEqTropicalAnchor', '') or '').strip() == 'chunfen' else 'dongzhi'
        self.isZhengSidereal = self.su28Mode == SU28_MODE_ZHENG_SIDEREAL or data.get('guolaoZhengSidereal') == 1 or data.get('guolaoZhengSidereal') == '1'

        self.zodiacal = const.TROPICAL
        if 'zodiacal' in data.keys():
            if data['zodiacal'] == 1 or data['zodiacal'] == const.SIDEREAL:
                self.zodiacal = const.SIDEREAL
        if self.isZhengSidereal:
            self.zodiacal = const.SIDEREAL

        self.dateTime = Datetime(self.date, self.time, self.zone)
        self.pos = GeoPos(self.lat, self.lon)

        self.objlists = []

        jd = self.dateTime.jd
        # 凯龙域内=全表(与旧行为字节一致);域外=按各天体数据域精确筛
        #(旧版整组剔除小行星,致 relative/midpoint 等在古代/远期缺 Ceres 等全域可算天体)。
        if 1967601.5 <= jd <= 3419437.5:
            self.objlists.extend(const.LIST_OBJECTS)
        else:
            self.objlists.extend(objectsForJD(jd))

        if 'objlists' in data.keys():
            self.objlists = data['objlists']
        objset = set(self.objlists)
        self.hasSun = const.SUN in objset
        self.hasMoon = const.MOON in objset
        if not self.hasMoon:
            self.objlists.append(const.MOON)
        if not self.hasSun:
            self.objlists.append(const.SUN)

        self.eastRa = None
        self.isDoubingSu28 = self.su28Mode == SU28_MODE_DOUBING
        # 用户在「黄道 → 恒星黄道」下选了具体 ayanāṃśa(Lahiri/Raman/KP… 全 47)→ 用该模式;
        # 缺省(空)走 Swiss Ephemeris 现默认,与改前逐位一致,向后兼容。
        self.siderealAyanamsa = ''
        siderealMode = None
        ayan_key = data.get('siderealAyanamsa') or data.get('ayanamsa') or ''
        if self.isZhengSidereal:
            # G2(七政恒星制历元可选):用户显式选 ayanāṃśa 则优先,否则回落郑氏(默认=零回归)。
            if ayan_key:
                try:
                    from astrostudy.india.india_chart_kernel import normalize_ayanamsa
                    resolved = normalize_ayanamsa(ayan_key)
                    siderealMode = resolved
                    self.siderealAyanamsa = resolved.get('key', '')
                except Exception:
                    siderealMode = ZHENG_SIDEREAL_MODE
            else:
                siderealMode = ZHENG_SIDEREAL_MODE
        elif self.zodiacal == const.SIDEREAL and ayan_key:
            try:
                from astrostudy.india.india_chart_kernel import normalize_ayanamsa
                resolved = normalize_ayanamsa(ayan_key)
                siderealMode = resolved
                self.siderealAyanamsa = resolved.get('key', '')
            except Exception:
                siderealMode = None
        self.siderealMode = siderealMode

        self.needpars = True
        if 'needpars' in data.keys():
            self.needpars = False

        ids = []
        ids.extend(self.objlists)

        if self.tradition:
            self.chart = Chart(self.dateTime, self.pos, self.zodiacal, hsys=self.house, needpars=self.needpars, sidereal_mode=siderealMode)
        else:
            self.chart = Chart(self.dateTime, self.pos, self.zodiacal,
                               hsys=self.house, IDs=ids, needpars=self.needpars, sidereal_mode=siderealMode)
        if const.SATURN in objset and const.MARS in objset and const.JUPITER in objset and const.VENUS in objset:
            self.objlists.extend(const.LIST_MIDDLE_POINTS)

        self.applyGuolaoSiyu()   # G10/G11 四余真交点/真远地点(默认平算零回归;在 reinit 前,宿度随新 lon 重算)

        self.custHouse()

        if self.southchart and self.pos.lat < 0:
            self.setupSouthChart()
        else:
            self.reinit()

    def applyGuolaoSiyu(self):
        """G10/G11 四余取法:罗计真交点(SE_TRUE_NODE=11)/月孛真远地点(SE_OSCU_APOG=13)。
        默认平交点(10)/平远地点(12)零回归;仅 guolaoNodeType=='true'/guolaoLilithType=='true' 触发。
        占星(希腊化)G12:西占月交点真平共用本链路 —— westNodeType=='true' 同样触发真交点置换
        (与 guolaoNodeType 等效,默认 mean 零回归;两键互不污染:七政走 guolao*、西占走 west*)。
        复用 chart 自身 sidereal context+flags;本调用在 reinit(setupPlanets)前,宿度随新 lon 重算。
        失败安全回退保留平算(同 india _apply_true_node:南交=北交 lon/ra+180,lat/decl 不取负)。"""
        data = self.data if isinstance(self.data, dict) else {}
        nodeTrue = (data.get('guolaoNodeType', 'mean') == 'true'
                    or data.get('westNodeType', 'mean') == 'true')
        lilithTrue = data.get('guolaoLilithType', 'mean') == 'true'
        if not nodeTrue and not lilithTrue:
            return
        jd = self.dateTime.jd
        flags = getattr(self.chart, 'flags', swe.SEDEFAULT_FLAG)

        def calc(swid):
            with self.chart._siderealContext():
                pos = swe.swisseph.calc_ut(jd, swid, flags)[0]
                eq = swe.swisseph.calc_ut(jd, swid, flags | swe.SEFLG_EQUATORIAL)[0]
            ra = eq[0] if eq[0] >= 0 else (eq[0] + 360) % 360
            return pos, eq, ra

        def findobj(objid):
            return next((o for o in self.chart.objects if getattr(o, 'id', None) == objid), None)

        if nodeTrue:
            north = findobj(const.NORTH_NODE)
            south = findobj(const.SOUTH_NODE)
            if north is not None or south is not None:
                try:
                    pos, eq, ra = calc(11)
                except Exception:
                    pos = None
                if pos is not None:
                    if north is not None:
                        north.relocate(pos[0])
                        north.lat = pos[1]; north.lonspeed = pos[3]; north.latspeed = pos[4]
                        north.ra = ra; north.decl = eq[1]
                    if south is not None:
                        south.relocate((pos[0] + 180.0) % 360.0)
                        south.lat = pos[1]; south.lonspeed = pos[3]; south.latspeed = pos[4]
                        south.ra = (ra + 180.0) % 360.0; south.decl = eq[1]

        if lilithTrue:
            darkmoon = findobj(const.DARKMOON)
            if darkmoon is not None:
                try:
                    pos, eq, ra = calc(13)
                except Exception:
                    pos = None
                if pos is not None:
                    darkmoon.relocate(pos[0])
                    darkmoon.lat = pos[1]; darkmoon.lonspeed = pos[3]; darkmoon.latspeed = pos[4]
                    darkmoon.ra = ra; darkmoon.decl = eq[1]

    def custHouse(self):
        if self.houseCust == None:
            return

        if self.houseCust == custHouse_Equal_MC_Middle:
            mc = self.chart.getAngle(const.MC)
            startlon = (mc.lon - 15 + 360) % 360
            houses_list = [
                const.HOUSE10, const.HOUSE11, const.HOUSE12,
                const.HOUSE1, const.HOUSE2, const.HOUSE3,
                const.HOUSE4, const.HOUSE5, const.HOUSE6,
                const.HOUSE7, const.HOUSE8, const.HOUSE9
            ]
            for obj in houses_list:
                house = self.chart.getHouse(obj)
                house.relocate(startlon)
                house.size = 30
                house.hsys = custHouse_Equal_MC_Middle
                ra, decl = utils.eqCoords(house.lon, house.lat)
                house.ra = ra
                house.decl = decl
                startlon = (startlon + 30) % 360

        if self.houseCust == custHouse_Fortuna_Whole:
            flon = None
            try:
                fortuna = self.chart.getObject(const.PARS_FORTUNA)
                if fortuna is not None and getattr(fortuna, 'lon', None) is not None:
                    flon = fortuna.lon
            except Exception:
                flon = None
            if flon is None:
                # 回退：自 ASC + 昼夜光体手算福点（昼: ASC+Moon-Sun / 夜: ASC+Sun-Moon）
                try:
                    asc = self.chart.getAngle(const.ASC)
                    sun = self.chart.getObject(const.SUN)
                    moon = self.chart.getObject(const.MOON)
                    if asc is None or sun is None or moon is None:
                        return
                    if self._diurnalWithSectBuffer():   # G13 福点回退同走 sect 缓冲(默认 geo 零回归)
                        flon = (asc.lon + moon.lon - sun.lon) % 360
                    else:
                        flon = (asc.lon + sun.lon - moon.lon) % 360
                except Exception:
                    return
            startlon = (int(flon // 30) * 30) % 360
            houses_list = [
                const.HOUSE1, const.HOUSE2, const.HOUSE3,
                const.HOUSE4, const.HOUSE5, const.HOUSE6,
                const.HOUSE7, const.HOUSE8, const.HOUSE9,
                const.HOUSE10, const.HOUSE11, const.HOUSE12
            ]
            for obj in houses_list:
                house = self.chart.getHouse(obj)
                house.relocate(startlon)
                house.size = 30
                # 用 WHOLE_SIGN 让 inHouse 走整宫分支(无 -5° 偏移)→ 落宫判定正确;
                # 「福点整宫制」标签由盘级 hsys 参数(24)驱动,不靠逐宫 house.hsys。
                house.hsys = const.HOUSES_WHOLE_SIGN
                ra, decl = utils.eqCoords(house.lon, house.lat)
                house.ra = ra
                house.decl = decl
                startlon = (startlon + 30) % 360

    def clone(self, objlists, hid=const.HOUSES_WHOLE_SIGN, needpars=True):
        data = copy.deepcopy(self.data)
        data['objlists'] = objlists
        data['hid'] = hsys.index(hid)
        data['needpars'] = needpars
        perchart = PerChart(data)
        return perchart

    def applyOrbOverrides(self):
        """ 把 orbs(逐星)/orbScale(全局倍数) 挂到盘对象上；默认无参直接返回，orb() 回退默认表，行为字节级不变。 """
        ov = getattr(self, 'orbOverrides', None)
        sc = getattr(self, 'orbScale', None)
        if not ov and sc is None:
            return
        for obj in self.chart.objects:
            if ov and obj.id in ov:
                obj._orbOverride = ov[obj.id]
            if sc is not None:
                obj._orbScale = sc

    def reinit(self):
        self.orientOccident = None
        self.orientOccidentHouses = None
        # v3.0.1 perf ROUND-5 请求内 memo:同一 /chart 请求内被重复计算的纯函数结果(重复调用逐字节
        # 等值已实测证明;各访问器处有防坑注释)。与 orientOccident 同生命周期,reinit 即全部失效。
        self._fixedStars67Cache = None
        self._adjustSu28Cache = None
        self._rawSu28Cache = None
        self._sunRiseCache = None
        self._surroundAttacksCache = None
        self._mutualsCache = None
        self.dynchart = ChartDynamics(self.chart)
        self.dynchart.simpleAsp = self.simpleAsp
        self.applyOrbOverrides()
        self.setupPlanets()
        self.setupDignities()

    def relocateSouthChart(self, obj):
        lon = (obj.lon + 180) % 360
        obj.relocate(lon)

    def relocateSouthObjects(self, objs):
        if (not self.southchart) or self.pos.lat >= 0:
            return

        pool = ThreadPool(8)
        results = pool.map(self.relocateSouthChart, objs)
        pool.close()
        pool.join()

    def setupSouthChart(self):
        if (not self.southchart) or self.pos.lat >= 0:
            return

        self.relocateSouthObjects(self.chart.houses)
        self.relocateSouthObjects(self.chart.angles)
        self.relocateSouthObjects(self.chart.objects)
        self.relocateSouthObjects(self.chart.pars)

        self.reinit()


    # 燃烧之路边界四档(2026-07 全局化,用户拍板默认对齐传统):
    #   standard(默认)=天秤15°–天蝎15°(195–225,古典标准);narrow=旧硬编码窄口径(208–217,
    #   天秤28°–天蝎7°,作历史变体保留);scorpioFull=天秤后15°+天蝎全宫(195–240);
    #   bothFull=天秤+天蝎全段(180–240)。isViaRepression(178–186)非本参数域,原样不动。
    _VIA_COMBUSTA_RANGES = {
        'standard': (195.0, 225.0),
        'narrow': (208.0, 217.0),
        'scorpioFull': (195.0, 240.0),
        'bothFull': (180.0, 240.0),
    }

    def setupSpecial(self, star):
        lo, hi = self._viaCombustaRange
        if lo <= star.lon < hi:
            star.isViaCombust = True
        if 178 <= star.lon < 186:
            star.isViaRepression = True

    def setupOutOfBounds(self, planet, obj):
        """出界 Out-of-Bounds:|赤纬| > 真黄赤交角 ε。月亮另判趋势(going 远离极值 / returning 回归)。
        赤纬为赤道坐标、与黄道制无关 → 恒星制盘同样适用。"""
        eps = getattr(self, 'eclObliquity', 23.4367)
        decl = getattr(planet, 'decl', None)
        if decl is None:
            return
        planet.outOfBounds = bool(abs(decl) > eps)
        planet.oobDelta = round(abs(decl) - eps, 3)
        if obj == const.MOON:
            try:
                eqflag = swisseph.FLG_SWIEPH | swisseph.FLG_EQUATORIAL
                jd0 = self.dateTime.jd
                d_now = abs(swisseph.calc_ut(jd0, swisseph.MOON, eqflag)[0][1])
                d_prev = abs(swisseph.calc_ut(jd0 - 1.0 / 24.0, swisseph.MOON, eqflag)[0][1])
                planet.oobMode = 'going' if d_now > d_prev else 'returning'
            except Exception:
                planet.oobMode = None

    def setupPhasis(self, planet, obj, sun):
        """偕日相 phasis / 可见弧:据与太阳的黄经差细分 核心/焦伤/日光束下/自由光;
        若出生临近该星偕日升(晨星初现)或偕日没(昏星初没)则标 phasisEvent。仅日月五星中的五星。"""
        arcus = ARCUS_VISIONIS.get(obj)
        if arcus is None or sun is None:
            return
        ae = abs(((planet.lon - sun.lon + 180.0) % 360.0) - 180.0)
        planet.phasisElong = round(ae, 3)
        if ae <= self._phaseCazimi:
            planet.phase = 'cazimi'
        elif ae < self._phaseCombust:
            planet.phase = 'combust'
        elif ae < arcus:
            planet.phase = 'underBeams'
        else:
            planet.phase = 'free'
        # 仅当落在可见弧边界窗(±5°)时才查偕日升/没事件(heliacal_ut 较贵,远离边界无意义)。
        planet.phasisEvent = None
        if abs(ae - arcus) <= 5.0:
            planet.phasisEvent = self._phasis_event(obj)

    # horosa_phasis_bounded_v1(PERF-R10 B5)—— 高纬度整盘 8-16 秒的根治。
    # 病根:heliacal_ut 从 birth_jd-15 起**无上界**前搜(默认最多扫 5 个会合周期),而下方的
    # 采用窗只有 ±7 天 —— 极昼下窗内根本不存在事件,单次搜索 2.03s、两事件×多星占整盘 99.7%。
    # 两层限界,各自独立字节安全(响应只携带 label/None,窗外与异常本就恒 None):
    #   ① 可行性预筛:偕日事件时刻要求太阳俯角 ≥ arcus(最弱 Venus 5.0°);若 [birth±8.5d]
    #     内太阳**最深**高度 > -1.0°(5.0 - 模型余量 2.0 - 采样余量 2.0),窗内不可能有事件
    #     时刻 ⇒ 直接 None(≡ 旧「搜到窗外事件→丢弃→None」/「抛→None」)。逐小时采样:
    #     极区近地平的高度极小值是**平的**(太阳擦边走),小时步距误差远小于 4° 余量;
    #     结果挂 self 盘内缓存(两事件×五星共享一次预筛)。任何异常 → True(不筛,fail-open)。
    #   ② HELFLAG_SEARCH_1_PERIOD:被采用的事件必在首个会合周期内(jd ≤ start+22d,而最短
    #     会合周期=水星 115.9d);首周期找不到 ⇒ heliacal_ut 抛 ⇒ except ⇒ None(≡ 旧路径的
    #     远事件→丢弃→None)。把默认 5 周期的扫描截到 1 个。
    # kill:HOROSA_PHASIS_BOUNDED=0 ⇒ 两层全关,逐字节旧路径。黄金矩阵含 north-hi 用例钉住。
    _PHASIS_BOUNDED = __import__('os').environ.get('HOROSA_PHASIS_BOUNDED', '1').lower() not in ('0', 'false', 'no', 'off')
    _PHASIS_SEARCH_1_PERIOD = getattr(swisseph, 'HELFLAG_SEARCH_1_PERIOD', 2048)

    def _phasisWindowFeasible(self):
        cached = getattr(self, '_phasisFeasibleWin', None)
        if cached is not None:
            return cached
        feasible = True
        try:
            geopos = (float(self.pos.lon), float(self.pos.lat), 0.0)
            birth_jd = self.dateTime.jd
            deepest = 90.0
            jd = birth_jd - 8.5
            while jd <= birth_jd + 8.5:
                xx = swisseph.calc_ut(jd, swisseph.SUN, swisseph.FLG_SWIEPH)[0]
                alt = swisseph.azalt(jd, swisseph.ECL2HOR, geopos, 1013.25, 15.0, (xx[0], xx[1]))[1]
                if alt < deepest:
                    deepest = alt
                jd += 1.0 / 24.0
            feasible = deepest <= -1.0
        except Exception:
            feasible = True
        self._phasisFeasibleWin = feasible
        return feasible

    def _phasis_event(self, obj):
        """birth 临近(≤7 天)该星偕日升→morningRising(晨星初现);偕日没→eveningSetting(昏星初没)。任何异常返 None。"""
        try:
            geopos = [float(self.pos.lon), float(self.pos.lat), 0.0]
            atmo = [1013.25, 15.0, 40.0, 0.25]
            observer = [36.0, 1.0, 0.0, 0.0, 0.0, 0.0]
            birth_jd = self.dateTime.jd
            flag = swisseph.FLG_SWIEPH | swisseph.HELFLAG_HIGH_PRECISION
            if self._PHASIS_BOUNDED:
                if not self._phasisWindowFeasible():
                    return None
                flag |= self._PHASIS_SEARCH_1_PERIOD
            for event, label in ((swisseph.HELIACAL_RISING, 'morningRising'), (swisseph.HELIACAL_SETTING, 'eveningSetting')):
                tret = swisseph.heliacal_ut(birth_jd - 15.0, geopos, atmo, observer, obj, event, flag)
                jd = tret[0] if isinstance(tret, (list, tuple)) else tret
                if abs(jd - birth_jd) <= 7.0:
                    return label
        except Exception:
            pass
        return None

    _FERAL_PTOL = (0, 60, 90, 120, 180)

    def _feralPtolTargets(self, obj):
        """obj 向七政发出的托勒密相位(0/60/90/120/180)目标集,复用本盘 dynchart(moiety 容许度,
        与星图所绘/相位tab 同源);本盘缓存,7 星共 7 次调用。异常返回 None。"""
        cache = getattr(self, '_feralAspCache', None)
        if cache is None:
            cache = self._feralAspCache = {}
        if obj in cache:
            return cache[obj]
        targets = set()
        try:
            asp = self.dynchart.aspectsByCat(obj, list(self._FERAL_PTOL), False)
            for cat in ('Exact', 'Applicative', 'Separative'):
                for a in (asp.get(cat) or []):
                    if a.get('asp') in self._FERAL_PTOL and a.get('id') is not None:
                        targets.add(a.get('id'))
        except Exception:
            targets = None
        cache[obj] = targets
        return targets

    def setupFeral(self, planet, obj):
        """野逸 feral:该星与七政中任何他星皆不成托勒密相位(0/60/90/120/180)→ 野逸(完全无相)。
        相位判定复用本盘 dynchart(与星图所绘、相位tab 同一 moiety 容许度)——绝不另设固定容许度,
        否则偏窄会漏真相位(如月对水冲 11.7°、月六合土 10.2°)误标野逸。相位是「画出一条线即成」,
        故须**双向并集**:容许度随主星(月容许大、土容许小),只要任一方向成相即非野逸。仅计七政互相,不含外行星/虚点/四角。"""
        lons = getattr(self, '_sevenLons', None)
        if not lons or obj not in lons:
            return
        others = set(lons.keys())
        others.discard(obj)
        mine = self._feralPtolTargets(obj)
        if mine is None:
            planet.feral = False   # 相位引擎异常时不武断标野逸(宁漏标不错标)
            return
        feral = True
        for q in others:
            if q in mine:                       # obj → q 成相
                feral = False
                break
            qt = self._feralPtolTargets(q)       # q → obj 成相(另一方向,另一方容许度)
            if qt and obj in qt:
                feral = False
                break
        planet.feral = bool(feral)

    def setupJoy(self, planet, obj):
        """行星喜乐 joy:整宫制下行星所落宫 == 该星喜乐宫。整宫房=自上升星座起算。"""
        JOY = {const.MERCURY: 1, const.MOON: 3, const.VENUS: 5, const.MARS: 6, const.SUN: 9, const.JUPITER: 11, const.SATURN: 12}
        j = JOY.get(obj)
        if j is None:
            return
        try:
            psidx = const.LIST_SIGNS.index(planet.sign)
            wsh = ((psidx - getattr(self, 'ascSignIdx', 0)) % 12) + 1
            planet.wholeSignHouse = wsh
            planet.joy = bool(wsh == j)
            planet.joyHouse = j
        except Exception:
            pass

    def setupSect(self, planet, obj, sun):
        """宗派 sect:日间星(日木土)在日盘 / 夜间星(月金火)在夜盘 = 同宗(of-sect);水星随其东西向(晨星=日间)。"""
        if obj in (const.SUN, const.JUPITER, const.SATURN):
            planet.ofSect = bool(self.isDiurnal)
        elif obj in (const.MOON, const.VENUS, const.MARS):
            planet.ofSect = bool(not self.isDiurnal)
        elif obj == const.MERCURY and sun is not None:
            oriental = (((planet.lon - sun.lon + 180.0) % 360.0) - 180.0) < 0
            planet.ofSect = bool(oriental == self.isDiurnal)

    def _diurnalWithSectBuffer(self):
        """G13 区分昼夜:默认纯几何地平(chart.isDiurnal);sectBuffer=='ptolemy5' 加 5° 缓冲——
        太阳虽在地平下,但黄经距上升点 5° 内(拂晓将升)仍判昼。默认 geo 零回归。
        sect 翻转连锁影响:得失区分凶星 / 三分昼夜序 / 福点反转 / 寿命法 hyleg 优先 / ZR 默认释放点。"""
        base = bool(self.chart.isDiurnal())
        data = self.data if isinstance(self.data, dict) else {}
        if base or data.get('sectBuffer') != 'ptolemy5':
            return base
        try:
            sun = self.chart.getObject(const.SUN)
            asc = self.chart.getAngle(const.ASC)
            d = abs(((sun.lon - asc.lon + 180.0) % 360.0) - 180.0)   # 太阳↔上升 最小角距 0..180
            return d <= 5.0
        except Exception:
            return base

    def _applyLotReversal(self):
        """G20-P2 福点反转:默认 ON(sect-aware,flatlib 原值 asc+月-日/夜 asc+日-月,零回归);
        lotReversal 显式 OFF(0)→ 福点恒用昼式 asc+月-日(不随昼夜反转)。仅显式关闭才置换。"""
        data = self.data if isinstance(self.data, dict) else {}
        if str(data.get('lotReversal', 1)) not in ('0', 'false', 'False'):
            return
        try:
            pf = self.chart.getObject(const.PARS_FORTUNA)
            asc = self.chart.getAngle(const.ASC)
            sun = self.chart.getObject(const.SUN)
            moon = self.chart.getObject(const.MOON)
            if pf is not None and asc is not None and sun is not None and moon is not None:
                pf.relocate((asc.lon + moon.lon - sun.lon) % 360.0)
        except Exception:
            pass

    def setupPlanets(self):
        self.isDiurnal = self._diurnalWithSectBuffer()
        self._applyLotReversal()   # G20-P2 福点反转(默认 ON 零回归;OFF 恒昼式)
        # G15 迦勒底界:夜盘换夜表(土↔水位置互换);锁由 webchartsrv 请求级持有,此处重置 essential.TERMS 安全。
        # 默认/其它界系不命中此分支(termsVariant!=3)→ 零回归。
        try:
            if str((self.data or {}).get('termsVariant', '')) == '3' and not self.isDiurnal:
                essential.TERMS = _CHALDEAN_TERMS_NIGHT
        except Exception:
            pass
        # 三分集水象变体:夜盘换水象「夜」表(水象 trip=火+月);锁由 webchartsrv 请求级持有,此处重置 essential.TABLE 安全。
        # 默认 Dorothean / 普通 Ptolemaic / 昼盘 不命中此分支 → 零回归。
        try:
            if str((self.data or {}).get('triplicity', '')) == 'PtolemaicWaterVariant' and not self.isDiurnal:
                essential.TABLE = _PTOLEMAIC_WATER_VARIANT_DIGNITIES_NIGHT
        except Exception:
            pass
        suobjs = const.LIST_OBJECTS_TRADITIONAL.copy()
        objs = const.LIST_OBJECTS_TRADITIONAL
        planets = const.LIST_SEVEN_PLANETS.copy()
        if not self.tradition:
            planets.append(const.URANUS)
            planets.append(const.NEPTUNE)
            planets.append(const.PLUTO)
            objs = self.objlists
            suobjs = self.objlists.copy()

        asc = self.chart.getAngle(const.ASC)
        ascsign = asc.sign
        sidx = const.LIST_SIGNS.index(ascsign)
        self.ascSignIdx = sidx   # 整宫制起算(WI-03 喜乐 等用)

        suobjs.extend(const.LIST_ANGLES)
        for obj in suobjs:
            planet = self.chart.get(obj)
            term = guotables.TERM_SU27[planet.sign]
            for pos in term:
                if pos[1] <= planet.signlon < pos[2]:
                    planet.su = pos[0]
                    break

        for obj in const.LIST_ANGLES:
            angle = self.chart.get(obj)
            antipnt = angle.antiscia()
            cantipnt = angle.cantiscia()
            angle.antisciaPoint = {
                'sign': antipnt.sign,
                'signlon': antipnt.signlon,
                'lon': antipnt.lon
            }
            angle.cantisciaPoint = {
                'sign': cantipnt.sign,
                'signlon': cantipnt.signlon,
                'lon': cantipnt.lon
            }
            house = self.chart.houses.getHouseByLon(angle.lon)
            angle.house = house.id
            angle.mansion = ctab.mansion_of(angle.lon)   # WI-07 上升宿
            self.setupSpecial(angle)

        for obj in const.LIST_HOUSES:
            house = self.chart.getHouse(obj)
            house.planets = []
            house.exalt = None

        # 真黄赤交角(度,≈23.436):出界 Out-of-Bounds 判据(赤纬与黄道制无关,恒星盘亦适用)。
        try:
            self.eclObliquity = round(swisseph.calc_ut(self.dateTime.jd, swisseph.ECL_NUT)[0][0], 4)
        except Exception:
            self.eclObliquity = 23.4367
        try:
            sunObj = self.chart.get(const.SUN)
        except Exception:
            sunObj = None
        # 七政经度(野逸判据用):七星互相是否成相。
        self._sevenLons = {}
        for sid in const.LIST_SEVEN_PLANETS:
            try:
                self._sevenLons[sid] = self.chart.get(sid).lon
            except Exception:
                pass
        # WI-25/25b 远地点/数增减/光增减 用:七政→swisseph 体 id + 当下太阳黄经。
        _SWE_BODY = {const.SUN: swisseph.SUN, const.MOON: swisseph.MOON, const.MERCURY: swisseph.MERCURY,
                     const.VENUS: swisseph.VENUS, const.MARS: swisseph.MARS,
                     const.JUPITER: swisseph.JUPITER, const.SATURN: swisseph.SATURN}
        _sun_lon_now = sunObj.lon if sunObj else None

        for obj in objs:
            planet = self.chart.get(obj)
            self.setupSpecial(planet)
            self.setupOutOfBounds(planet, obj)
            self.setupPhasis(planet, obj, sunObj)
            self.setupJoy(planet, obj)
            self.setupSect(planet, obj, sunObj)
            self.setupFeral(planet, obj)
            # WI-09 阳/阴度数 + WI-07 月站(回归制,0°白羊起;与恒星制 nakshatra 并存勿混)。
            planet.degreeGender = ctab.degree_gender(planet.sign, planet.signlon)
            planet.mansion = ctab.mansion_of(planet.lon)
            # WI-05 度数性质 明/暗/空/烟 + WI-09 特殊度数 陷度/慢病/增福(al-Qabisi 录本)。
            planet.degreeQuality = ctab.degree_quality(planet.sign, planet.signlon)
            planet.specialDegree = ctab.special_degree(planet.sign, planet.signlon)
            # WI-15 单度主星 + WI-17 九分 + WI-14 Darijan(印度十度分;迦勒底面另由必然尊贵 face 提供)。
            planet.monomoiria = ctab.monomoiria_ruler(planet.lon)
            planet.ninthPart = ctab.ninth_part_sign(planet.lon)
            planet.darijan = ctab.darijan_ruler(planet.sign, planet.signlon)
            planet.movedir = planet.movement()
            # WI-25/25b 远地点 apogee 升降 + 数增数减 + (月)光增光减:用 swisseph 距速 distspeed。
            # distspeed>0=距地渐增→趋远地点(升)+行速渐慢(数减);<0=距地渐减→趋近地点(降)+行速渐快(数增)。
            try:
                _swid = _SWE_BODY.get(obj)
                if _swid is not None:
                    _distspeed = swisseph.calc_ut(self.dateTime.jd, _swid, swisseph.FLG_SWIEPH | swisseph.FLG_SPEED)[0][5]
                    planet.apogeeDir = 'rising' if _distspeed > 0 else 'falling'
                    planet.numberTrend = 'decreasing' if _distspeed > 0 else 'increasing'
                    if obj == const.MOON and _sun_lon_now is not None:
                        _elong = (planet.lon - _sun_lon_now) % 360.0
                        planet.lightTrend = 'waxing' if _elong < 180.0 else 'waning'
            except Exception:
                pass
            antipnt = planet.antiscia()
            cantipnt = planet.cantiscia()
            planet.antisciaPoint = {
                'sign': antipnt.sign,
                'signlon': antipnt.signlon,
                'lon': antipnt.lon
            }
            planet.cantisciaPoint = {
                'sign': cantipnt.sign,
                'signlon': cantipnt.signlon,
                'lon': cantipnt.lon
            }
            planethouse = self.chart.houses.getHouseByLon(planet.lon)
            planet.house = planethouse.id
            if obj in props.object.meanMotion.keys():
                planet.meanSpeed = planet.meanMotion()
                self.hayyiz(planet, self.isDiurnal)

            if obj not in planets:
                continue

            planet.ruleHouses = []
            i = 0
            for elm in range(sidx, sidx + 12):
                sign = const.LIST_SIGNS[elm % 12]
                ruler = tables.ESSENTIAL_DIGNITIES[sign]['ruler']
                exalt = tables.ESSENTIAL_DIGNITIES[sign]['exalt'][0]
                houseid = const.LIST_HOUSES[i]
                house = self.chart.getHouse(houseid)
                if exalt == obj:
                    planet.exaltHouse = houseid
                    house.exalt = obj
                if ruler == obj:
                    planet.ruleHouses.append(houseid)
                    house.ruler = obj
                if planethouse.id == houseid:
                    house.planets.append(obj)

                i = i +1

    def setupDignities(self):
        res = {}
        planets = const.LIST_SEVEN_PLANETS.copy()
        if not self.tradition:
            planets.append(const.URANUS)
            planets.append(const.NEPTUNE)
            planets.append(const.PLUTO)

        sun = self.chart.get(const.SUN)
        signplanets = {}
        for obj in planets:
            try:
                pla = self.chart.getObject(obj)
            except:
                continue
            if pla.sign not in signplanets.keys():
                signplanets[pla.sign] = []
            signplanets[pla.sign].append(obj)

        for itemA in planets:
            try:
                obj = self.chart.get(itemA)
            except:
                continue
            dig = essential.getInfo(obj.sign, obj.signlon)
            govidx = (const.LIST_SIGNS.index(obj.sign) - 3 + len(const.LIST_SIGNS)) % len(const.LIST_SIGNS)
            govsign = const.LIST_SIGNS[govidx]
            govplanets = []
            if govsign in signplanets.keys():
                govplanets = signplanets[govsign]

            obj.score = essential.score(itemA, obj.sign, obj.signlon)
            obj.dignities = dig
            obj.selfDignity = self.takePlanetDignity(itemA, dig)
            obj.isPeregrining = essential.isPeregrine(itemA, obj.sign, obj.signlon)
            obj.governSign = govsign
            obj.governPlanets = govplanets
            if itemA == const.MOON:
                obj.isVOC = self.dynchart.isVOC(itemA, self._vocMode, self._vocIncludeOuter)
                obj.moonPhase = self.chart.getMoonPhase()

    def takePlanetDignity(self, planetId, dignities):
        res = []
        if dignities['ruler'] == planetId:
            res.append('ruler')
        if dignities['exalt'] == planetId:
            res.append('exalt')
        if dignities['dayTrip'] == planetId:
            res.append('dayTrip')
        if dignities['nightTrip'] == planetId:
            res.append('nightTrip')
        if dignities['partTrip'] == planetId:
            res.append('partTrip')
        if dignities['term'] == planetId:
            res.append('term')
        if dignities['face'] == planetId:
            res.append('face')
        if dignities['fall'] == planetId:
            res.append('fall')
        if dignities['exile'] == planetId:
            res.append('exile')

        return res


    def getChart(self):
        return self.chart

    def getChartObj(self):
        chart = self.chart
        houses = []
        objs = []
        for key in chart.houses.content.keys():
            houses.append(chart.houses.content[key])
        for key in chart.objects.content.keys():
            if (key == const.SUN and not self.hasSun) or (key == const.MOON and not self.hasMoon):
                continue
            objs.append(chart.objects.content[key])
        for key in chart.angles.content.keys():
            objs.append(chart.angles.content[key])

        houses.sort(key=takeLon)
        objs.sort(key=takeLon)

        res = {
            'zodiacal': self.zodiacal,
            'date': self.chart.orgdate,
            'geo': self.chart.pos,
            'hsys': self.house,
            'houses': houses,
            'objects': objs,
            'nakshatras': ({o.id: nakshatra_from_lon(o.lon) for o in objs} if self.zodiacal == const.SIDEREAL else None),
            'siderealAyanamsa': self.siderealAyanamsa,
            'isDiurnal': self.isDiurnal,
            'antiscias': self.getAntiscia(),
            'stars': self.getStars(),
            'orientOccident': self.orientalOccidental(),
            # 黄仪/赤仪显示口径(单一真值源,前端/Java 一律读此字段,勿自行判断):
            # 与 getFixedStarSu28 的 byLon/byRA 置宿分派同一集合——黄仪(byLon 四制)=全黄经显示,
            # 赤仪(byRA 四制)=全赤经显示;显示口径与入宿判定永远同体系。
            'displayCoord': 'ecliptic' if self.su28Mode in (
                SU28_MODE_MOIRA_CURRENT, SU28_MODE_MOIRA_KAIXI,
                SU28_MODE_ZHENG_SIDEREAL, SU28_MODE_GUFA_LICHENG,
            ) else 'equatorial',
            'fixedStarSu28': self.getFixedStarSu28(),
            'fixedStars': self.getFixedStars(),
            'signsRA': self.getSignsRA(),
            'signsRaDoubingSu28': self.getDoubingSu28SignsRA(),
            'su28Adjust': self.getAdjustFixedStarSu28(),
            'su28Virtual': self.getVirtualFixedStarSu28(),
            'beidou': self.getBeiDou(),
            'beiji': self.getBeiJi(),
            'timerStar': self.getTimerStar(),
            'dayerStar': self.getDayerStar(),
            'dayofweek': dayofweekStr[self.dateTime.date.dayofweek()],
            'sunRiseTime': self.getSunRiseTime()['timeStr'],
            'sunSetTime': self.getSunSetTime()['timeStr'],
        }
        return res

    def getDoubingSu28SignsRA(self):
        res = []
        if not self.isDoubingSu28:
            return res

        deg = (self.eastRa - 225 + 360) % 360
        for i in range(12):
            sigid = const.LIST_SIGNS[i]
            sig = {
                'id': sigid,
                'ra': (deg + i * 30) % 360,
                'decl': 0
            }
            res.append(sig)
        return res

    def getSignsRA(self):
        res = []
        for i in range(12):
            sigid = const.LIST_SIGNS[i]
            deg = i * 30
            sig = {
                'id': sigid,
                'ra': deg,
                'decl': 0
            }
            res.append(sig)
        return res

    def getChartOnlyObj(self):
        chart = self.chart
        houses = []
        objs = []
        for key in chart.houses.content.keys():
            houses.append(chart.houses.content[key])
        for key in chart.objects.content.keys():
            if (key == const.SUN and not self.hasSun) or (key == const.MOON and not self.hasMoon):
                continue
            objs.append(chart.objects.content[key])
        for key in chart.angles.content.keys():
            objs.append(chart.angles.content[key])

        houses.sort(key=takeLon)
        objs.sort(key=takeLon)

        res = {
            'hsys': self.house,
            'houses': houses,
            'objects': objs,
            'nakshatras': ({o.id: nakshatra_from_lon(o.lon) for o in objs} if self.zodiacal == const.SIDEREAL else None),
            'siderealAyanamsa': self.siderealAyanamsa,
            'isDiurnal': self.isDiurnal
        }
        return res

    def getPredict(self):
        return PerPredict(self)


    def getReceptions(self):
        res = {
            'normal': [],
            'abnormal': []
        }
        planets = const.LIST_SEVEN_PLANETS.copy()
        if self.tradition == False:
            planets.append(const.URANUS)
            planets.append(const.NEPTUNE)
            planets.append(const.PLUTO)

        for itemA in planets:
            for itemB in planets:
                if itemA != itemB:
                    try:
                        planetB = self.chart.getObject(itemB)
                        rec = self.dynchart.receives(itemA, itemB)
                    except:
                        continue
                    if len(rec) > 0:
                        filter_ = ['exile', 'fall']
                        list = []
                        for ele in rec:
                            if ele not in filter_:
                                list.append(ele)

                        dig = planetB.selfDignity
                        if ('exalt' in list or 'ruler' in list) or (len(list) > 1 and self.strongRecption == False):
                            obj = {
                                'beneficiary': itemB,
                                'supplier': itemA,
                                'beneficiaryDignity': dig,
                                'supplierRulerShip': rec
                            }
                            if 'exile' in dig or 'fall' in dig:
                                res['abnormal'].append(obj)
                            else:
                                res['normal'].append(obj)

        return res

    # v3.0.1 perf ROUND-5:besiegementDetail 会再次调用本方法(10×10 inDignities 对),同一响应的
    # mutuals 键已算过。memo;只读互容判定,无状态变异。重复调用逐字节等值已实测。
    def getMutuals(self):
        if self._mutualsCache is None:
            self._mutualsCache = self._computeMutuals()
        return self._mutualsCache

    def _computeMutuals(self):
        res = []
        planets = const.LIST_SEVEN_PLANETS.copy()
        if self.tradition == False:
            planets.append(const.URANUS)
            planets.append(const.NEPTUNE)
            planets.append(const.PLUTO)

        for itemA in planets:
            for itemB in planets:
                if itemA != itemB:
                    flag = False
                    for obj in res:
                        if itemA in obj['mutual'] and itemB in obj['mutual']:
                            flag = True
                            break
                    if flag:
                        continue
                    try:
                        orgab = self.dynchart.inDignities(itemA, itemB)
                        orgba = self.dynchart.inDignities(itemB, itemA)
                        ablist = list(filter(excludeBad, orgab))
                        balist = list(filter(excludeBad, orgba))
                        abgood = list(filter(isStrongGood, ablist))
                        bagood = list(filter(isStrongGood, balist))
                        if self.strongRecption:
                            if len(abgood) > 0 and len(bagood) > 0:
                                obj = {
                                    'mutual': [itemA, itemB],
                                    'dignity': [balist, ablist]
                                }
                                res.append(obj)
                        elif (len(ablist) > 1 and len(balist) > 1) or (len(abgood) > 0 and len(bagood) > 0) \
                                or (len(abgood) > 0 and len(balist) > 1) or (len(ablist) > 1 and len(bagood) > 0):
                            obj = {
                                'mutual': [itemA, itemB],
                                'dignity': [orgba, orgab]
                            }
                            res.append(obj)
                    except:
                        continue

        mobj = {
            'normal': [],
            'abnormal': []
        }
        for elm in res:
            elmobj = {
                'planetA': {
                    'id': elm['mutual'][0],
                    'rulerShip': elm['dignity'][0]
                },
                'planetB': {
                    'id': elm['mutual'][1],
                    'rulerShip': elm['dignity'][1]
                }
            }
            foundabnormal = False
            for elmdig in elm['dignity'][0]:
                if elmdig == 'exile' or elmdig == 'fall':
                    foundabnormal = True
                    break
            for elmdig in elm['dignity'][1]:
                if elmdig == 'exile' or elmdig == 'fall':
                    foundabnormal = True
                    break
            if foundabnormal:
                mobj['abnormal'].append(elmobj)
            else:
                mobj['normal'].append(elmobj)

        return mobj

    def getImmediateAspects(self):
        virPoints = const.LIST_VIRTUAL_POINTS
        res = {}
        planets = const.LIST_OBJECTS_TRADITIONAL
        if self.tradition == False:
            planets = self.objlists

        asplist = const.MAJOR_ASPECTS
        excludeVirpnt = not self.virtualPointReceiveAsp
        for itemA in planets:
            if not self.virtualPointReceiveAsp and itemA in virPoints:
                continue
            try:
                asp = self.dynchart.immediateAspects(itemA, asplist, excludeVirpnt)
                if asp[0] != None and asp[1] != None:
                    res[itemA] = asp
            except:
                continue
        return res


    def getAspects(self):
        virPoints = const.LIST_VIRTUAL_POINTS.copy()
        virPoints.extend(arabicparts.LIST_PARS)
        res = {}
        planets = const.LIST_OBJECTS_TRADITIONAL
        if self.tradition == False:
            planets = self.objlists
        planets = planets.copy()
        planets.extend(const.LIST_ANGLES)
        planets.extend(arabicparts.LIST_PARS)
        planets.extend(const.LIST_MIDDLE_POINTS)

        asplist = const.MAJOR_ASPECTS.copy()
        asplist.append(45)
        excludeVirpnt = not self.virtualPointReceiveAsp
        for itemA in planets:
            if not self.virtualPointReceiveAsp and itemA in virPoints:
                continue
            try:
                item = self.chart.get(itemA)
            except:
                continue
            if item.type == const.OBJ_ARABIC_PART:
                continue

            asp = self.dynchart.aspectsByCat(itemA, asplist, excludeVirpnt)
            asp['Obvious'] = []
            for obj in asp['Exact']:
                asp['Obvious'].append(obj)
                if itemA == const.SUN and obj['asp'] == 0:
                    try:
                        plobj = self.chart.get(obj['id'])
                    except:
                        continue
                    if obj['orb'] < self._sunPosCazimi:
                        plobj.sunPos = 'Cazimi'
                    elif self._sunPosCazimi <= obj['orb'] < self._sunPosCombust:
                        plobj.sunPos = 'Combust'
                    elif self._sunPosCombust <= obj['orb'] < self._sunPosBeams:
                        plobj.sunPos = 'Sunbeams'

            for obj in asp['Applicative']:
                if obj['orb'] <= aspects.MAX_MINOR_ASP_ORB:
                    asp['Obvious'].append(obj)
                if itemA == const.SUN and obj['asp'] == 0:
                    try:
                        plobj = self.chart.get(obj['id'])
                    except:
                        continue
                    if obj['orb'] < self._sunPosCazimi:
                        plobj.sunPos = 'Cazimi'
                    elif self._sunPosCazimi <= obj['orb'] < self._sunPosCombust:
                        plobj.sunPos = 'Combust'
                    elif self._sunPosCombust <= obj['orb'] < self._sunPosBeams:
                        plobj.sunPos = 'Sunbeams'

            for obj in asp['None']:
                if obj['orb'] <= aspects.MAX_MINOR_ASP_ORB:
                    asp['Obvious'].append(obj)
                if itemA == const.SUN and obj['asp'] == 0:
                    try:
                        plobj = self.chart.get(obj['id'])
                    except:
                        continue
                    if obj['orb'] < self._sunPosCazimi:
                        plobj.sunPos = 'Cazimi'
                    elif self._sunPosCazimi <= obj['orb'] < self._sunPosCombust:
                        plobj.sunPos = 'Combust'
                    elif self._sunPosCombust <= obj['orb'] < self._sunPosBeams:
                        plobj.sunPos = 'Sunbeams'

            for obj in asp['Separative']:
                if obj['orb'] <= aspects.MAX_MINOR_ASP_ORB:
                    asp['Obvious'].append(obj)
                if itemA == const.SUN and obj['asp'] == 0:
                    try:
                        plobj = self.chart.get(obj['id'])
                    except:
                        continue
                    if obj['orb'] < self._sunPosCazimi:
                        plobj.sunPos = 'Cazimi'
                    elif self._sunPosCazimi <= obj['orb'] < self._sunPosCombust:
                        plobj.sunPos = 'Combust'
                    elif self._sunPosCombust <= obj['orb'] < self._sunPosBeams:
                        plobj.sunPos = 'Sunbeams'

            res[itemA] = asp


        return res

    def getSimpleAspect(self):
        pass

    def _getSameSignlonObj(self, planets, obj):
        res = []
        for planet in planets:
            if planet != obj.id:
                cmpobj = self.chart.getObject(planet)
                if cmpobj.sign == obj.sign and (abs(cmpobj.signlon - obj.signlon) < self._antisciaOrb):
                    res.append(cmpobj)
        for angle in const.LIST_ANGLES:
            cmpobj = self.chart.getAngle(angle)
            if cmpobj.sign == obj.sign and (abs(cmpobj.signlon - obj.signlon) < self._antisciaOrb):
                res.append(cmpobj)
        if len(res) > 0:
            return res
        return None

    def getAntiscia(self):
        ares = []
        cares = []
        planets = const.LIST_OBJECTS_TRADITIONAL
        if self.tradition == False:
            planets = self.objlists

        for item in planets:
            planet = self.chart.getObject(item)
            obj = planet.antiscia()
            cobj = planet.cantiscia()
            anti = self._getSameSignlonObj(planets, obj)
            canti = self._getSameSignlonObj(planets, cobj)
            if anti != None:
                flag = True
                for tmp in ares:
                    if item in tmp:
                        flag = False
                        break
                if flag:
                    for antiobj in anti:
                        ares.append([item, antiobj.id, abs(antiobj.signlon - obj.signlon)])

            if canti != None:
                flag = True
                for tmp in cares:
                    if item in tmp:
                        flag = False
                        break
                if flag:
                    for cantiobj in canti:
                        cares.append([item, cantiobj.id, abs(cantiobj.signlon - obj.signlon)])


        res = {
            'antiscia': ares,
            'cantiscia': cares
        }

        return res

    def getStars(self):
        res = []
        planets = const.LIST_OBJECTS_TRADITIONAL
        if self.tradition == False:
            planets = self.objlists
        planets = planets.copy()
        planets.extend(const.LIST_ANGLES)
        stars = self._getFixedStars67Cached()
        for planet in planets:
            fixstars = {
                'id': planet,
                'stars': []
            }
            for star in stars:
                plaObj = self.chart.get(planet)
                delta = abs(plaObj.lon - star.lon)
                # 跨 0° 白羊点的合相(如 359.7 vs 0.3,差 359.4)需折回最短分离角
                if delta > 180:
                    delta = 360 - delta
                # 轨档:byMagnitude 逐星取星等表 FixedStar.orb()(mag<2→7.5°…),否则平轨(默认 1°=现状)。
                _orb = star.orb() if self._starOrbByMag else self._starOrb
                if delta < _orb:
                    obj = [star.id, star.sign, star.signlon, delta, star.name]
                    fixstars['stars'].append(obj)
            res.append(fixstars)
        return res

    def surroundPlanet(self, planet):
        oc = self.orientalOccidental()
        ocary = oc[planet.id]
        if len(ocary['occidental']) == 0 or len(ocary['oriental']) == 0:
            return []

        firstOcci = ocary['occidental'][0]
        firstOrient = ocary['oriental'][0]
        if firstOcci['delta'] + firstOrient['delta'] > 90:
            return []

        res = [firstOrient, firstOcci]
        return res


    def surroundSun(self):
        sun = self.chart.getObject(const.SUN)
        return self.surroundPlanet(sun)

    def surroundMoon(self):
        moon = self.chart.getObject(const.MOON)
        return self.surroundPlanet(moon)

    def surroundPlanets(self):
        res = {}
        res[const.SUN] = []
        res[const.MOON] = []
        res['BySunMoon'] = None

        planets = const.LIST_SEVEN_PLANETS.copy()
        # if self.tradition == False:
        #     planets.append(const.URANUS)
        #     planets.append(const.NEPTUNE)
        #     planets.append(const.PLUTO)

        for obj in planets:
            try:
                planet = self.chart.getObject(obj)
            except:
                continue
            surobj = self.surroundPlanet(planet)
            if len(surobj) == 0:
                continue

            if obj == const.SUN or obj == const.MOON:
                res[obj] = surobj
            elif (surobj[0]['id'] == const.SUN and surobj[1]['id'] == const.MOON) or (surobj[1]['id'] == const.SUN and surobj[0]['id'] == const.MOON):
                res[obj] = {
                    'id': obj,
                    'SunMoon': surobj
                }

        return res

    def getSign(self, obj, asp):
        lon = obj.lon + asp
        lon = lon if lon >= 0 else 360 + lon
        lon = lon % 360
        idx = int(lon / 30)
        signlon = lon % 30
        return {
            'sign': const.LIST_SIGNS[idx],
            'signlon': signlon
        }

    def surroundAttack(self, planet):
        aspectlist = [-120, -90, -60, 0, 60, 90, 120, 180]
        alltmp = []
        planets = const.LIST_SEVEN_PLANETS.copy()
        # if self.tradition == False:
        #     planets.append(const.URANUS)
        #     planets.append(const.NEPTUNE)
        #     planets.append(const.PLUTO)

        orb = 27
        edgeOrb = 7

        for objA in planets:
            if objA == planet.id:
                continue
            try:
                planetA = self.chart.getObject(objA)
            except:
                continue
            edgeOrbA = props.object.orb[planetA.id]
            for aspA in aspectlist:
                sigA = self.getSign(planetA, aspA)
                pntA = (planetA.lon + aspA + 360) % 360
                deltaA = (pntA - planet.lon + 360) % 360
                deltaA = deltaA if deltaA <= 180 else 360 - deltaA
                if deltaA > orb:
                    continue

                for objB in planets:
                    if objA == objB or objB == planet.id:
                        continue
                    try:
                        planetB = self.chart.getObject(objB)
                    except:
                        continue
                    edgeOrbB = props.object.orb[planetB.id]
                    # 用独立变量存「对的合并容许度」:原先复用外层 orb(=27),第一对之后
                    # 外层 deltaA 过滤/回绕窗口全被上一对的值污染,围攻判定随迭代顺序漂移。
                    pairOrb = edgeOrbA + edgeOrbB
                    for aspB in aspectlist:
                        sigB = self.getSign(planetB, aspB)
                        pntB = (planetB.lon + aspB + 360) % 360
                        deltaB = (pntB - planet.lon + 360) % 360
                        deltaB = deltaB if deltaB <= 180 else 360 - deltaB
                        # 原 `deltaA > orb or deltaA > orb` 为复制粘贴笔误,第二项应查 deltaB
                        if deltaA > pairOrb or deltaB > pairOrb:
                            continue

                        deltaAB = (pntA - pntB + 360) % 360
                        deltaAB = deltaAB if deltaAB <= 180 else 360 - deltaAB
                        if deltaAB <= pairOrb and deltaA <= edgeOrbA and deltaB <= edgeOrbB:
                            congPnt = (planet.lon + 180) % 360
                            if (pntA <= planet.lon <= pntB <= congPnt or congPnt <= pntA <= planet.lon <= pntB) or (360-pairOrb <= pntA <= planet.lon <= 360 and 0<= pntB <= pairOrb) or (360-pairOrb <= pntA and 0<= planet.lon <=pntB <= pairOrb):
                                atk = [{
                                    'aspect': aspA,
                                    'id': objA,
                                    'lon': pntA,
                                    'sign': sigA['sign'],
                                    'signlon': sigA['signlon'],
                                    'delta': deltaA
                                }, {
                                    'aspect': aspB,
                                    'id': objB,
                                    'lon': pntB,
                                    'sign': sigB['sign'],
                                    'signlon': sigB['signlon'],
                                    'delta': deltaB
                                }]
                                alltmp.append(atk)
                            elif (pntB <= planet.lon <= pntA <= congPnt or congPnt <= pntB <= planet.lon <= pntA) or (360-orb <= pntB <=planet.lon <= 360 and 0<= pntA <= orb) or (360-orb <= pntB and 0<= planet.lon <=pntA <= orb):
                                atk = [{
                                    'aspect': aspB,
                                    'id': objB,
                                    'lon': pntB,
                                    'sign': sigB['sign'],
                                    'signlon': sigB['signlon'],
                                    'delta': deltaB
                                }, {
                                    'aspect': aspA,
                                    'id': objA,
                                    'lon': pntA,
                                    'sign': sigA['sign'],
                                    'signlon': sigA['signlon'],
                                    'delta': deltaA
                                }]
                                alltmp.append(atk)

        alltmp.sort(key=takeAttackDelta)

        sunMoon = []
        venusJupiter = []
        marsSaturn = []
        for elm in alltmp:
            obj0 = elm[0]
            obj1 = elm[1]
            if (obj0['id'] == const.SUN and obj1['id'] == const.MOON) or (obj0['id'] == const.MOON and obj1['id'] == const.SUN):
                sunMoon = elm
            elif (obj0['id'] == const.VENUS and obj1['id'] == const.JUPITER) or (obj0['id'] == const.JUPITER and obj1['id'] == const.VENUS):
                venusJupiter = elm
            elif (obj0['id'] == const.MARS and obj1['id'] == const.SATURN) or (obj0['id'] == const.SATURN and obj1['id'] == const.MARS):
                marsSaturn = elm

        return {
            'SunMoon': sunMoon,
            'VenusJupiter': venusJupiter,
            'MarsSaturn': marsSaturn,
            'MinDelta': [] if len(alltmp) == 0 else alltmp[0]
        }

    # v3.0.1 perf ROUND-5:besiegementDetail 会再次调用本方法,而 webchartsrv 同一响应里已在
    # surround.attacks 键算过一遍(4 层 7×8×6×8 相位点循环 ×7 目标)。memo;相位数学只读不可变的
    # lon/sign 状态(getAspects 的 sunPos 变异不进本函数)。重复调用逐字节等值已实测。
    def surroundAttacks(self):
        if self._surroundAttacksCache is None:
            self._surroundAttacksCache = self._computeSurroundAttacks()
        return self._surroundAttacksCache

    def _computeSurroundAttacks(self):
        res = {}
        planets = const.LIST_SEVEN_PLANETS.copy()
        # if self.tradition == False:
        #     planets.append(const.URANUS)
        #     planets.append(const.NEPTUNE)
        #     planets.append(const.PLUTO)

        for obj in planets:
            try:
                planet = self.chart.get(obj)
            except:
                continue
            atk = self.surroundAttack(planet)
            if len(atk['SunMoon']) > 0 or len(atk['VenusJupiter']) > 0 or len(atk['MarsSaturn']) > 0 or len(atk['MinDelta']) > 0:
                res[obj] = atk

        return res

    # ── 围攻详断(《围攻》十六式):三种围 + 春秋势 + 宰执夏冬 + 协防 + 围魏救赵 + 日木互容制约 + 逆行 ──
    _BESIEGE_TYPE = {
        'MarsSaturn': ('围攻', '凶', ['Mars', 'Saturn']),
        'VenusJupiter': ('围荣', '富', ['Venus', 'Jupiter']),
        'SunMoon': ('围耀', '贵', ['Sun', 'Moon']),
    }

    def _is_strong_house(self, planet_obj):
        """后天强弱:一旦主宰 3/6/8/12 任一宫即「被污染」→弱(即便同时主吉宫,如主6又主10仍弱);
        只主吉宫(全不沾 3/6/8/12)→强;无主宫(罕见)退看落宫是否非凶宫。"""
        if planet_obj is None:
            return False
        weak = {const.LIST_HOUSES[i] for i in (2, 5, 7, 11)}  # House3/6/8/12
        try:
            rh = getattr(planet_obj, 'ruleHouses', []) or []
            if any(h in weak for h in rh):
                return False                                   # 主凶宫 → 污染 → 弱
            if rh:
                return True                                    # 只主吉宫 → 强
            return getattr(planet_obj, 'house', None) not in weak   # 无主宫,退看落宫
        except Exception:
            return False

    def _besiege_defense(self, target_id, target_lon, attacker_eps):
        """协防(《围攻》弃车保帅):吉星 木/日/金(及弱势水/月) 的相位点须落入「围攻区域」截击某围攻者——
        即与该侧围攻者相位点同侧、且更靠近被围星(距≤围攻者距,挡在被围星与围攻者之间),方成协防。
        以身作盾=截击的相位为合相(吉星本体落在围攻区内,如金身卫日);否则遥光(本体在它处、仅远程光线抵达)。
        强=主/落强宫(除3/6/8/12外;日木金可任,水月恒弱且协防常自陷、得不偿失)。"""
        aspectlist = [-120, -90, -60, 0, 60, 90, 120, 180]

        def sd(x):
            return ((x - target_lon + 180.0) % 360.0) - 180.0

        # 各侧最近的围攻者及其距(春=被围星高经度侧 d>0 / 秋=低经度侧)。
        side_attacker = {}
        for ep in (attacker_eps or []):
            d = sd(ep['lon'])
            s = '春' if d > 0 else '秋'
            if s not in side_attacker or abs(d) < side_attacker[s][1]:
                side_attacker[s] = (ep['id'], abs(d))

        out = []
        for yid in (const.JUPITER, const.SUN, const.VENUS, const.MOON, const.MERCURY):
            if yid == target_id:
                continue
            try:
                y = self.chart.getObject(yid)
            except Exception:
                continue
            best_asp, best_d = None, None
            for asp in aspectlist:
                d = sd((y.lon + asp + 360.0) % 360.0)
                if best_d is None or abs(d) < abs(best_d):
                    best_asp, best_d = asp, d
            if best_d is None:
                continue
            side = '春' if best_d > 0 else '秋'
            atkr = side_attacker.get(side)
            # 须截击:该侧有围攻者,且吉星相位点更近被围星(挡在中间)。否则不构成协防。
            if not atkr or abs(best_d) > atkr[1] + 1e-6:
                continue
            out.append({'id': yid, 'aspect': best_asp, 'side': side, 'against': atkr[0],
                        'orb': round(abs(best_d), 2),
                        'byBody': best_asp == 0,   # 截击相位=合相 ⇒ 吉星本体落在围攻区内 = 身盾;否则遥光
                        'strong': self._is_strong_house(y) and yid in (const.JUPITER, const.SUN, const.VENUS),
                        'selfTrap': yid in (const.MOON, const.MERCURY)})   # 水月协防得不偿失、反自陷
        return out

    def besiegementDetail(self):
        attacks = self.surroundAttacks()
        if not attacks:
            return []
        SIGNS = const.LIST_SIGNS

        def obj_of(pid):
            try:
                return self.chart.getObject(pid)
            except Exception:
                return None

        # 日木互容制约:被日/木互容的火/土,凶减半。文中"只有日、木可以,他俩还要主强宫"→ 制约方 须主/落强宫。
        # getMutuals()→{normal:[],abnormal:[]},每项 {planetA:{id..},planetB:{id..}}。
        restrained = {}
        try:
            mut = self.getMutuals() or {}
            for item in (mut.get('normal', []) + mut.get('abnormal', [])):
                a = (item.get('planetA') or {}).get('id')
                b = (item.get('planetB') or {}).get('id')
                for auth in (const.SUN, const.JUPITER):
                    if not self._is_strong_house(obj_of(auth)):   # 日/木 须主强宫方能制约
                        continue
                    if a == auth and b:
                        restrained.setdefault(b, []).append(auth)
                    elif b == auth and a:
                        restrained.setdefault(a, []).append(auth)
        except Exception:
            pass

        # 围魏救赵:围攻者自身也被某「围」(火土/金木/日月皆可,如日月围其凶星)所围 → 其害减。
        besieged_set = set(tid for tid, a in attacks.items()
                           if a.get('SunMoon') or a.get('VenusJupiter') or a.get('MarsSaturn'))

        out = []
        for tid, atk in attacks.items():
            t = obj_of(tid)
            if t is None:
                continue
            tsi = SIGNS.index(t.sign)
            for typ in ('MarsSaturn', 'VenusJupiter', 'SunMoon'):
                if not atk.get(typ):
                    continue
                kind, nature, _ids = self._BESIEGE_TYPE[typ]
                is_malefic = (typ == 'MarsSaturn')
                besiegers = []
                for ep in atk[typ]:
                    bid = ep['id']
                    b = obj_of(bid)
                    if b is None:
                        continue
                    # 春秋四季只标在「围攻者」(组间关系,被围星之冬夏可由此自然推得,不另标):
                    # off = 围攻者座 − 被围星座(星座相位,非光线)。春{7-11}主宰/秋{1-5}受制;
                    # 春+宰执被围星(off==9,被围星落围攻者10座之逆=围攻者落被围星之上)→ 夏(强极);
                    # 秋+被被围星宰执(off==3,被围星落围攻者10座)→ 冬(弱极)。
                    off = (SIGNS.index(b.sign) - tsi) % 12
                    if off in (7, 8, 9, 10, 11):
                        season = '夏' if off == 9 else '春'
                    elif off in (1, 2, 3, 4, 5):
                        season = '冬' if off == 3 else '秋'
                    else:
                        season = '中'
                    info = {'id': bid, 'aspect': ep['aspect'], 'season': season,
                            'retro': (getattr(b, 'lonspeed', 0) or 0) < 0, 'delta': round(ep.get('delta', 0), 2)}
                    if is_malefic:
                        info['restrained'] = restrained.get(bid, [])
                        info['counterBesieged'] = bid in besieged_set
                    besiegers.append(info)
                # 火土有一围攻者为春/夏(主宰侧)→ 见血(《围攻》:火土只要一颗为春夏,必见血)。
                severe = bool(is_malefic and any(x['season'] in ('春', '夏') for x in besiegers))
                # 协防:吉星相位点须截击某围攻者(同侧且更近被围星),并注明防御的是哪颗围攻星(against)。
                defense = self._besiege_defense(tid, t.lon, atk[typ]) if is_malefic else []
                out.append({
                    'target': tid, 'type': typ, 'kind': kind, 'nature': nature,
                    'besiegers': besiegers,
                    'targetRetro': (getattr(t, 'lonspeed', 0) or 0) < 0,
                    'severe': severe if is_malefic else None,
                    'defense': defense,
                })
        return out


    def surroundHouse(self, houseid):
        oc = self.orientalOccidentalHouses()
        ocary = oc[houseid]
        if len(ocary['occidental']) == 0 or len(ocary['oriental']) == 0 or len(ocary['inHouse']) > 0:
            return []

        idx = const.LIST_HOUSES.index(houseid)
        prevIdx = (12 + idx - 1) % 12
        nextIdx = (12 + idx + 1) % 12
        house = self.chart.getHouse(houseid)
        prevH = self.chart.getHouse(const.LIST_HOUSES[prevIdx])
        nextH = self.chart.getHouse(const.LIST_HOUSES[nextIdx])
        firstOcci = ocary['occidental'][0]
        firstOrient = ocary['oriental'][0]
        if firstOcci['delta'] > house.size + nextH.size or firstOrient['delta'] > prevH.size:
            return []

        res = [{
            'id': firstOrient['id'],
            'delta': firstOrient['delta']
        }, {
            'id': firstOcci['id'],
            'delta': firstOcci['delta'] - house.size
        }]
        return res



    def surroundHouses(self):
        res = {}
        for obj in const.LIST_HOUSES:
            houseRes = self.surroundHouse(obj)
            if len(houseRes) == 0:
                continue
            res[obj] = houseRes

        return res

    def orientalOccidental(self):
        if self.orientOccident != None:
            return self.orientOccident

        res = {}
        planets = const.LIST_SEVEN_PLANETS.copy()
        # if self.tradition == False:
        #     planets.append(const.URANUS)
        #     planets.append(const.NEPTUNE)
        #     planets.append(const.PLUTO)

        for obj in planets:
            try:
                planet = self.chart.getObject(obj)
            except:
                continue
            pntA = planet.lon
            pntB = pntA + 180 if pntA <= 180 else pntA - 180
            res[obj] = {
                'oriental': [],
                'occidental': []
            }
            for elm in planets:
                if obj == elm:
                    continue
                try:
                    planetB = self.chart.getObject(elm)
                except:
                    continue
                if (pntB < planetB.lon < pntA) or (0<= planetB.lon < pntA and pntB > 180) or (pntB > 180 and planetB.lon > pntB):
                    delta = planet.lon - planetB.lon
                    delta = delta if delta >= 0 else delta + 360
                    res[obj]['oriental'].append({
                        'id': elm,
                        'delta': delta
                    })
                else:
                    delta = planetB.lon - planet.lon
                    delta = delta if delta >= 0 else delta + 360
                    res[obj]['occidental'].append({
                        'id': elm,
                        'delta': delta
                    })
            res[obj]['oriental'].sort(key=takeDelta)
            res[obj]['occidental'].sort(key=takeDelta)

        self.orientOccident = res
        return res

    def orientalOccidentalHouses(self):
        if self.orientOccidentHouses != None:
            return self.orientOccidentHouses

        res = {}
        planets = const.LIST_SEVEN_PLANETS.copy()
        # if self.tradition == False:
        #     planets.append(const.URANUS)
        #     planets.append(const.NEPTUNE)
        #     planets.append(const.PLUTO)

        for obj in const.LIST_HOUSES:
            house = self.chart.get(obj)
            pntA = house.lon
            pntB = pntA + 180 if pntA <= 180 else pntA - 180
            res[obj] = {
                'inHouse': [],
                'oriental': [],
                'occidental': []
            }
            for elm in planets:
                try:
                    planetB = self.chart.getObject(elm)
                except:
                    continue
                if elm in house.planets:
                    res[obj]['inHouse'].append({
                        'id': elm,
                        'delta': planetB.lon - house.lon
                    })
                    continue
                if (pntB < planetB.lon < pntA) or (0<= planetB.lon < pntA and pntB > 180) or (pntB > 180 and planetB.lon > pntB):
                    delta = house.lon - planetB.lon
                    delta = delta if delta >= 0 else delta + 360
                    res[obj]['oriental'].append({
                        'id': elm,
                        'delta': delta
                    })
                else:
                    delta = planetB.lon - house.lon
                    delta = delta if delta >= 0 else delta + 360
                    res[obj]['occidental'].append({
                        'id': elm,
                        'delta': delta
                    })
            res[obj]['inHouse'].sort(key=takeDelta)
            res[obj]['oriental'].sort(key=takeDelta)
            res[obj]['occidental'].sort(key=takeDelta)

        self.orientOccidentHouses = res
        return res

    def getSignAspects(self):
        res = {}
        planets = const.LIST_SEVEN_PLANETS.copy()
        if self.tradition == False:
            planets.append(const.URANUS)
            planets.append(const.NEPTUNE)
            planets.append(const.PLUTO)

        for objA in planets:
            try:
                planetA = self.chart.getObject(objA)
            except:
                continue
            signIdxA = const.LIST_SIGNS.index(planetA.sign)

            res[objA] = []
            for objB in planets:
                if objA == objB:
                    continue
                try:
                    planetB = self.chart.getObject(objB)
                except:
                    continue
                signIdxB = const.LIST_SIGNS.index(planetB.sign)
                delta = signIdxA - signIdxB
                delta = delta if delta >= 0 else delta + 12
                if delta == 0:
                    res[objA].append({
                        'asp': 0,
                        'id': objB
                    })
                elif delta == 2:
                    res[objA].append({
                        'asp': 60,
                        'id': objB
                    })
                elif delta == 3:
                    res[objA].append({
                        'asp': 90,
                        'id': objB
                    })
                elif delta == 4:
                    res[objA].append({
                        'asp': 120,
                        'id': objB
                    })
                elif delta == 6:
                    res[objA].append({
                        'asp': 180,
                        'id': objB
                    })
                elif delta == 8:
                    res[objA].append({
                        'asp': 120,
                        'id': objB
                    })
                elif delta == 8:
                    res[objA].append({
                        'asp': 120,
                        'id': objB
                    })
                elif delta == 9:
                    res[objA].append({
                        'asp': 90,
                        'id': objB
                    })
                elif delta == 10:
                    res[objA].append({
                        'asp': 60,
                        'id': objB
                    })
            res[objA].sort(key=takeAsp)

        return res

    def getBirthStr(self):
        str = '{0}-{1}-{2} {3}'.format(self.year, self.month, self.day, self.time)
        return str

    def isAboveHorizon(self, planet):
        mc = self.chart.getAngle(const.MC)

        # Get ecliptical positions and check if the
        # planet is above the horizon.
        lat = self.chart.pos.lat
        mcRA, mcDecl = utils.eqCoords(mc.lon, 0)
        return utils.isAboveHorizon(planet.ra, planet.decl, mcRA, lat)

    def hayyiz(self, planet, isDiunal):
        """
        计算得时失时
        :param planet:
        :param isDiunal:
        :return:
        """
        res = 'None'
        planet.aboveHorizon = self.isAboveHorizon(planet)
        if planet.id in const.LIST_SEVEN_PLANETS:
            if planet.aboveHorizon:
                fact = planet.faction()
                sigidx = const.LIST_SIGNS.index(planet.sign)
                if isDiunal and fact == const.DIURNAL:
                    if sigidx % 2 == 0:
                        res = 'Hayyiz'
                elif isDiunal == False and fact == const.DIURNAL and sigidx % 2 == 1:
                    res = 'InWrongPos'
                elif isDiunal == False and fact == const.NOCTURNAL:
                    if planet.id == const.MARS:
                        if sigidx % 2 == 0:
                            res = 'Hayyiz'
                        else:
                            res = 'DemiHayyiz'
                    else:
                        if sigidx % 2 == 1:
                            res = 'Hayyiz'
                elif isDiunal and fact == const.NOCTURNAL and sigidx % 2 == 0:
                    res = 'InWrongPos'
        planet.hayyiz = res
        return res

    def getPars(self, chart):
        res = []
        for par in chart.pars:
            res.append(par)
        return res

    def getPar(self, lotId):
        return self.chart.get(lotId)

    def getFixedStarSu28ByDouBing(self):
        from astrostudy.guostarsect.guo74 import Guo74
        g74 = Guo74(self)
        res = g74.compute()
        self.relocateSouthObjects(res)
        res.sort(key=takeRa)
        return res

    def getVirtualFixedStarSu28(self):
        from astrostudy.guostarsect.guo74 import Guo74
        g74 = Guo74(self)
        res = g74.virtualSu28()
        self.relocateSouthObjects(res)
        res.sort(key=takeRa)
        return res

    def getMoiraFixedStarSu28(self):
        # 三套宿度制对齐自有恒星案(均沿黄道置宿,planets 用黄经):
        #   回归今制(MOIRA_CURRENT): 28 距星活体 tropical 黄经(严格 IAU 岁差),逐宿不均匀。
        #   回归古制开禧(MOIRA_KAIXI): 开禧基值 + ayanamsha(1300/4.0)。
        #   恒星制郑式(ZHENG_SIDEREAL): 郑氏恒星基值原值(盘已 sidereal,planets 亦 sidereal)。
        jd = self.chart.date.jd
        if self.su28Mode == SU28_MODE_MOIRA_KAIXI:
            ayan = _moira_ayanamsha(jd)
            degrees = [(d + ayan) % 360 for d in MOIRA_KAIXI_STELLAR_DEGREES]
        elif self.su28Mode == SU28_MODE_ZHENG_SIDEREAL:
            degrees = [d % 360 for d in MOIRA_CURRENT_STELLAR_DEGREES]
        else:
            lon_by_name = _moira_distar_lons(jd)
            degrees = [lon_by_name[name] % 360 for name in MOIRA_STELLAR_ORDER]

        res = []
        for idx, name in enumerate(MOIRA_STELLAR_ORDER):
            lon = degrees[idx] % 360
            sig = const.LIST_SIGNS[int(lon / 30) % 12]
            star = {
                'ra': lon,
                'decl': 0,
                'name': name,
                'wuxing': const.Su28WuXing[name],
                'animal': const.Su28Animal[name],
                'id': SU28_ID_BY_NAME[name],
                'lon': lon,
                'lat': 0,
                'sign': sig,
                'signlon': lon % 30,
                'type': const.OBJ_FIXED_STAR
            }
            res.append(object.Object.fromDict(star))
        res.sort(key=lambda s: s.lon)
        return res

    def getEquatorialSu28(self):
        # 现代天赤恒星制(mode5):按赤经定宿,planets 用 RA(byLon=False)。
        # WP-B 真修:原实现取 MOIRA_DISTAR_J2000 的 RA 定宿(_moira_distar_ras),但该表为 mode2 黄经调好——
        #   数行赤纬非物理(亢/柳/胃/星/张/翼/鬼),黄仪取黄经恰好遮住、赤仪取赤经就爆(定宿偏 10–44°)。
        # 改用与荀爽(REAL)同一份正确赤道距星活体源 chart.getFixedStartsSu28()(flatlib,已验在序),
        #   仅去掉 mode0 荀爽一家的 危/鬼 年改正(那是实测微调)→ 得干净现代真星赤经恒星制。
        # 绝不动 MOIRA_DISTAR_J2000(mode2/3/4 黄经依赖、字节默认盘)。
        stars = self.chart.getFixedStartsSu28()
        self.relocateSouthObjects(stars)
        res = []
        delta = 0.004
        for id in const.LIST_FIXED_SU28:
            star = stars.content[id]
            if 90 <= star.ra < 270:
                star.ra = star.ra - delta
            else:
                star.ra = star.ra + delta
            res.append(star)
        res.sort(key=takeRa)
        return res

    def getGufaLichengSu28(self):
        # WP-D 授时历古法立成:推变黄道术(元明赤道宿度→黄道宿度立成,极黄经)→ 28 宿黄道起界(360 frame)。
        # 角宿黄道起点由元时春分(壁6°)推导≈黄经193°(=元时 Spica/α Vir 实位,岁差核对吻合)。
        # 古宿固定(默认·永不变):宿界钉死元时;随岁差(guolaoGufaPrecess=1):宿界东移≈50.29″/年(授时历元 1280 起)。
        from astrostudy import guolao_tuibian as gt
        table = gt.mansion_huangdao_table(self.guolaoTuibianMethod)   # 28 宿黄道距度(365.2575 古度)
        scale = 360.0 / gt.ZHOUTIAN_ANCIENT
        anchor = (gt.chidao_to_huangdao(0.0, self.guolaoTuibianMethod) * scale) % 360.0   # 角宿黄道起点(元时)
        if self.guolaoGufaPrecess:
            try:
                anchor = (anchor + (float(self.year) - 1280.0) * (50.29 / 3600.0)) % 360.0
            except Exception:
                pass
        res = []
        cum = 0.0
        for idx, name in enumerate(gt.SU28_NAMES):
            lon = (anchor + cum) % 360.0
            sig = const.LIST_SIGNS[int(lon / 30) % 12]
            star = {
                'ra': lon, 'decl': 0, 'name': name,
                'wuxing': const.Su28WuXing[name], 'animal': const.Su28Animal[name],
                'id': SU28_ID_BY_NAME[name], 'lon': lon, 'lat': 0,
                'sign': sig, 'signlon': lon % 30, 'type': const.OBJ_FIXED_STAR
            }
            res.append(object.Object.fromDict(star))
            cum += table[idx] * scale
        res.sort(key=lambda s: s.lon)
        return res

    def getEquatorialTropicalSu28(self):
        # 额外档·赤道回归制(mode7):宿界=固定元明赤道宿度立成(× 360/365.2575),以春分/牛前冬至为锚、赤经常数、不随岁差;
        # 行星按盘历元赤经(byRA)落入 → 宿界钉死、真实恒星随岁差从宿界西移穿过(与 mode5「宿随星走」正相反)。
        # 不调 _moira_distar_ras、不做 IAU 进动(这正是与 mode5 的分界)。中性命名,无软件名/书名。
        from astrostudy import guolao_tuibian as gt
        scale = 360.0 / gt.ZHOUTIAN_ANCIENT       # 365.2575 古度 → 360° 赤经
        cum = gt._cumulative_equatorial()         # 各宿起始累积赤道(角起 0,365.2575 古度)
        # 锚定常数(本档唯一关键决策点·做成选项):
        #   dongzhi 牛前冬至(默认):牛宿前缘 = 冬至 RA 270° → offset = 270 − 牛起(scaled)
        #   chunfen 春分壁2.3:壁宿2.3度 = 春分 RA 0° → offset = 0 − (壁起+2.3)(scaled)
        if self.guolaoEqTropicalAnchor == 'chunfen':
            anchor_pos = (cum[gt.SU28_NAMES.index('壁')] + 2.3) * scale
            offset = (0.0 - anchor_pos) % 360.0
        else:
            anchor_pos = cum[gt.SU28_NAMES.index('牛')] * scale
            offset = (270.0 - anchor_pos) % 360.0
        res = []
        for i, name in enumerate(gt.SU28_NAMES):
            ra = (cum[i] * scale + offset) % 360.0
            star = {
                'ra': ra, 'decl': 0, 'name': name,
                'wuxing': const.Su28WuXing[name], 'animal': const.Su28Animal[name],
                'id': SU28_ID_BY_NAME[name], 'lon': ra, 'lat': 0,
                'sign': const.LIST_SIGNS[int(ra / 30) % 12], 'signlon': ra % 30, 'type': const.OBJ_FIXED_STAR
            }
            res.append(object.Object.fromDict(star))
        res.sort(key=takeRa)
        return res

    def getEquatorialTropicalLiveSu28(self):
        # 赤道回归·实时(mode8):宿宽=盘历元距星真赤经差(与 mode5 恒星制同一活体距星源),
        # 锚=回归点(牛前冬至 270° 默认 / 春分壁2.3 古度,语义与 mode7 元明立成同款)——
        # 冬至/春分永远钉在锚宿位、宿形随时代实测,即授时历「实测宿度+冬至锚」体系的活体版;
        # 与 mode5 之别在锚(回归锚 vs 距星绝对赤经),与 mode7 之别在宿宽(实时 vs 元明立成)。
        base = self.getEquatorialSu28()
        ra_by_id = {}
        for s in base:
            ra_by_id[s.id] = s.ra
        if self.guolaoEqTropicalAnchor == 'chunfen':
            from astrostudy import guolao_tuibian as gt
            scale = 360.0 / gt.ZHOUTIAN_ANCIENT
            anchor_ra = (ra_by_id[const.START_QIANBI] + 2.3 * scale) % 360.0
            offset = (0.0 - anchor_ra) % 360.0
        else:
            offset = (270.0 - ra_by_id[const.START_NIU]) % 360.0
        name_by_id = dict(zip(const.LIST_FIXED_SU28, const.LIST_FIXED_SU28_NAME))
        res = []
        for s in base:
            ra = (s.ra + offset) % 360.0
            name = name_by_id.get(s.id)
            star = {
                'ra': ra, 'decl': 0, 'name': name,
                'wuxing': const.Su28WuXing[name], 'animal': const.Su28Animal[name],
                'id': s.id, 'lon': ra, 'lat': 0,
                'sign': const.LIST_SIGNS[int(ra / 30) % 12], 'signlon': ra % 30, 'type': const.OBJ_FIXED_STAR
            }
            res.append(object.Object.fromDict(star))
        res.sort(key=takeRa)
        return res

    def fillPlanetSu28(self, res, byLon=False):
        obj = const.LIST_ALL_POINTS
        for id in obj:
            try:
                planet = self.chart.get(id)
                self.setPlanetSu28(res, planet, byLon=byLon)
            except:
                continue


    # v3.0.1 perf ROUND-5:同一请求 'fixedStarSu28' 与 'su28Adjust' 两个键各调一次本方法,每次都从
    # swisseph 重取 28 星再重做同一套 ra 调整(单次 ~50ms)。memo **成品列表**(★方法会原地改 star.ra,
    # 缓存成品保证调整恰好执行一次);消费者只读。重复调用逐字节等值已实测证明。
    def getAdjustFixedStarSu28(self):
        if self._adjustSu28Cache is None:
            self._adjustSu28Cache = self._computeAdjustFixedStarSu28()
        return self._adjustSu28Cache

    # v3.0.1 perf ROUND-5:guo74.virtualSu28 原本逐星 chart.getFixedStar()×28 只为读 decl —— 同一请求
    # 对同一批 28 星的第三次取数。这里缓存一次**原始批**(未 relocate、未调 ra,与逐星取值同源同值:
    # 同 (star, jd, flags) 的 decl 确定性,重复取数逐字节等值已实测)。与上面的成品缓存严格分离:
    # 成品路径自己另取一批再变异,绝不共享对象,防变异串染。消费者(guo74)只读 decl。
    def getRawFixedStarSu28Cached(self):
        if self._rawSu28Cache is None:
            self._rawSu28Cache = self.chart.getFixedStartsSu28()
        return self._rawSu28Cache

    def _computeAdjustFixedStarSu28(self):
        stars = self.chart.getFixedStartsSu28()
        self.relocateSouthObjects(stars)
        res = []
        delta = 0.004
        y = int(self.year)
        for id in const.LIST_FIXED_SU28:
            star = stars.content[id]
            ra = star.ra

            if star.id == const.START_WEI:
                if y <= 2000:
                    ra = ra - 0.000053625*(y + 2000) - 1.4175
                else:
                    ra = ra - 0.00003*(y - 2000) - 1.632
                star.ra = ra
            elif star.id == const.START_GUI:
                if y <= 2000:
                    ra = ra - 0.000255*(y + 2000) + 0.7425
                else:
                    ra = ra - 0.0001725*(y - 2000) - 0.2775
                star.ra = ra

            if 90 <= star.ra < 270:
                star.ra = star.ra - delta
            else:
                star.ra = star.ra + delta

            res.append(star)
        res.sort(key=takeRa)
        return res

    def getFixedStarSu28(self):
        if self.isDoubingSu28:
            return self.getFixedStarSu28ByDouBing()

        # 回归今制 / 回归古制开禧 / 恒星制郑式 三制均走自有恒星案,沿黄道置宿(planets 用黄经)。
        if self.su28Mode in (SU28_MODE_MOIRA_CURRENT, SU28_MODE_MOIRA_KAIXI, SU28_MODE_ZHENG_SIDEREAL):
            res = self.getMoiraFixedStarSu28()
            self.fillPlanetSu28(res, byLon=True)
            return res

        # G3/G4 赤道恒星制(制一): 现代赤道距星案进动赤经定宿,planets 用 RA。
        if self.su28Mode == SU28_MODE_EQUATORIAL_SIDEREAL:
            res = self.getEquatorialSu28()
            self.fillPlanetSu28(res)
            return res

        # WP-D 授时历古法立成(mode6): 推变黄道宿度(极黄经)沿黄经置宿(planets 用黄经)。古宿固定(元时)或随岁差。
        if self.su28Mode == SU28_MODE_GUFA_LICHENG:
            res = self.getGufaLichengSu28()
            self.fillPlanetSu28(res, byLon=True)
            return res

        # 额外档·赤道回归制(mode7): 固定元明赤道宿度立成(春分/牛前冬至锚、赤经常数、不随岁差),planets 用赤经(byRA)。
        if self.su28Mode == SU28_MODE_EQUATORIAL_TROPICAL:
            res = self.getEquatorialTropicalSu28()
            self.fillPlanetSu28(res)
            return res

        # 赤道回归·实时(mode8): 宿宽=盘历元距星真赤经(mode5 同源),锚=回归点(mode7 同款),planets 用赤经(byRA)。
        if self.su28Mode == SU28_MODE_EQUATORIAL_TROPICAL_LIVE:
            res = self.getEquatorialTropicalLiveSu28()
            self.fillPlanetSu28(res)
            return res

        # 荀爽 19 年测量(REAL): 赤道距星活体,沿赤经置宿(planets 用 RA)。
        res = self.getAdjustFixedStarSu28()
        self.fillPlanetSu28(res)
        return res

    # v3.0.1 perf ROUND-5:67 恒星表在同一请求被 getStars 与 getFixedStars 各全量重算一次(flatlib 每次
    # 从 swisseph 重取 67 星,swisseph 逐星重扫 sefstars.txt,单次 ~130ms)。取一次 + relocate 一次后共享;
    # 两个消费者均只读。★防坑:relocateSouthObjects 是 +180° 原地变换,必须缓存在 relocate **之后**,
    # 否则南盘(lat<0)跑两次会把变换抵消。重复调用 jsonpickle 输出逐字节等值已实测证明。
    def _getFixedStars67Cached(self):
        if self._fixedStars67Cache is None:
            stars = self.chart.getFixedStars()
            self.relocateSouthObjects(stars)
            self._fixedStars67Cache = stars
        return self._fixedStars67Cache

    def getFixedStars(self):
        stars = self._getFixedStars67Cached()
        res = []
        for id in const.LIST_FIXED_STARS:
            obj = stars.content[id]
            res.append(obj)
        return res

    def getBeiDou(self):
        stars = self.chart.getFixedStarBeiDou()
        self.relocateSouthObjects(stars)
        res = []
        for id in const.LIST_BEIDOU:
            obj = stars.content[id]
            res.append(obj)
        return res

    def getBeiJi(self):
        stars = self.chart.getFixedStarBeiJi()
        self.relocateSouthObjects(stars)
        res = []
        for id in const.LIST_BEIJI:
            obj = stars.content[id]
            res.append(obj)
        res.sort(key=takeDecl)
        return res

    def setPlanetSu28(self, res, planet, byLon=False):
        # byLon=True: 沿黄道置宿(自有恒星案三制,宿界与行星均用黄经);
        # byLon=False: 沿赤经置宿(荀爽赤道距星法,用 RA)。
        pval = planet.lon if byLon else planet.ra
        starSel = None
        for star in res:
            sval = star.lon if byLon else star.ra
            if sval <= pval:
                starSel = star
            else:
                break
        if starSel == None:
            starSel = res[len(res) - 1]
        planet.su28 = starSel.name

    def getBirthBySystime(self):
        tmparts = self.time.split(':')
        y = int(self.year)
        if y < 0:
            y = -y
        return datetime.datetime(y, int(self.month), int(self.day), int(tmparts[0]), int(tmparts[1]))

    def getParallel(self):
        res = {}
        res['parallel'] = []
        res['contraParallel'] = {}

        planets = const.LIST_ALL_POINTS.copy()
        for objA in planets:
            try:
                planetA = self.chart.get(objA)
            except:
                continue
            for objB in planets:
                if objA == objB:
                    continue
                try:
                    planetB = self.chart.get(objB)
                except:
                    continue
                delta = abs(planetA.decl - planetB.decl)
                sameSize = planetA.decl * planetB.decl > 0
                if delta <= 1 and sameSize:
                    found = False
                    for pSet in res['parallel']:
                        if objA in pSet:
                            pSet.add(objB)
                            found = True
                            break
                    if found is False:
                        pSet = set()
                        pSet.add(objA)
                        pSet.add(objB)
                        res['parallel'].append(pSet)
                elif sameSize is False and abs(abs(planetA.decl) - abs(planetB.decl)) <= 1:
                    if objA in res['contraParallel']:
                        res['contraParallel'][objA].add(objB)
                    else:
                        # 原先建空 set 后漏 add(objB):每颗行星的第一个反平行伙伴被静默丢弃
                        res['contraParallel'][objA] = set()
                        res['contraParallel'][objA].add(objB)

        # set 迭代序随 PYTHONHASHSEED 跨进程漂移,同参请求在服务重启后响应字节不稳
        # (2026-07 对拍实证:仅此字段序漂移,数值全同)。出口确定化:组内按 id 字典序,
        # parallel 组间按首元素排序;纯排序,成员与数值零变。
        res['parallel'] = sorted((sorted(pSet) for pSet in res['parallel']), key=lambda grp: grp[0])
        res['contraParallel'] = {objA: sorted(objBs) for objA, objBs in res['contraParallel'].items()}
        return res

    def getDayerStar(self):
        day = self.dateTime.date.dayofweek()
        daystar = dayerStar[day]
        return daystar

    # v3.0.1 perf ROUND-5:日出求解(最多 50 次迭代建瘦 Chart)同一请求跑 2-3 次('sunRiseTime' 键 +
    # getTimerStar 内 + guolao yumao 模式再一次)。memo 结果 dict;消费者只读 timeStr/datetime.jd,
    # 从不改写(已核)。重复调用逐字节等值已实测。
    def getSunRiseTime(self):
        if self._sunRiseCache is None:
            self._sunRiseCache = self._computeSunRiseTime()
        return self._sunRiseCache

    def _computeSunRiseTime(self):
        dt = Datetime(self.date, "05:00:00", self.zone)
        dist = 99
        speed = 1 / (4 / 60 / 24)
        count = 1
        thredholds = 50
        while abs(dist) > 0.5 and count < thredholds:
            chart = Chart(dt, self.pos, self.zodiacal, hsys=self.house, IDs=[const.SUN], needpars=False)
            asc = chart.getAngle(const.ASC)
            sun = chart.getObject(const.SUN)
            dist = distance(sun.lon, asc.lon) / 2
            deltatm = dist / speed
            newjd = dt.jd + deltatm
            dt = Datetime.fromJD(newjd, self.zone)
            count = count + 1

        if count >= thredholds:
            dt = Datetime(self.date, "05:00:00", self.zone)

        sunT = dt.toCNString()
        parts = sunT.split(' ')
        res = {
            'datetime': dt,
            'timeStr': parts[1]
        }
        return res

    def getSunSetTime(self):
        # 日没:太阳落在下降点(西方地平)。算法同 getSunRiseTime 迭代法,改以 DESC 为目标、起 17:00。
        dt = Datetime(self.date, "17:00:00", self.zone)
        dist = 99
        speed = 1 / (4 / 60 / 24)
        count = 1
        thredholds = 50
        while abs(dist) > 0.5 and count < thredholds:
            chart = Chart(dt, self.pos, self.zodiacal, hsys=self.house, IDs=[const.SUN], needpars=False)
            desc = chart.getAngle(const.DESC)
            sun = chart.getObject(const.SUN)
            dist = distance(sun.lon, desc.lon) / 2
            deltatm = dist / speed
            newjd = dt.jd + deltatm
            dt = Datetime.fromJD(newjd, self.zone)
            count = count + 1

        if count >= thredholds:
            dt = Datetime(self.date, "17:00:00", self.zone)

        sunT = dt.toCNString()
        parts = sunT.split(' ')
        res = {
            'datetime': dt,
            'timeStr': parts[1]
        }
        return res


    def getTimerStar(self):
        birth = '{0}-{1}-{2}'.format(self.year, self.month, self.day)
        # G6 报时星太阳时:true=真(经度时差+均时差,默认零回归)/mean=平(仅经度)/off=钟表(不校正)。
        solarMode = self.data.get('trueSolarTime', 'true') if isinstance(self.data, dict) else 'true'
        if solarMode not in ('true', 'mean', 'off'):
            solarMode = 'true'
        tmoffset = getOffsetByDate(birth, self.zone, self.lon, solarMode)
        offsetjdn = tmoffset / 3600.0 / 24.0

        dt = Datetime(self.date, self.time, self.zone)
        jdn = dt.jd + offsetjdn
        bdt = Datetime.fromJD(jdn, self.zone)
        bdtstr = bdt.toCNString()
        bdtparts = bdtstr.split(' ')
        birttm = bdtparts[1]

        day = self.dateTime.date.dayofweek()
        daystar = dayerStar[day]
        timerIdx = timerStar.index(daystar)
        parts = birttm.split(':')
        h = int(parts[0]) + float(parts[1])/60
        if len(parts) > 2:
            h = h + float(parts[2])/3600

        sunTObj = self.getSunRiseTime()
        sunjdn = sunTObj['datetime'].jd + offsetjdn
        sundt = Datetime.fromJD(sunjdn, self.zone)
        suntstr = sundt.toCNString()
        tstrparts = suntstr.split(' ')

        sunT = tstrparts[1]
        sunTparts = sunT.split(':')
        sunH = int(sunTparts[0]) + float(sunTparts[1])/60 + float(sunTparts[2])/3600
        # 日出后第 N 个小时:floor(经过时长)。原 int(h)-int(sunH) 数的是「跨过几个整点」,
        # 日出 6:50 生于 7:10(仅过 20 分钟)会被错算成第 2 小时;日出前出生 floor 给负数,
        # (timerIdx-2)%7 与「前一日第 22 时」在 7 星循环下同余,口径自洽。
        delta = int(math.floor(h - sunH))
        idx = (timerIdx + delta + 28) % 7
        star = timerStar[idx]
        return star

    def getHyleg(self):
        pass

    def getAlcochocen(self):
        pass
