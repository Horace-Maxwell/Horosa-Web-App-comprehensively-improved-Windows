"""变换盘:把本命盘按某种规则换算出一张新盘,交给盘面照常绘制。

每种变换给三样东西:星体黄经怎么变、ASC 与 MC 怎么变、宫头怎么变。
宫位缺省跟随本命,需要时由变换自己给出。
"""
import math

import swisseph
from flatlib import const
from flatlib.ephem.swe import SWE_HOUSESYS

from astrostudy.astroextra_parts.common import base_params, chart_params_from_jd, chart_points, date_time_from_jd, to_bool
from astrostudy.perchart import PerChart, parse_terms_variant, pop_classical_request, push_classical_request
from astrostudy.thirteenthchart import DERIVED_HOUSE_MODE

EQUAL_HOUSE_MODE = 'equalFromTransform'      # 变换后的等宫,宫头不对齐星座,不是整宫
# 压在宫界上的点(北交宫盘的南交、四轴,九分盘的四轴)差一点浮点噪声就会落到邻宫,段头整体挪这么一点把归属定死
HOUSE_EDGE_NUDGE = 1e-9
BASE_HOUSE_MODE = 'baseFromTransform'        # 自定义宫制在地方盘上算不出,按它的基础宫制算

TEN = (const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS, const.JUPITER, const.SATURN,
       const.URANUS, const.NEPTUNE, const.PLUTO)
BODY_IDS = dict(zip(TEN, (swisseph.SUN, swisseph.MOON, swisseph.MERCURY, swisseph.VENUS, swisseph.MARS, swisseph.JUPITER,
                          swisseph.SATURN, swisseph.URANUS, swisseph.NEPTUNE, swisseph.PLUTO)))
SEMI_ARC_SYSTEMS = (b'P', b'K', b'T', b'G')
SUN_DECLINATION_SYSTEMS = (b'I', b'i')       # 这两种宫制要太阳赤纬
PERSONA_SAME_POINT = 1e-6      # 度;太阳对太阳的差只有浮点噪声,不能被 norm360 推迟一年
ANALOG_HOUSE_SYSTEMS = {'housePlacidus': b'P', 'houseRegiomontanus': b'R', 'houseCampanus': b'C', 'houseTopocentric': b'T'}


def norm360(value):
    return value % 360.0


def ecl_to_equ(lon, lat, eps):
    return swisseph.cotrans((lon, lat, 1.0), -eps)[:2]


class Frame:
    """变换要用的本命量:回归黄经、黄纬、四轴、宫头、时刻与地点。"""

    def __init__(self, jd, geo_lat, geo_lon, lons, lats, speeds, asc, mc, cusps, armc, eps, house_system=b'P', offset=0.0):
        self.jd = jd
        self.geo_lat = geo_lat
        self.geo_lon = geo_lon
        self.lons = lons
        self.lats = lats
        self.speeds = speeds
        self.asc = asc
        self.mc = mc
        self.cusps = list(cusps)
        self.armc = armc
        self.eps = eps
        self.house_system = house_system
        self.offset = offset

    def tropical(self, lon):
        return norm360(lon + self.offset)

    def display(self, lon):
        return norm360(lon - self.offset)


def rotation(offset):
    return lambda name, lon, lat: norm360(lon + offset)


def _result(move, asc=None, mc=None, cusps=None, derived=None, physical=False, local=False, natal_horizon=None):
    """asc、mc、cusps 留空表示和本命相同。"""
    # physical:新黄经还是黄道上的真实方位(整体旋转、镜像、换地方),赤经赤纬跟着重算;
    # 其余盘的黄经是换算出来的量,赤纬、高度这些仍是这颗星本来的值。local:宫头由地方盘公式另算。
    # natal_horizon:地平上下与得时失时取本命值。缺省跟 physical 反着走 —— 星的赤经赤纬没跟着动时,
    # 拿它去比新天顶得到的是两张盘的混合;星不动只挪四轴的盘(北交宫盘)也一样取本命。
    if natal_horizon is None:
        natal_horizon = not physical
    return {'move': move, 'asc': asc, 'mc': mc, 'cusps': cusps, 'derived': derived, 'physical': physical, 'local': local,
            'natalHorizon': natal_horizon}


