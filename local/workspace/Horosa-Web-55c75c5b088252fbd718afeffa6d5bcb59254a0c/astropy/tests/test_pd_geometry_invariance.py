# -*- coding: utf-8 -*-
"""主限法半弧 / 极下 / 世俗位置的几何正确性:
1. 与赤经原点无关:所有赤经与 RAMC 同加一个常数,弧与世俗位置不变;
2. 解析式 = 数值暴力解(按定义转动天球求根);
3. 半弧法地平之上从 MC 量、地平之下从 IC 量(地平上的点离 IC 更近时也一样)。"""
import math
import random

import pytest

from astrostudy import pd_mundane as pm
from astrostudy import pd_semiarc_pole as sp


def _n180(x):
    return ((x + 180.0) % 360.0) - 180.0


def _configs(n, seed):
    rnd = random.Random(seed)
    out = []
    while len(out) < n:
        out.append((rnd.uniform(0, 360), rnd.uniform(-23.4, 23.4), rnd.uniform(0, 360), rnd.uniform(-28, 28),
                    rnd.uniform(0, 360), rnd.uniform(-62, 62)))
    return out


@pytest.mark.parametrize('fn', [sp.semiarc_arc, sp.pole_circle_arc])
def test_arcs_do_not_depend_on_ra_origin(fn):
    checked = 0
    for ra_p, de_p, ra_s, de_s, ramc, lat in _configs(400, 3):
        base = fn(ra_p, de_p, ra_s, de_s, ramc, lat)
        if base is None:
            continue
        for k in (37.0, 181.5, 300.25):
            moved = fn((ra_p + k) % 360, de_p, (ra_s + k) % 360, de_s, (ramc + k) % 360, lat)
            assert moved is not None and abs(_n180(moved - base)) < 1e-9
        checked += 1
    assert checked > 300


def test_mundane_positions_do_not_depend_on_ra_origin():
    rnd = random.Random(5)
    for _ in range(400):
        ra, de, ramc, lat, d = rnd.uniform(0, 360), rnd.uniform(-23, 23), rnd.uniform(0, 360), rnd.uniform(-60, 60), rnd.uniform(40, 140)
        u = pm.alcabitius_mundane_position(ra, ramc, d)
        t = sp.placidus_position(ra, de, ramc, lat)
        for k in (37.0, 181.5, 300.25):
            assert abs(_n180(pm.alcabitius_mundane_position((ra + k) % 360, (ramc + k) % 360, d) - u)) < 1e-9
            if t is not None:
                t2 = sp.placidus_position((ra + k) % 360, de, (ramc + k) % 360, lat)
                assert abs(((t2 - t + 2.0) % 4.0) - 2.0) < 1e-9
        for a in (0.0, 60.0, -90.0):
            arc = pm.placidus_mundane_arc(ra, de, (ra + 50) % 360, de / 2, ramc, lat, a)
            arc2 = pm.placidus_mundane_arc((ra + 181.5) % 360, de, (ra + 231.5) % 360, de / 2, (ramc + 181.5) % 360, lat, a)
            assert (arc is None) == (arc2 is None)
            if arc is not None:
                assert abs(_n180(arc2 - arc)) < 1e-9


def _root(f, best_of):
    roots = []
    a, prev, step = -180.0, f(-180.0), 0.05
    while a < 180.0:
        b = a + step
        fb = f(b)
        if prev * fb < 0 and abs(prev - fb) < 1.0:
            lo, hi = a, b
            for _ in range(60):
                mid = (lo + hi) / 2
                if f(lo) * f(mid) <= 0:
                    hi = mid
                else:
                    lo = mid
            roots.append((lo + hi) / 2)
        a, prev = b, fb
    roots = [r for r in roots if best_of(r)]
    return min(roots, key=abs) if roots else None


def test_semiarc_arc_matches_rotating_the_sky():
    for ra_q, de_q, ra_s, de_s, ramc, lat in _configs(60, 11):
        arc = sp.semiarc_arc(ra_q, de_q, ra_s, de_s, ramc, lat)
        tq = sp.placidus_position(ra_q, de_q, ramc, lat)
        if arc is None or tq is None or sp.placidus_position(ra_s, de_s, ramc, lat) is None:
            continue
        brute = _root(lambda a: ((sp.placidus_position(ra_s, de_s, ramc + a, lat) - tq + 2.0) % 4.0) - 2.0,
                      lambda a: True)
        assert brute is not None and abs(_n180(arc - brute)) < 1e-6


