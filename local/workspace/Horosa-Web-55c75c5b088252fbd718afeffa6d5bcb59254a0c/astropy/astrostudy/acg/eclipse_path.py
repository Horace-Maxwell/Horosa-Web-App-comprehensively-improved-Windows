"""日食路径:出生前后最近一次日食在地面上的轨迹,供占星地图叠加。

中心食(全、环、全环)画中心线和两侧食带边界;偏食没有中心线,画逐时刻食分最大点的轨迹。
时刻、位置取 Swiss Ephemeris 的 sol_eclipse_when_glob / sol_eclipse_where。
食带边界是影斑扫过地面的包络,不是某一刻影斑的横截线:逐个中心点沿垂直于前进方向二分,判据是「这一点在前后
EDGE_WINDOW_MIN 分钟内是否有某一刻见到中心食」(sol_eclipse_how 的食分 ≥ min(1, 月日视径比),且日在地平上)。
太阳低、影斑斜着拖长时,横截线比包络窄得多(高纬、日出日没段能窄一半以上)。
"""
from functools import lru_cache
import math

import swisseph

EARTH_RADIUS_KM = 6371.0
SAMPLES = 160
WHICH = ('prenatal', 'postnatal')
FILTERS = ('any', 'central')
FLAG = swisseph.FLG_SWIEPH

TYPE_NAMES = (
    (swisseph.ECL_ANNULAR_TOTAL, 'hybrid'),
    (swisseph.ECL_TOTAL, 'total'),
    (swisseph.ECL_ANNULAR, 'annular'),
    (swisseph.ECL_PARTIAL, 'partial'),
)


def _type_name(flag):
    for bit, name in TYPE_NAMES:
        if flag & bit:
            return name
    return 'partial'


CENTRAL_KINDS = swisseph.ECL_TOTAL | swisseph.ECL_ANNULAR | swisseph.ECL_ANNULAR_TOTAL
EDGE_STEPS = 14          # 起始括号 ≤ 1500 km,14 次二分到 0.1 km 以内
EDGE_EVERY = 2           # 边界每隔一个中心点求一次(中心线照旧 SAMPLES 点)
EDGE_MAX_KM = 1500.0


def _find(jd, backward, central_only):
    # 只给 ECL_CENTRAL 不带食型位,引擎会一直找到星历表尽头;要连同全 / 环 / 全环一起给
    kind = (swisseph.ECL_CENTRAL | CENTRAL_KINDS) if central_only else 0
    flag, tret = swisseph.sol_eclipse_when_glob(jd, FLAG, kind, backward)
    return flag, tret


def _destination(lat, lon, bearing, distance_km):
    """从 (lat, lon) 沿方位 bearing(北起顺时针)走 distance_km 的大圆终点。"""
    d = distance_km / EARTH_RADIUS_KM
    p1, l1, b = math.radians(lat), math.radians(lon), math.radians(bearing)
    p2 = math.asin(math.sin(p1) * math.cos(d) + math.cos(p1) * math.sin(d) * math.cos(b))
    l2 = l1 + math.atan2(math.sin(b) * math.sin(d) * math.cos(p1), math.cos(d) - math.sin(p1) * math.sin(p2))
    return math.degrees(p2), (math.degrees(l2) + 540.0) % 360.0 - 180.0


def _bearing(a, b):
    p1, p2 = math.radians(a['lat']), math.radians(b['lat'])
    dl = math.radians(b['lon'] - a['lon'])
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(y, x)) + 360.0) % 360.0


def _track(start, end):
    """start → end 均匀取样,每点取该时刻中心线(或最大食分点)的位置与本影直径。"""
    rows = []
    for index in range(SAMPLES + 1):
        jd = start + (end - start) * index / SAMPLES
        try:
            flag, geopos, attr = swisseph.sol_eclipse_where(jd, FLAG)
        except swisseph.Error:
            continue
        if not flag:
            continue
        rows.append({'jd': jd, 'lat': geopos[1], 'lon': geopos[0], 'width': abs(attr[3])})
    return rows


EDGE_WINDOW_MIN = 18.0
EDGE_SCAN = 12


def _centrality(jd, lat, lon):
    """食分 − min(1, 月日视径比):≥ 0 即这一刻在这一点见到全食或环食;日不可见(无食)返回 None。"""
    try:
        flag, attr = swisseph.sol_eclipse_how(jd, (lon, lat, 0.0), FLAG)
    except swisseph.Error:
        return None
    if not flag:
        return None
    return attr[0] - min(1.0, attr[1])


