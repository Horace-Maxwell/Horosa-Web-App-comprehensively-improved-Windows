# -*- coding: utf-8 -*-
"""并列稳定(astrostudy/stable_order.py)与用到它的几处:数学上相等的两个量在不同机器上末位各差各的,
排序的先后、恰在边界上的归属不该由末位决定。这里用「给输入加一点末位噪声」来模拟换一台机器:结果必须不变。"""
import math

import pytest

from astrostudy import stable_order as so
from astrostudy.stable_order import tie_sorted, same_value, floor_stable, snap_integer, snap_mod, lte_stable, lt_stable

NOISE = (0.0, 3e-14, -3e-14, 7e-13, -7e-13, 2e-11, -2e-11)


# ------------------------------------------------------------------ 工具本身
def test_tied_values_keep_their_original_order_whatever_the_last_bits_say():
    for d1 in NOISE:
        for d2 in NOISE:
            rows = [('a', 2.0), ('b', 1.5 + d1), ('c', 1.5 + d2), ('d', 0.25)]
            assert [r[0] for r in tie_sorted(rows, lambda r: r[1])] == ['d', 'b', 'c', 'a']


def test_values_that_really_differ_are_ordered_by_value():
    rows = [('a', 1.5 + 2e-9), ('b', 1.5), ('c', 1.5 - 2e-9)]
    assert [r[0] for r in tie_sorted(rows, lambda r: r[1])] == ['c', 'b', 'a']
    assert [r[0] for r in tie_sorted(rows, {'of': lambda r: r[1], 'desc': True})] == ['a', 'b', 'c']


def test_later_keys_break_ties_and_original_order_breaks_the_rest():
    rows = [{'v': 1.0, 'n': 'z'}, {'v': 1.0 + 1e-13, 'n': 'a'}, {'v': 1.0 - 1e-13, 'n': 'a'}, {'v': 0.5, 'n': 'q'}]
    out = tie_sorted(rows, lambda r: r['v'], lambda r: r['n'])
    assert [(r['n'], rows.index(r)) for r in out] == [('q', 3), ('a', 1), ('a', 2), ('z', 0)]


def test_descending_keeps_original_order_among_ties():
    rows = [('a', 5.0), ('b', 9.0 - 1e-13), ('c', 9.0), ('d', 9.0 + 1e-13), ('e', 1.0)]
    assert [r[0] for r in tie_sorted(rows, {'of': lambda r: r[1], 'desc': True})] == ['b', 'c', 'd', 'a', 'e']


def test_a_chain_of_close_values_is_one_group():
    # 相邻两项差不到容差就连成一串(哪怕首尾差超过容差):一串里按原先后
    rows = [('c', 1.0 + 1.6e-9), ('b', 1.0 + 0.8e-9), ('a', 1.0)]
    assert [r[0] for r in tie_sorted(rows, lambda r: r[1])] == ['c', 'b', 'a']


def test_non_numeric_keys_and_mixed_levels():
    rows = [(2, 'x', 0.3), (1, 'y', 0.7), (1, 'x', 0.7 + 1e-12), (1, 'x', 0.1)]
    assert tie_sorted(rows, lambda r: r[0], lambda r: r[2], lambda r: r[1]) == [(1, 'x', 0.1), (1, 'x', 0.7 + 1e-12), (1, 'y', 0.7), (2, 'x', 0.3)]
    assert tie_sorted([], lambda r: r) == []
    assert tie_sorted([3, 1, 2], lambda r: r) == [1, 2, 3]
    src = [3, 1, 2]
    tie_sorted(src, lambda r: r)
    assert src == [3, 1, 2]            # 不动原列表


def test_same_value_and_threshold_helpers():
    assert same_value(1.0, 1.0 + 5e-10) and not same_value(1.0, 1.0 + 5e-9)
    assert same_value('a', 'a') and not same_value('a', 'b')
    assert same_value(float('nan'), float('nan')) and not same_value(float('nan'), 1.0)
    assert lte_stable(1.0 + 1e-12, 1.0) and lte_stable(0.5, 1.0) and not lte_stable(1.0 + 1e-8, 1.0)
    assert not lt_stable(1.0 - 1e-12, 1.0) and lt_stable(0.5, 1.0)


def test_boundary_helpers():
    assert floor_stable(29.999999999999996) == 30 and floor_stable(30.000000000000004) == 30
    assert floor_stable(29.9999) == 29 and floor_stable(-0.5) == -1 and floor_stable(-1e-12) == 0
    assert snap_integer(179.99999999999997) == 180.0 and snap_integer(180.0000001) == 180.0000001
    assert snap_mod(359.99999999999994, 360.0) == 0.0 and snap_mod(1e-12, 360.0) == 0.0
    assert snap_mod(-1e-12, 360.0) == 0.0 and snap_mod(12.5, 360.0) == 12.5 and snap_mod(372.5, 360.0) == 12.5
    assert so.TIE_EPS == 1e-9


