import math
import traceback

import swisseph
from flatlib import const
from flatlib.datetime import Datetime
from flatlib.geopos import GeoPos
from flatlib.chart import Chart
from flatlib import angle
from flatlib.dignities import essential
from flatlib.protocols.temperament import Temperament

from astrostudy.perchart import PerChart, push_request_terms, pop_request_terms, parse_terms_variant
from astrostudy.perpredict import dateSolarReturn, dateLunarReturn
from astrostudy.thirteenthchart import HarmonicChart, DraconicChart


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
    diff = abs(norm180(lon_a - lon_b))
    return diff - float(aspect)


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
    local_jd = jd + zone_value(zone) / 24.0
    year, month, day, hour_float = swisseph.revjul(local_jd, swisseph.GREG_CAL)
    hour = int(hour_float)
    minute_float = (hour_float - hour) * 60.0
    minute = int(minute_float)
    second = int(round((minute_float - minute) * 60.0))
    if second >= 60:
        second -= 60
        minute += 1
    if minute >= 60:
        minute -= 60
        hour += 1
    date_text = '{0:04d}-{1:02d}-{2:02d}'.format(year, month, day)
    time_text = '{0:02d}:{1:02d}:{2:02d}'.format(hour, minute, second)
    return {
        'jd': jd,
        'datetime': '{0} {1}'.format(date_text, time_text),
        'date': date_text,
        'time': time_text,
    }


def chart_params_from_jd(base, jd, pos=None):
    local = date_time_from_jd(jd, base.get('zone', '+00:00'))
    params = dict(base)
    params['date'] = local['date']
    params['time'] = local['time']
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


def swe_lon(body, jd, center='geo', lat=0.0, lon=0.0, alt=0.0):
    c = str(center or 'geo').lower()
    if c == 'topo':
        # 站心必须先置观测点:否则 swisseph 冷启抛「geographic position has not been set」,
        # 或复用上一次全局 set_topo 的位置(跨请求泄漏 → 非确定性、不可 golden)。
        # 每次显式置点(无坐标→(0,0,0) 确定性兜底):永不抛、永不泄漏、同输入同输出。
        try:
            swisseph.set_topo(float(lon or 0.0), float(lat or 0.0), float(alt or 0.0))
        except Exception:
            pass
    xx, _ = swisseph.calc_ut(jd, PLANET_SWISS_IDS[body],
                             swisseph.FLG_SWIEPH | swisseph.FLG_SPEED | center_flag(c))
    return norm360(xx[0]), xx[3], xx


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


def detect_patterns(points):
    ids = [p['id'] for p in points if p['id'] in DEFAULT_EVENT_PLANETS or p['id'] in (const.ASC, const.MC)]
    patterns = []
    aspects = {}
    for i, ida in enumerate(ids):
        for idb in ids[i + 1:]:
            for asp in MAJOR_ASPECTS:
                hit = find_aspect(points, ida, idb, asp['angle'], asp['orb'])
                if hit:
                    aspects[(ida, idb, asp['angle'])] = hit
                    aspects[(idb, ida, asp['angle'])] = hit

    def has(a, b, deg):
        return aspects.get((a, b, deg))

    for i, a in enumerate(ids):
        for j, b in enumerate(ids[i + 1:], i + 1):
            for c in ids[j + 1:]:
                if has(a, b, 120) and has(a, c, 120) and has(b, c, 120):
                    patterns.append({'type': 'grand_trine', 'label': 'Grand Trine', 'points': [a, b, c]})
                if has(a, b, 60) and has(a, c, 150) and has(b, c, 150):
                    patterns.append({'type': 'yod', 'label': 'Yod', 'points': [a, b, c], 'apex': c})
                if has(a, c, 60) and has(a, b, 150) and has(c, b, 150):
                    patterns.append({'type': 'yod', 'label': 'Yod', 'points': [a, c, b], 'apex': b})
                if has(b, c, 60) and has(b, a, 150) and has(c, a, 150):
                    patterns.append({'type': 'yod', 'label': 'Yod', 'points': [b, c, a], 'apex': a})
                for apex, left, right in ((a, b, c), (b, a, c), (c, a, b)):
                    if has(left, right, 180) and has(apex, left, 90) and has(apex, right, 90):
                        patterns.append({'type': 't_square', 'label': 'T-Square', 'points': [apex, left, right], 'apex': apex})

    n = len(ids)
    for a in range(n):
        for b in range(a + 1, n):
            for c in range(b + 1, n):
                for d in range(c + 1, n):
                    quad = [ids[a], ids[b], ids[c], ids[d]]
                    opps = 0
                    squares = 0
                    sextiles = 0
                    trines = 0
                    for i in range(4):
                        for j in range(i + 1, 4):
                            opps += 1 if has(quad[i], quad[j], 180) else 0
                            squares += 1 if has(quad[i], quad[j], 90) else 0
                            sextiles += 1 if has(quad[i], quad[j], 60) else 0
                            trines += 1 if has(quad[i], quad[j], 120) else 0
                    if opps >= 2 and squares >= 4:
                        patterns.append({'type': 'grand_cross', 'label': 'Grand Cross', 'points': quad})
                    if opps >= 2 and sextiles >= 2 and trines >= 2:
                        patterns.append({'type': 'mystic_rectangle', 'label': 'Mystic Rectangle', 'points': quad})
                    for tri in ((0, 1, 2), (0, 1, 3), (0, 2, 3), (1, 2, 3)):
                        rest = next(idx for idx in range(4) if idx not in tri)
                        tri_ids = [quad[idx] for idx in tri]
                        rest_id = quad[rest]
                        if has(tri_ids[0], tri_ids[1], 120) and has(tri_ids[0], tri_ids[2], 120) and has(tri_ids[1], tri_ids[2], 120):
                            if any(has(rest_id, t, 180) for t in tri_ids) and sum(1 for t in tri_ids if has(rest_id, t, 60)) >= 2:
                                patterns.append({'type': 'kite', 'label': 'Kite', 'points': quad, 'tail': rest_id})
                    # Cradle 摇篮:四星链 a-b-c-d 三段连续 60° + 首尾 a-d 180°(半盘弧上的缓冲结构)。
                    # 枚举 quad 的链排列(首尾无序、链向无序 → 12 种有向排列/4=3 种本质链×首尾 2 向,直接全排列去重)。
                    import itertools as _it
                    for perm in _it.permutations(quad):
                        pa, pb, pc, pd = perm
                        if pa > pd:
                            continue   # 链反向等价,半序去重
                        if has(pa, pb, 60) and has(pb, pc, 60) and has(pc, pd, 60) and has(pa, pd, 180):
                            patterns.append({'type': 'cradle', 'label': 'Cradle', 'points': [pa, pb, pc, pd]})
                            break

    # Grand Sextile 大六角:六星按黄经环序相邻皆 60°(两套大三角嵌套的六芒星,极罕见)。
    lon_of = {p['id']: p['lon'] for p in points if p['id'] in ids}
    import itertools as _it6
    for combo in _it6.combinations(ids, 6):
        if any(pid not in lon_of for pid in combo):
            continue
        ring = sorted(combo, key=lambda pid: lon_of[pid])
        ok = True
        for i in range(6):
            if not has(ring[i], ring[(i + 1) % 6], 60):
                ok = False
                break
        if ok:
            patterns.append({'type': 'grand_sextile', 'label': 'Grand Sextile', 'points': list(ring)})

    by_sign = {}
    for p in points:
        if p['id'] in ids:
            by_sign.setdefault(p['sign'], []).append(p['id'])
    for sign, members in by_sign.items():
        if len(members) >= 3:
            patterns.append({'type': 'stellium_sign', 'label': 'Sign Stellium', 'sign': sign, 'points': members})

    sorted_points = sorted([p for p in points if p['id'] in ids], key=lambda item: item['lon'])
    doubled = sorted_points + [{**p, 'lon': p['lon'] + 360} for p in sorted_points]
    seen = set()
    for i in range(len(sorted_points)):
        cluster = [doubled[i]]
        j = i + 1
        while j < i + len(sorted_points) and doubled[j]['lon'] - doubled[i]['lon'] <= 10:
            cluster.append(doubled[j])
            j += 1
        if len(cluster) >= 3:
            key = tuple(sorted(p['id'] for p in cluster))
            if key not in seen:
                seen.add(key)
                patterns.append({'type': 'stellium_orb', 'label': 'Tight Stellium', 'span': cluster[-1]['lon'] - cluster[0]['lon'], 'points': list(key)})

    unique = []
    keys = set()
    for item in patterns:
        key = (item['type'], tuple(sorted(item.get('points', []))), item.get('sign'))
        if key not in keys:
            unique.append(item)
            keys.add(key)
    return unique


def _angle_lon(perchart, angle_id):
    try:
        return perchart.chart.get(angle_id).lon
    except Exception:
        return None


def distribution(points, asc_lon=None, mc_lon=None):
    res = {
        'elements': {'Fire': 0, 'Earth': 0, 'Air': 0, 'Water': 0},
        'modes': {'Cardinal': 0, 'Fixed': 0, 'Mutable': 0},
        'hemispheres': {'east': 0, 'west': 0, 'above': 0, 'below': 0},
    }
    for p in points:
        if p['id'] not in DEFAULT_EVENT_PLANETS:
            continue
        sign = p['sign']
        if sign in SIGN_ELEMENTS:
            res['elements'][SIGN_ELEMENTS[sign]] += 1
        if sign in SIGN_MODES:
            res['modes'][SIGN_MODES[sign]] += 1
        lon = p['lon']
        # 半球须按地平/子午轴(ASC-DSC / MC-IC),非黄经绝对值。地平下=自 ASC 增黄经 180°(经 IC 到 DSC,
        # 即 1-6 宫);东半=自 MC 增 180°(经 ASC 到 IC,即 10/11/12/1/2/3 宫)。缺 ASC/MC 时退化旧黄经口径。
        if asc_lon is not None and mc_lon is not None:
            rel_h = (lon - asc_lon) % 360.0
            res['hemispheres']['below' if rel_h < 180.0 else 'above'] += 1
            rel_v = (lon - mc_lon) % 360.0
            res['hemispheres']['east' if rel_v < 180.0 else 'west'] += 1
        else:
            res['hemispheres']['below' if 0 <= lon < 180 else 'above'] += 1
            res['hemispheres']['west' if 90 <= lon < 270 else 'east'] += 1
    return res


def almuten_table(perchart):
    rows = []
    totals = {obj: 0 for obj in const.LIST_SEVEN_PLANETS}
    hylegic = [
        perchart.chart.getObject(const.SUN),
        perchart.chart.getObject(const.MOON),
        perchart.chart.getAngle(const.ASC),
        perchart.chart.getObject(const.PARS_FORTUNA),
        perchart.chart.getObject(const.SYZYGY),
    ]
    for point in hylegic:
        row = {'point': point.id, 'scores': {obj: 0 for obj in const.LIST_SEVEN_PLANETS}}
        dig = essential.getInfo(point.sign, point.signlon)
        for key, score in DIGNITY_SCORES.items():
            obj_id = dig.get(key)
            if obj_id in row['scores']:
                row['scores'][obj_id] += score
                totals[obj_id] += score
        rows.append(row)

    house_row = {'point': 'Houses', 'scores': {obj: 0 for obj in const.LIST_SEVEN_PLANETS}}
    for obj_id in const.LIST_SEVEN_PLANETS:
        obj = perchart.chart.getObject(obj_id)
        try:
            house = perchart.chart.houses.getObjectHouse(obj)
            score = HOUSE_SCORES.get(house.id, 0)
        except Exception:
            score = 0
        house_row['scores'][obj_id] += score
        totals[obj_id] += score
    rows.append(house_row)
    return {
        'rows': rows,
        'totals': totals,
        'winner': max(totals.items(), key=lambda item: item[1])[0] if totals else None,
    }


def extra_lots(perchart):
    """阿拉伯点目录:单一来源(各点专属公式,昼夜反转已内置),按题归类,无重复。"""
    res = []
    for lot in perchart.getPars(perchart.chart):
        obj = object_to_dict(lot)
        res.append({
            'id': obj['id'],
            'label': obj['id'],
            'lon': obj['lon'],
            'sign': obj['sign'],
            'signlon': obj['signlon'],
            'category': _lot_category(obj['id']),
        })
    return res


