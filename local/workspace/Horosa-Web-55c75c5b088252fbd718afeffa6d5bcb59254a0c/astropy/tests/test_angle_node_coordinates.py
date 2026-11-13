"""四轴、宫头、南交点的赤道坐标与方位高度。

- 四轴与宫头是黄道上的点:黄纬 0,赤经赤纬 = (黄经, 0) 按本日真黄赤交角换算;恒星盘先加回岁差。天顶赤经 = ARMC。
- 南交是北交的对点:黄经、赤经各加 180°,黄纬、赤纬取反(平交点、真交点两路都一样)。
- 方位高度按回归黄道算:同一时刻同一地点,回归盘与恒星盘的方位高度必须相同;上升高度 0,天顶高度 = 90 − |纬度 − 赤纬|。
- 节气卯时的「按赤经」法:太阳赤经比东点赤经(ARMC + 90°),同一坐标系。
"""
import copy
import math
import os
import sys

import pytest
import swisseph as swe

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from flatlib import const  # noqa: E402
from astrostudy.perchart import PerChart  # noqa: E402
from websrv.webchartsrv import push_classical_request, pop_classical_request  # noqa: E402

CHARTS = {
    'seattle': {"date": "1975/02/10", "time": "21:15:00", "zone": "-08:00", "lat": "47n36", "lon": "122w20"},
    'south': {"date": "2024/04/05", "time": "12:06:00", "zone": "+00:00", "lat": "33s52", "lon": "151e12"},
    'polar': {"date": "1990/06/21", "time": "03:30:00", "zone": "+02:00", "lat": "69n39", "lon": "18e57"},
}
ANGLES = (const.ASC, const.DESC, const.MC, const.IC)


def _chart(base, **extra):
    d = dict(base, hsys=0, tradition=False, predictive=False)
    d.update(extra)
    d = copy.deepcopy(d)
    token = push_classical_request(d)
    try:
        pc = PerChart(d)
        jd = pc.chart.date.jd
        eps = swe.calc_ut(jd, swe.ECL_NUT, 0)[0][0]
        offset = swe.get_ayanamsa_ex_ut(jd, swe.FLG_SIDEREAL)[1] if pc.zodiacal == const.SIDEREAL else 0.0
        geo = (pc.chart.pos.lon, pc.chart.pos.lat)
        armc = swe.houses(jd, geo[1], geo[0], b'W')[1][2]
        points = {}
        for oid in ANGLES + (const.SUN, const.MOON, const.MARS, const.NORTH_NODE, const.SOUTH_NODE):
            o = pc.chart.get(oid)
            points[oid] = {k: getattr(o, k, None) for k in ('lon', 'lat', 'ra', 'decl', 'azimuth', 'altitudeTrue')}
        houses = [(h.lon, h.ra, h.decl) for h in pc.chart.houses]
        return {'jd': jd, 'eps': eps, 'offset': offset, 'armc': armc, 'lat': geo[1], 'points': points, 'houses': houses}
    finally:
        pop_classical_request(token)


def _close(a, b, tol=1e-6):
    return abs(((a - b + 180.0) % 360.0) - 180.0) < tol


def _eq(lon, eps, offset):
    ra, decl, _ = swe.cotrans(((lon + offset) % 360.0, 0.0, 1.0), -eps)
    return ra % 360.0, decl


@pytest.mark.parametrize('name', sorted(CHARTS))
@pytest.mark.parametrize('zodiacal', [0, 1])
def test_angles_and_cusps_are_ecliptic_points(name, zodiacal):
    c = _chart(CHARTS[name], zodiacal=zodiacal)
    for oid in ANGLES:
        p = c['points'][oid]
        ra, decl = _eq(p['lon'], c['eps'], c['offset'])
        assert p['lat'] == 0.0, (oid, p)
        assert _close(p['ra'], ra) and abs(p['decl'] - decl) < 1e-6, (oid, p, ra, decl)
    # 上中天交点的赤经就是 ARMC(恒星盘、极区都一样)
    assert _close(c['points'][const.MC]['ra'], c['armc'], 1e-5)
    assert abs(c['points'][const.ASC]['decl'] - c['lat']) > 1e-3 or abs(c['lat']) < 1e-3   # 不再等于地理纬度
    for lon, ra, decl in c['houses']:
        want = _eq(lon, c['eps'], c['offset'])
        assert _close(ra, want[0]) and abs(decl - want[1]) < 1e-6


