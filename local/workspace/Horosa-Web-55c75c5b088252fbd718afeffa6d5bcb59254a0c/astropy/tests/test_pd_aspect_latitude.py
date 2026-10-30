# -*- coding: utf-8 -*-
"""主限法「相位点黄纬」(pdPromAspectLat):黄道制迫星相位点的黄纬口径。
定义见 astrostudy/pd_aspect_latitude.py;这里守:四档公式、缺省逐位不变、只动黄道制、各档只改该改的相位、
以及按定义独立复算一行(Regiomontanus 极下法);按宫位档(4)守定义条件逐点成立、合冲 ±β、无解回落 β、
只对宫位随黄纬变的方位法起作用(此处守五种,Topocentric / Horizontal / Koch 见 test_pd_horizontal_koch)。"""
import math
import os
import sys

_ASTRO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _ASTRO not in sys.path:
    sys.path.insert(0, _ASTRO)

import swisseph  # noqa: E402
from astrostudy.perchart import PerChart, pd_extra_settings_echo  # noqa: E402
from astrostudy.pd_aspect_latitude import (aspect_point_latitude, normalize_mode,  # noqa: E402
                                           house_position_latitude, house_position_metric)

BASE = {'date': '1990/05/18', 'time': '10:00:00', 'zone': '+08:00', 'lat': '31n38', 'lon': '118e27', 'hsys': 1,
        'zodiacal': 0, 'tradition': False, 'predictive': True, 'pdaspects': [0, 60, 90, 120, 180], 'pdYears': 100,
        'pdDirect': True, 'pdConverse': True}


def _rows(method, pdtype=0, **over):
    p = dict(BASE, pdMethod=method, pdtype=pdtype, **over)
    out = {}
    for arc, prom, sig, *_ in PerChart(p).getPredict().getPrimaryDirection() or []:
        out.setdefault((prom, sig), []).append(round(float(arc), 9))
    return out


def _asp(prom_id):
    try:
        return abs(float(str(prom_id).split('_')[-1]))
    except ValueError:
        return None


def test_formula_four_modes():
    b = 3.0
    for a, want in ((0, 3.0), (60, 0.0), (90, 0.0), (120, 0.0), (180, -3.0)):
        assert abs(aspect_point_latitude(1, b, a) - want) < 1e-12
    for a in (0, 30, 60, 90, 120, 150, 180):
        cos_v = math.degrees(math.atan(math.tan(math.radians(b)) * math.cos(math.radians(a))))
        assert abs(aspect_point_latitude(2, b, a) - cos_v) < 1e-12
        assert abs(aspect_point_latitude(3, b, a) - b * (1 - a / 90.0)) < 1e-12
        assert aspect_point_latitude(0, b, a) == 0.0
    assert abs(aspect_point_latitude(3, b, 60) - 1.0) < 1e-12 and abs(aspect_point_latitude(3, b, 120) + 1.0) < 1e-12
    assert normalize_mode('2') == 2 and normalize_mode(7) == 0 and normalize_mode(None) == 0


def test_cosine_mode_point_lies_on_apex_great_circle():
    """第 2 档的相位点在「以迫星为顶点、倾角 β 的大圆」上、黄经差 a 处:把点换成直角坐标,
    它与大圆极点(黄经 λ+180°、黄纬 90°−β)的夹角必须恰好 90°;β 大时与弧长式 asin(sin β cos a) 明显不同。"""
    lam = 40.0
    for b in (15.5, -17.0, 3.0):
        pole = (math.radians(lam + 180.0), math.radians(90.0 - abs(b))) if b > 0 else (math.radians(lam), math.radians(90.0 - abs(b)))
        px = (math.cos(pole[1]) * math.cos(pole[0]), math.cos(pole[1]) * math.sin(pole[0]), math.sin(pole[1]))
        for a in (0, 30, 60, 90, 120, 150, 180):
            lat = math.radians(aspect_point_latitude(2, b, a))
            lon = math.radians(lam + a)
            v = (math.cos(lat) * math.cos(lon), math.cos(lat) * math.sin(lon), math.sin(lat))
            assert abs(sum(x * y for x, y in zip(v, px))) < 1e-12, (b, a)
    arc_len = math.degrees(math.asin(math.sin(math.radians(15.5)) * 0.5))
    assert abs(aspect_point_latitude(2, 15.5, 60) - arc_len) > 0.2


