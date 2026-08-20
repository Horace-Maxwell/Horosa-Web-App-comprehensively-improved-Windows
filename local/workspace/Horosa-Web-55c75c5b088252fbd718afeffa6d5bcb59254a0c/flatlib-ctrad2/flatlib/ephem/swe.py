"""
    This file is part of flatlib - (C) FlatAngle
    Author: João Ventura (flatangleweb@gmail.com)
    
    
    This module implements a simple interface with the C 
    Swiss Ephemeris using the pyswisseph library.
    
    The pyswisseph library must be already installed and
    accessible.
  
"""

import math
import os
import threading
import swisseph
from flatlib import angle
from flatlib import const
from flatlib import utils


SEFLG_JPLEPH = 1    # use JPL ephemeris
SEFLG_SWIEPH = 2    # use SWISSEPH ephemeris, default
SEFLG_MOSEPH = 4    # use Moshier ephemeris
SEFLG_HELCTR = 8    # return heliocentric position
SEFLG_TRUEPOS = 16  # return true positions, not apparent
SEFLG_J2000 = 32    # no precession, i.e. give J2000 equinox
SEFLG_NONUT = 64    # no nutation, i.e. mean equinox of date
SEFLG_SPEED3 = 128  # speed from 3 positions (do not use it, SEFLG_SPEED is faster and preciser.)
SEFLG_SPEED = 256   # high precision speed (analyt. comp.)
SEFLG_NOGDEFL = 512 # turn off gravitational deflection
SEFLG_NOABERR = 1024 # turn off 'annual' aberration of light
SEFLG_ASTROMETRIC = SEFLG_NOABERR | SEFLG_NOGDEFL # astrometric positions
SEFLG_EQUATORIAL = 2048 # equatorial positions are wanted
SEFLG_XYZ = 4096    # cartesian, not polar, coordinates
SEFLG_RADIANS = 8192    # coordinates in radians, not degree
SEFLG_BARYCTR = 16384   # barycentric positions
SEFLG_TOPOCTR = 32 * 1024 # topocentric positions
SEFLG_SIDEREAL = 64 * 1024  # sidereal positions
SEFLG_ICRS = 128 * 1024 # ICRS (DE406 reference frame)
SEFLG_DPSIDEPS_1980 = 256 * 1024 # reproduce JPL Horizons * 1962 - today to 0.002 arcsec
SEFLG_JPLHOR = SEFLG_DPSIDEPS_1980
SEFLG_JPLHOR_APPROX = 512 * 1024 # approximate JPL Horizons 1962 - today

_EPHE_MODE_FLAGS = {
    'JPL': swisseph.FLG_JPLEPH,
    'JPLEPH': swisseph.FLG_JPLEPH,
    'SWIEPH': swisseph.FLG_SWIEPH,
    'SWISS': swisseph.FLG_SWIEPH,
    'MOSEPH': swisseph.FLG_MOSEPH,
    'MOSHIER': swisseph.FLG_MOSEPH,
}


def _defaultModeFlag():
    mode = os.environ.get('HOROSA_SWISSEPH_MODE', 'SWIEPH').strip().upper()
    return _EPHE_MODE_FLAGS.get(mode, swisseph.FLG_SWIEPH)


def _defaultFlags():
    return _defaultModeFlag() + swisseph.FLG_SPEED


SEDEFAULT_FLAG = _defaultFlags()
SEACTIVE_PATH = None
SEACTIVE_MODE = None
SEACTIVE_JPL_FILE = None
_SET_EPHE_PATH = swisseph.set_ephe_path


def _candidateEphePath():
    env_path = os.environ.get('HOROSA_SWISSEPH_PATH', '').strip()
    if env_path and os.path.isdir(env_path):
        return env_path
    if SEACTIVE_PATH and os.path.isdir(SEACTIVE_PATH):
        return SEACTIVE_PATH
    package_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'resources', 'swefiles'))
    if os.path.isdir(package_path):
        return package_path
    return SEACTIVE_PATH


