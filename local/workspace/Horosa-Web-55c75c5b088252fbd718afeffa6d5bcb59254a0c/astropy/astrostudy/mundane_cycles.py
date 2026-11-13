# -*- coding: utf-8 -*-
"""mundane_cycles.py — 世俗周期表。

大中小合、平均大合、千年轮转、世运法达、世俗小限、世界年表、纪元小限、世俗希腊点、年度回归、世俗主限、默冬月相族、气象占。
多数是算术表,与盘无关;大中小合与年度回归查星历。「经典」档保留传统算表的写法,差别写在各函数说明里。
"""
import math

import swisseph

from astrostudy.astroextra_parts.common import date_time_from_jd
from astrostudy.chart_details import ChartView, PHASE_PLANETS, sign_of, sun_grade, fold180, BODY_IDS, MEAN_SPEEDS, STATION_RATIO
from astrostudy.civil_calendar import civil_julday, civil_julday_display, civil_parts_from_jd, parse_civil_date
from astrostudy.directed_figures import _natal_from_request, norm360

CHALDEAN = ('Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon')
CHALDEAN_NODES = CHALDEAN + ('North Node', 'South Node')
FIRDARIA_ORDER = ('Sun', 'Moon', 'North Node', 'Jupiter', 'Mercury', 'Saturn', 'South Node', 'Mars', 'Venus')
FIRDARIA_YEARS = {'Sun': 10, 'Moon': 9, 'North Node': 3, 'Jupiter': 12, 'Mercury': 13, 'Saturn': 11, 'South Node': 2, 'Mars': 7, 'Venus': 8}
QUARTER_ORDER = ('Mars', 'Sun', 'Mercury', 'Saturn')
SIDEREAL_YEAR = 365.25636
TROPICAL_YEAR = 365.242199
WORLD_YEAR = 365.25833
FLOODS = {'a': 486779.12, 'b': 588466.12}
TURN_YEARS = 360
MAX_RANGE_YEARS = 3400
CONJUNCTION_PAIRS = {'great': ('Jupiter', 'Saturn'), 'middle': ('Mars', 'Saturn'), 'lesser': ('Mars', 'Jupiter')}
CONJUNCTION_STEP = 4.0
TRIPLE_GAP = {'great': 400.0, 'middle': 250.0, 'lesser': 250.0}
CONJUNCTION_LEAD = 8000.0
# 表:起始序号处的时刻(JD)、周期(日)、起始黄经、每合进度
MEAN_TABLES = {
    'table1': (1762856.6797, 7252.5163, 22.0795, 242.9603), 'table2': (1762810.8816, 7253.3254, 18.9809, 242.9696),
    'table3': (1762875.4417, 7252.3167, 17.7523, 243.0063), 'table4': (1762924.9136, 7249.5496, 34.4549, 242.4223),
    'table5': (1770148.2220, 7249.5885, 274.5997, 242.4209), 'table6': (1770150.0457, 7249.5997, 274.6940, 242.4214),
    'table7': (791292.7800, 7250.3382, 313.2014, 242.4264), 'table8': (1762821.9240, 7253.3254, 19.6976, 242.9696),
}
MEAN_FIRST_ID = 163
LESSER_CLASSIC = {'Sun': 9, 'Moon': 3, 'North Node': 12, 'Jupiter': 13, 'Mercury': 11, 'Saturn': 2, 'South Node': 7, 'Mars': 8, 'Venus': 10}
PROFECTION_YEARS = {'big': 100.0, 'middle': 10.0, 'lesser': 1.0, 'great': 80.0, 'middle20': 20.0, 'lesser20': 20.0 / 12.0, 'monarchy': 5.0, 'malefic': 2.5, 'qisma': 30.0,
                    'solar': TROPICAL_YEAR / 12.0, 'annual': 1.0, 'degree': 1.0 / 12.0}
