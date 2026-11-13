"""南半球读法(southchart,仅南纬生效)只是把整张盘的星座读法转 180°:黄经标签整体 +180°,天上的东西一样没动。

所以凡是「物理」的量 —— 昼夜、地平上下、得时(hayyiz)、同派、落宫、赤经赤纬 —— 开不开都必须一样;
只有跟星座本身挂钩的量(尊贵分等)才会变。此前昼夜判断与福点整宫宫头的赤经赤纬拿转过的黄经当真黄经算,
南纬盘一开南半球读法,昼夜 / 地平上下 / 宫头赤道坐标就跟着变。

判据:① 南半球读法盘 = 普通盘整体转 180°(物理量逐点相等,黄经差 180°);② 骰子盘同理:南半球读法下把星放到
标签星座 S,等于普通盘放到 S 的对宫星座;③ 整星座投射(lotProjection='sign')的希腊点重跑一次 reinit 不变;
④ Chart.copy() 带上「已转半圈」标记。
"""
import copy
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from flatlib import const  # noqa: E402
from astrostudy.perchart import PerChart, push_classical_request, pop_classical_request  # noqa: E402

COMMON = {"hsys": 3, "zodiacal": 0, "tradition": False, "predictive": False}
SOUTH_BASES = {
    'sydney01': {"date": "2001/09/11", "time": "05:50:00", "zone": "+10:00", "lat": "33s52", "lon": "151e12"},
    'capetown55': {"date": "1955/03/15", "time": "23:40:00", "zone": "+02:00", "lat": "33s55", "lon": "18e25"},
    'quito83': {"date": "1983/07/04", "time": "13:07:00", "zone": "-05:00", "lat": "00s13", "lon": "78w31"},
}
NORTH_BASES = {
    'seattle75': {"date": "1975/02/10", "time": "21:15:00", "zone": "-08:00", "lat": "47n36", "lon": "122w20"},
    'shanghai90': {"date": "1990/01/01", "time": "08:00:00", "zone": "+08:00", "lat": "31n14", "lon": "121e28"},
}
PHYSICAL = ('aboveHorizon', 'hayyiz', 'ofSect', 'house', 'ra', 'decl')
FORTUNA_WHOLE = 24   # perchart.hsys 末尾追加的「福点整宫制」下标


def _arc(a, b):
    return abs(((a - b + 180.0) % 360.0) - 180.0)


def _pushed(data, fn):
    token = push_classical_request(data)
    try:
        return fn()
    finally:
        pop_classical_request(token)


def _chart(data):
    d = copy.deepcopy(data)
    return _pushed(d, lambda: PerChart(d))


def _groups(pc):
    out = {}
    for grp in ('objects', 'pars', 'houses', 'angles'):
        for o in (getattr(pc.chart, grp, None) or []):
            out['%s/%s' % (grp, o.id)] = o
    return out


def _same(a, b):
    if isinstance(a, float) or isinstance(b, float):
        if a is None or b is None:
            return a is b
        return abs(a - b) < 1e-6 or (abs(a - b) > 359.999999)
    return a == b


def _assert_half_turn(plain, south, tag):
    assert bool(plain.isDiurnal) == bool(south.isDiurnal), '%s 昼夜不该随南半球读法变' % tag
    pg, sg = _groups(plain), _groups(south)
    assert set(pg) == set(sg), tag
    bad = []
    for key, p in pg.items():
        s = sg[key]
        if _arc(s.lon, p.lon + 180.0) > 1e-6:
            bad.append((key, 'lon', p.lon, s.lon))
        for attr in PHYSICAL:
            if attr in p.__dict__ or attr in s.__dict__:
                pv, sv = getattr(p, attr, None), getattr(s, attr, None)
                if not _same(pv, sv):
                    bad.append((key, attr, pv, sv))
    assert not bad, '%s 南半球读法改变了物理量: %s' % (tag, bad[:8])


@pytest.mark.parametrize('base', sorted(SOUTH_BASES))
@pytest.mark.parametrize('hsys', [3, FORTUNA_WHOLE])
@pytest.mark.parametrize('topo', [0, 1])
def test_south_chart_is_plain_chart_turned_half(base, hsys, topo):
    data = dict(COMMON, **SOUTH_BASES[base])
    data.update({'hsys': hsys, 'topocentricMoon': topo})
    plain = _chart(data)
    south = _chart(dict(data, southchart=True))
    assert getattr(south.chart, 'halfTurned', False) is True
    assert getattr(plain.chart, 'halfTurned', False) is False
    _assert_half_turn(plain, south, '%s hsys=%s topo=%s' % (base, hsys, topo))