# horosa_ephe_path_fastpath_v1(PERF-R9):记录「当前真正生效的星历路径」,让 ensureEphePath
# 在无人改动时直接短路。这是安全的,因为 _guardedSetEphePath 自下方 `swisseph.set_ephe_path = ...`
# 起就是**进程内唯一入口** —— 全部 vendor/kinastro 模块的 `swe.set_ephe_path("")` 都经运行时
# 属性查找路由到这里,所以这个变量不可能落后于真实状态;一旦有人改了路径,下面的比较立刻失配、
# 照旧恢复,语义与改动前完全一致。
# 为什么值得:applySiderealMode 每次 swe 调用都会走一趟 ensureEphePath —— 实测单次
# BirthJieQi.compute() 里 `swisseph.set_ephe_path` 被调 **680 次、耗时 82ms = 该端点的 61%**,
# 而 /jieqi/birth 又是 /chart 里 baziAssemble 的最大单项。一处短路,整条链受益。
# kill-switch:HOROSA_EPHE_PATH_FASTPATH=0 → 每次都照旧真正调用。
_EPHE_PATH_ACTIVE = None
_JPL_FILE_ACTIVE = None
_EPHE_FASTPATH = os.environ.get('HOROSA_EPHE_PATH_FASTPATH', '1').lower() not in ('0', 'false', 'no', 'off')


def _guardedSetEphePath(path):
    # Several bundled kinastro modules reset pyswisseph to its process default
    # with set_ephe_path(""). Keep the packaged swefiles path active instead.
    global _EPHE_PATH_ACTIVE
    if path is None or str(path).strip() == '':
        path = _candidateEphePath() or ''
    _EPHE_PATH_ACTIVE = path
    return _SET_EPHE_PATH(path)


swisseph.set_ephe_path = _guardedSetEphePath


# horosa_ephe_path_fastpath_v1 的第二半 —— 必须与短路成对存在,否则短路是不安全的。
# 背景:`swe_set_ephe_path()` 在 C 库里会**顺带关闭已打开的星历文件**。原实现每次 swe 调用
# 都重设路径,于是文件被反复关闭+重开(那正是被测出的 82ms 里的实际工作量)。短路之后
# 文件句柄常驻 —— 这对性能是纯收益、对生产也无害(更新时安装器本就会先结束进程),
# 但它带来一个必须堵住的洞:**任何人调用 swisseph.close() 之后,_EPHE_PATH_ACTIVE 就
# 陈旧了**,ensureEphePath 会误以为路径还生效而跳过重设。
# 因此把 close 也纳入守卫:一旦有人真的关了,追踪器立刻作废,下一次 ensureEphePath 照旧重设。
# (当前产品代码无人调用它 —— 已 grep 确认;此举是为了让短路在结构上安全,而不是靠「没人调用」。)
_SWE_CLOSE = getattr(swisseph, 'close', None)

if _SWE_CLOSE is not None:
    def _guardedClose():
        global _EPHE_PATH_ACTIVE, _JPL_FILE_ACTIVE
        _EPHE_PATH_ACTIVE = None
        _JPL_FILE_ACTIVE = None
        return _SWE_CLOSE()

    swisseph.close = _guardedClose


def closeEphemerisFiles():
    """显式释放 swisseph 持有的星历文件句柄(并作废路径追踪器)。

    生产代码不需要调用它 —— 句柄常驻是正常且更快的工作方式。
    存在的意义:测试/工具需要**移动或删除 .se1 文件**时,Windows 不允许改名被打开的文件,
    必须先显式关闭。调用后一切照旧:下一次 ensureEphePath 会重新建立路径。
    """
    if _SWE_CLOSE is not None:
        swisseph.close()

