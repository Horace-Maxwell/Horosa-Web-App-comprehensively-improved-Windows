# -*- coding: utf-8 -*-
"""[Q-312/T-293 2026-09-18 口径 B·用户拍板] 晚子时两开关完全独立:
   after23NewDay 只管日柱是否 23 点进位;lateZiHourUseNextDay=0 = 时干用钟面当天(今日)日干起子时,不看日柱开关。
   此前七路 Python 引擎 / 全域权威在 (1,0) 取「已进位日柱的干」→ 甲申日 甲子时,与 Java BaZiHelper / 本地八字引擎
   (甲申日 壬子时)分叉;奇门页头(本地)与九宫(后端)因此两套时辰。四组合与 jest baziLunarLocal.dayBoundary 矩阵逐字同。"""
import os
import sys

_ASTRO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _ASTRO not in sys.path:
    sys.path.insert(0, _ASTRO)

import pytest  # noqa: E402

pytest.importorskip('sxtwl')
from kin_year_domain import extreme_pillars  # noqa: E402


@pytest.mark.parametrize('after23, late_zi, day, hour', [
    (1, 1, '甲申', '甲子'),   # 子初换日:日柱进位、时干次日干起
    (1, 0, '甲申', '壬子'),   # 日柱进位、时干仍按钟面当天(癸未)干起 ← 口径 B 核心 case(此前误为 甲子)
    (0, 1, '癸未', '甲子'),   # 夜子时:日守今、时干次日干起
    (0, 0, '癸未', '壬子'),   # 子正换日:日守今、时干今日干起
])
def test_1990_05_18_23h_matrix(after23, late_zi, day, hour):
    y, m, d, h, _ = extreme_pillars(1990, 5, 18, 23, 0, after23=after23, hour_gan_next=late_zi)
    assert (d, h) == (day, hour)


@pytest.mark.parametrize('after23, late_zi, day, hour', [
    (1, 1, '壬寅', '庚子'),
    (1, 0, '壬寅', '戊子'),   # jest 矩阵「after23=1 + lateZi=0 → 壬寅日 戊子时」同向量
    (0, 1, '辛丑', '庚子'),
    (0, 0, '辛丑', '戊子'),
])
def test_2026_05_27_2330_matches_jest_matrix(after23, late_zi, day, hour):
    y, m, d, h, _ = extreme_pillars(2026, 5, 27, 23, 30, after23=after23, hour_gan_next=late_zi)
    assert (d, h) == (day, hour)


@pytest.mark.parametrize('hour', [0, 1, 12, 22])
def test_non_23h_switch_is_noop(hour):
    base = extreme_pillars(1990, 5, 18, hour, 0, after23=1, hour_gan_next=1)
    for a in (0, 1):
        for l in (0, 1):
            assert extreme_pillars(1990, 5, 18, hour, 0, after23=a, hour_gan_next=l) == base
