# -*- coding: utf-8 -*-
"""[Q-266/T-239] 演禽「自动换算农历」缺省档:公历→农历须辨闰月(sxtwl 精确换算,与策天同源)。
旧 _solar_to_lunar 自闰正月起线性数朔望月 → 闰月年份自闰月起至次年春节前农历月 +1(2006 闰七月:10-04 应八月十三,旧法九月)。"""
import os
import sys
from datetime import datetime

_ASTRO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _ASTRO not in sys.path:
    sys.path.insert(0, _ASTRO)

import pytest  # noqa: E402

sxtwl = pytest.importorskip('sxtwl')
from websrv.webxianqinsrv import _lunar_from_solar  # noqa: E402
from astrostudy.cetian_ziwei import _solar_to_lunar  # noqa: E402
import swisseph as swe  # noqa: E402


def _old(dt, tz=8.0):
    jd = swe.julday(dt.year, dt.month, dt.day, dt.hour + dt.minute / 60.0 - tz)
    return _solar_to_lunar(jd)


@pytest.mark.parametrize('ymd_hm, expect_ym', [
    ((2006, 10, 4, 10, 0), (2006, 8, 13)),    # 2006 闰七月:旧法九月 → 应八月十三
    ((2026, 1, 15, 10, 0), (2025, 11, 27)),   # 2025 闰六月:旧法十二月 → 应十一月廿七
    ((2026, 3, 1, 10, 0), (2026, 1, 13)),     # 非闰影响期:两法一致
])
def test_auto_lunar_uses_accurate_conversion(ymd_hm, expect_ym):
    dt = datetime(*ymd_hm)
    y, m, d, leap = _lunar_from_solar(dt, 8.0)
    assert (y, m, d) == expect_ym
    assert leap is False


def test_leap_period_differs_from_legacy_and_matches_sxtwl():
    dt = datetime(2006, 10, 4, 10, 0)
    new = _lunar_from_solar(dt, 8.0)
    old = _old(dt)
    ref = sxtwl.fromSolar(2006, 10, 4)
    assert (new[0], new[1], new[2]) == (ref.getLunarYear(), ref.getLunarMonth(), ref.getLunarDay())
    assert old[1] != new[1]   # 判别向量:旧法确实错一月


def test_leap_month_itself_is_flagged():
    # 2006-08-24 = 闰七月初一
    y, m, d, leap = _lunar_from_solar(datetime(2006, 8, 24, 10, 0), 8.0)
    assert (y, m, d, leap) == (2006, 7, 1, True)
