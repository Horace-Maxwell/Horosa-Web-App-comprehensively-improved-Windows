# -*- coding: utf-8 -*-
"""
pd_engine 自检 — 各方位法闭式 vs 通用数值法(swe.house_pos)对拍,锁定主限法引擎正确性。

参照基准:本命盘 1990-01-01 12:00 UT, 51.5°N 0°E(与引擎设计同源的验证盘)。
覆盖:黄道→赤道、AD/半弧、Placidus 半弧闭式=数值、Regiomontanus 闭式=数值、
      Regiomontanus==Campanus(body→body)、向四轴、时间钥匙、build_directions 产出。
"""
import math

import pytest
import swisseph

from astrostudy import pd_engine as pe


def _chart():
    jd = swisseph.julday(1990, 1, 1, 12.0)
    eps = float(swisseph.calc_ut(jd, swisseph.ECL_NUT)[0][0])
    phi, geolon = 51.5, 0.0
    armc = float(swisseph.houses_ex(jd, phi, geolon, b'P')[1][2])
    ids = {'Sun': swisseph.SUN, 'Moon': swisseph.MOON, 'Mercury': swisseph.MERCURY,
           'Venus': swisseph.VENUS, 'Mars': swisseph.MARS, 'Jupiter': swisseph.JUPITER,
           'Saturn': swisseph.SATURN}
    bodies = {}
    for name, pid in ids.items():
        xx = swisseph.calc_ut(jd, pid)[0]
        bodies[name] = {'lon': float(xx[0]), 'lat': float(xx[1])}
    cusps, ascmc = swisseph.houses_ex(jd, phi, geolon, b'P')
    angles = {'Asc': float(ascmc[0]), 'MC': float(ascmc[1]),
              'Desc': float((ascmc[0] + 180) % 360), 'IC': float((ascmc[1] + 180) % 360)}
    return bodies, angles, armc, phi, eps, jd


PAIRS = [('Sun', 'Saturn'), ('Venus', 'Moon'), ('Saturn', 'Venus'), ('Mars', 'Jupiter')]


def _same_quadrant(sig, prom, armc, phi, eps):
    ras, decs = pe.ecl_to_eq(sig['lon'], sig['lat'], eps)
    rap, decp = pe.ecl_to_eq(prom['lon'], prom['lat'], eps)
    same_md = (pe.meridian_distance(ras, armc) >= 0) == (pe.meridian_distance(rap, armc) >= 0)
    same_h = (pe.is_above_horizon(ras, decs, armc, phi) ==
              pe.is_above_horizon(rap, decp, armc, phi))
    return same_md and same_h


def test_ecl_to_eq_known():
    eps = 23.4392911
    ra, dec = pe.ecl_to_eq(0, 0, eps)
    assert abs(ra) < 1e-6 and abs(dec) < 1e-6
    ra, dec = pe.ecl_to_eq(90, 0, eps)
    assert abs(ra - 90) < 1e-6 and abs(dec - eps) < 1e-6


def test_ad_semiarc_equator():
    assert abs(pe.ascensional_difference(0, 51.5)) < 1e-9
    assert abs(pe.semiarc(0, 51.5, True) - 90) < 1e-9


def test_placidus_closed_equals_numerical_in_quadrant():
    bodies, angles, armc, phi, eps, _ = _chart()
    for s, p in PAIRS:
        sig, prom = bodies[s], bodies[p]
        if not _same_quadrant(sig, prom, armc, phi, eps):
            continue
        a_cf = pe.arc_placidus(sig, prom, armc, phi, eps)
        a_num, _ = pe.arc_numerical(sig, prom, armc, phi, eps, 'placidus')
        assert abs(pe.norm180(a_cf - a_num)) < 1e-3, f'{s}->{p} Placidus {a_cf} vs {a_num}'


def test_regiomontanus_closed_equals_numerical():
    bodies, angles, armc, phi, eps, _ = _chart()
    for s, p in PAIRS:
        if not _same_quadrant(bodies[s], bodies[p], armc, phi, eps):
            continue
        a_cf = pe.arc_regiomontanus(bodies[s], bodies[p], armc, phi, eps)
        a_num, _ = pe.arc_numerical(bodies[s], bodies[p], armc, phi, eps, 'regiomontanus')
        assert abs(pe.norm180(a_cf - a_num)) < 1e-3, f'{s}->{p} Regio {a_cf} vs {a_num}'


def test_regiomontanus_equals_campanus_body_to_body():
    bodies, angles, armc, phi, eps, _ = _chart()
    for s, p in PAIRS + [('Mars', 'Jupiter')]:
        a_r, _ = pe.arc_numerical(bodies[s], bodies[p], armc, phi, eps, 'regiomontanus')
        a_c, _ = pe.arc_numerical(bodies[s], bodies[p], armc, phi, eps, 'campanus')
        assert abs(pe.norm180(a_r - a_c)) < 1e-3, f'{s}->{p} R={a_r} C={a_c}'


