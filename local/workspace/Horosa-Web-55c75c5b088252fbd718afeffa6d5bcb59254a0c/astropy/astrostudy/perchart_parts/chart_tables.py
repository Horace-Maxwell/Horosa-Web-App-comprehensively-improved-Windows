"""盘面基础表与小工具:日 / 时主星表、宫制编号表、希腊点表、星域表、取差值小工具、可见弧(由排盘模块整段搬出,astrostudy.perchart 照旧可取这些名字)。"""
from flatlib import const
from flatlib.tools import arabicparts


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