# ------------------------------------------------------------------ 用到它的几处:加末位噪声,结果不变
def test_midpoint_of_two_opposite_points_is_the_smaller_longitude():
    from astrostudy.germany.midpoint import near_midpoint
    for node in (14.78, 104.78, 200.0, 359.5):
        want = min((node + 90.0) % 360, (node + 270.0) % 360)
        for d in NOISE:
            south = (node + 180.0) % 360 + d
            assert abs(near_midpoint(node, south) - want) < 1e-9, (node, d)
            assert abs(near_midpoint(south, node) - want) < 1e-9, (node, d)
    assert near_midpoint(10.0, 50.0) == 30.0                     # 寻常的一对:短弧上的那个,照旧
    assert near_midpoint(350.0, 30.0) == 10.0
    assert near_midpoint(10.0, 200.0) == 285.0


def test_house_frame_placement_of_a_point_sitting_on_a_cusp():
    from astrostudy.germany.houseframes import _house_of
    cusps = [(100.0 + 30.0 * i) % 360 for i in range(12)]
    for d in NOISE:
        assert _house_of(100.0 + d, cusps) == 1                  # 恰在第 1 宫头
        assert _house_of((100.0 + 270.0) % 360 + d, cusps) == 10  # 恰在第 10 宫头(月亮局的月亮)
        assert _house_of(70.0 + d, cusps) == 12                  # 恰在第 12 宫头
    assert _house_of(99.9, cusps) == 12 and _house_of(100.1, cusps) == 1 and _house_of(129.999, cusps) == 1


def test_profected_ascendant_back_on_the_natal_ascendant_is_in_house_one():
    from astrostudy.directed_figures import house_of
    cusps = [72.55258554651198, 95.1, 118.4, 144.9, 176.2, 212.8, 252.55258554651198, 275.1, 298.4, 324.9, 356.2, 32.8]
    for d in NOISE:
        assert house_of(cusps[0] + d, cusps) == 1
        assert house_of(cusps[6] + d, cusps) == 7
    assert house_of(60.0, cusps) == 12 and house_of(80.0, cusps) == 1


def test_midheaven_mundane_hour_is_zero_not_twenty_four():
    # 推运图:天顶的本命时位数学上正是 0 时(≡ 24 时);240 例对拍里有 6 例在两台机器上一个写 0.000、一个写 24.000
    from astrostudy import directed_figures as df
    for date, time_, lat, lon, zone in (('1974/02/19', '22:48:00', 40.1396, -126.8699, '-08:00'), ('1990/01/01', '12:00:00', 39.9, 116.4, '+08:00'),
                                        ('1963/03/21', '03:40:00', 51.5, -0.12, '+00:00'), ('2004/11/02', '18:05:00', -33.87, 151.2, '+10:00')):
        frame = df._natal_from_request({'date': date, 'time': time_, 'zone': zone, 'lat': '0n00', 'lon': '0e00', 'gpsLat': lat, 'gpsLon': lon,
                                        'hsys': 0, 'tradition': False, 'predictive': False, 'clientNowMs': 1906516800000, 'clientNowOffsetMin': 480})
        rows, _movers = df.bezza_point_rows(frame['points'], frame['armc'], frame['phi'], frame['epsMean'], 0.0)
        mc = [r for r in rows if r['id'] == 'MC'][0]
        assert min(mc['hp0'], 24.0 - mc['hp0']) < 1e-4, (date, repr(mc['hp0']))       # 天顶就在 0 时上(差在黄赤交角的取法,万分之一时以内)
        assert all(0.0 <= r['hp0'] < 24.0 and 0.0 <= r['hp1'] < 24.0 for r in rows)
    # 恰在 0 / 24 上(差不到十亿分之一时)的一律写成 0:两台机器不会一个 0.000 一个 24.000
    for d in NOISE:
        assert snap_mod(24.0 + d, 24.0) == 0.0 and snap_mod(d, 24.0) == 0.0


def test_mundane_aspect_pairs_with_equal_orbs_keep_generation_order():
    # 北交 / 南交成对的相位容许度数学上相等:加噪声后先后不变
    for d in NOISE:
        pairs = [{'a': '土', 'b': '南交', 'orb': 2.03 + d}, {'a': '土', 'b': '北交', 'orb': 2.03 - d}, {'a': '火', 'b': '上升', 'orb': 0.95}]
        out = tie_sorted(pairs, lambda row: row['orb'])
        assert [(p['a'], p['b']) for p in out] == [('火', '上升'), ('土', '南交'), ('土', '北交')]