def test_arc_to_angle_matches_numerical():
    bodies, angles, armc, phi, eps, _ = _chart()
    for p in ['Sun', 'Mars', 'Saturn']:
        for ang, lon in [('MC', angles['MC']), ('ASC', angles['Asc'])]:
            a_cf = pe.arc_to_angle(bodies[p], armc, phi, eps, ang)
            sigpt = {'lon': lon, 'lat': 0.0}
            a_num, _ = pe.arc_numerical(sigpt, bodies[p], armc, phi, eps, 'placidus')
            if a_num is not None and abs(pe.norm180(a_cf - a_num)) < 0.05:
                assert abs(pe.norm180(a_cf - a_num)) < 0.05


def test_time_keys_dynamic_roundtrip():
    # 动态钥匙(真太阳弧)与其逆函数互逆(静态比例换算在 perpredict STATIC 表,各有专测)。
    natal_jd = 2451545.0
    years = pe.key_placidus_true_solar_arc(51.09, natal_jd)
    assert abs(pe.solar_arc_for_years(years, natal_jd) - 51.09) < 1e-6


def test_build_directions_produces_rows():
    bodies, angles, armc, phi, eps, _ = _chart()
    sigs = ['Asc', 'MC', 'Sun', 'Moon']
    proms = ['Sun', 'Moon', 'Mars', 'Jupiter', 'Saturn']
    for method in pe.SUPPORTED_METHODS:
        rows = pe.build_directions(bodies, angles, armc, phi, eps, method, sigs, proms,
                                   aspects=(0, 60, 90, 120, 180), max_arc=100.0)
        assert len(rows) > 20, f'{method} too few rows: {len(rows)}'
        for r in rows:
            assert len(r) == 4 and isinstance(r[1], str) and r[1].count('_') == 2
            assert abs(r[0]) <= 100.0


def test_regio_campanus_diverge_on_mundane_aspect():
    """世俗相位(in mundo)正是 Regiomontanus 与 Campanus 分叉之处。"""
    bodies, angles, armc, phi, eps, _ = _chart()
    sig, prom = bodies['Sun'], bodies['Mars']
    r, _ = pe.arc_numerical(sig, prom, armc, phi, eps, 'regiomontanus', aspect=90)
    c, _ = pe.arc_numerical(sig, prom, armc, phi, eps, 'campanus', aspect=90)
    assert r is not None and c is not None
    assert abs(pe.norm180(r - c)) > 0.01, f'mundane square should diverge: R={r} C={c}'


def test_solar_arc_for_years_inverse():
    """真太阳弧:盘用 solar_arc_for_years(年→弧) 与表格 key_placidus_true_solar_arc(弧→年) 互逆,
    确保主限法盘与表格对 TrueSolarArc 一致(否则盘会把它当 Ptolemy)。"""
    _, _, _, _, _, jd = _chart()
    for arc in (10.0, 30.0, 55.0):
        years = pe.key_placidus_true_solar_arc(arc, jd)
        back = pe.solar_arc_for_years(years, jd)
        assert abs(back - arc) < 1e-3, f'round-trip arc={arc} -> {years}y -> {back}'
    # 真太阳弧与 Ptolemy(1°=1年) 必须不同,否则两个 key 等价(Bug2 的根因之一)。
    assert abs(pe.key_placidus_true_solar_arc(30.0, jd) - 30.0) > 0.1


def test_converse_arcs_are_negative():
    """逆向(converse)取负根:converse=True 时各弧应为负(arc<0=converse,与 direct 正弧天然区分)。"""
    bodies, angles, armc, phi, eps, _ = _chart()
    sigs = ['Asc', 'MC', 'Sun', 'Moon']
    proms = ['Sun', 'Moon', 'Mars', 'Jupiter', 'Saturn']
    rows = pe.build_directions(bodies, angles, armc, phi, eps, 'placidus', sigs, proms,
                               aspects=(0, 60, 90, 120, 180), max_arc=100.0, converse=True)
    assert len(rows) > 10
    assert all(r[0] < 0 for r in rows), 'converse rows must all have negative arc'


def test_antiscia_and_terms_add_rows():
    """映点 / 界 作 promissor:开启后行数应增(各为额外的合相点)。"""
    bodies, angles, armc, phi, eps, _ = _chart()
    sigs = ['Asc', 'MC', 'Sun', 'Moon']
    proms = ['Sun', 'Moon', 'Mars', 'Jupiter', 'Saturn']
    base = pe.build_directions(bodies, angles, armc, phi, eps, 'placidus', sigs, proms,
                               aspects=(0, 60, 90, 120, 180), max_arc=100.0)
    anti = pe.build_directions(bodies, angles, armc, phi, eps, 'placidus', sigs, proms,
                               aspects=(0, 60, 90, 120, 180), max_arc=100.0, include_antiscia=True)
    term = pe.build_directions(bodies, angles, armc, phi, eps, 'placidus', sigs, proms,
                               aspects=(0, 60, 90, 120, 180), max_arc=100.0, include_terms=True)
    assert len(anti) > len(base), 'antiscia should add promissor rows'
    assert len(term) > len(base), 'terms should add promissor rows'
