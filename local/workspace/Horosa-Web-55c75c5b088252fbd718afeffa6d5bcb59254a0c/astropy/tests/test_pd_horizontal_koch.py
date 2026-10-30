# -*- coding: utf-8 -*-
"""主限法 Horizontal(地平经圈)与 Koch(出生地法)方位法:按定义逐条复核。
Horizontal 的位置圈 = 过天顶与目标点的那半条地平经圈;Koch 的位置圈 = 过目标点的出生地斜升圈(东 +φ、西 −φ);
世俗相位分别加在方位角 / Koch 世俗角上。南纬盘是北纬盘关于赤道的镜像,改进口径在这个镜像下结果不变。"""
import math
import os
import sys

_ASTRO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _ASTRO not in sys.path:
    sys.path.insert(0, _ASTRO)

import pytest  # noqa: E402
from astrostudy import pd_semiarc_pole as SP  # noqa: E402
from astrostudy import pd_mundane as PM  # noqa: E402
from astrostudy import pd_classic as CL  # noqa: E402
from astrostudy.perchart import PerChart  # noqa: E402

R, D = math.radians, math.degrees
PTS = [(281.5, -23.0), (332.2, -10.1), (248.2, -22.0), (45.0, 18.0), (120.0, 5.0), (200.0, -12.0)]


def _n180(x):
    return (x + 180.0) % 360.0 - 180.0


def _oa(ra, decl, p):
    return ra - D(math.asin(math.tan(R(p)) * math.tan(R(decl))))


@pytest.mark.parametrize('lat', [40.7, -57.9, 10.0])
def test_horizontal_pole_matches_vertical_circle(lat):
    """极的大小 |p| = asin(cos φ·|sin A|);极下式写出的圈过同方位的近邻点(同一支),同方位较远的点落在这条大圆的
    某一支上(过天顶的那条地平经圈)。
    极下式只表示大圆的一支(以赤纬极值为界),所以只做局部检查;弧本身按方位直接求交(vertical_circle_arc)。"""
    ramc = 134.7
    for az in (67.7, 116.45, 243.55, 300.0):
        ra, de = PM.horizon_point_eq(az, ramc, lat, 20.0)
        p = SP.horizontal_pole(ra, de, ramc, lat)
        assert abs(abs(p) - D(math.asin(math.cos(R(lat)) * abs(math.sin(R(az)))))) < 1e-9
        c = _oa(ra, de, p)
        for dh in (-0.5, 0.5):
            ra2, de2 = PM.horizon_point_eq(az, ramc, lat, 20.0 + dh)
            assert abs(_n180(_oa(ra2, de2, p) - c)) < 1e-9, (lat, az, dh)       # 近邻同一支
        for dh in (-15.0, 5.0, 30.0):
            ra2, de2 = PM.horizon_point_eq(az, ramc, lat, 20.0 + dh)
            assert abs(SP.azimuth(ra2, de2, ramc, lat) - az) < 1e-9
            # 整条大圆:(p, c) 或另一支 (−p, c + 180°)
            assert min(abs(_n180(_oa(ra2, de2, p) - c)), abs(_n180(_oa(ra2, de2, -p) - c - 180.0))) < 1e-9, (lat, az, dh)


def test_sphere_samples_follow_vertical_half_circle():
    from astrostudy import pd_engine
    sig = {'lon': 100.0, 'lat': 2.0}
    for phi in (40.7, -57.9):
        ra_s, de_s = pd_engine.ecl_to_eq(100.0, 2.0, 23.44)
        az = SP.azimuth(ra_s, de_s, 134.7, phi)
        seg = pd_engine.pole_circle_samples(sig, 'horizontal', 134.7, phi, 23.44, n=33)[0]
        assert len(seg) == 33
        assert all(abs(_n180(SP.azimuth(q['ra'], q['decl'], 134.7, phi) - az)) < 1e-6 for q in seg)


@pytest.mark.parametrize('lat', [40.7, -57.9])
def test_horizontal_zodiacal_lands_on_promissor_vertical(lat):
    ramc = 251.0
    for ra_t, de_t in PTS:
        for ra_m, de_m in PTS:
            if (ra_t, de_t) == (ra_m, de_m):
                continue
            arc = SP.horizontal_arc(ra_t, de_t, ra_m, de_m, ramc, lat)
            if arc is None:
                continue
            assert abs(_n180(SP.azimuth(ra_m - arc, de_m, ramc, lat) - SP.azimuth(ra_t, de_t, ramc, lat))) < 1e-7


@pytest.mark.parametrize('lat', [40.7, -57.9])
def test_koch_zodiacal_equal_oblique_ascension(lat):
    ramc = 134.7
    for ra_t, de_t in PTS:
        for ra_m, de_m in PTS:
            if (ra_t, de_t) == (ra_m, de_m):
                continue
            arc = SP.koch_arc(ra_t, de_t, ra_m, de_m, ramc, lat)
            if arc is None:
                continue
            p = SP.koch_pole(ra_t, de_t, ramc, lat)
            assert p == (lat if _n180(ra_t - ramc) > 0 else -lat)
            assert abs(_n180(_oa(ra_m - arc, de_m, p) - _oa(ra_t, de_t, p))) < 1e-9


