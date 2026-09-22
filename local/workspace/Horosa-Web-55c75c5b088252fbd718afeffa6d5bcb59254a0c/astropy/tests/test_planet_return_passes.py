# -*- coding: utf-8 -*-
"""[Q-366/T-345 2026-09-18] 多重回归:同一回内列全逆行三过(此前遇首个过零即 break,土木逆行的三次回归只报第一次)。
   T-345 复现向量:1990-01-05 10:00 +08:00 本命土星 286.08°,2019 年实际过本命度三次(02-12 / 07-25 / 11-10),旧码只报 02-11。"""
import os
import sys

_ASTRO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _ASTRO not in sys.path:
    sys.path.insert(0, _ASTRO)

import pytest  # noqa: E402

pytest.importorskip('swisseph')
from astrostudy.astroextra import compute_planet_return  # noqa: E402


def _run(date, count=1):
    return compute_planet_return({'date': date, 'time': '10:00:00', 'zone': '+08:00', 'body': 'Saturn', 'count': count})


def test_saturn_first_return_lists_all_three_passes():
    res = _run('1990-01-05')
    r = res['returns'][0]
    assert r['which'] == 1
    passes = r['passes']
    assert [p['pass'] for p in passes] == [1, 2, 3]
    dates = [p['date'] for p in passes]
    assert dates[0].startswith('2019-02'), dates
    assert dates[1].startswith('2019-07'), dates
    assert dates[2].startswith('2019-11'), dates
    # 首过仍在顶层(旧消费方零变);中间那过是逆行
    assert r['date'] == passes[0]['date'] and r['jd'] == passes[0]['jd']
    assert passes[1]['retrograde'] is True
    assert passes[0]['retrograde'] is False and passes[2]['retrograde'] is False


def test_single_pass_return_has_one_pass():
    # T-345:1990-11-20 单过一致
    res = _run('1990-11-20')
    r = res['returns'][0]
    assert len(r['passes']) == 1 and r['passes'][0]['jd'] == r['jd']
