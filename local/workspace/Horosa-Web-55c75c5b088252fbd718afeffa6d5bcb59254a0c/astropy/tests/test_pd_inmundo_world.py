# -*- coding: utf-8 -*-
"""In-Mundo 世俗核守卫。

  世界经度核(Alcabitius 以外的核心方位法):W:MC=0 / ASC=90 / IC=180 / DSC=270,按昼/夜半弧线性。
  世界相位:相位射线行(D_/S_)按 W_P(RAMC+arc) ≡ W_S ± asp 求根(P 用本体真β);世界合相目标 = W_S。
  Alcabitius(默认方位法):世俗位置 = 上升点半弧在赤道上分 D,N,D,N 四段的时圈比例(见 pd_mundane);
  迫星转过 arc 后位于应星世俗位置 + 相位处;轴应星只出合相(上升 / 下降 / 宿命点 / 东点为穿越弧、天顶 / 天底为赤经差)。
"""
import math

import pytest
import swisseph as swe

from astrostudy import pd_mundane, perchart, perpredict


BASE = {
    'date': '1990/03/15', 'time': '12:30:00', 'zone': '+08:00',
    'lat': '39N54', 'lon': '116E28', 'ad': 1, 'hsys': 'PLACIDUS',
    'pdTimeKey': 'Ptolemy', 'pdYears': 100,
    'pdtype': 1, 'pdaspects': [0, 60, 90, 120, 180],
    # 世界经度核的代表:Porphyry / Equal(黄道)已改走黄道定位置的世俗核(pd_mundane.porphyry_mundane_target_lon),
    # 单凭 pdMethod 已无方法落在本核,改用显式「投影 ptolemy + 定局 Koch」组合
    'pdMethod': 'core_alchabitius', 'pdProjection': 'ptolemy', 'pdFrame': 'koch',
}


@pytest.fixture(scope='module')
def ctx():
    pc = perchart.PerChart(dict(BASE))
    pp = perpredict.PerPredict(pc)
    chart = pc.getChart()
    lat = pp._coreParseCoord(pc.lat)
    lon = pp._coreParseCoord(pc.lon)
    ascmc = perpredict._polarSafeHousesEx(chart.date.jd, lat, lon, b'P')[1]
    return {'pp': pp, 'chart': chart, 'phi': lat,
            'ramc': float(ascmc[2]), 'asc_lon': float(ascmc[0]),
            'eps': pp._coreMeanObliquity(chart),
            'rows': pp.getPrimaryDirection()}


def test_world_longitude_axis_anchors(ctx):
    pp = ctx['pp']
    asc_eq = pp._corePointEqCoords({'lon': ctx['asc_lon'], 'lat': 0.0}, ctx['eps'], zero_lat=False)
    w_asc = pp._coreWorldLongitude(float(asc_eq[0]), float(asc_eq[1]), ctx['ramc'], ctx['phi'])
    assert abs(w_asc - 90.0) < 0.05
    assert abs(pp._coreWorldLongitude(ctx['ramc'], 0.0, ctx['ramc'], ctx['phi'])) < 1e-9
    w_ic = pp._coreWorldLongitude((ctx['ramc'] + 180.0) % 360.0, 0.0, ctx['ramc'], ctx['phi'])
    assert abs(w_ic - 180.0) < 1e-9


def _world(pp, chart, name, eps, ramc, phi, arc=0.0):
    o = chart.get(name)
    eq = pp._corePointEqCoords({'lon': float(o.lon), 'lat': float(o.lat)}, eps, zero_lat=False)
    return pp._coreWorldLongitude(float(eq[0]), float(eq[1]), (ramc + arc) % 360.0, phi)


def test_mundane_aspect_rows_satisfy_world_equation(ctx):
    pp, chart = ctx['pp'], ctx['chart']
    checked = 0
    for r in ctx['rows']:
        parts = r[1].split('_')
        try:
            asp = float(parts[2])
        except (TypeError, ValueError):
            continue
        if parts[0] not in ('D', 'S', 'N') or abs(asp) <= 0:
            continue
        sig_name = r[2].split('_')[1]
        # 交点行引擎侧走真交点重建,chart.get 是 mean node(差 ~1.7°),复核器跳过
        if 'Node' in r[1] or 'Node' in r[2]:
            continue
        try:
            w_p = _world(pp, chart, parts[1], ctx['eps'], ctx['ramc'], ctx['phi'], arc=r[0])
            w_s = _world(pp, chart, sig_name, ctx['eps'], ctx['ramc'], ctx['phi'])
        except Exception:
            continue
        off = -asp if parts[0] == 'S' else asp
        resid = pp._norm180_static(w_p - (w_s + off))
        assert abs(resid) < 0.05, (r, resid)
        checked += 1
        if checked >= 10:
            break
    assert checked > 0


