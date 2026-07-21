# -*- coding: utf-8 -*-
"""邵子神数四柱权威一致性金标(真机根因:用户实测 BC12026 邵子神数四柱 ≠ 八字)。

根因:shaozi 旧用自算简化公式(_year_ganzhi 公历年无立春界、_month_ganzhi 公历月无节气、
_day_ganzhi 格里 JD 对 BC 儒略历错),在立春前/节气边界/BC 全错。修复:四柱统一走权威
kin_year_domain.extreme_pillars(与八字/主链完全一致)。本金标锁定 shaozi 四柱=权威,防回退。

需 flatlib(swe)星历(astropy conftest 环境俱备)。
"""
import os
import sys
import types

import pytest

# astro.shaozi 在 vendor/kinastro 下(与 webshaozisrv 同法把 kinastro 加入 sys.path)
_KINASTRO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "vendor", "kinastro"))
if os.path.isdir(os.path.join(_KINASTRO, "astro")) and _KINASTRO not in sys.path:
    sys.path.insert(0, _KINASTRO)

from kin_year_domain import extreme_pillars
from astro.shaozi.calculator import calculate_ganzhi_from_datetime


def _dt(year, month, day, hour, minute=0):
    # calculate_ganzhi_from_datetime 只读 year/month/day/hour/minute + 支持 +timedelta(BC 分支不触发)
    return types.SimpleNamespace(year=year, month=month, day=day, hour=hour, minute=minute)


# 覆盖:现代立春后/立春前(旧简化年柱错处) + 干支锚 + BC 极端(用户实测)
CASES = [
    (2026, 7, 19, 22, 6),    # 立春后·现代基线
    (2026, 1, 15, 10, 0),    # 立春前·旧公历年年柱错处
    (1984, 2, 2, 10, 0),     # 立春前·甲子年边界(旧算错癸亥→甲子)
    (1984, 3, 15, 10, 0),    # 立春后·甲子年
    (-12026, 7, 19, 22, 6),  # 🔴 用户实测 BC(旧:甲午辛未丁未辛亥;权威:乙未庚辰己卯乙亥)
    (-722, 3, 5, 10, 0),     # BC 干支史深古
]


@pytest.mark.parametrize("y,mo,d,h,mi", CASES)
def test_shaozi_pillars_match_authoritative(y, mo, d, h, mi):
    gz = calculate_ganzhi_from_datetime(_dt(y, mo, d, h, mi))
    yTG, mTG, dTG, hTG, _zi = extreme_pillars(y, mo, d, h, mi)
    assert gz["year"] == yTG, "%s 年柱 %s != 权威 %s" % ((y, mo, d), gz["year"], yTG)
    assert gz["month"] == mTG, "%s 月柱 %s != 权威 %s" % ((y, mo, d), gz["month"], mTG)
    assert gz["day"] == dTG, "%s 日柱 %s != 权威 %s" % ((y, mo, d), gz["day"], dTG)
    assert gz["hour"] == hTG, "%s 时柱 %s != 权威 %s" % ((y, mo, d), gz["hour"], hTG)


def test_bc12026_exact_golden():
    """用户实测锚:BC12026-07-19 22:06 = 乙未 庚辰 己卯 乙亥(=八字,非旧简化甲午辛未丁未辛亥)。"""
    gz = calculate_ganzhi_from_datetime(_dt(-12026, 7, 19, 22, 6))
    assert (gz["year"], gz["month"], gz["day"], gz["hour"]) == ("乙未", "庚辰", "己卯", "乙亥")
