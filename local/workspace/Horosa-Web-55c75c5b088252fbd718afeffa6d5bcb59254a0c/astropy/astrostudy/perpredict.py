import copy
import math
import re

import swisseph

from flatlib.chart import Chart
from flatlib.datetime import Datetime
from flatlib import angle
from flatlib import const
from flatlib import utils
from flatlib.ephem import swe
from flatlib.predictives.primarydirections import PrimaryDirections
from flatlib.predictives.primarydirections import PDTable
from flatlib.predictives import profections
from flatlib.tools import arabicparts
from astrostudy.signasctime import SignAscTime
from astrostudy import helper
from astrostudy.civil_calendar import (
    LEAP_DAY_MAR1, astro_year, civil_jdn_display, civil_ymd_from_jdn, display_year, flatlib_civil_string,
    format_civil_date, format_display_date, parse_civil_date, reset_ad_for_date, solar_anniversary_jdn)
from astrostudy import solararc
from astrostudy import firdaria
from astrostudy import zreleasing
from astrostudy.termdirection import TermDirection

MAX_ERROR = 0.0003
# 行星对显示窗半宽:作用于「弧自身归一化前的原值」(见 _passesCoreDisplayWindow)。
CORE_PD_DISPLAY_WINDOW = 107.5
# PD 本体 → (slug, swisseph 星历 id) 映射表:ΔT 校准批量取数按此表逐星取位
# (_corePdDeltaTPointMap),主限法盘/表格共用,勿删。
CORE_PD_VIRTUAL_BODY_CORR_MODELS = {
    const.SUN: ('sun', swisseph.SUN),
    const.MOON: ('moon', swisseph.MOON),
    const.MERCURY: ('mercury', swisseph.MERCURY),
    const.VENUS: ('venus', swisseph.VENUS),
    const.MARS: ('mars', swisseph.MARS),
    const.JUPITER: ('jupiter', swisseph.JUPITER),
    const.SATURN: ('saturn', swisseph.SATURN),
    const.URANUS: ('uranus', swisseph.URANUS),
    const.NEPTUNE: ('neptune', swisseph.NEPTUNE),
    const.PLUTO: ('pluto', swisseph.PLUTO),
}
CORE_PD_PLANET_IDS = {
    const.SUN,
    const.MOON,
    const.MERCURY,
    const.VENUS,
    const.MARS,
    const.JUPITER,
    const.SATURN,
    const.URANUS,
    const.NEPTUNE,
    const.PLUTO,
}
CORE_PD_PROMISSOR_IDS = [
    const.SUN,
    const.MOON,
    const.MERCURY,
    const.VENUS,
    const.MARS,
    const.JUPITER,
    const.SATURN,
    const.URANUS,
    const.NEPTUNE,
    const.PLUTO,
    const.NORTH_NODE,
    const.PARS_FORTUNA,
]
CORE_PD_SIGNIFICATOR_IDS = [
    *CORE_PD_PROMISSOR_IDS,
]
# 宿命点(Vertex)应星:卯酉圈与黄道的西交点。表行 id 走 'N_Vertex_0' 应星编码。
CORE_PD_VERTEX_ID = 'Vertex'
# 东点(卯酉圈与黄道的东交点,宿命点的对点):In Mundo 轴应星。
CORE_PD_ANTIVERTEX_ID = 'Antivertex'



def _civil_cn_string(dt):
    """flatlib Datetime → 'YYYY-MM-DD HH:MM:SS'(民用历:1582 以前儒略历、历史纪年;年份按 civil_calendar
    补到 4 位、公元前前导负号,与前端 formatSignedDate 同形)。公元 1000 年以后与 dt.toCNString() 逐字相同。"""
    return flatlib_civil_string(dt)


def _civil_years_after(display_y, count):
    """本命年之后第 1..count 年的 (历史纪年, 天文年);跨公元元年不产生 0 年。"""
    a0 = astro_year(int(display_y))
    return [(display_year(a0 + i), a0 + i) for i in range(1, count + 1)]


def _anniversary_rows(display_y, month, day, count):
    """本命日之后第 1..count 个太阳年周年日 → [(起盘串 'Y/M/D', 显示串 'Y-M-D')],两串同一天。
    周年日取在连续太阳年轴上(civil_calendar.solar_anniversary_jdn,与主限法同一函数):按民用历月日取时,
    1582 年以前出生的行跨改历后整体晚太阳年约 10 天(小限少转 0.83°)。1582-10-15 以后出生与按民用历
    月日取逐位相同。2 月 29 日生、目标年平年取 3 月 1 日(起盘引擎实际算的那天;主限法取 2 月 28 日)。
    标签按民用历(1582 以前儒略历、历史纪年)写出。"""
    birth_jdn = civil_jdn_display(int(display_y), int(month), int(day))
    rows = []
    for k in range(1, int(count) + 1):
        y, m, d = civil_ymd_from_jdn(solar_anniversary_jdn(birth_jdn, k, LEAP_DAY_MAR1))
        rows.append((format_display_date(y, m, d, '/'), format_display_date(y, m, d)))
    return rows


def _fill_user_ayan(perchart, target):
    """[SURF-R2u] 内层构参只回填 siderealAyanamsa 键名,user 档的 t0/ayan_t0 三参丢失 →
    推运盘(返照/推运内圈等)在自定义恒星黄道下静默回落默认岁差。user 档时补两附参。"""
    try:
        if getattr(perchart, 'siderealAyanamsa', '') == 'user':
            sm = getattr(perchart, 'siderealMode', None) or {}
            if sm.get('t0') is not None and sm.get('ayan_t0') is not None:
                target['userAyanT0'] = sm.get('t0')
                target['userAyanDeg'] = sm.get('ayan_t0')
    except Exception:
        pass


def _polarSafeHousesEx(jd, lat, lon, swhsys=b'P'):
    """swisseph.houses_ex 的极地安全包装:象限分宫制(P/K 等)在极圈内无解抛 swisseph.Error。
    仅取 ascmc(RAMC/ASC/Vertex)的调用点经此包装——ascmc 与分宫制无关(W/B/O 实测逐位一致),
    失败时回退 b'W' 重取;常规纬度走原参数,字节级零扰动(except-only 路径)。"""
    try:
        return swisseph.houses_ex(jd, lat, lon, swhsys)
    except swisseph.Error:
        return swisseph.houses_ex(jd, lat, lon, b'W')
# 自研主限法方位法 strategy 注册表 — 值是 PerPredict 的实例方法名(string-based 延迟绑定，
# 避免依赖 module 顺序)。getPrimaryDirectionByZ 用此表分发。
# 任何未在表中的 pdMethod 一律 fallback 到 core_alchabitius (Alcabitius)，护住
# 默认 Alcabitius+Ptolemy 路径字节级一致 (高优铁律)。
# 扩展约定：增加新方位法时，在此表加 (key=pdMethod 字符串, value=getPrimaryDirectionByZ<X> 方法名)。
_PD_METHOD_REGISTRY = {
    'core_alchabitius': 'getPrimaryDirectionByZCoreKernel',
    'horosa_legacy': 'getPrimaryDirectionByZLegacy',
    'placidus': 'getPrimaryDirectionByZPlacidus',
    'regiomontanus': 'getPrimaryDirectionByZRegiomontanus',
    'campanus': 'getPrimaryDirectionByZCampanus',
    'topocentric': 'getPrimaryDirectionByZTopocentric',
    # In-Zodiaco 下与 core_alchabitius 弧几何逐位等同(已实测 mean|Δ|=0)：
    'meridian': 'getPrimaryDirectionByZCoreKernel',
    'porphyry': 'getPrimaryDirectionByZCoreKernel',
    'equal_ecliptic': 'getPrimaryDirectionByZCoreKernel',
    'equal_hour_circle': 'getPrimaryDirectionByZCoreKernel',
    # 黄极圈位置圈(过黄极与迫星相位点的大圆):
    'morinus': 'getPrimaryDirectionByZMorinus',
    # 独立闭式(已实测)：黄经差 / |RA差|
    'in_zodiaco_lon': 'getPrimaryDirectionByZAlongEcliptic',
    'in_zodiaco_abs': 'getPrimaryDirectionByZEdmundJones',
}


# 主限法盘(dial)宫制映射：方位法本质即「定盘宫制」，故主限法盘的宫始点(house cusps)
# 应随所选方位法变化。下列 8 个有把握的方位法直接映射到对应 swisseph 宫位系统；
# morinus 亦有原生 swisseph 宫制('M')一并映上。equal_hour_circle / in_zodiaco_lon /
# in_zodiaco_abs / 任何未列出的方法一律 fallback 到本命盘宫制(self.perchart.house)——
# 诚实不臆造(equal_hour_circle 旧法层曾沿用本命宫制;frame 层已映 Meridian,见 _PD_FRAME_HSYS)。
# 注：此映射只改盘的「宫位/四角分宫」，不改被推进的星体经度(刚体 RA+arc，与方位法无关)，
# 故不影响表格(getPrimaryDirection)字节级一致——盘表分属两条独立渲染路径。
_PD_CHART_METHOD_HSYS = {
    'core_alchabitius': const.HOUSES_ALCABITUS,
    'placidus': const.HOUSES_PLACIDUS,
    'regiomontanus': const.HOUSES_REGIOMONTANUS,
    'campanus': const.HOUSES_CAMPANUS,
    'topocentric': const.HOUSES_POLICH_PAGE,
    'meridian': const.HOUSES_MERIDIAN,
    'porphyry': const.HOUSES_PORPHYRIUS,
    'equal_ecliptic': const.HOUSES_EQUAL,
    'morinus': const.HOUSES_MORINUS,
}


# ── 投影 × 定局 解耦(正交两维;pdMethod 保留为只读兼容层) ──────────────────
# pdProjection 决定「弧」(读 φ/RAMC/ε 与投影公式,不读盘面宫制);
# pdFrame 决定「盘面宫始点」(以及后续「宫始点作 S/P」的取点)。
# 旧 pdMethod → (projection, frame) 兼容映射;全缺省 = ('ptolemy','alcabitius') = 现状默认。
_PD_METHOD_TO_PAIR = {
    'core_alchabitius': ('ptolemy', 'alcabitius'),
    'placidus': ('placidus', 'placidus'),
    'regiomontanus': ('regiomontanus', 'regiomontanus'),
    'campanus': ('campanus', 'campanus'),
    'topocentric': ('topocentric', 'topocentric'),
    'meridian': ('ptolemy', 'meridian'),
    'porphyry': ('ptolemy', 'porphyry'),
    'equal_ecliptic': ('ptolemy', 'equal'),
    'equal_hour_circle': ('ptolemy', 'equal_hour_circle'),
    'morinus': ('morinus', 'morinus'),
    'in_zodiaco_lon': ('in_zodiaco_lon', None),
    'in_zodiaco_abs': ('in_zodiaco_abs', None),
    'horosa_legacy': ('horosa_legacy', None),
}

# 投影 registry:决定弧的算法分支。ptolemy 必 dispatch 到 getPrimaryDirectionByZCoreKernel
# 同一函数同一分支(Alcabitius+Ptolemy 默认路径字节锁死,铁律)。
_PD_PROJECTION_REGISTRY = {
    'ptolemy': 'getPrimaryDirectionByZCoreKernel',
    'placidus': 'getPrimaryDirectionByZPlacidus',
    'regiomontanus': 'getPrimaryDirectionByZRegiomontanus',
    'campanus': 'getPrimaryDirectionByZCampanus',
    'topocentric': 'getPrimaryDirectionByZTopocentric',
    'morinus': 'getPrimaryDirectionByZMorinus',
    'zodiacal': 'getPrimaryDirectionByZZodiacalOA',
    'placidus_under_pole': 'getPrimaryDirectionByZPlacidusUnderPole',
    'ra_direct': 'getPrimaryDirectionByZRaDirect',
    'in_zodiaco_lon': 'getPrimaryDirectionByZAlongEcliptic',
    'in_zodiaco_abs': 'getPrimaryDirectionByZEdmundJones',
    'horosa_legacy': 'getPrimaryDirectionByZLegacy',
    # 地平经圈(过天顶)/ 出生地斜升圈(Koch)位置圈,与极下族同一内核
    'horizontal': 'getPrimaryDirectionByZHorizontal',
    'koch': 'getPrimaryDirectionByZKoch',
}

# 定局 frame → 盘面宫制。
# equal_hour_circle(Equal·时圈=赤道等分、宫首取时圈)此前「无干净 swisseph 等价 → 回落本命盘宫制」,
# 而 3D 主限天球前端 pdHouseCusps 该档按赤经等分(第 10 宫 RA=RAMC 逐宫 +30°)闭式画宫首 → 同档两处宫首分叉。
# 赤道自 RAMC 等分 30° 再沿时圈投到黄道 = swisseph Meridian(轴旋)制之定义,故映为 Meridian,与天球同口径;
# 缺省 alcabitius 及其余档字节不变。
_PD_FRAME_HSYS = {
    'alcabitius': const.HOUSES_ALCABITUS,
    'placidus': const.HOUSES_PLACIDUS,
    'regiomontanus': const.HOUSES_REGIOMONTANUS,
    'campanus': const.HOUSES_CAMPANUS,
    'topocentric': const.HOUSES_POLICH_PAGE,
    'meridian': const.HOUSES_MERIDIAN,
    'porphyry': const.HOUSES_PORPHYRIUS,
    'equal': const.HOUSES_EQUAL,
    'wholesign': const.HOUSES_WHOLE_SIGN,
    'morinus': const.HOUSES_MORINUS,
    'koch': const.HOUSES_KOCH,
    'equal_hour_circle': const.HOUSES_MERIDIAN,
}

# In-Mundo 下仍走 flatlib legacy 'M' 的旧方法集(仅当用户未显式指定 pdProjection 时生效,
# 精确保持既有组合的输出;显式新参调用统一走世俗核)。
_PD_MUNDO_LEGACY_METHODS = ('morinus', 'in_zodiaco_lon', 'in_zodiaco_abs', 'horosa_legacy')


# 自研主限法时间换算 (time key) 常量表。值 = 「从原始弧到缩放后弧」的倍数。
# Ptolemy 必须严格 == 1.0 (整型字面量,非浮点近似),用来护住默认路径字节级一致。
# Naibod = 太阳平均周日运动度数 0.9856473354°，已上线 v2.5.2。
# 其它 static time key (Cardano / Plantiko / Wöllner) 通过 scripts/fit_pd_constants.py
# 基于内部校准语料拟合后填入此表，本批 (P0 v2.5.4) 起逐步落地。
# Symbolic Degree = 1°/年，与 Ptolemy 等价。
# 主限法时间换算 (time key) — 每个 key 的缩放系数都是「有明确天文/几何定义的公式常量」，
# 不是对数据拟合出来的经验值(方法论铁律：先有公式定义，数据只用于验证)。
# 值 = 「原始弧(1°/年符号年)→该 key 缩放弧」的倍数。
#   Ptolemy : 1° 赤经(RA) = 1 年(古典定义)。锁 1.0，守默认路径字节级一致。
#   Naibod  : 太阳平均周日运动 0°59'08"(=0.9856473°)RA = 1 年(Naibod 1560s 提出)。
# 动态/其它 key(Brahe=出生日太阳真实日运动、Placidus=逐日太阳运动、Ptolemy-Naibod
# 中点=0°59'34" 等)均有公式定义，但需逐盘计算或更多接线，留后续批次按公式实现，
# 不在此处放任何拟合值。未识别 key 一律 fallback Ptolemy=1.0。
STATIC_TIME_KEY_SCALES = {
    # 每个 key 的「年度赤经度量」(1 年对应多少度弧);arc→年 = arc / scale。值一律取其定义的精确式。
    'Ptolemy': 1.0,                     # 1° = 1 年(古典定义;铁律字面量,护住默认路径字节级一致)
    'Naibod': 0.9856473354,             # 太阳平均日行 0°59'08"
    'NaibodRA': 0.9856473354,           # Naibod-in-RA:同值,严格沿赤经度量(命名对齐)
    'Cardano': 74.0 / 75.0,             # 0°59'12"
    'Umar': 72.0 / 73.0,                # Umar al-Tabari:73 年走 72°
    'Wollner': 0.98604,                 # Wöllner
    'Plantiko': 60.0 / 59.3,            # 1 年 ≈ 1.01180°(1° = 59.3/60 年)
    'SynodicYear': 12.0 * 29.530588853 / 360.0,   # 太阴年(12 朔望月)÷ 360
    'SymbolicDegree': 1.0,              # 1°/年(=Ptolemy)
    'Kundig': 1.0,                      # Kündig:1°/年(与 SymbolicDegree 同值)
    'SymbolicYear': 360.0 / 365.25,     # 360° 摊到一儒略年
    'SymbolicMoon': 13.0 + 10.0 / 60.0 + 35.0 / 3600.0,   # 月亮平均日行 13°10'35"
    'SymbolicMonth': 4.0,
    'Quarterly': 0.25,
    'SelfMeasure': 13.0 / 7.0,
    # 符号量度「每座 N 年」族:每年 30°/N
    'Quinary': 30.0 / 5.0,
    'Septenary': 30.0 / 7.0,
    'Novenary': 30.0 / 9.0,
    'Duodenary': 30.0 / 12.0,
    'SubDuodenary': 30.0 / 144.0,       # 12'30"/年
    'SymbolicWeek': 1.0 / 7.0,          # 1° = 7 年
    # 「经典」档:传统程序常用的截断常数(只取到角分等),与上面的精确式并列可选
    'WollnerClassic': 0.9860361213,     # = 1° − 50.27″(1° 减一年岁差)
    'SynodicYearClassic': 0.98435,      # 太阴年常数只取 5 位
    'NovenaryClassic': 3.3333,          # 30°/9 截到 4 位
    'SymbolicMoonClassic': 13.167,      # 月亮平均日行只取到 13°10′
}

# 每盘常数型钥匙:一年 = 本命某一日的太阳行度(同一盘内恒定、不同盘略异)。
#   Simmonite      = 出生当天世界时 0 时 → 次日 0 时太阳赤经行度
#   BirthdaySunLon = 同一天的太阳黄经行度(生日黄经日行)
#   Kepler / Brahe = 出生前一个真午夜 → 出生后一个真午夜(出生地太阳下中天)太阳赤经行度;两名同指一法
#   KeplerClassic / BraheClassic = 「经典」写法:出生后第一个真午夜 → 再下一个真午夜(出生之后那一整个真太阳日)
# chart 不可用时回退下列近似常数(防御性,正常路径恒有 chart)。
PER_CHART_TIME_KEY_FALLBACK = {
    'simmonite': 0.9856473354,
    'birthdaysunlon': 0.9856473354,
    'kepler': 0.9856473354,
    'brahe': 0.9856473354,
    'keplerclassic': 0.9856473354,
    'braheclassic': 0.9856473354,
}

# 动态钥匙(逐弧求根,非比例换算)
_PD_DYNAMIC_SOLAR_RA_KEYS = ('truesolararc', 'placidus_key', 'vandam', 'truesolararcmean')   # 真太阳弧(赤经)
_PD_MEAN_OBLIQUITY_SOLAR_KEYS = ('truesolararcmean',)                     # 「经典」:太阳赤经按平黄赤交角换算
_PD_DYNAMIC_SOLAR_LON_KEYS = ('symbolicsolararc',)                       # 太阳弧(黄经)
_PD_ANGLE_ARC_KEYS = {'ascendantarc': 'asc', 'verticalarc': 'vertex'}    # 上升弧 / 垂直弧计时


def _pdTimeKeyScale(time_key, chart=None, age=None, custom=None, geolon=None):
    """
    返回从「原始 PD 弧 (1°/年 符号年)」到「指定 time key 下的缩放弧」的倍数。
    static 键查 STATIC_TIME_KEY_SCALES;Simmonite / 生日黄经日行 / Kepler / Brahe 为「每盘常数」型,
    按本命太阳日行逐盘取值(Kepler / Brahe 要出生地经度 geolon 定真午夜);未识别 key 一律 fallback 到 Ptolemy = 1.0，
    护住默认路径字节级一致 (高优铁律)。
    """
    if not time_key:
        return 1.0
    key = '{0}'.format(time_key).strip()
    kl = key.lower()
    if kl == 'user':
        # User 钥匙:自定义每年度数;未给值回退 Ptolemy=1.0
        try:
            v = float(custom)
            if 0.001 <= v <= 30.0:
                return v
        except (TypeError, ValueError):
            pass
        return 1.0
    if kl in PER_CHART_TIME_KEY_FALLBACK:
        if chart is not None:
            try:
                from astrostudy import pd_engine
                jd = float(chart.date.jd)
                if kl == 'simmonite':
                    return pd_engine.birthday_sun_motion(jd, equatorial=True)
                if kl == 'birthdaysunlon':
                    return pd_engine.birthday_sun_motion(jd, equatorial=False)
                if kl in ('keplerclassic', 'braheclassic'):
                    return pd_engine.true_midnight_sun_ra_motion_next_day(jd, float(geolon or 0.0))
                return pd_engine.true_midnight_sun_ra_motion(jd, float(geolon or 0.0))
            except Exception:
                pass
        return PER_CHART_TIME_KEY_FALLBACK[kl]
    # 大小写归一：表里同时收录原拼写与 lower 简写
    if key in STATIC_TIME_KEY_SCALES:
        scale = STATIC_TIME_KEY_SCALES[key]
    else:
        scale = None
        for k, v in STATIC_TIME_KEY_SCALES.items():
            if k.lower() == kl:
                scale = v
                break
        if scale is None:
            return 1.0
    try:
        return float(scale)
    except (TypeError, ValueError):
        return 1.0

def takeLon(obj):
    return obj.lon

def getChartObjects(chart):
    objs = []
    for key in chart.objects.content.keys():
        objs.append(chart.objects.content[key])
    for key in chart.angles.content.keys():
        objs.append(chart.angles.content[key])
    objs.sort(key=takeLon)
    return objs


def dateSolarReturn(datetime, lon, zodiacal=const.TROPICAL):
    flags = swe.SEDEFAULT_FLAG
    if zodiacal == const.SIDEREAL:
        flags = swe.SEDEFAULT_FLAG | swisseph.FLG_SIDEREAL

    jd = datetime.jd
    sun = swe.sweObjectLon(const.SUN, jd, flags)
    # 种子步用顺行弧(与 dateLunarReturn 同构):保证收敛到种子之后的下一次返照。
    # 原先直接用有符号最短弧,5~12 月生人按年初种子会倒走收敛到上一年返照(返照列表年份错位)。
    delta = -helper.absDistance(sun, lon)
    while abs(delta) > MAX_ERROR:
        jd = jd - delta / 0.9833  # Sun mean motion
        sun = swe.sweObjectLon(const.SUN, jd, flags)
        delta = helper.distance(sun, lon)
    return Datetime.fromJD(jd, datetime.utcoffset)


def dateLunarReturn(datetime, lon, zodiacal=const.TROPICAL):
    flags = swe.SEDEFAULT_FLAG
    if zodiacal == const.SIDEREAL:
        flags = swe.SEDEFAULT_FLAG | swisseph.FLG_SIDEREAL

    jd = datetime.jd
    moon = swe.sweObjectLon(const.MOON, jd, flags)
    delta = -helper.absDistance(moon, lon)
    while abs(delta) > MAX_ERROR:
        jd = jd - delta / 13.17638889  # Moon mean motion
        moon = swe.sweObjectLon(const.MOON, jd, flags)
        delta = helper.distance(moon, lon)
    return Datetime.fromJD(jd, datetime.utcoffset)



