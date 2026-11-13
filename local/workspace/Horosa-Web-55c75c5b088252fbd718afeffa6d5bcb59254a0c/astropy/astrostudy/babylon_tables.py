"""巴比伦天象表:七曜所行三道、ziqpu 星钟、目标年取数。

三道:赤纬绝对值 ≤ 17° 属 Anu 道,以北 Enlil 道,以南 Ea 道;m = 到最近道界的距离。
ziqpu 星钟:26 颗 ziqpu 星,时角 = 出生地的天顶赤经 − 星的赤经;距上次、下次过中天按 1 UŠ = 1° = 4 分钟、
    1 bēru = 30 UŠ = 2 小时折算;下次过中天的时刻按恒星日推算。
目标年:月亮 = 出生前 223 个平均朔望月(6585.32 日);其余星 = 同一民用日期减去各自周期年数
    (水 46、金 8、火 79 与 47、木 71 与 83、土 59)。列两时刻的黄经、距日与差,以及间隔折合的会合周期数与恒星周期数。
周期现象:五星出生前后各一个会合周期内的合、冲、留与四种偕日现象(晨始见 Γ、晨末见 Σ、夕始见 Ξ、夕末见 Ω)。
    合、冲、留是星历求根;偕日现象用星历库的可见度模型,观测者在出生地,气压 1013.25 mbar、15 °C、湿度 40%、年龄 26、
    双目视力 1,消光系数由星历库自算。出生时刻可见与否看此前最后一次偕日现象。纬度超过 65° 不算偕日现象(可见度模型在那里不成立,而且求解极慢)。
"""
import math
import re

import swisseph

import flatlib.ephem.swe  # noqa: F401  设星历路径
from flatlib.datetime import Datetime

from astrostudy.astroextra_parts.common import base_params, date_time_from_jd
from astrostudy.civil_calendar import parse_civil_date, civil_julday, civil_ymd_valid, display_year

PATH_LIMIT = 17.0
FLAGS = swisseph.FLG_SWIEPH
SEVEN = [('Sun', swisseph.SUN), ('Moon', swisseph.MOON), ('Mercury', swisseph.MERCURY), ('Venus', swisseph.VENUS),
         ('Mars', swisseph.MARS), ('Jupiter', swisseph.JUPITER), ('Saturn', swisseph.SATURN)]

# 26 颗 ziqpu 星:星表名(星历库认得的)或 J2000 赤经赤纬(星历库没有的两颗,自行岁差);iv = 古文里与上一星的间隔(UŠ)
ZIQPU_STARS = [
    ('ŠUDUN, ŠU.PA', '轭', 'Arcturus', None, 8), ('ŠUDUN.ANŠE EGIR-ti', '后轭', ',epBoo', None, 9),
    ('kip-pat, MUL BAL.TEŠ₂.A', '冠环', 'Alphecca', None, 12), ('MUL ša₂ maš-a-ti', '双星之星', 'Kornephoros', None, 15),
    ('MUL ša₂ taš-ka-a-ti', '三星之星', 'Rasalgethi', None, 5), ('MUL DELE, MUL e-du', '孤星', ',muHer', None, 10),
    ('GAŠAN TIN, UZ₃', '生命女主 · 母山羊', 'Vega', None, 10), ('qu₂-ma-ri ša₂ UD.KA.DUH.A', '豹之肩', 'Sadr', None, 20),
    ('MUL ni-bi-i ša₂ GABA-šu₂', '其胸亮星', 'Deneb', None, 10), ('kin-si', '膝', ',alLac', None, 20),
    ('a-si-di', '踵', ',laAnd', None, 20), ('4 ša₂ LU.LIM', '牡鹿四星', 'Schedar', None, 10),
    ('um-mu-lu-ti', '暗星', ',NGC869', None, 15), ('ni-bi-i ša₂ ŠU.GI', '老人亮星', 'Mirfak', None, 15),
    ('na-aṣ-ra-pi', 'Naṣrapu', None, (62.165375, 47.7125), 10), ('GAM₃, gam-lu', '弯杖', 'Capella', None, 15),
    ('KIŠIB GAM₃, rit-ti GAM₃', '弯杖之手', None, (80.440417, 41.804583), 10), ('MAŠ.TAB.BA, MAŠ.MAŠ', '双子', 'Castor', None, 30),
    ('MAŠ.TAB.BA EGIR-û', '后双子', 'Pollux', None, 5), ('AL.LUL, ALLA', '蟹', ',M44', None, 20),
    ('2 MULᵐᵉš ša₂ SAG.DU UR.GU.LA', '狮首二星', ',epLeo', None, 20), ('4 ša₂ GABA-šu₂', '其胸四星', 'Regulus', None, 10),
    ('2 ša₂ GIŠ.KUN-šu₂', '其股二星', 'Zosma', None, 20), ('DELE ša₂ KUN-šu₂', '其尾孤星', 'Denebola', None, 10),
    ('e₄-ru₆', '叶 · Eru', ',gaCom', None, 10), ('ŠUDUN.ANŠE, na-dul-lum', '挽具', 'Muphrid', None, 25),
]
ZIQPU_IDS = ['α Boo', 'ε Boo', 'α CrB', 'β Her', 'α Her', 'μ Her', 'α Lyr', 'γ Cyg', 'α Cyg', 'α Lac', 'λ And', 'α Cas', 'NGC 869', 'α Per',
             '48 Per', 'α Aur', 'ρ Aur', 'α Gem', 'β Gem', 'M44', 'ε Leo', 'α Leo', 'δ Leo', 'β Leo', 'γ Com', 'η Boo']