def test_mundane_conjunction_rows_satisfy_world_equation(ctx):
    pp, chart = ctx['pp'], ctx['chart']
    checked = 0
    for r in ctx['rows']:
        parts = r[1].split('_')
        if parts[0] != 'N' or parts[2] != '0':
            continue
        sig_name = r[2].split('_')[1]
        # 交点行引擎侧走真交点重建,chart.get 是 mean node(差 ~1.7°),复核器跳过
        if 'Node' in r[1] or 'Node' in r[2]:
            continue
        try:
            w_p = _world(pp, chart, parts[1], ctx['eps'], ctx['ramc'], ctx['phi'], arc=r[0])
            w_s = _world(pp, chart, sig_name, ctx['eps'], ctx['ramc'], ctx['phi'])
        except Exception:
            continue
        resid = pp._norm180_static(w_p - w_s)
        assert abs(resid) < 0.05, (r, resid)
        checked += 1
        if checked >= 10:
            break
    assert checked > 0


def test_vertex_significator_present_in_mundo(ctx):
    assert any('Vertex' in r[2] for r in ctx['rows'])


def test_rows_shape_and_sorted(ctx):
    rows = ctx['rows']
    assert rows
    for r in rows:
        assert len(r) == 5 and r[3] == 'M'
    arcs = [abs(r[0]) for r in rows]
    assert arcs == sorted(arcs)


# ---------------------------------------------------------------------------
# Alcabitius 世俗盘(默认方位法)
# ---------------------------------------------------------------------------
def _alc_ctx():
    cd = dict(BASE)
    for k in ('pdMethod', 'pdProjection', 'pdFrame'):
        cd.pop(k)
    pc = perchart.PerChart(cd)
    pp = perpredict.PerPredict(pc)
    chart = pc.getChart()
    lat = pp._coreParseCoord(pc.lat)
    lon = pp._coreParseCoord(pc.lon)
    ascmc = perpredict._polarSafeHousesEx(chart.date.jd, lat, lon, b'P')[1]
    eps = pp._coreMeanObliquity(chart)
    _ra, asc_decl = pp._coreEqCoords(float(ascmc[0]), 0.0, eps)
    dsa = 90.0 + math.degrees(math.asin(math.tan(math.radians(asc_decl)) * math.tan(math.radians(lat))))
    return pp, chart, lat, float(ascmc[2]), eps, dsa, pp.getPrimaryDirection()


def _cyclic_position(ra, ramc, dsa):
    h = (ra - ramc) % 360.0
    n = 180.0 - dsa
    if h <= dsa:
        return 90.0 * h / dsa
    if h <= 180.0:
        return 90.0 + 90.0 * (h - dsa) / n
    if h <= 180.0 + dsa:
        return 180.0 + 90.0 * (h - 180.0) / dsa
    return 270.0 + 90.0 * (h - 180.0 - dsa) / n


def test_alcabitius_mundo_rows_land_on_mundane_aspect():
    pp, chart, lat, ramc, eps, dsa, rows = _alc_ctx()
    checked = 0
    for r in rows:
        parts = r[1].split('_')
        sig = r[2].split('_')[1]
        if parts[0] not in ('N', 'D', 'S') or 'Node' in r[1] or 'Node' in r[2]:
            continue
        if sig in ('Asc', 'MC', 'Desc', 'IC', 'Vertex', 'Antivertex'):
            continue
        asp = float(parts[2])
        signed = -asp if parts[0] == 'D' else asp
        p = chart.get(parts[1])
        s = chart.get(sig)
        ra_p = float(pp._coreEqCoords(float(p.lon), float(p.lat), eps)[0])
        ra_s = float(pp._coreEqCoords(float(s.lon), float(s.lat), eps)[0])
        u_after = _cyclic_position(ra_p, ramc + r[0], dsa)
        u_target = pd_mundane.alcabitius_mundane_position(ra_s, ramc, dsa) + signed
        assert abs(pp._norm180_static(u_after - u_target)) < 1e-6, r
        checked += 1
    assert checked > 50


def test_alcabitius_mundo_axis_rows():
    pp, chart, lat, ramc, eps, dsa, rows = _alc_ctx()
    seen = set()
    for r in rows:
        parts = r[1].split('_')
        axis = r[2].split('_')[1]
        if parts[0] != 'N' or parts[2] != '0' or 'Node' in r[1]:
            continue
        if axis not in ('Asc', 'MC', 'Desc', 'IC', 'Vertex', 'Antivertex'):
            continue
        p = chart.get(parts[1])
        ra, decl = (float(x) for x in pp._coreEqCoords(float(p.lon), float(p.lat), eps))
        if axis == 'MC':
            assert abs(r[0] - abs(pp._norm180_static(ra - ramc))) < 1e-9
        elif axis == 'IC':
            assert abs(r[0] - abs(pp._norm180_static(ra - ramc - 180.0))) < 1e-9
        elif axis == 'Asc':
            ad = math.degrees(math.asin(math.tan(math.radians(decl)) * math.tan(math.radians(lat))))
            # 轴转过 arc 后迫星斜升 = 上升点斜升
            assert abs(pp._norm180_static(ra - ad - (ramc - r[0] + 90.0))) < 1e-9
        seen.add(axis)
    assert {'Asc', 'MC', 'Desc', 'IC', 'Vertex', 'Antivertex'} <= seen
