# -*- coding: utf-8 -*-
"""主限法三组设置开关:忽略应星 / 迫星黄纬、相位侧(右旋 / 左旋)、传统逆向。

传统逆向开(默认)= 应星被周日运动带到迫星相位点;关(新式逆向)= 迫星相位点被带到应星本命位置。
赤经线性的方位法只差一个符号,半弧 / 极下 / 黄极圈与世俗半弧要改动点,本就是迫星在动的核不变。
"""
import gzip
import json
from pathlib import Path

import pytest

from astrostudy import perchart, perpredict

CORPUS = (Path(__file__).resolve().parent / 'data' / 'pd_calibration_corpus'
          / 'golden_alcabitius_ptolemy_v266.ndjson.gz')
AXES = {'Asc', 'MC', 'Desc', 'IC', 'Vertex', 'Antivertex'}
SIGNED_AXES = {'Asc', 'Desc', 'Vertex', 'Antivertex'}


def _chart(i=0):
    with gzip.open(CORPUS, 'rt', encoding='utf-8') as f:
        for k, line in enumerate(f):
            if k == i:
                cd = dict(json.loads(line)['chart_data'])
                cd['pdTimeKey'] = 'Ptolemy'
                return cd
    raise AssertionError('corpus too short')


def _rows(cd, **over):
    d = dict(cd)
    d.update(over)
    return perpredict.PerPredict(perchart.PerChart(d)).getPrimaryDirection()


def _sig(row):
    return '_'.join(str(row[2]).split('_')[1:-1])


def _key(row, sign=1.0):
    return (round(sign * float(row[0]), 7), row[1], row[2])


def test_defaults_parse_to_current_behaviour():
    pc = perchart.PerChart(_chart())
    assert pc.pdAspectSide == 0
    assert pc.pdIgnoreSigLat is False and pc.pdIgnorePromLat is False
    assert pc.pdTradConverse is True
    assert pc.pdLunarParallax is False
    assert pc.pdTruePosition is False
    for v in (None, 1, '1', True):
        assert perchart.PerChart(dict(_chart(), pdTradConverse=v)).pdTradConverse is True
    for v in (0, '0', False, 'false'):
        assert perchart.PerChart(dict(_chart(), pdTradConverse=v)).pdTradConverse is False
    assert perchart.PerChart(dict(_chart(), pdAspectSide='7')).pdAspectSide == 0


@pytest.mark.parametrize('pdtype', [0, 1])
def test_explicit_default_switches_are_identical(pdtype):
    cd = dict(_chart(), pdtype=pdtype)
    base = _rows(cd)
    same = _rows(cd, pdAspectSide=0, pdIgnoreSigLat=0, pdIgnorePromLat=0, pdTradConverse=1)
    assert [list(r[:3]) for r in base] == [list(r[:3]) for r in same]


@pytest.mark.parametrize('pd_method', ['core_alchabitius', 'placidus'])
def test_ignore_significator_latitude_changes_body_arcs(pd_method):
    cd = dict(_chart(), pdtype=0, pdMethod=pd_method)
    base = {_key(r) for r in _rows(cd) if _sig(r) not in AXES}
    flat = {_key(r) for r in _rows(cd, pdIgnoreSigLat=1) if _sig(r) not in AXES}
    assert base and flat and base != flat


def test_ignore_promissor_latitude_changes_mundo_rows():
    cd = dict(_chart(), pdtype=1)
    assert {_key(r) for r in _rows(cd)} != {_key(r) for r in _rows(cd, pdIgnorePromLat=1)}


