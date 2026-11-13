# -*- coding: utf-8 -*-
"""chart_details.py — 占星盘面细节表。

每张表是 {'key', 'columns', 'rows'} 或它的变体,前端按列类型渲染,AI 快照从同一份数据生成。
尊贵走 flatlib essential,随站内界系、三分的设置;面可选迦勒底式或按元素的三分式。
「经典」档保留传统算表的写法,缺省档取模、取对称,差别写在各函数说明里。
"""
import math
from itertools import combinations

import numpy
import swisseph
from flatlib import const
from flatlib.dignities import essential, tables as dignity_tables

from astrostudy.astroextra import compute_planetary_hours
from astrostudy.astroextra_parts.common import base_params
from astrostudy.astroextra_parts.progressions import compute_prenatal_syzygy
from astrostudy.directed_figures import _natal_from_request, norm360, SEVEN
from astrostudy.generalized_hours import build_hour_aspects
from astrostudy.lunar_cycles import fertility_dates, crisis_days
from astrostudy import chart_details_more as more
from astrostudy.perchart import push_classical_request, pop_classical_request
from astrostudy.timelord_tables import seasonal_hour_lord

SIGNS = const.LIST_SIGNS
OWN_SIGNS = {name: [i for i in range(12) if essential.ruler(SIGNS[i]) == name] for name in SEVEN}
MASCULINE_PLANETS = ('Sun', 'Mars', 'Jupiter', 'Saturn')
DIURNAL_PLANETS = ('Sun', 'Jupiter', 'Saturn')
CHAIN_LIMIT = 8
ASPECT_ANGLES = (0, 60, 90, 120, 180)
ELEMENT_FACES = (('Mars', 'Sun', 'Jupiter'), ('Venus', 'Mercury', 'Saturn'), ('Mercury', 'Venus', 'Saturn'), ('Moon', 'Mars', 'Jupiter'))
PERSIAN_HOUSE_SCORE = {1: 12, 2: 3, 3: 5, 4: 7, 5: 8, 6: 1, 7: 9, 8: 4, 9: 6, 10: 11, 11: 10, 12: 2}


