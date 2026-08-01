# -*- coding: utf-8 -*-
"""主限法 pd 表行形状守卫(WP-4 防回潮哨兵,上轮欠账)。

/predict/pd 表行 5 字段 [arc, prom_id, sig_id, cat, date] 是前端 2D 表/3D 球/AI 快照
共同的 join 契约 —— 任何方法/方向/虚点开关组合下行宽或类型漂移都会静默炸下游。
遍历全部方位法 × direct / converse × 映点/界 开关,断言:
  len(row)==5 且类型序 [float, str, str, str, str]。
一张样盘秒级;preflight 实跑本文件。
🔴 铁律:本文件只读表行形状,不锁具体数值 —— 540 golden byte-perfect 由
test_pd_alcabitius_byteperfect.py 看守,两者互不替代。
"""
import pytest

from astrostudy import perchart, perpredict
from astrostudy.perpredict import _PD_METHOD_REGISTRY


BASE = {
    'date': '1990/03/15', 'time': '12:30:00', 'zone': '+08:00',
    'lat': '39N54', 'lon': '116E28', 'ad': 1, 'hsys': 'PLACIDUS',
    'pdTimeKey': 'Ptolemy', 'pdYears': 100,
    'pdtype': 0, 'pdaspects': [0, 60, 90, 120, 180],
}

ALL_METHODS = sorted(_PD_METHOD_REGISTRY.keys())


def _rows(**over):
    cd = dict(BASE)
    cd.update(over)
    pc = perchart.PerChart(cd)
    pp = perpredict.PerPredict(pc)
    return pp.getPrimaryDirection()


def _assert_shape(rows, ctx):
    assert rows, '空表: %s' % (ctx,)
    for i, row in enumerate(rows):
        assert len(row) == 5, '行宽漂移 %s row[%d] len=%d: %r' % (ctx, i, len(row), row)
        assert isinstance(row[0], float), '%s row[%d][0] 非 float: %r' % (ctx, i, type(row[0]))
        for k in (1, 2, 3, 4):
            assert isinstance(row[k], str), '%s row[%d][%d] 非 str: %r' % (ctx, i, k, type(row[k]))


@pytest.mark.parametrize('method', ALL_METHODS)
def test_row_shape_all_methods_direct(method):
    """全部方位法 direct:5 字段 float+4str。"""
    _assert_shape(_rows(pdMethod=method, pdDirect=1, pdConverse=0), 'method=%s direct' % method)


@pytest.mark.parametrize('method', ALL_METHODS)
def test_row_shape_all_methods_converse(method):
    """全部方位法 converse。"""
    _assert_shape(_rows(pdMethod=method, pdDirect=0, pdConverse=1), 'method=%s converse' % method)


@pytest.mark.parametrize('flag', ['pdAntiscia', 'pdTerms'])
def test_row_shape_virtual_point_flags(flag):
    """映点/界 开关下行形状不漂(默认方法)。"""
    _assert_shape(_rows(pdMethod='core_alchabitius', **{flag: 1}), 'flag=%s' % flag)


@pytest.mark.parametrize('pdtype', [1, 2, 3])
def test_row_shape_pdtypes(pdtype):
    """In-Mundo/界推运 表行同契约(5 字段;cat 分别 M/T)。"""
    rows = _rows(pdMethod='core_alchabitius', pdtype=pdtype)
    _assert_shape(rows, 'pdtype=%d' % pdtype)
    want_cat = 'M' if pdtype == 1 else 'T'
    assert all(r[3] == want_cat for r in rows)