def test_pole_circle_arc_matches_rotating_the_sky():
    for ra_q, de_q, ra_s, de_s, ramc, lat in _configs(60, 13):
        arc = sp.pole_circle_arc(ra_q, de_q, ra_s, de_s, ramc, lat)
        if arc is None:
            continue
        north = (-math.sin(math.radians(lat)), 0.0, math.cos(math.radians(lat)))
        q = sp._vec(ramc - ra_q, de_q)
        m = sp._cross(north, q)
        side = sp._dot(sp._cross(north, q), m)
        on_circle = lambda a: sp._dot(m, sp._vec(ramc + a - ra_s, de_s))
        same_half = lambda a: sp._dot(sp._cross(north, sp._vec(ramc + a - ra_s, de_s)), m) * side > 0
        brute = _root(on_circle, same_half)
        assert brute is not None and abs(_n180(arc - brute)) < 1e-6


def test_semiarc_measures_above_horizon_points_from_mc():
    # 北纬 50°、赤纬 +20°:昼半弧 ≈ 115.7°。子午东 110°(离 IC 70°)仍在地平之上,比例应 = 110 / 115.7
    lat, de, ramc = 50.0, 20.0, 100.0
    dsa = 90.0 + math.degrees(math.asin(math.tan(math.radians(de)) * math.tan(math.radians(lat))))
    t = sp.placidus_position(ramc + 110.0, de, ramc, lat)
    assert abs(t - (4.0 - 110.0 / dsa)) < 1e-12


def test_meridian_parallels_do_not_depend_on_ra_origin():
    for ra_p, de_p, ra_s, de_s, ramc, lat in _configs(300, 17):
        a = pm.meridian_parallel_arc(ra_p, ra_s, ramc)
        b = pm.placidus_meridian_parallel_arc(ra_p, de_p, ra_s, de_s, ramc, lat)
        for k in (37.0, 181.5, 300.25):
            assert abs(_n180(pm.meridian_parallel_arc((ra_p + k) % 360, (ra_s + k) % 360, (ramc + k) % 360) - a)) < 1e-9
            b2 = pm.placidus_meridian_parallel_arc((ra_p + k) % 360, de_p, (ra_s + k) % 360, de_s, (ramc + k) % 360, lat)
            assert (b is None) == (b2 is None)
            if b is not None:
                assert abs(_n180(b2 - b)) < 1e-9


def test_meridian_parallel_lands_on_the_mirror():
    # 应星在子午东 40°,迫星走到子午西 40° 处:迫星子午距由 +10° 变为 −40°,弧 = 50°
    assert abs(pm.meridian_parallel_arc(110.0, 140.0, 100.0) - 50.0) < 1e-12


@pytest.mark.parametrize('kind', ['regiomontanus', 'campanus'])
def test_position_circle_mundane_do_not_depend_on_ra_origin(kind):
    for ra_p, de_p, ra_s, de_s, ramc, lat in _configs(200, 19):
        u = pm.position_circle_mundane_position(ra_p, de_p, ramc, lat, kind)
        a = pm.position_circle_mundane_arc(ra_p, de_p, ra_s, de_s, ramc, lat, 60.0, kind)
        for k in (37.0, 181.5, 300.25):
            u2 = pm.position_circle_mundane_position((ra_p + k) % 360, de_p, (ramc + k) % 360, lat, kind)
            assert abs(_n180(u2 - u)) < 1e-9
            a2 = pm.position_circle_mundane_arc((ra_p + k) % 360, de_p, (ra_s + k) % 360, de_s, (ramc + k) % 360, lat, 60.0, kind)
            assert (a is None) == (a2 is None)
            if a is not None:
                assert abs(_n180(a2 - a)) < 1e-9


@pytest.mark.parametrize('kind', ['regiomontanus', 'campanus'])
def test_position_circle_mundane_angles_hit_the_angles(kind):
    lat, ramc = 45.0, 120.0
    # 天顶 / 地平东点的世俗角:MC = 0、ASC = 90、DSC = 270
    assert abs(_n180(pm.position_circle_mundane_position(ramc, lat, ramc, lat, kind))) < 1e-9
    assert abs(pm.position_circle_mundane_position(ramc + 90.0, 0.0, ramc, lat, kind) - 90.0) < 1e-9
    assert abs(pm.position_circle_mundane_position(ramc - 90.0, 0.0, ramc, lat, kind) - 270.0) < 1e-9
    # 应星被带到迫星世俗角 + 0:到达后两者世俗角相同
    a = pm.position_circle_mundane_arc(150.0, 10.0, 200.0, -5.0, ramc, lat, 0.0, kind)
    assert abs(_n180(pm.position_circle_mundane_position(200.0, -5.0, ramc + a, lat, kind)
                     - pm.position_circle_mundane_position(150.0, 10.0, ramc, lat, kind))) < 1e-7


