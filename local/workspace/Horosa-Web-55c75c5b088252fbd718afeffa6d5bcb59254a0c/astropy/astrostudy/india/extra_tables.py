# -*- coding: utf-8 -*-
"""extra_tables.py — 印占补充表:Graha Samaya、Dirah Bala、Dirah 西占版、七个 Sphuta、Ashtakoota。

一律用盘的黄道。标准式缺省,「经典」档保留传统算表的写法,差别写在各函数说明里。
"""
import swisseph
from flatlib import const

from astrostudy.india.india_chart_kernel import IndiaChartKernel, normalize_ayanamsa
from astrostudy.india.primitives import compound_relation, natural_relation, segment_index

SEVEN = (const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS, const.JUPITER, const.SATURN)
TEN = SEVEN + (const.URANUS, const.NEPTUNE, const.PLUTO)
SIGN_LORDS = (const.MARS, const.VENUS, const.MERCURY, const.MOON, const.SUN, const.MERCURY, const.VENUS, const.MARS, const.JUPITER, const.SATURN, const.SATURN, const.JUPITER)
OWN = {const.SUN: (4,), const.MOON: (3,), const.MERCURY: (2, 5), const.VENUS: (1, 6), const.MARS: (0, 7), const.JUPITER: (8, 11), const.SATURN: (9, 10)}
EXALT = {const.SUN: 0, const.MOON: 1, const.MERCURY: 5, const.VENUS: 11, const.MARS: 9, const.JUPITER: 3, const.SATURN: 6}
SAMAYA_A = dict(zip(SEVEN, (12, 20, 7, 13, 14, 5, 11)))
SAMAYA_C = dict(zip(SEVEN, (24, 13, 14, 26, 1, 10, 22)))
DIG_HOUSE = {const.SUN: 10, const.MARS: 10, const.MOON: 4, const.VENUS: 4, const.MERCURY: 1, const.JUPITER: 1, const.SATURN: 7}
HOUSE_BALA = {1: 40, 2: 0, 3: 0, 4: 30, 5: 20, 6: -15, 7: 30, 8: -25, 9: 20, 10: 40, 11: 20, 12: -25}
SLOW_SPEED = dict(zip(SEVEN, (0.962, 12.48, 0.45, 0.26, 0.13, 0.047, 0.027)))
SLOW_RETRO_RATIO = 0.6                 # 逆行段的分界是顺行段的六成
RETRO_BALA = {const.MERCURY: -15, const.VENUS: -15, const.MARS: -15, const.JUPITER: -10, const.SATURN: -10}
MOON_PHASE_BALA = ((30.0, -22), (45.0, -7), (130.0, 0), (150.0, 7), (180.0, 22), (240.0, -22), (270.0, -7), (315.0, 0), (330.0, 7), (360.0, 22))
DIRAH_NAMES = {1: '本座', 2: '擢升', 3: '落', 4: '至友', 5: '友', 6: '中性', 7: '敌', 8: '死敌', 9: '九分', 10: '方位', 11: '宫位', 12: '慢行', 13: '逆行', 14: '月相', 15: '座首尾', 16: '同座',
               19: '同九分'}
SYNERGY_HOUSES = {const.SUN: (5,), const.MOON: (4,), const.MERCURY: (3, 6), const.VENUS: (2, 7), const.MARS: (1,), const.JUPITER: (9,), const.SATURN: (10,), const.URANUS: (11,), const.NEPTUNE: (12,),
                  const.PLUTO: (8,)}
WESTERN_RADII = {const.SUN: 7.5, const.MOON: 6.0, const.MERCURY: 3.5, const.VENUS: 4.0, const.MARS: 3.5, const.JUPITER: 4.5, const.SATURN: 4.5, const.URANUS: 2.0, const.NEPTUNE: 2.0, const.PLUTO: 2.0,
                 const.NORTH_NODE: 2.5, const.ASC: 2.5, const.MC: 2.5}