SE_SIDM_FAGAN_BRADLEY = getattr(swisseph, 'SIDM_FAGAN_BRADLEY', 0)
SE_SIDM_LAHIRI = getattr(swisseph, 'SIDM_LAHIRI', 1)
SE_SIDM_DELUCE = getattr(swisseph, 'SIDM_DELUCE', 2)
SE_SIDM_RAMAN = getattr(swisseph, 'SIDM_RAMAN', 3)
SE_SIDM_USHASHASHI = getattr(swisseph, 'SIDM_USHASHASHI', 4)
SE_SIDM_KRISHNAMURTI = getattr(swisseph, 'SIDM_KRISHNAMURTI', 5)
SE_SIDM_YUKTESHWAR = getattr(swisseph, 'SIDM_YUKTESHWAR', 7)
SE_SIDM_J2000 = 18
SE_SIDM_J1900 = 19
SE_SIDM_B1950 = 20
SE_SIDM_TRUE_CITRA = getattr(swisseph, 'SIDM_TRUE_CITRA', 27)
SE_SIDM_TRUE_REVATI = getattr(swisseph, 'SIDM_TRUE_REVATI', 28)
SE_SIDM_KRISHNAMURTI_VP291 = getattr(swisseph, 'SIDM_KRISHNAMURTI_VP291', 45)
# 印度占星全量 ayanamsa：Swiss Ephemeris 全部 SIDM 模式(整型号 = swephexp.h 规范，2.10.03 全内建)。
SE_SIDM_DJWHAL_KHUL = getattr(swisseph, 'SIDM_DJWHAL_KHUL', 6)
SE_SIDM_JN_BHASIN = getattr(swisseph, 'SIDM_JN_BHASIN', 8)
SE_SIDM_BABYL_KUGLER1 = getattr(swisseph, 'SIDM_BABYL_KUGLER1', 9)
SE_SIDM_BABYL_KUGLER2 = getattr(swisseph, 'SIDM_BABYL_KUGLER2', 10)
SE_SIDM_BABYL_KUGLER3 = getattr(swisseph, 'SIDM_BABYL_KUGLER3', 11)
SE_SIDM_BABYL_HUBER = getattr(swisseph, 'SIDM_BABYL_HUBER', 12)
SE_SIDM_BABYL_ETPSC = getattr(swisseph, 'SIDM_BABYL_ETPSC', 13)
SE_SIDM_ALDEBARAN_15TAU = getattr(swisseph, 'SIDM_ALDEBARAN_15TAU', 14)
SE_SIDM_HIPPARCHOS = getattr(swisseph, 'SIDM_HIPPARCHOS', 15)
SE_SIDM_SASSANIAN = getattr(swisseph, 'SIDM_SASSANIAN', 16)
SE_SIDM_GALCENT_0SAG = getattr(swisseph, 'SIDM_GALCENT_0SAG', 17)
SE_SIDM_SURYASIDDHANTA = getattr(swisseph, 'SIDM_SURYASIDDHANTA', 21)
SE_SIDM_SURYASIDDHANTA_MSUN = getattr(swisseph, 'SIDM_SURYASIDDHANTA_MSUN', 22)
SE_SIDM_ARYABHATA = getattr(swisseph, 'SIDM_ARYABHATA', 23)
SE_SIDM_ARYABHATA_MSUN = getattr(swisseph, 'SIDM_ARYABHATA_MSUN', 24)
SE_SIDM_SS_REVATI = getattr(swisseph, 'SIDM_SS_REVATI', 25)
SE_SIDM_SS_CITRA = getattr(swisseph, 'SIDM_SS_CITRA', 26)
SE_SIDM_TRUE_PUSHYA = getattr(swisseph, 'SIDM_TRUE_PUSHYA', 29)
SE_SIDM_GALCENT_RGILBRAND = getattr(swisseph, 'SIDM_GALCENT_RGILBRAND', 30)
SE_SIDM_GALEQU_IAU1958 = getattr(swisseph, 'SIDM_GALEQU_IAU1958', 31)
SE_SIDM_GALEQU_TRUE = getattr(swisseph, 'SIDM_GALEQU_TRUE', 32)
SE_SIDM_GALEQU_MULA = getattr(swisseph, 'SIDM_GALEQU_MULA', 33)
SE_SIDM_GALALIGN_MARDYKS = getattr(swisseph, 'SIDM_GALALIGN_MARDYKS', 34)
SE_SIDM_TRUE_MULA = getattr(swisseph, 'SIDM_TRUE_MULA', 35)
SE_SIDM_GALCENT_MULA_WILHELM = getattr(swisseph, 'SIDM_GALCENT_MULA_WILHELM', 36)
SE_SIDM_ARYABHATA_522 = getattr(swisseph, 'SIDM_ARYABHATA_522', 37)
SE_SIDM_BABYL_BRITTON = getattr(swisseph, 'SIDM_BABYL_BRITTON', 38)
SE_SIDM_TRUE_SHEORAN = getattr(swisseph, 'SIDM_TRUE_SHEORAN', 39)
SE_SIDM_GALCENT_COCHRANE = getattr(swisseph, 'SIDM_GALCENT_COCHRANE', 40)
SE_SIDM_GALEQU_FIORENZA = getattr(swisseph, 'SIDM_GALEQU_FIORENZA', 41)
SE_SIDM_VALENS_MOON = getattr(swisseph, 'SIDM_VALENS_MOON', 42)
SE_SIDM_LAHIRI_1940 = getattr(swisseph, 'SIDM_LAHIRI_1940', 43)
SE_SIDM_LAHIRI_VP285 = getattr(swisseph, 'SIDM_LAHIRI_VP285', 44)
SE_SIDM_LAHIRI_ICRC = getattr(swisseph, 'SIDM_LAHIRI_ICRC', 46)
SEDEFAULT_SIDM__MODE = SE_SIDM_LAHIRI
SE_SIDM_USER = getattr(swisseph, 'SIDM_USER', 255)
_SIDEREAL_CONTEXT = threading.local()