@pytest.mark.parametrize('base', sorted(NORTH_BASES))
def test_south_switch_is_noop_north_of_equator(base):
    data = dict(COMMON, **NORTH_BASES[base])
    plain = _chart(data)
    south = _chart(dict(data, southchart=True))
    assert getattr(south.chart, 'halfTurned', False) is False
    assert {k: o.lon for k, o in _groups(plain).items()} == {k: o.lon for k, o in _groups(south).items()}
    assert bool(plain.isDiurnal) == bool(south.isDiurnal)


@pytest.mark.parametrize('base', sorted(SOUTH_BASES))
@pytest.mark.parametrize('planet,sign,house', [(const.MOON, const.LEO, 1), (const.MARS, const.GEMINI, 7)])
def test_south_dice_chart_matches_plain_dice_in_opposite_sign(base, planet, sign, house):
    data = dict(COMMON, **SOUTH_BASES[base])
    signs = list(const.LIST_SIGNS)
    opposite = signs[(signs.index(sign) + 6) % 12]

    def dice(d, s):
        dd = copy.deepcopy(d)
        return _pushed(dd, lambda: PerChart(dd).getPredict().getDiceChart(planet, s, house))

    south = dice(dict(data, southchart=True), sign)
    plain = dice(data, opposite)
    assert getattr(south.chart, 'halfTurned', False) is True
    _assert_half_turn(plain, south, '%s 骰子 %s %s %s' % (base, planet, sign, house))


def test_chart_copy_keeps_half_turn_flag():
    south = _chart(dict(COMMON, southchart=True, **SOUTH_BASES['sydney01']))
    assert south.chart.copy().halfTurned is True
    plain = _chart(dict(COMMON, **SOUTH_BASES['sydney01']))
    assert plain.chart.copy().halfTurned is False


ALL_BASES = dict(SOUTH_BASES, **NORTH_BASES)


@pytest.mark.parametrize('base', sorted(ALL_BASES))
@pytest.mark.parametrize('topo', [0, 1])
def test_sign_projected_lots_survive_second_reinit(base, topo):
    data = dict(COMMON, **ALL_BASES[base])
    data.update({'lotProjection': 'sign', 'topocentricMoon': topo})
    d = copy.deepcopy(data)

    def run():
        pc = PerChart(d)
        first = {o.id: o.lon for o in pc.chart.pars}
        pc.reinit()
        second = {o.id: o.lon for o in pc.chart.pars}
        return first, second

    first, second = _pushed(d, run)
    assert first, base
    moved = {k: (first[k], second.get(k)) for k in first if second.get(k) is None or _arc(first[k], second[k]) > 1e-9}
    assert not moved, '%s topo=%s 整星座投射的希腊点在第二次 reinit 被改: %s' % (base, topo, moved)


# —— 主限法 / 界推运:算的是天球上的弧,南半球读法开不开都一样;只有界按标签星座取 ——

def _pd(base, south, **extra):
    d = dict(base, hsys=0, zodiacal=0, tradition=False, predictive=True, southchart=south, **extra)
    d = copy.deepcopy(d)

    def run():
        pc = PerChart(d)
        return pc, pc.getPredict()
    return _pushed(d, run)


def _rows(pdlist):
    return sorted((r[1], r[2], round(r[0], 9), r[3], r[4]) for r in pdlist)


PD_VARIANTS = [
    {},                                                          # 默认(黄道向运,Alcabitius + Ptolemy)
    {'pdtype': 1},                                               # 世俗向运
    {'pdtype': 0, 'pdProjection': 'placidus', 'pdFrame': 'placidus'},
    {'pdtype': 1, 'pdProjection': 'regiomontanus', 'pdFrame': 'regiomontanus'},
    {'pdtype': 0, 'pdMethod': 'horosa_legacy'},
    {'pdtype': 0, 'pdAntiscia': True, 'pdParallel': True},
    {'pdtype': 0, 'pdDirect': True, 'pdConverse': True},
]