def _classic(options):
    return options.get('variant') == 'classic'


def inverted(frame, options):
    """改进档四轴一起转;经典档四轴留在本命,只转星和宫头。"""
    move = rotation(180.0)
    cusps = [norm360(cusp + 180.0) for cusp in frame.cusps]
    if _classic(options):
        return _result(move, None, None, cusps, physical=True)
    return _result(move, norm360(frame.asc + 180.0), norm360(frame.mc + 180.0), cusps, physical=True)


def sun_rise(frame, options):
    """整盘旋转 上升 − 太阳,改进档四轴一起转;经典档四轴留在本命。"""
    offset = norm360(frame.asc - frame.lons[const.SUN])
    cusps = [norm360(cusp + offset) for cusp in frame.cusps]
    if _classic(options):
        return _result(rotation(offset), None, None, cusps, physical=True)
    return _result(rotation(offset), norm360(frame.asc + offset), norm360(frame.mc + offset), cusps, physical=True)


def superimposed(frame, options):
    """把所选的星转到上升。shift 时宫位同转,否则宫位与四轴不动。"""
    planet = options.get('planet') or const.SUN
    offset = norm360(frame.asc - frame.lons[planet])
    if options.get('shift'):
        return _result(rotation(offset), norm360(frame.asc + offset), norm360(frame.mc + offset), [norm360(cusp + offset) for cusp in frame.cusps], physical=True)
    return _result(rotation(offset), physical=True)


def antiscia(frame, options):
    return _result(lambda name, lon, lat: norm360(180.0 - lon), physical=True)


def contra_antiscia(frame, options):
    return _result(lambda name, lon, lat: norm360(-lon), physical=True)


