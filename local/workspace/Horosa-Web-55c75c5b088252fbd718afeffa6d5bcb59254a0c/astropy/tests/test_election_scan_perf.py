# -*- coding: utf-8 -*-
"""扫描引擎性能冒烟(宽松时限,只防数量级退化——不是基准测试)。"""
import time

from astrostudy import election_scan as es


def test_one_month_mixed_tree_under_20s():
    """1 个月「月日 90°(任意) AND 月不空亡(by_sign_orb)」< 20s(常机单跑 ~4s;
    时限含全套并行/后台构建争用余量——只防数量级退化,不是基准)。"""
    data = {
        'startDate': '2024/04/01', 'startTime': '00:00:00',
        'endDate': '2024/04/30', 'endTime': '23:59:59',
        'zone': '+00:00', 'gpsLat': 39.9042, 'gpsLon': 116.4074,
        'hsys': 1, 'zodiacal': 0, 'ad': 1, 'precision': 'minute',
        'conditions': {'type': 'all', 'conditions': [
            {'type': 'aspect', 'params': {'planetA': 'Moon', 'planetB': 'Sun',
                                          'angle': 90, 'orb': 3, 'motion': 'any',
                                          'side': 'any', 'partile': 'off'}},
            {'type': 'not', 'conditions': [
                {'type': 'considerations', 'params': {'item': 'moon_voc', 'vocMode': 'by_sign_orb'}},
            ]},
        ]},
    }
    t0 = time.time()
    rsp = es.scan(data)
    dt = time.time() - t0
    assert 'err' not in rsp, rsp
    assert dt < 20.0, 'scan took {0:.1f}s'.format(dt)
    assert rsp['stats']['evalPoints'] < 20000, rsp['stats']


def test_r3_mixed_tree_one_month_budget():
    """R3 新类混合树一月预算:光线动态+宗派+盘主 AND 组合 <25s(争用余量)。"""
    import time
    from astrostudy import election_scan as es
    data = {
        'startDate': '2024/04/01', 'startTime': '00:00:00',
        'endDate': '2024/05/01', 'endTime': '00:00:00',
        'zone': '+00:00', 'gpsLat': 39.9042, 'gpsLon': 116.4074,
        'hsys': 0, 'zodiacal': 0, 'ad': 1,
        'conditions': {'type': 'all', 'conditions': [
            {'type': 'light_dynamics', 'params': {'item': 'translation', 'mover': 'Moon'}},
            {'type': 'sect_joy', 'params': {'item': 'of_sect', 'planet': 'Venus'}},
            {'type': 'almuten_is', 'params': {'scope': 'chart', 'planet': 'Mars'}},
        ]},
    }
    t0 = time.time()
    rsp = es.scan(data)
    dt = time.time() - t0
    assert 'err' not in rsp, rsp
    assert dt < 25.0, 'R3 混合树一月 {0:.1f}s 超预算'.format(dt)


def test_r3_heavy_leaf_month_budget():
    """重叶(有情联结,联结判定密集)单月预算:纯几何化后 <6s(旧版 ~17s 把真机拖死)。"""
    import time
    from astrostudy import election_scan as es
    data = {
        'startDate': '2026/01/02', 'startTime': '00:00:00',
        'endDate': '2026/02/01', 'endTime': '00:00:00',
        'zone': '+08:00', 'gpsLat': 26.08, 'gpsLon': 119.32,
        'hsys': 0, 'zodiacal': 0, 'ad': 1,
        'conditions': {'type': 'pattern_overview',
                       'params': {'item': 'sentient_link', 'planet': 'Moon', 'purity': 'any_pure'}},
    }
    t0 = time.time()
    rsp = es.scan(data)
    dt = time.time() - t0
    assert 'err' not in rsp, rsp
    assert rsp['intervals'], '一月内月亮有情联结不可能为空'
    assert dt < 6.0, '重叶一月 {0:.1f}s 超预算(纯几何化失效?)'.format(dt)
