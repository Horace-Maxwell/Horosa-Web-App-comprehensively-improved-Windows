# -*- coding: utf-8 -*-
"""世运盘 WP-4 Barbault 行星周期指数(§9.3 Indice Cyclique)golden。

慢星两两角距和成「聚散」曲线:低(→0,聚集)=危机/战争、高(→1800,四散)=扩张繁荣。
文档校验:史上 1914、1939–40 等极小与两次世界大战吻合;1982 三王星聚于天秤亦极小。
本测断「公式正确 + 十年级历史极小吻合」(不锁单一年份——随慢星子集/约定微移,故做成可配选项)。
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'flatlib-ctrad2'))

from astrostudy.astroextra import compute_barbault   # noqa: E402


def _seg_low(points, lo, hi):
    seg = [p for p in points if lo <= p['year'] <= hi]
    return min(p['index'] for p in seg)


def test_maxindex_and_range_five_planets():
    r = compute_barbault({'startYear': 1900, 'endYear': 1960, 'stepMonths': 1})
    assert r['planets'] == ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']
    assert r['maxIndex'] == 1800.0          # C(5,2)=10 对 × 180°
    vals = [p['index'] for p in r['points']]
    assert vals, '应有数据点'
    assert all(0.0 <= v <= 1800.0 for v in vals), '指数须落 [0,1800]'
    assert len(r['points']) > 700           # 1900-1960 逐月 ~720 点


def test_wwii_is_trough_five_planets():
    """全 5 星:1900-1960 全局极小落在二战窗口(1939-1945),与文档极小吻合。"""
    r = compute_barbault({'startYear': 1900, 'endYear': 1960, 'stepMonths': 1})
    gmin = min(r['points'], key=lambda p: p['index'])
    assert 1939 <= gmin['year'] <= 1945, '全局极小应在二战年间,got %s' % gmin['year']
    # 二战低点 < 平时(1920年代)
    assert _seg_low(r['points'], 1939, 1944) < _seg_low(r['points'], 1922, 1928)


def test_wwi_local_trough_five_planets():
    """全 5 星:一战十年(1914 起降→1916-1920 谷)为局部极小,显著低于战前/战后峰。
       文档「1914 极小」= 战争爆发=指数起跌点;实际谷落战中,两侧皆高。"""
    r = compute_barbault({'startYear': 1905, 'endYear': 1928, 'stepMonths': 12})
    wwi_low = _seg_low(r['points'], 1916, 1920)
    assert wwi_low < _seg_low(r['points'], 1910, 1913), '一战谷应低于战前峰'
    assert wwi_low < _seg_low(r['points'], 1924, 1927), '一战谷应低于战后峰'


def test_outer_three_variant_smooth_minima():
    """仅外三星(♅♆♇,可配变体):3 对、最平滑,三大危机十年各现历史极小。"""
    r = compute_barbault({'startYear': 1900, 'endYear': 1990, 'stepMonths': 12,
                          'planets': ['Uranus', 'Neptune', 'Pluto']})
    assert r['planets'] == ['Uranus', 'Neptune', 'Pluto']
    assert r['maxIndex'] == 540.0           # C(3,2)=3 对 × 180°
    # 外三星周期最长,谷落 WWII / 1980-90 三王聚(1914 谷由内行星加入驱动,见全5星测)
    base = _seg_low(r['points'], 1923, 1930)        # 平时基线(咆哮的二十年代)
    assert _seg_low(r['points'], 1937, 1945) < base, 'WWII 十年应低于平时'
    assert _seg_low(r['points'], 1978, 1990) < base, '1980 年代(1982/1989 三王聚)应低于平时'


def test_configurable_set_and_fallback():
    # 非法/不足两星 → 回落默认 5 星
    assert compute_barbault({'planets': []})['planets'] == \
        ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']
    assert compute_barbault({'planets': ['Mars']})['planets'] == \
        ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']
    # 两星子集 → C(2,2)=1 对,maxIndex 180
    r2 = compute_barbault({'planets': ['Neptune', 'Pluto'], 'startYear': 2000, 'endYear': 2001})
    assert r2['maxIndex'] == 180.0
    assert r2['planets'] == ['Neptune', 'Pluto']


def test_extrema_and_params_echo():
    r = compute_barbault({'startYear': 1980, 'endYear': 1990, 'stepMonths': 1})
    assert r['startYear'] == 1980 and r['endYear'] == 1990 and r['stepMonths'] == 1
    assert r['center'] == 'geo'
    assert isinstance(r['extrema'], list) and r['extrema']
    for e in r['extrema']:
        assert e['kind'] in ('min', 'max')
        assert 0.0 <= e['index'] <= 1800.0
    # 范围上限保护:>300 年自动收口
    big = compute_barbault({'startYear': 1000, 'endYear': 2000})
    assert big['endYear'] - big['startYear'] <= 300


def test_barbault_harmonic_folds_multiplied_separations():
    import pytest
    from astrostudy.astroextra_parts.cycles import compute_barbault
    base = compute_barbault({'startYear': 2000, 'endYear': 2000, 'stepMonths': 12, 'planets': ['Jupiter', 'Saturn']})
    two = compute_barbault({'startYear': 2000, 'endYear': 2000, 'stepMonths': 12, 'planets': ['Jupiter', 'Saturn'], 'harm': 2})
    assert base['harm'] == 1 and two['harm'] == 2
    d = base['points'][0]['index']
    expected = (2 * d) % 360.0
    expected = 360.0 - expected if expected > 180.0 else expected
    assert two['points'][0]['index'] == pytest.approx(expected, abs=0.02)
    assert compute_barbault({'startYear': 2000, 'endYear': 2000, 'harm': 99})['harm'] == 1