# 点的题别归类(中性词);未列入者归「其它」。
_LOT_CATEGORY = {
    'Pars Spirit': '核心', 'Pars Fortuna': '核心', 'Pars Faith': '核心', 'Pars Substance': '财帛',
    'Pars Father': '亲属', 'Pars Mother': '亲属', 'Pars Brothers': '亲属', 'Pars Sons': '亲属',
    'Pars Wedding [Male]': '婚配', 'Pars Wedding [Female]': '婚配',
    'Pars Diseases': '疾厄', 'Pars Death': '疾厄', 'Pars Travel': '行旅', 'Pars Friends': '人际',
    'Pars Enemies': '人际', 'Pars Saturn': '行星点', 'Pars Jupiter': '行星点', 'Pars Mars': '行星点',
    'Pars Venus': '行星点', 'Pars Mercury': '行星点', 'Pars Horsemanship': '事务', 'Pars Life': '核心',
    'Pars Radix': '核心', 'Pars Eros': '七点', 'Pars Necessity': '七点', 'Pars Courage': '七点',
    'Pars Victory': '七点', 'Pars Nemesis': '七点',
}


def _lot_category(lot_id):
    return _LOT_CATEGORY.get(lot_id, '其它')


# WI-22 比尼/王者恒星:15 比尼星名录 + 四王者星(守望者);性质取托勒密行星对应(中性行星字标,
# 土=Saturn 木=Jupiter 火=Mars 金=Venus 水=Mercury 日=Sun 月=Moon)。坐标/中文名由星历单一来源,此处仅作分类标注。
_BEHENIAN_NATURE = {
    'Algol': '土·木', 'Alcyone': '月·火', 'Aldebaran': '火', 'Capella': '火·水',
    'Sirius': '木·火', 'Procyon': '水·火', 'Regulus': '火·木', 'Algorab': '火·土',
    'Spica': '金·水', 'Arcturus': '火·木', 'Alphecca': '金·水', 'Antares': '火·木',
    'Vega': '金·水', 'Deneb Algedi': '土·木', 'Fomalhaut': '金·水',
}
_ROYAL_WATCHER = {'Aldebaran': '东', 'Regulus': '北', 'Antares': '西', 'Fomalhaut': '南'}


def fixed_star_hits(perchart, orb=1.0):
    stars = perchart.getFixedStars()
    points = [p for p in chart_points(perchart, include_angles=True) if p['id'] in DEFAULT_EVENT_PLANETS or p['id'] in (const.ASC, const.MC, const.DESC, const.IC)]
    hits = []
    for star in stars:
        slon = safe_float(getattr(star, 'lon', 0))
        sid = getattr(star, 'id', '')
        mag = getattr(star, 'mag', None)
        watcher = _ROYAL_WATCHER.get(sid, '')
        for p in points:
            delta = angle_distance(slon, p['lon'])
            if delta <= orb:
                hits.append({
                    'star': sid,
                    'cn': getattr(star, 'name', ''),
                    'mag': safe_float(mag[0] if isinstance(mag, (tuple, list)) else mag, None),
                    'point': p['id'],
                    'orb': delta,
                    'starLon': slon,
                    'pointLon': p['lon'],
                    'sign': sign_name_from_lon(slon),
                    'signlon': slon % 30,
                    'behenian': sid in _BEHENIAN_NATURE,
                    'royal': watcher,
                    'nature': _BEHENIAN_NATURE.get(sid, ''),
                })
    # 去重(星历名录含个别重名星条目,如 Alcyone),同一 星-点 取最紧容许度;
    # 再按"王者→比尼→其余",同档容许度升序排序,凸显择时要星。
    seen = {}
    for h in hits:
        k = (h['star'], h['point'])
        if k not in seen or h['orb'] < seen[k]['orb']:
            seen[k] = h

    def _rank(h):
        return (0 if h['royal'] else (1 if h['behenian'] else 2), h['orb'])
    return sorted(seen.values(), key=_rank)


def compute_classical_patterns(perchart):
    """WI-08 古典格局:护卫 doryphory / 优势相位 overcoming(右旋三分四分六分) / 度数围攻 besieging-by-degree。"""
    pts = {p['id']: p for p in chart_points(perchart, include_angles=False)}
    try:
        is_diurnal = bool(perchart.chart.isDiurnal())
    except Exception:
        is_diurnal = True
    out = {'doryphory': [], 'overcoming': [], 'besieging': []}

    def signed(a, b):
        return ((a - b + 180.0) % 360.0) - 180.0

    sun = pts.get(const.SUN)
    merc_oriental = bool(sun and const.MERCURY in pts and signed(pts[const.MERCURY]['lon'], sun['lon']) < 0)
    diurnal_planets = [const.SUN, const.JUPITER, const.SATURN] + ([const.MERCURY] if merc_oriental else [])
    nocturnal_planets = [const.MOON, const.VENUS, const.MARS] + ([] if merc_oriental else [const.MERCURY])
    sect_planets = diurnal_planets if is_diurnal else nocturnal_planets
    seven = [const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS, const.JUPITER, const.SATURN]

    # 护卫 doryphory:同宗行星于宗派光之前 7–15°(晨升侧)护卫。
    light = const.SUN if is_diurnal else const.MOON
    if light in pts:
        ll = pts[light]['lon']
        for pid in sect_planets:
            if pid == light or pid not in pts:
                continue
            el = signed(pts[pid]['lon'], ll)
            if -15.0 <= el <= -7.0:
                out['doryphory'].append({'planet': pid, 'light': light, 'elong': round(el, 2)})

    # 优势相位 overcoming:A 处 B 上方(右旋)第 9/10/11 座(三分/四分/六分压制)。
    SIGNS = const.LIST_SIGNS
    OVR = {8: 'trine', 9: 'square', 10: 'sextile'}
    for a in seven:
        for b in seven:
            if a == b or a not in pts or b not in pts:
                continue
            try:
                off = (SIGNS.index(pts[a]['sign']) - SIGNS.index(pts[b]['sign'])) % 12
            except Exception:
                continue
            if off in OVR:
                out['overcoming'].append({'over': a, 'under': b, 'aspect': OVR[off],
                                          'overSign': pts[a]['sign'], 'underSign': pts[b]['sign']})

    # 度数围攻 besieging-by-degree:目标被两凶星天体在 ±7° 内夹,其间无他星(区别于整宫围攻)。
    malefics = [const.MARS, const.SATURN]
    for tid in seven:
        if tid in malefics or tid not in pts:
            continue
        t = pts[tid]['lon']
        left = right = None
        for mid in malefics:
            if mid not in pts:
                continue
            el = signed(pts[mid]['lon'], t)
            if -7.0 <= el < 0.0:
                left = (mid, el)
            elif 0.0 < el <= 7.0:
                right = (mid, el)
        if left and right:
            between = any(
                oid not in (tid, left[0], right[0]) and oid in pts and left[1] < signed(pts[oid]['lon'], t) < right[1]
                for oid in seven)
            if not between:
                out['besieging'].append({'planet': tid, 'left': left[0], 'right': right[0],
                                         'leftOrb': round(abs(left[1]), 2), 'rightOrb': round(abs(right[1]), 2)})
    return out


def _wheel_orb(perchart, id_a, id_b, fallback=8.0):
    """与星图所绘/相位tab 一致的相位容许度:取两星 orb 较大者(双向并集——任一方容许度够到即成相;
    日15/月12/水7/金火8/木土9…)。修复 feral 同坑:固定 8° 会漏掉日月宽相(如月对日冲 10.5°)。"""
    try:
        return max(perchart.chart.getObject(id_a).orb(), perchart.chart.getObject(id_b).orb())
    except Exception:
        return fallback


def compute_accidental_dignity(perchart):
    """WI-16 偶然尊贵评分:角续果宫 / 行速 / 东西向 / 日下相 / 月相增减 / 会吉凶 / 喜乐 / 度数围攻 加权汇总。
    标准权重(可入设置);与必然尊贵得分并列。返回每星 {planet, score, factors[]},降序。"""
    SEVEN = [const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS, const.JUPITER, const.SATURN]
    ANGULAR = {1, 4, 7, 10}
    SUCCEDENT = {2, 5, 8, 11}
    INNER = {const.MERCURY, const.VENUS}
    OUTER = {const.MARS, const.JUPITER, const.SATURN}
    MALEFICS = [const.MARS, const.SATURN]
    objs = {o.id: o for o in perchart.chart.objects if getattr(o, 'id', None) in SEVEN}
    sun = objs.get(const.SUN)

    def signed(a, b):
        return ((a - b + 180.0) % 360.0) - 180.0

    rows = []
    for pid in SEVEN:
        o = objs.get(pid)
        if not o:
            continue
        score = 0
        parts = []
        try:
            hn = int(str(getattr(o, 'house', '') or '').replace('House', ''))
        except Exception:
            hn = 0
        if hn in ANGULAR:
            score += 5; parts.append('角宫+5')
        elif hn in SUCCEDENT:
            score += 3; parts.append('续宫+3')
        elif hn:
            score -= 2; parts.append('果宫-2')
        ms = getattr(o, 'meanSpeed', None)
        sp = getattr(o, 'lonspeed', None)
        if ms is not None and sp is not None and pid not in (const.SUN, const.MOON):
            if abs(sp) > abs(ms):
                score += 2; parts.append('行速+2')
            else:
                score -= 2; parts.append('行迟-2')
        if sun is not None and pid != const.SUN:
            el = signed(o.lon, sun.lon)
            if pid in OUTER and el < 0:
                score += 2; parts.append('东出+2')
            elif pid in INNER and el > 0:
                score += 2; parts.append('西入+2')
        ph = getattr(o, 'phase', None)
        if ph == 'free':
            score += 5; parts.append('自由光+5')
        elif ph == 'combust':
            score -= 5; parts.append('焦伤-5')
        elif ph == 'cazimi':
            score += 5; parts.append('核心+5')
        if pid == const.MOON and sun is not None:
            me = (o.lon - sun.lon) % 360.0
            if 0 < me < 180:
                score += 2; parts.append('增光+2')
            else:
                score -= 2; parts.append('减光-2')
        for bid, w, lbl in ((const.JUPITER, 5, '会木+5'), (const.VENUS, 4, '会金+4'), (const.SATURN, -5, '会土-5'), (const.MARS, -4, '会火-4')):
            if bid != pid and bid in objs and abs(signed(o.lon, objs[bid].lon)) <= _wheel_orb(perchart, pid, bid):
                score += w; parts.append(lbl)
        if getattr(o, 'joy', False):
            score += 5; parts.append('喜乐+5')
        if pid not in MALEFICS:
            left = right = False
            for mid in MALEFICS:
                if mid in objs:
                    el = signed(objs[mid].lon, o.lon)
                    if -7.0 <= el < 0.0:
                        left = True
                    elif 0.0 < el <= 7.0:
                        right = True
            if left and right:
                score -= 5; parts.append('围攻-5')
        rows.append({'planet': pid, 'score': score, 'factors': parts})
    rows.sort(key=lambda r: r['score'], reverse=True)
    return rows


def compute_bonification(perchart):
    """WI-12 吉化/凶化:被同类吉星(木/金)会合·凌驾·夹 = 吉化;被凶星(土/火) = 凶化。逐关键星汇总受处置。"""
    pts = {p['id']: p for p in chart_points(perchart, include_angles=False)}
    BEN = [const.JUPITER, const.VENUS]
    MAL = [const.SATURN, const.MARS]
    SIGNS = const.LIST_SIGNS
    seven = [const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS, const.JUPITER, const.SATURN]
    OVR = {8: '三分压制', 9: '四分压制', 10: '六分压制'}

    def signed(a, b):
        return ((a - b + 180.0) % 360.0) - 180.0

    out = []
    for tid in seven:
        if tid not in pts:
            continue
        t = pts[tid]
        bon = []
        mal = []
        for src in BEN + MAL:
            if src == tid or src not in pts:
                continue
            rel = None
            if abs(signed(t['lon'], pts[src]['lon'])) <= _wheel_orb(perchart, tid, src):
                rel = '会合'
            else:
                try:
                    off = (SIGNS.index(pts[src]['sign']) - SIGNS.index(t['sign'])) % 12
                except Exception:
                    off = -1
                if off in OVR:
                    rel = OVR[off]
            if rel:
                (bon if src in BEN else mal).append({'by': src, 'rel': rel})
        if bon or mal:
            out.append({'planet': tid, 'bonified': bon, 'maltreated': mal})
    return out


_PTOL = [0, 60, 90, 120, 180]
_PTOL_CN = {0: '合', 60: '六分', 90: '四分', 120: '三分', 180: '冲'}


