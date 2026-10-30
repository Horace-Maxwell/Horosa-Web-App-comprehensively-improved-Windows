# -*- coding: utf-8 -*-
"""世俗平行 / 急动平行 · 子午轴与地平轴按各方位法自身度量镜像(定义守卫)。

  · 赤经族(Alcabitius / Porphyry / 黄道等宫 取上升点所在时圈,Meridian / 时圈等宫 / Morinus 取 RAMC + 90°):
    地平平行 = 关于该时圈平面的真镜像(三维向量反射独立复核:赤经 α ↦ 2·轴 − α、赤纬不变);
  · Regiomontanus / Campanus:应星被带到迫星世俗角关于地平的镜像 U ↦ 180 − U;
  · 急动平行:两者同转 a 后,赤经族 (α迫 − a) + (α应 − a) ≡ 2·轴,位置圈族 U迫 + U应 ≡ 2·轴;
  · Placidus 仍走半弧比例镜像(本文件只验它没被换掉);各式与赤经起点无关;
  · 改进口径 Campanus 与 Regiomontanus 的子午平行相同;经典口径按 Regiomontanus 极下斜升镜像、东西按字面判。
"""
import math
import random

import pytest

from astrostudy import pd_mundane as pm
from astrostudy import perchart, perpredict


def _vec(ra, dec):
    a, d = math.radians(ra), math.radians(dec)
    return (math.cos(d) * math.cos(a), math.cos(d) * math.sin(a), math.sin(d))


def _ra_of(v):
    return math.degrees(math.atan2(v[1], v[0])) % 360.0


def _w180(x):
    return ((x + 180.0) % 360.0) - 180.0


def test_axis_plane_parallel_is_true_plane_reflection():
    rnd = random.Random(7)
    for _ in range(2000):
        ax, ra_p, ra_s = rnd.uniform(0, 360), rnd.uniform(0, 360), rnd.uniform(0, 360)
        dec_s = rnd.uniform(-60, 60)
        # 过两极、赤经 ax 的时圈平面法向 n = (−sin ax, cos ax, 0);应星向量对平面反射
        n = (-math.sin(math.radians(ax)), math.cos(math.radians(ax)), 0.0)
        s = _vec(ra_s, dec_s)
        dot = sum(s[i] * n[i] for i in range(3))
        mirror = tuple(s[i] - 2 * dot * n[i] for i in range(3))
        assert math.degrees(math.asin(max(-1, min(1, mirror[2])))) == pytest.approx(dec_s, abs=1e-9)
        arc = pm.axis_plane_parallel_arc(ra_p, ra_s, ax)
        # 迫星转过 arc 后赤经恰为应星的镜像赤经
        assert _w180((ra_p - arc) - _ra_of(mirror)) == pytest.approx(0.0, abs=1e-9)
        # 赤经起点平移不变
        sh = rnd.uniform(0, 360)
        assert _w180(pm.axis_plane_parallel_arc(ra_p + sh, ra_s + sh, ax + sh) - arc) == pytest.approx(0.0, abs=1e-9)


def test_axis_plane_rapt_both_move_to_mirror():
    rnd = random.Random(11)
    for _ in range(500):
        ax, ra_p, ra_s = rnd.uniform(0, 360), rnd.uniform(0, 360), rnd.uniform(0, 360)
        sols = pm.axis_plane_rapt_arcs(ra_p, ra_s, ax)
        assert len(sols) == 2 and abs(_w180(sols[0] - sols[1])) == pytest.approx(180.0, abs=1e-9)
        for a in sols:
            assert _w180((ra_p - a) + (ra_s - a) - 2 * ax) == pytest.approx(0.0, abs=1e-9)


