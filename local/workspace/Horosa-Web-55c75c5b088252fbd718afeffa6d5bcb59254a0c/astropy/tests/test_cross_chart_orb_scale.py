# -*- coding: utf-8 -*-
"""比较盘的跨盘接触容许度 = 1° × 容许度整体倍率;关系量化分的误差衰减按同一个上限归一。

- 不调倍率(缺省 / 1 / 非法):判定与固定 1° 逐字相同,回包不多字段。
- 倍率 2:命中集 = 误差 < 2° 的全部(是倍率 1 命中集的超集),回包带 crossOrb=2;映点 / 反映点 / 中点同一把尺。
- 量化:同一条相位、同样的相对误差(误差 / 上限),衰减系数相同。
"""
import copy
import json
import os
import sys

import jsonpickle
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from astrostudy.modern.chartcomp import ChartComp, CROSS_ASPECT_ORB, cross_orb  # noqa: E402
from astrostudy.astroextra_parts.relative import score_relative_comp, build_relative_score  # noqa: E402

A = {'date': '1975/02/10', 'time': '21:15:00', 'zone': '-08:00', 'lat': '47n36', 'lon': '122w20',
     'hsys': 0, 'zodiacal': 0, 'tradition': False, 'predictive': False}
B = {'date': '1990/01/01', 'time': '08:00:00', 'zone': '+08:00', 'lat': '31n14', 'lon': '121e28',
     'hsys': 0, 'zodiacal': 0, 'tradition': False, 'predictive': False}


def _comp(**extra):
    a, b = copy.deepcopy(dict(A, **extra)), copy.deepcopy(dict(B, **extra))
    return json.loads(jsonpickle.encode(ChartComp(a, b).compute(), unpicklable=False))


def _pairs(comp, key='outToInAsp'):
    return {(row['id'], o['id'], o['aspect']): o['delta'] for row in comp[key] for o in row['objects']}


def test_cross_orb_reads_the_scale_and_ignores_garbage():
    assert cross_orb({}, {}) == CROSS_ASPECT_ORB == 1.0
    assert cross_orb({'orbScale': 1}, {}) == 1.0
    assert cross_orb({'orbScale': '1.5'}) == 1.5
    assert cross_orb({}, {'orbScale': 2}) == 2.0
    for bad in (0, -1, 'abc', None, '', float('nan'), float('inf')):
        assert cross_orb({'orbScale': bad}) == 1.0, bad
    assert cross_orb(None, 'x') == 1.0


@pytest.mark.parametrize('extra', [{}, {'orbScale': 1}, {'orbScale': '1'}, {'orbScale': 0}, {'orbs': {'Sun': 12}}])
def test_default_scale_is_the_fixed_one_degree(extra):
    base, got = _comp(), _comp(**extra)
    assert 'crossOrb' not in got
    for key in ('outToInAsp', 'inToOutAsp', 'inToOutAnti', 'outToInAnti', 'inToOutCAnti', 'outToInCAnti',
                'inToOutMidpoint', 'outToInMidpoint'):
        assert got[key] == base[key], key
    assert _pairs(base) and all(d < 1.0 for d in _pairs(base).values())


def test_scale_widens_every_cross_chart_contact_by_the_same_factor():
    base, wide = _comp(), _comp(orbScale=2)
    assert wide['crossOrb'] == 2.0
    for key in ('outToInAsp', 'inToOutAsp'):
        pb, pw = _pairs(base, key), _pairs(wide, key)
        assert set(pb) < set(pw), key                       # 真超集:确实多出了 1°–2° 之间的相位
        assert all(pw[k] == pb[k] for k in pb)
        assert all(d < 2.0 for d in pw.values()) and any(d >= 1.0 for d in pw.values())
    for key in ('inToOutAnti', 'outToInAnti', 'inToOutCAnti', 'outToInCAnti'):
        assert len(wide[key]) >= len(base[key]) and all(x['delta'] < 2.0 for x in wide[key])
    nb = sum(len(v) for v in base['inToOutMidpoint'].values())
    nw = sum(len(v) for v in wide['inToOutMidpoint'].values())
    assert nw > nb
    narrow = _comp(orbScale=0.5)
    assert narrow['crossOrb'] == 0.5 and set(_pairs(narrow)) <= set(_pairs(base))
    assert all(d < 0.5 for d in _pairs(narrow).values())


def test_score_decay_is_normalised_by_the_effective_orb():
    def comp_with(delta, cross=None):
        c = {'outToInAsp': [{'id': 'Sun', 'objects': [{'id': 'Moon', 'aspect': 120, 'delta': delta}]}], 'inToOutAsp': []}
        if cross is not None:
            c['crossOrb'] = cross
        return c
    one = score_relative_comp(comp_with(0.5))['aspects'][0]['impact']
    two = score_relative_comp(comp_with(1.0, 2.0))['aspects'][0]['impact']
    assert one == pytest.approx(two)                                   # 相对误差同为一半 → 衰减相同
    assert score_relative_comp(comp_with(1.0, 2.0))['aspects'][0]['impact'] > score_relative_comp(comp_with(1.6, 2.0))['aspects'][0]['impact']
    floor = score_relative_comp(comp_with(1.99, 2.0))['aspects'][0]['impact']
    assert floor == pytest.approx(4 * 0.2)                             # 贴着上限只剩两成


def test_relative_score_entry_passes_the_scale_to_both_charts():
    req = {'inner': {k: A[k] for k in ('date', 'time', 'zone', 'lat', 'lon')},
           'outer': {k: B[k] for k in ('date', 'time', 'zone', 'lat', 'lon')}, 'hsys': 0, 'zodiacal': 0}
    base = build_relative_score(copy.deepcopy(req))
    wide = build_relative_score(dict(copy.deepcopy(req), orbScale=2))
    assert 'crossOrb' not in base['raw'] and wide['raw']['crossOrb'] == 2.0
    assert len(wide['aspects']) > len(base['aspects'])