def compute_aspect_dynamics(perchart, void_classical=False):
    """WI-10 入相/出相 · 传光 · 聚光 + WI-11 左右相位 · 不合意 · 交点弯曲
    + G10 空亡 void · 阻止 prohibition · 挫败 frustration · 收回 refranation。七政两两托勒密相位为底。"""
    objs = {o.id: o for o in perchart.chart.objects if getattr(o, 'id', None) in
            (const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS, const.JUPITER, const.SATURN)}
    ids = [i for i in (const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS, const.JUPITER, const.SATURN) if i in objs]
    SIGNS = const.LIST_SIGNS

    def diff(la, lb):
        return abs(((la - lb + 180.0) % 360.0) - 180.0)

    def applying(a, b, asp):
        la, lb = objs[a].lon, objs[b].lon
        sa = getattr(objs[a], 'lonspeed', 0.0) or 0.0
        sb = getattr(objs[b], 'lonspeed', 0.0) or 0.0
        now = abs(diff(la, lb) - asp)
        nxt = abs(diff(la + sa * 0.02, lb + sb * 0.02) - asp)
        return nxt < now

    aspects = []
    for i, a in enumerate(ids):
        for b in ids[i + 1:]:
            for asp in _PTOL:
                d = diff(objs[a].lon, objs[b].lon)
                if abs(d - asp) <= _wheel_orb(perchart, a, b):
                    # 左右相位:发出星(慢者发向快者)在黄道序「之前」为右旋(dexter),「之后」为左旋(sinister)。
                    off = (SIGNS.index(objs[a].sign) - SIGNS.index(objs[b].sign)) % 12
                    hand = 'dexter' if off in (9, 10, 11, 8) else 'sinister'
                    aspects.append({'a': a, 'b': b, 'aspect': asp, 'orb': round(abs(d - asp), 2),
                                    'applying': applying(a, b, asp), 'hand': hand})
                    break

    # 传光 translation:某快星先出相于一星、再入相于另一星(两被连星彼此可无相)。
    translation = []
    speeds = {i: abs(getattr(objs[i], 'lonspeed', 0.0) or 0.0) for i in ids}
    for mover in ids:
        seps = [x for x in aspects if mover in (x['a'], x['b']) and not x['applying']]
        apps = [x for x in aspects if mover in (x['a'], x['b']) and x['applying']]
        for s in seps:
            other_s = s['b'] if s['a'] == mover else s['a']
            for ap in apps:
                other_a = ap['b'] if ap['a'] == mover else ap['a']
                if other_s != other_a and speeds.get(mover, 0) >= speeds.get(other_s, 0) and speeds.get(mover, 0) >= speeds.get(other_a, 0):
                    translation.append({'mover': mover, 'from': other_s, 'to': other_a})
    # 聚光 collection:某慢星同时被两更快星入相,而该两快星彼此不成相。
    collection = []
    aspect_set = {(x['a'], x['b']) for x in aspects} | {(x['b'], x['a']) for x in aspects}
    for collector in ids:
        incoming = [x for x in aspects if collector in (x['a'], x['b']) and x['applying']]
        fasters = [(x['b'] if x['a'] == collector else x['a']) for x in incoming
                   if speeds.get(x['b'] if x['a'] == collector else x['a'], 0) > speeds.get(collector, 0)]
        for m in range(len(fasters)):
            for n in range(m + 1, len(fasters)):
                if (fasters[m], fasters[n]) not in aspect_set:
                    collection.append({'collector': collector, 'p1': fasters[m], 'p2': fasters[n]})

    # 不合意 aversion:星座相距 2/6/8/12(无托勒密相位)。
    aversion = []
    for i, a in enumerate(ids):
        for b in ids[i + 1:]:
            off = (SIGNS.index(objs[a].sign) - SIGNS.index(objs[b].sign)) % 12
            if off in (1, 5, 7, 11):
                aversion.append({'a': a, 'b': b})

    # 交点弯曲 bending:行星距北/南交点 90°(±3°)处。
    bending = []
    try:
        node = perchart.chart.getObject(const.NORTH_NODE)
        nlon = node.lon
        for i in ids:
            for tgt, tag in ((nlon + 90.0, '北弯'), (nlon - 90.0, '南弯')):
                if diff(objs[i].lon, tgt % 360.0) <= 3.0:
                    bending.append({'planet': i, 'at': tag})
    except Exception:
        pass

    # ===== G10 连接学说后四式(度数级;快星施动、慢星受者) =====
    # 入相相位列表(施动星 = 该对中更快者)与「剩余度数 r」查表:r 取当前到精确的角差(aspects[*].orb)。
    applying_list = []
    for x in aspects:
        if not x['applying']:
            continue
        sa = speeds.get(x['a'], 0.0)
        sb = speeds.get(x['b'], 0.0)
        mover = x['a'] if sa >= sb else x['b']
        target = x['b'] if mover == x['a'] else x['a']
        applying_list.append({'mover': mover, 'target': target, 'aspect': x['aspect'], 'r': x['orb']})

    # 空亡 void:指定星(默认月)在离开本座前不再完成任何精确相位。
    # 默认本座义:以当前黄经到本座末(30°)的度数为窗口,看是否还有入相且在窗口内完成的精确相位。
    # 空亡古典义(30°内,void_classical):窗口固定 30°,不限本座。默认 OFF。
    void = []
    void_id = const.MOON if const.MOON in objs else (ids[0] if ids else None)
    if void_id is not None and void_id in objs:
        vo = objs[void_id]
        vspeed = speeds.get(void_id, 0.0)
        # 离座窗口:本座义 = 30 - 本座度数;古典义 = 30。逆行则窗口为已走过的本座度数。
        signlon = getattr(vo, 'signlon', vo.lon % 30.0)
        raw_speed = getattr(vo, 'lonspeed', 0.0) or 0.0
        if void_classical:
            window = 30.0
        else:
            window = (signlon if raw_speed < 0 else (30.0 - signlon))
        will_perfect = False
        next_within = None
        for x in applying_list:
            if void_id not in (x['mover'], x['target']):
                continue
            # 完成该入相还需移动 r 度(近似:施动星主导闭合);r<=窗口 ⇒ 离座前可成。
            if x['r'] <= window:
                will_perfect = True
                if next_within is None or x['r'] < next_within:
                    next_within = x['r']
        if not will_perfect:
            void.append({'planet': void_id, 'window': round(window, 2),
                         'mode': 'classical' if void_classical else 'sign'})

    # 阻止 prohibition:甲→乙入相(剩余 r_AB),丙→乙入相 r_CB<r_AB 且丙更快 → 丙先到、截断甲。
    prohibition = []
    for ab in applying_list:
        a, b = ab['mover'], ab['target']
        for cb in applying_list:
            if cb['target'] != b or cb['mover'] == a:
                continue
            c = cb['mover']
            if cb['r'] < ab['r'] and speeds.get(c, 0.0) > speeds.get(a, 0.0):
                prohibition.append({'blocker': c, 'between': a, 'to': b,
                                    'rBlocker': round(cb['r'], 2), 'rOriginal': round(ab['r'], 2)})

    # 挫败 frustration:甲→乙 applying;乙又→丁 applying 且剩余 orb 更小(乙先到丁移情)→ 甲落空。
    frustration = []
    for ab in applying_list:
        a, b = ab['mover'], ab['target']
        for bd in applying_list:
            if b not in (bd['mover'], bd['target']):
                continue
            d = bd['target'] if bd['mover'] == b else bd['mover']
            if d in (a, b):
                continue
            if bd['r'] < ab['r']:
                frustration.append({'frustrated': a, 'via': b, 'to': d,
                                    'rOriginal': round(ab['r'], 2), 'rDefect': round(bd['r'], 2)})

    # 收回 refranation:甲→乙 applying,但甲速度趋零/将变号(扩 0.02 天投影 speed*speed_future<0)→ 撤离。
    refranation = []
    seen_refran = set()
    for ab in applying_list:
        a = ab['mover']
        if a in seen_refran:
            continue
        try:
            o = objs[a]
            sp = getattr(o, 'lonspeed', 0.0) or 0.0
            ms = getattr(o, 'meanSpeed', None)
            # 留点临界(将变号/趋零):速率极小相对平均速率(< 4%),或绝对值近零 → 入相中途撤离。
            # lonspeed 在 0.02 天内近恒,无独立未来采样;以「趋零」为留点的自洽判据。
            tiny = (ms is not None and abs(ms) > 0 and abs(sp) < abs(ms) * 0.04) or abs(sp) < 0.0005
            if tiny:
                refranation.append({'planet': a, 'to': ab['target'], 'r': round(ab['r'], 2)})
                seen_refran.add(a)
        except Exception:
            pass

    return {'aspects': aspects, 'translation': translation, 'collection': collection,
            'aversion': aversion, 'bending': bending,
            'void': void, 'prohibition': prohibition,
            'frustration': frustration, 'refranation': refranation}


# 题别 → (宫位, 自然象征星, 中文)。逐题复合主星 = 该宫起始星座的必然尊贵胜出星 + 自然象征星。
_TOPIC_HOUSES = [
    ('父亲', 4, const.SATURN), ('母亲', 10, const.VENUS), ('兄弟', 3, const.MARS),
    ('婚配', 7, const.VENUS), ('子女', 5, const.JUPITER), ('事业', 10, const.SUN),
    ('财帛', 2, const.JUPITER), ('疾厄', 6, const.MARS), ('死亡', 8, const.SATURN),
]


def compute_topic_almuten(perchart):
    """WI-13 逐题复合主星:每题取相关宫起始星座的必然尊贵积分胜出星 + 自然象征星。"""
    out = []
    for label, house_num, sig in _TOPIC_HOUSES:
        winner = None
        try:
            house = perchart.chart.getHouse(const.LIST_HOUSES[house_num - 1])
            dig = essential.getInfo(house.sign, house.signlon)
            scores = {}
            for key, sc in DIGNITY_SCORES.items():
                oid = dig.get(key)
                if oid:
                    scores[oid] = scores.get(oid, 0) + sc
            winner = max(scores.items(), key=lambda x: x[1])[0] if scores else None
        except Exception:
            winner = None
        out.append({'topic': label, 'house': house_num, 'significator': sig, 'almuten': winner})
    return out


# WI-18 行星时(不等时):昼弧/夜弧各12等分;首时主星=值日星(按日出civil星期),
# 其后逐时按迦勒底降序轮替;标出生所在时段。
_DAY_RULER_BY_DOW = {  # swisseph.day_of_week:0=周一..6=周日
    0: const.MOON, 1: const.MARS, 2: const.MERCURY, 3: const.JUPITER,
    4: const.VENUS, 5: const.SATURN, 6: const.SUN,
}
_CHALDEAN_DESC = [const.SATURN, const.JUPITER, const.MARS, const.SUN, const.VENUS, const.MERCURY, const.MOON]


def compute_planetary_hours(params):
    geopos = [
        geo_to_degree(params.get('lon', '0e00'), 'e', 'w'),
        geo_to_degree(params.get('lat', '0n00'), 'n', 's'),
        safe_float(params.get('altitude', 0.0), 0.0),
    ]
    zone = params.get('zone', '+00:00')
    try:
        birth = Datetime(params.get('date'), params.get('time', '12:00:00'), zone).jd
    except Exception:
        return None

    def nxt(jd, flag):
        _ret, tret = swisseph.rise_trans(jd, PLANET_SWISS_IDS[const.SUN], flag, geopos, 0.0, 0.0, swisseph.FLG_SWIEPH)
        if _ret < 0:   # -2 极区无升降 / -1 错误:不可静默取 tret[0]=0(否则昼夜弧塌缩成伪时段)→ 抛出由外层 except 兜成 None
            raise ValueError('no rise/set (circumpolar or error)')
        return tret[0]

    try:
        anchor = math.floor(birth - 0.5) + 0.5 - 1.0
        sr0 = nxt(anchor, swisseph.CALC_RISE)
        ss0 = nxt(sr0, swisseph.CALC_SET)
        sr1 = nxt(ss0, swisseph.CALC_RISE)
        ss1 = nxt(sr1, swisseph.CALC_SET)
        sr2 = nxt(ss1, swisseph.CALC_RISE)
    except Exception:
        return None  # 极区无升降等

    if sr1 <= birth < sr2:
        sr, ss, srn = sr1, ss1, sr2
    else:
        sr, ss, srn = sr0, ss0, sr1

    dow = swisseph.day_of_week(sr + zone_value(zone) / 24.0)
    day_ruler = _DAY_RULER_BY_DOW.get(dow, const.SUN)
    start_idx = _CHALDEAN_DESC.index(day_ruler)
    day_h = (ss - sr) / 12.0
    night_h = (srn - ss) / 12.0
    hours = []
    for i in range(24):
        if i < 12:
            t0, t1, diurnal = sr + day_h * i, sr + day_h * (i + 1), True
        else:
            j = i - 12
            t0, t1, diurnal = ss + night_h * j, ss + night_h * (j + 1), False
        hours.append({
            'index': i + 1,
            'ruler': _CHALDEAN_DESC[(start_idx + i) % 7],
            'diurnal': diurnal,
            'start': date_time_from_jd(t0, zone)['time'],
            'end': date_time_from_jd(t1, zone)['time'],
            'current': bool(t0 <= birth < t1),
        })
    return {
        'dayRuler': day_ruler,
        'sunrise': date_time_from_jd(sr, zone)['time'],
        'sunset': date_time_from_jd(ss, zone)['time'],
        'nextSunrise': date_time_from_jd(srn, zone)['time'],
        'hours': hours,
    }