@pytest.mark.parametrize('kind', ['regiomontanus', 'campanus'])
def test_position_circle_horizon_parallel_lands_on_mirror(kind):
    rnd = random.Random(3)
    checked = 0
    for _ in range(400):
        lat = rnd.uniform(-60, 60)
        ramc = rnd.uniform(0, 360)
        ra_p, dec_p = rnd.uniform(0, 360), rnd.uniform(-25, 25)
        ra_s, dec_s = rnd.uniform(0, 360), rnd.uniform(-25, 25)
        arc = pm.position_circle_horizon_parallel_arc(ra_p, dec_p, ra_s, dec_s, ramc, lat, kind)
        if arc is None:
            continue
        u_p = pm.position_circle_mundane_position(ra_p, dec_p, ramc, lat, kind)
        # 应星被周日运动带过 arc(天球相对地平转 arc ⇔ 应星赤经减 arc)后的世俗角 = 180 − U迫
        u_s = pm.position_circle_mundane_position(ra_s - arc, dec_s, ramc, lat, kind)
        assert _w180(u_s - (180.0 - u_p)) == pytest.approx(0.0, abs=1e-6)
        checked += 1
    assert checked > 300


@pytest.mark.parametrize('kind', ['regiomontanus', 'campanus'])
def test_position_circle_rapt_both_move_to_mirror(kind):
    rnd = random.Random(5)
    found = 0
    for _ in range(80):
        lat = rnd.uniform(-55, 55)
        ramc = rnd.uniform(0, 360)
        ra_p, dec_p = rnd.uniform(0, 360), rnd.uniform(-20, 20)
        ra_s, dec_s = rnd.uniform(0, 360), rnd.uniform(-20, 20)
        for axis_u in (0.0, 90.0):
            for a in pm.position_circle_rapt_arcs(ra_p, dec_p, ra_s, dec_s, ramc, lat, kind, axis_u):
                up = pm.position_circle_mundane_position(ra_p, dec_p, ramc + a, lat, kind)
                us = pm.position_circle_mundane_position(ra_s, dec_s, ramc + a, lat, kind)
                assert _w180(up + us - 2 * axis_u) == pytest.approx(0.0, abs=1e-6)
                found += 1
    assert found > 50


def test_classic_campanus_meridian_parallel_is_regiomontanus_parallel():
    """改进口径下 Campanus 与 Regiomontanus 的子午平行本是同一个(同一条过地平南北点的位置圈关于子午面的镜像,
    世俗角在卯酉圈还是赤道上量不影响镜像);经典口径两法同按 Regiomontanus 的极下斜升镜像算、东西按赤经数值字面判
    (经典口径:Regiomontanus 的世俗平行与 Campanus 同式):东西判对且不跨 0° 回绕时与改进逐位相同,
    字面判错时经典与改进不同。"""
    from astrostudy import pd_classic as cl, pd_semiarc_pole as sp
    rnd = random.Random(29)
    same = misjudged_differs = 0
    for _ in range(3000):
        lat, ramc = rnd.uniform(-60, 60), rnd.uniform(0, 360)
        ra_p, dec_p, ra_s, dec_s = rnd.uniform(0, 360), rnd.uniform(-25, 25), rnd.uniform(0, 360), rnd.uniform(-25, 25)
        c = cl.position_circle_meridian_parallel_arc(ra_p, dec_p, ra_s, dec_s, ramc, lat, 'campanus')
        g = pm.position_circle_meridian_parallel_arc(ra_p, dec_p, ra_s, dec_s, ramc, lat, 'regiomontanus')
        i = pm.position_circle_meridian_parallel_arc(ra_p, dec_p, ra_s, dec_s, ramc, lat, 'campanus')
        assert cl.position_circle_meridian_parallel_arc(ra_p, dec_p, ra_s, dec_s, ramc, lat, 'regiomontanus') == c
        if c is None or g is None or i is None:
            continue
        assert _w180(i - g) == pytest.approx(0.0, abs=1e-6)
        lit_east = ramc < ra_p < (ramc + 180.0) % 360.0
        if lit_east == (sp._n180(ra_p - ramc) > 0) and not cl._meridian(ra_p, ramc)[5]:
            assert _w180(c - g) == pytest.approx(0.0, abs=1e-9)
            same += 1
        elif lit_east != (sp._n180(ra_p - ramc) > 0):
            misjudged_differs += abs(_w180(c - i)) > 1e-3
    assert same > 1500 and misjudged_differs > 300


