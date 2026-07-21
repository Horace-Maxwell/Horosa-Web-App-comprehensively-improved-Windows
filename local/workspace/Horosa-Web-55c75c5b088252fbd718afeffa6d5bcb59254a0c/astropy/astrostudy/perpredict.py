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
    # In-Zodiaco 下与 core_alchabitius 弧几何逐位等同(已实测 mean|Δ|=0)：
    'meridian': 'getPrimaryDirectionByZCoreKernel',
    'porphyry': 'getPrimaryDirectionByZCoreKernel',
    'equal_ecliptic': 'getPrimaryDirectionByZCoreKernel',
    'equal_hour_circle': 'getPrimaryDirectionByZCoreKernel',
}


# 主限法盘(dial)宫制映射：方位法本质即「定盘宫制」，故主限法盘的宫始点(house cusps)
# 应随所选方位法变化。下列有把握的方位法直接映射到对应 swisseph 宫位系统；
# 任何未列出的方法一律 fallback 到本命盘宫制(self.perchart.house)——
# 诚实不臆造(无干净 swisseph 等价时沿用本命宫制，保守且无回归风险)。
# 注：此映射只改盘的「宫位/四角分宫」，不改被推进的星体经度(刚体 RA+arc，与方位法无关)，
# 故不影响表格(getPrimaryDirection)字节级一致——盘表分属两条独立渲染路径。
_PD_CHART_METHOD_HSYS = {
    'core_alchabitius': const.HOUSES_ALCABITUS,
    'meridian': const.HOUSES_MERIDIAN,
    'porphyry': const.HOUSES_PORPHYRIUS,
    'equal_ecliptic': const.HOUSES_EQUAL,
}


# 自研主限法时间换算 (time key) 常量表。值 = 「从原始弧到缩放后弧」的倍数。
# Ptolemy 必须严格 == 1.0 (整型字面量,非浮点近似),用来护住默认路径字节级一致。
# Naibod = 太阳平均周日运动度数 0.9856473354°，已上线 v2.5.2。
# 其它 static time key (Cardano / Plantiko / Wöllner 等) 均按各自的古典/符号定义
# 给出常数标度填入此表，本批 (P0 v2.5.4) 起逐步落地。
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
#   Kepler/Brahe  = 生日向前差分 λ☉(jd0+1) − λ☉(jd0)(二者输出逐位相同)
# 旧版曾以单一常数近似(0.9847/0.98396),对远期盘有可见日期偏差,已换真式。
# chart 不可用时回退下列近似常数(防御性,正常路径恒有 chart)。
PER_CHART_TIME_KEY_FALLBACK = {
    'simmonite': 0.9847,
    'kepler': 0.98396,
    'brahe': 0.98396,
}


