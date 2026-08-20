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
from astrostudy import solararc
from astrostudy import firdaria
from astrostudy import zreleasing
from astrostudy import yearsystem129
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
    # 近 core 但有 ~2° 专属修正(确切式待续)，暂以 core 近似：
    'morinus': 'getPrimaryDirectionByZCoreKernel',
    # 独立闭式(已实测)：黄经差 / |RA差|
    'in_zodiaco_lon': 'getPrimaryDirectionByZAlongEcliptic',
    'in_zodiaco_abs': 'getPrimaryDirectionByZEdmundJones',
}


# 主限法盘(dial)宫制映射：方位法本质即「定盘宫制」，故主限法盘的宫始点(house cusps)
# 应随所选方位法变化。下列 8 个有把握的方位法直接映射到对应 swisseph 宫位系统；
# morinus 亦有原生 swisseph 宫制('M')一并映上。equal_hour_circle / in_zodiaco_lon /
# in_zodiaco_abs / 任何未列出的方法一律 fallback 到本命盘宫制(self.perchart.house)——
# 诚实不臆造(equal_hour_circle 无干净 swisseph 等价，沿用本命宫制保守且无回归风险)。
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
    'morinus': ('ptolemy', 'morinus'),
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
    'zodiacal': 'getPrimaryDirectionByZZodiacalOA',
    'placidus_under_pole': 'getPrimaryDirectionByZPlacidusUnderPole',
    'ra_direct': 'getPrimaryDirectionByZRaDirect',
    'in_zodiaco_lon': 'getPrimaryDirectionByZAlongEcliptic',
    'in_zodiaco_abs': 'getPrimaryDirectionByZEdmundJones',
    'horosa_legacy': 'getPrimaryDirectionByZLegacy',
}

# 定局 frame → 盘面宫制。equal_hour_circle 无干净 swisseph 等价 → 不映射(回落本命盘宫制)。
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
    # 每个 key 的「年度赤经度量」(1 年对应多少度赤经弧)；arc→日期 = arc / scale。
    'Ptolemy': 1.0,             # 1° RA = 1 年(古典定义)
    'Naibod': 0.9856473354,     # 太阳平均周日运动 0°59'08"
    'Cardano': 0.98667,
    'Umar': 0.98631,            # Umar al-Tabari
    'Wollner': 0.98604,         # Wöllner
    'Plantiko': 1.01180,
    'SynodicYear': 0.98436,
    # Simmonite/Kepler/Brahe 已迁出静态表 → 「每盘常数」型(见 PER_CHART_TIME_KEY_FALLBACK)。
    'NaibodRA': 0.9856473354,   # Naibod-in-RA:同值,严格沿赤经度量(命名对齐)
    'AscendantArc': 1.0,        # Ascendant-arc key:1 年=ASC 斜升 1°(界行自洽)
    'SymbolicDegree': 1.0,      # 1°/年(=Ptolemy)
    'Kundig': 1.0,              # Kündig:30 例数据逐盘 spread=0,与 SymbolicDegree 同为 1°/年
    'SymbolicYear': 0.98563,
    'SymbolicMoon': 13.16996,   # 月亮平均周日运动度数/年
    'SymbolicMonth': 4.0,
    'Quarterly': 0.25,
    'Quinary': 6.0,
    'Duodenary': 2.5,
    'Novenary': 3.33337,
    'SelfMeasure': 1.85716,
}

# 每盘常数型钥匙:标度 = 本命太阳日运动(30 例数据逐盘 iqr≈3e-5 实证为盘内恒定):
#   Simmonite     = 出生时刻太阳黄经瞬时日速(星历 speed 分量)
#   Kepler/Brahe  = 生日向前差分 λ☉(jd0+1) − λ☉(jd0)(二者参考输出逐位相同)
# 旧版曾以单一常数近似(0.9847/0.98396),对远期盘有可见日期偏差,已换真式。
# chart 不可用时回退下列近似常数(防御性,正常路径恒有 chart)。
PER_CHART_TIME_KEY_FALLBACK = {
    'simmonite': 0.9847,
    'kepler': 0.98396,
    'brahe': 0.98396,
}