CHART = {'date': '1990/03/15', 'time': '12:30:00', 'zone': '+08:00', 'lat': '39N54', 'lon': '116E28',
         'hsys': 1, 'zodiacal': 0, 'pdYears': 100, 'pdtype': 1, 'pdParallel': 1,
         'pdaspects': [0, 60, 90, 120, 180]}


def _rows(**over):
    d = dict(CHART)
    d.update(over)
    return perpredict.PerPredict(perchart.PerChart(d)).getPrimaryDirection()


@pytest.mark.parametrize('proj,frame', [('ptolemy', 'alcabitius'), ('ptolemy', 'meridian'), ('regiomontanus', 'regiomontanus'),
                                        ('campanus', 'campanus'), ('morinus', 'morinus')])
def test_every_mundane_frame_lists_both_axes(proj, frame):
    rows = _rows(pdProjection=proj, pdFrame=frame, pdRaptParallel=1)
    ids = {'{0}'.format(r[1]).split('_')[0] + '_' + '{0}'.format(r[1]).split('_')[-1] for r in rows}
    for want in ('MP_MER', 'MP_HOR', 'RP_MER', 'RP_HOR'):
        assert want in ids, (proj, frame, want)


def test_alcabitius_horizon_parallel_uses_ascendant_hour_circle():
    pp = perpredict.PerPredict(perchart.PerChart(dict(CHART, pdProjection='ptolemy', pdFrame='alcabitius')))
    rows = pp.getPrimaryDirection()
    chart = pp.perchart.getChart()
    eps = pp._coreMeanObliquity(chart)
    ascmc = perpredict._polarSafeHousesEx(chart.date.jd, pp._coreParseCoord(CHART['lat']),
                                          pp._coreParseCoord(CHART['lon']), b'P')[1]
    asc_ra = pp._coreEqCoords(float(ascmc[0]), 0.0, eps)[0]
    n = 0
    for arc, pid, sid, *_ in rows:
        parts = '{0}'.format(pid).split('_')
        if parts[0] != 'MP' or parts[-1] != 'HOR' or abs(arc) > 100:
            continue
        p = chart.get(parts[1]) if parts[1] in ('Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn') else None
        s_id = '{0}'.format(sid).split('_')[1]
        s = chart.get(s_id) if s_id in ('Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn') else None
        if p is None or s is None:
            continue
        ra_p = pp._coreEqCoords(p.lon, p.lat, eps)[0]
        ra_s = pp._coreEqCoords(s.lon, s.lat, eps)[0]
        assert _w180(arc - pm.axis_plane_parallel_arc(ra_p, ra_s, asc_ra)) == pytest.approx(0.0, abs=1e-6)
        n += 1
    assert n >= 5


def test_classic_morinus_meridian_parallel_lands_on_antiscion_longitude_circle():
    """经典口径 Morinus 子午平行:迫星沿自身赤纬圈转过 arc 后,落在应星映点(180° − λ应)的黄经圈上;
    改进口径与其余赤经类方法同一构造(子午距相等、东西相反)。"""
    from astrostudy import pd_classic as cl
    rnd = random.Random(19)
    eps = 23.44
    checked = 0
    for _ in range(600):
        ra_p, dec_p = rnd.uniform(0, 360), rnd.uniform(-22, 22)
        lon_s, ra_s, ramc = rnd.uniform(0, 360), rnd.uniform(0, 360), rnd.uniform(0, 360)
        arc = cl.morinus_meridian_parallel_arc(ra_p, dec_p, lon_s, ra_s, ramc, eps)
        assert pm.morinus_meridian_parallel_arc(ra_p, dec_p, lon_s, ra_s, ramc, eps) == pm.meridian_parallel_arc(ra_p, ra_s, ramc)
        if arc is None:
            continue
        v = _vec(ra_p + arc, dec_p)
        e = math.radians(eps)
        # 赤道 → 黄道(绕春分轴转 ε)后的黄经
        lam = math.degrees(math.atan2(v[1] * math.cos(e) + v[2] * math.sin(e), v[0])) % 360.0
        assert abs(_w180(lam - (180.0 - lon_s))) < 1e-6
        checked += 1
    assert checked > 400
