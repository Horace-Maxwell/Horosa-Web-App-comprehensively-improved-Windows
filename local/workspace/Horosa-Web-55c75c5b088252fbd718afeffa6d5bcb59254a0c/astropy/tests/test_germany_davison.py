"""戴维森盘(Davison)测试:时间中点/经度最短弧中点/全链因子表。

守住:
 1. 经度中点走球面最短弧 —— 跨 ±180° 绝不裸平均(170E 与 170W 中点=180,非 0)。
 2. 时间中点 = JD 算术平均;A/B 互换结果不变(对称)。
 3. 全链:points 含传统体+8 TNP(include_tnp=False 时无 TNP),angles 含 Asc/MC。
 4. 该路径独立于 midpoint.py —— 不带 davison 参数时任何既有响应零变化(由 webgermanysrv 分支保证)。
"""
import gzip
import json
from pathlib import Path

import pytest

from astrostudy import perchart
from astrostudy.germany.davison import lon_midpoint, davison_midpoint, compute_davison
from flatlib import const

_CORPUS = (
    Path(__file__).resolve().parent
    / 'data' / 'pd_calibration_corpus'
    / 'golden_alcabitius_ptolemy_v266.ndjson.gz'
)


def _two_charts():
    with gzip.open(_CORPUS, 'rt', encoding='utf-8') as f:
        a = json.loads(f.readline())['chart_data']
        b = json.loads(f.readline())['chart_data']
    return a, b


CD_A, CD_B = _two_charts()


def _pc(cd):
    return perchart.PerChart(dict(cd))


# ── 经度最短弧中点 ─────────────────────────────────────────────


def test_lon_midpoint_plain():
    assert lon_midpoint(10, 50) == pytest.approx(30)
    assert lon_midpoint(-10, -50) == pytest.approx(-30)
    assert lon_midpoint(120, 121) == pytest.approx(120.5)


def test_lon_midpoint_across_antimeridian():
    # 170°E 与 170°W:最短弧跨 ±180°,中点=±180(归一后 -180),绝不是裸平均的 0。
    m = lon_midpoint(170, -170)
    assert abs(abs(m) - 180.0) < 1e-9
    # 165°E 与 175°W:最短弧 20°,中点=175°E。
    assert lon_midpoint(165, -175) == pytest.approx(175)
    # 对称:交换两端结果一致。
    assert lon_midpoint(-175, 165) == pytest.approx(lon_midpoint(165, -175))


def test_lon_midpoint_zero_cross():
    # 跨 0° 经线:10°W 与 20°E → 5°E。
    assert lon_midpoint(-10, 20) == pytest.approx(5)


# ── 时间/地理中点 ─────────────────────────────────────────────


def test_davison_midpoint_jd_average_and_symmetry():
    pa, pb = _pc(CD_A), _pc(CD_B)
    jd, lat, lon = davison_midpoint(pa, pb)
    assert jd == pytest.approx((pa.dateTime.jd + pb.dateTime.jd) / 2.0)
    assert lat == pytest.approx((float(pa.pos.lat) + float(pb.pos.lat)) / 2.0)
    jd2, lat2, lon2 = davison_midpoint(pb, pa)
    assert jd2 == pytest.approx(jd)
    assert lat2 == pytest.approx(lat)
    assert lon2 == pytest.approx(lon)


# ── 全链 ─────────────────────────────────────────────────────


def test_compute_davison_full_chain():
    res = compute_davison(_pc(CD_A), _pc(CD_B), include_tnp=True)
    ids = {p['id'] for p in res['points']}
    assert const.SUN in ids and const.MOON in ids and const.PLUTO in ids
    tnp_present = [u for u in const.LIST_URANIAN if u in ids]
    assert len(tnp_present) == 8, f'8 TNP 应全在场,实得 {tnp_present}'
    assert const.ASC in res['angles'] and const.MC in res['angles']
    for p in res['points']:
        assert 0.0 <= p['lon'] < 360.0
    assert 0.0 <= res['angles'][const.ASC] < 360.0
    # jd/lat/lon 与 davison_midpoint 一致。
    jd, lat, lon = davison_midpoint(_pc(CD_A), _pc(CD_B))
    assert res['jd'] == pytest.approx(jd)
    assert res['lat'] == pytest.approx(lat)
    assert res['lon'] == pytest.approx(lon)


def test_compute_davison_no_tnp():
    res = compute_davison(_pc(CD_A), _pc(CD_B), include_tnp=False)
    ids = {p['id'] for p in res['points']}
    assert not any(u in ids for u in const.LIST_URANIAN)
    assert const.SUN in ids


def test_compute_davison_excludes_non_hamburg_points():
    # 黑月/紫气非汉堡因子,戴维森点集不含(与 declination 因子口径一致)。
    res = compute_davison(_pc(CD_A), _pc(CD_B), include_tnp=True)
    ids = {p['id'] for p in res['points']}
    assert const.DARKMOON not in ids and const.PURPLE_CLOUDS not in ids
