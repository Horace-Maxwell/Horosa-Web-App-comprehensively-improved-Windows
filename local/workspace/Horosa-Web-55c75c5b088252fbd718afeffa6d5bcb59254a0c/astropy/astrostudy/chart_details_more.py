# -*- coding: utf-8 -*-
"""chart_details_more.py — 盘面细节表(续):月亮日、部分相位、AstroDynes、世俗相位、成相表、宫头相位、恒星相位、
行星细节、度数性质、中点六坐标、统计、人体对应。

都吃 chart_details 的 frame / ChartView,结果并进 /astroextra/chartdetails 同一个响应。
"""
import math
from itertools import combinations

import swisseph
from flatlib import const
from flatlib.dignities import essential, tables as dignity_tables

from astrostudy.directed_figures import norm360

FLAGS = swisseph.FLG_SWIEPH
TEN = ('Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto')
SWE_ID = {'Sun': swisseph.SUN, 'Moon': swisseph.MOON, 'Mercury': swisseph.MERCURY, 'Venus': swisseph.VENUS, 'Mars': swisseph.MARS,
          'Jupiter': swisseph.JUPITER, 'Saturn': swisseph.SATURN, 'Uranus': swisseph.URANUS, 'Neptune': swisseph.NEPTUNE,
          'Pluto': swisseph.PLUTO, 'North Node': swisseph.TRUE_NODE, 'Mean Node': swisseph.MEAN_NODE}
RADII = {'Sun': 7.5, 'Moon': 6.0, 'Mercury': 3.5, 'Venus': 4.0, 'Mars': 3.5, 'Jupiter': 4.5, 'Saturn': 4.5,
         'Uranus': 2.0, 'Neptune': 2.0, 'Pluto': 2.0, 'North Node': 2.5, 'Mean Node': 2.5, 'South Node': 2.5, 'Asc': 2.5, 'MC': 2.5, 'Pars Fortuna': 2.5}
MAJOR = (0, 60, 90, 120, 180)
SYNODIC_MONTH = 29.530589


def fold180(x):
    return (x + 180.0) % 360.0 - 180.0


def sep(a, b):
    return abs(fold180(a - b))


def _lon(jd, name):
    return swisseph.calc_ut(jd, SWE_ID[name], FLAGS)[0][0]


def _elong(jd):
    return norm360(_lon(jd, 'Moon') - _lon(jd, 'Sun'))


# ---------------------------------------------------------------------------
# 月亮日
# ---------------------------------------------------------------------------
def _elong_rate(jd):
    moon = swisseph.calc_ut(jd, swisseph.MOON, FLAGS | swisseph.FLG_SPEED)[0][3]
    sun = swisseph.calc_ut(jd, swisseph.SUN, FLAGS | swisseph.FLG_SPEED)[0][3]
    return moon - sun


def elongation_near(target, guess):
    """日月角距(月 − 日)= target 的时刻,牛顿迭代;月亮恒快于太阳,角距单调增。"""
    t = guess
    for _ in range(30):
        step = fold180(_elong(t) - target) / _elong_rate(t)
        t -= step
        if abs(step) < 1e-8:
            break
    return t


def last_elongation(target, jd):
    t = elongation_near(target, jd - norm360(_elong(jd) - target) / 12.19)
    if t > jd + 1e-9:
        t = elongation_near(target, t - SYNODIC_MONTH)
    return t


def next_elongation(target, jd):
    t = elongation_near(target, jd + norm360(target - _elong(jd)) / 12.19)
    if t <= jd:
        t = elongation_near(target, t + SYNODIC_MONTH)
    return t


def new_moon_near(jd):
    """jd 之前(含)最近一次朔、其后一次朔。"""
    prev_nm = last_elongation(0.0, jd)
    return prev_nm, next_elongation(0.0, prev_nm + 1.0)


def _moonrises(start, end, geopos):
    out = []
    t = start
    while t < end:
        try:
            res, tret = swisseph.rise_trans(t, swisseph.MOON, swisseph.CALC_RISE, geopos, 1013.25, 15.0, FLAGS)
        except Exception:
            return None
        if res != 0 or not tret or tret[0] <= t:
            return None             # 极区月亮不升:传统月亮日不成立
        if tret[0] >= end:
            break
        out.append(tret[0])
        t = tret[0] + 0.01
    return out


def _between(targets, start):
    """一串单调增的角距目标,从 start 起逐个往后找。"""
    out = []
    t = start
    for target in targets:
        t = next_elongation(target, t + 1e-6)
        out.append(t)
    return out


def lunar_day_bounds(method, prev_nm, next_nm, geopos):
    """返回日界列表 [起, 界1, …, 止],止是下一个朔。"""
    if method == 'traditional':
        rises = _moonrises(prev_nm, next_nm, geopos)
        if rises is None:
            return None
        return [prev_nm] + rises + [next_nm]
    if method == 'tithi':
        return [prev_nm] + _between([12.0 * k for k in range(1, 30)], prev_nm) + [next_nm]
    if method == 'equal':
        span = (next_nm - prev_nm) / 29.5
        return [prev_nm + span * k for k in range(30)] + [next_nm]
    if method == 'angle':
        # 明暗线在月面直径上的投影位置 = cos(角距),按它等分:盈 15 日由 0 到全亮,亏 15 日回到 0
        targets = [math.degrees(math.acos(1.0 - 2.0 * k / 15.0)) for k in range(1, 15)] + [180.0]
        targets += [360.0 - math.degrees(math.acos(1.0 - 2.0 * (15 - k) / 15.0)) for k in range(1, 15)]
        return [prev_nm] + _between(targets, prev_nm) + [next_nm]
    return None


CENTERED_PHASES = [('new', '朔')] + [('waxing', '盈')] * 14 + [('full', '望')] + [('waning', '亏')] * 14