@pytest.mark.parametrize('name', sorted(CHARTS))
@pytest.mark.parametrize('node', ['mean', 'true'])
@pytest.mark.parametrize('zodiacal', [0, 1])
def test_south_node_is_antipode(name, node, zodiacal):
    c = _chart(CHARTS[name], zodiacal=zodiacal, guolaoNodeType=node)
    n, s = c['points'][const.NORTH_NODE], c['points'][const.SOUTH_NODE]
    assert _close(s['lon'], n['lon'] + 180.0)
    assert _close(s['ra'], n['ra'] + 180.0)
    assert abs(s['decl'] + n['decl']) < 1e-9
    assert abs(s['lat'] + n['lat']) < 1e-9


@pytest.mark.parametrize('name', sorted(CHARTS))
def test_horizontal_coordinates_ignore_zodiac_frame(name):
    trop = _chart(CHARTS[name], zodiacal=0)
    sid = _chart(CHARTS[name], zodiacal=1)
    for oid, p in trop['points'].items():
        q = sid['points'][oid]
        assert _close(p['azimuth'], q['azimuth'], 1e-4), (oid, p, q)
        assert abs(p['altitudeTrue'] - q['altitudeTrue']) < 1e-4, (oid, p, q)
    asc, mc = trop['points'][const.ASC], trop['points'][const.MC]
    assert abs(asc['altitudeTrue']) < 1e-3
    assert abs(mc['altitudeTrue'] - (90.0 - abs(trop['lat'] - mc['decl']))) < 1e-3


def test_jieqi_by_ra_compares_against_the_east_point_right_ascension():
    """节气卯时「按赤经」:太阳赤经与东点赤经(ARMC + 90°)同系相比。"""
    from flatlib.chart import Chart
    from flatlib.datetime import Datetime
    from flatlib.geopos import GeoPos
    from astrostudy.jieqi.BirthJieQi import BirthJieQi

    pos = GeoPos('47n36', '122w20')
    tm = Datetime('1975/02/10', '05:00', '-08:00')
    chart = Chart(tm, pos, const.TROPICAL, hsys=const.HOUSES_WHOLE_SIGN, IDs=[const.SUN], needpars=False)
    holder = BirthJieQi.__new__(BirthJieQi)
    holder.pos = pos
    want = (swe.houses(tm.jd, pos.lat, pos.lon, b'W')[1][2] + 90.0) % 360.0
    assert abs(holder._eastPointValue(chart) - want) < 1e-12


def test_india_true_south_node_is_antipode():
    from astrostudy.india.india_chart_kernel import IndiaChartKernel
    k = IndiaChartKernel(dict(CHARTS['seattle'], hsys=0, tradition=False, predictive=False, zodiacal=1, nodeType='true'))
    n, s = k.chart.get(const.NORTH_NODE), k.chart.get(const.SOUTH_NODE)
    assert abs(s.decl + n.decl) < 1e-9 and abs(s.lat + n.lat) < 1e-9


@pytest.mark.parametrize('zodiacal', [0, 1])
@pytest.mark.parametrize('hsys', [24])
def test_custom_cusps_and_fortune_use_the_same_equatorial_conversion(zodiacal, hsys):
    d = copy.deepcopy(dict(CHARTS['seattle'], hsys=hsys, tradition=False, predictive=False, zodiacal=zodiacal))
    token = push_classical_request(d)
    try:
        pc = PerChart(d)
        jd = pc.chart.date.jd
        eps = swe.calc_ut(jd, swe.ECL_NUT, 0)[0][0]
        offset = swe.get_ayanamsa_ex_ut(jd, swe.FLG_SIDEREAL)[1] if pc.zodiacal == const.SIDEREAL else 0.0
        for h in pc.chart.houses:
            ra, decl = _eq(h.lon, eps, offset)
            assert _close(h.ra, ra) and abs(h.decl - decl) < 1e-6
        pf = pc.chart.getObject(const.PARS_FORTUNA)
        ra, decl = _eq(pf.lon, eps, offset)
        assert _close(pf.ra, ra) and abs(pf.decl - decl) < 1e-6
    finally:
        pop_classical_request(token)


def test_above_horizon_agrees_with_true_altitude_in_sidereal_charts():
    for zodiacal in (0, 1):
        d = copy.deepcopy(dict(CHARTS['seattle'], hsys=0, tradition=False, predictive=False, zodiacal=zodiacal))
        token = push_classical_request(d)
        try:
            pc = PerChart(d)
            for oid in (const.SUN, const.MOON, const.MARS, const.JUPITER, const.SATURN):
                obj = pc.chart.get(oid)
                assert bool(pc.isAboveHorizon(obj)) == (obj.altitudeTrue > 0), (zodiacal, oid, obj.altitudeTrue)
        finally:
            pop_classical_request(token)


