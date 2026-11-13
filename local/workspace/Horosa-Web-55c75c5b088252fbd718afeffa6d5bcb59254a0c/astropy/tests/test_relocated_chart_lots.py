"""搬过点的盘(组合盘 / 合盘 / 骰子盘 / 推运图 / 分盘)不重跑希腊点变体:点已按本命口径起好,跟着搬点的结果走。

此前 reinit 会按盘上此刻的日、月、上升把点重起一遍:福点反转关时,合盘里换过来的对方福点被盖成
「自己的上升 + 对方的月 − 对方的日」;整星座投射时组合盘的福点被按组合上升重投。十三分等派生盘本就不重跑,两边口径不一。
同时:组合盘其余希腊点逐点取短弧中点、合盘其余希腊点换成对方的(此前都原样留着第一张盘的本命位置,只有福点跟着走)。
"""
import copy
import json
import os
import sys

import jsonpickle
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from flatlib import const  # noqa: E402
from astrostudy.perchart import PerChart, push_classical_request, pop_classical_request  # noqa: E402
from astrostudy.modern.chartcomposite import ChartComposite  # noqa: E402
from astrostudy.modern.chartsynastry import ChartSynastry  # noqa: E402

A = {'date': '1975/02/10', 'time': '21:15:00', 'zone': '-08:00', 'lat': '47n36', 'lon': '122w20',
     'hsys': 0, 'zodiacal': 0, 'tradition': False, 'predictive': False}
B = {'date': '1990/01/01', 'time': '08:00:00', 'zone': '+08:00', 'lat': '31n14', 'lon': '121e28',
     'hsys': 0, 'zodiacal': 0, 'tradition': False, 'predictive': False}
VARIANTS = [{}, {'lotReversal': 0}, {'lotProjection': 'sign'}, {'erosConstruction': 'valens'},
            {'lotFortuneVariant': 'moonAboveNight'}, {'hermeticLotsReversal': 0}]
IDS = [('&'.join('%s=%s' % kv for kv in v.items()) or 'default') for v in VARIANTS]


def _close(a, b, tol=1e-6):
    return abs(((a - b + 180.0) % 360.0) - 180.0) < tol


def _run(fn, extra):
    a, b = copy.deepcopy(dict(A, **extra)), copy.deepcopy(dict(B, **extra))
    token = push_classical_request(a)
    try:
        res = fn(a, b)
        na, nb = PerChart(copy.deepcopy(dict(A, **extra))), PerChart(copy.deepcopy(dict(B, **extra)))
    finally:
        pop_classical_request(token)
    return json.loads(jsonpickle.encode(res, unpicklable=False)), na, nb


def _lots(pc):
    out = {p.id: p.lon for p in pc.chart.pars}
    out[const.PARS_FORTUNA] = pc.chart.getObject(const.PARS_FORTUNA).lon
    return out


def _chart_lots(obj):
    out = {o['id']: o['lon'] for o in (obj.get('lots') or [])}
    out.update({o['id']: o['lon'] for o in obj['chart']['objects'] if o['id'] == const.PARS_FORTUNA})
    return out


@pytest.mark.parametrize('extra', VARIANTS, ids=IDS)
def test_composite_lots_are_short_arc_midpoints_of_the_two_charts(extra):
    res, na, nb = _run(lambda a, b: ChartComposite(a, b).compute(), extra)
    la, lb, got = _lots(na), _lots(nb), _chart_lots(res)
    assert len(got) > 5 and const.PARS_FORTUNA in got
    for k, v in got.items():
        assert _close(v, ChartComposite.shortArcMid(la[k], lb[k])), (k, v, la[k], lb[k])


@pytest.mark.parametrize('extra', VARIANTS, ids=IDS)
def test_synastry_lots_are_the_other_charts_lots(extra):
    res, na, nb = _run(lambda a, b: ChartSynastry(a, b).compute(), extra)
    la, lb = _lots(na), _lots(nb)
    inner, outer = _chart_lots(res['inner']), _chart_lots(res['outer'])
    assert len(inner) > 5 and len(outer) > 5
    for k, v in inner.items():
        assert _close(v, lb[k]), ('inner', k, v, lb[k])
    for k, v in outer.items():
        assert _close(v, la[k]), ('outer', k, v, la[k])


def test_frozen_chart_keeps_lots_on_a_second_reinit():
    d = copy.deepcopy(dict(A, lotReversal=0, lotProjection='sign'))
    token = push_classical_request(d)
    try:
        pc = PerChart(d)
        pf = pc.chart.getObject(const.PARS_FORTUNA)
        pf.relocate((pf.lon + 77.0) % 360.0)
        moved = pf.lon
        pc.markRelocated()
        pc.reinit()
        assert _close(pc.chart.getObject(const.PARS_FORTUNA).lon, moved)
        # 反向:没标搬点的盘照旧重跑(本命盘的变体不能被这把锁关掉)
        pc2 = PerChart(copy.deepcopy(d))
        pf2 = pc2.chart.getObject(const.PARS_FORTUNA)
        keep = pf2.lon
        pf2.relocate((pf2.lon + 77.0) % 360.0)
        pc2.reinit()
        assert _close(pc2.chart.getObject(const.PARS_FORTUNA).lon, keep)
    finally:
        pop_classical_request(token)
