"""星历与盘面公用件:天体编号表 / 缺省天体与相位表 / 星座元素与模式 / 计分表 / 参数解析 / 时刻换算 / 坐标系中心 / 请求内黄经 memo 与取黄经 / 盘面取点 / 取相位(由 astroextra.py 整段搬出,astrostudy.astroextra 照旧可取这些名字)。"""
import contextlib
import os
import threading
import swisseph
from flatlib import const
from flatlib.datetime import Datetime
from astrostudy.civil_calendar import civil_parts_from_jd, reset_ad_for_date


PLANET_SWISS_IDS = {
    const.SUN: swisseph.SUN,
    const.MOON: swisseph.MOON,
    const.MERCURY: swisseph.MERCURY,
    const.VENUS: swisseph.VENUS,
    const.MARS: swisseph.MARS,
    const.JUPITER: swisseph.JUPITER,
    const.SATURN: swisseph.SATURN,
    const.URANUS: swisseph.URANUS,
    const.NEPTUNE: swisseph.NEPTUNE,
    const.PLUTO: swisseph.PLUTO,
}


DEFAULT_EVENT_PLANETS = [
    const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS,
    const.JUPITER, const.SATURN, const.URANUS, const.NEPTUNE, const.PLUTO
]

DEFAULT_NATAL_POINTS = [
    const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS,
    const.JUPITER, const.SATURN, const.ASC, const.MC
]

MAJOR_ASPECTS = [
    {'name': 'Conjunction', 'angle': 0, 'orb': 8},
    {'name': 'Sextile', 'angle': 60, 'orb': 4},
    {'name': 'Square', 'angle': 90, 'orb': 6},
    {'name': 'Trine', 'angle': 120, 'orb': 6},
    {'name': 'Quincunx', 'angle': 150, 'orb': 3},
    {'name': 'Opposition', 'angle': 180, 'orb': 8},
]

SIGN_ELEMENTS = {
    const.ARIES: 'Fire', const.LEO: 'Fire', const.SAGITTARIUS: 'Fire',
    const.TAURUS: 'Earth', const.VIRGO: 'Earth', const.CAPRICORN: 'Earth',
    const.GEMINI: 'Air', const.LIBRA: 'Air', const.AQUARIUS: 'Air',
    const.CANCER: 'Water', const.SCORPIO: 'Water', const.PISCES: 'Water',
}

SIGN_MODES = {
    const.ARIES: 'Cardinal', const.CANCER: 'Cardinal', const.LIBRA: 'Cardinal', const.CAPRICORN: 'Cardinal',
    const.TAURUS: 'Fixed', const.LEO: 'Fixed', const.SCORPIO: 'Fixed', const.AQUARIUS: 'Fixed',
    const.GEMINI: 'Mutable', const.VIRGO: 'Mutable', const.SAGITTARIUS: 'Mutable', const.PISCES: 'Mutable',
}

HOUSE_SCORES = {
    const.HOUSE1: 12, const.HOUSE2: 6, const.HOUSE3: 3, const.HOUSE4: 9,
    const.HOUSE5: 7, const.HOUSE6: 1, const.HOUSE7: 10, const.HOUSE8: 4,
    const.HOUSE9: 5, const.HOUSE10: 11, const.HOUSE11: 8, const.HOUSE12: 2,
}

DIGNITY_SCORES = {
    'ruler': 5,
    'exalt': 4,
    'dayTrip': 3,
    'nightTrip': 3,
    'partTrip': 3,
    'term': 2,
    'face': 1,
}

def norm360(value):
    return value % 360.0


def norm180(value):
    return (value + 180.0) % 360.0 - 180.0


def angle_distance(a, b):
    return abs(norm180(a - b))


