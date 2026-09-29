# -*- coding: utf-8 -*-
"""生辰节气(/jieqi/birth)快路径:节气牛顿求解直取太阳位置、卯时基准盘用太阳瘦盘。

开关 HOROSA_JIEQI_FAST_APPROACH(与 YearJieQi / NongLi 同一开关)两档输出逐字节相同;
快档下整个 compute 不再建任何整张默认盘(全行星 + 宫位 + 阿拉伯点)—— 每请求原约 30 张。
"""
import os
import sys

_ASTRO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _ASTRO not in sys.path:
    sys.path.insert(0, _ASTRO)

import jsonpickle  # noqa: E402

from astrostudy.jieqi import BirthJieQi as BJ  # noqa: E402

# 覆盖:公元前 / 公元初 / 近代 / 远未来;南北半球(南半球走 relocate 分支)与高纬(赤经法);
# 两种卯时基准(节气立春 / 当地)× 两种求法(赤经 / 黄经;黄经法只取 |纬度| ≤ 45°);显式 ad=-1;跨年月份。
CASES = [
    {'date': '1990-05-18', 'time': '10:00:00', 'zone': '+08:00', 'lat': '31n38', 'lon': '118e27', 'byLon': 0, 'useLocalMao': 0},
    {'date': '1990-05-18', 'time': '10:00:00', 'zone': '+08:00', 'lat': '31n38', 'lon': '118e27', 'byLon': 1, 'useLocalMao': 1},
    {'date': '2024-01-03', 'time': '00:00:01', 'zone': '+08:00', 'lat': '39n54', 'lon': '116e23', 'byLon': 0, 'useLocalMao': 0},
    {'date': '2024-12-28', 'time': '23:59:59', 'zone': '-05:00', 'lat': '40n42', 'lon': '74w00', 'byLon': 1, 'useLocalMao': 0},
    {'date': '2000-02-04', 'time': '20:40:00', 'zone': '+08:00', 'lat': '22n17', 'lon': '114e10', 'byLon': 0, 'useLocalMao': 1},
    {'date': '1976-07-06', 'time': '21:11:00', 'zone': '+08:00', 'lat': '33s52', 'lon': '151e12', 'byLon': 0, 'useLocalMao': 0},
    {'date': '2017-10-22', 'time': '02:34:46', 'zone': '-09:30', 'lat': '41s17', 'lon': '174e46', 'byLon': 1, 'useLocalMao': 1},
    {'date': '2024-06-15', 'time': '12:00:00', 'zone': '+00:00', 'lat': '78n13', 'lon': '15e38', 'byLon': 0, 'useLocalMao': 0},
    {'date': '2024-12-15', 'time': '03:00:00', 'zone': '+00:00', 'lat': '77s50', 'lon': '166e40', 'byLon': 0, 'useLocalMao': 1},
    {'date': '1066-10-14', 'time': '09:00:00', 'zone': '+00:00', 'lat': '50n55', 'lon': '0e29', 'byLon': 0, 'useLocalMao': 0},
    {'date': '0618-06-18', 'time': '06:30:00', 'zone': '+08:00', 'lat': '34n16', 'lon': '108e56', 'byLon': 1, 'useLocalMao': 0},
    {'date': '-500/03/05', 'time': '12:00:00', 'zone': '+08:00', 'lat': '35n00', 'lon': '117e00', 'byLon': 0, 'useLocalMao': 0},
    {'date': '-1046-01-20', 'time': '05:00:00', 'zone': '+08:00', 'lat': '34n16', 'lon': '108e56', 'byLon': 0, 'useLocalMao': 1},
    {'date': '7040/07/19', 'ad': -1, 'time': '11:00:00', 'zone': '+08:00', 'lat': '30n00', 'lon': '120e00', 'byLon': 0, 'useLocalMao': 0},
    {'date': '2999-11-30', 'time': '18:45:00', 'zone': '+14:00', 'lat': '1n52', 'lon': '157w24', 'byLon': 1, 'useLocalMao': 0},
    {'date': '2050-03-20', 'time': '08:08:08', 'zone': '+05:30', 'lat': '28n36', 'lon': '77e12', 'byLon': 0, 'useLocalMao': 0},
]


def _encode(case):
    return jsonpickle.encode(BJ.BirthJieQi(dict(case)).compute(), unpicklable=False)


def test_fast_and_slow_paths_are_byte_identical(monkeypatch):
    monkeypatch.setattr(BJ, '_JIEQI_FAST_APPROACH', True)
    fast = [_encode(c) for c in CASES]
    monkeypatch.setattr(BJ, '_JIEQI_FAST_APPROACH', False)
    slow = [_encode(c) for c in CASES]
    for c, a, b in zip(CASES, fast, slow):
        assert a == b, c


def test_fast_path_builds_no_full_default_chart(monkeypatch):
    built = {'full': 0, 'slim': 0}
    real_chart = BJ.Chart

    def counting_chart(*args, **kwargs):
        if kwargs.get('needpars') is False:
            built['slim'] += 1
        else:
            built['full'] += 1
        return real_chart(*args, **kwargs)

    monkeypatch.setattr(BJ, 'Chart', counting_chart)
    monkeypatch.setattr(BJ, '_JIEQI_FAST_APPROACH', True)
    for c in CASES[:6]:
        _encode(c)
    assert built['full'] == 0
    assert built['slim'] > 0
    # 反证:开关关时确实走整张默认盘(计数器有判别力)
    monkeypatch.setattr(BJ, '_JIEQI_FAST_APPROACH', False)
    _encode(CASES[0])
    assert built['full'] > 0