def test_default_is_byte_identical_and_echoed():
    for m in ('core_alchabitius', 'regiomontanus', 'placidus'):
        assert _rows(m) == _rows(m, pdPromAspectLat=0)
    pc = PerChart(dict(BASE, pdPromAspectLat='3'))
    assert pd_extra_settings_echo(pc)['pdPromAspectLat'] == 3
    assert pd_extra_settings_echo(PerChart(dict(BASE)))['pdPromAspectLat'] == 0


def test_mundane_unaffected():
    base = _rows('regiomontanus', pdtype=1)
    for mode in (1, 2, 3, 4):
        assert _rows('regiomontanus', pdtype=1, pdPromAspectLat=mode) == base


def test_each_mode_moves_only_its_aspects():
    for m in ('regiomontanus', 'placidus', 'core_alchabitius'):
        base = _rows(m)
        g = _rows(m, pdPromAspectLat=1)
        c = _rows(m, pdPromAspectLat=2)
        lin = _rows(m, pdPromAspectLat=3)
        changed = {1: set(), 2: set(), 3: set()}
        for mode, rows in ((1, g), (2, c), (3, lin)):
            for k, v in rows.items():
                if base.get(k) != v:
                    changed[mode].add(_asp(k[0]))
        assert changed[1] and changed[1] <= {0.0, 180.0}, (m, changed[1])
        assert 90.0 not in changed[2] and 90.0 not in changed[3], m
        assert {60.0, 120.0} & changed[2] and {60.0, 120.0} & changed[3], m
        # 合 / 冲三档同值(都取 ±β)
        for k in set(g) & set(c) & set(lin):
            if _asp(k[0]) in (0.0, 180.0):
                assert g[k] == c[k] == lin[k], (m, k)


def test_latitude_enters_linearly_regiomontanus_row():
    """同一行(月亮左六合 → 太阳,Regiomontanus)按 0 / 余弦 / 线性三档各算一次:弧对相位点黄纬是光滑小量,
    (弧 − 黄道档弧) / 相位点黄纬 在两档间一致 —— 证明相位点确实带上了该档算出的黄纬(而非别的量)。"""
    p = dict(BASE, pdMethod='regiomontanus', pdtype=0)

    def arc_of(mode):
        rows = PerChart(dict(p, pdPromAspectLat=mode)).getPredict().getPrimaryDirection()
        hit = [r for r in rows if r[1] == 'S_Moon_60' and r[2] == 'N_Sun_0']
        assert hit
        return float(hit[0][0])
    moon_lat = float(PerChart(dict(p)).getChart().get('Moon').lat)
    a0, a2, a3 = arc_of(0), arc_of(2), arc_of(3)
    lat2 = math.degrees(math.atan(math.tan(math.radians(moon_lat)) * 0.5))
    lat3 = moon_lat / 3.0
    assert abs(a2 - a0) > 1e-4 and abs(a3 - a0) > 1e-4
    assert abs((a2 - a0) / lat2 - (a3 - a0) / lat3) < 2e-3


def _eq(eps):
    return lambda lon, b: (lambda r: (r[0] % 360.0, r[1]))(swisseph.cotrans([float(lon), float(b), 1.0], -eps))