@pytest.mark.parametrize('pdtype', [0, 1])
def test_aspect_side_filters(pdtype):
    cd = dict(_chart(), pdtype=pdtype)
    allr = _rows(cd)
    dex = _rows(cd, pdAspectSide=1)
    sin = _rows(cd, pdAspectSide=2)
    pre = lambda rows: {str(r[1]).split('_')[0] for r in rows}
    assert 'S' not in pre(dex) and 'D' in pre(dex)
    assert 'D' not in pre(sin) and 'S' in pre(sin)
    opp = lambda rows: {_key(r) for r in rows if str(r[1]).endswith('_180')}
    assert opp(dex) == opp(allr) == opp(sin)
    body_conj = lambda rows: {_key(r) for r in rows if str(r[1]).endswith('_0') and _sig(r) not in AXES}
    assert not body_conj(dex) and body_conj(sin) == body_conj(allr)
    axis_conj = lambda rows: {_key(r) for r in rows if str(r[1]).endswith('_0') and _sig(r) in AXES}
    assert axis_conj(dex) == axis_conj(allr)


def _split(rows):
    body = {_key(r) for r in rows if _sig(r) not in AXES}
    axes = {_key(r) for r in rows if _sig(r) in AXES}
    return body, axes


@pytest.mark.parametrize('over', [{'pdMethod': 'core_alchabitius'}, {'pdMethod': 'in_zodiaco_lon'},
                                  # 纯黄道(斜升差)与赤经直推:弧同为两点对称的差值,新式逆向同样只变号
                                  {'pdProjection': 'zodiacal', 'pdFrame': 'alcabitius'},
                                  {'pdProjection': 'ra_direct', 'pdFrame': 'alcabitius'}])
def test_neo_converse_zodiaco_ra_methods_flip_body_rows(over):
    cd = dict(_chart(), pdtype=0, **over)
    trad, neo = _rows(cd), _rows(cd, pdTradConverse=0)
    tb, ta = _split(trad)
    nb, na = _split(neo)
    assert nb == {(-a, p, s) for a, p, s in tb}
    assert na == ta


def test_neo_converse_edmund_unchanged():
    cd = dict(_chart(), pdtype=0, pdMethod='in_zodiaco_abs')
    assert {_key(r) for r in _rows(cd)} == {_key(r) for r in _rows(cd, pdTradConverse=0)}


@pytest.mark.parametrize('pd_method', ['placidus', 'regiomontanus', 'morinus'])
def test_neo_converse_position_circle_methods_move_the_promissor(pd_method):
    cd = dict(_chart(), pdtype=0, pdMethod=pd_method)
    tb, ta = _split(_rows(cd))
    nb, na = _split(_rows(cd, pdTradConverse=0))
    assert na == ta
    assert nb and nb != tb and nb != {(-a, p, s) for a, p, s in tb}


def test_neo_converse_mundo_alcabitius_flips_signed_axes_only():
    cd = dict(_chart(), pdtype=1)
    trad, neo = _rows(cd), _rows(cd, pdTradConverse=0)
    tb, _ = _split(trad)
    nb, _ = _split(neo)
    assert nb == tb
    for axis, sign in (('Asc', -1.0), ('Antivertex', -1.0), ('MC', 1.0), ('IC', 1.0)):
        t = {_key(r, sign) for r in trad if _sig(r) == axis}
        n = {_key(r) for r in neo if _sig(r) == axis}
        assert t and t == n, axis


@pytest.mark.parametrize('pd_method', ['meridian', 'morinus', 'equal_hour_circle'])
def test_neo_converse_mundo_significator_moving_methods_flip(pd_method):
    cd = dict(_chart(), pdtype=1, pdMethod=pd_method)
    tb, _ = _split(_rows(cd))
    nb, _ = _split(_rows(cd, pdTradConverse=0))
    assert nb == {(-a, p, s) for a, p, s in tb}


def test_neo_converse_mundo_placidus_swaps_roles():
    cd = dict(_chart(), pdtype=1, pdMethod='placidus')
    tb, _ = _split(_rows(cd))
    nb, _ = _split(_rows(cd, pdTradConverse=0))
    assert nb and nb != tb and nb != {(-a, p, s) for a, p, s in tb}


