# -*- coding: utf-8 -*-
"""meteorology.py — 气象占:逐个朔望取天气主星。

每个朔望(朔、望)取一个关键度数:朔取合朔黄经;望取那一刻在地平线上的发光体的黄经。
从这个度数沿黄道顺行碰到的第一个角(上升、天顶、天底、下降)记下,并取该角所在星座的主星。
关键度数的埃及界主是天气主星,列它所在的星座、与日十六相与几项条件:
    SIGN 恒有;LAT_N / LAT_S 黄纬南北;RETRO 逆行;STATION 留;SUB_RADIIS 在日光束内(15°);
    MORNING / EVENING 在光束外时东出 / 西入(留时不标);ELONG 水金接近最大距角。
关键度数或那个角 1.6° 内的亮星列出,带托勒密给的行星性质。
太阳入白羊、巨蟹、天秤、摩羯前的最后一次朔望标为季节朔望。判词不收,只给结构。
"""
import math

import swisseph
from flatlib import const
from flatlib.dignities import essential

from astrostudy.astroextra_parts.common import date_time_from_jd
from astrostudy.chart_details import BODY_IDS, INNER_PHASES, INNER_PLANETS, MEAN_SPEEDS, OUTER_PHASES, STATION_RATIO, fold180, sun_phase, time_position
from astrostudy.directed_figures import norm360

FLAGS = swisseph.FLG_SWIEPH
SYNODIC = 29.530588853
BEAMS = 15.0
STAR_ORB = 1.6
MAX_ELONGATION = {'Mercury': 27.8, 'Venus': 47.8}
ELONG_SHARE = 0.97
# 改进档:与「本次视现期的大距」比,不与常数比 —— 水星各次大距 17.8°~27.8° 不等、金星 45.3°~47.3°,
# 拿 27.8 / 47.8 的 97% 当门槛,水星八成多的大距永远够不着。往前后沿同一侧(东或西)找距角最大处,搜索半宽取半个会合周期。
APPARITION_HALF = {'Mercury': 58.0, 'Venus': 292.0}


def apparition_max_elongation(name, jd):
    """jd 所在这一侧(晨或昏)视现期内的最大距角(绝对值)。逐日取样,够用到 0.01° 量级。"""
    def elong(t):
        return fold180(_calc(t, name)[0] - _calc(t, 'Sun')[0])
    here = elong(jd)
    side = 1.0 if here >= 0 else -1.0
    best = abs(here)
    for direction in (1.0, -1.0):
        t = jd
        while abs(t - jd) < APPARITION_HALF[name]:
            t += direction
            e = elong(t)
            if e * side < 0:
                break
            best = max(best, abs(e))
    return best
