# -*- coding: utf-8 -*-
"""timelord_tables.py — 时主轮转与匀速点类星运。

两类输出:
- 期表(periods):一段时间归一颗星或一个座。轮主、轨主、年度分配、月相四分、月亮单度主、月亮九年、九分主。
- 事件表(events):某点在某个年龄被走到。匀速点三法、发展年龄、周日象限、对数时标、月亮日。

约定:七星用星名;次序「黄经序」= 本命七星按黄经递增排成环;迦勒底序 = 土木火日金水月;小年合 129。
年长是选项,段起点 = 出生 + 累计年数 × 年长。黄道一律回归黄道。
「经典」档保留传统算表的写法,缺省档修掉其中定主与算时错位、段内不连续之类的毛病,差别写在各函数说明里。
"""
import math

import swisseph
from flatlib import const

from astrostudy.astroextra import compute_planetary_hours
from astrostudy.astroextra_parts.common import base_params
from astrostudy.astroextra_parts.progressions import compute_prenatal_syzygy
from astrostudy.directed_figures import _natal_from_request, _common_head, norm360, SEVEN

CHALDEAN = ['Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon']
ASTRONOMICAL = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']
SIGN_RULERS = ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn',
               'Jupiter']
LESSER_YEARS = {'Sun': 19, 'Moon': 25, 'Mercury': 20, 'Venus': 8, 'Mars': 15, 'Jupiter': 12, 'Saturn': 30}
CHALDEAN_RANK = {'Moon': 1, 'Mercury': 2, 'Venus': 3, 'Sun': 4, 'Mars': 5, 'Jupiter': 6, 'Saturn': 7}
# 与前端 utils/timeLordYears.js 同一张表
YEAR_DAYS = {'solar': 365.242199, 'sidereal': 365.256363, 'hellenistic': 360.0, 'abumashar': 365.25833,
             'mashaallah': 365.259028, 'bija': 365.258756, 'bijaClassic': 366.256399}
# bija:《苏利耶历数书》一大劫 1,577,917,828 民用日 ÷ 4,320,000 年(Bija 修正不改太阳转数,年长仍是它);
# bijaClassic:经典档沿用的 366.256399(一个恒星年里的恒星日数,当作太阳日用每年多出约一天)
DEFAULT_YEAR = 'solar'
ANNUAL_DAYS = {
    'tableA': {'Sun': 53, 'Moon': 70, 'Mercury': 22, 'Venus': 22, 'Mars': 42, 'Jupiter': 34, 'Saturn': 85},
    'tableB': {'Sun': 53, 'Moon': 70, 'Mercury': 22, 'Venus': 33, 'Mars': 36, 'Jupiter': 30, 'Saturn': 85},
}
MOVING_RATES = {'condition': 30.0, 'quadrant28': 90.0 / 7.0, 'age72': 5.0}
ASPECTS = (0, 60, 90, 120, 180)
DEV_LENGTHS = list(range(2, 14))     # 十二段 2..13 年,合 90 年
DIURNAL_YEARS = {'five': 5.0, 'seven': 7.0}
QUADRANT_STARTS = (0.0, 22.0, 42.0, 61.0, 90.0)     # 周日象限四象限档:四段 22、20、19、29 年
QUADRANT_RATES = (21.0, 19.0, 18.0, 29.0)           # 经典档每 90° 的年数
LIFETIME_C_DAYS = 279.7755           # 对数时标常数,0.766 回归年
NINE_STEP = 10.0 / 9.0               # 九分度的三分之一,1°06′40″
NINE_TRIPLICITY = (('Mars', 'Sun', 'Jupiter'), ('Saturn', 'Venus', 'Mercury'), ('Venus', 'Saturn', 'Mercury'),
                   ('Moon', 'Mars', 'Jupiter'))   # 火 土 风 水
NAVAMSA_START = (0, 9, 6, 3)
MOON_DAY_ARCS = ((3, 30.0), (7, 90.0), (40, 180.0))
RELEASER_POINTS = ('Pars Fortuna', 'Pars Spirit', 'Syzygy')
SOLAR_ONLY = ('annual', 'lifetime', 'moondays')
HOUR_LORD_METHODS = ('turn', 'orb')
AXIS_FIRST = frozenset(['North Node'] + ['House%d' % i for i in range(1, 7)])
AXIS_SECOND = frozenset(['South Node'] + ['House%d' % i for i in range(7, 13)])
MAX_LIST_AGE = 120.0
SEASONAL_HOURS = 'unequal'


