# -*- coding: utf-8 -*-
"""天星择日搜索引擎·引擎层测试(WP-0:区间代数/求根/aspect 叶/入口防呆)。

金标锚:2024-04-08 日月合朔(新月/日全食) ≈ 18:21 UT —— 外部天文年历公值。
"""
import pytest

from astrostudy import election_scan as es


# ---------------------------------------------------------------------------
# 区间代数
# ---------------------------------------------------------------------------

def test_norm_intervals_merges_overlap_and_touching():
    ivs = [(3.0, 4.0), (1.0, 2.0), (2.0, 3.0), (10.0, 10.0), (5.0, 4.5)]
    assert es.norm_intervals(ivs) == [(1.0, 4.0)]


def test_iv_and_or_not_basic():
    a = [(0.0, 10.0)]
    b = [(5.0, 15.0)]
    assert es.iv_and(a, b) == [(5.0, 10.0)]
    assert es.iv_or(a, b) == [(0.0, 15.0)]
    assert es.iv_not(a, (0.0, 20.0)) == [(10.0, 20.0)]
    assert es.iv_not([], (0.0, 20.0)) == [(0.0, 20.0)]
    assert es.iv_and(a, []) == []


def test_iv_and_shared_endpoint_is_empty():
    # 半开区间 [0,5) ∩ [5,9) = 空
    assert es.iv_and([(0.0, 5.0)], [(5.0, 9.0)]) == []


def test_iv_xor_parity():
    # 三输入:[0,4) [2,6) [3,5) → 覆盖数 0-4 段:
    # [0,2)=1 ✓ [2,3)=2 ✗ [3,4)=3 ✓ [4,5)=2 ✗ [5,6)=1 ✓
    out = es.iv_xor([[(0.0, 4.0)], [(2.0, 6.0)], [(3.0, 5.0)]], (0.0, 10.0))
    assert out == [(0.0, 2.0), (3.0, 4.0), (5.0, 6.0)]


# ---------------------------------------------------------------------------
# 求根 / 翻转
# ---------------------------------------------------------------------------

def test_find_roots_time_linear():
    roots = es._find_roots_time(lambda x: x - 3.25, 0.0, 10.0, 0.5)
    assert len(roots) == 1
    assert abs(roots[0] - 3.25) < 1e-8


def test_find_roots_time_multiple_and_wrap_guard():
    # f 有两个真根;并注入一次 ±180 型 wrap 跳变(|Δf|≥90)不得误报
    def f(x):
        if 6.9 < x < 7.1:
            return 179.0 if x < 7.0 else -179.0
        return (x - 2.0) * (x - 5.0)

    roots = es._find_roots_time(f, 0.0, 6.5, 0.25)
    assert len(roots) == 2
    assert abs(roots[0] - 2.0) < 1e-6 and abs(roots[1] - 5.0) < 1e-6


def test_negative_intervals_parabola():
    out = es.negative_intervals(lambda x: (x - 2.0) * (x - 5.0), 0.0, 10.0, 0.5)
    assert len(out) == 1
    s, e = out[0]
    assert abs(s - 2.0) < 1e-6 and abs(e - 5.0) < 1e-6


def test_true_intervals_flip():
    out = es.true_intervals(lambda x: 3.0 <= x < 7.0, 0.0, 10.0, 0.9)
    assert len(out) == 1
    s, e = out[0]
    assert abs(s - 3.0) < 1e-6 and abs(e - 7.0) < 1e-6


# ---------------------------------------------------------------------------
# aspect 叶(真实星历金标)
# ---------------------------------------------------------------------------

BASE = {
    'startDate': '2024/04/07', 'startTime': '00:00:00',
    'endDate': '2024/04/10', 'endTime': '00:00:00',
    'zone': '+00:00', 'gpsLat': 39.9042, 'gpsLon': 116.4074,
    'hsys': 0, 'zodiacal': 0, 'ad': 1,
}


def _aspect_tree(**over):
    params = {'planetA': 'Moon', 'planetB': 'Sun', 'angle': 0, 'orb': 1.0,
              'motion': 'any', 'side': 'any', 'partile': 'off'}
    params.update(over)
    return {'type': 'aspect', 'params': params}


def test_new_moon_20240408_hit_window():
    """2024-04-08 合朔 ≈ 18:21 UT:orb 1° 命中区间应唯一且中心落在 exact ±30min 内。"""
    data = dict(BASE)
    data['conditions'] = _aspect_tree()
    data['precision'] = 'second'
    rsp = es.scan(data)
    assert 'err' not in rsp, rsp
    ivs = rsp['intervals']
    assert len(ivs) == 1
    mid = 0.5 * (ivs[0]['startJd'] + ivs[0]['endJd'])
    exact = es._jd_from('2024/04/08', '18:21:00', '+00:00')
    assert abs(mid - exact) < (30.0 / 1440.0), ivs[0]
    # 窗宽 ≈ 2°/相对速度(~12.2°/d) ≈ 3.9h,允差放到 2.5~6h
    assert 150.0 < ivs[0]['durationMin'] < 360.0