def test_parallels_skip_definitional_antipodes():
    d = copy.deepcopy(dict(CHARTS['seattle'], hsys=0, tradition=False, predictive=False, zodiacal=0))
    token = push_classical_request(d)
    try:
        par = PerChart(d).getParallel()
    finally:
        pop_classical_request(token)
    contra = par['contraParallel']
    for a, b in ((const.ASC, const.DESC), (const.MC, const.IC), (const.NORTH_NODE, const.SOUTH_NODE)):
        assert b not in contra.get(a, ()) and a not in contra.get(b, ())


@pytest.mark.parametrize('date', ['3500/06/01', '4000/06/01', '4600/06/01'])
def test_far_future_charts_build_without_out_of_domain_points(date):
    d = dict(CHARTS['seattle'], date=date, hsys=0, tradition=False, predictive=False, zodiacal=0)
    token = push_classical_request(copy.deepcopy(d))
    try:
        pc = PerChart(copy.deepcopy(d))
        pc.getChartObj()
        assert 'Intp_Apog' not in pc.objlists
    finally:
        pop_classical_request(token)


def _eq_sph(lon, eps):
    """独立判别器:黄纬 0 的点按球面三角换赤道坐标(不经 swisseph,和实现不同路)。"""
    lam, e = math.radians(lon), math.radians(eps)
    decl = math.degrees(math.asin(math.sin(e) * math.sin(lam)))
    ra = math.degrees(math.atan2(math.cos(e) * math.sin(lam), math.cos(lam))) % 360.0
    return ra, decl


@pytest.mark.parametrize('hsys', [0, 3])   # 0 = 整宫、3 = Placidus:四轴与宫制无关
@pytest.mark.parametrize('zodiacal', [0, 1])
def test_seattle_angles_match_spherical_trig_and_pinned_values(zodiacal, hsys):
    """1975-02-10 21:15 -08:00 47n36 122w20:上升赤纬约 -2.076(不是出生纬度 47.60),
    天顶赤纬约 23.282(不是 68.67),天顶赤经 = ARMC;回归盘和恒星盘、整宫和 Placidus 都一样。"""
    c = _chart(CHARTS['seattle'], zodiacal=zodiacal, hsys=hsys)
    for oid in ANGLES:
        p = c['points'][oid]
        ra, decl = _eq_sph(p['lon'] + c['offset'], c['eps'])
        assert _close(p['ra'], ra, 1e-7) and abs(p['decl'] - decl) < 1e-7, (oid, p, ra, decl)
    asc, mc = c['points'][const.ASC], c['points'][const.MC]
    assert abs(asc['decl'] - (-2.07583)) < 1e-4 and _close(asc['ra'], 184.79511, 1e-4), asc
    assert abs(mc['decl'] - 23.28236) < 1e-4 and _close(mc['ra'], 97.07002, 1e-4), mc
    assert abs(asc['decl'] - 47.6) > 1.0 and abs(mc['decl'] - 68.6729) > 1.0
    assert abs(c['points'][const.DESC]['decl'] + asc['decl']) < 1e-9
    assert abs(c['points'][const.IC]['decl'] + mc['decl']) < 1e-9


@pytest.mark.parametrize('name', sorted(CHARTS))
def test_angle_equatorial_coordinates_ignore_zodiac_frame(name):
    # 用象限宫制(Placidus,极区照例回退 Porphyry):整宫制的宫头取各自黄道的星座起点,两套框架本就是不同的点
    trop = _chart(CHARTS[name], zodiacal=0, hsys=3)
    sid = _chart(CHARTS[name], zodiacal=1, hsys=3)
    for oid in ANGLES:
        p, q = trop['points'][oid], sid['points'][oid]
        assert _close(p['ra'], q['ra'], 1e-6) and abs(p['decl'] - q['decl']) < 1e-6, (oid, p, q)
    for (_, ra1, d1), (_, ra2, d2) in zip(trop['houses'], sid['houses']):
        assert _close(ra1, ra2, 1e-6) and abs(d1 - d2) < 1e-6


