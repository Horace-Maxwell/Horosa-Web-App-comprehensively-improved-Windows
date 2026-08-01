# -*- coding: utf-8 -*-
"""主限法 S/P 清单扩展守卫(P0-5)。

  pdSignificators(追加语义,默认 None=零追加):Desc/IC(轴闭式)、Syzygy(产前朔望)、
  Spirit(昼 ASC+☉−☽/夜 ASC+☽−☉)、Cusps(中间宫始点,按定局 frame 宫制)。
  pdPromissorTypes:cusps → 中间宫始点作被限星(HC_ 前缀)。
  🔴 结论锁死:Campanus 与 Regiomontanus 对行星本体行完全相同,
  仅在中间宫始点行分差(frame 宫制点位不同)。
"""
import json

import pytest

from astrostudy import perchart, perpredict


BASE = {
    'date': '1990/03/15', 'time': '12:30:00', 'zone': '+08:00',
    'lat': '39N54', 'lon': '116E28', 'ad': 1, 'hsys': 'PLACIDUS',
    'pdTimeKey': 'Ptolemy', 'pdYears': 100,
    'pdtype': 0, 'pdaspects': [0, 60, 90, 120, 180],
}


def _rows(**over):
    cd = dict(BASE)
    cd.update(over)
    return perpredict.PerPredict(perchart.PerChart(cd)).getPrimaryDirection()


def test_default_roster_byte_identical():
    a = json.dumps(_rows(), default=str)
    b = json.dumps(_rows(pdSignificators=None, pdPromissorTypes=None), default=str)
    assert a == b


def test_each_extra_significator_emits_rows():
    ext = _rows(pdSignificators=['Desc', 'IC', 'Syzygy', 'Spirit', 'Cusps'])
    sigs = {r[2] for r in ext}
    assert any('Desc' in x for x in sigs)
    assert any('_IC_' in x for x in sigs)
    assert any('Syzygy' in x for x in sigs)
    assert any('Spirit' in x for x in sigs)
    assert any('Cusp' in x for x in sigs)
    for r in ext:
        assert len(r) == 5


def test_cusp_promissors_emit_hc_rows():
    ext = _rows(pdPromissorTypes=['cusps'])
    assert sum(1 for r in ext if r[1].startswith('HC_')) > 0


def test_extras_work_in_mundo_and_engine_family():
    m = _rows(pdtype=1, pdSignificators=['Desc', 'Syzygy'], pdPromissorTypes=['cusps'])
    sigs = {r[2] for r in m}
    assert any('Syzygy' in x for x in sigs)
    e = _rows(pdProjection='placidus', pdSignificators=['Desc', 'IC', 'Spirit'])
    sigs_e = {r[2] for r in e}
    assert any('Desc' in x for x in sigs_e) and any('Spirit' in x for x in sigs_e)


def test_campanus_regio_split_only_on_cusps():
    cam = _rows(pdProjection='campanus', pdFrame='campanus', pdSignificators=['Cusps'])
    reg = _rows(pdProjection='regiomontanus', pdFrame='regiomontanus', pdSignificators=['Cusps'])

    def split(rs):
        body = [tuple(r[:3]) for r in rs if 'Cusp' not in r[1] and 'Cusp' not in r[2]]
        cusp = {(r[1], r[2]): r[0] for r in rs if 'Cusp' in r[2]}
        return body, cusp

    cam_body, cam_cusp = split(cam)
    reg_body, reg_cusp = split(reg)
    assert cam_body == reg_body                     # 行星本体行:两派完全相同
    common = cam_cusp.keys() & reg_cusp.keys()
    assert common
    diffs = [k for k in common if abs(cam_cusp[k] - reg_cusp[k]) > 0.01]
    assert len(diffs) == len(common)                # 宫始点行:全部分差


def test_spirit_formula_diurnal_nocturnal():
    from flatlib import const
    for t, expect_diurnal in (('12:30:00', True), ('23:30:00', False)):
        cd = dict(BASE)
        cd.update({'time': t, 'pdSignificators': ['Spirit']})
        pc = perchart.PerChart(cd)
        chart = pc.getChart()
        assert bool(chart.isDiurnal()) is expect_diurnal
        pp = perpredict.PerPredict(pc)
        pts = {p['id']: p for p in pp._pdExtraSignificatorPoints(chart)}
        asc = float(chart.get(const.ASC).lon)
        sun = float(chart.get(const.SUN).lon)
        moon = float(chart.get(const.MOON).lon)
        want = (asc + sun - moon) if expect_diurnal else (asc + moon - sun)
        assert abs((pts['N_Spirit_0']['lon'] - want) % 360.0) < 1e-9