def test_horizontal_mundane_target_and_equator_mirror():
    """世俗:北纬应星落在方位 A迫 + a、南纬落在 A迫 − a;把整张盘关于赤道镜像(φ → −φ、δ → −δ)弧不变。"""
    ramc = 134.7
    for (ra_p, de_p) in PTS[:3]:
        for (ra_s, de_s) in PTS[3:]:
            for a in (0.0, 60.0, -90.0, 120.0):
                n = PM.horizontal_mundane_arc(ra_p, de_p, ra_s, de_s, ramc, 40.7, a)
                s = PM.horizontal_mundane_arc(ra_p, -de_p, ra_s, -de_s, ramc, -40.7, a)
                assert (n is None) == (s is None)
                if n is None:
                    continue
                assert abs(n - s) < 1e-7
                tgt = SP.azimuth(ra_p, de_p, ramc, 40.7) + a
                assert abs(_n180(SP.azimuth(ra_s - n, de_s, ramc, 40.7) - tgt)) < 1e-7


def test_koch_mundane_target_position():
    """世俗 Koch:应星转到 Koch 世俗角 U迫 + a 的位置圈上;不跨子午线缺口时其世俗角恰为 U迫 + a。"""
    ramc, lat = 134.7, 40.7
    ad_mc = D(math.asin(math.tan(R(15.0)) * math.tan(R(lat))))
    hits = 0
    for (ra_p, de_p) in PTS:
        for (ra_s, de_s) in PTS:
            if (ra_p, de_p) == (ra_s, de_s):
                continue
            for a in (0.0, 60.0, -60.0, 90.0):
                arc = PM.koch_mundane_arc(ra_p, de_p, ra_s, de_s, ramc, lat, ad_mc, a)
                if arc is None:
                    continue
                u_t = (PM.koch_mundane_position(ra_p, de_p, ramc, lat, ad_mc) + a) % 360.0
                u_s = PM.koch_mundane_position(ra_s - arc, de_s, ramc, lat, ad_mc)
                east_t = u_t <= 180.0
                east_s = _n180((ra_s - arc) - ramc) > 0
                if east_t == east_s:
                    assert abs(_n180(u_s - u_t)) < 1e-7, (ra_p, ra_s, a)
                    hits += 1
    assert hits > 40


def test_classic_equals_improved_when_literal_side_agrees():
    """RAMC < 180° 的北纬盘赤经不跨 0° 回绕,字面东西与真实东西一致 → 两档逐位相同。"""
    ramc, lat = 134.7, 40.7
    for ra_t, de_t in PTS:
        for ra_m, de_m in PTS:
            assert SP.horizontal_arc(ra_t, de_t, ra_m, de_m, ramc, lat) == pytest.approx(
                CL.horizontal_arc(ra_t, de_t, ra_m, de_m, ramc, lat), abs=1e-9) or SP.horizontal_arc(ra_t, de_t, ra_m, de_m, ramc, lat) is None
            assert SP.koch_arc(ra_t, de_t, ra_m, de_m, ramc, lat) == CL.koch_arc(ra_t, de_t, ra_m, de_m, ramc, lat)


BASE = {'date': '1990/05/18', 'time': '10:00:00', 'zone': '+08:00', 'lat': '31n38', 'lon': '118e27', 'hsys': 1,
        'zodiacal': 0, 'tradition': False, 'predictive': True, 'pdaspects': [0, 60, 90, 120, 180], 'pdYears': 100,
        'pdDirect': True, 'pdConverse': True, 'pdFrame': 'alcabitius'}


def _rows(**over):
    return {(r[1], r[2]): round(float(r[0]), 9) for r in PerChart(dict(BASE, **over)).getPredict().getPrimaryDirection() or []}


@pytest.mark.parametrize('proj', ['horizontal', 'koch'])
def test_engine_projection_runs_and_differs(proj):
    z = _rows(pdProjection=proj, pdtype=0)
    m = _rows(pdProjection=proj, pdtype=1)
    assert len(z) > 300 and len(m) > 300
    assert z != _rows(pdProjection='ptolemy', pdtype=0)
    # 世俗平行 / 急动平行出行
    mp = _rows(pdProjection=proj, pdtype=1, pdParallel=1, pdRaptParallel=1)
    kinds = {k[0].split('_')[0] for k in mp}
    assert {'MP', 'RP'} <= kinds
    # 新式逆向改变世俗弧
    assert m != _rows(pdProjection=proj, pdtype=1, pdTradConverse=0)


@pytest.mark.parametrize('proj', ['horizontal', 'koch', 'topocentric'])
def test_house_position_latitude_applies(proj):
    assert _rows(pdProjection=proj, pdtype=0, pdPromAspectLat=4) != _rows(pdProjection=proj, pdtype=0)
