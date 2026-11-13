"""诸方杂术:人类图(公开定义)与灵名字母(投字法)。

人类图
    位置一律回归黄经。设 λ′ = (λ − 302) mod 360,闸门序 i = ⌊λ′ / 5.625⌋,爻 = ⌊(λ′ mod 5.625) / 0.9375⌋ + 1。
    十三点:日、地(日 + 180)、北交、南交、月、水 ~ 冥。两组:个人 = 出生时刻;设计 = 太阳比出生时少 88° 弧的时刻(二分求解)。
    通道两头的闸门都被任一组点占到即成立;通道两端中心都算有定义。类型、权威、人生角色、轮回交叉按公开定义推。
灵名字母
    22 个希伯来字母按度循环投字:L(x) = ((⌊x⌋ − ⌊上升⌋) mod 360) mod 22,0 记 22(从上升度起顺黄道数度数)。福点按昼夜分式。
    度数主星(只看度数,与昼夜无关):守 1、旺 1、三分主三位各 1(多罗西,不分昼夜)、界 2(埃及界)、面 0,七星累分,
    最高者胜,平手按日月水金火木土取前。十一宫与象限四宫各取度数主星,字母按该星真实黄经投。
"""
import swisseph

import flatlib.ephem.swe  # noqa: F401  设星历路径
from flatlib import const
from flatlib.datetime import Datetime
from flatlib.dignities import tables

from astrostudy.astroextra_parts.common import base_params, to_bool

GATE_WHEEL = [41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3, 27, 24, 2, 23, 8, 20, 16, 35, 45, 12, 15, 52, 39, 53,
              62, 56, 31, 33, 7, 4, 29, 59, 40, 64, 47, 6, 46, 18, 48, 57, 32, 50, 28, 44, 1, 43, 14, 34, 9, 5, 26, 11, 10, 58, 38, 54, 61, 60]
WHEEL_START = 302.0
GATE_ARC = 5.625
LINE_ARC = GATE_ARC / 6.0
DESIGN_ARC = 88.0

CHANNELS = [(1, 8), (2, 14), (3, 60), (4, 63), (5, 15), (6, 59), (7, 31), (9, 52), (10, 20), (10, 34), (10, 57), (11, 56), (12, 22),
            (13, 33), (16, 48), (17, 62), (18, 58), (19, 49), (20, 34), (20, 57), (21, 45), (23, 43), (24, 61), (25, 51), (26, 44),
            (27, 50), (28, 38), (29, 46), (30, 41), (32, 54), (34, 57), (35, 36), (37, 40), (39, 55), (42, 53), (47, 64)]

CENTERS = {
    'head': [64, 61, 63],
    'ajna': [47, 24, 4, 17, 43, 11],
    'throat': [62, 23, 56, 35, 12, 45, 33, 8, 31, 20, 16],
    'g': [7, 1, 13, 25, 46, 2, 15, 10],
    'heart': [21, 40, 26, 51],
    'sacral': [34, 5, 14, 29, 59, 9, 3, 42, 27],
    'solar': [6, 37, 22, 36, 30, 55, 49],
    'spleen': [48, 57, 44, 50, 32, 28, 18],
    'root': [53, 60, 52, 19, 39, 41, 58, 38, 54],
}
CENTER_OF = {gate: center for center, gates in CENTERS.items() for gate in gates}
MOTORS = ('sacral', 'heart', 'solar', 'root')