def _num(value, default):
    try:
        out = float(value)
    except (TypeError, ValueError):
        return default
    return out if math.isfinite(out) else default


def zodiac_ring(start, lons):
    """从 start 起,七星按本命黄经递增排成环。"""
    ordered = sorted(SEVEN, key=lambda name: lons[name])
    index = ordered.index(start)
    return ordered[index:] + ordered[:index]


def _ring_from(ring, start):
    index = ring.index(start)
    return ring[index:] + ring[:index]


def house_ruler_ring(asc_sign, start):
    """十二宫座主排成环,从第一个座主等于 start 的宫起走。"""
    rulers = [SIGN_RULERS[(asc_sign + i) % 12] for i in range(12)]
    index = rulers.index(start)
    return rulers[index:] + rulers[:index]


def turn_sequence(order, start, lons, asc_sign):
    if order == 'chaldean':
        return _ring_from(CHALDEAN, start)
    if order == 'astronomical':
        return _ring_from(ASTRONOMICAL, start)
    if order == 'house':
        return house_ruler_ring(asc_sign, start)
    return zodiac_ring(start, lons)


def turn_lords(order, start, lons, asc_sign, count):
    """轮主:一年一段,沿所选次序循环。"""
    seq = turn_sequence(order, start, lons, asc_sign)
    return [seq[i % len(seq)] for i in range(count)]


def orb_lords(mode, asc_sign, start, count):
    """轨主从出生时的行星时主起。单轮 = 沿十二宫座主走,十二年一周;循环 = 走迦勒底序,二十四年后重头。"""
    if mode == 'cycle':
        seq = _ring_from(CHALDEAN, start)
        return [seq[(i % 24) % 7] for i in range(count)]
    ring = house_ruler_ring(asc_sign, start)
    return [ring[i % 12] for i in range(count)]


def quarter_periods(start, lons, count):
    """月相四分:一段 = 小年 × 90 日;每轮七段,下一轮起点在序内后移 3 位。"""
    order = zodiac_ring(start, lons)
    out = []
    cycle = 0
    while len(out) < count:
        shift = (cycle * 3) % 7
        for lord in order[shift:] + order[:shift]:
            out.append({'lord': lord, 'days': LESSER_YEARS[lord] * 90.0, 'cycle': cycle + 1})
        cycle += 1
    return out[:count]