ANGLE_IDS = ('Asc', 'MC', 'IC', 'Desc')
PLANETS = ('Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn')
# 亮星与托勒密的行星性质(次序即性质的主次)
STAR_NATURES = {
    'Acamar': ('Jupiter',), 'Acubens': ('Saturn', 'Mercury'), 'Adhafera': ('Saturn', 'Mercury'), 'Adhara': ('Venus',),
    'Al Jabhah': ('Saturn', 'Mercury'), 'Alderamin': ('Saturn', 'Jupiter'), 'Algedi': ('Venus', 'Mars'), 'Algenib': ('Mars', 'Mercury'),
    'Algenubi': ('Saturn', 'Mars'), 'Algol': ('Jupiter', 'Saturn'), 'Alkes': ('Venus', 'Mercury'), 'Alnilam': ('Jupiter', 'Saturn'),
    'Alphard': ('Saturn', 'Venus'), 'Alphecca': ('Venus', 'Mercury'), 'Alpheratz': ('Mars', 'Mercury'), 'Alrescha': ('Mars', 'Mercury'),
    'Arneb': ('Saturn', 'Mercury'), 'Ascella': ('Jupiter', 'Mercury'), 'Asellus Australis': ('Mars', 'Sun'), 'Asellus Borealis': ('Mars', 'Sun'),
    'Bellatrix': ('Mars', 'Mercury'), 'Capella': ('Mars', 'Mercury'), 'Caph': ('Saturn', 'Venus'), 'Castor': ('Mercury',),
    'Dabih': ('Saturn', 'Venus'), 'Deneb Algedi': ('Saturn', 'Jupiter'), 'Denebola': ('Saturn', 'Venus'), 'Diphda': ('Saturn',),
    'Dubhe': ('Mars',), 'Elnath': ('Mars',), 'Gienah': ('Mars', 'Saturn'), 'Hamal': ('Mars', 'Saturn'), 'Izar': ('Mercury', 'Saturn'),
    'Khambalia': ('Mercury', 'Mars'), 'Kochab': ('Saturn', 'Venus'), 'Lesath': ('Mercury', 'Mars'), 'Menkalinan': ('Mars', 'Mercury'),
    'Menkent': ('Venus', 'Mercury'), 'Mintaka': ('Jupiter', 'Saturn'), 'Mirach': ('Venus',), 'Mirzam': ('Venus',), 'Nashira': ('Saturn', 'Jupiter'),
    'Nunki': ('Jupiter', 'Mercury'), 'Porrima': ('Mercury', 'Venus'), 'Praesepe': ('Mars', 'Moon'), 'Ras Algethi': ('Mercury',),
    'Rasalhague': ('Saturn', 'Venus'), 'Regulus': ('Mars', 'Jupiter'), 'Rigel': ('Jupiter', 'Saturn'), 'Rukbat': ('Jupiter', 'Saturn'),
    'Sadalmelik': ('Saturn', 'Mercury'), 'Sadalsuud': ('Saturn', 'Mercury'), 'Scheat': ('Mars', 'Mercury'), 'Shaula': ('Mercury', 'Mars'),
    'Toliman': ('Venus', 'Jupiter'), 'Vega': ('Venus', 'Mercury'), 'Vindemiatrix': ('Saturn', 'Mercury'), 'Zavijava': ('Mercury', 'Mars'),
    'Zosma': ('Saturn', 'Venus'), 'Zubenelgenubi': ('Jupiter', 'Mercury'), 'Zubeneschamali': ('Jupiter', 'Mercury'),
}
# 改进档补上《四书》I.9 写了性质、而上表没收的亮星(多颗就在黄道上,关键度数旁最常碰到)。经典档只用上表 61 颗。
STAR_NATURES_BRIGHT = {
    'Aldebaran': ('Mars',), 'Alcyone': ('Moon', 'Jupiter'), 'Pollux': ('Mars',), 'Spica': ('Venus', 'Mars'),
    'Arcturus': ('Jupiter', 'Mars'), 'Antares': ('Mars', 'Jupiter'), 'Altair': ('Mars', 'Jupiter'),
    'Fomalhaut': ('Venus', 'Mercury'), 'Sirius': ('Jupiter', 'Mars'), 'Procyon': ('Mercury', 'Mars'),
    'Betelgeuse': ('Mars', 'Mercury'), 'Deneb': ('Venus', 'Mercury'), 'Achernar': ('Jupiter',), 'Canopus': ('Saturn', 'Jupiter'),
}


def star_natures(classic=False):
    if classic:
        return STAR_NATURES
    table = dict(STAR_NATURES)
    table.update(STAR_NATURES_BRIGHT)
    return table