@pytest.mark.parametrize('kind', ['regiomontanus', 'campanus'])
def test_position_circle_meridian_parallel(kind):
    # 应星被带到迫星世俗角的子午镜像:到达后应星世俗角 = −迫星世俗角;且与赤经原点无关
    checked = 0
    for ra_p, de_p, ra_s, de_s, ramc, lat in _configs(200, 29):
        a = pm.position_circle_meridian_parallel_arc(ra_p, de_p, ra_s, de_s, ramc, lat, kind)
        if a is None:
            continue
        u_p = pm.position_circle_mundane_position(ra_p, de_p, ramc, lat, kind)
        assert abs(_n180(pm.position_circle_mundane_position(ra_s, de_s, ramc + a, lat, kind) + u_p)) < 1e-6
        for k in (37.0, 181.5, 300.25):
            a2 = pm.position_circle_meridian_parallel_arc((ra_p + k) % 360, de_p, (ra_s + k) % 360, de_s,
                                                          (ramc + k) % 360, lat, kind)
            assert a2 is not None and abs(_n180(a2 - a)) < 1e-9
        checked += 1
    assert checked > 150


def _classic_cases():
    from astrostudy import pd_classic as cl
    return [
        ('semiarc', lambda rp, dp, rs, ds, rm, la: cl.semiarc_arc(rp, dp, rs, ds, rm, la)),
        ('mundane_regio', lambda rp, dp, rs, ds, rm, la: cl.position_circle_mundane_arc(rp, dp, rs, ds, rm, la, 60.0,
                                                                                       'regiomontanus')),
        ('mundane_campanus', lambda rp, dp, rs, ds, rm, la: cl.position_circle_mundane_arc(rp, dp, rs, ds, rm, la, 60.0,
                                                                                          'campanus')),
    ]


@pytest.mark.parametrize('name,fn', _classic_cases(), ids=[c[0] for c in _classic_cases()])
def test_classic_variant_depends_on_ra_origin(name, fn):
    # 经典口径按赤经数值判东西:整体平移赤经起点后,至少有一部分构形结果改变(这正是两档的区别)
    changed = 0
    for ra_p, de_p, ra_s, de_s, ramc, lat in _configs(200, 23):
        a = fn(ra_p, de_p, ra_s, de_s, ramc, lat)
        b = fn((ra_p + 181.5) % 360, de_p, (ra_s + 181.5) % 360, de_s, (ramc + 181.5) % 360, lat)
        if a is not None and b is not None and abs(_n180(a - b)) > 1e-6:
            changed += 1
    assert changed > 10


@pytest.mark.parametrize('kind', ['regiomontanus', 'campanus'])
def test_classic_mundane_position_circle_matches_improved_when_sides_are_read_right(kind):
    # RAMC < 180°、赤经不跨 0° 且迫星在子午东侧时,经典写法的东西判定与几何一致,两档结果相同
    from astrostudy import pd_classic as cl
    checked = 0
    for ra_p, de_p, ra_s, de_s, ramc, lat in _configs(600, 31):
        ramc %= 180.0
        if not (ramc + 5.0 < ra_p < ramc + 85.0):
            continue
        for asp in (0.0, 30.0):
            a = pm.position_circle_mundane_arc(ra_p, de_p, ra_s, de_s, ramc, lat, asp, kind)
            b = cl.position_circle_mundane_arc(ra_p, de_p, ra_s, de_s, ramc, lat, asp, kind)
            if a is None or b is None:
                continue
            assert abs(_n180(a - b)) < 1e-6, (ra_p, de_p, ra_s, de_s, ramc, lat, asp)
            checked += 1
    assert checked > 40


def test_porphyry_mundane_position_maps_the_angles_and_inverts():
    q = pm.porphyry_quadrants(200.0, 40.0, 23.44)
    mc, asc = pm.ecliptic_angles(200.0, 40.0, 23.44)
    assert abs(pm.porphyry_mundane_position(mc, q)) < 1e-9
    assert abs(pm.porphyry_mundane_position(asc, q) - 90.0) < 1e-9
    assert abs(pm.porphyry_mundane_position((mc + 180.0) % 360.0, q) - 180.0) < 1e-9
    for lon in [x * 7.3 for x in range(50)]:
        u = pm.porphyry_mundane_position(lon, q)
        assert abs(_n180(pm.porphyry_mundane_inverse(u, q) - lon)) < 1e-9
    # 象限三等分:宫始点落在 30° 的整数倍
    span = (asc - mc) % 360.0
    assert abs(pm.porphyry_mundane_position((mc + span / 3.0) % 360.0, q) - 30.0) < 1e-9


def test_classic_porphyry_differs_only_in_the_quadrant_across_aries():
    from astrostudy import pd_classic as cl
    for ramc in (15.0, 111.0, 158.0, 251.0, 273.7, 330.0):
        q = pm.porphyry_quadrants(ramc, -57.5, 23.44)
        for lon in [x * 3.1 for x in range(116)]:
            inside_wrap = any(a > b and (lon >= a or lon < b) for a, b, _ in q)
            a = pm.porphyry_mundane_position(lon, q)
            b = cl.porphyry_mundane_position(lon, q)
            if not inside_wrap:
                assert abs(_n180(a - b)) < 1e-9