def test_primary_direction_rows_with_equal_arcs_have_a_fixed_order():
    from astrostudy.pd_engine import sort_pd_rows
    base = [[96.37994773854382, 'N_North Node_180', 'N_Pars Fortuna_0', 'Z'], [-96.37994773854385, 'N_Pars Fortuna_180', 'N_North Node_0', 'Z'],
            [12.5, 'N_Sun_0', 'N_Asc_0', 'Z'], [-12.5, 'N_Moon_0', 'N_Asc_0', 'Z'], [12.5, 'N_Mars_0', 'N_Asc_0', 'Z']]
    want = None
    for d in NOISE:
        for order in (base, list(reversed(base))):
            rows = [list(r) for r in order]
            rows[0 if order is base else -1][0] += d            # 末位噪声加在那一对并列的弧上
            sort_pd_rows(rows)
            got = [(r[1], r[2]) for r in rows]
            want = want or got
            assert got == want, (d, got)
    # 并列的:负弧在前(按弧本身),再按迫星名
    assert want == [('N_Moon_0', 'N_Asc_0'), ('N_Mars_0', 'N_Asc_0'), ('N_Sun_0', 'N_Asc_0'),
                    ('N_Pars Fortuna_180', 'N_North Node_0'), ('N_North Node_180', 'N_Pars Fortuna_0')]


def test_age_point_returning_to_the_ascendant_at_the_end_of_the_cycle_is_always_reported():
    from astrostudy.agepoint import crossings_of_targets
    kc = [(72.5 + 30.0 * i) % 360 for i in range(12)]
    for d in NOISE:
        targets = [{'aspectTo': 'Asc', 'aspect': 0, 'side': '', 'lon': 72.5 + d}]
        ages = [c['age'] for c in crossings_of_targets(kc, targets, 72)]
        assert ages == [72.0], (d, ages)                          # 0 岁那次不算事件;一周后回到上升的那次恰 72 岁,必有
        assert [c['age'] for c in crossings_of_targets(kc, targets, 144)] == [72.0, 144.0]


def test_draconic_south_node_sits_exactly_on_zero_libra():
    from astrostudy.thirteenthchart import DraconicChart

    class _Pt:
        def __init__(self, lon):
            self.lon = lon

        def relocate(self, lon):
            self.lon = lon

    class _Chart:
        def getObject(self, _id):
            return _Pt(14.787654321)

    class _Per:
        chart = _Chart()

    dc = DraconicChart(_Per())
    for node_lon in (14.787654321, 233.123456789, 359.99, 0.3):
        dc.nodeLon = node_lon
        for d in NOISE[:5]:
            south = _Pt((node_lon + 180.0) % 360 + d)
            assert dc.draconicObject(south) == 180.0, (node_lon, d)
            north = _Pt(node_lon + d)
            assert dc.draconicObject(north) == 0.0, (node_lon, d)
        assert abs(dc.draconicObject(_Pt((node_lon + 33.25) % 360)) - 33.25) < 1e-9


def test_mula_dasha_order_does_not_depend_on_the_last_bits_of_rahu_and_ketu():
    # 罗 / 计正对:宫内度数相同,同组同档时按固定次序(罗在前)
    DIG = {'neutral': 2}
    for d in NOISE:
        ents = [{'planetCN': '火', 'dignity': 'neutral', 'signlon': 3.0, 'house': 7},
                {'planetCN': '罗', 'dignity': 'neutral', 'signlon': 14.78 + d, 'house': 10},
                {'planetCN': '计', 'dignity': 'neutral', 'signlon': 14.78 - d, 'house': 4}]
        out = tie_sorted(ents, lambda en: -DIG.get(en['dignity'], 2), {'of': lambda en: en['signlon'], 'desc': True})
        assert [e['planetCN'] for e in out] == ['罗', '计', '火']


@pytest.mark.parametrize('path', ['astrostudy/germany/midpoint.py', 'astrostudy/germany/houseframes.py', 'astrostudy/chart_details_more.py',
                                  'astrostudy/directed_figures.py', 'astrostudy/pd_engine.py', 'astrostudy/india/jyotish_parts/dashas.py',
                                  'astrostudy/thirteenthchart.py'])
def test_the_fixed_sites_keep_using_the_shared_helper(path):
    from pathlib import Path
    src = (Path(__file__).resolve().parents[1] / path).read_text(encoding='utf-8')
    assert 'from astrostudy.stable_order import' in src, path
