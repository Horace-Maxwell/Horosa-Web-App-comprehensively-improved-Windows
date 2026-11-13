"""印占过运穿界表:七星在一段时间里入座、入宿、入足、入 Kakshya 的时刻。

按恒星黄经逐步走,段序一变就二分到一秒以内。逆行时标星实际进入的那一段。
"""
import swisseph
from flatlib import const
from flatlib.ephem import swe

from astrostudy.astroextra_parts.common import date_time_from_jd, zone_value
from astrostudy.civil_calendar import civil_julday, parse_civil_date
from astrostudy.india.india_chart_kernel import IndiaChartKernel
from astrostudy.india.primitives import SIGN_LORDS, natural_relation, segment_index
from astrostudy.india.extra_tables import SEVEN

BODY_IDS = {
    const.SUN: swisseph.SUN, const.MOON: swisseph.MOON, const.MERCURY: swisseph.MERCURY, const.VENUS: swisseph.VENUS,
    const.MARS: swisseph.MARS, const.JUPITER: swisseph.JUPITER, const.SATURN: swisseph.SATURN,
}
STEP_DAYS = {const.SUN: 0.5, const.MOON: 0.1, const.MERCURY: 0.25, const.VENUS: 0.5, const.MARS: 0.5, const.JUPITER: 1.0, const.SATURN: 1.0}
SPANS = {'sign': 30.0, 'nakshatra': 360.0 / 27.0, 'pada': 10.0 / 3.0, 'kakshya': 3.75}
COUNTS = {'sign': 12, 'nakshatra': 27, 'pada': 108, 'kakshya': 96}
KAKSHYA_LORDS = (const.SATURN, const.JUPITER, const.MARS, const.SUN, const.VENUS, const.MERCURY, const.MOON, const.ASC)
MAX_DAYS = 366
MAX_EVENTS = 600
TOLERANCE_DAYS = 1.0 / 86400.0
FLAGS = swisseph.FLG_SWIEPH | swisseph.FLG_SIDEREAL | swisseph.FLG_SPEED


def _sidereal_args():
    """本线程当前请求的岁差。sid_mode 是进程全局,每次取位前都要重设。"""
    context = swe._SIDEREAL_CONTEXT
    mode = getattr(context, 'mode', None)
    if mode is None:
        return swe.SEDEFAULT_SIDM__MODE, 0.0, 0.0
    return mode, getattr(context, 't0', 0.0), getattr(context, 'ayan_t0', 0.0)


def sidereal_lon(jd, name):
    args = _sidereal_args()
    swisseph.set_sid_mode(*args)        # 下一行紧跟取位,中间不许插任何语句(见 test_swe_concurrency)
    return swisseph.calc_ut(jd, BODY_IDS[name], FLAGS)[0]


def segment(lon, kind):
    return segment_index(lon % 360.0, SPANS[kind], COUNTS[kind])


def crossing(low, high, name, kind):
    """low、high 两端段序不同,二分到穿界时刻。"""
    start = segment(sidereal_lon(low, name)[0], kind)
    while high - low > TOLERANCE_DAYS:
        middle = (low + high) / 2.0
        if segment(sidereal_lon(middle, name)[0], kind) == start:
            low = middle
        else:
            high = middle
    return high


def event_number(index, kind):
    """把总段序换成该事件的序号:座 1~12、宿 1~27、足 1~4、Kakshya 1~8。"""
    if kind == 'pada':
        return index % 4 + 1
    if kind == 'kakshya':
        return index % 8 + 1
    return index + 1


def _relation(name, lord):
    return 'own' if lord == name else natural_relation(name, lord)


def event_row(jd, name, kind, zone):
    row = sidereal_lon(jd + TOLERANCE_DAYS, name)
    lon = row[0] % 360.0
    number = event_number(segment(lon, kind), kind)
    sign = segment(lon, 'sign')
    moment = date_time_from_jd(jd, zone)
    result = {
        'jd': jd, 'planet': name, 'kind': kind, 'number': number, 'lon': lon, 'sign': sign, 'retrograde': row[3] < 0,
        'date': moment['date'], 'time': moment['time'],
    }
    if kind == 'sign':
        result['lord'] = SIGN_LORDS[const.LIST_SIGNS[sign]]
    elif kind == 'kakshya':
        result['lord'] = KAKSHYA_LORDS[number - 1]
    result['relation'] = _relation(name, SIGN_LORDS[const.LIST_SIGNS[sign]])
    return result


def planet_events(name, kind, start, end, zone):
    rows = []
    step = STEP_DAYS[name]
    jd = start
    previous = segment(sidereal_lon(jd, name)[0], kind)
    while jd < end:
        following = min(jd + step, end)
        current = segment(sidereal_lon(following, name)[0], kind)
        if current != previous:
            rows.append(event_row(crossing(jd, following, name, kind), name, kind, zone))
        previous = current
        jd = following
    return rows


def _kinds(value):
    items = value if isinstance(value, (list, tuple)) else [value or 'sign']
    picked = [item for item in items if item in SPANS]
    return picked or ['sign']


def _planets(value):
    if value in (None, '', 'all'):
        return list(SEVEN)
    return [value] if value in BODY_IDS else list(SEVEN)


def _start_jd(data, kernel):
    text = data.get('transitStart')
    if not text:
        return kernel.dateTime.jd
    return civil_julday(*parse_civil_date(text), 0.0) - zone_value(data.get('zone')) / 24.0


def _days(data):
    try:
        days = int(data.get('transitDays') or 30)
    except (TypeError, ValueError):
        days = 30
    return max(1, min(days, MAX_DAYS))


def build_transit_events(data):
    """请求体与起盘同形,另带 transitStart、transitDays、transitPlanet、transitKind。"""
    data = dict(data or {})
    mode = data.get('siderealAyanamsa') or data.get('siderealMode') or 'lahiri'
    kernel = IndiaChartKernel(dict(data, tradition=False, predictive=False, zodiacal=1, siderealMode=mode))
    start = _start_jd(data, kernel)
    days = _days(data)
    end = start + days
    rows = []
    with kernel.chart._siderealContext():
        for name in _planets(data.get('transitPlanet')):
            for kind in _kinds(data.get('transitKind')):
                rows.extend(planet_events(name, kind, start, end, data.get('zone')))
    rows.sort(key=lambda row: row['jd'])
    return {'rows': rows[:MAX_EVENTS], 'total': len(rows), 'truncated': len(rows) > MAX_EVENTS, 'days': days}