@pytest.mark.parametrize('pdtype', [0, 1])
def test_neo_converse_direction_filter_applies_after_transform(pdtype):
    cd = dict(_chart(), pdtype=pdtype, pdTradConverse=0)
    direct = _rows(cd, pdConverse=0)
    converse = _rows(cd, pdDirect=0, pdConverse=1)
    assert direct and all(float(r[0]) > 0 for r in direct)
    assert converse and all(float(r[0]) < 0 for r in converse)
    both = {_key(r) for r in _rows(cd)}
    assert both == {_key(r) for r in direct} | {_key(r) for r in converse}


@pytest.mark.parametrize('pdtype', [0, 1])
def test_lunar_parallax_moves_only_moon_promissor_rows(pdtype):
    cd = dict(_chart(), pdtype=pdtype)
    base = {_key(r) for r in _rows(cd)}
    prlx = {_key(r) for r in _rows(cd, pdLunarParallax=1)}
    moon_p = lambda keys: {k for k in keys if '_Moon_' in k[1]}
    assert moon_p(base) and moon_p(base) != moon_p(prlx)
    assert base - moon_p(base) == prlx - moon_p(prlx)


@pytest.mark.parametrize('pdtype', [0, 1])
def test_true_position_shifts_bodies_slightly_and_keeps_rows(pdtype):
    cd = dict(_chart(), pdtype=pdtype)
    base = {(r[1], r[2]): float(r[0]) for r in _rows(cd)}
    tp = {(r[1], r[2]): float(r[0]) for r in _rows(cd, pdTruePosition=1)}
    common = set(base) & set(tp)
    assert len(common) > 0.95 * len(base)
    diffs = [abs(base[k] - tp[k]) for k in common]
    assert max(diffs) < 0.1 and sum(1 for d in diffs if d > 1e-6) > 0.5 * len(diffs)


@pytest.mark.parametrize('pdtype,pd_method', [(0, 'core_alchabitius'), (0, 'placidus'), (0, 'in_zodiaco_lon'),
                                              (0, 'in_zodiaco_abs'), (1, 'core_alchabitius'), (1, 'placidus'),
                                              (4, 'core_alchabitius')])
def test_fixed_star_promissors_take_full_aspect_set(pdtype, pd_method):
    cd = dict(_chart(), pdtype=pdtype, pdMethod=pd_method)
    plain = _rows(cd)
    rows = _rows(cd, pdPromissorTypes=['stars'])
    pre = {str(r[1]).split('_')[0] for r in rows}
    # Edmund Jones 只用右旋相位点,赤经支的行记左旋,所以三种前缀同样都会出现
    assert {'FS', 'FSD', 'FSS'} <= pre
    assert not any(str(r[1]).split('_')[1] in perpredict.PerPredict._PD_STAR_ROSTER
                   and str(r[1]).split('_')[0] in ('N', 'D', 'S') for r in rows)
    # 恒星以外的行不受影响
    assert {_key(r) for r in plain} == {_key(r) for r in rows if not str(r[1]).startswith('FS')}


def test_fixed_star_rows_follow_switches():
    cd = dict(_chart(), pdtype=0, pdPromissorTypes=['stars'])
    dex = _rows(cd, pdAspectSide=1)
    assert 'FSS' not in {str(r[1]).split('_')[0] for r in dex}
    trad = {_key(r) for r in _rows(cd) if str(r[1]).startswith('FS')}
    neo = {_key(r) for r in _rows(cd, pdTradConverse=0) if str(r[1]).startswith('FS') and _sig(r) not in AXES}
    assert neo == {(-a, p, s) for a, p, s in trad if s.split('_')[1] not in AXES}


def test_sphere_rows_match_table_rows_for_all_switches():
    for over in ({}, {'pdTradConverse': 0}, {'pdAspectSide': 2}, {'pdPromissorTypes': ['stars']},
                 {'pdtype': 1, 'pdTradConverse': 0}):
        cd = dict(_chart(), pdtype=0)
        cd.update(over)
        table = [(round(float(r[0]), 9), r[1], r[2]) for r in _rows(cd)]
        sphere = perpredict.PerPredict(perchart.PerChart(cd)).getPrimaryDirection3D()
        got = [(round(float(r['arc']), 9), r['prom'], r['sig']) for r in sphere['rows']]
        assert got == table, over
        assert all(r['prom'] in sphere['points'] for r in sphere['rows'] if str(r['prom']).startswith('FS'))