def setSiderealContext(mode=None, t0=0.0, ayan_t0=0.0):
    _SIDEREAL_CONTEXT.mode = mode
    _SIDEREAL_CONTEXT.t0 = t0
    _SIDEREAL_CONTEXT.ayan_t0 = ayan_t0


def clearSiderealContext():
    _SIDEREAL_CONTEXT.mode = None
    _SIDEREAL_CONTEXT.t0 = 0.0
    _SIDEREAL_CONTEXT.ayan_t0 = 0.0


def applySiderealMode():
    ensureEphePath()
    mode = getattr(_SIDEREAL_CONTEXT, 'mode', None)
    if mode is None:
        swisseph.set_sid_mode(SEDEFAULT_SIDM__MODE)
    else:
        swisseph.set_sid_mode(mode, getattr(_SIDEREAL_CONTEXT, 't0', 0.0), getattr(_SIDEREAL_CONTEXT, 'ayan_t0', 0.0))

# Map objects
SWE_OBJECTS = {
    const.SUN: 0,
    const.MOON: 1,
    const.MERCURY: 2, 
    const.VENUS: 3,
    const.MARS: 4,
    const.JUPITER: 5, 
    const.SATURN: 6,
    const.URANUS: 7,
    const.NEPTUNE: 8, 
    const.PLUTO: 9,
    const.CHIRON: 15, 
    const.NORTH_NODE: 10,
    const.DARKMOON: 12,
    const.PHOLUS: 16,
    const.CERES: 17,
    const.PALLAS: 18,
    const.JUNO: 19,
    const.VESTA: 20,
    const.INTP_APOG: 21,
    const.INTP_PERG: 22,
    # Uranian / 汉堡学派 trans-Neptunian points (Swiss Ephemeris hypothetical bodies 40-47)
    const.CUPIDO: 40,
    const.HADES: 41,
    const.ZEUS: 42,
    const.KRONOS: 43,
    const.APOLLON: 44,
    const.ADMETOS: 45,
    const.VULCANUS: 46,
    const.POSEIDON: 47
}

# Map house systems
SWE_HOUSESYS = {
    const.HOUSES_PLACIDUS: b'P',
    const.HOUSES_KOCH: b'K', 
    const.HOUSES_PORPHYRIUS: b'O',
    const.HOUSES_REGIOMONTANUS: b'R',
    const.HOUSES_CAMPANUS: b'C',
    const.HOUSES_EQUAL: b'A',
    const.HOUSES_EQUAL_2: b'E',
    const.HOUSES_VEHLOW_EQUAL: b'V',
    const.HOUSES_WHOLE_SIGN: b'W',
    const.HOUSES_MERIDIAN: b'X', 
    const.HOUSES_AZIMUTHAL: b'H',
    const.HOUSES_POLICH_PAGE: b'T', 
    const.HOUSES_ALCABITUS: b'B',
    const.HOUSES_SRIPATI: b'S',
    const.HOUSES_MORINUS: b'M',
    const.HOUSES_EQUAL_MC: b'D',
    const.HOUSES_CARTER_POLI_EQUATORIAL: b'F',
    const.HOUSES_SUNSHINE: b'I',
    const.HOUSES_SUNSHINE_ALT: b'i',
    const.HOUSES_KRUSINSKI: b'U',
    const.HOUSES_PULLEN_SD: b'L',
    const.HOUSES_PULLEN_SR: b'Q',
    const.HOUSES_APC: b'Y',
    const.HOUSES_SAVARD_A: b'J'
}


# ==== Internal functions ==== #