def test_applying_separating_split_at_exact():
    data = dict(BASE)
    data['precision'] = 'second'
    data['conditions'] = _aspect_tree(motion='applying')
    app = es.scan(data)['intervals']
    data['conditions'] = _aspect_tree(motion='separating')
    sep = es.scan(data)['intervals']
    assert len(app) == 1 and len(sep) == 1
    # 入相段终点 ≈ 出相段起点 ≈ exact
    assert abs(app[0]['endJd'] - sep[0]['startJd']) < (2.0 / 1440.0)
    exact = es._jd_from('2024/04/08', '18:21:00', '+00:00')
    assert abs(app[0]['endJd'] - exact) < (5.0 / 1440.0)
    # 两段拼起来 ≈ any 全区间
    data['conditions'] = _aspect_tree()
    full = es.scan(data)['intervals'][0]
    assert abs(app[0]['startJd'] - full['startJd']) < (2.0 / 1440.0)
    assert abs(sep[0]['endJd'] - full['endJd']) < (2.0 / 1440.0)


def test_partile_le1_narrows_window():
    data = dict(BASE)
    data['conditions'] = _aspect_tree(orb=5.0)
    wide = es.scan(data)['intervals'][0]['durationMin']
    data['conditions'] = _aspect_tree(orb=5.0, partile='le1')
    tight = es.scan(data)['intervals'][0]['durationMin']
    assert tight < wide * 0.45


def test_partile_same_degree_yields_subwindows():
    data = dict(BASE)
    data['conditions'] = _aspect_tree(orb=2.0, partile='same_degree')
    rsp = es.scan(data)
    assert 'err' not in rsp, rsp
    ivs = rsp['intervals']
    assert ivs, 'same_degree 应在合朔邻域产出至少一个同度子窗'
    # 每个子窗中点必满足「座内整度相同」
    for iv in ivs:
        mid = 0.5 * (iv['startJd'] + iv['endJd'])
        ctx = es.ScanContext(dict(BASE))
        m = ctx.moment(mid)
        assert int(m.lon('Moon') % 30.0) == int(m.lon('Sun') % 30.0)


def test_side_dexter_vs_sinister_first_trine_after_new_moon():
    """合朔后首个 Moon-Sun 120°(月在日前方)= dexter;同窗 sinister 应零命中。"""
    data = dict(BASE)
    data['startDate'] = '2024/04/14'
    data['endDate'] = '2024/04/22'
    data['conditions'] = _aspect_tree(angle=120, orb=2.0, side='dexter')
    dex = es.scan(data)
    assert 'err' not in dex and len(dex['intervals']) == 1, dex
    data['conditions'] = _aspect_tree(angle=120, orb=2.0, side='sinister')
    sin = es.scan(data)
    assert sin['intervals'] == []


# ---------------------------------------------------------------------------
# 组合树(区间代数 over 真实叶)
# ---------------------------------------------------------------------------

def test_not_group_complements():
    data = dict(BASE)
    data['conditions'] = {'type': 'not', 'conditions': [_aspect_tree()]}
    rsp = es.scan(data)
    ivs = rsp['intervals']
    # 三天域内挖掉一个合朔窗 → 两段
    assert len(ivs) == 2
    total = sum(iv['durationMin'] for iv in ivs)
    assert abs(total + es.scan({**BASE, 'conditions': _aspect_tree()})['intervals'][0]['durationMin']
               - 3.0 * 1440.0) < 2.0


def test_all_group_intersects():
    data = dict(BASE)
    data['conditions'] = {'type': 'all', 'conditions': [
        _aspect_tree(orb=5.0),
        _aspect_tree(orb=1.0),
    ]}
    rsp = es.scan(data)
    narrow = es.scan({**BASE, 'conditions': _aspect_tree(orb=1.0)})['intervals'][0]
    got = rsp['intervals'][0]
    assert abs(got['startJd'] - narrow['startJd']) < 1e-6
    assert abs(got['endJd'] - narrow['endJd']) < 1e-6


# ---------------------------------------------------------------------------
# 入口防呆
# ---------------------------------------------------------------------------

def test_scan_rejects_string_hsys():
    data = dict(BASE)
    data['hsys'] = 'PLACIDUS'
    data['conditions'] = _aspect_tree()
    rsp = es.scan(data)
    assert rsp.get('err') == 'invalid_conditions'
    assert 'hsys' in rsp.get('detail', '')


def test_scan_rejects_span_over_limit():
    data = dict(BASE)
    data['endDate'] = '2024/08/01'
    data['conditions'] = _aspect_tree()
    assert es.scan(data).get('err') == 'span_too_large'


def test_scan_rejects_bad_geo():
    data = dict(BASE)
    data['gpsLat'] = 200
    data['conditions'] = _aspect_tree()
    assert es.scan(data).get('err') == 'invalid_coordinates'


def test_scan_rejects_unknown_condition_type():
    data = dict(BASE)
    data['conditions'] = {'type': 'no_such_leaf', 'params': {}}
    assert es.scan(data).get('err') == 'invalid_conditions'


def test_scan_rejects_missing_required_param():
    data = dict(BASE)
    data['conditions'] = {'type': 'aspect', 'params': {'planetA': 'Moon'}}
    assert es.scan(data).get('err') == 'invalid_conditions'


def test_condition_types_registry_shape():
    """注册表契约:一键一行由前端哨兵管;这里锁 category/required 结构完备。"""
    for key, spec in es.CONDITION_TYPES.items():
        assert spec.get('category') in ('continuous', 'boolean', 'generative'), key
        assert isinstance(spec.get('required'), tuple), key
    assert set(es.GROUP_TYPES) == {'all', 'any', 'not', 'xor'}