def decanate_lon(lon):
    sign = int(lon // 30)
    within = lon % 30.0
    part = min(int(within // 10), 2)
    return norm360((sign + 4 * part) * 30.0 + 3.0 * (within - 10.0 * part))


def decanate(frame, options):
    return _result(lambda name, lon, lat: decanate_lon(lon), decanate_lon(frame.asc), decanate_lon(frame.mc))


def novien_lon(lon):
    return norm360(9.0 * lon - 90.0)


def novien(frame, options):
    first = novien_lon(frame.lons[const.MOON])
    cusps = [norm360(first + 30.0 * index - HOUSE_EDGE_NUDGE) for index in range(12)]     # 段是 [段头, 段头 + 30)
    if _classic(options):
        return _result(lambda name, lon, lat: novien_lon(lon), None, None, cusps, EQUAL_HOUSE_MODE)
    return _result(lambda name, lon, lat: novien_lon(lon), first, norm360(first + 270.0), cusps, EQUAL_HOUSE_MODE)


def vertical_lon(frame, name, lon, lat):
    """由赤纬反推黄经:赤纬增大在上升段,减小在下降段。出黄道带的星照原值返回。
    只有星体和北交有这个算法;南交对冲北交,福点、小行星等不动。"""
    if name == const.SOUTH_NODE:
        return norm360(vertical_lon(frame, const.NORTH_NODE, frame.lons[const.NORTH_NODE], 0.0) + 180.0)
    if name not in BODY_IDS and name != const.NORTH_NODE:
        return lon
    return frame.display(_vertical_tropical(frame, name, frame.tropical(lon), lat))


def _vertical_tropical(frame, name, lon, lat):
    declination = ecl_to_equ(lon, lat, frame.eps)[1]
    ratio = math.sin(math.radians(declination)) / math.sin(math.radians(frame.eps))
    if abs(ratio) > 1.0:
        return lon
    base = abs(math.degrees(math.asin(ratio)))
    if name not in BODY_IDS:
        rising = norm360(lon + 90.0) < 180.0
    else:
        row = swisseph.calc_ut(frame.jd + 1.0, BODY_IDS[name], swisseph.FLG_SWIEPH)[0]
        rising = abs(ecl_to_equ(row[0], row[1], frame.eps)[1]) >= abs(declination)
    if declination >= 0.0:
        return base if rising else 180.0 - base
    return 180.0 + base if rising else 360.0 - base


def vertical(frame, options):
    return _result(lambda name, lon, lat: vertical_lon(frame, name, lon, lat))


def node_houses(frame, options):
    """星不动。1 宫从北交起逆着黄经走 30°,以下逐宫同向。
    盘面的宫是顺向的段:第 k 宫占 [北交 − 30k, 北交 − 30(k − 1)],所以段头比这一宫的起点少 30°。"""
    first = frame.lons[const.NORTH_NODE]
    cusps = [norm360(first - 30.0 * (index + 1) + HOUSE_EDGE_NUDGE) for index in range(12)]     # 段是 (段头, 段头 + 30]
    if _classic(options):
        return _result(_still, None, None, cusps, EQUAL_HOUSE_MODE, physical=True, natal_horizon=True)
    # 星不动,四轴落在北交那个真实黄道点上:四轴赤经赤纬按新位置重算(physical);地平上下仍是本命的
    return _result(_still, first, norm360(first - 270.0), cusps, EQUAL_HOUSE_MODE, physical=True, natal_horizon=True)


def _planet_elements(frame, name):
    return swisseph.nod_aps_ut(frame.jd, BODY_IDS[name], swisseph.NODBIT_MEAN, swisseph.FLG_SWIEPH)


def _focal_elements(frame, name):
    return swisseph.nod_aps_ut(frame.jd, BODY_IDS[name], swisseph.NODBIT_MEAN | swisseph.NODBIT_FOPOINT, swisseph.FLG_SWIEPH)


def planet_elements_chart(index, focal=False):
    """元素盘:index 0 升交 · 1 降交 · 2 近日 · 3 远日或第二焦点。月亮的交点取平交点。"""
    def transform(frame, options):
        lons = {}
        for name in TEN:
            if name == const.SUN:
                lons[name] = None
                continue
            row = (_focal_elements if focal else _planet_elements)(frame, name)
            lons[name] = frame.display(row[index][0])
        if index in (0, 1):
            mean_node = swisseph.calc_ut(frame.jd, swisseph.MEAN_NODE, swisseph.FLG_SWIEPH)[0][0]
            lons[const.MOON] = frame.display(mean_node + 180.0 * index)
        lons[const.SUN] = frame.display(_sun_element(frame, index))
        return _result(lambda name, lon, lat: lons.get(name, lon))
    return transform


def _sun_element(frame, index):
    if index in (0, 1):
        return 0.0
    row = swisseph.nod_aps_ut(frame.jd, swisseph.EARTH, swisseph.NODBIT_MEAN, swisseph.FLG_SWIEPH | swisseph.FLG_HELCTR)
    return row[3 if index == 2 else 2][0]             # 地球近日点那天太阳在反方向


def _analog(value):
    return lambda frame, options: _result(value(frame), 0.0, 270.0, [30.0 * index for index in range(12)], DERIVED_HOUSE_MODE)


def _lat_value(frame):
    return lambda name, lon, lat: norm360(lat)


def _ra_value(frame):
    return lambda name, lon, lat: norm360(ecl_to_equ(frame.tropical(lon), lat, frame.eps)[0])


def _dec_value(frame):
    return lambda name, lon, lat: norm360(ecl_to_equ(frame.tropical(lon), lat, frame.eps)[1])


def _dec_fold(frame):
    """赤纬绝对值接在黄经所在象限的起点之后。"""
    def value(name, lon, lat):
        true_lon = frame.tropical(lon)
        return int(true_lon // 90) * 90.0 + abs(ecl_to_equ(true_lon, lat, frame.eps)[1])
    return value


FOLD_BACK_BASE = (180.0, 90.0, 360.0, 270.0)


def _dec_fold_back(frame):
    def value(name, lon, lat):
        true_lon = frame.tropical(lon)
        return norm360(FOLD_BACK_BASE[int(true_lon // 90)] - abs(ecl_to_equ(true_lon, lat, frame.eps)[1]))
    return value


# 视高度的大气口径和本命盘一致(flatlib 起盘用海拔 150 m、1000 hPa、20°C);方位与真高度不受这几个量影响
NATAL_REFRACTION = (150.0, 1000.0, 20.0)


def _horizon(frame, lon, lat, refraction=(0.0, 0.0, 0.0)):
    height, pressure, temperature = refraction
    return swisseph.azalt(frame.jd, swisseph.ECL2HOR, (frame.geo_lon, frame.geo_lat, height), pressure, temperature,
                          (frame.tropical(lon), lat, 1.0))


def _azimuth(frame):
    """方位角从南起向西量,换成从北起向东。"""
    return lambda name, lon, lat: norm360(_horizon(frame, lon, lat)[0] + 180.0)


def _azimuth_local(frame):
    return lambda name, lon, lat: norm360(90.0 - (_horizon(frame, lon, lat)[0] + 180.0))


def _altitude(frame):
    return lambda name, lon, lat: norm360(_horizon(frame, lon, lat)[1])


def _house_value(system):
    def build(frame):
        return lambda name, lon, lat: norm360(30.0 * (swisseph.house_pos(frame.armc, frame.geo_lat, frame.eps, (frame.tropical(lon), lat), system) - 1.0))
    return build


def _angles_from_armc(frame, armc):
    try:
        if frame.house_system in SUN_DECLINATION_SYSTEMS:
            sun = swisseph.calc_ut(frame.jd, swisseph.SUN, swisseph.FLG_SWIEPH | swisseph.FLG_EQUATORIAL)[0][1]
            cusps, angles = swisseph.houses_armc(armc, frame.geo_lat, frame.eps, frame.house_system, sun)
        else:
            cusps, angles = swisseph.houses_armc(armc, frame.geo_lat, frame.eps, frame.house_system)
    except swisseph.Error:         # 高纬算不出的宫制,和本命盘一样换 Porphyry
        cusps, angles = swisseph.houses_armc(armc, frame.geo_lat, frame.eps, b'O')
    return frame.display(angles[0]), frame.display(angles[1]), [frame.display(cusp) for cusp in cusps[:12]]


def _still(name, lon, lat):
    return lon


def geodetic_long(frame, options):
    """地方盘:东经直接当 RAMC。"""
    asc, mc, cusps = _angles_from_armc(frame, norm360(frame.geo_lon))
    return _result(_still, asc, mc, cusps, physical=True, local=True)


def geodetic_ra(frame, options):
    """地方盘:东经当 MC 黄经,再反算 RAMC。"""
    armc = ecl_to_equ(norm360(frame.geo_lon), 0.0, frame.eps)[0]
    asc, mc, cusps = _angles_from_armc(frame, armc)
    return _result(_still, asc, mc, cusps, physical=True, local=True)


def locality_base(frame):
    """东西经不分,这是这一路写法的原样。"""
    drift = 46.1016 / 3600.0 * (frame.jd - 2451545.0) / 365.25
    return norm360(30.06305 + drift + abs(frame.tropical(frame.lons[const.SUN]) - abs(frame.geo_lon)))


def locality_armc(frame, options):
    asc, mc, cusps = _angles_from_armc(frame, locality_base(frame))
    return _result(_still, asc, mc, cusps, physical=True, local=True)


def locality_mc(frame, options):
    armc = ecl_to_equ(locality_base(frame), 0.0, frame.eps)[0]
    asc, mc, cusps = _angles_from_armc(frame, armc)
    return _result(_still, asc, mc, cusps, physical=True, local=True)


def planet_centered(frame, options):
    """以所选的星为中心:各星地心矢量减去中心星矢量后取黄经。"""
    center = options.get('planet') or const.SUN
    origin = swisseph.calc_ut(frame.jd, BODY_IDS[center], swisseph.FLG_SWIEPH | swisseph.FLG_XYZ)[0][:3]

    def value(name, lon, lat):
        if name not in BODY_IDS or name == center:
            return lon
        point = swisseph.calc_ut(frame.jd, BODY_IDS[name], swisseph.FLG_SWIEPH | swisseph.FLG_XYZ)[0][:3]
        return frame.display(math.degrees(math.atan2(point[1] - origin[1], point[0] - origin[0])))
    return _result(value)


TRANSFORMS = {
    'inverted': inverted,
    'sunRise': sun_rise,
    'superimposed': superimposed,
    'antiscia': antiscia,
    'contraAntiscia': contra_antiscia,
    'decanate': decanate,
    'novien': novien,
    'vertical': vertical,
    'nodeHouses': node_houses,
    'geodeticLong': geodetic_long,
    'geodeticRa': geodetic_ra,
    'localityArmc': locality_armc,
    'localityMc': locality_mc,
    'planetCentered': planet_centered,
    'planetNodes': planet_elements_chart(0),
    'planetNodesSouth': planet_elements_chart(1),
    'perihelion': planet_elements_chart(2),
    'aphelion': planet_elements_chart(3),
    'secondFocus': planet_elements_chart(3, True),
    'analogLatitude': _analog(_lat_value),
    'analogRightAscension': _analog(_ra_value),
    'analogDeclination': _analog(_dec_value),
    'analogDeclinationFold': _analog(_dec_fold),
    'analogDeclinationBack': _analog(_dec_fold_back),
    'analogAzimuth': _analog(_azimuth),
    'analogAzimuthLocal': _analog(_azimuth_local),
    'analogAltitude': _analog(_altitude),
}
TRANSFORMS.update({key: _analog(_house_value(system)) for key, system in ANALOG_HOUSE_SYSTEMS.items()})

MOMENT_KINDS = ('persona', 'epoch')
GOLDEN_RATIOS = (0.381966, 0.618034)
EPOCH_DAYS = 270.0
EPOCH_SPAN = 20.0
TIME_TOLERANCE = 1.0 / 86400.0


def _sun_lon(jd):
    return swisseph.calc_ut(jd, swisseph.SUN, swisseph.FLG_SWIEPH)[0][0]


def _moon_lon(jd):
    return swisseph.calc_ut(jd, swisseph.MOON, swisseph.FLG_SWIEPH)[0][0]


def _arc(a, b):
    return (a - b + 180.0) % 360.0 - 180.0


def persona_moment(frame, planet):
    """出生后太阳第一次到达这颗星本命黄经的时刻;选太阳就是出生那一刻。"""
    target = frame.tropical(frame.lons[planet])
    gap = norm360(target - _sun_lon(frame.jd))
    if gap < PERSONA_SAME_POINT or gap > 360.0 - PERSONA_SAME_POINT:
        return frame.jd
    return swisseph.solcross_ut(target, frame.jd + gap / 0.9856 - 5.0, swisseph.FLG_SWIEPH)


def _asc_at(jd, frame):
    return swisseph.houses_ex(jd, frame.geo_lat, frame.geo_lon, b'O')[1][0]      # 上升与宫制无关


def _bisect(value, low, high):
    """value 在 low、high 两端异号,二分到一秒内。"""
    start = value(low)
    while high - low > TIME_TOLERANCE:
        middle = (low + high) / 2.0
        if (value(middle) < 0.0) == (start < 0.0):
            low = middle
        else:
            high = middle
    return high


def epoch_moment(frame, house):
    """出生前约 270 日:上升正好是本命月亮,月亮最靠近本命第 house 宫头。"""
    moon = frame.tropical(frame.lons[const.MOON])
    target = frame.tropical(frame.cusps[house - 1])
    best = None
    jd = frame.jd - EPOCH_DAYS - EPOCH_SPAN
    end = frame.jd - EPOCH_DAYS + EPOCH_SPAN
    step = 1.0 / 48.0
    while jd < end:
        before = _arc(_asc_at(jd, frame), moon)
        after = _arc(_asc_at(jd + step, frame), moon)
        if before * after <= 0.0 and abs(before - after) < 90.0:
            moment = _bisect(lambda when: _arc(_asc_at(when, frame), moon), jd, jd + step)
            gap = abs(_arc(_moon_lon(moment), target))
            if best is None or gap < best[0]:
                best = (gap, moment)
        jd += step
    return best[1] if best else None


def golden_table(frame, options):
    """黄金分割点:从起点量 0.382、0.618 周,再加四分投影。"""
    planet = options.get('planet')
    start = frame.lons[planet] if planet in frame.lons else 0.0
    rows = []
    for ratio in GOLDEN_RATIOS:
        for extra in (0.0, 90.0, 180.0, 270.0):
            lon = norm360(start + 360.0 * ratio + extra)
            near = [name for name in TEN if abs(_arc(frame.lons[name], lon)) <= GOLDEN_ORB]
            rows.append({'lon': lon, 'ratio': ratio, 'extra': extra, 'near': near})
    return rows


GOLDEN_ORB = 1.0

# 经典档的现代宫主表(白羊主冥王、天蝎主火星)
MODERN_RULERS = (const.PLUTO, const.VENUS, const.MERCURY, const.MOON, const.SUN, const.MERCURY, const.VENUS, const.MARS,
                 const.JUPITER, const.SATURN, const.URANUS, const.NEPTUNE)
MODERN_CO_RULERS = {0: const.MARS, 7: const.PLUTO, 8: const.NEPTUNE, 9: const.URANUS, 10: const.SATURN, 11: const.JUPITER}
# 改进档按通行的现代配法:有现代主星的座以现代星为主、传统星为逆行次主(天蝎冥王/火、水瓶天王/土、双鱼海王/木),
# 只有传统主星的座以传统星为主、配对座的现代星为逆行次主(白羊火/冥、射手木/海、摩羯土/天)。
MODERN_RULERS_IMPROVED = (const.MARS,) + MODERN_RULERS[1:7] + (const.PLUTO,) + MODERN_RULERS[8:]
MODERN_CO_RULERS_IMPROVED = {**MODERN_CO_RULERS, 0: const.PLUTO, 7: const.MARS}
CUSP_LEAD = 3.0


def _in_arc(lon, start, end):
    return norm360(lon - start) < norm360(end - start)


def modern_house_rulers(frame, classic=True):
    """十二宫的主、共主、次共主,逆行次主只有那颗星逆行时才列。"""
    rulers = MODERN_RULERS if classic else MODERN_RULERS_IMPROVED
    co_rulers = MODERN_CO_RULERS if classic else MODERN_CO_RULERS_IMPROVED
    rows = []
    for index in range(12):
        cusp = frame.cusps[index]
        following = frame.cusps[(index + 1) % 12]
        width = norm360(following - cusp)
        sign = int(cusp // 30)
        next_sign = (sign + 1) % 12
        within = norm360(following - (sign + 1) * 30.0)
        spans = within < width and within >= min(15.0, width / 2.0) - 1e-6
        retro = lambda key: co_rulers[key] if key in co_rulers and frame.speeds.get(co_rulers[key], 1.0) < 0.0 else None
        rows.append({
            'house': index + 1,
            'ruler': rulers[sign],
            'rulerRetro': retro(sign),
            'coRuler': rulers[index],
            'coRulerRetro': retro(index),
            'nextRuler': rulers[next_sign] if spans else None,
            'nextRulerRetro': retro(next_sign) if spans else None,
            'inside': [name for name in TEN if _in_arc(frame.lons[name], cusp, following)],
            'nearCusp': [name for name in TEN if _in_arc(frame.lons[name], norm360(cusp - CUSP_LEAD), cusp)],
        })
    return rows


def vertical_rows(frame):
    """每颗星的两解:赤纬相同的两个黄经,出黄道带的星两解都没有。"""
    rows = []
    for name in TEN:
        lon, lat = frame.tropical(frame.lons[name]), frame.lats[name]
        declination = ecl_to_equ(lon, lat, frame.eps)[1]
        ratio = math.sin(math.radians(declination)) / math.sin(math.radians(frame.eps))
        if abs(ratio) > 1.0:
            rows.append({'id': name, 'outside': True, 'declination': declination})
            continue
        first = norm360(math.degrees(math.asin(ratio)))
        rows.append({'id': name, 'outside': False, 'declination': declination, 'first': frame.display(first), 'second': frame.display(180.0 - first)})
    return rows


def _options(data):
    planet = data.get('transformPlanet')
    return {
        'planet': planet if planet in BODY_IDS else None,
        'shift': to_bool(data.get('transformShift')),
        'variant': 'classic' if data.get('transformVariant') == 'classic' else 'improved',
    }


def _house_code(chart, lat, eps):
    """跟用户的分宫制走;自定义宫制落回 Placidus。半弧类宫制进极圈不成立,换 Porphyry。"""
    code = SWE_HOUSESYS.get(chart.hsys, b'P')
    if code in SEMI_ARC_SYSTEMS and abs(lat) >= 90.0 - eps:
        return b'O'
    return code


def _frame_from(perchart, params):
    chart = perchart.chart
    jd = perchart.dateTime.jd
    pos = perchart.pos
    objects = [item for item in chart.objects if getattr(item, 'id', None) in TEN + (const.NORTH_NODE, const.SOUTH_NODE)]
    lons = {item.id: item.lon for item in objects}
    lats = {item.id: getattr(item, 'lat', 0.0) or 0.0 for item in objects}
    speeds = {item.id: getattr(item, 'lonspeed', 0.0) or 0.0 for item in objects}
    cusps = [house.lon for house in chart.houses]
    asc = chart.getAngle(const.ASC).lon
    mc = chart.getAngle(const.MC).lon
    eps = swisseph.calc_ut(jd, swisseph.ECL_NUT)[0][0]
    system = _house_code(chart, pos.lat, eps)
    offset = norm360(swisseph.calc_ut(jd, swisseph.SUN, swisseph.FLG_SWIEPH)[0][0] - lons[const.SUN])
    armc = swisseph.houses_ex(jd, pos.lat, pos.lon, b'O')[1][2]        # ARMC 与宫制无关;有的宫制在高纬直接报错
    return Frame(jd, pos.lat, pos.lon, lons, lats, speeds, asc, mc, cusps, armc, eps, system, offset)


class TransformChart:
    """把变换写回盘对象,relocate 后 reinit,盘面和相位都按新位置重算。"""

    def __init__(self, perchart, result, frame):
        self.perchart = perchart
        self.result = result
        self.frame = frame

    def _refresh_coordinates(self, point, lat=None):
        """赤经赤纬、方位高度跟着新黄经走,否则快照和平行星读到的还是本命值。"""
        lat = (getattr(point, 'lat', 0.0) or 0.0) if lat is None else lat
        tropical = self.frame.tropical(point.lon)
        if hasattr(point, 'ra'):
            point.ra, point.decl = ecl_to_equ(tropical, lat, self.frame.eps)
        if hasattr(point, 'azimuth'):
            altitude = _horizon(self.frame, point.lon, lat, NATAL_REFRACTION)
            point.azimuth, point.altitudeTrue = altitude[0], altitude[1]
            if hasattr(point, 'altitudeAppa'):
                point.altitudeAppa = altitude[2]

    def _move(self, point):
        lat = getattr(point, 'lat', 0.0) or 0.0
        before = point.lon
        point.relocate(norm360(self.result['move'](getattr(point, 'id', None), point.lon, lat)))
        if self.result['physical'] and point.lon != before:
            self._refresh_coordinates(point)

    def _move_angle(self, name, value):
        angle = self.perchart.chart.getAngle(name)
        angle.relocate(value)
        if self.result['physical']:
            self._refresh_coordinates(angle, 0.0)         # 四轴就在黄道上

    def _freeze(self, diurnal, horizon):
        """reinit 会重跑站心月、希腊点变体和福点整宫:它们在起盘时已生效,再跑一遍会把变换结果盖掉。
        昼夜是出生事实,不随变换改。horizon 非空时地平上下、得时失时也按本命值回填。"""
        perchart = self.perchart
        perchart.houseCust = None
        perchart._applyTopoMoon = lambda: None
        perchart._applyLotVariants = lambda: None
        perchart._diurnalWithSectBuffer = lambda: diurnal
        if horizon is not None:
            original = perchart.hayyiz

            def natal_hayyiz(planet, is_diurnal):
                saved = horizon.get(getattr(planet, 'id', None))
                if saved is None:
                    return original(planet, is_diurnal)
                planet.aboveHorizon, planet.hayyiz = saved
                return saved[1]
            perchart.hayyiz = natal_hayyiz

    def apply(self):
        chart = self.perchart.chart
        custom_houses = self.perchart.houseCust is not None
        diurnal = self.perchart.isDiurnal
        horizon = None
        if self.result['natalHorizon']:
            horizon = {getattr(item, 'id', None): (item.aboveHorizon, item.hayyiz) for item in chart.objects
                       if hasattr(item, 'aboveHorizon') and hasattr(item, 'hayyiz')}
        for item in list(chart.objects) + list(chart.pars):
            self._move(item)
        asc, mc = self.result['asc'], self.result['mc']
        if asc is not None:
            self._move_angle(const.ASC, asc)
            self._move_angle(const.DESC, norm360(asc + 180.0))
        if mc is not None:
            self._move_angle(const.MC, mc)
            self._move_angle(const.IC, norm360(mc + 180.0))
        cusps = self.result['cusps']
        derived = self.result['derived']
        if cusps is not None:
            for index, house in enumerate(chart.houses):
                step = norm360(cusps[(index + 1) % 12] - cusps[index]) or 30.0
                # 变换后的等宫一律 30°:北交宫盘的宫头递减,取差会得到 330°。其余宫制保持取差,极区的宫头本来就可能倒序,不能动
                house.size = 30.0 if derived else step
                house.relocate(cusps[index])
                if derived:
                    house.hsys = const.HOUSES_WHOLE_SIGN          # 等宫归宫不要 Placidus 那 5° 提前量
                    house.hsysDerived = derived
                elif custom_houses and self.result['local']:
                    house.hsysDerived = BASE_HOUSE_MODE
        self._freeze(diurnal, horizon)
        self.perchart.reinit()


def _chart_payload(perchart, params, data):
    return {
        'params': {
            'birth': perchart.getBirthStr(),
            'ad': -1 if getattr(perchart, 'isBC', False) else 1,
            'lat': params.get('lat'), 'lon': params.get('lon'), 'hsys': params.get('hsys'), 'zone': params.get('zone'),
            'tradition': perchart.tradition, 'zodiacal': perchart.zodiacal,
            'termsVariant': parse_terms_variant(data.get('termsVariant', 0)),
        },
        'chart': perchart.getChartObj(),
        'aspects': {'normalAsp': perchart.getAspects(), 'immediateAsp': perchart.getImmediateAspects(), 'signAsp': perchart.getSignAspects()},
        'lots': perchart.getPars(perchart.chart),
        'receptions': perchart.getReceptions(),
        'mutuals': perchart.getMutuals(),
        'declParallel': perchart.getParallel(),
    }


def _positions(natal, perchart, hidden=None):
    rows = []
    for point in chart_points(perchart, include_angles=True):
        if point['id'] in natal and point['id'] != hidden:
            rows.append({'id': point['id'], 'natalLon': natal[point['id']], 'lon': point['lon']})
    return rows


def _build_moment(kind, frame, params, data):
    """Persona、Epoch 是换一个时刻重新起盘。"""
    options = _options(data)
    if kind == 'persona':
        moment = persona_moment(frame, options['planet'] or const.MOON)
    else:
        moment = epoch_moment(frame, _house_option(data))
    if moment is None:
        return None, None
    return PerChart(chart_params_from_jd(params, moment)), moment


def _house_option(data):
    try:
        house = int(data.get('transformHouse') or 1)
    except (TypeError, ValueError):
        house = 1
    return house if 1 <= house <= 12 else 1


def build_transform_chart(data):
    data = dict(data or {})
    kind = data.get('transformKind')
    if kind not in TRANSFORMS and kind not in MOMENT_KINDS:
        kind = 'inverted'
    params = base_params(data)
    terms = None
    try:
        terms = push_classical_request(data)
        perchart = PerChart(params)
        natal = {point['id']: point['lon'] for point in chart_points(perchart, include_angles=True)}
        frame = _frame_from(perchart, params)
        result = {'kind': kind, 'rulers': modern_house_rulers(frame, data.get('transformVariant') == 'classic'), 'golden': golden_table(frame, _options(data))}
        if kind == 'vertical':
            result['vertical'] = vertical_rows(frame)
        if kind in MOMENT_KINDS:
            perchart, moment = _build_moment(kind, frame, params, data)
            if perchart is None:
                result['momentFailed'] = True         # 不用 err:Java 见 err 就整体抛错,页面收不到说明
                return result
            result['moment'] = date_time_from_jd(moment, params.get('zone'))['datetime']
        else:
            transform = TRANSFORMS[kind](frame, _options(data))
            TransformChart(perchart, transform, frame).apply()
            result['coordinatesMoved'] = transform['physical']
            result['natalHorizon'] = transform['natalHorizon']
        # 中心星没有「从自己看自己」的位置,不进表;盘上它留在原位作参照
        result['positions'] = _positions(natal, perchart, (_options(data)['planet'] or const.SUN) if kind == 'planetCentered' else None)
        result['chart'] = _chart_payload(perchart, params, data)
        return result
    finally:
        pop_classical_request(terms)