def centered_bounds(jd):
    """三十个角距窗:第 1 日 354°~6°(跨朔),此后每 12° 一日,第 30 日 342°~354°。返回含 jd 的那一轮。"""
    start = last_elongation(354.0, jd)
    return [start] + _between([6.0 + 12.0 * k for k in range(29)] + [354.0], start)


LUNAR_METHODS = ('traditional', 'tithi', 'equal', 'angle', 'centered')


def lunar_days(frame, method):
    jd = frame['jd']
    method = method if method in LUNAR_METHODS else 'traditional'
    geopos = (frame['geolon'], frame['phi'], 0.0)
    if method == 'centered':
        bounds = centered_bounds(jd)
        prev_nm = None
    else:
        prev_nm, next_nm = new_moon_near(jd)
        bounds = lunar_day_bounds(method, prev_nm, next_nm, geopos)
    if not bounds:
        return {'method': method, 'rows': [], 'note': 'polar'}
    rows = []
    if bounds[-1] <= jd:            # 盘时刻正好落在算出的后一次朔上:那一刻算新一轮的第 1 日
        prev_nm = bounds[-1]
        if method == 'centered':
            bounds = centered_bounds(jd + 1e-6)
        else:
            next_nm = next_elongation(0.0, prev_nm + 1.0)
            bounds = lunar_day_bounds(method, prev_nm, next_nm, geopos) or bounds
    for i in range(len(bounds) - 1):
        a, b = bounds[i], bounds[i + 1]
        row = {'day': i + 1, 'start': frame['dateOf'](a), 'end': frame['dateOf'](b), 'hours': (b - a) * 24.0, 'current': a <= jd < b}
        if method == 'centered':
            row['phase'] = CENTERED_PHASES[i][1]
        rows.append(row)
    return {'method': method, 'rows': rows, 'newMoon': frame['dateOf'](prev_nm) if prev_nm else None}


# ---------------------------------------------------------------------------
# 部分相位(整座同度):星在座内第 d 度,把合、六合、刑、拱、冲投到各座第 d 度
# ---------------------------------------------------------------------------
BINDHU_POINTS = TEN + ('North Node', 'South Node', 'Asc', 'MC', 'Pars Fortuna')
BINDHU_ASPECTS = ((60, (2, 10)), (90, (3, 9)), (120, (4, 8)), (180, (6,)))


def detail_points(frame, view):
    pts = {name: frame['points'][name]['lon'] for name in TEN}
    pts['North Node'] = view.node
    pts['South Node'] = norm360(view.node + 180.0)
    pts['Asc'] = view.asc
    pts['MC'] = view.mc
    pts['Pars Fortuna'] = view.fortune
    return pts