class PerPredict:

    def __init__(self, perchart):
        self.perchart = perchart

    def getAspects(self, pChart, asporb=-1):
        natalObjs = [obj for obj in self.perchart.chart.objects]
        natalObjs.extend([obj for obj in self.perchart.chart.angles])

        objs = [obj for obj in pChart.objects]
        objs.extend([obj for obj in pChart.angles])

        res = []
        for obj in objs:
            asp = {
                'directId': obj.id,
                'objects': []
            }
            for natobj in natalObjs:
                orb = asporb if asporb > 0 else (natobj.orb() + obj.orb()) / 2
                natasp = {
                    'natalId': natobj.id,
                    'aspect': -1
                }
                # 先归一化到 [0,180] 最短分离角:原实现用 0~360 绝对差,
                # ①跨 0° 合相(如 359.5 vs 0.5,差 359)漏报;②`tmpdelta > 1` 写死阈值
                # 在 orb > 1 时把 62° 的六合 delta 误算成 |62-300|=238。
                delta = abs(obj.lon - natobj.lon)
                if delta > 180:
                    delta = 360 - delta
                if delta < orb:
                    natasp['aspect'] = 0
                    natasp['delta'] = delta
                elif abs(delta - 60) < orb:
                    natasp['aspect'] = 60
                    natasp['delta'] = abs(delta - 60)
                elif abs(delta - 90) < orb:
                    natasp['aspect'] = 90
                    natasp['delta'] = abs(delta - 90)
                elif abs(delta - 120) < orb:
                    natasp['aspect'] = 120
                    natasp['delta'] = abs(delta - 120)
                elif abs(delta - 180) < orb:
                    natasp['aspect'] = 180
                    natasp['delta'] = abs(delta - 180)
                if natasp['aspect'] >= 0:
                    asp['objects'].append(natasp)
            res.append(asp)
        return res

    def getTermDirection(self, clockwise):
        chart = self.perchart.getChart()
        td = TermDirection(chart, clockwise, terms_variant=getattr(self.perchart, 'termsVariant', 0))
        tdlist = td.getList(self.perchart.pdaspects)
        self.appendDateStr(tdlist, False)
        return tdlist

    def getDistributions(self):
        """ 界推运(Distributions):发放点随周日运动依次经过其后(黄经递增)的各界,见 astrostudy.distributions。
        设置(请求键,缺省 = 上升 / 上升时间 / 回归年 / 100 年):distReleaser / distMethod / distYear / distYears;
        界系随全局设置。返回分配星期(兼容旧字段 distributor / sign / startDate / endDate / participants)
        与伙伴星期 partners。"""
        from astrostudy import distributions as _dist
        from astrostudy.astroextra_parts.common import date_time_from_jd
        data = self.perchart.data if isinstance(getattr(self.perchart, 'data', None), dict) else {}
        st = _dist.normalize(data)
        chart = self.perchart.getChart()
        start_lon = self._distReleaserLon(chart, st['distReleaser'])
        partners = []
        for pid in _dist.PARTNER_PLANETS:   # 七颗古典行星恒在盘上(不随显示设置裁剪)
            if pid == st['distReleaser']:
                continue
            partners.append((pid, float(chart.get(pid).lon)))
        phi = self._coreParseCoord(getattr(self.perchart, 'lat', 0.0))
        eps = float(swisseph.calc_ut(chart.date.jd, swisseph.ECL_NUT)[0][1])   # 当日平黄赤交角
        dists, periods = _dist.compute(start_lon, partners, st, phi, eps, getattr(self.perchart, 'termsVariant', 0))
        jd0 = float(chart.date.jd)
        zone = getattr(self.perchart, 'zone', '+00:00')
        year_days = _dist.YEAR_DAYS[st['distYear']]

        def stamp(years):
            dt = date_time_from_jd(jd0 + years * year_days, zone)
            return '%s %s' % (dt['date'], dt['time'])

        partner_rows = []
        for p in periods:
            partner_rows.append({
                'planet': p['planet'], 'aspect': p['aspect'], 'side': p['side'], 'lon': round(p['lon'], 4),
                'startYears': round(p['y0'], 4), 'years': round(p['y1'] - p['y0'], 4),
                'startDate': stamp(p['y0']), 'endDate': stamp(p['y1']),
            })
        res = []
        for d in dists:
            inside = [p for p in partner_rows if d['y0'] <= p['startYears'] < d['y1']]
            res.append({
                'startArc': round(d['y0'], 2), 'endArc': round(d['y1'], 2),
                'startYears': round(d['y0'], 4), 'years': round(d['y1'] - d['y0'], 4),
                'distributor': d['ruler'], 'sign': const.LIST_SIGNS[d['signIdx']],
                'startDate': stamp(d['y0']), 'endDate': stamp(d['y1']),
                'participants': [p['planet'] for p in inside],
                'partnerDetail': [{'planet': p['planet'], 'aspect': p['aspect'], 'side': p['side']} for p in inside],
            })
        self._distSettings = dict(st, releaserLon=round(start_lon, 4))
        self._distPartners = partner_rows
        return res

    def getDistributionsMeta(self):
        """getDistributions 之后取:设置回显 + 伙伴星期全表。"""
        return getattr(self, '_distSettings', None), getattr(self, '_distPartners', [])

    def _distReleaserLon(self, chart, releaser):
        """发放点黄经:四轴 / 行星 / 北交(随盘真平) / 宿命点 / 福点 / 精神点 / 产前朔望。"""
        if releaser in (const.ASC, const.MC, const.DESC, const.IC):
            return float(chart.get(releaser).lon)
        if releaser == 'Vertex':
            geo_lat = self._coreParseCoord(getattr(self.perchart, 'lat', 0.0))
            geo_lon = self._coreParseCoord(getattr(self.perchart, 'lon', 0.0))
            return float(_polarSafeHousesEx(chart.date.jd, geo_lat, geo_lon, b'P')[1][3]) % 360.0
        if releaser == 'Spirit':
            asc, sun, moon = (float(chart.get(x).lon) for x in (const.ASC, const.SUN, const.MOON))
            return angle.norm(asc + sun - moon if chart.isDiurnal() else asc + moon - sun)
        if releaser == 'Syzygy':
            from astrostudy.astroextra import compute_prenatal_syzygy
            syz = compute_prenatal_syzygy({
                'date': getattr(self.perchart, 'date', None), 'time': getattr(self.perchart, 'time', '12:00:00'),
                'zone': getattr(self.perchart, 'zone', '+00:00'),
                'lat': self._coreParseCoord(getattr(self.perchart, 'lat', 0.0)),
                'lon': self._coreParseCoord(getattr(self.perchart, 'lon', 0.0))})
            return angle.norm(float(syz['hylegDegree']))
        return float(chart.get(releaser).lon)

    def getAgePoint(self):
        """年龄推进点;推进方式 / 事件 / 年长 / 年限取请求键 apMethod / apEvents / apYear / apMaxAge(见 astrostudy.agepoint)。"""
        from astrostudy import agepoint
        return agepoint.compute(self.perchart)

    def getPrimaryDirection(self):
        # 框架维:aspect=相位主限(默认,零回归)/bounds=界行(ASC×界分界线)/
        # release=释放(S=hyleg 自动定,P=anareta;强制免责,不出寿命年数)。
        framework = getattr(self.perchart, 'pdFramework', 'aspect') or 'aspect'
        if framework == 'release':
            return self.getPrimaryDirectionRelease()
        if framework == 'bounds':
            return self.getPrimaryDirectionBounds()
        pdtype = self.perchart.pdtype
        if pdtype in (0, 1, 4):
            return self._pdAspectRows(pdtype)
        elif pdtype == 2:
            return self.getTermDirection(True)
        elif pdtype == 3:
            return self.getTermDirection(False)

        chart = self.perchart.getChart()
        pd = PrimaryDirections(chart)
        pdlist = pd.getList(self.perchart.pdaspects)
        self.appendDateStr(pdlist)
        return pdlist

    def _pdExtraSignificatorPoints(self, chart):
        """S 清单扩展点集(pdSignificators 显式含键才追加,默认 None=零追加)。
        Desc/IC 轴、产前朔望、精神点(昼 ASC+☉−☽/夜 ASC+☽−☉)、中间宫始点(按定局 frame 宫制
        ——Campanus 与 Regiomontanus 唯一分差场景)。"""
        keys = getattr(self.perchart, 'pdSignificators', None) or []
        if not keys:
            return []
        out = []
        geo_lat = self._coreParseCoord(getattr(self.perchart, 'lat', 0.0))
        geo_lon = self._coreParseCoord(getattr(self.perchart, 'lon', 0.0))
        if 'Desc' in keys:
            try:
                out.append({'id': 'N_%s_0' % const.DESC, 'lon': float(chart.get(const.DESC).lon), 'lat': 0.0})
            except Exception:
                pass
        if 'IC' in keys:
            try:
                out.append({'id': 'N_%s_0' % const.IC, 'lon': float(chart.get(const.IC).lon), 'lat': 0.0})
            except Exception:
                pass
        if 'Syzygy' in keys:
            try:
                from astrostudy.astroextra import compute_prenatal_syzygy
                syz = compute_prenatal_syzygy({
                    'date': getattr(self.perchart, 'date', None),
                    'time': getattr(self.perchart, 'time', '12:00:00'),
                    'zone': getattr(self.perchart, 'zone', '+00:00'),
                    'lat': geo_lat, 'lon': geo_lon})
                if syz and syz.get('hylegDegree') is not None:
                    out.append({'id': 'N_Syzygy_0', 'lon': angle.norm(float(syz['hylegDegree'])), 'lat': 0.0})
            except Exception:
                pass
        if 'Spirit' in keys:
            try:
                asc = float(chart.get(const.ASC).lon)
                sun = float(chart.get(const.SUN).lon)
                moon = float(chart.get(const.MOON).lon)
                lon = asc + sun - moon if chart.isDiurnal() else asc + moon - sun
                out.append({'id': 'N_Spirit_0', 'lon': angle.norm(lon), 'lat': 0.0})
            except Exception:
                pass
        if 'Cusps' in keys:
            out.extend(self._pdIntermediateCuspPoints(chart, 'N'))
        if 'Stars' in keys:
            out.extend(self._pdFixedStarPoints('N'))
        if 'Lots' in keys:
            out.extend(self._pdLotPoints(chart, 'N'))
        return out

    # 恒星名录:四王星 + 比尼 15 星(仓内既有分类单一来源);坐标取 67 星缓存的
    # 当日视位置(swisseph fixstar 已含岁差到历元),恒星大纬度 → 恒携真β(建议含纬度)。
    _PD_STAR_ROSTER = ('Aldebaran', 'Regulus', 'Antares', 'Fomalhaut',
                       'Algol', 'Alcyone', 'Capella', 'Sirius', 'Procyon',
                       'Algorab', 'Spica', 'Arcturus', 'Alphecca', 'Vega',
                       'Deneb Algedi')

    def _pdFixedStarPoints(self, prefix):
        try:
            stars = list(self.perchart._getFixedStars67Cached())
        except Exception:
            return []
        out = []
        for st in stars:
            if st.id not in self._PD_STAR_ROSTER:
                continue
            try:
                out.append({'id': '%s_%s_0' % (prefix, st.id),
                            'lon': angle.norm(float(st.lon)), 'lat': float(getattr(st, 'lat', 0.0) or 0.0)})
            except Exception:
                continue
        return out

    def _pdLotPoints(self, chart, prefix):
        """阿拉伯点全目录(perchart.getPars 单一来源);排 Pars Fortuna(主集已有)。"""
        out = []
        try:
            pars = list(self.perchart.getPars(chart))
        except Exception:
            return []
        for lot in pars:
            try:
                if lot.id == 'Pars Fortuna':
                    continue
                out.append({'id': '%s_%s_0' % (prefix, lot.id),
                            'lon': angle.norm(float(lot.lon)), 'lat': 0.0})
            except Exception:
                continue
        return out

    def _pdIntermediateCuspPoints(self, chart, prefix):
        """中间宫始点(2/3/5/6/8/9/11/12;四轴另有)。点位按定局 frame 宫制。"""
        geo_lat = self._coreParseCoord(getattr(self.perchart, 'lat', 0.0))
        geo_lon = self._coreParseCoord(getattr(self.perchart, 'lon', 0.0))
        hsys = self._pdChartHouseSystem(None)
        try:
            cusps = _polarSafeHousesEx(chart.date.jd, geo_lat, geo_lon, swe.SWE_HOUSESYS[hsys])[0]
        except Exception:
            return []
        out = []
        for n in (2, 3, 5, 6, 8, 9, 11, 12):
            try:
                out.append({'id': '%s_Cusp%d_0' % (prefix, n),
                            'lon': angle.norm(float(cusps[n - 1])), 'lat': 0.0})
            except Exception:
                continue
        return out

    # 恒星迫星的行编号:内核里与行星同用 N_/D_/S_(相位、顺逆、相位侧、新式逆向的逻辑全部照用),
    # 出表时改成 FS_(合 / 冲)/ FSD_(右相位)/ FSS_(左相位),下游据前缀认出恒星。
    _PD_STAR_PROM_PREFIX = {'N': 'FS', 'D': 'FSD', 'S': 'FSS'}

    def _pdStarPromissorPoints(self, aspects, public=False):
        """恒星作迫星:与行星同一套相位点(合 λ、冲 λ+180、右 λ−θ、左 λ+θ),黄纬取恒星本身黄纬。"""
        base = self._pdFixedStarPoints('N')
        asps = [0.0] if not aspects else [abs(float(a)) for a in aspects]
        out = []
        for pt in base:
            name = self._baseDirectionObjectId(pt['id'])
            lon, lat = float(pt['lon']), float(pt.get('lat', 0.0) or 0.0)
            for a in asps:
                tok = int(a) if float(a).is_integer() else a
                if a < 1e-9 or abs(a - 180.0) < 1e-9:
                    out.append({'id': 'N_%s_%s' % (name, tok), 'lon': angle.norm(lon + a), 'lat': lat})
                else:
                    out.append({'id': 'D_%s_%s' % (name, tok), 'lon': angle.norm(lon - a), 'lat': lat})
                    out.append({'id': 'S_%s_%s' % (name, tok), 'lon': angle.norm(lon + a), 'lat': lat})
        if public:
            out = [dict(o, id=self._pdPublicStarId(o['id'])) for o in out]
        return out

    def _pdPublicStarId(self, pid):
        parts = '{0}'.format(pid if pid is not None else '').split('_')
        if len(parts) >= 3 and parts[0] in self._PD_STAR_PROM_PREFIX \
                and self._baseDirectionObjectId(pid) in self._PD_STAR_ROSTER:
            return '_'.join([self._PD_STAR_PROM_PREFIX[parts[0]]] + parts[1:])
        return pid

    def _pdPublicStarRows(self, rows):
        out = []
        for it in rows:
            pid = self._pdPublicStarId(it[1])
            if pid != it[1]:
                it = list(it)
                it[1] = pid
            out.append(it)
        return out

    def _pdExtraCuspPromissorPoints(self, chart, aspects=None, public=False):
        """P 清单扩展(pdPromissorTypes):cusps=中间宫始点(HC_)/stars=恒星/lots=阿拉伯点(LT_)。
        恒星按 aspects 出整套相位点(None = 只出合相点,供自己生成相位的核用);public 时直接用出表编号。"""
        types = getattr(self.perchart, 'pdPromissorTypes', None) or []
        out = []
        if 'cusps' in types:
            out.extend(self._pdIntermediateCuspPoints(chart, 'HC'))
        if 'stars' in types:
            out.extend(self._pdStarPromissorPoints(aspects, public=public))
        if 'lots' in types:
            out.extend(self._pdLotPoints(chart, 'LT'))
        return out

    def _pdReleaseContext(self):
        """释放框架上下文:hyleg 选定 + anareta 集。宫位按定局 frame 宫制。"""
        from astrostudy import pd_release
        from astrostudy.astroextra import compute_prenatal_syzygy
        chart = self.perchart.getChart()
        geo_lat = self._coreParseCoord(getattr(self.perchart, 'lat', 0.0))
        geo_lon = self._coreParseCoord(getattr(self.perchart, 'lon', 0.0))
        hsys = self._pdChartHouseSystem(None)
        cusps = _polarSafeHousesEx(chart.date.jd, geo_lat, geo_lon, swe.SWE_HOUSESYS[hsys])[0]
        cand = {}
        for name in (const.SUN, const.MOON, const.PARS_FORTUNA):
            try:
                cand[name] = float(chart.get(name).lon)
            except Exception:
                continue
        try:
            cand['Asc'] = float(chart.get(const.ASC).lon)
        except Exception:
            pass
        try:
            syz = compute_prenatal_syzygy({
                'date': getattr(self.perchart, 'date', None),
                'time': getattr(self.perchart, 'time', '12:00:00'),
                'zone': getattr(self.perchart, 'zone', '+00:00'),
                'lat': geo_lat, 'lon': geo_lon})
            if syz and syz.get('hylegDegree') is not None:
                cand['Syzygy'] = float(syz['hylegDegree'])
        except Exception:
            pass
        sel = pd_release.select_hyleg(cand, cusps, bool(chart.isDiurnal()))
        planet_pts = {}
        for name in (const.SUN, const.MOON, const.MERCURY, const.VENUS,
                     const.MARS, const.JUPITER, const.SATURN):
            try:
                o = chart.get(name)
                planet_pts[name] = {'lon': float(o.lon), 'lat': float(o.lat)}
            except Exception:
                continue
        proms = pd_release.anareta_promissors(planet_pts, aspects=tuple(self.perchart.pdaspects or (0, 60, 90, 120, 180)))
        return sel, proms, chart

    def getPdPoles(self):
        """Pole 高级输出:当前 S 集逐应星极点(随 resolved projection)。
        行 shape 5 元锁死不扩 → 独立元信息,前端 Pole 列按应星 join。"""
        from astrostudy import pd_engine
        proj, _frame = self._pdResolveProjectionFrame()
        chart = self.perchart.getChart()
        geo_lat = self._coreParseCoord(getattr(self.perchart, 'lat', 0.0))
        geo_lon = self._coreParseCoord(getattr(self.perchart, 'lon', 0.0))
        eps = float(swisseph.calc_ut(chart.date.jd, swisseph.ECL_NUT)[0][1])
        armc = float(_polarSafeHousesEx(chart.date.jd, geo_lat, geo_lon, b'P')[1][2])
        from astrostudy import pd_semiarc_pole as _sp
        pole_fn = {'regiomontanus': pd_engine.pole_regiomontanus,
                   'campanus': pd_engine.pole_regiomontanus,
                   'topocentric': pd_engine.pole_topocentric,
                   'horizontal': _sp.horizontal_pole,
                   'koch': _sp.koch_pole}.get(proj, pd_engine.pole_placidus_approx)
        zodiacal = (getattr(self.perchart, 'pdtype', 0) or 0) in (0, 4)   # Field Plane 属黄道向运
        poles = {'Asc': round(geo_lat, 4), 'MC': 0.0, 'Desc': round(geo_lat, 4), 'IC': 0.0}
        names = list(self._PD_ENGINE_SIGNIFICATORS)
        for pt in self._pdExtraSignificatorPoints(chart):
            names.append(pt['id'].split('_')[1])
        seen = set()
        sig_pts = []
        for name in names:
            if name in seen or name in ('Asc', 'MC', 'Desc', 'IC'):
                continue
            seen.add(name)
            try:
                o = chart.get(name)
                lon, lat = float(o.lon), (0.0 if zodiacal else float(o.lat))
            except Exception:
                pt = next((x for x in self._pdExtraSignificatorPoints(chart)
                           if x['id'].split('_')[1] == name), None)
                if not pt:
                    continue
                lon, lat = pt['lon'], (0.0 if zodiacal else pt['lat'])
            sig_pts.append({'id': 'N_%s_0' % name, '_name': name, 'lon': lon, 'lat': lat})
        # 点表设置项(真位置 / 忽略应星黄纬)与表格同口径:极点按算弧时的应星位置取
        sig_pts = self._pdApplyLatitudeOptions(sig_pts, [])[0]
        for sp in sig_pts:
            lon = float(sp['lon'])
            lat = 0.0 if zodiacal else float(sp.get('lat', 0.0) or 0.0)
            try:
                ra, dec = pd_engine.ecl_to_eq(lon, lat, eps)
                poles[sp['_name']] = round(float(pole_fn(ra, dec, armc, geo_lat)), 4)
            except Exception:
                continue
        return {'projection': proj, 'poles': poles}

    def getPdReleaseInfo(self):
        """释放框架元信息(前端右栏/AI 快照用):hyleg 选定轨迹 + 免责。"""
        from astrostudy import pd_release
        sel, proms, chart = self._pdReleaseContext()
        alcocoden = None
        hyleg = sel.get('hyleg')
        if hyleg:
            try:
                from astrostudy.astroextra import DIGNITY_SCORES
                from flatlib.dignities import essential
                ho = chart.get(hyleg['name']) if hyleg['name'] != 'Syzygy' else None
                if ho is not None:
                    h_sign, h_signlon = ho.sign, float(ho.signlon)
                else:
                    h_sign = const.LIST_SIGNS[int(float(hyleg['lon']) // 30) % 12]
                    h_signlon = float(hyleg['lon']) % 30.0
                planet_lons = {}
                for nm in const.LIST_SEVEN_PLANETS:
                    try:
                        planet_lons[nm] = float(chart.get(nm).lon)
                    except Exception:
                        continue
                alcocoden = pd_release.alcocoden_identify(
                    h_sign, h_signlon, float(hyleg['lon']), planet_lons,
                    essential.getInfo(h_sign, h_signlon), DIGNITY_SCORES)
            except Exception:
                alcocoden = None
        return {
            'hyleg': hyleg,
            'candidates': sel.get('candidates'),
            'anaretaCount': len(proms),
            'priority': list(pd_release.APHETIC_HOUSES),
            'alcocoden': alcocoden,
            'disclaimer': pd_release.RELEASE_DISCLAIMER,
        }

    def getPrimaryDirectionRelease(self):
        """释放框架主表:S=hyleg(自动定),P=anareta 集;弧按 resolved projection
        (ptolemy 用 placidus 闭式——同一算法;引擎族用各自闭式)。"""
        from astrostudy import pd_engine
        sel, proms, chart = self._pdReleaseContext()
        hyleg = sel.get('hyleg')
        pdlist = []
        if not hyleg:
            return pdlist
        proj, _frame = self._pdResolveProjectionFrame()
        method = proj if proj in pd_engine.CLOSED else 'placidus'
        zodiacal = (getattr(self.perchart, 'pdtype', 0) or 0) in (0, 4)   # Field Plane 属黄道向运
        geo_lat = self._coreParseCoord(getattr(self.perchart, 'lat', 0.0))
        geo_lon = self._coreParseCoord(getattr(self.perchart, 'lon', 0.0))
        eps = float(swisseph.calc_ut(chart.date.jd, swisseph.ECL_NUT)[0][1])
        armc = float(_polarSafeHousesEx(chart.date.jd, geo_lat, geo_lon, b'P')[1][2])
        max_arc = float(getattr(self.perchart, 'pdYears', 100) or 100)
        sig_id = 'N_%s_0' % hyleg['name']
        if hyleg['name'] == 'Asc':
            sig = None                       # 到 ASC:全派一致的轴闭式
        else:
            s_lat = 0.0
            if not zodiacal:
                try:
                    s_lat = float(chart.get(hyleg['name']).lat)
                except Exception:
                    s_lat = 0.0
            sig = {'lon': float(hyleg['lon']), 'lat': s_lat}
        cat = 'Z' if zodiacal else 'M'
        for prom in proms:
            base = prom['id'].split('_')[1]
            if base == hyleg['name']:
                continue
            prom_pt = {'lon': prom['lon'], 'lat': prom['lat'] if not zodiacal else 0.0}
            try:
                if sig is None:
                    arc = pd_engine.arc_to_angle(prom_pt, armc, geo_lat, eps, 'ASC', zodiacal=zodiacal)
                else:
                    arc = pd_engine.arc_for_method(sig, prom_pt, armc, geo_lat, eps, method, zodiacal=zodiacal)
            except Exception:
                continue
            if arc is None or abs(arc) < 1e-9 or abs(arc) > max_arc:
                continue
            pdlist.append([arc, prom['id'], sig_id, cat])
        pdlist.sort(key=lambda r: (abs(r[0]), r[0], r[1], r[2]))
        self.appendDateStr(pdlist)
        return pdlist

    def getPrimaryDirectionBounds(self):
        """界行框架主表(自洽口径):S=ASC,P=界分界线;到 ASC 的弧=斜升差
        (全派一致的轴闭式,与上升时间度量同源)。"""
        from astrostudy import pd_engine
        chart = self.perchart.getChart()
        geo_lat = self._coreParseCoord(getattr(self.perchart, 'lat', 0.0))
        geo_lon = self._coreParseCoord(getattr(self.perchart, 'lon', 0.0))
        eps = float(swisseph.calc_ut(chart.date.jd, swisseph.ECL_NUT)[0][1])
        armc = float(_polarSafeHousesEx(chart.date.jd, geo_lat, geo_lon, b'P')[1][2])
        max_arc = float(getattr(self.perchart, 'pdYears', 100) or 100)
        pdlist = []
        for ruler, sgn_idx, lon in pd_engine.term_boundaries(getattr(self.perchart, 'termsVariant', 0)):
            prom_pt = {'lon': float(lon), 'lat': 0.0}
            arc = pd_engine.arc_to_angle(prom_pt, armc, geo_lat, eps, 'ASC', zodiacal=True)
            if arc is None or abs(arc) < 1e-9 or abs(arc) > max_arc:
                continue
            rname = pd_engine.TERM_RULER_FULL.get(ruler, ruler)
            sname = pd_engine.TERM_SIGN_NAMES[int(sgn_idx) % 12]
            pdlist.append([arc, 'T_%s_%s' % (rname, sname), 'N_Asc_0', 'Z'])
        pdlist.sort(key=lambda r: (abs(r[0]), r[0], r[1], r[2]))
        self.appendDateStr(pdlist)
        return pdlist

    def _pdResolveProjectionFrame(self):
        """解析 (projection, frame):显式 pdProjection/pdFrame 优先,缺省由旧 pdMethod
        兼容映射推导;未知值回落默认对 ('ptolemy','alcabitius')。frame 可为 None(回落本命盘宫制)。"""
        proj = getattr(self.perchart, 'pdProjection', None)
        frame = getattr(self.perchart, 'pdFrame', None)
        if proj is None or frame is None:
            method = getattr(self.perchart, 'pdMethod', 'core_alchabitius') or 'core_alchabitius'
            d_proj, d_frame = _PD_METHOD_TO_PAIR.get(method, ('ptolemy', 'alcabitius'))
            if proj is None:
                proj = d_proj
            if frame is None:
                frame = d_frame
        if proj not in _PD_PROJECTION_REGISTRY:
            proj = 'ptolemy'
        return proj, frame

    def getPrimaryDirectionByZ(self):
        # 投影维 strategy 分发(见 _PD_PROJECTION_REGISTRY):弧只由 projection 决定,
        # frame 只进盘面宫始点(_pdChartHouseSystem),二者正交。
        # 任何未知组合一律回落 ptolemy → getPrimaryDirectionByZCoreKernel,
        # 护住默认 Alcabitius+Ptolemy 路径字节级一致。
        proj, _frame = self._pdResolveProjectionFrame()
        handler_name = _PD_PROJECTION_REGISTRY.get(proj) or _PD_PROJECTION_REGISTRY['ptolemy']
        handler = getattr(self, handler_name)
        pdlist = handler()
        self.appendDateStr(pdlist)
        return pdlist

    def getPrimaryDirectionByZLegacy(self):
        chart = self.perchart.getChart()
        pd = PrimaryDirections(chart)
        pdlist = []
        for item in pd.getList(self.perchart.pdaspects):
            if len(item) > 3 and item[3] == 'Z':
                pdlist.append(item)
        return pdlist

    # ---- 自研主限法引擎(Placidus 半弧 / Regiomontanus / Campanus / Topocentric)----
    # 这些方位法走 astrostudy.pd_engine(通用球面三角 + swisseph 原语),与默认 Alcabitius
    # 完全独立;Alcabitius+Ptolemy 字节级路径绝不受影响(铁律①)。

    # 点集与核心族同一份(十二星点含北交、福点;应星另加上升 / 天顶):换方法不该换掉哪些星出行。
    _PD_ENGINE_SIGNIFICATORS = [const.ASC, const.MC] + list(CORE_PD_SIGNIFICATOR_IDS)
    _PD_ENGINE_PROMISSORS = list(CORE_PD_PROMISSOR_IDS)

    def _pdEngineChartData(self):
        """从本命盘取 pd_engine 所需:bodies/angles/armc/phi/eps/jd。"""
        chart = self.perchart.getChart()
        jd = float(chart.date.jd)
        phi = float(chart.pos.lat)
        geolon = float(chart.pos.lon)
        eps = float(swisseph.calc_ut(jd, swisseph.ECL_NUT)[0][1])  # mean ε（与 core kernel 统一，弃 true）
        armc = float(_polarSafeHousesEx(jd, phi, geolon, b'P')[1][2])
        angle_ids = (const.ASC, const.MC, const.DESC, const.IC)
        bodies = {}
        needed = set(self._PD_ENGINE_PROMISSORS) | set(self._PD_ENGINE_SIGNIFICATORS)
        for name in needed:
            if name in angle_ids:
                continue
            try:
                o = chart.get(name)
                bodies[name] = {'lon': float(o.lon), 'lat': float(o.lat)}
            except Exception:
                continue
        # ΔT 校准（未来盘把本体平移到参考 ΔT；与 core kernel 同一函数；角不动）
        _dt = self._corePdDeltaTPointMap(chart)
        if _dt:
            for _nm, _b in bodies.items():
                _d = _dt.get(_nm)
                if _d:
                    _b['lon'] = angle.norm(_b['lon'] + _d[0])
                    _b['lat'] = _b['lat'] + _d[1]
        angles = {}
        for aid in angle_ids:
            try:
                angles[aid] = float(chart.get(aid).lon)
            except Exception:
                continue
        return bodies, angles, armc, phi, eps, jd

    def getPrimaryDirectionByZEngine(self, method, zodiacal=True):
        """通用引擎主限法表格:闭式/数值逐对算弧,产出 pdlist 行。
        zodiacal=True 黄道向运;False 世俗向运(in mundo,相位在房屋空间,Regio≠Campanus)。
        顺向(direct)/ 逆向(converse) 可同时开(各跑一遍 build_directions 后拼接,arc 正负号天然区分);
        映点 / 界 由 perchart 开关控制。"""
        from astrostudy import pd_engine
        bodies, angles, armc, phi, eps, jd = self._pdEngineChartData()
        aspects = list(self.perchart.pdaspects) if self.perchart.pdaspects else [0, 60, 90, 120, 180]
        # S/P 清单扩展(引擎族;默认零追加):Desc/IC 直接入 sig 名单(angles 已备),
        # Syzygy/Spirit/Cusp 塞 bodies 后入名单;宫始点 P 同理。
        sig_names = list(self._PD_ENGINE_SIGNIFICATORS)
        prom_names = list(self._PD_ENGINE_PROMISSORS)
        _chart_for_extra = self.perchart.getChart()
        _sig_keys = getattr(self.perchart, 'pdSignificators', None) or []
        if 'Desc' in _sig_keys and const.DESC in angles:
            sig_names.append(const.DESC)
        if 'IC' in _sig_keys and const.IC in angles:
            sig_names.append(const.IC)
        for _pt in self._pdExtraSignificatorPoints(_chart_for_extra):
            _nm = _pt['id'].split('_')[1]
            if _nm in (const.DESC, const.IC):
                continue
            bodies[_nm] = {'lon': _pt['lon'], 'lat': _pt['lat']}
            sig_names.append(_nm)
        for _pt in self._pdExtraCuspPromissorPoints(_chart_for_extra):
            _nm = _pt['id'].split('_')[1]
            bodies.setdefault(_nm, {'lon': _pt['lon'], 'lat': _pt['lat']})
            prom_names.append(_nm)
        # 点表设置项(真位置 / 月亮视差 / 忽略应星·迫星黄纬):与核心族同口径
        sig_bodies, bodies = self._pdEngineOptionBodies(bodies, sig_names, prom_names)
        max_arc = float(getattr(self.perchart, 'pdYears', 100) or 100)
        include_antiscia = bool(getattr(self.perchart, 'pdAntiscia', False))
        include_terms = bool(getattr(self.perchart, 'pdTerms', False))
        include_parallels = bool(getattr(self.perchart, 'pdParallel', False))
        include_rapt = bool(getattr(self.perchart, 'pdRaptParallel', False))
        # 向运方向:顺(direct)默认开,逆(converse)默认关;两者皆关时回退顺向。
        want_direct = getattr(self.perchart, 'pdDirect', True)
        want_direct = True if want_direct is None else bool(want_direct)
        want_converse = bool(getattr(self.perchart, 'pdConverse', False))
        if not want_direct and not want_converse:
            want_direct = True

        def _build(converse):
            return pd_engine.build_directions(
                bodies, angles, armc, phi, eps, method,
                sig_names, prom_names,
                aspects=aspects, max_arc=max_arc, zodiacal=zodiacal,
                converse=converse, include_antiscia=include_antiscia,
                include_terms=include_terms,
                include_parallels=include_parallels, include_rapt=include_rapt,
                terms_variant=getattr(self.perchart, 'termsVariant', 0),
                sig_bodies=sig_bodies)

        rows = []
        if want_direct:
            rows.extend(_build(False))
        if want_converse:
            rows.extend(_build(True))
        # 多圈复发行(pdYears>360 才出新行;≤360 与既往逐位一致,基行族数值法只产 |arc|<180 基弧)。
        rows = self._extendCorePdRecurrences(rows, max_arc)
        # 复发可翻号(+10 的 −350 圈是逆向事件),按顺/逆勾选过滤(基行天然纯号,此过滤对基行是恒等)。
        if not (want_direct and want_converse):
            rows = [it for it in rows
                    if (it[0] > 0 and want_direct) or (it[0] < 0 and want_converse)]
        # 顺逆同开时,direct(正弧)与 converse(负弧)两批要按「年龄」交错显示,而非先全顺再全逆。
        # 年龄 ∝ |arc|(同一时间钥匙下 |弧|越大日期越晚),故按 |arc| 升序统一排序。
        rows.sort(key=lambda r: (abs(r[0]), r[0], r[1], r[2]))
        return rows

    def _pdLunarParallaxShift(self):
        """月亮视差:出生地站心月亮与地心月亮的 (Δ黄经, Δ黄纬),海拔取 0。"""
        chart = self.perchart.getChart()
        jd = float(chart.date.jd)
        geo_lat = self._coreParseCoord(getattr(self.perchart, 'lat', 0.0))
        geo_lon = self._coreParseCoord(getattr(self.perchart, 'lon', 0.0))
        flags = self._coreEphemerisFlags()
        geo = swisseph.calc_ut(jd, swisseph.MOON, flags)[0]
        # ⚠️ swisseph 全局态:set_topo→calc_ut 两行必须相邻直线
        swisseph.set_topo(float(geo_lon), float(geo_lat), 0.0)
        topo = swisseph.calc_ut(jd, swisseph.MOON, flags | swisseph.FLG_TOPOCTR)[0]
        return self._norm180(float(topo[0]) - float(geo[0])), float(topo[1]) - float(geo[1])

    def _pdTruePositionPointMap(self, chart):
        """真位置:各本体由视位置换成几何位置(不计光行时、光行差、光线偏折)的 (Δ黄经, Δ黄纬);
        福点随日月同步(昼 Δ月 − Δ日,夜 Δ日 − Δ月),交点用真交点。轴不动。"""
        jd = float(chart.date.jd)
        flags = self._coreEphemerisFlags()

        def dpos(swe_id):
            p0 = swisseph.calc_ut(jd, swe_id, flags)[0]
            p1 = swisseph.calc_ut(jd, swe_id, flags | swisseph.FLG_TRUEPOS)[0]
            return (angle.closestdistance(float(p0[0]), float(p1[0])), float(p1[1]) - float(p0[1]))

        dmap = {base_id: dpos(info[1]) for base_id, info in CORE_PD_VIRTUAL_BODY_CORR_MODELS.items()}
        dn = dpos(swisseph.TRUE_NODE)[0]
        dmap[const.NORTH_NODE] = (dn, 0.0)
        dmap[const.SOUTH_NODE] = (dn, 0.0)
        dmoon, dsun = dmap[const.MOON][0], dmap[const.SUN][0]
        diurnal = bool(getattr(self.perchart, 'isDiurnal', True))
        dmap[const.PARS_FORTUNA] = ((dmoon - dsun) if diurnal else (dsun - dmoon), 0.0)
        return dmap

    def _pdApplyLatitudeOptions(self, significators, promissors, ignore_prom_lat=None):
        """点表设置项(默认都关,原样返回),依次:
        - 真位置:本体取几何位置(见 _pdTruePositionPointMap),应星迫星同改。
        - 月亮视差:月亮作迫星时(含其各相位点)用出生地站心位置;作应星不变。
        - 「忽略应星黄纬」「忽略迫星黄纬」:对应点表的黄纬置 0(最后做)。
        ignore_prom_lat 由调用方另定时传入(Field Plane 经典口径下迫星黄纬不清零),缺省读设置。"""
        if bool(getattr(self.perchart, 'pdTruePosition', False)):
            tp_map = self._pdTruePositionPointMap(self.perchart.getChart())
            significators = [self._coreShiftPointByDeltaT(o, tp_map) for o in significators]
            promissors = [self._coreShiftPointByDeltaT(o, tp_map) for o in promissors]
        if bool(getattr(self.perchart, 'pdLunarParallax', False)):
            d_lon, d_lat = self._pdLunarParallaxShift()
            shifted = []
            for o in promissors:
                if self._baseDirectionObjectId(o.get('id')) == const.MOON and o.get('lon') is not None:
                    o = dict(o, lon=angle.norm(float(o['lon']) + d_lon), lat=float(o.get('lat', 0.0) or 0.0) + d_lat)
                shifted.append(o)
            promissors = shifted
        if bool(getattr(self.perchart, 'pdIgnoreSigLat', False)):
            significators = [dict(o, lat=0.0) for o in significators]
        if ignore_prom_lat is None:
            ignore_prom_lat = bool(getattr(self.perchart, 'pdIgnorePromLat', False))
        if ignore_prom_lat:
            promissors = [dict(o, lat=0.0) for o in promissors]
        mode = int(getattr(self.perchart, 'pdPromAspectLat', 0) or 0)
        if mode:
            from astrostudy.pd_aspect_latitude import HOUSE_POSITION_MODE
            metric = self._pdHousePositionMetric() if mode == HOUSE_POSITION_MODE else None
            if mode != HOUSE_POSITION_MODE or metric is not None:
                promissors = [self._pdWithAspectLatitude(o, mode, metric) for o in promissors]
        return significators, promissors

    def _pdWithAspectLatitude(self, point, mode, metric=None):
        """黄道制迫星相位点的黄纬口径(pd_aspect_latitude):把按口径算出的黄纬记在 latZ,
        _corePointEqCoords(zero_lat=True)取「黄道上的相位点」时用它(缺省口径不写 latZ = 黄纬 0,逐位同旧)。
        按宫位档(4)要所选方位法的宫位度量 metric,相位带符号(右旋 D 取负),迫星黄经 = 相位点黄经 − 相位。"""
        parts = '{0}'.format(point.get('id', '')).split('_')
        if len(parts) < 3 or parts[0] not in ('N', 'D', 'S'):
            return point
        try:
            asp = abs(float(parts[-1]))
        except ValueError:
            return point
        from astrostudy import pd_aspect_latitude as _al
        if mode == _al.HOUSE_POSITION_MODE:
            if metric is None or point.get('lon') is None:
                return point
            signed = -asp if parts[0] == 'D' else asp
            lam_p = (float(point['lon']) - signed) % 360.0
            return dict(point, latZ=_al.house_position_latitude(lam_p, point.get('lat', 0.0), signed, metric))
        return dict(point, latZ=_al.aspect_point_latitude(mode, point.get('lat', 0.0), asp))

    # 按宫位档用的宫位度量:投影 / 定局 → pd_aspect_latitude.house_position_metric 的 kind
    _PD_HOUSE_POSITION_KIND = {'placidus': 'placidus', 'placidus_under_pole': 'placidus',
                               'regiomontanus': 'regiomontanus', 'campanus': 'campanus',
                               'horizontal': 'horizontal', 'koch': 'koch',
                               'topocentric': 'topocentric'}

    def _pdHousePositionMetric(self):
        """按宫位档(只对黄道制):所选方位法的宫位度量 U(λ, b);宫位只由黄经定或没有宫位度量的方法返回 None。"""
        if int(getattr(self.perchart, 'pdtype', 0) or 0) != 0:
            return None
        from astrostudy import pd_aspect_latitude as _al
        proj, frame = self._pdResolveProjectionFrame()
        kind = self._PD_HOUSE_POSITION_KIND.get(proj)
        if kind is None and proj == 'ptolemy' and frame in ('alcabitius', 'meridian'):
            kind = frame
        if kind is None:
            return None
        chart = self.perchart.getChart()
        eps = self._coreMeanObliquity(chart)
        geo_lat = float(self._coreParseCoord(getattr(self.perchart, 'lat', 0.0)))
        geo_lon = self._coreParseCoord(getattr(self.perchart, 'lon', 0.0))
        ascmc = _polarSafeHousesEx(chart.date.jd, geo_lat, geo_lon, b'P')[1]
        dsa_asc = ad_mc = None
        if kind == 'alcabitius':
            asc_decl = self._coreEqCoords(float(ascmc[0]), 0.0, eps)[1]
            dsa_asc = 90.0 + float(utils.ascdiff(float(asc_decl), geo_lat))
        if kind == 'koch':
            ad_mc = float(utils.ascdiff(float(self._coreEqCoords(float(ascmc[1]), 0.0, eps)[1]), geo_lat))
        return _al.house_position_metric(kind, float(ascmc[2]), geo_lat, eps,
                                         lambda lon, b: self._coreEqCoords(lon, b, eps), dsa_asc, ad_mc)

    _PD_POINT_OPTION_KEYS = ('pdTruePosition', 'pdLunarParallax', 'pdIgnoreSigLat', 'pdIgnorePromLat', 'pdPromAspectLat')

    def _pdEngineOptionBodies(self, bodies, sig_names, prom_names):
        """引擎族(pd_engine)的本体表套点表设置项,与核心族同一个 _pdApplyLatitudeOptions。
        返回 (应星本体表, 迫星本体表);设置项全关时两者都是原表(逐位不变)。"""
        if not any(bool(getattr(self.perchart, k, False)) for k in self._PD_POINT_OPTION_KEYS):
            return bodies, bodies

        def as_points(names):
            out, seen = [], set()
            for nm in names:
                if nm in bodies and nm not in seen:
                    seen.add(nm)
                    b = bodies[nm]
                    out.append({'id': 'N_%s_0' % nm, '_name': nm,
                                'lon': float(b['lon']), 'lat': float(b.get('lat', 0.0) or 0.0)})
            return out

        def as_table(points):
            table = dict(bodies)
            for o in points:
                table[o['_name']] = {'lon': float(o['lon']), 'lat': float(o.get('lat', 0.0) or 0.0)}
            return table

        sigs, proms = self._pdApplyLatitudeOptions(as_points(sig_names), as_points(prom_names))
        return as_table(sigs), as_table(proms)

    def _pdAspectRows(self, pdtype):
        """相位主限表行(表格 / 天球共用一个出口):盘类内核 → 传统 / 新式逆向 → 相位侧 → 恒星迫星出表编号。"""
        if not bool(getattr(self.perchart, 'pdTradConverse', True)):
            rows = self._pdNeoConverse(pdtype)
        elif pdtype == 0:
            rows = self._pdFilterAspectSide(self.getPrimaryDirectionByZ())
        elif pdtype == 1:
            rows = self._pdFilterAspectSide(self.getPrimaryDirectionByM())
        else:
            rows = self._pdFilterAspectSide(self.getPrimaryDirectionByF())
        return self._pdPublicStarRows(rows)

    def _pdGeometry(self):
        """几何口径(改进 / 经典)对应的整套函数,见 pd_geometry。"""
        from astrostudy import pd_geometry
        return pd_geometry.functions(getattr(self.perchart, 'pdGeometry', pd_geometry.DEFAULT_VARIANT))

    def _pdPromissorMoves(self):
        """「传统逆向」关:迫星(相位点)被周日运动带到应星本命位置计弧(新式逆向)。默认开 = 应星被带到迫星相位点。"""
        return not bool(getattr(self.perchart, 'pdTradConverse', True))

    def _pdNeoConverse(self, pdtype):
        """传统逆向关时的行变换。内核先按顺逆两向出全表,按各方法的运动约定换算,最后才套顺 / 逆勾选:
        - In Zodiaco:赤经类核心法、纯黄道(斜升差)、赤经直推与 Along-Ecliptic 的本体行变号(弧都是两点对称的差值,
          换谁动只差一个符号);半弧 / 极下 / 黄极圈在内核里改为迫星点动;
          Edmund Jones 不变;轴应星本就是迫星点动,不变。
        - In Mundo:带符号的轴行(上升 / 下降 / 宿命点 / 反宿命点)变号,天顶 / 天底取绝对值不变;
          本体行 Alcabitius 本就是迫星动不变、Placidus 在内核里互换角色,其余世俗法变号。
        - Field Plane:相位点本就是迫星动,不变。"""
        pc = self.perchart
        want_direct = getattr(pc, 'pdDirect', True)
        want_direct = True if want_direct is None else bool(want_direct)
        want_converse = bool(getattr(pc, 'pdConverse', True))
        if not want_direct and not want_converse:
            want_direct = True
        pc.pdDirect, pc.pdConverse = True, True
        try:
            if pdtype == 0:
                rows = self.getPrimaryDirectionByZ()
            elif pdtype == 1:
                rows = self.getPrimaryDirectionByM()
            else:
                rows = self.getPrimaryDirectionByF()
        finally:
            pc.pdDirect, pc.pdConverse = want_direct, want_converse
        proj, frame = self._pdResolveProjectionFrame()
        method = getattr(pc, 'pdMethod', 'core_alchabitius') or 'core_alchabitius'
        axes = (const.ASC, const.MC, const.DESC, const.IC, CORE_PD_VERTEX_ID, CORE_PD_ANTIVERTEX_ID)
        signed_axes = (const.ASC, const.DESC, CORE_PD_VERTEX_ID, CORE_PD_ANTIVERTEX_ID)
        if pdtype == 0:
            flip_body = proj in ('ptolemy', 'in_zodiaco_lon', 'zodiacal', 'ra_direct')
            flip_axes = False
        elif pdtype == 1:
            # 与 getPrimaryDirectionByM 的分派一一对应:迫星本就在动的核(Alcabitius)不变,Placidus 在核内互换,
            # 极下族与旧 flatlib 'M' 路径维持原样;应星在动的核(Meridian / Equal 时圈 / Morinus / 世界经度核)变号。
            explicit_proj = getattr(pc, 'pdProjection', None) is not None
            legacy_m = not explicit_proj and method in _PD_MUNDO_LEGACY_METHODS
            if proj in ('placidus', 'regiomontanus', 'campanus', 'topocentric', 'horizontal', 'koch'):
                flip_body = False
            elif proj == 'morinus':
                flip_body = True
            elif proj == 'ptolemy' and frame == 'alcabitius':
                flip_body = False
            elif proj == 'ptolemy' and frame in ('equal_hour_circle', 'meridian', 'porphyry', 'equal'):
                flip_body = True
            else:
                flip_body = not legacy_m
            flip_axes = True
        else:
            flip_body = flip_axes = False
        out = []
        for it in rows:
            it = list(it)
            base = self._baseDirectionObjectId(it[2])
            if base in axes:
                if flip_axes and base in signed_axes:
                    it[0] = -float(it[0])
            elif flip_body:
                it[0] = -float(it[0])
            out.append(it)
        if not (pdtype == 0 and proj == 'in_zodiaco_abs'):
            # Edmund Jones 的弧不分方向,顺 / 逆勾选对它不起作用
            out = [it for it in out if (it[0] > 0 and want_direct) or (it[0] < 0 and want_converse)]
        out.sort(key=lambda item: (abs(item[0]), item[0], item[1], item[2]))
        return self._pdFilterAspectSide(out)

    def _pdFilterAspectSide(self, pdlist):
        """相位侧开关:1 = 只出右旋(本体应星不出合相),2 = 只出左旋(含合相);冲两侧都出;
        轴应星(ASC/MC/DSC/IC/Vertex/东点)的合相与冲两侧都出。"""
        side = getattr(self.perchart, 'pdAspectSide', 0) or 0
        if side not in (1, 2):
            return pdlist
        axes = (const.ASC, const.MC, const.DESC, const.IC, CORE_PD_VERTEX_ID, CORE_PD_ANTIVERTEX_ID)
        out = []
        for it in pdlist:
            parts = '{0}'.format(it[1]).split('_')
            prefix = parts[0] if parts else ''
            try:
                asp = abs(float(parts[-1])) if prefix in ('N', 'D', 'S') else 0.0
            except ValueError:
                asp = 0.0
            if prefix == 'D':
                keep = side == 1
            elif prefix == 'S':
                keep = side == 2
            elif abs(asp - 180.0) < 1e-9:
                keep = True
            else:
                keep = side == 2 or self._baseDirectionObjectId(it[2]) in axes
            if keep:
                out.append(it)
        return out

    def _corePdMirrorTermPromissors(self, promissors):
        """映点(A_/C_)、赤纬平行(PD_/PC_)、界(T_)促发星扩展点,对应开关开才有(默认空,零追加)。
        与核心核同口径:均作黄道合相点(lat=0),本体 lon 取已真交点重建 + ΔT 平移后的 N_*_0。"""
        want_anti = bool(getattr(self.perchart, 'pdAntiscia', False))
        want_terms = bool(getattr(self.perchart, 'pdTerms', False))
        want_par = bool(getattr(self.perchart, 'pdParallel', False))
        if not (want_anti or want_terms or want_par):
            return []
        from astrostudy import pd_engine as _pde
        base_lons = {}
        for p in promissors:
            parts = '{0}'.format(p.get('id') or '').split('_')
            if len(parts) == 3 and parts[0] == 'N' and parts[2] == '0':
                base_lons[parts[1]] = p.get('lon')
        mirror_specs = []
        if want_anti:
            mirror_specs += [(_pde.antiscion, 'A'), (_pde.contra_antiscion, 'C')]
        if want_par:
            mirror_specs += [(_pde.antiscion, 'PD'), (_pde.contra_antiscion, 'PC')]
        extra = []
        for bn, bl in base_lons.items():
            if bl is None:
                continue
            for fn, pre in mirror_specs:
                extra.append({'id': '{0}_{1}_0'.format(pre, bn), 'lon': angle.norm(fn(float(bl))), 'lat': 0.0})
        if want_terms:
            for ruler, sign, tlon in _pde.term_boundaries(getattr(self.perchart, 'termsVariant', 0)):
                rname = _pde.TERM_RULER_FULL.get(ruler, ruler)
                sname = _pde.TERM_SIGN_NAMES[int(sign) % 12]
                extra.append({'id': 'T_{0}_{1}'.format(rname, sname), 'lon': angle.norm(float(tlon)), 'lat': 0.0})
        return extra

    def _extendCorePdRecurrences(self, pdlist, max_arc):
        """主限弧的整圈复发/互补统一扩展:同一次穿越的全部等价弧 = 基弧 + 360·m(m∈ℤ)。
        在 |弧| ≤ max_arc(=pdYears)内全数列出:m=−sign 的首项即经典「180+ 互补行」
        (绕远 360−|arc|,覆盖到 ≈360 岁),|m|≥1 的同号项即多圈直达(360+ 岁,3000 年上限用)。
        max_arc ≤ 180 时不扩(与历史门 `>180` 字节级一致);180<max_arc≤360 时
        逐位等价于旧单行互补式(同号 +360 项必超窗,异号首项条件同旧 `360−|arc| ≤ max_arc`)。"""
        if not pdlist or max_arc <= 180.0:
            return pdlist
        extra = []
        for it in pdlist:
            base = float(it[0])
            m = 1
            while True:
                added = False
                for cand in (base + 360.0 * m, base - 360.0 * m):
                    if abs(cand) <= max_arc:
                        extra.append([cand, it[1], it[2], it[3]])
                        added = True
                if not added:
                    break
                m += 1
        if extra:
            pdlist = list(pdlist) + extra
        return pdlist

    def getPrimaryDirectionByZPlacidus(self):
        return self._getPrimaryDirectionByZSemiarcPole('semiarc')

    def getPrimaryDirectionByZRegiomontanus(self):
        return self._getPrimaryDirectionByZSemiarcPole('pole')

    def getPrimaryDirectionByZCampanus(self):
        # Campanus 与 Regiomontanus 的位置圈同为过地平南北点的大圆,本体弧相同。
        return self._getPrimaryDirectionByZSemiarcPole('pole')

    def getPrimaryDirectionByZMorinus(self):
        return self._getPrimaryDirectionByZSemiarcPole('ecliptic_pole')

    def getPrimaryDirectionByZHorizontal(self):
        # Horizontal:位置圈 = 过天顶与目标点的地平经圈(那半条),应星沿周日圈走到它上面
        return self._getPrimaryDirectionByZSemiarcPole('horizontal')

    def getPrimaryDirectionByZKoch(self):
        # Koch(出生地法):位置圈 = 过目标点的出生地斜升圈(东 +φ、西 −φ)
        return self._getPrimaryDirectionByZSemiarcPole('koch')

    def _getPrimaryDirectionByZSemiarcPole(self, kind):
        """半弧法(Placidus)/ 极下法(Regiomontanus · Campanus)/ 黄极圈法(Morinus),In Zodiaco,传统逆向口径。
        - 本体应星:见 pd_semiarc_pole(应星被周日运动带到迫星相位点的位置圈上;半弧 / 极下带真黄纬,
          黄极圈法取黄经点、黄纬 0)。
        - 轴应星(ASC/MC/Vertex/DSC/IC):轴只随周日旋转移动,与方位法无关,直接复用核心核的轴行。
        取点(相位点、真交点重建、ΔT 平移、扩展点)与核心核同口径。"""
        from astrostudy import pd_semiarc_pole as _sp
        _ANGLE_SIGS = (const.ASC, const.MC, const.DESC, const.IC, CORE_PD_VERTEX_ID)
        angle_rows = [it for it in self.getPrimaryDirectionByZCoreKernel()
                      if self._baseDirectionObjectId(it[2]) in _ANGLE_SIGS]
        chart = self.perchart.getChart()
        pd = PrimaryDirections(chart)
        aspList = self.perchart.pdaspects
        sig_objs = pd._elements(CORE_PD_SIGNIFICATOR_IDS, pd.N, [0])
        promissors = pd._elements(CORE_PD_PROMISSOR_IDS, pd.N, aspList)
        node_base_lons = self._coreTrueNodeBaseLons(chart)
        significators = [self._rebuildCoreNodePoint(pd, obj, node_base_lons) for obj in sig_objs]
        promissors = [self._rebuildCoreNodePoint(pd, obj, node_base_lons) for obj in promissors]
        _dt_dmap = self._corePdDeltaTPointMap(chart)
        if _dt_dmap:
            significators = [self._coreShiftPointByDeltaT(o, _dt_dmap) for o in significators]
            promissors = [self._coreShiftPointByDeltaT(o, _dt_dmap) for o in promissors]
        significators, promissors = self._pdApplyLatitudeOptions(significators, promissors)
        promissors.extend(self._corePdMirrorTermPromissors(promissors))
        significators.extend(self._pdExtraSignificatorPoints(chart))
        promissors.extend(self._pdExtraCuspPromissorPoints(chart, aspects=aspList))
        eps_mean = self._coreMeanObliquity(chart)
        geo_lat = self._coreParseCoord(getattr(self.perchart, 'lat', 0.0))
        geo_lon = self._coreParseCoord(getattr(self.perchart, 'lon', 0.0))
        ramc = float(_polarSafeHousesEx(chart.date.jd, geo_lat, geo_lon, b'P')[1][2])
        geo = self._pdGeometry()
        arc_fn = {'semiarc': geo.semiarc_arc, 'topocentric': geo.topocentric_arc,
                  'horizontal': geo.horizontal_arc, 'koch': geo.koch_arc,
                  'placidus_pole': _sp.placidus_pole_arc}.get(kind, geo.pole_circle_arc)
        sig_zero_lat = kind == 'ecliptic_pole'
        prom_moves = self._pdPromissorMoves()
        max_arc = float(getattr(self.perchart, 'pdYears', 100) or 100)
        tiny = 1e-12
        pdlist = []
        for prom in promissors:
            prom_id = prom.get('id')
            ra_p, decl_p = self._corePointEqCoords(prom, eps_mean, zero_lat=True)
            if prom_id is None or ra_p is None:
                continue
            for sig in significators:
                sig_id = sig.get('id')
                if sig_id is None or prom_id == sig_id:
                    continue
                if self._baseDirectionObjectId(sig_id) in _ANGLE_SIGS:
                    continue
                if self._baseDirectionObjectId(prom_id) == self._baseDirectionObjectId(sig_id):
                    continue
                if prom_moves:
                    # 新式逆向:迫星相位点(黄纬 0)被带到应星本命位置(真黄纬;黄极圈法用应星黄经圈)
                    ra_s, decl_s = self._corePointEqCoords(sig, eps_mean, zero_lat=False)
                    if ra_s is None or sig.get('lon') is None:
                        continue
                    if kind == 'ecliptic_pole':
                        arc = _sp.ecliptic_pole_circle_arc(float(sig['lon']), float(ra_p), float(decl_p), eps_mean)
                    else:
                        arc = arc_fn(float(ra_s), float(decl_s), float(ra_p), float(decl_p), ramc, geo_lat)
                    if arc is None or abs(arc) <= tiny or abs(arc) >= max_arc:
                        continue
                    pdlist.append([arc, prom_id, sig_id, 'Z'])
                    continue
                ra_s, decl_s = self._corePointEqCoords(sig, eps_mean, zero_lat=sig_zero_lat)
                if ra_s is None:
                    continue
                if kind == 'ecliptic_pole':
                    arc = _sp.ecliptic_pole_circle_arc(float(prom['lon']), float(ra_s), float(decl_s), eps_mean)
                else:
                    arc = arc_fn(float(ra_p), float(decl_p), float(ra_s), float(decl_s), ramc, geo_lat)
                if arc is None or abs(arc) <= tiny or abs(arc) >= max_arc:
                    continue
                pdlist.append([arc, prom_id, sig_id, 'Z'])
        pdlist = self._extendCorePdRecurrences(pdlist, max_arc) + angle_rows
        want_direct = getattr(self.perchart, 'pdDirect', True)
        want_direct = True if want_direct is None else bool(want_direct)
        want_converse = bool(getattr(self.perchart, 'pdConverse', True))
        if not want_direct and not want_converse:
            want_direct = True
        if not (want_direct and want_converse):
            pdlist = [it for it in pdlist
                      if (it[0] > 0 and want_direct) or (it[0] < 0 and want_converse)]
        pdlist.sort(key=lambda item: (abs(item[0]), item[0], item[1], item[2]))
        return pdlist

    def getPrimaryDirectionByZTopocentric(self):
        # Topocentric(Polich–Page):位置圈取目标点自己的 Topocentric 极(东正西负),其余取点 / 轴行 / 逆向口径与极下族同一内核
        return self._getPrimaryDirectionByZSemiarcPole('topocentric')

    def getPrimaryDirectionByZPlacidusUnderPole(self):
        # Placidus 极下法:目标点的 Placidus 位置所在位置圈取其极(东正西负),在这个极下比斜升 / 斜降;
        # 与半弧比例法(Placidus)的差别只在动点按目标点的极而非自己的半弧比例计,两者是两种算法而非近似关系
        return self._getPrimaryDirectionByZSemiarcPole('placidus_pole')

    def getPrimaryDirectionByZZodiacalOA(self):
        # 纯黄道斜升差直推(古法):全点投黄道,弧 = OA 差(满 φ)。
        return self.getPrimaryDirectionByZEngine('zodiacal')

    def getPrimaryDirectionByZRaDirect(self):
        # 赤经直推:所有点极点取 0,弧 = RA 差(带符号)。
        return self.getPrimaryDirectionByZEngine('ra_direct')

    def _isNodeDirectionId(self, ID):
        txt = '{0}'.format(ID if ID is not None else '')
        return ('North Node' in txt) or ('South Node' in txt)

    def _baseDirectionObjectId(self, ID):
        parts = '{0}'.format(ID if ID is not None else '').split('_')
        if len(parts) < 3:
            return '{0}'.format(ID if ID is not None else '')
        return '_'.join(parts[1:-1]).strip()

    def _norm180(self, deg):
        return (float(deg) + 180.0) % 360.0 - 180.0

    def _obliqueAscension(self, point, lat, zero_lat=False):
        ra_key = 'raZ' if zero_lat else 'ra'
        decl_key = 'declZ' if zero_lat else 'decl'
        ra = point.get(ra_key)
        decl = point.get(decl_key)
        if ra is None or decl is None:
            return None
        return angle.norm(float(ra) - utils.ascdiff(float(decl), float(lat)))

    def _coreMeanObliquity(self, chart):
        # Core's zodiacal PD rows align best when the ecliptic->equatorial
        # conversion uses the date's mean obliquity instead of flatlib's fixed 23.44 deg.
        return float(swisseph.calc_ut(chart.date.jd, swisseph.ECL_NUT)[0][1])

    def _coreTrueObliquity(self, chart):
        return float(swisseph.calc_ut(chart.date.jd, swisseph.ECL_NUT)[0][0])

    def _coreEqCoords(self, lon, lat, obliquity):
        eq = swisseph.cotrans([float(lon), float(lat), 1.0], -float(obliquity))
        return (angle.norm(float(eq[0])), float(eq[1]))

    def _corePointEqCoords(self, point, obliquity, zero_lat=False):
        lon = point.get('lon')
        # zero_lat = 取黄道上的点;迫星相位点按「相位点黄纬」口径另有 latZ 时用它(缺省口径没有 latZ = 0)
        lat = float(point.get('latZ', 0.0) or 0.0) if zero_lat else point.get('lat', 0.0)
        if lon is None:
            return (None, None)
        return self._coreEqCoords(lon, lat, obliquity)

    def _coreObliqueAscension(self, point, lat, obliquity, zero_lat=False):
        ra, decl = self._corePointEqCoords(point, obliquity, zero_lat=zero_lat)
        if ra is None or decl is None:
            return None
        return angle.norm(float(ra) - utils.ascdiff(float(decl), float(lat)))

    def _coreVertexArc(self, prom_point, geo_lat, ramc, obliquity, zero_lat):
        """宿命点(Vertex)应星弧：迫星周日运动行至卯酉圈(与黄道交于宿命点轴)。
        闭式 = co-latitude(90°−φ) 框架的升点式(全纬度域恒等已验、弧值对参考 median 2.6e-4°)：
            arc = OA_{90°−φ}(prom) − (RAMC + 270°)，OA = RA − asin(tanδ·tan(90°−φ))
        每条直径的两次穿越由互为反点的相位点(0↔180、D60↔S120、D90↔S90、D120↔S60)
        各自携带，故本式对全候选即覆盖全部穿越事件；引擎列出窗内全部行。
        (只列其中一个子集，其取舍规律历经 9 族假说均未闭合——多显不缺显，诚实保留。)
        迫星越出 co-frame 升差定义域(|tanδ·tan(90°−φ)| ≥ 1，周日圈不穿卯酉圈)时无解 → 不出行。
        注意不能复用 utils.ascdiff(其对越界 clamp ±90°，会虚构出本应缺席的行)。"""
        ra, decl = self._corePointEqCoords(prom_point, obliquity, zero_lat=zero_lat)
        if ra is None or decl is None:
            return None
        co_lat = 90.0 - float(geo_lat)
        x = math.tan(math.radians(float(decl))) * math.tan(math.radians(co_lat))
        if abs(x) >= 1.0:
            return None
        oa = float(ra) - math.degrees(math.asin(x))
        return self._norm180(oa - (float(ramc) + 270.0))

    def _isCorePlanetPair(self, prom_id, sig_id):
        return (
            self._baseDirectionObjectId(prom_id) in CORE_PD_PLANET_IDS
            and self._baseDirectionObjectId(sig_id) in CORE_PD_PLANET_IDS
        )

    def _coreEphemerisFlags(self):
        flags = swe.SEDEFAULT_FLAG
        if getattr(self.perchart, 'zodiacal', const.TROPICAL) == const.SIDEREAL:
            flags = flags | swisseph.FLG_SIDEREAL
        return flags

    def _coreParseCoord(self, value):
        text = '{0}'.format(value if value is not None else '').strip().upper()
        match = re.fullmatch(r'(\d+)([NSEW])(\d+)', text)
        if match:
            deg = float(match.group(1))
            minutes = float(match.group(3))
            coord = deg + minutes / 60.0
            if match.group(2) in ['S', 'W']:
                coord = -coord
            return coord

        try:
            return float(value)
        except Exception:
            return 0.0

    def _coreTrueNodeBaseLons(self, chart):
        # ⚠️ 并发约定:set_sid_mode→calc_ut 两行必须相邻直线(swisseph 全局态,见 tests/test_swe_concurrency.py)。
        swisseph.set_sid_mode(swe.SEDEFAULT_SIDM__MODE)
        north = swisseph.calc_ut(chart.date.jd, swisseph.TRUE_NODE, self._coreEphemerisFlags())[0][0]
        north = angle.norm(float(north))
        return {
            const.NORTH_NODE: north,
            const.SOUTH_NODE: angle.norm(north + 180.0),
        }

    # ---- ΔT 校准（仅作用 PD 本体取数；角(RAMC/Asc/MC)走 UT 不动）----
    # 历史盘(≤2017) ΔT≈标准实测，δ≈0 → 真实用户零改动、本就逐位。
    # 未来日期采用更陡的 ΔT 长期外推；下式为单一二次曲线
    # (只依赖日期、对所有星一致，非逐星拟合)，残差≈1.1s。
    def _corePdDeltaTSeconds(self, jd):
        y, m, d, _ = swisseph.revjul(float(jd), swisseph.GREG_CAL)
        year = y + (m - 1) / 12.0 + (d - 1) / 365.25
        if year < 2018.0:
            return None
        t = year - 2000.0
        return 42.33232 + 1.390136 * t + 0.0036433 * t * t

    def _corePdDeltaTPointMap(self, chart):
        jd = float(chart.date.jd)
        dt_ref = self._corePdDeltaTSeconds(jd)
        if not dt_ref:
            return {}
        dt_sw = float(swisseph.deltat(jd)) * 86400.0
        delta = (dt_ref - dt_sw) / 86400.0  # days; 等价把本体 TT 平移到参考 ΔT
        if abs(delta) < 1e-9:
            return {}
        flags = self._coreEphemerisFlags()

        def dpos(swe_id):
            p0 = swisseph.calc_ut(jd, swe_id, flags)[0]
            p1 = swisseph.calc_ut(jd + delta, swe_id, flags)[0]
            return (angle.closestdistance(float(p0[0]), float(p1[0])), float(p1[1]) - float(p0[1]))

        dmap = {}
        for base_id, info in CORE_PD_VIRTUAL_BODY_CORR_MODELS.items():
            dmap[base_id] = dpos(info[1])
        dn = dpos(swisseph.TRUE_NODE)[0]
        dmap[const.NORTH_NODE] = (dn, 0.0)
        dmap[const.SOUTH_NODE] = (dn, 0.0)
        dmoon = dmap[const.MOON][0]
        dsun = dmap[const.SUN][0]
        diurnal = bool(getattr(self.perchart, 'isDiurnal', True))
        dmap[const.PARS_FORTUNA] = ((dmoon - dsun) if diurnal else (dsun - dmoon), 0.0)
        return dmap

    def _coreShiftPointByDeltaT(self, point, dmap):
        d = dmap.get(self._baseDirectionObjectId(point.get('id')))
        if d is None:
            return point
        out = dict(point)
        out['lon'] = angle.norm(float(point.get('lon', 0.0)) + d[0])
        out['lat'] = float(point.get('lat', 0.0)) + d[1]
        return out

    def _parseDirectionAspect(self, ID):
        parts = '{0}'.format(ID if ID is not None else '').split('_')
        if len(parts) < 3:
            return (None, 0.0)
        try:
            asp = float(parts[-1])
        except Exception:
            asp = 0.0
        return (parts[0], asp)

    def _rebuildCoreNodePoint(self, pd, point, node_base_lons):
        point_id = point.get('id')
        base_id = self._baseDirectionObjectId(point_id)
        if base_id not in node_base_lons:
            return point

        kind, asp = self._parseDirectionAspect(point_id)
        lon = node_base_lons[base_id]
        if kind == 'D':
            lon = angle.norm(lon - abs(float(asp)))
        elif kind in ['S', 'N']:
            lon = angle.norm(lon + float(asp))
        return pd.G(point_id, 0.0, lon)

    def _passesCoreDisplayWindow(self, raw_arc_delta):
        """行星对显示窗：开在「弧自身归一化前的原值」上(与 arc 同源的坐标差,
        未经 norm180)。|Δ| < 107.5 即显示;跨 0°白羊的折返配置(|Δ|>180)自然落
        窗外。此前以黄经差近似(分 EPS/正负三支),在折返区与符号边界各错一批;
        换成弧的 pre-norm 原值后 540 例全部 215,014 个判定逐位一致,且三支
        坍缩为单一对称窗,EPS 子句冗余消除。"""
        return abs(float(raw_arc_delta)) < CORE_PD_DISPLAY_WINDOW

    def _pdChartClonePayload(self, obj):
        if isinstance(obj, dict):
            payload = copy.deepcopy(obj)
        else:
            payload = copy.deepcopy(getattr(obj, '__dict__', {}))
        if 'id' not in payload and hasattr(obj, 'id'):
            payload['id'] = obj.id
        if 'type' not in payload and hasattr(obj, 'type'):
            payload['type'] = obj.type
        return payload

    def _pdChartNormalizeLon(self, lon, jd):
        value = angle.norm(float(lon))
        if getattr(self.perchart, 'zodiacal', const.TROPICAL) == const.SIDEREAL:
            try:
                value = angle.norm(value - float(swisseph.get_ayanamsa_ut(float(jd))))
            except Exception:
                return value
        return value

    def _pdChartEqCoords(self, lon, lat, obliquity):
        eq = swisseph.cotrans([float(lon), float(lat), 1.0], -float(obliquity))
        return float(eq[0]), float(eq[1])

    def _pdChartEqToEcl(self, ra, decl, obliquity):
        ecl = swisseph.cotrans([float(ra), float(decl), 1.0], float(obliquity))
        return float(ecl[0]), float(ecl[1])

    def _pdChartPointEqCoords(self, point, obliquity):
        ra = point.get('ra')
        decl = point.get('decl')
        if ra is not None and decl is not None:
            return float(ra), float(decl)
        lon = point.get('lon')
        lat = point.get('lat', 0.0)
        if lon is None:
            return None, None
        return self._pdChartEqCoords(lon, lat, obliquity)

    def _pdChartSetLonLat(self, payload, lon, lat, ra=None, decl=None, jd=None):
        value = self._pdChartNormalizeLon(lon, jd if jd is not None else self.perchart.chart.date.jd)
        payload['lon'] = value
        payload['lat'] = float(lat)
        if ra is not None:
            payload['ra'] = float(ra) % 360.0
        if decl is not None:
            payload['decl'] = float(decl)
        payload['sign'] = const.LIST_SIGNS[int(value / 30.0) % 12]
        payload['signlon'] = value % 30.0
        return payload

    def _pdChartAdjustedBasePoint(self, pd, chart, payload, pd_method):
        point = {
            'id': payload.get('id'),
            'lon': float(payload.get('lon', 0.0)),
            'lat': float(payload.get('lat', 0.0)),
        }
        # 真交点 + ΔT 校准是与方位法无关的盘级修正，须对所有方位法一致施加，
        # 使主限法盘的全部方法与表格同口径(此前误 gate 到 core_alchabitius 致非核方法盘缺修正)。
        base_id = self._baseDirectionObjectId(point.get('id'))
        if base_id in [const.NORTH_NODE, const.SOUTH_NODE]:
            node_lons = self._coreTrueNodeBaseLons(chart)
            lon = node_lons.get(base_id)
            if lon is not None:
                point['lon'] = float(lon)
                point['lat'] = 0.0

        # 月亮回 apparent（弃 TRUEPOS hack，与表格统一）。ΔT 校准：未来盘本命位置
        # 平移到参考 ΔT，与表格同一历表；角(RAMC/Asc/MC)走 UT 不动。
        _dt = self._corePdDeltaTPointMap(chart)
        if _dt:
            point = self._coreShiftPointByDeltaT(point, _dt)
        return point

    def _pdChartProjectPoint(self, pd, chart, payload, arc, obliquity, pd_method):
        point = self._pdChartAdjustedBasePoint(pd, chart, payload, pd_method)
        ra, decl = self._pdChartPointEqCoords(point, obliquity)
        if ra is None or decl is None:
            return payload
        directed_ra = angle.norm(float(ra) + float(arc))
        lon, lat = self._pdChartEqToEcl(directed_ra, decl, obliquity)
        return self._pdChartSetLonLat(payload, lon, lat, ra=directed_ra, decl=decl, jd=chart.date.jd)

    def _pdChartHouseSystem(self, pd_method):
        """解析主限法盘所用宫制:定局 frame 维单独决定(_PD_FRAME_HSYS);
        frame=None/未映射回退本命盘宫制(equal_hour_circle 已映 Meridian)。带双重兜底防越界。
        旧 pd_method 入参保留兼容:resolved frame 恒优先(旧值经 _PD_METHOD_TO_PAIR
        推导后与 _PD_CHART_METHOD_HSYS 逐键等价,盘面零回归)。"""
        _proj, frame = self._pdResolveProjectionFrame()
        hsys = _PD_FRAME_HSYS.get(frame) if frame else None
        if hsys is None:
            method = '{0}'.format(pd_method if pd_method is not None else 'core_alchabitius')
            hsys = _PD_CHART_METHOD_HSYS.get(method)
        if hsys is None:
            hsys = self.perchart.house
        if hsys not in swe.SWE_HOUSESYS:
            hsys = self.perchart.house
        return hsys

    def _pdChartBuildAnglesAndHouses(self, chart, arc, obliquity, pd_method=None):
        lat = self._coreParseCoord(getattr(self.perchart, 'lat', 0.0))
        lon = self._coreParseCoord(getattr(self.perchart, 'lon', 0.0))
        flag = 0
        if getattr(self.perchart, 'zodiacal', const.TROPICAL) == const.SIDEREAL:
            flag = swisseph.FLG_SIDEREAL
        hsys_const = self._pdChartHouseSystem(pd_method)
        swhsys = swe.SWE_HOUSESYS[hsys_const]
        try:
            _, ascmc, _, _ = swisseph.houses_ex2(chart.date.jd, lat, lon, swhsys, flag)
        except swisseph.Error:
            # 极圈内象限制无解 → ascmc 与分宫制无关,用 b'W' 安全取得(常规纬度不走此路径)。
            _, ascmc, _, _ = swisseph.houses_ex2(chart.date.jd, lat, lon, b'W', flag)
        armc = angle.norm(float(ascmc[2]) + float(arc))
        dir_code = swhsys
        try:
            hlist, dir_ascmc = swisseph.houses_armc(armc, lat, float(obliquity), swhsys)
        except swisseph.Error:
            # 同上:盘面宫顶在极圈对象限制回退 Porphyry(与 flatlib sweHouses 兜底口径一致)。
            dir_code = b'O'
            hlist, dir_ascmc = swisseph.houses_armc(armc, lat, float(obliquity), b'O')
        # 极圈内天顶口径与本命盘同源:MC 恒取子午线上中天交点(纬度 < 65° 逐位不变)。
        dir_ascmc, _ = swe.upperMeridianAscmc(
            lambda c: swisseph.houses_armc(armc, lat, float(obliquity), c), dir_code, dir_ascmc, lat)
        hlist = tuple(hlist) + (hlist[0],)
        houses = []
        for i in range(12):
            house_lon = self._pdChartNormalizeLon(hlist[i], chart.date.jd)
            next_lon = self._pdChartNormalizeLon(hlist[i + 1], chart.date.jd)
            ra, decl = self._pdChartEqCoords(hlist[i], 0.0, obliquity)
            houses.append({
                'hsys': hsys_const,
                'id': const.LIST_HOUSES[i],
                'lon': house_lon,
                'size': angle.distance(house_lon, next_lon),
                'ra': float(ra),
                'decl': float(decl),
                'sign': const.LIST_SIGNS[int(house_lon / 30.0) % 12],
                'signlon': house_lon % 30.0,
            })

        asc_lon = self._pdChartNormalizeLon(dir_ascmc[0], chart.date.jd)
        mc_lon = self._pdChartNormalizeLon(dir_ascmc[1], chart.date.jd)
        desc_lon = angle.norm(asc_lon + 180.0)
        ic_lon = angle.norm(mc_lon + 180.0)
        # ASC/DESC/MC/IC 皆位于黄道（黄纬=0），赤经赤纬一律按各自黄经真算，与上面 houses 口径完全一致。
        # 原 asc_lat 误用 cotrans 把地理纬度当作黄纬代入，致四角赤纬越界（如 43°，超过黄赤交角物理不可能）；
        # 且原 ASC 赤经直取 dir_ascmc[4]（equatorial ascendant，非黄道升点赤经）亦口径不符——一并归正。
        ang_lat = 0.0
        asc_ra, asc_decl = self._pdChartEqCoords(asc_lon, ang_lat, obliquity)
        asc = self._pdChartSetLonLat({'id': const.ASC, 'type': 'Generic'}, asc_lon, ang_lat, ra=asc_ra, decl=asc_decl, jd=chart.date.jd)
        desc_ra, desc_decl = self._pdChartEqCoords(desc_lon, ang_lat, obliquity)
        desc = self._pdChartSetLonLat({'id': const.DESC, 'type': 'Generic'}, desc_lon, ang_lat, ra=desc_ra, decl=desc_decl, jd=chart.date.jd)
        mc_ra, mc_decl = self._pdChartEqCoords(mc_lon, ang_lat, obliquity)
        mc = self._pdChartSetLonLat({'id': const.MC, 'type': 'Generic'}, mc_lon, ang_lat, ra=mc_ra, decl=mc_decl, jd=chart.date.jd)
        ic_ra, ic_decl = self._pdChartEqCoords(ic_lon, ang_lat, obliquity)
        ic = self._pdChartSetLonLat({'id': const.IC, 'type': 'Generic'}, ic_lon, ang_lat, ra=ic_ra, decl=ic_decl, jd=chart.date.jd)
        angles = {
            const.ASC: asc,
            const.DESC: desc,
            const.MC: mc,
            const.IC: ic,
        }
        return houses, angles

    def getPrimaryDirectionChartByDate(self, datetime_text, zone=None, converse=False):
        zone = zone if zone is not None else self.perchart.zone
        parts = '{0}'.format(datetime_text if datetime_text is not None else '').split(' ')
        if len(parts) == 0 or parts[0] == '':
            return {'err': 'param error'}
        date = helper.getChartDate(parts[0])
        tm = parts[1] if len(parts) > 1 else '00:00:00'
        current_dt = Datetime(date, tm, zone)
        chart = self.perchart.getChart()
        asc = chart.get(const.ASC)
        asctime = SignAscTime(self.perchart.date, self.perchart.time, asc.sign, self.perchart.lat, self.perchart.zone,
                              year_days=getattr(self.perchart, 'pdYearDays', 0))
        current_arc = asctime.getPDArcFromDate(current_dt)
        # 度数换算:与表格共用 _pdTimeKeyConverter(年→弧,与表格的弧→年互逆;Ptolemy 乘 1.0 字节级不变)。
        _years_of_arc, _arc_of_years = self._pdTimeKeyConverter(chart)
        current_arc = float(_arc_of_years(float(current_arc), bool(converse)))
        # 向运方向：direct=随时间逆时针(默认现状)；converse=按时间反向(顺时针)推进，即弧反号。
        directed_arc = -current_arc if converse else current_arc
        # 统一用当日 mean 黄赤交角（与表格口径一致；弃非 core 旧固定 23.44）。
        obliquity = self._coreMeanObliquity(chart)

        pd = PrimaryDirections(chart)
        houses, angle_map = self._pdChartBuildAnglesAndHouses(
            chart, directed_arc, obliquity,
            pd_method=getattr(self.perchart, 'pdMethod', 'core_alchabitius'),
        )

        directed_objects = []
        for obj in self.perchart.getChartObj()['objects']:
            payload = self._pdChartClonePayload(obj)
            obj_id = payload.get('id')
            if obj_id in angle_map:
                directed_objects.append(copy.deepcopy(angle_map[obj_id]))
                continue
            directed_objects.append(
                self._pdChartProjectPoint(
                    pd,
                    chart,
                    payload,
                    directed_arc,
                    obliquity,
                    getattr(self.perchart, 'pdMethod', 'core_alchabitius'),
                )
            )

        directed_lots = []
        for obj in self.perchart.getPars(chart):
            payload = self._pdChartClonePayload(obj)
            directed_lots.append(
                self._pdChartProjectPoint(
                    pd,
                    chart,
                    payload,
                    directed_arc,
                    obliquity,
                    getattr(self.perchart, 'pdMethod', 'core_alchabitius'),
                )
            )

        directed_objects.sort(key=lambda item: float(item.get('lon', 0.0)))
        directed_lots.sort(key=lambda item: float(item.get('lon', 0.0)))
        houses.sort(key=lambda item: float(item.get('lon', 0.0)))
        return {
            'date': current_dt.toCNString(),
            'arc': float(current_arc),
            'converse': bool(converse),
            'pos': {
                'lat': self._coreParseCoord(getattr(self.perchart, 'lat', 0.0)),
                'lon': self._coreParseCoord(getattr(self.perchart, 'lon', 0.0)),
            },
            'chart': {
                'objects': directed_objects,
                'houses': houses,
                'isDiurnal': self.perchart.isDiurnal,
            },
            'lots': directed_lots,
        }

    def getPrimaryDirectionByZCoreKernel(self):
        """
        Core-aligned In Zodiaco kernel:
            arc = norm180(RA(sig, true_lat) - RA(promissor_aspected, zero_lat))

        Notes:
        - keeps direct + converse (positive/negative arc)
        - keeps original promissor/significator ID encoding for UI compatibility
        - keeps |arc| <= 100 to match existing age horizon
        """
        chart = self.perchart.getChart()
        pd = PrimaryDirections(chart)
        aspList = self.perchart.pdaspects

        # Significators
        sig_objs = pd._elements(CORE_PD_SIGNIFICATOR_IDS, pd.N, [0])
        sig_houses = pd._elements(pd.SIG_HOUSES, pd.N, [0])
        sig_angles = pd._elements(pd.SIG_ANGLES, pd.N, [0])
        significators = sig_objs + sig_houses + sig_angles

        # Promissors
        promissors = pd._elements(CORE_PD_PROMISSOR_IDS, pd.N, aspList)

        # Core settings use the true node, while flatlib's default north node
        # object is the mean node. Rebuild node-derived rows locally for this branch.
        node_base_lons = self._coreTrueNodeBaseLons(chart)
        significators = [self._rebuildCoreNodePoint(pd, obj, node_base_lons) for obj in significators]
        promissors = [self._rebuildCoreNodePoint(pd, obj, node_base_lons) for obj in promissors]
        # ΔT 校准：未来盘把本体位置平移到参考 ΔT（历史盘 δ≈0 跳过）；角不动。
        _dt_dmap = self._corePdDeltaTPointMap(chart)
        if _dt_dmap:
            significators = [self._coreShiftPointByDeltaT(o, _dt_dmap) for o in significators]
            promissors = [self._coreShiftPointByDeltaT(o, _dt_dmap) for o in promissors]
        significators, promissors = self._pdApplyLatitudeOptions(significators, promissors)
        # 映点(antiscia)/界(terms) 促发星扩展 —— 与 pd_engine build_directions 同口径，
        # 补全 core 方位法(Alcabitius/Meridian/Porphyry/Equal…) 的「映点/界」开关，使其与
        # placidus 族一致可用。均作黄道合相点(lat=0)；本体 lon 取已 node 重建 + ΔT 平移后的 N_*_0。
        _want_anti = bool(getattr(self.perchart, 'pdAntiscia', False))
        _want_terms = bool(getattr(self.perchart, 'pdTerms', False))
        # 赤纬平行/反平行(映点法实现,黄道点;PD_/PC_ 前缀,与映点独立开关)
        _want_par = bool(getattr(self.perchart, 'pdParallel', False))
        if _want_anti or _want_terms or _want_par:
            from astrostudy import pd_engine as _pde
            _base_lons = {}
            for _p in promissors:
                _parts = '{0}'.format(_p.get('id') or '').split('_')
                if len(_parts) == 3 and _parts[0] == 'N' and _parts[2] == '0':
                    _base_lons[_parts[1]] = _p.get('lon')
            _extra = []
            _mirror_specs = []
            if _want_anti:
                _mirror_specs += [(_pde.antiscion, 'A'), (_pde.contra_antiscion, 'C')]
            if _want_par:
                _mirror_specs += [(_pde.antiscion, 'PD'), (_pde.contra_antiscion, 'PC')]
            if _mirror_specs:
                for _bn, _bl in _base_lons.items():
                    if _bl is None:
                        continue
                    for _fn, _pre in _mirror_specs:
                        _extra.append({'id': '{0}_{1}_0'.format(_pre, _bn),
                                       'lon': angle.norm(_fn(float(_bl))), 'lat': 0.0})
            if _want_terms:
                for _ruler, _sign, _tlon in _pde.term_boundaries(getattr(self.perchart, 'termsVariant', 0)):
                    _rname = _pde.TERM_RULER_FULL.get(_ruler, _ruler)
                    _sname = _pde.TERM_SIGN_NAMES[int(_sign) % 12]
                    _extra.append({'id': 'T_{0}_{1}'.format(_rname, _sname),
                                   'lon': angle.norm(float(_tlon)), 'lat': 0.0})
            promissors = promissors + _extra
        # 纯一手球面公式：全程统一用「当日 mean 黄赤交角」(mean equinox of date)，
        # 含 Asc；升点斜升取定义式 OA(Asc)=RAMC+90。不叠加任何拟合修正层。
        core_mean_obliquity = self._coreMeanObliquity(chart)
        geo_lat = self._coreParseCoord(getattr(self.perchart, 'lat', 0.0))
        geo_lon = self._coreParseCoord(getattr(self.perchart, 'lon', 0.0))
        _core_ascmc = _polarSafeHousesEx(chart.date.jd, geo_lat, geo_lon, b'P')[1]
        core_ramc = float(_core_ascmc[2])
        core_asc_oa = angle.norm(core_ramc + 90.0)
        # 宿命点(Vertex)应星:点位取 ascmc[3](作行标识/展示),弧走 _coreVertexArc 闭式。
        core_vertex_lon = angle.norm(float(_core_ascmc[3]))
        significators.append({'id': 'N_{0}_0'.format(CORE_PD_VERTEX_ID),
                              'lon': core_vertex_lon, 'lat': 0.0})
        # S/P 清单扩展(默认 None=零追加,字节零回归)
        significators.extend(self._pdExtraSignificatorPoints(chart))
        promissors.extend(self._pdExtraCuspPromissorPoints(chart, aspects=aspList))

        max_arc = float(getattr(self.perchart, 'pdYears', 100) or 100)
        eps = 1e-12
        pdlist = []
        for prom in promissors:
            prom_id = prom.get('id')
            prom_ra_z, _ = self._corePointEqCoords(prom, core_mean_obliquity, zero_lat=True)
            if prom_id is None or prom_ra_z is None:
                continue
            for sig in significators:
                sig_id = sig.get('id')
                if prom_id == sig_id:
                    continue
                if self._baseDirectionObjectId(prom_id) == self._baseDirectionObjectId(sig_id):
                    continue
                if sig_id is None:
                    continue

                sig_base = self._baseDirectionObjectId(sig_id)
                # 纯公式：迫星按本命视位置原样取用，不施任何拟合修正。
                prom_for_arc = prom
                raw_arc_delta = None  # 仅普通体分支赋值;窗口只对行星对触发(必经该分支)
                if sig_base == const.ASC:
                    prom_oa_z = self._coreObliqueAscension(prom_for_arc, pd.lat, core_mean_obliquity, zero_lat=True)
                    if prom_oa_z is None:
                        continue
                    # 升点斜升取定义式 OA(Asc)=RAMC+90；迫星 OA 用 mean ε。
                    arc = self._norm180(float(prom_oa_z) - core_asc_oa)
                elif sig_base == const.MC:
                    sig_ra_z, _ = self._corePointEqCoords(sig, core_mean_obliquity, zero_lat=True)
                    if sig_ra_z is None:
                        continue
                    prom_ra_arc, _ = self._corePointEqCoords(prom_for_arc, core_mean_obliquity, zero_lat=True)
                    if prom_ra_arc is None:
                        continue
                    arc = self._norm180(float(prom_ra_arc) - float(sig_ra_z))
                elif sig_base == const.PARS_FORTUNA:
                    sig_ra_z, _ = self._corePointEqCoords(sig, core_mean_obliquity, zero_lat=True)
                    if sig_ra_z is None:
                        continue
                    prom_ra_arc, _ = self._corePointEqCoords(prom_for_arc, core_mean_obliquity, zero_lat=True)
                    if prom_ra_arc is None:
                        continue
                    # The current compatibility dataset exposes Pars Fortuna as
                    # object id 100. It receives the same virtual-row promissor
                    # correction layer, but its sign follows the ordinary
                    # zodiacal kernel.
                    arc = self._norm180(float(sig_ra_z) - float(prom_ra_arc))
                elif sig_base == CORE_PD_VERTEX_ID:
                    arc = self._coreVertexArc(prom_for_arc, geo_lat, core_ramc,
                                              core_mean_obliquity, zero_lat=True)
                    if arc is None:
                        continue
                elif sig_base == const.DESC:
                    # 到 DSC:斜降 OD 差(全派一致的轴闭式)
                    _rd = self._corePointEqCoords(prom_for_arc, core_mean_obliquity, zero_lat=True)
                    if not _rd or _rd[0] is None:
                        continue
                    _t = math.tan(math.radians(geo_lat)) * math.tan(math.radians(float(_rd[1] or 0.0)))
                    if abs(_t) >= 1.0:
                        continue
                    _od = float(_rd[0]) + math.degrees(math.asin(_t))
                    arc = self._norm180(_od - (core_ramc - 90.0))
                elif sig_base == const.IC:
                    # 到 IC:赤经差
                    _rd = self._corePointEqCoords(prom_for_arc, core_mean_obliquity, zero_lat=True)
                    if not _rd or _rd[0] is None:
                        continue
                    arc = self._norm180(float(_rd[0]) - (core_ramc + 180.0))
                else:
                    sig_ra, _ = self._corePointEqCoords(sig, core_mean_obliquity, zero_lat=False)
                    if sig_ra is None:
                        continue
                    prom_ra_arc, _ = self._corePointEqCoords(prom_for_arc, core_mean_obliquity, zero_lat=True)
                    if prom_ra_arc is None:
                        continue
                    # 显示窗用弧的 pre-norm 原值(norm180 前的 RA 差);行星对仅出于此分支。
                    raw_arc_delta = float(sig_ra) - float(prom_ra_arc)
                    arc = self._norm180(raw_arc_delta)
                if abs(arc) <= eps:
                    continue
                if abs(arc) > max_arc:
                    continue
                if max_arc <= 180.0 and self._isCorePlanetPair(prom_id, sig_id):
                    if not self._passesCoreDisplayWindow(raw_arc_delta):
                        continue
                pdlist.append([arc, prom_id, sig_id, 'Z'])

        # 整圈复发/互补统一扩展(180+ 互补行 + 多圈直达 3000 年上限),见 _extendCorePdRecurrences。
        pdlist = self._extendCorePdRecurrences(pdlist, max_arc)
        # 顺/逆按弧符号筛：顺=正弧、逆=负弧（已用参考 dir/conv 分档批坐实）。
        # 两者皆开=参考默认(全留)；皆关=回退顺向。
        want_direct = getattr(self.perchart, 'pdDirect', True)
        want_direct = True if want_direct is None else bool(want_direct)
        want_converse = bool(getattr(self.perchart, 'pdConverse', True))
        if not want_direct and not want_converse:
            want_direct = True
        if not (want_direct and want_converse):
            pdlist = [it for it in pdlist
                      if (it[0] > 0 and want_direct) or (it[0] < 0 and want_converse)]
        pdlist.sort(key=lambda item: (abs(item[0]), item[0], item[1], item[2]))
        return pdlist

    def getPrimaryDirectionByZAlongEcliptic(self):
        """Along-Ecliptic 方位法(In Zodiaco)。强制 In Zodiaco。
        - 本体应星(行星/交点/福点):迫星本体沿黄道行至应星的相位点,
          arc = norm180(λ_sig − (λ_prom ∓ asp)) —— 相位取在应星一侧,故与迫星侧的
          D/S 相位点互为镜像(D_x_a 用 λ_x + a,S_x_a 用 λ_x − a;合/冲不变)。
        - 轴应星(ASC/MC/Vertex/DSC/IC):轴不沿黄道走,只随周日旋转移动,
          弧 = 把该轴转到迫星相位点所需的赤经转角,即与核心法同一组轴闭式,直接复用核心核的轴行。"""
        _ANGLE_SIGS = (const.ASC, const.MC, const.DESC, const.IC, CORE_PD_VERTEX_ID)
        core_rows = self.getPrimaryDirectionByZCoreKernel()
        angle_rows = [it for it in core_rows
                      if self._baseDirectionObjectId(it[2]) in _ANGLE_SIGS]
        chart = self.perchart.getChart()
        pd = PrimaryDirections(chart)
        aspList = self.perchart.pdaspects
        sig_objs = pd._elements(CORE_PD_SIGNIFICATOR_IDS, pd.N, [0])
        sig_houses = pd._elements(pd.SIG_HOUSES, pd.N, [0])
        sig_angles = pd._elements(pd.SIG_ANGLES, pd.N, [0])
        significators = sig_objs + sig_houses + sig_angles
        promissors = pd._elements(CORE_PD_PROMISSOR_IDS, pd.N, aspList)
        node_base_lons = self._coreTrueNodeBaseLons(chart)
        significators = [self._rebuildCoreNodePoint(pd, obj, node_base_lons) for obj in significators]
        promissors = [self._rebuildCoreNodePoint(pd, obj, node_base_lons) for obj in promissors]
        _dt = self._corePdDeltaTPointMap(chart)
        if _dt:
            significators = [self._coreShiftPointByDeltaT(o, _dt) for o in significators]
            promissors = [self._coreShiftPointByDeltaT(o, _dt) for o in promissors]
        significators, promissors = self._pdApplyLatitudeOptions(significators, promissors)
        promissors.extend(self._corePdMirrorTermPromissors(promissors))
        significators.extend(o for o in self._pdExtraSignificatorPoints(chart)
                             if self._baseDirectionObjectId(o.get('id')) not in _ANGLE_SIGS)
        promissors.extend(self._pdExtraCuspPromissorPoints(chart, aspects=aspList))
        max_arc = float(getattr(self.perchart, 'pdYears', 100) or 100)
        tiny = 1e-12
        pdlist = []
        base_lons = {}
        for prom in promissors:
            _parts = '{0}'.format(prom.get('id') or '').split('_')
            if len(_parts) == 3 and _parts[0] == 'N' and _parts[2] == '0' and prom.get('lon') is not None:
                base_lons[_parts[1]] = float(prom['lon'])
        for prom in promissors:
            prom_id = prom.get('id')
            plon = prom.get('lon')
            if prom_id is None or plon is None:
                continue
            # 相位取在应星一侧 ⇔ 迫星侧相位点镜像:D(λ−a)→λ+a、S(λ+a)→λ−a。
            # 相位点不归一(λ取 [0,360) 后直接 ± a):行星对显示窗判在这个原差上,归一后跨 0° 会误杀。
            # 冲:λ+180 与 λ−180 两个原值里落窗的那一支。
            _parts = '{0}'.format(prom_id).split('_')
            targets = [float(plon)]
            _base = base_lons.get(self._baseDirectionObjectId(prom_id))
            if len(_parts) >= 3 and _base is not None:
                try:
                    _a = abs(float(_parts[-1]))
                except ValueError:
                    _a = None
                if _a is not None and _parts[0] == 'D':
                    targets = [_base + _a]
                elif _a is not None and _parts[0] == 'S':
                    targets = [_base - _a]
                elif _a is not None and _parts[0] == 'N' and abs(_a - 180.0) < 1e-9:
                    targets = [_base + 180.0, _base - 180.0]
            for sig in significators:
                sig_id = sig.get('id')
                if sig_id is None or prom_id == sig_id:
                    continue
                if self._baseDirectionObjectId(sig_id) in _ANGLE_SIGS:
                    continue
                if self._baseDirectionObjectId(prom_id) == self._baseDirectionObjectId(sig_id):
                    continue
                slon = sig.get('lon')
                if slon is None:
                    continue
                raws = [float(slon) - t for t in targets]
                raw_arc_delta = raws[0]
                if len(raws) > 1:
                    raw_arc_delta = min(raws, key=abs)
                arc = self._norm180(raw_arc_delta)
                if abs(arc) <= tiny or abs(arc) > max_arc:
                    continue
                if max_arc <= 180.0 and self._isCorePlanetPair(prom_id, sig_id):
                    # 本法弧=黄经差,窗用其 pre-norm 原值(与核同口径:弧自身归一化前的量)。
                    if not self._passesCoreDisplayWindow(raw_arc_delta):
                        continue
                pdlist.append([arc, prom_id, sig_id, 'Z'])
        pdlist = self._extendCorePdRecurrences(pdlist, max_arc)
        pdlist = pdlist + angle_rows
        want_direct = getattr(self.perchart, 'pdDirect', True)
        want_direct = True if want_direct is None else bool(want_direct)
        want_converse = bool(getattr(self.perchart, 'pdConverse', True))
        if not want_direct and not want_converse:
            want_direct = True
        if not (want_direct and want_converse):
            pdlist = [it for it in pdlist
                      if (it[0] > 0 and want_direct) or (it[0] < 0 and want_converse)]
        pdlist.sort(key=lambda item: (abs(item[0]), item[0], item[1], item[2]))
        return pdlist

    def getPrimaryDirectionByZEdmundJones(self):
        """Edmund Jones(In Zodiaco)。每个 (迫星, 应星, 相位 θ≥0) 只出一行,相位点 Q = (λ迫 − θ, β=0):
        - 赤经式 B = |RA应 − RA_Q − θ|(合相即 |RA应 − RA迫|,冲与合同值);
        - 半弧式 C = Q 沿自身周日圈被带到应星本命位置的半弧法弧(应星带真黄纬为目标,见 pd_semiarc_pole);
        θ≠0 且 |C| 在年龄窗内 → 出半弧行(相位记右旋 D_*),否则出赤经行(相位记左旋 S_*);冲两支同记 N_*_180。
        行标的左右只表示用了哪个式子,不是相位侧:相位侧选「只出左旋」时改为按真正的左旋相位点 Q = λ迫 + θ
        一律用赤经式 |RA应 − RA_Q + θ|;「只出右旋」= 上面的半弧行 + 冲。
        弧取绝对值、不分方向,顺 / 逆勾选对本法不起作用(否则「只出逆向」时整表几乎为空)。
        轴应星(ASC/MC/Vertex/DSC/IC)沿用核心核的周日旋转弧。取点(真交点重建、ΔT 平移、扩展点)与核心核同口径。"""
        from astrostudy import pd_semiarc_pole as _sp
        _ANGLE_SIGS = (const.ASC, const.MC, const.DESC, const.IC, CORE_PD_VERTEX_ID)
        # 顺 / 逆勾选对本法不起作用:轴行借核心核时临时两向都出
        pc = self.perchart
        saved = (getattr(pc, 'pdDirect', True), getattr(pc, 'pdConverse', True))
        pc.pdDirect, pc.pdConverse = True, True
        try:
            angle_rows = [it for it in self.getPrimaryDirectionByZCoreKernel()
                          if self._baseDirectionObjectId(it[2]) in _ANGLE_SIGS]
        finally:
            pc.pdDirect, pc.pdConverse = saved
        chart = self.perchart.getChart()
        pd = PrimaryDirections(chart)
        aspList = self.perchart.pdaspects
        sig_objs = pd._elements(CORE_PD_SIGNIFICATOR_IDS, pd.N, [0])
        sinister = (getattr(self.perchart, 'pdAspectSide', 0) or 0) == 2
        drop = 'D_' if sinister else 'S_'
        promissors = [o for o in pd._elements(CORE_PD_PROMISSOR_IDS, pd.N, aspList)
                      if not '{0}'.format(o.get('id') or '').startswith(drop)]
        node_base_lons = self._coreTrueNodeBaseLons(chart)
        significators = [self._rebuildCoreNodePoint(pd, obj, node_base_lons) for obj in sig_objs]
        promissors = [self._rebuildCoreNodePoint(pd, obj, node_base_lons) for obj in promissors]
        _dt_dmap = self._corePdDeltaTPointMap(chart)
        if _dt_dmap:
            significators = [self._coreShiftPointByDeltaT(o, _dt_dmap) for o in significators]
            promissors = [self._coreShiftPointByDeltaT(o, _dt_dmap) for o in promissors]
        significators, promissors = self._pdApplyLatitudeOptions(significators, promissors)
        promissors.extend(self._corePdMirrorTermPromissors(promissors))
        significators.extend(self._pdExtraSignificatorPoints(chart))
        # Edmund Jones 每个 (迫星, 应星, θ) 只出一行:恒星相位点同样只取右旋点
        promissors.extend(o for o in self._pdExtraCuspPromissorPoints(chart, aspects=aspList)
                          if not '{0}'.format(o.get('id') or '').startswith(drop))
        eps_mean = self._coreMeanObliquity(chart)
        geo_lat = self._coreParseCoord(getattr(self.perchart, 'lat', 0.0))
        geo_lon = self._coreParseCoord(getattr(self.perchart, 'lon', 0.0))
        ramc = float(_polarSafeHousesEx(chart.date.jd, geo_lat, geo_lon, b'P')[1][2])
        max_arc = float(getattr(self.perchart, 'pdYears', 100) or 100)
        tiny = 1e-12
        pdlist = []
        for prom in promissors:
            prom_id = prom.get('id')
            ra_q, decl_q = self._corePointEqCoords(prom, eps_mean, zero_lat=True)
            if prom_id is None or ra_q is None:
                continue
            parts = '{0}'.format(prom_id).split('_')
            theta = 0.0
            if len(parts) >= 3 and parts[0] in ('N', 'D', 'S'):
                try:
                    theta = abs(float(parts[-1]))
                except ValueError:
                    theta = 0.0
            body = self._baseDirectionObjectId(prom_id)
            true_sinister = sinister   # 只出左旋:左旋相位点、合、冲一律用赤经式
            for sig in significators:
                sig_id = sig.get('id')
                if sig_id is None or prom_id == sig_id:
                    continue
                if self._baseDirectionObjectId(sig_id) in _ANGLE_SIGS:
                    continue
                if body == self._baseDirectionObjectId(sig_id):
                    continue
                ra_s, decl_s = self._corePointEqCoords(sig, eps_mean, zero_lat=False)
                if ra_s is None:
                    continue
                if true_sinister:
                    # 真正的左旋相位点 Q = λ迫 + θ(合 / 冲亦同):赤经式,不取半弧式
                    arc = abs(self._norm180(float(ra_s) - float(ra_q) + theta))
                    if abs(arc) <= tiny or abs(arc) >= max_arc:
                        continue
                    pdlist.append([arc, prom_id, sig_id, 'Z'])
                    continue
                arc = abs(self._norm180(float(ra_s) - float(ra_q) - theta))
                row_id = 'S_%s_%s' % (body, parts[-1]) if parts[0] == 'D' else prom_id
                if theta > 0.0:
                    c = self._pdGeometry().semiarc_arc(float(ra_s), float(decl_s), float(ra_q), float(decl_q), ramc, geo_lat)
                    if c is not None and abs(c) < max_arc:
                        arc, row_id = c, prom_id
                if abs(arc) <= tiny or abs(arc) >= max_arc:
                    continue
                pdlist.append([arc, row_id, sig_id, 'Z'])
        pdlist = self._extendCorePdRecurrences(pdlist, max_arc) + angle_rows
        # 弧取绝对值、不分方向:顺 / 逆勾选对本法不起作用
        pdlist.sort(key=lambda item: (abs(item[0]), item[0], item[1], item[2]))
        return pdlist

    @staticmethod
    def _coreWorldLongitude(ra, dec, ramc, phi):
        """世界经度 W:MC=0 / ASC=90 / IC=180 / DSC=270,按昼/夜半弧线性。
        纯一手球面公式;拱极(|tanφ·tanδ|≥1 致半弧退化)返回 None(跳过纪律)。"""
        t = math.tan(math.radians(phi)) * math.tan(math.radians(dec))
        if abs(t) >= 1.0:
            return None
        ad = math.degrees(math.asin(t))
        sda = 90.0 + ad
        sna = 90.0 - ad
        if sda <= 1e-9 or sna <= 1e-9:
            return None
        # 方向标定:升点 umd=+SDA(东)→W=90;中天 0;落点 umd=−SDA→W=270;IC=180。
        umd = PerPredict._norm180_static(ra - ramc)
        if abs(umd) <= sda:
            return angle.norm(90.0 * umd / sda)
        lmd = PerPredict._norm180_static(ra - ramc - 180.0)
        return angle.norm(180.0 + 90.0 * lmd / sna)

    @staticmethod
    def _norm180_static(x):
        x = x % 360.0
        if x > 180.0:
            x -= 360.0
        return x

    def getPrimaryDirectionByMCoreKernel(self):
        """In Mundo 纯公式核（自研一手口径，基线版）：arc = norm180(RA(prom,真β) − RA(sig,真β))。
        两体均保留真黄纬(不忽略迫/应星黄纬)；**应星地平上 + 合相(asp=0)** 已逐位精确。
        【已知未竟】① 非合相为**世俗相位**(房屋空间，非黄经)，此基线按黄经近似=错；
        ② 应星地平下另有逐盘修正(确切式经穷尽独立解析仍未竟)。两者留后续数值标定收口；
        本路径价值=已接 ΔT/mean ε + 顺逆开关 + 上半合相逐位，结构正确、为最终式打底。"""
        chart = self.perchart.getChart()
        pd = PrimaryDirections(chart)
        aspList = self.perchart.pdaspects
        sig_objs = pd._elements(CORE_PD_SIGNIFICATOR_IDS, pd.N, [0])
        sig_houses = pd._elements(pd.SIG_HOUSES, pd.N, [0])
        sig_angles = pd._elements(pd.SIG_ANGLES, pd.N, [0])
        significators = sig_objs + sig_houses + sig_angles
        promissors = pd._elements(CORE_PD_PROMISSOR_IDS, pd.N, aspList)
        node_base_lons = self._coreTrueNodeBaseLons(chart)
        significators = [self._rebuildCoreNodePoint(pd, obj, node_base_lons) for obj in significators]
        promissors = [self._rebuildCoreNodePoint(pd, obj, node_base_lons) for obj in promissors]
        _dt = self._corePdDeltaTPointMap(chart)
        if _dt:
            significators = [self._coreShiftPointByDeltaT(o, _dt) for o in significators]
            promissors = [self._coreShiftPointByDeltaT(o, _dt) for o in promissors]
        significators, promissors = self._pdApplyLatitudeOptions(significators, promissors)
        # 映点/界 促发星扩展(与 In-Zodiaco 核同口径,补全 In-Mundo 核的开关)。
        _want_anti = bool(getattr(self.perchart, 'pdAntiscia', False))
        _want_terms = bool(getattr(self.perchart, 'pdTerms', False))
        # 赤纬平行/反平行(映点法实现,黄道点;PD_/PC_ 前缀,与映点独立开关)
        _want_par = bool(getattr(self.perchart, 'pdParallel', False))
        if _want_anti or _want_terms or _want_par:
            from astrostudy import pd_engine as _pde
            _base_lons = {}
            for _p in promissors:
                _parts = '{0}'.format(_p.get('id') or '').split('_')
                if len(_parts) == 3 and _parts[0] == 'N' and _parts[2] == '0':
                    _base_lons[_parts[1]] = _p.get('lon')
            _extra = []
            _mirror_specs = []
            if _want_anti:
                _mirror_specs += [(_pde.antiscion, 'A'), (_pde.contra_antiscion, 'C')]
            if _want_par:
                _mirror_specs += [(_pde.antiscion, 'PD'), (_pde.contra_antiscion, 'PC')]
            if _mirror_specs:
                for _bn, _bl in _base_lons.items():
                    if _bl is None:
                        continue
                    for _fn, _pre in _mirror_specs:
                        _extra.append({'id': '{0}_{1}_0'.format(_pre, _bn),
                                       'lon': angle.norm(_fn(float(_bl))), 'lat': 0.0})
            if _want_terms:
                for _ruler, _sign, _tlon in _pde.term_boundaries(getattr(self.perchart, 'termsVariant', 0)):
                    _rname = _pde.TERM_RULER_FULL.get(_ruler, _ruler)
                    _sname = _pde.TERM_SIGN_NAMES[int(_sign) % 12]
                    _extra.append({'id': 'T_{0}_{1}'.format(_rname, _sname),
                                   'lon': angle.norm(float(_tlon)), 'lat': 0.0})
            promissors = promissors + _extra
        eps = self._coreMeanObliquity(chart)
        # 宿命点(Vertex)应星:世界经度口径下走通用公式(点位 ascmc[3],β=0)。
        _geo_lat = self._coreParseCoord(getattr(self.perchart, 'lat', 0.0))
        _geo_lon = self._coreParseCoord(getattr(self.perchart, 'lon', 0.0))
        _m_ascmc = _polarSafeHousesEx(chart.date.jd, _geo_lat, _geo_lon, b'P')[1]
        significators.append({'id': 'N_{0}_0'.format(CORE_PD_VERTEX_ID),
                              'lon': angle.norm(float(_m_ascmc[3])), 'lat': 0.0})
        significators.extend(self._pdExtraSignificatorPoints(chart))
        promissors.extend(self._pdExtraCuspPromissorPoints(chart, aspects=aspList))
        core_ramc_m = float(_m_ascmc[2])
        max_arc = float(getattr(self.perchart, 'pdYears', 100) or 100)
        tiny = 1e-12
        pdlist = []
        # 世界经度统一口径:S、P 都换算成世界经度(MC=0/ASC=90/IC=180/DSC=270,
        # 按昼/夜半弧线性);世界相位 = 世界经度差 ∈ {0,60,90,120,180}。
        # 相位射线(D_/S_)不再用黄道偏移点(旧基线近似)——目标 = W_S ± asp,P 用本体真β;
        # 其余(N_/A_/C_/PD_/PC_/T_)为世界合相:目标 = W_S,P 用该点坐标。
        from astrostudy.pd_engine import _find_roots as _pd_find_roots
        phi_m = self._coreParseCoord(getattr(self.perchart, 'lat', 0.0))
        span_m = min(179.0, max_arc + 10.0)
        base_eq = {}
        for _p in promissors:
            _parts = '{0}'.format(_p.get('id') or '').split('_')
            if len(_parts) == 3 and _parts[0] == 'N' and _parts[2] == '0':
                _rd = self._corePointEqCoords(_p, eps, zero_lat=False)
                if _rd and _rd[0] is not None:
                    base_eq[_parts[1]] = _rd
        sig_world = {}
        for sig in significators:
            sig_id = sig.get('id')
            if sig_id is None:
                continue
            _rd = self._corePointEqCoords(sig, eps, zero_lat=False)
            if not _rd or _rd[0] is None:
                continue
            w = self._coreWorldLongitude(float(_rd[0]), float(_rd[1] or 0.0), core_ramc_m, phi_m)
            if w is not None:
                sig_world[sig_id] = w
        for prom in promissors:
            prom_id = prom.get('id')
            if prom_id is None:
                continue
            parts = '{0}'.format(prom_id).split('_')
            prefix = parts[0] if parts else ''
            body = parts[1] if len(parts) >= 2 else ''
            try:
                asp_off = float(parts[2]) if len(parts) >= 3 else 0.0
            except (TypeError, ValueError):
                asp_off = 0.0
            if abs(asp_off) > 1e-9:
                # 世界相位:P 用本体真β;冲(180)走 N 前缀单点,60/90/120 走 D/S 双侧
                eqc = base_eq.get(body)
                target_off = -asp_off if prefix == 'S' else asp_off
            else:
                eqc = self._corePointEqCoords(prom, eps, zero_lat=False)
                target_off = 0.0                 # 世界合相(含映点/平行/界虚点)
            if not eqc or eqc[0] is None:
                continue
            p_ra, p_dec = float(eqc[0]), float(eqc[1] or 0.0)
            for sig in significators:
                sig_id = sig.get('id')
                if sig_id is None or prom_id == sig_id:
                    continue
                if self._baseDirectionObjectId(prom_id) == self._baseDirectionObjectId(sig_id):
                    continue
                w_s = sig_world.get(sig_id)
                if w_s is None:
                    continue
                target = angle.norm(w_s + target_off)

                def _f(a, _ra=p_ra, _dec=p_dec, _t=target):
                    w = self._coreWorldLongitude(_ra, _dec, angle.norm(core_ramc_m + a), phi_m)
                    if w is None:
                        return 180.0
                    return self._norm180_static(w - _t)

                for arc in _pd_find_roots(_f, span_m, 1.0):
                    if abs(arc) <= tiny or abs(arc) > max_arc:
                        continue
                    pdlist.append([arc, prom_id, sig_id, 'M'])
        # 世界平行 / 急动平行:core 世俗核同口径补全——世界经度(比例半弧)
        # 镜像方程与 pd_engine 族同式,纯公式实现;开关默认关=零回归。轴 sig 不参与。
        _want_mpar = bool(getattr(self.perchart, 'pdParallel', False))
        _want_rapt = bool(getattr(self.perchart, 'pdRaptParallel', False))
        if _want_mpar or _want_rapt:
            _axis_ids = (const.ASC, const.MC, const.DESC, const.IC, CORE_PD_VERTEX_ID)
            _prom_bodies = {}
            for _p in promissors:
                _parts = '{0}'.format(_p.get('id') or '').split('_')
                if len(_parts) == 3 and _parts[0] == 'N' and _parts[2] == '0' and _parts[1] in base_eq:
                    _prom_bodies[_parts[1]] = base_eq[_parts[1]]
            for _sig in significators:
                _sid = _sig.get('id')
                if _sid is None:
                    continue
                _sbase = self._baseDirectionObjectId(_sid)
                if _sbase in _axis_ids:
                    continue
                _w_s0 = sig_world.get(_sid)
                if _w_s0 is None:
                    continue
                _s_eq = self._corePointEqCoords(_sig, eps, zero_lat=False)
                if not _s_eq or _s_eq[0] is None:
                    continue
                for _bn, _beq in _prom_bodies.items():
                    if _bn == _sbase:
                        continue
                    _pra, _pdec = float(_beq[0]), float(_beq[1] or 0.0)
                    # 独立镜像轴只有两条(2·(axis+180)≡2·axis):本域(_coreWorldLongitude,MC=0)
                    # MER 子午轴=0°、HOR 地平轴=90°。🔴 曾列四轴 → 每弧原样双发;行 ID 第三段
                    # 改物理轴名,与 pd_engine 路径统一(那边域 ASC=0,同名不同数,前端只认名)。
                    for _axis, _axis_name in ((0.0, 'MER'), (90.0, 'HOR')):
                        if _want_mpar:
                            _target = angle.norm(2.0 * _axis - _w_s0)

                            def _fm(a, _ra=_pra, _dec=_pdec, _t=_target):
                                w = self._coreWorldLongitude(_ra, _dec, angle.norm(core_ramc_m + a), phi_m)
                                if w is None:
                                    return 180.0
                                return self._norm180_static(w - _t)

                            for _arc in _pd_find_roots(_fm, span_m, 1.0):
                                if abs(_arc) <= tiny or abs(_arc) > max_arc:
                                    continue
                                pdlist.append([_arc, 'MP_%s_%s' % (_bn, _axis_name), _sid, 'M'])
                        if _want_rapt:
                            _sra, _sdec = float(_s_eq[0]), float(_s_eq[1] or 0.0)

                            def _fr(a, _ra=_pra, _dec=_pdec, _ra2=_sra, _dec2=_sdec, _ax=_axis):
                                r = angle.norm(core_ramc_m + a)
                                wp = self._coreWorldLongitude(_ra, _dec, r, phi_m)
                                ws = self._coreWorldLongitude(_ra2, _dec2, r, phi_m)
                                if wp is None or ws is None:
                                    return 180.0
                                return self._norm180_static(wp + ws - 2.0 * _ax)

                            for _arc in _pd_find_roots(_fr, span_m, 1.0):
                                if abs(_arc) <= tiny or abs(_arc) > max_arc:
                                    continue
                                pdlist.append([_arc, 'RP_%s_%s' % (_bn, _axis_name), _sid, 'M'])
        pdlist = self._extendCorePdRecurrences(pdlist, max_arc)
        want_direct = getattr(self.perchart, 'pdDirect', True)
        want_direct = True if want_direct is None else bool(want_direct)
        want_converse = bool(getattr(self.perchart, 'pdConverse', True))
        if not want_direct and not want_converse:
            want_direct = True
        if not (want_direct and want_converse):
            pdlist = [it for it in pdlist
                      if (it[0] > 0 and want_direct) or (it[0] < 0 and want_converse)]
        pdlist.sort(key=lambda item: (abs(item[0]), item[0], item[1], item[2]))
        return pdlist

    def getPrimaryDirectionByMAlcabitius(self):
        return self._getPrimaryDirectionByMFrame('alcabitius')

    def getPrimaryDirectionByMMorinus(self):
        return self._getPrimaryDirectionByMFrame('morinus')

    def getPrimaryDirectionByMMeridian(self):
        return self._getPrimaryDirectionByMFrame('meridian')

    def getPrimaryDirectionByMPlacidus(self):
        return self._getPrimaryDirectionByMFrame('placidus')

    def getPrimaryDirectionByMEqualHourCircle(self):
        return self._getPrimaryDirectionByMFrame('equal_hour')

    def _getPrimaryDirectionByMFrame(self, kind):
        """In Mundo(世俗位置见 pd_mundane)。
        - 本体应星(行星 / 真交点 / 福点):迫星本体(真黄纬)沿周日运动走到应星世俗位置 + 相位处。
          Alcabitius:arc = wrap180(RA迫 − RAMC − h),h 为该世俗角对应的距 MC 赤经差;
          Morinus:目标黄经圈 = 应星黄道升 + 相位,arc = 迫星赤纬圈与该黄经圈交点赤经 − RA迫;
          Meridian:宫圈为自 RAMC 每 30° 的时圈,世俗位置即赤经;应星被带到迫星世俗位置 − 相位处,
          arc = wrap180(RA应 − RA迫 + 相位);
          Placidus:应星被带到迫星半弧比例位置 + 相位处(pd_mundane.placidus_mundane_arc);
          Regiomontanus / Campanus:世俗角取过地平南北点的位置圈与赤道 / 卯酉圈交点的角度,应星被带到
          迫星世俗角 + 相位的那个位置半圆上(pd_mundane.position_circle_mundane_arc);
          Equal(时圈):应星时圈与黄道交点黄经 + 相位处的黄道点走到迫星赤经处(pd_mundane.equal_hour_mundane_arc);
          Porphyry / Equal(黄道):世俗角 = 黄经在本命象限内的比例(等宫即自上升起的黄经),目标黄经 = 应星世俗角 + 相位
          换回的黄经,迫星沿赤纬圈走到该黄经圈(与 Morinus 同一几何)。
        - 轴应星只出合相:上升 / 下降 / 宿命点 / 东点(卯酉圈东交点)= 迫星(真黄纬)穿越真实地平或卯酉圈的
          斜升 / 斜降之差,轴向迫星计、符号取 轴 − 迫星;天顶 / 天底 = |RA迫 − RA轴|。"""
        from astrostudy import pd_mundane as _pm
        from astrostudy import pd_semiarc_pole as _sp
        prom_moves = self._pdPromissorMoves()
        geo = self._pdGeometry()
        chart = self.perchart.getChart()
        pd = PrimaryDirections(chart)
        aspList = [float(a) for a in (self.perchart.pdaspects or [0])]
        significators = pd._elements(CORE_PD_SIGNIFICATOR_IDS, pd.N, [0])
        promissors = pd._elements(CORE_PD_PROMISSOR_IDS, pd.N, [0])
        node_base_lons = self._coreTrueNodeBaseLons(chart)
        significators = [self._rebuildCoreNodePoint(pd, obj, node_base_lons) for obj in significators]
        promissors = [self._rebuildCoreNodePoint(pd, obj, node_base_lons) for obj in promissors]
        _dt_dmap = self._corePdDeltaTPointMap(chart)
        if _dt_dmap:
            significators = [self._coreShiftPointByDeltaT(o, _dt_dmap) for o in significators]
            promissors = [self._coreShiftPointByDeltaT(o, _dt_dmap) for o in promissors]
        significators, promissors = self._pdApplyLatitudeOptions(significators, promissors)
        promissors.extend(self._corePdMirrorTermPromissors(promissors))
        _axis_names = (const.ASC, const.MC, const.DESC, const.IC, CORE_PD_VERTEX_ID, CORE_PD_ANTIVERTEX_ID)
        significators.extend(o for o in self._pdExtraSignificatorPoints(chart)
                             if self._baseDirectionObjectId(o.get('id')) not in _axis_names)
        promissors.extend(self._pdExtraCuspPromissorPoints(chart))
        eps_mean = self._coreMeanObliquity(chart)
        geo_lat = float(self._coreParseCoord(getattr(self.perchart, 'lat', 0.0)))
        geo_lon = self._coreParseCoord(getattr(self.perchart, 'lon', 0.0))
        ascmc = _polarSafeHousesEx(chart.date.jd, geo_lat, geo_lon, b'P')[1]
        ramc = float(ascmc[2])
        _asc_ra, asc_decl = self._coreEqCoords(float(ascmc[0]), 0.0, eps_mean)
        dsa_asc = 90.0 + float(utils.ascdiff(float(asc_decl), geo_lat))
        # Koch 世俗角按天顶度数的昼半弧量(pd_mundane.koch_mundane_position)
        ad_mc = float(utils.ascdiff(float(self._coreEqCoords(float(ascmc[1]), 0.0, eps_mean)[1]), geo_lat))
        max_arc = float(getattr(self.perchart, 'pdYears', 100) or 100)
        tiny = 1e-12
        want_mpar = bool(getattr(self.perchart, 'pdParallel', False))
        want_rapt = bool(getattr(self.perchart, 'pdRaptParallel', False))
        # 地平轴所在时圈:Alcabitius / Porphyry / 黄道等宫取上升点的时圈,Meridian / 时圈等宫 / Morinus 取 RAMC + 90°
        horizon_axis_ra = float(_asc_ra) if kind in ('alcabitius', 'porphyry', 'equal_ecliptic') else (ramc + 90.0) % 360.0
        offsets = []
        for a in aspList:
            a = abs(a)
            if a < 1e-9:
                offsets.append(('N', 0, 0.0))
            elif abs(a - 180.0) < 1e-9:
                offsets.append(('N', 180, 180.0))
            else:
                ai = int(a) if float(a).is_integer() else a
                offsets.append(('D', ai, -a))
                offsets.append(('S', ai, a))

        def _ad(decl, lat):
            x = math.tan(math.radians(decl)) * math.tan(math.radians(lat))
            return None if abs(x) >= 1.0 else math.degrees(math.asin(x))

        pdlist = []
        for prom in promissors:
            prom_id = prom.get('id')
            ra_p, decl_p = self._corePointEqCoords(prom, eps_mean, zero_lat=False)
            if prom_id is None or ra_p is None:
                continue
            ra_p, decl_p = float(ra_p), float(decl_p)
            body = self._baseDirectionObjectId(prom_id)
            is_body = '{0}'.format(prom_id).startswith('N_')
            for sig in significators:
                sig_id = sig.get('id')
                if sig_id is None or body == self._baseDirectionObjectId(sig_id):
                    continue
                ra_s, decl_s = self._corePointEqCoords(sig, eps_mean, zero_lat=False)
                if ra_s is None or sig.get('lon') is None:
                    continue
                if want_mpar and is_body and self._baseDirectionObjectId(sig_id) not in _axis_names:
                    # 世俗平行(子午):Placidus = 应星走到迫星关于子午圈的半弧比例镜像;Regiomontanus / Campanus = 应星走到
                    # 迫星位置圈世俗角的子午镜像;其余方位法按赤经镜像(子午距相等、东西相反)
                    if kind == 'horizontal':
                        par = _pm.horizontal_parallel_arc(ra_p, decl_p, float(ra_s), float(decl_s), ramc, geo_lat, 'MER')
                    elif kind == 'koch':
                        par = _pm.koch_parallel_arc(ra_p, decl_p, float(ra_s), float(decl_s), ramc, geo_lat, ad_mc, 'MER')
                    elif kind == 'placidus':
                        par = geo.placidus_meridian_parallel_arc(ra_p, decl_p, float(ra_s), float(decl_s), ramc, geo_lat)
                    elif kind in ('regiomontanus', 'campanus'):
                        par = geo.position_circle_meridian_parallel_arc(ra_p, decl_p, float(ra_s), float(decl_s), ramc,
                                                                        geo_lat, kind)
                    elif kind == 'morinus':
                        par = geo.morinus_meridian_parallel_arc(ra_p, decl_p, float(sig['lon']), float(ra_s), ramc, eps_mean)
                    else:
                        par = geo.meridian_parallel_arc(ra_p, float(ra_s), ramc)
                    if par is not None and tiny < abs(par) <= max_arc:
                        pdlist.append([par, 'MP_%s_MER' % body, sig_id, 'M'])
                    # 世俗平行(地平):同一构造换地平轴。Regiomontanus / Campanus = 世俗角 U ↦ 180 − U;
                    # 其余(Placidus 除外,见下)按地平轴所在时圈的平面镜像
                    if kind != 'placidus':
                        if kind == 'horizontal':
                            par_h = _pm.horizontal_parallel_arc(ra_p, decl_p, float(ra_s), float(decl_s), ramc, geo_lat, 'HOR')
                        elif kind == 'koch':
                            par_h = _pm.koch_parallel_arc(ra_p, decl_p, float(ra_s), float(decl_s), ramc, geo_lat, ad_mc, 'HOR')
                        elif kind in ('regiomontanus', 'campanus'):
                            par_h = _pm.position_circle_horizon_parallel_arc(ra_p, decl_p, float(ra_s), float(decl_s),
                                                                             ramc, geo_lat, kind)
                        else:
                            par_h = _pm.axis_plane_parallel_arc(ra_p, float(ra_s), horizon_axis_ra)
                        if par_h is not None and tiny < abs(par_h) <= max_arc:
                            pdlist.append([par_h, 'MP_%s_HOR' % body, sig_id, 'M'])
                if want_rapt and is_body and kind != 'placidus' and self._baseDirectionObjectId(sig_id) not in _axis_names:
                    # 急动平行:两者同被周日运动带动,走到关于子午 / 地平轴互为镜像处(度量同上)
                    for axis_name, axis_ra, axis_u in (('MER', ramc, 0.0), ('HOR', horizon_axis_ra, 90.0)):
                        if kind == 'horizontal':
                            rapts = _pm.horizontal_rapt_arcs(ra_p, decl_p, float(ra_s), float(decl_s), ramc, geo_lat,
                                                             axis_name, span=min(179.0, max_arc + 10.0))
                        elif kind == 'koch':
                            rapts = _pm.koch_rapt_arcs(ra_p, decl_p, float(ra_s), float(decl_s), ramc, geo_lat, ad_mc,
                                                       axis_name, span=min(179.0, max_arc + 10.0))
                        elif kind in ('regiomontanus', 'campanus'):
                            rapts = _pm.position_circle_rapt_arcs(ra_p, decl_p, float(ra_s), float(decl_s), ramc, geo_lat,
                                                                  kind, axis_u, span=min(179.0, max_arc + 10.0))
                        else:
                            rapts = _pm.axis_plane_rapt_arcs(ra_p, float(ra_s), axis_ra)
                        for rp in rapts:
                            if tiny < abs(rp) <= max_arc:
                                pdlist.append([rp, 'RP_%s_%s' % (body, axis_name), sig_id, 'M'])
                for pre, a, signed in (offsets if is_body else [('N', 0, 0.0)]):
                    if kind == 'horizontal':
                        if prom_moves:
                            arc = geo.horizontal_mundane_arc(float(ra_s), float(decl_s), ra_p, decl_p, ramc, geo_lat, signed)
                        else:
                            arc = geo.horizontal_mundane_arc(ra_p, decl_p, float(ra_s), float(decl_s), ramc, geo_lat, signed)
                    elif kind == 'koch':
                        if prom_moves:
                            arc = _pm.koch_mundane_arc(float(ra_s), float(decl_s), ra_p, decl_p, ramc, geo_lat, ad_mc, signed)
                        else:
                            arc = _pm.koch_mundane_arc(ra_p, decl_p, float(ra_s), float(decl_s), ramc, geo_lat, ad_mc, signed)
                    elif kind == 'equal_hour':
                        arc = _pm.equal_hour_mundane_arc(ra_p, float(ra_s), signed, eps_mean)
                    elif kind in ('regiomontanus', 'campanus'):
                        if prom_moves:
                            arc = geo.position_circle_mundane_arc(float(ra_s), float(decl_s), ra_p, decl_p, ramc, geo_lat, signed, kind)
                        else:
                            arc = geo.position_circle_mundane_arc(ra_p, decl_p, float(ra_s), float(decl_s), ramc, geo_lat, signed, kind)
                    elif kind == 'placidus' and prom_moves:
                        arc = geo.placidus_mundane_arc(float(ra_s), float(decl_s), ra_p, decl_p, ramc, geo_lat, signed)
                    elif kind == 'placidus':
                        arc = geo.placidus_mundane_arc(ra_p, decl_p, float(ra_s), float(decl_s), ramc, geo_lat, signed)
                    elif kind == 'meridian':
                        arc = self._norm180(float(ra_s) - ra_p + signed)
                    elif kind in ('morinus', 'porphyry', 'equal_ecliptic'):
                        if kind == 'morinus':
                            lon_t = _pm.morinus_mundane_target_lon(float(sig['lon']), signed, eps_mean)
                        elif kind == 'porphyry':
                            lon_t = geo.porphyry_mundane_target_lon(float(sig['lon']), signed, ramc, geo_lat, eps_mean)
                        else:
                            lon_t = _pm.equal_mundane_target_lon(float(sig['lon']), signed)
                        arc = _sp.ecliptic_pole_circle_arc(lon_t, ra_p, decl_p, eps_mean)
                        arc = None if arc is None else -arc
                    else:
                        arc = geo.alcabitius_mundane_arc(ra_p, float(ra_s), ramc, dsa_asc, signed)
                    if arc is None or abs(arc) <= tiny or abs(arc) > max_arc:
                        continue
                    rid = '%s_%s_%s' % (pre, body, a) if is_body else prom_id
                    pdlist.append([arc, rid, sig_id, 'M'])
            # 轴应星(只出合相)
            ad = _ad(decl_p, geo_lat)
            adc = _ad(decl_p, 90.0 - geo_lat)
            axis_arcs = [(const.MC, abs(self._norm180(ra_p - ramc))),
                         (const.IC, abs(self._norm180(ra_p - ramc - 180.0)))]
            if ad is not None:
                axis_arcs += [(const.ASC, -self._norm180(ra_p - ad - (ramc + 90.0))),
                              (const.DESC, -self._norm180(ra_p + ad - (ramc + 270.0)))]
            if adc is not None:
                axis_arcs += [(CORE_PD_VERTEX_ID, -self._norm180(ra_p - adc - (ramc + 270.0))),
                              (CORE_PD_ANTIVERTEX_ID, -self._norm180(ra_p + adc - (ramc + 90.0)))]
            for axis, arc in axis_arcs:
                if abs(arc) <= tiny or abs(arc) > max_arc:
                    continue
                pdlist.append([arc, prom_id, 'N_%s_0' % axis, 'M'])
        pdlist = self._extendCorePdRecurrences(pdlist, max_arc)
        if kind == 'placidus' and (want_mpar or want_rapt):
            # Placidus 的地平平行与急动平行走 pd_engine 世俗族(半弧比例镜像,已含复发行);子午平行由上面的循环直接给出
            legacy = self.getPrimaryDirectionByZEngine('placidus', zodiacal=False)
            for it in legacy:
                parts = '{0}'.format(it[1]).split('_')
                if parts[0] == 'RP' or (parts[0] == 'MP' and want_mpar and parts[-1] != 'MER'):
                    pdlist.append(list(it[:4]))
        want_direct = getattr(self.perchart, 'pdDirect', True)
        want_direct = True if want_direct is None else bool(want_direct)
        want_converse = bool(getattr(self.perchart, 'pdConverse', True))
        if not want_direct and not want_converse:
            want_direct = True
        if not (want_direct and want_converse):
            pdlist = [it for it in pdlist
                      if (it[0] > 0 and want_direct) or (it[0] < 0 and want_converse)]
        pdlist.sort(key=lambda item: (abs(item[0]), item[0], item[1], item[2]))
        return pdlist

    def getPrimaryDirectionByF(self):
        """Field Plane:相位点黄经 λ迫 ± 相位,黄纬借用迫星出生后第一次走到该黄经时的黄纬(见 pd_fieldplane);
        合相点用本命黄纬。弧按方位法:
          核心族 = wrap180(RA相位点 − RA应);Placidus = 相位点沿自身周日圈走到应星本命半弧比例位置;
          Regiomontanus / Campanus = 相位点在应星位置圈的极下;Morinus = 相位点沿赤纬圈走到应星黄经圈。
        轴应星:上升 = OA相位点 − OA上升、天顶 = |RA相位点 − RAMC|、宿命点 = 余纬框架斜升差。
        Along-Ecliptic 只用黄经,与 In Zodiaco 相同;Edmund Jones 同 In Zodiaco 的二选一规则,
        相位点 Q = (λ迫 − θ, 借用黄纬)。"""
        from astrostudy import pd_fieldplane as _fp
        from astrostudy import pd_semiarc_pole as _sp
        from astrostudy import pd_geometry as _pg
        geo = self._pdGeometry()
        # 经典口径(传统程序的写法):合相点也按「第一次走到该黄经」借黄纬;「忽略迫星黄纬」在 Field Plane 不起作用。
        # 改进口径:合相点 = 迫星本身(本命黄纬),忽略迫星黄纬照常清零
        fp_classic = _pg.normalize_variant(getattr(self.perchart, 'pdGeometry', None)) == 'classic'
        ignore_prom = bool(getattr(self.perchart, 'pdIgnorePromLat', False)) and not fp_classic
        proj, _frame = self._pdResolveProjectionFrame()
        if proj == 'in_zodiaco_lon':
            pdlist = self.getPrimaryDirectionByZAlongEcliptic()
            self.appendDateStr(pdlist)
            return pdlist
        edmund = proj == 'in_zodiaco_abs'
        chart = self.perchart.getChart()
        pd = PrimaryDirections(chart)
        aspList = self.perchart.pdaspects
        significators = pd._elements(CORE_PD_SIGNIFICATOR_IDS, pd.N, [0])
        promissors = pd._elements(CORE_PD_PROMISSOR_IDS, pd.N, aspList)
        if edmund:
            # Edmund Jones 每个 (迫星, 应星, θ) 只出一行,相位点一律取 λ迫 − θ(右旋点)
            promissors = [o for o in promissors if not '{0}'.format(o.get('id') or '').startswith('S_')]
        node_base_lons = self._coreTrueNodeBaseLons(chart)
        significators = [self._rebuildCoreNodePoint(pd, obj, node_base_lons) for obj in significators]
        promissors = [self._rebuildCoreNodePoint(pd, obj, node_base_lons) for obj in promissors]
        _dt_dmap = self._corePdDeltaTPointMap(chart)
        if _dt_dmap:
            significators = [self._coreShiftPointByDeltaT(o, _dt_dmap) for o in significators]
            promissors = [self._coreShiftPointByDeltaT(o, _dt_dmap) for o in promissors]
        significators, promissors = self._pdApplyLatitudeOptions(significators, promissors, ignore_prom_lat=ignore_prom)
        promissors.extend(self._corePdMirrorTermPromissors(promissors))
        significators.extend(self._pdExtraSignificatorPoints(chart))
        promissors.extend(o for o in self._pdExtraCuspPromissorPoints(chart, aspects=aspList)
                          if not (edmund and '{0}'.format(o.get('id') or '').startswith('S_')))
        eps_mean = self._coreMeanObliquity(chart)
        geo_lat = float(self._coreParseCoord(getattr(self.perchart, 'lat', 0.0)))
        geo_lon = self._coreParseCoord(getattr(self.perchart, 'lon', 0.0))
        ramc = float(_polarSafeHousesEx(chart.date.jd, geo_lat, geo_lon, b'P')[1][2])
        jd_ut = float(chart.date.jd)
        flags = self._coreEphemerisFlags()
        max_arc = float(getattr(self.perchart, 'pdYears', 100) or 100)
        tiny = 1e-12
        _ANGLE_SIGS = (const.ASC, const.MC, const.DESC, const.IC, CORE_PD_VERTEX_ID)

        def _ad(decl, lat):
            x = math.tan(math.radians(decl)) * math.tan(math.radians(lat))
            return None if abs(x) >= 1.0 else math.degrees(math.asin(x))

        lat_cache = {}
        self._pdFieldPlaneLatitudes = {}
        pdlist = []
        for prom in promissors:
            prom_id = prom.get('id')
            lon = prom.get('lon')
            if prom_id is None or lon is None:
                continue
            parts = '{0}'.format(prom_id).split('_')
            body = self._baseDirectionObjectId(prom_id)
            offset = 0.0
            aspect_point = len(parts) >= 3 and parts[0] in ('N', 'D', 'S')
            if aspect_point:
                try:
                    offset = abs(float(parts[-1]))
                except ValueError:
                    offset = 0.0
            beta = float(prom.get('lat', 0.0) or 0.0)
            if (offset > 1e-9 or (fp_classic and aspect_point)) and not ignore_prom and body not in self._PD_STAR_ROSTER:
                # 恒星不随时间移动黄纬(岁差另计),相位点黄纬即恒星本身黄纬,不借用
                model = CORE_PD_VIRTUAL_BODY_CORR_MODELS.get(body)
                if model is None:
                    if offset > 1e-9:
                        beta = 0.0
                else:
                    key = (body, round(float(lon), 9), offset <= 1e-9)
                    if key not in lat_cache:
                        lat_cache[key] = _fp.first_arrival_latitude(jd_ut, model[1], float(lon), flags,
                                                                    start_days=1.0 if offset <= 1e-9 else 1.0 / 86400.0)
                    if lat_cache[key] is not None:
                        beta = lat_cache[key]
                    elif offset > 1e-9:
                        continue
            self._pdFieldPlaneLatitudes[prom_id] = beta
            ra_q, decl_q = self._coreEqCoords(float(lon), beta, eps_mean)
            ra_q, decl_q = float(ra_q), float(decl_q)
            for sig in significators:
                sig_id = sig.get('id')
                if sig_id is None or body == self._baseDirectionObjectId(sig_id):
                    continue
                if self._baseDirectionObjectId(sig_id) in _ANGLE_SIGS:
                    continue
                ra_s, decl_s = self._corePointEqCoords(sig, eps_mean, zero_lat=False)
                if ra_s is None or sig.get('lon') is None:
                    continue
                ra_s, decl_s = float(ra_s), float(decl_s)
                if edmund:
                    row_id = 'S_%s_%s' % (body, parts[-1]) if parts[0] == 'D' else prom_id
                    arc = abs(self._norm180(ra_s - ra_q - offset))
                    if offset > 1e-9:
                        c = geo.semiarc_arc(ra_s, decl_s, ra_q, decl_q, ramc, geo_lat)
                        if c is not None and abs(c) < max_arc:
                            arc, row_id = c, prom_id
                    if abs(arc) <= tiny or abs(arc) >= max_arc:
                        continue
                    pdlist.append([arc, row_id, sig_id, 'Z'])
                    continue
                if proj == 'placidus':
                    arc = geo.semiarc_arc(ra_s, decl_s, ra_q, decl_q, ramc, geo_lat)
                elif proj in ('regiomontanus', 'campanus'):
                    arc = geo.pole_circle_arc(ra_s, decl_s, ra_q, decl_q, ramc, geo_lat)
                elif proj == 'morinus':
                    arc = _sp.ecliptic_pole_circle_arc(float(sig['lon']), ra_q, decl_q, eps_mean)
                else:
                    arc = self._norm180(ra_q - ra_s)
                if arc is None or abs(arc) <= tiny or abs(arc) >= max_arc:
                    continue
                pdlist.append([arc, prom_id, sig_id, 'Z'])
            ad = _ad(decl_q, geo_lat)
            adc = _ad(decl_q, 90.0 - geo_lat)
            axis_arcs = [(const.MC, abs(self._norm180(ra_q - ramc)))]
            if ad is not None:
                axis_arcs.append((const.ASC, self._norm180(ra_q - ad - (ramc + 90.0))))
            if adc is not None:
                axis_arcs.append((CORE_PD_VERTEX_ID, self._norm180(ra_q - adc - (ramc + 270.0))))
            for axis, arc in axis_arcs:
                if abs(arc) <= tiny or abs(arc) >= max_arc:
                    continue
                pdlist.append([arc, prom_id, 'N_%s_0' % axis, 'Z'])
        pdlist = self._extendCorePdRecurrences(pdlist, max_arc)
        want_direct = getattr(self.perchart, 'pdDirect', True)
        want_direct = True if want_direct is None else bool(want_direct)
        want_converse = bool(getattr(self.perchart, 'pdConverse', True))
        if not want_direct and not want_converse:
            want_direct = True
        if not (want_direct and want_converse):
            pdlist = [it for it in pdlist
                      if (it[0] > 0 and want_direct) or (it[0] < 0 and want_converse)]
        pdlist.sort(key=lambda item: (abs(item[0]), item[0], item[1], item[2]))
        self.appendDateStr(pdlist)
        return pdlist

    def getPrimaryDirectionByM(self):
        # 世俗向运(in mundo)。placidus 等走 pd_engine；core 走纯公式世俗核；legacy 仍走 flatlib 'M'。
        # 分发按 resolved projection;旧 morinus/in_zodiaco_lon/in_zodiaco_abs/horosa_legacy 在
        # 未显式指定 pdProjection 时精确保持 flatlib legacy 'M' 输出(零回归)。
        proj, _frame = self._pdResolveProjectionFrame()
        method = getattr(self.perchart, 'pdMethod', 'core_alchabitius') or 'core_alchabitius'
        explicit_proj = getattr(self.perchart, 'pdProjection', None) is not None
        if proj == 'placidus':
            pdlist = self.getPrimaryDirectionByMPlacidus()
            self.appendDateStr(pdlist)
            return pdlist
        if proj in ('regiomontanus', 'campanus'):
            pdlist = self._getPrimaryDirectionByMFrame(proj)
            self.appendDateStr(pdlist)
            return pdlist
        if proj == 'topocentric':
            pdlist = self.getPrimaryDirectionByZEngine(proj, zodiacal=False)
            self.appendDateStr(pdlist)
            return pdlist
        if proj == 'ptolemy' and _frame == 'alcabitius' and (explicit_proj or method not in _PD_MUNDO_LEGACY_METHODS):
            pdlist = self.getPrimaryDirectionByMAlcabitius()
            self.appendDateStr(pdlist)
            return pdlist
        if proj == 'ptolemy' and _frame == 'equal_hour_circle':
            pdlist = self.getPrimaryDirectionByMEqualHourCircle()
            self.appendDateStr(pdlist)
            return pdlist
        if proj == 'ptolemy' and _frame == 'meridian':
            pdlist = self.getPrimaryDirectionByMMeridian()
            self.appendDateStr(pdlist)
            return pdlist
        if proj == 'morinus':
            pdlist = self.getPrimaryDirectionByMMorinus()
            self.appendDateStr(pdlist)
            return pdlist
        if proj in ('horizontal', 'koch'):
            pdlist = self._getPrimaryDirectionByMFrame(proj)
            self.appendDateStr(pdlist)
            return pdlist
        if proj == 'ptolemy' and _frame in ('porphyry', 'equal'):
            pdlist = self._getPrimaryDirectionByMFrame('porphyry' if _frame == 'porphyry' else 'equal_ecliptic')
            self.appendDateStr(pdlist)
            return pdlist
        if explicit_proj or method not in _PD_MUNDO_LEGACY_METHODS:
            # 这些「核」方位法在投影下与 Alcabitius 同核;In-Mundo 一并走纯公式世俗核
            # (基线 + 映点/界/顺逆),取代旧 flatlib 'M' 死路。
            pdlist = self.getPrimaryDirectionByMCoreKernel()
            self.appendDateStr(pdlist)
            return pdlist
        chart = self.perchart.getChart()
        pdlist = []
        pd = PrimaryDirections(chart)
        for item in pd.getList(self.perchart.pdaspects):
            if item[3] == 'M':
                pdlist.append(item)
        self.appendDateStr(pdlist)
        return pdlist

    def bySignificator(self, ID):
        chart = self.perchart.getChart()
        tbl = PDTable(chart, self.perchart.pdaspects)
        list = tbl.bySignificator(ID)
        self.appendDateStr(list)
        return list


    def byPromissor(self, ID):
        chart = self.perchart.getChart()
        tbl = PDTable(chart, self.perchart.pdaspects)
        list = tbl.byPromissor(ID)
        self.appendDateStr(list)
        return list

    def _pdTimeKeyConverter(self, chart):
        """度数换算单一出口:返回 (years_of_arc(arc), arc_of_years(years, converse))。
        表格走前者(弧 → 年),主限法盘走后者(年 → 弧),两者互逆。
          · 真太阳弧(赤经)/ Van Dam:逐弧求太阳赤经走过 |弧| 的天数;「逆向弧用出生前太阳」开时负弧改看出生前倒行的太阳
          · 太阳弧(黄经):逐弧求太阳黄经走过 |弧| 的天数
          · 上升弧 / 垂直弧:赤经中天前进 |弧| → 上升点 / 宿命点沿黄道前移 Δλ → 太阳黄经走过 Δλ 的天数
          · 其余:按 _pdTimeKeyScale 比例换算(静态常数 / 每盘常数 / 自定义)。"""
        from astrostudy import pd_engine
        key = '{0}'.format(getattr(self.perchart, 'pdTimeKey', 'Ptolemy') or 'Ptolemy')
        kl = key.strip().lower()
        jd = float(chart.date.jd)
        if kl in _PD_DYNAMIC_SOLAR_RA_KEYS:
            regressive = bool(getattr(self.perchart, 'pdSolarArcRegressive', 0))
            mean_eps = kl in _PD_MEAN_OBLIQUITY_SOLAR_KEYS
            return (lambda arc: float(pd_engine.key_placidus_true_solar_arc(float(arc), jd, regressive, mean_obliquity=mean_eps)),
                    lambda years, converse: float(pd_engine.solar_arc_for_years(years, jd, backward=(regressive and converse),
                                                                                mean_obliquity=mean_eps)))
        if kl in _PD_DYNAMIC_SOLAR_LON_KEYS:
            return (lambda arc: float(pd_engine.key_symbolic_solar_arc(float(arc), jd)),
                    lambda years, converse: float(pd_engine.symbolic_solar_arc_for_years(years, jd)))
        geo_lon = self._coreParseCoord(getattr(self.perchart, 'lon', 0.0))
        if kl in _PD_ANGLE_ARC_KEYS:
            point = _PD_ANGLE_ARC_KEYS[kl]
            geo_lat = self._coreParseCoord(getattr(self.perchart, 'lat', 0.0))
            armc = float(_polarSafeHousesEx(jd, geo_lat, geo_lon, b'P')[1][2])
            eps = self._coreMeanObliquity(chart)
            return (lambda arc: float(pd_engine.key_angle_arc(float(arc), jd, armc, geo_lat, eps, point)),
                    lambda years, converse: float(pd_engine.angle_arc_for_years(years, jd, armc, geo_lat, eps, point)))
        scale = _pdTimeKeyScale(key, chart=chart, custom=getattr(self.perchart, 'pdTimeKeyCustom', None), geolon=geo_lon)
        return ((lambda arc: (arc / scale) if scale and scale != 1.0 else arc),
                (lambda years, converse: years * scale))

    def appendDateStr(self, pdlist, usePD=True):
        chart = self.perchart.getChart()
        # 表格是「弧→日期」(盘是「日期→弧」的逆):度数换算走单一出口 _pdTimeKeyConverter,
        # 只换日期、不动弧 / 迫星 / 应星;Ptolemy 原值直出,护住已验证的 Ptolemy+Alchabitius 表格字节级一致。
        _years_of_arc, _arc_of_years = self._pdTimeKeyConverter(chart)
        asc = chart.angles.get(const.ASC)
        asctime = SignAscTime(self.perchart.date, self.perchart.time, asc.sign, self.perchart.lat, self.perchart.zone,
                              year_days=getattr(self.perchart, 'pdYearDays', 0))
        for item in pdlist:
            datestr = None
            if usePD:
                # 弧 → 年(日期函数按 1 年 = 1 单位走)
                datestr = asctime.getDateFromPDArc(_years_of_arc(item[0]))
            else:
                datestr = asctime.getDateFromTermDirArc(item[0])
            item.append(datestr)


    def getProfection(self, nodeRetrograde=False, asporb=-1):
        res = []
        # 连续太阳年轴逐年周年日(跨公元元年不产生 0 年;跨 1582 改历不少 10 天)
        for date, date_label in _anniversary_rows(self.perchart.year, self.perchart.month, self.perchart.day, 99):
            dt = Datetime(date, self.perchart.time, self.perchart.zone)
            chart = profections.compute(self.perchart.chart, dt, False, nodeRetrograde)
            obj = {
                'date': date_label,
                'chart': {
                    'objects': getChartObjects(chart),
                    'aspects': self.getAspects(chart, asporb)
                },
                'lots': self.perchart.getPars(chart)
            }
            res.append(obj)
        return res

    def getProfectionByDate(self, date, zone, nodeRetrograde=False, asporb=-1):
        parts = date.split(' ')
        dt = helper.getChartDate(parts[0])
        tm = parts[1] if len(parts) > 1 else '00:00'
        profDate = Datetime(dt, tm, zone)
        chart = profections.compute(self.perchart.chart, profDate, False, nodeRetrograde)
        obj = {
            'date': date,
            'chart': {
                'objects': getChartObjects(chart),
                'aspects': self.getAspects(chart, asporb)
            },
            'lots': self.perchart.getPars(chart)
        }
        return obj

    def getSolarReturn(self, params, asporb=-1):
        res = []
        zone = params['zone']

        # 本命后 89 年逐年(历史纪年,跨公元元年不产生 0 年);显示串经民用历补位
        for i, _ay in _civil_years_after(self.perchart.year, 89):
            chart = self.perchart.chart.solarReturn(i)
            srdt = Datetime.fromJD(chart.date.jd, zone)
            srdtstr = _civil_cn_string(srdt)
            dirparts = srdtstr.split(' ')
            cparams = copy.deepcopy(params)
            cparams['date'] = dirparts[0]
            reset_ad_for_date(cparams)   # 派生盘日期换了:纪元标志随新日期(公元前本命推到公元后不再被当成公元前)
            cparams['time'] = dirparts[1]
            cparams['siderealAyanamsa'] = self.perchart.siderealAyanamsa
            _fill_user_ayan(self.perchart, cparams)
            obj = {
                'date': srdtstr,
                'chart': {
                    'objects': getChartObjects(chart),
                    'aspects': self.getAspects(chart, asporb)
                },
                'dirParams': cparams,
                'lots': self.perchart.getPars(chart)
            }
            res.append(obj)
        return res

    def _hellenisticSrDate(self, srDate):
        """[WP-6] 希腊式太阳返照:精确回归时刻 ±17 日窗内找「月亮回本命月黄经」的最近时刻
        (古法以月位代精密太阳定返照上升)。默认 'precise' 不调用=零回归。"""
        try:
            natal_moon = self.perchart.chart.getObject(const.MOON).lon
            base = Datetime.fromJD(srDate.jd - 17.0, srDate.utcoffset)
            t1 = dateLunarReturn(base, natal_moon, self.perchart.zodiacal)
            t2 = dateLunarReturn(Datetime.fromJD(t1.jd + 2.0, srDate.utcoffset), natal_moon, self.perchart.zodiacal)
            pick = t1 if abs(t1.jd - srDate.jd) <= abs(t2.jd - srDate.jd) else t2
            return pick
        except Exception:
            return srDate

    def _srVariantFlags(self, params):
        data = self.perchart.data if isinstance(self.perchart.data, dict) else {}
        variant = data.get('solarReturnVariant') or params.get('solarReturnVariant') or 'precise'
        latmode = data.get('returnLatitudeMode') or params.get('returnLatitudeMode') or 'ecliptic'
        return variant, latmode

    def getSolarReturnByDate(self, params, date, asporb=-1):
        sun = self.perchart.chart.getObject(const.SUN)
        parts = date.split(' ')
        dt = helper.getChartDate(parts[0])
        tm = parts[1] if len(parts) > 1 else '00:00'
        zone = params['zone']
        returnDate = Datetime(dt, tm, zone)
        srDate = dateSolarReturn(returnDate, sun.lon, self.perchart.zodiacal)
        _variant, _latmode = self._srVariantFlags(params)
        if _variant == 'hellenistic':
            srDate = self._hellenisticSrDate(srDate)
        chart = Chart(srDate, self.perchart.pos, self.perchart.zodiacal, hsys=self.perchart.house, IDs=const.LIST_OBJECTS, sidereal_mode=self.perchart.siderealMode)
        if _latmode == 'withLatitude':
            params['returnLatitudeMode'] = 'withLatitude'
            params['_isReturnChart'] = 1   # dirChart(PerChart) 端赤经落宫仅此标记生效,主盘零效
        srdt = Datetime.fromJD(srDate.jd, srDate.utcoffset)
        srdtstr = _civil_cn_string(srdt)
        dirparts = srdtstr.split(' ')
        params['date'] = dirparts[0]
        reset_ad_for_date(params)   # 派生盘日期换了:纪元标志随新日期(公元前本命推到公元后不再被当成公元前)
        params['time'] = dirparts[1]
        params['siderealAyanamsa'] = self.perchart.siderealAyanamsa
        _fill_user_ayan(self.perchart, params)
        obj = {
            'date': srdtstr,
            'chart': {
                'objects': getChartObjects(chart),
                'aspects': self.getAspects(chart, asporb)
            },
            'dirParams': params,
            'lots': self.perchart.getPars(chart)
        }
        return obj

    def getSolarReturnByDatePos(self, params, date, pos, asporb=-1):
        sun = self.perchart.chart.getObject(const.SUN)
        parts = date.split(' ')
        dt = helper.getChartDate(parts[0])
        tm = parts[1] if len(parts) > 1 else '00:00'
        zone = params['zone']
        returnDate = Datetime(dt, tm, zone)
        srDate = dateSolarReturn(returnDate, sun.lon, self.perchart.zodiacal)
        _variant, _latmode = self._srVariantFlags(params)
        if _variant == 'hellenistic':
            srDate = self._hellenisticSrDate(srDate)
        chart = Chart(srDate, pos, self.perchart.zodiacal, hsys=self.perchart.house, IDs=const.LIST_OBJECTS, sidereal_mode=self.perchart.siderealMode)
        if _latmode == 'withLatitude':
            params['returnLatitudeMode'] = 'withLatitude'
            params['_isReturnChart'] = 1
        srdt = Datetime.fromJD(srDate.jd, srDate.utcoffset)
        srdtstr = _civil_cn_string(srdt)
        dirparts = srdtstr.split(' ')
        params['date'] = dirparts[0]
        reset_ad_for_date(params)   # 派生盘日期换了:纪元标志随新日期(公元前本命推到公元后不再被当成公元前)
        params['time'] = dirparts[1]
        params['siderealAyanamsa'] = self.perchart.siderealAyanamsa
        _fill_user_ayan(self.perchart, params)
        obj = {
            'date': srdtstr,
            'pos': {
                'lat': pos.lat,
                'lon': pos.lon
            },
            'chart': {
                'objects': getChartObjects(chart),
                'aspects': self.getAspects(chart, asporb)
            },
            'dirParams': params,
            'lots': self.perchart.getPars(chart)
        }
        return obj

    def getLunarReturn(self, params, date, pos, asporb=-1):
        moon = self.perchart.chart.getObject(const.MOON)
        parts = date.split(' ')
        dt = helper.getChartDate(parts[0])
        parts = dt.split('/')
        dt = '{0}/{1}/01'.format(parts[0], parts[1])
        tm = '00:00'
        zone = params['zone']
        returnDate = Datetime(dt, tm, zone)
        lrDate = dateLunarReturn(returnDate, moon.lon, self.perchart.zodiacal)
        chart = Chart(lrDate, pos, self.perchart.zodiacal, hsys=self.perchart.house, IDs=const.LIST_OBJECTS, sidereal_mode=self.perchart.siderealMode)
        srdt = Datetime.fromJD(lrDate.jd, lrDate.utcoffset)
        srdtstr = _civil_cn_string(srdt)
        dirparts = srdtstr.split(' ')
        params['date'] = dirparts[0]
        reset_ad_for_date(params)   # 派生盘日期换了:纪元标志随新日期(公元前本命推到公元后不再被当成公元前)
        params['time'] = dirparts[1]
        params['siderealAyanamsa'] = self.perchart.siderealAyanamsa
        _fill_user_ayan(self.perchart, params)
        obj = {
            'date': srdtstr,
            'pos': {
                'lat': pos.lat,
                'lon': pos.lon
            },
            'chart': {
                'objects': getChartObjects(chart),
                'aspects': self.getAspects(chart, asporb)
            },
            'dirParams': params,
            'lots': self.perchart.getPars(chart)
        }

        # 第一返照落在月初(< 5 日)时同月再找一次;年月日按民用历日期串解析(公元前前导负号不撕裂)
        ay1, m, d1 = parse_civil_date(dirparts[0])
        if d1 < 5:
            dt = format_civil_date(ay1, m, 21, '/')
            tm = '00:00'
            zone = params['zone']
            returnDate = Datetime(dt, tm, zone)
            seclrDate = dateLunarReturn(returnDate, moon.lon, self.perchart.zodiacal)
            secchart = Chart(seclrDate, pos, self.perchart.zodiacal, hsys=self.perchart.house, IDs=const.LIST_OBJECTS, sidereal_mode=self.perchart.siderealMode)
            srdt = Datetime.fromJD(seclrDate.jd, seclrDate.utcoffset)
            srdtstr1 = _civil_cn_string(srdt)
            dirparts1 = srdtstr1.split(' ')
            params1 = copy.deepcopy(params)
            params1['date'] = dirparts1[0]
            reset_ad_for_date(params1)   # 派生盘日期换了:纪元标志随新日期(公元前本命推到公元后不再被当成公元前)
            params1['time'] = dirparts1[1]
            params1['siderealAyanamsa'] = self.perchart.siderealAyanamsa
            _fill_user_ayan(self.perchart, params1)
            if parse_civil_date(dirparts1[0])[1] == m:
                obj1 = {
                    'date': srdtstr1,
                    'pos': {
                        'lat': pos.lat,
                        'lon': pos.lon
                    },
                    'chart': {
                        'objects': getChartObjects(secchart),
                        'aspects': self.getAspects(secchart, asporb)
                    },
                    'dirParams': params1,
                    # 第二返照对比盘的阿拉伯点此前用第一返照 chart 算(外圈点与本盘星位错位)→ 按自身 secchart 算。
                    'lots': self.perchart.getPars(secchart)
                }
                obj['secLuneReturn'] = obj1

        return obj

    def getGivenYear(self, params, date, pos, asporb=-1):
        parts = date.split(' ')
        dt = helper.getChartDate(parts[0])
        tm = parts[1]
        zone = params['zone']
        givenDate = Datetime(dt, tm, zone)
        chart = Chart(givenDate, pos, self.perchart.zodiacal, hsys=self.perchart.house, IDs=const.LIST_OBJECTS, sidereal_mode=self.perchart.siderealMode)
        params['date'] = parts[0]
        reset_ad_for_date(params)   # 派生盘日期换了:纪元标志随新日期(公元前本命推到公元后不再被当成公元前)
        params['time'] = parts[1]
        params['siderealAyanamsa'] = self.perchart.siderealAyanamsa
        _fill_user_ayan(self.perchart, params)
        obj = {
            'date': date,
            'pos': {
                'lat': pos.lat,
                'lon': pos.lon
            },
            'chart': {
                'objects': getChartObjects(chart),
                'aspects': self.getAspects(chart, asporb)
            },
            'dirParams': params,
            'lots': self.perchart.getPars(chart)
        }
        return obj

    def getSolarArc(self, asporb, nodeRetrograde=False):
        res = []
        # 连续太阳年轴逐年周年日(跨公元元年不产生 0 年;跨 1582 改历不少 10 天)
        for date, date_label in _anniversary_rows(self.perchart.year, self.perchart.month, self.perchart.day, 99):
            dt = Datetime(date, self.perchart.time, self.perchart.zone)
            chart = solararc.compute(self.perchart.chart, dt, asporb, nodeRetrograde)
            objs = chart['objects']
            objs.sort(key=takeLon)
            obj = {
                'date': date_label,
                'chart': {
                    'objects': objs,
                    'aspects': chart['aspects']
                },
                'lots': self.perchart.getPars(chart['chart'])
            }
            res.append(obj)
        return res

    def getSolarArcByDate(self, date, asporb, nodeRetrograde=False, zone=None):
        # 目标时刻按推运页所选时区(dirZone)解释;缺省仍按本命时区(与小限同式)
        parts = date.split(' ');
        dt = helper.getChartDate(parts[0])
        tm = parts[1] if len(parts) > 1 else '00:00'
        saDate = Datetime(dt, tm, zone or self.perchart.zone)
        chart = solararc.compute(self.perchart.chart, saDate, asporb, nodeRetrograde)
        objs = chart['objects']
        objs.sort(key=takeLon)
        obj = {
            'date': date,
            'chart': {
                'objects': objs,
                'aspects': chart['aspects']
            },
            'natalChart': {
                'chart': self.perchart.getChartOnlyObj(),
                'aspects': {
                    'normalAsp': self.perchart.getAspects(),
                    'immediateAsp': self.perchart.getImmediateAspects(),
                    'signAsp': self.perchart.getSignAspects()
                }
            },
            'lots': self.perchart.getPars(chart['chart'])
        }
        return obj

    def getPlanetaryArc(self, asporb, nodeRetrograde=False, arcSource=const.MOON):
        res = []
        # 连续太阳年轴逐年周年日(跨公元元年不产生 0 年;跨 1582 改历不少 10 天)
        for date, date_label in _anniversary_rows(self.perchart.year, self.perchart.month, self.perchart.day, 99):
            dt = Datetime(date, self.perchart.time, self.perchart.zone)
            chart = solararc.compute(self.perchart.chart, dt, asporb, nodeRetrograde, arcSource)
            objs = chart['objects']
            objs.sort(key=takeLon)
            obj = {
                'date': date_label,
                'chart': {
                    'objects': objs,
                    'aspects': chart['aspects']
                },
                'lots': self.perchart.getPars(chart['chart'])
            }
            res.append(obj)
        return res

    def getPlanetaryArcByDate(self, date, asporb, nodeRetrograde=False, arcSource=const.MOON, zone=None):
        parts = date.split(' ')
        dt = helper.getChartDate(parts[0])
        tm = parts[1] if len(parts) > 1 else '00:00'
        saDate = Datetime(dt, tm, zone or self.perchart.zone)   # dirZone
        chart = solararc.compute(self.perchart.chart, saDate, asporb, nodeRetrograde, arcSource)
        objs = chart['objects']
        objs.sort(key=takeLon)
        obj = {
            'date': date,
            'arcSource': arcSource,
            'chart': {
                'objects': objs,
                'aspects': chart['aspects']
            },
            'natalChart': {
                'chart': self.perchart.getChartOnlyObj(),
                'aspects': {
                    'normalAsp': self.perchart.getAspects(),
                    'immediateAsp': self.perchart.getImmediateAspects(),
                    'signAsp': self.perchart.getSignAspects()
                }
            },
            'lots': self.perchart.getPars(chart['chart'])
        }
        return obj

    def getPersianDirectedByDate(self, date, rateKey='persian', asporb=1, nodeRetrograde=False, direction='direct', zone=None):
        # 波斯向运（Persian Directed）：黄经象征向运,所有行星/点每年 +rate 度,本命宫头不动。
        # direction: direct(默认,逆时针) / converse(反向,顺时针,弧取负)。
        from astrostudy import symbolicdir
        parts = date.split(' ')
        dt = helper.getChartDate(parts[0])
        tm = parts[1] if len(parts) > 1 else '00:00'
        target = Datetime(dt, tm, zone or self.perchart.zone)   # dirZone
        ageYears = (target.jd - self.perchart.chart.date.jd) / 365.2421904
        res = symbolicdir.compute(self.perchart.chart, ageYears, rateKey, asporb, nodeRetrograde, direction)
        objs = res['objects']
        objs.sort(key=takeLon)
        obj = {
            'date': date,
            'rateKey': rateKey,
            'direction': direction,
            'ageYears': round(ageYears, 4),
            'chart': {
                'objects': objs,
                'aspects': res['aspects']
            },
            'natalChart': {
                'chart': self.perchart.getChartOnlyObj(),
                'aspects': {
                    'normalAsp': self.perchart.getAspects(),
                    'immediateAsp': self.perchart.getImmediateAspects(),
                    'signAsp': self.perchart.getSignAspects()
                }
            },
            'lots': self.perchart.getPars(res['chart'])
        }
        return obj


    def getFirdaria(self):
        return firdaria.compute(self.perchart.chart)


    def getZodiacalRelease(self, startSign, stopLevelIdx=3):
        return zreleasing.compute(self.perchart, startSign, stopLevelIdx)

    def getDiceChart(self, planet, sign, house):
        aspects = self.perchart.getAspects()
        planetobj = self.perchart.chart.get(planet)
        siglon = planetobj.signlon
        newlon = helper.getSignLon(sign) + siglon
        hidx = 0
        for hobj in self.perchart.chart.houses:
            # 宫位跨 0° 白羊点时(lon+size>360)线性比较永不命中 → 用宫首相对弧判定
            if (newlon - hobj.lon) % 360 <= hobj.size:
                hidx = int(hobj.id[5:7]) - 1
                break

        objs = set()
        objs.add(planet)
        try:
            asp = aspects[planet]
            for aspobj in asp['Applicative']:
                objs.add(aspobj['id'])
            for aspobj in asp['Exact']:
                objs.add(aspobj['id'])
            for aspobj in asp['None']:
                objs.add(aspobj['id'])
            for aspobj in asp['Obvious']:
                objs.add(aspobj['id'])
            for aspobj in asp['Separative']:
                objs.add(aspobj['id'])
        except:
            pass

        for parid in arabicparts.LIST_PARS:
            if parid in objs:
                objs.remove(parid)
        for parid in const.LIST_ANGLES:
            if parid in objs:
                objs.remove(parid)

        objlist = []
        for objid in objs:
            objlist.append(objid)

        perchart = self.perchart.clone(objlist, const.HOUSES_WHOLE_SIGN, False)

        housedelta = hidx - house
        delta = housedelta * 30 + 360

        asc = perchart.chart.getAngle(const.ASC)
        mc = perchart.chart.getAngle(const.MC)
        desc = perchart.chart.getAngle(const.DESC)
        ic = perchart.chart.getAngle(const.IC)

        asc.relocate((asc.lon + delta) % 360)
        mc.relocate((mc.lon + delta) % 360)
        desc.relocate((desc.lon + delta) % 360)
        ic.relocate((ic.lon + delta) % 360)

        for hobj in perchart.chart.houses:
            hobj.relocate((hobj.lon + delta) % 360)

        planetobj = perchart.chart.getObject(planet)
        planetobj.relocate(newlon)

        perchart.reinit()
        return perchart

    # =====================================================================
    # 主限法 3D 天球(/predict/pd3d)—— WS-3 纯加法扩展
    # 铁律:以下方法全部为**新增**,不改动任何既有函数体。表行原样取自既有
    # getPrimaryDirectionByZ()(弧/日期零重算);点位坐标复刻「生成该表的引擎」
    # 内部同一条构造路径(flatlib N/D/S 建点 → 真交点重建 _rebuildCoreNodePoint
    # → ΔT 校准 _corePdDeltaTPointMap → 映点/界扩展 → Vertex;pd_engine 族走
    # _pdEngineChartData + pd_engine 同名公式),绝不另起炉灶自算,保证 3D 展示
    # 与表格逐位同源。默认 Alcabitius+Ptolemy 表格路径字节级不动(540 golden 看守)。
    # =====================================================================

    # pd_engine 数值/闭式引擎族(点位构造走 _pdEngineChartData 同路)
    # placidus / regiomontanus / campanus 与 In Zodiaco 的 topocentric / Placidus 极下法,表行与核心核同一套取点
    # (见 _getPrimaryDirectionByZSemiarcPole),3D 点位随之走核心点表;In Mundo 的 topocentric 表行仍出自 pd_engine,
    # 点位走 pd_engine 点表(世俗向运带真黄纬)。
    _PD3D_ENGINE_METHODS = ('topocentric',)
    # 位置圈需后端采样多段线的方位法 → 采样所用 house_pos 系统。
    # Placidus 比例圈 / Topocentric 极圈都不是天球大圆(前端三点叉积画不动)→ 后端采样;
    # horosa_legacy 即 flatlib 比例半弧法,几何上=Placidus 世俗位置等值线,同享采样。
    # 其余方法(core 核族/Regio/Campanus 等)返回语义型标记,由前端画大圆。
    _PD3D_SAMPLED_CIRCLE_SYSTEM = {
        'placidus': 'placidus',
        'horosa_legacy': 'placidus',
    }
    # 极下式(Topocentric / Placidus 极下法):位置圈是过应星、以应星自己的极为倾角的大圆,按该圆精确采样
    _PD3D_POLE_CIRCLE_KIND = {
        'topocentric': 'topocentric',
        'placidus_under_pole': 'placidus_pole',
        'horizontal': 'horizontal',
        'koch': 'koch',
    }

    def _pd3dKindOf(self, pid):
        """点位分类(kind):按表行 id 编码解析——T_*=界;A_/C_*=映点;D/S 前缀或
        相位角≠0=相位虚点;其余按本体归类(angle/house/node/lot/vertex/planet)。
        仅作前端着色/图例用,不参与任何几何计算。"""
        text = '{0}'.format(pid if pid is not None else '')
        parts = text.split('_')
        prefix = parts[0] if parts else ''
        if prefix == 'T':
            return 'term'
        if prefix in ('A', 'C'):
            return 'antiscia'
        asp = 0.0
        if len(parts) >= 3:
            try:
                asp = float(parts[-1])
            except Exception:
                asp = 0.0
        if prefix in ('D', 'S') or abs(asp) > 1e-9:
            return 'aspect'
        base = self._baseDirectionObjectId(pid)
        if base in (const.ASC, const.MC, const.DESC, const.IC):
            return 'angle'
        if base in (const.NORTH_NODE, const.SOUTH_NODE):
            return 'node'
        if base == const.PARS_FORTUNA:
            return 'lot'
        if base in (CORE_PD_VERTEX_ID, CORE_PD_ANTIVERTEX_ID):
            return 'vertex'
        if base.startswith('House'):
            return 'house'
        # S/P 扩展体(P2):中间宫始点/恒星/阿拉伯点——kind 决定前端着色与 ★ 标。
        if re.match(r'^Cusp\d+$', base):
            return 'house'
        if base in self._PD_STAR_ROSTER:
            return 'star'
        if base.startswith('Pars '):
            return 'lot'
        return 'planet'

    def _pd3dPointEntry(self, point, eps_mean, kind, use_engine_trig=False):
        """点位出参:lon/lat + 赤道坐标两口径。
        ra/decl   = 按点自身黄纬换算(真β,世俗几何/物理天球位置);
        raZ/declZ = 黄纬取 0 的黄道投影点(In-Zodiaco 弧几何所用赤纬,前端画迫星
                    周日圈用 declZ,虚点 lat=0 时两口径相等)。
        换算路径与各自表格引擎逐位同路:pd_engine 族用 pd_engine.ecl_to_eq(内部
        三角式),core 核族用 _coreEqCoords(swisseph.cotrans);legacy(flatlib G)
        已带赤道坐标 → 原样透传(flatlib 固定黄赤交角口径,与 legacy 表格同源)。"""
        lon = float(point.get('lon', 0.0))
        lat = float(point.get('lat', 0.0))
        if point.get('ra') is not None and point.get('decl') is not None:
            ra, decl = float(point['ra']), float(point['decl'])
            raz = float(point.get('raZ', ra))
            declz = float(point.get('declZ', decl))
        elif use_engine_trig:
            from astrostudy import pd_engine
            ra, decl = pd_engine.ecl_to_eq(lon, lat, eps_mean)
            raz, declz = pd_engine.ecl_to_eq(lon, 0.0, eps_mean)
        else:
            ra, decl = self._coreEqCoords(lon, lat, eps_mean)
            raz, declz = self._coreEqCoords(lon, 0.0, eps_mean)
        return {
            'lon': lon,
            'lat': lat,
            'ra': float(ra),
            'decl': float(decl),
            'raZ': float(raz),
            'declZ': float(declz),
            'kind': kind,
        }

    def _pd3dEnginePointList(self, method):
        """pd_engine 族(placidus / regiomontanus / campanus / topocentric)点位构造——
        与 getPrimaryDirectionByZEngine → pd_engine.build_directions 逐位同路:
        bodies/angles 出自 _pdEngineChartData(内含 ΔT 校准与真交点口径),虚点
        (N 本体黄道点 / D=+asp、S=−asp 相位点 / 映点 / 界)用 pd_engine 同名公式
        直算。返回 (pts{id:(point,kind)}, armc, phi, eps_mean, jd)。"""
        from astrostudy import pd_engine
        bodies, angles, armc, phi, eps, jd = self._pdEngineChartData()
        sig_bodies, bodies = self._pdEngineOptionBodies(bodies, self._PD_ENGINE_SIGNIFICATORS,
                                                        self._PD_ENGINE_PROMISSORS)
        aspects = list(self.perchart.pdaspects) if self.perchart.pdaspects else [0, 60, 90, 120, 180]
        include_antiscia = bool(getattr(self.perchart, 'pdAntiscia', False))
        include_terms = bool(getattr(self.perchart, 'pdTerms', False))
        pts = {}
        # In Mundo(pdtype=1)本体带真黄纬,与 getPrimaryDirectionByM → build_directions(zodiacal=False)同口径
        mundo = (getattr(self.perchart, 'pdtype', 0) or 0) == 1
        # 应星(significators):四轴 lat=0;体点在 In-Zodiaco 下 lat=0,位置圈双支法
        # (Campanus/Regiomontanus)例外用真黄纬 —— 与 build_directions 完全同口径。
        for sname in self._PD_ENGINE_SIGNIFICATORS:
            sid = 'N_%s_0' % sname
            if sname in pd_engine.ANGLE_NAMES:
                if sname not in angles:
                    continue
                pts[sid] = ({'lon': float(angles[sname]), 'lat': 0.0}, 'angle')
            elif sname in sig_bodies:
                sig_beta = mundo or (method in pd_engine.POSITION_CIRCLE_DUAL)
                pts[sid] = ({'lon': sig_bodies[sname]['lon'],
                             'lat': sig_bodies[sname].get('lat', 0.0) if sig_beta else 0.0},
                            self._pd3dKindOf(sid))
        # 迫星(promissors):本体黄道点 + 黄道相位虚点(id 编码与 build_directions 同式)。
        # 同 id 已存(应星先写)则跳过 —— 双支法下应星带真β,展示以应星取数为准。
        for pname in self._PD_ENGINE_PROMISSORS:
            if pname not in bodies:
                continue
            base = bodies[pname]
            for asp in aspects:
                combos = [(0, 'N')] if asp == 0 else [(1, 'D'), (-1, 'S')]
                for sgn, prefix in combos:
                    pid = '%s_%s_%d' % (prefix, pname, asp)
                    if pid in pts:
                        continue
                    if asp == 0:
                        pt = {'lon': base['lon'], 'lat': base.get('lat', 0.0) if mundo else 0.0}
                    else:
                        pt = pd_engine.zodiacal_aspect_point(base['lon'], asp, sgn)
                    pts[pid] = (pt, self._pd3dKindOf(pid))
            if include_antiscia:
                for fn, pre in ((pd_engine.antiscion, 'A'), (pd_engine.contra_antiscion, 'C')):
                    pid = '%s_%s_0' % (pre, pname)
                    if pid not in pts:
                        pts[pid] = ({'lon': fn(base['lon']), 'lat': 0.0}, 'antiscia')
        if include_terms:
            for ruler, sgn_idx, tlon in pd_engine.term_boundaries():
                rname = pd_engine.TERM_RULER_FULL.get(ruler, ruler)
                tsname = pd_engine.TERM_SIGN_NAMES[int(sgn_idx) % 12]
                pid = 'T_%s_%s' % (rname, tsname)
                if pid not in pts:
                    pts[pid] = ({'lon': float(tlon), 'lat': 0.0}, 'term')
        return pts, float(armc), float(phi), float(eps), float(jd)

    def _pd3dCorePointList(self):
        """core 核族(Alcabitius 系 / meridian / porphyry / equal_* / morinus /
        in_zodiaco_lon / in_zodiaco_abs)点位构造 —— 与 getPrimaryDirectionByZCoreKernel
        逐位同路:flatlib N/D/S 建点 → 真交点重建(TRUE_NODE)→ ΔT 校准(未来盘
        平移到参考 ΔT,历史盘 δ≈0 恒等)→ 映点/界扩展 → 宿命点(Vertex)应星。
        返回 (pts{id:(point,kind)}, armc, phi, eps_mean, jd)。"""
        chart = self.perchart.getChart()
        pd = PrimaryDirections(chart)
        aspList = self.perchart.pdaspects
        sig_objs = pd._elements(CORE_PD_SIGNIFICATOR_IDS, pd.N, [0])
        sig_houses = pd._elements(pd.SIG_HOUSES, pd.N, [0])
        sig_angles = pd._elements(pd.SIG_ANGLES, pd.N, [0])
        significators = sig_objs + sig_houses + sig_angles
        promissors = pd._elements(CORE_PD_PROMISSOR_IDS, pd.N, aspList)
        node_base_lons = self._coreTrueNodeBaseLons(chart)
        significators = [self._rebuildCoreNodePoint(pd, o, node_base_lons) for o in significators]
        promissors = [self._rebuildCoreNodePoint(pd, o, node_base_lons) for o in promissors]
        _dt = self._corePdDeltaTPointMap(chart)
        if _dt:
            significators = [self._coreShiftPointByDeltaT(o, _dt) for o in significators]
            promissors = [self._coreShiftPointByDeltaT(o, _dt) for o in promissors]
        significators, promissors = self._pdApplyLatitudeOptions(significators, promissors)
        # 映点(antiscia)/界(terms)促发星扩展 —— 与 kernel 同口径:本体 lon 取已
        # 真交点重建 + ΔT 平移后的 N_*_0。
        _want_anti = bool(getattr(self.perchart, 'pdAntiscia', False))
        _want_terms = bool(getattr(self.perchart, 'pdTerms', False))
        # 赤纬平行/反平行(映点法实现,黄道点;PD_/PC_ 前缀,与映点独立开关)
        _want_par = bool(getattr(self.perchart, 'pdParallel', False))
        if _want_anti or _want_terms or _want_par:
            from astrostudy import pd_engine as _pde
            _base_lons = {}
            for _p in promissors:
                _parts = '{0}'.format(_p.get('id') or '').split('_')
                if len(_parts) == 3 and _parts[0] == 'N' and _parts[2] == '0':
                    _base_lons[_parts[1]] = _p.get('lon')
            _mirror_specs = []
            if _want_anti:
                _mirror_specs += [(_pde.antiscion, 'A'), (_pde.contra_antiscion, 'C')]
            if _want_par:
                _mirror_specs += [(_pde.antiscion, 'PD'), (_pde.contra_antiscion, 'PC')]
            if _mirror_specs:
                for _bn, _bl in _base_lons.items():
                    if _bl is None:
                        continue
                    for _fn, _pre in _mirror_specs:
                        promissors.append({'id': '{0}_{1}_0'.format(_pre, _bn),
                                           'lon': angle.norm(_fn(float(_bl))), 'lat': 0.0})
            if _want_terms:
                for _ruler, _sign, _tlon in _pde.term_boundaries(getattr(self.perchart, 'termsVariant', 0)):
                    promissors.append({'id': 'T_{0}_{1}'.format(
                                           _pde.TERM_RULER_FULL.get(_ruler, _ruler),
                                           _pde.TERM_SIGN_NAMES[int(_sign) % 12]),
                                       'lon': angle.norm(float(_tlon)), 'lat': 0.0})
        geo_lat = self._coreParseCoord(getattr(self.perchart, 'lat', 0.0))
        geo_lon = self._coreParseCoord(getattr(self.perchart, 'lon', 0.0))
        ascmc = _polarSafeHousesEx(chart.date.jd, geo_lat, geo_lon, b'P')[1]
        # 宿命点(Vertex)应星:点位取 ascmc[3],与 kernel 展示口径同源。
        significators.append({'id': 'N_{0}_0'.format(CORE_PD_VERTEX_ID),
                              'lon': angle.norm(float(ascmc[3])), 'lat': 0.0})
        # In Mundo 另有下降 / 天底 / 东点(宿命点对点)轴应星。
        significators.append({'id': 'N_{0}_0'.format(const.DESC), 'lon': angle.norm(float(ascmc[0]) + 180.0), 'lat': 0.0})
        significators.append({'id': 'N_{0}_0'.format(const.IC), 'lon': angle.norm(float(ascmc[1]) + 180.0), 'lat': 0.0})
        significators.append({'id': 'N_{0}_0'.format(CORE_PD_ANTIVERTEX_ID),
                              'lon': angle.norm(float(ascmc[3]) + 180.0), 'lat': 0.0})
        pts = {}
        # 应星在后写:同 id(如 N_Sun_0 既作迫星又作应星)以应星构造取数为准
        # (core 族两者本就同点,此序仅为约定一致)。
        for o in promissors + significators:
            oid = o.get('id')
            if oid is None:
                continue
            pts[oid] = ({'lon': o.get('lon'), 'lat': o.get('lat', 0.0)},
                        self._pd3dKindOf(oid))
        eps_mean = self._coreMeanObliquity(chart)
        return pts, float(ascmc[2]), float(geo_lat), float(eps_mean), float(chart.date.jd)

    def _pd3dLegacyPointList(self):
        """horosa_legacy(flatlib 原生半弧)点位构造 —— 与 getPrimaryDirectionByZLegacy
        → flatlib PrimaryDirections.getList 逐位同路:直接复刻其 significator/promissor
        列表(含界/映点),点位即 flatlib G() 字典(自带 ra/decl/raZ/declZ,固定黄赤
        交角口径,与 legacy 表格同源,原样透传)。"""
        chart = self.perchart.getChart()
        pd = PrimaryDirections(chart)
        aspList = self.perchart.pdaspects
        significators = (pd._elements(pd.SIG_OBJECTS, pd.N, [0])
                         + pd._elements(pd.SIG_HOUSES, pd.N, [0])
                         + pd._elements(pd.SIG_ANGLES, pd.N, [0]))
        promissors = (pd._elements(pd.SIG_OBJECTS, pd.N, aspList)
                      + pd._terms()
                      + pd._elements(pd.SIG_OBJECTS, pd.A, [0])
                      + pd._elements(pd.SIG_OBJECTS, pd.C, [0]))
        pts = {}
        for o in promissors + significators:
            oid = o.get('id')
            if oid is None:
                continue
            pts[oid] = (dict(o), self._pd3dKindOf(oid))
        geo_lat = self._coreParseCoord(getattr(self.perchart, 'lat', 0.0))
        geo_lon = self._coreParseCoord(getattr(self.perchart, 'lon', 0.0))
        ascmc = _polarSafeHousesEx(chart.date.jd, geo_lat, geo_lon, b'P')[1]
        eps_mean = self._coreMeanObliquity(chart)
        return pts, float(ascmc[2]), float(geo_lat), float(eps_mean), float(chart.date.jd)

    def getPrimaryDirection3D(self):
        """主限法 3D 天球数据(/predict/pd3d)。输出:
        rows   — 既有 getPrimaryDirectionByZ() 表行原样 join(弧/应期日期零重算),
                 [{i,arc,prom,sig,cat,date}] 与 /predict/pd 的 pdlist 逐位同源;
        points — 表行引用到的每个 id 的引擎真实坐标
                 {lon,lat,ra,decl,raZ,declZ,kind},取数路径与生成该表的引擎完全
                 同一条(真交点重建 + ΔT 校准 + 同式虚点公式);
        circles— 每个应星的「位置圈」:ASC=horizon-east(东地平)/ MC=meridian
                 (子午圈)/ Vertex=prime-vertical(卯酉圈)语义型;Placidus/
                 Topocentric(及 legacy 半弧)= sampled 采样多段线(允许断段);
                 Regio/Campanus=position-circle(大圆,前端三点叉积直画);
                 in_zodiaco_lon=ecliptic-meridian;其余核族=hour-circle(时圈);
        frame  — armc(swisseph houses_ex 的 ascmc[2] 直出,勿用 MC.ra)/
                 phi(地理纬度)/ eps(当日真黄赤交角,展示框架用)/
                 epsMean(引擎内部换算用 mean ε)/ jd / pdMethod / pdTimeKey。"""
        method = getattr(self.perchart, 'pdMethod', 'core_alchabitius') or 'core_alchabitius'
        if method not in _PD_METHOD_REGISTRY:
            # 与 getPrimaryDirectionByZ 的 fallback 同口径:未知方法一律按默认核处理。
            method = 'core_alchabitius'
        # pdtype 四路分派(镜像 getPrimaryDirection):此前硬走 ByZ —— 用户选 In-Mundo(1)/
        # 界推运(2,3)时 2D 表=ByM/界、3D 球=ByZ,弧/应期/事件全不同且无告警(体检定谳第5项)。
        # rows 与 2D 表逐位同源;golden 路径(/predict/pd)零触碰。
        pdtype = getattr(self.perchart, 'pdtype', 0) or 0
        if pdtype in (2, 3):
            pdlist = self.getTermDirection(pdtype == 2)
        else:
            # 与表格同一个出口(传统 / 新式逆向、相位侧、恒星迫星编号逐行一致)
            pdlist = self._pdAspectRows(pdtype if pdtype in (1, 4) else 0)
        rows = []
        for i, it in enumerate(pdlist):
            rows.append({
                'i': i,
                'arc': float(it[0]),
                'prom': it[1],
                'sig': it[2],
                'cat': it[3] if len(it) > 3 else 'Z',
                'date': it[4] if len(it) > 4 else '',
            })
        proj_e, _fe = self._pdResolveProjectionFrame()
        engine_family = pdtype == 1 and (proj_e in self._PD3D_ENGINE_METHODS or method in self._PD3D_ENGINE_METHODS)
        if engine_family:
            pts, armc, phi, eps_mean, jd = self._pd3dEnginePointList(proj_e if proj_e in self._PD3D_ENGINE_METHODS else method)
        elif method == 'horosa_legacy':
            pts, armc, phi, eps_mean, jd = self._pd3dLegacyPointList()
        else:
            pts, armc, phi, eps_mean, jd = self._pd3dCorePointList()
        if pdtype == 4:
            # Field Plane:相位点按借用黄纬落位(与表格同一次计算的结果)
            for pid, beta in (getattr(self, '_pdFieldPlaneLatitudes', None) or {}).items():
                if pid in pts and beta is not None:
                    pt, kind = pts[pid]
                    pts[pid] = (dict(pt, lat=float(beta)), kind)
        # 只回传表行实际引用到的 id(join 封闭:凡 rows 引用必有点位)。
        used = []
        seen = set()
        for r in rows:
            for key in (r['prom'], r['sig']):
                if key not in seen:
                    seen.add(key)
                    used.append(key)
        points = {}
        # 界推运点域=TermDirection 自家 id 族(N_/D_/S_ 相位点、T_ 界点、A_/C_ 映点,对象域含
        # Dark Moon 等扩展体)——与标准对象点表不同源。缺失 id 用 td 实例把 promissors+
        # significators 全集构成 {id: 元素} map 就地补造:全部为 β=0 黄道点(G(ID,lon) 语义,
        # plan 定谳「界推运界点=黄道 β=0 点同 Z 类」),kind 按前缀归类。
        td_point_map = None
        if pdtype in (2, 3):
            try:
                td_pts = TermDirection(self.perchart.getChart(), pdtype == 2)
                asp_list = list(getattr(self.perchart, 'pdaspects', None) or [0])
                elems = (td_pts._elements(td_pts.SIG_OBJECTS, td_pts.N, [0])
                         + td_pts._elements(td_pts.SIG_HOUSES, td_pts.N, [0])
                         + td_pts._elements(td_pts.SIG_ANGLES, td_pts.N, [0])
                         + td_pts._elements(td_pts.SIG_OBJECTS, td_pts.N, asp_list)
                         + td_pts._terms()
                         + td_pts._elements(td_pts.SIG_OBJECTS, td_pts.A, [0])
                         + td_pts._elements(td_pts.SIG_OBJECTS, td_pts.C, [0]))
                td_point_map = {}
                for el in elems:
                    td_point_map.setdefault(el['id'], el)
            except Exception:
                td_point_map = None
        # S/P 扩展点补造层:HC_/FS_/LT_ 迫星与 N_(Desc|IC|Syzygy|Spirit|CuspN|恒星|阿点) 应星
        # 不在三源点表 —— 用扩展目录(与表格引擎同一坐标源,恒星携真β)就地补齐,
        # 否则 selectRow 无 mover 坐标 → 播放动画退化成空转(无路径弧/无活动标)。
        # 默认(两键全空)目录为空 = 零开销零回归。
        extra_point_map = {}
        try:
            _ch_extra = self.perchart.getChart()
            for _pt in (self._pdExtraSignificatorPoints(_ch_extra)
                        + self._pdExtraCuspPromissorPoints(_ch_extra, aspects=self.perchart.pdaspects, public=True)):
                extra_point_map.setdefault(_pt['id'], _pt)
        except Exception:
            extra_point_map = {}
        for pid in used:
            got = pts.get(pid)
            if got is None and extra_point_map:
                el_x = extra_point_map.get(pid)
                if el_x is not None and el_x.get('lon') is not None:
                    points[pid] = self._pd3dPointEntry(
                        {'lon': float(el_x['lon']) % 360.0, 'lat': float(el_x.get('lat', 0.0) or 0.0)},
                        eps_mean, self._pd3dKindOf(pid), use_engine_trig=engine_family)
                    continue
            if got is None:
                el = td_point_map.get(pid) if td_point_map else None
                if el is not None and el.get('lon') is not None:
                    if pid.startswith('T_'):
                        kind_miss = 'term'
                    elif pid.startswith('A_') or pid.startswith('C_'):
                        kind_miss = 'antiscia'
                    elif pid.startswith('D_') or pid.startswith('S_'):
                        kind_miss = 'aspect'
                    else:
                        kind_miss = 'object'
                    points[pid] = self._pd3dPointEntry(
                        {'lon': float(el['lon']) % 360.0, 'lat': 0.0}, eps_mean, kind_miss,
                        use_engine_trig=engine_family)
                    continue
                # 其余缺失防御性跳过,由测试看守封闭性。
                continue
            pt, kind = got
            points[pid] = self._pd3dPointEntry(pt, eps_mean, kind,
                                               use_engine_trig=engine_family)
        # 应星位置圈(每个 sig id 一条)。类型按 resolved projection 判(P0 解耦后
        # pdProjection 可独立于旧 pdMethod;proj 优先、method 兜底,默认 ptolemy
        # 不在任何特判 → hour-circle 与旧输出字节一致)。
        circles = {}
        proj_c, _cf = self._pdResolveProjectionFrame()
        sampled_system = (self._PD3D_SAMPLED_CIRCLE_SYSTEM.get(proj_c)
                          or self._PD3D_SAMPLED_CIRCLE_SYSTEM.get(method))
        pole_kind = self._PD3D_POLE_CIRCLE_KIND.get(proj_c) or self._PD3D_POLE_CIRCLE_KIND.get(method)
        for r in rows:
            sid = r['sig']
            if sid in circles:
                continue
            base = self._baseDirectionObjectId(sid)
            if base == const.ASC:
                circles[sid] = {'type': 'horizon-east'}
            elif base == const.MC:
                circles[sid] = {'type': 'meridian'}
            elif base == CORE_PD_VERTEX_ID:
                circles[sid] = {'type': 'prime-vertical'}
            elif pole_kind is not None and sid in pts:
                from astrostudy import pd_engine
                sig_src = pts[sid][0]
                circles[sid] = {'type': 'sampled', 'points': pd_engine.pole_circle_samples(
                    {'lon': float(sig_src.get('lon', 0.0)), 'lat': float(sig_src.get('lat', 0.0))},
                    pole_kind, armc, phi, eps_mean, n=64)}
            elif sampled_system is not None and sid in pts:
                from astrostudy import pd_engine
                sig_src = pts[sid][0]
                sig_pt = {'lon': float(sig_src.get('lon', 0.0)),
                          'lat': float(sig_src.get('lat', 0.0))}
                if method == 'horosa_legacy':
                    # legacy 行均为 'Z'(In-Zodiaco):位置圈按黄纬 0 的投影点采样。
                    sig_pt['lat'] = 0.0
                segs = pd_engine.position_circle_samples(
                    sig_pt, sampled_system, armc, phi, eps_mean, n=64)
                circles[sid] = {'type': 'sampled', 'points': segs}
            elif proj_c in ('regiomontanus', 'campanus') or method in ('regiomontanus', 'campanus'):
                circles[sid] = {'type': 'position-circle'}
            elif proj_c == 'in_zodiaco_lon' or method == 'in_zodiaco_lon':
                circles[sid] = {'type': 'ecliptic-meridian'}
            else:
                circles[sid] = {'type': 'hour-circle'}
        chart = self.perchart.getChart()
        frame = {
            'armc': float(armc),
            'phi': float(phi),
            'eps': self._coreTrueObliquity(chart),
            'epsMean': float(eps_mean),
            'jd': float(jd),
            'pdMethod': method,
            'pdType': int(pdtype),
            'pdTimeKey': '{0}'.format(getattr(self.perchart, 'pdTimeKey', 'Ptolemy') or 'Ptolemy'),
        }
        return {
            'frame': frame,
            'points': points,
            'circles': circles,
            'rows': rows,
        }