HD_POINTS = ['Sun', 'Earth', 'North Node', 'South Node', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']
SWE_IDS = {'Sun': swisseph.SUN, 'Moon': swisseph.MOON, 'Mercury': swisseph.MERCURY, 'Venus': swisseph.VENUS, 'Mars': swisseph.MARS,
           'Jupiter': swisseph.JUPITER, 'Saturn': swisseph.SATURN, 'Uranus': swisseph.URANUS, 'Neptune': swisseph.NEPTUNE, 'Pluto': swisseph.PLUTO}
FLAGS = swisseph.FLG_SWIEPH | swisseph.FLG_SPEED


def norm360(x):
    return x % 360.0


def gate_line(lon):
    v = norm360(lon - WHEEL_START)
    index = int(v // GATE_ARC) % 64
    line = int((v % GATE_ARC) // LINE_ARC) + 1
    return GATE_WHEEL[index], min(line, 6)


def _sun_lon(jd):
    return swisseph.calc_ut(jd, swisseph.SUN, FLAGS)[0][0]


def design_jd(birth_jd):
    """太阳黄经比出生时少 88° 的时刻:太阳日行约 1°,在出生前 80~100 天内二分。"""
    target = norm360(_sun_lon(birth_jd) - DESIGN_ARC)

    def diff(jd):
        return (_sun_lon(jd) - target + 540.0) % 360.0 - 180.0

    lo, hi = birth_jd - 100.0, birth_jd - 80.0
    for _ in range(60):
        mid = (lo + hi) / 2.0
        if diff(mid) > 0:
            hi = mid
        else:
            lo = mid
    return (lo + hi) / 2.0


def positions(jd, true_node):
    out = {}
    for name, body in SWE_IDS.items():
        out[name] = swisseph.calc_ut(jd, body, FLAGS)[0][0]
    node = swisseph.calc_ut(jd, swisseph.TRUE_NODE if true_node else swisseph.MEAN_NODE, FLAGS)[0][0]
    out['North Node'] = node
    out['South Node'] = norm360(node + 180.0)
    out['Earth'] = norm360(out['Sun'] + 180.0)
    return out


def _activations(lons):
    rows = []
    for name in HD_POINTS:
        gate, line = gate_line(lons[name])
        rows.append({'id': name, 'lon': lons[name], 'gate': gate, 'line': line, 'center': CENTER_OF.get(gate)})
    return rows


def _components(defined, channels):
    """有定义中心经通道连成几块(定义型:一体 / 二分 / 三分 / 四分)。"""
    parent = {c: c for c in defined}

    def find(c):
        while parent[c] != c:
            parent[c] = parent[parent[c]]
            c = parent[c]
        return c

    for ch in channels:
        a, b = find(ch['centers'][0]), find(ch['centers'][1])
        if a != b:
            parent[a] = b
    return len({find(c) for c in defined})


def _connected(start_set, goal, channels):
    """从 start_set 里任一中心沿已成立的通道能否走到 goal。"""
    graph = {}
    for ch in channels:
        a, b = ch['centers']
        graph.setdefault(a, set()).add(b)
        graph.setdefault(b, set()).add(a)
    seen = set()
    stack = [c for c in start_set if c in graph]
    while stack:
        c = stack.pop()
        if c == goal:
            return True
        if c in seen:
            continue
        seen.add(c)
        stack.extend(graph.get(c, ()))
    return False


def human_design(data):
    data = data or {}
    params = base_params(data)
    birth = Datetime(params['date'], params['time'], params['zone']).jd
    true_node = to_bool(data.get('hdTrueNode'), True)
    djd = design_jd(birth)
    personality = _activations(positions(birth, true_node))
    design = _activations(positions(djd, true_node))
    gates = {row['gate'] for row in personality} | {row['gate'] for row in design}
    channels = []
    for a, b in CHANNELS:
        if a in gates and b in gates:
            channels.append({'gates': [a, b], 'centers': [CENTER_OF[a], CENTER_OF[b]]})
    defined = sorted({c for ch in channels for c in ch['centers']}, key=list(CENTERS).index)
    motors_defined = [c for c in MOTORS if c in defined]
    motor_to_throat = 'throat' in defined and _connected(motors_defined, 'throat', channels)
    if not defined:
        kind = 'reflector'
    elif 'sacral' in defined:
        kind = 'manifestingGenerator' if motor_to_throat else 'generator'
    elif motor_to_throat:
        kind = 'manifestor'
    else:
        kind = 'projector'
    if kind == 'reflector':
        authority = 'lunar'
    elif 'solar' in defined:
        authority = 'emotional'
    elif 'sacral' in defined:
        authority = 'sacral'
    elif 'spleen' in defined:
        authority = 'splenic'
    elif 'heart' in defined:
        authority = 'ego'
    elif 'g' in defined:
        authority = 'self'
    else:
        authority = 'mental'
    p_sun, p_earth = personality[0], personality[1]
    d_sun, d_earth = design[0], design[1]
    parts = _components(defined, channels) if defined else 0
    return {
        'birthJd': birth,
        'designJd': djd,
        'trueNode': true_node,
        'personality': personality,
        'design': design,
        'gates': sorted(gates),
        'channels': channels,
        'defined': defined,
        'type': kind,
        'authority': authority,
        'profile': [p_sun['line'], d_sun['line']],
        'cross': [p_sun['gate'], p_earth['gate'], d_sun['gate'], d_earth['gate']],
        'definition': parts,
    }


# ───────────────────────── 灵名字母 ─────────────────────────
HEBREW = [('Aleph', 'א'), ('Beth', 'ב'), ('Gimel', 'ג'), ('Daleth', 'ד'), ('He', 'ה'), ('Vav', 'ו'), ('Zayin', 'ז'), ('Cheth', 'ח'),
          ('Teth', 'ט'), ('Yod', 'י'), ('Kaph', 'כ'), ('Lamed', 'ל'), ('Mem', 'מ'), ('Nun', 'נ'), ('Samekh', 'ס'), ('Ayin', 'ע'),
          ('Pe', 'פ'), ('Tsade', 'צ'), ('Qoph', 'ק'), ('Resh', 'ר'), ('Shin', 'ש'), ('Tav', 'ת')]
SEVEN_ORDER = [const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS, const.JUPITER, const.SATURN]
QUADRANTS = {1: (1, 4, 7, 10), 2: (2, 5, 8, 11), 3: (3, 6, 9, 12)}


def letter_index(lon, asc):
    """从上升度起顺黄道数度数(0~359),每 22 度一轮。"""
    v = ((int(lon // 1) - int(asc // 1)) % 360) % 22
    return v or 22


def letter(index):
    name, glyph = HEBREW[(index - 1) % 22]
    return {'index': index, 'name': name, 'glyph': glyph}


def degree_almuten(lon):
    """按度数累分取主星:守 1、旺 1、三分主三位各 1、埃及界 2;平手按日月水金火木土取前。"""
    lon = norm360(lon)
    sign = const.LIST_SIGNS[int(lon // 30)]
    deg = lon % 30
    info = tables.ESSENTIAL_DIGNITIES[sign]
    score = {p: 0 for p in SEVEN_ORDER}

    def add(planet, value):
        if planet in score:
            score[planet] += value

    add(info['ruler'], 1)
    if info.get('exalt') and info['exalt'][0]:
        add(info['exalt'][0], 1)
    for planet in info.get('trip') or []:
        add(planet, 1)
    for planet, start, end in tables.EGYPTIAN_TERMS[sign]:
        if start <= deg < end:
            add(planet, 2)
            break
    best = max(SEVEN_ORDER, key=lambda p: (score[p], -SEVEN_ORDER.index(p)))
    return best, score[best]


def spirit_names(data):
    from astrostudy.perchart import PerChart
    from astrostudy.astroextra_parts.progressions import compute_prenatal_syzygy
    data = data or {}
    params = base_params(data)
    params['zodiacal'] = 0
    perchart = PerChart(params)
    chart = perchart.chart
    asc = chart.getAngle(const.ASC).lon
    houses = {int(str(h.id).replace('House', '')): h.lon for h in chart.houses}
    lon_of = {p: chart.getObject(p).lon for p in SEVEN_ORDER}
    sun, moon = lon_of[const.SUN], lon_of[const.MOON]
    fortune = norm360(asc + moon - sun) if perchart.isDiurnal else norm360(asc + sun - moon)
    syzygy = None
    try:
        syz = compute_prenatal_syzygy({'date': params['date'], 'time': params['time'], 'zone': params['zone']})
        syzygy = syz.get('moonLon') if syz else None
    except Exception:
        syzygy = None
    points = [('Sun', lon_of[const.SUN]), ('Moon', lon_of[const.MOON]), ('Asc', asc), ('Fortune', fortune), ('Syzygy', syzygy)]
    ibn_ezra = []
    for name, lon in points:
        if lon is None:
            ibn_ezra.append({'id': name, 'lon': None, 'letter': None})
            continue
        index = (int(asc // 1) % 22 or 22) if name == 'Asc' else letter_index(lon, asc)
        ibn_ezra.append({'id': name, 'lon': lon, 'letter': letter(index)})
    p11, s11 = degree_almuten(houses[11])
    eleventh = {'cusp': houses[11], 'almuten': p11, 'score': s11, 'lon': lon_of[p11], 'letter': letter(letter_index(lon_of[p11], asc))}
    try:
        quadrant = int(data.get('spiritQuadrant') or 1)
    except (TypeError, ValueError):
        quadrant = 1
    if quadrant not in QUADRANTS:
        quadrant = 1
    quad = []
    for house in QUADRANTS[quadrant]:
        planet, score = degree_almuten(houses[house])
        quad.append({'house': house, 'cusp': houses[house], 'almuten': planet, 'score': score, 'lon': lon_of[planet],
                     'letter': letter(letter_index(lon_of[planet], asc))})
    quad.sort(key=lambda row: -row['score'])           # 按得分从高到低,同分保持宫序(sort 稳定)
    return {'asc': asc, 'ibnEzra': ibn_ezra, 'eleventh': eleventh, 'quadrant': quadrant, 'quadrantRows': quad}


def build_zhufang(data):
    data = data or {}
    out = {}
    try:
        out['humanDesign'] = human_design(data)
    except Exception:
        out['humanDesign'] = None
    try:
        out['spiritNames'] = spirit_names(data)
    except Exception:
        out['spiritNames'] = None
    return out