def test_geometry_variant_defaults_to_improved():
    assert perchart.PerChart(_chart()).pdGeometry == 'improved'
    assert perchart.PerChart(dict(_chart(), pdGeometry='classic')).pdGeometry == 'classic'
    assert perchart.PerChart(dict(_chart(), pdGeometry='nope')).pdGeometry == 'improved'


@pytest.mark.parametrize('pdtype,pd_method', [(0, 'core_alchabitius'), (0, 'in_zodiaco_lon'), (0, 'morinus'),
                                              (1, 'meridian'), (1, 'morinus'), (1, 'equal_hour_circle')])
def test_geometry_variant_does_not_touch_other_methods(pdtype, pd_method):
    cd = dict(_chart(), pdtype=pdtype, pdMethod=pd_method)
    assert {_key(r) for r in _rows(cd)} == {_key(r) for r in _rows(cd, pdGeometry='classic')}


@pytest.mark.parametrize('pdtype,pd_method', [(0, 'placidus'), (0, 'regiomontanus'), (0, 'campanus'),
                                              (0, 'in_zodiaco_abs'), (1, 'core_alchabitius'), (1, 'placidus'),
                                              (1, 'regiomontanus'), (1, 'campanus'), (1, 'porphyry'), (4, 'placidus')])
def test_geometry_variant_switches_position_methods(pdtype, pd_method):
    # 样本盘 RAMC 落在 180° 以后,经典写法的东西判定与严格几何不同
    cd = dict(_chart(), pdtype=pdtype, pdMethod=pd_method)
    imp = {_key(r) for r in _rows(cd)}
    cls = {_key(r) for r in _rows(cd, pdGeometry='classic')}
    assert imp and cls and imp != cls


# 引擎族方位法(Topocentric / Placidus 极下近似 / 黄道斜升 / 赤经直推)与核心族同一套点表设置项
ENGINE_METHODS = ['topocentric', 'placidus_under_pole', 'zodiacal', 'ra_direct']


@pytest.mark.parametrize('pd_method', ENGINE_METHODS)
def test_engine_methods_explicit_default_point_options_are_identical(pd_method):
    cd = dict(_chart(), pdtype=0, pdMethod=pd_method, pdProjection=pd_method)
    base = [list(r[:3]) for r in _rows(cd)]
    same = [list(r[:3]) for r in _rows(cd, pdIgnoreSigLat=0, pdIgnorePromLat=0, pdLunarParallax=0, pdTruePosition=0)]
    assert base and base == same


@pytest.mark.parametrize('pd_method', ENGINE_METHODS)
def test_engine_methods_follow_true_position_and_lunar_parallax(pd_method):
    cd = dict(_chart(), pdtype=0, pdMethod=pd_method, pdProjection=pd_method)
    assert perpredict.PerPredict(perchart.PerChart(cd))._pdResolveProjectionFrame()[0] == pd_method
    base = {_key(r) for r in _rows(cd)}
    assert base != {_key(r) for r in _rows(cd, pdTruePosition=1)}
    prlx = {_key(r) for r in _rows(cd, pdLunarParallax=1)}
    moon_p = lambda keys: {k for k in keys if '_Moon_' in k[1]}
    assert moon_p(base) and moon_p(base) != moon_p(prlx)
    assert base - moon_p(base) == prlx - moon_p(prlx)


def test_engine_mundo_follows_latitude_switches():
    cd = dict(_chart(), pdtype=1, pdMethod='topocentric')
    base = {_key(r) for r in _rows(cd)}
    no_sig = {_key(r) for r in _rows(cd, pdIgnoreSigLat=1)}
    no_prom = {_key(r) for r in _rows(cd, pdIgnorePromLat=1)}
    assert base and base != no_sig and base != no_prom and no_sig != no_prom