PROFECTION_ROWS = 29
CHANGE_WINDOW = 150000.0
GREAT_WINDOW = 30000.0
ERA_BASE = {'hijra': (2000, 330.0, 90.0, 240.0, 342.0), 'change': (2000, 0.0, 30.0, 60.0, 342.0)}
MERCURY_TERM = (4, 3, 2, 1, 0, 2, 3, 4, 5, 6, 6, 5)
MUNDANE_PART_FORMULAS = {1: '日 + 月 − 金', 2: '水 + 上升 − 水星座数', 3: '日 + 月 − 土', 4: '月 + 上升 − 火', 5: '日 + 木 − 天顶', 6: '日 + 上升 − 土', 7: '日 + 上升 − 135°', 8: '月 + 上升 − 105°',
                         9: '木 + 上升 − 土', 10: '木 + 上升 − 天顶', 11: '日 + 180°', 12: '日 + 火 − 月', 13: '灵点 + 上升 − 木', 14: '土 + 木 − 日'}
INGRESS_POINTS = (0.0, 90.0, 180.0, 270.0)
DAWR_STARTS = {'a': 1648, 'b': 1660}


def _lon(body, jd):
    return swisseph.calc_ut(jd, BODY_IDS[body], swisseph.FLG_SWIEPH)[0][0]


def _year_of(jd):
    """历史纪年。年份输入和列表都用它,公元前没有 0 年。"""
    return civil_parts_from_jd(jd)['year']


def _date(jd, zone='+00:00'):
    return date_time_from_jd(jd, zone)['datetime']


def conjunction_events(first, second, start_jd, end_jd):
    """两星真实地心合的时刻。按带符号差过零找,冲时的跳变不算。"""
    def gap(jd):
        return fold180(_lon(first, jd) - _lon(second, jd))

    events = []
    low = start_jd
    low_gap = gap(low)
    while low < end_jd:
        high = min(low + CONJUNCTION_STEP, end_jd)
        high_gap = gap(high)
        if (low_gap < 0) != (high_gap < 0) and abs(low_gap - high_gap) < 180.0:
            a, b = low, high
            for _ in range(50):
                mid = (a + b) / 2.0
                if (gap(mid) < 0) == (low_gap < 0):
                    a = mid
                else:
                    b = mid
            events.append((a + b) / 2.0)
        low, low_gap = high, high_gap
    return events


def conjunction_rows(kind, start_year, end_year, classic=False):
    """三重合缺省逐次列出,经典档只留第一次。三重合的后几次标 repeat。范围外的合只用来判上一座。"""
    first, second = CONJUNCTION_PAIRS[kind]
    start_jd = civil_julday_display(start_year, 1, 1, 0.0)
    rows = []
    previous = None
    last_jd = None
    last_element = None
    for jd in conjunction_events(first, second, start_jd - CONJUNCTION_LEAD, civil_julday_display(end_year, 12, 31, 0.0)):
        repeat = last_jd is not None and jd - last_jd < TRIPLE_GAP[kind]
        last_jd = jd
        lon = norm360(_lon(first, jd))
        sign = sign_of(lon)
        shift = not repeat and last_element is not None and sign % 4 != last_element
        if not repeat:
            last_element = sign % 4
        if jd >= start_jd and not (repeat and classic):
            rows.append({'id': len(rows) + 1, 'date': _date(jd), 'lon': lon, 'sign': sign, 'previous': previous, 'repeat': repeat, 'shift': shift})
        previous = sign
    return rows


def mean_conjunction_rows(table, start_year, end_year):
    """平均大合:等差序列。"""
    first, period, lon, step = MEAN_TABLES[table]
    start_jd, end_jd = civil_julday_display(start_year, 1, 1, 0.0), civil_julday_display(end_year, 12, 31, 0.0)
    rows = []
    index = int(math.ceil((start_jd - first) / period))
    while first + index * period <= end_jd:
        at = norm360(lon + index * step)
        rows.append({'id': MEAN_FIRST_ID + index, 'date': _date(first + index * period), 'lon': at, 'sign': sign_of(at)})
        index += 1
    return rows


def turn_rows(flood, year_days, end_year):
    """每段 360 年。星座从巨蟹起顺行,行星从土星起走迦勒底序。"""
    start = FLOODS[flood]
    length = TURN_YEARS * year_days
    rows = []
    index = 0
    end_jd = civil_julday_display(end_year, 12, 31, 0.0)
    while start + index * length <= end_jd:
        rows.append({'id': index + 1, 'date': _date(start + index * length), 'sign': (3 + index) % 12, 'lord': CHALDEAN[index % 7]})
        index += 1
    return rows


