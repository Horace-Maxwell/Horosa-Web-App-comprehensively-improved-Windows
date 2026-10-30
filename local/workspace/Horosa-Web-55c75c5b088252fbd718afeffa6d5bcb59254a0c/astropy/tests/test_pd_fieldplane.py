# -*- coding: utf-8 -*-
"""主限法 Field Plane(pdtype=4)守卫。

- 借用黄纬 = 迫星出生后第一次走到相位黄经那一刻的黄纬(与逐小时暴力扫描对照)。
- 核心族弧 = wrap180(RA(相位点黄经, 借用黄纬) − RA(应星));合相点用本命黄纬。
- 经典口径(传统程序的写法):合相点也借黄纬 = 出生后下一次走回本命黄经那一刻的黄纬;「忽略迫星黄纬」不起作用。
- 各方位法均可出表。
"""
import pytest
import swisseph as swe

from astrostudy import pd_fieldplane, perchart, perpredict


BASE = {
    'date': '1990/03/15', 'time': '12:30:00', 'zone': '+08:00',
    'lat': '39N54', 'lon': '116E28', 'hsys': 1,
    'pdTimeKey': 'Ptolemy', 'pdYears': 100,
    'pdtype': 4, 'pdaspects': [0, 60, 90, 120, 180],
}


def _brute_latitude(jd, body, target, step=1.0 / 24.0, span=60.0):
    prev = swe.calc_ut(jd + 1.0 / 86400.0, body)[0]
    t = jd
    while t < jd + span:
        t += step
        cur = swe.calc_ut(t, body)[0]
        a = (prev[0] - target + 180.0) % 360.0 - 180.0
        b = (cur[0] - target + 180.0) % 360.0 - 180.0
        if a * b <= 0 and abs(a - b) < 180.0:
            f = abs(a) / (abs(a) + abs(b)) if (abs(a) + abs(b)) else 0.0
            return prev[1] + f * (cur[1] - prev[1])
        prev = cur
    return None


@pytest.mark.parametrize('body,offset', [(swe.MOON, 60.0), (swe.MOON, -120.0), (swe.MERCURY, 90.0), (swe.VENUS, 60.0)])
def test_first_arrival_latitude_matches_brute_force(body, offset):
    jd = swe.julday(1990, 3, 15, 4.5)
    lon0 = swe.calc_ut(jd, body)[0][0]
    target = (lon0 + offset) % 360.0
    got = pd_fieldplane.first_arrival_latitude(jd, body, target, swe.FLG_SWIEPH)
    want = _brute_latitude(jd, body, target, span=400.0)
    assert got is not None and want is not None
    assert abs(got - want) < 2e-3


def test_first_arrival_latitude_slow_planet_years_later():
    """土星走回本命黄经之前那一段:第一次到达在出生二十多年后、且在逆行圈里,扫描步长必须固定(随轮次拉长会跳过留驻、取错根)。"""
    jd = swe.julday(1990, 3, 15, 4.5)
    target = (swe.calc_ut(jd, swe.SATURN)[0][0] - 5.0) % 360.0
    got = pd_fieldplane.first_arrival_latitude(jd, swe.SATURN, target, swe.FLG_SWIEPH)
    want = _brute_latitude(jd, swe.SATURN, target, step=0.25, span=12000.0)
    assert got is not None and want is not None
    assert abs(got - want) < 2e-3


def _ctx(method='core_alchabitius', **extra):
    cd = dict(BASE)
    cd['pdMethod'] = method
    cd.update(extra)
    pc = perchart.PerChart(cd)
    pp = perpredict.PerPredict(pc)
    return pp, pc.getChart(), pp.getPrimaryDirection()


def test_core_rows_use_borrowed_latitude():
    pp, chart, rows = _ctx()
    eps = pp._coreMeanObliquity(chart)
    jd = float(chart.date.jd)
    checked = 0
    for r in rows:
        parts = r[1].split('_')
        sig = r[2].split('_')[1]
        if parts[0] not in ('D', 'S') or parts[1] not in ('Moon', 'Venus', 'Mars') or sig in ('Asc', 'MC', 'Vertex'):
            continue
        if 'Node' in r[2] or sig == 'Pars Fortuna':
            continue
        theta = float(parts[2])
        p = chart.get(parts[1])
        lon = (float(p.lon) + (theta if parts[0] == 'S' else -theta)) % 360.0
        body = perpredict.CORE_PD_VIRTUAL_BODY_CORR_MODELS[parts[1]][1]
        beta = pd_fieldplane.first_arrival_latitude(jd, body, lon, pp._coreEphemerisFlags())
        s = chart.get(sig)
        ra_q = float(pp._coreEqCoords(lon, beta, eps)[0])
        ra_s = float(pp._coreEqCoords(float(s.lon), float(s.lat), eps)[0])
        assert abs(pp._norm180_static(ra_q - ra_s) - r[0]) < 1e-6, r
        checked += 1
    assert checked > 10