# 巴比伦「计数之星」(距星)定名表:30 颗唯一星(楔文文献沿黄道参照星;蟹后南星与蟹前南星同标一星故不重列)。
# (swisseph 星名, 中文距星义, 现代星名)
_BABYLON_NORMAL_STARS = (
    ('Sheratan', '雇工头之前星', 'β Ari'), ('Hamal', '雇工头之后星', 'α Ari'),
    ('Alcyone', '星团', 'η Tau'), ('Aldebaran', '牛颚', 'α Tau'),
    ('Elnath', '战车北星', 'β Tau'), (',zeTau', '战车南星', 'ζ Tau'),
    ('Propus', '前双子', 'η Gem'), ('Alhena', '后双子', 'γ Gem'),
    ('Castor', '中双子', 'α Gem'), ('Pollux', '后双子星', 'β Gem'),
    (',gaCnc', '蟹前北星', 'γ Cnc'), (',deCnc', '蟹前南星', 'δ Cnc'),
    (',kaLeo', '狮头', 'κ Leo'), ('Regulus', '王星', 'α Leo'),
    (',rhLeo', '王后小星', 'ρ Leo'), (',thLeo', '狮心', 'θ Leo'),
    ('Denebola', '狮尾', 'β Leo'), ('Zavijava', '犁沟前星', 'β Vir'),
    ('Porrima', '犁沟前亮星', 'γ Vir'), ('Spica', '犁沟', 'α Vir'),
    ('Zuben Elgenubi', '南秤', 'α Lib'), ('Zuben Eschamali', '北秤', 'β Lib'),
    ('Dschubba', '蝎头上星', 'δ Sco'), ('Acrab', '蝎头中星', 'β Sco'),
    ('Antares', '蝎胸亮星', 'α Sco'), (',thOph', '山羊鱼角', 'θ Oph'),
    ('Dabih', '山羊鱼前星', 'β Cap'), ('Nashira', '山羊鱼后星', 'γ Cap'),
    ('Deneb Algedi', '山羊鱼尾', 'δ Cap'), (',etPsc', '鱼带亮星', 'η Psc'),
)

_BABYLON_CUBIT_DEG = 2.2   # 统计最佳值(古代规范 2°–2.5°);1 cubit = 24 finger


def _babylon_star_positions(perchart):
    """30 颗距星在本盘同框架(回归/恒星随盘)下的 (lon, lat);swisseph fixstar2_ut 直算。"""
    jd = perchart.dateTime.jd
    flag = swisseph.FLG_SWIEPH
    if getattr(perchart, 'zodiacal', None) == const.SIDEREAL:
        flag |= swisseph.FLG_SIDEREAL   # 盘链路刚 set_sid_mode,同全局模式
    out = []
    for (swname, cn, modern) in _BABYLON_NORMAL_STARS:
        try:
            (xx, retnm, _rf) = swisseph.fixstar2_ut(swname, jd, flag)
            out.append({'cn': cn, 'modern': modern, 'lon': xx[0] % 360.0, 'lat': xx[1]})
        except Exception:
            continue
    return out


def compute_babylonian_stars(perchart):
    """WI-27 参照星定位(巴比伦式,定名距星表):每七政最近的「计数之星」(30 颗楔文距星)+
    黄经距(<1°标合)+ 楔文式方位读法「在某星 上/下·前/后 X cubit Y finger」(1 cubit≈2.2°=24 finger)。"""
    stars = _babylon_star_positions(perchart)
    if not stars:
        return []
    pts = {p['id']: p for p in chart_points(perchart, include_angles=False)}
    seven = [const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS, const.JUPITER, const.SATURN]
    out = []
    for pid in seven:
        if pid not in pts:
            continue
        plon = pts[pid]['lon']
        plat = safe_float(pts[pid].get('lat', 0.0))
        best, bestd = None, 999.0
        for s in stars:
            d = angle_distance(s['lon'], plon)
            if d < bestd:
                bestd, best = d, s
        if best is None:
            continue
        # 楔文读法:黄纬差 → 上/下;黄经差(带向) → 前(黄经较小侧)/后
        lat_diff = plat - best['lat']
        lon_signed = ((plon - best['lon'] + 540.0) % 360.0) - 180.0
        total_cubits = bestd / _BABYLON_CUBIT_DEG
        cubits = int(total_cubits)
        fingers = int(round((total_cubits - cubits) * 24))
        if fingers == 24:
            cubits, fingers = cubits + 1, 0
        out.append({
            'planet': pid,
            'star': best['modern'],
            'cn': best['cn'],
            'dist': round(bestd, 2),
            'conj': bool(bestd < 1.0),
            'latDir': ('上' if lat_diff >= 0 else '下'),
            'lonDir': ('后' if lon_signed >= 0 else '前'),
            'latDiff': round(abs(lat_diff), 2),
            'lonDiff': round(abs(lon_signed), 2),
            'cubits': cubits,
            'fingers': fingers,
        })
    return out


