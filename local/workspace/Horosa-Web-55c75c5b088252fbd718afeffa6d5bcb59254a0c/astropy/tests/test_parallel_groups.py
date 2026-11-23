"""赤纬平行表的成组口径:每组 = 同号、两两赤纬差都不超过 1° 的极大集合。

此前链式并组:甲乙差 ≤ 1°、乙丙差 ≤ 1° 就三者同组(甲丙可差近 2°);同一对星既单列一组又并在大组里;
结果还随点的遍历顺序变。判据:① 组内同号且跨度 ≤ 1°;② 组与组互不为子集;③ 同号且差 ≤ 1° 的每一对
至少同在一组,组里也没有别的对;④ 打乱点的遍历顺序结果不变;⑤ 复现盘钉值。反平行表不受影响。
"""
import copy
import os
import random
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from flatlib import const  # noqa: E402
from astrostudy.perchart import PerChart, push_classical_request, pop_classical_request  # noqa: E402
from astrostudy.perchart_parts.aspects import parallelGroups  # noqa: E402

CHARTS = {
    'seattle75': {"date": "1975/02/10", "time": "21:15:00", "zone": "-08:00", "lat": "47n36", "lon": "122w20"},
    'tromso90': {"date": "1990/06/21", "time": "03:30:00", "zone": "+02:00", "lat": "69n39", "lon": "18e57"},
    'sydney01': {"date": "2001/09/11", "time": "05:50:00", "zone": "+10:00", "lat": "33s52", "lon": "151e12"},
    'shanghai90': {"date": "1990/01/01", "time": "08:00:00", "zone": "+08:00", "lat": "31n14", "lon": "121e28"},
    'quito83': {"date": "1983/07/04", "time": "13:07:00", "zone": "-05:00", "lat": "00s13", "lon": "78w31"},
    'capetown55': {"date": "1955/03/15", "time": "23:40:00", "zone": "+02:00", "lat": "33s55", "lon": "18e25"},
}


def _parallel(name, zodiacal, hsys=0):
    d = dict(CHARTS[name], hsys=hsys, zodiacal=zodiacal, tradition=False, predictive=False)
    token = push_classical_request(d)
    try:
        pc = PerChart(copy.deepcopy(d))
        par = pc.getParallel()
        decl = {}
        for oid in const.LIST_ALL_POINTS:
            try:
                decl[oid] = pc.chart.get(oid).decl
            except Exception:
                continue
        return par, decl
    finally:
        pop_classical_request(token)


def test_groups_are_maximal_windows():
    assert parallelGroups([('a', 10.0), ('b', 10.8), ('c', 11.6)]) == [['a', 'b'], ['b', 'c']]
    # 南北分开;赤纬为 0 不入组;1° 边界含在内;同值不重复成组
    assert parallelGroups([('n', 0.5), ('s', -0.5), ('z', 0.0)]) == []
    assert parallelGroups([('a', -3.0), ('b', -4.0)]) == [['a', 'b']]
    assert parallelGroups([('a', 5.0), ('b', 5.0), ('c', 5.9)]) == [['a', 'b', 'c']]
    assert parallelGroups([('a', 1.0), ('b', 1.6), ('c', 2.2), ('d', 2.5)]) == [['a', 'b'], ['b', 'c', 'd']]


@pytest.mark.parametrize('name', sorted(CHARTS))
@pytest.mark.parametrize('zodiacal', [0, 1])
def test_parallel_groups_are_true_cliques(name, zodiacal):
    par, decl = _parallel(name, zodiacal)
    groups = [set(g) for g in par['parallel']]
    for g in groups:
        ds = [decl[o] for o in g]
        assert len(g) >= 2
        assert all(x > 0 for x in ds) or all(x < 0 for x in ds), (name, g, ds)
        assert max(ds) - min(ds) <= 1.0 + 1e-9, (name, sorted(g), ds)
    for i, a in enumerate(groups):
        for j, b in enumerate(groups):
            assert i == j or not a <= b, ('子集重复组', name, sorted(a), sorted(b))
    together = {frozenset((a, b)) for g in groups for a in g for b in g if a != b}
    want = {frozenset((a, b)) for a, da in decl.items() for b, db in decl.items()
            if a != b and da * db > 0 and abs(da - db) <= 1.0}
    assert together == want, (name, sorted(map(sorted, want - together)), sorted(map(sorted, together - want)))


@pytest.mark.parametrize('name', ['seattle75', 'tromso90', 'sydney01'])
def test_parallel_groups_do_not_depend_on_point_order(monkeypatch, name):
    base, _ = _parallel(name, 0)
    for seed in (1, 2, 3):
        order = list(const.LIST_ALL_POINTS)
        random.Random(seed).shuffle(order)
        monkeypatch.setattr(const, 'LIST_ALL_POINTS', order)
        got, _ = _parallel(name, 0)
        assert got['parallel'] == base['parallel'], (name, seed)
        assert got['contraParallel'] == base['contraParallel'], (name, seed)


def test_chained_example_is_split():
    """复现盘:金星 −7.233 / 黑月 −6.452 / 月亮远地点 −5.691 —— 此前并成一组(跨度 1.542°),现在拆成两组,
    金星与月亮远地点不在同一组。"""
    par, decl = _parallel('seattle75', 0)
    groups = [set(g) for g in par['parallel']]
    assert {const.VENUS, const.DARKMOON} in groups
    assert {const.DARKMOON, 'Intp_Apog'} in groups
    assert not any({const.VENUS, 'Intp_Apog'} <= g for g in groups)