def monomoiria_start(moon_lon):
    """月亮所在度的单度主:该座座主管第一度,其后按迦勒底序逐度轮。"""
    sign = int(norm360(moon_lon) // 30)
    degree = int(norm360(moon_lon) - sign * 30)
    return _ring_from(CHALDEAN, SIGN_RULERS[sign])[degree % 7]


def monomoiria_periods(start, lons, count):
    """月亮单度主:年数 = 迦勒底序位(月 1 … 土 7,合 28 年);下一轮起点按黄经序后移 1 位。"""
    order = zodiac_ring(start, lons)
    out = []
    cycle = 0
    while len(out) < count:
        shift = cycle % 7
        for lord in order[shift:] + order[:shift]:
            out.append({'lord': lord, 'days': CHALDEAN_RANK[lord] * 360.0, 'cycle': cycle + 1})
        cycle += 1
    return out[:count]


def moon_nine_periods(moon_lon, count, classic=False):
    """月亮九年:从月亮所在座起逐座,每座 3240 日。
    首段缺省 = 座内余下度数 × 108 日;经典档用已走度数(传统算表的写法)。"""
    lon = norm360(moon_lon)
    sign = int(lon // 30)
    within = lon - sign * 30.0
    first = (within if classic else 30.0 - within) * 108.0
    return [{'sign': sign, 'lord': SIGN_RULERS[sign], 'days': first}] + [
        {'sign': (sign + i) % 12, 'lord': SIGN_RULERS[(sign + i) % 12], 'days': 3240.0} for i in range(1, count)]


def navamsa_lord(lon):
    """九分度主:火象从白羊、土象从摩羯、风象从天秤、水象从巨蟹起,每 3°20′ 顺走一座取座主。"""
    value = norm360(lon)
    sign = int(value // 30)
    part = min(int((value - sign * 30.0) * 3.0 / 10.0), 8)     # 乘后取整:座内 20° 用整除会落回前一份
    return SIGN_RULERS[(NAVAMSA_START[sign % 4] + part) % 12]


def nine_cell(lon):
    """黄经所在的九分单元下标。压在单元边界上算后一格。"""
    return int(math.floor(norm360(lon) / NINE_STEP + 1e-9))


def nine_part(lon):
    """某点所在九分段的 (九分主, 子主)。子主取该元素三分序。"""
    value = norm360(lon)
    sign = int(value // 30)
    index = int(round((value - sign * 30.0) / NINE_STEP, 6) // 1)
    nav = index // 3
    return navamsa_lord(sign * 30.0 + nav * 10.0 / 3.0 + 1e-6), NINE_TRIPLICITY[sign % 4][index % 3]


def _oblique_ascension(lon, phi, eps):
    ra, dec = swisseph.cotrans((lon, 0.0, 1.0), -eps)[:2]
    value = math.tan(math.radians(phi)) * math.tan(math.radians(dec))
    return ra - math.degrees(math.asin(max(-1.0, min(1.0, value))))


def nine_part_rows(asc, phi, eps, by_ascension, reverse, max_age, classic=False):
    """九分主:单元 10/9°,度数档 1° = 1 年;上升时档按出生纬度的斜升差。
    缺省档从上升真实度数起,第一段只走余量,定主与算时用同一位置。
    反转:起点在九分度第二子段时,余下一段的子主倒回首子段;从首子段或末子段起算时本九分度内无段可倒。
    经典档定主比算时落后两段,与传统算表逐行相同。"""
    def span(a, b):
        if by_ascension:
            return norm360(_oblique_ascension(b, phi, eps) - _oblique_ascension(a, phi, eps))
        return b - a

    if classic:
        return _nine_part_classic(asc, span, reverse, max_age)
    k = nine_cell(asc)
    rows = []
    age = 0.0
    position = asc
    i = 0
    while age <= max_age and i < 2000:
        end = (k + i + 1) * NINE_STEP
        length = span(position, end)
        cell = k - 1 if reverse and k % 3 == 1 and i == 1 else k + i
        lord, sub = nine_part((cell + 0.5) * NINE_STEP)
        rows.append({'startAge': age, 'endAge': age + length, 'lord': lord, 'sub': sub, 'from': norm360(position)})
        age += length
        position = end
        i += 1
    return rows


def _nine_part_classic(asc, span, reverse, max_age):
    """传统算表写法:每行的时刻是段起点,出生记第 k 段,其后定主位置比算时位置落后两段。单元一律用整数下标。"""
    k = nine_cell(asc)
    s = k % 3
    walk_back = reverse and s > 0
    marks = [(0.0, k)]
    age = 0.0
    cell = k
    if walk_back:
        first = k - s
        point = k + 1
        age += span(asc, point * NINE_STEP)
        marks.append((age, k))
        while point + 1 <= first + 3:
            age += span(point * NINE_STEP, (point + 1) * NINE_STEP)
            point += 1
            marks.append((age, k))
        cell = first - (3 - s)
    while age <= max_age and len(marks) < 2000:
        if walk_back:
            age += span((cell + 1) * NINE_STEP, (cell + 2) * NINE_STEP)
            marks.append((age, cell))
        else:
            age += span((cell + 2) * NINE_STEP, (cell + 3) * NINE_STEP)
            marks.append((age, cell + 1))
        cell += 1
    rows = []
    for (start, index), (end, _next) in zip(marks, marks[1:]):
        lord, sub = nine_part((index + 0.5) * NINE_STEP)
        rows.append({'startAge': start, 'endAge': end, 'lord': lord, 'sub': sub})
    return rows


def aspect_points(points):
    """目标各相位点:相位点 = 目标黄经 ∓ 相位;合与冲不分左右。
    南北交、对宫宫头互为对冲,相位点两两重合,所以前者只记合,后者不记冲。"""
    for name, lon in points.items():
        for angle in ASPECTS:
            if (name in AXIS_FIRST and angle != 0) or (name in AXIS_SECOND and angle == 180):
                continue
            for sign in ((1,) if angle in (0, 180) else (1, -1)):
                yield name, angle, None if angle in (0, 180) else ('S' if sign == 1 else 'D'), norm360(lon - sign * angle)


def moving_point_events(start, points, rate, max_age):
    """匀速点:从 start 按黄道匀速前进,走到各点的相位位置记一件事。不分宫位大小。"""
    events = []
    for name, angle, side, at in aspect_points(points):
        offset = norm360(at - start)
        turn = 0
        while (offset + 360.0 * turn) / rate <= max_age:
            events.append({'age': (offset + 360.0 * turn) / rate, 'point': name, 'aspect': angle, 'side': side, 'at': at})
            turn += 1
    events.sort(key=lambda row: row['age'])
    return events


def _house_index(lon, cusps):
    for i in range(12):
        width = norm360(cusps[(i + 1) % 12] - cusps[i])
        arc = norm360(lon - cusps[i])
        if arc < width:
            return i, arc, width
    return 0, 0.0, norm360(cusps[1] - cusps[0])


def developmental_age(lon, cusps=None, classic=False):
    """发展年龄:十二段依次 2..13 年。星座档从白羊 0° 起;宫位档从 1 宫起,段内线性。
    经典档保留传统算表的重复归一化,宽窄宫不连续,可能超过总长。"""
    if cusps is None:
        sign = int(norm360(lon) // 30)
        return sum(DEV_LENGTHS[:sign]) + DEV_LENGTHS[sign] * (norm360(lon) - sign * 30.0) / 30.0
    index, arc, width = _house_index(lon, cusps)
    base = sum(DEV_LENGTHS[:index])
    if classic:
        return base + (arc * 30.0 / width) * DEV_LENGTHS[index] / width
    return base + DEV_LENGTHS[index] * arc / width


def quadrant_age(lon, asc, mc, classic=False):
    """周日象限四象限档:移动点从上升起顺时针走,四个象限依次 22、20、19、29 年,合 90 年,上升本身排在一周末尾。
    缺省档在象限内按比例走;经典档用定速(21、19、18、29 年每 90°),跨象限会跳。"""
    arc = norm360(asc - lon) or 360.0
    first = norm360(asc - mc)
    marks = (0.0, first, 180.0, 180.0 + first, 360.0)
    quadrant = next(i for i in range(4) if arc <= marks[i + 1])       # 边界归前一象限
    within = arc - marks[quadrant]
    start = QUADRANT_STARTS[quadrant]
    if classic:
        return start + within * QUADRANT_RATES[quadrant] / 90.0
    return start + (QUADRANT_STARTS[quadrant + 1] - start) * within / (marks[quadrant + 1] - marks[quadrant])


def diurnal_age(lon, cusps, mode, classic=False):
    """周日象限分宫档:移动点从上升起顺时针走,依次过 12、11 … 1 宫,每宫 5 或 7 年。"""
    per_house = DIURNAL_YEARS[mode]
    index, arc, width = _house_index(lon, cusps)
    finished = ((11 - index) % 12 + 1) * per_house
    if classic:
        return finished - (arc * 30.0 / width) * per_house / width
    return finished - per_house * arc / width


def lifetime_ages(theta):
    """对数时标:年龄 + c = c × 10^(θ/120);θ = 点自上升逆时针的弧。[240°, 360°) 另有一组出生前的年龄。"""
    c = LIFETIME_C_DAYS
    days = [c * (10.0 ** (theta / 120.0) - 1.0)]
    if theta >= 240.0 - 1e-9:
        days.append(c * (10.0 ** ((theta - 360.0) / 120.0) - 1.0))
    return days


def moon_arrival(jd, target):
    """jd 之后月亮首次到达 target 的时刻。"""
    def gap(when):
        return ((swisseph.calc_ut(when, swisseph.MOON, swisseph.FLG_SWIEPH)[0][0] - target + 180.0) % 360.0) - 180.0

    low = jd
    high = jd + 0.25
    while not (gap(low) < 0.0 <= gap(high)) and high < jd + 40.0:
        low = high
        high += 0.25
    for _ in range(50):
        mid = (low + high) / 2.0
        if gap(mid) < 0.0:
            low = mid
        else:
            high = mid
    return high


def solar_returns(jd, sun_lon, count):
    out = []
    when = jd
    for _ in range(count):
        when = swisseph.solcross_ut(sun_lon, when + 300.0, swisseph.FLG_SWIEPH)
        out.append(when)
    return out


def _fortune(frame):
    """福点取盘上的值,跟全站福点口径走。"""
    return norm360(frame['perchart'].chart.get(const.PARS_FORTUNA).lon)


def _spirit(frame):
    """灵点是福点关于上升的镜像。"""
    return norm360(2.0 * frame['points']['Asc']['lon'] - _fortune(frame))


def prenatal_syzygy_lon(data):
    """产前朔望的取度:朔取合相黄经,望取当时地平之上的发光体。求不出时返回 None。"""
    return compute_prenatal_syzygy(base_params(data)).get('hylegDegree')


def releaser_lon(name, frame, data):
    if name == 'Pars Fortuna':
        return _fortune(frame)
    if name == 'Pars Spirit':
        return _spirit(frame)
    return prenatal_syzygy_lon(data)


def first_planet_after(lon, lons):
    """黄经序里 lon 之后第一颗星。"""
    return min(SEVEN, key=lambda name: norm360(lons[name] - lon))


def seasonal_hour_lord(perchart):
    """出生时的行星时主,用昼夜不等时。全站「时主星」缺省是等长时,这里的传统算法要不等时。"""
    table = compute_planetary_hours({'date': perchart.date, 'time': perchart.time, 'zone': perchart.zone, 'lat': perchart.lat,
                                     'lon': perchart.lon, 'planetaryHourMethod': SEASONAL_HOURS})
    current = [row for row in (table or {}).get('hours', []) if row.get('current')]      # 极昼极夜没有不等时
    return current[0]['ruler'] if current else perchart.getTimerStar()


def _year_key(data, method):
    """这一法实际用的年长。匀速点缺省恒星年;年度分配、对数时标、月亮日是真实时刻,不受年长选项影响。"""
    if method in SOLAR_ONLY:
        return 'solar'
    fallback = 'sidereal' if method == 'moving' else DEFAULT_YEAR
    key = str(data.get('yearType') or fallback)
    return key if key in YEAR_DAYS else fallback


def _target_points(frame, with_angles=True):
    points = {name: row['lon'] for name, row in frame['points'].items() if with_angles or name not in ('Asc', 'MC')}
    points['South Node'] = norm360(points['North Node'] + 180.0)
    points['Pars Fortuna'] = _fortune(frame)
    return points


def _period_rows(frame, year, periods, children=None):
    """periods = [{lord, days(按 360 日一年算的长度), ...}]。返回带年龄与日期的行。"""
    out = []
    years = 0.0
    for index, row in enumerate(periods):
        length = row['days'] / 360.0
        item = dict(row)
        item.update({'startAge': years, 'endAge': years + length,
                     'start': frame['dateOf'](frame['jd'] + years * year), 'end': frame['dateOf'](frame['jd'] + (years + length) * year)})
        if children:
            item['children'] = children(row, years, index)
        out.append(item)
        years += length
    return out


def _sub_rows(frame, year, base_years, subs):
    out = []
    years = base_years
    for row in subs:
        length = row['days'] / 360.0
        item = dict(row)
        item.update({'startAge': years, 'endAge': years + length,
                     'start': frame['dateOf'](frame['jd'] + years * year), 'end': frame['dateOf'](frame['jd'] + (years + length) * year)})
        out.append(item)
        years += length
    return out


def _yearly(frame, year, lords):
    return [{'lord': lord, 'startAge': float(i), 'endAge': float(i + 1), 'start': frame['dateOf'](frame['jd'] + i * year),
             'end': frame['dateOf'](frame['jd'] + (i + 1) * year)} for i, lord in enumerate(lords)]


def _max_age(data, default=100.0):
    return min(max(_num(data.get('maxAge'), default), 1.0), MAX_LIST_AGE)


def _build_turn(frame, data, year, lons, asc_sign):
    start = frame['hourLord'] if str(data.get('turnStart')) == 'hour' else SIGN_RULERS[asc_sign]
    order = str(data.get('turnOrder') or 'zodiac')
    count = int(_max_age(data))
    return {'kind': 'periods', 'startLord': start, 'order': order,
            'rows': _yearly(frame, year, turn_lords(order, start, lons, asc_sign, count))}


def _build_orb(frame, data, year, asc_sign):
    mode = 'cycle' if str(data.get('orbMode')) == 'cycle' else 'single'
    lords = orb_lords(mode, asc_sign, frame['hourLord'], int(_max_age(data)))
    return {'kind': 'periods', 'mode': mode, 'startLord': frame['hourLord'], 'rows': _yearly(frame, year, lords)}


def _build_annual(frame, data, lons, asc_sign):
    table_key = 'tableB' if str(data.get('annualDays')) == 'tableB' else 'tableA'
    table = ANNUAL_DAYS[table_key]
    use_return = str(data.get('annualOrder')) == 'return'
    count = int(_max_age(data))
    sun = frame['points']['Sun']['lon']
    rows = []
    returns = [frame['jd']] + solar_returns(frame['jd'], sun, count)
    for index in range(count):      # 第一段是出生到首个返照,年主 = 上升座主
        when = returns[index]
        lord = SIGN_RULERS[(asc_sign + index) % 12]
        positions = lons
        if use_return:
            positions = {name: swisseph.calc_ut(when, getattr(swisseph, name.upper()), swisseph.FLG_SWIEPH)[0][0] for name in SEVEN}
        children = []
        offset = 0.0
        for planet in zodiac_ring(lord, positions):
            children.append({'lord': planet, 'days': table[planet], 'start': frame['dateOf'](when + offset),
                             'end': frame['dateOf'](when + offset + table[planet])})
            offset += table[planet]
        age = (when - frame['jd']) / YEAR_DAYS['solar']
        rows.append({'lord': lord, 'startAge': age, 'endAge': (returns[index + 1] - frame['jd']) / YEAR_DAYS['solar'],
                     'start': frame['dateOf'](when), 'end': frame['dateOf'](returns[index + 1]), 'children': children})
    return {'kind': 'periods', 'dayTable': table_key, 'order': 'return' if use_return else 'natal', 'rows': rows}


def _build_quarters(frame, data, year, lons):
    releaser = str(data.get('releaser') or 'Moon')
    if releaser not in SEVEN and releaser not in RELEASER_POINTS:
        releaser = 'Moon'
    lon = None if releaser in SEVEN else releaser_lon(releaser, frame, data)
    if releaser not in SEVEN and lon is None:
        releaser = 'Moon'
    start = releaser if releaser in SEVEN else first_planet_after(lon, lons)
    periods = quarter_periods(start, lons, 140)

    def children(row, years, _index):
        order = zodiac_ring(row['lord'], lons)
        return _sub_rows(frame, year, years, [{'lord': p, 'days': row['days'] * LESSER_YEARS[p] / 129.0} for p in order])

    rows = _period_rows(frame, year, periods, children)
    return {'kind': 'periods', 'releaser': releaser, 'startLord': start, 'rows': [r for r in rows if r['startAge'] < _max_age(data)]}


def _build_monomoiria(frame, data, year, lons):
    start = monomoiria_start(lons['Moon'])

    def children(row, years, _index):
        order = zodiac_ring(row['lord'], lons)
        left = row['days']
        subs = []
        i = 0
        while left > 1e-9:
            planet = order[(i // 7 + i % 7) % 7]        # 走完七星起点后移一位,与一级同规则
            days = min(CHALDEAN_RANK[planet] * 30.0, left)
            subs.append({'lord': planet, 'days': days})
            left -= days
            i += 1
        return _sub_rows(frame, year, years, subs)

    rows = _period_rows(frame, year, monomoiria_periods(start, lons, 60), children)
    return {'kind': 'periods', 'startLord': start, 'rows': [r for r in rows if r['startAge'] < _max_age(data)]}


def _build_moon_nine(frame, data, year, lons):
    classic = str(data.get('variant')) == 'classic'
    periods = [p for p in moon_nine_periods(lons['Moon'], 16, classic) if p['days'] > 1e-9]

    def children(row, years, _index):
        return _sub_rows(frame, year, years, [{'sign': (row['sign'] + i) % 12, 'lord': SIGN_RULERS[(row['sign'] + i) % 12],
                                               'days': row['days'] / 9.0} for i in range(9)])

    rows = _period_rows(frame, year, periods, children)
    return {'kind': 'periods', 'variant': 'classic' if classic else 'improved',
            'rows': [r for r in rows if r['startAge'] < _max_age(data)]}


def _build_nine_parts(frame, data, year):
    polar = abs(frame['phi']) >= 90.0 - frame['epsTrue']      # 极圈内斜升不单调,上升时档不成立
    by_ascension = str(data.get('nineTime')) == 'ascension' and not polar
    reverse = str(data.get('nineReverse')) in ('1', 'true', 'True')
    classic = str(data.get('variant')) == 'classic'
    max_age = _max_age(data)
    rows = nine_part_rows(frame['points']['Asc']['lon'], frame['phi'], frame['epsTrue'], by_ascension, reverse, max_age, classic)
    rows = [r for r in rows if r['startAge'] < max_age]
    for row in rows:
        row['start'] = frame['dateOf'](frame['jd'] + row['startAge'] * year)
        row['end'] = frame['dateOf'](frame['jd'] + row['endAge'] * year)
    return {'kind': 'periods', 'time': 'ascension' if by_ascension else 'degree', 'reverse': reverse, 'polar': polar,
            'variant': 'classic' if classic else 'improved', 'rows': rows}


def _dated_events(frame, year, events):
    for row in events:
        row['date'] = frame['dateOf'](frame['jd'] + row['age'] * year)
    return events


def _build_moving(frame, data, year):
    kind = str(data.get('rateKind') or 'condition')
    rate = MOVING_RATES.get(kind, MOVING_RATES['condition'])
    start_name = str(data.get('movingStart') or 'Asc')
    points = _target_points(frame)
    start = prenatal_syzygy_lon(data) if start_name == 'Syzygy' else points.get(start_name)
    if start is None:
        start_name, start = 'Asc', points['Asc']
    events = moving_point_events(start, points, rate, _max_age(data, 99.0))
    return {'kind': 'events', 'rateKind': kind, 'rate': rate, 'startPoint': start_name, 'rows': _dated_events(frame, year, events)}


def _build_dev_ages(frame, data, year):
    by_house = str(data.get('devBasis')) == 'house'
    classic = str(data.get('variant')) == 'classic'
    rows = [{'age': developmental_age(lon, frame['cusps'] if by_house else None, classic), 'point': name, 'at': lon}
            for name, lon in _target_points(frame).items()]
    rows.sort(key=lambda row: row['age'])
    return {'kind': 'events', 'basis': 'house' if by_house else 'sign', 'variant': 'classic' if classic else 'improved',
            'rows': _dated_events(frame, year, rows)}


def _build_diurnal(frame, data, year):
    mode = str(data.get('diurnalMode') or 'five')
    mode = mode if mode in ('five', 'seven', 'quadrant') else 'five'
    classic = str(data.get('variant')) == 'classic'
    asc, mc = frame['points']['Asc']['lon'], frame['points']['MC']['lon']

    def age_of(lon):
        return quadrant_age(lon, asc, mc, classic) if mode == 'quadrant' else diurnal_age(lon, frame['cusps'], mode, classic)

    rows = [{'age': age_of(lon), 'point': name, 'at': lon} for name, lon in _target_points(frame).items()]
    rows += [{'age': age_of(i * 30.0), 'point': 'sign:%d' % i, 'at': i * 30.0} for i in range(12)]
    rows.sort(key=lambda row: row['age'])
    return {'kind': 'events', 'mode': mode, 'variant': 'classic' if classic else 'improved', 'rows': _dated_events(frame, year, rows)}


def _build_lifetime(frame, data, year):
    """对数时标:上升是起点(第 0 岁),不作目标;天顶恒作目标,宫头另列。
    等宽宫制下宫头就在座首,宫头的合、别的宫头的六合 / 刑和座首行会落在同一处 —— 同一位置只留一行:
    星体与天顶的行全留;其余按「宫头合 > 座首 > 宫头的其它相位」取一行。"""
    asc = frame['points']['Asc']['lon']
    points = _target_points(frame, with_angles=False)
    points['MC'] = frame['points']['MC']['lon']
    for i, cusp in enumerate(frame['cusps']):
        points['House%d' % (i + 1)] = cusp
    max_days = _max_age(data) * YEAR_DAYS['solar']
    candidates = []
    for name, angle, side, at in aspect_points(points):
        for days in lifetime_ages(norm360(at - asc)):
            if days <= max_days:
                rank = 2 if not name.startswith('House') else (3 if angle == 0 else 5)
                candidates.append((rank, {'age': days / YEAR_DAYS['solar'], 'point': name, 'aspect': angle, 'side': side,
                                          'at': at, 'date': frame['dateOf'](frame['jd'] + days)}))
    for i in range(12):
        for days in lifetime_ages(norm360(i * 30.0 - asc)):
            if days <= max_days:
                candidates.append((4, {'age': days / YEAR_DAYS['solar'], 'point': 'sign:%d' % i, 'at': i * 30.0,
                                       'date': frame['dateOf'](frame['jd'] + days)}))
    rows, taken = [], set()
    for rank, row in sorted(candidates, key=lambda item: item[0]):
        key = (round(row['at'], 6) % 360.0, round(row['age'], 6))
        if rank > 2 and key in taken:
            continue
        taken.add(key)
        rows.append(row)
    rows.sort(key=lambda row: row['age'])
    return {'kind': 'events', 'rows': rows}


def _build_moon_days(frame, data):
    """第 3、7、40 日:月亮到达本命月加 30°、90°、180° 的那一次。
    改进档取离该日最近的那次到达 —— 月亮一天约走 13.2°,第 40 日约走 527°(本命月加 167°),对应的是第二次到冲(约第 41 天);
    第 3、7 日最近的就是第一次到达。经典档一律取第一次到达(第 40 日那行实为第 13~15 天)。"""
    classic = str(data.get('variant')) == 'classic'
    natal = frame['points']['Moon']['lon']
    rows = []
    for day, arc in MOON_DAY_ARCS:
        target = norm360(natal + arc)
        when = moon_arrival(frame['jd'], target)
        if not classic:
            arrivals = [when]
            while arrivals[-1] - frame['jd'] < day:
                arrivals.append(moon_arrival(arrivals[-1] + 1.0, target))
            when = min(arrivals, key=lambda t: abs((t - frame['jd']) - day))
        rows.append({'day': day, 'arc': arc, 'at': target, 'age': (when - frame['jd']) / YEAR_DAYS['solar'],
                     'afterDays': when - frame['jd'], 'date': frame['dateOf'](when)})
    return {'kind': 'events', 'variant': 'classic' if classic else 'improved', 'rows': rows}


METHODS = ('turn', 'orb', 'annual', 'quarters', 'monomoiria', 'moonnine', 'nineparts', 'moving', 'devages', 'diurnal',
           'lifetime', 'moondays')


def build_timelords(data):
    """请求体(与起盘同形)+ method + 各法选项 → 期表或事件表,外加目标时刻所在行 currentIndex。"""
    data = data or {}
    method = str(data.get('method') or 'turn')
    if method not in METHODS:
        method = 'turn'
    frame = _natal_from_request(data)
    # 南北交跟盘面的平 / 真交点设置(底盘缺省取真交点;盘面 perchart 已按 westNodeType 等设置换好)
    node = frame['perchart'].chart.getObject(const.NORTH_NODE)
    if node is not None:
        frame['points']['North Node'] = {'lon': norm360(node.lon), 'lat': getattr(node, 'lat', 0.0), 'speed': getattr(node, 'lonspeed', 0.0)}
    if method in HOUR_LORD_METHODS:
        frame['hourLord'] = seasonal_hour_lord(frame['perchart'])
    year_key = _year_key(data, method)
    year = YEAR_DAYS[year_key]
    lons = {name: frame['points'][name]['lon'] for name in SEVEN}
    asc_sign = int(frame['points']['Asc']['lon'] // 30)
    if method == 'turn':
        body = _build_turn(frame, data, year, lons, asc_sign)
    elif method == 'orb':
        body = _build_orb(frame, data, year, asc_sign)
    elif method == 'annual':
        body = _build_annual(frame, data, lons, asc_sign)
    elif method == 'quarters':
        body = _build_quarters(frame, data, year, lons)
    elif method == 'monomoiria':
        body = _build_monomoiria(frame, data, year, lons)
    elif method == 'moonnine':
        body = _build_moon_nine(frame, data, year, lons)
    elif method == 'nineparts':
        body = _build_nine_parts(frame, data, year)
    elif method == 'moving':
        body = _build_moving(frame, data, year)
    elif method == 'devages':
        body = _build_dev_ages(frame, data, year)
    elif method == 'diurnal':
        body = _build_diurnal(frame, data, year)
    elif method == 'lifetime':
        body = _build_lifetime(frame, data, year)
    else:
        body = _build_moon_days(frame, data)
    out = _common_head(frame)
    out.update(body)
    rows = body['rows']
    out['pastEnd'] = bool(rows) and (frame['targetJd'] - frame['jd']) / year >= rows[-1].get('endAge', rows[-1].get('age'))
    out.update({'technique': 'timelords', 'method': method, 'yearType': year_key,
                'hourLord': frame.get('hourLord'), 'ascSign': asc_sign,
                'currentIndex': _current_index(body, frame, year)})
    return out


def _current_index(body, frame, year):
    age = (frame['targetJd'] - frame['jd']) / year
    rows = body.get('rows') or []
    if body.get('kind') == 'periods':
        for index, row in enumerate(rows):
            if row['startAge'] <= age < row['endAge']:
                return index
        return -1
    for index, row in enumerate(rows):
        if row['age'] >= age:
            return index
    return -1