def setPath(path):
    """ Sets the path for the swe files. """
    global SEDEFAULT_FLAG, SEACTIVE_PATH, SEACTIVE_MODE, SEACTIVE_JPL_FILE
    swisseph.set_ephe_path(path)
    SEACTIVE_PATH = path

    mode = os.environ.get('HOROSA_SWISSEPH_MODE', 'SWIEPH').strip().upper()
    SEACTIVE_MODE = mode if mode in _EPHE_MODE_FLAGS else 'SWIEPH'
    SEDEFAULT_FLAG = _defaultFlags()
    SEACTIVE_JPL_FILE = None

    jpl_file = os.environ.get('HOROSA_SWISSEPH_JPL_FILE', '').strip()
    if not jpl_file:
        return

    if not os.path.isabs(jpl_file):
        jpl_file = os.path.join(path, jpl_file)

    if os.path.exists(jpl_file):
        swisseph.set_jpl_file(jpl_file)
        SEACTIVE_JPL_FILE = jpl_file


def ensureEphePath():
    """Restore flatlib's Swiss Ephemeris path after shared-process callers change it.

    horosa_ephe_path_fastpath_v1(PERF-R9):路径未被任何人改动时直接短路。
    语义不变 —— 只要有外部调用者动过路径,_EPHE_PATH_ACTIVE 立刻与 SEACTIVE_PATH 失配,
    这里照旧恢复(见 _guardedSetEphePath 处的说明:它是进程内唯一入口)。
    """
    global _JPL_FILE_ACTIVE
    if SEACTIVE_PATH and (not _EPHE_FASTPATH or _EPHE_PATH_ACTIVE != SEACTIVE_PATH):
        swisseph.set_ephe_path(SEACTIVE_PATH)
    if SEACTIVE_JPL_FILE and (not _EPHE_FASTPATH or _JPL_FILE_ACTIVE != SEACTIVE_JPL_FILE):
        swisseph.set_jpl_file(SEACTIVE_JPL_FILE)
        _JPL_FILE_ACTIVE = SEACTIVE_JPL_FILE


def getRuntimeConfig():
    return {
        'path': SEACTIVE_PATH,
        'mode': SEACTIVE_MODE,
        'default_flag': SEDEFAULT_FLAG,
        'jpl_file': SEACTIVE_JPL_FILE,
    }


# === Object functions === #

def sweObject(obj, jd, flags=SEDEFAULT_FLAG):
    """ Returns an object from the Ephemeris. """
    sweObj = SWE_OBJECTS[obj]
    applySiderealMode()
    sweList = swisseph.calc_ut(jd, sweObj, flags)[0]
    newflags = flags | SEFLG_EQUATORIAL
    eqlist = swisseph.calc_ut(jd, sweObj, newflags)[0]
    ra = eqlist[0] if eqlist[0] >= 0 else (eqlist[0] + 360) % 360

    return {
        'id': obj,
        'lon': sweList[0],
        'lat': sweList[1],
        'lonspeed': sweList[3],
        'latspeed': sweList[4],
        'ra': ra,
        'decl': eqlist[1],
        'raspeed': eqlist[3],
        'declspeed': eqlist[4]
    }
    
def sweObjectLon(obj, jd, flags=SEDEFAULT_FLAG):
    """ Returns the longitude of an object. """
    sweObj = SWE_OBJECTS[obj]
    applySiderealMode()
    sweList = swisseph.calc_ut(jd, sweObj, flags)[0]
    return sweList[0]


def sweNextTransit(obj, jd, lat, lon, flag):
    """ Returns the julian date of the next transit of
    an object. The flag should be 'RISE' or 'SET'. 
    
    """
    sweObj = SWE_OBJECTS[obj]
    ensureEphePath()
    flag = swisseph.CALC_RISE if flag == 'RISE' else swisseph.CALC_SET
    # 新版 pyswisseph 签名: rise_trans(tjdut, body, rsmi, geopos_seq, atpress, attemp, flags)。
    # 旧式 (jd, obj, lon, lat, 0,0,0, flag) 会因参数过多报错并使日出/日没全失败(muhurta/行星时/特殊上升)。
    trans = swisseph.rise_trans(jd, sweObj, flag, (lon, lat, 0.0))
    return trans[1][0]



# === Houses and angles === #
        
def _sweHousesRaw(jd, lat, lon, swhsys, flag):
    if flag == 0:
        return swisseph.houses(jd, lat, lon, swhsys)
    if flag == swisseph.FLG_RADIANS:
        return swisseph.houses_ex(jd, lat, lon, swhsys, swisseph.FLG_RADIANS)
    return swisseph.houses_ex(jd, lat, lon, swhsys, swisseph.FLG_SIDEREAL)