def _pdTimeKeyScale(time_key, chart=None, age=None, custom=None):
    """
    返回从「原始 PD 弧 (1°/年 符号年)」到「指定 time key 下的缩放弧」的倍数。
    static 键查 STATIC_TIME_KEY_SCALES;Simmonite/Kepler/Brahe 为「每盘常数」型,
    按本命太阳日运动逐盘取值;未识别 key 一律 fallback 到 Ptolemy = 1.0，
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
                jd = float(chart.date.jd)
                if kl == 'simmonite':
                    return float(swisseph.calc_ut(jd, swisseph.SUN)[0][3])
                lo0 = float(swisseph.calc_ut(jd, swisseph.SUN)[0][0])
                lo1 = float(swisseph.calc_ut(jd + 1.0, swisseph.SUN)[0][0])
                return (lo1 - lo0) % 360.0
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
        """ 界推运（Distributions）：上升点经主限运动依次穿过各埃及界。
        分配星(distributor)=该界主星；其期间内上升点又触及某行星→该行星为参与星(participant)。
        建于 TermDirection（与界限法同源、同 signasctime 时间换算）。 """
        chart = self.perchart.getChart()
        td = TermDirection(chart, True, terms_variant=getattr(self.perchart, 'termsVariant', 0))
        cusps = sorted(td._terms(), key=lambda c: c['dist'])
        sigAsc = td.N(const.ASC, 0)
        proms = td._elements(td.SIG_OBJECTS, td.N, [0])
        contacts = []
        for p in proms:
            if p['id'] == sigAsc['id']:
                continue
            arc = td._arc(p, sigAsc)
            if 0 < arc < td.MAX_ARC:
                pid = p['id'].split('_')
                contacts.append((arc, pid[1] if len(pid) >= 2 else p['id']))
        contacts.sort()
        rows = []
        for c in cusps:
            parts = c['id'].split('_')
            lord = parts[1] if len(parts) >= 2 else c['id']
            sign = parts[2] if len(parts) >= 3 else ''
            rows.append([c['dist'], lord, sign, 'DIST'])
        self.appendDateStr(rows, False)
        res = []
        for i, c in enumerate(cusps):
            startArc = c['dist']
            endArc = cusps[i + 1]['dist'] if i + 1 < len(cusps) else td.MAX_ARC
            ppts = [pid for (a, pid) in contacts if startArc <= a < endArc]
            res.append({
                'startArc': round(startArc, 2),
                'endArc': round(endArc, 2),
                'distributor': rows[i][1],
                'sign': rows[i][2],
                'startDate': rows[i][4] if len(rows[i]) > 4 else '',
                'endDate': rows[i + 1][4] if (i + 1 < len(rows) and len(rows[i + 1]) > 4) else '',
                'participants': ppts,
            })
        return res

    def getAgePoint(self):
        from astrostudy import agepoint
        return agepoint.compute(self.perchart, 72)

    def getPrimaryDirection(self):
        # 框架维:aspect=相位主限(默认,零回归)/bounds=界行(ASC×界分界线)/
        # release=释放(S=hyleg 自动定,P=anareta;强制免责,不出寿命年数)。
        framework = getattr(self.perchart, 'pdFramework', 'aspect') or 'aspect'
        if framework == 'release':
            return self.getPrimaryDirectionRelease()
        if framework == 'bounds':
            return self.getPrimaryDirectionBounds()
        pdtype = self.perchart.pdtype
        if pdtype == 0:
            return self.getPrimaryDirectionByZ()
        elif pdtype == 1:
            return self.getPrimaryDirectionByM()
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

    def _pdExtraCuspPromissorPoints(self, chart):
        """P 清单扩展(pdPromissorTypes):cusps=中间宫始点(HC_)/stars=恒星(FS_)/lots=阿拉伯点(LT_)。"""
        types = getattr(self.perchart, 'pdPromissorTypes', None) or []
        out = []
        if 'cusps' in types:
            out.extend(self._pdIntermediateCuspPoints(chart, 'HC'))
        if 'stars' in types:
            out.extend(self._pdFixedStarPoints('FS'))
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
        pole_fn = {'regiomontanus': pd_engine.pole_regiomontanus,
                   'campanus': pd_engine.pole_regiomontanus,
                   'topocentric': pd_engine.pole_topocentric}.get(proj, pd_engine.pole_placidus_approx)
        zodiacal = (getattr(self.perchart, 'pdtype', 0) or 0) == 0
        poles = {'Asc': round(geo_lat, 4), 'MC': 0.0, 'Desc': round(geo_lat, 4), 'IC': 0.0}
        names = list(self._PD_ENGINE_SIGNIFICATORS)
        for pt in self._pdExtraSignificatorPoints(chart):
            names.append(pt['id'].split('_')[1])
        seen = set()
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
            try:
                ra, dec = pd_engine.ecl_to_eq(lon, lat, eps)
                poles[name] = round(float(pole_fn(ra, dec, armc, geo_lat)), 4)
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
        zodiacal = (getattr(self.perchart, 'pdtype', 0) or 0) == 0
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

    _PD_ENGINE_SIGNIFICATORS = [
        const.ASC, const.MC, const.SUN, const.MOON, const.MERCURY,
        const.VENUS, const.MARS, const.JUPITER, const.SATURN,
    ]
    _PD_ENGINE_PROMISSORS = [
        const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS,
        const.JUPITER, const.SATURN, const.URANUS, const.NEPTUNE, const.PLUTO,
    ]

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
                terms_variant=getattr(self.perchart, 'termsVariant', 0))

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
        return self.getPrimaryDirectionByZEngine('placidus')

    def getPrimaryDirectionByZRegiomontanus(self):
        return self.getPrimaryDirectionByZEngine('regiomontanus')

    def getPrimaryDirectionByZCampanus(self):
        return self.getPrimaryDirectionByZEngine('campanus')

    def getPrimaryDirectionByZTopocentric(self):
        return self.getPrimaryDirectionByZEngine('topocentric')

    def getPrimaryDirectionByZPlacidusUnderPole(self):
        # Placidus under-the-pole(普氏位置半圆近似):极点式,略异严密半弧。
        return self.getPrimaryDirectionByZEngine('placidus_under_pole')

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
        lat = 0.0 if zero_lat else point.get('lat', 0.0)
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
        frame=None/未映射(equal_hour_circle 等)回退本命盘宫制。带双重兜底防越界。
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
        try:
            hlist, dir_ascmc = swisseph.houses_armc(armc, lat, float(obliquity), swhsys)
        except swisseph.Error:
            # 同上:盘面宫顶在极圈对象限制回退 Porphyry(与 flatlib sweHouses 兜底口径一致)。
            hlist, dir_ascmc = swisseph.houses_armc(armc, lat, float(obliquity), b'O')
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
        asctime = SignAscTime(self.perchart.date, self.perchart.time, asc.sign, self.perchart.lat, self.perchart.zone)
        current_arc = asctime.getPDArcFromDate(current_dt)
        # 度数换算 key：统一走 _pdTimeKeyScale 注册表 (见模块顶部 STATIC_TIME_KEY_SCALES)。
        # Ptolemy 缩放 == 1.0，护住默认路径字节级一致；其它 static key 按表缩放弧 (不碰表格)。
        pd_time_key = '{0}'.format(getattr(self.perchart, 'pdTimeKey', 'Ptolemy') or 'Ptolemy')
        # 真太阳弧(动态钥匙):盘也要逐盘真算,用 key 的逆 solar_arc_for_years(年→赤经弧),
        # 与表格 getDateFromPDArc(弧→年) round-trip 一致;否则盘会把它当 Ptolemy(scale 1.0)致盘表不符。
        if pd_time_key.lower() in ('truesolararc', 'placidus_key', 'kepler', 'vandam'):
            from astrostudy import pd_engine
            current_arc = float(pd_engine.solar_arc_for_years(float(current_arc), float(chart.date.jd)))
        elif pd_time_key.lower() == 'symbolicsolararc':
            from astrostudy import pd_engine
            current_arc = float(pd_engine.symbolic_solar_arc_for_years(float(current_arc), float(chart.date.jd)))
        else:
            current_arc = current_arc * _pdTimeKeyScale(
                pd_time_key, chart=chart,
                custom=getattr(self.perchart, 'pdTimeKeyCustom', None))
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
        promissors.extend(self._pdExtraCuspPromissorPoints(chart))

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
        """Along-Ecliptic 方位法(In Zodiaco)：arc = 黄经差 norm180(λ_sig − λ_prom_asp)。
        **合相(asp=0)逐位精确(median 0.00006°)**；非合相相位走不同口径(非黄经，似世俗，
        待分析，同 In-Mundo 相位口径)，此处暂以黄经相位近似。强制 In Zodiaco。"""
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
        max_arc = float(getattr(self.perchart, 'pdYears', 100) or 100)
        tiny = 1e-12
        pdlist = []
        for prom in promissors:
            prom_id = prom.get('id')
            plon = prom.get('lon')
            if prom_id is None or plon is None:
                continue
            for sig in significators:
                sig_id = sig.get('id')
                if sig_id is None or prom_id == sig_id:
                    continue
                if self._baseDirectionObjectId(prom_id) == self._baseDirectionObjectId(sig_id):
                    continue
                slon = sig.get('lon')
                if slon is None:
                    continue
                raw_arc_delta = float(slon) - float(plon)
                arc = self._norm180(raw_arc_delta)
                if abs(arc) <= tiny or abs(arc) > max_arc:
                    continue
                if max_arc <= 180.0 and self._isCorePlanetPair(prom_id, sig_id):
                    # 本法弧=黄经差,窗用其 pre-norm 原值(与核同口径:弧自身归一化前的量)。
                    if not self._passesCoreDisplayWindow(raw_arc_delta):
                        continue
                pdlist.append([arc, prom_id, sig_id, 'Z'])
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

    def getPrimaryDirectionByZEdmundJones(self):
        """Edmund Jones 方位法(In Zodiaco)：≈|Alcabitius 弧|(=|RA差|)，禁 converse(恒正)。
        **合相逐位精确(median 0.00004°)**；非合相相位走不同口径(同 In-Mundo，待分析)，暂近似。"""
        rows = self.getPrimaryDirectionByZCoreKernel()
        best = {}
        for r in rows:
            key = (r[1], r[2])
            a = abs(float(r[0]))
            if key not in best or a < best[key][0]:
                best[key] = [a, r[1], r[2], r[3]]
        out = list(best.values())
        out.sort(key=lambda it: (abs(it[0]), it[0], it[1], it[2]))
        return out

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
        promissors.extend(self._pdExtraCuspPromissorPoints(chart))
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

    def getPrimaryDirectionByM(self):
        # 世俗向运(in mundo)。placidus 等走 pd_engine；core 走纯公式世俗核；legacy 仍走 flatlib 'M'。
        # 分发按 resolved projection;旧 morinus/in_zodiaco_lon/in_zodiaco_abs/horosa_legacy 在
        # 未显式指定 pdProjection 时精确保持 flatlib legacy 'M' 输出(零回归)。
        proj, _frame = self._pdResolveProjectionFrame()
        method = getattr(self.perchart, 'pdMethod', 'core_alchabitius') or 'core_alchabitius'
        explicit_proj = getattr(self.perchart, 'pdProjection', None) is not None
        if proj in ('placidus', 'regiomontanus', 'campanus', 'topocentric'):
            pdlist = self.getPrimaryDirectionByZEngine(proj, zodiacal=False)
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

    def appendDateStr(self, pdlist, usePD=True):
        chart = self.perchart.getChart()
        # 度数换算 key：统一走 _pdTimeKeyScale (见模块顶部 STATIC_TIME_KEY_SCALES)。
        # 表格是「弧→日期」(盘是「日期→弧」的逆)，故按 scale 除弧 (同弧需更多年)，
        # 与盘的 getPrimaryDirectionChartByDate 乘 scale 互逆、可 round-trip。
        # 仅缩放日期、不动弧/动星/应星；Ptolemy scale == 1.0 逐字节不变，
        # 护住已验证的 Ptolemy+Alchabitius 表格。
        pd_time_key = '{0}'.format(getattr(self.perchart, 'pdTimeKey', 'Ptolemy') or 'Ptolemy')
        # 真太阳弧(Placidus key)/太阳弧(黄经)是动态钥匙:逐弧查星历求真太阳走到目标位置的
        # 天数(1天=1年),非静态缩放。Ptolemy/Naibod 等仍走 _pdTimeKeyScale(Ptolemy 锁 1.0 字节级一致)。
        # Kepler(太阳真行赤经)/Van Dam(Placidus 改良度量)升逐年真行动态,
        # 与 Placidus 真太阳弧同设施(key_placidus_true_solar_arc)。
        use_solar_arc = pd_time_key.lower() in ('truesolararc', 'placidus_key', 'kepler', 'vandam')
        use_sym_solar_arc = pd_time_key.lower() == 'symbolicsolararc'
        natal_jd = float(chart.date.jd) if (use_solar_arc or use_sym_solar_arc) else None
        scale = _pdTimeKeyScale(pd_time_key, chart=chart,
                                 custom=getattr(self.perchart, 'pdTimeKeyCustom', None))
        for item in pdlist:
            asc = chart.angles.get(const.ASC)
            asctime = SignAscTime(self.perchart.date, self.perchart.time, asc.sign, self.perchart.lat, self.perchart.zone)
            datestr = None
            if usePD:
                if use_solar_arc:
                    from astrostudy import pd_engine
                    # 真太阳弧:把方向弧换算为年(Ptolemy 等效 1°=1年),再走同一日期函数。
                    arc_for_date = float(pd_engine.key_placidus_true_solar_arc(float(item[0]), natal_jd))
                elif use_sym_solar_arc:
                    from astrostudy import pd_engine
                    arc_for_date = float(pd_engine.key_symbolic_solar_arc(float(item[0]), natal_jd))
                else:
                    arc_for_date = (item[0] / scale) if scale and scale != 1.0 else item[0]
                datestr = asctime.getDateFromPDArc(arc_for_date)
            else:
                datestr = asctime.getDateFromTermDirArc(item[0])
            item.append(datestr)


    def getProfection(self, nodeRetrograde=False, asporb=-1):
        res = []
        for i in range(1, 100):
            year = int(self.perchart.year) + i
            date = '{0}/{1}/{2}'.format(year, self.perchart.month, self.perchart.day)
            dt = Datetime(date, self.perchart.time, self.perchart.zone)
            chart = profections.compute(self.perchart.chart, dt, False, nodeRetrograde)
            obj = {
                'date': '{0}-{1}-{2}'.format(year, self.perchart.month, self.perchart.day),
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
        st = int(self.perchart.year) + 1
        ed = int(self.perchart.year) + 90
        zone = params['zone']

        for i in range(st, ed):
            chart = self.perchart.chart.solarReturn(i)
            srdt = Datetime.fromJD(chart.date.jd, zone)
            srdtstr = srdt.toCNString()
            dirparts = srdtstr.split(' ')
            cparams = copy.deepcopy(params)
            cparams['date'] = dirparts[0]
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
        srdtstr = srdt.toCNString()
        dirparts = srdtstr.split(' ')
        params['date'] = dirparts[0]
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
        srdtstr = srdt.toCNString()
        dirparts = srdtstr.split(' ')
        params['date'] = dirparts[0]
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
        srdtstr = srdt.toCNString()
        dirparts = srdtstr.split(' ')
        params['date'] = dirparts[0]
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

        parts = dirparts[0].split('-')
        m = parts[1]
        if int(parts[2]) < 5:
            dt = '{0}/{1}/21'.format(parts[0], parts[1])
            tm = '00:00'
            zone = params['zone']
            returnDate = Datetime(dt, tm, zone)
            seclrDate = dateLunarReturn(returnDate, moon.lon, self.perchart.zodiacal)
            secchart = Chart(seclrDate, pos, self.perchart.zodiacal, hsys=self.perchart.house, IDs=const.LIST_OBJECTS, sidereal_mode=self.perchart.siderealMode)
            srdt = Datetime.fromJD(seclrDate.jd, seclrDate.utcoffset)
            srdtstr1 = srdt.toCNString()
            dirparts1 = srdtstr1.split(' ')
            params1 = copy.deepcopy(params)
            params1['date'] = dirparts1[0]
            params1['time'] = dirparts1[1]
            params1['siderealAyanamsa'] = self.perchart.siderealAyanamsa
            _fill_user_ayan(self.perchart, params1)
            parts = dirparts1[0].split('-')
            if parts[1] == m:
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
                    'lots': self.perchart.getPars(chart)
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
        for i in range(1, 100):
            year = int(self.perchart.year) + i
            date = '{0}/{1}/{2}'.format(year, self.perchart.month, self.perchart.day)
            dt = Datetime(date, self.perchart.time, self.perchart.zone)
            chart = solararc.compute(self.perchart.chart, dt, asporb, nodeRetrograde)
            objs = chart['objects']
            objs.sort(key=takeLon)
            obj = {
                'date': '{0}-{1}-{2}'.format(year, self.perchart.month, self.perchart.day),
                'chart': {
                    'objects': objs,
                    'aspects': chart['aspects']
                },
                'lots': self.perchart.getPars(chart['chart'])
            }
            res.append(obj)
        return res

    def getSolarArcByDate(self, date, asporb, nodeRetrograde=False):
        parts = date.split(' ');
        dt = helper.getChartDate(parts[0])
        tm = parts[1] if len(parts) > 1 else '00:00'
        saDate = Datetime(dt, tm, self.perchart.zone)
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
        for i in range(1, 100):
            year = int(self.perchart.year) + i
            date = '{0}/{1}/{2}'.format(year, self.perchart.month, self.perchart.day)
            dt = Datetime(date, self.perchart.time, self.perchart.zone)
            chart = solararc.compute(self.perchart.chart, dt, asporb, nodeRetrograde, arcSource)
            objs = chart['objects']
            objs.sort(key=takeLon)
            obj = {
                'date': '{0}-{1}-{2}'.format(year, self.perchart.month, self.perchart.day),
                'chart': {
                    'objects': objs,
                    'aspects': chart['aspects']
                },
                'lots': self.perchart.getPars(chart['chart'])
            }
            res.append(obj)
        return res

    def getPlanetaryArcByDate(self, date, asporb, nodeRetrograde=False, arcSource=const.MOON):
        parts = date.split(' ')
        dt = helper.getChartDate(parts[0])
        tm = parts[1] if len(parts) > 1 else '00:00'
        saDate = Datetime(dt, tm, self.perchart.zone)
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

    def getPersianDirectedByDate(self, date, rateKey='persian', asporb=1, nodeRetrograde=False, direction='direct'):
        # 波斯向运（Persian Directed）：黄经象征向运,所有行星/点每年 +rate 度,本命宫头不动。
        # direction: direct(默认,逆时针) / converse(反向,顺时针,弧取负)。
        from astrostudy import symbolicdir
        parts = date.split(' ')
        dt = helper.getChartDate(parts[0])
        tm = parts[1] if len(parts) > 1 else '00:00'
        target = Datetime(dt, tm, self.perchart.zone)
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

    def getYearSystem129(self):
        return yearsystem129.compute(self.perchart.chart)

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
    _PD3D_ENGINE_METHODS = ('placidus', 'regiomontanus', 'campanus', 'topocentric')
    # 位置圈需后端采样折线的方位法 → 采样所用 house_pos 系统。
    # Placidus 比例圈 / Topocentric 极圈都不是天球大圆(前端三点叉积画不动)→ 后端采样;
    # horosa_legacy 即 flatlib 比例半弧法,几何上=Placidus 世俗位置等值线,同享采样。
    # 其余方法(core 核族/Regio/Campanus 等)返回语义型标记,由前端画大圆。
    _PD3D_SAMPLED_CIRCLE_SYSTEM = {
        'placidus': 'placidus',
        'topocentric': 'topocentric',
        'horosa_legacy': 'placidus',
        # under-pole 属普拉西德家族(半圆近似):位置圈按 placidus 采样。
        'placidus_under_pole': 'placidus',
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
        if base == CORE_PD_VERTEX_ID:
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
        aspects = list(self.perchart.pdaspects) if self.perchart.pdaspects else [0, 60, 90, 120, 180]
        include_antiscia = bool(getattr(self.perchart, 'pdAntiscia', False))
        include_terms = bool(getattr(self.perchart, 'pdTerms', False))
        pts = {}
        # 应星(significators):四轴 lat=0;体点在 In-Zodiaco 下 lat=0,位置圈双支法
        # (Campanus/Regiomontanus)例外用真黄纬 —— 与 build_directions 完全同口径。
        for sname in self._PD_ENGINE_SIGNIFICATORS:
            sid = 'N_%s_0' % sname
            if sname in pd_engine.ANGLE_NAMES:
                if sname not in angles:
                    continue
                pts[sid] = ({'lon': float(angles[sname]), 'lat': 0.0}, 'angle')
            elif sname in bodies:
                sig_beta = method in pd_engine.POSITION_CIRCLE_DUAL
                pts[sid] = ({'lon': bodies[sname]['lon'],
                             'lat': bodies[sname].get('lat', 0.0) if sig_beta else 0.0},
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
                        pt = {'lon': base['lon'], 'lat': 0.0}
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
                 Topocentric(及 legacy 半弧)= sampled 采样折线(允许断段);
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
        if pdtype == 1:
            pdlist = self.getPrimaryDirectionByM()
        elif pdtype in (2, 3):
            pdlist = self.getTermDirection(pdtype == 2)
        else:
            pdlist = self.getPrimaryDirectionByZ()
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
        engine_family = method in self._PD3D_ENGINE_METHODS
        if engine_family:
            pts, armc, phi, eps_mean, jd = self._pd3dEnginePointList(method)
        elif method == 'horosa_legacy':
            pts, armc, phi, eps_mean, jd = self._pd3dLegacyPointList()
        else:
            pts, armc, phi, eps_mean, jd = self._pd3dCorePointList()
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
                        + self._pdExtraCuspPromissorPoints(_ch_extra)):
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
