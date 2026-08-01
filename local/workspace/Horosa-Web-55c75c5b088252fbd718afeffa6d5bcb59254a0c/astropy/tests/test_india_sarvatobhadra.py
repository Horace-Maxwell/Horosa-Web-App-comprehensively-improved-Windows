# -*- coding: utf-8 -*-
"""G7 · Sarvatobhadra Chakra 几何引擎(权威 §24.1)。

核心不变量:① 尺寸算术推论 4(N−2)=28 ⇒ N=9;② 环坐标双射;③ 五算子全为对合;
④ 反射像恒在环上;⑤ 🔴 降级契约:锚空 ⇒ vedhaEnabled=False 且 vedha 图/命中全空
(绝不输出假 Vedha);⑥ 28 宿名单 = 27 主表 + Abhijit 于 22 位,主表零改动。
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "flatlib-ctrad2"))

from astrostudy.india import sarvatobhadra as sbc  # noqa: E402


def test_grid_size_is_arithmetic_consequence():
    assert sbc.N == 9
    assert 4 * (sbc.N - 2) == 28
    assert sbc.DERIVATION == 'arithmetic_4x7'


def test_ring_bijection():
    cells = [sbc.ring_cell(i) for i in range(28)]
    assert len(set(cells)) == 28
    for r, c in cells:
        assert (r in (0, 8) or c in (0, 8))          # 全在边框
        assert (r, c) not in ((0, 0), (0, 8), (8, 0), (8, 8))   # 四隅空
    for i in range(28):
        assert sbc.ring_index(sbc.ring_cell(i)) == i  # 逆映射闭合
    assert sbc.ring_index((0, 0)) is None
    assert sbc.ring_index((4, 4)) is None


def test_ring_parametrization_spotchecks():
    assert sbc.ring_cell(0) == (0, 1)      # 上边最左非角格
    assert sbc.ring_cell(6) == (0, 7)
    assert sbc.ring_cell(7) == (1, 8)      # 右边
    assert sbc.ring_cell(14) == (8, 7)     # 下边(自右向左)
    assert sbc.ring_cell(21) == (7, 0)     # 左边(自下向上)
    assert sbc.ring_cell(27) == (1, 0)


def test_five_ops_are_involutions():
    """五算子全为对合(op∘op=恒等)—— 最强可测不变量,任一破即几何写错。"""
    for key, op, _label in sbc.VEDHA_OPS:
        for r in range(9):
            for c in range(9):
                assert op(op((r, c))) == (r, c), (key, r, c)


def test_sammukha_equals_ring_shift_14():
    """对冲算子在环坐标上 ≡ i→(i+14)%28(推导闭式,交叉验证几何)。"""
    for i in range(28):
        t = sbc.ring_index(sbc.op_sammukha(sbc.ring_cell(i)))
        assert t == (i + 14) % 28, i


def test_reflections_of_ring_stay_on_ring():
    for i in range(28):
        cell = sbc.ring_cell(i)
        for key, op, _label in sbc.VEDHA_OPS:
            assert sbc.ring_index(op(cell)) is not None, (key, i)


def test_vedha_targets_capped_and_symmetric():
    """伙伴 ≤5;且 Vedha 关系对称(j ∈ targets(i) ⇔ i ∈ targets(j) —— 全对合之像)。"""
    for i in range(28):
        ts = {t for _k, t in sbc.vedha_ring_targets(i)}
        assert len(ts) <= 5
        assert i not in ts
        for j in ts:
            back = {t for _k, t in sbc.vedha_ring_targets(j)}
            assert i in back, (i, j)


def test_nak28_list_shape():
    naks = sbc.nak28_list()
    assert len(naks) == 28
    assert naks[21]['index28'] == 22 and naks[21]['sanskrit'] == 'Abhijit'
    # 27 宿全在且相对序不变(Abhijit 只插不改)
    others = [n for n in naks if not n['isAbhijit']]
    assert len(others) == 27
    assert [n['index27'] for n in others] == list(range(1, 28))


def test_degraded_mode_no_fake_vedha():
    """🔴 降级契约:锚未录入 ⇒ 占位布局显式打标 + Vedha 全禁。"""
    assert sbc.SBC_RING_ANCHOR_NAK28 is None            # 现状:待录入
    res = sbc.compute_sbc(natal_refs={'moon': 5}, transit_nak28={'Saturn': 19})
    assert res['layout']['source'] == 'placeholder_sequential'
    assert '非经典格位' in res['layout']['note']
    assert res['vedhaEnabled'] is False
    assert res['vedhaGraph'] == [] and res['hits'] == []
    assert len(res['layout']['rows']) == 28


def test_classical_mode_activates_with_anchor(monkeypatch):
    """单点录锚即生效(结构自检;录真锚后此测试仍必过)。"""
    monkeypatch.setattr(sbc, 'SBC_RING_ANCHOR_NAK28',
                        {'nak28': 1, 'ringIndex': 0, 'direction': 'cw'})
    res = sbc.compute_sbc(natal_refs={'moon': 5},
                          transit_nak28={'Saturn': None})
    assert res['vedhaEnabled'] is True
    assert res['layout']['source'] == 'classical'
    assert len(res['vedhaGraph']) == 28
    for entry in res['vedhaGraph']:
        assert 1 <= entry['nak28'] <= 28
        assert len(entry['targets']) <= 5