def sweHouses(jd, lat, lon, hsys, flag=0):
    """ Returns lists of houses and angles. """
    applySiderealMode()
    hlist = None
    ascmc = None
    swhsys = SWE_HOUSESYS[hsys]
    _fallback = None
    try:
        hlist, ascmc = _sweHousesRaw(jd, lat, lon, swhsys, flag)
    except swisseph.Error:
        # 极圈内象限分宫制(Placidus/Koch 等)数学上无解,swisseph 抛错。
        # 业界标准兜底:回退 Porphyry(保留 ASC/MC 四轴象限结构),盘可出而非整请求报错。
        # 返回结构仍标注请求的 hsys(上层按所选制做语义),仅宫顶数值为回退值。
        # [0j] 回退不再静默:house dict 带 hsysFallback 标记(fromDict=__dict__.update 全保留,
        # jsonpickle 序列化直达前端;前端信息卡据 houses[0].hsysFallback 出「极区回退」徽记)。
        if swhsys == b'O':
            raise
        hlist, ascmc = _sweHousesRaw(jd, lat, lon, b'O', flag)
        _fallback = 'Porphyry'
    # Add first house to the end of 'hlist' so that we
    # can compute house sizes with an iterator
    hlist += (hlist[0],)
    houses = [
        {
            'hsys': hsys,
            'id': const.LIST_HOUSES[i],
            'lon': hlist[i],
            'size': angle.distance(hlist[i], hlist[i+1])
        } for i in range(12)
    ]
    if _fallback:
        for house in houses:
            house['hsysFallback'] = _fallback
    for house in houses:
        eqcod = swisseph.cotrans([house['lon'], 0, 1], const.ECLI2EQ_OBLIQUITY)
        house['ra'] = eqcod[0]
        house['decl'] = eqcod[1]

    descLon = angle.norm(ascmc[0] + 180)
    icLon = angle.norm(ascmc[1] + 180)

    ascEclip = swisseph.cotrans([ascmc[4], lat, 1], const.EQ2ECLI_OBLIQUITY)
    descRA= swisseph.cotrans([descLon, ascEclip[1], 1], const.ECLI2EQ_OBLIQUITY)
    mcRA = swisseph.cotrans([ascmc[1], ascEclip[1], 1], const.ECLI2EQ_OBLIQUITY)
    icRA = swisseph.cotrans([icLon, ascEclip[1], 1], const.ECLI2EQ_OBLIQUITY)

    angles = [
        {'id': const.ASC, 'lon': ascmc[0], 'lat': ascEclip[1], 'ra': ascmc[4], 'decl': lat},
        {'id': const.DESC, 'lon': descLon, 'lat': ascEclip[1], 'ra': descRA[0], 'decl': descRA[1]},
        {'id': const.MC, 'lon': ascmc[1], 'lat': ascEclip[1], 'ra': mcRA[0], 'decl': mcRA[1]},
        {'id': const.IC, 'lon': icLon, 'lat': ascEclip[1], 'ra': icRA[0], 'decl': icRA[1]}
    ]
    return (houses, angles)
    
def sweHousesLon(jd, lat, lon, hsys, flag=0):
    """ Returns lists with house and angle longitudes. """
    applySiderealMode()
    hlist = None
    ascmc = None
    hsys = SWE_HOUSESYS[hsys]
    # [0j] 补同款 Porphyry 兜底:此前本函数在极圈内象限制直接抛 swisseph.Error 炸整请求
    # (sweHouses 有兜底它没有——同层双函数单边裸奔)。
    try:
        hlist, ascmc = _sweHousesRaw(jd, lat, lon, hsys, flag)
    except swisseph.Error:
        if hsys == b'O':
            raise
        hlist, ascmc = _sweHousesRaw(jd, lat, lon, b'O', flag)

    angles = [
        ascmc[0],
        ascmc[1],
        angle.norm(ascmc[0] + 180), 
        angle.norm(ascmc[1] + 180)
    ]
    return (hlist, angles)


# === Fixed stars === #

# Beware: the swisseph.fixstar_mag function is really 
# slow because it parses the fixstars.cat file every 
# time..

