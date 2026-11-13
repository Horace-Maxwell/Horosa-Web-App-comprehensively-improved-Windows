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

from flatlib import const
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


def test_decl_midpoints_skip_the_node_axis():
    """南北交赤纬恒互为相反数,赤纬中点恒为 0:不成中点对;赤经中点照旧保留这一对(与黄经中点同口径)。"""
    pc, objs = _objects()
    axis = frozenset((const.NORTH_NODE, const.SOUTH_NODE))
    n = len(objs)
    decl = coord_midpoints(objs, 'decl', 1.0, pc.chart.date.jd)
    assert axis not in {frozenset((m['idA'], m['idB'])) for m in decl['midpoints']}
    assert len(decl['midpoints']) == n * (n - 1) // 2 - 1
    assert all(frozenset((c['idA'], c['idB'])) != axis for c in decl['contacts'])
    ra = coord_midpoints(objs, 'ra', 1.0, pc.chart.date.jd)
    assert axis in {frozenset((m['idA'], m['idB'])) for m in ra['midpoints']}


def _objects_in(zodiacal):
    with gzip.open(_CORPUS, 'rt', encoding='utf-8') as f:
        cd = json.loads(f.readline())['chart_data']
    pc = perchart.PerChart(dict(cd, zodiacal=zodiacal))
    return pc, MidPoint(pc, orb=1.0, uranian=True).objects


@pytest.mark.parametrize('coord', ['ra', 'decl'])
def test_sidereal_chart_gives_the_same_equatorial_midpoints(coord):
    """赤经赤纬与黄道制无关:同一时刻同一地点,恒星盘与回归盘的赤经 / 赤纬中点与接触必须相同。
    恒星盘各点(行星、虚星、紫气)的 lon 都是恒星黄经,赤道坐标一律按本日真春分点取 —— 两盘逐点同值。"""
    pt, ot = _objects_in(0)
    ps, os_ = _objects_in(1)
    assert pt.zodiacal != ps.zodiacal
    rt = coord_midpoints(ot, coord, 1.0, pt.chart.date.jd)
    rs = coord_midpoints(os_, coord, 1.0, ps.chart.date.jd)
    vt = {(m['idA'], m['idB']): m['value'] for m in rt['midpoints']}
    vs = {(m['idA'], m['idB']): m['value'] for m in rs['midpoints']}
    assert vt.keys() == vs.keys() and vt
    assert any(const.PURPLE_CLOUDS in k for k in vt) and any(k[0] in const.LIST_URANIAN or k[1] in const.LIST_URANIAN for k in vt)
    for k, v in vt.items():
        d = abs(((v - vs[k] + 180.0) % 360.0) - 180.0)
        # 赤经两点正好相对(南北交)时两侧中点都对
        assert d < 1e-6 or (coord == 'ra' and abs(d - 180.0) < 1e-6), (k, v, vs[k])

    def contacts(res):
        return {(c['idA'], c['idB'], c['id'], c['aspect']) for c in res['contacts']
                if c['delta'] < 1.0 - 1e-6
                and frozenset((c['idA'], c['idB'])) != frozenset((const.NORTH_NODE, const.SOUTH_NODE))}
    ct, cs = contacts(rt), contacts(rs)
    assert ct and ct == cs


def test_unknown_coord_returns_none():
    pc, objs = _objects()
    assert coord_midpoints(objs, 'lon', 1.0, pc.chart.date.jd) is None


def test_sidereal_chart_tnp_longitudes_share_the_zero_point_with_planets():
    """恒星盘:8 颗虚星与行星减掉的是同一个岁差(此前虚星仍是回归黄经,同一张 90° 盘上整体偏一个岁差)。"""
    import swisseph
    pt, ot = _objects_in(0)
    ps, os_ = _objects_in(1)
    jd = ps.chart.date.jd
    lt = {o.id: o.lon for o in ot}
    ls = {o.id: o.lon for o in os_}
    sun_shift = (lt[const.SUN] - ls[const.SUN]) % 360.0
    assert 20.0 < sun_shift < 30.0
    seen = 0
    for uid in const.LIST_URANIAN:
        if uid in lt and uid in ls:
            seen += 1
            assert abs((lt[uid] - ls[uid]) % 360.0 - sun_shift) < 1e-4, (uid, lt[uid], ls[uid])
    assert seen == 8


def test_sidereal_chart_planet_equatorial_coords_are_true_equinox_of_date():
    """恒星盘行星的赤经赤纬 = 回归盘同值(本日真春分点),与四轴宫头同一个春分点;不再是平春分点值(差约 16″)。"""
    pt, ot = _objects_in(0)
    ps, os_ = _objects_in(1)
    et = {o.id: (o.ra, o.decl) for o in ot if getattr(o, 'ra', None) is not None}
    es = {o.id: (o.ra, o.decl) for o in os_ if getattr(o, 'ra', None) is not None}
    assert const.SUN in et and const.MOON in et
    for k, (ra, decl) in et.items():
        if k not in es:
            continue
        assert abs(((ra - es[k][0] + 180.0) % 360.0) - 180.0) < 1e-6 and abs(decl - es[k][1]) < 1e-6, (k, (ra, decl), es[k])