@pytest.mark.parametrize('base', sorted(SOUTH_BASES))
@pytest.mark.parametrize('extra', PD_VARIANTS, ids=lambda e: '&'.join('%s=%s' % kv for kv in sorted(e.items())) or 'default')
def test_primary_directions_ignore_the_south_reading(base, extra):
    """天体对天体(含相位点、映点、平行点)的弧与应期:开不开南半球读法逐行相同。"""
    _pc0, p0 = _pd(SOUTH_BASES[base], False, **extra)
    pc1, p1 = _pd(SOUTH_BASES[base], True, **extra)
    assert pc1.chart.halfTurned
    # 界点(T_)按标签星座取,另有专门的断言;旧式方法的表里恒带界点
    nt = lambda rows: [r for r in rows if not r[0].startswith('T_')]   # noqa: E731(_rows 的首列是迫星)
    r0, r1 = nt(_rows(p0.getPrimaryDirection())), nt(_rows(p1.getPrimaryDirection()))
    assert r0 and r0 == r1
    assert nt(_rows(p0.getPrimaryDirectionByZ())) == nt(_rows(p1.getPrimaryDirectionByZ()))
    assert p0.getPdPoles() == p1.getPdPoles()


@pytest.mark.parametrize('base', sorted(SOUTH_BASES))
def test_term_points_follow_the_sign_labels_under_south_reading(base):
    """界点按标签星座取:标签黄经 L 的界在真黄经 L − 180°。界行框架(应星 = 上升)逐行 = 用真天顶赤经独立算的斜升差。"""
    import swisseph
    from astrostudy import pd_engine
    pc0, p0 = _pd(SOUTH_BASES[base], False, pdFramework='bounds')
    pc1, p1 = _pd(SOUTH_BASES[base], True, pdFramework='bounds')
    jd = pc0.chart.date.jd
    phi, glon = pc0.chart.pos.lat, pc0.chart.pos.lon
    eps = float(swisseph.calc_ut(jd, swisseph.ECL_NUT)[0][1])
    armc = float(swisseph.houses_ex(jd, phi, glon, b'P')[1][2])
    want = {}
    for ruler, sgn, lon in pd_engine.term_boundaries(0):
        arc = pd_engine.arc_to_angle({'lon': (lon - 180.0) % 360.0, 'lat': 0.0}, armc, phi, eps, 'ASC', zodiacal=True)
        if arc is not None and 1e-9 < abs(arc) <= 100:
            want['T_%s_%s' % (pd_engine.TERM_RULER_FULL.get(ruler, ruler), pd_engine.TERM_SIGN_NAMES[sgn % 12])] = arc
    got = {r[1]: r[0] for r in p1.getPrimaryDirection()}
    assert got and got.keys() == want.keys()
    for k, v in want.items():
        assert abs(got[k] - v) < 1e-9, (k, got[k], v)
    # 与不开时不是同一张表(界换了星座),也不是「全表照旧」
    plain = {r[1]: r[0] for r in p0.getPrimaryDirection()}
    assert plain and plain != got


@pytest.mark.parametrize('base', sorted(SOUTH_BASES))
@pytest.mark.parametrize('clockwise', [True, False])
def test_term_direction_bodies_ignore_south_reading_terms_follow_labels(base, clockwise):
    _pc0, p0 = _pd(SOUTH_BASES[base], False)
    _pc1, p1 = _pd(SOUTH_BASES[base], True)
    r0, r1 = p0.getTermDirection(clockwise), p1.getTermDirection(clockwise)
    body = lambda rows: sorted((r[1], r[2], round(r[0], 9)) for r in rows if not r[1].startswith('T_'))   # noqa: E731
    term = lambda rows: sorted((r[1], r[2], round(r[0], 9)) for r in rows if r[1].startswith('T_'))       # noqa: E731
    assert body(r0) and body(r0) == body(r1)
    assert term(r1) and term(r0) != term(r1)


@pytest.mark.parametrize('base', sorted(SOUTH_BASES))
def test_directed_chart_under_south_reading_is_the_plain_one_turned_half(base):
    """主限法盘:搬点在真黄经上做,回包黄经是标签(= 普通盘 + 180°),赤经赤纬逐点相同。"""
    _pc0, p0 = _pd(SOUTH_BASES[base], False)
    _pc1, p1 = _pd(SOUTH_BASES[base], True)
    a = p0.getPrimaryDirectionChartByDate('2030-06-01 12:00:00')
    b = p1.getPrimaryDirectionChartByDate('2030-06-01 12:00:00')
    assert abs(a['arc'] - b['arc']) < 1e-9
    for grp_a, grp_b in ((a['chart']['objects'], b['chart']['objects']), (a['chart']['houses'], b['chart']['houses']),
                         (a['lots'], b['lots'])):
        da = {o['id']: o for o in grp_a}
        db = {o['id']: o for o in grp_b}
        assert da.keys() == db.keys() and da
        for k, oa in da.items():
            ob = db[k]
            assert _arc(ob['lon'], oa['lon'] + 180.0) < 1e-6, (k, oa['lon'], ob['lon'])
            assert ob['sign'] == const.LIST_SIGNS[int(ob['lon'] / 30.0) % 12]
            if oa.get('ra') is not None and ob.get('ra') is not None:
                assert _arc(oa['ra'], ob['ra']) < 1e-6 and abs(oa['decl'] - ob['decl']) < 1e-6, k