WESTERN_RULERS = {const.URANUS: (10,), const.NEPTUNE: (11,), const.PLUTO: (7,)}
WESTERN_EXALT = {const.URANUS: 7, const.NEPTUNE: 3, const.PLUTO: 4}
ASPECTS = (0, 60, 90, 120, 180)


def norm360(value):
    return value % 360.0


def sign_of(lon):
    return int(norm360(lon) // 30)


def separation(a, b):
    return abs((a - b + 180.0) % 360.0 - 180.0)


class VedicView:
    """算表要用到的盘面量。lons 含十星、北交;黄道跟盘走。"""

    def __init__(self, lons, speeds, asc, mc, armc, phi, eps):
        self.lons = lons
        self.speeds = speeds
        self.asc = asc
        self.mc = mc
        self.armc = armc
        self.phi = phi
        self.eps = eps
        self.signs = {name: sign_of(lon) for name, lon in lons.items()}
        self.sign_names = {name: const.LIST_SIGNS[sign] for name, sign in self.signs.items()}
        self.points = dict(lons, **{const.ASC: asc, const.MC: mc})
        self.polar = abs(phi) >= 90.0 - eps

    def placidus(self, name, tropical_lon):
        """Placidus 世俗宫位,带小数。极圈内 Placidus 没有定义,退到 Porphyry。"""
        return swisseph.house_pos(self.armc, self.phi, self.eps, (tropical_lon, 0.0), b'O' if self.polar else b'P')


def graha_samaya_rows(view):
    """经验式:val = (a × (A + ((s − A) mod 12)) + c) mod 27。"""
    asc_sign = sign_of(view.asc)
    return [{'planet': name, 'value': (SAMAYA_A[name] * (asc_sign + ((view.signs[name] - asc_sign) % 12)) + SAMAYA_C[name]) % 27} for name in SEVEN]


def navamsa_sign(lon):
    return segment_index(norm360(lon), 10.0 / 3.0, 108) % 12


def _lord_relation(view, name):
    """本星看所在座之主的复合关系。"""
    lord = SIGN_LORDS[view.signs[name]]
    if lord == name:
        return None
    return compound_relation(name, lord, view.sign_names)


def moon_phase_points(elongation):
    for limit, points in MOON_PHASE_BALA:
        if elongation < limit:
            return points
    return MOON_PHASE_BALA[-1][1]


def _edge_points(within):
    if within < 1.0 or within > 29.0:
        return -10
    return -5 if within < 3.0 or within > 27.0 else 0


def _conjunction_points(view, name, order):
    """同座且序号在它之后的点:有火、土、罗、计 −10;否则有金、木 +10。"""
    sign = view.signs[name]
    later = [other for other in order[order.index(name) + 1:] if view.signs[other] == sign]
    if any(other in (const.MARS, const.SATURN, const.NORTH_NODE, const.SOUTH_NODE) for other in later):
        return -10
    return 10 if any(other in (const.VENUS, const.JUPITER) for other in later) else 0


def dirah_bala_row(view, name, tropical_lon, classic=False):
    """逐项得分。缺省档:死敌 −20,座首尾只看星自己;经典档:死敌按敌 −10,座首尾要下一颗星同座。"""
    lon = view.lons[name]
    sign = view.signs[name]
    scores = {}
    if sign in OWN[name]:
        scores[1] = 40
    if EXALT[name] == sign:
        scores[2] = 45
    if (EXALT[name] + 6) % 12 == sign:
        scores[3] = -45
    relation = None if sign in (EXALT[name], (EXALT[name] + 6) % 12) else _lord_relation(view, name)
    if relation == 'adhimitra':
        scores[4] = 20
    elif relation == 'mitra':
        scores[5] = 10
    elif relation == 'satru':
        scores[7] = -10
    elif relation == 'adhisatru':
        scores[7 if classic else 8] = -10 if classic else -20
    nav = navamsa_sign(lon)
    if nav in OWN[name] or EXALT[name] == nav:
        scores[9] = 10
    elif (EXALT[name] + 6) % 12 == nav:
        scores[9] = -10
    position = view.placidus(name, tropical_lon)
    apex = DIG_HOUSE[name]
    if 0.0 < (position - apex + 0.5) % 12.0 < 2.0:
        scores[10] = 15
    scores[11] = HOUSE_BALA[int(position)]
    if -SLOW_SPEED[name] * SLOW_RETRO_RATIO < view.speeds[name] < SLOW_SPEED[name]:
        scores[12] = 10
    if view.speeds[name] < 0 and name in RETRO_BALA:
        scores[13] = RETRO_BALA[name]
    if name == const.MOON:
        scores[14] = moon_phase_points(norm360(view.lons[const.MOON] - view.lons[const.SUN]))
    order = SEVEN + (const.NORTH_NODE, const.SOUTH_NODE)
    following = order[order.index(name) + 1]
    if not classic or view.signs[following] == sign:
        scores[15] = _edge_points(norm360(lon) % 30.0)
    scores[16] = _conjunction_points(view, name, order)
    if nav == sign:
        scores[19] = 5
    return {key: value for key, value in scores.items() if value}


def dirah_bala_rows(view, tropical, classic=False):
    rows = []
    for name in SEVEN:
        scores = dirah_bala_row(view, name, tropical[name], classic)
        rows.append({'planet': name, 'scores': {str(key): value for key, value in scores.items()}, 'sum': sum(scores.values())})
    return rows


def _in_aspect(a, b, orb):
    gap = separation(a, b)
    return any(abs(gap - angle) <= orb for angle in ASPECTS)


def dirah_western_row(view, name, tropical, classic=False):
    """西占版:本座、擢升、落、陷、8 12 宫、同序宫、相位多、与木星成相、逆行。每颗星都看木星,相位数不分先后。
    经典档不把水瓶算天王星的本座,其余相同。"""
    lon = view.lons[name]
    sign = view.signs[name]
    own = WESTERN_RULERS.get(name, OWN.get(name, ()))
    exalt = WESTERN_EXALT.get(name, EXALT.get(name))
    position = int(view.placidus(name, tropical[name]))
    scores = {}
    if sign in own and not (classic and name == const.URANUS):
        scores[1] = 1
    if exalt == sign:
        scores[2] = 2
    if exalt is not None and (exalt + 6) % 12 == sign:
        scores[3] = -2
    if any((item + 6) % 12 == sign for item in own):
        scores[4] = -1
    if position in (8, 12):
        scores[5] = -1
    synergy = SYNERGY_HOUSES[name]
    if position in synergy:
        scores[6] = 1
    others = [other for other in WESTERN_RADII if other != name and other in view.points]
    near = [other for other in others if _in_aspect(lon, view.points[other], WESTERN_RADII[name] + WESTERN_RADII[other])]
    if len(near) >= 3:
        scores[7] = 1
    if const.JUPITER in near:
        scores[8] = 1
    if view.speeds.get(name, 0.0) < 0 and name in (const.MERCURY, const.VENUS, const.MARS):
        scores[10] = -1
    return scores


def sphuta_rows(view, gulika):
    """七个 Sphuta,G 是土子。Beeja、Kshetra 在 sensitive_points。"""
    sun, moon, asc = view.lons[const.SUN], view.lons[const.MOON], view.asc
    node = view.lons[const.NORTH_NODE]
    tri = asc + moon + gulika
    prana = 5.0 * asc + gulika
    deha = 8.0 * moon + gulika
    mrityu = 7.0 * gulika + sun
    table = (('Trisphuta', tri), ('Chatusphuta', tri + sun), ('Panchasphuta', tri + sun + node), ('Prana', prana), ('Deha', deha), ('Mrityu', mrityu),
             ('Sookshma', prana + deha + mrityu))
    return [{'name': name, 'lon': norm360(value), 'sign': sign_of(value)} for name, value in table]


NAKSHATRA_SPAN = 360.0 / 27.0
VARNA_RANK = (3, 2, 1, 4, 3, 2, 1, 4, 3, 2, 1, 4)        # 火 3 · 土 2 · 风 1 · 水 4
# 每座能制约哪些座
VASHYA = ((4, 7), (3, 6), (5,), (7, 8), (6,), (2, 11), (9, 5), (3,), (11,), (0, 10), (0,), (9,))
YONI_OF = (0, 1, 2, 3, 3, 4, 5, 2, 5, 6, 6, 7, 8, 9, 8, 9, 10, 10, 4, 11, 12, 11, 13, 0, 13, 7, 1)
YONI_TABLE = (
    (4, 2, 2, 3, 2, 2, 2, 1, 0, 1, 3, 3, 2, 1), (2, 4, 3, 3, 2, 2, 2, 2, 3, 1, 2, 3, 2, 0), (2, 3, 4, 2, 1, 2, 1, 3, 3, 1, 2, 0, 3, 1), (3, 3, 2, 4, 2, 1, 1, 1, 1, 2, 2, 2, 0, 2),
    (2, 2, 1, 2, 4, 2, 1, 2, 2, 1, 0, 2, 1, 1), (2, 2, 2, 1, 2, 4, 0, 2, 2, 1, 3, 3, 2, 1), (2, 2, 1, 1, 1, 0, 4, 2, 2, 2, 2, 2, 1, 2), (1, 2, 3, 1, 2, 2, 2, 4, 3, 0, 3, 2, 2, 1),
    (0, 3, 3, 1, 2, 2, 2, 3, 4, 1, 2, 2, 2, 1), (1, 1, 1, 2, 1, 1, 2, 0, 1, 4, 1, 1, 2, 1), (3, 2, 2, 2, 0, 3, 2, 3, 2, 1, 4, 2, 2, 1), (3, 3, 0, 2, 2, 3, 2, 2, 2, 1, 2, 4, 3, 2),
    (2, 2, 3, 0, 1, 2, 1, 2, 2, 2, 2, 3, 4, 2), (1, 0, 1, 2, 1, 1, 2, 1, 1, 1, 1, 2, 2, 4),
)
GANA_OF = (0, 1, 2, 1, 0, 1, 0, 0, 2, 2, 1, 1, 0, 2, 0, 2, 0, 2, 2, 1, 1, 0, 2, 2, 1, 1, 0)   # 0 天 1 人 2 罗
GANA_TABLE = ((6, 6, 1), (5, 6, 0), (0, 0, 6))                                                   # 行男方,列女方
NADI_OF = (0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2)
VARNA_RANK_CLASSIC = (2, 4, 3, 1, 2, 4, 3, 1, 2, 4, 3, 1)  # 土 4 · 风 3 · 火 2 · 水 1
GANA_TABLE_CLASSIC = ((6, 6, 0), (5, 6, 0), (1, 0, 6))
KOOTA_NAMES = ('Varna', 'Vashya', 'Tara', 'Yoni', 'Graha Maitri', 'Gana', 'Bhakoot', 'Nadi')
KOOTA_MAX = (1, 2, 3, 4, 5, 6, 7, 8)
GRAHA_MAITRI = {('friend', 'friend'): 5.0, ('friend', 'neutral'): 4.0, ('neutral', 'neutral'): 3.0, ('enemy', 'friend'): 1.0, ('enemy', 'neutral'): 0.5, ('enemy', 'enemy'): 0.0}
GRAHA_MAITRI_CLASSIC = {('friend', 'friend'): 5.0, ('friend', 'neutral'): 4.0, ('neutral', 'neutral'): 3.0, ('enemy', 'friend'): 2.0, ('enemy', 'neutral'): 1.0, ('enemy', 'enemy'): 0.0}


def nakshatra_of(lon):
    return segment_index(norm360(lon), NAKSHATRA_SPAN, 27)


def _graha_maitri(a, b, classic=False):
    if a == b:
        return 3.0 if classic else 5.0
    table = GRAHA_MAITRI_CLASSIC if classic else GRAHA_MAITRI
    return table[tuple(sorted((natural_relation(a, b), natural_relation(b, a))))]


def _tara_points(groom, bride):
    """从一方的宿数到另一方,除 9 余 3、5、7 不吉;两向各 1.5。"""
    def good(start, end):
        return ((end - start) % 27 + 1) % 9 not in (3, 5, 7)

    return 1.5 * good(bride, groom) + 1.5 * good(groom, bride)


def _vashya_points(groom, bride):
    if groom == bride:
        return 2.0
    forward, backward = bride in VASHYA[groom], groom in VASHYA[bride]
    if forward and backward:
        return 2.0
    return 1.0 if forward or backward else 0.0


def _bhakoot_points(groom, bride):
    distance = (bride - groom) % 12 + 1
    return 0.0 if distance in (2, 12, 5, 9, 6, 8) else 7.0


def _doshas(groom_moon, bride_moon, gs, bs, gn, bn, glord, blord, nadi_same, bhakoot_bad):
    """Nadi、Bhakoot 两项落 0 分时的常见化解条件。只标出来,不改分(各家认不认、认几条说法不一)。
    Nadi:同座不同宿;同宿不同座;同宿不同足。Bhakoot:两座主星相同;两座主星互为自然之友。"""
    pada = lambda lon: int(norm360(lon) * 108.0 / 360.0) % 4
    nadi = []
    if nadi_same:
        if gs == bs and gn != bn:
            nadi.append('sameSignDifferentNakshatra')
        if gn == bn and gs != bs:
            nadi.append('sameNakshatraDifferentSign')
        if gn == bn and pada(groom_moon) != pada(bride_moon):
            nadi.append('sameNakshatraDifferentPada')
    bhakoot = []
    if bhakoot_bad:
        if glord == blord:
            bhakoot.append('sameSignLord')
        elif natural_relation(glord, blord) == 'friend' and natural_relation(blord, glord) == 'friend':
            bhakoot.append('friendlySignLords')
    return [{'koota': 'Nadi', 'present': nadi_same, 'cancel': nadi},
            {'koota': 'Bhakoot', 'present': bhakoot_bad, 'cancel': bhakoot}]


def ashtakoota(groom_moon, bride_moon):
    """八重合:男方、女方的月亮黄经 → 各项得分,满分 36。

    score 是通行表;classic 是另一套传统表,只有种姓、星主友谊、性情组三项不同。
    """
    gs, bs = sign_of(groom_moon), sign_of(bride_moon)
    gn, bn = nakshatra_of(groom_moon), nakshatra_of(bride_moon)
    glord, blord = SIGN_LORDS[gs], SIGN_LORDS[bs]
    gg, bg = GANA_OF[gn], GANA_OF[bn]
    nadi = 0.0 if NADI_OF[gn] == NADI_OF[bn] else 8.0
    standard = (
        1.0 if VARNA_RANK[gs] >= VARNA_RANK[bs] else 0.0, _vashya_points(gs, bs), _tara_points(gn, bn),
        float(YONI_TABLE[YONI_OF[gn]][YONI_OF[bn]]), _graha_maitri(glord, blord), float(GANA_TABLE[gg][bg]),
        _bhakoot_points(gs, bs), nadi)
    classic = list(standard)
    classic[0] = 1.0 if VARNA_RANK_CLASSIC[gs] >= VARNA_RANK_CLASSIC[bs] else 0.0
    classic[4] = _graha_maitri(glord, blord, True)
    classic[5] = float(GANA_TABLE_CLASSIC[gg][bg])
    rows = [{'name': name, 'max': top, 'score': score, 'classic': old}
            for name, top, score, old in zip(KOOTA_NAMES, KOOTA_MAX, standard, classic)]
    doshas = _doshas(groom_moon, bride_moon, gs, bs, gn, bn, glord, blord, nadi == 0.0, standard[6] == 0.0)
    return {'rows': rows, 'total': sum(standard), 'classicTotal': sum(classic), 'max': 36, 'doshas': doshas}


def _sidereal_moon(data, mode):
    params = dict(data, tradition=False, predictive=False, zodiacal=1, siderealMode=mode)
    return IndiaChartKernel(params).chart.get(const.MOON).lon


def build_ashtakoota(data):
    """合盘页入口:inner、outer 两张盘,maleSide 指哪张是男方(缺省 inner)。"""
    mode = normalize_ayanamsa(data.get('siderealAyanamsa'))
    inner = _sidereal_moon(data.get('inner') or {}, mode['key'])
    outer = _sidereal_moon(data.get('outer') or {}, mode['key'])
    male_is_outer = data.get('maleSide') == 'outer'
    groom, bride = (outer, inner) if male_is_outer else (inner, outer)
    result = ashtakoota(groom, bride)
    result['maleSide'] = 'outer' if male_is_outer else 'inner'
    result['ayanamsa'] = mode['label']
    result['groomNakshatra'] = nakshatra_of(groom) + 1
    result['brideNakshatra'] = nakshatra_of(bride) + 1
    result['groomSign'] = sign_of(groom)
    result['brideSign'] = sign_of(bride)
    return result


def _tropical_offset(chart, jd):
    """当前黄道与回归黄道的差。Placidus 位置要回归经度。"""
    return (swisseph.calc_ut(jd, swisseph.SUN)[0][0] - chart.get(const.SUN).lon) % 360.0


def _has_object(chart, name):
    """极端年份星历缺天海冥时,西占表少列这几颗,其余照出。"""
    try:
        chart.get(name)
    except Exception:
        return False
    return True


def view_of(perchart):
    """从印占本命盘取算表要用的盘面量。"""
    chart = perchart.chart
    jd = perchart.dateTime.jd
    lat = perchart.pos.lat
    names = [name for name in TEN + (const.NORTH_NODE, const.SOUTH_NODE) if _has_object(chart, name)]
    lons = {name: chart.get(name).lon for name in names}
    speeds = {name: chart.get(name).lonspeed for name in names}
    armc = swisseph.houses_ex(jd, lat, perchart.pos.lon, b'O')[1][2]
    eps = swisseph.calc_ut(jd, swisseph.ECL_NUT)[0][0]
    view = VedicView(lons, speeds, chart.get(const.ASC).lon, chart.get(const.MC).lon, armc, lat, eps)
    offset = _tropical_offset(chart, jd)
    return view, {name: norm360(lon + offset) for name, lon in lons.items()}


def build_extra_tables(perchart, gulika):
    """gulika 取不到(极地无日出)时 Sphuta 给空表,其余照出。"""
    view, tropical = view_of(perchart)
    return {
        'available': True,
        'polar': view.polar,
        'samaya': graha_samaya_rows(view),
        'dirah': dirah_bala_rows(view, tropical),
        'dirahClassic': dirah_bala_rows(view, tropical, classic=True),
        'dirahTypes': {str(key): value for key, value in DIRAH_NAMES.items()},
        'dirahWestern': [{'planet': name, 'scores': {str(key): value for key, value in dirah_western_row(view, name, tropical).items()}} for name in TEN if name in view.lons],
        'dirahWesternClassic': [{'planet': name, 'scores': {str(key): value for key, value in dirah_western_row(view, name, tropical, True).items()}} for name in TEN if name in view.lons],
        'sphuta': sphuta_rows(view, gulika) if gulika is not None else [],
    }