def sign_of(lon):
    return int(norm360(lon) // 30)


def is_masculine_sign(lon):
    return sign_of(lon) % 2 == 0


def lord_of(lon):
    return essential.ruler(SIGNS[sign_of(lon)])


def face_of(lon, faces):
    """面:chaldean 迦勒底式;element 按元素,火:火日木 · 土:金水土 · 风:水金土 · 水:月火木,四座同一组。"""
    value = norm360(lon)
    sign = sign_of(value)
    decan = int((value % 30) // 10)
    if faces == 'element':
        return ELEMENT_FACES[sign % 4][decan]
    return dignity_tables.CHALDEAN_FACES[SIGNS[sign]][decan]


def dignities_of(lon, faces):
    value = norm360(lon)
    info = essential.getInfo(SIGNS[sign_of(value)], value % 30)
    info['face'] = face_of(value, faces)
    return info


def trip_lords(info):
    """三分主。托勒密三分只有两位,第三位是空串。"""
    return [name for name in (info['dayTrip'], info['nightTrip'], info['partTrip']) if name]


def sect_trip_lords(info, day):
    """本派在前,异派次之,共主最后。"""
    keys = ('dayTrip', 'nightTrip', 'partTrip') if day else ('nightTrip', 'dayTrip', 'partTrip')
    return [info[key] for key in keys if info[key]]


def house_of(lon, cusps):
    for i in range(12):
        if norm360(lon - cusps[i]) < norm360(cusps[(i + 1) % 12] - cusps[i]):
            return i + 1
    return 1


def house_ahead(lon, cusps, ahead=5.0):
    """宫头提前 5° 算落宫。"""
    return house_of(norm360(lon + ahead), cusps)


class ChartView:
    """一张盘算细节表要用到的量。"""

    # 落宫判据的宫头提前量:宫头前 5° 已算下一宫。整宫制(含福点整宫)宫即座,不提前。
    ahead = 5.0

    def __init__(self, frame, faces):
        self.frame = frame
        self.faces = faces
        points = frame['points']
        self.lons = {name: points[name]['lon'] for name in SEVEN}
        self.speeds = {name: points[name]['speed'] for name in SEVEN}
        self.asc = points['Asc']['lon']
        self.mc = points['MC']['lon']
        self.cusps = frame['cusps']
        chart = frame['perchart'].chart
        if all(getattr(house, 'hsys', None) == const.HOUSES_WHOLE_SIGN for house in chart.houses):
            self.ahead = 0.0
        self.day = chart.isDiurnal()        # 极圈内太阳不一定有升落,不能只比上升
        self.node = chart.get(const.NORTH_NODE).lon
        self.fortune = norm360(chart.get(const.PARS_FORTUNA).lon)
        self.spirit = norm360(2.0 * self.asc - self.fortune)
        self.sect_light = 'Sun' if self.day else 'Moon'
        self.other_light = 'Moon' if self.day else 'Sun'

    def house(self, name):
        return house_of(self.lons[name], self.cusps)

    def oriental(self, name):
        """东出:黄经落后太阳,先于太阳升起。"""
        return norm360(self.lons[name] - self.lons['Sun']) > 180.0

    def above(self, name):
        return norm360(self.lons[name] - self.asc) > 180.0

    def in_own(self, name):
        return essential.ruler(SIGNS[sign_of(self.lons[name])]) == name


# ---------------------------------------------------------------------------
# 名望判据:福、灵、旺、基四点的主星
# ---------------------------------------------------------------------------
EMINENCE_POINTS = (('F', '福点'), ('S', '灵点'), ('E', '旺点'), ('B', '基点'))


def eminence_points(view):
    sun, moon, asc = view.lons['Sun'], view.lons['Moon'], view.asc
    exalted = asc + 19.0 - sun if view.day else asc + 33.0 - moon
    gap = abs(view.fortune - view.spirit)
    return {'F': view.fortune, 'S': view.spirit, 'E': norm360(exalted), 'B': norm360(asc + min(gap, 360.0 - gap))}


def eminence_rows(view):
    """1~4 四点的主星落福点起第十座;其后每点一组:主星入本座,再看它是否落另外三点所在的座。"""
    points = eminence_points(view)
    rows = []
    tenth = (sign_of(view.fortune) + 9) % 12
    for key, label in EMINENCE_POINTS:
        lord = lord_of(points[key])
        rows.append({'id': len(rows) + 1, 'test': '%s主落福点起第十座' % label, 'lord': lord, 'hit': sign_of(view.lons[lord]) == tenth})
    for key, label in EMINENCE_POINTS:
        lord = lord_of(points[key])
        rows.append({'id': len(rows) + 1, 'test': '%s主入本座' % label, 'lord': lord, 'hit': view.in_own(lord)})
        for other, other_label in EMINENCE_POINTS:
            if other != key:
                rows.append({'id': len(rows) + 1, 'test': '%s主落%s所在座' % (label, other_label), 'lord': lord,
                             'hit': sign_of(view.lons[lord]) == sign_of(points[other])})
    return rows


# ---------------------------------------------------------------------------
# 波斯尊贵:本质分加宫位分
# ---------------------------------------------------------------------------
def persian_rows(view):
    rows = []
    for name in SEVEN:
        lon = view.lons[name]
        info = dignities_of(lon, view.faces)
        ruler = 5 if info['ruler'] == name else 0
        exalt = 4 if info['exalt'] == name else 0
        term = 3 if info['term'] == name else 0
        triplicity = 2 if name in trip_lords(info) else 0
        face = 1 if info['face'] == name else 0
        place = PERSIAN_HOUSE_SCORE[view.house(name)]
        rows.append({'planet': name, 'ruler': ruler, 'exalt': exalt, 'term': term, 'triplicity': triplicity, 'face': face, 'place': place,
                     'sum': ruler + exalt + term + triplicity + face + place})
    return rows


# ---------------------------------------------------------------------------
# 定位星链
# ---------------------------------------------------------------------------
def dispositor_chain(start, lons):
    """沿座主走,遇到走过的星写出来就停;遇到自守星就停。"""
    chain = [start]
    current = start
    for _ in range(CHAIN_LIMIT):
        following = lord_of(lons[current])
        if following == current:
            return chain, 'self'
        chain.append(following)
        if following in chain[:-1]:
            return chain, 'loop'
        current = following
    return chain, 'loop'


def dispositor_rows(view):
    return [dict(zip(('chain', 'end'), dispositor_chain(name, view.lons)), planet=name) for name in SEVEN]


def final_dispositor(rows):
    """七星都收敛到同一颗自守星时取它。"""
    ends = {row['chain'][-1] for row in rows if row['end'] == 'self'}
    return ends.pop() if len(ends) == 1 and all(row['end'] == 'self' for row in rows) else None


# ---------------------------------------------------------------------------
# 相位与日的十六相
# ---------------------------------------------------------------------------
PHASE_PLANETS = ('Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn')
INNER_PLANETS = ('Mercury', 'Venus')
MEAN_SPEEDS = {'Mercury': 0.9856, 'Venus': 0.9856, 'Mars': 0.5240, 'Jupiter': 0.0831, 'Saturn': 0.0335}
HEART_ORB = 0.2667
COMBUST_ORB = 7.0
BEAMS_ORB = 15.0
STATION_RATIO = 0.05
BEAMS_WINDOW_DAYS = 7
STATION_SEARCH_DAYS = 800
OUTER_PHASES = {1: '日心', 2: '东方焦伤', 3: '东方光束', 4: '东方最强', 5: '东方强', 6: '东方转弱', 7: '初留', 8: '东方逆行', 9: '冲',
                10: '西方逆行', 11: '次留', 12: '西方最强', 13: '西方强', 14: '西方弱', 15: '西方光束', 16: '西方焦伤'}
INNER_PHASES = {1: '日心·逆行', 2: '东方逆行焦伤', 3: '东方逆行光束', 4: '东方逆行', 5: '东方留(后留)', 6: '东方顺行', 7: '东方顺行光束', 8: '东方顺行焦伤',
                9: '日心·顺行', 10: '西方顺行焦伤', 11: '西方顺行光束', 12: '西方顺行', 13: '西方留(初留)', 14: '西方逆行', 15: '西方逆行光束', 16: '西方逆行焦伤'}
BODY_IDS = {'Sun': swisseph.SUN, 'Moon': swisseph.MOON, 'Mercury': swisseph.MERCURY, 'Venus': swisseph.VENUS, 'Mars': swisseph.MARS,
            'Jupiter': swisseph.JUPITER, 'Saturn': swisseph.SATURN}


def fold180(value):
    return ((value + 180.0) % 360.0) - 180.0


def sun_grade(gap):
    if gap <= HEART_ORB:
        return 'heart'
    if gap <= COMBUST_ORB:
        return 'combust'
    return 'beams' if gap <= BEAMS_ORB else 'free'


def time_position(ra, dec, armc, phi):
    """盘中时位:升起 0,上中天 6,落下 12,下中天 18。半昼弧按纬度,不是等分。"""
    hour = fold180(armc - ra)
    tangent = math.tan(math.radians(phi)) * math.tan(math.radians(dec))
    semi = 90.0 + math.degrees(math.asin(max(-1.0, min(1.0, tangent))))
    if abs(hour) < semi:
        return 6.0 + 6.0 * hour / semi
    if hour >= semi:
        return 12.0 + 6.0 * (hour - semi) / (180.0 - semi)
    return 12.0 + 6.0 * (hour + 360.0 - semi) / (180.0 - semi)


def sun_phase(name, elongation, ratio, hours):
    """十六相编号。elongation = 星 − 日,东方为负;hours = 与太阳的时位差。"""
    gap = abs(elongation)
    east = elongation < 0
    station = abs(ratio) <= STATION_RATIO
    retrograde = ratio < 0 and not station
    grade = sun_grade(gap)
    outer = name not in INNER_PLANETS
    if station and grade in ('free', 'beams'):
        if outer:
            return 7 if east else 11
        return 5 if east else 13
    if outer:
        if gap >= 180.0 - HEART_ORB:
            return 9
        if grade == 'heart':
            return 1
        if grade == 'combust':
            return 2 if east else 16
        if grade == 'beams':
            return 3 if east else 15
        if retrograde:
            return 8 if east else 10
        step = 0 if hours < 4.0 else (1 if hours < 6.0 else 2)
        return 4 + step if east else 14 - step
    if grade == 'heart':
        return 1 if retrograde else 9
    if retrograde:
        return {'combust': 2, 'beams': 3, 'free': 4}[grade] if east else {'combust': 16, 'beams': 15, 'free': 14}[grade]
    return {'combust': 8, 'beams': 7, 'free': 6}[grade] if east else {'combust': 10, 'beams': 11, 'free': 12}[grade]


def _elongation_at(name, jd):
    body = swisseph.calc_ut(jd, BODY_IDS[name], swisseph.FLG_SWIEPH)[0][0]
    return fold180(body - swisseph.calc_ut(jd, swisseph.SUN, swisseph.FLG_SWIEPH)[0][0])


def beams_change(name, jd):
    """七天内出入日光束。"""
    inside = abs(_elongation_at(name, jd)) <= BEAMS_ORB
    for day in range(1, BEAMS_WINDOW_DAYS + 1):
        if (abs(_elongation_at(name, jd + day)) <= BEAMS_ORB) != inside:
            return 'emerges' if inside else 'enters'
    return None


def next_station(name, jd):
    """下一次留的时刻与转向后的方向。"""
    def speed(when):
        return swisseph.calc_ut(when, BODY_IDS[name], swisseph.FLG_SWIEPH | swisseph.FLG_SPEED)[0][3]

    low = jd
    start = speed(low)
    for day in range(1, STATION_SEARCH_DAYS):
        high = jd + day
        if (speed(high) < 0.0) != (start < 0.0):
            for _ in range(40):
                mid = (low + high) / 2.0
                if (speed(mid) < 0.0) == (start < 0.0):
                    low = mid
                else:
                    high = mid
            return high, 'retrograde' if start >= 0.0 else 'direct'
        low = high
    return None, None


def cardan_phase(east, ratio):
    """外行星六相:东方顺行快、慢,初留到冲,冲到次留,次留后慢,西方顺行快。留算进逆行段。"""
    if ratio < STATION_RATIO:
        return 3 if east else 4
    if east:
        return 1 if ratio >= 1.0 else 2
    return 6 if ratio >= 1.0 else 5


def sun_phase_rows(view):
    frame = view.frame
    jd = frame['jd']
    armc = frame['armc']
    phi = frame['phi']

    def hours_of(body):
        ra, dec = swisseph.calc_ut(jd, BODY_IDS[body], swisseph.FLG_SWIEPH | swisseph.FLG_EQUATORIAL)[0][:2]
        return time_position(ra, dec, armc, phi)

    sun_hours = hours_of('Sun')
    rows = []
    for name in PHASE_PLANETS:
        elongation = fold180(view.lons[name] - view.lons['Sun'])
        speed = view.speeds[name]
        ratio = speed / MEAN_SPEEDS[name]
        gap = abs(hours_of(name) - sun_hours) % 24.0
        hours = 24.0 - gap if gap > 12.0 else gap
        phase = sun_phase(name, elongation, ratio, hours)
        east = elongation < 0
        grade = sun_grade(abs(elongation))
        outer = name not in INNER_PLANETS
        station_jd, turn = next_station(name, jd)
        rows.append({
            'planet': name, 'phase': phase, 'phaseName': (INNER_PHASES if not outer else OUTER_PHASES)[phase], 'elongation': elongation,
            'hours': hours, 'ratio': ratio, 'grade': grade, 'east': east, 'motion': 'station' if abs(ratio) <= STATION_RATIO else ('retrograde' if ratio < 0 else 'direct'),
            'sacred': None if grade == 'free' else ('sacred' if east else 'profane'), 'beams': beams_change(name, jd),
            'cardan': cardan_phase(east, ratio) if outer else None, 'currens': ('currens' if east else 'recurrens') if outer else None,
            'nextStation': frame['dateOf'](station_jd) if station_jd else None, 'nextTurn': turn})
    return rows


# ---------------------------------------------------------------------------
# 昼夜派
# ---------------------------------------------------------------------------
ALMUGEA_STEPS = {'Mercury': 1, 'Venus': 2, 'Mars': 3, 'Jupiter': 4, 'Saturn': 5}
UPPER_LOWER_MASCULINE = (4, 5, 6, 10, 11, 12)
UPPER_LOWER_FEMININE = (1, 2, 3, 7, 8, 9)


def is_diurnal_planet(view, name):
    return name in DIURNAL_PLANETS or (name == 'Mercury' and view.oriental(name))


def is_masculine_planet(view, name):
    return name in MASCULINE_PLANETS or (name == 'Mercury' and view.oriental(name))


def almugea(view, name, classic=False):
    """与日或月隔该星固定的座数,且星在月之前或日之后。缺省座差取模;经典档用原始差,跨白羊 0° 不成立。"""
    steps = ALMUGEA_STEPS.get(name)
    if steps is None:
        return False
    lon = view.lons[name]
    planet, sun, moon = sign_of(lon), sign_of(view.lons['Sun']), sign_of(view.lons['Moon'])

    def apart(a, b):
        return abs(a - b) if classic else min((a - b) % 12, (b - a) % 12)

    if apart(planet, sun) == steps:
        return norm360(lon - view.lons['Moon']) > 180.0
    if apart(planet, moon) == steps:
        return norm360(lon - view.lons['Sun']) < 180.0
    return False


def dustoria(view, name):
    """夜盘,星在 1、4、7 宫,月亮在其后第四宫。"""
    if view.day or name == 'Moon':
        return False
    house = view.house(name)
    return house in (1, 4, 7) and view.house('Moon') == house + 4


def sect_rows(view, classic=False):
    rows = []
    for name in SEVEN:
        house = view.house(name)
        above = view.above(name)
        diurnal = is_diurnal_planet(view, name)
        if name == 'Sun':
            horizon = view.day and above
        else:
            horizon = (above == view.day) if diurnal else (above != view.day)
        masculine = is_masculine_planet(view, name)
        in_sign = is_masculine_sign(view.lons[name]) == masculine
        quadrant = house in (UPPER_LOWER_MASCULINE if masculine else UPPER_LOWER_FEMININE)
        info = dignities_of(view.lons[name], view.faces)
        lords = sect_trip_lords(info, view.day)
        rows.append({'planet': name, 'east': name == 'Sun' or view.oriental(name), 'horizon': horizon, 'sign': in_sign, 'quadrant': quadrant,
                     'hayz': horizon and in_sign and quadrant, 'ex': not (horizon or in_sign or quadrant), 'almugea': almugea(view, name, classic),
                     'dustoria': dustoria(view, name), 'triplicity': lords})
    return rows


# ---------------------------------------------------------------------------
# 互容与同位
# ---------------------------------------------------------------------------
RECEPTION_TYPES = {1: '守护互容', 2: '擢升互容', 3: '三分互容', 4: '界互容', 5: '面互容', 6: '陷互容', 7: '落互容', 8: '同主', 9: '同光', 10: '同升'}


def reception_tests(view):
    faces = view.faces
    info = {name: dignities_of(view.lons[name], faces) for name in SEVEN}
    keys = {1: 'ruler', 2: 'exalt', 4: 'term', 5: 'face', 6: 'exile', 7: 'fall'}
    tests = {}
    for rid, key in keys.items():
        tests[rid] = lambda a, b, k=key: info[a][k] == b and info[b][k] == a
    trip = 'dayTrip' if view.day else 'nightTrip'
    tests[3] = lambda a, b: info[a][trip] == b and info[b][trip] == a
    sign = {name: sign_of(view.lons[name]) for name in SEVEN}
    tests[8] = lambda a, b: info[a]['ruler'] == info[b]['ruler']
    tests[9] = lambda a, b: (sign[a] + sign[b]) % 12 == 5
    tests[10] = lambda a, b: (sign[a] + sign[b]) % 12 == 11
    return tests


def reception_rows(view):
    tests = reception_tests(view)
    rows = []
    for rid in sorted(tests):
        for i, a in enumerate(SEVEN):
            for b in SEVEN[i + 1:]:
                if tests[rid](a, b):
                    rows.append({'type': rid, 'name': RECEPTION_TYPES[rid], 'a': a, 'b': b})
    return rows


# ---------------------------------------------------------------------------
# 相位公用
# ---------------------------------------------------------------------------
PLANET_RADII = {'Sun': 7.5, 'Moon': 6.0, 'Mercury': 3.5, 'Venus': 4.0, 'Mars': 3.5, 'Jupiter': 4.5, 'Saturn': 4.5}
DEFAULT_ORBS = {0: 10.0, 60: 5.5, 90: 7.0, 120: 8.0, 180: 10.0}
PERFECT_ARCMIN = 3.0 / 60.0


def separation(a, b):
    return abs(fold180(a - b))


def closest_aspect(a, b):
    gap = separation(a, b)
    angle = min(ASPECT_ANGLES, key=lambda x: abs(gap - x))
    return angle, abs(gap - angle)


def approaching(view, a, b, angle, perfect=0.0):
    """距离差 d − 相位 与距离变化率异号即入相位。"""
    signed = fold180(view.lons[a] - view.lons[b])
    rate = (view.speeds[a] - view.speeds[b]) * (1.0 if signed >= 0 else -1.0)
    offset = abs(signed) - angle
    if abs(offset) < perfect:
        return False
    return offset * rate < 0


# ---------------------------------------------------------------------------
# 判前考量
# ---------------------------------------------------------------------------
CONSIDERATIONS = {1: '行星时主与上升无关联', 2: '上升不足 3°', 3: '上升过 27°', 4: '月亮过 27°', 5: '月亮在燃烧之路', 6: '月亮空亡', 7: '土星在第 1 宫',
                  8: '土星在第 7 宫', 9: '上升主在日旁', 10: '七宫主在果宫', 11: '七宫主受火土', 12: '七宫主逆行', 13: '火星临七宫头(合、刑、冲 1.5° 内)'}
HARD_ANGLES = (0, 90, 180)


def moon_void(view):
    """月亮离开本座前不再与七星成主相位。"""
    moon = view.lons['Moon']
    left = 30.0 - moon % 30.0
    days = left / max(view.speeds['Moon'] - 0.0, 1e-6)
    for name in SEVEN:
        if name == 'Moon':
            continue
        start = fold180(moon - view.lons[name])
        moved = left - view.speeds[name] * days
        for angle in ASPECT_ANGLES:
            for target in ((angle, -angle) if 0 < angle < 180 else (angle,)):
                if 1e-9 < norm360(target - start) <= moved:
                    return False
    return True


def hour_lord_related(hour, lord, asc):
    info = dignities_of(asc, 'chaldean')
    return hour == lord or hour in trip_lords(info) or 'Mercury' in (hour, lord) or {hour, lord} in ({'Sun', 'Mars'}, {'Venus', 'Jupiter'})


def consideration_rows(view, hour_lord):
    asc, cusps = view.asc, view.cusps
    moon = view.lons['Moon']
    lord1 = lord_of(asc)
    lord7 = lord_of(cusps[6])
    hits = {
        1: not hour_lord_related(hour_lord, lord1, asc), 2: asc % 30.0 < 3.0, 3: asc % 30.0 > 27.0, 4: moon % 30.0 > 27.0, 5: 195.0 <= moon < 225.0,
        6: moon_void(view), 7: house_ahead(view.lons['Saturn'], cusps, view.ahead) == 1, 8: house_ahead(view.lons['Saturn'], cusps, view.ahead) == 7,
        9: lord1 != 'Sun' and CAZIMI_LIMIT < separation(view.lons[lord1], view.lons['Sun']) < COMBUST_LIMIT, 10: view.house(lord7) in (3, 6, 9, 12),
        12: view.speeds[lord7] < 0,
        13: any(abs(separation(view.lons['Mars'], cusps[6]) - angle) <= 1.5 for angle in HARD_ANGLES),
    }
    hits[11] = False
    for malefic in ('Mars', 'Saturn'):
        if malefic != lord7:
            orb = max(8.5, PLANET_RADII[lord7] + PLANET_RADII[malefic])
            gap = separation(view.lons[lord7], view.lons[malefic])
            hits[11] = hits[11] or any(abs(gap - angle) <= orb for angle in HARD_ANGLES)
    return [{'id': rid, 'test': CONSIDERATIONS[rid], 'hit': bool(hits[rid])} for rid in sorted(CONSIDERATIONS)]


# ---------------------------------------------------------------------------
# 奴役判据
# ---------------------------------------------------------------------------
CADENT = (3, 6, 9, 12)
ANGULAR_SUCCEDENT = (1, 2, 4, 5, 7, 8, 10, 11)


def _essential_of(name, lon, view):
    info = dignities_of(lon, view.faces)
    return name in (info['ruler'], info['exalt'], info['term'], info['face']) or name in trip_lords(info)


def slavery_rows(view):
    lights = ('Sun', 'Moon')
    rulers = [lord_of(view.lons[name]) for name in lights]

    def debilitated(name):
        info = dignities_of(view.lons[name], view.faces)
        return name in (info['exile'], info['fall'])

    def listing(names, test):
        return [name for name in names if test(name)]

    applying = []
    for light in lights:
        for malefic in ('Mars', 'Saturn'):
            gap = separation(view.lons[light], view.lons[malefic])
            for angle in HARD_ANGLES:
                if abs(gap - angle) <= DEFAULT_ORBS[angle] and approaching(view, light, malefic, angle):
                    applying.append(light)
    return [
        {'id': 1, 'test': '太阳在果宫', 'planets': listing(['Sun'], lambda p: view.house(p) in CADENT)},
        {'id': 2, 'test': '月亮在果宫', 'planets': listing(['Moon'], lambda p: view.house(p) in CADENT)},
        {'id': 3, 'test': '日、月、金、木在地平线下', 'planets': listing(['Sun', 'Moon', 'Venus', 'Jupiter'], lambda p: 2 <= view.house(p) <= 6)},
        {'id': 4, 'test': '火、土在角宫或续宫', 'planets': listing(['Mars', 'Saturn'], lambda p: view.house(p) in ANGULAR_SUCCEDENT)},
        {'id': 5, 'test': '金、木在果宫', 'planets': listing(['Venus', 'Jupiter'], lambda p: view.house(p) in CADENT)},
        {'id': 6, 'test': '日月定位星在果宫', 'planets': listing(rulers, lambda p: view.house(p) in CADENT)},
        {'id': 7, 'test': '日月定位星落或陷', 'planets': listing(rulers, debilitated)},
        {'id': 8, 'test': '日月定位星游走', 'planets': listing(rulers, lambda p: not _essential_of(p, view.lons[p], view) and not debilitated(p))},
        {'id': 9, 'test': '日或月入相位火、土', 'planets': sorted(set(applying), key=lights.index)},
    ]


# ---------------------------------------------------------------------------
# 希腊化细节
# ---------------------------------------------------------------------------
BAD_HOUSES = (3, 6, 8, 12)


def hellenistic_row(view):
    """主星:本派光体在吉位取它,否则另一光体,都不在取上升。"""
    if view.house(view.sect_light) not in BAD_HOUSES:
        predominator = view.sect_light
    elif view.house(view.other_light) not in BAD_HOUSES:
        predominator = view.other_light
    else:
        predominator = 'Asc'
    lon = view.asc if predominator == 'Asc' else view.lons[predominator]
    info = dignities_of(lon, view.faces)
    return {'predominator': predominator, 'triplicity': sect_trip_lords(info, view.day), 'oversight': info['term'], 'domicile': info['ruler'],
            'nextMoon': lord_of(view.lons['Moon'] + 30.0), 'sectTerm': dignities_of(view.lons[view.sect_light], view.faces)['term']}


# ---------------------------------------------------------------------------
# 行星关系
# ---------------------------------------------------------------------------
ADVANCE_HOUSES = (1, 2, 4, 5, 7, 8, 10, 11)
ADVANCE_HOUSES_B = (1, 4, 5, 7, 9, 10, 11)
RELATION_NAMES = {1: '喜乐之位', 2: '前进(甲说)', 3: '后退(甲说)', 4: '前进(乙说)', 5: '后退(乙说)', 6: '推进本性', 7: '推进力量', 8: '相位互容', 9: '整座互容', 10: '慷慨'}


def in_hayz(view, name):
    """喜乐之位:昼夜、阴阳座与象限三项都合。水星东出随木土,西入随月金;太阳只在昼盘。"""
    house = view.house(name)
    above = view.above(name)
    masculine_sign = is_masculine_sign(view.lons[name])
    if name == 'Sun':
        return view.day and above and masculine_sign and 10 <= house <= 12
    group = name
    if name == 'Mercury':
        group = 'Jupiter' if view.oriental(name) else 'Moon'
    if group in ('Jupiter', 'Saturn'):
        return above == view.day and masculine_sign and house in UPPER_LOWER_MASCULINE
    if group in ('Moon', 'Venus'):
        return above != view.day and not masculine_sign and house in UPPER_LOWER_FEMININE
    return above != view.day and masculine_sign and house in UPPER_LOWER_MASCULINE


def current_dignities(view, name, lon):
    """某星在 lon 处的尊贵,三分只算当令一位。"""
    info = dignities_of(lon, view.faces)
    trip = info['dayTrip'] if view.day else info['nightTrip']
    return name in (info['ruler'], info['exalt'], trip, info['term'], info['face'])


def pushing_power_pairs(view):
    """前一星在自己的尊贵里,入相位后一星,容许度为两星半径和。"""
    pairs = []
    for i, a in enumerate(SEVEN):
        if not current_dignities(view, a, view.lons[a]):
            continue
        for b in SEVEN[i + 1:]:
            angle, orb = closest_aspect(view.lons[a], view.lons[b])
            if orb <= PLANET_RADII[a] + PLANET_RADII[b] and approaching(view, a, b, angle):
                pairs.append((a, b))
    return pairs


def pushing_nature_pairs(view):
    """每星按星序找第一颗「本星落在它的尊贵里且成相位」的星就定案,入相位才记,分离的那颗也占位。"""
    pairs = []
    for i, a in enumerate(SEVEN):
        for j, b in enumerate(SEVEN):
            if a == b:
                continue
            info = dignities_of(view.lons[a], view.faces)
            if b not in (info['ruler'], info['exalt'], info['term'], info['face']) and b not in trip_lords(info):
                continue
            angle, orb = closest_aspect(view.lons[a], view.lons[b])
            if orb > DEFAULT_ORBS[angle]:
                continue
            own = _essential_of(a, view.lons[a], view)
            if approaching(view, a, b, angle, PERFECT_ARCMIN) and not (i < j and own):
                pairs.append((a, b))
            break
    return pairs


def mutual_ruler_pairs(view):
    """互为宫主的两星:座差 2、4 看容许度,成相位是相位互容,否则整座互容;座差 1、3、5、6 是慷慨。"""
    out = {8: [], 9: [], 10: []}
    for i, a in enumerate(SEVEN):
        for b in SEVEN[i + 1:]:
            if lord_of(view.lons[a]) != b or lord_of(view.lons[b]) != a:
                continue
            apart = min((sign_of(view.lons[a]) - sign_of(view.lons[b])) % 12, (sign_of(view.lons[b]) - sign_of(view.lons[a])) % 12)
            if apart in (2, 4):
                orb = abs(separation(view.lons[a], view.lons[b]) - (60.0 if apart == 2 else 120.0))
                out[8 if orb <= PLANET_RADII[a] + PLANET_RADII[b] else 9].append((a, b))
            else:
                out[10].append((a, b))
    return out


def relation_rows(view):
    groups = {1: [n for n in SEVEN if in_hayz(view, n)]}
    for rid, houses in ((2, ADVANCE_HOUSES), (4, ADVANCE_HOUSES_B)):
        groups[rid] = [n for n in SEVEN if view.house(n) in houses]
        groups[rid + 1] = [n for n in SEVEN if view.house(n) not in houses]
    groups[6] = pushing_nature_pairs(view)
    groups[7] = pushing_power_pairs(view)
    groups.update(mutual_ruler_pairs(view))
    return [{'id': rid, 'name': RELATION_NAMES[rid], 'items': groups[rid]} for rid in sorted(groups)]


# ---------------------------------------------------------------------------
# 偶然尊贵总分与命主星
# ---------------------------------------------------------------------------
HOUSE_POINTS = {1: 5, 10: 5, 4: 4, 7: 4, 11: 4, 2: 3, 5: 3, 9: 2, 3: 1, 6: -2, 8: -2, 12: -5}
MEAN_DAILY = {'Sun': 0.9845, 'Moon': 13.18, 'Mercury': 0.985, 'Venus': 0.98, 'Mars': 0.6167, 'Jupiter': 0.0816, 'Saturn': 0.0336}
BESIEGE_ORBS = {'Sun': 15.0, 'Moon': 12.0, 'Mercury': 7.0, 'Venus': 8.0, 'Jupiter': 9.0}
RETRO_ORBS = {'Mercury': 7.0, 'Venus': 8.0, 'Mars': 7.0, 'Jupiter': 9.0, 'Saturn': 9.0}
PARTILE_POINTS = (('Mars', 90, -3), ('Saturn', 90, -3), ('Mars', 180, -4), ('Saturn', 180, -4), ('Jupiter', 0, 5), ('Venus', 0, 5), ('Jupiter', 60, 3), ('Venus', 60, 3),
                  ('Jupiter', 120, 4), ('Venus', 120, 4))
ROYAL_STARS = (('Regulus', 6), ('Spica', 5), ('Algol', -5))
ROYAL_STAR_ORB = 5.0
CAZIMI_LIMIT = 17.0 / 60.0
COMBUST_LIMIT = 8.5
BEAMS_LIMIT = 17.0


def partile(a, b, angle):
    """同度相位:座内整数度相同,且星座距合乎相位。"""
    steps = min((sign_of(a) - sign_of(b)) % 12, (sign_of(b) - sign_of(a)) % 12)
    return int(norm360(a) % 30) == int(norm360(b) % 30) and steps * 30 == angle


def besieged(view, name):
    """被火、土夹在两侧,夹弧小于 180°,且较近的一颗在该星容许度内。"""
    orb = BESIEGE_ORBS.get(name)
    if orb is None:
        return False
    lon = view.lons[name]
    ahead_mars = norm360(view.lons['Mars'] - lon)
    ahead_saturn = norm360(view.lons['Saturn'] - lon)
    if (ahead_mars < 180.0) == (ahead_saturn < 180.0):
        return False
    forward = min(ahead_mars, ahead_saturn)
    backward = 360.0 - max(ahead_mars, ahead_saturn)
    return forward + backward < 180.0 and min(forward, backward) <= orb


def direct_points(view, name, classic):
    """顺行 +4。经典档:按合、六合、刑、拱、冲逐个看,第一个与日或月在容许度内的相位若正走向日或月就记 0。"""
    if not classic:
        return 4
    orb = RETRO_ORBS[name]
    for angle in ASPECT_ANGLES:
        near = [light for light in ('Sun', 'Moon') if abs(separation(view.lons[name], view.lons[light]) - angle) <= orb]
        if near:
            return 0 if any(approaching(view, name, light, angle) for light in ('Sun', 'Moon')) else 4
    return 4


def royal_star_points(view, name):
    """恒星分:大陵五 5° 内,轩辕十四与角宿一要同度。"""
    total = 0
    for star, points in ROYAL_STARS:
        at = swisseph.fixstar2_ut(star, view.frame['jd'], swisseph.FLG_SWIEPH)[0][0]
        lon = view.lons[name]
        if separation(lon, at) <= ROYAL_STAR_ORB if star == 'Algol' else partile(lon, at, 0):
            total += points
    return total


# 改进档按 Lilly 偶然尊贵表补齐经典档没有的三项:离日 17° 以外(不受灼伤也不在日光下)+5;
# 水、金东出 −2(西入 +2);与火、土正合 −5。
PARTILE_MALEFIC_CONJUNCTION = (('Mars', 0, -5), ('Saturn', 0, -5))


def sun_points(gap, classic=True):
    """日心 +5,灼伤 −5,日光下 −4;离日光以外经典档记 0,改进档 +5。"""
    if gap <= CAZIMI_LIMIT:
        return 5
    if gap <= COMBUST_LIMIT:
        return -5
    if gap <= BEAMS_LIMIT:
        return -4
    return 0 if classic else 5


def accidental_rows(view, classic=False):
    node = view.node
    south = norm360(node + 180.0)
    rows = []
    for name in SEVEN:
        lon = view.lons[name]
        row = {'planet': name, 'house': HOUSE_POINTS[house_ahead(lon, view.cusps, view.ahead)], 'speed': 2 if abs(view.speeds[name]) >= MEAN_DAILY[name] else -2}
        if name in ('Sun', 'Moon'):
            row['retro'] = 0
            row['orient'] = 0
        else:
            row['retro'] = -5 if view.speeds[name] < 0 else direct_points(view, name, classic)
            east = view.oriental(name)
            if name in INNER_PLANETS:
                row['orient'] = (0 if classic else -2) if east else 2
            else:
                row['orient'] = 2 if east else -2
        gap = separation(lon, view.lons['Sun'])
        row['sun'] = 0 if name == 'Sun' else sun_points(gap, classic)
        row['besieged'] = -5 if besieged(view, name) else 0
        table = PARTILE_POINTS if classic else PARTILE_POINTS + PARTILE_MALEFIC_CONJUNCTION
        row['partile'] = sum(points for other, angle, points in table if other != name and partile(lon, view.lons[other], angle))
        row['partile'] += (-4 if partile(lon, south, 0) else 0) + (4 if partile(lon, node, 0) else 0)
        row['stars'] = royal_star_points(view, name)
        row['moonlight'] = 0
        if name == 'Moon':
            row['moonlight'] = 2 if norm360(lon - view.lons['Sun']) < 180.0 else -2
        info = dignities_of(lon, view.faces)
        trip = name in trip_lords(info)
        essential_hits = [info['ruler'] == name, info['exalt'] == name, trip, info['term'] == name, info['face'] == name]
        exile, fall = info['exile'] == name, info['fall'] == name
        row['peregrine'] = not any(essential_hits) and not exile and not fall
        row['essential'] = sum(essential_hits) - exile - fall - row['peregrine']
        row['sum'] = row['essential'] + sum(row[key] for key in ('house', 'speed', 'retro', 'orient', 'sun', 'besieged', 'partile', 'stars', 'moonlight'))
        rows.append(row)
    return rows


def lord_of_geniture(rows):
    """总分最大者。平手按星序取前。"""
    return max(rows, key=lambda row: row['sum'])['planet']


# ---------------------------------------------------------------------------
# 寿主十一派与寿主星
# ---------------------------------------------------------------------------
HYLEG_G5 = (1, 7, 9, 10, 11)
HYLEG_G8 = (1, 2, 4, 5, 7, 8, 10, 11)
# 派:太阳在上半球(不问座 / 要阳性座或阳象限)· 在下半球(同) · 月亮的宫
HYLEG_GEOMETRIC = {
    'ptolemy': (((1, 7, 9, 10, 11), ()), ((4, 5, 7), (1,)), (1, 2, 4, 5, 7, 8, 9, 10, 11)),
    'paulus': (((1, 7, 9, 10, 11), (8,)), ((4, 5, 7), (1, 2)), (1, 2, 4, 5, 7, 8, 9, 10, 11)),
    'dorotheus': (((1, 7, 10, 11), (8,)), ((4, 5, 7), (1, 2)), (1, 2, 4, 5, 7, 8, 10, 11)),
    'hermes': (((1, 10, 11), (7, 9)), ((4, 5, 7), (1, 3)), (1, 2, 3, 4, 5, 7, 8, 9, 10, 11)),
    'zoroaster': (((1, 7, 10, 11), ()), ((4, 5, 7), (1,)), (1, 2, 4, 5, 7, 8, 9, 10, 11)),
}
# 改进档的托勒密派按《四书》原文:放生之位只有 1(地平上 5° 至地平下 25°)、11、10、9、7 宫,日月与福点、朔望点都只在这五处取;
# 地平以下的 4、5 宫等不算。经典档保留旧表(太阳在下半球时 4、5、7 宫亦取,月与朔望点放宽到 8 宫)。
HYLEG_PTOLEMY_STRICT = (((1, 7, 9, 10, 11), ()), ((1, 7, 9, 10, 11), ()), HYLEG_G5)
HYLEG_SCHOOLS = (('ptolemy', '托勒密'), ('paulus', '保罗'), ('dorotheus', '多罗修斯'), ('hermes', '赫尔墨斯'), ('zoroaster', '琐罗亚斯德'), ('valens', '瓦伦斯'),
                 ('ezra', '以斯拉'), ('lilly', '利利'), ('hay', '哈里'), ('omar', '奥马尔'), ('bonatti', '博纳提'))
WITNESS_ORBS_FIXED = {0: 9.0, 60: 6.0, 90: 8.0, 120: 8.0, 180: 9.0}
ZOROASTER_HARD = {0: 10.37, 90: 8.0, 180: 9.82}
ZOROASTER_FREE = {0: 9.0, 90: 8.0, 180: 9.0}
SOUTH_NODE_ORB = 9.0


def hyleg_house(lon, mc):
    """寿主用的宫:从天顶起的等宫,每宫起点提前 5°。与盘的宫制无关。"""
    return int((norm360(lon - mc + 5.0) // 30 + 9) % 12) + 1


def _above_mc(lon, mc):
    arc = norm360(lon - mc)
    return arc < 90.0 or arc >= 270.0


def _masculine_quadrant(lon, mc):
    return _above_mc(lon, mc) == (norm360(lon - mc + 5.0) < 180.0)


def _sun_qualifies(table, lon, mc):
    house = hyleg_house(lon, mc)
    return house in table[0] or (house in table[1] and (is_masculine_sign(lon) or _masculine_quadrant(lon, mc)))


def _zoroaster_exception(view, node):
    """太阳在上半球、不提前 5° 的等宫 8、12 时,入庙入旺未受克,或火象座主有力,太阳优先。"""
    sun, mc = view.lons['Sun'], view.mc
    arc = norm360(sun - mc)
    if not _above_mc(sun, mc) or not (300.0 <= arc < 330.0 or 60.0 <= arc < 90.0):
        return False
    info = dignities_of(sun, view.faces)
    strong = 'Sun' in (info['ruler'], info['exalt'])
    if strong and _sun_is_free(view, node):
        return True
    return _sun_ruler_helps(view)


def _sun_is_free(view, node):
    sun = view.lons['Sun']
    for malefic in ('Mars', 'Saturn'):
        gap = separation(view.lons[malefic], sun)
        if any(abs(gap - angle) <= orb for angle, orb in ZOROASTER_FREE.items()):
            return False
    return separation(node, sun) < 180.0 - SOUTH_NODE_ORB


def _sun_ruler_helps(view):
    sun = view.lons['Sun']
    ruler = lord_of(sun)
    if ruler == 'Sun' or sign_of(sun) % 4 != 0:
        return False
    lon = view.lons[ruler]
    gap = separation(lon, sun)
    steps = (sign_of(lon) - sign_of(sun)) % 12
    if not ((abs(gap - 60.0) <= 6.0 and steps in (2, 10)) or abs(gap - 120.0) <= 8.0):
        return False
    info = dignities_of(lon, view.faces)
    if view.speeds[ruler] < 0 or hyleg_house(lon, view.mc) not in HYLEG_G8 or ruler in (info['exile'], info['fall']):
        return False
    if ruler not in (info['ruler'], info['exalt'], info['term'], info['face']) and ruler not in trip_lords(info):
        return False
    for malefic in ('Mars', 'Saturn'):
        if malefic != ruler:
            apart = separation(view.lons[malefic], lon)
            if any(abs(apart - angle) <= orb for angle, orb in ZOROASTER_HARD.items()):
                return False
    return True


def _geometric_hyleg(view, school, syzygy, node, classic=True):
    strict = school == 'ptolemy' and not classic
    upper, lower, moon_houses = HYLEG_PTOLEMY_STRICT if strict else HYLEG_GEOMETRIC[school]
    places = HYLEG_G5 if strict else HYLEG_G8
    sun, moon, mc = view.lons['Sun'], view.lons['Moon'], view.mc
    if school == 'zoroaster' and _zoroaster_exception(view, node):
        return 'Sun'
    sun_above = _above_mc(sun, mc)
    sun_ok = _sun_qualifies(upper if sun_above else lower, sun, mc)
    moon_ok = hyleg_house(moon, mc) in moon_houses and (not is_masculine_sign(moon) or not _masculine_quadrant(moon, mc))
    for body in (('Sun', 'Moon') if sun_above else ('Moon', 'Sun')):
        if (body == 'Sun' and sun_ok) or (body == 'Moon' and moon_ok):
            return body
    if hyleg_house(syzygy, mc) in places:
        return 'Syzygy'
    return 'Pars Fortuna' if hyleg_house(view.fortune, mc) in places else 'Asc'


def _witnessed(view, lon, own, orbs):
    """照见:该点的守、旺、界、面、三位三分主之中,任一星与点成相位;点是日月且自己就是其中一主时算成立。"""
    info = dignities_of(lon, view.faces)
    for lord in [info['ruler'], info['exalt'], info['term'], info['face']] + trip_lords(info):
        if lord not in view.lons:
            continue
        if lord == own:
            return True
        gap = separation(view.lons[lord], lon)
        if any(abs(gap - angle) <= orb for angle, orb in orbs.items()):
            return True
    return False


def _witness_hyleg(view, school, syzygy):
    mc = view.mc
    for light in (view.sect_light, view.other_light):
        lon = view.lons[light]
        if hyleg_house(lon, mc) in HYLEG_G8 and _witnessed(view, lon, light, WITNESS_ORBS_FIXED):
            return light
    if hyleg_house(view.fortune, mc) in HYLEG_G8 and _witnessed(view, view.fortune, None, WITNESS_ORBS_FIXED):
        return 'Pars Fortuna'
    if hyleg_house(syzygy, mc) in HYLEG_G8 and _witnessed(view, syzygy, None, WITNESS_ORBS_FIXED):
        return 'Syzygy'
    if school == 'omar' and not _witnessed(view, view.asc, None, WITNESS_ORBS_FIXED):
        return None
    return 'Asc'


def _light_hyleg(view, school):
    mc = view.mc
    houses = HYLEG_G8 if school == 'valens' else HYLEG_G5
    for light in (view.sect_light, view.other_light):
        if hyleg_house(view.lons[light], mc) in houses:
            return light
    if school != 'lilly' and hyleg_house(view.fortune, mc) in HYLEG_G8:
        return 'Pars Fortuna'
    return 'Asc'


def _bonatti_hyleg(view, placidus, syzygy, new_moon):
    sun, moon = view.lons['Sun'], view.lons['Moon']
    if view.day:
        house = house_ahead(sun, placidus)
        allowed = (1, 7, 8, 9, 10, 11) if is_masculine_sign(sun) else (1, 10, 11)
        if house in allowed and _witnessed(view, sun, 'Sun', DEFAULT_ORBS):
            return 'Sun'
    if not is_masculine_sign(moon) and house_ahead(moon, placidus) in HYLEG_G8:
        return 'Moon'
    if new_moon:
        if _witnessed(view, view.asc, None, DEFAULT_ORBS):
            return 'Asc'
    elif _witnessed(view, view.fortune, None, DEFAULT_ORBS):
        return 'Pars Fortuna'
    if any(separation(view.fortune, lon) <= 10.0 for lon in (sun, moon, view.asc)):
        return 'Pars Fortuna'
    return 'Syzygy'


def hyleg_of(view, school, syzygy, new_moon, node, placidus, classic=True):
    if school in HYLEG_GEOMETRIC:
        return _geometric_hyleg(view, school, syzygy, node, classic)
    if school in ('hay', 'omar'):
        return _witness_hyleg(view, school, syzygy)
    if school == 'bonatti':
        return _bonatti_hyleg(view, placidus, syzygy, new_moon)
    return _light_hyleg(view, school)


def _alcocoden_tie(view, name):
    gap = separation(view.lons[name], view.lons['Sun'])
    if name == 'Sun' or gap <= 17.0 / 60.0:
        return gap
    return gap + 1000.0 if gap <= COMBUST_LIMIT else gap


def alcocoden_of(view, lon):
    """寿主星:候选是寿主点的守、旺、三位三分主、界、面,比候选自己所在位置的本质分。平手先看离日远近,灼伤垫底。"""
    info = dignities_of(lon, view.faces)
    candidates = []
    for name in [info['ruler'], info['exalt']] + trip_lords(info) + [info['term'], info['face']]:
        if name in view.lons and name not in candidates:
            candidates.append(name)

    def own_score(name):
        at = dignities_of(view.lons[name], view.faces)
        hits = [at['ruler'] == name, at['exalt'] == name, name in trip_lords(at), at['term'] == name, at['face'] == name]
        return sum(hits) - (at['exile'] == name) - (at['fall'] == name)

    best = max(own_score(name) for name in candidates)
    return min([name for name in candidates if own_score(name) == best], key=lambda name: _alcocoden_tie(view, name))


# ---------------------------------------------------------------------------
# 气质:五票定类型,星位定分数
# ---------------------------------------------------------------------------
ELEMENT_QUALITY = ((1, -1), (-1, -1), (1, 1), (-1, 1))      # 火 土 风 水:(热 + 冷 −,湿 + 干 −)
PHASE_QUALITY = ((1, 1), (1, -1), (-1, -1), (-1, 1))
PLANET_QUALITY = {'Mercury': ((1, 0), (0, -1)), 'Venus': ((1, 1), (0, 1)), 'Mars': ((1, -1), (0, -1)), 'Jupiter': ((1, 1), (0, 1)), 'Saturn': ((-1, 1), (0, -1))}
TEMPERAMENTS = {1: '多血', 2: '胆汁', 3: '粘液', 4: '忧郁'}
TEMPER_ORB = 4.5
TEMPER_CUSPS = (2, 4, 6, 8, 9, 10)      # 第 3、5、7、9、10、11 宫头


def element_quality(lon):
    return ELEMENT_QUALITY[sign_of(lon) % 4]


def moon_phase_quality(view):
    return PHASE_QUALITY[int(norm360(view.lons['Moon'] - view.lons['Sun']) // 90)]


def season_quality(view):
    return PHASE_QUALITY[int(view.lons['Sun'] // 90)]


def planet_own_quality(view, name):
    if name == 'Sun':
        return season_quality(view)
    if name == 'Moon':
        return moon_phase_quality(view)
    return PLANET_QUALITY[name][0 if view.oriental(name) else 1]


def vote_quality(view, name):
    """票里缺的一项取星所在座。"""
    own = planet_own_quality(view, name)
    sign = element_quality(view.lons[name])
    return own[0] or sign[0], own[1] or sign[1]


def temperament_type(view, geniture, classic=False):
    """五票:上升座、月相、季节、上升主、命主。经典档比热对干、冷对湿,缺省档比干湿多数。"""
    votes = [element_quality(view.asc), moon_phase_quality(view), season_quality(view), vote_quality(view, lord_of(view.asc)), vote_quality(view, geniture)]
    warm = sum(1 for heat, _wet in votes if heat > 0)
    wet = sum(1 for _heat, moist in votes if moist > 0)
    cold, dry = 5 - warm, 5 - wet
    if classic:
        kind = (1 if warm >= dry else 2) if warm > cold else (3 if wet >= cold else 4)
    else:
        kind = (1 if wet > dry else 2) if warm > cold else (3 if wet > dry else 4)
    return kind, votes


def temperament_scores(view, geniture):
    """分数:上升座 + 上升主、命主、日、月及与之成相位的星 + 各星对上升的权重。X 热冷,Y 湿干。"""
    def vector(name):
        own = planet_own_quality(view, name)
        sign = element_quality(view.lons[name])
        return own[0] + sign[0], own[1] + sign[1]

    def aspected(a, b):
        gap = separation(a, b)
        return any(abs(gap - angle) <= TEMPER_ORB for angle in ASPECT_ANGLES)

    x, y = element_quality(view.asc)
    for subject in (lord_of(view.asc), geniture, 'Sun', 'Moon'):
        vx, vy = vector(subject)
        x += vx
        y += vy
        for other in SEVEN:
            if other != subject and aspected(view.lons[subject], view.lons[other]):
                vx, vy = vector(other)
                x += vx
                y += vy
    for name in SEVEN:
        lon = view.lons[name]
        weight = 1 if aspected(lon, view.asc) else 0
        if any(separation(lon, view.cusps[i]) <= TEMPER_ORB for i in TEMPER_CUSPS):
            weight = 5
        if separation(lon + view.asc, 180.0) <= 1.5:
            weight += 5
        if 0.0 < norm360(lon - view.asc) <= 5.5 and sign_of(lon) == sign_of(view.asc):
            weight += 1
        vx, vy = vector(name)
        x += weight * vx
        y += weight * vy
    return x, y


# ---------------------------------------------------------------------------
# 专题主星
# ---------------------------------------------------------------------------
TOPICS = ((1, '灵魂'), (2, '全盘(加宫位与日时主)'), (3, '主导星'), (4, '子女'), (5, '旅行'), (6, '职业'), (7, '朋友'), (8, '仇敌'), (9, '手足'), (10, '母亲'), (11, '姻缘'),
          (12, '水星'), (13, '上升'), (14, '月亮'), (15, '全盘'), (16, '灵魂(全盘)'), (17, '财产'), (18, '事业'), (19, '各星自身'))
ALMUTEN_HOUSE_POINTS = {1: 12, 2: 6, 3: 3, 4: 9, 5: 7, 6: 1, 7: 10, 8: 4, 9: 5, 10: 11, 11: 8, 12: 2}
DAY_LORDS = ('Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Sun')      # 周一起
DAY_LORD_POINTS = 7
HOUR_LORD_POINTS = 6


def _blank_scores():
    return {name: 0 for name in SEVEN}


def _add_point(scores, lon, faces, with_face=True):
    """守 5 · 旺 4 · 三位三分主各 3 · 界 2 · 面 1。"""
    info = dignities_of(lon, faces)
    for key, points in (('ruler', 5), ('exalt', 4), ('term', 2)):
        if info[key] in scores:
            scores[info[key]] += points
    for lord in trip_lords(info):
        scores[lord] += 3
    if with_face:
        scores[info['face']] += 1


def _count_point(scores, lon, faces):
    """计数版:守、旺、三位三分主、界各记 1,不算面。"""
    info = dignities_of(lon, faces)
    for key in ('ruler', 'exalt', 'term'):
        if info[key] in scores:
            scores[info[key]] += 1
    for lord in trip_lords(info):
        scores[lord] += 1


def topic_lots(view, classic):
    """专题用的希腊点。经典档照传统算表,这几项按白羊 0° 计。"""
    if classic:
        return dict.fromkeys(('children', 'travel', 'work', 'friends', 'enemies', 'siblings', 'mother', 'union', 'fortune', 'spirit'), 0.0)
    lons, asc, cusps = view.lons, view.asc, view.cusps

    def lot(first, second, flip=False):
        a, b = (second, first) if flip and not view.day else (first, second)
        return norm360(asc + a - b)

    return {'children': lot(lons['Jupiter'], lons['Saturn'], True), 'travel': lot(cusps[8], lons[lord_of(cusps[8])]), 'work': lot(view.mc, lons['Sun']),
            'friends': lot(lons['Moon'], lons['Mercury']), 'enemies': lot(cusps[11], lons[lord_of(cusps[11])]), 'siblings': lot(lons['Saturn'], lons['Jupiter'], True),
            'mother': lot(lons['Venus'], lons['Moon'], True), 'union': lot(lons['Venus'], lons['Saturn']), 'fortune': view.fortune, 'spirit': view.spirit}


def topical_rows(view, syzygy, day_lord, hour_lord, classic=False):
    """syzygy = {'sun', 'moon'}:产前朔望时日、月的黄经。缺省档用主题 Lot,经典档这几项按白羊 0° 计。"""
    faces, lons, asc, mc, cusps = view.faces, view.lons, view.asc, view.mc, view.cusps
    lots = topic_lots(view, classic)

    def lord_at(lon):
        return lons[lord_of(lon)]

    def house_lord(house):
        return lord_at(cusps[house - 1])

    def total(points, with_face=True):
        scores = _blank_scores()
        for lon in points:
            _add_point(scores, lon, faces, with_face)
        return scores

    def counted(lon):
        scores = _blank_scores()
        _count_point(scores, lon, faces)
        return scores

    trip_key = 'dayTrip' if view.day else 'nightTrip'
    current = [lons[dignities_of(lon, faces)[trip_key]] for lon in (lons['Sun'], lons['Moon'], asc, mc, norm360(mc + 180.0), norm360(asc + 180.0))]
    chart_points = [lons['Sun'], lons['Moon'], asc, syzygy['moon']]
    ezra = total(chart_points + [lots['fortune']])
    for name in SEVEN:
        ezra[name] += ALMUTEN_HOUSE_POINTS[house_ahead(lons[name], cusps, view.ahead)]
    ezra[day_lord] += DAY_LORD_POINTS
    ezra[hour_lord] += HOUR_LORD_POINTS
    moon = counted(lons['Moon'])
    moon_third = dignities_of(lons['Moon'], faces)['partTrip']
    if moon_third:
        moon[moon_third] += 2
    objects = {}
    for name in SEVEN:
        info = dignities_of(lons[name], faces)
        objects[name] = total([lons[name]])[name] - 5 * (info['exile'] == name) - 4 * (info['fall'] == name)
    mars_third = dignities_of(lons['Mars'], faces)['partTrip']
    table = {
        1: total([lons['Moon'], lons['Mercury'], asc]), 2: ezra, 3: total(current + [lord_at(syzygy['sun']), lots['fortune'], lots['spirit']]),
        4: total([house_lord(5), lord_at(lons['Venus']), lord_at(lons['Jupiter']), lots['children'], lots['children']]),
        5: total([house_lord(9), lons['Mars'], lots['travel']]),
        6: total([lons['Sun'], house_lord(10), lots['work']], False), 7: total([house_lord(11), lons['Venus'], lots['friends']], False),
        8: total([lons['Saturn'], house_lord(12), lots['enemies'], lots['enemies']], False),
        9: total([house_lord(3)] + ([lons[mars_third]] if mars_third else []) + [lots['siblings'], lots['siblings']]), 10: total([house_lord(10), lons['Venus'], lots['mother'], lots['mother']]),
        11: total([lons['Moon'], house_lord(7), lons['Venus'], lots['union']]), 12: counted(lons['Mercury']), 13: counted(asc), 14: moon,
        15: total(chart_points), 16: total(chart_points), 17: total([house_lord(2), lord_at(lons['Jupiter'])]), 18: total([house_lord(10), lord_at(lons['Sun'])]), 19: objects,
    }
    rows = []
    for rid, label in TOPICS:
        scores = table[rid]
        top = max(scores.values())
        rows.append({'id': rid, 'topic': label, 'scores': scores, 'winners': [name for name in SEVEN if scores[name] == top]})
    return rows


# ---------------------------------------------------------------------------
# 相位格局
# ---------------------------------------------------------------------------
PATTERN_RADII = dict(PLANET_RADII, Uranus=2.0, Neptune=2.0, Pluto=2.0, Asc=2.5, MC=2.5, **{'North Node': 2.5, 'South Node': 2.5, 'Pars Fortuna': 2.5})
PATTERN_SHAPES = {
    (90, 90, 180): 'T 三角', (120, 120, 120): '大三角', (60, 150, 150): '上帝手指', (90, 135, 135): '雷神之锤', (90, 120, 150): '学习三角甲', (30, 90, 120): '学习三角乙',
    (60, 120, 180): '楔形', (60, 60, 120): '扇形',
    (90, 90, 90, 90, 180, 180): '大十字', (60, 60, 120, 120, 120, 180): '风筝', (60, 60, 120, 120, 180, 180): '神秘矩形', (45, 45, 135, 135, 180, 180): '硬矩形',
    (30, 30, 60, 150, 150, 180): '聚焦手指', (60, 90, 90, 120, 150, 150): '玫瑰结', (30, 90, 120, 120, 150, 150): '海伦', (60, 60, 90, 150, 150, 150): '双手指',
    (30, 90, 90, 120, 120, 150): '方钥', (72, 72, 108, 108, 144, 180): '五分风筝', (60, 60, 60, 120, 120, 180): '摇篮', (30, 60, 90, 90, 120, 180): '楔形加 T 三角',
    (60, 90, 90, 120, 150, 180): '楔形加 T 三角',
    (72, 72, 72, 72, 72, 144, 144, 144, 144, 144): '五芒星', (60, 60, 60, 60, 120, 120, 120, 120, 180, 180): '五六形',
    (60, 60, 60, 90, 90, 120, 120, 150, 150, 180): '梯形加轴', (30, 30, 60, 60, 60, 90, 90, 120, 120, 180): '梯形加轴',
    (60, 60, 60, 60, 60, 60, 120, 120, 120, 120, 120, 120, 180, 180, 180): '六芒星',
    (30, 30, 60, 60, 90, 90, 90, 90, 120, 120, 120, 150, 150, 180, 180): '领结',
}
PATTERN_SIZES = {}
for _angles, _shape in PATTERN_SHAPES.items():
    PATTERN_SIZES.setdefault({3: 3, 6: 4, 10: 5, 15: 6}[len(_angles)], []).append((_angles, _shape))
_COMBO_CACHE = {}
STELLIUM_NAMES = {3: '三星聚', 4: '四星聚', 5: '五星聚'}
PAIR_POINTS = ('Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto')
PAIR_GAP = 10.0


def _clusters(points):
    """合相的点连成组,一组当一个角。"""
    names = list(points)
    group = {name: name for name in names}

    def root(name):
        while group[name] != name:
            name = group[name]
        return name

    for a, b in combinations(names, 2):
        if separation(points[a], points[b]) <= PATTERN_RADII[a] + PATTERN_RADII[b]:
            group[root(a)] = root(b)
    out = {}
    for name in names:
        out.setdefault(root(name), []).append(name)
    return list(out.values())


def close_pairs(points):
    """十星按相距 10° 内连成星团,至少三个星团时成格。"""
    names = [name for name in PAIR_POINTS if name in points]
    group = {name: name for name in names}

    def root(name):
        while group[name] != name:
            name = group[name]
        return name

    for a, b in combinations(names, 2):
        if separation(points[a], points[b]) <= PAIR_GAP:
            group[root(a)] = root(b)
    out = {}
    for name in names:
        out.setdefault(root(name), []).append(name)
    return [members for members in out.values() if len(members) >= 2]


def _combo_tables(count):
    """count 个点里取 3~6 个的下标表,以及每种大小的两两配对。"""
    tables = _COMBO_CACHE.get(count)
    if tables is None:
        tables = {}
        for size in (key for key in PATTERN_SIZES if key <= count):
            pairs = list(combinations(range(size), 2))
            tables[size] = (numpy.array(list(combinations(range(count), size))), numpy.array([p[0] for p in pairs]), numpy.array([p[1] for p in pairs]))
        _COMBO_CACHE[count] = tables
    return tables


def aspect_patterns(points):
    """三到六点的几何格局。把一组点的两两距离排好序,与格局的角逐项比,每对都在两点半径和之内才算;合相的点归到同一个角。"""
    names = list(points)
    lons = numpy.array([points[name] for name in names])
    radii = numpy.array([PATTERN_RADII[name] for name in names])
    gaps = numpy.abs((lons[:, None] - lons[None, :] + 180.0) % 360.0 - 180.0)
    orbs = radii[:, None] + radii[None, :]
    groups = _clusters(points)
    group_of = {name: index for index, members in enumerate(groups) for name in members}
    found = {}
    tables = _combo_tables(len(names))
    for size, shapes in PATTERN_SIZES.items():
        if size > len(names):
            continue
        index, first, second = tables[size]
        left, right = index[:, first], index[:, second]
        order = numpy.argsort(gaps[left, right], axis=1)
        sorted_gaps = numpy.take_along_axis(gaps[left, right], order, axis=1)
        sorted_orbs = numpy.take_along_axis(orbs[left, right], order, axis=1)
        for angles, shape in shapes:
            hits = numpy.all(numpy.abs(sorted_gaps - numpy.array(angles)) <= sorted_orbs, axis=1)
            for combo in index[hits]:
                corners = [names[i] for i in combo]
                seats = found.setdefault((shape, tuple(sorted(group_of[name] for name in corners))), {})
                for name in corners:
                    seats.setdefault(group_of[name], [])
                    if name not in seats[group_of[name]]:
                        seats[group_of[name]].append(name)
    rows = [{'name': STELLIUM_NAMES[min(len(members), 5)], 'corners': [members]} for members in groups if len(members) >= 3]
    rows += [{'name': shape, 'corners': list(seats.values())} for (shape, _groups), seats in found.items()]
    pairs = close_pairs(points)
    if len(pairs) >= 3:
        rows.append({'name': '多组成对', 'corners': pairs})
    return rows


# ---------------------------------------------------------------------------
# 总入口
# ---------------------------------------------------------------------------
def pattern_points(frame, view):
    """格局用十星、南北交、上升、天顶、福点。"""
    points = {name: row['lon'] for name, row in frame['points'].items() if name in PATTERN_RADII}
    points['South Node'] = norm360(points['North Node'] + 180.0)
    points['Pars Fortuna'] = view.fortune
    return points


def placidus_cusps(frame, view):
    try:
        cusps = swisseph.houses_ex(frame['jd'], frame['phi'], frame['geolon'], b'P')[0]
    except swisseph.Error:      # 极圈内 Placidus 不成立
        return view.cusps
    return [norm360(cusp) for cusp in cusps][:12]


def _hyleg_table(view, frame, syzygy, classic=True):
    placidus = placidus_cusps(frame, view)
    lon = syzygy['hylegDegree']
    new_moon = syzygy['type'] == 'new'
    rows = []
    points = dict(view.lons, Asc=view.asc, Syzygy=lon, **{'Pars Fortuna': view.fortune})
    for school, label in HYLEG_SCHOOLS:
        hyleg = hyleg_of(view, school, lon, new_moon, view.node, placidus, classic)
        rows.append({'school': school, 'label': label, 'hyleg': hyleg, 'at': points.get(hyleg), 'alcocoden': alcocoden_of(view, points[hyleg]) if hyleg else None})
    return rows


def _details(data):
    faces = 'element' if str(data.get('detailFaces')) == 'element' else 'chaldean'
    classic = str(data.get('variant')) == 'classic'
    frame = _natal_from_request(data)
    view = ChartView(frame, faces)
    planetary = compute_planetary_hours(base_params(data)) or {}
    hour_lord = seasonal_hour_lord(frame['perchart'])
    day_lord = planetary.get('dayRuler') or frame['perchart'].getDayerStar()
    prenatal = compute_prenatal_syzygy(base_params(data))
    moon_point = prenatal.get('moonLon', view.lons['Moon'])
    syzygy = {'sun': prenatal.get('sunLon', view.lons['Sun']), 'moon': moon_point,
              'hylegDegree': moon_point if classic else prenatal.get('hylegDegree', moon_point), 'type': prenatal.get('type')}
    if classic:
        view.node = frame['points']['North Node']['lon']        # 经典档固定真交点
    dispositors = dispositor_rows(view)
    accidental = accidental_rows(view, classic)
    geniture = lord_of_geniture(accidental)
    kind, votes = temperament_type(view, geniture, classic)
    warm, moist = temperament_scores(view, geniture)
    return {
        'birth': frame['birth'], 'faces': faces, 'variant': 'classic' if classic else 'improved', 'day': view.day, 'dayLord': day_lord, 'hourLord': hour_lord,
        'eminence': eminence_rows(view), 'persian': persian_rows(view), 'dispositors': {'rows': dispositors, 'final': final_dispositor(dispositors)},
        'sunPhases': sun_phase_rows(view), 'sect': sect_rows(view, classic), 'receptions': reception_rows(view), 'relations': relation_rows(view),
        'considerations': consideration_rows(view, hour_lord), 'slavery': slavery_rows(view), 'hellenistic': hellenistic_row(view),
        'accidental': {'rows': accidental, 'geniture': geniture},
        'temperament': {'type': kind, 'name': TEMPERAMENTS[kind], 'votes': votes, 'warm': warm, 'moist': moist},
        'topics': topical_rows(view, syzygy, day_lord, hour_lord, classic), 'hyleg': _hyleg_table(view, frame, syzygy, classic),
        'patterns': aspect_patterns(pattern_points(frame, view)),
        'fertility': _dated(fertility_dates(frame['jd'], frame['targetJd']), frame),
        'crisis': _dated(crisis_days(frame['jd']), frame),
        'lunarDays': more.lunar_days(frame, data.get('lunarMethod')),
        'bindhu': more.bindhu_rows(more.detail_points(frame, view)),
        'astrodynes': more.astrodynes(frame, view),
        'inMundo': more.in_mundo(frame, view, data.get('mundoSystem') or 'proportional'),
        'perfections': more.perfections(frame, view),
        'cuspAspects': more.cusp_aspects(frame, view),
        'starAspects': more.star_aspects(frame, view),
        'planetDetails': more.planet_details(frame),
        'degrees': more.degree_rows(frame, view, lambda lon: face_of(lon, faces), classic),
        'midpoints': more.midpoints(frame, view, data.get('midpointCoord') or 'ecliptic'),
        'stats': more.chart_stats(frame, view),
        'anatomy': more.anatomy_rows(more.detail_points(frame, view), view.cusps),
        'hourAspects': build_hour_aspects(frame['perchart'].dateTime.jd, frame['perchart'].pos.lat, frame['perchart'].pos.lon, 'classic' if classic else 'improved',
                                          classic or data.get('westNodeType') == 'true'),
    }


def _dated(table, frame):
    for row in table['rows']:
        row['datetime'] = frame['dateOf'](row['jd'])
    return table


def build_chart_details(data):
    """请求体与起盘同形,另带 detailFaces、variant。"""
    data = data or {}
    token = push_classical_request(base_params(data))
    try:
        return _details(data)
    finally:
        pop_classical_request(token)
