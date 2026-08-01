# -*- coding: utf-8 -*-
"""世运相位格局几何 golden:新增 Grand Sextile 大六角 / Cradle 摇篮 两检测(§17.2 补齐)。

构造精确黄经点集直调 detect_patterns:
  ① 大六角:六星 0/60/120/180/240/300 环序相邻皆 60° → grand_sextile 命中;
  ② 摇篮:0/60/120/180 三连 60°+首尾 180° → cradle 命中(且不误报 mystic_rectangle:仅 1 对冲);
  ③ 负例:断链(缺一段 sextile)不报 cradle;五星不报大六角;
  ④ 既有七型零回归:大三角/T 三角样例照旧命中。
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from astrostudy.astroextra import detect_patterns


def _pts(lons_by_id):
    out = []
    for pid, lon in lons_by_id.items():
        out.append({'id': pid, 'lon': float(lon) % 360.0, 'sign': int((lon % 360) // 30)})
    return out


def _types(patterns):
    return set(p['type'] for p in patterns)


def test_grand_sextile_hits_on_exact_hexagon():
    pts = _pts({'Sun': 0, 'Moon': 60, 'Mercury': 120, 'Venus': 180, 'Mars': 240, 'Jupiter': 300})
    res = detect_patterns(pts)
    assert 'grand_sextile' in _types(res)
    gs = next(p for p in res if p['type'] == 'grand_sextile')
    assert len(gs['points']) == 6


def test_cradle_hits_and_no_mystic_false_positive():
    pts = _pts({'Sun': 0, 'Moon': 60, 'Mercury': 120, 'Venus': 180})
    res = detect_patterns(pts)
    assert 'cradle' in _types(res)
    assert 'mystic_rectangle' not in _types(res)   # 仅 1 对冲,不满足神秘矩形判据
    cr = next(p for p in res if p['type'] == 'cradle')
    assert cr['points'][0] == 'Sun' or cr['points'][-1] == 'Sun'   # 链端点含 0° 星


def test_cradle_negative_broken_chain():
    # 断链:60→130 段非 sextile(70° 超 4° 容许) → 无摇篮
    pts = _pts({'Sun': 0, 'Moon': 60, 'Mercury': 130, 'Venus': 180})
    assert 'cradle' not in _types(detect_patterns(pts))


def test_grand_sextile_negative_five_points():
    pts = _pts({'Sun': 0, 'Moon': 60, 'Mercury': 120, 'Venus': 180, 'Mars': 240})
    assert 'grand_sextile' not in _types(detect_patterns(pts))


def test_legacy_patterns_still_detected():
    # 大三角 0/120/240
    res1 = detect_patterns(_pts({'Sun': 0, 'Moon': 120, 'Mercury': 240}))
    assert 'grand_trine' in _types(res1)
    # T 三角 0/180 + 90 顶点
    res2 = detect_patterns(_pts({'Sun': 0, 'Moon': 180, 'Mars': 90}))
    assert 't_square' in _types(res2)