@pytest.mark.parametrize('over', [{}, {'pdIgnoreSigLat': 1}, {'pdIgnorePromLat': 1}, {'pdTruePosition': 1}])
def test_engine_sphere_points_match_table_positions(over):
    # 天球点表的本体位置 = 表格算弧时用的位置(In Mundo 带真黄纬,取点设置同步)
    cd = dict(_chart(), pdtype=1, pdMethod='topocentric')
    cd.update(over)
    pp = perpredict.PerPredict(perchart.PerChart(cd))
    bodies, _angles, _armc, _phi, _eps, _jd = pp._pdEngineChartData()
    sig_b, prom_b = pp._pdEngineOptionBodies(bodies, pp._PD_ENGINE_SIGNIFICATORS, pp._PD_ENGINE_PROMISSORS)
    pts = pp.getPrimaryDirection3D()['points']
    checked = 0
    for pid, pt in pts.items():
        parts = pid.split('_')
        if len(parts) != 3 or parts[0] != 'N' or parts[2] != '0':
            continue
        src = sig_b if parts[1] in pp._PD_ENGINE_SIGNIFICATORS else prom_b
        if parts[1] not in src:
            continue
        assert abs(float(pt['lon']) - src[parts[1]]['lon']) < 1e-9, (over, pid)
        assert abs(float(pt['lat']) - src[parts[1]]['lat']) < 1e-9, (over, pid)
        checked += 1
    assert checked >= 5


def test_poles_follow_significator_point_options():
    cd = dict(_chart(), pdtype=1, pdMethod='regiomontanus')
    base = perpredict.PerPredict(perchart.PerChart(cd)).getPdPoles()['poles']
    same = perpredict.PerPredict(perchart.PerChart(dict(cd, pdIgnoreSigLat=0, pdTruePosition=0))).getPdPoles()['poles']
    assert base == same
    flat = perpredict.PerPredict(perchart.PerChart(dict(cd, pdIgnoreSigLat=1))).getPdPoles()['poles']
    assert set(flat) == set(base)
    assert any(abs(flat[k] - base[k]) > 1e-3 for k in base if k not in ('Asc', 'MC', 'Desc', 'IC'))
    assert all(flat[k] == base[k] for k in ('Asc', 'MC', 'Desc', 'IC'))


# 几何口径表(pd_geometry.APPLIES)与引擎实测一致:列了的组合两档不同,没列的相同(抽样,全矩阵另跑过)
@pytest.mark.parametrize('pdtype,proj,frame,par', [
    (0, 'placidus', 'alcabitius', 0), (0, 'in_zodiaco_abs', 'alcabitius', 0), (4, 'campanus', 'alcabitius', 0),
    (1, 'ptolemy', 'alcabitius', 0), (1, 'ptolemy', 'porphyry', 0), (1, 'regiomontanus', 'koch', 0),
    (1, 'ptolemy', 'meridian', 1), (1, 'morinus', 'alcabitius', 1),
    (0, 'ptolemy', 'alcabitius', 0), (0, 'morinus', 'alcabitius', 0), (0, 'topocentric', 'alcabitius', 0),
    (4, 'ptolemy', 'porphyry', 0), (1, 'ptolemy', 'meridian', 0), (1, 'morinus', 'alcabitius', 0),
    (1, 'ptolemy', 'wholesign', 1), (1, 'topocentric', 'alcabitius', 1),
])
def test_geometry_applies_table_matches_engine(pdtype, proj, frame, par):
    from astrostudy import pd_geometry
    differs = False
    for i in (0, 23):
        cd = dict(_chart(i), pdtype=pdtype, pdProjection=proj, pdFrame=frame, pdParallel=par)
        if {_key(r) for r in _rows(cd)} != {_key(r) for r in _rows(cd, pdGeometry='classic')}:
            differs = True
            break
    assert differs == pd_geometry.applies(pdtype, proj, frame, bool(par))