# ── 恒星计算进程级 memo(性能,输出逐字节不变):
#   * 星等 mag 与时间无关(恒量),但 swisseph.fixstar_mag 每次重新解析 fixstars.cat
#     → 按星名缓存一次即可;
#   * fixstar_ut 只依赖 (star, jd, flags, 当前 sidereal 语境) —— 键含全部输入,
#     同键必同值(纯函数),/chart 内多字段(恒星/28宿/北斗/虚拟宿)与「同一时刻重排
#     (改宫制/显示项/性别)」的重复恒星调用直接命中。有界缓存防增长。
_FIXSTAR_MAG_CACHE = {}
_FIXSTAR_UT_CACHE = {}
_FIXSTAR_UT_CACHE_MAX = 8192


def _sidCtxKey():
    mode = getattr(_SIDEREAL_CONTEXT, 'mode', None)
    if mode is None:
        return None
    return (mode, getattr(_SIDEREAL_CONTEXT, 't0', 0.0), getattr(_SIDEREAL_CONTEXT, 'ayan_t0', 0.0))


def _fixstarMagCached(star):
    if star not in _FIXSTAR_MAG_CACHE:
        _FIXSTAR_MAG_CACHE[star] = swisseph.fixstar_mag(star)
    return _FIXSTAR_MAG_CACHE[star]


def _fixstarUtCached(star, jd, flags):
    key = (star, jd, flags, _sidCtxKey())
    hit = _FIXSTAR_UT_CACHE.get(key)
    if hit is None:
        # applySiderealMode 已由调用方执行;此处 set→use 相邻纪律由外层保证
        hit = swisseph.fixstar_ut(star, jd, flags)[0]
        if len(_FIXSTAR_UT_CACHE) >= _FIXSTAR_UT_CACHE_MAX:
            _FIXSTAR_UT_CACHE.clear()
        _FIXSTAR_UT_CACHE[key] = hit
    return hit


def sweFixedStar(star, jd, flags=SEDEFAULT_FLAG):
    """ Returns a fixed star from the Ephemeris. """
    applySiderealMode()
    sweList = _fixstarUtCached(star, jd, flags)
    mag = _fixstarMagCached(star)
    newflags = flags | SEFLG_EQUATORIAL
    eqlist = _fixstarUtCached(star, jd, newflags)
    ra = eqlist[0] if eqlist[0] >= 0 else (eqlist[0] + 360) % 360
    try:
        name = const.STAR_NAMES[star]
    except:
        name = star
    return {
        'id': star,
        'name': name,
        'mag': mag,
        'lon': sweList[0],
        'lat': sweList[1],
        'ra': ra,
        'decl': eqlist[1]
    }


def sweFixedStarSu28(star, jd, flags=SEDEFAULT_FLAG):
    """ Returns a fixed star from the Ephemeris. """
    applySiderealMode()
    sweList = _fixstarUtCached(star, jd, flags)
    mag = _fixstarMagCached(star)
    newflags = flags | SEFLG_EQUATORIAL
    eqlist = _fixstarUtCached(star, jd, newflags)
    ra = eqlist[0] if eqlist[0] >= 0 else (eqlist[0] + 360) % 360
    idx = const.LIST_FIXED_SU28.index(star)
    su = const.LIST_FIXED_SU28_NAME[idx]
    return {
        'id': star,
        'name': su,
        'wuxing': const.Su28WuXing[su],
        'animal': const.Su28Animal[su],
        'mag': mag,
        'lon': sweList[0],
        'lat': sweList[1],
        'ra': ra,
        'decl': eqlist[1]
    }



# === Eclipses === #

def solarEclipseGlobal(jd, backward):
    """ Returns the jd details of previous or next global solar eclipse. """

    ensureEphePath()
    sweList = swisseph.sol_eclipse_when_glob(jd, backward=backward)
    return {
        'maximum': sweList[1][0],
        'begin': sweList[1][2],
        'end': sweList[1][3],
        'totality_begin': sweList[1][4],
        'totality_end': sweList[1][5],
        'center_line_begin': sweList[1][6],
        'center_line_end': sweList[1][7],
    }

def lunarEclipseGlobal(jd, backward):
    """ Returns the jd details of previous or next global lunar eclipse. """

    ensureEphePath()
    sweList = swisseph.lun_eclipse_when(jd, backward=backward)
    return {
        'maximum': sweList[1][0],
        'partial_begin': sweList[1][2],
        'partial_end': sweList[1][3],
        'totality_begin': sweList[1][4],
        'totality_end': sweList[1][5],
        'penumbral_begin': sweList[1][6],
        'penumbral_end': sweList[1][7],
    }