def compute_egyptian_calendar(perchart, params):
    """WI-28 埃及历法:天狼偕日升(Sothic/wepet-renpet 埃及岁首标志,出生年) + 上升十分宫(36 旬·夜时主,迦勒底面主)。
    天狼升较贵故仅在格局分析按需算(非每次排盘)。"""
    out = {}
    try:
        geopos = [
            geo_to_degree(params.get('lon', '0e00'), 'e', 'w'),
            geo_to_degree(params.get('lat', '0n00'), 'n', 's'),
            safe_float(params.get('altitude', 0.0), 0.0),
        ]
        atmo = [1013.25, 15.0, 40.0, 0.25]
        observer = [36.0, 1.0, 0.0, 0.0, 0.0, 0.0]
        flag = swisseph.FLG_SWIEPH | swisseph.HELFLAG_HIGH_PRECISION
        date = str(params.get('date', ''))
        year = int(date.split('/')[0]) if '/' in date else int(date[:4])
        jd0 = swisseph.julday(year, 1, 1, 0.0)
        tret = swisseph.heliacal_ut(jd0, geopos, atmo, observer, 'Sirius', swisseph.HELIACAL_RISING, flag)
        sj = tret[0] if isinstance(tret, (list, tuple)) else tret
        rising = date_time_from_jd(sj, params.get('zone', '+00:00'))['date']
        out['siriusRising'] = rising
        # 高纬度该年天狼或不可见,heliacal_ut 顺推至次年 → siriusYear 取实际升起年(日期前4位),勿与 siriusRising 矛盾。
        ys = str(rising)[:4]
        out['siriusYear'] = int(ys) if ys.isdigit() else year
    except Exception:
        out['siriusRising'] = None
    try:
        asc = perchart.chart.getAngle(const.ASC)
        d = int(asc.lon // 10.0) % 36
        out['decanIndex'] = d + 1
        out['decanSign'] = asc.sign
        out['decanRuler'] = essential.getInfo(asc.sign, asc.signlon).get('face')
    except Exception:
        pass
    return out


def analyze_chart(data):
    params = base_params(data)
    perchart = PerChart(params)
    points = chart_points(perchart, include_angles=True)
    try:
        temperament = Temperament(perchart.chart).getScore()
    except Exception:
        traceback.print_exc()
        temperament = None
    return {
        'patterns': detect_patterns(points),
        'distribution': distribution(points, _angle_lon(perchart, const.ASC), _angle_lon(perchart, const.MC)),
        'almutem': almuten_table(perchart),
        'temperament': temperament,
        'extraLots': extra_lots(perchart),
        'fixedStarHits': fixed_star_hits(perchart, safe_float(data.get('fixedStarOrb', 1.0), 1.0)),
        'classicalPatterns': compute_classical_patterns(perchart),
        'accidentalDignity': compute_accidental_dignity(perchart),
        'bonification': compute_bonification(perchart),
        'aspectDynamics': compute_aspect_dynamics(perchart, to_bool(data.get('voidClassical'), False)),
        'topicAlmuten': compute_topic_almuten(perchart),
        'planetaryHours': compute_planetary_hours(params),
        'egyptianCalendar': compute_egyptian_calendar(perchart, params),
        'babylonianStars': compute_babylonian_stars(perchart),
    }


def refine_crossing(func, a, b, iterations=24):
    fa = func(a)
    fb = func(b)
    if fa == 0:
        return a
    if fb == 0:
        return b
    for _ in range(iterations):
        mid = (a + b) / 2.0
        fm = func(mid)
        if (fa <= 0 <= fm) or (fa >= 0 >= fm):
            b = mid
            fb = fm
        else:
            a = mid
            fa = fm
    return (a + b) / 2.0


def calc_ingresses(start_jd, end_jd, zone, planets):
    events = []
    for body in planets:
        if body not in PLANET_SWISS_IDS:
            continue
        step = 0.25 if body == const.MOON else 1.0
        jd = start_jd
        prev_lon, _, _ = swe_lon(body, jd)
        prev_sign = sign_index(prev_lon)
        while jd < end_jd:
            nxt = min(jd + step, end_jd)
            lon, speed, _ = swe_lon(body, nxt)
            cur_sign = sign_index(lon)
            if cur_sign != prev_sign:
                def f(x):
                    l, _, _ = swe_lon(body, x)
                    return norm180(l - cur_sign * 30.0)
                hit_jd = refine_crossing(f, jd, nxt)
                hit_lon, hit_speed, _ = swe_lon(body, hit_jd)
                # 入座符号取「已知的进入星座」cur_sign,而非由 hit_lon 反推:
                # 求根可能收敛到边界下侧(如 29.9999°),sign_name_from_lon 会误判成「离开的星座」。
                # cur_sign = nxt 时刻所在星座 = 实际进入星座(顺逆行皆然),不受浮点边界抖动影响。
                events.append({
                    **date_time_from_jd(hit_jd, zone),
                    'type': 'ingress',
                    'body': body,
                    'toSign': const.LIST_SIGNS[cur_sign],
                    'lon': hit_lon,
                    'speed': hit_speed,
                })
                prev_sign = cur_sign
            jd = nxt
    return sorted(events, key=lambda item: item['jd'])


def calc_stations(start_jd, end_jd, zone, planets):
    events = []
    for body in planets:
        if body not in PLANET_SWISS_IDS or body in (const.SUN, const.MOON):
            continue
        jd = start_jd
        _, prev_speed, _ = swe_lon(body, jd)
        while jd < end_jd:
            nxt = min(jd + 1.0, end_jd)
            lon, speed, _ = swe_lon(body, nxt)
            if (prev_speed <= 0 <= speed) or (prev_speed >= 0 >= speed):
                def f(x):
                    _, s, _ = swe_lon(body, x)
                    return s
                hit_jd = refine_crossing(f, jd, nxt)
                hit_lon, hit_speed, _ = swe_lon(body, hit_jd)
                events.append({
                    **date_time_from_jd(hit_jd, zone),
                    'type': 'station',
                    'body': body,
                    'direction': 'Direct' if hit_speed >= 0 else 'Retrograde',
                    'lon': hit_lon,
                    'speed': hit_speed,
                    'sign': sign_name_from_lon(hit_lon),
                    'signlon': hit_lon % 30,
                })
            prev_speed = speed
            jd = nxt
    return sorted(events, key=lambda item: item['jd'])


def moon_sun_elongation(jd):
    moon, _, _ = swe_lon(const.MOON, jd)
    sun, _, _ = swe_lon(const.SUN, jd)
    return norm360(moon - sun)


def calc_lunar_phases(start_jd, end_jd, zone):
    targets = [
        (0, 'New Moon'), (90, 'First Quarter'),
        (180, 'Full Moon'), (270, 'Last Quarter')
    ]
    events = []
    for target, label in targets:
        jd = start_jd
        prev = norm180(moon_sun_elongation(jd) - target)
        while jd < end_jd:
            nxt = min(jd + 0.5, end_jd)
            cur = norm180(moon_sun_elongation(nxt) - target)
            # ⚠️ 必须排除 norm180 在 ±180 处的回绕跳变(真交叉 step 仅~6°/12h、回绕 step≈360°)。
            # 否则 target=0(新月)会在 elong=180(对分)处 f 从 +179 跳到 −179 被误判成过零 →
            # 每个朔望时刻同时被标 New Moon + Full Moon,前端新月/满月列表全被串成对方。
            if ((prev <= 0 <= cur) or (prev >= 0 >= cur)) and abs(cur - prev) < 180:
                def f(x):
                    return norm180(moon_sun_elongation(x) - target)
                hit_jd = refine_crossing(f, jd, nxt)
                moon_lon, _, _ = swe_lon(const.MOON, hit_jd)
                sun_lon, _, _ = swe_lon(const.SUN, hit_jd)
                events.append({
                    **date_time_from_jd(hit_jd, zone),
                    'type': 'lunar_phase',
                    'phase': label,
                    'moonLon': moon_lon,
                    'sunLon': sun_lon,
                    'sign': sign_name_from_lon(moon_lon),
                    'signlon': moon_lon % 30,
                })
            prev = cur
            jd = nxt
    return sorted(events, key=lambda item: item['jd'])


def eclipse_type(retflag, lunar=False):
    types = []
    if retflag & swisseph.ECL_TOTAL:
        types.append('total')
    if retflag & swisseph.ECL_ANNULAR:
        types.append('annular')
    if retflag & getattr(swisseph, 'ECL_ANNULAR_TOTAL', 0):
        types.append('hybrid')
    if retflag & swisseph.ECL_PARTIAL:
        types.append('partial')
    if lunar and retflag & swisseph.ECL_PENUMBRAL:
        types.append('penumbral')
    return '/'.join(types) if types else 'eclipse'


def _eclipse_band(digit):
    # WI-23 食分分档:1–2 小 / 3–6 中 / 7–11 大 / ≥12 全(月食 umbral 可 >12 仍为全食)。
    if digit is None:
        return None
    if digit < 3.0:
        return '小'
    if digit < 7.0:
        return '中'
    if digit < 12.0:
        return '大'
    return '全'


def _calc_eclipses_inner(start_jd, end_jd, zone):
    events = []
    jd = start_jd - 1
    while True:
        ret, tret = swisseph.sol_eclipse_when_glob(jd, swisseph.FLG_SWIEPH, 0, False)
        e_jd = tret[0]
        if e_jd > end_jd:
            break
        if e_jd >= start_jd:
            sun_lon, _, _ = swe_lon(const.SUN, e_jd)
            try:
                _r, _geo, sattr = swisseph.sol_eclipse_where(e_jd, swisseph.FLG_SWIEPH)
                mag = float(sattr[0])
            except Exception:
                mag = None
            digit = round(mag * 12.0, 1) if mag is not None else None
            events.append({
                **date_time_from_jd(e_jd, zone),
                'type': 'solar_eclipse',
                'eclipseType': eclipse_type(ret),
                'body': const.SUN,
                'lon': sun_lon,
                'sign': sign_name_from_lon(sun_lon),
                'signlon': sun_lon % 30,
                'magnitude': mag,
                'digit': digit,
                'band': _eclipse_band(digit),
            })
        jd = e_jd + 1
    jd = start_jd - 1
    while True:
        ret, tret = swisseph.lun_eclipse_when(jd, swisseph.FLG_SWIEPH, 0, False)
        e_jd = tret[0]
        if e_jd > end_jd:
            break
        if e_jd >= start_jd:
            moon_lon, _, _ = swe_lon(const.MOON, e_jd)
            try:
                _r, lattr = swisseph.lun_eclipse_how(e_jd, [0.0, 0.0, 0.0], swisseph.FLG_SWIEPH)
                mag = float(lattr[0])   # 本影食分(>1 即全食)
            except Exception:
                mag = None
            digit = round(mag * 12.0, 1) if mag is not None else None
            events.append({
                **date_time_from_jd(e_jd, zone),
                'type': 'lunar_eclipse',
                'eclipseType': eclipse_type(ret, lunar=True),
                'body': const.MOON,
                'lon': moon_lon,
                'sign': sign_name_from_lon(moon_lon),
                'signlon': moon_lon % 30,
                'magnitude': mag,
                'digit': digit,
                'band': _eclipse_band(digit),
            })
        jd = e_jd + 1
    return sorted(events, key=lambda item: item['jd'])


def calc_eclipses(start_jd, end_jd, zone):
    """食相搜索:窗口贴近星历域上界时,前向搜索会越出数据尽头(如 16799 年末搜下一次
    月食需 16800 段)——此时返回已搜到的部分(域内事件不受影响),不拖垮整个星历页。"""
    try:
        return _calc_eclipses_inner(start_jd, end_jd, zone)
    except Exception:
        return []


def calc_daily_positions(start_jd, end_jd, zone, planets, max_days=370):
    rows = []
    days = int(math.floor(end_jd - start_jd)) + 1
    if days > max_days:
        days = max_days
    for idx in range(days):
        jd = start_jd + idx
        row = date_time_from_jd(jd, zone)
        row['positions'] = {}
        for body in planets:
            if body not in PLANET_SWISS_IDS:
                continue
            lon, speed, xx = swe_lon(body, jd)
            row['positions'][body] = {
                'lon': lon,
                'sign': sign_name_from_lon(lon),
                'signlon': lon % 30,
                'speed': speed,
                'retrograde': speed < 0,
                'lat': xx[1],
                'distance': xx[2],
            }
        rows.append(row)
    return rows


def calc_transit_aspects(base, start_jd, end_jd, zone, planets, natal_points, aspects, max_hits=600):
    try:
        perchart = PerChart(base)
    except Exception:
        return []
    natal = {p['id']: p for p in chart_points(perchart, include_angles=True) if p['id'] in natal_points}
    events = []
    for t_body in planets:
        if t_body not in PLANET_SWISS_IDS:
            continue
        for n_id, n_point in natal.items():
            for aspect in aspects:
                target = float(aspect)
                jd = start_jd
                lon, _, _ = swe_lon(t_body, jd)
                prev = signed_aspect_delta(lon, n_point['lon'], target)
                while jd < end_jd and len(events) < max_hits:
                    nxt = min(jd + (0.25 if t_body == const.MOON else 1.0), end_jd)
                    cur_lon, _, _ = swe_lon(t_body, nxt)
                    cur = signed_aspect_delta(cur_lon, n_point['lon'], target)
                    if (prev <= 0 <= cur) or (prev >= 0 >= cur):
                        def f(x):
                            l, _, _ = swe_lon(t_body, x)
                            return signed_aspect_delta(l, n_point['lon'], target)
                        hit_jd = refine_crossing(f, jd, nxt)
                        hit_lon, hit_speed, _ = swe_lon(t_body, hit_jd)
                        events.append({
                            **date_time_from_jd(hit_jd, zone),
                            'type': 'transit_aspect',
                            'transitBody': t_body,
                            'natalPoint': n_id,
                            'aspect': target,
                            'orb': abs(signed_aspect_delta(hit_lon, n_point['lon'], target)),
                            'lon': hit_lon,
                            'speed': hit_speed,
                            'sign': sign_name_from_lon(hit_lon),
                            'signlon': hit_lon % 30,
                        })
                    prev = cur
                    jd = nxt
    return sorted(events, key=lambda item: item['jd'])


def calc_rise_set(start_jd, data, planets):
    geopos = [
        geo_to_degree(data.get('lon', '0e00'), 'e', 'w'),
        geo_to_degree(data.get('lat', '0n00'), 'n', 's'),
        safe_float(data.get('altitude', 0.0), 0.0),
    ]
    rows = []
    zero = math.floor(start_jd - 0.5) + 0.5
    for body in planets:
        if body not in PLANET_SWISS_IDS:
            continue
        item = {'body': body}
        for key, flag in (
            ('rise', swisseph.CALC_RISE),
            ('set', swisseph.CALC_SET),
            ('upperTransit', swisseph.CALC_MTRANSIT),
            ('lowerTransit', swisseph.CALC_ITRANSIT),
        ):
            try:
                ret, tret = swisseph.rise_trans(zero, PLANET_SWISS_IDS[body], flag, geopos, 0.0, 0.0, swisseph.FLG_SWIEPH)
                item[key] = date_time_from_jd(tret[0], data.get('zone', '+00:00'))
                item[key]['retflag'] = ret
            except Exception as exc:
                item[key] = {'err': str(exc)}
        rows.append(item)
    return rows


def calc_phenomena(start_jd, planets):
    rows = []
    for body in planets:
        if body not in PLANET_SWISS_IDS:
            continue
        try:
            attr = swisseph.pheno_ut(start_jd, PLANET_SWISS_IDS[body], swisseph.FLG_SWIEPH)
            rows.append({
                'body': body,
                'phaseAngle': attr[0],
                'phase': attr[1],
                'elongation': attr[2],
                'apparentDiameter': attr[3],
                'magnitude': attr[4],
            })
        except Exception as exc:
            rows.append({'body': body, 'err': str(exc)})
    return rows


def calc_heliacal(start_jd, data, planets):
    geopos = [
        geo_to_degree(data.get('lon', '0e00'), 'e', 'w'),
        geo_to_degree(data.get('lat', '0n00'), 'n', 's'),
        safe_float(data.get('altitude', 0.0), 0.0),
    ]
    atmo = [1013.25, 15.0, 40.0, 0.25]
    observer = [36.0, 1.0, 0.0, 0.0, 0.0, 0.0]
    rows = []
    for body in planets:
        if body not in (const.MERCURY, const.VENUS, const.MARS, const.JUPITER, const.SATURN):
            continue
        item = {'body': body}
        for key, event in (('rising', swisseph.HELIACAL_RISING), ('setting', swisseph.HELIACAL_SETTING)):
            try:
                tret = swisseph.heliacal_ut(start_jd, geopos, atmo, observer, body, event, swisseph.FLG_SWIEPH | swisseph.HELFLAG_HIGH_PRECISION)
                jd = tret[0] if isinstance(tret, (list, tuple)) else tret
                item[key] = date_time_from_jd(jd, data.get('zone', '+00:00'))
            except Exception as exc:
                item[key] = {'err': str(exc)}
        rows.append(item)
    return rows


def build_ephemeris(data):
    params = base_params(data)
    start_date = data.get('startDate') or data.get('date')
    end_date = data.get('endDate') or start_date
    start_time = data.get('startTime', '00:00:00')
    end_time = data.get('endTime', '23:59:59')
    start_dt = Datetime(start_date, start_time, params.get('zone', '+00:00'))
    end_dt = Datetime(end_date, end_time, params.get('zone', '+00:00'))
    start_jd = start_dt.jd
    end_jd = max(end_dt.jd, start_jd + 1)
    if end_jd - start_jd > 732:
        end_jd = start_jd + 732
    planets = data.get('planets') or DEFAULT_EVENT_PLANETS
    natal_points = data.get('natalPoints') or DEFAULT_NATAL_POINTS
    aspects = data.get('aspects') or [0, 60, 90, 120, 180]
    include_transits = to_bool(data.get('includeTransits'), True)
    return {
        'params': {
            'startDate': date_time_from_jd(start_jd, params.get('zone', '+00:00')),
            'endDate': date_time_from_jd(end_jd, params.get('zone', '+00:00')),
            'planets': planets,
            'natalPoints': natal_points,
            'aspects': aspects,
        },
        'dailyPositions': calc_daily_positions(start_jd, end_jd, params.get('zone', '+00:00'), planets),
        'ingresses': calc_ingresses(start_jd, end_jd, params.get('zone', '+00:00'), planets),
        'stations': calc_stations(start_jd, end_jd, params.get('zone', '+00:00'), planets),
        'lunarPhases': calc_lunar_phases(start_jd, end_jd, params.get('zone', '+00:00')),
        'eclipses': calc_eclipses(start_jd, end_jd, params.get('zone', '+00:00')),
        'transitAspects': calc_transit_aspects(params, start_jd, end_jd, params.get('zone', '+00:00'), planets, natal_points, aspects) if include_transits else [],
        'riseSet': calc_rise_set(start_jd, params, planets),
        'phenomena': calc_phenomena(start_jd, planets),
        'heliacal': calc_heliacal(start_jd, params, planets),
    }


def progression_date(base_dt, target_dt, method, minor_variant='engine'):
    # 次要推运(minor)月长算法由前端「月长算法」选择(minorVariant)驱动:
    #   synodic  = 一个朔望月(29.530589d)对应一年(权威标准:Astrodienst/Wikipedia「a lunar month for a year」);
    #   sidereal = 一个月亮回归(恒星月 27.321661d)对应一年;
    #   engine   = 保留引擎历史取值(疑似漏乘一次 /365.2425),作默认以保证既有调用零字节差(铁律1)。
    age_days = target_dt.jd - base_dt.jd
    if method == 'secondary':
        delta_days = age_days / 365.2425
    elif method == 'tertiary':
        delta_days = age_days / 27.321661
    elif method == 'minor':
        if minor_variant == 'synodic':
            delta_days = age_days * 29.530589 / 365.2425
        elif minor_variant == 'sidereal':
            delta_days = age_days * 27.321661 / 365.2425
        else:  # 'engine' 历史现状(默认,零回归)
            delta_days = age_days / 12.3685 / 365.2425
    else:
        delta_days = age_days / 365.2425
    return base_dt.jd + delta_days


def aspects_between(points_a, points_b, asp_list=None, orb=1.5):
    asp_list = asp_list or [0, 60, 90, 120, 180]
    rows = []
    for pa in points_a:
        if pa['id'] not in DEFAULT_EVENT_PLANETS and pa['id'] not in (const.ASC, const.MC):
            continue
        for pb in points_b:
            if pb['id'] not in DEFAULT_EVENT_PLANETS and pb['id'] not in (const.ASC, const.MC):
                continue
            for asp in asp_list:
                delta = abs(angle_distance(pa['lon'], pb['lon']) - float(asp))
                if delta <= orb:
                    rows.append({'a': pa['id'], 'b': pb['id'], 'aspect': asp, 'orb': delta})
    return sorted(rows, key=lambda item: item['orb'])


def build_progressions(data):
    params = base_params(data)
    target_date = data.get('targetDate') or data.get('datetime') or data.get('date')
    target_time = data.get('targetTime') or '12:00:00'
    if ' ' in target_date:
        date_part, time_part = target_date.split(' ', 1)
        target_date = date_part
        target_time = time_part
    natal_dt = dt_from_data(params)
    target_dt = Datetime(target_date, target_time, params.get('zone', '+00:00'))
    natal_chart = PerChart(params)
    natal_points = chart_points(natal_chart, include_angles=True)
    minor_variant = data.get('minorVariant') or 'engine'
    methods = []
    for method, label in (
        ('secondary', 'Secondary Progression'),
        ('tertiary', 'Tertiary Progression'),
        ('minor', 'Minor Progression'),
    ):
        jd = progression_date(natal_dt, target_dt, method, minor_variant)
        p_params = chart_params_from_jd(params, jd)
        p_chart = PerChart(p_params)
        p_points = chart_points(p_chart, include_angles=True)
        methods.append({
            'method': method,
            'label': label,
            'progressedDate': date_time_from_jd(jd, params.get('zone', '+00:00')),
            'positions': p_points,
            'aspectsToNatal': aspects_between(p_points, natal_points, data.get('aspects') or [0, 60, 90, 120, 180], safe_float(data.get('orb', 1.5), 1.5)),
        })
    return {
        'target': date_time_from_jd(target_dt.jd, params.get('zone', '+00:00')),
        'ageDays': target_dt.jd - natal_dt.jd,
        'methods': methods,
    }


# Charles Jayne 赤纬推运（Progressions in Declination）：推运后看赤纬平行/反平行。
DECLINATION_BODIES = [
    const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS,
    const.JUPITER, const.SATURN, const.URANUS, const.NEPTUNE, const.PLUTO,
]


def swe_decl(body, jd):
    xx, _ = swisseph.calc_ut(jd, PLANET_SWISS_IDS[body], swisseph.FLG_SWIEPH | swisseph.FLG_EQUATORIAL)
    return xx[1]


def _decls_at(jd):
    decls = []
    for b in DECLINATION_BODIES:
        try:
            decls.append({'id': b, 'decl': round(swe_decl(b, jd), 4)})
        except Exception:
            pass
    return decls


def decl_parallels(p_decls, n_decls, orb=1.0):
    rows = []
    for pa in p_decls:
        for nb in n_decls:
            d = abs(pa['decl'] - nb['decl'])
            if d <= orb:
                rows.append({'a': pa['id'], 'b': nb['id'], 'type': 'parallel', 'orb': round(d, 3)})
            dc = abs(pa['decl'] + nb['decl'])
            if dc <= orb:
                rows.append({'a': pa['id'], 'b': nb['id'], 'type': 'contraparallel', 'orb': round(dc, 3)})
    return sorted(rows, key=lambda item: item['orb'])


def build_declination_progressions(data):
    params = base_params(data)
    target_date = data.get('targetDate') or data.get('datetime') or data.get('date')
    target_time = data.get('targetTime') or '12:00:00'
    if ' ' in target_date:
        date_part, time_part = target_date.split(' ', 1)
        target_date = date_part
        target_time = time_part
    natal_dt = dt_from_data(params)
    target_dt = Datetime(target_date, target_time, params.get('zone', '+00:00'))
    natal_decls = _decls_at(natal_dt.jd)
    orb = safe_float(data.get('orb', 1.0), 1.0)
    minor_variant = data.get('minorVariant') or 'engine'
    methods = []
    for method, label in (
        ('secondary', 'Secondary Progression'),
        ('tertiary', 'Tertiary Progression'),
        ('minor', 'Minor Progression'),
    ):
        jd = progression_date(natal_dt, target_dt, method, minor_variant)
        p_decls = _decls_at(jd)
        methods.append({
            'method': method,
            'label': label,
            'progressedDate': date_time_from_jd(jd, params.get('zone', '+00:00')),
            'declinations': p_decls,
            'parallels': decl_parallels(p_decls, natal_decls, orb),
        })
    return {
        'target': date_time_from_jd(target_dt.jd, params.get('zone', '+00:00')),
        'ageDays': target_dt.jd - natal_dt.jd,
        'natalDeclinations': natal_decls,
        'methods': methods,
    }


def build_return_timeline(data):
    params = base_params(data)
    count = max(1, min(int(data.get('count', 10)), 40))
    start_year = int(data.get('startYear') or str(data.get('date', '2000/01/01')).replace('-', '/').split('/')[0])
    perchart = PerChart(params)
    sun = perchart.chart.getObject(const.SUN)
    moon = perchart.chart.getObject(const.MOON)
    rows = []
    for year in range(start_year, start_year + count):
        solar_seed = Datetime('{0}/01/01'.format(year), params.get('time', '12:00:00'), params.get('zone', '+00:00'))
        solar_dt = dateSolarReturn(solar_seed, sun.lon, perchart.zodiacal)
        lunar_seed = Datetime('{0}/01/01'.format(year), params.get('time', '12:00:00'), params.get('zone', '+00:00'))
        lunar_dt = dateLunarReturn(lunar_seed, moon.lon, perchart.zodiacal)
        solar_params = chart_params_from_jd(params, solar_dt.jd)
        lunar_params = chart_params_from_jd(params, lunar_dt.jd)
        try:
            solar_perchart = PerChart(solar_params)
            solar_asc = object_to_dict(solar_perchart.chart.getAngle(const.ASC))
        except Exception:
            solar_asc = None
        try:
            lunar_perchart = PerChart(lunar_params)
            lunar_asc = object_to_dict(lunar_perchart.chart.getAngle(const.ASC))
        except Exception:
            lunar_asc = None
        rows.append({
            'year': year,
            'solarReturn': date_time_from_jd(solar_dt.jd, params.get('zone', '+00:00')),
            'lunarReturn': date_time_from_jd(lunar_dt.jd, params.get('zone', '+00:00')),
            'solarAsc': solar_asc,
            'lunarAsc': lunar_asc,
        })
    return {'rows': rows}


def build_harmonic(data):
    params = base_params(data)
    harmonic = max(1, min(int(data.get('harmonic', 9)), 360))
    # 界系(termsVariant)请求级临界区:push 取锁+换 essential.TERMS,finally 必还原+释放锁。默认埃及=零回归。
    _terms_orig = None
    try:
        _terms_orig = push_request_terms(data.get('termsVariant', 0))
        perchart = PerChart(params)
        positions = []
        for p in chart_points(perchart, include_angles=True):
            if p['id'] not in DEFAULT_EVENT_PLANETS and p['id'] not in (const.ASC, const.MC, const.PARS_FORTUNA):
                continue
            lon = norm360(p['lon'] * harmonic)
            positions.append({
                'id': p['id'],
                'natalLon': p['lon'],
                'lon': lon,
                'sign': sign_name_from_lon(lon),
                'signlon': lon % 30,
                'harmonic': harmonic,
            })
        aspects = aspects_between(positions, positions, [0], safe_float(data.get('orb', 2.0), 2.0))
        aspects = [a for a in aspects if a['a'] != a['b']]

        # 调波盘本身：把命盘各点黄经乘以调波数，得到完整盘对象（与 /chart 同形），
        # 供前端复用量化盘的 AstroChart 直接绘制。纯 Python，无需重编 jar。
        chart_obj = None
        try:
            HarmonicChart(perchart, harmonic).apply()
            chart_obj = {
                'params': {
                    'birth': perchart.getBirthStr(),
                    'ad': -1 if getattr(perchart, 'isBC', False) else 1,
                    'lat': params.get('lat'),
                    'lon': params.get('lon'),
                    'hsys': params.get('hsys'),
                    'zone': params.get('zone'),
                    'tradition': perchart.tradition,
                    'zodiacal': perchart.zodiacal,
                    'termsVariant': parse_terms_variant(data.get('termsVariant', 0)),
                    'harmonic': harmonic,
                },
                'chart': perchart.getChartObj(),
                'aspects': {
                    'normalAsp': perchart.getAspects(),
                    'immediateAsp': perchart.getImmediateAspects(),
                    'signAsp': perchart.getSignAspects(),
                },
                'lots': perchart.getPars(perchart.chart),
                'receptions': perchart.getReceptions(),
                'mutuals': perchart.getMutuals(),
                'declParallel': perchart.getParallel(),
            }
        except Exception:
            traceback.print_exc()
            chart_obj = None

        return {'harmonic': harmonic, 'positions': positions, 'conjunctions': aspects[:120], 'chart': chart_obj}
    finally:
        pop_request_terms(_terms_orig)


def build_relocation(data):
    """重置盘(异地 relocation):保留出生 UT(date/time/zone 不变),仅用新经纬重算十二宫 + 上升/中天。
    行星黄经由 UT 决定 → 不变;宫位/角点随地点变。复用 PerChart 宫位计算管线,不另写星历调用。
    返回 {chart, relocLat, relocLon}(chart 与 /chart 同形,供前端 AstroChart 直接绘制)。"""
    base = base_params(data)
    natal_lat = base.get('lat')
    natal_lon = base.get('lon')
    reloc_lat = data.get('relocLat') or data.get('reloc_lat') or natal_lat
    reloc_lon = data.get('relocLon') or data.get('reloc_lon') or natal_lon

    params = dict(base)
    params['lat'] = reloc_lat
    params['lon'] = reloc_lon
    params['tradition'] = False
    params['predictive'] = False

    # 界系(termsVariant)请求级临界区:push 取锁+换 essential.TERMS,finally 必还原+释放锁。默认埃及=零回归。
    _terms_orig = push_request_terms(data.get('termsVariant', 0))
    chart_obj = None
    try:
        perchart = PerChart(params)
        chart_obj = {
            'params': {
                'birth': perchart.getBirthStr(),
                'ad': -1 if getattr(perchart, 'isBC', False) else 1,
                'lat': reloc_lat,
                'lon': reloc_lon,
                'hsys': params.get('hsys'),
                'zone': params.get('zone'),
                'tradition': perchart.tradition,
                'zodiacal': perchart.zodiacal,
                'termsVariant': parse_terms_variant(data.get('termsVariant', 0)),
                'relocation': True,
                'natalLat': natal_lat,
                'natalLon': natal_lon,
            },
            'chart': perchart.getChartObj(),
            'aspects': {
                'normalAsp': perchart.getAspects(),
                'immediateAsp': perchart.getImmediateAspects(),
                'signAsp': perchart.getSignAspects(),
            },
            'lots': perchart.getPars(perchart.chart),
            'receptions': perchart.getReceptions(),
            'mutuals': perchart.getMutuals(),
            'declParallel': perchart.getParallel(),
        }
    except Exception:
        traceback.print_exc()
        chart_obj = None
    finally:
        pop_request_terms(_terms_orig)

    return {'chart': chart_obj, 'relocLat': reloc_lat, 'relocLon': reloc_lon, 'natalLat': natal_lat, 'natalLon': natal_lon}


def compute_great_conjunctions(data):
    """ 木土大合相精算：扫描 [startYear, endYear] 区间内木星-土星黄经合相（含三重合相分列）。 """
    try:
        start_year = int(data.get('startYear', 1900))
    except Exception:
        start_year = 1900
    try:
        end_year = int(data.get('endYear', 2100))
    except Exception:
        end_year = 2100
    if end_year < start_year:
        start_year, end_year = end_year, start_year
    if end_year - start_year > 3400:
        end_year = start_year + 3400

    def _lon(jd_, planet):
        return swisseph.calc_ut(jd_, planet)[0][0]

    def _signed_diff(jd_):
        d = _lon(jd_, swisseph.JUPITER) - _lon(jd_, swisseph.SATURN)
        return ((d + 180.0) % 360.0) - 180.0

    jd = swisseph.julday(start_year, 1, 1, 0.0)
    end_jd = swisseph.julday(end_year, 12, 31, 0.0)
    step = 8.0
    prev_jd = jd
    prev_d = _signed_diff(jd)
    results = []
    cur = jd + step
    while cur <= end_jd:
        d = _signed_diff(cur)
        # 合相 = 带符号黄经差过零（排除冲相 ±180 的环绕跳变）
        if (prev_d < 0) != (d < 0) and abs(prev_d - d) < 180.0:
            lo, hi, dlo = prev_jd, cur, prev_d
            for _ in range(50):
                mid = (lo + hi) / 2.0
                dm = _signed_diff(mid)
                if (dm < 0) == (dlo < 0):
                    lo, dlo = mid, dm
                else:
                    hi = mid
            cjd = (lo + hi) / 2.0
            jl = _lon(cjd, swisseph.JUPITER) % 360.0
            y, m, dd, hh = swisseph.revjul(cjd)
            results.append({
                'jd': round(cjd, 4),
                'year': int(y), 'month': int(m), 'day': int(dd), 'hour': round(hh, 4),
                'lon': round(jl, 2),
                'sign': int(jl / 30.0) % 12,
            })
        prev_jd, prev_d = cur, d
        cur += step
    return {'conjunctions': results, 'startYear': start_year, 'endYear': end_year}


_SWE_PLANET_BY_NAME = {
    'Sun': swisseph.SUN, 'Moon': swisseph.MOON, 'Mercury': swisseph.MERCURY,
    'Venus': swisseph.VENUS, 'Mars': swisseph.MARS, 'Jupiter': swisseph.JUPITER,
    'Saturn': swisseph.SATURN, 'Uranus': swisseph.URANUS, 'Neptune': swisseph.NEPTUNE,
    'Pluto': swisseph.PLUTO, 'Node': swisseph.TRUE_NODE,
}

# 各体平均回归周期（天），仅用于步进定位返照点。
_MEAN_PERIOD_DAYS = {
    swisseph.SUN: 365.2422, swisseph.MOON: 27.3217, swisseph.MERCURY: 87.969,
    swisseph.VENUS: 224.701, swisseph.MARS: 686.980, swisseph.JUPITER: 4332.59,
    swisseph.SATURN: 10759.22, swisseph.URANUS: 30688.5, swisseph.NEPTUNE: 60182.0,
    swisseph.PLUTO: 90560.0, swisseph.TRUE_NODE: 6793.48,
}


def compute_planet_cycles(data):
    """ 任意两慢星的合/冲时间轴（A4b 外行星周期）：泛化 compute_great_conjunctions。
        params: startYear,endYear,p1,p2(星名),aspect(0 合 / 180 冲)。 """
    try:
        start_year = int(data.get('startYear', 1900))
    except Exception:
        start_year = 1900
    try:
        end_year = int(data.get('endYear', 2100))
    except Exception:
        end_year = 2100
    if end_year < start_year:
        start_year, end_year = end_year, start_year
    if end_year - start_year > 3400:
        end_year = start_year + 3400
    p1 = _SWE_PLANET_BY_NAME.get(str(data.get('p1', 'Jupiter')), swisseph.JUPITER)
    p2 = _SWE_PLANET_BY_NAME.get(str(data.get('p2', 'Saturn')), swisseph.SATURN)
    try:
        aspect = float(data.get('aspect', 0))
    except Exception:
        aspect = 0.0
    # 中心透传:地心走原调用(golden 字节级不变);日心/站心加 center 旗标(全局周期,topo 无经纬≈geo)。
    center = str(data.get('center', 'geo') or 'geo').lower()
    _extra_flag = center_flag(center) if center in ('helio', 'topo') else 0

    def _lon(jd_, planet):
        if _extra_flag:
            return swisseph.calc_ut(jd_, planet, swisseph.FLG_SWIEPH | _extra_flag)[0][0]
        return swisseph.calc_ut(jd_, planet)[0][0]

    def _signed_diff(jd_):
        d = _lon(jd_, p1) - _lon(jd_, p2) - aspect
        return ((d + 180.0) % 360.0) - 180.0

    jd = swisseph.julday(start_year, 1, 1, 0.0)
    end_jd = swisseph.julday(end_year, 12, 31, 0.0)
    step = 6.0
    prev_jd = jd
    prev_d = _signed_diff(jd)
    results = []
    cur = jd + step
    while cur <= end_jd:
        d = _signed_diff(cur)
        if (prev_d < 0) != (d < 0) and abs(prev_d - d) < 180.0:
            lo, hi, dlo = prev_jd, cur, prev_d
            for _ in range(50):
                mid = (lo + hi) / 2.0
                dm = _signed_diff(mid)
                if (dm < 0) == (dlo < 0):
                    lo, dlo = mid, dm
                else:
                    hi = mid
            cjd = (lo + hi) / 2.0
            jl = _lon(cjd, p1) % 360.0
            y, m, dd, hh = swisseph.revjul(cjd)
            results.append({
                'jd': round(cjd, 4),
                'year': int(y), 'month': int(m), 'day': int(dd), 'hour': round(hh, 4),
                'lon': round(jl, 2), 'sign': int(jl / 30.0) % 12,
            })
        prev_jd, prev_d = cur, d
        cur += step
    return {
        'events': results,
        'startYear': start_year, 'endYear': end_year,
        'p1': str(data.get('p1', 'Jupiter')), 'p2': str(data.get('p2', 'Saturn')),
        'aspect': aspect, 'center': center,
    }


def compute_barbault(data):
    """ Barbault 行星周期指数(§9.3 Indice Cyclique):取慢星两两角距和成「行星聚散」曲线。
        默认 5 慢星 ♃♄♅♆♇ → C(5,2)=10 对;每对 d=min(|λi−λj|,360−) ∈[0,180];Index=Σ ∈[0,1800]。
        低(→0,聚集)=危机/战争(史上 1914、1939-40 极小与两次大战吻合);高(→1800,四散)=扩张繁荣。
        params: startYear,endYear,stepMonths(默认1),planets(名表,可配「仅外三星」等变体),center。 """
    try:
        start_year = int(data.get('startYear', 1900))
    except Exception:
        start_year = 1900
    try:
        end_year = int(data.get('endYear', 2050))
    except Exception:
        end_year = 2050
    if end_year < start_year:
        start_year, end_year = end_year, start_year
    if end_year - start_year > 300:          # 上限 300 年(逐月 ~3600 点),防超大请求
        end_year = start_year + 300
    try:
        step_months = int(data.get('stepMonths', 1))
    except Exception:
        step_months = 1
    if step_months < 1:
        step_months = 1
    if step_months > 12:
        step_months = 12
    DEFAULT = ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']
    names = data.get('planets')
    ids = []
    if isinstance(names, list):
        for n in names:
            pid = _SWE_PLANET_BY_NAME.get(str(n))
            if pid is not None:
                ids.append((str(n), pid))
    if len(ids) < 2:
        ids = [(n, _SWE_PLANET_BY_NAME[n]) for n in DEFAULT]
    center = str(data.get('center', 'geo') or 'geo').lower()
    extra_flag = center_flag(center) if center in ('helio', 'topo') else 0

    def _lon(jd_, planet):
        if extra_flag:
            return swisseph.calc_ut(jd_, planet, swisseph.FLG_SWIEPH | extra_flag)[0][0]
        return swisseph.calc_ut(jd_, planet)[0][0]

    n_pairs = len(ids) * (len(ids) - 1) // 2
    max_index = round(180.0 * n_pairs, 2)
    points = []
    y, m = start_year, 1
    while y < end_year or (y == end_year and m <= 12):
        jd = swisseph.julday(y, m, 1, 0.0)
        lons = [_lon(jd, pid) % 360.0 for _, pid in ids]
        total = 0.0
        for i in range(len(lons)):
            for j in range(i + 1, len(lons)):
                d = abs(lons[i] - lons[j]) % 360.0
                if d > 180.0:
                    d = 360.0 - d
                total += d
        points.append({'year': y, 'month': m, 'index': round(total, 2)})
        m += step_months
        while m > 12:
            m -= 12
            y += 1
    # 局部极小/极大(拐点候选)
    extrema = []
    for k in range(1, len(points) - 1):
        a, b, c2 = points[k - 1]['index'], points[k]['index'], points[k + 1]['index']
        if b < a and b <= c2:
            extrema.append({'year': points[k]['year'], 'month': points[k]['month'], 'index': b, 'kind': 'min'})
        elif b > a and b >= c2:
            extrema.append({'year': points[k]['year'], 'month': points[k]['month'], 'index': b, 'kind': 'max'})
    return {
        'points': points,
        'extrema': extrema,
        'maxIndex': max_index,
        'planets': [n for n, _ in ids],
        'startYear': start_year, 'endYear': end_year, 'stepMonths': step_months, 'center': center,
    }


def compute_planet_return(data):
    """ 多重回归（C5）：行星返照到本命黄经的时刻列表。
        params: date/time/zone/lat/lon(本命) + body(星名) + count(几次)。 """
    date = data.get('date')
    time = data.get('time', '12:00:00')
    zone = data.get('zone', '+00:00')
    body = _SWE_PLANET_BY_NAME.get(str(data.get('body', 'Saturn')), swisseph.SATURN)
    try:
        count = int(data.get('count', 3))
    except Exception:
        count = 3
    count = max(1, min(12, count))
    natal_dt = Datetime(date, time, zone)
    natal_jd = natal_dt.jd
    natal_lon = swisseph.calc_ut(natal_jd, body)[0][0] % 360.0
    mean_days = _MEAN_PERIOD_DAYS.get(body, 4332.59)

    def _diff(jd_):
        d = swisseph.calc_ut(jd_, body)[0][0] - natal_lon
        return ((d + 180.0) % 360.0) - 180.0

    results = []
    for which in range(1, count + 1):
        center = natal_jd + which * mean_days
        span = mean_days * 0.2
        step = max(0.5, mean_days / 240.0)
        jd = center - span
        prev = _diff(jd)
        found = None
        scan = jd + step
        while scan <= center + span:
            cur = _diff(scan)
            if (prev <= 0 <= cur) or (prev >= 0 >= cur):
                lo, hi = scan - step, scan
                base_neg = prev <= 0
                for _ in range(50):
                    mid = (lo + hi) / 2.0
                    dm = _diff(mid)
                    if (dm <= 0) == base_neg:
                        lo = mid
                    else:
                        hi = mid
                found = (lo + hi) / 2.0
                break
            prev = cur
            jd = scan
            scan += step
        if found is None:
            found = center
        det = date_time_from_jd(found, zone)
        det['which'] = which
        det['jd'] = round(found, 4)
        results.append(det)
    return {'returns': results, 'natalLon': round(natal_lon, 3), 'body': str(data.get('body', 'Saturn'))}


def compute_prenatal_syzygy(data):
    """ G11 产前朔望:自出生时刻回溯,求最近的朔(日月合,elongation=0°)与望(日月冲,elongation=180°),
        取更晚(更接近出生)者为产前朔望。取度:朔→合相黄经;望→望时地平之上发光体黄经(无则取月)。
        params: date/time/zone/lat/lon。返回 {type, jd, datetime, date, time, sunLon, moonLon,
        daysBeforeBirth, hylegDegree, hylegBody, hylegSign, hylegSignlon}。 """
    date = data.get('date')
    time = data.get('time', '12:00:00')
    zone = data.get('zone', '+00:00')
    birth_jd = Datetime(date, time, zone).jd

    def find_back(target):
        # 自出生时刻起以 0.5 天步长向前(过去)扫,找 elongation 过 target 的最近一次,二分细化。
        # norm180 在 ±180 处回绕,真交叉 step~6°/12h、回绕 step≈360° → abs(cur-prev)<180 排除伪交叉。
        jd = birth_jd
        prev = norm180(moon_sun_elongation(jd) - target)
        # 步进 35 天足够覆盖一个朔望月(~29.53d);找不到则返回 None。
        steps = int(35.0 / 0.5) + 1
        for _ in range(steps):
            nxt = jd - 0.5
            cur = norm180(moon_sun_elongation(nxt) - target)
            if ((prev <= 0 <= cur) or (prev >= 0 >= cur)) and abs(cur - prev) < 180:
                def f(x):
                    return norm180(moon_sun_elongation(x) - target)
                return refine_crossing(f, nxt, jd)
            prev = cur
            jd = nxt
        return None

    new_jd = find_back(0.0)
    full_jd = find_back(180.0)
    # 取更晚(更大 jd、更接近出生)者;缺一取另一。
    if new_jd is None and full_jd is None:
        return {'type': None}
    if full_jd is None or (new_jd is not None and new_jd >= full_jd):
        syz_jd, syz_type = new_jd, 'new'
    else:
        syz_jd, syz_type = full_jd, 'full'

    sun_lon, _, _ = swe_lon(const.SUN, syz_jd)
    moon_lon, _, _ = swe_lon(const.MOON, syz_jd)

    # 取度:朔→合相黄经(日月同度,取日);望→望时地平之上的发光体黄经。
    if syz_type == 'new':
        hyleg_body = const.SUN
        hyleg_degree = sun_lon
    else:
        lat = geo_to_degree(data.get('lat', '0n00'), 'n', 's')
        lon = geo_to_degree(data.get('lon', '0e00'), 'e', 'w')
        # 望时日月对冲,判哪一发光体在地平之上(用赤道坐标 + MC 赤经 + 纬度)。
        hyleg_body = const.MOON
        hyleg_degree = moon_lon
        try:
            from flatlib import utils as _flutils
            # swisseph houses 取 MC 黄经(ascmc[1]);Placidus 仅用其 MC,与宫制无关。
            _cusps, ascmc = swisseph.houses(syz_jd, lat, lon, b'P')
            mc_lon = ascmc[1]
            mc_ra, _mc_decl = _flutils.eqCoords(mc_lon, 0.0)
            sun_ra, sun_decl = _flutils.eqCoords(sun_lon, 0.0)
            moon_ra, moon_decl = _flutils.eqCoords(moon_lon, 0.0)
            sun_above = _flutils.isAboveHorizon(sun_ra, sun_decl, mc_ra, lat)
            moon_above = _flutils.isAboveHorizon(moon_ra, moon_decl, mc_ra, lat)
            if sun_above and not moon_above:
                hyleg_body, hyleg_degree = const.SUN, sun_lon
            elif moon_above and not sun_above:
                hyleg_body, hyleg_degree = const.MOON, moon_lon
            else:
                # 两者同侧(罕见,贴地平):取地平之上者;都在下则取月(发光体默认)。
                hyleg_body = const.SUN if sun_above else const.MOON
                hyleg_degree = sun_lon if sun_above else moon_lon
        except Exception:
            hyleg_body, hyleg_degree = const.MOON, moon_lon

    det = date_time_from_jd(syz_jd, zone)
    return {
        'type': syz_type,
        'jd': round(syz_jd, 5),
        'datetime': det['datetime'],
        'date': det['date'],
        'time': det['time'],
        'sunLon': round(sun_lon, 4),
        'moonLon': round(moon_lon, 4),
        'daysBeforeBirth': round(birth_jd - syz_jd, 3),
        'hylegBody': hyleg_body,
        'hylegDegree': round(hyleg_degree, 4),
        'hylegSign': sign_name_from_lon(hyleg_degree),
        'hylegSignlon': round(hyleg_degree % 30.0, 4),
    }


def compute_eclipse_detail(data):
    """ 食时长定则（A4b）：日食持续 N 小时 → 影响约 N 年；月食 N 小时 → N 月。
        params: date/time/zone(食时刻附近) + eclipseKind(solar/lunar)。返回 swe 全球食的初亏-复圆时长。 """
    date = data.get('date')
    time = data.get('time', '12:00:00')
    zone = data.get('zone', '+00:00')
    kind = str(data.get('eclipseKind', 'solar'))
    result = {'kind': kind, 'durationHours': 0.0, 'influence': 0.0, 'influenceUnit': ('年' if kind == 'solar' else '月')}
    try:
        dt = Datetime(date, time, zone)
        jd_search = dt.jd - 2.0
        if kind == 'lunar':
            _ret, tret = swisseph.lun_eclipse_when(jd_search, swisseph.FLG_SWIEPH, 0, False)
            begin = tret[2] if tret[2] else tret[6]
            end = tret[3] if tret[3] else tret[7]
        else:
            _ret, tret = swisseph.sol_eclipse_when_glob(jd_search, swisseph.FLG_SWIEPH, 0, False)
            begin = tret[2]
            end = tret[3]
        dur_h = (end - begin) * 24.0 if (begin and end and end > begin) else 0.0
        result['durationHours'] = round(dur_h, 2)
        result['influence'] = round(dur_h, 1)
    except Exception:
        pass
    return result


def build_draconic(data):
    params = base_params(data)
    # 界系(termsVariant)请求级临界区:push 取锁+换 essential.TERMS,finally 必还原+释放锁。默认埃及=零回归。
    _terms_orig = None
    try:
        _terms_orig = push_request_terms(data.get('termsVariant', 0))
        perchart = PerChart(params)
        node = perchart.chart.getObject(const.NORTH_NODE)
        node_lon = norm360(node.lon)
        positions = []
        for p in chart_points(perchart, include_angles=True):
            if p['id'] not in DEFAULT_EVENT_PLANETS and p['id'] not in (const.ASC, const.MC, const.PARS_FORTUNA):
                continue
            lon = norm360(p['lon'] - node_lon)
            positions.append({
                'id': p['id'],
                'natalLon': p['lon'],
                'lon': lon,
                'sign': sign_name_from_lon(lon),
                'signlon': lon % 30,
            })
        aspects = aspects_between(positions, positions, [0], safe_float(data.get('orb', 2.0), 2.0))
        aspects = [a for a in aspects if a['a'] != a['b']]

        # 龙盘本身：把命盘各点黄经减去北交点黄经，得到完整盘对象（与 /chart 同形），
        # 供前端复用量化盘的 AstroChart 直接绘制。纯 Python，无需重编 jar 的计算逻辑。
        chart_obj = None
        try:
            DraconicChart(perchart).apply()
            chart_obj = {
                'params': {
                    'birth': perchart.getBirthStr(),
                    'ad': -1 if getattr(perchart, 'isBC', False) else 1,
                    'lat': params.get('lat'),
                    'lon': params.get('lon'),
                    'hsys': params.get('hsys'),
                    'zone': params.get('zone'),
                    'tradition': perchart.tradition,
                    'zodiacal': perchart.zodiacal,
                    'termsVariant': parse_terms_variant(data.get('termsVariant', 0)),
                },
                'chart': perchart.getChartObj(),
                'aspects': {
                    'normalAsp': perchart.getAspects(),
                    'immediateAsp': perchart.getImmediateAspects(),
                    'signAsp': perchart.getSignAspects(),
                },
                'lots': perchart.getPars(perchart.chart),
                'receptions': perchart.getReceptions(),
                'mutuals': perchart.getMutuals(),
                'declParallel': perchart.getParallel(),
            }
        except Exception:
            traceback.print_exc()
            chart_obj = None

        return {'nodeLon': node_lon, 'positions': positions, 'conjunctions': aspects[:120], 'chart': chart_obj}
    finally:
        pop_request_terms(_terms_orig)


# ── 关系量化：天体权重分档（占星通用口径，非门派）─────────────────────────────
# 相位两端天体各带权重，其积＝该相位的天体系数：七星与关系轴角主导、婚神次之、
# 其余小行星/虚点大幅压低，避免小天体虚高稀释主星信号。键＝flatlib obj.id 精确字面量。
RELATIVE_ASPECT_WEIGHT = {0: 6, 60: 3, 90: -4, 120: 4, 180: -5}
RELATIVE_BODY_WEIGHT_DEFAULT = 0.1
RELATIVE_BODY_WEIGHT = {
    # 七星（个人/社会主星）
    'Sun': 1.0, 'Moon': 1.0, 'Mercury': 1.0, 'Venus': 1.0, 'Mars': 1.0, 'Jupiter': 1.0, 'Saturn': 1.0,
    # 四轴（关系轴/事业轴，合盘中与主星同重）
    'Asc': 1.0, 'Desc': 1.0, 'MC': 1.0, 'IC': 1.0,
    # 三王（世代星，合盘仍具张力）
    'Uranus': 0.6, 'Neptune': 0.6, 'Pluto': 0.6,
    # 婚神（婚姻小行星，关系专属）
    'Juno': 0.5,
    # 交点（业力关系轴）
    'North Node': 0.4, 'South Node': 0.4,
    # 其余小行星 + 凯龙
    'Ceres': 0.2, 'Pallas': 0.2, 'Vesta': 0.2, 'Pholus': 0.2, 'Chiron': 0.2,
    # 杂点（朔望/福点/暗月/紫气/月亮远近地点）——未列天体亦落默认 0.1
    'Dark Moon': 0.1, 'Purple Clouds': 0.1, 'Syzygy': 0.1, 'Pars Fortuna': 0.1,
    'Intp_Apog': 0.1, 'Intp_Perg': 0.1,
}


def score_relative_comp(comp, body_weight=None):
    """由 ChartComp 结果算关系量化分：impact = 相位类型权 × 两端天体权之积 × 容许度衰减；
    基础分 50、结果 clamp[0,100]。纯函数（喂合成 comp 即可测），不触星历。"""
    if body_weight is None:
        body_weight = RELATIVE_BODY_WEIGHT

    def bw(name):
        return body_weight.get(name, RELATIVE_BODY_WEIGHT_DEFAULT)

    score = 50
    highlights = []
    challenges = []
    flat = []
    for group_key in ('outToInAsp', 'inToOutAsp'):
        for row in (comp.get(group_key) or []):
            key = row.get('id')
            for asp in row.get('objects', []):
                deg = int(asp.get('aspect', -999))
                weight = RELATIVE_ASPECT_WEIGHT.get(deg, 0)
                bId = asp.get('id') or asp.get('idB') or asp.get('obj') or ''
                orb = safe_float(asp.get('orb', asp.get('delta', 0)), 0)
                body_mult = bw(key) * bw(bId)
                impact = weight * body_mult * max(0.2, 1.0 - min(orb, 8) / 8.0)
                score += impact
                item = {
                    'a': key,
                    'b': bId,
                    'aspect': deg,
                    'orb': orb,
                    'impact': impact,
                    'direction': group_key,
                }
                flat.append(item)
                if impact > 0:
                    highlights.append(item)
                elif impact < 0:
                    challenges.append(item)
    return {
        'score': max(0, min(100, round(score, 1))),
        'aspects': sorted(flat, key=lambda item: abs(item['impact']), reverse=True)[:80],
        'highlights': sorted(highlights, key=lambda item: item['impact'], reverse=True)[:20],
        'challenges': sorted(challenges, key=lambda item: item['impact'])[:20],
    }


def build_relative_score(data):
    from astrostudy.modern.chartcomp import ChartComp
    params = dict(data or {})
    params['relative'] = 0
    inner = dict(params.get('inner') or {})
    outer = dict(params.get('outer') or {})
    hsys = params.get('hsys', 0)
    zodiacal = params.get('zodiacal', 0)
    for item in (inner, outer):
        item['tradition'] = False
        item['predictive'] = False
        item['hsys'] = hsys
        item['zodiacal'] = zodiacal
    comp = ChartComp(inner, outer).compute()
    result = score_relative_comp(comp)
    result['raw'] = comp
    return result