def _pdTimeKeyScale(time_key, chart=None, age=None):
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
        td = TermDirection(chart, clockwise)
        tdlist = td.getList(self.perchart.pdaspects)
        self.appendDateStr(tdlist, False)
        return tdlist


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

    def _pd3dCorePointList(self):
        """core 核族(Alcabitius 系 / meridian / porphyry / equal_* / morinus 等分宫制)
        点位构造 —— 与 getPrimaryDirectionByZCoreKernel
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
        if _want_anti or _want_terms:
            from astrostudy import pd_engine as _pde
            _base_lons = {}
            for _p in promissors:
                _parts = '{0}'.format(_p.get('id') or '').split('_')
                if len(_parts) == 3 and _parts[0] == 'N' and _parts[2] == '0':
                    _base_lons[_parts[1]] = _p.get('lon')
            if _want_anti:
                for _bn, _bl in _base_lons.items():
                    if _bl is None:
                        continue
                    for _fn, _pre in ((_pde.antiscion, 'A'), (_pde.contra_antiscion, 'C')):
                        promissors.append({'id': '{0}_{1}_0'.format(_pre, _bn),
                                           'lon': angle.norm(_fn(float(_bl))), 'lat': 0.0})
            if _want_terms:
                for _ruler, _sign, _tlon in _pde.term_boundaries():
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
                 (子午圈)/ Vertex=prime-vertical(卯酉圈)语义型;其余=hour-circle
                 (时圈;horosa_legacy 的比例位置圈非天球大圆且本仓无采样引擎,
                 诚实省略该圈,前端对缺圈应星自动不画);
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
        if method == 'horosa_legacy':
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
        for pid in used:
            got = pts.get(pid)
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
                        use_engine_trig=False)
                    continue
                # 其余缺失防御性跳过,由测试看守封闭性。
                continue
            pt, kind = got
            points[pid] = self._pd3dPointEntry(pt, eps_mean, kind,
                                               use_engine_trig=False)
        # 应星位置圈(每个 sig id 一条)。
        circles = {}
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
            elif method == 'horosa_legacy':
                # 比例位置圈非大圆且本仓无采样引擎 → 诚实省略(前端缺圈即不画)。
                continue
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

    def getDistributions(self):
        """ 界推运（Distributions）：上升点经主限运动依次穿过各埃及界。
        分配星(distributor)=该界主星；其期间内上升点又触及某行星→该行星为参与星(participant)。
        建于 TermDirection（与界限法同源、同 signasctime 时间换算）。 """
        chart = self.perchart.getChart()
        td = TermDirection(chart, True)
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

    def getPrimaryDirectionByZ(self):
        # 自研主限法方位法 strategy 分发(see _PD_METHOD_REGISTRY at module top)
        # 任何未知 pdMethod 一律 fallback 到 core_alchabitius，护住默认
        # Alcabitius+Ptolemy 路径字节级一致。
        method = getattr(self.perchart, 'pdMethod', 'core_alchabitius') or 'core_alchabitius'
        handler_name = _PD_METHOD_REGISTRY.get(method) or _PD_METHOD_REGISTRY['core_alchabitius']
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

    # ---- 自研主限法引擎(方位法集见 _PD_METHOD_REGISTRY)----
    # 注册的方位法走 astrostudy.pd_engine(通用球面三角 + swisseph 原语),与默认 Alcabitius
    # 完全独立;Alcabitius+Ptolemy 字节级路径绝不受影响(铁律①)。



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
        闭式 = co-latitude(90°−φ) 框架的升点式(全纬度域恒等已验)：
            arc = OA_{90°−φ}(prom) − (RAMC + 270°)，OA = RA − asin(tanδ·tan(90°−φ))
        每条直径的两次穿越由互为反点的相位点(0↔180、D60↔S120、D90↔S90、D120↔S60)
        各自携带，故本式对全候选即覆盖全部穿越事件；引擎列出窗内全部行,不做额外取舍。
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
        delta = (dt_ref - dt_sw) / 86400.0  # days; 等价把本体 TT 平移到基准 ΔT
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
        换成弧的 pre-norm 原值后,跨全部测试盘逐位一致,且三支
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
        # 平移到基准 ΔT，与表格同一历表；角(RAMC/Asc/MC)走 UT 不动。
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
        """解析主限法盘所用宫制：优先方位法对应宫制(_PD_CHART_METHOD_HSYS)，
        未列出/无把握(equal_hour_circle 等)则回退本命盘宫制。带双重兜底防越界。"""
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
        if pd_time_key.lower() in ('truesolararc', 'placidus_key'):
            from astrostudy import pd_engine
            current_arc = float(pd_engine.solar_arc_for_years(float(current_arc), float(chart.date.jd)))
        elif pd_time_key.lower() == 'symbolicsolararc':
            from astrostudy import pd_engine
            current_arc = float(pd_engine.symbolic_solar_arc_for_years(float(current_arc), float(chart.date.jd)))
        else:
            current_arc = current_arc * _pdTimeKeyScale(pd_time_key, chart=chart)
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
        # ΔT 校准：未来盘把本体位置平移到基准 ΔT（历史盘 δ≈0 跳过）；角不动。
        _dt_dmap = self._corePdDeltaTPointMap(chart)
        if _dt_dmap:
            significators = [self._coreShiftPointByDeltaT(o, _dt_dmap) for o in significators]
            promissors = [self._coreShiftPointByDeltaT(o, _dt_dmap) for o in promissors]
        # 映点(antiscia)/界(terms) 促发星扩展 —— 与 pd_engine build_directions 同口径，
        # 补全 core 方位法(Alcabitius/Meridian/Porphyry/Equal…) 的「映点/界」开关。
        # 均作黄道合相点(lat=0)；本体 lon 取已 node 重建 + ΔT 平移后的 N_*_0。
        _want_anti = bool(getattr(self.perchart, 'pdAntiscia', False))
        _want_terms = bool(getattr(self.perchart, 'pdTerms', False))
        if _want_anti or _want_terms:
            from astrostudy import pd_engine as _pde
            _base_lons = {}
            for _p in promissors:
                _parts = '{0}'.format(_p.get('id') or '').split('_')
                if len(_parts) == 3 and _parts[0] == 'N' and _parts[2] == '0':
                    _base_lons[_parts[1]] = _p.get('lon')
            _extra = []
            if _want_anti:
                for _bn, _bl in _base_lons.items():
                    if _bl is None:
                        continue
                    for _fn, _pre in ((_pde.antiscion, 'A'), (_pde.contra_antiscion, 'C')):
                        _extra.append({'id': '{0}_{1}_0'.format(_pre, _bn),
                                       'lon': angle.norm(_fn(float(_bl))), 'lat': 0.0})
            if _want_terms:
                for _ruler, _sign, _tlon in _pde.term_boundaries():
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
        # 顺/逆按弧符号筛：顺=正弧、逆=负弧（已按顺逆分档逐位坐实）。
        # 两者皆开=默认全留；皆关=回退顺向。
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
        if _want_anti or _want_terms:
            from astrostudy import pd_engine as _pde
            _base_lons = {}
            for _p in promissors:
                _parts = '{0}'.format(_p.get('id') or '').split('_')
                if len(_parts) == 3 and _parts[0] == 'N' and _parts[2] == '0':
                    _base_lons[_parts[1]] = _p.get('lon')
            _extra = []
            if _want_anti:
                for _bn, _bl in _base_lons.items():
                    if _bl is None:
                        continue
                    for _fn, _pre in ((_pde.antiscion, 'A'), (_pde.contra_antiscion, 'C')):
                        _extra.append({'id': '{0}_{1}_0'.format(_pre, _bn),
                                       'lon': angle.norm(_fn(float(_bl))), 'lat': 0.0})
            if _want_terms:
                for _ruler, _sign, _tlon in _pde.term_boundaries():
                    _rname = _pde.TERM_RULER_FULL.get(_ruler, _ruler)
                    _sname = _pde.TERM_SIGN_NAMES[int(_sign) % 12]
                    _extra.append({'id': 'T_{0}_{1}'.format(_rname, _sname),
                                   'lon': angle.norm(float(_tlon)), 'lat': 0.0})
            promissors = promissors + _extra
        eps = self._coreMeanObliquity(chart)
        # 注:宿命点(Vertex)应星暂只在 In-Zodiaco 核出行(已全量逐位自检);
        # 世俗(In-Mundo)下其 vertex 行稀疏且口径不同,确切式未明,诚实不出。
        max_arc = float(getattr(self.perchart, 'pdYears', 100) or 100)
        tiny = 1e-12
        pdlist = []
        for prom in promissors:
            prom_id = prom.get('id')
            prom_ra, _ = self._corePointEqCoords(prom, eps, zero_lat=False)
            if prom_id is None or prom_ra is None:
                continue
            for sig in significators:
                sig_id = sig.get('id')
                if sig_id is None or prom_id == sig_id:
                    continue
                if self._baseDirectionObjectId(prom_id) == self._baseDirectionObjectId(sig_id):
                    continue
                sig_ra, _ = self._corePointEqCoords(sig, eps, zero_lat=False)
                if sig_ra is None:
                    continue
                raw_arc_delta = float(prom_ra) - float(sig_ra)
                arc = self._norm180(raw_arc_delta)
                if abs(arc) <= tiny or abs(arc) > max_arc:
                    continue
                if max_arc <= 180.0 and self._isCorePlanetPair(prom_id, sig_id):
                    # 世俗核同口径:窗用本法弧(真β RA 差)的 pre-norm 原值。
                    if not self._passesCoreDisplayWindow(raw_arc_delta):
                        continue
                pdlist.append([arc, prom_id, sig_id, 'M'])
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
        # 世俗向运(in mundo)。core 走纯公式世俗核；legacy 仍走 flatlib 'M'。
        method = getattr(self.perchart, 'pdMethod', 'core_alchabitius') or 'core_alchabitius'
        if method in ('core_alchabitius', 'meridian', 'porphyry',
                      'equal_ecliptic', 'equal_hour_circle'):
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
        use_solar_arc = pd_time_key.lower() in ('truesolararc', 'placidus_key')
        use_sym_solar_arc = pd_time_key.lower() == 'symbolicsolararc'
        natal_jd = float(chart.date.jd) if (use_solar_arc or use_sym_solar_arc) else None
        scale = _pdTimeKeyScale(pd_time_key, chart=chart)
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

    def getSolarReturnByDate(self, params, date, asporb=-1):
        sun = self.perchart.chart.getObject(const.SUN)
        parts = date.split(' ')
        dt = helper.getChartDate(parts[0])
        tm = parts[1] if len(parts) > 1 else '00:00'
        zone = params['zone']
        returnDate = Datetime(dt, tm, zone)
        srDate = dateSolarReturn(returnDate, sun.lon, self.perchart.zodiacal)
        chart = Chart(srDate, self.perchart.pos, self.perchart.zodiacal, hsys=self.perchart.house, IDs=const.LIST_OBJECTS, sidereal_mode=self.perchart.siderealMode)
        srdt = Datetime.fromJD(srDate.jd, srDate.utcoffset)
        srdtstr = srdt.toCNString()
        dirparts = srdtstr.split(' ')
        params['date'] = dirparts[0]
        params['time'] = dirparts[1]
        params['siderealAyanamsa'] = self.perchart.siderealAyanamsa
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
        chart = Chart(srDate, pos, self.perchart.zodiacal, hsys=self.perchart.house, IDs=const.LIST_OBJECTS, sidereal_mode=self.perchart.siderealMode)
        srdt = Datetime.fromJD(srDate.jd, srDate.utcoffset)
        srdtstr = srdt.toCNString()
        dirparts = srdtstr.split(' ')
        params['date'] = dirparts[0]
        params['time'] = dirparts[1]
        params['siderealAyanamsa'] = self.perchart.siderealAyanamsa

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