@pytest.mark.parametrize('base', sorted(SOUTH_BASES))
def test_distributions_and_release_follow_labels_on_true_geometry(base):
    from astrostudy import distributions as _dist
    _pc0, p0 = _pd(SOUTH_BASES[base], False)
    pc1, p1 = _pd(SOUTH_BASES[base], True)
    d1 = p1.getDistributions()
    s0 = (p0.getDistributions(), p0.getDistributionsMeta())[1][0]
    s1 = p1.getDistributionsMeta()[0]
    # 发放点回显的是标签黄经
    assert _arc(s1['releaserLon'], s0['releaserLon'] + 180.0) < 1e-3
    assert _arc(s1['releaserLon'], pc1.chart.get(const.ASC).lon) < 1e-3
    # 第一段的界主 = 标签黄经所在之界的界主
    label = s1['releaserLon']
    ruler = next(r for r, _sg, lo, hi in _dist.terms_list(0) if lo <= label < hi)
    assert d1[0]['distributor'] == ruler and d1[0]['sign'] == const.LIST_SIGNS[int(label // 30) % 12]
    # 释放框架:选定走真位置与真宫位(开不开同一个点、同一宫),回显黄经是标签
    i0, i1 = p0.getPdReleaseInfo(), p1.getPdReleaseInfo()
    assert i0['hyleg']['name'] == i1['hyleg']['name'] and i0['hyleg']['house'] == i1['hyleg']['house']
    assert _arc(i1['hyleg']['lon'], i0['hyleg']['lon'] + 180.0) < 1e-3
    assert [(c['name'], c['house'], c['aphetic']) for c in i0['candidates']] == [(c['name'], c['house'], c['aphetic']) for c in i1['candidates']]


@pytest.mark.parametrize('base', sorted(NORTH_BASES))
def test_pd_south_switch_is_noop_north_of_equator(base):
    _pc0, p0 = _pd(NORTH_BASES[base], False)
    pc1, p1 = _pd(NORTH_BASES[base], True)
    assert not getattr(pc1.chart, 'halfTurned', False) and p1._pdTrue() is None
    assert _rows(p0.getPrimaryDirection()) == _rows(p1.getPrimaryDirection())


@pytest.mark.parametrize('base', sorted(SOUTH_BASES) + sorted(NORTH_BASES))
@pytest.mark.parametrize('hsys', [0, FORTUNA_WHOLE])
@pytest.mark.parametrize('planet,sign,house', [(const.MOON, const.LEO, 1), (const.MARS, const.GEMINI, 7)])
def test_dice_chart_angles_and_moved_planet_carry_equatorial_coords_of_their_new_longitude(base, hsys, planet, sign, house):
    """骰子盘把四轴与宫头整体转了若干个 30°、把一颗星挪到指定星座:它们的赤经赤纬按盘上的新黄经算(黄纬:四轴 0、星取自身),
    与宫头同一个换算。此前四轴与那颗星还留着本命的赤经赤纬。"""
    import swisseph
    data = dict(COMMON, **dict(SOUTH_BASES, **NORTH_BASES)[base])
    data['hsys'] = hsys
    dd = copy.deepcopy(data)
    pc = _pushed(dd, lambda: PerChart(dd).getPredict().getDiceChart(planet, sign, house))
    jd = pc.chart.date.jd
    eps = swisseph.calc_ut(jd, swisseph.ECL_NUT, 0)[0][0]

    def eq(lon, lat):
        ra, decl, _ = swisseph.cotrans((lon % 360.0, lat, 1.0), -eps)
        return ra % 360.0, decl
    pts = [(pc.chart.getAngle(a), 0.0) for a in (const.ASC, const.MC, const.DESC, const.IC)]
    moved = pc.chart.getObject(planet)
    pts.append((moved, moved.lat))
    for o, lat in pts:
        ra, decl = eq(o.lon, lat)
        assert _arc(o.ra, ra) < 1e-6 and abs(o.decl - decl) < 1e-6, (base, o.id, o.lon, o.ra, ra)
