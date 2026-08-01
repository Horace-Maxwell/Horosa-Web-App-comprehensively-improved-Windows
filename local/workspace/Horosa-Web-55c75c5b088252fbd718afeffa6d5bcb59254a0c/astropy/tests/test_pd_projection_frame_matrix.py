# -*- coding: utf-8 -*-
"""主限法 投影×定局 解耦正交性守卫(P0-1)。

解耦语义:pdProjection 决定**弧**,pdFrame 决定**盘面宫始点**,二者正交。
本文件锁四条红线:
  T1 🔴 零回归:显式 (ptolemy, alcabitius) == 旧 pdMethod='core_alchabitius' == 全缺省,逐字节。
  T2 🔴 换 frame 弧恒等:同 projection 下任意 frame,getPrimaryDirection 输出逐字节不变。
  T3 换 projection 弧有差:同 frame 下各 projection 输出互不相同。
  T4 frame 单独决定盘面宫制:_pdChartHouseSystem 随 frame 变、不随 projection 变。
另:旧 13 键 pdMethod → 新 (projection, frame) 兼容映射逐键弧等价;新投影(zodiacal/ra_direct)
行 shape 5 元;未知值回落默认对。
"""
import json

import pytest
from flatlib import const

from astrostudy import perchart, perpredict
from astrostudy.perpredict import _PD_METHOD_TO_PAIR, _PD_PROJECTION_REGISTRY, _PD_FRAME_HSYS


BASE = {
    'date': '1990/03/15', 'time': '12:30:00', 'zone': '+08:00',
    'lat': '39N54', 'lon': '116E28', 'ad': 1, 'hsys': 'PLACIDUS',
    'pdTimeKey': 'Ptolemy', 'pdYears': 100,
    'pdtype': 0, 'pdaspects': [0, 60, 90, 120, 180],
}


def _predict(**over):
    cd = dict(BASE)
    cd.update(over)
    pc = perchart.PerChart(cd)
    return perpredict.PerPredict(pc)


def _rows(**over):
    return _predict(**over).getPrimaryDirection()


def _dump(rows):
    return json.dumps(rows, sort_keys=True, ensure_ascii=False, default=str)


def test_default_pair_byte_identical_to_legacy_method():
    legacy = _dump(_rows())                                        # 全缺省(pdMethod 默认)
    legacy2 = _dump(_rows(pdMethod='core_alchabitius'))            # 旧显式
    pair = _dump(_rows(pdProjection='ptolemy', pdFrame='alcabitius'))  # 新显式
    assert legacy == legacy2 == pair


@pytest.mark.parametrize('method', sorted(_PD_METHOD_TO_PAIR.keys()))
def test_each_legacy_method_equals_its_pair(method):
    proj, frame = _PD_METHOD_TO_PAIR[method]
    old = _dump(_rows(pdMethod=method))
    over = {'pdProjection': proj}
    if frame is not None:
        over['pdFrame'] = frame
    new = _dump(_rows(**over))
    assert old == new, method


@pytest.mark.parametrize('frame', ['alcabitius', 'placidus', 'regiomontanus',
                                   'campanus', 'wholesign', 'equal', 'koch'])
def test_frame_change_keeps_arc_identical(frame):
    base = _dump(_rows(pdProjection='placidus', pdFrame='placidus'))
    other = _dump(_rows(pdProjection='placidus', pdFrame=frame))
    assert base == other, frame


def test_projection_change_does_differ():
    outs = {}
    for proj in ('ptolemy', 'placidus', 'regiomontanus', 'topocentric', 'ra_direct'):
        outs[proj] = _dump(_rows(pdProjection=proj, pdFrame='alcabitius'))
    vals = list(outs.values())
    assert len(set(vals)) == len(vals), '各投影输出应互不相同'


def test_frame_alone_drives_chart_house_system():
    for frame, hsys in (('alcabitius', const.HOUSES_ALCABITUS),
                        ('wholesign', const.HOUSES_WHOLE_SIGN),
                        ('koch', const.HOUSES_KOCH),
                        ('regiomontanus', const.HOUSES_REGIOMONTANUS)):
        for proj in ('ptolemy', 'placidus'):
            pp = _predict(pdProjection=proj, pdFrame=frame)
            assert pp._pdChartHouseSystem(None) == hsys, (proj, frame)
    # frame=None(in_zodiaco_lon 推导)→ 回落本命盘宫制
    pp = _predict(pdMethod='in_zodiaco_lon')
    assert pp._pdChartHouseSystem('in_zodiaco_lon') == pp.perchart.house


@pytest.mark.parametrize('proj', ['zodiacal', 'ra_direct'])
def test_new_projections_rows_shape(proj):
    rows = _rows(pdProjection=proj, pdFrame='equal')
    assert rows, proj
    for row in rows:
        assert len(row) == 5, row
        assert isinstance(row[0], float) and isinstance(row[1], str)


def test_unknown_values_fall_back_to_default_pair():
    fallback = _dump(_rows(pdProjection='nonsense', pdFrame='bogus'))
    default = _dump(_rows())
    assert fallback == default


def test_registry_integrity():
    # 每个投影键都有可解析的 handler;每个 frame 键映射到合法宫制常量
    pp = _predict()
    for proj, handler in _PD_PROJECTION_REGISTRY.items():
        assert callable(getattr(pp, handler, None)), proj
    for frame, hsys in _PD_FRAME_HSYS.items():
        assert hsys in perpredict.swe.SWE_HOUSESYS, frame
