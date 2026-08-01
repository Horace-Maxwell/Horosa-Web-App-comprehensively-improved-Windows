# -*- coding: utf-8 -*-
"""In-Mundo 世俗核 · 世界经度统一口径守卫(P0-3)。

  世界经度 W:MC=0 / ASC=90 / IC=180 / DSC=270,按昼/夜半弧线性(纯公式)。
  世界相位:相位射线行(D_/S_)按 W_P(RAMC+arc) ≡ W_S ± asp 求根(P 用本体真β,
  不再用黄道偏移点近似);世界合相(N_ 等)目标 = W_S。
  Vertex 作应星接入 in-mundo。地平下点经统一口径天然正确。
"""
import pytest
import swisseph as swe

from astrostudy import perchart, perpredict


BASE = {
    'date': '1990/03/15', 'time': '12:30:00', 'zone': '+08:00',
    'lat': '39N54', 'lon': '116E28', 'ad': 1, 'hsys': 'PLACIDUS',
    'pdTimeKey': 'Ptolemy', 'pdYears': 100,
    'pdtype': 1, 'pdaspects': [0, 60, 90, 120, 180],
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