GOAL_PERIODS = [('Mercury', swisseph.MERCURY, 46), ('Venus', swisseph.VENUS, 8), ('Mars', swisseph.MARS, 79), ('Mars', swisseph.MARS, 47),
                ('Jupiter', swisseph.JUPITER, 71), ('Jupiter', swisseph.JUPITER, 83), ('Saturn', swisseph.SATURN, 59)]
MOON_GOAL_DAYS = 223 * 29.530594
SYNODIC = {'Moon': 29.530589, 'Mercury': 115.8775, 'Venus': 583.9214, 'Mars': 779.9361, 'Jupiter': 398.8840, 'Saturn': 378.0919}
SIDEREAL = {'Moon': 27.321662, 'Mercury': 87.9691, 'Venus': 224.7008, 'Mars': 686.9796, 'Jupiter': 4332.589, 'Saturn': 10759.22}


def _precess(ra, dec, jd):
    """J2000 赤经赤纬 → 当日平赤经赤纬(1976 IAU 岁差;两颗暗星不计自行)。"""
    t = (jd - 2451545.0) / 36525.0
    zeta = math.radians((2306.2181 * t + 0.30188 * t * t + 0.017998 * t ** 3) / 3600.0)
    z = math.radians((2306.2181 * t + 1.09468 * t * t + 0.018203 * t ** 3) / 3600.0)
    theta = math.radians((2004.3109 * t - 0.42665 * t * t - 0.041833 * t ** 3) / 3600.0)
    a, d = math.radians(ra), math.radians(dec)
    A = math.cos(d) * math.sin(a + zeta)
    B = math.cos(theta) * math.cos(d) * math.cos(a + zeta) - math.sin(theta) * math.sin(d)
    C = math.sin(theta) * math.cos(d) * math.cos(a + zeta) + math.cos(theta) * math.sin(d)
    return (math.degrees(math.atan2(A, B) + z)) % 360.0, math.degrees(math.asin(max(-1.0, min(1.0, C))))


def _equatorial(jd, body):
    x = swisseph.calc_ut(jd, body, FLAGS | swisseph.FLG_EQUATORIAL)[0]
    return x[0], x[1]


def path_of(dec):
    if abs(dec) <= PATH_LIMIT:
        return 'Anu', PATH_LIMIT - abs(dec)
    return ('Enlil', dec - PATH_LIMIT) if dec > 0 else ('Ea', -PATH_LIMIT - dec)


def _paths(jd):
    rows = []
    for name, body in SEVEN:
        ra, dec = _equatorial(jd, body)
        path, margin = path_of(dec)
        rows.append({'id': name, 'decl': dec, 'path': path, 'margin': margin})
    return rows


