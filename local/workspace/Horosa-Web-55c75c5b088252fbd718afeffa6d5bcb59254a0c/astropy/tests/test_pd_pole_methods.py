# -*- coding: utf-8 -*-
"""主限法 · Topocentric 与 Placidus 极下法:位置圈取目标点自己的极(东半斜升、西半斜降),
其余(取点、轴行、传统逆向、相位侧)与极下族同一内核。"""
import gzip
import json
import math
import os
import random
import sys

_ASTRO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _ASTRO not in sys.path:
    sys.path.insert(0, _ASTRO)

import pytest  # noqa: E402

pytest.importorskip('swisseph')
from astrostudy import perchart, perpredict  # noqa: E402
from astrostudy import pd_engine as E  # noqa: E402
from astrostudy import pd_semiarc_pole as SP  # noqa: E402

CORPUS = os.path.join(os.path.dirname(__file__), 'data', 'pd_calibration_corpus', 'golden_alcabitius_ptolemy_v266.ndjson.gz')


def _n180(x):
    return ((x + 180.0) % 360.0) - 180.0


def test_under_pole_formula_reproduces_regiomontanus_position_circle():
    """极下通式 OA_p(动点) − OA_p(目标点),代入 Regiomontanus 的极,与按位置圈几何直解的 pole_circle_arc 逐值相同。"""
    rnd = random.Random(7)
    n = 0
    for _ in range(4000):
        lat, ramc = rnd.uniform(-60, 60), rnd.uniform(0, 360)
        ra_t, d_t, ra_s, d_s = rnd.uniform(0, 360), rnd.uniform(-23.4, 23.4), rnd.uniform(0, 360), rnd.uniform(-28, 28)
        ref = SP.pole_circle_arc(ra_t, d_t, ra_s, d_s, ramc, lat)
        got = SP.under_pole_arc(E.pole_regiomontanus(ra_t, d_t, ramc, lat), ra_t, d_t, ra_s, d_s)
        if ref is None or got is None:
            continue
        assert abs(_n180(got - ref)) < 1e-6
        n += 1
    assert n > 3000


def test_topocentric_pole_sign_and_endpoints():
    """tan p = tan φ × 子午距 / 半弧;东半为正、西半为负;子午线上为 0,地平上为 ±φ(南纬同式)。"""
    for lat in (40.0, -33.0):
        ramc = 100.0
        assert abs(SP.topocentric_pole(ramc + 1e-9, 0.0, ramc, lat)) < 1e-6
        assert abs(SP.topocentric_pole(ramc + 89.999999, 0.0, ramc, lat) - lat) < 1e-4
        assert abs(SP.topocentric_pole(ramc - 89.999999, 0.0, ramc, lat) + lat) < 1e-4
        # 半弧三分之一处:tan p = tan φ / 3
        ad = SP.ascensional_difference(10.0, lat)
        p = SP.topocentric_pole(ramc + (90.0 + ad) / 3.0, 10.0, ramc, lat)
        assert abs(math.tan(math.radians(p)) - math.tan(math.radians(lat)) / 3.0) < 1e-12


def test_placidus_pole_puts_point_at_its_placidus_position():
    """Placidus 极下法的极:在该极下,点的斜升(东)/ 斜降(西)恰等于它 Placidus 位置对应的子午轴赤经 ± 90°·比例。"""
    rnd = random.Random(11)
    for _ in range(3000):
        lat, ramc, ra, d = rnd.uniform(-55, 55), rnd.uniform(0, 360), rnd.uniform(0, 360), rnd.uniform(-23, 23)
        p = SP.placidus_pole(ra, d, ramc, lat)
        t = SP.placidus_position(ra, d, ramc, lat)
        if p is None or t is None or abs(d) < 0.5:
            continue
        oa = ra - math.degrees(math.asin(math.tan(math.radians(p)) * math.tan(math.radians(d))))
        # Placidus 位置 t ∈ [0,4):MC=0 → DSC=1 → IC=2 → ASC=3;对应斜升 = RAMC − 90·t
        assert abs(_n180(oa - (ramc - 90.0 * t))) < 1e-6


def _corpus_chart(k):
    with gzip.open(CORPUS, 'rt', encoding='utf-8') as f:
        for i, line in enumerate(f):
            if i == k:
                cd = dict(json.loads(line)['chart_data'])
                cd['pdTimeKey'] = 'Ptolemy'
                return cd


def _rows(cd, proj, **over):
    return perpredict.PerPredict(perchart.PerChart(dict(cd, pdProjection=proj, pdFrame='alcabitius',
                                                        pdMethod='core_alchabitius', **over))).getPrimaryDirection()


@pytest.mark.parametrize('proj,med,p90', [('topocentric', 0.3, 0.8), ('placidus_under_pole', 0.15, 0.5)])
def test_same_rows_as_placidus_and_close_arcs(proj, med, p90):
    """换成这两法不该换掉哪些星出行:年龄上限以内的迫星 / 应星对与 Placidus 半弧法相同;
    本体弧与半弧法接近(两法本为逼近半弧比例而设;五张 47°–58° 高纬盘合计,纬度越高差越大)。"""
    diffs = []
    for k in (0, 20, 40, 60, 80):
        cd = _corpus_chart(k)
        pla, got = {}, {}
        for r in _rows(cd, 'placidus'):
            pla.setdefault((r[1], r[2], float(r[0]) >= 0), []).append(float(r[0]))
        for r in _rows(cd, proj):
            got.setdefault((r[1], r[2], float(r[0]) >= 0), []).append(float(r[0]))
        # 弧在年龄上限附近的行两法可能一出一不出;高纬下个别点在该极下拱极(|tan p·tan δ| ≥ 1,极下法无解)也会缺行,
        # 反之亦然;两个方向的差都不过 1%(上限以内,|弧| < 90°)
        inner = set(kk[:2] for kk, vs in pla.items() if any(abs(v) < 90 for v in vs))
        assert len(inner - set(kk[:2] for kk in got)) <= max(1, len(inner) // 100)
        got_keys = set(kk[:2] for kk in got)
        assert len(got_keys - set(kk[:2] for kk in pla)) <= max(1, len(got_keys) // 100)
        for kk, vs in pla.items():
            if kk[1].split('_')[1] in ('Asc', 'MC', 'Desc', 'IC', 'Vertex') or kk not in got:
                continue
            for v in vs:
                if abs(v) < 90:
                    diffs.append(min(abs(v - w) for w in got[kk]))
    diffs.sort()
    assert diffs[len(diffs) // 2] < med and diffs[int(0.9 * (len(diffs) - 1))] < p90


@pytest.mark.parametrize('proj', ['topocentric', 'placidus_under_pole'])
def test_traditional_converse_switch_applies(proj):
    """传统逆向关 = 迫星相位点被带到应星位置:本体行随之改变;轴应星行不变。"""
    cd = _corpus_chart(0)
    on = {(r[1], r[2]): round(float(r[0]), 6) for r in _rows(cd, proj)}
    off = {(r[1], r[2]): round(float(r[0]), 6) for r in _rows(cd, proj, pdTradConverse=0)}
    body = [k for k in on if k in off and k[1].split('_')[1] not in ('Asc', 'MC', 'Desc', 'IC', 'Vertex')]
    assert body and sum(1 for k in body if on[k] != off[k]) > len(body) // 2