def bindhu_rows(points):
    rows = []
    for name in BINDHU_POINTS:
        lon = points[name]
        sign = int(lon // 30) % 12
        row = {'point': name, 'lon': lon, 'sign': sign, 'degree': int(lon % 30) + 1}
        for angle, steps in BINDHU_ASPECTS:
            row['a%d' % angle] = [(sign + s) % 12 for s in steps]
        rows.append(row)
    return rows


# ---------------------------------------------------------------------------
# AstroDynes:相位力、和谐,星、宫、座三级分数。两星都用 max(T(a), T(b)) 对称取表。
# ---------------------------------------------------------------------------
DYNE_COLUMNS = {0: 0, 180: 0, 90: 1, 120: 1, 60: 2, 45: 3, 135: 3, 30: 4, 150: 4}
DYNE_TABLE = {
    ('A', 'angular'): (15, 12, 8, 6, 4), ('A', 'succedent'): (13, 10, 7, 5, 3), ('A', 'cadent'): (11, 8, 6, 4, 2),
    ('B', 'angular'): (12, 10, 7, 5, 3), ('B', 'succedent'): (10, 8, 6, 4, 2), ('B', 'cadent'): (8, 6, 5, 3, 1),
}
DYNE_SIGN = {30: 1, 60: 1, 120: 1, 45: -1, 90: -1, 135: -1, 180: -1, 0: 0, 150: 0}
DYNE_NATURE = {'Venus': 0.25, 'Jupiter': 0.5, 'Mars': -0.25, 'Saturn': -0.5}
DYNE_HOUSE = {1: (15.0, 2.0), 2: (8.5, 0.5), 3: (8.0, 0.5), 4: (14.0, 2.0), 5: (7.5, 0.5), 6: (7.0, 0.5),
              7: (14.5, 2.0), 8: (10.9, 0.9), 9: (10.0, 0.7), 10: (15.0, 2.0), 11: (11.9, 1.0), 12: (9.3, 0.7)}
# 本质尊贵分(按座):守 +2、旺 +3、陷 −2、落 −3、另一组 +1 / −1;外行星只给守陷
DYNE_DIGNITY = {
    'Sun': ((4,), (0,), (10,), (6,), (8,), (2,)), 'Moon': ((3,), (1,), (9,), (7,), (11,), (5,)),
    'Mercury': ((2, 5), (10,), (8, 11), (4,), (7,), (1,)), 'Venus': ((1, 6), (11,), (0, 7), (5,), (10,), (4,)),
    'Mars': ((0,), (9,), (6,), (3,), (4,), (10,)), 'Jupiter': ((8,), (3,), (2,), (9,), (1,), (7,)),
    'Saturn': ((9,), (6,), (3,), (0,), (5,), (11,)),
    'Uranus': ((10,), (), (4,), (), (), ()), 'Neptune': ((11,), (), (5,), (), (), ()), 'Pluto': ((7,), (), (1,), (), (), ()),
}
DYNE_EXACT = {'Sun': (0, 19), 'Moon': (1, 3), 'Mercury': (10, 15), 'Venus': (11, 27), 'Mars': (9, 28), 'Jupiter': (3, 15), 'Saturn': (6, 21)}
MODERN_RULERS = {7: ('Mars', 'Pluto'), 10: ('Saturn', 'Uranus'), 11: ('Jupiter', 'Neptune')}
DYNE_MODERN_OWN = {'Uranus': 10, 'Neptune': 11, 'Pluto': 7}


def _house_index(lon, cusps):
    for i in range(12):
        width = norm360(cusps[(i + 1) % 12] - cusps[i])
        if norm360(lon - cusps[i]) < width:
            return i
    return 0


def _house_type(house):
    return 'angular' if house in (1, 4, 7, 10) else 'succedent' if house in (2, 5, 8, 11) else 'cadent'


def _dyne_class(name):
    return 'A' if name in ('Sun', 'Moon', 'Mercury') else 'B'


def _dyne_closest(a, b):
    """一对点只取一个相位:最近的那个;129~130 之间算三分(三分到 130 止,135 从 130 起)。"""
    d = sep(a, b)
    best = None
    for angle in DYNE_COLUMNS:
        o = abs(d - angle)
        if angle == 135 and d < 130.0:
            continue
        if angle == 120 and d >= 130.0:
            continue
        if best is None or o < best[1]:
            best = (angle, o)
    return best


def _dyne_dignity(name, lon):
    table = DYNE_DIGNITY.get(name)
    if not table:
        return 0.0
    sign = int(lon // 30) % 12
    score = 0.0
    for signs, value in zip(table, (2, 3, -2, -3, 1, -1)):
        if sign in signs:
            score += value
    exact = DYNE_EXACT.get(name)
    if exact:
        deg = int(lon % 30)
        if sign == exact[0] and deg == exact[1] - 1:
            score += 1
        if sign == (exact[0] + 6) % 12 and deg == exact[1] - 1:
            score -= 1
    return score


def _dyne_ruler_of(name):
    own = [s for s in range(12) if essential.ruler(const.LIST_SIGNS[s]) == name]
    if name in DYNE_MODERN_OWN:
        own = [DYNE_MODERN_OWN[name]]
    return own


def astrodynes(frame, view):
    cusps = view.cusps
    pts = {name: frame['points'][name]['lon'] for name in TEN}
    decl = {}
    eps = frame['epsTrue']
    for name in TEN:
        lat = frame['points'][name].get('lat', 0.0) or 0.0
        decl[name] = swisseph.cotrans((pts[name], lat, 1.0), -eps)[1]
    house = {name: _house_index(pts[name], cusps) + 1 for name in TEN}

    def table_value(name, column):
        if name in ('Asc', 'MC'):
            return DYNE_TABLE[('B', 'angular')][column]
        return DYNE_TABLE[(_dyne_class(name), _house_type(house[name]))][column]

    power = {name: 0.0 for name in TEN}
    harmony = {name: 0.0 for name in TEN}
    aspects = []
    angles = {'Asc': view.asc, 'MC': view.mc}
    names = list(TEN)
    for a, b in combinations(names + ['Asc', 'MC'], 2):
        if a in angles and b in angles:
            continue
        la, lb = pts.get(a, angles.get(a)), pts.get(b, angles.get(b))
        angle, orb = _dyne_closest(la, lb)
        column = DYNE_COLUMNS[angle]
        m = max(table_value(a, column), table_value(b, column))
        if orb < m:
            value = m - orb
            f = DYNE_SIGN[angle] + DYNE_NATURE.get(a, 0.0) + DYNE_NATURE.get(b, 0.0)
            for side in (a, b):
                if side in power:
                    power[side] += value
                    harmony[side] += f * value
            aspects.append({'a': a, 'b': b, 'aspect': angle, 'orb': orb, 'power': value, 'harmony': f * value})
    for a, b in combinations(names, 2):
        delta = abs(abs(decl[a]) - abs(decl[b]))
        if delta < 1.0:
            m = max(table_value(a, 0), table_value(b, 0))
            value = m * (1.0 - delta)
            nature = DYNE_NATURE.get(a, 0.0) + DYNE_NATURE.get(b, 0.0)
            kind = 'parallel' if decl[a] * decl[b] >= 0 else 'contraparallel'
            for side in (a, b):
                power[side] += value
                harmony[side] += nature * value
            aspects.append({'a': a, 'b': b, 'aspect': kind, 'orb': delta, 'power': value, 'harmony': nature * value})
    # 互容:两星互在对方所守的座(现代守护也算),各 +5
    signs = {name: int(pts[name] // 30) % 12 for name in TEN}
    for a, b in combinations(names, 2):
        if signs[a] in _dyne_ruler_of(b) and signs[b] in _dyne_ruler_of(a):
            harmony[a] += 5.0
            harmony[b] += 5.0
    rows = []
    for name in TEN:
        h = house[name]
        start = cusps[h - 1]
        width = norm360(cusps[h % 12] - start) or 30.0
        s, k = DYNE_HOUSE[h]
        # 宫位力:从宫头起随离宫头的度数线性递减,斜率按宫宽的平方归一(e = s − k·30·d / w²),宽宫每度降得慢
        e = s - k * 30.0 * norm360(pts[name] - start) / (width * width)
        dignity = _dyne_dignity(name, pts[name])
        rows.append({'planet': name, 'house': h, 'aspectPower': power[name], 'housePower': e, 'power': power[name] + e,
                     'aspectHarmony': harmony[name], 'dignity': dignity, 'harmony': harmony[name] + dignity})
    p_score = {row['planet']: row['power'] for row in rows}
    p_harmo = {row['planet']: row['harmony'] for row in rows}
    p_score['Asc'] = 15.0
    p_score['MC'] = 15.0
    p_harmo['Asc'] = 0.0
    p_harmo['MC'] = 0.0

    def ruler_value(sign, scores):
        trad = essential.ruler(const.LIST_SIGNS[sign])
        if sign in MODERN_RULERS:
            return sum(scores[x] for x in MODERN_RULERS[sign]) / 2.0
        return scores[trad]

    cusp_signs = [int(c // 30) % 12 for c in cusps]
    cusp_count = {s: cusp_signs.count(s) for s in range(12)}
    point_lon = dict(pts, Asc=view.asc, MC=view.mc)
    houses = []
    for i in range(12):
        members = [n for n, lon in point_lon.items() if _house_index(lon, cusps) == i]
        start, end = cusps[i], cusps[(i + 1) % 12]
        inner = [s for s in range(12) if cusp_count[s] == 0 and norm360(s * 30.0 - start) < norm360(end - start)]
        row = {'house': i + 1}
        for key, scores in (('power', p_score), ('harmony', p_harmo)):
            row[key] = sum(scores[n] for n in members) + 0.5 * ruler_value(cusp_signs[i], scores) + 0.25 * sum(ruler_value(s, scores) for s in inner)
        houses.append(row)
    sign_rows = []
    for s in range(12):
        members = [n for n, lon in point_lon.items() if int(lon // 30) % 12 == s]
        factor = cusp_count[s] / 2.0 if cusp_count[s] else 0.25
        row = {'sign': s}
        for key, scores in (('power', p_score), ('harmony', p_harmo)):
            row[key] = sum(scores[n] for n in members) + factor * ruler_value(s, scores)
        sign_rows.append(row)
    return {'rows': rows, 'aspects': aspects, 'houses': houses, 'signs': sign_rows}


# ---------------------------------------------------------------------------
# 世俗相位:两点的世俗距离(宫内按比例或各宫制的真实世俗位置),按世俗距离判相位
# ---------------------------------------------------------------------------
MUNDO_SYSTEMS = {'placidus': b'P', 'koch': b'K', 'porphyry': b'O', 'regiomontanus': b'R', 'campanus': b'C', 'alcabitius': b'B',
                 'meridian': b'X', 'horizontal': b'H', 'topocentric': b'T', 'morinus': b'M', 'krusinski': b'U'}
MUNDO_POINTS = TEN + ('North Node', 'South Node', 'Asc', 'MC', 'Pars Fortuna')


def mundane_position(lon, lat, frame, cusps, system):
    if system == 'proportional':
        i = _house_index(lon, cusps)
        width = norm360(cusps[(i + 1) % 12] - cusps[i]) or 30.0
        return 30.0 * (i + norm360(lon - cusps[i]) / width)
    def place(latitude):
        try:
            return swisseph.house_pos(frame['armc'], frame['phi'], frame['epsTrue'], (lon, latitude), MUNDO_SYSTEMS[system])
        except Exception:
            return None
    hp = place(lat)
    if (not hp or hp < 1.0) and lat:
        hp = place(0.0)             # Koch 对带黄纬的点偶尔返回 0,按黄道上的点重试
    if not hp or hp < 1.0:          # 高纬 Koch / Placidus 等不成立时星历库返回 0 而不抛错
        return None
    return (hp - 1.0) * 30.0


def in_mundo(frame, view, system):
    system = system if system == 'proportional' or system in MUNDO_SYSTEMS else 'proportional'
    points = detail_points(frame, view)
    positions = {}
    for name in MUNDO_POINTS:
        if name in ('Asc', 'MC') and system == 'proportional':
            positions[name] = 0.0 if name == 'Asc' else 270.0
        elif name in ('Asc', 'MC'):
            # 子午、地平、Morinus 等宫制的第 1、10 宫头不在上升、天顶,按该宫制求真实位置
            positions[name] = mundane_position(points[name], 0.0, frame, view.cusps, system)
        else:
            lat = frame['points'][name].get('lat', 0.0) if name in TEN else 0.0
            positions[name] = mundane_position(points[name], lat or 0.0, frame, view.cusps, system)
    rows = []
    for name in MUNDO_POINTS:
        pos = positions[name]
        if pos is not None:
            rows.append({'point': name, 'position': pos, 'house': int(pos // 30) % 12 + 1, 'inHouse': pos % 30})
    pairs = []
    for a, b in combinations(MUNDO_POINTS, 2):
        if positions[a] is None or positions[b] is None or {a, b} in ({'North Node', 'South Node'}, {'Asc', 'MC'}):
            continue
        d = sep(positions[a], positions[b])
        for angle in MAJOR:
            orb = abs(d - angle)
            if orb <= RADII[a] + RADII[b]:
                pairs.append({'a': a, 'b': b, 'distance': d, 'aspect': angle, 'orb': orb})
                break
    pairs.sort(key=lambda row: row['orb'])
    # 这个宫制在本纬度对某些点不成立(极区半弧无解、拱极星不出没)时,如实列出缺哪些点,页面与快照据此注明
    missing = [name for name in MUNDO_POINTS if positions[name] is None]
    return {'system': system, 'positions': rows, 'aspects': pairs, 'missing': missing}


# ---------------------------------------------------------------------------
# 成相表:现在入相位、在容许度内的星对,往后推到正相位的时刻(上升、天顶按本命固定点)
# ---------------------------------------------------------------------------
PERFECT_POINTS = TEN + ('North Node',)
PERFECT_LIMIT_DAYS = 150 * 365.25


def _pair_gap(jd, a, b, target, fixed):
    """带号差 fold(λa − λb − target),正相位处过零;target 取 0、180 或 ±相位角。"""
    la = _lon(jd, a)
    lb = fixed[b] if b in fixed else _lon(jd, b)
    return fold180(la - lb - target)


def _signed_root(jd0, a, b, target, fixed):
    """带号差第一次过零的时刻。步长随剩余差与相对速度自调;±180 处的跳变不算根。"""
    t = jd0
    g = _pair_gap(t, a, b, target, fixed)
    floor = 0.02 if 'Moon' in (a, b) else 0.2
    while t - jd0 < PERFECT_LIMIT_DAYS:
        rate = abs(fold180(_pair_gap(t + 0.5, a, b, target, fixed) - _pair_gap(t - 0.5, a, b, target, fixed)))
        step = abs(g) / rate * 0.5 if rate > 1e-6 else 5.0
        step = max(floor, min(step, 20.0))
        t2 = t + step
        g2 = _pair_gap(t2, a, b, target, fixed)
        if g * g2 < 0 and abs(g - g2) < 180.0:
            lo, hi = t, t2
            for _ in range(50):
                mid = (lo + hi) / 2.0
                if _pair_gap(mid, a, b, target, fixed) * g > 0:
                    lo = mid
                else:
                    hi = mid
            return (lo + hi) / 2.0
        t, g = t2, g2
    return None


def _perfection(jd0, a, b, angle, fixed):
    """从 jd0 起向后第一次正相位。合、冲各一个带号目标;其余相位两侧(±角)各求一次,取较早的。"""
    targets = (0.0,) if angle == 0 else (180.0,) if angle == 180 else (float(angle), -float(angle))
    hits = [t for t in (_signed_root(jd0, a, b, x, fixed) for x in targets) if t is not None]
    return min(hits) if hits else None


def _gap_now(jd, a, b, angle, fixed):
    """|距离 − 相位角|。"""
    la = _lon(jd, a)
    lb = fixed[b] if b in fixed else _lon(jd, b)
    return abs(sep(la, lb) - angle)


def perfections(frame, view):
    """盘时刻在容许度内的星对(入相位、离相位都列),往后推下一次正相位。离相位的要等下一轮,所以会排到很多年后。
    北交跟本页其它表同一个交点(view.node):是真交点就按真交点推,否则按平交点推。"""
    jd = frame['jd']
    fixed = {'Asc': view.asc, 'MC': view.mc}
    rows = []
    true_node = abs(fold180(view.node - _lon(jd, 'North Node'))) < 1e-6
    node = 'North Node' if true_node else 'Mean Node'
    points = tuple(node if p == 'North Node' else p for p in PERFECT_POINTS)
    shown = {node: 'North Node'}
    pairs = list(combinations(points, 2)) + [(p, x) for p in points for x in ('Asc', 'MC')]
    for a, b in pairs:
        la = _lon(jd, a)
        lb = fixed[b] if b in fixed else _lon(jd, b)
        d = sep(la, lb)
        angle = min(MAJOR, key=lambda x: abs(d - x))
        gap = abs(d - angle)
        if gap > RADII[a] + RADII[b]:
            continue
        applying = _gap_now(jd + 1e-4, a, b, angle, fixed) < _gap_now(jd, a, b, angle, fixed)
        when = _perfection(jd, a, b, angle, fixed)
        if when is not None:
            rows.append({'a': shown.get(a, a), 'b': shown.get(b, b), 'aspect': angle, 'gap': gap, 'applying': applying,
                         'jd': when, 'datetime': frame['dateOf'](when)})
    rows.sort(key=lambda row: row['jd'])
    return rows


# ---------------------------------------------------------------------------
# 宫头相位:各星到十二宫头的主相位,A 入相位 / S 离相位
# ---------------------------------------------------------------------------
CUSP_ORBS = {0: 10.0, 60: 5.5, 90: 7.0, 120: 8.0, 180: 10.0}


def cusp_aspects(frame, view):
    """容许度按相位(合冲 10、拱 8、刑 7、六合 5.5),不分星;上升、天顶、福点不动,不分入离。"""
    rows = []
    points = detail_points(frame, view)
    for name in BINDHU_POINTS:
        lon = points[name]
        speed = frame['points'][name]['speed'] if name in TEN else None
        if name in ('North Node', 'South Node'):
            speed = frame['points']['North Node']['speed'] if 'North Node' in frame['points'] else -0.053
        for i, cusp in enumerate(view.cusps):
            d = sep(lon, cusp)
            for angle in MAJOR:
                orb = abs(d - angle)
                if orb <= CUSP_ORBS[angle]:
                    applying = None if speed is None else abs(sep(lon + speed * 0.01, cusp) - angle) < orb
                    rows.append({'planet': name, 'house': i + 1, 'aspect': angle, 'orb': orb, 'applying': applying})
                    break
    return rows


# ---------------------------------------------------------------------------
# 恒星相位:亮星子集,五个主相位,容许 1°
# ---------------------------------------------------------------------------
BRIGHT_STARS = ('Achernar', 'Alcyone', 'Aldebaran', 'Algol', 'Algorab', 'Alphecca', 'Altair', 'Antares', 'Arcturus', 'Betelgeuse',
                'Bungula', 'Canopus', 'Capella', 'Castor', 'Deneb', 'Deneb Algedi', 'Denebola', 'Fomalhaut', 'Pollux', 'Procyon',
                'Regulus', 'Rigel', 'Sirius', 'Spica', 'Vega')
STAR_ORB = 1.0


def star_aspects(frame, view):
    jd = frame['jd']
    stars = []
    for star in BRIGHT_STARS:
        try:
            pos, name, _ = swisseph.fixstar2_ut(star, jd, FLAGS)
            stars.append((star, pos[0]))
        except Exception:
            continue
    points = detail_points(frame, view)
    rows = []
    for name in BINDHU_POINTS:
        for star, slon in stars:
            d = sep(points[name], slon)
            for angle in MAJOR:
                if abs(d - angle) <= STAR_ORB:
                    rows.append({'planet': name, 'star': star, 'aspect': angle, 'orb': abs(d - angle), 'starLon': slon})
    return rows


# ---------------------------------------------------------------------------
# 行星细节:相角、亮度、视径、方位高度、赤经赤纬、速度加减与速度比
# ---------------------------------------------------------------------------
SPEED_RANGE = {'Sun': (0.946, 1.025), 'Moon': (11.75, 15.41)}
SPEED_MAX = {'Mercury': 2.23, 'Venus': 1.266, 'Mars': 0.794, 'Jupiter': 0.244, 'Saturn': 0.134, 'Uranus': 0.067, 'Neptune': 0.040, 'Pluto': 0.041}
SPEED_MEAN = {'Mercury': 1.40, 'Venus': 1.22, 'Mars': 0.72, 'Jupiter': 0.137, 'Saturn': 0.084, 'Uranus': 0.044, 'Neptune': 0.0286, 'Pluto': 0.0284}


def planet_details(frame):
    jd = frame['jd']
    geopos = (frame['geolon'], frame['phi'], 0.0)
    rows = []
    for name in TEN:
        sid = SWE_ID[name]
        xx = swisseph.calc_ut(jd, sid, FLAGS | swisseph.FLG_SPEED)[0]
        eq = swisseph.calc_ut(jd, sid, FLAGS | swisseph.FLG_EQUATORIAL)[0]
        try:
            ph = swisseph.pheno_ut(jd, sid, FLAGS)
        except Exception:
            ph = (0.0, 0.0, 0.0, 0.0, 0.0)
        azalt = swisseph.azalt(jd, swisseph.ECL2HOR, geopos, 1013.25, 15.0, (xx[0], xx[1], xx[2]))
        before = abs(swisseph.calc_ut(jd - 0.5, sid, FLAGS | swisseph.FLG_SPEED)[0][3])
        after = abs(swisseph.calc_ut(jd + 0.5, sid, FLAGS | swisseph.FLG_SPEED)[0][3])
        speed = xx[3]
        if name in SPEED_RANGE:
            lo, hi = SPEED_RANGE[name]
            ratio = (abs(speed) - lo) / (hi - lo)
            ratio_mean = ratio
        else:
            ratio = abs(speed) / SPEED_MAX[name]
            ratio_mean = abs(speed) / SPEED_MEAN[name]
        rows.append({'planet': name, 'lon': xx[0], 'lat': xx[1], 'speed': speed, 'accelerating': after > before,
                     'speedPct': ratio * 100.0, 'speedMeanPct': ratio_mean * 100.0, 'ra': eq[0], 'decl': eq[1],
                     'phaseAngle': ph[0], 'phase': ph[1], 'elongation': ph[2], 'diameter': ph[3], 'magnitude': ph[4],
                     'azimuth': norm360(azalt[0] + 180.0), 'altitude': azalt[1], 'apparentAltitude': azalt[2]})
    return rows


# ---------------------------------------------------------------------------
# 度数性质:逐度定表(阴阳、明暗两派、井度两派、增运两派、残缺、深陷)+ 宫头的界、面、十二分、九分、宿
# ---------------------------------------------------------------------------
DEGREE_CODES = (
    'MSS MSS MSS MDD MDD MDDWWA MDD FDD FSSW MSS MSSWWA MSS MSS MSS MSS FSSA FBBWW FBB FBBA FBB FDD FDD MDDA MDDWW MBB MBB MBB MBB '
    'MBBWWA MDD MSS MSS MSS MDD MDDWWA MDDI MDDI FDDI FDD FDDI FEE FEEA FBBWW FBB FBBFF MBB MBB MBBWW MBB MBB MED MED MED MEDWWA '
    'MEDWWA MBBW MBBFF MBB MSEW MSEFF FBB FBBWWA FBB FBB FBB FBB MBB MSD MSD MSD MBB MBBWA MBBW MBB MBB MEE MEEWWA FBD FBD FBD FBD '
    'FBDW FBD MSD MSD MSDWA MSD FSD FSE FSEWWA MSB MSB FSB FSB FSB FSB FSB MBB MBBI MBBI FBBI FBBWWIA MSDI MSDI MBEI MBE MBEWWA MBE '
    'MDS MDS MBB MBBW MBBWWA FBB FBB FBBWA FBB MBBW MDE MDEWWA MBD MBD MBDFF MBD MBDFF FBDWWA FBD MSD MSD MSD MDS MDS MDSWWA FDS '
    'FDSWWA FDS FEE FEEI FEE FEE FEE FBBWWA FBBWWA MBB MBB MBB MBBI MBBWWIA MBB MBB FSD FSD FSD FSD FSD FBD FBB MBBWWA MBB MEE MEE '
    'MBB FBBWWA FBB FBB FBBWWA FBB FDS FDS FDS MDSWWA MBE MBEA FBE FBEWW FBE FBD FBD FED FEDW MBBWW MBB MBB MBB MBB FSD FSDWWA FSD '
    'FSD FSD MBB MBB MBB MBB MBB MBB MBB MBB MSD MSDWWA MSD FBB FBBW FBB FBB FBB FBBW FBE MEE MEEWWA MSD MSD MSD MBB FBB FBB FBBFF '
    'FBB FEEWWA FEEWWA MEE MEE MEE MEE FBB FBB FBBW FBB FBBI MBB MDS MDSWWA MBEWWA MBE MBE MBE MBEWWA FSD FSDI FSD MBBI MBB FBB FBB '
    'FBB MBB MBBWWIA MBBI MBB MSD MSD MSDWWA FBD FBD FBDWWA FBD FBD FBDI FBDI FDD FDD FDD FDDW FSDWA MSD MSD MSDWWA MSD MSD MSDWWA '
    'MSD MSDWW MSD MSD MSD MSD MSDWA MBD MBD MBD MDD FDD FDD FDD FDD FBD FBDWWA FBD FBD MSD MSD MEDWWA MED MEDWA MED MBDI MBDI MBDWI '
    'MBDWIA MBD MDDWW MDD MDD MDD MBD FBD FBD FBD FBD FSDI FSDA FSDWWA MSD MBD MBD MBD MBDWWA MBDI FBDI FBDFF FBD FEDWA FEDWA FED FED '
    'MBD MBD MBD MBDWWA MBD MSD MSD MSD MSDWWA MSD MSD MBD MBD MBDWWA MBD FBD FBD FSD FSD FSD FSD FSD FSD FBD FBD MBD MBD MEE FEEWWA '
    'FEE FBB FBBWWA FBBWWA MSD MSD'
).split()
LIGHT = {'S': 'smoky', 'D': 'dark', 'B': 'bright', 'E': 'void'}


# 改进档:Lilly《基督教占星》(1647)卷一第 116 页「星座度数两表」,逐座 30 度:
# (阴阳 M/F, 明暗 B 明 / D 暗 / S 烟 / E 空, 深陷(井)度, 残缺度, 增运度);第 N 度 = 座内 [N−1, N)。
# 原书深陷与井度是同一类(deep or pitted),只有一派。经典档沿用上面的逐度码表。
LILLY_DEGREES = (
    ('MMMMMMMMFMMMMMMFFFFFFFMMMMMMMM', 'DDDBBBBBDDDDDDDDBBBBEEEEBBBBBE', (6, 11, 16, 23, 29), (), (19,)),   # Aries
    ('FFFFFMMMMMMFFFFFFMMMMFFFMMMMMM', 'DDDBBBBEEEEEBBBEEEEEBBBBBBBBDD', (5, 12, 24, 25), (6, 7, 8, 9, 10), (3, 15, 27)),   # Taurus
    ('FFFFFMMMMMMMMMMMFFFFFFMMMMFFFF', 'BBBBDDDBBBBBEEEEBBBBBBDDDDDEEE', (2, 12, 17, 26, 30), (), (11,)),   # Gemini
    ('MMFFFFFFMMFFMMMMMMMMMMMFFFFMMM', 'BBBBBBBBBBBBDDEEEESSBBBBBBBBEE', (12, 17, 23, 26, 30), (9, 10, 11, 12, 13, 14, 15), (1, 2, 3, 4, 15)),   # Cancer
    ('MMMMMFFFMMMMMMMFFFFFFFFMMMMMMM', 'DDDDDDDDDDSSSSSSSSSSEEEEEBBBBB', (6, 13, 15, 22, 23, 28), (18, 27, 28), (2, 5, 7, 19)),   # Leo
    ('FFFFFFFFMMMMFFFFFFFFMMMMMMMMMM', 'DDDDDBBBEEBBBBBBSSSSSSEEEEEDDD', (8, 13, 16, 21, 22), (), (3, 14, 20)),   # Virgo
    ('MMMMMFFFFFFFFFFMMMMMFFFFFFFMMM', 'BBBBBDDDDDBBBBBBBBDDDBBBBBBEEE', (1, 7, 20, 30), (), (3, 15, 21)),   # Libra
    ('MMMMFFFFFFFFFFMMMFFFFFFFFMMMMM', 'DDDBBBBBEEEEEEBBBBBBBBSSEEEEED', (9, 10, 22, 23, 27), (19, 28), (7, 18, 20)),   # Scorpio
    ('MMFFFMMMMMMMFFFFFFFFFFFFMMMMMM', 'BBBBBBBBBDDDBBBBBBBSSSSBBBBBBB', (7, 12, 15, 24, 27, 30), (1, 7, 8, 18, 19), (13, 20)),   # Sagittarius
    ('MMMMMMMMMMMFFFFFFFFMMMMMMMMMMM', 'DDDDDDDBBBSSSSSBBBBDDDEEEDDDDD', (7, 17, 22, 24, 29), (26, 27, 28, 29), (12, 13, 14, 20)),   # Capricorn
    ('MMMMMFFFFFFFFFFMMMMMMFFFFMMFFF', 'SSSSBBBBBDDDDBBBBBBBBEEEEBBBBB', (1, 12, 17, 22, 24, 29), (18, 19), (7, 16, 17, 20)),   # Aquarius
    ('MMMMMMMMMMFFFFFFFFFFMMMFFFFFMM', 'DDDDDDBBBBBBDDDDDDBBBBEEEBBBDD', (4, 9, 24, 27, 28), (), (13, 20)),   # Pisces
)


def degree_quality(lon, classic=True):
    if not classic:
        index = int(norm360(lon)) % 360
        sex, light, deep, lame, fortune = LILLY_DEGREES[index // 30]
        n = index % 30 + 1
        return {'sex': 'masculine' if sex[n - 1] == 'M' else 'feminine', 'lightA': LIGHT[light[n - 1]], 'lightB': None,
                'wells': 1 if n in deep else 0, 'fortune': 1 if n in fortune else 0, 'lame': n in lame, 'deep': n in deep,
                'school': 'lilly'}
    code = DEGREE_CODES[int(norm360(lon)) % 360]
    tail = code[3:]
    return {'sex': 'masculine' if code[0] == 'M' else 'feminine', 'lightA': LIGHT[code[1]], 'lightB': LIGHT[code[2]],
            'wells': tail.count('W'), 'fortune': tail.count('F'), 'lame': 'I' in tail, 'deep': 'A' in tail}


def _duodecimal(lon):
    return (int(lon // 30) + int((lon % 30) // 2.5)) % 12


def _novenaria(lon):
    sign = int(lon // 30) % 12
    return ([0, 9, 6, 3][sign % 4] + int((lon % 30) * 3.0 / 10.0)) % 12     # 乘后取整:座内 10°、20° 正好进下一格


def degree_rows(frame, view, faces_fn, classic=True):
    points = detail_points(frame, view)
    rows = []
    for name in BINDHU_POINTS:
        rows.append(dict(degree_quality(points[name], classic), point=name, lon=points[name]))
    cusp_rows = []
    for i, lon in enumerate(view.cusps):
        sign = const.LIST_SIGNS[int(lon // 30) % 12]
        cusp_rows.append(dict(degree_quality(lon, classic), house=i + 1, lon=lon, term=essential.term(sign, lon % 30),
                              face=faces_fn(lon), duodecimal=_duodecimal(lon), novenaria=_novenaria(lon), mansion=int(lon * 28.0 / 360.0) % 28 + 1))
    return {'points': rows, 'cusps': cusp_rows}


# ---------------------------------------------------------------------------
# 中点:黄经 / 世俗位置 / 赤经 / 方位角 / 赤纬 / 黄纬六种坐标
# ---------------------------------------------------------------------------
MIDPOINT_COORDS = ('ecliptic', 'mundane', 'ra', 'azimuth', 'declination', 'latitude')
MIDPOINT_POINTS = TEN + ('North Node', 'Asc', 'MC')


def _coord_values(frame, view, coord):
    points = detail_points(frame, view)
    out = {}
    geopos = (frame['geolon'], frame['phi'], 0.0)
    for name in MIDPOINT_POINTS:
        lon = points[name]
        lat = (frame['points'][name].get('lat', 0.0) or 0.0) if name in TEN else 0.0
        if coord == 'ecliptic':
            out[name] = lon
        elif coord == 'mundane':
            out[name] = 0.0 if name == 'Asc' else 270.0 if name == 'MC' else mundane_position(lon, lat, frame, view.cusps, 'proportional')
        elif coord in ('ra', 'declination'):
            ra, dec = swisseph.cotrans((lon, lat, 1.0), -frame['epsTrue'])[:2]
            out[name] = ra if coord == 'ra' else dec
        elif coord == 'azimuth':
            out[name] = norm360(swisseph.azalt(frame['jd'], swisseph.ECL2HOR, geopos, 0.0, 0.0, (lon, lat, 1.0))[0] + 180.0)
        else:
            out[name] = lat
    return out


def midpoints(frame, view, coord):
    coord = coord if coord in MIDPOINT_COORDS else 'ecliptic'
    values = _coord_values(frame, view, coord)
    circular = coord in ('ecliptic', 'mundane', 'ra', 'azimuth')
    rows = []
    for a, b in combinations(MIDPOINT_POINTS, 2):
        x, y = values[a], values[b]
        if circular:
            mid = norm360(x + fold180(y - x) / 2.0)
            total = norm360(x + y) if coord in ('ecliptic', 'mundane') else x + y
        else:
            mid = (x + y) / 2.0
            total = x + y
        row = {'a': a, 'b': b, 'midpoint': mid, 'sum': total}
        if coord == 'mundane':
            row['house'] = int(mid // 30) + 1
        rows.append(row)
    return {'coord': coord, 'rows': rows}


# ---------------------------------------------------------------------------
# 统计:15 点按元素、模式、守旺落陷、半球、象限、宫类、阴阳计数
# ---------------------------------------------------------------------------
STAT_POINTS = TEN + ('North Node', 'South Node', 'Asc', 'MC', 'Pars Fortuna')
ELEMENTS = ('fire', 'earth', 'air', 'water')
MODES = ('cardinal', 'fixed', 'mutable')


def chart_stats(frame, view):
    points = detail_points(frame, view)
    counts = {key: {} for key in ('element', 'mode', 'polarity', 'quadrant', 'hemisphereNS', 'hemisphereEW', 'houseType', 'sign', 'house', 'decan')}

    def add(group, key, name):
        counts[group].setdefault(key, []).append(name)
    for name in STAT_POINTS:
        lon = points[name]
        sign = int(lon // 30) % 12
        add('element', ELEMENTS[sign % 4], name)
        add('mode', MODES[sign % 3], name)
        add('polarity', 'masculine' if sign % 2 == 0 else 'feminine', name)
        add('sign', sign, name)
        add('decan', '%d-%d' % (sign, int((lon % 30) // 10) + 1), name)
        if name in ('Asc', 'MC'):
            continue
        h = _house_index(lon, view.cusps) + 1
        add('house', h, name)
        add('houseType', _house_type(h), name)
        add('quadrant', (h - 1) // 3 + 1, name)
        add('hemisphereNS', 'above' if h >= 7 else 'below', name)
        add('hemisphereEW', 'east' if h in (10, 11, 12, 1, 2, 3) else 'west', name)
    dign = {'ruler': [], 'exalt': [], 'detriment': [], 'fall': []}
    for name in ('Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'):
        sign = const.LIST_SIGNS[int(points[name] // 30) % 12]
        if essential.ruler(sign) == name:
            dign['ruler'].append(name)
        if essential.exalt(sign) == name:
            dign['exalt'].append(name)
        if essential.exile(sign) == name:
            dign['detriment'].append(name)
        if essential.fall(sign) == name:
            dign['fall'].append(name)
    counts['dignity'] = dign
    return counts


# ---------------------------------------------------------------------------
# 人体对应:星座管部位(从白羊管头起依次往下到双鱼管足),七星管器官与机能(古典通行说法)
# ---------------------------------------------------------------------------
ANATOMY_SIGNS = ('头、面', '颈、喉', '肩、臂、手', '胸、胃', '心、背', '腹、肠', '腰、肾、臀', '生殖、膀胱', '股、髋', '膝', '小腿、踝', '足')
ANATOMY_PLANETS = {
    'Saturn': '右耳、脾、膀胱、痰液、骨骼', 'Jupiter': '触觉、肺、动脉、精液', 'Mars': '左耳、肾、静脉、生殖器',
    'Sun': '视觉、脑、心、筋腱、身体右侧', 'Venus': '嗅觉、肝、肌肉', 'Mercury': '言语、思维、舌、胆汁、臀部',
    'Moon': '味觉与饮食、胃、腹、子宫、身体左侧',
}
ANATOMY_POINTS = ('Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Asc')


def anatomy_rows(points, cusps):
    rows = []
    for name in ANATOMY_POINTS:
        lon = points[name]
        sign = int(lon // 30) % 12
        rows.append({'point': name, 'sign': sign, 'region': ANATOMY_SIGNS[sign], 'organs': ANATOMY_PLANETS.get(name, ''),
                     'house': _house_index(lon, cusps) + 1})
    sixth = int(cusps[5] // 30) % 12
    return {'rows': rows, 'sixthCusp': {'sign': sixth, 'region': ANATOMY_SIGNS[sixth]},
            'signs': [{'sign': i, 'region': region} for i, region in enumerate(ANATOMY_SIGNS)]}