@pytest.mark.parametrize('name', sorted(CHARTS))
@pytest.mark.parametrize('zodiacal', [0, 1])
def test_parallel_table_uses_true_angle_declinations(name, zodiacal):
    """赤纬平行表里四轴的平行 / 反平行按四轴的真赤纬(黄经独立推算,不读对象自身的 decl)判:
    真赤纬同号且差 ≤ 1° 的必同组;反平行与真赤纬逐对一致(异号且绝对值差 ≤ 1°)。贴 1° 边界的对不判。"""
    d = copy.deepcopy(dict(CHARTS[name], hsys=0, tradition=False, predictive=False, zodiacal=zodiacal))
    token = push_classical_request(d)
    try:
        pc = PerChart(d)
        par = pc.getParallel()
        jd = pc.chart.date.jd
        eps = swe.calc_ut(jd, swe.ECL_NUT, 0)[0][0]
        offset = swe.get_ayanamsa_ex_ut(jd, swe.FLG_SIDEREAL)[1] if pc.zodiacal == const.SIDEREAL else 0.0
        decl = {}
        for oid in const.LIST_ALL_POINTS:
            try:
                o = pc.chart.get(oid)
            except Exception:
                continue
            decl[oid] = _eq_sph(o.lon + offset, eps)[1] if oid in ANGLES else o.decl
    finally:
        pop_classical_request(token)
    antipodes = {frozenset(p) for p in ((const.ASC, const.DESC), (const.MC, const.IC),
                                        (const.NORTH_NODE, const.SOUTH_NODE))}
    together = {frozenset((a, b)) for g in par['parallel'] for a in g for b in g if a != b}
    contra = {frozenset((a, b)) for a, lst in par['contraParallel'].items() for b in lst}
    margin = 1e-6
    for a in ANGLES:
        for b, db in decl.items():
            pair = frozenset((a, b))
            if b == a or pair in antipodes:
                continue
            da = decl[a]
            if da * db > 0:
                if abs(da - db) < 1 - margin:
                    assert pair in together, ('应平行', a, b, da, db)
                assert pair not in contra, ('同号不应反平行', a, b, da, db)
            elif abs(abs(da) - abs(db)) < 1 - margin:
                assert pair in contra, ('应反平行', a, b, da, db)
            elif abs(abs(da) - abs(db)) > 1 + margin:
                assert pair not in contra, ('不应反平行', a, b, da, db)


# —— 紫气:匀速式给出的是回归黄经;恒星盘减岁差,赤道坐标两盘同值 ——

def _purple(base, **extra):
    d = copy.deepcopy(dict(base, hsys=0, tradition=False, predictive=False, **extra))
    token = push_classical_request(d)
    try:
        pc = PerChart(d)
        jd = pc.chart.date.jd
        o = pc.chart.get(const.PURPLE_CLOUDS)
        sun = pc.chart.get(const.SUN)
        offset = swe.get_ayanamsa_ex_ut(jd, swe.FLG_SIDEREAL)[1] if pc.zodiacal == const.SIDEREAL else 0.0
        return {'jd': jd, 'lon': o.lon, 'ra': o.ra, 'decl': o.decl, 'sun': sun.lon, 'offset': offset}
    finally:
        pop_classical_request(token)


@pytest.mark.parametrize('name', sorted(CHARTS))
def test_purple_clouds_tropical_value_is_the_plain_mean_formula(name):
    # 回归盘:逐位等于匀速式原值(改恒星盘口径不许动回归盘)
    t = _purple(CHARTS[name], zodiacal=0)
    assert t['lon'] == (188.6849 + 360 * (t['jd'] - 2451543.5) / 10226.78132) % 360


@pytest.mark.parametrize('name', sorted(CHARTS))
def test_purple_clouds_sidereal_shares_the_zero_point_with_planets(name):
    t = _purple(CHARTS[name], zodiacal=0)
    s = _purple(CHARTS[name], zodiacal=1)
    assert s['offset'] > 20.0
    # 恒星盘:紫气与太阳减掉的是同一个岁差(此前紫气不减,在恒星盘上比同盘行星整体偏一个岁差)
    assert _close(t['lon'] - s['lon'], s['offset'], 1e-9)
    assert _close(t['sun'] - s['sun'], s['offset'], 1e-4)
    # 天上是同一个点:赤经赤纬两盘相同,且 = (回归黄经, 黄纬 0) 按本日真黄赤交角换算
    assert _close(t['ra'], s['ra'], 1e-9) and abs(t['decl'] - s['decl']) < 1e-9
    eps = swe.calc_ut(t['jd'], swe.ECL_NUT, 0)[0][0]
    ra, decl = _eq(t['lon'], eps, 0.0)
    assert _close(s['ra'], ra, 1e-9) and abs(s['decl'] - decl) < 1e-9


def test_purple_clouds_follows_the_guolao_sidereal_mode_zero_point():
    # 七政「恒星制(郑式)」盘:四余与七政同一零点。紫气与太阳的黄经差在回归制与该恒星制下相同。
    base = dict(CHARTS['seattle'], gpsLat='47n36', gpsLon='122w20', guolaoLifeMode='asc')
    t = _purple(base, zodiacal=0, doubingSu28=2)
    z = _purple(base, zodiacal=1, doubingSu28=4, guolaoZhengSidereal=1)
    assert not _close(t['sun'], z['sun'], 1.0)          # 这一档确实换了零点
    assert _close(t['lon'] - t['sun'], z['lon'] - z['sun'], 1e-4)