def _inside(jd, lat, lon):
    """这一点在 jd 前后 EDGE_WINDOW_MIN 分钟内有没有哪一刻见到中心食:先逐分钟粗扫,再在最好的一格两侧黄金分割求极大。"""
    window = EDGE_WINDOW_MIN / 1440.0
    step = 2.0 * window / EDGE_SCAN
    best_t, best = None, None
    for index in range(EDGE_SCAN + 1):
        t = jd - window + index * step
        value = _centrality(t, lat, lon)
        if value is not None and (best is None or value > best):
            best_t, best = t, value
    if best is None:
        return False
    if best >= 0.0:
        return True
    lo, hi = best_t - step, best_t + step
    ratio = (math.sqrt(5.0) - 1.0) / 2.0
    for _ in range(16):
        a = hi - ratio * (hi - lo)
        b = lo + ratio * (hi - lo)
        fa, fb = _centrality(a, lat, lon), _centrality(b, lat, lon)
        fa = -1e9 if fa is None else fa
        fb = -1e9 if fb is None else fb
        if fa >= 0.0 or fb >= 0.0:
            return True
        if fa > fb:
            hi = b
        else:
            lo = a
    return False


def _edge(point, bearing):
    """从中心线沿 bearing 走到食带边上。中心点本身不在食带里(掠过地球边缘)时返回 None。"""
    if not _inside(point['jd'], point['lat'], point['lon']):
        return None
    inner, outer = 0.0, max(point['width'], 50.0)
    while _inside(point['jd'], *_destination(point['lat'], point['lon'], bearing, outer)):
        inner, outer = outer, outer * 2.0
        if outer > EDGE_MAX_KM:
            return None
    for _ in range(EDGE_STEPS):
        middle = (inner + outer) / 2.0
        if _inside(point['jd'], *_destination(point['lat'], point['lon'], bearing, middle)):
            inner = middle
        else:
            outer = middle
    return _destination(point['lat'], point['lon'], bearing, inner)


@lru_cache(maxsize=16)
def _limits_cached(start, end):
    north, south = _limits(_track(start, end))
    return tuple(north), tuple(south)


def _limits(track):
    """中心线两侧的食带边界,方向垂直于前进方向。左右两侧各自连成一条线,再按整条线的平均纬度定哪条是北界
    (逐点比纬度在极区会左右对调,两条线互相穿过中心线)。"""
    if len(track) < 2:
        return [], []
    left, right = [], []
    for index, point in enumerate(track):
        if index % EDGE_EVERY and index != len(track) - 1:
            continue
        a = track[max(index - 1, 0)]
        b = track[min(index + 1, len(track) - 1)]
        heading = _bearing(a, b)
        l, r = _edge(point, heading - 90.0), _edge(point, heading + 90.0)
        if l is None or r is None:
            continue
        left.append({'lat': l[0], 'lon': l[1]})
        right.append({'lat': r[0], 'lon': r[1]})
    if not left:
        return [], []
    mean = lambda rows: sum(p['lat'] for p in rows) / len(rows)
    return (left, right) if mean(left) >= mean(right) else (right, left)


def eclipse_path(jd, which='prenatal', filter_='any'):
    """jd:出生 UT 儒略日。返回 None 表示关闭或算不出。"""
    if which not in WHICH:
        return None
    if filter_ not in FILTERS:
        filter_ = 'any'
    try:
        flag, tret = _find(jd, which == 'prenatal', filter_ == 'central')
    except swisseph.Error:
        return None
    greatest = tret[0]
    if not greatest:
        return None
    kind = _type_name(flag)
    span = (tret[6], tret[7]) if tret[6] and tret[7] else (tret[4], tret[5])     # 中心线起止;缺则退到全 / 环食起止
    central = bool(flag & swisseph.ECL_CENTRAL) and span[0] and span[1]
    try:
        _, geopos, attr = swisseph.sol_eclipse_where(greatest, FLAG)
    except swisseph.Error:
        return None
    result = {
        'which': which,
        'filter': filter_,
        'jd': greatest,
        'daysFromBirth': greatest - jd,
        'type': kind,
        'central': bool(central),
        'greatest': {'lat': geopos[1], 'lon': geopos[0]},
        'magnitude': attr[8] if len(attr) > 8 else attr[0],
        'widthKm': abs(attr[3]) if central else None,
    }
    if central:
        track = _track(span[0], span[1])
        north, south = ([dict(p) for p in rows] for rows in _limits_cached(span[0], span[1]))
        result['track'] = [{'lat': p['lat'], 'lon': p['lon']} for p in track]
        result['north'] = north
        result['south'] = south
    else:
        # 偏食:地面上从初亏到复圆,逐时刻食分最大的点连成一条线
        track = _track(tret[2], tret[3])
        result['track'] = [{'lat': p['lat'], 'lon': p['lon']} for p in track]
        result['north'] = []
        result['south'] = []
    return result