def test_house_position_condition_holds_for_each_metric():
    """按宫位:解出的 β′ 让相位点相对自身黄道垂足的宫位偏移 = 迫星本体相对其垂足的偏移(五种度量、南北两个纬度)。"""
    eps = 23.44
    eq = _eq(eps)
    for lat in (40.7, -57.9):
        for kind in ('placidus', 'regiomontanus', 'campanus', 'alcabitius', 'meridian'):
            metric = house_position_metric(kind, 134.7, lat, eps, eq, dsa_asc=97.3)
            assert metric is not None
            for lam, beta, a in ((330.6, 1.24, 60.0), (306.3, 1.85, -90.0), (282.0, 0.85, 120.0), (100.0, -3.0, -60.0)):
                b2 = house_position_latitude(lam, beta, a, metric)
                lq = (lam + a) % 360.0
                d_q = ((metric(lq, b2) - metric(lq, 0.0)) + 180.0) % 360.0 - 180.0
                d_p = ((metric(lam, beta) - metric(lam, 0.0)) + 180.0) % 360.0 - 180.0
                if b2 != beta:
                    assert abs(d_q - d_p) < 1e-9, (kind, lat, lam, a)
            # 合点 = 迫星本身、冲点 = 对径点
            assert abs(house_position_latitude(200.0, 2.5, 0.0, metric) - 2.5) < 1e-9
            assert abs(house_position_latitude(200.0, 2.5, 180.0, metric) + 2.5) < 1e-6
    assert house_position_metric('porphyry', 134.7, 40.7, eps, eq) is None
    assert house_position_latitude(10.0, 0.0, 60.0, lambda lon, b: lon) == 0.0


def test_house_position_falls_back_to_body_latitude_without_root():
    """相位点处的黄纬改不动宫位(所需偏移任何黄纬都达不到)时取迫星本体黄纬。"""
    metric = lambda lon, b: (lon + (5.0 * b if abs(lon - 40.0) < 1e-9 else 0.0)) % 360.0
    assert house_position_latitude(40.0, 1.5, 90.0, metric) == 1.5


def test_house_position_picks_root_nearest_expected_latitude():
    """多根时取离 β·cos a 最近的那一支(合 β、四分 ≈ 0、冲 −β 的延续),不是离 0 最近的。
    人造度量:相位点处宫位偏移 = b² − 4b,所需偏移 −3 → 根 1 与 3。"""
    def metric_for(beta):
        c = -3.0 / beta
        return lambda lon, b: (lon + ((b * b - 4.0 * b) if abs(lon - 100.0) < 1e-9 else c * b)) % 360.0
    assert abs(house_position_latitude(40.0, 5.8, 60.0, metric_for(5.8)) - 3.0) < 1e-9   # β cos a = 2.9 → 3
    assert abs(house_position_latitude(40.0, 2.4, 60.0, metric_for(2.4)) - 1.0) < 1e-9   # β cos a = 1.2 → 1


def test_house_position_only_five_methods():
    base = {m: _rows(m) for m in ('placidus', 'regiomontanus', 'campanus', 'core_alchabitius', 'meridian',
                                   'porphyry', 'equal_ecliptic', 'morinus', 'equal_hour_circle', 'in_zodiaco_lon')}
    for m in ('porphyry', 'equal_ecliptic', 'morinus', 'equal_hour_circle', 'in_zodiaco_lon'):
        assert _rows(m, pdPromAspectLat=4) == base[m], m
    for m in ('placidus', 'regiomontanus', 'campanus', 'core_alchabitius', 'meridian'):
        hp = _rows(m, pdPromAspectLat=4)
        g1 = _rows(m, pdPromAspectLat=1)
        assert hp != base[m], m
        moved = {_asp(k[0]) for k, v in hp.items() if base[m].get(k) != v}
        assert {60.0, 90.0, 120.0} & moved, (m, moved)       # 四分也带上了宫位黄纬(与余弦 / 线性两档不同)
        for k in set(hp) & set(g1):
            if _asp(k[0]) in (0.0, 180.0):
                assert hp[k] == g1[k], (m, k)                # 合 β、冲 −β 与「合冲带黄纬」逐位相同
    assert normalize_mode(4) == 4 and aspect_point_latitude(4, 3.0, 60.0) == 0.0