def signed_aspect_delta(lon_a, lon_b, aspect):
    # 行运触发过零函数。旧式 |Δ|-aspect 对 0°(合)恒 ≥0、对 180°(冲)恒 ≤0,永不变号 →
    # 行运触发列表从不出合/冲。合相改用有符号角差 Δ=norm180(a-b)(过零即合);冲相用 norm180(a-b-180)
    # (过零即冲);60/90/120 维持 |Δ|-aspect(两侧各过零一次)。返回值绝对值即距该相位的误差度数。
    target = float(aspect)
    if target <= 0.0:
        return norm180(lon_a - lon_b)
    if target >= 180.0:
        return norm180(lon_a - lon_b - 180.0)
    return abs(norm180(lon_a - lon_b)) - target


def safe_float(value, default=0.0):
    try:
        return float(value)
    except Exception:
        return default


def to_bool(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in ('1', 'true', 'yes', 'on')
    return bool(value)


def zone_value(zone):
    txt = str(zone or '+00:00')
    sign = -1 if txt.startswith('-') else 1
    txt = txt[1:] if txt[:1] in ('+', '-') else txt
    parts = txt.split(':')
    hours = int(parts[0]) if parts and parts[0] else 0
    minutes = int(parts[1]) if len(parts) > 1 else 0
    return sign * (hours + minutes / 60.0)


def geo_to_degree(value, positive_marker, negative_marker):
    if isinstance(value, (int, float)):
        return float(value)
    txt = str(value or '0').strip().lower()
    sign = -1 if negative_marker in txt else 1
    txt = txt.replace(positive_marker, ' ').replace(negative_marker, ' ')
    parts = [p for p in txt.replace(':', ' ').split() if p]
    deg = safe_float(parts[0], 0.0) if parts else 0.0
    minute = safe_float(parts[1], 0.0) if len(parts) > 1 else 0.0
    sec = safe_float(parts[2], 0.0) if len(parts) > 2 else 0.0
    return sign * (abs(deg) + minute / 60.0 + sec / 3600.0)


def base_params(data):
    params = dict(data or {})
    params.setdefault('time', '12:00:00')
    params.setdefault('zone', '+00:00')
    params.setdefault('lat', '0n00')
    params.setdefault('lon', '0e00')
    params.setdefault('hsys', 0)
    params.setdefault('zodiacal', 0)
    params.setdefault('tradition', False)
    params.setdefault('predictive', False)
    return params


def dt_from_data(data, date_key='date', time_key='time'):
    return Datetime(data[date_key], data.get(time_key, '00:00:00'), data.get('zone', '+00:00'))


def date_time_from_jd(jd, zone):
    """UT 儒略日 + 时区 → 当地民用日期时刻(1582-10-15 以前儒略历、历史纪年;与起盘引擎同口径,见 civil_calendar)。"""
    local = civil_parts_from_jd(jd + zone_value(zone) / 24.0)
    date_text = local['date']
    time_text = local['time']
    return {
        'jd': jd,
        'datetime': '{0} {1}'.format(date_text, time_text),
        'date': date_text,
        'time': time_text,
    }


def chart_params_from_jd(base, jd, pos=None):
    """以 base 的时区 / 地点等参数,在儒略日 jd 起盘的入参。
    日期串取自 date_time_from_jd(与起盘引擎读串同一口径,往返误差 < 1 秒),纪元标志 ad 随新日期重置——
    base 是公元前的盘、推到的时刻在公元后(或反之)时,不能沿用 base 的 ad。"""
    local = date_time_from_jd(jd, base.get('zone', '+00:00'))
    params = dict(base)
    params['date'] = local['date']
    params['time'] = local['time']
    reset_ad_for_date(params)
    if pos is not None:
        params['lat'] = pos.lat
        params['lon'] = pos.lon
    params['tradition'] = False
    params['predictive'] = False
    return params


# 坐标系中心:geo 地心 / helio 日心 / topo 站心(复合行星周期、多中心黄经分析需要)。geo 默认 flag=0 → 与改动前逐字一致。
CENTER_FLAGS = {'geo': 0, 'helio': swisseph.FLG_HELCTR, 'topo': swisseph.FLG_TOPOCTR}


def center_flag(center):
    return CENTER_FLAGS.get(str(center or 'geo').lower(), 0)


# 请求内黄经 memo:同一请求里同 (天体, jd, 中心, 站心坐标) 只算一次(星历表等端点实测同请求重复 32–50%)。
# 结果只取决于这四项(标志只含地心 / 日心 / 站心,不含恒星黄道;星历路径与 JPL 文件进程内恒定)→ 与每次现算逐字节相同。
# 范围 = 一次请求:由 webchartsrv 的请求工具按服务前缀开启、请求结束清空;进程内直调默认不开。
# 开关:HOROSA_SWE_LON_MEMO=0 → 不 memo(旧行为)。
_SWE_LON_MEMO_ON = os.environ.get('HOROSA_SWE_LON_MEMO', '1').lower() not in ('0', 'false', 'no', 'off')
_SWE_LON_TL = threading.local()


def swe_lon_memo_begin():
    _SWE_LON_TL.memo = {} if _SWE_LON_MEMO_ON else None


def swe_lon_memo_end():
    _SWE_LON_TL.memo = None


@contextlib.contextmanager
def swe_lon_memo():
    """在 with 块内开启请求级黄经 memo(已开启则沿用外层)。"""
    outer = getattr(_SWE_LON_TL, 'memo', None)
    if outer is None:
        swe_lon_memo_begin()
    try:
        yield
    finally:
        if outer is None:
            swe_lon_memo_end()


def swe_lon(body, jd, center='geo', lat=0.0, lon=0.0, alt=0.0):
    c = str(center or 'geo').lower()
    topo = None
    memo = getattr(_SWE_LON_TL, 'memo', None)
    if c == 'topo':
        # 站心必须先置观测点:否则 swisseph 冷启抛「geographic position has not been set」,
        # 或复用上一次全局 set_topo 的位置(跨请求泄漏 → 非确定性、不可 golden)。
        # 每次显式置点(无坐标→(0,0,0) 确定性兜底):永不抛、永不泄漏、同输入同输出。
        try:
            topo = (float(lon or 0.0), float(lat or 0.0), float(alt or 0.0))
            swisseph.set_topo(topo[0], topo[1], topo[2])
        except Exception:
            memo = None   # 置点失败时结果取决于先前的全局站心位置 → 这一次不进 memo
    if memo is not None:
        key = (body, jd, c, topo)
        hit = memo.get(key)
        if hit is not None:
            return hit
    xx, _ = swisseph.calc_ut(jd, PLANET_SWISS_IDS[body],
                             swisseph.FLG_SWIEPH | swisseph.FLG_SPEED | center_flag(c))
    res = (norm360(xx[0]), xx[3], xx)
    if memo is not None:
        memo[key] = res
    return res


def sign_index(lon):
    return int(norm360(lon) / 30.0) % 12


def sign_name_from_lon(lon):
    return const.LIST_SIGNS[sign_index(lon)]


def object_to_dict(obj):
    return {
        'id': obj.id,
        'lon': safe_float(getattr(obj, 'lon', 0)),
        'lat': safe_float(getattr(obj, 'lat', 0)),
        'sign': getattr(obj, 'sign', sign_name_from_lon(safe_float(getattr(obj, 'lon', 0)))),
        'signlon': safe_float(getattr(obj, 'signlon', safe_float(getattr(obj, 'lon', 0)) % 30)),
        'lonspeed': safe_float(getattr(obj, 'lonspeed', 0)),
    }


def chart_points(perchart, include_angles=True):
    points = []
    for obj in perchart.chart.objects:
        if getattr(obj, 'id', None) in const.LIST_MIDDLE_POINTS:
            continue
        points.append(object_to_dict(obj))
    if include_angles:
        for obj in perchart.chart.angles:
            points.append(object_to_dict(obj))
    return points


def find_aspect(points, a, b, target, orb):
    pa = next((item for item in points if item['id'] == a), None)
    pb = next((item for item in points if item['id'] == b), None)
    if not pa or not pb:
        return None
    delta = abs(angle_distance(pa['lon'], pb['lon']) - target)
    if delta <= orb:
        return {'a': a, 'b': b, 'aspect': target, 'orb': delta}
    return None