def big_firdaria_steps(years):
    """按座走:白羊 11 年,其后 10、9 … 1、12 循环。"""
    steps = []
    index = 0
    total = 0
    while total < years:
        length = 12 - (index + 1) % 12
        steps.append({'sign': index % 12, 'years': length})
        total += length
        index += 1
    return steps


def mighty_firdaria_rows(level, start_jd, year_days, years, classic=False):
    """世运法达,从所选起点列周期,不按洪水对齐。小档缺省用标准小期;经典档每星错用下一星的年数。"""
    if level == 'big':
        steps = big_firdaria_steps(years)
    elif level == 'middle':
        steps = [{'lord': FIRDARIA_ORDER[i % 9], 'years': 75} for i in range(int(years // 75) + 1)]
    else:
        table = LESSER_CLASSIC if classic else FIRDARIA_YEARS
        steps = []
        total = 0
        index = 0
        while total < years:
            lord = FIRDARIA_ORDER[index % 9]
            steps.append({'lord': lord, 'years': table[lord]})
            total += table[lord]
            index += 1
    rows = []
    at = start_jd
    for step in steps:
        rows.append(dict(step, date=_date(at)))
        at += step['years'] * year_days
    return rows


def aries_ingress(year):
    """某年太阳入白羊的时刻。"""
    return swisseph.solcross_ut(0.0, civil_julday_display(year, 1, 1, 0.0), swisseph.FLG_SWIEPH)


def great_conjunctions_around(jd, span_days=8000.0):
    return conjunction_events('Jupiter', 'Saturn', jd - span_days, jd + span_days)


def _first_conjunctions(start_jd, end_jd):
    """大合,三重合只留第一次。"""
    events = []
    for jd in conjunction_events('Jupiter', 'Saturn', start_jd, end_jd):
        if not events or jd - events[-1] >= TRIPLE_GAP['great']:
            events.append(jd)
    return events


def _element(jd):
    return sign_of(_lon('Jupiter', jd)) % 4


def _triplicity_changes(start_jd, end_jd):
    events = _first_conjunctions(start_jd, end_jd)
    return [b for a, b in zip(events, events[1:]) if _element(a) != _element(b)]


def _classic_change(target):
    """经典档:目标后一年起第一个大合作基准,再往后第一个换了元素的大合。一路来回摆动的不算。"""
    events = _first_conjunctions(target + TROPICAL_YEAR, target + CHANGE_WINDOW)
    return next(jd for jd in events[1:] if _element(jd) != _element(events[0]))


def _anchor_event(kind, target, classic):
    """锚事件。缺省取目标之前最近一次;经典档从目标后一年起取之后第一次。"""
    if kind == 'change':
        if classic:
            return _classic_change(target)
        return _triplicity_changes(target - CHANGE_WINDOW, target)[-1]
    if kind == 'great':
        events = _first_conjunctions(target - GREAT_WINDOW, target + GREAT_WINDOW)
    else:
        year = _year_of(target)
        events = [aries_ingress(y) for y in (year - 1, year, year + 1, year + 2)]
    if classic:
        return next(jd for jd in events if jd >= target + TROPICAL_YEAR)
    return [jd for jd in events if jd <= target][-1]


def _ingress_angles(jd, phi, geolon):
    armc = norm360(swisseph.sidtime(jd) * 15.0 + geolon)
    eps = swisseph.calc_ut(jd, swisseph.ECL_NUT)[0][0]
    try:
        ascmc = swisseph.houses_armc(armc, phi, eps, b'P')[1]
    except swisseph.Error:
        ascmc = swisseph.houses_armc(armc, phi, eps, b'O')[1]
    return norm360(ascmc[0]), norm360(ascmc[1])


def mundane_profection_rows(rate, base, target, phi, geolon, classic=False):
    """世俗小限:从锚点逐座顺行,每行是走点入下一座的时刻。座档从合点度数起,首行只走到下一座的余度。
    缺省档上升、天顶取锚年入白羊盘,随地点变,行上写走入的那一座。
    经典档:上升档也用合所在座,整段走一步;行上写走完的那一座。天顶档传统算表的分数定不下来,一律按缺省算。"""
    years = PROFECTION_YEARS[rate]
    event = {'change': 'change', 'great': 'great', 'ingress': 'ingress'}[base[:6] if base.startswith('change') else base[:5] if base.startswith('great') else 'ingress']
    classic = classic and not base.endswith('Mc')
    anchor = _anchor_event(event, target, classic)
    if base == 'ingress':
        lon = 0.0
    elif base.endswith('Sign') or classic:
        lon = _lon('Jupiter', anchor)
    else:
        asc, mc = _ingress_angles(aries_ingress(_year_of(anchor)), phi, geolon)
        lon = asc if base.endswith('Asc') else mc
    lon = norm360(lon)
    fraction = (30.0 - lon % 30.0) / 30.0 if base != 'ingress' and not base.endswith('Asc') and not base.endswith('Mc') else 1.0
    sign = sign_of(lon)
    rows = []
    for index in range(PROFECTION_ROWS):
        at = anchor + (index + fraction) * years * TROPICAL_YEAR
        rows.append({'id': index + 1, 'date': _date(at), 'sign': (sign + index + (0 if classic else 1)) % 12})
    return {'anchor': _date(anchor), 'anchorLon': lon, 'rows': rows}


def thousands_row(year):
    """千年表:洪水后年 = 公元年 + 3392。"""
    y = year + 3392
    return {'year': year, 'floodYear': y, 'thousandLord': CHALDEAN[(3 + (y - 5101) // 1000) % 7], 'division': norm360(30.0 * ((y - 10) // 30) + 0.1 * ((y - 10) % 30)),
            'turn': norm360(90.0 + 30.0 * (y // 360)), 'turnLord': CHALDEAN[(y // 360) % 7], 'quarterYear': y % 90, 'quarterLord': QUARTER_ORDER[(1 + (y - 5130) // 90) % 4]}


def _lesser_lord(year, base):
    """75 年段内按序走小期;每段首星多 1 年。"""
    span = (year - base) // 75
    left = (year - base) % 75
    index = span % 9
    while True:
        length = FIRDARIA_YEARS[FIRDARIA_ORDER[index]]
        if left <= length:
            return FIRDARIA_ORDER[index]
        left -= length
        index = (index + 1) % 9


def _big_progress(year, base):
    """白羊 12 年、金牛 11 年 … 双鱼 1 年,一周 78 年。"""
    left = (year - base) % 78
    length = 12
    lon = 0.0
    while left >= length:
        left -= length
        length -= 1
        lon += 30.0
    return lon + left * 30.0 / length


def world_year_row(year):
    """世界年表:世界年 = 公元年 + 183101。方向、小限、法达、大年、季摄、颤动。"""
    w = year + 183101
    return {
        'year': year, 'worldYear': w, 'dirMillennium': (w / 1000.0) % 360.0, 'dirCentury': (w / 100.0) % 360.0, 'dirDecade': (w / 10.0) % 360.0, 'dirYear': w % 360,
        'profMillennium': (w * 0.03) % 360.0, 'profCentury': (w * 0.3) % 360.0, 'profDecade': (w * 3) % 360, 'profYear': (w * 30) % 360,
        'firdariaLord': CHALDEAN[(3 + (year - 1939) // 360) % 7], 'firdariaLon': norm360(300.0 + (year - 1939) / 12.0), 'firdariaBig': _big_progress(year, 1759),
        'firdariaMiddle': FIRDARIA_ORDER[((year - 1849) // 75) % 9], 'firdariaLesser': _lesser_lord(year, 1849), 'greatYear': (year - 1961) % 1461 + 1,
        'governor': CHALDEAN[(w // 1000) % 7], 'governorNine': CHALDEAN_NODES[(w // 1000) % 9], 'quarterYear': w % 90, 'quarterLord': QUARTER_ORDER[(2 + (year - 1759) // 90) % 4],
        'trepidation': ((year - 1745) % 640) / 80.0,
    }


def dawr_row(year, start):
    """360 年周期内的逐年表:年座、年主、周度、四分主。周度是绝对量,每年 1/12°,不随周期重置。"""
    step = (year - start) % 360
    return {'year': year, 'sign': (6 + step) % 12, 'lord': CHALDEAN[(5 + step) % 7], 'lon': norm360((year + 2160) / 12.0), 'quarterLord': QUARTER_ORDER[(max(step - 1, 0) // 90) % 4]}


def era_row(kind, year):
    """纪元小限:上升、换组、大合三点每年进 30°,洪水点每年进 1°。"""
    base, asc, turn, conj, flood = ERA_BASE[kind]
    step = year - base
    return {'year': year, 'asc': norm360(asc + 30.0 * step), 'turn': norm360(turn + 30.0 * step), 'conj': norm360(conj + 30.0 * step), 'flood': norm360(flood + step)}


def mundane_parts(view):
    """世俗希腊点,形式 A + B − C,不分昼夜。"""
    sun, moon, mercury, venus = view.lons['Sun'], view.lons['Moon'], view.lons['Mercury'], view.lons['Venus']
    mars, jupiter, saturn = view.lons['Mars'], view.lons['Jupiter'], view.lons['Saturn']
    asc, mc = view.asc, view.mc
    k = MERCURY_TERM[sign_of(mercury)]
    table = {1: sun + moon - venus, 2: mercury + asc - k, 3: sun + moon - saturn, 4: moon + asc - mars, 5: sun + jupiter - mc, 6: sun + asc - saturn, 7: sun + asc - 135.0,
             8: moon + asc - 105.0, 9: jupiter + asc - saturn, 10: jupiter + asc - mc, 11: sun + 180.0, 12: sun + mars - moon, 13: view.spirit + asc - jupiter, 14: saturn + jupiter - sun}
    return [{'id': key, 'formula': MUNDANE_PART_FORMULAS[key], 'lon': norm360(value), 'sign': sign_of(value)} for key, value in sorted(table.items())]


def revolution_rows(year, point):
    """年度回归:太阳到入点时五星的黄纬南北、顺逆与对日状态,只列条件。留优先于日光束,与十六相同一判定。"""
    jd = swisseph.solcross_ut(point, civil_julday_display(year, 1, 1, 0.0), swisseph.FLG_SWIEPH)
    sun = swisseph.calc_ut(jd, swisseph.SUN, swisseph.FLG_SWIEPH)[0][0]
    rows = []
    for name in PHASE_PLANETS:
        xx = swisseph.calc_ut(jd, BODY_IDS[name], swisseph.FLG_SWIEPH | swisseph.FLG_SPEED)[0]
        elongation = fold180(xx[0] - sun)
        ratio = xx[3] / MEAN_SPEEDS[name]
        grade = sun_grade(abs(elongation))
        if abs(ratio) <= STATION_RATIO and grade in ('free', 'beams'):
            relation = 'station'
        elif grade != 'free':
            relation = 'beams'
        else:
            relation = 'morning' if elongation < 0 else 'evening'
        rows.append({'planet': name, 'lon': norm360(xx[0]), 'sign': sign_of(xx[0]), 'north': xx[1] >= 0.0, 'retrograde': ratio < 0, 'relation': relation})
    return {'date': _date(jd), 'rows': rows}


TABLES = ('conjunctions', 'meanConjunctions', 'turns', 'firdaria', 'profections', 'thousands', 'worldYears', 'dawr', 'era', 'parts', 'revolution', 'directions', 'lunations', 'weather')
WEATHER_MONTHS = (3, 6, 12)
METONIC_MONTHS = 235
SYNODIC_MONTH = 29.530588853
DIRECTION_KEYS = ('Ptolemy', 'Naibod', 'Cardano', 'Umar')
LIST_YEARS = 120
YEAR_ROWS = 40


def _aspect_code(parts):
    """主限迫星编号『侧_星_相位』里的相位角;没有或不是整数记 0(合)。"""
    try:
        return int(parts[2]) if len(parts) > 2 else 0
    except ValueError:
        return 0


def mundane_direction_rows(data, frame, key):
    """世俗主限:当前盘(通常是入点盘)的主限弧,一度当一日,一年里走完 360°。
    弧由星阙主限引擎算(方位法、相位、顺逆都跟主限设置的缺省),时间键只把度换成日:日数 = 弧 / 每年度数。"""
    from astrostudy.perchart import PerChart
    from astrostudy.perpredict import PerPredict, STATIC_TIME_KEY_SCALES
    from astrostudy.astroextra_parts.common import base_params
    params = base_params(data)
    params['zodiacal'] = 0
    scale = STATIC_TIME_KEY_SCALES.get(key, 1.0)
    params['pdYears'] = int(math.ceil(365.25 * scale)) + 1      # 引擎按弧(度)截断:一年要推满 365 日对应的弧
    rows = []
    for item in PerPredict(PerChart(params)).getPrimaryDirection() or []:
        try:
            arc = abs(float(item[0]))
        except (TypeError, ValueError, IndexError):
            continue
        days = arc / scale
        # 弧过 360° 就是 0° 起的同一条方向再走一圈(Ptolemy 键一度一日,一年推到 365° 以上),不再列第二次
        if days > 365.25 or arc >= 360.0:
            continue
        prom = str(item[1]).split('_')
        sig = str(item[2]).split('_')
        rows.append({'arc': arc, 'days': days, 'date': _date(frame['jd'] + days, frame['zone']), 'promissor': prom[1] if len(prom) > 1 else prom[0],
                     'aspect': _aspect_code(prom), 'side': prom[0] if len(prom) > 1 else '',
                     'significator': sig[1] if len(sig) > 1 else sig[0], 'converse': float(item[0]) < 0})
    rows.sort(key=lambda row: row['days'])
    return rows


def _phase_time(target, guess):
    """日月角距 = target 的时刻(牛顿迭代,从 guess 起)。"""
    t = guess
    for _ in range(30):
        moon = swisseph.calc_ut(t, swisseph.MOON, swisseph.FLG_SWIEPH | swisseph.FLG_SPEED)[0]
        sun = swisseph.calc_ut(t, swisseph.SUN, swisseph.FLG_SWIEPH | swisseph.FLG_SPEED)[0]
        step = fold180(moon[0] - sun[0] - target) / (moon[3] - sun[3])
        t -= step
        if abs(step) < 1e-8:
            break
    return t


def lunation_family_rows(target, zone):
    """默冬月相族:目标日附近的朔为中心,前后各隔 235 个朔望月(约 19 年)取两轮,共五轮;每轮朔、上弦、望、下弦四个时刻。"""
    center = _phase_time(0.0, target)
    if abs(center - target) > SYNODIC_MONTH / 2.0:
        center = _phase_time(0.0, center + (SYNODIC_MONTH if center < target else -SYNODIC_MONTH))
    rows = []
    for k in range(-2, 3):
        new = _phase_time(0.0, center + k * METONIC_MONTHS * SYNODIC_MONTH)
        times = [new] + [_phase_time(angle, new + angle / 360.0 * SYNODIC_MONTH) for angle in (90.0, 180.0, 270.0)]
        rows.append({'relative': k, 'new': _date(times[0], zone), 'firstQuarter': _date(times[1], zone), 'full': _date(times[2], zone),
                     'lastQuarter': _date(times[3], zone), 'jd': new, 'sunLon': _lon('Sun', new)})
    for prev, row in zip(rows, rows[1:]):
        row['gap'] = row['jd'] - prev['jd']
    return rows


def _int(data, key, default):
    try:
        return int(float(data.get(key, default)))
    except (TypeError, ValueError):
        return default


def _choice(data, key, allowed, default):
    value = str(data.get(key) or default)
    return value if value in allowed else default


def _year_range(data, target_year, span=LIST_YEARS):
    start = _int(data, 'startYear', target_year - span)
    end = _int(data, 'endYear', target_year + span)
    if end < start:
        start, end = end, start
    return start, min(end, start + MAX_RANGE_YEARS)


def _target_jd(data):
    text = data.get('targetDate')
    return civil_julday(*parse_civil_date(text), 12.0) if text else civil_julday(2000, 1, 1, 12.0)


def build_mundane_cycles(data):
    """请求体与起盘同形,另带 table、各表选项。年份表以目标年为中心。"""
    data = data or {}
    table = _choice(data, 'table', TABLES, TABLES[0])
    classic = str(data.get('variant')) == 'classic'
    frame = _natal_from_request(data) if data.get('date') else None
    target = frame['targetJd'] if frame else _target_jd(data)
    target_year = _year_of(target)
    head = {'table': table, 'variant': 'classic' if classic else 'improved', 'targetYear': target_year}
    year_days = {'sidereal': SIDEREAL_YEAR, 'solar': TROPICAL_YEAR, 'world': WORLD_YEAR}[_choice(data, 'cycleYear', ('sidereal', 'solar', 'world'), 'sidereal')]
    if table == 'conjunctions':
        start, end = _year_range(data, target_year)
        kind = _choice(data, 'conjKind', CONJUNCTION_PAIRS, 'great')
        return dict(head, kind=kind, rows=conjunction_rows(kind, start, end, classic and kind == 'great'))
    if table == 'meanConjunctions':
        start, end = _year_range(data, target_year)
        mean = _choice(data, 'meanTable', MEAN_TABLES, 'table1')
        return dict(head, meanTable=mean, rows=mean_conjunction_rows(mean, start, end))
    if table == 'turns':
        flood = _choice(data, 'flood', FLOODS, 'a')
        return dict(head, flood=flood, rows=turn_rows(flood, year_days, target_year + TURN_YEARS))
    if table == 'firdaria':
        years = max(min(_int(data, 'firdariaYears', 200), 1000), 1)
        level = _choice(data, 'firdariaLevel', ('big', 'middle', 'lesser'), 'big')
        return dict(head, level=level, rows=mighty_firdaria_rows(level, target, year_days, years, classic))
    if table == 'profections':
        rate = _choice(data, 'profRate', PROFECTION_YEARS, 'great')
        base = _choice(data, 'profBase', ('changeAsc', 'changeMc', 'changeSign', 'greatAsc', 'greatMc', 'greatSign', 'ingress'), 'greatSign')
        phi, geolon = (frame['phi'], frame['geolon']) if frame else (0.0, 0.0)
        return dict(head, rate=rate, base=base, **mundane_profection_rows(rate, base, target, phi, geolon, classic))
    start = _int(data, 'startYear', target_year)
    years = range(start, start + YEAR_ROWS)
    if table == 'thousands':
        return dict(head, rows=[thousands_row(year) for year in years])
    if table == 'worldYears':
        return dict(head, rows=[world_year_row(year) for year in years])
    if table == 'dawr':
        begin = DAWR_STARTS[_choice(data, 'dawrStart', DAWR_STARTS, 'a')]
        return dict(head, rows=[dawr_row(year, begin) for year in years])
    if table == 'era':
        era = _choice(data, 'eraKind', ERA_BASE, 'hijra')
        return dict(head, eraKind=era, rows=[era_row(era, year) for year in years])
    if table == 'parts':
        return dict(head, rows=mundane_parts(ChartView(frame, 'chaldean')) if frame else [])
    if table == 'weather':
        from astrostudy.meteorology import meteorology_rows
        months = _int(data, 'weatherMonths', 3)
        months = months if months in WEATHER_MONTHS else 3
        if not frame:
            return dict(head, weatherMonths=months, rows=[])
        return dict(head, weatherMonths=months, rows=meteorology_rows(target, months, frame['phi'], frame['geolon'], frame['zone'], classic))
    if table == 'lunations':
        return dict(head, rows=lunation_family_rows(target, frame['zone'] if frame else '+00:00'))
    if table == 'directions':
        key = _choice(data, 'mpdKey', DIRECTION_KEYS, 'Ptolemy')
        return dict(head, mpdKey=key, rows=mundane_direction_rows(data, frame, key) if frame else [])
    point = _int(data, 'ingressPoint', 0)
    point = point if point in (0, 90, 180, 270) else 0
    return dict(head, ingressPoint=point, **revolution_rows(start, float(point)))