def _beru(deg):
    us = int(round(deg)) % 360          # 取最近的整 UŠ;满 360 归零,分钟随之归零
    minutes = 0.0 if deg % 360.0 >= 359.5 else (deg % 360.0) * 4.0     # 只在凑满一整圈时归零
    return {'beru': us // 30, 'us': us % 30, 'minutes': minutes}


def _ziqpu(jd, lat, lon, zone):
    ramc = swisseph.houses_ex(jd, lat, lon, b'W')[1][2]     # 天顶赤经与分宫制无关;整宫制在极圈内也不报错
    rows = []
    for index, (cun, cn, star, j2000, iv) in enumerate(ZIQPU_STARS):
        if star:
            ra, dec = swisseph.fixstar2_ut(star, jd, FLAGS | swisseph.FLG_EQUATORIAL)[0][:2]
        else:
            ra, dec = _precess(j2000[0], j2000[1], jd)
        ha = (ramc - ra) % 360.0
        next_jd = jd + (360.0 - ha) / 360.98564736629
        rows.append({'no': index + 1, 'cun': cun, 'name': cn, 'star': ZIQPU_IDS[index], 'ra': ra, 'decl': dec, 'path': path_of(dec)[0],
                     'iv': iv, 'ha': ha, 'ago': _beru(ha), 'in': _beru(360.0 - ha), 'next': date_time_from_jd(next_jd, zone)['datetime']})
    for i, row in enumerate(rows):
        prev = rows[i - 1]
        row['civ'] = (row['ra'] - prev['ra']) % 360.0           # 本星与上一颗 ziqpu 星的赤经差(实算间隔)
    now = min(rows, key=lambda r: r['ha'])
    nxt = max(rows, key=lambda r: r['ha'])
    now['state'], nxt['state'] = 'now', 'next'
    return {'ramc': ramc, 'rows': rows}


def _elong(jd, body):
    lon = swisseph.calc_ut(jd, body, FLAGS)[0][0]
    sun = swisseph.calc_ut(jd, swisseph.SUN, FLAGS)[0][0]
    return lon, (lon - sun + 540.0) % 360.0 - 180.0


def _zone_hours(zone):
    match = re.match(r'^([+-]?)(\d{1,2}):?(\d{2})?$', str(zone or '+00:00').strip())
    if not match:
        return 0.0
    return (-1.0 if match.group(1) == '-' else 1.0) * (int(match.group(2)) + int(match.group(3) or 0) / 60.0)


def _goal_year(jd, params):
    """年份按天文纪年相减(公元前 1 年 = 0 年,跨公元元年不错一年);2 月 29 日只在目标年没有这一天时退到 28 日。"""
    rows = []
    astro_y, m, d = parse_civil_date(params['date'], params.get('ad'))
    hh, mi, ss = (str(params.get('time', '12:00:00')).split(':') + ['0', '0'])[:3]
    hour = int(hh) + int(mi) / 60.0 + float(ss) / 3600.0
    zone = params.get('zone', '+00:00')
    offset = _zone_hours(zone)
    targets = [('Moon', swisseph.MOON, None, jd - MOON_GOAL_DAYS)]
    for name, body, years in GOAL_PERIODS:
        ty = astro_y - years
        day = d
        if m == 2 and d == 29 and not civil_ymd_valid(display_year(ty), 2, 29):
            day = 28
        targets.append((name, body, years, civil_julday(ty, m, day, hour) - offset / 24.0))
    for name, body, years, past in targets:
        lng0, el0 = _elong(past, body)
        lng, el = _elong(jd, body)
        span = jd - past
        rows.append({'id': name, 'years': years, 'date': date_time_from_jd(past, zone)['datetime'], 'lng0': lng0, 'lng': lng,
                     'dl': (lng - lng0 + 540.0) % 360.0 - 180.0, 'el0': el0, 'el': el, 'de': el - el0,
                     'syn': span / SYNODIC[name], 'sid': span / SIDEREAL[name]})
    return rows


PHENOMENA_PLANETS = [('Mercury', swisseph.MERCURY), ('Venus', swisseph.VENUS), ('Mars', swisseph.MARS), ('Jupiter', swisseph.JUPITER), ('Saturn', swisseph.SATURN)]
HELIACAL_ATMO = (1013.25, 15.0, 40.0, 0.0)      # 第四项 0 = 消光系数由星历库按前三项自算
HELIACAL_OBSERVER = (26.0, 1.0, 0.0, 0.0, 0.0, 0.0)
# 符号、阿卡德术语、事件编号(星历库:1 晨始见 · 2 夕末见 · 3 夕始见 · 4 晨末见)
HELIACAL_EVENTS = {1: ('Γ', 'IGI', 'morningFirst'), 2: ('Ω', 'ŠÚ', 'eveningLast'), 3: ('Ξ', 'IGI', 'eveningFirst'), 4: ('Σ', 'ŠÚ', 'morningLast')}
INNER = ('Mercury', 'Venus')


def _speed(jd, body):
    return swisseph.calc_ut(jd, body, FLAGS | swisseph.FLG_SPEED)[0][3]


def _roots(func, start, end, step):
    """func 在 [start, end] 内的过零点(步进找号变,二分到 1e-6 日);跳过 ±180 的折返。"""
    out = []
    t, v = start, func(start)
    while t < end:
        t2 = min(t + step, end)
        v2 = func(t2)
        if v * v2 < 0 and abs(v) < 90 and abs(v2) < 90:
            lo, hi, vl = t, t2, v
            for _ in range(40):
                mid = (lo + hi) / 2.0
                vm = func(mid)
                if vm * vl > 0:
                    lo, vl = mid, vm
                else:
                    hi = mid
            out.append((lo + hi) / 2.0)
        t, v = t2, v2
    return out


def _helio_events(start, end, geopos, name):
    events = []
    kinds = (1, 2, 3, 4) if name in INNER else (1, 2)
    for kind in kinds:
        t = start
        while t < end:
            try:
                res = swisseph.heliacal_ut(t, geopos, HELIACAL_ATMO, HELIACAL_OBSERVER, name, kind, FLAGS)
            except Exception:
                break           # 高纬或不可见:这一类事件不出
            jd = res[0] if isinstance(res, (list, tuple)) else res
            if not jd or jd <= t or jd > end:
                break
            events.append((jd, kind))
            t = jd + 1.0
    return events


POLAR_LATITUDE = 65.0
# 偕日现象(合日前后的始见末见)平常发生在离日不远处。每个会合周期各只有一次始见、一次末见:高纬夏夜天不够黑时,
# 它们会被推迟到离日很远才发生 —— 那仍是这次合日前后唯一的始见 / 末见,照列进周期序列,只标「高纬推迟」(delayed)。
HELIACAL_MAX_ELONGATION = 40.0


def _phenomena(jd, lat, lon, zone):
    geopos = (lon, lat, 0.0)
    polar = abs(lat) > POLAR_LATITUDE
    out = []
    for name, body in PHENOMENA_PLANETS:
        period = SYNODIC[name]
        start, end = jd - period, jd + period
        rows = []

        def elong(t, body=body):
            return _elong(t, body)[1]

        def opposite(t, body=body):
            e = _elong(t, body)[1]
            return (e + 360.0) % 360.0 - 180.0

        step = 2.0 if name in INNER else 5.0
        for t in _roots(elong, start, end, step):
            if name in INNER:
                kind = 'inferiorConjunction' if _speed(t, body) < 0 else 'superiorConjunction'
            else:
                kind = 'conjunction'
            rows.append({'jd': t, 'kind': kind, 'sym': ''})
        if name not in INNER:
            for t in _roots(opposite, start, end, step):
                rows.append({'jd': t, 'kind': 'opposition', 'sym': ''})
        for t in _roots(lambda x, body=body: _speed(x, body), start, end, step):
            turning_retro = _speed(t + 0.5, body) < 0
            if name in INNER:
                kind, sym = ('eveningStation', 'Ψ') if turning_retro else ('morningStation', 'Φ')
            else:
                kind, sym = ('firstStation', 'Φ') if turning_retro else ('secondStation', 'Ψ')
            rows.append({'jd': t, 'kind': kind, 'sym': sym, 'akk': 'UŠ'})
        # 偕日现象一次算到底:往前多找一个周期,用来判出生时可见与否;极圈内可见度模型不成立,不算
        found = [] if polar else sorted(_helio_events(jd - 2.0 * period, end, geopos, name))
        twilight = [(t, k) for t, k in found if abs(_elong(t, body)[1]) > HELIACAL_MAX_ELONGATION]
        for t, kind in found:
            if t < start:
                continue
            sym, akk, key = HELIACAL_EVENTS[kind]
            row = {'jd': t, 'kind': key, 'sym': sym, 'akk': akk}
            if (t, kind) in twilight:
                row['delayed'] = True
            rows.append(row)
        rows.sort(key=lambda r: r['jd'])
        before = [r for r in rows if r['jd'] <= jd]
        after = [r for r in rows if r['jd'] > jd]
        if before:
            before[-1]['state'] = 'last'
        if after:
            after[0]['state'] = 'next'
        # 出生时可见与否:此前最后一次偕日现象
        before_birth = [(t, k) for t, k in found if t <= jd]
        visible = None
        since = None
        by_twilight = False
        if before_birth:
            t, kind = before_birth[-1]
            visible = kind in (1, 3)
            since = date_time_from_jd(t, zone)['datetime']
            by_twilight = (t, kind) in twilight
        for r in rows:
            r['date'] = date_time_from_jd(r['jd'], zone)['datetime']
            r['days'] = r['jd'] - jd
        out.append({'id': name, 'visible': visible, 'since': since, 'events': rows, 'polar': polar,
                    'twilight': sum(1 for t, _ in twilight if start <= t <= end), 'visibleByTwilight': by_twilight})
    return out


def build_babylon_tables(data):
    data = data or {}
    params = base_params(data)
    jd = Datetime(params['date'], params['time'], params['zone']).jd
    from flatlib.geopos import GeoPos
    pos = GeoPos(params['lat'], params['lon'])
    out = {'paths': _paths(jd)}
    try:
        out['ziqpu'] = _ziqpu(jd, pos.lat, pos.lon, params['zone'])
    except Exception:
        out['ziqpu'] = None
    try:
        out['goalYear'] = _goal_year(jd, params)
    except Exception:
        out['goalYear'] = None
    try:
        out['phenomena'] = _phenomena(jd, pos.lat, pos.lon, params['zone'])
    except Exception:
        out['phenomena'] = None
    return out