def test_conjunction_rows_use_natal_latitude():
    pp, chart, rows = _ctx()
    eps = pp._coreMeanObliquity(chart)
    checked = 0
    for r in rows:
        parts = r[1].split('_')
        sig = r[2].split('_')[1]
        if parts[0] != 'N' or parts[2] != '0' or parts[1] not in ('Moon', 'Venus', 'Mars', 'Jupiter'):
            continue
        if sig in ('Asc', 'MC', 'Vertex') or 'Node' in r[2] or sig == 'Pars Fortuna':
            continue
        p = chart.get(parts[1])
        s = chart.get(sig)
        ra_p = float(pp._coreEqCoords(float(p.lon), float(p.lat), eps)[0])
        ra_s = float(pp._coreEqCoords(float(s.lon), float(s.lat), eps)[0])
        assert abs(pp._norm180_static(ra_p - ra_s) - r[0]) < 1e-6, r
        checked += 1
    assert checked > 5


def test_classic_conjunction_rows_borrow_next_return_latitude():
    """经典口径的合相点 = 迫星出生后(跳过出生那一刻)第一次回到本命黄经时的黄纬;以逐小时暴力扫描为独立参照。"""
    pp, chart, rows = _ctx(pdGeometry='classic')
    eps = pp._coreMeanObliquity(chart)
    jd = float(chart.date.jd)
    want = {}
    checked = 0
    for r in rows:
        parts = r[1].split('_')
        sig = r[2].split('_')[1]
        if parts[0] != 'N' or parts[2] != '0' or parts[1] not in ('Moon', 'Venus', 'Mars'):
            continue
        if sig in ('Asc', 'MC', 'Vertex') or 'Node' in r[2] or sig == 'Pars Fortuna':
            continue
        p = chart.get(parts[1])
        if parts[1] not in want:
            body = perpredict.CORE_PD_VIRTUAL_BODY_CORR_MODELS[parts[1]][1]
            want[parts[1]] = _brute_latitude(jd + 1.0, body, float(p.lon), span=900.0)
        beta = want[parts[1]]
        assert beta is not None and abs(beta - float(p.lat)) > 1e-3   # 与本命黄纬确有差别(否则本条测不出口径)
        s = chart.get(sig)
        ra_p = float(pp._coreEqCoords(float(p.lon), beta, eps)[0])
        ra_s = float(pp._coreEqCoords(float(s.lon), float(s.lat), eps)[0])
        assert abs(pp._norm180_static(ra_p - ra_s) - r[0]) < 5e-3, r
        checked += 1
    assert checked > 5


def test_classic_conjunction_skips_birth_root_when_points_are_delta_t_shifted():
    """2018 年以后的盘点表按参考 ΔT 平移过,合相点黄经是出生后几十秒那一刻的黄经:经典口径仍要取「下一次回到」,
    不能让出生后马上碰到的那个平凡根顶掉(顶掉 = 合相点黄纬几乎等于本命黄纬)。"""
    pp, chart, _rows = _ctx(pdGeometry='classic', date='2024/04/01', time='12:06:00')
    dmap = pp._corePdDeltaTPointMap(chart)
    assert dmap
    jd = float(chart.date.jd)
    for name in ('Moon', 'Venus', 'Mars'):
        body = perpredict.CORE_PD_VIRTUAL_BODY_CORR_MODELS[name][1]
        p = chart.get(name)
        target = (float(p.lon) + dmap[name][0]) % 360.0
        want = _brute_latitude(jd + 1.0, body, target, span=900.0)
        assert want is not None and abs(want - (float(p.lat) + dmap[name][1])) > 1e-2, name
        got = pp._pdFieldPlaneLatitudes['N_%s_0' % name]
        assert abs(got - want) < 2e-3, (name, got, want)


def test_classic_ignores_ignore_prom_lat_improved_does_not():
    key = lambda rows: sorted((r[1], r[2], round(r[0], 9)) for r in rows)
    classic = key(_ctx(pdGeometry='classic')[2])
    assert key(_ctx(pdGeometry='classic', pdIgnorePromLat=1)[2]) == classic
    improved = key(_ctx()[2])
    assert key(_ctx(pdIgnorePromLat=1)[2]) != improved
    assert improved != classic


@pytest.mark.parametrize('method', ['core_alchabitius', 'placidus', 'regiomontanus', 'campanus',
                                    'morinus', 'meridian', 'in_zodiaco_abs', 'in_zodiaco_lon'])
def test_every_method_runs(method):
    _pp, _chart, rows = _ctx(method)
    assert rows
    for r in rows:
        assert len(r) == 5 and abs(r[0]) < 100.0


def test_sphere_points_use_borrowed_latitude_and_rows_match_table():
    cd = dict(BASE)
    pp = perpredict.PerPredict(perchart.PerChart(cd))
    res = pp.getPrimaryDirection3D()
    table = pp.getPrimaryDirection()
    assert [(r['arc'], r['prom'], r['sig']) for r in res['rows']] == [(x[0], x[1], x[2]) for x in table]
    chart = pp.perchart.getChart()
    jd = float(chart.date.jd)
    checked = 0
    for pid, pt in res['points'].items():
        parts = pid.split('_')
        if parts[0] != 'D' or parts[1] not in ('Moon', 'Venus', 'Mars'):
            continue
        body = perpredict.CORE_PD_VIRTUAL_BODY_CORR_MODELS[parts[1]][1]
        beta = pd_fieldplane.first_arrival_latitude(jd, body, float(pt['lon']), pp._coreEphemerisFlags())
        assert abs(float(pt['lat']) - beta) < 1e-9, pid
        checked += 1
    assert checked > 0