# 星历库星表里名字不同的两颗
STAR_LOOKUP = {'Praesepe': ',M44', 'Algenubi': ',epLeo'}
# 埃及界:(界止度, 主星)
EGYPTIAN_TERMS = (
    ((6, 'Jupiter'), (12, 'Venus'), (20, 'Mercury'), (25, 'Mars'), (30, 'Saturn')),
    ((8, 'Venus'), (14, 'Mercury'), (22, 'Jupiter'), (27, 'Saturn'), (30, 'Mars')),
    ((6, 'Mercury'), (12, 'Jupiter'), (17, 'Venus'), (24, 'Mars'), (30, 'Saturn')),
    ((7, 'Mars'), (13, 'Venus'), (19, 'Mercury'), (26, 'Jupiter'), (30, 'Saturn')),
    ((6, 'Jupiter'), (11, 'Venus'), (18, 'Saturn'), (24, 'Mercury'), (30, 'Mars')),
    ((7, 'Mercury'), (17, 'Venus'), (21, 'Jupiter'), (28, 'Mars'), (30, 'Saturn')),
    ((6, 'Saturn'), (14, 'Mercury'), (21, 'Jupiter'), (28, 'Venus'), (30, 'Mars')),
    ((7, 'Mars'), (11, 'Venus'), (19, 'Mercury'), (24, 'Jupiter'), (30, 'Saturn')),
    ((12, 'Jupiter'), (17, 'Venus'), (21, 'Mercury'), (26, 'Saturn'), (30, 'Mars')),
    ((7, 'Mercury'), (14, 'Jupiter'), (22, 'Venus'), (26, 'Saturn'), (30, 'Mars')),
    ((7, 'Mercury'), (13, 'Venus'), (20, 'Jupiter'), (25, 'Mars'), (30, 'Saturn')),
    ((12, 'Venus'), (16, 'Jupiter'), (19, 'Mercury'), (28, 'Mars'), (30, 'Saturn')),
)


