# -*- coding: utf-8 -*-
"""主排盘两处等价提速:恒星批快克隆(HOROSA_STAR_LRU_FASTCLONE)· JSON 快径迭代预扫(HOROSA_FAST_JSON_ITER_SCAN)。

① 恒星批 LRU 原存入 / 命中都整批 deepcopy;恒星对象属性皆不可变值 → 快克隆(新容器 + 逐颗浅拷贝,可变属性仍深拷贝)
  与 deepcopy 结构 / 隔离等价。判据:各类恒星批与 deepcopy 同类型、同键序、同属性;改副本不影响原批与缓存。
② 预扫由递归改迭代,逐节点判据不变。判据:随机结构 / 深度边界 / 环 / 真实排盘响应两实现判定逐一相同。
"""
import collections
import copy
import datetime
import os
import random
import sys

_ASTRO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _ASTRO not in sys.path:
    sys.path.insert(0, _ASTRO)

from flatlib import const  # noqa: E402
from flatlib.chart import Chart  # noqa: E402
from flatlib.datetime import Datetime  # noqa: E402
from flatlib.ephem import ephem as E  # noqa: E402
from flatlib.geopos import GeoPos  # noqa: E402

from websrv import fastjson as FJ  # noqa: E402


def _charts():
    for date, lat, lon in (('1990/05/18', '31n38', '118e27'), ('2024/12/21', '33s52', '151e12'), ('1066/10/14', '50n55', '0e29')):
        yield Chart(Datetime(date, '10:00', '+08:00'), GeoPos(lat, lon), const.TROPICAL, hsys=const.HOUSES_WHOLE_SIGN)


def test_star_clone_matches_deepcopy_and_isolates(monkeypatch):
    monkeypatch.setattr(E, '_STAR_LRU_FASTCLONE', True)
    n = 0
    for c in _charts():
        for lst in (c.getFixedStars(), c.getFixedStarBeiDou(), c.getFixedStarBeiJi(), c.getFixedStartsSu28()):
            a = copy.deepcopy(lst)
            b = E._cloneStarList(lst)
            assert type(a) is type(b)
            assert list(a.content) == list(b.content)
            for k in a.content:
                assert type(a.content[k]) is type(b.content[k])
                assert a.content[k].__dict__ == b.content[k].__dict__
                assert b.content[k] is not lst.content[k]
            k0 = next(iter(b.content))
            lon0 = lst.content[k0].lon
            b.content[k0].lon = lon0 + 180.0
            b.content.pop(k0)
            assert lst.content[k0].lon == lon0 and k0 in lst.content
            n += 1
    assert n == 12


def test_star_clone_deepcopies_mutable_attributes_and_keeps_sharing(monkeypatch):
    monkeypatch.setattr(E, '_STAR_LRU_FASTCLONE', True)
    lst = next(_charts()).getFixedStarBeiDou()
    k0, k1 = list(lst.content)[:2]
    lst.content[k0].extra = [1, 2]                  # 人为加一个可变属性
    lst.content['alias'] = lst.content[k1]          # 同一对象两处引用
    b = E._cloneStarList(lst)
    b.content[k0].extra.append(3)
    assert lst.content[k0].extra == [1, 2]          # 可变属性被深拷贝
    assert b.content['alias'] is b.content[k1]      # 共享关系与 deepcopy 一致
    assert b.content[k1] is not lst.content[k1]


def test_star_lru_hits_stay_pristine():
    c1 = next(_charts())
    first = c1.getFixedStars()
    k0 = next(iter(first.content))
    lon0 = first.content[k0].lon
    first.content[k0].relocate((lon0 + 180.0) % 360)   # 消费者就地改自己的副本(南半球 +180° 同形)
    again = next(_charts()).getFixedStars()             # 同键命中 LRU
    assert again.content[k0].lon == lon0


def test_switch_off_uses_deepcopy(monkeypatch):
    monkeypatch.setattr(E, '_STAR_LRU_FASTCLONE', False)
    calls = []
    real = copy.deepcopy
    monkeypatch.setattr(E.copy, 'deepcopy', lambda x, *a: calls.append(1) or real(x, *a))
    E._cloneStarList(next(_charts()).getFixedStarBeiJi())
    assert calls


class _S(str):
    pass


class _I(int):
    pass


class _F(float):
    pass


class _Stranger(object):
    pass


def _random_tree(rnd, depth, maxd):
    def leaf():
        return rnd.choice([
            'x', '中', 0, -5, 2 ** 70, 1.5, True, None, _S('s'), _I(3), _F(2.5), b'b', {1, 2},
            datetime.datetime(2026, 1, 1), _Stranger(), Datetime('2024/01/01', '10:00', '+08:00'), GeoPos('31n38', '118e27'),
        ])

    def key():
        return rnd.choice(['a', 'k%d' % rnd.randint(0, 5), 1, 2.5, None, True, (1, 2)])
    if depth >= maxd or rnd.random() < 0.25:
        return leaf()
    r = rnd.random()
    n = rnd.randint(0, 4)
    if r < 0.4:
        return {key(): _random_tree(rnd, depth + 1, maxd) for _ in range(n)}
    if r < 0.7:
        return [_random_tree(rnd, depth + 1, maxd) for _ in range(n)]
    if r < 0.8:
        return tuple(_random_tree(rnd, depth + 1, maxd) for _ in range(n))
    if r < 0.9:
        return collections.OrderedDict((key(), _random_tree(rnd, depth + 1, maxd)) for _ in range(n))
    return leaf()


def _chain(rnd, depth, tail):
    o = tail
    for _ in range(depth):
        o = rnd.choice(([o], {'k': o}, (o,)))
    return o


def test_iterative_scan_matches_recursive():
    rnd = random.Random(20260927)
    for _ in range(4000):
        obj = _random_tree(rnd, 0, rnd.randint(1, 8))
        assert FJ._fast_shape_ok_iter(obj) == FJ._fast_shape_ok_recursive(obj)
    for d in (198, 199, 200, 201, 202):
        for tail in ('x', None, [1], {'a': 1}, GeoPos('31n38', '118e27')):
            obj = _chain(rnd, d, tail)
            assert FJ._fast_shape_ok_iter(obj) == FJ._fast_shape_ok_recursive(obj), (d, tail)
    cyc = [1]
    cyc.append(cyc)
    assert FJ._fast_shape_ok_iter(cyc) is False and FJ._fast_shape_ok_recursive(cyc) is False


def test_scan_dispatch_follows_switch(monkeypatch):
    obj = {'a': [1, 2, {'b': 'c'}]}
    monkeypatch.setattr(FJ, '_ITER_SCAN_ON', True)
    assert FJ._fast_shape_ok(obj) is True
    monkeypatch.setattr(FJ, '_ITER_SCAN_ON', False)
    assert FJ._fast_shape_ok(obj) is True
    assert FJ._fast_shape_ok({True: 1}) is False
