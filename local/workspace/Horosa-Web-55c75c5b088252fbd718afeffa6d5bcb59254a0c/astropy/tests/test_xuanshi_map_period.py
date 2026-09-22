# -*- coding: utf-8 -*-
"""[Q-482/T-444] 玄学地图朝代 chip(细朝代)→ 钉点库粗桶键映射:此前 chip 值直接当键精确取,16 个 chip 恒空。"""
import os
import sys

_ASTRO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _ASTRO not in sys.path:
    sys.path.insert(0, _ASTRO)

from astrostudy.xuanshi.queries import map_period_keys, _MAP_PERIOD_BUCKET  # noqa: E402


def test_fine_dynasty_maps_to_bucket_and_keeps_itself():
    assert map_period_keys('西周') == {'西周', '先秦两汉'}
    assert map_period_keys('北宋') == {'北宋', '宋'}
    assert map_period_keys('西夏') == {'西夏', '辽金'}
    assert map_period_keys('唐') == {'唐'}
    assert map_period_keys('志怪笔记') == {'志怪笔记'}
    assert map_period_keys('') == set() and map_period_keys(None) == set()


def test_all_23_chips_covered():
    chips = ['西周', '春秋', '战国', '秦', '西汉', '新莽', '东汉', '三国', '西晋', '东晋', '十六国', '南朝', '北朝', '隋', '唐', '五代', '北宋', '南宋', '辽', '金', '西夏', '元', '明']
    assert all(c in _MAP_PERIOD_BUCKET for c in chips)
    assert set(_MAP_PERIOD_BUCKET.values()) == {'先秦两汉', '东汉', '三国', '两晋', '南北朝', '隋', '唐', '五代', '宋', '辽金', '元', '明'}