def egyptian_term(lon):
    sign = int(norm360(lon) // 30)
    deg = norm360(lon) % 30
    for end, lord in EGYPTIAN_TERMS[sign]:
        if deg < end:
            return lord
    return EGYPTIAN_TERMS[sign][-1][1]


def _calc(jd, name, extra=0):
    return swisseph.calc_ut(jd, BODY_IDS[name], FLAGS | swisseph.FLG_SPEED | extra)[0]


def _syzygy(target, guess):
    t = guess
    for _ in range(30):
        moon, sun = _calc(t, 'Moon'), _calc(t, 'Sun')
        step = fold180(moon[0] - sun[0] - target) / (moon[3] - sun[3])
        t -= step
        if abs(step) < 1e-8:
            break
    return t


def syzygies(start, months):
    """start 之后 months 个月里的全部朔望,按时间排。"""
    out = []
    end = start + months * SYNODIC
    for target, kind in ((0.0, 'new'), (180.0, 'full')):
        moon, sun = _calc(start, 'Moon'), _calc(start, 'Sun')
        t = _syzygy(target, start + norm360(target - (moon[0] - sun[0])) / 12.19)
        while t < end:
            if t >= start:
                out.append((t, kind))
            t = _syzygy(target, t + SYNODIC)
    return sorted(out)


def _altitude(jd, name, lat, lon):
    pos = _calc(jd, name)
    return swisseph.azalt(jd, swisseph.ECL2HOR, (lon, lat, 0.0), 0.0, 0.0, (pos[0], pos[1], pos[2]))[1]


def _angles(jd, lat, lon):
    try:
        ascmc = swisseph.houses_ex(jd, lat, lon, b'P')[1]
    except swisseph.Error:
        ascmc = swisseph.houses_ex(jd, lat, lon, b'O')[1]
    asc, mc = norm360(ascmc[0]), norm360(ascmc[1])
    return {'Asc': asc, 'MC': mc, 'IC': norm360(mc + 180.0), 'Desc': norm360(asc + 180.0)}, ascmc[2]


def _star_positions(jd, natures=STAR_NATURES):
    out = []
    for star in natures:
        try:
            out.append((star, swisseph.fixstar2_ut(STAR_LOOKUP.get(star, star), jd, FLAGS)[0][0]))
        except Exception:
            continue
    return out


def _nearby_stars(stars, *points, natures=STAR_NATURES):
    hits = []
    for star, slon in stars:
        if any(abs(fold180(slon - p)) <= STAR_ORB for p in points):
            hits.append({'star': star, 'natures': list(natures[star])})
    return hits


def lord_conditions(name, jd, lat, lon, armc, classic=False):
    pos = _calc(jd, name)
    sun = _calc(jd, 'Sun')
    elong = fold180(pos[0] - sun[0])
    ratio = pos[3] / MEAN_SPEEDS[name]
    station = abs(ratio) <= STATION_RATIO
    conds = ['SIGN', 'LAT_N' if pos[1] >= 0 else 'LAT_S']
    if pos[3] < 0 and not station:
        conds.append('RETRO')
    if station:
        conds.append('STATION')
    if abs(elong) <= BEAMS:
        conds.append('SUB_RADIIS')
    elif not station:
        conds.append('MORNING' if elong < 0 else 'EVENING')
    if name in MAX_ELONGATION and abs(elong) > BEAMS:
        limit = MAX_ELONGATION[name] if classic else apparition_max_elongation(name, jd)
        if abs(elong) >= ELONG_SHARE * limit:
            conds.append('ELONG')
    eq = _calc(jd, name, swisseph.FLG_EQUATORIAL)
    sun_eq = _calc(jd, 'Sun', swisseph.FLG_EQUATORIAL)
    gap = abs(time_position(eq[0], eq[1], armc, lat) - time_position(sun_eq[0], sun_eq[1], armc, lat)) % 24.0
    hours = 24.0 - gap if gap > 12.0 else gap
    phase = sun_phase(name, elong, ratio, hours)
    return {'planet': name, 'lon': norm360(pos[0]), 'lat': pos[1], 'sign': int(norm360(pos[0]) // 30), 'phase': phase,
            'phaseName': (INNER_PHASES if name in INNER_PLANETS else OUTER_PHASES)[phase], 'elongation': elong, 'conditions': conds}


def _ingress_after(jd):
    """jd 之后太阳第一次进入四正座(0/90/180/270)的度数与时刻。"""
    sun = norm360(_calc(jd, 'Sun')[0])
    point = (int(sun // 90) + 1) * 90 % 360
    t = jd + norm360(point - sun) / 0.9856
    for _ in range(20):
        s = _calc(t, 'Sun')
        step = fold180(s[0] - point) / s[3]
        t -= step
        if abs(step) < 1e-8:
            break
    return float(point), t


def meteorology_rows(start, months, lat, lon, zone, classic=False):
    natures = star_natures(classic)
    stars_cache = None
    rows = []
    events = syzygies(start, months)
    for i, (jd, kind) in enumerate(events):
        moon, sun = _calc(jd, 'Moon'), _calc(jd, 'Sun')
        if kind == 'new':
            key, luminary = norm360(sun[0]), None
        else:
            # 望:取此刻在地平线上的那颗发光体
            luminary = 'Sun' if _altitude(jd, 'Sun', lat, lon) > _altitude(jd, 'Moon', lat, lon) else 'Moon'
            key = norm360((sun if luminary == 'Sun' else moon)[0])
        angles, armc = _angles(jd, lat, lon)
        angle = min(ANGLE_IDS, key=lambda a: norm360(angles[a] - key))
        if stars_cache is None or abs(stars_cache[0] - jd) > 3650.0:
            stars_cache = (jd, _star_positions(jd, natures))
        row = {'jd': jd, 'date': date_time_from_jd(jd, zone)['datetime'], 'kind': kind, 'lon': key, 'luminary': luminary,
               'angle': angle, 'angleLon': angles[angle], 'angleRuler': essential.ruler(const.LIST_SIGNS[int(angles[angle] // 30)]),
               'stars': _nearby_stars(stars_cache[1], key, angles[angle], natures=natures)}
        point, ing_jd = _ingress_after(jd)
        nxt = events[i + 1][0] if i + 1 < len(events) else _syzygy(0.0 if kind == 'full' else 180.0, jd + SYNODIC / 2.0)
        if ing_jd < nxt:
            row['season'] = {'point': point, 'date': date_time_from_jd(ing_jd, zone)['datetime']}
        row['lord'] = lord_conditions(egyptian_term(key), jd, lat, lon, armc, classic)
        rows.append(row)
    return rows
