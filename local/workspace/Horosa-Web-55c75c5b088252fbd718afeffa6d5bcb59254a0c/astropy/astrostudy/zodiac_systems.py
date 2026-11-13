"""黄道制:同一张盘的星体落在不等黄道、13 / 14 星座、88 星座与银河黄道的哪一段;另有十三宫。

黄经本身不变,变的只是怎么分段。各版本的座头与座长在 zodiac_data。
"""
import math

import swisseph
from flatlib import const

from astrostudy.astroextra_parts.common import base_params, chart_points, date_time_from_jd
from astrostudy.perchart import PerChart, pop_classical_request, push_classical_request
from astrostudy.zodiac_data import IAU_BLOCKS, ZODIAC_VERSIONS

J2000 = 2451545.0
B1875 = 2405889.25855
SIGNS_12 = ('白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼')
SIGNS_13 = ('白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '蛇夫', '射手', '摩羯', '水瓶', '双鱼')
SIGNS_14 = ('白羊', '鲸鱼', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '蛇夫', '射手', '摩羯', '水瓶', '双鱼')
GROUP_SIGNS = {'twelve': SIGNS_12, 'thirteen': SIGNS_13, 'fourteen': SIGNS_14}
IAU_NAMES = {
    'And': '仙女', 'Ant': '唧筒', 'Aps': '天燕', 'Aql': '天鹰', 'Aqr': '宝瓶', 'Ara': '天坛', 'Ari': '白羊', 'Aur': '御夫',
    'Boo': '牧夫', 'CMa': '大犬', 'CMi': '小犬', 'CVn': '猎犬', 'Cae': '雕具', 'Cam': '鹿豹', 'Cap': '摩羯', 'Car': '船底',
    'Cas': '仙后', 'Cen': '半人马', 'Cep': '仙王', 'Cet': '鲸鱼', 'Cha': '蝘蜓', 'Cir': '圆规', 'Cnc': '巨蟹', 'Col': '天鸽',
    'Com': '后发座', 'CrA': '南冕', 'CrB': '北冕', 'Crt': '巨爵', 'Cru': '南十字', 'Crv': '乌鸦', 'Cyg': '天鹅', 'Del': '海豚',
    'Dor': '剑鱼', 'Dra': '天龙', 'Equ': '小马', 'Eri': '波江', 'For': '天炉', 'Gem': '双子', 'Gru': '天鹤', 'Her': '武仙',
    'Hor': '时钟', 'Hya': '长蛇', 'Hyi': '水蛇', 'Ind': '印第安', 'LMi': '小狮', 'Lac': '蝎虎', 'Leo': '狮子', 'Lep': '天兔',
    'Lib': '天秤', 'Lup': '豺狼', 'Lyn': '天猫', 'Lyr': '天琴', 'Men': '山案', 'Mic': '显微镜', 'Mon': '麒麟', 'Mus': '苍蝇',
    'Nor': '矩尺', 'Oct': '南极', 'Oph': '蛇夫', 'Ori': '猎户', 'Pav': '孔雀', 'Peg': '飞马', 'Per': '英仙', 'Phe': '凤凰',
    'Pic': '绘架', 'PsA': '南鱼', 'Psc': '双鱼', 'Pup': '船尾', 'Pyx': '罗盘', 'Ret': '网罟', 'Scl': '玉夫', 'Sco': '天蝎',
    'Sct': '盾牌', 'Ser': '巨蛇', 'Sex': '六分仪', 'Sge': '天箭', 'Sgr': '人马', 'Tau': '金牛', 'Tel': '望远镜', 'TrA': '南三角',
    'Tri': '三角', 'Tuc': '杜鹃', 'UMa': '大熊', 'UMi': '小熊', 'Vel': '船帆', 'Vir': '室女', 'Vol': '飞鱼', 'Vul': '狐狸',
}
ZODIAC_OF_IAU = frozenset(('Ari', 'Tau', 'Gem', 'Cnc', 'Leo', 'Vir', 'Lib', 'Sco', 'Oph', 'Sgr', 'Cap', 'Aqr', 'Psc'))
# 银心 J2000:赤经 266.405°、赤纬 −28.936°
GALACTIC_CENTER_RA_DEC = (266.405, -28.936)
EQ_J2000 = swisseph.FLG_SWIEPH | swisseph.FLG_EQUATORIAL | swisseph.FLG_J2000 | swisseph.FLG_NONUT | swisseph.FLG_NOABERR
BODY_IDS = {const.SUN: swisseph.SUN, const.MOON: swisseph.MOON, const.MERCURY: swisseph.MERCURY, const.VENUS: swisseph.VENUS,
            const.MARS: swisseph.MARS, const.JUPITER: swisseph.JUPITER, const.SATURN: swisseph.SATURN,
            const.URANUS: swisseph.URANUS, const.NEPTUNE: swisseph.NEPTUNE, const.PLUTO: swisseph.PLUTO}
# 跨界搜索的步长(日)。星体可能只是擦过边界的一角,步长要压到这种短暂进出也抓得住;
# 比步长还短的擦角仍可能漏,这里按 60 年密步长对比定的值。
SEARCH_STEP = {const.MOON: 0.02, const.SUN: 1.0, const.MERCURY: 0.05, const.VENUS: 0.1, const.MARS: 0.1}
SEARCH_STEP_SLOW = 2.0
AROUND_LIMIT_DAYS = 120 * 365.25
YEAR_DAYS = 365.25
TIME_TOLERANCE = 1.0 / 1440.0


def norm360(value):
    return value % 360.0


def general_precession(jd):
    """J2000 起算的黄经总岁差(度)。"""
    t = (jd - J2000) / 36525.0
    return (5028.796195 * t + 1.1054348 * t * t) / 3600.0


def version_start(version, jd):
    start = version['start']
    return norm360(start + general_precession(jd)) if version['moves'] else start


def locate(version, lon, jd):
    """回归黄经落在哪一段:(段序, 段内度, 折算到等分后的度)。"""
    lengths = version['lengths']
    remain = norm360(lon - version_start(version, jd))
    for index, length in enumerate(lengths):
        if remain < length:
            return index, remain, remain * (360.0 / len(lengths)) / length
        remain -= length
    return len(lengths) - 1, lengths[-1], 360.0 / len(lengths)


def _version_row(key, version, lon, jd):
    index, inside, equal = locate(version, lon, jd)
    return {'version': key, 'sign': GROUP_SIGNS[version['group']][index], 'signIndex': index, 'deg': inside, 'equalDeg': equal}


def version_table(key, jd):
    """某版本一圈的座头表,给页面画环用。"""
    version = ZODIAC_VERSIONS[key]
    names = GROUP_SIGNS[version['group']]
    start = version_start(version, jd)
    rows = []
    for index, length in enumerate(version['lengths']):
        rows.append({'sign': names[index], 'start': norm360(start), 'length': length})
        start += length
    return rows


def _precession_angles(t):
    """IAU 1976:zeta、z、theta(度),t 为 J2000 起的儒略世纪。"""
    zeta = (2306.2181 + (0.30188 + 0.017998 * t) * t) * t / 3600.0
    zed = (2306.2181 + (1.09468 + 0.018203 * t) * t) * t / 3600.0
    theta = (2004.3109 - (0.42665 + 0.041833 * t) * t) * t / 3600.0
    return zeta, zed, theta


def j2000_to_b1875(ra, dec):
    """J2000 赤道坐标岁差到 B1875(边界表的坐标)。"""
    zeta, zed, theta = _precession_angles((B1875 - J2000) / 36525.0)
    a, d = math.radians(ra + zeta), math.radians(dec)
    th = math.radians(theta)
    x = math.cos(d) * math.cos(a) * math.cos(th) - math.sin(d) * math.sin(th)
    y = math.cos(d) * math.sin(a)
    z = math.cos(d) * math.cos(a) * math.sin(th) + math.sin(d) * math.cos(th)
    return norm360(math.degrees(math.atan2(y, x)) + zed), math.degrees(math.asin(max(-1.0, min(1.0, z))))


def constellation_of(ra, dec):
    """J2000 赤经赤纬所在的星座缩写。"""
    ra0, dec0 = j2000_to_b1875(ra, dec)
    hours = ra0 / 15.0
    for low, high, floor, name in IAU_BLOCKS:
        if low <= hours < high and dec0 >= floor:
            return name
    return 'Oct'


def _equatorial(jd, name):
    row = swisseph.calc_ut(jd, BODY_IDS[name], EQ_J2000)[0]
    return row[0], row[1]


def _constellation_at(jd, name):
    return constellation_of(*_equatorial(jd, name))


def _crossing(name, low, high):
    """low 与 high 两侧不同座,二分到分钟。"""
    before = _constellation_at(low, name)
    while high - low > TIME_TOLERANCE:
        mid = (low + high) / 2.0
        if _constellation_at(mid, name) == before:
            low = mid
        else:
            high = mid
    return high


def _scan(name, jd, direction, limit):
    step = SEARCH_STEP.get(name, SEARCH_STEP_SLOW) * direction
    here = _constellation_at(jd, name)
    done = 0.0
    while done < limit:
        following = jd + (done + abs(step)) * direction
        there = _constellation_at(following, name)
        if there != here:
            previous = jd + done * direction
            low, high = (previous, following) if direction > 0 else (following, previous)
            return _crossing(name, low, high)
        done += abs(step)
    return None


def _event(name, moment, zone):
    after = _constellation_at(moment + TIME_TOLERANCE, name)
    before = _constellation_at(moment - TIME_TOLERANCE, name)
    return {'id': name, 'from': before, 'to': after, 'fromName': IAU_NAMES.get(before, before), 'toName': IAU_NAMES.get(after, after),
            'date': date_time_from_jd(moment, zone)['datetime']}


def around_crossings(jd, zone):
    """每颗星上一次、下一次换星座。"""
    rows = []
    for name in BODY_IDS:
        last = _scan(name, jd, -1, AROUND_LIMIT_DAYS)
        following = _scan(name, jd, 1, AROUND_LIMIT_DAYS)
        here = _constellation_at(jd, name)
        speed = swisseph.calc_ut(jd, BODY_IDS[name], swisseph.FLG_SWIEPH | swisseph.FLG_SPEED)[0][3]
        rows.append({
            'id': name, 'con': here, 'conName': IAU_NAMES.get(here, here), 'retro': speed < 0,
            'last': _event(name, last, zone) if last else None, 'lastDays': (jd - last) if last else None,
            'next': _event(name, following, zone) if following else None, 'nextDays': (following - jd) if following else None,
        })
    return rows


def year_crossings(jd, zone):
    """此后一年内所有跨界,月亮太频繁不列。"""
    events = []
    for name in BODY_IDS:
        if name == const.MOON:
            continue
        cursor = jd
        end = jd + YEAR_DAYS
        while cursor < end:
            moment = _scan(name, cursor, 1, end - cursor)
            if moment is None:
                break
            events.append((moment, _event(name, moment, zone)))
            cursor = moment + 2 * TIME_TOLERANCE
    events.sort(key=lambda item: item[0])
    return [row for _, row in events]


def _body_rows(perchart, jd):
    """本命各点:回归黄经、J2000 赤道坐标。盘可能是恒星黄道,一律回到回归黄经上分段。"""
    chart = perchart.chart
    offset = norm360(swisseph.calc_ut(jd, swisseph.SUN, swisseph.FLG_SWIEPH)[0][0] - chart.get(const.SUN).lon)
    eps = swisseph.calc_ut(jd, swisseph.ECL_NUT)[0][0]
    rows = []
    for point in chart_points(perchart, include_angles=True):
        name = point['id']
        lon = norm360(point['lon'] + offset)
        if name in BODY_IDS:
            ra, dec = _equatorial(jd, name)
        else:
            ra, dec = _point_equatorial(jd, lon, point.get('lat') or 0.0, eps)
        rows.append({'id': name, 'lon': lon, 'ra': ra, 'dec': dec})
    return rows


def _point_equatorial(jd, lon, lat, eps):
    """四轴、交点、小行星:当日赤道坐标岁差回 J2000。小行星的黄纬可达十几度,不能丢。"""
    ra, dec = swisseph.cotrans((lon, lat, 1.0), -eps)[:2]
    zeta, zed, theta = _precession_angles((jd - J2000) / 36525.0)
    a, d = math.radians(ra - zed), math.radians(dec)
    th = math.radians(theta)
    x = math.cos(d) * math.cos(a) * math.cos(th) + math.sin(d) * math.sin(th)
    y = math.cos(d) * math.sin(a)
    z = -math.cos(d) * math.cos(a) * math.sin(th) + math.sin(d) * math.cos(th)
    return norm360(math.degrees(math.atan2(y, x)) - zeta), math.degrees(math.asin(max(-1.0, min(1.0, z))))


def galactic_center_lon(jd):
    """银心的回归黄经:J2000 黄经加岁差。"""
    eps_j2000 = 23.4392911
    lon = swisseph.cotrans((GALACTIC_CENTER_RA_DEC[0], GALACTIC_CENTER_RA_DEC[1], 1.0), eps_j2000)[0]
    return norm360(lon + general_precession(jd))


def galactic_row(lon, center):
    value = norm360(lon - center)
    return {'lon': value, 'sign': SIGNS_12[int(value // 30.0)], 'deg': value % 30.0}


THIRTEEN_HOUSES = 13


def thirteen_house_cusps(asc):
    """十三宫宫头:上升为第 1 宫头,此后每宫的宽度依次取十三星座甲本(白羊段起)的各座长度,一圈合 360°。"""
    cusps = [norm360(asc)]
    for length in ZODIAC_VERSIONS['z13a']['lengths'][:-1]:
        cusps.append(norm360(cusps[-1] + length))
    return cusps


def thirteen_house(lon, asc):
    """点在十三宫的位置:宫号 1~13、离本宫宫头的黄经度数、宫内已走比例。"""
    lengths = ZODIAC_VERSIONS['z13a']['lengths']
    d = norm360(lon - asc)
    for index, length in enumerate(lengths):
        if d < length or index == THIRTEEN_HOUSES - 1:
            return {'house': index + 1, 'deg': d, 'fraction': min(d / length, 1.0)}
        d -= length
    return None


def build_zodiac_systems(data):
    data = dict(data or {})
    params = base_params(data)
    key = data.get('zodiacVersion') if data.get('zodiacVersion') in ZODIAC_VERSIONS else 'z13a'
    terms = None
    try:
        terms = push_classical_request(data)
        perchart = PerChart(params)
        jd = perchart.dateTime.jd
        zone = params.get('zone')
        center = galactic_center_lon(jd)
        bodies = _body_rows(perchart, jd)
        asc = next((row['lon'] for row in bodies if row['id'] == const.ASC), None)
        rows = []
        for body in bodies:
            con = constellation_of(body['ra'], body['dec'])
            rows.append({
                **body,
                'con': con, 'conName': IAU_NAMES.get(con, con), 'onZodiac': con in ZODIAC_OF_IAU,
                'versions': {k: _version_row(k, v, body['lon'], jd) for k, v in ZODIAC_VERSIONS.items()},
                'galactic': galactic_row(body['lon'], center),
                'houses13': thirteen_house(body['lon'], asc) if asc is not None else None,
            })
        return {
            'version': key,
            'versions': [{'key': k, 'label': v['label'], 'group': v['group'], 'moves': v['moves']} for k, v in ZODIAC_VERSIONS.items()],
            'wheel': version_table(key, jd),
            'galacticCenter': center,
            'houses13Cusps': thirteen_house_cusps(asc) if asc is not None else [],
            'rows': rows,
            'around': around_crossings(jd, zone),
            'year': year_crossings(jd, zone),
        }
    finally:
        pop_classical_request(terms)
