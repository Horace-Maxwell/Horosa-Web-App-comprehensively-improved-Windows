"""量化盘「中点坐标」:赤经中点 / 赤纬中点。

守住:
 1. 坐标用黄→赤真换算(swisseph.cotrans 独立复核),四轴按黄道点取(黄纬 0)。
 2. 赤经中点 = 近轴中点(与黄经中点同一取法);赤纬中点 = 平均。
 3. 接触:赤经折叠到 0 / 90 / 180 在容许度内;赤纬相等 = 平行、相反 = 反平行;不含构成中点的两点本身。
 4. 缺省请求(不带 mpCoord)不算、不出字段。
"""
import gzip
import json
from pathlib import Path

import pytest
import swisseph

from astrostudy import perchart
from astrostudy.germany.midpoint import MidPoint
from astrostudy.germany.coord_midpoint import coord_midpoints

_CORPUS = Path(__file__).resolve().parent / 'data' / 'pd_calibration_corpus' / 'golden_alcabitius_ptolemy_v266.ndjson.gz'


def _objects():
    with gzip.open(_CORPUS, 'rt', encoding='utf-8') as f:
        cd = json.loads(f.readline())['chart_data']
    pc = perchart.PerChart(dict(cd))
    return pc, MidPoint(pc, orb=1.0, uranian=True).objects


def _eq_ref(pc, o):
    eps = swisseph.calc_ut(pc.chart.date.jd, swisseph.ECL_NUT)[0][0]
    ra, decl = swisseph.cotrans((float(o.lon), float(getattr(o, 'lat', 0.0) or 0.0), 1.0), -eps)[:2]
    return ra % 360.0, decl


def test_ra_midpoints_and_contacts_follow_definition():
    pc, objs = _objects()
    res = coord_midpoints(objs, 'ra', 1.0, pc.chart.date.jd)
    ref = {o.id: _eq_ref(pc, o)[0] for o in objs}
    assert res['coord'] == 'ra' and len(res['midpoints']) == len(objs) * (len(objs) - 1) // 2
    for m in res['midpoints']:
        a, b = ref[m['idA']], ref[m['idB']]
        mid = (a + b) / 2.0
        if abs(mid - a) > 90:
            mid = (mid + 180.0) % 360.0
        diff = abs(((m['value'] - mid + 180.0) % 360.0) - 180.0)
        # 两点正好相对(南北交)时两侧中点都对,取哪侧由浮点决定
        assert diff < 1e-6 or (abs(abs(((a - b + 180.0) % 360.0) - 180.0) - 180.0) < 1e-6 and abs(diff - 180.0) < 1e-6), m
    assert res['contacts'], '样本盘应至少有一处赤经中点接触'
    for c in res['contacts']:
        assert c['id'] not in (c['idA'], c['idB'])
        mid = next(m['value'] for m in res['midpoints'] if (m['idA'], m['idB']) == (c['idA'], c['idB']))
        d = abs(ref[c['id']] - mid) % 360.0
        d = 360.0 - d if d > 180.0 else d
        assert abs(d - c['aspect']) == pytest.approx(c['delta'], abs=1e-3)
        assert c['delta'] < 1.0


def test_decl_midpoints_and_parallels_follow_definition():
    pc, objs = _objects()
    res = coord_midpoints(objs, 'decl', 1.0, pc.chart.date.jd)
    ref = {o.id: _eq_ref(pc, o)[1] for o in objs}
    for m in res['midpoints']:
        assert abs(m['value'] - (ref[m['idA']] + ref[m['idB']]) / 2.0) < 1e-9
    for c in res['contacts']:
        mid = next(m['value'] for m in res['midpoints'] if (m['idA'], m['idB']) == (c['idA'], c['idB']))
        want = mid if c['aspect'] == 'parallel' else -mid
        assert abs(ref[c['id']] - want) <= 1.0 + 1e-6 and c['id'] not in (c['idA'], c['idB'])


def test_unknown_coord_returns_none():
    pc, objs = _objects()
    assert coord_midpoints(objs, 'lon', 1.0, pc.chart.date.jd) is None
